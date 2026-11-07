# Micro-Step Efficiency Plan for Resource-Constrained Deployment

## 1. Verified Current State

- **Platform Invariants & Production Reality:**
  - Production deployment operates on a Render free tier instance constrained to 0.1 vCPU and 512 MB RAM.
  - Production logs recorded a full fleet warm taking 1691.99 seconds: `Marine Data Cache pre-warming complete: 12/12 harbours ready in 1691.99s`.
  - UptimeRobot measured production availability at 49.047% over an evening evaluation window due to CPU exhaustion and event-loop starvation.
  - Test suite baseline at commit `4ada389` is verified at 114 tests passing (`pytest` / `.venv/bin/pytest`).

- **Harbour Fleet Inventory:**
  - The complete list of 12 harbour identifiers loaded by `load_harbours_dict` in `backend/tools/ocean_pfz_tool.py` from `backend/data/harbours_india.json` (all lowercase) is:
    1. `rameswaram`
    2. `nagapattinam`
    3. `chennai`
    4. `kochi`
    5. `vizhinjam`
    6. `mangaluru`
    7. `malvan`
    8. `mumbai`
    9. `veraval`
    10. `visakhapatnam`
    11. `kakinada`
    12. `paradip`

- **Background Tasks & Warming Cadence:**
  - In `backend/tools/marine_cache.py`, symbol `start_background_tasks` launches two concurrent background loops:
    1. `_initial_warm_and_weather_loop`: Invokes `self.warm_all_harbours(timeout_per_harbour=12.0)` at startup, then enters an infinite loop executing `await asyncio.sleep(600)` followed by `self.warm_all_harbours(timeout_per_harbour=20.0)`.
    2. `_satellite_daily_loop`: Enters an infinite loop executing `await asyncio.sleep(86400)` followed by `self.warm_all_harbours(timeout_per_harbour=15.0)`.
  - In `backend/tools/marine_cache.py`, symbol `warm_all_harbours` warms all 12 registered Indian landing centres sequentially with `FLEET_WARM_GAP_SECONDS = 2.0` between iterations.
  - In `backend/tools/marine_cache.py`, symbol `get_or_refresh_harbour` serves cold entries immediately via `create_fallback_entry` and schedules at most one background warm behind `_refresh_inflight`. Stale fallback entries trigger background re-warming only when older than `FALLBACK_REFRESH_MIN_AGE_SECONDS = 120.0`.

- **Satellite ERDDAP & PFZ Lifecycle:**
  - In `backend/tools/satellite_erddap.py`, daily datasets (NOAA Coral Reef Watch SST and VIIRS Chlorophyll-a) are cached in memory via `_SST_CACHE` and `_CHL_CACHE` with `_CACHE_TTL_SECONDS = 6 * 3600` (21600 seconds / 6 hours).
  - In `backend/tools/marine_cache.py`, symbol `HarbourCacheEntry` stores `fetched_at`, `weather_timestamp`, and `satellite_timestamp`, but contains no dedicated timestamp tracking when `compute_pfz_zones` was executed for that harbour.
  - In `backend/tools/marine_cache.py`, symbol `warm_harbour` executes `compute_pfz_zones(harbour_id=harbour.id, max_candidates=3)` under `PFZ_WARM_BUDGET_SECONDS = 25.0` on every warm invocation without an age guard.

- **Dashboard Summary Inline Live Fetch:**
  - In `backend/main.py`, symbol `_compute_dashboard_summary_impl` calls `marine_cache.get_or_refresh_harbour(harbour, max_refresh_timeout=12.0)`.
  - If `weather = cached_entry.weather_by_vessel.get(vessel_type.value)` is missing, `_compute_dashboard_summary_impl` invokes `await get_weather_marine_report(...)` directly and inline over the network, blocking the request and consuming external API quota.

- **Frontend Polling Cadence:**
  - In `frontend/src/App.jsx`, inside the `useEffect` hook managing active harbour summaries, `setInterval` triggers `fetchDashboardSummary(selectedHarbour.id, vesselType)` every `30000` ms (30 seconds).
  - In `frontend/src/components/DistrictAuthorityBoard.jsx`, inside the `useEffect` hook managing maritime surveillance feeds, `setInterval` triggers `fetchBoardData()` every `30000` ms (30 seconds).

---

## 2. Decisions Needed

- **Decision 1: VIP Harbour List for Startup and Periodic Warming**
  - **Option A (RECOMMENDED - SELECTED):** Warm only `["rameswaram"]` on application startup and maintain periodic refresh only for Rameswaram plus any harbour actively requested by users.
    - *Rationale:* Rameswaram is the application's default landing centre (`DEFAULT_HARBOUR_ID = "rameswaram"` in `backend/config.py`). Startup warm drops from 1691.99s across 12 harbours to ~12-25s for 1 harbour, leaving 0.1 vCPU idle immediately. All other harbours use the verified non-blocking `get_or_refresh_harbour` machinery to warm on-demand only when a user visits them.
  - **Option B:** Warm the top 3 coastal hub harbours `["rameswaram", "kochi", "visakhapatnam"]` covering Palk Bay, Arabian Sea, and Bay of Bengal.
    - *Trade-off:* Triples startup warming work (~45-75s) while warming harbours that may not be viewed in a given container lifespan.
  - **Option C:** Warm zero harbours at startup (`[]`), starting completely cold and warming strictly on-demand.
    - *Trade-off:* First user visit to Rameswaram receives deterministic fallback data for the initial 15-20 seconds while background warming runs.

- **Decision 2: Active Harbour Tracking Eviction Policy**
  - **Option A (RECOMMENDED - SELECTED):** Keep requested harbours in an in-memory set `self._requested_harbour_ids: set[str]` within `MarineDataCache` for the container lifespan.
    - *Rationale:* Simple and zero-dependency; with only 12 harbours total in India, the set cannot exceed 12 string references.
  - **Option B:** Restrict `_requested_harbour_ids` to the last 3 accessed harbours using an LRU eviction or timestamp check.
    - *Trade-off:* Adds unnecessary tracking logic for a collection bounded by at most 12 elements.

---

## 3. Micro Steps

1. `backend/tools/marine_cache.py`, symbol `HarbourCacheEntry`: Add `pfz_computed_at: Optional[datetime] = None` field to record zone calculation timestamp.
   Verification: Inspect dataclass definition and instantiate a test `HarbourCacheEntry` with `pfz_computed_at`.
2. `backend/tools/marine_cache.py`, symbol `PFZ_RECOMPUTE_INTERVAL_SECONDS`: Define module constant `PFZ_RECOMPUTE_INTERVAL_SECONDS = 21600.0`.
   Verification: Import constant in Python interactive session and verify value equals 21600.0.
3. `backend/tools/marine_cache.py`, symbol `WEATHER_REFRESH_INTERVAL_SECONDS`: Define module constant `WEATHER_REFRESH_INTERVAL_SECONDS = 1800.0`.
   Verification: Import constant in Python interactive session and verify value equals 1800.0.
4. `backend/tools/marine_cache.py`, symbol `VIP_HARBOUR_IDS`: Define module constant `VIP_HARBOUR_IDS = ("rameswaram",)`.
   Verification: Confirm tuple contains `"rameswaram"`.
5. `backend/tools/marine_cache.py`, symbol `MarineDataCache.__init__`: Initialize `self._requested_harbour_ids: set = set()` on cache instance.
   Verification: Instantiate `MarineDataCache()` and assert `cache._requested_harbour_ids == set()`.
6. `backend/tools/marine_cache.py`, symbol `MarineDataCache.create_fallback_entry`: Explicitly set `pfz_computed_at=None` in constructed `HarbourCacheEntry`.
   Verification: Call `cache.create_fallback_entry(harbour)` and assert `entry.pfz_computed_at is None`.
7. `backend/tools/marine_cache.py`, symbol `MarineDataCache.warm_harbour`: Check existing entry's `pfz_computed_at` and skip `compute_pfz_zones` if age is under `PFZ_RECOMPUTE_INTERVAL_SECONDS`.
   Verification: Warm a harbour twice within 10 seconds; assert `compute_pfz_zones` is executed only on the first call.
8. `backend/tools/marine_cache.py`, symbol `MarineDataCache.warm_harbour`: Set `pfz_computed_at=datetime.now(timezone.utc)` when `res_pfz` is a `PFZReport`, or preserve existing timestamp when skipped.
   Verification: Warm harbour and assert returned entry has `isinstance(entry.pfz_computed_at, datetime)`.
9. `backend/tools/marine_cache.py`, symbol `MarineDataCache.get_or_refresh_harbour`: Add `harbour.id.lower()` to `self._requested_harbour_ids` upon retrieval.
   Verification: Call `get_or_refresh_harbour` with a harbour and assert its ID exists in `cache._requested_harbour_ids`.
10. `backend/tools/marine_cache.py`, symbol `MarineDataCache.warm_vip_harbours`: Implement helper to warm only harbours in `VIP_HARBOUR_IDS` sequentially.
    Verification: Mock `warm_harbour`, call `warm_vip_harbours()`, and assert only Rameswaram was warmed.
11. `backend/tools/marine_cache.py`, symbol `MarineDataCache.warm_vip_harbours`: Log completion in the same format as `warm_all_harbours` (`Marine Data Cache pre-warming complete: %d/%d harbours ready in %.2fs`).
    Verification: Call `warm_vip_harbours` and assert log output format matches `Marine Data Cache pre-warming complete: %d/%d harbours ready in %.2fs`.
12. `backend/tools/marine_cache.py`, symbol `MarineDataCache.start_background_tasks`: Replace full-fleet startup warm in `_initial_warm_and_weather_loop` with `await self.warm_vip_harbours()`.
    Verification: Start background tasks and assert `warm_all_harbours` is never invoked at startup.
13. `backend/tools/marine_cache.py`, symbol `MarineDataCache.start_background_tasks`: Update periodic loop sleep from 600 to `WEATHER_REFRESH_INTERVAL_SECONDS` (1800 seconds).
    Verification: Inspect loop body and verify `await asyncio.sleep(WEATHER_REFRESH_INTERVAL_SECONDS)`.
14. `backend/tools/marine_cache.py`, symbol `MarineDataCache.start_background_tasks`: Update periodic loop iteration to warm only `VIP_HARBOUR_IDS` union `self._requested_harbour_ids`.
    Verification: Assert loop iterates over VIP plus requested IDs instead of `load_harbours_dict().values()`.
15. `backend/tools/marine_cache.py`, symbol `MarineDataCache.start_background_tasks`: Delete the `_satellite_daily_loop` inner coroutine function.
    Verification: Confirm `_satellite_daily_loop` symbol does not exist in `MarineDataCache.start_background_tasks`.
16. `backend/tools/marine_cache.py`, symbol `MarineDataCache.start_background_tasks`: Remove task registration `self._bg_tasks.append(loop.create_task(_satellite_daily_loop()))`.
    Verification: Call `start_background_tasks()` and assert `len(cache._bg_tasks) == 1`.
17. `backend/main.py`, symbol `_compute_dashboard_summary_impl`: Replace inline `await get_weather_marine_report(...)` with fallback weather from `marine_cache.create_fallback_entry(harbour)`.
    Verification: Mock `get_weather_marine_report` to raise exception, invoke `_compute_dashboard_summary_impl`, and assert no error is raised.
18. `frontend/src/App.jsx`, symbol `useEffect`: Change panel refresh `setInterval` delay from 30000 to 120000 ms.
    Verification: Inspect `App.jsx` and assert `120000` is the second argument of `setInterval`.
19. `frontend/src/components/DistrictAuthorityBoard.jsx`, symbol `useEffect`: Change board refresh `setInterval` delay from 30000 to 120000 ms.
    Verification: Inspect `DistrictAuthorityBoard.jsx` and assert `120000` is the second argument of `setInterval`.
20. `tests/test_efficiency.py`, symbol `test_start_background_tasks_performs_no_full_fleet_warm`: Implement test asserting `warm_all_harbours` is not called on task startup.
    Verification: Run `pytest tests/test_efficiency.py -k test_start_background_tasks_performs_no_full_fleet_warm`.
21. `tests/test_efficiency.py`, symbol `test_vip_loop_warms_only_listed_harbours`: Implement test asserting periodic loop warms only VIP and requested harbours.
    Verification: Run `pytest tests/test_efficiency.py -k test_vip_loop_warms_only_listed_harbours`.
22. `tests/test_efficiency.py`, symbol `test_dashboard_summary_performs_zero_live_weather_calls`: Implement test asserting `get_weather_marine_report` is not called on dashboard summary fetch.
    Verification: Run `pytest tests/test_efficiency.py -k test_dashboard_summary_performs_zero_live_weather_calls`.
23. `tests/test_efficiency.py`, symbol `test_pfz_guard_skips_recomputation_inside_21600_seconds`: Implement test asserting `compute_pfz_zones` is skipped when existing PFZ is younger than 21600s.
    Verification: Run `pytest tests/test_efficiency.py -k test_pfz_guard_skips_recomputation_inside_21600_seconds`.
24. `tests/test_efficiency.py`, symbol `test_on_demand_warm_fires_once_on_cache_miss`: Implement test asserting cold harbour returns fallback immediately and fires background warm once.
    Verification: Run `pytest tests/test_efficiency.py -k test_on_demand_warm_fires_once_on_cache_miss`.
25. `PROJECT_STATE.md`, symbol `## 2026-11-07 efficiency and background warm elimination`: Append entry documenting the efficiency changes and verification results.
    Verification: Read end of `PROJECT_STATE.md` to verify markdown entry structure.

---

## 4. Test Plan

A dedicated test suite file `tests/test_efficiency.py` will be created using the existing style from `tests/test_fleet_warm_serialization.py` to prove all five efficiency invariants:

1. `test_start_background_tasks_performs_no_full_fleet_warm`:
   - Assertion: `assert mock_warm_all.call_count == 0` when `start_background_tasks()` runs.
2. `test_vip_loop_warms_only_listed_harbours`:
   - Assertion: `assert set(warmed_harbour_ids) == set(VIP_HARBOUR_IDS) | requested_ids`.
3. `test_dashboard_summary_performs_zero_live_weather_calls`:
   - Assertion: `mock_get_weather.assert_not_called()` during execution of `_compute_dashboard_summary_impl`.
4. `test_pfz_guard_skips_recomputation_inside_21600_seconds`:
   - Assertion: `mock_compute_pfz.assert_not_called()` when warming a harbour whose cached PFZ entry age is `< 21600.0` seconds.
5. `test_on_demand_warm_fires_once_on_cache_miss`:
   - Assertion: `assert len(scheduled_warms) == 1 and entry.weather_data_mode == "FALLBACK_SNAPSHOT"` on cold `get_or_refresh_harbour`.

- **Test Execution Command:**
  `.venv/bin/pytest tests/test_efficiency.py -v`
- **Expected Suite Total:**
  119 passed (114 baseline + 5 new efficiency tests).

---

## 5. Production Verification Plan

> [!IMPORTANT]
> Local tests passing does not prove production behaviour. A 0.1 vCPU container experiences CPU throttling, thread contention, and connection queuing that do not manifest in local virtual environments.

1. **One-Hour Probe Monitoring:**
   - Execute continuous external health probes (`GET /api/v1/health` and `HEAD /`) every 60 seconds for one hour.
   - Verification gate: Zero 502 or 504 probe responses across the entire one-hour monitoring window.
2. **Log Line Comparison (Before vs After):**
   - **Before:** `Marine Data Cache pre-warming complete: 12/12 harbours ready in 1691.99s`
   - **After:** Verify absence of `12/12 harbours ready` and presence of single VIP warm completion log: `Marine Data Cache pre-warming complete: 1/1 harbours ready in <25.00s`.
   - Verify absence of 10-minute periodic full-fleet log: `Running 10-minute periodic weather cache refresh for all harbours...`.
3. **Acceptance Chat Verification:**
   - Prompt 1 (T=0): *"Where is the nearest Potential Fishing Zone from Rameswaram today?"* (Country Craft, English).
   - Prompt 2 (T=5 min): *"ராமேஸ்வரம் பகுதியில் தற்போதைய வானிலை மற்றும் மீன்பிடி மண்டல விவரம் என்ன?"* (Mechanized Trawler, Tamil).
   - Verification gate: Both questions return valid responses with complete evidence ledger and safety verdict within server deadline without triggering client abort.
4. **24-Hour Uptime Observation:**
   - Monitor UptimeRobot external tracking dashboard over a continuous 24-hour cycle to verify recovery from 49.05% availability to sustained 99%+ uptime without container OOM or throttling crash.

---

## 6. Risks and Rollback

- **Identified Risks:**
  - *Cold Harbour First Request:* When a user queries a non-VIP harbour (e.g. Veraval or Paradip) for the first time, they receive fallback snapshot data for the first 10-25 seconds until the background warm completes.
    - *Mitigation:* `create_fallback_entry` is already verified and provides accurate regional climatological baselines with explicit provenance markers.
  - *Frontend Dashboard Freshness:* Raising polling intervals from 30s to 120s means active dashboard panels update every 2 minutes instead of 30 seconds.
    - *Mitigation:* Marine and weather forecast data from Open-Meteo updates at most hourly; 2-minute polling eliminates 75% of wasteful dashboard requests without degrading user-visible freshness.
- **Rollback Strategy:**
  - If unexpected regressions occur, immediately revert workspace to clean commit `4ada389`:
    `git checkout 4ada389 -- backend/tools/marine_cache.py backend/main.py frontend/src/App.jsx frontend/src/components/DistrictAuthorityBoard.jsx`
  - Remove new test file: `rm -f tests/test_efficiency.py`
  - Run `.venv/bin/pytest` to confirm clean return to 114 passing tests.

---

## 7. Blockers

- **Code Symbol Verification:**
  - All symbols referenced in the task specification were successfully located and verified in their exact paths:
    - `start_background_tasks`, `_initial_warm_and_weather_loop`, `_satellite_daily_loop`, `warm_all_harbours`, `warm_harbour`, `get_or_refresh_harbour`, `_refresh_inflight`, and `FALLBACK_REFRESH_MIN_AGE_SECONDS` in `backend/tools/marine_cache.py`.
    - `compute_pfz_zones` and `load_harbours_dict` in `backend/tools/ocean_pfz_tool.py`.
    - `_compute_dashboard_summary_impl` and `get_weather_marine_report` in `backend/main.py`.
    - `setInterval` in `frontend/src/App.jsx` and `frontend/src/components/DistrictAuthorityBoard.jsx`.
    - `_SST_CACHE`, `_CHL_CACHE`, and `_CACHE_TTL_SECONDS` in `backend/tools/satellite_erddap.py`.
- **Grep Pattern Confirmation for Duplicate Daily Loop:**
  - Exact command: `git grep "_satellite_daily_loop"`
  - Result:
    - `backend/tools/marine_cache.py: async def _satellite_daily_loop():`
    - `backend/tools/marine_cache.py: self._bg_tasks.append(loop.create_task(_satellite_daily_loop()))`
  - Zero other references exist anywhere in the codebase.
- **Active Blockers:** None. No symbols are missing and no replacement symbols were invented.
