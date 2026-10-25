---
name: karpathy-guidelines
description: >-
  Operationalize Andrej Karpathy's core principles for AI-assisted programming:
  Think Before Coding, Simplicity First, Surgical Changes, and Goal-Driven Execution.
---

# Karpathy Guidelines for AI Coding Agents

Inspired by Andrej Karpathy's observations on LLM programming failure modes, this skill enforces four non-negotiable operational principles to ensure code quality, predictability, and minimal blast radius.

---

## Principle 1: Think Before Coding

Do not make silent assumptions. Do not hide confusion behind generic code. Surface tradeoffs early.

1. **State Assumptions Explicitly:**
   - Before writing or modifying code, clarify any ambiguities in the user's request.
   - If multiple valid interpretations exist, state them and explain your chosen direction.

2. **Push Back When Warranted:**
   - If a requested approach introduces anti-patterns, technical debt, or security vulnerabilities, surface the concern and propose the simpler, idiomatic alternative.

3. **Halt When Confused:**
   - If codebase behavior contradicts documentation or requirements, stop and inspect the source. Never guess or write speculative patches.

---

## Principle 2: Simplicity First

Write the minimum code required to solve the problem cleanly. Zero speculative features.

1. **No Premature Generalization:**
   - Solve today's concrete problem, not tomorrow's hypothetical problem.
   - Avoid creating micro-frameworks, factory classes, or deep inheritance hierarchies when a simple function suffices.

2. **Small, Comprehensible Units:**
   - Keep functions focused and short.
   - Avoid 500-line monolithic functions, but also avoid splitting simple logic across 10 tiny, disjointed files.

3. **Readability Over Cleverness:**
   - Write standard, idiomatic code that any software engineer can understand in 5 seconds.
   - Avoid overly clever list comprehensions or obscure language quirks.

---

## Principle 3: Surgical Changes

Touch only what is strictly necessary. Minimize the blast radius of every edit.

1. **Preserve Existing Style & Conventions:**
   - Match indentation, naming patterns, docstring conventions, and architectural flow of the surrounding file.
   - Never reformat adjacent code or reorganize imports unless explicitly requested.

2. **No Drive-By Refactoring:**
   - Do not rename unrelated variables, clean up unrelated comments, or re-architect adjacent modules while fixing a bug.
   - Keep git diffs minimal, clean, and reviewable.

3. **Preserve Comments & Docstrings:**
   - Retain existing architectural explanations and domain notes that are unrelated to your direct change.

---

## Principle 4: Goal-Driven Execution

Anchor every engineering task in clear, objective success criteria and verify continuously.

1. **Define Success Criteria Upfront:**
   - Before executing, know how you will prove that the solution works (e.g., specific test commands, terminal output, API status codes).

2. **Continuous Verification Loop:**
   - Run tests or dry-run scripts after each modification.
   - If a test fails, analyze the root cause from the error traceback rather than applying random trial-and-error patches.

3. **Demonstrable Proof:**
   - Conclude every task with concrete verification proof (e.g., test suite pass rates, log output, or status checks).

