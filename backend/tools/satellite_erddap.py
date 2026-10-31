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
NOAA_CRW_SST_BASE_URL = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/NOAA_DHW.json"
NOAA_VIIRS_CHLA_BASE_URL = (
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
    timeout: float = 20.0,
) -> SatelliteGridResult:
    """
    Fetches NOAA Coral Reef Watch 5km daily satellite Sea Surface Temperature (SST) via ERDDAP.
    Endpoint: NOAA_DHW.json?CRW_SST[(last)][(LAT_MIN):(LAT_MAX)][(LON_MIN):(LON_MAX)]
    """
    lat_min, lat_max, lon_min, lon_max = _compute_bbox(lat, lon, box_deg)
    cache_key = (round(lat_min, 2), round(lat_max, 2), round(lon_min, 2), round(lon_max, 2))
    now = time.time()

    if cache_key in _SST_CACHE:
        cached_time, cached_val = _SST_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_val

    # ERDDAP griddap query string for Coral Reef Watch SST
    url = (
        f"{NOAA_CRW_SST_BASE_URL}?CRW_SST[(last)]"
        f"[({lat_min}):({lat_max})]"
        f"[({lon_min}):({lon_max})]"
    )

    should_close = False
    active_client = client
    if active_client is None:
        active_client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
        should_close = True

    try:
        resp = await active_client.get(url)
        resp.raise_for_status()
        payload = resp.json()
    finally:
        if should_close:
            await active_client.aclose()

    table = payload.get("table", {})
    col_names = table.get("columnNames", [])
    rows = table.get("rows", [])

    time_idx = col_names.index("time") if "time" in col_names else 0
    lat_idx = col_names.index("latitude") if "latitude" in col_names else 1
    lon_idx = col_names.index("longitude") if "longitude" in col_names else 2
    sst_idx = col_names.index("CRW_SST") if "CRW_SST" in col_names else 3

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
    timeout: float = 20.0,
) -> SatelliteGridResult:
    """
    Fetches NOAA VIIRS 9km near-real-time gap-filled daily Chlorophyll-a via ERDDAP.
    Endpoint: nesdisVHNnoaaSNPPnoaa20NRTchlaGapfilledDaily.json?chlor_a[(last)][(0)][(LAT_MIN):(LAT_MAX)][(LON_MIN):(LON_MAX)]
    Critical: Includes altitude constraint [(0)] as 2nd axis to satisfy 4-axis grid.
    """
    lat_min, lat_max, lon_min, lon_max = _compute_bbox(lat, lon, box_deg)
    cache_key = (round(lat_min, 2), round(lat_max, 2), round(lon_min, 2), round(lon_max, 2))
    now = time.time()

    if cache_key in _CHL_CACHE:
        cached_time, cached_val = _CHL_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_val

    # ERDDAP 4-axis query (time, altitude, latitude, longitude)
    url = (
        f"{NOAA_VIIRS_CHLA_BASE_URL}?chlor_a[(last)][(0)]"
        f"[({lat_min}):({lat_max})]"
        f"[({lon_min}):({lon_max})]"
    )

    should_close = False
    active_client = client
    if active_client is None:
        active_client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)
        should_close = True

    try:
        resp = await active_client.get(url)
        resp.raise_for_status()
        payload = resp.json()
    finally:
        if should_close:
            await active_client.aclose()

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

