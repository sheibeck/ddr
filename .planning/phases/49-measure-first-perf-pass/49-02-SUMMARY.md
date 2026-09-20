---
phase: 49-measure-first-perf-pass
plan: 02
subsystem: performance
tags: [performance, perf-marks, dom-rendering, shell, android]

# Dependency graph
requires:
  - phase: 49-measure-first-perf-pass
    provides: "49-01's dev-gated performance.now() rings + the user's Pixel 7 device report"
provides:
  - "docs/PERF-BASELINE.md Device/Protocol/BEFORE/Jank report/Decision sections filled from the Pixel 7 report"
  - "one presentation-only fix commit (9fe9bb5) citing the step row — paint() skips the hidden Hero/Gear tab mount on the step path, re-renders on tab switch"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "conditional tab-mount rendering gated by a module-scope flag set only around the specific hot-path caller, never a function-signature change, when source-pin tests anchor on the function's literal declaration/call text"

key-files:
  created: []
  modified:
    - mazeworld.html
    - docs/PERF-BASELINE.md

key-decisions:
  - "step (median 14.2 / p95 28.9 ms) is the only qualifying row; no sub-row (dispatch/paint/draw) independently crosses 16 ms"
  - "Even though this is mechanically the plan's 'step-only' case, the arithmetic (dispatch+paint+draw sums to within ~0.1 ms median / ~2.0 ms p95 of step's own reported number) shows the Oracle logLine append / camera nudge are NOT where the cost is — paint (the largest single component) is the real target, cited via the step row per the fix rule"
  - "Fix implemented as a module-scope classic-script flag (mwPaintSkipHiddenTabs) rather than a paint(opts) parameter, because gearTab.test.js/heroTab.test.js/shell-party-camp.test.js/perfMarks.test.js all anchor on the literal strings `function paint() {` and `window.paint();` — changing either would have broken multiple source-pin tests for no behavioral benefit"
  - "The redundant second canvas draw() per step (49-01's own documented finding) was considered but NOT included in this fix — removing it would require restructuring the pinned 7-line performance.now() instrumentation shape, and the arithmetic shows draw's own cost (median 1.6 ms) alone would not bring step under 16 ms"

patterns-established: []

requirements-completed: []
# PERF-01/PERF-02 are NOT marked complete here — Task 3 (after the AFTER
# report) closes both requirements together, per this plan's own task shape.

# Metrics
duration: in progress — checkpoint reached after Task 1
completed: null
status: awaiting-after-report
---

# Phase 49 Plan 02: Measure-First Perf Pass — BEFORE + Fix Summary (Task 2 checkpoint)

**Skip the Hero/Gear tab's full DOM rebuild inside paint() while it is hidden behind the map tab during a step, re-rendering it the instant the player switches tabs — cites docs/PERF-BASELINE.md BEFORE row `step` (median 14.2 / p95 28.9 ms).**

**This is NOT the phase-closing SUMMARY.** Task 1 (doc + decision + fix) is
complete; Task 2 is the blocking device checkpoint below — the executor
stops here per the plan. Task 3 (AFTER table, ROADMAP criteria 1-4, closing
gates, PERF-01/02 marked complete) runs once the orchestrator supplies the
AFTER device report.

## Performance

- **Duration (Task 1 only):** this session
- **Tasks:** 1 of 3 completed (Task 2 is the checkpoint below; Task 3 pending)
- **Files modified:** 2 (`mazeworld.html`, `docs/PERF-BASELINE.md`)

## Accomplishments

- `docs/PERF-BASELINE.md`: Device, Protocol ("As run"), BEFORE table, Jank
  report, and Decision sections filled verbatim from `49-01-SUMMARY.md`'s
  `## Device report` — Pixel 7, build CP2A.260705.006, APK commit 742c916,
  session 2026-09-20; step 14.2/28.9/33.4, dispatch 3.9/8.3/15.1, paint
  8.6/15.3/17.9, draw 1.6/3.3/4.2 ms (med/p95/max, n=62); jank "None".
- Decision applied the fix rule mechanically per row (only `step` qualifies,
  p95 28.9 ≥ 16 ms) and then reasoned, with arithmetic and node-side code
  evidence, from "step-only" to the real, actionable target: `paint()`'s
  unconditional Hero/Gear tab-mount rebuild.
- One presentation-only fix commit (`9fe9bb5`): `paint()` skips the
  Hero/Gear tab mount when that screen is not the active tab, but ONLY on
  `stepWith`'s own `window.paint()` call (a module-scope flag,
  `mwPaintSkipHiddenTabs`, set true then immediately reset false around that
  one call); `showTab()` now re-renders the Hero/Gear mount the instant that
  tab becomes active, so a hidden tab is never stale — only unrendered while
  unseen. Every other `window.paint()` call site (~19 others, including the
  DOM-snapshot harness's `sandbox.paint()`) is unaffected.

## Task Commits

1. **Task 1 (fix, branch B):** `9fe9bb5` (perf) — `paint()` skips hidden
   Hero/Gear tab mounts on the step path, re-renders on tab switch — cites
   docs/PERF-BASELINE.md BEFORE row step (median 14.2 / p95 28.9 ms)
2. **Task 1 (doc, BEFORE half):** `52a8b00` (docs) — PERF-BASELINE.md Pixel 7
   BEFORE table, jank report, decision
3. **Task 1 (doc, fix-landed note):** `b8c9293` (docs) — decision: fix
   9fe9bb5 landed, AFTER run pending

_Note: the fix commit (9fe9bb5) landed before the doc commits in wall-clock
order — the code was diagnosed and implemented first, then the doc was
written to record the diagnosis and cite the resulting commit hash. All
three commits carry the required citations; the plan's acceptance criteria
were re-verified after all three landed._

## Files Created/Modified

- `mazeworld.html` - `paint()` gains the `mwPaintSkipHiddenTabs`-gated
  conditionals around the Hero/Gear tab mounts (2 lines); `stepWith` sets/
  resets the flag around its unchanged `window.paint();` call (3 lines);
  `showTab()` gains a catch-up render for the Hero/Gear mount on tab switch
  (7 lines); +37/-2 lines total, CRLF preserved (Edit tool only, no
  whole-file rewrite)
- `docs/PERF-BASELINE.md` - Device/Protocol/BEFORE/Jank report/Decision
  sections filled; AFTER section still reserved ("Filled by Plan 49-02")
  pending Task 3

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `function paint(opts = {})` broke 6 source-pin tests**
- **Found during:** Task 1 (verification after the first fix attempt)
- **Issue:** The first implementation changed `paint()`'s signature to
  accept an options object and changed `stepWith`'s call to
  `window.paint({ skipHiddenTabs: true })`. `npm test` immediately showed 7
  failures: `gearTab.test.js`, `heroTab.test.js`, and
  `shell-party-camp.test.js` each slice the classic script between the
  literal strings `"function paint() {"` and a following anchor to extract
  paint()'s body for regex assertions (mount-call shape, dossier/ability-row
  literals, `paintConditions(c);` presence, WP-fill threshold writes, the
  party-roster-via-paint() ruling); `perfMarks.test.js`'s PERF-01 shell pin
  independently asserts the literal substring `"window.paint();"` exists
  inside `stepWith`, in index order relative to the other instrumentation
  literals. Changing either the signature or the call broke every one of
  these pins even though none of the underlying behavior they test had
  regressed — the region-slice anchors simply no longer matched.
- **Fix:** Reverted to the exact original `function paint() {` signature and
  the exact original `window.paint();` call. Replaced the parameter with a
  module-scope classic-script global, `let mwPaintSkipHiddenTabs = false;`,
  declared just above `paint()`. `stepWith` now does
  `mwPaintSkipHiddenTabs = true; window.paint(); mwPaintSkipHiddenTabs =
  false;` around its one call (synchronous, single-threaded — no
  reentrancy risk). Every other `window.paint()` call site is untouched and
  runs with the flag at its default `false`.
- **Files modified:** `mazeworld.html` (same file, corrected in place before
  the fix commit landed — the flag design is what's in `9fe9bb5`, not the
  discarded `paint(opts)` attempt)
- **Verification:** `npm test` 3,313/3,313 (0 fail); `node --test
  test/unit/shell-tab-snapshots.test.js` 10/10, `git diff --stat --
  test/unit/fixtures/` empty
- **Committed in:** `9fe9bb5` (the flag-based version is what was committed;
  the parameter-based attempt was never committed)

---

**Total deviations:** 1 auto-fixed (1 bug — a source-pin regression caught
before commit, not shipped)
**Impact on plan:** No scope creep; the final shipped fix is smaller and
lower-risk than the discarded first attempt (a plain boolean flag vs. a
threaded options parameter), and every pre-existing source-pin test still
passes unchanged.

## Issues Encountered

None beyond the deviation above (caught and corrected within Task 1, before
any commit landed).

## Gate results (recorded verbatim, at commit `9fe9bb5`)

- `npm test 2>&1 | grep -E "^# (pass|fail)"` — `# pass 3313` / `# fail 0`
- `node --test test/unit/shell-tab-snapshots.test.js 2>&1 | grep -E "^# (pass|fail)"` — `# pass 10` / `# fail 0`; `git diff --stat -- test/unit/fixtures/` — empty
- `npm run build:www` — exit 0, `www/index.html` stamped
- `npm run boot:check` — `PASS no-uncaught`, `PASS painted`, `PASS graves`, `PASS title` (4/4)
- `node --test test/unit/bridge-registry.test.js` — `# pass 10` / `# fail 0`; `node tools/bridge-doc.mjs --check` — exit 0
- `node tools/stale-terms.mjs` — exit 0
- `grep -rn "performance.now" www/` — exactly the same 7 guarded lines as 49-01 (line numbers shifted, content unchanged); `grep -rn "performance.now" www/ | grep -vc "perf ? \|if (perf)"` — 0; `grep -rl "performance.now" www/` — exactly `www/index.html`
- `git status --porcelain engine/ content/ test/parity/` — empty; `git hash-object test/parity/prototype-master.js.txt` — `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; `git diff --stat 9c9a755..HEAD -- engine/ content/ test/parity/` — empty
- `git diff --numstat -- mazeworld.html` (fix commit) — `37  2  mazeworld.html`; `git ls-files --eol mazeworld.html` — `i/lf w/crlf` (CRLF preserved)

## User Setup Required

None for Task 1. Task 2 (below) is the in-phase human device-verification
step — the AFTER run on a second APK.

## Next Phase Readiness

- **AWAITING AFTER REPORT.** Task 2's checkpoint is reached — see the
  checkpoint block in this handoff. The orchestrator must build a second
  debug APK at commit `9fe9bb5` (or later, but the fix must be included),
  record its commit hash, and have the user repeat the exact 49-01 checklist
  protocol (depth 5, ≥ 50 mixed steps through water/dark/encounter/tab
  switch) on the Pixel 7, then report the seven items listed in the
  checkpoint's how-to-verify.
- Task 3 cannot start until that AFTER report exists — it fills the AFTER
  table, checks the cited row against < 16 ms with no other row slower (or
  `git revert`s the fix and records why), quotes ROADMAP criteria 1-4
  verbatim with evidence, runs the closing gate set, and marks PERF-01/
  PERF-02 complete in REQUIREMENTS.md.
- No blockers beyond the device session itself.

---
*Phase: 49-measure-first-perf-pass*
*Completed: pending — Task 2/3 remain*

## AFTER report (fix 1, `9fe9bb5`; APK `b8c9293`)

Reported by the user in chat, 2026-09-20, same protocol (depth 5, ≥ 50 mixed steps). Numbers quoted exactly as pasted:

```
step 11.3 / 19.3 / 24.9 · dispatch 4.1 / 8.0 / 15.4 · paint 4.8 / 7.4 / 9.8 · draw 1.9 / 3.6 / 7.8 ms (med / p95 / max, n=70)
```

| Row | Median | p95 | Max | n |
| --- | --- | --- | --- | --- |
| step | 11.3 | 19.3 | 24.9 | 70 |
| dispatch | 4.1 | 8.0 | 15.4 | 70 |
| paint | 4.8 | 7.4 | 9.8 | 70 |
| draw | 1.9 | 3.6 | 7.8 | 70 |

- **Device build number:** CP2A.260705.006 (unchanged)
- **APK commit (AFTER 1):** b8c9293 (includes `9fe9bb5`)
- **Jank report (user's words):** "Jank is none"
- **Also raised by the user on this run (not a regression):** the dev Start-at-depth run rolls a fresh character (`startNewRun(undefined, { startDepth })`, unchanged since Phase 21 `83526ae`), so the roller showed a Court Mage and the Hero tab the dev run's own Thief — by design; a possible post-milestone todo (dev start keeps the rolled character).

### Orchestrator ruling (user, 2026-09-20)

`step` p95 19.3 ≥ 16 ms — criterion 3's "< 16 ms" is met on median (11.3) and NOT MET on p95 after fix 1. The user chose **a second presentation-only fix citing the same `step` row**: remove the redundant second `draw()` per step in `stepWith` (classic `paint()` already ends with `draw()`; see 49-01's finding), then APK #3 and one more re-measure. Rationale: dispatch + paint + draw p95 (19.0) ≈ step p95 (19.3), so the remaining step cost is the sum of its parts and the duplicate draw is the one known redundant part (~1.9 ms median / ~3.6 ms p95). If p95 still lands ≥ 16 after fix 2, the user's standing ruling is: record the numbers honestly, keep both fixes (every row improved or held; draw +0.3 ms is within noise), do not revert. Recorded as a deviation from the plan's "ONE fix commit" and "revert if not < 16" clauses.
