# Phase 83: Leaderboard Server - Research

**Researched:** 2026-09-28
**Domain:** Firebase Firestore + Firebase Auth (anonymous) reached with plain REST (`fetch`), Google Cloud gcloud/API-key administration, Firestore security rules
**Confidence:** MEDIUM (HIGH on everything already proven by this repo's own `bugReport.js`/`firestore.rules`/`file-issues.mjs` precedent; MEDIUM on Google's REST/rules/gcloud surfaces verified this session by docs + search cross-checks; a few gcloud/Identity-Platform edge cases are LOW and flagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The run document**
- Collection `runs`, doc id `{uid}_{runHash}` (runHash = engine/death.js RunSummary `hash`). Resubmitting the same run is idempotent: a create that finds the doc already there is treated as acknowledged.
- Fields: `uid`, `handle`, `season`, `name`, `race`, `sub`, `cls`, `level`, `floor`, `day`, `steps`, `kills`, `gold`, `sp`, `cause`, `epitaph`, `hash`, `version` (app version string), `createdAt` (must equal `request.time`), plus four integer rank keys. No free text other than the rolled hero name, the content-bank epitaph and the rolled handle.
- One integer rank key per stat, stored on the doc, so every board query is a single `orderBy` and rank = count(key > mine) + 1:
  - `deepKey`: floor desc, then fewer steps.
  - `daysKey`: the Phase 82 rule — `min(day, 10 × floor)` desc, ties by floor desc. The displayed value stays the true `day`. Source: docs/DAYS-FARMING.md "## The DAYS rule".
  - `killsKey`: kills desc, ties by floor desc.
  - `goldKey`: gold desc.
  - Exact encodings are at the planner's/researcher's discretion as long as they are exact integers within Firestore's int64 range, monotone in the mock's sort order, and verified by the rules.
- Every doc stores `season`; the board shows the current `content/season.js` SEASON only (no season picker). Bumping SEASON later starts a fresh board.
- Start-at-depth dev runs (`state.dev`) are never submitted. The browser dev loop (non-native) uses an in-memory fake server; Android debug and release builds both talk to the live board.

**Identity & the @handle**
- Anonymous Firebase identity via REST (`accounts:signUp` + securetoken refresh), created lazily on the first Compete-ON submission; board reads are public and need no auth. uid + refresh token (+ cached id token/expiry) live in durable storage under `ddr.identity.v1` (separate from settings), through `src/browser/storage.js`.
- Handle: `@` + two words from dungeon-flavoured tables in a new `content/handles.js`; a test proves every combination clears `content/safety-wordlist.js`. Rolled locally (shell-side randomness, never the engine rng) the first time it is needed, so it exists offline before any network call.
- Unlimited re-roll. A re-roll rewrites `handle` on all of the player's existing runs — the rules allow the owner to update ONLY the `handle` field of their own runs.
- Erasing your runs (Phase 85 UI) = owner deletes all their runs, then `ddr.identity.v1` is dropped; the rules must allow owner delete now.

**Cheating & moderation**
- Rules = exact shape + plausibility: exact field set/types; race/sub/cls/cause from the known lists; `season == SEASON` (a rules constant); each rank key equals its formula; bounds (floor 1–200, level bounded, kills ≤ steps, day ≤ steps/100 + a camp allowance the researcher/planner sizes, gold ≤ 10,000,000, string length caps); `createdAt == request.time`; `uid == request.auth.uid` and doc id == uid + "_" + hash; list reads bounded (limit ≤ 50). A JS mirror of the rules kept equal to `firebase/firestore.rules` by tests; the client never builds a doc the rules would refuse.
- A `banned/{uid}` collection checked in the create rule (`!exists(...)`); only the admin service account writes it.
- `tools/boards-admin.mjs` (dev-only, service-account/gcloud auth like the bug-report tooling; key never enters the repo or `www/`): `top`, `suspicious` (days/floor and kills/steps outliers), `delete-run`, `ban` (ban + delete that uid's runs).
- Full replay verification: deferred (REQUIREMENTS Future).
- The bug-report rules and the catch-all deny must keep working; extend `firebase/firestore.rules`, don't replace it.

**Queue, backfill & live setup**
- Queue `ddr.runQueue.v1`: enqueue on death (non-dev, Compete ON); flush on enqueue, on app resume and on `online`; exponential backoff; a rules rejection (400/403 permission/validation) drops that entry with a log line; "already exists" = acknowledged; 15 s timeouts; never double-submits; `purge()` for Compete OFF. Pure, DOM-free, injected fetch/storage/clock (the bugReport.js pattern).
- Backfill: once, on the first Compete-ON launch after this update, enqueue the player's locally recorded season-1 runs (from `ddr.bests.v1` / graveyard records that carry a valid hash). Module + `backfillDone` flag live here; shell call site wired in Phase 85.
- Board reads: `topTen(stat, race, sub)`, `total(stat, race, sub)` and `rankOf(stat, key, race, sub)` over REST `runQuery` / `runAggregationQuery` count; cached per (stat, race, sub) for 5 minutes; a stale copy is returned (flagged stale) when a refresh fails. Declared composite indexes (`firestore.indexes.json`) cover season + optional race/sub equality + each rank key.
- One shared config module (e.g. `src/browser/firebaseConfig.js`) holding the project id + public API key, reused by bug reports (retire the duplicate in `bugReportConfig.js` or re-export from it).
- Live setup is done by Claude, not the user: deploy rules + indexes with the logged-in Firebase CLI; add the Identity Toolkit API + Token Service API to the existing API key's restrictions with gcloud (keep Firestore; nothing else); enable the Anonymous sign-in provider via the Identity Toolkit admin API (gcloud access token). Fall back to user console steps only if a call is refused. Then a node smoke test (`tools/boards-smoke.mjs`) against the live project: anonymous sign-up → create a run → read top ten → count/rank → handle update → owner delete, cleaning up after itself.
- Runbook `docs/LEADERBOARDS.md`: deploys, the SEASON bump + rules constant, key restrictions, Spark quotas, moderation with boards-admin, the kill switch.

### Claude's Discretion
- Module names/split (e.g. `firebaseAuth.js`, `boardClient.js`, `runQueue.js`, `runDoc.js`, `handles.js`), REST request shapes, backoff constants, the index list details, the camp allowance in the day bound, test file layout.

### Deferred Ideas (OUT OF SCOPE)
- Replay verification of top runs (seed + action log) by a scheduled job.
- Firebase App Check (needs a native SDK).
- A season picker for older seasons.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRV-01 | Each finished Compete-ON run stored once (owner id, handle, season, hero fields, run hash, app version); resubmit never duplicates | Run-document shape (`## Standard Stack` → run doc), idempotent create via `documentId=` POST + 409 ALREADY_EXISTS (`## Code Examples`, `## Common Pitfalls` Pitfall 1) |
| SRV-02 | Rules: owner-only create, exact shape + plausibility bounds, JS mirror kept equal by tests, bounded list reads, owner/admin delete only, everything else denied | `## Architecture Patterns` Pattern 2 (rules), `## Common Pitfalls` Pitfalls 1–4, existing `firestore-rules.test.js` pattern to extend |
| SRV-03 | Four stats × race/sub filters × season: top ten, total, rank; ties per the mock; DAYS per FARM-02; declared composite indexes | `## Architecture Patterns` Pattern 1 (rank-key doc design), `## Code Examples` (runQuery/runAggregationQuery), `## Common Pitfalls` Pitfall 5 (index coverage) |
| SRV-04 | Anonymous Firebase identity via REST, durable storage, token refresh; zero network with Compete OFF | `## Code Examples` (accounts:signUp, securetoken refresh), `## Common Pitfalls` Pitfall 6 (clock skew) |
| SRV-05 | Rolled @handle from `content/` word tables, passes `content/safety-wordlist.js` by construction, re-rollable | `## Don't Hand-Roll` (reuse safety-wordlist test pattern), `content/handles.js` design note in `## Architecture Patterns` |
| SRV-06 | Durable submission queue: survives relaunch/offline, backoff, never double-submits, discarded on Compete OFF | `## Architecture Patterns` Pattern 3 (queue), reuses `bugReport.js`'s injected-fetch/never-throw shape; `pgsQueue.js` as a structural (not import) model |
| SRV-07 | Admin script (top/suspicious/delete/ban), key never in repo/www/, ops runbook | `## Code Examples` (service-account JWT auth, same as `tools/bug-reports/file-issues.mjs`), `## Architecture Patterns` Pattern 4 |
| SRV-08 | Live project configured + proven end to end: rules/indexes deployed, anonymous sign-in enabled, API key restricted, smoke test | `## Common Pitfalls` Pitfall 7 (Identity Toolkit admin API + gcloud), `## Environment Availability`, `## Code Examples` (gcloud commands) |
</phase_requirements>

## Summary

This phase extends a pattern the repo already ships and has proven live: `src/browser/bugReport.js` + `firebase/firestore.rules` + `tools/bug-reports/file-issues.mjs` is a working, no-SDK, plain-`fetch` Firestore REST client with a JS-mirror-kept-equal-to-rules contract test and a service-account-authenticated admin/filer script. Phase 83 is the same shape, three times over: (1) a `runs` collection instead of `bugReports`, with four integer rank keys computed client-side and verified server-side by the rules so every board query is a single `orderBy` + optional equality filter; (2) an anonymous Firebase Auth identity (new — bug reports needed no auth) reached via `identitytoolkit.googleapis.com/v1/accounts:signUp` and refreshed via `securetoken.googleapis.com/v1/token`; (3) live project administration (enabling the anonymous provider, restricting the API key, deploying indexes) done via `gcloud` instead of the Firebase Console, mirroring how the bug-report service account was provisioned.

The one genuinely new technical wrinkle CONTEXT.md flags is `createdAt == request.time`: Firestore's simple `documents:createDocument?documentId=…` REST endpoint (what `bugReport.js` uses) cannot set a field to the server's timestamp — only the SDK's `serverTimestamp()` sentinel can, and that sentinel is itself just syntactic sugar over a `:commit` request carrying a `transform` Write (`fieldTransforms: [{fieldPath, setToServerValue: "REQUEST_TIME"}]`) alongside an `update` Write. To get both idempotent-create semantics (still needed for SRV-01's "resubmit never duplicates") and a true server timestamp, the run-submission client must use `:commit` with two Writes: an `update` Write (fields minus `createdAt`) carrying a `currentDocument.exists: false` precondition, plus a `transform` Write setting `createdAt` to `REQUEST_TIME`. A failed precondition surfaces as **HTTP 400** (not the simpler endpoint's 409), which changes how `runQueue.js` must classify "already submitted" vs. a genuine validation failure — documented as Pitfall 1 below.

The second load-bearing finding: Firestore's rules language has no `math.min`/`math.max` (confirmed absent from the documented `math` namespace — only `abs`, `ceil`, `floor`, `isInfinite`, `isNaN`, `pow`, `round`, `sqrt`). `daysKey == min(day, 10*floor)*1000 + floor` must be written as a ternary/boolean expression in the rules (`d.day < 10*d.floor ? d.day*1000+d.floor : (10*d.floor)*1000+d.floor`), which is exactly the kind of drift risk the existing `test/unit/firestore-rules.test.js` contract-test pattern exists to catch — extend it, don't hand-roll a parallel checker.

Third: aggregation `count()` queries use the *same* composite index as the equivalent `orderBy` query (confirmed via docs), so the four rank-key indexes (season [+ race] [+ sub] + rankKey) each serve all three reads (`topTen` orderBy, `total` pure-equality count, `rankOf` count with a `rankKey > x` range filter) — no extra indexes are needed for the count queries, only the four (or up to sixteen, with race/sub combinations) `orderBy`-shaped composite indexes already required for `topTen`.

**Primary recommendation:** Extend, don't replace, the bug-report REST/rules/tooling pattern. Use `documentId=`-POST create for the common case and drop down to `:commit` (transform + update-with-precondition) only for the `createdAt == request.time` requirement. Enable the anonymous provider and restrict the API key with `gcloud`/`curl` against the Identity Toolkit admin v2 API, falling back to Console only if a call is refused (Identity Platform admin-API applicability to a stock, non-upgraded Firebase Auth project is the one LOW-confidence item in this research — see Open Questions).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run persistence (create-once, idempotent) | Database / Storage (Firestore) | Browser/Client (`runDoc.js` builds the payload) | Firestore owns durability + the create-only/dedup guarantee via rules + document-id collision; the client only shapes and sends the document — exactly the `bugReport.js` split already in this codebase |
| Rules-side validation & moderation | Database / Storage (Firestore security rules) | — | Rules are the only server-side code this Spark, no-Cloud-Functions project has; every plausibility/shape check MUST live there, mirrored (not re-implemented differently) in a client-side JS function |
| Board reads (top ten / count / rank) | Browser/Client (REST `fetch` from the WebView) | Database / Storage (Firestore composite indexes) | No backend to proxy reads through (no SDK constraint); the client calls Firestore REST directly, and the indexes are what make each read cheap |
| Anonymous identity + token lifecycle | Browser/Client (`firebaseAuth.js`) | Database / Storage (Identity Toolkit / securetoken as the identity provider) | The client owns the uid/refresh-token/id-token lifecycle in durable storage; Google's Identity Toolkit is the external identity provider, reached the same way Firestore is — plain REST, no SDK |
| Submission durability (queue, retry, backoff) | Browser/Client (`runQueue.js`) | — | No server-side queue exists (Spark, no Cloud Tasks); the client is the only place a "hasn't been acknowledged yet" run can live, exactly like `pgsQueue.js`'s structural precedent |
| Moderation / admin actions (ban, delete, list suspicious) | CDN/Static-adjacent dev tooling (`tools/boards-admin.mjs`, Node CLI, never shipped in `www/`) | Database / Storage (Firestore, reached via service-account IAM bypassing rules) | Mirrors `tools/bug-reports/file-issues.mjs`: a Node script with a service-account JWT, not a web tier, since there is no hosted backend in this project |
| Live project configuration (enable anon provider, restrict API key, deploy rules/indexes) | Google Cloud control plane (`gcloud`, Firebase CLI) | — | One-time/rare operational task, done from a developer machine against Google's admin APIs — not part of the shipped app at any tier |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase CLI | 15.29.0 (installed, confirmed this session) | `firebase deploy --only firestore:rules,firestore:indexes` | Already the repo's deploy path for `firestore.rules` (docs/BUG-REPORTS.md §4); add `firestore.indexes` to `firebase.json` [VERIFIED: local `firebase --version` output] |
| Google Cloud SDK (`gcloud`) | 579.0.0 (installed, confirmed this session) | Enable anonymous provider, restrict API key, sign service-account JWTs for `boards-admin.mjs` | Already used for the bug-report service account (`docs/BUG-REPORTS.md` §7); no new install needed [VERIFIED: local `gcloud --version` output] |
| Node.js built-ins (`fetch`, `crypto`, `URLSearchParams`) | Node 22.23.2 (installed) | All REST calls, JWT signing for `tools/boards-admin.mjs`/`tools/boards-smoke.mjs` | Matches `tools/bug-reports/file-issues.mjs`'s zero-npm-install pattern exactly; `.claude/CLAUDE.md`'s "zero-runtime-dep" constraint forbids adding an SDK anyway [VERIFIED: codebase precedent] |
| Firestore REST API v1 (`firestore.googleapis.com/v1`) | current (no versioned client lib; REST is stable) | `documents:runQuery`, `documents:runAggregationQuery`, `documents:commit`, `documents/{collection}?documentId=` | Same base URL `bugReport.js` already uses (`FIRESTORE_BASE`); no SDK per `.claude/CLAUDE.md` | 
| Identity Toolkit REST API v1 (`identitytoolkit.googleapis.com/v1`) | current | `accounts:signUp` (anonymous sign-in) | The only way to get an anonymous Firebase identity without the Firebase Auth SDK [CITED: firebase.google.com/docs/reference/rest/auth] |
| Secure Token REST API v1 (`securetoken.googleapis.com/v1`) | current | `token` (refresh grant) | The documented REST refresh-token exchange, standard OAuth2 refresh grant shape [CITED: docs.cloud.google.com/identity-platform/docs/use-rest-api] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Identity Toolkit Admin API v2 (`identitytoolkit.googleapis.com/admin/v2`) | current | `PATCH .../config` with `updateMask=signIn.anonymous.enabled` — enable the anonymous provider without the Console | SRV-08's live setup step; requires an OAuth2 access token (`gcloud auth print-access-token`) with `cloud-platform` (or `firebase`/`identitytoolkit`) scope [CITED: docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig] |
| `gcloud services api-keys update` | ships with gcloud 579.0.0 | Add `identitytoolkit.googleapis.com` + `securetoken.googleapis.com` to the existing key's `--api-target` restrictions, keeping `firestore.googleapis.com` | Confirmed syntax: `gcloud services api-keys update KEY_ID --api-target=service=A --api-target=service=B --api-target=service=C` (repeatable flag; must list ALL services the key should allow, not just the new ones — verify this is additive-safe before running, see Pitfall 8) [CITED: docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/update] |
| `gcloud services api-keys lookup KEY_STRING` | ships with gcloud 579.0.0 | Resolve `bugReportConfig.js`'s existing key string to its `projects/*/locations/global/keys/KEY_ID` resource name, needed by `api-keys update` | [CITED: docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/lookup] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `documentId=`-POST create + separate `:commit` for the timestamped path | Always use `:commit` for every run create | Simpler (one code path) but loses the simple 409 ALREADY_EXISTS status classification `bugReport.js`'s pattern already handles cleanly; `:commit` precondition failures come back as 400, requiring `runQueue.js` to special-case them anyway — no net simplification, so this research recommends the two-Write `:commit` approach uniformly for run-create (see Pitfall 1), not a hybrid |
| Firestore Admin/Client SDKs for the admin script | `firebase-admin` npm package in `tools/boards-admin.mjs` | Rejected: `.claude/CLAUDE.md` and `docs/BUG-REPORTS.md`'s own precedent (`tools/bug-reports/file-issues.mjs`) keep tooling dependency-free with hand-signed service-account JWTs; adding `firebase-admin` here would be the first SDK dependency in the whole project and breaks the established convention |
| gcloud/API for enabling anonymous auth | Firebase Console UI | CONTEXT.md explicitly directs "Claude, not the user" to do this via API, falling back to Console only if a call is refused — this is a locked decision, not a discretion point |

**Installation:** No new packages. Firebase CLI and gcloud are already installed and authenticated on this machine (confirmed this session: `firebase --version` → 15.29.0, `gcloud --version` → Google Cloud SDK 579.0.0).

**Version verification:** Both CLIs verified installed and runnable this session (`firebase --version`, `gcloud --version`) [VERIFIED: local shell output]. No npm packages are added by this phase.

## Package Legitimacy Audit

No new npm packages are installed by this phase. Every module (`firebaseAuth.js`, `boardClient.js`, `runQueue.js`, `runDoc.js`, `handles.js`, `tools/boards-admin.mjs`, `tools/boards-smoke.mjs`) is authored in-repo using Node/browser built-ins (`fetch`, `crypto`, `URLSearchParams`, `AbortController`), exactly mirroring `src/browser/bugReport.js` and `tools/bug-reports/file-issues.mjs`. `.claude/CLAUDE.md`'s "zero-runtime-dep" / no-SDK constraint and the milestone's REQUIREMENTS.md Gate ("No new client SDK... Nothing analytics-shaped is added") both forbid adding a package here.

**Packages removed due to [SLOP] verdict:** none (none proposed).
**Packages flagged as suspicious [SUS]:** none (none proposed).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   Android WebView (client)   │
                         │  (no Firebase SDK, plain     │
                         │   fetch, injected clock)     │
                         └───────────────┬───────────────┘
                                         │
     death (Compete ON, non-dev) ───────┤
                                         ▼
                         ┌─────────────────────────────┐
                         │ runQueue.js (ddr.runQueue.v1)│  enqueue on death
                         │ flush: on enqueue / resume /  │  survives relaunch
                         │        'online'; backoff       │  never double-submits
                         └───────────────┬───────────────┘
                                         │ flush
                                         ▼
              ┌────────────────────────────────────────────────┐
              │ firebaseAuth.js                                  │
              │  no uid yet?  → identitytoolkit:accounts:signUp   │──▶ Identity Toolkit
              │  id token expiring? → securetoken:token (refresh) │──▶ Secure Token API
              │  uid/refreshToken/idToken cached in                │
              │  ddr.identity.v1 (src/browser/storage.js)          │
              └───────────────────────┬────────────────────────┘
                                       │ Bearer idToken
                                       ▼
              ┌────────────────────────────────────────────────┐
              │ runDoc.js → builds run fields + 4 rank keys       │
              │ POST .../runs?documentId=uid_hash  (create-only)  │──▶ Firestore REST
              │   OR :commit [update+precond, transform=REQUEST_TIME]│  (documents:*)
              │ 409 / precondition-failed → "already exists" = ack │
              └───────────────────────┬────────────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │ firebase/firestore.rules      │  owner-create only,
                         │  (extends bugReports rules,    │  exact shape+bounds,
                         │   catch-all deny preserved)    │  public bounded list,
                         └───────────────┬───────────────┘  owner/admin delete
                                         │
                                         ▼
                         ┌─────────────────────────────┐
                         │  runs/{uid_hash} documents     │
                         │  (Firestore, Spark plan)        │
                         └───────────────┬───────────────┘
                                         │
      board panel reads (Phase 84) ─────┤                    admin ops (dev machine)
                                         ▼                              │
              ┌────────────────────────────────────┐        ┌──────────▼──────────┐
              │ boardClient.js                        │        │ tools/boards-admin   │
              │  topTen/total/rankOf via runQuery /    │        │  .mjs — service-      │
              │  runAggregationQuery, cached 5 min      │        │  account JWT bypasses │
              │  (season + race/sub composite indexes)  │        │  rules via IAM        │
              └────────────────────────────────────┘        └──────────────────────┘
```

### Recommended Project Structure
```
src/browser/
├── firebaseConfig.js   # shared project id + public API key (bugReportConfig.js re-exports or retires)
├── firebaseAuth.js      # anonymous signUp + securetoken refresh, ddr.identity.v1 lifecycle
├── runDoc.js            # buildRunPayload (fields + rank keys), validateRun (JS mirror of rules)
├── boardClient.js        # topTen/total/rankOf, 5-min cache, stale-on-failure
├── runQueue.js           # ddr.runQueue.v1: enqueue/flush/backoff/purge
└── handles.js  (content/) # word tables (in content/, not src/browser/, alongside other content banks)

firebase/
└── firestore.rules      # EXTENDED (bugReports rules untouched), new runs/{id} + banned/{uid} match blocks

firebase.json             # + "firestore": { "rules": "...", "indexes": "firestore.indexes.json" }
firestore.indexes.json    # NEW — composite indexes for the 4 rank keys × season × race × sub

tools/
├── boards-admin.mjs      # dev-only: top / suspicious / delete-run / ban (service-account JWT)
└── boards-smoke.mjs      # live E2E: signUp → create → topTen → count/rank → handle update → delete

docs/
└── LEADERBOARDS.md       # runbook: deploys, SEASON bump, key restrictions, quotas, moderation, kill switch

test/unit/
├── firestore-rules.test.js   # EXTENDED — keep runs rules == runDoc.js's validateRun mirror
├── runDoc.test.js
├── runQueue.test.js
├── boardClient.test.js
├── firebaseAuth.test.js
└── handles.test.js           # every handle combination clears content/safety-wordlist.js
```

### Pattern 1: Rank-key documents (precompute ranking, verify in rules)
**What:** Rather than querying/sorting client-side, each run document stores one pre-computed monotone integer per board stat (`deepKey`, `daysKey`, `killsKey`, `goldKey`). Every board query becomes a single `orderBy(rankKey desc)` (top ten), a `count()` with an equality-only filter (total), or a `count()` with `rankKey > mine` plus the same equality filters (rank = count + 1). The rules re-derive and check each key equals its formula, so a client can never lie about its own rank.
**When to use:** Any Firestore leaderboard where ranking depends on a multi-field tie-break (floor desc, steps asc, etc.) that Firestore's single-field `orderBy` can't express directly, and where you need `count()`-style rank without reading every row.
**Example (client-side key derivation, encoding choice at planner's discretion):**
```javascript
// Source: derived from the DAYS rule (docs/DAYS-FARMING.md) + SRV-03's tie-break spec.
// Example encoding — pack the tie-break into the low digits so a single
// integer orderBy sorts correctly. floor is bounded 1-200 (3 digits),
// so floor fits safely in the low 3 decimal digits of a JS-safe integer.
function deepKey(floor, steps) {
  const cappedSteps = Math.min(steps, 999_999);
  return floor * 1_000_000 + (999_999 - cappedSteps); // higher floor wins; fewer steps wins the tie
}
function daysKey(day, floor) {
  const capped = Math.min(day, 10 * floor); // Phase 82 "perFloorCap" rule
  return capped * 1000 + floor; // ties by floor desc
}
```
**Rules mirror (ternary, since rules has no math.min):**
```
// Source: Firestore rules `math` namespace docs list abs/ceil/floor/isInfinite/
// isNaN/pow/round/sqrt only — no min/max — so min() must be a ternary.
function expectedDaysKey(day, floor) {
  return (day < 10 * floor ? day : 10 * floor) * 1000 + floor;
}
```

### Pattern 2: Owner-create-only rules with exact-shape + plausibility bounds, extending the existing file
**What:** Add a `match /runs/{runId}` block and a `match /banned/{uid}` block to `firebase/firestore.rules` alongside the untouched `match /bugReports/{reportId}` block, keeping the same file's catch-all `match /{document=**} { allow read, write: if false; }` last. Owner-create only (uid == request.auth.uid AND doc id == uid+'_'+hash), a *separate* `allow update` limited to the `handle` field via `diff().affectedKeys().hasOnly(['handle'])`, `allow delete` for the owner or (via IAM bypass, not a rule) the admin service account, and `allow list` gated on `request.query.limit <= 50`.
**When to use:** Any additional Firestore collection in a Spark project with no Cloud Functions — this is the only place server-side validation logic can live.
**Example:**
```
// Source: pattern extends firebase/firestore.rules' existing isValidReport style.
match /runs/{runId} {
  allow create: if isOwnerCreate(runId, request.resource.data)
                && isValidRun(request.resource.data)
                && !exists(/databases/$(database)/documents/banned/$(request.auth.uid));
  allow update: if request.auth != null
                && resource.data.uid == request.auth.uid
                && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['handle'])
                && request.resource.data.handle is string
                && request.resource.data.handle.size() <= 40; // mirror handles.js bound
  allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
  allow get: if true;
  allow list: if request.query.limit <= 50;
}
match /banned/{uid} {
  allow read, write: if false; // admin service account bypasses via IAM, not a rule
}
```

### Pattern 3: Pure, DOM-free durable queue (reuse the `bugReport.js` shape, not `pgsQueue.js`'s code)
**What:** `runQueue.js` follows `bugReport.js`'s established conventions — injected `fetchFn`/`storage`/`clock`, never throws, frozen return shapes, results are `ok | reason-id` — layered with `pgsQueue.js`'s *structural* ideas (durable persisted array, backoff, flush triggers) without importing it (it is deleted in Phase 85).
**When to use:** Any at-least-once submission that must survive app relaunch and offline play.
**Example skeleton:**
```javascript
// Source: pattern from src/browser/bugReport.js's injected-dependency, never-throw convention.
export async function flushQueue(queue, { fetchFn, storage, now, online = true } = {}) {
  if (online === false) return { ok: false, reason: "offline" };
  const [head, ...rest] = queue;
  if (!head) return { ok: true, drained: true };
  const result = await submitRun(head, { fetchFn, now });
  if (result.ok || result.reason === "exists") {
    await storage.setItem("ddr.runQueue.v1", JSON.stringify(rest));
    return flushQueue(rest, { fetchFn, storage, now, online });
  }
  if (result.reason === "refused") {
    // rules rejection (400/403 validation/permission) — drop, log, keep going
    await storage.setItem("ddr.runQueue.v1", JSON.stringify(rest));
    return flushQueue(rest, { fetchFn, storage, now, online });
  }
  return { ok: false, reason: result.reason, remaining: queue.length }; // transient — retry later
}
```

### Pattern 4: Admin tooling authenticated exactly like `tools/bug-reports/file-issues.mjs`
**What:** `tools/boards-admin.mjs` signs its own service-account JWT (RS256, `datastore` scope, `urn:ietf:params:oauth:grant-type:jwt-bearer` grant) via `crypto.sign`, exchanges it at `https://oauth2.googleapis.com/token`, then calls Firestore REST with a `Bearer` token — zero SDK, zero new npm dependency, key read from a file path or env var, never the repo.
**When to use:** Any dev-only Node script needing elevated Firestore/GCP access outside the app's own runtime.
**Example:** See `tools/bug-reports/file-issues.mjs#signServiceAccountJwt`/`getAccessToken` (already in this repo) — `boards-admin.mjs` reuses this exact function shape with `roles/datastore.user` on a (new or reused) service account scoped to `delve-die-repeat-6ba5f`.

### Anti-Patterns to Avoid
- **Re-implementing a second Firestore typed-value encoder:** `toFirestoreFields`/`toFirestoreValue` already exist in `bugReport.js`. Export and reuse them (or move them to a shared module both `bugReport.js` and `runDoc.js` import) rather than writing a second encoder that could silently drift from the first.
- **Trusting client-supplied `createdAt`:** Only `request.time` (via the `:commit` transform pattern, Pitfall 1) gives a server-authoritative timestamp. A client Date string can be forged.
- **A single flat `day <= N` bound divorced from `steps`:** CONTEXT explicitly asks for `day <= steps/100 + camp-allowance` — a flat cap either rejects legitimate very-long honest runs or (if generous) does nothing to catch obviously-impossible doc forgeries (`day: 999999, steps: 5`).
- **One composite index per exact (stat, race, sub) tuple, 4 stats × 6 races × 24 subs = potentially hundreds of indexes:** Firestore composite indexes cover *combinations of fields*, not enumerated value combinations — one index per `(season, [race], [sub], rankKey)` **shape** (not per race/sub *value*) suffices; a query for `race == "Elven"` reuses the same `(season, race, rankKey)` index a query for `race == "Dwarven"` uses. Only 4 stats × up to 4 filter-shapes (none / race / sub / both) = up to 16 index *definitions*, not hundreds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firestore typed-value JSON encoding | A second `toFirestoreValue`-style function in `runDoc.js` | Reuse/export `bugReport.js#toFirestoreFields`/`toFirestoreValue` | Already correct, already tested via the existing `sendBugReport` path |
| Service-account JWT signing for admin tooling | A hand-rolled or npm-JWT-library signer | The exact `signServiceAccountJwt`/`getAccessToken` shape from `tools/bug-reports/file-issues.mjs` | Proven live (the bug-report Action runs every 15 minutes against this exact code); zero new dependency |
| Rules ↔ client contract drift detection | Manual review of `firestore.rules` vs. `runDoc.js` on every future change | Extend `test/unit/firestore-rules.test.js`'s `functionBody`/`keysList` regex-extraction pattern to the new `isValidRun`/rank-key functions | This is precisely what that test file already exists to prevent for `bugReports`; a second, differently-shaped rules-contract mechanism would be inconsistent and easy to forget to update |
| A generic "is this a legitimate npm package" checker | N/A — no npm packages added | N/A | Not applicable this phase |
| Server-timestamp emulation via client `Date.now()` + a loose rules bound | A "close enough" clock-skew-tolerant timestamp check | The `:commit` two-Write transform pattern (Pattern 1/Pitfall 1) for a true `request.time` equality | CONTEXT.md locks `createdAt == request.time` as an exact rule, not an approximation |

**Key insight:** Every piece of this phase that looks novel (typed-value encoding, service-account JWT auth, rules-contract testing, injected-dependency pure modules) already has a working, live-proven implementation in this exact repo from Phase 79.3. The engineering risk in this phase is almost entirely in the *new* surfaces bug reports didn't need — anonymous auth, rank-key rules math, and multi-write atomic creates for server timestamps — not in re-deriving patterns that already exist here.

## Common Pitfalls

### Pitfall 1: The simple `documentId=`-POST create endpoint cannot produce `createdAt == request.time`
**What goes wrong:** `bugReport.js`'s `sendBugReport` posts to `.../documents/{collection}?documentId=...` (or without `documentId` for auto-IDs). This endpoint has no concept of `FieldValue.serverTimestamp()` — that sentinel only exists in Firebase SDKs, which translate it into a `:commit` request carrying a `transform` Write. A plain create POST can only send a client-computed timestamp string, which can never satisfy `request.resource.data.createdAt == request.time` in rules (server eval time vs. client string will essentially never match exactly, and are trivially forgeable if they did).
**Why it happens:** REST-level Firestore has two distinct write surfaces — the simple `documents.createDocument`/`.patch` CRUD endpoints (what `bugReport.js` uses) and the lower-level `documents:commit` transactional endpoint (what every SDK's serverTimestamp/increment/arrayUnion sentinel compiles down to). Only `:commit` supports `fieldTransforms`.
**How to avoid:** For run creation specifically, use `POST .../documents:commit` with two Writes in one request: (1) an `update` Write targeting `runs/{uid}_{hash}` with every field except `createdAt`, carrying `currentDocument.exists: false` as its precondition (this is what gives create-only/idempotent semantics — the analog of the simple endpoint's 409); (2) a `transform` Write on the same document path with `fieldTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]`. Both writes commit atomically. **Status-code consequence:** a precondition failure on write (1) — i.e. the doc already exists — surfaces as **HTTP 400** with a `FAILED_PRECONDITION`-shaped error body from `:commit`, not the simple endpoint's clean 409 ALREADY_EXISTS. `runQueue.js`'s "already exists = acknowledged" classification must inspect the error body's `status`/`message` for this case, not just the HTTP status code the way `bugReport.js`'s `sendBugReport` does (which treats any `>=400` as `refused` and would incorrectly drop a duplicate-detected run as if it failed validation — the queue must distinguish "precondition failed because it already exists" from "validation rejected" before dropping an entry). [CITED: cross-checked via search of Firestore `:commit`/`FieldTransform` docs and prior art]
**Warning signs:** `boards-smoke.mjs`'s create step returning something other than a clean success on a legitimate first submit, or `runQueue.js` unit tests showing a resubmitted run being treated as failed rather than acknowledged.

### Pitfall 2: `math.min`/`math.max` don't exist in Firestore rules
**What goes wrong:** Writing `d.daysKey == math.min(d.day, 10*d.floor)*1000 + d.floor` in the rules fails to compile/parse — the documented `math` namespace exposes `abs`, `ceil`, `floor`, `isInfinite`, `isNaN`, `pow`, `round`, `sqrt` only.
**Why it happens:** Firestore's rules language (a restricted CEL dialect) never added min/max helpers.
**How to avoid:** Express `min(a, b)` as a ternary: `(a < b ? a : b)`. See Pattern 1's `expectedDaysKey` example.
**Warning signs:** A rules deploy failing to compile, or (if the syntax happens to parse as something unintended) a rank-key check that always passes/fails.

### Pitfall 3: `runAggregationQuery` billing and index needs mirror the equivalent `orderBy`/filter query — not "free"
**What goes wrong:** Assuming `count()` is a cheap, indexless operation and skipping composite-index planning for the `total()`/`rankOf()` reads.
**Why it happens:** Aggregation queries *do* save reads vs. fetching every document (billed at 1 read per up to 1,000 index entries scanned, not 1 read per document — e.g., a 1,500-entry match bills 2 reads) [CITED: firebase.google.com/docs/firestore/query-data/aggregation-queries], but they still scan an index and need the same composite index a non-aggregated version of the same query (same filters + implicit ordering) would need.
**How to avoid:** Design the composite-index list around the *query shapes* (season [+race][+sub] equality, plus the rank-key field for both `orderBy` and the `rankKey > x` range filter `rankOf()` uses), not just around the `topTen` reads. The `total()` read (pure equality, no range/order) may be servable by Firestore's automatic index merging of single-field indexes — but `rankOf()`'s range filter (`rankKey > mine`) combined with equality filters does need the full composite index, same as `topTen`.
**Warning signs:** A `FAILED_PRECONDITION`/"query requires an index" error on `runAggregationQuery` that never showed up when testing `runQuery` alone (because a chosen test case happened not to exercise the range-filter shape).

### Pitfall 4: Index merging does NOT reduce the index count needed for this board (every board query has an `orderBy`/range component)
**What goes wrong:** Reading that "Firestore can merge indexes for equality-only queries to reduce composite index count" and assuming this reduces the number of `firestore.indexes.json` entries needed for `runs`.
**Why it happens:** Index merging (confirmed this session) applies specifically to queries using *only* equality filters with no sort order — it does not apply to any of this board's real query shapes, since every one either has an `orderBy(rankKey)` (topTen) or a range filter on `rankKey` (rankOf's count). Only the `total()` count (pure equality, no order, no range) could theoretically benefit.
**How to avoid:** Declare the full composite-index set: one per `(season, [race], [sub], rankKey)` combination actually queried (up to 4 stats × 4 filter-shapes = 16 composite index *definitions* — well under Spark's 200-composite-index limit [CITED: search cross-check of Firestore quotas]), rather than assuming merging shrinks this.
**Warning signs:** `topTen()`/`rankOf()` failing with a missing-index error in the live smoke test despite `total()` (equality-only) working fine.

### Pitfall 5: Enumerating race/sub filter *values* as separate indexes instead of index *shapes*
**What goes wrong:** Believing you need one index per race value (Human, Elven, Dwarven, Fridgian, Troll, Wilmsry — 6 races) × per sub-class value (8 subs × 3 classes = 24) × per stat (4) = potentially 576 indexes, blowing past Spark's 200-composite-index limit.
**Why it happens:** Confusing an index *definition* (a field-order shape: `season ==, race ==, rankKey desc`) with the *values* that field can hold at query time. One index definition serves every possible equality value for that field.
**How to avoid:** The actual index count needed is small: for each of the 4 rank keys, up to 4 filter shapes (no filter / race only / sub only / race+sub) = 16 composite index definitions total, comfortably inside Spark's 200-composite-indexes-per-database limit (1,000 with billing enabled, not needed here) [CITED: search cross-check].
**Warning signs:** Over-engineering `firestore.indexes.json` with dozens of near-duplicate entries.

### Pitfall 6: Anonymous identity token refresh — clock skew and expiry math
**What goes wrong:** Caching `expiresIn` (a string, seconds) as an absolute wall-clock expiry using the device's own clock, then refreshing "just in time" — a device with a fast/skewed clock can present an id token Firestore's rules evaluator (using Google's own clock) considers already-expired, or refresh prematurely/late.
**Why it happens:** `accounts:signUp`/`securetoken:token` both return `expiresIn`/`expires_in` as a duration (seconds, typically `"3600"`), not an absolute timestamp — the client must convert using its own `now()`.
**How to avoid:** Cache `idToken`, `refreshToken`, and an absolute `expiresAtMs = now() + Number(expiresIn) * 1000` computed via the injected clock (never a bare `Date.now()`, per the pure-module convention); refresh proactively with a safety margin (e.g., refresh when `now() > expiresAtMs - 5*60*1000`) rather than waiting for an actual 401, since Firestore rules reject with a generic permission error that doesn't distinguish "expired token" from "genuinely unauthorized."
**Warning signs:** Intermittent "permission denied" on board reads/writes that clear up after a manual re-launch (which re-triggers a fresh token fetch).

### Pitfall 7: Enabling the anonymous provider and restricting the API key both require the RIGHT scope/project context
**What goes wrong:** `gcloud auth print-access-token` under the wrong active account/project, or omitting the `x-goog-user-project` header, causes `PERMISSION_DENIED` or quota-project errors on the Identity Toolkit admin v2 `PATCH .../config` call, or on `api-keys update`/`lookup`.
**Why it happens:** These are Google Cloud (not Firebase-specific) admin APIs; they need OAuth2 scope `https://www.googleapis.com/auth/identitytoolkit`, `.../firebase`, or `.../cloud-platform` [CITED: docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig], and — like other Google Cloud REST calls made with a bare access token via curl rather than a client library — may need an explicit `X-Goog-User-Project: delve-die-repeat-6ba5f` header to attribute quota/billing correctly [CITED: docs.cloud.google.com/docs/quotas/set-quota-project].
**How to avoid:** Confirm the active `gcloud` account (`gcloud config list account`) has Editor/Owner or the Identity Platform admin role on `delve-die-repeat-6ba5f` before attempting the config PATCH; include `-H "X-Goog-User-Project: delve-die-repeat-6ba5f"` on every raw `curl` call using `gcloud auth print-access-token`. If the PATCH is refused for any reason (including "Identity Platform must be explicitly enabled" — see Open Questions), fall back to the Firebase Console's Authentication → Sign-in method → Anonymous toggle, per CONTEXT.md's explicit fallback instruction.
**Warning signs:** A 403/`PERMISSION_DENIED` on the config PATCH despite `gcloud auth login` succeeding; `accounts:signUp` later returning `OPERATION_NOT_ALLOWED` in the smoke test, meaning the provider never actually got enabled.

### Pitfall 8: `gcloud services api-keys update --api-target` is NOT additive by default
**What goes wrong:** Running `gcloud services api-keys update KEY_ID --api-target=service=identitytoolkit.googleapis.com` alone, expecting it to *add* to the key's existing `firestore.googleapis.com` restriction, but instead it *replaces* the full restriction set (leaving Firestore access broken for the existing bug-report flow).
**Why it happens:** `--api-target` flags describe the desired final state of the key's `apiTargets`, not a delta; the confirmed syntax (`--api-target=service=A --api-target=service=B`, repeatable) sets the complete list in one call.
**How to avoid:** Always pass ALL THREE target services in one `update` call: `--api-target=service=firestore.googleapis.com --api-target=service=identitytoolkit.googleapis.com --api-target=service=securetoken.googleapis.com`. Verify with `gcloud services api-keys describe KEY_ID` immediately after, and re-run `tools/bug-reports/send-test-report.mjs` (the existing bug-report smoke check) to confirm Firestore access to `bugReports` still works before declaring SRV-08 done.
**Warning signs:** Bug reports silently stop sending after this phase's key-restriction step, with no error surfaced anywhere the user would see it (the sheet just shows "failed").

## Code Examples

### Anonymous sign-up (identitytoolkit v1)
```
POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=[API_KEY]
Content-Type: application/json

{ "returnSecureToken": true }
```
```json
// Response (200)
{
  "kind": "identitytoolkit#SignupNewUserResponse",
  "idToken": "eyJhbGciOi...",
  "refreshToken": "AMf-vBy...",
  "expiresIn": "3600",
  "localId": "abc123uid"
}
```
Error response for a disabled provider (`OPERATION_NOT_ALLOWED`):
```json
{ "error": { "code": 400, "message": "OPERATION_NOT_ALLOWED", "errors": [ { "message": "OPERATION_NOT_ALLOWED", "domain": "global", "reason": "invalid" } ] } }
```
[CITED: firebase.google.com/docs/reference/rest/auth]

### Token refresh (securetoken v1)
```
POST https://securetoken.googleapis.com/v1/token?key=[API_KEY]
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=[REFRESH_TOKEN]
```
```json
// Response (200) — note snake_case, unlike accounts:signUp's camelCase
{
  "access_token": "...", "expires_in": "3600", "token_type": "Bearer",
  "refresh_token": "AMf-vBy...", "id_token": "eyJhbGciOi...",
  "user_id": "abc123uid", "project_id": "123456789"
}
```
[CITED: docs.cloud.google.com/identity-platform/docs/use-rest-api]

### Enabling the anonymous provider (Identity Toolkit admin v2)
```
PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config?updateMask=signIn.anonymous.enabled
Authorization: Bearer $(gcloud auth print-access-token)
X-Goog-User-Project: delve-die-repeat-6ba5f
Content-Type: application/json

{ "signIn": { "anonymous": { "enabled": true } } }
```
[CITED: docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig; PATCH shape, scope list, updateMask syntax confirmed — exact request-body nesting for `signIn.anonymous.enabled` is the one part inferred from the field-name pattern rather than a fetched full schema, so verify the first PATCH's response body against the sent `signIn.anonymous.enabled: true` before relying on it]

### Restricting the API key (gcloud)
```bash
# Resolve the existing public key string (from bugReportConfig.js) to its resource id:
gcloud services api-keys lookup AIzaSyBMevk4MUgW7enDgE9NR96ItJcaiDV-SaI --project=delve-die-repeat-6ba5f

# Set the COMPLETE api-target list (see Pitfall 8 — not additive):
gcloud services api-keys update projects/delve-die-repeat-6ba5f/locations/global/keys/KEY_ID \
  --api-target=service=firestore.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com
```
[CITED: docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/update, /lookup]

### Firestore `runQuery` (topTen)
```
POST https://firestore.googleapis.com/v1/projects/delve-die-repeat-6ba5f/databases/(default)/documents:runQuery
Authorization: Bearer [idToken or none — reads are public per SRV-02]
Content-Type: application/json

{
  "structuredQuery": {
    "from": [{ "collectionId": "runs" }],
    "where": {
      "compositeFilter": {
        "op": "AND",
        "filters": [
          { "fieldFilter": { "field": { "fieldPath": "season" }, "op": "EQUAL", "value": { "integerValue": "1" } } },
          { "fieldFilter": { "field": { "fieldPath": "race" }, "op": "EQUAL", "value": { "stringValue": "Elven" } } }
        ]
      }
    },
    "orderBy": [{ "field": { "fieldPath": "deepKey" }, "direction": "DESCENDING" }],
    "limit": 10
  }
}
```
[CITED: cross-checked Firestore REST `runQuery` docs/examples]

### Firestore `runAggregationQuery` (total, and rank via a range filter)
```json
// total(): pure equality, no order
{
  "structuredAggregationQuery": {
    "aggregations": [{ "alias": "total", "count": {} }],
    "structuredQuery": {
      "from": [{ "collectionId": "runs" }],
      "where": { "fieldFilter": { "field": { "fieldPath": "season" }, "op": "EQUAL", "value": { "integerValue": "1" } } }
    }
  }
}
```
```json
// rankOf(): count of runs strictly ahead of mine — needs the same composite index as topTen
{
  "structuredAggregationQuery": {
    "aggregations": [{ "alias": "ahead", "count": {} }],
    "structuredQuery": {
      "from": [{ "collectionId": "runs" }],
      "where": {
        "compositeFilter": { "op": "AND", "filters": [
          { "fieldFilter": { "field": { "fieldPath": "season" }, "op": "EQUAL", "value": { "integerValue": "1" } } },
          { "fieldFilter": { "field": { "fieldPath": "deepKey" }, "op": "GREATER_THAN", "value": { "integerValue": "5999999" } } }
        ] }
      }
    }
  }
}
// rank = ahead + 1
```
[CITED: firebase.google.com/docs/firestore/query-data/aggregation-queries]

### Idempotent create with a true server timestamp (`:commit`, Pitfall 1)
```
POST https://firestore.googleapis.com/v1/projects/delve-die-repeat-6ba5f/databases/(default)/documents:commit
Authorization: Bearer [idToken]
Content-Type: application/json

{
  "writes": [
    {
      "update": {
        "name": "projects/delve-die-repeat-6ba5f/databases/(default)/documents/runs/UID_HASH",
        "fields": { "uid": {"stringValue": "UID"}, "handle": {"stringValue": "@lanternjaw"}, "...": "..." }
      },
      "currentDocument": { "exists": false }
    },
    {
      "transform": {
        "document": "projects/delve-die-repeat-6ba5f/databases/(default)/documents/runs/UID_HASH",
        "fieldTransforms": [{ "fieldPath": "createdAt", "setToServerValue": "REQUEST_TIME" }]
      }
    }
  ]
}
```
A precondition failure (doc exists — treat as "already submitted, acknowledged") comes back **HTTP 400** with an error body shaped like `FAILED_PRECONDITION`, not the simple-endpoint's 409. [CITED: cross-checked Firestore `:commit`/`Write`/`DocumentTransform.FieldTransform` reference + prior-art blog confirmation of the SDK's `serverTimestamp()` → transform translation]

### Composite index declaration (`firestore.indexes.json`)
```json
{
  "indexes": [
    { "collectionGroup": "runs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "season", "order": "ASCENDING" },
      { "fieldPath": "deepKey", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "runs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "season", "order": "ASCENDING" },
      { "fieldPath": "race", "order": "ASCENDING" },
      { "fieldPath": "deepKey", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "runs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "season", "order": "ASCENDING" },
      { "fieldPath": "sub", "order": "ASCENDING" },
      { "fieldPath": "deepKey", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "runs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "season", "order": "ASCENDING" },
      { "fieldPath": "race", "order": "ASCENDING" },
      { "fieldPath": "sub", "order": "ASCENDING" },
      { "fieldPath": "deepKey", "order": "DESCENDING" }
    ]}
    // repeat this 4-shape group for daysKey, killsKey, goldKey = 16 index definitions total
  ]
}
```
[CITED: search-confirmed `firestore.indexes.json` schema shape (`collectionGroup`/`queryScope`/`fields[].fieldPath`/`order`)]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Firebase Auth SDK for anonymous sign-in | Plain REST `accounts:signUp` — the SDK just wraps this same endpoint | N/A (REST has always been the underlying transport) | No SDK required; confirms the `.claude/CLAUDE.md` "no Firebase SDK" constraint is achievable for auth, not just Firestore |
| Fetching every document then counting client-side for a leaderboard total | `runAggregationQuery` with `count()` | Firestore aggregation queries GA'd (established feature by 2026) | Total/rank reads cost ~1 read per 1,000 index entries scanned instead of 1 read per document — critical for staying inside the Spark 50k-reads/day budget |
| Manually toggling Console switches for one-time project config | Identity Toolkit admin v2 REST API + gcloud | Ongoing GCP API-first tooling trend | Enables "Claude does live setup, not the user" per CONTEXT.md, but is the one LOW-confidence surface this session couldn't fully confirm against a non-upgraded (stock Firebase Auth, not paid Identity Platform) project — see Open Questions |

**Deprecated/outdated:** None specific to this phase — Firestore REST v1, Identity Toolkit v1/admin v2, and Secure Token v1 are all current, stable, non-deprecated surfaces as of this session.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Identity Toolkit Admin API v2 `projects.updateConfig` PATCH (enabling `signIn.anonymous.enabled`) works against `delve-die-repeat-6ba5f` as a stock Firebase Auth project without requiring a paid "Identity Platform" upgrade first | Standard Stack (Supporting), Pitfall 7, Open Questions | If wrong, SRV-08's "enable anonymous sign-in via API" step fails and the CONTEXT.md-specified fallback (Console toggle, done by the user or Claude via a documented manual step) must be used instead — no architectural impact, just a manual step instead of a scripted one |
| A2 | The exact JSON request-body nesting for the `updateConfig` PATCH is `{"signIn": {"anonymous": {"enabled": true}}}` matching the `updateMask=signIn.anonymous.enabled` field path | Code Examples | If the nesting differs slightly (e.g., a different wrapper key), the PATCH returns a 400 with a clear schema-mismatch error — cheap to detect and fix at execution time, not a silent failure |
| A3 | A `:commit` precondition failure (existing document) always returns HTTP 400 with a `FAILED_PRECONDITION`-recognizable error body, distinctly classifiable from a genuine rules-validation rejection | Pitfall 1, Common Pitfalls | If the two failure modes are NOT reliably distinguishable by the response body, `runQueue.js` could either wrongly drop a duplicate-detected run as "failed" (annoying but not data-losing, since the run already exists server-side) or wrongly retry a validation failure forever (a real bug) — must be verified empirically against the live project by `boards-smoke.mjs` before the plan is considered done |
| A4 | The day-count plausibility bound `day <= floor(steps/100) + camp_allowance` with a generous `camp_allowance` (e.g., 50-100) rejects only implausible forged docs, not legitimate long/farmed runs, given the DAYS rule already neutralizes farming's ranking incentive via `daysKey` | Common Pitfalls (implicit in Pattern 2), User Constraints | If the camp allowance is sized too tightly, a legitimate very-long honest run (or a still-permitted-but-uncompetitive farmer run) could be rejected by the rules at submit time — worth confirming the exact constant against the DAYS-farming dataset's max observed day/action ratios before locking it |
| A5 | Level bound and other minor plausibility bounds (level, sp) not explicitly numbered in CONTEXT.md can reuse the `bugReport.js` pattern of a generous flat sanity cap (e.g., `<= 1000000000`, matching `RUN_INT_MAX`) rather than a tight formula | Standard Stack / rules design | Low risk — a generous cap is a pure sanity check, not a gameplay-shaping bound, so being generous costs nothing |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does the Identity Toolkit Admin API v2 apply to a plain (non-"Identity-Platform-upgraded") Firebase project?**
   - What we know: `delve-die-repeat-6ba5f` already has Firebase Auth's underlying infrastructure active in some form (it's the same identitytoolkit.googleapis.com API family Firebase Auth itself is built on), and the docs found this session describe the admin v2 config API under the "Identity Platform" documentation tree without an explicit "requires the paid upgrade" caveat in the excerpts retrieved.
   - What's unclear: Whether `projects.updateConfig` silently no-ops, 403s, or requires a one-time (free) "upgrade to Identity Platform" click in the Console before it accepts writes, for a project that has never explicitly done that upgrade.
   - Recommendation: Attempt the PATCH first (per CONTEXT.md's instruction); if refused with a clear "upgrade required" message, that message itself will resolve the question, and CONTEXT.md's own fallback (user/Console) applies. Document the actual outcome in `docs/LEADERBOARDS.md` once executed — this is exactly the kind of thing the runbook should capture for future SEASON bumps or key rotations.

2. **Exact composite-index count for `rankOf()`'s inequality filter combined with equality filters — does Firestore require the inequality field to be the LAST field in the index, and does that conflict with also needing `orderBy(rankKey desc)` for `topTen()` on the same field?**
   - What we know: Firestore requires range/inequality filters and `orderBy` to be on the same field when both appear in one query, and that field is conventionally last in the index. `topTen()` orders by `rankKey desc`; `rankOf()` filters `rankKey > x` (no explicit orderBy needed for a count). Both should be satisfiable by the SAME index (`season [,race] [,sub], rankKey`).
   - What's unclear: Whether Firestore's automatic index inference during a real deploy ever asks for a *second*, slightly different index for the range-filter-only (no orderBy) shape of `rankOf()` versus the orderBy shape of `topTen()`.
   - Recommendation: Deploy the 16 index definitions in Pattern 1/Code Examples, then run `boards-smoke.mjs`'s full read cycle (topTen + total + rankOf, with and without race/sub) against the live project before considering SRV-03/SRV-08 done — Firestore's own "missing index" error messages (which include a direct console link to auto-create the exact missing index) are the authoritative signal here, more reliable than static research.

3. **Sizing the `day <= steps/100 + camp_allowance` bound precisely.**
   - What we know: The DAYS-farming measurement (`docs/DAYS-FARMING.md`) shows honest runs cap around 17-18 days (p99/max), while unbounded floor-1/floor-2 farmers reach 191-214 days over up to 20,000 actions — but `daysKey`'s `min(day, 10*floor)` cap already removes farming's ranking payoff, so this bound is purely an anti-garbage-data plausibility check, not an anti-farming control.
   - What's unclear: The exact numeric `camp_allowance` constant to lock in `firestore.rules`/`runDoc.js`'s mirror.
   - Recommendation: This is explicitly named in CONTEXT.md as "the researcher/planner sizes" — propose `day <= floor(steps/100) + 100` (generous: covers the observed max-214-day farmer outcome even at a conservative steps estimate) as a starting point for the plan to lock, tagged `[ASSUMED]` (Assumptions Log A4) pending the planner's own sizing pass against real `steps`/`day` pairs from `docs/days-farming/days-farm.json` if a tighter bound is wanted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase CLI | Deploy `firestore.rules` + `firestore.indexes.json` (SRV-08) | ✓ | 15.29.0 | — |
| Google Cloud SDK (`gcloud`) | Enable anonymous provider, restrict API key, sign admin-script JWTs (SRV-07, SRV-08) | ✓ | Google Cloud SDK 579.0.0 | — |
| Node.js | All new `src/browser/*.js` modules + `tools/boards-*.mjs` | ✓ | v22.23.2 | — |
| Firebase project `delve-die-repeat-6ba5f` (Spark plan) | The whole phase | ✓ (already used by bug reports, per `.firebaserc`/`bugReportConfig.js`) | — | — |
| Anonymous sign-in provider ENABLED on the live project | SRV-04, SRV-08 | ✗ (not yet enabled — this phase enables it) | — | Manual Console toggle if the gcloud/API path is refused (Open Question 1) |
| An `identitytoolkit`/`securetoken`-restricted API key | SRV-04 | ✗ (current key restricted to Firestore only, per `bugReportConfig.js` comment) | — | This phase's `gcloud services api-keys update` step adds it (Pitfall 8) |

**Missing dependencies with no fallback:** none — every missing piece (anonymous provider, key restrictions) is something this phase itself provisions, with a documented fallback if the scripted path is refused.

**Missing dependencies with fallback:** anonymous sign-in enablement and API key restriction both have a Console-based manual fallback if the gcloud/REST admin path is refused, per CONTEXT.md's own instruction.

## Sources

### Primary (HIGH confidence)
- `C:\projects\mazeworld\src\browser\bugReport.js`, `bugReportConfig.js`, `firebase\firestore.rules`, `test\unit\firestore-rules.test.js`, `tools\bug-reports\file-issues.mjs`, `tools\bug-reports\send-test-report.mjs`, `docs\BUG-REPORTS.md` — direct inspection, the proven live precedent this phase extends
- `engine\death.js#buildRunSummary`, `engine\records.js` (`runHash`, `isValidHash`, `RANKED_BOARDS`, `compareRuns`), `content\season.js`, `content\safety-wordlist.js`, `content\races.js`, `content\classes.js`, `content\epitaphs.js#CAUSE_TEXT` — direct inspection, the enumerated field values/bounds the rules must check
- `docs\DAYS-FARMING.md` "## The DAYS rule" — direct inspection, the locked `daysKey` formula
- Local shell: `firebase --version` (15.29.0), `gcloud --version` (Google Cloud SDK 579.0.0, core 2026.07.31), `node -e "console.log(process.version)"` (v22.23.2)

### Secondary (MEDIUM confidence)
- firebase.google.com/docs/reference/rest/auth — `accounts:signUp` anonymous request/response shape, `OPERATION_NOT_ALLOWED`
- docs.cloud.google.com/identity-platform/docs/use-rest-api — `securetoken.googleapis.com/v1/token` refresh grant request/response
- docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig — PATCH URL, OAuth scopes, `updateMask` syntax
- docs.cloud.google.com/sdk/gcloud/reference/services/api-keys/update, /lookup — `--api-target=service=` syntax (non-additive, Pitfall 8), key-string-to-resource-id lookup
- firebase.google.com/docs/firestore/query-data/aggregation-queries — `count()` billing (1 read/1,000 index entries), `runAggregationQuery` request shape
- firebase.google.com/docs/firestore/security/rules-query and cross-checked search results — `request.query.limit` list-rule pattern
- firebase.google.com/docs/reference/rules/rules.math — confirmed `math` namespace members (no min/max)
- Cross-checked search results (Firestore `:commit`/`DocumentTransform.FieldTransform`/`setToServerValue: REQUEST_TIME`) — the server-timestamp-via-REST pattern
- Cross-checked search results — Firestore Spark quotas (50k reads/20k writes/20k deletes/day, 1 GiB), composite-index limit (200 without billing, 1,000 with), index-merging scope (equality-only queries)
- `firestore.indexes.json` schema shape — cross-checked search results (official reference page 404'd on direct fetch this session; shape confirmed via multiple independent examples)

### Tertiary (LOW confidence)
- Whether `projects.updateConfig` (Identity Toolkit admin v2) requires a "paid Identity Platform upgrade" first for a stock Firebase Auth project, vs. working identically either way — not resolved this session (Open Question 1); flagged for empirical resolution during execution
- Exact JSON body nesting for `signIn.anonymous.enabled` in the `updateConfig` PATCH — inferred from field-path naming convention, not confirmed against a fully-rendered schema page (Assumption A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is either already installed/proven in this repo (Firebase CLI, gcloud, the REST/JWT patterns) or a documented, stable Google REST API with no SDK alternative
- Architecture: HIGH — directly extends a working, live-deployed pattern (`bugReport.js`/`firestore.rules`/`file-issues.mjs`) already in this codebase; the new pieces (auth, rank-key rules, `:commit` transforms) are MEDIUM, individually cited
- Pitfalls: MEDIUM — the `:commit`/`request.time` interaction (Pitfall 1) and the admin-API-on-stock-project question (Open Question 1) are the two genuinely unverified-live claims; everything else is either codebase-confirmed or docs-cited

**Research date:** 2026-09-28
**Valid until:** 30 days (Firestore/Identity Toolkit REST surfaces are stable; re-verify quotas/index limits if this phase's execution slips past October 2026, since Google occasionally revises Spark-tier numbers)
