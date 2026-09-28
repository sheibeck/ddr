// src/browser/heroConditions.js
//
// Phase 77 (CMBUI-13) — the ONE table of hero and party-member chips. The
// user's report (2026-09-25): "When I use the ability smoke, I have no
// indication on myself or the enemies that it's active ... Abilities and
// spells all need to have some sort of active indicator while in combat."
//
// One-table rule (mirrors src/browser/foeConditions.js): the descriptors
// come from ONE source, engine/derived.js#conditionsOf for the hero and its
// sibling #memberConditionsOf for a party member (the same shape). This
// table says, for every descriptor key those two can emit, which engine
// fields it reads, whether it shows in YOUR LOT during a fight (`fight`),
// how long it lasts (`lasts`) and where it came from (`source`). Everything
// about a chip EXCEPT its label and its explanation lives here; the label
// and the explanation stay in the shell's CONDITION_COPY/CONDITION_EXPLAIN
// (mazeworld.html), so there is still one copy table for those. Nothing
// else maps a hero effect to a chip.
//
// Coverage guard: test/unit/hero-conditions.test.js scans the engine's
// source for every field it assigns on the hero, the fight and a party
// member, and every timer id it starts. Each must be read by an entry here
// (`fields`/`timers`), shown by the foe table, or sit on the test's own
// reasoned NOT_A_CONDITION list — so a new effect with no chip fails the
// build. The engine is never edited to satisfy it.
//
// `fight` rule: an entry shows in YOUR LOT when it "changes a roll or the
// flow of this fight" (CONTEXT, CMBUI-13). Each entry's choice is noted on
// its own line.
//
// House style (Phase 71's foe chips): the label, plus " · n" when the entry
// lasts rounds and the count is a whole number above 0 ("Smoke · 2",
// "Shield · 3", "Senses"). A squares-counted effect shows its bare label in
// the fight; its sheet says how many squares are left.
//
// PRESENTATION ONLY, pure module: no DOM/window access, no timers, no rng,
// no engine imports, no mutation of a descriptor or the state. It imports
// content/abilities.js (plain data) for an ability's own name and text only.

import { ABILITY_BY_ID } from "../../content/abilities.js";

/** LASTS — every `lasts` value an entry may carry. */
// Plan 76-06 (user ruling 2026-09-26): "untilMove" is Map the Floor's window,
// which lasts until the hero's next step and carries no countdown.
export const LASTS = Object.freeze(["rounds", "squares", "fight", "nextBlow", "day", "nextFight", "untilCured", "charges", "untilMove"]);

/** SOURCES — every `source` kind an entry may carry. */
export const SOURCES = Object.freeze(["ability", "spell", "item", "foe", "scroll", "song", "fear", "insult", "dark", "trait", "mishap"]);

/**
 * HERO_CHIP_COPY — every phrase this module emits (the tap sheet's "how
 * long" and "where from" lines). `{n}`, `{max}` and `{name}` are filled in
 * by chipSheetFacts. Voice-scanned by test/unit/hero-conditions.test.js and
 * walked by test/unit/hp-not-wp.test.js.
 */
export const HERO_CHIP_COPY = Object.freeze({
  lasts: Object.freeze({
    roundsOne: "1 more round",
    roundsMany: "{n} more rounds",
    squaresOne: "1 square left",
    squaresMany: "{n} squares left",
    fight: "for the rest of this fight",
    nextBlow: "until the next blow lands",
    day: "until the day ends",
    nextFight: "until your next fight",
    // VOX-05 (79-07): an affliction also runs out on its own
    // (engine/movement.js counts c.affliction.left down per tick).
    untilCured: "until it runs its course or something cures it",
    charges: "{n} of {max} charges left",
    untilMove: "until you move",
  }),
  source: Object.freeze({
    ability: "from your {name}",
    spell: "from a spell",
    item: "from {name}",
    foe: "from a foe's power",
    scroll: "from a fumbled scroll",
    song: "from your song",
    fear: "from your fear",
    insult: "from your insult",
    dark: "from the dark",
    trait: "from your own eyes",
    mishap: "from the dungeon's hospitality",
  }),
});

/** posInt(n) — n when it is a whole number above zero, else null. */
function posInt(n) {
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** item(key, fight, lasts) — an entry for one live item-effect kind
 * (conditionsOf's generic liveItemEffects loop: key = the activation kind,
 * `source` = the item's name, read off the `item:<name>` c.timers record). */
function item(key, fight, lasts = "squares") {
  return { key, fields: ["timers"], timers: ["item:*"], fight, lasts, source: "item" };
}

/**
 * HERO_CONDITIONS — frozen, in conditionsOf's own emit order. Each entry:
 *   key      the descriptor key conditionsOf/memberConditionsOf emits
 *   fields   every engine field the entry reads (the coverage guard's list)
 *   timers   (optional) the c.timers ids it reads; "x:*" is a whole family
 *   fight    true when it shows in YOUR LOT (it changes a roll or the flow of a fight)
 *   lasts    one of LASTS (lastsFor(cn) overrides it per descriptor)
 *   source   one of SOURCES (sourceFor(cn) overrides it per descriptor)
 *   sourceName (optional) the name the source phrase fills in when the descriptor carries none
 */
export const HERO_CONDITIONS = Object.freeze(
  [
    // ── live item effects (engine/derived.js#liveItemEffects), one entry per live activation kind ──
    item("haste", true), // Cloak of Speed / Speed: a second swing each round (combat.js playerStrike).
    item("invis", true), // Cloak/staff/potion of invisibility: every foe hits only on its top face (foeToHitVs).
    item("acute", true, "rounds"), // Acuteness: strike on a d6 (strikeDie); a rounds-cadence record.
    item("ether", false), // Cloak of Ether: walking through walls, nothing in a fight.
    item("enlarge", true), // Enlarge: a size step (foeToHitVs, sizeDamage).
    item("giant", true), // Gauntlet of the Giant: a size step.
    item("glow", true), // Amulet of Light: a light that lifts the dark cap (darkWaiver).
    item("unseen", true), // Anklet of Invisibility: every foe has two fewer faces that hit (eff foeToHit).
    item("tongue", false), // Helm of Knowledge: a parley aid, nothing once blows land.
    item("critWard", true), // Cloak of Strength: a foe's critical lands on you as an ordinary hit (derived.js#critWardOf; quick 260928-cos, was "brace").
    item("plate", true), // Cloak of Armor: soaks as plate (armorSoak).
    item("power", true), // Ring of Power: +1 damage (eff dmg).
    item("lit", true), // a lit torch: lifts the dark cap in a dark fight (darkWaiver).
    item("flight", false), // Cloak of Flying / Bracelet of Flight: crossing terrain, not a fight.
    // ── duration abilities (engine/abilities.js DURATION_ROUNDS) — changes a foe's swing or your blows ──
    { key: "ability", fields: ["timers"], timers: ["ability:*"], fight: true, lasts: "rounds", source: "ability" },
    // Strength potion (a `might` item effect, with a source) or the spell's day-long c.might: more damage.
    {
      key: "might", fields: ["might", "timers"], timers: ["item:*"], fight: true, lasts: "day", source: "spell",
      lastsFor: (cn) => (typeof cn.source === "string" && cn.source ? "squares" : "day"),
      sourceFor: (cn) => (typeof cn.source === "string" && cn.source ? "item" : "spell"),
    },
    // Shield soaks blows; an armed Bubble mirror waits for one.
    { key: "ward", fields: ["ward"], fight: true, lasts: "rounds", source: "spell", lastsFor: (cn) => (cn.mirror ? "nextBlow" : "rounds") },
    { key: "mirror", fields: ["mirror"], fight: true, lasts: "rounds", source: "spell" }, // Mirror Self: every foe hits only on its top face.
    { key: "senses", fields: ["senses"], fight: true, lasts: "fight", source: "spell" }, // Sense Presence: lifts the dark cap, waives foe-first.
    { key: "regen", fields: ["regen"], fight: true, lasts: "fight", source: "spell" }, // Regeneration: heals each round.
    { key: "foresight", fields: ["foresight"], fight: false, lasts: "nextFight", source: "spell" }, // Sense Danger: waiting for the next fight.
    { key: "reveal", fields: ["timers"], timers: ["spell:reveal"], fight: false, lasts: "untilMove", source: "spell" }, // Map the Floor: the map only, until the next step (Plan 76-06).
    { key: "braced", fields: ["braced"], fight: true, lasts: "nextBlow", source: "ability", sourceName: ABILITY_BY_ID.brace?.name }, // Brace: halves the next blow.
    { key: "inspired", fields: ["inspired"], fight: true, lasts: "fight", source: "song" }, // the level-2 song: one more face on the hero's own strikes (toHit).
    { key: "halfNext", fields: ["halfNext"], fight: true, lasts: "nextBlow", source: "item", sourceName: "Pendant of Fortitude" }, // halves the next blow.
    { key: "strengthBoost", fields: ["strengthBoost"], fight: true, lasts: "day", source: "spell" }, // Strength: doubled hit points to spend.
    { key: "nightVision", fields: ["skills"], fight: true, lasts: "fight", source: "trait" }, // Night Vision: holds the dark cap back.
    { key: "itemCooldown", fields: ["timers"], timers: ["item:*"], fight: false, lasts: "squares", source: "item" }, // an item recharging: nothing live.
    { key: "staffCharges", fields: ["timers"], timers: ["charges:*"], fight: false, lasts: "charges", source: "item" }, // a staff refilling: its menu row says so.
    // ── bad ──
    { key: "affliction", fields: ["affliction"], fight: false, lasts: "untilCured", source: "mishap" }, // poison/disease tick on squares, not rounds.
    { key: "foeEffect", fields: ["foeEffect"], fight: true, lasts: "rounds", source: "foe" }, // Weakened/Dazed: your blows or your to-hit.
    { key: "darkness", fields: ["darkFor"], fight: true, lasts: "squares", source: "dark" }, // the Darkness counter: the dark cap.
    { key: "fearArmed", fields: ["fearArmed"], fight: false, lasts: "nextFight", source: "fear" }, // waiting for the next fight.
    { key: "afraid", fields: ["afraid", "phobia"], fight: true, lasts: "rounds", source: "fear" }, // −3 to hit, half damage.
    { key: "heroOut", fields: ["heroOut"], fight: true, lasts: "rounds", source: "scroll" }, // you cannot act.
    { key: "heroBlind", fields: ["heroBlind"], fight: true, lasts: "fight", source: "scroll" }, // one winning face.
    { key: "heroShrunk", fields: ["heroShrunk"], fight: true, lasts: "fight", source: "scroll" }, // your own blows halved (combat.js playerStrike).
    { key: "fightDark", fields: ["darkFor", "senses"], fight: true, lasts: "fight", source: "dark" }, // the dark cap on your to-hit.
    { key: "insulted", fields: ["parleyInsulted"], fight: true, lasts: "fight", source: "insult" }, // every foe swings better at you.
    { key: "selfDot", fields: ["selfDot"], fight: true, lasts: "rounds", source: "scroll" }, // a burn each round.
  ].map((e) => Object.freeze({ ...e, fields: Object.freeze([...e.fields]), ...(e.timers ? { timers: Object.freeze([...e.timers]) } : {}) })),
);

const BY_KEY = new Map(HERO_CONDITIONS.map((e) => [e.key, e]));

/** safe(fn, fallback) — fn(), or fallback when fn throws (a hostile getter). */
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** entryFor(cn) — the table entry for descriptor `cn`, or null. */
function entryFor(cn) {
  const key = safe(() => (cn && typeof cn === "object" ? cn.key : null), null);
  return typeof key === "string" ? BY_KEY.get(key) || null : null;
}

/** lastsOf(e, cn) — the entry's `lasts`, or its per-descriptor override. */
function lastsOf(e, cn) {
  const v = e.lastsFor ? safe(() => e.lastsFor(cn), e.lasts) : e.lasts;
  return LASTS.includes(v) ? v : e.lasts;
}

/** sourceOf(e, cn) — the entry's `source`, or its per-descriptor override. */
function sourceOf(e, cn) {
  const v = e.sourceFor ? safe(() => e.sourceFor(cn), e.source) : e.source;
  return SOURCES.includes(v) ? v : e.source;
}

/**
 * lotChips(conds) — the YOUR LOT chip models for a descriptor list (from
 * conditionsOf or memberConditionsOf): only the `fight` entries, in input
 * order, each a frozen `{ key, sub, tone, rounds, cn }`. `tone` is the
 * descriptor's polarity ("good" or "bad"); `sub` is the ability id or the
 * foeEffect/affliction/heroOut kind when present, else null; `rounds` is
 * `remaining` only when the entry lasts rounds and it is a whole number
 * above 0, else null; `cn` is the descriptor itself (for the tap sheet). A
 * non-array, an unknown key or a malformed descriptor is skipped; never
 * throws.
 */
export function lotChips(conds) {
  const out = [];
  if (!Array.isArray(conds)) return Object.freeze(out);
  for (const cn of conds) {
    const e = entryFor(cn);
    if (!e || !e.fight) continue;
    const polarity = safe(() => cn.polarity, null);
    const tone = polarity === "bad" ? "bad" : "good";
    const sub = safe(() => (typeof cn.ability === "string" ? cn.ability : typeof cn.kind === "string" ? cn.kind : null), null);
    const rounds = lastsOf(e, cn) === "rounds" ? posInt(safe(() => cn.remaining, null)) : null;
    out.push(Object.freeze({ key: e.key, sub, tone, rounds, cn }));
  }
  return Object.freeze(out);
}

/**
 * chipText(label, chip) — the house style: the label, plus " · n" when the
 * chip carries a whole-number `rounds` above 0 ("Smoke · 2"), else the bare
 * label. A non-string or empty label gives "" (no orphan " · n").
 */
export function chipText(label, chip) {
  if (typeof label !== "string" || !label) return "";
  const text = label;
  const rounds = posInt(safe(() => (chip && typeof chip === "object" ? chip.rounds : null), null));
  return rounds !== null ? `${text} · ${rounds}` : text;
}

/** fill(template, vars) — replaces each {name} with vars[name]. */
function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
}

/** lastsPhrase(kind, cn) — the "how long" phrase, or "" when its count is missing. */
function lastsPhrase(kind, cn) {
  const L = HERO_CHIP_COPY.lasts;
  if (kind === "rounds" || kind === "squares") {
    const n = posInt(safe(() => cn.remaining, null));
    if (n === null) return "";
    if (kind === "rounds") return n === 1 ? L.roundsOne : fill(L.roundsMany, { n });
    return n === 1 ? L.squaresOne : fill(L.squaresMany, { n });
  }
  if (kind === "charges") {
    const n = safe(() => cn.charges, null);
    const max = safe(() => cn.max, null);
    return Number.isInteger(n) && n >= 0 && posInt(max) !== null ? fill(L.charges, { n, max }) : "";
  }
  return typeof L[kind] === "string" ? L[kind] : "";
}

/** abilityName(id) — content/abilities.js's own name for an ability id, or null. */
function abilityName(id) {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(ABILITY_BY_ID, id)) return null;
  const a = ABILITY_BY_ID[id];
  return a && typeof a.name === "string" && a.name ? a.name : null;
}

/** sourcePhrase(kind, e, cn) — the "where from" phrase, or "" when a name it needs is missing. */
function sourcePhrase(kind, e, cn) {
  const S = HERO_CHIP_COPY.source;
  if (kind === "ability") {
    const name = abilityName(safe(() => cn.ability, null)) || e.sourceName || null;
    return name ? fill(S.ability, { name }) : "";
  }
  if (kind === "item") {
    const fromCn = safe(() => (typeof cn.source === "string" && cn.source ? cn.source : typeof cn.item === "string" && cn.item ? cn.item : null), null);
    const name = fromCn || e.sourceName || null;
    return name ? fill(S.item, { name }) : "";
  }
  return typeof S[kind] === "string" ? S[kind] : "";
}

/**
 * chipSheetFacts(cn) — the tap sheet's facts for descriptor `cn`, frozen
 * `{ lasts, source, detail }`: `lasts` and `source` are HERO_CHIP_COPY
 * phrases ("2 more rounds", "from your Smoke"); `detail` is the ability's
 * own content text (content/abilities.js ABILITY_BY_ID[id].txt, the one
 * mechanical description of an ability) for an `ability` chip, "" otherwise.
 * Malformed input returns empty strings; never throws.
 */
export function chipSheetFacts(cn) {
  const empty = Object.freeze({ lasts: "", source: "", detail: "" });
  const e = entryFor(cn);
  if (!e) return empty;
  return safe(() => {
    const lasts = lastsPhrase(lastsOf(e, cn), cn);
    const source = sourcePhrase(sourceOf(e, cn), e, cn);
    let detail = "";
    if (e.key === "ability") {
      const id = cn.ability;
      const a = typeof id === "string" && Object.prototype.hasOwnProperty.call(ABILITY_BY_ID, id) ? ABILITY_BY_ID[id] : null;
      detail = a && typeof a.txt === "string" ? a.txt : "";
    }
    return Object.freeze({ lasts, source, detail });
  }, empty);
}
