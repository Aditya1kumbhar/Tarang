"""Fleet warming must never starve live chat on the tiny production instance.

2026-11-07 production logs: while warm_all_harbours warmed harbours two at a
time, a live chat request's data stage took 115 s and the browser gave up.
These tests pin the fix: fleet warming is strictly sequential with a breather
between harbours, and one harbour's failure does not stop the fleet.
"""
import asyncio
import time

import pytest

from backend.schemas.models import HarbourInfo
from backend.tools import marine_cache as mc_module
from backend.tools.marine_cache import MarineDataCache


def _harbour(idx: int) -> HarbourInfo:
    return HarbourInfo(
        id=f"test-harbour-{idx}",
        name=f"Test Harbour {idx}",
        local_name=f"Test Harbour {idx}",
        state="Test",
        lat=9.0 + idx,
        lon=79.0 + idx,
        primary_language="en",
    )


def _install_fakes(monkeypatch, harbours, fail_ids=frozenset()):
    state = {"active": 0, "max_active": 0, "order": []}

    async def fake_warm(self, harbour, timeout=12.0):
        state["active"] += 1
        state["max_active"] = max(state["max_active"], state["active"])
        state["order"].append(harbour.id)
        try:
            await asyncio.sleep(0.05)
            if harbour.id in fail_ids:
                raise RuntimeError("simulated warm failure")
            return self.create_fallback_entry(harbour)
        finally:
            state["active"] -= 1

    monkeypatch.setattr(MarineDataCache, "warm_harbour", fake_warm)
    monkeypatch.setattr(
        mc_module, "load_harbours_dict", lambda: {h.id: h for h in harbours}
    )
    monkeypatch.setattr(mc_module, "FLEET_WARM_GAP_SECONDS", 0.05)
    return state


@pytest.mark.asyncio
async def test_fleet_warm_is_strictly_sequential(monkeypatch):
    cache = MarineDataCache()
    harbours = [_harbour(i) for i in range(3)]
    state = _install_fakes(monkeypatch, harbours)

    t0 = time.perf_counter()
    await cache.warm_all_harbours(timeout_per_harbour=1.0)
    elapsed = time.perf_counter() - t0

    assert state["max_active"] == 1
    assert state["order"] == [h.id for h in harbours]
    # Two breathers of 0.05 s sit between the three harbour warms.
    assert elapsed >= 0.09
    assert cache._is_warmed is True


@pytest.mark.asyncio
async def test_fleet_warm_survives_one_harbour_failure(monkeypatch):
    cache = MarineDataCache()
    harbours = [_harbour(i) for i in range(3)]
    state = _install_fakes(monkeypatch, harbours, fail_ids={harbours[1].id})

    await cache.warm_all_harbours(timeout_per_harbour=1.0)

    assert state["order"] == [h.id for h in harbours]
    assert cache._is_warmed is True
