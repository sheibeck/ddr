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
//
// Phase 22 (HARN-01): rollCharacter's optional third argument, `force`, is a
// DEV-ONLY harness seam (precedent: Phase 21 D-13/D-14's newRun `startDepth`
// option) that substitutes the RESULTS of the first three draws — class d6,
// sub d8, race d8 — while still CONSUMING those draws exactly as before. So
// every later chargen draw (intel, baseWP, skills shuffle, phobia,
// temperament, motive, potions, cloak, grimoire, name) sits at the identical
// rng cursor whether or not a combo was forced, and a forced combo that a
// seed also rolls naturally is byte-identical to the natural roll. `force`
// is `null`/omitted by every real caller — the default path is completely
// untouched.

import { rollDice } from "./dice.js";
import { leveled } from "./events.js";
import { canLearn, schoolGate, levelFromSP, clampCarry, spellLevelFor, isAttackSpell } from "./derived.js";
import { derivedRng } from "./rng.js";
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
  ABILITY_BY_ID,
  ABILITY_POOL,
} from "../content/index.js";

/** skillTable(cls) — the special-skill pool for a class (Magic Users have none). */
function skillTable(cls) {
  return cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : null;
}

/** The only keys `force` may carry (Phase 22, HARN-01). */
const FORCE_KEYS = new Set(["cls", "sub", "race"]);

/**
 * normalizeForce(force) — dev-only `force` validator for rollCharacter
 * (Phase 22, HARN-01). `null`, `undefined`, or an object with no own keys
 * means "no forcing" and returns `null` (the default natural-roll path).
 * Otherwise every present key must be an exact CANONICAL string:
 *   - `cls` must be a key of CLASSES.
 *   - `sub` must be a member of CLASSES[cls].subs when `cls` is also given;
 *     when `cls` is omitted, `cls` is INFERRED as the unique class whose
 *     `subs` array contains `sub`.
 *   - `race` must be a key of RACES.
 * Case-insensitive matching is NOT done here — canonical keys only (a
 * friendly CLI resolver lives in the harness, Plan 22-03). Any unknown key,
 * non-string value, or unresolvable/mismatched name throws an Error naming
 * the offending value and the valid keys. A resolved `race === "Fridgian"`
 * together with a resolved `sub === "Samurai"` throws — that combo is
 * canon-impossible ("Fridges don't wear any armor") and the caller must omit
 * that cell rather than have it silently rerolled.
 *
 * @param {{cls?: string, sub?: string, race?: string}|null|undefined} force
 * @returns {{cls?: string, sub?: string, race?: string}|null}
 */
function normalizeForce(force) {
  if (force == null) return null;
  const keys = Object.keys(force);
  if (keys.length === 0) return null;
  for (const k of keys) {
    if (!FORCE_KEYS.has(k)) {
      throw new Error(`rollCharacter force: unknown key "${k}" — valid keys are cls, sub, race`);
    }
  }
  let { cls, sub, race } = force;

  if (cls !== undefined) {
    if (typeof cls !== "string" || !Object.prototype.hasOwnProperty.call(CLASSES, cls)) {
      throw new Error(
        `rollCharacter force.cls: ${JSON.stringify(cls)} is not a valid class — valid classes are ${Object.keys(CLASSES).join(", ")}`,
      );
    }
  }

  if (sub !== undefined) {
    if (typeof sub !== "string") {
      throw new Error(`rollCharacter force.sub: must be a string — got ${typeof sub}`);
    }
    if (cls !== undefined) {
      if (!CLASSES[cls].subs.includes(sub)) {
        throw new Error(
          `rollCharacter force.sub: ${JSON.stringify(sub)} is not a valid subclass of ${cls} — valid subs are ${CLASSES[cls].subs.join(", ")}`,
        );
      }
    } else {
      const owner = Object.keys(CLASSES).find((c) => CLASSES[c].subs.includes(sub));
      if (!owner) {
        const allSubs = Object.values(CLASSES).flatMap((c) => c.subs);
        throw new Error(
          `rollCharacter force.sub: ${JSON.stringify(sub)} is not a valid subclass of any class — valid subs are ${allSubs.join(", ")}`,
        );
      }
      cls = owner;
    }
  }

  if (race !== undefined) {
    if (typeof race !== "string" || !Object.prototype.hasOwnProperty.call(RACES, race)) {
      throw new Error(
        `rollCharacter force.race: ${JSON.stringify(race)} is not a valid race — valid races are ${Object.keys(RACES).join(", ")}`,
      );
    }
  }

  if (race === "Fridgian" && sub === "Samurai") {
    throw new Error(
      `rollCharacter force: cannot force a Fridgian Samurai — "Fridges don't wear any armor." Omit this cell from the harness.`,
    );
  }

  return { cls, sub, race };
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
 * LEGACY_SKILL_RENAMES — Phase 38 (ABIL-02) tolerant-load rename map: a
 * pre-phase `c.skills` key the table reshape CONVERTED into an active whose
 * name also changed, keyed by class. The tier value (1 or, for an up-skill,
 * 2) is preserved across the rename. Fighter Kata and Thief Silence->Silent
 * Step/Kata->Feint conversions that keep or lose their name entirely are
 * handled directly by splitTableAbilities (a converted key that already
 * matches its new table position, or one migrateLegacySkills renames first)
 * — this map only covers the two Fighter names that actually changed
 * (Death-touch/Agility) plus the two Thief names that changed (Kata/Silence).
 */
export const LEGACY_SKILL_RENAMES = Object.freeze({
  Fighter: Object.freeze({ "Death-touch": "Death Touch", "Agility": "Sidestep" }),
  Thief: Object.freeze({ "Kata": "Feint", "Silence": "Silent Step" }),
});

/** DROPPED_SKILLS — Phase 38 (ABIL-02): table keys the reshape removed
 * outright (no replacement, no rename) — Language, Tracking, Climbing,
 * Leaping. Present on both FIGHTER_SKILLS and THIEF_SKILLS pre-phase. */
export const DROPPED_SKILLS = Object.freeze(["Language", "Tracking", "Climbing", "Leaping"]);

/**
 * migrateLegacySkills(c) — Phase 38 (ABIL-02) tolerant-load pass for an old
 * save's `c.skills`: renames a key per LEGACY_SKILL_RENAMES[c.cls]
 * (preserving its tier value), then deletes any DROPPED_SKILLS key. A no-op
 * on a `c` with no skills table at all (Magic User) or a `c.skills` that is
 * already new-format (no legacy key present, so no rename/delete fires).
 * Mutates and returns `c`.
 */
export function migrateLegacySkills(c) {
  if (!c || !c.skills || typeof c.skills !== "object") return c;
  const renames = LEGACY_SKILL_RENAMES[c.cls];
  if (renames) {
    for (const [oldKey, newKey] of Object.entries(renames)) {
      if (Object.prototype.hasOwnProperty.call(c.skills, oldKey)) {
        c.skills[newKey] = c.skills[oldKey];
        delete c.skills[oldKey];
      }
    }
  }
  for (const dropped of DROPPED_SKILLS) delete c.skills[dropped];
  return c;
}

/**
 * splitTableAbilities(c) — Phase 38 (ABIL-01/02): moves every `c.skills` key
 * whose table entry carries an `active` marker into `c.abilities` (created
 * as `[]` if missing), in `c.skills` key insertion order, deleting the key
 * from `c.skills` as it goes. `c.vp` is untouched. Idempotent (a second call
 * finds no more active keys left in `c.skills` to move). A no-op for a
 * class with no table (Magic User). Mutates and returns `c`.
 */
export function splitTableAbilities(c) {
  if (!c) return c;
  if (!Array.isArray(c.abilities)) c.abilities = [];
  const table = skillTable(c.cls);
  if (!table || !c.skills) return c;
  for (const key of Object.keys(c.skills)) {
    const entry = table[key];
    if (entry && entry.active) {
      if (!c.abilities.includes(entry.active)) c.abilities.push(entry.active);
      delete c.skills[key];
    }
  }
  return c;
}

/**
 * rollPoolAbility(c, base, level) — Phase 38 (ABIL-01/03): rolls ONE
 * still-unowned id from `ABILITY_POOL[c.cls]` via a DERIVED stream keyed
 * `${base}:abilities:${level}` (engine/rng.js#derivedRng) — never the run's
 * main rng, so this can never move a seeded chargen/run cursor. Pushes the
 * rolled id onto `c.abilities` (created as `[]` if missing) and returns it;
 * returns `null` (no push) when `c.cls` has no pool (Magic User) or every
 * pool id is already owned.
 */
export function rollPoolAbility(c, base, level) {
  const pool = ABILITY_POOL[c.cls];
  if (!pool) return null;
  if (!Array.isArray(c.abilities)) c.abilities = [];
  const open = pool.filter((id) => !c.abilities.includes(id));
  if (open.length === 0) return null;
  const id = derivedRng(base, "abilities", level).pick(open);
  c.abilities.push(id);
  return id;
}

/**
 * grantLevelAbilities(c, base, upToLevel) — Phase 38 (ABIL-01/03): calls
 * rollPoolAbility for every level 1..upToLevel (in order), returning the
 * array of ids actually added (shorter than `upToLevel` once the pool is
 * exhausted; empty for a Magic User). The level-1 call is the SC-3
 * guarantee (engine/state.js#newRun); a real climb's later levels reuse this
 * same helper one level at a time via rollPoolAbility directly
 * (engine/character.js#checkLevel).
 */
export function grantLevelAbilities(c, base, upToLevel) {
  const added = [];
  for (let lvl = 1; lvl <= upToLevel; lvl++) {
    const id = rollPoolAbility(c, base, lvl);
    if (id) added.push(id);
  }
  return added;
}

/**
 * ensureAbilities(c, base) — Phase 38 (ABIL-02) tolerant-load entry point
 * (engine/saveState.js): when `c.abilities` is missing or not an array (a
 * pre-phase save, or a tampered non-array value), rebuilds it deterministically
 * — `migrateLegacySkills` then `splitTableAbilities` then
 * `grantLevelAbilities(c, base, c.level || 1)` — so the character ends up
 * with exactly the abilities a fresh roll at its current level would have
 * granted. A no-op when `c.abilities` is already an array (never re-derives
 * a save that has already been migrated). Mutates and returns `c`.
 */
export function ensureAbilities(c, base) {
  if (!c) return c;
  if (!Array.isArray(c.abilities)) {
    c.abilities = [];
    migrateLegacySkills(c);
    splitTableAbilities(c);
    grantLevelAbilities(c, base, c.level || 1);
  }
  return c;
}

/**
 * rollGrimoire(rng, sub) — d10 spells (minimum 4) drawn from what the subclass
 * may ever learn, with the subclass "must-have" grants, the first-day
 * usability top-up, and (Phase 23, IDENT-02) a guaranteed day-one ATTACK
 * spell. Ports mazeworld.html rollGrimoire() (lines 890-909); the prototype
 * only ever guaranteed "two usable-now spells" of ANY kind, so an Apprentice
 * could roll Heal + Strength and be unable to hurt anything on day one.
 *
 * ZERO-DRAW GUARANTEE (FID-06): both the low/high pool shuffles and the
 * `spare` shuffle below consume EXACTLY the same rng draws as before this
 * phase — the attack top-up walks the ALREADY-shuffled `spare` array in its
 * existing order and never calls `rng.shuffle`/`rng.d`/`rng.pick` itself. See
 * test/unit/chargen-rng-pin.test.js (pinned pre-Phase-23) and
 * test/unit/guaranteed-attack-spell.test.js (zero-draw proof, this phase).
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
  //
  // DELIBERATE: `dayOnePool` (the `spare` POOL predicate, below) stays the
  // byte-identical pre-Phase-23 test (`sp.lvl === 1 && schoolGate(sub,
  // sp.s) <= 1`) — it must NEVER be routed through spellLevelFor. The
  // planner measured that letting the override table widen this pool
  // (e.g. adding Summon/Phantom Host to a Summoner's/Illusionist's `spare`)
  // lengthens `rng.shuffle(spare)` by one draw and shifts the rng cursor for
  // seeds 8 and 15 — breaking the frozen magic/maze fixtures. `spare`'s
  // LENGTH is load-bearing (engine/rng.js's Fisher-Yates shuffle draws
  // `arr.length - 1` values), so this predicate is frozen.
  const dayOnePool = (sp) => sp.lvl === 1 && schoolGate(sub, sp.s) <= 1;
  // `usableNow` (the READY-COUNT predicate, used only by `ready()` and the
  // attack top-up below) IS routed through spellLevelFor (Phase 23,
  // IDENT-03: "rollGrimoire's usableNow uses spellLevelFor") — a Summoner's
  // Summon and an Illusionist's Phantom Host now count as day-one-usable.
  // Measured consequence: a Summoner's grants already yield two usable-now
  // spells (Shield + Summon), so the two-usable-now loop below stops one
  // spell earlier than before (parity seed 15 drops Heal) — this is
  // declared under FID-06 in this plan's fixture `divergences` record, not
  // hidden. This does NOT affect `spare`'s pool/length/shuffle above.
  const usableNow = (sp) => spellLevelFor(sub, sp) === 1 && schoolGate(sub, sp.s) <= 1;
  const ready = () => book.filter((n2) => usableNow(SPELLS.find((sp) => sp.n === n2))).length;
  const spare = pool.filter(dayOnePool);
  rng.shuffle(spare);
  for (const sp of spare) { if (ready() >= 2) break; if (!book.includes(sp.n)) book.push(sp.n); }

  // DELIBERATE RULES CHANGE (Phase 23, 2026-09-14, IDENT-02): the prototype
  // only ever guaranteed "two usable-now spells" of ANY kind above — an
  // Apprentice could roll Heal + Strength and have no way to hurt anything.
  // Every Magic User except the Summoner now gets a guaranteed day-one
  // ATTACK spell (Doze/Freeze/Stun/Weaken — see engine/derived.js's
  // ATTACK_SPELL_KINDS); the Summoner's day-one attack is Summon itself, via
  // the spell-level-override table consumed by `usableNow` above. This walks
  // the SAME already-shuffled `spare` array in its EXISTING order and makes
  // NO rng call of its own — zero new draws, so the rng-consumption order
  // pinned by test/unit/chargen-rng-pin.test.js is unchanged; only the
  // grimoire CONTENT changes for a sub-class that lacked a day-one attack.
  // The `sub !== "Summoner"` guard is belt-and-braces: a Summoner's `spare`
  // (built from `dayOnePool`, frozen above) never contains an attack-kind
  // spell anyway, since its offense school is gated to level 3
  // (content/mu-chart.js). Fighters/Thieves never call rollGrimoire.
  const attackReady = () =>
    book.some((n2) => {
      const sp = SPELLS.find((s2) => s2.n === n2);
      return usableNow(sp) && isAttackSpell(sp);
    });
  if (sub !== "Summoner") {
    for (const sp of spare) {
      if (attackReady()) break;
      if (isAttackSpell(sp) && !book.includes(sp.n)) book.push(sp.n);
    }
  }
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
 * rollCharacter(rng, exclude, force) — the 100%-dice-rolled adventurer.
 * Consumes the injected rng in the exact order of the prototype (see the
 * module header) and returns the plain, serializable character object. No
 * player choice, no logging. Ports mazeworld.html rollCharacter() (lines
 * 1042-1111) sans its `if(log)` narration branch.
 *
 * `exclude` (audit-batch E12, part 4) is an optional, additive recent-names
 * list threaded in from the NON-engine persistence layer (the adapter reads it
 * from storage on a fresh roll). It is forwarded UNCHANGED to nameFor as the
 * very last chargen step and only affects which name is chosen — never the rng
 * draw count or order — so `rollCharacter(rng)` with no/empty `exclude` stays
 * byte-identical to the prototype and the parity suite needs no carve-out.
 *
 * `force` (Phase 22, HARN-01; precedent: Phase 21 D-13/D-14's `startDepth`)
 * is a DEV-ONLY harness seam, `null`/omitted by every real caller. It
 * substitutes the RESULTS of the class d6 / sub d8 / race d8 draws while
 * still CONSUMING those draws, so every subsequent draw sits at the
 * identical rng cursor and `rollCharacter(rng, exclude, X)` is
 * byte-identical to `rollCharacter(rng, exclude)` for any seed that
 * naturally rolls `X`. Invalid keys/values and a forced Fridgian Samurai
 * throw (see normalizeForce above); the canon Fridgian/Samurai reroll loop
 * is never bypassed for a NATURAL sub — it is only ever skipped because a
 * forced sub replaces the loop's condition entirely.
 *
 * @param {*} rng - the seeded rng surface (engine/rng.js#makeRng)
 * @param {string[]} [exclude] - recent character names to avoid reusing
 * @param {{cls?: string, sub?: string, race?: string}|null} [force] - dev-only draw-result override (HARN-01)
 */
export function rollCharacter(rng, exclude = [], force = null) {
  const f = normalizeForce(force);
  const cd = rng.d(6);
  const cls = f?.cls ?? (cd <= 2 ? "Magic User" : cd <= 4 ? "Fighter" : "Thief");
  let sd = rng.d(8);
  let sub = f?.sub ?? CLASSES[cls].subs[sd - 1];
  const rd = rng.d(8);
  let race = f?.race ?? RACE_D8[rd - 1];
  // A forced Samurai matched against a NATURALLY-rolled Fridgian race (the
  // both-forced combo is already rejected by normalizeForce above) — throw
  // BEFORE the reroll loop so a forced sub is never silently overwritten.
  if (f?.sub === "Samurai" && race === "Fridgian") {
    throw new Error(
      `rollCharacter force: a forced Samurai cannot be honored against a Fridgian race — "Fridges don't wear any armor." Force a non-Fridgian race as well.`,
    );
  }
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
    // Phase 38 (ABIL-01/03): an ordered array of catalog ids the character
    // has — the table actives split out of c.skills immediately below, plus
    // any level-pool picks granted later (engine/state.js#newRun's level-1
    // guarantee, this file's checkLevel per-level-up roll). A plain empty
    // literal for EVERY character (a Magic User keeps it empty forever — no
    // table, no ABILITY_POOL entry), so this adds NO rng draw and does not
    // shift the chargen rng-consumption order the parity/determinism suites
    // pin. Carved out of every comparable (test/parity/harness/
    // comparables.js#stripAbilitiesField) the same way bag/darkFor/flight are.
    abilities: [],
  };
  // Phase 38 (ABIL-02): move every table-active skill this roll picked from
  // c.skills into c.abilities — a pure data reshuffle (no rng draw), so it
  // cannot move the rng cursor test/unit/chargen-rng-pin.test.js pins.
  splitTableAbilities(c);
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

    // Phase 38 (ABIL-01/03): one level-pool pick per level-up, from a
    // DERIVED stream keyed by seed+level (never the main `rng`) — zero
    // main-rng draws, so every gain-dice/Sorcerer draw below sits at the
    // identical rng cursor as before this phase. Pushes nothing (and grants
    // nothing) for a Magic User or once the pool is exhausted.
    const learnedId = rollPoolAbility(c, String(state.seed), c.level);
    if (learnedId) {
      const learned = ABILITY_BY_ID[learnedId];
      events.push({ type: "abilityLearned", key: learnedId, name: learned.name, txt: learned.txt, level: c.level });
    }

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
