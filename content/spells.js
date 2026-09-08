// content/spells.js
//
// Pure-data port of mazeworld.html's SPELLS table (~line 831-864). Every
// `dmg: () => D(n)` closure is converted to dice-notation ({n,sides,bonus})
// per Pattern 1. Non-damage spells (wards, status, utility) keep their
// `pool`/`rounds`/`reflect`/`txt` fields verbatim and simply have no `dmg`
// field, matching the prototype. Array order preserved (32 entries — the
// prototype's actual count; content-tables.test.js locks this number).

export const SPELLS = [
  { n: "Heal", lvl: 1, s: "healing", kind: "heal", dmg: { n: 1, sides: 10, bonus: 0 }, txt: "d10 wp" },
  { n: "Shield", lvl: 1, s: "protection", kind: "ward", pool: 50, rounds: 5, txt: "soaks 50 wp, 5 rounds" },
  { n: "Strength", lvl: 1, s: "offense", kind: "might", dmg: { n: 1, sides: 10, bonus: 0 }, txt: "+d10 damage till tomorrow" },
  { n: "Doze", lvl: 1, s: "offense", kind: "status", txt: "sleep d4 rounds" },
  { n: "Freeze", lvl: 1, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, txt: "d6, thrown" },
  { n: "Detect Magic", lvl: 1, s: "divination", kind: "reveal", txt: "the floor lays itself out" },
  { n: "Mirror Self", lvl: 1, s: "illusion", kind: "mirror", txt: "foes need a 1 for d6 rounds" },
  { n: "Stun", lvl: 1, s: "offense", kind: "stun", txt: "d6 creatures stunned d4 rounds" },
  { n: "Weaken", lvl: 1, s: "offense", kind: "weaken", txt: "they hit on a 3 and do half" },
  { n: "Acid", lvl: 2, s: "offense", kind: "acid", dmg: { n: 2, sides: 6, bonus: 2 }, txt: "2d6+2 a round for d6 rounds" },
  { n: "Stupidity", lvl: 2, s: "offense", kind: "stupid", txt: "intelligence to 1; it can do nothing" },
  { n: "Blind", lvl: 3, s: "offense", kind: "blind", txt: "blind for life, thrown" },
  { n: "Shrink", lvl: 3, s: "offense", kind: "shrink", txt: "two sizes down, half wp and damage" },
  { n: "Ice", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 1, sides: 6, bonus: 0 }, txt: "d6 a round, then frozen" },
  { n: "Earthquake", lvl: 4, s: "offense", kind: "quake", dmg: { n: 3, sides: 10, bonus: 8 }, txt: "3d10+8 to everything, you included" },
  { n: "Noxious Vapor", lvl: 4, s: "offense", kind: "vapor", txt: "a d6 of very bad outcomes" },
  { n: "Fireballs", lvl: 4, s: "offense", kind: "volley", dmg: { n: 1, sides: 10, bonus: 2 }, txt: "d8 balls at d10+2 each" },
  { n: "Petrify", lvl: 5, s: "offense", kind: "petrify", txt: "encased in stone for five days" },
  { n: "Insane", lvl: 2, s: "offense", kind: "insane", txt: "one foe rolls on the madness table" },
  { n: "Summon", lvl: 2, s: "special", kind: "summon", txt: "something fights beside you" },
  { n: "Fireball", lvl: 3, s: "offense", kind: "thrown", dmg: { n: 2, sides: 10, bonus: 4 }, txt: "2d10+4" },
  { n: "Major Heal", lvl: 3, s: "healing", kind: "heal", dmg: { n: 3, sides: 10, bonus: 0 }, txt: "3d10 wp" },
  { n: "Bubble", lvl: 3, s: "protection", kind: "ward", pool: 100, rounds: 12, reflect: true, txt: "soaks 100 wp and reflects" },
  { n: "Sense Danger", lvl: 3, s: "divination", kind: "foresee", txt: "read the next encounter" },
  { n: "Turn Walking Dead", lvl: 2, s: "protection", kind: "turn", txt: "the dead of your level or lower are sent back" },
  { n: "Plane Gate", lvl: 3, s: "protection", kind: "gate", txt: "d6 demons or dead vanquished to The Planes" },
  { n: "Sense Presence", lvl: 2, s: "protection", kind: "senses", txt: "see in the dark; never surprised" },
  { n: "Phantom Host", lvl: 3, s: "illusion", kind: "summon", txt: "a host that isn't there" },
  { n: "Lightning", lvl: 4, s: "offense", kind: "thrown", dmg: { n: 1, sides: 10, bonus: 6 }, txt: "d10+6, every foe" },
  { n: "Regeneration", lvl: 4, s: "healing", kind: "regen", txt: "d8 wp a round this fight" },
  { n: "Mangle", lvl: 5, s: "offense", kind: "thrown", dmg: { n: 2, sides: 20, bonus: 15 }, txt: "2d20+15" },
  { n: "Death", lvl: 5, s: "offense", kind: "death", txt: "one foe dies, costs 25 wp" },
];
