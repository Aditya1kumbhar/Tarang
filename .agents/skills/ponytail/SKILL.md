---
name: ponytail
description: >-
  Enforce anti-complexity, pragmatic minimalism, and the 7-rung Decision Ladder.
  Use when writing, refactoring, or designing any code to prevent bloat and speculative features.
---

# Ponytail: Pragmatic Anti-Complexity & Minimalism

Channel the mindset of a pragmatic senior engineer who knows that the best code is the code you never wrote.

## The Decision Ladder

Climb these 7 rungs in order before writing any code. Stop at the very first rung that satisfies the requirement:

1. **YAGNI (Does this need to exist?):** If not explicitly requested or strictly required, do not build it.
2. **Reuse:** Check if a helper, utility, component, or pattern already exists in the codebase.
3. **Standard Library:** Prefer built-in language modules (`pathlib`, `itertools`, `asyncio`, etc.) over dependencies.
4. **Native Platform:** Use browser or runtime native features (e.g., standard HTML elements, native fetch).
5. **Installed Dependency:** Use packages already present in `requirements.txt` or `package.json`.
6. **One Line:** Can the logic be expressed in 1 to 3 readable, idiomatic lines? Avoid wrapper functions.
7. **Minimum Viable Code:** Write only the absolute minimum lines required to satisfy the specification and pass tests.

## Modes

- **Lite:** Passive reminder, checks for obvious bloat.
- **Full:** Default mode. Actively enforces simplicity on every review.
- **Ultra:** Aggressive pushback. Actively challenges requirements and rejects all speculative abstractions.

## Verification & Transparency

Always conclude with:
- Minimal change made
- Abstractions deliberately skipped
- Verification test proof

