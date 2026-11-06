"""Marine cache leg decoupling and stale-while-revalidate tests.

All external calls are monkeypatched. No network access happens in these
tests.
"""
import asyncio
import dataclasses
import inspect
from datetime import datetime, timedelta, timezone

from backend.tools import marine_cache as mc


def _first_harbour():
    harbours = mc.load_harbours_dict()
    return next(iter(harbours.values()))


def test_pfz_hang_does_not_discard_live_weather(monkeypatch):
    harbour = _first_harbour()
    cache = mc.MarineDataCache()
    fallback_entry = cache.create_fallback_entry(harbour)
    fake_report = next(iter(fallback_entry.weather_by_vessel.values()))

    async def fake_weather(**kwargs):
        return fake_report

    async def hanging_pfz(**kwargs):
        await asyncio.sleep(30)
        raise AssertionError("PFZ leg should have been cut off by its own budget")

    monkeypatch.setattr(mc, "get_weather_marine_report", fake_weather)
    monkeypatch.setattr(mc, "compute_pfz_zones", hanging_pfz)
    monkeypatch.setattr(mc, "PFZ_WARM_BUDGET_SECONDS", 0.5)

    async def run():
        return await cache.warm_harbour(harbour, timeout=5.0)

    entry = asyncio.run(run())
    assert fake_report in entry.weather_by_vessel.values()
    assert entry.pfz_data_mode == "FALLBACK_SNAPSHOT"


def test_fallback_entry_schedules_single_background_refresh(monkeypatch):
    harbour = _first_harbour()
    cache = mc.MarineDataCache()
    entry = cache.create_fallback_entry(harbour)
    old_entry = dataclasses.replace(
        entry, fetched_at=datetime.now(timezone.utc) - timedelta(hours=1)
    )
    cache.set_entry(old_entry)

    calls = {"count": 0}

    async def counting_warm(h, timeout=20.0):
        calls["count"] += 1
        fresh = cache.create_fallback_entry(h)
        cache.set_entry(fresh)
        return fresh

    monkeypatch.setattr(cache, "warm_harbour", counting_warm)

    async def run():
        first = await cache.get_or_refresh_harbour(harbour)
        await asyncio.sleep(0.2)
        second = await cache.get_or_refresh_harbour(harbour)
        await asyncio.sleep(0.2)
        return first, second

    first, second = asyncio.run(run())
    assert first is old_entry
    assert second is not None
    assert calls["count"] == 1


def test_periodic_refresh_budget_is_20_seconds():
    source = inspect.getsource(mc.MarineDataCache.start_background_tasks)
    assert "timeout_per_harbour=20.0" in source
    assert "timeout_per_harbour=12.0" in source
    assert "timeout_per_harbour=15.0" in source
