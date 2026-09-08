---
phase: 04-mobile-presentation-controls-onboarding
plan: 05
subsystem: ui
tags: [dark-theme, self-hosted-fonts, tab-nav, hud, safe-area, status-bar, gamename, vanilla-js]

# Dependency graph
requires:
  - phase: 04-02
    provides: "src/browser/settings.js: readSettings, textScaleForSize, effectiveTextScale (UX-08 text-scale math)"
  - phase: 04-11
    provides: "ddr.*.v1 persistence keys (mazeworld.*.v1 -> ddr.*.v1 rename) that this plan's loadGraves()/save()/load() already read"
provides:
  - "The dark torch-lit shell: self-hosted Press Start 2P + Courier Prime fonts, dark palette repointed onto the existing CSS custom-property names, fixed 5-tab bottom nav (MAZE/HERO/GEAR/ORACLE/DEAD) with screen-container switching, real-state top HUD (FLOOR/DAY/SQUARES/RATIONS + depletion bar)"
  - "src/browser/gameName.js: GAME_NAME centralized constant, wired into document.title + the masthead h1 at boot"
  - "Safe-area-aware layout (viewport-fit=cover; var(--safe-area-inset-*, env(...)) fallback padding on the HUD/tab bar) and a dark-recolored native status bar (nativeChrome.js)"
  - "GEAR/DEAD Copywriting Contract empty/loading/error states (NOTHING LEFT TO CARRY / NOBODY'S DOWN THERE YET / THE LEDGER WON'T OPEN)"
affects: [04-06 (canvas viewport/icons — draw() still needs its recolor), 04-07..04-10 (fill in the HERO/GEAR/ORACLE/DEAD shells this plan built), 04-09 (settings screen — writes mazeworld.textSize which effectiveTextScale already consumes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repointing existing CSS custom-property NAMES (--paper/--ink/--ditto/--stamp/--moss/--rule) to new palette values reskins the entire existing panel/button/log CSS system without a per-selector rewrite — new structural chrome only needed new selectors (.mw-hud/.mw-tabbar/.mw-screens/.mw-empty)"
    - "The maze <canvas> renderer's palette lookup is frozen to literal hex (MAZE_CANVAS_COLORS) instead of reading the (now dark) :root custom properties live, so canvas output stays byte-for-byte unchanged across an app-wide reskin until a dedicated canvas-recolor plan touches it"
    - "5-tab switching is a pure DOM show/hide (window.__mzShowTab) over 5 always-present screen containers reusing the EXISTING paint()-targeted element ids (m-floor, s-name, s-carry, yard, etc.) — zero changes needed to paint()/renderEncounter()'s DOM-binding logic"

key-files:
  created:
    - src/browser/gameName.js
    - fonts/press-start-2p-400.woff2
    - fonts/courier-prime-400.woff2
    - fonts/courier-prime-700.woff2
  modified:
    - mazeworld.html
    - src/browser/nativeChrome.js

key-decisions:
  - "Tasks 1-3 landed as 2 commits, not 3 — all three tasks edit mazeworld.html and are heavily interleaved within that single file (dark palette tokens, safe-area CSS, and the tab/HUD markup all live in the same <style>/<body> regions), so a clean 3-way hunk split was impractical without redoing the work. Commit 1 covers mazeworld.html + fonts/*.woff2 + gameName.js (all of Tasks 1+2 plus mazeworld.html's half of Task 3); commit 2 covers nativeChrome.js alone (the remainder of Task 3). Every task's acceptance criteria are independently verified below regardless of commit boundary."
  - "Repointed the EXISTING --paper/--paper-2/--paper-3/--ink/--ink-soft/--ditto/--ditto-2/--stamp/--moss/--rule/--mono/--disp/--body custom-property values to the dark palette/self-hosted fonts, rather than introducing a parallel set of new variable names — the whole legacy panel/button/dl.stats/ul.kit/log CSS (and JS template strings like `style=\"color:var(--${tone})\"`) already read these exact names, so this reskins the app without touching ~150 existing selectors."
  - "draw()'s canvas color lookup (--grid/--ink/--stamp/--ditto/--moss) is frozen to a literal MAZE_CANVAS_COLORS hex table matching the OLD light-theme values, since the maze canvas's own background stays the unchanged #F4EEDF light fill (canvas recoloring is 04-06's job) — reading the now-dark :root values live would render near-invisible low-contrast marks."
  - "RATIONS_BAR_MAX=8 is a documented VISUAL-ONLY ceiling for the depletion bar — the engine has no fixed ration cap (starting count is 4-6 by class, engine/character.js#153, and cooking/economy events can add more), so this is not a game rule."
  - "Rations 'warn' state threshold changed from `c.rations === 0` to `c.rations <= 2`, matching 04-UI-SPEC.md's Color contract ('low-rations number + bar (<=2 rations remaining)') rather than the prototype's original zero-only threshold."
  - "The Dungeon Master's notes panel (doss-who/doss, populated by paint()) was kept and folded into the HERO tab (retitled 'The Maze Master's notes') rather than dropped, since paint() writes to it unconditionally every render and it's reasonable flavor content for the character-sheet tab; the desktop-only 'departs from the rulebook' credits section was kept in the DOM but hidden (content preserved, nothing deleted) since it isn't part of any 04-UI-SPEC.md mobile screen."
  - "button.primary's text color changed from a hardcoded off-white (#F6F1E4) to var(--paper) (#14110c) to match 04-UI-SPEC.md's primary-button contract (dark text on the gold accent fill) now that --ditto is gold instead of purple."
  - "html{color-scheme:light} changed to color-scheme:dark so browser-native chrome (scrollbars, form controls) matches the reskin."

patterns-established:
  - "New rem-based typography role tokens (--mw-font-micro/body/data/display) multiply --mw-text-scale, set on #app by settings.js's effectiveTextScale at boot — later screens should read these tokens for new markup rather than introducing more hardcoded px sizes."

requirements-completed: [UX-03, UX-08]

coverage:
  - id: D1
    description: "Self-hosted Press Start 2P + Courier Prime 400/700 (latin-subset woff2) ship with zero Google Fonts CDN reference in the built www/index.html"
    requirement: "UX-08"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && grep -Eiq 'fonts\\.(googleapis|gstatic)\\.com' www/index.html (expected: no match) && ls www/fonts/{press-start-2p-400,courier-prime-400,courier-prime-700}.woff2"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/browser/gameName.js exports GAME_NAME === 'Delve, Die, Repeat'; document.title and the masthead h1 are wired from it at boot"
    verification:
      - kind: unit
        ref: "npm test (451/451 green) — no dedicated gameName unit test in this plan; content verified via grep of the module export and the trailing module script's document.title/titleEl.textContent assignment"
        status: pass
    human_judgment: true
    rationale: "No automated DOM-render test asserts document.title at runtime in a browser context (node:test has no window here) — the constant/wiring were verified by direct source inspection, not an executed assertion; a device/browser UAT pass confirming the title bar and masthead text would close this out fully."
  - id: D3
    description: "www/index.html after build contains the five tab labels MAZE/HERO/GEAR/ORACLE/DEAD and still contains id=\"maze\" (canvas preserved)"
    requirement: "UX-01/02/03"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && grep -o 'data-tab=\"[a-z]*\"[^>]*>[A-Z]*' www/index.html (5 matches) && grep -c 'id=\"maze\"' www/index.html (1 real element, verified via line inspection)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The top HUD binds FLOOR/DAY/SQUARES/RATIONS to live GameState fields (floor.depth/day/steps/c.rations) via paint(), not static text, and re-renders on every move/action"
    requirement: "UX-03"
    verification:
      - kind: unit
        ref: "node --test test/unit/engineAdapter.test.js (16/16 pass) — paint()'s DOM-binding logic itself is exercised indirectly through the full suite; the HUD element ids (m-floor/m-day/m-steps/m-rations) are unchanged from the pre-existing paint() implementation, only relocated/restyled"
        status: pass
    human_judgment: false
  - id: D5
    description: "Graveyard tab shows the zero-grave empty state NOBODY'S DOWN THERE YET when no graves exist; Gear tab CARRIED empty state shows NOTHING LEFT TO CARRY when there are zero consumables"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "npm test 451/451 green (no dedicated DOM-render unit test for these two strings exists yet — verified via direct source inspection of renderGraves()/paint()'s carry-empty branch)"
        status: pass
    human_judgment: true
    rationale: "These are DOM string-literal changes with no headless DOM in this project's node:test setup to assert rendered innerHTML against — confirmed by source read, not an executed assertion. A quick manual/browser check (open the app with an empty save/graveyard) would close this out."
  - id: D6
    description: "A storage read/write failure surfaces the generic THE LEDGER WON'T OPEN fallback; the graveyard renders a brief loading placeholder while mzStorage resolves"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "npm test 451/451 green — gravesLoadError flag + renderGravesLoading() verified via source inspection; no dedicated failure-path unit test added in this plan"
        status: pass
    human_judgment: true
    rationale: "No test forces loadGraves()'s catch branch or asserts renderGravesLoading()'s DOM output in this plan — behavior is correct by inspection and consistent with storage.js's existing fail-open contract, but an executed backstop test would strengthen this."
  - id: D7
    description: "viewport meta includes viewport-fit=cover; safe-area paddings use the var(--safe-area-inset-*, env(...)) fallback chain, never bare env()"
    requirement: "UX-03"
    verification:
      - kind: automated_ui
        ref: "node tools/build-www.mjs && grep -o 'viewport-fit=cover' www/index.html && grep -c 'var(--safe-area-inset-' www/index.html"
        status: pass
    human_judgment: false
  - id: D8
    description: "nativeChrome.js status-bar background is dark-theme (#1b170f, not #EFE7D6); setStyle yields light-on-dark; decideBackAction/flushOnBackground behavior unchanged (their persistence tests stay green)"
    requirement: "UX-03"
    verification:
      - kind: unit
        ref: "node --test test/persistence/back-button-logic.test.js test/persistence/lifecycle.test.js (18/18 pass)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Full test suite and quick suite stay green after the reskin"
    verification:
      - kind: unit
        ref: "npm test (451/451 pass); npm run test:quick (362/362 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan 5: Dark Torch-Lit Shell Summary

**Rebuilt mazeworld.html's DOM/CSS chrome as the dark "torch-lit ledger" theme — self-hosted Press Start 2P + Courier Prime fonts, a fixed 5-tab bottom nav (MAZE/HERO/GEAR/ORACLE/DEAD), a real-GameState top HUD, safe-area-aware layout, a dark-recolored native status bar, and a centralized GAME_NAME constant — all reskinned around the untouched `<canvas id="maze">`.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-08T16:28Z (approx, after 04-11's completion commit)
- **Completed:** 2026-09-08T16:47:07Z (final task commit)
- **Tasks:** 3 (landed as 2 commits — see Decisions Made)
- **Files modified:** 6 (2 modified, 4 created: 3 fonts + gameName.js)

## Accomplishments
- Self-hosted Press Start 2P (400) + Courier Prime (400/700) latin-subset woff2 files fetched and committed to `fonts/`; the light-theme's Special Elite/Crimson Pro/IBM Plex Mono `@font-face` rules are removed from the live theme (files stay on disk, unreferenced). Built `www/index.html` has zero `fonts.googleapis`/`fonts.gstatic` reference.
- Dark torch-lit palette applied by repointing the EXISTING `--paper`/`--ink`/`--ditto`/`--stamp`/`--moss`/`--rule` (etc.) CSS custom-property values to 04-CONTEXT.md's hex palette, reskinning the whole pre-existing panel/button/stats/log CSS system without a per-selector rewrite. Added `--mw-text-scale` + four `--mw-font-*` rem typography-role tokens (UX-08).
- New `#app` shell: a fixed, safe-area-padded top HUD showing real `FLOOR n / DAY n / SQUARES n / RATIONS n` (with a 78×5px depletion bar) bound to live `GameState` via the existing `paint()` function's DOM ids, and a fixed 5-tab bottom nav (MAZE/HERO/GEAR/ORACLE/DEAD, each ≥48dp) switching between 5 always-present screen containers. MAZE is the default landing screen and contains the `<canvas id="maze">` element completely unchanged.
- `draw()`'s canvas color lookup is frozen to a literal `MAZE_CANVAS_COLORS` hex table (matching the original light-theme values) instead of reading the now-repointed `:root` custom properties live, so the still-light maze floor (`#F4EEDF`, untouched) keeps legible contrast — canvas recoloring is explicitly 04-06's job.
- GEAR's CARRIED empty state and DEAD's zero-grave empty/loading/error states now render the Copywriting Contract's exact copy (`NOTHING LEFT TO CARRY`, `NOBODY'S DOWN THERE YET`, `THE LEDGER WON'T OPEN`) instead of the prototype's original placeholder strings.
- `viewport-fit=cover` added to the viewport meta; top HUD/tab bar pad with the `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` fallback chain (never bare `env()`), per 04-RESEARCH.md Pitfall 2.
- `src/browser/nativeChrome.js`'s `registerNativeChrome()` recolors the native status bar to the dark theme (`Style.DARK` + `#1b170f`, was `Style.LIGHT` + `#EFE7D6`).
- `src/browser/gameName.js` centralizes `GAME_NAME = "Delve, Die, Repeat"`, wired into `document.title` and a visually-hidden, accessible `<h1>` at boot.

## Task Commits

1. **Tasks 1+2 (+ mazeworld.html's half of Task 3): self-hosted fonts, dark theme tokens, GAME_NAME, 5-tab nav, real HUD, screen shells, safe-area CSS** - `91836d8` (feat)
2. **Task 3 remainder: dark native status bar** - `f52d8b0` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `mazeworld.html` - Dark theme palette/fonts at `:root`; new `#app`/`.mw-hud`/`.mw-tabbar`/`.mw-screens` chrome; 5 screen containers wrapping the existing panels (canvas/HUD/character sheet/gear/log/graveyard) by relocated but ID-preserved markup; `draw()` canvas-color freeze; rations depletion bar + `<=2` warn threshold; GEAR/DEAD empty/loading/error copy; `viewport-fit=cover`; tab-switch IIFE; GAME_NAME/settings text-scale wiring in the trailing module script.
- `src/browser/nativeChrome.js` - Status bar recolored dark (`Style.DARK` + `#1b170f`).
- `src/browser/gameName.js` (new) - `GAME_NAME` constant.
- `fonts/press-start-2p-400.woff2`, `fonts/courier-prime-400.woff2`, `fonts/courier-prime-700.woff2` (new) - Self-hosted latin-subset OFL font files.

## Decisions Made
See `key-decisions` in the frontmatter above (commit-granularity note, CSS custom-property repointing strategy, canvas color freeze, RATIONS_BAR_MAX, rations warn threshold, Dungeon Master's notes/credits-section handling, primary-button text color, color-scheme).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Frozen the maze canvas's color lookup to prevent an invisible-maze regression**
- **Found during:** Task 1/2 (while defining the dark `:root` palette)
- **Issue:** `draw()` read its wall/feature-mark colors live via `getComputedStyle(document.documentElement)` against the SAME `--grid`/`--ink`/`--stamp`/`--ditto`/`--moss` custom properties the rest of the app uses. Repointing those to the dark palette (as Task 1 requires) would make the maze render near-invisible low-contrast marks against the canvas's own still-light `#F4EEDF` floor fill (canvas recoloring is out of this plan's scope — 04-06's job) — a visible gameplay regression, not just a cosmetic one.
- **Fix:** Added a `MAZE_CANVAS_COLORS` literal hex lookup table matching the ORIGINAL light-theme values and pointed `draw()`'s `C()` helper at it instead of `getComputedStyle`.
- **Files modified:** mazeworld.html
- **Verification:** `npm test` stays green; the maze's rendered feature-mark/wall colors are unchanged from before the reskin (visual, confirmed by inspection of the frozen literals matching the pre-edit `:root` values byte-for-byte).
- **Committed in:** 91836d8

**2. [Rule 1 - Bug] Fixed primary-button text contrast after --ditto became gold**
- **Found during:** Task 1/2 (palette repoint)
- **Issue:** `button.primary` hardcoded `color:#F6F1E4` (near-white) against `background:var(--ditto)`. `--ditto` used to be purple (`#4A3B8C`), where white text worked; now that `--ditto` is gold (`#e8c97a`), white-on-gold is low-contrast and doesn't match 04-UI-SPEC.md's primary-button contract (`color:#14110c` dark text on the gold fill).
- **Fix:** Changed `button.primary`'s text color to `var(--paper)` (`#14110c`).
- **Files modified:** mazeworld.html
- **Verification:** Matches 04-UI-SPEC.md's Component Contracts "Primary (accent)" spec exactly.
- **Committed in:** 91836d8

**3. [Rule 2 - Missing Critical] Distinguished a genuine graveyard storage-read failure from a real empty graveyard**
- **Found during:** Task 2 (implementing the DEAD tab's backstop states)
- **Issue:** The plan's backstop explicitly requires "A storage read/write failure surfaces the generic THE LEDGER WON'T OPEN fallback rather than a blank/broken screen" — but `loadGraves()`'s existing `catch` block just set `graves = []`, silently identical to a genuine empty graveyard. Without a separate error flag, a storage failure would render the wrong (misleadingly cheerful) empty-state copy instead of the error fallback.
- **Fix:** Added a `gravesLoadError` boolean, set in `loadGraves()`'s catch branch and cleared on success; `renderGraves()` checks it first and renders the `THE LEDGER WON'T OPEN` fallback before falling through to the empty-state/populated branches.
- **Files modified:** mazeworld.html
- **Verification:** `npm test` stays green (existing `loadGraves()`/`saveGraves()` sandbox-extraction tests in `test/persistence/dual-write-convergence.test.js` still pass unchanged, since they only exercise the success path).
- **Committed in:** 91836d8

**4. [Rule 1 - Bug] Kept the sentinel-marked persistence-extraction block DOM-free**
- **Found during:** Task 2 (adding the loading-placeholder function)
- **Issue:** `test/persistence/harness/sandboxClassicPersistence.js` extracts the `/* @gsd:dual-write-convergence-extract:graves:start/end */`-marked block VERBATIM into a `document`-less `node:vm` sandbox. An early draft placed the new `renderGravesLoading()` function (which calls `document.getElementById`) inside that marked block — harmless today (the sandbox test never calls it), but a latent trap for that harness's documented "only the two small persistence-function blocks" contract.
- **Fix:** Moved `renderGravesLoading()` to just after the `:graves:end` marker, outside the extracted block.
- **Files modified:** mazeworld.html
- **Verification:** `node --test test/persistence/dual-write-convergence.test.js` (part of the full suite) stays green; sentinel markers still wrap exactly `GRAVE_KEY`/`graves`/`gravesLoadError`/`loadGraves`/`saveGraves`.
- **Committed in:** 91836d8

---

**Total deviations:** 4 auto-fixed (2 bugs preventing visual/contrast regressions, 1 missing-critical backstop correctness fix, 1 bug preventing a latent test-harness trap)
**Impact on plan:** All four were necessary for correctness (maze legibility, button contrast, the plan's own explicitly-required error backstop, and test-harness safety) discovered while implementing the plan's own tasks. No scope creep — no new screens/features were added beyond what Tasks 1-3 specify.

## Issues Encountered
- **Commit granularity:** the plan describes 3 discrete tasks, but all three edit `mazeworld.html` and are deeply interleaved within it (the dark palette tokens Task 1 defines are consumed by Task 2's new markup; Task 3's safe-area CSS lives inside the same new `<style>` block as Task 2's tab-bar/HUD chrome). A clean 3-way `git add -p` hunk split was attempted and found impractical (41 hunks, many straddling task boundaries) without redoing the edits as strictly sequential passes. Landed as 2 commits instead (mazeworld.html+fonts+gameName.js, then nativeChrome.js alone) — see `key-decisions`. Every task's stated acceptance criteria were independently verified regardless of this commit-boundary compromise.

## User Setup Required
None - no external service configuration required. (Font files were fetched from Google's public gstatic CDN once, at build/dev time, by this executor — the SHIPPED app makes zero font network requests, per the offline requirement.)

## Next Phase Readiness
- The dark shell, 5-tab nav, and real HUD are in place for 04-06 (canvas viewport/icons — recolors `draw()`'s actual maze rendering and swaps the procedural glyphs for the 9 PNG icons) and the later HERO/GEAR/ORACLE/DEAD-filling plans (04-07..04-10) to build inside.
- `--mw-text-scale` is wired end-to-end (settings.js -> #app at boot) for any later plan's new markup to consume via the `--mw-font-*` rem tokens.
- `window.__mzShowTab(name)` is exposed for a later plan (e.g. the death card's "THE GRAVEYARD -> n" link) to jump tabs programmatically.
- Known gaps for later slices (not regressions, explicitly out of THIS plan's "shell" scope per its own objective): the maze canvas's own rendered colors/glyphs are still the light-theme originals (04-06); combat/death/win still render inside the MAZE tab's `enc-panel` rather than a dedicated full-screen overlay (04-UI-SPEC.md Screens 9-10, a later slice); the 48dp touch-target corrections table's remaining un-audited elements (e.g. the dynamically-created Carried-item "Use" button) were not swept in this plan since they're not covered by 04-05's own must-haves/backstops.
- No blockers for Wave 3+ (04-06 depends on 04-05, both now satisfied).

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*

## Self-Check: PASSED

All created files verified present on disk (fonts/press-start-2p-400.woff2, fonts/courier-prime-400.woff2, fonts/courier-prime-700.woff2, src/browser/gameName.js); both task commit hashes (91836d8, f52d8b0) verified present in `git log --oneline --all`; `npm test` 451/451 and `npm run test:quick` 362/362 green as of the final commit.
