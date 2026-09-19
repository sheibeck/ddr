---
phase: 36-balance-foundation-effect-timers-small-independent-wins
plan: 01
subsystem: testing
tags: [class-matrix, before-pin, tuning-proxy, ledger, tune-classes, class-pass-diff]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    provides: docs/CLASS-PASS.md ledger structure, tools/class-pass-diff.mjs verdict machinery, docs/class-pass/before*.json / after*.json precedent
  - phase: 27-delve-to-death-retune
    provides: docs/class-pass/retune-after.json / retune-after-depth20.json (pin 39bfecf) — the v1.2 close, used as this plan's comparison column
provides:
  - "docs/class-pass/v15-before.json and docs/class-pass/v15-before-depth20.json — the v1.5 milestone's committed BEFORE class-matrix pin (BAL-01), taken before any Phase 36 engine/content/src/shell byte changes"
  - "docs/CLASS-PASS.md '## v1.5 BEFORE — commit e69ff07 (Phase 36 — BAL-01)' section (pin/provenance, pooled rollups vs the v1.2 retune-AFTER pin, both transcripts, cannot-act gate result)"
  - "test/unit/class-pass-ledger.test.js extended additively (14 tests total) pinning the v1.5 BEFORE section's structure/hash/provenance against the two new JSONs"
affects: ["42-mass-playtest-and-tuning-verdicts-v1.5", "phase 42's AFTER matrix diffs against this BEFORE pin"]

# Tech tracking
tech-stack:
  added: []
  patterns: ["v1.5 BEFORE matrix pin mirrors the v1.2 BEFORE/AFTER ledger convention exactly — same run parameters, same file-naming scheme (v15- prefix), same additive guard-test extension technique"]

key-files:
  created:
    - docs/class-pass/v15-before.json
    - docs/class-pass/v15-before-depth20.json
    - .planning/phases/36-balance-foundation-effect-timers-small-independent-wins/36-01-SUMMARY.md
  modified:
    - docs/CLASS-PASS.md
    - test/unit/class-pass-ledger.test.js

key-decisions:
  - "Transcript fenced blocks in the new '## v1.5 BEFORE' section include the trailing `Bot:`/`Stuck:`/`elapsed:`/`EXIT=0` lines verbatim, matching the established BEFORE/AFTER section precedent in docs/CLASS-PASS.md exactly (both existing sections include them), rather than stripping elapsed/EXIT per the plan's Task 1 step-5 scratch-file note, which described what to extract into scratch files for reference, not a literal transcript-formatting rule — no acceptance criterion forbids their presence and every existing ledger section keeps them."
  - "A pre-existing uncommitted STATE.md change (the orchestrator's own 'Phase 36 execution started' marker) blocked the plan's literal `git status --porcelain` clean-tree preflight; committed it separately first (chore commit e69ff07, not touching engine/content/src/shell) so the preflight gate could pass honestly rather than being skipped or worked around."

requirements-completed: [BAL-01]

coverage:
  - id: D1
    description: "docs/class-pass/v15-before.json and v15-before-depth20.json committed, both carrying meta.commit == e69ff07 (byte-identical to v1.4.0 for engine/content/src/mazeworld.html)"
    requirement: BAL-01
    verification:
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js#v1.5 BEFORE hash equals v15-before.json and v15-before-depth20.json meta.commit"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js#v1.5 BEFORE meta parity with the v1.2 BEFORE pair (modulo commit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-before.json prints 'cannot-act cells: 0 of 143' and exits 0"
    requirement: BAL-01
    verification:
      - kind: other
        ref: "node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-before.json (manual command, output: 'cannot-act cells: 0 of 143', exit 0)"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js#v1.5 BEFORE: identical 143 cell keys and zero cannot-act / zero stuck"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/CLASS-PASS.md ninth H2 '## v1.5 BEFORE — commit <40-hex> (Phase 36 — BAL-01)' section with pin/provenance, both command lines, both wall times, both verbatim Bot: lines, both transcripts, and a pooled-rollup table"
    requirement: BAL-01
    verification:
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js#sections: exactly nine H2 headings, in the fixed order, v1.5 BEFORE last"
        status: pass
      - kind: unit
        ref: "test/unit/class-pass-ledger.test.js#v1.5 BEFORE hash equals v15-before.json and v15-before-depth20.json meta.commit"
        status: pass
    human_judgment: false
  - id: D4
    description: "test/unit/class-pass-ledger.test.js pins the eight v1.2 H2 headings at indices 0-7 plus the new v1.5 BEFORE section; npm test prints '# fail 0'"
    requirement: BAL-01
    verification:
      - kind: unit
        ref: "node --test test/unit/class-pass-ledger.test.js (14/14 pass)"
        status: pass
      - kind: other
        ref: "npm test (2182/2182 pass, # fail 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No engine/content/src/mazeworld.html byte changed by this plan"
    requirement: BAL-01
    verification:
      - kind: other
        ref: "git diff --stat v1.4.0 -- engine content src mazeworld.html (empty, checked before and after the commit)"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-09-17
status: complete
---

# Phase 36 Plan 01: v1.5 BEFORE Class-Matrix Pin (BAL-01) Summary

**Pinned the v1.5 milestone's BEFORE class-matrix snapshot (143 cells x 40 natural-start seeds + 143 cells x 10 depth-20 seeds) against engine commit `e69ff07` (byte-identical to tag `v1.4.0`), appended as a new ledger section in `docs/CLASS-PASS.md`, before any other Phase 36 plan touches an engine/content/src/shell byte.**

## Performance

- **Duration:** 27 min (most of it background matrix-run wall time: ~14.2 min + ~1.9 min)
- **Started:** 2026-09-17T15:56:00Z
- **Completed:** 2026-09-17T16:23:00Z
- **Tasks:** 2
- **Files modified:** 4 (plus this SUMMARY, plus STATE.md/ROADMAP.md/REQUIREMENTS.md in the final metadata commit)

## Accomplishments
- Ran the exact v1.2 BEFORE-matrix protocol (`tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000` and `--seeds 10 --start-depth 20`) against the pinned commit `e69ff0769c3ad06a5e3ab4da8c670e85aecd972f`, producing `docs/class-pass/v15-before.json` and `docs/class-pass/v15-before-depth20.json` — both zero stuck, zero cannot-act cells (`node tools/class-pass-diff.mjs --gate` confirms `cannot-act cells: 0 of 143`).
- Appended `## v1.5 BEFORE — commit e69ff0769c3ad06a5e3ab4da8c670e85aecd972f (Phase 36 — BAL-01)` as the ninth H2 in `docs/CLASS-PASS.md`, with pin/provenance, a pooled-rollups comparison table against the v1.2 retune-AFTER pin (`39bfecf`), and both full verbatim transcripts.
- Extended `test/unit/class-pass-ledger.test.js` additively: heading count 8 → 9, three new tests pinning the v1.5 BEFORE section's hash, provenance, meta-parity-modulo-commit against the v1.2 BEFORE pair, and identical-143-cell-keys/zero-cannot-act/zero-stuck — all eight pre-existing v1.2 assertions unchanged (14/14 tests pass).
- Verified zero engine/content/src/shell byte drift throughout: `git diff --quiet v1.4.0 -- engine content src mazeworld.html` exits 0 before, during, and after the capture; `npm test` 2182/2182 pass.

## Task Commits

1. **Task 1 + Task 2 (combined, per plan design — Task 2 step 5 explicitly commits both tasks' artifacts in one commit):** `b274df6` (docs) — `docs(36-01): v1.5 BEFORE class matrix — 143x40 natural + 143x10 depth-20, engine pinned e69ff07 (byte-identical to v1.4.0)`
   - `docs/class-pass/v15-before.json`, `docs/class-pass/v15-before-depth20.json`, `docs/CLASS-PASS.md`, `test/unit/class-pass-ledger.test.js`

**Pre-plan cleanup commit (not a plan task):** `e69ff07` (docs) — `docs(36): mark phase 36 execution started` — committed the orchestrator's own pending STATE.md "execution started" marker so the plan's literal `git status --porcelain` clean-tree preflight could pass honestly (see Decisions below). This commit is also the pin's HEAD, since it landed immediately before the preflight ran.

**Plan metadata:** committed at the end of this SUMMARY step (STATE.md, ROADMAP.md, REQUIREMENTS.md, this SUMMARY.md).

_Note: no TDD tasks in this plan — both tasks are `type="auto"` measurement/documentation tasks._

## Files Created/Modified
- `docs/class-pass/v15-before.json` - v1.5 BEFORE natural-start matrix (143 cells x 40 seeds, start depth 1), meta.commit = `e69ff07`
- `docs/class-pass/v15-before-depth20.json` - v1.5 BEFORE depth-20 slice (143 cells x 10 seeds, start depth 20), meta.commit = `e69ff07`
- `docs/CLASS-PASS.md` - new ninth H2 section `## v1.5 BEFORE — commit e69ff0769c3ad06a5e3ab4da8c670e85aecd972f (Phase 36 — BAL-01)` with pin/provenance, pooled rollups table, both transcripts
- `test/unit/class-pass-ledger.test.js` - additive extension (8→9 headings; 3 new tests: hash/provenance, meta-parity-modulo-commit, identical-cell-keys/cannot-act/stuck)

## Decisions Made
- **Transcript formatting:** kept the `Bot:`/`Stuck:`/`elapsed:`/`EXIT=0` lines inside both fenced transcript blocks, matching the established precedent in the existing BEFORE (v1.2, line ~135) and AFTER (Phase 26, line ~1073) sections of `docs/CLASS-PASS.md` exactly, rather than stripping `elapsed:`/`EXIT=` per a literal reading of Task 1 step 5 (which describes what to extract into scratch files, not a ledger-formatting rule). No acceptance criterion in the plan forbids their presence, and every existing ledger transcript keeps them.
- **Preflight clean-tree gate:** found `.planning/STATE.md` already modified (the orchestrator's own pre-spawn "Phase 36 execution started" marker, unrelated to engine/content/src) when starting Task 1's preflight. Committed it separately first (`e69ff07`) rather than working around or skipping the literal `git status --porcelain` check, since this is exactly the kind of non-engine housekeeping change the orchestrator is expected to make before spawning an executor, and the plan's preflight is designed to catch genuine engine drift, not orchestrator bookkeeping.
- **Single combined commit for both tasks:** followed the plan's own explicit design (Task 2 step 5: "Commit all four files in ONE commit") rather than the standard "commit after each task" default — Task 1's JSON artifacts are direct inputs to Task 2's guard test and ledger section, so splitting the commit would leave an intermediate state with untracked JSONs and no way to verify Task 1 in isolation without re-deriving Task 2's checks.

## Deviations from Plan

None beyond the two decisions above (both documented as Rule 3-class blocking-issue fixes: the STATE.md preflight blocker was fixed inline per Rule 3, and the transcript-formatting question was resolved by following the ledger's own established precedent rather than a stricter reading of prep-step prose).

## Issues Encountered
None. Both background matrix runs completed cleanly on the first attempt (`EXIT=0`), no cannot-act cells, no stuck runs, no rng/engine drift detected at any checkpoint.

## Human verification (deferred to end of run)

Per the milestone's `defer uat to end` protocol, no on-device checks are required for this plan — it is a pure measurement/documentation plan with zero engine, content, src, or shell changes. Nothing to add to the aggregated Pixel 7 checklist for this plan specifically.

(Optional, no action needed now) When the aggregated end-of-milestone device round happens, the app build itself is expected to behave identically to 1.4.0 — this plan changed no player-visible code.

## Assumption-delta / rng / serialized-field statements (from plan frontmatter)

- **assumption_delta:** no-change — trigger was the roadmap's research-flag prose (`--research-phase` optional); no primary-key/identity model changes in this phase.
- **rng_draw_impact:** adds zero draws — this plan changes no engine/content/src/shell file.
- **serialized_field_impact:** none — no engine/content/src/shell file changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The v1.5 BEFORE pin is locked and committed; Phase 36 Plans 02-06 (effects.js, targeting, Cutthroat, dismissJoiner, Company panel) can now land engine/content/src/shell changes without risk of losing an unrecoverable BEFORE baseline.
- Phase 42 (BAL-02) has its like-for-like yardstick ready: `docs/class-pass/v15-before.json` / `v15-before-depth20.json` plus the pooled-rollups comparison table in `docs/CLASS-PASS.md`'s new section.
- No blockers.

---
*Phase: 36-balance-foundation-effect-timers-small-independent-wins*
*Completed: 2026-09-17*

## Self-Check: PASSED

All created/modified files found on disk (docs/class-pass/v15-before.json, docs/class-pass/v15-before-depth20.json, docs/CLASS-PASS.md, test/unit/class-pass-ledger.test.js, this SUMMARY.md); both commit hashes (`e69ff07`, `b274df6`) found in `git log --oneline --all`.
