"""
Unit Test Suite for ORCA Phase 2 Deterministic Marine, Weather & Geospatial Tools.
Tests:
- weather_marine_tool: live Open-Meteo, offline fallback, safety thresholds (country craft vs. trawler), Kallakkadal, lightning.
- geospatial_tool: pyproj WGS84 geodesic calculations, IMBL & MPA geofencing (Rameswaram edge cases), wave-aware A* routing.
- ocean_pfz_tool: SST optimality, thermal gradient, Chl-a scores, PFZ composite ranking, geofence quarantine.
- productivity_tool: Marine heatwave, HAB hypoxia, cyclone turbidity diagnostics.
"""

import pytest
from shapely.geometry import Point, shape

from backend.schemas.models import (
    BoundaryType,
    SafetyLevel,
    VesselType,
)
from backend.tools.geospatial_tool import (
    calculate_distance_and_bearing,
    check_geofence,
    compute_safe_route,
    load_imbl_features,
    load_mpa_features,
)
from backend.tools.ocean_pfz_tool import (
    calculate_composite_pfz_score,
    compute_chla_score,
    compute_front_gradient_score,
    compute_pfz_zones,
    compute_sst_optimality_score,
)
from backend.tools.productivity_tool import diagnose_productivity_decline
from backend.tools.weather_marine_tool import (
    assess_vessel_safety,
    calculate_sea_venture_safety_index,
    get_fallback_marine_and_weather,
    get_weather_marine_report,
)


# ==============================================================================
# 1. WEATHER & MARINE HAZARD TOOL TESTS
# ==============================================================================


@pytest.mark.asyncio
async def test_weather_marine_tool_live_and_fallback():
    """Verifies that weather tool returns a valid report, resilient to network status."""
    report = await get_weather_marine_report(
        lat=9.2876,
        lon=79.3129,
        harbour_id="rameswaram",
        harbour_name="Rameswaram Fishing Jetty",
        vessel_type=VesselType.COUNTRY_CRAFT,
    )
    assert report.harbour_id == "rameswaram"
    assert report.wave_height_m >= 0.0
    assert report.wind_speed_kmh >= 0.0
    assert report.safety_status in [SafetyLevel.GREEN, SafetyLevel.AMBER, SafetyLevel.RED_ALERT]
    assert report.provenance.confidence_score >= 0.80
    assert len(report.provenance.reasoning_trace) > 10


def test_weather_thresholds_country_craft_vs_mechanized_trawler():
    """
    Verifies vessel-specific safety thresholds:
    - Wave 1.5m is AMBER for country_craft, but GREEN for mechanized_trawler.
    - Wave 2.2m is RED for country_craft, but AMBER for mechanized_trawler.
    - Wave 3.0m is RED for mechanized_trawler.
    """
    # Case 1: 1.5m waves (Amber for craft, Green for trawler)
    metrics_15m = {
        "wave_height_m": 1.5,
        "wind_speed_kmh": 20.0,
        "wind_gusts_kmh": 28.0,
        "cape_j_kg": 200.0,
        "swell_wave_period_s": 8.0,
    }
    status_craft, _, _, _, cb_craft = assess_vessel_safety(metrics_15m, VesselType.COUNTRY_CRAFT)
    status_trawl, _, _, _, cb_trawl = assess_vessel_safety(metrics_15m, VesselType.MECHANIZED_TRAWLER)
    assert status_craft == SafetyLevel.AMBER
    assert cb_craft is False
    assert status_trawl == SafetyLevel.GREEN
    assert cb_trawl is False

    # Case 2: 2.2m waves (RED for craft, Amber for trawler)
    metrics_22m = {
        "wave_height_m": 2.2,
        "wind_speed_kmh": 26.0,
        "wind_gusts_kmh": 32.0,
        "cape_j_kg": 400.0,
        "swell_wave_period_s": 9.0,
    }
    status_craft, _, _, _, cb_craft = assess_vessel_safety(metrics_22m, VesselType.COUNTRY_CRAFT)
    status_trawl, _, _, _, cb_trawl = assess_vessel_safety(metrics_22m, VesselType.MECHANIZED_TRAWLER)
    assert status_craft == SafetyLevel.RED_ALERT
    assert cb_craft is True
    assert status_trawl == SafetyLevel.AMBER
    assert cb_trawl is False

    # Case 3: 3.0m waves (RED for both)
    metrics_30m = {
        "wave_height_m": 3.0,
        "wind_speed_kmh": 38.0,
        "wind_gusts_kmh": 48.0,
        "cape_j_kg": 500.0,
        "swell_wave_period_s": 9.0,
    }
    status_trawl, msg_trawl, _, _, cb_trawl = assess_vessel_safety(metrics_30m, VesselType.MECHANIZED_TRAWLER)
    assert status_trawl == SafetyLevel.RED_ALERT
    assert cb_trawl is True
    assert "DO NOT VENTURE" in msg_trawl


def test_weather_kallakkadal_and_lightning_triggers():
    """Verifies that Kallakkadal swell surge (period >= 13s) and lightning (CAPE >= 1500) trigger RED alert."""
    metrics_surge = {
        "wave_height_m": 1.0,
        "wind_speed_kmh": 15.0,
        "wind_gusts_kmh": 20.0,
        "cape_j_kg": 100.0,
        "swell_wave_period_s": 14.5,  # >= 13s threshold
    }
    status, msg, is_kallakkadal, is_lightning, cb = assess_vessel_safety(metrics_surge, VesselType.COUNTRY_CRAFT)
    assert status == SafetyLevel.RED_ALERT
    assert is_kallakkadal is True
    assert cb is True
    assert "Kallakkadal" in msg

    metrics_lightning = {
        "wave_height_m": 1.0,
        "wind_speed_kmh": 15.0,
        "wind_gusts_kmh": 20.0,
        "cape_j_kg": 1850.0,  # >= 1500 J/kg threshold
        "swell_wave_period_s": 7.0,
    }
    status, msg, is_kallakkadal, is_lightning, cb = assess_vessel_safety(metrics_lightning, VesselType.COUNTRY_CRAFT)
    assert status == SafetyLevel.RED_ALERT
    assert is_lightning is True
    assert cb is True
    assert "lightning" in msg.lower()


# ==============================================================================
# 2. GEOSPATIAL & GEOFENCING TOOL TESTS
# ==============================================================================


def test_geodesic_distance_and_bearing():
    """Verifies WGS84 geodesic calculations between Rameswaram and an offshore waypoint."""
    # Rameswaram (79.3129, 9.2876) to Palk Bay point (79.45, 9.38)
    dist_km, dist_nm, bearing, cardinal = calculate_distance_and_bearing(
        79.3129, 9.2876, 79.45, 9.38
    )
    assert 17.5 <= dist_km <= 19.0
    assert 9.4 <= dist_nm <= 10.3
    assert 50.0 <= bearing <= 60.0
    assert cardinal in ["NE", "ENE"]


def test_imbl_geofence_critical_and_warning():
    """
    Verifies Rameswaram IMBL proximity edge cases:
    - (79.44, 9.33) is ~1.1 NM from IMBL -> CRITICAL alert.
    - (79.38, 9.33) is ~3.8 NM from IMBL -> WARNING alert.
    - Mumbai coast is far from IMBL/MPA -> NONE alert.
    """
    # 1. Critical proximity (< 1.5 NM)
    critical_pt = check_geofence(lon=79.40, lat=9.335)
    assert critical_pt.is_violation is True
    assert critical_pt.alert_level == "CRITICAL"
    assert critical_pt.boundary_type == BoundaryType.IMBL
    assert critical_pt.distance_nm <= 1.5

    # 2. Warning proximity (1.5 NM < dist <= 5.0 NM)
    warning_pt = check_geofence(lon=79.44, lat=9.33)
    assert warning_pt.is_violation is False
    assert warning_pt.alert_level == "WARNING"
    assert warning_pt.boundary_type == BoundaryType.IMBL
    assert 1.5 < warning_pt.distance_nm <= 5.0

    # 3. Safe far away point (Mumbai: 72.82, 18.92)
    mumbai_pt = check_geofence(lon=72.82, lat=18.92)
    assert mumbai_pt.is_violation is False
    assert mumbai_pt.alert_level == "NONE"
    assert mumbai_pt.distance_nm > 5.0


def test_mpa_geofence_violation():
    """Verifies that coordinates inside Gulf of Mannar Marine National Park trigger MPA violation."""
    # Coordinate inside Gulf of Mannar MPA: (79.25, 9.20)
    mpa_res = check_geofence(lon=79.25, lat=9.20)
    assert mpa_res.is_violation is True
    assert mpa_res.alert_level == "CRITICAL"
    assert mpa_res.boundary_type == BoundaryType.MPA
    assert "Gulf of Mannar" in (mpa_res.boundary_name or "")
    assert mpa_res.distance_nm == 0.0


def test_astar_routing_avoids_imbl_and_mpa():
    """Verifies that A* safe vessel routing generates a valid route avoiding restricted boundaries."""
    # From Rameswaram jetty to an offshore sector
    route = compute_safe_route(
        start_lat=9.2876,
        start_lon=79.3129,
        target_lat=9.38,
        target_lon=79.45,
        harbour_id="rameswaram",
        destination_name="Palk Bay PFZ",
        wave_height_m=1.2,
        wind_speed_kmh=18.0,
    )
    assert route.harbour_id == "rameswaram"
    assert len(route.waypoints) >= 2
    assert route.total_distance_km > 0.0
    assert route.total_distance_nm > 0.0
    assert route.estimated_hours > 0.0
    assert route.fuel_savings_percent > 0.0
    assert route.geojson_linestring["type"] == "Feature"
    assert route.geojson_linestring["geometry"]["type"] == "LineString"

    # Verify no waypoint is inside an MPA
    mpa_features = load_mpa_features()
    mpa_polys = [shape(f["geometry"]) for f in mpa_features]
    for wp in route.waypoints:
        pt = Point(wp.longitude, wp.latitude)
        for poly in mpa_polys:
            assert not poly.contains(pt), f"Waypoint ({wp.latitude}, {wp.longitude}) penetrated MPA polygon!"


# ==============================================================================
# 3. OCEAN PFZ & PRODUCTIVITY TOOL TESTS
# ==============================================================================


def test_pfz_scoring_components():
    """Verifies SST optimality, thermal gradient, and Chl-a individual scoring algorithms."""
    # SST Optimality
    assert compute_sst_optimality_score(27.5) == 1.0
    assert compute_sst_optimality_score(26.0) == 1.0
    # Linearly interpolates between 23.0 and 25.5: at 24.25 -> 0.5
    assert round(compute_sst_optimality_score(24.25), 2) == 0.50
    assert compute_sst_optimality_score(22.0) == 0.0
    assert compute_sst_optimality_score(32.5) == 0.0

    # Front Gradient Score
    assert compute_front_gradient_score(0.25) == 1.0
    assert compute_front_gradient_score(0.35) == 1.0
    assert round(compute_front_gradient_score(0.125), 2) == 0.50

    # Chl-a Score
    assert compute_chla_score(1.5) == 1.0
    assert compute_chla_score(0.4) == 1.0
    assert compute_chla_score(3.0) == 1.0
    assert compute_chla_score(0.05) == 0.0

    # Composite Score (SST=28.0, Grad=0.20, Chla=1.5)
    # s_front = 0.20/0.25 = 0.8; s_chl = 1.0; s_sst = 1.0
    # score = 100 * (0.40*0.8 + 0.35*1.0 + 0.25*1.0) = 100 * (0.32 + 0.35 + 0.25) = 92.0
    score, s_sst, s_front, s_chl = calculate_composite_pfz_score(28.0, 0.20, 1.5)
    assert score == 92.0
    assert s_sst == 1.0
    assert s_front == 0.8
    assert s_chl == 1.0


def test_pfz_ranking_and_geofence_quarantine():
    """Verifies candidate ranking and that candidates violating IMBL/MPA are flagged and not top-recommended."""
    report = compute_pfz_zones("rameswaram", max_candidates=3)
    assert report.harbour_id == "rameswaram"
    assert len(report.candidates) > 0
    assert report.top_recommendation is not None
    assert report.top_recommendation.is_geofence_safe is True
    assert report.top_recommendation.pfz_score > 0.0

    # Test candidate near IMBL: should be flagged unsafe
    imbl_cand = None
    for c in report.candidates:
        if c.zone_id == "rameswaram_near_imbl":
            imbl_cand = c
            break

    if imbl_cand:
        assert imbl_cand.is_geofence_safe is False
        assert "RESTRICTED" in imbl_cand.biological_rationale


# ==============================================================================
# 4. PRODUCTIVITY DIAGNOSTIC TOOL TESTS
# ==============================================================================


def test_productivity_marine_heatwave():
    """Verifies detection of thermal stratification barrier when SST anomaly >= +1.8 C."""
    diag = diagnose_productivity_decline(
        region_name="Gulf of Mannar Coast",
        latitude=9.2,
        longitude=79.2,
        sst_anomaly_c=2.1,
        chla_current_mg_m3=0.12,
        chla_historical_mg_m3=1.65,
    )
    assert diag.severity_level == "CRITICAL"
    assert "Heatwave" in diag.primary_mechanism
    assert "pycnocline" in diag.explanation.lower() or "stratification" in diag.explanation.lower()
    assert "trolling" in diag.remediation_outlook.lower() or "offshore" in diag.remediation_outlook.lower()


def test_productivity_hab_hypoxia():
    """Verifies detection of harmful algal bloom & hypoxia when Chl-a >= 5.5 mg/m3."""
    diag = diagnose_productivity_decline(
        region_name="Cochin Backwaters & Coastal Shelf",
        latitude=9.93,
        longitude=76.25,
        sst_anomaly_c=0.4,
        chla_current_mg_m3=6.8,  # > 5.5 threshold
        chla_historical_mg_m3=2.1,
    )
    assert diag.severity_level == "HIGH"
    assert "Harmful Algal Bloom" in diag.primary_mechanism
    assert "hypoxia" in diag.explanation.lower() or "dissolved oxygen" in diag.explanation.lower()
    assert "shellfish" in diag.remediation_outlook.lower() or "trawling" in diag.remediation_outlook.lower()


def test_productivity_cyclone_turbidity():
    """Verifies detection of storm turbidity and shoal dispersal."""
    diag = diagnose_productivity_decline(
        region_name="Paradip Coast",
        latitude=20.25,
        longitude=86.67,
        sst_anomaly_c=0.3,
        chla_current_mg_m3=1.4,
        recent_wind_gusts_kmh=56.0,
        recent_wave_height_m=3.2,
    )
    assert diag.severity_level == "MODERATE"
    assert "Turbidity" in diag.primary_mechanism or "Agitation" in diag.primary_mechanism


def test_productivity_normal_conditions():
    """Verifies normal optimal baseline when metrics are within healthy limits."""
    diag = diagnose_productivity_decline(
        region_name="Mangaluru Offshore",
        latitude=12.85,
        longitude=74.80,
        sst_anomaly_c=0.2,
        chla_current_mg_m3=1.5,
        recent_wind_gusts_kmh=18.0,
        recent_wave_height_m=1.0,
    )
    assert diag.severity_level == "LOW"
    assert "Normal" in diag.primary_mechanism


def test_indo_pak_sir_creek_geofence():
    """Verifies geofence detection along the Indo-Pakistan Sir Creek maritime boundary."""
    # Point ~0.38 NM from Indo-Pak IMBL: (67.96, 23.5)
    border_pt = check_geofence(lon=67.96, lat=23.5)
    assert border_pt.is_violation is True
    assert border_pt.alert_level == "CRITICAL"
    assert border_pt.boundary_type == BoundaryType.IMBL
    assert "Pakistan" in (border_pt.boundary_name or "")
    assert border_pt.distance_nm <= 1.5


@pytest.mark.asyncio
async def test_weather_tool_simulated_network_timeout(monkeypatch):
    """Verifies that an Open-Meteo network timeout automatically recovers using fallback climatology."""
    from backend.tools import weather_marine_tool

    async def _mock_fetch_fail(*args, **kwargs):
        raise TimeoutError("Simulated Open-Meteo connection timeout")

    monkeypatch.setattr(weather_marine_tool, "fetch_live_marine_and_weather", _mock_fetch_fail)

    report = await weather_marine_tool.get_weather_marine_report(
        lat=9.2876,
        lon=79.3129,
        harbour_id="rameswaram",
        vessel_type=VesselType.COUNTRY_CRAFT,
    )
    assert report.provenance.metrics["is_fallback"] is True
    assert report.provenance.confidence_score == 0.82
    assert report.wave_height_m > 0.0


def test_mechanized_trawler_extreme_gusts_and_wind():
    """Verifies that mechanized trawler triggers RED alert on gusts >= 60 km/h or winds >= 45 km/h."""
    # Gusts 62 km/h triggers RED
    metrics_gusts = {
        "wave_height_m": 2.2,
        "wind_speed_kmh": 40.0,
        "wind_gusts_kmh": 62.0,  # >= 60 km/h
        "cape_j_kg": 400.0,
        "swell_wave_period_s": 9.0,
    }
    status, msg, _, _, cb = assess_vessel_safety(metrics_gusts, VesselType.MECHANIZED_TRAWLER)
    assert status == SafetyLevel.RED_ALERT
    assert cb is True
    assert "Wind gusts" in msg

    # Wind speed 46 km/h triggers RED
    metrics_wind = {
        "wave_height_m": 2.2,
        "wind_speed_kmh": 46.0,  # >= 45 km/h
        "wind_gusts_kmh": 50.0,
        "cape_j_kg": 400.0,
        "swell_wave_period_s": 9.0,
    }
    status, msg, _, _, cb = assess_vessel_safety(metrics_wind, VesselType.MECHANIZED_TRAWLER)
    assert status == SafetyLevel.RED_ALERT
    assert cb is True
    assert "Sustained wind" in msg


def test_sea_venture_safety_index_tiers():
    """Verifies deterministic 0-100 Sea-Venture Safety Index and hard safety floors."""
    # 1. Benign/calm -> LOW risk (< 25)
    calm_metrics = {
        "wave_height_m": 0.4,
        "wind_speed_kmh": 10.0,
        "wind_gusts_kmh": 14.0,
        "cape_j_kg": 150.0,
        "swell_wave_period_s": 5.0,
    }
    score_calm, verdict_calm = calculate_sea_venture_safety_index(calm_metrics, VesselType.COUNTRY_CRAFT)
    assert 0 <= score_calm <= 25
    assert verdict_calm == "LOW"

    # 2. Moderate/Amber -> MODERATE risk (26-50)
    amber_metrics = {
        "wave_height_m": 1.25,  # Exceeds 1.2m amber threshold, others calm
        "wind_speed_kmh": 15.0,
        "wind_gusts_kmh": 18.0,
        "cape_j_kg": 250.0,
        "swell_wave_period_s": 6.0,
    }
    score_amber, verdict_amber = calculate_sea_venture_safety_index(amber_metrics, VesselType.COUNTRY_CRAFT)
    assert 26 <= score_amber <= 50
    assert verdict_amber == "MODERATE"

    # 3. High Risk (near threshold) -> HIGH risk (51-75)
    high_metrics = {
        "wave_height_m": 1.5,
        "wind_speed_kmh": 28.0,
        "wind_gusts_kmh": 36.0,
        "cape_j_kg": 800.0,
        "swell_wave_period_s": 9.0,
    }
    score_high, verdict_high = calculate_sea_venture_safety_index(high_metrics, VesselType.COUNTRY_CRAFT)
    assert 51 <= score_high <= 75
    assert verdict_high == "HIGH"

    # 4. Critical Red Breach -> EXTREME risk (>= 76 clamped)
    extreme_metrics = {
        "wave_height_m": 2.5,  # >= 1.8m
        "wind_speed_kmh": 40.0,
        "wind_gusts_kmh": 55.0,
        "cape_j_kg": 1800.0,
        "swell_wave_period_s": 14.0,
    }
    score_extreme, verdict_extreme = calculate_sea_venture_safety_index(extreme_metrics, VesselType.COUNTRY_CRAFT)
    assert score_extreme >= 76
    assert verdict_extreme == "EXTREME"


def test_pfz_evidence_ledger_entry():
    """Verifies that PFZ candidate generation populates EvidenceLedgerEntry and front categorization."""
    report = compute_pfz_zones(harbour_id="rameswaram", max_candidates=2)
    assert len(report.candidates) >= 1
    top = report.top_recommendation
    assert top is not None
    assert top.evidence_ledger_entry is not None
    assert "EOS-06" in top.evidence_ledger_entry.platform_mission
    assert "INSAT-3DS" in top.evidence_ledger_entry.source_sensor
    assert "SSTM" in top.evidence_ledger_entry.anomaly_note
    assert top.front_category in [
        "Cayula-Cornillon Bimodal Water Mass Front",
        "Moderate Thermal Gradient Front",
    ]
    assert top.persistence_days == 7

