---
phase: 21-consolidated-difficulty-retune
plan: 03
subsystem: engine
tags: [engine, state, save, parity-carveout, adapter, settings-ui, dev-toggle, build, node-test]

requires:
  - phase: 21-consolidated-difficulty-retune (plan 02)
    provides: "difficultyCurve's combat-scaling knobs (foeCap/foeBonus/foeLvlBias/foePower/abilityThreat), all identity-valued, wired into startCombat/foeAbilities.js"
provides:
  - "engine/state.js: newRun(seed, exclude = [], { startDepth = 1 } = {}) with a dev-only branch (sanitized via Math.min(DEV_START_DEPTH_MAX, difficultyCurve(startDepth).depth), levels via checkLevel, grants a depth-scaled purse via gainWilmst, re-captures rngState); DEV_START_DEPTH_MAX = 999; state.dev — a coerced boolean present on EVERY fresh state"
  - "engine/encounters.js: WILMST_CACHE_PER_DEPTH exported (was module-private) so the dev purse reuses the existing wilmst-cache row"
  - "engine/saveState.js: dev: !!obj.dev in both validateSave's value and rehydrate's state"
  - "test/parity/harness/comparables.js + the three per-domain parity test files' own local comparable() duplicates: dev stripped everywhere a top-level party/pendingJoiner/pendingFind strip already exists"
  - "src/browser/engineAdapter.js: initRun(seed, exclude, options) and startNewRun(seed, options) thread startDepth to newRun (adapter-side integer/>=1 clamp ahead of the engine's own sanitisation); recordBest/persistGrave gated on !currentState.dev"
  - "mazeworld.html: Settings version row (#mw-settings-version/#mw-app-version), hidden dev row (#mw-dev-row/#mw-dev-start-depth/#mw-dev-start-btn), a local ~1.2s long-press handler, window.mzDevStartAtDepth (the one entry point), a HUD DEV chip (#mw-dev-chip) toggled in paint()"
  - "tools/build-www.mjs: reads android/version.properties (mirroring bump-version.mjs's regex) and stamps versionName (versionCode) into www/index.html's #mw-app-version placeholder, throwing if either is missing"
affects: [21-04, 21-05]

tech-stack:
  added: []
  patterns:
    - "dev-only rng branch gated on a sanitized derived value (startAt > 1), running AFTER the default-path literal is built and re-capturing rngState — keeps every default caller/fixture byte-identical while still letting the dev branch draw freely"
    - "new top-level serialized field -> four-place carve-out: validateSave + rehydrate (explicit !!obj.field line, no spread) + all three shared *Comparable() fns in comparables.js + the three per-domain parity test files' own local comparable() duplicates (discovered this phase — those duplicates are NOT re-exports of comparables.js and needed their own edit)"
    - "adapter-side option clamp (Number.isInteger && >=1) ahead of the engine's own difficultyCurve-based sanitisation — belt-and-suspenders on untrusted UI input, mirroring the existing seed-recovery guard"

key-files:
  created: []
  modified:
    - engine/state.js
    - engine/encounters.js
    - engine/saveState.js
    - test/parity/harness/comparables.js
    - test/parity/movement-parity.test.js
    - test/parity/combat-parity.test.js
    - test/parity/magic-parity.test.js
    - test/unit/newrun.test.js
    - test/unit/save-validation.test.js
    - src/browser/engineAdapter.js
    - test/unit/engineAdapter.test.js
    - mazeworld.html
    - tools/build-www.mjs

key-decisions:
  - "startAt = Math.min(DEV_START_DEPTH_MAX, difficultyCurve(startDepth).depth) reuses difficultyCurve's own safeDepth() clamp (floor/max(1,·)/finite-check) for free — 0, -3, NaN, 1.5, Infinity, 'abc', and undefined all sanitize to 1 with zero extra code, and 5000 clamps to 999"
  - "The dev branch's purse literal is WILMST_CACHE_PER_DEPTH * startAt run through the UNCHANGED gainWilmst (which already applies the greed multiplier and a Pickpocket-only extra draw) — the dev purse is not a bespoke formula, it is the existing depth-scaled wilmst-cache row called with a larger depth"
  - "checkLevel is called with the state object itself (not a proxy) since it mutates state.c in place and needs no other state fields — matches how movement.js#descend already calls it"
  - "window.mzDevStartAtDepth mirrors window.newGame's engineNewRun shape (clear log, center map, banner, paint, draw) rather than introducing a new commit pattern, and calls closeSettingsSheet() directly since both live in the same module scope"
  - "build-www.mjs's version stamp mirrors bump-version.mjs's exact versionCode=/versionName= regex rather than importing it (bump-version.mjs is a one-shot CLI, not a module) — keeps the two files' parsing byte-identical without a refactor"

patterns-established:
  - "A dev-only engine branch that runs additional rng draws after the default literal is built, gated so it never fires on any default/fixture path, then re-captures rngState — the template for any future 'skip ahead' dev affordance"

requirements-completed: [TUNE-04]

coverage:
  - id: D1
    description: "newRun(seed, exclude, { startDepth }) generates the requested floor, levels the character to the THRESHOLDS-derived SP for min(startDepth,5), grants a depth-scaled purse, flags state.dev, and stays byte-identical to newRun(seed) on the default path"
    requirement: "TUNE-04"
    verification:
      - kind: unit
        ref: "test/unit/newrun.test.js#D-14/D-13/sanitisation/purity tests (6 new)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dev is a coerced serialized boolean (validateSave/rehydrate), absent on a pre-Phase-21 save defaults to false, and is stripped in all three shared comparables plus the three per-domain parity test files' own local duplicates"
    requirement: "TUNE-04"
    verification:
      - kind: unit
        ref: "test/unit/save-validation.test.js#D-14/D-23 tests (3 new)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30)"
        status: pass
    human_judgment: false
  - id: D3
    description: "a dev run's death never writes GRAVE_KEY/GRAVE_TOTAL_KEY/RECENT_NAMES_KEY, and ending a dev run via startNewRun never records its depth into getBest(); normal runs are unaffected"
    requirement: "TUNE-04"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#D-13/D-14 tests (4 new)"
        status: pass
    human_judgment: false
  - id: D4
    description: "the hidden Settings version row/long-press/dev field/HUD chip are wired end-to-end (window.mzDevStartAtDepth referenced exactly twice, CRLF intact, unreachable except via the long-press), and build-www.mjs stamps the real version into www/index.html"
    requirement: "TUNE-04"
    verification:
      - kind: unit
        ref: "test/unit/formatEventsCoverage.test.js, test/voice/safety-scan.test.js, test/unit/settings.test.js, test/unit/parley-button-mirror.test.js"
        status: pass
      - kind: other
        ref: "npm run build:www (stamped version 1.0.1 (2) into www/index.html)"
        status: pass
    human_judgment: true
    rationale: "The actual on-device feel of the ~1.2s long-press, the depth-field's on-screen-keyboard usability, and the HUD chip's visibility are explicitly deferred to the end-of-phase DR round (21-05, TUNE-04's human sign-off) per this plan's own must_haves backstop statement — automation proves the wiring, not the feel."

duration: 15min
completed: 2026-09-14
status: complete
---

# Phase 21 Plan 3: Dev Start-at-Depth Toggle Summary

**`newRun(seed, exclude, { startDepth })` sanitizes via `difficultyCurve`, levels through the ordinary `checkLevel` path, and grants a depth-scaled purse via the existing wilmst-cache row; a coerced `state.dev` boolean flags the run, is carved out of save validation and all parity comparables (including three previously-undiscovered local duplicates), excludes the run from the graveyard/best-depth via `engineAdapter`, and is reachable only through a hidden ~1.2s long-press on a new Settings version line that `build-www.mjs` stamps with the real app version.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-14
- **Tasks:** 3 completed
- **Files modified:** 13 (10 planned + 3 discovered: `test/parity/movement-parity.test.js`, `combat-parity.test.js`, `magic-parity.test.js`)

## Accomplishments

- `engine/state.js#newRun`: grew a third `{ startDepth = 1 }` options param; the default path (`startDepth` omitted or `1`) is byte-identical to every existing caller/fixture (`Math.min(999, difficultyCurve(1).depth) === 1`). The dev branch (`startAt > 1`) sets `c.sp = THRESHOLDS[Math.min(startAt, 5) - 1]`, runs `checkLevel(state, rng, events)` (the exact gain-dice/Soldier→Knight/Apprentice-reroll/Sorcerer-spell path a real climb takes), grants `gainWilmst(state, WILMST_CACHE_PER_DEPTH * startAt, "dev start", rng, events)`, and re-captures `state.rngState` (the literal above captured the cursor BEFORE these draws). `state.dev = startAt > 1` sits beside `dead`/`won` in the same literal, so it round-trips through `serializeRun`/`validateSave`/`rehydrate` for free.
- `engine/encounters.js`: `WILMST_CACHE_PER_DEPTH` changed from module-private to `export const` (same value, same line) so the dev branch reuses the exact row instead of duplicating the constant.
- `engine/saveState.js`: `dev: !!obj.dev,` added directly after `won: !!obj.won,` in both `validateSave`'s `value` literal and `rehydrate`'s `state` literal — a pre-Phase-21 save with no `dev` key loads with `dev: false`; tampered values (`"yes"`, `1`, `0`, `null`) coerce via `!!`.
- `test/parity/harness/comparables.js`: `dev` added to the shared top-level destructure in `movementComparable`, `combatComparable`, and `economyComparable`. **Discovered mid-task:** `test/parity/movement-parity.test.js`, `combat-parity.test.js`, and `magic-parity.test.js` each carry their own LOCAL `comparable()` function (predating the shared harness extraction) that duplicates the exact same destructure — these needed the identical `dev` addition or the parity suite would drop from 30/30 to 21/30 (Rule 1 fix; see Deviations).
- `src/browser/engineAdapter.js`: `initRun(seed, exclude, options = {})` forwards `options` straight to `newRun`. `startNewRun(seed, options = {})` gates the best-depth write on `currentState && !currentState.dev`, clamps `options.startDepth` to an integer `>= 1` (defaulting to `1`) before calling `initRun(safeSeed, exclude, { startDepth })`, and `dispatch()`'s death-handling gate becomes `if (diedEvent && !currentState.dev) track(persistGrave(...))`.
- `mazeworld.html`: a Settings-sheet version row (`#mw-settings-version-row`/`#mw-settings-version`/`#mw-app-version`, defaulting to the text "dev") and a `hidden` dev row (`#mw-dev-row` with `#mw-dev-start-depth` min=1/max=999/value=20 and `#mw-dev-start-btn`) added after the Haptics row. A local `pointerdown`/`setTimeout(1200ms)`/`pointerup`-or-`pointercancel`-or-`pointerleave`-clears handler on `#mw-settings-version` reveals the dev row (deliberately not reusing `controls.js#classifyPointerGesture`, which is maze-viewport-specific). `window.mzDevStartAtDepth(depth)` closes the settings sheet, calls `startNewRun(undefined, { startDepth: depth })`, clears the log, centers the map, prints a family-friendly dev banner ("A dev run. The graveyard has agreed to look the other way."), and repaints — the single entry point (`mzDevStartAtDepth` appears exactly twice: definition + the Start button's click handler). A `#mw-dev-chip` HUD span (`hidden` by default) toggles from `state.dev` in `paint()`. CSS added: `.mw-settings-row[hidden]{display:none}` (the row's own flex display would otherwise override `hidden`), `.mw-settings-version` (no text-selection/callout during the hold), `#mw-dev-start-depth` input chrome, `.mw-dev-chip` (reuses the `--ditto` accent). CRLF line endings verified intact.
- `tools/build-www.mjs`: reads `android/version.properties` via the same `versionCode=`/`versionName=` regex `bump-version.mjs` uses, replaces the exact `<span id="mw-app-version">dev</span>` placeholder in the copied `mazeworld.html` text with `<span id="mw-app-version">${versionName} (${versionCode})</span>`, and throws if either the properties file's keys or the placeholder itself are missing. `npm run build:www` printed `stamped version 1.0.1 (2) into www/index.html`; `www/index.html` (gitignored build output) carries the stamped string, not the placeholder.
- Tests: 6 new in `test/unit/newrun.test.js` (default-identity/arity, startDepth-20 level/purse/dev-flag, chargen-untouched, startDepth-3-and-50, sanitisation of 7 malformed inputs + the 5000 clamp, purity/reproducibility), 3 new in `test/unit/save-validation.test.js` (missing-key defaults false, `dev: true` round-trips, boolean coercion of tampered values), 4 new in `test/unit/engineAdapter.test.js` (startDepth threading + non-integer ignored, dev-death writes no graveyard key, dev-run ending doesn't record best while a normal run still does, a normal run after a dev run still buries).

## Task Commits

Each task was committed atomically:

1. **Task 1: `newRun(seed, exclude, { startDepth })` + `state.dev` in the engine, dev coercion in saveState.js, the dev carve-out in all three comparables, with newrun/save-validation tests** - `df7bde4` (feat)
2. **Task 2: Thread `startDepth` through engineAdapter (`initRun`/`startNewRun`) and exclude dev runs from the graveyard and best-depth record, with adapter tests** - `197fe7f` (feat)
3. **Task 3: Settings version row + long-press dev field + `window.mzDevStartAtDepth` + HUD DEV chip in mazeworld.html (CRLF-preserving), and build-www version substitution** - `83526ae` (feat)

## Files Created/Modified

- `engine/state.js` - `newRun`'s third `options` param, `DEV_START_DEPTH_MAX`, the dev branch, `state.dev`
- `engine/encounters.js` - `WILMST_CACHE_PER_DEPTH` exported
- `engine/saveState.js` - `dev: !!obj.dev` in `validateSave`/`rehydrate`
- `test/parity/harness/comparables.js` - `dev` in the three shared `*Comparable()` destructures
- `test/parity/movement-parity.test.js`, `combat-parity.test.js`, `magic-parity.test.js` - `dev` in their own local `comparable()` duplicates (discovered, not in the original plan file list)
- `test/unit/newrun.test.js` - 6 new dev-start-at-depth tests
- `test/unit/save-validation.test.js` - 3 new `dev` coercion/round-trip tests
- `src/browser/engineAdapter.js` - `initRun`/`startNewRun` option threading, `recordBest`/`persistGrave` dev gates
- `test/unit/engineAdapter.test.js` - 4 new dev-threading/exclusion tests
- `mazeworld.html` - Settings version row, hidden dev row, long-press handler, `window.mzDevStartAtDepth`, HUD DEV chip, supporting CSS
- `tools/build-www.mjs` - `android/version.properties` read + `#mw-app-version` placeholder stamp

## Decisions Made

- `startAt = Math.min(DEV_START_DEPTH_MAX, difficultyCurve(startDepth).depth)` — reusing `difficultyCurve`'s own `safeDepth()` clamp for input sanitisation rather than writing a second clamp, so every malformed input (0, negative, NaN, non-integer, ±Infinity, non-numeric string, undefined) sanitizes to `1` for free.
- The dev purse is the unmodified `gainWilmst(state, WILMST_CACHE_PER_DEPTH * startAt, "dev start", rng, events)` — no bespoke formula, just the existing depth-scaled row called with a larger depth, so it inherits the greed multiplier and Pickpocket-extra-draw behavior automatically.
- `window.mzDevStartAtDepth` mirrors `window.newGame`'s `engineNewRun` shape exactly (clear log, center map, banner, paint, draw) rather than inventing a new commit pattern for a one-off dev affordance.
- `build-www.mjs`'s version-properties parsing mirrors `bump-version.mjs`'s exact regex (duplicated, not imported — `bump-version.mjs` is a one-shot CLI script, not a module) so the two files' understanding of `android/version.properties` can never silently drift apart.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three per-domain parity test files' own local `comparable()` duplicates needed the `dev` carve-out too**
- **Found during:** Task 1, running the plan's own `<verify>` command (`node --test "test/parity/**/*.test.js"`)
- **Issue:** `test/parity/harness/comparables.js`'s shared `movementComparable`/`combatComparable`/`economyComparable` were updated per the plan, but `test/parity/movement-parity.test.js`, `combat-parity.test.js`, and `magic-parity.test.js` each define their OWN local `comparable()` function (a pre-existing duplication predating the shared-harness extraction, confirmed present since at least the PARTY-01/`pendingJoiner` carve-out) that was NOT in this plan's `files_modified` list. Without the same `dev` addition, those three files' key-set comparisons diverged on the new field, dropping the parity suite from 30/30 to 21/30.
- **Fix:** Added `dev` to each file's local destructure, mirroring the exact comment style ("Phase 21 (TUNE-04, D-14): strip the new top-level `state.dev` too...") already used for the `pendingFind` addition in the same spot.
- **Files modified:** `test/parity/movement-parity.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`
- **Verification:** `node --test "test/parity/**/*.test.js"` returned to 30/30; `npm test` 948/948.
- **Committed in:** `df7bde4` (Task 1 commit)

**2. [Rule 1 - Bug] A long-press comment accidentally bumped the `classifyPointerGesture` grep count**
- **Found during:** Task 3, running the plan's own acceptance-criteria grep
- **Issue:** An early draft of the long-press handler's explanatory comment referenced `controls.js#classifyPointerGesture` by its literal function name, which incremented `grep -c 'classifyPointerGesture' mazeworld.html` from the plan's required baseline of 3 (matching `git show bd0ba7c:mazeworld.html`) to 4 — the acceptance criterion this plan itself states is meant to prove the maze gesture helper was NOT repurposed.
- **Fix:** Reworded the comment to describe the same reasoning (maze-viewport-specific, D-pad-tuned thresholds, long-press left unbound) without using the literal identifier.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -c 'classifyPointerGesture' mazeworld.html` returned to 3, matching the `bd0ba7c` baseline exactly.
- **Committed in:** `83526ae` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both caught by the plan's own verification/acceptance commands before commit)
**Impact on plan:** Both fixes were required for the plan's own stated acceptance criteria to pass; no scope creep — the three per-domain parity files were a pre-existing duplication the plan's `files_modified` list simply hadn't anticipated, and the grep-count fix only changed a comment's wording.

## Issues Encountered

None beyond the two auto-fixed deviations above — both were caught immediately by running the plan's own `<verify>`/`<acceptance_criteria>` commands before committing, not discovered later.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The dev start-at-depth affordance is fully wired end-to-end (engine → adapter → hidden Settings UI → build stamp) and is provably inert on every default path: parity stays 30/30, `npm test` is 948/948 (935 pre-plan + 6 + 3 + 4), and the frozen files (`test/parity/prototype-master.js.txt`, fixtures, `test/determinism/foe-abilities.test.js`, `test/unit/foe-turn-draw-count.test.js`, `package.json`/`package-lock.json`, `engine/difficulty.js`/`combat.js`/`foeAbilities.js`) are all byte-unchanged since this plan's start (`62f84c3`) or the referenced baseline (`04eb229`/`bd0ba7c`).
- `21-04`'s retune can now move `FOE_CAP_MAX`/`FOE_POWER_MAX`/`ABILITY_THREAT_MAX` and related constants freely, and `21-05`'s DR round can reach floor 20/35/50 in seconds via the hidden long-press → `Start at depth (dev)` field, with the resulting run visibly marked (HUD DEV chip) and structurally guaranteed never to pollute the graveyard or best-depth record.
- The on-device feel of the ~1.2s long-press gesture, the numeric depth field's on-screen-keyboard usability, and the HUD chip's visibility/unobtrusiveness are explicitly deferred to `21-05`'s human DR round (this plan's own `must_haves` backstop statement) — not a blocker, by design.
- No blockers.

---
*Phase: 21-consolidated-difficulty-retune*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 13 created/modified files found on disk (`engine/state.js`, `engine/encounters.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, `test/parity/movement-parity.test.js`, `test/parity/combat-parity.test.js`, `test/parity/magic-parity.test.js`, `test/unit/newrun.test.js`, `test/unit/save-validation.test.js`, `src/browser/engineAdapter.js`, `test/unit/engineAdapter.test.js`, `mazeworld.html`, `tools/build-www.mjs`); all three task commit hashes (`df7bde4`, `197fe7f`, `83526ae`) found in `git log --oneline --all`.
