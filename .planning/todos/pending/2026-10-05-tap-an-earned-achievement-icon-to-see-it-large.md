---
created: 2026-10-05T23:40:00.000Z
title: Tap an earned achievement icon to see it large
area: ui
target: after 2.5.0 (user, 2026-10-05)
files:
  - src/browser/achievementsSheet.js
  - mazeworld.html (#mw-achievements-sheet)
  - achievements/build_achievements.py
  - tools/build-www.mjs
---

## Problem

User, 2026-10-05, on the v2.5 debug build (Pixel 7): "it's hard to see the icons on my Google Pixel 7. Could we make it so you can click on earned achievements to show a bigger version of the achievement icon?" The list uses the 144 × 144 `achievements/ingame/` exports, which are small on the phone and would look soft if scaled up.

## Solution

User rulings (2026-10-05):

- Tapping an EARNED achievement's icon (a single row's icon, or an earned tier's icon in an expanded track) opens it large: the icon plus its name, line and the date earned. A tap or Android back closes it. Locked and secret icons do not open it, so secrets stay secret.
- Use sharp art: add a ~320 × 320 transparent export per achievement, made from `achievements/master/` by `build_achievements.py` (Pillow, NumPy and SciPy are under `python` here), and ship it in `www/` alongside `ingame/`. That is about 3 MB more in the app.
- The track head stays a button that expands or folds the track. Only the icon opens the large view.
- Keep the sheet conventions: TalkBack (the icon becomes a labelled button for earned entries), reduced motion, and every layout class (re-run `npm run layout:check`).
- Lands after 2.5.0, with the roller Human-description fix (todo 2026-10-05-roller-hides-the-human-race-description).
