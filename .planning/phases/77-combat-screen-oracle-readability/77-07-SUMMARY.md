---
phase: 77-combat-screen-oracle-readability
plan: 07
subsystem: rules-engine payload + combat narration
status: complete
tags: [CMBUI-13, dazed-honesty, strike-mods, roll-display, measured-zero]
requires:
  - "77-03: conditionsOf / conditionEffectText (the chip half of Dazed honesty)"
  - "77-02: the event-order fold (no new chain added here)"
  - "76-01: darkLimited (the dark cap's one waiver)"
  - "76-06: a fumbled Weaken weakens the reader (c.foeEffect)"
provides:
  - "engine/derived.js: DAZED_TO_HIT_PENALTY and toHitBreakdown(state) -> { need, mods }"
  - "engine/combat.js#playerStrike: condition entries (inspired/dazed/dark/blind) first in strike mods"
  - "foeDebuffed / foeEffectFaded carry toHit for a daze"
  - "onset and fade lines (Oracle + fold) that name -2 to hit and half damage"
  - "test/unit/condition-roll-mods.test.js (17 tests)"
  - "FIXTURE-INVENTORY.md: the Phase 77 heading and the Plan 77-07 measured-zero subsection"
affects:
  - "77-08 (the chip tap sheet reads the same effects; no API change for it)"
  - "Phase 79 narrative pass (the new lines are listed verbatim below)"
tech-stack:
  added: []
  patterns:
    - "narration-only breakdown mirroring a rule function step for step, proven equal by matrix (the foeToHitBreakdown precedent)"
    - "base-recorded strike digests (mods stripped) as the measured-zero proof"
key-files:
  created:
    - test/unit/condition-roll-mods.test.js
  modified:
    - engine/derived.js
    - engine/combat.js
    - engine/foeAbilities.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - test/unit/foe-abilities.test.js
    - test/unit/narrationLinesTable.test.js
    - test/unit/roll-sign-consistency.test.js
    - test/parity/FIXTURE-INVENTORY.md
decisions:
  - "toHitBreakdown lists only the condition steps (inspired, dazed, dark, blind), each itemised as applied in toHit's order; sheet terms (class/race/sub, gear, weapon, the floor) are never listed"
  - "Strike mods order: conditions, then Mirror Self, then Overhead Blow, then afraid"
  - "foeEffectFaded also carries toHit for a daze, so the fade line's number comes from the engine too (the plan named only foeDebuffed)"
  - "The fumbled-Weaken reader line (76-06) now names half damage as well; it keeps 'weakens you' so 76-06's regex pins hold"
  - "Acuteness stays unnamed in mods: it swaps the strike die (d6), not the face count, and the roll line already prints the die"
metrics:
  duration: "~42 min"
  completed: 2026-09-26
  tasks: 3
  files: 10
---

# Phase 77 Plan 07: Condition terms in strike mods, and onset lines that say what the effect does

A dazed strike now shows "dazed −2" in its revealed dice, and so do inspired, the dark cap and hero Blind. Getting dazed tells you "−2 to hit for N rounds", and getting weakened says your blows do half damage. Both fades say the effect ended. It is a payload-only change: every roll, face, draw and state stayed byte-identical to the plan base.

**Plan base SHA:** `e8bd4808afa8efafef6bf628f08f313f521b0576`

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 RED | 3df01a31 | the breakdown matrix, the strike-mods tests and the base-recorded digests |
| 1 GREEN | 478b043a | DAZED_TO_HIT_PENALTY, toHitBreakdown, and the condition entries in playerStrike's mods |
| 2 RED | 6398e142 | the payload, onset/fade and sign-guard tests |
| 2 GREEN | 6e853ab4 | the foeDebuffed/foeEffectFaded toHit field and the reworded lines |
| 3 | 47824b31 | the measured zero in FIXTURE-INVENTORY.md |

## What changed

- **engine/derived.js**
  - `export const DAZED_TO_HIT_PENALTY = 2`. toHit's dazed step reads it, with the same arithmetic.
  - `export function toHitBreakdown(state)` returns `{ need, mods }`. It mirrors toHit step for step, and toHit's own body is untouched and does not delegate. The entry names are:
    - `inspired` (+combat.inspired, before the floor);
    - `dazed` (−2, floor 1, so a floored daze carries the floored delta);
    - `dark` (the cap to 2 faces, when `darkLimited(state) && !c.senses`);
    - `blind` (hero Blind's one-face override).
  - An entry is pushed only when the step changed the value.
- **engine/combat.js**
  - `playerStrike` computes `toHitBreakdown(state).mods` once per strike and builds `mods = [...conditionMods, ...mirrorMods, ...abilityMods, ...afraidMods]`. The faces still come from `toHit(state)`. The frenzy second swing carries the same condition entries.
  - The foeTurn tail's `foeEffectFaded` carries `toHit: -DAZED_TO_HIT_PENALTY` for a daze.
- **engine/foeAbilities.js:** the debuff's `foeDebuffed` carries `toHit: -DAZED_TO_HIT_PENALTY` for a daze. A weakening's payload has no such field.
- **src/browser/eventNarration.js and narrationLines.js:** the foeDebuffed and foeEffectFaded lines are reworded, plus the weakened branch of fumbleOnReader. Both modules import `toHitText` from rollRange.js. No neighbouring entry was reordered or reformatted.

## The new lines, verbatim (for the Phase 79 narrative pass)

| Event | Oracle (EVENT_NARRATION, markup stripped) | Fold / rail (LINE_FOR) |
|---|---|---|
| foeDebuffed dazed (toHit −2, 3 rounds) | The room keeps moving after you stop. Dazed: −2 to hit for 3 rounds. | Djinni: dazed, −2 to hit for 3 rounds. |
| foeDebuffed weakened (2 rounds) | Your arms feel like someone else's. Weakened: your blows do half damage for 2 rounds. | Krupke: weakened, half damage for 2 rounds. |
| foeEffectFaded dazed (toHit −2) | The room settles, and so does your aim. No longer −2 to hit. | The daze lifts: no longer −2 to hit. |
| foeEffectFaded weakened | Your strength comes back. It was only borrowed. Your blows land for full damage again. | Your strength comes back: full damage again. |
| fumbleOnReader weakened (3 rounds) | Weaken weakens you: your blows do half damage, 3 rounds of it. | Weaken weakens you: half damage, 3 rounds. |
| foeDebuffed dazed, old event with no toHit/rounds | The room keeps moving after you stop. Dazed: your aim wanders. | It: dazed. |
| foeEffectFaded dazed, old event with no toHit | The room settles, and so does your aim. You are no longer dazed. | You are no longer dazed. |

The numbers come from the payload through `toHitText` (U+2212). A missing field drops its clause, so the line never reads "?".

**The fumbled-Weaken source (76-06), covered.** A fumbled Weaken puts `c.foeEffect { kind: "weakened" }` on the reader. It pushes `fumbleOnReader { effect: "weakened", rounds }`, not foeDebuffed, so its own line now names half damage too. Its fade is the same foeTurn tick and the same `foeEffectFaded` weakened line ("full damage again").

## Tests

- **test/unit/condition-roll-mods.test.js** (new, 17 tests):
  - the breakdown matrix, covering 3 classes × every race × 3 weapons × inspired × 4 daze cases × 6 darkness cases (lit, a dark tile, darkFor, Night Vision, a lit torch, Sense Presence) × heroBlind × in or out of combat. It checks `need === toHit`, that only condition names appear, and that the mods sum to need − the bare sheet;
  - the itemised order;
  - dazed, floored daze, inspired, dark, blind and light-lifted strikes;
  - the order (conditions, then overhead, then afraid);
  - no condition (absent mods);
  - the frenzy swing;
  - the base-recorded digests;
  - the real Djinni and Krupke payloads;
  - the onset, fade and bare-event lines;
  - the fumbled-Weaken line.
- **roll-sign-consistency.test.js:** a new dazed scenario. A real dazed playerStrike reads exactly `["dazed −2"]` on the Oracle line and on the fight-log reveal, and the Dazed chip effect starts "−2 to hit".
- **foe-abilities.test.js:** the debuff test adds that the daze payload's `toHit === -DAZED_TO_HIT_PENALTY` and that a weakening has no `toHit`.
- **narrationLinesTable.test.js:** locked wordings for foeDebuffed and foeEffectFaded.

**Re-pinned tests: none.** No existing assertion flipped. None of the existing strike-mods deep-equals (feedback-payload, ability-strike, afraid, hero-size and the rest) had a live condition, and they all pass unchanged. The rail corpus `test/unit/fixtures/event-order/default-fold-corpus.json` holds no foeDebuffed, foeEffectFaded or weakened-fumble event, and it stores its input events, so it was **not regenerated**.

## Measured zero

- `node --test "test/parity/**/*.test.js"`: **64/64**.
- `git diff --quiet e8bd4808 -- test/parity/fixtures test/parity/prototype-master.js.txt test/unit/roll-high-state-pins.test.js test/unit/fixtures` exits 0.
- `git hash-object test/parity/prototype-master.js.txt` = `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged).
- roll-high-state-pins, roll-high-guard (the draw inventory) and fixture-inventory.test.js: 25/25. `node tools/fixture-inventory.mjs` gives the same roster and wrote nothing.
- 11 strike scenarios × 8 seeds match the digests recorded at the plan base. Each digest covers the draw count, every event with `mods` and the new `toHit` stripped, and the resulting state.
- **Exposure on the PIN_RUNS labels** (a deterministic scan of the pin runs, not a balance run):
  - 20 of `party-fighter-knight`'s 46 strikes now carry `{ name: "dark", delta: -3 }`.
  - The other labels have no strike with a live condition.
  - No label meets a daze.
  - The hashes are unchanged.
- The record is in FIXTURE-INVENTORY.md under `## Phase 77: combat screen & Oracle readability (CMBUI-07..14) — measured per plan`, as `### Plan 77-07 — …: measured zero`. The heading also notes that Phase 77's other plans are presentation-only.
- `npm test`: **6,999 / 6,999 pass, 0 fail**. That is 6,980 at the base plus 19 new tests.
- Per the 2026-09-26 ruling, no bot or balance runs were made (tune-difficulty, tune-classes and fit-difficulty were not touched) and no readout files were created.

## Condition audit (every hero chip from 77-03's HERO_CONDITIONS)

"Hero strike" is playerStrike's to-hit (toHit plus the per-target terms). "Foe swing" is a foe's roll against the hero (foeToHitBreakdown / foeSwingVsHero).

| Chip | Moves a roll? | Which roll | Named in that roll's mods after this plan? |
|---|---|---|---|
| haste | no (an extra attack, not a modifier) | — | n/a |
| invis | yes | foe swing (set to 1 face) | yes, "invisible" (already) |
| acute (Acuteness) | yes, the die | hero strike on a d6 instead of a d20 | **gap**: it swaps the die, not the face count, so it has no signed delta. The roll line already prints the die (dieN) and range, and the chip's measured lead states it |
| ether | no (walks through walls) | — | n/a |
| enlarge / giant | yes | foe swing (size) | yes, "size" (75.2) |
| glow (Amulet of Light) | yes, it lifts the dark cap | hero strike | honest by absence: no "dark" entry while it holds (pinned via the lit-torch/Night Vision cases) |
| unseen (Anklet) | yes | foe swing (eff foeToHit −2) | named as "gear" (foeToHitBreakdown's gear term), not "Anklet"; out of this plan's scope |
| tongue (Helm) | yes | parley (fluency) | parleyRolled carries `fluency`; it is not a mods list |
| brace (Cloak of Strength) | no (it stops crits landing on you) | — | n/a |
| plate (Cloak of Armor) | sets the soak target (AR 15), not a modifier | armor soak | n/a (armorSoaked names `magic`) |
| power | no (+1 damage) | — | n/a |
| lit (torch) | yes, it lifts the dark cap | hero strike | honest by absence (tested) |
| flight | no | — | n/a |
| ability (Smoke / Sidestep / Battle Roar) | yes | foe swing | yes, "Smoke" / "Sidestep" / "Battle Roar" (already) |
| ability (Riposte / Taunt) | no to-hit term | — | n/a |
| might / strengthBoost | no (damage) | — | n/a |
| ward (Shield) | no (a soak pool) | — | n/a |
| mirror (Mirror Self) | yes | foe swing | yes, "Mirror Self" (already) |
| senses (Sense Presence) | yes, it lifts the dark cap, and it wins initiative outright | hero strike | honest by absence: no "dark" entry (tested) |
| regen, foresight, reveal | no | — | n/a |
| braced, halfNext | no (damage) | — | n/a |
| **inspired** | yes (+1) | hero strike | **yes, "inspired" (new)** |
| nightVision | yes, it lifts the dark cap | hero strike | honest by absence (tested) |
| itemCooldown, staffCharges | no | — | n/a |
| affliction | no roll term in toHit or the foe swing | — | n/a |
| **foeEffect: dazed** | yes (−2, floor 1) | hero strike, including the frenzy swing | **yes, "dazed" (new)**. The onset and fade lines name it too |
| foeEffect: weakened | no (halves your landed damage) | — | n/a. **The onset, fumble and fade lines now say "half damage"** |
| **darkness (darkFor)** | yes (cap to 2 faces) | hero strike | **yes, "dark" (new)** |
| **fightDark** | yes (cap to 2 faces) | hero strike | **yes, "dark" (new)** |
| fearArmed | no (next fight) | — | n/a |
| afraid | yes (−3) | hero strike | yes, "afraid" (already) |
| heroOut | no (lost turns) | — | n/a |
| **heroBlind** | yes (one face) | hero strike | **yes, "blind" (new)** |
| heroShrunk | no (halves your damage) | — | n/a |
| insulted | yes | foe swing | yes, "insulted" (already) |
| selfDot | no (damage per round) | — | n/a |

**Remaining gaps, named:**
1. Acuteness changes the strike die rather than the face count. A signed face delta would misstate it; the die and range are already on every roll line.
2. The Anklet's foe-swing term reads "gear" rather than the item name. That is foeToHitBreakdown's existing label, outside this plan's files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] foeEffectFaded carries the daze's toHit too**
- **Found during:** Task 2.
- **Issue:** The plan's fade line ("no longer −2 to hit") needs a number. The prohibition forbids typing it by hand, but foeEffectFaded carried only `kind`.
- **Fix:** The foeTurn tail adds `toHit: -DAZED_TO_HIT_PENALTY` for a daze. This is payload only, and combat.js is in files_modified.
- **Test impact:** The measured-zero digest strips that field alongside `mods`.
- **Commit:** 6e853ab4

**2. [Orchestrator note] The fumbled-Weaken reader line names half damage**
- 76-06 made a fumbled Weaken put the weakening on the reader, and it pushes fumbleOnReader, not foeDebuffed. Its weakened branch now says "half damage" in both tables.
- It keeps "weakens you", so scroll-fumble-resolve's regex pins pass unchanged.
- **Commit:** 6e853ab4

**3. [Plan reconciliation] Strike mods order includes Mirror Self**
- The plan was written before 75.1 added `mirrorMods` to playerStrike. The shipped order is `[...conditionMods, ...mirrorMods, ...abilityMods, ...afraidMods]`, which is toHit's terms first and then the per-target terms, as before.

**4. [Plan reconciliation] Subsection title**
- The subsection is headed `### Plan 77-07 — …` as the orchestrator asked, not `### Plan 07 — …` as the plan wrote.

No other deviations. `docs/ROLL-LEDGER.md` was not touched, because it is outside this plan's files, so its stale "(now 19–20)" wording is still there for the plan that owns that doc.

## Known Stubs

None.

## TDD Gate Compliance

- Task 1: RED `3df01a31` (the import failed: no DAZED_TO_HIT_PENALTY or toHitBreakdown export), then GREEN `478b043a` (11/11).
- Task 2: RED `6398e142` (8 failing), then GREEN `6e853ab4` (206/206 across the verify set).

## Self-Check: PASSED

- FOUND: test/unit/condition-roll-mods.test.js
- FOUND: .planning/phases/77-combat-screen-oracle-readability/77-07-SUMMARY.md
- FOUND commits: 3df01a31, 478b043a, 6398e142, 6e853ab4, 47824b31
- Acceptance greps:
  - `export const DAZED_TO_HIT_PENALTY` in engine/derived.js: 1.
  - `export function toHitBreakdown` in engine/derived.js: 1.
  - `toHitBreakdown(state` in engine/combat.js: 1.
  - `DAZED_TO_HIT_PENALTY` in engine/foeAbilities.js: 2.
  - `## Phase 77` in FIXTURE-INVENTORY.md: 1.
