---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 07
subsystem: boards
tags: [leaderboards, smoke-probe, release-steps, deepKey, BOARD-28]
requires:
  - phase: 87-06
    provides: "fakeBoardServer acceptLegacyDeepKey, boards-admin rekey-deep"
  - phase: 87-05
    provides: "deepKeyOf / legacyDeepKeyOf, firestore.transition.rules"
provides:
  - "tools/boards-smoke.mjs runTransitionProbe, transitionSummaries and the --transition flag"
  - "docs/RELEASING.md 'Release 2.3.0: the DEPTH-key steps (BOARD-28)' in hard order"
  - "docs/LEADERBOARDS.md rekey-deep (moderation) and --transition probe (deploying) entries"
  - "compliance-docs.test.js pin of the Release 2.3.0 step order"
affects: [87-08]
tech-stack:
  added: []
  patterns: ["duplicate the pinned runSmoke closures in a sibling probe rather than refactor a pinned function"]
key-files:
  created: []
  modified:
    - tools/boards-smoke.mjs
    - test/unit/boards-smoke.test.js
    - docs/RELEASING.md
    - docs/LEADERBOARDS.md
    - test/unit/compliance-docs.test.js
key-decisions:
  - "runTransitionProbe duplicates runSmoke's bearerInit/rawRequest/getRun/runStep closures; runSmoke and its NON_ADMIN/ADMIN step-order pins are untouched"
  - "The third DEPTH key is deepKeyOf(summary) + 1, asserted to equal neither formula before it is sent"
  - "The probe's create-legacy-key writes legacyDeepKeyOf(summary) through the same buildRunDoc/createRunCommit path the shipped client uses, i.e. the exact vc12 value"
requirements-completed: []
duration: ~20 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 07: transition probe and v2.3 DEPTH-key release steps (BOARD-28) Summary

**`node tools/boards-smoke.mjs --transition` proves the deployed rules accept a 2.3-keyed run and a 2.2.0 (vc12) keyed run and refuse a third value, always erasing its runs and deleting its anonymous account; docs/RELEASING.md now carries the hard-ordered Release 2.3.0 DEPTH-key steps, pinned by a compliance test. Nothing was run against the live project.**

BOARD-28 stays Pending in REQUIREMENTS.md by instruction; it closes with 87-08.

## What changed

- `tools/boards-smoke.mjs`
  - `transitionSummaries(now)`: three frozen summaries on floor 4 with steps 321, 123 and 77 (distinct hashes), all passing `buildRunDoc`.
  - `runTransitionProbe(opts)`: same option and return shape as `runSmoke`. Steps `signup`, `create-new-key` (deepKeyOf, read-back equal), `create-legacy-key` (doc's deepKey overwritten with `legacyDeepKeyOf`, read-back equal), `deny-third-key` (`deepKeyOf + 1`, 400/403 and a 404 read-back), `erase` (both created docs read back 404), `account-deleted`. Cleanup in `finally` (eraseMyRuns, deleteAccount, identity.drop) even on a failed step.
  - CLI: `--transition` accepted (still at most one flag), runs the probe with the live config, prints PASS/FAIL lines, facts and cleanup, exit 0 only when ok and cleanup succeeded. Usage line added; `--dry-run` and `--with-admin` output unchanged. Header lists the new steps and marks the probe a transition artifact.
- `test/unit/boards-smoke.test.js`: 4 new tests (summaries; full pass against `acceptLegacyDeepKey: true` fake, asserting the three key values actually sent and an empty board afterwards; default final-rules fake fails at `create-legacy-key` with later steps not attempted and cleanup complete; usage lists `--transition`). The existing runSmoke pins pass unchanged.
- `docs/RELEASING.md`: new section "Release 2.3.0: the DEPTH-key steps (BOARD-28)" after the 2.2.0 checklist: (1) transition rules live before any 2.3 run submits, proven with `--transition`; (2) at the 2.3 release `rekey-deep` dry run then `--yes`; (3) at the cutover the plain final-rules deploy, plain smoke, `rekey-deep --yes` once more, then a dry run that must report 0 on the old key; (4) delete every transition artifact and flip the compliance test. Every live step says to ask the user first.
- `docs/LEADERBOARDS.md`: `rekey-deep` in section 12 (usage plus a paragraph: reads, count report, dry run default, idempotent, billed reads, admin credentials bypass rules, transition artifact); the `--transition` probe in section 6's 2.3 subsection.
- `test/unit/compliance-docs.test.js`: `depthKeySection()` helper and a test pinning the section's marker order (`boards-smoke.mjs --transition`, `rekey-deep`, `rekey-deep --yes`, the plain deploy command, `rekey-deep --yes`, `firestore.transition.rules`) plus the 2.2.0-client-refused line. Existing compliance tests unchanged and passing.

## Note for the user, to confirm at release time

Once the final rules go live at the 2.3 cutover, a shipped 2.2.0 client's run is refused by the rules, the same trade the 2.2 cutover made for 2.1.0 bug reports. It is written into RELEASING step 3 ("confirm it with the user before deploying").

## Moved pins and fixtures

None. `engine/`, `firebase/` and `src/browser/` are untouched (`git diff --stat -- engine/ firebase/` prints nothing). No parity file or fixture moved.

## Test results

Full `npm test`: 8149 tests, 8147 pass, 0 fail, 2 skipped (baseline after 87-06: 8142 pass; +5 new). No bot balance runs.

## Nothing ran against the live project

The `--transition` probe was exercised only against the in-memory fake and with the `--bogus` flag (usage, exit 2, no network). `rekey-deep` was not run. No `firebase deploy`, no live Firestore call. The live probe runs at the 87-08 checkpoint after the user's go.

## Deviations from Plan

None - plan executed exactly as written. (One process note: the first RED run failed on the missing exports rather than on an assertion, which is the expected failing state for new exports.)

## Threat model

T-87-07 mitigated: cleanup in `finally`, pinned for both rule modes (transition fake and final-rules fake both end with empty docs and users). T-87-08 mitigated: the Release 2.3.0 section opens by requiring the user's go before each live step, and the compliance test pins the order.

## Known Stubs

None.

## Human verification (deferred to end of run)

None on device for this plan (tooling and docs). The live probe runs at the 87-08 checkpoint.

## Commits

- 985916ee feat(87-07): boards-smoke --transition probe
- 89a544e5 docs(87-07): Release 2.3.0 DEPTH-key steps, runbook entries, compliance order pin

## Self-Check: PASSED

Files verified present (tools/boards-smoke.mjs, docs/RELEASING.md section, test files); commits 985916ee and 89a544e5 exist in git log; full suite fail 0.
