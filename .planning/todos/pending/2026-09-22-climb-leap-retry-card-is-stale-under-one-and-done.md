---
created: 2026-09-22T12:10:00.000Z
title: CLIMB IT retry card is stale under one-and-done — decide pre-roll prompt vs tool-only card
area: ui
resolves_phase: 78
files:
  - mazeworld.html:3673-3695 (the rail "climb" pending card — CLIMB IT / LEAP IT retry label + USE LADDER / USE ROPE when the tool is carried)
  - mazeworld.html:4999-5015 (the pending flag: set on fellClimbing / fellInGorge, presentation-only in window.__mzRail)
  - engine/movement.js:129, 238, 558-565 (opts.tool "ladder"|"rope" — the free crossing; the refusal ladder before any mutation)
  - .planning/phases/54-four-band-retune-and-roster-decision/54-05-SUMMARY.md (ONE-AND-DONE climbs/leaps: a failed roll now crosses you anyway, hurt — `draggedOver`)
  - src/browser/mapMarks.js:91-96 (CREVICE / wall mark copy — "Climb it, or fall…" also reads pre-one-and-done)
---

## Problem

Reported on the Pixel 7 (2026-09-22, post-Phase-54 build), user's words: "I entered a wall space and it made the roll for me as I entered, but still left a button that showed: Climb It! We need to change the label on the button, or remove the button altogether now that we only attempt walls and crevices one time. Just remember to not get rid of the check if we have a rope/ladder, we still want the option to use those. I'm actually wondering if we should go back to the option to climb/leap and still let someone change their mind and not enter that space before deciding. Then they can always 'Turn Back' and try a different direction."

Phase 54 (54-05, USER RULING D) made climbs and leaps ONE-AND-DONE: a failed roll still crosses you to the far side, hurt (`draggedOver`). The shell's rail card is still the Phase 35 retry card — it offers CLIMB IT / LEAP IT to re-attempt a square you are no longer standing on, which is now meaningless. The tool branch (USE LADDER / USE ROPE, a free crossing via `move(..., { tool })`) is still legitimate and must survive whatever is done to the label. `mapMarks.js`'s CREVICE/wall descriptions also still describe the old "climb it, or fall" rule.

## Solution

Two options; the user leans toward the second and it needs a ruling before work starts:

**A. Minimal — retire the retry, keep the tool.** Drop the CLIMB IT / LEAP IT button from the pending card (the roll already happened and you already crossed); keep USE LADDER / USE ROPE when the tool is carried, re-labelled for a post-crossing context, or drop the card entirely when no tool is carried. Refresh the `mapMarks` copy to describe one-and-done. Shell-only; no engine change.

**B. Pre-roll decision (the user's preference, a rules-adjacent change).** Entering a wall/crevice square PROMPTS first — "CLIMB IT / USE LADDER / TURN BACK" — and the roll happens only on commit, so the player can back out and take another direction. This restores agency the one-and-done change removed and makes the tool choice a real decision rather than a consolation. It needs: a pre-move gate in the shell (the engine's `move` already refuses cleanly before any mutation — `engine/movement.js:558-565` — so a preview/confirm can sit in front of it without touching rules), a decision card (never auto-dismissing, per the card-vs-toast split), and a check that no rng is drawn until commit (a pre-roll peek would move fixtures — do NOT roll to preview).

Decide A vs B in discuss. If B: declare whether "turn back" costs a step/time (it should cost nothing but the tap — the step never happened) and confirm no fixture moves. UI (or UI + a thin engine gate) quick task between phases, never mid-wave. Pixel 7 check: walk into a wall with and without a ladder; no stale retry button, the tool option still works, and (under B) TURN BACK leaves you where you were with no roll made.
