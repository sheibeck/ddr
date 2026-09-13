---
phase: 04-mobile-presentation-controls-onboarding
plan: DR1 (device-review revision, ad hoc — not a numbered PLAN.md)
subsystem: ui
tags: [crawl-screen, dpad, tap-to-move, layout, overlay, device-review]

# Dependency graph
requires:
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-05: the dark shell's #app/#screen-maze/.mazebox/.mw-tabbar chrome"
  - phase: 04-mobile-presentation-controls-onboarding
    provides: "04-06: the pannable DPR viewport (.mw-maze-viewport), PNG icons, tap-to-move + D-pad gesture pipeline, canvasSizing.js/settings.js"
provides:
  - "cellSizeForTextScale S/M/L bumped to 48/60/72 (was 28/34/40) — bigger maze squares + PNG icons (icons scale with CELL)"
  - "D-pad-only movement: .dpad always display:grid (no settings-gated toggle); tap-to-move disabled in the viewport pointer handler regardless of settings.controlScheme; settings.js SETTINGS_DEFAULTS.controlScheme default changed tap->dpad"
  - "MAZE tab label + new .mw-map-heading section heading renamed to MAP (code id=\"maze\"/data-tab=\"maze\"/.mw-maze-viewport and in-fiction Maze/Maze Master lore text unchanged)"
  - "MAP screen viewport now fills all remaining vertical space (flex:1 chain: #app height:100vh -> .mw-screens -> #screen-maze -> .mazebox -> .mw-maze-viewport) with the D-pad/MAKE CAMP control bar pinned below it"
  - "#enc-panel (feature-tile narration/combat/store/death/win) converted from a permanent panel beneath the map into an absolutely-positioned over-map overlay (.mw-overlay), hidden by default and gated by a new hasActiveEncounter() predicate"
affects: [04-07, 04-08, 04-09, 04-10, 04-11 (SUMMARY only referenced; 04-08 in particular now inherits an overlay container instead of a permanent panel to build the full combat surface into)]

tech-stack:
  added: []
  patterns:
    - "hasActiveEncounter() as the single source of truth for whether the over-map overlay should be visible (S.dead || S.won || S.combat || S.store || S.beats.groups.length) — reused by both renderEncounter() (show/hide the panel) and the viewport pointerdown handler (suppress pan-start while the overlay covers the map)"
    - "Flex-fill chain requires a DEFINITE height at the root (#app switched min-height:100vh -> height:100vh) with min-height:0 at every flex:1 link in the chain, so a nested viewport can fill 'remaining space' without the classic flexbox min-content trap"

key-files:
  created: []
  modified:
    - src/browser/canvasSizing.js
    - test/unit/canvasSizing.test.js
    - src/browser/settings.js
    - test/unit/settings.test.js
    - mazeworld.html

key-decisions:
  - "Combat itself (STRIKE/POTION/RUN AWAY) was NOT rewired to route through the engine adapter in this task — it still runs the CURRENT classic combat flow (act(playerStrike)/act(drinkPotion)/act(flee), mutating the classic-script S.combat directly). This revision only moved that same rendering INTO the new over-map overlay instead of leaving it in a permanent panel beneath the map. Full engine routing of combat/economy is 04-07's job; the polished full-screen STRIKE/POTION/RUN AWAY surface (party rail, etc, per 04-UI-SPEC screens 9-10 / the design mock) is 04-08's job. This task deliberately did not touch either."
  - "Dropped the idle-state 'The corridor is quiet. Walk on.' filler paragraph entirely (previously rendered inside #enc-panel when nothing was happening) — now that the panel is gated by hasActiveEncounter() and hidden outright at rest, that branch became unreachable, so it was removed rather than left as dead code."
  - "controls.js's tap->cell code (classifyPointerGesture/screenToCell/resolveTapDirection) and settings.js's 'tap' controlScheme value are both left INTACT and importable per the user's explicit instruction — only the call site that WIRES a viewport tap to window.move(dir) was removed. A future re-enable (e.g. an optional settings toggle) can re-add that one call without resurrecting any deleted logic."
  - "The tab bar's user-visible label is now the app's only on-screen 'section heading' analog for other tabs (Hero/Gear/Oracle/Dead each have a distinct panel <h2> that doesn't literally repeat the tab word) — added a lightweight, non-boxed .mw-map-heading <h2>MAP</h2> above the viewport for parity/discoverability, rather than only relying on the tab label, since the task called out both a tab AND a 'section heading'."

patterns-established:
  - "Over-map modal-over-a-positioned-viewport pattern (.mw-overlay inset:0 inside .mw-maze-viewport's position:relative) is now the template later plans (04-08's full combat screen) should extend rather than reintroducing a separate fixed/permanent panel."

requirements-completed: []

duration: ~55min
completed: 2026-09-08
status: complete
---

# Phase 4 Plan DR1: Device-review revisions to the MAP crawl screen Summary

Applied the user's 5 live device-review directives (Pixel 7 Wave-4 build) to the crawl screen: bigger cells/icons, D-pad-only movement, MAZE->MAP rename, a map that fills the screen, and encounter/feature narration as an over-map overlay instead of a permanent panel.

## What Changed

1. **Bigger cells + icons** (`src/browser/canvasSizing.js`, `test/unit/canvasSizing.test.js`): `cellSizeForTextScale` S/M/L bumped from 28/34/40 to **48/60/72** CSS px; M(60) stays the default. PNG feature icons scale with `CELL` automatically (no separate icon-sizing code to touch).

2. **D-pad only** (`src/browser/settings.js`, `test/unit/settings.test.js`, `mazeworld.html`): `.dpad` CSS is now `display:grid` unconditionally (removed the `settings.controlScheme === 'dpad'` JS toggle that used to hide it). The viewport's pointer-gesture handler no longer resolves or acts on a `tap` gesture at all — pan (drag) and the CENTRE button still work; `classifyPointerGesture`/`screenToCell`/`resolveTapDirection` (`src/browser/controls.js`) remain imported/bridged onto `window.__mzControls` and fully usable, just not called to move the player. `SETTINGS_DEFAULTS.controlScheme` default changed `"tap"` -> `"dpad"` (both values remain in the allowed set).

3. **MAZE -> MAP rename** (`mazeworld.html`): the bottom-tab button text and a new `.mw-map-heading` `<h2>MAP</h2>` above the viewport. `id="maze"`, `data-tab="maze"`, `.mw-maze-viewport`, and all in-fiction "Maze"/"Maze Master" lore strings are unchanged (product-label-only rename, per the task's explicit boundary).

4. **Big map, no permanent panel** (`mazeworld.html` CSS): `#app` switched `min-height:100vh` -> `height:100vh` to give the layout a definite height to size against; a `flex:1`/`min-height:0` chain (`.mw-screens` -> `#screen-maze` -> `.mazebox` -> `.mw-maze-viewport`) makes the map viewport fill all remaining vertical space between the new heading and the bottom D-pad/MAKE CAMP control bar. Other tabs (Hero/Gear/Oracle/Dead) are unaffected — `.mw-screens` keeps its own `overflow-y:auto` for their (unchanged) normal document-flow scrolling.

5. **Over-map overlay** (`mazeworld.html`): `#enc-panel` moved from a permanent sibling panel beneath `.mazebox` into an absolutely-positioned child of `.mw-maze-viewport` (`.mw-overlay`, `inset:0`), `hidden` by default. A new `hasActiveEncounter()` predicate (`S.dead || S.won || S.combat || S.store || S.beats.groups.length`) is the single gate `renderEncounter()` uses to show/hide it, and is also reused by the viewport's `pointerdown` handler to suppress pan-start while the overlay is covering the map. The narration dismiss button (`"Walk on"`) was relabeled **"Move on"**. Combat (STRIKE/POTION/RUN AWAY) renders inside this same overlay using the exact same classic combat code path as before (`act(playerStrike)`/`act(drinkPotion)`/`act(flee)`) — only its container changed.

## Deferred to 04-07 / 04-08 (explicitly out of scope for this task)

- **Combat is still on the classic (non-engine) code path.** `act(playerStrike)`/`act(drinkPotion)`/`act(flee)` mutate the classic script's own `S.combat` directly rather than going through `engineAdapter.dispatch()`/`applyAction`. Movement itself (and the feature-tile triggers dot/trap/chest/tele/exit, including entering combat) already run through the engine as of 01-10/03-02 — the gap is specifically the in-combat STRIKE/POTION/RUN AWAY resolution loop. Routing that through the engine adapter is 04-07's scope.
- **The polished full-screen combat surface** (party rail, per-foe targeting chrome matching the design mock, dedicated STRIKE/POTION/RUN AWAY layout beyond the existing functional buttons) is 04-08's scope — this task only relocated the existing functional combat UI into the new overlay container; it did not redesign it.
- The `.legend` (MARKS bottom-sheet) is still a simple inline toggle, not the full slide-up bottom-sheet chrome from 04-UI-SPEC Screen 7 — pre-existing gap from 04-06, not touched by this task.

## Verification

- `npm run build:www` — succeeds, `www/index.html` regenerated cleanly.
- `npm test` — **451/451 green** (canvasSizing.test.js and settings.test.js updated to match the new 48/60/72 and `dpad`-default values; no other suite affected).
- `npm run test:quick` — **362/362 green**.
- No headless-DOM/visual harness exists in this project (consistent with 04-05/04-06's own verification notes) — the flex-fill layout, overlay positioning, and on-device "feel" of the bigger cells/D-pad-only controls are unverified here and should be confirmed on the Pixel 7 build the orchestrator produces next.

## Known Stubs / Threat Flags

None. No new network endpoints, auth paths, or schema changes were introduced — this was a presentation-layer (DOM/CSS/JS UI wiring) revision only, entirely reusing existing engine seams (`window.move()`/`dispatch()`) and the existing classic combat code path.

## Self-Check: PASSED

- FOUND: src/browser/canvasSizing.js (cellSizeForTextScale returns 48/60/72)
- FOUND: test/unit/canvasSizing.test.js (updated assertions)
- FOUND: src/browser/settings.js (controlScheme default 'dpad')
- FOUND: test/unit/settings.test.js (updated assertions)
- FOUND: mazeworld.html (.mw-map-heading, .mw-overlay, hasActiveEncounter, #screen-maze flex chain)
- FOUND commit 8a5e96b (feat(04): bump maze cell size to 48/60/72)
- FOUND commit 2b2fcaa (feat(04): default controlScheme to 'dpad')
- FOUND commit 68c5984 (feat(04): D-pad-only crawl screen, MAP rename, dominant map, over-map overlay)
