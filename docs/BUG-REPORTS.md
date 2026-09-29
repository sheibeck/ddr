# Player bug reports

Phase 79.3 (BUG-02, BUG-03, BUG-04; D-01 to D-17) + Phase 83 Plan 10
(SRV-09..SRV-11, the todo "Bug report per-player limit and automatic
Firestore cleanup"). How REPORT A BUG works, end to end, and how to run it:
deploy the rules, send a test report, watch the Action, rotate both keys,
kill it in an emergency, and clean up a report on request.

## 1. What the player sees

☰ → **REPORT A BUG** opens a sheet. It states plainly, before Send, that the
report and the run's Oracle will be posted publicly on GitHub, and that the
player should leave out anything private. The player types what happened
(up to 2,000 characters, with a counter near the limit) and taps **Send**.

Sending a report needs the same shared anonymous identity Leaderboards uses
(`docs/LEADERBOARDS.md` section 7) — the first Send on a device creates it
silently, even with Compete off. There is no sign-in screen and nothing
else visibly changes for the player.

The sheet has four states:

- **idle** — Send is disabled until there is text.
- **sending** — the controls lock.
- **sent** — a short thank-you, then the sheet closes and the draft clears.
- **failed** — the draft is kept, the message says what happened (offline,
  a server refusal, or a rate limit — below), and Send stays available to
  retry.

**The per-player limit (SRV-09).** A report needs at least 2 minutes since
the player's last one, and at most 5 reports in a UTC day
(`src/browser/reportLimits.js#REPORT_COOLDOWN_MINUTES`/`REPORT_DAILY_CAP`).
Hitting either limit shows an in-voice failed message naming the actual
wait time (e.g. "The Oracle needs a minute… send it in 4 minutes.") and
keeps the draft — nothing is lost, the player just waits. The sheet checks
its own local record first, so most refusals never touch the network; if
that local record disagrees with the server's (a fresh install, cleared
storage, a second device, or a clock that crossed UTC midnight
mid-session), the live rules still refuse the send and the sheet shows the
server's own answer instead.

If the build ships with no API key (an empty `apiKey` in
`src/browser/bugReportConfig.js`), reporting is unavailable and the row says
so instead of opening a broken sheet.

**What is attached:** the player's text, the run's Oracle as plain text, the
app version, the device's user agent and Capacitor platform, and — only when
a run exists — a small run context (floor depth, class, sub-class, race,
level, step/day count, alive or dead).

**What is never attached:** no account id, no email, no avatar, no Play
Games identity (D-07). The report document itself carries no uid either —
the shared identity's uid appears only as the path of that player's own
`reportLimits/{uid}` document (section 3). The hero's randomly generated
name can still appear inside the Oracle, since the Oracle is the run's own
log.

The game stays fully offline (D-04) except for this one player-started send.
There is no background sending and no queue; a failed send just waits for
the player to retry.

## 2. The path

```
reportSheet.js → bugReport.js → the shared anonymous identity (signs up
                                  lazily, on first Send, even with Compete
                                  off) → one Firestore REST
                                  documents:commit (public API key)
                                     ↓
             bugReports/{id} + reportLimits/{uid}, written together in
             that one commit — a signed-in, rate-limited create
                                     ↓
  .github/workflows/bug-reports.yml, four times an hour (:07, :19, :33, :52)
  (service-account JWT → runQuery → lock → issue → mark filed → retention
   cleanup)
                                     ↓
                a public "player-report" issue on sheibeck/ddr
```

| File | Job |
|---|---|
| `src/browser/reportSheet.js` (79.3-05) | The ☰ row, the sheet UI, its four states, and the rate-limited failed copy (`BUG_REPORT_COPY.failed.limited/cooldown/daily`) |
| `src/browser/bugReport.js` | Pure: Oracle extraction, payload building, validation, the Firestore typed-value encoder, and `sendBugReport` |
| `src/browser/reportLimits.js` | The per-player limit: the 2-minute cooldown / 5-a-day cap, the JS mirror of the rules' `isValidLimitStep`, the report+limit commit, and the local pre-network record the sheet checks first |
| `src/browser/firebaseAuth.js` | The shared anonymous identity (Leaderboards' own module, `docs/LEADERBOARDS.md` section 7, reused here) |
| `src/browser/bugReportConfig.js` | The project id and the public, Firestore-restricted API key |
| `firebase/firestore.rules` | Rules for `bugReports/{id}` and `reportLimits/{uid}`, kept equal to `bugReport.js`/`reportLimits.js` by a contract test — one file, shared with Leaderboards' `runs`/`banned` rules |
| `firebase.json`, `.firebaserc` | Point the Firebase CLI at `delve-die-repeat-6ba5f` for `firebase deploy` |
| `tools/bug-reports/send-test-report.mjs` | Sends a live test report, or probes the rules, from the shipped client code |
| `.github/workflows/bug-reports.yml` | The scheduled/manual Action |
| `tools/bug-reports/file-issues.mjs` | The filer: auth, per-run cap, lock/reconcile, label, issue creation, and the SRV-11 retention cleanup |
| `tools/bug-reports/issue-format.mjs` | The pure issue formatter (including the trimmed-Oracle "until \<date\>" note) and the Firestore typed-value decoder |

## 3. The report document

Every `bugReports/{id}` document holds:

| Field | Type | Bound |
|---|---|---|
| `schema` | int | must be `1` |
| `status` | string | `"new"` on create (client can only ever write this) |
| `text` | string | 1–2,000 characters, trimmed |
| `oracle` | string | ≤ 100,000 characters, plain text, oldest line first |
| `oracleLines` | int | 0–1,000, the kept line count |
| `version` | string | ≤ 64 characters, the stamped `versionName (versionCode)` |
| `platform` | string | ≤ 16 characters, the Capacitor platform (or `"unknown"`) |
| `device` | string | ≤ 400 characters, `navigator.userAgent`, trimmed |
| `clientTime` | string | ≤ 40 characters, an ISO timestamp — informational only |
| `run` (optional) | map | present only when a run exists: `depth`, `cls`, `sub`, `race`, `level`, `steps`, `day` (ints/strings, each bounded) and `dead` (bool) |

This shape is unchanged since Phase 79.3 — no uid, no identity field of any
kind. Document ids are client-generated, 20 random characters from
`[A-Za-z0-9]` (`src/browser/reportLimits.js#randomDocId`).

The Action moves `status` through `new` → `filing` → `filed` (or `failed`
after `MAX_ATTEMPTS`), and adds `attempts` (int), `issueNumber` (int),
`issueUrl` (string), `filedAt`/`failedAt` (ISO strings) and `oracleTrimmed`
(bool, Phase 83) once it has filed or failed the report. The Action trusts
the Firestore-assigned server `createTime`, never the client's `clientTime`,
when it orders reports oldest-first.

**`reportLimits/{uid}`** (Phase 83, SRV-09) — one document per player,
keyed by the shared anonymous identity's uid:

| Field | Type | Meaning |
|---|---|---|
| `last` | timestamp | the request time of the player's most recent report — the 2-minute cooldown clock |
| `day` | timestamp | UTC midnight of the day whose `count` is being tracked |
| `count` | int | reports sent so far that UTC day (1–5) |

`reportLimits/{uid}` is written in the same `documents:commit` as its
matching `bugReports/{id}` create, never on its own.

## 4. The rules

`firebase/firestore.rules` is one file, shared with Leaderboards' `runs`/
`banned` rules (`docs/LEADERBOARDS.md` section 4) — deploy both together:

```
firebase deploy --only firestore:rules,firestore:indexes --project delve-die-repeat-6ba5f
```

**`bugReports/{id}` create** needs, together, in the same request:

- `request.auth != null` — the shared anonymous identity, not the old
  plain unauthenticated create.
- the document shaped exactly like section 3 — `hasOnly`/`hasAll` on the
  exact field set, every type and size bound checked, `status == "new"`
  and `schema == 1`.
- `isValidLimitStep(before, after)`, where `before` is
  `get(reportLimits/{uid}).data` when that document already exists
  (`null` on a player's first-ever report) and `after` is
  `getAfter(reportLimits/{uid}).data` — the *same commit* must also write
  a valid `reportLimits/{uid}` step. `isValidLimitStep` checks the
  2-minute cooldown (`reportCooldownMinutes()`, mirrored by
  `src/browser/reportLimits.js#REPORT_COOLDOWN_MINUTES`) and the 5-a-day
  cap (`reportDailyCap()`, mirrored by `REPORT_DAILY_CAP`) — kept equal to
  the rules by `test/unit/firestore-rules.test.js`.

`get`, `list`, `update` and `delete` on `bugReports/{id}` are all denied for
clients.

**`reportLimits/{uid}`** allows only the owner (`request.auth.uid == uid`)
to `get` their own document (so local storage can be wiped and the count
recovered) and to `create`/`update` it, and only as a step
`isValidLimitStep` accepts. A limit write can only ever spend the signed-in
player's own allowance — nobody can write another player's document. `list`
and `delete` are both denied to every client.

**The day bucket's clock caveat.** `isValidLimitStep` buckets by
`request.time.date()` (UTC). A device clock that crosses UTC midnight
mid-session can see one send refused as a `cooldown`/`daily` failure it
didn't expect; the sheet's message and the kept draft are the only visible
effect — nothing is lost, and the next attempt succeeds normally.

**Old builds.** Every client build up to and including 2.1.0/vc11 posts the
old plain, unauthenticated create. The live rules refuse it by design —
greenfield, no legacy path — the sheet just shows it as a normal failed
send. The fix ships in vc12 or later.

Prove the rules hold live, against the real project:

```
node tools/bug-reports/send-test-report.mjs --probe-rules
```

This runs ten named probes (`tools/bug-reports/send-test-report.mjs
#buildProbes`) that must each come back `403`: `list-read`, `extra-field`,
`wrong-status`, `no-auth`, `no-limit-write`, `cooldown`, `forged-count`,
`sixth-today`, `other-limit-doc`, `list-limits`. The three seeded probes
(`cooldown`, `forged-count`, `sixth-today`) need the developer's own
`gcloud` login (`gcloud auth login`, with the `delve-die-repeat-6ba5f`
project selected) to seed and clean up a `reportLimits/{uid}` document as
an admin; without a working admin token the tool exits 2 instead of running
them. If any probe unexpectedly succeeds, the tool best-effort deletes what
it created and still reports the failure.

### Per-IP sign-up limit

Firebase Identity Toolkit's default per-IP sign-up quota is far higher than
this game needs — an anonymous `accounts:signUp` call happens at most once
per device, ever (section 2). Live setup (83-08) lowers it to about 10 new
accounts per IP per hour: tight enough to blunt a scripted sign-up burst
without affecting real players.

**Live value (copied from `docs/LEADERBOARDS.md` section 14, 83-08):**
default is 100 accounts/hour/IP (`cloud.google.com/identity-platform/quotas`);
`quota.signUpQuotaConfig` was set to **10 accounts/hour**, `startTime:
2026-09-29T09:57:57Z`, `quotaDuration: 31536000s` (365 days) — **expires
2027-09-29T09:57:57Z**. Anonymous `accounts:signUp` (the only sign-up path
this game ever calls) hits the same "new account creation" quota as every
other sign-up method, so it counts against this same limit. Renewal command
(before the expiry above, or any time the value needs changing):

```bash
TOKEN=$(gcloud auth print-access-token)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/delve-die-repeat-6ba5f/config?updateMask=quota.signUpQuotaConfig" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: delve-die-repeat-6ba5f" \
  -H "Content-Type: application/json" \
  -d "{\"quota\":{\"signUpQuotaConfig\":{\"quota\":\"10\",\"startTime\":\"${NOW}\",\"quotaDuration\":\"31536000s\"}}}"
```

## 5. The Action

`.github/workflows/bug-reports.yml` runs four times an hour, at `:07`,
`:19`, `:33` and `:52` (`cron: "7,19,33,52 * * * *"`, chosen off the
top-of-hour peak), and by hand (`workflow_dispatch`, with a `dry_run`
input). It has `permissions: { issues: write, contents: read }` and a
`bug-reports` concurrency group so runs never overlap. It runs `node
tools/bug-reports/file-issues.mjs` on Node 22 with zero npm installs — Node
built-ins plus `issue-format.mjs` only.

Dispatch a dry run by hand, then watch it:

```
gh workflow run bug-reports.yml --repo sheibeck/ddr -f dry_run=true
gh run watch
```

A dry run reads and logs only; it files and deletes nothing.

**Per run:** at most 20 reports filed, oldest `createTime` first. The
limitation: `runQuery` fetches up to 200 `new` documents unordered before
the filer sorts them client-side, so with a backlog past 200 the oldest
report might wait an extra run to be seen at all. Cleanup (section 6) has
its own, separate cap.

**The lock:** before filing, the filer flips a report's `status` from `new`
to `filing` with the document's `updateTime` as a Firestore precondition
(`currentDocument.updateTime`). Any failure of that PATCH means another run
already has it, so this run skips it.

**The stale reconcile:** a report stuck in `filing` for over 10 minutes (the
run died mid-file) is searched for in the latest 100 `player-report` issues
by its hidden marker. Found → mark it filed (writing `oracleTrimmed` and
deleting the document immediately when the Oracle fit whole, same as a
fresh filing). Not found, and under `MAX_ATTEMPTS` (3) → retried. At
`MAX_ATTEMPTS` → marked `failed` with a `failedAt` timestamp.

**The label:** the issue is labelled `player-report`, created lazily if
missing; a `422` (already exists) is ignored.

**The issue format:** the title is `[Player report] <first line, ≤ 70
chars>`. The body, in order: the player's text as a blockquote with every
`@` and `#` neutralised (a zero-width joiner right after each) so nothing can
mention anyone or forge a reference; a small details table (version,
platform, device, floor, hero, level, turn, state, sent at, the Firestore doc
id); then the Oracle inside a collapsed `<details><summary>Oracle (N
lines)</summary>` block, in a code fence at least one backtick longer than
any backtick run the Oracle contains, so it can never break out. The body is
trimmed to fit GitHub's 65,536-character issue-body limit by dropping the
Oracle's oldest lines one at a time, noting how many were dropped and — when
the full Oracle is being kept in Firestore for a while longer (section 6) —
the exact date that trim note names.

The same run that files reports also cleans Firestore up on a retention
schedule — see section 6.

## 6. Retention

The Action's own run also deletes reports and stale limit documents from
Firestore (SRV-11) — the public GitHub issues it files are never touched by
this.

| Case | Deleted |
|---|---|
| Filed, Oracle fit whole (`oracleTrimmed: false`) | right after it is marked filed — the issue already holds everything |
| Filed, Oracle trimmed (`oracleTrimmed: true`) | 30 days after `filedAt` — the issue's trim note says "…until \<date\>", naming exactly this expiry |
| Failed (gave up after `MAX_ATTEMPTS`) | 30 days after `failedAt` |
| `reportLimits/{uid}` | 2 days after `last` — by then the cooldown and the daily count have both expired, so nothing is lost |
| `new` or `filing` | never — those haven't been filed yet (the stale reconcile above is the only thing that touches a `filing` report) |

Retention lengths are named constants in `tools/bug-reports/file-issues.mjs`:
`REPORT_RETENTION_DAYS` (30), `LIMIT_RETENTION_DAYS` (2), and their
millisecond derivations (`REPORT_RETENTION_MS`/`LIMIT_RETENTION_MS`).
`filedAt` and `failedAt` are both ISO-8601 UTC strings, not Firestore
timestamps — the same string format on both fields lets one kind of range
filter (`<` a cutoff string) order every report chronologically without
splitting old and new documents across two comparison types.

**At most `MAX_DELETES_PER_RUN` (100) documents are deleted per run**,
oldest first, across four small index-backed range queries, run in this
fixed order every time:

1. filed, `oracleTrimmed == false` (a leftover the immediate delete missed)
2. filed, `filedAt` past its 30-day retention
3. failed, `failedAt` past its 30-day retention
4. `reportLimits`, `last` past its 2-day retention

Every query's `limit` is whatever remains of the run's 100-delete budget,
never a scan of the whole collection. The three `bugReports` indexes
(`status+filedAt`, `status+oracleTrimmed+filedAt`, `status+failedAt`) and
`reportLimits`' single-field `last` index back these four queries
(`firebase/firestore.indexes.json`, deployed with the rules per section 4).
Anything left over past the 100-delete cap simply waits for the next run —
at four runs an hour, a backlog clears quickly.

A dry run logs `would delete <id> (<reason>)` for every planned deletion and
deletes nothing; a `reportLimits` line never shows the uid — it reads
`would delete reportLimits/<redacted> (<reason>)` instead. A normal run's
one-line summary gains `deleted N [...]`, with `reportLimits` deletions
counted as the bare word `limit` — no uid ever appears in the Action's
public log, in either mode. A failed `DELETE` (any non-2xx) logs a warning
with the HTTP status and does not stop the run.

## 7. Operations

**Sending a test report** through the exact client code the app ships:

```
node tools/bug-reports/send-test-report.mjs             # sends one [TEST] report
node tools/bug-reports/send-test-report.mjs --dry-run    # prints the masked endpoint and body only
```

**The 60-day rule.** GitHub disables a scheduled workflow in a public repo
after 60 days with no repository activity. If that happens here, reports
simply wait safely in Firestore (`status: "new"`) — nothing is lost. Re-enable
the workflow from the repo's Actions tab, or:

```
gh workflow enable bug-reports.yml --repo sheibeck/ddr
```

The next scheduled run (or a manual dispatch) picks up everything that
queued while it was disabled.

**The Spark free quota.** The project is on the Spark plan with billing off,
so it can never be billed, but it also has a daily Firestore read/write
quota. Check the current allowance in the Firebase console before assuming a
burst of reports (or Action runs) is headroom-safe.

**The spam kill switch.** If reports need to stop immediately: deploy a
rules file with `allow create: if false;` in place of the normal create rule
(`firebase deploy --only firestore:rules --project delve-die-repeat-6ba5f`),
and disable the workflow (`gh workflow disable bug-reports.yml --repo
sheibeck/ddr`, or from the Actions tab). This still works exactly as before
Phase 83 — the kill switch is a rules-file swap, independent of the limit
and the cleanup logic. App Check (Play Integrity) is the deferred, stronger
fix — revisit it only if spam actually appears (see the Deferred Ideas in
79.3-CONTEXT.md).

**Deleting a report on request.** Two deletions, both by hand — but this
now only matters *within* the retention window (section 6): once a report
ages out, the Action has already deleted the Firestore document on its own,
and only the filed issue is left to remove. Within the window: delete the
Firestore document in the Firebase console (Firestore Database →
`bugReports` → the document, if it still exists), and delete the filed
issue with:

```
gh issue delete <n> --repo sheibeck/ddr --yes
```

(`gh issue delete` needs admin on the repo.)

## Live proof

Run 2026-09-29 (83-11), after `git push origin master` landed the phase's
code at `8d187f56` (verified `git log origin/master -1` == `git log master
-1`).

### Transition-period `--probe-rules` results

**Amendment (user ruling 2026-09-29):** the live project runs the
**transition** rules (section 4's "Old builds" clause — `bugReports` create
still accepts the legacy unauthenticated form the shipped 2.1.0/vc11 build
sends), so an unauthenticated create and a signed-in create with no
same-commit `reportLimits` step are *expected* to succeed under transition
rules, not refused. The full ten-PASS proof is a release-day step (after
`firebase.json`'s final rules are deployed — section 4, and
`docs/LEADERBOARDS.md` section 14's "Release-day step"); this run records
what the transition rules actually do today, without loosening or tightening
anything to make a probe pass.

`node tools/bug-reports/send-test-report.mjs --probe-rules` (exit 1 — 8/10,
as expected under transition rules):

| Probe | Result | Note |
|---|---|---|
| list-read | PASS (403) | |
| extra-field | PASS (403) | |
| wrong-status | PASS (403) | |
| no-auth | **FAIL (200)** | expected — the transition `bugReports` create clause still accepts the legacy unauthenticated form; refused only after the release-day cutover to `firebase.json` |
| no-limit-write | **FAIL (200)** | expected — the legacy create path never required a same-commit `reportLimits` step; refused only after the cutover |
| cooldown | PASS (403) | |
| forged-count | PASS (403) | |
| sixth-today | PASS (403) | |
| other-limit-doc | PASS (403) | |
| list-limits | PASS (403) | |

Both unexpected 200s created a probe document (`probenoauth1790678083512`,
`probenolimitwrite1790678083512`); the tool's own best-effort cleanup
deleted both (`created <id>, deleted` printed for each) — nothing left
behind. SRV-09's checkbox stays unchecked per the Transition amendment; the
release-day run of this same command, expected all-PASS, is what checks it.

**Deviation (Rule 1/3):** `send-test-report.mjs#adminAccessToken()` called
`gcloud auth print-access-token` through a plain `execSync`, which fails on
this Windows machine's bash-archive Cloud SDK install (ships only the
`gcloud` shell script, no `gcloud.cmd`, so `cmd.exe` can't run it) — the tool
exited 2 ("no gcloud admin token available") even with a working `gcloud`
login. Fixed to retry once through Git Bash on a Windows failure, the same
pattern `tools/boards-admin.mjs#execGcloud` already uses; verified by a
successful `--probe-rules` run immediately after.

### Release-day `--probe-rules` results (2.2.0)

**Status: done, ten PASS (2026-09-29).** Run at `docs/RELEASING.md`'s
"Release 2.2.0: the ordered checklist" step 5, right after the user
confirmed 2.2.0 (vc12) is live on the testing track and the final rules
were deployed with `firebase deploy --only firestore:rules,firestore:indexes
--project delve-die-repeat-6ba5f --non-interactive` (default `firebase.json`,
`firebase/firestore.rules`). `no-auth` and `no-limit-write` flipped from the
transition-period `FAIL (200)` above to `PASS (403)`, as expected. From this
deploy on, the 2.1.0 build's unauthenticated REPORT A BUG is refused
(accepted by the user, 2026-09-29). SRV-09 is satisfied.

`node tools/bug-reports/send-test-report.mjs --probe-rules` (exit 0):

| Probe | Result |
|---|---|
| list-read | PASS (403) |
| extra-field | PASS (403) |
| wrong-status | PASS (403) |
| no-auth | PASS (403) |
| no-limit-write | PASS (403) |
| cooldown | PASS (403) |
| forged-count | PASS (403) |
| sixth-today | PASS (403) |
| other-limit-doc | PASS (403) |
| list-limits | PASS (403) |

### Live cleanup proof

1. `node tools/bug-reports/send-test-report.mjs` → `{"ok":true,"id":"4zGI3tzp9sJOhwQB0shx"}`
2. `gh workflow run bug-reports.yml --repo sheibeck/ddr` (not a dry run) → run
   [`36556480792`](https://github.com/sheibeck/ddr/actions/runs/36556480792),
   watched to `success`.
3. Run log's summary line: `filed 1 [4zGI3tzp9sJOhwQB0shx] | reconciled 0 []
   | skipped 0 [] | failed 0 [] | deleted 1 [4zGI3tzp9sJOhwQB0shx
   (filed-full)]` — the report was filed and its Firestore document deleted
   in the same run, immediately after filing (Oracle fit whole,
   `oracleTrimmed: false`).
4. Issue [#7](https://github.com/sheibeck/ddr/issues/7) (`[Player report]
   [TEST] Phase 83 live end-to-end check...`) exists, body starts with the
   marker for id `4zGI3tzp9sJOhwQB0shx`.
5. Admin GET `bugReports/4zGI3tzp9sJOhwQB0shx` → **404**, confirming the
   document is gone.
6. Issue #7 closed with a comment recording this was the Phase 83 live
   cleanup proof and that its Firestore document was deleted after filing.

### Legacy pass (pre-Phase-83 documents)

- **Failed reports without `failedAt`:** admin `runQuery` for
  `bugReports` where `status == "failed"` (limit 100) → **0 documents**.
  Nothing to patch; every failed report already carries `failedAt` (or none
  exist yet).
- **Filed reports with no `oracleTrimmed` field (pre-Phase-83):** admin
  `runQuery` for `bugReports` where `status == "filed"` → **5 documents**,
  all missing `oracleTrimmed` (pre-dates Phase 83's field) but all already
  carrying `filedAt` — no patch needed. `cleanupRun`'s Q2 sweep
  (`status == "filed" AND filedAt < cutoff`) does not require
  `oracleTrimmed` to be present, so these 5 retire on their own 30 days
  after their existing `filedAt`, same as any other filed report.

### Scheduled run

`gh run list --repo sheibeck/ddr --workflow bug-reports.yml --event schedule
--limit 5 --json databaseId,createdAt,conclusion`:

| Run id | createdAt | conclusion |
|---|---|---|
| `36529349414` | 2026-09-29T06:05:58Z | success |

A schedule-triggered run already exists (fired on the `7,19,33,52 * * * *`
cron before this plan's own push — the cron was pinned in 83-10) — SRV-12 is
proven directly, no fix was needed. Every non-schedule run in the same
`gh run list` window (`workflow_dispatch`) also completed `success`.

## 8. Keys and rotation

**The API key.** A public identifier restricted to the Cloud Firestore API —
not a secret. It lives only in `src/browser/bugReportConfig.js`. To rotate
it: create a new key restricted the same way, ship an app update carrying
it, wait for that update to be live, then delete the old key. Any build still
holding the old key then gets refused by Google, not by this app's own
rules — the sheet shows it as a normal "failed" send.

**The service-account key.** It lives only in the `FIREBASE_BUG_REPORTS_SA`
repo secret; the Action reads it and it never touches the repo or `www/`.
Rotation:

1. `gcloud iam service-accounts keys create <scratch path>`
2. `gh secret set FIREBASE_BUG_REPORTS_SA --repo sheibeck/ddr < <file>`
3. delete the local file
4. `gcloud iam service-accounts keys delete <old key id>`

The service account is
`ddr-bug-reports@delve-die-repeat-6ba5f.iam.gserviceaccount.com` with
`roles/datastore.user` only — nothing else in the project. `roles/
datastore.user` is also what lets it `DELETE` documents for the section 6
cleanup; no separate role or grant is needed.

## 9. Troubleshooting

- **"`FIREBASE_BUG_REPORTS_SA` is not set" warning** — the repo secret is
  missing; the run exits 0 having read nothing. Set the secret (section 8).
- **A `403` from `runQuery`** — the service account is missing
  `roles/datastore.user`, or the key is for the wrong project.
- **A `400`/`401` from the token exchange** — the service-account key was
  revoked (rotated without updating the secret), or there is clock skew on
  the runner.
- **No issues appearing** — check whether the workflow is disabled (the
  60-day rule, section 7) or a dry run is on.
- **A report stuck in `filing`** — normal for up to 10 minutes; the next run
  reconciles or retries it (section 5).
- **A player's send fails with `limited`/`cooldown`/`daily` and they insist
  they haven't sent anything recently** — check their `reportLimits/{uid}`
  document directly (Firestore console); a shared/emulator device, or a
  clock that crossed UTC midnight, can produce a stale local record (section
  4's day-bucket caveat).
- **Reports keep growing in Firestore despite the Action running** — check
  the run's own log line for `deleted N [...]`; `N` staying `0` on a run
  that should have cleanup work usually means the composite indexes
  (section 6) haven't finished building yet, or aren't deployed.

## 10. Privacy and Play

The Data safety answers live in `store-listing/LISTING.md`'s `## Data
safety` section (reconciled for 2.2 in Phase 86), and the privacy text
lives in darktier-studio `src/pages/privacy/apps.astro` (pushed to its
`main` in Phase 86, deployed at the 2.2 release — `docs/RELEASING.md`
step 7). The user enters the Data safety answers in Play Console at
`docs/RELEASING.md`'s checklist step 8.
