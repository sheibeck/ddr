---
quick_id: 260927-r4v
status: complete
date: 2026-09-27
---

# Quick 260927-r4v: raise the rail over the store, loot and stair screens (summary)

(Written by the orchestrator from the executor's returned text.)

**Result:** a rail card raised while the store, the loot screen or the stair prompt is open now shows OVER that screen, as combat cards already do. While the card is up, that screen's bottom buttons hide in place: the store's Leave row, TAKE ALL / LEAVE ALL, and GO DOWN / NOT YET. They come back in the same spot when the card goes. UI-only: no engine, content or fixture change, and no bot run. Commit dd84f56d.

## The fix (mazeworld.html)
- `:1029` `#mw-rail[data-over="panel"]{z-index:8}` ties `.mw-overlay`, and the rail comes later in the markup, so it paints on top (the combat mechanism). The ☰ scrim (9), the wrap (10) and every sheet (45+) still open over it.
- `:1030-1031`: while `#enc-panel[data-rail-up="1"]`, the rows `#enc-body>.actions`, `.cb-over-actions` and `.mw-major-actions` get `visibility:hidden`, and their buttons get `pointer-events:none`. Visibility only, so nothing reflows. A decision card's own buttons stay live.
- `:4291` `panelScreenUp()` and `:4302` `syncPanelRailUp()`. `renderRail` sets `data-over="panel"` in its existing data-over block (combat branch unchanged) and syncs after it and in the stairs-fade exit. Every show and dismissal path goes through that one place.

## Measured (headless Edge 412x915 over CDP)
Store (Leave 787-835), loot (TAKE ALL 703-751) and stair (GO DOWN 544-592): the card sits on top and the buttons are hidden in place. After dismissal they're visible again at the same rect and hit-testable.

## Tests
`test/unit/shell-rail-over-panels.test.js` (16, written first, all failing before the fix) runs the real `renderEncounter` and `renderRail`. It covers:
- the CSS pins;
- the store, loot and stair screens;
- the dismissal paths;
- decision cards (USE TORCH over the store, a joiner over the loot screen);
- combat unchanged;
- relaunch.

No re-pins, no snapshots, no fixture moved.

## Gates (worktree)
`npm test` 7,504/7,504; parity 66/66; build:www + boot:check PASS.

## Notes for the user
1. The THEY ARE DOWN over-panel with no drops (and the fled/soothed ending) is not covered: a level-up card there still draws under it. A small follow-up if wanted.
2. The buttons hide whenever a card is up over those screens, even when the card doesn't overlap them (the 260927-s7b rule).
3. Keyboard Enter still presses GO DOWN while a card is up; touch can't reach the hidden buttons.

## Human check (Pixel 7)
- BUY in a store: WELL THEN shows over the store and the Leave row is hidden, then comes back in place.
- A too-poor BUY: the refusal shows over the store.
- The same on the loot screen and at a stair.
- Combat cards unchanged.
