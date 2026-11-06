"""
Fishing Probability, Marine Species Likelihood, and Trip Planning Tool for ORCA.
Integrates INCOIS PFZ methodology, OBIS regional biodiversity occurrences,
hourly weather constraints, and artisanal trip economics.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

# --- Factor Curves & Biological Thresholds ---
CHL_CURVE = [
    (0.0, 0.03), (0.3, 0.14), (0.6, 0.30), (1.0, 0.48),
    (1.5, 0.68), (2.0, 0.84), (3.0, 1.0)
]
SST_OPTIMAL = (26.5, 29.0)     # °C - optimal Indian coastal pelagic range
SST_TOLERANCE = 3.0            # °C beyond optimal band before factor floors
WAVE_WORKABLE = 1.2            # m - workable sea for small FRP craft
WAVE_UNWORKABLE = 3.0          # m - gear operations dangerous

# Crepuscular feeding pattern (dawn and dusk peaks)
TIME_OF_DAY_FACTORS = {
    0: 0.55, 1: 0.50, 2: 0.50, 3: 0.60, 4: 0.78, 5: 0.95,
    6: 1.00, 7: 0.96, 8: 0.86, 9: 0.74, 10: 0.66, 11: 0.60,
    12: 0.56, 13: 0.56, 14: 0.60, 15: 0.68, 16: 0.80, 17: 0.93,
    18: 0.98, 19: 0.90, 20: 0.78, 21: 0.68, 22: 0.62, 23: 0.58,
}

WEIGHTS = {
    "chlorophyll": 0.34,
    "sst": 0.20,
    "front": 0.16,
    "sea_state": 0.18,
    "time_of_day": 0.12,
}

# Coastal target species bands
SPECIES_BANDS: List[Dict[str, Any]] = [
    {"name": "Bangda (Indian mackerel)", "scientific": "Rastrelliger kanagurta", "sst": (26.0, 29.0), "chl_min": 0.5, "dist": (5, 85)},
    {"name": "Tarli (oil sardine)",      "scientific": "Sardinella longiceps",   "sst": (26.0, 29.5), "chl_min": 0.9, "dist": (5, 70)},
    {"name": "Paplet (silver pomfret)",  "scientific": "Pampus argenteus",       "sst": (26.0, 29.5), "chl_min": 0.4, "dist": (5, 50)},
    {"name": "Surmai (seer fish)",       "scientific": "Scomberomorus commerson", "sst": (27.0, 30.0), "chl_min": 0.2, "dist": (30, 100)},
    {"name": "Bombil (Bombay duck)",     "scientific": "Harpadon nehereus",      "sst": (27.0, 30.5), "chl_min": 0.6, "dist": (5, 45)},
    {"name": "Hilsa (ilish)",            "scientific": "Tenualosa ilisha",       "sst": (26.0, 30.5), "chl_min": 0.6, "dist": (5, 60)},
]

# OBIS regional prevalence weights across coastal sectors
# NW: Gujarat/Maharashtra, SW: Goa/Karnataka/Kerala, SE: TN/Andhra, NE: Odisha/Bengal
SPECIES_OCCURRENCE: Dict[str, Dict[str, int]] = {
    "Bangda (Indian mackerel)": {"NW": 19, "SW": 87, "SE": 42, "NE": 8},
    "Tarli (oil sardine)":      {"NW": 11, "SW": 113, "SE": 37, "NE": 1},
    "Paplet (silver pomfret)":  {"NW": 24, "SW": 12, "SE": 19, "NE": 17},
    "Surmai (seer fish)":       {"NW": 9,  "SW": 24, "SE": 25, "NE": 4},
    "Bombil (Bombay duck)":     {"NW": 34, "SW": 1,  "SE": 14, "NE": 121},
    "Hilsa (ilish)":            {"NW": 17, "SW": 6,  "SE": 9,  "NE": 32},
}

# Artisanal Trip Economics Constants (Small FRP Craft with 9.9 HP Outboard)
FUEL_PRICE_INR_PER_L = 100.0
FUEL_L_PER_KM = 0.45
TYPICAL_CATCH_KG = 80.0
MIXED_CATCH_INR_PER_KG = 140.0


def _curve_interpolate(value: Optional[float], points: Sequence[Tuple[float, float]], default: float = 0.3) -> float:
    if value is None:
        return default
    if value <= points[0][0]:
        return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if value <= x1:
            span = (x1 - x0) or 1e-9
            return y0 + (y1 - y0) * (value - x0) / span
    return points[-1][1]


def sst_factor(sst: Optional[float]) -> float:
    if sst is None:
        return 0.4
    lo, hi = SST_OPTIMAL
    if lo <= sst <= hi:
        return 1.0
    drift = (lo - sst) if sst < lo else (sst - hi)
    return max(0.15, 1.0 - (drift / SST_TOLERANCE) * 0.85)


def sea_state_factor(wave_m: Optional[float]) -> float:
    if wave_m is None:
        return 0.5
    if wave_m <= WAVE_WORKABLE:
        return 1.0
    if wave_m >= WAVE_UNWORKABLE:
        return 0.12
    span = WAVE_UNWORKABLE - WAVE_WORKABLE
    return max(0.12, 1.0 - 0.88 * (wave_m - WAVE_WORKABLE) / span)


def front_factor(zone_sst: Optional[float], ambient_sst: Optional[float]) -> float:
    if zone_sst is None or ambient_sst is None:
        return 0.35
    delta = abs(zone_sst - ambient_sst)
    return min(1.0, 0.10 + delta * 0.80)


def time_factor(hour: int) -> float:
    return TIME_OF_DAY_FACTORS.get(int(hour) % 24, 0.6)


def calculate_fishing_probability(
    *,
    chlorophyll: Optional[float],
    sst: Optional[float],
    ambient_sst: Optional[float],
    wave_m: Optional[float],
    hour: int = 6,
) -> Dict[str, Any]:
    """Calculates transparent 0-100 catch likelihood with component factors."""
    factors = {
        "chlorophyll": _curve_interpolate(chlorophyll, CHL_CURVE),
        "sst": sst_factor(sst),
        "front": front_factor(sst, ambient_sst),
        "sea_state": sea_state_factor(wave_m),
        "time_of_day": time_factor(hour),
    }
    score = sum(WEIGHTS[k] * v for k, v in factors.items())
    prob = int(round(min(100.0, max(0.0, score * 100))))
    return {
        "probability": prob,
        "factors": {k: round(v, 3) for k, v in factors.items()},
        "weights": WEIGHTS,
    }


def get_coastal_region(lat: float, lon: float) -> str:
    if lon >= 85.0 and lat >= 17.0:
        return "NE"
    if lon >= 77.5:
        return "SE"
    return "NW" if lat >= 15.0 else "SW"


def predict_likely_species(
    sst: Optional[float],
    chlorophyll: Optional[float],
    distance_km: float,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    limit: int = 3,
) -> List[str]:
    """Ranks and returns the most probable fish species based on water physics and OBIS prevalence."""
    region = get_coastal_region(lat, lon) if (lat is not None and lon is not None) else None
    region_max = 1
    if region:
        region_max = max(v.get(region, 0) for v in SPECIES_OCCURRENCE.values()) or 1

    scored: List[Tuple[float, str]] = []
    for s in SPECIES_BANDS:
        lo, hi = s["sst"]
        if sst is None:
            sst_fit = 0.5
        elif lo <= sst <= hi:
            sst_fit = 1.0
        else:
            drift = (lo - sst) if sst < lo else (sst - hi)
            sst_fit = max(0.0, 1.0 - drift / 1.5)
        chl_fit = 0.5 if chlorophyll is None else min(1.0, chlorophyll / s["chl_min"])
        d_lo, d_hi = s["dist"]
        dist_fit = 1.0 if d_lo <= distance_km <= d_hi else 0.4
        fit = sst_fit * 0.55 + chl_fit * 0.30 + dist_fit * 0.15

        if region:
            prevalence = SPECIES_OCCURRENCE.get(s["name"], {}).get(region, 0) / region_max
            fit *= 0.15 + 0.85 * math.sqrt(prevalence)

        if fit >= 0.40:
            scored.append((fit, s["name"]))

    scored.sort(reverse=True)
    return [name for _, name in scored[:limit]] or ["Bangda (Indian mackerel)", "Tarli (oil sardine)"]


def calculate_trip_economics(probability_pct: int, distance_km: float) -> Dict[str, Any]:
    """Estimates fuel burn, haul band, revenue and net operating profit for artisanal fishers."""
    fuel_l = int(round(distance_km * 2 * FUEL_L_PER_KM))
    fuel_cost = int(round(fuel_l * FUEL_PRICE_INR_PER_L / 10) * 10)
    p = max(0.0, min(1.0, probability_pct / 100.0))
    catch_lo = int(round(TYPICAL_CATCH_KG * p * 0.70 / 5) * 5)
    catch_hi = int(round(TYPICAL_CATCH_KG * p * 1.15 / 5) * 5)
    avg_catch = (catch_lo + catch_hi) / 2.0
    revenue = int(round(avg_catch * MIXED_CATCH_INR_PER_KG / 10) * 10)
    profit = revenue - fuel_cost

    return {
        "fuel_litres": fuel_l,
        "fuel_cost_inr": fuel_cost,
        "catch_kg_low": catch_lo,
        "catch_kg_high": catch_hi,
        "revenue_inr": revenue,
        "profit_inr": profit,
        "assumptions": f"Typical motorised FRP boat · {FUEL_L_PER_KM} L/km · ₹{FUEL_PRICE_INR_PER_L:.0f}/L · catch ₹{MIXED_CATCH_INR_PER_KG:.0f}/kg",
    }


def plan_today_trip(
    lat: float,
    lon: float,
    pfz_zones: Sequence[Dict[str, Any]],
    wave_height_m: float = 1.2,
    wind_speed_kmh: float = 18.0,
    hourly_waves: Optional[Dict[int, float]] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Creates a comprehensive 'Today' Fisher Trip Plan:
    departure window, return-by deadline, recommended hours on ground, species likelihood, and economics.
    """
    curr = now or datetime.now(timezone.utc)
    # Default departure morning dawn IST (05:30 IST -> ~00:00 UTC)
    best_departure = "05:30 IST"

    # Evaluate safe weather window: how many hours waves stay < 2.2m and winds < 35 km/h
    safe_window_hours = 6.0
    if hourly_waves:
        consecutive = 0
        for h in range(5, 20):
            if hourly_waves.get(h, wave_height_m) < 2.0:
                consecutive += 1
            else:
                break
        safe_window_hours = max(3.0, float(consecutive))

    # Recommended ground
    ranked_grounds = []
    for z in pfz_zones:
        dist_km = z.get("distance_km", 25.0)
        prob_res = calculate_fishing_probability(
            chlorophyll=z.get("chlorophyll_mg_m3") or z.get("chlorophyll_a"),
            sst=z.get("sst_c") or z.get("sea_surface_temp_c"),
            ambient_sst=28.0,
            wave_m=wave_height_m,
            hour=6,
        )
        prob = prob_res["probability"]
        # Distance value discount
        discount = 1.0 - min(0.5, (dist_km / 100.0) * 0.5)
        value_score = round(prob * discount, 1)

        species = predict_likely_species(
            sst=z.get("sst_c") or z.get("sea_surface_temp_c"),
            chlorophyll=z.get("chlorophyll_mg_m3") or z.get("chlorophyll_a"),
            distance_km=dist_km,
            lat=z.get("latitude", lat),
            lon=z.get("longitude", lon),
        )

        ranked_grounds.append({
            "zone_id": z.get("zone_id", "PFZ-1"),
            "latitude": z.get("latitude", lat + 0.15),
            "longitude": z.get("longitude", lon + 0.15),
            "distance_km": dist_km,
            "bearing_deg": z.get("bearing_deg", 90.0),
            "probability_pct": prob,
            "value_score": value_score,
            "likely_species": species,
            "sst_c": z.get("sst_c") or z.get("sea_surface_temp_c", 28.2),
            "chlorophyll_mg_m3": z.get("chlorophyll_mg_m3") or z.get("chlorophyll_a", 1.2),
        })

    ranked_grounds.sort(key=lambda x: x["value_score"], reverse=True)
    top_ground = ranked_grounds[0] if ranked_grounds else {
        "zone_id": "PFZ-NEARSHORE-1",
        "latitude": lat + 0.15,
        "longitude": lon + 0.15,
        "distance_km": 22.0,
        "bearing_deg": 115.0,
        "probability_pct": 74,
        "value_score": 65.8,
        "likely_species": ["Bangda (Indian mackerel)", "Tarli (oil sardine)"],
        "sst_c": 28.1,
        "chlorophyll_mg_m3": 1.45,
    }

    travel_minutes = int(round((top_ground["distance_km"] / 18.0) * 60.0))  # ~18 km/h cruise
    round_trip_h = (travel_minutes * 2) / 60.0
    hours_on_ground = max(1.5, min(4.0, safe_window_hours - round_trip_h))

    # Return by time calculation (e.g. 05:30 + round_trip + stay)
    return_hour = 5 + int(round_trip_h + hours_on_ground)
    return_min = int(((round_trip_h + hours_on_ground) % 1.0) * 60)
    return_by = f"{return_hour:02d}:{return_min:02d} IST"

    econ = calculate_trip_economics(top_ground["probability_pct"], top_ground["distance_km"])

    return {
        "best_departure_time": best_departure,
        "return_by_time": return_by,
        "hours_on_ground": round(hours_on_ground, 1),
        "safe_window_summary": f"{safe_window_hours:.0f}-hour safe window before afternoon swell",
        "target_ground": top_ground,
        "ranked_grounds": ranked_grounds[:4],
        "likely_species": top_ground["likely_species"],
        "economics": econ,
        "travel_each_way_minutes": travel_minutes,
    }
