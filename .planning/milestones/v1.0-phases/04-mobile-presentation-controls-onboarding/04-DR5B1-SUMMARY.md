---
phase: 04-mobile-presentation-controls-onboarding
plan: DR5B1 (device-review revision round 5, Pass B1 — title/exit flow + behavior, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [title-screen, quit-flow, graveyard, engine-action, map-centering, spells-ui]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR2/04-DR3/04-DR4: the title/roller screen scaffold, hasActiveDelveSave()/showTitleScreen({allowResume}), window.mzAbandonRun/mzReturnToTitle bridge functions"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR5A: hasActiveEncounter() gating, #enc-panel as a .mw-overlay over the full play area"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "engine/death.js#die()/bury(), engineAdapter.js's dispatch()->persistGrave() graveyard choke point, engine/engine.js's applyAction() action-type switch"
provides:
  - "Title screen reduced to a SINGLE context-aware ENTER button (RESUME removed entirely) — `resumeIntent` (mazeworld.html trailing module script) records whether the next ENTER tap resumes the live delve or opens the roller, seeded from `hadSaveAtLaunch` for the very first screen and recomputed live via hasActiveDelveSave() on every later re-show"
  - "HERO tab's non-destructive quit relabeled 'Abandon your run' -> 'Save & quit' (window.mzAbandonRun, unchanged save-then-title-screen behavior)"
  - "HERO tab's destructive option relabeled 'Clear save' -> 'Abandon this character' (window.mzAbandonCharacter), now correctly DESTRUCTIVE (buries the current character) instead of the old bug where it silently rerolled a new one"
  - "A new engine action type `abandon` (engine/actions.js, engine/engine.js) that calls the SAME engine/death.js#die() terminator every other death uses, with a distinct EPITAPHS.abandon/CAUSE_TEXT.abandon content bank (content/epitaphs.js) — sarcastic, family-friendly, non-combat cause"
  - "window.mzCenterMap — a classic-script pan-reset bridged onto window (same pattern as window.move/window.newGame) so the module script can auto-recenter the map viewport without duplicating the pan/positionCanvas closures"
  - "SPELLS button (in-combat) scrolls its own opened list into view via scrollIntoView, closing the 'looks dead below the fold' complaint inside #enc-panel's internally-scrolling overlay"
affects: [04-DR5B2, 05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "A voluntary, non-combat run termination is just another `cause` through the EXISTING engine/death.js#die() terminator, not a parallel code path — adding one engine action type (validated in actions.js, handled in engine.js's applyAction switch) reuses die()'s epitaph-filling, state.dead=true, and `died` event emission verbatim, which in turn reuses engineAdapter.js's dispatch()->persistGrave() graveyard hook with ZERO new persistence code. This is the 'route it through the proper engine seam' instruction operationalized: the RNG cursor advances through applyAction()'s normal rng.getState()/next.rngState assignment, so presentation code never reads or mutates GameState.rngState directly."
    - "A dead run is never treated as resumable (hasActiveDelveSave() checks `!S.dead`) — this is the SAME mechanism every other death already used to 'clear' a run for the next ENTER tap. No separate SAVE_KEY-deletion step was needed for the destructive abandon action; persist()'s existing unconditional post-dispatch write already leaves a dead-flagged save in place, exactly like a combat/hazard death does."
    - "boot() always leaves S.c populated — even a brand-new run rolls a full character via engine/state.js#newRun — so a LIVE hasActiveDelveSave() check cannot distinguish 'a real save existed at launch' from 'boot() just rolled a throwaway fresh-run character.' The title screen's very-first-tap decision must be seeded from a value captured BEFORE boot() ran (hadSaveAtLaunch); every LATER re-show of the title screen (quit, abandon, death) can safely use the live check because S by then reflects real gameplay, not a boot-time filler."
    - "Classic (non-module) <script> top-level `function` declarations are implicit `window.*` globals, but `let`/`const` bindings (e.g. `pan`) are NOT — a trailing `<script type=\"module\">` needing to trigger camera-pan logic defined via closures over a `let` variable must go through an explicit bridge function (window.mzCenterMap), the same pattern already established by window.move/window.newGame/window.__mzState."
    - "engine/movement.js#descend() pushes exactly one `floorChanged` event per genuine floor change and is never called for a 'gated'/blocked move attempt — checking `events.some(e => e.type === 'floorChanged')` after dispatch() is a reliable, false-positive-free trigger for viewport recentering, no separate depth-comparison bookkeeping needed."

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR5B1-SUMMARY.md
  modified:
    - mazeworld.html
    - engine/actions.js
    - engine/engine.js
    - content/epitaphs.js
    - test/unit/engine-purity.test.js
    - test/unit/engineAdapter.test.js
    - test/unit/content-tables.test.js

key-decisions:
  - "Split the title/quit/abandon redesign (items 1-3) into three separate atomic commits rather than one combined commit, even though the code regions are tightly coupled (resumeIntent/showTitleScreen is shared scaffolding all three items build on) — item 1 lands the ENTER-only title screen in isolation (old button labels/behavior untouched), item 2 layers in the Save & quit relabel, item 3 layers in the engine seam + Abandon this character. Each commit independently builds and passes the full test suite before the next lands."
  - "Reused engine/death.js#die() verbatim for the voluntary-abandon path instead of writing a parallel bury-without-dying code path — die() already does everything item 3 needs (state.dead=true, epitaph/deathNote fill, `died` event) and is the ONE terminator every OTHER death already funnels through; introducing a second terminator would have meant a second graveyard-write code path to keep in sync with engineAdapter.js's existing dispatch()->persistGrave() hook."
  - "'ABANDON THIS CHARACTER' is a no-op engine-side if the run is already dead/won (engine/engine.js's abandon case guards on `!next.dead && !next.won`) — mirrors the fail-safe posture of every other applyAction case rather than pushing a nonsensical second death event onto an already-ended run."
  - "SAVE & QUIT is NOT styled with .mw-danger-btn (only ABANDON THIS CHARACTER keeps that red/danger treatment) — per 04-CONTEXT.md's own decision that destructive actions get red styling and their own visual space separate from safe ones; SAVE & QUIT loses nothing, so it stays in the plain/safe button style."
  - "Map auto-centering is wired at exactly three call sites (initial boot paint, roll-commit, and floorChanged-detection inside the single engineMove choke point) rather than trying to intercept every conceivable state-set call — these three cover 100% of 'a run begins' and 'the floor changes' per the item's own wording, and window.mzCenterMap is idempotent/harmless to call an extra time."
  - "SPELLS' fix is scrollIntoView on the re-queried button (not a positioning/layout change to make the menu literally overlay under the button) — the list already sits directly under the button in DOM order; the actual bug was #enc-panel's own internal scroll position leaving it below the fold with several foes on screen, which scrollIntoView solves directly without touching the panel's flex/DOM layout at all."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1/04-DR2/04-DR3/04-DR4/04-DR5A-SUMMARY.md's own precedent.

duration: ~90min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR5B1: Device-review round 5, Pass B1 (title/exit flow + behavior) Summary

Applied the user's live device-review "Pass B1" to the Delve, Die, Repeat Android build: collapsed the title screen to a single context-aware ENTER (RESUME removed), relabeled and fixed the HERO tab's two exit actions (a non-destructive "Save & quit" and a genuinely destructive "Abandon this character" that now correctly buries the character in the graveyard instead of silently rerolling), auto-centers the map viewport on the party at run start and every floor change, and made the in-combat SPELLS button's list visibly reveal itself instead of rendering below the fold. Five atomic commits, each independently rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next commit landed.

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-09-08
- **Tasks:** 5 items (title ENTER-only; Save & quit relabel; Abandon this character + engine seam; map auto-centering; SPELLS list visibility) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 7 (`mazeworld.html`, `engine/actions.js`, `engine/engine.js`, `content/epitaphs.js`, `test/unit/engine-purity.test.js`, `test/unit/engineAdapter.test.js`, `test/unit/content-tables.test.js`)

## Accomplishments

### Item 1 — Title screen: one context-aware ENTER, RESUME removed (`80f7788`)
- Deleted the `#mw-title-resume` button entirely (HTML + its `.mw-title-resume*` CSS rules) — the title screen now renders exactly one button.
- Replaced the old "toggle a RESUME button's hidden/disabled state" logic with a `resumeIntent` boolean the trailing module script updates every time `showTitleScreen()` runs, and ENTER's `onclick` now branches on it: `hideTitleScreen()` then either return immediately (resume — boot() already silently rehydrated the live delve underneath) or call `window.mzStartRoll()` (open the roller for a fresh character).
- The very first screen's decision is seeded from `hadSaveAtLaunch` — a value computed by reading storage BEFORE `boot()` ran — rather than a live `hasActiveDelveSave()` check, because `boot()` always leaves `S.c` populated (even a brand-new run rolls a full character via `engine/state.js#newRun`), so checking only after `boot()` could never distinguish "a real save existed" from "boot() just rolled a throwaway fresh-run character." Every later re-show (quit, abandon, death) recomputes `resumeIntent` live, when `S` genuinely reflects real gameplay.

### Item 2 — "Abandon your run" relabeled "Save & quit" (`5f0a774`)
- HTML id renamed `btn-abandon-run` -> `btn-save-quit`, label "Abandon your run" -> "Save & quit", and dropped `.mw-danger-btn` styling (nothing is lost by this action, so it doesn't get the destructive red treatment — per 04-CONTEXT.md's own "destructive actions styled red, given their own space" decision).
- Behavior is otherwise unchanged: confirm, then `showTitleScreen({ allowResume: true })` — the run stays saved (persist() already runs after every dispatch), and the title's single ENTER (item 1) is what actually resumes it. Renamed the underlying function to `saveAndQuit` (still bridged as `window.mzAbandonRun` to minimize surface area) and updated the confirm copy to say "Enter will pick this delve back up" instead of the now-nonexistent "Resume."

### Item 3 — "Clear save" becomes destructive "Abandon this character" (`beedca7`)
- Added a new engine action type `abandon` (`engine/actions.js` ACTION_TYPES set, `engine/engine.js`'s `applyAction` switch) that calls `engine/death.js#die(next, "abandon", null, rng, events)` — the SAME terminator every other death (combat, starve, trap, fall, ...) already uses, guarded to no-op if the run is already dead/won.
- Added a distinct, sarcastic-but-family-friendly content bank for this cause: `EPITAPHS.abandon` (8 lines, e.g. *"Not slain by the maze. Simply left here, on floor {floor}, by someone who kept walking."*) and `CAUSE_TEXT.abandon` ("abandoned mid-delve by their own player") in `content/epitaphs.js`.
- Because `die()` pushes a `died` event and `engineAdapter.js`'s `dispatch()` already buries any `died` event into the graveyard unconditionally (the existing choke point every other death relies on), **zero new persistence code was needed** — the burial "just happens" once the engine action exists.
- "No active run" after abandoning is the SAME contract every other death already relies on: `hasActiveDelveSave()` checks `!S.dead`, so a dead run (from voluntary abandonment or any other cause) is never offered for resume — no separate save-clearing step was needed.
- HTML id renamed `btn-wipe` -> `btn-abandon-character`, label "Clear save" -> "Abandon this character", kept `.mw-danger-btn` styling (this action IS destructive). New `window.mzAbandonCharacter` module function: confirm with the character's name, `dispatch({ type: "abandon" })`, sync `S` via `window.__mzState.set()`, log the resulting narration, then `showTitleScreen()` (no `allowResume` override — `hasActiveDelveSave()` correctly resolves `false` since the run is now dead).
- **Bug fixed en route:** the old "Clear save" button was previously wired to remove the save key then call `newGame()` directly — meaning it silently REROLLED a new character immediately instead of doing anything resembling "clear the save and go to the title screen." The new implementation goes through the title screen as the plan specifies.

### Item 4 — Map auto-centers on run start and floor change (`0694134`)
- Factored the CENTRE chip's pan-reset into a shared `centerMap()` function and bridged it onto `window.mzCenterMap` (same pattern as `window.move`/`window.newGame`/`window.__mzState`) so the trailing module script can call it — `pan` is a `let` binding in the classic script, not an implicit `window.*` global like a `function` declaration would be, so an explicit bridge was required.
- Wired at three call sites: after the initial boot paint (covers both a rehydrated resume and a brand-new run), inside `commitRolledState()` (the roller's CTA commit path), inside `window.newGame`/`engineNewRun` (the direct new-run path), and inside `engineMove` whenever `dispatch()`'s returned `events` include a `floorChanged` event — `engine/movement.js#descend()` always pushes exactly one such event per genuine floor change, never for a gated/blocked attempt, so this is a reliable, false-positive-free trigger.

### Item 5 — SPELLS button scrolls its list into view (`47fe4a7`)
- The spell list (`.spellmenu`) already rendered directly under the SPELLS action (`#a-spell`) in DOM order — the actual bug was `#enc-panel`'s own internal `overflow-y:auto` scroll position leaving the button (and the list opened beneath it) below the visible fold once several foes were on screen, making the button look dead.
- `a-spell`'s `onclick` now re-queries the button after `renderEncounter()` rebuilds the DOM (the original closure-captured reference is detached post-render) and calls `scrollIntoView({ behavior: "smooth", block: "start" })` on it whenever the menu is being opened, bringing both the button and its freshly revealed list into view together.

## Task Commits

1. **Item 1 — Title screen ENTER-only, RESUME removed** — `80f7788` (fix)
2. **Item 2 — "Abandon your run" -> "Save & quit"** — `5f0a774` (fix)
3. **Item 3 — "Clear save" -> destructive "Abandon this character" + engine seam** — `beedca7` (feat)
4. **Item 4 — Map auto-centering on run start/floor change** — `0694134` (fix)
5. **Item 5 — SPELLS button scroll-into-view** — `47fe4a7` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next item's edits began.

## Files Created/Modified

- `mazeworld.html` — title screen HTML/CSS (RESUME removed); HERO tab button ids/labels/styling (`btn-save-quit`, `btn-abandon-character`); module-script `resumeIntent`/`showTitleScreen()`/`hasActiveDelveSave()`/`window.mzAbandonRun`/`window.mzAbandonCharacter`/`initTitleScreen()`; classic-script `centerMap()`/`window.mzCenterMap` bridge + its three call sites (boot, `commitRolledState`, `engineNewRun`) plus the `floorChanged`-triggered call inside `engineMove`; in-combat SPELLS button's `scrollIntoView` fix.
- `engine/actions.js` — `abandon` added to `ACTION_TYPES`.
- `engine/engine.js` — imports `die` from `./death.js`; new `case "abandon":` in `applyAction`'s switch, guarded on `!next.dead && !next.won`.
- `content/epitaphs.js` — new `EPITAPHS.abandon` (8 lines) and `CAUSE_TEXT.abandon`/`CAUSE_TEXT_TOKENS.abandon` entries.
- `test/unit/engine-purity.test.js` — 2 new tests: `applyAction({type:'abandon'})` kills the run with a distinct cause via the death seam; is a no-op on an already-dead/won run.
- `test/unit/engineAdapter.test.js` — 1 new test: `dispatch({type:'abandon'})` buries the current character with a distinct cause and leaves no active run.
- `test/unit/content-tables.test.js` — 1 new test: `EPITAPHS.abandon`/`CAUSE_TEXT.abandon` exist and are distinct from combat's.

## Decisions Made

See `key-decisions` in the frontmatter above (the 3-commit split for the coupled title/quit/abandon redesign, reusing `die()` verbatim rather than a parallel bury path, the abandon action's no-op guard on an already-ended run, SAVE & QUIT's non-danger styling, the three map-centering call sites, and the SPELLS fix being a pure scroll-position fix rather than a layout change).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — bug] The old "Clear save" button silently rerolled a new character instead of clearing anything**
- **Found during:** Item 3, while tracing the button's existing wiring per the plan's own note ("it currently wrongly rolls a new character").
- **Issue:** `btn-wipe`'s `onclick` removed `SAVE_KEY` then called `newGame()` directly, bypassing the title screen and roller entirely — a silent immediate reroll, not "clear the save."
- **Fix:** replaced with `window.mzAbandonCharacter`, which routes through the confirm -> engine `abandon` action -> graveyard burial -> title screen flow the plan specifies.
- **Files modified:** `mazeworld.html`
- **Commit:** `beedca7`

**2. [Rule 1 — bug] A stale doc comment referenced "Clear save (btn-wipe)" after item 3 renamed/rewired that button**
- **Found during:** Item 4, while touching the adjacent `window.newGame`/`engineNewRun` comment block.
- **Issue:** the comment above `window.newGame` still described the (already-removed) direct `btn-wipe` -> `newGame()` call path from item 3's predecessor state.
- **Fix:** updated the comment to describe the current fallback-only relationship (`window.mzAbandonRun`/`window.mzAbandonCharacter` calling `newGame()` only if their own module functions failed to load).
- **Files modified:** `mazeworld.html`
- **Commit:** `0694134`

None of the other work required a checkpoint or user decision — all five items were independently verifiable (build + full test suite) and matched the plan's explicit instructions directly.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI) work plus one small, well-precedented engine seam addition (a new action type reusing the existing `die()`/`bury()`/graveyard-persistence machinery verbatim) — no new network endpoints, auth paths, or schema changes at a trust boundary. No `GameState.rngState` mutation from presentation code: the abandon action's RNG draw (`epitaphFor`'s `rng.pick`) happens entirely inside `applyAction()`'s existing rehydrate-dispatch-persist cycle, identical to every other action type.

## Verification

- `npm run build:www` — succeeds at all five commit checkpoints; `www/index.html` reflects each item's changes (`www/` is gitignored, so no stray build artifacts were committed).
- `npm test` — **458 -> 462/462 green** (458 baseline from 04-DR5A + 4 new tests: 2 in `engine-purity.test.js`, 1 in `engineAdapter.test.js`, 1 in `content-tables.test.js`), green at every checkpoint.
- `npm run test:quick` — **369 -> 373/373 green** at the final checkpoint (`engine/`, `content/`, `test/unit/` are all in `test:quick`'s covered set; `mazeworld.html`-only commits — items 1/2/4/5 — left the count at 369 until item 3 added the 4 new tests).
- Self-check: all 5 commit hashes (`80f7788`, `5f0a774`, `beedca7`, `0694134`, `47fe4a7`) present in `git log`; `mazeworld.html` contains exactly one `mw-title-btn` button element inside `#mw-title-screen` (`mw-title-enter`, no `mw-title-resume`), `id="btn-save-quit"`, `id="btn-abandon-character"`, `window.mzAbandonCharacter`, `window.mzCenterMap`, and the `floorChanged`-triggered `window.mzCenterMap?.()` call inside `engineMove`; `engine/actions.js` contains `"abandon"` in `ACTION_TYPES`; `engine/engine.js` contains `case "abandon":`; `content/epitaphs.js` contains `EPITAPHS.abandon`/`CAUSE_TEXT.abandon`.
- No headless-DOM/visual harness exists in this project (consistent with prior `04-DR*-SUMMARY.md` notes) — the on-device "feel" of the single-ENTER title flow, the two HERO tab actions' actual button placement/spacing, the map's real recentered framing after a descent, and the SPELLS list's actual scroll behavior are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — single `.mw-title-btn` (`mw-title-enter`) inside `#mw-title-screen`, no `mw-title-resume` anywhere; `id="btn-save-quit"`; `id="btn-abandon-character"`; `window.mzAbandonRun = function saveAndQuit()`; `window.mzAbandonCharacter = function abandonCharacter()`; `window.mzCenterMap = centerMap`; `if (events.some((e) => e.type === "floorChanged")) window.mzCenterMap?.();`; `scrollIntoView({ behavior: "smooth", block: "start" })` in the `a-spell` handler.
- FOUND: `engine/actions.js` — `"abandon"` in `ACTION_TYPES`.
- FOUND: `engine/engine.js` — `import { die } from "./death.js";` and `case "abandon":`.
- FOUND: `content/epitaphs.js` — `EPITAPHS.abandon` (8-entry array), `CAUSE_TEXT.abandon`, `CAUSE_TEXT_TOKENS.abandon`.
- FOUND: `test/unit/engine-purity.test.js` — 2 new `"abandon"`-titled tests.
- FOUND: `test/unit/engineAdapter.test.js` — 1 new `"Device-review Pass B1 item 3"`-titled test.
- FOUND: `test/unit/content-tables.test.js` — 1 new `EPITAPHS.abandon`/`CAUSE_TEXT.abandon` test.
- FOUND commit `80f7788` (fix(04-dr5b1): title screen has ONE context-aware ENTER, RESUME removed)
- FOUND commit `5f0a774` (fix(04-dr5b1): relabel Abandon your run to Save & quit)
- FOUND commit `beedca7` (feat(04-dr5b1): Clear save becomes destructive Abandon this character)
- FOUND commit `0694134` (fix(04-dr5b1): auto-center map viewport on run start and floor change)
- FOUND commit `47fe4a7` (fix(04-dr5b1): SPELLS button scrolls its list into view on open)
- FOUND: `npm test` 462/462 and `npm run test:quick` 373/373 at final state

## Next Phase Readiness

- All five Pass B1 items are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next.
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
