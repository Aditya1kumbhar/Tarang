"""
ORCA FastAPI Backend Server (SIH 2026 Problem Statement ID 26176 / SIH26176).
Provides production-grade REST APIs for multi-agent reasoning, live harbour status,
dashboard summaries, and maritime safety overrides with strict security guardrails.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, time as dt_time, timedelta, timezone
import hashlib
import json
import logging
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.auth import (
    DevLoginRequest,
    GoogleAuthRequest,
    UserSession,
    clear_session_cookie,
    create_session_token,
    get_current_user,
    set_session_cookie,
    verify_google_id_token,
)
from backend.rate_limiter import get_real_client_ip, limiter

# Prevent duplicate route limit accumulation across module reloads or worker init
if hasattr(limiter, "_route_limits"):
    limiter._route_limits.clear()
from backend.agents.orchestrator import run_orchestrator
from backend.agents.prompts import get_safety_override_banner
from backend.config import (
    AI_CACHE_TTL_SECONDS,
    AI_DAILY_BUDGET,
    AI_TIMEOUT_SECONDS,
    ALLOWED_ORIGINS,
    ALLOW_DEV_LOGIN,
    AUTH_SECRET,
    AUTHORIZED_EMAILS,
    DASHBOARD_TIMEOUT_SECONDS,
    ENVIRONMENT,
    GOOGLE_CLIENT_ID,
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
from backend.tools.marine_cache import (
    compute_pfz_zones_sync_fallback,
    marine_cache,
)
from backend.tools.ocean_pfz_tool import compute_pfz_zones, load_harbours_dict
from backend.tools.satellite_erddap import fetch_chl_grid, fetch_sst_grid
from backend.tools.weather_marine_tool import (
    assess_vessel_safety,
    calculate_sea_venture_safety_index,
    fetch_live_marine_and_weather,
    get_fallback_marine_and_weather,
    get_weather_marine_report,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orca_api")

_warmup_task: Optional[asyncio.Task] = None


def _get_tomorrow_0600_ist_utc() -> datetime:
    """Returns UTC datetime corresponding to tomorrow 06:00 IST."""
    now_utc = datetime.now(timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = now_utc.astimezone(ist_tz)
    tomorrow_ist_date = (now_ist + timedelta(days=1)).date()
    tomorrow_0600_ist = datetime.combine(tomorrow_ist_date, dt_time(6, 0), tzinfo=ist_tz)
    return tomorrow_0600_ist.astimezone(timezone.utc)


async def _warm_all_harbours_background() -> None:
    """
    Non-blocking background warmup for all 12 harbours:
    (a) fetch_live_marine_and_weather for current hour and tomorrow 06:00 IST (exact chat cache keys)
    (b) fetch_sst_grid and fetch_chl_grid for each harbour's bounding box (populating 6h ERDDAP caches).
    Periodic refresh: every 10 minutes, re-runs weather warmup for current and tomorrow 06:00 IST keys.
    Warmup failures are logged, never fatal, and do not delay application startup.
    """
    harbours = list(load_harbours_dict().values())
    logger.info("Starting background cache warmup for %d harbours...", len(harbours))
    tomorrow_dt = _get_tomorrow_0600_ist_utc()

    for h in harbours:
        try:
            await asyncio.gather(
                fetch_live_marine_and_weather(h.lat, h.lon, target_dt=None),
                fetch_live_marine_and_weather(h.lat, h.lon, target_dt=tomorrow_dt),
                fetch_sst_grid(h.lat, h.lon),
                fetch_chl_grid(h.lat, h.lon),
                return_exceptions=True,
            )
        except Exception as e:
            logger.warning("Initial cache warmup failed for harbour '%s': %s", h.id, e)

    logger.info("Initial background cache warmup completed for %d harbours.", len(harbours))

    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            t_dt = _get_tomorrow_0600_ist_utc()
            logger.info("Running 10-minute periodic weather cache refresh for all 12 harbours...")
            for h in harbours:
                try:
                    await asyncio.gather(
                        fetch_live_marine_and_weather(h.lat, h.lon, target_dt=None),
                        fetch_live_marine_and_weather(h.lat, h.lon, target_dt=t_dt),
                        return_exceptions=True,
                    )
                except Exception as e:
                    logger.warning("Periodic weather cache refresh failed for harbour '%s': %s", h.id, e)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Periodic cache refresh loop encountered error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _warmup_task
    logger.info("Initializing ORCA Multi-Agent Maritime Backend (Environment: %s)...", ENVIRONMENT)
    load_harbours_dict()
    marine_cache.start_background_tasks()
    _warmup_task = asyncio.create_task(_warm_all_harbours_background())
    logger.info("Harbour caches pre-warmed successfully. CORS allowlist: %s", ALLOWED_ORIGINS)
    yield
    if _warmup_task and not _warmup_task.done():
        _warmup_task.cancel()
    marine_cache.stop_background_tasks()
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
    title="ORCA: Marine EcOsystem Reasoning with Collaborative Agents API",
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

    # 3. Strict Security Headers (SECURITY_HEADERS Requirement + Google GIS)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com/gsi/client; "
        "frame-src 'self' https://accounts.google.com/gsi/ https://accounts.google.com; "
        "connect-src 'self' https://accounts.google.com/gsi/ https://oauth2.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://accounts.google.com/gsi/style; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https: https://lh3.googleusercontent.com;"
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
        401: "unauthorized",
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
    _fonts_dir = _DIST_DIR / "fonts"
    if _fonts_dir.exists():
        app.mount("/fonts", StaticFiles(directory=str(_fonts_dir)), name="fonts")


# ==============================================================================
# API ROUTES
# ==============================================================================

@app.api_route("/api/v1/health", methods=["GET", "HEAD"], summary="Health check", tags=["System"])
async def health_check(request: Request) -> Dict[str, Any]:
    """Returns service health status and timestamp."""
    return {
        "status": "healthy",
        "service": "ORCA Multi-Agent Backend",
        "version": "1.0.0",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


# ==============================================================================
# AUTHENTICATION ROUTES (Google Identity Services & Session Management)
# ==============================================================================

@app.get("/api/v1/auth/config", summary="Get Google OAuth Configuration", tags=["Authentication"])
@limiter.limit("60/minute")
async def get_auth_config(request: Request):
    """Returns Google Client ID and whether Google authentication is active."""
    if IS_PRODUCTION and not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable: Google OAuth is not configured in production.",
        )
    return {
        "google_client_id": GOOGLE_CLIENT_ID,
        "is_configured": bool(GOOGLE_CLIENT_ID),
        "environment": ENVIRONMENT,
    }


@app.post("/api/v1/auth/google", summary="Authenticate via Google OAuth ID Token", tags=["Authentication"])
@limiter.limit("20/minute")
async def google_auth_login(request: Request, body: GoogleAuthRequest, response: Response):
    """
    Verifies a Google OAuth2 ID Token (from Google Identity Services GIS)
    against Google's tokeninfo API, establishes an HMAC-signed session,
    and sets an HttpOnly session cookie.
    """
    if IS_PRODUCTION and not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable: Google OAuth is not configured in production.",
        )
    user = await verify_google_id_token(body.credential, client_id=GOOGLE_CLIENT_ID)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google credential. Please authenticate again.",
        )

    # Enforce Authorized Emails Allowlist when configured
    if AUTHORIZED_EMAILS:
        allowed_list = [e.strip().lower() for e in AUTHORIZED_EMAILS.split(",") if e.strip()]
        if user.email.lower() not in allowed_list:
            logger.warning("FORBIDDEN_LOGIN_ATTEMPT: %s not in AUTHORIZED_EMAILS", user.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Google account '{user.email}' is not on the authorized maritime access list.",
            )

    token = create_session_token(user.model_dump())
    set_session_cookie(response, token)
    return {
        "status": "success",
        "user": user.model_dump(),
        "token": token,
    }


if ALLOW_DEV_LOGIN:
    @app.post("/api/v1/auth/dev-login", summary="Authorized Developer / Evaluation Login", tags=["Authentication"])
    @limiter.limit("20/minute")
    async def dev_auth_login(request: Request, body: DevLoginRequest, response: Response):
        """
        Authorized login for local evaluation and testing environments when GOOGLE_CLIENT_ID
        has not yet been provisioned in Google Cloud Console.
        Only registered in non-production when DEV_LOGIN_ENABLED=true.
        """
        now = int(time.time())
        email = body.email or "maritime.officer@nic.in"
        name = body.name or "Authorized Maritime Officer"
        user = UserSession(
            email=email,
            name=name,
            picture=None,
            sub=f"dev_user_{hashlib.md5(email.encode()).hexdigest()[:8]}",
            issued_at=now,
            expires_at=now + 7 * 86400,
        )
        token = create_session_token(user.model_dump())
        set_session_cookie(response, token)
        return {
            "status": "success",
            "user": user.model_dump(),
            "token": token,
        }


@app.get("/api/v1/auth/me", summary="Get Current Authenticated User Session", tags=["Authentication"])
@limiter.limit("60/minute")
async def get_current_user_profile(request: Request, user: UserSession = Depends(get_current_user)):
    """Verifies that the caller has a valid session and returns their user profile."""
    return {
        "status": "authenticated",
        "user": user.model_dump(),
    }


@app.post("/api/v1/auth/logout", summary="Logout & Invalidate Session", tags=["Authentication"])
async def logout_user(response: Response):
    """Clears the HttpOnly session cookie and logs out the user."""
    clear_session_cookie(response)
    return {"status": "logged_out"}


@app.get("/api/v1/harbours", response_model=List[HarbourInfo], summary="List Indian fishing landing centres", tags=["Harbours"])
async def list_harbours(request: Request, current_user: UserSession = Depends(get_current_user)) -> List[HarbourInfo]:
    """
    Returns the 12 major Indian fishing landing centres with coordinates,
    state, and primary regional language metadata.
    """
    harbours_dict = load_harbours_dict()
    return list(harbours_dict.values())


_LAST_DASHBOARD_SUMMARIES: Dict[Tuple[str, str], DashboardSummaryResponse] = {}


def _build_fallback_dashboard_summary(
    harbour: HarbourInfo, vessel_type: VesselType
) -> DashboardSummaryResponse:
    """Builds a deterministic fallback dashboard summary without raising exceptions."""
    metrics = get_fallback_marine_and_weather(harbour.lat, harbour.lon)
    safety_status, advisory, is_kal, is_light, cb_trig = assess_vessel_safety(metrics, vessel_type)
    idx, verdict = calculate_sea_venture_safety_index(metrics, vessel_type)
    now_utc_str = datetime.now(timezone.utc).isoformat()
    weather = WeatherHazardReport(
        harbour_id=harbour.id,
        harbour_name=harbour.name,
        latitude=harbour.lat,
        longitude=harbour.lon,
        vessel_type=vessel_type,
        wave_height_m=metrics["wave_height_m"],
        wind_speed_kmh=metrics["wind_speed_kmh"],
        wind_gusts_kmh=metrics["wind_gusts_kmh"],
        wave_direction_deg=metrics["wave_direction_deg"],
        wave_period_s=metrics["wave_period_s"],
        swell_wave_height_m=metrics["swell_wave_height_m"],
        swell_wave_period_s=metrics["swell_wave_period_s"],
        ocean_current_velocity_ms=metrics["ocean_current_velocity_ms"],
        cape_j_kg=metrics["cape_j_kg"],
        weather_code=metrics["weather_code"],
        safety_status=safety_status,
        sea_venture_safety_index=idx,
        risk_verdict=verdict,
        advisory_message=advisory,
        is_kallakkadal_risk=is_kal,
        is_lightning_risk=is_light,
        circuit_breaker_triggered=cb_trig,
        provenance={
            "source_dataset": metrics["source"],
            "timestamp_utc": now_utc_str,
            "coordinates": [harbour.lat, harbour.lon],
            "confidence_score": 0.82,
            "data_mode": "FALLBACK_SNAPSHOT",
            "reasoning_trace": "Deterministic climatological Indian Ocean baseline",
        },
        evidence_ledger_entry={
            "parameter_name": "Significant Wave Height & Coastal Surface Wind",
            "source_sensor": "Climatological Regional Baseline",
            "platform_mission": "Verified Regional Cartography Snapshot",
            "timestamp_utc": now_utc_str,
            "spatial_resolution": "5.0 km coastal grid",
            "confidence_tier": "Medium",
            "data_mode": "FALLBACK_SNAPSHOT",
            "freshness_age_minutes": 120.0,
            "station_id": f"IN-{harbour.id.upper()[:4]}-MET",
            "anomaly_note": "Deterministic vessel safety engine evaluated from offline baseline",
        },
    )
    pfz_report = compute_pfz_zones_sync_fallback(harbour)
    top_pfz = pfz_report.top_recommendation
    geofence = check_geofence(harbour.lon, harbour.lat)

    safety_override = None
    if weather.safety_status == SafetyLevel.RED_ALERT or geofence.alert_level == "CRITICAL":
        safety_override = get_safety_override_banner("RED_ALERT", "en")
    elif weather.safety_status == SafetyLevel.AMBER or geofence.alert_level == "WARNING":
        safety_override = get_safety_override_banner("AMBER", "en")

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
        weather_data_mode="FALLBACK_SNAPSHOT",
        pfz_data_mode="FALLBACK_SNAPSHOT",
        satellite_timestamp=None,
        weather_timestamp=now_utc_str,
    )


async def _compute_dashboard_summary_impl(
    harbour: HarbourInfo, vessel_type: VesselType
) -> DashboardSummaryResponse:
    # 1 & 2. Read from shared marine data cache (cache-first, bounded warm if cold)
    cached_entry = await marine_cache.get_or_refresh_harbour(harbour, max_refresh_timeout=12.0)
    weather = cached_entry.weather_by_vessel.get(vessel_type.value)
    if not weather:
        weather = await get_weather_marine_report(
            lat=harbour.lat,
            lon=harbour.lon,
            harbour_id=harbour.id,
            harbour_name=harbour.name,
            vessel_type=vessel_type,
        )
        cached_entry.weather_by_vessel[vessel_type.value] = weather

    pfz_report = cached_entry.pfz_report
    top_pfz = pfz_report.top_recommendation if pfz_report else None

    # 3. Geofence Check
    geofence = cached_entry.geofence or check_geofence(harbour.lon, harbour.lat)

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

    weather_data_mode = cached_entry.weather_data_mode
    if weather and weather.evidence_ledger_entry:
        weather_data_mode = weather.evidence_ledger_entry.data_mode
        weather_timestamp = weather.evidence_ledger_entry.timestamp_utc
    else:
        weather_timestamp = cached_entry.weather_timestamp

    pfz_data_mode = cached_entry.pfz_data_mode
    satellite_timestamp = cached_entry.satellite_timestamp
    if not satellite_timestamp and top_pfz and top_pfz.evidence_ledger_entry:
        satellite_timestamp = top_pfz.evidence_ledger_entry.timestamp_utc

    return DashboardSummaryResponse(
        harbour=harbour,
        weather=weather,
        top_pfz=top_pfz,
        geofence=geofence,
        safety_override_banner=safety_override,
        map_payload={"type": "FeatureCollection", "features": map_features},
        evidence_ledger=evidence_entries,
        weather_data_mode=weather_data_mode,
        pfz_data_mode=pfz_data_mode,
        satellite_timestamp=satellite_timestamp,
        weather_timestamp=weather_timestamp,
    )


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
    current_user: UserSession = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """
    Retrieves an immediate snapshot of live marine weather, top PFZ zone,
    geofence status, and map payload for dashboard views without full chat reasoning.
    Strictly validates harbour_id and vessel_type against allowlists (INPUT_VALIDATION).
    Enforces DASHBOARD_TIMEOUT_SECONDS deadline and returns last good summary on timeout.
    """
    harbours = load_harbours_dict()
    harbour = harbours.get(harbour_id.value)
    if not harbour:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Harbour '{harbour_id.value}' not found in registry."
        )

    summary_key = (harbour.id, vessel_type.value)
    try:
        summary = await asyncio.wait_for(
            _compute_dashboard_summary_impl(harbour, vessel_type),
            timeout=DASHBOARD_TIMEOUT_SECONDS,
        )
        _LAST_DASHBOARD_SUMMARIES[summary_key] = summary
        return summary
    except asyncio.TimeoutError:
        logger.warning(
            "Dashboard summary for %s (%s) exceeded %ss timeout",
            harbour.id,
            vessel_type.value,
            DASHBOARD_TIMEOUT_SECONDS,
        )
        if summary_key in _LAST_DASHBOARD_SUMMARIES:
            logger.info("Returning last successful dashboard summary for %s (%s)", harbour.id, vessel_type.value)
            return _LAST_DASHBOARD_SUMMARIES[summary_key]
        return _build_fallback_dashboard_summary(harbour, vessel_type)


@app.get(
    "/api/v1/district-board",
    response_model=DistrictBoardResponse,
    summary="Get coast-wide district authority surveillance table",
    tags=["District Authority"],
)
async def get_district_board(
    request: Request,
    vessel_type: VesselType = Query(VesselType.COUNTRY_CRAFT, description="Vessel type profile"),
    current_user: UserSession = Depends(get_current_user),
) -> DistrictBoardResponse:
    """
    Returns immediate status, 0-100 Sea-Venture Safety Index, boundary clearance,
    and active advisories across all 12 Indian landing centres.
    Reads from shared marine cache when available, falling back to deterministic regional baseline.
    """
    harbours = list_harbours_sync()
    summaries: List[DistrictHarbourSummary] = []

    for h in harbours:
        cached_entry = marine_cache.get_entry(h.id)
        cached_weather = (
            cached_entry.weather_by_vessel.get(vessel_type.value)
            if cached_entry
            else None
        )

        if cached_weather:
            safety_status = cached_weather.safety_status
            advisory = cached_weather.advisory_message
            cb_triggered = cached_weather.circuit_breaker_triggered
            safety_index = cached_weather.sea_venture_safety_index
            risk_verdict = cached_weather.risk_verdict
            wave_h = cached_weather.wave_height_m
            wind_spd = cached_weather.wind_speed_kmh
            geofence = cached_entry.geofence or check_geofence(h.lon, h.lat)
        else:
            metrics = get_fallback_marine_and_weather(h.lat, h.lon)
            safety_status, advisory, _, _, cb_triggered = assess_vessel_safety(metrics, vessel_type)
            safety_index, risk_verdict = calculate_sea_venture_safety_index(metrics, vessel_type)
            wave_h = metrics["wave_height_m"]
            wind_spd = metrics["wind_speed_kmh"]
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
                wave_height_m=wave_h,
                wind_speed_kmh=wind_spd,
                nearest_boundary_distance_nm=geofence.distance_nm,
                active_advisory=advisory,
                circuit_breaker_triggered=cb_triggered,
            )
        )

    return DistrictBoardResponse(
        timestamp_utc=datetime.now(timezone.utc).isoformat(),
        total_landing_centres=len(summaries),
        harbours=summaries,
        data_mode="BASELINE",
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
    scenario: ScenarioType = Query(ScenarioType.SAFE, description="Scenario key: safe | danger | cyclone | pfz | route | conditions | alerts | chlorophyll_sst"),
    current_user: UserSession = Depends(get_current_user),
) -> ChatResponse:
    """
    Serves the canonical SIH26176 evaluation scenarios with strict enum validation (INPUT_VALIDATION):
    - safe: Goa / Malvan calm departure (LOW risk)
    - danger: Mumbai 06:00 IST morning wind-wave shear (HIGH risk)
    - cyclone: Paradip cyclonic swell surge (EXTREME risk)
    - pfz: Rameswaram high-confidence biophysical PFZ discovery
    - route: Chennai wave-aware A* safe routing
    - conditions: Veraval tide, weather, and sea conditions
    - alerts: Paradip convective lightning and cyclone alerts
    - chlorophyll_sst: Visakhapatnam chlorophyll-a & SST region ranking
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
        ScenarioType.CONDITIONS: ChatRequest(
            message="What are the tide, weather, and sea conditions near my fishing location?",
            harbour_id=HarbourID.VERAVAL,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.ALERTS: ChatRequest(
            message="Are there any lightning or cyclone alerts in my area?",
            harbour_id=HarbourID.PARADIP,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
        ScenarioType.CHLOROPHYLL_SST: ChatRequest(
            message="Which regions show high chlorophyll concentration and favourable sea surface temperature?",
            harbour_id=HarbourID.VISAKHAPATNAM,
            vessel_type=VesselType.COUNTRY_CRAFT,
        ),
    }

    req = scenarios[scenario]
    return await run_orchestrator(req)


@app.get("/api/v1/geofences/imbl", summary="Get IMBL GeoJSON", tags=["Geofences"])
async def get_imbl_geofence(request: Request, current_user: UserSession = Depends(get_current_user)) -> Dict[str, Any]:
    """Returns Indo-Sri Lanka and Indo-Pak IMBL boundaries as GeoJSON."""
    with open(IMBL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/v1/geofences/mpa", summary="Get MPA GeoJSON", tags=["Geofences"])
async def get_mpa_geofence(request: Request, current_user: UserSession = Depends(get_current_user)) -> Dict[str, Any]:
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
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    current_user: UserSession = Depends(get_current_user),
) -> ChatResponse:
    """
    Main conversational agent endpoint for SIH 2026 Problem Statement ID 26176 (SIH26176).
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
@app.api_route("/{full_path:path}", methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], include_in_schema=False)
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

    # 3. Non-API routes only permit GET and HEAD
    if request.method not in ["GET", "HEAD"]:
        return JSONResponse(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            content={"detail": "Method not allowed", "error": "method_not_allowed"},
            headers={"Cache-Control": "no-store"},
        )

    # 4. Static Files & SPA index.html
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
