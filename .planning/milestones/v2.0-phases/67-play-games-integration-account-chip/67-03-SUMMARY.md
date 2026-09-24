---
phase: 67-play-games-integration-account-chip
plan: 03
subsystem: browser-shell / account chip
status: complete
tags: [account, play-games, view-model, copy, voice]
requires:
  - src/browser/boardsView.js (initialsOf, avatarColour — Phase 66 port of the mock's INITIALS/AVATAR)
  - src/browser/rail.js (RAIL_HOLD, RAIL_TONES)
provides:
  - content/account.js ACCOUNT_COPY
  - src/browser/account.js ACCOUNT_STATUS, normalizeAccountState, accountChipView, accountSheetView, accountCard, accountIdentity
affects:
  - 67-07 (controller + chip/sheet rendering consumes these view contracts)
  - 67-04 (Leaderboards identity strip reads accountIdentity)
tech-stack:
  added: []
  patterns: [pure total view model returning frozen objects, content table walked by the voice and HP-not-WP scans]
key-files:
  created:
    - content/account.js
    - src/browser/account.js
    - test/unit/account-copy.test.js
    - test/unit/account.test.js
  modified:
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
decisions:
  - "Compete ON with status 'off' (a contradiction) normalizes to 'signedOut'; 'off' exists only under Compete OFF"
  - "A signedIn state always carries a frozen player { id, displayName } of strings, empty when the profile is missing, so the chip falls back to 'A player with no name' rather than dropping to the nobody glyph"
  - "normalizeAccountState reads fields through a try/catch so even a hostile getter/Proxy cannot make a view throw"
  - "{name} is filled with a replacer function so display names containing $ patterns render literally"
metrics:
  duration: ~25 min
  completed: 2026-09-23
  tasks: 2
  files: 6
---

# Phase 67 Plan 03: Account chip copy and pure view model Summary

This plan adds every word the account chip, its sheet and its two rail cards show, in one scanned, deep-frozen table (`content/account.js` `ACCOUNT_COPY`). It also adds a pure, total view model (`src/browser/account.js`) that turns any account state into the chip, the sheet, the welcome and failure rail cards, and the Leaderboards identity input. Compete OFF always wins, and there is no sign-out row.

## What shipped

**Task 1: `content/account.js` (`ACCOUNT_COPY`)**
- `glyph "?"` (D-07). The `chipLabel` block has signedIn (with `{name}`), signedOut, pending and off.
- The `sheet` block has the title "PLAY GAMES" and the exact D-10 status lines (`PLAY GAMES · SIGNED IN / SIGNED OUT / SIGNING IN / COMPETE OFF`). It also has nobody, unnamed, SIGN IN, SIGNING IN…, STOP COMPETING, the D-03 `stopHelp` line pointing at the Play Games app, an `offHelp` line ("Nothing leaves this phone. Nobody is keeping score but you, and you were always going to."), COMPETE, ON, OFF and SETTINGS.
- `cards.welcome` "ON THE PUBLIC RECORD" (D-04: public record + Compete off from the little face in the corner). `cards.failed` "PLAY GAMES DID NOT ANSWER" (D-11: stays playable, try again or turn Compete off).
- Both `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js` now import and walk `ACCOUNT_COPY` (one Phase 67 comment each).
- `test/unit/account-copy.test.js` (15 tests) checks:
  - the shape and the deep-freeze
  - that the only token is `{name}`
  - every D-03/D-04/D-07/D-10/D-11 line
  - that no line offers a sign-out
  - that there is no WP
  - scan registration, with a source pin plus a planted banned word caught by the same walk.

**Task 2: `src/browser/account.js`**
- `ACCOUNT_STATUS`, frozen with its four statuses.
- `normalizeAccountState` behaves as the plan specifies: compete is true unless exactly false, Compete OFF forces off with a null player, and an unknown status becomes signedOut. The player is frozen `{id, displayName}` strings, kept only while signed in, and welcomed must be exactly true.
- `accountChipView`:
  - Signed in, it gives the initials avatar via `initialsOf`/`avatarColour` imported from `./boardsView.js` (the hash is never re-implemented), using the trimmed display name or the unnamed fallback.
  - Pending gives the pending face.
  - Signed out and Compete OFF give the nobody glyph.
  - Each of the four states has its own accessible label.
- `accountSheetView` follows the pinned contract (title, identity, action, help, compete {label, on, options}, settings). The action is signIn, stopCompeting, a disabled pending row, or null. The help line is stopHelp when signed in, offHelp with Compete OFF, and "" otherwise.
- `accountCard("welcome")` gives tone "odd" with `RAIL_HOLD.floor`. `accountCard("failed")` gives tone "dull" with `RAIL_HOLD.default`. Any other kind gives null.
- `accountIdentity` gives `{signedIn: true, player}` only when signed in with Compete ON, else `{signedIn: false, player: null}`.
- `test/unit/account.test.js` (32 tests, ~360 lines) covers:
  - every status for the chip and the sheet
  - the stale signed-in with Compete OFF case
  - 21 malformed inputs plus a throwing Proxy
  - that no sheet ever has a sign-out action
  - the frozen outputs and that inputs are never mutated
  - the source pins: boardsView/content imports, no `>>> 0` hash, and no document/window/storage/Date/Math.random/network references.

## Verification

- `node --test test/unit/account-copy.test.js test/voice/safety-scan.test.js test/unit/hp-not-wp.test.js test/determinism/content-is-pure-data.test.js test/unit/stale-terms.test.js`: 39/39 pass.
- `node --test test/unit/account.test.js test/unit/account-copy.test.js test/unit/stale-terms.test.js`: 52/52 pass.
- Full suite (`node --test`): 4514 tests, 4507 pass, 7 fail. All 7 are the known, pre-existing CRLF doc-ledger failures (`test/unit/class-pass-ledger.test.js` ×4, `test/unit/flee-ledger.test.js` ×3). The failing-test set did not grow.
- Engine untouched: no edits to `engine/` or `test/parity/prototype-master.js.txt`.
- No Android build, APK or device step.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 8f75b4f | test(67-03): add failing ACCOUNT_COPY pins and scan registrations |
| 1 (GREEN) | 5e9ed5d | feat(67-03): add ACCOUNT_COPY, the account chip, sheet and rail-card words |
| 2 (RED) | f2cfd81 | test(67-03): add failing account view-model tests |
| 2 (GREEN) | 21ff591 | feat(67-03): add the pure account chip and sheet view model |

## Deviations from Plan

None to the plan's behaviour. Small judgment calls within the plan's latitude (recorded in `decisions`):
- A contradictory Compete ON + status "off" normalizes to signedOut.
- A signedIn state with no player carries an empty player, so the unnamed fallback applies. This matches the plan's flagged assumption that a failed profile lookup shows "A player with no name" initials.
- A test-only fix: the totality test first labelled a `Object.create(null)` input with `String()`, which throws. It was switched to `JSON.stringify` before the GREEN commit.

## TDD Gate Compliance

Both tasks have a `test(...)` commit followed by a `feat(...)` commit. No refactor commit was needed.

## Known Stubs

None.

## Human verification (deferred to end of run)

For the Phase 69 batch (`docs/UAT-v2.0.md`); do not pause for a device:
- On the Pixel 7, the **welcome card** ("ON THE PUBLIC RECORD") reads well on the rail: deadpan, family-friendly, fits without awkward wrapping, and holds long enough (RAIL_HOLD.floor).
- On the Pixel 7, the **failure card** ("PLAY GAMES DID NOT ANSWER") reads well on the rail: deadpan, family-friendly, never presented as a modal.
- The sheet's **Stop competing helper line** and **Compete OFF line** read in voice and never imply the account is signed out while Play Games is still signed in.
- The **nobody glyph** ("?") and the pending face read as deliberate, not broken (render lands in 67-05/67-07).

## Self-Check: PASSED

- FOUND: content/account.js, src/browser/account.js, test/unit/account-copy.test.js, test/unit/account.test.js
- FOUND commits: 8f75b4f, 5e9ed5d, f2cfd81, 21ff591
