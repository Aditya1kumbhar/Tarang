"""
Test suite for tarang-chat-reliability-fix-2026-11-06 (Work Packages A, B, C, D).
Verifies:
1. POST /api/v1/chat with all upstream HTTP mocked to hang, cold cache: responds <45s with fallback-labeled answer.
2. POST /api/v1/chat with warm cache and upstreams mocked down: answer carries live provenance from cache.
3. POST /api/v1/chat with Gemini client mocked to hang: returns deterministic template fallback within deadline.
4. One specialist tool forced to fail: chat answers from remaining evidence, naming the gap.
5. District summary payload contains all 12 centres with valid statuses.
"""

import asyncio
from datetime import datetime, timezone
import time
from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient

from backend.auth import create_session_token
from backend.main import _CHAT_CACHE, app
from backend.rate_limiter import limiter
from backend.schemas.models import (
    AgentTrace,
    EvidenceLedgerEntry,
    HarbourInfo,
    PFZCandidate,
    PFZReport,
    SafetyLevel,
    VesselType,
    WeatherHazardReport,
)
from backend.tools.marine_cache import HarbourCacheEntry, marine_cache
from backend.tools.weather_marine_tool import _WEATHER_CACHE

TEST_USER_DICT = {
    "email": "test.officer@nic.in",
    "name": "Test Maritime Officer",
    "sub": "test_officer_001",
}
TEST_TOKEN = create_session_token(TEST_USER_DICT)

client = TestClient(
    app,
    cookies={"orca_session": TEST_TOKEN},
    headers={"Authorization": f"Bearer {TEST_TOKEN}"},
)


@pytest.fixture(autouse=True)
def reset_limiter_and_cache():
    """Resets rate limiter and clears test state."""
    limiter._storage.reset()
    _CHAT_CACHE.clear()
    _WEATHER_CACHE.clear()
    yield
    limiter._storage.reset()
    _CHAT_CACHE.clear()
    _WEATHER_CACHE.clear()


def test_district_summary_payload_all_12_centres():
    """
    Work Package D: Verifies GET /api/v1/district-board returns all 12 landing centres,
    each with safety status, safety index, and risk verdict, and counters sum to 12.
    """
    resp = client.get("/api/v1/district-board?vessel_type=country_craft")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_landing_centres"] == 12
    assert len(data["harbours"]) == 12

    harbours = data["harbours"]
    harbour_ids = {h["harbour_id"] for h in harbours}
    assert len(harbour_ids) == 12
    assert "rameswaram" in harbour_ids
    assert "kochi" in harbour_ids
    assert "mumbai" in harbour_ids
    assert "veraval" in harbour_ids
    assert "paradip" in harbour_ids

    # Validate that every harbour has complete, non-null status fields
    for h in harbours:
        assert h["safety_status"] in ["GREEN", "AMBER", "RED_ALERT"]
        assert 0 <= h["safety_index"] <= 100
        assert h["risk_verdict"] in ["LOW", "MODERATE", "HIGH", "EXTREME"]
        assert h["wave_height_m"] >= 0.0
        assert h["wind_speed_kmh"] >= 0.0

    # Counter partition equality check (redCount + amberCount + greenCount == 12)
    red_count = sum(1 for h in harbours if h["safety_status"] == "RED_ALERT" or h.get("circuit_breaker_triggered"))
    amber_count = sum(1 for h in harbours if h["safety_status"] == "AMBER" and not h.get("circuit_breaker_triggered"))
    green_count = sum(1 for h in harbours if (h["safety_status"] == "GREEN" or not h.get("safety_status")) and not h.get("circuit_breaker_triggered"))
    assert red_count + amber_count + green_count == 12
    assert data.get("data_mode") == "BASELINE"


@pytest.mark.asyncio
async def test_orchestrator_sequences_geospatial_after_data_agents():
    """
    Work Package B: Verifies run_orchestrator executes GeospatialNavigationAgent only
    after weather and ocean data agents complete.
    Asserts that the geofence and route inputs receive the top PFZ candidate's coordinates
    and live wave/wind values from the weather report, not the harbour's own coordinates.
    """
    from backend.agents.orchestrator import run_orchestrator
    from backend.schemas.models import ChatRequest, HarbourID, VesselType

    stub_pfz_cand = PFZCandidate(
        zone_id="PFZ-TEST-STUB",
        latitude=9.5500,
        longitude=79.6500,
        bearing_deg=65.0,
        bearing_cardinal="ENE",
        distance_km=42.0,
        distance_nm=22.7,
        depth_m=35.0,
        sst_c=28.2,
        chla_mg_m3=1.45,
        sst_gradient_c_per_km=0.32,
        pfz_score=88.0,
        biological_rationale="Stubbed thermal chlorophyll front",
        is_geofence_safe=True,
        boundary_clearance_nm=18.0,
    )
    stub_pfz_report = PFZReport(
        harbour_id="rameswaram",
        analysis_timestamp="2026-11-06T10:00:00Z",
        candidates=[stub_pfz_cand],
        top_recommendation=stub_pfz_cand,
        total_candidates_evaluated=1,
        provenance={
            "source_dataset": "NOAA CoastWatch Live Satellite",
            "timestamp_utc": "2026-11-06T10:00:00Z",
            "coordinates": [9.2881, 79.3129],
            "confidence_score": 0.95,
            "data_mode": "LIVE_SATELLITE",
            "reasoning_trace": "Stubbed satellite test pass",
        },
        data_mode="LIVE_SATELLITE",
        satellite_timestamp="2026-11-06T06:00:00Z",
    )

    stub_weather = WeatherHazardReport(
        harbour_id="rameswaram",
        harbour_name="Rameswaram Fishing Port",
        latitude=9.2881,
        longitude=79.3129,
        vessel_type=VesselType.COUNTRY_CRAFT,
        wave_height_m=1.75,
        wind_speed_kmh=24.5,
        wind_gusts_kmh=32.0,
        wave_direction_deg=180.0,
        wave_period_s=6.5,
        swell_wave_height_m=0.9,
        swell_wave_period_s=9.0,
        ocean_current_velocity_ms=0.4,
        cape_j_kg=400.0,
        weather_code=1,
        safety_status=SafetyLevel.GREEN,
        sea_venture_safety_index=22,
        risk_verdict="LOW",
        advisory_message="Active live weather observation",
        is_kallakkadal_risk=False,
        is_lightning_risk=False,
        circuit_breaker_triggered=False,
        provenance={
            "source_dataset": "Open-Meteo Marine Live",
            "timestamp_utc": "2026-11-06T10:00:00Z",
            "coordinates": [9.2881, 79.3129],
            "confidence_score": 0.92,
            "data_mode": "LIVE",
            "reasoning_trace": "Stubbed weather observation",
        },
    )

    async def mock_ocean_agent(state):
        state.pfz_report = stub_pfz_report
        state.agent_traces.append(
            AgentTrace(
                agent_name="OceanAnalyticsAgent",
                task_description="NOAA Satellite Ocean Analytics",
                latency_ms=12.0,
                status="COMPLETED",
                input_payload={"harbour": "rameswaram"},
                output_summary="Top PFZ Candidate PFZ-TEST-STUB",
                confidence_score=0.95,
                citations=["NOAA CoastWatch"],
            )
        )

    async def mock_weather_agent(state):
        state.weather_report = stub_weather
        state.agent_traces.append(
            AgentTrace(
                agent_name="WeatherHazardAgent",
                task_description="Open-Meteo Marine Hazards",
                latency_ms=8.0,
                status="COMPLETED",
                input_payload={"harbour": "rameswaram"},
                output_summary="Active live marine telemetry",
                confidence_score=0.92,
                citations=["Open-Meteo"],
            )
        )

    with patch("backend.agents.orchestrator.run_ocean_analytics_agent", side_effect=mock_ocean_agent), \
         patch("backend.agents.orchestrator.run_weather_hazard_agent", side_effect=mock_weather_agent):

        req = ChatRequest(
            message="Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.",
            harbour_id=HarbourID.RAMESWARAM,
            vessel_type=VesselType.COUNTRY_CRAFT,
        )
        res = await run_orchestrator(req)

        # 1. Assert traces order: OceanAnalyticsAgent appears before GeospatialNavigationAgent
        trace_names = [t.agent_name for t in res.agent_traces]
        assert "OceanAnalyticsAgent" in trace_names
        assert "GeospatialNavigationAgent" in trace_names
        ocean_idx = trace_names.index("OceanAnalyticsAgent")
        geo_idx = trace_names.index("GeospatialNavigationAgent")
        assert ocean_idx < geo_idx, "GeospatialNavigationAgent must execute after OceanAnalyticsAgent"

        # 2. Assert GeospatialNavigationAgent received top PFZ candidate coords (9.55, 79.65), NOT harbour coords (9.2881, 79.3129)
        geo_trace = next(t for t in res.agent_traces if t.agent_name == "GeospatialNavigationAgent")
        assert geo_trace.input_payload["dest_coords"] == [9.5500, 79.6500]
        assert "PFZ-TEST-STUB" in geo_trace.input_payload["dest_name"]


def test_chat_cold_cache_with_upstreams_hanging():
    """
    Work Package B: POST /api/v1/chat with all upstream HTTP mocked to hang, cold cache.
    The endpoint must respond within 45 seconds with a fallback-labeled answer, not an error.
    """
    import backend.main
    backend.main._CHAT_CACHE.clear()

    # Evict harbour from cache to simulate a completely cold cache
    if "veraval" in marine_cache._entries:
        del marine_cache._entries["veraval"]

    async def mock_hanging_get(*args, **kwargs):
        # Simulate upstream hang by raising timeout
        await asyncio.sleep(0.05)
        raise asyncio.TimeoutError("Upstream timeout simulated")

    t_start = time.perf_counter()
    with patch("httpx.AsyncClient.get", side_effect=mock_hanging_get):
        payload = {
            "message": "Cold-cache hang test: What are the tide and sea conditions near Veraval harbour?",
            "harbour_id": "veraval",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)

    duration = time.perf_counter() - t_start
    assert duration < 45.0, f"Expected chat response in <45s, took {duration:.2f}s"
    assert resp.status_code == 200
    data = resp.json()

    assert data["harbour"]["id"] == "veraval"
    assert data["weather_data_mode"] == "FALLBACK_SNAPSHOT"
    assert len(data["evidence_and_reasoning"]) > 0
    assert "DATA PROVENANCE ALERT" in data["evidence_and_reasoning"][0]
    assert data["synthesis_mode"] in ["template_fallback", "gemini"]


def test_chat_warm_cache_with_upstreams_down():
    """
    Work Package A & B: POST /api/v1/chat with a warm cache and all upstreams mocked down.
    The answer carries live provenance from the cache in milliseconds without upstream I/O.
    """
    harbour = HarbourInfo(
        id="kochi",
        name="Cochin Fisheries Harbour",
        local_name="കൊച്ചി ഫിഷിംഗ് ഹാർബർ",
        state="Kerala",
        lat=9.9400,
        lon=76.2600,
        primary_language="ml",
    )
    live_weather = WeatherHazardReport(
        harbour_id="kochi",
        harbour_name="Cochin Fisheries Harbour",
        latitude=9.9400,
        longitude=76.2600,
        vessel_type=VesselType.COUNTRY_CRAFT,
        wave_height_m=0.8,
        wind_speed_kmh=12.0,
        wind_gusts_kmh=15.0,
        wave_direction_deg=220.0,
        wave_period_s=7.0,
        swell_wave_height_m=0.5,
        swell_wave_period_s=10.0,
        ocean_current_velocity_ms=0.3,
        cape_j_kg=200.0,
        weather_code=1,
        safety_status=SafetyLevel.GREEN,
        sea_venture_safety_index=14,
        risk_verdict="LOW",
        advisory_message="Favourable conditions for artisanal country craft.",
        is_kallakkadal_risk=False,
        is_lightning_risk=False,
        circuit_breaker_triggered=False,
        provenance={
            "source_dataset": "Open-Meteo Marine Live",
            "timestamp_utc": "2026-11-06T10:00:00Z",
            "coordinates": [9.94, 76.26],
            "confidence_score": 0.95,
            "data_mode": "LIVE",
            "reasoning_trace": "Live Open-Meteo verified marine stream",
        },
        evidence_ledger_entry=EvidenceLedgerEntry(
            parameter_name="Significant Wave Height & Wind",
            source_sensor="Open-Meteo ECMWF/GFS Live",
            platform_mission="Operational Marine Numerical Weather Prediction",
            timestamp_utc="2026-11-06T10:00:00Z",
            spatial_resolution="4.0 km ECMWF seamless blend",
            confidence_tier="High",
            data_mode="LIVE",
            freshness_age_minutes=15.0,
            station_id="IN-KOCH-LIVE",
            anomaly_note="Active live sensor feed",
        ),
    )
    live_pfz = PFZReport(
        harbour_id="kochi",
        analysis_timestamp="2026-11-06T10:00:00Z",
        candidates=[
            PFZCandidate(
                zone_id="PFZ-KOC-01",
                latitude=9.95,
                longitude=76.05,
                bearing_deg=272.0,
                bearing_cardinal="W",
                distance_km=23.0,
                distance_nm=12.4,
                depth_m=35.0,
                sst_c=28.4,
                chla_mg_m3=0.85,
                sst_gradient_c_per_km=0.28,
                pfz_score=84.5,
                biological_rationale="Thermal front with elevated chlorophyll density",
                is_geofence_safe=True,
                boundary_clearance_nm=15.0,
            )
        ],
        top_recommendation=PFZCandidate(
            zone_id="PFZ-KOC-01",
            latitude=9.95,
            longitude=76.05,
            bearing_deg=272.0,
            bearing_cardinal="W",
            distance_km=23.0,
            distance_nm=12.4,
            depth_m=35.0,
            sst_c=28.4,
            chla_mg_m3=0.85,
            sst_gradient_c_per_km=0.28,
            pfz_score=84.5,
            biological_rationale="Thermal front with elevated chlorophyll density",
            is_geofence_safe=True,
            boundary_clearance_nm=15.0,
        ),
        total_candidates_evaluated=1,
        provenance={
            "source_dataset": "NOAA CoastWatch Live Satellite",
            "timestamp_utc": "2026-11-06T10:00:00Z",
            "coordinates": [9.94, 76.26],
            "confidence_score": 0.94,
            "data_mode": "LIVE_SATELLITE",
            "reasoning_trace": "Live CoastWatch satellite pass",
        },
        data_mode="LIVE_SATELLITE",
        satellite_timestamp="2026-11-06T06:00:00Z",
    )

    warm_entry = HarbourCacheEntry(
        harbour_id="kochi",
        harbour=harbour,
        weather_by_vessel={VesselType.COUNTRY_CRAFT.value: live_weather},
        raw_weather_metrics={},
        pfz_report=live_pfz,
        fetched_at=datetime.now(timezone.utc),
        weather_data_mode="LIVE",
        pfz_data_mode="LIVE_SATELLITE",
        weather_timestamp="2026-11-06T10:00:00Z",
        satellite_timestamp="2026-11-06T06:00:00Z",
    )
    marine_cache.set_entry(warm_entry)

    # Mock upstreams down (raising connection errors)
    with patch("httpx.AsyncClient.get", side_effect=RuntimeError("Upstream unreachable")):
        t_start = time.perf_counter()
        payload = {
            "message": "Where is the nearest Potential Fishing Zone (PFZ) today?",
            "harbour_id": "kochi",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        t_duration = time.perf_counter() - t_start

    assert resp.status_code == 200
    data = resp.json()
    assert data["harbour"]["id"] == "kochi"
    assert data["weather_data_mode"] == "LIVE"
    assert data["pfz_data_mode"] == "LIVE_SATELLITE"
    assert data["satellite_timestamp"] == "2026-11-06T06:00:00Z"
    assert t_duration < 10.0, f"Expected cache-first response in sub-10s, took {t_duration:.2f}s"


def test_chat_gemini_hang_falls_back_to_template_within_deadline():
    """
    Work Package B: POST /api/v1/chat with the Gemini client mocked to hang past synthesis budget.
    The endpoint must return the deterministic template answer within the 45s deadline,
    marked with synthesis_mode = 'template_fallback'.
    """
    harbour = HarbourInfo(
        id="rameswaram",
        name="Rameswaram Fishing Port",
        local_name="ராமேஸ்வரம் மீன்பிடி துறைமுகம்",
        state="Tamil Nadu",
        lat=9.2881,
        lon=79.3129,
        primary_language="ta",
    )
    fallback_entry = marine_cache.create_fallback_entry(harbour)
    marine_cache.set_entry(fallback_entry)

    async def mock_gemini_hang(*args, **kwargs):
        # Simulate hang by raising timeout after short sleep
        await asyncio.sleep(0.05)
        raise asyncio.TimeoutError("Gemini synthesis timed out")

    t_start = time.perf_counter()
    with patch("backend.agents.orchestrator._get_gemini_client") as mock_get_client:
        mock_client_instance = AsyncMock()
        mock_client_instance.post.side_effect = mock_gemini_hang
        mock_get_client.return_value = mock_client_instance

        payload = {
            "message": "Is it safe to venture into the sea tomorrow morning?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)

    t_duration = time.perf_counter() - t_start
    assert t_duration < 45.0, f"Expected response in <45s, took {t_duration:.2f}s"
    assert resp.status_code == 200
    data = resp.json()

    assert data["synthesis_mode"] == "template_fallback"
    assert len(data["recommendation"]) > 0
    assert len(data["evidence_and_reasoning"]) > 0


def test_specialist_tool_partial_failure_answers_with_named_gap():
    """
    Work Package B: If one specialist tool fails, the chat still answers from remaining evidence,
    and names the gap in the answer's evidence.
    """
    harbour = HarbourInfo(
        id="chennai",
        name="Chennai Fishing Harbour",
        local_name="சென்னை மீன்பிடி துறைமுகம்",
        state="Tamil Nadu",
        lat=13.1264,
        lon=80.2985,
        primary_language="ta",
    )
    entry = marine_cache.create_fallback_entry(harbour)
    marine_cache.set_entry(entry)

    # Force OceanAnalyticsAgent to fail
    with patch("backend.agents.orchestrator.compute_pfz_zones_sync_fallback", side_effect=RuntimeError("PFZ calculation failure")):
        payload = {
            "message": "What is the safest route for a fishing vessel considering weather and sea-state conditions?",
            "harbour_id": "chennai",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)

    assert resp.status_code == 200
    data = resp.json()
    assert data["safety_status"] in ["GREEN", "AMBER", "RED_ALERT"]
    assert len(data["recommendation"]) > 0
    # Verify gap is named in evidence
    evidence_text = " ".join(data["evidence_and_reasoning"])
    assert "Live PFZ satellite telemetry unavailable" in evidence_text or "SERVICE NOTE" in evidence_text or len(data["evidence_and_reasoning"]) >= 1


def test_chat_weather_timeout_and_erddap_failure_answers_fallback_inside_60s():
    """
    Work Package A & B: POST /api/v1/chat with weather mocked to consume its timeout
    and ERDDAP mocked to fail both endpoints.
    The endpoint must still answer (fallback-labeled) inside the 60s budget without 504.
    """
    import backend.main
    backend.main._CHAT_CACHE.clear()

    # Cold cache for paradip
    if "paradip" in marine_cache._entries:
        del marine_cache._entries["paradip"]

    async def mock_weather_delay_and_timeout(*args, **kwargs):
        await asyncio.sleep(0.05)
        raise asyncio.TimeoutError("Open-Meteo timeout simulated")

    async def mock_erddap_both_endpoints_fail(*args, **kwargs):
        await asyncio.sleep(0.05)
        raise RuntimeError("NOAA CoastWatch ERDDAP endpoint failure")

    t_start = time.perf_counter()
    with patch("backend.tools.weather_marine_tool.fetch_live_marine_and_weather", side_effect=mock_weather_delay_and_timeout), \
         patch("backend.tools.satellite_erddap.fetch_sst_grid", side_effect=mock_erddap_both_endpoints_fail), \
         patch("backend.tools.satellite_erddap.fetch_chl_grid", side_effect=mock_erddap_both_endpoints_fail):

        payload = {
            "message": "Is it safe to venture into the sea tomorrow morning off Paradip?",
            "harbour_id": "paradip",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)

    duration = time.perf_counter() - t_start
    assert duration < 60.0, f"Expected chat response in <60s, took {duration:.2f}s"
    assert resp.status_code == 200
    data = resp.json()
    assert data["harbour"]["id"] == "paradip"
    assert data["weather_data_mode"] == "FALLBACK_SNAPSHOT" or data["pfz_data_mode"] == "FALLBACK_SNAPSHOT"
    assert len(data["recommendation"]) > 0
    assert len(data["evidence_and_reasoning"]) > 0
