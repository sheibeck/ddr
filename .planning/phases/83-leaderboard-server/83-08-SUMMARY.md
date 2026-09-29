---
phase: 83-leaderboard-server
plan: 08
subsystem: infra
tags: [firestore, firebase-auth, gcloud, live-deploy, security-rules, smoke-test]

# Dependency graph
requires:
  - "83-02: firebase/firestore.rules (isValidBoardRun, runs/banned/reportLimits), firebase/firestore.indexes.json (19 composite indexes)"
  - "83-05: tools/boards-admin.mjs (resolveAdminAuth/createAdminApi/top, used both for the smoke's --with-admin ban/delete round trip and for the post-run cleanup confirmation)"
  - "83-07: tools/boards-smoke.mjs (runSmoke/main), run unmodified against the live project"
  - "83-10 (transition amendment context): firebase/firestore.rules' rate-limited bugReports create — the exact clause the transition file's legacy create replaces"
provides:
  - "The live delve-die-repeat-6ba5f project: transition Firestore rules + 19 composite indexes deployed, identitytoolkit/securetoken APIs confirmed enabled, the public API key restricted to exactly firestore/identitytoolkit/securetoken, anonymous sign-in enabled and proven live, the per-IP sign-up quota set to 10/hour for 365 days"
  - "firebase/firestore.transition.rules + firebase.transition.json: the deployed rules that keep the shipped 2.1.0 build's unauthenticated bug-report create working until 2.2 ships, proven byte-identical to firebase/firestore.rules (one clause excepted) by test/unit/firestore-transition-rules.test.js"
  - "A live-only rules fix: the runs list rule now reads `request.query.limit == null || request.query.limit <= 50`, so a runAggregationQuery (total()/rankOf()) is no longer refused — applied to both firebase/firestore.rules and firebase/firestore.transition.rules"
  - "docs/LEADERBOARDS.md section 14: the full live setup + board smoke record (deploy, indexes, key before/after, anonymous sign-in proof, the per-IP quota value/expiry/source/renewal command, the smoke PASS table, facts, the fix, and independent cleanup confirmation)"
affects: ["Phase 84 (panel reads against the live, proven board)", "Phase 85 (queue/backfill wiring against the live project)", "83-11 (bug-report live probes; the transition rules stay live until 2.2 ships)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A runAggregationQuery's count() carries no `limit` field — a `request.query.limit <= 50` list rule silently refuses it (null <= 50 is false); the fix is `request.query.limit == null || request.query.limit <= 50`, which never widens what an explicit-limit runQuery may request"
    - "A transition rules file (byte-identical to the final rules except one clause) is proven equal by a dedicated contract test that strips a marked header block and diffs the remainder against the final file with only the known clause substituted — the same pattern test/unit/firestore-rules.test.js already used for the byte-pinned report-shape region, applied to a whole-file transition instead of a single function"
    - "Identity Toolkit admin v2's projects.updateConfig works on the Spark (no billing instrument) plan with no Identity Platform upgrade prompt, but only once Firebase Authentication has been opened at least once in the console (GET/PATCH both 404 CONFIGURATION_NOT_FOUND before that) — resolves Research Open Question 1 for this project"

key-files:
  created:
    - firebase/firestore.transition.rules
    - firebase.transition.json
    - test/unit/firestore-transition-rules.test.js
  modified:
    - firebase/firestore.rules
    - test/unit/firestore-rules.test.js
    - docs/LEADERBOARDS.md

key-decisions:
  - "The transition rules file's list-rule fix was applied identically to both firebase/firestore.rules and firebase/firestore.transition.rules (rather than only the deployed transition file) so the two stay provably equal except the one bugReports clause, and so the fix is already in place in the final rules for the 2.2 release deploy"
  - "quota.signUpQuotaConfig's quotaDuration was set to 365 days (31536000s) after empirically confirming 1h/7d/30d/365d were all accepted with no error and no documented maximum was found — chosen as a generous 'won't silently lapse' duration with the exact renewal command recorded in the runbook, rather than guessing a shorter value that might need frequent renewal"
  - "Per the coordinator's relayed instruction, Identity Platform's 'Automatically delete anonymous accounts' setting was left off (the user's deliberate choice — the anonymous uid owns a player's runs); this is documented in section 14 as a do-not-enable note for future maintainers"

patterns-established:
  - "The transition-rules pattern (a byte-pinned, header-excepted variant of the main rules file, deployed via its own firebase.*.json config) is available for any future rules rollout that needs an old client to keep working during a migration window"

requirements-completed: [SRV-01, SRV-02, SRV-03, SRV-08, SRV-10]

coverage:
  - id: D1
    description: "The live project's Firestore rules and 19 composite indexes are deployed (via the transition config to keep 2.1.0 bug reports working) and every index reports READY"
    requirement: SRV-08
    verification:
      - kind: other
        ref: "firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive: Deploy complete"
        status: pass
      - kind: other
        ref: "gcloud firestore indexes composite list --project=delve-die-repeat-6ba5f --database=\"(default)\" --format=\"value(state)\" | sort | uniq -c: 19 READY"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-transition-rules.test.js: 4/4 pass — transition file equals firestore.rules with exactly the bugReports create clause swapped"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Identity Toolkit and Token Service APIs are enabled, and the public API key allows exactly firestore/identitytoolkit/securetoken, with every other restriction field unchanged"
    requirement: SRV-08
    verification:
      - kind: other
        ref: "gcloud services list --enabled --project=delve-die-repeat-6ba5f: firestore/identitytoolkit/securetoken all present (already enabled, no action needed)"
        status: pass
      - kind: other
        ref: "gcloud services api-keys describe <key>: apiTargets before [firestore.googleapis.com] -> after [firestore.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com], no other restriction fields changed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Anonymous sign-in is enabled on the live project (via the documented console fallback after the admin v2 config returned 404 CONFIGURATION_NOT_FOUND), proven by a live accounts:signUp (200) followed by accounts:delete cleanup"
    requirement: SRV-08
    verification:
      - kind: other
        ref: "GET .../admin/v2/projects/delve-die-repeat-6ba5f/config: signIn.anonymous.enabled: true (after the user's console step)"
        status: pass
      - kind: other
        ref: "POST accounts:signUp?key=...: 200, localId+idToken present; POST accounts:delete: 200"
        status: pass
    human_judgment: true
    rationale: "Enabling anonymous sign-in required a one-time Firebase Console click (the admin v2 config had no document to PATCH until Authentication was opened once) — a human completed this step per the checkpoint; the live signUp/delete proof itself is fully automated and verified above"
  - id: D4
    description: "Firebase Auth's per-IP new-account limit was looked up (default: 100 accounts/hour/IP, from Google's live-fetched quotas page) and set to 10/hour for 365 days on the Spark plan with no billing/Identity Platform upgrade required; the value, source and expiry/renewal are recorded in docs/LEADERBOARDS.md section 14"
    requirement: SRV-10
    verification:
      - kind: other
        ref: "PATCH .../config?updateMask=quota.signUpQuotaConfig: quota=10, startTime=2026-09-29T09:57:57Z, quotaDuration=31536000s; confirmed via a follow-up GET echoing the same values"
        status: pass
      - kind: other
        ref: "docs/LEADERBOARDS.md section 14 '### Per-IP sign-up limit' — default source cited (cloud.google.com/identity-platform/quotas), final value, expiry 2027-09-29, renewal command"
        status: pass
    human_judgment: false
  - id: D5
    description: "node tools/boards-smoke.mjs --with-admin passes every step against the live project and leaves nothing behind; the one live-only difference found (a runAggregationQuery refused under the strict limit<=50 list rule) was fixed in the rules and its test before the final passing run"
    requirement: SRV-08
    verification:
      - kind: e2e
        ref: "node tools/boards-smoke.mjs --with-admin (final run): 17/17 steps PASS, exit 0, cleanup {erased:true, accountDeleted:true}"
        status: pass
      - kind: other
        ref: "node tools/boards-admin.mjs top --stat deep --race Troll --sub \"Court Mage\" (and --stat kills, same filters): (no runs) both times — no Smoke Probe row remains"
        status: pass
      - kind: unit
        ref: "test/unit/firestore-rules.test.js (35/35), test/unit/firestore-transition-rules.test.js (4/4), test/unit/firestore-indexes.test.js — all pass after the list-rule fix"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/LEADERBOARDS.md section 14 records the deploy, index states, the key restrictions before/after (service names only), the anonymous-provider outcome, the per-IP limit, the smoke table and facts, and every fix made; no API key string or token appears in section 14"
    requirement: SRV-08
    verification:
      - kind: other
        ref: "grep for 'AIza' restricted to the section 14 text range: not found"
        status: pass
    human_judgment: false

duration: 1h 40min
completed: 2026-09-29
status: complete
---

# Phase 83 Plan 08: Live Firebase Setup and Live Smoke Summary

**The live delve-die-repeat-6ba5f project is fully configured and proven end to end — transition rules and 19 indexes deployed, the API key restricted to exactly three services, anonymous sign-in enabled and live-proven, the per-IP sign-up quota set to 10/hour for a year, and `node tools/boards-smoke.mjs --with-admin` passes all 17 steps live after one rules fix (a `runAggregationQuery`'s null `limit` was refused by the original list rule).**

## Performance

- **Duration:** ~1h 40min (including a checkpoint pause for a Firebase Console step and a research pause to confirm the default per-IP quota)
- **Tasks:** 2
- **Files modified:** 6 (3 created: `firebase/firestore.transition.rules`, `firebase.transition.json`, `test/unit/firestore-transition-rules.test.js`; 3 edited: `firebase/firestore.rules`, `test/unit/firestore-rules.test.js`, `docs/LEADERBOARDS.md`)

## Accomplishments

- **Transition rules deployed live** (Transition amendment, user ruling 2026-09-29): `firebase/firestore.transition.rules` is byte-for-byte `firebase/firestore.rules` except the `bugReports` create clause, which keeps the legacy unauthenticated form the shipped 2.1.0 build (vc11) still sends — so 2.1.0 testers keep filing bug reports while the leaderboard rules (`runs`/`banned`/`reportLimits`) go live unchanged. Deployed via `firebase.transition.json`, proven byte-identical (header excepted) by the new `test/unit/firestore-transition-rules.test.js` (4/4 pass). The release-day cutover (deploy `firebase.json`, run `send-test-report.mjs --probe-rules`, delete the three transition files) is documented in section 6.
- **All 19 composite indexes reached READY** in ~4 minutes (polled `gcloud firestore indexes composite list` at 60s intervals) — matches `firebase/firestore.indexes.json`'s declared count exactly.
- **The three services** (`firestore`, `identitytoolkit`, `securetoken`) were already enabled; the **public API key** was restricted to exactly those three (`gcloud services api-keys update` with all three `--api-target` flags in one call, per Pitfall 8), confirmed before/after with no other restriction field changed.
- **Anonymous sign-in**: the Identity Toolkit admin v2 config initially returned `404 CONFIGURATION_NOT_FOUND` on both GET and PATCH — this project's Firebase Authentication had never been opened in the console, so there was no config document yet. Resolved via the documented console fallback (the user completed the one-time "Get started" → Sign-in method → Anonymous → Enable step, deliberately leaving "Automatically delete anonymous accounts" off since the anonymous uid owns a player's runs). Confirmed live with `signIn.anonymous.enabled: true`, then proven end to end with a real `accounts:signUp` (200) followed by `accounts:delete` cleanup.
- **Per-IP sign-up limit (SRV-10)**: Google's live-fetched quotas page (`cloud.google.com/identity-platform/quotas`) documents the default as **100 accounts/hour/IP** (an unrelated "100 million anonymous accounts" figure is a total-count cap, not a rate limit). `quota.signUpQuotaConfig` was PATCHed to **10/hour**, and — after empirically confirming 1h/7d/30d/365d durations were all accepted with no error and no cap was found — set to **365 days** (expires 2027-09-29, renewal command recorded). This succeeded entirely on the Spark (no billing instrument) plan, resolving Research Open Question 1 for this field too.
- **Live board smoke**: the first `node tools/boards-smoke.mjs --with-admin` run found the one live-only difference this plan's own Task 2 anticipated — a `runAggregationQuery` (used by `total()`/`rankOf()`) carries no `limit` field, so the original `allow list: if request.query.limit <= 50;` rule refused it (`null <= 50` is false). Fixed to `allow list: if request.query.limit == null || request.query.limit <= 50;` in both rules files, redeployed, rerun: **17/17 steps PASS**, exit 0. `facts`: `duplicateStatus: 409`, `countUnderListRule: "pass"`, `missingIndexes: []` (all 19 indexes sufficed), `commitShape: "single-write"` (the combined single-`Write` create form was accepted as-is; the two-`Write` fallback was never needed). Cleanup independently confirmed via `node tools/boards-admin.mjs top` — no Smoke Probe rows remain on the live board.
- `docs/LEADERBOARDS.md` section 14 is fully written: the deploy/index/API/key record, the anonymous sign-in resolution and live proof, the per-IP quota value/source/expiry/renewal, and the full board-smoke record (PASS table, facts, the fix, cleanup confirmation). Section 4 (rules) and section 15 (troubleshooting) were updated for the list-rule fix.

## Task Commits

Each task was committed atomically (Task 1 spanned three commits because it paused at a checkpoint):

1. **Task 1a: transition rules created, tested, deployed** - `4cffe258` (feat)
2. **Task 1b: deploy/index/key results recorded; anonymous sign-in found blocked** - `97ab18e3` (docs)
3. **Task 1c: Task 1 complete after the console step — anonymous sign-in + per-IP quota confirmed live** - `5f26ce3a` (feat)
4. **Task 2: live-only list-rule fix, redeploy, smoke rerun to 17/17 PASS, runbook record** - `f24592bd` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `firebase/firestore.transition.rules` - byte-identical to `firebase/firestore.rules` except the `bugReports` create clause (legacy unauthenticated form); the deployed live rules
- `firebase.transition.json` - Firebase CLI config pointing at the transition rules file (same indexes file as `firebase.json`)
- `test/unit/firestore-transition-rules.test.js` - proves the transition file equals the final rules with exactly that one clause swapped, header excluded
- `firebase/firestore.rules` - the `runs` list rule fixed to accept a `null` `request.query.limit` (a `runAggregationQuery` shape)
- `test/unit/firestore-rules.test.js` - updated expectation for the fixed list rule
- `docs/LEADERBOARDS.md` - section 4 (list rule), section 14 (the full live setup + board smoke record), section 15 (new troubleshooting entry)

## Decisions Made

- The list-rule fix was applied to both `firebase/firestore.rules` and `firebase/firestore.transition.rules` identically, so the transition-equality test keeps passing and the fix is already present in the final rules for the 2.2 release deploy.
- `quotaDuration` was set to 365 days after empirically probing 1h/7d/30d/365d all succeeded with no documented maximum found — a generous, renewal-command-documented choice over guessing a shorter value.
- Per the coordinator's relayed instruction, "Automatically delete anonymous accounts" was left off; this is now a documented do-not-enable note in the runbook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, pre-agreed by the plan itself] `runs` list rule refused a `runAggregationQuery`'s null `limit`**
- **Found during:** Task 2, first live `node tools/boards-smoke.mjs --with-admin` run (`totals` step failed with `PERMISSION_DENIED`)
- **Issue:** `allow list: if request.query.limit <= 50;` evaluates `null <= 50` as `false` for a `runAggregationQuery` (`count()`), which carries no `limit` field at all — refusing every `total()`/`rankOf()` read live, even though `fakeBoardServer.js`'s offline model never enforces rules text and so never caught this.
- **Fix:** `allow list: if request.query.limit == null || request.query.limit <= 50;` in both `firebase/firestore.rules` and `firebase/firestore.transition.rules`; `test/unit/firestore-rules.test.js` updated to match; redeployed; the smoke rerun to 17/17 PASS. This is the exact "Count queries (totals or ranks) refused under allow list" branch this plan's own Task 2 action text pre-authorized — not a scope-creep fix.
- **Files modified:** `firebase/firestore.rules`, `firebase/firestore.transition.rules`, `test/unit/firestore-rules.test.js`, `docs/LEADERBOARDS.md` (sections 4, 14, 15)
- **Verification:** `node tools/boards-smoke.mjs --with-admin` — 17/17 PASS, exit 0. `node --test test/unit/firestore-rules.test.js test/unit/firestore-transition-rules.test.js test/unit/firestore-indexes.test.js` — 35/35, 4/4, and indexes tests all pass.
- **Committed in:** `f24592bd`

---

**Total deviations:** 1 auto-fixed (1 blocking, pre-agreed by the plan). No architectural changes, no rule weakened beyond the pre-agreed branch — a `runQuery`'s explicit `limit` is still bounded exactly as before (`deny-list-51` still refuses `limit: 51`).

## Issues Encountered

None beyond the anticipated console-step checkpoint (anonymous sign-in required a one-time Firebase Console click since Authentication had never been opened for this project) and the anticipated live-only list-rule fix, both handled per the plan's own documented paths.

## User Setup Required

**Already completed during this plan's execution** (not owed after this SUMMARY): the user opened Firebase Console → Authentication → Get started → Sign-in method → Anonymous → Enable → Save, and confirmed "Automatically delete anonymous accounts" stays off.

## Next Phase Readiness

- The live project is fully configured and proven: Phase 84 (panel reads) and Phase 85 (queue/backfill wiring) can talk to `delve-die-repeat-6ba5f` against the exact rules/indexes this plan verified.
- The **transition rules stay deployed** until the 2.2 build reaches testers — 83-11 (bug-report live probes) and any later phase touching `firebase/firestore.rules` must deploy through `firebase.transition.json`, not `firebase.json`, until that release-day cutover (docs/LEADERBOARDS.md section 6).
- No blockers.

**Verification run (this plan's scope):** `node --test test/unit/firestore-rules.test.js test/unit/firestore-indexes.test.js test/unit/firestore-transition-rules.test.js test/unit/boards-smoke.test.js test/unit/boards-admin.test.js test/unit/runDoc.test.js` — 109/109 pass.
**Live smoke (this plan's own proof instrument):** `node tools/boards-smoke.mjs --with-admin` — 17/17 steps PASS, exit 0, cleanup confirmed (`erased: true`, `accountDeleted: true`), independently re-confirmed via `node tools/boards-admin.mjs top` (no Smoke Probe rows on the live board).
**Full suite (`npm test`, once at plan close):** 8309 pass, 0 fail, 2 skipped (pre-existing) — exit code 0.
**Engine gate:** `git status --porcelain -- engine test/parity content` is empty.

**Human verification (deferred to end of run):** None — this plan ships no device-testable app surface (live infra configuration and a dev-only Node smoke tool; nothing in the shipped app changed). The one human step this plan needed (the Console anonymous-provider toggle) was completed synchronously during execution via a checkpoint, not deferred.

---
*Phase: 83-leaderboard-server*
*Completed: 2026-09-29*

## Self-Check: PASSED

All referenced files found on disk (`firebase/firestore.transition.rules`, `firebase.transition.json`, `test/unit/firestore-transition-rules.test.js`, `firebase/firestore.rules`, `test/unit/firestore-rules.test.js`, `docs/LEADERBOARDS.md`, `.planning/phases/83-leaderboard-server/83-08-SUMMARY.md`); all four task commits (`4cffe258`, `97ab18e3`, `5f26ce3a`, `f24592bd`) found in git log.
