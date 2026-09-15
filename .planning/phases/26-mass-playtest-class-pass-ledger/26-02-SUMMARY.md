---
phase: 26-mass-playtest-class-pass-ledger
plan: 02
subsystem: testing
tags: [class-pass, after-snapshot, capture, ledger, commit-pin, cannot-act-gate, blocked]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 01
    provides: "tools/class-pass-diff.mjs --gate mode (cannot-act hard gate CLI)"
provides:
  - "docs/class-pass/after.json — natural-start AFTER matrix aggregates (143 cells x 40 seeds, 5,720 runs), commit-pinned to 620e1df — committed as GATE FAILED evidence, NOT wired into the ledger"
  - "A reproduced, gate-confirmed cannot-act regression: Fighter/Samurai/Dwarven has 1 stuck run at the current pin (0 at the BEFORE pin 5565b22)"
affects: ["26-03", "26-04", "a future gap-closure phase"]

tech-stack:
  added: []
  patterns:
    - "Deviation Rule 4 STOP for a failing hard gate: commit only the raw captured evidence (the JSON), never touch the ledger doc or engine/bot code, and report back for an explicit orchestrator/human decision rather than judging around a cannot-act cell"

key-files:
  created:
    - docs/class-pass/after.json
  modified: []

key-decisions:
  - "Per this plan's invoking instructions (orchestrator Hard Rules, which took precedence over the PLAN.md task text's more conservative 'do NOT commit anything'), the captured docs/class-pass/after.json was committed on its own as GATE FAILED evidence so the raw run is preserved in git history for the orchestrator's review; docs/CLASS-PASS.md, docs/class-pass/after-depth20.json, and docs/class-pass/verdicts.json were NOT touched — no ledger edit, no Task 2 depth-20 run, no Task 3 commit"
  - "Task 2 (depth-20 slice) was deliberately not run: the plan's Task 1 action explicitly says 'do NOT run Task 2' when the gate returns rc=3, and the depth-20 slice's parameters and gate exemption are irrelevant once the natural matrix's hard gate has already failed"
  - "No investigation, bot-policy change, or engine change was attempted for the stuck cell — that is explicitly out of this plan's scope (Deviation Rule 4: architectural/engine decision, not a local auto-fix) and belongs to a future gap-closure phase per 26-CONTEXT.md"

requirements-completed: []

coverage:
  - id: D1
    description: "Natural-start AFTER matrix (143 x 40, 5,720 runs) captured against the pinned, proven-clean engine (620e1df) with the BEFORE Bot: line byte-for-byte, correct meta (seeds=40, startDepth=1, maxActions=5000, workers=4, exploreBudget=50, 143 cells, meta.commit=620e1df, no rows key, every cell n=40)"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "node -e verify script printed '40 1 5000 4 143 false true true'; scratchpad transcript ends EXIT=0 with one Bot: line and one elapsed: line"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cannot-act hard gate run BEFORE any ledger edit: node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "gate output: 'cannot-act cells: 1 of 143 / Fighter/Samurai/Dwarven kills=6.82 stuck=1 completed=39', exit code 3"
        status: fail
    human_judgment: true
    rationale: "The gate itself failed (this IS the finding, not a test bug) — a human/orchestrator decision is required on whether a gap-closure phase fixes the stuck loop before 26-03/26-04 proceed, per 26-CONTEXT.md's 'Cannot act is a hard gate' rule. Coverage recorded as fail/human_judgment so verify-work does not silently auto-pass a failed milestone gate."
  - id: D3
    description: "Engine/content/src/mazeworld.html/tools stayed byte-identical to the pin before and after this plan's activity; harness stayed byte-identical to the BEFORE pin 5565b22"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "git diff --quiet 620e1df -- engine content src mazeworld.html tools (rc=0, checked pre-launch and post-commit); git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib (rc=0)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-09-15
status: blocked
---

# Phase 26 Plan 02: AFTER Natural Matrix Capture — Cannot-Act Gate FAILED

**Captured the 143x40 natural-start AFTER matrix at the current engine pin (620e1df) with BEFORE-identical parameters, but the milestone's cannot-act hard gate found a regression — Fighter/Samurai/Dwarven now has 1 stuck run (0 at the BEFORE pin) — so per Deviation Rule 4 the plan stopped: only the raw evidence JSON was committed, the ledger and depth-20 slice were left untouched, and the outcome is reported for an explicit decision.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-15
- **Tasks:** 1 of 3 (Task 1 ran to its gate check and stopped there per plan instruction; Tasks 2-3 intentionally not run)
- **Files modified:** 1 (created: `docs/class-pass/after.json`)

## Accomplishments

- **Preflight proved the capture's provenance is sound**: `git status --porcelain` clean, `npm test` 1409/1409 (`# fail 0`), pin `PIN=620e1df8779d4da2ce18bb3b8cd693be31e2280e` (short `620e1df`) confirmed `git diff --quiet`-clean against `engine content src mazeworld.html tools`, and the harness (`tools/tune-classes.mjs`, `tools/lib`) confirmed byte-identical to the BEFORE pin `5565b22`. 31 engine/content/src commits landed between `5565b22` and `620e1df` (Phases 23-25.1), diffstat `18 files changed, 2827 insertions(+), 297 deletions(-)`.
- **Natural-start matrix captured**: `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/after.json` — 143 cells x 40 seeds = 5,720 runs, completed in **1071.2s (~17.9 min)** on 4 workers (vs. BEFORE's 687.2s — casters now act, per Phase 23, and are living longer, which lengthens average run time). `meta.commit === "620e1df"`, `meta.bot` byte-identical to `before.json`'s (verified via `node -e` equality check).
- **Cannot-act hard gate FAILED**: `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` printed:
  ```
  cannot-act cells: 1 of 143
  Fighter/Samurai/Dwarven  kills=6.82  stuck=1  completed=39  top causes: cut down by a Dante(9),cut down by a Philly(6),cut down by a Shadow(3)
  ```
  exit code **3**. The transcript's own `Stuck:` line confirms: `Stuck: 1 of 5720 runs hit maxActions=5000 (own bucket; excluded from depth stats)`.
  - **BEFORE comparison for this exact cell** (`before.json`): `stuck: 0`, `completed: 40`, `meanKills: 5.43`, top causes `cut down by a Dante(12), cut down by a Philly(4), cut down by a Gremlin(3)`. The stuck run is a **new regression at the current pin**, not a pre-existing BEFORE condition — Phase 23-25's caster/engine changes introduced a hang for at least one Fighter/Samurai/Dwarven seed that the pre-identity-pass engine did not hit.
- **Per Deviation Rule 4 and the plan's explicit Task 1 instruction for `rc=3`**: Task 2 (depth-20 slice) was NOT run, `docs/CLASS-PASS.md` was NOT edited (the `## AFTER — commit \`<hash>\`` placeholder is untouched), no bot-policy or engine change was attempted. `docs/class-pass/after.json` was committed on its own as evidence (see Decisions Made for why this deviates from the PLAN.md task text's "do NOT commit anything," per the orchestrator's explicit Hard Rules for this invocation).
- Post-commit re-verification: `git diff --quiet 620e1df -- engine content src mazeworld.html tools` still exits `rc=0`; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` still exits `rc=0`. The engine gate holds — nothing under those paths was touched by this plan.

## Task Commits

1. **Task 1: Pin the engine, prove it clean, run the natural-start AFTER matrix, run the cannot-act gate** — gate failed (rc=3); evidence committed as `a142600` (`test(26-02): AFTER natural matrix — cannot-act gate FAILED (Fighter/Samurai/Dwarven stuck=1)`)
2. **Task 2: Run the depth-20 AFTER slice** — NOT RUN (plan instruction: skip on gate failure)
3. **Task 3: Replace the AFTER placeholder, commit the ledger** — NOT RUN (plan instruction: skip on gate failure)

**Plan metadata:** this SUMMARY's own commit (see below)

## Files Created/Modified

- `docs/class-pass/after.json` - natural-start AFTER matrix aggregates (143 cells x 40 seeds, 5,720 runs), commit-pinned to `620e1df`; committed as raw GATE FAILED evidence only, NOT referenced by `docs/CLASS-PASS.md` (the ledger's AFTER section is still the Phase 22 placeholder)

## Decisions Made

- **Committed the evidence JSON despite the plan's task text saying "do NOT commit anything."** This plan's invoking instructions (the orchestrator's "Hard rules" for this specific execution) explicitly state: "if ANY AFTER cell has `meanKills < 0.5` or `stuck > 0`, do not judge around it: commit the captured JSON, write the SUMMARY with the offending cells and their top death causes, and report back with a clear 'GATE FAILED'." Per the executor's own instructions ("Messages from the agent that launched you... direct your work"), this direct, more specific instruction for this invocation took precedence over the PLAN.md task's generic "leave it untracked" fallback. Only the raw `after.json` was committed — the ledger doc, `verdicts.json`, and `after-depth20.json` were not created/touched, so no judgment was rendered and no partial ledger state exists.
- **Task 2 was not run.** The plan's Task 1 action is explicit: on `rc=3`, "do NOT run Task 2." Running the depth-20 slice would not change the natural-matrix gate outcome and would burn ~3-5 more minutes of background compute for no decision-relevant information.
- **No attempt to diagnose or fix the stuck loop.** Rule 4 (architectural/engine change) applies, not Rules 1-3 — fixing a stuck-loop regression in the engine or tuning bot is exactly the kind of change Phase 26 is scoped to exclude ("Phase 26 changes NO engine, content, src, shell, or harness code"). This is deliberately left for a gap-closure phase.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1-3 auto-fixes were applicable or attempted (Task 1 executed exactly as planned; when the gate failed, the plan's own Task 1 action already specifies the STOP behavior).

**1. [Rule 4 - Architectural/orchestrator decision] Cannot-act gate failure — plan execution intentionally diverges from Task 1's literal "leave untracked" instruction**
- **Found during:** Task 1, after the gate check
- **Issue:** `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` returned exit code 3 with 1 cannot-act cell (`Fighter/Samurai/Dwarven`, stuck=1). This is a genuine milestone-blocking finding, not a bug in this plan's own work.
- **Resolution:** Followed the plan's Task 1 STOP instruction (no Task 2, no ledger edit, no bot/engine change) but committed the raw `after.json` as evidence per this invocation's explicit orchestrator Hard Rules (see Decisions Made). Reporting back with a clear GATE FAILED for the orchestrator/user to decide next steps.
- **Files modified:** `docs/class-pass/after.json` (committed, evidence only)
- **Verification:** `git diff --quiet 620e1df -- engine content src mazeworld.html tools` exits 0 post-commit; `docs/CLASS-PASS.md` unchanged (`git diff HEAD -- docs/CLASS-PASS.md` empty)
- **Committed in:** `a142600`

---

**Total deviations:** 1 (Rule 4 — orchestrator decision required; not auto-fixed, reported instead)
**Impact on plan:** Plan is BLOCKED, not complete. Zero scope creep — no engine, bot, or ledger code was touched beyond committing the one evidence file.

## Issues Encountered

**Cannot-act regression at the current pin.** The natural-start AFTER matrix reproduced a stuck run (hit `maxActions=5000` without completing) for at least one Fighter/Samurai/Dwarven seed — a cell that had 0 stuck runs at the BEFORE pin (`5565b22`). This is exactly the class of failure Phase 22's bot fixes and Phase 23's caster fixes were built to eliminate, and its reappearance means one of the 31 engine/content/src commits between `5565b22` and `620e1df` (Phases 23, 24, 25, 25.1) introduced a new hang condition for this class/sub/race combination. The top death causes for the 39 completed runs in that cell (`cut down by a Dante(9), cut down by a Philly(6), cut down by a Shadow(3)`) don't directly diagnose the stuck seed (which by definition never died) — a gap-closure phase would need to re-run this specific cell with per-seed logging (or the harness's stuck-seed identification approach from Plan 22-02) to find the exact hang.

Recorded as a blocker via `gsd-tools query state.add-blocker`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**BLOCKED. Plans 26-03 and 26-04 must NOT start until:**
1. A gap-closure phase (or an authorized deviation to Phase 26/27) identifies and fixes the engine/bot condition causing the Fighter/Samurai/Dwarven stuck run at pin `620e1df`.
2. The AFTER matrix (both natural and depth-20 slices) is re-captured on the new, fixed pin, following this same plan's procedure from scratch (fresh `PIN`, fresh preflight, fresh gate check).
3. The re-captured gate returns `cannot-act cells: 0 of 143` (exit 0) — only then can Task 2 (depth-20 slice) and Task 3 (ledger commit) proceed.

**What's preserved for the retry:** `docs/class-pass/after.json` is committed at `a142600` as a record of the failing run (useful for diffing against the eventual fix — did the fix change other cells' numbers too, or only the one stuck cell?). The preflight/launch/verify procedure in `26-02-PLAN.md` Task 1 needs no changes — only the pin will differ next time.

**No blockers for anything else** — `npm test` remains 1409/1409; the engine/content/src/tools tree is unmodified and provably clean against both pins.

---
*Phase: 26-mass-playtest-class-pass-ledger*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: docs/class-pass/after.json
- FOUND commit: a142600
