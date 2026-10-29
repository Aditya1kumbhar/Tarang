# CODEMAP.md — ORCA Marine Ecosystem Reasoning Architecture

## System Overview
ORCA (Oceanographic Reasoning & Collaborative Agents) for SIH 2026 PS #20 (ID 26176).

## Phase Progress
- [x] **Phase 1: Foundation, Schemas & Real Geospatial Seed Data** (Completed & Verified)
- [x] **Phase 2: Deterministic Marine, Weather & Geospatial Tools** (Completed & Verified - 16/16 Unit Tests Passed)
- [x] **Phase 3: Collaborative Multi-Agent Orchestrator & FastAPI Backend** (Completed & Verified - 12/12 Integration Tests Passed)
- [x] **Phase 4: Interactive Marine GIS Frontend & Agent Reasoning Inspector** (Completed & Verified - Vite Build Verified)
- [x] **Phase 5: End-to-End Integration, Browser Verification & Walkthrough Artifact** (Completed & Verified - Full E2E Browser & Multi-Agent Tests Passed)
- [x] **Phase 6: SIH Research Blueprint & Systems Hardening Upgrade** (Completed & Verified - 32/32 Tests Passed, Dual Persona, Evidence Ledger, Nautical Sea-Chart Theme)

## Directory & File Registry
- `GEMINI.md`: Master project architecture and rules.
- `CODEMAP.md`: Living architecture registry and component map.
- `pytest.ini`: Test configuration with pythonpath and auto-asyncio.
- `.env.example`: Template for environment variables.
- `.agents/rules/windows-quota-guard.md`: Quota guard, Windows UTF-8 file handling, single-phase bounded execution.
- `.agents/rules/anti-vibe-design.md`: Permanent anti-vibe design invariants (no purple gradients, no pill buttons, no emojis, no em dashes, no fake metrics, legal modals, and custom domain).
- `.agents/checkpoints/PHASE_2_DONE.md`: Phase 2 completion proof and test report.
- `.agents/checkpoints/PHASE_3_DONE.md`: Phase 3 completion proof and test report.
- `.agents/checkpoints/PHASE_4_DONE.md`: Phase 4 completion proof and test report.
- `.agents/skills/verify-sih-queries/SKILL.md`: `/verify-sih-queries` benchmark testing skill.
- `backend/`: FastAPI application, multi-agent orchestrator, tools, schemas, and seed geospatial data.
  - `requirements.txt`: Python dependencies (`fastapi`, `uvicorn`, `pydantic`, `pyproj`, `shapely`, `numpy`, `httpx`, `pytest`).
  - `config.py`: Thresholds, API endpoints, vessel profiles, safety limits, risk tier calibrations.
  - `schemas/models.py`: Pydantic models for AgentState, Provenance, EvidenceLedgerEntry, DistrictBoard, GeoJSON, and API contracts.
  - `data/`:
    - `harbours_india.json`: 12 major landing centres along Indian coastline (UTF-8).
    - `geofences/imbl_lines.geojson`: Indo-Sri Lanka & Indo-Pak IMBL coordinates (Shapely verified).
    - `geofences/mpa_zones.geojson`: Marine Protected Area polygons (Gulf of Mannar, Malvan, Coringa, Gahirmatha).
    - `fallback/indian_ocean_grid.json`: Realistic coastal SST and Chlorophyll-a ocean grid points for offline resilience (EOS-06 OCM-3/SCAT-3 fused with INSAT-3DS & MODIS-Aqua).
  - `tools/`:
    - `weather_marine_tool.py`: Open-Meteo Marine & Forecast API with fallback, deterministic 0-100 Sea-Venture Safety Index & Evidence Ledger generation.
    - `geospatial_tool.py`: PyProj geodesic calculations, Shapely geofence buffer checks & A* safe routing.
    - `ocean_pfz_tool.py`: SST optimality, Cayula-Cornillon thermal gradient, 7-day persistence, Chl-a PFZ composite scoring & Evidence Ledger generation.
    - `productivity_tool.py`: SST anomaly & eutrophication / hypoxia fish productivity decline diagnostic.
  - `agents/`:
    - `__init__.py`: Package init exporting `OrchestratorState` and `run_orchestrator`.
    - `state.py`: Orchestrator typed state with `evidence_ledger`, `sea_venture_safety_index`, `risk_verdict`.
    - `prompts.py`: Multilingual system prompts, script detectors, and safety override banners.
    - `orchestrator.py`: Multi-agent pipeline with Planner, Specialist Dispatchers, Safety Circuit Breaker, Evidence Ledger compiler, and Synthesis.
  - `main.py`: FastAPI server routes (`/api/v1/chat`, `/api/v1/harbours`, `/api/v1/dashboard-summary`, `/api/v1/district-board`, `/api/v1/demo-scenario`, `/api/v1/geofences/*`, `/api/v1/health`).
- `frontend/`: Vite + React + TailwindCSS + Leaflet marine dashboard.
  - `package.json`: Frontend dependencies (`react`, `react-dom`, `leaflet`, `lucide-react`, `vite`, `tailwindcss`).
  - `vite.config.js`: Vite server and `/api` reverse proxy configuration to FastAPI (`http://localhost:8000`).
  - `tailwind.config.js` & `postcss.config.js`: Nautical Sea-Chart design tokens (`paper-*`, `ink-*`, `chart-*`, `risk-*`) and oceanic dark theme support.
  - `index.html`: Clean HTML5 entry point with Google Fonts (Outfit & Inter) and Leaflet CSS.
  - `public/`: Static production assets (`favicon.svg`, `CNAME` for orca.marine.gov.in).
  - `src/`:
    - `main.jsx`: React root mounting `App.jsx`.
    - `index.css`: Tailwind layer directives, custom dark-matter and sea-chart Leaflet styling, radar animations.
    - `App.jsx`: Main telemetry ribbon, persona switch (Fisher vs District Board), theme switcher, URL `?demo=` parameter loader, circuit breaker banner, and container.
    - `components/MarineMap.jsx`: Leaflet GIS map with 12 harbour pins, IMBL border with 5 NM buffer, MPA zones, PFZ hotspots, and A* safe route polyline.
    - `components/ChatPanel.jsx`: Multilingual chat supporting 1-click benchmark chips for all 8 SIH queries, 5 locked judge demo chips, 40px numeric safety dial, LISTEN TTS audio button, and structured evidence citations.
    - `components/DistrictAuthorityBoard.jsx`: Coast-wide 12-harbour table with live safety dials, state filtering, and instant transition to Fisher View.
    - `components/AgentTraceDrawer.jsx`: Multi-agent DAG timeline, latency meters (ms), confidence scores, Pydantic provenance inspector, and Evidence Ledger viewer.
    - `components/SafetyAlertBanner.jsx`: High-visibility Red/Amber maritime circuit breaker advisory header.
- `tests/`:
  - `test_tools.py`: 18 unit tests covering all deterministic marine tools, 0-100 safety index tiers, and evidence ledger entries.
  - `test_api.py`: 14 integration tests covering all 8 SIH evaluation queries, district-board endpoint, and demo-scenarios endpoint.

