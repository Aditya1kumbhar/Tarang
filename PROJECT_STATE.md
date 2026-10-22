# PROJECT_STATE.md: ORCA Marine Ecosystem Reasoning (SIH 2026 PS #20)

## 1. Architectural Blueprint
- **Platform:** ORCA (Oceanographic Reasoning & Collaborative Agents) for SIH 2026 Problem Statement #20 (ID 26176).
- **Neuro-Symbolic Division:** Deterministic Python tools calculate all math, bearings, geofences, and safety indices (`pyproj`, `shapely`, `numpy`, `networkx`). LLMs (Gemini / fallback synthesizer) only orchestrate intent and multilingual explanation.
- **Circuit Breaker:** Hard-coded fail-safe locks `RED_ALERT` banner when wave height, wind, Kallakkadal swell, CAPE lightning, or IMBL boundary (<1.5 NM) breaches thresholds.

## 2. Directory & Component Registry
### Backend (`backend/`)
- `main.py`: FastAPI routes (`/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/health`).
- `config.py`: Calibrated safety thresholds, vessel safety matrices (`country_craft` vs `mechanized_trawler`), timeouts.
- `schemas/models.py`: Pydantic v2 models (`AgentState`, `EvidenceLedgerEntry`, `DistrictBoardResponse`, `GeoJSON`).
- `tools/weather_marine_tool.py`: Open-Meteo live API, Kallakkadal surge/CAPE triggers, 0-100 Sea-Venture Safety Index.
- `tools/ocean_pfz_tool.py`: Cayula-Cornillon thermal gradient, Chl-a scoring, 7-day persistence, geofence quarantine.
- `tools/geospatial_tool.py`: PyProj geodesic calculations, Shapely IMBL/MPA geofencing, A* safe routing.
- `tools/productivity_tool.py`: Marine heatwave, HAB hypoxia, and cyclone turbidity decline diagnostics.
- `agents/orchestrator.py`: Multi-agent DAG (Planner -> Parallel Specialist Tools -> Safety Circuit Breaker -> Synthesis).
- `agents/prompts.py` & `agents/state.py`: Multilingual prompts, 9 Indian script detectors, typed orchestrator state.
- `data/`: 12 Indian landing centres, `imbl_lines.geojson`, `mpa_zones.geojson`, and `indian_ocean_grid.json` fallback.

### Frontend (`frontend/src/`)
- `App.jsx`: Dual-persona layout (Fisher View vs District Authority Board), theme toggle (Chart/Ocean), telemetry ribbon.
- `components/MarineMap.jsx`: Leaflet GIS with 12 harbour pins, IMBL border + 5 NM buffer, MPAs, PFZ hotspots, A* route polyline.
- `components/ChatPanel.jsx`: Multilingual chat, 1-click benchmark chips for 8 SIH queries, 40px numeric safety dial, Web Speech TTS.
- `components/DistrictAuthorityBoard.jsx`: Fleet surveillance table across all 12 Indian landing centres with state filtering.
- `components/AgentTraceDrawer.jsx`: Multi-agent DAG execution timeline, sub-second latency meters, Evidence Ledger viewer.
- `components/SafetyAlertBanner.jsx`: Non-overridable Red/Amber maritime safety advisory banner.
- `components/LegalModals.jsx`: Statutory Privacy Policy (DPDP Act 2023) and Terms of Use compliance dialogs.

### Verification (`tests/`)
- `test_tools.py`: 18 unit tests covering all deterministic marine tools and safety index tiers.
- `test_api.py`: 14 integration tests covering all 8 SIH evaluation queries and REST endpoints.

### Production Deployment Assets
- `Dockerfile`: Multi-stage build (Node 22 builder -> Python 3.11-slim non-root runtime) serving both SPA and REST API.
- `.dockerignore`: Lean image exclusion filter (.venv, node_modules, .git, .pytest_cache).
- `build.sh`: Free-tier Render native build script (installs Python backend & builds Vite frontend).
- `frontend/vercel.json`: Clean SPA catch-all rewrite for optional decoupled Vercel deployment.
- `backend/main.py`: Enhanced with SPA fallback serving `frontend/dist/index.html` at `/` while retaining all `/api/v1/*` routes.

## 3. Active Status & Operational Invariants
- **Phase Completion:** Phases 1 through 5 fully implemented and verified.
- **Automated Tests:** 40/40 tests passing (18 unit + 22 integration including multi-worker rate limiting and security suite).
- **Security Hardening (Render Production):** Enforced zero-trust security architecture:
  - Strict CORS allowlist from `ALLOWED_ORIGINS` (no arbitrary origin reflection, credentials restricted to allowlist).
  - Multi-worker shared rate limiting via `slowapi` + WAL-mode `SQLiteSharedStorage` (with optional Redis support via `REDIS_URL`): 10 req/min on `/api/v1/chat`, 120 req/min default on `/api/v1/*`.
  - Cloudflare & reverse-proxy IP extraction: `CF-Connecting-IP` top priority, right-to-left `X-Forwarded-For` traversal with private proxy stripping to prevent spoofing leftmost headers.
  - Chat input validation: Pydantic bounds (1-2000 chars), HTTP 413 on empty or oversized message payload, 15.0s timeout on AI pipeline.
  - Production blueprint lockdown: `/docs`, `/redoc`, and `/openapi.json` disabled (`404 Not Found`) when `ENVIRONMENT=production`.
  - Comprehensive security headers: strict CSP allowing Google Fonts/unpkg Leaflet/tiles, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and HSTS `max-age=31536000; includeSubDomains`.
  - Server stack disclosure genericized (`server: webserver`, stripped `x-powered-by`, `--no-server-header` on uvicorn).
  - Input validation: strict enums (`HarbourID`, `VesselType`, `ScenarioType`) with HTTP 422 on invalid values.
  - Global sanitized exception handling: generic 500 error responses in production without stack trace leaks.
- **Backend Server:** Live daemon running on `http://127.0.0.1:8000` (auto-reload active).
- **Frontend Server:** Live Vite dev server running on `http://localhost:5173`.
- **Live Production Deployment:** Verified active on Render at `https://tarang-0v0t.onrender.com` (serving unified SPA + FastAPI REST API with live Gemini & Open-Meteo integration).
- **Mobile & Phone Responsiveness:** Full mobile ergonomics upgrade with dynamic `100dvh` viewport sizing, iOS/Android safe area insets (`pb-safe`), dedicated 3-tab floating bottom navigation (`Marine Map` | `AI Advisory` | `District Board`) on screens `< md`, collapsible touch-friendly GIS layers with native `ResizeObserver` for zero-lag Leaflet tile invalidation, responsive single-row compact controls in `ChatPanel`, and card-based landing centre surveillance in `DistrictAuthorityBoard`. Dual-pane side-by-side view preserved for desktop/tablet (`>= md`).
- **UI Redesign:** Apple MacBook Air minimalist aesthetic applied across all frontend components (SF Pro / Inter font stack, tight `-0.012em` letter tracking, frosted glass backdrop blur, hairline borders, Apple glassmorphic icon tiles with rim highlights, ultra-lean 1-line micro-copy, zero pill buttons, zero purple, zero emojis).
- **Dark & Light Mode Contrast Parity:** Both `ocean` (dark) and `chart` (light) themes verified with WCAG AAA readability. High-contrast color tiers for glassmorphic tiles (`#047857`/`#34d399` emerald, `#b45309`/`#fbbf24` amber, `#b91c1c`/`#f87171` red, `#0071e3`/`#38bdf8` blue) with zero dark-on-dark or light-on-light text artifacts.
- **Basemap:** Authenticated CARTO Basemaps API key (isolated via `VITE_CARTO_API_KEY` in gitignored `.env`) integrated with 5M requests/mo quota. Interactive 1-click basemap switcher in GIS overlay: CARTO Voyager (nautical default), CARTO Dark Matter, and Esri Oceanic Gray. Zero watermarks across all zoom levels.
- **Telemetry Enrichment:** `liveWeather` populated with dynamic SST (`sst_c`) alongside wave height and wind.
- **Gemini 3.1 LLM Synthesis & Instant Chat Pipeline:** Google Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite` with cascade to `gemini-flash-latest` and instant deterministic fallback) integrated via gitignored `.env` (`GEMINI_API_KEY`). Features persistent HTTP keep-alive connection pooling, 90-second in-memory weather caching (`_WEATHER_CACHE`), and lean 140-token output budgeting to guarantee sub-second, zero-hang responses with 100% mathematical and geofence accuracy.
- **Code Optimization:** Pruned 19 dead imports/tokens across 5 backend files (Ponytail audit verified).
- **Node.js Environment:** Standalone Node LTS `v24.22.1` installed in `~/.local/node`.
- **Python Compatibility:** Python 3.9.6 compatibility verified (dataclass slots resolved).
- **Offline Resilience:** 4.0s API timeout falling back to pre-seeded `indian_ocean_grid.json`.
- **Zero Hallucination:** Geometry, bearings, and geofences computed strictly by deterministic engines.

## 4. Next Steps
- Maintain continuous test verification (`pytest tests/test_tools.py tests/test_api.py -v`).
- Keep `PROJECT_STATE.md` updated in place after every file addition or task completion.

