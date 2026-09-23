# Phase 60: Performance & Footprint Close - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 decisions in 1 area, all accepted as recommended

<domain>
## Phase Boundary

Measure the milestone's device footprint — 30 clips (Phase 56), 54 set-dressing images + 9 party frames (Phase 59), and the Phase 57–59 shell work — on the Pixel 7 against v1.7, record it in `docs/PERF-BASELINE.md`, give every regression past a threshold a recorded disposition, and close the milestone on one debug APK per the deferred-UAT protocol (PERF-03).

**Discovered while scouting:** `docs/PERF-BASELINE.md` (Phase 49, v1.6 era) records only the four step rows (`step` / `dispatch` / `paint` / `draw`). It has **no cold-start and no AAB-size baseline**, so the "v1.7 baseline" the ROADMAP names must be produced in this phase, not looked up. The `v1.7` git tag exists.

**Out of scope:** optimisation work beyond what a measured regression's disposition requires; any engine/content change; the three older UAT batches (`docs/UAT-v1.7.md`, `-v1.6.md`, `-v1.5.md`), which may share the device session but are not this phase's requirements.

</domain>

<decisions>
## Implementation Decisions

### Baseline & measurement (PERF-03)
- **Side-by-side baseline.** Build a debug APK from the `v1.7` tag AND one from v1.8 HEAD, and measure both in the SAME Pixel 7 session (same device, same day, same thermal/storage state) — apples to apples. Record both columns in `docs/PERF-BASELINE.md` under a new v1.8 section (the Phase 49 rows stay as history).
- **Cold start:** the orchestrator runs `adb shell am start -W` (force-stop between runs) **10× per build** and records median + p95 of `TotalTime`; the user only connects the phone (wireless adb — rediscover via `adb mdns services`; a v1.7 install and a v1.8 install share the debug signer, so install-over works; Play-signed installs must be uninstalled first — see STATE.md Ground Truth).
- **Step time:** the existing Phase 49 dev perf-overlay protocol (`#mw-dev-perf` under the Settings sheet's Start button; ≥ 50 mixed steps from depth 5 with water, dark, an encounter card and a tab switch) — the user walks it once per build and reports the four rows' med/p95/max/n.
- **AAB size:** the orchestrator builds signed release AABs at both commits on this machine (keystore per STATE.md Ground Truth; `npm run android:release`-shaped build WITHOUT the version bump) and records the byte sizes and the delta. No device needed. The version bump / Play upload is NOT part of this phase (standing rule: ask the user separately about a Play internal-testing push).

### Regression thresholds & dispositions
- A measurement **regresses** when: cold start median exceeds v1.7's by **> 10 % or > 100 ms**; step p95 exceeds v1.7's by **> 2 ms**; the AAB grows by **> 2 MB**.
- Every regression gets a **recorded disposition** in `docs/PERF-BASELINE.md`: a fix (the ROADMAP names the lever — lazy-load / sprite the dressing images; note dressing is already lazy-loaded after first paint and never loaded when Off) or an explained, accepted miss. Never a silent regression. Sub-threshold deltas are recorded with no disposition required.

### The device session & UAT
- **One checklist:** `docs/UAT-v1.8.md` merges every deferred device check from Phases 56–59 (56-VERIFICATION, 57-VERIFICATION, 58-VERIFICATION, the Phase 59 SUMMARY/VERIFICATION lists — roughly 35 items), grouped by phase, with the perf protocol at the top. Run in the SAME session as the perf measurements.
- Findings become todos / quick tasks — never mid-run edits (deferred-UAT protocol). The milestone closes on the recorded results.

### Claude's Discretion
- Tooling shape for the cold-start runs (a small `tools/` script that loops `am start -W` and parses `TotalTime` is fine; it must not add a dependency).
- How the two APKs are produced (a temporary worktree or `git archive` of the `v1.7` tag for the baseline build, never a checkout that disturbs master), as long as master stays clean and the build uses the pinned JDK (`tools/pin-jdk.mjs`, `tools/gradle.mjs`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/PERF-BASELINE.md` — Method / Device / Protocol / BEFORE / AFTER sections from Phase 49; the step protocol and the fix rule (median or p95 ≥ 16 ms) live here.
- `src/browser/perfMarks.js` + the dev-gated `#mw-dev-perf` overlay (Phase 49) — the step/dispatch/paint/draw rows.
- `package.json` scripts: `android:debug` (cap:sync → pin-jdk → gradle assembleDebug), `play:release` (version:bump + android:release). `tools/gradle.mjs` runs the wrapper (`NoDefaultCurrentDirectoryInExePath=1` on this machine); `npx cap sync` wipes `org.gradle.java.home` — `tools/pin-jdk.mjs` re-applies it.
- `docs/UAT-v1.7.md` — the house format for a batched device checklist.

### Established Patterns
- Deferred-UAT protocol: the debug APK is built once, after the last plan lands; the user runs the batch; findings → todos.
- Device deploy: `adb install -r` + `am force-stop` + `monkey` relaunch (install alone doesn't reload the WebView).

### Integration Points
- `docs/PERF-BASELINE.md` (new v1.8 section), `docs/UAT-v1.8.md` (new), the two build artifacts (paths recorded, not committed), `.planning/REQUIREMENTS.md` PERF-03.

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP's own disposition lever: "a fix (lazy-load/sprite the dressing images) or an explained, accepted miss — never a silent regression".
- Phase 49's precedent: the user reported step numbers from the overlay; the orchestrator recorded them honestly, including a p95 miss the user accepted.

</specifics>

<deferred>
## Deferred Ideas

- A Play internal-testing push of v1.8 — asked separately after the milestone (standing rule), not part of this phase.
- A `.gitattributes` `eol=lf` pin for the fixtures that break in fresh worktrees (58 deferred-items) — a tooling follow-up.

</deferred>
