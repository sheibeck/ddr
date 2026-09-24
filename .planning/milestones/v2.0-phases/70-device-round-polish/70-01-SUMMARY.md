---
phase: 70-device-round-polish
plan: 01
subsystem: browser-presentation (hud menu, Play Games account)
tags: [vanilla-js, presentation-only, hud, hamburger-menu, play-games, account, milestone-v2.0]
status: complete
requires:
  - src/browser/boardsView.js initialsOf / avatarColour (unchanged, imported)
  - Phase 67 account view model and controller
provides:
  - "hudMenu.js: HUD_MENU_GLYPH, HUD_MENU_QUIT_COPY, ABANDON_ARM_MS, ABANDON_ROW_EVENTS, abandonRowNext (pure)"
  - "account.js: accountMenuView(state)"
  - "accountChip.js: renderMenuFace(button, view), renderAccountMenu(host, view, handlers), controller menuView()"
  - "content/account.js: ACCOUNT_COPY.menuLabel { signedIn, plain }"
affects:
  - plan 70-03 (wires these exports into mazeworld.html)
  - plan 70-04 (opens the ☰ on every screen)
tech-stack:
  added: []
  patterns:
    - "pure reducer with fail-safe ctx reads (try/catch field access, strict === checks)"
    - "renderer repaints a static-markup element in place, never creates it"
key-files:
  created: []
  modified:
    - src/browser/hudMenu.js
    - src/browser/account.js
    - src/browser/accountChip.js
    - content/account.js
    - test/unit/hudMenu.test.js
    - test/unit/account.test.js
    - test/unit/account-copy.test.js
    - test/unit/accountChip-dom.test.js
    - test/unit/accountChip.test.js
    - test/voice/safety-scan.test.js
    - test/unit/hp-not-wp.test.js
decisions:
  - "DISC-4 (carried): ACCOUNT_COPY.cards.failed.line tail is now 'from the menu in the corner.'; the welcome card's 'little face in the corner' is untouched (still true when signed in, the ☰ wears the avatar)"
  - "DISC-5 (carried): the only new copy is ACCOUNT_COPY.menuLabel and HUD_MENU_QUIT_COPY; both walked by the voice safety scan and the HP-not-WP scan"
  - "abandonRowNext: confirm required unless ctx.confirm === false; dead only when ctx.dead === true; only armed === true abandons on the next tap"
  - "renderMenuFace menu face: replaceChildren() then textContent = glyph (plain text, no .mw-acct-glyph span), so no new class enters ACCOUNT_CLASSES"
metrics:
  duration: ~20 min
  completed: 2026-09-24
  tasks: 2
  files: 11
---

# Phase 70 Plan 01: ☰ pure layer (account face, ACCOUNT block, quit rows) Summary

The pure, DOM-free groundwork for POLISH-02/03 is in place. hudMenu.js now has the ☰ glyph, the SAVE & QUIT / ABANDON THIS CHARACTER row copy and a fail-safe two-tap `abandonRowNext` reducer (D-06). account.js has `accountMenuView`: the initials avatar when signed in, the plain ☰ otherwise (D-03). accountChip.js adds `renderMenuFace`, `renderAccountMenu` (the sheet's rows without its title or Settings row) and the controller's `menuView()` (D-04). Nothing is visible yet; plan 70-03 wires it.

## What shipped

### Exports for plan 70-03 to wire

| Module | Export | Contract |
|---|---|---|
| `src/browser/hudMenu.js` | `HUD_MENU_GLYPH` | `"☰"` (☰, 9776). The source stays ASCII. |
| | `HUD_MENU_QUIT_COPY` | frozen `{ saveQuit: "SAVE & QUIT", abandon: "ABANDON THIS CHARACTER", armed: "TAP AGAIN TO BURY THEM", newCharacter: "NEW CHARACTER" }` |
| | `ABANDON_ARM_MS` | `3000`. The shell owns the timer and feeds its expiry in as `"timeout"`. |
| | `ABANDON_ROW_EVENTS` | frozen `["tap", "timeout", "close"]` |
| | `abandonRowNext(armed, kind, ctx)` | returns a frozen `{ armed, act }`, where `act` is one of `null`, `"abandon"`, `"newCharacter"`. `ctx = { dead, confirm }`. Pass `confirm: readSettings().confirmQuit` (Off → `false`) and `dead: hero is dead`. |
| `src/browser/account.js` | `accountMenuView(state)` | `{ face: "avatar" \| "menu", initials, bg, glyph, label }` |
| `src/browser/accountChip.js` | `renderMenuFace(button, view)` | repaints `#mw-hud-menu-btn`'s existing `.mw-hud-menu-face` (`data-state`, `aria-hidden`, inline background) and the button's `aria-label` |
| | `renderAccountMenu(host, view, handlers)` | takes `account.sheetView()`. Draws identity → action? → help? → Compete. Handlers: `onSignIn`, `onStopCompeting`, `onCompete(value)`. |
| | controller `menuView()` | `accountMenuView(state())` |
| `content/account.js` | `ACCOUNT_COPY.menuLabel` | `{ signedIn: "Menu — signed in as {name}", plain: "Menu" }` |

### abandonRowNext truth table (D-06)

- A `tap` with `ctx.dead === true` gives `{ armed:false, act:"newCharacter" }`, whatever the arm state.
- With confirm required, the first `tap` gives `{ armed:true, act:null }`. A `tap` while `armed === true` gives `{ armed:false, act:"abandon" }`.
- With `ctx.confirm === false`, a single `tap` gives `{ armed:false, act:"abandon" }`.
- Confirm counts as required for a missing, null, non-object or hostile ctx, and for a non-boolean confirm. The first tap only arms (T-70-02).
- `timeout`, `close`, or an unknown or missing kind gives `{ armed:false, act:null }`.

## Carried decisions

- **DISC-4:** `ACCOUNT_COPY.cards.failed.line` now ends "…turn Compete off, from the menu in the corner." Only its tail changed; it still matches /playable/i, /try again/i and /Compete off/. The welcome line ("from the little face in the corner") was left alone per the plan. When signed in, the ☰ is that little face.
- **DISC-5:** The only new copy is `ACCOUNT_COPY.menuLabel` and `HUD_MENU_QUIT_COPY`. Both are walked by `test/voice/safety-scan.test.js` and `test/unit/hp-not-wp.test.js`. ACCOUNT_COPY was already walked, and HUD_MENU_QUIT_COPY is newly registered with a Phase 70 D-06 comment.
- `ACCOUNT_CLASSES` is unchanged (14 entries). The menu face writes its ☰ as plain text rather than a `.mw-acct-glyph` span. The completeness walk now also covers `renderAccountMenu`'s output and the menu face's children.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | af8834e | test(70-01): add failing tests for the quit-row copy and two-tap abandon reducer |
| 1 GREEN | 23b14b0 | feat(70-01): quit-row copy and the two-tap abandon reducer |
| 2 RED | e7d7471 | test(70-01): add failing tests for the ☰ account face view and ACCOUNT-block renderers |
| 2 GREEN | 1b4a374 | feat(70-01): the ☰ account face view and ACCOUNT-block renderers |

## Verification

- `node --test` on hudMenu, safety-scan and hp-not-wp: 40/40 pass.
- `node --test` on account, account-copy, accountChip-dom, accountChip, hudMenu, account-layout and shell-account: 176/176 pass.
- `npm test`: 5138/5145 pass (30 new tests). The 7 failures are the known worktree CRLF doc-ledger artifacts (class-pass-ledger ×4, flee-ledger ×3).
- `git diff --stat 6f86911 HEAD` touches exactly the 11 files in files_modified. mazeworld.html, docs/, engine/, test/parity/, every shell-* test and boardsView.js are untouched.
- The hudMenu.js purity pin is green, and `hudMenuNext`, `HUD_MENU_ITEMS` and `HUD_MENU_EVENTS` are unchanged.

## TDD Gate Compliance

Both tasks followed RED → GREEN. Each has a `test(70-01)` commit before its `feat(70-01)` commit, and every RED run failed on the missing exports or copy. No refactor commits were needed.

## Deviations from Plan

None. The plan was executed as written.

## Known Stubs

None. Every export is fully implemented. They are unwired until plan 70-03, by design.

## Human verification (deferred to end of run)

Nothing is visible from this plan alone, so there is no device check here. Once 70-03 and 70-04 land, fold these into the milestone's batched Pixel 7 checklist:

1. Signed in to Play Games: the ☰ button shows your initials on your avatar colour (the same as the title chip), and TalkBack reads "Menu — signed in as {your name}".
2. Signed out, signing in, or Compete OFF: the ☰ shows the plain ☰ glyph, and TalkBack reads "Menu".
3. In the ☰ dropdown, the ACCOUNT block shows identity, the one action (SIGN IN / STOP COMPETING / a disabled SIGNING IN…), the helper line when applicable, and COMPETE ON/OFF. It has no title and no second SETTINGS row.
4. ABANDON THIS CHARACTER with Settings › Confirm before quit On: the first tap shows TAP AGAIN TO BURY THEM, and the second tap within 3 s abandons. Waiting 3 s or closing the menu disarms it. With the setting Off, one tap abandons. With the hero dead, the row reads NEW CHARACTER.
5. A failed or declined sign-in: the rail card ends "…from the menu in the corner."

## Self-Check: PASSED

- FOUND: src/browser/hudMenu.js, src/browser/account.js, src/browser/accountChip.js, content/account.js (all modified)
- FOUND commits: af8834e, 23b14b0, e7d7471, 1b4a374
