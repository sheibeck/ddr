---
phase: 90-spell-skill-audit
plan: 07
subsystem: spells
tags: [open-lock, fly, enchant-character, speed-of-sound, special-school, timed-spells, school-stretch, scrolls, fumbles, narration, chips, fixtures, spell-10]
requires:
  - phase: 90-03
    provides: the spell-sourced timed effect (SPELL_ACT_OF, startSpellEffect, spellEffectFaded, liveItemEffects reading spell: records)
  - phase: 90-06
    provides: the school gates (canCast, schoolClosed, MU_CHART), the school-gates.test.js guard that iterates SPELLS, and the derived roll path for appended rows
provides:
  - "Open/Lock (L1), Fly (L2), Enchant Character (L4), Speed of Sound (L5) appended after Death (SPELLS is 35 rows): kind timed, act record, stretch squares, roll derived, castable anywhere"
  - "derived.js#SCHOOL_STRETCH_SQUARES (10, Q6 A), spellEffectSquares(sub, sp), spellEffectRounds(sub, sp, base) (for 90-08); timed is a self kind, never resisted"
  - "magic.js timed branch -> spellEffectStarted { spell, kind, squares, restarted }; a recast overwrites the record in place"
  - "combat.js#resolveInitiative reads a first payload (why speed); encounters.js#openChest spends a live Open/Lock before any lock roll (chestOpened reason openLock)"
  - "scroll fumble rows for the four and the new helpful effect frenzy; the four join the scroll pool at their level (17, 25, 31, 35 rows at depths 1 to 4+)"
  - "Oracle and rail narration, chips (Open/Lock, Enchanted; Fly and Speed of Sound ride Flying and Hasted), the utility Grimoire niche, ledger 90-07.json"
  - "the measured, declared fixture record for the longer scroll pool and the spliced Special rows"
affects: [90-08, 90-09, 90-10, 90-11, 90-12, phase-91, phase-92]
tech-stack:
  added: []
  patterns:
    - "a SPELLS row with kind timed and an act record is cast through one branch that starts the stretched spell:<name> record; every effect (flight, haste, to-hit, crit ward, first move, next-chest) is read back through the item-effect vocabulary, so no spell-specific rule sits in movement, combat or the chips"
    - "an effect read added to an existing branch ('first' beside foresight and senses) waives the forced foe-first rules without moving a draw"
key-files:
  created:
    - test/unit/special-timed-spells.test.js
    - docs/narrative-pass/why/90-07.json
  modified:
    - content/spells.js
    - content/scroll-fumbles.js
    - engine/derived.js
    - engine/magic.js
    - engine/combat.js
    - engine/encounters.js
    - engine/scrollFumble.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/heroConditions.js
    - src/browser/conditionEffects.js
    - src/browser/rail.js
    - src/browser/sfx.js
    - mazeworld.html
    - test/unit/spell-table.test.js
    - test/unit/content-tables.test.js
    - test/unit/scroll-fumble-table.test.js
    - test/unit/scroll-fumble-resolve.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/grimoireViewModel.test.js
    - test/unit/roll-high-state-pins.test.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.magic.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/SPELLS.md
    - docs/SPELL-AUDIT.md
    - docs/NARRATIVE-PASS.md
    - docs/narrative-pass/review.html
key-decisions:
  - "The four rows are roll: derived, so no chargen main-rng cursor moves; the fixture drift is content (a spliced Special row in a Special-school book) and the longer scroll pool, never a draw count"
  - "Speed of Sound's first payload waives every forced foe-first rule (Samurai, slow race, Knight vs a big foe, Court Mage) as well as the dice, like foresight and senses; foresight and Acute Hearing still name themselves first"
  - "The magic scroll parity scenario was RE-PICKED (19 -> 1295), not given a second action-path divergence record: the divergence-records test allows at most one such record and cast-damage holds it"
  - "Open/Lock cast in a fight is allowed (it only arms the next chest), the draft's default"
requirements-completed: [SPELL-10]
duration: about 3h
completed: 2026-10-01
status: complete
---

# Phase 90 Plan 07: Open/Lock, Fly, Enchant Character, Speed of Sound (SPELL-10) Summary

**Four Special spells that buff and travel, built on 90-03's spell-sourced timed effects: Open/Lock opens your next chest with no lock roll, Fly crosses walls, crevices and water with no roll through both the arrow pad and tap-to-move, Enchant Character is +2 to hit, foes -2 and no crits on you, and Speed of Sound is two blows a swing and the first move in every fight; each window is stretched by +10 squares per school bonus point (Q6 A), gated by the school chart with no extra code, narrated on both surfaces, and carries scroll, fumble and Grimoire rows.**

## What was built

- **Content** (`content/spells.js`, `content/scroll-fumbles.js`): `NICHE_LABELS.utility`; four rows appended after Death, each `s: "special"`, `kind: "timed"`, an `act` record (`unlock` 100, `fly` 30, `enchant` 50 with `{ toHit: 2, foeToHit: -2, critWard: 1 }`, `haste` 50 with `{ first: 1 }`), `stretch: "squares"`, `roll: "derived"`, `combatOnly: false`; each text starts with its niche label and says "+10 squares per school bonus point". Fumble rows: Open/Lock, Fly and Enchant Character `wasted`, Speed of Sound the new helpful effect `frenzy`.
- **The stretch** (`engine/derived.js`): `SCHOOL_STRETCH_SQUARES` is 10; `spellEffectSquares(sub, sp)` adds the chart's school bonus times the step to a `stretch: "squares"` row (Wizard and Apprentice get the base, a Sorcerer or Summoner one step more, an Illusionist four: Fly 70, Open/Lock 140, Enchant Character and Speed of Sound 90; a non-Magic-User scroll cast gets the base); `spellEffectRounds` is the round-timed twin for 90-08; `timed` joined `SPELL_SELF_KINDS` (never resisted).
- **The cast** (`engine/magic.js`): a `timed` branch starts the stretched record through `startSpellEffect` (an overwrite, so a recast restarts it, never stacks and keeps the `c.timers` key order) and pushes `spellEffectStarted { spell, kind, squares, restarted }`. No draw, no combat-only refusal.
- **Open/Lock** (`engine/encounters.js`): right after the Pilfer branch, a live `unlock` effect opens the chest with no lock roll and no lock draw (the first draw is the gold d10), for any class, deletes `spell:Open/Lock` and pushes `chestOpened { reason: "openLock" }`. A Pilfer's free open never spends it.
- **Fly**: needs no engine change; `isFlying`, `moveCost` and the climb/gorge branch already read the `fly` kind. Pinned through `applyAction` with a direction (the arrow pad) and through `tapStep.resolveStep` followed by the same `move` (tap-to-move): flown over, no card, no roll; water costs one square; the Cloak of Flying and the spell are two records and taking the cloak off leaves the spell flying.
- **Enchant Character**: `toHit` +2, `foeToHitVs` -2, `critWardOf` names the spell; a foe's top-face roll is an ordinary hit (the Oracle says the enchantment, not a cloak, did it). **Speed of Sound** (`engine/combat.js#resolveInitiative`): `eff(c, "first") > 0` joins foresight and senses in the unconditional "you go first" branch, waives every forced foe-first rule and sets `why: "speed"`; a Speed potion alongside still gives two blows, not three. A fumbled Speed of Sound sets `f.frenzied` (`engine/scrollFumble.js`).
- **Surfaces**: `spellEffectStarted` Oracle line and rail twin per kind (squares named, a recast "starts over ... does not stack"), the four fade clauses, `chestOpened` reason `openLock`, `combatJoined` why `speed`, `fumbleOnFoe` frenzy, `critWarded`'s tail; a rail family (IN EFFECT) and an sfx group; chips for Open/Lock and Enchanted (Fly reads as Flying and Speed of Sound as Hasted, the spell named as the source, with a tap card that also says Speed of Sound wins the first move); the Enchanted chip's tap lead reads the real +2 to hit and the foes' -2 (`conditionEffects.js` what-if drops its own `spell:` record); the Grimoire shows the `utility` label. `docs/narrative-pass/why/90-07.json` has 9 rows (every "after" read from `buildCorpus`).
- **Docs**: `docs/SPELLS.md` (a Phase 90 plan 07 section), `docs/SPELL-AUDIT.md` (the four rows' Pinned-by cells, the scroll pool counts), `docs/USABLE-FEATURES-AUDIT.md` (four rows), `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 07").

## Fixture drift

Predicted from the code, then measured against the plan base 6ac6aa63; every moved entry is declared in `test/parity/FIXTURE-INVENTORY.md` ("### Phase 90 plan 07") and regenerated alone. `test/parity/prototype-master.js.txt` is untouched; `roll-high-baseline.mjs save` was never run; no new serialized field (the records ride `c.timers`, already carved out of every comparable).

**Cause.** The four rows are `roll: "derived"`: `rollGrimoire` splices them in through a derived stream after its main-rng shuffles, so **no chargen cursor moved** (`chargen-rng-pin.test.js` and the zero-draw proof are untouched and pass). What moved is content: a Special-school book (Wizard, Sorcerer, Illusionist, Summoner, Apprentice) can hold a spliced Special row, and a scroll's `rng.pick(options)` is over 17, 25, 31 and 35 rows at depths 1 to 4+ (it was 15, 23, 28 and 31), the same draw landing on another row.

- **Parity (66 of 66 pass).** Chargen: seed 15 (Summoner) `[Stupidity, Stun, Shield, Summon, Freeze]` to `[Stupidity, Stun, Open/Lock, Shield, Summon, Freeze]`; seed 24 (Apprentice) `[.., Weaken, Turn Walking Dead, Petrify, Earthquake, Blind, Freeze]` to `[.., Weaken, Open/Lock, Enchant Character, Petrify, Earthquake, Freeze]`; seeds 7, 8, 19, 29, 35 unchanged. Magic: `cast-damage` (seed 243, a Sorcerer) `chargenDivergence` book `[Acid, Stupidity, Stun, Weaken, Freeze, Fireball]` to `[Fly, Acid, Stupidity, Stun, Freeze, Fireball]` (the cast and the action-path record unchanged); `scroll` RE-PICKED 19 to 1295 (a Dwarven Court Mage whose scroll is copied; seed 19's engine pick became a spell too advanced to copy, free-cast and refused), found by an engine scan of seeds 1-6000 and confirmed against the prototype sandbox, with `chargenDivergence` (28/28/4 to 39/39/6) and `floorFeatureShift` (13 cells) re-measured; the roster row follows. Movement, combat, economy and encounters scenarios unmoved.
- **Pins (re-recorded alone).** `roll-high-state-pins`: 5 of 8 labels (solo-1 353/true/4 to 253/true/3, solo-2 hash only, solo-magicuser-sorcerer 400/false/5 to 150/true/2, party-1 hash only, deep-8 300/false/11 to 109/true/9), traced per bot step against an extracted tree of 6ac6aa63 (first divergence: solo-1 step 25, solo-2 step 35, the other three step 0); `bot-tactics` Sorcerer trio seed 4 to 1 (the campFailed loop); `days-farm` camp-guard seed 380113 to 736468 (the only Magic User start in `seedList(120)` that fires the guard); `guaranteed-attack-spell` `SPECIAL_BOUND` 7 to 8 and seed 15's book; `shell-snapshots/mu.hero.txt` (seed 3's Wizard lists Fly). Unmoved: solo-thief-pilfer, party-fighter-knight, deep-14, `roll-high-save-compat`, `roll-high-guard`, `hazard-commit/golden.json`, the other seven snapshots.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The Enchanted chip's tap lead needed its own what-if**
- **Found during:** Task 2 (the chip walk)
- **Issue:** `conditionEffects.js#itemSourceWhatIf` drops an `item:<source>` record only, so a spell-sourced Enchant Character chip would have read no effect lead (the foe-card and hero-sheet odds, the human verification item 3).
- **Fix:** a `spellSourceWhatIf` and a `WHAT_IF.enchant` entry (file not in the plan's list). Pinned in `special-timed-spells.test.js`. **Commit:** 734f2b6f.

**2. [Rule 3 - Blocking] Files outside the plan's list had to move**
- **Issue:** `src/browser/rail.js` and `sfx.js` (the new event's family and clip group), `critWarded`'s tail (it credited "the cloak" to a spell), and tests that pin the old row count or a moved number: `spell-resist`, `removed-spells-load`, `identity-footer` (the `schoolBonus` reader count), `day-one-damage`, `guaranteed-attack-spell`, `bot-tactics`, `days-farm`, `usable-features-audit`'s doc (`docs/USABLE-FEATURES-AUDIT.md`), `shell-tab-snapshots` (a snapshot).
- **Fix:** each re-pinned to the new rule (before to after in "Fixture drift" and the inventory). **Commits:** fd3c05a5, 734f2b6f, 7bc2a549.

**3. [Plan reading] The magic `scroll` scenario was re-picked, not declared**
- The plan says "a declared divergence record measured live"; `magic-parity`'s record test allows at most one scenario with a `divergence` (cast-damage has it), so the scenario moved to a seed that replays in lockstep, as 90-06 did for three.

TDD note: the tests were written first and run red (a missing export), then the implementation; each task is committed as one commit (tests with code), so there is no separate `test(...)` RED commit.

## Flagged for the user

- **The footer does not state the Special stretch.** `identityFooter.js` still says only thrown offense bonuses; an Illusionist's +4 Special now buys 40 more squares on each of these spells. `identity-footer.test.js`'s reader-count pin was updated and says 91-02 owns whether a footer line states it.
- **`eventNarration.js` now imports `content/spells.js`** (pure data) so `critWarded` can tell a spell ward from a cloak. The alternative (a `spell: true` flag on the engine event at its three push sites) was not taken.
- **Joiner Magic Users never cast these** (`allyCast` casts attack spells only), so a Joiner whose book rolls one holds dead weight; 90-CONTEXT's Joiner caster policy is a later plan's.
- **Chip labels:** Open/Lock reads "Open/Lock" (toned odd, not a fight chip), the enchant chip reads "Enchanted"; say if you would rather have the spell's full name.
- **Open/Lock in a fight** only arms the next chest (the draft's default), it is not refused.

## Known Stubs

None.

## Threat Flags

None. No new network, auth, file-access or schema surface; the four rows read and write only the existing `c.timers`.

## Human verification (deferred to end of run)

1. Cast Open/Lock, then walk onto a chest: it opens with no lock roll and the Oracle says the lock gave up; the chip goes.
2. Cast Fly and cross a wall to climb and a crevice, once with the arrow pad and once by tapping past them: no roll, no climb card, water costs one square; the chip shows Flying with the squares left.
3. Cast Enchant Character and check the hero sheet's to-hit rises by 2 and the foe card's odds against you drop; tap the Enchanted chip and read the lead.
4. Cast Speed of Sound before a fight as a Samurai: you act first (the initiative line says Speed of Sound) and strike twice.
5. As an Illusionist, cast Fly: the chip starts at 70 squares (Open/Lock 140, Enchant Character and Speed of Sound 90).
6. Open the Grimoire as a Wizard or Illusionist: Open/Lock and Fly read "utility", the other two "buff", each text says "+10 squares per school bonus point".

## Verification

- `npm test` (full run, after the last file change): 8,932 tests, 8,930 pass, **0 fail**, 2 skipped (base 8,881 / 8,879 / 0 / 2; +51 new). None of the known worktree CRLF doc-ledger failures appeared in this worktree. `www/index.html` build-artefact tests skip (no `www/`).
- `node --test "test/parity/**/*.test.js"`: 66 of 66. `node tools/narrative-review.mjs --check`: in sync (673 rows). `node tools/voice-inventory.mjs --check-ledgers --plan 90-07 --after`: 0 errors. `node --test test/unit/school-gates.test.js`: passes unchanged with the four rows in `SPELLS`.
- Acceptance greps: `export function spellEffectSquares` once; `"first"` in `engine/combat.js` (2); `"unlock"` in `engine/encounters.js` (1); the last four `SPELLS` rows are Open/Lock, Fly, Enchant Character, Speed of Sound, all special with an `act` and `roll: "derived"`; `### Phase 90 plan 07` once in FIXTURE-INVENTORY; `Speed of Sound` in `docs/SPELLS.md`; `git diff` for `test/parity/prototype-master.js.txt`, `tools/lib/event-variants.mjs` and `docs/narrative-pass/corpus-base.json`: empty. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (the orchestrator owns them).

## Commits

- `fd3c05a5` feat(90-07): Open/Lock, Fly, Enchant Character and Speed of Sound, stretched by the school bonus (Task 1)
- `734f2b6f` feat(90-07): narrate Open/Lock, Fly, Enchant Character and Speed of Sound; chips and Grimoire rows state the rule (Task 2)
- `7bc2a549` test(90-07): measure, declare and regenerate only what the four Special spells moved (Task 3)

## Self-Check: PASSED

Created files exist (`test/unit/special-timed-spells.test.js`, `docs/narrative-pass/why/90-07.json`, this summary) and commits `fd3c05a5`, `734f2b6f` and `7bc2a549` are on the worktree branch; the full suite is fail 0.
