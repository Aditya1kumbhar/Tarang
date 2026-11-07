"""Tests verifying efficiency and background warm elimination for resource-constrained instances."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from backend.main import _compute_dashboard_summary_impl
from backend.schemas.models import HarbourInfo, VesselType
from backend.tools import marine_cache as mc_module
from backend.tools.marine_cache import (
    HarbourCacheEntry,
    MarineDataCache,
    PFZ_RECOMPUTE_INTERVAL_SECONDS,
    VIP_HARBOUR_IDS,
)


def _sample_harbour(hid: str = "rameswaram") -> HarbourInfo:
    return HarbourInfo(
        id=hid,
        name=f"Harbour {hid}",
        local_name=f"Local {hid}",
        state="Tamil Nadu",
        lat=9.2876,
        lon=79.3129,
        primary_language="ta",
    )


@pytest.mark.asyncio
async def test_start_background_tasks_performs_no_full_fleet_warm(monkeypatch):
    """Starting background tasks performs no full-fleet warm."""
    cache = MarineDataCache()
    mock_warm_all = AsyncMock()
    mock_warm_vip = AsyncMock()
    monkeypatch.setattr(cache, "warm_all_harbours", mock_warm_all)
    monkeypatch.setattr(cache, "warm_vip_harbours", mock_warm_vip)

    cache.start_background_tasks()
    await asyncio.sleep(0.01)
    cache.stop_background_tasks()

    assert mock_warm_all.call_count == 0
    assert mock_warm_vip.call_count == 1


@pytest.mark.asyncio
async def test_vip_loop_warms_only_listed_harbours(monkeypatch):
    """The VIP loop warms only listed harbours."""
    cache = MarineDataCache()
    warmed_ids = []

    async def fake_warm(harbour, timeout=12.0):
        warmed_ids.append(harbour.id)
        return cache.create_fallback_entry(harbour)

    monkeypatch.setattr(cache, "warm_harbour", fake_warm)

    await cache.warm_vip_harbours()

    assert warmed_ids == list(VIP_HARBOUR_IDS)


@pytest.mark.asyncio
async def test_dashboard_summary_performs_zero_live_weather_calls(monkeypatch):
    """Dashboard summary path performs zero live weather calls."""
    harbour = _sample_harbour("nagapattinam")
    mock_live_weather = AsyncMock()
    monkeypatch.setattr("backend.main.get_weather_marine_report", mock_live_weather)
    monkeypatch.setattr(
        "backend.tools.weather_marine_tool.get_weather_marine_report",
        mock_live_weather,
    )

    response = await _compute_dashboard_summary_impl(harbour, VesselType.COUNTRY_CRAFT)

    assert response is not None
    assert response.weather is not None
    mock_live_weather.assert_not_called()


@pytest.mark.asyncio
async def test_pfz_guard_skips_recomputation_inside_21600_seconds(monkeypatch):
    """PFZ guard skips recomputation inside 21600 seconds while refreshing weather."""
    cache = MarineDataCache()
    harbour = _sample_harbour("rameswaram")
    mock_compute_pfz = AsyncMock()
    monkeypatch.setattr(mc_module, "compute_pfz_zones", mock_compute_pfz)

    # Seed cache with an existing entry having young PFZ (< 21600s)
    initial_entry = cache.create_fallback_entry(harbour)
    initial_entry.pfz_computed_at = datetime.now(timezone.utc) - timedelta(seconds=100)
    cache.set_entry(initial_entry)

    warmed = await cache.warm_harbour(harbour, timeout=5.0)

    mock_compute_pfz.assert_not_called()
    assert warmed.pfz_computed_at == initial_entry.pfz_computed_at


@pytest.mark.asyncio
async def test_on_demand_warm_fires_once_on_cache_miss(monkeypatch):
    """On-demand warm fires exactly once per harbour on a cache miss."""
    cache = MarineDataCache()
    harbour = _sample_harbour("kochi")
    warmed_harbours = []

    async def fake_warm(h, timeout=20.0):
        warmed_harbours.append(h.id)
        await asyncio.sleep(0.05)
        return cache.create_fallback_entry(h)

    monkeypatch.setattr(cache, "warm_harbour", fake_warm)

    # Cold cache: get_or_refresh_harbour serves fallback immediately and schedules 1 bg warm
    entry1 = await cache.get_or_refresh_harbour(harbour)
    assert entry1.weather_data_mode == "FALLBACK_SNAPSHOT"

    # Second immediate call should not schedule another warm because inflight is guarded
    entry2 = await cache.get_or_refresh_harbour(harbour)
    assert entry2 is not None

    # Wait for the background warm task to complete
    await asyncio.sleep(0.1)

    assert warmed_harbours == ["kochi"]
    assert "kochi" in cache._requested_harbour_ids
