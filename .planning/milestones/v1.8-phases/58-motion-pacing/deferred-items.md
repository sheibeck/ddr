# Deferred items — Phase 58

## RESOLVED (orchestrator, 2026-09-22): 16 `npm test` failures seen only in fresh worktrees

Both wave-1 executors (58-01 and 58-02, each running in its own `isolation="worktree"` checkout) reported the same 16 failures, all in files neither plan touched:

- `test/parity/divergence-records.test.js` (HEDGE-03, INIT-01 and the Phase 26 / v1.5 rendered-block checks)
- `test/unit/class-pass-ledger.test.js`
- `test/unit/flee-ledger.test.js` (the modifier and before/after tables)
- `test/unit/shell-tab-snapshots.test.js` (7 Thief / Magic User tab snapshots)

**Root cause (58-01's diagnosis, confirmed by the orchestrator):** `core.autocrlf=true`, with no `.gitattributes` LF pin for these fixtures and docs. A **fresh** worktree checkout writes them with CRLF, and tests that split on `"\n"` and anchor with `(.*)$` or compare byte-for-byte then fail on the stray `\r`. The main checkout has them as LF in both the index and the working tree (`git ls-files --eol` → `i/lf w/lf`), so master is unaffected: `npm test` was 3633/3633 there before the wave, and the merged result is re-verified on master.

58-02 reported reverting `sfx.js` and seeing the same failures persist. That is consistent: the failures come from the worktree, not the code.

**Disposition:** not a code defect, and no fixture changed. Future worktree executors are told to expect exactly this set and to gate on it. A `.gitattributes` `eol=lf` pin for the affected fixtures would remove the artifact. It is left as a follow-up rather than done mid-phase, because re-normalising the checkout touches `test/parity/` paths the milestone's presentation gate asks to leave alone.
