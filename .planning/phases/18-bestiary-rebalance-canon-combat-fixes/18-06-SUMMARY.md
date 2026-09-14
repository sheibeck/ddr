---
phase: 18-bestiary-rebalance-canon-combat-fixes
plan: 06
subsystem: content
tags: [bestiary, balance, content-table, node-test, parity, invariant, docs]

requires:
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-01: bestiary-yardstick.mjs, BESTIARY-REBALANCE.md BEFORE table and review verdicts"
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-02: engine/foeDamage.js seam, damageFoe/multiplierFor"
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-03/18-04: engine/combat.js, engine/magic.js, engine/items.js routed through the seam"
  - phase: 18-bestiary-rebalance-canon-combat-fixes
    provides: "18-05: rebalanced content/bestiary.js numbers (Drake, Werebeast, Djinni x2, Krupke, Drudge x2, Vampire, Stalka Beast)"
provides:
  - "test/unit/foe-damage.test.js: seam-only invariant test proving damageFoe is the ONLY foe-wp decrement site (D-09 promote)"
  - "test/unit/bestiary-yardstick.test.js: D-04 doc-consistency test binding BESTIARY-REBALANCE.md's AFTER block to the live canon-mode yardstick"
  - "content/BESTIARY-REBALANCE.md: completed AFTER table (55 rows, canon mode), tune-difficulty AFTER readout, change ledger with measured ratios and deferred canon-mode consequences, measured zero-carve-out statement"
affects: [21-consolidated-difficulty-retune]

tech-stack:
  added: []
  patterns: ["source-assertion invariant test (stripComments + regex count) mirroring test/unit/combat.test.js's no-Math.random pattern", "doc-consistency test slicing a markdown file between marker comments and diffing against live generator output, mirroring test/parity/fixture-inventory.test.js"]

key-files:
  created: []
  modified:
    - test/unit/foe-damage.test.js
    - test/unit/bestiary-yardstick.test.js
    - content/BESTIARY-REBALANCE.md

key-decisions:
  - "Foe-decrement regex matches only t./f./o./foe. + .wp -= (word-boundary identifiers used by the engine's foe loop/target variables), explicitly excluding c. (hero) and member. (party member) so their legitimate decrements are never flagged"
  - "AFTER table generated verbatim via node tools/bestiary-yardstick.mjs (canon mode, default) and pasted between the yardstick:after markers with zero hand edits; the D-04 consistency test normalizes CRLF/trailing-whitespace/outer-blank-lines the same way on both sides before comparing"
  - "Change ledger's Prototype-mode TTK/lethality columns are measured against --mechanics=prototype (number-only fix, canon mechanics still inert) to isolate D-03/D-18's effect from D-05/D-06's separately-recorded canon-mode consequences"
  - "Tune-difficulty AFTER readout treated as informational only (D-16): the bot fights melee-only with a starting kit and never reaches the tier-4/5 creatures this phase retuned, so the death-depth distribution staying within noise of BEFORE is the expected, correct result, not a gap"

patterns-established:
  - "Doc-consistency test pattern (marker-sliced block vs. live generator output, normalized) is now available for any future generated-and-committed markdown table"

requirements-completed: [BEST-01, BEST-03, CANON-01, FID-05]

coverage:
  - id: D1
    description: "Seam-only invariant: zero foe-side wp decrements outside engine/foeDamage.js; exactly one inside it; hero/member decrements untouched (D-09 promote)"
    requirement: CANON-01
    verification:
      - kind: unit
        ref: "test/unit/foe-damage.test.js#invariant: engine/combat.js, engine/magic.js and engine/items.js contain zero foe-side wp decrements on code lines"
        status: pass
      - kind: unit
        ref: "test/unit/foe-damage.test.js#invariant: engine/foeDamage.js contains exactly one foe-side wp decrement (the seam itself)"
        status: pass
      - kind: unit
        ref: "test/unit/foe-damage.test.js#sanity: the regex would catch a violation, and does not match a hero-side decrement"
        status: pass
      - kind: unit
        ref: "test/unit/foe-damage.test.js#sanity: the hero and party-member wp decrements still exist, untouched, in combat.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "BESTIARY-REBALANCE.md AFTER table (55 rows, canon mode) generated verbatim from tools/bestiary-yardstick.mjs and kept honest by a doc-consistency test"
    requirement: BEST-01
    verification:
      - kind: unit
        ref: "test/unit/bestiary-yardstick.test.js#BESTIARY-REBALANCE.md AFTER block matches the live canon-mode yardstick (D-04 doc consistency)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tune-difficulty AFTER readout (200 seeds) transcribed beside BEFORE with informational-not-a-gate framing and a comparison sentence (D-16)"
    requirement: BEST-01
    verification:
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=200 (run out-of-band by the orchestrator; output transcribed into content/BESTIARY-REBALANCE.md's tune-difficulty AFTER section)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Change ledger records every changed entry's measured prototype-mode ratio and every canon-mode consequence (Sterling, five sp.ar creatures, Philly) as intended-and-deferred to Phase 21"
    requirement: BEST-01
    verification:
      - kind: manual_procedural
        ref: "content/BESTIARY-REBALANCE.md ## Change ledger and ### Unchanged by decision tables, cross-checked against 18-01/18-05's numbers"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate: zero carve-outs/regenerations measured; parity 30/30 byte-identical; frozen files untouched since e01ac46; npm test green at 796"
    requirement: FID-05
    verification:
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30 pass)"
        status: pass
      - kind: other
        ref: "git diff --quiet e01ac46 -- test/parity/fixtures test/parity/harness/comparables.js test/parity/prototype-master.js.txt engine/difficulty.js package.json package-lock.json"
        status: pass
      - kind: unit
        ref: "npm test (796/796 pass)"
        status: pass
    human_judgment: false

duration: 45min (across stall + resume)
completed: 2026-09-13
status: complete
---

# Phase 18 Plan 06: Bestiary Rebalance Canon Combat Fixes Summary

**Closed Phase 18 with a seam-only invariant test (damageFoe is the ONLY foe-wp decrement site), the generated canon-mode AFTER yardstick table (55 rows, machine-checked against BESTIARY-REBALANCE.md), both tune-difficulty readouts, a full change ledger with measured ratios, and a green phase gate (npm test 796/796, parity 30/30 byte-identical, zero carve-outs).**

## Performance

- **Duration:** ~45 min total (a prior executor completed Task 1 and stalled mid-Task 2 waiting on the 6-minute tune-difficulty run; this resume completed Task 2)
- **Completed:** 2026-09-13
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Added the Phase 18 seam-only invariant to `test/unit/foe-damage.test.js`: a source-assertion test (stripComments + regex count) proves zero foe-side `wp` decrements remain in `engine/combat.js`, `engine/magic.js`, or `engine/items.js`, and exactly one exists in `engine/foeDamage.js` (the seam) — with sanity tests confirming the regex would catch a real violation and that the hero's `c.wp -=` and party member's `member.wp -= mDmg` decrements remain untouched. No violations found — 18-03/18-04's routing was already complete.
- Generated and pasted the canon-mode AFTER yardstick table (55 rows, `Mechanics: canon`) verbatim from `tools/bestiary-yardstick.mjs` between the `yardstick:after` markers, and added a D-04 doc-consistency test in `test/unit/bestiary-yardstick.test.js` that slices the committed block and diffs it against the live `computeYardstick(BESTIARY, { mechanics: "canon" })` output — a hand-edited or stale AFTER block now fails `npm test`.
- Transcribed the tune-difficulty AFTER readout (200 seeds) alongside the BEFORE readout, with a comparison sentence: death-depth distribution is within noise of BEFORE (p50 stays 1, p90 stays 2, max shrinks 6→4), and the top-5 death causes are unchanged in composition — expected per D-16, since the bot fights melee-only with a starting kit and never reaches the tier-4/5 creatures this phase retuned.
- Wrote the change ledger: measured prototype-mode TTK/lethality ratios for every D-18/D-03 fix (Drake 2.05x, Werebeast lethality 1.94x, Djinni T4 3.51x/T5 1.63x, Krupke 1.42x, Drudge 0.49x/0.23x, Vampire 1.77x, Stalka Beast 2.35x), plus an "Unchanged by decision" table recording every canon-mode consequence deferred to Phase 21 (Sterling two-hearts at 4.38x, the five `sp.ar` creatures' canon melee TTK, Philly resolved by slow, Dante/Cave Bear/Herman dispositions).
- Updated the parity carve-outs section from planned to measured: zero carve-outs, zero regenerations, confirmed by `git diff --quiet e01ac46 -- ...` (exit 0), `node --test "test/parity/**/*.test.js"` (30/30), and `test/parity/fixture-inventory.test.js` green. Added a "Regenerating this document" checklist for future maintainers.
- Ran the full phase gate: `npm test` 796/796 passing (724 baseline + 10 (18-01) + 18 (18-02) + 20 (18-03) + 8 (18-04) + 11 (18-05) + 5 (18-06) = 796, matching the plan's exact predicted count).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the seam-only invariant test (damageFoe is the only foe-wp decrement site)** - `ad1ad6f` (test) — completed by the prior executor before the stall
2. **Task 2: Generate and paste the AFTER table (+ its consistency test), capture the tune-difficulty AFTER readout, write the change ledger, and run the phase gate** - `5b8699c` (docs)

_Note: no TDD tasks in this plan._

## Files Created/Modified
- `test/unit/foe-damage.test.js` - Phase 18 invariant section: source-assertion tests proving the seam is the only foe-wp decrement site (Task 1, prior executor)
- `test/unit/bestiary-yardstick.test.js` - D-04 doc-consistency test binding BESTIARY-REBALANCE.md's AFTER block to the live canon-mode yardstick output
- `content/BESTIARY-REBALANCE.md` - completed AFTER table (55 rows), tune-difficulty AFTER readout, change ledger with measured ratios, "Unchanged by decision" table, measured parity carve-outs section, "Regenerating this document" checklist

## Decisions Made
- Kept the prior executor's uncommitted Task-2 work (AFTER table paste, doc-consistency test, ledger skeleton, carve-out section rewrite) as-is after verifying it against the plan's acceptance criteria — it was correct and complete except for two gaps: the tune-difficulty AFTER readout placeholder and one acceptance-criteria grep match (`135 → 38` needed to appear twice: once in the Review Verdicts table, once in the ledger — the ledger's Drake row originally split Before/After into separate table cells per the plan's own column spec, so I added the literal `wp 135 → 38` phrase into the ledger's Note column, satisfying both the acceptance check and human-readability without touching any other cell).
- Transcribed the tune-difficulty AFTER readout from the orchestrator's background run (seeds=200) rather than re-running it — the plan explicitly warns this run takes ~5-6 minutes and stalled the prior executor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ledger's Drake row missing the greppable `135 → 38` phrase**
- **Found during:** Task 2 acceptance-criteria verification (resumed work)
- **Issue:** The plan's acceptance criteria require `grep -c '135 → 38\|135 -> 38'` to print at least 2 (verdict table + ledger), but the ledger table's Before/After columns were split into separate cells (`| 135 | 38 |`) per the plan's own literal column spec, so only the Review Verdicts table's occurrence matched.
- **Fix:** Added the literal phrase `wp 135 → 38` into the ledger row's Note column, preserving the existing Before/After columns unchanged.
- **Files modified:** content/BESTIARY-REBALANCE.md
- **Verification:** `grep -c '135 → 38\|135 -> 38' content/BESTIARY-REBALANCE.md` now prints 2
- **Committed in:** 5b8699c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 doc-consistency nit)
**Impact on plan:** Cosmetic doc fix only. No engine, content-number, or test-pin changes. No scope creep.

## Issues Encountered
- A prior executor stalled mid-Task 2 waiting in the foreground for `node tools/tune-difficulty.mjs --seeds=200` (a ~5-6 minute run). This resume inherited its correct partial edits (AFTER table, doc-consistency test, ledger, carve-out rewrite) via `git diff` inspection, and consumed the orchestrator's already-running background tune-difficulty output (`.../scratchpad/tune-after.txt`) instead of re-running the tool, polling it in bounded ≤120s checks until its `EXIT=0` sentinel appeared.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 18 is complete: the seam is now a maintained invariant (any future foe-wp decrement bypassing `damageFoe` fails `npm test`), and `content/BESTIARY-REBALANCE.md` gives Phase 21 everything it needs to start its consolidated retune — the BEFORE/AFTER yardstick tables (prototype and canon), both tune-difficulty readouts, and a change ledger explicitly naming every deferred canon-mode consequence (Sterling's two-heart halfDmg, the five `sp.ar` creatures' natural-armor TTK inflation, Dante's fixture-locked outlier status, Cave Bear's borderline flag). `npm test` is green at 796/796; parity remains byte-identical to `e01ac46` with zero carve-outs and zero fixture regenerations across the entire phase.

---
*Phase: 18-bestiary-rebalance-canon-combat-fixes*
*Completed: 2026-09-13*

## Self-Check: PASSED

- FOUND: test/unit/foe-damage.test.js
- FOUND: test/unit/bestiary-yardstick.test.js
- FOUND: content/BESTIARY-REBALANCE.md
- FOUND: .planning/phases/18-bestiary-rebalance-canon-combat-fixes/18-06-SUMMARY.md
- FOUND commit: ad1ad6f
- FOUND commit: 5b8699c
