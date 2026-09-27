---
phase: 76-darkness-unification-relaunch-persistence
plan: 06
subsystem: rules-engine/spells + shell copy
status: complete
tags: [DARK-03, map-the-floor, reveal, scroll-fumble, weaken, fixture-inventory, deferred-uat]
requires:
  - "76-01: darkLimited / the wider revealRadius (decides what the first step graduates)"
  - "76-03: the load chains (clearStaleTimers(c, fightSurvives)) and the resumed fight"
  - "76-05: the Phase 76 persistence subsection and the compiled device checklist"
provides:
  - "content/spells.js: Map the Floor's one-square window and its until-you-move txt"
  - "engine/derived.js: the countdown-free reveal chip { key: 'reveal', polarity: 'good' }"
  - "engine/saveState.js: clampRevealWindow in both load chains"
  - "engine/scrollFumble.js: a fumbled Weaken weakens the reader (c.foeEffect)"
  - "test/unit/map-until-move.test.js: the until-you-move guard (16 tests, including a bot run)"
  - "test/parity/FIXTURE-INVENTORY.md: the Plan 06 subsection under the Phase 76 H2"
affects:
  - "Phase 79.1: the end-of-milestone bot readout measures both rule changes"
  - "REQUIREMENTS.md: the orchestrator adds an entry for the 2026-09-26 ruling (DARK-03) and maps it to this plan"
tech-stack:
  added: []
  patterns:
    - "a one-square squares-cadence window on the existing timer, so the one tick site (move) ends it"
    - "a generic fixed-detail slot on a CONDITION_COPY row for a chip with no countdown"
key-files:
  created:
    - test/unit/map-until-move.test.js
  modified:
    - content/spells.js
    - engine/magic.js
    - engine/movement.js
    - engine/derived.js
    - engine/saveState.js
    - engine/scrollFumble.js
    - src/browser/eventNarration.js
    - src/browser/narrationLines.js
    - src/browser/gearTab.js
    - src/browser/heroConditions.js
    - mazeworld.html
    - docs/SPELLS.md
    - docs/ROLL-LEDGER.md
    - docs/DIFFICULTY-RETUNE.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/unit/map-reveal.test.js
    - test/unit/spell-table.test.js
    - test/unit/magic.test.js
    - test/unit/conditions.test.js
    - test/unit/shell-spells-40.test.js
    - test/unit/gear-view-models.test.js
    - test/unit/gear-panels.test.js
    - test/unit/hero-conditions.test.js
    - test/unit/scroll-fumble-resolve.test.js
    - test/unit/control-at-depth-rules.test.js
decisions:
  - "Map the Floor lasts only until you move: squares 1 on the existing Phase 40 timer; no new expiry machinery"
  - "Only movement ends the window: engine/movement.js#move is the one tickSquares call site (pinned by a test)"
  - "Old saves: clampRevealWindow loads a live window with more than one square left as left 1, silently"
  - "The reveal chip carries no countdown; the shell shows the fixed detail 'until you move'"
  - "heroConditions gains lasts 'untilMove' ('until you move') so the hero chip model matches the countdown-free chip"
  - "A fumbled Weaken scroll sets the reader's c.foeEffect { kind: 'weakened', rounds } and no foe-side field; out of combat it still fizzles"
metrics:
  duration: "about 2 h 10 min"
  completed: 2026-09-26
  tasks: 4
  commits: 7
---

# Phase 76 Plan 06: Map the Floor lasts until you move (DARK-03), plus the Weaken-fumble fix — Summary

Map the Floor now shows the whole floor only while the hero stands still. The first step breaks the focus and re-fogs the floor through the existing Phase 40 sweep. A fumbled Weaken scroll now weakens the reader instead of quietly weakening the foes. Every state pin and fixture stayed byte-identical.

## Plan base and predictor

Plan base: `2a5bf9569b560303c452fecee0d9d6d54e2d35f4` (master at dispatch: 6,881/6,881, parity 64/64, boot:check PASS).

`floorMapped` events at the plan base. Parity was counted with a temporary `console.log` probe in the reveal branch, reverted before the first edit. The bot surfaces were counted with a scratch `playRun` / replay counter.

| Surface | floorMapped at the base |
|---|---|
| every parity scenario (chargen 14 seeds, movement, combat ×6, magic ×4, economy, encounters ×5) | 0 |
| PIN_RUNS solo-1, solo-2, solo-thief-pilfer, solo-magicuser-sorcerer, party-1, party-fighter-knight, deep-8, deep-14 | 0 each |
| pre-switch save replay | 0 |
| bot-tactics Fighter/Knight/Human seeds 1, 2, 3, 5, 6 (2000) and 1-5 (1000) | 0 each |
| bot-tactics Thief/Pilfer/Human 2, 3, 4; Fighter/Knight/Troll 5, 2, 4 | 0 each |
| bot-tactics Magic User/Sorcerer/Human seeds 4, 2, 3 | 2, 0, 7 |

bot-tactics runs under identity dials (`setIdentityDials`), so its seeds were counted that way. The first scratch run without identity dials gave misleading "stuck" results.

## Tasks

| # | Task | Commits |
|---|---|---|
| 1 | Close the window on the first step (engine) | `a685f118` (RED), `496dbce5` (GREEN) |
| 2 | Tell the new truth in voice (copy, chip, Gear row, docs) | `a8a00ce3` (RED), `5e44afa1` (GREEN) |
| 3 | Prove the bot plays the rule; measure and declare | `5d032c13` |
| 4 | (orchestrator scope) A fumbled Weaken weakens the reader | `8e8de55c` (RED), `76610083` (GREEN) |

## The new copy

- Spell txt: `sight · the whole floor · shown until you take a step, then your focus breaks`.
- Chip: `Mapped` with the fixed detail `until you move` (`CONDITION_COPY.reveal = { label: "Mapped", detail: "until you move" }`, read by a new last branch in paintConditions' detail chain, `CONDITION_COPY[cn.key]?.detail`).
- Tap card (CONDITION_EXPLAIN.reveal): "You can see the whole floor for exactly as long as you stand still. One step and your focus breaks; whatever you never walked goes dark again."
- Gear kit row (ALSO ON YOU): `Map the Floor · until you move`.
- Oracle floorMapped: "The floor lays itself out in your head — every corridor on this level, for exactly as long as you hold still."
- Oracle revealFaded: "You glance down to check your footing, and your focus breaks. The whole floor slips out of your head."
- Rail floorMapped: "The floor lays itself out in your head. Don't move." (tone magic, PRIORITY.you)
- Rail revealFaded: "You moved. Focus lost; the map forgets." (tone beat, PRIORITY.other)
- Hero chip model (heroConditions): reveal `lasts: "untilMove"`, "until you move".
- The RAIL_FAMILY titles (MAPPED / THE MAP FORGETS) are unchanged.

## The flipped pins

Each flip has a comment naming Plan 76-06 and the ruling. The full table is in FIXTURE-INVENTORY's Plan 06 subsection.
- map-reveal.test.js: the cast (`left: 1`, no `squares` key), the recast (keeps one square), the sweep ("the first step sweeps, never a second"), the step-20 recast (reopens a one-square window), the chip (no countdown, gone after the first step), the narration test, and the live-window round-trip (now saved right after the cast).
- spell-table.test.js (`squares === 1`), magic.test.js (no `squares` key), conditions.test.js (two reveal chip deep-equals).
- shell-spells-40.test.js (the CONDITION_COPY regex, the kit row, the voice list, plus a new painted-chip sandbox test and a tap-card test), gear-view-models.test.js, gear-panels.test.js.
- hero-conditions.test.js (77-03's guard): the lotChips input and the chipSheetFacts reveal line.

## Re-pinned bot pins

None. Every PIN_RUNS label and the pre-switch save had zero casts at the base and stayed byte-identical ("measured zero"). For example solo-magicuser-sorcerer is still `444ec2ca…` and the save's `expected.hash` is still `43b71a38…`. The two casting bot-tactics seeds moved but still die naturally, so no seed was swapped: MU/Sorcerer seed 4 went from 830 to 576 actions and seed 3 from 972 to 551. `roll-high-state-pins.test.js`, `roll-high-save-compat.test.js`, its fixture and `bot-tactics.test.js` are unchanged. The recorded rail corpus `test/unit/fixtures/event-order/default-fold-corpus.json` has no floorMapped, revealFaded or weakened-fumble line, so it was not regenerated. No shell snapshot moved. No balance readout was run (tune-difficulty, tune-classes and fit-difficulty were not touched), and `tools/readouts` is unchanged.

The bot case in map-until-move.test.js pins seed 3 (forced Human Sorcerer, 400 actions). PIN_RUNS "solo-magicuser-sorcerer" never casts the spell, and seed 3 is the smallest of seeds 1-20 that does (3 casts). It asserts that every move taken while a window is open also emits revealFaded, that every live window has `left` 1, and non-vacuity.

## Fix: a fumbled Weaken scroll weakens the reader

- **The bug.** `engine/scrollFumble.js#resolveHarmful`, case `weakened`, set the foe-side fields a landed hero Weaken sets: `C.weakened` (halves the foes' blows), `C.foeToHitPenalty = 3` and the `spell:weaken` timer. The "harmful" fumble helped the reader while `fumbleOnReader` said the reader was weakened.
- **The fix.** It now sets `c.foeEffect = { kind: "weakened", rounds }` (the row's d4+1, drawn from the same fumble stream once, so no stream shifts). This is the hero-side debuff a foe's Weaken inflicts. `combat.js#playerStrike` halves the reader's own landed blows while it runs, and foeTurn ticks it down. No foe-side field is set, and the unused `startEffect` import was dropped. The debuff uses the hero's single `foeEffect` slot, so like a foe's debuff it replaces any hex already there.
- **Out of combat.** No change was needed. readScroll's Phase 75.1 rule already fizzles every fumble outside combat and never calls the resolver. A new test pins this for Weaken.
- **The Oracle and rail lines** ("Weaken weakens you, N rounds of it." / "Weaken weakens you, N rounds.") are now true, and a test pins them. The copy is unchanged, which keeps 77-05's scroll-cast entries conflict-free.
- **ROLL-LEDGER X8** is marked RESOLVED, and the guard paragraph now says the exemption was removed. The X8 row stays, because the guard requires ids X1-X8.
- **control-at-depth-rules.test.js**: the `scrollFumble.js#resolveHarmful` EXEMPT entry and its non-vacuity site are removed. The guard needs no entry, because the fumble assigns no foe control any more; the RED commit showed the guard failing with the exemption gone and the old code in place.
- **Measured moves.** Zero `fumbleOnReader{effect:"weakened"}` events at the pre-fix head on every PIN_RUNS label, the save replay and every bot-tactics seed. The parity side is pinned at zero exposure by divergence-records' RULES-10 guard. Nothing moved. It is declared as a `####` record inside the Plan 06 subsection.
- 77-04's foe chips: no foe-chip test assumed the old behaviour (foe-conditions.test.js only exercises helpful fumbles), and it passes.

## Gate results at the new phase head (`76610083`)

- `npm test`: **6,901 / 6,901 pass, 0 fail**. That is 6,881 at the base plus 20 new tests (16 in map-until-move, 2 shell-spells-40, 2 scroll-fumble-resolve). After Task 3 alone it was 6,899 / 6,899. No band or survival test failed.
- `node --test "test/parity/**/*.test.js"`: **64 / 64**. `git diff 2a5bf95 -- test/parity/fixtures test/parity/prototype-master.js.txt test/unit/fixtures tools/lib/tuning-bot.mjs engine/difficulty.js tools/readouts` is empty. `git hash-object test/parity/prototype-master.js.txt` is `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). `node tools/fixture-inventory.mjs` gives the same roster, and fixture-inventory.test.js is 5/5.
- `npm run boot:check`: **PASS** (no-uncaught, painted, graves, title). The first run flaked on `graves` and the rerun passed, as allowed. www/ was built through a temporary node_modules junction, which has been removed. www/ is gitignored and was not committed.
- `git diff 2a5bf95 -- tools/lib/tuning-bot.mjs engine/effects.js engine/maze.js`: empty.

## Plan 06 device checks: addendum to 76-05's Phase 76 checklist (milestone-close Pixel 7 batch)

- [ ] Cast Map the Floor: the whole floor shows, the chip reads "Mapped · until you move", and the Gear tab's ALSO ON YOU row says "until you move".
- [ ] Open every tab, make camp, and fight a monster that finds you on that square: the map stays shown throughout.
- [ ] Take one step: the parts you never walked fog back, and the Oracle and rail say your focus broke.
- [ ] Step, then recast: the floor shows again, and the next step fogs it again.
- [ ] Cast, swipe the app away and relaunch: the floor is still shown with the chip up, and one step fogs it.
- [ ] Read a scroll that turns out to be Map the Floor: the same behaviour.
- [ ] (Weaken fumble) In a fight, a fumbled Weaken scroll shows a Weakened chip on YOU, your blows land for half, and no foe shows a weakened badge.

## Deviations from Plan

### Orchestrator / user rulings

- **No bot balance runs** (user ruling 2026-09-26). The plan's "no readout" already agreed. Only deterministic tests and pins were used.
- **Extra scope: the Weaken-fumble fix** (Task 4, above), with its own RED and GREEN commits.

### Auto-fixed issues

**1. [Rule 2 - Missing critical functionality] The hero chip model disagreed with the countdown-free chip**
- **Found during:** Task 2 (the orchestrator flagged 77-03's heroConditions guard).
- **Issue:** `src/browser/heroConditions.js` gave reveal `lasts: "squares"`. With no `remaining`, `chipSheetFacts` would print an empty "how long" line.
- **Fix:** added `untilMove` to LASTS and `HERO_CHIP_COPY.lasts.untilMove: "until you move"`, and set the reveal entry to `lasts: "untilMove"`. The hero-conditions test's reveal inputs and expectations were flipped to match.
- **Files modified:** src/browser/heroConditions.js, test/unit/hero-conditions.test.js
- **Commit:** `5e44afa1`

**2. [Rule 2] Two conditions.test.js pins beyond the one the plan listed**
- The fully-loaded character test also read `byKey(conds, "reveal").remaining` (22). It was flipped with a comment, in the Task 1 RED commit.

### Plan notes

- **Acceptance grep `grep -c "### Plan 06" test/parity/FIXTURE-INVENTORY.md` = 1** cannot hold: an older phase already has `### Plan 06 — the Skeleton shatters…` (line 2954). This plan adds exactly one `### Plan 06` heading, under the Phase 76 H2, so the file count is 2. `## Phase 76` still appears once.
- **Acceptance grep for `e.squares` in eventNarration.js** matches an unrelated line ("more squares" in a song cooldown) because `.` is a regex wildcard. `grep -F "e.squares"` is 0.
- **Test count:** map-until-move has 16 tests: the spell row, the cast, the first step, water, same square, tabs, the one tick site, recast, stairs, scroll, two relaunch tests, two old-save tests, the chip and the bot case.
- **map-reveal's "walking graduates" test** still passes unchanged, because its first step now sweeps and its monotonic assertions hold. It was left as is.

## Known Stubs

None.

## TDD Gate Compliance

RED then GREEN commits exist for Task 1 (`a685f118` → `496dbce5`), Task 2 (`a8a00ce3` → `5e44afa1`) and Task 4 (`8e8de55c` → `76610083`). Task 3 is `type="auto"`: a test-only declaration commit whose bot case passes against the Task 1 engine.

## Threat surface

No new surface. T-76-06-01 and T-76-06-02 are mitigated: `clampRevealWindow` touches only a plain-object, effect-phase, squares-cadence record with a finite `left` above 1. It never throws and never creates a key. A test pins the cooldown, left-0, string, null and rounds-cadence shapes.

## Note for the orchestrator

Add a REQUIREMENTS.md entry for the 2026-09-26 ruling "Map the Floor lasts only until you move" (DARK-03 in this plan's frontmatter) and map it to 76-06. The Weaken-fumble ruling is recorded in 76-CONTEXT and ROLL-LEDGER X8; add a requirement line for it too if you track rulings that way. The todo `.planning/todos/pending/2026-09-26-map-the-floor-lasts-only-until-you-move.md` can move to done.

## Self-Check: PASSED
