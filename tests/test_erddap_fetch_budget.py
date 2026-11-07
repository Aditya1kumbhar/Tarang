"""ERDDAP fetch budget: the satellite PFZ fetch needs a realistic budget.

The old caps (1.8 s per grid, 2.5 s overall) made the NOAA CoastWatch
ERDDAP grids fail almost every time, which kept harbours stuck on
FALLBACK data. The raised budget (10.0 s per grid, 20.0 s overall) stays
inside the 25 s PFZ warm-leg budget in marine_cache.
"""
import inspect

from backend.tools import ocean_pfz_tool


def test_erddap_fetch_budget_is_raised():
    source = inspect.getsource(ocean_pfz_tool.compute_pfz_zones)
    assert "timeout=10.0" in source
    assert "timeout=20.0" in source
    assert "timeout=2.5" not in source
    assert "timeout=1.8" not in source
