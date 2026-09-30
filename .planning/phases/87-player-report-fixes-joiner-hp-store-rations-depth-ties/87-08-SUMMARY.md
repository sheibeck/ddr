---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 08
subsystem: boards
tags: [leaderboards, firestore-rules, deploy-deferred, deepKey, BOARD-28]
requires:
  - phase: 87-05
    provides: "firestore.transition.rules, deepKeyOf / legacyDeepKeyOf"
  - phase: 87-07
    provides: "boards-smoke --transition probe, Release 2.3.0 DEPTH-key steps"
provides:
  - "docs/LEADERBOARDS.md section 14 record of the Phase 87 DEPTH-key transition deploy: PENDING, deferred by the user, with trigger and exact command"
  - "docs/RELEASING.md Release 2.3.0 step 1 names the debug-APK trigger"
affects: [milestone-end debug-APK device testing, Release 2.3.0]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - docs/LEADERBOARDS.md
    - docs/RELEASING.md
key-decisions:
  - "User deferred the live transition-rules deploy (resume signal 'defer', 2026-09-30): the deploy runs before the milestone-end debug-APK device testing with Compete ON or at Release 2.3.0 step 1, whichever comes first"
requirements-completed: [BOARD-28]
duration: ~15 min
completed: 2026-09-30
status: complete
---

# Phase 87 Plan 08: DEPTH-key transition deploy (deferred) Summary

**The offline gate passed and the live transition-rules deploy was deferred by the user; the pending deploy, its trigger and its exact command are recorded in docs/LEADERBOARDS.md section 14 and covered by RELEASING.md Release 2.3.0 step 1. Nothing ran live.**

## Resume signal

**"defer"** (2026-09-30). The user asked whether to push the transition rules now or wait for a signed closed-testing package, and chose to defer. The deploy happens before whichever comes first: the milestone-end debug-APK device testing with Compete ON, or Release 2.3.0 step 1 (RELEASING.md).

## Nothing ran live

No `firebase deploy`, no `gcloud`, no `boards-smoke`, no `boards-admin` was run. No final-rules deploy and no `rekey-deep --yes` ran either (both are Release 2.3.0 steps). The live project still runs the 2.2.0 final rules.

## Task 1 gate results (offline, no commit needed)

- Rules contract tests (firestore-rules, firestore-indexes, firestore-transition-rules): 36/36 pass.
- Full suite at the gate: 8170 pass / 0 fail / 2 skipped.
- vc12 formula check (`git show v2.2.0:src/browser/runDoc.js | grep -c "return floor \* 1000000 + (999999 - steps);"`) printed 1.
- `git status --porcelain` clean.

## Task 2

Checkpoint answered "defer".

## Task 3 (defer branch)

- `docs/LEADERBOARDS.md` section 14 gained "### DEPTH-key transition deploy (Phase 87, 2026-09-30)": status PENDING, deferred by the user, the reason, the trigger, the exact command (`firebase deploy --only firestore:rules,firestore:indexes --config firebase.transition.json --project delve-die-repeat-6ba5f --non-interactive`), and the post-deploy order (19 READY indexes, `boards-smoke --transition`, optional read-only `rekey-deep` census).
- Section 6's line saying the first deploy "is the user's go at Phase 87's end" now says it was deferred and is pending.
- `docs/RELEASING.md` Release 2.3.0 step 1 previously said the rules "are deployed at Phase 87's end (87-08)", which was no longer true. It now says the deploy is pending and names the debug-APK trigger.
- Pinned doc tests (`compliance-docs.test.js`, `firestore-transition-rules.test.js`) stay green; the full suite result is below.

## BOARD-28 status

Marked complete in REQUIREMENTS.md: the code (deepKeyOf, transition rules), tooling (`rekey-deep`, `--transition` probe) and release steps are done. **The live proof is pending on the deferred deploy**: the live `--transition` probe (2.3 key accepted, 2.2.0 key accepted, a third refused), the 19-READY index check and the existing-run re-key census have not run.

## Deviations from Plan

- **[Rule 1 - Bug] RELEASING.md step 1 stale claim.** It stated the rules are deployed at Phase 87's end. Fixed to reflect the deferral (docs only).
- Otherwise the "defer" branch of Task 3 ran exactly as specified. Task 1 needed no commit.

## Human verification (deferred to end of run)

After the transition deploy:
1. On the 2.3 debug APK, die and let the run submit; it appears on the ALL DEPTH board (the transition rules accept the 2.3 key).
2. A tester still on 2.2.0 who dies after this deploy still shows up on the board.

Before those checks, the deploy itself (user's go) and its live proof (index check, `node tools/boards-smoke.mjs --transition`) must happen.

## Self-Check

Verified: section-14 heading count is 1, `--config firebase.transition.json` appears in LEADERBOARDS.md, compliance-docs and transition-rules tests pass, full `npm test` ends `fail 0` (see the STATE/commit note for final counts).
