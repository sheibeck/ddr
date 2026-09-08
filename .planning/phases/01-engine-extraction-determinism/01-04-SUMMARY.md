---
phase: 01-engine-extraction-determinism
plan: 04
subsystem: engine
tags: [maze-generation, rng-injection, determinism, node-test, pure-functions]

# Dependency graph
requires:
  - phase: 01-engine-extraction-determinism
    provides: "engine/rng.js (makeRng: next/d/pick/shuffle), zero-dependency node --test project scaffold"
provides:
  - "engine/maze.js: GW=21, GH=21, bfs(g,sx,sy), genFloor(depth,rng), reveal(floor,radius=2) — a pure, RNG-injected maze/floor generator"
  - "Determinism proof: genFloor(depth, makeRng(seed)) is byte-identical across two runs with the same seed, for every depth the fixed 5-floor Gate spans (1-5)"
  - "The first parity-verifiable pure function in the engine — everything newRun (01-05) and movement/descend (01-07) build on"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RNG-injection call-order fidelity: every Math.random() site ported to rng.next()/rng.pick()/rng.shuffle() in the exact left-to-right evaluation order of the original expression, verified by same-seed determinism rather than by inspection alone"
    - "bfs's bounds check is hardcoded to the module's GW/GH constants (matching the prototype exactly), not to the passed grid's actual dimensions — any hand-built test grid for bfs must be a full GWxGH grid with cells hand-carved open/closed, not a genuinely smaller grid"
    - "Pure primitives that the prototype computed from character/skill/effect state (reveal's radius) take that state as an explicit parameter with a sensible default, rather than being deferred until the character system is extracted"

key-files:
  created:
    - engine/maze.js
    - test/unit/maze.test.js
    - test/determinism/maze-determinism.test.js
  modified: []

key-decisions:
  - "reveal(floor, radius=2) takes radius as an explicit parameter instead of the prototype's skill/effect-derived value, because engine/maze.js only has access to the floor object — character skills (skill('Night Vision')) and active effects (eff('sight')) belong to a not-yet-extracted character/effects system. Default radius=2 is provably correct at any floor's starting position: genFloor always forces g[1][1].dark=false (even on floors with dark-zone blobs), so the prototype's own radius formula (r = (dark && !nightVision ? 1 : 2) + sightBonus) always evaluates to exactly 2 there with no sight bonus. A later plan wiring skills/effects into engine state can compute and pass the real radius for mid-run reveals."
  - "The plan's <read_first> description of reveal() (mazeworld.html lines 1281-1288: 'marks g[py][px].seen and the 4 orthogonal neighbors') does not match the actual prototype source, which is a radius-based square-block reveal (mazeworld.html lines 1281-1287: r = (dark && !skill(...) ? 1 : 2) + eff('sight'); reveals a (2r+1)x(2r+1) square). Implemented per the true prototype algorithm (Rule 1 — the plan's characterization was inaccurate; CLAUDE.md mandates the prototype's rules as canon) rather than the plan's literal 4-neighbor description."
  - "reveal(floor, radius) was implemented and unit-tested in Task 1's commit (deb3362) alongside genFloor, rather than deferred to a separate Task 2 commit — it is a two-line pure mutation with no RNG dependency, and test/unit/maze.test.js already covered genFloor/bfs comprehensively in one file. Task 2's remaining scope (the standalone determinism test) was committed separately as planned."
  - "Feature-count test expectations (test/unit/maze.test.js) are locked to genFloor(depth, makeRng(42))'s actual output per depth, computed by running the implementation once and asserting those exact values going forward — not guessed or approximated."

patterns-established:
  - "Same-seed determinism (assert.deepStrictEqual across two independent genFloor calls with makeRng(seed)) is the mechanical proof pattern for every future pure engine function ported from the prototype, per T-01-04a's mitigation."

requirements-completed: [ENG-02, ENG-05]

coverage:
  - id: D1
    description: "engine/maze.js exports GW=21, GH=21, bfs(g,sx,sy) (verbatim, no RNG), and genFloor(depth,rng) — a pure, RNG-injected port of the prototype's recursive-backtracker + loop-carving + farthest-cell exit/gate + feature scatter + dark-zone blobs + one-way doors"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/maze.test.js#genFloor(1, rng) returns { g, px:1, py:1, depth:1 } with a 21x21 grid of {wall,seen,feat}"
        status: pass
      - kind: unit
        ref: "test/unit/maze.test.js#genFloor: feature counts match the prototype's formula for seed 42, depths 1-5"
        status: pass
      - kind: unit
        ref: "test/unit/maze.test.js#genFloor is pure: no Math.random / document / localStorage / window in engine/maze.js"
        status: pass
      - kind: unit
        ref: "test/determinism/rng-no-math-random.test.js#no Math.random on any non-comment line under engine/ or content/"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fixed 5-floor Gate is preserved exactly: depth >= 5 places a 'gate' feature, depths 1-4 place 'exit' — no change to floor-cap behavior (endless descent is Phase 3, out of scope here)"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/maze.test.js#genFloor: depth 5 places exactly one 'gate' feature, no 'exit' (fixed 5-floor Gate)"
        status: pass
      - kind: unit
        ref: "test/unit/maze.test.js#genFloor: depth 4 still places 'exit', not 'gate' (Gate is depth >= 5 only)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bfs(g,sx,sy) computes correct breadth-first distances on a hand-built grid, including a branch and an unreached isolated cell"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/maze.test.js#bfs: distances on a hand-built grid with a straight corridor and a branch"
        status: pass
    human_judgment: false
  - id: D4
    description: "reveal(floor, radius=2) marks the correct square of cells seen, pure mutation, no RNG"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/unit/maze.test.js#reveal(floor): default radius 2 marks the 5x5 square around the player, clipped to bounds"
        status: pass
      - kind: unit
        ref: "test/unit/maze.test.js#reveal(floor, radius): custom radius widens/narrows the revealed square"
        status: pass
    human_judgment: false
  - id: D5
    description: "genFloor(depth, makeRng(seed)) is deterministic: same seed produces byte-identical floors for depths 1-5 (spanning the fixed Gate transition), and different seeds diverge — the mechanical proof that RNG-consumption order was ported faithfully"
    requirement: "ENG-05"
    verification:
      - kind: unit
        ref: "test/determinism/maze-determinism.test.js#genFloor: same seed produces a byte-identical floor for depths 1-5"
        status: pass
      - kind: unit
        ref: "test/determinism/maze-determinism.test.js#genFloor: two different seeds produce different floors (seed actually drives generation)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-09-07
status: complete
---

# Phase 1 Plan 4: Pure, RNG-Injected Maze Generation Engine Summary

**engine/maze.js ports genFloor/bfs/reveal from mazeworld.html into a pure module — every Math.random() site (recursive backtracker pick, loop-carve, feature shuffle, dark-blob pick, door shuffle/pick) now consumes an injected seeded rng in the prototype's exact call order, proven byte-identical for repeated same-seed runs across all five fixed-Gate floors.**

## Performance

- **Duration:** ~2 min (per commit timestamps 22:53:20 → 22:54:58)
- **Started:** 2026-09-07T22:53:20-04:00 (first task commit)
- **Completed:** 2026-09-07T22:54:58-04:00 (last task commit)
- **Tasks:** 2 completed (both executed as TDD: RED + GREEN for Task 1; test-only for Task 2, see Deviations)
- **Files modified:** 3 created (engine/maze.js, test/unit/maze.test.js, test/determinism/maze-determinism.test.js)

## Accomplishments

- Ported `genFloor(depth, rng)` line-for-line from `mazeworld.html` (lines 1167-1247): recursive backtracker with `rng.pick(opts)`, the two inline loop-carve `Math.random()` sites (lines 1190-1191) replaced by `rng.next()` calls in the exact same left-to-right evaluation order (floor-draw, then ±1-draw, then y's floor-draw — 3 rng.next() calls per iteration x 10 iterations), farthest-cell exit/gate via `bfs`, feature scatter (`nDots=9+depth`, 2 each of tele/chest/trap/climb/gorge) via `rng.shuffle(far)`, dark-zone blobs (depth>=2) via `rng.pick(open)`, and up to 3 one-way doors via `rng.shuffle(spots)`/`rng.pick(axis)` with the 4-cell minimum spacing.
- Preserved the fixed 5-floor Gate exactly: `depth >= 5 ? "gate" : "exit"`, unchanged from the prototype — verified for depths 1, 4, and 5.
- Ported `bfs(g, sx, sy)` verbatim (no RNG) — including its hardcoded `GW`/`GH` bounds check, which matches the prototype's own assumption that `bfs` is always called on the one 21x21 grid.
- Implemented `reveal(floor, radius=2)` — a pure square-block reveal. Discovered and corrected a factual error in the plan's `<read_first>` description of the prototype's reveal (it claimed a 4-neighbor mark; the actual source is a radius-based square reveal driven by darkness/skill/effect state); implemented per the true algorithm with radius as an explicit parameter since character skills/effects aren't part of this plan's engine surface (see Decisions).
- Proved same-seed determinism: `genFloor(depth, makeRng(seed))` run twice is `deepStrictEqual` for every depth 1-5, and diverges for two different seeds — the mechanical mitigation for threat T-01-04a (RNG-consumption-order drift).
- Full project test suite: 44/44 passing (13 new maze/determinism tests + 31 from plans 01-01/01-02/01-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Port genFloor + bfs to a pure, RNG-injected engine/maze.js** - TDD: RED `74735c6` (test), GREEN `deb3362` (feat) — reveal(floor,radius) bundled into the GREEN commit (see Deviations)
2. **Task 2: Port reveal + determinism proof** - `06a348e` (test) — reveal itself already delivered in Task 1's commit; this commit adds the standalone same-seed determinism proof

**Plan metadata:** committed via `docs(01-04): complete plan` (see final_commit step)

## Files Created/Modified

- `engine/maze.js` - `GW`/`GH` constants, `bfs(g,sx,sy)`, `genFloor(depth,rng)`, `reveal(floor,radius=2)` — pure, RNG-injected maze generation
- `test/unit/maze.test.js` - 13 tests: grid shape, exit/gate placement across depths, feature-count parity (seed 42, depths 1-5), purity guard (no Math.random/document/localStorage/window), bfs on a hand-built grid, reveal default/custom radius
- `test/determinism/maze-determinism.test.js` - 3 tests: same-seed byte-identical floors (depths 1-5), different-seed divergence, per-depth-seeded repeatability

## Decisions Made

- `reveal(floor, radius=2)` takes radius as an explicit parameter rather than computing it from character skills/effects (not yet extracted). Default `2` is provably correct at any floor's starting position, since `genFloor` always forces `g[1][1].dark = false`.
- Corrected the plan's inaccurate `<read_first>` description of `reveal()` (claimed 4-orthogonal-neighbor marking) against the true prototype source (radius-based square-block reveal) — CLAUDE.md mandates the prototype as canon, so the actual algorithm was ported, not the plan's mischaracterization.
- `reveal` was implemented in Task 1's GREEN commit alongside `genFloor`/`bfs` rather than deferred to Task 2, since it's a trivial two-line pure mutation and the test file already in progress covered it naturally; Task 2's commit carries only its distinct remaining deliverable (the determinism test file).
- Feature-count test expectations are locked to `genFloor(depth, makeRng(42))`'s actual computed output (run once, then asserted), not estimated — avoids a flaky/approximate assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's description of reveal() did not match the actual prototype source**
- **Found during:** Task 2 read_first (reading mazeworld.html lines 1281-1288 directly)
- **Issue:** The plan's `<read_first>` claimed reveal() "marks g[py][px].seen and the 4 orthogonal neighbors seen." The actual source (`mazeworld.html` lines 1281-1287) computes `r = ((g[py][px].dark && !skill("Night Vision")) ? 1 : 2) + eff("sight")` and reveals a `(2r+1)x(2r+1)` square around the player — a materially different shape and a dependency on character skill/effect state.
- **Fix:** Implemented `reveal(floor, radius=2)` per the true algorithm (square-block reveal), taking the darkness/skill/effect-derived radius as an explicit parameter since that state isn't part of this plan's engine surface. Documented the fidelity boundary in a code comment in `engine/maze.js` explaining why the default (2) is correct today and what a later plan must do to compute the real radius.
- **Files modified:** `engine/maze.js`, `test/unit/maze.test.js`
- **Verified:** `test/unit/maze.test.js`'s two reveal tests (default radius, custom radius) pass; no regression to the rest of the suite (44/44 green).
- **Committed in:** `deb3362` (Task 1 GREEN commit)

**2. [Process note, not a rule-classified deviation] reveal() delivered in Task 1's commit instead of Task 2's**
- **Found during:** Task 1 GREEN implementation
- **Rationale:** reveal is a two-line pure mutation with no RNG involvement and the test file being built for Task 1 already exercised genFloor/bfs comprehensively in one place; bundling reveal in avoided a redundant near-empty commit. Task 2's commit still delivers its own distinct artifact (the determinism test) as planned.
- **Impact:** None on scope or acceptance criteria — both plan artifacts (`engine/maze.js` with reveal exported, `test/determinism/maze-determinism.test.js`) exist exactly as specified.

---

**Total deviations:** 1 auto-fixed (Rule 1 — reveal's true algorithm vs. plan's inaccurate description) + 1 process note (task-commit boundary, no scope impact)
**Impact on plan:** The Rule 1 fix makes reveal() materially more faithful to the prototype than the plan's own literal instruction would have produced. No scope creep; no architectural changes.

## Issues Encountered

- Initial bfs hand-built-grid unit test had an arithmetic error in its expected branch distance (asserted `d[3][2] === 2`, actual correct value is `3` — three steps from `(1,1)` via `(1,2)` and `(1,3)` to the branch cell `(2,3)`). Caught immediately by the failing GREEN test run and corrected before committing; no impact on the shipped implementation, only the test's own hand-computed expectation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `engine/maze.js` (`genFloor`, `bfs`, `reveal`, `GW`, `GH`) is ready for plan 01-05 (`newRun`) to call `genFloor(1, rng)` to build a new run's first floor, and for plan 01-07 (movement/descend) to call `genFloor(depth, rng)` on each descent and `reveal(floor)` after each move.
- The same-seed determinism pattern established here (`assert.deepStrictEqual` across two `makeRng(seed)`-driven runs) is the template for proving determinism in every subsequent pure engine function this phase extracts.
- The reveal fidelity gap (radius depends on character skills/effects) is explicitly flagged in `engine/maze.js`'s doc comment for whichever future plan wires character/effects state into the engine — no action needed until that plan exists.
- No blockers for 01-05.

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 4 claimed files found on disk; all 3 claimed commit hashes (`74735c6`, `deb3362`, `06a348e`) found in git log. Full `node --test` suite: 44/44 passing.
