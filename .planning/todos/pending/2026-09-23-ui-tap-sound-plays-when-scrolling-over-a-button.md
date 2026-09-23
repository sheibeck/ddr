---
created: 2026-09-23T18:05:00.000Z
title: UI tap sound plays when scrolling over a button
area: ui
files:
  - mazeworld.html:5836-5850
  - src/browser/sfx.js:557-570
---

## Problem

User, on device (2026-09-23): "When I scroll a screen up or down and there is a button under my finger, I hear the UI click sound. Can we make it so that click sound only happens if I'm truly clicking, and not just scrolling?"

Cause: the shell plays the click from a capture-phase **`pointerdown`** listener on `document` (`mazeworld.html:5842-5849`): `if (e.target?.closest?.("button, [role=\"button\"]")) playUiTap();`. A pointerdown fires the moment the finger lands, before the browser knows whether the gesture is a tap or the start of a scroll or pan. Starting a scroll on any button (gear rows, board rows, Oracle, Hero tab, sheets) therefore clicks.

## Solution

Keep `unlockSfx()` on `pointerdown`, because the audio unlock needs the earliest user gesture. Move `playUiTap()` to fire only on a real activation:
- **Preferred:** a capture-phase `click` listener on `document` that plays the tap when `e.target.closest("button, [role=button]")` matches and the button isn't `disabled`. The browser doesn't fire `click` after a scroll (pointercancel), so scrolling goes silent for free.
- Alternative: track the pointerdown position and play on `pointerup` only if the pointer moved less than about 8–10 px and no `pointercancel` fired.

Things to check:
- **Latency.** `click` fires on release. That's fine for a UI tick and matches native Android button feedback.
- **Keyboard and TalkBack activation.** Both fire `click` too, so they gain the sound. That's acceptable and consistent.
- **The 250 ms `inputGuards.js` arm/settle guards.** A guarded (ignored) tap should ideally stay silent. Decide whether the sound follows the guard or the raw click.
- **Doubled sounds.** Buttons that dispatch an action with its own clip (Fight!, GO DOWN, camp) must not get a second sound. Today's rule is "the map canvas never matches, a move plays its own walk clip". Keep the equivalent rule.
- **Test.** Add a source or DOM test that pins the listener to `click`, or that a pointerdown followed by pointercancel plays nothing.

A shell-only quick task: no engine, content or parity impact.
