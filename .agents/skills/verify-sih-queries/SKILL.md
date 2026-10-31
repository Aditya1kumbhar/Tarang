---
name: verify-sih-queries
description: Automatically benchmarks and verifies all 8 official SIH 2026 Problem Statement ID 26176 (SIH26176) evaluation queries against the ORCA agentic marine backend.
---

# Verify SIH 2026 Problem Statement ID 26176 (SIH26176) Queries (ORCA)

This skill executes and validates the 8 official evaluation queries for **SIH 2026 Problem Statement ID 26176 (SIH26176) — ORCA: Marine EcOsystem Reasoning with Collaborative Agents**.
- **Organization:** Indian Space Research Organisation (ISRO), Department of Space
- **Theme:** Miscellaneous

## The 8 Official Benchmark Evaluation Queries

1. **Official Query 1: Nearest Potential Fishing Zone (PFZ)**
   - *Prompt:* "Where is the nearest Potential Fishing Zone (PFZ) today?"
   - *Pipeline:* PlannerAgent -> OceanAnalyticsAgent (`compute_pfz_zones` thermal gradient $\nabla SST \ge 0.15^\circ\text{C/km}$ + Chl-a $0.4-3.0\text{ mg/m}^3$) + GeospatialNavigationAgent geofence quarantine.
   - *Test:* `test_sih_official_query_1_pfz_discovery`

2. **Official Query 2: Sea-Venture Safety Clearance**
   - *Prompt:* "Is it safe to venture into the sea tomorrow morning?"
   - *Pipeline:* PlannerAgent -> WeatherHazardAgent (`get_weather_marine_report` checking vessel wave, wind, swell, and CAPE thresholds) + SafetyCircuitBreaker.
   - *Test:* `test_sih_official_query_2_safety_venture_tomorrow`

3. **Official Query 3: Tide, Weather, and Sea Conditions**
   - *Prompt:* "What are the tide, weather, and sea conditions near my fishing location?"
   - *Pipeline:* PlannerAgent -> WeatherHazardAgent (Open-Meteo marine and weather APIs querying wave height, swell period/dir, wind speed/gusts, tidal drift currents).
   - *Test:* `test_sih_official_query_3_tide_weather_sea_conditions`

4. **Official Query 4: Lightning and Cyclone Alerts**
   - *Prompt:* "Are there any lightning or cyclone alerts in my area?"
   - *Pipeline:* PlannerAgent -> WeatherHazardAgent (CAPE convective potential energy lightning assessment, cyclonic swell surge detection, and safety alert state).
   - *Test:* `test_sih_official_query_4_lightning_or_cyclone_alerts`

5. **Official Query 5: High Chlorophyll and Favourable SST Regions**
   - *Prompt:* "Which regions show high chlorophyll concentration and favourable sea surface temperature?"
   - *Pipeline:* PlannerAgent -> OceanAnalyticsAgent (Biophysical PFZ ranking evaluating optimal SST $25.5-29.2^\circ\text{C}$ and chlorophyll-a concentrations).
   - *Test:* `test_sih_official_query_5_chlorophyll_and_sst_regions`

6. **Official Query 6: Safest Navigation Route**
   - *Prompt:* "What is the safest route for a fishing vessel considering weather and sea-state conditions?"
   - *Pipeline:* PlannerAgent -> GeospatialNavigationAgent (`compute_astar_route` wave-weighted A* pathfinder on 0.05° grid avoiding rough waters, land, and MPAs).
   - *Test:* `test_sih_official_query_6_safest_vessel_route`

7. **Official Query 7: Fish Productivity Decline Diagnosis**
   - *Prompt:* "Why has fish productivity declined in a particular coastal region?"
   - *Pipeline:* PlannerAgent -> ProductivityDiagnosticAgent (`diagnose_productivity_decline` diagnosing Marine Heatwave thermal stratification, HAB hypoxia, or turbidity).
   - *Test:* `test_sih_official_query_7_productivity_decline`

8. **Official Query 8: Avoided Zones (Hazardous Conditions or Geofencing Restrictions)**
   - *Prompt:* "Which fishing zones should be avoided due to hazardous marine conditions or geofencing restrictions?"
   - *Pipeline:* PlannerAgent -> GeospatialNavigationAgent (`evaluate_geofence` against IMBL boundaries and MPA polygons) + WeatherHazardAgent hazardous sea quarantine.
   - *Test:* `test_sih_official_query_8_hazardous_or_geofenced_zones`

## Extended Evaluation Scenarios

The platform also includes 4 extended operational scenarios testing vessel tolerances, border alerts, statutory exclusions, and multilingual synthesis:
1. **45ft Trawler Differential Limits:** "Can a 45ft mechanized trawler venture out from Veraval harbour in Gujarat with 32 km/h winds and 2.1m wave height?" (`test_extended_scenario_mechanized_trawler_differential_veraval`)
2. **Rameswaram 12 NM ESE IMBL Coordinates:** "Find fishing coordinates 12 nautical miles East-Southeast of Rameswaram towards Talaimannar." (`test_extended_scenario_imbl_proximity_and_circuit_breaker`)
3. **Gulf of Mannar Restricted MPA Nets:** "Can we set our nets inside the Gulf of Mannar Marine National Park?" (`test_extended_scenario_mpa_exclusion`)
4. **Tamil Native Query:** "இன்று ராமேஸ்வரத்திலிருந்து சிறிய படகில் கடலுக்கு செல்லலாமா? காற்று மற்றும் அலை எப்படி உள்ளது?" (`test_extended_scenario_multilingual_tamil_query`)

## Verification Command
```bash
.venv/bin/pytest tests/test_tools.py tests/test_api.py -v
```
