---
phase: 74-roll-display-modifier-honesty
plan: 01
subsystem: engine
tags: [roll-high, to-hit, derived-functions, display-honesty, roll-02]

# Dependency graph
requires:
  - phase: 73-engine-roll-high-mirror
    provides: "The whole engine reads roll-high (rollCheck/atLeastFor/rollFields in engine/dice.js); toHit/foeToHitVs/foeToHitBreakdown return winning-face counts"
provides:
  - "engine/derived.js#targetStrikeFaces(c, t, faces) — the hero's five per-target to-hit terms (dozing/stupid floor, sp.toHit cap, sp.fast, magicOnly, daggerOnly), pure and exported"
  - "engine/derived.js#heroStrikeFacesVs(state, t) — the hero's normal (non-frenzy, non-ability) swing odds against t right now"
  - "engine/derived.js#foeSwingVsHero(state, f) — the foe f's swing odds and mods list against the hero right now (base + blind + Weaken cap + insult-last)"
  - "engine/combat.js#playerStrike/#pursuitStrike/#foeTurn (hero branch) now CALL these helpers instead of restating the chains inline — one engine source for both the roll and the display"
  - "test/unit/odds-helpers.test.js — 135 tests, including a hero-vs-target (68 cases) and a foe-vs-hero (60 cases: 40 foeTurn + 20 pursuit) equivalence matrix proving the helpers match the engine's real events"
affects: [74-04, 74-06, 77]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A display-driven extraction: a chain the engine already runs inline is lifted verbatim into a pure, exported derived.js function so a display surface can call the SAME function the engine rolls against, never a re-derived formula — the project's established precedent (classNeed, Phase 39; noCritFor, Phase 61), now extended to targetStrikeFaces/heroStrikeFacesVs/foeSwingVsHero"
    - "Equivalence-test pattern for a display-driven extraction: force every engine call to MISS by supplying a raw rng draw equal to the check die's side count (rollCheck mirrors r -> roll = dieN + 1 - r, so r = dieN always yields the worst possible roll, 1) — this makes the helper-vs-event assertion depend only on the `atLeast`/`mods` fields, with zero extra draws for a hit's damage/crit/kill cascade"

key-files:
  created:
    - test/unit/odds-helpers.test.js
  modified:
    - engine/derived.js
    - engine/combat.js

key-decisions:
  - "targetStrikeFaces/foeSwingVsHero are extracted as pure functions that take the SAME inputs the inline chains read (c/t for the hero side; state/f for the foe side) — no new state shape, no new stored field, so Task 2's call-site swap is a pure code-motion with zero behavioral risk"
  - "The equivalence test always forces a miss (raw draw = dieN) rather than scripting exact hit/miss outcomes per case — this lets one compact matrix (hero classes x target-trait cases x afraid) and (hero variants x modifier cases) cover every named case in the plan's <behavior> spec without hand-computing mirrored rolls for each combination"
  - "playerStrike's equivalence cases needed a filler rng tail beyond the one strike draw, discovered during Task 1: playerStrike always chains into afterPlayerAction, which runs foeTurn against the still-alive target (unless it was asleep/stupid-skipped that round) — a second draw the plan's <interfaces> section didn't call out explicitly. Fixed by appending a same-value filler tail (any unused entries are simply never popped) rather than hand-tracking which target cases skip the foe's turn"

requirements-completed: [ROLL-02]

coverage:
  - id: D1
    description: "Three pure helpers (targetStrikeFaces, heroStrikeFacesVs, foeSwingVsHero) added to engine/derived.js, matching the engine's existing inline chains across a hero-vs-target and foe-vs-hero equivalence matrix (135 tests, all passing) run against the engine as it stood before any call-site changed"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test test/unit/odds-helpers.test.js (135/135 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "engine/combat.js's playerStrike, pursuitStrike and foeTurn's hero branch now call the three helpers instead of restating the chains inline; byte-identical proof across the parity suite, the Phase 72 direction tests, the Phase 73 state pins/save, the roll-high guard's draw inventory and the whole npm test suite"
    requirement: "ROLL-02"
    verification:
      - kind: unit
        ref: "node --test \"test/parity/**/*.test.js\" test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js test/unit/roll-high-guard.test.js test/unit/feedback-payload.test.js test/unit/parley.test.js test/unit/afraid.test.js test/unit/ability-strike.test.js test/unit/odds-helpers.test.js (460/460 pass)"
        status: pass
      - kind: unit
        ref: "npm test (5887/5887 pass, 0 failures; plan-base count was 5752)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-25
status: complete
---

# Phase 74 Plan 01: Roll Display & Modifier Honesty — The Odds Helpers Summary

**Three pure helpers (targetStrikeFaces, heroStrikeFacesVs, foeSwingVsHero) lifted verbatim from playerStrike/pursuitStrike/foeTurn into engine/derived.js, with the engine's own call sites swapped over to them — a byte-identical extraction (zero moved fixtures, zero engine behaviour change) proven by a 135-test equivalence matrix and the full parity/direction/guard/npm-test gate.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-25
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **`engine/derived.js#targetStrikeFaces(c, t, faces)`** — the hero's five per-target to-hit terms (dozing/stupid floor at 5, `sp.toHit` cap, `sp.fast` minus-one-floor-1, `sp.magicOnly` zero-without-magic-weapon, `sp.daggerOnly` zero-without-dagger-or-magic-weapon), moved verbatim from `playerStrike`'s attack loop, same order, same floors, same comments (Phase 40 Stupidity, Phase 72 F3 DECLARED CANON DIVERGENCE).
- **`engine/derived.js#heroStrikeFacesVs(state, t)`** — `afraidNeed(state, targetStrikeFaces(state.c, t, toHit(state)))`: the hero's normal (non-frenzy, non-ability) swing odds against `t` right now, the exact number a display would show before a swing is chosen.
- **`engine/derived.js#foeSwingVsHero(state, f)`** — returns `{ faces, mods }` built exactly as `pursuitStrike`/`foeTurn`'s hero branch build them: base `foeToHitVs(state)`, `foeToHitBreakdown(state).mods` copied, then blind (override to 1), the combat's `foeToHitPenalty` cap, and the insult (+1, applied LAST per Phase 72 ROLL-01 (a)) — reads `state.combat` defensively, never throws on a missing combat.
- **`test/unit/odds-helpers.test.js`** — 135 tests: 6 direct unit tests of `targetStrikeFaces`'s five terms, 2 purity tests (deep-frozen inputs, no throw, deep-equal across two calls; a missing `state.combat`), a hero-vs-target equivalence matrix (3 classes x 11 target-trait cases x 2 afraid states = 66, plus 1 dark-tile Fighter case = 67 total, via a real `playerStrike`), a foeTurn hero-branch equivalence matrix (4 hero variants x 10 modifier cases = 40, via a real `foeTurn`), and a pursuit-strike equivalence matrix (4 hero variants x 5 modifier cases = 20, via `flee()` since `pursuitStrike` is module-private — mirrors `test/unit/parley.test.js`'s own pursuit-insult probe pattern).
- **`engine/combat.js` call-site swap (Task 2)** — `playerStrike`'s five inline per-target lines replaced by one call, `faces = targetStrikeFaces(c, t, faces)`, in the same position (after the frenzy-aware base, before Overhead Blow/`afraidNeed`). `pursuitStrike` and `foeTurn`'s hero branch replaced their base+breakdown-copy+blind/penalty/insult block with `const { faces, mods } = foeSwingVsHero(state, ...)`. `memberStrike`, `allyTurn`, `alliesTurn` and `foeTurn`'s member branch are untouched (Phase 74 does not display member odds; the member branch has its own Sidestep/Smoke terms between the penalty and the insult).
- **Byte-identical proof.** `node --test "test/parity/**/*.test.js" test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js test/unit/roll-high-guard.test.js test/unit/feedback-payload.test.js test/unit/parley.test.js test/unit/afraid.test.js test/unit/ability-strike.test.js test/unit/odds-helpers.test.js`: 460/460 pass. `git diff --quiet <plan-base>` against the parity fixtures, the prototype master, `comparables.js`, both Phase 72 direction-test files, the Phase 73 state-pin/save-compat/roll-high-fixture files, `feedback-payload.test.js` and `roll-high-guard.test.js`: clean (exit 0). `npm test`: **5887/5887 pass, 0 failures** (plan-base count was 5752).
- **Acceptance-criteria greps.** `grep -cE "^export function (targetStrikeFaces|heroStrikeFacesVs|foeSwingVsHero)\(" engine/derived.js` = 3. `grep -c "targetStrikeFaces(c, t, faces)" engine/combat.js` = 1; `grep -c "foeSwingVsHero(state," engine/combat.js` = 2. `awk '/^export function playerStrike/,/^}/' engine/combat.js | grep -v '^\s*//' | grep -c "sp.toHit !== undefined"` = 0 (the cap now lives only in the helper). `grep -c 'name: "penalty"' engine/combat.js` = 1 (the member branch keeps its own); `grep -c 'name: "penalty"' engine/derived.js` = 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: The three pure helpers, and the equivalence test against the engine as it stands** - `adbe151` (test)
2. **Task 2: The engine calls the helpers; byte-identical proof** - `a593be6` (feat)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/derived.js` - three new exported pure functions (`targetStrikeFaces`, `heroStrikeFacesVs`, `foeSwingVsHero`) inserted after `foeToHitBreakdown`; every existing function body untouched
- `engine/combat.js` - `playerStrike`, `pursuitStrike` and `foeTurn`'s hero branch now call the three helpers instead of restating the chains inline; import list extended
- `test/unit/odds-helpers.test.js` - new file: direct unit tests, purity tests, and the hero/foe equivalence matrices

## Decisions Made

- The equivalence-test miss-forcing trick (raw draw = dieN, always mirrors to roll 1, the worst possible roll) let one compact set of loops cover every named case in the plan's `<behavior>` spec without hand-computing a mirrored roll per combination, and without needing to control which branch (hit vs. miss) each case takes.
- `playerStrike`'s equivalence cases needed a filler rng tail (documented as a deviation below) because `playerStrike` always chains into `afterPlayerAction` -> `foeTurn`, which draws again for the still-alive target's own counter-swing unless that target was asleep/stupid-skipped this round — the plan's `<interfaces>` section describes `playerStrike`'s own draw but not this second, indirect one.
- Keep `foeToHitVs`/`foeToHitBreakdown` imported in `engine/combat.js` (unchanged) since `foeTurn`'s member branch and `allyTurn`/`memberStrike` still read them directly — only the hero-facing call sites moved to the new helpers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hero-equivalence test cases needed a filler rng tail for playerStrike's indirect foeTurn draw**
- **Found during:** Task 1 (writing the hero-vs-target equivalence matrix)
- **Issue:** The first draft supplied exactly one rng draw per `playerStrike` call (the strike die itself), matching the plan's `<interfaces>` description of `playerStrike`'s own draw. 55 of 68 hero-equivalence cases failed with `fakeRng: sequence exhausted at index 1` — `playerStrike` unconditionally calls `afterPlayerAction` at its end, which (with `allyTurn`/`alliesTurn` as zero-draw no-ops on this solo fixture) calls `foeTurn` against the still-alive target foe, drawing a second time for the foe's own counter-swing. The 13 cases that happened to pass were exactly the asleep/stupid target cases, where `foeTurn` skips that foe's turn entirely (no draw).
- **Fix:** Added a `FILL` constant (`new Array(8).fill(DIE_N)`) appended after the primary draw in every `playerStrike` call; unused filler entries are simply never popped by `fakeRng`, so the fix is uniform across every target-case branch regardless of whether the foe's own turn draws.
- **Files modified:** test/unit/odds-helpers.test.js
- **Verification:** `node --test test/unit/odds-helpers.test.js` — 135/135 pass (was 80/135 before the fix)
- **Committed in:** adbe151 (Task 1 commit — the fix landed before the task was committed, so no separate commit was needed)

---

**Total deviations:** 1 auto-fixed (1 bug — a test-only rng-sequencing gap, no engine or helper code affected)
**Impact on plan:** Test-only fix; no scope creep, no change to the shipped helpers or the engine call sites.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

None for this plan — this is a pure, display-invisible extraction (no engine outcome, event field, or UI surface changed). Nothing to add to the milestone's deferred Pixel 7 UAT batch.

## Next Phase Readiness

- `heroStrikeFacesVs`/`foeSwingVsHero` are ready for 74-04 (`src/browser/rollOdds.js`, the hero sheet/combat menu ranges) and 74-06 (the foe-details odds line and foe condition-chip effects) to call directly — no re-derived formula needed on the display side.
- No blockers. No known stubs or deferred items from this plan.
- Sibling plan 74-02 (src/browser/rollRange.js, the signed-modifier/range formatter) ran in parallel on a disjoint file set and is unaffected by this plan's engine changes.

---
*Phase: 74-roll-display-modifier-honesty*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/derived.js
- FOUND: engine/combat.js
- FOUND: test/unit/odds-helpers.test.js
- FOUND: .planning/phases/74-roll-display-modifier-honesty/74-01-SUMMARY.md
- FOUND: adbe151 (Task 1 commit)
- FOUND: a593be6 (Task 2 commit)
- FOUND: 8efd0de (SUMMARY commit)
