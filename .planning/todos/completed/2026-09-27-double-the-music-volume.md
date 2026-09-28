---
created: 2026-09-28T01:10:00.000Z
title: Double the music volume
area: audio
files:
  - src/browser/sfx.js:1090-1095 (MUSIC_GAIN = 0.9; raised from 0.5 on the 2026-09-24 Pixel 7 round)
  - src/browser/settings.js:99 (volMusic default 100)
  - test/unit/sfx-levels.test.js:89-95 (pins MUSIC_GAIN 0.9, "below the one-shots' unity level")
  - sfx/theme (the music file) and tools that copy it to www/sfx/
---

## Problem

User (2026-09-27, Pixel 7 debug build): "we reduced the volume of our music too fast. Double the volume of the music. Users can always turn it down in settings."

The theme loop plays at MUSIC_GAIN (0.9) × the MUSIC slider (default 100) into the master gain. The user wants it twice as loud by default.

## Solution

- Double the music's default loudness (2× the current level; about +6 dB).
- Doubling MUSIC_GAIN to 1.8 pushes a Web Audio gain above unity, which can clip if the theme file is already near full scale. Measure the theme file's peak and loudness first:
  - with headroom (peak ≤ about −6 dBFS): set MUSIC_GAIN to 1.8;
  - without: re-master the theme file +6 dB with a limiter (keeping it clip-free) and keep the gain at or below 1.0.
  - Record which, with the measured numbers.
- The R-09 rule ("the loop sits below the one-shots' unity level") is superseded by this user ruling: re-pin sfx-levels.test.js with the ruling as the reason.
- The MUSIC slider still scales it down, and 0 stays silent.
- Pixel 7 check: the theme is clearly louder at the default settings, doesn't distort, and the MUSIC slider still turns it down.
