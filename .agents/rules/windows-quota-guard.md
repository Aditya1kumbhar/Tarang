---
trigger: always_on
---

# Windows Quota Guard & System Invariants

These three operational rules are strictly enforced across all agent executions in this project:

1. **Explicit UTF-8 Encoding on Windows:**
   Always pass `encoding="utf-8"` to every `open()`, `Path.read_text()`, `Path.write_text()`, and `json.load()`/`json.dump()` call in Python on Windows to prevent `cp1252` encoding corruption on Indic/multilingual characters.

2. **Single-Phase Bounded Execution:**
   Never run more than ONE Phase per conversation. Upon completing all deliverables and verifying tests for the active phase, write `.agents/checkpoints/PHASE_<N>_DONE.md` and immediately stop.

3. **Deterministic Non-Interactive Test Execution:**
   Always run test suites via `.venv\Scripts\pytest.exe` using standard non-interactive flags (e.g. `.venv\Scripts\pytest.exe tests/test_tools.py -v`) without watch mode or interactive prompts.
