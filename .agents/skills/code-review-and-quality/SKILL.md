---
name: code-review-and-quality
description: >-
  Execute a thorough, multi-axis code review checking for logic errors, type safety,
  architectural consistency, error handling, and test coverage before shipping.
---

# Code Review & Quality Standards (Addy Osmani)

Perform rigorous, structured code reviews to ensure production-grade software quality.

## Review Checklist

1. **Correctness & Logic:**
   - Verify boundary conditions, off-by-one errors, null/undefined safety, and type narrowing.
   - Trace asynchronous flows for unhandled rejections or uncancelled listeners.

2. **Simplicity & Maintainability:**
   - Eliminate unnecessary indirection, premature abstractions, and duplicate code.
   - Enforce idiomatic naming and clear, self-documenting functions.

3. **Security & Zero-Trust:**
   - Verify all external inputs are strictly sanitized and validated against schemas.
   - Ensure parameterized queries are used and secrets are never logged.

4. **Performance & Resources:**
   - Check for memory leaks in event listeners, unmemoized expensive calculations, and unbatched I/O.
   - Verify database queries are indexed and avoid N+1 traps.

5. **Test Completeness:**
   - Ensure unit, integration, or edge-case tests cover the changes with reproducible assertions.

