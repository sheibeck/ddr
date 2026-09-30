---
phase: 87-player-report-fixes-joiner-hp-store-rations-depth-ties
plan: 06
subsystem: boards
tags: [leaderboards, admin-tooling, fake-board, deepKey, BOARD-28]
requires:
  - phase: 87-05
    provides: "deepKeyOf / legacyDeepKeyOf, firestore.transition.rules"
provides:
  - "fakeBoardServer acceptLegacyDeepKey (transition mode) and admin single-field deepKey PATCH"
  - "tools/boards-admin.mjs rekey-deep (dry run by default, --yes, idempotent, count report)"
  - "classifyDeepKeys(rows), createAdminApi().patchDeepKey(id, deepKey)"
affects: [87-07, 87-08]
tech-stack:
  added: []
  patterns: ["dry-run-first destructive admin command, waves of at most 100 concurrent requests"]
key-files:
  created: []
  modified:
    - src/browser/fakeBoardServer.js
    - test/unit/fakeBoardServer.test.js
    - tools/boards-admin.mjs
    - test/unit/boards-admin.test.js
key-decisions:
  - "CLI shape: rekey-deep [--season N|--all-seasons] [--yes]; dry run unless --yes, current SEASON by default (same scoping as export)"
  - "The only write is PATCH runs/{id}?updateMask.fieldPaths=deepKey&currentDocument.exists=true with the value recomputed from the doc's own floor and steps"
  - "The fake's default mirrors the final rules; acceptLegacyDeepKey: true mirrors firestore.transition.rules and is deleted with the transition files at the 2.3 cutover"
requirements-completed: []
duration: ~25 min
completed: 2026-09-29
status: complete
---

# Phase 87 Plan 06: rekey-deep admin tooling and fake-server support (BOARD-28) Summary

**`node tools/boards-admin.mjs rekey-deep` moves every 2.2.0-keyed run onto the most-steps DEPTH key (`floor*1e6 + steps`) with a dry run by default, a count report and idempotence proven against the in-memory fake; the fake now mirrors both rule sets and accepts the admin deepKey patch. rekey-deep was NEVER run against the live project.**

BOARD-28 stays Pending in REQUIREMENTS.md by instruction; it closes with 87-08.

## What changed

- `src/browser/fakeBoardServer.js`
  - New option `acceptLegacyDeepKey` (default `false`). The default mirrors the final rules (new deepKey only). With `true`, a create whose only `validateRunDoc` failure is `deepkey` and whose deepKey equals `legacyDeepKeyOf(doc)` is accepted, for both user and admin create paths. A third value, or any other failing clause (for example a bad handle), is still denied.
  - New admin-only `PATCH /runs/{id}` (`handleRunPatch`): `updateMask.fieldPaths` must be exactly `deepKey` (else 400), the run must exist (else 404), the body must carry an integer `deepKey` (else 400); it stores the new deepKey, bumps `updateTime`, leaves every other field and `createTime` alone and returns 200. Non-admin or no token gets 403. `route` now receives the parsed query.
  - Header documents both, and that the option is deleted with the transition files at the 2.3 cutover.
- `tools/boards-admin.mjs`
  - `export function classifyDeepKeys(rows)` returns `{ legacy: [{ id, from, to }], current, other }`. Pure; docs with a missing or non-integer floor, steps or deepKey, or a third deepKey value, land in `other`.
  - `createAdminApi().patchDeepKey(id, deepKey)`: one PATCH with the single-field mask plus `currentDocument.exists=true`, body `fields.deepKey.integerValue`.
  - `rekey-deep [--season N|--all-seasons] [--yes]`: scopes like `export` (default current SEASON), prints "Scanned N run(s): C already on the new DEPTH key, L on the old key, O left alone (neither formula)." plus each left-alone id. Without `--yes`: "Would re-key L run(s) ... Pass --yes to re-key." and writes nothing. With `--yes`: patches the legacy rows in waves of at most 100, prints "Re-keyed K of L.", names each failed id on stderr, exits 1 if any failed. Registered in `COMMANDS`, `usage()`, `runCommand`, and the file header.
- Tests: 5 new in `fakeBoardServer.test.js` (default mode, transition mode incl. neither-formula and other-clause denials, same-floor more-steps query order, admin patch, patch refusals) and 8 new in `boards-admin.test.js` (classify, classify edge cases, dry run, `--yes` exactness with an exact PATCH-only call log, idempotent second run, season scoping, failed patch exit 1 with the rest still re-keyed, help line).

## Moved pins

One comment only: the `runQuery` order test in `fakeBoardServer.test.js` said "fewer steps"; it now says "then more steps (Phase 87 BOARD-28)". Its assertion (distinct floors) did not change. No fixture, parity or other pin moved. `firebase/`, `engine/` and `src/browser/runDoc.js` are untouched.

## Test results

Full `npm test`: 8144 tests, 8142 pass, 0 fail, 2 skipped (baseline 8129 pass; +13 new). No bot balance runs.

## Nothing ran against the live project

`rekey-deep` (and every other boards-admin command) was only exercised through `runCommand` against `createFakeBoardFetch`. `node tools/boards-admin.mjs help` was run for the acceptance check; it needs no credentials and makes no network call. No `firebase deploy`, no gcloud call, no live Firestore read or write. The live re-key runs are Release 2.3.0 steps (docs/RELEASING.md, 87-07).

## Deviations from Plan

None - plan executed as written.

## Threat model

T-87-04 mitigated (single-field mask, `currentDocument.exists=true`, only old-formula docs, value recomputed from the doc's floor and steps, proven by the exact PATCH-only call log and the untouched current/other docs). T-87-05 mitigated (dry run by default, `--yes` required, no live run). T-87-06 accepted (auth resolution untouched).

## Known Stubs

None.

## Commits

- b966dc8e: feat(87-06): fake board mirrors the DEPTH-key transition rules and takes an admin deepKey patch (BOARD-28)
- 156ab892: feat(87-06): rekey-deep, a dry-run-first idempotent admin DEPTH re-key (BOARD-28)

All commits carry the required trailers.

## Human verification (deferred to end of run)

None on device for this plan (tooling only). The live dry run and `--yes` re-key are Release 2.3.0 steps in docs/RELEASING.md (87-07), run at the 2.3 release and again at the final-rules cutover.

## Self-Check: PASSED

Modified files exist (src/browser/fakeBoardServer.js, tools/boards-admin.mjs, both test files); commits b966dc8e and 156ab892 are in git log; `git diff --stat` over firebase/, engine/ and src/browser/runDoc.js is empty.
