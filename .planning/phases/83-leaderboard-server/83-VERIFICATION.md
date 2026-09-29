---
phase: 83-leaderboard-server
status: passed
verified: 2026-09-29
verifier: orchestrator (verification agents off per project config; deferred-UAT protocol)
score: 6/6 (criterion 6's live 403 half deferred to the 2.2 release by user ruling)
human_verification:
  - "REPORT A BUG: send twice quickly — the cooldown failed state reads naturally with the real wait filled in (83-09)"
  - "REPORT A BUG: five sends in one day — the daily-cap failed state reads naturally with {cap}/{wait} filled in (83-09)"
  - "REPORT A BUG with Compete OFF — the identity is created silently on tap and the send succeeds (83-09)"
deferred:
  - "SRV-09 live proof (ten --probe-rules PASS) — release step after the final rules deploy (user ruling 2026-09-29: keep 2.1.0's bug reports working; Phase 86 criterion 5, docs/LEADERBOARDS.md §6)"
---

# Phase 83: Leaderboard Server — Verification

**Goal:** Our own board is live on Firebase (Firestore run table, rules, indexes, anonymous identity, rolled handles, a durable queue, admin script, runbook) and proven end to end, with no Firebase SDK in the app.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Each Compete-ON run written once, full field set incl. version; resubmit never duplicates | `runDoc.js` (doc id `{uid}_{hash}`, `createRunCommit` with `exists=false`), `boardWrites.submitRun` (ambiguous 400/403/409 settled by a public GET); live smoke `create`/`resubmit` PASS (83-08, 17/17) | ✓ |
| 2 | Rules + JS mirror: owner-only shaped creates, bounded reads, no update, owner/admin delete | `firebase/firestore.rules` + `runDoc.validateRunDoc` + `test/unit/firestore-rules.test.js`; live deny probes in the smoke (bad rank key, wrong doc id, no auth, non-handle update, list > 50) PASS; list rule allows the limit-less count (live-only fix f24592bd) | ✓ |
| 3 | Top ten / total / rank for 4 stats × race/sub filters, current season, declared indexes, DAYS per Phase 82 | `boardClient` topTen/total/rankOf (5-min cache, stale fallback); 19 composite indexes READY live; `daysKey = min(day, 10*floor)*1000 + floor`; smoke's 48 reads PASS live | ✓ |
| 4 | Anonymous identity over fetch only when Compete ON; re-rollable handle; durable queue with backoff, no double submit | `firebaseAuth.createIdentity` (lazy sign-up, refresh, Compete gate, explicit bug-report bypass); `content/handles.js` + `handles.js`; `boardWrites.rewriteHandle` (re-roll rewrites every run); `runQueue` (`ddr.runQueue.v1`, persist-before-network, settled ledger, 30 s→30 min backoff, purge); `runBackfill` (2.1.0 cutoff, 83-12); anonymous sign-in live (signUp 200 + delete) | ✓ |
| 5 | Admin script, runbook, live smoke with rules/indexes deployed, anon sign-in on, key restricted | `tools/boards-admin.mjs` (top/suspicious/delete-run/ban/unban/export; key never in repo, .gitignore guards); `docs/LEADERBOARDS.md` (15 sections, §14 live record); key restricted to firestore/identitytoolkit/securetoken; `tools/boards-smoke.mjs --with-admin` 17/17 PASS live, cleanup confirmed | ✓ |
| 6 | Bug reports share the quota safely: identity + per-player limit by rules proven with live 403 probes; Action retention cleanup; schedule proven | Client: `sendBugReport` over the shared identity + one-commit report/limit write, rate-limited sheet (83-09). Rules: final rules enforce it (contract tests green) but the **transition rules** are live so 2.1.0 keeps filing (user ruling) — live probes 8/10 PASS, the two legacy-path probes pass only after the release-day final-rules deploy (deferred). Cleanup: Action deleted the live test report in run 36556480792 (issue #7, admin GET 404). Schedule: schedule-triggered run 36529349414 succeeded. Per-IP limit 10/h set live. | ✓ (live-403 half deferred) |

## Requirements

- SRV-01 ✓ · SRV-02 ✓ · SRV-03 ✓ · SRV-04 ✓ · SRV-05 ✓ (handle roll + re-roll rewrite in client code; the ☰ re-roll control is Phase 85's ACCT-03) · SRV-06 ✓ · SRV-07 ✓ · SRV-08 ✓ · SRV-10 ✓ · SRV-11 ✓ · SRV-12 ✓
- SRV-09 — client and rules complete; **live proof deferred to the 2.2 release** (ten `--probe-rules` PASS after `firebase.json` deploy). Stays unchecked until then.

## Scope changes during the phase (user rulings)

- Backfill: dropped, then restored as runs from the 2.1.0 release on (`BACKFILL_SINCE_MS` = 2026-09-28T19:41:01Z, stamped "2.1.0 (11)", plan 83-12); cutoff approved.
- Transition rules keep 2.1.0 bug reports working until 2.2 ships (83-08/83-11 amendments).
- Season of the Alpha (SEASON 1) for closed testing; Season 1 reset at go-live.

## Automated checks

- `npm test`: 8309 passed, 0 failed (2 pre-existing skips) at 83-11 close.
- Engine gate: `git status --porcelain -- engine test/parity content` empty (content/handles.js is the one new content file, as planned).

## Human verification (deferred to the milestone-close Pixel 7 checklist)

See frontmatter `human_verification` (83-09's report-sheet states).
