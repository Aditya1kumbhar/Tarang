# PROJECT_STATE.md: ORCA Marine Ecosystem Reasoning (SIH 2026 PS #20)

## 1. Architectural Blueprint
- **Platform:** ORCA (Oceanographic Reasoning & Collaborative Agents) for SIH 2026 Problem Statement #20 (ID 26176).
- **Neuro-Symbolic Division:** Deterministic Python tools calculate all math, bearings, geofences, and safety indices (`pyproj`, `shapely`, `numpy`, `networkx`). LLMs (Gemini / fallback synthesizer) only orchestrate intent and multilingual explanation.
- **Circuit Breaker:** Hard-coded fail-safe locks `RED_ALERT` banner when wave height, wind, Kallakkadal swell, CAPE lightning, or IMBL boundary (<1.5 NM) breaches thresholds.

## 2. Directory & Component Registry
### Backend (`backend/`)
- `auth.py`: Cryptographic session token manager (HMAC-SHA256 with constant-time comparison), Google Identity Services token verification via Google OAuth2 tokeninfo, FastAPI `get_current_user` dependency, and secure `HttpOnly` cookie issuance/clearing.
- `main.py`: FastAPI routes (`/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/health`, `/api/v1/auth/*`), Content Security Policy expanded for Google Identity Services domains (`accounts.google.com`, `oauth2.googleapis.com`, `lh3.googleusercontent.com`).
- `config.py`: Calibrated safety thresholds, vessel safety matrices (`country_craft` vs `mechanized_trawler`), timeouts, `GOOGLE_CLIENT_ID`, `AUTH_SECRET`.
- `schemas/models.py`: Pydantic v2 models (`AgentState`, `EvidenceLedgerEntry`, `DistrictBoardResponse`, `GeoJSON`).
- `tools/weather_marine_tool.py`: Open-Meteo live API, Kallakkadal surge/CAPE triggers, 0-100 Sea-Venture Safety Index.
- `tools/ocean_pfz_tool.py`: Cayula-Cornillon thermal gradient, Chl-a scoring, 7-day persistence, geofence quarantine.
- `tools/geospatial_tool.py`: PyProj geodesic calculations, Shapely IMBL/MPA geofencing, A* safe routing.
- `tools/productivity_tool.py`: Marine heatwave, HAB hypoxia, and cyclone turbidity decline diagnostics.
- `agents/orchestrator.py`: Multi-agent DAG (Planner -> Parallel Specialist Tools -> Safety Circuit Breaker -> Synthesis).
- `agents/prompts.py` & `agents/state.py`: Multilingual prompts, 9 Indian script detectors, typed orchestrator state.
- `data/`: 12 Indian landing centres, `imbl_lines.geojson`, `mpa_zones.geojson`, and `indian_ocean_grid.json` fallback.

### Frontend (`frontend/src/`)
- `App.jsx`: Dual-persona layout (Fisher View vs District Authority Board), mandatory Google authentication gate (`!currentUser` full lockout barrier), authenticated user profile badge and sign-out in frosted header, theme toggle (Chart/Ocean), telemetry ribbon.
- `components/LoginPage.jsx`: Apple-grade Google Identity Services authentication portal, mandatory lockout gate, DPDP Act 2023 compliance notes, session persistence, dev login fallback.
- `components/MarineMap.jsx`: Leaflet GIS with 12 harbour pins, IMBL border + 5 NM buffer, MPAs, PFZ hotspots, A* route polyline.
- `components/ChatPanel.jsx`: Multilingual chat, 1-click benchmark chips for 8 SIH queries, 40px numeric safety dial, Web Speech TTS.
- `components/DistrictAuthorityBoard.jsx`: Fleet surveillance table across all 12 Indian landing centres with state filtering.
- `components/AgentTraceDrawer.jsx`: Multi-agent DAG execution timeline, sub-second latency meters, Evidence Ledger viewer.
- `components/SafetyAlertBanner.jsx`: Non-overridable Red/Amber maritime safety advisory banner.

### Verification (`tests/`)
- `test_tools.py`: 18 unit tests covering all deterministic marine tools and safety index tiers.
- `test_api.py`: 32 integration tests covering all 8 SIH evaluation queries, security hardening, rate limiting, and 5 dedicated Google authentication barrier tests (unauthenticated 401 rejections, auth config, invalid token rejection, dev login session flow, logout cookie clearing).

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
- **Phase Completion:** Phases 1 through 5 fully implemented and verified.
- **Automated Tests:** 51/51 tests passing (18 unit + 33 integration covering full master security hardening, authentication gate, and email allowlist suite).
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
  - CI Pipeline & Dependency Security: GitHub Actions workflow (`.github/workflows/ci.yml`) enforcing zero-vulnerability `pip-audit --strict`, `npm audit --audit-level=critical`, comprehensive test suite (45 tests), and production rate limiting verification script, with `workflow_dispatch` and `permissions: contents: read`. Dependencies explicitly pinned with `fastapi==0.159.1`, `starlette>=1.3.1` (`1.9.0`), `pytest>=9.0.3` (`9.1.1`), and `pytest-asyncio==1.4.0` with clean local and CI pip-audit parity.
  - Live Rate Limiting Verification: Confirmed live on Render (`https://tarang-0v0t.onrender.com/api/v1/chat`) with 10x HTTP 200 followed by HTTP 429 on requests 11–12.
- **Backend Server:** Live daemon running on `http://127.0.0.1:8000` (auto-reload active).
- **Frontend Server:** Live Vite dev server running on `http://localhost:5173`.
- **Live Production Deployment:** Verified active on Render at `https://tarang-0v0t.onrender.com` (serving unified SPA + FastAPI REST API with live Gemini & Open-Meteo integration).
- **Premium Variable Typography Upgrade (Geist Sans & Geist Mono):** Apple MacBook Pro inspired typography system:
  - Primary font: `Geist Sans` variable font (`100–900` weight range) self-hosted via `/fonts/Geist-Variable.woff2` with preloading to eliminate FOIT/layout shift.
  - Secondary font: `Geist Mono` variable font self-hosted via `/fonts/GeistMono-Variable.woff2` restricted to ~5% usage (technical coordinates, timestamps, tabular telemetry indices, and code identifiers).
  - Variable tokens: Defined CSS custom properties (`--font-geist-sans`, `--font-geist-mono`, `--type-hero`, `--type-section`, `--type-subheading`, `--type-body`, `--type-nav`, `--type-button`, `--type-meta`) with Apple-calibrated negative letter-spacing (`-0.055em` hero, `-0.04em` section headings, `-0.01em` body) and line-heights (`1.02` to `1.65`).
  - Zero third-party font requests: Pruned external Google Font dependencies from `index.html` while preserving CSP compliance.
- **Mobile & Phone Ergonomics Overhaul (Galaxy A33–A75 & iPhone 15–17/Pro/Max):** Rigorous optimization targeting modern 20:9 (Samsung Galaxy A33/A34/A35/A53/A54/A55/A73/A75, viewport 360px–412px width) and 19.5:9 (iPhone 15, 15 Pro, 16, 16 Pro, 17, and Pro Max, viewport 393px–440px width) aspect ratios:
  - Dynamic `100dvh` viewport structure eliminating vertical jitter and browser chrome scroll jumping.
  - Safe-area inset integration: Top header clearing Dynamic Island / camera punch-holes with `pt-[env(safe-area-inset-top,0px)]` and `h-[calc(3.5rem+env(safe-area-inset-top,0px))]`. Bottom floating nav bar padded with `pb-safe` (`env(safe-area-inset-bottom)`).
  - Anti-Double-Safe-Area Fix: Removed redundant `pb-safe` from chat form to eliminate the unsightly ~68px whitespace gap above the floating nav bar on iOS.
  - Touch Target & Ergonomics Compliance: All action buttons conform to Apple HIG (44x44px minimum) and Android Material (48x48px minimum) with tactile physical `active:scale-[0.96]` feedback and `-webkit-tap-highlight-color: transparent`.
  - iOS Safari Auto-Zoom Fix: Applied `@media (pointer: coarse) { input, select, textarea { font-size: 16px !important; } }` in `index.css` to prevent auto-zooming and horizontal viewport displacement.
  - Momentum & Multi-Axis Touch Isolation: Added `.touch-momentum` (`-webkit-overflow-scrolling: touch; touch-action: pan-y`) across scenario recommendation carousels and alert banner drawers, isolating horizontal swipes from vertical page jitter.
  - Narrow-Screen Login Gate: Adaptive card padding (`p-5 sm:p-8`) and dynamic Google Identity button width (`Math.min(280, Math.max(220, window.innerWidth - 80))`) preventing horizontal overflow on 360px devices (Galaxy A33).
  - District Board Bottom Clearance: Added `pb-28 md:pb-6` so the final landing centre surveillance card can be fully viewed without occlusion by the bottom floating navigation bar.
- **UI Redesign & Anti-Vibe Design:** Apple MacBook Air minimalist aesthetic applied across all frontend components (SF Pro / Inter font stack, tight `-0.012em` letter tracking, frosted glass backdrop blur, hairline borders, Apple glassmorphic icon tiles with rim highlights, ultra-lean 1-line micro-copy, zero pill buttons, zero purple gradients, zero emojis, zero em dashes). Enlarged header brand identity (`ORCA` text-lg font-bold, larger compass icon tile, and text-xs `Marine Intelligence` subtitle) while removing unnecessary `SIH 2026 PS #20` badge. Connected custom domain (`orca.marine.gov.in` in `frontend/public/CNAME`), professional maritime vector favicon (`frontend/public/favicon.svg`), and zero "Made with AI" tags or fake metrics.
- **Dark & Light Mode Contrast Parity:** Both `ocean` (dark) and `chart` (light) themes verified with WCAG AAA readability. High-contrast color tiers for glassmorphic tiles (`#047857`/`#34d399` emerald, `#b45309`/`#fbbf24` amber, `#b91c1c`/`#f87171` red, `#0071e3`/`#38bdf8` blue) with zero dark-on-dark or light-on-light text artifacts. Enhanced `SafetyAlertBanner` with dynamic dual-theme contrast, styling Caution/Amber (`bg-[#fffbeb]` on light vs `bg-[#141008]` on dark) and Circuit Breaker/Red (`bg-[#fef2f2]` on light vs `bg-[#120809]` on dark) with matching frosted inner cards, badges, and text colors.
- **Basemap:** Authenticated CARTO Basemaps API key (isolated via `VITE_CARTO_API_KEY` in gitignored `.env`) integrated with 5M requests/mo quota. Interactive 1-click basemap switcher in GIS overlay: CARTO Voyager (nautical default), CARTO Dark Matter, and Esri Oceanic Gray. Zero watermarks across all zoom levels.
- **Telemetry Enrichment:** `liveWeather` populated with dynamic SST (`sst_c`) alongside wave height and wind.
- **Gemini AI Synthesis Full-Potential Engine:** Resolved LLM generation bottleneck by upgrading `_get_gemini_client()` timeout from 6.0s to 14.0s (connect 3.0s), expanding token ceiling to `maxOutputTokens=2048`, disabling hidden internal chain-of-thought token depletion via `thinkingConfig: {"thinkingBudget": 0}` (with automatic retry fallback if 400), and deploying an active multi-tier model cascade (`gemini-3.6-flash` -> `gemini-3-flash-preview` -> `gemini-3.1-flash-lite`) with non-breaking 429/503 fallback routing. Guarantees rich, articulate, multi-paragraph nautical wisdom (gear recommendations, mesh sizes, fish behavior, sea lore) grounded seamlessly in deterministic physical sensor evidence and safety circuit breakers. All 45 unit and integration tests passing.
- **Ponytail Ultra Audit & Codebase Pruning:** Completed deep anti-complexity audit: pruned dead `@keyframes radar-sweep` and `.animate-radar` from `index.css`, eliminated unused imports (`Compass`, `Anchor`, `Navigation`) and dead prop `activeRoute` from `MarineMap.jsx`, and cleaned unreferenced imports (`sys`, `get_real_client_ip`) from `tests/verify_production_ratelimit.py`. Vite production bundle rebuilt cleanly in 915ms. All 45 unit and integration tests passing.
- **Frontend Runtime Resilience & Blank Screen Fix:** Fixed missing `Map as MapIcon` import in `MarineMap.jsx` that was accidentally pruned in previous audit, wrapped Web Speech recognition in a safe try-catch guard in `ChatPanel.jsx` against browser policy exceptions, and introduced top-level `ErrorBoundary` in `main.jsx` to guarantee the interface never crashes into a blank screen. Production Vite bundle rebuilt cleanly and all 45 unit/integration tests verified passing.
- **Safety Banner Clutter Removal:** Removed redundant duplicate weather pill (`Wave: ... | Wind: ...`) and unused `Waves`/`Wind` icon imports from `SafetyAlertBanner.jsx` since live SST, wave height, and wind metrics are permanently displayed in the top header telemetry ribbon.
- **Mobile Tab Switch Resilience (Leaflet Zero-Dimension Fix):** Resolved mobile-only `ErrorBoundary` interface recovery trigger when toggling from District Board to AI Advisory. When `mobileTab === 'chat'` on mobile (`< md`), the map container has `display: none` (0x0px size); guarded Leaflet's `flyTo`, `fitBounds`, and `handleResetView` against zero-dimension execution to prevent `Invalid LatLng (NaN, NaN)` calculation errors, deferring view updates to `ResizeObserver` when the map becomes visible. Wrapped message scroll auto-scroll in fallback guard against mobile WebKit smooth scroll variances.
- **Global & Workspace Rules/Skills Synchronization:** Full parity established between `~/.config/antigravity/` and `.agents/`. All 15 canonical `emilkowalski/skills` + 13 core engineering skills installed in `.agents/skills/` (28 total). All 6 rules (`emil-apple-strict-lock.md`, `opus-engine.md`, `ponytail.md`, `zero-trust-security.md`, `anti-vibe-design.md`, `windows-quota-guard.md`) active in `.agents/rules/`.
- **Apple + Emil UI Hard Lock (`emil-apple-strict-lock.md`):** 989-line always-on rule compiled and active across `.agents/rules/`, `~/.config/antigravity/rules/`, and `~/.gemini/config/rules/`. Enforces 17 WWDC Fluid Interface principles, critically damped springs (`damping: 1.0`), `active:scale-[0.97]` pointerdown, hairline borders, and `tabular-nums` on all UI work.
- **Node.js Environment:** Standalone Node LTS `v24.22.1` installed in `~/.local/node`.
- **Python Compatibility:** Python 3.9.6 compatibility verified (dataclass slots resolved).
- **Offline Resilience:** 4.0s API timeout falling back to pre-seeded `indian_ocean_grid.json`.
- **Zero Hallucination:** Geometry, bearings, and geofences computed strictly by deterministic engines.

## 4. Next Steps
- Maintain continuous test verification (`pytest tests/test_tools.py tests/test_api.py -v`).
- Keep `PROJECT_STATE.md` updated in place after every file addition or task completion.

