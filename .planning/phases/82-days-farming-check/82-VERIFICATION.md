---
phase: 82-days-farming-check
status: passed
verified: 2026-09-28
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 4/4
human_verification: []
---

# Phase 82: DAYS Farming Check — Verification

**Goal:** Know whether a hero who never leaves floor 1 can farm the DAYS board, and settle the DAYS ranking rule before the server is built.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Scripted floor-1 farmer (tools/) runs camp/rest/fight/buy/find-food loops across seeds and classes without descending, touching no engine/content bytes | `tools/lib/days-farm.mjs` (noStairs + hoarder wrap `decideAction`), `tools/days-farm.mjs` CLI; `git diff --name-only f9175525 -- engine content test/parity` empty; default bot readouts byte-identical (`tune-difficulty --seeds=20 --json` cmp, Phase 73 state pins green) | ✓ |
| 2 | DAYS banked by farming measured and recorded beside honest runs | `docs/DAYS-FARMING.md` + `docs/days-farming/days-farm.json`: 200 honest + 800 farmer runs (floor 1 and 2), honest p99 17; floor-1 hoarder p90 73 (32 cap hits); floor-2 noStairs p90 28 (12 cap hits) | ✓ |
| 3 | Verdict recorded (mock ordering or a chosen rule) | Pre-agreed thresholds applied mechanically by `farmVerdict`; branch **perFloorCap** (both floors win). The user can overrule (ledger says so) | ✓ |
| 4 | Verdict stated so Phase 83 can consume it as SRV-03's DAYS key | `## The DAYS rule`: `daysKey = min(day, 10 * floor)` desc, ties `floor` desc; displayed value = true day; applies to SRV-03, BOARD-20, BOARD-26 | ✓ |

## Requirements

- FARM-01 ✓ — measurement tool + ledger (82-01, 82-02)
- FARM-02 ✓ — verdict + DAYS rule recorded (82-02)

## Automated checks

- `npm test`: 7957 passed, 0 failed (2 pre-existing unrelated skips)
- `node --test test/unit/days-farming-ledger.test.js`: 8/8 (ledger tied to stored JSON)
- Engine gate clean (engine/, content/, test/parity/ untouched)

## Human verification

None — dev-only tooling, nothing device-testable.
