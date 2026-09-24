---
phase: 67-play-games-integration-account-chip
plan: 07
subsystem: browser-shell / account chip
status: complete
tags: [account, play-games, controller, renderer, sign-in, compete]
requires:
  - src/browser/account.js (ACCOUNT_STATUS, normalizeAccountState, accountCard, accountIdentity, accountChipView, accountSheetView; 67-03)
  - src/browser/playGames.js provider contract (init silent / signIn interactive, never reject; 67-02)
  - src/browser/settings.js readSettings/writeSetting with compete + pgsWelcomed (67-02)
  - test/unit/account-layout.test.js RENDERER_CLASSES pin (67-05)
provides:
  - src/browser/accountChip.js ACCOUNT_CLASSES, renderAccountChip, renderAccountSheet, createAccountController
affects:
  - 67-08 (the shell wires the chips, #mw-acct-sheet, the rail notify and the settings path to this controller)
  - Phase 68 (subscribes to the controller to purge its submission queue on Compete OFF)
tech-stack:
  added: []
  patterns: [ownerDocument-only DOM renderer with a class-contract completeness walk, frozen-factory controller with injected provider/settings/notify/timers, attempt tokens for stale-result dropping]
key-files:
  created:
    - src/browser/accountChip.js
    - test/unit/accountChip-dom.test.js
    - test/unit/accountChip.test.js
  modified: []
decisions:
  - "Every attempt carries a token (seq); a result is applied only when its token is current and Compete is still ON, so a late, superseded, timed-out or post-Compete-OFF result is dropped"
  - "Compete OFF also cancels the in-flight silent timeout, so no timer outlives the attempt it guards"
  - "setCompete turns Compete on only for true or the string \"true\"; anything else reads as OFF (so a stray dataset string \"false\" can never turn it on)"
  - "A setCompete made while boot() is still reading settings outranks the stored value; boot then only merges pgsWelcomed"
  - "signIn() returns a promise that settles when the interactive attempt does (resolved at once when ignored); boot() resolves once the silent attempt has started, never after it"
metrics:
  duration: ~30 min
  completed: 2026-09-23
  tasks: 2
  files: 3
---

# Phase 67 Plan 07: Account chip renderers and account controller Summary

This plan adds `src/browser/accountChip.js`: two DOM renderers that draw the account chip and its bottom sheet from account.js views, and one controller that decides every sign-in, Compete and card outcome. The launch attempt is silent and never blocks boot. Compete OFF touches no provider method. The welcome card shows once per install. A failure raises one card and schedules no retry, and Stop competing is only Compete OFF.

## What shipped

**Task 1: `ACCOUNT_CLASSES`, `renderAccountChip`, `renderAccountSheet`**
- `ACCOUNT_CLASSES` is the frozen 14-class list, identical to 67-05's `RENDERER_CLASSES` pin in `test/unit/account-layout.test.js`.
- `renderAccountChip(button, view)` (D-07) reuses the button's existing `.mw-acct-face`, whether it came from the static markup or a previous render, and creates one only when missing. It sets `data-state` and `aria-hidden`. An avatar face gets `.mw-acct-initials` on an inline background. The nobody and pending faces get `.mw-acct-glyph` with the background cleared. The button's `aria-label` comes from the view, and a null button is a no-op.
- `renderAccountSheet({ rows, title }, view, handlers)` (D-09/D-10) sets the title, then replaces the rows. In order: `.mw-acct-id` (face plus `.mw-acct-id-text` with name and status), then the action button when the view has one (`data-action` signIn / stopCompeting / pending, disabled from the view), then `.mw-acct-help` when the view has help text, then the Compete `.mw-acct-row` (label plus two `.mw-acct-opt` buttons carrying `data-value`, `aria-pressed` and `active`), then `.mw-acct-settings`. Taps go to `onSignIn`, `onStopCompeting`, `onCompete(value)` and `onSettings`, all optional-chained. A disabled or pending action calls nothing.
- The module builds DOM only through `ownerDocument`. It assigns no HTML strings, uses no window/document/globalThis, imports nothing from content/, uses no storage or network, and never names the plugin.

**Task 2: `createAccountController({ provider, settings, notify, timeoutMs = 20000, setTimer, clearTimer })`**
- Returns a frozen `{ boot, signIn, setCompete, stopCompeting, state, identity, chipView, sheetView, subscribe }`. No method throws or rejects.
- `boot()` is memoized. With Compete OFF it emits `off` and reads no provider property at all (D-02, proven with a Proxy). With Compete ON it starts one silent `provider.init()` without awaiting it (D-01).
- On success: signed in. The first success ever also persists `pgsWelcomed` and notifies `accountCard("welcome")` (D-04).
- A failure, decline, synchronous throw, rejection, malformed result or the 20 s silent timeout all give `signedOut` plus one `accountCard("failed")` (D-11). Nothing is scheduled after that.
- `signIn()` runs `provider.signIn()` only from `signedOut` with Compete ON, and the interactive attempt has no timeout. Two rapid taps make one call.
- `setCompete` is idempotent. Setting it false (and `stopCompeting()`) persists `compete:false`, bumps the attempt token, cancels the silent timer and emits `off`. No sign-out is called (D-03). Setting it true persists `compete:true` and runs one silent init.
- The controller persists only `compete` and `pgsWelcomed`, always as booleans. The player lives only in the in-memory state.
- `subscribe` passes every frozen state snapshot to each listener. A throwing listener is isolated from the others.

## Verification

- `node --test test/unit/accountChip-dom.test.js test/unit/bridge-registry.test.js test/unit/stale-terms.test.js test/unit/account-layout.test.js`: 47/47 pass (accountChip-dom: 19 tests).
- `node --test test/unit/accountChip.test.js test/unit/accountChip-dom.test.js test/unit/account.test.js test/unit/playGames.test.js`: 118/118 pass (accountChip: 37 tests).
- `npm test`: 4668 tests, 4661 pass, 7 fail. The 7 are the known pre-existing CRLF doc-ledger failures (class-pass-ledger 979/980/981/989 and flee-ledger 1744/1745/1746), so the failing set did not grow.
- Acceptance greps: `export const ACCOUNT_CLASSES`, `export function renderAccountChip`, `export function renderAccountSheet` and `export function createAccountController` each appear exactly once.
- No Android build, APK or device step.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 90d9c45 | test(67-07): add failing tests for the account chip and sheet renderers |
| 1 GREEN | 30d067c | feat(67-07): add ACCOUNT_CLASSES and the account chip and sheet renderers |
| 2 RED | 0050c50 | test(67-07): add failing tests for the account controller |
| 2 GREEN | 790779c | feat(67-07): add createAccountController for sign-in, Compete and the account cards |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Compete OFF also cancels the silent timeout**
- **Found during:** Task 2
- **Issue:** Following the plan literally, Compete OFF would bump the token but leave the silent attempt's timer armed until it fired as a dropped no-op.
- **Fix:** The in-flight attempt's timer clear function is kept, and Compete OFF (or a newer attempt) calls it. No timer outlives its attempt.
- **Files modified:** src/browser/accountChip.js
- **Commit:** 790779c

**2. [Rule 2 - Correctness] A Compete choice made during boot's settings read wins**
- **Found during:** Task 2
- **Issue:** If the player toggled Compete while `boot()` was still awaiting `settings.read()`, boot would then apply the stored value. That could start a silent attempt after the player had just turned Compete OFF, which breaks "Compete OFF always wins".
- **Fix:** A `userSet` flag makes boot merge only `pgsWelcomed` once `setCompete` has run. This is tested ("Compete OFF chosen while boot is still reading settings wins over the stored value").
- **Files modified:** src/browser/accountChip.js
- **Commit:** 790779c

**3. [Rule 2 - Correctness] setCompete coercion is strict**
- **Found during:** Task 2
- **Issue:** The plan says "coerce to a boolean", but `Boolean("false")` is true, which a dataset string from the shell could trigger.
- **Fix:** Only `true` or `"true"` turns Compete on. Anything else reads as OFF. This is tested.
- **Files modified:** src/browser/accountChip.js
- **Commit:** 790779c

No other deviations. No files outside `files_modified` were touched. engine/, mazeworld.html, STATE.md, ROADMAP.md and REQUIREMENTS.md are unchanged.

## TDD Gate Compliance

Each task has a `test(...)` RED commit (verified failing: the missing module or export) followed by a `feat(...)` GREEN commit. No refactor commits were needed.

## Known Stubs

None. The module is complete, and 67-08 wires it into the shell as planned.

## Flagged assumptions (carried from the plan)

- The 20 s silent timeout is Claude's discretion (PGS-02 edge probe unclassified). If Play Games answers later than that, the player sees the failed card and stays signed out until the next launch or a Sign in tap.
- D-11 frequency: a Compete-ON player with no Play Games profile sees one failed card per launch. The card itself says how to turn Compete off. Changing this to once per install would be a one-flag change if the user prefers it.

## Human verification (deferred to end of run)

For the Phase 69 batch (docs/UAT-v2.0.md). Do not pause for a device:

1. A first-ever sign-in shows the "ON THE PUBLIC RECORD" welcome rail card once, and never again after an app restart.
2. A declined interactive sign-in (the Sign in row, then cancel Google's prompt) shows the "PLAY GAMES DID NOT ANSWER" rail card and nothing modal. The chip stays the nobody glyph, and no automatic retry follows during the session.
3. Stop competing turns the chip into the nobody glyph at once. A later Compete ON signs back in silently: the chip goes pending, then shows the avatar with no prompt.

## Self-Check: PASSED

- FOUND: src/browser/accountChip.js
- FOUND: test/unit/accountChip-dom.test.js
- FOUND: test/unit/accountChip.test.js
- FOUND: 90d9c45, 30d067c, 0050c50, 790779c
