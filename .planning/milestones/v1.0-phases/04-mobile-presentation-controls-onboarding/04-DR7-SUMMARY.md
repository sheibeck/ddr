---
phase: 04-mobile-presentation-controls-onboarding
plan: DR7 (device-review revision round 7 — button reliability + broken store + polish, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [touch-action, double-tap-bug, store, economy-routing, event-narration, feature-icons, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-DR5A: app-wide -webkit-tap-highlight-color:transparent reset, scoped :hover/:active overrides on named controls, #enc-panel as a .mazebox-level overlay"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: icons.js FEATURE_ICONS/featureKeyForCell/drawFeatureIcon, icons/optimized/*.png preloaded at boot, tools/build-www.mjs copyIcons()"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "engine/economy.js's already-implemented buyFrom()/leaveStore() (plain-data stock, no closures) + engine/actions.js/engine.js's buyItem/leaveStore action types — this round is the deferred 04-07 economy-routing item"
provides:
  - "App-wide `button{touch-action:manipulation}` — the actual root cause of \"buttons sometimes do nothing; need a second tap\": no button anywhere in the app declared its own touch-action, so every tap was subject to Android's ~300ms double-tap-zoom ambiguity window, which a same-window re-render could race and silently drop"
  - "STORE Buy/Leave now dispatch through the engine's buyItem/leaveStore actions (window.mzBuyItem/window.mzLeaveStore bridges) — closes the deferred 04-07 economy-routing item; the classic mazeworld.html buyFrom()/leaveStore() (which called a nonexistent item.buy() closure on the engine's plain-data stock shape) are deleted as dead code"
  - ".goods (dynamically created store-item rows) get dark-theme :hover/:active colors — the last remaining leftover-light-theme white-flash spot DR5A's static-HTML audit couldn't see"
  - "spellChargeRecovered narration names the thing that recharges (\"a spell charge is ready again\") instead of a bare unattributed \"a charge\""
  - "tools/trim-icons.ps1 — a dependency-free PowerShell/System.Drawing pipeline that crops each icons/*.png source to its opaque bounding box and re-centers it on a 144x144 canvas; icons/optimized/*.png regenerated through it; drawFeatureIcon's draw factor dropped from 04-DR4's 1.08 (overflow, compensating for source padding) to 1.0 (the trimmed art itself now fills the cell)"
affects: [05-graveyard-voice-system]

tech-stack:
  added: []
  patterns:
    - "touch-action:auto (the CSS default) leaves a mobile browser's gesture recognizer waiting up to ~300ms after every tap to rule out a double-tap-zoom gesture before firing a synthetic click — if ANYTHING re-renders the tapped element's DOM inside that window (renderEncounter() rebuilding #enc-body, a nav-tab swap), the deferred click's original target no longer exists and the tap is silently dropped. This reproduces as INTERMITTENT (not 100%) missed taps, worst on exactly the buttons whose own handlers trigger a re-render (STORE rows, combat actions, \"Move on\") — matching the reported symptom precisely. touch-action:manipulation removes the ambiguity window outright; one rule on the base button{} selector covers every <button> in the app (D-pad, chips, camp, combat, nav tabs, roller, title, store) in one place, mirroring the existing <canvas> precedent."
    - "engine/economy.js's openStore() (triggered from inside the engine-routed \"move\" action via engine/encounters.js) is the ONLY store-opening path a real player ever reaches — mazeworld.html's own classic openStore()/buyFrom()/leaveStore() are unreachable dead code (window.move is unconditionally overwritten by engineMove(), same fact 04-DR2/04-DR5B2 already documented for encounterDot()/beginEvent()). The engine's stock entries are plain data ({effectId, effectParams}, per economy.js's own \"no function value is ever written onto state\" design) — the classic buyFrom()'s item.buy() call assumed the OLD closure shape and threw a TypeError on the actual shape every player's store uses, silently aborting the click. This was not a wiring gap; it was two code paths for the same feature that had drifted out of shape-compatibility with each other."
    - "A store-item row's :hover/:active CSS living only in the file's <style> block is invisible to a DOM-audit of the static HTML if the row itself is built via document.createElement() at render time (renderEncounter()'s store branch) — DR5A's own \"scoped hover audit\" methodology (grep the static markup for buttons lacking their own :hover) structurally cannot see dynamically-created rows, which is why .goods's leftover #F7F1E2 survived three device-review rounds untouched."
    - "A downscaled icon PNG can carry its source image's own transparent margin straight through the resize — drawFeatureIcon's size factor only controls how large the DRAW RECT is relative to the cell, not how much of that rect is actually opaque pixel content. Tuning the factor upward (04-DR4's 0.94 -> 1.08) to compensate for padding trades one problem (small-looking icon) for another (overflow past the cell) without ever fixing the actual padding; trimming the source art to its own bounding box is the fix that lets the draw factor go back to a clean, non-overflowing 1.0."

key-files:
  created:
    - tools/trim-icons.ps1
    - .planning/phases/04-mobile-presentation-controls-onboarding/04-DR7-SUMMARY.md
  modified:
    - mazeworld.html
    - src/browser/eventNarration.js
    - src/browser/icons.js
    - test/unit/engineAdapter.test.js
    - test/unit/tutorial.test.js
    - icons/optimized/chest.png
    - icons/optimized/crevice.png
    - icons/optimized/descent.png
    - icons/optimized/encounter.png
    - icons/optimized/onewaydoor.png
    - icons/optimized/party.png
    - icons/optimized/teleport.png
    - icons/optimized/trap.png
    - icons/optimized/wall.png

key-decisions:
  - "Fixed touch-action at the single base button{} selector rather than adding it per-control — every interactive control in the app is a real <button> element (confirmed via a full-file audit of every <button id=...> and every dynamically-created button.className), so one rule closes the bug everywhere at once, matching the pattern already established for the app-wide tap-highlight/user-select resets in DR5A."
  - "Deleted the classic buyFrom()/leaveStore() functions entirely rather than leaving them dormant — they had exactly two call sites (both now rewired to window.mzBuyItem/window.mzLeaveStore) and their own logic is provably wrong against the ONLY stock shape a real player ever sees, so keeping them around unused would just be a second, misleading store implementation for a future reader to trip over."
  - "The store-buy/leave bridges (window.mzBuyItem/window.mzLeaveStore) follow the exact same shape as the existing window.mzAbandonCharacter bridge (dispatch -> window.__mzState.set -> narrate html -> re-render) rather than inventing a new pattern — consistency with the one other module-script bridge that already routes a HERO-tab action through the engine seam."
  - "spellChargeRecovered is the ONLY event this narration line covers (engine/movement.js pushes it from exactly one call site, gated on `c.cls === \"Magic User\"`) — named it directly (\"a spell charge\") rather than adding a generic e.item/e.name field to the event itself, since the event genuinely has no per-item identity to carry (it is a flat pool, not a named ability)."
  - "tools/trim-icons.ps1 crops to the opaque bounding box and then fits it to the OUTPUT canvas preserving aspect ratio (scale by the larger axis, centered) rather than stretching non-square art to a square — none of the 9 icons happened to need this fallback (their bounding boxes were already close-to-square), but the script does not assume that will always be true for future art."
  - "Player-marker (party) treatment is unchanged: it goes through the identical, unmodified drawFeatureIcon() call path as every other icon (no dir argument, same 1.0 factor) — the task's \"keep the player-marker treatment working\" constraint required no special-casing since party.png went through the exact same trim pipeline as the other 8 icons."

requirements-completed: []

# No coverage: block — this ad-hoc device-review plan is not a numbered
# PLAN.md and has no `requirements` frontmatter to trace against; verify-work
# falls back to the prose Accomplishments below (legacy path), consistent
# with 04-DR1 through 04-DR5B2-SUMMARY.md's own precedent.

duration: ~90min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR7: Device-review round 7 (button reliability + broken store + polish) Summary

Applied the user's live device-review round 7 to the Delve, Die, Repeat Android build: root-caused and fixed the "buttons sometimes need a second tap" bug (a missing `touch-action:manipulation` left every button subject to Android's double-tap-zoom ambiguity window, which a same-window re-render could race and silently drop the tap), fixed the STORE's Buy/Leave buttons (they threw on the engine's own plain-data stock shape and were routed through the proper `dispatch()`->`applyAction` engine seam — closing the deferred 04-07 economy-routing item — plus the store rows' own leftover white-flash), named what actually recharges in the "a charge comes back" event line, and regenerated the feature-icon PNGs trimmed to their own opaque bounding box so they genuinely fill their map cell instead of floating in a padded square. Two atomic commits, each independently rebuilt (`npm run build:www`) and fully tested (`npm test` + `npm run test:quick`) before the next commit landed.

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-09-08
- **Groups:** 2 (button reliability + STORE fix; recharge wording + icon fill) — no PLAN.md task list, executed as a single ad-hoc device-review round per the user's direct prompt
- **Files modified:** 15 (`mazeworld.html`, `src/browser/eventNarration.js`, `src/browser/icons.js`, `test/unit/engineAdapter.test.js`, `test/unit/tutorial.test.js`, 9× `icons/optimized/*.png`, new `tools/trim-icons.ps1`)

## Accomplishments

### Group 1 — Button reliability + STORE fix (`b8bab90`)

1. **Root-caused "buttons sometimes do nothing; need a second tap."** Audited the map viewport's pointerdown/pointermove/pointerup pan handler first (a common suspect after 04-06/04-DR5 changes) and confirmed it is correctly scoped to `#mw-maze-viewport` alone — MAKE CAMP, the D-pad, and `#enc-panel` are siblings of the viewport (not descendants), so its `setPointerCapture()` never touches them; taps outside the map were never actually swallowed by it. The real cause: **no `<button>` anywhere in the app declared its own `touch-action`** (only `<canvas>` and `.mw-maze-viewport` did) — every button was left on the CSS default `touch-action:auto`, which makes a mobile browser's gesture recognizer wait up to ~300ms after every tap to rule out a double-tap-zoom gesture (the viewport `<meta>` has no `user-scalable=no`/`maximum-scale=1`) before firing a synthetic click. If a re-render lands inside that window — `renderEncounter()` rebuilding `#enc-body`, a nav-tab swap — the deferred click's original DOM target no longer exists and the tap silently drops. This is intermittent by nature and worst on exactly the buttons whose own handlers trigger a re-render (STORE rows, combat actions, "Move on"), matching the reported symptom precisely. Fix: `touch-action:manipulation` added once to the base `button{}` rule, covering every button in the app (D-pad, chips, camp, combat, nav tabs, roller, title, store) in one place.
2. **Fixed STORE "Buy does nothing."** Traced `S.store` to its real origin: every store a player actually reaches is opened by the **engine** (`engine/encounters.js` -> `economy.js#openStore()`, triggered from inside the engine-routed `"move"` action), whose stock entries are plain data (`{effectId, effectParams}`, per `economy.js`'s own "no function value is ever written onto state" design — `mazeworld.html`'s classic `openStore()`/`encounterDot()` are unreachable dead code, same fact already documented for `beginEvent()` in 04-DR2/04-DR5B2). The classic `buyFrom()` called `item.buy()` — a function that simply does not exist on the engine's shape — throwing a `TypeError` and silently aborting the click handler. Replaced the store row/`a-leave` wiring with `window.mzBuyItem(idx)`/`window.mzLeaveStore()` bridges (trailing module script) that route through `dispatch({type:"buyItem"|"leaveStore"})` -> `applyAction` (`engine/economy.js`) — the SAME seam every other action already uses, closing the deferred **04-07 economy-routing** item. Deleted the now-provably-dead classic `buyFrom()`/`leaveStore()` functions.
3. **Fixed STORE white-flash.** `.goods` (the dynamically-created store-item row buttons, built via `document.createElement()` at render time) still had the leftover light-theme `#F7F1E2` on `:hover` with no distinct `:active` color at all — DR5A's static-HTML hover audit structurally could not see them since they don't exist until `renderEncounter()` runs. Repointed to the dark theme's own `var(--paper-3)`/`var(--paper-2)` tones.
4. **Audited every button** in the current layout (all `<button id="...">` elements plus every dynamically-created `button.className` construction site) — every one already has a working, first-tap handler after the above fixes; no orphaned/unwired buttons found.
5. **Added 2 engineAdapter tests** proving the buyItem/leaveStore dispatch routing end-to-end: a full purchase (gold deducted, stock slot marked sold, item granted where the effect grants one, `bought`/`storeLeft` narration events pushed) and an unaffordable purchase (no-op, `buyFailed` event, never a throw).

### Group 2 — Recharge wording + feature icons fill their cell (`88f362c`)

1. **"A recharge comes back…" now names what recharged.** `spellChargeRecovered` (the only event this line narrates — a Magic User's spell-charge pool, `engine/movement.js`, ticking every 20 squares) now reads *"Twenty quiet squares, and a spell charge is ready again — N of M in reserve. The maze keeps no such courtesy for you."* instead of a bare, unattributed "a charge comes back."
2. **Feature icons regenerated to fill their cell without overflowing.** Confirmed visually (via direct image inspection) that `icons/optimized/*.png` (04-06's 144px downscale) carried a wide transparent margin inherited straight from the 1254px source art — `drawFeatureIcon()`'s size factor only controls how large the draw rect is relative to the cell, not how much of that rect is opaque content, so no amount of factor-tuning alone could fix the "looks small" complaint. Wrote `tools/trim-icons.ps1` (dependency-free PowerShell/System.Drawing, mirroring 04-06's own original downscale pipeline) that: scans each `icons/*.png` source for its opaque (alpha > threshold) bounding box via `LockBits`/`Marshal.Copy` (fast, no per-pixel `GetPixel` calls), crops to it, scales the crop (aspect-preserved, never stretched) so its larger axis exactly fills a 144px canvas, and centers it. Ran it to regenerate all 9 `icons/optimized/*.png` — each icon's art now spans 116–144px of its 144px canvas (previously roughly half that). `drawFeatureIcon`'s size factor dropped from 04-DR4's `1.08` (overflow, which was compensating for the source PNGs' own padding) to `1.0` (the trimmed art itself now does the "fill the cell" work). Player-marker (`party`) treatment is unchanged — it draws through the identical, unmodified code path (no `dir` argument, same factor) and went through the exact same trim pipeline as the other 8 icons.
3. **Updated the two `tutorial.test.js` assertions** hard-coded to the old `1.08` factor to `1.0`, matching the new draw math exactly (no behavior these tests check other than the factor itself changed).

## Task Commits

1. **Group 1 — Button reliability + STORE buy/leave engine routing + white-flash fix** — `b8bab90` (fix)
2. **Group 2 — Recharge wording + feature icons fill their cell** — `88f362c` (fix)

Each commit was independently rebuilt (`npm run build:www`) and fully tested (`npm test`, `npm run test:quick`) before the next group's edits began.

## Files Created/Modified

- `mazeworld.html` — app-wide `button{touch-action:manipulation}`; deleted classic `buyFrom()`/`leaveStore()` (replaced with a doc comment explaining why they're gone); store row/`a-leave` wiring repointed to `window.mzBuyItem`/`window.mzLeaveStore`; new module-script bridges `window.mzBuyItem(idx)`/`window.mzLeaveStore()`; `.goods:hover`/`:active` dark-theme colors.
- `src/browser/eventNarration.js` — `spellChargeRecovered` reworded to name the spell charge explicitly.
- `src/browser/icons.js` — `drawFeatureIcon`'s size factor `1.08` -> `1.0`, doc comment updated.
- `test/unit/engineAdapter.test.js` — 2 new tests: buyItem/leaveStore dispatch end-to-end; buyItem no-op on insufficient gold.
- `test/unit/tutorial.test.js` — 2 assertions updated from `1.08` to `1.0` to match the new draw factor.
- `icons/optimized/chest.png`, `crevice.png`, `descent.png`, `encounter.png`, `onewaydoor.png`, `party.png`, `teleport.png`, `trap.png`, `wall.png` — regenerated via `tools/trim-icons.ps1` (cropped to opaque bounding box, re-centered on a 144x144 canvas).
- `tools/trim-icons.ps1` (new) — the dependency-free PowerShell/System.Drawing crop+resize pipeline; re-run any time `icons/*.png` sources change.

## Decisions Made

See `key-decisions` in the frontmatter above (single app-wide `touch-action` rule vs. per-control, deleting rather than leaving the dead classic store functions, reusing the `window.mzAbandonCharacter` bridge pattern for the new store bridges, naming the spell charge directly rather than adding a generic item/name field to an event with no per-item identity, the trim script's aspect-preserving fit rather than stretch-to-square, and the player-marker's unmodified treatment).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — bug] `.goods:active` had no color change at all, only `transform:none`**
- **Found during:** Group 1, while fixing `.goods:hover`'s leftover white.
- **Issue:** `.goods:active:not(:disabled){transform:none}` neutralized the generic button press-down transform but never gave the store rows their own pressed color — a tap's `:active` state would fall through to whatever `:hover` last set (a real flash risk on any device where hover and active co-fire on touch), or show no visible feedback at all.
- **Fix:** added `border-color:var(--moss);background:var(--paper-2)` to `.goods:active:not(:disabled)`, giving every store-row tap the same kind of genuine dark-theme pressed feedback every other button already has.
- **Files modified:** `mazeworld.html`
- **Commit:** `b8bab90`

None of the other work required a checkpoint or user decision — every item was independently verifiable (build + full test suite, plus direct image inspection for the icon trim) and matched the plan's explicit instructions directly.

## Known Stubs / Threat Flags

None. This was presentation-layer (DOM/CSS/JS UI + a build-time PowerShell image tool) work reusing existing engine seams (`dispatch()`/`applyAction`, `engine/economy.js`'s already-implemented `buyItem`/`leaveStore` action types, `EVENT_NARRATION`'s existing `bought`/`buyFailed`/`storeLeft` entries) — no new network endpoints, auth paths, or schema changes at a trust boundary. Store purchases route through the engine seam exclusively (`dispatch({type:"buyItem"|"leaveStore"})`); no raw `state.store`/`state.c.gold` mutation was added to presentation code, and no `GameState.rngState` mutation happens outside `applyAction()`'s existing rehydrate-dispatch-persist cycle. `tools/trim-icons.ps1` is a build-time, offline, local-file-only tool (reads `icons/*.png`, writes `icons/optimized/*.png`) — no network access, no runtime surface.

## Verification

- `npm run build:www` — succeeds at both commit checkpoints; `www/icons/optimized/` reflects the trimmed PNGs (`www/` is gitignored, so no stray build artifacts were committed).
- `npm test` — **462 -> 464/464 green** (462 baseline from 04-DR5B2 + 2 new `engineAdapter.test.js` store-routing tests), green at every checkpoint.
- `npm run test:quick` — **373 -> 375/375 green** at the final checkpoint.
- Direct image inspection (`Read` tool against `icons/optimized/trap.png`, `onewaydoor.png`, `party.png` before and after the trim) visually confirmed the transparent-padding problem and the fix.
- Self-check: both commit hashes (`b8bab90`, `88f362c`) present in `git log`; `mazeworld.html` contains `touch-action:manipulation` inside the base `button{}` rule, `window.mzBuyItem`, `window.mzLeaveStore`, no remaining `function buyFrom(i)`/`function leaveStore()` definitions, and `.goods:active:not(:disabled){transform:none;border-color:var(--moss);background:var(--paper-2)}`; `src/browser/eventNarration.js` contains "a spell charge is ready again"; `src/browser/icons.js` contains `Math.round(size * 1.0)`; `tools/trim-icons.ps1` exists and was executed (icon file sizes/content changed, confirmed via git diff and direct image read).
- No headless-DOM/visual harness exists in this project (consistent with prior `04-DR*-SUMMARY.md` notes) — the on-device "feel" of the touch-action fix (single-tap reliability across all buttons), the store's actual buy/leave flow, the reworded recharge line in context, and the icons' real on-map fill are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Self-Check: PASSED

- FOUND: `mazeworld.html` — `touch-action:manipulation` in the base `button{}` rule, `window.mzBuyItem = function buyItemFromShop(idx)`, `window.mzLeaveStore = function closeStore()`, `row.onclick = () => window.mzBuyItem?.(i);`, `document.getElementById("a-leave").onclick = () => window.mzLeaveStore?.();`, no `function buyFrom(i)`/`function leaveStore()` definitions remaining, `.goods:hover:not(:disabled){border-color:var(--moss);background:var(--paper-3)}`, `.goods:active:not(:disabled){transform:none;border-color:var(--moss);background:var(--paper-2)}`.
- FOUND: `src/browser/eventNarration.js` — `spellChargeRecovered` builder containing "a spell charge is ready again".
- FOUND: `src/browser/icons.js` — `const iconSize = Math.round(size * 1.0);`.
- FOUND: `test/unit/engineAdapter.test.js` — 2 new `"Device-review Pass DR7:"`-titled tests; `import { openStore } from "../../engine/economy.js";`; `import { makeRng } from "../../engine/rng.js";`.
- FOUND: `test/unit/tutorial.test.js` — both `1.08` references replaced with `1.0`.
- FOUND: `tools/trim-icons.ps1` present; `icons/optimized/*.png` (9 files) modified (git diff shows binary changes for all 9).
- FOUND commit `b8bab90` (fix(04-dr7): button reliability (single-tap) + STORE buy/leave now route through the engine).
- FOUND commit `88f362c` (fix(04-dr7): name what recharges + feature icons fill their cell edge-to-edge).
- FOUND: `npm test` 464/464 and `npm run test:quick` 375/375 at final state.

## Next Phase Readiness

- All DR7 items are complete and test-green; ready for on-device UAT on the Pixel 7 build the orchestrator produces next (single-tap reliability across every button, the store's actual buy/sell feel, the reworded recharge line, and the icons' real on-map fill are the main things to confirm on-device).
- No blockers.

---
*Phase: 04-mobile-presentation-controls-onboarding*
*Completed: 2026-09-08*
