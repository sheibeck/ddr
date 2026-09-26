---
phase: 75.3-deep-floor-encounter-scaling
plan: 06
type: execute
wave: 5
depends_on:
  - 75.3-02
  - 75.3-05
files_modified:
  - tools/lib/tail-score.mjs
  - test/unit/tail-score.test.js
  - engine/difficulty.js
  - tools/lib/fit-score.mjs
  - test/difficulty/difficulty.test.js
  - test/unit/combat-scaling.test.js
  - test/unit/deep-curve.test.js
  - test/unit/control-at-depth.test.js
  - test/unit/roll-high-state-pins.test.js
  - .planning/phases/75.3-deep-floor-encounter-scaling/fit/best.json
  - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-start.json
  - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl
  - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-stdout.txt
  - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json
autonomous: false
requirements:
  - RULES-17
  - RULES-18
must_haves:
  truths:
    - "The objective is the user's ruling of 2026-09-25 (75.3-CONTEXT 'Design rulings after planning'), carried by TAIL_TARGETS from 75.3-02: fresh start (1,000 seeds) reaching floor 20 at 1.0% or less, floor 21 or deeper under 0.5%, floor 30 in at most 1 run in 1,000; the floor-12 start reaching floor 20 at 5% or less; the floor-20 start gaining a median of 2 floors or fewer and reaching floor 30 at 1% or less; the floor-30 start gaining a median of 0 floors with p90 of 1 or fewer; the Freeze/Weaken/Doze rotation Sorcerer never outlasting the fair bot from the same depth"
    - "The tail values come from 200-seed (and 1,000-seed fresh) readouts under the checkpointed fit protocol: the searched coordinates are TAIL_SEARCH_PLAN (FOE_HP_SCALE.perDepthAfter, FOE_HIT_SCALE.perDepthAfter, FOE_ELITE.hpPerRank, CONTROL_AT_DEPTH.resistPerDepth); every other dial is held; the user-ruled values (FOE_COUNT_DEPTH, both kneeDepth 12, CONTROL_AT_DEPTH.holdRounds 3) are never searched"
    - "Floors 1-12 are not refitted and are untouched by every candidate (the tail dials act only from floor 13); the fresh slice's median death depth is reported against the floor 5-7 average on every row that measured it, and a value outside 5-7 is flagged, never compensated"
    - "The sweep runs in blocks of 10 evaluations against one resumable log (`--budget` = logged rows + 10, stdout appended with `>>`, the fresh 1,000-seed slice gated on the slice targets); after each block it is classified per USER RULING F: a failure pattern (feasible rate below 40%, best score improved by less than 10% over the block, or one constraint rejecting at least 6 of 10) stops the sweep and hands a `checkpoint:decision` back to the orchestrator with the per-target curve table and an ETA; a converging sweep continues to a PASS or a budget of 40"
    - "Search-parameter adjustments made on resume (steps, bounds, start point, block size, coordinate order, promoting a held non-ruled dial to a coordinate) are the orchestrator's and are recorded as ruling-F rows for 75.3-07; a changed target, a changed rule, a new dial or a ruled value is the user's and is not made here"
    - "On a PASS, or a converged best at the budget, the best row's four searched values are locked into engine/difficulty.js's DIALS with a 'Fitted (Phase 75.3 tail sweep #n, score s, verdict v)' JSDoc line, copied into the 75.3 overlay best.json and fit/tail-best.json, and every test that pinned a start value is re-pinned to the locked value with a RULES-17 / RULES-18 sweep note; a best that is not a PASS is locked only with a 'Flag for the user' paragraph naming the missed targets"
    - statement: "npm test is green at the lock commit, and the parity suite does not move (every fixture fight is on floor 1)"
      verification: backstop
  artifacts:
    - path: .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl
      provides: "every tail evaluation, one JSON row each, resumable"
    - path: .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json
      provides: "the locked tail dial values"
    - path: engine/difficulty.js
      provides: "the fitted perDepthAfter values, FOE_ELITE.hpPerRank and resistPerDepth"
      contains: "Phase 75.3 tail sweep"
  key_links:
    - from: engine/difficulty.js (DIALS)
      to: .planning/phases/75.3-deep-floor-encounter-scaling/fit/best.json
      via: "the DIALS-equals-merge test"
      pattern: "perDepthAfter"
    - from: tools/fit-difficulty.mjs --objective=tail
      to: .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl
      via: "the resumable log"
      pattern: "tail-log"
  prohibitions:
    - statement: "MUST NOT change the user's tail targets, search a user-ruled value (FOE_COUNT_DEPTH, the knee at floor 12, holdRounds 3), or change an engine rule during the sweep; those go back to the user (the checkpointed fit protocol: search parameters are the orchestrator's, engine changes are the user's)"
      requirement_id: RULES-17
      category: transparency
      status: unverified
      flagged: true
    - statement: "MUST NOT fit the natural 200-seed run's floors 13-20 rows (about 30 runs, noise), and MUST NOT retune floors 1-12 to hold the average run on floors 5-7; the tail is measured on the ruled slices and the average is reported"
      requirement_id: RULES-17
      category: transparency
      status: unverified
      flagged: true
    - statement: "MUST NOT report a PASS the log does not show: a locked best that missed any ruled target is written up as a miss with a 'Flag for the user' paragraph"
      requirement_id: RULES-18
      category: transparency
      status: unverified
      flagged: true
---

<objective>
Set the deep-floor slopes, the elite HP step and the control resistance from readouts against the user's ruled targets, under the checkpointed fit protocol. First, evaluate the shipped start values. Then walk the four tail dials in blocks of 10: stop and hand back a decision on a failure pattern, continue while converging, and lock the result.

Purpose: 75.3-CONTEXT (RULES-17: "Values come from 200-seed readouts (checkpointed fit protocol)"; the user's 2026-09-25 tail ruling: "Living past floor 20 should be exceedingly rare. 20 is the unicorn run. Player getting to depth 30 should basically never happen") and the project's checkpointed-fit rule (blocks of 10, stop on a failure pattern, the orchestrator adjusts search parameters, engine changes go to the user).

Output: the START row, the sweep log and stdout, the locked values in DIALS and the overlay, and the re-pinned tests.
</objective>

## Artifacts this phase produces

(Phase-wide list. **This plan** marks what 75.3-06 creates or changes.)

- 75.3-01: FOE_COUNT_DEPTH and the depth-aware count; readouts
- 75.3-02: the `controlRotation` option and flags; `tools/lib/tail-score.mjs` with the ruled TAIL_TARGETS; `fit-difficulty.mjs --objective=tail` and `--fresh`; the phase BEFORE deep readouts and `fit/tail-before.jsonl`
- 75.3-03: the knee dials and elites; readouts
- 75.3-04: CONTROL_AT_DEPTH, the resist check, held foes, the combat.js sites, events and chips
- 75.3-05: the hero spells and items at depth, honest texts, the bot's Freeze at depth; rotation readouts
- **This plan (75.3-06):** `fit/tail-start.json`, `fit/tail-log.jsonl`, `fit/tail-stdout.txt`, `fit/tail-best.json`; the TAIL_SEARCH_PLAN resolution test; the locked FOE_HP_SCALE.perDepthAfter, FOE_HIT_SCALE.perDepthAfter, FOE_ELITE.hpPerRank and CONTROL_AT_DEPTH.resistPerDepth in DIALS and the 75.3 overlay; the re-pinned tests
- 75.3-07: final readouts and verdicts against the ruled targets, DIFFICULTY-RETUNE.md H2 (including this sweep's record and ruling-F rows), ROLL-LEDGER audit and guard, FIXTURE-INVENTORY close, voice sample, gates

## Flagged assumptions (surfaced, not silently decided)

- **Why `autonomous: false`.** The objective is ruled, so no pause is planned before the search; the plan is non-autonomous only because a failure pattern must be handed back mid-sweep.
- **The targets may be out of reach of four coordinates.** "Depth 30 basically never" may need more than the knee slopes, the elite HP step and the resistance, for example if ROUND_DAMAGE_CEILING flattens the hit slope. That shows up as a failure pattern and is handed back; the orchestrator may widen bounds or promote a held, non-ruled dial (a ruling-F row); anything that changes a rule goes to the user.
- **Evaluation cost.** The deep and build slices take roughly 10-20 minutes per evaluation on this machine; the 1,000-seed fresh slice (30-75 minutes) runs only for candidates that meet every slice target. Each block runs in the background under a Monitor, with an honest ETA at every hand-back.

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/75.3-deep-floor-encounter-scaling/75.3-CONTEXT.md
@.planning/phases/75.3-deep-floor-encounter-scaling/75.3-01-SUMMARY.md
@.planning/phases/75.3-deep-floor-encounter-scaling/75.3-02-SUMMARY.md
@.planning/phases/75.3-deep-floor-encounter-scaling/75.3-03-SUMMARY.md
@.planning/phases/75.3-deep-floor-encounter-scaling/75.3-05-SUMMARY.md

<interfaces>
- tools/lib/tail-score.mjs (75.3-02): TAIL_SLICES (fresh 1,000; deep12/20/30/40 200; rot20/30/40 40; troll20 40 report-only), TAIL_TARGETS (the ruled numbers), summarizeSlice, scoreTail (lexicographic: slice targets, then fresh targets; the rotation constraint rejects), TAIL_SEARCH_PLAN (four coordinates), tailEvalRow, formatTailEvalLine. tools/fit-difficulty.mjs: `--objective=tail`, `--fresh=gate|always`, `--dials` (one evaluation) or `--search --start=<json> --budget=N --log=<jsonl> --out=<json>`; a resumed search replays logged rows by evaluation number and continues the same walk (tools/lib/fit-resume.mjs); runSearch stops at the first PASS with constraints.ok.
- Shipped start values: FOE_HP_SCALE.perDepthAfter 0.03 and FOE_HIT_SCALE.perDepthAfter 0.02 (75.3-03), FOE_ELITE { maxRank 10, hpPerRank 0.1, hitPerRank 0.05 } (75.3-03), CONTROL_AT_DEPTH { kneeDepth 12, resistPerDepth 1, resistCap 15, holdRounds 3 } (75.3-04). The 75.3 overlay `.planning/phases/75.3-deep-floor-encounter-scaling/fit/best.json` holds whole top-level dial objects; test/difficulty/difficulty.test.js asserts DIALS equals identity merged with the Phase 54 best and this overlay.
- Tests that pin shipped values of the searched dials: test/difficulty/difficulty.test.js (the fitted depth capture for depths 13+), test/unit/combat-scaling.test.js (the DIALS FOE_HIT_SCALE / FOE_HP_SCALE pin), literal-at-shipped-dials expectations in test/unit/deep-curve.test.js and test/unit/control-at-depth.test.js; tools/lib/fit-score.mjs HELD_DIALS rows carry start values.
- Project memory "checkpointed fit protocol": blocks of 10; USER RULING F's failure pattern; a Monitor printing each new log line; the orchestrator adjusts search parameters (ruling-F rows), engine changes go to the user; an honest ETA and a curve table (target / best / gap) at every hand-back.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: The start file, the resolution test, and the START evaluation</name>
  <files>test/unit/tail-score.test.js, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-start.json, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-stdout.txt</files>
  <read_first>
    - tools/lib/tail-score.mjs and tools/fit-difficulty.mjs (the tail objective and `--fresh`)
    - engine/difficulty.js (the shipped FOE_HP_SCALE, FOE_HIT_SCALE, FOE_ELITE, CONTROL_AT_DEPTH)
    - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-before.jsonl and 75.3-02-SUMMARY.md
  </read_first>
  <behavior>
    - Every TAIL_SEARCH_PLAN path resolves against DIALS to a number within the coordinate's [lo, hi].
    - No TAIL_SEARCH_PLAN path is a user-ruled value (FOE_COUNT_DEPTH, a kneeDepth, CONTROL_AT_DEPTH.holdRounds).
    - tail-start.json holds exactly the four whole top-level dial objects FOE_HP_SCALE, FOE_HIT_SCALE, FOE_ELITE and CONTROL_AT_DEPTH, equal to DIALS's.
  </behavior>
  <action>
1. Confirm 75.3-05's SUMMARY exists. Record the plan base.
2. Add the two resolution tests to test/unit/tail-score.test.js (import DIALS read-only; the one engine import that test file takes).
3. Write `.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-start.json` from DIALS (the four whole objects).
4. With run_in_background: `node tools/fit-difficulty.mjs --search --objective=tail --fresh=gate --start=.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-start.json --budget=1 --workers=4 --log=.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl --out=.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json >> .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-stdout.txt`; watch it with a Monitor and wait. This is row #1 (START) of the walk Task 2 continues.
5. Commit. In the SUMMARY's working notes build the curve table used at every hand-back: per ruled target, the BEFORE value (tail-before.jsonl), the START value (row #1), and the gap; the fresh median death depth; the rotation pairs; an ETA per block of 10 from row #1's elapsedMs.
  </action>
  <verify>
    <automated>node --test test/unit/tail-score.test.js && node -e "const fs=require('fs');const rows=fs.readFileSync('.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse).filter(r=>typeof r.n==='number');process.exit(rows.length>=1&&rows[0].n===1?0:1)"</automated>
  </verify>
  <acceptance_criteria>
    - `node -e "const s=require('./.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-start.json');process.exit(Object.keys(s).sort().join()==='CONTROL_AT_DEPTH,FOE_ELITE,FOE_HIT_SCALE,FOE_HP_SCALE'?0:1)"` exits 0.
    - tail-log.jsonl holds row #1 with `score`, `verdict`, `summaries` and `freshMeasured`.
    - test/unit/tail-score.test.js passes.
  </acceptance_criteria>
  <done>The shipped start values are scored against the ruled targets and set beside the phase BEFORE; the walk can resume from row #1.</done>
</task>

<task type="auto">
  <name>Task 2: The checkpointed sweep (hands back on a failure pattern)</name>
  <files>tools/lib/tail-score.mjs, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-stdout.txt, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json</files>
  <read_first>
    - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl and tail-stdout.txt
    - Task 1's curve table
    - tools/lib/tail-score.mjs (TAIL_SEARCH_PLAN, for any orchestrator-approved search-parameter adjustment)
  </read_first>
  <action>
1. If row #1 is already a PASS with constraints.ok, skip to Task 3.
2. Run a block: re-run Task 1's command with `--budget` = logged rows + 10 (same `--start`, `--log`, `--out`, `--fresh=gate`, stdout appended with `>>`), in the background, with a Monitor printing each new log line. Commit the log and stdout when the block ends.
3. Classify the block per USER RULING F:
   - A failure pattern (feasible rate under 40%, best score improved by less than 10% over the block, or one constraint rejecting at least 6 of 10): stop and hand back to the orchestrator as a `checkpoint:decision` (return `## CHECKPOINT REACHED`, type decision) holding the per-target curve table (target / best / gap for every ruled target and the rotation pairs), the rejections by reason, the ETA per further block, and 2-3 proposed search-parameter adjustments (for example a wider bound, a coordinate order change, a larger step, promoting a held non-ruled dial such as FOE_ELITE.hitPerRank). Resume-signal: the orchestrator's chosen adjustment, or "stop". On resume, apply a search-parameter adjustment (edit TAIL_SEARCH_PLAN in tools/lib/tail-score.mjs if needed, then record it as a ruling-F row in the SUMMARY) and continue in the same log; a target, rule or ruled-value change is applied only with the user's explicit answer relayed by the orchestrator.
   - Converging (best improving): run the next block, up to a PASS with constraints.ok or a budget of 40.
4. When the walk ends (PASS, budget, or the orchestrator's "stop"), record the stop reason and the best row in the SUMMARY and continue to Task 3.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const rows=fs.readFileSync('.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-log.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse).filter(r=>typeof r.n==='number');process.exit(rows.length>=1&&fs.existsSync('.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json')?0:1)"</automated>
  </verify>
  <acceptance_criteria>
    - tail-log.jsonl holds every evaluation of the walk in order, and tail-best.json holds the best row's dials.
    - Every block's classification (and any hand-back with its decision) is written in the SUMMARY with the block's evaluation numbers.
    - The walk ended on a PASS, on a budget of 40 while converging, or on an orchestrator "stop"; the SUMMARY names which.
  </acceptance_criteria>
  <done>The tail dials were walked under the checkpointed protocol against the ruled targets, with every block classified and every hand-back resolved.</done>
</task>

<task type="auto">
  <name>Task 3: Lock the values and re-pin</name>
  <files>engine/difficulty.js, tools/lib/fit-score.mjs, test/difficulty/difficulty.test.js, test/unit/combat-scaling.test.js, test/unit/deep-curve.test.js, test/unit/control-at-depth.test.js, test/unit/roll-high-state-pins.test.js, .planning/phases/75.3-deep-floor-encounter-scaling/fit/best.json, .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json</files>
  <read_first>
    - .planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json and the best row in tail-log.jsonl
    - engine/difficulty.js (the four searched dials' JSDocs)
    - the tests listed in interfaces
  </read_first>
  <action>
1. Write the best row's four values into engine/difficulty.js's DIALS (FOE_HP_SCALE.perDepthAfter, FOE_HIT_SCALE.perDepthAfter, FOE_ELITE.hpPerRank, CONTROL_AT_DEPTH.resistPerDepth), each JSDoc gaining "Fitted (Phase 75.3 tail sweep #n, score s, verdict v)"; copy the four whole objects into the 75.3 overlay best.json and tail-best.json; update tools/lib/fit-score.mjs HELD_DIALS start values for those rows.
2. Re-pin test/difficulty/difficulty.test.js's fitted capture for depths above 12 (depths 1-12 must be unchanged; say so in the test title), test/unit/combat-scaling.test.js's DIALS pin, and any literal-at-shipped-dials expectation in test/unit/deep-curve.test.js and test/unit/control-at-depth.test.js, each with a RULES-17 / RULES-18 sweep note; re-pin a moved state pin (only deep-14 can move) after confirming its first divergence is past floor 12.
3. Run `npm test` and `node --test "test/parity/**/*.test.js"`; commit.
4. In the SUMMARY: the full evaluation table (n, score, verdict, the four values, every ruled target's value, the fresh median death depth, ok / reason), every ruling-F row, the stop reason, the locked values, and, if the locked best is not a PASS, a "Flag for the user" paragraph naming each missed target and its gap.
  </action>
  <verify>
    <automated>node --test test/difficulty/difficulty.test.js test/unit/tail-score.test.js test/unit/deep-curve.test.js test/unit/control-at-depth.test.js test/unit/combat-scaling.test.js "test/parity/**/*.test.js" && npm test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 75.3 tail sweep" engine/difficulty.js` is at least 4.
    - `node -e "const b=require('./.planning/phases/75.3-deep-floor-encounter-scaling/fit/tail-best.json');const o=require('./.planning/phases/75.3-deep-floor-encounter-scaling/fit/best.json');const k=['FOE_HP_SCALE','FOE_HIT_SCALE','FOE_ELITE','CONTROL_AT_DEPTH'];process.exit(k.every(x=>JSON.stringify(b[x])===JSON.stringify(o[x]))?0:1)"` exits 0.
    - `npm test` reports 0 failures.
  </acceptance_criteria>
  <done>The deep-floor slopes, the elite HP step and the control resistance are set by readouts against the user's targets, the walk is logged and resumable, and every pin agrees with the locked values.</done>
</task>

</tasks>

<verification>
- The sweep ran against the user's ruled targets in blocks of 10 with ruling-F classification; every failure pattern was handed back and resolved by the orchestrator (search parameters) or the user (anything else).
- The locked values are in DIALS, the overlay and tail-best.json; tests re-pinned; floors 1-12 untouched; npm test green; a non-PASS lock is flagged.
</verification>

<success_criteria>
ROADMAP Phase 75.3 criterion 4's last clause holds: the slopes (and the control resistance) are set by bot readouts under the checkpointed fit protocol, against the user's depth-20 unicorn / depth-30 never targets.
</success_criteria>

<output>
Create `.planning/phases/75.3-deep-floor-encounter-scaling/75.3-06-SUMMARY.md` when done. Include the evaluation table, each block's classification, every hand-back and ruling-F row, the stop reason and the locked values.
</output>
