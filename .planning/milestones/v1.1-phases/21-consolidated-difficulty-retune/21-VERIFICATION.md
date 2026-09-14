---
phase: 21-consolidated-difficulty-retune
verified: 2026-09-14T20:00:00Z
status: passed
score: 3/4 requirements verified (TUNE-04 deferred by user decision)
behavior_unverified: 0
overrides_applied: 1
human_verification: []
gaps: []
---

# Phase 21 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-14)

## Automated evidence (checked by the orchestrator after 21-05)

- `npm test`: **951/951** pass; parity suite **30/30** byte-identical; `test/parity/prototype-master.js.txt`, fixture JSON, `test/determinism/foe-abilities.test.js`, `test/unit/foe-turn-draw-count.test.js` unchanged since `04eb229`.
- All five plans have SUMMARY.md with no Self-Check failures; every task committed.
- Debug APK built from the final engine (`22a9432`) and installed on the Pixel 7 (2026-09-14 13:02).

## Requirements

| ID | Status | Evidence |
|---|---|---|
| TUNE-01 | Verified | `engine/difficulty.js` owns `foeCap/foeBonus/foeLvlBias/foePower/abilityThreat`; `startCombat` / `foeTurn` / `foeAbilities` read only the curve; `test/unit/combat-scaling.test.js` (15) incl. depth 1–5 identity pins and depth-30 draw-shape equality (21-02, 21-04). |
| TUNE-02 | Verified | `tools/lib/tuning-bot.mjs` shared by both tools: cast/drink/camp/descend, caster back-off, ability tallies, reach table, `--party`; `test/unit/tuning-bot.test.js` (11) (21-01). |
| TUNE-03 | Verified (as executed) | ONE retune, two iterations, ledger `docs/DIFFICULTY-RETUNE.md` with BEFORE/AFTER/comparison; 3 of 4 harness targets missed because the bot dies on floors 1–5 — recorded honestly (21-04). |
| TUNE-04 | **Deferred (user override)** | DR run 1 at depth 20: "way overtuned — instant death on any combat" → verdict **tune-again**. User directive 2026-09-14: do not retune now; the retune moves to a later milestone after cleanup + class fixes/updates. Recorded in the ledger's Verdict block, REQUIREMENTS.md, and STATE.md. |

## Override

`overrides_applied: 1` — TUNE-04's human sign-off is not passed; the phase is closed on the user's explicit instruction so the milestone can complete, with the retune carried forward as a tracked deferral (see STATE.md Blockers/Concerns and `docs/DIFFICULTY-RETUNE.md` → Verdict).

_Verified: 2026-09-14 — orchestrator (Claude), no verifier agent._
