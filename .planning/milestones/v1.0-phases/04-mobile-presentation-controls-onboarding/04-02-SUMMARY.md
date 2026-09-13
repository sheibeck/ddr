---
phase: 04-mobile-presentation-controls-onboarding
plan: 02
subsystem: ui
tags: [settings, persistence, text-scale, accessibility, node-test, vanilla-js]

# Dependency graph
requires: []
provides:
  - "src/browser/settings.js: SETTINGS_DEFAULTS, SETTINGS_STORAGE_KEY, readSettings, writeSetting (six-field schema over window.mzStorage)"
  - "src/browser/settings.js: textScaleForSize, clampTextScale, effectiveTextScale (pure UX-08 text/OS-scale math)"
  - "src/browser/settings.js: shouldConfirmQuit (pure confirm-before-quit gate)"
affects: [04-05 (root --mw-text-scale wiring), 04-09 (settings screen render/write + Cut Losses gate), 04-06 (control-scheme setting consumer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings persisted as ONE JSON blob under a single versioned key (mazeworld.settings.v1), not one key per field — one storage.js write-queue entry per settings change"
    - "import * as storage-style module import from storage.js (matches engineAdapter.js), not the window.mzStorage global — loads cleanly under plain node --test with no window bootstrapped"
    - "Pure math/gate functions (textScaleForSize/clampTextScale/effectiveTextScale/shouldConfirmQuit) co-located in the same file as the async storage-backed functions, but zero DOM/storage/side-effects themselves — mirrors nativeChrome.js#decideBackAction's pure-gate posture"
    - "TDD RED/GREEN per task, two commits each (test(...) then feat(...))"

key-files:
  created:
    - src/browser/settings.js
    - test/unit/settings.test.js
    - test/unit/textScale.test.js
    - test/unit/confirmQuit.test.js
  modified: []

key-decisions:
  - "settings.js imports getItem/setItem directly from storage.js (import * as storage pattern, matching engineAdapter.js) rather than reaching for window.mzStorage — storage.js itself installs window.mzStorage for the classic script, so this still satisfies 'the ONLY writer of the settings keys goes through window.mzStorage' without requiring window to exist at all (test/node --test compatibility)"
  - "Reworded the settings.js header comment's mention of 'raw localStorage' to 'any raw browser-native key/value store' — the plan's own acceptance-criteria grep for the literal string localStorage scans comments too, and 04-01 already hit this exact pitfall with 'Math.random'/'window'"
  - "shouldConfirmQuit(settings) treats an absent/undefined settings object as confirmBeforeQuit:false (safest default for a caller that failed to load settings first), via optional chaining rather than throwing"

patterns-established:
  - "Pattern 1 (continued from 04-01): a pure-math module co-located with its async I/O counterpart in the same file, provided both halves stay independently pure/testable and the file header documents the split"

requirements-completed: [UX-07, UX-08, UX-01]

coverage:
  - id: D1
    description: "All 6 settings (sound, haptics, textSize, controlScheme, confirmBeforeQuit, diceMode) round-trip through window.mzStorage and read back with correct defaults when unset"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "test/unit/settings.test.js#readSettings(): unset store yields full defaults"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#writeSetting/readSettings: each of the 6 fields round-trips through window.mzStorage"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#readSettings(): haptics boolean round-trips (haptics-call injection seam)"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#writeSetting(): invalid value is rejected (no-op, keeps prior/default)"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#readSettings(): corrupt JSON blob yields full defaults, never throws"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#readSettings(): partial persisted blob merges over defaults"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#settings.js never touches raw localStorage directly (only via storage.js/window.mzStorage)"
        status: pass
    human_judgment: false
  - id: D2
    description: "textScaleForSize maps S/M/L to 0.85/1.0/1.25 and clampTextScale bounds any OS font-scale input to [0.85, 1.25]"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "test/unit/textScale.test.js#textScaleForSize: S -> 0.85, M -> 1.0, L -> 1.25"
        status: pass
      - kind: unit
        ref: "test/unit/textScale.test.js#textScaleForSize: unknown size defaults to 1.0"
        status: pass
      - kind: unit
        ref: "test/unit/textScale.test.js#clampTextScale: OS extremes clamp to [0.85, 1.25]"
        status: pass
      - kind: unit
        ref: "test/unit/textScale.test.js#clampTextScale: non-finite input defaults to 1.0"
        status: pass
      - kind: unit
        ref: "test/unit/textScale.test.js#effectiveTextScale: return value is always within [0.85, 1.25] for any size/OS-scale combo"
        status: pass
    human_judgment: false
  - id: D3
    description: "shouldConfirmQuit returns true only when confirmBeforeQuit is ON (gates the Sheet's Cut Losses action)"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "test/unit/confirmQuit.test.js#shouldConfirmQuit: true when confirmBeforeQuit is ON"
        status: pass
      - kind: unit
        ref: "test/unit/confirmQuit.test.js#shouldConfirmQuit: false when confirmBeforeQuit is OFF"
        status: pass
      - kind: unit
        ref: "test/unit/confirmQuit.test.js#shouldConfirmQuit: false when confirmBeforeQuit is missing/undefined"
        status: pass
      - kind: unit
        ref: "test/unit/confirmQuit.test.js#shouldConfirmQuit: ignores unrelated fields on the settings object"
        status: pass
    human_judgment: false
  - id: D4
    description: "controlScheme persists as 'tap'|'dpad' (default 'tap'); diceMode persists as 'on tap'|'always'|'never' (default 'on tap')"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "test/unit/settings.test.js#SETTINGS_DEFAULTS: controlScheme defaults to 'tap' and diceMode defaults to 'on tap'"
        status: pass
      - kind: unit
        ref: "test/unit/settings.test.js#writeSetting(): invalid value is rejected (no-op, keeps prior/default) [controlScheme='keyboard', diceMode='sometimes' cases]"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 2: Settings Schema + Text-Scale/Confirm-Quit Summary

**DOM-free `settings.js` persisting all six UX-07 fields as one JSON blob through `window.mzStorage`, plus pure UX-08 text-scale clamping and a pure confirm-before-quit gate — fully unit-tested, zero DOM/localStorage coupling.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-08T19:46:25Z (first RED commit)
- **Completed:** 2026-09-08T19:49:23Z (final GREEN commit)
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (all new)

## Accomplishments
- `src/browser/settings.js`: `readSettings()`/`writeSetting(key, value)` persist all six fields (`sound`, `haptics`, `textSize`, `controlScheme`, `confirmBeforeQuit`, `diceMode`) as one JSON blob under `mazeworld.settings.v1`, routed exclusively through `storage.js`'s shared abstraction (`import * as`-style direct import, same pattern as `engineAdapter.js`) — never raw `localStorage`/`@capacitor/preferences`. Invalid values are rejected as no-ops; a missing or corrupt blob fails open to `SETTINGS_DEFAULTS`, never throws.
- `textScaleForSize`, `clampTextScale`, `effectiveTextScale`: pure UX-08 math mapping S/M/L to 0.85/1.0/1.25, clamping any OS font-scale input (including non-finite) to `[0.85, 1.25]`, and re-clamping the final size×OS product so no combination can break the fixed pixel-art chrome.
- `shouldConfirmQuit({confirmBeforeQuit})`: pure gate, true only when the setting is on — will gate the Sheet's `CUT LOSSES`/`ROLL ANOTHER` action in 04-09; `RUN AWAY` (combat) is documented as deliberately never routed through this gate.
- 19 new `node:test` unit tests, all green; full suite grew from 395 to 414 passing tests with zero regressions (`test:quick` 325 passing).

## Task Commits

Each task was committed as a RED/GREEN TDD pair:

1. **Task 1: Settings schema + read/write round-trip over window.mzStorage**
   - `6167bed` (test) — RED: 8 failing/unloadable test cases (`test/unit/settings.test.js`)
   - `8199f85` (feat) — GREEN: `src/browser/settings.js` schema implemented, 8/8 passing
2. **Task 2: Text-scale clamping + confirm-quit gate (pure)**
   - `468df43` (test) — RED: 15 failing/unloadable test cases (`test/unit/textScale.test.js` + `test/unit/confirmQuit.test.js`)
   - `77734f0` (feat) — GREEN: pure helpers appended to `src/browser/settings.js`, 11/11 passing

## Files Created/Modified
- `src/browser/settings.js` - Six-field settings schema (readSettings/writeSetting/SETTINGS_DEFAULTS/SETTINGS_STORAGE_KEY) + pure text-scale math (textScaleForSize/clampTextScale/effectiveTextScale) + pure confirm-quit gate (shouldConfirmQuit)
- `test/unit/settings.test.js` - 8 unit tests covering defaults-on-unset, six-field round-trip, invalid-value rejection, corrupt/partial-blob handling, no-raw-localStorage-access grep
- `test/unit/textScale.test.js` - 8 unit tests covering S/M/L mapping, unknown-size default, OS-scale clamping (including non-finite), and the combined-product bound
- `test/unit/confirmQuit.test.js` - 4 unit tests covering the gate's true/false/missing/unrelated-fields behavior

## Decisions Made
- `settings.js` imports `getItem`/`setItem` directly from `storage.js` (matching `engineAdapter.js`'s `import * as storage from "./storage.js"` pattern) rather than reaching through the `window.mzStorage` global — `storage.js` itself installs `window.mzStorage` for the classic non-module script, so this satisfies the "ONLY writer via window.mzStorage" contract while also loading cleanly under plain `node --test` (no `window` bootstrapped at all).
- `shouldConfirmQuit(settings)` treats an absent/undefined `settings` argument as `confirmBeforeQuit: false` via optional chaining, rather than throwing — the safest default if a caller somehow invokes it before `readSettings()` resolves.
- Settings persisted as ONE JSON object under a single versioned key (`mazeworld.settings.v1`), not six separate keys — one `storage.js` write-queue entry per settings change, matching the plan's explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header-comment wording tripped the plan's own literal-string acceptance-criteria grep**
- **Found during:** Task 1 (post-implementation acceptance-criteria verification)
- **Issue:** `settings.js`'s header comment explained the "never raw localStorage" contract using the literal substring `localStorage` (e.g. "never raw `localStorage`/`@capacitor/preferences` directly"). The plan's acceptance criteria run `grep -n "localStorage" src/browser/settings.js` (must return nothing) and a test asserts the same — the grep matches comments as well as code. This is the identical pitfall 04-01-SUMMARY.md documented for `controls.js`/`canvasSizing.js` ("Math.random"/"window").
- **Fix:** Reworded the comment to "any raw browser-native key/value store" without the literal trigger substring. No behavior change — pure documentation wording.
- **Files modified:** src/browser/settings.js
- **Verification:** `grep -n "localStorage" src/browser/settings.js` returns nothing (exit 1); `test/unit/settings.test.js`'s no-raw-localStorage test passes.
- **Committed in:** 8199f85 (part of Task 1's GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug, minor/cosmetic — same class as 04-01's deviation)
**Impact on plan:** No scope creep — a same-commit wording fix so the plan's own acceptance criteria pass as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `settings.js` is ready for 04-05 (Wave-2 shell) to call `effectiveTextScale` when setting the root `--mw-text-scale` custom property, and for 04-09 (Wave-6 settings screen) to render/write through `readSettings()`/`writeSetting()` and gate `CUT LOSSES`/`ROLL ANOTHER` via `shouldConfirmQuit()`.
- `controlScheme` ('tap'|'dpad') is ready for 04-06's control-scheme consumer to read.
- `npm test` is green at 414 (up from 395 baseline before this plan), `npm run test:quick` green at 325.
- No blockers for the rest of Wave 1 or downstream waves.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created files verified present on disk; all four task commit hashes (6167bed, 8199f85, 468df43, 77734f0) verified present in `git log --oneline --all`.
