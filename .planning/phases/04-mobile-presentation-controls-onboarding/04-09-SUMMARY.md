---
phase: 04-mobile-presentation-controls-onboarding
plan: 09
status: complete
completed: 2026-09-09
---

# Summary: Settings screen + @capacitor/haptics + confirm gates + live text-scale

## What was already delivered (DR9), and what this pass closed

Most of 04-09 landed earlier through the device-review loop (DR9): the Settings
bottom sheet (`#mw-settings-sheet`) already exposes all six fields — sound,
haptics, text size (S/M/L), handedness/control, confirm-before-quit, and
diceMode — each persisted via `settings.js` `writeSetting()`; live
`--mw-text-scale` (UX-08); the CUT LOSSES / Abandon-character confirm-before-quit
gate (`shouldConfirmQuit`); and always-confirmed destructive actions. A guarded,
fail-open `src/browser/haptics.js#maybeHaptic` seam and the settings toggle's
call bridge were also scaffolded then — but the **Haptics toggle was a dead
switch**: `@capacitor/haptics` was deliberately not installed/vendored, so the
setting persisted a value nothing could act on.

This pass made the toggle real and wired haptics to actual game beats.

## Changes

- **`package.json`** — installed `@capacitor/haptics@^8.0.2` (peer
  `@capacitor/core >=8` satisfied by 8.5.1; same ionic-team scope/publisher as
  the already-trusted `@capacitor/*` plugins — T-04-SC verdict OK/Approved).
- **`tools/build-www.mjs`** — added `@capacitor/haptics` to `CAPACITOR_PACKAGES`
  so it is vendored into `www/vendor/@capacitor/haptics` + added to the import
  map exactly like the other plugins (reached only via the guarded dynamic
  import; no network fetch — offline/no-SDK posture preserved).
- **`src/browser/haptics.js`** — updated the header (plugin now installed) and
  added a test-only `__mzHapticsImportOverride` hook mirroring nativeChrome.js's
  `__mzAppImportOverride`, so `node --test` can inject a fake plugin and assert
  `impact()` is actually CALLED (or not) without resolving the bare specifier.
  Production always falls through to the real `import("@capacitor/haptics")`.
- **`mazeworld.html`** —
  - Added a module-scope `hapticForEvents(events)` helper (next to
    `noteCombat`): fires ONE `maybeHaptic(currentSettings, style)` for the
    strongest beat in a dispatched action's events — Heavy for a sprung trap
    (`trapSprung`) / level-up (`leveled`) / critical hit, Medium for an ordinary
    landed hit (`struck`), Light for taking a foe's hit (`struckByFoe`).
  - Called it from the two gameplay event paths: `window.move` (engineMove →
    trap/level-up beats) and `engineCombatAction` (hit/crit/level-up beats).
  - Retired the DR9 illustrative per-d-pad-tap `maybeHaptic` call — a Light buzz
    on *every* tap (including blocked moves into walls) was too noisy once the
    plugin became real. Plain steps now stay silent; only meaningful beats buzz.
- **`test/unit/haptics.test.js`** — added call-assertion tests via the injected
  fake plugin: impact() FIRES when haptics ON + native (with correct style
  mapping), and does NOT fire when the setting is OFF or off-device; plus the
  default-style ("Light") mapping. 8/8 green.

## Verification

- `npm test` — **499/499 green** (was 495; +4 net new haptics call-assertions).
- `node tools/build-www.mjs` — vendors `@capacitor/haptics`, rewrites its 2 ESM
  files' relative specifiers, adds it to the import map.
- `npx cap sync android` registers `@capacitor/haptics@8.0.2` as a native
  plugin (6 Capacitor plugins total); `pin-jdk.mjs` re-applied (sync wipes it).
- `./gradlew assembleDebug` — BUILD SUCCESSFUL; installed + force-relaunched on
  the Pixel 7 (28051FDH200H0R) for device review.

## Notes / device-review follow-ups

- Haptic feel/intensity on the real beats is a device-review tuning item (the
  Heavy/Medium/Light mapping is a first cut). If a subtle tick on every step is
  wanted back, it's a one-line add in `hapticForEvents`.
- 04-10 (first-run coach-mark tutorial) remains the deliberate LAST Phase-4 item
  (deferred until the UI settles). 04-07 (engine routing) and 04-08 (HERO/ORACLE/
  combat screens) were delivered substantively across the DR loop.
