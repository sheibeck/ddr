// content/spells.js
//
// Pure-data port of mazeworld.html's SPELLS table (~line 831-864). Every
// `dmg: () => D(n)` closure is converted to dice-notation ({n,sides,bonus})
// per Pattern 1. Non-damage spells (wards, status, utility) keep their
// `pool`/`rounds`/`reflect`/`txt` fields verbatim and simply have no `dmg`
// field, matching the prototype. Array order preserved (32 entries — the
// prototype's actual count; content-tables.test.js locks this number).
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
//     while walking around is a real, useful action (e.g. Detect Magic
//     lights the floor; Sense Presence must be up BEFORE an encounter to
//     prevent a surprise round — engine/derived.js reads `c.senses`).
//   - true (combat-only/offensive/target-a-foe): the kind's effect branch
//     reads `state.combat`/`combat.js#liveFoes()` (empty outside combat) to
//     find a target — cast with no foe present, it is either a silent no-op
//     that burns a charge for nothing (stun/weaken/stupid/blind/shrink/acid/
//     vapor/volley/petrify/insane/turn/gate/thrown/status) or actively HARMS
//     the caster for zero benefit (quake's unconditional self-damage/possible
//     death; death's unconditional 25wp cost with no foe to kill).
export const SPELLS = [
  { n: "Heal", lvl: 1, s: "healing", kind: "heal", dmg: { n: 1, sides: 10, bonus: 0 }, txt: "d10 wp", combatOnly: false },
  { n: "Shield", lvl: 1, s: "protection", kind: "ward", pool: 50, rounds: 5, txt: "soaks 50 wp, 5 rounds", combatOnly: false },
  { n: "Strength", lvl: 1, s: "offense", kind: "might", dmg: { n: 1, sides: 10, bonus: 0 }, txt: "+d10 damage till tomorrow", combatOnly: false },
  { n: "Doze", lvl: 1, s: "offense", kind: "status", txt: "sleep d4 rounds", combatOnly: true },
  { n: "Freeze", lvl: 1, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, txt: "d6, thrown", combatOnly: true },
  { n: "Detect Magic", lvl: 1, s: "divination", kind: "reveal", txt: "the floor lays itself out", combatOnly: false },
  { n: "Mirror Self", lvl: 1, s: "illusion", kind: "mirror", txt: "foes need a 1 for d6 rounds", combatOnly: false },
  { n: "Stun", lvl: 1, s: "offense", kind: "stun", txt: "d6 creatures stunned d4 rounds", combatOnly: true },
  { n: "Weaken", lvl: 1, s: "offense", kind: "weaken", txt: "they hit on a 3 and do half", combatOnly: true },
  { n: "Acid", lvl: 2, s: "offense", kind: "acid", dmg: { n: 2, sides: 6, bonus: 2 }, txt: "2d6+2 a round for d6 rounds", combatOnly: true },
  { n: "Stupidity", lvl: 2, s: "offense", kind: "stupid", txt: "intelligence to 1; it can do nothing", combatOnly: true },
  { n: "Blind", lvl: 3, s: "offense", kind: "blind", txt: "blind for life, thrown", combatOnly: true },
  { n: "Shrink", lvl: 3, s: "offense", kind: "shrink", txt: "two sizes down, half wp and damage", combatOnly: true },
  { n: "Ice", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, txt: "d6 a round, then frozen", combatOnly: true },
  { n: "Earthquake", lvl: 4, s: "offense", kind: "quake", dmg: { n: 3, sides: 10, bonus: 8 }, txt: "3d10+8 to everything, you included", combatOnly: true },
  { n: "Noxious Vapor", lvl: 4, s: "offense", kind: "vapor", txt: "a d6 of very bad outcomes", combatOnly: true },
  { n: "Fireballs", lvl: 4, s: "offense", kind: "volley", dmg: { n: 1, sides: 10, bonus: 2 }, txt: "d8 balls at d10+2 each", combatOnly: true },
  { n: "Petrify", lvl: 5, s: "offense", kind: "petrify", txt: "encased in stone for five days", combatOnly: true },
  { n: "Insane", lvl: 2, s: "offense", kind: "insane", txt: "one foe rolls on the madness table", combatOnly: true },
  { n: "Summon", lvl: 2, s: "special", kind: "summon", txt: "something fights beside you", combatOnly: false },
  { n: "Fireball", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 2, sides: 10, bonus: 4 }, txt: "2d10+4", combatOnly: true },
  { n: "Major Heal", lvl: 3, s: "healing", kind: "heal", dmg: { n: 3, sides: 10, bonus: 0 }, txt: "3d10 wp", combatOnly: false },
  { n: "Bubble", lvl: 3, s: "protection", kind: "ward", pool: 100, rounds: 12, reflect: true, txt: "soaks 100 wp and reflects", combatOnly: false },
  { n: "Sense Danger", lvl: 3, s: "divination", kind: "foresee", txt: "read the next encounter", combatOnly: false },
  { n: "Turn Walking Dead", lvl: 2, s: "protection", kind: "turn", txt: "the dead of your level or lower are sent back", combatOnly: true },
  { n: "Plane Gate", lvl: 3, s: "protection", kind: "gate", txt: "d6 demons or dead vanquished to The Planes", combatOnly: true },
  { n: "Sense Presence", lvl: 2, s: "protection", kind: "senses", txt: "see in the dark; never surprised", combatOnly: false },
  { n: "Phantom Host", lvl: 3, s: "illusion", kind: "summon", txt: "a host that isn't there", combatOnly: false },
  { n: "Lightning", lvl: 4, s: "offense", kind: "thrown", dmg: { n: 1, sides: 10, bonus: 6 }, txt: "d10+6, every foe", combatOnly: true },
  { n: "Regeneration", lvl: 4, s: "healing", kind: "regen", txt: "d8 wp a round this fight", combatOnly: false },
  { n: "Mangle", lvl: 5, s: "offense", kind: "thrown", dmg: { n: 2, sides: 20, bonus: 15 }, txt: "2d20+15", combatOnly: true },
  { n: "Death", lvl: 5, s: "offense", kind: "death", txt: "one foe dies, costs 25 wp", combatOnly: true },
];
