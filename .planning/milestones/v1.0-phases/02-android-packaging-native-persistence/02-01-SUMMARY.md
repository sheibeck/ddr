---
phase: 02-android-packaging-native-persistence
plan: 01
subsystem: persistence
tags: [async-storage, capacitor-preferences, localStorage, migration, node-test, tdd]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: engine/saveState.js (validateSave/serializeRun/rehydrate) and src/browser/engineAdapter.js's localStorage-key patterns this abstraction generalizes
provides:
  - "src/browser/storage.js: the single shared async Storage abstraction (getItem/setItem/removeItem/flush/migrateLegacyKeys), exposed as window.mzStorage"
  - "test/persistence/harness/fakePreferences.js: reusable async fake-Preferences mock + window.Capacitor/localStorage install helpers for 02-03 to reuse"
  - "one-time, idempotent, non-destructive localStorage->Preferences migration for the 3 legacy keys, fail-closed on a corrupt run save via validateSave"
affects: [02-02-android-packaging, 02-03-persistence-integration, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime backend selection via window.Capacitor?.isNativePlatform?.() with the native Preferences plugin reached ONLY through a guarded dynamic import() inside the native branch — never a top-level import — so node --test and the browser dev loop never resolve a @capacitor/* specifier"
    - "Per-key promise-chain write queue (Map<key, chainPromise>) serializing async writes to the same key, matching 02-RESEARCH.md's recommended 5-line pattern; flush() awaits Promise.all of all outstanding chains"
    - "Test-only injection hook (window.__mzPreferencesOverride) checked before the real dynamic import, letting node --test exercise the native branch's queueing/JSON/fail-safe logic without @capacitor/preferences installed"

key-files:
  created:
    - src/browser/storage.js
    - test/persistence/harness/fakePreferences.js
    - test/persistence/storage.test.js
    - test/persistence/storage-migration.test.js
  modified: []

key-decisions:
  - "Added a test-only native-Preferences override hook (window.__mzPreferencesOverride) not explicitly named in the plan, since @capacitor/preferences isn't installed until 02-02 and node --test cannot resolve a bare @capacitor/* specifier under any dynamic-import path — this is the only way to exercise the native branch's real logic (queueing, JSON handling, non-string defense, fail-safe try/catch) headlessly. Production code never sets this hook; a real native launch always falls through to the real dynamic import."
  - "Split storage.js's implementation across the Task 2 and Task 3 commits by temporarily omitting migrateLegacyKeys from the Task 2 diff (it was written alongside the rest during implementation) so each commit's GREEN state matches exactly one test file, preserving the plan's task-by-task RED/GREEN sequence in git history."
  - "getItem() is not queued behind pending writes to the same key — callers needing read-after-write ordering await the setItem()/removeItem() promise first (matches the plan's async-safe-autosave guidance; 02-03 will decide adapter-level read/write sequencing)."

patterns-established:
  - "Storage abstraction test harness (fakePreferences.js) is the shared mock 02-03's dual-write-convergence tests should also import, rather than each plan re-implementing its own fake Preferences."

requirements-completed: [SAV-01, SAV-02, SAV-03, SAV-04, SAV-05]

coverage:
  - id: D1
    description: "getItem/setItem/removeItem round-trip a value through both backends (native fake Preferences and browser fake localStorage), return null for missing keys, and defend against a non-string native result"
    requirement: "SAV-03"
    verification:
      - kind: unit
        ref: "test/persistence/storage.test.js#getItem/setItem/removeItem round-trip a value through the NATIVE branch"
        status: pass
      - kind: unit
        ref: "test/persistence/storage.test.js#getItem/setItem/removeItem round-trip a value through the BROWSER branch"
        status: pass
      - kind: unit
        ref: "test/persistence/storage.test.js#getItem defends against a non-string native Preferences result"
        status: pass
    human_judgment: false
  - id: D2
    description: "A save written then read back after a simulated restart deepStrictEquals the original serialized run (resume-exactly guarantee)"
    requirement: "SAV-02"
    verification:
      - kind: unit
        ref: "test/persistence/storage.test.js#setItem then getItem after a simulated restart deepStrictEquals a serializeRun(newRun(seed)) value (SAV-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rapid sequential same-key writes settle in order and never drop the last write (async-safe autosave)"
    requirement: "SAV-01"
    verification:
      - kind: unit
        ref: "test/persistence/storage.test.js#a per-key rapid-write burst settles in order and never drops the last write (SAV-01)"
        status: pass
      - kind: unit
        ref: "test/persistence/storage.test.js#a per-key rapid-write burst on the browser backend also never drops the last write"
        status: pass
    human_judgment: false
  - id: D4
    description: "Malformed/tampered/throwing backends fail closed/safe: getItem never throws (resolves null), setItem/removeItem never throw"
    requirement: "SAV-03"
    verification:
      - kind: unit
        ref: "test/persistence/storage.test.js#getItem/setItem never throw and getItem resolves null when the native backend throws/rejects (SAV-03 fail-safe)"
        status: pass
      - kind: unit
        ref: "test/persistence/storage.test.js#getItem/setItem never throw when the browser localStorage backend throws (private window/quota)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Best-depth and graveyard values round-trip through the same abstraction as the run save"
    requirement: "SAV-04, SAV-05"
    verification:
      - kind: unit
        ref: "test/persistence/storage.test.js#best-depth and graveyard values round-trip the same way as the run save (SAV-04/SAV-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "migrateLegacyKeys copies the three legacy localStorage keys into Preferences only when Preferences is empty for that key, idempotently, never deleting the source"
    requirement: "SAV-03"
    verification:
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys copies all three legacy localStorage keys into Preferences when Preferences is empty"
        status: pass
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys never removes the localStorage source"
        status: pass
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys is idempotent: a second run copies nothing and overwrites nothing already migrated"
        status: pass
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys is a no-op when localStorage is empty (true first install)"
        status: pass
    human_judgment: false
  - id: D7
    description: "migrateLegacyKeys validates a migrated run save via engine/saveState.js validateSave and does not migrate a value that fails validation (fail-closed)"
    requirement: "SAV-03"
    verification:
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys validates the run save via engine/saveState.js validateSave and skips migrating a corrupt one (fail-closed)"
        status: pass
      - kind: unit
        ref: "test/persistence/storage-migration.test.js#migrateLegacyKeys still migrates best-depth and graveyard even when the run save is corrupt (per-key independence)"
        status: pass
    human_judgment: false
  - id: D8
    description: "No test or storage.js top-level code imports @capacitor/preferences or any bare @capacitor/* specifier; native access is guarded, dynamic-only"
    verification:
      - kind: other
        ref: "grep -RnE \"^\\s*import .*@capacitor\" src/browser/storage.js test/persistence/ (returns nothing)"
        status: pass
      - kind: unit
        ref: "node --test (full suite, 342 tests, 324 prior + 18 new)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 02 Plan 01: Async Storage Abstraction + Legacy-Key Migration Summary

**A single async Storage module (window.mzStorage) with a runtime-selected native-Preferences-or-localStorage backend, a per-key write queue that never drops a rapid-fire save, and a fail-closed one-time localStorage→Preferences migration — all verified headlessly with zero Capacitor dependency installed.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-08T14:10:00Z (approx.)
- **Completed:** 2026-09-08T14:26:25Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- Built `src/browser/storage.js`: async `getItem`/`setItem`/`removeItem`/`flush`/`migrateLegacyKeys`, backend-selected at runtime via `window.Capacitor?.isNativePlatform?.()`, with the native `@capacitor/preferences` plugin reached ONLY through a guarded dynamic `import()` inside the native branch — proven never resolvable/needed under `node --test` or the plain browser dev loop.
- Implemented a per-key promise-chain write queue so a burst of rapid same-key `setItem()` calls (autosave on every action) always settles with the LAST write winning, never dropped or reordered; `flush()` awaits every outstanding queue for the future lifecycle pause/background handler (02-03).
- Implemented `migrateLegacyKeys()`: copy-if-empty, idempotent, non-destructive migration of the three legacy keys (`mazeworld.delve.v1`/`mazeworld.best.v1`/`mazeworld.graveyard.v1`) from `localStorage` into the abstraction's backend, validating the run save through `engine/saveState.js`'s `validateSave` first (fail-closed on corrupt/tampered data).
- Built `test/persistence/harness/fakePreferences.js`: a reusable, microtask-resolving async fake Preferences mock plus `window.Capacitor`/`localStorage` install/restore helpers, mirroring `test/unit/engineAdapter.test.js`'s established `withFakeLocalStorage` discipline — ready for 02-03 to reuse for the dual-write-convergence tests.
- 17 new Wave-0 tests (11 in `storage.test.js`, 6 in `storage-migration.test.js`) all green; full suite now 342/342 (324 prior + 18, including the RED-phase existence check).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 failing tests + reusable async fake-Preferences harness** - `a343022` (test)
2. **Task 2: Implement the async Storage abstraction (get/set/remove/flush) — GREEN** - `f15a9c4` (feat)
3. **Task 3: One-time legacy-key migration (migrateLegacyKeys) — GREEN** - `122ed13` (feat)

**Plan metadata:** (this commit)

_TDD gate sequence verified in git log: `test(...)` commit (RED) precedes both `feat(...)` commits (GREEN) — see `## TDD Gate Compliance` below._

## Files Created/Modified

- `src/browser/storage.js` - the shared async Storage abstraction: runtime backend selection, per-key write queue, flush(), migrateLegacyKeys(), exposed as `window.mzStorage`
- `test/persistence/harness/fakePreferences.js` - reusable async fake Preferences mock + `window.Capacitor`/`localStorage` install/restore helpers
- `test/persistence/storage.test.js` - round-trip, non-string-defense, fail-safe, rapid-write-ordering coverage (11 tests)
- `test/persistence/storage-migration.test.js` - copy-once/idempotent/non-destructive/fail-closed migration coverage (6 tests)

## Decisions Made

- Added a test-only native-Preferences override hook (`window.__mzPreferencesOverride`), checked before the real dynamic `import('@capacitor/preferences')`, since the package isn't installed until 02-02 and there is no way to intercept a real bare-specifier dynamic import under plain Node. This is the mechanism that lets the native branch's actual logic (queueing, JSON handling, non-string defense, fail-safe try/catch) be exercised headlessly rather than only smoke-tested. Production/native code never sets this hook.
- Split the `storage.js` implementation across the Task 2/Task 3 commits by temporarily withholding `migrateLegacyKeys` from the Task 2 diff (it was fully written and passing during implementation, since the whole module was designed together) — re-added it in Task 3's commit so each commit's GREEN state matches exactly the plan's stated per-task scope in git history, rather than merging both GREEN phases into one commit.
- `getItem()` is intentionally NOT queued behind in-flight writes to the same key — a caller needing strict read-after-write ordering awaits the `setItem()`/`removeItem()` promise first. This keeps reads fast (no artificial queueing latency) and matches how `flush()`/callers are expected to use the API; 02-03 will decide the adapter's own read/write sequencing when it wires boot()/persist() through this module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added a test-only native-Preferences injection hook**
- **Found during:** Task 1/Task 2 (writing the native-branch tests and implementation)
- **Issue:** The plan's `<behavior>` requires storage.test.js to round-trip a value through "the NATIVE branch (fake Preferences, isNativePlatform()=true)" and requires storage.js to reach Preferences "via `await import('@capacitor/preferences')` INSIDE the branch" — but `@capacitor/preferences` is not installed until 02-02, so under plain `node --test` that dynamic import can never resolve to anything, real or mocked, without some seam. Without a seam, the native branch would be untestable except by observing "always resolves null" (the fail-safe fallback), which does not actually exercise the queueing/JSON/non-string-defense logic the plan's `<behavior>` explicitly requires covering.
- **Fix:** `loadNativePreferences()` checks `window.__mzPreferencesOverride` first (installed only by the test harness) and falls through to the real dynamic import otherwise. Production/native code never sets this hook, so a real device launch is unaffected; the dynamic `import('@capacitor/preferences')` specifier remains untouched and un-resolvable-until-02-02, satisfying the plan's "never a top-level import" / "no bare `@capacitor/*` specifier resolvable under node" constraints.
- **Files modified:** src/browser/storage.js, test/persistence/harness/fakePreferences.js
- **Verification:** All native-branch test cases in storage.test.js/storage-migration.test.js pass; `grep -RnE "^\s*import .*@capacitor" src/browser/storage.js` returns nothing; full suite green.
- **Committed in:** f15a9c4 (Task 2 commit), 122ed13 (Task 3 commit — override hook already present, only migrateLegacyKeys added)

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** Necessary to make the plan's own explicit native-branch test requirements achievable at all under this phase's zero-Capacitor-installed constraint. No scope creep — the hook is dead code on a real device (only ever read by the test harness) and does not weaken the fail-safe/fail-closed guarantees.

## TDD Gate Compliance

Task 1 (`test(02-01): ...`, `a343022`) landed the RED-phase tests; both subsequent commits are `feat(...)` GREEN commits (`f15a9c4`, `122ed13`), each verified to turn its target test file green before committing. Gate sequence confirmed in git log order: test → feat → feat. No REFACTOR commit was needed (no post-GREEN cleanup required).

## Issues Encountered

- `node --test test/persistence/` (directory form, with or without a trailing slash) failed with `MODULE_NOT_FOUND` on this Windows/Git-Bash setup rather than auto-discovering the two `.test.js` files inside it — same class of Windows `node --test` directory-globbing quirk noted in STATE.md for `test/parity/`. Worked around by listing the two test files explicitly (`node --test test/persistence/storage.test.js test/persistence/storage-migration.test.js`); the full-suite `node --test` (no path argument) discovers and runs them correctly via its default recursive `**/*.test.js` pattern, so this only affected local iteration, not the actual verification gate.

## User Setup Required

None - no external service configuration required. This plan installs no Capacitor package (that's 02-02); `node --test` runs with zero new dependencies.

## Next Phase Readiness

- `src/browser/storage.js` (`window.mzStorage`) and `test/persistence/harness/fakePreferences.js` are ready for 02-02 (Capacitor project scaffolding) and 02-03 (wiring `engineAdapter.js`'s `boot()`/`persist()`/`persistGrave()`/`getBest()`/`recordBest()` and `mazeworld.html`'s classic `save()`/`load()`/`saveGraves()`/`loadGraves()` through this one shared module — the dual-write convergence 02-RESEARCH.md flags as the phase's central persistence risk).
- `migrateLegacyKeys()` is implemented and tested but not yet wired to run at boot — that wiring is explicitly 02-03's job ("run once at boot, before the adapter's load path").
- No blockers. Full suite (342 tests) green; no Capacitor specifier resolvable under node or the browser dev loop (grep-verified).

---
*Phase: 02-android-packaging-native-persistence*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: src/browser/storage.js
- FOUND: test/persistence/harness/fakePreferences.js
- FOUND: test/persistence/storage.test.js
- FOUND: test/persistence/storage-migration.test.js
- FOUND: .planning/phases/02-android-packaging-native-persistence/02-01-SUMMARY.md
- FOUND commit: a343022 (Task 1, test)
- FOUND commit: f15a9c4 (Task 2, feat)
- FOUND commit: 122ed13 (Task 3, feat)
