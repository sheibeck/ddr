# Phase 50: Character Roller Fix - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — 3 areas / 12 questions, all recommended answers accepted

<domain>
## Phase Boundary

The character the roller screen reveals (race / class / sub-class reels, name, quirk) is exactly the character that lands on the Hero tab — no second roll on the path, no stale `rollerPendingState` from a superseded roll, no label drift. Shell-only: `mazeworld.html` (the roller mount), a new `src/browser/roller.js`, tests. `engine/`, `content/`, every parity fixture and the master hash are untouched; no bot readout (ROLL-01 changes no rule).

Source: ROADMAP Phase 50 (ROLL-01) and `.planning/todos/pending/2026-09-20-roller-reels-do-not-match-the-hero-tab-character.md`.

</domain>

<decisions>
## Implementation Decisions

### Root cause & repro strategy
- Fix structurally AND run the repro pass. Two real weaknesses were found by code read (see code context): un-guarded re-entry of `mzStartRoll`, and the reels locking on a captured `sheet` while the CTA commits `rollerPendingState`. The on-device trigger is not known, so the guards do not wait on a reproduction.
- The SC3 repro pass runs in the browser dev loop now (a static server + Chrome, dev Settings row available); the Pixel 7 pass rides Phase 55's batched device session per the deferred-UAT protocol — no mid-run device pause.
- If no mismatch reproduces in the browser, the guards + tests still land; the SUMMARY records "not reproduced in browser; structurally guarded; device check in the Phase 55 batch".
- No extra instrumentation (no permanent console trace, no dev Oracle line) — the Hero tab is the check.

### Fix shape
- Re-entry guard: a monotonic roll token captured before `await startNewRun()`; a resolution carrying a stale token is dropped (touches neither the reels nor `rollerPendingState`). The `startNewRun()` calls are serialized through a promise chain so the LAST roll is also the adapter's `currentState` (the persisted save) — not just the reels.
- Reels and CTA read the same object: `rollerPendingState` is assigned right after the token-validated await; every lock step derives its label from `characterSheetViewModel(rollerPendingState)`; the CTA stays disabled until the full reveal and commits that same object.
- The logic is extracted to `src/browser/roller.js` in the Phase 47 module pattern (`gearTab.js` / `heroTab.js` / `storeScreen.js`): a `createRoller({ doc, startNewRun, sheetFor, timers, onCommit, ... })` factory with injected deferred promises + injectable timers so the race is unit-testable; `mazeworld.html` becomes a mount that wires the DOM ids and `window.mzStartRoll`.
- Test set: (a) `test/unit/roller.test.js` — two rolls where the FIRST resolves AFTER the second → only the second's labels reach the reels/pending state, and the committed state's `characterSheetViewModel` labels equal the locked reel labels; (b) a source-pin that the mount contains no second `startNewRun` call and commits `rollerPendingState`; (c) engine/fixture-untouched evidence = the existing parity suite and master hash unchanged.

### Behaviour edges & scope
- A double-tap on a roll trigger (title ENTER, the dead Hero tab's "New Character") SUPERSEDES: the reels restart and lock on the second roll; only the second state can ever reach the Hero tab (SC2 wording).
- The save written at roll time (`startNewRun` → `persist()` before DESCEND) stays as is — out of scope; an app kill mid-reveal resumes into the rolled character, which is the correct character. Noted under Deferred Ideas.
- `recordBest` on a superseded roll stays as is — with the serialized chain a superseded roll records the previous run's depth at most once more, and `Math.max` makes the repeat harmless.
- Repro-pass record: a three-row table in the SUMMARY (normal / double-tap / Play-again-from-death → reels shown, Hero tab shown, match?), plus a `human_verification` entry for the Phase 55 device batch.

### Claude's Discretion
- Exact `createRoller` option names, the timer-injection shape (a `timers` object vs individual functions), and whether the reel word lists stay in the mount or move into the module (they are cosmetic content tables from `content/index.js`).
- Whether the serialized chain lives in `roller.js` (preferred — it is the only caller) or as a tiny adapter helper.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/engineAdapter.js#startNewRun(seed, options)` (L329) — the ONE new-run seam: `recordBest` → `readRecentNames` → `initRun` (sets module `currentState`) → `persist()`; returns the state. Only callers on master: the roller (`mazeworld.html:5224`) and the dev start-at-depth row (`:5103`). `window.newGame`/`engineNewRun` no longer exist (Phase 44).
- `src/browser/heroTab.js#characterSheetViewModel(state)` (L165) — rng-free, DOM-free; `classLabel: c.cls`, `raceLabel: c.race`, `subLabel: c.sub`, `name: c.name`, `quirk: { label, text: quirkText(c) }`. The Hero tab (`renderHeroTab`, L596) reads `c.race / c.sub / c.cls / c.name` directly — there is NO label drift between the two.
- `test/unit/harness/recordingDom.js` — the fake `document` used by `gearTab.test.js` / `heroTab.test.js` / `storeScreen.test.js`; `getElementById` auto-creates elements, so a roller module can be driven without an HTML parser.
- Source-pin conventions: `test/unit/heroTab.test.js` (module exports / no-globals / mount pins on `mazeworld.html`), `tools/ident-sweep.mjs#stripJs` for comment stripping.
- `window.__mzTabs` registry (`mazeworld.html:4461`) and `docs/SHELL-MODULES.md` — where a new browser module is listed.

### Established Patterns
- Roller today (`mazeworld.html:5155-5267`): `ROLLER_*` word lists (cosmetic, `Math.random()` only — never the engine rng), `ROLLER_LOCK_DELAYS {race:900, cls:1650, sub:2400}`, `ROLLER_REVEAL_DELAY 3050`, `ROLLER_SPIN_MS 70`; `clearRollerTimers()`; `window.mzStartRoll` clears timers, nulls `rollerPendingState`, resets the screen, `await startNewRun()`, captures `sheet`, starts the flicker interval, pushes three lock timers + one reveal timer that sets `rollerPendingState = rolledState` and enables the CTA ("DESCEND"); `initRollerScreen()`'s CTA `onclick` commits `rollerPendingState` through `commitRolledState(state)` (L5136: `__mzState.set`, clears `#log`, banner line, `paint()`, `draw()`, `mzCenterMap`, `surfaceAbilityPool`) then `__mzShowTab("maze")`.
- Entry points into `mzStartRoll`: title ENTER (`:5605`, only when `resumeIntent` is false), the Hero tab's `#btn-abandon-character` while `state.dead` ("New Character", `:3844`). Death CONFIRM → `mzReturnToTitle` → title; `mzAbandonCharacter` → engine "abandon" → title.
- Module mounts take `(host|doc, state, deps)` and never touch `window`/`document` globals (Phase 47 rule, pinned by the module test suites).
- Hardware back on the roller: `getGameContext` (`:5645`) does not know the roller; it resolves to confirm-quit/exit — it never re-rolls.

### Integration Points
- `mazeworld.html` module script: replace the inline roller block with the `roller.js` mount; keep `window.mzStartRoll` as the bridge name (both call sites + the bridge registry test `test/unit/bridge-registry.test.js` may pin it) and keep `commitRolledState` as the commit callback.
- `docs/SHELL-MODULES.md` — add the roller module row.
- `test/unit/` — new `roller.test.js`; update any source-pin that counts module imports / `window.mz*` bridges if it enumerates them.

</code_context>

<specifics>
## Specific Ideas

- The two weaknesses to close, verbatim from the scout: (1) overlapping `mzStartRoll` calls each push their own lock/reveal timers — `clearRollerTimers()` runs BEFORE the second call's await, so the first call's timers (pushed after its await resolves) survive and both sets fire; (2) the reels lock on `sheet` captured from a captured `rolledState` while the CTA commits `rollerPendingState` — identical today only by construction.
- SC1 wording is the contract: "the reel lock and the CTA commit read the same object (`rollerPendingState`), not a captured `sheet`".
- SC2 test shape: fire two rolls, resolve the first AFTER the second, assert only the second's state ever reaches the Hero tab (the commit callback receives the second state; the reels show the second labels).

</specifics>

<deferred>
## Deferred Ideas

- `startNewRun()` persists the rolled save before the CTA — an app kill mid-reveal resumes straight into the rolled character (correct character, skipped reveal). Left as is; a "persist on commit" change would touch the adapter's save timing and is not this bug.
- `recordBest` on a superseded roll (harmless repeat under `Math.max`).
- `getGameContext`'s back-button handling has no roller awareness (confirm-quit/exit while the reels spin) — UX, not this bug.

</deferred>
