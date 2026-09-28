---
quick_id: 260928-fcs
status: complete
date: 2026-09-28
---

# Quick 260928-fcs: the find card's drop list scrolls and its rows stay separate (summary)

(Written by the orchestrator from the executor's returned text.)

**Result:** On the full-bag SOMETHING WORTH TAKING card, the drop list scrolls. Every row is separated from the next by a divider, with a bold name and a stat line clamped to 2 lines. The found item and TAKE IT NOW / LEAVE IT stay on screen at S, M and L. Dragging the list never drops an item or dismisses the card. UI-only. Commits 416f23ee (fix and tests) and d077a16c (the todo move).

## Root causes (measured with headless Edge at 412x915, largest bag full)
- **Rows ran together:** the app-wide `button{min-height:48px}` replaced each flex row's automatic minimum, so inside the bounded `.shelf` column every row shrank to 48px and its wrapped stat line spilled over the row below. The list's scroll height only counted the squashed rows. The loot screen's `#loot-drop-shelf` had the same bug.
- **Poor scrolling:** the found item's lines and the list shared one lines column, which gave three nested scroll areas on a short stage. The inner list's `overscroll-behavior:contain` stopped a list drag from ever scrolling the card, and a re-render reset the list's scroll.

## Fix (mazeworld.html)
- **Rows (:1078-1083):** `flex:none`, a `var(--rule)` divider, padding, a bold name, and the stat line clamped to 2 lines. The list gets `gap:0`, `touch-action:pan-y` and touch scrolling.
- **Head (:1076, renderRail :5872-5889):** on the full-bag card, the narration and item lines go into `#find-head.mw-find-head`, a sibling of the list. The head has a 7rem floor and scrolls on its own. The list is `flex:0 100 auto` with an 8rem floor, so the list shrinks first.
- **Scroll kept:** a same-card re-render keeps the scroll positions.
- **Drag vs tap (:4150, :6059):** a move over 10px, a cancel or a scroll swallows the next row click (tracked in a WeakMap), and the rail's body-tap ignores taps inside the list.

## Tests
- New `test/unit/find-card-scroll-rows.test.js` (12, written first; 9 failed before the fix).
- `find-card-full-bag.test.js` re-pinned (b, d, e).

## Gates (worktree)
npm test 7,516/7,516; parity 66/66; build:www + boot:check PASS.

## Notes for the user
1. A stat line longer than 2 lines is trimmed with an ellipsis on the find card and the loot screen; the full text is on the Gear tab.
2. At L on a short screen, the found item's text scrolls in its own area.

## Human check (Pixel 7)
Biggest bag, full, text L, find a weapon:
- the name, stats and the buttons stay visible;
- the rows are separated;
- the list scrolls by finger;
- a scroll never drops an item or closes the card;
- a tap on a row drops that item.
Check the loot screen's rows too.
