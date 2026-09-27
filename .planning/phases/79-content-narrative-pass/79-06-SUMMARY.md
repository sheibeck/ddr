---
phase: 79-content-narrative-pass
plan: 06
status: complete
subsystem: content copy (death, boards, placement, account, quips)
tags: [VOX-05, ROLL-04, epitaphs, leaderboards, family-friendly]
requires: [79-01]
provides:
  - "test/unit/death-copy.test.js: die() cause coverage, token sets, the engine-read trap range, no diagnosis, no self-harm framing"
  - "audited CAUSE_TEXT / EPITAPHS (1 cause + 8 epitaphs rewritten)"
  - "audited board, placement and quip banks (6 lines rewritten)"
  - "docs/narrative-pass/why/79-06.json (15 rows)"
affects: [79-09, 79-12, 79-13]
tech-stack:
  added: []
  patterns:
    - "a death-copy roll range is read off the engine function (springTrap driven with a stub rng) and formatted through facesRangeText, never hand-copied"
    - "a die( call-site scan, not a hand list, defines the cause set the copy must cover"
key-files:
  created:
    - test/unit/death-copy.test.js
    - docs/narrative-pass/why/79-06.json
  modified:
    - content/epitaphs.js
    - content/boards.js
    - content/placement.js
    - src/browser/missLines.js
    - test/unit/boards-copy.test.js
    - test/unit/fixtures/hazard-commit/golden.json
    - test/parity/FIXTURE-INVENTORY.md
decisions:
  - "The insanity cause was judged a self-harm framing and rewritten to deadpan: 'lost to a fit of dungeon madness' (flagged for the user's tone review at milestone close)"
  - "The death card prints '{name}, {race} {sub}, {cause}.' above the epitaph, so the cause always comes before the joke; epitaphs change only where they are roll-under, inaccurate or unsafe"
  - "Unreachable buckets (poison, teleport, won: no engine die() call passes them) were left word for word"
  - "TAG_CAUSES are share-tag codes, not copy: unchanged"
metrics:
  duration: "about 75 minutes"
  completed: 2026-09-27
  tasks: 2
  files: 9
---

# Phase 79 Plan 06: Death, board, placement, account and quip copy Summary

The trap epitaph now states the roll-high dodge the engine uses (16–20 on a d20, read off `springTrap` by a new guard test). The insanity cause no longer reads as self-harm. Six board, placement and quip lines stopped claiming things the data does not support.

**Plan base:** `d39625ee07887d049a216e1801e467f923aabe41`

## What was done

**Task 1: Death causes and epitaphs (TDD).**
- RED `ad45372c`: `test/unit/death-copy.test.js` covers the following.
  - It scans `engine/*.js` `die(` call sites and checks that every cause found has a CAUSE_TEXT entry and a non-empty EPITAPHS bucket. The scan must find the 15 known causes.
  - CAUSE_TEXT tokens equal CAUSE_TEXT_TOKENS and use only `{foe}`. EPITAPHS tokens must be a subset of `epitaphCtx`'s keys. Filled lines never show a `{` or "undefined".
  - It finds the trap dodge faces by driving `springTrap` with a stub rng for a plain hero. `facesRangeText` must give 16–20, and the trap line that states the d20 must match.
  - No line states a bare face count as a need.
  - No line uses a diagnosis term (the Pilfer list, built by concatenation) or a safety-wordlist term.
  - The insanity cause and its epitaphs contain no self-harm framing.
  - Three tests failed on the old text: the trap range, `combat.1` "needing a 5", and the insanity cause.
- GREEN `6ab8f5df`: nine lines rewritten (table below).

**Task 2: Boards, placement, account and quips; the ledger** (`136b30cc`).
- Every string in scope was checked against the rubric and the board definitions:
  - `compareRuns`, `updateBests` and `sortGraveyard` in `engine/records.js`
  - the fills in `boardsView.js` and `placement.js`
  - the grave cap in `engineAdapter.js`
- Six lines failed and were rewritten. `boards-copy.test.js` has three re-pins, each marked "VOX-05 (79-06)".
- Ledger: `docs/narrative-pass/why/79-06.json` has 15 rows. `--check-ledgers --plan 79-06 --after` reports 0 errors, and `test/unit/voice-corpus.test.js` is green.

**Declared pin move** (`4b312cf8`): `npm test` found one moved pin. It is `test/unit/fixtures/hazard-commit/golden.json` scenario `fatal-climb-s4`, whose `expected.hash` hashes a death state. Its epitaph is the rewritten `EPITAPHS.fall.3`.
- Proof: re-hashing the new state with the old epitaph text restored gives the old hash exactly. The events and rngState assertions passed unchanged.
- Only that one hash value was edited.
- The move is declared under `### Plan 79-06` in `test/parity/FIXTURE-INVENTORY.md`.

## Every changed line (before → after)

| Key | Before | After | Reasons |
|---|---|---|---|
| bank:CAUSE_TEXT.insanity | dead by their own hand | lost to a fit of dungeon madness | fact, joke |
| bank:EPITAPHS.combat.1 | Died as {name} lived: needing a 5 and rolling whatever that was. | Died as {name} lived: needing a high roll and rolling whatever that was. | roll-under |
| bank:EPITAPHS.fall.3 | Needed a 6 on a d10, three separate times. Managed two. | Needed three good d10 rolls to top the wall. Managed two. | roll-under, accurate |
| bank:EPITAPHS.fall.4 | The wall is still standing. {name} is being scraped off it. | The wall is still standing. {name} is not. | joke (gore softened) |
| bank:EPITAPHS.insanity.0 | Rolled a 1 on the madness table and won the argument with themselves. | Rolled on the madness table. The table won. | fact, joke |
| bank:EPITAPHS.insanity.1 | The corridor whispered something. {name} took it entirely on board. | Lost their wits on floor {floor}. Everything else followed shortly after. | fact, joke |
| bank:EPITAPHS.insanity.2 | Nothing attacked {name}. Nothing needed to. | Nothing attacked {name}. Dungeon madness is cheaper than monsters, and much quieter. | fact, joke |
| bank:EPITAPHS.starve.1 | Cost of living: 4 hp a day. {name} fell behind on the payments. | Cost of living: hp, every day without a ration. {name} fell behind on the payments. | accurate (upkeep is 1 for a Dwarf, 15 for a Troll, halved by Heft) |
| bank:EPITAPHS.trap.2 | 1–5 on a d20 avoids it. {name} rolled the way {name} always rolled. | 16–20 on a d20 avoids it. {name} rolled the way {name} always rolled. | roll-under |
| bank:BOARD_COPY.yard.rule | Everyone you have rolled and lost, deepest first, with what was said over them. Not ranked against anybody. | Your sixty most recent dead, deepest first, with what was said over them. Not ranked against anybody. | accurate (GRAVE_CAP 60) |
| bank:BOARDS_PANEL_COPY.scope.ranked | Your dead only. The world has not been told. | Your dead only, from this phone. Nobody else is counted here. | accurate (untrue with Compete on) |
| bank:STANDING_LINES.rest.2 | Somewhere in the middle of the pile. Literally. | Somewhere in the pile. Literally. | accurate (the band includes last place) |
| bank:GLOBAL_STANDING_LINES.ten.0 | Top ten. Strangers are studying your corpse. | Top ten. Other delvers are studying your corpse. | accurate (the bank serves FRIENDS too) |
| bank:PLACEMENT_LINES.rest.1 | You placed {rank} of {total}. Somewhere in the middle of the heap. It is warm there, at least. | You placed {rank} of {total}. Somewhere in the heap. It is warm in there, at least. | accurate |
| bank:MISS_LINES.14 | The dungeon rates that a two. | The dungeon rates that two out of ten. | accurate, natural (read as a die face) |

Every other line in the 79-06 worklist passed the rubric and is unchanged word for word. That covers ACCOUNT_COPY, the rest of BOARD_COPY, BOARD_FOOTNOTES, the rest of BOARDS_PANEL_COPY, NEW_BEST_HEAD, NEW_BEST_LINES, FIRST_DEATH_LINES, PLACEMENT_CARD, SEASON_DROP_LINES, the other MISS_LINES and the `newBest.js` raw literals. No board id, key, token or score logic changed.

## The insanity-cause decision (for the user's milestone-close review)

`CAUSE_TEXT.insanity` ("dead by their own hand") failed the family-friendly bar as self-harm framing. It now reads "lost to a fit of dungeon madness". That names the madness table as the cause, in the same deadpan register as "undone by a trap".
- Three insanity epitaphs that pointed at the hero as their own killer were rewritten the same way.
- "Cause of death: one d6, honestly interpreted." passed and stays.
- The engine can barely reach this death. `goInsane`'s face 1 halves hp, rounding up, so it can never kill; the only other outcomes are a teleport and a rage. The copy was still judged as written.
- The user rules on the tone in the review.

## Verification

- `node tools/voice-inventory.mjs --owner 79-06 --roll-under --hygiene --safety --count` printed `0`. Run with `--key bank:EPITAPHS` and with `--key bank:CAUSE_TEXT`, it also printed `0` both times.
- `node tools/voice-inventory.mjs --check-ledgers --plan 79-06 --after`: 3 ledger files, 0 errors.
- `node --test test/unit/death-copy.test.js test/unit/content-tables.test.js test/unit/pilfer-fumble.test.js test/voice/safety-scan.test.js`: all pass. `pilfer-fumble` and `safety-scan` are unedited.
- `node --test "test/parity/**/*.test.js"`: 66/66.
- `npm test`: **7,353 / 7,353 pass, 0 fail**. That is the 7,346 base plus the 7 new death-copy tests.
- `git diff --quiet d39625ee -- engine test/parity/fixtures test/parity/prototype-master.js.txt test/parity/harness content/leaderboards.js content/season.js` exits 0. The prototype hash `a1f4d0dc…` is unchanged.
- No bot or balance runs were made (user ruling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A unit golden hashed the death state's epitaph**
- **Found during:** Task 2's `npm test`.
- **Issue:** The `fatal-climb-s4` hash in `test/unit/fixtures/hazard-commit/golden.json` includes `state.epitaph`, and its rng pick is the rewritten `EPITAPHS.fall.3`.
- **Fix:** Proved that the epitaph was the only change (see above), re-pinned that one hash, and declared it under `### Plan 79-06` in `test/parity/FIXTURE-INVENTORY.md`, following the orchestrator's engine-gate instruction.
- **Files modified:** `test/unit/fixtures/hazard-commit/golden.json`, `test/parity/FIXTURE-INVENTORY.md`. Neither is in the plan's `files_modified`.
- **Commit:** `4b312cf8`

**2. Acceptance-criterion wording.** The plan asks for `git diff --quiet <base> -- engine test/parity …` to exit 0. The orchestrator requires the declaration in `test/parity/FIXTURE-INVENTORY.md`, so that one doc file differs. `engine/`, `test/parity/fixtures`, the harness and the prototype master are byte-identical to the base.

**3. Re-pins listed in the plan but not needed.** Only `boards-copy.test.js` pinned a changed line. `content-tables.test.js` pins `CAUSE_TEXT.combat`, which is unchanged. No `engineAdapter`, `boardsView`, `placement`, `account`, `missLines`, `newBest` or `scoreTag` test pinned a changed line. `test/unit/boardsPanel-dom.test.js` has the old scope line only as an input to a fake view, not as an assertion, so it was left alone. That file is 79-09's.

## Kept on purpose / Handed on

- **`CAUSE_TEXT.maze` ("spent by the dungeon itself")** is vague but passes. `tools/lib/band-readout.mjs#DOT_CAUSES` and `test/unit/band-readout.test.js` pin the trap, fall, gorge and maze causes and the "cut down by a" prefix as data, so any rewrite has to move them together. **Handed on to 79-12** in case it wants a plainer maze cause.
- **Unreachable buckets.** No engine `die()` call passes `poison`, `teleport` or `won`: poison ticks floor at 1 hp, teleport never kills, and there is no Gate exit. Their text is untouched. `EPITAPHS.won.3` ("all five floors") and `poison.2` ("two hp per square") would be inaccurate if the engine ever reached them. **Handed on to 79-12** for a decision on dead buckets.
- **TAG_CAUSES** (`scoreTag.js`) are append-only share-tag codes, not prose. Unchanged, as the plan's flagged assumption allows.

## Known Stubs

None.

## TDD Gate Compliance

RED `ad45372c` (test) → GREEN `6ab8f5df` (feat). No refactor commit was needed.

## Self-Check: PASSED

- FOUND: test/unit/death-copy.test.js, docs/narrative-pass/why/79-06.json, content/epitaphs.js, content/boards.js, content/placement.js, src/browser/missLines.js
- FOUND commits: ad45372c, 6ab8f5df, 4b312cf8, 136b30cc
