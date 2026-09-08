// content/skills.js
//
// Pure-data port of mazeworld.html's FIGHTER_SKILLS / THIEF_SKILLS tables
// (~line 585-609). No closures in the prototype — ported verbatim.
// `skillTable`/`rollSkills` are logic, not data — they move to
// engine/character.js in plan 01-05.

export const FIGHTER_SKILLS = {
  "Kata": { cost: 4, txt: "+level damage and 1–6 accuracy with your first weapon" },
  "Stealth": { cost: 3, txt: "critical on a 2 when you open a fight; never in plate" },
  "Death-touch": { cost: 4, txt: "a 1 doubles, and kills outright under 15 wp" },
  "Agility": { cost: 5, txt: "every enemy needs one better to land on you" },
  "Hardiness": { cost: 6, txt: "−3 to all damage taken; phobias halved" },
  "Ambidextrous": { cost: 4, txt: "a second weapon at the end of every round" },
  "Cooking": { cost: 3, txt: "eat any beast for a quarter of its wp" },
  "Language": { cost: 1, txt: "parley with anything that talks" },
  "Runes/Signs": { cost: 2, txt: "read scrolls; without it they are waste paper" },
  "Tracking": { cost: 4, txt: "1–5 on d20 to read an encounter, and walk away from it" },
  "Climbing": { cost: 2, txt: "+4 to climbing rolls" },
  "Leaping": { cost: 2, txt: "+2 to leaping rolls" },
};

export const THIEF_SKILLS = {
  "Kata": { cost: 5, txt: "strike as a fighter, +level damage" },
  "Locks": { cost: 2, up: 1, txt: "1–5 on d10 to open a lock", txt2: "1–7 on d10 to open a lock" },
  "Sewing": { cost: 4, up: 2, txt: "patch any armour, d6 back, 4 times", txt2: "patch any armour, d6+3 back, 6 times" },
  "Night Vision": { cost: 3, txt: "darkness costs you nothing" },
  "Heft": { cost: 5, txt: "+2 damage, mail armour, half upkeep" },
  "Acute Hearing": { cost: 5, txt: "never surprised; 3 to hit the unseen" },
  "Climbing": { cost: 3, txt: "+4 to climbing, and half of any fall" },
  "Leaping": { cost: 4, txt: "+2 to leaping rolls" },
  "Silence": { cost: 6, txt: "sneak attacks are automatic criticals" },
};
