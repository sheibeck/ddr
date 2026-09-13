---
phase: 04-mobile-presentation-controls-onboarding
plan: DR3 (device-review revision round 3, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [character-roll, slot-machine, new-run, title-screen, abandon-run, permadeath, engine-adapter]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR2: #mw-title-screen (ENTER/RESUME), window.newGame (engineNewRun), death/won cards (#btn-again), src/browser/viewModels.js#characterSheetViewModel"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-05: dark torch-lit theme tokens (--paper/--ink/--ditto/--mw-danger-*), GAME_NAME constant"
provides:
  - "#mw-roller-screen — the mock's isRolling / \"THE TABLES DECIDE\" screen: 3 reels (RACE/CLASS/SUBCLASS) that flicker then lock gold in sequence, a name+quirk reveal, and a primary CTA that activates once the (real) roll is revealed"
  - "window.mzStartRoll() — opens the roll screen, calls startNewRun() exactly once for the real engine roll, and reveals it via a presentation-only reel flicker (Math.random() over content/index.js's RACES/CLASSES tables) that never reads/touches GameState.rngState"
  - "window.mzAbandonRun() — confirm, then return to the title screen WITHOUT rolling (the abandoned run's save is untouched; RESUME picks it back up)"
  - "#btn-abandon-run (HERO tab) — replaces the old immediate-reroll 'Roll new character' button with 'Abandon your run' (mw-danger-btn chrome matching the mock's CUT LOSSES treatment)"
  - "Title ENTER, the death card's 'Roll the next victim', and the won card's reroll all now route through window.mzStartRoll() instead of calling startNewRun()/newGame() directly"
affects: [04-07, 04-08, 04-09, 04-10, 04-11]

tech-stack:
  added: []
  patterns:
    - "commitRolledState(state) factors the 'apply an already-rolled state to the live UI' steps (window.__mzState.set/logLine/paint/draw) out of engineNewRun() so window.mzStartRoll's CTA can commit the exact state it already revealed without calling startNewRun() a second time"
    - "The roller's reel flicker draws its candidate strings from content/index.js's real RACES/CLASSES tables (Object.keys(RACES), Object.keys(CLASSES), and CLASSES[*].subs) via a LOCAL Math.random() — never the engine's seeded rng — while the actual locked/revealed values come from characterSheetViewModel(rolledState), the same rng-free view-model src/browser/viewModels.js already exposes for the HERO tab"
    - "window.mzStartRoll/window.mzAbandonRun follow the existing window.move/window.newGame bridge pattern (defined in the trailing module script, called from the classic non-module script via a bare window.* reference resolved at click time), with a `|| newGame()` fallback on the classic-script call sites in case the module somehow failed to load"

key-files:
  created:
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR3-SUMMARY.md
  modified:
    - mazeworld.html

key-decisions:
  - "The roller screen matches the mock's 3-reel structure (RACE/CLASS/SUBCLASS + a separate name+quirk reveal) exactly, not the plan prompt's looser 'race/class/subclass/name/key stats' description — design/Mazeworld Mobile.dc.html is the authoritative source per 04-CONTEXT.md's governing principle, and its isRolling block only ever shows those 3 reels plus the reveal."
  - "The one real engine roll happens at the START of window.mzStartRoll() (via startNewRun()), not at CTA-tap time — the reveal needs the true rolled name/quirk to display once the reels lock, so the roll itself must already be known by then. The rolled state is held in a closure (rollerPendingState) and NOT applied to window.__mzState/paint()/draw() until the CTA is tapped, so the live map/HUD/log never change behind the animation."
  - "The reel-flicker candidate lists reuse content/index.js's real RACES/CLASSES/subs tables (not invented placeholder strings) so the flicker reads as genuine dungeon-crawl vocabulary, matching the mock's own RACES/CLASSES/SUBS constant lists in spirit without duplicating a second copy of that data."
  - "'Abandon your run' does not call startNewRun() at all — it only shows the title screen (with RESUME forced visible). This matches the user's explicit correction that rolling a new character only ever happens FROM the title screen via ENTER, never as a side effect of abandoning. The abandoned run's save is left completely untouched, so RESUME on the reshown title screen picks it back up exactly as left."
  - "The won-path reroll button (previously calling newGame() directly, not explicitly named in the plan's scope) was also rerouted through window.mzStartRoll() for consistency with the death card's identical 'roll again' action, rather than leaving one reroll button skip the roll-screen reveal that every other reroll entry point now gets. Documented here as a deliberate, low-risk consistency extension (Rule 2 discretion) rather than scope creep — it reuses the exact same window.mzStartRoll() call the death card uses."
  - "Two atomic commits, per the plan's explicit instruction: the roller screen (screen CSS/HTML/JS, self-contained and independently buildable/testable, not yet reachable by any button) landed first, then the flow-wiring commit (ENTER/abandon/death/won button changes) that makes it reachable. Both intermediate states were independently rebuilt (npm run build:www) and fully tested (451/451 + 362/362) before committing, using git add -p to split the single mazeworld.html diff along exact hunk boundaries."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1-SUMMARY.md/04-DR2-SUMMARY.md's own precedent.

duration: ~75min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR3: Character-roll screen + new-run flow wiring Summary

Built the mock's slot-machine "THE TABLES DECIDE" character-roll screen (3 reels that flicker then settle on the real engine-rolled race/class/subclass, a name+quirk reveal, and an "ENTER THE MAZE" CTA) and rewired every new-run entry point — title ENTER, the death card's "Roll the next victim", the won card's reroll, and a new "Abandon your run" action — to go through it, per the user's live direction that a new character is only ever rolled from the title screen. Two atomic commits (roller screen, then flow wiring); 451/451 + 362/362 tests green throughout, `npm run build:www` clean.

## Performance

- **Duration:** ~75 min
- **Completed:** 2026-09-08
- **Tasks:** 2 (roller screen; flow wiring) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 1 (`mazeworld.html`)

## Accomplishments

- **`#mw-roller-screen`** — a full-screen, dark torch-lit gate matching `design/Mazeworld Mobile.dc.html`'s `isRolling` block pixel-for-structure: heading "THE TABLES DECIDE", subhead, 3 reels (RACE/CLASS/SUBCLASS) that flicker (`mwflick` keyframe, muted `--ink-soft`) then lock gold (`--ditto`) in sequence at 900/1650/2400ms, a name+quirk reveal that fades in (`mwfade`) at 3050ms, and a CTA that reads "THE DICE ARE STILL FALLING" (disabled) until the reveal completes, then "ENTER THE MAZE" (primary/gold, matching the mock's `roller.primaryStyle`).
- **Determinism preserved.** `window.mzStartRoll()` calls the engine adapter's `startNewRun()` exactly once, up front — the SAME seam every prior new-run entry point (title ENTER, "Roll another delver") already used. The reel-flicker animation is pure `Math.random()` over static `content/index.js` word lists (`RACES`, `CLASSES`, `CLASSES[*].subs`) and never reads or mutates `GameState.rngState`; the reels' locked/revealed values come from `characterSheetViewModel(rolledState)` — the same rng-free, DOM-free view-model `src/browser/viewModels.js` already exposes for the HERO tab. The rolled state itself is held in a closure and only applied to the live app (`window.__mzState.set`/`paint`/`draw`) when the player taps the CTA.
- **Flow wiring, per the user's explicit correction of the initial device-review order:**
  - Title **ENTER** → dismisses the title screen → opens the roller → CTA → **MAP** tab (`window.__mzShowTab("maze")`).
  - Title **RESUME** → unchanged (dismisses straight into the already-rehydrated run, no roller).
  - HERO tab's old immediate-reroll **"Roll new character"** is now **"Abandon your run"** (`#btn-abandon-run`, `mw-danger-btn` destructive chrome matching the mock's CUT LOSSES treatment) — confirms via `window.confirm()`, then returns to the **title screen** (RESUME forced visible) WITHOUT rolling. No `startNewRun()` call at all; the abandoned run's save is untouched.
  - Death card's **"Roll the next victim"** (relabeled from "Roll another delver" to match the mock's death-card CTA copy) and the won card's reroll both now open the roller instead of calling `newGame()`/`startNewRun()` directly.
- All four entry points share one roller implementation and one commit path (`commitRolledState`), so the reveal, timing, and MAP-landing behavior are identical regardless of which button opened it.

## Task Commits

1. **Roller screen (self-contained, not yet wired to any button)** — `446cdd6` (feat)
2. **Flow wiring (ENTER/abandon/death/won → the roller)** — `7b91078` (feat)

Both commits were independently rebuilt (`npm run build:www`) and fully tested (`npm test` 451/451, `npm run test:quick` 362/362) at their own checkpoint before the next commit landed, using `git add -p` to split the combined `mazeworld.html` diff along exact hunk boundaries (verified via `git diff --cached`/`git diff` hunk headers matching the intended split) rather than committing the whole file at once.

## Files Created/Modified

- `mazeworld.html` — added `#mw-roller-screen` (CSS + HTML + `window.mzStartRoll`/`commitRolledState`/`initRollerScreen`), added `#btn-abandon-run` + `window.mzAbandonRun`/`showTitleScreen`/`hideTitleScreen`, rewired title ENTER / death card / won card, added two new module imports (`characterSheetViewModel` from `src/browser/viewModels.js`, `RACES`/`CLASSES` from `content/index.js`).

## Decisions Made

See `key-decisions` in the frontmatter above (roller-vs-plan-prompt reel scope, roll-timing/closure design, content-table reuse for flicker, abandon-does-not-roll, won-path consistency extension, two-commit split methodology).

## Deviations from Plan

### Auto-fixed / discretionary issues

**1. [Rule 2 — discretionary consistency, not required by scope] Won-path reroll also routed through the roller**
- **Found during:** wiring the death card's "Roll the next victim".
- **Issue:** the objective only named the permadeath death card and the title/abandon flows; the "Through the Gate" (won) card's own reroll button was not explicitly in scope, but it called the exact same `newGame()`/`startNewRun()` seam the death card used to call, and leaving it untouched would mean one reroll button skips the new slot-machine reveal while an otherwise-identical one gets it.
- **Fix:** rerouted the won card's button through `window.mzStartRoll()` too (same call the death card now uses), with the same `|| newGame()` fallback pattern.
- **Files modified:** `mazeworld.html`
- **Commit:** `7b91078`

**2. [Documented scope-limit] No back-button/native-chrome wiring for the roller/title full-screen gates**
- The Android hardware back button's `getGameContext()`/`decideBackAction()` wiring (`src/browser/nativeChrome.js`) was deliberately left untouched — it is a separately unit-tested surface (`decideBackAction` has its own test suite), and neither the roller screen nor the reshown title screen currently register themselves as an "open modal" for back-press purposes. In practice this means a back press while the roller is spinning or the title is reshown (post-abandon) falls through to whatever `hasOpenModal`/`hasLiveRun` already evaluate to from the underlying `S` state, unchanged from pre-DR3 behavior — no regression, but also no new protection specific to these two full-screen gates. Left for a future pass rather than risking an untested change to a safety-critical, already-covered code path within this plan's scope.

None of these required a checkpoint or user decision — both are documented, low-risk scope calls consistent with Rule 2 discretion and the "Claude's Discretion" latitude already granted in 04-CONTEXT.md.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI wiring) work reusing existing engine seams (`startNewRun()`, `window.__mzState`, `window.__mzShowTab`, `characterSheetViewModel`) — no new network endpoints, auth paths, or schema changes. The one new client-side confirm surface (`window.confirm()` for "Abandon your run") is a synchronous browser-native dialog, not a new attack surface.

## Verification

- `npm run build:www` — succeeds at both commit checkpoints (roller-screen-only state, then the full flow-wired state); `www/index.html` contains the new `#mw-roller-screen` markup and `window.mzStartRoll`/`window.mzAbandonRun` wiring at both.
- `node --check` on both the classic and trailing module `<script>` blocks — syntactically valid at both commit checkpoints.
- `npm test` — **451/451 green** at both commit checkpoints.
- `npm run test:quick` — **362/362 green** at both commit checkpoints.
- No headless-DOM/visual harness exists in this project (consistent with prior 04-* plans' own verification notes) — the on-device "feel" of the reel timing/flicker/reveal animation is unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next, along with a manual pass through all four entry points (ENTER, Abandon → ENTER, death → roll next, win → roll next).

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `#mw-roller-screen`, `window.mzStartRoll`, `window.mzAbandonRun`, `#btn-abandon-run`, `commitRolledState`, `characterSheetViewModel` import, `RACES`/`CLASSES` import
- FOUND commit `446cdd6` (feat(04-dr3): add "THE TABLES DECIDE" character-roll screen)
- FOUND commit `7b91078` (feat(04-dr3): wire ENTER, abandon, and death/won rerolls through the roller)
- FOUND: `www/index.html` (post-build) contains `mw-roller-screen`/`mzStartRoll`/`mzAbandonRun`/`btn-abandon-run`

## Next Phase Readiness

- The character-roll screen and its 4 entry points are complete and test-green; ready for on-device UAT alongside the rest of Phase 4's deferred visual "feel" verification.
- No blockers. The back-button/native-chrome gap noted above (Deviation 2) is a candidate for a future device-review round if the user notices it on-device, but does not block this plan's own success criteria.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
