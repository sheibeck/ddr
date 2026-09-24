---
phase: 71-device-round-polish-ii
plan: 01
subsystem: audio / settings sheet
status: complete
tags: [vanilla-js, presentation-only, web-audio, settings, milestone-v2.0]
requirements: [POLISH-05]
requires: []
provides:
  - "src/browser/sfx.js: CLIP_GAIN, clipGain, volumeLevels, MUSIC_GAIN 0.9, the effects bus, optional backend setLevels/setLoopLevel"
  - "src/browser/settings.js: volMaster / volMusic / volEffects (integers 0-100, default 100)"
  - "mazeworld.html: #mw-vol-rows MASTER / MUSIC / EFFECTS sliders under the Sound row"
affects:
  - "Any future backend fake: start() now receives a third gain argument (ignorable)"
  - "ddr.settings.v1 now carries 11 keys"
tech-stack:
  added: []
  patterns:
    - "Per-voice GainNode -> effects bus -> master; music gain -> master (R-04)"
    - "Settings validator entries may be an allowed-values array OR a predicate"
    - "Slider: input event = live apply without persist; change event = persist once"
key-files:
  created:
    - test/unit/sfx-levels.test.js
    - test/unit/settings-volume-shell.test.js
  modified:
    - src/browser/sfx.js
    - src/browser/settings.js
    - mazeworld.html
    - docs/SHELL-MODULES.md
    - test/unit/sfx-music.test.js
    - test/unit/settings.test.js
    - test/unit/shell-gear-toolbar.test.js
    - test/unit/sfx-settings.test.js
decisions:
  - "R-01: the slider group is static markup with `hidden` while Sound is Off; the existing .mw-settings-row[hidden] rule (plus the global [hidden]{display:none!important}) removes it from layout, tab order and the accessibility tree"
  - "R-02: input applies {...currentSettings, [key]: value} through applySettings with no storage write; change persists once via writeSetting; the ui-tap preview plays on EFFECTS release only"
  - "R-03: foe-die keeps the 1.0 default; the hero-death cue is `death` (the `died` event)"
  - "R-04: the theme's gain node feeds the master directly, not the effects bus: MASTER scales everything, EFFECTS the one-shots, MUSIC the theme"
  - "applySfxSettings re-applies levels on every call while a device is open (not only on a vol-key diff); cheap and keeps the contract simple"
metrics:
  duration: "~45 min"
  completed: 2026-09-24
  tasks: 3
  commits: 7
---

# Phase 71 Plan 01: Sound balance and volume sliders Summary

This plan adds one hand-tunable per-clip gain table (death 0.5, footsteps 1.6), raises the title theme to MUSIC_GAIN 0.9, and adds MASTER / MUSIC / EFFECTS sliders under the Sound row. The sliders are persisted in `ddr.settings.v1` and apply live through a new effects bus and per-voice gain nodes.

It closes the source todo `.planning/todos/pending/2026-09-24-rebalance-sound-levels-death-too-loud-steps-and-theme-too-soft.md`. The orchestrator moves it to `todos/done/` on merge, per D-13.

## What was built

**Task 1: sfx.js level layer (D-01, D-02, D-03)**
- `CLIP_GAIN` is a frozen table keyed by clip id: `death` 0.5, and `walk1..3` and `walk-water1..3` at 1.6. `foe-die` is deliberately absent (R-03).
- `clipGain(id)` reads own keys only, clamps values into (0, 2], and falls back to 1.0.
- `MUSIC_GAIN` goes from 0.5 to 0.9. The R-09 comment is rewritten.
- `volumeLevels(settings)` is pure and returns frozen `{ master, music, effects }`. It accepts integers 0-100 and divides by 100; anything else reads 1.0.
- DEFAULT_BACKEND:
  - `open()` adds `effectsGain`, wired to the master.
  - `start(handle, buffer, gain)` routes source → a per-voice gain → the effects bus (falling back to master, then destination). The voice it returns is still the source node.
  - New optional `setLevels(handle, { master, effects })`.
  - New optional `setLoopLevel(handle, voice, gain)`, which does nothing while `voice.pauseTimer` is set.
- Module state:
  - `playClips` passes `clipGain(clipId)` to `start`.
  - A new internal `applyLevels()` runs after `deviceHandle = handle` in `unlockSfx`, and at the end of every `applySfxSettings`.
  - `startMusic` passes `MUSIC_GAIN * music`.
  - The Sound Off/On contract is unchanged.

**Task 2: settings.js (D-03)**
- `volMaster`, `volMusic` and `volEffects` are appended after `pgsDevSignedIn`, defaulting to 100. There are now 11 keys, in order.
- `ALLOWED_VALUES` entries can now be a predicate. `isVolumeLevel` accepts only `Number.isInteger` values from 0 to 100.
- `isValidSettingValue` checks own keys only.
- Header and JSDoc counts go from eight to eleven, plus a Phase 71 paragraph (the tolerant merge, no migration).

**Task 3: the sliders (D-03, R-01, R-02)**
- **Markup:** `#mw-vol-rows` (a `.mw-settings-row`, starts `hidden`) sits directly after the Sound row, before Haptics. It holds three rows, Master, Music and Effects, uppercased by CSS. Each row has a label, a `data-vol-pct` percentage, and a native `input type="range"` with min 0, max 100, step 1, `data-vol` and an aria-label.
- **CSS:** the `.mw-vol-*` rules use the settings palette (#1b170f track, #4a4032 border, #e8c97a thumb and percentage). The range input is full width and 44px tall, with a 28px square thumb. Label and percentage sizes use `calc(… * var(--mw-text-scale))`. There is no transition or animation, and no aria-disabled selector.
- **renderSettingsSheet:**
  - sets `hidden = currentSettings.sound !== true`;
  - writes each slider's value and percentage (falling back to 100);
  - leaves the `.active` loop untouched.
- **Listeners:** delegated `input` and `change` listeners on `#mw-settings-rows`, with an inline `volSliderValue` clamp.
  - `input` → `applySettings({ ...currentSettings, [key]: value })` and a percentage update. It never calls writeSetting.
  - `change` → `writeSetting` → `applySettings(next)` → `renderSettingsSheet()`, then `if (key === "volEffects") playUiTap();`.
- **docs/SHELL-MODULES.md:** adds a Phase 71 "Levels" paragraph under Title music and updates the MUSIC_GAIN mention. The file is saved with LF, and `node tools/bridge-doc.mjs --check` exits 0.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | fd43016 | test(71-01): add failing tests for per-clip levels, the effects bus and live volume levels |
| 2 | 7692dcf | feat(71-01): per-clip levels, the effects bus and live volume levels |
| 3 | 76825be | test(71-01): add failing tests for the volume levels in ddr.settings.v1 |
| 4 | 1e7ddd3 | feat(71-01): volume levels in ddr.settings.v1 |
| 5 | b9974f5 | test(71-01): add failing shell pins for the MASTER/MUSIC/EFFECTS sliders |
| 6 | 8724552 | feat(71-01): master, music and effects sliders under Sound |
| 7 | 45f9c7e | test(71-01): allow the EFFECTS release preview as the second playUiTap call site |

## Verification

- Task 1 verify set (sfx-levels, sfx-music, sfx, sfx-settings, sfx-cues, sfx-map, sfx-assets, beat-audio, titleMusic): 139/139 pass.
- Task 2 verify set: 55/55 pass.
- Task 3 verify set: 114/114 pass, and `node tools/bridge-doc.mjs --check` exits 0.
- `npm test` (worktree): **5234 / 5241 pass**. The 7 failures are the known CRLF doc-ledger artifacts (Outliers/AFTER/Handoff/v1.5 AFTER, and the three flee Modifier/Before-after table tests). There are no other failures.
- Scope: `git diff --stat dd06b3f..HEAD` touches no engine/, content/, test/parity/ or sfx/ file (AUD-06 is green). paint() and draw() are untouched, and the reduced-motion SHA pins are green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sfx-settings pinned exactly one playUiTap( call site**
- **Found during:** full `npm test` after Task 3.
- **Issue:** `test/unit/sfx-settings.test.js` asserted exactly one `playUiTap(` call site in mazeworld.html. The plan-mandated EFFECTS release preview adds a second one.
- **Fix:** the pin now expects 2 call sites, and the new one must be exactly `if (key === "volEffects") playUiTap();`. unlockSfx( stays pinned at 1.
- **Files modified:** test/unit/sfx-settings.test.js
- **Commit:** 45f9c7e

**2. [Rule 1 - Test fix] settings-volume-shell styleBlock()**
- **Issue:** the RED test's styleBlock() read only the first `<style>` block. mazeworld.html has four, and the settings rules live in the last.
- **Fix:** the helper now spans the first `<style>` to the last `</style>`, the same shape shell-combat-screen uses. The fix was folded into the Task 3 GREEN commit.
- **Commit:** 8724552

**3. [Rule 3] Round-trip deepEqual in settings.test.js**
- The existing "each of the 5 fields round-trips" test deep-equals the full settings object. It gained the three vol keys at 100. This was needed for the 11-key schema.
- **Commit:** 76825be

No architectural changes. There were no auth gates.

## Known Stubs

None.

## Threat Flags

None. T-71-01 is mitigated three times over: the settings.js predicate, volumeLevels re-validation and the clipGain clamp. T-71-02 is mitigated too: every new backend method swallows its own failure, a missing method is a no-op, and the Sound-Off gate still opens no device.

## Human verification (deferred)

These go to the Phase 71 device round, folded into docs/UAT-v2.0.md section M by 71-06. The orchestrator installs the debug APK per D-13.

1. The hero-death sound is clearly quieter than before and the footsteps (dry and water) are clearly louder. The title theme is louder but still sits under a footstep or a UI tap.
2. In Settings with Sound On, MASTER, MUSIC and EFFECTS show directly under Sound. Sound Off hides all three and silences everything. Sound On brings them back at the saved levels.
3. On the title with the theme playing, drag MUSIC to 0 and back to 100: the theme follows the finger live. Drag MASTER to 0: everything goes silent, and at 100 everything is back.
4. Releasing EFFECTS plays exactly one tap sound at the new level. Releasing MASTER or MUSIC plays nothing.
5. Force-close and relaunch: the three levels are as you left them.
6. At text size L the three slider rows are readable and easy to drag with a thumb, and the sheet still scrolls to the Version row.

## Self-Check: PASSED

- FOUND: src/browser/sfx.js, src/browser/settings.js, mazeworld.html, docs/SHELL-MODULES.md
- FOUND: test/unit/sfx-levels.test.js, test/unit/settings-volume-shell.test.js
- FOUND commits: fd43016, 7692dcf, 76825be, 1e7ddd3, b9974f5, 8724552, 45f9c7e
