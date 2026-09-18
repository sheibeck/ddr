// content/spells.js
//
// Pure-data port of mazeworld.html's SPELLS table (~line 831-864). Every
// `dmg: () => D(n)` closure is converted to dice-notation ({n,sides,bonus})
// per Pattern 1. Non-damage spells (wards, status, utility) keep their
// `pool`/`rounds`/`reflect`/`txt` fields verbatim and simply have no `dmg`
// field, matching the prototype. Array order preserved for rows 0-31 (the
// prototype's actual 32-row count; content-tables.test.js locks the total
// at 33 as of Phase 40).
//
// 04-DR10: `combatOnly` classifies each spell as castable from the HERO
// tab's Grimoire OUTSIDE an encounter (false) vs. requiring an active
// encounter to have any real effect (true). Derived directly from each
// spell's `kind` and engine/magic.js#castSpell's own implementation — NOT a
// judgment call per spell name:
//   - false (non-combat/utility/self): the kind's effect branch in castSpell
//     is unconditional — it sets/reads only `c.*` fields (heal/ward/might/
//     mirror/senses/reveal/foresee/regen) or explicitly branches for a
//     no-combat caller (summon: sets `c.pendingAlly` when `state.combat` is
//     null, joined automatically by the next `startCombat()`). Casting these
//     while walking around is a real, useful action (e.g. Map the Floor
//     lights the floor; Sense Presence must be up BEFORE an encounter to
//     prevent a surprise round — engine/derived.js reads `c.senses`).
//   - true (combat-only/offensive/target-a-foe): the kind's effect branch
//     reads `state.combat`/`combat.js#liveFoes()` (empty outside combat) to
//     find a target — cast with no foe present, it is either a silent no-op
//     that burns a charge for nothing (stun/weaken/stupid/blind/shrink/acid/
//     vapor/volley/petrify/insane/turn/gate/thrown/status/dot) or actively
//     HARMS the caster for zero benefit (quake's unconditional self-damage/
//     possible death; death's unconditional 25hp cost with no foe to kill).
//
// Phase 40 (SPELL-01/03/04/05 — the "spell rework" content reshape):
//   - `niche` (every row, KEY into NICHE_LABELS below) + a `txt` that always
//     starts with `NICHE_LABELS[niche] + " · "` — the "a player can tell two
//     same-level spells solve different problems" contract
//     (test/unit/spell-table.test.js). Reading the niche key at any engine
//     call site (bot tactics, UI grouping) should read `sp.niche`, never
//     parse `sp.txt`.
//   - Four new data flags, each read by exactly one engine site: `onHit`
//     (Freeze, row 4 — engine/magic.js's thrown branch, Plan 02) — freezes
//     solid on a hit; `aoe: "all"` (Lightning, row 28 — engine/magic.js's
//     thrown branch, Plan 02) — replaces the old `sp.n === "Lightning"`
//     name-keyed special case with a data flag so a rename can never
//     silently break it; `lesser: true` (Lesser Summon, row 32 —
//     engine/magic.js's summon branch, Plan 02) — the Summoner's doubled/
//     backfire rules do not apply; `roll: "derived"` (Lesser Summon, row 32
//     — engine/character.js#rollGrimoire, this plan's Task 2) — the row
//     joins the day-one chargen pools through a DERIVED rng stream keyed on
//     the main cursor, never lengthening the main-rng shuffles (so
//     test/unit/chargen-rng-pin.test.js's pin tables stay byte-unedited).
//   - Row 5 renamed Detect Magic -> Map the Floor (SPELL-05); row 13 (Ice)
//     `kind` changed "thrown" -> "dot" (its `dmg` literal is unchanged — Plan
//     02 wires the actual per-round tick + the promised freeze-on-expiry).
//   - Row 32 (Lesser Summon, NEW): the Summoner's user-ruled (2026-09-18)
//     level-1 safe summon — "give the summoner a level 1 summon... keep
//     level 1 spells without the bad gate" (40-CONTEXT.md Area 3). Learnable
//     by every sub whose `special` school is open at gate 1 (Wizard,
//     Sorcerer, Illusionist, Summoner, Apprentice — content/mu-chart.js).
//   - ARRAY-POSITION / lvl / s INVARIANT (load-bearing, unchanged since
//     before this phase): `castSpell(state, idx)`, the magic parity
//     fixture's `spellIndex`, and `readScroll`'s `SPELLS.indexOf` all index
//     spells by ARRAY POSITION; `rollGrimoire`'s pools filter by `lvl`/`s`.
//     Rows 0-31 keep their position, `lvl`, and `s` byte-identical to the
//     pre-Phase-40 table; only `n` (row 5), `kind` (row 13), `txt` (every
//     row), and the new `niche`/flags fields changed. Row 32 is appended,
//     never inserted.

export const NICHE_LABELS = Object.freeze({
  burst: "burst",
  dot: "damage over time",
  multi: "multi-target",
  control: "control",
  defensive: "defensive",
  chaos: "chaos",
  buff: "buff",
  healing: "healing",
  answer: "answer",
  sight: "sight",
  summon: "summon",
});

export const SPELLS = [
  { n: "Heal", lvl: 1, s: "healing", kind: "heal", dmg: { n: 1, sides: 10, bonus: 0 }, niche: "healing", txt: "healing · you · d10 hp", combatOnly: false },
  { n: "Shield", lvl: 1, s: "protection", kind: "ward", pool: 50, rounds: 5, niche: "defensive", txt: "defensive · you · soaks 50 hp for 5 rounds", combatOnly: false },
  { n: "Strength", lvl: 1, s: "offense", kind: "might", dmg: { n: 1, sides: 10, bonus: 0 }, niche: "buff", txt: "buff · you · +d10 damage till tomorrow", combatOnly: false },
  { n: "Doze", lvl: 1, s: "offense", kind: "status", niche: "control", txt: "control · one foe · asleep d4 rounds", combatOnly: true },
  { n: "Freeze", lvl: 1, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, onHit: "freeze", niche: "burst", txt: "burst · one foe · d6, and frozen solid on a hit", combatOnly: true },
  // Phase 40 (SPELL-05, Plan 04): `squares` is the reveal window the engine
  // reads (engine/magic.js's reveal branch -> a c.timers["spell:reveal"]
  // record) — the once-a-day rule caps it at <=100; the txt above already
  // states the same number in voice.
  { n: "Map the Floor", lvl: 1, s: "divination", kind: "reveal", squares: 40, niche: "sight", txt: "sight · the whole floor · mapped for 40 squares, then the map forgets what it was told", combatOnly: false },
  { n: "Mirror Self", lvl: 1, s: "illusion", kind: "mirror", niche: "defensive", txt: "defensive · you · foes need a 1 to hit, d6 rounds", combatOnly: false },
  { n: "Stun", lvl: 1, s: "offense", kind: "stun", niche: "control", txt: "control · up to d6 foes · asleep d4 rounds", combatOnly: true },
  { n: "Weaken", lvl: 1, s: "offense", kind: "weaken", niche: "control", txt: "control · every foe · they hit on a 3 and do half, d4+1 rounds", combatOnly: true },
  { n: "Acid", lvl: 2, s: "offense", kind: "acid", dmg: { n: 2, sides: 6, bonus: 2 }, niche: "dot", txt: "damage over time · one foe · 2d6+2 a round, d6 rounds", combatOnly: true },
  { n: "Stupidity", lvl: 2, s: "offense", kind: "stupid", niche: "control", txt: "control · one foe · does nothing at all for the rest of the fight", combatOnly: true },
  { n: "Blind", lvl: 3, s: "offense", kind: "blind", niche: "control", txt: "control · one foe · blind for life, which in here means the fight", combatOnly: true },
  { n: "Shrink", lvl: 3, s: "offense", kind: "shrink", niche: "control", txt: "control · up to d6 foes · half hp and half damage, the fight", combatOnly: true },
  { n: "Ice", lvl: 3, s: "offense", kind: "dot", dmg: { n: 1, sides: 6, bonus: 0 }, niche: "dot", txt: "damage over time · one foe · d6 a round for d4+1 rounds, then frozen solid", combatOnly: true },
  { n: "Earthquake", lvl: 4, s: "offense", kind: "quake", dmg: { n: 3, sides: 10, bonus: 8 }, niche: "multi", txt: "multi-target · every foe and you · 3d10+8, half to you unless warded", combatOnly: true },
  { n: "Noxious Vapor", lvl: 4, s: "offense", kind: "vapor", niche: "chaos", txt: "chaos · every foe · a d6 of very bad outcomes", combatOnly: true },
  { n: "Fireballs", lvl: 4, s: "offense", kind: "volley", dmg: { n: 1, sides: 10, bonus: 2 }, niche: "multi", txt: "multi-target · d8 bolts · d10+2 each, spread across the foes", combatOnly: true },
  { n: "Petrify", lvl: 5, s: "offense", kind: "petrify", niche: "control", txt: "control · one foe · stone for five days; no spoils", combatOnly: true },
  { n: "Insane", lvl: 2, s: "offense", kind: "insane", niche: "chaos", txt: "chaos · one foe · rolls on the madness table", combatOnly: true },
  { n: "Summon", lvl: 2, s: "special", kind: "summon", niche: "summon", txt: "summon · one ally · fights beside you d4+2 rounds", combatOnly: false },
  { n: "Fireball", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 2, sides: 10, bonus: 4 }, niche: "burst", txt: "burst · one foe · 2d10+4", combatOnly: true },
  { n: "Major Heal", lvl: 3, s: "healing", kind: "heal", dmg: { n: 3, sides: 10, bonus: 0 }, niche: "healing", txt: "healing · you · 3d10 hp", combatOnly: false },
  { n: "Bubble", lvl: 3, s: "protection", kind: "ward", pool: 100, rounds: 12, reflect: true, niche: "defensive", txt: "defensive · you · soaks 100 hp and reflects, 12 rounds", combatOnly: false },
  { n: "Sense Danger", lvl: 3, s: "divination", kind: "foresee", niche: "sight", txt: "sight · the next encounter · names it before you meet it, and you act first", combatOnly: false },
  { n: "Turn Walking Dead", lvl: 2, s: "protection", kind: "turn", niche: "answer", txt: "answer · every Walking Dead of your level or lower · sent back", combatOnly: true },
  { n: "Plane Gate", lvl: 3, s: "protection", kind: "gate", niche: "answer", txt: "answer · d6 Demons or Walking Dead · vanquished to The Planes", combatOnly: true },
  { n: "Sense Presence", lvl: 2, s: "protection", kind: "senses", niche: "sight", txt: "sight · you · fight in the dark at full skill and nothing gets the jump on you, till your next fight ends", combatOnly: false },
  { n: "Phantom Host", lvl: 3, s: "illusion", kind: "summon", niche: "summon", txt: "summon · one ally · a host that isn't there, d4+2 rounds", combatOnly: false },
  { n: "Lightning", lvl: 4, s: "offense", kind: "thrown", dmg: { n: 1, sides: 10, bonus: 6 }, aoe: "all", niche: "multi", txt: "multi-target · every foe · d10+6 each", combatOnly: true },
  { n: "Regeneration", lvl: 4, s: "healing", kind: "regen", niche: "healing", txt: "healing · you · d8 hp a round, this fight", combatOnly: false },
  { n: "Mangle", lvl: 5, s: "offense", kind: "thrown", dmg: { n: 2, sides: 20, bonus: 15 }, niche: "burst", txt: "burst · one foe · 2d20+15", combatOnly: true },
  { n: "Death", lvl: 5, s: "offense", kind: "death", niche: "burst", txt: "burst · one foe · dies outright; costs you 25 hp", combatOnly: true },
  { n: "Lesser Summon", lvl: 1, s: "special", kind: "summon", lesser: true, roll: "derived", niche: "summon", txt: "summon · one small ally · a level under yours, d4 rounds, never backfires", combatOnly: false },
];
