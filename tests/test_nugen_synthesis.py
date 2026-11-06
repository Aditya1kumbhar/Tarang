"""
Tests for Nugen Aligned Model Synthesis integration in Tarang ORCA.
Verifies Work Packages A, B, C, D, E, F:
1. Nugen success: mocked chat completion yields synthesis_mode='nugen' and recommendation text.
2. Nugen failure fallbacks (HTTP 500, Timeout, Malformed JSON): silently falls through to Gemini/template fallback.
3. No NUGEN env values: Nugen HTTP is never attempted.
4. RED_ALERT scenario: circuit breaker output (safety_status and safety_override_banner) is identical with or without Nugen.
All calls are fully mocked with zero real API keys or live network requests.
"""

import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from starlette.testclient import TestClient

from backend.agents.orchestrator import _call_nugen_synthesis
from backend.agents.state import OrchestratorState
from backend.auth import create_session_token
from backend.main import _CHAT_CACHE, app
from backend.rate_limiter import limiter
from backend.schemas.models import HarbourInfo, SafetyLevel, VesselType

TEST_USER_DICT = {
    "email": "test.officer@nic.in",
    "name": "Test Maritime Officer",
    "sub": "test_officer_001",
}
TEST_TOKEN = create_session_token(TEST_USER_DICT)

client = TestClient(
    app,
    cookies={"orca_session": TEST_TOKEN},
    headers={"Authorization": f"Bearer {TEST_TOKEN}"},
)


@pytest.fixture(autouse=True)
def reset_test_state():
    """Resets rate limiter and clears chat cache before and after each test."""
    limiter._storage.reset()
    _CHAT_CACHE.clear()
    yield
    limiter._storage.reset()
    _CHAT_CACHE.clear()


def test_nugen_synthesis_success():
    """
    Nugen success: with NUGEN env set and HTTP call mocked to return a valid
    chat completion, synthesis_mode is 'nugen' and recommendation equals mocked text.
    """
    expected_text = "Advisory from Nugen aligned model: Sea conditions are calm and safe for fishing."
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "chatcmpl-test-001",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": expected_text,
                },
                "finish_reason": "stop",
            }
        ],
        "confidence_score": 96,
    }

    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-nugen-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-nugen-aligned-model"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        payload = {
            "message": "What is the fishing condition near Rameswaram today?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["synthesis_mode"] == "nugen"
        assert data["recommendation"] == expected_text
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        assert "https://api.nugen.in/api/v3/inference/chat/completions" in call_args[0]
        assert call_kwargs["headers"]["Authorization"] == "Bearer mock-nugen-key"
        assert call_kwargs["json"]["model"] == "mock-nugen-aligned-model"


def test_nugen_http_500_falls_through_to_template():
    """
    Nugen HTTP 500 error falls through silently; with Gemini also unconfigured or failing,
    synthesis_mode ends as 'template_fallback' and a full valid response is produced.
    """
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"

    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-nugen-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-nugen-aligned-model"), \
         patch("backend.agents.orchestrator.GEMINI_API_KEY", ""), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        payload = {
            "message": "What is the wave height near Rameswaram?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["synthesis_mode"] == "template_fallback"
        assert len(data["recommendation"]) > 0
        assert "Rameswaram" in data["recommendation"]


def test_nugen_timeout_falls_through_to_template():
    """
    Nugen timeout falls through silently to template fallback when Gemini is unavailable.
    """
    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-nugen-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-nugen-aligned-model"), \
         patch("backend.agents.orchestrator.GEMINI_API_KEY", ""), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = asyncio.TimeoutError()

        payload = {
            "message": "Is it safe to fish tomorrow morning?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["synthesis_mode"] == "template_fallback"
        assert len(data["recommendation"]) > 0


def test_nugen_malformed_json_falls_through_to_template():
    """
    Nugen empty or malformed completion content falls through to template fallback.
    """
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"choices": [{"message": {"content": "   "}}]}  # empty after strip

    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-nugen-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-nugen-aligned-model"), \
         patch("backend.agents.orchestrator.GEMINI_API_KEY", ""), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        payload = {
            "message": "What is the water temperature?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        assert data["synthesis_mode"] == "template_fallback"
        assert len(data["recommendation"]) > 0


def test_no_nugen_env_never_attempts_nugen_http():
    """
    When NUGEN_API_KEY or NUGEN_MODEL_ID is unset, Nugen HTTP endpoint is NEVER called.
    """
    with patch("backend.agents.orchestrator.NUGEN_API_KEY", ""), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", ""), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        payload = {
            "message": "Where is the nearest Potential Fishing Zone (PFZ)?",
            "harbour_id": "rameswaram",
            "vessel_type": "country_craft",
        }
        resp = client.post("/api/v1/chat", json=payload)
        assert resp.status_code == 200
        data = resp.json()

        for call in mock_post.call_args_list:
            called_url = str(call[0][0]) if call[0] else ""
            assert "api.nugen.in" not in called_url

        assert data["synthesis_mode"] in ("gemini", "template_fallback")


def test_red_alert_circuit_breaker_parity_with_nugen():
    """
    RED_ALERT scenario: safety_override_banner and safety_status are identical
    regardless of whether Nugen succeeds or is absent.
    The circuit breaker output MUST NOT depend on the synthesis provider.
    """
    import backend.main
    backend.main._CHAT_CACHE.clear()

    # 1. Baseline without Nugen
    payload_baseline = {
        "message": "Can we set our nets inside the Gulf of Mannar Marine National Park baseline assessment?",
        "harbour_id": "rameswaram",
        "vessel_type": "country_craft",
    }
    with patch("backend.agents.orchestrator.NUGEN_API_KEY", ""), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", ""):
        backend.main._CHAT_CACHE.clear()
        resp_baseline = client.post("/api/v1/chat", json=payload_baseline)
        assert resp_baseline.status_code == 200
        data_baseline = resp_baseline.json()

    assert data_baseline["safety_status"] == "RED_ALERT"
    assert data_baseline["safety_override_banner"] is not None

    # 2. With Nugen mocked to succeed
    payload_nugen = {
        "message": "Can we set our nets inside the Gulf of Mannar Marine National Park Nugen assessment?",
        "harbour_id": "rameswaram",
        "vessel_type": "country_craft",
    }
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "CRITICAL DIRECTIVE: Vessel must not enter Gulf of Mannar Marine National Park.",
                }
            }
        ],
        "confidence_score": 99,
    }

    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-nugen-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-nugen-aligned-model"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        backend.main._CHAT_CACHE.clear()
        resp_nugen = client.post("/api/v1/chat", json=payload_nugen)
        assert resp_nugen.status_code == 200
        data_nugen = resp_nugen.json()

    assert data_nugen["synthesis_mode"] == "nugen", f"Unexpected synthesis_mode. Full response: {data_nugen}"
    assert data_nugen["safety_status"] == data_baseline["safety_status"]
    assert data_nugen["safety_override_banner"] == data_baseline["safety_override_banner"]
    assert "CRITICAL MARITIME SAFETY OVERRIDE" in data_nugen["safety_override_banner"]


@pytest.mark.asyncio
async def test_call_nugen_synthesis_logs_confidence(caplog):
    """
    Verifies that _call_nugen_synthesis logs NUGEN_CONFIDENCE with model id and score
    without leaking API credentials.
    """
    state = OrchestratorState(
        query="Test query",
        vessel_type=VesselType.COUNTRY_CRAFT,
        detected_language="en",
        harbour=HarbourInfo(
            id="rameswaram",
            name="Rameswaram",
            local_name="ராமேஸ்வரம்",
            lat=9.28,
            lon=79.31,
            state="Tamil Nadu",
            coast="East",
            primary_language="ta",
        ),
        safety_status=SafetyLevel.GREEN,
        sea_venture_safety_index=85,
        risk_verdict="Low",
    )

    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Clear seas today."}}],
        "confidence_score": 92.5,
    }

    with patch("backend.agents.orchestrator.NUGEN_API_KEY", "mock-key"), \
         patch("backend.agents.orchestrator.NUGEN_MODEL_ID", "mock-aligned-v1"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
         caplog.at_level(logging.INFO):
        mock_post.return_value = mock_resp
        result = await _call_nugen_synthesis(state, ["Evidence 1"])

        assert result == "Clear seas today."
        assert "mock-aligned-v1" in state.models_attempted
        assert any("NUGEN_CONFIDENCE: model=mock-aligned-v1 confidence=92.5" in rec.message for rec in caplog.records)
        # Ensure API key is NEVER logged
        assert not any("mock-key" in rec.message for rec in caplog.records)
