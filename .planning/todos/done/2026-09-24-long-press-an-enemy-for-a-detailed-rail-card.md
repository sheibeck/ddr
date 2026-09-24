---
created: 2026-09-24T10:00:00.000Z
title: Long-press an enemy to raise a rail card with detailed enemy information
area: ui
files:
  - mazeworld.html (combat / encounter foe cards in renderEncounter; the rail — window.mzRailLine / renderRail)
  - content/bestiary.js (foe definitions: stats, family, abilities, flavour)
  - src/browser/ (combat view module, if split out; the rail card model)
---

## Problem

From the user's Pixel 7 session on 2.0.0 (2026-09-24): "long pressing an enemy should pop up a rail with detailed enemy information."

Today a foe card shows only the essentials. There is no way to inspect an enemy in depth mid-fight.

## Solution

TBD. Hints:
- **Gesture:** a long press, about 450–500 ms, on a foe card in combat (and on any other encounter screen that shows a foe) raises one rail card for that foe. A short tap keeps its current meaning, such as targeting, so the long press must never also fire it. Give light haptic feedback on trigger (`@capacitor/haptics` is already in the stack). Cancel the press on scroll or finger move. Don't show the WebView text-selection or context menu: set `user-select: none` and suppress `contextmenu` on foe cards.
- **Content** (from `content/bestiary.js` and the live foe state):
  - name and family (beast / human / undead / demon)
  - current and maximum HP (HP, never WP)
  - defence / armour and attack, with the damage range
  - special abilities and resistances, and the active status effects on this foe (e.g. `foeEffect`, the timers)
  - one line of flavour in the house deadpan voice
  - Only show what the player could plausibly know. If the rules hide something, such as unidentified resistances, leave it out rather than invent it.
- **Rail rules** (the UI rulings from the v1.4 device round): the rail is the one feedback surface, shown only with a card. It's a no-decision card, so a body tap dismisses it. Use a normal RAIL_HOLD, or hold the card until tapped while in combat. Never over the title or roller. A new long press replaces the card.
- **Accessibility:** foe cards also get an accessible action ("Details") for TalkBack users, who can't long-press reliably.
- Presentation only, engine untouched. Pure view model plus tests: the model for each bestiary family, plus a malformed or unknown foe. Add any new copy to the voice safety and HP-not-WP scans.
- **Device checks:** long-press each foe in a multi-foe fight; a short tap still targets; no text-selection popup; the card sits clear of the action buttons at text size L.
- Pairs naturally with the combat round-summary / input-lock todo (2026-09-24), since both touch the combat screen.
