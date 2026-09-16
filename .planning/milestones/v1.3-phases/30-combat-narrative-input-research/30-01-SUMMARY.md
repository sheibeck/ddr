---
phase: 30-combat-narrative-input-research
plan: 01
subsystem: docs
tags: [combat-ui, design-doc, research, toasts, input-guards]
status: complete

# Dependency graph
requires: []
provides:
  - "docs/COMBAT-NARRATIVE-DESIGN.md — the CMBUI-01 survey/scorecard/recommendation/build-contract, with §7 Ratification pending the orchestrator's user pick"
  - "§6 Phase 32 build contract (screen anatomy, tap budget, ARM_DELAY_MS/DISMISS_SETTLE_MS=250 guards, toast-vs-round-surface routing, Oracle behaviour, Phase 28/29 fold-in, accessibility, 89-test re-pin list) — the spec Phase 32's plan-phase reads from"
affects: []

tech-stack:
  added: []
  patterns:
    - "Documentation-only ledger phase (matches docs/PARLEY-REBALANCE.md / docs/CLASS-PASS.md house style): framing paragraph, tables for anything comparable, code identifiers in backticks, numbers re-verified live rather than copied from RESEARCH.md"

key-files:
  created:
    - "docs/COMBAT-NARRATIVE-DESIGN.md"
    - ".planning/phases/30-combat-narrative-input-research/30-01-SUMMARY.md"
  modified: []

decisions:
  - "Live re-verification (node --test, one run per file) found the toast/Oracle-pinning test total is 89 (15+21+37+8+8), not RESEARCH.md's assumed 98 (15+28+38+8+9) — the doc uses the live-verified 89 throughout §1.6 and §6.8, with a one-line note explaining the discrepancy, per this plan's own read_first instruction to carry the live count when a measured number differs from the assumed baseline."
  - "Module-level live counts (TOAST_FOR 199, ORACLE_ONLY 20, FEATURE_EVENTS 66, MAX_TOASTS 4, EVENT_NARRATION 218) matched RESEARCH.md's numbers exactly — no correction needed there."

metrics:
  duration: "~40min"
  completed: "2026-09-16"
---

# Phase 30 Plan 01: Combat Narrative & Input Design Doc Summary

Wrote `docs/COMBAT-NARRATIVE-DESIGN.md` — a decision-ready survey of six combat-feedback interaction patterns (scrolling log, batched round-summary card, auto-advance, ticker/floating text, mis-tap guards, and today's toast stack as baseline), a weighted scorecard fixed before scoring, a recommended design (the Round Card) with tradeoffs against every alternative, a fully specified runner-up (the Guarded, Bundled Toast), and the Phase 32 build contract those two designs are scored against. No code was touched — this is a pure documentation deliverable for CMBUI-01.

## What Was Built

- `docs/COMBAT-NARRATIVE-DESIGN.md`, in the CONTEXT-locked section order: `## 1. Current state` (toast system, `renderEncounter`/overlay, Oracle log, round event volume, the code-read correction, tests pinning today's behaviour) → `## 2. Survey` (six patterns with tagged shipped examples + a criteria table) → `## 3. Scorecard` (weights fixed before scoring, sum to 100; six-row score table, every total recomputed) → `## 4. Recommended design — the Round Card` (concept + wireframe, four-constraint compliance table, tradeoffs against every alternative) → `## 5. Runner-up — the Guarded, Bundled Toast` (concept + wireframe, the same compliance table, honest case for picking it) → `## 6. Phase 32 build contract` (five per-state wireframes, tap-budget table, the two `Date.now()` guards and the hit-zone/dismissal rules, a no-double-reporting routing table, Oracle behaviour unchanged, the Phase 28/29 fold-in, accessibility, the test re-pin list) → `## 7. Ratification` (pending line + two Key Decision row drafts) → Appendix A (provenance-checked sources) → Appendix B (assumptions log).

## §3.2 Scorecard totals (for the orchestrator's AskUserQuestion)

| Pattern | Weighted total |
|---|---|
| 1. Scrolling log/ledger | 3.35 |
| **2. Batched round-summary card ("the Round Card", §4)** | **4.75** |
| 3. Auto-advance / tap-to-pause | 2.85 |
| 4. Ticker / floating text | 2.85 |
| 5. Mis-tap guards only ("the Guarded, Bundled Toast" hybrid, §5) | 3.15 |
| 6. Today's toast stack (baseline) | 2.90 |

**Candidate names, exactly as the doc's §4/§5 headings spell them:**
- **§4: "Recommended design — the Round Card"** (4.75/5, the clear winner)
- **§5: "Runner-up — the Guarded, Bundled Toast"** (3.15/5 as guards-alone; materially higher once bundling's coherence gain is counted — the lower-risk, lower-test-churn fallback)

## Ratification status

**Pending.** Per 30-CONTEXT.md's locked decisions, this plan writes the recommendation and the runner-up but does NOT ratify — the orchestrator presents §4 vs. §5 with the table above in one AskUserQuestion, the user picks or redirects, and only then is the PROJECT.md Key Decision row written and §7's `**Ratified design:**` line overwritten. This plan left `docs/COMBAT-NARRATIVE-DESIGN.md`'s §7 exactly as `**Ratified design:** _pending user pick_`, and did not touch PROJECT.md.

## Gate confirmations

- **Test suite:** `npm test` → `# tests 1593`, `# pass 1593`, `# fail 0` (identical to the Phase 29 baseline — proves no test file or code path moved).
- **Code diff gate:** `git diff --stat dfc2c61..HEAD -- engine src content mazeworld.html test` prints nothing; `git status --porcelain -- engine src content mazeworld.html test` prints nothing.
- **Doc gate set (Tasks 1 + 2, re-run on the final committed doc):** section order `1234567`; exactly one `Ratified design:` line, reading pending; `**Weights sum:** 20 + 20 + 20 + 10 + 10 + 15 + 5 = 100` present; the node scorecard-recompute script prints `scorecard OK` (six rows × nine cells, integer 1–5 scores, every total within ±0.005 of Σ score×weight); six survey rows in §2.2; all four hard-constraint labels (`Tap budget`, `Oracle completeness`, `No double-reporting`, `Button guards`) present in both §4 and §5; five `State:` wireframe labels in §6.1; `ARM_DELAY_MS = 250` and `DISMISS_SETTLE_MS = 250` present; the URL-provenance loop (every `https://` URL in the doc appears verbatim in `30-RESEARCH.md`) prints nothing invented, 11 unique URLs total; product name check — `Delve, Die, Repeat` present, `Mazeworld` absent from prose outside HTML comments.

## Task/commit structure

- **Task 1** (`e5f49c4`): sections 1–5 (current state, survey, scorecard, recommendation, runner-up), file ending at the `## 6. Phase 32 build contract` heading.
- **Task 2** (`cd8d0a8`): section 6 (build contract), section 7 (ratification), Appendix A/B.
- **Task 3**: final gates (1593/1593, empty code diff, full gate-set re-run, self-review for premature-decision or Oracle-trimming language) — the self-review found no drift to fix, so **Task 3's doc commit is skipped** (the tree was already clean after Task 2); this SUMMARY plus the STATE/ROADMAP tracking updates are the only remaining artifacts, captured in the final metadata commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — stale baseline corrected via live re-verification] Test count 98 → 89**
- **Found during:** Task 1's mandatory live-count verification step.
- **Issue:** RESEARCH.md's assumed five-file test-pinning table (15+28+38+8+9 = 98) does not match a live `node --test` run of those same five files (15+21+37+8+8 = 89). A `grep -c "test("` line-count approximation also disagreed with both, because it matches unrelated `.test(...)` regex-method call lines, not just `test(...)` definitions.
- **Fix:** Used `node --test <file>` per file (the project's actual test runner) as the authoritative count, per this plan's own explicit instruction ("if a count differs, carry the live count"). The doc's §1.6 and §6.8 both state 89 and include a one-line note explaining the correction from RESEARCH's stale 98.
- **Files modified:** `docs/COMBAT-NARRATIVE-DESIGN.md` only — no test files were touched or need re-pinning yet (that's Phase 32's job).
- **Commits:** `e5f49c4`, `cd8d0a8`.

No other deviations — plan executed as written otherwise.

## Known Stubs

None — this is a documentation-only deliverable with no runtime code paths.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes; this phase touches only `docs/` and `.planning/`.

## Self-Check: PASSED

- FOUND: `docs/COMBAT-NARRATIVE-DESIGN.md`
- FOUND commit `e5f49c4` (Task 1)
- FOUND commit `cd8d0a8` (Task 2)
- `npm test`: 1593/1593
- Code diff gate: empty
