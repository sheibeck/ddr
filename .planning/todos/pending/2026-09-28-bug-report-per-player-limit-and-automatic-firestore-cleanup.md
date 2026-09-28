---
created: 2026-09-28T23:50:38.675Z
title: Bug report per-player limit and automatic Firestore cleanup
area: api
resolves_phase: 83
files:
  - src/browser/bugReport.js
  - src/browser/reportSheet.js
  - firebase/firestore.rules
  - firestore.indexes.json
  - test/unit/firestore-rules.test.js
  - tools/bug-reports/file-issues.mjs
  - tools/bug-reports/send-test-report.mjs
  - .github/workflows/bug-reports.yml
  - docs/BUG-REPORTS.md
  - store-listing/LISTING.md
---

## Problem

(User, 2026-09-28, captured into Phase 83's scope — "Firestore quota protection".)

Bug reports (Phase 79.3) and the leaderboards (Phase 83) share the Spark project delve-die-repeat-6ba5f and its daily quotas. Today bugReports/{id} is create-only, and the rules check the report's shape but not how often reports arrive. Anyone with the public API key can script creates until the daily write quota (about 20k) or the 1 GiB storage limit runs out. That would stop leaderboard submissions for the rest of the day. Nothing ever deletes a report, so storage only grows. Use the anonymous identity Phase 83 is adding to cap bug reports per player, and have the Action clean up reports once they're filed.

## Solution

### Requirements

1. **Sign-in required to send a report.** sendBugReport in src/browser/bugReport.js gets its identity from the same shared auth module Phase 83 builds (the lazy accounts:signUp plus the securetoken refresh). A player's first report creates the identity if they don't have one yet. Reporting still only touches the network when the player taps Send: nothing in the background, no queue. With leaderboards (Compete) off, there is still zero network until the player sends a report.
2. **The report itself stays anonymous (D-07 still holds).** No uid, account or Play Games field goes into the bugReports document. The uid appears only as the path of the limit document below.
3. **A limit document per player:** reportLimits/{uid}, with the exact fields { last: timestamp, day: timestamp, count: int }.
   - The report and this document are written together in one REST documents:commit, which replaces the plain create.
   - The rules on bugReports/{id} create require request.auth != null. They also use getAfter() on reportLimits/{request.auth.uid} to prove it was updated in the same commit, with last == request.time.
   - Cooldown: the previous last (read with get(), absent on a first report) must be at least 2 minutes before request.time.
   - Daily cap: if the stored day equals today's date (request.time.date(), or whatever day-bucketing Firestore rules actually support; confirm this), then count == previous count + 1 and count <= 5. Otherwise count == 1 and day is set to today.
   - Put the limits (2 minutes, 5 a day) in named constants in both the rules and the JS mirror.
4. **Lock down reportLimits.** The only allowed operations are create and update of the player's own document, in the exact shape above, as part of the commit. The owner may get their own document so the client can recover the right count after local storage is wiped. Everyone else is denied list, delete, and access to any other player's document. The catch-all deny stays in place. Extend firebase/firestore.rules; don't replace it.
5. **Client UX.** reportSheet.js checks its own record of the last send time and today's count before sending. If the player is over a limit, show a sarcastic, family-friendly "the Oracle needs a minute" style message with the wait time, and keep their draft. If the rules still refuse the send, show it as the existing failed state with a message that says the player has been rate-limited.
6. **Per-IP sign-up limit.** Check Firebase Auth's current default for how many new accounts one IP can create per hour, and whether it covers anonymous sign-ups. Set it lower (around 10 an hour) as part of live setup. Record the value in the runbook.
7. **Old builds.** Clients up to 2.1.0/vc11 do a plain create, so the new rules will reject their reports. That's accepted: no legacy path (see the greenfield-no-legacy-paths rule). It ships in vc12 or later.
8. **Automatic cleanup (the Action deletes reports from Firestore).** The Action already runs as the service account (roles/datastore.user, which can delete). Extend tools/bug-reports/file-issues.mjs so reports stop piling up in Firestore. The public GitHub issues are left alone.
   - Filed reports with the full Oracle in the issue: delete the Firestore document in the same run, right after it's marked filed. The issue already holds everything.
   - Filed reports whose Oracle was trimmed to fit the issue: keep the document for 30 days after filedAt, then delete it. Change the formatter's "the full Oracle lives in the Firestore document" note to say "…until <date>". Record which case applies on the document, e.g. oracleTrimmed: bool written when it's marked filed, so the cleanup doesn't have to re-render the issue.
   - Reports marked failed (gave up after MAX_ATTEMPTS): delete 30 days after they were marked failed. Add a failedAt field so that date is known.
   - Never delete new or filing reports. Those haven't been filed yet; the existing stale-report handling still covers stuck filing reports.
   - reportLimits/{uid} documents: delete any whose last is more than 2 days old. By then the cooldown and daily count have both expired, so deleting the document loses nothing.
   - Limits per run: at most 100 deletes per run, oldest first; anything left over waits for the next run. Queries must stay small, since Spark counts every read. Filter on the stored timestamps, not by reading every document. Add any composite index the query needs to firestore.indexes.json and deploy it.
   - Dry run logs "would delete <id> (<reason>)" and deletes nothing. A normal run adds deleted N [...] to its one-line summary.
   - Retention length: make 30 days and 2 days named constants, not numbers scattered through the code.
9. **The schedule must actually run.** Cleanup and filing both depend on .github/workflows/bug-reports.yml running every 15 minutes. As of 2026-09-28 it has only ever run by hand; the schedule has never fired. Check gh run list --repo sheibeck/ddr --workflow bug-reports.yml for runs listed as schedule. If there are none, fix it as part of this work, for example by pushing a small change to the workflow file, and confirm a scheduled run happens.

### Tests and proof

- Extend test/unit/firestore-rules.test.js so the new rules and constants stay equal to the JS mirror.
- Add unit tests for building the commit, the local cooldown and daily-count logic, and the sheet's rate-limited state.
- Add cleanup unit tests, using the existing fake fetch, covering: every case in requirement 8; the retention boundaries, just inside and just outside 30 days and 2 days; never touching new or filing reports; the 100-delete cap; dry run deleting nothing.
- Extend tools/bug-reports/send-test-report.mjs --probe-rules with probes that must each come back 403: an unauthenticated create; a create without the limit-document update; a second report inside the cooldown; a forged count; a sixth report in one day; a write to another player's reportLimits document; a list on reportLimits.
- Deploy the rules and indexes live and run the probes against the real project.
- Live proof of cleanup: (a) send a test report with send-test-report.mjs; (b) dispatch the Action; (c) confirm the issue was filed and the Firestore document is gone.

### Docs

- docs/BUG-REPORTS.md: update the report path and rules sections, add the new limits and the per-IP sign-up setting, and add a retention section. Note that the kill switch still works, and that section 6's delete-on-request steps now only apply within the retention window.
- store-listing/LISTING.md: state the retention period in the privacy-policy draft, e.g. "Reports are deleted from our database once filed, or within 30 days at most. The public GitHub issue remains." Update the Data safety notes there if the anonymous identifier changes the answers.

### Out of scope

App Check and a global throttle.
