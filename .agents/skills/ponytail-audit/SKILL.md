---
name: ponytail-audit
description: >-
  Audit an entire repository or major subsystem for architectural bloat, redundant code,
  premature abstractions, and YAGNI violations, ranking findings by impact.
---

# Ponytail Audit: Whole-Repository Complexity Scanner

Use this skill when auditing a codebase for technical bloat, architectural excess, or redundant abstractions.

## Audit Workflow

1. **Scan Architecture & Structure:**
   - Identify single-use helper modules, unnecessary pass-through wrapper layers, or speculative abstract base classes.
   - Look for duplicate logic across routers, services, or UI components.

2. **Evaluate Dependencies:**
   - Scan `package.json` or `requirements.txt` for micro-dependencies that can be replaced with 2 lines of standard library code.

3. **Rank Issues by Severity:**
   - **Critical Bloat:** Complex abstractions that obfuscate data flow or degrade performance.
   - **Moderate Bloat:** Unnecessary wrapper functions, duplicate schemas, or excessive indirection.
   - **Minor Bloat:** Dead comments, unused imports, or speculative configuration flags.

4. **Output Concrete Recommendations:**
   - Produce a prioritized "Delete-List" showing exact files or lines that can be safely eliminated.

