---
name: test-driven-development
description: >-
  Enforce the Red-Green-Refactor cycle: write minimal failing tests first,
  implement the simplest solution to pass, and refactor under test safety.
---

# Test-Driven Development (TDD) Protocol (Addy Osmani)

Ground code development in automated verification through the Red-Green-Refactor discipline.

## The TDD Cycle

1. **RED (Write Failing Test):**
   - Write a focused test asserting the required behavior or edge case before implementing the code.
   - Run the test suite to confirm it fails for the expected reason.

2. **GREEN (Make it Pass):**
   - Write the simplest, most direct code that makes the test pass.
   - Do not write speculative extra features; satisfy the test assertions directly.

3. **REFACTOR (Clean and Harden):**
   - Clean up code structure, eliminate duplication, improve variable naming, and optimize performance.
   - Re-run all tests to guarantee no regressions were introduced.

