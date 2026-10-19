"""
End-to-End Multi-Agent Integration Test Suite for ORCA Phase 3.
Benchmarks all 8 SIH 2026 Problem Statement #20 (ID 26176) evaluation queries:
1. PFZ Discovery with Geodesic Bearing & Distance (Rameswaram).
2. Country Boat Sea-Venture Safety Check (Kochi).
3. Mechanized Trawler Differential Safety Check (Veraval).
4. IMBL Proximity & Geofence Circuit Breaker (12 NM ESE towards Talaimannar).
5. Marine Protected Area (MPA) Exclusion (Gulf of Mannar / Malvan).
6. A* Wave-Aware Safe Maritime Pathfinding (Chennai).
7. Marine Ecosystem Reasoning & Productivity Decline Diagnosis (Mangaluru).
8. Multilingual Regional Fisher Query (Tamil / Malayalam / Hindi).
And verifies all standard REST endpoints (/health, /harbours, /dashboard-summary).
"""

import pytest
from starlette.testclient import TestClient

from backend.main import app
from backend.schemas.models import SafetyLevel, VesselType

client = TestClient(app)


# ==============================================================================
# REST ENDPOINTS TESTS
# ==============================================================================

def test_health_check_endpoint():
    """Verifies that the /health endpoint is operational."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "ORCA" in data["service"]


def test_list_harbours_endpoint():
    """Verifies that /api/v1/harbours returns all 12 Indian fishing landing centres."""
    resp = client.get("/api/v1/harbours")
    assert resp.status_code == 200
    harbours = resp.json()
    assert len(harbours) == 12
    ids = [h["id"] for h in harbours]
    assert "rameswaram" in ids
    assert "kochi" in ids
    assert "veraval" in ids
    assert "mangaluru" in ids
    assert "chennai" in ids


def test_dashboard_summary_endpoint():
    """Verifies immediate dashboard snapshot endpoint for Rameswaram."""
    resp = client.get("/api/v1/dashboard-summary?harbour_id=rameswaram&vessel_type=country_craft")
    assert resp.status_code == 200
    data = resp.json()
    assert data["harbour"]["id"] == "rameswaram"
    assert "weather" in data
    assert "wave_height_m" in data["weather"]
    assert "map_payload" in data
    assert data["map_payload"]["type"] == "FeatureCollection"
    assert len(data["map_payload"]["features"]) >= 1


def test_dashboard_summary_invalid_harbour():
    """Verifies 404 response on unknown harbour ID."""
    resp = client.get("/api/v1/dashboard-summary?harbour_id=nonexistent_port")
    assert resp.status_code == 404


# ==============================================================================
# 8 SIH PROBLEM STATEMENT BENCHMARK QUERY TESTS
# ==============================================================================

def test_sih_query_1_pfz_discovery_rameswaram():
    """
    Query 1: PFZ Discovery with Geodesic Bearing & Distance
    Prompt: 'Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.'
    """
    payload = {
        "message": "Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.",
        "harbour_id": "rameswaram",
        "vessel_type": "country_craft",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "rameswaram"
    assert len(data["evidence_and_reasoning"]) >= 1
    # Check that PFZ evidence was cited
    pfz_citations = [e for e in data["evidence_and_reasoning"] if "Potential Fishing Zone" in e]
    assert len(pfz_citations) >= 1
    evidence_text = pfz_citations[0]
    assert "Bearing" in evidence_text
    assert "Distance" in evidence_text
    assert "SST =" in evidence_text
    assert "Chlorophyll-a =" in evidence_text
    assert "PFZ Score =" in evidence_text

    # Map payload must contain PFZ features
    features = data["map_payload"]["features"]
    pfz_features = [f for f in features if f["properties"].get("entity") == "pfz_zone"]
    assert len(pfz_features) >= 1
    top_pfz = [f for f in pfz_features if f["properties"].get("is_top") is True]
    assert len(top_pfz) == 1
    assert top_pfz[0]["properties"]["is_safe"] is True

    # Agent traces check
    agent_names = [t["agent_name"] for t in data["agent_traces"]]
    assert "PlannerAgent" in agent_names
    assert "OceanAnalyticsAgent" in agent_names
    assert "SynthesisExplainabilityAgent" in agent_names


def test_sih_query_2_country_craft_safety_kochi():
    """
    Query 2: Country Boat Sea-Venture Safety Check
    Prompt: 'Is it safe for a small motorized country craft (Vallam) to venture into the sea off Kochi tomorrow morning?'
    """
    payload = {
        "message": "Is it safe for a small motorized country craft (Vallam) to venture into the sea off Kochi tomorrow morning?",
        "harbour_id": "kochi",
        "vessel_type": "country_craft",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "kochi"
    assert data["vessel_type"] == "country_craft"
    assert data["safety_status"] in ["GREEN", "AMBER", "RED_ALERT"]

    # Weather agent should have executed
    weather_citations = [e for e in data["evidence_and_reasoning"] if "Weather & Marine" in e]
    assert len(weather_citations) >= 1
    assert "Wave Height" in weather_citations[0]
    assert "Wind Speed" in weather_citations[0]

    traces = {t["agent_name"]: t for t in data["agent_traces"]}
    assert "WeatherHazardAgent" in traces
    assert "SafetyCircuitBreaker" in traces


def test_sih_query_3_mechanized_trawler_differential_veraval():
    """
    Query 3: Mechanized Trawler Differential Safety Check
    Prompt: 'Can a 45ft mechanized trawler venture out from Veraval harbour in Gujarat with 32 km/h winds and 2.1m wave height?'
    Verifies differential thresholds:
    - For country_craft: wave >= 1.8m is RED_ALERT.
    - For mechanized_trawler: wave 2.1m is < 2.8m (red), wind 32 km/h < 45 km/h (red) -> AMBER (Caution).
    """
    payload = {
        "message": "Can a 45ft mechanized trawler venture out from Veraval harbour in Gujarat with 32 km/h winds and 2.1m wave height?",
        "harbour_id": "veraval",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "veraval"
    assert data["vessel_type"] == "mechanized_trawler"

    # Mechanized trawler under 2.1m wave & 32 km/h wind evaluates to AMBER (Caution)
    assert data["safety_status"] == "AMBER"
    assert data["safety_override_banner"] is not None
    assert "CAUTION" in data["safety_override_banner"] or "خبرداری" in data["safety_override_banner"]

    weather_citations = [e for e in data["evidence_and_reasoning"] if "Weather & Marine" in e]
    assert len(weather_citations) >= 1
    assert "Wave Height = 2.1" in weather_citations[0]
    assert "Wind Speed = 32.0" in weather_citations[0]


def test_sih_query_4_imbl_proximity_and_circuit_breaker():
    """
    Query 4: IMBL Proximity & Geofence Circuit Breaker
    Prompt: 'Find fishing coordinates 12 nautical miles East-Southeast of Rameswaram towards Talaimannar.'
    12 NM ESE towards Talaimannar puts the coordinates in direct conflict with the Indo-Sri Lanka IMBL border.
    Must trigger circuit breaker or critical geofence warning.
    """
    payload = {
        "message": "Find fishing coordinates 12 nautical miles East-Southeast of Rameswaram towards Talaimannar.",
        "harbour_id": "rameswaram",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "rameswaram"
    # Geofence assessment must be present
    geofence_citations = [e for e in data["evidence_and_reasoning"] if "Geospatial Boundary Status" in e]
    assert len(geofence_citations) >= 1

    # Should trigger RED_ALERT or AMBER safety banner
    assert data["safety_status"] in ["RED_ALERT", "AMBER"]
    assert data["safety_override_banner"] is not None

    # Map payload must contain target inspection point
    features = data["map_payload"]["features"]
    target_pts = [f for f in features if f["properties"].get("entity") == "target_inspection_point"]
    assert len(target_pts) == 1
    assert target_pts[0]["properties"]["alert_level"] in ["CRITICAL", "WARNING"]


def test_sih_query_5_mpa_exclusion():
    """
    Query 5: Marine Protected Area (MPA) Exclusion
    Prompt: 'Can we set our nets inside the Gulf of Mannar Marine National Park or near Malvan Marine Sanctuary?'
    Coordinates inside MPA must trigger critical violation.
    """
    payload = {
        "message": "Can we set our nets inside the Gulf of Mannar Marine National Park?",
        "harbour_id": "rameswaram",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["safety_status"] == "RED_ALERT"
    assert data["safety_override_banner"] is not None
    assert "CRITICAL MARITIME SAFETY OVERRIDE" in data["safety_override_banner"]

    # Recommendation must explicitly warn about MPA violation / Wildlife Protection Act
    assert "DO NOT VENTURE" in data["recommendation"] or "INSIDE" in data["recommendation"] or "Marine National Park" in data["recommendation"]

    # Target inspection feature must be flagged as violation
    features = data["map_payload"]["features"]
    targets = [f for f in features if f["properties"].get("entity") == "target_inspection_point"]
    assert len(targets) >= 1
    assert targets[0]["properties"]["is_violation"] is True


def test_sih_query_6_safe_routing_chennai():
    """
    Query 6: A* Wave-Aware Safe Maritime Pathfinding
    Prompt: 'Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.'
    """
    payload = {
        "message": "Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.",
        "harbour_id": "chennai",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "chennai"

    # Route citation in evidence
    route_citations = [e for e in data["evidence_and_reasoning"] if "Wave-Aware A* Safe Route" in e]
    assert len(route_citations) >= 1
    assert "Estimated Transit Time" in route_citations[0]
    assert "Fuel Savings" in route_citations[0]

    # Map payload must contain safe navigation route LineString
    features = data["map_payload"]["features"]
    route_features = [f for f in features if f["properties"].get("entity") == "safe_navigation_route"]
    assert len(route_features) == 1
    geom = route_features[0]["geometry"]
    assert geom["type"] == "LineString"
    assert len(geom["coordinates"]) >= 2


def test_sih_query_7_productivity_decline_mangaluru():
    """
    Query 7: Marine Ecosystem Reasoning & Productivity Decline Diagnosis
    Prompt: 'Why has pelagic fish catch dropped significantly off the Mangaluru coast over the past two weeks?'
    """
    payload = {
        "message": "Why has pelagic fish catch dropped significantly off the Mangaluru coast over the past two weeks?",
        "harbour_id": "mangaluru",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "mangaluru"

    # Check productivity diagnostic citation
    diag_citations = [e for e in data["evidence_and_reasoning"] if "Ecosystem Productivity Diagnosis" in e]
    assert len(diag_citations) >= 1
    assert "Primary Mechanism" in diag_citations[0]
    assert "SST Anomaly" in diag_citations[0]

    # Diagnostic text present in recommendation
    assert "Marine Heatwave" in data["recommendation"] or "Stratification" in data["recommendation"] or "Diagnostic Analysis" in data["recommendation"]

    traces = [t["agent_name"] for t in data["agent_traces"]]
    assert "ProductivityDiagnosticAgent" in traces


def test_sih_query_8_multilingual_tamil_query():
    """
    Query 8: Multilingual Regional Fisher Query (Tamil)
    Prompt: 'இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா? காற்று மற்றும் அலை எப்படி உள்ளது?'
    Verifies automatic language detection (ta) and response synthesized in Tamil.
    """
    payload = {
        "message": "இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா? காற்று மற்றும் அலை எப்படி உள்ளது?",
    }
    resp = client.post("/api/v1/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["detected_language"] == "ta"
    assert data["harbour"]["id"] == "rameswaram"
    assert data["vessel_type"] == "country_craft"

    # Recommendation must contain Tamil script
    # Unicode range for Tamil: \u0B80 - \u0BFF
    has_tamil = any("\u0B80" <= ch <= "\u0BFF" for ch in data["recommendation"])
    assert has_tamil, "Expected Tamil script in the synthesized recommendation."

    # Evidence and reasoning items still provide rigorous physical citations
    assert len(data["evidence_and_reasoning"]) >= 1

    # Map payload must be populated
    assert len(data["map_payload"]["features"]) >= 1


def test_district_board_endpoint():
    """Verifies that /api/v1/district-board returns all 12 harbours with 0-100 safety indices."""
    resp = client.get("/api/v1/district-board?vessel_type=country_craft")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_landing_centres"] == 12
    assert len(data["harbours"]) == 12
    for h in data["harbours"]:
        assert 0 <= h["safety_index"] <= 100
        assert h["risk_verdict"] in ["LOW", "MODERATE", "HIGH", "EXTREME"]
        assert "wave_height_m" in h
        assert "wind_speed_kmh" in h


def test_demo_scenarios_endpoint():
    """Verifies the 5 locked demonstration scenarios for hackathon evaluators."""
    for sc in ["safe", "danger", "cyclone", "pfz", "route"]:
        resp = client.get(f"/api/v1/demo-scenario?scenario={sc}")
        assert resp.status_code == 200
        data = resp.json()
        assert "recommendation" in data
        assert "safety_status" in data
        assert 0 <= data["sea_venture_safety_index"] <= 100
        assert data["risk_verdict"] in ["LOW", "MODERATE", "HIGH", "EXTREME"]
        assert "evidence_ledger" in data
        assert len(data["evidence_ledger"]) >= 1
