---
phase: 21-consolidated-difficulty-retune
plan: 05
subsystem: docs
tags: [ledger, dr-checklist, human-signoff, phase-gate, debug-build, no-engine-change]

requires:
  - phase: 21-consolidated-difficulty-retune (plan 03)
    provides: "the dev start-at-depth toggle (Settings version-line long-press, Start at depth (dev) field, DEV chip, build-www version stamp)"
  - phase: 21-consolidated-difficulty-retune (plan 04)
    provides: "the final retuned constants (FOE_CAP_MAX=5, FOE_POWER_MAX=1.6, ABILITY_THREAT_MAX=2.0, FOE_POWER_SOFT_K=35, ABILITY_THREAT_SOFT_K=30) and the honest Comparison-vs-D-09 table (3 of 4 harness targets missed because the bot dies by floor 1-10)"
provides:
  - "docs/DIFFICULTY-RETUNE.md: '## DR checklist — TUNE-04 sign-off' — build/install how-to, dev-start how-to (landed labels), three run tables (depth 20/35/50) with curve-value context, flag-if-noticed list, unfilled verdict block, D-16 outcomes, and the one-line phase-gate record"
  - "Phase-gate evidence: npm test 951/951, parity 30/30, frozen files identical to 04eb229, npm run build:www stamped 1.0.1 (2), tune-difficulty/tune-economy --json smoke, bestiary-yardstick.mjs exit 0, no code diff since 21-04's final commit"
  - "Debug APK built (android/app/build/outputs/apk/debug/app-debug.apk) and handed off with install instructions; the phase now waits on the human DR round"
affects: []

tech-stack:
  added: []
  patterns:
    - "Phase-ending human sign-off ledger section: how-to steps + fill-in tables + an explicitly unfilled verdict block + a machine-verified 'gate at hand-off' line, so a reader can tell in one glance what's proven vs. what's pending"

key-files:
  created: []
  modified:
    - docs/DIFFICULTY-RETUNE.md

key-decisions:
  - "Curve values for the three run tables (foeCap/foeBonus/foePower/abilityThreat at depth 20/35/50) were computed by actually running difficultyCurve() via node -e against the frozen engine, not hand-derived from the soft-cap formula, to guarantee the ledger's 'What to expect here' lines are exact"
  - "The 21-30/31-50 bands have zero bot samples in every readout in 21-04's ledger (0/0 every time) — the Run 2/3 tables say so explicitly rather than inventing a caster-encounter-rate expectation for a band the harness never reached; only Run 1 (depth 20) can cite a real sampled rate (66.7%, n=12, --party only, 11-20 band)"
  - "adb was not on PATH in this shell and per this plan's own project_notes the executor must not attempt device install/deploy itself (that is the orchestrator's job) — the debug APK's build success (EXIT=0) and its path are recorded, with the install command left for the user/orchestrator to run, rather than attempting adb install and failing on a missing binary"
  - "The 'Gate at hand-off' line was written as a single appended line (no blank-line insertion) so the plan's own acceptance criterion ('git diff --stat shows exactly one inserted line') holds exactly, rather than approximately"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "docs/DIFFICULTY-RETUNE.md ends with a complete '## DR checklist — TUNE-04 sign-off' section: build/install how-to, dev-start how-to naming the landed Settings labels and DEV chip, three run tables (depth 20/35/50) each carrying all seven D-15 checklist rows plus a curve-derived 'What to expect here' line, a flag-if-noticed list (Sterling halfDmg, Djinni/Stalka discount, bolt telegraph), an unfilled verdict block, and the D-16 pass/tune-again outcome procedure"
    requirement: "TUNE-04"
    verification:
      - kind: other
        ref: "grep -c checks per the plan's own acceptance_criteria (all satisfied: DR checklist heading x1, Filled-by-plan x0, five ### subheadings x5, three Run headings x3, android:debug/adb install/RELEASING.md/force-stop present, Start at depth (dev)/DEV chip/1.2 s present, Session-length feel/caster fight/parley/Party affordability/reason I understood/Free notes >=3 each, What to expect here x3, Sterling/telegraph/no hire cost present, to be filled by the tester >=2, tune-again >=3, /gsd-quick and play:release present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase gate proves the tree is green and frozen at 21-04's final commit: npm test fully green, parity 30/30, frozen files (prototype-master.js.txt, fixtures, foe-abilities determinism, foe-turn-draw-count, package.json/lock) identical to 04eb229, npm run build:www succeeds with the version stamped into www/index.html, both tuning tools smoke-test as valid JSON, the yardstick runs, no www/ leaked into git status, and zero engine/content/src/mazeworld.html/tools/test diff since this plan's own BASE commit"
    requirement: "TUNE-04"
    verification:
      - kind: integration
        ref: "npm test (951/951 pass)"
        status: pass
      - kind: integration
        ref: "node --test \"test/parity/**/*.test.js\" (30/30 pass)"
        status: pass
      - kind: other
        ref: "git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/determinism/foe-abilities.test.js test/unit/foe-turn-draw-count.test.js package.json package-lock.json (exit 0)"
        status: pass
      - kind: other
        ref: "npm run build:www (stamped 'version 1.0.1 (2)' into www/index.html; grep -c match = 1; no ?? www/ in git status)"
        status: pass
      - kind: other
        ref: "node tools/tune-difficulty.mjs --seeds=3 --json and node tools/tune-economy.mjs --seeds=3 --json both parse as JSON; node tools/bestiary-yardstick.mjs exits 0"
        status: pass
      - kind: other
        ref: "git diff --quiet BASE(22a9432) -- engine content src mazeworld.html tools test (exit 0, after both this plan's commits)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The debug APK is built and handed off (path + install command), and the SUMMARY states plainly that ROADMAP Phase 21 criteria 1-3 are met while criterion 4 (the human DR round) is OUTSTANDING BY DESIGN — the phase's VERIFICATION must end human_needed on the DR checklist's unfilled verdict, which the executor did not fill"
    requirement: "TUNE-04"
    verification: []
    human_judgment: true
    rationale: "This is the phase's deliberate exit criterion (D-15/D-16) — a human must play three dev-start runs at depth 20/35/50 on the Pixel 7, fill each run's table, and record one pass/tune-again verdict in docs/DIFFICULTY-RETUNE.md's '### Verdict' block. No automation can substitute for this judgment; the verdict block in the ledger reads '(to be filled by the tester)' and must stay that way until the human plays."

duration: 35min
completed: 2026-09-14
status: complete
---

# Phase 21 Plan 5: DR Checklist + Phase Gate (TUNE-04 Hand-off) Summary

**Wrote the complete DR sign-off checklist into `docs/DIFFICULTY-RETUNE.md` (build/install how-to, dev-start how-to, three depth-20/35/50 run tables with curve-derived expectations, flag-if-noticed list, unfilled verdict, D-16 outcomes) and proved the tree green and frozen at 21-04's final commit (951/951 tests, 30/30 parity, build stamped, debug APK built) — the phase now waits on the human's on-device DR round, not on any further engine change.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-14
- **Tasks:** 2 completed
- **Files modified:** 1 (`docs/DIFFICULTY-RETUNE.md`)

## Accomplishments

- Replaced the `## DR checklist — TUNE-04 sign-off (21-05)` placeholder with a full section: a preface naming the final retuned constants and the DR round's role as the real exit criterion; `### Getting the build on the device` (`npm run android:debug`, uninstall-if-Play-signed, `adb devices`/`adb mdns services`, `adb install -r`, `am force-stop` + `monkey` relaunch); `### Starting a run at depth N` using the exact landed Settings labels from 21-03 (long-press the "Version 1.0.1 (2)" row ≈1.2 s, the "Start at depth (dev)" field, the Start button, the dev banner, the DEV chip, level 5 / 300×N purse, never buried/never a best depth).
- Wrote three identical-shape run tables (`### Run 1 — depth 20`, `### Run 2 — depth 35`, `### Run 3 — depth 50`), each with the seven D-15 checklist rows (session-length feel, one caster fight, one parley attempt + one failure, party affordability with the D-20 no-hire-cost note, ended-for-a-reason, free notes) and a "What to expect here" line citing real `difficultyCurve(20|35|50)` output computed via `node -e` against the frozen engine: depth 20 → foeCap 4/foeBonus+1/foePower≈1.21/abilityThreat≈1.39 (66.7% caster rate, the only sampled deep band, n=12, `--party` only); depth 35 → foeCap 5/foeBonus+2/foePower≈1.35/abilityThreat≈1.63 (no bot samples past floor 20 — dials verified by unit test only); depth 50 → foeCap 5/foePower≈1.43/abilityThreat≈1.78 (approaching both `_MAX` values, same zero-sample caveat).
- Added `### Flag if noticed (observations, not tasks)` (Sterling's `halfDmg` canon-mode TTK ≈10.23 rounds, Djinni/Stalka Beast pre-ability discount, one-round-ahead bolt telegraph, unscaled summons, Oracle voice slips), an unfilled `### Verdict` block, and `### What happens next (D-16)` (pass closes TUNE-04 + the standing ask-before-Play-push rule; tune-again = one `/gsd-quick` constants-only pass + ledger addendum + a second DR round, no re-plan).
- Ran the full phase gate: `npm test` 951/951; `node --test "test/parity/**/*.test.js"` 30/30; `git diff --quiet 04eb229 -- test/parity/prototype-master.js.txt test/parity/fixtures test/determinism/foe-abilities.test.js test/unit/foe-turn-draw-count.test.js package.json package-lock.json` exit 0; `npm run build:www` stamped `1.0.1 (2)` into `www/index.html` with no `www/` entry leaked into `git status`; `tools/tune-difficulty.mjs --seeds=3 --json` and `tools/tune-economy.mjs --seeds=3 --json` both parsed as valid JSON; `tools/bestiary-yardstick.mjs` exited 0.
- Built the debug APK in the background (`npm run android:debug` with an `EXIT=` sentinel appended to a scratchpad log, polled in bounded ≤20 s checks; `BUILD SUCCESSFUL in 15s`, `EXIT=0`) — `android/app/build/outputs/apk/debug/app-debug.apk` (9,422,334 bytes). `adb` was not on this shell's PATH and this plan's own instructions prohibit the executor from deploying to the device itself (that is the orchestrator's job) — the APK path and the install command are recorded in the ledger's build/install how-to for the orchestrator/user to run.
- Appended the required single-line `**Gate at hand-off:**` record to the ledger's `### Verdict` block (`npm test 951/951, parity 30/30, frozen files identical to 04eb229, build stamped 1.0.1 (2), APK: android/app/build/outputs/apk/debug/app-debug.apk (build succeeded, no wireless adb device reachable from this shell — install per "Getting the build on the device" above) — 2026-09-14.`) without disturbing the still-empty `**Overall verdict:**` line above it.
- Confirmed no engine/content/src/mazeworld.html/tools/test diff since this plan's own BASE commit (`22a9432`, 21-04's final commit) across both of this plan's own commits — the retune under test stayed frozen for the entire plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the DR checklist section (how-to, three run tables, flag-if-noticed, verdict block, D-16 outcomes)** - `22a9432` (docs)
2. **Task 2: Phase gate — full suite, parity, frozen files, build stamp, tool/yardstick smoke, debug APK handoff, gate line** - `7b0753f` (docs)

## Files Created/Modified

- `docs/DIFFICULTY-RETUNE.md` - `## DR checklist — TUNE-04 sign-off` section (how-to, three run tables, flag-if-noticed, verdict block, D-16 outcomes, the one-line phase-gate record)

## Decisions Made

- Curve values in the three run tables were computed by running `difficultyCurve(20|35|50)` directly against the frozen engine via `node -e`, not hand-derived from the soft-cap formula, so the ledger's numbers are exact rather than approximated.
- The 21-30/31-50 depth bands have zero bot samples in every readout across 21-01 through 21-04's ledger (0/0 every time) — Run 2 and Run 3's "What to expect here" lines say so explicitly rather than fabricating a caster-encounter-rate expectation the harness never measured; only Run 1 (depth 20) cites a real sampled rate (66.7%, n=12, `--party` only, the 11-20 band).
- `adb` was unreachable from this shell and this plan's own project notes explicitly forbid the executor from running `adb install` itself (device deployment is the orchestrator's job) — recorded the APK's build success and path instead of attempting and failing on a missing binary.
- The `**Gate at hand-off:**` line was appended directly after the existing "Per-run notes above complete" line with no intervening blank line, so the plan's own acceptance criterion ("git diff --stat shows exactly one inserted line") holds exactly.

## Deviations from Plan

None - plan executed exactly as written. The debug-build handoff followed the plan's own "best effort, never a plan failure" clause for the no-device case; this is an anticipated branch of Task 2's action list, not a deviation.

## Issues Encountered

- `adb` was not found on this Bash shell's PATH (`command not found`), so `adb devices`/`adb install -r` could not run from here even if the plan's Task-2 action list otherwise permitted it. This plan's own project notes independently instruct the executor never to run `adb install` itself (device deploy is the orchestrator's step) — the two facts point the same way, and the resolution (record path + how-to, do not install) is identical either way.

## User Setup Required

None from this plan directly, but the phase now needs the user (or the orchestrator, on the user's behalf) to:
1. Install the debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`) via `adb install -r` per the ledger's "Getting the build on the device" steps (uninstall any Play-signed build first).
2. Play the three dev-start runs (depth 20, 35, 50) per the DR checklist's "Starting a run at depth N" steps.
3. Fill each run's table in `docs/DIFFICULTY-RETUNE.md` and record ONE overall verdict — pass or tune-again — in the `### Verdict` block.
4. Report the verdict back so the phase can close (pass) or trigger one `/gsd-quick` constants-only follow-up (tune-again).
5. Per the standing rule (STATE.md, 2026-09-13), the assistant will ASK — after a pass verdict — whether to push a versionCode-bumped signed AAB to the Play internal-testing track; it will not push unasked.

## Next Phase Readiness

- **Phase 21's automatable work is complete.** ROADMAP Phase 21 success criteria 1-3 are met (criterion 1 by 21-02's `difficultyCurve` combat-scaling knobs, criterion 2 by 21-01's shared bot module and ability tallies, criterion 3 by 21-04's retuned constants and honest Comparison-vs-D-09 table). **Criterion 4 — a human sign-off via an on-device DR round at depth 20-50+ — is OUTSTANDING BY DESIGN.** The phase's VERIFICATION must end `human_needed` on exactly the DR checklist's verdict block, which this plan deliberately left reading "(to be filled by the tester)".
- The tree is proven green and frozen: `npm test` 951/951, parity 30/30, all frozen files identical to `04eb229`, zero engine/content/src/mazeworld.html/tools/test diff since this plan's own BASE (21-04's final commit `22a9432`).
- The debug APK is built (`android/app/build/outputs/apk/debug/app-debug.apk`, `EXIT=0`) and ready for the user/orchestrator to install; the DR checklist's how-to covers install/relaunch/dev-start end-to-end.
- No blockers on the automated side. The sole remaining item is human play + the verdict.

---
*Phase: 21-consolidated-difficulty-retune*
*Completed: 2026-09-14*

## Self-Check: PASSED

`docs/DIFFICULTY-RETUNE.md` found on disk with the `## DR checklist — TUNE-04 sign-off` section and the `**Gate at hand-off:**` line present; `android/app/build/outputs/apk/debug/app-debug.apk` found on disk (9,422,334 bytes); both task commit hashes (`22a9432`, `7b0753f`) found in `git log --oneline --all`.
