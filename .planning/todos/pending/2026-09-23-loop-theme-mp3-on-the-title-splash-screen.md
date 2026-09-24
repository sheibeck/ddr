---
created: 2026-09-24T01:24:45.354Z
title: Loop theme.mp3 on the title (splash) screen
area: ui
files:
  - sfx/theme.mp3 (new, 2.3 MB, added by the user 2026-09-23, not yet committed)
  - src/browser/sfx.js (WebAudio clip loader at ~353 fetch("./sfx/<id>.mp3"); unlockSfx ~416; stopAllSfx 576; applySfxSettings 605)
  - src/browser/settings.js (sound setting ~49)
  - mazeworld.html (showTitleScreen / hideTitleScreen ~6608-6625)
---

## Problem

The user added `sfx/theme.mp3` and wants it to **loop while the player is on the splash/title screen** (the "DUNGEON / ROLL A NEW HERO / VIEW THE DEAD" gate). Nothing plays music today; `sfx.js` only plays one-shot clips.

## Solution

TBD. Hints:
- Loop through the existing WebAudio path (an `AudioBufferSourceNode` with `loop = true`) or a single `<audio loop>` element. Start on `showTitleScreen`, stop or fade out on `hideTitleScreen` and when the Leaderboards panel opens from the title (decide whether music continues on the title-opened panel).
- Respect the `sound` setting (`applySfxSettings`); stop in `stopAllSfx` and on app pause/background (`nativeChrome.js`'s pause listener).
- Autoplay: the Android WebView blocks audio before a user gesture. Music can only start on the first tap (`unlockSfx`), so decide whether it begins on the first touch or whether the native splash counts. "Splash screen" most likely means the title screen; the Capacitor native splash shows for under a second before the WebView loads. Confirm with the user.
- 2.3 MB: decode lazily after the first paint so boot isn't delayed; check the AAB size budget (PERF-03 tracked AAB growth).
- Commit `sfx/theme.mp3` with the implementing task. **Until then `npm test` shows 1 failure:** `test/unit/sfx-assets.test.js` AUD-06 pins exactly 30 clips in `sfx/`. The implementing task must add the theme to that test as a music track (or move it to a `music/` folder) rather than widening the clip count.
- Presentation-only, no engine impact. A quick task after v2.0, or folded into Phase 69's device close if the user wants it in this release.
