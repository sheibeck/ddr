---
created: 2026-09-23T18:48:12.581Z
title: Narrative pass — clean up every in-game line so it says clearly what happened
area: content
files:
  - src/browser/narrationLines.js — the Oracle/rail line bank (~1.7k lines)
  - src/browser/eventNarration.js — EVENT_NARRATION event → line mapping (~1.1k lines)
  - content/flavor.js, content/epitaphs.js — flavor text and death epitaphs
  - content/*.js — item, spell, ability, trap, foe and class descriptions (spells, abilities, potions, weapons, armors, bestiary, traps, afflictions, classes, races, skills)
  - src/browser/ — panel copy (combat/fight log, gear sheet reasons, rail cards, store/loot upgrade lines, HUD chips)
---

## Problem

User, 2026-09-23: "We want to do a cleanup pass of all of the in game narrative. We want to make sure it's clear about what's it's describing. Clean up stilted language, clarify vague comments, etc. Narrative pass."

The in-game text built up over many milestones (Oracle log, rail cards, combat fight log, refusal reasons, item/spell descriptions, epitaphs). Some lines are stilted, and some are too vague for the player to tell what happened to whom or why (which foe, what effect, what number changed). The sarcastic voice is core identity (PROJECT.md), but a joke that hides the fact reads as a bug.

Related todos that are line-level instances of the same problem. Fold them into the pass or close them first:
- `2026-09-21-oracle-combat-lines-must-read-in-event-order.md`
- `2026-09-21-scroll-read-in-combat-narrates-a-level-refusal-although-it-cast.md`
- `2026-09-23-ailment-roll-5-6-narrates-disease-but-gives-a-phobia.md`
- `2026-09-23-narrate-a-destroyed-armor-piece-when-new-armor-replaces-it.md`
- `2026-09-21-sub-class-descriptions-must-state-every-advantage-and-disadvantage.md`

## Solution

TBD. Likely a milestone or backlog phase of its own, not a quick task. Approach hints:
- **Inventory first:** dump every player-facing string (line banks, EVENT_NARRATION templates, content descriptions, panel copy) into a reviewable table grouped by surface, with the event or trigger each one describes.
- **Rubric for every line:**
  1. States what happened, to whom and with what result (numbers where the player needs them).
  2. Reads naturally aloud, with no stilted or translated-sounding phrasing.
  3. Keeps the deadpan, family-friendly sarcasm, with the joke after the fact and never instead of it.
  4. Is accurate to what the engine actually did, so the narration never contradicts the event.
- **Review loop:** the user reviews batches by surface. It's a voice call, so the user rules on tone and Claude drafts.
- **Guardrails:** narration lives in the shell/content, so the Engine Gate is untouched and no fixtures move. Keep `content/safety-wordlist.js` checks green, re-pin any tests that assert exact strings, and keep the "HP not WP" and "Dungeon / Game Master" naming rulings.
- **Timing:** after v2.0 Leaderboards, or folded into a later content milestone. v2.0 adds its own new lines (board rule lines, footnotes, the "you placed X" bank), which should follow the same rubric when written.
