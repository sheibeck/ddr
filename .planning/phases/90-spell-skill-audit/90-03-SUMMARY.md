---
phase: 90-spell-skill-audit
plan: 03
subsystem: spells
tags: [strength, spells, spell-effects, timers, derived-rng, narration, chips, save-compat, spell-09]
requires:
  - phase: 90-01
    provides: the Strength audit row and the Q1 A ruling (the reach to build)
  - phase: 88
    provides: the item timed-effect model (c.timers records, effects.js) and endSourceEffects, which this plan leaves alone
provides:
  - "Strength as a 100-square spell:Strength timer record that adds a derived d10 to every damage roll in its ruled reach, grants no hit points and restarts on recast"
  - "the general spell-sourced timed effect: SPELL_ACT_OF, liveItemEffects reading spell: records (source tag), startSpellEffect, spellEffectFaded"
  - "test/unit/strength-spell.test.js (30 pins) and test/unit/spell-effect-records.test.js (11 pins)"
affects: [90-04, 90-07, 90-08, 90-09, 90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a SPELLS row with an `act` record is a spell-sourced timed effect: startSpellEffect starts spell:<n>, liveItemEffects reads it back through SPELL_ACT_OF, so eff / itemEffectActive / critWardOf / conditionsOf need no spell-specific code"
    - "a per-roll bonus drawn from derivedRng(<main cursor>, key) right after the roll's own dice, so the main rng never advances and each roll gets its own die"
key-files:
  created:
    - test/unit/strength-spell.test.js
    - test/unit/spell-effect-records.test.js
    - docs/narrative-pass/why/90-03.json
  modified:
    - content/spells.js
    - engine/derived.js
    - engine/combat.js
    - engine/magic.js
    - engine/items.js
    - engine/movement.js
    - engine/scrollFumble.js
    - engine/saveState.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/rail.js
    - src/browser/heroConditions.js
    - src/browser/foeConditions.js
    - src/browser/gearTab.js
    - mazeworld.html
    - docs/SPELL-AUDIT.md
    - docs/SPELLS.md
    - docs/ROLL-LEDGER.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/harness/comparables.js
key-decisions:
  - "Strength's reach is Q1 A as ruled: each weapon blow (both blows of a double strike, Sweep, Riposte, via weaponDamage), a thrown spell hit, each foe of Lightning, Earthquake's one roll, each Fireballs bolt; never a damage-over-time tick"
  - "Flagged interpretation: Earthquake adds ONE d10 to its one roll (every foe takes it); the caster's own backlash stays the dice alone. The plan reads 'Earthquake's one roll'; the audit row had said 'per foe struck', which is corrected to match"
  - "Flagged interpretation: a critical doubles the whole roll with the Strength d10 in it (the d10 is part of the damage roll)"
  - "c.might is now only the phobia rage's flat d10 (its chip reads 'from your fear'; the Gear tab gets its own Rage row)"
  - "No new serialized field: the record lives on the existing c.timers, already carved out of the hero comparable"
requirements-completed: [SPELL-09]
status: complete
duration: ~one long session
completed: 2026-09-30
---

# Phase 90 Plan 03: Strength is an extra d10 for 100 squares, no hit points (SPELL-09) Summary

**Casting Strength now starts one 100-square `spell:Strength` record that adds its own derived d10 to every damage roll in the ruled reach, grants no hit points, survives camp, ends with one narrated line, and restarts (never stacks) on a recast; the record is the first user of a general spell-sourced timed effect (`act` on a SPELLS row) that the SPELL-10 slate reuses.**

## What was built

- **Content** (`content/spells.js`): Strength's `dmg` is gone; the row carries `act: { kind: "strength", effect: 100, dice: d10 }` and a new `txt` ("for 100 squares, every damage roll you make (each blow, each spell hit) adds an extra d10; casting it again starts the 100 over; no extra HP, sadly"). The header documents `act` as the mark of a spell-sourced timed effect.
- **The mechanism** (`engine/derived.js`, `engine/combat.js`, `engine/items.js`): `SPELL_ACT_OF` (frozen name -> act); `liveItemEffects` also returns live `spell:<name>` records whose name has an act, each entry tagged `source: "spell" | "item"` (so `eff`, `itemEffectActive`, `critWardOf`, `conditionsOf` read them unchanged; `spell:weaken` and `spell:reveal` stay ignored); `startSpellEffect(sheet, sp, events, opts)` is the one starter (`opts.squares` for the school bonus stretch; a live record is overwritten: a restart); `narrateTimerTransitions` pushes `spellEffectFaded { spell, kind, member? }`. Phase 88's `endSourceEffects` walks `item:` ids only and never touches a spell record (pinned).
- **The d10** (`engine/derived.js#strengthRoll`): 0 unless a `strength`-kind effect is live; else `rollDice(derivedRng(<main cursor>, "strength"), act.dice)`, called right after a roll's own dice so each roll has its own die. `weaponDamage` adds it before the Sorcerer's cap and the floor; `weaponDamageRange` widens by 1 to 10; `magic.js` adds it to the thrown hit (so each Lightning foe), Earthquake's one roll and each Fireballs bolt, before Afraid halving and the damage multiplier seam. A damage-over-time tick calls nothing.
- **The cast** (`engine/magic.js`): the might branch starts the record and pushes `strengthCast { squares, restarted }`; no draw, `maxWP` and `wp` untouched.
- **The clock** (`engine/movement.js`): `newDay` no longer touches Strength (camp and a new day leave it); the squares tick deletes it on the 100th square (a 2-square water step with 1 left included) and the transition becomes `spellEffectFaded`. `c.might = 0` stays as the phobia rage's only.
- **Fumble and load** (`engine/scrollFumble.js`, `engine/saveState.js`): a fumbled Strength gives the foe a flat `f.might` d10 for the fight and no hit points (event carries `might`, no `gained`). A tolerant-load step (`retireStrengthBoost`, hero and every foe of a resumed fight, in `validateSave` and `rehydrate`) subtracts the retired doubled-hit-point field from `maxWP` (never below 1), clamps `wp`, and drops it; a save without it is byte-identical.
- **Surfaces**: Oracle and rail `strengthCast` (the d10, 100 squares, no extra HP; a recast reads as starting over), new `spellEffectFaded` lines and rail family, `fumbleOnFoe`'s might text without a hit-point clause; the `strength` hero chip (squares left, "from a spell") replaces Bolstered, the `might` chip is the Strength potion or the phobia rage ("from your fear"); the foe Strong chip reads `might` alone; the Gear kit Strength row reads the live record and the rage has its own Rage row. `docs/narrative-pass/why/90-03.json` carries 15 rows (every "after" read from `buildCorpus`); `node tools/narrative-review.mjs` 617 -> 628 rows, `--check` in sync.
- **Docs**: `docs/SPELL-AUDIT.md` Strength row (`fixed engine (90-03)`, pinned by `test/unit/strength-spell.test.js`) and the Earthquake note; `docs/SPELLS.md` "Phase 90: Strength (SPELL-09) and spell-sourced timed effects"; `docs/ROLL-LEDGER.md` "Phase 90 plan 03" (an AMOUNT draw on `derivedRng(cursor, "strength")`, never the main rng); `test/parity/FIXTURE-INVENTORY.md` "### Phase 90 plan 03".

## Tests

- New `test/unit/strength-spell.test.js` (30): the row, the cast (record, no hit points, no draw, twice never stacks), restart, camp and new day, the 99-square and 100th-square boundary, recast at 1 left, the 2-square water step, ordering, the blow (d10 added, main draws unchanged; both blows of a double strike keyed independently; a crit doubles the d10 too), the Sorcerer cap after the d10, the hero-sheet range, empty edges (a miss rolls nothing, no weapon, cast outside a fight then fight), the Q1 A reach (Fireball, Lightning per foe, Earthquake, Fireballs per bolt, Afraid halving after the d10, no d10 on an Acid or Ice tick), the three-sources adjacency, the `spell:Strength` / `item:Strength` encoding, the chip, the fumble, and the three load cases.
- New `test/unit/spell-effect-records.test.js` (11): `SPELL_ACT_OF`, `startSpellEffect`, `liveItemEffects` source tags and ignored records, `eff` / `itemEffectActive` / `critWardOf` reading a spell effect (a test-local `eff` borrowed onto Strength's act for the span of one test, since no other row has an `act` yet), the chip, `narrateTimerTransitions` (hero and Joiner), the narration, and `endSourceEffects` leaving spell records alone.
- Existing assertions re-pinned (before -> after): `magic.test.js` "Strength grants +damage and doubles Win Potential once" -> starts a 100-square record, no hit points; `spell-mechanics.test.js` cast-line test (gained / maxWP / "until you make camp") -> `{ squares, restarted }` and the new lines; `scroll-fumble-resolve.test.js` "doubles maxWP/wp once" -> might only, no `gained`; `hp-growth-linear.test.js` the two Strength-doubling tests -> Strength leaves `maxWP` alone and a newDay leaves the record; `honest-gains` / `hp-growth-linear` fixtures lose `strengthBoost: 0`; `serialize-rehydrate.test.js` gains a live-record round trip and a save-and-load; `conditions.test.js` / `hero-conditions.test.js` / `foe-conditions.test.js` / `foeDetails.test.js` (strengthBoost chip and field gone; strength chip; rage source "from your fear"; the retired field on the NOT_A_CONDITION list); `gear-panels.test.js` / `gear-view-models.test.js` (the kit literal and rows); and, found by the full suite and outside the plan's file list, `spell-table.test.js` (Strength's die lives in `act.dice`), `shell-worn-slots.test.js` (`gearTab.js` import line), `status-chit-combat.test.js` (a source-less Strong chip is the rage: "from your fear"), and `spell-audit.test.js` (its Q1 doctored-row probe was Strength's own row, now `fixed engine`; the probe moved to Lightning's Q8 row, same assertion).

## Fixture drift

None. Measured against the plan base 462abc15.

- **Predictor.** A move can only reach a run that casts Strength, holds a live `spell:Strength` record when it damages, reads a newDay `strengthBoost` reversal, or loads a save carrying `strengthBoost`. With no live record `strengthRoll` returns 0 and draws nothing, so everything else is byte-identical. The fair bot never casts the Strength spell (`tuning-bot.mjs` lists `might` among the kinds it never auto-casts; its Strength is the bag potion).
- `node --test "test/parity/**/*.test.js"`: 66 tests, 66 pass. **Zero parity drift** (no parity action script casts Strength; `action-script.magic.json` never uses spell index 2). `test/parity/prototype-master.js.txt` untouched; `comparables.js` gained a comment only (no new serialized field, so no carve-out was needed: the record rides the existing `c.timers`, already stripped from the hero comparable).
- `roll-high-state-pins.test.js`: 0 of 8 labels moved (none re-recorded; `roll-high-baseline.mjs save` not run). `roll-high-save-compat.test.js`: unchanged. `hazard-commit/golden.json`: unchanged. `days-farm.test.js` and every other seed pin: unchanged.
- No fixture, pin or golden was regenerated. The full account is the "### Phase 90 plan 03" section of `test/parity/FIXTURE-INVENTORY.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tests outside the plan's file list moved by the removed chip, the new row shape and the new import**
- **Found during:** Task 3 (the full-suite run)
- **Issue:** `spell-table.test.js`, `shell-worn-slots.test.js`, `status-chit-combat.test.js`, `gear-view-models.test.js` and `spell-audit.test.js` asserted the old Strength shape (a `dmg` die, the old `gearTab.js` import line, "from a spell" for a source-less might chip, the old kit row, and Strength's row as the Q1 ruled-row probe).
- **Fix:** each re-pinned to the new rule (before -> after above). **Commits:** 35cc65c9, c47ad1f9.

**2. [Plan reading] Narration test split across tasks**
- The plan's Task 1 list names `spell-mechanics.test.js`, whose Strength case also asserted the cast line's wording (Task 2's surface). Task 1 re-pinned its engine half (the `strengthCast` payload); the narration assertions landed in Task 2 with the lines they test, so each commit stays green.

**3. [Plan reading] `docs/SPELL-AUDIT.md` and `comparables.js`**
- The project rules ask for the Strength row's verdict and pin to be updated, which the plan's file list did not name; done (`fixed engine (90-03)`). `comparables.js` (in the list) took a comment-only note that `strengthBoost` is retired.

TDD note: Task 1 was committed as one commit (the pins were written after the engine change and run green, then the full set was run against it); there is no separate `test(...)` RED commit.

## Flagged interpretations (for the user's review)

1. **Earthquake adds one d10 to its one roll** (every foe takes it), not one d10 per foe. The engine rolls Earthquake's damage once for every foe; the plan says "Earthquake's one roll"; Q1's "each foe of an area spell" holds either way (each foe takes the bonus). The audit row's "per foe struck" is corrected. The caster's own backlash stays the dice alone, like level squared.
2. **A critical doubles the whole roll, the Strength d10 included**, since the d10 is added to the damage roll before the crit multiplier (pinned).
3. A Joiner has no way to hold a Strength record yet (only the hero casts it), but the d10 reads the sheet it is handed, so a Joiner sheet that holds one (the slate's reuse) gets the bonus on its own blows through `weaponDamage(memberView(...))`.

## Known Stubs

None.

## Threat Flags

None (no new network, auth or file surface; the tolerant-load step only ever lowers a loaded value).

## Human verification (deferred to end of run)

1. Cast Strength: max HP does not change; the chip shows Strength with 100 squares; the hero sheet's damage range grows by 1-10.
2. Hit a foe with Strength live: the damage is visibly higher; make camp and check the chip is still there; walk until it runs out and see the wear-off line.
3. Recast Strength mid-way: the chip goes back to 100, not 200.
4. (Extra, from this plan's flagged calls) Cast Fireball or Lightning with Strength live: the spell hit reads higher than without it, and an Acid tick does not.

## Verification

- `npm test` (full run, after the last file change): 8,771 tests, 8,769 pass, **0 fail**, 2 skipped (base 8,727 / 8,725 / 0 / 2; +44 new). None of the known worktree CRLF doc-ledger failures appeared in this worktree.
- `node tools/narrative-review.mjs --check`: in sync.
- Acceptance greps: `strengthRoll`, `SPELL_ACT_OF`, `startSpellEffect` once each; `spellEffectFaded` in `engine/items.js`, `eventNarration.js`, `narrationLines.js`; no `maxWP +=` outside comments in `engine/magic.js`; no `Bolstered` outside comments in `mazeworld.html`; `### Phase 90 plan 03` once in FIXTURE-INVENTORY; `"strength"` in ROLL-LEDGER; `SPELL-09` in SPELLS.md.
- `git diff` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them).

## Commits

- 5e2554cb: feat(90-03): Strength is an extra d10 on every damage roll for 100 squares, no hit points; spell-sourced timed effects
- 35cc65c9: feat(90-03): Strength's cast, fade, chip, Gear row and fumble lines say what the spell does
- c47ad1f9: test(90-03): measure and declare the Strength drift (none); ledgers and audit row state the new rule

## Self-Check: PASSED

Created and present: `test/unit/strength-spell.test.js`, `test/unit/spell-effect-records.test.js`, `docs/narrative-pass/why/90-03.json`, this file; commits 5e2554cb, 35cc65c9, c47ad1f9 exist; full suite fail 0.
