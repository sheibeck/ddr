---
created: 2026-09-21T21:05:00.000Z
title: Foe type listed after the name on the combat screen
area: ui
files:
  - mazeworld.html:2956-2995 (renderFoeCards — `.cb-foe-name` shows only `c.name`)
  - mazeworld.html:3539 (renderFoeCards call — foes view-model built in src/browser/combatPanel.js)
  - src/browser/combatPanel.js (foes(state, …) view-model — the card fields)
  - engine/combat.js:255-262 (the spawned foe record carries `type` — the BESTIARY family key: Beasts / Demons / Humans / Lair Beasts / Magical / Walking Dead)
  - content/bestiary.js:40-147 (the six family keys)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "enemy type should be listed after their name on the combat screen."

Each foe card shows the name (and status chips) but not its bestiary family, even though the engine's foe record already carries it (`type`, the BESTIARY key). The family matters to the player: it drives resistances/turn-undead/parley language and — after the Transitions & Sounds backlog item — the `enemy-{batrat,beast,demon,human,undead}` cues; today it's only inferable from the name.

## Solution

Add `type` (family) to the combat view-model's card fields and render it after the name in `renderFoeCards` — e.g. "Gremlin · Demon" in the `.cb-foe-name` line (singular, family-cased: Beasts → Beast, Walking Dead → Undead? keep the bestiary's own wording unless the voice pass says otherwise), muted mono style so the name stays primary; hold-inspect / the encounter card can show the same. Pure shell change (view-model + renderer), unit-test the view-model field. UI quick task between phases, never mid-wave. Pixel 7 check: every foe card shows "Name · Family".
