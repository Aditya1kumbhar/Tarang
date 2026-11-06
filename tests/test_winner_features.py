"""
Unit and Integration Test Suite for ORCA SIH 2026 Winner Features.
Verifies:
1. Piecewise-linear hazard curves and deterministic safety floors (Layer 1, 2, 3).
2. Data-sufficiency safety gate and 4 interactive test drills (healthy, stale, unavailable, recovery).
3. "Today" trip planner, species likelihood prediction, and artisanal economics.
4. New REST endpoints (/api/v1/fishing, /api/v1/risk/timeline, /api/v1/field, /api/v1/config/data-health).
"""

from datetime import datetime, timedelta, timezone
import pytest
from starlette.testclient import TestClient

from backend.auth import create_session_token
from backend.main import app
from backend.tools.fishing_planner_tool import (
    calculate_fishing_probability,
    calculate_trip_economics,
    plan_today_trip,
    predict_likely_species,
)
from backend.tools.risk_curves import (
    FISHERMEN_WARNING_FLOOR,
    RESTRICTED_ZONE_FLOOR,
    SEVERE_WARNING_FLOOR,
    WAVE_DANGER_FLOOR,
    WIND_DANGER_FLOOR,
    evaluate_risk_factors,
    wave_factor,
    wind_factor,
)
from backend.tools.safety_gate_tool import (
    check_input_health,
    evaluate_safety_gate,
    get_active_drill,
    set_active_drill,
)


# --- 1. Deterministic Risk Engine & Breakpoint Curves ---

def test_risk_curves_wave_and_wind():
    assert wave_factor(0.0) == 0.0
    assert wave_factor(1.0) == 0.25
    assert wave_factor(4.0) == 1.0
    assert wave_factor(5.0) == 1.0  # Clamped

    assert wind_factor(0.0) == 0.0
    assert wind_factor(10.0) == 0.10
    assert wind_factor(62.0) == 1.0


def test_evaluate_risk_factors_benign():
    res = evaluate_risk_factors(
        wave_height_m=0.8,
        wind_speed_kmh=12.0,
        rain_probability_pct=10.0,
        lightning=False,
        current_speed_ms=0.2,
        distance_shore_km=15.0,
        inside_zone=False,
    )
    assert res["score"] <= 35
    assert res["category"] in ("LOW", "MODERATE")
    assert res["go"] is True
    assert len(res["overrides"]) == 0
    assert len(res["factors"]) == 6


def test_evaluate_risk_factors_safety_floors():
    # 1. Wave danger floor (>= 4.0m)
    res_wave = evaluate_risk_factors(wave_height_m=4.2, wind_speed_kmh=10.0)
    assert res_wave["score"] >= WAVE_DANGER_FLOOR
    assert any("Dangerous wave height" in r for r in res_wave["overrides"])

    # 2. Wind danger floor (>= 62 km/h)
    res_wind = evaluate_risk_factors(wave_height_m=1.0, wind_speed_kmh=65.0)
    assert res_wind["score"] >= WIND_DANGER_FLOOR
    assert any("Gale-force surface winds" in r for r in res_wind["overrides"])

    # 3. Severe alert floor
    alerts = [{"severity": "severe", "headline": "Very Severe Cyclonic Storm", "source": "IMD"}]
    res_cyc = evaluate_risk_factors(alerts=alerts, wave_height_m=1.0, wind_speed_kmh=10.0)
    assert res_cyc["score"] >= SEVERE_WARNING_FLOOR
    assert any("severe weather/cyclone bulletin" in r for r in res_cyc["overrides"])

    # 4. Restricted zone floor
    res_zone = evaluate_risk_factors(wave_height_m=1.0, wind_speed_kmh=10.0, inside_zone=True)
    assert res_zone["score"] >= RESTRICTED_ZONE_FLOOR
    assert any("restricted zone" in r for r in res_zone["overrides"])


# --- 2. Data-Sufficiency Safety Gate & Drill Simulator ---

def test_data_health_freshness_checking():
    now = datetime.now(timezone.utc)
    fresh_time = now - timedelta(minutes=30)
    stale_time = now - timedelta(hours=4)
    expired_time = now - timedelta(hours=8)

    # Fresh
    h_fresh = check_input_health("wave", fresh_time, now=now)
    assert h_fresh["status"] == "FRESH"
    assert h_fresh["usable"] is True

    # Stale (within max age 6h)
    h_stale = check_input_health("wave", stale_time, now=now)
    assert h_stale["status"] == "STALE"
    assert h_stale["usable"] is True

    # Expired (older than max age 6h)
    h_expired = check_input_health("wave", expired_time, now=now)
    assert h_expired["status"] == "STALE"
    assert h_expired["usable"] is False


def test_safety_gate_decisions_and_drills():
    rf_benign = {"score": 20, "category": "LOW", "go": True}
    now = datetime.now(timezone.utc)

    # Normal healthy
    records_healthy = [
        check_input_health("wave", now - timedelta(minutes=15), now=now),
        check_input_health("wind", now - timedelta(minutes=15), now=now),
        check_input_health("cyclone", now - timedelta(hours=1), now=now),
        check_input_health("gis", None, now=now),
    ]
    gate_healthy = evaluate_safety_gate(rf_benign, records_healthy, drill_override="healthy")
    assert gate_healthy["state"] == "GO"
    assert gate_healthy["confidence"] == "normal"

    # Stale drill
    gate_stale = evaluate_safety_gate(rf_benign, records_healthy, drill_override="stale")
    assert gate_stale["state"] == "CAUTION"
    assert gate_stale["confidence"] == "degraded"
    assert "wave" in gate_stale["stale_inputs"]

    # Unavailable drill (suppresses score)
    gate_unavail = evaluate_safety_gate(rf_benign, records_healthy, drill_override="unavailable")
    assert gate_unavail["state"] == "INSUFFICIENT_DATA"
    assert gate_unavail["confidence"] == "insufficient"
    assert "wave" in gate_unavail["blocking_inputs"]

    # Recovery drill
    gate_rec = evaluate_safety_gate(rf_benign, records_healthy, drill_override="recovery")
    assert gate_rec["state"] == "GO"
    assert gate_rec["confidence"] == "normal"


# --- 3. "Today" Trip Planner, Species Prediction & Economics ---

def test_fishing_probability_and_species_prediction():
    res = calculate_fishing_probability(
        chlorophyll=1.5,
        sst=28.0,
        ambient_sst=27.5,
        wave_m=1.0,
        hour=6,
    )
    assert 60 <= res["probability"] <= 95
    assert "chlorophyll" in res["factors"]
    assert "time_of_day" in res["factors"]

    species = predict_likely_species(
        sst=28.0,
        chlorophyll=1.5,
        distance_km=25.0,
        lat=9.28,
        lon=79.31,
    )
    assert len(species) > 0
    assert any("Bangda" in s or "Tarli" in s for s in species)


def test_trip_economics_and_planning():
    econ = calculate_trip_economics(probability_pct=75, distance_km=25.0)
    assert econ["fuel_litres"] > 0
    assert econ["fuel_cost_inr"] > 0
    assert econ["revenue_inr"] > econ["fuel_cost_inr"]
    assert econ["profit_inr"] > 0

    plan = plan_today_trip(
        lat=9.28,
        lon=79.31,
        pfz_zones=[
            {"zone_id": "PFZ-1", "latitude": 9.35, "longitude": 79.45, "distance_km": 20.0, "sst_c": 28.2, "chlorophyll_mg_m3": 1.4}
        ],
        wave_height_m=1.1,
    )
    assert plan["best_departure_time"] == "05:30 IST"
    assert "IST" in plan["return_by_time"]
    assert plan["hours_on_ground"] >= 1.5
    assert len(plan["likely_species"]) > 0


# --- 4. API Endpoints Integration Verification ---

TEST_USER_DICT = {
    "email": "test.officer@nic.in",
    "name": "Test Maritime Officer",
    "sub": "test_officer_001",
}
TEST_TOKEN = create_session_token(TEST_USER_DICT)

@pytest.fixture
def auth_client():
    return TestClient(
        app,
        cookies={"orca_session": TEST_TOKEN},
        headers={"Authorization": f"Bearer {TEST_TOKEN}"},
    )


def test_api_fishing_endpoint(auth_client):
    resp = auth_client.get("/api/v1/fishing?harbour_id=rameswaram&radius_km=50")
    assert resp.status_code == 200
    data = resp.json()
    assert data["harbour_id"] == "rameswaram"
    assert "risk" in data
    assert "safety_gate" in data
    assert "trip_plan" in data
    assert data["trip_plan"]["best_departure_time"] == "05:30 IST"
    assert len(data["trip_plan"]["ranked_grounds"]) > 0


def test_api_risk_timeline_endpoint(auth_client):
    resp = auth_client.get("/api/v1/risk/timeline?harbour_id=mumbai&hours=24")
    assert resp.status_code == 200
    data = resp.json()
    assert data["harbour_id"] == "mumbai"
    assert len(data["points"]) == 24
    p0 = data["points"][0]
    assert "hour" in p0
    assert "score" in p0
    assert "category" in p0
    assert "wave_height_m" in p0


def test_api_field_vector_endpoint(auth_client):
    resp = auth_client.get("/api/v1/field?min_lat=8.0&max_lat=12.0&min_lon=76.0&max_lon=80.0&nx=5&ny=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["nx"] == 5
    assert data["ny"] == 5
    assert len(data["points"]) == 25
    pt = data["points"][0]
    assert "u_wind_kmh" in pt
    assert "u_current_ms" in pt


def test_api_data_health_config_endpoint(auth_client):
    # 1. Get current drill
    resp_get = auth_client.get("/api/v1/config/data-health")
    assert resp_get.status_code == 200
    assert "active_drill" in resp_get.json()

    # 2. Set drill to stale
    resp_post = auth_client.post("/api/v1/config/data-health?drill=stale")
    assert resp_post.status_code == 200
    assert resp_post.json()["active_drill"] == "stale"
    assert get_active_drill() == "stale"

    # 3. Verify /api/v1/fishing reflects stale drill
    resp_fish = auth_client.get("/api/v1/fishing?harbour_id=rameswaram")
    assert resp_fish.status_code == 200
    assert resp_fish.json()["safety_gate"]["state"] == "CAUTION"

    # 4. Reset drill to healthy
    resp_reset = auth_client.post("/api/v1/config/data-health?drill=healthy")
    assert resp_reset.status_code == 200
    assert get_active_drill() == "healthy"


def test_dashboard_summary_includes_winner_extensions(auth_client):
    resp = auth_client.get("/api/v1/dashboard-summary?harbour_id=kochi")
    assert resp.status_code == 200
    data = resp.json()
    assert "risk_factors" in data and data["risk_factors"] is not None
    assert "safety_gate" in data and data["safety_gate"] is not None
    assert "trip_plan" in data and data["trip_plan"] is not None
    assert len(data["risk_factors"]) == 6
    assert data["safety_gate"]["state"] in ("GO", "CAUTION", "INSUFFICIENT_DATA", "NO_GO")
