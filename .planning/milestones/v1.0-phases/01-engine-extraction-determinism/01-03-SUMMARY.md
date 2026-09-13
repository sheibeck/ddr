---
phase: 01-engine-extraction-determinism
plan: 03
subsystem: testing
tags: [node-vm, golden-master, parity-harness, mulberry32, determinism, zero-deps]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/rng.js (mulberry32, makeRng), zero-dependency node --test project scaffold"
provides:
  - "Frozen, immutable golden-master extraction of the pristine prototype's inline <script> body (test/parity/prototype-master.js.txt)"
  - "node:vm sandbox loader (test/parity/harness/sandboxPrototype.js: loadPrototypeSandbox({seed})) that boots the frozen prototype headless with hand-written DOM/localStorage/canvas stubs"
  - "Seeded Math.random factory matching engine/rng.js's mulberry32 exactly (test/parity/harness/seedableMathRandom.js: makeSeededMathRandom)"
  - "Wall-clock-safe state comparator (test/parity/harness/diffState.js: stripVolatileFields, diffState)"
  - "Documented fixture format + reserved action-type vocabulary for later parity slices (test/parity/fixtures/action-script.schema.md, README.md)"
  - "Green smoke test proving the harness end-to-end with no engine slice required (test/parity/harness/smoke.test.js)"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-master fixture stored as `.js.txt`, not `.js` — Node's bare `node --test` sweeps every .js/.cjs/.mjs file under any directory literally named `test` as a test file with no exclude mechanism; a plain-data fixture with executable-looking prototype code must use a non-JS-ish extension to avoid being auto-run and crashing the suite"
    - "Cross-realm mulberry32 duplication, not import: seedableMathRandom.js duplicates engine/rng.js's exact bit-mixing rather than importing it, keeping the harness able to seed a vm sandbox's Math.random independently, verified byte-identical to engine/rng.js's mulberry32 via a direct sequence comparison"
    - "node:vm top-level `let` exposure via a second runInContext call sharing the same context's lexical environment — a live getter defined in a follow-up script reflects the prototype's `let S` binding even as later calls reassign it, without needing to rewrite the frozen source to `var`"
    - "diffState returns a path string (not an assertion) so callers choose strict-state/loose-events comparison per 01-RESEARCH.md Open Question 1"

key-files:
  created:
    - test/parity/prototype-master.js.txt
    - test/parity/harness/sandboxPrototype.js
    - test/parity/harness/seedableMathRandom.js
    - test/parity/harness/diffState.js
    - test/parity/harness/smoke.test.js
    - test/parity/fixtures/action-script.schema.md
    - test/parity/fixtures/README.md
  modified: []

key-decisions:
  - "Renamed the frozen prototype fixture from test/parity/prototype-master.js to test/parity/prototype-master.js.txt (Rule 3 auto-fix): Node's `node --test` (bare, per package.json's test script) treats every .js/.cjs/.mjs file inside any directory named `test` as a test file to execute, with no built-in ignore/exclude mechanism. The frozen fixture's top-level code references document/localStorage/Math.random/etc. that don't exist in a plain Node context, so under a `.js` extension the bare test-runner sweep executed it directly and crashed the whole suite. sandboxPrototype.js reads its content via fs.readFileSync regardless of extension, so the rename has zero functional impact on the harness."
  - "seedableMathRandom.js duplicates the mulberry32 bit-mixing algorithm inline rather than importing engine/rng.js, per the plan's own guidance ('import the algorithm or duplicate it with a comment tying it to engine/rng.js') — keeps the parity-harness's dev-tooling import graph independent of engine/ internals while a direct sequence comparison (same seed -> identical next()/Math.random() outputs) proves the two stay byte-identical."
  - "Exposed the prototype's module-scoped `let S = null` to the vm context via a second `vm.runInContext` call defining `Object.defineProperty(globalThis, 'S', { get: () => S })` in the same context, rather than rewriting `let` to `var` in the frozen source — preserves byte-verbatim fidelity to the original prototype while making S readable/live-updating from outside the sandbox."
  - "diffState.js's stripVolatileFields looks for a `graves` key holding an array anywhere in the object graph (not just at the top level) and strips `.when` from each entry — matches the plan's literal instruction and stays useful regardless of whether a later engine GameState nests graves differently than the prototype's top-level global."

patterns-established:
  - "Any future dev-tooling file placed under test/ that is not meant to be auto-run as a test (raw data, non-modular source snapshots) must use a non-.js/.cjs/.mjs extension, or it will be silently swept into `node --test`'s default discovery and can crash the suite if its top-level code assumes an environment (browser globals) Node doesn't provide."
  - "Sandbox stub surface built and iteratively verified by actually running loadPrototypeSandbox({seed}) + newGame() + move() and adding stub methods only where it threw (insertAdjacentHTML was the only gap found beyond the research sketch's minimal DOM/canvas/localStorage/matchMedia/devicePixelRatio surface)."

requirements-completed: [ENG-05]

coverage:
  - id: D1
    description: "The pristine prototype rules are frozen as an immutable fixture (test/parity/prototype-master.js.txt), independent of edits to the live mazeworld.html"
    requirement: "ENG-05"
    verification:
      - kind: manual
        ref: "grep confirms function genFloor/move/newGame present at expected line offsets in the frozen fixture; mazeworld.html unchanged by this plan (git diff empty on mazeworld.html)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The frozen prototype boots headless in a node:vm sandbox with hand-written DOM/localStorage/canvas stubs and a seedable Math.random, exposing newGame/move/S without throwing"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/parity/harness/smoke.test.js#sandboxed prototype boots, runs newGame + a move, and its state JSON-round-trips"
        status: pass
    human_judgment: false
  - id: D3
    description: "A seedable Math.random (mulberry32) can be injected into the sandbox so the prototype and the engine draw the same rolls"
    requirement: "ENG-05"
    verification:
      - kind: manual
        ref: "Direct sequence comparison: engine/rng.js's mulberry32(seed).next() and seedableMathRandom's makeSeededMathRandom(seed)() produce identical 3-value sequences for the same seed"
        status: pass
      - kind: unit
        ref: "test/parity/harness/smoke.test.js#loadPrototypeSandbox({seed}) is deterministic: same seed -> same character and floor"
        status: pass
    human_judgment: false
  - id: D4
    description: "diffState strips the 4 wall-clock fields (deathAt, graveyard when, AGAIN_LOCK-derived) before comparison and reports the first divergent field"
    requirement: "ENG-05"
    verification:
      - kind: manual
        ref: "Crafted-object check: stripVolatileFields removes deathAt and graves[0].when while leaving gameplay fields (c.name, c.wp, graves[0].note) intact; diffState returns null for two states differing only in deathAt, and returns the exact path (\"c.wp (10 vs 12)\") for a real injected difference"
        status: pass
    human_judgment: false
  - id: D5
    description: "A smoke test proves the sandboxed prototype can run newGame() and one move() without throwing"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/parity/harness/smoke.test.js (2 tests)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-07
status: complete
---

# Phase 1 Plan 3: Reusable Prototype-Parity Harness Summary

**Freezes the pristine prototype as an immutable `.js.txt` golden master, boots it headless in a node:vm sandbox with a hand-written DOM/localStorage/canvas stub surface and a mulberry32-seeded Math.random matching engine/rng.js exactly, and provides a wall-clock-safe diffState comparator plus documented fixture format — all proven end-to-end by a green smoke test, with zero engine slice required yet.**

## Performance

- **Duration:** ~45 min (research review, mazeworld.html DOM-surface inspection, iterative sandbox stub debugging, and the mid-plan test-runner discovery fix)
- **Started:** 2026-09-07 (session start)
- **Completed:** 2026-09-07
- **Tasks:** 3 completed
- **Files created:** 7 (prototype-master.js.txt, sandboxPrototype.js, seedableMathRandom.js, diffState.js, smoke.test.js, action-script.schema.md, README.md)

## Accomplishments

- Extracted `mazeworld.html`'s inline `<script>` body (lines 483-3256) verbatim into a frozen golden-master fixture, prefixed with a do-not-edit header comment explaining both its purpose (parity reference, protected from plan 01-07's later browser-adapter edits, threat T-01-03a) and its unusual `.js.txt` extension.
- Built `makeSeededMathRandom(seed)` duplicating `engine/rng.js`'s mulberry32 bit-mixing exactly — verified byte-identical to `engine/rng.js`'s `mulberry32(seed).next()` output sequence for the same seed.
- Built `loadPrototypeSandbox({seed})`: a `node:vm`-based headless loader with a hand-written DOM/localStorage/canvas stub surface (generic fake-element factory covering `appendChild`/`insertBefore`/`removeChild`/`classList`/`style`/`dataset`/`innerHTML` (which correctly clears tracked children on set, mirroring real DOM behavior)/`textContent`, a no-op 2D canvas context, `localStorage` backed by a `Map`, `window.matchMedia`/`devicePixelRatio`/`innerHeight`/`innerWidth`, and `getComputedStyle`). Iteratively verified by actually running it — one real stub gap (`insertAdjacentHTML`, used by `renderEncounter()`) was found and fixed beyond the research sketch's baseline.
- Solved a genuine `node:vm` gotcha: the prototype's top-level `let S = null` does not attach to the vm context's global object (only `var`/function declarations do), so `context.S` read `undefined` even after `newGame()` ran. Fixed by issuing a second `vm.runInContext` call in the same context defining a live getter for `S` on the global object — verified this correctly reflects `S` before and after reassignment.
- Built `stripVolatileFields`/`diffState` in `diffState.js`: strips `deathAt` and any `graves[].when` recursively, and `diffState` returns the first divergent JSON path (or `null`) rather than asserting, per 01-RESEARCH.md's "assert state strictly, events loosely" recommendation.
- Documented the `{seed, actions[]}` fixture format and its 12-entry reserved action-type vocabulary (`move`, `attack`, `castSpell`, `drinkPotion`, `flee`, `parley`, `sing`, `readScroll`, `buyItem`, `leaveStore`, `useItem`, `camp`, `newGame`) in `action-script.schema.md`, plus a `README.md` with fixture-authoring steps for plans 01-05 through 01-10.
- Wrote `smoke.test.js`: boots the sandbox, confirms `newGame()` populated a coherent character + floor, runs a legal `move()`, and confirms the stripped state JSON-round-trips — proving the entire harness works without any engine slice existing.
- **Discovered and fixed a project-wide tooling gap mid-plan:** Node's bare `node --test` (the project's `package.json` test script since 01-01) sweeps every `.js`/`.cjs`/`.mjs` file inside any directory literally named `test`, recursively, as a test file — with no exclude/ignore mechanism. This silently swept up `sandboxPrototype.js`, `diffState.js`, and `seedableMathRandom.js` as harmless vacuous "passing" pseudo-tests (zero assertions inside), but crashed the whole suite on `prototype-master.js` (its top-level code references `document`/`localStorage`/etc. that don't exist in plain Node). Fixed by renaming the frozen fixture to `.js.txt`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze the pristine prototype + seedable Math.random** - `8417fe6` (feat)
2. **Task 2: node:vm sandbox loader with DOM/localStorage/canvas stubs** - `a37cbea` (feat)
3. **Task 3: diffState comparator + fixture format + smoke test** - `24be626` (feat, file-rename mechanics only — see Deviations) + `f8c65f3` (feat, the actual new content and the rename's explanatory header/path updates)

**Plan metadata:** committed via `docs(01-03): complete plan` (see final_commit step)

## Files Created/Modified

- `test/parity/prototype-master.js.txt` - frozen, byte-verbatim golden master of `mazeworld.html`'s inline `<script>` body (do-not-edit header comment; `.js.txt` extension, not `.js`, to avoid `node --test`'s directory-based auto-discovery)
- `test/parity/harness/sandboxPrototype.js` - `loadPrototypeSandbox({seed})`: `node:vm` loader with hand-written DOM/localStorage/canvas stubs and the `let S` global-exposure fix
- `test/parity/harness/seedableMathRandom.js` - `makeSeededMathRandom(seed)`: mulberry32-backed `Math.random` replacement, verified identical to `engine/rng.js`
- `test/parity/harness/diffState.js` - `stripVolatileFields(state)`, `diffState(a, b)`: wall-clock-safe deep comparator returning a divergence path or `null`
- `test/parity/harness/smoke.test.js` - 2 tests: end-to-end harness proof (boot + newGame + move + JSON round-trip) and seed determinism
- `test/parity/fixtures/action-script.schema.md` - `{seed, actions[]}` fixture format + 12-entry reserved action-type vocabulary + strict-state/loose-events comparison rule
- `test/parity/fixtures/README.md` - fixture-authoring workflow for plans 01-05 through 01-10

## Decisions Made

- Renamed `test/parity/prototype-master.js` → `test/parity/prototype-master.js.txt` (see Deviations below) — no other completed or in-progress plan referenced the `.js` path externally, so this is a zero-risk, self-contained rename local to this plan's own artifacts. Plan 01-07's instruction to "not edit test/parity/prototype-master.js" remains valid in spirit against the renamed file (it will see the actual `.js.txt` filename on disk when it executes).
- `seedableMathRandom.js` duplicates mulberry32's bit-mixing math inline (with a comment tying it to `engine/rng.js`) rather than importing `mulberry32` from `engine/rng.js`, matching the plan's explicit either/or instruction; a direct sequence-equality check confirms the duplication stays exact.
- The `let S` global-exposure fix uses a second `vm.runInContext` call rather than rewriting the frozen source's `let` to `var` — keeps the golden master byte-verbatim (its own stated purpose) while still making `S` externally readable and always current.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `node --test`'s directory-based auto-discovery swept up the frozen prototype fixture and crashed the whole suite**
- **Found during:** Task 3, while running the plan's overall `node --test` acceptance gate (not just the Task 3-specific `node --test test/parity/harness/smoke.test.js` command, which passed in isolation).
- **Issue:** Node's built-in test runner, when invoked bare (`node --test`, the project's `package.json` test script since 01-01), recursively treats every `.js`/`.cjs`/`.mjs` file inside any directory literally named `test` as a test file to execute — regardless of filename convention, and with no built-in ignore/exclude glob. This swept up `test/parity/harness/{diffState,sandboxPrototype,seedableMathRandom}.js` (harmless: zero `test()` calls inside, so they vacuously "pass") and `test/parity/prototype-master.js` (harmful: its top-level code references `document`/`localStorage`/`Math.random`/etc. that don't exist in a plain Node global scope, since it's a browser-page script snapshot, not a module — Node threw immediately and the whole suite reported a failure).
- **Fix:** Renamed the frozen fixture to `test/parity/prototype-master.js.txt` (a non-JS-ish extension, outside Node's test-runner sweep criteria) and updated `sandboxPrototype.js`'s `fs.readFileSync` path, `seedableMathRandom.js`'s doc comment, and both fixture-docs' references accordingly. `sandboxPrototype.js` already read the file as plain text via `fs`, not `import`, so the rename has zero effect on the harness's actual behavior.
- **Files modified:** `test/parity/prototype-master.js` → `test/parity/prototype-master.js.txt` (rename), `test/parity/harness/sandboxPrototype.js`, `test/parity/harness/seedableMathRandom.js`, `test/parity/fixtures/README.md`, `test/parity/fixtures/action-script.schema.md`
- **Commit:** `24be626` (rename mechanics), `f8c65f3` (header/path-reference updates)
- **Verified:** Full `node --test` suite green: 31/31 tests passing (up from 31/32 with 1 failure before the fix).

### Process Note (not a deviation, documented for transparency)

Task 3's `git add` with a mix of an already-renamed path and its pre-rename name (a stale pathspec left over from drafting the commit) caused `git add` to abort the entire multi-path invocation on the one non-matching pathspec, so the first Task 3 commit (`24be626`) captured only the bare file rename with no content changes — the actual new files and content edits landed in a second commit (`f8c65f3`) moments later. Both commits are individually valid, atomic, and pushed to the same branch history; no work was lost or needs re-doing.

## Issues Encountered

- The `node:vm` `let`-vs-global-object gotcha (see Decisions) — resolved without touching the frozen source.
- One real DOM stub gap beyond the research sketch's baseline (`insertAdjacentHTML`, `renderEncounter()` at `mazeworld.html` line 2574) — found by actually running the sandbox once, fixed in Task 2's commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `test/parity/harness/sandboxPrototype.js`, `seedableMathRandom.js`, and `diffState.js` are ready for plans 01-05 through 01-10 to import directly when authoring per-slice parity tests (movement, combat, economy, chargen, death) — no further harness infrastructure work is needed before those plans start writing fixtures.
- `test/parity/fixtures/action-script.schema.md` and `README.md` give those plans a concrete format and workflow to follow immediately.
- The `.js.txt` extension convention (documented in this plan's Deviations and in the fixture's own header comment) should be followed by any future non-test data file placed under `test/`, to avoid repeating this `node --test` discovery gotcha.
- No blockers for 01-04 (or any later plan in this phase).

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 7 claimed files found on disk; all 4 claimed commit hashes (`8417fe6`, `a37cbea`, `24be626`, `f8c65f3`) found in git log; SUMMARY.md itself confirmed present on disk. Full `node --test` suite: 31/31 passing.
