---
phase: 01-engine-extraction-determinism
plan: 01
subsystem: testing
tags: [node-test, mulberry32, prng, es-modules, zero-deps]

# Dependency graph
requires: []
provides:
  - Zero-dependency ES-module project (`package.json`, `node --test`)
  - Full engine/content/test directory tree
  - Seeded, serializable mulberry32 PRNG (`engine/rng.js`: `mulberry32`, `makeRng`)
  - Dice-notation resolver (`engine/dice.js`: `rollDice`)
  - Live static guards for ENG-02 (no Math.random under engine/+content/) and ENG-03 (content is pure data)
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero runtime/test dependencies: node:test, node:assert/strict, node:vm only"
    - "RNG state as a single serializable 32-bit integer (mulberry32), not a re-seed+fast-forward counter"
    - "Content-as-data separation enforced by a filesystem-discovered, dynamic-import purity walker"
    - "Static source-scan guards (comment-stripped regex scan) as living tripwires, not one-time checks"

key-files:
  created:
    - package.json
    - .gitignore
    - engine/rng.js
    - engine/dice.js
    - test/unit/scaffold.test.js
    - test/unit/rng.test.js
    - test/determinism/rng-serialize.test.js
    - test/determinism/rng-no-math-random.test.js
    - test/determinism/content-is-pure-data.test.js
    - test/README.md
  modified: []

key-decisions:
  - "RNG state persists as the raw internal mulberry32 integer (getState/setState) rather than re-seeding + fast-forwarding, per 01-RESEARCH.md's simpler recommended option — avoids a separate rngCalls counter entirely."
  - "Math.random guard strips block comments (preserving line breaks so line numbers stay accurate) then strips from the first `//` to end of line per line, rather than a full tokenizer — sufficient for this codebase's actual source (no // inside string literals in engine/content) and verified against both a comment-only mention and a live violation fixture."
  - "Content-purity guard dynamically imports every content/*.js module and recursively walks exported values (arrays + plain objects) rather than hardcoding a file list, so new content tables are automatically covered as later plans add them."

patterns-established:
  - "Pattern 1 (content dice-closures -> plain notation) test-verified: rollDice(rng, {n,sides,bonus}) is the only place a dice-notation object becomes a number."
  - "Every engine RNG consumer must call makeRng(seed|state) rather than mulberry32 directly, to get d/pick/shuffle matching the prototype's exact formulas."

requirements-completed: [ENG-02, ENG-03, ENG-01]

coverage:
  - id: D1
    description: "Zero-dependency ES-module project scaffold: package.json (type:module, node --test script, empty dependencies), .gitignore, and the full engine/content/test directory tree"
    requirement: "ENG-01"
    verification:
      - kind: unit
        ref: "test/unit/scaffold.test.js#scaffold smoke: node --test runs on an otherwise-empty tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seeded, serializable mulberry32 PRNG (engine/rng.js: mulberry32, makeRng with next/d/pick/shuffle/getState/setState) matching the prototype's exact D()/pick()/shuffle() formulas"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/rng.test.js (7 assertions: determinism, d/pick/shuffle formula parity, getState/setState)"
        status: pass
      - kind: unit
        ref: "test/determinism/rng-serialize.test.js (2 assertions: cursor serialize/rehydrate, JSON round-trip)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dice-notation resolver engine/dice.js: rollDice(rng, {n,sides,bonus})"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/unit/rng.test.js#rollDice: sums n independent rng.d(sides) plus bonus"
        status: pass
      - kind: unit
        ref: "test/unit/rng.test.js#rollDice: {n:1,sides:6,bonus:0} equals rng.d(6) on an identically-seeded generator"
        status: pass
    human_judgment: false
  - id: D4
    description: "Static guard: no Math.random() on any non-comment line under engine/ or content/ (ENG-02 tripwire)"
    requirement: "ENG-02"
    verification:
      - kind: unit
        ref: "test/determinism/rng-no-math-random.test.js#no Math.random on any non-comment line under engine/ or content/"
        status: pass
    human_judgment: false
  - id: D5
    description: "Static guard: content/*.js exports contain no function-typed leaves (ENG-03 tripwire), discovered from disk not hardcoded"
    requirement: "ENG-03"
    verification:
      - kind: unit
        ref: "test/determinism/content-is-pure-data.test.js#content/*.js exports contain no function-typed leaves (pure data only)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-07
status: complete
---

# Phase 1 Plan 1: Scaffold + Seeded RNG + Determinism Guards Summary

**Zero-dependency Node ES-module project with a mulberry32 seeded PRNG (`engine/rng.js`), a dice-notation resolver (`engine/dice.js`), and two live static tripwires (no-Math.random, content-is-pure-data) that make ENG-02/ENG-03 mechanically checkable from the first commit.**

## Performance

- **Duration:** 3 min (per commit timestamps; wall-clock session time longer due to research/context reads)
- **Started:** 2026-09-07T22:05:37-04:00 (first task commit)
- **Completed:** 2026-09-07T22:08:19-04:00 (last task commit)
- **Tasks:** 3 completed (Task 2 executed as TDD: RED + GREEN commits)
- **Files modified:** 11 created (package.json, .gitignore, engine/rng.js, engine/dice.js, 5 test files, test/README.md, plus 5 `.gitkeep` placeholders for empty tree directories)

## Accomplishments
- Stood up a zero-runtime-dependency, zero-test-dependency ES-module project: `package.json` (`"type":"module"`, `"scripts.test":"node --test"`, empty `dependencies`), `.gitignore`, and the full `engine/content/test/{unit,determinism,roundtrip,parity/harness,parity/fixtures,fixtures}` tree.
- Implemented `mulberry32(seed)` and `makeRng(seedOrState)` in `engine/rng.js`, reproducing the prototype's exact `D()`/`pick()`/`shuffle()` formulas (`mazeworld.html` lines 489-490, 1265) bit-for-bit, with a single-integer serializable cursor (`getState()`/`setState()`).
- Implemented `rollDice(rng, {n,sides,bonus})` in `engine/dice.js` as the sole place a dice-notation object resolves to a number.
- Built and hand-verified two static ENG-02/ENG-03 tripwires: a Math.random source-scan guard (comment-stripping, file-discovery based) and a content-purity recursive function-leaf walker (dynamic-import, file-discovery based) — both confirmed to catch a real violation via a temporary fixture, then confirmed clean after fixture removal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold + directory tree + Node test-runner smoke** - `f8474b6` (chore)
2. **Task 2: Seeded PRNG (mulberry32) + dice-notation resolver, with determinism and serialize tests** - TDD: RED `7935a86` (test), GREEN `8cf3904` (feat) — no separate refactor commit needed, implementation was already clean
3. **Task 3: Static determinism + content-purity guards (ENG-02/ENG-03 tripwires)** - `50d746a` (test)

**Plan metadata:** committed via `docs(01-01): complete plan` (see final_commit step)

## Files Created/Modified
- `package.json` - ES-module project config, `node --test` script, zero dependencies
- `.gitignore` - node_modules/OS cruft
- `engine/rng.js` - `mulberry32(seed)`, `makeRng(seedOrState)` with next/d/pick/shuffle/getState/setState
- `engine/dice.js` - `rollDice(rng, {n,sides,bonus})`
- `test/unit/scaffold.test.js` - smoke test proving `node --test` exits 0 on an empty tree
- `test/unit/rng.test.js` - RNG determinism, d/pick/shuffle formula parity, getState/setState, rollDice (7 tests)
- `test/determinism/rng-serialize.test.js` - cursor serialize/rehydrate + JSON round-trip (2 tests)
- `test/determinism/rng-no-math-random.test.js` - ENG-02 static guard
- `test/determinism/content-is-pure-data.test.js` - ENG-03 static guard
- `test/README.md` - run commands and test-tier documentation
- `content/.gitkeep`, `test/roundtrip/.gitkeep`, `test/parity/harness/.gitkeep`, `test/parity/fixtures/.gitkeep`, `test/fixtures/.gitkeep` - track otherwise-empty directories in git

## Decisions Made
- RNG state persists as the raw mulberry32 integer directly (matches 01-RESEARCH.md's "simpler" documented option), avoiding a separate `rngCalls` fast-forward counter.
- The Math.random guard uses comment-stripping + regex line-scan (not a full JS tokenizer) — proven sufficient by testing it against `engine/rng.js` itself, whose docstring comments legitimately mention `Math.random()` multiple times, and against a live-violation fixture, both with correct results.
- The content-purity guard is vacuously green today (no `content/*.js` modules exist yet) per plan spec — this is intentional, not a stub; it activates automatically as 01-02+ adds content tables.

## Deviations from Plan

None - plan executed exactly as written. Task 2's TDD cycle needed no REFACTOR commit since the GREEN implementation was already clean (no cleanup required).

## TDD Gate Compliance

RED gate commit (`7935a86`, `test(01-01): ...`) exists before GREEN gate commit (`8cf3904`, `feat(01-01): ...`) — verified in git log. No REFACTOR commit was needed; not a gate violation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `engine/rng.js` and `engine/dice.js` are ready for every subsequent plan (01-02 through 01-10) to import — this is the one deterministic RNG primitive that replaces all `Math.random()` in the extracted engine.
- The two static guards will go live automatically as content tables (01-02+) and further engine modules land; no further setup needed.
- No blockers for 01-02 (content table extraction).

---
*Phase: 01-engine-extraction-determinism*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 10 claimed files found on disk; all 5 claimed commit hashes (`f8474b6`, `7935a86`, `8cf3904`, `50d746a`, `f4f37c4`) found in git log. Full `node --test` suite: 13/13 passing.
