"""
ORCA FastAPI Backend Server (SIH 2026 PS #20 / ID 26176).
Provides production-grade REST APIs for multi-agent reasoning, live harbour status,
dashboard summaries, and maritime safety overrides.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.agents.orchestrator import run_orchestrator
from backend.agents.prompts import get_safety_override_banner
from backend.config import DEFAULT_HARBOUR_ID, IMBL_FILE, MPA_FILE
from backend.schemas.models import (
    ChatRequest,
    ChatResponse,
    DashboardSummaryResponse,
    DistrictBoardResponse,
    DistrictHarbourSummary,
    HarbourInfo,
    SafetyLevel,
    VesselType,
)
from backend.tools.geospatial_tool import check_geofence
from backend.tools.ocean_pfz_tool import compute_pfz_zones, load_harbours_dict
from backend.tools.weather_marine_tool import (
    assess_vessel_safety,
    calculate_sea_venture_safety_index,
    get_fallback_marine_and_weather,
    get_weather_marine_report,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orca_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ORCA Multi-Agent Maritime Backend...")
    # Pre-warm harbour registry and geofence caches
    load_harbours_dict()
    logger.info("Harbour caches pre-warmed successfully.")
    yield
    logger.info("Shutting down ORCA Backend.")


app = FastAPI(
    title="ORCA: Oceanographic Reasoning & Collaborative Agents API",
    description="Enterprise-grade Agentic AI Marine Intelligence Platform for Indian Fisheries & Coastal Safety",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local Vite frontend and dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# API ROUTES
# ==============================================================================

@app.get("/api/v1/health", summary="Health check", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """Returns service health status and timestamp."""
    return {
        "status": "healthy",
        "service": "ORCA Multi-Agent Backend",
        "version": "1.0.0",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/harbours", response_model=List[HarbourInfo], summary="List Indian fishing landing centres", tags=["Harbours"])
async def list_harbours() -> List[HarbourInfo]:
    """
    Returns the 12 major Indian fishing landing centres with coordinates,
    state, and primary regional language metadata.
    """
    harbours_dict = load_harbours_dict()
    return list(harbours_dict.values())


@app.get(
    "/api/v1/dashboard-summary",
    response_model=DashboardSummaryResponse,
    summary="Get immediate harbour dashboard snapshot",
    tags=["Dashboard"],
)
async def get_dashboard_summary(
    harbour_id: str = Query(DEFAULT_HARBOUR_ID, description="Target harbour identifier"),
    vessel_type: VesselType = Query(VesselType.COUNTRY_CRAFT, description="Vessel type"),
) -> DashboardSummaryResponse:
    """
    Retrieves an immediate snapshot of live marine weather, top PFZ zone,
    geofence status, and map payload for dashboard views without full chat reasoning.
    """
    harbours = load_harbours_dict()
    harbour = harbours.get(harbour_id)
    if not harbour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Harbour '{harbour_id}' not found in registry."
        )

    # 1. Fetch Weather
    weather = await get_weather_marine_report(
        lat=harbour.lat,
        lon=harbour.lon,
        harbour_id=harbour.id,
        harbour_name=harbour.name,
        vessel_type=vessel_type,
    )

    # 2. Compute PFZs
    pfz_report = compute_pfz_zones(harbour_id=harbour.id, max_candidates=3)
    top_pfz = pfz_report.top_recommendation

    # 3. Assess Geofence for harbour / top PFZ
    eval_lon = top_pfz.longitude if top_pfz else harbour.lon
    eval_lat = top_pfz.latitude if top_pfz else harbour.lat
    geofence = check_geofence(eval_lon, eval_lat)

    # 4. Check Safety Circuit Breaker
    safety_override = None
    if weather.circuit_breaker_triggered or weather.safety_status == SafetyLevel.RED_ALERT or geofence.is_violation:
        safety_override = get_safety_override_banner("RED_ALERT", harbour.primary_language)
    elif weather.safety_status == SafetyLevel.AMBER or geofence.alert_level == "WARNING":
        safety_override = get_safety_override_banner("AMBER", harbour.primary_language)

    # 5. Build Map Payload
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [harbour.lon, harbour.lat]},
            "properties": {
                "entity": "harbour",
                "id": harbour.id,
                "name": harbour.name,
                "local_name": harbour.local_name,
            },
        }
    ]
    if top_pfz:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [top_pfz.longitude, top_pfz.latitude]},
            "properties": {
                "entity": "pfz_zone",
                "zone_id": top_pfz.zone_id,
                "pfz_score": top_pfz.pfz_score,
                "bearing_deg": top_pfz.bearing_deg,
                "bearing_cardinal": top_pfz.bearing_cardinal,
                "distance_nm": top_pfz.distance_nm,
                "is_safe": top_pfz.is_geofence_safe,
            },
        })

    map_payload = {"type": "FeatureCollection", "features": features}

    evidence_ledger = []
    if weather.evidence_ledger_entry:
        evidence_ledger.append(weather.evidence_ledger_entry)
    if top_pfz and top_pfz.evidence_ledger_entry:
        evidence_ledger.append(top_pfz.evidence_ledger_entry)

    return DashboardSummaryResponse(
        harbour=harbour,
        weather=weather,
        top_pfz=top_pfz,
        geofence=geofence,
        safety_override_banner=safety_override,
        map_payload=map_payload,
        evidence_ledger=evidence_ledger,
    )


@app.get(
    "/api/v1/district-board",
    response_model=DistrictBoardResponse,
    summary="Coast-wide district authority board for all 12 Indian landing centres",
    tags=["District Authority"],
)
async def get_district_board(
    vessel_type: VesselType = Query(VesselType.COUNTRY_CRAFT, description="Vessel type"),
) -> DistrictBoardResponse:
    """
    Returns coast-wide 0-100 Sea-Venture Safety Indices, active advisories,
    wave heights, wind speeds, and boundary proximity for all 12 major Indian landing centres.
    Designed for harbour masters, fisheries departments, and district disaster management rooms.
    """
    harbours_dict = load_harbours_dict()
    summaries = []

    for h in harbours_dict.values():
        metrics = get_fallback_marine_and_weather(h.lat, h.lon)
        safety_status, advisory, _, _, cb_triggered = assess_vessel_safety(metrics, vessel_type)
        safety_index, risk_verdict = calculate_sea_venture_safety_index(metrics, vessel_type)

        geofence = check_geofence(h.lon, h.lat)
        if geofence.is_violation or geofence.alert_level == "CRITICAL":
            safety_index = max(safety_index, 92)
            risk_verdict = "EXTREME"
            safety_status = SafetyLevel.RED_ALERT
            cb_triggered = True

        summaries.append(
            DistrictHarbourSummary(
                harbour_id=h.id,
                harbour_name=h.name,
                local_name=h.local_name,
                state=h.state,
                lat=h.lat,
                lon=h.lon,
                safety_index=safety_index,
                risk_verdict=risk_verdict,
                safety_status=safety_status,
                wave_height_m=metrics["wave_height_m"],
                wind_speed_kmh=metrics["wind_speed_kmh"],
                nearest_boundary_distance_nm=geofence.distance_nm,
                active_advisory=advisory,
                circuit_breaker_triggered=cb_triggered,
            )
        )

    return DistrictBoardResponse(
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        total_landing_centres=len(summaries),
        harbours=summaries,
    )


@app.get(
    "/api/v1/demo-scenario",
    response_model=ChatResponse,
    summary="Trigger locked zero-key evaluation scenario for hackathon judges",
    tags=["Demo Scenarios"],
)
async def get_demo_scenario(
    scenario: str = Query("safe", description="Scenario key: safe | danger | cyclone | pfz | route"),
) -> ChatResponse:
    """
    Serves the 5 canonical SIH26176 evaluation scenarios for instant judge demonstration:
    - safe: Goa / Malvan calm departure (LOW risk)
    - danger: Mumbai 06:00 IST morning wind-wave shear (HIGH risk)
    - cyclone: Paradip cyclonic swell surge (EXTREME risk)
    - pfz: Rameswaram high-confidence biophysical PFZ discovery
    - route: Chennai wave-aware A* safe routing
    """
    scenarios = {
        "safe": ChatRequest(
            message="Is it safe for a small motorized boat to venture into the sea tomorrow morning off the coast?",
            harbour_id="malvan",
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        "danger": ChatRequest(
            message="Can a country craft venture out of Mumbai harbour with 34 km/h wind shear and 1.9m wave height?",
            harbour_id="mumbai",
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        "cyclone": ChatRequest(
            message="Severe weather alert off Paradip coast: wave height 3.8m, wind gusts 65 km/h, swell period 15s. Should vessels venture?",
            harbour_id="paradip",
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        "pfz": ChatRequest(
            message="Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.",
            harbour_id="rameswaram",
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        "route": ChatRequest(
            message="Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.",
            harbour_id="chennai",
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
    }

    req = scenarios.get(scenario.lower())
    if not req:
        req = scenarios["safe"]

    return await run_orchestrator(req)


@app.get("/api/v1/geofences/imbl", summary="Get IMBL GeoJSON", tags=["Geofences"])
async def get_imbl_geofence() -> Dict[str, Any]:
    """Returns Indo-Sri Lanka and Indo-Pak IMBL boundaries as GeoJSON."""
    with open(IMBL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/v1/geofences/mpa", summary="Get MPA GeoJSON", tags=["Geofences"])
async def get_mpa_geofence() -> Dict[str, Any]:
    """Returns Marine Protected Area polygons as GeoJSON."""
    with open(MPA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post(
    "/api/v1/chat",
    response_model=ChatResponse,
    summary="Multi-agent conversational reasoning endpoint",
    tags=["Multi-Agent Reasoning"],
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Main conversational agent endpoint for SIH 2026 Problem Statement #20.
    Executes Planner -> Parallel Specialist Agents -> Safety Circuit Breaker -> Synthesis Agent.
    """
    try:
        response = await run_orchestrator(request)
        return response
    except Exception as e:
        logger.exception("Error executing multi-agent orchestrator: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent orchestrator encountered an unexpected error: {str(e)}",
        )
