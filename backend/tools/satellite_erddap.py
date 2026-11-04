"""
Live NOAA Satellite Ingestion Tool via CoastWatch ERDDAP.
Provides keyless, direct REST access to daily satellite sea surface temperature (SST)
and VIIRS near-real-time gap-filled Chlorophyll-a grids across Indian coastal waters.
"""

import asyncio
from datetime import datetime, timezone
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# NOAA CoastWatch ERDDAP Griddap Verified Endpoints (Keyless / Public Domain)
# Primary: High-speed NOAA CoastWatch central cluster (<1s latency, no redirects)
# Fallback: CoastWatch West Coast Node (pfeg.noaa.gov)
NOAA_CRW_SST_BASE_URL = "https://coastwatch.noaa.gov/erddap/griddap/noaacrwsstDaily.json"
NOAA_CRW_SST_FALLBACK_URL = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW.json"

NOAA_VIIRS_CHLA_BASE_URL = (
    "https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPN20VIIRSDINEOFDaily.json"
)
NOAA_VIIRS_CHLA_FALLBACK_URL = (
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNnoaaSNPPnoaa20NRTchlaGapfilledDaily.json"
)

# In-Memory Cache (TTL: 6 Hours for Daily Products)
_SST_CACHE: Dict[Tuple[float, float, float, float], Tuple[float, Any]] = {}
_CHL_CACHE: Dict[Tuple[float, float, float, float], Tuple[float, Any]] = {}
_CACHE_TTL_SECONDS = 6 * 3600  # 6 hours


class SatelliteGridResult(list):
    """
    Subclass of list holding grid point dictionaries, preserving the ERDDAP observation timestamp.
    Enables callers to treat the result both as a list and access .timestamp or .points directly.
    """

    def __init__(self, points: List[Dict[str, Any]], timestamp: Optional[str] = None):
        super().__init__(points)
        self.timestamp = timestamp
        self.points = points


def _compute_bbox(lat: float, lon: float, box_deg: float = 1.5) -> Tuple[float, float, float, float]:
    """Computes bounding box (lat_min, lat_max, lon_min, lon_max) rounded to 3 decimal places."""
    return (
        round(lat - box_deg, 3),
        round(lat + box_deg, 3),
        round(lon - box_deg, 3),
        round(lon + box_deg, 3),
    )


async def fetch_sst_grid(
    lat: float,
    lon: float,
    box_deg: float = 1.5,
    client: Optional[httpx.AsyncClient] = None,
    timeout: float = 3.5,
) -> SatelliteGridResult:
    """
    Fetches NOAA Coral Reef Watch 5km daily satellite Sea Surface Temperature (SST) via ERDDAP.
    Queries primary CoastWatch cluster (noaacrwsstDaily) with automatic fallback to NOAA_DHW.
    """
    lat_min, lat_max, lon_min, lon_max = _compute_bbox(lat, lon, box_deg)
    cache_key = (round(lat_min, 2), round(lat_max, 2), round(lon_min, 2), round(lon_max, 2))
    now = time.time()

    if cache_key in _SST_CACHE:
        cached_time, cached_val = _SST_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_val

    endpoints = [
        (NOAA_CRW_SST_BASE_URL, "analysed_sst"),
        (NOAA_CRW_SST_FALLBACK_URL, "CRW_SST"),
    ]

    should_close = False
    active_client = client
    if active_client is None:
        active_client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
        should_close = True

    payload = None
    last_err = None
    try:
        for base_url, var_name in endpoints:
            url = f"{base_url}?{var_name}[(last)][({lat_min}):({lat_max})][({lon_min}):({lon_max})]"
            try:
                resp = await active_client.get(url)
                resp.raise_for_status()
                payload = resp.json()
                break
            except Exception as e:
                last_err = e
                logger.debug("SST endpoint %s failed: %s; trying fallback", base_url, e)
    finally:
        if should_close:
            await active_client.aclose()

    if payload is None:
        raise last_err or RuntimeError("All NOAA SST ERDDAP endpoints failed")

    table = payload.get("table", {})
    col_names = table.get("columnNames", [])
    rows = table.get("rows", [])

    time_idx = col_names.index("time") if "time" in col_names else 0
    lat_idx = col_names.index("latitude") if "latitude" in col_names else 1
    lon_idx = col_names.index("longitude") if "longitude" in col_names else 2
    if "analysed_sst" in col_names:
        sst_idx = col_names.index("analysed_sst")
    elif "CRW_SST" in col_names:
        sst_idx = col_names.index("CRW_SST")
    else:
        sst_idx = 3

    points: List[Dict[str, Any]] = []
    erddap_timestamp: Optional[str] = None

    for row in rows:
        sst_val = row[sst_idx]
        if sst_val is None or (isinstance(sst_val, float) and math.isnan(sst_val)):
            continue

        t_val = row[time_idx]
        if erddap_timestamp is None and t_val:
            erddap_timestamp = str(t_val)

        p_lat = float(row[lat_idx])
        p_lon = float(row[lon_idx])
        points.append({
            "lat": round(p_lat, 4),
            "lon": round(p_lon, 4),
            "sst_c": round(float(sst_val), 2),
            "timestamp": str(t_val) if t_val else erddap_timestamp,
        })

    result = SatelliteGridResult(points, erddap_timestamp)
    _SST_CACHE[cache_key] = (now, result)
    return result


async def fetch_chl_grid(
    lat: float,
    lon: float,
    box_deg: float = 1.5,
    client: Optional[httpx.AsyncClient] = None,
    timeout: float = 3.5,
) -> SatelliteGridResult:
    """
    Fetches NOAA VIIRS 9km near-real-time gap-filled daily Chlorophyll-a via ERDDAP.
    Queries primary CoastWatch cluster (noaacwNPPN20VIIRSDINEOFDaily) with automatic fallback.
    Critical: Includes altitude constraint [(0)] as 2nd axis to satisfy 4-axis grid.
    """
    lat_min, lat_max, lon_min, lon_max = _compute_bbox(lat, lon, box_deg)
    cache_key = (round(lat_min, 2), round(lat_max, 2), round(lon_min, 2), round(lon_max, 2))
    now = time.time()

    if cache_key in _CHL_CACHE:
        cached_time, cached_val = _CHL_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_val

    endpoints = [
        NOAA_VIIRS_CHLA_BASE_URL,
        NOAA_VIIRS_CHLA_FALLBACK_URL,
    ]

    should_close = False
    active_client = client
    if active_client is None:
        active_client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
        should_close = True

    payload = None
    last_err = None
    try:
        for base_url in endpoints:
            url = (
                f"{base_url}?chlor_a[(last)][(0)]"
                f"[({lat_min}):({lat_max})]"
                f"[({lon_min}):({lon_max})]"
            )
            try:
                resp = await active_client.get(url)
                resp.raise_for_status()
                payload = resp.json()
                break
            except Exception as e:
                last_err = e
                logger.debug("Chl endpoint %s failed: %s; trying fallback", base_url, e)
    finally:
        if should_close:
            await active_client.aclose()

    if payload is None:
        raise last_err or RuntimeError("All NOAA Chl-a ERDDAP endpoints failed")

    table = payload.get("table", {})
    col_names = table.get("columnNames", [])
    rows = table.get("rows", [])

    time_idx = col_names.index("time") if "time" in col_names else 0
    lat_idx = col_names.index("latitude") if "latitude" in col_names else 2
    lon_idx = col_names.index("longitude") if "longitude" in col_names else 3
    chl_idx = col_names.index("chlor_a") if "chlor_a" in col_names else 4

    points: List[Dict[str, Any]] = []
    erddap_timestamp: Optional[str] = None

    for row in rows:
        chl_val = row[chl_idx]
        if chl_val is None or (isinstance(chl_val, float) and math.isnan(chl_val)):
            continue

        # Filter negative or physical artifacts
        if float(chl_val) < 0.0:
            continue

        t_val = row[time_idx]
        if erddap_timestamp is None and t_val:
            erddap_timestamp = str(t_val)

        p_lat = float(row[lat_idx])
        p_lon = float(row[lon_idx])
        points.append({
            "lat": round(p_lat, 4),
            "lon": round(p_lon, 4),
            "chla_mg_m3": round(float(chl_val), 3),
            "timestamp": str(t_val) if t_val else erddap_timestamp,
        })

    result = SatelliteGridResult(points, erddap_timestamp)
    _CHL_CACHE[cache_key] = (now, result)
    return result

