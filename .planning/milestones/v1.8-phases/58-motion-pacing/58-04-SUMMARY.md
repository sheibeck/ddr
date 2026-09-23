---
phase: 58-motion-pacing
plan: 04
subsystem: ui
tags: [motion, css-transitions, css-animation, panel-motion, rail, hud-menu, tabs, encounter-overlay, mazeworld.html]

# Dependency graph
requires:
  - phase: 58-motion-pacing (plan 01)
    provides: "src/browser/motion.js — OPEN_MS/MENU_OPEN_MS/CLOSE_MS/CLOSE_SLACK_MS/EASE_OUT_CSS/EASE_IN_CSS and createPanelMotion, the timer-driven panel close helper this plan wires into the shell"
  - phase: 58-motion-pacing (plan 03)
    provides: "test/unit/harness/fakeClock.js and the reduced-by-default loadShellSandbox({ doc, reducedMotion, clock }) this plan's animated-path tests reuse"
  - phase: 57-map-hud-layout-band (plan 02)
    provides: "the rail's transform/visibility overlay model (data-shown) this plan finally makes animatable"
  - phase: 57-map-hud-layout-band (plan 05)
    provides: "the ☰ HUD menu's data-open model this plan adds a transition onto"
provides:
  - "window.__mzMotion — the bridged { reduced, open, close, isClosing } wrapper over one shared createPanelMotion instance"
  - "showPanel(el)/hidePanel(el, onHidden) — classic-script fail-open wrappers over window.__mzMotion, used by every hidden-based D-05 close"
  - "CSS open/close motion (180ms ease-out open, 120ms ease-in close; the ☰ menu 160ms open) for the rail, the three bottom sheets, the ☰ menu, the encounter overlay and tab switches"
  - "the rail's [hidden] rule finally restoring display:block!important, beating the global [hidden]{display:none!important} reset that silently defeated 57-02's slide"
  - "renderRail()'s slide-out content retention — an idle re-render skips the repaint so the departing card's content survives its close"
  - "test/unit/panel-motion.test.js — the 9-test automated proof for all of the above"
affects: [58-05, 58-06, 58-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A D-05 surface's close routes through ONE of two motion models: hidden-based surfaces (sheets, overlay, tab screens) animate via window.__mzMotion's timer-driven createPanelMotion (hidden flips after CLOSE_MS+slack, never on a completion event); data-state surfaces (the rail's data-shown, the ☰ menu's data-open) animate via a pure CSS transition between two already-declared states, with visibility flipping only at the transition's own end (a 0s-duration, delayed visibility declaration) — no JS timer needed for either."
    - "showPanel(el)/hidePanel(el, onHidden) are fail-open wrappers: a missing window.__mzMotion bridge (including tab-init's very first showTab(\"maze\") call, which runs before the module script exists) falls back to the pre-Phase-58 instant hidden toggle — exactly the same posture every other window.__mz* consumer in this file takes."
    - "A tab's outgoing screen leaves as an absolutely-positioned, pointer-inert, input-inert layer pinned to exactly what was on screen — an inline translateY offset by .mw-screens' own scrollTop, cleared to \"\" once the close finishes (or on a cancel)."

key-files:
  created:
    - test/unit/panel-motion.test.js
  modified:
    - mazeworld.html
    - src/browser/bridge.js
    - docs/SHELL-MODULES.md
    - test/unit/harness/shellSandbox.js
    - test/unit/reduced-motion.test.js
    - test/unit/shell-map-rail.test.js
    - test/unit/rail-overlay.test.js
    - test/unit/rail-dismiss.test.js
    - test/unit/hud-menu-layout.test.js
    - test/unit/shell-map-hud.test.js

key-decisions:
  - "The rail and the ☰ menu do NOT route through window.__mzMotion — both already had a data-state model (data-shown/data-open) with `hidden` (rail) or nothing (menu) as the only JS-owned truth, so a pure CSS transition between the two already-declared states is the complete fix; the plan's own text confirms this ('Surfaces with a data-state model... close with CSS transitions whose visibility flips only at the end of the close')."
  - "showPanel()'s reselected-target branch clears any stale `el.style.transform` before calling showPanel/open — a Rule 3 fix found while writing panel-motion.test.js (7)'s mid-leave-cancel case (see Deviations)."
  - "panel-motion.test.js (8)'s rail-retention test needed its own minimal vm sandbox (mirroring rail-dismiss.test.js's own 'deliberate sibling loader' pattern) rather than test/unit/harness/shellSandbox.js's loadShellSandbox(), because that harness stubs renderRail() to a no-op AFTER the classic script runs (it serves only the Gear/Hero/Store snapshot surfaces) — this test needs the REAL renderRail()."

patterns-established:
  - "Every D-05 surface's CSS duration/easing is a literal transcription of src/browser/motion.js's own OPEN_MS/MENU_OPEN_MS/CLOSE_MS/EASE_OUT_CSS/EASE_IN_CSS constants — panel-motion.test.js (1) parses the stylesheet and asserts equality against those constants directly, so CSS and JS can never silently drift apart."

requirements-completed: [MOTION-02, MOTION-05]

coverage:
  - id: D1
    description: "CSS open/close motion for all five D-05 surfaces (rail, sheets, ☰ menu, encounter overlay, tabs), timed to motion.js's OPEN_MS(180)/MENU_OPEN_MS(160)/CLOSE_MS(120) constants; three new keyframes (mwsheetin/mwsheetout/mwfadeout), mwrise/mwfade untouched"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/panel-motion.test.js (1) CSS/JS agreement, (3) keyframe hygiene, (9) pointer-inertness"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail's [hidden] rule restores display:block!important, beating the global [hidden]{display:none!important} reset that silently defeated 57-02's slide since it landed — the rail can now actually animate"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/panel-motion.test.js (2); test/unit/rail-overlay.test.js (3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "window.__mzMotion bridge + showPanel()/hidePanel() classic wrappers; every hidden-based D-05 close (MARKS/Settings/camp sheets, encounter overlay, showTab's outgoing screen) routes through them, fail-open when the bridge is missing"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/panel-motion.test.js (4)/(5)/(6)/(7); test/unit/bridge-registry.test.js (10/10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tab switches cross-fade: the incoming screen fades in, the outgoing screen leaves as an absolutely-positioned, input-inert layer pinned to what was on screen (translateY offset by .mw-screens' scrollTop), cancels on a mid-leave re-select"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/panel-motion.test.js (7)"
        status: pass
    human_judgment: false
  - id: D5
    description: "renderRail() retains the departing card's content through an idle re-render (no repaint of tone/icon/title/lines/drop-shelf/actions); the mw-rail-new rise re-triggers only when a card replaces a card while the rail is already shown, never on a hidden-to-shown render"
    requirement: "MOTION-02"
    verification:
      - kind: unit
        ref: "test/unit/panel-motion.test.js (8); test/unit/rail-dismiss.test.js Section B (4)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Reduced motion (MOTION-05): every D-05 hidden-based close resolves synchronously with no data-motion and no inline transform under the default reduced sandbox; settleAllMotion() drains panelMotion.finishAll()"
    requirement: "MOTION-05"
    verification:
      - kind: unit
        ref: "test/unit/reduced-motion.test.js — panels section (5/5)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase gate: npm test fail 0 (3740/3740, +13 over the 3727/3727 baseline at dispatch), npm run build:www exit 0, engine/content/test-parity diff against BASE_58 empty, package.json/lock untouched, bridge-registry green"
    verification:
      - kind: unit
        ref: "npm test (3740/3740)"
        status: pass
      - kind: other
        ref: "npm run build:www"
        status: pass
      - kind: other
        ref: "git diff --stat a01b38e..HEAD -- engine/ content/ test/parity/ -> empty; git diff --stat a01b38e..HEAD -- package.json package-lock.json -> empty"
        status: pass
      - kind: unit
        ref: "test/unit/bridge-registry.test.js (10/10)"
        status: pass
    human_judgment: false
  - id: D8
    description: "On the Pixel 7, the MARKS/camp/Settings sheets slide up and back down; the ☰ menu drops in and fades away; the encounter overlay fades in and out; tab switches cross-fade without the map appearing to scroll; the rail slides up with its card and slides back down with that same card; nothing feels sluggish"
    verification: []
    human_judgment: true
    rationale: "Real-device compositor smoothness, touch feel and timing perception cannot be proven from source or a headless sandbox — deferred to the Phase 60 batched Pixel 7 session per this run's deferred-UAT protocol."
  - id: D9
    description: "With Android's Remove animations turned on, every D-05 surface appears/disappears instantly with nothing left half-visible"
    verification: []
    human_judgment: true
    rationale: "The OS-level reduced-motion toggle's real-device effect cannot be proven from source or a headless sandbox — deferred to the Phase 60 batched Pixel 7 session."

# Metrics
duration: ~75min
completed: 2026-09-22
status: complete
---

# Phase 58 Plan 04: Panel Motion (MOTION-02) Summary

**Every MOTION-02 surface (rail, MARKS/Settings/camp sheets, ☰ menu, encounter overlay, tab switches) now opens in 180ms/160ms ease-out and closes in 120ms ease-in through CSS pinned to `src/browser/motion.js`'s own constants, routed through one shared `window.__mzMotion` timer-driven close helper for the hidden-based surfaces — and the rail's `[hidden]` rule finally beats the global `!important` reset that has silently defeated its slide since 57-02 landed.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-09-22 (session start, before first Read)
- **Completed:** 2026-09-22T21:10:55Z
- **Tasks:** 3
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments

- CSS motion for all five D-05 surfaces: the rail's base rule carries the CLOSE transition (transform 120ms ease-in + delayed visibility), `[data-shown="1"]` carries the OPEN transition (transform 180ms ease-out); the ☰ menu's resting/`[data-open="1"]` rules gained the equivalent opacity+transform transitions at 120ms/160ms; the sheets' scrim/panel animations retimed to 180ms ease-out open / new 120ms ease-in closing keyframes (`mwsheetout`/`mwfadeout`); the encounter overlay gained an 180ms `mwfade` open and a 120ms `mwfadeout` pointer-inert close; tabs gained `.mw-screens > .mw-screen` (open, `mwfade`) and `[data-motion="closing"]` (absolute, pointer-inert, `mwfadeout`) rules. Three new keyframes total (`mwsheetin`/`mwsheetout`/`mwfadeout`); `mwrise`/`mwfade` untouched, still exactly one `@keyframes mwrise`.
- **The rail's `!important` fix**: `.mw-rail[hidden]` now reads `display:block!important`, finally beating the file's own first-line global `[hidden]{display:none!important}` reset — 57-02's slide model was never actually animatable until this commit (confirmed and carried forward from 57-VERIFICATION.md's override).
- `window.__mzMotion` bridge (`{ reduced, open, close, isClosing }`) over one `createPanelMotion` instance in the module script; `settleAllMotion()` now also drains it via `panelMotion.finishAll()`. Classic-script `showPanel(el)`/`hidePanel(el, onHidden)` are fail-open wrappers every hidden-based D-05 close (MARKS/Settings/camp sheets, encounter overlay, a tab's outgoing screen) now routes through instead of a raw `hidden` write; `lastDismissAt` stamps stay at CALL time.
- `showTab`: the incoming screen opens through `showPanel`; every other currently-shown, not-already-closing screen leaves as an absolutely-positioned, pointer-inert layer pinned to exactly what was on screen (an inline `translateY` offset by `.mw-screens`' own `scrollTop`), fading out through `hidePanel` — or hiding instantly under reduced motion / before the module script exists.
- `renderRail()`: reads `wasShown` before its existing `hidden`/`data-shown` write (both unchanged); an idle render (the card just cleared) now does the SAME idle bookkeeping (key/hold-timer/announcer) and returns WITHOUT repainting tone/icon/title/lines/drop-shelf/actions, so the departing card's content survives its slide-out intact. The `mw-rail-new` rise re-triggers only when `wasShown` (a card replacing a card while the rail is already up) — a hidden-to-shown change lets the CSS slide play alone.
- `test/unit/panel-motion.test.js` (new, 9 named tests) proves every claim above on a fake clock; `test/unit/reduced-motion.test.js` gained a 5-test "panels" section proving the MOTION-05 synchronous path; five pre-existing Phase 57 "no motion yet" test files were re-pinned to the Phase 58 motion contract (none loosened, none dropped).
- Phase gate: `npm test` 3740/3740 (fail 0, +13 over the 3727/3727 baseline recorded at dispatch), `npm run build:www` exit 0, `engine/`/`content/`/`test/parity/` diff against BASE_58 empty, `package.json`/`package-lock.json` untouched, `bridge-registry.test.js` 10/10.

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS open/close motion for the rail, sheets, ☰ menu, overlay and tabs, and the rail's !important hidden fix** - `4422f78` (feat)
2. **Task 2: JS — the __mzMotion bridge, every hidden-based close through it, the tab cross-fade, and the rail's slide-out retention** - `d5a9a69` (feat)
3. **Task 3: panel-motion.test.js, the panels section of reduced-motion.test.js, and re-pinning Phase 57's "no motion yet" guards** - `211a79e` (test)

**Plan metadata:** pending (this SUMMARY.md's own commit)

## Files Created/Modified

- `mazeworld.html` — the CSS motion rules, the `__mzMotion` bridge, `showPanel`/`hidePanel`, the sheet/overlay/`showTab`/`renderRail` call-site changes
- `src/browser/bridge.js` — the `__mzMotion` BRIDGE row (sorted between `__mzMapView` and `__mzNightlyEats`)
- `docs/SHELL-MODULES.md` — regenerated via `node tools/bridge-doc.mjs --write`
- `test/unit/harness/shellSandbox.js` — wires a REAL `window.__mzMotion` from `createPanelMotion`/`prefersReducedMotion`
- `test/unit/panel-motion.test.js` — new, 9 tests (CSS/JS agreement, the rail fix, keyframe hygiene, sheet/overlay/tab animated close+cancel, rail retention, pointer-inertness)
- `test/unit/reduced-motion.test.js` — new "panels" section, 5 tests
- `test/unit/shell-map-rail.test.js` — (b)/(p) re-pinned
- `test/unit/rail-overlay.test.js` — (3)/(5)/(7) re-pinned
- `test/unit/rail-dismiss.test.js` — Section B (4) re-pinned
- `test/unit/hud-menu-layout.test.js` — (6)/(7) re-pinned
- `test/unit/shell-map-hud.test.js` — PERF-addendum test re-pinned (Rule 1, out-of-scope fix — see Deviations)

## Decisions Made

See `key-decisions` in the frontmatter above (the rail/menu's CSS-only motion model vs. the hidden-based `window.__mzMotion` model; the reselected-target transform-clear fix; the rail-retention test's own minimal sandbox).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking bug in this task's own code] `showTab`'s reselected-target branch left a stale inline `translateY` transform after cancelling a mid-leave**
- **Found during:** Task 3, while writing `panel-motion.test.js` (7)'s "showTab mid-leave cancel" case
- **Issue:** Per the plan's own wording, `showPanel(el)` (called for the reselected target screen) cancels a pending close but does not clear the leaving screen's inline `style.transform`. A rapid tap back to a tab that was still mid-leave (its own animated close carrying `translateY(-<scrollTop>px)`) would therefore reopen with that stale transform still applied — a visible slide artifact, directly undermining the plan's own D-06 requirement ("nothing slides horizontally, so the map never looks like it is scrolling").
- **Fix:** `showTab`'s `key === name` branch now clears `el.style.transform = ""` before calling `showPanel(el)`.
- **Files modified:** `mazeworld.html`
- **Verification:** `panel-motion.test.js` (7)'s mid-leave-cancel assertion (`hero.style.transform === ""` after the cancel) passes; full suite green.
- **Committed in:** `211a79e` (Task 3 commit)

**2. [Rule 1 - bug caused by Task 2's own change, in a file outside Task 3's declared list] `test/unit/shell-map-hud.test.js`'s PERF-addendum test broke**
- **Found during:** Task 2's full `npm test` run (surfaced again at Task 3)
- **Issue:** Task 2 changed `renderEncounter`'s `panel.hidden = true/false` writes to `hidePanel(panel)`/`showPanel(panel)`. `shell-map-hud.test.js`'s own PERF-addendum test (not declared in this plan's `files_modified`) independently pinned the OLD `panel.hidden = true/false` literals in the same region — a duplicate of `shell-map-rail.test.js`'s own (p) test, which the plan DID have Task 3 re-pin.
- **Fix:** Re-pinned to the new `hidePanel(panel);`/`showPanel(panel);` call sites, same surrounding statements — mirroring the `shell-map-rail.test.js` (p) re-pin exactly.
- **Files modified:** `test/unit/shell-map-hud.test.js` (not in this plan's declared `files_modified`, added per Rule 1 — the breakage was directly caused by this plan's own Task 2 change)
- **Verification:** `node --test test/unit/shell-map-hud.test.js` green; full `npm test` green (3740/3740).
- **Committed in:** `211a79e` (Task 3 commit)

---

**Total deviations:** 2 (1 Rule-3 blocking-bug fix inside the plan's own declared scope, 1 Rule-1 re-pin outside the declared file list but directly caused by this plan's own Task 2 change). No scope creep beyond what correctness required; no test loosened or dropped.

### Teeth Checks (run AFTER the Task 3 commit `211a79e`, per this run's teeth-check-safety convention)

1. **The rail's `!important` fix.** Temporarily reverted `.mw-rail[hidden]{display:block!important;...}` to `display:block;` (no `!important`). `node --test --test-name-pattern="\(2\) the rail" test/unit/panel-motion.test.js` → **test (2) FAILED** as expected (the global `[hidden]{display:none!important}` reset wins again, so the assertion on the `!important` form fails). Reverted with `git checkout -- mazeworld.html`; confirmed clean and green again (test (2) passes).
2. **The sheet panel's close duration.** Temporarily changed `.mw-legend-panel`'s open animation from `mwsheetin .18s ease-out` to `mwsheetin .2s ease-out`. `node --test --test-name-pattern="\(1\) CSS" test/unit/panel-motion.test.js` → **test (1) FAILED** as expected (the CSS/JS agreement assertion, pinned to `OPEN_MS`=180ms=`.18s`, no longer matches `.2s`). Reverted with `git checkout -- mazeworld.html`; confirmed clean and green again.

Both teeth checks followed the run's mandatory `git diff --quiet -- mazeworld.html` pre-check (exited 0/clean immediately before each mutation) and were reverted via `git checkout --`, never a manual rewrite.

## Issues Encountered

- `test/unit/harness/recordingDom.js`'s `document.querySelector` fake only supports `"#id"` selectors (throws on a class selector) — my first `showTab` implementation cached `.mw-screens` via `document.querySelector(".mw-screens")`, which broke ~40 unrelated pre-existing sandbox tests across `darkness-vignette.test.js`/`hud-bands-layout.test.js`/`hud-menu-layout.test.js`/`map-pan.test.js`/`reduced-motion.test.js` (all of which boot the full classic script, including `initTabs`'s own `showTab("maze")` call at tab-init). Fixed by using `document.getElementById("mw-screens")` instead (the element already carries that id in the real markup) — caught immediately by the first `npm test` re-run after Task 2, before any commit.
- `test/unit/panel-motion.test.js` (8) (rail retention) initially tried to reuse `test/unit/harness/shellSandbox.js#loadShellSandbox`, which stubs `renderRail()` to a no-op — silently making the test a no-op too. Caught by re-reading `shellSandbox.js`'s own doc comment (which explicitly names `rail-dismiss.test.js`'s "deliberate sibling loader" pattern as the precedent for exactly this situation) before running the test, not after a confusing false-pass; rewrote test (8) with its own minimal vm sandbox that wires only what `renderRail()` itself reads.

## User Setup Required

None - no external service configuration required.

## Human Verification — Deferred to Phase 60

Per the standing deferred-UAT protocol, no device pause occurred and no APK was built.

1. On the Pixel 7, the MARKS, camp and Settings sheets slide up and back down; the ☰ menu drops in and fades away; the encounter overlay fades in and out; switching tabs cross-fades without the map appearing to scroll; the rail slides up with its card and slides back down with that same card; nothing feels sluggish (opens about 180ms, closes about 120ms).
2. With Android's Remove animations turned on, every surface above appears and disappears instantly and nothing is left half-visible.

## Next Phase Readiness

- `window.__mzMotion` is live and reusable by any later Phase 58 plan that needs a hidden-based animated close.
- `test/unit/reduced-motion.test.js`'s "panels" section joins the shared MOTION-05 ledger (pan + panels sections now present) — plans 58-05/58-06/58-07 each append their own effect's section below.
- No blockers. Plan 58-05 (typewriter wiring) and 58-06 can proceed; 58-07 is the combat-beat/final-audit plan that checks every MOTION-05 ledger section is present.

## Self-Check: PASSED

- FOUND: mazeworld.html
- FOUND: src/browser/bridge.js
- FOUND: docs/SHELL-MODULES.md
- FOUND: test/unit/harness/shellSandbox.js
- FOUND: test/unit/panel-motion.test.js
- FOUND: test/unit/reduced-motion.test.js
- FOUND: test/unit/shell-map-rail.test.js
- FOUND: test/unit/rail-overlay.test.js
- FOUND: test/unit/rail-dismiss.test.js
- FOUND: test/unit/hud-menu-layout.test.js
- FOUND: test/unit/shell-map-hud.test.js
- FOUND: commit 4422f78
- FOUND: commit d5a9a69
- FOUND: commit 211a79e

---
*Phase: 58-motion-pacing*
*Completed: 2026-09-22*
