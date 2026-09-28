---
created: 2026-09-27T23:55:00.000Z
title: Feint usable only once per combat
area: rules
files:
  - content/abilities.js:54 (feint: cd 3, an auto-hit strike that adds your level in damage)
  - content/skills.js:50 (the Feint skill text)
  - engine/abilities.js:~140-180 (useAbility: the cooldown refusal; the feint case sets an autoHit + level-damage strike)
  - engine/combat.js:~2059 (a Joiner's feint through memberStrike)
  - engine/character.js:179 (a Thief's Kata converts to Feint)
---

## Problem

User (2026-09-27): "the feint skill should only be usable once per combat."

Today Feint is a Thief ability with a 3-round cooldown (`cd: 3`). Each use is a strike that can't miss and adds the Thief's level in damage, so a long fight can use it several times.

## Solution

- Make Feint once per fight: after one use it's spent until the fight ends (a per-fight flag cleared when the encounter ends, not a cooldown). This applies to the hero and to a Thief Joiner (memberStrike).
- **Refusal:** the ability row greys out with a reason that says why, in voice (e.g. "Feint is spent for this fight"), through the existing abilityRefused path with a new reason. It needs Oracle and rail narration, and the combat-menu row must say it's once per fight (79-07's chip and menu copy rules).
- **Text:** update the Feint skill and ability text (content/skills.js, content/abilities.js) to say "once per fight"; the voice guards and the review page apply.
- **Ask the user:** Kata (the non-Thief twin, same strike) keeps its cooldown unless they say otherwise. Should other strike abilities (Silent Step, Death Touch, Overhead Blow) follow the same rule?
- Save/load: a fight saved mid-combat keeps the spent flag (Phase 76 keeps live combat through a relaunch).
- It moves balance slightly for Thieves: measure the parity fixtures, re-pin with traced causes, and re-measure the class matrix.

## User rulings (2026-09-27)
- **Now, before this release.** The user re-captured it: "feint ability should only be usable once per fight."
- **Scope widened:** "Skills that can essentially one shot should be once per combat." That covers Feint and every strike ability that can plausibly kill a foe in one use. Candidates: Kata (Feint's twin), Death Touch (forced crit plus a finisher under 15), Silent Step (auto-hit plus a forced crit), Overhead Blow (double damage) and Last Stand (three attacks). Pommel Strike (a stun) is not a one-shot.
