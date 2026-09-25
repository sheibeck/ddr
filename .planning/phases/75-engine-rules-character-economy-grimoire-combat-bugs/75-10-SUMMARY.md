---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 10
subsystem: engine
tags: [magic, healing, summoner, chart-data, parity-fixtures]

# Dependency graph
requires:
  - phase: 75-05-summoner-gate-removal
    provides: "MU_CHART.Summoner carries no gate object — the offense school is open from level 1 (this plan adds the Summoner's other half: a healMul flag on the same row)"
  - phase: 75-06-sense-presence-and-bubble
    provides: "engine/combat.js and engine/derived.js as they stood before this plan's foeTurn/derived.js edits"
  - phase: 75-07-staff-wield-model
    provides: "engine/combat.js as it stood before this plan's foeTurn regeneration-tick edit"
provides:
  - "content/mu-chart.js: MU_CHART.Summoner.healMul: 0.5 — the chart data flag naming the Summoner's healing weakness"
  - "engine/derived.js#healMulFor(sub) and #applyCasterHealMul(sub, amount): the one halving rule, data-driven, no name check"
  - "engine/magic.js castSpell's heal branch and engine/combat.js foeTurn's regeneration tick both wired through applyCasterHealMul, with an additive halved: true payload on healed/regenerated"
  - "test/unit/summoner-heal.test.js: the precision table, ordering, scroll-cast, cap-at-maxWP, unaffected controls, and zero-added-draw guarantee"
  - "test/unit/identity-contract.test.js: the Summoner 'bad' entry re-pinned to the healing weakness (summon backfire kept as an extra assertion)"
  - "docs/SPELLS.md: a 'Summoner (Phase 75, RULES-03)' section naming both Phase 75 changes; the two Phase 40 'offense gate stays 3' lines marked superseded"
affects: [75-13-fixture-inventory-and-retune-ledger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chart data flag, never a name check: MU_CHART.Summoner.healMul is read by one small helper (healMulFor) that every other row implicitly defaults to 1 — mirrors schoolGate/schoolBonus's own existing MU_CHART-read pattern exactly, so a future sub-class weakness/strength of the same shape (a per-sub multiplier on some engine number) has a ready-made template."
    - "Additive halved: true payload, applied only when the amount actually changed — the Phase 25 additive-payload pattern (no new event type for a flag on an existing event), extended to a case where the flag is conditional on whether the multiplier actually did anything (mul === 1 means the amount passes through byte-identical and no key is added)."

key-files:
  created:
    - test/unit/summoner-heal.test.js
    - tools/readouts/75-10-before.txt
    - tools/readouts/75-10-after.txt
  modified:
    - content/mu-chart.js
    - engine/derived.js
    - engine/magic.js
    - engine/combat.js
    - test/unit/identity-contract.test.js
    - docs/SPELLS.md

key-decisions:
  - "The halving applies LAST, after the Cleric's own +3 bonus and a heal2x race's doubling — proven with a real precision table (1,2,3,7,10,30 -> 1,1,1,3,5,15) and the heal2x compound case (a Wilmsry Summoner rolling 5 restores 5: doubled to 10, then halved), exactly as the plan's must-haves specified."
  - "applyCasterHealMul returns the amount completely unchanged (mul === 1 short-circuit) rather than always running Math.floor — guarantees a non-Summoner's heal is byte-identical to before this plan, with zero risk of an unintended floor() changing behavior for a fractional amount that could arise from some other future modifier."
  - "readScroll's free-cast path was NOT special-cased — it already routes through castSpell's heal branch, so a Summoner reading a Heal scroll is halved for free, matching the plan's flagged assumption ('Scroll reads count') as accepted."
  - "drinkPotion and engine/items.js's staff heal effect were left completely untouched, per the plan's explicit prohibition — verified with a direct test that a Summoner's potion restores its full, unhalved amount."
  - "allyCast's exclusion of any heal kind is pinned structurally, not by re-reading combat.js's source text: the test asserts ATTACK_SPELL_KINDS (the one engine-wide set allyCast's callers filter through) does not contain 'heal', so any future change that added a heal-kind attack spell would fail this test rather than silently letting a party member cast (and dodge) the Summoner's own weakness."

requirements-completed: [RULES-03]

coverage:
  - id: D1
    description: "healMulFor(sub) reads MU_CHART.Summoner.healMul (0.5); every other row (and undefined) defaults to 1. applyCasterHealMul(sub, amount) floors amount * mul with a minimum of 1, or returns amount unchanged at mul === 1."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#healMulFor: 0.5 for Summoner, 1 for everyone else including undefined"
        status: pass
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#applyCasterHealMul: the RULES-03 precision table — 1,2,3,7,10,30 -> 1,1,1,3,5,15 for a Summoner"
        status: pass
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#applyCasterHealMul: any other sub-class returns the amount unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Summoner casting Heal/Major Heal (castSpell's heal branch) or reading a Heal scroll restores half, floored, minimum 1, with the halving applied last (after the Cleric bonus and heal2x doubling); the healed event carries the true, halved amount plus halved: true only when it changed. A non-Summoner's heal is byte-identical to before."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/summoner-heal.test.js (castSpell Summoner/Wizard/heal2x/Cleric/cap-at-maxWP cases; readScroll case)"
        status: pass
      - kind: unit
        ref: "test/unit/identity-contract.test.js#Summoner bad: healing spells it casts restore half; the summon backfire stays"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Summoner's Regeneration tick (foeTurn) is halved the same way, with the same additive halved: true payload; a non-Summoner's regen tick is unchanged."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#foeTurn: a Summoner/Wizard with c.regen (d8 -> 7) regains 3/7 with/without halved: true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Potions, staff heals, and heals cast by anyone else on the Summoner are unaffected; allyCast never casts a heal kind at all. No new rng draw — a counting rng proves the draw count is identical to a non-Summoner doing the same thing."
    requirement: RULES-03
    verification:
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#drinkPotion: a Summoner's potion restores its full, unhalved amount"
        status: pass
      - kind: unit
        ref: "test/unit/summoner-heal.test.js#allyCast never casts a heal kind — ATTACK_SPELL_KINDS excludes 'heal'"
        status: pass
      - kind: unit
        ref: "test/unit/summoner-heal.test.js (two zero-added-draw tests, castSpell and foeTurn)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No parity fixture moves; the identity contract and docs/SPELLS.md name both Phase 75 changes; a 200-seed readout is taken before and after."
    requirement: RULES-03
    verification:
      - kind: integration
        ref: 'node --test "test/parity/**/*.test.js" (54/54); git diff --quiet <plan-base> -- test/parity/fixtures test/parity/prototype-master.js.txt exits 0'
        status: pass
      - kind: unit
        ref: "npm test: 6137/6137 green"
        status: pass
      - kind: other
        ref: "tools/readouts/75-10-before.txt, tools/readouts/75-10-after.txt (both committed, non-empty)"
        status: pass
    human_judgment: true
    rationale: "The Pixel 7 human-check (a Summoner casting Heal restores about half what a Cleric's does) is deferred to the milestone-close UAT batch per this project's standing Deferred UAT protocol, not run by this executor."

duration: 95min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 10: Summoner Healing Weakness (RULES-03, second half) Summary

**A Summoner's own healing-school spells now restore half (floor, minimum 1) through one chart-driven helper (`MU_CHART.Summoner.healMul` / `engine/derived.js#applyCasterHealMul`), wired into both heal paths (castSpell's heal branch and foeTurn's regeneration tick) with an additive `halved: true` payload — zero added rng draws, zero fixtures moved.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-25 (worktree base d5bb5f0)
- **Completed:** 2026-09-25
- **Tasks:** 2 completed
- **Files modified:** 6 (4 engine/content, 2 test/docs) + 1 new test file + 2 readouts

## Accomplishments

- **The Summoner's second half of RULES-03 is landed.** With 75-05's offense-gate removal already in place, the Summoner's "bad" is now fully what the user asked for on 2026-09-25: "let's make summoner weakness be that healing spells are only half as effective." `content/mu-chart.js`'s Summoner row carries `healMul: 0.5` alongside its existing offense/protection/divination/special values — a plain chart entry, not a special-cased branch.
- **One halving helper, two consumer sites, zero name checks.** `engine/derived.js#healMulFor(sub)` reads the chart flag (defaulting to 1 for every other row, including `undefined`); `applyCasterHealMul(sub, amount)` applies it — `Math.max(1, Math.floor(amount * mul))`, or the amount completely unchanged at `mul === 1`. Wired into `engine/magic.js`'s `castSpell` heal branch (after the Cleric +3 bonus and a heal2x race's doubling — exactly the RULES-03 ordering the plan specified) and `engine/combat.js`'s `foeTurn` regeneration tick (the d8 draw itself is untouched; only the resulting amount is halved). `grep -v '^\s*//' engine/magic.js engine/combat.js | grep -c "Summoner"` stayed at 2 before and after this plan's edits — the rule genuinely adds no new sub-class name check to either file.
- **The RULES-03 precision table holds exactly.** A Summoner's rolled heal of 1, 2, 3, 7, 10, 30 restores 1, 1, 1, 3, 5, 15 — pinned directly in `test/unit/summoner-heal.test.js`. A heal2x (Wilmsry) Summoner rolling 5 restores 5 (doubled to 10, then halved) — the compound-ordering case the plan called out by name.
- **The Oracle already shows the true amount.** `healed`/`regenerated` events carry the ALREADY-halved `amount`, plus an additive `halved: true` only when the multiplier actually changed anything — a non-Summoner's event carries no `halved` key at all, byte-identical to before this plan.
- **Every unaffected path stays unaffected, proven not assumed.** `drinkPotion` never reads `applyCasterHealMul` — a Summoner's potion restores its full, unhalved amount (tested directly). `allyCast`'s handled kinds are `thrown`/`status`/`stun`/`weaken` — pinned structurally via `ATTACK_SPELL_KINDS.has("heal") === false`, so a future change that ever let a party member cast a heal kind would fail this test rather than silently drift. A `readScroll`-triggered Heal is also halved (the plan's flagged "scroll reads count" assumption, accepted): a Summoner reading a Heal scroll with a rolled 8 restores 4.
- **Zero added rng draws, proven with a counting rng.** Two tests (`castSpell`'s heal branch and `foeTurn`'s regen tick) run an identical roll sequence for a Summoner and a Wizard through a draw-counting fake rng and assert the counts are equal (1 draw each) — the halving rule reads only the already-drawn roll, never adds its own.
- **The identity contract is re-pinned a second time.** 75-05 pinned the Summoner's "bad" to the summon backfire alone (with a comment flagging that 75-10 would re-pin it again). This plan's re-pin states the healing weakness as the primary assertion and keeps the summon backfire as an extra assertion in the same entry, since the user explicitly kept it.
- **docs/SPELLS.md now states both Phase 75 changes together.** A new "Summoner (Phase 75, RULES-03)" section names the removed offense gate (75-05) and the halved healing (75-10) side by side. The two Phase 40 lines that said the offense gate "stays 3" are marked superseded by Phase 75, kept as history rather than rewritten.
- **Zero parity fixtures moved, measured not assumed.** `node --test "test/parity/**/*.test.js"` is 54/54, and `git diff --quiet <plan-base> -- test/parity/fixtures test/parity/prototype-master.js.txt` exits 0 — the only `magic#heal` parity fixture (seed 7) is cast by a Wizard, confirmed live.
- **Before/after 200-seed bot readout committed, no material shift.** Death-depth distribution is identical (min=2 p50=7 p90=13 max=40, both runs). The Magic User class-pool's `casts(def/off)` moves by noise (237/1444 → 235/1442, both readouts having each been driven by the same 200 seeds but one fewer Summoner heal now taken because it's less efficient in a couple of runs); the Poltergeist death-cause count moves by exactly one (9 → 10) — both well within run-to-run seed noise for a 200-seed sample, not a balance regression.
- `npm test`: 6137/6137 green (6122 base + 15 new).

## Task Commits

Each task was committed atomically:

1. **Task 1: The chart flag and one halving rule on both heal paths** - `9eb8ac7` (feat)
2. **Task 2: The identity contract, the docs, fixtures, and the AFTER readout** - `d694845` (test) + `8075887` (docs: before/after readouts)

**Plan metadata:** (this commit, made by the orchestrator after wave close)

## Files Created/Modified

- `content/mu-chart.js` — `MU_CHART.Summoner.healMul: 0.5` added, with a RULES-03 comment
- `engine/derived.js` — new exported `healMulFor(sub)` and `applyCasterHealMul(sub, amount)`
- `engine/magic.js` — `castSpell`'s heal branch applies `applyCasterHealMul` last, additive `halved: true` on `healed`
- `engine/combat.js` — `foeTurn`'s regeneration tick applies the same helper, additive `halved: true` on `regenerated`
- `test/unit/summoner-heal.test.js` — new: 15 tests covering the precision table, ordering, scroll-cast, cap-at-maxWP, unaffected controls (potions/allyCast), and the zero-added-draw guarantee
- `test/unit/identity-contract.test.js` — the Summoner "bad" entry re-pinned to the healing weakness (summon backfire kept as an extra assertion)
- `docs/SPELLS.md` — new "Summoner (Phase 75, RULES-03)" section; the two Phase 40 "offense gate stays 3" lines marked superseded
- `tools/readouts/75-10-before.txt` / `tools/readouts/75-10-after.txt` — the 200-seed bot readouts

## Decisions Made

- The halving is applied via a clean short-circuit (`if (mul === 1) return amount;`) rather than always running the floor arithmetic, so a non-Summoner caster's result is provably byte-identical to the pre-plan code path, not merely numerically equal.
- `readScroll`'s free-cast route into `castSpell` was left as a pure pass-through (no special-casing) — it already halves a Summoner's scroll-cast Heal for free, satisfying the plan's flagged "Scroll reads count" assumption without any extra code.
- The `ATTACK_SPELL_KINDS`-based pin for allyCast was chosen over a text-search of `combat.js`'s allyCast source, so this guarantee survives any future refactor of allyCast's own implementation as long as the shared kind-set contract holds.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; every behavior in the plan's `<behavior>` block was implemented and tested on the first pass.

## Issues Encountered

None of note. The AFTER readout ran noticeably slower than the BEFORE readout (both used the same `--seeds=200` command), likely due to concurrent load from sibling wave-4 executors sharing the machine; it completed successfully with no material change to its own reported numbers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-03 is now fully landed in both halves: the Summoner's offense gate is gone (75-05) and its own healing spells restore half (75-10). The identity contract, docs, and a full parity/readout measurement all agree.
- 75-13 will fold this plan's readout headline into its phase-wide consolidation (not this plan's job) and can reference `test/parity/FIXTURE-INVENTORY.md`'s existing Phase 75 section (no new entry needed here — zero fixtures moved).
- The Pixel 7 human-check item (a Summoner casting Heal restores about half what a Cleric's does) is deferred to the milestone-close UAT batch per this project's standing Deferred UAT protocol.
- Per the orchestrator's own todo note at the plan base commit: heal lines narrate the RAW roll rather than the clamped/halved gain in the current narration layer — this is a known, separately-tracked gap for Phase 79 (VOX-05), not a defect of this plan. This plan's own engine events (`healed`/`regenerated`) already carry the correct, halved `amount` — the gap is purely in a later narration-formatting layer this plan does not touch.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: content/mu-chart.js
- FOUND: engine/derived.js
- FOUND: engine/magic.js
- FOUND: engine/combat.js
- FOUND: test/unit/summoner-heal.test.js
- FOUND: test/unit/identity-contract.test.js
- FOUND: docs/SPELLS.md
- FOUND: tools/readouts/75-10-before.txt
- FOUND: tools/readouts/75-10-after.txt
- FOUND commit: 9eb8ac7 (feat: Task 1)
- FOUND commit: d694845 (test: Task 2 re-pin + docs)
- FOUND commit: 8075887 (docs: before/after readouts)
