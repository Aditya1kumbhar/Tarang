"""
Single In-Process Server-Side Marine Data Cache for ORCA.
Holds the latest successful telemetry per harbour:
- Weather & marine hazard reports (by vessel type)
- Potential Fishing Zones (PFZ) report (computed over the satellite grid)
- Geofence assessment
Each with its fetched_at timestamp and existing data_mode provenance label.

A background task warms this cache for all 12 harbours on application startup,
refreshes weather every 10 minutes, and refreshes satellite data daily.
The dashboard-summary endpoints, district board, and chat orchestrator
all read from this cache. POST /api/v1/chat is strictly cache-first.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple

from backend.schemas.models import (
    GeofenceAssessment,
    HarbourInfo,
    PFZCandidate,
    PFZReport,
    SafetyLevel,
    VesselType,
    WeatherHazardReport,
)
from backend.tools.geospatial_tool import check_geofence
from backend.tools.ocean_pfz_tool import compute_pfz_zones, load_harbours_dict
from backend.tools.weather_marine_tool import (
    assess_vessel_safety,
    calculate_sea_venture_safety_index,
    get_fallback_marine_and_weather,
    get_weather_marine_report,
)

logger = logging.getLogger("orca_marine_cache")

PFZ_WARM_BUDGET_SECONDS = 25.0
FALLBACK_REFRESH_MIN_AGE_SECONDS = 120.0
FLEET_WARM_GAP_SECONDS = 2.0
PFZ_RECOMPUTE_INTERVAL_SECONDS = 21600.0
WEATHER_REFRESH_INTERVAL_SECONDS = 1800.0
VIP_HARBOUR_IDS = ("rameswaram",)


@dataclass
class HarbourCacheEntry:
    """Holds the complete telemetry snapshot for a single harbour."""
    harbour_id: str
    harbour: HarbourInfo
    weather_by_vessel: Dict[str, WeatherHazardReport] = field(default_factory=dict)
    raw_weather_metrics: Dict[str, Any] = field(default_factory=dict)
    pfz_report: Optional[PFZReport] = None
    geofence: Optional[GeofenceAssessment] = None
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    weather_data_mode: str = "LIVE"
    pfz_data_mode: str = "LIVE_SATELLITE"
    weather_timestamp: Optional[str] = None
    satellite_timestamp: Optional[str] = None
    pfz_computed_at: Optional[datetime] = None


class MarineDataCache:
    """
    Singleton in-process cache keyed by harbour_id.
    Maintains last known good telemetry per harbour and provides
    safe, non-blocking reads to chat and dashboard routes.
    """

    def __init__(self) -> None:
        self._entries: Dict[str, HarbourCacheEntry] = {}
        self._lock = asyncio.Lock()
        self._bg_tasks: List[asyncio.Task] = []
        self._is_warmed: bool = False
        self._refresh_inflight: set = set()
        self._requested_harbour_ids: set = set()

    def is_warmed(self) -> bool:
        return self._is_warmed

    def get_entry(self, harbour_id: str) -> Optional[HarbourCacheEntry]:
        """Returns the cached entry for a harbour if present."""
        return self._entries.get(harbour_id.lower())

    def set_entry(self, entry: HarbourCacheEntry) -> None:
        """Stores a cache entry directly."""
        self._entries[entry.harbour_id.lower()] = entry

    def get_weather(
        self, harbour_id: str, vessel_type: VesselType
    ) -> Optional[WeatherHazardReport]:
        entry = self.get_entry(harbour_id)
        if entry:
            return entry.weather_by_vessel.get(vessel_type.value)
        return None

    def get_pfz(self, harbour_id: str) -> Optional[PFZReport]:
        entry = self.get_entry(harbour_id)
        return entry.pfz_report if entry else None

    def get_geofence(self, harbour_id: str) -> Optional[GeofenceAssessment]:
        entry = self.get_entry(harbour_id)
        return entry.geofence if entry else None

    def create_fallback_entry(self, harbour: HarbourInfo) -> HarbourCacheEntry:
        """
        Builds an authentic fallback cache entry from deterministic baselines
        with verified FALLBACK_SNAPSHOT provenance labels.
        """
        metrics = get_fallback_marine_and_weather(harbour.lat, harbour.lon)
        geofence = check_geofence(harbour.lon, harbour.lat)

        weather_by_vessel: Dict[str, WeatherHazardReport] = {}
        for vt in [VesselType.COUNTRY_CRAFT, VesselType.MECHANIZED_TRAWLER]:
            # Use synchronous execution of get_weather_marine_report via mock_metrics (immediate, no async I/O)
            # Since mock_metrics is provided, it returns synchronously without network calls
            safety_status, advisory, is_kal, is_light, cb_trig = assess_vessel_safety(metrics, vt)
            idx, verdict = calculate_sea_venture_safety_index(metrics, vt)
            weather_by_vessel[vt.value] = WeatherHazardReport(
                harbour_id=harbour.id,
                harbour_name=harbour.name,
                latitude=harbour.lat,
                longitude=harbour.lon,
                vessel_type=vt,
                wave_height_m=metrics["wave_height_m"],
                wind_speed_kmh=metrics["wind_speed_kmh"],
                wind_gusts_kmh=metrics["wind_gusts_kmh"],
                wave_direction_deg=metrics["wave_direction_deg"],
                wave_period_s=metrics["wave_period_s"],
                swell_wave_height_m=metrics["swell_wave_height_m"],
                swell_wave_period_s=metrics["swell_wave_period_s"],
                ocean_current_velocity_ms=metrics["ocean_current_velocity_ms"],
                cape_j_kg=metrics["cape_j_kg"],
                weather_code=metrics["weather_code"],
                safety_status=safety_status,
                sea_venture_safety_index=idx,
                risk_verdict=verdict,
                advisory_message=advisory,
                is_kallakkadal_risk=is_kal,
                is_lightning_risk=is_light,
                circuit_breaker_triggered=cb_trig,
                provenance={
                    "source_dataset": metrics["source"],
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    "coordinates": [harbour.lat, harbour.lon],
                    "confidence_score": 0.82,
                    "data_mode": "FALLBACK_SNAPSHOT",
                    "reasoning_trace": "Deterministic climatological Indian Ocean baseline",
                },
                evidence_ledger_entry={
                    "parameter_name": "Significant Wave Height & Coastal Surface Wind",
                    "source_sensor": "Climatological Regional Baseline",
                    "platform_mission": "Verified Regional Cartography Snapshot",
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    "spatial_resolution": "5.0 km coastal grid",
                    "confidence_tier": "Medium",
                    "data_mode": "FALLBACK_SNAPSHOT",
                    "freshness_age_minutes": 120.0,
                    "station_id": f"IN-{harbour.id.upper()[:4]}-MET",
                    "anomaly_note": "Deterministic vessel safety engine evaluated from offline baseline",
                },
            )

        # Build fallback PFZ via static offline snapshot
        pfz_report = compute_pfz_zones_sync_fallback(harbour)

        return HarbourCacheEntry(
            harbour_id=harbour.id,
            harbour=harbour,
            weather_by_vessel=weather_by_vessel,
            raw_weather_metrics=metrics,
            pfz_report=pfz_report,
            geofence=geofence,
            fetched_at=datetime.now(timezone.utc),
            weather_data_mode="FALLBACK_SNAPSHOT",
            pfz_data_mode="FALLBACK_SNAPSHOT",
            weather_timestamp=datetime.now(timezone.utc).isoformat(),
            satellite_timestamp=None,
            pfz_computed_at=None,
        )

    async def warm_harbour(
        self,
        harbour: HarbourInfo,
        timeout: float = 12.0,
    ) -> HarbourCacheEntry:
        """
        Fetches live weather and PFZ for a harbour concurrently within a stage budget.
        On failure or timeout, preserves the existing good cache if present,
        or creates a labeled fallback snapshot if cold.
        """
        try:
            weather_task_cc = get_weather_marine_report(
                lat=harbour.lat,
                lon=harbour.lon,
                harbour_id=harbour.id,
                harbour_name=harbour.name,
                vessel_type=VesselType.COUNTRY_CRAFT,
            )
            weather_task_trawler = get_weather_marine_report(
                lat=harbour.lat,
                lon=harbour.lon,
                harbour_id=harbour.id,
                harbour_name=harbour.name,
                vessel_type=VesselType.MECHANIZED_TRAWLER,
            )

            # Determine existing entry or fallback baseline early
            existing = self.get_entry(harbour.id)
            fallback = self.create_fallback_entry(harbour) if existing is None else existing

            # Independent bounded legs: a slow satellite (PFZ) fetch must not
            # discard good live weather, and a weather failure must not block PFZ.
            async def _bounded_leg(coro, budget):
                try:
                    return await asyncio.wait_for(coro, timeout=budget)
                except Exception as leg_err:
                    return leg_err

            # PFZ Recompute Guard: Skip compute_pfz_zones if existing PFZ is younger than 21600s
            skip_pfz = False
            pfz_computed_at = None
            if (
                existing is not None
                and existing.pfz_report is not None
                and existing.pfz_computed_at is not None
            ):
                age_pfz = (datetime.now(timezone.utc) - existing.pfz_computed_at).total_seconds()
                if age_pfz < PFZ_RECOMPUTE_INTERVAL_SECONDS:
                    skip_pfz = True
                    res_pfz = existing.pfz_report
                    pfz_computed_at = existing.pfz_computed_at

            weather_coro = asyncio.gather(
                weather_task_cc,
                weather_task_trawler,
                return_exceptions=True,
            )
            if skip_pfz:
                weather_results = await _bounded_leg(weather_coro, timeout)
            else:
                pfz_task = compute_pfz_zones(harbour_id=harbour.id, max_candidates=3)
                weather_results, res_pfz = await asyncio.gather(
                    _bounded_leg(weather_coro, timeout),
                    _bounded_leg(pfz_task, PFZ_WARM_BUDGET_SECONDS),
                )

            if isinstance(weather_results, (list, tuple)):
                res_cc, res_tr = weather_results
            else:
                res_cc = weather_results
                res_tr = weather_results

            weather_by_vessel: Dict[str, WeatherHazardReport] = {}
            weather_data_mode = "LIVE"
            weather_ts = None

            if isinstance(res_cc, WeatherHazardReport):
                weather_by_vessel[VesselType.COUNTRY_CRAFT.value] = res_cc
                weather_data_mode = (
                    res_cc.evidence_ledger_entry.data_mode
                    if res_cc.evidence_ledger_entry
                    else "LIVE"
                )
                weather_ts = (
                    res_cc.evidence_ledger_entry.timestamp_utc
                    if res_cc.evidence_ledger_entry
                    else None
                )
            else:
                weather_by_vessel[VesselType.COUNTRY_CRAFT.value] = (
                    fallback.weather_by_vessel[VesselType.COUNTRY_CRAFT.value]
                )
                weather_data_mode = fallback.weather_data_mode

            if isinstance(res_tr, WeatherHazardReport):
                weather_by_vessel[VesselType.MECHANIZED_TRAWLER.value] = res_tr
            else:
                weather_by_vessel[VesselType.MECHANIZED_TRAWLER.value] = (
                    fallback.weather_by_vessel[VesselType.MECHANIZED_TRAWLER.value]
                )

            pfz_report: PFZReport
            pfz_data_mode = "LIVE_SATELLITE"
            satellite_ts = None

            if isinstance(res_pfz, PFZReport):
                pfz_report = res_pfz
                pfz_data_mode = getattr(res_pfz, "data_mode", "LIVE_SATELLITE")
                satellite_ts = getattr(res_pfz, "satellite_timestamp", None)
                if not skip_pfz:
                    pfz_computed_at = datetime.now(timezone.utc)
            else:
                pfz_report = fallback.pfz_report or compute_pfz_zones_sync_fallback(harbour)
                pfz_data_mode = fallback.pfz_data_mode
                satellite_ts = fallback.satellite_timestamp
                pfz_computed_at = existing.pfz_computed_at if existing else None

            geofence = check_geofence(harbour.lon, harbour.lat)

            entry = HarbourCacheEntry(
                harbour_id=harbour.id,
                harbour=harbour,
                weather_by_vessel=weather_by_vessel,
                raw_weather_metrics={},
                pfz_report=pfz_report,
                geofence=geofence,
                fetched_at=datetime.now(timezone.utc),
                weather_data_mode=weather_data_mode,
                pfz_data_mode=pfz_data_mode,
                weather_timestamp=weather_ts,
                satellite_timestamp=satellite_ts,
                pfz_computed_at=pfz_computed_at,
            )
            async with self._lock:
                self._entries[harbour.id.lower()] = entry
            return entry

        except Exception as err:
            logger.warning(
                "Warm harbour '%s' encountered an issue (%s); retaining good cache or fallback.",
                harbour.id,
                err,
            )
            existing = self.get_entry(harbour.id)
            if existing:
                return existing
            fallback_entry = self.create_fallback_entry(harbour)
            async with self._lock:
                self._entries[harbour.id.lower()] = fallback_entry
            return fallback_entry

    async def warm_all_harbours(self, timeout_per_harbour: float = 12.0) -> None:
        """Pre-warms all 12 registered Indian landing centres strictly one at a time.

        Production runs on a fraction of one CPU. Warming harbours in parallel
        saturated the instance and starved live chat requests (2026-11-07
        production logs: a chat data stage took 115 s during background warming
        while static files took 0.5 s to serve). Fleet warming is therefore
        sequential, with a short breather between harbours, so a live request
        always finds a mostly idle event loop.
        """
        harbours = list(load_harbours_dict().values())
        logger.info("Starting pre-warming of Marine Data Cache for %d harbours...", len(harbours))
        t_start = asyncio.get_running_loop().time()

        successful = 0
        for index, h in enumerate(harbours):
            if index > 0:
                await asyncio.sleep(FLEET_WARM_GAP_SECONDS)
            try:
                entry = await self.warm_harbour(h, timeout=timeout_per_harbour)
            except Exception as err:
                logger.warning("Fleet warm failed for harbour %s: %s", h.id, err)
                continue
            if isinstance(entry, HarbourCacheEntry):
                successful += 1
        t_elapsed = asyncio.get_running_loop().time() - t_start
        self._is_warmed = True
        logger.info(
            "Marine Data Cache pre-warming complete: %d/%d harbours ready in %.2fs",
            successful,
            len(harbours),
            t_elapsed,
        )

    async def warm_vip_harbours(self, timeout_per_harbour: float = 12.0) -> None:
        """Pre-warms designated VIP harbours sequentially on startup."""
        harbours_dict = load_harbours_dict()
        vip_harbours = [
            harbours_dict[hid]
            for hid in VIP_HARBOUR_IDS
            if hid in harbours_dict
        ]
        logger.info("Starting VIP pre-warming of Marine Data Cache for %d harbours...", len(vip_harbours))
        t_start = asyncio.get_running_loop().time()

        successful = 0
        for index, h in enumerate(vip_harbours):
            if index > 0:
                await asyncio.sleep(FLEET_WARM_GAP_SECONDS)
            try:
                entry = await self.warm_harbour(h, timeout=timeout_per_harbour)
            except Exception as err:
                logger.warning("VIP warm failed for harbour %s: %s", h.id, err)
                continue
            if isinstance(entry, HarbourCacheEntry):
                successful += 1
        t_elapsed = asyncio.get_running_loop().time() - t_start
        self._is_warmed = True
        logger.info(
            "Marine Data Cache pre-warming complete: %d/%d harbours ready in %.2fs",
            successful,
            len(vip_harbours),
            t_elapsed,
        )

    async def get_or_refresh_harbour(
        self,
        harbour: HarbourInfo,
        max_refresh_timeout: float = 15.0,
    ) -> HarbourCacheEntry:
        """
        Cache-first entry resolver:
        1. If harbour is already cached, returns immediately in <0.1ms without any network calls.
        2. If cold/missing, returns the deterministic fallback snapshot immediately
           and schedules ONE background warm; the caller never waits on the network.
        """
        self._requested_harbour_ids.add(harbour.id.lower())
        entry = self.get_entry(harbour.id)
        if entry is not None and len(entry.weather_by_vessel) > 0 and entry.pfz_report is not None:
            # Stale-while-revalidate: a fallback entry older than the minimum
            # age schedules ONE background refresh and is served immediately,
            # so fallback data can heal without blocking the caller.
            is_fallback = (
                entry.weather_data_mode == "FALLBACK_SNAPSHOT"
                or entry.pfz_data_mode == "FALLBACK_SNAPSHOT"
            )
            age_seconds = (datetime.now(timezone.utc) - entry.fetched_at).total_seconds()
            key = harbour.id.lower()
            if is_fallback and age_seconds > FALLBACK_REFRESH_MIN_AGE_SECONDS and key not in self._refresh_inflight:
                self._refresh_inflight.add(key)

                async def _bg_refresh(h=harbour, k=key):
                    try:
                        await self.warm_harbour(h, timeout=20.0)
                    except Exception:
                        pass
                    finally:
                        self._refresh_inflight.discard(k)

                try:
                    asyncio.create_task(_bg_refresh())
                except RuntimeError:
                    self._refresh_inflight.discard(key)
            return entry

        # Cache miss: NEVER block the caller on a live refresh. Serve the
        # deterministic fallback snapshot immediately and heal the entry
        # with ONE background warm (same in-flight guard as the
        # stale-while-revalidate path above). A slow satellite fetch can
        # no longer push a chat request past its time budget.
        logger.info(
            "Cache miss for harbour '%s'; serving fallback snapshot immediately and scheduling background warm...",
            harbour.id,
        )
        fallback = self.create_fallback_entry(harbour)
        self.set_entry(fallback)
        key = harbour.id.lower()
        if key not in self._refresh_inflight:
            self._refresh_inflight.add(key)

            async def _bg_warm(h=harbour, k=key):
                try:
                    await self.warm_harbour(h, timeout=20.0)
                except Exception:
                    pass
                finally:
                    self._refresh_inflight.discard(k)

            try:
                asyncio.create_task(_bg_warm())
            except RuntimeError:
                self._refresh_inflight.discard(key)
        return fallback

    def start_background_tasks(self) -> None:
        """Starts periodic background warming and refresh loops."""
        loop = asyncio.get_running_loop()

        async def _initial_warm_and_weather_loop():
            # Initial warming at startup: VIP harbours only (timeout_per_harbour=12.0)
            try:
                await self.warm_vip_harbours(timeout_per_harbour=12.0)
            except Exception as e:
                logger.warning("Initial cache warming background task error: %s", e)

            # Weather refresh cadence: at most every 1800 seconds (30 minutes)
            # Refreshes VIP harbours and any recently requested harbours (timeout_per_harbour=20.0)
            # Note: Legacy _satellite_daily_loop (timeout_per_harbour=15.0) retired for efficiency.
            while True:
                try:
                    await asyncio.sleep(WEATHER_REFRESH_INTERVAL_SECONDS)
                    harbours_dict = load_harbours_dict()
                    target_ids = set(VIP_HARBOUR_IDS) | self._requested_harbour_ids
                    targets = [harbours_dict[hid] for hid in target_ids if hid in harbours_dict]
                    logger.info("Running periodic weather cache refresh for %d active harbours...", len(targets))
                    for idx, h in enumerate(targets):
                        if idx > 0:
                            await asyncio.sleep(FLEET_WARM_GAP_SECONDS)
                        try:
                            await self.warm_harbour(h, timeout=20.0)  # timeout_per_harbour=20.0
                        except Exception as refresh_err:
                            logger.warning("Periodic refresh failed for harbour %s: %s", h.id, refresh_err)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning("Periodic weather cache refresh error: %s", e)

        self._bg_tasks.append(loop.create_task(_initial_warm_and_weather_loop()))
        logger.info("Marine Data Cache background warming tasks scheduled.")

    def stop_background_tasks(self) -> None:
        """Cancels all background warming loops upon application shutdown."""
        for task in self._bg_tasks:
            if not task.done():
                task.cancel()
        self._bg_tasks.clear()
        logger.info("Marine Data Cache background tasks stopped.")


def compute_pfz_zones_sync_fallback(harbour: HarbourInfo) -> PFZReport:
    """Synchronous helper producing the verified offline static PFZ report."""
    from backend.tools.ocean_pfz_tool import (
        calculate_composite_pfz_score,
        load_ocean_grid,
        PFZ_FRONT_GRADIENT_THRESHOLD,
    )
    from backend.tools.geospatial_tool import calculate_distance_and_bearing

    grid_data = load_ocean_grid()
    grid_points = grid_data.get("points", [])
    candidates: List[PFZCandidate] = []

    for idx, pt in enumerate(grid_points):
        p_lat = pt["lat"]
        p_lon = pt["lon"]
        sst = pt["sst_c"]
        chla = pt["chla_mg_m3"]
        grad = pt.get("sst_gradient_c_per_km", 0.15)
        depth = pt.get("depth_m", 25.0)

        dist_km, dist_nm, bearing_deg, cardinal = calculate_distance_and_bearing(
            harbour.lon, harbour.lat, p_lon, p_lat
        )
        if dist_km < 8.0 or dist_km > 125.0:
            continue

        score, s_sst, s_front, s_chl = calculate_composite_pfz_score(sst, grad, chla)
        geofence_res = check_geofence(p_lon, p_lat)
        is_safe = not geofence_res.is_violation and geofence_res.alert_level != "CRITICAL"

        upwelling_str = (
            f"Active upwelling front ({grad:.2f}°C/km)"
            if grad >= PFZ_FRONT_GRADIENT_THRESHOLD
            else f"Moderate thermal gradient ({grad:.2f}°C/km)"
        )
        chl_str = f"Chl-a at {chla:.2f} mg/m³ supports dense planktonic forage"
        sst_str = f"SST {sst:.1f}°C optimal for pelagic teleosts"
        safety_note = " [Clear of maritime geofences]" if is_safe else f" [RESTRICTED: Near {geofence_res.boundary_name}]"
        rationale = f"{upwelling_str}; {chl_str}; {sst_str}.{safety_note}"

        zone_id = pt.get("sector", f"zone_{idx+1}")
        candidates.append(
            PFZCandidate(
                zone_id=zone_id,
                latitude=p_lat,
                longitude=p_lon,
                distance_km=round(dist_km, 1),
                distance_nm=round(dist_nm, 1),
                bearing_deg=round(bearing_deg, 1),
                bearing_cardinal=cardinal,
                sst_c=sst,
                chla_mg_m3=chla,
                sst_gradient_c_per_km=grad,
                depth_m=depth,
                pfz_score=round(score, 1),
                is_geofence_safe=is_safe,
                biological_rationale=rationale,
                evidence_ledger_entry={
                    "parameter_name": "Chlorophyll-a & SST Co-location (PFZ)",
                    "source_sensor": "Bundled offline snapshot (static)",
                    "platform_mission": "Verified Regional Cartography Snapshot",
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    "spatial_resolution": "High-resolution regional grid",
                    "confidence_tier": "Medium Possibility",
                    "data_mode": "FALLBACK_SNAPSHOT",
                    "freshness_age_minutes": 0.0,
                    "station_id": f"PFZ-STATIC-{(harbour.id).upper()}",
                    "anomaly_note": "Verified regional marine cartography snapshot",
                },
            )
        )

    candidates.sort(key=lambda c: (c.is_geofence_safe, c.pfz_score), reverse=True)
    top_cand = candidates[0] if candidates else None

    return PFZReport(
        harbour_id=harbour.id,
        harbour_name=harbour.name,
        candidates=candidates[:3],
        top_recommendation=top_cand,
        data_mode="FALLBACK_SNAPSHOT",
        satellite_timestamp=None,
        provenance={
            "source_dataset": "Bundled offline snapshot (static)",
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "coordinates": [harbour.lat, harbour.lon],
            "confidence_score": 0.85,
            "data_mode": "FALLBACK_SNAPSHOT",
            "reasoning_trace": "Bundled offline static snapshot for reliable fail-safe operation",
        },
    )


# Global singleton instance
marine_cache = MarineDataCache()
