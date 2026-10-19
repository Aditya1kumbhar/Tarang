# GEMINI.md — ORCA: Marine Ecosystem Reasoning with Collaborative Agents (SIH 2026 PS #20 / ID 26176)

## 1. SYSTEM IDENTITY & CORE OBJECTIVE
You are building **ORCA (Oceanographic Reasoning & Collaborative Agents)**, an enterprise-grade, real-world Agentic AI Marine Intelligence Platform for Indian fishermen, coastal authorities, researchers, and disaster managers.

### Non-Negotiable Engineering Rules (Strict Enforcement)
1. **ZERO HALLUCINATION IN SAFETY & GEOMETRY:** Never let an LLM calculate distances, bearings, wave thresholds, or polygon intersections. All spatial math, geofencing, A* routing, and weather hazard scoring MUST be executed by deterministic Python tools (`pyproj`, `shapely`, `numpy`, `networkx`).
2. **HARD-CODED SAFETY CIRCUIT BREAKER:** If any tool returns `risk_level == "CRITICAL"` (e.g., Wave Height > threshold, Cyclone/Lightning alert active, or Geofence distance < 1.5 NM from IMBL/MPA), the orchestrator MUST inject a mandatory `SAFETY_OVERRIDE_BANNER` at the top of the response regardless of LLM phrasing.
3. **100% WORKING LIVE + FALLBACK DATA PIPELINE:** Every external API call (Open-Meteo Marine, ERDDAP SST/Chlorophyll) must have an async timeout (`4.0s`) and automatically fall back to a pre-seeded realistic regional dataset in `backend/data/fallback/` so the system NEVER crashes offline or during coastal network drops.
4. **STRICT PYDANTIC PROVENANCE:** Every agent output must return structured JSON containing `source_dataset`, `timestamp_utc`, `coordinates`, `metrics`, `reasoning_trace`, and `confidence_score`.
5. **QUOTA-EFFICIENT EXECUTION:** Write modular, complete, self-contained files. Avoid unnecessary terminal loops. Run `pytest` to verify each phase before completing the walkthrough artifact.

---

## 2. TARGET REPOSITORY ARCHITECTURE
Maintain this exact directory structure:

```text
orca-agentic-marine/
├── GEMINI.md                          # Always-on system instructions
├── .env.example                       # GEMINI_API_KEY, DEFAULT_HARBOUR, etc.
├── backend/
│   ├── requirements.txt
│   ├── main.py                        # FastAPI entry point (/api/v1/chat, /api/v1/map-state, /api/v1/harbours)
│   ├── config.py                      # Thresholds, API URLs, vessel profiles
│   ├── schemas/
│   │   └── models.py                  # Strict Pydantic v2 schemas for Agent State, Provenance, GeoJSON
│   ├── data/
│   │   ├── harbours_india.json        # 12 major Indian fishing landing centres (Lat, Lon, State, Local Lang)
│   │   ├── geofences/
│   │   │   ├── imbl_lines.geojson     # Indo-Sri Lanka (Palk Bay/Gulf of Mannar) & Indo-Pak IMBL lines
│   │   │   └── mpa_zones.geojson      # Marine Protected Areas (Gulf of Mannar, Malvan, Bhitarkanika, Coringa)
│   │   └── fallback/
│   │       └── indian_ocean_grid.json # Realistic SST (°C) & Chlorophyll-a (mg/m3) grid for offline resilience
│   ├── tools/
│   │   ├── weather_marine_tool.py     # Live Open-Meteo Marine & Weather API + deterministic risk engine
│   │   ├── ocean_pfz_tool.py          # ERDDAP / Copernicus SST + Chl-a parser, Sobel thermal front & PFZ scorer
│   │   ├── geospatial_tool.py         # PyProj geodesic distance/bearing, Shapely IMBL/MPA geofence & A* router
│   │   └── productivity_tool.py       # Multi-temporal SST anomaly, eutrophication & productivity drop analyzer
│   └── agents/
│       ├── state.py                   # LangGraph / Async Orchestrator typed state
│       ├── orchestrator.py            # Multi-agent workflow (Planner -> Parallel Tools -> Circuit Breaker -> Synthesizer)
│       └── prompts.py                 # Multilingual & evidence-enforced system prompts
├── frontend/                          # Vite + React + TailwindCSS + Leaflet/MapLibre GL
│   ├── package.json
│   └── src/
│       ├── App.jsx                    # Split-screen: Interactive Marine GIS Map + Multi-Agent Chat & Reasoning Inspector
│       ├── components/
│       │   ├── MarineMap.jsx          # Renders PFZ markers, A* safe route, IMBL red line, MPA polygons, Vessel marker
│       │   ├── ChatPanel.jsx          # Multilingual chat, Quick Scenario buttons, Voice input/output (Web Speech API)
│       │   ├── AgentTraceDrawer.jsx   # Live visual inspection of which agents ran, tool inputs/outputs, provenance
│       │   └── SafetyAlertBanner.jsx  # High-visibility Red/Amber maritime advisory & geofence alert header
└── tests/
    ├── test_tools.py                  # Deterministic unit tests for PFZ math, geofencing, and A* routing
    └── test_api.py                    # End-to-end FastAPI test suite covering all 8 SIH problem statement queries
```

---

## 3. DETERMINISTIC DOMAIN ALGORITHMS (MUST IMPLEMENT IN `backend/tools/`)

### A. Potential Fishing Zone (PFZ) & Productivity Engine (`ocean_pfz_tool.py`)

1. **PFZ Scoring Formula:**
For candidate grid points within 15–80 km offshore of the user's harbour:
* **SST Optimality ($S_{\text{sst}}$):** Score = `1.0` if $25.5^\circ\text{C} \le SST \le 29.2^\circ\text{C}$, decaying linearly to `0.0` outside $[23.0^\circ\text{C}, 31.5^\circ\text{C}]$.
* **Thermal Front Gradient ($S_{\text{front}}$):** Compute local gradient $\vert{}\nabla SST\vert{}$ in $^\circ\text{C/km}$. Score = $\min(1.0, \vert{}\nabla SST\vert{} / 0.25)$. Fronts $\ge 0.15^\circ\text{C/km}$ indicate active upwelling/nutrient mixing.
* **Chlorophyll-a Score ($S_{\text{chl}}$):** Score = `1.0` if $0.4 \le \text{Chl-a} \le 3.0\text{ mg/m}^3$.
* **Composite PFZ Index:**

$$\text{PFZ\_Score} = 100 \times (0.40 \cdot S_{\text{front}} + 0.35 \cdot S_{\text{chl}} + 0.25 \cdot S_{\text{sst}})$$

* Return top 3 PFZ zones with exact Lat/Lon, Compass Bearing (e.g., `112° ESE`), Distance (`km` and `Nautical Miles`), estimated Depth (`m`), and biological rationale.

2. **Fish Productivity Decline Diagnosis (`productivity_tool.py`):**
* Evaluates three causal mechanisms using historical vs. current anomalies:
* **Marine Heatwave / Thermal Stratification:** $SST\text{ anomaly} > +1.8^\circ\text{C}$ suppresses thermocline nutrient upwelling, reducing surface $\text{Chl-a} < 0.15\text{ mg/m}^3$.
* **Harmful Algal Bloom (HAB) / Hypoxia:** $\text{Chl-a} > 5.5\text{ mg/m}^3$ near river mouths/estuaries causing oxygen depletion.
* **Extreme Turbidity / Cyclone Mixing:** Recent high wind/wave energy scattering pelagic shoals.

### B. Weather, Tide & Sea-Venture Safety Engine (`weather_marine_tool.py`)

1. Query live **Open-Meteo Marine API**:
`https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,ocean_current_velocity`
2. Query live **Open-Meteo Forecast API**:
`https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,cape,weather_code`
3. **Vessel Safety Matrix:**
* Support two vessel profiles: `country_craft` (artisanal/motorized boat) and `mechanized_trawler`.
* `country_craft` thresholds:
* `RED (DO NOT VENTURE)`: `wave_height >= 1.8m` OR `wind_speed >= 35 km/h` OR `wind_gusts >= 50 km/h` OR `cape >= 1500 J/kg` (lightning/squall risk) OR `swell_wave_period >= 13s` (Kallakkadal swell surge).
* `AMBER (CAUTION)`: `wave_height >= 1.2m` OR `wind_speed >= 25 km/h`.
* `GREEN (SAFE)`: Below Amber thresholds.
* `mechanized_trawler` thresholds:
* `RED (DO NOT VENTURE)`: `wave_height >= 2.8m` OR `wind_speed >= 45 km/h` OR `wind_gusts >= 60 km/h` OR `cape >= 2000 J/kg`.

### C. Geospatial Geofencing & A* Safe Vessel Routing (`geospatial_tool.py`)

1. **Geodesic Calculations:** Use `pyproj.Geod(ellps="WGS84").inv(lon1, lat1, lon2, lat2)` for all bearings and distances (`1 NM = 1.852 km`).
2. **Geofencing Engine:**
* Check vessel coordinates and planned route segments against `imbl_lines.geojson` (Indo-Sri Lanka & Indo-Pak maritime borders) and `mpa_zones.geojson` (Marine Protected Areas).
* If distance to IMBL $\le 1.5\text{ NM}$ or route intersects IMBL/MPA: set `geofence_violation = True`, `alert_level = "CRITICAL"`.
* If distance to IMBL $\le 5.0\text{ NM}$: set `alert_level = "WARNING"`.
3. **A* Safe Maritime Pathfinding:**
* Construct an offshore spatial graph between start harbour `(lat1, lon1)` and target PFZ/destination `(lat2, lon2)`.
* Edge weight = Geodesic distance $\times (1 + 2.0 \cdot (H_s / H_{\text{max}})^2 + 1.5 \cdot (W / W_{\text{max}})^2)$.
* Assign infinite cost ($\infty$) to nodes inside land polygons, MPA restricted polygons, or beyond the IMBL boundary.
* Return a valid GeoJSON `LineString` of waypoints with per-leg wave/wind conditions and estimated fuel/time saving.

---

## 4. COLLABORATIVE MULTI-AGENT ARCHITECTURE (`backend/agents/orchestrator.py`)

Implement a coordinated multi-agent workflow with full execution telemetry:

1. **`PlannerAgent`:** Detects input language (`ta`, `ml`, `te`, `kn`, `mr`, `gu`, `or`, `bn`, `hi`, `en`), extracts location/harbour, vessel type, and time horizon, and decomposes the query into a list of required specialist agents (`OceanAnalyticsAgent`, `WeatherHazardAgent`, `GeospatialNavigationAgent`, `ProductivityDiagnosticAgent`).
2. **Parallel Specialist Agent Execution (`asyncio.gather`):**
* `OceanAnalyticsAgent` -> Calls `ocean_pfz_tool`.
* `WeatherHazardAgent` -> Calls `weather_marine_tool`.
* `GeospatialNavigationAgent` -> Calls `geospatial_tool` (checking geofences for discovered PFZs and computing safe A* routes).
* `ProductivityDiagnosticAgent` -> Calls `productivity_tool`.
3. **`SafetyCircuitBreaker` (Deterministic Guardrail Node):**
* Inspects raw outputs from all agents. If any hazard or geofence violation is critical, locks `safety_status = "RED_ALERT"` and attaches mandatory non-overridable safety directives.
4. **`SynthesisExplainabilityAgent`:**
* Uses Gemini (`gemini-2.5-flash` via `google-genai` SDK, with deterministic template fallback if API key is unset) to synthesize all agent findings into the **exact language of the user's query**.
* Must output:
1. Direct Recommendation & Safety Verdict
2. Step-by-Step Evidence & Reasoning (citing exact SST, Chl-a, Wave Height, Wind Speed, and Geofence distances)
3. Interactive Map Payload (GeoJSON FeatureCollection for PFZ zones, Safe Route, Restricted Zones, and Hazard Markers)

---

## 5. PHASED EXECUTION PLAN (RUN ONE PHASE PER CONVERSATION)

### Phase 1: Foundation, Schemas & Real Geospatial Seed Data
* Create directory structure, `backend/requirements.txt`, `backend/config.py`, and `backend/schemas/models.py`.
* Populate `backend/data/harbours_india.json` (Rameswaram, Nagapattinam, Chennai, Kochi, Vizhinjam, Mangaluru, Malvan, Mumbai, Veraval, Visakhapatnam, Kakinada, Paradip).
* Populate `backend/data/geofences/imbl_lines.geojson` (accurate coordinates for Indo-Sri Lanka Palk Bay/Gulf of Mannar IMBL and Indo-Pak Sir Creek IMBL) and `mpa_zones.geojson` (Gulf of Mannar Marine National Park, Malvan Marine Sanctuary, Coringa, Bhitarkanika).
* Populate `backend/data/fallback/indian_ocean_grid.json` with realistic coastal SST & Chlorophyll-a gradients.

### Phase 2: Deterministic Marine, Weather & Geospatial Tools
* Implement `weather_marine_tool.py` (live Open-Meteo Marine + Forecast API with 4s timeout and fallback).
* Implement `ocean_pfz_tool.py` (ERDDAP/fallback grid ingestion, Sobel thermal gradient filter, PFZ scoring, excluding any PFZ points that violate IMBL or MPA geofences).
* Implement `geospatial_tool.py` (PyProj geodesic math, Shapely geofence buffer checks, and A* wave-aware safe routing).
* Implement `productivity_tool.py` (diagnosing coastal fish productivity decline using SST anomaly and Chl-a eutrophication/stratification metrics).
* Write and run `tests/test_tools.py` to verify 100% pass rate.

### Phase 3: Collaborative Multi-Agent Orchestrator & FastAPI Backend
* Implement `backend/agents/state.py`, `prompts.py`, and `orchestrator.py` with full agent trace logging (agent name, task, latency_ms, input, output, citations).
* Implement `SafetyCircuitBreaker` guardrail.
* Implement multilingual detection and response generation (supporting English + Indian regional languages like Tamil, Malayalam, Telugu, Marathi, Hindi, Odia).
* Build `backend/main.py` with endpoints:
* `POST /api/v1/chat` (Multi-turn conversational agent query)
* `GET /api/v1/harbours` (List harbours & live status)
* `GET /api/v1/dashboard-summary?harbour_id=...` (Immediate PFZ + Weather + Geofence snapshot)
* Write and run `tests/test_api.py` testing all 8 SIH problem statement sample queries.

### Phase 4: Interactive Marine GIS Frontend & Agent Reasoning Inspector
* Build the React + TailwindCSS + Leaflet/MapLibre dashboard in `frontend/`.
* Include:
1. **Interactive Ocean Map:** Shows Harbour marker, top PFZ polygons (green/gold), A* safe vessel route (cyan dashed line with directional arrows), IMBL border (red solid line with 5 NM amber buffer), and MPA zones (purple shaded polygons).
2. **Conversational Agent Panel:** Pre-loaded 1-click chips for all 8 SIH benchmark queries, language selector (English, தமிழ், മലയാളம், తెలుగు, मराठी, हिन्दी), and Voice Mic/Speaker toggle (Web Speech API).
3. **Collaborative Agent Trace Inspector:** Visualizes the live DAG execution (`Planner -> [Ocean Agent | Weather Agent | Geospatial Agent] -> Circuit Breaker -> Synthesizer`) with timestamps, confidence scores, and raw dataset citations.
4. **Proactive Safety & Geofence Alert Bar:** Flashes Red/Amber warnings when approaching IMBL/MPA boundaries or during high wave/lightning alerts.

### Phase 5: End-to-End Integration, Browser Verification & Walkthrough Artifact
* Start backend (`uvicorn backend.main:app --port 8000`) and frontend (`npm run dev`).
* Verify all 8 SIH user queries render live map layers, safety banners, and explainable reasoning traces.