---
name: verify-sih-queries
description: Automatically benchmarks and verifies all 8 SIH 2026 Problem Statement #20 (ID 26176) evaluation queries against the ORCA agentic marine backend.
---

# Verify SIH 2026 Problem Statement #20 Queries (ORCA)

This skill executes and validates the 8 official evaluation queries for **SIH 2026 PS #20 (ID 26176 — ORCA: Oceanographic Reasoning & Collaborative Agents)**.

## The 8 Benchmark Evaluation Scenarios

1. **Query 1: PFZ Discovery with Geodesic Bearing & Distance**
   - *Prompt:* "Find the highest confidence Potential Fishing Zones (PFZ) offshore from Rameswaram harbour."
   - *Expected:* Top 3 PFZs, SST between 25.5-29.2°C, Chl-a between 0.4-3.0 mg/m³, Sobel thermal gradient ≥ 0.15°C/km, compass bearing (e.g., 112° ESE), distance in km and NM.

2. **Query 2: Country Boat Sea-Venture Safety Check**
   - *Prompt:* "Is it safe for a small motorized country craft (Vallam) to venture into the sea off Kochi tomorrow morning?"
   - *Expected:* Country craft thresholds applied (Hs ≥ 1.8m or Wind ≥ 35 km/h or Swell Period ≥ 13s -> RED ALERT). Clear advisory with live weather metrics.

3. **Query 3: Mechanized Trawler Differential Safety Check**
   - *Prompt:* "Can a 45ft mechanized trawler venture out from Veraval harbour in Gujarat with 32 km/h winds and 2.1m wave height?"
   - *Expected:* Differential vessel evaluation. Mechanized trawler can tolerate moderate sea conditions up to 2.8m wave height and 45 km/h winds -> AMBER / GREEN with caution, unlike small country boats.

4. **Query 4: IMBL Proximity & Geofence Circuit Breaker**
   - *Prompt:* "Find fishing coordinates 12 nautical miles East-Southeast of Rameswaram towards Talaimannar."
   - *Expected:* Proximity to Indo-Sri Lanka International Maritime Boundary Line (IMBL). Must trigger WARNING (<5 NM) or CRITICAL GEOFENCE VIOLATION (<1.5 NM). Hard safety override banner injected.

5. **Query 5: Marine Protected Area (MPA) Exclusion**
   - *Prompt:* "Can we set our nets inside the Gulf of Mannar Marine National Park or near Malvan Marine Sanctuary?"
   - *Expected:* Deterministic MPA polygon intersection check. Geofence violation returned, strictly advising no-take zone compliance with alternative offshore coordinates.

6. **Query 6: A* Wave-Aware Safe Maritime Pathfinding**
   - *Prompt:* "Calculate a safe navigation route from Chennai harbour to the PFZ cluster avoiding rough seas."
   - *Expected:* GeoJSON LineString of waypoints calculated using wave/wind-weighted A* algorithm, strictly circumnavigating land, MPAs, and IMBL boundaries with fuel/time efficiency stats.

7. **Query 7: Marine Ecosystem Reasoning & Productivity Decline Diagnosis**
   - *Prompt:* "Why has pelagic fish catch dropped significantly off the Mangaluru coast over the past two weeks?"
   - *Expected:* Multi-temporal SST anomaly, stratification, dissolved oxygen proxy, or harmful algal bloom / eutrophication diagnosis (Chl-a > 5.5 mg/m³ or SST anomaly > +1.8°C).

8. **Query 8: Multilingual Regional Fisher Query (Tamil / Malayalam / Hindi)**
   - *Prompt:* "இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா? காற்று மற்றும் அலை எப்படி உள்ளது?"
   - *Expected:* Automatic language detection (`ta`), full reasoning trace, deterministic safety check, and complete response synthesized in Tamil with English provenance citations.

---

## Verification Execution Steps

Run the test suite via the Antigravity terminal:

```bash
# Run deterministic tool unit tests
pytest tests/test_tools.py -v

# Run end-to-end multi-agent API integration tests
pytest tests/test_api.py -v
```
