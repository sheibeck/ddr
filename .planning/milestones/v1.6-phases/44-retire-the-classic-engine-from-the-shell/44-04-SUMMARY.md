---
phase: 44-retire-the-classic-engine-from-the-shell
plan: 04
subsystem: infra
tags: [dead-code, shell, persistence, boot, orphan-sweep, closing-gates]

# Dependency graph
requires:
  - phase: 44-retire-the-classic-engine-from-the-shell (Plan 03)
    provides: "mazeworld.html at 6493 lines, engine gate diff empty, window.__mzTables bridge + DEAD-02 source pin (shell-no-content-copies.test.js), tools/shell-sweep.mjs reachability-aware refs/orphans"
provides:
  - "Classic run-save persistence (save()/load()/SAVE_KEY, the @gsd:dual-write-convergence-extract:save sentinel block) and the classic cold-boot character roll (newGame()/classicNewGame) retired — src/browser/engineAdapter.js#persist()/boot() is the one run-save path"
  - "window.__mzClassicBoot slimmed to renderGravesLoading -> loadGraves -> renderGraves -> fit -> paint (exactly 7 lines); the two 'Delve resumed.' Oracle lines re-homed in the module boot, gated on hadSaveAtLaunch"
  - "The five else-newGame()/classic fallbacks collapsed to single bridge calls; the module's now-callerless window.newGame = async function engineNewRun() override deleted"
  - "test/persistence/dual-write-convergence.test.js + harness/sandboxClassicPersistence.js: graves-only now (the save half retired with the classic save()/load() it extracted)"
  - "Fixed-point orphan sweep: D, reveal(), act(fn), newBeat(), say deleted (zero live references after this plan's own boot/persistence slimming removed their last callers)"
  - "Phase 44 closes: mazeworld.html 8710 -> 6356 lines (-2354, exceeds the -2000 target); all five ROADMAP success criteria verified; consolidated phase-wide deleted-symbol and test-reason lists"
affects: [45-collapse-the-phase-37-hedges, 46-honest-names-dead-exports-and-the-tutorial-decision, 47-shell-modularisation, 48-stale-docs-comments-and-test-names-purge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A false-positive name-collision pattern recurs at every layer of this phase: a classic top-level declaration and an unrelated block-scoped local in a completely different function/scope can share a bare identifier (bury/COMBAT_COPY.over.dead.bury in 44-02; reveal()/the roller screen's local `const reveal = document.getElementById(...)`; act(fn)/renderCombatOver's local `const act = document.createElement(...)` here). shell-sweep.mjs's refs/orphans are textual+BFS, not scope-aware, so every candidate must be resolved by hand (grep for the CALL form `name(`, not the bare identifier) before trusting a nonzero refs count as 'still live'."

key-files:
  created: []
  modified:
    - mazeworld.html
    - test/persistence/dual-write-convergence.test.js
    - test/persistence/harness/sandboxClassicPersistence.js
    - test/unit/shell-combat-over.test.js
    - test/unit/shell-input-guards.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/shell-map-store-polish.test.js
    - test/unit/shell-map-viewport.test.js

key-decisions:
  - "The module boot's resume banner uses the module's own bare `ROMAN` import (added 44-03), not window.__mzTables.ROMAN — matching the plan's phase_facts wording; the classic __mzClassicBoot's old resume line used window.__mzTables.ROMAN because it could not `import`, but the module can read its own import binding directly"
  - "reveal() and act(fn)/newBeat() were NOT deletable in Plan 44-04's Task 1 gate list (SAVE_KEY/save/load/newGame/classicNewGame only) but became genuinely dead as a SIDE EFFECT of Task 1's own edits (removing __mzClassicBoot's resume branch killed reveal()'s last caller; act()/newBeat() had already lost their last caller earlier in the phase and nothing surfaced it until this plan's fixed-point sweep actually ran refs on every orphans-advisory candidate) — both deleted in Task 2, completing A-1's reveal() escape hatch (restored in 44-02, finally removable here) and closing out an un-flagged act()/newBeat() dead pair"
  - "CAPTURE (let CAPTURE = null;) is NOT deleted despite act()/newBeat() (its only two writers) both being dead now — logLine() still has a live read (`if (CAPTURE) CAPTURE.push(html);`), so refs CAPTURE reports a genuine reference outside its own declaration. It is now permanently null (act/newBeat are gone) but that is a behavior nuance outside this plan's 'zero-reference declarations only' scope, not a bug this plan introduced or is chartered to fix"
  - "The two 'Delve resumed.' string literals were consolidated to exactly ONE occurrence in mazeworld.html (the live module boot's window.logLine call) by rewording two explanatory doc comments that had also quoted the literal banner text in quotes — the acceptance criterion's grep -c \"Delve resumed.\" mazeworld.html == 1 measures the STRING, so a doc comment quoting it verbatim would have failed the gate even though it was never a second code path"

patterns-established: []

requirements-completed: [DEAD-01, DEAD-03]

coverage:
  - id: D1
    description: "Classic run-save persistence (save/load/SAVE_KEY) and the classic cold-boot character roll (newGame/classicNewGame) retired; window.__mzClassicBoot slimmed to graves+fit+paint; the two resume Oracle lines re-homed in the module boot gated on hadSaveAtLaunch; the five else-newGame() fallbacks collapsed; the callerless window.newGame override deleted; dual-write-convergence test graves-only"
    requirement: DEAD-01
    verification:
      - kind: unit
        ref: "npm test (3243/3243, fail 0 after commit 0347df2); node --test test/persistence/*.test.js (44/44, fail 0); node --test test/unit/shell-map-invariants.test.js (38/38, fail 0)"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs SAVE_KEY save load newGame classicNewGame (all 0); grep -c \"Delve resumed.\" mazeworld.html = 1; sed -n over window.__mzClassicBoot's body = exactly 7 lines; npm run build:www; npm run boot:check (4 PASS); git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fixed-point orphan sweep: D, reveal(), act(fn), newBeat(), say deleted with their attached doc comments; every other orphans-advisory candidate (30 names) verified via refs to have a genuine live reference and left untouched; saveGraves kept by A-2 ruling"
    requirement: DEAD-01
    verification:
      - kind: unit
        ref: "npm test (3243/3243, fail 0 after commit 79d22bc)"
        status: pass
      - kind: other
        ref: "node tools/shell-sweep.mjs refs D reveal act newBeat say (all 0); node tools/shell-sweep.mjs orphans (30 remaining, every one individually verified live via refs, pasted below); npm run build:www; npm run boot:check (4 PASS); structural greps (GW/GH, eff, saveGraves, window.__mzState) all 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Closing gates — all five ROADMAP success criteria verified verbatim; mazeworld.html 8710 -> 6356 lines; consolidated phase-wide deleted-symbol and test-reason lists"
    requirement: DEAD-01
    verification:
      - kind: unit
        ref: "npm test (3243/3243, fail 0); node --test test/unit/shell-no-content-copies.test.js (5/5, fail 0); node --test test/unit/shell-map-invariants.test.js (38/38, fail 0)"
        status: pass
      - kind: other
        ref: "the 16-name mirror grep = 0; wc -l mazeworld.html = 6356 (<= 6710); grep -rl \"new Function\" test/ = empty; git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt = empty; git hash-object test/parity/prototype-master.js.txt matches git rev-parse ba45dfd:test/parity/prototype-master.js.txt; npm run build:www; npm run boot:check (4 PASS)"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-09-19
status: complete
---

# Phase 44 Plan 04: Retire the Classic Engine's Last Foothold + Closing Gates Summary

**Retired the classic script's run-save persistence and cold-boot character roll (the last live foothold of the dead engine), slimmed `window.__mzClassicBoot` to a 7-line graves+fit+paint sequence, re-homed the "Delve resumed." Oracle lines in the module boot, collapsed all five `else newGame()` fallbacks, deleted the module's now-callerless `window.newGame` override, ran a fixed-point orphan sweep (D/reveal/act/newBeat/say — 5 more zero-reference declarations), and closed the phase: `mazeworld.html` 8710 → 6356 lines (−2354), all five ROADMAP success criteria hold.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3
- **Files modified:** 8 (`mazeworld.html`, `test/persistence/dual-write-convergence.test.js`, `test/persistence/harness/sandboxClassicPersistence.js`, `test/unit/shell-combat-over.test.js`, `test/unit/shell-input-guards.test.js`, `test/unit/shell-map-rail.test.js`, `test/unit/shell-map-store-polish.test.js`, `test/unit/shell-map-viewport.test.js`)
- **Files created:** 1 (`.planning/phases/44-retire-the-classic-engine-from-the-shell/44-04-SUMMARY.md`, this file)

## Accomplishments

- Deleted classic `const SAVE_KEY`, the entire `@gsd:dual-write-convergence-extract:save` sentinel block (`save()`/`load()`), classic `function newGame()` and its `const classicNewGame = newGame;` capture.
- Collapsed the five `else newGame()`/classic fallbacks to their single bridge calls: `wireDeathConfirm` → `window.mzReturnToTitle();`; `btn-again` → `() => window.mzStartRoll()`; `btn-save-quit` → `window.mzAbandonRun();`; `btn-abandon-character` → `dead ? window.mzStartRoll() : window.mzAbandonCharacter()` (no `|| newGame()` anywhere).
- Slimmed `window.__mzClassicBoot` to exactly `renderGravesLoading(); await loadGraves(); renderGraves(); fit(); paint();` — no more classic load/resume/no-save-roll branch.
- Re-homed the two "Delve resumed." Oracle lines in the module boot path, immediately after `window.__mzState.set(engineState)` and gated on `hadSaveAtLaunch`, using the module's own bare `ROMAN` import.
- Deleted the module's now-callerless `window.newGame = async function engineNewRun() {...}` override and its RUN-05 doc comment (zero non-comment callers verified before deletion).
- `test/persistence/dual-write-convergence.test.js` dropped its two classic `save()`/`load()` cases; `sandboxClassicPersistence.js` now extracts the graves sentinel block only (the `saveBlock` extraction and `SAVE_KEY` sandbox global are gone).
- Re-pointed the `"window.newGame = "` region-end anchor to `"window.mzDevStartAtDepth = "` in three shell test files (same start anchors).
- Fixed-point orphan sweep (Task 2): `D`, `reveal()`, `act(fn)`, `newBeat()`, `say` deleted with their attached doc comments — every one confirmed to have zero live references (via `refs`) once Task 1's edits removed their last callers. 30 other orphans-advisory candidates individually verified live and left untouched; `saveGraves` kept by the standing A-2 ruling.
- Closing gates (Task 3): all five ROADMAP success criteria verified verbatim (below); `mazeworld.html` at 6356 lines, well under the ≤6710 target.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire classic persistence + the cold-boot classic roll — slim __mzClassicBoot, re-home the resume lines, delete the five fallbacks and the callerless window.newGame; graves-only dual-write test** - `0347df2` (refactor)
2. **Task 2: Fixed-point orphan sweep — every classic declaration with zero references goes, with its attached comments; nothing live is touched** - `79d22bc` (refactor)
3. **Task 3: Closing gates — ROADMAP success criteria 1–5 verbatim, the phase-wide consolidated lists, and the deferred human-verification list** - (this commit)

**Plan metadata:** (this commit)

## Files Created/Modified

- `mazeworld.html` — classic persistence + cold-boot roll retired; `__mzClassicBoot` slimmed to 7 lines; resume banner re-homed in module boot; five fallbacks collapsed; callerless `window.newGame` override deleted; `D`/`reveal()`/`act(fn)`/`newBeat()`/`say` deleted (fixed-point sweep); 8710 → 6356 lines total across this plan's two code commits
- `test/persistence/dual-write-convergence.test.js` — the two classic `save()`/`load()` cases deleted; header comment rewritten
- `test/persistence/harness/sandboxClassicPersistence.js` — graves-only extraction; `saveBlock`/`SAVE_KEY` sandbox global removed; header + JSDoc rewritten
- `test/unit/shell-combat-over.test.js`, `test/unit/shell-input-guards.test.js`, `test/unit/shell-map-rail.test.js` — region end anchor `"window.newGame = "` → `"window.mzDevStartAtDepth = "`
- `test/unit/shell-map-store-polish.test.js`, `test/unit/shell-map-viewport.test.js` — `mzCenterMap` call-site count assertion `5` → `4` (Rule 1 fix; the deleted `engineNewRun`'s own `window.mzCenterMap?.();` call site was one of the five)

## Decisions Made

See `key-decisions` in the frontmatter above — the `ROMAN` import choice, the reveal()/act()/newBeat() "became dead as a side effect" finding, the `CAPTURE` non-deletion rationale, and the "Delve resumed." doc-comment dedup are the load-bearing ones.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two test files' `mzCenterMap` call-site-count assertions broke when the callerless `window.newGame`/`engineNewRun` override (with its own `window.mzCenterMap?.();` call) was deleted**
- **Found during:** Task 1's post-edit `npm test` run — 2 failures: `shell-map-store-polish.test.js`'s "mzCenterMap call-site count is 5..." and `shell-map-viewport.test.js`'s "(f) camera call sites: mzCenterMap stays at 5...". Neither file was in Task 1's declared `<files>` list.
- **Issue:** Both tests hard-coded the literal count `5` for `window.mzCenterMap?.()` call sites ("boot, 3 new-run paths, stepWith's floorChanged/teleported branch"). Deleting the callerless `engineNewRun` override (required by the plan's own action) removed one of those "3 new-run paths," dropping the true count to 4.
- **Fix:** Updated both assertions to `4` and reworded the test names/comments to explain the drop (2 new-run paths remain: `mzDevStartAtDepth`, `commitRolledState`) and cite Phase 44 as the reason.
- **Files modified:** `test/unit/shell-map-store-polish.test.js`, `test/unit/shell-map-viewport.test.js`
- **Verification:** `npm test` returned to 3243/3243, fail 0.
- **Committed in:** `0347df2` (Task 1 commit)

**2. [Rule 1 - Bug] Two of my own newly-written doc comments quoted the literal "Delve resumed." banner text, breaking the `grep -c "Delve resumed." mazeworld.html == 1` acceptance gate**
- **Found during:** Task 1, running the acceptance-criteria greps immediately after writing the resume-banner code and its explanatory comments — the grep counted 3 (the one real code occurrence plus two doc comments that had quoted the banner text in quotes for clarity).
- **Fix:** Reworded both comments to describe "the resume banner" / "resume-banner Oracle lines" without quoting the literal string.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -c "Delve resumed." mazeworld.html` → `1`.
- **Committed in:** `0347df2` (Task 1 commit)

**3. [Rule 1 - Bug, tooling-verification only] `reveal()` and `act(fn)`/`newBeat()` were dead code the plan's own gate list (Task 1: `SAVE_KEY save load newGame classicNewGame`) never checked, and the orphans-advisory list flagged as candidates without the plan pre-naming them**
- **Found during:** Task 2's fixed-point sweep — running `refs` on every orphans-advisory candidate (not just the plan's own named examples) surfaced `reveal()` (its last caller, `__mzClassicBoot`'s resume branch, was deleted in Task 1) and `act(fn)`/`newBeat()` (no live caller found anywhere in the file via a `\bname\(` grep — apparently already dead before this plan, never previously surfaced by an orphans/refs run because `act`'s BFS root status depended on chains this deep).
- **Fix:** Deleted all three (`reveal()`, `act(fn)`, `newBeat()`) with their attached doc comments, plus `say` (alias of `logLine`, also zero live callers) and `D` (the plan's own action text named it, but it lived in the classic script's top-level `const` line, requiring a one-line edit distinct from the larger blocks).
- **Files modified:** `mazeworld.html`
- **Verification:** `node tools/shell-sweep.mjs refs D reveal act newBeat say` → all `0`; `npm run build:www`; `npm run boot:check` (4 PASS); `npm test` (3243/3243, fail 0).
- **Committed in:** `79d22bc` (Task 2 commit)

**4. [Rule 1 - Bug] My own new doc comment in the Task 1 diff quoted `classicNewGame` literally, which the Task 3 closing-gate check `grep -rn "classicNewGame|__mzCanCast|dual-write-convergence-extract:save" mazeworld.html test/ src/` would otherwise have flagged as "still present"**
- **Found during:** Task 3, running the closing-gate greps from the plan's own action narrative.
- **Fix:** Reworded the comment to describe "the classic newGame() and its captured-at-parse-time reference" instead of the literal identifier `classicNewGame`.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -rn "classicNewGame\|__mzCanCast\|dual-write-convergence-extract:save" mazeworld.html test/ src/` now shows only two PRE-EXISTING, out-of-scope doc mentions: a Plan-44-01-era `__mzCanCast` bridge-pattern reference inside a different, surviving bridge's comment (Phase 48 DOCS-01 scope, not touched), and this plan's own `sandboxClassicPersistence.js` doc comment historically naming the now-deleted sentinel marker (legitimate documentation of what was removed, not a live reference).
- **Committed in:** (this commit, Task 3)

---

**Total deviations:** 4 auto-fixed (all Rule 1 bugs — two test-pin re-points the plan's own required deletions broke in files outside the declared list, one comment-quoting self-collision against the plan's own literal-count acceptance gate, one genuine additional dead-code find surfaced only by exhaustively `refs`-checking every orphans-advisory candidate rather than trusting the plan's named examples).
**Impact on plan:** All fixes were necessary for the gates (`npm test` fail 0, the literal grep counts) to hold at every commit boundary. No scope creep beyond test-pin re-points and doc-comment wording; `mazeworld.html`'s actual deletion set is a superset of the plan's named list (the plan named `D`, `reveal`, `act`, `newBeat` implicitly via "decide by `refs`, not by this list" — this plan's own fixed-point process is exactly what surfaced and confirmed all five names, including `say`, which no prior document had named).

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None — this plan only deletes dead code, re-homes two existing Oracle log lines verbatim, and re-points/deletes test pins; no new UI surface or data flow was introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. This plan strictly deletes unreachable classic-script persistence/boot code and its accompanying tests, and re-homes two existing player-facing log lines to a different call site with byte-identical text.

## All deleted symbols (this plan)

All line ranges are `ba45dfd` (phase-start baseline) numbers; every deletion was located and verified by declaration text, not by these numbers (mazeworld.html has shifted substantially since baseline).

| Symbol | ba45dfd range | Notes |
|---|---|---|
| `SAVE_KEY` (classic) | L1792 | the classic run-save key literal; `src/browser/engineAdapter.js`'s own `SAVE_KEY` (same literal value, separate declaration) is untouched and is now the only one |
| `save()`, `load()` (classic) | L6725–6739, plus the `@gsd:dual-write-convergence-extract:save` sentinel markers and 02-03 doc comment L6713–6740 | the classic run-save read/write pair |
| `newGame()` (classic) | L6743–6751 | the classic cold-boot character roll |
| `classicNewGame` (captured reference) | L6759 | captured-at-parse-time alias of classic `newGame()`, used only by `__mzClassicBoot`'s now-deleted resume-fallback branch |
| `window.newGame = async function engineNewRun()` (module override) | L8005–8040 (with its RUN-05 doc comment) | zero non-comment callers verified before deletion (`grep -nE "(^|[^.A-Za-z_])newGame\(" mazeworld.html` and `grep -rn "newGame" src/ tools/` showed only comments) |
| `D` (die roller) | ~L1793 (pre-plan numbering) | its last classic readers (`WEAPONS`/`CLASSES` closures) were already deleted in Plan 44-02; genuinely zero references this plan |
| `reveal()` | L1921–1945 (plus the A-1 kept-with-live-reference doc comment 44-02 added) | its one live caller, `window.__mzClassicBoot`'s resume branch, was deleted in this plan's Task 1 — the A-1 escape hatch that restored it in 44-02 is now closed |
| `act(fn)` | ~L2081–2099 (post-44-03 numbering) | with its attached doc comment; zero live callers found (`renderCombatOver`'s local `const act = document.createElement(...)` is an unrelated same-named DOM-element binding, not a call to this function) |
| `newBeat(title, tone)` | ~L2073–2077 | with its attached doc comment; its only caller was `act(fn)`'s own body, itself dead |
| `say` (alias of `logLine`) | ~L2110 | zero live callers; only a comment ("say()/evt() call site") survives, in a CSS-section doc comment about a different, still-live rule — left untouched per Phase 48 DOCS-01 scope |

## Tests re-pointed or deleted (this plan)

| File | Change | Reason |
|---|---|---|
| `test/persistence/dual-write-convergence.test.js` | deleted the "mazeworld.html's OWN extracted save()/load() functions..." and "dual-write convergence: engineAdapter's write and the classic script's write..." cases; header comment rewritten | the classic `save()`/`load()` these cases extracted and exercised no longer exist; `engineAdapter.js`'s persist()/boot() run-save path is already covered by this file's first two (kept) cases and by `test/unit/engineAdapter.test.js` |
| `test/persistence/harness/sandboxClassicPersistence.js` | `saveBlock` extraction + `SAVE_KEY` sandbox global removed; graves-only now; header + JSDoc rewritten | the `@gsd:dual-write-convergence-extract:save` sentinel block it extracted is gone; the graves sentinel block (LIVE) is the only remaining extraction target |
| `test/unit/shell-combat-over.test.js` | region end anchor `"window.newGame = "` → `"window.mzDevStartAtDepth = "` | `window.newGame`'s declaration is gone; `window.mzDevStartAtDepth`'s override is the next surviving module-level assignment after the region's content |
| `test/unit/shell-input-guards.test.js` | same anchor change | same |
| `test/unit/shell-map-rail.test.js` | same anchor change | same |
| `test/unit/shell-map-store-polish.test.js` | `mzCenterMap` call-site count `5` → `4` (Rule 1 fix, not in the plan's declared file list) | the deleted `window.newGame`/`engineNewRun` override's own `window.mzCenterMap?.();` call site was one of the five the test counted |
| `test/unit/shell-map-viewport.test.js` | same count change (Rule 1 fix, not in the plan's declared file list) | same |

## All deleted symbols (phase total)

Union of all four plans' deleted-symbol lists. All line ranges are `ba45dfd` (phase-start baseline, 8,710 lines) numbers as recorded by each plan's own SUMMARY; every deletion across the phase was located and verified by declaration text, not by these numbers.

### Plan 44-01 (commit `1f4ef1f`) — layer 1: the 16 pre-extraction mirrors + combat-cluster helpers (32 names)

| Symbol | Range | | Symbol | Range |
|---|---|---|---|---|
| classic `canCast(sp)` wrapper | L2189–2198 | | `killFoe` | L4710–4743 |
| `rollCharacter` | L2359–2429 | | `checkLevel` | L4745–4781 |
| `genFloor` | L2485–2566 | | `castSpell` | L4783–4980 |
| `makeCamp` | L3771–3794 | | `drinkPotion` | L4982–4992 |
| `descend` | L3855–3865 | | `flee` | L4994–5009 |
| `takeItem` | L3948–3974 | | `TALKATIVE` | L5012 |
| `itemReady` | L3976–3981 | | `fluency` | L5013–5023 |
| `useItem` | L3982–4014 | | `canParley` | L5024–5044 |
| `openStore` | L4260–4323 | | `parley` | L5045–5064 |
| `meetJoiner` | L4471–4478 | | `SONGS` | L5066–5072 |
| `startCombat` | L4518–4605 | | `songReady` | L5073–5075 |
| `rollInitiative` | L4607–4617 | | `sing` | L5076–5100 |
| `liveFoes` | L4619 | | `readScroll` | L5106–5124 |
| `playerStrike` | L4621–4708 | | `endCombat` | L5126–5133 |
| `afterPlayerAction` | L5135–5151 | | `allyTurn` | L5153–5165 |
| `foeTurn` | L5167–5232 | | `window.__mzCanCast` (module bridge) | ~L7371–7377 |

### Plan 44-02 (commits `c2aaeb4` layer 2, `32372e3` layer 3) — the classic movement/encounter engine + orphaned tables/helpers (95 names, `move` counted once)

**Layer 2 (41 names):** `reveal` (restored per A-1 — see below), `beginEvent`, `evt`, `EPITAPHS`, `epitaphFor`, the movement banner + `DIRV`, `OPP`, `move`, `newDay`, `teleport`, `bestTeleportDir`, `winGame`, `giveItem`, `LOOT_DIVISOR`, `gainWilmst`, `hasPicks`, `rollJewel`, `rollCloak`, `rollStaff`, `rollBlade`, `rollMailPiece`, `rollTreasureItem`, `springTrap`, `openChest`, `encounterDot`, `tableFour`, `findFood`, `findGrimoire`, `findGear`, `findMisc`, `meetFaerie`, `catchAffliction`, `goInsane`, `newPhobia`, `fallDark`, `CAUSE_TEXT`, `die`, `epitaphCtx`, `bury`, `vitalsStrip`.

**Layer 3 (54 names):** `pick`, `STRIKE_DICE`, `CLASSES` (classic top-level const; the module's own `import` of the same name is a different, surviving binding), `WEAPON_MAX`, `WEAPON_TYPE_TABLE`, `WEAPON_BONUS_TABLE`, `ARMORS`, `MAGIC_ARMOR_TABLE`, `priceFor`, `KIT`, `FREE_SKILL`, `rollSkills`, `skillTier`, `BLADE_NAMES`, `JEWELRY`, `CLOAKS`, `STAVES`, `POTIONS`, `FOODS`, `TRAPS`, `AFFLICTIONS`, `FAERIE`, `MISC_MAGIC`, `SPELL_LEVEL_TABLE`, `CLIMB_TABLE`, `LEAP_TABLE`, `DIRECTION_TABLE`, `RACE_D8`, `TEMPERAMENTS`, `MOTIVES`, `PHOBIAS`, `BESTIARY`, `ENC_TYPES`, `ENCOUNTER_TABLES`, `ENC_ALIAS`, `SPELLS`, `MU_CHART`, `schoolAllowed`, `schoolGate`, `schoolBonus`, `canLearn`, `rollGrimoire`, `INSANITY`, `NAMES`, `nameFor`, `bfs`, `shuffle`, `strikeDie` (classic — the module's own imported engine `strikeDie` is a different, surviving binding), `toHit` (classic — same note), `inDark`, `climbBonus`, `leapBonus`, `foeDie`, `foeToHitVs`, `weaponDamage`, `levelFromSP`.

### Plan 44-03 (commit `20b818a`) — the nine classic table copies bridged from `content/` via `window.__mzTables` (9 names)

`THRESHOLDS`, `ROMAN`, `WEAPONS`, `FIGHTER_SKILLS`, `THIEF_SKILLS`, `RACES`, `RACE_NOTE`, `CLASS_NOTE`, `SUB_NOTE`.

### Plan 44-04 (commits `0347df2`, `79d22bc`) — this plan (11 names)

`SAVE_KEY`, `save()`, `load()`, `newGame()` (classic), `classicNewGame`, `window.newGame = async function engineNewRun()` (module override), `D`, `reveal()`, `act(fn)`, `newBeat()`, `say`.

**Phase total: 147 deleted classic-script declarations** (32 + 95 + 9 + 11) across four plans, plus the two retired `new Function` extraction test files (`parley-button-mirror.test.js`, `spell-menu-mirror.test.js`, Plan 44-01).

## All tests re-pointed or deleted (phase total)

### Plan 44-01

| File | Change | Reason |
|---|---|---|
| `test/unit/parley-button-mirror.test.js` | deleted | its 504-case classic-vs-engine replay now runs engine-vs-prose-oracle in `parley.test.js` |
| `test/unit/spell-menu-mirror.test.js` | deleted | the engine `canCast` it guarded is pinned cell-for-cell by `spell-level-overrides.test.js` |
| `test/unit/parley.test.js` | re-pointed | 4 → 7 subs, 288 → 504 cases; `expectedCanParley` extended with IDENT-05/06 |
| `test/unit/shell-fight-gate.test.js` | case deleted | the `__mzCanCast` bridge and classic `canCast(sp)` wrapper are gone |
| `test/unit/shell-gear-39.test.js`, `shell-loot-screen.test.js`, `shell-worn-slots.test.js` | import-line regex re-pinned | dropped `canCast, ` from the `engine/derived.js` import-line pin |
| `test/unit/shell-armor-display.test.js` | region anchor moved | `renderCarriedListRegion`'s end anchor `function openStore()` → `function canRead()` |

### Plan 44-02

| File | Change | Reason |
|---|---|---|
| `shell-combat-actions.test.js`, `shell-combat-screen.test.js`, `shell-fight-log.test.js`, `shell-input-guards.test.js`, `shell-loot-screen.test.js` | end anchor `"function vitalsStrip()"` → `"function wireDeathConfirm()"` | `vitalsStrip` deleted; `wireDeathConfirm` is the next surviving declaration |
| `shell-party-camp.test.js` | `paintRegion` end anchor `"\nfunction move(dir)"` → `"\nfunction eff(key)"` | classic `move(dir)` deleted |
| `shell-map-viewport.test.js` | keydown pin `move(dirKeys[k])` → `window.move(dirKeys[k])` (Rule 1) | the required bridge rewrite broke this pre-existing pin |
| `shell-armor-display.test.js` | ARMOR-04 CLOAKS txt-mirror case + its `import { CLOAKS }` deleted | classic `CLOAKS` gone; `content/treasure-tables.js` is the single source |
| `shell-company-panel.test.js` | `subNoteRegion()` end anchor `"const NAMES = {"` → the rendering-section banner (Rule 1) | `NAMES`/`nameFor` deleted |

### Plan 44-03

| File | Change | Reason |
|---|---|---|
| `test/unit/shell-company-panel.test.js` | deleted the SUB_NOTE Cutthroat-row byte-equality case + `subNoteRegion()` helper; dropped `import { SUB_NOTE }`; reworded doc comment | the classic `SUB_NOTE` table is gone; the new source-pin test proves a strictly stronger 24/6/3 byte-equality property |
| `test/unit/shell-no-content-copies.test.js` | added (5 tests) | the DEAD-02 source pin — no second copy of any `content/` export, 24/6/3 byte-equality, fail-first proven |

### Plan 44-04 (this plan)

See "Tests re-pointed or deleted (this plan)" above (7 files: 2 persistence files rewritten, 3 region-anchor swaps, 2 call-site-count fixes).

## Kept by ruling / kept with live reference

| Symbol | Status | Reason |
|---|---|---|
| `saveGraves()` | Kept, by ruling (A-2) | its last classic caller, `bury()`, was deleted in Plan 44-02; the graves sentinel block is untouched by CONTEXT.md ruling and the harness still exercises `saveGraves()` directly |
| `eff(key)`'s legacy sum-over-`c.items` fallback loop | Kept, out of phase scope (A-5) | Phase 45 (HEDGE-01..03) collapses this dual path, not this phase |
| `CAPTURE` | Kept, genuine live reference | `logLine()`'s `if (CAPTURE) CAPTURE.push(html);` is a live read (logLine is called from dozens of reachable sites); its only two writers (`act`/`newBeat`) are now both deleted, so it is permanently `null`, but that is a behavior nuance outside this plan's zero-reference-declaration scope |
| `strikeDie`, `toHit` (classic top-level, now gone) vs. the module's own imported `engine/derived.js` bindings of the same names | Not a conflict | the module's `import { ..., toHit, strikeDie, ... } from "./engine/derived.js"` line and `window.__mzStrikeDie`/`window.__mzToHit` bridge assignments are a DIFFERENT, surviving binding — deleted in 44-02 layer 3, unaffected |
| `CLASSES` (classic top-level, now gone) vs. the module's own `import { RACES, CLASSES, BAGS, ABILITY_BY_ID }` | Not a conflict | same pattern — deleted in 44-02 layer 3, unaffected |
| `cv`, `ctx`, `GW`/`GH`, `ZOOM_MIN`/`ZOOM_MAX`, `CANVAS_PAD`, `logEl`, `CONDITION_COPY`, `MAP_COPY`, `STORE_ROLL_COPY`, `FOE_EFFECT_LABEL`, `CONDITION_TONE`, `CONDITION_EXPLAIN`, `lastCondKeyShown`, `GRAVE_KEY`, `GRAVE_TOTAL_KEY`, `gravesLoadError`, `encRenderedAt`, `armTimer`, `lastDismissAt`, `encWasActive`, `lastLogSeqShown`, `fightLogAnnouncedSeq`, `DISMISS_CONFIRM_MS`, `dismissConfirmRevert`, `FEATURE_ICON_PATH`, `COMBAT_DISPATCH`, `lastRailKeyShown`, `railTimer` (this plan's remaining 27 orphans-advisory candidates) | Kept, all individually verified live | every one showed a genuine `refs` hit outside its own declaration when checked this plan's Task 2 — see `node tools/shell-sweep.mjs orphans` output below |

### `node tools/shell-sweep.mjs orphans` — final Phase 44 output (after Task 2's commit)

```
ADVISORY — reachability estimate only. Not a gate. Verify every name via `refs` before deleting.
30 orphaned of 108 classic top-level declarations:
cv, ctx, GW, ZOOM_MIN, CANVAS_PAD, CAPTURE, logEl, CONDITION_COPY, MAP_COPY,
STORE_ROLL_COPY, FOE_EFFECT_LABEL, CONDITION_TONE, CONDITION_EXPLAIN,
lastCondKeyShown, GRAVE_KEY, GRAVE_TOTAL_KEY, gravesLoadError, saveGraves,
encRenderedAt, armTimer, lastDismissAt, encWasActive, lastLogSeqShown,
fightLogAnnouncedSeq, DISMISS_CONFIRM_MS, dismissConfirmRevert,
FEATURE_ICON_PATH, COMBAT_DISPATCH, lastRailKeyShown, railTimer
```

All 30 verified live via `refs` (real usage beyond the declaration itself) except `saveGraves` (kept by A-2 ruling regardless of its own zero-external-refs count). This is the fixed point: no further classic declaration in `mazeworld.html` reports zero live references.

## Deliberate behaviour differences

- **A dead/won save no longer prints a resume banner.** The classic `load()` used to "resume" and print the banner for ANY save it could parse, including one belonging to a run that had already ended (dead/won). The module's `hadSaveAtLaunch` gate is deliberately stricter (`!parsed.dead && !parsed.won`) — a dead/won save has nothing left to resume into, so ENTER now opens the roller instead. This was already the module's behavior before this plan (documented in 44-CONTEXT.md's phase_facts); this plan's change is only WHERE the two resume lines live, not this gating rule.
- **The Hero-tab dossier, weapon stats, and Fighter/Thief skill lists read `content/`'s current values, not the classic script's drifted copies** (Plan 44-03) — six of the nine bridged tables had measurable drift (documented in 44-03-SUMMARY.md's "Drift discarded" table); this plan did not touch those tables further.

## Success criteria

The five ROADMAP Phase 44 success criteria, verified verbatim at the Task 3 closing-gate commit:

1. **16-name mirror grep = 0, shell parses and boots:**
   ```
   grep -cE "^\s*function (castSpell|parley|startCombat|meetJoiner|genFloor|rollCharacter|descend|makeCamp|takeItem|useItem|playerStrike|foeTurn|killFoe|openStore|readScroll|drinkPotion)\s*\(" mazeworld.html
   → 0
   npm run build:www → exit 0
   npm run boot:check → PASS no-uncaught / PASS painted / PASS graves / PASS title
   ```
2. **`wc -l mazeworld.html` at least 2,000 lines below the phase-start count:**
   ```
   wc -l < mazeworld.html → 6356  (phase-start ba45dfd baseline: 8710; delta -2354, exceeds the -2000 target and the ≤6710 phase-level target)
   ```
3. **Hero-tab dossier byte-equal to `content/flavor.js`; source-pin test guards it (delivered by Plan 44-03, re-verified this plan):**
   ```
   node --test test/unit/shell-no-content-copies.test.js → # pass 5, # fail 0
   ```
4. **Zero `new Function` extraction tripwires; full suite + shell-map-invariants stay green:**
   ```
   grep -rl "new Function" test/ → (empty)
   node --test test/unit/shell-map-invariants.test.js → 38/38, # fail 0
   npm test → 3243/3243, # fail 0
   ```
   Test-count reconciliation vs. the `ba45dfd` baseline (3,257, per `44-CONTEXT.md`'s measured phase-start, more precise than ROADMAP's stale "3,200"):
   | Plan | Delta | Running total | Reason |
   |---|---|---|---|
   | baseline (`ba45dfd`) | — | 3257 | |
   | 44-01 | -6, -8, -1 | 3242 | parley-button-mirror.test.js (-6) + spell-menu-mirror.test.js (-8) retired; shell-fight-gate's `__mzCanCast` case (-1) |
   | 44-02 | -1 | 3241 | ARMOR-04 CLOAKS txt-mirror case deleted |
   | 44-03 | -1, +5 | 3245 | SUB_NOTE Cutthroat case deleted (-1); shell-no-content-copies.test.js added (+5) |
   | 44-04 | -2 | 3243 | the two classic save()/load() dual-write-convergence cases deleted |
5. **Engine gate: zero bytes changed under `engine/`, `content/`, `test/parity/fixtures/`, `test/parity/prototype-master.js.txt` since phase-start:**
   ```
   git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt → (empty)
   git hash-object test/parity/prototype-master.js.txt → a1f4d0dc29782218d8e5aab65bc5989c33f917f0
   git rev-parse ba45dfd:test/parity/prototype-master.js.txt → a1f4d0dc29782218d8e5aab65bc5989c33f917f0  (identical)
   ```

**All five criteria hold.**

## Gate outputs

**At Task 1's commit boundary (`0347df2`):**
- `node tools/shell-sweep.mjs refs SAVE_KEY save load newGame classicNewGame` — all `0`.
- `grep -c "Delve resumed." mazeworld.html` → `1`; `grep -c "dual-write-convergence-extract:save" mazeworld.html` → `0`; same in `sandboxClassicPersistence.js` (a historical doc mention only, not a live sentinel marker).
- `sed -n` over `window.__mzClassicBoot`'s body — exactly 7 lines (header, `renderGravesLoading();`, `await loadGraves();`, `renderGraves();`, `fit();`, `paint();`, `};`).
- `grep -cE "else newGame\(\)|: newGame\(\)|window\.newGame = " mazeworld.html` → `0`; `window.mzReturnToTitle();`/`() => window.mzStartRoll()`/`window.mzAbandonRun();`/`window.mzAbandonCharacter();` each ≥ `1`.
- `grep -c "classic.save()" test/persistence/dual-write-convergence.test.js` → `0`; `grep -c "saveBlock" test/persistence/harness/sandboxClassicPersistence.js` → `0`; `grep -c '"window.mzDevStartAtDepth = "'` → `1` for each of the three anchor files; `grep -c '"window.newGame = "' test/unit/*.test.js` → `0` everywhere.
- `npm run build:www` — exit 0. `npm run boot:check` — 4 `PASS`. `npm test` — 3243/3243, fail 0 (after the two Rule-1 camera-count fixes). `node --test test/persistence/*.test.js` — 44/44, fail 0. `node --test test/unit/shell-map-invariants.test.js` — 38/38, fail 0.
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt src/browser/engineAdapter.js src/browser/storage.js` — empty.

**At Task 2's commit boundary (`79d22bc`):**
- `node tools/shell-sweep.mjs refs D reveal act newBeat say` — all `0`.
- `node tools/shell-sweep.mjs orphans` — 30 remaining, every one verified live via `refs` (see table above).
- `grep -cE "^const GW = 21, GH = 21;"` → `1`; `grep -cE "^function eff\(key\)"` → `1`; `grep -c "async function saveGraves()"` → `1`; `grep -c "window.__mzState = { get: () => S, set: (v) => { S = v; } };"` → `1`.
- `npm run build:www` — exit 0. `npm run boot:check` — 4 `PASS`. `npm test` — 3243/3243, fail 0.
- `wc -l < mazeworld.html` — `6355` (before Task 3's one comment-wording fix), `6356` after.
- `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` — empty.

**At Task 3's commit boundary (this commit):**
- All five ROADMAP success criteria verified verbatim (above).
- `git status --porcelain` — empty after this commit.
- `grep -rn "classicNewGame\|__mzCanCast\|dual-write-convergence-extract:save" mazeworld.html test/ src/` — two PRE-EXISTING, out-of-scope doc mentions remain (Plan-44-01-era `__mzCanCast` comment in surviving code, and this plan's own historical doc note in `sandboxClassicPersistence.js`) — neither is a live code reference; see Deviation 4.

## Human verification (deferred to end of run)

Per the deferred-UAT protocol, batched to the milestone-close Pixel 7 round — consolidated across all four Phase 44 plans:

- **Cold boot, no save:** launch → title screen → ENTER → roller → map. No classic roll runs behind the title (the classic cold-boot character roll is fully retired this plan).
- **Resume:** force-stop + relaunch with a live (not dead/won) save → title → ENTER resumes directly into the map, and the Oracle's newest entries show "Delve resumed." followed by the "{name}, {race} {sub}, skill level {roman numeral}, on floor {depth} of the dungeon." line (now emitted from the module boot, not the classic script — text should be indistinguishable from before this plan).
- **Death:** dying still buries the character (graves path untouched all four plans); the death card's CONFIRM returns to the title screen (`window.mzReturnToTitle()`, no classic fallback).
- **Save & quit / Abandon character:** both buttons work with no dead-end — "Save & quit" returns to the title (resumable); "Abandon this character" while alive buries the current character and starts fresh; while already dead, the same button rerolls instead (it's relabeled "New Character" by `paint()`).
- **The Hero-tab dossier** for a Thief, a Fighter, and a Magic User reads correctly (Plan 44-03's `content/flavor.js`-sourced text — the flee-after-first-blow clause for Cloaker, the large-monsters-come-straight-at-you clause for Knight, etc., not the older classic prose).
- **MAKE CAMP → SLEEP** still camps through the engine (single `window.mzMakeCamp()` call, no classic fallback — Plan 44-02).
- **Tap-to-move and keyboard arrows** still step the party through the maze (`window.move` bridge — Plan 44-02).
- **A fight** reached through SPELLS / PARLEY / SING / USE / DRINK / READ still resolves through the engine (Plan 44-01's bridge cleanup).
- **A weapon's worn-slot display (GEAR tab)** shows current `content/weapons.js` values (e.g. Bastard Sword `2d8+1`, not the classic `2d6` — Plan 44-03).

## Flagged assumptions

- **A-1** (per-layer name lists are the planner's reachability estimate, decided by `refs`): **held across the whole phase; escape hatch exercised twice on the same name.** `reveal()` was restored in Plan 44-02 (its live caller was `__mzClassicBoot`'s resume branch) and finally, genuinely deleted in this plan's Task 2 once Task 1 removed that caller. No other name across any of the four plans required restoration after its scheduled deletion.
- **A-2** (`saveGraves()`/the graves sentinel block): **held, unaffected, final.** The graves sentinel block was never touched across all four plans; `saveGraves()` is kept by ruling despite reporting zero external `refs` (its last caller, `bury()`, was deleted in Plan 44-02) — the harness still exercises it directly.
- **A-3** (`newBeat`/`CAPTURE` survival after Plan 44-02's layer 2): **resolved differently per name, final.** `CAPTURE` remains live (a genuine read in `logLine()`). `newBeat()` — recorded as "kept" in Plan 44-02 because its call inside `act()`'s body still counted at that time — became genuinely dead once `act()` itself lost its own last live caller (found only by this plan's exhaustive fixed-point sweep) and was deleted this plan.
- **A-4** (the classic `D` die helper should have no live readers after Plan 44-03): **held, resolved this plan.** `D`'s last classic readers (`WEAPONS`/`CLASSES` closures) were deleted in Plan 44-02; `refs D` reported `0` this plan's Task 2, and it was deleted.
- **A-5** (the classic `eff(key)`'s legacy sum-over-`c.items` fallback loop): **held, deferred, unresolved by design.** Untouched across all four plans; Phase 45 (HEDGE-01..03) is the plan that collapses this dual path.

## Next Phase Readiness

- `mazeworld.html` is at 6356 lines (phase-start 8710, delta -2354), `# fail 0` at 3243 tests, engine gate diff empty, `grep -rl "new Function" test/` empty, `tools/shell-sweep.mjs orphans` at its fixed point. Phase 44 (DEAD-01/02/03) is complete — all five ROADMAP success criteria hold.
- Ready for Phase 45 (HEDGE-01..03 — collapsing the Phase 37 hedges, starting with `eff()`'s A-5 legacy loop) per the v1.6 phase order in STATE.md.
- No blockers.

## Self-Check: PASSED

- FOUND: `mazeworld.html` (6356 lines, confirmed via `wc -l`)
- FOUND commit: `0347df2`
- FOUND commit: `79d22bc`
- CONFIRMED: `npm test` = 3243/3243, fail 0
- CONFIRMED: `node --test test/unit/shell-no-content-copies.test.js` = 5/5, fail 0
- CONFIRMED: `node --test test/unit/shell-map-invariants.test.js` = 38/38, fail 0
- CONFIRMED: `grep -rl "new Function" test/` = empty
- CONFIRMED: `git diff --stat ba45dfd -- engine/ content/ test/parity/fixtures/ test/parity/prototype-master.js.txt` = empty
- CONFIRMED: `git hash-object test/parity/prototype-master.js.txt` matches `git rev-parse ba45dfd:test/parity/prototype-master.js.txt`

---
*Phase: 44-retire-the-classic-engine-from-the-shell*
*Completed: 2026-09-19*
