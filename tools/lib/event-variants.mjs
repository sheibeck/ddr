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
//   5. Two corrections so a synthetic event reads like a real one:
//      TYPE_FIELDS (per-type field shapes, where the shared base's `item`
//      object would print "[object Object]") and `only` (a toggle scoped to
//      the types whose field it really is, e.g. Table 4's negative amount).
//
// Everything this corpus reports for a builder is rendered from these
// synthetic events, so an odd reading can be an artifact of a field value
// no real event carries; each check's calibration (tools/lib/
// voice-checks.mjs, the 79-01 SUMMARY) records the artifacts it met.
//
// FROZEN AFTER 79-01 (79-12 appended three `only`-scoped toggles at the
// end of the list; see PHASE_79_TOGGLES). The phase-base snapshot
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
  // User rulings 2026-09-28: a Freeze's post-damage resist and its d4 hold
  // (scoped, so no other type's line list moves).
  { only: ["spellResisted", "controlHeld"], freeze: true }, { only: ["controlHeld"], freeze: true, rounds: 1 },
  // encounterRolled's own table cell: the Table 4 rows print their cell
  // verbatim at the base ("The dice decide — -15 HP."). Scoped (`only`): on
  // any other type the cell would land in an unrelated `result` field.
  { only: ["encounterRolled"], table: 4, result: "-15 HP" }, { only: ["encounterRolled"], table: 4, result: "+25 XP" },
  // Wave-1 sibling 79-02's additive fields (the builders at the base ignore
  // them; once 79-02 lands they select its honest gain and Table 4 lines).
  // The Table 4 rows are scoped to tableFour: a negative `amount` means
  // something only there.
  { amount: 8, gained: 8 }, { amount: 8, gained: 3 }, { amount: 8, gained: 0 },
  { only: ["tableFour"], row: "-15 HP", stat: "hp", amount: -19, result: "The maze extracts a toll you did not agree to." },
  { only: ["tableFour"], row: "+10 HP", stat: "hp", amount: 3, result: "Something in the air knits you back together." },
  { only: ["tableFour"], row: "+25 HP", stat: "maxHp", amount: 21, result: "You feel sturdier than you have any right to." },
  { only: ["tableFour"], row: "+10 XP", stat: "xp", amount: 50, result: "You learn something, against your will." },
  { only: ["tableFour"], row: "-All armour", stat: "armor", amount: undefined, result: "Your armour decides it has had enough." },
  // 79-12 (the one plan allowed to extend this list; appended, so every
  // earlier toggle keeps its id): branches later plans added that no toggle
  // reached. A store meal capped at full HP (79-02's `gained` below the
  // meal's `meal` portion: "(worth 8, back to full)"), and 79-11's
  // darknessFell duration and Night Vision clauses (engine/encounters.js
  // #fallDark stamps `duration` and `nightVision`).
  { only: ["bought"], gained: 3, meal: 8 },
  { only: ["darknessFell"], duration: 30, nightVision: false },
  { only: ["darknessFell"], duration: 30, nightVision: true },
  // Quick 260927-rsx / 260927-opf (user rulings 2026-09-27), appended so every
  // earlier toggle keeps its id: a Joiner's cast being resisted (the resist
  // lines name the caster), a Weaken some foes resisted (`spared`), and a
  // spent once-per-fight ability's refusal — so the voice guards read them.
  { only: ["spellResisted", "resistFailed"], by: "Ada", spell: "Fireball" },
  { only: ["weakened"], spared: 1 },
  { only: ["abilityRefused"], reason: "spent", name: "Feint" },
  // Quick 260928-nrf (user rulings 2026-09-28), appended so every earlier
  // toggle keeps its id: Sweep refused with one living foe, a missed Kata
  // and Feint (a touchable foe: the shared base is untouchable), and a
  // Joiner's resist naming the Joiner — so the voice guards read them.
  { only: ["abilityRefused"], reason: "tooFewFoes", name: "Sweep", need: 2, have: 1 },
  { only: ["strikeMissed"], untouchable: false, via: "kata", mods: [{ name: "Kata", delta: 3 }] },
  { only: ["strikeMissed"], untouchable: false, via: "feint", mods: [{ name: "Feint", delta: 3 }] },
  { only: ["memberResisted", "memberResistFailed"], member: "Ada", intel: 10, roll: 16, atLeast: 16, dieN: 20, faces: 5 },
  // Phase 91 plan 06 (IDENT-17), appended so every earlier toggle keeps its id: the
  // Bard's once-per-fight refusal and a sung title with its spell.
  { only: ["actionRefused"], reason: "sungThisFight" },
  { only: ["sang"], title: "An Ode to Freeze", spell: "Freeze", level: 1 },
  // Phase 91 plan 07 (IDENT-17, the Joiner half), appended so every earlier toggle keeps
  // its id: the shared base event carries `member`, so a Joiner Bard's own forms are the
  // default rendering and `member: null` is the hero's; these four reach the forms the
  // base's `mirror: true` and non-restarted defaults never do (a plain Shield ward and a
  // restarted Strength, for a Joiner and for the hero), so the voice guards read them.
  { only: ["wardRaised"], mirror: false, spell: "Shield", pool: 50 },
  { only: ["wardRaised"], mirror: false, spell: "Shield", pool: 50, member: null },
  { only: ["strengthCast"], restarted: true, squares: 100 },
  { only: ["strengthCast"], restarted: true, squares: 100, member: null },
  // Phase 91.1 plan 02 (user ruling V5, 2026-10-01), appended so every earlier toggle keeps
  // its id: Hamstring refused on a foe that already carries it (the target comes from the
  // event), so the voice guards read the new `alreadyOn` refusal.
  { only: ["abilityRefused"], reason: "alreadyOn", name: "Hamstring", target: "Goblin" },
  // Phase 91.1 plan 03 part B (user ruling V7 B, 2026-10-01), appended so every earlier toggle keeps
  // its id: the Bard's second song is refused while it is still resting (rounds left from the event).
  { only: ["actionRefused"], reason: "songResting", rounds: 3 },
];

/**
 * TYPE_FIELDS — per-type field shapes applied over BASE_EVENT (before any
 * toggle) where the safety scan's shared base disagrees with what the engine
 * really emits. BASE_EVENT's `item` is an object (`{ n }`, the loot and
 * equip events' shape), but these types carry the item's NAME as a string
 * (engine/economy.js#buy, engine/items.js's activation ticks and the Pilfer
 * fumble), so without this every rendering of them would read
 * "[object Object]".
 */
export const TYPE_FIELDS = Object.freeze({
  bought: Object.freeze({ item: "Rope" }),
  itemCooled: Object.freeze({ item: "Ring of Power" }),
  itemEffectFaded: Object.freeze({ item: "Cloak of Speed" }),
  itemEffectStarted: Object.freeze({ item: "Cloak of Speed" }),
  pilferFumbled: Object.freeze({ item: "Wand of Sparks" }),
  // rationsEaten carries `eats` (engine/movement.js#newDay); the shared base only has it inside `eaters`.
  rationsEaten: Object.freeze({ eats: 1 }),
  staffRecharged: Object.freeze({ item: "Crystal Staff" }),
});

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

// The toggle patches without their `only` scope, deep-frozen once: a builder
// that tried to mutate its event would throw (ES modules are strict) and the
// corpus would record that variant under the entry's `errors`, rather than
// one rendering silently leaking into the next.
const PATCHES = Object.freeze(
  BRANCH_TOGGLES.map((tog, i) => {
    const { only, ...fields } = tog;
    return Object.freeze({ id: `t${i}`, only: only ?? null, fields: deepFreeze(structuredClone(fields)) });
  }),
);
const FROZEN_BASE = deepFreeze(structuredClone(BASE_EVENT));

/**
 * variantsFor(type) — the fixed, ordered renderings of one event type:
 * `bare` (the `{ type }` alone, what the coverage guards call), `base`
 * (BASE_EVENT plus the type's TYPE_FIELDS), then `t0`, `t1`, … (that base
 * with each toggle applied). A toggle scoped with `only` is skipped for
 * every other type; the ids keep the toggle's index either way. Each event
 * is a fresh top-level object over deep-frozen field values.
 */
export function variantsFor(type) {
  const typeFields = TYPE_FIELDS[type] ?? {};
  const out = [{ id: "bare", event: { type } }, { id: "base", event: { type, ...FROZEN_BASE, ...typeFields } }];
  for (const p of PATCHES) {
    if (p.only && !p.only.includes(type)) continue;
    out.push({ id: p.id, event: { type, ...FROZEN_BASE, ...typeFields, ...p.fields } });
  }
  return out;
}
