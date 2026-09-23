---
phase: 60-performance-footprint-close
plan: 03
subsystem: testing
tags: [adb, perf, device-session, uat, pixel-7]

# Dependency graph
requires:
  - phase: 60-performance-footprint-close (plan 01)
    provides: tools/cold-start.mjs — the run/judge/adb-path CLI this plan drove live against the Pixel 7
  - phase: 60-performance-footprint-close (plan 02)
    provides: the two debug APKs (v1.7/v1.8), sizes.json (AAB bytes/sha256), docs/PERF-BASELINE.md's scaffolded v1.8 section, docs/UAT-v1.8.md's merged 31-item checklist
provides:
  - PERF-03's full v1.7-vs-v1.8 Pixel 7 measurement — cold start (both builds), step time (both builds), and the tested judge verdict, all recorded in docs/PERF-BASELINE.md
  - docs/UAT-v1.8.md closed out — every row has a Result, the milestone's deferred device checks are resolved (56-3 run and passed; B–E deferred to the user's own play sessions per their own ruling)
  - Two findings filed as todos for a post-milestone quick task (water-square walk sound, HUD band-1 identity line)
affects: [milestone close for v1.8; the two filed todos are candidates for the next milestone's backlog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live device session pattern: adb devices -l / dumpsys battery / settings get global read-only checks before every measurement block, never writing device settings; a fresh install (uninstall + install, no relaunch) used exactly once, only where the plan named it (56-3), gated on the user's explicit prior OK."

key-files:
  created:
    - .planning/todos/pending/2026-09-22-water-square-walk-sound-should-play-every-step-not-just-on-en.md
    - .planning/todos/pending/2026-09-22-hud-band-1-identity-line-should-show-sub-class-not-full-class.md
  modified:
    - docs/PERF-BASELINE.md
    - docs/UAT-v1.8.md

key-decisions:
  - "Coverage/jank for the v1.7 walk arrived in two messages (first without coverage/jank, then a late addendum with the actual values); the 'not reported' placeholder was replaced with the user's verbatim values via a plain Edit before any commit landed, so no amend was needed — the committed record only ever shows the user's real answer."
  - "The A3 (v1.8) walk was run on the FIRST v1.8 install, before 56-3. Since 56-3 needs a genuine first-ever launch, a SECOND fresh install (uninstall + install, not launched) was done specifically for 56-3, so its airplane-mode check still got an unspent first launch. Recorded explicitly in the Device table and Session record so the install order is auditable."
  - "The user declined a full B–E walkthrough ('I'm not going to do in depth uat right now. I'll uat over playing several sessions and report back'), except 56-3 which they did run. Every other B–E row is recorded 'not run — deferred to the user's own play sessions' rather than left blank or inferred as pass — the user's own words are the record, quoted once at the top of section B."
  - "Both PERF-03 findings the user volunteered (water sound, HUD identity line) are UI/audio polish, not PERF-03 regressions — filed as todos, not dispositions, and not code-edited this plan (deferred-UAT protocol)."

patterns-established:
  - "Pattern: when a checkpoint's late-arriving correction (coordinator relay) targets content not yet committed, fix in place with a plain Edit — no amend needed. When it targets content already committed, the plan's own instruction (not exercised here) is a NEW commit, never --amend."

requirements-completed: [PERF-03]

coverage:
  - id: D1
    description: "Cold start measured on the Pixel 7 for both builds in one sitting, back to back, same app data: v1.7 (6c299ab) median 871ms/p95 951ms/n=10/all COLD; v1.8 (d6db678) median 915ms/p95 981ms/n=10/all COLD; both series succeeded on the first try, no retries needed."
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node -e check: both cold-v1.7.json/cold-v1.8.json summary.n===10, every launchStates==='COLD', invalid===[] — exit 0"
        status: pass
      - kind: other
        ref: "node cross-check: docs/PERF-BASELINE.md's ### Cold start table rows (v1.7/v1.8 median+p95) equal the JSON summaries exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "Step time measured on the Pixel 7 for both builds in the same session, walked once per build by the user: v1.7 step med 11.6/p95 22.0/max 33.2 (n=55); v1.8 step med 6.9/p95 16.6/max 22.3 (n=100). Coverage and jank recorded verbatim (v1.7: water/dark/encounter/tab all yes, jank none — corrected via a late addendum before commit; v1.8: water/dark/tab yes, encounter not stated, jank none)."
    requirement: "PERF-03"
    verification:
      - kind: manual_procedural
        ref: "User-reported #mw-dev-perf line, pasted verbatim into docs/PERF-BASELINE.md's Step time verbatim readout blocks for both builds; optional logcat [mzperf] cross-check recorded as a corroborating note for both walks, pasted line kept as the record in both cases"
        status: pass
    human_judgment: true
    rationale: "Step-time numbers and coverage/jank are the user's own on-device report — cannot be verified by automation, only cross-checked against logcat (done, both times, noted in the doc)."
  - id: D3
    description: "Every verdict comes from `node tools/cold-start.mjs judge` with all three measures supplied (complete:true): cold start median +44ms/+5.1% (no regression), step p95 IMPROVED 22.0->16.6ms (no regression), AAB +420,608B/+4.5% (no regression). anyRegression:false. Table and [perf03] JSON pasted into docs/PERF-BASELINE.md ### Verdicts (PERF-03)."
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node tools/cold-start.mjs judge --cold-base cold-v1.7.json --cold-head cold-v1.8.json --step-base 22.0 --step-head 16.6 --aab-base 9306177 --aab-head 9726785 — printed complete:true, anyRegression:false"
        status: pass
    human_judgment: false
  - id: D4
    description: "No regressions occurred, so Dispositions records the single required bullet ('None — no measurement regressed past a PERF-03 threshold') rather than a fix/accept ruling — never written on the user's behalf, matching the tested judge output exactly."
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "grep -n '^- None — no measurement regressed' docs/PERF-BASELINE.md — one match, no other '- **Cold start/Step p95/AAB**' bullets present"
        status: pass
    human_judgment: false
  - id: D5
    description: "UAT-v1.8.md closed: A1-A5 all resolved (pass/no-regression), 56-3 run and PASSED (a second fresh install was needed since the first was spent on the A3 walk), every other B-E row (30 of 31) recorded 'not run — deferred to the user's own play sessions' per the user's own verbatim general verdict. Session record completed with full install log, final build (v1.8 debug APK, commit + sha256), rulings pointer, findings-to-todos list."
    requirement: "PERF-03"
    verification:
      - kind: other
        ref: "node verify script: every UAT row anchored ^| (5[6-9]-\\d+|A[1-5]) | has a non-empty last cell, and every B-E cell starts with pass/fail/not run — 36 rows checked, all pass"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two user-volunteered findings filed as todos in house format (no code edited this plan): water-square walk sound should play every step not just on entering (src/browser/sfx.js); HUD band-1 identity line should show only the sub-class (src/browser/hudBands.js), with the race-keep-or-drop question left open for the user."
    requirement: null
    verification:
      - kind: other
        ref: "git diff --name-only --diff-filter=A e2b0928 HEAD -- .planning/todos/pending/ — 2 new files, both in the required frontmatter/Problem/Solution shape"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min (across three human checkpoints for the on-device walks)
completed: 2026-09-22
status: complete
---

# Phase 60 Plan 03: The Pixel 7 device session — PERF-03 verdicts + UAT-v1.8 close Summary

**Cold start and step time measured side by side on the Pixel 7 for v1.7 vs v1.8, judged by the tested `cold-start.mjs judge` (no regressions — cold start +5.1%, step p95 IMPROVED 22.0→16.6ms, AAB +4.5%, all under threshold), and the merged UAT-v1.8 checklist closed with 56-3 passed and the remaining 30 items deferred to the user's own play sessions by their own ruling.**

## Performance

- **Duration:** ~50 min (includes three human checkpoints — Task 1 phone setup, Task 3 v1.7 walk, Task 5 v1.8 walk + checklist — where the executor waited on the user)
- **Started:** 2026-09-22T22:17:55-04:00 (approx, first adb-path resolution)
- **Completed:** 2026-09-22T23:08:01-04:00
- **Tasks:** 6 (3 auto, 3 checkpoint:human-action)
- **Files modified:** 4 (2 docs, 2 new todos)

## Accomplishments

- Freshness gate confirmed both debug APKs are current against HEAD (no rebuild needed); sha256 verified against `sizes.json` for both.
- Cold start measured for both builds back to back, same app data, no retries needed: **v1.7 median 871ms/p95 951ms** (n=10, all COLD) vs **v1.8 median 915ms/p95 981ms** (n=10, all COLD).
- Step time walked once per build by the user, same protocol (depth 5, ≥50 mixed steps): **v1.7 step med 11.6/p95 22.0/max 33.2ms (n=55)** vs **v1.8 step med 6.9/p95 16.6/max 22.3ms (n=100)** — v1.8 is meaningfully faster on step time, not slower.
- Final tested verdict (`node tools/cold-start.mjs judge`, `complete:true`): **no regressions** — cold start +44ms/+5.1% (threshold >10% or >100ms), step p95 **improved** 22.0→16.6ms (threshold >2ms regression), AAB +420,608B/+4.5% (threshold >2,000,000B). `anyRegression:false`.
- Dispositions: the single required "None — no measurement regressed" bullet, since nothing crossed a threshold.
- UAT-v1.8.md closed: A1–A5 all resolved, 56-3 (fresh-install airplane-mode check) run and **PASSED** — required a second fresh v1.8 install since the first had already been spent on the A3 walk before 56-3 could run. The remaining 30 of 31 B–E items are recorded "not run — deferred to the user's own play sessions" per the user's own verbatim general verdict, not inferred or assumed.
- Two findings filed as todos, no code touched: water-square walk sound (should play every step, not just on entering) and the HUD band-1 identity line (should show only the sub-class — open question on keeping the race left for the user).
- Phone ends on the v1.8 debug APK — the milestone's one debug APK — with its commit and sha256 recorded in `docs/UAT-v1.8.md`'s Session record.

## Per-ROADMAP criterion (PERF-03)

1. **Cold start baseline, side by side, same session** — **MET.** v1.7 871/951ms vs v1.8 915/981ms (median/p95), n=10 each, all COLD, no retries.
2. **Step time baseline, side by side, same session** — **MET.** v1.7 11.6/22.0ms vs v1.8 6.9/16.6ms (median/p95), n=55 and n=100.
3. **AAB size delta judged against threshold** — **MET.** +420,608B/+4.5%, judged `no` regression against the >2,000,000B threshold (numbers from plan 60-02).
4. **Every regression carries a recorded disposition, none silent** — **MET (vacuously — no regression occurred).** The tested `judge` reported `anyRegression:false`; Dispositions records this in words rather than leaving the section blank.

## Task Commits

Each task was committed atomically; the two checkpoint tasks (3, 5) produced no commit of their own — their results are recorded in the following auto task's commit:

1. **Task 1: Connect the Pixel 7 and set it up for measurement** (checkpoint) — no commit; battery/stay-awake/screen re-verified read-only, no device settings written.
2. **Task 2: Freshness gate, device facts, and the cold-start series for both builds** — `ae29521` (docs)
3. **Task 3: Walk the Phase 49 step protocol on v1.7** (checkpoint) — no commit; user's reply recorded in Task 4.
4. **Task 4: Record the v1.7 walk and switch the phone to v1.8** — `253ce14` (docs)
5. **Task 5: Walk v1.8, run the UAT-v1.8 checklist, and rule on every regression** (checkpoint) — no commit; user's reply recorded in Task 6.
6. **Task 6: Record the v1.8 walk, apply the tested verdicts, write the dispositions and UAT results, file todos, close** — `f72bc8b` (docs)

**Plan metadata:** committed after this SUMMARY (docs: complete plan), alongside STATE.md/ROADMAP.md/REQUIREMENTS.md tracking updates.

## Files Created/Modified

- `docs/PERF-BASELINE.md` — filled the v1.8 section's Device, Cold start, Step time, Verdicts (PERF-03) and Dispositions tables/blocks from the live session; added two optional logcat cross-check notes (v1.7 and v1.8) and a note that "Version 1.5.0 (6)" on both builds is expected (no version bump this phase).
- `docs/UAT-v1.8.md` — filled A1–A5, 56-3, and every other B–E row (30 "not run — deferred"), plus the user's verbatim general verdict and a fully completed Session record (install log, final build, rulings pointer, findings→todos).
- `.planning/todos/pending/2026-09-22-water-square-walk-sound-should-play-every-step-not-just-on-en.md` — new todo (audio).
- `.planning/todos/pending/2026-09-22-hud-band-1-identity-line-should-show-sub-class-not-full-class.md` — new todo (ui), open question left for the user.

## Decisions Made

- Replaced the v1.7 walk's initial "not reported" coverage/jank placeholder with the user's late-addendum verbatim values via a plain `Edit`, since the file had not yet been committed — no `git commit --amend` was needed or used.
- Recorded the A3 walk as having happened on the FIRST v1.8 install (before 56-3), and did a SECOND fresh install specifically for 56-3 so its airplane-mode check still got a genuine, unspent first launch — documented explicitly in the Device table's install order and the Session record, not glossed over.
- Recorded every B–E row except 56-3 as "not run — deferred to the user's own play sessions" (the user's own words), rather than inferring pass from "everything looks good" — the deferral is explicit and attributable.

## Deviations from Plan

None — plan executed exactly as written. Two mid-session coordinator relays (a late coverage/jank addendum for the v1.7 walk, and the full Task 5 response) were both applied to their correct, not-yet-committed locations before any commit landed, so no corrective/amend commit was required for either.

## Issues Encountered

- A first pass at the Step-time verify script accidentally matched the AAB-size table's `| v1.7 |` / `| v1.8 |` rows (a duplicate anchor earlier in the same file) instead of the Cold-start table's rows — caught by re-scoping the check to the `### Cold start (TotalTime, ms)` … `### Step time (ms)` slice specifically; both rows verified correctly once rescoped. No impact on the recorded numbers.
- A one-line node script that back-filled the 30 "not run" B–E cells dropped the leading space after the table pipe (`|not run…` instead of `| not run…`) — caught immediately by inspecting the diff, fixed with a second pass, verified with the plan's own acceptance regex before committing.

## User Setup Required

None — no external service configuration required. The Play internal-testing push question is deferred per the standing rule (see Next Phase Readiness).

## Gaps for gap closure

None. No measurement regressed, so no "fix" disposition exists — there is nothing for `/gsd-plan-phase 60 --gaps` to plan.

## Next Phase Readiness

- PERF-03 is fully measured and judged; the milestone's device-dependent requirement is closed.
- The phone is left on the v1.8 debug APK (`ddr-v1.8-d6db678-debug.apk`, commit `d6db678c10e444aae76f6fd4cbb897eb8010e0b9`, sha256 `038c042d922ac0d70b3fd71d9ab117361f7a9b4c16cb4f1611443aa33ed65555`) — the milestone's one debug APK, per the deferred-UAT protocol.
- Two new todos are queued in `.planning/todos/pending/` for a post-milestone quick task pass (water sound, HUD identity line) — neither blocks phase or milestone close.
- **For the orchestrator:** per the standing rule (user, 2026-09-13), ask the user separately whether to push a Play internal-testing build (versionCode-bumped signed AAB). That push is explicitly NOT part of this phase or plan — no version bump happened here.
- `npm test` 3904/3904 and `npm run build:www` exit 0, both confirmed on this same main checkout (not deferred to a later merge — this plan ran directly on `master`). Engine gate holds: `git diff --quiet v1.7 HEAD -- engine/ content/ test/parity/` exits 0, `test/parity/prototype-master.js.txt` hash unchanged (`a1f4d0dc...`).

---
*Phase: 60-performance-footprint-close*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: docs/PERF-BASELINE.md
- FOUND: docs/UAT-v1.8.md
- FOUND: .planning/todos/pending/2026-09-22-water-square-walk-sound-should-play-every-step-not-just-on-en.md
- FOUND: .planning/todos/pending/2026-09-22-hud-band-1-identity-line-should-show-sub-class-not-full-class.md
- FOUND: .planning/phases/60-performance-footprint-close/60-03-SUMMARY.md
- FOUND commit ae29521 (Task 2)
- FOUND commit 253ce14 (Task 4)
- FOUND commit f72bc8b (Task 6)
