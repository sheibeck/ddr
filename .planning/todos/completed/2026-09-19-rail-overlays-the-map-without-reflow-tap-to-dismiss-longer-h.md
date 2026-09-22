---
created: 2026-09-19T14:08:23.213Z
title: Rail overlays the map without reflow, tap-to-dismiss, longer hold
area: ui
resolves_phase: 57
files:
  - mazeworld.html:276 (#screen-maze flex column) / :317-334 (.mazebox, .mw-maze-viewport flex:1)
  - mazeworld.html:686-705 (.mw-rail CSS — flex:none; min-height:132px; [hidden] display:none)
  - mazeworld.html:1621-1631 (#mw-rail markup — a flex-column SIBLING after .mazebox, not an overlay)
  - mazeworld.html:6489-6686 (renderRail(): railEl.hidden toggle L6638, railTimer / rail.card.hold L6678-6684)
  - mazeworld.html:5443 (railLocked() — a pending decision card locks movement)
  - src/browser/rail.js:49-58 (RAIL_HOLD durations: default 4200, dull 2400/2200, mark 3400, day 3000, floor 5000, camp 5200, level 6000)
  - src/browser/controls.js (keepInViewAxis — the nudge that reads the viewport size the rail currently changes)
---

## Problem

User feedback (2026-09-19, on-device): three rail behaviours are wrong.

1. **The rail moves the map.** `#mw-rail` is a `flex:none` sibling of `.mazebox` inside the `#screen-maze` flex column, and it is hidden with `[hidden]{display:none}`. Every show/hide therefore changes the height of `.mw-maze-viewport` (`flex:1`), so the whole map jumps up ~132px when a card appears and drops back when it clears. The user wants the rail to **slide up OVER the map** and never resize or re-position the viewport (the Phase 35 / 260918-vm3 "stationary camera" ruling extends to the rail: nothing but a drag, the keep-in-view nudge, CENTRE, stairs, teleport or a new run may shift the map).
2. **No tap-to-dismiss.** There is no tap handler on the rail element. A card with no decision (no `buttons`, `railLocked()` false) should dismiss on tap; a decision card (buttons present / rail locked) must NOT dismiss on a body tap — the buttons are the only way out (ruling 3, `railLocked()`), and `tapStep()` already re-pulses it (L6865).
3. **Cards vanish too fast.** `RAIL_HOLD` (default 4200 ms, dull 2400) is too short to read a multi-line card on the phone. Same complaint the user made about toasts in Phase 25.1 ("toasts must linger — about 2×, tap to dismiss", 2026-09-15 ruling); the rail inherited the old numbers when it replaced toasts in Phase 35.

## Solution

- **Overlay, not reflow:** position the rail absolutely at the bottom of `.mazebox` (or `#screen-maze`) — `position:absolute; left:0; right:0; bottom:0` with a `transform: translateY(100%)` → `translateY(0)` transition on show and the reverse on hide (keep an `[hidden]`/`data-idle` state for a11y, but drive visibility with the transform + `visibility`, not `display:none`, so the slide can animate). The viewport keeps its size; `mw-map-chips` (bottom chips) may need to lift above the rail while it is shown, or the rail sits above them — decide on device. Verify `keepInViewAxis`/`mzKeepPartyInView` no longer fire on rail show/hide and that `fit()` is not called from `renderRail()`.
- **Tap-to-dismiss:** `guardTap(railEl, …)` in the shell: if `railLocked()` or the card has buttons → `railPulse()` (no dismiss); otherwise `clearTimeout(railTimer)`, `window.__mzRail = vm.clear(window.__mzRail)`, `renderRail()`. Make sure a tap on a rail BUTTON still routes to the button (event target check) and that the tap does not also fall through to `tapStep()` on the map.
- **Longer hold:** roughly double `RAIL_HOLD` (default ~8000, dull ~4500, mark ~6500, day ~6000, floor ~8000, camp ~8000, level ~9000) — or scale by line count (base + per-line) since the complaint is "all the text"; tap-to-dismiss makes the longer hold cheap. `WORN_RECONCILE_HOLD` follows the same rule. Update `test/unit/rail.test.js` / any `shell-map-rail.test.js` pins on the numbers.
- Sequencing: this touches `mazeworld.html`'s rail block — land it as a quick task **after Phase 47 (Shell Modularisation)** or as its own quick task between phases, never mid-wave (executors are editing the shell). Device check rides in the milestone-close Pixel 7 batch.

## Resolved

Resolved by Phase 57 plans 02 (the overlay/transform structure) and 03 (tap-to-dismiss + the doubled/line-scaled hold table).
