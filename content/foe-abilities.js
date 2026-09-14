// content/foe-abilities.js
//
// Phase 19 (FOE-01, D-01) — pure-data registry of foe ability descriptors,
// referenced by id from content/bestiary.js's new `abilities: [ids]` arrays.
// Mirrors content/spells.js's SPELLS[] shape exactly: a flat array of plain
// objects, dice as {n, sides, bonus} notation (never a closure), no functions
// anywhere in the object graph (test/determinism/content-is-pure-data.test.js
// enforces this at the filesystem level — no registration needed here).
//
// Descriptor shape: { id, kind, lvl, dmg?, effect?, every?, uses?, txt }
//   - kind: one of "bolt" | "drain" | "debuff" | "heal" | "summon" (D-02).
//   - lvl: the canon SPELLS level this ability's dice/effect borrows from
//     (Freeze 1, Weaken/Daze 1-2, Fireball 3, Lightning 4, drain/heal/summon
//     5, the Drake's breath 4) — informational only, never read by the engine.
//   - dmg: {n, sides, bonus} dice notation, present on bolt/drain/heal kinds.
//   - effect: "weakened" | "dazed" for debuff kinds, or
//     { type, tier } for the summon kind (a bestiary type/tier to rng.pick).
//   - every: N — the ability is ready every Nth foe-turn visit; the engine
//     (19-03) owns the countdown state (f.cd), never this content.
//   - uses: N — a per-encounter cast cap; the engine (19-03) owns the
//     remaining-uses counter (f.uses), never this content.
//   - txt: the Oracle telegraph line the `foeCast` event carries (D-06/D-16);
//     a complete, toast-length, family-friendly deadpan sentence naming the
//     creature; scanned in full by test/voice/safety-scan.test.js Corpus 3.
//
// Dice budget (D-03): every single ability's expected damage is capped at
// ~50% of a level-N hero's expected HP at that tier (HERO_HP from
// tools/bestiary-yardstick.mjs = [41.7, 46.2, 50.0, 54.5, 60.0]); the
// largest expected value in this registry is 15 (2d10+4, well under the
// tier-2 floor of 20.85), so no Mangle-class (2d20+15) one-shot exists here.
// Kit order (as referenced from content/bestiary.js) is the D-04 cast
// priority: every kit lists its bounded (every/uses) abilities first. Every
// `never_melee` caster's kit (Drudge/Vampire/Stalka Beast/Krupke) ends in a
// truly unbounded ability (no `every`, no `uses`), so a never_melee caster
// always has something to cast and never goes permanently silent. This does
// NOT hold for the Djinni's kit below — every one of its four entries
// carries `uses: 4` — but that is harmless today because the Djinni is not
// `never_melee` (its bestiary row carries an `sp.dmg` melee fallback), so
// engine/combat.js#foeTurn's ability gate falls through to a normal melee
// swing once its uses are exhausted (`foeOutOfSpells` is never reached). If
// a FUTURE `never_melee` caster is modeled on the Djinni's all-`uses` kit
// shape, it would go silent forever once spent — give it a genuine unbounded
// fallback, matching every other never_melee kit above (WR-03, 19-REVIEW.md).
export const FOE_ABILITIES = [
  { id: "krupkeWeaken", kind: "debuff", lvl: 1, effect: "weakened", every: 3, txt: "Krupke mutters something unkind about your arms, and they agree with him." },
  { id: "krupkeFreeze", kind: "bolt", lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, txt: "Krupke flicks a chill at you from behind his shield. Economical." },
  { id: "drudgeLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, every: 3, txt: "The Drudge raises a hand and the air goes sharp and blue." },
  { id: "drudgeFireball", kind: "bolt", lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, every: 2, txt: "The Drudge makes a small, bored gesture. The corridor catches fire." },
  { id: "drudgeWeaken", kind: "debuff", lvl: 1, effect: "weakened", every: 4, txt: "The Drudge whispers, and your grip goes soft mid-swing." },
  { id: "drudgeFreeze", kind: "bolt", lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, txt: "The Drudge sends frost your way, aimed with real spite." },
  { id: "djinniFireball", kind: "bolt", lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, uses: 4, every: 2, txt: "The Djinni sighs theatrically and lobs a fireball. It's not personal." },
  { id: "djinniDaze", kind: "debuff", lvl: 2, effect: "dazed", uses: 4, every: 3, txt: "The Djinni snaps its fingers, and the room tilts a little." },
  { id: "djinniLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, uses: 4, txt: "The Djinni conjures lightning with a bored little flourish." },
  { id: "djinniFreeze", kind: "bolt", lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, uses: 4, txt: "The Djinni flicks a bit of frost at you. It is running out of ideas." },
  { id: "vampireSummon", kind: "summon", lvl: 5, effect: { type: "Walking Dead", tier: 2 }, every: 6, txt: "The Vampire gestures, unbothered, and the dead oblige." },
  { id: "vampireFireball", kind: "bolt", lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, every: 3, txt: "Fire, from something that has never once been warm." },
  { id: "vampireLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, every: 2, txt: "The candles gutter. The Vampire's lightning follows." },
  { id: "vampireDrain", kind: "drain", lvl: 5, dmg: { n: 2, sides: 6, bonus: 0 }, txt: "Cold fingers close on you, and something is taken." },
  { id: "stalkaHeal", kind: "heal", lvl: 5, dmg: { n: 1, sides: 10, bonus: 0 }, every: 3, txt: "The Stalka Beast's wounds knit shut, unimpressed by your effort." },
  { id: "stalkaLightning", kind: "bolt", lvl: 4, dmg: { n: 1, sides: 10, bonus: 6 }, every: 2, txt: "A crack of ozone from somewhere behind the Stalka Beast's eyes." },
  { id: "stalkaFireball", kind: "bolt", lvl: 3, dmg: { n: 2, sides: 10, bonus: 4 }, every: 3, txt: "The Stalka Beast exhales, and the corridor briefly has weather." },
  { id: "stalkaFreeze", kind: "bolt", lvl: 1, dmg: { n: 1, sides: 6, bonus: 0 }, txt: "The Stalka Beast flicks a lazy frost at you, almost politely." },
  { id: "drakeBreath", kind: "bolt", lvl: 4, dmg: { n: 2, sides: 10, bonus: 4 }, every: 4, txt: "The Drake inhales, and you remember that you are flammable." },
];
