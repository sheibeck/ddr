---
created: 2026-09-21T20:41:00.000Z
title: Status chit tap in combat shows nothing (rail hidden in combat)
area: ui
files:
  - mazeworld.html:3740 (railEl.hidden = !!(S.combat || S.dead) || idle — the rail is suppressed for the whole fight)
  - src/browser/rail.js:7 (two destinations by design — rail out of combat, fight log in combat)
  - mazeworld.html:516 (per-enemy status-effect chips on the foe cards)
  - mazeworld.html:914 (.fchip status-chip vocabulary shared by the HUD)
---

## Problem

Reported on the Pixel 7 (2026-09-21, build `dbcdd66`), user's words: "when I'm in combat and I tap on a status chit the rail does not show up, so I have no way to see my status effect descriptions in combat."

Out of combat a status chit tap raises a rail card with the effect's description. In combat the rail is hidden unconditionally (`railEl.hidden` while `S.combat`) because combat narration goes to the fight log instead — so the chit tap has no surface at all, and the player cannot read what afraid / asleep / acid / blind / frozen / poison etc. are doing to them (or to a foe) exactly when it matters.

## Solution

Give the status description a combat-legal surface without reviving the full rail in combat (the v1.4 ruling: rail is the one feedback surface, shown only with a card — but combat's card is the fight log). Options for discuss: (a) let a chit tap in combat open the same description card as a transient overlay above the action area (tap-to-dismiss, never a decision card — mirrors the toast-vs-card split), or (b) route the description into the fight log as a one-line entry with the chit's text. (a) keeps the description readable at a glance; prefer it. Also cover the FOE cards' status chips (mazeworld.html:516) with the same tap. Quick task between phases, never mid-wave (executors edit `mazeworld.html`). Pixel 7 check: get Afraid or Poisoned in a fight, tap the chit, read the description; tap a foe's Asleep chip, same.
