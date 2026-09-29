---
phase: 83-leaderboard-server
plan: 10
subsystem: api
tags: [firestore, bug-reports, retention, cleanup, cron, docs]

# Dependency graph
requires:
  - "83-02: firebase/firestore.indexes.json's three bugReports cleanup indexes (status+filedAt, status+oracleTrimmed+filedAt, status+failedAt); reportLimits/{uid}'s last field (single-field index, automatic)"
  - "83-09: sendBugReport's identity/limit/commit flow; the reportLimits/{uid} document shape actually written by the client"
provides:
  - "tools/bug-reports/issue-format.mjs: issueBodyInfo(report, meta) -> {body, trimmed, dropped}; the trim note's optional \"until <date>\" clause from meta.keepUntil"
  - "tools/bug-reports/file-issues.mjs: REPORT_RETENTION_DAYS/LIMIT_RETENTION_DAYS/REPORT_RETENTION_MS/LIMIT_RETENTION_MS/MAX_DELETES_PER_RUN, the immediate post-filing delete, the four Q1-Q4 cleanup sweeps (cleanupRun), failedAt/oracleTrimmed writes, the deleted-N CLI summary line"
  - "docs/BUG-REPORTS.md: the updated runbook (identity, limits, per-IP sign-up, retention, live-proof placeholder)"
  - "store-listing/LISTING.md: the retention sentence and the anonymous-identifier Data safety flag"
affects: [83-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared per-run delete budget (ctx.deleteBudget, seeded from MAX_DELETES_PER_RUN) is decremented by both the immediate post-filing delete and the four cleanup sweeps, so the 100-delete cap is a single run-wide ceiling rather than four independent per-query caps"
    - "The filer's routing test fake grew from two fixed newDocs/filingDocs arrays into a small in-memory Firestore (one store, a generic structuredQuery evaluator for EQUAL/LESS_THAN fieldFilters, an AND compositeFilter, one orderBy, a limit) so the same evaluator answers both the pre-existing status=='new'/'filing' polling and the four SRV-11 cleanup query shapes"
    - "issueBody(report, meta) is now a thin wrapper over issueBodyInfo(report, meta).body -- the filer reads .trimmed directly instead of re-parsing the rendered issue body to decide oracleTrimmed"

key-files:
  created: []
  modified:
    - tools/bug-reports/issue-format.mjs
    - test/unit/bug-report-issue.test.js
    - tools/bug-reports/file-issues.mjs
    - test/unit/bug-report-filer.test.js
    - .github/workflows/bug-reports.yml
    - docs/BUG-REPORTS.md
    - store-listing/LISTING.md

key-decisions:
  - "The immediate post-filing delete and every cleanup-sweep delete for a bugReports document re-check that document's own status field (\"filed\" or \"failed\" as appropriate) before issuing the DELETE, even though the query that found it already filtered on status -- defense-in-depth per the plan's T-83-44 threat mitigation, not strictly required by the query shape alone"
  - "reportLimits deletions are never logged or reported by uid, in any mode: dry-run lines read \"would delete reportLimits/<redacted> (limit-expired)\", a failed real DELETE's warning reads the same redacted form, and the CLI summary counts every reportLimits deletion as the bare word \"limit\" -- satisfies T-83-46 without needing a separate redaction pass over log output"
  - "Reconciling a stale filing doc (the existing 10-minute stuck-filing path) now also computes oracleTrimmed via issueBodyInfo and performs the same immediate delete as a fresh filing -- the plan's behavior list requires this, and it keeps the two \"a report becomes filed\" code paths (fresh file, reconcile) consistent rather than only fixing the common case"

patterns-established:
  - "Firestore cleanup queries in this codebase are named Q1..Q4 in comments and run in a fixed order every time, each with a query limit equal to the run's remaining delete budget -- the pattern later cleanup jobs in this project should follow if they need the same bounded-cost-per-run guarantee"

requirements-completed: []

coverage:
  - id: D1
    description: "issueBodyInfo(report, meta) returns {body, trimmed, dropped}; issueBody wraps it. With meta.keepUntil set, the trim note names the expiry date (\"...until <date>.\"); without it, the note is unchanged from Phase 79.3. A report that fits has trimmed false, dropped 0, no trim note."
    requirement: SRV-11
    verification:
      - kind: unit
        ref: "test/unit/bug-report-issue.test.js#issueBodyInfo: trimmed/dropped for a fitting report, an oversized one with and without keepUntil"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-issue.test.js#issueBody(report, meta) equals issueBodyInfo(report, meta).body"
        status: pass
    human_judgment: false
    note: "Pure formatter change, no network. Feeds Task 2's filer directly."
  - id: D2
    description: "file-issues.mjs deletes a filed report immediately when its Oracle fit whole (oracleTrimmed false written first), keeps a trimmed one for 30 days past filedAt, keeps a failed one for 30 days past failedAt, deletes a reportLimits document 2 days past last, never deletes new/filing regardless of age, caps a run at 100 deletes oldest-first across four index-backed queries with a shared budget, and a dry run deletes nothing while logging what it would do"
    requirement: SRV-11
    verification:
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#happy path: files, deletes filed-full immediately, in the documented call order (token, runQuery x2, lockPatch, label, issuePost, filedPatch, delete, 4x cleanup runQuery)"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#a trimmed report writes oracleTrimmed true, names the until-date in the issue, and is never deleted"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#reconcile also writes oracleTrimmed and deletes immediately when not trimmed; keeps the document when trimmed"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#MAX_ATTEMPTS failure writes failedAt"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#both 30-day boundaries (filed/failed) and the 2-day reportLimits boundary, at -1ms/+1ms"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#Q1 leftover filed-full sweep; new/filing never deleted however old; 150 eligible -> exactly 100 deleted oldest first, 50 wait"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#dry run: zero DELETE calls, 'would delete <id> (<reason>)' lines, reportLimits redacted in every log line"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#a failed DELETE logs a warning with the HTTP status and does not stop the run or change the exit code"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-filer.test.js#retention constants: 30/2 days and their millisecond derivations; MAX_DELETES_PER_RUN 100"
        status: pass
    human_judgment: false
    note: "Fully unit-proven offline against a small in-memory Firestore fake that evaluates the exact structuredQuery shapes the real Firestore REST API accepts. Live proof (the Action actually deleting from the real project, per this plan's own objective) is 83-11's job -- SRV-11's REQUIREMENTS.md checkbox is intentionally left unchecked here."
  - id: D3
    description: "docs/BUG-REPORTS.md documents the identity requirement, the per-player limit (cooldown/daily cap, named constants), reportLimits, the per-IP sign-up setting (pointing at LEADERBOARDS.md section 14), retention (all four cases, the four sweep queries, the cap, the dry-run/summary format), old builds being refused, the kill switch still working, delete-on-request now bounded by the retention window, and a Live proof placeholder for 83-11; store-listing/LISTING.md states the retention sentence and flags the anonymous-identifier Data safety question for Phase 86"
    requirement: SRV-09
    verification:
      - kind: unit
        ref: "node -e verify script: docs/BUG-REPORTS.md contains reportLimits, Retention, 30 days, 2 days, 100, reportCooldownMinutes, 'Per-IP sign-up limit', '## Live proof', vc11; store-listing/LISTING.md contains 30 days"
        status: pass
      - kind: unit
        ref: "grep -c \"deleted from our database\" store-listing/LISTING.md == 1; grep -c \"## Live proof\" docs/BUG-REPORTS.md == 1"
        status: pass
    human_judgment: false
    note: "Documentation-only coverage. SRV-09's code (sign-in, the limit, the commit, the sheet UX) was delivered in 83-02/83-09; SRV-10 (the live per-IP setting) is 83-08's job, recorded here only as a pointer. Neither SRV-09 nor SRV-10's checkbox changes in this plan."
---

# Phase 83 Plan 10: Bug-Report Firestore Retention Cleanup Summary

**The bug-report Action now cleans Firestore up on a fixed retention schedule (filed-full reports deleted immediately, trimmed/failed reports and stale reportLimits documents deleted after 30/30/2 days via four index-backed, budget-capped sweeps), the trimmed-Oracle issue note names its own expiry date, and the runbook/listing docs describe the identity, limit and retention rules end to end.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3
- **Files modified:** 7 (all edits, no new files)

## Accomplishments

- `tools/bug-reports/issue-format.mjs#issueBodyInfo(report, meta)` returns `{body, trimmed, dropped}`; `issueBody` is now a thin wrapper over it. When `meta.keepUntil` is a `"YYYY-MM-DD"` string, the Oracle trim note grows an `" until <date>"` clause naming when the full Oracle stops being kept in Firestore; without it the note is byte-identical to Phase 79.3.
- `tools/bug-reports/file-issues.mjs` gains the SRV-11 retention machinery: named constants (`REPORT_RETENTION_DAYS` 30, `LIMIT_RETENTION_DAYS` 2, their millisecond derivations, `MAX_DELETES_PER_RUN` 100); an immediate delete right after a report is marked filed with a whole (non-trimmed) Oracle; `patchFiled` now writes `oracleTrimmed`, `patchFailed` now writes `failedAt`; four cleanup sweeps (`cleanupRun`, run Q1→Q2→Q3→Q4 every time) delete leftover filed-full docs, expired trimmed-filed docs, expired failed docs, and expired `reportLimits` docs, each against a single per-run delete budget so the 100-delete cap is a true run-wide ceiling; every query's `limit` is the remaining budget, never a full scan; a status guard re-checks `"filed"`/`"failed"` before every `bugReports` `DELETE`, so `new`/`filing` documents are never touched regardless of age; `reportLimits` uids never appear in a log line or the CLI summary (redacted as `reportLimits/<redacted>` / counted as the bare word `limit`); a dry run performs zero `DELETE`s and logs `would delete <id> (<reason>)`; a failed `DELETE` logs a warning and does not stop the run; the CLI's one-line summary gains `deleted N [...]`.
- The stale-filing reconcile path (a report stuck `filing` past 10 minutes, found already filed by marker match) now also computes `oracleTrimmed` and performs the same immediate delete as a fresh filing, keeping both "a report becomes filed" paths consistent.
- `test/unit/bug-report-filer.test.js`'s routing fake grew from two fixed `newDocs`/`filingDocs` fixture arrays into a small in-memory Firestore: one `store` (`bugReports` + `reportLimits`) and a generic `structuredQuery` evaluator (`EQUAL`/`LESS_THAN` field filters, an `AND` composite filter, one `orderBy`, a `limit`) that answers every query shape the filer sends — both the pre-existing `status == "new"/"filing"` polling and all four SRV-11 cleanup shapes — plus PATCH-merges-into-store and DELETE-removes-from-store semantics with `currentDocument.updateTime` precondition checking. 36 tests cover the documented call order (including the four cleanup `runQuery`s and the delete after a happy-path file), both retention boundaries on all three fields, the never-new-or-filing guard, the 150-eligible/100-cap/50-remaining case, dry run, failed-DELETE resilience, and every pre-existing behavior (JWT, credential hygiene, per-run filing cap, label, reconcile, retry cap, workflow shape, CLI, import specifiers).
- `.github/workflows/bug-reports.yml`'s header comment now documents the retention cleanup the same run performs; the cron schedule itself (`7,19,33,52 * * * *`, set 2026-09-28) is unchanged.
- `docs/BUG-REPORTS.md` is substantially rewritten: sections 1–3 cover the shared identity, the rate-limited sheet UX, and the `reportLimits/{uid}` document shape; section 4 documents the signed-in `bugReports` create (`isValidLimitStep` via `get`/`getAfter`), the locked-down `reportLimits` collection, the day-bucket clock caveat, old builds (up to 2.1.0/vc11) being refused by design, and the ten `--probe-rules` probes; a new "Per-IP sign-up limit" subsection points at `docs/LEADERBOARDS.md` section 14 for the live value (83-08 fills it, 83-11 copies it here); section 5 notes the Action's cleanup; a new "Retention" section documents all four delete cases, the four sweep queries in order, the shared budget, and the dry-run/summary log format; the renumbered Operations section notes delete-on-request now only applies within the retention window; a "## Live proof" placeholder section is added for 83-11.
- `store-listing/LISTING.md`'s privacy-policy draft gains the retention sentence ("Reports are deleted from our database once filed, or within 30 days at most. The public GitHub issue remains."); the Data safety notes gain a paragraph flagging the new anonymous identifier (the `reportLimits/{uid}` key, deleted within 2 days, never inside the report) as a question to settle together with Leaderboards' own Data safety answers in Phase 86 (COMP-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: issue-format.mjs — issueBodyInfo and the "until <date>" trim note** - `98599f1f` (feat)
2. **Task 2: file-issues.mjs — oracleTrimmed/failedAt, the immediate delete, the four sweeps, the cap and the dry run** - `fec83ed2` (feat)
3. **Task 3: docs/BUG-REPORTS.md and store-listing/LISTING.md** - `831f77d3` (docs)

## Files Created/Modified

- `tools/bug-reports/issue-format.mjs` - `issueBodyInfo` (trimmed/dropped, the "until <date>" clause); `issueBody` now wraps it
- `test/unit/bug-report-issue.test.js` - the loosened trim-note regex, `issueBodyInfo` coverage (fits/oversized/with-keepUntil), the `issueBody === issueBodyInfo().body` equivalence
- `tools/bug-reports/file-issues.mjs` - retention constants, `oracleTrimmed`/`failedAt` writes, the immediate delete, `cleanupRun`'s four sweeps, the shared delete budget, the redacted-uid logging, the CLI summary's `deleted` line
- `test/unit/bug-report-filer.test.js` - the in-memory-Firestore routing fake (generic structuredQuery evaluator, PATCH/DELETE persistence), every SRV-11 behavior, all pre-existing coverage carried forward with extended call-order assertions
- `.github/workflows/bug-reports.yml` - header comment only, now documents the retention cleanup (schedule unchanged)
- `docs/BUG-REPORTS.md` - substantially rewritten runbook (identity, limits, per-IP setting, retention, live-proof placeholder)
- `store-listing/LISTING.md` - the retention sentence in the privacy-policy draft; the anonymous-identifier Data safety flag for Phase 86

## Decisions Made

- Every `bugReports` `DELETE` (immediate or swept) re-checks the document's own `status` field before deleting, even though the query that found it already filtered on status — defense-in-depth per the plan's T-83-44 threat mitigation rather than a strictly-necessary second check.
- `reportLimits` deletions are never logged or reported by uid in any mode: dry-run lines read `would delete reportLimits/<redacted> (limit-expired)`, a failed real `DELETE`'s warning uses the same redacted form, and the CLI summary counts every `reportLimits` deletion as the bare word `limit`.
- The stale-filing reconcile path now performs the same `oracleTrimmed` computation and immediate delete as a fresh filing, keeping the two "becomes filed" code paths consistent rather than only covering the common case.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None beyond ordinary TDD iteration: two test-authoring mistakes were caught and fixed before the Task 2 commit (a test that conflated "cleanup sweep deletes an old 'new' doc" with the correct behavior "a 'new' doc gets legitimately filed and then immediately deleted in the same run," and a CLI-summary probe test that tried to `import` an absolute Windows path as an ESM specifier). Both were fixed in place during the RED/GREEN loop, before any commit.

## User Setup Required

None — no external service configuration required. This plan is pure client/tooling code plus docs, exercised entirely against an in-memory Firestore fake and unit-tested `node -e` checks; nothing is deployed here. Live deploy, the real `--probe-rules` run, and the Action's cleanup proof against the actual project are 83-11's job.

## Next Phase Readiness

- `file-issues.mjs`'s retention cleanup is code-complete and ready for 83-11 to exercise live: send a test report, dispatch the Action, confirm the issue is filed and its Firestore document is gone (per this plan's own objective note, "the Action runs the code from the pushed master branch, so the live proof is 83-11's").
- `docs/BUG-REPORTS.md`'s "## Live proof" placeholder and the "Per-IP sign-up limit" subsection's pointer to `docs/LEADERBOARDS.md` section 14 are both ready for 83-11 to fill in.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/bug-report-filer.test.js test/unit/bug-report-issue.test.js` — 60 pass, 0 fail.
**Full suite (`npm test`, once at plan close):** 8305 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

## Human verification (deferred to end of run)

None — this plan ships no device-testable surface (tooling, docs and a routing-fake-tested Action script; nothing runs in the app UI).

## Requirement coverage note

This plan's frontmatter lists `SRV-11, SRV-09, SRV-10` — matching 83-02/83-09's pattern, these same IDs recur across the phase's live-setup and live-proof plans. REQUIREMENTS.md's checkboxes for all three are intentionally left unchecked here:

- **SRV-11** — this plan delivers its full code scope (every retention rule, the cap, the guard, the dry run, all unit-tested per this plan's own success criteria), but the requirement's own text and this plan's objective both point at 83-11 for live proof; the checkbox is left for 83-11 to mark.
- **SRV-09** — this plan's contribution is documentation only (the code shipped in 83-02/83-09); its checkbox is 83-11's to mark once the live probes pass.
- **SRV-10** — untouched by this plan except a runbook pointer; the actual per-IP setting is 83-08's live-setup job, recorded and checked off there or at 83-11.

## Known Stubs

None.

## Threat Flags

None — every new surface (the four cleanup queries, the immediate/deferred deletes, the redacted logging) is exactly what this plan's own `<threat_model>` (T-83-44 through T-83-47) anticipated and mitigates; nothing outside that register was introduced.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-29*

## Self-Check: PASSED

All modified files found on disk (`tools/bug-reports/issue-format.mjs`, `tools/bug-reports/file-issues.mjs`, `test/unit/bug-report-issue.test.js`, `test/unit/bug-report-filer.test.js`, `.github/workflows/bug-reports.yml`, `docs/BUG-REPORTS.md`, `store-listing/LISTING.md`); all three task commits (`98599f1f`, `fec83ed2`, `831f77d3`) found in git log.
