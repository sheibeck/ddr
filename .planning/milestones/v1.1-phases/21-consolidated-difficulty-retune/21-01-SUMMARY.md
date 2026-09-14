---
phase: 21-consolidated-difficulty-retune
plan: 01

subsystem: tooling
tags: [tuning-harness, bot-policy, readout, ledger, node-test, no-engine-change]

requires:
  - phase: 20-parley-balance-language-system
    provides: "the parley payout/attempt-cap/fluency rules the bot's D-15 parley tally reads, and the tune-difficulty.mjs shape this plan extended"
provides:
  - "tools/lib/tuning-bot.mjs — the one shared bot policy (D-05/D-06), tallies (D-07), and readout (D-08) module both tuning tools now import"
  - "--party / --max-actions / --explore-budget CLI flags on both tools"
  - "docs/DIFFICULTY-RETUNE.md — the BEFORE half of the Phase 21 ledger, frozen against the untouched bd0ba7c engine"
affects: [21-02, 21-03, 21-04, 21-05]

tech-stack:
  added: []
  patterns:
    - "Shared dev-tooling module under tools/lib/, imported by sibling CLI scripts instead of duplicated (D-23 precedent for future tuning tools)"
    - "Harness-only direct-engine-import bypass (forceParty), precedented by test/parity/harness/comparables.js#applyStartCombat"
    - "Backgrounded 200-seed readout with an EXIT= sentinel + bounded ≤30s polling, never a foreground wait (18-06/20-01/20-03 precedent)"

key-files:
  created:
    - tools/lib/tuning-bot.mjs
    - test/unit/tuning-bot.test.js
    - docs/DIFFICULTY-RETUNE.md
  modified:
    - tools/tune-difficulty.mjs
    - tools/tune-economy.mjs

key-decisions:
  - "findCastableAttackSpell adds an explicit cls === \"Magic User\" guard beyond the plan's literal D-05 wording — engine/derived.js#canCast has no class check of its own, so without the guard the bot would offer castSpell to a non-caster with a stray grimoire entry, contradicting D-05's own \"(Magic Users)\" scoping"
  - "Discovered and auto-fixed (Rule 1) during the BEFORE readout capture: parley()'s wilmsryVsMagical branch refuses without setting C.parleyTried (Phase 20 D-12, by design), so a bot that always prefers parley over flee below the flee threshold retried it forever against a fluency-2 Wilmsry vs a Magical foe, burning ~19700 of one run's 20000-action budget on a no-progress loop. Added ctx.parleyBlocked (set on parleyRefused, cleared on the next encounterStarted) so the bot falls through to flee for the rest of that encounter instead"
  - "The new Wilmsry/Magical regression case was folded into the existing D-06 caster-threshold test rather than added as a 12th test, keeping the module's test count at exactly 11/11 per the plan's own acceptance criteria"
  - "--party stays the opportunistic-vs-forced choice the plan locked (D-20): forceParty is the ONE harness-only write-path bypass, called only inside playRun behind opts.party, never through applyAction"

requirements-completed: [TUNE-02]

patterns-established:
  - "Tuning tools remain proxies, never CI gates: no readout number is asserted in test/unit/tuning-bot.test.js, and neither tool is wired into package.json scripts"

duration: 50min
completed: 2026-09-14
status: complete
---

# Phase 21 Plan 01: Bot Upgrade, Shared Module, BEFORE Readout Summary

**Extracted a shared `tools/lib/tuning-bot.mjs` policy/tally/readout module (cast/drink/camp/descend, caster-aware flee, D-07 ability tallies, D-08 reach/actions-per-floor/caster-rate readout, `--party` via a documented harness bypass), rewired both tuning tools onto it, fixed a bot-policy infinite-retry bug the BEFORE capture itself surfaced, and froze the BEFORE half of `docs/DIFFICULTY-RETUNE.md` against the untouched post-Phase-20 engine.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-14
- **Tasks:** 3 completed (plus one auto-fix pass found mid-Task-3)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `tools/lib/tuning-bot.mjs`: one shared module exporting `decideAction`, `playRun`, `forceParty`, `makeBotContext`, `observe`, `makeTallies`/`tallyEvents`, `reachTable`/`actionsPerFloorDist`/`casterRateByBand`/`abilitySummary`/`partySummary`, `sharedJson`/`printSharedReadout`, the BFS/hazard-routing helpers, `BOT_DEFAULTS`, `DEPTH_BANDS`, `REACH_FLOORS` — the bot now casts an attack spell (Magic Users with charges), drinks potions, camps, heads for the exit once a floor is cleared or the exploration budget is spent, raises its flee/parley threshold to 0.5 against any kit-bearing live foe, takes finds, declines every Joiner, and leaves stores.
- `test/unit/tuning-bot.test.js`: 11 synthetic-state tests pinning every D-05/D-06 branch (cast/no-charges/non-caster, potion/no-potion, camp/no-rations/Large-race, descend-when-cleared/budgeted, caster flee threshold, the Wilmsry-vs-Magical parley-retry regression), hazard routing (seen-hazard detour vs. no-detour vs. unseen-hazard), pending prompts, `forceParty` determinism, D-07 tally arithmetic, and purity (no state mutation, no `Math.random`/`Date.now`).
- `tools/tune-difficulty.mjs` and `tools/tune-economy.mjs` rewired onto the shared module — private `decideAction`/`nearestUnseenDir`/`canStep`/`MAX_ACTIONS`/`percentile`/`distribution` copies deleted, `canParley` import dropped (the module owns it now), `--party`/`--max-actions=N`/`--explore-budget=N` flags added alongside `--seeds`/`--json`, and the D-07/D-08 readout blocks printed/emitted in both text and `--json` output.
- Bug found and auto-fixed while capturing the readout (see Deviations): the bot's naive "always prefer parley over flee" policy could retry a structurally-refused parley forever; fixed with a one-field `ctx.parleyBlocked` guard.
- `docs/DIFFICULTY-RETUNE.md` created: scope/method (D-10/D-11), the D-09 targets table, the bot-parameter table, and three verbatim 200-seed BEFORE transcripts (tune-difficulty solo, tune-difficulty `--party`, tune-economy), all captured via backgrounded runs with `EXIT=` sentinels and bounded ≤30s polling against the confirmed-untouched `bd0ba7c` engine, plus the five 21-04/21-05 placeholder headings.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the shared bot module + 11 synthetic-state tests** - `d819c73` (feat)
2. **Task 2: Rewire tune-difficulty.mjs and tune-economy.mjs onto the shared module** - `2e89b76` (feat)
3. **Bugfix (found during Task 3's BEFORE capture): stop the parley-retry loop** - `f33af5f` (fix)
4. **Task 3: Capture the BEFORE readout into docs/DIFFICULTY-RETUNE.md** - `f228544` (docs)

_Note: no TDD tasks in this plan; the bugfix commit sits between Task 2 and Task 3 because the BEFORE capture itself is what surfaced the bug._

## Files Created/Modified
- `tools/lib/tuning-bot.mjs` - the shared bot policy/tally/readout module (Tasks 1, bugfix)
- `test/unit/tuning-bot.test.js` - 11 synthetic-state tests (Task 1, bugfix)
- `tools/tune-difficulty.mjs` - rewired onto the shared module, new CLI flags, D-07/D-08 readout blocks (Task 2)
- `tools/tune-economy.mjs` - same rewiring, gold tally kept local (Task 2)
- `docs/DIFFICULTY-RETUNE.md` - new, BEFORE half of the Phase 21 ledger (Task 3)

## Decisions Made
- `findCastableAttackSpell` scopes the cast policy to `cls === "Magic User"` explicitly — `canCast` itself has no class check, so this guard is required to honor D-05's own "(Magic Users)" wording rather than an accident of what the engine happens to permit.
- The Wilmsry/Magical parley-retry bugfix (see Deviations) lives in the bot module only — it does not touch `engine/combat.js`'s `parley()`, which behaves exactly as Phase 20's D-12 intended (a refusal correctly does not consume the one-attempt cap; the bot's own decision-making was the gap).
- `--party` uses the documented `forceParty` direct-import bypass (D-20's second option), not the opportunistic-Joiner approach — this matches the plan's locked decision and the `--party` readout's own framing as a separate distribution from the solo seed list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bot policy could retry a structurally-refused parley forever**
- **Found during:** Task 3 (capturing the BEFORE 200-seed readout)
- **Issue:** `engine/combat.js#parley()`'s `wilmsryVsMagical` branch pushes `parleyRefused` and returns WITHOUT ever setting `C.parleyTried` (Phase 20 D-12 — a refusal is deliberately not a spent attempt). `decideAction`'s combat branch always prefers `{ type: "parley" }` over `{ type: "flee" }` whenever `canParley(state)` is true and the wp ratio is below the flee threshold. For a fluency-2 Wilmsry vs. a Magical encounter, `canParley` stays true forever, so the bot re-picked parley every single turn for the rest of that fight — one seed's run consumed ~19,700 of its 20,000-action budget on this exact no-progress loop, wildly inflating that run's `parleyRefused` tally and skewing the `maxActionsHit` count.
- **Fix:** Added `ctx.parleyBlocked` to `makeBotContext`'s returned context; `observe()` sets it `true` on a `parleyRefused` event and clears it `false` on the next `encounterStarted`; `decideAction`'s flee/parley branch now checks `!ctx.parleyBlocked && canParley(state)` before choosing parley, falling through to flee otherwise.
- **Files modified:** `tools/lib/tuning-bot.mjs`, `test/unit/tuning-bot.test.js` (extended the existing D-06 test with the Wilmsry/Magical regression case rather than adding a 12th test)
- **Verification:** `node --test test/unit/tuning-bot.test.js` still 11/11; the solo BEFORE readout's `refused` count dropped from 19707 to 1 and `maxActionsHit` dropped from 11 to 10 runs after the fix; `npm test` 923/923; engine gate (`git diff --quiet bd0ba7c -- engine content src mazeworld.html`) held throughout — the fix touches only `tools/lib/tuning-bot.mjs`
- **Committed in:** `f33af5f`

**2. [Rule 2 - Missing Critical] findCastableAttackSpell scoped to Magic Users**
- **Found during:** Task 1 (writing the D-05 cast test)
- **Issue:** The plan's literal item-5 spec for `findCastableAttackSpell` omits a class check; `engine/derived.js#canCast` also has no class check (a Fighter with a stray "Freeze" entry in an otherwise-empty `grimoire` array would pass it), which would contradict D-05's own decision text scoping the cast policy to "Magic Users" and made the plan's own unit-test scenario ("a Fighter with the same grimoire → attack") unsatisfiable as literally written.
- **Fix:** Added an explicit `if (c.cls !== "Magic User") return null;` guard at the top of `findCastableAttackSpell`.
- **Files modified:** `tools/lib/tuning-bot.mjs`
- **Verification:** Task 1's synthetic test 3 (cast) passes exactly as the plan specifies, including the Fighter → attack case.
- **Committed in:** `d819c73` (part of Task 1)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical functionality)
**Impact on plan:** Both fixes were necessary for the bot to behave as D-05/D-06 actually intend; neither touches `engine/`, `content/`, `src/`, or `mazeworld.html` (confirmed by the engine gate holding at every checkpoint). No scope creep — the parley bugfix is scoped to `tools/lib/tuning-bot.mjs` only and required re-running (not re-designing) the three BEFORE readouts.

## Issues Encountered
The first capture of the three 200-seed BEFORE readouts (before the parley-retry fix) produced a wildly skewed solo-run `parleyRefused` count (19707) that made the transcript unusable as a BEFORE baseline. Diagnosed the root cause (see Deviations #1), fixed the bot module, re-verified `npm test` (923/923) and the full task-2 CLI/acceptance checks, then relaunched all three 200-seed readouts a second time in the background and transcribed the corrected output. The ledger's headline numbers and every transcript in `docs/DIFFICULTY-RETUNE.md` reflect this second, corrected capture only.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shared bot module, its CLI flags, and the frozen BEFORE ledger are ready for 21-02 (the engine-side `foeCap`/`foeBonus`/`foePower`/`abilityThreat` knobs) and 21-04 (the actual constants retune, which reuses this exact bot/parameters for the AFTER readout and change table).
- `docs/DIFFICULTY-RETUNE.md`'s BEFORE numbers confirm the phase's own premise: past floor 5, nothing currently scales (0% of runs reach floor 20+ in any of the three transcripts) — 21-02's combat-scaling knobs are the load-bearing next step.
- No blockers. The engine/content/src/mazeworld.html byte-identity gate against `bd0ba7c` held at every checkpoint in this plan (before launching each readout and after every commit).

---
*Phase: 21-consolidated-difficulty-retune*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created files found on disk (`tools/lib/tuning-bot.mjs`, `test/unit/tuning-bot.test.js`, `docs/DIFFICULTY-RETUNE.md`, this SUMMARY); all four task/fix commit hashes (`d819c73`, `2e89b76`, `f33af5f`, `f228544`) found in `git log --oneline --all`.
