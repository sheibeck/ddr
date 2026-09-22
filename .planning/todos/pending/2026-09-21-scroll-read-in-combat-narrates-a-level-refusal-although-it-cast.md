---
created: 2026-09-21T20:58:00.000Z
title: Scroll read in combat narrates a level refusal although it cast
area: ui
files:
  - engine/magic.js:636-654 (readScroll — scrollTooAdvanced is pushed when the spell can't be SCRIBED, then the free cast proceeds)
  - src/browser/narrationLines.js:1473 (scrollTooAdvanced line: "X needs level N; you are M." — reads as a refusal)
  - src/browser/eventNarration.js:783 (same line for the Oracle)
  - src/browser/combatMenu.js:47-48 (SCROLL row copy)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "I used a scroll in combat and I got a message saying it was a level 3 spell so I couldn't use it, but it actually successfully used the scroll. Scrolls that cast when read should not need a level check."

The engine already agrees: `readScroll` casts the rolled spell with `c.scrollCast = true` (no level/school gate, no charge), and only the copy-to-grimoire step is level-gated (Phase 40's scribing fix). But the event that step emits — `scrollTooAdvanced` — is narrated as "needs level 3; you are 1", i.e. a refusal, immediately before the `scrollCast` narration. The player reads "couldn't use it" and then watches it work.

## Solution

Narration fix, no rules change: reword `scrollTooAdvanced` in both narration tables so it says what happened — the spell was cast from the scroll and NOT copied into the book ("Fireball, read aloud and gone. Too advanced to copy — your book takes it at level 3."), tone neutral, not `miss`. Fold it into the `scrollCast` line when both fire in one read (one card/toast, not two). Keep the event type (coverage guard) and the engine untouched. Pixel 7 check: read a scroll below the needed level in combat — one line, says it cast, mentions the copy limit without sounding like a refusal.
