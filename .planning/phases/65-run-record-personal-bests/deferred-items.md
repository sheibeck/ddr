# Deferred Items — Phase 65 Plan 01

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule
(only auto-fix issues directly caused by the current task's changes).

## Pre-existing `npm test` failures, unrelated to this plan

`npm test` on this worktree (base commit `adc941e`) reports **7 failures**
that this plan did not cause and did not fix:

| # | Test | File |
|---|------|------|
| 1 | Outliers (Phase 26) lists exactly the revisit rows | test/unit/class-pass-ledger.test.js |
| 2 | AFTER, Outliers and Handoff blocks are byte-identical to a fresh render | test/unit/class-pass-ledger.test.js |
| 3 | Handoff to Phase 27 carries the yardstick | test/unit/class-pass-ledger.test.js |
| 4 | v1.5 AFTER section is byte-identical to a fresh render | test/unit/class-pass-ledger.test.js |
| 5 | Modifier table: every FLEE_RACE_MOD/FLEE_CLASS_MOD key's numeric cell equals the content value | test/unit/flee-ledger.test.js |
| 6 | Before/after table: the Human Fighter no-armor row's New need... | test/unit/flee-ledger.test.js |
| 7 | Before/after table: every row's Old %/New % equals Math.round(...) | test/unit/flee-ledger.test.js |

**Evidence this plan is not the cause:**
- `git diff --stat adc941e -- test/unit/class-pass-ledger.test.js test/unit/flee-ledger.test.js docs/FLEE.md docs/CLASS-PASS.md content/flee.js content/index.js tools/class-pass-diff.mjs docs/class-pass/` is EMPTY — this plan touched none of these files.
- Both test files' imports (`tools/class-pass-diff.mjs`, `content/flee.js`/`content/index.js`) never reach `engine/state.js`, `engine/engine.js` or `engine/saveState.js` (the three files this plan edited) — no possible causal path.
- The failure text ("...is not a byte-identical substring of the ledger") matches the project's own documented pre-existing Windows CRLF artifact: `docs/CLASS-PASS.md` is checked out with CRLF line terminators on this machine (`core.autocrlf`) while the doc-guard tests compare against a freshly LF-rendered string. `.planning/STATE.md` already tracks this class of issue as the standing ".gitattributes eol=lf pin" deferred item, and `test/parity/FIXTURE-INVENTORY.md`'s own Phase 61 Plan 01 section independently documents the same CRLF mismatch tripping two other pre-existing, unrelated tests on this machine.

**Disposition:** left untouched, per the executor's scope boundary. `npm test`
for this plan's own verification is judged against the 4198/4205 pass count
(4197 baseline + 8 new acts-counter tests, minus these 7 pre-existing
failures which were never part of the 4197 baseline's green set on this
machine) — see 65-01-SUMMARY.md.
