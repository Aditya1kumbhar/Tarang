"""
Data-Sufficiency Safety Gate and Telemetry Health Engine for ORCA.

Guarantees that no false green light or ungrounded "GO" decision reaches a fisher
when critical sensor data is missing, expired, or corrupted.

States:
  - GO: All critical telemetry fresh, risk is low/moderate -> normal confidence.
  - CAUTION: Critical telemetry is stale but within max age -> degraded confidence.
  - INSUFFICIENT_DATA: Critical telemetry is missing, dead, or expired -> score suppressed.
  - NO_GO: High/extreme sea conditions or active official warning -> trip suspended.

Drill Simulator:
  - healthy: All feeds reporting fresh telemetry (GO).
  - stale: Wave sensor reports 4-hour-old data (CAUTION).
  - unavailable: Wave sensor offline / dead (INSUFFICIENT_DATA).
  - recovery: Reconnected feed restores live telemetry (GO).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence


# Default freshness limits (in seconds)
FRESHNESS_LIMITS: Dict[str, Dict[str, Optional[int]]] = {
    "wave": {"fresh_s": 3 * 3600, "max_age_s": 6 * 3600, "critical": True, "feed": "marine"},
    "wind": {"fresh_s": 3 * 3600, "max_age_s": 6 * 3600, "critical": True, "feed": "weather"},
    "cyclone": {"fresh_s": 6 * 3600, "max_age_s": 12 * 3600, "critical": True, "feed": "alerts"},
    "gis": {"fresh_s": None, "max_age_s": None, "critical": True, "feed": "gis"},  # Static geofences
    "sst": {"fresh_s": 24 * 3600, "max_age_s": 48 * 3600, "critical": False, "feed": "satellite"},
    "chlorophyll": {"fresh_s": 24 * 3600, "max_age_s": 48 * 3600, "critical": False, "feed": "satellite"},
}

# Runtime drill state (allows judges and testers to switch modes without restarting)
_ACTIVE_DRILL: str = "healthy"


def get_active_drill() -> str:
    return _ACTIVE_DRILL


def set_active_drill(drill: str) -> str:
    global _ACTIVE_DRILL
    valid = {"healthy", "stale", "unavailable", "recovery"}
    clean = (drill or "").strip().lower()
    if clean not in valid:
        raise ValueError(f"Invalid drill '{drill}'. Must be one of {valid}")
    _ACTIVE_DRILL = clean
    return _ACTIVE_DRILL


def format_age_text(seconds: int) -> str:
    """Format duration into readable 'X h Y min' string."""
    mins = max(0, int(seconds) // 60)
    hours = mins // 60
    rem_m = mins % 60
    if hours > 0:
        return f"{hours}h {rem_m}m" if rem_m > 0 else f"{hours}h"
    return f"{rem_m}m"


def check_input_health(
    input_key: str,
    observed_at: Optional[datetime],
    now: Optional[datetime] = None,
    source: str = "Live Open-Meteo / NOAA",
    is_available: bool = True,
    override_age_s: Optional[int] = None,
) -> Dict[str, Any]:
    """Evaluates telemetry health for a single input."""
    policy = FRESHNESS_LIMITS.get(input_key, {"fresh_s": 3600, "max_age_s": 7200, "critical": False, "feed": "generic"})
    limit = policy["fresh_s"]
    max_age = policy["max_age_s"]
    critical = bool(policy.get("critical", False))

    if not is_available:
        return {
            "input": input_key,
            "label": input_key.replace("_", " ").title(),
            "source": source,
            "feed": policy["feed"],
            "status": "MISSING",
            "age_seconds": None,
            "freshness_limit_seconds": limit,
            "max_age_seconds": max_age,
            "usable": False,
            "critical": critical,
            "detail": f"Sensor feed for {input_key} is offline or unavailable",
            "available": False,
            "observed_at": None,
        }

    if limit is None:
        # Static baseline (e.g. GIS boundaries)
        return {
            "input": input_key,
            "label": input_key.replace("_", " ").title(),
            "source": source,
            "feed": policy["feed"],
            "status": "FRESH",
            "age_seconds": 0,
            "freshness_limit_seconds": None,
            "max_age_seconds": None,
            "usable": True,
            "critical": critical,
            "detail": "Verified static geographic layer",
            "available": True,
            "observed_at": (observed_at or datetime.now(timezone.utc)).isoformat(),
        }

    current_time = now or datetime.now(timezone.utc)
    if override_age_s is not None:
        age_s = override_age_s
    elif observed_at is not None:
        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=timezone.utc)
        age_s = max(0, int((current_time - observed_at).total_seconds()))
    else:
        # No timestamp given
        return {
            "input": input_key,
            "label": input_key.replace("_", " ").title(),
            "source": source,
            "feed": policy["feed"],
            "status": "STALE",
            "age_seconds": None,
            "freshness_limit_seconds": limit,
            "max_age_seconds": max_age,
            "usable": False,
            "critical": critical,
            "detail": f"No observation timestamp provided for {input_key}",
            "available": True,
            "observed_at": None,
        }

    age_str = format_age_text(age_s)
    limit_str = format_age_text(limit)

    if age_s <= limit:
        status = "FRESH"
        usable = True
        detail = f"Fresh observation ({age_str} old <= {limit_str} limit)"
    elif max_age is None or age_s <= max_age:
        status = "STALE"
        usable = True
        detail = f"Stale observation ({age_str} old > {limit_str} limit, still usable)"
    else:
        status = "STALE"
        usable = False
        detail = f"Telemetry expired ({age_str} old > max limit {format_age_text(max_age)})"

    return {
        "input": input_key,
        "label": input_key.replace("_", " ").title(),
        "source": source,
        "feed": policy["feed"],
        "status": status,
        "age_seconds": age_s,
        "freshness_limit_seconds": limit,
        "max_age_seconds": max_age,
        "usable": usable,
        "critical": critical,
        "detail": detail,
        "available": True,
        "observed_at": (observed_at or current_time).isoformat(),
    }


def evaluate_safety_gate(
    risk_assessment: Optional[Dict[str, Any]],
    health_records: Sequence[Dict[str, Any]],
    drill_override: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Evaluates the final Safety Gate decision based on risk and data freshness.
    Applies drill simulations if active.
    """
    drill = drill_override or _ACTIVE_DRILL
    current_time = now or datetime.now(timezone.utc)

    # Apply Drill Simulations on inputs if requested
    records = [dict(r) for r in health_records]
    if drill == "stale":
        # Simulate wave sensor reporting 4h old data
        for r in records:
            if r["input"] == "wave":
                r["status"] = "STALE"
                r["usable"] = True
                r["age_seconds"] = 4 * 3600
                r["detail"] = "Simulated stale wave telemetry (4h old)"
    elif drill == "unavailable":
        # Simulate wave sensor offline / expired
        for r in records:
            if r["input"] == "wave":
                r["status"] = "MISSING"
                r["usable"] = False
                r["available"] = False
                r["age_seconds"] = 8 * 3600
                r["detail"] = "Simulated sensor failure (telemetry unavailable)"
    elif drill == "recovery":
        for r in records:
            if r["input"] == "wave":
                r["status"] = "FRESH"
                r["usable"] = True
                r["available"] = True
                r["age_seconds"] = 900
                r["detail"] = "Wave feed reconnected and verified fresh (15m old)"

    by_input = {r["input"]: r for r in records}
    critical_keys = [k for k, p in FRESHNESS_LIMITS.items() if p.get("critical")]

    blocking_inputs = [k for k in critical_keys if k not in by_input or not by_input[k].get("usable", False)]
    stale_inputs = [k for k in critical_keys if k in by_input and by_input[k].get("usable") and by_input[k].get("status") == "STALE"]

    risk_go = risk_assessment.get("go", False) if risk_assessment else False

    # The Decision Hierarchy
    if risk_assessment is None:
        state = "INSUFFICIENT_DATA"
        confidence = "insufficient"
        headline = "Insufficient Data: Ocean Risk Undetermined"
    elif not risk_go:
        state = "NO_GO"
        confidence = "degraded" if stale_inputs else "normal"
        headline = "NO-GO: Dangerous Sea State / Severe Maritime Bulletin"
    elif blocking_inputs:
        state = "INSUFFICIENT_DATA"
        confidence = "insufficient"
        headline = "Insufficient Data: Critical Sensors Unavailable (Score Suppressed)"
    elif stale_inputs:
        state = "CAUTION"
        confidence = "degraded"
        headline = "CAUTION: Degraded Confidence Due to Aging Telemetry"
    else:
        state = "GO"
        confidence = "normal"
        headline = "GO: Conditions Favorable and All Critical Feeds Fresh"

    reasons: List[str] = []
    if blocking_inputs:
        reasons.append(f"Critical inputs unavailable or expired: {', '.join(blocking_inputs)}. Defer to official IMD/INCOIS VHF broadcast.")
    if stale_inputs:
        reasons.append(f"Telemetry aging on: {', '.join(stale_inputs)}. Maintain heightened coastal vigilance.")
    if drill == "recovery":
        reasons.append("Sensor telemetry successfully reconnected and verified fresh.")
    if state == "GO":
        reasons.append("All critical marine, meteorological, and GIS safety constraints satisfied.")

    return {
        "state": state,
        "confidence": confidence,
        "headline": headline,
        "reasons": reasons,
        "blocking_inputs": blocking_inputs,
        "stale_inputs": stale_inputs,
        "risk_go": risk_go,
        "drill": drill,
        "timestamp": current_time.isoformat(),
        "health_records": records,
    }
