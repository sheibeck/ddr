// content/bestiary.js
//
// Pure-data port of mazeworld.html's BESTIARY / ENC_TYPES / ENC_ALIAS tables
// (~line 749-829). Creature `sp.dmg` closures (`()=>D(8)`, `()=>1`,
// `()=>2*D(10)+4`) are converted to dice-notation ({n,sides,bonus}) per
// Pattern 1. Flat values (`()=>1`, `()=>25`) become a zero-dice notation
// (n:0, sides:0, bonus:flat) so the engine can call rollDice() uniformly.
// Array order within each floor bucket is preserved exactly — the maze's
// encounter resolution indexes into these arrays by roll.
//
// Phase 18 (BEST-01/BEST-02) deliberately moved nine entries' numbers away
// from the prototype's values (Drake, Stalka Beast, Djinni x2, Krupke,
// Werebeast, Drudge x2, Vampire) and wired a tenth pre-existing flag
// (Sterling's sp.halfDmg) into the engine without changing its own numbers;
// the full before/after stat table, yardstick
// methodology and per-creature rationale live in content/BESTIARY-REBALANCE.md
// (D-04). The four fixture-exposed creatures (Bat/Rat, Shriek, Viper, Dante —
// see test/parity/FIXTURE-INVENTORY.md) are untouched and must stay so
// without a named comparables.js carve-out (BEST-03/FID-05) — superseded for
// Dante by Phase 27 (TUNE-06): Dante moved to tier 2, the tier-1 Humans row
// is Ned, and the seed-303 scenario carries a declared action-path
// divergence record instead of a comparables.js carve-out; the other three
// rows are still untouched; array order within each tier is load-bearing for
// rng.pick.
//
// Phase 19 (FOE-01/FOE-05/D-01/D-03) adds a top-level `abilities` id-array kit
// to eight rows (Krupke, Drudge x2, Djinni x2, Vampire, Stalka Beast, Drake)
// referencing content/foe-abilities.js by id — absent, never an empty array,
// on every other row (the structural zero-draw gate the 19-03 engine resolver
// depends on) — and adds a `fleesBelow` flee-threshold flag to the Djinni x2
// (the <25% HP flee threshold the 19-03 foeTurn check reads). `sp.caster`
// remains exactly what it always was: an inert flavor flag never read by any
// engine code.

export const BESTIARY = {
  "Beasts": [
    [
      { n: "Bat/Rat", sz: "T", i: 1, wp: 1, sp: { atk: 2, dmg: { n: 0, sides: 0, bonus: 1 }, note: "two attacks, 1 wp each" } },
      { n: "Shriek", sz: "T", i: 1, wp: 3, sp: { shriek: true, note: "a scream deafens; half damage after" } },
      { n: "Viper", sz: "S", i: 1, wp: 3, sp: { poison: true, note: "venom: 2 wp a round for d10 rounds" } },
    ],
    [
      { n: "Cave Bear", sz: "L", i: 4, wp: 25, sp: { dmg: { n: 1, sides: 8, bonus: 0 }, disease: true, note: "rabid — d8, and the bite carries it" } },
      { n: "Zit", sz: "T", i: 6, wp: 4, sp: { acid: true, toHit: 4, note: "acid; hittable only on a 4" } },
    ],
    [
      { n: "Drat", sz: "L", i: 10, wp: 26, sp: { ar: 12, toHit: 5, breaks: true, note: "natural mail; may break your weapon" } },
      { n: "Flube", sz: "S", i: 3, wp: 7, sp: { noArmor: true, blind: true, note: "armour-piercing, and poison that blinds" } },
      { n: "Rast", sz: "H", i: 6, wp: 12, sp: { dmg: { n: 1, sides: 8, bonus: 4 }, note: "+4 with any weapon it has picked up" } },
      { n: "Sterling", sz: "H", i: 2, wp: 35, sp: { halfDmg: true, dmg: { n: 1, sides: 12, bonus: 0 }, note: "two hearts: takes half damage from everything" } },
      { n: "Wolf", sz: "S", i: 4, wp: 6, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" } },
    ],
    [
      // DELIBERATE RULES CHANGE (Phase 18, BEST-01/D-18 outlier fix): wp 135 -> 38
      // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
      // sp.every stays inert (unread by engine code); the engine reads `every`
      // from the drakeBreath descriptor instead (CANON-02).
      { n: "Drake", sz: "B", i: 15, wp: 38, sp: { dmg: { n: 2, sides: 10, bonus: 4 }, every: 4, note: "breathes fire every four rounds" }, abilities: ["drakeBreath"] },
      { n: "Stink Bug", sz: "S", i: 1, wp: 4, sp: { toHit: 2, phobia: true, note: "small: strike as one level lower, 2 to hit" } },
    ],
    [
      { n: "Dread Lock", sz: "XL", i: 4, wp: 40 },
      // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount — revisit Phase 21): wp 125 -> 94, added dmg 1d4+0
      // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
      { n: "Stalka Beast", sz: "XL", i: 15, wp: 94, sp: { atk: 2, dmg: { n: 1, sides: 4, bonus: 0 }, note: "sees the invisible, hears the silenced" }, abilities: ["stalkaHeal", "stalkaLightning", "stalkaFireball", "stalkaFreeze"] },
    ],
  ],
  "Demons": [
    [{ n: "Gremlin", sz: "S", i: 6, wp: 8, sp: { dmg: { n: 1, sides: 6, bonus: 3 }, note: "+3 damage and quick with it" } }],
    [{ n: "Poltergeist", sz: "S", i: 4, wp: 10, sp: { atk: 2, noArmor: true, note: "armour is no use against it" } }],
    [{ n: "Rinkle", sz: "L", i: 1, wp: 16, sp: { age: true, note: "its toxin convinces you that you are old" } }],
    [
      // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount — revisit Phase 21): wp 86 -> 65, added dmg 1d4+0
      // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
      { n: "Djinni", sz: "G", i: 16, wp: 65, sp: { caster: true, dmg: { n: 1, sides: 4, bonus: 0 }, fleesBelow: 0.25, note: "casts every spell of levels 1 to 4" }, abilities: ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"] },
      { n: "Ghost", sz: "H", i: 3, wp: 28, sp: { magicOnly: true, noArmor: true, phobia: true, note: "only magic touches it" } },
      { n: "Spectre", sz: "H", i: 5, wp: 32, sp: { magicOnly: true, noArmor: true, pursues: true, note: "only magic touches it, and it follows" } },
    ],
    // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount — revisit Phase 21): wp 86 -> 65, added dmg 1d4+0
    // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
    [{ n: "Djinni", sz: "G", i: 16, wp: 65, sp: { caster: true, dmg: { n: 1, sides: 4, bonus: 0 }, fleesBelow: 0.25, note: "casts every spell of levels 1 to 4" }, abilities: ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"] }],
  ],
  // DELIBERATE RULES CHANGE (Phase 27, 2026-09-15, TUNE-06): Dante demoted
  // from tier 1 to tier 2 (stats and note unchanged: sz H, i 12, wp 20, atk
  // 3); tier-1 Humans is now Ned (sz H, i 8, wp 8, one swing a round). Why:
  // "cut down by a Dante" was the #1 death cause at scale (724 of 5,720
  // Phase 26 runs) — three strikes a round and 20 wp against level-1
  // characters on floor 1; floor-1 Humans death rate 61.57 % -> 14.73 %
  // (attack-only sim, 2,000 seeds; Demons, the next-deadliest tier-1 type,
  // measures 25.72 % on the same seeds). The seed-303 parley parity scenario now
  // rolls Ned and carries a declared action-path divergence
  // (test/parity/FIXTURE-INVENTORY.md, Phase 27 section). Ledger:
  // docs/DIFFICULTY-RETUNE.md, "## v1.2 retune (Phase 27)".
  "Humans": [
    [{ n: "Ned", sz: "H", i: 8, wp: 8, sp: { note: "a bandit: one knife, one grudge, no plan" } }],
    [
      { n: "China Wolf", sz: "H", i: 5, wp: 16, sp: { atk: 2, dmg: { n: 1, sides: 6, bonus: 0 }, note: "hunts in pairs, two attacks" } },
      // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount — revisit Phase 21): wp 23 -> 17, dmg 1d8+2 -> 1d6+2
      // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
      { n: "Krupke", sz: "H", i: 8, wp: 17, sp: { caster: true, ar: 12, dmg: { n: 1, sides: 6, bonus: 2 }, note: "a sorcerer in mail with a long sword" }, abilities: ["krupkeWeaken", "krupkeFreeze"] },
      { n: "Dante", sz: "H", i: 12, wp: 20, sp: { atk: 3, note: "twins, four arms: three strikes a round" } },
    ],
    [
      { n: "Frank", sz: "H", i: 10, wp: 20, sp: { steals: true, dmg: { n: 1, sides: 8, bonus: 6 }, note: "a con-man; may take everything and vanish" } },
      { n: "Primp", sz: "H", i: 7, wp: 18, sp: { enthrall: true, dmg: { n: 1, sides: 8, bonus: 2 }, note: "beautiful, and counting on it" } },
    ],
    [
      { n: "Craig", sz: "H", i: 6, wp: 24, sp: { dmg: { n: 1, sides: 12, bonus: 0 }, ar: 15, note: "two-handed sword, chitin plate, home ground" } },
      { n: "Herman", sz: "H", i: 9, wp: 36, sp: { invis: true, ar: 15, dmg: { n: 0, sides: 0, bonus: 25 }, note: "turns invisible; strikes as a level five" } },
    ],
    [{ n: "Herman", sz: "H", i: 9, wp: 36, sp: { invis: true, ar: 15, dmg: { n: 0, sides: 0, bonus: 25 }, note: "turns invisible; strikes as a level five" } }],
  ],
  "Lair Beasts": [
    [
      { n: "Dog Face", sz: "S", i: 8, wp: 6, sp: { dmg: { n: 1, sides: 6, bonus: 0 }, note: "packs; the leader carries a d8 sword" } },
      { n: "Goblin", sz: "S", i: 5, wp: 4, sp: { note: "never retreats, and carries wilmst" } },
      { n: "Hobgoblin", sz: "S", i: 7, wp: 5, sp: { dmg: { n: 1, sides: 6, bonus: 1 }, loot: true, note: "always has something magical in its lair" } },
      { n: "M&M", sz: "S", i: 6, wp: 3, sp: { critOn: 1, note: "deaf; criticals on a 1" } },
      { n: "Pogo", sz: "S", i: 1, wp: 4, sp: { dmg: { n: 1, sides: 6, bonus: 4 }, fast: true, note: "+4 damage, and fast — strike one higher" } },
    ],
    [
      { n: "Hair", sz: "H", i: 2, wp: 12, sp: { dmg: { n: 1, sides: 6, bonus: 0 }, note: "clubs, and a great deal of hair" } },
      { n: "Trachea", sz: "S", i: 5, wp: 8, sp: { poison: true, dmg: { n: 1, sides: 10, bonus: 0 }, note: "+4 on its first hit; fighters do double to it" } },
    ],
    [{ n: "Blumble", sz: "S", i: 4, wp: 16, sp: { quills: true, dmg: { n: 1, sides: 12, bonus: 0 }, note: "quills; cutting it only makes more of them" } }],
    [{ n: "Drarl", sz: "L", i: 9, wp: 19, sp: { acid: true, noArmor: true, note: "acid: mail and plate make it worse" } }],
    [{ n: "Drarl", sz: "L", i: 9, wp: 19, sp: { acid: true, noArmor: true, note: "acid: mail and plate make it worse" } }],
  ],
  "Magical": [
    [{ n: "Drekk", sz: "T", i: 4, wp: 7, sp: { song: true, note: "sings; you may simply fall asleep" } }],
    [{ n: "Shadow", sz: "S", i: 2, wp: 4, sp: { daggerOnly: true, dark: true, note: "only a dagger or magic touches it" } }],
    // DELIBERATE RULES CHANGE (Phase 18, BEST-01/D-18 outlier fix): dmg bonus 1d10+5 -> 1d10+0, note updated to match
    [{ n: "Werebeast", sz: "L", i: 6, wp: 32, sp: { atk: 2, dmg: { n: 1, sides: 10, bonus: 0 }, note: "two attacks at d10" } }],
    // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount, HP-only — revisit Phase 21): wp 12 -> 9
    // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
    [{ n: "Drudge", sz: "H", i: 5, wp: 9, sp: { caster: true, never_melee: true, note: "casts every offensive spell, 1 to 4, without limit" }, abilities: ["drudgeLightning", "drudgeFireball", "drudgeWeaken", "drudgeFreeze"] }],
    // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount, HP-only — revisit Phase 21): wp 12 -> 9
    // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
    [{ n: "Drudge", sz: "H", i: 5, wp: 9, sp: { caster: true, never_melee: true, note: "casts every offensive spell, 1 to 4, without limit" }, abilities: ["drudgeLightning", "drudgeFireball", "drudgeWeaken", "drudgeFreeze"] }],
  ],
  "Walking Dead": [
    [{ n: "Philly", sz: "H", i: 3, wp: 5, sp: { twice: true, slow: true, dmg: { n: 1, sides: 4, bonus: 2 }, note: "you have to kill it twice" } }],
    [
      { n: "Google", sz: "H", i: 2, wp: 19, sp: { ar: 15, dmg: { n: 1, sides: 8, bonus: 0 }, note: "rusted plate and a long sword" } },
      { n: "Skeleton", sz: "H", i: 2, wp: 6, sp: { twice: true, toHit: 4, critOn: 1, note: "kill it twice; a 1 shatters it" } },
    ],
    [
      { n: "Ghoul", sz: "H", i: 2, wp: 15, sp: { raise: true, dmg: { n: 1, sides: 6, bonus: 0 }, note: "raises the ghouls you have already killed" } },
      { n: "Zombie", sz: "H", i: 3, wp: 12, sp: { grapple: true, disease: true, note: "grapples, and carries leprosy" } },
    ],
    [
      { n: "Bones", sz: "S", i: 2, wp: 14, sp: { pack: true, note: "a pack: they all pick one of you" } },
      { n: "Floater", sz: "H", i: 3, wp: 8, sp: { entangle: true, note: "lifts you off the floor and suffocates you" } },
      { n: "Undead", sz: "H", i: 3, wp: 18, sp: { possess: true, note: "its spirit may take you over when it dies" } },
    ],
    // DELIBERATE RULES CHANGE (Phase 18, BEST-02/D-03 pre-ability discount — revisit Phase 21): wp 95 -> 71, added dmg 1d4+0
    // DELIBERATE RULES CHANGE (Phase 19, FOE-01/FOE-05/D-03): abilities kit — see content/foe-abilities.js
    [{ n: "Vampire", sz: "H", i: 12, wp: 71, sp: { atk: 2, awe: true, caster: true, seesInvis: true, noTurn: true, dmg: { n: 1, sides: 4, bonus: 0 }, note: "awe on a d12; two attacks; master of every offensive spell" }, abilities: ["vampireSummon", "vampireFireball", "vampireLightning", "vampireDrain"] }],
  ],
};

export const ENC_TYPES = ["Beasts", "Demons", "Humans", "Lair Beasts", "Magical", "Walking Dead"];

export const ENC_ALIAS = {
  "Lair Beast": "Lair Beasts", "Beasts": "Beasts", "Demons": "Demons",
  "Humans": "Humans", "Magical": "Magical", "Walking Dead": "Walking Dead",
};
