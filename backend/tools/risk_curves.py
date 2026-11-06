"""
Deterministic Risk Curves and Breakpoint Attribution Engine for ORCA.
Calibrated for small motorized Indian fishing craft.

Three-layer neuro-symbolic safety pipeline:
1. NORMALIZE: Map each physical hazard to a 0..1 factor via piecewise-linear breakpoint curves.
2. COMBINE: Weighted sum to compute transparent 0..100 base score with factor attribution.
3. OVERRIDE: Deterministic safety floors enforce hard boundaries that can only raise risk,
   never lower it.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple
from pydantic import BaseModel

# Breakpoint sequence type: list of (x, y) coordinates
Breakpoints = Sequence[Tuple[float, float]]

# --- Calibrated Hazard Curves for Small Coastal Craft ---
WAVE_CURVE: Breakpoints = [
    (0.0, 0.0), (0.5, 0.10), (1.0, 0.25), (1.5, 0.45),
    (2.0, 0.68), (2.5, 0.87), (3.0, 0.95), (4.0, 1.0)
]

WIND_CURVE: Breakpoints = [
    (0.0, 0.0), (10.0, 0.10), (20.0, 0.35), (30.0, 0.62),
    (35.0, 0.77), (45.0, 0.90), (62.0, 1.0)
]

CURRENT_CURVE: Breakpoints = [
    (0.0, 0.0), (0.5, 0.20), (1.0, 0.55), (1.5, 0.80), (2.5, 1.0)
]

VISIBILITY_CURVE: Breakpoints = [
    (0.0, 1.0), (1.0, 0.85), (3.0, 0.60), (6.0, 0.35),
    (10.0, 0.15), (15.0, 0.05)
]

OFFSHORE_CURVE: Breakpoints = [
    (0.0, 0.05), (10.0, 0.20), (25.0, 0.38), (40.0, 0.55),
    (60.0, 0.72), (100.0, 0.90)
]

ALERT_FACTORS: Dict[str, float] = {
    "severe": 1.00,     # Cyclone / tsunami
    "high": 0.88,
    "moderate": 0.84,   # Standard "do not venture" fishermen warning
    "low": 0.45,
}

SEA_STATE_BONUS: Dict[str, float] = {
    "calm": 0.0,
    "slight": 0.05,
    "moderate": 0.15,
    "rough": 0.30,
    "very rough": 0.45,
    "phenomenal": 0.55,
}

DEFAULT_WEIGHTS: Dict[str, float] = {
    "wave": 0.25,     # dominant capsize hazard for small craft
    "cyclone": 0.25,  # official alert / storm proximity
    "wind": 0.20,
    "weather": 0.10,  # rain, lightning, visibility
    "ocean": 0.10,    # current, sea state
    "gis": 0.10,      # offshore distance, restricted zone proximity
}

# Deterministic safety floors (only raise risk)
SEVERE_WARNING_FLOOR = 92
FISHERMEN_WARNING_FLOOR = 70
WAVE_DANGER_M = 4.0
WAVE_DANGER_FLOOR = 85
WIND_DANGER_KMH = 62.0
WIND_DANGER_FLOOR = 85
RESTRICTED_ZONE_FLOOR = 60


def piecewise_curve(value: Optional[float], points: Breakpoints, default: float = 0.3) -> float:
    """Piecewise-linear normalization of a physical value into a 0..1 hazard factor."""
    if value is None:
        return default
    lo_x, lo_y = points[0]
    if value <= lo_x:
        return lo_y
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if value <= x1:
            span = (x1 - x0) or 1e-9
            return y0 + (y1 - y0) * (value - x0) / span
    return points[-1][1]


def wave_factor(wave_m: Optional[float]) -> float:
    return piecewise_curve(wave_m, WAVE_CURVE)


def wind_factor(wind_kmh: Optional[float]) -> float:
    return piecewise_curve(wind_kmh, WIND_CURVE)


def weather_factor(
    rain_pct: Optional[float] = None,
    lightning: bool = False,
    visibility_km: Optional[float] = None,
    cape_j_kg: Optional[float] = None,
) -> float:
    rain = (rain_pct or 0.0) / 100.0
    f = 0.8 * rain + 0.25 * piecewise_curve(visibility_km, VISIBILITY_CURVE)
    if lightning or (cape_j_kg is not None and cape_j_kg >= 1000.0):
        f = max(f, 0.9)
    return min(1.0, f)


def ocean_factor(
    current_ms: Optional[float] = None,
    sea_state_label: Optional[str] = "moderate",
) -> float:
    base = SEA_STATE_BONUS.get((sea_state_label or "moderate").lower(), 0.15)
    return min(1.0, base + 0.55 * piecewise_curve(current_ms, CURRENT_CURVE))


def gis_factor(
    distance_shore_km: Optional[float] = None,
    nearest_zone_km: Optional[float] = None,
    inside_zone: bool = False,
) -> float:
    f = piecewise_curve(distance_shore_km, OFFSHORE_CURVE)
    if inside_zone:
        return 1.0
    if nearest_zone_km is not None and nearest_zone_km < 10.0:
        f = max(f, 0.55 + 0.04 * (10.0 - nearest_zone_km))
    return min(1.0, f)


def alert_factor(alerts: Sequence[Dict[str, Any]]) -> Tuple[float, bool, Optional[Dict[str, Any]]]:
    """Calculates highest-severity active alert factor."""
    if not alerts:
        return 0.05, False, None
    worst: Optional[Dict[str, Any]] = None
    best_f = 0.0
    for a in alerts:
        sev = str(a.get("severity", "moderate")).lower()
        f = ALERT_FACTORS.get(sev, 0.6)
        if f > best_f:
            best_f = f
            worst = a
    official = bool(worst and worst.get("official", True))
    return best_f, official, worst


def categorize_risk(score: float) -> str:
    s = round(score)
    if s <= 25:
        return "LOW"
    if s <= 50:
        return "MODERATE"
    if s <= 79:
        return "HIGH"
    return "EXTREME"


def evaluate_risk_factors(
    *,
    wave_height_m: Optional[float] = None,
    wave_period_s: Optional[float] = None,
    wind_speed_kmh: Optional[float] = None,
    wind_gusts_kmh: Optional[float] = None,
    rain_probability_pct: Optional[float] = None,
    lightning: bool = False,
    cape_j_kg: Optional[float] = None,
    visibility_km: Optional[float] = None,
    current_speed_ms: Optional[float] = None,
    sea_state_label: Optional[str] = None,
    alerts: Sequence[Dict[str, Any]] = (),
    distance_shore_km: Optional[float] = None,
    nearest_zone_km: Optional[float] = None,
    inside_zone: bool = False,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Evaluates complete piecewise-linear risk breakdown and applies deterministic safety floors.
    Returns:
        dict containing:
            score (int: 0..100)
            category (str: LOW, MODERATE, HIGH, EXTREME)
            factors (list of dict with key, label, factor, weight, contribution, detail)
            overrides (list of str detailing which safety floors fired)
            official_warning (bool)
            go (bool: True if safe for small craft operations)
    """
    active_weights = weights or DEFAULT_WEIGHTS
    alert_f, official_warning, worst_alert = alert_factor(alerts)

    w_factor = wave_factor(wave_height_m)
    wind_f = wind_factor(wind_speed_kmh)
    weath_f = weather_factor(rain_probability_pct, lightning, visibility_km, cape_j_kg)
    ocn_f = ocean_factor(current_speed_ms, sea_state_label)
    g_factor = gis_factor(distance_shore_km, nearest_zone_km, inside_zone)

    factors_dict = {
        "wave": {
            "label": "Significant Wave Height",
            "factor": round(w_factor, 3),
            "weight": active_weights.get("wave", 0.25),
            "detail": f"{wave_height_m:.1f}m significant wave height" if wave_height_m is not None else "No wave reading",
        },
        "cyclone": {
            "label": "Storm & Cyclone Alerts",
            "factor": round(alert_f, 3),
            "weight": active_weights.get("cyclone", 0.25),
            "detail": worst_alert.get("headline", "Active marine bulletin") if worst_alert else "No active cyclone warning",
        },
        "wind": {
            "label": "Surface Wind & Gusts",
            "factor": round(wind_f, 3),
            "weight": active_weights.get("wind", 0.20),
            "detail": f"{wind_speed_kmh:.0f} km/h coastal wind" if wind_speed_kmh is not None else "No wind reading",
        },
        "weather": {
            "label": "Precipitation & Lightning",
            "factor": round(weath_f, 3),
            "weight": active_weights.get("weather", 0.10),
            "detail": (
                ("Severe lightning / CAPE alert; " if (lightning or (cape_j_kg and cape_j_kg >= 1000.0)) else "")
                + (f"Rain prob {rain_probability_pct:.0f}%" if rain_probability_pct is not None else "Clear skies")
            ),
        },
        "ocean": {
            "label": "Current & Swell Dynamics",
            "factor": round(ocn_f, 3),
            "weight": active_weights.get("ocean", 0.10),
            "detail": f"Current {current_speed_ms:.1f} m/s, sea state {sea_state_label or 'moderate'}" if current_speed_ms is not None else f"Sea state {sea_state_label or 'moderate'}",
        },
        "gis": {
            "label": "Offshore & Geofence Proximity",
            "factor": round(g_factor, 3),
            "weight": active_weights.get("gis", 0.10),
            "detail": (
                "Inside restricted maritime zone (IMBL/MPA)" if inside_zone else
                (f"Proximity to boundary: {nearest_zone_km:.1f} km" if nearest_zone_km is not None and nearest_zone_km < 15.0 else
                 f"Offshore distance: {distance_shore_km:.0f} km" if distance_shore_km is not None else "Position clear")
            ),
        },
    }

    score = 0.0
    factors_list = []
    for key, data in factors_dict.items():
        contribution = round(100.0 * data["weight"] * data["factor"], 1)
        score += contribution
        factors_list.append({
            "key": key,
            "label": data["label"],
            "factor": data["factor"],
            "weight": data["weight"],
            "contribution": contribution,
            "detail": data["detail"],
        })

    # Layer 3: Deterministic Safety Floors (Overrides can ONLY raise score)
    overrides: List[str] = []

    def apply_floor(floor_val: int, reason: str):
        nonlocal score
        if score < floor_val:
            score = float(floor_val)
            overrides.append(reason)

    if worst_alert and str(worst_alert.get("severity")).lower() == "severe" and official_warning:
        apply_floor(SEVERE_WARNING_FLOOR, f"Official severe weather/cyclone bulletin ({worst_alert.get('source', 'IMD')}) enforces minimum risk floor of {SEVERE_WARNING_FLOOR}.")

    if worst_alert and worst_alert.get("type") == "fishermen_warning" and official_warning:
        apply_floor(FISHERMEN_WARNING_FLOOR, f"Official fishermen advisory ({worst_alert.get('source', 'IMD')}) enforces minimum risk floor of {FISHERMEN_WARNING_FLOOR}.")

    if wave_height_m is not None and wave_height_m >= WAVE_DANGER_M:
        apply_floor(WAVE_DANGER_FLOOR, f"Dangerous wave height ({wave_height_m:.1f}m >= {WAVE_DANGER_M:.1f}m) enforces minimum risk floor of {WAVE_DANGER_FLOOR}.")

    if wind_speed_kmh is not None and wind_speed_kmh >= WIND_DANGER_KMH:
        apply_floor(WIND_DANGER_FLOOR, f"Gale-force surface winds ({wind_speed_kmh:.0f} km/h >= {WIND_DANGER_KMH:.0f} km/h) enforce minimum risk floor of {WIND_DANGER_FLOOR}.")

    if inside_zone:
        apply_floor(RESTRICTED_ZONE_FLOOR, f"Position inside restricted zone (IMBL/MPA) enforces minimum risk floor of {RESTRICTED_ZONE_FLOOR}.")

    final_score = int(round(max(0.0, min(100.0, score))))
    category = categorize_risk(final_score)
    go_verdict = (category in ("LOW", "MODERATE")) and not official_warning

    factors_list.sort(key=lambda x: x["contribution"], reverse=True)

    return {
        "score": final_score,
        "category": category,
        "factors": factors_list,
        "overrides": overrides,
        "official_warning": official_warning,
        "go": go_verdict,
    }
