---
phase: 77-combat-screen-oracle-readability
plan: 02
subsystem: ui
status: complete
tags: [combat, fight-log, narration, oracle, CMBUI-10]
requires: []
provides:
  - "linesForAction(..., { order: \"event\" }): the combat record's event-order fold"
  - "fightLogLinesFor / lineIdxsFor on the event order"
  - "test/unit/event-order-fold.test.js and the default-fold corpus pin"
affects:
  - src/browser/narrationLines.js
  - src/browser/fightLog.js
  - src/browser/combatBeat.js
tech-stack:
  added: []
  patterns:
    - "Two fold orders from one pipeline: priority (the rail) and event (the combat record)"
    - "Contiguity rule: a chain merges only with the next event that would otherwise produce a line"
key-files:
  created:
    - test/unit/event-order-fold.test.js
    - test/unit/fixtures/event-order/default-fold-corpus.json
  modified:
    - src/browser/narrationLines.js
    - src/browser/fightLog.js
    - src/browser/combatBeat.js
    - test/unit/beat-audio.test.js
    - test/unit/combat-beat-shell.test.js
    - test/unit/combat-beat.test.js
    - test/unit/combat-lock-shell.test.js
    - test/unit/fight-log-worst-case.test.js
    - test/unit/fightLog.test.js
    - test/unit/reduced-motion.test.js
    - test/unit/round-summary-band.test.js
    - test/unit/trap-death-repro.test.js
decisions:
  - "CMBUI-10: the fight log, the round strip, the beats and the end-of-fight lines read linesForAction's event order. The rail keeps the priority fold, and its output is byte-identical to the plan base over a 182-case recorded corpus"
  - "Event order: a line sits at its earliest event, lines sort by idx alone, and only back-to-back lines with the same text, tone and priority fold ' ×N'. There is no per-foe or per-target grouping, no ' · felled', no 3+ collapse and no same-type dedupe"
  - "A merged line takes its earliest event's idx: a resistFailed folded into its effect sits at the resistFailed, so the tap-reveal shows the resist roll"
  - "A spell throw whose outcome is not the next line event keeps its own 'X at Y.' line. The later spellHit/spellMissed still names the spell"
metrics:
  duration: "~75 min"
  completed: 2026-09-26
  tasks: 2
  files: 15
---

# Phase 77 Plan 02: Fight-log event order (CMBUI-10) Summary

The combat record now reads in the order things happened. `linesForAction` gained an `order: "event"` mode, and the fight log and the beats use it. In this mode every line sits at its earliest event, only contiguous chains merge (a roll and its outcome, a throw and its outcome, a resistFailed and its effect, an encounter start and the followers directly after it), and only back-to-back identical lines fold " ×N". The rail's priority fold is unchanged, and a 182-case corpus recorded at the plan base proves it.

**Plan base:** `b7d33827ad6a5429ed2e38011ea8470030de81bf`

## What changed

- **src/browser/narrationLines.js**
  - `linesForAction` accepts `opts.order`. `"priority"` is the default: today's behaviour, used by the rail. `"event"` is used by the fight log and the beats.
  - In the event order:
    - `enemyRound`, `yourRound`, `killFold` and `dedupeByType` are skipped.
    - `encounterStart` folds only the run of followers directly after the start.
    - `spellChainEvent`, a new sibling of `spellChain`, merges only contiguous throw/outcome and resist/effect pairs and never collapses 3+ targets.
    - `fleeChain`, `parleyChain` and `chestChain` merge only when the outcome is the very next line event (`chainScan`).
    - Lines sort by idx, then `foldAdjacent` folds identical neighbours.
  - The helpers `lineEvent`, `nextLineIdx` and `chainScan` define "next" as the next event that would produce a line. Silent bookkeeping such as `spGained` or `itemConsumed` never splits a chain.
  - The module header, the pipeline comment and the `linesForAction` JSDoc now describe both orders, who uses each, CMBUI-10 and the user's report.
- **src/browser/fightLog.js**: `fightLogLinesFor` passes `order: "event"`. Updated the header's Decision 1 and `roundSummary`'s order note.
- **src/browser/combatBeat.js**: `lineIdxsFor` passes `order: "event"`, so the beat stays aligned 1:1 with the log. Updated the heroFrames bugfix comment: the remaining under-count case is the adjacent-identical " ×N" fold.

## The user's riposte round, before and after

The priority fold on the synthetic report round read: "Ned falls (+10 XP).", "Ned hits you 1 of 3 (2)", "Ned misses, and pays 20 for it.", "Every miss is an invitation." That is the reported bug: the kill came first. A test now drives a real `foeTurn` with Riposte live against three 3-hp Neds, and the event order reads "Ned misses you", "Ned misses, and pays 7 for it.", "Ned falls (+N XP).", then the coin, three times over in time order.

## Pins added (test/unit/event-order-fold.test.js, 18 tests)

- **Corpus:** the default fold is byte-identical to the plan base over `test/unit/fixtures/event-order/default-fold-corpus.json`. The corpus has 182 cases, and the default call, the withIdx call and an explicit `order: "priority"` call are each deep-equal to it. The cases:
  - 18 synthetic lists that drive every aggregation branch;
  - 48 worst-case seeds (the fight and attack sweeps);
  - 116 cases from a deterministic 4-seed walker covering move, camp, fight, attack, flee, useAbility, castSpell, parley, buyItem and takeAllLoot.
  - It stores its input events, so an engine change never moves it.
  - Regenerate only as a declared change: `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`.
- **Event-order behaviour:**
  - the riposte round from a real foeTurn;
  - an adjacent pair folds, the same pair split by another line does not, and different text never folds;
  - a foe's two swings give two lines; three foes give three lines;
  - a hit and its kill are two lines, never " · felled";
  - flee, parley and chest rolls merge only when the outcome is contiguous, and a silent event between them does not break the merge;
  - a single-target spell merges; a Lightning gives one line per target; a warded throw gives three lines; Freeze reads "frozen solid";
  - resist contiguity; encounter-start contiguity;
  - an idx-ascending sweep over 120 worst-case seeds.
- **Engine emission (engine not edited):**
  - A real Samurai `fight` pushes `combatJoined` before any opening swing, and the fight log opens on "Initiative — ". The sweep reached the opening swings on at least 10 of its 40 seeds.
  - A real riposte turn pushes foeMissed, then riposted, then foeKilled for the same foe, and the kill comes before the next foe swings.
- **Oracle tab:**
  - `formatEvents` equals EVENT_NARRATION of the narrated events in engine order, one per event, with no folding (two identical misses give two Oracle lines).
  - A source pin checks that `logLine` inserts at `logEl.firstChild`, so the Oracle reads newest first.
- **Alignment:** `fightLogLinesFor` and `lineIdxsFor` are aligned 1:1 and ascending, on the riposte round and over the 80-seed worst-case sweep. Each line's roll is its own earliest event's Oracle detail.

## Re-pinned tests (old expectation, then new)

Each re-pin carries a CMBUI-10 comment. The mid-fight scenario is the rngState-32 attack round (struck, foeKilled, goldGained, struckByFoe).

| Test | Old expectation | New expectation |
|------|-----------------|-----------------|
| fightLog.test.js "count equality" | line count equals the default (priority) fold's count | line count equals the event-order fold's count; the texts are deep-equal in the same order |
| fight-log-worst-case.test.js (both scenarios) | fight-log count equals the priority fold `{limit: Infinity}`; the default call equals it | fight-log count equals the event-order fold; the default call equals its explicit priority twin |
| combat-beat.test.js "last hero-hp frame" | an Ogre 8+9 K-of-M line reads "17"; last frame 38, not 47 | two identical 8s read "Ogre hits you (8) ×2"; last frame 39, not 47; two different swings (8, 9) give exact frames [47, 38] |
| beat-audio.test.js (1)/(2) | mid-fight round has 3 lines; line 0 plays hit1 and foe-die | 4 lines; line 0 plays hit1, line 1 foe-die, line 2 gold, and line 3 plays nothing (capped away) |
| combat-beat-shell.test.js (1)(2)(5)(8) | 3 lines; strip rows 1, 2, 3; log has 3 entries | 4 lines; rows 1, 2, 3, then the 4th lands as the newest row (the strip keeps the last 3); log has 4 entries |
| reduced-motion.test.js (smoke) | rows equal plan.count (3) | plan.count is 4; rows equal min(count, 3) |
| round-summary-band.test.js (b)(c) | plan.count 3; 3 strip rows | plan.count 4; 3 strip rows (the round's last 3 of 4) |
| combat-lock-shell.test.js (3)(4)/(6) [deviation] | log has 3 entries | log has 4 entries |
| trap-death-repro.test.js RULES-06 (two tests) | K-of-M Ogre 8+9 fold: last frame 38; intermediate frame 47; round last frame 36 | adjacent-identical 8+8 fold: last frame 39; intermediate frame 47 (true 39); round last frame 37 |

No assertion about roll reveals, dull refusals or beat pacing was weakened.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-pinned test/unit/combat-lock-shell.test.js (outside the plan's file list)**
- **Found during:** Task 2 (full `npm test`)
- **Issue:** two tests pinned the rngState-32 mid-fight round at 3 fight-log entries. The event order gives 4.
- **Fix:** changed both pins to 4, with a CMBUI-10 comment, and updated the scenario's doc comment. 77-01 does not own this file this wave (77-01 owns shell-combat-actions.test.js, which was not touched).
- **Files modified:** test/unit/combat-lock-shell.test.js
- **Commit:** 91fd698d

**2. [Rule 2 - Correctness] A non-contiguous spellHit/spellMissed borrows its throw's spell name**
- **Found during:** Task 1
- **Issue:** engine spellHit and spellMissed events carry no `spell` field. In the event order, a throw split from its outcome (a foe ward's `foeWardSoaked` in between) would have read "It hits…".
- **Fix:** `spellChainEvent` lends the throw's `spell` to that target's later outcome (the `patched` map). The throw keeps its own "X at Y." line.
- **Commit:** 2213c31e

Beyond these, the plan was executed as written.

## Notes for later plans

- **77-05 and 77-06, the contiguity rule:**
  - A new two-event chain in `narrationLines.js` must merge in the event order only when the second event is the next event that would otherwise produce a line (`nextLineIdx` / `chainScan`).
  - The merged line takes its EARLIEST event's idx.
  - The priority path may keep scanning the whole action.
  - Add the chain to both orders, and keep the corpus pin green. If the rail's text for a corpus event legitimately changes, regenerate the corpus as a declared change.
- **fightLogLinesFor's roll** still reads each line's earliest event: `oracleDetailText(narrateEvent(events[idx]))`. For a merged line that is the roll or throw (or the resistFailed), not the outcome.
- **Oracle tab (#log):** unchanged and pinned. It gives one line per event in engine order, and it inserts newest first. If the user wants the Oracle tab itself to fold identical back-to-back lines, that is a small shell follow-up (see the plan's flagged assumption).
- The corpus JSON is about 290 KB. It stores its input events, so an engine change (such as 76-06's fumbled Weaken) cannot move it. Only a LINE_FOR or narrateEvent text change on a corpus event can.

## Known Stubs

None.

## TDD Gate Compliance

- RED: `6d47dd10` test(77-02). The 11 event-order tests failed; the corpus test passed at the base.
- GREEN: `2213c31e` feat(77-02). All 12 passed.
- Task 2: `91fd698d` feat(77-02).

## Verification

- `node --test test/unit/event-order-fold.test.js test/unit/narrationLinesCoverage.test.js test/unit/narrationLinesTable.test.js test/unit/linesForAction.test.js test/unit/rail.test.js`: 130/130 at the Task 1 commit, with none of the last four edited.
- `npm test`: 6785/6785, 0 failures.
- `git diff --quiet b7d33827 -- engine/ mazeworld.html src/browser/rail.js src/browser/eventNarration.js` exits 0.
- `grep -c 'order: "event"'` returns 1 in fightLog.js and 1 in combatBeat.js. `grep -c CMBUI-10 src/browser/narrationLines.js` returns 13.
- No bot runs and no readout files, per the 2026-09-26 ruling.

## Self-Check: PASSED

- FOUND: test/unit/event-order-fold.test.js
- FOUND: test/unit/fixtures/event-order/default-fold-corpus.json
- FOUND: commits 6d47dd10, 2213c31e, 91fd698d
