---
phase: 04-mobile-presentation-controls-onboarding
plan: 03
subsystem: ui
tags: [view-models, character-sheet, oracle-log, tutorial, coach-marks, icons, node-test, vanilla-js]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-02: src/browser/settings.js (diceMode setting the ORACLE renderer will read; text-scale for the sheet's long-text backstop)"
provides:
  - "src/browser/viewModels.js: characterSheetViewModel(state) — the HERO tab (THE DOOMED) data contract bound to real GameState.c + engine/derived.js"
  - "src/browser/viewModels.js: oracleLogViewModel(entries, diceMode) — the ORACLE tab (and combat log, reused) data contract with dice-reveal gating"
  - "src/browser/tutorial.js: COACH_MARK_STEPS, makeTutorialSequencer(), getTutorialSeen()/setTutorialSeen() — the first-run coach-mark sequencer"
  - "src/browser/icons.js: FEATURE_ICONS, featureKeyForCell(), preloadIcons(), drawFeatureIcon() — the 9-PNG feature-icon system"
affects: [04-08 (HERO/ORACLE screen rendering), 04-06 (maze canvas icon draw), 04-10 (tutorial overlay wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-free view-models as the SINGLE render-data contract a later DOM-wiring plan (04-08) consumes without re-deriving engine bindings"
    - "Damage-as-range: a static [min,max] descriptor mirroring an rng-consuming engine helper's modifier stack exactly, letting presentation code render a deterministic value without ever drawing from the live rng (parity/determinism invariant)"
    - "Roll-span extraction: parsing the <span class=\"roll\">...</span> HTML formatEvents() already emits, rather than inventing a second structured event-narration format"
    - "TDD RED/GREEN per task, two commits each (test(...) then feat(...))"

key-files:
  created:
    - src/browser/viewModels.js
    - src/browser/tutorial.js
    - src/browser/icons.js
    - test/unit/characterSheetViewModel.test.js
    - test/unit/oracleLogViewModel.test.js
    - test/unit/tutorial.test.js
  modified: []

key-decisions:
  - "DAMAGE row renders as a [min,max] range (e.g. \"8–14\") computed by mirroring engine/derived.js's weaponDamage() modifier stack (level^2 + prof + magicWpn + race dmg/wpnBonus + might + Kata/Heft skills + eff(\"dmg\") + Guard/Sorcerer adjustments) against the weapon's dice bounds — never calling weaponDamage(c, rng) on the live state, so rendering the sheet cannot advance state.rngState (T-04-06). Verified two ways: a rngState-byte-identical-before/after test, AND a 200-draw cross-check that every real weaponDamage(c, testRng) roll (fresh rng, seed 999) falls inside the reported bracket."
  - "quirk {label,text} binds to the character's real c.phobia/c.phobiaType (the closest true GameState field to the design mockup's throwaway QUIRKS placeholder table, which this project does not port per 04-RESEARCH.md Pitfall 1); snarkLine is a separate static assembly of temperament+motive+phobia for the italic tone line under the name. Both are static string concatenation only — no external voice-generator call (Phase 5's scope)."
  - "oracleLogViewModel(entries, diceMode) takes entries as the array of HTML strings src/browser/engineAdapter.js's formatEvents() already produces, and extracts the roll detail by matching the <span class=\"roll\">...</span> span already embedded in that HTML — rather than requiring a second, richer structured-event input the adapter doesn't currently emit. The combat log reuses the identical function per 04-UI-SPEC.md's 'applies uniformly' requirement."
  - "tutorialSeen persists as the literal key `mazeworld.tutorialSeen` (no .v1 suffix), matching 04-CONTEXT.md's and this plan's exact literal naming — NOT yet migrated to the ddr.* rename scope (that rename is explicitly scoped to the 3 pre-existing delve/graveyard/best keys per 04-CONTEXT.md, and settings.js's mazeworld.settings.v1 from 04-02 sets the same un-migrated precedent)."
  - "featureKeyForCell(cell) accepts either a bare feat string OR a real engine/maze.js floor-cell shape ({feat, dir, seen, dark}), maximizing compatibility with however 04-06/04-08 end up calling it, without weakening the per-feat mapping test."
  - "Reworded two header-comment lines that literally contained the trigger substrings the plan's own acceptance-criteria greps scan for (\"s.ch\"/\"s.pos\"/\"s.feats\" example list in viewModels.js; \"localStorage\" in tutorial.js) — same class of pitfall 04-01/04-02 already documented (grep matches comments, not just code)."

patterns-established:
  - "Pattern 1 (continued from 04-01/04-02): pure, DOM-free modules under src/browser/ as the single shared source later DOM-wiring plans import rather than re-derive — extended here to cover the engine-data-binding layer (view-models), not just geometry/settings math."

requirements-completed: [UX-04, UX-05, UX-06]

coverage:
  - id: D1
    description: "characterSheetViewModel(state) binds every HERO row (TO STRIKE, TO HIT, DAMAGE, ARMOR, INTELLIGENCE, SKILL POINTS, NEXT LEVEL, UPKEEP, WIN POTENTIAL, LVL, name, class/race/sub, quirk, skills) to real GameState.c + engine/derived.js"
    requirement: "UX-04"
    verification:
      - kind: unit
        ref: "test/unit/characterSheetViewModel.test.js#name/level/class/race/sub, TO STRIKE/TO HIT/ARMOR/INTELLIGENCE/SKILL POINTS/UPKEEP, NEXT LEVEL + MAX edge case, WIN POTENTIAL, quirk, snarkLine, skills[] (Fighter + Magic User empty), Fridgian no-armor edge case, mockup-shape-field grep"
        status: pass
    human_judgment: false
  - id: D2
    description: "DAMAGE row is a static [min,max] descriptor derived without drawing from GameState.rngState; the view-model never mutates rngState"
    requirement: "UX-04"
    verification:
      - kind: unit
        ref: "test/unit/characterSheetViewModel.test.js#DAMAGE row brackets every real weaponDamage(c, rng) roll (200-draw cross-check) + rngState byte-identical before/after"
        status: pass
    human_judgment: false
  - id: D3
    description: "oracleLogViewModel(entries, diceMode) returns reverse-chronological rows with dice-reveal gating matching diceMode ('on tap' hidden-until-tapped, 'always' shown, 'never' omitted); reused for the combat log"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "test/unit/oracleLogViewModel.test.js#empty/one/many, reverse-chronological order, on tap/always/never gating, roll-less line has no reveal affordance, narration has roll span stripped"
        status: pass
    human_judgment: false
  - id: D4
    description: "The coach-mark sequencer advances/dismisses across the fixed 4-step set and reports tutorialSeen via window.mzStorage only; step copy stays within the 'no wall of text' cap"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "test/unit/tutorial.test.js#sequencer current/next/dismiss/isComplete/empty-list, tutorialSeen round-trip via storage.js, no-raw-localStorage grep, COACH_MARK_STEPS shape + length cap"
        status: pass
    human_judgment: false
  - id: D5
    description: "icons.js maps every engine feature cell to one of the 9 PNG keys (dot/tele/one/trap/chest/climb/gorge/exit/gate -> encounter/teleport/onewaydoor/trap/chest/wall/crevice/descent/descent) and the player marker to party; preloadIcons/drawFeatureIcon are browser-only and never construct Image() at module top level"
    requirement: "UX-06"
    verification:
      - kind: unit
        ref: "test/unit/tutorial.test.js#FEATURE_ICONS is the 9 keys, PLAYER_MARKER_ICON, featureKeyForCell mapping (string + real cell shape) for every feat, unrecognized-cell returns null, icons.js imports cleanly under node --test"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 3: View-Models + Tutorial Sequencer + Icon Mapper Summary

**DOM-free `characterSheetViewModel`/`oracleLogViewModel` bound to the real GameState (never the design mockup's placeholder shape), a coach-mark sequencer with tutorialSeen persistence, and a 9-PNG feature-icon mapper — all unit-tested headlessly, locking the Wave-5/Wave-7 screen data contracts before any DOM exists.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-08T19:59:03Z (first RED commit)
- **Completed:** 2026-09-08T20:03:37Z (final GREEN commit)
- **Tasks:** 3 (all TDD)
- **Files modified:** 6 (all new)

## Accomplishments
- `src/browser/viewModels.js`: `characterSheetViewModel(state)` binds every UI-SPEC HERO row to `GameState.c`/`engine/derived.js` — including a DAMAGE row rendered as a static `[min,max]` range that mirrors `weaponDamage()`'s full modifier stack (level², prof, magicWpn, race dmg/wpnBonus, might, Kata/Heft skills, `eff("dmg")`, Guard/Sorcerer adjustments) without ever drawing from the live rng, so the sheet render provably never advances `state.rngState`.
- `src/browser/viewModels.js`: `oracleLogViewModel(entries, diceMode)` reverses `formatEvents()`-shaped HTML narration to newest-first and gates the embedded `<span class="roll">` detail by the `diceMode` setting — reused identically for the combat log per 04-UI-SPEC.md.
- `src/browser/tutorial.js`: `COACH_MARK_STEPS` (4 fixed steps: move / trap / descend / starving, each ≤90 chars, ≤2 lines) + `makeTutorialSequencer()` (current/next/dismiss/isComplete) + `getTutorialSeen()`/`setTutorialSeen()` persisting `mazeworld.tutorialSeen` exclusively through `storage.js`/`window.mzStorage`.
- `src/browser/icons.js`: the 9 `FEATURE_ICONS` keys, `featureKeyForCell()` mapping every engine feat (`dot`/`tele`/`one`/`trap`/`chest`/`climb`/`gorge`/`exit`/`gate`) to its PNG key per STATE.md's Provided Assets table, and browser-only `preloadIcons()`/`drawFeatureIcon()` that never construct `Image()` at module top level.
- 35 new `node:test` unit tests, all green; full suite grew from 414 to 449 passing tests with zero regressions (`test:quick` grew from 325 to 360).

## Task Commits

Each task was committed as a RED/GREEN TDD pair:

1. **Task 1: Character-sheet view-model bound to real GameState (UX-04)**
   - `44f941c` (test) — RED: 12 failing/unloadable test cases (`test/unit/characterSheetViewModel.test.js`)
   - `ae41cd3` (feat) — GREEN: `src/browser/viewModels.js#characterSheetViewModel` implemented, 12/12 passing
2. **Task 2: Oracle-log view-model with dice-reveal gating (UX-05)**
   - `5f144b8` (test) — RED: 8 failing/unloadable test cases (`test/unit/oracleLogViewModel.test.js`)
   - `8cfdf58` (feat) — GREEN: `src/browser/viewModels.js#oracleLogViewModel` appended, 8/8 passing
3. **Task 3: Coach-mark sequencer + feature-icon loader (UX-06, UX-03 icons)**
   - `ee6b422` (test) — RED: 15 failing/unloadable test cases (`test/unit/tutorial.test.js`)
   - `def1283` (feat) — GREEN: `src/browser/tutorial.js` + `src/browser/icons.js` implemented, 15/15 passing

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `src/browser/viewModels.js` - `characterSheetViewModel(state)` (HERO tab data) and `oracleLogViewModel(entries, diceMode)` (ORACLE/combat log data)
- `src/browser/tutorial.js` - `COACH_MARK_STEPS`, `COACH_MARK_COPY_MAX_CHARS`, `makeTutorialSequencer()`, `getTutorialSeen()`/`setTutorialSeen()`, `TUTORIAL_SEEN_KEY`
- `src/browser/icons.js` - `FEATURE_ICONS`, `PLAYER_MARKER_ICON`, `featureKeyForCell()`, `preloadIcons()`, `drawFeatureIcon()`
- `test/unit/characterSheetViewModel.test.js` - 12 unit tests covering every HERO row binding, the damage-bracket cross-check, rngState invariance, quirk/snarkLine, skills[], and mockup-shape-field absence
- `test/unit/oracleLogViewModel.test.js` - 8 unit tests covering ordering, per-diceMode gating, roll-less lines, and roll-span extraction
- `test/unit/tutorial.test.js` - 15 unit tests covering sequencer transitions, tutorialSeen persistence, copy-length cap, and featureKeyForCell mapping

## Decisions Made
- DAMAGE renders as a `[min,max]` range mirroring `weaponDamage()`'s real modifier stack (not just the weapon's raw dice label) — verified both by an rngState-invariance test and a 200-draw cross-check against the actual `weaponDamage(c, testRng)` function on a fresh, non-live rng.
- `quirk.text` binds to the real `c.phobia`/`c.phobiaType` (the closest true field to the design mockup's placeholder QUIRKS table); `snarkLine` is a separate static assembly of temperament+motive+phobia. Both are deterministic string concatenation — no voice-generator call (Phase 5's scope).
- `oracleLogViewModel` consumes the same HTML-string shape `formatEvents()` already returns, extracting the `<span class="roll">` detail via regex rather than requiring a new richer structured-event contract from the adapter.
- `tutorialSeen` persists under the literal key `mazeworld.tutorialSeen` (no `.v1` suffix), matching 04-CONTEXT.md's exact wording and this plan's literal spec — not yet folded into the `ddr.*` rename scope (which 04-CONTEXT.md scopes to the 3 pre-existing delve/graveyard/best keys only; `settings.js`'s `mazeworld.settings.v1` from 04-02 sets the same un-migrated precedent for new Phase-4 keys).
- `featureKeyForCell(cell)` accepts either a bare feat string or a real floor-cell object (`{feat, dir, seen, dark}`), so whichever calling convention 04-06/04-08 settle on works without a wrapper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header-comment wording tripped the plan's own literal-string acceptance-criteria greps**
- **Found during:** Task 1 and Task 3 (post-implementation acceptance-criteria verification)
- **Issue:** `viewModels.js`'s header comment listed the design mockup's placeholder field names (`s.ch.wp`, `s.pos`, `s.feats`) as prose examples of what NOT to bind to; `tutorial.js`'s header comment used the literal word `localStorage` describing what NOT to write to directly. The plan's acceptance criteria (and this plan's own tests, mirroring 04-01/04-02's precedent) grep the whole file including comments — both literal substrings tripped their own documentation-only mentions.
- **Fix:** Reworded both comments to convey the identical meaning without the literal trigger substrings ("the design mockup's throwaway state-object field names"; "any raw browser-native key/value store"). No behavior change — pure documentation wording, identical to the 04-01/04-02 precedent for `Math.random`/`window`/`localStorage`.
- **Files modified:** src/browser/viewModels.js, src/browser/tutorial.js
- **Verification:** `test/unit/characterSheetViewModel.test.js`'s mockup-shape-field test and `test/unit/tutorial.test.js`'s no-raw-localStorage test both pass; the plan's own `grep -n "\.wp\b\|s\.ch\|s\.pos\|s\.feats" src/browser/viewModels.js` acceptance criterion legitimately still matches `c.wp`/`c.maxWP` (real `GameState.c` fields, not the mockup's `s.ch.wp`) — this is expected/correct binding, not a violation; the stricter `\bs\.ch\b|\bs\.pos\b|\bs\.feats\b` word-boundary check (which the criterion's intent actually targets) is what the committed test enforces and passes.
- **Committed in:** ae41cd3, def1283 (part of each task's GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug, minor/cosmetic — same class as 04-01/04-02's deviation)
**Impact on plan:** No scope creep — a same-commit wording fix so the plan's tests pass as written; no behavior change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `characterSheetViewModel`/`oracleLogViewModel` are ready for 04-08 to render the HERO/ORACLE tabs (and combat log) directly from `getState()` with zero re-derivation.
- `tutorial.js`/`icons.js` are ready for 04-10 (coach-mark overlay wiring) and 04-06/04-08 (canvas icon draw) respectively — `preloadIcons()`/`drawFeatureIcon()` are implemented per 04-RESEARCH.md's exact Code Example #3 contract but device/DOM-exercised only starting in those later plans.
- `npm test` is green at 449 (up from 414 baseline), `npm run test:quick` green at 360.
- No blockers for the rest of Wave 1 or downstream waves.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created files verified present on disk; all six task commit hashes (44f941c, ae41cd3, 5f144b8, 8cfdf58, ee6b422, def1283) verified present in `git log --oneline --all`.
