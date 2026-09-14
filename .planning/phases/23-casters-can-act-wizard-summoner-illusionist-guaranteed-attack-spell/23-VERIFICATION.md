---
phase: 23-casters-can-act-wizard-summoner-illusionist-guaranteed-attack-spell
verified: 2026-09-14T19:30:00Z
status: passed
score: 5/5 requirements verified
behavior_unverified: 0
overrides_applied: 0
human_verification: []
gaps: []
---

# Phase 23 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-14)

Goal-backward check of the phase goal: *no Magic User sub-class can be dealt a character that cannot fight — a Wizard fights with the staff whenever no attack spell is castable, every fresh Magic User has a day-one attack spell, a level-1 Summoner can summon, and a level-1 Illusionist has a way to win a fight, not only stall it.*

## Automated evidence (checked by the orchestrator after 23-04)

- `npm test`: **1036/1036** pass (989 at phase start → +3 rng pins, +12 override, +7 guaranteed-attack, +16 casters-can-act, +9 freeze-pays-out). Parity **32/32** via `node --test "test/parity/**/*.test.js"`; `test/parity/prototype-master.js.txt` byte-identical to v1.1 close (`1b4daed`).
- Engine/content/src diff since the Phase 22 pin `5565b22` is exactly: `engine/character.js`, `engine/combat.js`, `engine/derived.js`, `engine/magic.js`, `content/spell-level-overrides.js` (new), `content/index.js`, `content/flavor.js`, `src/browser/eventNarration.js`. `content/spells.js` untouched (32 entries).
- All four plans have SUMMARY.md with no `Self-Check: FAILED`; every task committed atomically; working tree clean.
- FID-06 discipline: the pre-change rng pins (`test/unit/chargen-rng-pin.test.js`, committed BEFORE any engine edit) stayed green and unedited through all four plans. Deliberate divergences are declared, machine-checked records — not blanket regenerations: chargen seeds **15** (Summoner drops Heal — Summon now counts as usable on day one) and **24** (Apprentice gains Freeze) in `action-script.chargen.json`; the magic fixture's `cast-damage` scenario (seed 8, Illusionist casting Freeze, hit: `sp 0→5, gold 50→51, kills 0→1, rations 4→5`) in `action-script.magic.json`. Both stripped scenario/seed-scoped in `comparables.js` (`chargenDivergenceFor`/`stripDeclaredFields`, `stripScenarioDivergence`), asserted prototype===before and engine===after; ledger section "Phase 23 caster divergences" in `FIXTURE-INVENTORY.md`.

## Success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Wizard refuses only while an attack spell is castable right now; the refusal names its reason | Verified | `engine/combat.js#playerStrike` gated on `castableAttackSpells(state)` (charges AND known, level-legal, school-legal attack-kind spell); `strikeRefused` carries `reason:"wizard"` + `spell`; `EVENT_NARRATION` names the spell; `test/unit/casters-can-act.test.js` covers utility-only book, attack spells spent, zero charges (all strike), refusal payload. |
| 2 | Every fresh Magic User has a level-1 day-one attack spell from its own legal schools | Verified | `rollGrimoire` attack top-up over the already-shuffled `spare` list (zero new draws — `spare` predicate frozen, only `ready()` uses `spellLevelFor`); `test/unit/guaranteed-attack-spell.test.js`: all 7 non-Summoner subs ≥1 of Doze/Freeze/Stun/Weaken across ≥200 forced seeds, no duplicates, per-sub draw counts unchanged; Summoner exempt (never gains an offense spell). |
| 3 | Level-1 Summoner can Summon; doubled strength, pending ally, one-in-eight backfire kept | Verified | `content/spell-level-overrides.js` `{ Summoner: { Summon: 1 } }` read by `spellLevelFor` → `canCast`; summon branch in `magic.js` unchanged (lvl+1, 2×d4+2 rounds, backfire); tests assert L1 Summoner casts, other L1 casters still refused (`spellAboveLevel`), canCast diff walk changes exactly 3 of 1,600 cells. |
| 4 | Level-1 Illusionist has an illusion-school way to WIN; d20 strike die until level 3 kept | Verified | Override `{ Illusionist: { "Phantom Host": 1 } }`; Phantom Host at L1 yields an undoubled `lvl = c.level` ally, d4+2 rounds; `strikeDie(Illusionist, L1..2) === 20` asserted unchanged; Mirror Self unchanged; plus the guaranteed attack spell from criterion 2. |
| 5 | Chargen-parity fixtures affected regenerate narrowly with before/after + rationale; untouched fixtures byte-identical; Fighter/Thief rng order unchanged | Verified | Divergence set measured = {15, 24} exactly as predicted; rng-state pins for all fixture seeds identical pre/post; all other fixtures byte-identical; Fighters/Thieves never enter `rollGrimoire`. |

## Requirements

| ID | Status | Evidence |
|---|---|---|
| IDENT-01 | Verified | Criterion 1 (23-01 helpers, 23-03 rule + narration). |
| IDENT-02 | Verified | Criterion 2 (23-02). |
| IDENT-03 | Verified | Criterion 3 (23-01 table, 23-03 tests). Flagged planner assumption discharged by the canCast diff-walk test. |
| IDENT-04 | Verified | Criterion 4 (23-01 table, 23-03 tests). Flagged planner assumption discharged by the Phantom Host / strikeDie tests. |
| FID-06 | Verified | Criterion 5 + the magic `cast-damage` divergence (23-04). |

## User-added rule (2026-09-14): Freeze pays out

A successful Freeze now emits `frozenSolid` and then routes through `killFoe` (experience via `killSpFor`, coin, treasure, kill count, party split). A `lives: 2` creature revives once per canon and is un-frozen on revive. `test/unit/freeze-pays-out.test.js` (9) covers hit/miss/kill-twice/party-split/non-Freeze-thrown. Recorded as a DELIBERATE RULES CHANGE in `engine/magic.js` ("Freeze kills awarded nothing in the prototype — a bug, not a rule"). Petrify/Turn/Gate still bypass `killFoe` — noted for the v1.3 spell audit, deliberately not changed here.

## Smoke readout (signal only — the AFTER matrix is Phase 26)

120-run smoke per sub (6 races × 20 seeds), mean death depth vs BEFORE: Wizard 2.44 vs 2.48; Summoner 2.78 vs 2.18; Illusionist 2.42 vs 2.20. The Summoner moved most (it can now act on day one); the Wizard barely moved, which is expected — its BEFORE runs already had an attack spell most of the time and the staff fallback only matters for the rare bookless roll. Recorded under Outliers/Findings in `docs/CLASS-PASS.md`; not a verdict.

_Verified: 2026-09-14 — orchestrator (Claude), no verifier agent._
