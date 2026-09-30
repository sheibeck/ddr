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
| `note` | string | ≤120 chars, may be empty — the RunSummary's death note (e.g. "cut down by a Werebeast"), filled from content banks and the bestiary, never free text; board rows show it as the cause of death |
| `epitaph` | string | ≤400 chars |
| `when` | int | 0 to `request.time.toMillis() + 86,400,000` (a one-day clock-skew allowance) — the death time in ms, shown as the expanded row's date; board docs written before Phase 84 lack it and the panel falls back to `createdAt` |
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

- `deepKey = floor * 1,000,000 + steps` — floor desc, ties by MORE steps
  (report #9, Phase 87 BOARD-28, reversing BOARD-17). Steps never exceed
  999,999, so a deeper floor always outranks any step count on a shallower
  one. Runs written before the change carry the old key
  (`floor * 1,000,000 + (999,999 - steps)`) until the release re-key
  (`docs/RELEASING.md`, Release 2.3.0).
- `daysKey = min(day, 10 * floor) * 1,000 + floor` — **the Phase 82 DAYS
  rule**, quoted from `docs/DAYS-FARMING.md` "## The DAYS rule": *"DAYS ranks
  every run by daysKey = min(day, 10 * floor) (desc), ties by floor (desc);
  the board still displays the true day."* The board never shows `daysKey`
  itself, only the true `day`.
- `killsKey = kills * 1,000 + floor` — kills desc, ties by floor desc.
- `goldKey = gold` — gold desc.

`src/browser/runDoc.js#rankKeyOf(stat, run)` is the one shared rank-key
function both Phase 84 Leaderboards views (the board and YOUR DEAD) call —
dispatching to the four formulas above so a run holds the same rank-key
value, and the same place, in either view.

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
- **`list`** — public, bounded to `request.query.limit == null ||
  request.query.limit <= 50` (`LIST_LIMIT_MAX` in `runDoc.js`). **Live fix,
  83-08:** a `runAggregationQuery` (`count()`, used by `total()`/`rankOf()`)
  carries no `limit` field at all, so `request.query.limit` is `null` for
  those reads — the original `limit <= 50` clause evaluated that comparison
  as false and refused every count read on the live project (section 9's
  "Pitfall 3" note in `83-RESEARCH.md` warned this shape needed proving
  live). A plain `runQuery` (`topTen`) always sends an explicit `limit` (<=
  `TOP_N`), so this fix never widens what a list-with-`limit` read may
  request — `deny-list-51`'s `limit: 51` probe is still refused. Recorded in
  section 14.

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

### The transition period (over, 2026-09-29)

While 2.1.0 (vc11) was the build testers ran, every rules or index deploy
used a transition config (`firebase.transition.json`, pointing at a
`firebase/firestore.transition.rules` copy whose `bugReports` create clause
kept 2.1.0's unauthenticated form; `docs/BUG-REPORTS.md` section 4 "Old
builds"). On 2026-09-29, once 2.2.0 (vc12) was live on the testing track,
the final rules were deployed with the plain command above, `--probe-rules`
came back ten PASS (`docs/BUG-REPORTS.md`'s release-day subsection), and the
transition rules, their config and their test were deleted. That history
stays here; today's transition config is the next subsection.

### Until the 2.3 cutover: the DEPTH-key transition config

While 2.2.0 (vc12) is a build testers run, every rules or index deploy uses
the transition config instead of the plain command above:

```
firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive
```

`firebase.transition.json` points at `firebase/firestore.transition.rules`,
which is the final rules with exactly one clause swapped: `deepKey` may equal
the new formula (`floor * 1,000,000 + steps`) or the old 2.2.0 one
(`floor * 1,000,000 + (999,999 - steps)`), both computed from the doc's own
floor and steps, and nothing else (report #9, BOARD-28).
`test/unit/firestore-transition-rules.test.js` proves the one-clause
difference and refuses every third value. The plain command is the 2.3
cutover (`docs/RELEASING.md`, "Release 2.3.0"). Until a re-key, a 2.2.0 run
mis-orders only among runs tied on the same floor (accepted, CONTEXT). The
first transition deploy was deferred by the user at Phase 87's end (87-08);
it is still pending (see the Phase 87 record in section 14).

After a transition deploy, prove the live rules with
`node tools/boards-smoke.mjs --transition`: it signs up anonymously, creates a
run with the 2.3 `deepKey`, creates a run with the exact 2.2.0 `deepKey`
(`legacyDeepKeyOf`, the value a shipped vc12 client writes), confirms a third
`deepKey` value is refused, then erases its runs and deletes its account (in a
`finally`, even when a step fails). Every step must PASS. Against the final
rules the `create-legacy-key` step fails, which is how the probe tells the two
rule sets apart. It is a Phase 87 transition artifact, deleted at the 2.3
cutover.

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

**Erasing your runs.** ERASE MY RUNS in the ☰ account block (a two-tap
arm-in-row confirm, Compete ON only) deletes every one of the player's own
`runs` docs across every season, then deletes the anonymous Identity Toolkit
account (`accounts:delete`) — but keeps the player's rolled `@handle`:
`src/browser/boardSync.js#erase` calls `identity.setHandle(handle)`
immediately after the drop, re-seeding `ddr.identity.v1` with the SAME
handle and no `uid` (user choice, 2026-09-29), so the next Compete-ON run
signs up a brand-new anonymous account under that same handle. Any unsent
queued runs are discarded the moment the erase succeeds, so nothing of the
erased account can post moments later under the new one; a failed erase
changes nothing (the old identity and queue stay exactly as they were).
Erase is board-only — YOUR DEAD (`ddr.runs.v1`), the old graveyard and bests
keys all stay on the phone untouched.

**Re-roll.** RE-ROLL HANDLE is unlimited and rolls a new handle locally, at
once — even offline, even with Compete OFF — and leaves a pending-rewrite
mark (`ddr.handleRewrite.v1`) that a later Compete-ON flush clears only once
it has rewritten the new handle onto every one of the player's board runs;
several offline re-rolls collapse into a single rewrite carrying whatever
handle is current when the flush finally runs.

The ☰ account block and the title's corner sheet are this UI (Phase 85);
`boardSync.js` decides all of it, so the shell only wires taps to calls.

The identity is **shared with bug reports** (SRV-09) — a player-tapped
**Send** on the bug-report sheet may create this same identity even with
Compete OFF (`getToken({ explicit: true })`, the one Compete-gate escape
hatch `firebaseAuth.js` offers).

**A per-IP limit on new anonymous sign-ups** (~10/hour, SRV-10) is set in
live setup, not in client code — it is a Identity Toolkit project-level
control. Recorded live in section 14 by 83-08.

## 8. The queue and the backfill

**`ddr.runQueue.v1`** (83-06): a durable, pure, DOM-free queue.
Enqueue on death — non-dev, Compete ON only — through
`src/browser/boardSync.js#record` at the moment `engineAdapter.js`
reports a run. Flush on enqueue, on app resume (`visibilitychange`
turning visible) and forced on the browser/OS `online` event. Exponential
backoff between unforced flush attempts. A rules **rejection** (400/403,
permission or validation) drops that queue entry with a log line — it will
never become valid by retrying. An "already exists" response (the run's own
idempotent create) is treated as **acknowledged**, not a failure. 15-second
request timeouts. Never double-submits the same run. `purge()` empties the
queue the moment Compete goes OFF. The native pause path awaits
`boardSync.js#waitForPending` — storage writes only, never a flush's own
network call.

**`ddr.boardBackfill.v1`** (83-12, bounded by 85-02): the boards start from
the 2.1.0 release (user, 2026-09-28). Once, at the first launch with Compete
ON, the player's local runs with `when` at or after `BACKFILL_SINCE_MS`
(2026-09-28T19:41:01Z, the `v2.1.0-play11` tag) are queued, stamped version
`"2.1.0 (11)"` — but only the ones whose hash the local run history
(`src/browser/runHistory.js`, `ddr.runs.v1`) already imported under that
same `"2.1.0 (11)"` label (`preReleaseHashes(history)`, an orchestrator
decision, 2026-09-29). This closes a gap a timestamp-only cutoff would
leave open: without it, a 2.2 run played with Compete OFF would still land
in the old graveyard/bests stores with a post-cutoff `when` and could be
queued stamped `"2.1.0 (11)"` the first time Compete turned ON, breaking the
"a run played with Compete OFF is never uploaded" ruling (user, 2026-09-29).
A device whose very first 2.2 launch has Compete OFF marks the backfill
done-as-skipped right there (a local write, zero network) — the Compete
setting at that first launch stands in for the per-run flag 2.1.0-era runs
never carried, so a **later** Compete-ON launch never uploads them either.
YOUR DEAD and the INTERRED count import the same pre-cutoff runs, unbounded
by the local-history check (Phase 84) — only the board upload is bounded.
The call site is `src/browser/boardSync.js#boot`, at launch.

The retired pre-2.2 submission-queue key (`ddr.pgsqueue.v1`, the old Play
Games queue) is removed silently at every launch, Compete ON or OFF
(RETIRE-03) — also in `boardSync.js#boot`.

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

# Phase 87 (BOARD-28) transition tool: move runs filed with the old 2.2.0
# DEPTH key onto the most-steps key. A dry run by default (prints scanned /
# current / old / left-alone counts), --yes to patch:
node tools/boards-admin.mjs rekey-deep
node tools/boards-admin.mjs rekey-deep --yes
```

**`rekey-deep [--season N|--all-seasons] [--yes]`** reads every run in the
season (one billed read per run) and classifies its `deepKey` against its own
floor and steps: already on the new formula, on the 2.2.0 formula (to be
re-keyed), or neither (left alone and reported). It is a dry run unless
`--yes`, and idempotent: a second `--yes` finds nothing left to move. It
patches only `deepKey`, with the operator's admin credentials (which bypass
the security rules, so it works under either rule set). It is a Phase 87 transition artifact, run at the 2.3
release and again at the final-rules cutover (`docs/RELEASING.md`, "Release
2.3.0"), then deleted.

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

**Status: Task 1 complete (83-08).** Deploy, indexes, service APIs, the API
key restriction, anonymous sign-in and the per-IP sign-up limit are all done
and verified live. Board smoke (Task 2) follows below once run.

### Deploy and configuration (2026-09-29)

- **Rules deployed (transition, not final — see the Transition amendment in
  `.planning/phases/83-leaderboard-server/83-08-PLAN.md`):**
  `firebase deploy --only firestore:rules,firestore:indexes --config
  firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive`
  — deploy complete, `firebase/firestore.transition.rules` released to
  `cloud.firestore`. The **transition** rules are live: the `bugReports`
  create clause keeps the legacy unauthenticated form so the shipped 2.1.0
  build (vc11) keeps filing reports; `runs`/`banned`/`reportLimits` are the
  final rules unchanged. Two compiler warnings only (not errors): unused
  function `limitPath` and an `Invalid type` note on `isValidLimitStep`'s
  `before == null` check — both pre-existing to the transition swap (the
  legacy `bugReports` create no longer calls `limitPath`/`isValidLimitStep`,
  but `reportLimits`'s own create/update rules still do). **Release-day
  step:** when the 2.2 build reaches testers, deploy `firebase.json` (the
  final rules), run `node tools/bug-reports/send-test-report.mjs
  --probe-rules` (expect ten PASS), then delete
  `firebase/firestore.transition.rules`, `firebase.transition.json` and
  `test/unit/firestore-transition-rules.test.js` (section 6). The full
  ordered sequence is `docs/RELEASING.md`'s "Release 2.2.0: the ordered
  checklist".
- **Indexes:** all **19 of 19** composite indexes reached `READY` (polled
  `gcloud firestore indexes composite list`, 4 polls at 60s intervals, ~4
  minutes to build) — matches `firebase/firestore.indexes.json`'s declared
  count exactly.
- **Services enabled:** `firestore.googleapis.com`,
  `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` were
  **already enabled** on `delve-die-repeat-6ba5f` (no `gcloud services
  enable` call needed).
- **API key restriction:** key resource
  `projects/262391895405/locations/global/keys/729a18b6-…` (the same public
  key `src/browser/firebaseConfig.js` ships, display name "DDR bug reports
  (Firestore only)"). Before: `apiTargets: [firestore.googleapis.com]`, no
  other restriction fields set. Updated with all three targets in one
  `gcloud services api-keys update --api-target=...` call (Pitfall 8 — the
  flag replaces, not adds). After: `apiTargets: [firestore.googleapis.com,
  identitytoolkit.googleapis.com, securetoken.googleapis.com]`, still no
  other restriction fields — confirmed via a second `describe` call.

### Anonymous sign-in — RESOLVED (console step + live proof, 2026-09-29)

`GET
https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config`
initially returned `404 { "message": "CONFIGURATION_NOT_FOUND", "status":
"NOT_FOUND" }` for both GET and the matching `PATCH
...?updateMask=signIn.anonymous.enabled` (Research Open Question 1) — this
project's Firebase Authentication had never been opened in the console, so
there was no Auth config document yet for the admin v2 API to read or
patch. Resolved via the documented console fallback (the user completed
this): Firebase Console → project `delve-die-repeat-6ba5f` → Build →
Authentication → **Get started** (first-time only, creates the Auth config)
→ Sign-in method → Add new provider → **Anonymous** → Enable → Save. The
user explicitly did **not** enable "Automatically delete anonymous
accounts" — deliberately left off, since the anonymous uid is what owns a
player's `runs` docs and deleting it out from under a still-playing device
would orphan their board history; **do not turn this on.**

After the console step, the same admin v2 `GET` confirmed
`signIn.anonymous.enabled: true`. Proven live end to end:
`POST identitytoolkit.googleapis.com/v1/accounts:signUp?key=...` with
`{"returnSecureToken":true}` returned **200** with a `localId` and
`idToken` present, then `POST .../accounts:delete` with that `idToken`
returned **200** and cleanly removed the probe account. No key, token or
`localId` is printed anywhere in this record.

### Per-IP sign-up limit (SRV-10) — SET, no billing/Identity Platform upgrade required

Default (per Google's own quotas table, fetched live this session — see
Sources below): **"New account creation: 100 accounts/hour for each IP
address"** — an instrumentless (Spark, no billing instrument) limit, listed
alongside a separate, unrelated **"Anonymous user accounts: 100 million"**
project-wide total-account cap (not a rate limit). The 100/hour figure is
not broken out by sign-in method in Google's table; `accounts:signUp` with
no credential (anonymous) hits the same "new account creation" code path as
every other sign-up method, so it counts against this same per-IP limit.

`quota.signUpQuotaConfig` was PATCHed to override the default down to our
target:
```
PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config?updateMask=quota.signUpQuotaConfig
{ "quota": { "signUpQuotaConfig": { "quota": "10", "startTime": "<RFC3339>", "quotaDuration": "<seconds>s" } } }
```
This succeeded on the **Spark (no billing instrument) plan** — no "upgrade
to Identity Platform" or billing prompt was ever returned by any of the
calls in this section; the admin v2 config API applies to a stock Firebase
Auth project as-is (resolves Research Open Question 1 for this field too).

`quotaDuration` was probed empirically for a practical ceiling before
settling: `3600s` (1h), `604800s` (7d), `2592000s` (30d) and `31536000s`
(365d) were **all accepted with no error** — no documented or observed
maximum was found. **Final live value:** `quota: 10`,
`startTime: 2026-09-29T09:57:57Z`, `quotaDuration: 31536000s` (365 days) —
**expires 2027-09-29T09:57:57Z**. Confirmed via a follow-up `GET` echoing
exactly these values.

**Renewal command** (run again before the expiry above, or any time the
value needs changing — `NOW` must be a fresh RFC 3339 UTC timestamp each
time):
```bash
TOKEN=$(gcloud auth print-access-token)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config?updateMask=quota.signUpQuotaConfig" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: delve-die-repeat-6ba5f" \
  -H "Content-Type: application/json" \
  -d "{\"quota\":{\"signUpQuotaConfig\":{\"quota\":\"10\",\"startTime\":\"${NOW}\",\"quotaDuration\":\"31536000s\"}}}"
```

**Source:** `https://cloud.google.com/identity-platform/quotas` ("Quotas
and limits", fetched live 2026-09-29 — "Account creation and deletion
limits" and "Account limits" tables).

### Board smoke (2026-09-29)

First live `node tools/boards-smoke.mjs --with-admin` run: 5/17 steps PASS,
then **FAIL totals** — `{"stat":"deep","shape":{"race":null,"sub":null},
"reason":"refused","status":"PERMISSION_DENIED"}`. Root cause: the `runs`
list rule (`allow list: if request.query.limit <= 50;`) evaluates `null <=
50` as `false` for a `runAggregationQuery`'s `count()`, which carries no
`limit` field at all — so every `total()`/`rankOf()` read was refused live,
even though it was never exercised by any offline test against
`fakeBoardServer.js` (which does not itself enforce the rules text). This
is exactly the live-only difference Research Pitfall 3 flagged as needing
proof against the real project.

**Fix (the pre-agreed "count queries refused under `allow list`" branch of
this plan's Task 2 action):** the `runs` list rule became `allow list: if
request.query.limit == null || request.query.limit <= 50;` in **both**
`firebase/firestore.rules` and `firebase/firestore.transition.rules`
(kept identical, per `test/unit/firestore-transition-rules.test.js`), the
rules contract test (`test/unit/firestore-rules.test.js`) updated to match,
redeployed with `firebase deploy --only firestore:rules --config
firebase.transition.json --project delve-die-repeat-6ba5f
--non-interactive`, and the smoke rerun.

**Final live run: all 17/17 steps PASS, exit 0.**

| Step | Result |
|---|---|
| signup | PASS |
| create-a | PASS |
| resubmit-a | PASS |
| create-b | PASS |
| top-ten | PASS |
| totals | PASS |
| ranks | PASS |
| deny-bad-key | PASS |
| deny-other-id | PASS |
| deny-no-auth | PASS |
| deny-non-handle-update | PASS |
| deny-list-51 | PASS (unaffected by the list-rule fix — `limit: 51` is not `null`, so it is still refused) |
| ban | PASS |
| admin-delete | PASS |
| handle-rewrite | PASS |
| erase | PASS |
| account-deleted | PASS |

**Facts:** `duplicateStatus: 409` (the `:commit` precondition-failure status
the live project returns for a resubmit of an already-created run — differs
from Research Assumption A3's predicted 400, recorded here as the
live-verified answer; `boardWrites.js#submitRun` already classifies both
400 and 403/409 as "exists" via the follow-up `GET`, so no code change was
needed for this), `countUnderListRule: "pass"` (after the fix; was
`PERMISSION_DENIED` before it), `missingIndexes: []` (none — all 19 planned
indexes were sufficient, resolving Research Open Question 2), `commitShape:
"single-write"` (the combined `update`+`updateTransforms`+
`currentDocument.exists:false` single-`Write` form from `runDoc.js#createRunCommit`
was accepted as-is by the live project — the two-`Write` RESEARCH fallback
was never needed).

**Cleanup confirmed:** the final run's own `cleanup` result was `{"erased":
true, "accountDeleted": true, "banCleared": null}` (`banCleared` is `null`
because the `ban` step's own `admin.api.clearBan` already cleared it before
the `finally` block ran — not a failure). Independently confirmed after the
run with `node tools/boards-admin.mjs top --stat deep --race Troll --sub
"Court Mage"` and `--stat kills` (same filters): **`(no runs)`** for both —
no "Smoke Probe" row remains on the live board from any of this session's
runs (the first, failed run's `create-a`/`create-b`/`ban`/`clearBan` were
also cleaned up by the smoke's own `finally` block before it reported
`FAIL totals`, since cleanup always runs regardless of where a step
fails).

**Live behavior vs. the offline model:** only the `list`-rule `null`-limit
gap above; everything else (idempotent resubmit, every stat x race/sub
filter shape for `topTen`/`total`/`rankOf`, every deny probe, the admin
ban/delete round trip, handle re-roll, owner erase, account deletion)
matched `fakeBoardServer.js`'s offline model exactly. No rule was weakened
to make a step pass (Threat T-83-37) — the fix widens `list` only for the
`null`-limit case a `runAggregationQuery` produces, which a `runQuery` can
never send.

**Human verification (deferred to end of run):** none — this plan ships no
device-testable surface (live infra config and a dev-only Node smoke tool;
no UI, nothing shipped in the app this plan).

### Run-doc fields note and when (Phase 84, 2026-09-29)

**Deploy command (transition rules only, never `firebase.json` this
milestone):**
```
firebase deploy --only firestore:rules --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive
```
Result: **"Deploy complete!"** — `firebase/firestore.transition.rules`
(carrying the new `note`/`when` clauses in `isValidBoardRun`, identical to
`firebase/firestore.rules` outside the transition header and the
`bugReports` create clause) released to `cloud.firestore`. Same two
pre-existing compiler warnings as 83-08's transition deploy (unused
`limitPath`, an `Invalid type` note on `isValidLimitStep`'s `before == null`
check) — neither is new, neither is an error.

**Smoke command:** `node tools/boards-smoke.mjs --with-admin`, run twice
(both to prove a clean re-run). **Both runs: all 17/17 steps PASS, exit
0.**

| Step | Result |
|---|---|
| signup | PASS |
| create-a | PASS |
| resubmit-a | PASS |
| create-b | PASS |
| top-ten | PASS |
| totals | PASS |
| ranks | PASS |
| deny-bad-key | PASS |
| deny-other-id | PASS |
| deny-no-auth | PASS |
| deny-non-handle-update | PASS |
| deny-list-51 | PASS |
| ban | PASS |
| admin-delete | PASS |
| handle-rewrite | PASS |
| erase | PASS |
| account-deleted | PASS |

Every run of `writes.submitRun`/`buildRunDoc` in this smoke carries a
`note` ("cut down by a smoke test") and a `when` (the same timestamp the
run's `seed` already reads from `now()`), so `create-a`/`create-b`/
`resubmit-a` prove the live transition rules accept the new fields exactly
as `src/browser/runDoc.js#validateRunDoc` predicts. `facts`:
`duplicateStatus: 409` (unchanged from 83-08's live-verified answer),
`countUnderListRule: "pass"`, `missingIndexes: []`, `commitShape:
"single-write"`.

**Cleanup confirmed:** `cleanup: {"erased": true, "accountDeleted": true,
"banCleared": null}` on both runs (`banCleared: null` because the `ban`
step's own `clearBan` already cleared it before the `finally` block ran).
Independently confirmed after both runs with `node tools/boards-admin.mjs
top --stat deep --race Troll --sub "Court Mage"` and `--stat kills` (same
filters): **`(no runs)`** for both — no "Smoke Probe" row remains on the
live board.

### DEPTH-key transition deploy (Phase 87, 2026-09-30)

**Status: PENDING. Deferred by the user (2026-09-30, resume signal "defer" at
the 87-08 checkpoint). Nothing ran live.** No firebase deploy, no gcloud call,
no `boards-smoke`, no `boards-admin` was run in Phase 87. The live project
still runs the 2.2.0 final rules (`deepKey` = `floor * 1,000,000 + (999,999 -
steps)` only), which refuse a 2.3 client's run (`floor * 1,000,000 + steps`).
No final-rules deploy and no `rekey-deep --yes` ran either; both remain
Release 2.3.0 steps (`docs/RELEASING.md`).

**Reason:** the user asked whether to push the transition rules now or wait for
a signed closed-testing package, and chose to defer until the deploy is needed.
The offline gate passed first (rules tests 36/36, full suite 8170 pass / 0 fail
/ 2 skipped, the vc12 formula in tag `v2.2.0` confirmed, clean tree), so the
deploy is ready to run on the user's go.

**Trigger (whichever comes first):** the transition rules must be live
- before the milestone-end debug-APK device testing with Compete ON (a 2.3
  debug build submits runs with the new key), or
- at Release 2.3.0 step 1 (`docs/RELEASING.md`), before any 2.3 build submits a
  run.

**Exact command** (from `C:/projects/mazeworld`, on the user's go; never the
plain `firebase deploy`, which points at the final rules and would refuse every
2.2.0 run):
```
firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive
```

**After the deploy, in order:** `gcloud firestore indexes composite list
--project=delve-die-repeat-6ba5f --database="(default)"` (19 composite
indexes, each READY), then `node tools/boards-smoke.mjs --transition` (every
step PASS, cleanup ok), then optionally a read-only
`node tools/boards-admin.mjs rekey-deep` census (dry run, no `--yes`). Replace
this PENDING note with the date, the probe table and the census counts when it
runs.

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
- **`PERMISSION_DENIED` on a `runAggregationQuery` (`total()`/`rankOf()`)
  while `topTen()` works fine** — 83-08 found this live: a `count()`
  aggregation query sends no `limit` field at all, so `request.query.limit`
  is `null`; if the `runs` list rule ever regresses to a bare `limit <=
  50` (dropping the `limit == null ||` clause fixed in section 4), every
  count read is refused even though a plain `runQuery` with an explicit
  limit keeps working. Confirm the rule still reads `request.query.limit ==
  null || request.query.limit <= 50` before suspecting an index or a rank
  key.

## 16. Retiring Google Play Games (Play Console cleanup)

2.2.0 removed Google Play Games from the app (Phase 85, RETIRE-01/RETIRE-02):
sign-in, the four/five Season-1 boards and the plugin are all gone from the
shipped build. This cleanup is a **user step in Play Console**, and it waits
until **2.2 reaches testers** — until then, testers are still on 2.1.0, which
still signs in through Play Games and still posts to these boards (the same
trigger as the rules cutover, section 6). Deleting anything here earlier
would break sign-in and board posting for every tester still on the old
build.

### The Season-1 boards

| Board | Internal key | ID |
|---|---|---|
| DEEPEST | `deep` | `CgkIlvbN0YYPEAIQAg` |
| LONGEST | `days` | `CgkIlvbN0YYPEAIQBA` |
| BUTCHERY | `kills` | `CgkIlvbN0YYPEAIQBQ` |
| PURSE | `gold` | `CgkIlvbN0YYPEAIQBg` |
| LEANEST | `lean` | `CgkIlvbN0YYPEAIQAw` — retired in v2.1; delete it too if `docs/UAT-v2.1.md` row 15.8 never recorded the delete |

Plus the Play Games Services configuration itself (not a leaderboard —
the sign-in setup).

### Steps

1. **Delete each leaderboard.** Play Console → **Delve, Die, Repeat** →
   **Grow users** → **Play Games Services** → **Setup and management** →
   **Leaderboards**: open each board above and delete it. If the console
   refuses to delete a published board, leave it — nothing submits to it any
   more, and it still counts toward the 70-board cap either way (this is
   the same "if the console refuses" outcome the former runbook's section 13
   already documented for LEANEST).
2. **Remove the Play Games Services configuration.** Unpublish it where the
   console allows, then delete or unlink the configuration and its
   credentials. Console labels move over time — verify the exact current
   menu names; the former runbook's publishing path was **Setup and
   management** → **Publishing**.
3. **Optional, the user's call.** The Google Cloud project `517177834262`
   that held the Play Games credentials and its OAuth consent-screen
   branding can be cleaned up in Google Cloud Console. **Never touch the
   Firebase project `delve-die-repeat-6ba5f`** — it is a different project
   and it is what this whole runbook (and bug reports) runs on.

**Source:** the full former Play Games Services runbook, at git commit
`a217d032b0f53fd75640e15dbefd7e0a9d8d336f`:

```
git show a217d032:docs/PLAY-GAMES-SETUP.md
```
