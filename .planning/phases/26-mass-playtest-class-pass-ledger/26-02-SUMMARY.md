---
phase: 26-mass-playtest-class-pass-ledger
plan: 02
subsystem: testing
tags: [class-pass, after-snapshot, capture, ledger, commit-pin, cannot-act-gate, complete]

# Dependency graph
requires:
  - phase: 26-mass-playtest-class-pass-ledger
    plan: 01
    provides: "tools/class-pass-diff.mjs --gate mode (cannot-act hard gate CLI)"
provides:
  - "docs/class-pass/after.json — natural-start AFTER matrix aggregates (143 cells x 40 seeds, 5,720 runs), commit-pinned to d1e3235, cannot-act gate PASSED (0 of 143)"
  - "docs/class-pass/after-depth20.json — depth-20 AFTER slice aggregates (143 cells x 10 seeds, 1,430 runs), commit-pinned to d1e3235"
  - "docs/CLASS-PASS.md AFTER section — pin heading, provenance paragraph, and both verbatim transcripts, replacing the Phase 22 placeholder in place"
affects: ["26-03", "26-04"]

tech-stack:
  added: []
  patterns:
    - "Re-execution after a gap-closure fix: same preflight/launch/verify procedure as the first attempt, fresh PIN, fresh gate check — the earlier blocked attempt's evidence stays in git history but is superseded, never edited"
    - "meta.commit auto-stamp hazard: tune-classes.mjs stamps git rev-parse --short HEAD at run time, so committing an AFTER JSON between two capture runs advances HEAD and mis-stamps the next run; caught and corrected before the ledger commit by verifying the engine tree was byte-identical across the intervening commit, then patching the JSON's meta.commit field to match the true pin (documented as a Rule-1 fix, not a silent edit)"

key-files:
  created:
    - docs/class-pass/after-depth20.json
  modified:
    - docs/class-pass/after.json
    - docs/CLASS-PASS.md

key-decisions:
  - "Committed each task atomically (after.json, then after-depth20.json, then the ledger doc) per this re-execution's explicit top-level instruction to commit each task atomically — this supersedes PLAN.md Task 3's literal 'commit all three files in one commit' requirement. Documented as a deviation; all files ended up on master with the same content the single-commit design would have produced."
  - "Corrected after-depth20.json's meta.commit from d66f154 (the Task 1 ledger-adjacent commit's hash, auto-stamped because HEAD had advanced by the time the depth-20 run's --out write happened) to d1e3235 (the true pin). Verified first via git diff --quiet d66f154 d1e3235 -- engine content src mazeworld.html tools (rc=0) that the underlying engine/content/src/tools tree was byte-identical between the two commits, so the run's actual data was unaffected and only the auto-stamped label was wrong. Patched the JSON's meta.commit field directly (atomic tmp-then-rename, same JSON.stringify(_, null, 2) format the tool itself uses) rather than re-running the 59s capture a second time for a label-only fix. This is the direct consequence of committing per-task instead of Task 3's single final commit; a future re-run of this plan should either commit only once at the very end (per PLAN.md) or run all captures before any intermediate commit."
  - "No investigation needed for the previously blocked cell — the gap-closure fix (commit d1e3235, landed before this plan started) already resolved it structurally (startCombat now checks for a cleared encounter before the opening foe turn resolves); this run's zero-stuck result is the fix's own verification, not a separate diagnosis."

requirements-completed: [PLAY-02]

coverage:
  - id: D1
    description: "Natural-start AFTER matrix (143 x 40, 5,720 runs) captured against the pinned, proven-clean engine (d1e3235) with the BEFORE Bot: line byte-for-byte, correct meta (seeds=40, startDepth=1, maxActions=5000, workers=4, exploreBudget=50, 143 cells, meta.commit=d1e3235, no rows key, every cell n=40)"
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
        ref: "gate output: 'cannot-act cells: 0 of 143', exit code 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Depth-20 AFTER slice (143 x 10, 1,430 runs) captured against the same pin with the BEFORE depth-20 Bot: line byte-for-byte, correct meta, 0 stuck"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "node -e verify script printed '10 20 143 false true true true'; meta.commit corrected to d1e3235 and re-verified equal to after.json's meta.commit; both bot-line-normalized strings equal (true true)"
        status: pass
    human_judgment: false
  - id: D4
    description: "AFTER placeholder in docs/CLASS-PASS.md replaced in place with the pin heading, provenance paragraph, and both verbatim transcripts; six H2 headings preserved in original order; nothing above the AFTER heading changed"
    requirement: "PLAY-02"
    verification:
      - kind: other
        ref: "grep -c '^## ' == 6; single diff hunk starting at line 857 (context) / 860 (heading); all sub-heading, EXIT=0 (x4), elapsed (x4), gate-output greps matched expected counts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Engine/content/src/mazeworld.html/tools stayed byte-identical to the pin before and after this plan's activity (including the ledger commit); harness stayed byte-identical to the BEFORE pin 5565b22"
    requirement: "Engine gate"
    verification:
      - kind: integration
        ref: "git diff --quiet d1e3235 -- engine content src mazeworld.html tools (rc=0, checked pre-launch and post-final-commit); git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib (rc=0)"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-09-15
status: complete
---

# Phase 26 Plan 02: AFTER Matrix Capture — Cannot-Act Gate PASSED

**Re-executed from scratch on the gap-closure pin d1e3235 (fixes the startCombat foe-first-opener bug that left combat open with nothing alive after a ward-reflect/acid kill): captured the full 143x40 natural + 143x10 depth-20 AFTER matrix at BEFORE volume and parameters, the cannot-act hard gate returned zero cells, and the ledger's AFTER placeholder was replaced in place with the pinned heading, provenance paragraph, and both verbatim transcripts.**

## Performance

- **Duration:** ~50 min (natural capture 1108.5s/~18.5min + depth-20 59.4s + ledger authoring/verification)
- **Completed:** 2026-09-15
- **Tasks:** 3 of 3 complete
- **Files modified:** 3 (`docs/class-pass/after.json` overwritten, `docs/class-pass/after-depth20.json` created, `docs/CLASS-PASS.md` AFTER section replaced)

## First attempt (blocked)

The first execution of this plan captured the natural matrix at pin `620e1df` and found `cannot-act cells: 1 of 143` — Fighter/Samurai/Dwarven, `stuck=1` (0 at the BEFORE pin `5565b22`) — a genuine regression introduced somewhere in Phases 23-25's engine changes. Per Deviation Rule 4 the plan stopped: only the raw evidence JSON was committed (`a142600`), the ledger and depth-20 slice were left untouched, and a blocker was recorded (`state.add-blocker`). Root cause: `startCombat`'s foe-first opener had no cleared-encounter check, so a foe killed by a Bubble ward reflection (or acid) during the opening foe turn left `state.combat` open with nothing alive, and the bot looped forever trying to act against an empty foe list. Fixed in `d1e3235` (`engine/combat.js`, regression test added in `test/unit/combat.test.js`, full suite 1410/1410, parity 33/33) — a gap-closure commit that landed before this re-execution began. This SUMMARY (Plan 26-02) is now the completed record; the earlier blocked SUMMARY content has been fully superseded by the sections below.

## Accomplishments

- **Preflight proved the new pin's provenance is sound**: `git status --porcelain` clean, `npm test` 1410/1410 (`# fail 0`), pin `PIN=d1e32357474a0f232515a19660ea3ed12c3f8b07` (short `d1e3235`) confirmed `git diff --quiet`-clean against `engine content src mazeworld.html tools`, and the harness (`tools/tune-classes.mjs`, `tools/lib`) confirmed byte-identical to the BEFORE pin `5565b22`. 32 engine/content/src commits landed between `5565b22` and `d1e3235` (Phases 23-25.1 plus this phase's own gap-closure fix), diffstat `18 files changed, 2844 insertions(+), 298 deletions(-)`.
- **Natural-start matrix captured and gate PASSED**: `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/after.json` — 143 cells x 40 seeds = 5,720 runs, completed in **1108.5s (~18.5 min)** on 4 workers. `meta.commit === "d1e3235"`, `meta.bot` byte-identical to `before.json`'s. `node tools/class-pass-diff.mjs --gate --after docs/class-pass/after.json` printed `cannot-act cells: 0 of 143` (exit 0) — the Fighter/Samurai/Dwarven cell that was stuck at `620e1df` now shows `stuck=0, kills=6.88` at `d1e3235`, confirming the gap-closure fix.
- **Depth-20 slice captured**: `node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/after-depth20.json` — 143 cells x 10 seeds = 1,430 runs, **59.4s**, 0 stuck.
- **Meta.commit correction (documented deviation, see Decisions Made)**: because Task 1's `after.json` was committed (per this re-execution's explicit "commit each task atomically" instruction) before Task 2 ran, `tune-classes.mjs`'s `git rev-parse --short HEAD` auto-stamp captured the intervening docs commit (`d66f154`) instead of the pin. Verified the engine tree was byte-identical between `d66f154` and `d1e3235` for all pin-check paths, then corrected `after-depth20.json`'s `meta.commit` field to `d1e3235` to match `after.json` and satisfy the ledger's single-pin invariant.
- **Ledger updated**: `docs/CLASS-PASS.md`'s AFTER placeholder heading and body (lines 860-879 of the pre-edit file) replaced in place with the pinned heading, a `### Pin and provenance (Phase 26 capture)` paragraph (every number copied from recorded command output), and both verbatim transcripts under their own sub-headings. All six H2 sections (Bot proxy, How to reproduce, BEFORE, Outliers/Findings, Rulings, AFTER) remain in original order; nothing above the AFTER heading changed (single diff hunk, `git diff HEAD~1 -- docs/CLASS-PASS.md` starts at line 857 for context, edits begin at line 860).
- **Post-final-commit re-verification**: `git diff --quiet d1e3235 -- engine content src mazeworld.html tools` exits `rc=0`; `git diff --quiet 5565b22 -- tools/tune-classes.mjs tools/lib` exits `rc=0`; `npm test` 1410/1410; `git status --porcelain` clean.

## Headline BEFORE → AFTER (by class, mean depth)

From `node tools/class-pass-diff.mjs --json --before docs/class-pass/before.json --after docs/class-pass/after.json`:

| Class | BEFORE mean depth | AFTER mean depth | Delta |
|---|---|---|---|
| Thief | 3.42 | 3.51 | +0.09 |
| Fighter | 3.05 | 3.16 | +0.11 |
| Magic User | 2.44 | 2.55 | +0.11 |

Every class improved slightly; Magic User's mean kills roughly doubled (2.41 -> 4.99) reflecting Phase 23's "casters can act" fix landing durably at scale.

**Top 3 sub-classes by depth gain:**

| Sub-class | BEFORE | AFTER | Delta |
|---|---|---|---|
| Summoner | 2.18 | 2.71 | +0.53 |
| Guard | 2.80 | 3.13 | +0.33 |
| Barbarian | 3.44 | 3.66 | +0.22 |

**Bottom 3 sub-classes by depth gain (smallest/negative):**

| Sub-class | BEFORE | AFTER | Delta |
|---|---|---|---|
| Cloaker | 3.04 | 2.99 | -0.05 |
| Apprentice | 2.40 | 2.35 | -0.05 |
| Court Mage | 2.52 | 2.45 | -0.07 |

`cannotAct` diff array: empty (`[]`) — zero cells flagged on either side of the comparison. Full per-cell/per-sub/per-race breakdown lives in `docs/class-pass/after.json` / `after-depth20.json`; Plan 26-03 owns the editorial verdicts.

## Task Commits

1. **Task 1: Pin the engine, prove it clean, run the natural-start AFTER matrix, run the cannot-act gate** — `d66f154` (`test(26-02): AFTER natural matrix — cannot-act gate PASSED on pin d1e3235`)
2. **Task 2: Run the depth-20 AFTER slice** — `39dfdfa` (`test(26-02): AFTER depth-20 slice — 143x10, engine pinned d1e3235`)
3. **Task 3: Replace the AFTER placeholder, commit the ledger** — `0035608` (`docs(26-02): AFTER class matrix — 143x40 natural + 143x10 depth-20, engine pinned d1e3235`)

## Files Created/Modified

- `docs/class-pass/after.json` - natural-start AFTER matrix aggregates (143 cells x 40 seeds, 5,720 runs), commit-pinned to `d1e3235`, overwrites the earlier blocked-attempt content (`620e1df`, stuck=1) — now the ledger-wired capture
- `docs/class-pass/after-depth20.json` - depth-20 AFTER slice aggregates (143 cells x 10 seeds, 1,430 runs), commit-pinned to `d1e3235`
- `docs/CLASS-PASS.md` - AFTER placeholder replaced in place with pin heading, provenance paragraph, and both verbatim transcripts

## Decisions Made

See `key-decisions` in the frontmatter for the full reasoning on: (1) committing each task atomically instead of PLAN.md Task 3's single-commit design, and (2) the `meta.commit` auto-stamp correction in `after-depth20.json`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `after-depth20.json`'s `meta.commit` mis-stamped due to per-task commit ordering**
- **Found during:** Task 2, immediately after the verify step (parity check between `after.json` and `after-depth20.json` printed `false` for `a.commit===d.commit`)
- **Issue:** Task 1's commit (`d66f154`) advanced `HEAD` before Task 2's capture finished writing its `--out` file; `tools/tune-classes.mjs` stamps `meta.commit` from `git rev-parse --short HEAD` at write time, so `after-depth20.json` recorded `d66f154` instead of the true pin `d1e3235`.
- **Fix:** Verified `git diff --quiet d66f154 d1e3235 -- engine content src mazeworld.html tools` exits 0 (the two commits are identical on every pin-checked path — the only difference is the docs-only `after.json` file, outside those paths), then patched `after-depth20.json`'s `meta.commit` field from `d66f154` to `d1e3235` via a small atomic (tmp-then-rename) script using the same `JSON.stringify(_, null, 2)` format the tool itself writes. Re-ran all Task 2 verification checks after the patch — all passed.
- **Files modified:** `docs/class-pass/after-depth20.json`
- **Verification:** post-patch `node -e` checks: `10 20 143 false true true true`; `meta.commit === "d1e3235"`; `a.commit===d.commit, bot-normalized-equal` both printed `true`
- **Committed in:** `39dfdfa` (the patch was applied before this commit, so the committed file already carries the corrected value)

---

**Total deviations:** 1 (Rule 1 — auto-fixed, self-caused by this run's own commit ordering, not an engine or content bug)
**Impact on plan:** None on the captured data's validity (the underlying runs are unaffected — only a label was corrected before it was committed); the ledger's single-pin invariant holds throughout.

## Issues Encountered

None outstanding. The one issue found (the `meta.commit` mis-stamp) was caught by this plan's own verification step before anything was committed with the wrong value, and corrected per Rule 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plans 26-03 and 26-04 are now unblocked.** The AFTER matrix (natural + depth-20) is committed to the ledger against a commit-pinned engine (`d1e3235`), at BEFORE volume and parameters, with the cannot-act hard gate proven at zero cells. Plan 26-03 can run `node tools/class-pass-diff.mjs --verdicts docs/class-pass/verdicts.json --out-verdicts docs/class-pass/verdicts.json --section after` (and `--section outliers`, `--section handoff`) against the committed `before.json`/`after.json`/`before-depth20.json`/`after-depth20.json` pair and paste the output above the provenance sub-heading, per the ledger's own instructions.

**Blocker cleared:** the "26-02: AFTER cannot-act gate FAILED at pin 620e1df" blocker recorded in `STATE.md` is resolved — the fix landed in `d1e3235` and this plan's re-execution confirms zero stuck cells at full scale (5,720 + 1,430 runs).

---
*Phase: 26-mass-playtest-class-pass-ledger*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: docs/class-pass/after.json
- FOUND: docs/class-pass/after-depth20.json
- FOUND: docs/CLASS-PASS.md (AFTER section verified via grep checks above)
- FOUND commit: d66f154
- FOUND commit: 39dfdfa
- FOUND commit: 0035608
