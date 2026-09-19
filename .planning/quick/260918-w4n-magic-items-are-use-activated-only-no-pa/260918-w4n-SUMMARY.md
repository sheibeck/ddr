---
phase: quick-260918-w4n
plan: 01
subsystem: rules-engine
tags: [vanilla-js, rules-engine, items, activation-model, timers, worn-slots, staves, tuning-bot, parity-harness]

requires: []
provides:
  - "engine/derived.js#eff(c,key) is timer-only — sums a key ONLY across LIVE item:<name> c.timers records (liveItemEffects); a bagged or worn-but-unused magic item grants nothing"
  - "content/treasure-tables.js: 9 formerly-passive JEWELRY/CLOAKS rows (Ring of Power, Gauntlet of the Giant, Amulet of Light, Anklet of Invisibility, Helm of Knowledge, Bracelet of Flight, Cloak of Regeneration, Cloak of Strength, Cloak of Armor) now carry an act block; ACTIVATION_OF grows 20 -> 29 entries"
  - "the Cloak of Healing is removed from the game outright — CLOAKS is 7 rows, not 8; the three cloak rolls draw rng.d(CLOAKS.length)"
  - "a staff leaves the worn-slot taxonomy entirely — WORN_SLOTS is five keys (ring/bracelet/amulet/helm/cloak), SLOT_OF is 15 entries; a staff lives in c.items (one bag slot) and is used by bag index, Magic User only"
  - "every activatable item shows a Use button wherever activatables are listed (Gear worn row, Gear bag row, combat ITEMS submenu) via the one itemRowState row-state rule"
  - "the tuning bot uses its worn gear (Amulet of Light in the dark, Cloak of Regeneration when hurt, a pre-hazard flight item before a climb/gorge, a round-1 worn buff, a Helm of Knowledge before a blocked parley) and its bagged staff, all keyed on activationFor(it).kind"
affects: [combat, gear-panel, item-activation, tuning-bot, parity-harness, saves]

tech-stack:
  added: []
  patterns:
    - "Timer-only effect model: an item's eff payload lives on content/activations.js#ACTIVATION_OF's act.eff, applied only while its own item:<name> c.timers record is phase:effect — engine/derived.js#eff/itemEffectActive/liveItemEffects are the ONLY readers, replacing the old two-path (worn-sum vs bag-sum) model"
    - "readyWorn(state, ctx, slot, kinds) in tools/lib/tuning-bot.mjs — the one 'worn, ready, matching kind, not itemBlocked' predicate every new bot tactic shares"

key-files:
  created: []
  modified:
    - content/treasure-tables.js
    - engine/derived.js
    - engine/items.js
    - engine/movement.js
    - engine/actions.js
    - engine/saveState.js
    - engine/character.js
    - engine/encounters.js
    - engine/economy.js
    - src/browser/viewModels.js
    - src/browser/combatMenu.js
    - src/browser/eventNarration.js
    - src/browser/toasts.js
    - mazeworld.html
    - tools/lib/tuning-bot.mjs
    - test/parity/harness/comparables.js
    - test/parity/fixtures/action-script.chargen.json
    - test/parity/fixtures/action-script.combat.json
    - test/parity/fixtures/action-script.encounters.json
    - test/parity/fixtures/action-script.movement.json
    - test/parity/FIXTURE-INVENTORY.md
    - docs/GEAR-BALANCE.md
    - docs/GEAR-SLOTS.md
    - docs/TERRAIN.md
    - docs/USABLE-FEATURES-AUDIT.md
    - "~44 test/unit/*.test.js files re-pinned to the timer-only / five-slot model"

key-decisions:
  - "Cloak of Flying's txt is left byte-identical to the frozen prototype (not reworded) — it already carried an act block before this task, so it is not one of the 9 converted rows the plan named; this kept REWORDED_TXT_ITEMS from needing a Cloak-of-Flying entry"
  - "Ring of Power and Gauntlet of the Giant are converted to use-activated (kind power/giant) even though the orchestrator's originally-proposed list did not name them — the user's rule text explicitly said 'ring... amulet, etc', so they are in scope; flagged here per the plan's own instruction"
  - "sanitizeWorn folds a legacy c.worn.staff into c.items and calls clampCarry immediately after, so an over-cap bag drops the appended staff exactly like any other overflow item on load"
  - "Collateral test files not in the plan's file list (armorDisplay.test.js, feedback-payload.test.js, parley.test.js, parley-button-mirror.test.js, rations-audit.test.js, foe-turn-draw-count.test.js, identity-contract.test.js, items.test.js, shell-fight-gate.test.js, shell-gear-toolbar.test.js) were re-pinned because the eff()/CLOAKS rewrite directly changed their measured behavior (a coincidental starting-cloak or bagged-item auto-benefit that no longer applies) — documented individually below"
  - "The Ninja's guaranteed opening-strike formula is now measurably doubled (18 vs the old 9) because seed 1's Thief starting cloak used to coincidentally carry noCrit (blocking the sub's own backstab-forced-crit branch in engine/combat.js) under the old bag-sum eff() — this is a pre-existing combat.js interaction unmasked by the timer-only rewrite, not a bug introduced by this task; engine/combat.js is out of this task's scope and was not touched"
  - "The dead classic parley canParley()/fluency() duplicate in mazeworld.html (confirmed unreachable — the live PARLEY button routes through window.mzParley to the real engine) is left untouched; test/unit/parley-button-mirror.test.js's comparison harness now attaches a live Helm timer to its own synthetic fixtures so the 'would these two scripts agree' proof stays meaningful instead of trivially failing on every helm=true case"

requirements-completed: [QUICK-260918-w4n]

coverage:
  - id: D1
    description: "eff()/isFlying/conditionsOf are timer-only — a bagged or worn-but-unused magic item (any of the 9 converted rows, Cloak of Flying, Bracelet of Flight) grants no effect; only a live item:<name> record (started by useItem on a WORN item) does"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: unit
        ref: "test/unit/item-wiring.test.js (Helm/Cloak of Strength/Amulet of Light/Cloak of Regeneration/Gauntlet worn-vs-used sections), test/unit/worn-model.test.js, test/unit/conditions.test.js, test/unit/movement.test.js (flight sections), test/unit/water-cost.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Cloak of Healing is removed from the game (CLOAKS 7 rows, three rolls draw rng.d(CLOAKS.length), base value/event/eff key gone); an old save carrying one loads it as an inert cloak"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: unit
        ref: "test/unit/item-activation.test.js, test/unit/worn-migration.test.js, test/unit/worn-model.test.js"
        status: pass
      - kind: integration
        ref: "test/parity/chargen-parity.test.js, test/parity/combat-parity.test.js, test/parity/economy-parity.test.js (declared chargenDivergence records, seeds 2/17/160/256)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A staff has no worn slot anywhere (WORN_SLOTS five keys, SLOT_OF 15 entries, slotFor null, equip refused notEquippable, take stows, legacy worn staff folds into the bag on load); a Magic User uses it from the bag by index"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: unit
        ref: "test/unit/worn-slots.test.js, test/unit/worn-migration.test.js, test/unit/gear-panels.test.js, test/unit/combatMenu.test.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every activatable item shows a Use button wherever activatables are listed (Gear worn row, Gear bag row, combat ITEMS submenu); a ready Cloak of Flying is not flying and never self-starts on a climb; a staff never shows Equip"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: unit
        ref: "test/unit/itemRowState.test.js, test/unit/gear-panels.test.js, test/unit/combatMenu.test.js, test/unit/shell-fight-gate.test.js, test/unit/shell-gear-toolbar.test.js"
        status: pass
      - kind: manual_procedural
        ref: "Human verification checklist steps 1-3, 7 below"
        status: unknown
    human_judgment: true
    rationale: "Button visibility/rail-toast wording on a real device screen needs an on-device look, per the deferred-UAT protocol — the source-assertion tests prove the code path but not the rendered result"
  - id: D5
    description: "The tuning bot uses its worn gear and bagged staff under the new rules (dark amulet, hurt Regeneration cloak before a potion, pre-hazard flight, round-1 worn buff, helm-before-parley, bagged staff by index)"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: unit
        ref: "test/unit/bot-tactics.test.js (new 260918-w4n sections), test/unit/tuning-bot.test.js"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=30 --json (30-seed smoke, no throw)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full test gate green with only declared cloak-roll fixture divergences citing 260918-w4n; frozen prototype master hash unchanged; www build succeeds"
    requirement: "QUICK-260918-w4n"
    verification:
      - kind: other
        ref: "npm test (3206/3206, # fail 0); npm run build:www (exit 0); git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0"
        status: pass
    human_judgment: false

duration: extensive (single autonomous session, 2 tasks + gate)
completed: 2026-09-19
status: complete
---

# Quick Task 260918-w4n: Magic Items Are Use-Activated Only — Summary

**Every JEWELRY/CLOAKS row is now use-activated only (timer-gated `eff()`, no auto-activation), the Cloak of Healing is removed from the game, and a staff leaves the worn-slot taxonomy for a bag-index item — 29-entry `ACTIVATION_OF`, five-slot `WORN_SLOTS`, ~44 test files re-pinned, zero undeclared fixture drift.**

## The three user rulings, verbatim

**The governing rule (2026-09-18):**
> "Items that are equipable must be equipped to be used. Items that are not equipable can be used from the bag."

> "Every cloak must have a Use button; it's only active when you use it. Same for every staff, amulet, etc. Nothing works without using it, which triggers its cooldown."

Bug report that triggered the task: "The Cloak of Flying I got is in my bag. I never equipped it. But it still shows me as flying. It also has no Use button."

**The staff amendment (2026-09-18):**
> "A magic staff is a usable item, but not equipable. Staff should not be an equipment slot. It just takes up a bag slot and is usable from the bag."

**The dropped healing cloak (2026-09-18):**
> "Drop Cloak of Healing" — the item leaves the game outright.

## Performance

- **Tasks:** 3 (engine, shell/bot/docs, gate)
- **Files modified:** ~70 (9 engine/content, 5 shell/bot, 4 docs, 4 parity fixtures + inventory, ~44 unit test files)

## The final conversion table

| Item (slot) | act.kind | Use does | effect (sq) | cd (sq) | eff payload while live | Basis |
|---|---|---|---|---|---|---|
| Ring of Power (ring) | power | +1 damage to all attacks | 50 | 50 | `{ dmg: 1 }` | template — **outside the orchestrator's proposed list, but inside the rule as the user stated it** ("ring... amulet, etc") |
| Gauntlet of the Giant (helm) | giant | one size larger (+2 flat damage via the size term) | 50 | 50 | `{ size: 1 }` | template — same flag as the Ring |
| Amulet of Light (amulet) | glow | light + sight; also clears `c.darkFor` at once (`darknessDispelled`) | 50 | 50 | `{ sight: 1, light: 1 }` | template |
| Anklet of Invisibility (bracelet) | unseen | foes need two better to land | 50 | 50 | `{ foeToHit: -2 }` | template |
| Helm of Knowledge (helm) | tongue | perfect fluency (parley gate) | 50 | 50 | `{ tongue: 1 }` | template |
| Bracelet of Flight (bracelet) | fly | flight (climb/gorge/water cost nothing) | 20 | 50 | `{ fly: 1 }` | mirrors the Cloak of Flying |
| Cloak of Regeneration (cloak) | knit | d6 hp back, instantly (one `rng.d(6)` inside `useItem`) | 0 | 20 | — (instant) | the once-per-use faithful reading of "d6 hp back every 20 squares" |
| ~~Cloak of Healing~~ | — | **REMOVED from the game** | — | — | — | CLOAKS 8 → 7; rolls draw `d(CLOAKS.length)`; old saves keep it as an inert cloak |
| Cloak of Strength (cloak) | brace | no critical lands on you | 50 | 50 | `{ noCrit: 1 }` | template |
| Cloak of Armor (cloak) | plate | soak as plate (AR 15), never wears | 50 | 50 | `{ cloakArmor: 1 }` | template |
| Cloak of Flying (cloak) | fly | flight | 20 | 50 | `{ fly: 1 }` | existing act; auto-start removed, Use button added; **txt left byte-identical to the frozen prototype** — not one of the 9 reworded rows |
| Pendant of Fortitude, Amulet of Stone, Cloak of Invisibility, Cloak of Speed, Cloak of Ether | (unchanged) | | | | | already use-activated, worn to use |
| 8 staves | (unchanged kinds) | charges + recharge unchanged | — | — | — | NOT equipable: no worn slot; one bag slot; used from the bag by index; Magic User only |

`ACTIVATION_OF` grows from 20 to 29 entries. `SLOT_OF` goes from 24 to 15 entries (8 JEWELRY + 7 CLOAKS; staves leave the taxonomy).

## The one code path

`useItem` (worn item only, `notWorn` refusal otherwise) → `applyActivation` (spends a staff charge or starts the item's own `item:<name>` c.timers record, with `cd` when the activation carries one) → `c.timers` → `eff()`/`itemEffectActive`/`liveItemEffects` (the ONLY readers, keyed by the record's own name resolving through `ACTIVATION_OF`). No scattered passives, no auto-activation, no silent flying.

## Deleted paths

- `engine/derived.js#eff`'s old two-path body (worn-sum when `c.worn` present, else bag-sum) — replaced by a single timer-only sum
- `isFlying`'s "ready counts as flying" clause and the Bracelet-always-flies special case
- `engine/movement.js`'s climb/gorge `flyOver()` auto-activation (it no longer starts a fresh Cloak-of-Flying record)
- The 20-square Cloak of Healing/Regeneration per-step tick block in `engine/movement.js`
- The staff's worn-slot branches in `engine/items.js#autoWearSlot`/`equipItem`/`takeItem` and `engine/derived.js#WORN_SLOTS`/`slotFor`/`reconcileWorn`
- The Cloak of Healing row/base-value/event (`cloakHealed`)/eff key (`cloakHeal`) everywhere
- `engine/derived.js#hasItemNamed` (no remaining callers once flight went timer-only)

## Declared cloak-roll fixture divergences (all cite `260918-w4n`)

The d7 reroll (`rng.d(CLOAKS.length)` instead of a literal `d(8)`) is still exactly ONE `gen.next()` draw — the rng cursor never shifts, only the row a given draw lands on. Five fixture files' chargen rolled a different cloak under the 7-row table:

| Fixture | Seed | Before (d8) | After (d7) |
|---|---|---|---|
| `action-script.chargen.json` | 2 | Cloak of Regeneration | Cloak of Armor |
| `action-script.combat.json` (`flee`) | 17 | Cloak of Armor | Cloak of Flying |
| `action-script.encounters.json` (`chest`) | 2 | Cloak of Regeneration | Cloak of Armor |
| `action-script.encounters.json` (`affliction`) | 160 | Cloak of Regeneration | Cloak of Armor |
| `action-script.movement.json` | 256 | Cloak of Healing | Cloak of Strength |

Every other fixture seed's cloak roll landed on the same row under both tables. `test/parity/harness/comparables.js#REWORDED_TXT_ITEMS` drops `"Cloak of Healing"` and adds the 7 newly-reworded rows (`Ring of Power`, `Gauntlet of the Giant`, `Amulet of Light`, `Anklet of Invisibility`, `Helm of Knowledge`, `Bracelet of Flight`, `Cloak of Strength`) — Cloak of Flying's `txt` is untouched (see key-decisions).

## Task Commits

1. **Task 1: Content + engine — every worn-slot item is act-authored, `eff()` is timer-only, no auto-activation, staves leave the worn taxonomy** — `934f128` (feat)
2. **Task 2: Shell Use buttons, chips and copy for the new kinds, tuning-bot policy, docs** — `6e3c672` (feat)
3. **Task 3: Full gate, build, SUMMARY** — this commit's docs-only metadata (SUMMARY/STATE, handled by the orchestrator per the executor's constraints — not committed by this agent)

## Gate Results

- `npm test`: **3206/3206 pass, # fail 0**
- `npm run build:www`: exit 0
- `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (**unchanged** — the frozen prototype is never edited)
- `git diff --name-only -- test/parity/fixtures`: exactly `action-script.chargen.json`, `action-script.combat.json`, `action-script.encounters.json`, `action-script.movement.json` — each carries a `260918-w4n`-cited `chargenDivergence`/`divergence` record
- `node --test "test/parity/**/*.test.js" "test/determinism/**/*.test.js" "test/roundtrip/**/*.test.js" "test/persistence/**/*.test.js"`: all green
- `node tools/tune-difficulty.mjs --seeds=30 --json`: completes without throwing

## Files Created/Modified

**Content/engine:** `content/treasure-tables.js`, `engine/derived.js`, `engine/items.js`, `engine/movement.js`, `engine/actions.js`, `engine/saveState.js`, `engine/character.js`, `engine/encounters.js`, `engine/economy.js`

**Shell/bot:** `src/browser/viewModels.js`, `src/browser/combatMenu.js`, `src/browser/eventNarration.js`, `src/browser/toasts.js`, `mazeworld.html`, `tools/lib/tuning-bot.mjs`

**Parity:** `test/parity/harness/comparables.js`, `test/parity/fixtures/action-script.{chargen,combat,encounters,movement}.json`, `test/parity/FIXTURE-INVENTORY.md`

**Docs:** `docs/GEAR-BALANCE.md`, `docs/GEAR-SLOTS.md`, `docs/TERRAIN.md`, `docs/USABLE-FEATURES-AUDIT.md`

**Tests (Task-1-listed, ~35 files):** item-activation, item-wiring, conditions, movement, water-cost, tools, worn-model, worn-slots, worn-migration, save-validation, actions, fluency, darkness-filter, armor-durability, effect-expiry, phobia-triggers, spell-utility, usable-features-audit, plus combat.test.js and engine-purity.test.js re-verified unmodified-green

**Tests (Task-2-listed):** itemRowState, combatMenu, gear-panels, shell-worn-slots, shell-map-hud, tuning-bot, bot-tactics

**Tests (collateral, not in the plan's file list — see Deviations):** armorDisplay, armor-durability (already listed), feedback-payload, parley, parley-button-mirror, rations-audit, foe-turn-draw-count, identity-contract, items, shell-fight-gate, shell-gear-toolbar

## Decisions Made

See `key-decisions` in the frontmatter above for the five load-bearing calls (Cloak of Flying's untouched txt, Ring/Gauntlet's in-scope-per-rule-text inclusion, the staff-fold-then-clamp ordering, the collateral-test rationale, and the Ninja opener's now-doubled, pre-existing combat.js interaction).

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — bug/behavior directly caused by this task's changes)

**1. [Rule 1] Collateral test files outside the plan's declared file list broke and were re-pinned**

The plan's Task 1/2 `<files>` lists did not name `armorDisplay.test.js`, `feedback-payload.test.js`, `parley.test.js`, `parley-button-mirror.test.js`, `rations-audit.test.js`, `foe-turn-draw-count.test.js`, `identity-contract.test.js`, `items.test.js`, `shell-fight-gate.test.js`, or `shell-gear-toolbar.test.js`. Each broke because it built a character with a bagged (not worn+used) copy of a now-timer-gated item and asserted the OLD passive/bag-sum behavior, or (rations-audit/foe-turn-draw-count) pinned a literal draw-count/attack-count that genuinely shifted once the Cloak of Healing tick block was deleted or a fixture's starting-cloak no longer coincidentally suppressed a self-crit.

- **Found during:** Task 1 (full-suite re-run after the engine rewrite) and Task 2 (shell Use-button gate re-run)
- **Fix:** Re-pinned each test to the new timer-only / bag-index model, adding a live-record helper (`liveCloakArmor()`, `liveHelm()`, etc.) where the test's intent was "this item is granting its effect" rather than "this item merely exists"; re-measured the two literal-count pins live (movement.js `rng.` line count 22→19; the Ninja's seed-1 opener 9→18) rather than hand-computing
- **Files modified:** all ten files named above
- **Verification:** `npm test` 3206/3206, 0 fail
- **Committed in:** `934f128` (Task 1), `6e3c672` (Task 2)

**2. [Rule 1] The classic (dead) parley canParley()/fluency() mirror test's own harness needed a synthetic live-timer attach, not a mazeworld.html edit**

`test/unit/parley-button-mirror.test.js` compares the LIVE engine's `canParley` against mazeworld.html's classic (confirmed-dead, DR8) `canParley()`/`fluency()` duplicate. The classic duplicate reads a bagged item's `eff` map directly with no concept of `c.timers` — genuinely out of this quick task's scope (dead code, deferred to the Shell Debt cleanup milestone). Rather than editing dead code to keep the comparison meaningful, the test's own `mk()` helper now attaches a live Helm timer whenever a Helm-named item is present, matching real play (a character attempting to parley on fluency would already have used the Helm).

- **Found during:** Task 1
- **Fix:** `mk()` in that file now injects `timers: { "item:Helm of Knowledge": ... }` when the fixture's `items` includes one
- **Files modified:** `test/unit/parley-button-mirror.test.js`
- **Verification:** all 6 tests pass
- **Committed in:** `934f128`

---

**Total deviations:** 2 auto-fixed categories (both Rule 1 — bug/behavior changes directly caused by this task's engine rewrite, surfacing in files the plan did not enumerate).
**Impact on plan:** No scope creep — every fix is a test re-pin or harness adjustment proving the SAME new rule the plan specifies; zero production-code changes outside the plan's declared file list.

## Issues Encountered

None beyond the deviations above (all resolved within the auto-fix budget).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Code-complete, full gate green, zero undeclared fixture drift, frozen prototype master untouched. The eight-step browser sanity checklist below is ready to fold into the next batched Pixel 7 UAT round (per the deferred-UAT protocol — no device pause here).

## Human verification

Executed as part of the next batched Pixel 7 device round (debug APK built from this commit or later):

1. Serve the repo root over http (`npx serve .`) and open `mazeworld.html`; new run; Hero → Gear: a starting cloak (Thief) shows `worn · READY` with Use and Unequip; the ON YOU panel lists five empty-slot rows and no staff row.
2. Find/buy a Cloak of Flying; in the BAG its row shows Use — tap: toast "…is in your bag, doing what things in bags do: nothing. Wear it first." and NO Flying chip anywhere; Equip it: still no Flying chip; walk onto a crevice: the climb roll card appears (no fly-over); Gear → Use: toast "Twenty squares of not touching the floor.", chip `Flying 20 sq`, the next crevice/wall is flown over, the row reads `N SQ`, then `cd N SQ` and the chip becomes `Cloak of Flying cd N sq`; a second Use during cooldown toasts the cooldown refusal.
3. Wear a Cloak of Regeneration at less than full hp: Use → `Flesh knits +N hp` toast, row `cd 20 SQ`; walking 20 squares hurt with it worn-but-unused heals nothing; a Thief's starting cloak is never a Cloak of Healing across several new runs.
4. Wear an Amulet of Light, get Darkness (or a dark tile): Use → darkness lifts at once, chip `Alight 50 sq`, the map view widens.
5. Wear a Cloak of Armor and take a hit: soak reads plate only while `Plated` shows.
6. Wear a Helm of Knowledge: TALK is offered only while `Fluent` shows.
7. As a Magic User with a staff: the BAG row shows Use (no Equip), it occupies a bag slot in the `n / m` count, Use from the bag works in and out of combat (the ITEMS submenu lists it), the charges readout `k/max · N SQ` counts down; as a Fighter the same row's Use tap toasts wrongClass.
8. Load a v1.5 save carrying a bagged cloak and a worn staff: it loads, the cloak shows Use with nothing live, the staff now sits in the BAG panel (a full bag drops it with the usual overflow behaviour); a v1.5 save carrying a Cloak of Healing loads with that cloak listed as an inert row (no Use button, no chip, Drop/Unequip still work); no console errors.

## Self-Check: PASSED

Both task commits (`934f128`, `6e3c672`) verified present in `git log`; spot-checked file existence for `content/treasure-tables.js`, `engine/derived.js`, `engine/items.js`, `src/browser/viewModels.js`, `tools/lib/tuning-bot.mjs`, `docs/GEAR-BALANCE.md`, `test/parity/fixtures/action-script.chargen.json` — all present on disk.

---
*Phase: quick-260918-w4n*
*Completed: 2026-09-19*
