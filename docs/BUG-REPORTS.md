# Player bug reports

Phase 79.3 (BUG-02, BUG-03, BUG-04; D-01 to D-17). How REPORT A BUG works, end
to end, and how to run it: deploy the rules, send a test report, watch the
Action, rotate both keys, kill it in an emergency, and clean up a report on
request.

## 1. What the player sees

☰ → **REPORT A BUG** opens a sheet. It states plainly, before Send, that the
report and the run's Oracle will be posted publicly on GitHub, and that the
player should leave out anything private. The player types what happened
(up to 2,000 characters, with a counter near the limit) and taps **Send**.

The sheet has four states:

- **idle** — Send is disabled until there is text.
- **sending** — the controls lock.
- **sent** — a short thank-you, then the sheet closes and the draft clears.
- **failed** — the draft is kept, the message says what happened (offline vs.
  a server refusal), and Send stays available to retry.

If the build ships with no API key (an empty `apiKey` in
`src/browser/bugReportConfig.js`), reporting is unavailable and the row says
so instead of opening a broken sheet.

**What is attached:** the player's text, the run's Oracle as plain text, the
app version, the device's user agent and Capacitor platform, and — only when
a run exists — a small run context (floor depth, class, sub-class, race,
level, step/day count, alive or dead).

**What is never attached:** no account id, no email, no avatar, no Play
Games identity (D-07). The hero's randomly generated name can still appear
inside the Oracle, since the Oracle is the run's own log.

The game stays fully offline (D-04) except for this one player-started send.
There is no background sending and no queue; a failed send just waits for
the player to retry.

## 2. The path

```
reportSheet.js  →  bugReport.js  →  Firestore REST create (public API key)
                                     ↓
                              bugReports/{id}  (create-only rules)
                                     ↓
        .github/workflows/bug-reports.yml, every 15 minutes
        (service-account JWT → runQuery → lock → issue → mark filed)
                                     ↓
                a public "player-report" issue on sheibeck/ddr
```

| File | Job |
|---|---|
| `src/browser/reportSheet.js` (79.3-05) | The ☰ row, the sheet UI and its states |
| `src/browser/bugReport.js` | Pure: Oracle extraction, payload building, validation, the Firestore typed-value encoder, and `sendBugReport` |
| `src/browser/bugReportConfig.js` | The project id and the public, Firestore-restricted API key |
| `firebase/firestore.rules` | Create-only rules for `bugReports/{id}`, kept equal to `bugReport.js` by a contract test |
| `firebase.json`, `.firebaserc` | Point the Firebase CLI at `delve-die-repeat-6ba5f` for `firebase deploy` |
| `tools/bug-reports/send-test-report.mjs` | Sends a live test report, or probes the rules, from the shipped client code |
| `.github/workflows/bug-reports.yml` | The scheduled/manual Action |
| `tools/bug-reports/file-issues.mjs` | The filer: auth, per-run cap, lock/reconcile, label, issue creation |
| `tools/bug-reports/issue-format.mjs` | The pure issue formatter and the Firestore typed-value decoder |

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

The Action moves `status` through `new` → `filing` → `filed` (or `failed`
after `MAX_ATTEMPTS`), and adds `attempts` (int), `issueNumber` (int),
`issueUrl` (string) and `filedAt` (an ISO string) once it has filed the
report. The Action trusts the Firestore-assigned server `createTime`, never
the client's `clientTime`, when it orders reports oldest-first.

## 4. The rules

`firebase/firestore.rules` allows exactly one verb on `bugReports/{id}`:
`create`, and only when the document is shaped exactly like section 3 —
`hasOnly`/`hasAll` on the exact field set, every type and size bound checked,
`status == "new"` and `schema == 1`. `get`, `list`, `update` and `delete` are
all denied for clients, and every other path in the database is denied.
The Action's service account bypasses this file entirely through IAM
(`roles/datastore.user`), not through a rule, so it can still read, lock and
patch reports regardless of what a client can do.

Deploy the rules from the repo root:

```
firebase deploy --only firestore:rules --project delve-die-repeat-6ba5f
```

Prove they hold live, against the real project:

```
node tools/bug-reports/send-test-report.mjs --probe-rules
```

This sends three requests that must each come back `403`: a list read, a
create with an extra field, and a create with a pre-filed `status`. If any
probe unexpectedly succeeds, the tool prints the created document's name so
it can be cleaned up by hand.

## 5. The Action

`.github/workflows/bug-reports.yml` runs on `*/15 * * * *` and by hand
(`workflow_dispatch`, with a `dry_run` input). It has `permissions: { issues:
write, contents: read }` and a `bug-reports` concurrency group so runs never
overlap. It runs `node tools/bug-reports/file-issues.mjs` on Node 22 with
zero npm installs — Node built-ins plus `issue-format.mjs` only.

Dispatch a dry run by hand, then watch it:

```
gh workflow run bug-reports.yml --repo sheibeck/ddr -f dry_run=true
gh run watch
```

A dry run reads and logs only; it files nothing.

**Per run:** at most 20 reports, oldest `createTime` first. The limitation:
`runQuery` fetches up to 200 `new` documents unordered before the filer sorts
them client-side, so with a backlog past 200 the oldest report might wait an
extra run to be seen at all.

**The lock:** before filing, the filer flips a report's `status` from `new`
to `filing` with the document's `updateTime` as a Firestore precondition
(`currentDocument.updateTime`). Any failure of that PATCH means another run
already has it, so this run skips it.

**The stale reconcile:** a report stuck in `filing` for over 10 minutes (the
run died mid-file) is searched for in the latest 100 `player-report` issues
by its hidden marker. Found → mark it filed. Not found, and under
`MAX_ATTEMPTS` (3) → retried. At `MAX_ATTEMPTS` → marked `failed`.

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
Oracle's oldest lines one at a time, noting how many were dropped and that
the full Oracle lives in the Firestore document.

## 6. Operations

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
sheibeck/ddr`, or from the Actions tab). App Check (Play Integrity) is the
deferred, stronger fix — revisit it only if spam actually appears (see the
Deferred Ideas in 79.3-CONTEXT.md).

**Deleting a report on request.** Two deletions, both by hand: delete the
Firestore document in the Firebase console (Firestore Database →
`bugReports` → the document), and delete the filed issue with:

```
gh issue delete <n> --repo sheibeck/ddr --yes
```

(`gh issue delete` needs admin on the repo.)

## 7. Keys and rotation

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
`roles/datastore.user` only — nothing else in the project.

## 8. Troubleshooting

- **"`FIREBASE_BUG_REPORTS_SA` is not set" warning** — the repo secret is
  missing; the run exits 0 having read nothing. Set the secret (section 7).
- **A `403` from `runQuery`** — the service account is missing
  `roles/datastore.user`, or the key is for the wrong project.
- **A `400`/`401` from the token exchange** — the service-account key was
  revoked (rotated without updating the secret), or there is clock skew on
  the runner.
- **No issues appearing** — check whether the workflow is disabled (the
  60-day rule, section 6) or a dry run is on.
- **A report stuck in `filing`** — normal for up to 10 minutes; the next run
  reconciles or retries it (section 5).

## 9. Privacy and Play

The Data safety answers and the privacy-policy draft for this data path live
in `store-listing/LISTING.md` (the `## Data safety` section and the
`### Draft for darktierstudios.com/privacy/apps` subsection under
`## Privacy policy URL`). The user applies both — the Play Console Data
safety form and the darktierstudios.com privacy page — at milestone close
(`.planning/MILESTONE-CLOSE-QUESTIONS.md`).
