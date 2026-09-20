---
created: 2026-09-20T10:05:00.000Z
title: Enemy attack cadence, initiative in the Oracle, and a smooth damage curve
area: engine
files:
  - engine/combat.js:2311 (foeTurn — `swings = (f.frenzied ? 2 : 1) * (sp.atk || 1)`: a 2-attack foe swings 2, frenzied 4)
  - engine/combat.js:154-175 (rollInitiative — re-rolled EVERY round at L1339-1342; foe that acted last in round N and wins round N+1 acts twice in a row)
  - engine/combat.js:2179 (foeTurn — where a foe's special ability fires relative to its ordinary swings in the same turn)
  - engine/combat.js:633-639 (player crit range — weaponCrit; foe-side crit/"strikes as" multiplier lives near the foe hit resolution)
  - content/bestiary.js:65 (Stalka Beast — sz XL, wp 94, `sp: { atk: 2, dmg: 1d4 }` + a frost ability kit in content/foe-abilities.js)
  - content/bestiary.js:97 (China Wolf — `sp: { atk: 2, dmg: 1d6 }`, "hunts in pairs, two attacks")
  - content/bestiary.js:109-111 (Herman — invisible, ar 15, `dmg: { bonus: 25 }` flat, "strikes as a level five" — 80 seen on floor 5, i.e. a crit/level multiplier on a flat 25)
  - content/foe-abilities.js (the frost / "it lands. −5 hp" ability that fired in the same turn as two ordinary hits)
  - content/damage-multipliers.js, docs/DIFFICULTY-RETUNE.md, docs/BESTIARY-REBALANCE.md (the curves this touches)
  - .planning/todos/pending/2026-09-19-initiative-rolled-once-per-combat-not-every-round.md (the initiative half of this — same fix)
---

## Problem

Device round 2026-09-20 (level 5, several classes). The user's words, with the log they pasted:

> Enemies should not be able to use a special ability AND take all their attack stacks in the same turn. Sample (You have died.): `5 vs 5. Stalka Beast hits you for 28 hp.` / `4 vs 5. Stalka Beast hits you for 29 hp.` / `Stalka Beast: it lands. −5 hp.` / `You try to shrug it off. 15 vs intel 15. You do not.` / `The Stalka Beast flicks a lazy frost at you, almost politely.`
>
> Plus, I'm getting outright murdered at level 5 with every class — the enemies win initiative. Fought Bat/Rat and it was getting 2 to 4 attacks per my 1 attack against my Magic User. Same with China Wolf, 2 to 4 attacks per my 1. Is this the initiative rolls? They get 2 attacks, win initiative, and then get another round of attacks? We should put initiative rolls into the Oracle so we can see. Floor 5 a Herman crit me for 80 damage — killed me outright. Let's make sure our damage curve is indeed a smooth curve.

What the code says today (measured, not guessed):
- `sp.atk: 2` foes (Stalka Beast, China Wolf, Poltergeist, …) swing twice per foe turn; frenzied doubles that (`combat.js:2311`). A foe ability (frost etc.) fires in the SAME foe turn on top of the swings — the pasted log is exactly two hits + one ability + a resist check in one turn.
- Initiative is re-rolled every round (`combat.js:1341`, canon p.24). A foe that acted last in round N and wins round N+1 acts twice back to back → 4 swings between two player actions for an `atk: 2` foe, 8 if frenzied. This is the "2 to 4 attacks per my 1" the user saw. Nothing in the Oracle shows the initiative result, so the player cannot tell.
- Herman: flat 25 damage ("strikes as a level five"); an 80 on floor 5 means a multiplier ≥ 3 landed on a flat number — the crit / level-scaling path on a fixed-damage foe is a cliff, not a curve.

## Solution

Rules changes (engine + content) — outside v1.6 (cleanup-only); a tuning pass after the milestone, folded with the initiative-once todo and 999.2 (Joiner level cap):

1. **Initiative once per combat** (the existing todo) — removes the back-to-back foe turns. Do this first; re-measure the Bat/Rat and China Wolf fights with the bot before touching attack counts.
2. **One ordinary attack per foe per round unless its `sp.atk` says otherwise, and an ability REPLACES the swings that turn, never adds to them** — user ruling: "unless they have a special ability, each enemy should only get one attack each round". Decide per kit whether a firing ability costs the swings (recommended: ability turn = no ordinary swings; `atk: 2` keeps two swings on a non-ability turn).
3. **Initiative in the Oracle** — one line per roll ("Initiative — you 14, Stalka Beast 9. You go first."), in voice; with (1) it appears once per fight.
4. **Damage-curve audit** — bot readout of max single-hit damage by depth for every foe (`tune-classes` style), flag any hit ≥ 60% of a level-N character's max HP at its depth; Herman's flat 25 × multiplier is the first case to look at (cap the multiplier on flat-damage foes, or give Herman a die). Record in `docs/DIFFICULTY-RETUNE.md`.

Engine gate: deliberate canon divergence (p.24 initiative, foe-turn cadence); measure moved fixtures first (`tools/worn-fixture-scan.mjs` style), declare each, regenerate only those, master never edited; bot readout before/after; depth-20 target unchanged.
