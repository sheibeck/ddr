---
phase: 03-endless-descent-difficulty-balance
verified: 2026-09-08T12:46:25Z
status: human_needed
score: 5/5 must-haves mechanically verified (2 deferred human-play items, 0 blockers)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Play multiple runs (seeded via tools/tune-difficulty.mjs and/or manual play in mazeworld.html) to floor 30-50+ and judge pacing"
    expected: "A typical run resolves in roughly 5-10 minutes; no floor feels trivially easy (a stretch of do-nothing floors) and no floor feels unfairly unwinnable (an ambush wall / full-darkness floor at any player power level)"
    why_human: "Subjective pacing/fun/difficulty-feel judgment cannot be derived from static code or property-test bounds alone (RUN-03's human criterion, explicitly deferred in 03-CONTEXT.md and 03-VALIDATION.md's 'Manual-Only Verifications' table). The mechanical bounds (caps, breather cadence, darkness ceiling, fairness sweep) ARE test-verified below."
  - test: "Open mazeworld.html in a browser, play until death, click 'Roll another delver' on the death card"
    expected: "A fresh, dice-rolled level-1 character appears on a new floor 1; the previous run's deepest floor is recorded as the best-depth"
    why_human: "DOM click-through requires a real browser/WebView to exercise (node:test has no DOM). The underlying engine behavior (engineAdapter.startNewRun()) IS covered by a real passing test (test/unit/new-run-loop.test.js), and the window.newGame override wiring was confirmed by direct code read (mazeworld.html:3312-3318) to route the exact button handler (btn-again's onclick, mazeworld.html:3031) through startNewRun() — only the live click itself is unverified. This is the same item 03-03-SUMMARY.md's own coverage table flags as human_judgment: true (D3)."
---

# Phase 3: Endless Descent & Difficulty Balance Verification Report

**Phase Goal:** Replace the fixed 5-floor Gate with endless, tuned descent — a 100%-dice-rolled character descends procedurally-generated floors of scaling difficulty until permadeath; ~5-10 min runs; depth/high-score chase.
**Verified:** 2026-09-08T12:46:25Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (RUN-ID) | Status | Evidence |
|---|---|---|---|
| 1 | Starting a run generates a 100%-dice-rolled character with zero choices, revealed before descent (RUN-01) | VERIFIED | `newRun.length === 1` (single-argument, no choice params) — `test/unit/newrun.test.js`; real test proves a valid level-1 character with populated cls/sub/race/name, spawn floor revealed, seed-determinism and seed-variance. 6/6 passing. |
| 2 | Endless descent — no floor cap, no Gate ending (RUN-02) | VERIFIED | `engine/maze.js:122` unconditionally sets the farthest-cell descent tile to `"exit"` at every depth (no depth-conditional branch to `"gate"` remains — confirmed by direct read of `genFloor`). `engine/movement.js`'s `move()` "gate" branch (legacy-save compat) routes to `descend()`, never `winGame()` (movement.js:164-171). `winGame()` (movement.js:418) is JSDoc-marked RETIRED/unreachable via play; grep confirms zero call sites outside its own direct-call test (`test/unit/movement.test.js`) and comments. `test/unit/endless-descent.test.js` drives a real `newRun(2026)` through 59 `descend()` calls to depth 60, asserting `state.won` stays false, no `"gate"` feature is ever generated, and depth increments by exactly 1 each call. |
| 3 | Difficulty scales along a bounded soft-cap curve with breather cadence; mechanical bounds hold (RUN-03) | VERIFIED (mechanical) — human feel-check deferred | `engine/difficulty.js` bounds dots (soft-cap toward `ENCOUNTER_DOT_CAP=24`), `darkBlobs` (hard-capped `DARK_BLOB_CAP=6`), `darkRadius` (hard-capped `DARK_RADIUS_CAP=9`); `isBreather()` fires every `BREATHER_EVERY=5`th floor. `test/difficulty/difficulty.test.js` (8 tests): caps never exceeded at depths 1..10000, breather cadence exact (6/11/16/21 true, others false), breather floors zero darkBlobs + floor dots to baseline, non-decreasing growth to depth 200, NaN/Infinity-input robustness, no-RNG signature check, and the **load-bearing depths-1-5 parity guard** (`dots===9+depth`, `darkBlobs===depth-1`, `darkRadius===3+depth`) that keeps Phase 1 suites green. `test/difficulty/fairness.test.js` (3 tests, 20 seeds x 5 deep depths on genFloor's REAL output): dark-tile coverage never exceeds 0.8 of open cells (measured max 0.733, documented rationale for the threshold), dot count never exceeds `ENCOUNTER_DOT_CAP`, breather depths have zero dark cells. All 11 property/fairness tests pass. The "~5-10 min, feels fair to floor 30-50+" human judgment is explicitly out of reach for static verification — see human_verification item 1. |
| 4 | Permadeath is the sole terminator (no revive/undo/continue) (RUN-04) | VERIFIED | `test/unit/permadeath.test.js` (5 tests): `die()` sets `state.dead`, pushes a `died` event without touching `state.won`; `move()` is a byte-for-byte no-op on a dead state (`assert.deepStrictEqual(state, before)`); `applyAction({type:"move"})` is a no-op through the full dispatcher; unknown action types `["revive","undo","continue","resurrect"]` all no-op and cannot flip `state.dead`. Death-card UI (mazeworld.html:3040-3049) renders only a single "Roll another delver" button — no revive/undo affordance exists in markup. |
| 5 | From the death state, one action starts a fresh dice-rolled run (RUN-05) | VERIFIED (engine/adapter level) — browser click-through deferred | `src/browser/engineAdapter.js`'s `startNewRun(seed)` records the ending run's `floor.depth` as best-depth (`recordBest`, `mazeworld.best.v1` — a SEPARATE localStorage key from `GameState`'s `SAVE_KEY`, confirmed NOT folded into GameState) then calls `initRun()` with a guarded seed. `test/unit/new-run-loop.test.js` (3 tests) proves a single `startNewRun()` call from a dead run yields a fresh valid run, records the prior deepest floor as best-depth, and honors an explicit seed. `mazeworld.html:3312-3318` overrides `window.newGame` to call `startNewRun()`, confirmed (by direct code read) to be the exact function the death-card's `btn-again` onclick resolves (`armAgain()`, mazeworld.html:3031). The live browser click itself is unverified — see human_verification item 2. |

**Score:** 5/5 truths mechanically verified (all supporting artifacts present, substantive, and wired with passing tests); 2 items require human verification before full sign-off (RUN-03 difficulty-feel, RUN-05 browser click-through).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `engine/difficulty.js` | Pure bounded soft-cap curve + breather cadence, 7 named constants | VERIFIED | Exists, substantive (105 lines, real asymptotic-curve math, `safeDepth` NaN guard), wired (imported by `engine/maze.js:9`, consumed at `maze.js:111`) |
| `engine/maze.js` (genFloor) | Consumes `difficultyCurve`, descent tile always `"exit"` | VERIFIED | `dc = difficultyCurve(depth)` computed once per call (line 111); descent tile unconditionally `"exit"` (line 122) — confirmed no depth-conditional gate branch remains |
| `engine/movement.js` | legacy `"gate"` → `descend()`; `winGame()` retired/unreachable | VERIFIED | Lines 162-171: `"exit"` and `"gate"` both call `descend()`; `winGame()` (line 418) has zero call sites in production code |
| `engine/combat.js` | Unmodified since Phase 1 | VERIFIED | `git log -- engine/combat.js` shows only Phase 1 commits (`ce9fe33`, `a7fb0a2`, `7a771b2`) — zero Phase 3 commits touch this file |
| `engine/death.js` | Unmodified since Phase 1 | VERIFIED | `git log -- engine/death.js` shows only Phase 1 commits (`d9fb803`, `2b5e788`) — zero Phase 3 commits touch this file |
| `src/browser/engineAdapter.js` (startNewRun/getBest) | Best-depth tracked adapter-side, not in GameState | VERIFIED | `BEST_KEY="mazeworld.best.v1"` is a distinct localStorage key from `SAVE_KEY`; `GameState`/`engine/state.js` has no best-depth field — confirmed by reading `engine/state.js:46` (only `won: false`, no best-depth) |
| `test/difficulty/difficulty.test.js`, `test/difficulty/fairness.test.js` | Property + fairness coverage for RUN-03 | VERIFIED | 8 + 3 = 11 tests, all passing, exercising caps/cadence/parity/fairness on real `genFloor` output |
| `test/unit/endless-descent.test.js`, `newrun.test.js`, `new-run-loop.test.js`, `permadeath.test.js` | RUN-01/02/04/05 coverage | VERIFIED | 2 + 6 + 3 + 5 = 16 tests, all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `engine/maze.js` (genFloor) | `engine/difficulty.js` | `import { difficultyCurve }` + `difficultyCurve(depth)` call | WIRED | Confirmed by direct read: import at line 9, call at line 111, consumed for `nDots`/`darkBlobs`/`darkRadius` |
| `engine/movement.js` (move) | `engine/movement.js` (descend, not winGame) | `"exit"`/`"gate"` branches both call `descend()` | WIRED | Lines 162-171 — no code path in `move()` reaches `winGame()` |
| `mazeworld.html` death-card button | `src/browser/engineAdapter.js` (startNewRun) | `window.newGame` override resolved at click time by `btn-again`'s `onclick` | WIRED (statically confirmed; live click deferred to human_verification) | `mazeworld.html:3312` overrides `window.newGame`; `armAgain()` (line 3031) sets `btn.onclick = () => { if (!btn.disabled) newGame(); }` — same global identifier |
| `src/browser/engineAdapter.js` (startNewRun) | `localStorage` (`mazeworld.best.v1`) | `recordBest(depth)` → `localStorage.setItem` | WIRED | `test/unit/new-run-loop.test.js` and `test/unit/engineAdapter.test.js` both assert `getBest()` reflects the recorded depth after `startNewRun()` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full suite passes with no regressions | `node --test` (bare, default discovery) | `# tests 317` / `# pass 317` / `# fail 0` | PASS |
| A real test descends well past floor 5 (60 floors) | `node --test test/unit/endless-descent.test.js` | 2/2 passing, loop reaches depth 60 with `state.won` false throughout and zero `"gate"` tiles generated | PASS |
| Phase 1 parity/round-trip/determinism suites still green (glob-invoked, avoiding the documented Windows directory-arg quirk) | `node --test test/parity/*.test.js test/roundtrip/*.test.js test/determinism/*.test.js test/difficulty/*.test.js` | `# tests 62` / `# pass 62` / `# fail 0` | PASS |
| `engine/combat.js`/`engine/death.js` unmodified since Phase 1 | `git log --oneline -- engine/combat.js` / `engine/death.js` | Only Phase 1 commit hashes appear | PASS |
| Deliberate Gate-win fixture retirement has rationale comments, not silent deletion | grep `RETIRED`/`DELIBERATELY` in `test/parity/full-suite.test.js` | Header comment + inline comment explain the retirement and cite 03-02/RUN-02/RUN-04 | PASS |

**Note on a false-alarm found during verification:** Running `node --test test/difficulty test/unit/... test/parity test/roundtrip test/determinism` (passing directory paths as positional args) produced 4 `Cannot find module` errors. This is the exact pre-existing Windows/Node v22.23.2 directory-arg resolution bug documented in `deferred-items.md` (logged during 03-01, confirmed unrelated to any Phase 3 file) — re-running with glob patterns (`test/parity/*.test.js`) or bare `node --test` (default recursive discovery) passes cleanly. Not a regression; not a phase gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| RUN-01 | 03-03 | 100%-dice-rolled character, zero choices, revealed pre-descent | SATISFIED | `newrun.test.js` (6 tests) |
| RUN-02 | 03-02 | Endless descent, no floor cap, no Gate ending | SATISFIED | `endless-descent.test.js`, `maze.test.js` "no gate ever" test, `movement.js` gate→descend routing |
| RUN-03 | 03-01, 03-02 | Bounded soft-cap curve with breather cadence, mechanical fairness bounds | SATISFIED (mechanical); human feel-check DEFERRED (see human_verification) | `difficulty.test.js` (8), `fairness.test.js` (3) |
| RUN-04 | 03-02, 03-03 | Permadeath is the sole terminator | SATISFIED | `permadeath.test.js` (5), death-card markup has no revive/undo affordance |
| RUN-05 | 03-03 | One action from death starts a fresh dice-rolled run | SATISFIED (engine/adapter level); browser click-through DEFERRED (see human_verification) | `new-run-loop.test.js` (3), `mazeworld.html` `window.newGame` wiring confirmed by static read |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps exactly RUN-01..05 to Phase 3, all five appear in a plan's `requirements:` frontmatter (03-01: RUN-03; 03-02: RUN-02/03/04; 03-03: RUN-01/04/05).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in `engine/difficulty.js`, `engine/maze.js`, `engine/movement.js`, `src/browser/engineAdapter.js` | — | None — clean |

`winGame()` and the `state.won` "Through the Gate" UI branch (mazeworld.html:3051-3059) remain in the codebase as intentionally-dormant dead code, explicitly documented (JSDoc "RETIRED... until Phase 4's win-screen UI cleanup removes state.won entirely") rather than silently orphaned — not classified as a stub/anti-pattern, this is a deliberate, rationale-backed deferral consistent with the plan's own instruction to retain `winGame()` for now.

### Human Verification Required

#### 1. Difficulty feel-check across floor 30-50+

**Test:** Play (or run `tools/tune-difficulty.mjs --seeds=N` as a proxy, then confirm subjectively via manual play) many runs to floor 30-50+.
**Expected:** A typical run resolves in roughly 5-10 minutes; no floor feels trivially easy; no floor feels unfairly unwinnable.
**Why human:** Pacing/fun/fairness-feel is a subjective judgment explicitly deferred in `03-CONTEXT.md`/`03-VALIDATION.md`'s "Manual-Only Verifications" table. The mechanical bounds (caps, darkness ceiling, breather cadence, fairness sweep) are already test-verified above and did not fail.

#### 2. Death-card "Roll another delver" browser click-through

**Test:** Open `mazeworld.html` in a browser, play to death, click "Roll another delver" on the death card.
**Expected:** A fresh dice-rolled level-1 character appears on a new floor 1; the prior run's deepest floor is recorded as the best-depth.
**Why human:** DOM click-through needs a real browser/WebView; `node:test` has no DOM. The engine-level behavior (`startNewRun()`) is test-verified (`new-run-loop.test.js`); the wiring itself was confirmed correct by direct code read. Only the live click event is unverified — this is the same item `03-03-SUMMARY.md`'s own coverage table flags as `human_judgment: true` (D3).

### Gaps Summary

No objective gaps found. All five RUN-01..05 requirements have real, passing automated tests exercising the mechanically-verifiable parts of each success criterion; `engine/combat.js`/`engine/death.js` are confirmed unmodified since Phase 1; the deliberate Gate-win fixture retirement is documented with rationale, not silent; best-depth is confirmed adapter-side, not folded into `GameState`; and the full suite (317/317, including the Phase 1 parity/round-trip/determinism regression guards) is green. The only open items are the two human-play verifications the phase itself explicitly designed to defer to milestone-end UAT (difficulty feel, browser death-card click) — these do not indicate a gap in the implementation, only in end-to-end human confirmation.

One process note (not a phase gap): `03-VALIDATION.md` frontmatter still reads `status: draft`, `nyquist_compliant: false`, with its own sign-off checklist unchecked and `Approval: pending` — this looks like a leftover artifact status that was never updated to reflect the phase's actual completion, since every item that checklist tracks (RUN-req↔test map, property tests on all unbounded knobs, Phase 1 suites green, tuning harness present) is independently confirmed true above.

---

*Verified: 2026-09-08T12:46:25Z*
*Verifier: Claude (gsd-verifier)*
