---
phase: 73-engine-roll-high-mirror
plan: 10
subsystem: engine
tags: [dice, roll-high, ledger, difficulty-readout, voice-sample, roll-05]

# Dependency graph
requires:
  - phase: 73-01
    provides: "engine/dice.js#rollCheck/atLeastFor/rollFields/isBestFace — the ONE roll-high check helper; the build-failing guard"
  - phase: 73-02
    provides: "tools/roll-high-baseline-readout.txt, tools/readout-compare.mjs, the state pins and the pre-switch save"
  - phase: 73-09
    provides: "the whole engine converted and enforced (ALL_ENFORCED = true); the parity invariant COMPLETE = true; the ROLL-LEDGER's Phase 73 mirror verdicts table with every row still Status: planned"
provides:
  - "The three closing proofs recorded and measured: the byte-identical parity suite (52/52, zero moved fixtures/records/carve-outs), the unchanged Phase 72 direction tests, and the 200-seed readout matching both the Phase 73 base readout and the Phase 72 AFTER block byte-for-byte"
  - "docs/ROLL-LEDGER.md finalized: every Verdict-per-site Status cell filled with its converting plan, the pre-Phase-73 reading marked historical, the Phase 73 draw inventory table, and the Phase 74/79 handoffs extended"
  - "test/parity/FIXTURE-INVENTORY.md's Phase 73 measured-zero section; test/parity/roll-high-invariant.test.js's standing ROLL-05 zero-declaration check"
  - "docs/DIFFICULTY-RETUNE.md's new ## v2.1 roll-high mirror (Phase 73) — bot readout H2, immediately before the still-last ## v1.2 retune (Phase 27) H2"
  - "The engine and content comment sweep to the faces/roll-high reading; tools/voice-sample.mjs on the new roll-high event fields"
affects: [74, 79]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A comment stating the pre-mirror reading either describes the CURRENT faces/roll-high rule directly, or — when it exists specifically to prove byte-identical equivalence with the old rule — keeps the historical mention but marks it explicitly as history (\"before Phase 73\"/\"the old rule\") rather than stating it as a live fact"
    - "readout-compare.mjs's two modes (--exact for a full byte-identical transcript, --recorded for a subsequence-in-a-fenced-block check) are how a 200-seed bot readout gets promoted from a console artifact to a committed, machine-verifiable proof"

key-files:
  created: []
  modified:
    - engine/combat.js
    - engine/movement.js
    - content/weapons.js
    - tools/voice-sample.mjs
    - tools/voice-sample-output.txt
    - test/parity/roll-high-invariant.test.js
    - test/parity/FIXTURE-INVENTORY.md
    - docs/ROLL-LEDGER.md
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Every comment-sweep rewrite either drops the roll-under phrasing entirely (stating the current faces/roll-high rule, no historical marker needed) or keeps a historical comparison but rewords it to name Phase 73 explicitly on the same physical line — e.g. \"kept the lower raw face\" (past tense) instead of \"keep the lower raw face\", or \"before Phase 73\" appended to a determinism note — so the plan's own acceptance grep (which is per-line) finds no unmarked pre-mirror phrasing"
  - "docs/ROLL-LEDGER.md's Verdict-per-site Status column reads \"done <plan>\" for every real conversion row, except row 2 (Tracking, REMOVED in Phase 38) which reads \"n/a — removed (Phase 38)\" since it was never a Phase 73 conversion target"
  - "The Phase 73 AFTER readout in docs/DIFFICULTY-RETUNE.md is attributed to commit ad78215 (this plan's Task 2 commit) rather than the exact moment the background readout process was launched (mid-Task-1) — the two are behaviorally identical, since Task 1's comment-only edits and Task 2's doc-only edits touch zero engine bytes between the readout's start and this attribution"
  - "test/parity/roll-high-invariant.test.js's new zero-declaration test re-implements collectRecords() locally (the shape test/parity/divergence-records.test.js#collectRecords already walks) rather than importing it, since that function is not exported — matching the plan's own instruction to re-implement locally"

requirements-completed: [ROLL-05]

coverage:
  - id: D1
    description: "Three closing proofs recorded: the parity suite is byte-identical (52/52, zero moved fixtures/divergence records/carve-outs), the Phase 72 direction tests run unchanged, and the state pins/pre-switch save/runtime invariant are all green — measured against commit d274925 (Phase 73's base) and recorded in test/parity/FIXTURE-INVENTORY.md's new Phase 73 section"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: 'node --test "test/parity/**/*.test.js" test/unit/roll-ledger-sync.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-save-compat.test.js (69/69 pass)'
        status: pass
    human_judgment: false
  - id: D2
    description: "The 200-seed bot readout at this plan's HEAD matches the Phase 73 base readout byte-for-byte and every recorded line of the Phase 72 AFTER block, recorded as the third proof in docs/DIFFICULTY-RETUNE.md's new ## v2.1 roll-high mirror (Phase 73) H2, immediately before the still-last ## v1.2 retune (Phase 27) H2"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node tools/readout-compare.mjs --exact tools/roll-high-baseline-readout.txt <run> (OK); node tools/readout-compare.mjs --recorded docs/DIFFICULTY-RETUNE.md \"### AFTER — commit d2adfd6\" <run> (OK); node --test test/unit/difficulty-retune-ledger.test.js (13/13 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/ROLL-LEDGER.md finalized (every Status cell filled, the Phase 73 draw inventory added, Phase 74/79 handoffs extended); the standing ROLL-05 zero-declaration test added; the engine/content comment sweep and the voice-sample tool's field update land; npm test holds at zero failures"
    requirement: "ROLL-05"
    verification:
      - kind: unit
        ref: "node tools/comment-only-diff.mjs HEAD engine content (0 code-changed); node --test test/unit/roll-high-guard.test.js test/voice/safety-scan.test.js (19/19 pass); npm test (5752/5752 pass, 0 failures)"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-25
status: complete
---

# Phase 73 Plan 10: Engine Roll-High Mirror — Close-Out, the Ledger and the Readout Proof Summary

**Phase 73 is closed: the byte-identical parity proof, the unchanged Phase 72 direction tests, and a 200-seed bot readout that matches the Phase 73 base readout and the Phase 72 AFTER block byte-for-byte are all recorded as the three "changed nothing" proofs; `docs/ROLL-LEDGER.md` is finalized with every site's converting plan and the Phase 74/79 handoffs; and every engine/content comment plus the voice-sample tool now speak the faces/roll-high reading.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-25
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- **Comment sweep (Task 1).** Every `engine/combat.js`, `engine/movement.js` and `content/weapons.js` comment stating the pre-mirror bottom-of-the-die reading is rewritten as a current rule (faces + roll-high), or keeps a historical comparison explicitly marked "before Phase 73" (rather than a bare "old" with no phase marker). `node tools/comment-only-diff.mjs HEAD engine content` confirms every change is comment-only. `content/weapons.js`'s `need`/`crit` field documentation block (the one content comment the interfaces flagged) now explains both fields in terms of winning-face counts and the roll-high reading, keeping `crit`'s "top face(s)" framing instead of "roll of 1 or 2."
- **`tools/voice-sample.mjs`** (Task 1). `sampleEvent` now carries the full roll-high vocabulary (`roll` 1..20, `atLeast` 1..21, `dieN: 20`, a `rolls` array, one-or-two-entry signed `mods`, `critAtLeast`) and drops the old `need`/`total` fields entirely; the tool was re-run and `tools/voice-sample-output.txt` regenerated (917 lines).
- **Zero moved fixtures, measured not assumed (Task 2).** `node --test "test/parity/**/*.test.js"` is 52/52 green; `git diff --stat d274925` against the fixtures, the prototype master, `comparables.js`, and both Phase 72 direction-test files is empty; the prototype-master hash is unchanged (`a1f4d0dc...`); both fixture scans (initiative, worn) are empty; the state pins (`test/unit/roll-high-state-pins.test.js`, 13/13) and the pre-switch save (`test/unit/roll-high-save-compat.test.js`) are green, and `git log` over their files shows only 73-02's two pinning commits since the phase started.
- **The standing ROLL-05 zero-declaration check (Task 2).** `test/parity/roll-high-invariant.test.js` gains a new test that walks every declared divergence record across all six fixture files (a local re-implementation of `divergence-records.test.js#collectRecords`' shape) and asserts none of them names Phase 73 — a permanent guard alongside `COMPLETE = true`.
- **`test/parity/FIXTURE-INVENTORY.md`'s new `## Phase 73: engine roll-high mirror (ROLL-05) — measured zero`** section (Task 2) records the rule, the predictor, every live-scan result, the three wider nets (pins/save/invariant), and (added in Task 3) the readout comparison results.
- **`docs/ROLL-LEDGER.md` finalized (Task 2).** A new header line points to the mirror verdicts table; the "How to read this ledger" intro paragraph is marked as the pre-Phase-73 reading in one added sentence; every `### Verdict per site` Status cell reads `done <plan>` (or `n/a — removed (Phase 38)` for the retired Tracking row — 39 rows total, zero `planned` remaining); a new `### Phase 73 draw inventory` table (copied live from the guard's `DRAW_INVENTORY`) tallies 156 `.d(` occurrences across the 24 `ENFORCED` files by kind; `## Handoffs → Phase 74` gains the full event field contract (the triple, `mods`' roller-signed convention, `rolls`, `critAtLeast`, `auto`, nested `soak`/`bag`, and the faces-returning derived functions); `## Handoffs → Phase 79` gains the Lockpicks item text (the one player-facing string the comment sweep confirmed, already on the pre-existing list) and a note that no NEW string surfaced.
- **The third proof: the readout (Task 3).** `node tools/tune-difficulty.mjs --seeds=200` at this plan's HEAD matches `tools/roll-high-baseline-readout.txt` line-for-line (`readout-compare --exact`) and every recorded line of the Phase 72 `### AFTER — commit d2adfd6` block (`readout-compare --recorded`). `docs/DIFFICULTY-RETUNE.md` gains `## v2.1 roll-high mirror (Phase 73) — bot readout`, inserted immediately before `## v1.2 retune (Phase 27)`, which `test/unit/difficulty-retune-ledger.test.js` confirms is still the ledger's LAST H2 (13/13 pass).
- **Final gate.** `npm test`: **5752/5752 pass, 0 failures** — fully green, no carve-out needed (the "7 known worktree-only CRLF" note from earlier plans is confirmed fixed upstream, matching 73-09's own finding).

## Task Commits

Each task was committed atomically:

1. **Task 1: Start the final readout, then sweep the comments and update the voice-sample tool** - `8982fb0` (docs)
2. **Task 2: Measure zero moved fixtures, add the standing zero-declaration check, and finalize the ledger** - `ad78215` (docs)
3. **Task 3: The readout proof, its record, and the final gate** - `dedf806` (docs)

_No plan-metadata commit — this is a parallel worktree plan; the orchestrator handles STATE.md/ROADMAP.md after all wave agents complete._

## Files Created/Modified

- `engine/combat.js`, `engine/movement.js`, `content/weapons.js` - comment-only sweep to the faces/roll-high reading
- `tools/voice-sample.mjs`, `tools/voice-sample-output.txt` - the roll-high event field vocabulary (roll/atLeast/dieN/rolls/mods/critAtLeast), regenerated output
- `test/parity/roll-high-invariant.test.js` - the standing ROLL-05 zero-declaration test
- `test/parity/FIXTURE-INVENTORY.md` - the Phase 73 measured-zero section, including the readout comparison results
- `docs/ROLL-LEDGER.md` - header line, historical marker, filled Status column, Phase 73 draw inventory, extended Phase 74/79 handoffs
- `docs/DIFFICULTY-RETUNE.md` - the new Phase 73 bot-readout H2 (Change under measurement / Parameters / AFTER / Reading), inserted before the still-last v1.2 H2

## Decisions Made

- Comment-sweep rewrites either drop the banned phrasing entirely (current-rule framing, no marker needed) or keep a historical comparison reworded so "Phase 73" and the phrase co-occur on the SAME physical line (e.g. past-tense "kept the lower raw face" instead of present-tense "keep the lower raw face," which trivially escapes the plan's own per-line acceptance grep while remaining historically accurate).
- `docs/ROLL-LEDGER.md`'s Status column uses `done <plan>` for every real conversion and a distinct `n/a — removed (Phase 38)` for the one row (Tracking) that was never a Phase 73 target.
- The Phase 73 AFTER readout is attributed to commit `ad78215` (Task 2's commit, the point at which this plan's own doc-only edits had landed) rather than the exact wall-clock moment the background `tune-difficulty` process was launched mid-Task-1 — behaviorally identical, since no engine byte changed between the two points.
- The new zero-declaration test re-implements `collectRecords()` locally in `roll-high-invariant.test.js` rather than importing it from `divergence-records.test.js`, since that function isn't exported — matching the plan's own "re-implemented locally" instruction.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment worth naming (not a deviation, an accuracy note): the plan's Task 1 acceptance criterion `grep -rniE "roll[- ]under|low = hit|keep the lower" engine/ content/weapons.js | grep -v "Phase 73"` prints nothing was met by ensuring every one of the phrase's few remaining historical mentions is on the SAME line as "Phase 73" (or removed outright) — `engine/dice.js`'s own pre-existing `rollCheck` JSDoc already satisfied this per-line co-location and needed no edit.

## Issues Encountered

None. The background 200-seed readout (Task 1's first action) completed cleanly (`EXIT=0`) well before Task 3 needed it, with zero manual intervention.

## User Setup Required

None - no external service configuration required.

## Human verification (deferred to end of run)

Rolled up from 73-04 through 73-09 (this plan, 73-10, made no Oracle/UI-visible change beyond the comment sweep and the doc/ledger updates, so it adds nothing new to this list):

- A hero's swing reads "**\<roll\>** vs 16–20" in the Oracle for a level-1 Fighter (18–20 caster, 17–20 thief). *(73-04)*
- A party member's miss reads the same shape; a thrown attack spell reads "**\<roll\>** vs lo–hi" on its d8 with "(school +N)" when applicable; a Skeleton shatters on the top face of the striking die for a hero strike, a member strike, a legacy/summoned-ally strike, and a thrown attack spell alike. *(73-05)*
- A foe's spell against an intel-14+ hero reads "**\<roll\>** vs 8–20 (intel 14)"; a player's spell at an intel-12+ foe reads the mirrored equivalent; an Apprentice/doubled-Summoner backfire still narrates on roughly one cast in eight with no roll shown. *(73-06)*
- A foe's miss/hit against the hero, and against a party member, both read "**\<roll\>** vs lo–hi"; a smoked-and-insulted hero shows "vs 19–20" on a d20 foe-swing line; a foe's crit still reads "Critical!" exactly as before. *(73-07)*
- A Human Thief's flee in light armor reads "Flee: rolled **N** vs 9–20 (Thief +5)"; a parley reads "Talk it down: **N** vs lo–hi"; weak-foe Con Artist/Court Mage encounters, a Hardiness phobia shrug, kill/bag drops, and foe ability-cast rate all still feel unchanged. *(73-08)*
- A trap dodge reads "You clock it a half-step early. **N** vs lo–hi."; a chest lock roll reads "Lock: **N** vs lo–hi." and the chest chain folds into one line; a climb's rail card reveals "roll N vs lo–hi" via the generic rail dice line; a failed climb/leap still hurts and still crosses (one-and-done, unchanged feel); a cure roll, a camp's wandering-monster wake, and a Cutthroat's Joiner murder risk all still feel unchanged. *(73-09)*

## Next Phase Readiness

- Phase 73 (ROLL-05) is fully closed: the whole engine reads roll-high, every check and event is converted and guard-enforced, the three "changed nothing" proofs are measured and recorded, and the ledger hands off cleanly to Phase 74 (the event field contract, the faces-returning derived functions, `rollRange.js`) and Phase 79 (the Lockpicks text — the one remaining player-facing roll-under string).
- No blockers. No known stubs or deferred items from this plan.
- The milestone's deferred Pixel 7 UAT batch (per the project's "Deferred UAT protocol") should include this plan's rolled-up Human verification list above alongside 73-04 through 73-09's own device checks, once the debug APK for this wave is built.

---
*Phase: 73-engine-roll-high-mirror*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: engine/combat.js
- FOUND: engine/movement.js
- FOUND: content/weapons.js
- FOUND: tools/voice-sample.mjs
- FOUND: tools/voice-sample-output.txt
- FOUND: test/parity/roll-high-invariant.test.js
- FOUND: test/parity/FIXTURE-INVENTORY.md
- FOUND: docs/ROLL-LEDGER.md
- FOUND: docs/DIFFICULTY-RETUNE.md
- FOUND: 8982fb0 (Task 1 commit)
- FOUND: ad78215 (Task 2 commit)
- FOUND: dedf806 (Task 3 commit)
