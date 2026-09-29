---
phase: 83-leaderboard-server
plan: 09
subsystem: api
tags: [firebase-auth, firestore, bug-reports, rate-limit, rest-api, cli-tooling]

# Dependency graph
requires:
  - "83-02: src/browser/reportLimits.js (REPORT_COOLDOWN_MINUTES/REPORT_DAILY_CAP/LIMIT_FIELDS, nextLimitState/validateLimitStep, decodeLimitDoc, randomDocId, buildReportCommit, sanitizeLocalLimit/checkLocalLimit/recordLocalSend), firebase/firestore.rules (the limited bugReports create + reportLimits contract)"
  - "83-03: src/browser/firebaseAuth.js (createIdentity -> getToken/forceRefresh with {explicit:true}, the SRV-09 escape hatch)"
  - "83-04: src/browser/fakeBoardServer.js (createFakeBoardFetch, FAKE_ADMIN_TOKEN — the report+limit commit, reportLimits owner get, admin PATCH/DELETE seeding)"
provides:
  - "src/browser/bugReport.js: sendBugReport signs the report through the shared identity (getToken({explicit:true})), reads reportLimits/{uid}, and writes the report + limit step in one documents:commit; REPORT_REASONS grows to unavailable/offline/refused/server/limited/cooldown/daily"
  - "src/browser/reportSheet.js: BUG_REPORT_COPY.failed.limited/cooldown/daily (house voice, {wait}/{cap} tokens), BUG_REPORT_COPY.wait unit bank, waitTextFor(reason, ms), the model's wait field"
  - "mazeworld.html: sharedIdentity() (one lazy createIdentity instance, competeOn () => false) and sendReportNow's local-limit pre-check (checkLocalLimit) before ever calling sendBugReport"
  - "tools/bug-reports/send-test-report.mjs: buildProbes/runProbes (the ten named 403 probes), sendOnce/runProbeRules (testable helpers the CLI's default and --probe-rules modes call), ready for 83-11's live run"
affects: [83-10, 83-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sendBugReport mirrors boardWrites.js's per-request one-shot 401 -> forceRefresh({explicit:true}) -> retry budget, but applies it independently to each of the two requests (the reportLimits GET and the :commit POST) rather than sharing one budget across a whole call — a stricter, more literal reading of the plan's per-request retry wording"
    - "reportSheet.js's waitTextFor(reason, ms) renders the cooldown/daily wait phrase (ceil to whole minutes/hours, minimum 1, singular vs plural), kept as a pure standalone export so reportSheetView can fill {wait} without duplicating the rounding rule"
    - "send-test-report.mjs's network-shaped logic (buildProbes/runProbes/sendOnce/runProbeRules) is exported and unit-tested directly against createFakeBoardFetch and a permissive stub fetchFn, instead of only being exercised through spawnSync — the CLI's main() is now a thin wrapper (arg parsing, gcloud token acquisition, printing) over these testable helpers"

key-files:
  created: []
  modified:
    - src/browser/bugReport.js
    - test/unit/bug-report.test.js
    - src/browser/reportSheet.js
    - test/unit/report-sheet.test.js
    - mazeworld.html
    - test/unit/report-sheet-shell.test.js
    - tools/bug-reports/send-test-report.mjs
    - test/unit/bug-report-tool.test.js
    - src/browser/fakeBoardServer.js
    - test/unit/fakeBoardServer.test.js

key-decisions:
  - "sendBugReport gives the reportLimits GET and the :commit POST each their own independent one-shot 401 retry budget (rather than one shared budget for the whole call) — the plan's action text describes the two retries separately ('the owner GET ... with 401 answered by forceRefresh ... 401 to one forced refresh and retry' for the commit), and a second 401 on either request (after its own retry) reads 'refused' rather than looping again"
  - "reportSheetNext's 'result' event keeps waitMs as the model's wait field only for reason cooldown/daily AND a positive finite number — 'limited' never carries a wait even if a caller passes waitMs, since BUG_REPORT_COPY.failed.limited has no {wait} token to fill"
  - "send-test-report.mjs's --probe-rules obtains its admin token once via `gcloud auth print-access-token` and attaches it (plus an X-Goog-User-Project header) through a shared adminHeaders() helper inside runProbes, rather than threading the header through every individual probe request — keeps buildProbes a pure, admin-agnostic request builder"

patterns-established:
  - "A tool's CLI entry point (main()) stays a thin arg-parsing/printing wrapper around exported, independently-unit-testable async helpers (sendOnce, runProbeRules) — avoids ever needing to spawn the real CLI against a live network or gcloud login just to prove its request-building logic"

requirements-completed: []

coverage:
  - id: D1
    description: "sendBugReport(report, opts) signs the report through the shared identity (identity.getToken({explicit:true})), reads the player's own reportLimits/{uid} (owner GET, 401 -> one forceRefresh+retry, 404 -> no prior report, other 4xx -> refused, 429/5xx -> server), computes the next allowed step via reportLimits.js#nextLimitState, and on an allowed step writes the report + limit step in one documents:commit (buildReportCommit) — 2xx -> {ok:true, id, limit}, 403 -> limited, 401 -> one forceRefresh+retry, 429/5xx -> server, other >=400 -> refused, a rejected/timed-out fetch -> offline; a local cooldown/daily refusal never reaches :commit and returns the server's before-state as `limit` so the caller can restore its own local record"
    requirement: SRV-09
    verification:
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport against the fake board: the first send signs up, reads the absent limit doc, and writes the report + limit in one commit with no uid on the report"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport against the fake board: cooldown, the daily cap and the next UTC day"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport against the fake board: an existing server-side limit doc (no prior local record) is read via GET and enforced"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport: a stub commit answer of 403 resolves limited; 429/503 read as server; 400 reads refused"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport: a 401 on the commit forces exactly one refresh and one retry, then succeeds with the refreshed token"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport: a 401 on the limit GET itself forces one refresh and one retry before the commit"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report.test.js#sendBugReport: unavailable config, missing fetchFn, missing identity, offline and an invalid report never call fetch or identity.getToken"
        status: pass
    human_judgment: false
    note: "This plan delivers sendBugReport's full identity/limit/commit flow, unit-proven against the exact contract firebase/firestore.rules enforces (via createFakeBoardFetch's shared JS mirrors). Live probes against the deployed project and the Action's automatic cleanup are 83-10/83-11's jobs — SRV-09 is not fully satisfied until then, so REQUIREMENTS.md's checkbox stays unchecked here."
  - id: D2
    description: "The report sheet shows an in-voice rate-limited/cooldown/daily message with the wait time when the player is over a limit, and keeps the draft; the shell checks its own local record (reportLimits.js#checkLocalLimit) before ever calling sendBugReport, passes one shared, lazily-created identity (sharedIdentity(), competeOn () => false until Phase 85), and persists the returned limit record to ddr.reportLimit.v1"
    requirement: SRV-09
    verification:
      - kind: unit
        ref: "test/unit/report-sheet.test.js#(D6) every REPORT_REASONS failed status is reachable, cooldown/daily fill {wait} (and daily fills {cap}), and a hostile/unknown reason falls back to offline"
        status: pass
      - kind: unit
        ref: "test/unit/report-sheet.test.js#waitTextFor: cooldown rounds minutes up / daily rounds hours up"
        status: pass
      - kind: unit
        ref: "test/unit/report-sheet.test.js#(C5) result: ... wait only for cooldown/daily with a positive finite waitMs"
        status: pass
      - kind: unit
        ref: "test/unit/report-sheet-shell.test.js#(D4b) sendReportNow reads the local limit record through window.mzStorage, checks it with checkLocalLimit before sendBugReport, passes identity: sharedIdentity(), and writes result.limit back"
        status: pass
      - kind: unit
        ref: "test/unit/report-sheet-shell.test.js#(D4c) sharedIdentity() lazily creates one createIdentity instance and returns the same instance afterwards"
        status: pass
      - kind: unit
        ref: "test/unit/voice-corpus.test.js, test/voice/safety-scan.test.js (full suite, BUG_REPORT_COPY's new leaves included)"
        status: pass
    human_judgment: true
    rationale: "The reducer/view-model logic and the shell's source-level wiring are fully unit-proven, but the actual on-device look of the limit/cooldown states (the card/rail rendering, whether the wait phrase reads naturally in the sheet) needs a human eyeball — deferred to the milestone-close Pixel 7 checklist per this plan's run_notes."
  - id: D3
    description: "tools/bug-reports/send-test-report.mjs sends a [TEST] report through the new identity+commit path (sendOnce) and --probe-rules runs the ten named probes (buildProbes/runProbes/runProbeRules) that must each be refused with 403: list-read, extra-field, wrong-status, no-auth, no-limit-write, cooldown, forged-count, sixth-today, other-limit-doc, list-limits — seeded states use the developer's gcloud admin token (with an X-Goog-User-Project header) and everything created is best-effort cleaned up"
    requirement: SRV-09
    verification:
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#buildProbes: the ten named probes in order, with the right shapes"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#runProbes: every probe PASSes (403) against createFakeBoardFetch"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#runProbes: every probe FAILs against a permissive stub that answers 200 to everything"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#sendOnce: sends the [TEST] report through the shipped client code against the fake, then the account can be deleted"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#runProbeRules: against the fake, all ten probes pass and both accounts are deleted"
        status: pass
      - kind: unit
        ref: "test/unit/bug-report-tool.test.js#CLI --dry-run: exits 0, prints [TEST], the masked key, and the reportLimits write; never leaks the real key"
        status: pass
    human_judgment: false
    note: "The tool is proven end-to-end against the fake board (every probe's exact 403/shape behavior) but has never touched the live project — that live run (deploying rules first, then --probe-rules for real, plus the Action's cleanup proof) is 83-10/83-11's job."

duration: 70min
completed: 2026-09-29
status: complete
---

# Phase 83 Plan 09: REPORT A BUG over the Shared Identity and the Per-Player Limit Summary

**sendBugReport now signs in through the shared anonymous identity and writes the report plus its reportLimits/{uid} step in one documents:commit; the report sheet shows an in-voice rate-limited/cooldown/daily message and keeps the draft; the shell passes one lazily-created identity and checks a local record first; send-test-report.mjs sends through the new path and proves all ten rules refusals live-ready against the fake board.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3
- **Files modified:** 10 (8 planned + 2 deviation: fakeBoardServer.js, test/unit/fakeBoardServer.test.js)

## Accomplishments

- `src/browser/bugReport.js#sendBugReport` no longer POSTs a plain unauthenticated create. It calls `identity.getToken({explicit:true})` (the escape hatch 83-03 built for exactly this Send), reads the player's own `reportLimits/{uid}` via an owner GET (401 forces one `forceRefresh({explicit:true})` and retry, 404 means no prior report, other 4xx is `refused`, 429/5xx is `server`), runs `reportLimits.js#nextLimitState`, and — when allowed — writes the report and the limit step together in one `documents:commit` (`buildReportCommit`). The report document still carries no `uid` anywhere (D-07 holds). `REPORT_REASONS` grows from four to seven: `unavailable, offline, refused, server, limited, cooldown, daily`.
- `src/browser/reportSheet.js`'s `BUG_REPORT_COPY.failed` gains `limited`/`cooldown`/`daily` lines in the house voice (the cooldown line lands "the Oracle needs a minute," daily names the cap through a `{cap}` token filled from `REPORT_DAILY_CAP` so the copy can never disagree with the rules), plus a `wait` unit bank (`"1 minute"`/`"{n} minutes"`/`"1 hour"`/`"{n} hours"`) and the new `waitTextFor(reason, ms)` export (ceils to whole minutes/hours, minimum 1). The model grows a `wait` field, set only on a `cooldown`/`daily` result with a positive finite `waitMs`; `reportSheetView` fills `{wait}`/`{cap}` into the status line.
- `mazeworld.html` imports `createIdentity` and `reportLimits.js`'s local-record helpers, adds a lazy `sharedIdentity()` singleton (`window.mzStorage`, bound global `fetch`, `competeOn: () => false` until Phase 85 wires Compete), and `sendReportNow` now reads `ddr.reportLimit.v1` through `window.mzStorage`, calls `checkLocalLimit` before ever touching `sendBugReport`, passes `identity: sharedIdentity()`, and persists `result.limit` back to storage whenever the result carries one.
- `tools/bug-reports/send-test-report.mjs` is reworked around the new path: `buildProbes` replaces `probeRequests` (ten named probes: `list-read, extra-field, wrong-status, no-auth, no-limit-write, cooldown, forged-count, sixth-today, other-limit-doc, list-limits`), `runProbes` replaces `runProbe` (seeds `reportLimits/{uid}` via the admin token before each seeded probe, records `PASS` only on 403, best-effort cleans up any unexpectedly-created doc, and deletes every seeded limit doc in `finally`). The default send and `--probe-rules` modes both sign in through `createIdentity` instead of a plain create; `--probe-rules` obtains its admin token via `gcloud auth print-access-token` and attaches `X-Goog-User-Project` to every admin-authenticated request. `--dry-run` now previews the two-write `:commit` body.
- **Deviation (Rule 2):** `src/browser/fakeBoardServer.js` had no route for a bare collection-level GET (a Firestore "list" attempt) on `bugReports` or `reportLimits` — it 404'd instead of the rules' unconditional list-deny, which the `list-read`/`list-limits` probes need to prove 403 against the fake. Added a small, unconditional `denied()` branch for exactly those two bare-collection GET paths, plus a covering `fakeBoardServer.test.js` case.

## Task Commits

Each task was committed atomically:

1. **Task 1: sendBugReport over the shared identity, the limit read and the one-commit write** - `fd3786fd` (feat)
2. **Task 2: The rate-limited report sheet and the shell's shared identity and local record** - `3e1a81f2` (feat)
3. **Task 3: send-test-report.mjs — the new-path test send and the ten 403 probes** - `df1a56e5` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/browser/bugReport.js` - `sendBugReport` rewritten over the shared identity + one-commit limit step; `REPORT_REASONS` grows to seven
- `test/unit/bug-report.test.js` - the new sendBugReport flow (stub-identity status-code mapping, plus fake-board integration: first send, cooldown/daily/next-day, server-side recovery)
- `src/browser/reportSheet.js` - `failed.limited/cooldown/daily`, the `wait` copy bank, `waitTextFor`, the model's `wait` field
- `test/unit/report-sheet.test.js` - the new copy/model/view-model behavior, `waitTextFor` unit tests
- `mazeworld.html` - `sharedIdentity()`, `sendReportNow`'s local-limit pre-check and `result.limit` persistence
- `test/unit/report-sheet-shell.test.js` - the two new import lines, `sharedIdentity()`, and `sendReportNow`'s new region
- `tools/bug-reports/send-test-report.mjs` - `buildProbes`/`runProbes`/`sendOnce`/`runProbeRules`, the reworked CLI modes
- `test/unit/bug-report-tool.test.js` - the ten probes' shapes, fake-board PASS/permissive-stub FAIL coverage, `sendOnce`/`runProbeRules`, CLI arg-validation exits
- `src/browser/fakeBoardServer.js` - (deviation) a bare-collection GET on `bugReports`/`reportLimits` now denies (403) instead of 404
- `test/unit/fakeBoardServer.test.js` - (deviation) covers the new bare-collection-GET deny

## Decisions Made

- `sendBugReport` gives the `reportLimits` GET and the `:commit` POST each their own independent one-shot 401 retry budget, rather than sharing one budget across the whole call — matches the plan's per-request wording; a second 401 on either request (after its own retry) reads `refused`.
- `reportSheetNext`'s `result` event only ever sets a non-null `wait` for `cooldown`/`daily` with a positive finite `waitMs` — `limited` never carries a wait, since its copy line has no `{wait}` token.
- `send-test-report.mjs`'s CLI `main()` stays a thin wrapper (arg parsing, gcloud token acquisition, printing) over independently-exported, unit-testable async helpers (`sendOnce`, `runProbeRules`) — the CLI itself is never spawned against a live network or gcloud login in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] fakeBoardServer.js had no route for a bare collection-level GET on bugReports/reportLimits**
- **Found during:** Task 3 (buildProbes/runProbes)
- **Issue:** The live rules deny `list` on both `bugReports` and `reportLimits` unconditionally. The client's `list-read`/`list-limits` probes reproduce a live "list" attempt with a raw `GET .../documents/{collection}` (no id) — but `fakeBoardServer.js`'s routing only ever matched `/{collection}/{id}` paths, so a bare-collection GET fell through to an unmodeled 404 instead of the rules' 403 deny. That would make those two probes FAIL against the fake even though the real rules would refuse them, contradicting this plan's own acceptance criterion ("against createFakeBoardFetch every probe is PASS").
- **Fix:** Added one small, unconditional `denied()` branch in `route()` for a GET whose suffix is exactly `/bugReports` or `/reportLimits` (no trailing id) — mirroring `list: if false` for both collections, regardless of auth (user, admin, or none).
- **Files modified:** `src/browser/fakeBoardServer.js`, `test/unit/fakeBoardServer.test.js`
- **Verification:** `test/unit/fakeBoardServer.test.js#Phase 83-09: a bare collection GET (no id) on bugReports or reportLimits — a list attempt — is 403, for a user, admin or no auth at all` passes; all ten probes now PASS against the fake in `test/unit/bug-report-tool.test.js`.
- **Committed in:** `df1a56e5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Necessary for the probe tool's own acceptance criterion to hold against the fake; no scope creep beyond the two collections this plan's probes actually exercise.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required. Live Firebase deploy, the actual `gcloud`-authenticated `--probe-rules` run against the real project, and the Action's automatic cleanup proof are 83-10/83-11's jobs; this plan is pure client code and CLI tooling, exercised entirely against `createFakeBoardFetch`.

## Next Phase Readiness

- `sendBugReport`'s identity/limit/commit flow and `reportSheet.js`'s rate-limited copy are ready for 83-10's Action cleanup work (the report/limit document shapes are unchanged from what 83-02 declared) and for 83-11's live proof.
- `send-test-report.mjs`'s `buildProbes`/`runProbes`/`runProbeRules` are ready for 83-11 to run for real against the deployed rules (after 83-10/83-11's own rules deploy) — no further client-side work needed before that live run.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/bug-report.test.js test/unit/report-sheet.test.js test/unit/report-sheet-shell.test.js test/unit/bug-report-tool.test.js test/unit/voice-corpus.test.js test/voice/safety-scan.test.js` — 133 pass, 0 fail, 2 skipped (pre-existing, apiKey-already-filled CLI paths).
**Full suite (`npm test`, once at plan close):** 8277 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

## Human verification (deferred to end of run)

Per this plan's run_notes, these device-testable items go to the milestone-close Pixel 7 checklist (no device pauses during this autonomous run):
- REPORT A BUG sheet: trigger a `cooldown` failed state (send twice quickly) and confirm the "Oracle needs a minute" line reads naturally with the actual wait time filled in.
- REPORT A BUG sheet: trigger a `daily` failed state (five sends in one day) and confirm the `{cap}`/`{wait}` line reads naturally.
- Send a report with Compete OFF and confirm the identity is created silently on tap (no visible network indicator change) and the send still succeeds.

## Requirement coverage note

This plan's frontmatter lists `SRV-09` — matching every other Phase 83 plan touching bug-report limits, this same ID recurs in 83-10 (Action cleanup) and 83-11 (live probes/cleanup proof). REQUIREMENTS.md's SRV-09 checkbox is intentionally left unchecked here; this plan's contribution (the client's full identity/limit/commit flow, the report sheet's rate-limited UX, and the probe tool ready to run live) is recorded in the `coverage` block above and should be read as partial — SRV-09 is not fully satisfied until 83-11's live proof lands.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-29*

## Self-Check: PASSED

SUMMARY.md found on disk; all three task commits (`fd3786fd`, `3e1a81f2`, `df1a56e5`) found in git log.
