---
name: ponytail-review
description: >-
  Review code diffs, branches, or pull requests strictly for over-engineering,
  unnecessary abstractions, security gaps, and bloat, generating an actionable delete-list.
---

# Ponytail Review: Anti-Bloat Code Diff Reviewer

Use this skill to review proposed code changes, diffs, or pull requests.

## Review Principles

1. **Scrutinize Every New Line:**
   - Ask: "Could this task be accomplished with 50% fewer lines?"
   - Check if existing helpers or language built-ins were bypassed.

2. **Detect Over-Abstraction:**
   - Flag single-implementation interfaces, premature factory methods, or excessive generic wrappers.

3. **Verify Security & Correctness:**
   - Ensure minimalism did not bypass input sanitization, boundaries, or transaction integrity.

4. **Generate the "Delete-List":**
   - Provide an exact, line-by-line list of what should be deleted or simplified.

