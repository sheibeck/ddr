---
phase: 60-performance-footprint-close
verified: 2026-09-23T03:30:00Z
status: passed
score: 4/4 success criteria met on device evidence (Pixel 7 session 2026-09-22, recorded in docs/PERF-BASELINE.md and docs/UAT-v1.8.md)
behavior_unverified: 0
overrides_applied: 0
human_verification: []
gaps: []
---

# Phase 60 — Verification (orchestrator-authored; gsd-verifier disabled for usage limits, standing 2026-09-14 ruling)

Goal: *the milestone's device footprint is measured on the Pixel 7 against the v1.7 baseline, and the milestone closes on one debug APK per the deferred-UAT protocol.* This phase IS the device session, so its evidence is device evidence. There is nothing left to defer.

Three plans:
- **60-01** (worktree): `tools/cold-start.mjs`, a dependency-free script that runs one warm-up launch plus 10 `am start -W` launches and reports median and p95. It also holds a tested `judge` that applies all three thresholds. 18 tests.
- **60-02** (main checkout): side-by-side builds of the `v1.7` tag and HEAD, each a debug APK plus a signed release AAB, built in temporary detached worktrees outside the repo with no version bump. Master was proven undisturbed. It also produced the v1.8 section of `docs/PERF-BASELINE.md` and `docs/UAT-v1.8.md` (31 merged checks).
- **60-03**: the one Pixel 7 session, with three human checkpoints.

The v1.7 baseline had to be produced in this phase. `PERF-BASELINE.md` had no cold-start or AAB rows, so the user ruled on side-by-side builds and chose two builds.

## Evidence

| # | ROADMAP success criterion | Result |
|---|---------------------------|--------|
| 1 | Cold start with every v1.8 asset bundled, measured against the v1.7 baseline | Pixel 7, same session, charging, Stay awake on. 1 warm-up + 10 COLD launches per build, no retries: **v1.7 871 / 951 ms** vs **v1.8 915 / 981 ms** (median / p95). **+44 ms (+5.1 %)**, under the > 10 % / > 100 ms threshold. |
| 2 | Step time (median / p95) against the same baseline | The Phase 49 overlay protocol from depth 5, one walk per build. **v1.7 11.6 / 22.0 ms** (n=55; water, dark in/out, encounter and tab switch all covered; no jank) vs **v1.8 6.9 / 16.6 ms** (n=100; water, dark in/out and menus/tabs covered; encounter not stated; no jank). Step p95 **improved by 5.4 ms**. dispatch, paint and draw all improved as well. |
| 3 | Release AAB size change measured and recorded | Both builds signed release AABs, verified with `jarsigner -verify`. **v1.7 9,306,177 B → v1.8 9,726,785 B: +420,608 B (+4.5 %)**, under the 2 MB threshold. The delta is the 30 clips plus code. The 54 dressing images and 9 party frames were already bundled, unused, in v1.7 (committed in `90dc06c` before the tag), and this is recorded in words. |
| 4 | Every regression past the baseline carries a recorded disposition | The tested `judge` reports `anyRegression:false` across all three measures. Dispositions records "None — no measurement regressed past a PERF-03 threshold". Nothing is silent. |
| — | Gates | `npm test` **3904 / 0**. `npm run build:www` exit 0. `git diff --quiet v1.7 HEAD -- engine/ content/ test/parity/` passes, so the engine gate holds across the **whole milestone**. Master hash `a1f4d0dc…` unchanged. `package.json`/lock untouched. No app file changed between the measured v1.8 APK (`d6db678`) and HEAD. |

## UAT (docs/UAT-v1.8.md)

- **56-3 PASS.** Airplane mode with Wi-Fi off on a genuine first launch of a fresh v1.8 install (22:52:34, a second fresh install because the first had already been opened for the walk). Every clip played and nothing was fetched.
- **The other 30 checks were NOT RUN**, deferred by the user to their own play sessions. The user's general verdict, verbatim: *"Generally everything looks good. I'm not going to do in depth uat right now. I'll uat over playing several sessions and report back."* The rows stay open in `docs/UAT-v1.8.md`, the same way the v1.5–v1.7 batches did.
- **Two findings were filed as todos**, with no mid-run code edits:
  1. **The water sound plays only on entering water.** Every step on a water square should play the water clip (`src/browser/sfx.js` step-clip selection).
  2. **The band-1 identity line should drop the parent class.** User ruling: keep the race. Target "Dwarf Pickpocket · Lvl 3" (`hudBands.js#identityParts`).
- Noted, **not a finding**: both builds show "Version 1.5.0 (6)", because this phase deliberately makes no version bump.

## Phone state at close

The Pixel 7 is left on the milestone's one debug APK: `ddr-v1.8-d6db678-debug.apk`, commit `d6db678`, sha256 `038c042d…5555`.
