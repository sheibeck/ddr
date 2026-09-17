// content/skills.js
//
// Pure-data port of mazeworld.html's FIGHTER_SKILLS / THIEF_SKILLS tables
// (~line 585-609). No closures in the prototype — ported verbatim.
// `skillTable`/`rollSkills` are logic, not data — they move to
// engine/character.js in plan 01-05.
//
// Phase 38 (ABIL-02, "more actives, fewer dull passives, fun over
// symmetry"): these tables are NO LONGER a verbatim prototype port. They
// were reshaped POSITIONALLY — the object-literal insertion order and every
// position's `cost` are UNCHANGED (rollSkills' Fisher-Yates shuffle permutes
// INDICES, so a different position/cost at the same slot would permute a
// different draw outcome per seed; see test/unit/chargen-rng-pin.test.js,
// which stays green and UNTOUCHED as the proof). Only a slot's KEY/behavior
// changed: five passives per class survive verbatim (Fighter: Stealth,
// Hardiness, Ambidextrous, Cooking, Runes/Signs; Thief: Locks, Sewing, Night
// Vision, Heft, Acute Hearing); Language/Tracking/Climbing/Leaping are
// dropped outright; Death-touch/Agility/Kata (Fighter) and Kata/Silence
// (Thief) are converted into actives. Every converted/replacement entry
// carries an `active` marker naming its content/abilities.js catalog id,
// whose txt is the catalog's canon line (see content/abilities.js's catalog + docs/ABILITIES.md's
// "Table reshape" section for the full before/after table). NEVER reorder a
// key or change a position's cost — that is the one hard rule this reshape
// must never break.

export const FIGHTER_SKILLS = {
  "Kata": { cost: 4, active: "kata", txt: "one perfect form: this strike cannot miss and adds your level in damage" },
  "Stealth": { cost: 3, txt: "critical on a 2 when you open a fight; never in plate" },
  "Death Touch": { cost: 4, active: "deathTouch", txt: "call it: your next landed blow doubles, and finishes anything under 15 hp" },
  "Sidestep": { cost: 5, active: "sidestep", txt: "two rounds of not being where the blade is: every foe needs two better" },
  "Hardiness": { cost: 6, txt: "−3 to all damage taken; phobias halved" },
  "Ambidextrous": { cost: 4, txt: "a second weapon at the end of every round" },
  "Cooking": { cost: 3, txt: "eat any beast for a quarter of its wp" },
  "Pommel Strike": { cost: 1, active: "pommelStrike", txt: "the blunt end, to the temple: the target loses its next turn" },
  "Runes/Signs": { cost: 2, txt: "read scrolls; without it they are waste paper" },
  "Battle Roar": { cost: 4, active: "battleRoar", txt: "loud enough to matter: for two rounds every foe needs two better to hit anyone on your side" },
  "Second Wind": { cost: 2, active: "secondWind", txt: "remember why you came: heal d8 + level" },
  "Sweep": { cost: 2, active: "sweep", txt: "one wide arc: every living foe takes half damage" },
};

export const THIEF_SKILLS = {
  "Feint": { cost: 5, active: "feint", txt: "look left, stab right: this strike cannot miss and adds your level" },
  "Locks": { cost: 2, up: 1, txt: "1–5 on d10 to open a lock", txt2: "1–7 on d10 to open a lock" },
  "Sewing": { cost: 4, up: 2, txt: "patch any armour, d6 back, 4 times", txt2: "patch any armour, d6+3 back, 6 times" },
  "Night Vision": { cost: 3, txt: "darkness costs you nothing" },
  "Heft": { cost: 5, txt: "+2 damage, mail armour, half upkeep" },
  "Acute Hearing": { cost: 5, txt: "never surprised; 3 to hit the unseen" },
  "Dirty Trick": { cost: 3, active: "dirtyTrick", txt: "sand, thumb, elbow: the target is blinded for two rounds" },
  "Smoke": { cost: 4, active: "smoke", txt: "gone: for two rounds foes need a natural 1 to find you, and a flee during it just works" },
  "Silent Step": { cost: 6, active: "silentStep", txt: "nobody heard that: your next attack is an automatic critical, any round" },
};
