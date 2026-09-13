// engine/character.js
//
// RNG-injected, pure character generation, skills, grimoire and leveling
// (ENG-01, ENG-02, ENG-05). Ports the prototype's rollCharacter/rollSkills/
// rollGrimoire/nameFor (mazeworld.html lines 1042-1111, 613-627, 890-909,
// 1164) and checkLevel (lines 2438-2474), replacing every Math.random()-backed
// D()/pick()/shuffle() with the injected seeded rng (engine/rng.js) and every
// content dice-closure with the pure `{n,sides,bonus}` notation resolved via
// engine/dice.js. The prototype's `if(log)` narration is dropped here — the
// engine returns data; presentation (and, for leveling, structured events)
// consume it. No global S, no DOM, no Math.random.
//
// The RNG-consumption ORDER is preserved verbatim from the prototype so that
// the same seed rolls a byte-identical adventurer (see the chargen-parity
// test): class d6 → subclass d8 → race d8 → Fridgian/Samurai reroll → intel
// d20 → baseWP roll → rollSkills shuffle → phobia d10 → temperament d12 →
// motive d12 → potions d6 (MU) → cloak d8 (Thief) → grimoire (MU) → name pick.

import { rollDice } from "./dice.js";
import { leveled } from "./events.js";
import { canLearn, schoolGate, levelFromSP, clampCarry } from "./derived.js";
import {
  CLASSES,
  RACES,
  RACE_D8,
  KIT,
  FREE_SKILL,
  FIGHTER_SKILLS,
  THIEF_SKILLS,
  ARMORS,
  PHOBIAS,
  TEMPERAMENTS,
  MOTIVES,
  CLOAKS,
  NAMES,
  SPELLS,
} from "../content/index.js";

/** skillTable(cls) — the special-skill pool for a class (Magic Users have none). */
function skillTable(cls) {
  return cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : null;
}

/**
 * rollSkills(rng, draft) — spends value points across a shuffled skill pool,
 * then raises any up-skill it can still afford. Mutates draft.skills/draft.vp.
 * Ports mazeworld.html rollSkills() (lines 613-627). Magic Users take the
 * early no-table return (no shuffle → no rng draw), matching the prototype.
 */
export function rollSkills(rng, c) {
  c.skills = {};
  const table = skillTable(c.cls);
  if (FREE_SKILL[c.sub] && table && table[FREE_SKILL[c.sub]]) c.skills[FREE_SKILL[c.sub]] = 1;
  if (!table) {
    c.vp = 0;
    return;
  }
  let vp = c.cls === "Fighter" ? 8 : 12;
  const pool = Object.keys(table).filter((k) => !c.skills[k]);
  rng.shuffle(pool);
  for (const n of pool) if (table[n].cost <= vp) { c.skills[n] = 1; vp -= table[n].cost; }
  for (const n of Object.keys(c.skills)) {
    const sk = table[n];
    if (sk && sk.up && sk.up <= vp && c.skills[n] === 1) { c.skills[n] = 2; vp -= sk.up; }
  }
  c.vp = vp;
}

/**
 * rollGrimoire(rng, sub) — d10 spells (minimum 4) drawn from what the subclass
 * may ever learn, with the subclass "must-have" grants and the first-day
 * usability top-up. Ports mazeworld.html rollGrimoire() (lines 890-909).
 */
export function rollGrimoire(rng, sub) {
  const pool = SPELLS.filter((sp) => canLearn(sub, sp));
  const low = pool.filter((sp) => sp.lvl <= 2),
    high = pool.filter((sp) => sp.lvl > 2);
  rng.shuffle(low);
  rng.shuffle(high);
  const n = Math.max(4, rng.d(10));
  const book = [];
  for (const sp of low) { if (book.length < Math.min(n, 6)) book.push(sp.n); }
  for (const sp of high) { if (book.length < n) book.push(sp.n); }
  if (sub === "Cleric") for (const n2 of ["Heal", "Major Heal"]) if (!book.includes(n2)) book.push(n2);
  if (sub === "Illusionist") for (const n2 of ["Mirror Self", "Phantom Host"]) if (!book.includes(n2)) book.push(n2);
  if (sub === "Summoner" && !book.includes("Summon")) book.push("Summon");
  if (sub === "Sorcerer") for (const n2 of ["Freeze", "Fireball"]) if (!book.includes(n2)) book.push(n2);
  // you must be able to actually do something on your first day
  const usableNow = (sp) => sp.lvl === 1 && schoolGate(sub, sp.s) <= 1;
  const ready = () => book.filter((n2) => usableNow(SPELLS.find((sp) => sp.n === n2))).length;
  const spare = pool.filter(usableNow);
  rng.shuffle(spare);
  for (const sp of spare) { if (ready() >= 2) break; if (!book.includes(sp.n)) book.push(sp.n); }
  return book;
}

/**
 * nameFor(rng, race, exclude) — a random GENERATIVE name for the race
 * (DR-name-generator, 2026-09-09). Replaces the prototype's `pick(NAMES[r])`
 * over a ~3-entry flat pool with a first × surname combination over the new
 * { first, sur } banks in content/names.js, yielding hundreds of distinct
 * names per race so runs stop colliding (the device-review "duplicate names"
 * complaint) and the E12 recent-name dedup no longer exhausts the pool.
 *
 * DETERMINISM CONTRACT (unchanged from the flat-pool version): this makes
 * EXACTLY ONE rng draw — a single `rng.d(combos)`, which consumes exactly one
 * `gen.next()`, identical to the old single `rng.pick(...)` (see engine/rng.js:
 * both d() and pick() draw once). So the rng cursor advances IDENTICALLY and
 * every SUBSEQUENT chargen field (stats, weapon, armor, gold, grimoire, …)
 * stays byte-identical to the frozen prototype. ONLY the resulting `c.name`
 * changes — an intentional COSMETIC divergence carved out of the chargen
 * parity comparators (test/parity/chargen-parity.test.js, full-suite.test.js).
 * NEVER add a second draw (picking first AND surname separately would be two
 * draws and would shift every following field, breaking parity everywhere).
 *
 * The index `i` in [0, combos) is decoded into a (first, sur) pair; an empty
 * surname entry ("") renders as a bare mononym. When the built name is in
 * `exclude`, it walks FORWARD deterministically (i = (i+1) % combos, rebuild)
 * to the first non-excluded name, consuming NO further rng; if every combo is
 * excluded it falls back to the originally-built name. Same one-draw-then-
 * no-rng-walk contract as the E12 flat-pool version.
 */
export const nameFor = (rng, r, exclude = []) => {
  const pool = NAMES[r] || NAMES.Human;
  const combos = pool.first.length * pool.sur.length;
  let i = rng.d(combos) - 1; // the ONE and ONLY rng draw (one gen.next())
  const build = (idx) => {
    const first = pool.first[idx % pool.first.length];
    const sur = pool.sur[Math.floor(idx / pool.first.length)];
    return sur ? first + " " + sur : first;
  };
  const name = build(i);
  if (!exclude || exclude.length === 0) return name;
  const excluded = new Set(exclude);
  if (!excluded.has(name)) return name;
  // no-rng deterministic forward walk over the combo space
  for (let step = 1; step < combos; step++) {
    const cand = build((i + step) % combos);
    if (!excluded.has(cand)) return cand;
  }
  return name; // every combo excluded — fall back to the originally-built name
};

/**
 * rollCharacter(rng) — the 100%-dice-rolled adventurer. Consumes the injected
 * rng in the exact order of the prototype (see the module header) and returns
 * the plain, serializable character object. No player choice, no logging.
 * Ports mazeworld.html rollCharacter() (lines 1042-1111) sans its `if(log)`
 * narration branch.
 *
 * `exclude` (audit-batch E12, part 4) is an optional, additive recent-names
 * list threaded in from the NON-engine persistence layer (the adapter reads it
 * from storage on a fresh roll). It is forwarded UNCHANGED to nameFor as the
 * very last chargen step and only affects which name is chosen — never the rng
 * draw count or order — so `rollCharacter(rng)` with no/empty `exclude` stays
 * byte-identical to the prototype and the parity suite needs no carve-out.
 */
export function rollCharacter(rng, exclude = []) {
  const cd = rng.d(6);
  const cls = cd <= 2 ? "Magic User" : cd <= 4 ? "Fighter" : "Thief";
  let sd = rng.d(8);
  let sub = CLASSES[cls].subs[sd - 1];
  const rd = rng.d(8);
  const race = RACE_D8[rd - 1];
  // "You cannot be a Fridgian Samurai because Fridges don't wear any armor."
  while (race === "Fridgian" && sub === "Samurai") { sd = rng.d(8); sub = CLASSES[cls].subs[sd - 1]; }
  const R = RACES[race];
  const intel = rng.d(20);

  // baseWP is `{ base, dice }`; a flat class (Thief) uses a zero dice notation
  // (rollDice draws nothing), so Thief consumes no die here — matching the
  // prototype's `baseWP: () => 40`.
  let maxWP = R.flatWP ? R.flatWP : CLASSES[cls].baseWP.base + rollDice(rng, CLASSES[cls].baseWP.dice);
  if (R.wpMul) maxWP = Math.round(maxWP * R.wpMul);

  const [wpn, prof] = KIT[sub];
  const draft = { cls, sub };
  rollSkills(rng, draft);

  // Starting armour is issued with the kit, not bought.
  let armor = { name: "Nothing", ar: 0, wp: 0, min: 0, cost: 0, cls: "FTM" };
  if (!R.noArmor) {
    const byName = (n) => ARMORS.find((a) => a.name === n);
    if (sub === "Samurai") armor = byName("Plate");
    else if (sub === "Cleric") armor = byName("Mail");
    else if (sub === "Woodsman") armor = byName("Leather");
    else if (cls === "Fighter") armor = byName("Studded");
    else if (cls === "Thief") armor = byName("Leather");
    else armor = byName("Cloth");
  }

  const ph = PHOBIAS[rng.d(10) - 1];
  const c = {
    cls, sub, race, intel, level: 1, sp: 0,
    maxWP, wp: maxWP,
    skills: draft.skills, vp: draft.vp,
    weapon: wpn, prof, magicWpn: sub === "Samurai" ? 2 : 0,
    armor: armor.name, ar: armor.ar, armorMin: armor.min,
    armorWP: armor.wp, armorMax: armor.wp, patches: 0,
    temperament: TEMPERAMENTS[rng.d(12) - 1],
    motive: MOTIVES[rng.d(12) - 1],
    phobia: ph.n, phobiaType: ph.t,
    potions: cls === "Magic User" ? rng.d(6) : cls === "Thief" ? 2 : 1,
    rations: cls === "Fighter" ? 6 : cls === "Thief" ? 5 : 4,
    gold: 50,
    scrolls: cls === "Magic User" ? 1 : 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: cls === "Thief" ? [Object.assign({ kind: "cloak" }, CLOAKS[rng.d(8) - 1])] : [],
    grimoire: cls === "Magic User" ? rollGrimoire(rng, sub) : [],
    spellsUsed: 0, kills: 0, might: 0, ward: null, regen: false, mirror: 0, foresight: false,
    // DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): a brand-new
    // field with no prototype-side equivalent — the persistent darkness
    // counter (see engine/encounters.js fallDark and engine/derived.js
    // inDark). Initialized to 0 alongside the other 0/null chargen scalars
    // so the save shape stays clean; this is a plain assignment, so it adds
    // NO chargen rng draw and does not shift the rng-consumption order the
    // chargen-parity/determinism suites depend on.
    darkFor: 0,
    // DELIBERATE RULES CHANGE (audit-batch1, 2026-09-09, A2): two brand-new
    // fields backing the Cloak of Flying's real charge/cooldown resource
    // (see engine/derived.js's isFlying and engine/movement.js's climb/gorge
    // block + per-step tick) — a 20-square active-flight charge
    // (`flightLeft`) and, once that charge is spent, a 50-square cooldown
    // (`flightCooldown`) before the cloak is ready again. Both start at 0
    // ("no banked charge, no cooldown running" = ready-to-activate) for
    // EVERY character, whether or not they end up ever carrying the cloak —
    // plain assignments alongside darkFor above, so this adds NO chargen rng
    // draw and does not shift the rng-consumption order the chargen-parity/
    // determinism suites depend on. The Bracelet of Flight never reads or
    // writes either field (it grants unconditional flight regardless).
    flightLeft: 0,
    flightCooldown: 0,
    // ECON-01 (Phase 12, Economy A): the carry-capacity bag tier, a plain
    // string key into content/bags.js's BAGS. Assigned by class per rulebook
    // p.10 — Magic User = "small", Fighter = "medium", Thief = "small". This
    // is a PLAIN ASSIGNMENT off the already-rolled `cls` (NO rng draw),
    // placed alongside the darkFor/flightLeft/flightCooldown plain scalars
    // above and deliberately NOT interleaved with any rng.d()/rng.pick()
    // call, so the chargen rng-consumption order the chargen-parity/
    // determinism suites pin is completely untouched. Carried out of the
    // parity comparators (stripBagField) the same way name/darkFor/flight are.
    bag: cls === "Fighter" ? "medium" : "small",
  };
  c.name = nameFor(rng, race, exclude);
  // ECON-01 (Phase 12): enforce the freshly-assigned bag's caps at a SAFE,
  // provably no-op site — a chargen character (gold 50, rations ≤ 6, items 0-1)
  // is always under every bag tier's caps, and clampCarry only ever SHRINKS an
  // over-cap value, so this never mutates a fresh sheet and adds no rng draw.
  // (Phase 13 wires clampCarry into the real gated find/keep/drop handlers.)
  clampCarry(c);
  return c;
}

/**
 * checkLevel(state, rng, events) — raises the character's level while sp keeps
 * crossing THRESHOLDS, applying the Soldier→Knight, Apprentice-reveal and
 * Sorcerer spell-gain/forget rules, and pushing a `leveled` event per level.
 * Ports mazeworld.html checkLevel() (lines 2438-2474); the prototype's say()
 * narration becomes structured events. Mutates state.c; returns `events`.
 */
export function checkLevel(state, rng, events = []) {
  const c = state.c;
  const nl = levelFromSP(c.sp);
  while (nl > c.level) {
    c.level++;
    const R = RACES[c.race];
    const gain = rollDice(rng, CLASSES[c.cls].gain[c.level - 1]);
    const add = R.wpMul ? Math.round(gain * R.wpMul) : gain;
    c.maxWP += add;
    c.wp += add;
    events.push(leveled(c.level, add));

    // a Soldier is made a Knight at three; an Apprentice finally becomes something
    if (c.sub === "Soldier" && c.level >= 3) {
      c.sub = "Knight";
      [c.weapon, c.prof] = KIT["Knight"];
    } else if (c.sub === "Apprentice" && c.level >= 3) {
      let ns;
      do {
        ns = CLASSES["Magic User"].subs[rng.d(8) - 1];
      } while (ns === "Apprentice");
      c.sub = ns;
      c.grimoire = c.grimoire.filter((n2) => canLearn(ns, SPELLS.find((sp) => sp.n === n2) || { s: "offense" }));
    }
    if (c.sub === "Sorcerer") {
      const fresh = SPELLS.filter((sp) => canLearn("Sorcerer", sp) && !c.grimoire.includes(sp.n));
      rng.shuffle(fresh);
      const got = fresh.slice(0, 2).map((sp) => sp.n);
      c.grimoire.push(...got);
      if (rng.d(8) === 1) {
        const nonFire = c.grimoire.filter((n2) => !["Fireball", "Freeze", "Lightning"].includes(n2));
        if (nonFire.length) {
          const lost = rng.pick(nonFire);
          c.grimoire = c.grimoire.filter((n2) => n2 !== lost);
        }
      }
    }
  }
  return events;
}
