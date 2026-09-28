# Phase 83: Leaderboard Server - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up our own leaderboard on Firebase (Spark project `delve-die-repeat-6ba5f`, the same one as the Phase 79.3 bug reports) and the pure client modules that talk to it: the Firestore run table and its rules + indexes, an anonymous identity over the Firebase Auth REST API, rolled @handles, the submission queue, the board-read client (top ten / count / rank), an admin/moderation script, an ops runbook, and a live end-to-end smoke test. NO Firebase SDK in the app (plain `fetch`, injected). This phase builds and proves the modules and the live backend; wiring them into the shell (panel = Phase 84; submission at death, ☰ account rows, Play Games removal = Phase 85) is out of scope. Engine untouched, zero parity fixtures.

</domain>

<decisions>
## Implementation Decisions

### The run document
- Collection `runs`, doc id `{uid}_{runHash}` (runHash = engine/death.js RunSummary `hash`). Resubmitting the same run is idempotent: a create that finds the doc already there is treated as acknowledged.
- Fields: `uid`, `handle`, `season`, `name`, `race`, `sub`, `cls`, `level`, `floor`, `day`, `steps`, `kills`, `gold`, `sp`, `cause`, `epitaph`, `hash`, `version` (app version string, e.g. "2.2.0 (12)"), `createdAt` (server time), `seed` and `acts` (from the RunSummary), plus the four integer rank keys below.
- **Balance tracking (user, 2026-09-28):** "should we put the date and version on the leaderboard entries? At least for now to help us track data about balance and such." Every run doc carries `createdAt`, `version`, `season`, `seed` and `acts`, and `tools/boards-admin.mjs` gains an `export` command (CSV/JSON of runs, filterable by version/season/date) so balance can be read per build. Whether the date/version also SHOW in the panel's expanded row is Phase 84's call. No free text other than the rolled hero name, the content-bank epitaph and the rolled handle.
- One integer rank key per stat, stored on the doc, so every board query is a single `orderBy` and rank = count(key > mine) + 1:
  - `deepKey`: floor desc, then fewer steps (e.g. floor × 1,000,000 + (999,999 − min(steps, 999,999))).
  - `daysKey`: the Phase 82 rule — `min(day, 10 × floor)` desc, ties by floor desc (e.g. min(day, 10×floor) × 1,000 + floor). The displayed value stays the true `day`. Source: docs/DAYS-FARMING.md "## The DAYS rule".
  - `killsKey`: kills desc, ties by floor desc (e.g. kills × 1,000 + floor).
  - `goldKey`: gold desc.
  - Exact encodings are at the planner's/researcher's discretion as long as they are exact integers within Firestore's int64 range, monotone in the mock's sort order, and verified by the rules.
- Every doc stores `season`; the board shows the current `content/season.js` SEASON only (no season picker — matches the mock). Bumping SEASON later starts a fresh board.
- Start-at-depth dev runs (`state.dev`) are never submitted. The browser dev loop (non-native) uses an in-memory fake server (as createFakePlayGames did); Android debug and release builds both talk to the live board.

### Identity & the @handle
- Anonymous Firebase identity via REST (`accounts:signUp` + securetoken refresh), created lazily on the first Compete-ON submission; board reads are public and need no auth. uid + refresh token (+ cached id token/expiry) live in durable storage under `ddr.identity.v1` (separate from settings), through src/browser/storage.js.
- Handle: `@` + two words from dungeon-flavoured tables in a new `content/handles.js` (e.g. `@lanternjaw`); a test proves every combination clears `content/safety-wordlist.js`. Rolled locally (shell-side randomness, never the engine rng) the first time it is needed, so it exists offline before any network call.
- Unlimited re-roll. A re-roll rewrites `handle` on all of the player's existing runs — the rules allow the owner to update ONLY the `handle` field of their own runs — so a player stays one name on the board.
- Erasing your runs (Phase 85 UI) = owner deletes all their runs, then `ddr.identity.v1` is dropped; the rules must allow owner delete now.

### Cheating & moderation
- Rules = exact shape + plausibility: exact field set and types; race/sub/cls/cause from the known lists; `season == SEASON` (a rules constant — bumping SEASON needs a rules deploy; note it in the runbook); each rank key equals its formula; bounds (floor 1–200, level bounded, kills ≤ steps, day ≤ steps/100 + a camp allowance the researcher/planner sizes, gold ≤ 10,000,000, string length caps); `createdAt == request.time`; `uid == request.auth.uid` and doc id == uid + "_" + hash; list reads bounded (limit ≤ 50). A JS mirror of the rules (like bugReport.js#validateReport) kept equal to firebase/firestore.rules by tests; the client never builds a doc the rules would refuse.
- A `banned/{uid}` collection checked in the create rule (`!exists(...)`); only the admin service account writes it.
- `tools/boards-admin.mjs` (dev-only, service-account/gcloud auth like the bug-report tooling; the key never enters the repo or www/): `top`, `suspicious` (days/floor and kills/steps outliers), `delete-run`, `ban` (ban + delete that uid's runs).
- Full replay verification: deferred (REQUIREMENTS Future).
- The bug-report rules and the catch-all deny must keep working; extend firebase/firestore.rules, don't replace it.

### Queue, backfill & live setup
- Queue `ddr.runQueue.v1`: enqueue on death (non-dev, Compete ON); flush on enqueue, on app resume and on `online`; exponential backoff; a rules rejection (400/403 permission/validation) drops that entry with a log line; "already exists" = acknowledged; 15 s timeouts; never double-submits; `purge()` for Compete OFF. Pure, DOM-free, injected fetch/storage/clock (the bugReport.js pattern).
- Backfill: once, on the first Compete-ON launch after this update, enqueue the player's locally recorded season-1 runs (from `ddr.bests.v1` / the graveyard records that carry a valid hash) so the board is not empty on day one (the user's ghost-town complaint). The module + a `backfillDone` flag live here; the shell call site is wired in Phase 85.
- Board reads: `topTen(stat, race, sub)`, `total(stat, race, sub)` and `rankOf(stat, key, race, sub)` over REST `runQuery` / `runAggregationQuery` count; cached per (stat, race, sub) for 5 minutes; a stale copy is returned (flagged stale) when a refresh fails. Declared composite indexes (`firestore.indexes.json`) cover season + optional race/sub equality + each rank key.
- One shared config module (e.g. `src/browser/firebaseConfig.js`) holding the project id + public API key, reused by bug reports (retire the duplicate in bugReportConfig.js or re-export from it).
- Live setup is done by Claude, not the user: deploy rules + indexes with the logged-in Firebase CLI (`firebase deploy --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f`; add `firestore.indexes` to firebase.json); add the Identity Toolkit API + Token Service API to the existing API key's API restrictions with gcloud (keep Firestore; nothing else); enable the Anonymous sign-in provider via the Identity Toolkit admin API (gcloud access token). Fall back to user console steps only if a call is refused. Then a node smoke test (`tools/boards-smoke.mjs`) against the live project: anonymous sign-up → create a run → read top ten → count/rank → handle update → owner delete, cleaning up after itself.
- Runbook `docs/LEADERBOARDS.md`: deploys, the SEASON bump + rules constant, key restrictions, Spark quotas, moderation with boards-admin, the kill switch.

### Claude's Discretion
- Module names/split (e.g. firebaseAuth.js, boardClient.js, runQueue.js, runDoc.js, handles), REST request shapes, backoff constants, the index list details, the camp allowance in the day bound, test file layout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/bugReport.js` + `src/browser/bugReportConfig.js`: the REST + injected fetchFn + timeout + REPORT_REASONS pattern; `toFirestoreFields` typed-value encoder; `validateReport` JS mirror of the rules.
- `firebase/firestore.rules` (bugReports create-only + catch-all deny), `test/unit/firestore-rules.test.js` (keeps rules ≡ JS mirror), `firebase.json`/`.firebaserc` (CLI logged in as the user; `firebase` 15.29 and `gcloud` installed).
- `src/browser/storage.js`: async durable storage (Preferences native / localStorage dev) with per-key write chains and flush().
- `engine/death.js#buildRunSummary` (RunSummary fields incl. season, seed, acts, hash), `engine/records.js` (runHash, isValidHash, bests record, sanitizeBests), `content/season.js` (SEASON = 1), `content/safety-wordlist.js`, `content/epitaphs.js` (cause keys), `content/races.js`, `content/classes.js`.
- `src/browser/pgsQueue.js`: the existing durable queue (pure record ops, fails/backoff ordering) — a model for runQueue, but it is deleted in Phase 85; do not import it.
- docs/BUG-REPORTS.md: how rules were deployed, the service account (ddr-bug-reports, roles/datastore.user), key rotation with gcloud.

### Established Patterns
- Pure DOM-free modules with injected fetch/storage/clock; frozen return values; never throw; results are ok | reason ids (copy lives in content/ and is Phase 84/85's job).
- Tests via `node --test`; no network in unit tests (fake fetch).

### Integration Points
- Phase 84's panel reads through the board client; Phase 85 wires the queue at death, the ☰ handle/Compete rows, erase, and backfill at boot.

</code_context>

<specifics>
## Specific Ideas

- The user's reason for the milestone: Play Games' private-by-default profiles made the global boards a ghost town — public-by-default boards (Compete as the opt-out) and the backfill address that directly.
- DAYS rule from Phase 82: `daysKey = min(day, 10 * floor)`, ties by floor; display the true day.

</specifics>

<deferred>
## Deferred Ideas

- Replay verification of top runs (seed + action log) by a scheduled job.
- Firebase App Check (needs a native SDK).
- A season picker for older seasons.

</deferred>
