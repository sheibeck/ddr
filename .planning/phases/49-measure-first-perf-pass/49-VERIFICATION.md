---
phase: 49-measure-first-perf-pass
verified: 2026-09-20T11:30:00Z
status: passed
score: 4/4 success criteria verified on device + automated evidence (re-run by the orchestrator after 49-02, HEAD 4513219); criterion 3 passed as honestly partial under a recorded user ruling (fix landed, AFTER rows present, hotspot p95 not below 16 ms)
behavior_unverified: 0
overrides_applied: 1
human_verification: []
gaps: []
---

# Phase 49 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, 2026-09-20)

Goal-backward check of the phase goal: *the shell's per-step cost is known in numbers on the Pixel 7, and only a measured hotspot — or a jank the user confirms on device — changes code; if nothing qualifies, the phase closes with the baseline and no diff.*

Two plans. 49-01: `src/browser/perfMarks.js` (pure rings, never reads the clock) + seven `state.dev`-guarded `performance.now()` sites, a `#mw-dev-perf` readout inside the long-press dev row, `[mzperf]` on logcat every 10 steps, the method half of `docs/PERF-BASELINE.md`. 49-02: three Pixel 7 rounds (BEFORE, AFTER fix 1, AFTER fix 2), two presentation-only fixes, the doc, the close. **Human verification was in-phase** — the device rounds are the evidence — so nothing is deferred to the milestone batch.

## Evidence (orchestrator re-run at HEAD `4513219`)

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | `docs/PERF-BASELINE.md` records `paint()` and `draw()` per-step timings (median + p95 over ≥ 50 steps, water + dark floor) from the Pixel 7 debug APK, with method, build commit, device build number | Doc has Method / Device / Protocol / BEFORE / Jank report / Decision / AFTER / How to re-measure. **BEFORE (APK `742c916`, build CP2A.260705.006, depth 5, n=62):** step 14.2 / 28.9 / 33.4 · dispatch 3.9 / 8.3 / 15.1 · paint 8.6 / 15.3 / 17.9 · draw 1.6 / 3.3 / 4.2 ms (med / p95 / max). Jank: "None". Four rows, not two — `step` (whole `stepWith`) and `dispatch` (engine + narration + rail) added so the fix decision can tell engine from DOM |
| 2 | Every code change cites a baseline row ≥ 16 ms per step or a user-confirmed jank; else "zero code" | Only `step` qualified (p95 28.9). Fix 1 `9fe9bb5` (skip hidden Hero/Gear tab mounts on the step path, re-mount on tab switch — flag scoped to `stepWith`'s own `paint()` call; every other paint path unchanged) and fix 2 `cfce555` (remove the redundant second `draw()` per step; the `draw` row re-bracketed inside `paint()` through a registered `__mzPerfMarks` bridge) both cite the `step` row by hash and numbers in their commit messages. No other code change. Diagnosis from the node `paint()` sandbox: both hidden tabs were fully rebuilt on every map step |
| 3 | If a fix landed, an AFTER row shows the hotspot below 16 ms with no other row slower; fix presentation-only, fence intact — **override** | **AFTER fix 1 (APK `b8c9293`, n=70):** step 11.3 / 19.3 / 24.9 · paint 4.8 / 7.4 / 9.8 (paint halved); jank "none". **AFTER fix 2 (APK `c0cdbae`, n=61, final):** step 11.5 / 19.8 / 31.2 · dispatch 4.7 / 8.1 / 15.4 · paint 5.4 / 10.0 / 14.1 · draw 3.6 / 11.2 / 12.3; jank "No jank". Step **median** 14.2 → 11.5 (below 16); step **p95** 28.9 → 19.8 — **NOT below 16**. User ruling 2026-09-20 (offered: second fix + re-measure / keep and record / revert per rule): second fix, then keep both regardless — recorded verbatim in the doc and both SUMMARIES. Presentation-only: `git diff 515d664..HEAD -- engine content test/parity test/unit/fixtures` empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged; DOM snapshots 10/10 with fixtures untouched through both fixes |
| 4 | No timing instrumentation ships: marks behind the `dev` gate or removed, proven by a grep of `www/` after `build:www` | `grep -rn "performance.now" www/` → **7 lines, all in `www/index.html`, all inside `state.dev` guards; 0 elsewhere** (perfMarks.js is pure). Pinned by `test/unit/perfMarks.test.js` source pins. Instrumentation kept (dev-gated) as the standing re-measure method — judgment call recorded in the 49-01 SUMMARY; removal is one commit |
| — | `npm test` fail 0; `build:www`; `boot:check`; registry; tripwire | **3,315 / 0** (3,293 at phase start + 20 perfMarks tests + 2 draw-region pins); `build:www` exit 0; `boot:check` 4/4; `bridge-registry` 10/10 + `bridge-doc --check` exit 0 (`__mzPerfMarks` registered, 45 live names); `stale-terms.mjs` exit 0; `mazeworld.html` 5,682 lines |

## Notes the reader should have

- **Why p95 did not reach 16 and what is next:** after both fixes, dispatch + paint + draw p95 ≈ step p95, i.e. the remaining step cost is the sum of its real parts, not waste. The `draw` row (now the one draw inside `paint()`) swings 3.6 → 11.2 ms p95 between walks — route-dependent, most plausibly the dark-region 3×3 render filter. Between-walk variance is of the same order as the fixes. Next lever, for a future pass: measure a dark-only vs lit-only walk before touching `draw()`. Recorded in `docs/PERF-BASELINE.md` Decision.
- **Dev start rolls a fresh character** (`mzDevStartAtDepth` → `startNewRun(undefined, { startDepth })`, unchanged since Phase 21 `83526ae`): the user noticed the roller's Court Mage becoming a Thief on the dev run — by design, not a regression; noted in the 49-02 SUMMARY as a possible post-milestone todo (keep the rolled character).
- The n=47 AFTER-2 readout was superseded in the same run by the n=61 line; both are in the SUMMARY, only n=61 is authoritative.
- The APKs were installed with `adb install -r` over the sideloaded 1.4.0 build, so the on-device pre-v1.6 save survived for the UAT batch's tolerant-load items.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| PERF-01 | Complete | criteria 1, 4 |
| PERF-02 | Complete (fix kept by user ruling at p95 19.8) | criteria 2, 3 |

## Deferred to the milestone-close Pixel 7 batch

Nothing from this phase (its device work is done). The v1.6 batch stands at 26 items in `docs/UAT-v1.6.md`, to be run on APK `c0cdbae` (the build now on the phone).
