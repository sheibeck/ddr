---
phase: 02-android-packaging-native-persistence
plan: 03
subsystem: persistence
tags: [async-storage, dual-write-convergence, capacitor-app, back-button, lifecycle-flush, node-test, tdd]

# Dependency graph
requires:
  - phase: 02-android-packaging-native-persistence
    provides: "02-01: src/browser/storage.js (window.mzStorage getItem/setItem/removeItem/flush/migrateLegacyKeys) and test/persistence/harness/fakePreferences.js"
provides:
  - "engineAdapter.js and mazeworld.html's classic script converged onto the single window.mzStorage abstraction for SAVE_KEY/BEST_KEY/GRAVE_KEY — dual-write hazard closed"
  - "src/browser/nativeChrome.js: pure decideBackAction (PLT-02, never a silent run-end), awaited flushOnBackground (PLT-03/SAV-01), and injectable registerNativeChrome wiring backButton/pause/appStateChange via @capacitor/app (dynamic import only)"
  - "test/persistence/{dual-write-convergence,lifecycle,back-button-logic}.test.js and test/persistence/harness/sandboxClassicPersistence.js (verbatim classic-script extraction harness)"
affects: [02-04-native-chrome-assets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mazeworld.html's classic <script> boot sequence deferred into window.__mzClassicBoot (async), invoked by the trailing module only after window.mzStorage is assigned + migrated — mirrors the existing window.__mzState/move/newGame bridge pattern, closing the parse-order half of the dual-write hazard"
    - "A captured `const classicNewGame = newGame;` reference (taken at classic-script parse time, before the trailing module can overwrite the bare `newGame` global) so window.__mzClassicBoot's no-saved-run fallback always initializes the classic script's own `S` state correctly regardless of module wiring order"
    - "engineAdapter persist()/persistGrave() are fire-and-enqueue (not awaited from dispatch()) — storage.js's per-key write queue still orders/never-drops them (SAV-01); boot()/getBest()/startNewRun() are awaited (read-then-write correctness)"
    - "test harness extracts mazeworld.html's OWN save/load/saveGraves/loadGraves source verbatim via sentinel-comment markers (@gsd:dual-write-convergence-extract:*) and runs it in node:vm, proving the real function bodies converge on window.mzStorage rather than testing a reimplementation"
    - "src/browser/nativeChrome.js: every @capacitor/* plugin is directly injectable (App/SplashScreen/StatusBar/ScreenOrientation params) for testing; when omitted, reached via a dynamic import() only inside registerNativeChrome, mirroring storage.js's own zero-runtime-dep posture"

key-files:
  created:
    - src/browser/nativeChrome.js
    - test/persistence/dual-write-convergence.test.js
    - test/persistence/lifecycle.test.js
    - test/persistence/back-button-logic.test.js
    - test/persistence/harness/sandboxClassicPersistence.js
  modified:
    - src/browser/engineAdapter.js
    - mazeworld.html
    - test/unit/engineAdapter.test.js
    - test/unit/new-run-loop.test.js

key-decisions:
  - "engineAdapter.js's boot()/getBest()/startNewRun() are now async (storage.js-routed); dispatch() stays synchronous for the render path, with persist()/persistGrave() enqueued (not awaited) — matches 02-RESEARCH.md's async-safe-autosave recommendation exactly."
  - "boot() runs storage.migrateLegacyKeys() as its own first step (idempotent); the trailing module in mazeworld.html ALSO explicitly awaits migration before invoking window.__mzClassicBoot(), since the classic script's S-state boot never calls engineAdapter's boot() at all."
  - "Captured a `classicNewGame` reference at classic-script parse time so window.__mzClassicBoot's fallback path is immune to the trailing module's window.newGame override — without this, a first-ever boot with no saved run would leave the classic script's `S` state null (Rule 1 bug caught during implementation, not present in the plan's illustrative snippet)."
  - "decideBackAction's `alreadyConfirming` state is tracked internally inside registerNativeChrome (a `confirming` flag with a 2s auto-reset timer), not requested from the caller's getGameContext() — keeps the pure decision function trivially testable while the stateful confirm-window lives in the one place that actually needs it."
  - "test/unit/new-run-loop.test.js (a pre-existing 03-03 test file, not in this plan's declared file list) needed the same async-await update as test/unit/engineAdapter.test.js to stay green after startNewRun()/getBest() became async — tracked as a Rule 1 auto-fix below."

requirements-completed: [SAV-01, SAV-02, SAV-04, SAV-05, PLT-02, PLT-03]

coverage:
  - id: D1
    description: "engineAdapter and mazeworld.html's classic script both read/write the run save, best depth, and graveyard through the single window.mzStorage abstraction — no two backends racing on the same key"
    requirement: "SAV-01"
    verification:
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#engineAdapter and a direct storage.getItem() read see the IDENTICAL value — proving one shared backend, not two"
        status: pass
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#dual-write convergence: engineAdapter's write and the classic script's write land in the SAME backend/key — no two independent stores"
        status: pass
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#regression guard: engineAdapter.js contains no raw localStorage.*Item calls (comments excluded) — everything routes through storage.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "boot() resumes a saved run through the abstraction (async), running migrateLegacyKeys once before the load; the save read back through the abstraction rehydrates to an equal GameState"
    requirement: "SAV-02"
    verification:
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#engineAdapter's boot()/dispatch() persist the run save through the storage abstraction, and it reads back an equal GameState (SAV-02)"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#boot(freshSeed) rehydrates a valid existing save instead of starting fresh"
        status: pass
    human_judgment: false
  - id: D3
    description: "mazeworld.html's OWN save()/load()/saveGraves()/loadGraves() (extracted verbatim, not reimplemented) route through window.mzStorage, and best-depth/graveyard round-trip the same way as the run save"
    requirement: "SAV-04, SAV-05"
    verification:
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#mazeworld.html's OWN extracted save()/load() functions (not a reimplementation) read/write through window.mzStorage"
        status: pass
      - kind: unit
        ref: "test/persistence/dual-write-convergence.test.js#the classic script's OWN extracted loadGraves()/saveGraves() also route through window.mzStorage under mazeworld.graveyard.v1"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#startNewRun(seed) keeps the higher of two recorded bests"
        status: pass
    human_judgment: false
  - id: D4
    description: "the back-button decision function returns close-modal/navigate-back/confirm-quit/exit-app and NEVER returns a silent run-end for a live, unconfirmed run"
    requirement: "PLT-02"
    verification:
      - kind: unit
        ref: "test/persistence/back-button-logic.test.js#PLT-02: NO input combination with a live, unconfirmed run at root silently ends it — never exit-app"
        status: pass
      - kind: unit
        ref: "test/persistence/back-button-logic.test.js#returns exit-app only once alreadyConfirming is true (the confirm step already happened)"
        status: pass
      - kind: unit
        ref: "test/persistence/back-button-logic.test.js#decideBackAction is pure: identical input always yields identical output and is never mutated"
        status: pass
    human_judgment: false
  - id: D5
    description: "the pause/appStateChange handler awaits a storage flush before returning, so the last write completes before the OS can suspend the process"
    requirement: "PLT-03, SAV-01"
    verification:
      - kind: unit
        ref: "test/persistence/lifecycle.test.js#flushOnBackground(storage) awaits storage.flush() and resolves only AFTER it settles"
        status: pass
      - kind: unit
        ref: "test/persistence/lifecycle.test.js#registerNativeChrome wires an appStateChange listener that AWAITS a flush before resolving when the app goes inactive"
        status: pass
      - kind: unit
        ref: "test/persistence/lifecycle.test.js#registerNativeChrome also wires a pause listener that awaits the same flush before resolving (PLT-03)"
        status: pass
    human_judgment: false
  - id: D6
    description: "autosave routes through the abstraction after every action/beat, ordered and never dropped, including graveyard writes on death"
    requirement: "SAV-01"
    verification:
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#dispatch(action) advances state via applyAction and persists it (through the storage abstraction)"
        status: pass
      - kind: unit
        ref: "test/unit/engineAdapter.test.js#CR-01: repeated deaths accumulate multiple graveyard entries (unshift order, newest first)"
        status: pass
    human_judgment: false
  - id: D7
    description: "no @capacitor/* specifier is statically imported or resolvable under node --test / the browser dev loop (nativeChrome.js and the mazeworld.html trailing module)"
    verification:
      - kind: other
        ref: "grep -nE \"^\\s*import .*@capacitor/(app|splash-screen|status-bar|screen-orientation)\" src/browser/nativeChrome.js (0 matches)"
        status: pass
      - kind: unit
        ref: "node --test (full suite, 363 tests: 358 prior + 22 new/updated across dual-write-convergence.test.js, lifecycle.test.js, back-button-logic.test.js)"
        status: pass
    human_judgment: false
  - id: D8
    description: "on-device visual/feel proof: back button confirms before quit, app resumes exactly after background/force-stop mid-run"
    verification: []
    human_judgment: true
    rationale: "Native-bridge runtime behavior (real @capacitor/app events, real OS backgrounding) cannot be exercised headlessly under node --test; explicitly deferred to end-of-milestone device UAT per 02-VALIDATION.md's three-tier verification architecture — the interface-level decision/flush logic driving that behavior is unit-proven above."

duration: 22min
completed: 2026-09-08
status: complete
---

# Phase 02 Plan 03: Dual-Write Convergence, Async Autosave, Back Button + Lifecycle Flush Summary

**engineAdapter.js and mazeworld.html's classic script converge onto the single async `window.mzStorage` abstraction (closing the Phase-1 dual-write hazard), autosave is now fire-and-enqueue through storage.js's per-key write queue, and `src/browser/nativeChrome.js` adds a pure back-button decision function (never a silent run-end) plus an awaited pause/appStateChange flush handler — all `@capacitor/app` access reached only via a guarded dynamic import.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-09-08T15:32:00Z (approx.)
- **Completed:** 2026-09-08T15:54:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- Closed 02-RESEARCH.md's dual-write hazard: `engineAdapter.js`'s `boot()`/`getBest()`/`startNewRun()` are now async and import `src/browser/storage.js` directly for all three keys (SAVE_KEY/BEST_KEY/GRAVE_KEY); `mazeworld.html`'s classic `save()`/`load()`/`saveGraves()`/`loadGraves()` now call `window.mzStorage` instead of raw `localStorage`. Zero raw `localStorage.*Item` calls remain in `engineAdapter.js` (grep-verified, comments included).
- Restructured `mazeworld.html`'s classic boot sequence — previously running synchronously at parse time, before `window.mzStorage` existed — into `window.__mzClassicBoot` (async), invoked by the trailing module only after storage is assigned and migrated, mirroring the project's existing `window.__mzState`/`window.move`/`window.newGame` bridge pattern.
- Built `test/persistence/harness/sandboxClassicPersistence.js`: a `node:vm` harness that extracts `mazeworld.html`'s OWN `save()`/`load()`/`saveGraves()`/`loadGraves()` source verbatim (via sentinel-comment markers) and proves the real function bodies — not a reimplementation — converge on `window.mzStorage`.
- Built `src/browser/nativeChrome.js`: a pure `decideBackAction(...)` proven to never return a silent run-end for a live, unconfirmed run (PLT-02); an awaited `flushOnBackground(storage)` (PLT-03/SAV-01); and an injectable `registerNativeChrome(...)` wiring `backButton`/`pause`/`appStateChange` via `@capacitor/app`, reached only through a guarded dynamic import.
- 22 new/rewritten Wave-0 tests across `dual-write-convergence.test.js` (6), `lifecycle.test.js` (7), `back-button-logic.test.js` (7), plus the updated `engineAdapter.test.js` and `new-run-loop.test.js` — full suite now 363/363 green (358 prior + additions/updates).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 failing tests — dual-write convergence, lifecycle flush, back-button decision** - `0e29c93` (test)
2. **Task 2: Route engineAdapter + classic script through window.mzStorage (async, dual-write fix)** - `c6f709d` (feat)
3. **Task 3: nativeChrome back-button + lifecycle logic (src/browser/nativeChrome.js)** - `737041f` (feat)

**Plan metadata:** (this commit)

_TDD gate sequence verified in git log: `test(...)` commit (RED, 0e29c93) precedes both `feat(...)` commits (GREEN, c6f709d/737041f) — see `## TDD Gate Compliance` below._

## Files Created/Modified

- `src/browser/nativeChrome.js` - pure `decideBackAction`, awaited `flushOnBackground`, injectable `registerNativeChrome` (backButton/pause/appStateChange + stubbed splash/status-bar/orientation chrome finalized in 02-04)
- `src/browser/engineAdapter.js` - `boot()`/`getBest()`/`startNewRun()` now async and storage.js-routed; `persist()`/`persistGrave()` fire-and-enqueue
- `mazeworld.html` - classic `save()`/`load()`/`saveGraves()`/`loadGraves()` route through `window.mzStorage`; boot sequence deferred into `window.__mzClassicBoot`; trailing module orchestrates storage assignment → migration → engine boot → move/newGame wiring → classic boot → native chrome registration
- `test/persistence/dual-write-convergence.test.js` - proves engineAdapter and the classic script's own extracted functions converge on one shared backend/key
- `test/persistence/lifecycle.test.js` - proves the awaited-flush guarantee on pause/appStateChange(inactive)
- `test/persistence/back-button-logic.test.js` - proves decideBackAction never silently ends a live run
- `test/persistence/harness/sandboxClassicPersistence.js` - verbatim classic-script extraction harness (node:vm)
- `test/unit/engineAdapter.test.js` - updated to await the async API and flush() before inspecting raw storage
- `test/unit/new-run-loop.test.js` - same async-await update (Rule 1 fix, see Deviations)

## Decisions Made

- `engineAdapter.js`'s persistence functions are async but `dispatch()` itself stays synchronous — it renders from the state it already computed, while `persist()`/`persistGrave()` are enqueued (not awaited) through `storage.js`'s per-key write queue. `boot()`/`getBest()`/`startNewRun()` ARE awaited by their callers since they need a correct read-then-decide or read-then-write sequence.
- `boot()` runs `storage.migrateLegacyKeys()` internally as its first step (idempotent); the trailing module in `mazeworld.html` ALSO explicitly awaits migration before invoking the classic script's boot, since the classic script's own `S` state is never touched by `engineAdapter.boot()` at all — two independent boot paths both need migrated data present.
- Captured `const classicNewGame = newGame;` immediately after the classic script's `function newGame(){...}` declaration (before the trailing module could ever overwrite the bare `newGame` global) so `window.__mzClassicBoot`'s no-saved-run fallback always initializes the classic script's own `S` state correctly — calling the bare `newGame()` identifier there would have resolved to the engine-routed `startNewRun()` override instead, once wiring order put the override first, leaving `S` permanently null. Caught and fixed during implementation (Rule 1); not present in 02-RESEARCH.md's illustrative sketch.
- `decideBackAction`'s `alreadyConfirming` state is tracked internally inside `registerNativeChrome` (a `confirming` flag with a 2-second auto-reset timer, unref'd so it never blocks node process exit), not requested from the caller's `getGameContext()` — keeps the pure decision function trivially unit-testable while the one place that actually needs mutable state owns it.
- `test/persistence/harness/sandboxClassicPersistence.js` extracts `mazeworld.html`'s persistence functions verbatim via sentinel-comment markers rather than reimplementing them in the test — regression-proof against future edits accidentally reverting the classic script back to raw `localStorage` (the marker-extraction throws loudly if the markers are ever removed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Captured `classicNewGame` reference to prevent a null-`S` regression in the classic boot fallback**
- **Found during:** Task 2 (restructuring mazeworld.html's boot sequence into `window.__mzClassicBoot`)
- **Issue:** The plan's ordering ("wires window.move/window.newGame...; then invokes the restructured classic boot") means the trailing module overwrites `window.newGame` BEFORE `window.__mzClassicBoot()` runs. `window.__mzClassicBoot`'s no-saved-run fallback originally called the bare `newGame()` identifier, which — after the override — would resolve to the engine-routed `startNewRun()` instead of the classic implementation. `startNewRun()` never touches the classic script's own `S` variable, so a fresh install (no prior save) would leave `S` permanently `null`, crashing every subsequent classic-script function that reads `S.c`/`S.floor` (combat, store, camp, graveyard rendering).
- **Fix:** Captured `const classicNewGame = newGame;` immediately after the classic `function newGame(){...}` declaration (at classic-script parse time, before any override is possible) and call `classicNewGame()` from `window.__mzClassicBoot`'s fallback instead of the bare identifier.
- **Files modified:** mazeworld.html
- **Verification:** Manually traced the call-resolution order; full suite green; the classic script's `S` initialization path is exercised indirectly by every test that boots via `withFakeLocalStorage`/`installFakeCapacitor` and by `dual-write-convergence.test.js`'s classic-sandbox tests.
- **Committed in:** c6f709d (Task 2 commit)

**2. [Rule 1 - Bug] Updated test/unit/new-run-loop.test.js (not in this plan's declared files) to await the now-async startNewRun()/getBest()**
- **Found during:** Task 2 (full-suite verification after the async refactor)
- **Issue:** This pre-existing 03-03 test file called `startNewRun()`/`getBest()` synchronously; once those became async (per this plan's own Task 2 behavior spec), the file's assertions started comparing against unresolved Promises instead of resolved values, breaking 3 previously-passing tests.
- **Fix:** Made `withFakeLocalStorage` async and added `await` at each `startNewRun()`/`getBest()` call site, mirroring the same update applied to `test/unit/engineAdapter.test.js`.
- **Files modified:** test/unit/new-run-loop.test.js
- **Verification:** `node --test` (full suite) green — 363/363, including all 3 previously-broken tests.
- **Committed in:** c6f709d (Task 2 commit)

**3. [Rule 1 - Bug] Realm-mismatch fix in dual-write-convergence.test.js's own graveyard-round-trip assertion**
- **Found during:** Task 1 (writing the RED tests) / Task 2 (verifying GREEN)
- **Issue:** `assert.deepStrictEqual(classic.graves, [...])` failed with "Values have same structure but are not reference-equal" — `classic.graves` is populated by `loadGraves()`'s own `JSON.parse(...)` call evaluated INSIDE the `node:vm` sandbox's separate realm, and Node's `assert.deepStrictEqual` treats structurally-identical cross-realm objects as unequal (different `Object.prototype`/`Array.prototype`).
- **Fix:** Normalized via `JSON.parse(JSON.stringify(classic.graves))` before comparing, matching the same-realm pattern already used elsewhere in the test for the raw-backend JSON comparison.
- **Files modified:** test/persistence/dual-write-convergence.test.js
- **Verification:** Test passes; content-equality (the actual intent) is unaffected by the normalization.
- **Committed in:** 0e29c93 (Task 1 test, since this was caught while confirming RED-then-GREEN transitions before Task 2 landed) — the fix itself is part of Task 1's committed test file (the marker-extraction-dependent assertions only reach GREEN once Task 2's markers exist, so this fix was folded into the same test file before Task 2's commit).

---

**Total deviations:** 3 auto-fixed (2 bugs preventing correct behavior/tests, 1 pre-existing-test regression from the async API change)
**Impact on plan:** All three were necessary for correctness — #1 would have shipped a null-pointer crash on every fresh install once the classic boot ordering changed; #2 kept the "full suite must stay green" done-criterion honest by including a file the plan's declared scope happened to miss; #3 was a test-infrastructure-only fix (no production code affected). No scope creep beyond what was needed to make the plan's own stated guarantees actually true.

## Issues Encountered

None beyond the deviations above — RED/GREEN transitions matched expectations at every task boundary; no build/tooling issues (this plan does not touch gradle/Capacitor build steps, per its own scope note).

## User Setup Required

None - no external service configuration required. This plan adds no new dependencies (nativeChrome.js reaches `@capacitor/app`/`@capacitor/splash-screen`/`@capacitor/status-bar`/`@capacitor/screen-orientation` only via guarded dynamic import, and those packages are already present in `package.json` from 02-02's `npm install`, though the native build itself remains separately blocked on the JDK install per STATE.md).

## Next Phase Readiness

- `src/browser/nativeChrome.js`'s splash/status-bar/orientation chrome calls are intentionally stubbed (best-effort, non-throwing placeholders) — 02-04 finalizes the exact config against the real provided assets (`assets/mazeworld-splash-android.zip`, the 512×512 app icon) and the capacitor.config.ts plugin options documented in 02-RESEARCH.md.
- Deferred device UAT (D8 above, per 02-VALIDATION.md's three-tier verification architecture): on a real device, press back mid-run (must confirm, never silently end) and background/force-stop mid-run then reopen (must resume exactly) — both interface-level behaviors (decideBackAction, flushOnBackground) are unit-proven here; only the real `@capacitor/app` event wiring and OS lifecycle timing require a device.
- No blockers for this plan's own scope. Full suite (363 tests) green; no raw `localStorage.*Item` calls in `engineAdapter.js`; no static `@capacitor/*` import in `nativeChrome.js` (both grep-verified). The Android/Gradle build itself remains blocked on the Temurin JDK 17 UAC prompt from 02-02 (unrelated — this plan is pure JS wiring + tests, as scoped).

---
*Phase: 02-android-packaging-native-persistence*
*Completed: 2026-09-08*

## TDD Gate Compliance

Task 1 (`test(02-03): ...`, `0e29c93`) landed the RED-phase tests (confirmed failing via `node --test` before commit — nativeChrome.js's exports did not exist and mazeworld.html's extraction markers were absent). Both subsequent commits are `feat(...)` GREEN commits (`c6f709d` for the dual-write-convergence + engineAdapter scope, `737041f` for the lifecycle + back-button scope), each verified to turn its target test files green before committing. Gate sequence confirmed in git log order: test → feat → feat. No REFACTOR commit was needed.

## Self-Check: PASSED

- FOUND: src/browser/nativeChrome.js
- FOUND: test/persistence/dual-write-convergence.test.js
- FOUND: test/persistence/lifecycle.test.js
- FOUND: test/persistence/back-button-logic.test.js
- FOUND: test/persistence/harness/sandboxClassicPersistence.js
- FOUND: src/browser/engineAdapter.js
- FOUND: mazeworld.html
- FOUND: test/unit/engineAdapter.test.js
- FOUND: test/unit/new-run-loop.test.js
- FOUND: .planning/phases/02-android-packaging-native-persistence/02-03-SUMMARY.md
- FOUND commit: 0e29c93 (Task 1, test)
- FOUND commit: c6f709d (Task 2, feat)
- FOUND commit: 737041f (Task 3, feat)
