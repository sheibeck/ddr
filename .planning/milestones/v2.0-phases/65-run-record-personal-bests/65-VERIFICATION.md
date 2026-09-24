---
phase: 65-run-record-personal-bests
status: passed
verified: 2026-09-23
verifier: orchestrator (deferred-UAT protocol; gsd-verifier disabled in config)
score: 4/4 requirements
human_verification:
  - "65-03: voice read-through of the BOARD_COPY rule lines and the new-best / first-death quip banks (user taste call)"
  - "65-04: install over an existing install that has graves — boots, Dead tab lists stones, no crash (bests backfill)"
  - "65-04: die twice — Dead tab count rises, app restarts cleanly"
  - "65-04: with app storage cleared in Android settings, a first death works without error"
  - "65-05: fresh install, first death — gold block with one first-death line"
  - "65-05: a later death deeper than any before — NEW PERSONAL BEST with DEEPEST DESCENT and DEEPEST, FEWEST STEPS rows plus one quip, above REVIEW THE ORACLE / BURY THEM without pushing the buttons off-screen at the largest text scale"
  - "65-05: a shallower death shows no block"
  - "65-05: REVIEW THE ORACLE then back — same block, same quip"
  - "65-05: BURY THEM, new run, early death — no stale block"
  - "65-05: the rail never appears over the death panel"
---

# Phase 65: Run Record & Personal Bests — Verification

**Verdict:** passed on automated evidence. The device checks above are deferred to the milestone's batched Pixel 7 checklist (Phase 69, `docs/UAT-v2.0.md`) per the deferred-UAT protocol.

## Requirement coverage

| Req | Evidence | Status |
|-----|----------|--------|
| RUN-01 | `buildRunSummary` carries `season` (`content/season.js` `SEASON = 1`), `seed`, `acts`, `hash` (FNV-1a, `engine/records.js#runHash`); `state.acts` counts validated actions (65-01, 65-04); `test/unit/run-summary.test.js`, `acts-counter.test.js`, hash invariant tests; parity 46/46, `acts` carved out of all six comparables, master hash unchanged | ✓ |
| RUN-02 | `ddr.bests.v1` via `mzStorage`: top ten per ranked board + LINEAGE aggregates, deduped by hash, season-tagged, all-time; graveyard cap 5 → 60 (65-02, 65-04); `records.test.js` (45), `bests-adapter.test.js` | ✓ |
| RUN-03 | backfill from stored stones as season 0; `ddr.best.v1` retired (left on disk); total key unchanged; old saves load `acts` as 0 (65-01, 65-04); adapter + new-run-loop tests | ✓ |
| RUN-04 | NEW PERSONAL BEST block inside THAT IS THAT via `takeDeathRecord()` → `newBestView()` → `__mzDeathRecord` → `renderNewBestBlock`; strict-beat rule, first-death line, no toasts, rail stays hidden (65-03, 65-05); `newBest.test.js` (13), `shell-new-best.test.js` (11) | ✓ (device look deferred) |

## Automated gates

- Full `npm test` on master after the final merge (3b60575): **4297/4297 pass**, 0 fail.
- Post-merge gates after each wave: wave 1 4263/4263, wave 2 4286/4286, wave 3 4297/4297.
- Engine gate: `test/parity/prototype-master.js.txt` untouched; no fixture regenerated; `acts` declared as a measured-zero entry in `test/parity/FIXTURE-INVENTORY.md`.
- Decision coverage 14/14 (plan-time gate); requirements 4/4.

## Notes

- Worktree-only artifact: executors saw 7 doc-ledger test failures (CRLF checkout of `docs/CLASS-PASS.md` / `docs/FLEE.md` under `core.autocrlf=true`, no `.gitattributes` pin). They pass on master; logged in `deferred-items.md`. The standing `.gitattributes eol=lf` follow-up would remove it.
- 65-04 was interrupted once by an expired login and resumed in the same worktree with no lost work.
