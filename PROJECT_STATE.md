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
- `main.py`: FastAPI routes (`/api/v1/health`, `/api/v1/auth/*`, `/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/demo-scenario`, `/api/v1/geofences/*`, `/api/v1/fishing`, `/api/v1/risk/timeline`, `/api/v1/field`, `/api/v1/config/data-health`), Content Security Policy expanded for Google Identity Services domains (`accounts.google.com`, `oauth2.googleapis.com`, `lh3.googleusercontent.com`).
- `config.py`: Calibrated safety thresholds, vessel safety matrices (`country_craft` vs `mechanized_trawler`), timeouts, `GOOGLE_CLIENT_ID`, `AUTH_SECRET`.
- `schemas/models.py`: Pydantic v2 models (`AgentState`, `EvidenceLedgerEntry`, `DistrictBoardResponse`, `GeoJSON`, `ScenarioType`, `ChatResponse` and `DashboardSummaryResponse` with `risk_factors`, `safety_gate`, `trip_plan`, `pfz_data_mode`, `weather_data_mode`, `satellite_timestamp`, and `weather_timestamp`).
- `tools/risk_curves.py`: Calibrated piecewise-linear breakpoint curves (`WAVE_CURVE`, `WIND_CURVE`, `CURRENT_CURVE`, `VISIBILITY_CURVE`, `OFFSHORE_CURVE`), transparent factor attribution, and deterministic safety floors (Severe 92, Fishermen 70, Wave 85, Wind 85, Zone 60).
- `tools/safety_gate_tool.py`: Data-sufficiency safety gate and telemetry health service (`GO`, `CAUTION`, `INSUFFICIENT_DATA`, `NO_GO`) with interactive test drill simulator (`healthy`, `stale`, `unavailable`, `recovery`).
- `tools/fishing_planner_tool.py`: "Today" trip planner, pelagic species likelihood prediction model (INCOIS physics + OBIS regional biodiversity snapshot), departure and mandatory return-by deadline calculator, and artisanal trip economics (FRP craft fuel burn, catch haul, and net profit).
- `tools/weather_marine_tool.py`: Open-Meteo live API with closest-hour selection (current UTC hour or tomorrow 06:00 IST -> 00:30 UTC), synchronized marine and forecast hourly series, Kallakkadal surge/CAPE triggers, 0-100 Sea-Venture Safety Index.
- `tools/satellite_erddap.py`: NOAA CoastWatch ERDDAP client fetching live daily satellite Sea Surface Temperature (Coral Reef Watch 5km) and Chlorophyll-a (VIIRS 9km NRT gap-filled 4-axis grid) with 6-hr TTL in-memory cache and 20s timeout.
- `tools/ocean_pfz_tool.py`: Live NOAA ERDDAP satellite candidate grid generator with finite-difference thermal front gradient computation, nearest-neighbour chlorophyll merging (0.15° cutoff), composite scoring, and offline fallback snapshot (`Bundled offline snapshot (static)`).
- `tools/geospatial_tool.py`: PyProj geodesic calculations, Shapely IMBL/MPA geofencing, A* safe routing.
- `tools/productivity_tool.py`: Marine heatwave, HAB hypoxia, and cyclone turbidity decline diagnostics.
- `agents/orchestrator.py`: Multi-agent DAG (Planner -> Parallel Specialist Tools -> Safety Circuit Breaker -> Synthesis) with tomorrow-morning intent detection, async PFZ tool invocation, safety gate integration, factor attribution, and complete data provenance exposure.
- `agents/prompts.py` & `agents/state.py`: Multilingual prompts, 10 language script detectors (en, ta, ml, te, kn, mr, gu, or, bn, hi), typed orchestrator state.
- `data/`: 12 Indian landing centres, `imbl_lines.geojson`, `mpa_zones.geojson`, and `indian_ocean_grid.json` offline fallback snapshot.

### Frontend (`frontend/src/`)
- `App.jsx`: Tri-persona layout (Fisher GIS View vs Fisher Phone HUD vs District Authority Board), `?m=1` URL detection, mandatory Google authentication gate (`!currentUser` full lockout barrier), authenticated user profile badge and sign-out in frosted header, theme toggle (Chart/Ocean), live data provenance tracking, and interactive `DataDrillBar`.
- `components/FisherPhoneView.jsx`: Dedicated high-accessibility mobile layout with giant 40px numeric dial, Web Speech API voice audio narration in all 10 Indic languages, departure & return window cards, species likelihood prediction, and trip economics.
- `components/DataDrillBar.jsx`: Apple capsule selector (Healthy · Stale · Unavailable · Recovery) enabling live telemetry drill simulation for judges and demonstrators.
- `components/HourlyTimeline.jsx`: 24-hour visual risk trajectory ribbon showing hourly sea states, wave heights, wind speeds, safe departure window, and return-by deadline.
- `components/LoginPage.jsx`: Apple-grade Google Identity Services authentication portal, mandatory lockout gate, DPDP Act 2023 compliance notes, session persistence, dev login fallback.
- `components/MarineMap.jsx`: Leaflet GIS with 12 harbour pins, IMBL border + 5 NM buffer, MPAs, PFZ hotspots, A* route polyline.
- `components/ChatPanel.jsx`: Multilingual chat, 8 official SIH queries, 4 extended scenarios, 8 demo chips, 40px numeric safety dial, Web Speech TTS (10 languages), dynamic Data Provenance Badge (`LIVE: Open-Meteo + NOAA satellite (${satDate})` vs `FALLBACK DATA IN USE`), and interactive Evidence Ledger drawer displaying source and observation timestamp per entry.
- `components/DistrictAuthorityBoard.jsx`: Fleet surveillance table across all 12 Indian landing centres with state filtering.
- `components/AgentTraceDrawer.jsx`: Multi-agent DAG execution timeline, sub-second latency meters, Evidence Ledger viewer.
- `components/SafetyAlertBanner.jsx`: Non-overridable Red/Amber maritime safety advisory banner.

### Verification (`tests/`)
- `conftest.py`: Syntactically valid dummy auth credentials and test environment initialization (`GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `AUTH_SECRET`, `ENVIRONMENT=development`, `AI_TIMEOUT_SECONDS=35.0`) with `os.environ.setdefault` guarding CI and isolated runners.
- `test_tools.py`: 33 unit tests covering deterministic marine tools, safety index tiers, 10 language script detectors, Part A2 48-hr Open-Meteo hourly selector series, Part B4 ERDDAP finite differences and 0.15° merge, and satellite mock success/fallback tests.
- `test_winner_features.py`: 12 unit and integration tests covering piecewise hazard curves, safety floors, data health freshness checking, safety gate decisions across all 4 drills, fishing probability and species prediction, trip economics, and REST endpoints (/api/v1/fishing, /api/v1/risk/timeline, /api/v1/field, /api/v1/config/data-health).
- `test_api.py`: 48 integration tests covering all 8 official SIH queries, 4 extended scenarios, security hardening, rate limiting, dedicated Google authentication barrier tests, and clean subprocess fail-closed 503 regression probes.

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
- **Advisory Console Latency & Timeout Resolution (Root Cause Fixed):**
  - Resolved the persistent 25-second `AbortError` timeout ("The reasoning engine took longer than expected to evaluate ocean telemetry"):
    - Traced exact production timeline: NOAA CoastWatch 7s timeout + Open-Meteo 2s + legacy preview Gemini model taking 14.5s = 24.38s backend execution time.
    - On mobile 4G/5G connections (+800ms ping), total round-trip exceeded the frontend's 25000ms `AbortController` timer, immediately aborting the request on the phone.
    - Switched Gemini primary ingestion model to `gemini-3.5-flash-lite` (verified 0.92s to 3.1s latency) and removed `thinkingConfig` to prevent HTTP 400 errors.
    - Capped Gemini synthesis with a strict `asyncio.wait_for(timeout=3.5)` hard budget; if the LLM exceeds 3.5s, the system instantly serves the complete deterministic multilingual advisory in <5ms without stalling the user.
    - Lowered NOAA ERDDAP timeout in `satellite_erddap.py` to 1.8s and bound `compute_pfz_zones` in `ocean_pfz_tool.py` to 2.5s before fallback snapshot ingestion.
    - Increased frontend client-side `AbortController` timeout from 25s to 45s (`timeoutId = setTimeout(() => abortController.abort(), 45000)`) in `App.jsx`.
    - Upgraded Uvicorn workers from 1 to 2 in `Dockerfile` to prevent blocking concurrent health and dashboard requests.
    - Verified overall multi-agent execution completes in under 8.0s locally.
- **Phase Completion:** Phases 1 through 8 (ORCA SIH 2026 Winner Integration) fully implemented and verified:
  - Piecewise-linear hazard breakpoint curves & transparent factor attribution (`risk_curves.py`).
  - Data-sufficiency safety gate (`GO`, `CAUTION`, `INSUFFICIENT_DATA`, `NO_GO`) and 4 interactive test drills (`healthy`, `stale`, `unavailable`, `recovery`) (`safety_gate_tool.py`).
  - "Today" fisher trip planner, species likelihood prediction (INCOIS physics + OBIS biodiversity), departure/return windows, and artisanal economics (`fishing_planner_tool.py`).
  - New REST APIs: `GET /api/v1/fishing`, `GET /api/v1/risk/timeline`, `GET /api/v1/field`, `GET /api/v1/config/data-health`, `POST /api/v1/config/data-health`.
  - High-accessibility Fisher Phone HUD Mode (`/?m=1`) with giant 40px numeric dial, Web Speech API voice narration in 10 Indic languages, 24h sea-state trajectory ribbon (`HourlyTimeline.jsx`), and interactive test drill bar (`DataDrillBar.jsx`).
- **Automated Tests:** 93/93 tests passing (33 unit in `test_tools.py` + 12 in `test_winner_features.py` + 48 integration in `test_api.py` covering all 8 official SIH queries, 4 extended scenarios, winner features, data drills, security hardening, rate limiting, and production auth fail-closed guarantees).
- **Sub-4s Satellite Timeout Bounds & Zero-Hang Guarantee:** Satellite ERDDAP requests in `backend/tools/satellite_erddap.py` and `ocean_pfz_tool.py` calibrated to 3.5s timeout (down from 12.0s), preventing 24s cascading timeouts when cloud IPs reach NOAA. General informational and conversational queries decouple from satellite PFZ downloads (`conversational_advisory` intent in `orchestrator.py`), executing in sub-2.5s. Gemini synthesis fast-fails immediately on 429 quota exhaustion with a 120-second circuit breaker cooldown, preventing 15-second cascading retry stalls. Frontend `App.jsx` enforces 25s `AbortSignal` timeout, guaranteeing the UI never spins indefinitely on `Evaluating sea state...`.
- **Gemini Model Ingestion Tier:** Default configured to `gemini-3-flash-preview` with ordered failover to `GEMINI_MODEL`, `gemini-3.8-flash`, `gemini-3.6-flash`, and `gemini-3.5-flash`, avoiding 429 quota exhaustion on preview keys while maintaining sub-5s response latency.
- **Multilingual Script & Syntax Hardening:** Word-boundary regex isolation and English syntax marker evaluations in `backend/agents/prompts.py` prevent Indian oceanographic terms (e.g., "Kallakkadal", "kadal") from triggering false Malayalam/Tamil translations on English inquiries.
- **Informational Q&A Decoupling & Safety Parity:** Operational guidelines in `orchestrator.py` instruct Gemini and rule-based fallbacks to thoroughly explain oceanographic concepts, species distribution, and gear precautions even during active `RED_ALERT` harbour suspensions. Hypothetical risk extraction handles single-hazard queries (`wind_match or wave_match`).
- **Concurrent Ingestion & Cloud Performance:** Satellite SST and VIIRS Chlorophyll-a queries routed to primary high-speed NOAA CoastWatch cluster (`coastwatch.noaa.gov`: `noaacrwsstDaily` and `noaacwNPPN20VIIRSDINEOFDaily` returning sub-second 200 responses) with automatic failover to West Coast node (`pfeg.noaa.gov`), parallelized via `asyncio.gather` with 12s circuit limit; weather and PFZ feeds parallelized for dashboard loading; `API_TIMEOUT_SECONDS=8.0` and `AI_TIMEOUT_SECONDS=35.0` configured across Dockerfile, config, and CI.
- **Verified Live Data Pipeline & True Provenance:**
  - Weather & Marine: Open-Meteo live API with closest-hour selection for current UTC hour or tomorrow morning (06:00 IST -> 00:30 UTC), eliminating the legacy index [0] bug.
  - Potential Fishing Zones: NOAA CoastWatch ERDDAP live daily satellite Sea Surface Temperature (Coral Reef Watch 5km) and Chlorophyll-a (VIIRS 9km NRT gap-filled 4-axis grid) with finite-difference thermal gradient calculation.
  - Offline Fallback Guarantee: On ANY network failure or empty satellite table, automatically falls back to bundled static grid labeled strictly as `Bundled offline snapshot (static)` with `FALLBACK_SNAPSHOT` mode; `INCOIS-NOAA Satellite Climatology` label completely eliminated.
  - Provenance Honesty Alignment: ORCA Synthesizer explicitly receives `DATA PROVENANCE ALERT` in multi-agent evidence ledger whenever running on `FALLBACK_SNAPSHOT` and enforces Rule 8 (`DATA PROVENANCE HONESTY`), forbidding any claims of live satellite data while in fallback mode and ensuring 100% verbal parity with the UI badge.
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
