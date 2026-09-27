// tools/lib/event-variants.mjs
//
// Phase 79 (VOX-05), 79-01: the fixed set of synthetic events the narration
// corpus renders every EVENT_NARRATION and LINE_FOR builder through.
//
// WHY THIS LIST EXISTS. A builder is `(e) => html` (or `(e, ctx) => { text }`):
// its words depend on which fields the event carries and which branch those
// fields select. To put "every line the player can read" in one table
// (tools/lib/voice-corpus.mjs) the corpus has to render each builder down
// every branch it has, so this module names one rich base event and a list
// of field patches (BRANCH_TOGGLES), each flipping one branch. variantsFor()
// turns them into the ordered renderings the corpus de-duplicates.
//
// A SUPERSET OF THE SAFETY SCAN'S. BASE_EVENT and the first block of
// BRANCH_TOGGLES are copied verbatim from test/voice/safety-scan.test.js
// (where they are inline, not exported; this plan does not edit that test,
// 79-12 rewires it). Added on top, in this order:
//   1. The roll-high field vocabulary tools/voice-sample.mjs documents
//      (`roll`, `atLeast`, `dieN`, `rolls` as an array, `mods`,
//      `critAtLeast`) plus its RULES-11 size fields, merged into BASE_EVENT.
//   2. Every tools/voice-sample.mjs SAMPLE_OVERRIDES patch, one toggle each.
//   3. One toggle per branch no earlier toggle reached, found by reading
//      every builder in src/browser/eventNarration.js and
//      src/browser/narrationLines.js at the phase base (Phases 75.1-78
//      added several: the reason/kind/effect/trigger/critBy/why lookup
//      maps, the fumble effects, the hold words, the item-effect kinds, the
//      hazard `feat` and resume fields, `mirror`, `destroyed`, `books`).
//   4. The fields wave-1 sibling 79-02 introduces, so the corpus renders its
//      honest branches once it lands (the builders at the base ignore them):
//      `gained` equal to `amount`, below it, and 0; and tableFour's
//      `row`/`stat`/`amount` for an hp loss, a capped hp gain, a maxHp gain,
//      an xp gain and the armour row.
//
// FROZEN AFTER 79-01. The phase-base snapshot
// (docs/narrative-pass/corpus-base.json) was rendered through exactly this
// list. If a later plan edited it, a builder's base and current renderings
// could differ for reasons other than its text, and the why-ledger check
// ("before" must be a base rendering) would start lying. Only 79-12 may
// extend it, and only with a note in its SUMMARY.
//
// Presentation tooling only: no engine import, no rng, no DOM.

/** The safety scan's rich base event (test/voice/safety-scan.test.js), copied. */
const SAFETY_SCAN_BASE_EVENT = {
  side: "approach", hurt: 3, loss: 2, kind: "Poison", charges: 2, max: 5, day: 3,
  amount: 2, cost: 4, hours: 2, reason: "parley", foes: [{ name: "Viper" }], name: "Viper",
  tracked: true, roll: 7, target: "Viper", need: 5, critical: true, dmg: 6, spGained: 5,
  wp: 4, rations: 1, bonus: 2, song: "a tune", count: 2, n: 2, r: 2, member: "the companion",
  spell: "Heal", intel: 5, rounds: 3, rolls: 2, totalDamage: 8, nextEncounter: "encounter",
  might: 3, pool: 50, mirror: true, popPool: 25, short: 5, item: { n: "Dagger" }, table: 4,
  result: "something", spells: ["Heal"], what: "a cloak", gift: "Magic Weapon", first: 2,
  mult: 2, remaining: 1, motive: "Blood", level: 2, wpGain: 3, depth: 3, steps: 40, total: 8,
  troll: true, elfOrDwarf: true, untouchable: true,
  fluency: 2, why: "parley",
  left: 3, have: 10, by: "poisonedEdge", attacks: 3,
};

/**
 * The roll-high fields (tools/voice-sample.mjs, Phase 73 ROLL-05) and the
 * RULES-11 size fields, at fixed values. `rolls` becomes an array (the
 * several-draws shape every Phase 73 builder reads); the safety scan's
 * numeric `rolls: 2` is overridden here on purpose.
 */
const ROLL_HIGH_FIELDS = {
  atLeast: 12, dieN: 20, rolls: [7, 15], mods: [{ name: "weapon", delta: 1 }, { name: "insulted", delta: -2 }],
  critAtLeast: 20, size: "Large", step: 1, sizeDmg: 2,
};

/** BASE_EVENT — every field any builder reads, at safe values. */
export const BASE_EVENT = Object.freeze({ ...SAFETY_SCAN_BASE_EVENT, ...ROLL_HIGH_FIELDS });

/** The safety scan's BRANCH_TOGGLES (test/voice/safety-scan.test.js), copied in order. */
const SAFETY_SCAN_TOGGLES = [
  {}, { side: "exit" }, { loss: 0 }, { tracked: false }, { wandering: false, foes: [] },
  { reason: "wizard" }, { reason: "descend" }, { reason: "cloaker" }, { reason: "tracked" },
  { critical: false }, { wp: 0 }, { mult: 1 }, { troll: false, elfOrDwarf: false },
  { troll: false, elfOrDwarf: true }, { roll: null }, { amount: 1 }, { untouchable: false },
  { fluency: 0 }, { why: null }, { reason: "wilmsryVsMagical" },
  { reason: "pilfer" }, { reason: "acrobat" }, { reason: "woodsman" }, { reason: "noRunes" },
  { reason: "knight" }, { reason: "conArtist" }, { reason: "wilmsry" },
  { why: "pickpocket" }, { pickpocket: true }, { bard: true }, { doubled: "Soldier" },
  { halved: true, wear: 2 }, { soaked: { hide: 2, hardiness: 3, ward: 1 } },
  { needMods: [{ name: "Guard", delta: -1 }] }, { critBy: "cutthroat" }, { soldierCrit: true },
  { quip: "X" }, { untouchable: true },
  { knightBigFoe: true, courtMageTalksFirst: true, samuraiNeverFirst: true, fridgianSlow: true, acuteHearing: true },
  { reason: "noParty" }, { reason: "inCombat" }, { reason: "badIndex" },
  { reason: "notWorn" }, { replaced: { n: "Ring of Power" } },
  { reason: "cooldown" }, { reason: "unknown" }, { reason: "notInCombat" },
  { reason: "noTarget" }, { reason: "notLowEnough" }, { reason: "smoke" },
  { member: null },
  { by: "ice" }, { lesser: true }, { rounds: 0 },
  { reason: "died" }, { phobia: "Being trapped" }, { penalty: 2 },
  { cost: 25 }, { fee: 25 }, { sub: "Apprentice" },
  { tool: "ladder" }, { tool: "rope" },
  { heft: true }, { mouths: 3 },
  { eaters: [{ name: "Grunk", race: "Troll", eats: 2 }] }, { eaters: [] },
  { verb: "takeLoot" }, { verb: "unequipSlot" },
  { why: { kind: "weapon", got: { lab: "d8", need: -1, crit: 1, strike: 4.05 }, have: { lab: "d6", need: 0, crit: 1, strike: 5 }, lostProf: 2 } },
  { why: { kind: "armor", got: { ar: 15 }, have: { ar: 6 } } },
  { reason: "tooHeavy" }, { reason: "noArmor" }, { reason: "notBetter" }, { reason: "wrongClass" },
  { destroyed: true },
];

/** tools/voice-sample.mjs SAMPLE_OVERRIDES (Phase 75), one toggle per patch. */
const SAMPLE_OVERRIDE_TOGGLES = [
  { reason: "notWielded" },
  { booksKept: true },
  { mirror: true },
  { roll: 5 },
  { feat: "chest" },
  { destroyed: true, discarded: { n: "Leather" } },
  { why: "senses" },
];

/**
 * Branches the two lists above never reach, read off every builder at the
 * phase base. Grouped by the field they flip.
 */
const PHASE_79_TOGGLES = [
  // Refusal and reason maps (toolRefused, abilityRefused, castRefused,
  // actionRefused, parleyRefused, scrollRefused, useRefused, foeFled,
  // itemRejected's EQUIP_REJECT_TEXT, joinerRefused, fled).
  { reason: "noTool" }, { reason: "noHazard" }, { reason: "notFought" }, { reason: "combatOnly" },
  { reason: "exploreOnly" }, { reason: "notOut" }, { reason: "ninja" }, { reason: "masterOfArms" },
  { reason: "walkingDead" }, { reason: "magical" }, { reason: "tried" }, { reason: "noScrolls" },
  { reason: "recharging" }, { reason: "notDark" }, { reason: "lowHp" }, { reason: "haveOne" },
  { reason: "jewelryFull" }, { reason: "wrongSlot" }, { reason: "notEquippable" }, { reason: "samurai" },
  // Phobia triggers (phobiaTriggered's `lines` map).
  { trigger: "water" }, { trigger: "dark" }, { trigger: "heights" }, { trigger: "deadEnd" }, { trigger: "nearDeath" },
  // Critical sources (CRIT_BY_TEXT).
  { critBy: "stealth" }, { critBy: "backstab" }, { critBy: "ninja" }, { critBy: "deathTouch" }, { critBy: "silentStep" },
  // Initiative verdicts (initiativeVerdictText's `why` switch) and the plain first-mover.
  { why: "samurai" }, { why: "slow" }, { why: "foreseen" }, { why: "acuteHearing" }, { why: "knight" }, { why: "courtMage" },
  { why: null, first: "you" }, { why: null, senses: true },
  // Scroll fumble effects (fumbleOnReader, scrollFumbled) and control-at-depth effects.
  { effect: "damage" }, { effect: "dot" }, { effect: "heavy" }, { effect: "out" }, { effect: "vapor" },
  { effect: "blind" }, { effect: "shrink" }, { effect: "weakened" }, { effect: "none" }, { effect: "volley" },
  { effect: "heal" }, { effect: "regen" }, { effect: "ward" }, { effect: "might" }, { effect: "mirror" },
  { effect: "senses" }, { effect: "summon" }, { effect: "wasted" }, { effect: "asleep" }, { effect: "frozen" },
  { effect: "freeze" }, { effect: "stone" }, { effect: "sleep" }, { effect: "weaken" }, { effect: "stupid" },
  // Held and foe-effect kinds, affliction kinds, and itemEffectStarted's kinds.
  { kind: "frozen" }, { kind: "stone" }, { kind: "stupid" }, { kind: "dazed" }, { kind: "weakened" },
  { kind: "Disease" }, { kind: "haste" }, { kind: "invis" }, { kind: "ether" }, { kind: "acute" },
  { kind: "might" }, { kind: "fly" }, { kind: "lit" }, { kind: "power" }, { kind: "giant" },
  { kind: "enlarge" }, { kind: "glow" }, { kind: "unseen" }, { kind: "tongue" }, { kind: "brace" }, { kind: "plate" },
  { kind: "giant", size: null }, { kind: "heal" }, { kind: "full" },
  // Hazard crossings and resumes (Phase 78): which feat, who read it, the tool.
  { feat: "climb" }, { feat: "gorge" }, { who: "reader" }, { by: "you" },
  // Single-count and single-round wording.
  { left: 1 }, { rounds: 1 }, { count: 1 }, { n: 1 }, { amount: 0 },
  // Loot verbs.
  { verb: "takeAllLoot" }, { verb: "takeFind" },
  // Presence flags no base value sets (each flips a `e.x ? … : …` branch).
  { carried: false }, { afraid: true }, { fizzled: true }, { resisted: true }, { pending: true },
  { reinforcement: true }, { backstab: true }, { castFollows: true }, { ignoresArmor: true },
  { magic: true }, { underMin: true }, { tooAdvanced: true }, { unmade: true }, { refilled: 2 },
  { books: 2 }, { joined: true }, { crit: true }, { replacedBy: "Someone new" }, { stolen: 4 },
  { price: 100 }, { slot: "jewelry1" }, { slot: "cloak" }, { slots: 2 }, { theirs: 3, mine: 2 },
  { how: "climb" }, { members: ["Grunk"], names: ["Grunk", "Sera"] }, { items: [{ n: "Dagger" }, { n: "Rope" }] },
  { g: 25 }, { key: "sidestep" }, { weapon: "Dagger" }, { source: "Freeze" }, { toHit: -2 },
  { round: 2 }, { fumbleAtLeast: 4 }, { via: "kata" }, { ability: "Kata" }, { foe: "Viper" }, { race: "Troll" },
  { txt: "a line of item text" }, { effect: "summon", spell: "Summon" },
  // Wave-1 sibling 79-02's additive fields (the builders at the base ignore
  // them; once 79-02 lands they select its honest gain and Table 4 lines).
  { amount: 8, gained: 8 }, { amount: 8, gained: 3 }, { amount: 8, gained: 0 },
  { row: "-15 HP", stat: "hp", amount: -19, result: "The maze extracts a toll you did not agree to." },
  { row: "+10 HP", stat: "hp", amount: 3, result: "Something in the air knits you back together." },
  { row: "+25 HP", stat: "maxHp", amount: 21, result: "You feel sturdier than you have any right to." },
  { row: "+10 XP", stat: "xp", amount: 50, result: "You learn something, against your will." },
  { row: "-All armour", stat: "armor", amount: undefined, result: "Your armour decides it has had enough." },
];

/** BRANCH_TOGGLES — the frozen, ordered list of field patches (see header). */
export const BRANCH_TOGGLES = Object.freeze(
  [...SAFETY_SCAN_TOGGLES, ...SAMPLE_OVERRIDE_TOGGLES, ...PHASE_79_TOGGLES].map((t) => Object.freeze(t)),
);

function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) deepFreeze(x);
  }
  return v;
}

// The variant payloads, built once and deep-frozen: a builder that tried to
// mutate its event would throw (ES modules are strict) and the corpus would
// record that variant under the entry's `errors`, rather than one rendering
// silently leaking into the next.
const VARIANT_PAYLOADS = Object.freeze([
  Object.freeze({ id: "base", fields: deepFreeze(structuredClone(BASE_EVENT)) }),
  ...BRANCH_TOGGLES.map((tog, i) => Object.freeze({ id: `t${i}`, fields: deepFreeze({ ...structuredClone(BASE_EVENT), ...structuredClone(tog) }) })),
]);

/**
 * variantsFor(type) — the fixed, ordered renderings of one event type:
 * `bare` (the `{ type }` alone, what the coverage guards call), `base`
 * (BASE_EVENT), then `t0`, `t1`, … (BASE_EVENT with each toggle applied).
 * Each event is a fresh top-level object over deep-frozen field values.
 */
export function variantsFor(type) {
  const out = [{ id: "bare", event: { type } }];
  for (const v of VARIANT_PAYLOADS) out.push({ id: v.id, event: { type, ...v.fields } });
  return out;
}
