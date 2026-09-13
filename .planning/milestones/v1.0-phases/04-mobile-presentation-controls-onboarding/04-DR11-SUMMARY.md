---
phase: 04-mobile-presentation-controls-onboarding
plan: DR11 (device-review revision round 11 — control-bar centering + handedness rework, feature-icon size, gold button brightness, splash scrim, from live user direction — ad hoc, not a numbered PLAN.md)
subsystem: presentation
tags: [device-review, handedness, control-bar, icons, buttons, splash, visual-polish]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR9: settings.js's handedness field + #app[data-handedness] control-bar layout this round reworks"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR7: drawFeatureIcon's factor-1.0 draw this round adds a scale param to"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-05/04-06: the dark theme's --ditto gold token + .mw-title-art/.mw-title-scrim splash treatment this round adjusts"
provides:
  - "The bottom control bar's D-pad is now ALWAYS horizontally centered — handedness controls ONLY which side MAKE CAMP floats to (left, the new default, vs. right)"
  - "settings.js's handedness field default flipped 'right' -> 'left'"
  - "drawFeatureIcon(ctx, img, dx, dy, size, dir, scale) — new optional scale param (default 1.0); feature-tile draw calls pass 0.75, the party-marker call site is untouched (stays full-size)"
  - "A dedicated --mw-gold-btn (#c9a24e, muted brass) CSS token for CTA button-fill backgrounds (button.primary, .mw-title-enter, .mw-roller-cta.mw-roller-ready), separate from the --ditto accent gold used everywhere else"
  - "The title-screen splash art (.mw-title-art) now renders at full opacity with its scrim confined to a small bottom band behind the ENTER button, instead of dimming the whole image"
affects: []

tech-stack:
  added: []
  patterns:
    - "A CSS grid with a fixed center column (1fr auto 1fr) keeps one element (the D-pad) dead-center regardless of a sibling's (MAKE CAMP) presence/side — cleaner than the prior flex `order` swap, which moved BOTH elements together and couldn't express 'one element fixed, one element floats.'"
    - "A default-scale optional trailing parameter (drawFeatureIcon's new `scale = 1.0`) lets an existing call site (the party marker) stay byte-for-byte unchanged while a different call site (feature tiles) opts into new behavior — no need to touch/retest every caller when only one needs to change."
    - "A dedicated CSS custom property for a NARROW use case (--mw-gold-btn, CTA button fills only) rather than repointing the existing broadly-shared token (--ditto, used for text/borders/HUD numbers everywhere) avoids an unintentional blanket recolor when only one visual role was flagged as wrong."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR11-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/settings.js
    - src/browser/icons.js
    - test/unit/settings.test.js
    - test/unit/tutorial.test.js

key-decisions:
  - "Reworked .mazefoot from a 2-child flex row with `order` swap (04-DR9) to a 3-column CSS grid ([side-slot][D-pad][side-slot]) — the D-pad occupies the fixed center column in BOTH handedness modes; only #btn-camp's grid-column/justify-self changes between 'left' (column 1, start) and 'right' (column 3, end). This supersedes DR9's swap-both-sides model entirely, per the plan's explicit instruction."
  - "Flipped settings.js's handedness default from 'right' to 'left' per live user direction (left-handed = MAKE CAMP on the left is now the default), and reordered the Settings-sheet's Handedness row buttons (Left-handed now first) to match the new default-first convention used elsewhere in the sheet."
  - "Scaled ONLY the feature-tile drawFeatureIcon call site to 0.75, leaving the party-marker call site's arguments unchanged (it already omitted a scale argument, so the new default of 1.0 preserves its exact prior behavior with zero code change at that call site) — satisfies 'party marker unchanged' without needing an explicit scale=1.0 anywhere."
  - "Introduced a new --mw-gold-btn token instead of repointing --ditto, and scoped the mute-gold change to exactly the three CSS rules that use --ditto as a button BACKGROUND fill (button.primary, .mw-title-enter, .mw-roller-cta.mw-roller-ready) — momentary :active/press-flash states that also briefly show #e8c97a (D-pad, MAKE CAMP, chips, gear button, settings options) were deliberately left untouched, since those are transient tap feedback, not a persistently-bright CTA a device screenshot would show as 'too bright.'"
  - "button.primary's :hover background was changed from --ditto-2 (the even-lighter hover gold) to --ditto (the previous RESTING gold) — now that the resting state is muted, hover brightening toward the old bright gold preserves a clear pressed/hover affordance instead of hover barely differing from an already-bright base."
  - "For the splash scrim, chose the plan's 'confine to a small bottom gradient' option over full removal — .mw-title-art's own opacity was bumped from .82 to 1 (it was ALSO contributing to the dimmed look, independent of the scrim), and the scrim gradient now stays fully transparent through the top 62% of the screen, only darkening the band directly behind the ENTER button."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR10-SUMMARY.md's own precedent.

duration: ~45min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR11: Control-bar centering, icon size, button brightness, splash dimming Summary

Four independent visual tweaks from live user device-review direction, each its own atomic commit. (1) The bottom control bar's D-pad is now ALWAYS horizontally centered — a CSS grid with a fixed center column replaces DR9's flex `order`-swap so handedness controls ONLY which side MAKE CAMP floats to (left is the new default). (2) Feature-tile map icons now draw at ~3/4 cell size via a new optional `scale` param on `drawFeatureIcon`, while the party/player marker (whose call site omits the param, defaulting to 1.0) stays full-size so it keeps standing out. (3) The bright gold CTA buttons (ENTER, the roller's ready-state CTA, and every `button.primary`) now use a new dedicated muted-brass token (`--mw-gold-btn: #c9a24e`) for their background fill instead of the same bright accent gold (`--ditto`) used everywhere else for text/borders/HUD numbers, which stays untouched. (4) The title-screen splash art no longer reads dimmed — its own `.82` opacity was bumped to full, and the dark scrim gradient over it now stays fully transparent through the top ~62% of the screen, confined to a small band behind the ENTER button instead of a whole-image fade to near-black.

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-08
- **Items:** 4 (control-bar centering + handedness default; feature-icon scale; gold button brightness; splash scrim) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** `mazeworld.html`, `src/browser/settings.js`, `src/browser/icons.js`, `test/unit/settings.test.js`, `test/unit/tutorial.test.js`

## Accomplishments

### Item 1 — D-pad always centered; handedness moves only MAKE CAMP (`fb028e8`)

1. `.mazefoot` changed from `display:flex` + `justify-content:space-between` + per-child `order` to `display:grid;grid-template-columns:1fr auto 1fr` — the D-pad (`grid-column:2;justify-self:center`) is now dead-center in the bar regardless of handedness.
2. `#app[data-handedness="left"] #btn-camp{grid-column:1;justify-self:start}` / `#app[data-handedness="right"] #btn-camp{grid-column:3;justify-self:end}` — replaces DR9's `order:1/2` swap-both-sides pair; only MAKE CAMP's position changes now.
3. `src/browser/settings.js`'s `SETTINGS_DEFAULTS.handedness` default flipped `"right"` → `"left"`.
4. `test/unit/settings.test.js` updated: the default-value assertion now expects `"left"`, the invalid-value-rejection test's fallback assertion now expects `"left"`, and the round-trip test now explicitly exercises writing `"right"` (so both values remain covered across the file).
5. The Settings sheet's Handedness row buttons reordered to Left-handed first (matching the new default), and the `#app` root's static `data-handedness` HTML attribute updated to `"left"` to match the new boot-time default before `applySettings()` runs.

### Item 2 — Feature icons -> ~3/4 size; party marker unchanged (`e742694`)

1. `drawFeatureIcon(ctx, img, dx, dy, size, dir, scale = 1.0)` in `src/browser/icons.js` gained a trailing optional `scale` param; `iconSize` is now `Math.round(size * scale)` instead of a hardcoded `* 1.0`. Rotation pivot (cell center) is unaffected by scale, so scaled one-way-door icons still rotate correctly.
2. The maze `draw()`'s feature-tile call site (`mazeworld.html`) now passes `0.75` as the trailing arg: `iconsApi.drawFeatureIcon(ctx, img, x * CELL, y * CELL, CELL, c.dir, 0.75)`.
3. The party-marker call site is untouched (no scale argument), so it keeps drawing at the default `1.0` — full cell size, standing out against the now-smaller feature icons.
4. `test/unit/tutorial.test.js` gained 3 new tests: default-scale no-op (party-marker equivalent), `scale=0.75` unrotated, and `scale=0.75` combined with a rotated (`dir="S"`) draw confirming the rotation pivot doesn't move.

### Item 3 — Gold CTA buttons less bright (`7bccfe3`)

1. New `:root` token `--mw-gold-btn: #c9a24e` (muted brass), documented as scoped to CTA button-FILL backgrounds only, distinct from `--ditto` (`#e8c97a`, the accent gold used for text/borders/HUD numbers/tab labels everywhere else, which is untouched).
2. `button.primary`, `.mw-title-enter`, and `.mw-roller-cta.mw-roller-ready` now use `--mw-gold-btn` for `background`/`border-color` instead of `--ditto`; text stays `--paper` (dark) and readable.
3. `button.primary:hover` changed from `--ditto-2` (lighter gold) to `--ditto` (the previous resting gold) so hover still visibly brightens against the new muted resting state.
4. Momentary `:active`/press-flash states that briefly show the bright gold (D-pad, `#btn-camp`, `.mw-chip`, `.mw-gear-btn`, `.mw-settings-opt`) were deliberately left unchanged — these are transient tap feedback, not a persistently-bright CTA.

### Item 4 — Splash art no longer dimmed (`00f8a21`)

1. `.mw-title-art`'s `opacity` changed from `.82` to `1` — it was itself dimming the image independent of the scrim.
2. `.mw-title-scrim`'s gradient reworked from `rgba(8,7,5,.15) 0% -> rgba(8,7,5,.55) 55% -> rgba(8,7,5,.97) 100%` (dimmed the WHOLE image, nearly opaque black by the bottom) to `rgba(8,7,5,0) 0% -> rgba(8,7,5,0) 62% -> rgba(8,7,5,.88) 100%` — fully transparent through the top 62% of the screen, darkening only the band directly behind the ENTER button.

## Task Commits

1. **Item 1 — D-pad centered; handedness moves only MAKE CAMP** — `fb028e8` (feat)
2. **Item 2 — Feature icons -> ~3/4 size; party marker unchanged** — `e742694` (feat)
3. **Item 3 — Mute gold CTA button backgrounds** — `7bccfe3` (fix)
4. **Item 4 — Stop dimming splash art** — `00f8a21` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next item's edits began.

## Files Created/Modified

- `mazeworld.html` — `.mazefoot`/`#app[data-handedness]` grid rework; `data-handedness="left"` default attribute; Settings-sheet Handedness row reorder; `drawFeatureIcon` feature-tile call-site `scale=0.75` arg; `--mw-gold-btn` token + `button.primary`/`.mw-title-enter`/`.mw-roller-cta.mw-roller-ready` background/border-color/hover updates; `.mw-title-art` opacity + `.mw-title-scrim` gradient rework.
- `src/browser/settings.js` — `SETTINGS_DEFAULTS.handedness` default `"right"` -> `"left"`; updated doc comments.
- `src/browser/icons.js` — `drawFeatureIcon` gained optional `scale = 1.0` trailing param; updated doc comment.
- `test/unit/settings.test.js` — default-value assertion, invalid-value fallback assertion, and round-trip test's handedness value all updated for the new default.
- `test/unit/tutorial.test.js` — 3 new `drawFeatureIcon` scale-param tests.

## Decisions Made

See `key-decisions` in the frontmatter above (grid-based centering vs. flex `order` swap; handedness default flip + Settings-sheet reorder; scale-param default preserving the party-marker call site untouched; dedicated `--mw-gold-btn` token vs. repointing `--ditto`; hover-gold adjustment; scrim confined-band vs. full removal).

## Deviations from Plan

None — plan executed exactly as written. All four items match the plan's explicit item descriptions and success criteria; no Rule 1-4 auto-fixes or architectural questions arose during execution.

## Known Stubs / Threat Flags

None. This was CSS-layout, canvas-draw-parameter, and CSS-token visual-polish work — no new network endpoints, auth paths, file-access patterns, or schema changes at a trust boundary. No `GameState.rngState` read or mutation anywhere in this round's changes (all four items are presentation-only: CSS grid, a canvas draw-size multiplier, CSS custom-property values, and a settings default value).

## Verification

- `npm run build:www` — succeeds at all four commit checkpoints.
- `npm test` — **491 -> 494/494 green** (491 baseline from 04-DR10 + 3 new `drawFeatureIcon` scale-param tests in `tutorial.test.js`), green at every checkpoint.
- `npm run test:quick` — **402 -> 405/405 green** at the final checkpoint (mirrors the +3 test delta).
- No `npx cap sync`/gradle run, per the plan's explicit instruction — the orchestrator handles the device build.
- Self-check below confirms every claimed file/commit/test exists.
- **Not verified here (on-device UAT deferred):** the visual "feel" of the centered D-pad, the ~3/4-scale feature icons against the party marker, the muted-gold CTA buttons, and the brightened splash art on the Pixel 7 build — per this project's `mvp — autonomous run` mode, on-device visual verification is deferred to the orchestrator's next device build, consistent with every prior `04-DR*` round.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `.mazefoot{display:grid`, `#app[data-handedness="left"] #btn-camp{grid-column:1`, `data-handedness="left"` on `#app`, `iconsApi.drawFeatureIcon(ctx, img, x * CELL, y * CELL, CELL, c.dir, 0.75)`, `--mw-gold-btn:#c9a24e`, `.mw-title-art{...opacity:1`, `.mw-title-scrim{...rgba(8,7,5,0) 0%`.
- FOUND: `src/browser/settings.js` — `handedness: "left"` in `SETTINGS_DEFAULTS`.
- FOUND: `src/browser/icons.js` — `export function drawFeatureIcon(ctx, img, dx, dy, size, dir, scale = 1.0)`.
- FOUND: `test/unit/settings.test.js` — `SETTINGS_DEFAULTS: handedness defaults to 'left'` test.
- FOUND: `test/unit/tutorial.test.js` — 3 new scale-param tests, all passing.
- FOUND commit `fb028e8` (feat(04-DR11): center D-pad always; handedness now moves only MAKE CAMP).
- FOUND commit `e742694` (feat(04-DR11): feature icons -> ~3/4 size, party marker unchanged).
- FOUND commit `7bccfe3` (fix(04-DR11): mute gold CTA button backgrounds).
- FOUND commit `00f8a21` (fix(04-DR11): stop dimming splash art).
- FOUND: `npm test` 494/494 and `npm run test:quick` 405/405 at final state.

## Next Phase Readiness

- All DR11 items are complete and test-green; ready for on-device UAT on the next Pixel 7 build against the design mock — specifically the D-pad's centered position with MAKE CAMP floating left by default, the feature-icon/party-marker size contrast, the muted-gold CTA buttons' readability, and the splash art's brightness.
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
