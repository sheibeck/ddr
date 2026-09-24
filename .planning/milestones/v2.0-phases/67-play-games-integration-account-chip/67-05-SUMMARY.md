---
phase: 67-play-games-integration-account-chip
plan: 05
subsystem: shell (mazeworld.html markup + CSS)
tags: [play-games, account-chip, hud, title-screen, bottom-sheet, layout]
status: complete
requires: []
provides:
  - "#mw-acct-chip inside .mw-hud-actions on HUD band 2, left of the ☰"
  - "#mw-title-acct-chip (.mw-title-acct) in the title screen's top-right corner"
  - "#mw-acct-sheet / #mw-acct-scrim / #mw-acct-title / #mw-acct-close / #mw-acct-rows"
  - "data-setting=\"pgsDevSignedIn\" option group in #mw-dev-row"
  - "CSS rule for every ACCOUNT_CLASSES entry and every static account class"
affects:
  - "67-07 (renders into the chip and sheet using the pinned class contract)"
  - "67-08 (wires the chips, the sheet and the dev seed)"
tech-stack:
  added: []
  patterns:
    - "legend-sheet family chrome reused for the account sheet"
    - "width-budget test extended with the chip footprint"
key-files:
  created:
    - test/unit/account-layout.test.js
  modified:
    - mazeworld.html
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-map-hud.test.js
decisions:
  - "The chip costs 34px of band 2: a 44px box with margin-left -10px overlapping the otherwise-empty band gap; the counters' gap drops 8px -> 7px to pay back 3px (band 2 at M = 408.8 of 411). The ☰'s own geometry is untouched."
  - "Account and settings sheets both sit at z-index 55 (one id rule) so the title chip's sheet and its Settings row work over the title (50) and roller (51)."
  - "The chip carries min-height:44px so the generic button's 48px floor doesn't make it taller than the ☰'s outer box."
  - "On the title screen only, the signed-out/pending faces get a dark fill (rgba(8,7,5,.72)) so the hollow square reads against the splash art; the avatar face is unaffected."
metrics:
  duration: "~25 min"
  completed: 2026-09-23
  tasks: 2
  files: 4
---

# Phase 67 Plan 05: Account chip slots and sheet shell Summary

This plan gives the Play Games account chip a place in the shell. It sits on HUD band 2 directly left of the ☰ and in the title screen's top-right corner. Both copies are 44×44 buttons whose first paint is a deliberate hollow-square "?" face. The account bottom sheet (`#mw-acct-sheet`) uses the legend-sheet chrome and stacks above the title and roller screens. The hidden dev row gains a `pgsDevSignedIn` toggle. Band 2 still fits a 411px Pixel 7 at text size M (408.8px).

## What shipped

**Task 1 — markup (commit 00b8d67)**
- Band 2: a new `<div class="mw-hud-actions">` after `.mw-hud-counters` holds `#mw-acct-chip` first, then the existing `.mw-hud-menu-wrap`. The wrap was moved as-is, with its children, ids and SETTINGS row unchanged. The chip's comment and markup never use the `mw-hud-menu` token.
- Title screen: `#mw-title-acct-chip` (`mw-acct-chip mw-title-acct`), placed after `.mw-title-scrim` and before `.mw-title-body`, with the same aria attributes and static nobody face.
- `#mw-acct-sheet` directly after the settings sheet: a `.mw-legend-scrim` with id `mw-acct-scrim`, and a `role="dialog"` panel with `aria-labelledby="mw-acct-title"`. The panel holds a head (an empty `#mw-acct-title` slot plus the `#mw-acct-close` Close button) and the `#mw-acct-rows` host. It is hidden by default and has no title text, because content supplies it.
- `#mw-dev-row`: "Play Games (dev, next launch)" label plus a `data-setting="pgsDevSignedIn"` group (`false` = Signed out, `true` = Signed in). It goes through the existing delegated `#mw-settings-rows` handler, which already turns "true"/"false" into booleans, so no new code was needed. `#mw-dev-perf` stays last in the row.

**Task 2 — CSS (commit 889310b)**
- `.mw-hud-actions{display:flex;align-items:center;flex:none}`, with no gap, z-index, transform or position. The ☰ wrap's z-index 6 still sits on the header ladder.
- `.mw-hud-counters` gap 8px -> 7px (nothing else in the rule changed).
- `.mw-acct-chip{width:44px;height:44px;min-height:44px;min-width:44px;margin:-5px 0 -5px -10px;...}`, plus `:active` (no press jump) and `:hover` (no fill) overrides.
- Faces: `.mw-acct-face` is 34×34 with border-box sizing. `avatar` gets the mock's gold on-ring, `nobody` is a 2px #6b5c3c hollow square, and `pending` is the nobody look at .55 opacity. `.mw-acct-initials` uses `--disp` at 10px; `.mw-acct-glyph` is the dim ? in `--mono` bold 15px, #6b5c3c.
- `.mw-title-acct`: absolute, `top:calc(12px + safe-area-inset-top)`, `right:12px`, `z-index:2`, `margin:0`.
- `#mw-acct-sheet,#mw-settings-sheet{z-index:55}`.
- Sheet rules: `.mw-acct-id/-id-text/-name/-status/-action(+:disabled)/-help/-row/-label/-options/-opt(+.active)/-settings`, plus `.mw-acct-sheet/-title/-rows`. Rows have at least 44px of tap height and buttons a 48px floor. The settings selectors were copied into new rules and not edited.
- `#mw-dev-row .mw-settings-options + .mw-settings-label{margin-top:14px}` spaces the dev row's second group.

**Tests**
- New `test/unit/account-layout.test.js` (13 tests), covering:
  - band-2 order;
  - both chips' exact markup;
  - where the title chip sits;
  - the sheet's structure;
  - the dev group's values;
  - that nothing is placed inside the viewport;
  - 44×44 geometry;
  - title placement;
  - the parsed z-order (sheets above the title and roller);
  - the faces;
  - `.mw-hud-actions` declaring no position, z-index, transform or gap;
  - one rule per class in the renderer and static lists (pinned literally);
  - row and button minimum heights.
- `hud-menu-layout.test.js`:
  - (2) asserts the chip sits between the counters and the menu wrap;
  - (4) adds `mw-acct-chip` to both id lists;
  - (5) adds `.mw-hud-actions` to the rules that must declare no z-index or transform;
  - (14) parses the chip's width, height and margin shorthand, requires ≥44×44 and no gap on `.mw-hud-actions`, adds the chip footprint (34px), and logs the M total (408.8) along with L (477.8, logged only).
- `shell-map-hud.test.js` (c): the pin now expects `gap:7px`, with a Phase 67 comment giving the reason.

## Verification

- `node --test test/unit/account-layout.test.js test/unit/hud-menu-layout.test.js test/unit/shell-no-content-copies.test.js test/unit/shell-tab-snapshots.test.js test/unit/shell-map-hud.test.js`: 59/59 passed after Task 1.
- `node --test test/unit/account-layout.test.js test/unit/hud-menu-layout.test.js test/unit/shell-map-hud.test.js test/unit/shell-gear-toolbar.test.js test/unit/stale-terms.test.js`: 69/69 passed after Task 2. (14) reports band 2 at M = 408.8px of 411.
- `npm test`: 4480 tests, 4473 pass, 7 fail. These are the same 7 pre-existing CRLF ledger failures as the baseline before this plan (4467 / 4460 / 7): class-pass-ledger and flee-ledger. The failing set did not grow.
- Grep acceptance counts: `id="mw-acct-chip"` = 1, `id="mw-title-acct-chip"` = 1, `id="mw-acct-sheet"` = 1, `data-setting="pgsDevSignedIn"` = 1, `class="mw-hud-actions"` = 1. The `^.mw-acct-chip{width:44px;height:44px` rule and `#mw-acct-sheet,#mw-settings-sheet{z-index:55}` each appear once.
- No engine/ or parity fixture edits, and no Android build, APK or device step.

## Deviations from Plan

**1. [Rule 1 - Bug] min-height on the chip.** Every `button` gets `min-height:48px` from the generic rule, which would have made the 44px chip 48px tall. Its outer box would then have been 38px against the ☰'s 34px, making band 2 taller. `.mw-acct-chip` therefore declares `min-height:44px;min-width:44px` after `height`. The `^.mw-acct-chip{width:44px;height:44px` prefix the acceptance grep checks is unchanged. (Task 2, commit 889310b.)

**2. [Rule 2 - Legibility] Dark fill behind the title chip's signed-out face.** A transparent hollow square over the splash art could vanish, which would work against D-07's "never reads as broken". `.mw-title-acct .mw-acct-face:not([data-state="avatar"]){background:rgba(8,7,5,.72)}` applies only on the title screen. The HUD chip keeps the plan's transparent nobody face. (Task 2, commit 889310b.)

**3. [Rule 2 - Polish] Hover and dev-row spacing rules.** `.mw-acct-chip:hover`, `.mw-acct-action:hover/:active`, `.mw-acct-opt` hover/active (copied from settings), `.mw-acct-settings:hover`, and a top margin on the dev row's second label. These follow the house pattern: a generic hover or press must never flash a skinned button.

**Not run:** `npm run boot:check`. It needs a built `www/` and headless Chrome, and it timed out in this worktree. The plan does not list it as verification.

## Known Stubs

- `#mw-acct-title` and `#mw-acct-rows` are empty on purpose. 67-07 renders their content from content/ and 67-08 wires it. The static chip face is the intended "nobody" first paint, not a placeholder.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md), on the Pixel 7:
1. At text sizes S, M and L, band 2 shows Depth/Day/Squares/Rations with no clipping, and the account chip sits directly left of ☰. At L the computed budget is 477.8px, so check how the counters behave, since they may clip there. That was already a deferred device check for L before this plan.
2. The title-screen chip sits in the top-right corner, clear of the status bar and camera cutout, and does not overlap the splash art's baked-in text.
3. The "nobody" face (a hollow square with a dim ?) reads as deliberate, not broken, on both the HUD and the title (the title copy has a dark fill).
4. Band 2's height is unchanged from Phase 57, and the ☰ still opens its dropdown above the map and rail, with the scrim closing it.
5. Once 67-08 wires the sheet, it opens from both chips, and its Settings row opens the settings sheet above the title screen.

## Self-Check: PASSED

- FOUND: test/unit/account-layout.test.js
- FOUND: mazeworld.html (#mw-acct-chip, #mw-title-acct-chip, #mw-acct-sheet, pgsDevSignedIn)
- FOUND: commit 00b8d67
- FOUND: commit 889310b
