---
created: 2026-09-23T10:00:00.000Z
title: Text-size setting misses every --mw-font-* token
area: ui
files:
  - mazeworld.html:124-140 (:root declares --mw-text-scale:1 and every --mw-font-* token as calc(<rem> * var(--mw-text-scale)))
  - mazeworld.html:5540 (appEl.style.setProperty("--mw-text-scale", …) — the S/M/L setting is written on #app, not :root)
  - src/browser/settings.js:120-140 (effectiveTextScale / TEXT_SCALE_BY_SIZE S 0.85 · M 1.0 · L 1.25)
---

## Problem

The Phase 62 planner found this, and the orchestrator confirmed it by reading the code (2026-09-23). The `--mw-font-*` tokens are declared on `:root` as `calc(<rem> * var(--mw-text-scale))`. A custom property that contains `var()` is substituted where it is declared, so descendants inherit the already-resolved value, computed with `:root`'s `--mw-text-scale:1`. The Settings S/M/L choice sets `--mw-text-scale` on `#app` (mazeworld.html:5540), so every rule that sizes text through a `--mw-font-*` token (HUD tags, tab labels, section headers, body and data text) ignores the setting. Only rules that multiply by `var(--mw-text-scale)` directly scale. That would explain why earlier device rounds saw only partial effects at L.

## Solution

Pick one approach:
- (a) Write the scale on `document.documentElement` (`:root`) instead of `#app`, so the tokens recompute. This is one line, but check that nothing else relies on it being scoped to `#app`.
- (b) Redeclare the `--mw-font-*` tokens on `#app` so they resolve against `#app`'s scale.

Add a test that loads the shell, sets L, and asserts that a token-sized element's computed font size grows. Phase 62's new Gear CSS already sidesteps the problem by writing `calc(<rem> * var(--mw-text-scale))` per rule; after the fix it could use the tokens. Pixel 7 check: switch S → M → L and confirm the HUD labels, tab bar and panel headers all change size. It is a UI quick task between phases, never mid-wave, because it edits `mazeworld.html`.
