# Phase 49: Measure-First Perf Pass - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Autonomous — no discuss round (ROADMAP: "measure first, fix only what is measured" is the whole rule). One user ruling taken 2026-09-20: **measurement method = in-app dev-gated `performance.now()` marks with an on-screen readout** (Chrome remote profiling declined).

<domain>
## Phase Boundary

The shell's per-step cost is known in numbers on the Pixel 7, and only a measured hotspot (≥ 16 ms per step) or a jank the user confirms on device changes code; if nothing qualifies the phase closes with the baseline doc and no fix. Requirements PERF-01, PERF-02. The phase has a hard device dependency: the user's Pixel 7 and the milestone-close debug APK — the same APK serves the 26-item v1.6 UAT batch, so the device session covers both.

**Engine-gate fence:** zero bytes under `engine/`, `content/`, `test/parity/`, `test/parity/prototype-master.js.txt` (hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`). Presentation-only: `mazeworld.html`, `src/browser/`, `tools/`, `docs/`, `test/unit/`. No behaviour change; the Phase 47 DOM-snapshot smoke (10/10, no fixture change) and `boot:check` 4/4 hold at every commit; `npm test` fail 0 (3,293 at phase start + whatever the instrumentation's own tests add, recorded).

**Phase-start baseline (2026-09-20, HEAD `515d664`):** no `performance.now()` anywhere in `mazeworld.html` or `src/browser/` (grep 0); no `docs/PERF-BASELINE.md`; `mazeworld.html` 5,580 lines — `draw()` at L1920 (canvas), `paint()` at L2371 (DOM; reads `S.dev` at L2378 for the DEV chip), `stepWith(action)` at L4911 → `dispatchWithNarration` L4809 (the move dispatch site); the dev gate = a ~1.2 s long-press on the Settings version label reveals `#mw-dev-row` (L4517–4540), whose Start button calls `window.mzDevStartAtDepth(depth)` and flags the run `state.dev`. `npm run android:debug` builds `android/app/build/outputs/apk/debug/app-debug.apk`; the user's adb-wireless install/launch recipe is in `docs/DIFFICULTY-RETUNE.md` L1064–1070. Dark blobs follow `engine/difficulty.js#difficultyCurve(depth).darkBlobs` (zero on breather floors); water pools exist on every floor.

</domain>

<decisions>
## Implementation Decisions

### Measurement (PERF-01) — user ruling 2026-09-20
- **In-app marks, dev-gated.** A small pure module `src/browser/perfMarks.js` (ring buffer of the last N=100 samples per row; `record(row, ms)`, `summary()` → `{ row: { n, median, p95, max } }`, `formatReadout(summary)`; unit-tested in node with injected samples) and `performance.now()` call sites in the shell around **three rows**: `draw()` (one canvas render), `paint()` (one DOM re-render), and **`step`** — wall time from the move dispatch in `stepWith()` to the end of the `paint()` that follows it (the number the ROADMAP means by "per step"). Every call site is guarded by `S.dev` (the existing dev gate — the marks cost nothing and record nothing in a normal run).
- **Readout:** a `#mw-dev-perf` line inside `#mw-dev-row` (Settings sheet, visible only after the long-press reveal) updated after every recorded step: `step 7.4 / 12.1 · paint 3.2 / 6.0 · draw 1.9 / 4.3 ms (med / p95, n=57)`; plus `console.log("[mzperf] " + JSON.stringify(summary))` every 10 steps so `adb logcat -s chromium` gives the same numbers. No new setting, no persistence, nothing on the HUD.
- **Ship proof (criterion 4):** after `npm run build:www`, `grep -rn "performance.now" www/` returns only `src/browser/perfMarks.js` and the `S.dev`-guarded shell sites — recorded verbatim in the SUMMARY. The instrumentation stays (dev-gated) rather than being removed: it is the phase's measurement method under criterion 1, not a "fix" under criterion 2, and it lets the next perf pass skip this plan. Recorded as a judgment call for the user to reverse (removal is one commit).

### Device protocol (the user's part)
- The orchestrator builds the debug APK once, after 49-01 lands, and hands the user a checklist (in the 49-01 SUMMARY and in chat): install (`adb install -r …`), launch, Settings → long-press the version label → Start at depth **D** (the executor computes and records the smallest D ≥ 5 that is not a breather floor and has `darkBlobs ≥ 1` from `difficultyCurve`, so the floor has both water and a dark region), then walk **≥ 50 steps** including through water and into/out of the dark region, with at least one encounter card and one tab switch mixed in (representative, not a synthetic best case), then read the `#mw-dev-perf` line (and/or `adb logcat -s chromium | grep mzperf`) and report: the three rows (median / p95 / max, n), the device build number (Settings → About phone → Build number), the APK's commit, and **any jank they saw and where** (a stutter on step, a late repaint, a tab flash) — "none" is a valid answer.
- The 26-item v1.6 UAT batch (`human_verification` lists of 44/45/46/47-VERIFICATION.md, assembled by the orchestrator into `docs/UAT-v1.6.md` before the session) is run on the same APK in the same session; its results go to the milestone close, not to this phase.

### Fix rule (PERF-02) — verbatim from the ROADMAP
- A code change is allowed only if it cites a baseline row with **median or p95 ≥ 16 ms** per step, or a jank the user confirmed on device (quoted). Otherwise the phase's whole diff beyond the instrumentation is `docs/PERF-BASELINE.md` — and the SUMMARY says "no row qualified; the phase closes with the baseline and no fix" in those words.
- If a fix lands: presentation-only (shell/`src/browser`), one commit, citing the row; the user re-runs the same protocol on a second APK and the doc carries an AFTER row showing that row < 16 ms with no other row slower. The DOM-snapshot smoke must still pass byte-equal (a perf fix must not change rendered DOM; if it must — e.g. batching — that is a user decision, ask).

### `docs/PERF-BASELINE.md` (criterion 1)
- Sections: Method (the marks, the three rows, what each brackets, the readout, the `www/` grep), Device (Pixel 7, Android build number, APK commit, date), Protocol (depth D, steps walked, what was mixed in), BEFORE table (row × median / p95 / max / n), Jank report (user's words), Decision (which row qualifies or "none"), AFTER table (only if a fix landed), and a "How to re-measure" recipe. Numbers are the user's report, quoted as given — never rounded or estimated by the executor.

### Claude's Discretion
- Plan slicing (recommended: **49-01** instrumentation + readout + `perfMarks.test.js` + the `www/` grep + the user checklist, fully autonomous, ending in the APK build by the orchestrator; **49-02** after the user's report — the doc, the fix-or-no-fix decision, the AFTER row if any, closing gates, PERF-01/02 marked complete). 49-02 cannot start until the numbers exist — it is planned now but dispatched only after the device session.
- Ring size, exact readout wording, whether `step` also splits out `dispatchWithNarration` (engine + narration) as a fourth row (recommended if cheap — it tells the user whether time is in the engine or the DOM).

</decisions>

<code_context>
## Existing Code Insights

- `src/browser/bridge.js` registry + `test/unit/bridge-registry.test.js`: any new `window.__mz*` name (`perfMarks.js` is imported by the module script; if the classic `draw()`/`paint()` need it, one registered bridge — the planner decides and registers it) must be listed in the same commit; `node tools/bridge-doc.mjs --write` regenerates the doc table.
- `src/browser/settings.js` / the Settings sheet markup (`#mw-dev-row` L1326) for the readout element; `#mw-app-version` is stamped by `tools/build-www.mjs`.
- `tools/stale-terms.mjs` (Phase 48 tripwire, pinned by `test/unit/stale-terms.test.js`): new comments must not reintroduce retired vocabulary.
- `docs/DIFFICULTY-RETUNE.md` L1064–1070: the adb wireless recipe; `docs/RELEASING.md`: the release build recipe (not used here — debug APK only).
- The v1.4 device round's one perf finding (party-pulse `box-shadow` repaint, fixed) — the only prior data point; `www/` is 4.8 MB; `npm test` ≈ 24–45 s on this machine.

## Integration Points
- `mazeworld.html`: `draw()` L1920, `paint()` L2371, `stepWith()` L4911, the dev row L1326 + L4517–4540; the module script's imports.
- `.planning/ROADMAP.md` Phase 49 criteria 1–4; `REQUIREMENTS.md` PERF-01/02.

</code_context>

<specifics>
## Specific Ideas

- Closing gates verbatim from ROADMAP criteria 1–4: `docs/PERF-BASELINE.md` with the three rows' median/p95 over ≥ 50 steps on a water + dark floor, the method, the APK commit and the device build number; every code change beyond the instrumentation cites a ≥ 16 ms row or a quoted jank, else "zero code" stated in those words; AFTER row if a fix landed with the fence intact; `grep -rn "performance.now" www/` after `build:www` showing only the dev-gated sites; plus `npm test` fail 0, `build:www`, `boot:check` 4/4, DOM snapshots 10/10 unchanged, `stale-terms.mjs` exit 0.
- Human verification is **in-phase** (the device session is the phase), not deferred; the VERIFICATION records the user's numbers and jank report as the evidence.

</specifics>

<deferred>
## Deferred Ideas
- Chrome remote-profiling cross-check (declined for this pass; the recipe can be added to PERF-BASELINE.md's "How to re-measure" for a future pass).
- Any optimisation not backed by a row — explicitly out of scope by PERF-02.
</deferred>
