---
phase: 83-leaderboard-server
plan: 05
subsystem: infra
tags: [firestore, admin-tooling, moderation, csv-export, ops-runbook]

# Dependency graph
requires:
  - "83-02: src/browser/runDoc.js (RUN_COLLECTION/BANNED_COLLECTION/RUN_DOC_FIELDS/RANK_FIELD/BOARD_STATS/isBoardStat/TOP_N/LIST_LIMIT_MAX/topTenQuery), firebase/firestore.rules (isValidBoardRun, banned/{uid})"
  - "83-04: src/browser/fakeBoardServer.js (createFakeBoardFetch/FAKE_ADMIN_TOKEN — the admin-token contract every test in this plan drives against)"
provides:
  - "tools/boards-admin.mjs: parseArgs, resolveAdminAuth (gcloud token or an outside-the-repo service-account key, refusing an in-repo key path with exit 2), createAdminApi (query/listAll/getRun/deleteRun/runsOf/deleteRunsOf/setBan/clearBan), SUSPICIOUS_DEFAULTS, scoreSuspicious, isRolledName, isBankedEpitaph, filterExport, toCsv, runCommand (top/suspicious/delete-run/ban/unban/export/help), a guarded main"
  - "docs/LEADERBOARDS.md: the single leaderboard ops runbook (what the board is, the path, the run document, the rules, indexes, deploying, identity, the queue/backfill, live setup and API key restriction, the SEASON bump, Spark quotas, moderation, the kill switch, a live-setup-record placeholder for 83-08, troubleshooting)"
  - ".gitignore: ddr-boards*.json and boards-export* (a boards service-account key and admin exports, both never committed)"
affects: [83-07, 83-08, "Phase 84 (panel, board-string HTML-escaping note in LEADERBOARDS.md section 2)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin single-document DELETE, not a :commit batch, for deleteRunsOf: firebase/firestore.rules' (and fakeBoardServer.js's) commit-based delete Write stays owner-gated even for the admin token — only the single-document GET/DELETE/PATCH endpoints extend the IAM-level admin bypass. deleteRunsOf paginates runsOf via listAll (a __name__-cursor page walk, pageSize 300) then deletes in waves of up to 100 concurrent single-document DELETEs, preserving the 'at most 100 at a time' shape without a Write the admin commit path would refuse."
    - "isBankedEpitaph's template-to-regex: each content/epitaphs.js {token} placeholder becomes a non-empty non-greedy [\\s\\S]+? wildcard between escaped literal segments, anchored ^...$ — the same one-way-mirror-of-content-data approach runDoc.js/reportLimits.js use for their own rules mirrors, here applied to a heuristic check instead of a hard validation gate."
    - "isRolledName brute-forces the full first×sur combination space (up to 320 pairs) per call rather than precomputing a Set, since it only ever runs inside scoreSuspicious over an admin-triggered, human-paced run scan — never a hot path."

key-files:
  created:
    - tools/boards-admin.mjs
    - test/unit/boards-admin.test.js
    - docs/LEADERBOARDS.md
  modified:
    - .gitignore

key-decisions:
  - "deleteRunsOf uses the single-document admin DELETE endpoint (chunked in waves of ≤100 concurrent requests) rather than the plan's literal 'commit deletes in batches of at most 100' wording — the fakeBoardServer.js this plan's own tests drive against (built in 83-04) explicitly scopes the admin token's :commit bypass to run CREATE only, keeping commit-based delete/handle-update owner-gated even for the admin token (documented in 83-04-SUMMARY.md's own 'key-decisions'). A :commit multi-delete is genuinely valid against the LIVE project (Google Cloud IAM access bypasses firestore.rules regardless of endpoint), but is untestable against the existing fake without editing a file outside this plan's declared scope — so the admin-DELETE-endpoint form was chosen since it is both fake-testable now and correct live."
  - "cmdTop reuses runDoc.js's topTenQuery (as the plan's action text directs) and therefore defaults to the current content/season.js SEASON, with a --season/--all-seasons override mirroring export's own semantics — the plan's behavior spec for top never mentions season filtering explicitly, but every other admin command that reads runs (export) defaults to the current season, and reusing topTenQuery (rather than hand-rolling a parallel unfiltered query builder) was the plan's own 'Use runDoc.js's topTenQuery for top' instruction."
  - "isBankedEpitaph and isRolledName are pure heuristics (not rules-enforced bounds) — a run failing either check is merely listed by suspicious, never blocked from being created; both functions treat an empty epitaph as never a match (scoreSuspicious separately skips the epitaph-not-banked check entirely when epitaph is empty, per the plan's own 'a non-empty epitaph' wording)."

patterns-established:
  - "tools/boards-admin.mjs is the moderation/export entry point every later live-facing tool (83-07's boards-smoke.mjs, 83-08's live setup) can invoke by hand against the deployed project — its resolveAdminAuth shape (gcloud token or an outside-repo service-account key) is the second confirmed instance of the tools/bug-reports/file-issues.mjs auth pattern in this codebase, ready to be reused verbatim by any future admin tool."
  - "docs/LEADERBOARDS.md is the one ops runbook 83-08 appends its live-setup record to (section 14, left as a placeholder here) rather than writing a second document — matching docs/BUG-REPORTS.md's own single-runbook precedent."

requirements-completed: [SRV-07]

coverage:
  - id: D1
    description: "tools/boards-admin.mjs's top, suspicious, delete-run, ban, unban and export commands all run against src/browser/fakeBoardServer.js's admin-token contract with no dependency: top lists any rank stat (season-scoped, race/sub filters, limit clamped 1-50); suspicious flags days/floor and kills/steps outliers, a name not composable from content/names.js, and an epitaph matching no content/epitaphs.js template for its cause, most-reasons-first, with overridable thresholds; delete-run/ban/unban are dry runs unless --yes, and ban's delete-every-run-of-that-uid is proven by a real sign-up + submit + ban + refused-resubmit + unban + resubmit round trip through the fake's own commit path"
    requirement: SRV-07
    verification:
      - kind: unit
        ref: "test/unit/boards-admin.test.js#top: --stat kills --limit 3 prints rows in killsKey order; --limit above 50 is clamped to 50; --race filters equality"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#suspicious: flags all four reasons, most-reasons-first, excludes a clean run; --days-per-floor/--kills-per-step override the thresholds"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#delete-run: without --yes prints and changes nothing; with --yes deletes; an id that does not exist prints not-found and exits 0"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#ban --yes writes banned/<uid>, deletes every run of that uid, refuses a further create; unban restores; ban/unban without --yes is a no-op dry run"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#export: csv header + RFC 4180 escaping; json filters by version, season (default vs --all-seasons), and since/until; --out writes via writeFile, refusing an in-repo path not named boards-export*"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveAdminAuth offers exactly two admin auth paths — a gcloud access token (trimmed, X-Goog-User-Project added) or an outside-the-repo service-account key exchanged via getAccessToken (datastore scope, no X-Goog-User-Project) — and refuses (exit 2, no path/contents echoed) a --key or DDR_BOARDS_SA_KEY resolving inside the repository, before the file is ever read"
    requirement: SRV-07
    verification:
      - kind: unit
        ref: "test/unit/boards-admin.test.js#resolveAdminAuth: gcloud path trims the token and adds X-Goog-User-Project; execFn throwing is an error"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#resolveAdminAuth: a --key path inside the repo is refused and never echoed; DDR_BOARDS_SA_KEY inside the repo is also refused"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#resolveAdminAuth: a key outside the repo exchanges via getAccessTokenFn (datastore scope), no X-Goog-User-Project"
        status: pass
      - kind: unit
        ref: "test/unit/boards-admin.test.js#runCommand: a --key path inside the repo is refused with exit 2"
        status: pass
      - kind: other
        ref: "grep -c getAccessToken tools/boards-admin.mjs (>=1), grep -c X-Goog-User-Project tools/boards-admin.mjs (>=1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/LEADERBOARDS.md is the single ops runbook covering deploys, the rules, the 19 composite indexes, identity, the queue/backfill, live setup and API key restriction (the non-additive gcloud --api-target gotcha), the SEASON bump, Spark quotas, moderation with every boards-admin.mjs command, the kill switch, a section-14 placeholder for 83-08's live results, and troubleshooting; .gitignore ignores ddr-boards*.json and boards-export*"
    requirement: SRV-07
    verification:
      - kind: other
        ref: "node -e check for the 10 required section headings + securetoken.googleapis.com + daysKey — exit 0"
        status: pass
      - kind: other
        ref: "grep -c boards-export .gitignore == 1; grep -c ddr-boards .gitignore == 1; grep -c boards-admin docs/LEADERBOARDS.md == 18 (>=5 required); git check-ignore -q boards-export-test.csv exits 0"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-28
status: complete
---

# Phase 83 Plan 05: Admin Tooling & the Leaderboard Ops Runbook Summary

**tools/boards-admin.mjs (top/suspicious/delete-run/ban/unban/export, authenticated exactly like the bug-report filer) plus docs/LEADERBOARDS.md as the single ops runbook, fully delivering SRV-07 in this one plan.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 edited)

## Accomplishments

- `tools/boards-admin.mjs` is a dev-only, zero-new-dependency admin CLI over the `runs`/`banned` collections: `top` (any rank stat, season-scoped by default, race/sub filters, limit clamped 1–50, reusing `runDoc.js#topTenQuery`), `suspicious` (`scoreSuspicious` — days/floor and kills/steps outliers against overridable `SUSPICIOUS_DEFAULTS`, a name not composable from `content/names.js` via `isRolledName`, and an epitaph matching no `content/epitaphs.js` template for its cause via `isBankedEpitaph`'s template-to-regex approach), `delete-run`/`ban`/`unban` (dry runs printing exactly what would change unless `--yes`), and `export` (CSV or JSON of every `RUN_DOC_FIELDS` value, filterable by `--version`/`--season`(default current)/`--all-seasons`/`--since`/`--until`, refusing an in-repo `--out` not named `boards-export*`).
- Auth (`resolveAdminAuth`) mirrors `tools/bug-reports/file-issues.mjs` exactly: with no `--key`, the developer's own `gcloud auth print-access-token` (adding `X-Goog-User-Project`); with `--key`/`DDR_BOARDS_SA_KEY` pointing outside the repository, a service-account JWT exchange via the reused `getAccessToken` (datastore scope). A key path resolving inside the repository is refused with exit 2 before it is ever read, and its path/contents are never printed anywhere.
- `createAdminApi` provides the REST surface (`query`/`listAll`/`getRun`/`deleteRun`/`runsOf`/`deleteRunsOf`/`setBan`/`clearBan`) every command runs on; `deleteRunsOf` deletes through the single-document admin `DELETE /runs/{id}` endpoint in waves of up to 100 concurrent requests rather than a `:commit` batch — see Deviations.
- All 34 tests in `test/unit/boards-admin.test.js` drive `runCommand` against `src/browser/fakeBoardServer.js`'s admin-token contract, including a real sign-up → submit → ban → refused-resubmit → unban → resubmit round trip proving the ban rule end to end, and every `export` filter combination (version, season default vs. `--all-seasons`, inclusive `since`/`until` UTC days, the `--out` in-repo-naming refusal).
- `docs/LEADERBOARDS.md` is the single 15-section ops runbook (what the board is, the request path with a file/job table, the full run-document field/bound table and the four rank-key formulas with the Phase 82 DAYS rule quoted from `docs/DAYS-FARMING.md`, the rules including the owner handle-only update exception, the 19 composite indexes, deploying, identity, the queue/backfill, live setup and the non-additive `gcloud services api-keys update --api-target` gotcha, the SEASON bump, Spark quotas, moderation with every `boards-admin.mjs` command and examples, the kill switch, a section-14 placeholder left for 83-08's live results, and troubleshooting) plus two new `.gitignore` lines (`ddr-boards*.json`, `boards-export*`).

## Task Commits

Each task was committed atomically:

1. **Task 1: tools/boards-admin.mjs — top, suspicious, delete-run, ban, unban, export** - `ece6b141` (feat)
2. **Task 2: docs/LEADERBOARDS.md runbook and the .gitignore guards** - `2cec586d` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tools/boards-admin.mjs` - `parseArgs`, `resolveAdminAuth`, `createAdminApi`, `SUSPICIOUS_DEFAULTS`, `scoreSuspicious`, `isRolledName`, `isBankedEpitaph`, `filterExport`, `toCsv`, `runCommand`, a guarded `main`
- `test/unit/boards-admin.test.js` - parseArgs, both auth paths, the in-repo key refusal, top (order/clamp/filter), suspicious (all four reasons, threshold overrides), delete-run (dry run/--yes/not-found), ban/unban (full round trip through the fake's commit path, dry run), export (CSV/JSON, every filter, `--out` naming refusal), `createAdminApi` direct round trip, `filterExport`/`toCsv` direct, module-import-is-side-effect-free
- `docs/LEADERBOARDS.md` - the 15-section ops runbook
- `.gitignore` - `ddr-boards*.json`, `boards-export*`

## Decisions Made

- `deleteRunsOf` uses the single-document admin `DELETE /runs/{id}` endpoint (chunked in waves of ≤100 concurrent requests) instead of the plan action text's literal "`:commit` deletes in batches of at most 100" — see Deviations below.
- `cmdTop` reuses `runDoc.js#topTenQuery` (per the plan's own "Use runDoc.js's topTenQuery for top" instruction) and so defaults to the current `SEASON`, with a `--season`/`--all-seasons` override mirroring `export`'s own season semantics, since the plan's behavior spec is silent on `top`'s season scoping but every sibling command defaults to the current season.
- `isBankedEpitaph`/`isRolledName` are heuristics feeding `suspicious` only — never a hard validation gate — and an empty epitaph is treated as never a match by both functions (mirroring `scoreSuspicious`'s own "a non-empty epitaph" wording).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `deleteRunsOf` cannot use a `:commit` batch against the admin token as literally specified**
- **Found during:** Task 1, first TDD run of the ban/unban and `createAdminApi` round-trip tests
- **Issue:** The plan's action text asks for `deleteRunsOf(uid)` to delete "in batches of at most 100" via a `:commit` body (mirroring `deleteCommit`'s shape). `src/browser/fakeBoardServer.js` (built in 83-04, this plan's own required test double) explicitly scopes the admin token's `:commit` bypass to run **create** only — its `validateRunDeleteWrite` requires `authKind === "user"` and ownership, denying a `:commit`-based delete even for `FAKE_ADMIN_TOKEN` (documented as a deliberate choice in `83-04-SUMMARY.md`'s own key-decisions: "commit-based handle-update or delete... stay owner-only even for the admin token"). A literal implementation would make `ban --yes` silently fail to delete any runs against the required fake.
- **Fix:** `deleteRunsOf` now calls the single-document admin `DELETE /runs/{id}` endpoint (which the fake genuinely admin-bypasses, no ownership check) once per run id, in waves of up to 100 concurrent requests via `Promise.all` chunks — preserving the "at most 100 at a time" shape without using a Write the admin `:commit` path would refuse. This is also the more conservative choice against the **live** project: Google Cloud IAM access bypasses `firestore.rules` for any endpoint, so a `:commit` batch would in fact work live, but the single-document form works identically live and is the only form this plan's own test fixture can prove.
- **Files modified:** `tools/boards-admin.mjs` (the `deleteRunsOf` function and its comment)
- **Verification:** `test/unit/boards-admin.test.js#ban --yes writes banned/<uid>, deletes every run of that uid...` and `#createAdminApi: ...round-trip` both pass, proving a real signed-up uid's runs are actually deleted through `ban`.
- **Committed in:** `ece6b141` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix is required for `ban`'s core promise ("deletes every run of that uid") to work at all against this plan's own required fake; the live-project behavior is unaffected (both forms are IAM-bypassed there) and the runbook's moderation section (12) documents the resulting command exactly as it behaves. No scope creep.

## Issues Encountered

One test-authoring bug was caught and fixed during Task 1's own TDD loop before its commit: the test helper `submitRun` initially posted to the Firestore `:commit` endpoint without the `?key=` query parameter — `fakeBoardServer.js` requires the public API key on every non-admin request (`auth.kind !== "admin" && query.get("key") !== config.apiKey`), so every ban/unban/`createAdminApi` round-trip test failed with a 400 `INVALID_ARGUMENT` until the helper was corrected. Caught immediately by the first full test run; not a `boards-admin.mjs` bug.

## User Setup Required

None - no external service configuration required. This plan is pure dev tooling and documentation, exercised entirely against `src/browser/fakeBoardServer.js`; no real admin calls and no deploys (per the plan's own run notes — live setup is 83-08's job).

## Next Phase Readiness

- `tools/boards-admin.mjs` is ready for 83-07's `tools/boards-smoke.mjs` to reference (or for hand use) and for 83-08 to exercise live once the project is provisioned.
- `docs/LEADERBOARDS.md` section 14 ("Filled in by 83-08.") is the exact placeholder 83-08 fills in with the live setup record (rules/indexes deployed, anonymous sign-in confirmed, the key restricted, the per-IP limit set, `tools/boards-smoke.mjs` passed).
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/boards-admin.test.js` — 34 pass, 0 fail. `node tools/boards-admin.mjs help` exits 0 with no network. `grep -c "getAccessToken" tools/boards-admin.mjs` = 8, `grep -c "X-Goog-User-Project" tools/boards-admin.mjs` = 2 (both ≥1). `docs/LEADERBOARDS.md` section-heading + content check exits 0. `grep -c "boards-export" .gitignore` = 1, `grep -c "ddr-boards" .gitignore` = 1, `grep -c "boards-admin" docs/LEADERBOARDS.md` = 18 (≥5). `git check-ignore -q boards-export-test.csv` and `ddr-boards-sa.json` both exit 0.
**Full suite (`npm test`, once at plan close):** 8200 tests, 8198 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable surface (a dev-only CLI tool and a documentation file, no UI, nothing deployed).

## Requirement coverage note

This plan's frontmatter lists `SRV-07`, which — unlike every other Phase 83 plan's requirement IDs — is **not** shared with any later plan in this phase; the plan's own objective text states it fully: "an admin script lists suspicious runs and deletes one run or every run of one player; its key never enters the repo or www/; an ops runbook covers deploys, console settings, quotas and moderation." Both halves (the tool and the runbook) are delivered and unit-proven here, so `SRV-07` is marked complete in `REQUIREMENTS.md`.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-28*

## Self-Check: PASSED

All created files found on disk (`tools/boards-admin.mjs`, `test/unit/boards-admin.test.js`, `docs/LEADERBOARDS.md`, `.planning/phases/83-leaderboard-server/83-05-SUMMARY.md`); both task commits (`ece6b141`, `2cec586d`) found in git log.
