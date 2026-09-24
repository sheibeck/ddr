---
created: 2026-09-24T09:30:00.000Z
title: Rebalance sound levels — death too loud, steps and the title theme too soft
area: audio
files:
  - src/browser/sfx.js (one-shots all play at the device master gain; MUSIC_GAIN = 0.5 for the theme; startLoop(handle, trackId, gain))
  - sfx/death.mp3 (hero death; also check foe-die.mp3), sfx/walk1-3.mp3 + walk-water1-3.mp3 (steps), sfx/theme.mp3 (title loop)
  - test/unit/sfx-*.test.js (pins for the new table)
---

## Problem

From the user's Pixel 7 session on the 2.0.0 debug build (2026-09-24): "death sounds are too loud, and normal step sounds and the music are too soft in comparison with other sounds."

There is no per-clip level today. Every one-shot plays at the same master gain, so each clip's loudness is baked into its mp3. The title theme plays at `MUSIC_GAIN = 0.5` (a Phase 70 / quick 260924-51h choice), which is half the one-shot level.

## Solution

Do it in code, not by re-editing the mp3s. That is faster, reversible, and the user can tune by ear.

- Add a frozen `CLIP_GAIN` table in `src/browser/sfx.js`, keyed by clip id, with a default of 1.0. Apply it per voice through a GainNode between the clip's source and the master gain. Web Audio allows values above 1.0 for a quiet clip; cap at about 2.0 to avoid clipping.
- Starting values, to be tuned on device:
  - `death` 0.5 (check `foe-die` too, since the user may mean both)
  - every `walk*` and `walk-water*` clip at 1.6
  - `MUSIC_GAIN` raised from 0.5 to 0.9
- One place to tune: the user can edit the numbers directly, and the ids match the file names in `sfx/`.
- Tests:
  - every key in `CLIP_GAIN` is a real clip id (checked against AUD-06's manifest)
  - every value is a number in (0, 2]
  - the one-shot path applies the gain
- Presentation only: no engine, content or parity changes. It fits as a quick task, or as a follow-up plan in v2.0's Phase 70 if the user wants it in this release.

**Answer to "is it easier to do it myself?":** yes and no. Rebalancing the mp3 files by hand in Audacity (Effect → Amplify/Normalize) also works, but it's slower to iterate and has to be redone whenever a clip changes. The per-clip table is a small code change, and after it the user can tune any sound by editing one number.
