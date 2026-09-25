---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 02
subsystem: engine
tags: [difficulty-dials, economy, hp-growth, regression-tests, bot-readout]

# Dependency graph
requires:
  - phase: 54-four-band-retune-and-roster-decision
    provides: "dotHpFor(kind) — the flat DOT_HP_BASE table scaled once by HERO_HP_SCALE (USER RULING G); DIALS.LOOT_SCALE and lootFor(coin)"
provides:
  - "A verified-not-fixed pin (test/unit/hp-growth-linear.test.js) that Table-4 HP growth is linear at both identity and shipped dials"
  - "WILMST_CACHE_PER_DEPTH cut from 300 to 100 (engine/encounters.js), still through lootFor with no new rng draw"
  - "A before/after 200-seed bot readout of the cache cut's economy effect (tools/readouts/75-02-{before,after}.txt)"
affects: [75-13-fixture-inventory-and-retune-ledger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verify-then-pin: run the regression test against the CURRENT engine first; only touch engine code if a pin fails (RULES-01 needed zero engine changes)."
    - "Before/after 200-seed bot readouts from a detached worktree at the plan base, redirected into tools/readouts/{plan}-{before,after}.txt, for any dial-value change."

key-files:
  created:
    - test/unit/hp-growth-linear.test.js
    - tools/readouts/75-02-before.txt
    - tools/readouts/75-02-after.txt
  modified:
    - engine/encounters.js
    - test/unit/encounters.test.js
    - test/unit/newrun.test.js
    - test/unit/roll-high-state-pins.test.js

key-decisions:
  - "RULES-01 was VERIFIED, not fixed: every +HP source (the Table-4 dots, the faerie's base-HP rows, level-up gains, Strength's temporary boost) already adds a flat amount that never reads the hero's own current maxWP. No engine file changed."
  - "RULES-02: WILMST_CACHE_PER_DEPTH cut 300 -> 100, still through lootFor(WILMST_CACHE_PER_DEPTH * depth); only this one constant changed."
  - "Re-pinned test/unit/newrun.test.js's dev start-at-depth purse (300/depth -> 100/depth: +6000/+15000 became +2000/+5000) and test/unit/roll-high-state-pins.test.js's deep-8/deep-14 bot-sweep hashes (verified by a side-by-side state dump that ONLY c.gold moved, confirming the divergence is the declared economy cut, not a check-site-flip bug)."

requirements-completed: [RULES-01, RULES-02]

coverage:
  - id: D1
    description: "Table-4 HP growth (the toll and the '+25 HP' pull), the faerie's base-HP rows, a level-up gain, and Strength's temporary boost are all linear (flat), never compounding on the hero's own current maxWP — verified at both identity and shipped (HERO_HP_SCALE 1.25) dials."
    requirement: RULES-01
    verification:
      - kind: unit
        ref: "test/unit/hp-growth-linear.test.js (13 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/encounters.test.js#tableFour ±HP dots are DOT_HP_BASE canon flats scaled by HERO_HP_SCALE"
        status: pass
    human_judgment: true
    rationale: "The 75-VERIFICATION.md human-check asks a Pixel 7 device round to pull '+25 HP' twice and confirm two equal steps by eye — deferred to the milestone-close UAT batch per this project's Deferred UAT protocol, not run by this executor."
  - id: D2
    description: "The red-dot wilmst cache pays 100 x depth (was 300 x depth), still through lootFor with no new rng draw; the kill purse, chests, the faerie's gold, and LOOT_SCALE are untouched; zero parity fixtures moved."
    requirement: RULES-02
    verification:
      - kind: unit
        ref: "test/unit/encounters.test.js#the 'wilmst cache' row pays a depth-scaled amount (identity, shipped, and two-caches idempotency cases)"
        status: pass
      - kind: unit
        ref: "test/unit/class-mitigation.test.js (LOOT_SCALE ratio case, unmodified — still relative, not hardcoded)"
        status: pass
      - kind: unit
        ref: "test/unit/newrun.test.js#D-13 dev start-at-depth purse pins (+2000 at startDepth 20, +5000 at startDepth 50)"
        status: pass
      - kind: unit
        ref: "test/unit/roll-high-state-pins.test.js#roll-high baseline pin: deep-8, deep-14"
        status: pass
      - kind: integration
        ref: 'node --test "test/parity/**/*.test.js" (53/53, zero fixtures moved)'
        status: pass
    human_judgment: true
    rationale: "The 75-VERIFICATION.md human-check asks a Pixel 7 device round to confirm a floors-1-3 red-dot cache pays less than a store-tier reset — deferred to the milestone-close UAT batch per this project's Deferred UAT protocol, not run by this executor."

duration: 40min
completed: 2026-09-25
status: complete
---

# Phase 75 Plan 02: RULES-01 verify-and-pin + RULES-02 wilmst cache cut Summary

**Confirmed Table-4 HP growth is already linear at every +HP source (no engine change), then cut the red-dot wilmst cache from 300x depth to 100x depth through the existing lootFor path, with zero moved parity fixtures.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-25T19:49:00Z
- **Completed:** 2026-09-25T20:29:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (plus 2 new readout files, 1 new test file)

## Accomplishments

- **RULES-01 (verify, then pin):** Wrote `test/unit/hp-growth-linear.test.js` (13 tests) covering the boundary (0/1/2/3 "+25 HP" pulls), pool-independence (the toll from a 40- and a 392-maxWP hero), ordering, adjacency, the empty/death case, dotHpFor's precision, the faerie's flat `+d20`/`-d10` base-HP rows, a level-up's flat gain independent of prior pulls, and Strength's non-doubling re-cast plus its one-step survival through `newDay`'s boost reset — all at both identity and shipped (HERO_HP_SCALE 1.25) dials. Every pin passed against the unmodified engine: `engine/encounters.js`'s "+25 HP" row already reads `c.maxWP += dotHpFor("large")` (flat, never reading `c.maxWP`), and `engine/difficulty.js#dotHpFor` already scales the canon `DOT_HP_BASE` table once by `HERO_HP_SCALE`. **No engine file was touched.**
- **RULES-02 (the cache cut):** `WILMST_CACHE_PER_DEPTH` 300 -> 100 in `engine/encounters.js`, with an updated ECON-09 comment paragraph naming the RULES-02 rationale. Still paid through `lootFor(WILMST_CACHE_PER_DEPTH * state.floor.depth)`, no new rng draw. Only this one constant changed — `engine/difficulty.js`, `engine/state.js`, and `engine/items.js` are byte-identical to the plan base (measured by `git diff`).
- **Measured, zero moved fixtures:** `node --test "test/parity/**/*.test.js"` is 53/53 green, and `git diff --quiet <plan-base> -- test/parity/fixtures test/parity/prototype-master.js.txt` exits 0 — matching the planner's exposure scan exactly (the encounters#tablefour parity scenario, seed 3, rolls the "+25 HP" row, never the cache).
- **Before/after 200-seed bot readouts** committed to `tools/readouts/75-02-{before,after}.txt`: the survival curve is unchanged (death-depth p50 stays 7; reach >=5/>=10/>=20 stays 80.6%/24.6%/1.1%), while gold-on-hand drops measurably by floor (L1 112.78 -> 107.98, L5 919.24 -> 807.23, L10 3325.20 -> 2877.86, L20 11584.00 -> 9664.00) — a pure economy lever, exactly as designed.
- `npm test`: 6001/6001 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Start the BEFORE readout, then pin Table-4 HP growth as linear (RULES-01)** - `ea49dc0` (test)
2. **Task 2: Cut the wilmst cache to 100 x depth (RULES-02), measure the fixtures, take the AFTER readout** - `ae14da9` (feat) + `875a989` (docs: the before/after readout files)

**Plan metadata:** (this commit, made by the orchestrator after wave close)

## Files Created/Modified

- `test/unit/hp-growth-linear.test.js` - New RULES-01 regression pin (13 tests), identity + shipped dials
- `engine/encounters.js` - `WILMST_CACHE_PER_DEPTH` 300 -> 100, ECON-09 comment updated
- `test/unit/encounters.test.js` - Re-pinned the cache cases (100/700 identity, 80/1600 shipped, two-caches idempotency)
- `test/unit/newrun.test.js` - Re-pinned the dev start-at-depth purse (300/depth -> 100/depth)
- `test/unit/roll-high-state-pins.test.js` - Re-pinned the deep-8/deep-14 bot-sweep hashes, with a header note documenting the side-by-side state-dump verification
- `tools/readouts/75-02-before.txt` / `tools/readouts/75-02-after.txt` - The 200-seed bot readouts

## Decisions Made

- RULES-01 required no engine change — the compounding bug the user's todo described (a Pixel 7 run showing a 140-hp "-15 HP" toll on floor 6) was already fixed by Phase 54's USER RULING G (`dotHpFor` reads the flat `DOT_HP_BASE` table, never the hero's own maxWP). This plan's job was to PIN that fact with a regression test, which it did.
- RULES-02 landed as a single-constant change per the CONTEXT's locked decision, with no other purse touched (kill purse, chests, faerie gold, and `LOOT_SCALE` are all untouched).
- Re-pinned `test/unit/newrun.test.js` and `test/unit/roll-high-state-pins.test.js` even though neither file is in this plan's `files_modified` frontmatter list, because `WILMST_CACHE_PER_DEPTH`'s cut is a direct, necessary consequence of the declared RULES-02 change and both files hardcode the old 300/depth constant — leaving them unrepinned would have left `npm test` red. See "Deviations from Plan" below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, direct consequence of the plan's own edit] Re-pinned `test/unit/newrun.test.js`'s dev start-at-depth purse assertions**
- **Found during:** Task 2 (after cutting `WILMST_CACHE_PER_DEPTH`, before running `npm test`)
- **Issue:** `newrun.test.js`'s "D-13" tests hardcoded the OLD 300/depth constant (`+6000` at startDepth 20, `+15000` at startDepth 50). These are not parity fixtures — they're direct hardcoded pins of the dev-only start-at-depth purse, which the plan's own interfaces section confirms reads `WILMST_CACHE_PER_DEPTH` and "follows the cut."
- **Fix:** Updated both pins to the new 100/depth amounts (`+2000` / `+5000`), with an inline comment naming RULES-02 and the old/new constant.
- **Files modified:** test/unit/newrun.test.js
- **Verification:** `node --test test/unit/newrun.test.js` green; full `npm test` green afterward.
- **Committed in:** ae14da9 (Task 2 commit)

**2. [Rule 1 - Bug, direct consequence of the plan's own edit] Re-pinned `test/unit/roll-high-state-pins.test.js`'s deep-8/deep-14 bot-sweep hashes**
- **Found during:** Task 2 (`npm test` surfaced 2 failures after the cache cut)
- **Issue:** This Phase 73 baseline-hash harness's own header warns "a moved hash means a check site was flipped wrong: FIX THE SITE, never re-pin" — a strong signal to investigate before re-pinning. `deep-8`/`deep-14` are 300-action bot-sweep runs from a deep start, and both cross a "wilmst cache" `tableFour` row within their scripted actions, so their final `c.gold` (and the state hash covering it) moved.
- **Fix:** Before re-pinning, ran a side-by-side dump of both engine builds (the plan-base worktree vs. this worktree) for both labels, comparing `depth`/`dead`/`wp`/`maxWP`/`sp`/`level` in addition to `gold`. Every field was byte-identical EXCEPT `c.gold` (deep-8: 2585 -> 985; deep-14: 5711 -> 2911), confirming the divergence is exactly the declared RULES-02 economy cut, not an outcome-flip bug. Regenerated the two hashes via `node tools/roll-high-baseline.mjs pins` and added a comment to the pinned table documenting the verification method (the file header's own escape hatch: "regenerate... only if a plan deliberately changes outcomes and declares why").
- **Files modified:** test/unit/roll-high-state-pins.test.js
- **Verification:** `node --test test/unit/roll-high-state-pins.test.js` green (9/9); full `npm test` green afterward (6001/6001).
- **Committed in:** ae14da9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — direct, necessary re-pins caused by this plan's own declared constant change, outside the plan's stated `files_modified` list but required to keep `npm test` green).
**Impact on plan:** Both re-pins are mechanical consequences of the single WILMST_CACHE_PER_DEPTH edit, verified with independent state dumps before touching the hash-based pin (not a blind re-pin). No scope creep — no other engine or test behavior was touched.

## Issues Encountered

- The first BEFORE-readout attempt failed because `tools/readouts/` did not yet exist in this worktree and the shell redirect target used a Windows-style path inside Git Bash — fixed by creating the directory and using a POSIX-style (`/c/...`) redirect target for the background command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RULES-01 is pinned and closed; no further HP-growth work needed for Phase 75.
- RULES-02's economy cut is landed, measured, and readout-recorded; 75-13 will fold this plan's readout headline into `docs/DIFFICULTY-RETUNE.md`'s consolidated ledger (not this plan's job).
- The Pixel 7 human-check items for both RULES-01 and RULES-02 (listed in `<verification><human-check>`) are deferred to the milestone-close UAT batch per this project's standing Deferred UAT protocol.

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: test/unit/hp-growth-linear.test.js
- FOUND: tools/readouts/75-02-before.txt
- FOUND: tools/readouts/75-02-after.txt
- FOUND commit: ea49dc0 (test: RULES-01 pin)
- FOUND commit: ae14da9 (feat: RULES-02 cache cut)
- FOUND commit: 875a989 (docs: before/after readouts)
