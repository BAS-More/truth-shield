# AGENTS.md — operating contract for AI coding agents (Jules, etc.)

Truth Shield is a Claude Code **Stop hook** that fact-checks claims in responses. Agents read this
file automatically. Your job is to **FIX the issue, not introduce new ones** — smallest change wins.

## What this repo is
- `hooks/truth-shield-enforcer.js` — the hook (the deploy artifact): a single, **dependency-free**,
  self-contained Node script. Keep it that way.
- `hooks/truth-shield-enforcer.test.js` — the test suite; it imports the real pure functions exported
  from the hook. Keep those exports intact.

## Test / verify
- Install: none (zero runtime dependencies).
- Test: `node hooks/truth-shield-enforcer.test.js` — must print all tests passing and exit 0.

A change is **not done** until that suite passes in full.

## Critical invariant — never break this
The hook must **NEVER crash or block Claude on error**. It is fail-open: every path catches errors and
calls `safeExit(0)` / `process.exit(0)`. **Never** introduce a non-zero `process.exit`, an uncaught
throw, or a hang. If unsure whether a change preserves fail-open behaviour, do not make it.

## Operating constraints
1. Smallest change; no unrelated refactors/reformatting/renames.
2. Stay in scope; <= ~150 lines / <= 5 files. Larger -> stop and report.
3. Add a test that fails before / passes after; run the full suite; if it fails, open NO PR — report.
4. Preserve behaviour and the exported function signatures.
5. In the PR, list files changed + why and the tests added.

## Forbidden zones — STOP and report unless that IS the task
Secrets/credentials · CI/deploy/infra config · adding dependencies (this hook stays dep-free) ·
anything changing the hook output contract (the `decision: "block"` JSON) or its fail-open guarantee.

## If you cannot comply
Find no real issue, or cannot satisfy these constraints? Open **no** PR and report what you checked.
Do not invent work.
