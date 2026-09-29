---
phase: 83-leaderboard-server
plan: 07
subsystem: testing
tags: [firestore, firebase, end-to-end-smoke, cli, idempotency, moderation]

# Dependency graph
requires:
  - "83-03: src/browser/firebaseAuth.js (createIdentity)"
  - "83-04: src/browser/fakeBoardServer.js (createFakeBoardFetch/FAKE_ADMIN_TOKEN), src/browser/boardClient.js (createBoardClient/decodeRunDocument)"
  - "83-05: tools/boards-admin.mjs (resolveAdminAuth/createAdminApi)"
  - "83-06: src/browser/boardWrites.js (createBoardWrites: submitRun/rewriteHandle/eraseMyRuns)"
provides:
  - "tools/boards-smoke.mjs: smokeSummaries(now), runSmoke({fetchFn, config, now, log, admin}) -> {ok, steps, facts, cleanup}, a guarded main() (--with-admin, --dry-run, the PASS/FAIL table and exit codes) — the end-to-end proof instrument 83-08 runs live"
affects: [83-08 (the live run of this exact tool)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wrapRecorder(fetchFn): a fetchFn wrapper that clones a real Response before reading it (never touching the copy the downstream module still needs to consume) to capture the raw HTTP status and REST error status/message of every :commit/:runQuery/:runAggregationQuery call, without breaking readJson() downstream — the fake's own response object has no clone() and its json() is safely re-callable, so the same wrapper works unmodified against both the fake and a real fetch"
    - "runStep(name, fn): records {name, pass, detail} to a shared steps array and throws a sentinel on failure so the outer try/catch stops the run at the first failing step, while a finally block always runs cleanup regardless of where the run stopped"
    - "missingIndexes is derived, not asserted: the recorder's captured REST error messages are filtered to those matching /index/i — the fake never produces an index-shaped FAILED_PRECONDITION message (only 'FAILED_PRECONDITION' itself), so this naturally reports empty offline and only starts reporting real entries once 83-08 points the same tool at the live project"

key-files:
  created:
    - tools/boards-smoke.mjs
    - test/unit/boards-smoke.test.js

key-decisions:
  - "The four board-read filter shapes ({},{race},{sub},{race+sub}) are reused verbatim across top-ten/totals/ranks (12 client calls become 3x16=48 total), and for `ranks` specifically, three of the four shapes read run A's key while the fourth (race+sub) reads run B's — since every smoke run shares the same race/sub, this proves rankOf(deep, A) < rankOf(deep, B) without needing a fifth, uncounted read"
  - "deny-bad-key/deny-other-id/deny-no-auth each build a NEW run summary (B's floor +1/+2/+3) rather than reusing A or B, so each deny probe's own 'a public GET shows nothing was written' check targets a doc id that could never collide with a run the smoke legitimately created"
  - "handle-rewrite expects `updated === 1` in --with-admin mode (not 2) because admin-delete already removed run B by the time handle-rewrite runs (the plan's own step order places ban/admin-delete before handle-rewrite/erase) — only run A remains to be rewritten"
  - "Cleanup's finally block always prefers the shipped owner path (writes.eraseMyRuns(), which also deletes the account and drops the identity) whenever the identity still has a uid, falling back to per-id admin.api.deleteRun() over a locally-tracked id list only when the identity is already gone AND an admin api is available — matching the plan's own 'owner delete when alive, else admin deleteRun' wording exactly"
  - "The CLI's main() passes log: () => {} to runSmoke and prints its own consolidated PASS/FAIL/facts/cleanup lines from the returned `steps`/`facts`/`cleanup` objects instead, avoiding a duplicate line per step while still honoring runSmoke's own `log` parameter contract for callers (like the test suite) that want programmatic access to every log line"

patterns-established:
  - "tools/boards-smoke.mjs is the exact tool 83-08 runs against the live project with --with-admin — no code changes expected there, only a live invocation and a recorded facts/cleanup result in docs/LEADERBOARDS.md section 14"

requirements-completed: []

coverage:
  - id: D1
    description: "runSmoke drives the shipped client modules (firebaseAuth, boardWrites, boardClient, runDoc) through the full board contract: anonymous sign-up, create, an idempotent resubmit acknowledged under all three fake existsResponse duplicate-create answers (400/403/409, recorded as facts.duplicateStatus), a second run, every stat x every race/sub filter shape for top-ten/totals/ranks (48 reads total), five deny probes (bad rank key, wrong doc id, no auth, a non-handle field update, a list read above 50), an optional --with-admin ban+refused-resubmit+unban round trip and an admin delete, a handle re-roll rewriting every remaining owned run, and owner erase-everything ending in the anonymous account being deleted — all offline against src/browser/fakeBoardServer.js, so 83-08's live run is a measurement, not a debugging session"
    requirement: SRV-08
    verification:
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#runSmoke: a full client-only pass ... resolves ok:true in step order, with facts"
        status: pass
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#runSmoke: existsResponse 'denied' records duplicateStatus 403 / 'conflict' records duplicateStatus 409"
        status: pass
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#runSmoke: with admin, ban/admin-delete run and the board ends empty"
        status: pass
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#runSmoke: a Firestore 503 after sign-up fails at create-a, names the step, and cleanup still runs"
        status: pass
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#runSmoke: no step, log line or fact contains the API key, an id token or a refresh token"
        status: pass
    human_judgment: false
    note: "This plan's own objective states it proves the board end to end OFFLINE ('prove it offline against the fake server') — SRV-08 additionally requires the LIVE project be configured and proven (rules/indexes deployed, anonymous sign-in enabled, the API key restricted), which is 83-08's job. REQUIREMENTS.md's SRV-08 checkbox is intentionally left unchecked here; this plan delivers the proof instrument 83-08 runs unmodified."
  - id: D2
    description: "The guarded CLI (main()): no flag runs the client-only smoke against the live FIREBASE_CONFIG (refusing with exit 2 if it isn't configured); --with-admin resolves admin auth via tools/boards-admin.mjs#resolveAdminAuth's gcloud path (exit 2 with a one-line message on failure) and also runs the ban/admin-delete steps; --dry-run prints every planned step name and the three fixed smoke summaries without touching the network, and never prints the API key; any other flag or extra argument prints usage and exits 2. A live run prints one PASS/FAIL line per step, a facts line and a cleanup line, exiting 0 only when every step passed and cleanup (erased + accountDeleted) both finished cleanly"
    requirement: SRV-08
    verification:
      - kind: other
        ref: "node tools/boards-smoke.mjs --dry-run: exit 0, stdout contains 'signup'/'erase'/'ban'/'Smoke Probe', never 'AIza'"
        status: pass
      - kind: other
        ref: "node tools/boards-smoke.mjs --bogus: exit 2"
        status: pass
      - kind: unit
        ref: "test/unit/boards-smoke.test.js#CLI --dry-run / CLI --bogus / CLI too many args (spawnSync)"
        status: pass
    human_judgment: false
    note: "Never invoked without --dry-run in any test or verification here — a bare invocation uses the REAL FIREBASE_CONFIG and would attempt a live network call, which this plan's own run notes forbid (the live run is 83-08's job)."

duration: 50min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 07: The Board's End-to-End Smoke Test Summary

**tools/boards-smoke.mjs drives the shipped client modules (firebaseAuth, boardWrites, boardClient, runDoc) through every board allow and deny — idempotent resubmit under all three duplicate-create answers, every stat x filter-shape read, five deny probes, an optional admin ban/delete round trip, handle re-roll and owner erase — proven offline against the fake server, with a --with-admin/--dry-run CLI 83-08 runs unmodified against the live project.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `tools/boards-smoke.mjs#smokeSummaries(now)` returns three frozen, fixed RunSummary objects (run A floor 7, run B floor 3, run C floor 2 — the ban-step-only submit) sharing race "Troll", class "Magic User", sub "Court Mage", name "Smoke Probe" and epitaph "Smoke test run. Safe to delete.", each with a hash computed via `engine/records.js#runHash` and each proven to pass `src/browser/runDoc.js#buildRunDoc`.
- `runSmoke({fetchFn, config, now, log, admin})` drives the exact shipped client modules end to end: `signup` (firebaseAuth), `create-a`/`resubmit-a`/`create-b` (boardWrites — proving a duplicate create is acknowledged, not duplicated, under all three fake `existsResponse` answers), `top-ten`/`totals`/`ranks` (boardClient — 4 stats x 4 race/sub filter shapes = 48 reads total, proving descending order, the ≥10-cap, race+sub presence for every stat, and `rankOf(deep, A) < rankOf(deep, B)`), five deny probes built directly from `runDoc.js`'s own commit builders (a tampered rank key, a wrong doc id, no auth, a non-handle field update, a list read above 50 — each proven both refused AND that nothing landed via a public GET), an optional `--with-admin` `ban`/`admin-delete` pair (a banned uid's resubmit is refused; an admin delete actually removes a run), `handle-rewrite` (a re-roll rewrites every remaining owned run) and `erase`/`account-deleted` (owner delete-everything, then the anonymous account is confirmed gone).
- A `finally` block always runs cleanup regardless of where the run stopped: it prefers the shipped owner path (`writes.eraseMyRuns()`, which also deletes the account and drops the local identity) whenever the identity is still alive, falling back to per-id `admin.api.deleteRun()` only when the identity is already gone and an admin api was provided. Proven by a dedicated failure-path test (a Firestore-503 stub after sign-up fails at `create-a`) that still ends with an empty board, no ban and the anonymous account deleted.
- `facts` records what only a live project can answer: `duplicateStatus` (the raw HTTP status the resubmit's `:commit` call returned before the GET settled it — 400/403/409 depending on the fake's `existsResponse` mode), `countUnderListRule` ("pass" or the refused status), `missingIndexes` (verbatim `FAILED_PRECONDITION` messages containing "index" — naturally empty offline) and the static `commitShape: "single-write"`.
- The guarded CLI: no flag runs the client-only smoke against the real `FIREBASE_CONFIG`; `--with-admin` resolves admin auth via `tools/boards-admin.mjs#resolveAdminAuth`'s gcloud path and also runs `ban`/`admin-delete`; `--dry-run` prints every planned step name and the three fixed smoke summaries, touching nothing and never printing the API key; any other flag or extra argument prints usage and exits 2. A live run prints one `PASS`/`FAIL` line per step, a `facts` line and a `cleanup` line, exiting 0 only when every step passed and cleanup fully finished.
- A `wrapRecorder(fetchFn)` wrapper captures the HTTP status and REST error status/message of every `:commit`/`:runQuery`/`:runAggregationQuery` call by cloning a real `Response` before reading it (never consuming the copy the downstream module still needs) — the same wrapper works unmodified against both `fakeBoardServer.js`'s response object (no `clone()`, a safely re-callable `json()`) and a real `fetch` `Response`.

## Task Commits

Each task was committed atomically:

1. **Task 1: runSmoke — the step list, the denies, the recorded facts and the always-run cleanup** - `e82a31a7` (feat)
2. **Task 2: The CLI — --with-admin, --dry-run, the PASS/FAIL table and exit codes** - `cbac90dc` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tools/boards-smoke.mjs` - `smokeSummaries`, `runSmoke` (Task 1); a guarded `main` with `--with-admin`/`--dry-run`/usage/exit codes (Task 2)
- `test/unit/boards-smoke.test.js` - `smokeSummaries` (frozen, valid hash, passes `buildRunDoc`), `runSmoke` in both modes, all three `existsResponse` answers, the 503-failure cleanup path, the no-token-leak proof (Task 1); CLI `--dry-run`/`--bogus`/too-many-args via `spawnSync` (Task 2)

## Decisions Made

- The four board-read filter shapes are reused verbatim across `top-ten`/`totals`/`ranks`; `ranks` reads three shapes with run A's key and the race+sub shape with run B's key, proving `rankOf(deep, A) < rankOf(deep, B)` without an extra, uncounted read (see key-decisions in the frontmatter for the full list).
- `deny-bad-key`/`deny-other-id`/`deny-no-auth` each build a brand-new run summary (B's floor +1/+2/+3) rather than reusing A or B, so each probe's own "nothing was written" GET check can never collide with a run the smoke legitimately created.
- `handle-rewrite` expects exactly 1 updated run in `--with-admin` mode (not 2), since `admin-delete` already removed run B earlier in the step order — only run A remains.
- Cleanup always prefers the shipped owner path (`eraseMyRuns()`) when the identity is alive, falling back to admin per-id deletes only when it's already gone — matching the plan's own wording precisely.

## Deviations from Plan

None — plan executed exactly as written. Two implementation-detail choices (the exact filter-shape/key pairing for `ranks`, and the response-cloning approach in `wrapRecorder` so a real `fetch` Response's body isn't consumed before the downstream module reads it) were left to "Claude's Discretion" per the plan's own context and are documented above as key-decisions, not deviations.

## Issues Encountered

None. Both tasks' first full `node --test` run passed against `src/browser/fakeBoardServer.js` with no implementation bugs found after authoring — the test file and the implementation were developed together against the plan's precise behavior spec, then verified green before each task's commit.

## User Setup Required

None - no external service configuration required. This plan is pure dev tooling exercised entirely against `src/browser/fakeBoardServer.js`; no real network call happens in any test or verification here. Live setup and the live run of this exact tool (`node tools/boards-smoke.mjs --with-admin`) are 83-08's job.

## Next Phase Readiness

- `tools/boards-smoke.mjs` is ready for 83-08 to run unmodified against the live, deployed `delve-die-repeat-6ba5f` project with `--with-admin`, recording the resulting `facts` (especially `duplicateStatus` and any real `missingIndexes`) and `cleanup` result into `docs/LEADERBOARDS.md` section 14.
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/boards-smoke.test.js` — 11 pass, 0 fail. `node tools/boards-smoke.mjs --dry-run` — exit 0, contains "signup"/"erase", never "AIza". `node tools/boards-smoke.mjs --bogus` — exit 2. `grep -c "export async function runSmoke" tools/boards-smoke.mjs` = 1. `grep -c "deny-list-51" tools/boards-smoke.mjs` = 3 (≥1). `grep -c "finally" tools/boards-smoke.mjs` = 3 (≥1).
**Full suite (`npm test`, once at plan close):** 8288 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (a dev-only Node tool and its offline test suite; no UI, nothing deployed, no live network call).

## Requirement coverage note

This plan's frontmatter lists `SRV-08, SRV-01, SRV-02, SRV-03`. Per the run notes ("Only mark a requirement complete in REQUIREMENTS.md when this plan fully delivers it — later plans share most SRV IDs; record partial coverage in the SUMMARY instead"), **none of these four are checked off here**:
- `SRV-08` explicitly requires the LIVE project be configured and proven end to end ("The live project is configured and proven end to end... A smoke test creates, reads, ranks and deletes a run against the live project"). This plan builds and offline-proves that exact smoke test — the proof instrument — but the live half is 83-08's job.
- `SRV-01`/`SRV-02`/`SRV-03` were already substantively delivered by 83-01/83-02/83-04/83-06 and remain unchecked pending 83-08's live proof of the same contract against the real deployed rules/indexes, per those plans' own SUMMARYs.

All four remain `Pending` in REQUIREMENTS.md's traceability table, unchanged by this plan; this SUMMARY's `coverage` block records this plan's own (offline) contribution to SRV-08 in full.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`tools/boards-smoke.mjs`, `test/unit/boards-smoke.test.js`, `.planning/phases/83-leaderboard-server/83-07-SUMMARY.md`); both task commits (`e82a31a7`, `cbac90dc`) found in git log.
