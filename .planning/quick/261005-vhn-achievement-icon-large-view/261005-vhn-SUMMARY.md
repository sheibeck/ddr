---
quick_id: 261005-vhn
slug: achievement-icon-large-view
date: 2026-10-05
status: complete
commits: [58a30734, 7a02bd9b, 7699a1a7]
key-files:
  created:
    - achievements/build_large.py
    - achievements/large/ (77 PNGs, 320 x 320)
    - test/unit/achievements-large-view.test.js
  modified:
    - src/browser/achievementsSheet.js
    - src/browser/achievementCard.js
    - src/browser/roller.js
    - mazeworld.html
    - tools/build-www.mjs
    - tools/layout-check.mjs
    - test/unit/achievement-assets.test.js
    - test/unit/achievements-sheet-shell.test.js
    - test/unit/achievements-sheet-render.test.js
    - test/unit/achievements-shell-a11y.test.js
    - test/unit/roller.test.js
    - docs/SHELL-MODULES.md
    - achievements/README.md
---

# Quick 261005-vhn: Tap an earned achievement icon to see it large, and the roller shows Human

**One-liner:** An earned achievement's icon is now a labelled button ("<name>, view larger") that opens a sharp 320 px overlay with the name, line and earned date, and the roller finally describes a Human hero's race.

## What was built

### Task 1 - sharp 320 px icons (58a30734)
- `achievements/large/`: 77 transparent 320 x 320 PNGs (5.2 MB), same `ach_<id>.png` stems as `ingame/`, made from `master/` with the same LANCZOS resize `build_achievements.py` uses for 144 px.
- `achievements/build_large.py` writes only that folder. `build_achievements.py`'s `main()` was never run: `git status` shows `play/`, `ingame/`, `master/` and `manifest.json` unchanged.
- `manifest.json` was left alone (no `file_large` field): the path is derived from the id like `achievementIconSrc`, via the new `achievementLargeSrc()` in `achievementCard.js` (`achievements/large/` plus the `icon.ingame` file name).
- `tools/build-www.mjs` `copyAchievementIcons()` also copies `achievements/large/` to `www/achievements/large/` (and throws loudly if it is missing).
- `achievement-assets.test.js`: 77 count, 320 x 320 size, stem parity with `ingame/`, build wiring.

### Task 2 - the large view (7699a1a7)
- **View model** (`achievementsSheet.js`): an EARNED entry gets `large = { key, src, name, line, stateText, label }` on a single row, a track head (its top earned tier) and each earned rung. Locked, partial-nothing and secret entries get `null`, so nothing about a secret can leak through it. New copy string `viewLarger: "{name}, view larger"` lives in `ACHIEVEMENTS_SHEET_COPY` (already walked by the safety scan and voice corpus; inventory prints 0). Name, line and date reuse the list's own strings.
- **Renderer**: the icon button (`button.mw-ach-large-open`, `aria-label`, `data-large`) is a transparent button laid over the 48 px icon, placed BEFORE the head in the row, so a track head is not a nested button, `head.nextElementSibling` is still the rung list, and its tap calls `onLarge(large, button)` with `stopPropagation` (never toggles the track). Rungs now draw a small decorative icon (a dimmed one when locked) and an earned rung's icon is the button.
- **Overlay** (`mazeworld.html`): `#mw-achievements-large`, a hidden dialog inside the sheet, showing the 320 px art (240 px, shrinking by flex down to 64 px in short windows, no vh/dvh lengths), name, line and "Earned {date}". A tap anywhere closes it. Android back: `closeModal` checks `achievementLargeOpen()` before `achievementsSheetOpen()`, so one press closes only the overlay. Focus returns to the icon button, found again by its `data-large` key (the list may have re-rendered). Closing the sheet hides the overlay. It declares no animation or transition, so reduced motion is satisfied by construction.
- **layout-check**: the tool now seeds a lifetime record (two Depth tiers plus the single entry with the longest name+line) and, in the achievements scene, opens two large views per profile (a Depth head and the longest entry). It measures: overlay covers the sheet, icon at most 240 px and not below 64 px and loaded as the 320 px export, name/line/date match the view and sit inside the window, no scroll or sideways overflow, a tap closes it, focus is back on the button. It also saves `<profile>-achievement-large*.png` shots.

### Task 3 - roller Human description (7a02bd9b)
- `fillRules` gates the race group on the race having a flavour line (Human included); a race without one keeps the old Good/Bad gate; `lines`/`flavor` hoisted so a flavoured identity with an empty footer still draws.
- `roller.test.js`: two declared re-pins (Summoner/Human now shows `[Summoner, Human]`) plus a new test that every race in `reelWordLists().race` shows its flavour line and exactly two groups.

## Tests (targeted only; no full `npm test`, no bots, no Gradle)

| File | Pass |
|------|------|
| achievements-large-view (new) | 14 |
| achievements-sheet-shell (E1-E6 new) | 28 |
| achievements-sheet-render | 21 |
| achievements-sheet-view / -model | 24 / 23 |
| achievements-shell-a11y | 18 |
| achievement-assets | 12 |
| roller | 25 |
| stale-terms | 6 |
| Combined run (the above plus achievement-card, tracker, banner, safety-scan, voice-corpus, layout-check, layout-shell, reduced-motion, hud-menu-layout, hudMenu, notes-sheet-shell, play-achievements-shell, text-scale, shell-tab-snapshots, panel-motion) | 726 pass, 0 fail |

Voice inventory (`--roll-under --hygiene --safety --count`) prints 0.

## Layout check

`npm run layout:check` (with `LAYOUT_CHECK_BOOT_MS=240000`, see Deviations): **12/12 profiles, 7/7 boundary probes, exit 0**, 18 of 18 scenes in every profile. Both large views pass in all 12 profiles, and the roller scene (every profile) still fits. Screenshots eyeballed: portrait phone (Downward Mobility II, icon about 190 px, text below) and the 800x360 short landscape (icon shrank to about 140 px, all three text lines in view). One earlier run failed only on "large icon did not load" in two profiles (first-fetch timing); the check now waits for the image before measuring.

## Deviations from Plan

**1. [Rule 3 - Blocking] layout-check boot wait made configurable.** On this machine a cold page boot took over 45 s for the whole session (the unmodified HEAD fails the same way: ~180 modules re-fetched at about 250 ms each). Added `LAYOUT_CHECK_BOOT_MS` (default stays 45000); the passing runs used 240000. No other tool behaviour changed. The earlier failures were this, not the change (HEAD checked out to a scratch copy reproduced them).

**2. Rungs gained a small icon.** The plan says "an earned tier's icon inside an expanded track", but rungs had no icon at all. Added a 48 px decorative icon per rung (dimmed when locked) that the earned ones turn into the button.

**3. Declared re-pins:** `achievements-sheet-render.test.js` (an earned track's li children are now icon button, head, rungs; rung span query filtered by tag), `achievements-shell-a11y.test.js` (a rung icon is a decorative hidden image), `roller.test.js` (two Human-exclusion tests).

**4. Not done by design:** `manifest.json` has no `file_large` field (derived path instead, as the plan allowed).

Stub scan: none. Threat flags: none (no new network, storage or auth surface; secrets covered by tests on the view and on the DOM attributes).

## Human verification (deferred to end of run)

On the Pixel 7 (debug build), with a few earned achievements:

1. Tap several earned icons (a single row, a track head, an earned tier inside an expanded track) and check the large art is sharp, not soft, and that name, line and date read well.
2. Android back with the large view open closes only the overlay (the sheet stays); a second back closes the sheet.
3. TalkBack: an earned icon reads "<name>, view larger" as a button; locked and secret icons are skipped; tapping the track text still expands/folds it and the icon does not.
4. Focus lands back on the icon you opened after closing.
5. Roller: roll a Human (any class) and see its race line under the class line.

## Self-Check: PASSED

- FOUND: achievements/large (77 files), achievements/build_large.py, test/unit/achievements-large-view.test.js
- FOUND commits: 58a30734, 7a02bd9b, 7699a1a7
- play/, ingame/, master/, manifest.json unchanged (git status clean for them)
