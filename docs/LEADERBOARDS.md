# Leaderboards

Phase 83 (SRV-01..SRV-12). Our own leaderboard: no Firebase SDK, plain `fetch`
against Firestore/Identity Toolkit/Secure Token REST, on the same Spark
project as the bug reports (`delve-die-repeat-6ba5f`, `.firebaserc`). This is
the ops runbook — deploys, the rules, indexes, identity, the queue/backfill,
live setup and key restrictions, the SEASON bump, Spark quotas, moderation
with `tools/boards-admin.mjs`, and the kill switch.

## 1. What the board is

The board is our own Firestore `runs` table, not a third-party service — no
SDK, plain `fetch`, every network call injected so every module is
unit-testable with no network. `runs`/`banned` reads and writes are public
per the rules (section 4); writes always carry the anonymous identity's own
uid (section 7).

Compete is the opt-out (the Play Games predecessor was private-by-default and
became a ghost town — see `.planning/phases/83-leaderboard-server/83-CONTEXT.md`
"Specific Ideas"). With Compete OFF, this whole path makes zero network
calls — no sign-up, no submission, no read — except the one player-tapped
bug-report Send escape hatch (SRV-09, `docs/BUG-REPORTS.md`).

Android debug and release builds both talk to the **live** board. The
browser dev loop (non-native, `npx serve`/`live-server`) selects
`src/browser/fakeBoardServer.js`'s in-memory fake instead — the shell makes
that choice in Phases 84/85, not here. Start-at-depth dev runs
(`state.dev`) are **never submitted**, live or fake.

## 2. The path

```
death (non-dev, Compete ON)
        │
        ▼
  ddr.runQueue.v1  (enqueue; flush on enqueue/resume/online; backoff)
        │
        ▼
  firebaseAuth.js  (the anonymous identity's bearer token)
        │
        ▼
  runDoc.js / boardWrites.js  (build + commit the run doc)
        │
        ▼
  Firestore REST  (firestore.rules: create-only, owner-gated, shape-checked)
        │
        ▼
     runs/{uid}_{hash}
        │
        ▼
  boardClient.js  (topTen / total / rankOf — public reads, 5-minute cache)
        │
        ▼
tools/boards-admin.mjs  (top / suspicious / delete-run / ban / unban / export)
```

| File | Job | Plan |
|---|---|---|
| `src/browser/firebaseConfig.js` | The shared project id + public API key | 83-01 |
| `src/browser/firestoreRest.js` | The one typed-value encoder/decoder, REST URL builders, `timedFetch` | 83-01 |
| `content/handles.js`, `src/browser/handles.js` | The rolled `@handle` word tables and roll/validate | 83-01 |
| `src/browser/runDoc.js` | The run document contract, rank keys, the rules' JS mirror, commit/query builders | 83-02 |
| `src/browser/reportLimits.js` | The per-player bug-report cooldown/daily-cap mirror | 83-02 |
| `firebase/firestore.rules`, `firebase/firestore.indexes.json` | The deployed rules and composite indexes | 83-02 |
| `src/browser/firebaseAuth.js` | The anonymous identity: sign-up, refresh, the handle lifecycle | 83-03 |
| `src/browser/fakeBoardServer.js` | The browser dev loop's in-memory REST model of the whole board | 83-04 |
| `src/browser/boardClient.js` | `topTen`/`total`/`rankOf`, cached, public | 83-04 |
| `tools/boards-admin.mjs` | Moderation and balance export (this file) | 83-05 |
| `src/browser/boardWrites.js`, `src/browser/runQueue.js` | Idempotent submit, handle rewrite, erase, and the submission queue | 83-06 |
| `src/browser/runBackfill.js` | The once-only backfill of runs from the 2.1.0 release on | 83-12 |
| `tools/boards-smoke.mjs` | The live end-to-end smoke test | 83-07 |

Board strings (`name`, `handle`, `epitaph`) are player-rolled-or-content-bank
data, never free text a player typed — but they still cross a trust boundary
once they reach another player's device. **Phase 84 must render every board
string as text (`textContent`, never `innerHTML`) — no board string is ever
trusted as HTML.**

## 3. The run document

Collection `runs`, doc id `{uid}_{hash}` (`hash` = `engine/death.js`'s
`RunSummary.hash`, reused as the run's stable identity — a resubmit of the
same run hits the same document and is idempotent by construction). Every
field below is checked by both `src/browser/runDoc.js#validateRunDoc` (the
client-side mirror) and `firebase/firestore.rules#isValidBoardRun`, kept
equal by `test/unit/firestore-rules.test.js`.

| Field | Type | Bound |
|---|---|---|
| `uid` | string | 1–128 chars, must equal the caller's own auth uid |
| `handle` | string | matches the rolled `@word+word` pattern (`content/handles.js`) |
| `season` | int | must equal `content/season.js`'s `SEASON` (currently 1) |
| `name` | string | 1–40 chars |
| `race` | string | one of the six playable races |
| `cls` | string | one of the three classes |
| `sub` | string | must be one of `cls`'s own sub-classes |
| `level` | int | 1–5 |
| `floor` | int | 1–200 |
| `steps` | int | 0–999,999 |
| `day` | int | ≥1, and `day * 100 <= steps + 30000` |
| `kills` | int | 0 ≤ `kills` ≤ `steps` |
| `gold` | int | 0–10,000,000 |
| `sp` | int | 0–1,000,000,000 |
| `cause` | string | one of the sixteen death-cause ids (`content/epitaphs.js`) |
| `epitaph` | string | ≤400 chars |
| `hash` | string | matches `^[0-9a-f]{8}$` |
| `version` | string | 1–64 chars, the stamped build string (e.g. `"2.2.0 (12)"`) |
| `seed` | safe integer | 0 to `Number.MAX_SAFE_INTEGER` |
| `acts` | int | 0–1,000,000,000 |
| `deepKey`, `daysKey`, `killsKey`, `goldKey` | int | each must equal its own formula, below |
| `createdAt` | timestamp | must equal `request.time` — the **server**'s clock, set via a `:commit` `updateTransforms` `setToServerValue: REQUEST_TIME`, never a client-sent string |

**The day bound is a plausibility check, not the DAYS rule.** `day * 100 <=
steps + 30000` (a 300-day camp allowance, `DAY_CAMP_ALLOWANCE` in
`runDoc.js`) exists only to refuse obviously-forged doc data (`day: 999999,
steps: 5`); it is generous enough to admit even the ~214-day floor-1/floor-2
farmer outcome measured in `docs/DAYS-FARMING.md` before Phase 82's fix. It
has nothing to do with ranking — that is `daysKey`, below.

**The kills-≤-steps bound** means a hero whose `kills` doc field exceeds
`steps` is refused outright and the create is dropped — a plausibility floor
(killing more foes than squares walked is impossible), not a game rule.

**The four rank keys** are exact integers so every board query is a single
`orderBy`/`count` — no client-side sort, and the rules re-derive each one so
a client can never lie about its own rank:

- `deepKey = floor * 1,000,000 + (999,999 - steps)` — floor desc, ties by
  fewer steps.
- `daysKey = min(day, 10 * floor) * 1,000 + floor` — **the Phase 82 DAYS
  rule**, quoted from `docs/DAYS-FARMING.md` "## The DAYS rule": *"DAYS ranks
  every run by daysKey = min(day, 10 * floor) (desc), ties by floor (desc);
  the board still displays the true day."* The board never shows `daysKey`
  itself, only the true `day`.
- `killsKey = kills * 1,000 + floor` — kills desc, ties by floor desc.
- `goldKey = gold` — gold desc.

## 4. The rules

`firebase/firestore.rules` is **one file for the whole project** —
`bugReports`, `reportLimits` and `runs`/`banned` all live here and are
**always deployed together** (section 6). The Action's service account
(`ddr-bug-reports`) and `tools/boards-admin.mjs`'s admin credentials both
bypass this entire file through IAM, not through a rule.

On `runs/{runId}`:

- **`create`** — signed in, `uid == request.auth.uid`, the doc id is exactly
  `{uid}_{hash}`, the full `isValidBoardRun` shape check (section 3) passes,
  and `banned/{uid}` does not exist.
- **`update`** — **the one exception to SRV-02's "no update" wording**: the
  owner may update *only* the `handle` field (`affectedKeys().hasOnly(['handle'])`),
  and the new handle must itself be valid. This exists because a re-roll
  keeps the player **one name across every run** (CONTEXT "Identity & the
  @handle") — every one of that uid's existing run docs gets its `handle`
  rewritten in one atomic `:commit`, never a new run doc per re-roll.
- **`delete`** — the owner only, of their own run.
- **`get`** — public, unconditional.
- **`list`** — public, bounded to `request.query.limit <= 50`
  (`LIST_LIMIT_MAX` in `runDoc.js`). A `runAggregationQuery` **count** shares
  this same index/rule surface (section 5, section 9's "Pitfall 3" note in
  `83-RESEARCH.md`) but is not itself limit-bounded the same way a `list`
  is — 83-08 records the live-verified answer in section 14.

On `banned/{uid}`: `read, write: if false` for every client — only the
admin's IAM access can write it (`tools/boards-admin.mjs`'s `ban`/`unban`).

The same file also holds the rate-limited `bugReports` create (auth
required, a same-commit `reportLimits/{uid}` cooldown/daily-cap step) and
`reportLimits` itself (owner get/create/update only) — documented in full in
`docs/BUG-REPORTS.md`. The `bugReports`/`reportLimits` **report-shape**
functions (`isValidRun`/`isValidReport`) are kept **byte-identical** to their
Phase 79.3 committed form by a dedicated sha256 pin in
`test/unit/firestore-rules.test.js`, so growing this file for the
leaderboard never silently drifts the bug-report contract.

`runs`, `bugReports` and `reportLimits` rules **always deploy together** —
there is one `firebase deploy --only firestore:rules` command, not three.

The catch-all (`match /{document=**} { allow read, write: if false; }`) denies
every other path in the database, now and after any later collection is
added.

## 5. Indexes

`firebase/firestore.indexes.json` declares **19 composite indexes**: 16 for
`runs` and 3 for `bugReports` cleanup queries (`status+filedAt`,
`status+oracleTrimmed+filedAt`, `status+failedAt` — the future retention
Action, 83-10).

The 16 `runs` indexes are one per **(season, [race], [sub], rankKey)
shape** — not per race/sub *value*. A composite index is a field-order
definition; a single `(season ==, race ==, deepKey desc)` index serves a
query for `race == "Elven"` and a query for `race == "Dwarven"` equally, so 4
rank keys (`deepKey`/`daysKey`/`killsKey`/`goldKey`) × 4 filter shapes (none
/ race / sub / race+sub) = 16 definitions, not the hundreds a per-value count
would suggest.

**Reading a missing-index error:** a query needing an index that is not yet
deployed (or not yet finished building) fails with `FAILED_PRECONDITION` and
a message that includes a direct Firebase console link to auto-create the
exact missing index — the authoritative signal, more reliable than static
review of `firestore.indexes.json`.

## 6. Deploying

Always run the contract tests first:

```
node --test test/unit/firestore-rules.test.js test/unit/firestore-indexes.test.js
```

Then deploy rules and indexes together, from the repo root:

```
firebase deploy --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f --non-interactive
```

Indexes can take time to build; wait for them with:

```
gcloud firestore indexes composite list --project=delve-die-repeat-6ba5f --database="(default)"
```

Every composite index's `state` reaches `READY` before relying on the
queries it backs (`topTen`, `rankOf`) live.

## 7. Identity

Every board write needs an anonymous Firebase identity, created lazily —
never at app launch, only on the first thing that actually needs it. Signed
up over plain REST (`accounts:signUp`, `returnSecureToken: true`), never the
Firebase SDK. `uid`, `refreshToken`, the cached `idToken` and its absolute
expiry live in durable storage under `ddr.identity.v1` (`src/browser/storage.js`,
separate from settings).

A cached token is refreshed proactively with a **5-minute safety margin**
(`REFRESH_MARGIN_MS`, `src/browser/firebaseAuth.js`) — refreshed once fewer
than 5 minutes remain, never waiting for an actual 401. Six known-terminal
refresh error messages (`TOKEN_EXPIRED`, `USER_DISABLED`, `USER_NOT_FOUND`,
`INVALID_REFRESH_TOKEN`, `INVALID_GRANT_TYPE`, `MISSING_REFRESH_TOKEN`) and a
`user_id` mismatch all **start a new identity** — clear the dead tokens, sign
up again, but **keep the same rolled handle**. Every other failure (timeout,
429/5xx, another 4xx) is transient and leaves the stored identity untouched.

**Erasing your runs** (Phase 85 UI): the owner deletes every one of their own
`runs` docs, then the local `ddr.identity.v1` record is dropped and the
anonymous Identity Toolkit account itself is deleted (`accounts:delete`).

The identity is **shared with bug reports** (SRV-09) — a player-tapped
**Send** on the bug-report sheet may create this same identity even with
Compete OFF (`getToken({ explicit: true })`, the one Compete-gate escape
hatch `firebaseAuth.js` offers).

**A per-IP limit on new anonymous sign-ups** (~10/hour, SRV-10) is set in
live setup, not in client code — it is a Identity Toolkit project-level
control. Recorded live in section 14 by 83-08.

## 8. The queue and the backfill

**`ddr.runQueue.v1`** (83-06): a durable, pure, DOM-free queue.
Enqueue on death — non-dev, Compete ON only. Flush on enqueue, on app
resume, and on the browser/OS `online` event. Exponential backoff between
flush attempts. A rules **rejection** (400/403, permission or validation)
drops that queue entry with a log line — it will never become valid by
retrying. An "already exists" response (the run's own idempotent create)
is treated as **acknowledged**, not a failure. 15-second request timeouts.
Never double-submits the same run. `purge()` empties the queue the moment
Compete goes OFF.

**`ddr.boardBackfill.v1`** (83-12): the boards start from the 2.1.0 release
(user, 2026-09-28). Once, on the first Compete-ON launch, the player's local
runs with `when` at or after `BACKFILL_SINCE_MS` (2026-09-28T19:41:01Z, the
`v2.1.0-play11` tag) are queued, stamped version `"2.1.0 (11)"`. Local
records carry no version, so the cutoff is the death time. Anything older is
never uploaded, and YOUR DEAD and the INTERRED count import only the same
runs (Phase 84). The shell call site is Phase 85's.

## 9. Live setup and the API key

Live provisioning (rules/indexes deploy, anonymous sign-in, API key
restriction, the per-IP limit) is done by Claude from the CLI, not the user
clicking through the console — with a documented console fallback if any
scripted call is refused.

**Restrict the existing public API key** to exactly the three services the
board (and bug reports) need. `--api-target` is **not additive** — a call
with fewer than all three targets **replaces** the whole list, silently
dropping Firestore access for the existing bug-report flow. Always pass all
three in one call:

```bash
gcloud services api-keys lookup AIzaSyBMevk4MUgW7enDgE9NR96ItJcaiDV-SaI --project=delve-die-repeat-6ba5f

gcloud services api-keys update projects/delve-die-repeat-6ba5f/locations/global/keys/KEY_ID \
  --api-target=service=firestore.googleapis.com \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com

gcloud services api-keys describe projects/delve-die-repeat-6ba5f/locations/global/keys/KEY_ID
```

Re-run `node tools/bug-reports/send-test-report.mjs` (a live Firestore call)
after this to confirm bug reports still work.

**Enable the anonymous sign-in provider** (Identity Toolkit admin v2):

```
PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config?updateMask=signIn.anonymous.enabled
Authorization: Bearer $(gcloud auth print-access-token)
X-Goog-User-Project: delve-die-repeat-6ba5f
Content-Type: application/json

{ "signIn": { "anonymous": { "enabled": true } } }
```

Verify the PATCH's own response body echoes `signIn.anonymous.enabled: true`
before relying on it. **Never call `identityPlatform:initializeAuth`** — it
upgrades the project to full Identity Platform, which is out of scope and
not reversible from the console alone.

**Console fallback** (if any of the above is refused — e.g. missing IAM
role): Firebase Console → Authentication → Sign-in method → Anonymous
toggle (provider); Google Cloud Console → APIs & Services → Credentials →
the key → API restrictions (key scope).

Live results (rules/indexes deployed, anonymous sign-in confirmed working,
the key restricted, the per-IP limit set, `tools/boards-smoke.mjs` passed)
are recorded in section 14 by 83-08.

## 10. The SEASON bump

Bump `content/season.js`'s `SEASON` constant **and** `firebase/firestore.rules`'
`isValidBoardRun`'s `d.season == 1` literal **together, in the same change**
— they are two independent hand-maintained values kept equal only by
`test/unit/firestore-rules.test.js`. Run the contract test, then deploy the
rules at release time (section 6).

During the rollout window, any client still running the **old** season's
build will have every run **refused and dropped** by the new rules
(`season` no longer matches) — this is intended, not a bug: the board only
ever shows the current season, so an old-season submission has nowhere
correct to land.

**Season names (user, 2026-09-28).** Season 1 is **Season of the Alpha**,
the closed-testing season. The label comes from the season-name table in
`content/season.js` (added in Phase 84); the integer stays the key
everywhere else (rules, indexes, `boards-admin --season`). **At go-live the
boards reset for Season 1:** bump `SEASON` to 2 and the rules literal to
`d.season == 2`, name season 2 "Season 1" in the table, deploy the rules
with the release. The alpha runs stay in Firestore under season 1
(`boards-admin export --season 1` for balance data) and count against the
1 GiB Spark storage until deleted with `boards-admin`.

## 11. Spark quotas

The Spark plan (billing off — this project can never be billed) has a daily
Firestore quota: **50,000 reads, 20,000 writes, 20,000 deletes**, and **1
GiB** stored — shared with bug reports (`docs/BUG-REPORTS.md`), which is why
report retention/cleanup exists at all.

Roughly: a `topTen` read costs **10 reads** (one per returned doc); a
`count`/`total` read costs **1 read per up to 1,000 index entries** scanned
(a 1,500-entry match bills 2 reads); `boardClient.js` caches every read for
**5 minutes** per `(op, stat, race, sub[, key])` to keep this cheap under
normal play. Admin `suspicious`/`export` each **read every matching run
once** — fine by hand, never on a schedule (see the header comment in
`tools/boards-admin.mjs`).

## 12. Moderation

`tools/boards-admin.mjs` — dev-only, Node built-ins, never shipped (`tools/`
is never copied into `www/`). Auth: with no `--key`, your own `gcloud auth
print-access-token` (adds `X-Goog-User-Project`); with `--key PATH` (or
`DDR_BOARDS_SA_KEY`) pointing at a service-account key file **outside** the
repository, a JWT exchange identical to `tools/bug-reports/file-issues.mjs`'s.
A key path resolving **inside** the repo is refused with exit 2 before it is
ever read — it must never enter the repo or `www/`, and its path/contents
are never printed.

```bash
# Preview the top ten by any rank stat (race/sub optional; --all-seasons for every season):
node tools/boards-admin.mjs top --stat kills --limit 20
node tools/boards-admin.mjs top --stat deep --race Elven

# List implausible runs (days/floor and kills/steps outliers, an
# unrolled name, an unbanked epitaph); override the default thresholds:
node tools/boards-admin.mjs suspicious
node tools/boards-admin.mjs suspicious --days-per-floor 15 --kills-per-step 0.15

# Delete one run — a dry run by default, --yes to actually delete:
node tools/boards-admin.mjs delete-run u1_0a1b2c3d
node tools/boards-admin.mjs delete-run u1_0a1b2c3d --yes

# Ban a player (writes banned/{uid}, deletes every one of their runs) and undo it:
node tools/boards-admin.mjs ban fakeuid000001 --reason "forged run" --yes
node tools/boards-admin.mjs unban fakeuid000001 --yes

# Export every run field (balance tracking across builds), CSV or JSON,
# filterable by version/season/date:
node tools/boards-admin.mjs export --format csv --version "2.2.0 (12)" --out boards-export-2.2.0-12.csv
node tools/boards-admin.mjs export --format json --since 2026-09-01 --until 2026-09-30 --all-seasons

# With a service-account key file instead of gcloud:
node tools/boards-admin.mjs top --stat purse --key ../ddr-boards-sa.json
```

**Key hygiene:** a service-account key file (if one is ever created) lives
**outside** the repository, never in `www/`. An `--out` export path resolving
**inside** the repo must be named `boards-export*` — `.gitignore` ignores
that pattern, matching `ddr-boards*.json` for a locally-placed key (section
13's `.gitignore` guard). Exports hold anonymous uids and rolled handles —
keep them off shared drives.

**A banned player can return** under a fresh anonymous uid — `banned/{uid}`
keys on the specific uid, and Identity Toolkit anonymous sign-up freely
mints new ones. This is an accepted residual (full replay verification is
deferred, per `.planning/phases/83-leaderboard-server/83-CONTEXT.md`
"Deferred Ideas").

## 13. The kill switch

If submissions need to stop immediately, deploy a rules file with the
`runs` collection's `create` replaced by `allow create: if false;` (leave
`get`/`list` as-is if the board should stay visible, or also set them
`if false` to hide it entirely):

```
firebase deploy --only firestore:rules --project delve-die-repeat-6ba5f
```

Any run queued client-side during the switch is refused and **dropped** by
`runQueue.js`'s normal rejection handling (section 8) — nothing accumulates
waiting to resubmit once the switch lifts. Restore by deploying the normal
`firebase/firestore.rules` again. This mirrors the bug-report kill switch in
`docs/BUG-REPORTS.md` exactly.

## 14. Live setup record

Filled in by 83-08.

## 15. Troubleshooting

- **`OPERATION_NOT_ALLOWED` on `accounts:signUp`** — the anonymous provider
  is not enabled on the live project (section 9); re-run the PATCH or use
  the console fallback.
- **`API_KEY_SERVICE_BLOCKED`** — the API key is not restricted to include
  the service being called (`identitytoolkit.googleapis.com` or
  `securetoken.googleapis.com`); re-run the full three-target
  `api-keys update` (section 9 — remember it replaces, not adds).
- **A missing-index `FAILED_PRECONDITION`** — the query's exact
  `(season, [race], [sub], rankKey)` shape has no deployed index, or the
  index is still building; the error includes a direct console link (section
  5), or wait for `gcloud firestore indexes composite list` to show `READY`.
- **`PERMISSION_DENIED` on a well-formed run** — check `banned/{uid}` first
  (the create rule refuses a banned uid even with a perfectly valid doc),
  then re-check the doc against every `isValidBoardRun` bound (section 3) —
  a single off-by-one on a rank key formula refuses the whole create.
- **Bug reports fail after a key change here** — the API key restriction
  step (section 9) replaces the whole `--api-target` list; if
  `firestore.googleapis.com` was left out of that call, bug reports (which
  use the same key) start failing. Re-run the full three-target update.
