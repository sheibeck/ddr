---
phase: 89-item-audit-fixes
plan: 08
subsystem: items
tags: [items, staves, resist, depth, cures, joiner-repair, store, ruling-q1, ruling-q4, ruling-q5, ruling-q6, fixtures]
requires:
  - phase: 89-01
    provides: the audit table and the user's Q1 to Q6 rulings
  - phase: 89-04
    provides: a Joiner's armour wears and breaks (the repair it now needs)
  - phase: 89-07
    provides: the Company panel that shows the Joiner's armour (no change needed under Q4 A)
provides:
  - "engine/derived.js#risingResistFaces and #foeRisingResistCheck: THE shared depth-rising resist (Phase 90 reuses it for spells)"
  - "engine/combat.js#foeResistsEffect: the gate every item and staff effect a foe can resist rolls; freezeFoe and roomWeakenResists moved onto it"
  - "engine/items.js: the floor-12 limits gone from stone, gas, freeze, weaken; the Walnut Staff's full Weaken; Cure Poison / Cure Disease by kind (CURE_KIND_OF)"
  - "engine/economy.js: a Joiner repair store line per hurt Joiner armour (memberArmourToMend, memberRepairRefusal, repairArmor with a member param)"
  - "test/unit/item-audit-fixes.test.js: 34 pins, one per 89-08 row or ruling, and a guard that parses docs/ITEM-AUDIT.md"
affects: [89-09, 89-10, phase-90, phase-92-bot-pass]
tech-stack:
  added: []
  patterns:
    - "one derived stream key (spellResist) shared by the half-intel resist and the depth-rising resist, so at or below floor 12 the two are byte-identical"
    - "a refusal reason reused on an existing event (buyFailed) instead of a new event type"
key-files:
  created:
    - test/unit/item-audit-fixes.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/items.js
    - engine/economy.js
    - engine/magic.js
    - src/browser/storeScreen.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - docs/ROLL-LEDGER.md
    - docs/USABLE-FEATURES-AUDIT.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/control-spells-depth.test.js
    - test/unit/control-at-depth.test.js
    - test/unit/control-at-depth-rules.test.js
    - test/unit/freeze-rule.test.js
    - test/unit/usable-features-audit.test.js
key-decisions:
  - "Q1: ONE roll, not two. The foe's winning faces fold its old two chances (half-intel faces a, floor faces c) into one d20, round(a + c - a*c/20), cap 19, so the odds of landing an effect on a deep floor are the odds the game already had; what goes is the floor-12 special effects (hold, three-round cap, second roll)"
  - "Q1 scope: every item effect a foe can resist (stone, gas, freeze, weaken, Pine Staff fire) plus the two combat.js tails items share with spells (freezeFoe, roomWeakenResists), so the hero's and a Joiner's Freeze and Weaken moved too"
  - "Q5: the recorded ruling (refused and kept) wins over the plan text (spent and says so)"
  - "Q6 B: the Walnut Staff lasts the whole fight (what the option the user was shown read), sets foeToHitPenalty 3, draws nothing new, and ends a running Weaken spell timer so it cannot clear the staff's"
  - "Q4 A: the repair line is a stock line on the existing repairArmor effect with { member, name } params; a gone Joiner refuses through buyFailed before any wilmst moves"
patterns-established:
  - "foeResistsEffect beside foeResistsSpell: same stream key, same always-narrated event, plus an additive depthFaces"
requirements-completed: [ITEM-01, ITEM-06]
status: complete
duration: ~3h
completed: 2026-09-30
---

# Phase 89 Plan 08: The audit's engine fixes and rulings Summary

**Every item effect a foe can resist now rolls ONE depth-rising resist (`derived.js#risingResistFaces`, gate `combat.js#foeResistsEffect`) with no floor-12 hold, cap or extra resist; Cure Poison and Cure Disease cure only their own kind; each store repairs a hurt Joiner's armour; the Walnut Staff casts the full Weaken. Each row is pinned by a test named after it.**

## The shared depth-rising resist (for Phase 90)

- **Helper names.** `engine/derived.js#risingResistFaces(depth, intel)` (the faces), `#foeRisingResistCheck(state, rng, source, idx, intel, caster)` (the derived-stream roll, returns `resistRoll`'s shape plus `depthFaces`), `#RISING_RESIST_CEILING` (19). The gate is `engine/combat.js#foeResistsEffect(state, foe, source, rng, events, by, extra)`, the twin of `foeResistsSpell`. All exported.
- **The curve.** `a = resistFaces(intel)` (half-intel faces), `c = controlResistFacesFor(depth)` (none at or below floor 12, +1 a floor, dial cap 15). Faces = `min(19, round(a + c - a*c/20))`. That is the odds the old two rolls gave (a resist, then the control resist), folded into one d20; at or below floor 12 it is exactly `resistFaces(intel)`. Floor 20, intel 10: 11 faces (55%); floor 27, intel 10: 16; it never makes an effect easier to land as you go deeper. (90-04's plan text proposes the plain sum `a + c`; that would make a deep foe resist more often than today, so this plan kept the old odds. Phase 90 should use the same helper.)
- **One stream.** The roll is on the `spellResist` derived stream with the key `foeSpellResistCheck` uses, so the half-intel check and the rising check give the same die for the same key. The main rng never moves.
- **Event.** `spellResisted` / `resistFailed` gain the additive `depthFaces` (only when above 0); the Oracle roll detail reads `(intel 1, depth +8)`.
- **Shared tails moved.** `combat.js#freezeFoe` (Birch Staff, the hero's and a Joiner's Freeze) and `#roomWeakenResists` (Walnut Staff, the hero's and a Joiner's Weaken) now roll the one resist and have no `resistControl`. **Signature change:** `roomWeakenResists(state, spell, rng, events, by)` (the `aimed` argument is gone; its three callers in combat.js, magic.js, items.js were updated).
- **Remaining RULES-18 callers (Phase 90 territory, untouched):** `engine/combat.js`: `sing` (two `resistControl`, one `controlCapRounds`), `allyCast` (the Joiner's Doze/Stun sleep), `foeTurn`'s Ice dot payoff (`resistControl` + `controlHoldRoundsFor`), `holdFoe`'s default `controlHoldRoundsFor`. `engine/magic.js`: stun, stupid (resist + hold), blind (resist + hold), shrink, vapor, insane, status (Doze), petrify (resist + hold), a thrown sleep. The spell menu's resist hint and the foe card still read `resistFaces(intel)`; they need `risingResistFaces(depth, intel)` when 90-04 moves the spells.

## Built rows (row -> test)

All in `test/unit/item-audit-fixes.test.js` (34 tests: 8 owned rows and ruling systems, the shared-helper pins, narration pins, and the guard). 8 rows or systems are owned by 89-08 in docs/ITEM-AUDIT.md; `grep -c "^test("` prints 34.

| Row (ITEM-AUDIT) | Ruling | Pin (test name starts with) |
|---|---|---|
| Amulet of Stone | Q1 | "Amulet of Stone: a foe that fails its resist is stoned outright at floor 20, no hold and no extra control resist" (floors 1, 12, 13, 20, 30; 4 foes reached) |
| Oak Staff | Q1 | "Oak Staff: a foe that fails its resist is stoned outright at floor 20, only two are reached, no hold" |
| Cedar Staff | Q1 | "Cedar Staff: a foe that fails its resist sleeps the whole fight (99 rounds) at floor 20, and every foe is reached" (also: no main-rng draw) |
| Birch Staff | Q1 | "Birch Staff: the freeze rolls one resist (no extra control resist) and holds for its d4 rounds at floor 20" |
| Walnut Staff | Q1, Q6 B | "Walnut Staff: casts the full Weaken (half damage and foes hit only on their top three faces) for the whole fight, at every depth"; "Walnut Staff: a Weaken spell's own d4+1 timer still running is ended ..." |
| Cure Poison | Q5 A | "Cure Poison: cures a Poison affliction, is spent, and says cured"; "... a Disease is refused (nothingToCure), kept ..."; "... with no affliction at all it is refused and kept" |
| Cure Disease | Q5 A | "Cure Disease: cures a Disease affliction ..."; "... a Poison is refused ..."; "... a permanent phobia is not an affliction ..." |
| Joiner armour repair | Q4 A | "Joiner armour repair: a hurt Joiner's armour gets a store line naming the Joiner, at a tenth of the armour's cost per point" (350 for Leather 8/15), buying mends that Joiner only, hero price modifiers (Dwarven 175, Troll 1050), no line when whole / destroyed / absent / downed, no extra rng, a gone Joiner refuses with no charge, whole refuses, short of gold refuses, the shelf draws the Joiner's own armour, save round trip |
| (shared) | Q1 | "depth-rising resist: ..." (faces, same stream as the half-intel check at or below floor 12, main rng untouched, `depthFaces`, no item keeps `resistControl` / `holdFoe` / `controlHoldRoundsFor` / `controlCapRounds` / `foeResistsSpell` in `useItem`); "Pine Staff: its fire resist is the same depth-rising resist" |
| guard | | "ITEM-AUDIT guard: every row and system docs/ITEM-AUDIT.md assigns to 89-08 has a test named after it" |

## Hand-off to 89-09 (text)

- **Cedar Staff's reach ("3 squares")** is text-only: the engine already reaches every live foe and a fight holds at most three (audit row says so). Not changed here.
- **Item texts now lie about the engine and must be reworded (TEXT-01), in the audit's Q1/Q6 wording:**
  - Amulet of Stone, Oak Staff, Cedar Staff: drop "past floor 12, the stone wears off in three rounds" / "a day is three rounds"; say foes not squares; state the resist ("a foe can resist, and the deeper the floor the likelier it does").
  - Birch Staff: add the same resist sentence (its d4 hold is unchanged).
  - Walnut Staff: "all hits on the weakened do double damage" becomes the real Weaken: every foe does half damage and hits only on a high roll (the top three faces, 18 to 20), for the whole fight, resisted foe by foe. The staff lasts the fight (settled below).
- **Test that 89-09 will trip:** `control-spells-depth.test.js` "texts: every spell and item whose promise changes past the knee names floor kneeDepth and holdRounds" still asserts the three items' `txt` contains "past floor 12" and "three rounds"; 89-09 must drop the item half of that test when it rewords them (the spell half stays until Phase 90).

## Fixture drift (audit fixes)

Full record is in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 89 plan 08"). Predicted: zero parity drift, zero bot pin drift (the pinned runs end on floors 3 to 5, use no staff or amulet past floor 12, never drink a cure, and the Joiner repair line adds a stock line the bot never buys); unit pins that assert the old floor-20 control machinery would move. Measured:

- **Parity: 66 / 66**, zero drift. `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs`, `docs/narrative-pass/corpus-base.json` untouched.
- **Bot state pins: 0 of 8 moved** (`roll-high-state-pins` and `roll-high-save-compat` 13 / 13 unchanged). Nothing re-recorded; `roll-high-baseline.mjs save` never run.
- **Main-rng draws: none added, removed or reordered.** Removed pieces are derived-stream rolls (the second `controlResist` roll) and holds. `DRAW_INVENTORY` unmoved.
- **Unit pins moved (before -> after), each re-pinned to the new rule and declared:**
  - `control-spells-depth.test.js`: Freeze (C1) resisted, Weaken (C14), main-draw parity (Freeze and Weaken rows), scroll of Freeze, Birch (C4), Cedar (C12), Oak / Amulet (C6), Walnut (C16). Before: `controlResisted` + Unmoved mark; stone items held 3 rounds (foe alive); Cedar slept 3; Walnut 3-round timer that faded. After: one `spellResisted` with `depthFaces`; stone kills; Cedar 99; Walnut half damage + `foeToHitPenalty` 3, no timer. Every floor-12 digest row unchanged.
  - `control-at-depth.test.js`: Joiner Freeze (C2) landed and resisted, Joiner Weaken (C15).
  - `freeze-rule.test.js`: the past-the-knee resisted Freeze is one `spellResisted { freeze, depthFaces: 8 }`.
  - `usable-features-audit.test.js`: cure success rows now carry the matching affliction (before: none); 8 new cure refusal rows.
  - `control-at-depth-rules.test.js`: `items.js#useItem` is an audited exemption (X9).
- `docs/ROLL-LEDGER.md`: C1, C2, C4, C6, C12, C14 to C16 marked superseded, X9 row, a Phase 89 plan 08 section. `docs/USABLE-FEATURES-AUDIT.md`: the `nothingToCure` reason and the two cure rows.

## Results

- `npm test` (final full run, after the last source change except one comment-only edit whose four guard files were re-run, 95 / 95): **8,609 tests, 8,607 pass, 0 fail, 2 skipped** (base 8,567 / 8,565 / 0 / 2; +42: 34 in `item-audit-fixes.test.js`, 8 cure refusal rows). No CRLF doc-ledger failures appeared in this worktree run.
- `node --test "test/parity/**/*.test.js"`: 66 / 66. `node tools/narrative-review.mjs` then `--check`: 583 rows, pages in sync (unchanged).
- Acceptance: `grep -c "Phase 89 plan 08"`: `engine/items.js` 8, `engine/economy.js` 5 (content files untouched); `git diff --stat -- test/parity/prototype-master.js.txt` empty; `### Phase 89 plan 08` in FIXTURE-INVENTORY 1.

## Deviations from Plan

### Decisions where the plan and the recorded rulings disagreed

**1. [Ruling wins] Q5: refused and kept, not "spent and says so".** The plan's truth and behavior text said a cure that finds nothing "is still spent and says so"; the audit's recorded Q5 ruling (user, 2026-09-30) says "refused and kept, not spent". Built the ruling.

**2. [Settled] Q6 duration.** The ruling says "the staff's duration follows the spell unless the engine plan settles otherwise". The option the user was shown (Q6 B) read "lasting the fight", and Q1 removes the floor-12 three-round limit. Settled: the whole fight, no timer, no new draw (a d4+1 would have been a new roll). 89-09's text says "for the whole fight".

### Auto-fixed Issues

**3. [Rule 3 - Blocking] Files outside the plan's list.** The shared-tail move (`freezeFoe`, `roomWeakenResists`) and the new `useRefused` reason touched pins the plan did not list: `control-spells-depth.test.js`, `control-at-depth.test.js`, `freeze-rule.test.js`, `control-at-depth-rules.test.js`, `docs/ROLL-LEDGER.md`, `docs/USABLE-FEATURES-AUDIT.md` (its doc-sync test), and `engine/magic.js` (one caller). All declared above. **Commit:** `b4abd6d1`.

**4. [Rule 3] Joiner repair refusal reuses `buyFailed`** (reasons `repairGone`, `nothingToMend`) instead of a new event type, so it stays in the existing refusal classification, rail and coverage lists. Narrated on the Oracle and the rail.

### Plan adjustments (not bugs)

- **No `docs/narrative-pass/why/89-08.json`.** No synthetic corpus event carries the new reason, `depthFaces` or a Joiner repair refusal, so no corpus key changed (583 rows; `docs/NARRATIVE-PASS.md` and `review.html` regenerated byte-identically). Same as 89-04.
- **Content files (`content/treasure-tables.js`, `content/potions.js`, `engine/saveState.js`, `src/browser/heroTab.js`) untouched.** `sanitizeStore` already accepts the `{ member, name }` param; Q4 is A so the Company panel needs no "never repaired" note.
- **TDD order.** The pin file was written before the engine change, but the red run was not recorded separately; engine and pins are one commit, as in 89-05 to 89-07.
- **An edge the ruling implies:** a Weaken spell's own d4+1 timer still running when the Walnut Staff lands is ended (`endEffectEarly`), so its expiry cannot clear the staff's fight-long flags.
- **Known effect, declared:** the Unmoved chip no longer appears for Freeze and Weaken casts past floor 12 (there is no separate control resist to mark it); the resist line in the Oracle carries the rise instead. The other spells keep the chip until Phase 90.

## Known Stubs

None.

## Threat Flags

None. A pure engine rule change, a store line on the existing purchase path and narration text; no new network, auth or file surface. The Joiner repair line interpolates a Joiner's name into the shelf (names come from the fixed content pool, the same trust as the existing `item.n`).

## Human verification (deferred to end of run)

1. Drink Cure Poison while diseased (or carrying nothing): the Oracle says it only cures poison and what you have, the potion is still in the bag. Drink it while poisoned: "Cured of poison." and it is gone. Same for Cure Disease.
2. With a Joiner whose armour is worn and hurt, open a store: a line reads "Repair <Joiner>'s <armour>" with its points and a price a tenth of the armour's cost per point. Buy it: the Hero tab's Company card shows its armour whole and your own armour is unchanged. Dismiss the Joiner from the Hero tab with the store open, then tap the line: it says no charge and nothing is taken.
3. Past floor 12, use the Oak Staff or the Amulet of Stone: stoned foes die outright (no "held" line); the roll detail shows "(intel N, depth +M)".
4. Past floor 12, use the Cedar Staff: a foe that fails its resist stays asleep for the whole fight, not three rounds.
5. Use the Walnut Staff in a fight: the foes' hits are halved and they miss more (they only hit on a high roll), for the whole fight, at any depth.
6. Use the Birch Staff past floor 12: one resist line per foe, then a d4-round freeze, no separate "unmoved" line.

## Self-Check: PASSED

- Files exist: `test/unit/item-audit-fixes.test.js`, `engine/derived.js` (exports `risingResistFaces`, `foeRisingResistCheck`), `engine/combat.js` (exports `foeResistsEffect`), `engine/economy.js` (exports `memberArmourToMend`, `memberRepairRefusal`), this file.
- Commits exist on `worktree-agent-adce5fb595c1edcb9`: `b4abd6d1` (engine, pins, narration, ledgers), `f8af8663` (fixture record).
- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `test/parity/prototype-master.js.txt` untouched.
