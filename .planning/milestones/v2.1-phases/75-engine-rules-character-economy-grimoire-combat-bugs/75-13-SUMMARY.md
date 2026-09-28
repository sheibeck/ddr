---
phase: 75-engine-rules-character-economy-grimoire-combat-bugs
plan: 13
subsystem: testing
tags: [difficulty-ledger, fixture-inventory, parity-guard, voice-sample, close-out]

# Dependency graph
requires:
  - phase: 75-engine-rules-character-economy-grimoire-combat-bugs
    provides: "all twelve prior Phase 75 plans (75-01..75-12) — their committed readouts, SUMMARY.md measurement notes, and the Plan 05 FIXTURE-INVENTORY subsection this plan consolidates"
provides:
  - "docs/DIFFICULTY-RETUNE.md's `## v2.1 engine rules (Phase 75) — bot readouts` H2 — six per-plan BEFORE/AFTER readout blocks plus the phase-wide BEFORE (75-02 base) -> FINAL, every fenced block machine-checked against its source readout file via tools/readout-compare.mjs"
  - "the LOOT_SCALE dial-table row corrected: the wilmst cache is its own WILMST_CACHE_PER_DEPTH constant (100 x depth), not LOOT_SCALE alone"
  - "test/parity/FIXTURE-INVENTORY.md's completed Phase 75 section — a 'measured zero' subsection for every plan besides 75-05 (02/04/06/07/08/09/10/12), each with its own predictor and measurement"
  - "test/parity/divergence-records.test.js's sibling Phase 75 exposure guard — a 31-site replay proving zero exposure to every other Phase 75 rule change, plus a 'has teeth' doctored-event proof"
  - "tools/voice-sample.mjs's SAMPLE_OVERRIDES — deterministic field overrides so the human voice skim always exercises the eight Phase 75 narration branches, not left to random chance"
  - "tools/readouts/75-13-final.txt — the phase-head 200-seed readout"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consolidate-once ledger: six parallel-wave plans each committed their own before/after readout independently (never colliding on a shared doc); this plan writes the shared DIFFICULTY-RETUNE.md/FIXTURE-INVENTORY.md ledger a single time, from those committed files, machine-checked rather than hand-typed."
    - "Exposure-guard teeth proof: extracting the guard's per-event-type counting logic into its own pure function lets a dedicated test feed it a doctored event list and prove every zero-assertion would genuinely fail, without needing a second live engine replay."
    - "Deterministic sample overrides: a tool that renders N random samples per event type can guarantee a specific branch fires at least once (index 0) while leaving the remaining samples fully random, by patching fields onto the base random object rather than special-casing the whole generator."

key-files:
  created:
    - tools/readouts/75-13-final.txt
  modified:
    - docs/DIFFICULTY-RETUNE.md
    - test/parity/FIXTURE-INVENTORY.md
    - test/parity/divergence-records.test.js
    - tools/voice-sample.mjs
    - tools/voice-sample-output.txt

key-decisions:
  - "The LOOT_SCALE row's engine-hook column dropped 'wilmst cache' from its direct list and gained an explanatory clause — the cache still passes THROUGH lootFor (so LOOT_SCALE still multiplies it), but the row no longer implies LOOT_SCALE is the cache's only lever, since RULES-02 gave it its own WILMST_CACHE_PER_DEPTH constant."
  - "tools/voice-sample.mjs (not in this plan's declared files_modified) needed a real code change, not just a re-run — the generic random sampler's closed vocabularies never happened to hit useRefused's notWielded reason, wentHungry's booksKept flag, wardRaised/wardReflected's mirror flag, afflictionRolled's roll 5/6, combatJoined's why:senses, or itemEquipped/itemTaken's destroyed clause. SAMPLE_OVERRIDES patches exactly the first of each affected type's 3 samples, deterministically, so the human voice skim always shows every new Phase 75 branch (Rule 3 — the acceptance criterion 'Wield it first.' appears at least once' cannot be satisfied without this)."
  - "The Phase 75 sibling exposure guard extends the SAME replaySiteEvents helper (adding a staffEverSet field) rather than writing a parallel replay function — mirrors the existing pendingJoinerEver/maxDepthEver precedent in the same function."
  - "No literal TDD RED/GREEN split for Task 2: this task adds a standing PROOF over behavior eight prior plans already shipped (a consolidation/measured-zero close-out), not new production code — the same 'no reproduction, no code fix' shape 75-08's own RULES-06 plan used. See '## TDD Gate Compliance' below."

requirements-completed: [RULES-01, RULES-02, RULES-03, RULES-04, RULES-05, RULES-06, RULES-07, RULES-08, RULES-12, RULES-13, RULES-14, RULES-15]

coverage:
  - id: D1
    description: "docs/DIFFICULTY-RETUNE.md gains the Phase 75 H2 immediately before the v1.2 H2, with six per-plan BEFORE/AFTER blocks and the phase BEFORE (75-02 base) -> FINAL blocks, every fenced block verified byte-for-byte (subsequence) against its source readout file"
    requirement: RULES-02
    verification:
      - kind: unit
        ref: "node --test test/unit/difficulty-retune-ledger.test.js (13/13 pass — the v1.2 H2 stays last)"
        status: pass
      - kind: other
        ref: "node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md \"<heading>\" <file> for all 14 headings (12 per-plan + 2 phase-wide) — all exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The LOOT_SCALE dial-table row no longer implies the wilmst cache rides LOOT_SCALE alone — it names the cache's own WILMST_CACHE_PER_DEPTH constant while noting the cache still passes through lootFor"
    requirement: RULES-02
    verification:
      - kind: other
        ref: "grep -n LOOT_SCALE docs/DIFFICULTY-RETUNE.md — the current dial table row (line ~4899) names WILMST_CACHE_PER_DEPTH"
        status: pass
    human_judgment: false
  - id: D3
    description: "test/parity/FIXTURE-INVENTORY.md's Phase 75 section is completed with a measured-zero subsection for every plan besides 75-05 (02/04/06/07/08/09/10/12), each citing its own SUMMARY's measurement commands/results"
    verification:
      - kind: other
        ref: "grep -c \"measured zero\" test/parity/FIXTURE-INVENTORY.md (20, up from the plan base's fewer occurrences, inside the Phase 75 section)"
        status: pass
    human_judgment: false
  - id: D4
    description: "test/parity/divergence-records.test.js's Phase 75 guard replays all 31 sites and proves zero exposure to every other Phase 75 rule (no ward raised/reflected, no senses gained, no combatInDark, no wanderingMonster/tileResumed, no staff ever wielded, no unfed-with-kept-book, no halved heal/regen); the declared set stays exactly RULES75_EXPECTED_HOLDERS; a companion test proves the guard has teeth against a doctored event list"
    requirement: RULES-13
    verification:
      - kind: unit
        ref: "node --test test/parity/divergence-records.test.js (12/12 pass, including the two new tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "tools/voice-sample-output.txt is regenerated so the new Phase 75 lines (notWielded/\"Wield it first.\", booksKept, the senses initiative verdict, the Bubble mirror, ailment 5-6, destroyed-armor swaps, tileResumed) are in the human voice skim"
    verification:
      - kind: other
        ref: "grep -c \"Wield it first.\" tools/voice-sample-output.txt (1); direct inspection of the useRefused/wentHungry/combatJoined/wardRaised/wardReflected/afflictionRolled/itemEquipped/itemTaken/tileResumed blocks all show the new branch"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole-phase gates hold at the head: npm test 0 failures, the parity suite green, the prototype master hash unchanged, the roll-high guard/direction/state-pin/save-compat suites pass unedited by this plan"
    verification:
      - kind: integration
        ref: 'npm test (6218/6218); node --test "test/parity/**/*.test.js" test/unit/roll-high-guard.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js test/unit/roll-ledger-sync.test.js (228/228)'
        status: pass
      - kind: other
        ref: "git hash-object test/parity/prototype-master.js.txt == a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (unchanged)"
        status: pass
    human_judgment: false

duration: 165min
completed: 2026-09-26
status: complete
---

# Phase 75 Plan 13: Close-out — Readout Ledger, Fixture Inventory, Exposure Guard, Voice Sample Summary

**Closed Phase 75's engine gate: consolidated six plans' independent before/after readouts into one machine-checked ledger (mean death depth 7.87 -> 7.54, p50 held at 7 throughout, no user flag), completed the fixture inventory's measured-zero story for the other eight plans behind a teeth-tested 31-site exposure guard, and regenerated the voice sample so every new Phase 75 narration branch is deterministically exercised.**

## Performance

- **Duration:** ~165 min (includes a ~20 min 200-seed final readout run in the background)
- **Started:** 2026-09-25 (worktree base 5b5bfff7)
- **Completed:** 2026-09-26
- **Tasks:** 2 completed
- **Files modified:** 5 modified, 1 created

## Accomplishments

- **The Phase 75 readout ledger is written once, machine-checked, never hand-typed.** `docs/DIFFICULTY-RETUNE.md` gains `## v2.1 engine rules (Phase 75) — bot readouts` immediately before the standing `## v1.2 retune (Phase 27)` H2 (verified: `test/unit/difficulty-retune-ledger.test.js` still passes 13/13, confirming the v1.2 section stays last). It records, for each of the six balance-moving plans (75-02, 75-05, 75-06, 75-09, 75-10, 75-12), a `### Plan NN — BEFORE`/`### Plan NN — AFTER` pair with a fenced block of the readout's headline lines copied verbatim from that plan's own committed `tools/readouts/75-NN-{before,after}.txt`, plus a short reading. Every one of the 14 fenced blocks (12 per-plan + 2 phase-wide) was proven byte-for-byte against its source file with `node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md "<heading>" <file>` — all 14 exit 0.
- **The phase-wide picture: mean death depth 7.87 → 7.54, p50 held at 7 the entire way.** `### Phase 75 — BEFORE (75-02 base)` (from `tools/readouts/75-02-before.txt`, the phase's own pre-Phase-75 head) against `### Phase 75 — FINAL` (a fresh 200-seed `node tools/tune-difficulty.mjs --seeds=200` run at this plan's own head, committed as `tools/readouts/75-13-final.txt`): reach-20 moves 1.5%→1.0%, still inside the 1.0-2.0% unicorn band this same ledger's own Phase 27 target table calls the unicorn rate; the per-floor-survival verdict is "all floors 1-12 inside the pass band" at both ends. Fighter/Thief both trend slightly easier; Magic User trends harder (mostly the RULES-13 staff-inert cost measured directly in Plan 09's own reading), while the two Summoner-side RULES-03 halves (75-05's easier offense, 75-10's harder healing) roughly cancel within the same 59-Magic-User pool. **No flag for the user is needed** — p50 death depth never left floor 7 (inside the floors 5–7 average-run-ending target) at any single measurement point across the whole phase, and this plan retunes no dial regardless.
- **The LOOT_SCALE dial-table row corrected.** It no longer lists "wilmst cache" among the things `lootFor`'s `LOOT_SCALE` multiplier directly governs — the row now names the cache's own `WILMST_CACHE_PER_DEPTH` constant (100 × depth, RULES-02) while still noting it passes through `lootFor` (so `LOOT_SCALE` still applies on top).
- **test/parity/FIXTURE-INVENTORY.md's Phase 75 section is complete.** After 75-05's own "Plan 05" subsection (the phase's only declared fixture-mover), a new `### Plans 02, 04, 06, 07, 08, 09, 10, 12 — measured zero` subsection names, per plan, the rule, the predictor (why no replay site reaches the new code path), and the measurement command/result — pulled verbatim from that plan's own committed SUMMARY.md, never re-derived. It closes naming the prototype master hash (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`, unchanged all phase) and the new standing guard.
- **A sibling exposure guard proves every "measured zero" claim, not just states it.** `test/parity/divergence-records.test.js` gained a new test replaying all 31 parity sites and asserting zero `wardRaised`/`wardReflected`/`sensesGained`/`combatInDark`/`wanderingMonster`/`tileResumed` events, zero `healed`/`regenerated` events carrying `halved: true`, zero `wentHungry` events carrying `booksKept: true`, and that `state.c.staff` is never set at ANY point across any replay (the shared `replaySiteEvents` helper gained a `staffEverSet` field, mirroring its existing `pendingJoinerEver`/`maxDepthEver` pattern) — then re-asserts the declared Phase 75 set is still exactly `RULES75_EXPECTED_HOLDERS` (Plan 05's three holders). A companion "has teeth" test extracts the same per-event-type counting logic into `countPhase75Exposure(events)` and feeds it a doctored event list carrying every flagged branch, proving every one of the guard's zero-assertions would genuinely fail against real exposure, not merely pass by construction.
- **The human voice skim now deterministically shows every new Phase 75 line.** The default random sampler in `tools/voice-sample.mjs` never happened to roll `useRefused`'s `notWielded` reason, `wentHungry`'s `booksKept` flag, `wardRaised`/`wardReflected`'s `mirror` flag, `afflictionRolled`'s roll 5/6, `combatJoined`'s `why: "senses"`, or `itemEquipped`/`itemTaken`'s `destroyed` clause, out of its wide closed vocabularies. A new `SAMPLE_OVERRIDES` table patches exactly the FIRST of each affected event type's 3 samples with the needed field(s), leaving every other sample's full random draw untouched — `tools/voice-sample-output.txt` regenerated and confirmed: `grep -c "Wield it first." tools/voice-sample-output.txt` is 1, and every other named branch (the bubble's "A bubble shimmers around you...", "You felt them coming. You go first.", "The die turns up 5. Not your body — your nerve.", "Your old Leather was already in pieces...", "With that settled — the chest.") is present.
- **Every whole-phase gate holds at the head.** `npm test`: 6218/6218 (up from the plan-base's 6216, the two new divergence-records.test.js tests). `node --test "test/parity/**/*.test.js"`: 56/56. `git hash-object test/parity/prototype-master.js.txt`: `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` (unchanged). `node --test test/unit/roll-high-guard.test.js test/unit/rollDirection.test.js test/unit/rollDirection-checks.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js test/unit/roll-ledger-sync.test.js`: 228/228 (combined with the parity run above), none of these files edited by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: The final readout and the DIFFICULTY-RETUNE.md Phase 75 section** - `2501ac76` (docs)
2. **Task 2: Complete the fixture inventory and the exposure guard; refresh the voice sample; run the whole-phase gates** - `1398c9a4` (test)

**Plan metadata:** (this commit, made by the orchestrator after wave close)

## Files Created/Modified

- `docs/DIFFICULTY-RETUNE.md` - the new Phase 75 H2 (six per-plan BEFORE/AFTER blocks + phase-wide BEFORE/FINAL + reading), and the corrected LOOT_SCALE dial-table row
- `tools/readouts/75-13-final.txt` - the phase-head 200-seed readout (new)
- `test/parity/FIXTURE-INVENTORY.md` - the completed Phase 75 "measured zero" subsection for Plans 02/04/06/07/08/09/10/12
- `test/parity/divergence-records.test.js` - the new sibling exposure-replay test and its "has teeth" companion; `replaySiteEvents` gained a `staffEverSet` field
- `tools/voice-sample.mjs` - new `SAMPLE_OVERRIDES` table, `sampleEvent(type, sampleIndex)` signature change
- `tools/voice-sample-output.txt` - regenerated (deterministic, seed unchanged)

## Decisions Made

- The LOOT_SCALE row's fix is a wording correction, not a behavior change — `WILMST_CACHE_PER_DEPTH` already (per 75-02) passes its own result through `lootFor`, so `LOOT_SCALE` genuinely still multiplies the cache; the row previously implied `LOOT_SCALE` was the cache's ONLY lever, which RULES-02 made untrue.
- `tools/voice-sample.mjs`'s code change (Rule 3 — not in this plan's declared `files_modified`, which names only the output file) was necessary, not optional: without it, the plan's own acceptance criterion (`grep -c "Wield it first." tools/voice-sample-output.txt` >= 1) could not be satisfied by re-running the existing tool, since its random field pool never included the `notWielded` reason string at all.
- The exposure guard's teeth-proof extracts a pure counting function (`countPhase75Exposure`) rather than duplicating the tally logic inline in a second test — this keeps the real guard and its teeth-proof reading from the SAME source of truth, so a future edit to one automatically keeps the other honest.
- No literal TDD RED/GREEN commit split for Task 2 (`tdd="true"` on the task): this task's own `<action>` items describe extending a standing PROOF over already-shipped behavior across eight plans (a consolidation/measured-zero close-out), never new production code to implement — the same shape 75-08's own RULES-06 plan took ("no reproduction of a new cause, no production code fix"). See `## TDD Gate Compliance` below.

## TDD Gate Compliance

Task 2 carries `tdd="true"`, but its own action items are entirely test/doc additions over EXISTING, already-shipped engine behavior (the eight "measured zero" plans) — there is no new production code path for a RED phase to fail against before a GREEN phase implements it. The new `divergence-records.test.js` test passed on its first run (as expected: it proves a fact about behavior that has been true since each of those eight plans landed, not a new feature). This mirrors 75-08's own precedent (RULES-06, "no reproduction of a new cause, no production code fix") rather than a fresh feature RED/GREEN cycle. Both commits in this plan are typed `docs`/`test` accordingly, and the guard's "has teeth" companion test is the substitute proof that the assertions are load-bearing (a doctored event list is caught), which is the substantive guarantee a RED phase would otherwise provide.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `tools/voice-sample.mjs` required a code change outside the plan's declared `files_modified`**
- **Found during:** Task 2 (after running the existing tool unchanged and finding none of the required new lines appeared)
- **Issue:** The plan's `files_modified` names only `tools/voice-sample-output.txt`, but the tool's `sampleEvent()` draws every field from wide random closed vocabularies that never happened to hit the specific field values (`reason: "notWielded"`, `booksKept: true`, `mirror: true`, `roll: 5/6`, `why: "senses"`, `destroyed: true`) the eight new Phase 75 narration branches gate on — re-running the unmodified tool could not satisfy the plan's own acceptance criterion (`grep -c "Wield it first." tools/voice-sample-output.txt` >= 1).
- **Fix:** Added a `SAMPLE_OVERRIDES` table patching exactly the first of each affected event type's 3 samples with the needed field(s); every other sample keeps its full random draw, preserving tone variety.
- **Files modified:** `tools/voice-sample.mjs`, `tools/voice-sample-output.txt`
- **Verification:** `node tools/voice-sample.mjs` regenerates deterministically (same seed); `grep -c "Wield it first." tools/voice-sample-output.txt` is 1; direct inspection of all eight affected event blocks confirms the new branch is present; full `npm test` unaffected (6218/6218).
- **Committed in:** `1398c9a4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — a tool-code change required to satisfy the plan's own stated acceptance criterion, not scope creep beyond what the criterion itself demanded).
**Impact on plan:** No engine/content behavior touched; the fix is scoped entirely to a dev-only review tool and its deterministic output file.

## Issues Encountered

- An early `node tools/tune-difficulty.mjs --help` invocation (intended only to check the CLI's usage text) was ignored by the script's argument parser and instead ran a full default readout, which the harness then moved to a background task and truncated via an unrelated `| head -20` pipe from the SAME command — the captured output was a 20-line fragment, not the intended full readout. Recognized the mistake, discarded that output, and ran the correct `node tools/tune-difficulty.mjs --seeds=200 > tools/readouts/75-13-final.txt` command properly in the background, waiting for its own completion notification before using the file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 75's engine gate is fully closed: every balance change is recorded against a machine-checked readout, the fixture story is complete and guarded (Plan 05's three holders declared, everything else measured zero and proven with a teeth-tested guard), and the voice sample is current.
- **Rolled-up Pixel 7 human-check list for the milestone's batched device round** (from every Phase 75 plan's own deferred verification, per this project's standing Deferred UAT protocol):
  1. RULES-01: pull "+25 HP" twice on one hero and confirm two equal flat steps.
  2. RULES-02: a floors-1-3 red-dot wilmst cache pays less than a store-tier reset.
  3. RULES-03: a level-1 Summoner can roll and cast an offense spell; a new Warlock/Apprentice never shows a spell that says "not open to you yet"; a Summoner casting Heal restores about half what a Cleric's does.
  4. RULES-04: the combat SPELLS menu lists only castable-by-level spells (a locked spell has no row at all; an out-of-charges spell stays listed, disabled).
  5. RULES-05: Sense Presence on a dark square gives "you go first" with no "cannot see" line.
  6. RULES-06: a floor-2 trap at ~21 HP never kills on a "−1 HP" line; after a fight where a foe swings twice, the YOUR LOT card and the top HP bar agree with each other.
  7. RULES-07: an ailment roll of 5 or 6 reads as a fear, not a disease.
  8. RULES-08: swapping over a destroyed worn armor piece says the old piece is gone.
  9. RULES-12: a wanderer-interrupted chest/trap/exit still resolves once the fight (and any spoils) settles.
  10. RULES-13: a bagged staff shows NOT WIELDED on the Gear tab and combat ITEMS and does nothing when tapped; a wielded staff fights as a d8 melee weapon and its charged power works.
  11. RULES-14: casting Bubble bounces the next hit back in full and pops into a small pool that soaks the rest of that round.
  12. RULES-15: an unfed automatic-100-square day leaves a spent spell book empty until the party actually eats.
- Phase 75 is otherwise ready to close — no blockers, no known stubs, no new threat surface introduced by this plan (test/doc/tool files only).

---
*Phase: 75-engine-rules-character-economy-grimoire-combat-bugs*
*Completed: 2026-09-26*

## Self-Check: PASSED

- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: tools/readouts/75-13-final.txt
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: test/parity/divergence-records.test.js
- FOUND: tools/voice-sample.mjs
- FOUND: tools/voice-sample-output.txt
- FOUND: .planning/phases/75-engine-rules-character-economy-grimoire-combat-bugs/75-13-SUMMARY.md
- FOUND commit: 2501ac76 (docs: Task 1 — the readout ledger)
- FOUND commit: 1398c9a4 (test: Task 2 — fixture inventory, exposure guard, voice sample)
- FOUND commit: 55161996 (docs: this SUMMARY)
