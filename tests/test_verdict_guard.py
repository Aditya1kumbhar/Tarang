"""Verdict consistency guard and synthesis prompt vocabulary tests.

Pattern note: the OrchestratorState construction below mirrors the state
construction used in tests/test_nugen_synthesis.py. If the import lines in
that file differ from the ones written here, copy the import lines from
that file instead and keep the test bodies unchanged.
"""
from backend.agents.orchestrator import _build_synthesis_prompts, _verdict_guard_ok
from backend.agents.state import OrchestratorState
from backend.schemas.models import HarbourInfo, SafetyLevel, VesselType


def test_guard_accepts_matching_risk_word():
    assert _verdict_guard_ok("Conditions are HIGH Risk today, stay alert.", "HIGH") is True


def test_guard_rejects_colour_verdict_mixup():
    text = "Given the current safety verdict of GREEN (HIGH Risk, Safety Index: 52/100), remain inside."
    assert _verdict_guard_ok(text, "HIGH") is False


def test_guard_rejects_wrong_risk_word():
    assert _verdict_guard_ok("It is LOW Risk and safe to venture.", "HIGH") is False


def test_guard_rejects_verdict_line_mismatch():
    assert _verdict_guard_ok("Verdict: MODERATE. Seas are rising.", "HIGH") is False


def test_guard_accepts_text_without_verdict_words():
    assert _verdict_guard_ok("Calm seas and gentle winds near the harbour.", "LOW") is True


def test_guard_rejects_amber():
    assert _verdict_guard_ok("AMBER conditions near the harbour mouth.", "MODERATE") is False


def test_guard_rejects_empty_text():
    assert _verdict_guard_ok("", "LOW") is False


def test_prompt_uses_single_verdict_vocabulary():
    state = OrchestratorState(
        query="Is it safe to go tomorrow?",
        harbour=HarbourInfo(
            id="rameswaram",
            name="Rameswaram Fishing Jetty",
            local_name="Rameswaram",
            state="Tamil Nadu",
            lat=9.28,
            lon=79.31,
            primary_language="ta",
        ),
        vessel_type=VesselType.COUNTRY_CRAFT,
    )
    state.safety_status = SafetyLevel.GREEN
    state.risk_verdict = "HIGH"
    state.sea_venture_safety_index = 52
    system_instruction, user_prompt = _build_synthesis_prompts(state, [])
    assert "Safety Verdict: HIGH Risk (Safety Index: 52/100)" in user_prompt
    assert "GREEN (HIGH" not in user_prompt
    assert "VERDICT VOCABULARY" in system_instruction
