# CODEMAP.md — ORCA Marine Ecosystem Reasoning Architecture

## System Overview
ORCA (Marine EcOsystem Reasoning with Collaborative Agents) for SIH 2026 Problem Statement ID 26176 (SIH26176).
- Organization: Indian Space Research Organisation (ISRO), Department of Space
- Theme: Miscellaneous

## Phase Progress
- [x] **Phase 1: Foundation, Schemas & Real Geospatial Seed Data** (Completed & Verified)
- [x] **Phase 2: Deterministic Marine, Weather & Geospatial Tools** (Completed & Verified)
- [x] **Phase 3: Collaborative Multi-Agent Orchestrator & FastAPI Backend** (Completed & Verified)
- [x] **Phase 4: Interactive Marine GIS Frontend & Agent Reasoning Inspector** (Completed & Verified - Vite Build Verified)
- [x] **Phase 5: End-to-End Integration, Browser Verification & Walkthrough Artifact** (Completed & Verified)
- [x] **Phase 6: SIH Research Alignment & Production Zero-Trust Hardening** (Completed & Verified - 75/75 Tests Passed)

## Directory & File Registry
- `GEMINI.md`: Master project architecture and rules.
- `CODEMAP.md`: Living architecture registry and component map.
- `PROJECT_STATE.md`: Active project status, test scoreboard, and operational invariants.
- `pytest.ini`: Test configuration with pythonpath and auto-asyncio.
- `.env.example`: Template for environment variables.
- `.agents/rules/windows-quota-guard.md`: Quota guard, Windows UTF-8 file handling, single-phase bounded execution.
- `.agents/rules/anti-vibe-design.md`: Permanent anti-vibe design invariants (no purple gradients, no pill buttons, no emojis, no em dashes, no fake metrics, legal modals, and custom domain).
- `.agents/skills/verify-sih-queries/SKILL.md`: `/verify-sih-queries` benchmark testing skill.
- `backend/`: FastAPI application, multi-agent orchestrator, tools, schemas, and seed geospatial data.
  - `requirements.txt`: Python dependencies (`fastapi`, `uvicorn`, `pydantic`, `pyproj`, `shapely`, `numpy`, `httpx`, `slowapi`, `pytest`).
  - `config.py`: Thresholds, API endpoints, vessel profiles, safety limits, risk tier calibrations.
  - `schemas/models.py`: Pydantic models for AgentState, Provenance, EvidenceLedgerEntry, DistrictBoard, GeoJSON, and API contracts.
  - `data/`:
    - `harbours_india.json`: 12 major landing centres along Indian coastline (UTF-8).
    - `geofences/imbl_lines.geojson`: Indo-Sri Lanka & Indo-Pak IMBL coordinates (Shapely verified).
    - `geofences/mpa_zones.geojson`: Marine Protected Area polygons (Gulf of Mannar, Malvan, Coringa, Gahirmatha).
    - `fallback/indian_ocean_grid.json`: Bundled coastal SST and Chlorophyll-a ocean grid points for offline fallback only.
  - `tools/`:
    - `weather_marine_tool.py`: Open-Meteo = live weather and marine observations with closest-hour selection (current UTC or tomorrow 06:00 IST) and offline fallback; deterministic 0-100 Sea-Venture Safety Index & Evidence Ledger generation.
    - `satellite_erddap.py`: NOAA CoastWatch ERDDAP client fetching live daily satellite SST (Coral Reef Watch 5km) and Chlorophyll-a (VIIRS 9km NRT gap-filled) grids with 6-hour TTL cache.
    - `geospatial_tool.py`: PyProj geodesic calculations, Shapely geofence buffer checks & A* safe routing.
    - `ocean_pfz_tool.py`: NOAA CoastWatch ERDDAP = live daily satellite SST + chlorophyll for PFZ; finite-difference thermal front gradient computation, nearest-neighbour chlorophyll merging, composite scoring, and offline fallback snapshot.
    - `productivity_tool.py`: SST anomaly & eutrophication / hypoxia fish productivity decline diagnostic.
  - `agents/`:
    - `__init__.py`: Package init exporting `OrchestratorState` and `run_orchestrator`.
    - `state.py`: Orchestrator typed state with `evidence_ledger`, `sea_venture_safety_index`, `risk_verdict`.
    - `prompts.py`: Multilingual system prompts, script detectors, and safety override banners (10 languages).
    - `orchestrator.py`: Multi-agent pipeline with Planner, Specialist Dispatchers, Safety Circuit Breaker, Evidence Ledger compiler, and Synthesis.
  - `main.py`: FastAPI server routes (`/api/v1/health`, `/api/v1/auth/*`, `/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/demo-scenario`, `/api/v1/geofences/*`).
- `frontend/`: Vite + React + TailwindCSS + Leaflet marine dashboard.
  - `package.json`: Frontend dependencies (`react`, `react-dom`, `leaflet`, `lucide-react`, `vite`, `tailwindcss`).
  - `vite.config.js`: Vite server and `/api` reverse proxy configuration to FastAPI (`http://localhost:8000`).
  - `tailwind.config.js` & `postcss.config.js`: Apple Liquid Retina XDR display tokens and dark/light mode support.
  - `index.html`: Clean HTML5 entry point with preloaded Geist Variable fonts and Leaflet CSS.
  - `public/`: Static production assets (`favicon.svg`, `CNAME` for orca.marine.gov.in).
  - `src/`:
    - `main.jsx`: React root mounting `App.jsx` with ErrorBoundary.
    - `index.css`: Tailwind layer directives, custom XDR surfaces, and Liquid Retina glass styling.
    - `App.jsx`: Main telemetry ribbon, persona switch (Fisher vs District Board), theme switcher, auth gate, circuit breaker banner.
    - `components/MarineMap.jsx`: Leaflet GIS map with 12 harbour pins, IMBL border with 5 NM buffer, MPA zones, PFZ hotspots, and A* safe route polyline.
    - `components/ChatPanel.jsx`: Multilingual chat supporting 1-click benchmark chips for all 8 official SIH queries, 4 extended scenarios, 8 demo chips, 40px numeric safety dial, LISTEN TTS audio button, and structured evidence citations.
    - `components/DistrictAuthorityBoard.jsx`: Coast-wide 12-harbour table with live safety dials, state filtering, and instant transition to Fisher View.
    - `components/AgentTraceDrawer.jsx`: Multi-agent DAG timeline, latency meters (ms), confidence scores, Pydantic provenance inspector, and Evidence Ledger viewer.
    - `components/SafetyAlertBanner.jsx`: High-visibility Red/Amber maritime circuit breaker advisory header.
- `tests/`:
  - `test_tools.py`: 28 unit tests covering all deterministic marine tools, 0-100 safety index tiers, evidence ledger entries, and script detection across 10 languages.
  - `test_api.py`: 47 integration tests covering all 8 official SIH queries, 4 extended scenarios, district-board, demo-scenarios, rate limiting, and fail-closed auth.
