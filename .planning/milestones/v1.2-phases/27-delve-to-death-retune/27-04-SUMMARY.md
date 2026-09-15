---
phase: 27-delve-to-death-retune
plan: 04
subsystem: difficulty-tuning
tags: [dr-round, human-checkpoint, debug-build, adb-install, pixel-7, ledger, verdict-left-blank, no-engine-change]

# Dependency graph
requires:
  - phase: 27-delve-to-death-retune
    plan: 03
    provides: "The final v1.2 pin (39bfecf, docs commit 91c5b13) — retuned engine/difficulty.js constants, the full 143x40/143x10 AFTER on that pin, and the completed ledger through Comparison vs band / Counterweight triggers / Not changed and why."
provides:
  - "docs/DIFFICULTY-RETUNE.md's `### DR checklist — TUNE-07` filled: build identity, dev start-at-depth how-to, four run sections (forced 20/35/50 + natural) each with 'what should be true' lines quoting the TUNE-05 band and the retune AFTER numbers, fill-in tables, and a flag-if-noticed list."
  - "`### Verdict (TUNE-07)` left blank with exactly three allowed values (tuned / tune-again / deferred) and the what-happens-next rules for each."
  - "A built (but not yet installed) debug APK at android/app/build/outputs/apk/debug/app-debug.apk, from commit 91c5b13, with the Pixel 7 install/relaunch commands recorded for when the device is reachable."
affects: [27-04-checkpoint-resume]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DR checklist as a durable ledger artifact: the executor never writes the verdict, only the tester (via the orchestrator) does — the blank three-valued Verdict block plus a 'what happens next' rule per value is the reusable shape for future DR rounds (mirrors the v1.1 TUNE-04 checklist's own shape)."

key-files:
  created: []
  modified:
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Device was unreachable this session (`adb devices` and `adb mdns services` both returned empty lists, retried once after `adb kill-server`/`start-server` per the plan's own contingency) — the debug build was NOT installed. Per the no-uninstall prohibition, nothing was touched on the phone; the four install/verify commands are recorded verbatim in `#### Build under test` for whenever the phone reconnects. This is reported plainly at the checkpoint rather than treated as a blocker requiring a re-run."
  - "The DR checklist's 'what should be true' lines quote the exact TUNE-05 band numbers alongside the 27-03 retune AFTER numbers (e.g. Run 1: band 3.0-5.0 encounters survived vs. retune AFTER 3.17 IN; band floors-gained p50 >= 1 vs. retune AFTER p50 0 OUT) so the tester judges against the same figures the bot was tuned to, not a re-derived summary."
  - "No engine/content/src/mazeworld.html/tools/test change — verified via `git diff --quiet 91c5b13 -- engine content src mazeworld.html tools` (exit 0) both before and after the ledger edit. The only committed file is docs/DIFFICULTY-RETUNE.md."

requirements-completed: []

coverage:
  - id: D1
    description: "TUNE-07 DR checklist filled with four runs (forced 20/35/50 + natural), each with band+AFTER-derived 'what should be true' lines, fill-in tables, and a blank three-valued Verdict block"
    requirement: TUNE-07
    verification:
      - kind: unit
        ref: "test/unit/difficulty-retune-ledger.test.js (13/13)"
        status: pass
      - kind: manual_procedural
        ref: "The four on-device runs and the tuned/tune-again/deferred verdict itself"
        status: unknown
    human_judgment: true
    rationale: "TUNE-07 is a human DR round by design — the verdict can only come from the user playing the four runs on the Pixel 7. This plan's own job (the checklist + build) is unit-verified; the verdict is not."

# Metrics
duration: ~35min
completed: 2026-09-15
status: checkpoint
---

# Phase 27 Plan 4: TUNE-07 DR Checklist + Debug Build Hand-off Summary (CHECKPOINT — awaiting human verdict)

**This plan is NOT complete.** Task 1 (build + ledger) is done and committed; Task 2 is a blocking human checkpoint that hands the retuned build and the four-run DR checklist to the user. The phase's exit criterion — the TUNE-07 verdict (tuned / tune-again / deferred) — is outstanding by design and must be recorded verbatim by the orchestrator once the user responds.

## Performance

- **Duration:** ~35 min
- **Tasks:** 1 of 2 (Task 1 `type="auto"`, committed; Task 2 is the blocking checkpoint this SUMMARY is written ahead of)
- **Files modified:** 1 (docs/DIFFICULTY-RETUNE.md)

## Accomplishments

- **Preflight (Task 1):** `git status --porcelain` empty at commit `91c5b13` (the 27-03 pin's tree — `git diff --quiet 91c5b13 -- engine content src mazeworld.html tools` exits 0). `npm test`: **1448/1448 green**. Parity: **33/33 green** (`node --test test/parity/*.test.js test/parity/harness/*.test.js`).
- **Debug APK built:** `npm run android:debug` succeeded (BUILD SUCCESSFUL in 35s). `android/app/build/outputs/apk/debug/app-debug.apk` — **9,452,268 bytes, 2026-09-15 18:21:05.114258600 -0400**. Version **1.2.0 (3)** per `android/version.properties`. `android/gradle.properties` was NOT modified by the build (no restore needed).
- **Device unreachable:** `"$ADB" devices` returned an empty list; `"$ADB" mdns services` also returned empty. Retried once after `adb kill-server` / `adb start-server` per the plan's contingency — still empty. The Pixel 7 (`adb-28051FDH200H0R`) did not answer over wireless adb this session. **The build was NOT installed or relaunched. No uninstall was attempted or needed** (no signer-mismatch scenario arose, since nothing was installed). The four commands to install/relaunch/verify once the phone reconnects are recorded verbatim in `docs/DIFFICULTY-RETUNE.md`'s `#### Build under test`.
- **DR checklist appended** (`### DR checklist — TUNE-07`): a preface with the final constants under test (`COMBAT_SCALE_FROM_DEPTH` 21, `FOE_CAP_MAX` 4, `FOE_POWER_MAX` 1.15, `ABILITY_THREAT_MAX` 1.3, `ENCOUNTER_DOT_CAP` 13, `FOE_GRACE_AT_2` 0.5) and the curve at 20/35/50; the retune AFTER band verdicts one line each (natural median 4 IN, reach>=5 30.6% IN, forced-20 encounters 3.17 IN, forced-20 floors-gained p50 0 OUT / mean 0.84 OUT, cannot-act 0/143 IN, reach>=20 0.1% OUT); `#### Build under test` (commit, APK identity, version, test counts, the device-unreachable note + reinstall commands); `#### Starting a run at depth N` (the hold-the-version-row how-to, matching the current Settings sheet labels verified against `mazeworld.html`); four run sections — **Run 1 forced 20** (the acceptance bar, band+AFTER-quoted "what should be true", fill-in table), **Run 2 forced 35** and **Run 3 forced 50** (descriptive, quoting the bot's per-depth tune-difficulty readouts from the ledger's own Comparison-vs-band informational rows), **Run 4 natural from floor 1** (band+AFTER-quoted); `#### Flag if noticed` (class outliers, Con Artist, Oracle voice, Ned's line).
- **Verdict block replaced:** the blank three-valued Verdict (`tuned` / `tune-again` / `deferred`), a `**Per-run notes above complete**` placeholder, a `**If deferred**` reason placeholder, a `**Gate at hand-off**` line (npm test 1448/1448, parity 33/33, pin 91c5b13, APK timestamp, NOT installed — device unreachable), and the full `**What happens next**` rules for each of the three verdict values (including the standing Play internal-build ASK on `tuned`).
- **Guard tests:** `node --test test/unit/difficulty-retune-ledger.test.js` — **13/13 pass** (including the fixed-order H3 sub-heading check, which still expects exactly 16 H3s ending in `### DR checklist — TUNE-07` / `### Verdict (TUNE-07)` — no new H3 was added, only H4 sub-sections). The plan's own inline verify script (checklist structure + exactly four runs + blank verdict) also passed.
- **CRLF preserved:** the ledger file's line endings were verified CRLF both before and after the edit (`file docs/DIFFICULTY-RETUNE.md` reports "with CRLF line terminators" in both cases) — the patch script normalized the whole file to CRLF on write rather than relying on a partial in-place edit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the debug APK, attempt install/relaunch on the Pixel 7 (device unreachable), append the DR checklist + blank verdict to the ledger** - `1a6e88e` (docs)

_Task 2 is the blocking `checkpoint:human-verify` — the plan stops there; no further commits are made until the orchestrator records the user's verdict._

## Files Created/Modified

- `docs/DIFFICULTY-RETUNE.md` - `### DR checklist — TUNE-07` filled (preface, build identity, dev-start how-to, four run sections, flag-if-noticed) and `### Verdict (TUNE-07)` replaced with the blank three-valued block + what-happens-next rules

## Decisions Made

- **Device unreachable — reported, not treated as a blocker.** Per the plan's own contingency ("if absent, STOP and report 'device not reachable' at the checkpoint with the APK path and the three commands for the user"), the build proceeded, the ledger records the situation honestly in `#### Build under test`, and the checkpoint below surfaces it plainly. Nothing was uninstalled or force-installed to work around it.
- **No engine/content/src/mazeworld.html/tools/test change.** The retune under test is entirely 27-03's pin (`39bfecf`, landed in the docs-only commit `91c5b13`); this plan's only committed file is the ledger.
- **SUMMARY status is `checkpoint`, not `complete`.** This plan is not done — the phase's exit criterion (the human verdict) is outstanding by design. The orchestrator records the user's word verbatim in `### Verdict (TUNE-07)` and decides the tune-again / deferred / tuned path from there; this executor never writes the verdict.

## Deviations from Plan

None — plan executed exactly as written, including its own documented contingency for an unreachable device (Rule 3 territory, but explicitly pre-authorized by the plan's own action text rather than an ad hoc auto-fix).

## Issues Encountered

- The Pixel 7 did not answer over wireless adb this session (`adb devices` / `adb mdns services` both empty, even after an `adb kill-server`/`start-server` retry). Likely cause: the phone's screen is asleep or wireless debugging toggled off/expired since the last session — not a repo or tooling problem. Resolution is on the user's side (wake the phone / re-enable wireless debugging), after which the four commands in `#### Build under test` install and prove the build.

## User Setup Required

None beyond reconnecting the Pixel 7 for the install step (see `#### Build under test` in the ledger for the exact commands) — no external service configuration required.

## Next Phase Readiness

- **This plan does not close the phase.** TUNE-07's verdict is the milestone's stated exit criterion; the phase stays `human_needed` until the user plays the four runs and answers with `tuned`, `tune-again`, or `deferred`.
- **On `tuned`:** the orchestrator records the verdict verbatim, flips the phase's VERIFICATION to passed, and per the standing rule ASKS whether to push a versionCode-bumped signed AAB to the Play internal-testing track — never unasked.
- **On `tune-again`:** one more bounded constants-only iteration inside this phase (27-03's protocol on `engine/difficulty.js` + `PHASE_27_PINS`), a ledger addendum, a rebuild, and a second round of this same checklist — no re-plan.
- **On `deferred`:** the user's reason is recorded verbatim in the Verdict block and the milestone closes on it; shipping constants stay as pinned.
- **Standing follow-up regardless of verdict:** the phone needs to be reachable for the actual install — the checklist's `#### Build under test` has the exact reinstall commands.

---
*Phase: 27-delve-to-death-retune*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: docs/DIFFICULTY-RETUNE.md (modified, contains `### DR checklist — TUNE-07` filled content and the blank `### Verdict (TUNE-07)` block)
- FOUND: android/app/build/outputs/apk/debug/app-debug.apk (9,452,268 bytes, 2026-09-15 18:21:05)
- FOUND: commit `1a6e88e` in `git log --oneline --all`
- Guard test `test/unit/difficulty-retune-ledger.test.js`: 13/13 pass
- `npm test`: 1448/1448 pass
- Parity: 33/33 pass
- `git status --porcelain`: empty
- `git diff --quiet 91c5b13 -- engine content src mazeworld.html tools`: exit 0
