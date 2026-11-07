"""Cache-miss never blocks the caller (chat timeout fix, 2026-11-07).

All external calls are monkeypatched. No network access happens in these
tests.
"""
import asyncio
import time

from backend.tools import marine_cache as mc


def _first_harbour():
    harbours = mc.load_harbours_dict()
    return next(iter(harbours.values()))


def test_cache_miss_returns_fallback_immediately_and_schedules_one_warm(monkeypatch):
    harbour = _first_harbour()
    cache = mc.MarineDataCache()

    calls = {"count": 0}

    async def slow_warm(h, timeout=20.0):
        calls["count"] += 1
        await asyncio.sleep(5)
        fresh = cache.create_fallback_entry(h)
        cache.set_entry(fresh)
        return fresh

    monkeypatch.setattr(cache, "warm_harbour", slow_warm)

    async def run():
        start = time.perf_counter()
        entry = await cache.get_or_refresh_harbour(harbour)
        elapsed = time.perf_counter() - start
        await asyncio.sleep(0.2)
        second = await cache.get_or_refresh_harbour(harbour)
        return entry, second, elapsed

    entry, second, elapsed = asyncio.run(run())
    assert elapsed < 2.0
    assert entry.weather_data_mode == "FALLBACK_SNAPSHOT"
    assert second is entry
    assert calls["count"] == 1


def test_cache_miss_background_warm_replaces_fallback(monkeypatch):
    harbour = _first_harbour()
    cache = mc.MarineDataCache()

    async def fast_warm(h, timeout=20.0):
        fresh = cache.create_fallback_entry(h)
        cache.set_entry(fresh)
        return fresh

    monkeypatch.setattr(cache, "warm_harbour", fast_warm)

    async def run():
        entry = await cache.get_or_refresh_harbour(harbour)
        await asyncio.sleep(0.3)
        return entry

    entry = asyncio.run(run())
    stored = cache.get_entry(harbour.id)
    assert stored is not None
    assert stored is not entry
    assert harbour.id.lower() not in cache._refresh_inflight
