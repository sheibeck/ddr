---
quick_id: 260928-mus
status: complete
date: 2026-09-28
---

# Quick 260928-mus: double the music volume (summary)

(Written by the orchestrator from the executor's returned text.)

**Result:** `MUSIC_GAIN` 0.9 → 1.8 in src/browser/sfx.js, so the theme's default level is doubled (+6 dB). This follows the user ruling of 2026-09-27, which supersedes R-09's "below the one-shots' unity level". Commits 0d1f42fc (fix and tests) and 03d95192 (the todo move).

## Measurement
`sfx/theme.mp3` was decoded with headless Chrome (OfflineAudioContext; ffmpeg isn't installed): stereo, 44.1 kHz, 108.97 s.
- Sample peak: 0.0369 (−28.7 dBFS).
- RMS: −42.7 dBFS.
- Loudest 400 ms block: −39.4 dBFS.

At 1.8× the peak is about −23.6 dBFS, so there's no clipping risk. The file is unchanged, and no limiter was needed.

## Android
One backend: an HTMLAudioElement feeding a Web Audio GainNode, then the master gain, inside the WebView. A GainNode accepts 1.8, so the doubling applies on the device.

**Bug fixed:** the bare-element fallback set `el.volume = gain`. A real element throws above 1, and the throw was swallowed, so the level would have stayed stuck. It now clamps to 0..1.

## Sliders
- MUSIC: 0 is silent, 50 is the old 0.9, and 100 (the default) is 1.8.
- MASTER still applies on top.

## Tests
- sfx-levels.test.js and sfx-music.test.js re-pinned to 1.8, with the ruling quoted.
- New tests: the slider mapping, the real backend's gain node, and the fallback clamp. The fake element now throws above 1.

## Gates (worktree)
npm test 7,506/7,506; parity 66/66; build:www + boot:check PASS.

## Note for the user
The theme file itself is mastered very quietly (peak −28.7 dBFS). If the music still sounds soft after doubling, the next step is to re-master the file louder (there's about 28 dB of headroom), not to raise the gain further.

## Pixel 7 check
At default settings the theme is clearly louder and doesn't distort; the MUSIC slider still turns it down, and 0 is silent.
