"""
ORCA FastAPI Backend Server (SIH 2026 PS #20 / ID 26176).
Provides production-grade REST APIs for multi-agent reasoning, live harbour status,
dashboard summaries, and maritime safety overrides with strict security guardrails.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import json
import logging
from pathlib import Path
import time
from typing import Any, Dict, List, Tuple

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.rate_limiter import get_real_client_ip, limiter
from backend.agents.orchestrator import run_orchestrator
from backend.agents.prompts import get_safety_override_banner
from backend.config import (
    AI_CACHE_TTL_SECONDS,
    AI_DAILY_BUDGET,
    AI_TIMEOUT_SECONDS,
    ALLOWED_ORIGINS,
    ENVIRONMENT,
    IMBL_FILE,
    IS_PRODUCTION,
    MPA_FILE,
)
from backend.schemas.models import (
    ChatRequest,
    ChatResponse,
    DashboardSummaryResponse,
    DistrictBoardResponse,
    DistrictHarbourSummary,
    HarbourID,
    HarbourInfo,
    SafetyLevel,
    ScenarioType,
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
    logger.info("Initializing ORCA Multi-Agent Maritime Backend (Environment: %s)...", ENVIRONMENT)
    load_harbours_dict()
    logger.info("Harbour caches pre-warmed successfully. CORS allowlist: %s", ALLOWED_ORIGINS)
    yield
    logger.info("Shutting down ORCA Backend.")


# ==============================================================================
# RATE LIMITER SETUP (Multi-worker shared storage across Uvicorn processes)
# ==============================================================================
# limiter and get_real_client_ip are imported from backend.rate_limiter


# ==============================================================================
# FASTAPI APPLICATION CREATION
# ==============================================================================
# Disable API docs when in production (DOCS_DISABLED_IN_PROD Requirement)
docs_url = None if IS_PRODUCTION else "/docs"
redoc_url = None if IS_PRODUCTION else "/redoc"
openapi_url = None if IS_PRODUCTION else "/openapi.json"

app = FastAPI(
    title="ORCA: Oceanographic Reasoning & Collaborative Agents API",
    description="Enterprise-grade Agentic AI Marine Intelligence Platform for Indian Fisheries & Coastal Safety",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    debug=not IS_PRODUCTION,
)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Strict CORS Allowlist (CORS Requirement)
# Never reflect arbitrary origins or use wildcard with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ==============================================================================
# SECURITY HEADERS, CACHE CONTROL & OBSERVABILITY MIDDLEWARE
# ==============================================================================
@app.middleware("http")
async def add_security_headers_and_observability_middleware(request: Request, call_next):
    """
    Applies strict CSP, anti-framing, HSTS, referrer, and cache-control headers
    while recording structured observability logs for every incoming request.
    """
    origin = request.headers.get("origin")
    client_ip = get_real_client_ip(request)
    t_start = time.perf_counter()

    # Enforce Content-Type robustness on POST /api/v1/chat (CONTENT_TYPE_ROBUSTNESS Requirement)
    if request.method == "POST" and request.url.path == "/api/v1/chat":
        ct = request.headers.get("content-type", "")
        if not ct or not ct.startswith("application/json"):
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content={
                    "detail": "Unsupported Media Type: Content-Type must be 'application/json'.",
                    "error": "unsupported_media_type",
                },
                headers={"Cache-Control": "no-store"},
            )

    response = await call_next(request)
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

    # 1. Enforce strict CORS allowlist: Never reflect arbitrary Origin or leak credentials
    if origin and origin not in ALLOWED_ORIGINS:
        if "access-control-allow-origin" in response.headers:
            del response.headers["access-control-allow-origin"]
        if "access-control-allow-credentials" in response.headers:
            del response.headers["access-control-allow-credentials"]

    # 2. Cloak server stack disclosure (SERVER_HEADER Requirement)
    if "server" in response.headers:
        del response.headers["server"]
    if "x-powered-by" in response.headers:
        del response.headers["x-powered-by"]
    response.headers["server"] = "webserver"

    # 3. Strict Security Headers (SECURITY_HEADERS Requirement)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; connect-src 'self'"
    )
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # 4. Response Hygiene: Cache-Control: no-store on all /api endpoints and SPA index.html (RESPONSE_HYGIENE Requirement)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    elif request.url.path == "/" or request.url.path.endswith(".html"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    # 5. Observability: Structured request logging with abuse detection (OBSERVABILITY Requirement)
    status_code = response.status_code
    log_line = f"{request.method} {request.url.path} -> {status_code} [{client_ip}] ({latency_ms}ms)"
    if status_code == 429 or status_code >= 500:
        logger.warning("OBSERVABILITY_ALERT: %s", log_line)
    else:
        logger.info("OBSERVABILITY: %s", log_line)

    return response


# ==============================================================================
# GLOBAL EXCEPTION HANDLERS (RESPONSE_HYGIENE & ERROR_HANDLING)
# Standardizes all error responses into {"detail": string, "error": machine_code}
# ==============================================================================
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Returns clean JSON error with HTTP 429 when rate limit is exceeded."""
    client_ip = get_real_client_ip(request)
    logger.warning("RATE_LIMIT_BREACH: 429 Too Many Requests for %s on %s", client_ip, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "error": "rate_limit_exceeded",
        },
        headers={"Cache-Control": "no-store"} if request.url.path.startswith("/api/") else None,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Rejects empty or oversized chat message payloads with HTTP 413,
    and returns HTTP 422 for other schema validation errors without leaking raw bytes.
    """
    if request.url.path.endswith("/chat"):
        for error in exc.errors():
            loc = error.get("loc", ())
            if "message" in loc:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={
                        "detail": "Payload too large or empty: 'message' is required and must not exceed 2000 characters.",
                        "error": "payload_too_large",
                    },
                    headers={"Cache-Control": "no-store"},
                )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Invalid request parameters or payload shape.",
            "error": "validation_error",
        },
        headers={"Cache-Control": "no-store"} if request.url.path.startswith("/api/") else None,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Standardizes all HTTPExceptions into the unified JSON error envelope."""
    code_map = {
        400: "bad_request",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "validation_error",
        429: "rate_limit_exceeded",
        500: "internal_server_error",
        503: "service_unavailable",
        504: "gateway_timeout",
    }
    err_code = code_map.get(exc.status_code, "http_error")
    headers = {"Cache-Control": "no-store"} if request.url.path.startswith("/api/") else None
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": err_code},
        headers=headers,
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    """Logs full trace internally but returns clean generic JSON to client in production."""
    logger.exception("Unhandled server error processing %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": "internal_server_error",
        },
        headers={"Cache-Control": "no-store"} if request.url.path.startswith("/api/") else None,
    )


# ==============================================================================
# STATIC SPA ASSETS & ROOT SERVING (Production Unified Mode)
# ==============================================================================
_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST_DIR.exists():
    _assets_dir = _DIST_DIR / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")


# ==============================================================================
# API ROUTES
# ==============================================================================

@app.get("/api/v1/health", summary="Health check", tags=["System"])
async def health_check(request: Request) -> Dict[str, Any]:
    """Returns service health status and timestamp."""
    return {
        "status": "healthy",
        "service": "ORCA Multi-Agent Backend",
        "version": "1.0.0",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/harbours", response_model=List[HarbourInfo], summary="List Indian fishing landing centres", tags=["Harbours"])
async def list_harbours(request: Request) -> List[HarbourInfo]:
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
    request: Request,
    harbour_id: HarbourID = Query(HarbourID.RAMESWARAM, description="Target harbour identifier"),
    vessel_type: VesselType = Query(VesselType.COUNTRY_CRAFT, description="Vessel type"),
) -> DashboardSummaryResponse:
    """
    Retrieves an immediate snapshot of live marine weather, top PFZ zone,
    geofence status, and map payload for dashboard views without full chat reasoning.
    Strictly validates harbour_id and vessel_type against allowlists (INPUT_VALIDATION).
    """
    harbours = load_harbours_dict()
    harbour = harbours.get(harbour_id.value)
    if not harbour:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Harbour '{harbour_id.value}' not found in registry."
        )

    # 1. Fetch Weather
    weather = await get_weather_marine_report(
        lat=harbour.lat,
        lon=harbour.lon,
        harbour_id=harbour.id,
        harbour_name=harbour.name,
        vessel_type=vessel_type,
    )

    # 2. Compute Top PFZ Zone
    pfz_report = compute_pfz_zones(harbour_id=harbour.id, max_candidates=1)
    top_pfz = pfz_report.top_recommendation

    # 3. Geofence Check
    geofence = check_geofence(harbour.lon, harbour.lat)

    # 4. Maritime Safety Override Banner
    safety_override = None
    if weather.safety_status == SafetyLevel.RED_ALERT or geofence.alert_level == "CRITICAL":
        safety_override = get_safety_override_banner("RED_ALERT", "en")
    elif weather.safety_status == SafetyLevel.AMBER or geofence.alert_level == "WARNING":
        safety_override = get_safety_override_banner("AMBER", "en")

    # 5. Build Map Payload
    map_features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [harbour.lon, harbour.lat]},
            "properties": {
                "entity": "harbour",
                "id": harbour.id,
                "name": harbour.name,
                "local_name": harbour.local_name,
                "state": harbour.state,
            },
        }
    ]
    if top_pfz:
        map_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [top_pfz.longitude, top_pfz.latitude],
                },
                "properties": {
                    "entity": "pfz_hotspot",
                    "pfz_score": top_pfz.pfz_score,
                    "bearing": top_pfz.bearing_cardinal,
                    "distance_km": top_pfz.distance_km,
                    "distance_nm": top_pfz.distance_nm,
                    "sst_c": top_pfz.sst_c,
                    "chla_mg_m3": top_pfz.chla_mg_m3,
                    "rationale": top_pfz.biological_rationale,
                },
            }
        )

    evidence_entries = []
    if weather.evidence_ledger_entry:
        evidence_entries.append(weather.evidence_ledger_entry)
    if top_pfz and top_pfz.evidence_ledger_entry:
        evidence_entries.append(top_pfz.evidence_ledger_entry)

    return DashboardSummaryResponse(
        harbour=harbour,
        weather=weather,
        top_pfz=top_pfz,
        geofence=geofence,
        safety_override_banner=safety_override,
        map_payload={"type": "FeatureCollection", "features": map_features},
        evidence_ledger=evidence_entries,
    )


@app.get(
    "/api/v1/district-board",
    response_model=DistrictBoardResponse,
    summary="Get coast-wide district authority surveillance table",
    tags=["District Authority"],
)
async def get_district_board(
    request: Request,
    vessel_type: VesselType = Query(VesselType.COUNTRY_CRAFT, description="Vessel type profile"),
) -> DistrictBoardResponse:
    """
    Returns immediate status, 0-100 Sea-Venture Safety Index, boundary clearance,
    and active advisories across all 12 Indian landing centres.
    """
    harbours = list_harbours_sync()
    summaries: List[DistrictHarbourSummary] = []

    for h in harbours:
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


def list_harbours_sync() -> List[HarbourInfo]:
    """Helper to return harbours synchronously for district board."""
    return list(load_harbours_dict().values())


@app.get(
    "/api/v1/demo-scenario",
    response_model=ChatResponse,
    summary="Trigger locked zero-key evaluation scenario for hackathon judges",
    tags=["Demo Scenarios"],
)
async def get_demo_scenario(
    request: Request,
    scenario: ScenarioType = Query(ScenarioType.SAFE, description="Scenario key: safe | danger | cyclone | pfz | route"),
) -> ChatResponse:
    """
    Serves the 5 canonical SIH26176 evaluation scenarios with strict enum validation (INPUT_VALIDATION):
    - safe: Goa / Malvan calm departure (LOW risk)
    - danger: Mumbai 06:00 IST morning wind-wave shear (HIGH risk)
    - cyclone: Paradip cyclonic swell surge (EXTREME risk)
    - pfz: Rameswaram high-confidence biophysical PFZ discovery
    - route: Chennai wave-aware A* safe routing
    """
    scenarios = {
        ScenarioType.SAFE: ChatRequest(
            message="Is it safe for a small motorized boat to venture into the sea tomorrow morning off the coast?",
            harbour_id=HarbourID.MALVAN,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.DANGER: ChatRequest(
            message="Can a country craft venture out of Mumbai harbour with 34 km/h wind shear and 1.9m wave height?",
            harbour_id=HarbourID.MUMBAI,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.CYCLONE: ChatRequest(
            message="Severe weather alert off Paradip coast: wave height 3.8m, wind gusts 65 km/h, swell period 15s. Should vessels venture?",
            harbour_id=HarbourID.PARADIP,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.PFZ: ChatRequest(
            message="Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour.",
            harbour_id=HarbourID.RAMESWARAM,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.ROUTE: ChatRequest(
            message="Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas.",
            harbour_id=HarbourID.CHENNAI,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
    }

    req = scenarios[scenario]
    return await run_orchestrator(req)


@app.get("/api/v1/geofences/imbl", summary="Get IMBL GeoJSON", tags=["Geofences"])
async def get_imbl_geofence(request: Request) -> Dict[str, Any]:
    """Returns Indo-Sri Lanka and Indo-Pak IMBL boundaries as GeoJSON."""
    with open(IMBL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/v1/geofences/mpa", summary="Get MPA GeoJSON", tags=["Geofences"])
async def get_mpa_geofence(request: Request) -> Dict[str, Any]:
    """Returns Marine Protected Area polygons as GeoJSON."""
    with open(MPA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# In-memory 5-minute response cache for identical queries (AI_COST_GUARDRAILS Requirement)
_CHAT_CACHE: Dict[str, Tuple[float, ChatResponse]] = {}


@app.post(
    "/api/v1/chat",
    response_model=ChatResponse,
    summary="Multi-agent conversational reasoning endpoint",
    tags=["Multi-Agent Reasoning"],
)
@limiter.limit("10/minute")
async def chat_endpoint(request: Request, chat_request: ChatRequest) -> ChatResponse:
    """
    Main conversational agent endpoint for SIH 2026 Problem Statement #20.
    - Content-Type validation: requires application/json (HTTP 415 on mismatch).
    - Rate limited to 10 requests/minute per IP across all uvicorn workers.
    - Rejects empty/whitespace or oversized message (>2000 chars) with HTTP 413.
    - Global daily AI budget limit (HTTP 503 when exhausted).
    - 5-minute request caching for identical queries.
    - Server-side execution timeout with sanitized errors.
    """
    # 1. Content-Type Robustness (CONTENT_TYPE_ROBUSTNESS Requirement)
    content_type = request.headers.get("content-type", "")
    if not content_type or not content_type.startswith("application/json"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported Media Type: Content-Type must be 'application/json'.",
        )

    # 2. Input Length Bounds (CHAT_INPUT_VALIDATION Requirement)
    if not chat_request.message or not chat_request.message.strip() or len(chat_request.message) > 2000:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Payload too large: 'message' is required and must not exceed 2000 characters.",
        )

    # 3. 5-Minute Request Caching (AI_COST_GUARDRAILS Requirement)
    h_val = chat_request.harbour_id.value if chat_request.harbour_id else "rameswaram"
    v_val = chat_request.vessel_type.value if chat_request.vessel_type else "country_craft"
    lang_val = chat_request.language or "en"
    cache_key = hashlib.sha256(
        f"{chat_request.message.strip().lower()}|{h_val}|{v_val}|{lang_val}".encode("utf-8")
    ).hexdigest()

    now = time.time()
    cached = _CHAT_CACHE.get(cache_key)
    if cached and (now - cached[0]) < AI_CACHE_TTL_SECONDS:
        logger.info("Serving 5-minute cached AI chat response for key %s", cache_key[:8])
        return cached[1]

    # 4. Daily AI-Call Budget Enforcement (AI_COST_GUARDRAILS Requirement)
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    budget_key = f"AI_DAILY_BUDGET:{today_utc}"
    daily_ai_calls = limiter._storage.get(budget_key)
    if daily_ai_calls >= AI_DAILY_BUDGET:
        logger.warning("AI DAILY BUDGET EXHAUSTED: %s/%s calls used for %s", daily_ai_calls, AI_DAILY_BUDGET, today_utc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Daily AI reasoning budget reached ({AI_DAILY_BUDGET} queries/day). System remains available for deterministic safety and harbour queries. Resets at 00:00 UTC.",
        )

    try:
        # Enforce server-side timeout to avoid hanging AI calls (CHAT_INPUT_VALIDATION)
        response = await asyncio.wait_for(
            run_orchestrator(chat_request),
            timeout=AI_TIMEOUT_SECONDS,
        )
        # Record successful AI query in budget & cache
        limiter._storage.incr(budget_key, expiry=86400 * 2)
        _CHAT_CACHE[cache_key] = (now, response)
        return response
    except asyncio.TimeoutError:
        logger.error("Chat orchestrator timed out after %s seconds", AI_TIMEOUT_SECONDS)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The marine reasoning engine timed out while analyzing ocean telemetry. Please try again.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error executing multi-agent orchestrator: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process reasoning query at this time. Please try again later.",
        )


# ==============================================================================
# SPA FALLBACK HANDLER (Serves index.html for frontend client-side routes)
# Enforces strict API 404 hygiene (API_404_HYGIENE Requirement)
# ==============================================================================
@app.get("/{full_path:path}", include_in_schema=False)
@limiter.exempt
async def serve_spa_fallback(full_path: str, request: Request):
    """
    Serves static files or index.html for single-page application routing.
    Enforces strict API 404 hygiene:
    - Any request to /api/* returns a JSON 404, never index.html.
    - In production, /docs, /redoc, /openapi.json return JSON 404.
    - Missing static files return JSON 404.
    - Only non-API client-side SPA navigation paths receive index.html.
    """
    clean_path = full_path.strip("/")

    # 1. API 404 Hygiene: Never serve HTML on unknown API routes
    if clean_path == "api" or clean_path.startswith("api/"):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Not found", "error": "not_found"},
            headers={"Cache-Control": "no-store"},
        )

    # 2. Return 404 for API blueprint routes when disabled in production (DOCS_DISABLED_IN_PROD)
    if IS_PRODUCTION and clean_path in ["docs", "redoc", "openapi.json"]:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "Not found", "error": "not_found"},
            headers={"Cache-Control": "no-store"},
        )

    # 3. Static Files & SPA index.html
    if _DIST_DIR.exists():
        target_file = _DIST_DIR / full_path
        if full_path and target_file.exists() and target_file.is_file():
            return FileResponse(target_file)

        # Asset requests with extensions that don't exist return a real 404
        if "." in Path(clean_path).name and not clean_path.endswith(".html"):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Not found", "error": "not_found"},
            )

        index_file = _DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(
                index_file,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": "Not found", "error": "not_found"},
    )
