---
phase: 54-four-band-retune-and-roster-decision
verified: 2026-09-22T07:00:00Z
status: passed
score: 5/5 success criteria verified on automated evidence (orchestrator gate at HEAD c496150 — build:www exit 0, npm test 3479/3479); device checks deferred to the Phase 55 batch
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - "Average run (Pixel 7, natural start): a run now dies around floors 6–9, not 3–4; floors 1–3 feel meaningfully safer (a floor-1 death should be rare) — the fitted curve reads S_3 90 / S_5 75 / S_8 44 / S_12 12.5 on 1,000 seeds"
  - "Table-4 HP rows (Pixel 7): landing on +25 HP / -15 HP / +10 HP repeatedly is a flat, predictable swing scaled once by the hero's tankiness — never the runaway 140-hp toll / 330-HP pool seen on the 2026-09-21 identity build"
  - "Per-swing feel (Pixel 7): foes hit softer per swing (FOE_HIT_SCALE 0.6 + 0.01·d) but take slightly longer to kill (FOE_HP_SCALE 0.9); no single hit spikes past the smooth curve"
  - "Floor-arrival regen (Pixel 7): arriving on a fresh floor visibly restores some HP without camping (HERO_REGEN_PER_FLOOR 0.25) and the descend line reads in voice"
  - "Roster under the ceiling (Pixel 7, --start-depth 20 dev run): Herman / Drarl / Vampire / Djinni / Drake never one-shot — every crit is bounded by the round-damage ceiling (≈31–34 hp at the hero levels that meet them)"
  - "One-and-done climbs/leaps (Pixel 7): a failed climb or crevice leap lands you on the far side, hurt, with the new line; a fatal fall still dies in place"
  - "Voice check (Pixel 7): the descend SP bonus line, the Table-4 dot lines and the floorRegen / draggedOver lines read deadpan with no raw-number leakage"
  - "Recorded class spread is the hand you're dealt, not a bug (Pixel 7 / class matrix): Thief Pilfer / Elven MU bottom out early, Human Ninja / Wilmsry Wizard reach deep — the pooled class medians are F 7 / T 8 / MU 7"
gaps: []
---

# Phase 54 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-14 ruling)

Goal-backward check of the phase goal: *`engine/difficulty.js` is reshaped toward the four recorded bands so the average run ends floor 5–7, and the open tier-3/5 roster question is closed with a recorded per-creature decision.*

The phase ran as seven plans across five waves; 54-02 / 54-03 were superseded mid-phase by USER RULING D (the floor-range ladder halted after rung 5 and replaced by the global difficulty model — dungeon-wide dials, foe level from depth, a round-damage ceiling, hero HP/regen helpers, a fair bot and a fit tool). 54-04 (fair bot + readouts + fresh BEFORE), 54-05 (the `DIALS` model at identity, one-and-done climbs), 54-06 (economy / class / accuracy dials + `tools/fit-difficulty.mjs`) and 54-07 (the fit, AFTER, roster, ledger) landed sequentially on master. The fit itself ran under USER RULINGS E (budget 40), F (checkpointed blocks — stop on a failure pattern, adjust, restart; run out the budget only when converging) and G (the Table-4 HP-dot compounding fixed as an engine adjustment, class guardrails loosened, spellPower coordinate dropped, replay bug fixed, restart from the cycle-2 best): cycle 3 reached **PASS at evaluation #13 (score 2.71)**, every floor 1–12 inside its Ruling C band.

## Evidence (orchestrator gate at HEAD `c496150`)

| # | ROADMAP success criterion | Result |
|---|---|---|
| 1 | `docs/DIFFICULTY-RETUNE.md` records the four bands verbatim and the numeric targets (BAND-01) | ✓ `### v1.7 · Phase 54` H3 — the four bands verbatim (54-01), the Ruling C per-floor survival curve as the live target (marked superseding the BAND-01 numbers), the dial table with hook / identity / start / bounds / order / direction (54-04) |
| 2 | `difficultyCurve` reshaped, every dial change cited against a bot readout that moved toward the bands (BAND-02) | ✓ the global model replaces the piecewise curve: foe level `0.9 + 0.29·d`, `FOE_HIT_SCALE 0.6 + 0.01·d`, `FOE_HP_SCALE 0.9`, hero HP ×1.25, regen 0.25/floor, SP 0.28, loot 0.8, everything else canon — every value is the fit's logged evaluation #13 (`fit/fit-log.jsonl`, `fit/best.json`, `fit/fit-log.md`), the ledger's `#### Fit` records every cycle/block/ruling; floor 1 parity-exact; the fitted parity set (incl. the new `floorFeatureShift` record kind across 17 holders and the chargen roll) measured, declared in `FIXTURE-INVENTORY.md` + `divergence-records.test.js`, regenerated |
| 3 | The AFTER readout lands inside the targets or each miss is recorded; change table has one row per constant (BAND-03) | ✓ AFTER solo 200: all floors 1–12 PASS (p50 7, p90 12, reach≥5 80.5 % — BEFORE 4 / 6 / 33 %); 1,000-seed tail: all 12 PASS and floors 13–20 within ~2 pts of the curve (S_15 6.9 vs 7.6, S_20 2.6 vs 3.0), reach-20 1.5 % vs the 3–5 % band recorded in the Miss table as the one soft spot; `--party` and the class smoke (`v17-p54-global-after-smoke.json`) recorded; `#### Change table (BAND-03)` one row per constant before → after |
| 4 | The tier-3/5 roster decision recorded per creature with the forced-20 shape named (TUNE-08) | ✓ `#### Roster under the ceiling (TUNE-08)`: Herman / Drarl / Vampire / Djinni / Drake each **stay — capped by ROUND_DAMAGE_CEILING 0.5** (clamped max 27 / 27 / 34 / 24 / 31 vs ceilings 31–34); Ruling B's Drake dice trim recorded superseded; the depth-20 slice read as p_L; `content/bestiary.js` untouched |
| 5 | No flat-damage nerf used to chase the median; `npm test` and `npm run build:www` green throughout (BAND-02) | ✓ zero bestiary dice edits (`git diff 02f394d -- content/bestiary.js` empty); `tools/damage-curve-audit.mjs` re-keyed to the model, `rule=dice` FLAGGED 0 (Phase 52 had 65); gate at HEAD: build exit 0, 3479/3479 |

Engine gate: `test/parity/prototype-master.js.txt` blob `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `comparables.js` untouched (an attempted helper insertion was caught and reverted before commit — 54-07 SUMMARY Deviations); every mover declared with rationale.

## Known follow-ups (recorded, not gaps)

- reach-20 1.5 % vs the 3–5 % band — 15 runs of 1,000; read again on the Pixel 7 forced-20 run and, if still low, a single `FOE_LEVEL.perDepth` notch is the lever (Miss table).
- ~20 unit-test files now run under `test/unit/harness/identityDials.js` (explicit identity override) because they pin canon mechanics, not fit numbers — the fitted dials are exercised by `test/difficulty/difficulty.test.js`, the parity suite and the readouts.
- Fourteen device-session todos captured 2026-09-21 (`.planning/todos/pending/2026-09-21-*`), several engine-side (wilmst cache, store purchase, gear swap in combat, Summoner grimoire) — sequenced AFTER this phase so the fit's baseline stayed clean.

Device checks are consolidated in the `human_verification` list above and run in Phase 55's single Pixel 7 session, per the deferred-UAT protocol.
