"""
Test suite for tarang-chat-deadline-guarantee-fix-2026-11-07.

Motivation: the live acceptance test of 2026-11-07 (20:09-20:15 IST) failed on
the previous build. Both Rameswaram PFZ questions died on the frontend's 75 s
abort while the backend cap was still 60 s and the two synthesis provider
budgets (12 s + 12 s) nearly filled the whole 25 s synthesis stage, leaving
the documented 45 s server guarantee unenforced.

Verifies:
1. The deadline contract defaults align: AI timeout 45 s, provider budgets
   8 s + 8 s (inside the 20 s synthesis stage cap).
2. Both synthesis providers hanging: the orchestrator still returns the
   deterministic template answer quickly (provider budgets patched small).
3. The synthesis stage killed before it can write any recommendation: the
   orchestrator still returns a non-empty rescue advisory in the shared
   verdict vocabulary, marked template_fallback, inside the deadline.
"""

import asyncio
import time

import pytest

import backend.config as config
from backend.agents import orchestrator
from backend.agents.orchestrator import run_orchestrator
from backend.schemas.models import ChatRequest, HarbourID, HarbourInfo, VesselType
from backend.tools.marine_cache import marine_cache


def _seed_fallback_cache() -> None:
    harbour = HarbourInfo(
        id="rameswaram",
        name="Rameswaram Fishing Port",
        local_name="Rameswaram",
        state="Tamil Nadu",
        lat=9.2881,
        lon=79.3129,
        primary_language="ta",
    )
    marine_cache.set_entry(marine_cache.create_fallback_entry(harbour))


def _pfz_request() -> ChatRequest:
    return ChatRequest(
        message="Where is the nearest Potential Fishing Zone today?",
        harbour_id=HarbourID.RAMESWARAM,
        vessel_type=VesselType.COUNTRY_CRAFT,
    )


def test_deadline_contract_defaults_align():
    """Server guarantee is 45 s; provider budgets leave template headroom."""
    assert config.AI_TIMEOUT_SECONDS == 45.0
    assert config.NUGEN_SYNTHESIS_BUDGET_SECONDS == 8.0
    assert config.GEMINI_SYNTHESIS_BUDGET_SECONDS == 8.0
    assert orchestrator.GLOBAL_CHAT_DEADLINE_SECONDS == 45.0
    assert orchestrator.SYNTHESIS_STAGE_BUDGET_SECONDS == 20.0
    provider_total = (
        config.NUGEN_SYNTHESIS_BUDGET_SECONDS + config.GEMINI_SYNTHESIS_BUDGET_SECONDS
    )
    assert provider_total < orchestrator.SYNTHESIS_STAGE_BUDGET_SECONDS


@pytest.mark.asyncio
async def test_both_providers_hang_template_answer_within_deadline(monkeypatch):
    """Nugen and Gemini both hang: template answer still arrives fast."""
    _seed_fallback_cache()

    async def hang(*args, **kwargs):
        await asyncio.sleep(30)

    monkeypatch.setattr(orchestrator, "NUGEN_API_KEY", "test-key")
    monkeypatch.setattr(orchestrator, "NUGEN_MODEL_ID", "model_test")
    monkeypatch.setattr(orchestrator, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(orchestrator, "_call_nugen_synthesis", hang)
    monkeypatch.setattr(orchestrator, "_call_gemini_synthesis", hang)
    monkeypatch.setattr(orchestrator, "NUGEN_SYNTHESIS_BUDGET_SECONDS", 0.3)
    monkeypatch.setattr(orchestrator, "GEMINI_SYNTHESIS_BUDGET_SECONDS", 0.3)

    t_start = time.perf_counter()
    res = await run_orchestrator(_pfz_request())
    elapsed = time.perf_counter() - t_start

    assert elapsed < 15.0, f"Expected template answer in <15s, took {elapsed:.2f}s"
    assert res.synthesis_mode == "template_fallback"
    assert len(res.recommendation) > 0
    assert len(res.evidence_and_reasoning) > 0


@pytest.mark.asyncio
async def test_synthesis_killed_early_rescue_advisory_still_answers(monkeypatch):
    """Synthesis cut before writing anything: rescue advisory fills the answer."""
    _seed_fallback_cache()

    async def hang_forever(state):
        await asyncio.sleep(30)

    monkeypatch.setattr(orchestrator, "synthesize_response", hang_forever)
    monkeypatch.setattr(orchestrator, "GLOBAL_CHAT_DEADLINE_SECONDS", 6.0)
    monkeypatch.setattr(orchestrator, "SYNTHESIS_STAGE_BUDGET_SECONDS", 2.0)

    t_start = time.perf_counter()
    res = await run_orchestrator(_pfz_request())
    elapsed = time.perf_counter() - t_start

    assert elapsed < 15.0, f"Expected rescue answer in <15s, took {elapsed:.2f}s"
    assert res.synthesis_mode == "template_fallback"
    assert len(res.recommendation) > 0
    assert "risk verdict" in res.recommendation
    assert res.risk_verdict in res.recommendation
