---
phase: 04-mobile-presentation-controls-onboarding
plan: DR5A (device-review revision round 5, Pass A — interaction/visual, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [tap-highlight, dpad, nav-tabs, encounter-overlay, movement-gating, onewaydoor, icon-rotation, splash, title-screen]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR4: .mw-chip/#btn-camp scoped hover/active overrides, mazefoot camp/dpad flex layout, drawFeatureIcon size factor 1.08"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR1/04-05: #enc-panel as an over-map .mw-overlay gated by hasActiveEncounter(), window.move/engineMove bridge, S.beats feature-tile narration"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: icons.js FEATURE_ICONS/featureKeyForCell/drawFeatureIcon, icons/optimized/*.png preloaded at boot"
provides:
  - "App-wide `*{-webkit-tap-highlight-color:transparent}` reset + user-select:none on every button — the root fix for Android WebView's own tap-highlight overlay, independent of any CSS :active rule"
  - "Scoped :hover/:active overrides for .dpad button, .mw-tab (including the active-tab-under-sticky-hover case), and button.danger — closing the same generic-hover-wins-on-specificity gap already fixed for .mw-chip/#btn-camp in DR4"
  - "Generic button:hover fallback repointed off its leftover light-theme white (#F7F1E2) onto the dark theme's own panel tone (var(--paper-3))"
  - "#enc-panel moved to a direct child of .mazebox (position:relative) so the encounter/feature overlay covers the full play area — map viewport AND the MAKE CAMP + D-pad bar — not just the canvas"
  - "hasActiveEncounter() gate applied to the D-pad click handler, the keydown handler, and window.move/engineMove itself (the single runtime choke point) — no movement can register while the overlay is up"
  - "drawFeatureIcon(ctx, img, dx, dy, size, dir) — optional dir param rotates the one-way-door icon to its real passable direction (N/E/S/W), fails open for every other icon/unknown dir"
  - ".mw-title-art switched from object-fit:cover to object-fit:contain (16px inset) so the splash always shows the whole image, uncropped, on any device aspect ratio"
affects: [04-07, 04-08, 04-09, 04-10, 04-11]

tech-stack:
  added: []
  patterns:
    - "Android WebView paints its own translucent tap-highlight overlay on ANY tapped element the instant touch registers, independent of and BEFORE any CSS :active rule fires — per-button :active color overrides alone (DR2/DR4's pattern) can never fully suppress a visible flash without also killing the native overlay via -webkit-tap-highlight-color:transparent."
    - "The generic-hover-wins-on-specificity bug recurs per-control: any plain button without ITS OWN scoped :hover/:active (class+pseudo, beating the generic element+pseudo selector) falls through to the shared button:hover:not(:disabled) rule. DR4 patched .mw-chip/#btn-camp one at a time; DR5A both patches the remaining named controls (.dpad button, .mw-tab, button.danger) AND fixes the generic fallback's own leftover-white value at the root, so future new buttons don't need their own patch by default."
    - ".mw-tab.active needs its OWN :hover override at higher specificity than a bare .mw-tab:hover — otherwise a sticky-hover tap on the currently-SELECTED tab would fall through to the plain inactive-tab hover styling (3 classes still beats .mw-tab.active's 2), momentarily un-golding the active tab."
    - "A top-level classic-script `function move(dir){...}` declaration and a later `window.move = engineMove` module-script assignment share ONE global binding — every bare `move(...)` call site (dpad click handler, keydown handler) always resolves to whatever window.move currently holds, so gating inside engineMove itself is a true single choke point, not just one of several call sites to patch."
    - "hasActiveEncounter() covers S.dead/S.won/S.combat/S.store/S.beats.groups.length in one predicate — reusing it (rather than re-deriving a narrower movement-specific condition) keeps the pan-suppression, overlay-visibility, and movement-gating logic provably consistent."
    - "Canvas ctx.rotate() is clockwise in screen space (canvas y-axis points down) — rotating a base East-pointing icon by 90°/180°/270° clockwise correctly yields South/West/North without any sign inversion, matching the DIRV/dir convention already used by move()'s own one-way-door logic (mazeworld.html) and engine/maze.js's rng.pick(axis)."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR5A-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/icons.js
    - test/unit/tutorial.test.js

key-decisions:
  - "Fixed the generic button:hover:not(:disabled) fallback's OWN value (leftover light-theme #F7F1E2 -> var(--paper-3)) rather than only adding more per-control scoped overrides — this is a Rule 1 bug fix at the root (the value itself was wrong for the dark theme, not just occasionally overridden), and it retroactively silences the same white-flash risk on every OTHER plain button not named in this round's scope (MOVE ON, Clear save, the title-screen ENTER/RESUME, Next, Leave) without touching each one individually."
  - "Removed the keydown handler's 'walking away dismisses the card' shortcut entirely (a direction key used to both null S.beats AND move in the same keystroke) rather than trying to gate around it — the plan's explicit requirement ('no move registers until Move on is pressed') is incompatible with a shortcut whose entire purpose was moving as part of dismissal; combat's own numbered action keys and Enter/Space (the overlay's own dismiss button) are preserved."
  - "Gated movement at THREE layers (dpad click handler, keydown handler, and engineMove itself) rather than only the outermost UI handlers — engineMove is the actual single runtime choke point every path resolves through (window.move is reassigned once, by reference, shared across all classic-script call sites), so this is defense-in-depth against any future call site that forgets its own check, not three independent guesses at where the bug lives."
  - "#enc-panel's absolute-positioning container was changed from .mw-maze-viewport to .mazebox (one level up) — this is the minimal DOM move that satisfies 'cover MAKE CAMP + D-pad too' while keeping the top HUD (floor/day/rations) and the bottom 5-tab nav visible and usable, rather than interpreting 'full screen area' as covering literally the whole viewport including chrome the player still needs (e.g. to check rations while reading a trap result)."
  - "drawFeatureIcon's dir param is OPTIONAL and additive (5th positional arg on top of the existing 4) — every existing call site not touched by this round (the player-marker draw call) continues to omit it and is provably unaffected; only the feature-icon loop's single call site was updated to pass c.dir, which is undefined for every non-door cell already."
  - "Splash inset changed from 0 to 16px (rather than staying flush with the screen edge) specifically to satisfy the plan's 'optional padding so the image's text never touches the screen edge' — using contain alone would already stop the crop, but a device whose aspect ratio happens to closely match the source art could otherwise render it fully flush to one edge with zero margin."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1/04-DR2/04-DR3/04-DR4-SUMMARY.md's own precedent.

duration: ~70min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR5A: Device-review round 5, Pass A (interaction/visual) Summary

Applied the user's live device-review "Pass A" to the Delve, Die, Repeat Android build: killed the recurring white tap-flash at its root (Android WebView's own tap-highlight overlay, not just per-button `:active` colors), made the encounter/feature overlay cover the full play area and genuinely block movement until dismissed, rotated the one-way-door icon to its real passable direction, and fixed the splash art crop on tall-aspect-ratio phones. Four atomic commits, each independently rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next commit landed.

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-09-08
- **Tasks:** 4 items (global tap-highlight fix; encounter overlay coverage + movement gating; one-way-door icon rotation; splash crop fix) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 3 (`mazeworld.html`, `src/browser/icons.js`, `test/unit/tutorial.test.js`)

## Accomplishments

### Item 1 — Global tap-highlight fix + gold-on-dark active states everywhere (`f078175`)
- Added the design mock's own `*{-webkit-tap-highlight-color:transparent}` app-wide — Android's WebView paints a translucent tap-highlight overlay on any tapped element the instant touch registers, independent of and *before* any CSS `:active` rule applies, so per-button color overrides alone (DR2/DR4's approach) could never fully suppress it.
- Added `user-select:none;-webkit-user-select:none` to the base `button{}` rule (covers every button-tag control: D-pad, chips, camp, combat, nav tabs).
- Closed the same "generic-hover-wins-on-specificity" gap DR4 fixed for `.mw-chip`/`#btn-camp`, for the three remaining named controls: added scoped `.dpad button:hover`, `.mw-tab:hover` + `.mw-tab.active:hover` (the active tab needs its own higher-specificity variant so a sticky hover on the SELECTED tab can't fall through to the plain inactive-tab hover color), and `button.danger:hover`/`:active` (the combat Flee/Withdraw button — red-on-dark press, never white).
- Repointed the generic `button:hover:not(:disabled)` fallback itself from a leftover light-theme value (`#F7F1E2`, warm parchment white) onto the dark theme's `var(--paper-3)` panel tone — a root-cause fix that also silences the same flash risk for every other plain button not individually named this round (MOVE ON, Clear save, title-screen ENTER/RESUME, Next, Leave).

### Item 2 — Encounter overlay covers camp+D-pad and blocks movement (`b431200`)
- Moved `#enc-panel` from inside `.mw-maze-viewport` (canvas-only) to a direct child of `.mazebox` (given `position:relative`), so its `position:absolute;inset:0` overlay now covers the full play area — the map viewport AND the `.mazefoot` MAKE CAMP + D-pad bar beneath it.
- Gated movement on `!hasActiveEncounter()` at three layers: the D-pad click handler, the keydown handler, and `window.move`/`engineMove` itself (the actual single runtime choke point every movement call site resolves through, since a classic-script `function move(){}` declaration and the later `window.move = engineMove` module assignment share one global binding).
- Removed the keydown handler's old "walking away dismisses the card" shortcut, which let a direction key both dismiss `S.beats` AND move in the same keystroke — incompatible with "no move registers until Move on is pressed." Combat's own numbered action keys (1–7) and Enter/Space (the overlay's own dismiss button) are unaffected.

### Item 3 — One-way-door icon rotates to its passable direction (`2a87e56`)
- `drawFeatureIcon(ctx, img, dx, dy, size, dir)` gained an optional 5th `dir` param: when it's a recognized value (`N`/`E`/`S`/`W`), the icon is rotated about the cell's center before drawing (`E`=0°, `S`=90° clockwise, `W`=180°, `N`=270° — canvas `ctx.rotate()`'s own clockwise convention, matching the base PNG's East-pointing orientation).
- The feature-icon draw loop (`mazeworld.html`) now passes the engine's `cell.dir` (`engine/maze.js`, set only on `"one"` feat cells) straight through; every other feature cell has no `.dir` (`undefined`) so the param is a no-op for them, and an unrecognized `dir` value also fails open to the original unrotated path.
- Added 7 new unit tests (`test/unit/tutorial.test.js`) against a fake `ctx` recording call order/args, covering: no-dir (unrotated), unknown-dir (fail-open), all four cardinal rotations, and the rotated-draw centering math.

### Item 4 — Splash title-art shows whole image on any device (`f52820e`)
- `.mw-title-art` switched from `object-fit:cover` (which cropped the splash's baked-in name/tagline text at the edges on tall aspect ratios like the Pixel 7) to `object-fit:contain`, letterboxed against `.mw-title-screen`'s own `#080705` background.
- Added a 16px inset (was `inset:0`) so the image is guaranteed a small margin from the screen edge even on a device whose aspect ratio happens to closely match the source art.

## Task Commits

1. **Item 1 — Global tap-highlight fix + active states** — `f078175` (fix)
2. **Item 2 — Encounter overlay coverage + movement gating** — `b431200` (fix)
3. **Item 3 — One-way-door icon rotation** — `2a87e56` (feat)
4. **Item 4 — Splash crop fix** — `f52820e` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next item's edits began.

## Files Created/Modified

- `mazeworld.html` — app-wide tap-highlight reset; `.dpad button`/`.mw-tab`/`.mw-tab.active`/`button.danger` scoped hover/active overrides; generic `button:hover` fallback color; `#enc-panel` moved to `.mazebox` (with `.mazebox{position:relative}`); `hasActiveEncounter()` gating in the dpad click handler, keydown handler, and `engineMove`; feature-icon draw loop passes `c.dir`; `.mw-title-art` `object-fit:contain` + inset.
- `src/browser/icons.js` — `drawFeatureIcon`'s new optional `dir` param + `ONEWAYDOOR_ROTATION_DEG` map; doc comments updated.
- `test/unit/tutorial.test.js` — fake-ctx helper + 7 new `drawFeatureIcon` rotation/fail-open tests.

## Decisions Made

See `key-decisions` in the frontmatter above (root-cause generic-hover fix vs. per-control patches, removing the walk-to-dismiss shortcut instead of gating around it, three-layer movement gating as defense-in-depth around the true single choke point, `.mazebox` vs. full-viewport as the overlay's covering container, the optional/additive `dir` param, and the 16px splash inset).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — missing critical functionality] `button.danger` (combat Flee/Withdraw) had no scoped hover/active override**
- **Found during:** Item 1, while auditing every control the plan's "combat buttons" wording covers.
- **Issue:** `.primary` combat buttons (Strike, Potion, again/Confirm) already had scoped `:hover`/`:active` overrides from earlier DR rounds, but `.danger` (used only by the in-combat Flee/Withdraw button) had none — it would have fallen through to the same generic white-flash rule Item 1 exists to eliminate.
- **Fix:** added `button.danger:hover:not(:disabled)`/`:active` using the danger palette (`var(--mw-danger-panel)`/`var(--stamp)`), consistent with `.mw-danger-btn`'s own darker-fill press treatment.
- **Files modified:** `mazeworld.html`
- **Commit:** `f078175`

**2. [Rule 1 — bug] Sticky-hover on the SELECTED nav tab could revert it off gold**
- **Found during:** Item 1, while specificity-checking `.mw-tab:hover` against `.mw-tab.active`.
- **Issue:** a plain `.mw-tab:hover:not(:disabled)` rule (3 class-level selectors) outranks `.mw-tab.active` (2 class-level selectors) regardless of source order, so a sticky-hover tap landing on the currently-active tab would have visually un-golded it back to the inactive muted color — the opposite of "the active/selected NAV tab stays the mock's gold treatment."
- **Fix:** added a second, higher-specificity `.mw-tab.active:hover:not(:disabled)` rule reasserting the gold treatment.
- **Files modified:** `mazeworld.html`
- **Commit:** `f078175`

None of the other work required a checkpoint or user decision — all four items were independently verifiable (build + full test suite) and matched the plan's explicit instructions directly.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI + a pure canvas-drawing helper) work reusing existing engine seams (`S`/`window.__mzState`, `hasActiveEncounter()`, `preloadIcons()`'s already-loaded PNG set, `engine/maze.js`'s existing `cell.dir` field) — no new network endpoints, auth paths, or schema changes. No `GameState.rngState` mutation from presentation code; movement gating only ever *prevents* a dispatch, never alters engine state directly.

## Verification

- `npm run build:www` — succeeds at all four commit checkpoints; `www/index.html` reflects each item's changes (verified `www/` is gitignored, so no stray build artifacts were committed).
- `npm test` — **451 → 458/458 green** (451 baseline + 7 new `drawFeatureIcon` rotation tests from Item 3), green at every checkpoint.
- `npm run test:quick` — **369/369 green** at the final checkpoint (Items 1–2 don't touch `src/`/`content/`/`engine/` files `test:quick` covers; Items 3–4 verified green after their respective changes).
- Self-check: all 4 commit hashes (`f078175`, `b431200`, `2a87e56`, `f52820e`) present in `git log`; `mazeworld.html` contains `-webkit-tap-highlight-color:transparent` (2 occurrences: comment + rule), `.mazebox{position:relative...`, and `object-fit:contain` (2 occurrences: `.mw-title-art` + the pre-existing `.mw-legend-row img`); `src/browser/icons.js` contains `ONEWAYDOOR_ROTATION_DEG` (3 occurrences: definition + doc references).
- No headless-DOM/visual harness exists in this project (consistent with prior `04-DR*-SUMMARY.md` notes) — the on-device "feel" of the tap-highlight suppression, the overlay's actual screen-space coverage, the one-way-door icon's real rotated appearance, and the splash's letterboxed framing are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `*{-webkit-tap-highlight-color:transparent}`, `.dpad button:hover:not(:disabled)`, `.mw-tab.active:hover:not(:disabled)`, `button.danger:hover:not(:disabled)`, `.mazebox{position:relative...`, `#enc-panel` as a `.mazebox` child, `hasActiveEncounter()` calls in the dpad/keydown handlers and `engineMove`, `iconsApi.drawFeatureIcon(ctx, img, x * CELL, y * CELL, CELL, c.dir)`, `.mw-title-art{...object-fit:contain...}`
- FOUND: `src/browser/icons.js` — `ONEWAYDOOR_ROTATION_DEG`, `drawFeatureIcon(ctx, img, dx, dy, size, dir)`
- FOUND: `test/unit/tutorial.test.js` — `makeFakeCtx`, 7 new `drawFeatureIcon:` test titles
- FOUND commit `f078175` (fix(04-dr5a): global tap-highlight fix + gold-on-dark active states everywhere)
- FOUND commit `b431200` (fix(04-dr5a): encounter overlay covers camp+D-pad and blocks movement)
- FOUND commit `2a87e56` (feat(04-dr5a): one-way-door icon rotates to its passable direction)
- FOUND commit `f52820e` (fix(04-dr5a): splash title-art shows whole image on any device aspect ratio)
- FOUND: `npm test` 458/458 and `npm run test:quick` 369/369 at final state

## Next Phase Readiness

- All four DR5A Pass A items are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next (this round is explicitly Pass A — interaction/visual; any remaining Pass B items are out of this round's scope).
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
