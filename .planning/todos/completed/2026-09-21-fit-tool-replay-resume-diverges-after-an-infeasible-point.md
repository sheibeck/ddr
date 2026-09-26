---
created: 2026-09-21T21:32:00.000Z
title: Fit tool replay-resume diverges after an infeasible point; stdout truncated per block
area: tooling
resolves_phase: 80
files:
  - tools/fit-difficulty.mjs:340-355 (evaluate — replay reuses a logged row only if the nth candidate's dials match; the logged row is read back with `score: null` where the live run had `+Infinity`)
  - tools/lib/fit-score.mjs:268-282 (applyStep) and tools/fit-difficulty.mjs:188-215 (runSearch — the walk's next step depends on the previous row's score/feasibility)
  - .planning/phases/54-four-band-retune-and-roster-decision/fit/fit-log-block1.jsonl (observed 2026-09-21: block 2 matched n=1..4, then re-evaluated from #5 with a different walk)
---

## Problem

Observed during 54-07 (2026-09-21 21:15): the block-2 resume (`--budget=20`, same `--start`, same `--log`) reused block 1's rows n=1..4 and then started re-evaluating from #5 with different candidates. Block 1's #4 was infeasible (`score=+Infinity`); JSON serialises that as `null`, so on replay `runSearch` sees a `null` score where the live run saw `+Infinity` and takes a different next step — the deterministic-replay contract (`the SAME walk produces the SAME nth candidate`) breaks at the first rejected point. Each divergence costs 6–10 min of bot time per re-evaluated candidate and silently changes the search path between blocks (the USER RULING F checkpoint protocol assumes blocks continue one walk).

Also: the executor's per-block stdout redirect used `>` and truncated `search-stdout-block1.txt` (the JSONL log is complete, so no evidence lost — but the per-block `#n` lines are).

## Solution

Make the replay comparison independent of the score's JSON form: store `score` as a string sentinel (`"Infinity"`) or a separate `feasible: false` flag and rehydrate `+Infinity` in `readLog` before `runSearch` consumes a reused row; add a unit test that a search resumed from a log containing an infeasible row reproduces the original walk exactly (`fit-score.test.js`). Document `>>` for stdout in the tool header. Tooling quick task; no engine change. Note in 54-07's ledger `#### Fit` that block 2's walk diverged from block 1's at #5 for this reason.

## Resolution (Phase 80, TOOL-01)

The replay/resume fix landed during 54-07 itself, the same day this todo was filed: commit `6b48281` added `rehydrateRow` and `readLog` to `tools/lib/fit-resume.mjs` (the file the replay/resume machinery moved into after this todo's line numbers were written), with a search-level regression test in `test/unit/fit-resume.test.js` proving a resumed walk primed with an infeasible logged row reproduces the original, unresumed walk exactly.

Phase 80 (2026-09-26) closed the remaining gap — proof through the REAL CLI, not just the pure library — and made per-block stdout append-only by construction:

- `test/difficulty/fit-difficulty-cli.test.js` spawns the actual `tools/fit-difficulty.mjs` subprocess (real argument parsing, real worker threads, the real engine, real file I/O) for a live search and a two-block resumed search against the same JSONL log, and asserts they retrace the identical walk row for row, including through a forced-infeasible n=2 (using the new test-only `--force-infeasible` seam — no cheap search's class pools are ever large enough to produce a genuinely infeasible candidate on their own).
- `tools/lib/fit-resume.mjs#appendTranscript` plus `tools/fit-difficulty.mjs --transcript=<path>` give the tool itself ownership of the per-block stdout record, so a later block's shell redirect can never truncate an earlier block's lines. The CLI test proves the resumed transcript stays byte-prefixed across blocks and its `#n` row lines match the live transcript's exactly.

The file references in this todo's frontmatter predate the file split noted above — the replay/resume logic now lives in `tools/lib/fit-resume.mjs`, not at the `tools/fit-difficulty.mjs`/`tools/lib/fit-score.mjs` line numbers this todo originally cited.
