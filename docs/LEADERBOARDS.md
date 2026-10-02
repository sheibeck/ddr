# Leaderboards

Phase 83 (SRV-01..SRV-12), reworked by Phase 91.2 (BOARD-31..BOARD-33). Our own
leaderboard: no Firebase SDK, plain `fetch` against Firestore/Identity
Toolkit/Secure Token REST, on the same Firebase project as the bug reports
(`delve-die-repeat-6ba5f`, `.firebaserc`). Since 2.3 every board name is the
player's verified **Google Play Games name**, written by one Cloud Function
(`boardName`), so the project moves from Spark to the Blaze plan (section 11).
This is the ops runbook — deploys, the rules, indexes, identity, the queue and
the sign-in hold, live setup and key restrictions, the SEASON bump, quotas,
moderation with `tools/boards-admin.mjs`, and the kill switch. The console side
of Play Games sign-in is `docs/PLAY-GAMES-SETUP.md`; the ordered release steps
are `docs/RELEASING.md` "Release 2.3.0".

## 1. What the board is

The board is our own Firestore `runs` table, not a third-party service — no
SDK, plain `fetch`, every network call injected so every module is
unit-testable with no network. `runs`/`banned` reads are public per the rules
(section 4); writes always carry the Play Games-linked identity's own uid and
the verified Play Games name (section 7).

**The names gate (BOARD-31).** A run is accepted only when its `handle` field
equals `names/{uid}.name`. That document is the trust anchor: only the
`boardName` Cloud Function (after Google's own sign-in record confirms a
`playgames.google.com` provider on the caller's account) and
`tools/boards-admin.mjs` ever write it, both through IAM. `names` and
`nameOverrides` are closed to every client, read and write, so a client can
neither pick nor change the name it posts under (there is no rename path and
no client update at all). The function returns the name to the client, which
caches it. The field is still called `handle` on the run document because
shipped 2.2.0 clients decode it for the board headline.

Compete is the opt-out (the Play Games predecessor was private-by-default and
became a ghost town — see `.planning/phases/83-leaderboard-server/83-CONTEXT.md`
"Specific Ideas"). Compete **ON** needs Play Games sign-in (D-12); a run
finished while signed out is held, not lost (section 8). With Compete OFF, this
whole path makes zero network calls — no sign-up, no sign-in, no Play Games
SDK start, no submission, no read — except the one player-tapped bug-report
Send escape hatch (SRV-09, `docs/BUG-REPORTS.md`), which keeps using an
anonymous identity.

**2.2.0 runs.** A run a 2.2.0 client posted keeps its rolled `@handle` on the
board until its owner updates to 2.3 and signs in with Play Games (D-04); the
server then restamps every run of that uid with the Play Games name (the claim,
or the adopt, section 7). A 2.2.0 client's new runs are refused once the final
rules are live (D-13, section 6).

Android debug and release builds both talk to the **live** board. The
browser dev loop (non-native, `npx serve`/`live-server`) selects
`src/browser/fakeBoardServer.js`'s in-memory fake instead (which also fakes
Play Games sign-in and the `boardName` function) — the shell makes that choice,
not this layer. Start-at-depth dev runs (`state.dev`) are **never submitted**,
live or fake.

## 2. The path

```
death (non-dev, Compete ON)
        │
        ▼
  ddr.runQueue.v1  (enqueue; flush on enqueue/resume/online; backoff;
        │           HOLD while not signed in, no backoff)
        ▼
  firebaseAuth.js  (identity v2: Play Games sign-in, link / adopt, claim the
        │           verified name from the boardName function, bearer token)
        ▼
  runDoc.js / boardWrites.js  (build + commit the run doc under that name)
        │
        ▼
  Firestore REST  (firestore.rules: create-only, owner-gated, shape-checked,
        │           handle == names/{uid}.name)
        ▼
     runs/{uid}_{hash}
        │
        ▼
  boardClient.js  (topTen / total / rankOf — public reads, 5-minute cache)
        │
        ▼
tools/boards-admin.mjs  (top / suspicious / delete-run / ban / unban / export /
                         names / name-override / name-clear)
```

| File | Job | Plan |
|---|---|---|
| `src/browser/firebaseConfig.js` | The shared project id + public API key, `PLAY_GAMES_CONFIG` (APP_ID, web client ID), `BOARD_NAME_FN` | 83-01, 91.2-01 |
| `src/browser/firestoreRest.js` | The one typed-value encoder/decoder, REST URL builders, `timedFetch` | 83-01 |
| `src/browser/playIdentity.js`, `android/.../PlayIdentityPlugin.java` | The Play Games sign-in seam (init, status, signIn, serverAuthCode) and its fake; the SDK starts only when Compete is ON | 91.2-01 |
| `functions/board-names/`, `tools/board-names/deploy.mjs` | The `boardName` Cloud Function (writes `names/{uid}`) and its one deploy command | 91.2-02 |
| `src/browser/nameClient.js`, `src/browser/boardName.js` | The client of the function and the shared name sanitizer | 91.2-02, 91.2-03 |
| `src/browser/nameFilter.js` | The safety-list mask for board names (D-08) | 91.2-02, 91.2-07 |
| `src/browser/runDoc.js` | The run document contract, rank keys, the rules' JS mirror, commit/query builders | 83-02 |
| `src/browser/reportLimits.js` | The per-player bug-report cooldown/daily-cap mirror | 83-02 |
| `firebase/firestore.rules`, `firebase/firestore.indexes.json` | The deployed rules and composite indexes | 83-02, 91.2-04 |
| `src/browser/firebaseAuth.js` | Identity v2: sign-up, refresh, Play Games link / adopt, claim, rename, account switch | 83-03, 91.2-05 |
| `src/browser/fakeBoardServer.js` | The browser dev loop's in-memory REST model of the whole board, with fake Play Games, `names` and `boardName` | 83-04, 91.2-03 |
| `src/browser/boardClient.js` | `topTen`/`total`/`rankOf`/`ownRuns`, cached, public | 83-04 |
| `tools/boards-admin.mjs` | Moderation and balance export (this file) | 83-05, 91.2-04 |
| `src/browser/boardWrites.js`, `src/browser/runQueue.js`, `src/browser/boardSync.js` | Idempotent submit under the session name, erase, the submission queue with the sign-in hold, sessions and the D-05 re-post | 83-06, 91.2-05, 91.2-06 |
| `src/browser/runBackfill.js` | The once-only backfill of runs from the 2.1.0 release on | 83-12 |
| `src/browser/pgsProbe.js` | The dev-row PLAY GAMES PROBE that proves the spike gates on a device | 91.2-03 |
| `tools/boards-smoke.mjs` | The live end-to-end smoke test (default, `--function`) | 83-07, 91.2-04 |

Board strings (`name`, `handle`, `epitaph`) now include one player-typed one:
`handle` is the Google Play Games name, which Google lets players choose, so it
is free text from our point of view. It crosses a trust boundary once it reaches
another player's device. **Every board string is rendered as text
(`textContent`, never `innerHTML`) — no board string is ever trusted as HTML**
— and a name containing a word from the safety list (`content/safety-wordlist.js`,
through `nameFilter.js`) shows as a neutral placeholder with a neutral avatar
(D-08). Moderators can also override a name or hide a run (section 12).

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
| `handle` | string | 1–64 chars and, under the rules' create clause, equal to the poster's verified `names/{uid}.name` (the Google Play Games name, `BOARD_NAME_MAX_CHARS`). Runs 2.2.0 posted carry a rolled `@word+word` handle until their owner signs in on 2.3 |
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
  **`names/{uid}` exists and `handle == names/{uid}.name`** (the names gate,
  BOARD-31: `isNamed` is asked before `verifiedName`, because a `get()` on a
  missing document is an error, which denies), and `banned/{uid}` does not
  exist. The rule costs two document reads per create (section 11).
- **`update`** — **none.** SRV-02's "no update" wording holds again: the
  2.2.0 handle-only re-roll update is gone with the re-roll (D-11), and the
  Play Games name is restamped server-side by the function or the admin tool
  through IAM, never by a client. (The deploy-window transition file once kept
  the 2.2.0 re-roll update for unnamed owners; it is history, section 6.)
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

On `names/{uid}` and `nameOverrides/{uid}` (Phase 91.2): `read, write: if
false` for every client, both of them. `names/{uid}` is `{ name, updatedAt }`,
written only by the `boardName` function and the admin tool;
`nameOverrides/{uid}` is `{ name, at }`, a moderator's replacement name
(section 12). The function and the admin tool reach them through IAM, like the
bug-report Action.

A shipped 2.2.0 client (an anonymous uid, an `@handle`, the re-roll update) is
refused by these final rules, silently (D-13): an anonymous uid has no names
document. Its queue drops the refused run and keeps it locally (section 8's
re-post sends it after the owner updates).

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

### The transition periods (both over)

**The 2.1.0 period (over, 2026-09-29).** While 2.1.0 (vc11) was the build
testers ran, every rules or index deploy used a transition config
(`firebase.transition.json`, pointing at a `firebase/firestore.transition.rules`
copy whose `bugReports` create clause kept 2.1.0's unauthenticated form;
`docs/BUG-REPORTS.md` section 4 "Old builds"). On 2026-09-29, once 2.2.0 (vc12)
was live on the testing track, the final rules were deployed with the plain
command above, `--probe-rules` came back ten PASS (`docs/BUG-REPORTS.md`'s
release-day subsection), and the transition rules, their config and their test
were deleted.

**The 2.2.0 to 2.3.0 period (over, 2026-10-02).** The same two files were
recreated for the DEPTH-key change and the Play Games names (Phase 87 BOARD-28,
Phase 91.2 BOARD-33, D-13), and every rules or index deploy in that window used
`--config firebase.transition.json`. The file was the final rules plus exactly
four differences, so one deploy kept the shipped 2.2.0 build posting while a 2.3
build was tested next to it:

1. the DEPTH key: `deepKey` could equal the new formula (`floor * 1,000,000 +
   steps`) or the 2.2.0 one (`floor * 1,000,000 + (999,999 - steps)`);
2. the legacy handle shape (`isLegacyHandle`, the verbatim 2.2.0 `@word+word`
   regex);
3. a legacy create branch, for a uid with no `names/{uid}` document (the shipped
   2.2.0 client, an anonymous account);
4. a legacy update rule: the 2.2.0 handle-only re-roll update, for an owner with
   no `names/{uid}` document.

A uid with a names document could never use either legacy branch. The live
record is section 14 ("Release 2.3.0 live record (2026-10-02)"): the transition
deploy and its fix (be6716a7), the final-rules cutover and the DEPTH re-key. At
the cutover (2026-10-02) the plain command above deployed the final rules, and
Release 2.3.0 step 4 deleted the transition artefacts:
`firebase/firestore.transition.rules`, `firebase.transition.json`,
`test/unit/firestore-transition-rules.test.js`, the 2.2.0 helpers in
`src/browser/runDoc.js` (`LEGACY_HANDLE_PATTERN`, `isLegacyHandle`,
`legacyDeepKeyOf`, `legacyHandleUpdateCommit`), the fake board server's
transition mode and admin run PATCH, the `rekey-deep` command in
`tools/boards-admin.mjs` and the `--transition` probe in
`tools/boards-smoke.mjs`. **There is one rules file and one config now: the plain
command above is the only deploy.** A 2.2.0 client's run is refused by the live
rules (D-13).

### The smoke probes

`node tools/boards-smoke.mjs` and `node tools/boards-smoke.mjs --function`
prove the deployed rules and function. The default probe needs the admin
credentials the tool resolves up front (it seeds a probe name through the admin
API); `--function` needs none.

- The **default** probe (the final rules) proves the names gate: an unnamed uid
  cannot post, a named uid posts under the probe name, a run whose handle is not
  the verified name is refused, no client update lands (not a handle re-roll, not
  a stat), `names` / `nameOverrides` are closed to client reads and writes, and
  the existing denies, ban, admin delete and erase still hold. Every step must
  PASS and cleanup must be ok.
- **`--function`** needs no admin: it asks the deployed `boardName` function to
  claim a name for an anonymous (not Play Games-linked) account, which must
  answer `NOT_LINKED`, and to release, which must answer ok.

## 7. Identity

Board identity v2 (`src/browser/firebaseAuth.js`, Phase 91.2-05): the board
poster is a Firebase account **linked to the player's Google Play Games
player**, signed in over plain REST (`accounts:signUp`, `accounts:signInWithIdp`,
`accounts:lookup`, `accounts:update`, never the Firebase SDK). The Play Games
side is the `PlayIdentity` seam (`src/browser/playIdentity.js`, the in-repo
Capacitor plugin on Android, a fake in the browser dev loop); the SDK starts
only when Compete is ON. `uid`, `refreshToken`, the cached `idToken` and its
absolute expiry, the link state, the cached verified name and any pending adopt
live in durable storage under **`ddr.identity.v2`** (`src/browser/storage.js`,
separate from settings). A `ddr.identity.v1` record is migrated on first load
(uid and tokens kept so the link can happen, the rolled handle dropped) and the
v1 key removed.

**`boardSession({ interactive })`** is the one call that makes a player ready
to post. It answers `{ ok: true, uid, idToken, name }` or `{ ok: false, reason }`
with `reason` in `off | offline | server | refused | unavailable | signin`.
Compete-gated always and single-flight. In order: the Compete gate and the
config check, the Play Games status (an interactive sign-in only when the player
tapped SIGN IN), an account-switch check, link or sign in, a fresh token, **claim**
(the `boardName` function writes `names/{uid}` and returns the name), then a
rename check. A session is complete only after a claim returned a name (D-06: a
new player's first run waits until their name exists).

**Link, and adopt (BOARD-32).** A stored uid with no link is the 2.2.0
anonymous account: it is refreshed and linked **in place** with its own ID token
(`accounts:signInWithIdp` with the Play Games auth code), so the uid, and
therefore every existing run, is kept and the claim restamps those runs with the
Play Games name. If the link answers `FEDERATED_USER_ID_ALREADY_LINKED`, or
returns a different uid (the player played on another device first), the client
signs in as the linked uid and the function **adopts** the anonymous uid's runs
onto it (the caller proves ownership with the anonymous account's own ID token;
only an account with no providers can be adopted); the anonymous account is
deleted only after the claim succeeds, and an interrupted adopt finishes on the
next session.

**Claim.** The function (`functions/board-names/`, `POST` with the caller's
Firebase ID token) confirms through Identity Toolkit `accounts:lookup` that the
caller has a `playgames.google.com` provider, takes the provider's display name
(`NAME_SOURCE=provider`, the default), sanitizes it, writes `names/{uid}` (a
moderator's `nameOverrides/{uid}` wins) and restamps the uid's runs. Errors are
reason ids: `UNAUTHENTICATED`, `NOT_LINKED`, `ADOPT_REFUSED`,
`NEEDS_GAMES_CODE`, `GAMES_MISMATCH`, `NO_NAME`, `UPSTREAM`. The fallback
`NAME_SOURCE=games` (a redeploy with one env var, no client update) answers
`NEEDS_GAMES_CODE`: the client sends a fresh single-use server auth code, and
the function exchanges it with the web client secret (kept in Secret Manager),
asks the Games API for the player and requires the player ID to equal the
linked provider's. It exists in case spike gate G1 or A4 fails
(`docs/PLAY-GAMES-SETUP.md` section 4).

**Rename.** A player changes their name in Google Play Games, not in our game.
When the local Play Games name differs from the claimed one, the next session
re-signs in and re-claims. If the provider still stores the old name, the client
unlinks and relinks once per launch (one attempt per player and target name; a
failed rename never fails the session). A moderator override is never chased.
Other players see the new name once their next claim has restamped the runs.

**Account switch.** If the device's Play Games player changes, the stored session
is dropped locally (the new player never adopts the old one's runs) and the new
player gets their own uid and name; switching back returns the first player's.

**Refresh.** A cached token is refreshed proactively with a **5-minute safety
margin** (`REFRESH_MARGIN_MS`) — refreshed once fewer than 5 minutes remain,
never waiting for an actual 401. Six known-terminal refresh error messages
(`TOKEN_EXPIRED`, `USER_DISABLED`, `USER_NOT_FOUND`, `INVALID_REFRESH_TOKEN`,
`INVALID_GRANT_TYPE`, `MISSING_REFRESH_TOKEN`) and a `user_id` mismatch clear
the dead tokens; a linked record then restarts anonymously (bug reports keep
working) and the next `boardSession` links again. Every other failure (timeout,
429/5xx, another 4xx) is transient and leaves the stored identity untouched.
No token appears in any result or log.

**Erasing your runs.** ERASE MY RUNS in the ☰ account block (a two-tap
arm-in-row confirm, Compete ON only) deletes every one of the player's own
`runs` docs across every season, then `identity.deleteAccount()` releases the
name through the function (best effort), deletes the Identity Toolkit account
(`accounts:delete`, which also removes the Play Games link) and drops both
identity keys. Any unsent queued runs are discarded the moment the erase
succeeds; a failed erase changes nothing. Erase is board-only — YOUR DEAD
(`ddr.runs.v1`), the old graveyard and bests keys all stay on the phone
untouched. Signing in again later creates a fresh account under the Play Games
name. (Disconnecting the game in Google Play Games settings removes Google's
side; `store-listing/LISTING.md` "Deletion".)

The ☰ account block and the title's corner sheet are this UI (Phases 85 and
91.2-07/08): the name, a NOT SIGNED IN status with a **SIGN IN** row, COMPETE
and ERASE MY RUNS. There is no RE-ROLL HANDLE (D-11). `boardSync.js` decides all
of it, so the shell only wires taps to calls.

The identity is **shared with bug reports** (SRV-09) — a player-tapped
**Send** on the bug-report sheet may create an **anonymous** identity even with
Compete OFF (`getToken({ explicit: true })`, the one Compete-gate escape
hatch `firebaseAuth.js` offers; it never calls Play Games). If the player later
competes, that anonymous account is the one that gets linked.

**A per-IP limit on new anonymous sign-ups** (~10/hour, SRV-10) is set in
live setup, not in client code — it is an Identity Toolkit project-level
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
Games queue) and the retired handle-rewrite mark (`ddr.handleRewrite.v1`, the
2.2.0 re-roll) are removed silently at every launch, Compete ON or OFF
(`RETIRED_KEYS`, RETIRE-03) — also in `boardSync.js#boot`.

**The sign-in hold (D-03, D-06).** Compete ON but not signed in to Play Games
(declined, no profile, or the auto sign-in failed), or signed in but with no
name yet: a finished run is **held** in the queue, not dropped and not
backed-off (`reason: "signin"`: no attempt count, no failure, no `retryAt`). The
game plays on; the ☰ account block and the title sheet show a NOT SIGNED IN
status with a SIGN IN row, and one rail card per launch says so at most. After
the player signs in (or resumes the app signed in) the next flush posts every
held run in order. Offline and server answers still back off exactly as before.
Turning Compete OFF purges held runs like any queued run.

**Sessions.** `boardSync.session()` (quiet, used at boot and on resume) and
`boardSync.signIn()` (interactive, the SIGN IN row) share one routine that
reports the state to the shell (`signedIn` with the name, `signedOut`, `error`,
`off`) and, on `signedIn`, runs the re-post below and then forces a flush.
Compete OFF answers `off` with no identity call, no board call and no Play
Games call.

**The D-05 re-post (once per device, `ddr.boardRepost.v1`).** Once the first
named session on a device exists, the game re-posts the runs a 2.2.0 client
settled but the final rules refused during the refusal window: stored runs
(graveyard and bests, hash re-verified by `collectBackfillRuns({ since: 0 })`)
whose hash is in the queue's `settled` ledger, minus those `ownRuns(uid)`
already lists on the board. The ledger only ever holds runs that were enqueued
with Compete ON, so a run finished with Compete OFF is never eligible (the
"never uploaded" ruling stands). The marker is written after a successful board
read, so a failed read retries next session; a re-posted run that is already on
the board answers "exists" (idempotent). `ownRuns` pages at most 500 rows.

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

**Enable the Play Games sign-in provider and deploy the `boardName`
function** (Phase 91.2, D-01, D-14: each is the user's go, just in time, in the
order of `docs/RELEASING.md` "Release 2.3.0" step 1; the console half is
`docs/PLAY-GAMES-SETUP.md`):

```
POST https://identitytoolkit.googleapis.com/v2/projects/delve-die-repeat-6ba5f/defaultSupportedIdpConfigs?idpId=playgames.google.com
Authorization: Bearer $(gcloud auth print-access-token)
X-Goog-User-Project: delve-die-repeat-6ba5f
Content-Type: application/json

{ "enabled": true, "clientId": "<the Game server web client ID>", "clientSecret": "<read from a file outside the repo>" }
```

If the provider config already exists, `PATCH` the same path plus
`/playgames.google.com?updateMask=enabled,clientId,clientSecret`. `GET` it
afterwards and check `enabled: true`; print only `enabled` and `clientId`, never
the secret (it is never committed, logged or pasted into a doc;
`docs/PLAY-GAMES-SETUP.md` section 4 says the same). Then:

```
node tools/board-names/deploy.mjs --setup          # a dry run: prints the gcloud commands
node tools/board-names/deploy.mjs --setup --yes    # enables the APIs, creates the board-names service account (roles/datastore.user)
node tools/board-names/deploy.mjs --yes            # deploys the 2nd-gen function boardName (us-central1, nodejs22, 256 MiB, 60 s, max 3 instances)
```

The deploy prints the function URL, which must equal `BOARD_NAME_FN.url` in
`src/browser/firebaseConfig.js`. The function is zero-dependency Node 22 ESM
(`functions/board-names/`); it verifies the caller with Identity Toolkit
`accounts:lookup` and writes Firestore over REST with its runtime service
account. The Blaze plan must be attached first (section 11). `--name-source
games --pgs-client-id <id>` redeploys the G1/A4 fallback (section 7); the secret
then lives in Secret Manager (`pgs-web-client-secret`), created from a file
outside the repo.

The function is called with the caller's Bearer token, not the API key, so the
API-key restriction above does not apply to it; the Play Games sign-in itself
uses `identitytoolkit.googleapis.com` through the restricted key, which the
three-service list already covers.

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

## 11. Quotas and billing (Spark, then Blaze)

Until 2.3 the project ran on the Spark plan (billing off — it could never be
billed) with a daily Firestore quota: **50,000 reads, 20,000 writes, 20,000
deletes**, and **1 GiB** stored — shared with bug reports
(`docs/BUG-REPORTS.md`), which is why report retention/cleanup exists at all.

**2.3 moves the project to the Blaze plan (D-01).** The `boardName` Cloud
Function (2nd gen, so Cloud Run, Cloud Build and Artifact Registry behind it)
cannot be deployed on Spark. The user attaches a billing account in the console
(`docs/PLAY-GAMES-SETUP.md` section 2, step 7), and Blaze keeps the same
no-cost free tier for Firestore, so board and bug-report usage is unchanged.
The function is sized to stay inside the free tier too: `--max-instances=3`,
256 MiB, a 60 s timeout, and it writes only when a name changed (a claim is one
Identity Toolkit lookup plus one Firestore read, and a write when the name
moved; stamping and adopt page their runs). **Set a budget alert** (Cloud
Console, Billing, Budgets and alerts, a few dollars) so a runaway shows up as an
email, not a bill. The per-IP anonymous sign-up limit (section 14) was set on
Spark with no billing instrument and is unaffected.

Roughly: a `topTen` read costs **10 reads** (one per returned doc); a
`count`/`total` read costs **1 read per up to 1,000 index entries** scanned
(a 1,500-entry match bills 2 reads); `boardClient.js` caches every read for
**5 minutes** per `(op, stat, race, sub[, key])` to keep this cheap under
normal play. Each run create also costs the rules two document reads (the
`names/{uid}` existence check and its `name`) — the rules' `get`/`exists`
calls bill like reads. Admin `suspicious`/`export`/`names` each **read every
matching run or name once** — fine by hand, never on a schedule (see the header
comment in `tools/boards-admin.mjs`).

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

(`names`, `name-override` and `name-clear` are the Phase 91.2 name
moderation commands, below.)

**History: `rekey-deep`.** Phase 87's one-off DEPTH re-key (it moved runs filed
with the 2.2.0 key onto the most-steps key) ran at the 2.3 release and again at
the final-rules cutover, then was deleted with the other transition artefacts
(section 14, "Release 2.3.0 live record").

**Names (Phase 91.2, D-08).** Every board name is a Play Games name the player
chose, so the moderation tools gained a names half. All three are dry runs
unless `--yes`:

```bash
# Every names/{uid} record the boardName function wrote, with a flagged column
# (the safety-list matcher, src/browser/nameFilter.js) and any moderator
# override; --flagged keeps only the flagged ones, --json emits JSON:
node tools/boards-admin.mjs names
node tools/boards-admin.mjs names --flagged

# Set a moderator name for a uid. It rewrites names/{uid} and restamps every
# run of that uid through the same stamp code the function uses
# (functions/board-names/core.js), so the board shows it at once; the function
# keeps honouring the override on every later claim:
node tools/boards-admin.mjs name-override <uid> "Some Neutral Name"
node tools/boards-admin.mjs name-override <uid> "Some Neutral Name" --yes

# Drop the override; the player's Play Games name returns at their next claim:
node tools/boards-admin.mjs name-clear <uid> --yes
```

- **The client mask.** A name that contains a safety-list word already shows as a
  neutral placeholder with a neutral avatar on every player's board (D-08);
  `names --flagged` is how a moderator finds those names to override or report
  (Google also has an "inappropriate gamer name" report flow).
- **Hiding a run** is the existing `delete-run <id>` (and `ban <uid>` for a
  player's whole set). There is no separate hide flag.
- **Name changes** follow the player's Google Play Games name at their next
  sign-in; an override is never chased by the client or the function.

**Key hygiene:** a service-account key file (if one is ever created) lives
**outside** the repository, never in `www/`. An `--out` export path resolving
**inside** the repo must be named `boards-export*` — `.gitignore` ignores
that pattern, matching `ddr-boards*.json` for a locally-placed key (section
13's `.gitignore` guard). Exports hold uids and Play Games names (a name is public on the board,
but a uid-to-name table is not) — keep them off shared drives.

**A banned player can return** under a fresh uid — `banned/{uid}` keys on
the specific uid. Since 2.3 a board poster must be linked to a Google Play
Games player (the names gate), and a player ID maps to one uid, so coming back
means a different Google account, not just a reinstall; the old anonymous
sign-up loophole no longer reaches the board. This is an accepted residual (full
replay verification is deferred, per
`.planning/phases/83-leaderboard-server/83-CONTEXT.md` "Deferred Ideas").

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
`docs/BUG-REPORTS.md` exactly. To stop new names too, delete the function
(`gcloud functions delete boardName --gen2 --region=us-central1
--project=delve-die-repeat-6ba5f`): no claim means no `names/{uid}` writes, and the
rules already refuse every run without one. `node tools/board-names/deploy.mjs
--yes` brings it back.

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

*Historical record.* Since Phase 91.2 the admin credentials are always required
for the default probe and `--with-admin` no longer exists (the steps and tables
below are the 2.2.0 probe as it ran).

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

**Status: DONE (2026-10-02), see "Release 2.3.0 live record (2026-10-02)"
below. The text that follows is the record as of 2026-09-30, when the user
deferred the deploy at the 87-08 checkpoint and nothing ran live.** No firebase deploy, no gcloud call,
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

**Superseded by the combined deploy (Phase 91.2):** `firebase/firestore.transition.rules`
now also carries the 2.2.0 legacy branch, so the single transition deploy at
`docs/RELEASING.md` "Release 2.3.0" step 1 covers this one too; when it runs,
record it in the Phase 91.2 record that 91.2-10 adds, and replace this PENDING
note with a pointer to it.

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

### Play Games names (Phase 91.2, 2026-10-01): pending

**Status: DONE (2026-10-02), see "Release 2.3.0 live record (2026-10-02)"
below. The text that follows is the record as of 2026-10-01, when the user
deferred both 91.2-10 checkpoints (the console batch and the live go) and
nothing ran live.** No firebase deploy, no gcloud call, no admin-API write, no provider
enable, no function deploy, no `boards-smoke` run, no console step, no push in
any repo, and no web client ID commit (`PLAY_GAMES_CONFIG.webClientId` is still
unset, because the client ID does not exist yet). The live project still runs
the 2.2.0 final rules; the Play Games provider is not enabled; the `boardName`
function is not deployed.

**Reason:** live backend changes go out just in time with the release build
(standing ruling), not during the autonomous run. The offline gate passed first
(2026-10-01): the ten gate suites (firestore rules, transition rules, indexes,
board-names core/http/contract, nameClient, boards-smoke, firebaseAuth,
boardSync; 284 tests) pass, the 2.2.0 (vc12) handle regex in `git show
v2.2.0:firebase/firestore.rules` equals `LEGACY_HANDLE_PATTERN` and is embedded
in `firebase/firestore.transition.rules`, the old `deepKey` formula is still in
`git show v2.2.0:src/browser/runDoc.js` and equals `legacyDeepKeyOf`, so a vc12
run is accepted by the transition rules and refused only by the final rules.
`firebase` 15.29.0 and `gcloud` 579.0.0 are installed.

**This covers Phase 87 too.** The single transition deploy below also deploys
what the Phase 87 PENDING record above describes; when it runs, record it here
and replace both PENDING notes with a pointer to the dated record.

**Trigger:** all of it must run at `docs/RELEASING.md` "Release 2.3.0" step 1,
before any 2.3 build (including the Compete-ON debug APK for the Pixel 7 device
test) submits with Compete ON. A 2.3 build cannot post under today's live rules.

**What the user does (the console batch, `docs/PLAY-GAMES-SETUP.md` path A):**
1. Confirm the Play Games Services configuration `517177834262` still exists
   (say whether it is published). Do NOT remove it.
2. OAuth consent screen in Cloud project `delve-die-repeat`: Audience External,
   In production.
3. Create an OAuth client of type Web application and add it to the Play Games
   configuration as a Game server credential.
4. Check the Android credentials: the Play App Signing key SHA-1 and the debug
   keystore SHA-1.
5. Add testers (your account, the closed-testing track) while the configuration
   has unpublished changes.
6. Firebase project `delve-die-repeat-6ba5f`: attach a billing account (Blaze)
   and set a budget alert.
7. Hand Claude the web client ID, and save the client secret in a text file
   OUTSIDE the repo and give Claude its path. The secret is never pasted into a
   commit or a doc.

**What Claude runs on the user's go (in this order):**
1. Write the client ID into `PLAY_GAMES_CONFIG.webClientId`
   (`src/browser/firebaseConfig.js`), run `node --test test/unit/playIdentity.test.js`,
   commit.
2. Enable the Play Games provider (admin API, secret read from the user's file,
   print only `enabled` and `clientId`), then GET to confirm `enabled: true`.
3. `node tools/board-names/deploy.mjs --setup --yes`, then
   `node tools/board-names/deploy.mjs --yes`; the printed URL must equal
   `BOARD_NAME_FN.url`.
4. The ONE transition deploy (never the plain `firebase deploy`):
   ```
   firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive
   ```
   then `gcloud firestore indexes composite list --project=delve-die-repeat-6ba5f --database="(default)"`
   until every index is READY.
5. `node tools/boards-smoke.mjs --transition` and
   `node tools/boards-smoke.mjs --function` (exit 0, every step PASS, cleanup ok).
6. Record the dated result here (who ran what, provider state with the client ID
   only, function URL, index states, both probe tables with cleanup).

**Not part of this step:** the final rules (which refuse 2.2.0) wait for Release
2.3.0 step 3, with the user's confirmation. They were not deployed.

**Also unpushed (user's choice):** the darktier-studio commit `0f39ee3` (the
privacy, delete-data, terms and game pages saying the board shows the Google Play
Games name, `C:/projects/darktier-studio` branch `main`) is committed but not
pushed and not deployed. Push it and run `npm run deploy` at Release 2.3.0 step
2.7 (`docs/RELEASING.md`).

### Release 2.3.0 live record (2026-10-02)

The transition window closed on 2026-10-02. All of it ran on the user's go
(`docs/RELEASING.md` "Release 2.3.0").

- **Transition deploy and fix (step 1.5, 1.6).** The first live `boards-smoke
  --transition` found the transition rules refused every legacy (2.2.0) run
  create with 403: the named disjunct evaluated `isValidBoardRun` before it
  failed `isNamed`, and the legacy disjunct evaluated it again, past Firestore's
  1,000-expression cap per request. Reproduced and fixed in the Firestore
  emulator by commit **be6716a7** (`isNamed` is asked before
  `isValidBoardRun`; structural guards in the rules tests plus the opt-in
  emulator test). The transition rules were redeployed with the fix: live
  `boards-smoke --transition` **8/8 PASS**, `--function` **4/4 PASS**, every
  index READY, the `boardName` function ACTIVE, the Play Games provider enabled
  (client ID verified).
- **DEPTH re-key (BOARD-28).** `node tools/boards-admin.mjs rekey-deep --yes`
  moved **21** runs from the 2.2.0 key onto the most-steps key, then **0** were
  left on the old key; the census at the cutover reported **22 of 22 runs on the new
  key and 0 on the old**.
- **Final-rules cutover (step 3, 2026-10-02).** The plain `firebase deploy
  --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f
  --non-interactive` put `firebase/firestore.rules` live. The plain
  `node tools/boards-smoke.mjs` passed **every step** (cleanup ok). From this
  moment a 2.2.0 client's run is refused by the live rules (D-13).
- **Clean-up (step 4, 2026-10-02).** The transition artefacts were deleted
  (section 6): the two transition files and their test, the 2.2.0 helpers in
  `runDoc.js`, the fake board server's transition mode and admin run PATCH,
  `rekey-deep` and its classifier, and the `--transition` probe. The
  deploy-window records above stay as history.

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
- **The account block says NOT SIGNED IN (or a run never posts), Compete ON**
  (Phase 91.2) — runs are held, not lost (section 8). Work down the list:
  the Play Games configuration is published or the account is on the Testers
  list; the credential's SHA-1 is the installed build's signer (the Play App
  Signing key for a Play build, the debug keystore for the debug APK); the
  application ID in `games-ids.xml` equals `PLAY_GAMES_CONFIG.appId`; the web
  client ID is in `PLAY_GAMES_CONFIG.webClientId` (empty means sign-in is
  dormant); and the Firebase Play Games provider is enabled (section 9). The
  dev-row PLAY GAMES PROBE names the first step that fails.
  `docs/PLAY-GAMES-SETUP.md` has the console side.
- **`OPERATION_NOT_ALLOWED` on `accounts:signInWithIdp`** — the Play Games
  provider is not enabled on the live project, or its client ID or secret does not
  match the Game server credential (section 9).
- **The function answers `NOT_LINKED`** — the caller's account has no
  `playgames.google.com` provider (the link did not happen, or it is a bug-report
  anonymous account); the smoke's `--function` probe expects exactly this for an
  anonymous account. **`NEEDS_GAMES_CODE`** — the function is deployed with
  `NAME_SOURCE=games` (the fallback); the client sends a fresh code and it should
  resolve. **`UPSTREAM` / `INTERNAL`** — read the function's logs
  (`gcloud functions logs read boardName --region=us-central1 --project=delve-die-repeat-6ba5f`).
- **A well-formed run is refused with `PERMISSION_DENIED` and the player is named**
  — the run's `handle` must equal `names/{uid}.name` exactly. A stale cached name
  (the player renamed in Google Play Games) is refused once, then the client
  re-claims and retries once.
- **A player's name on the board is a neutral placeholder** — the safety-list mask
  (section 12). `names --flagged` lists it; override it if it is a false positive.
- **Compete ON, the game plays, but nothing posts after the final rules**
  — the player is on 2.2.0: its anonymous runs are refused by design (D-13).
  After they update and sign in, the D-05 re-post sends the runs the refusal
  window dropped (section 8).


## 16. The Play Games configuration and the Season-1 boards

**Do NOT remove the Play Games Services configuration.** 2.2.0 dropped Google
Play Games sign-in (Phase 85, RETIRE-01/RETIRE-02) and an earlier version of this
section told the user to delete the configuration at the 2.2 cutover. That step
is **cancelled**: from 2.3 (Phase 91.2, D-09) the game signs in with Google Play
Games again, to name the board, and it reuses the **existing configuration**
(application ID `517177834262`, Google Cloud project `delve-die-repeat`). Deleting
or unlinking it breaks sign-in for every player. The runbook for its console
setup is `docs/PLAY-GAMES-SETUP.md` (path A reuses it; path B creates a new one
linked to `delve-die-repeat-6ba5f` only if spike gate G4 fails).

What stays optional is the **Season-1 leaderboards** inside it, which no build
since 2.2.0 submits to. They count toward the 70-board cap either way, and the
console may refuse to delete a published one; leaving them is harmless.

### The Season-1 boards

| Board | Internal key | ID |
|---|---|---|
| DEEPEST | `deep` | `CgkIlvbN0YYPEAIQAg` |
| LONGEST | `days` | `CgkIlvbN0YYPEAIQBA` |
| BUTCHERY | `kills` | `CgkIlvbN0YYPEAIQBQ` |
| PURSE | `gold` | `CgkIlvbN0YYPEAIQBg` |
| LEANEST | `lean` | `CgkIlvbN0YYPEAIQAw` — retired in v2.1; delete it too if `docs/UAT-v2.1.md` row 15.8 never recorded the delete |

### Optional: deleting the Season-1 boards

1. Play Console → **Delve, Die, Repeat** → **Grow users** → **Play Games
   Services** → **Setup and management** → **Leaderboards**: open each board
   above and delete it. Do this only after 2.2.0 or later is the build testers run,
   since 2.1.0 still posts to them. If the console refuses to delete a published
   board, leave it — nothing submits to it any more.
2. Leave the configuration, its credentials (the Android SHA-1s and the Game
   server credential) and the OAuth consent screen alone: sign-in needs them.
3. **Never touch the Firebase project `delve-die-repeat-6ba5f`** from the Play
   Games console steps — it is a different project from `delve-die-repeat`, and it
   is what the board and bug reports run on.

**Source:** the full former Play Games Services runbook (with the leaderboard
sections that no longer apply), at git commit
`a217d032b0f53fd75640e15dbefd7e0a9d8d336f`:

```
git show a217d032:docs/PLAY-GAMES-SETUP.md
```
