---
phase: 83-leaderboard-server
plan: 11
subsystem: infra
tags: [firestore, firebase-auth, github-actions, live-deploy, bug-reports, retention]

# Dependency graph
requires:
  - phase: 83-08
    provides: "the live delve-die-repeat-6ba5f project with transition Firestore rules + 19 indexes deployed, anonymous sign-in proven, the per-IP sign-up quota set"
  - phase: 83-09
    provides: "sendBugReport's shared-identity + reportLimits flow and send-test-report.mjs's buildProbes/runProbes/runProbeRules, ready to run live"
  - phase: 83-10
    provides: "file-issues.mjs's SRV-11 retention cleanup (immediate delete + four sweeps) and docs/BUG-REPORTS.md's Live proof placeholder"
provides:
  - "master pushed to origin (8d187f56, then 095f050a for this plan's own commit) so the Action runs the pushed cleanup code"
  - "docs/BUG-REPORTS.md '## Live proof': the transition-period --probe-rules table (8/10 PASS, the two expected transition FAILs explained), the live cleanup proof (report id, run id 36556480792, issue #7, the 404), the legacy pass (0 failed docs needing a patch, 5 pre-Phase-83 filed docs recorded), the scheduled run (36529349414), and the Per-IP sign-up limit copied from docs/LEADERBOARDS.md section 14"
  - "send-test-report.mjs#adminAccessToken() retries gcloud auth print-access-token through Git Bash on Windows (mirrors tools/boards-admin.mjs#execGcloud) so --probe-rules can obtain an admin token on this machine"
affects: ["Phase 86 (release-day cutover: deploy firebase.json, rerun --probe-rules for a full ten-PASS, delete the three transition files)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A CLI tool's own gcloud-token helper needs the same Windows bash-archive retry (execSync fails, retry once with shell:'bash') that tools/boards-admin.mjs#execGcloud already established -- any new tool wrapping gcloud on this machine should reuse or mirror that pattern, not call execSync(cmd) bare"

key-files:
  created: []
  modified:
    - docs/BUG-REPORTS.md
    - tools/bug-reports/send-test-report.mjs

key-decisions:
  - "Task 2's work (the scheduled-run record and the Per-IP sign-up limit copy) landed in the same commit as Task 1 because a schedule-triggered run already existed (fired on the pinned 7,19,33,52 cron before this plan's own push) -- no waiting, no fix, and both were small docs-only additions to the same 'Live proof' section Task 1 was already editing; there was nothing left to commit separately for Task 2"
  - "Recorded the two expected --probe-rules FAILs (no-auth, no-limit-write) as transition-period facts rather than treating them as a rules gap, per the plan's own Transition amendment -- the release-day full ten-PASS proof is deferred to Phase 86, not attempted here"

patterns-established: []

requirements-completed: [SRV-11, SRV-12]

coverage:
  - id: D1
    description: "master pushed to origin so the Action runs the pushed retention/cleanup code; git log origin/master -1 matches git log master -1 after the push"
    requirement: SRV-11
    verification:
      - kind: other
        ref: "git push origin master: 9c4ede22..8d187f56 master -> master; git log origin/master -1 --format=%H == git log master -1 --format=%H"
        status: pass
    human_judgment: false
  - id: D2
    description: "node tools/bug-reports/send-test-report.mjs --probe-rules run live against the transition rules: 8/10 probes PASS(403); no-auth and no-limit-write FAIL(200) exactly as the Transition amendment predicts (the legacy unauthenticated bugReports create still works for 2.1.0/vc11); both unexpected 200s were cleaned up by the tool itself"
    requirement: SRV-09
    verification:
      - kind: e2e
        ref: "node tools/bug-reports/send-test-report.mjs --probe-rules (live, after the adminAccessToken Windows fix): 8 PASS, 2 expected FAIL(200), both probe docs created-then-deleted, exit 1"
        status: pass
    human_judgment: false
    note: "SRV-09's checkbox stays unchecked per the plan's Transition amendment -- the full ten-PASS proof is a Phase 86 release-day step after firebase.json's final rules deploy."
  - id: D3
    description: "Live cleanup proof: a [TEST] report sent through the new path is filed by a dispatched Action run as a player-report issue, and its Firestore document is deleted in the same run right after filing; the run log's summary line names the deletion"
    requirement: SRV-11
    verification:
      - kind: e2e
        ref: "send-test-report.mjs -> id 4zGI3tzp9sJOhwQB0shx; gh workflow run (not dry-run) -> run 36556480792 success; log: 'filed 1 [4zGI3tzp9sJOhwQB0shx] | ... | deleted 1 [4zGI3tzp9sJOhwQB0shx (filed-full)]'; issue #7 body starts with the id's marker; admin GET bugReports/4zGI3tzp9sJOhwQB0shx -> 404; issue #7 closed with a proof comment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy pass: pre-Phase-83 failed reports without failedAt are given one so the retention rule can retire them; the number of pre-Phase-83 filed reports (retired 30 days after filedAt) is recorded"
    requirement: SRV-11
    verification:
      - kind: other
        ref: "admin runQuery bugReports status==failed (limit 100): 0 documents -- nothing to patch. admin runQuery bugReports status==filed: 5 documents, all missing oracleTrimmed but already carrying filedAt -- cleanupRun's Q2 sweep (status==filed AND filedAt<cutoff) retires them with no patch needed, recorded in docs/BUG-REPORTS.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "A schedule-triggered run of .github/workflows/bug-reports.yml appears in gh run list --event schedule"
    requirement: SRV-12
    verification:
      - kind: other
        ref: "gh run list --repo sheibeck/ddr --workflow bug-reports.yml --event schedule --limit 5 --json databaseId,createdAt,conclusion: [{\"databaseId\":36529349414,\"createdAt\":\"2026-09-29T06:05:58Z\",\"conclusion\":\"success\"}]"
        status: pass
    human_judgment: false
    note: "A scheduled run already existed (fired on the 7,19,33,52 cron pinned by 83-10, before this plan's own push) -- SRV-12 is proven directly with no fix or wait needed."
  - id: D6
    description: "docs/BUG-REPORTS.md '## Live proof' records the probe table, the cleanup proof (report id, run id, issue number, the 404), the scheduled run, the legacy counts, and the per-IP sign-up value copied from docs/LEADERBOARDS.md section 14"
    requirement: SRV-11
    verification:
      - kind: other
        ref: "docs/BUG-REPORTS.md '## Live proof' section and 'Per-IP sign-up limit' subsection both filled, no placeholder text remaining (grep for 'Filled in by 83-11' -> not found)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-29
status: complete
---

# Phase 83 Plan 11: Live Bug-Report Probes, Cleanup Proof and Schedule Check Summary

**Master pushed to origin; the live transition rules were probed (8/10 PASS, 2 expected FAILs under the transition amendment), a real test report was filed by a dispatched Action run and its Firestore document deleted in the same run (confirmed 404), pre-Phase-83 legacy documents were audited (0 failed docs needed a patch, 5 filed docs recorded), and an already-firing scheduled run proved SRV-12 with no wait or fix needed.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (Task 2's docs work landed in Task 1's commit — see Decisions Made)
- **Files modified:** 2

## Accomplishments

- `git push origin master` landed the phase's code at `8d187f56` (71 commits, fast-forward, no conflicts) so `.github/workflows/bug-reports.yml` runs the pushed cleanup/retention code from here on.
- `node tools/bug-reports/send-test-report.mjs --probe-rules` run live against the deployed **transition** rules: `list-read`, `extra-field`, `wrong-status`, `cooldown`, `forged-count`, `sixth-today`, `other-limit-doc` and `list-limits` all PASS(403); `no-auth` and `no-limit-write` FAIL(200) exactly as the plan's Transition amendment predicts — the transition `bugReports` create clause still accepts the legacy unauthenticated form so the shipped 2.1.0/vc11 build keeps filing reports. Both unexpected 200s created a probe document, and the tool's own best-effort cleanup deleted both. Nothing was loosened or tightened to make a probe pass.
- **Deviation (Rule 1/3):** `adminAccessToken()` called `gcloud auth print-access-token` through a bare `execSync`, which fails on this Windows machine's bash-archive Cloud SDK install (ships only the `gcloud` shell script, no `.cmd`) — the tool exited 2 even with a working `gcloud` login. Fixed to retry once through Git Bash on a Windows failure, mirroring `tools/boards-admin.mjs#execGcloud`'s already-established pattern; verified by a successful `--probe-rules` run immediately after.
- Live cleanup proof, end to end: sent `[TEST]` report `4zGI3tzp9sJOhwQB0shx`, dispatched the Action (not dry-run) as run `36556480792`, watched it to `success`. The run's summary log line reads `filed 1 [4zGI3tzp9sJOhwQB0shx] | reconciled 0 [] | skipped 0 [] | failed 0 [] | deleted 1 [4zGI3tzp9sJOhwQB0shx (filed-full)]` — the report was filed as issue [#7](https://github.com/sheibeck/ddr/issues/7) and its Firestore document deleted in the same run. An admin GET on `bugReports/4zGI3tzp9sJOhwQB0shx` confirmed **404**. Issue #7 was closed with a comment recording the proof.
- Legacy pass: an admin `runQuery` for `bugReports` where `status == "failed"` found **0 documents** — nothing needed a `failedAt` patch. A `runQuery` for `status == "filed"` found **5 pre-Phase-83 documents**, all missing the Phase-83 `oracleTrimmed` field but already carrying `filedAt` — `cleanupRun`'s existing Q2 sweep (`status == "filed" AND filedAt < cutoff`) doesn't require `oracleTrimmed` to be present, so these five retire on their own 30 days after their existing `filedAt` with no patch needed. Both counts recorded in the runbook.
- Schedule check: `gh run list --event schedule` already showed a successful run (`36529349414`, `2026-09-29T06:05:58Z`) fired on the `7,19,33,52 * * * *` cron pinned by 83-10 — SRV-12 is proven directly, no wait or re-enable needed.
- `docs/BUG-REPORTS.md` "## Live proof" is fully written (probe table, cleanup proof, legacy pass, scheduled run) and its "Per-IP sign-up limit" subsection now holds the live value copied from `docs/LEADERBOARDS.md` section 14 (10/hour, expires 2027-09-29), replacing both placeholders.
- `npm test` (full suite, once at plan close): 8309 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.

## Task Commits

Both tasks landed in one commit — see Decisions Made for why Task 2 had nothing left to commit separately.

1. **Task 1 + Task 2: live probes, cleanup proof, legacy pass, scheduled run, and the Per-IP limit copy** - `095f050a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `docs/BUG-REPORTS.md` - "## Live proof" fully written (probe table, cleanup proof, legacy pass, scheduled run); "Per-IP sign-up limit" subsection filled from `docs/LEADERBOARDS.md` section 14
- `tools/bug-reports/send-test-report.mjs` - `adminAccessToken()` retries `gcloud auth print-access-token` through Git Bash on a Windows failure (deviation, Rule 1/3)

## Decisions Made

- Task 2's work (recording the scheduled run and copying the Per-IP sign-up limit) landed in the same commit as Task 1, not a separate one — a schedule-triggered run already existed before this plan's own push (the `7,19,33,52` cron, pinned by 83-10, was already firing), so there was no wait and no fix to make, and the Per-IP limit copy was a small docs-only addition to the exact same "Live proof" section Task 1 was already editing. There was nothing left in the working tree to commit under a distinct Task 2 commit.
- The two expected `--probe-rules` FAILs (`no-auth`, `no-limit-write`) were recorded as transition-period facts, not treated as a rules gap — per the plan's own Transition amendment, the release-day full ten-PASS proof is Phase 86's job, after `firebase.json`'s final rules deploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug / Blocking] `send-test-report.mjs#adminAccessToken()` failed on this Windows machine's gcloud install**
- **Found during:** Task 1, first `--probe-rules` attempt
- **Issue:** `adminAccessToken()` ran `gcloud auth print-access-token` through a bare `execSync`. This machine's Cloud SDK is the bash-archive install, which ships only the `gcloud` shell script (no `gcloud.cmd`) — `cmd.exe` (what bare `execSync` shells out to on Windows) can't run it, so the call always failed and the tool printed "no gcloud admin token available" and exited 2, even with a valid `gcloud auth login`. This directly blocked the plan's own required probe run.
- **Fix:** Added a Windows-only retry through Git Bash (`shell: "bash"`) on the first attempt's failure, mirroring `tools/boards-admin.mjs#execGcloud`'s already-established pattern for exactly this problem.
- **Files modified:** `tools/bug-reports/send-test-report.mjs`
- **Verification:** `node tools/bug-reports/send-test-report.mjs --probe-rules` obtained a token and ran all ten probes live immediately after the fix; `node --test test/unit/bug-report-tool.test.js` — 10 pass, 0 fail, 2 skipped (pre-existing).
- **Committed in:** `095f050a`

---

**Total deviations:** 1 auto-fixed (Rule 1/3 — a genuine blocking bug on this machine, fixed by reusing an existing in-repo pattern). No architectural changes, no rule weakened.

## Issues Encountered

None beyond the `adminAccessToken()` fix above.

## User Setup Required

None — no external service configuration required. `git push`, `gh workflow run`, and every admin REST call ran under credentials already set up by prior plans (83-08's live Firebase setup, the logged-in `gh`/`gcloud` CLIs).

## Next Phase Readiness

- SRV-11 and SRV-12 are proven live and complete. SRV-09 stays unchecked — its live proof (the full ten-PASS `--probe-rules` run) is a Phase 86 release-day step, after `firebase.json`'s final rules deploy and the three transition files (`firebase/firestore.transition.rules`, `firebase.transition.json`, `test/unit/firestore-transition-rules.test.js`) are deleted (`docs/LEADERBOARDS.md` section 14's "Release-day step").
- `docs/BUG-REPORTS.md`'s runbook is now a complete live record for this milestone's bug-report quota protection work; Phase 86 only needs to append the release-day cutover's own ten-PASS run once it happens.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/bug-report-tool.test.js` — 10 pass, 0 fail, 2 skipped (pre-existing).
**Full suite (`npm test`, once at plan close):** 8309 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

## Human verification (deferred to end of run)

None — this plan's own live proofs (the probe run, the cleanup proof, the legacy pass, the scheduled-run check) are all fully automated and already verified above; nothing here touches the shipped app's device-testable surface.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-29*

## Self-Check: PASSED

All modified files found on disk (`docs/BUG-REPORTS.md`, `tools/bug-reports/send-test-report.mjs`, this SUMMARY.md); commit `095f050a` found in git log.
