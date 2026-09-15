---
phase: 27-delve-to-death-retune
plan: 03
subsystem: difficulty-tuning
tags: [bounded-iteration, deep-combat-ramp, foe-grace, encounter-density, class-pass-after, cannot-act-gate, counterweight-triggers, ledger, standing-guard]

# Dependency graph
requires:
  - phase: 27-delve-to-death-retune
    plan: 02
    provides: "Dante demoted to tier 2 (Ned at tier 1), the parity-clean early-floor lever set landed (foe grace 2-4 at 0.75, hazard ramp from floor 2 at 0.5, darkness held through 3), PHASE_27_PINS as the single edit point for dial values, and iteration 0's smoke readout + escalation ladder in docs/DIFFICULTY-RETUNE.md"
provides:
  - "engine/difficulty.js: final v1.2 constants — COMBAT_SCALE_FROM_DEPTH 6->21, FOE_CAP_MAX 5->4, FOE_POWER_MAX 1.6->1.15, ABILITY_THREAT_MAX 2.0->1.3, ENCOUNTER_DOT_CAP 15->13, FOE_GRACE_AT_2 0.75->0.5 — every move parity-clean, floor 1 unchanged (FOE_GRACE_AT_1 exactly 1.0), no new declared parity divergence beyond 27-02's seed-303 record"
  - "docs/class-pass/retune-after.json + retune-after-depth20.json: the FULL AFTER (143x40 natural, 5720 runs; 143x10 forced-20, 1430 runs) on pin 39bfecf, Bot lines byte-identical to Phase 26, cannot-act 0 of 143"
  - "docs/DIFFICULTY-RETUNE.md's v1.2 section completed: Change table, Iteration log 1-4, AFTER readouts (verbatim transcripts + class-pass-diff --section after rendering), Comparison vs band (honest in/out per row), Counterweight triggers (neither fired), Not changed and why (every unreached ladder rung recorded as available-not-taken)"
  - "test/unit/difficulty-retune-ledger.test.js extended with 7 new AFTER-provenance checks (metaParity, cannot-act, pin match, Phase-26-untouched, no placeholders, band-path coverage, change-table coverage) plus a stripFences() fix so verbatim tool transcripts embedded in the ledger don't corrupt the heading-order check"
affects: [27-04-dr-round]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded iteration with two independent levers per pass: the early-floor ladder (fixture-affecting, capped by the orchestrator to grace-notches/dots/dark/hazard-values only) and the deep combat ramp (fixture-free, tuned purely against the forced-20 band) can each move in the same iteration without interacting, since the deep dials only bite at depth >= COMBAT_SCALE_FROM_DEPTH and the ladder only bites at depths 2-4."
    - "stripFences() for ledger guard tests: once a ledger embeds a verbatim tool transcript inside a fenced code block, any heading-counting regex test over the raw markdown text must blank fenced-block bodies first, or the tool's own '### '-prefixed output lines get mistaken for document headings."

key-files:
  created:
    - docs/class-pass/retune-after.json
    - docs/class-pass/retune-after-depth20.json
  modified:
    - engine/difficulty.js
    - test/determinism/foe-abilities.test.js
    - test/difficulty/difficulty.test.js
    - test/unit/combat-scaling.test.js
    - test/unit/maze.test.js
    - test/unit/difficulty-retune-ledger.test.js
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Used only 2 of the 3 available FOE_GRACE_AT_2 notches (0.75 -> 0.5) — the natural band (median exactly 4, reach>=5 >= 25%) was met after the second notch alone (smoke: p50Depth 4, reach5 25.9-29.0%), so the third notch (-> 0.35) was never turned, per the plan's own 'stop once in band, don't overshoot' rule."
  - "Followed the orchestrator's ladder cap literally: only foe-grace notches, the deep combat dials, ENCOUNTER_DOT_CAP/dark caps, and the hazard ramp's VALUES from floor 2 were eligible — the rations, hazard-from-floor-1, darkness-from-4, and floor-1-grace rungs were never turned regardless of the smoke reading, and are recorded under 'Not changed, and why' as available-but-not-taken with the planner's calibration numbers cited."
  - "Prioritized the forced-20 band over reach>=20 over the shallow natural rows, per the orchestrator's stated priority order — iterations 2-4 spent 3 of the 4 total moves on the deep ramp/dot-cap (COMBAT_SCALE_FROM_DEPTH, ENCOUNTER_DOT_CAP, FOE_POWER_MAX/ABILITY_THREAT_MAX) versus 1 move on the natural median (the single grace notch)."
  - "Recorded forced-20 floors-gained (both mean 0.84 and p50 0) as a genuine miss after the 4-iteration cap rather than a 5th, unsanctioned move — the residual lethality just past depth 20 is canon tier-4/5 combat (Herman, Drarl, Vampire), which none of the excluded ladder rungs (darkness/rations/hazard-from-1) would have addressed even if taken."
  - "Fixed a pre-existing test-authoring gap in difficulty-retune-ledger.test.js's heading-order check (Rule 1 — bug): the check used a raw-text regex scan for '### ' headings with no awareness of fenced code blocks, which would have broken the moment a verbatim tool transcript (containing its own '### ' sub-headings, e.g. class-pass-diff's '### By class') was pasted into the AFTER section. Added stripFences() so fenced-block content is blanked before the heading scan runs, matching how a real markdown renderer treats fences."

requirements-completed: [TUNE-06]

coverage:
  - id: D1
    description: "Bounded 4-iteration loop against the v1.2 band: deep-dial start values then COMBAT_SCALE_FROM_DEPTH pushed to full identity through depth 20 (6->21), FOE_GRACE_AT_2 taken one notch deeper (0.75->0.5), ENCOUNTER_DOT_CAP eased (15->13), FOE_POWER_MAX/ABILITY_THREAT_MAX flattened (1.3/1.5 -> 1.15/1.3) — every move parity-clean, iteration log recorded with smoke numbers at every step"
    requirement: TUNE-06
    verification:
      - kind: unit
        ref: "test/unit/combat-scaling.test.js PHASE_27_PINS + identity/monotone/grace-floor tests, test/difficulty/difficulty.test.js, test/unit/maze.test.js, test/determinism/foe-abilities.test.js"
        status: pass
      - kind: integration
        ref: "npm test (1448/1448), node --test \"test/parity/**/*.test.js\" (33/33, no new divergence)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full AFTER captured on pin 39bfecf (natural 143x40, forced-20 143x10) with Phase 26's exact Bot lines, cannot-act gate run FIRST (0 of 143) before any ledger edit"
    requirement: TUNE-06
    verification:
      - kind: other
        ref: "node tools/class-pass-diff.mjs --gate --after docs/class-pass/retune-after.json (cannot-act cells: 0 of 143)"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js, test/unit/difficulty-retune-ledger.test.js tests 7-10"
        status: pass
    human_judgment: false
  - id: D3
    description: "v1.2 ledger section completed: Change table, Comparison vs band (honest in/out at printed precision), Counterweight triggers (measured, neither fired), Not changed and why (every unreached rung named), no placeholders remain except the DR checklist/verdict"
    requirement: TUNE-06
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js (13 tests, including the 7 new provenance checks)"
        status: pass
    human_judgment: false

duration: ~72min
completed: 2026-09-15
status: complete
---

# Phase 27 Plan 3: Bounded Retune Iterations + Full AFTER + Ledger Completion Summary

**Ran the 4-iteration bounded loop against the v1.2 band (deep combat identity pushed through depth 20, one foe-grace notch deeper, encounter density eased), captured the full 143x40/143x10 AFTER on the resulting pin with a clean cannot-act gate, and closed out the v1.2 ledger with an honest change table and comparison — natural median/reach and forced-20 encounters-survived all landed in band; forced-20 floors-gained stayed short and is recorded as a miss for the DR round.**

## Performance

- **Duration:** ~72 min (includes a ~24 min background AFTER capture: 790s natural matrix + 166s forced-20 matrix + six tune-difficulty/tune-economy reports)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 9 (1 engine file, 5 test files, 1 doc, 2 new class-pass JSONs)

## Accomplishments

- **Bounded iteration loop, 4 of 4 used (Task 1):** Iteration 1 confirmed 27-02's landed set at full smoke scale and set the deep dials' iteration-1 start values (`COMBAT_SCALE_FROM_DEPTH` 6→16, `FOE_CAP_MAX` 5→4, `FOE_POWER_MAX` 1.6→1.3, `ABILITY_THREAT_MAX` 2.0→1.5) — forced-20 improved (1.56→2.85 encounters, 0.37→0.78 floors) but the natural median stayed at 3. Iteration 2 turned the ladder's second grace notch (`FOE_GRACE_AT_2` 0.75→0.5, parity-clean) and pushed `COMBAT_SCALE_FROM_DEPTH` to 21 (depth 20 now fully canon identity) — the natural band was met immediately (p50Depth 4, reach≥5 25.9–29.0%). Iteration 3 eased `ENCOUNTER_DOT_CAP` 15→13 for the still-missing forced-20 band (encounters-survived crossed into band: 3.24). Iteration 4 flattened `FOE_POWER_MAX`/`ABILITY_THREAT_MAX` to 1.15/1.3 (small further gain: 3.35 encounters, 0.87 floors). Every rung turned only ever touches floors 2-4 (foe grace) or depths ≥ `COMBAT_SCALE_FROM_DEPTH` (deep dials) or depths ≥ 3 (`ENCOUNTER_DOT_CAP`) — no fixture is exposed at those depths, so parity stayed 33/33 with the same single declared divergence (seed 303, Dante→Ned) from 27-02 throughout. Re-measured pins live (never hand-computed): `PHASE_27_PINS`, `NON_COMBAT_PINS` (depths 4-5 dots 12→11), `difficulty.test.js`'s Phase 27 easing pins, `maze.test.js`'s seed-42 depth-4/5 dot counts, and `foe-abilities.test.js`'s `humans-t2`/`magical-t4` determinism pins (confirmed unchanged draws/attacks/outcome at the deeper grace value).
- **Full AFTER on pin `39bfecf` (Task 2):** `docs/class-pass/retune-after.json` (143×40, 5720 runs) and `retune-after-depth20.json` (143×10, 1430 runs), both `meta.commit` `39bfecf` and `meta.bot` byte-identical to Phase 26's. Cannot-act gate run FIRST, before any ledger edit: **0 of 143**. Also captured `tune-difficulty --seeds=200` at natural/20/35/50 and the two counterweight-trigger readouts (`--party`, `tune-economy`). Ledger's `### AFTER readouts` section gained verbatim transcripts for all eight commands plus the `class-pass-diff.mjs --section after` rendering (Phase 26 AFTER → retune AFTER; Verdict/Reason columns deliberately blank — no class-specific tuning this phase).
- **Ledger finalised (Task 3):** Change table lists every dial (moved or not) with a Record column, plus the final curve at d=1..5/10/15/20/35/50. Comparison vs band judges every `rollups.pooled.*` row at printed precision: natural median (4, IN), natural reach≥5 (30.6%, IN), forced-20 encounters-survived (3.17, IN), cannot-act (0/143, IN) — but forced-20 floors-gained mean (0.84 vs target 1.0-2.0) and p50 (0 vs target ≥1) both missed, recorded honestly and handed to the DR round with the ladder's ceiling stated (residual lethality is canon tier-4/5 combat, not addressable by the excluded darkness/rations/hazard-from-1 rungs). Counterweight triggers measured: economy `peakGold` p50 456 (threshold >5000, not fired); party death-depth p50 5 vs 1.5×solo-p50 6 (not fired). "Not changed, and why" names every unreached ladder rung as available-but-not-taken with the planner's own calibration numbers. Extended `test/unit/difficulty-retune-ledger.test.js` with 7 new provenance checks and fixed a heading-scan bug the verbatim transcripts exposed (`stripFences()`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bounded iteration loop (1-4) — deep-ramp identity through depth 20, foe grace notch 0.75->0.5, dot-cap/power-ramp easing** - `39bfecf` (feat) — this commit is the pin Task 2 captures against
2. **Task 2: Full AFTER on the pin — natural 143x40 + forced-20 143x10, cannot-act gate, transcripts** - `f42e9e6` (test)
3. **Task 3: Ledger finalisation — change table, comparison vs band, triggers, not-changed, guard extended** - `ba0d538` (docs)

_Note: no separate plan-metadata commit — this SUMMARY plus the final `docs(27-03): ...` commit close out the plan per the orchestrator's final-commit step._

## Files Created/Modified

- `engine/difficulty.js` - final v1.2 constants: `COMBAT_SCALE_FROM_DEPTH` 21, `FOE_CAP_MAX` 4, `FOE_POWER_MAX` 1.15, `ABILITY_THREAT_MAX` 1.3, `ENCOUNTER_DOT_CAP` 13, `FOE_GRACE_AT_2` 0.5; rewritten "DELIBERATE RULES CHANGE (Phase 27, TUNE-06) — combat dials" block replacing the Phase 21 wording; every constant's JSDoc refreshed with its value at depth 20/35/50
- `test/unit/combat-scaling.test.js` - `PHASE_27_PINS`/`NON_COMBAT_PINS` re-measured for iterations 2-3
- `test/difficulty/difficulty.test.js` - `ENCOUNTER_DOT_CAP` named-constant assertion + Phase 27 easing pins (depths 3-5) re-measured
- `test/unit/maze.test.js` - seed-42 depth-4/5 dot counts re-measured (12->11)
- `test/determinism/foe-abilities.test.js` - `humans-t2`/`magical-t4` re-measured a third time (grace 0.75->0.5), comment note added
- `test/unit/difficulty-retune-ledger.test.js` - 7 new AFTER-provenance tests (7-13) + `stripFences()`/`subsection()` helpers
- `docs/DIFFICULTY-RETUNE.md` - iteration log (4 entries + orchestrator ladder-cap note + pin line), AFTER readouts section (verbatim transcripts + class-pass-diff rendering), Change table, Comparison vs band, Counterweight triggers, Not changed and why
- `docs/class-pass/retune-after.json` - NEW, 143x40 natural AFTER on pin 39bfecf
- `docs/class-pass/retune-after-depth20.json` - NEW, 143x10 forced-20 AFTER on pin 39bfecf

## Decisions Made

- **Used only 2 of 3 available grace notches.** The natural band (median exactly 4, reach≥5 ≥25%) was met after `FOE_GRACE_AT_2`'s second notch (0.75→0.5) alone; the third notch (→0.35), while permitted by the orchestrator's ladder cap, was never turned since the band was already in.
- **Followed the orchestrator's ladder cap literally, not the plan file's wider escalation ladder.** Only foe-grace notches, the deep combat dials, `ENCOUNTER_DOT_CAP`/dark caps, and the hazard ramp's VALUES (not its `FROM_DEPTH`) were eligible moves. The rations, hazard-from-floor-1, darkness-from-4, and floor-1-grace rungs were never turned regardless of what the smoke showed, and are recorded as "available, not taken" in the ledger.
- **Prioritized forced-20 over reach≥20 over the shallow rows**, per the orchestrator's stated order: 3 of 4 iteration moves targeted the deep ramp/dot-cap; only 1 targeted the natural median.
- **Recorded the forced-20 floors-gained miss honestly** rather than chasing a 5th iteration — the residual lethality past depth 20 is canon tier-4/5 combat (Herman, Drarl, Vampire), which the excluded ladder rungs would not have addressed even if taken.
- **Fixed a heading-scan bug in the ledger's own guard test** (Rule 1): `difficulty-retune-ledger.test.js`'s H3 heading-order check did a raw-text regex scan with no fenced-code-block awareness, which broke once verbatim tool transcripts (containing their own `### ` sub-headings) were embedded in the AFTER section. Added `stripFences()` to blank fenced-block bodies before the heading scan, and a stricter `subsection()` helper (stops at the next H2 OR H3, not just H2) for the new band-path/change-table coverage checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `difficulty-retune-ledger.test.js`'s heading-order test would have broken on verbatim tool transcripts**
- **Found during:** Task 2 (writing the AFTER readouts section with verbatim `tune-classes`/`class-pass-diff` transcripts)
- **Issue:** The plan's own tools (`class-pass-diff.mjs --section after`) print output containing lines like `### By class — BEFORE → AFTER` — real markdown H3 syntax, but inside a fenced code block it is not a real document heading. The pre-existing test's `h3Lines` extraction used a raw multiline regex over the whole section with no fence awareness, so embedding the verbatim transcript (as the plan requires) would have inflated the H3 count and broken the fixed-order assertion.
- **Fix:** Added `stripFences()` (blanks fenced-block bodies, keeping fence lines for line-count stability) and ran the H3 heading scan over the fence-stripped text instead of the raw section text.
- **Files modified:** `test/unit/difficulty-retune-ledger.test.js`
- **Verification:** `node --test test/unit/difficulty-retune-ledger.test.js` (13/13 pass, including the pre-existing heading-order test).
- **Committed in:** `ba0d538` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in a test, not the engine). No scope creep, no gameplay-numbers change beyond what the plan itself directs.

## Issues Encountered

- The `after-party.txt` capture (`tune-difficulty --seeds=200 --party`) ran considerably longer than the other 200-seed `tune-difficulty` reports (roughly 15 minutes vs a few seconds each) — party mode simulates a full multi-character party per seed, which is meaningfully heavier per-run than a solo simulation. Not a bug; just the long pole among the "small" captures, handled with the same bounded-poll pattern as the natural/forced-20 matrices.
- Windows Git Bash's `node --test <directory>` (bare directory argument, e.g. `node --test test/difficulty`) failed with `MODULE_NOT_FOUND` in this environment, while explicit glob patterns (`node --test test/difficulty/*.test.js`) worked correctly. Worked around by using explicit file globs for every verify invocation; this is a pre-existing environment quirk, not caused by this plan's changes (confirmed the same directory-arg failure occurs against the unmodified 27-02 tree).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The debug APK build (`npm run android:debug`) and the DR checklist (Run 1 forced 20 / Run 2 forced 35 / Run 3 forced 50 / Run 4 natural) are 27-04's job. This plan's tree is clean, built (`npm run build:www` green), and fully tested (1448/1448, parity 33/33) at the commit `ba0d538` that 27-04 should build from.
- **Flag for 27-04 / the DR round:** the natural median/reach and forced-20 encounters-survived rows are all IN band on the bot proxy — the two remaining misses (forced-20 floors-gained mean 0.84, p50 0) mean the bot rarely progresses to a NEW floor past depth 20 even though it survives more fights there. The DR round should specifically watch whether a human, playing better than the bot's fixed thresholds, experiences this as "dangerous, not hopeless" (the user's own acceptance bar) or still as a wall — this is exactly the gap the bot proxy cannot resolve on its own.
- Neither counterweight trigger (economy, party) fired — no upkeep/economy follow-up is queued.
- `FOE_GRACE_AT_2`'s third notch (0.5→0.35) remains available but unused if a future "tune-again" pass needs it; `tools/lib/tuning-bot.mjs`, `test/parity/prototype-master.js.txt`, and `test/parity/harness/comparables.js` remain byte-identical to their pins throughout.

---
*Phase: 27-delve-to-death-retune*
*Completed: 2026-09-15*

## Self-Check: PASSED

All 9 modified/created files confirmed present on disk; all 3 task commit hashes (39bfecf, f42e9e6, ba0d538) confirmed present in `git log --oneline --all`.
