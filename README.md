# ORCA: Oceanographic Reasoning & Collaborative Agents
### Smart India Hackathon (SIH 2026) Problem Statement #20 (ID 26176)
**Autonomous Marine Intelligence & Decision-Support Platform for Indian Fisheries, Coastal Authorities, and Disaster Management**

---

## 1. System Overview

**ORCA** is an enterprise-grade Agentic AI marine intelligence platform that integrates satellite Earth Observation (EO) products, real-time meteorological forecasts, coastal bathymetry, and maritime boundary geofencing to provide explainable, context-aware decision support for Indian fishermen and coastal authorities.

### Key Highlights
- **Zero Hallucination in Geometry & Safety**: All spatial math, geodesic boundaries, wave hazard scoring, and A* navigation pathfinding are computed by deterministic Python tools (`pyproj`, `shapely`, `numpy`, `networkx`).
- **Hard-Coded Safety Circuit Breaker**: If wave height, wind shear, lightning (CAPE), or boundary proximity breaches critical thresholds, a mandatory safety override banner is enforced regardless of conversational phrasing.
- **Mission Provenance & EOS-06 SSTM Anomaly Resolution**: Fuses Oceansat-3 (EOS-06) OCM-3 chlorophyll bio-optics and SCAT-3 wind vectors with INSAT-3DS Imager and MODIS-Aqua SST, explicitly documenting sensor payloads and operational status.
- **Deterministic 0-100 Sea-Venture Safety Index**: Multi-factor additive safety scoring calibrated for country crafts ($H_{\text{crit}} = 1.8\text{m}$) and mechanized trawlers ($H_{\text{crit}} = 2.8\text{m}$).
- **Dual-Persona Interface**:
  - **Fisher View**: Tactical single-vessel safety clearance, PFZ hotspot bearings, safe routing waypoints, and native speech audio.
  - **District Authority Board**: Coast-wide surveillance across all 12 major Indian landing centres with state-wise filtering.
- **Multilingual Support**: Real-time script detection and responses across English and 9 Indian regional languages (Tamil, Malayalam, Telugu, Kannada, Marathi, Gujarati, Odia, Bengali, Hindi).

---

## 2. Multi-Agent Architecture

```text
User Query (Voice or Indic Text)
  │
  ▼
PlannerAgent (Intent Parser, Vessel Classifier, Task Decomposer)
  │
  ├──► OceanAnalyticsAgent ────► ocean_pfz_tool.py (SST Gradient, Chl-a, 7-Day Persistence)
  ├──► WeatherHazardAgent ─────► weather_marine_tool.py (Wave, Wind, Swell, CAPE Lightning, 0-100 Index)
  ├──► GeospatialNavAgent ─────► geospatial_tool.py (PyProj Geodesics, Shapely IMBL/MPA, A* Router)
  └──► ProductivityAgent ──────► productivity_tool.py (Marine Heatwave, Hypoxia/HAB, Turbidity Diagnostics)
  │
  ▼
SafetyCircuitBreaker (Deterministic Guardrail Node)
  │
  ├── [CRITICAL HAZARD] ──► Lock RED_ALERT, Inject Statutory Advisory Header, Quarantine PFZs
  └── [NORMAL] ──────────► Pass Verified State & Evidence Ledger
  │
  ▼
SynthesisExplainabilityAgent (Native Indic Synthesis + Evidence Citations + GeoJSON Map Payload)
```

---

## 3. SIH Problem Statement Query Coverage

ORCA directly benchmarks and solves all 8 queries outlined in the official SIH 2026 Problem Statement:

| # | Benchmark Query | Specialist Pipeline & Action |
|---|---|---|
| **Q1** | *Nearest Potential Fishing Zone (PFZ) today?* | Composite thermal gradient ($\nabla SST \ge 0.15^\circ\text{C/km}$) + Chl-a ($0.4-3.0\text{ mg/m}^3$) with Cayula-Cornillon bimodal front classification and geofence quarantine. |
| **Q2** | *Is it safe to venture into the sea tomorrow morning for a country craft?* | Checks artisanal craft limits ($H_s < 1.8\text{m}$, wind $< 35\text{ km/h}$, swell $< 13\text{s}$, $\text{CAPE} < 1500\text{ J/kg}$) and computes 0-100 Sea-Venture Safety Index. |
| **Q3** | *Can a 45ft mechanized trawler venture out in 32 km/h wind and 2.1m waves?* | Evaluates differential vessel limits ($H_s < 2.8\text{m}$, wind $< 45\text{ km/h}$), issuing safe clearance for trawlers while warning country craft. |
| **Q4** | *Find fishing coordinates 12 NM East-Southeast of Rameswaram towards Talaimannar.* | Geodesic calculation detects distance $\le 1.5\text{ NM}$ to Indo-Sri Lanka IMBL, triggering immediate `RED_ALERT` circuit breaker and boundary retreat advisory. |
| **Q5** | *Can we set our nets inside Gulf of Mannar Marine National Park?* | Point-in-polygon query against `mpa_zones.geojson` issues strict legal exclusion under Wildlife Protection Act. |
| **Q6** | *Safest route for a fishing vessel considering weather and sea state?* | Wave-weighted A* pathfinder builds dynamic offshore graph avoiding land, MPAs, and rough seas with GeoJSON waypoints. |
| **Q7** | *Why has fish productivity declined in a particular coastal region?* | Multi-temporal SST and Chl-a anomaly analysis diagnosing Marine Heatwave / thermal stratification, Hypoxia/HAB, or cyclone turbidity. |
| **Q8** | *Native Indic query: இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா?* | Auto-detects Tamil script (`ta`), executes specialist agents, and synthesizes verdict, metrics, and reasoning in authentic Tamil with Web Speech audio. |

---

## 4. Repository Structure

```text
Tarang/
├── backend/
│   ├── main.py                     # FastAPI server routes (/chat, /harbours, /dashboard-summary, /district-board, /demo-scenario)
│   ├── config.py                   # Calibrated safety thresholds, API URLs, vessel profiles
│   ├── requirements.txt            # Python dependencies (FastAPI, PyProj, Shapely, NumPy, NetworkX, Pytest)
│   ├── schemas/
│   │   └── models.py               # Pydantic v2 data models, EvidenceLedgerEntry, DistrictBoardResponse
│   ├── data/
│   │   ├── harbours_india.json     # 12 major Indian landing centres (Lat, Lon, State, Local Language)
│   │   ├── geofences/
│   │   │   ├── imbl_lines.geojson  # Indo-Sri Lanka & Indo-Pak IMBL coordinates
│   │   │   └── mpa_zones.geojson   # Marine Protected Areas (Gulf of Mannar, Malvan, Coringa, Gahirmatha)
│   │   └── fallback/
│   │       └── indian_ocean_grid.json # Offline coastal SST & Chl-a oceanographic grid
│   ├── tools/
│   │   ├── weather_marine_tool.py  # Live Open-Meteo API + 0-100 Sea-Venture Safety Index engine
│   │   ├── ocean_pfz_tool.py       # Thermal front gradient, bio-optical scoring, and geofence quarantine
│   │   ├── geospatial_tool.py      # PyProj geodesic math, Shapely boundary buffers, and A* safe router
│   │   └── productivity_tool.py    # Multi-temporal anomaly & fish productivity decline diagnostic
│   └── agents/
│       ├── state.py                # Typed orchestrator state with evidence ledger
│       ├── prompts.py              # Multilingual system prompts and script detectors
│       └── orchestrator.py         # Multi-agent coordinator and safety circuit breaker
├── frontend/                       # Vite + React 18 + TailwindCSS + Leaflet GIS
│   ├── package.json
│   ├── tailwind.config.js          # Drafted Nautical Sea-Chart design tokens & dark mode
│   └── src/
│       ├── App.jsx                 # Dual-persona switch, theme toggle, and URL demo param handler
│       ├── components/
│       │   ├── MarineMap.jsx       # Interactive Leaflet GIS (Harbours, PFZ hotspots, IMBL line, MPAs, A* Route)
│       │   ├── ChatPanel.jsx       # Multilingual chat, 40px numeric safety dial, 1-click SIH & Demo chips, LISTEN TTS
│       │   ├── DistrictAuthorityBoard.jsx # Coast-wide fleet surveillance board across all 12 Indian landing centres
│       │   ├── AgentTraceDrawer.jsx # Multi-agent DAG timeline, latency meters, and Evidence Ledger viewer
│       │   └── SafetyAlertBanner.jsx # High-visibility Red/Amber circuit breaker header
├── tests/
│   ├── test_tools.py               # 18 unit tests for deterministic marine math, geofences, and safety index
│   └── test_api.py                 # 14 integration tests covering all 8 SIH benchmark queries & endpoints
├── CODEMAP.md                      # Architecture registry and living component map
├── GEMINI.md                       # Master system instructions & non-negotiable invariants
└── pytest.ini                      # Test runner configuration with auto-asyncio
```

---

## 5. Quick Start Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Backend Setup
```bash
# 1. Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API documentation available at `http://localhost:8000/docs`.

### Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### Hackathon Evaluation Quick Scenarios
You can load pre-configured evaluation scenarios instantly via URL parameters:
- `http://localhost:5173/?demo=safe` : Goa/Malvan country craft under calm seas (Safety Index: 9, LOW).
- `http://localhost:5173/?demo=danger` : Mumbai craft facing 34 km/h wind shear and wave hazard (Safety Index: 70, HIGH).
- `http://localhost:5173/?demo=cyclone` : Paradip craft facing severe depression / cyclone alert (Safety Index: 92, EXTREME).
- `http://localhost:5173/?demo=pfz` : Rameswaram high-confidence chlorophyll thermal upwelling zone.
- `http://localhost:5173/?demo=route` : Chennai A* safe navigation path circumscribing rough waters.

---

## 6. Testing & Quality Assurance

Run the comprehensive test suite verifying all 32 unit and integration tests:

```bash
# Run all tests
pytest -v

# Output: 32 passed, 100% pass rate
```

Verify the frontend production bundle:
```bash
cd frontend
npm run build
```
