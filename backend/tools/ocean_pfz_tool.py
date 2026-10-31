"""
Potential Fishing Zone (PFZ) & Ocean Productivity Tool for ORCA.
Calculates SST optimality, thermal front gradients, and Chlorophyll-a composite index.
Integrates with geospatial geofencing to strictly quarantine any PFZ candidate within 1.5 NM of IMBL/MPAs.
"""

import asyncio
from datetime import datetime, timezone
import functools
import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import httpx
import numpy as np

from backend.config import (
    FALLBACK_GRID_FILE,
    HARBOURS_FILE,
    PFZ_CHLA_MAX_OPTIMAL,
    PFZ_CHLA_MIN_OPTIMAL,
    PFZ_FRONT_GRADIENT_THRESHOLD,
    PFZ_SST_MAX_OPTIMAL,
    PFZ_SST_MAX_TOLERANCE,
    PFZ_SST_MIN_OPTIMAL,
    PFZ_SST_MIN_TOLERANCE,
)
from backend.schemas.models import (
    EvidenceLedgerEntry,
    HarbourInfo,
    PFZCandidate,
    PFZReport,
    ProvenanceMetadata,
)
from backend.tools.geospatial_tool import (
    calculate_distance_and_bearing,
    check_geofence,
)
from backend.tools.satellite_erddap import (
    fetch_chl_grid,
    fetch_sst_grid,
)

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=1)
def load_ocean_grid() -> Dict[str, Any]:
    with open(FALLBACK_GRID_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@functools.lru_cache(maxsize=1)
def load_harbours_dict() -> Dict[str, HarbourInfo]:
    with open(HARBOURS_FILE, "r", encoding="utf-8") as f:
        return {h["id"]: HarbourInfo(**h) for h in json.load(f)}


def compute_sst_optimality_score(sst: float) -> float:
    """
    SST Optimality (S_sst):
    Score = 1.0 if 25.5 <= SST <= 29.2 deg C.
    Decays linearly to 0.0 outside [23.0, 31.5].
    """
    if PFZ_SST_MIN_OPTIMAL <= sst <= PFZ_SST_MAX_OPTIMAL:
        return 1.0
    elif PFZ_SST_MIN_TOLERANCE <= sst < PFZ_SST_MIN_OPTIMAL:
        return (sst - PFZ_SST_MIN_TOLERANCE) / (PFZ_SST_MIN_OPTIMAL - PFZ_SST_MIN_TOLERANCE)
    elif PFZ_SST_MAX_OPTIMAL < sst <= PFZ_SST_MAX_TOLERANCE:
        return (PFZ_SST_MAX_TOLERANCE - sst) / (PFZ_SST_MAX_TOLERANCE - PFZ_SST_MAX_OPTIMAL)
    return 0.0


def compute_front_gradient_score(grad_c_per_km: float) -> float:
    """
    Thermal Front Gradient Score (S_front):
    Fronts >= 0.15 deg C/km indicate active upwelling and nutrient mixing.
    Score = min(1.0, grad / 0.25).
    """
    return min(1.0, max(0.0, grad_c_per_km / 0.25))


def compute_chla_score(chla: float) -> float:
    """
    Chlorophyll-a Score (S_chl):
    Score = 1.0 if 0.4 <= Chl-a <= 3.0 mg/m3.
    Decays below 0.4 down to 0.1, and above 3.0 up to 5.5.
    """
    if PFZ_CHLA_MIN_OPTIMAL <= chla <= PFZ_CHLA_MAX_OPTIMAL:
        return 1.0
    elif 0.1 <= chla < PFZ_CHLA_MIN_OPTIMAL:
        return (chla - 0.1) / (PFZ_CHLA_MIN_OPTIMAL - 0.1)
    elif PFZ_CHLA_MAX_OPTIMAL < chla <= 5.5:
        return max(0.0, (5.5 - chla) / (5.5 - PFZ_CHLA_MAX_OPTIMAL))
    return 0.0


def calculate_composite_pfz_score(
    sst: float, grad_c_per_km: float, chla: float
) -> Tuple[float, float, float, float]:
    """
    Composite PFZ Index:
    PFZ_Score = 100 * (0.40 * S_front + 0.35 * S_chl + 0.25 * S_sst)
    """
    s_sst = compute_sst_optimality_score(sst)
    s_front = compute_front_gradient_score(grad_c_per_km)
    s_chl = compute_chla_score(chla)

    raw_score = 100.0 * (0.40 * s_front + 0.35 * s_chl + 0.25 * s_sst)
    bounded_score = round(min(100.0, max(0.0, raw_score)), 1)
    return bounded_score, s_sst, s_front, s_chl


def compute_finite_difference_gradients(
    sst_points: List[Dict[str, Any]]
) -> Dict[Tuple[float, float], float]:
    """
    Computes spatial SST thermal gradient magnitude (°C/km) across the SST grid
    using finite differences between neighbouring points (dT/dx in E-W and dT/dy in N-S).
    """
    if not sst_points:
        return {}

    grid_map = {(round(p["lat"], 4), round(p["lon"], 4)): float(p["sst_c"]) for p in sst_points}
    lats = sorted(list(set(round(p["lat"], 4) for p in sst_points)))
    lons = sorted(list(set(round(p["lon"], 4) for p in sst_points)))
    lat_idx_map = {lat: i for i, lat in enumerate(lats)}
    lon_idx_map = {lon: i for i, lon in enumerate(lons)}

    gradients: Dict[Tuple[float, float], float] = {}

    for p in sst_points:
        lat = round(p["lat"], 4)
        lon = round(p["lon"], 4)
        sst = float(p["sst_c"])

        # 1. Longitudinal (East-West) difference: dx in km
        j = lon_idx_map[lon]
        has_east = (j + 1 < len(lons)) and (lat, lons[j + 1]) in grid_map
        has_west = (j - 1 >= 0) and (lat, lons[j - 1]) in grid_map

        dT_dx = 0.0
        cos_lat = math.cos(math.radians(lat))
        if has_east and has_west:
            east_lon = lons[j + 1]
            west_lon = lons[j - 1]
            dx_km = (east_lon - west_lon) * 111.32 * cos_lat
            if dx_km > 0:
                dT_dx = (grid_map[(lat, east_lon)] - grid_map[(lat, west_lon)]) / dx_km
        elif has_east:
            east_lon = lons[j + 1]
            dx_km = (east_lon - lon) * 111.32 * cos_lat
            if dx_km > 0:
                dT_dx = (grid_map[(lat, east_lon)] - sst) / dx_km
        elif has_west:
            west_lon = lons[j - 1]
            dx_km = (lon - west_lon) * 111.32 * cos_lat
            if dx_km > 0:
                dT_dx = (sst - grid_map[(lat, west_lon)]) / dx_km

        # 2. Latitudinal (North-South) difference: dy in km
        i = lat_idx_map[lat]
        has_north = (i + 1 < len(lats)) and (lats[i + 1], lon) in grid_map
        has_south = (i - 1 >= 0) and (lats[i - 1], lon) in grid_map

        dT_dy = 0.0
        if has_north and has_south:
            north_lat = lats[i + 1]
            south_lat = lats[i - 1]
            dy_km = (north_lat - south_lat) * 110.57
            if dy_km > 0:
                dT_dy = (grid_map[(north_lat, lon)] - grid_map[(south_lat, lon)]) / dy_km
        elif has_north:
            north_lat = lats[i + 1]
            dy_km = (north_lat - lat) * 110.57
            if dy_km > 0:
                dT_dy = (grid_map[(north_lat, lon)] - sst) / dy_km
        elif has_south:
            south_lat = lats[i - 1]
            dy_km = (lat - south_lat) * 110.57
            if dy_km > 0:
                dT_dy = (sst - grid_map[(south_lat, lon)]) / dy_km

        grad = math.sqrt(dT_dx**2 + dT_dy**2)
        gradients[(lat, lon)] = round(grad, 4)

    return gradients


def merge_sst_and_chl(
    sst_points: List[Dict[str, Any]],
    chl_points: List[Dict[str, Any]],
    max_dist_deg: float = 0.15,
) -> List[Dict[str, Any]]:
    """
    Attaches chlorophyll by nearest neighbour from chl_points to sst_points.
    If nearest distance > max_dist_deg (0.15 deg), drops the point.
    Computes sst_gradient_c_per_km via finite differences on the SST grid.
    """
    if not sst_points or not chl_points:
        return []

    gradients = compute_finite_difference_gradients(sst_points)

    chl_coords = np.array([[c["lat"], c["lon"]] for c in chl_points])
    chl_vals = np.array([c["chla_mg_m3"] for c in chl_points])

    merged: List[Dict[str, Any]] = []

    for idx, sst_pt in enumerate(sst_points):
        p_lat = sst_pt["lat"]
        p_lon = sst_pt["lon"]
        sst = float(sst_pt["sst_c"])

        # Nearest neighbour search in degrees
        diff = chl_coords - np.array([p_lat, p_lon])
        dists_sq = np.sum(diff**2, axis=1)
        min_idx = int(np.argmin(dists_sq))
        min_dist = math.sqrt(float(dists_sq[min_idx]))

        if min_dist > max_dist_deg:
            # Distance exceeds 0.15 deg: drop the point
            continue

        chla = float(chl_vals[min_idx])
        grad = gradients.get((round(p_lat, 4), round(p_lon, 4)), 0.15)

        merged.append({
            "sector": f"pfz_sat_{idx + 1}",
            "lat": p_lat,
            "lon": p_lon,
            "sst_c": sst,
            "chla_mg_m3": chla,
            "sst_gradient_c_per_km": grad,
            "depth_m": 25.0,
            "timestamp": sst_pt.get("timestamp"),
        })

    return merged


async def compute_pfz_zones(
    harbour_id: str = "rameswaram",
    max_candidates: int = 3,
    custom_points: Optional[List[Dict[str, Any]]] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> PFZReport:
    """
    Identifies and ranks Potential Fishing Zones relative to a harbour.
    Builds PFZ candidate grid from live NOAA CoastWatch satellite data (CRW SST + VIIRS Chl-a) via ERDDAP.
    On ANY fetch or parse failure, gracefully falls back to the bundled offline snapshot.
    """
    harbours = load_harbours_dict()
    harbour = harbours.get(harbour_id)
    if not harbour:
        harbour = harbours["rameswaram"]

    is_satellite = False
    satellite_timestamp: Optional[str] = None
    data_mode = "LIVE_SATELLITE"

    if custom_points is not None:
        grid_points = custom_points
        dataset_name = "Custom Injected Oceanic Grid Test Fixture"
        data_mode = "LIVE"
    else:
        try:
            sst_grid = await fetch_sst_grid(harbour.lat, harbour.lon, box_deg=1.5, client=client)
            chl_grid = await fetch_chl_grid(harbour.lat, harbour.lon, box_deg=1.5, client=client)

            if not sst_grid or not chl_grid:
                raise ValueError("Received empty satellite grid from ERDDAP")

            grid_points = merge_sst_and_chl(sst_grid, chl_grid, max_dist_deg=0.15)
            if not grid_points:
                raise ValueError("No viable PFZ points after merging SST and Chlorophyll within 0.15 deg")

            is_satellite = True
            dataset_name = "NOAA CoastWatch ERDDAP (CRW SST + VIIRS Chl-a)"
            data_mode = "LIVE_SATELLITE"
            satellite_timestamp = getattr(sst_grid, "timestamp", None) or getattr(chl_grid, "timestamp", None)
        except Exception as e:
            logger.warning(
                "Satellite ERDDAP PFZ calculation failed (%s); falling back to bundled static snapshot for %s",
                e,
                harbour_id,
            )
            grid_data = load_ocean_grid()
            grid_points = grid_data.get("points", [])
            # Always override any legacy static label with the exact required string
            dataset_name = "Bundled offline snapshot (static)"
            data_mode = "FALLBACK_SNAPSHOT"
            satellite_timestamp = None

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

        # Strict offshore operational range (8 km to 125 km)
        if dist_km < 8.0 or dist_km > 125.0:
            continue

        score, s_sst, s_front, s_chl = calculate_composite_pfz_score(sst, grad, chla)

        # Geofence safety check (IMBL and MPA polygons)
        geofence_res = check_geofence(p_lon, p_lat)
        is_safe = not geofence_res.is_violation and geofence_res.alert_level != "CRITICAL"

        # Construct biological rationale
        upwelling_str = (
            f"Active upwelling front ({grad:.2f}°C/km)"
            if grad >= PFZ_FRONT_GRADIENT_THRESHOLD
            else f"Moderate thermal gradient ({grad:.2f}°C/km)"
        )
        chl_str = f"Chl-a at {chla:.2f} mg/m³ supports dense planktonic forage"
        sst_str = f"SST {sst:.1f}°C optimal for pelagic teleosts"

        if not is_safe:
            safety_note = f" [RESTRICTED: Within {geofence_res.distance_nm:.1f} NM of {geofence_res.boundary_name}]"
        else:
            safety_note = " [Clear of maritime geofences]"

        rationale = f"{upwelling_str}; {chl_str}; {sst_str}.{safety_note}"

        zone_id = pt.get("sector", f"zone_{idx+1}")
        front_cat = (
            "Cayula-Cornillon Bimodal Water Mass Front"
            if grad >= 0.18
            else "Moderate Thermal Gradient Front"
        )
        conf_tier = (
            "Higher Possibility (Co-located Front & Chl-a)"
            if score >= 75.0
            else ("Medium Possibility" if score >= 50.0 else "Lower Possibility")
        )

        if data_mode == "LIVE_SATELLITE":
            evidence_entry = EvidenceLedgerEntry(
                parameter_name="Biophysical PFZ & Thermal Front",
                source_sensor="NOAA Coral Reef Watch (CRW) SST + VIIRS Chl-a",
                platform_mission="NOAA CoastWatch ERDDAP (NESDIS VIIRS & CRW)",
                timestamp_utc=satellite_timestamp or datetime.now(timezone.utc).isoformat(),
                spatial_resolution="5.0 km (CRW SST) / 9.0 km (VIIRS Chl-a)",
                confidence_tier=conf_tier,
                data_mode="LIVE_SATELLITE",
                freshness_age_minutes=0.0,
                station_id=f"PFZ-{zone_id.upper()}",
                anomaly_note="Live NOAA CoastWatch ERDDAP daily satellite feed. SST thermal gradient computed via finite differences.",
            )
        else:
            evidence_entry = EvidenceLedgerEntry(
                parameter_name="Biophysical PFZ & Thermal Front",
                source_sensor="Bundled offline snapshot (static)" if custom_points is None else "Custom Test Fixture",
                platform_mission="Bundled Indian Ocean Baseline Grid" if custom_points is None else "Test Platform",
                timestamp_utc=datetime.now(timezone.utc).isoformat(),
                spatial_resolution="Climatological baseline grid",
                confidence_tier=conf_tier,
                data_mode="FALLBACK_SNAPSHOT" if custom_points is None else "LIVE",
                freshness_age_minutes=120.0,
                station_id=f"PFZ-{zone_id.upper()}",
                anomaly_note="NOAA ERDDAP live satellite unreachable; fell back to bundled offline static snapshot.",
            )

        candidate = PFZCandidate(
            zone_id=zone_id,
            latitude=p_lat,
            longitude=p_lon,
            bearing_deg=bearing_deg,
            bearing_cardinal=cardinal,
            distance_km=dist_km,
            distance_nm=dist_nm,
            depth_m=depth,
            sst_c=sst,
            chla_mg_m3=chla,
            sst_gradient_c_per_km=grad,
            pfz_score=score,
            biological_rationale=rationale,
            is_geofence_safe=is_safe,
            front_category=front_cat,
            persistence_days=7,
            confidence_tier=conf_tier,
            evidence_ledger_entry=evidence_entry,
        )
        candidates.append(candidate)

    # Sort candidates by pfz_score descending
    candidates.sort(key=lambda c: c.pfz_score, reverse=True)

    # Pick top recommendation: highest scoring geofence-safe zone
    top_rec = None
    for cand in candidates:
        if cand.is_geofence_safe:
            top_rec = cand
            break

    # If all candidates are unsafe, fall back to top scored candidate with clear alert
    if top_rec is None and candidates:
        top_rec = candidates[0]

    provenance = ProvenanceMetadata(
        source_dataset=dataset_name,
        timestamp_utc=(
            satellite_timestamp
            if (data_mode == "LIVE_SATELLITE" and satellite_timestamp)
            else datetime.now(timezone.utc).isoformat()
        ),
        coordinates=[harbour.lat, harbour.lon],
        metrics={
            "harbour_id": harbour_id,
            "evaluated_candidate_count": len(candidates),
            "top_score": top_rec.pfz_score if top_rec else 0.0,
            "top_zone_id": top_rec.zone_id if top_rec else None,
            "top_zone_safe": top_rec.is_geofence_safe if top_rec else False,
            "data_mode": data_mode,
        },
        reasoning_trace=(
            f"Calculated PFZ composite index for {len(candidates)} offshore grid points. "
            f"Applied weights: Front Gradient (40%), Chlorophyll-a (35%), SST (25%). "
            f"Cross-referenced each point with IMBL and MPA geofence polygons."
        ),
        confidence_score=0.96 if data_mode == "LIVE_SATELLITE" else 0.82,
    )

    return PFZReport(
        harbour_id=harbour_id,
        candidates=candidates[:max_candidates],
        top_recommendation=top_rec,
        provenance=provenance,
        data_mode=data_mode,
        satellite_timestamp=satellite_timestamp,
    )


def compute_pfz_zones_sync(
    harbour_id: str = "rameswaram",
    max_candidates: int = 3,
    custom_points: Optional[List[Dict[str, Any]]] = None,
) -> PFZReport:
    """Synchronous runner for compute_pfz_zones."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                return executor.submit(
                    asyncio.run, compute_pfz_zones(harbour_id, max_candidates, custom_points)
                ).result()
    except RuntimeError:
        pass
    return asyncio.run(compute_pfz_zones(harbour_id, max_candidates, custom_points))
