---
phase: 71-device-round-polish-ii
plan: 07
subsystem: audio
status: complete
tags: [vanilla-js, presentation-only, web-audio, input, accessibility, milestone-v2.0]
requirements: [POLISH-10, POLISH-12]
requires:
  - 71-01 EFFECTS release preview (`if (key === "volEffects") playUiTap();`)
  - 71-03 combat action lock (data-locked on #cb-act and each action)
  - 71-04 long-press recognizer and its window capture-phase click suppressor
  - Phase 32 guardTap/encArmed/armEncounterButtons, Phase 58 beatHurryTap and window.__mzBeat
provides:
  - src/browser/uiTap.js (UI_TAP_SELECTOR, uiTapShouldPlay, createUiTapSound)
  - src/browser/sfx.js sfxClipCount() (started one-shot voices)
  - the classic tapGuards registry in guardTap and window.__mzTapArmed(el)
  - the capture-phase document click listener that plays the UI tap; the pointerdown listener only unlocks
  - the dispatch audioCtx.onWater flag and the "water on every water square" step rule
  - docs/UAT-v2.0.md M29..M34 (+ M16 re-worded)
affects:
  - 71-08 (the tapGuards/__mzTapArmed seam; its chit-tap card's sound follows 71-07)
  - every button tap sound in the app (click, not touch)
tech-stack:
  added: []
  patterns:
    - "decide in the capture phase, play one task later (setTimeout 0) only if the press's own handlers made no sound"
    - "a WeakMap guard registry so a sound asks the same predicate the handler asks, never a stale marker"
key-files:
  created:
    - src/browser/uiTap.js
    - test/unit/uiTap.test.js
    - test/unit/ui-tap-shell.test.js
    - .planning/phases/71-device-round-polish-ii/71-07-SUMMARY.md
  modified:
    - src/browser/sfx.js
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - docs/UAT-v2.0.md
    - test/unit/sfx.test.js
    - test/unit/sfx-settings.test.js
    - test/unit/title-music-shell.test.js
decisions:
  - "R-24: a guardTap-wrapped button's tap sound follows its own arm guard (tapGuards + window.__mzTapArmed), never its aria-disabled marker, which is stale on every #mm-conditions chip; an unguarded element is judged by disabled/aria-disabled"
  - "R-25: mid-beat, a tap on a button inside #enc-panel is D-06's skip and is silent"
  - "R-26: one sound per press — the tap is decided in the capture phase and played one setTimeout(0) task later only if sfxClipCount() did not move and no round began"
  - "R-27: a long press never clicks — 71-04's window capture-phase suppressor stops the trailing click before the document tap listener"
  - "D-17: the step rule plays water when ctx.onWater is true OR a waded event is present; onWater is read from result.state.floor.g[py][px].water"
metrics:
  duration: ~30 min
  completed: 2026-09-24
  tasks: 4
  files: 11
---

# Phase 71 Plan 07: The UI tap sound on a real press, and wet water steps — Summary

The UI tap sound now plays on a real click, not when a finger lands, so scrolling over a button is silent. Disabled, locked, guard-swallowed, mid-beat skip and long-press taps are silent too. Buttons with their own clip (GO DOWN, STRIKE) make one sound, not two. Every step onto a water square now splashes, not just the first one.

## Source todos

- `.planning/todos/pending/2026-09-23-ui-tap-sound-plays-when-scrolling-over-a-button.md` (POLISH-10, D-15). This plan closes it.
- `.planning/todos/pending/2026-09-22-water-square-walk-sound-should-play-every-step-not-just-on-en.md` (POLISH-12, D-17). This plan closes it.

Moving both to `.planning/todos/done/` is the orchestrator's job after the merge (D-13). This plan did not move them.

## What was built

- **`src/browser/uiTap.js`** is new and pure: no DOM globals, no timers, no imports.
  - `UI_TAP_SELECTOR` is `button, [role="button"]`.
  - `uiTapShouldPlay(target, { armedFor, beatActive })` returns false in these cases:
    - no button in the chain (the map canvas, a range input, a text node);
    - `disabled`;
    - `[data-locked]` on the button or an ancestor;
    - mid-beat inside `#enc-panel`;
    - a guard answer of `false`;
    - no guard answer and `aria-disabled="true"`;
    - any throw.
  - `createUiTapSound({ play, clipCount, beatActive, armedFor, schedule })` returns `{ onClick }`. It snapshots the one-shot count and the beat state in the capture phase and schedules one task. It never stops, prevents or dispatches.
- **`sfx.js`** adds `sfxClipCount()`, a count of the one-shot voices `playClips` started. It never counts the theme loop, and Sound Off never resets it. The step rule plays `water` when `ctx.onWater === true` or when a `waded` event is present.
- **`mazeworld.html` (classic script)** adds `const tapGuards = new WeakMap()` directly above `guardTap`. `guardTap` registers `tapGuards.set(btn, encArmed)`; its head and other statements are unchanged. `window.__mzTapArmed(el)` returns the guard's boolean answer, or null for an unwrapped element or on a throw.
- **`mazeworld.html` (module script)**:
  - It imports `createUiTapSound` and `sfxClipCount`.
  - It builds `uiTapSound` from `playUiTap`, `sfxClipCount`, `window.__mzBeat.active`, `window.__mzTapArmed` and `setTimeout(fn, 0)`.
  - The first-gesture `pointerdown` listener now only calls `unlockAudioAndSync()`.
  - Directly after it, `document.addEventListener("click", (e) => uiTapSound.onClick(e), { capture: true })` plays the tap.
  - The Phase 56 comment block and the 71-01 slider comment are rewritten to match.
  - The dispatch `audioCtx` gains `onWater: !!postFloor?.g?.[postFloor.py]?.[postFloor.px]?.water`, where `postFloor` is `result.state?.floor`.
- **`bridge.js` / `docs/SHELL-MODULES.md`**: a new `__mzTapArmed` entry (the classic script owns it; the module reads it), the bridge table regenerated, and a D-15 paragraph next to the 71-01 Levels paragraph.

## Rulings (R-24..R-27)

- **R-24: the guard's answer beats the stale marker.**
  - *Evidence:* `paintConditions` sets `host.innerHTML = ""` and calls one `guardTap` per chip on every paint. `guardTap` stamps `aria-disabled="true"` on each chip. `armEncounterButtons`' sweep covers only `#enc-panel`, `#mw-rail` and `.mw-legend-sheet`, never `#mm-conditions`, so a live condition chip keeps `aria-disabled="true"` for good.
  - `ui-tap-shell (b)` proves this with a real chip that `paintConditions` built: the marker is still `"true"` after the arm window, `__mzTapArmed` answers true, and the tap plays. Under a marker rule, every condition chip would be silent.
  - The settle guard (`DISMISS_SETTLE_MS`) gates only `window.move`, and the map canvas never matches a button, so the sound has nothing to follow there.
- **R-25: the skip tap is silent.** While `__mzBeat.active()` is true, a button inside `#enc-panel` is beatHurryTap's skip. A locked action is silent for two reasons: it carries `data-locked`, and its `pointer-events:none` sends the tap to a non-button.
- **R-26: one sound per press.**
  - *Evidence of the old double sound:* the old `pointerdown` tick played for every button. GO DOWN then played `stairs` through the dispatch seam, and STRIKE played its round's first beat. `combatBeat.start()` fires line 0 in the same click task.
  - The tap is now deferred one `setTimeout(0)` task, which runs after every listener of that click. A microtask would run between listeners. The tap plays only if `sfxClipCount()` did not move and no round began.
  - The theme loop never counts. A later beat line is a new sound, not a second one for this press.
- **R-27: a long press never clicks.** 71-04's suppressor is a `window` capture-phase click listener, the first listener any click meets. After a fired long press it calls `stopPropagation()` on the trailing click, so the `document` tap listener never runs. This is pinned by the listener hosts and by `uiTap.test (c)/(d)`, which use the real `createLongPress`.
- **Keyboard and TalkBack** activation fire click and now make the tap sound. D-15 accepts this.

## Seam for 71-08

`tapGuards` / `window.__mzTapArmed` is the seam. When 71-08 gives the hero condition chips their own guard for the combat chit-tap card (D-16), it can register that predicate the same way: `tapGuards.set(chip, itsGuard)`, or wrap the chip through `guardTap`. The chip's tap sound then follows that guard with no change to `uiTap.js`. `#mm-conditions` still gets no arm sweep, so the chips' markers stay stale; R-24 already makes that harmless for the sound.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] title-music-shell (6) was matching the wrong listener**
- **Found during:** Task 2 GREEN
- **Issue:** The test searched for `"pointerdown",\s*\(e\) => \{`. 71-04's `#enc-panel` pointerdown listener, which sits earlier in the file, also matches that. The test's region therefore ran from the long-press listener to the unlock listener's `{ capture: true }`, and the new `createUiTapSound({ play: () => playUiTap() … })` block fell inside that region.
- **Fix:** Anchored (6) on `"pointerdown", (e) => { unlockAudioAndSync();`, the same regex (3) and the new ui-tap-shell pin use. It now asserts that the region has no `playUiTap`.
- **Files modified:** test/unit/title-music-shell.test.js
- **Commit:** 4185f40

**2. [Rule 1 - Test bug] ui-tap-shell's click-listener argument extraction**
- **Found during:** Task 2 GREEN
- **Issue:** The first version gave `extractCallArgs` a marker that did not end in `(`.
- **Fix:** The test now extracts from `document.addEventListener(` at the click listener's index.
- **Commit:** 4185f40

### Choices within the plan

- **A throwing or non-number `clipCount` means silence.** `createUiTapSound` treats it as "silent" (T-71-14: a throw means silent), not as "play anyway".
- **UAT merges, recorded in the Source map:**
  - 71-07-S5 (a long press is silent, then a short tap clicks and aims) merged into **M16**, re-worded, because M16 already walks the long press followed by a short tap.
  - The EFFECTS-preview half of 71-07-S6 merged into **M4**. The ☰ half became its own edge row, **M33**, which says "see M4".
  - The other five items got their own rows: M29 to M32 and M34.
  - No L or M row claimed that a tap "clicks on touch", and no row claimed a locked-action sound that D-15 changes, so nothing else was re-worded.
- **`onWater` reads `.water` on the post-dispatch square, as D-17 says.** A party flying or ether-walking over water therefore also hears the splash. The engine's `waded` event skips those cases, because it fires only when `cost > 1`. If the device round finds this wrong, the fix is to also gate on "stepped at water cost". Recorded here, not changed.

## Gate results

- `npm test`: 5451 tests, 5444 pass, 7 fail. The 7 failures are the known worktree CRLF doc-ledger artifacts: 3 Outliers/AFTER/Handoff tests, the v1.5 AFTER section, and 3 flee-table tests. No other failures.
- `node tools/bridge-doc.mjs --check`: exit 0.
- `git diff --stat 8082daa HEAD -- engine content test/parity sfx`: empty. This plan changed no engine, content, parity or sfx/ asset file.
- The reduced-motion SHA-256 pins on `paint()`/`draw()` pass, so both are byte-identical. `beatHurryTap` and 71-04's long-press wiring are untouched.
- `#enc-panel` still has exactly one capture-phase click listener (CSCR-08). The shell has one `unlockSfx(` call site and two `playUiTap(` call sites: the factory's `play` and the EFFECTS preview.

## Known Stubs

None.

## Human verification (deferred)

These are deferred to the Phase 71 device round, in docs/UAT-v2.0.md section M. The orchestrator installs the debug APK (D-13).

1. **[71-07-S1] (M29)** Scroll the Gear tab, the Oracle, the settings sheet and a Leaderboards board, starting each scroll with a finger on a button or row. No click sound plays.
2. **[71-07-S2] (M30)** A real tap on a tab, the ☰ button, a settings option or a Gear row still clicks, once, on release.
3. **[71-07-S3] (M31)** GO DOWN on the stair card and STRIKE in a fight each play only their own sound, with no extra click in front.
4. **[71-07-S4] (M32)** Mid-round, tap a dimmed (locked) combat action and then a foe card. The round lands, and neither tap clicks.
5. **[71-07-S5] (M16)** Long-press a foe. You get the buzz and the card with no click sound. A short tap on the same foe afterwards clicks and aims.
6. **[71-07-S6] (M33, M4)** *(edge)* Open the ☰ during an encounter and tap the dimmed MAKE CAMP row: no click. Release the EFFECTS slider: exactly one preview tap.
7. **[71-07-S7] (M34)** Walk across several water squares in a row: every step splashes. Stepping out onto dry ground plays the ordinary footstep.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 RED | dbcc39a | test(71-07): add failing tests for the click-driven UI tap sound |
| 1 GREEN | 9b15c82 | feat(71-07): the tap sound decides on click, one sound per press |
| 2 RED | 61c7db1 | test(71-07): add failing shell pins for the click-driven tap sound |
| 2 GREEN | 4185f40 | feat(71-07): the UI tap sound plays on click, never on a scroll, a lock or a long press |
| 2b RED | bfabde3 | test(71-07): add failing tests for water steps on every water square |
| 2b GREEN | e106b83 | feat(71-07): water steps sound wet on every water square |
| 3 | 95c9913 | docs(71-07): fold the tap-sound device checks into UAT-v2.0 |

## TDD Gate Compliance

Tasks 1, 2 and 2b each have a `test(71-07)` RED commit followed by a `feat(71-07)` GREEN commit. The RED runs failed as expected:
- Task 1: the module and the export were missing.
- Task 2: 9 shell pins failed.
- Task 2b: the water→water case failed.

## Self-Check: PASSED

src/browser/uiTap.js, test/unit/uiTap.test.js and test/unit/ui-tap-shell.test.js exist; all seven commits (dbcc39a, 9b15c82, 61c7db1, 4185f40, bfabde3, e106b83, 95c9913) are in the branch history.
