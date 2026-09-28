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
  "Kata": { cost: 4, active: "kata", txt: "one perfect form: this strike cannot miss and adds your level in damage; once per fight" },
  "Stealth": { cost: 3, txt: "critical on your die's top two faces when you open a fight; never in plate" },
  "Death Touch": { cost: 4, active: "deathTouch", txt: "call it: your next landed blow doubles, and finishes anything under 15 hp; once per fight" },
  "Sidestep": { cost: 5, active: "sidestep", txt: "two rounds of not being where the blade is: every foe has two fewer faces that hit you" },
  "Hardiness": { cost: 6, txt: "−3 to all damage taken; phobias halved" },
  "Ambidextrous": { cost: 4, txt: "a second weapon at the end of every round" },
  // Phase 43 (CLAR, HP-not-WP ruling): unit word reworded wp -> hp;
  // cosmetic, engine never reads this string; the parity harness strips the
  // reworded txt (comparables.js#REWORDED_TXT_ITEMS). Re-pinned in
  // test/unit/abilities-catalog.test.js.
  "Cooking": { cost: 3, txt: "eat any beast for a quarter of its hp" },
  "Pommel Strike": { cost: 1, active: "pommelStrike", txt: "the blunt end, to the temple: the target loses its next turn" },
  // RULES-10 (Phase 75.1, plan 75.1-07): rewritten — anyone may now attempt
  // any scroll (canRead is gone), so Runes/Signs is no longer the gate; it
  // is the guarantee. Cosmetic content change only; the engine never reads
  // this string (skillTier reads only the {name: tier} map, never .txt).
  "Runes/Signs": { cost: 2, txt: "reads any scroll without fail; without it, a scroll is an intelligence roll that can backfire" },
  "Battle Roar": { cost: 4, active: "battleRoar", txt: "loud enough to matter: for two rounds every foe has two fewer faces that hit anyone on your side" },
  "Second Wind": { cost: 2, active: "secondWind", txt: "remember why you came: heal d8 + level" },
  "Sweep": { cost: 2, active: "sweep", txt: "one wide arc: every living foe takes half damage" },
};

export const THIEF_SKILLS = {
  "Feint": { cost: 5, active: "feint", txt: "look left, stab right: this strike cannot miss and adds your level in damage; once per fight" },
  "Locks": { cost: 2, up: 1, txt: "6–10 on d10 to open a lock", txt2: "4–10 on d10 to open a lock" },
  "Sewing": { cost: 4, up: 2, txt: "patch any armour, d6 back, 4 times", txt2: "patch any armour, d6+3 back, 6 times" },
  "Night Vision": { cost: 3, txt: "darkness costs you nothing" },
  "Heft": { cost: 5, txt: "+2 damage, mail armour, half upkeep" },
  // DELIBERATE RULES CHANGE (Phase 72, ROLL-01, finding F2, user ruling
  // 2026-09-24): "3 to hit the unseen" promised a to-hit bonus against an
  // unseen foe that no engine site ever read (a dead claim) — dropped.
  // "never surprised" is kept (its own initiative-side effect is real, see
  // docs/ROLL-LEDGER.md's [initiative:acute-hearing] row). The user's
  // requested replacement ("Hear the next room") landed in Phase 78 as
  // HUD-07 (plan 78-09, ruled option A by the user 2026-09-26): the hero
  // hears every unresolved encounter within three squares, through walls,
  // without learning what it is (engine/derived.js#heardSquares; the map
  // draws a faint ripple). The engine never reads this string.
  "Acute Hearing": { cost: 5, txt: "never surprised; hears an encounter up to three squares away, walls or no walls, without learning what it is" },
  "Dirty Trick": { cost: 3, active: "dirtyTrick", txt: "sand, thumb, elbow: the target is blinded for two rounds" },
  "Smoke": { cost: 4, active: "smoke", txt: "gone: for two rounds foes find you only on their die's top face (the top two faces if you insulted them), and a flee during it just works" },
  "Silent Step": { cost: 6, active: "silentStep", txt: "nobody heard that: your next attack is an automatic critical, any round; once per fight" },
};
