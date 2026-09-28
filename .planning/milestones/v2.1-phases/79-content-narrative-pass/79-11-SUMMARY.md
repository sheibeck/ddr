---
phase: 79-content-narrative-pass
plan: 11
status: complete
subsystem: narration (Oracle and rail, world domain; rail cards)
tags: [VOX-05, ROLL-04, world, refusals, rail, narration]
requires:
  - 79-01 (voice corpus, checks, CLI, base snapshot)
  - 79-04 and 79-08 (the other two narration domains, same files)
  - 79-05 (the roll-high item text the invisibility lines reuse)
provides:
  - "the world-domain Oracle and rail lines that failed the rubric, rewritten fact-first"
  - "one Oracle refusal reader (equipRefusalLine) for itemRejected and equipRejected"
  - "the Anklet and Cloak of Invisibility lines in roll-high words (ROLL-04)"
  - "docs/narrative-pass/why/79-11.json (36 rows)"
affects: [79-12, 79-13]
tech-stack:
  added: []
  patterns:
    - "module-private squaresText/railSquares: \"1 square\", never \"1 squares\" or \"undefined squares\""
    - "module-private withArticle: \"an Apprentice\""
    - "a refusal reads '<why in player terms>. <joke>' from the engine's own reason key"
key-files:
  created:
    - docs/narrative-pass/why/79-11.json
  modified:
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/rail.js (RAIL_COPY.quit.line only)
    - test/unit/clarity-cause-lines.test.js
    - test/unit/joiner-level-cap.test.js
    - test/unit/movement.test.js
    - test/unit/rations-audit.test.js
    - test/unit/store-delivery.test.js
    - test/unit/rail.test.js
    - test/unit/fixtures/event-order/default-fold-corpus.json (declared regeneration)
    - test/parity/FIXTURE-INVENTORY.md (### Plan 79-11, a measured zero)
    - docs/CLARITY.md
    - docs/RATIONS.md
decisions:
  - "tooHeavy is the class armour rule (engine/items.js#armorRefusalReason), not weight: 'Your class does not wear that armour.' (79-09 handoff)"
  - "joinerMet is an offer (the accept, decline or refusal follows), so it says 'offers to travel with you' and states the Joiner's level"
  - "insanityRolled is the hero's own insanity; the INSANITY table's foe-side rows are no longer printed, and faces 2, 4 and 6 say nothing came of it"
  - "A failed chest lock is final (resolveFeature clears the tile first), so the line no longer promises 'this round'"
  - "Rage and might: '+N damage on every blow until the day ends' (movement.js#newDay clears c.might)"
  - "The quit rail card: 'Press back once more to close the game. The delve waits for you.' (79-10 handoff; the run is saved on pause)"
metrics:
  completed: 2026-09-27
  tasks: 2
  commits: 2
---

# Phase 79 Plan 11: The World Domain's Narration and the Rail Cards Summary

Every world line that failed the rubric now says what happened, to whom and why before any joke. That covers movement, traps, chests, the day, rations, items, the store, Joiners, darkness, insanity and the refusals. The invisibility lines read roll-high. Each refusal gives its reason in the player's terms. Lines that passed are byte-identical, and so are the rail cards (RAIL_COPY, COMBAT_CARD_KINDS) and the hazard card, except the quit card (79-10's handoff).

**Plan base:** `1cadbcb0536af561252d1c7cfa6053d9b6ca67f7`

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Judge the world domain and the rail cards, rewrite what fails (with the five pins on changed wordings) | a936562b |
| 2 | Re-pin and record: the ledger, the fold corpus, the inventory declaration, the quit card | 1ca850dd |

## Check counts (`--owner 79-11`)

| Check | Base | After |
|---|---|---|
| `--roll-under` | 2 (oracle/rail itemEffectStarted, "need two better") | 0 |
| `--hygiene` | 0 | 0 |
| `--twins` | 2 (rail:afflictionTick "0", rail:storeOpened "1.25,0.75") | 0 |
| `--safety` | 0 | 0 |
| all four, `--count` | 4 | **0** |

- `--check-ledgers --plan 79-11 --after`: 0 errors.
- `node --test test/unit/voice-corpus.test.js`: 27/27.
- `--check-ledgers --plan 79-11 --after --coverage` reports one error that is not this plan's: `raw:engine/derived.js#PARTY_WIDE_ITEM_EFFECTS` ("Crystal Staff") was added after the base by the Joiner-defences work. It is an item-name key, not copy. See Handed on.

## Pass/fail table

Rubric points: 1 fact, 2 natural, 3 joke after the fact, 4 accurate. "Bare" means the `{ type }`-only rendering. "Refusal" means the refusal rule (what was refused and why, in the player's terms).

**Failed, rewritten** (Oracle and rail twin unless noted):

| Key | Failed | Note |
|---|---|---|
| itemEffectStarted | ROLL-04; 1; bare hygiene; 2 | Anklet "They need two better"; the Cloak never said what unseen does; "undefined squares"; "1 squares" |
| equipRejected, itemRejected | refusal; 4; 3; 2 | tooHeavy read as weight ("Too heavy to carry." / the Oracle's generic line); wrongClass gave no reason; notEquippable said "refuses your hands"; the Woodsman's reason was only the joke; "Not an upgrade. Dagger." |
| useRefused (cooldown, exploreOnly) | 1; refusal | "3 squares" of what; the rule came after the joke |
| campFailed | refusal; 4 | never named the camp; `need` is the party's total, so "(Mira eats 1 more)" counted twice |
| wentHungry | 3, 4 (Oracle); 4 (rail) | "nobody packed" came before the numbers; the rail's "no rations" was false with some rations |
| chestLocked | 4; 3 | one lock try per chest, so "wins this round" promised a retry |
| joinerMet (Oracle) | 4; 2 | an offer read as "joins you"; "a Apprentice" |
| joinerRefused (rail) | refusal | never said why (a Magic User and a Wilmsry) |
| insanityRolled | 1, 4 | printed the table's foe-side row ("It strikes the nearest of its own") for the hero's own insanity |
| insanityRage | 1 | "+N might" is engine vocabulary |
| darknessFell (Oracle; rail in code) | 1 | never said the cost or the duration, or that Night Vision waives it |
| armorPatched (Oracle) | 1 | "+2" of what |
| staffRecharged | 1; bare | a bare "2/5"; "?/?" |
| storeOpened | twins; 1 | the Pickpocket's ×1.25/×0.75 was missing from the Oracle; "a discount" never said half |
| afflictionTick (rail) | twins; 1 | "(−0 hp)" against the Oracle's "on one hp"; a tick never said "still in you" |
| trapDisarmed, trapPoisoned (Oracle) | 1, 3 | the joke stood in for the fact |
| trapDoubled (Oracle) | 3 | the joke came first |
| foeStoned | 2 | one foe "turn to stone" |
| rationsBought (rail) | 2 | "+1 rations" |
| abilityLearned | bare hygiene | a dangling " — " with no text |
| bank:RAIL_COPY.quit.line | 4 | "this delve is abandoned": a second back closes the game and the run is saved (79-10 handoff) |

**Passed, untouched** (byte-identical):
- **Movement and the day:** oneWayBlocked, climbedOver, leaptOver, draggedOver, flownOver, phasedThrough, waded, fellClimbing, fellInGorge, entombed, hazardChoice, turnedBack, toolUsed, toolRefused, heightsFear, waterFear, trappedPanic, phobiaTriggered, spellChargeRecovered, dayBegan, floorChanged, teleported, tileResumed, wanderingMonster, rationsEaten, potionDuplicated, died.
- **Afflictions and darkness:** afflictionCaught, afflictionPassed, afflictionCured, afflictionLingers, afflictionRolled, the oracle:afflictionTick twin, cured, phobiaAcquired, insanitySelfHarm, darknessLifted, darknessDispelled, darknessResisted, torchLit, revealFaded.
- **Items and loot:** itemGiven, itemTaken, itemUsed, itemFizzled, itemBurned, itemConsumed, itemEffectFaded, itemCooled, itemDropped, itemEquipped, itemUnequipped, bagFull, bagUpgraded, pilferFumbled, gearRefused, findOffered, findTaken, findLeft, lootDropped, lootTaken, lootLeft, lootForfeited, miscMagicRolled, scrollFound, grimoireLearned, grimoireSold.
- **Store, traps and chests:** bought, buyFailed, itemSold, purchaseBagged, the oracle:rationsBought twin, storeLeft, storeResumed, fightResumed, chestOpened, chestLockRolled, trapAvoided, trapSprung, and the rail twins of trapDisarmed, trapDoubled and trapPoisoned.
- **Joiners and the faerie:** faerieMet, faerieBane, joinerJoined, joinerLeft, joinerDeclined, joinerMurdered, joinerDismissed, dismissRefused, oracle:joinerRefused, rail:armorPatched.
- **Banks:** both phrase banks (PHOBIA_TRIGGER_PHRASE, RATION_RULE_LINE); every other RAIL_COPY string; every RAIL_FAMILY title; COMBAT_CARD_KINDS; all of HAZARD_CARD_COPY.
- **Raw entries:** every raw engine/*.js and rail.js entry. They are names, keys or fragments, so no engine string changed.

Synthetic-event artifacts, not rewritten: the affliction variants whose `kind` is an item-effect key ("haste: it takes hold"), "poisonedEdge:" as armorPatched's `by`, "−you hp", "you eat 5 a night, and you had 10", "Cloak of Speed is in effect" (the default branch fed a known item), and joinerLeft's bare "Your companion" mid-sentence (the {name} fill of 79-03's JOINER_EXIT_LINES).

## Changed lines (before → after, representative real events)

Oracle:
- Anklet: `Unseen for 50 squares. They need two better.` → `Unseen for 50 squares: every foe has two fewer faces that hit you.`
- Cloak or Potion of Invisibility: `Unseen for 50 squares. They swing at where you were.` → `Unseen for 50 squares: foes hit only on their die's top face (the top two if you insulted them). They swing at where you were.`
- Default effect: `Cloak of Speed: 1 squares.` → `Cloak of Speed is in effect for 1 square.` (bare: `It: undefined squares.` → `It is in effect for a few squares.`)
- Class armour: `Not for the likes of you. Plate refuses your hands.` → `Your class does not wear Plate. Not for the likes of you.`
- Class weapon: `… Broadsword refuses your hands.` → `Your class cannot use Broadsword. Not for the likes of you.`
- No armour: `Not for the likes of you. Leather refuses your hands — your kind wears no armour.` → `Your kind wears no armour, so Leather stays off. Not for the likes of you.`
- Woodsman: `A Woodsman in Mail is a tree in a tin. No.` → `A Woodsman wears no mail or plate. A Woodsman in Mail is a tree in a tin.`
- Not an upgrade: `Not an upgrade. Small Sack.` → `Not an upgrade: Small Sack is no better than what you have.`
- Not equippable: `Not for the likes of you. Rope refuses your hands.` → `Rope is not something you wear or wield.`
- Use cooldown: `Ring of Power: 30 squares. It is not a vending machine.` → `Ring of Power: ready again in 30 squares. It is not a vending machine.`
- Explore-only use: `X needs quieter surroundings.` → `X only works out of a fight. It needs quieter surroundings.`
- Camp: `You eat 2 a night (Bram eats 1 more). You have 1. Find rations first.` → `Not enough food to make camp: the party eats 2 a night (Bram eats 1 of those), and you have 1. Find rations first.`
- Hunger: `Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −4 hp.` → `Hunger: you eat 1 a night, and you had 0. Nobody packed enough. Cost of living −4 hp.`
- Chest: `Not today. The lock wins this round.` → `The lock holds, and the box stays shut for good. Not today, and not any other day.`
- Joiner: `Ada Brook, a Guard, joins you for a while.` → `Ada Brook, a level 2 Guard, offers to travel with you for a while.`
- Insanity: `Insanity. It strikes the nearest of its own. d6 → 2.` → `Insanity takes hold of you. d6 → 2. It lets go again before anything comes of it.` (1, 3 and 5 add nothing: their own lines follow)
- Rage: `Rage: +7 might.` → `Rage: +7 damage on every blow until the day ends.`
- Darkness: `The dark closes in around you.` → `The dark closes in around you for 30 squares: you see only the squares beside you, and you fight worse in it.` (Night Vision: `… for 30 squares. Your Night Vision sees straight through it.`)
- Mending: `Sewing: +3 back into your kit.` → `Sewing: +3 armour patched back into your kit.`
- Staff: `Crystal Staff hums. 2/2.` → `Crystal Staff hums: a charge is back (2/2).`
- Store: `The shop is open. (A discount, as always.)` → `The shop is open. (Half price, as always.)`. A Pickpocket adds ` The shopkeeper knows a Pickpocket's face: you pay ×1.25 to buy, and get ×0.75 when you sell.`
- Traps: `A Pilfer's hands already knew where not to put themselves.` → `Pilfer: trap disarmed. Your hands already knew where not to put themselves.`; `Cat Burglar's luck holds — for the trap. It hits twice as hard.` → `Cat Burglar: the trap hits twice as hard. The luck holds — for the trap.`; `Trap: it leaves something behind that outlasts the bruise.` → `Trap: poisoned. It leaves something behind that outlasts the bruise.`
- Stone: `Grunk turn to stone.` → `Grunk turns to stone.`
- New trick with no text: `New trick: Viper —` → `New trick: Viper.`

Rail twins:
- `Unseen for N squares: every foe has two fewer faces that hit you.`; `Unseen for N squares: foes hit only on their die's top face (top two if insulted).`
- `Too heavy to carry.` → `Your class does not wear that armour.`; `Not for the likes of you.` (wrongClass) → `Your class cannot use that.`; `No mail for a Woodsman.` → `No mail or plate for a Woodsman.`
- `Hunger: no rations (−4 hp).` → `Hunger: not enough rations (−4 hp).`
- `You eat 1 a night, you have 0. Find rations first.` → `Not enough food to make camp: you eat 1 a night, you have 0. Find rations first.`
- `The lock wins this round.` → `The lock holds. The box stays shut for good.`
- `Ada Brook takes one look at a Wilmsry and leaves.` → `Ada Brook, a Magic User, takes one look at a Wilmsry and leaves.`
- `Poison (−2 hp).` → `Poison: still in you (−2 hp).`; the no-loss branch: `It: nothing left to take. You are on one hp.`
- `Insanity — strikes the nearest of its own.` → `Insanity takes hold of you, then lets go.`; `Rage: +7 might.` → `Rage: +7 damage on every blow until the day ends.`
- `Stocked up: +1 rations.` → `Stocked up: +1 ration.`; `(a discount, as always)` → `(half price, as always)`; `Crystal Staff hums. 2/2.` → `Crystal Staff hums: a charge is back (2/2).`
- The cooldown, explore-only, stone, new-trick and default-effect fixes, as on the Oracle.
- `The dark closes in.` → `The dark closes in for 30 squares.` (plus `Night Vision sees through it.`). This is in code only: no synthetic event carries `duration`, so the corpus rendering is unchanged and it has no ledger row.

Rail card: `RAIL_COPY.quit.line`: `Press back once more and this delve is abandoned. Nobody will write it down.` → `Press back once more to close the game. The delve waits for you.`

The full record, one row per changed key, is `docs/narrative-pass/why/79-11.json` (36 rows).

## Engine hunks

None. `git diff 1cadbcb0 -- engine content` is empty. The engine's player-facing literals in movement.js and encounters.js are names, keys or fragments, and all of them passed.

## Re-pinned and new tests

Each re-pin carries a "VOX-05 (79-11)" comment.
- `test/unit/clarity-cause-lines.test.js`: trapPoisoned.
- `test/unit/joiner-level-cap.test.js`: the joinerMet Oracle literal and the joinerRefused rail literal.
- `test/unit/movement.test.js`: the campFailed Oracle sentences, solo and party.
- `test/unit/rations-audit.test.js`: the three wentHungry Oracle sentences and the rail line.
- `test/unit/store-delivery.test.js`: the Woodsman itemRejected line.
- `test/unit/rail.test.js`: a new test pins `RAIL_COPY.quit` (the line had no pin).
- No other test in the plan's list pinned a changed wording.

**Fold corpus (declared regeneration).** `test/unit/fixtures/event-order/default-fold-corpus.json` was regenerated with `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`. The diff is 68 `text` lines, all copies of three recorded lines:
- `campFailed` → "Not enough food to make camp: …"
- `wentHungry` → "Hunger: you eat 1 a night … Nobody packed enough …"
- `chestLocked` → "The lock holds. The box stays shut for good."

No event, order, fold or priority moved. It is declared under `## Phase 79` / `### Plan 79-11`, appended at the end of `test/parity/FIXTURE-INVENTORY.md`.

**Docs.** `docs/CLARITY.md` (the trapDoubled, trapPoisoned, wentHungry and campFailed rows) and `docs/RATIONS.md` (the wentHungry quote) now quote the new lines. trapPoisoned's Owner cell stays exactly "Plan 01", because clarity-cause-lines parses that cell and needs at least 20 Plan 01 rows.

## Gates

- The four guards pass unedited: `formatEventsCoverage`, `narrationLinesCoverage`, `roll-sign-consistency` and `honest-gains` (59/59).
- `node --test "test/parity/**/*.test.js"`: 66/66. `test/parity/fixture-inventory.test.js`: 5/5.
- `git diff --quiet 1cadbcb0 -- test/parity content engine` exits 0 before the inventory append. The prototype hash is `a1f4d0dc…` (unchanged).
- `npm test`: **7,418/7,418 pass**. That is the base's 7,417 plus the new quit-card test, with the regenerated corpus in the tree.
- `node --test test/voice/*.test.js`: the safety scan passes.
- No bot runs (user ruling). No floorRegen copy was touched or reintroduced.
- `boot:check` was **not run**. It needs `npm run build:www`, which needs node_modules. The worktree has none, and the sandbox refused the junction to the main checkout's node_modules. The only shell-visible change is one string in `RAIL_COPY`. The partial, gitignored `www/` from the failed build was removed.

## Deviations from Plan

### Orchestrator handoffs, applied

**1. [79-09 handoff] tooHeavy said weight**
- **Issue:** `EQUIP_REJECT_TEXT.tooHeavy` read "Too heavy to carry.", and its Oracle twin fell to the generic line. The reason is the class armour rule (`armorRefusalReason`: the armour is not on your class's list).
- **Fix:** "Your class does not wear that armour." on the rail, and "Your class does not wear X. Not for the likes of you." on the Oracle. Both are in the ledger.
- **Commit:** a936562b.

**2. [79-10 handoff] The quit card said the delve is abandoned**
- **Issue:** a second back press exits the app (nativeChrome.js `exit-app`), and the run is flushed on pause, so the line was wrong.
- **Fix:** rewritten to 79-10's suggested wording, pinned in rail.test.js, with a ledger row.
- **Commit:** 1ca850dd.

### Auto-fixed issues

**3. [Rule 1 - Bug] campFailed double-counted a party member**
- **Issue:** `need` is `nightlyEats(state)`, the whole party's night. "You eat 5 a night (Bram eats 1 more)" read as six.
- **Fix:** the line now reads "the party eats 5 a night (Bram eats 1 of those)".
- **Commit:** a936562b.

### Not in the plan's file list

`src/browser/rail.js` was only in the file list for judging, and changed only for the handoff. `docs/CLARITY.md` and `docs/RATIONS.md` quote the changed lines. `test/parity/FIXTURE-INVENTORY.md` and the fold corpus are the declarations the orchestrator asked for.

## Handed on

- **79-13 (the ledger coverage check):** `--coverage` flags `raw:engine/derived.js#PARTY_WIDE_ITEM_EFFECTS` ("Crystal Staff"). The Joiner-defences work added it after the base. It is a lookup key, not copy, so no rewrite is owed. It needs an exception or a ledger row from its author.
- **79-12 (closure):**
  - `content/misc-tables.js#INSANITY` is still registered as "what an insane foe does". Its only reader was the hero's insanityRolled line, which no longer prints it (the engine still stamps it as `result`). Decide whether to keep or retire it.
  - `rail:darknessFell`'s new duration and Night Vision clauses are invisible to the corpus, because no synthetic event carries `duration` or `nightVision`. Add a variant to tools/lib/event-variants.mjs if you want them on the review page.
- **79-13 (voice sample):** `tools/voice-sample-output.txt` may still quote old world lines. No test reads it; regenerate it with the final sample.
- **79-12 (history docs):** `docs/UAT-v1.5.md` line 160 quotes the old hunger line as a checklist item. It is history, not live copy.

## Known Stubs

None.

## Threat Flags

None. This is presentation copy only, with no new surface.

## Self-Check: PASSED

- Files exist: docs/narrative-pass/why/79-11.json (36 rows), src/browser/eventNarration.js, src/browser/narrationLines.js, src/browser/rail.js and this SUMMARY.
- Commits a936562b and 1ca850dd are on the branch (base 1cadbcb0).
- `--owner 79-11 --roll-under --hygiene --twins --safety --count` prints 0. `--check-ledgers --plan 79-11 --after` reports 0 errors.
