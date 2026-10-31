# PROJECT_STATE.md: ORCA Marine Ecosystem Reasoning (SIH 2026 Problem Statement ID 26176 / SIH26176)

## 1. Architectural Blueprint
- **Platform:** ORCA (Marine EcOsystem Reasoning with Collaborative Agents) for SIH 2026 Problem Statement ID 26176 (SIH26176).
  - **Organization:** Indian Space Research Organisation (ISRO), Department of Space
  - **Theme:** Miscellaneous
  - **Product Tagline:** Autonomous Marine Intelligence & Decision-Support Platform for Indian Fisheries, Coastal Authorities, and Disaster Management
- **Neuro-Symbolic Division:** Deterministic Python tools calculate all math, bearings, geofences, and safety indices (`pyproj`, `shapely`, `numpy`, `networkx`). LLMs (Gemini / fallback synthesizer) only orchestrate intent and multilingual explanation.
- **Circuit Breaker:** Hard-coded fail-safe locks `RED_ALERT` banner when wave height, wind, Kallakkadal swell, CAPE lightning, or IMBL boundary (<1.5 NM) breaches thresholds.

## 2. Directory & Component Registry
### Backend (`backend/`)
- `auth.py`: Cryptographic session token manager (HMAC-SHA256 with constant-time comparison), Google Identity Services token verification via Google OAuth2 tokeninfo, FastAPI `get_current_user` dependency, and secure `HttpOnly` cookie issuance/clearing.
- `main.py`: FastAPI routes (`/api/v1/health`, `/api/v1/auth/*`, `/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/demo-scenario`, `/api/v1/geofences/*`), Content Security Policy expanded for Google Identity Services domains (`accounts.google.com`, `oauth2.googleapis.com`, `lh3.googleusercontent.com`).
- `config.py`: Calibrated safety thresholds, vessel safety matrices (`country_craft` vs `mechanized_trawler`), timeouts, `GOOGLE_CLIENT_ID`, `AUTH_SECRET`.
- `schemas/models.py`: Pydantic v2 models (`AgentState`, `EvidenceLedgerEntry`, `DistrictBoardResponse`, `GeoJSON`, `ScenarioType`, `ChatResponse` and `DashboardSummaryResponse` with `pfz_data_mode`, `weather_data_mode`, `satellite_timestamp`, and `weather_timestamp`).
- `tools/weather_marine_tool.py`: Open-Meteo live API with closest-hour selection (current UTC hour or tomorrow 06:00 IST -> 00:30 UTC), synchronized marine and forecast hourly series, Kallakkadal surge/CAPE triggers, 0-100 Sea-Venture Safety Index.
- `tools/satellite_erddap.py`: NOAA CoastWatch ERDDAP client fetching live daily satellite Sea Surface Temperature (Coral Reef Watch 5km) and Chlorophyll-a (VIIRS 9km NRT gap-filled 4-axis grid) with 6-hr TTL in-memory cache and 20s timeout.
- `tools/ocean_pfz_tool.py`: Live NOAA ERDDAP satellite candidate grid generator with finite-difference thermal front gradient computation, nearest-neighbour chlorophyll merging (0.15° cutoff), composite scoring, and offline fallback snapshot (`Bundled offline snapshot (static)`).
- `tools/geospatial_tool.py`: PyProj geodesic calculations, Shapely IMBL/MPA geofencing, A* safe routing.
- `tools/productivity_tool.py`: Marine heatwave, HAB hypoxia, and cyclone turbidity decline diagnostics.
- `agents/orchestrator.py`: Multi-agent DAG (Planner -> Parallel Specialist Tools -> Safety Circuit Breaker -> Synthesis) with tomorrow-morning intent detection, async PFZ tool invocation, and complete data provenance exposure.
- `agents/prompts.py` & `agents/state.py`: Multilingual prompts, 10 language script detectors (en, ta, ml, te, kn, mr, gu, or, bn, hi), typed orchestrator state.
- `data/`: 12 Indian landing centres, `imbl_lines.geojson`, `mpa_zones.geojson`, and `indian_ocean_grid.json` offline fallback snapshot.

### Frontend (`frontend/src/`)
- `App.jsx`: Dual-persona layout (Fisher View vs District Authority Board), mandatory Google authentication gate (`!currentUser` full lockout barrier), authenticated user profile badge and sign-out in frosted header, theme toggle (Chart/Ocean), live data provenance tracking.
- `components/LoginPage.jsx`: Apple-grade Google Identity Services authentication portal, mandatory lockout gate, DPDP Act 2023 compliance notes, session persistence, dev login fallback.
- `components/MarineMap.jsx`: Leaflet GIS with 12 harbour pins, IMBL border + 5 NM buffer, MPAs, PFZ hotspots, A* route polyline.
- `components/ChatPanel.jsx`: Multilingual chat, 8 official SIH queries, 4 extended scenarios, 8 demo chips, 40px numeric safety dial, Web Speech TTS (10 languages), dynamic Data Provenance Badge (`LIVE: Open-Meteo + NOAA satellite (${satDate})` vs `FALLBACK DATA IN USE`), and interactive Evidence Ledger drawer displaying source and observation timestamp per entry.
- `components/DistrictAuthorityBoard.jsx`: Fleet surveillance table across all 12 Indian landing centres with state filtering.
- `components/AgentTraceDrawer.jsx`: Multi-agent DAG execution timeline, sub-second latency meters, Evidence Ledger viewer.
- `components/SafetyAlertBanner.jsx`: Non-overridable Red/Amber maritime safety advisory banner.

### Verification (`tests/`)
- `test_tools.py`: 33 unit tests covering deterministic marine tools, safety index tiers, 10 language script detectors, Part A2 48-hr Open-Meteo hourly selector series, Part B4 ERDDAP finite differences and 0.15° merge, and satellite mock success/fallback tests.
- `test_api.py`: 47 integration tests covering all 8 official SIH queries, 4 extended scenarios, security hardening, rate limiting, and dedicated Google authentication barrier tests.

### Production Deployment Assets
- `Dockerfile`: Multi-stage build (Node 22 builder -> Python 3.11-slim non-root runtime) serving both SPA and REST API.
- `.dockerignore`: Lean image exclusion filter (.venv, node_modules, .git, .pytest_cache).
- `build.sh`: Free-tier Render native build script (installs Python backend & builds Vite frontend).
- `frontend/vercel.json`: Clean SPA catch-all rewrite for optional decoupled Vercel deployment.
- `backend/main.py`: Enhanced with SPA fallback serving `frontend/dist/index.html` at `/` while retaining all `/api/v1/*` routes.

### Agent Rules & Skills Configuration (`.agents/` & `~/.config/antigravity/`)
- `.agents/rules/`:
  - `emil-apple-strict-lock.md`: 989-line always-on hard lock enforcing `apple-design` & `emil-design-eng` on all UI/CSS/frontend changes.
  - `opus-engine.md`: Principal distributed systems engineering protocol (atomicity, concurrency, blast-radius trace, and Section 9 zero-touch project auto-bootstrap).
  - `zero-trust-security.md`: Mandatory 20-point security checklist and audit receipt.
  - `ponytail.md`: Anti-complexity, pragmatic minimalism, and 7-rung decision ladder.
  - `windows-quota-guard.md` & `anti-vibe-design.md`: Platform encoding safety and anti-vibe design invariants.
- `.agents/skills/`: 28 installed skills, including all 15 canonical `emilkowalski/skills` (`animate`, `animate-expo`, `animation-performance`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `break-ui`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `mobile-native`, `pick-ui-library`, `prototype`, `review-animations`, `write-swift`) plus `fastapi`, `karpathy-guidelines`, `ponytail`, `test-driven-development`, etc.

## 3. Active Status & Operational Invariants
- **Phase Completion:** Phases 1 through 6 fully implemented and verified.
- **Automated Tests:** 80/80 tests passing (33 unit in `test_tools.py` + 47 integration in `test_api.py` covering all 8 official SIH queries, 4 extended scenarios, full master security hardening, rate limiting, and production auth fail-closed guarantees).
- **Verified Live Data Pipeline & True Provenance:**
  - Weather & Marine: Open-Meteo live API with closest-hour selection for current UTC hour or tomorrow morning (06:00 IST -> 00:30 UTC), eliminating the legacy index [0] bug.
  - Potential Fishing Zones: NOAA CoastWatch ERDDAP live daily satellite Sea Surface Temperature (Coral Reef Watch 5km) and Chlorophyll-a (VIIRS 9km NRT gap-filled 4-axis grid) with finite-difference thermal gradient calculation.
  - Offline Fallback Guarantee: On ANY network failure or empty satellite table, automatically falls back to bundled static grid labeled strictly as `Bundled offline snapshot (static)` with `FALLBACK_SNAPSHOT` mode; `INCOIS-NOAA Satellite Climatology` label completely eliminated.
  - UI Provenance Badge: Green `LIVE: Open-Meteo + NOAA satellite (${satDate})` when both feeds are live; amber `FALLBACK DATA IN USE` whenever either feed reports a fallback mode. Evidence Ledger drawer renders sensor source and observation timestamp per entry.
- **Production Dev-Login Backdoor Elimination & Fail-Closed Guardrails:**
  - Route Unregistration: `/api/v1/auth/dev-login` is completely unregistered from FastAPI when `ENVIRONMENT=production` (or whenever `DEV_LOGIN_ENABLED=true` is not explicitly set in development), guaranteeing HTTP 404 with standardized JSON error envelope (`{"detail": "Not found", "error": "not_found"}`).
  - Fail-Closed Auth: If `GOOGLE_CLIENT_ID` is missing or empty in production, sensitive auth endpoints (`/api/v1/auth/config`, `/api/v1/auth/google`) refuse requests with HTTP 503 (`service_unavailable`), strictly forbidding fallback logins.
  - Zero Bundle Footprint: The string `/api/v1/auth/dev-login` is dead-code eliminated from the frontend production build via compile-time `__DEV_LOGIN_ENABLED__` Vite flag, verified with zero occurrences in `frontend/dist/`.
- **Mandatory Google Authentication & Email Allowlist Barrier:** Strict access control enforced across entire stack. Unauthenticated visitors are locked out by `LoginPage.jsx` and cannot view map, chat, or district board. All sensitive backend endpoints require an HMAC-SHA256 signed `orca_session` cookie issued via Google Identity Services token verification or authorized officer sign-in. Zero tokens stored in `localStorage` (Zero-Trust Security Rule #14). Configurable `AUTHORIZED_EMAILS` allowlist strictly limits access to designated Google accounts with HTTP 403 Forbidden enforcement on unauthorized accounts.
- **Security Hardening (Render Production & Master Pass):** Enforced defense-in-depth zero-trust architecture:
  - Definitive rate limiting: `slowapi` + WAL-mode `SQLiteSharedStorage` (with optional Redis support via `REDIS_URL`): 10 req/min on `/api/v1/chat`, 120 req/min default on `/api/v1/*`.
  - Cloudflare & reverse-proxy IP extraction: `CF-Connecting-IP` top priority, right-to-left `X-Forwarded-For` traversal with private proxy stripping to prevent spoofing leftmost headers.
  - API 404 & Probe Hygiene: Unknown `/api/*` requests strictly return JSON 404 (`{"detail": "Not found", "error": "not_found"}`), never SPA HTML. Enabled HTTP `HEAD` support on `/` and `/api/v1/health` for Edge Tools, uptime probes, and CDN crawlers.
  - Content-Type Robustness: `POST /api/v1/chat` without `application/json` returns HTTP 415. Malformed bodies return HTTP 422 with zero 500 leaks.
  - AI Cost Guardrails: 5-minute request caching (`AI_CACHE_TTL_SECONDS=300`) and daily budget limit (`AI_DAILY_BUDGET=500`, HTTP 503 when exhausted).
  - LLM Hardening: System prompt defense against instructions inside data, server-side regex scans for API keys and prompt leakage, injection attempt logging.
  - Response Hygiene & Error Envelope: `Cache-Control: no-store` on all `/api/*` endpoints; standardized error envelope `{"detail": string, "error": machine_code}` across all status codes.
  - Observability: Structured request logging (method, path, status, IP, latency_ms) with 429 and 5xx alerts logged at WARNING level.
  - CI Pipeline & Dependency Security: GitHub Actions workflow (`.github/workflows/ci.yml`) enforcing zero-vulnerability `pip-audit --strict`, `npm audit --audit-level=critical`, comprehensive test suite, and production rate limiting verification script, with `workflow_dispatch` and `permissions: contents: read`. Dependencies explicitly pinned with `fastapi==0.159.1`, `starlette>=1.3.1` (`1.9.0`), `pytest>=9.0.3` (`9.1.1`), and `pytest-asyncio==1.4.0` with clean local and CI pip-audit parity.
- **Backend Server:** Live daemon running on `http://127.0.0.1:8000` (auto-reload active).
- **Frontend Server:** Live Vite dev server running on `http://localhost:5173`.
- **Live Production Deployment:** Verified active on Render at `https://tarang-0v0t.onrender.com` (serving unified SPA + FastAPI REST API with live Gemini & Open-Meteo integration).
- **Apple MacBook Pro Liquid Retina XDR Display Aesthetic:** Upgraded the entire frontend interface with Apple's iconic Liquid Retina XDR display engineering standards:
  - OLED/Mini-LED Pitch Black Canvas (`#000000` dark base) providing extreme 1,000,000:1 contrast ratio against 1000 nits white typography and luminous specular accents.
  - Specular Rim Highlighting & Frosted Depth (`.xdr-surface`): Micro-cards, bento boxes, and panels engineered with top-lit specular rim highlights (`box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 20px 45px -15px rgba(0, 0, 0, 0.85)`) and 24px backdrop blur with 190% saturation boost.
  - Luminous High Dynamic Range Jewel Badges (`.xdr-jewel-*`): Extreme P3 status indicators for Safe/Clear (`#30D158` emerald), Caution (`#FF9F0A` solar amber), Circuit Breaker (`#FF453A` crimson), and Pro Accent (`#2997FF` electric blue).
  - Floating Dynamic Island & Capsule HUD Controls (`.xdr-pill`): Header segmented persona toggle, basemap switcher, map HUD pills, and legend restyled into seamless Apple capsule controls with smooth press physics (`active:scale-[0.96]`).
- **Data Provenance:** Live data from Open-Meteo marine and weather APIs (`https://marine-api.open-meteo.com/v1/marine` and `https://api.open-meteo.com/v1/forecast`); bundled data = `harbours_india.json` (12 landing centres), `imbl_lines.geojson`, `mpa_zones.geojson`, and fallback `indian_ocean_grid.json` for SST/Chl.
- **Deterministic Zero Hallucination:** Spatial math, geofence checks, safety scoring, and A* routing are computed by deterministic tools (`pyproj`, `shapely`, `numpy`, `networkx`), never generated by the LLM.

## 4. Next Steps
- Maintain continuous test verification (`pytest tests/test_tools.py tests/test_api.py -v`).
- Keep `PROJECT_STATE.md` updated in place after every file addition or task completion.
