// test/unit/conditions.test.js
//
// DR15-B (2026-09-10): conditionsOf(state) — the PURE derived enumeration of a
// character's active good+bad status conditions that the top-of-screen
// condition tracker (mazeworld.html) renders. These prove the right active set
// for each field, the good/bad polarity, the empty-array case, and — critically
// for the parity guarantee — that the helper is a PURE read: it never mutates
// state/c and never draws rng (a fresh character round-trips byte-identical).

import test from "node:test";
import assert from "node:assert/strict";

import { conditionsOf, memberConditionsOf } from "../../engine/derived.js";
import { useAbility } from "../../engine/abilities.js";
import { startCombat } from "../../engine/combat.js";
import { newRun, addPartyMember } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";

/** A minimal character with every condition field cleared. conditionsOf reads
 * only c.*, so a bare-bones c is a valid, fully-inert baseline. Phase 39
 * (GEAR-02): the haste/invis/ether/acute/flightLeft/flightCooldown scalar
 * counters are retired — a live item effect/cooldown is expressed as a
 * c.timers record instead (see the `rec` helper below). */
function cleanChar(overrides = {}) {
  return {
    might: 0, ward: null,
    affliction: null, darkFor: 0,
    items: [],
    ...overrides,
  };
}

/** rec(cadence, left, cd) — a plain c.timers "effect"-phase record. */
function rec(cadence, left, cd) {
  const r = { cadence, left, phase: "effect" };
  if (cd !== undefined) r.cd = cd;
  return r;
}

const keys = (conds) => conds.map((x) => x.key);
const byKey = (conds, k) => conds.find((x) => x.key === k);

test("conditionsOf: no conditions active → empty array", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar() }), []);
});

test("conditionsOf: each GOOD counter surfaces with its remaining count", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "item:Cloak of Speed": rec("squares", 34, 50) } }) }), [
    { key: "haste", polarity: "good", remaining: 34, cadence: "squares", source: "Cloak of Speed" },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "item:Invisible": rec("squares", 100) } }) }), [
    { key: "invis", polarity: "good", remaining: 100, cadence: "squares", source: "Invisible" },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "item:Acuteness": rec("rounds", 5) } }) }), [
    { key: "acute", polarity: "good", remaining: 5, cadence: "rounds", source: "Acuteness" },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "item:Cloak of Ether": rec("squares", 20, 80) } }) }), [
    { key: "ether", polarity: "good", remaining: 20, cadence: "squares", source: "Cloak of Ether" },
  ]);
});

test("conditionsOf: might is GOOD with no remaining count (lasts until next day)", () => {
  const conds = conditionsOf({ c: cleanChar({ might: 8 }) });
  assert.deepEqual(conds, [{ key: "might", polarity: "good" }]);
  assert.ok(!("remaining" in conds[0]), "might carries no square/round count");
});

// --- Phase 31 (CMB-04): the Shield chip -------------------------------

test("conditionsOf: ward surfaces {pool, remaining, name} after might, before flight", () => {
  const conds = conditionsOf({ c: cleanChar({ ward: { pool: 34, rounds: 3, name: "Shield" } }) });
  assert.deepStrictEqual(conds, [{ key: "ward", polarity: "good", pool: 34, remaining: 3, name: "Shield" }]);
});

// Phase 40 (SPELL-06): the ward chip must show OUTSIDE combat too (Shield is
// combatOnly: false) — conditionsOf reads only `state.c`, so an explicit
// `combat: null` case proves the chip is present with BOTH numbers (pool
// AND rounds) regardless of combat state, not just inferred from the
// signature.
test("conditionsOf: ward surfaces pool AND rounds outside combat (combat: null) — SPELL-06", () => {
  const conds = conditionsOf({ c: cleanChar({ ward: { pool: 34, rounds: 3, name: "Shield" } }), combat: null });
  assert.deepStrictEqual(conds, [{ key: "ward", polarity: "good", pool: 34, remaining: 3, name: "Shield" }]);
});

// --- Phase 40 (SPELL-02): mirror/senses/regen/foresight, after ward, before flight ---
// --- Phase 40 (SPELL-05), Plan 04: reveal, after foresight, before flight ---

// 260918-w4n (use-activated-only): a `flight` chip now comes from the SAME
// generic live-item-effect loop as haste/invis/acute/ether (c.timers
// insertion order) — it is no longer a dedicated block positioned after
// reveal. A ready-but-unused flight item (no live record) yields NO chip at
// all, so the fixed-order proof below places a LIVE "item:Bracelet of
// Flight" record FIRST in the timers map to prove it surfaces there.
test("conditionsOf: mirror/senses/regen/foresight/reveal surface in fixed order after ward, before a live flight record", () => {
  const conds = conditionsOf({
    c: cleanChar({
      timers: {
        "item:Bracelet of Flight": rec("squares", 14, 50),
        "spell:reveal": { cadence: "squares", left: 17, phase: "effect" },
      },
      ward: { pool: 34, rounds: 3, name: "Shield" },
      mirror: 4,
      senses: 1,
      regen: true,
      foresight: true,
    }),
  });
  assert.deepStrictEqual(keys(conds), ["flight", "ward", "mirror", "senses", "regen", "foresight", "reveal"]);
  assert.deepStrictEqual(byKey(conds, "flight"), {
    key: "flight", polarity: "good", flight: "charged", remaining: 14, cadence: "squares", source: "Bracelet of Flight",
  });
  assert.deepStrictEqual(byKey(conds, "mirror"), { key: "mirror", polarity: "good", remaining: 4 });
  assert.deepStrictEqual(byKey(conds, "senses"), { key: "senses", polarity: "good" });
  assert.deepStrictEqual(byKey(conds, "regen"), { key: "regen", polarity: "good" });
  assert.deepStrictEqual(byKey(conds, "foresight"), { key: "foresight", polarity: "good" });
  // Plan 76-06 (user ruling 2026-09-26): the window lasts until you move, so
  // the reveal chip carries no countdown (was remaining 17, cadence "squares").
  assert.deepStrictEqual(byKey(conds, "reveal"), { key: "reveal", polarity: "good" });
});

test("conditionsOf: mirror/senses/regen/foresight are absent at 0/false/undefined", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ mirror: 0, senses: 0, regen: false, foresight: false }) }), []);
});

test("conditionsOf: reveal is absent with no spell:reveal record, a cooldown-phase record, or left <= 0", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar() }), []);
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "spell:reveal": { cadence: "squares", left: 5, phase: "cooldown" } } }) }), []);
  assert.deepEqual(conditionsOf({ c: cleanChar({ timers: { "spell:reveal": { cadence: "squares", left: 0, phase: "effect" } } }) }), []);
});

test("conditionsOf: ward with pool 0 (about to be nulled) is absent", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ ward: { pool: 0, rounds: 1, name: "Shield" } }) }), []);
});

test("conditionsOf: ward null is absent", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ ward: null }) }), []);
});

test("conditionsOf: a live flight record, then ward, then might order in a fully-loaded character", () => {
  const c = cleanChar({
    might: 8,
    ward: { pool: 50, rounds: 5, name: "Shield" },
    timers: { "item:Bracelet of Flight": rec("squares", 14, 50) },
  });
  const conds = conditionsOf({ c });
  assert.deepStrictEqual(keys(conds), ["flight", "might", "ward"]);
});

test("conditionsOf: a live flight record, then ward, might, mirror/senses/regen/foresight/reveal order in a fully-loaded character", () => {
  const c = cleanChar({
    might: 8,
    ward: { pool: 50, rounds: 5, name: "Shield" },
    mirror: 2,
    senses: 1,
    regen: true,
    foresight: true,
    timers: {
      "item:Bracelet of Flight": rec("squares", 14, 50),
      "spell:reveal": { cadence: "squares", left: 9, phase: "effect" },
    },
  });
  const conds = conditionsOf({ c });
  assert.deepStrictEqual(keys(conds), ["flight", "might", "ward", "mirror", "senses", "regen", "foresight", "reveal"]);
});

// RULES-11 (Phase 75.2, Plan 02): a live size-stepping item (the Gauntlet
// of the Giant, Enlarge, or any future size item) carries `step` (the
// item's own ±1) and `size` (the hero's CURRENT total size name,
// heroSize(c).name) on its chip; no other item's chip ever gets these
// fields. Phase 89 (ITEM-05): the chip also carries `dmgTotal`, the item's
// whole damage bonus (the Gauntlet's is the step's 2; Enlarge's is 11).
test("conditionsOf: a live Gauntlet record carries step and the hero's current size name; a plain haste chip carries neither", () => {
  const conds = conditionsOf({
    c: cleanChar({ race: "Human", timers: { "item:Gauntlet of the Giant": rec("squares", 30, 50) } }),
  });
  assert.deepStrictEqual(conds, [
    { key: "giant", polarity: "good", remaining: 30, cadence: "squares", source: "Gauntlet of the Giant", step: 1, size: "Large", dmgTotal: 2 },
  ]);

  const hasteConds = conditionsOf({ c: cleanChar({ timers: { "item:Cloak of Speed": rec("squares", 34, 50) } }) });
  assert.equal("step" in hasteConds[0], false);
  assert.equal("size" in hasteConds[0], false);
  assert.equal("dmgTotal" in hasteConds[0], false);
});

test("conditionsOf: BAD affliction names its kind", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ affliction: { kind: "Poison", left: 10 } }) }), [
    { key: "affliction", polarity: "bad", kind: "Poison" },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ affliction: { kind: "Disease" } }) }), [
    { key: "affliction", polarity: "bad", kind: "Disease" },
  ]);
});

test("conditionsOf: darkness (active-phobia surface) shows only while darkFor > 0", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ darkFor: 12 }) }), [
    { key: "darkness", polarity: "bad", remaining: 12 },
  ]);
  // Merely HAVING the Darkness phobia (no active counter) does NOT surface it.
  assert.deepEqual(conditionsOf({ c: cleanChar({ phobia: "Darkness", darkFor: 0 }) }), []);
});

// 260918-w4n (use-activated-only): a ready-but-unused Bracelet/Cloak of
// Flying (worn or bagged, no live record) is NOT flying and yields NO
// flight chip at all — there is no more "always-on" special case.
test("conditionsOf: flight — a ready-but-unused Bracelet of Flight yields no chip", () => {
  const conds = conditionsOf({ c: cleanChar({ items: [{ n: "Bracelet of Flight" }] }) });
  assert.deepEqual(conds, []);
});

test("conditionsOf: flight — Cloak of Flying charged (live) / cooling (generic itemCooldown) / ready (no chip) sub-states", () => {
  const charged = conditionsOf({
    c: cleanChar({ items: [{ n: "Cloak of Flying" }], timers: { "item:Cloak of Flying": rec("squares", 14, 50) } }),
  });
  assert.deepEqual(charged, [
    { key: "flight", polarity: "good", flight: "charged", remaining: 14, cadence: "squares", source: "Cloak of Flying" },
  ]);

  // A cooling flight item is reported by the GENERIC itemCooldown loop now,
  // exactly like every other cooling item — no dedicated flight-cooldown
  // sub-state any more.
  const cooling = conditionsOf({
    c: cleanChar({
      items: [{ n: "Cloak of Flying" }],
      timers: { "item:Cloak of Flying": { cadence: "squares", left: 30, phase: "cooldown" } },
    }),
  });
  assert.deepEqual(cooling, [{ key: "itemCooldown", polarity: "good", item: "Cloak of Flying", remaining: 30 }]);

  const ready = conditionsOf({ c: cleanChar({ items: [{ n: "Cloak of Flying" }] }) });
  assert.deepEqual(ready, [], "a ready-but-unused Cloak of Flying is not flying and yields no chip");
});

test("conditionsOf: a fully-loaded character enumerates good-then-bad in stable order", () => {
  const c = cleanChar({
    timers: {
      "item:Cloak of Speed": rec("squares", 34, 50),
      "item:Invisible": rec("squares", 100),
      "item:Acuteness": rec("rounds", 5),
      "item:Cloak of Ether": rec("squares", 20, 80),
      // 260918-w4n: a live flight record is just another entry in this SAME
      // c.timers insertion-order loop now — placed last among the item
      // effects, before the spell-reveal record.
      "item:Bracelet of Flight": rec("squares", 14, 50),
      "spell:reveal": rec("squares", 22),
    },
    might: 8,
    mirror: 3,
    senses: 1,
    regen: true,
    foresight: true,
    affliction: { kind: "Poison", left: 10 },
    darkFor: 12,
    // Phase 41 (TERR-05): fearArmed slots between darkness and afraid.
    fearArmed: { phobia: "Heights", trigger: "heights" },
  });
  const conds = conditionsOf({ c });
  assert.deepEqual(keys(conds), [
    "haste", "invis", "acute", "ether", "flight", "might", "mirror", "senses", "regen", "foresight", "reveal", "affliction", "darkness", "fearArmed",
  ]);
  // Plan 76-06 (user ruling 2026-09-26): no countdown on the reveal chip (was remaining 22).
  assert.deepStrictEqual(byKey(conds, "reveal"), { key: "reveal", polarity: "good" });
  // Good conditions all precede bad ones.
  const firstBad = conds.findIndex((x) => x.polarity === "bad");
  assert.ok(conds.slice(0, firstBad).every((x) => x.polarity === "good"));
  assert.ok(conds.slice(firstBad).every((x) => x.polarity === "bad"));
  assert.equal(byKey(conds, "affliction").kind, "Poison");
  assert.equal(byKey(conds, "darkness").remaining, 12);
  assert.deepEqual(byKey(conds, "fearArmed"), { key: "fearArmed", polarity: "bad", phobia: "Heights", trigger: "heights" });
});

test("conditionsOf: is a PURE read — no mutation of state or c, no rng needed", () => {
  const c = cleanChar({
    timers: { "item:Cloak of Speed": rec("squares", 34, 50) },
    affliction: { kind: "Poison", left: 10 },
    darkFor: 12,
  });
  const before = JSON.stringify(c);
  // No rng object is passed at all — a draw would throw here, proving purity.
  const conds = conditionsOf({ c });
  assert.equal(JSON.stringify(c), before, "conditionsOf must not mutate the character");
  // Returned descriptors are fresh objects, not aliases into c.
  conds.forEach((cond) => assert.notEqual(cond, c.affliction));
});

test("conditionsOf: tolerates a bare/empty state without throwing", () => {
  assert.deepEqual(conditionsOf({}), []);
  assert.deepEqual(conditionsOf({ c: {} }), []);
});

// --- Phase 31 (CMB-01, re-pins DR17 item 1, user ruling 2026-09-16): the
// Afraid condition ------------------------------------------------------
// "Phobia should be penalties, never a no actions state" — the old DR17
// phobia chip surfaced whenever the fear was ACTIVELY gripping the hero
// (type-matched foe, a set freeze flag, Darkness-in-the-dark, or Death
// near-death); the new `afraid` chip is narrower and simpler: it surfaces
// ONLY while `state.combat.afraid > 0` — the penalty counter engine/combat.js
// #fight sets when the trigger fires (see engine/derived.js#afraidNeed/
// afraidDamage) — so the chip follows the PENALTY, not the underlying fear
// condition. A Hardiness shrug-off (the trigger fired but the mitigation
// roll won) never sets the counter, so it shows nothing, even though the
// fear itself is still "active" in the old sense.

test("conditionsOf: combat.afraid > 0 surfaces a named BAD chip with the fear and the remaining rounds", () => {
  const c = cleanChar({ phobia: "Crowds", phobiaType: "Humans", wp: 40, maxWP: 40 });
  const conds = conditionsOf({ c, combat: { type: "Humans", afraid: 2 } });
  assert.deepEqual(conds, [{ key: "afraid", polarity: "bad", remaining: 2, phobia: "Crowds" }]);
});

test("conditionsOf: the afraid chip's remaining count tracks the live counter, not a fixed number", () => {
  const c = cleanChar({ phobia: "Bats and rats", phobiaType: "Beasts", wp: 40, maxWP: 40 });
  assert.deepEqual(conditionsOf({ c, combat: { type: "Beasts", afraid: 1 } }), [
    { key: "afraid", polarity: "bad", remaining: 1, phobia: "Bats and rats" },
  ]);
});

test("conditionsOf: a type-matched phobia WITHOUT the afraid counter (a Hardiness shrug-off) shows nothing — the chip follows the penalty, not the fear", () => {
  const c = cleanChar({ phobia: "Crowds", phobiaType: "Humans", wp: 40, maxWP: 40 });
  const conds = conditionsOf({ c, combat: { type: "Humans" } });
  assert.deepEqual(conds, []);
});

test("conditionsOf: Darkness-in-the-dark without the afraid counter surfaces only the darkness chip, never afraid", () => {
  const c = cleanChar({ phobia: "Darkness", phobiaType: null, darkFor: 8, wp: 40, maxWP: 40 });
  const conds = conditionsOf({ c, combat: { type: "Rats" } });
  assert.deepEqual(keys(conds), ["darkness"]);
});

test("conditionsOf: Death near-death (wp <= 25% maxWP) without the afraid counter shows nothing", () => {
  const c = cleanChar({ phobia: "Death", phobiaType: null, wp: 5, maxWP: 100 });
  assert.deepEqual(conditionsOf({ c, combat: { type: "Skeletons" } }), []);
});

test("conditionsOf: afraid NEVER surfaces outside combat, even with combat.afraid set on a bare object", () => {
  const c = cleanChar({ phobia: "Crowds", phobiaType: "Humans", wp: 40, maxWP: 40 });
  assert.deepEqual(conditionsOf({ c }), []); // no state.combat
});

test("conditionsOf: the afraid read stays PURE (no mutation) inside combat", () => {
  const c = cleanChar({ phobia: "Crowds", phobiaType: "Humans", wp: 5, maxWP: 40 });
  const state = { c, combat: { type: "Humans", afraid: 1 } };
  const before = JSON.stringify(state);
  conditionsOf(state);
  assert.equal(JSON.stringify(state), before, "conditionsOf must not mutate state or combat");
});

// --- Phase 41 (TERR-05): the fearArmed chip — an ARMED terrain phobia
// waiting for the next fight, distinct from `afraid` (the CURRENT fight's
// live penalty). Placed after darkness, before afraid, in the bad block. ---

test("conditionsOf: fearArmed surfaces a named BAD chip, placed after darkness and before afraid", () => {
  const c = cleanChar({ fearArmed: { phobia: "Heights", trigger: "heights" }, darkFor: 5 });
  const conds = conditionsOf({ c, combat: { afraid: 2 } });
  assert.deepEqual(keys(conds), ["darkness", "fearArmed", "afraid"]);
  assert.deepEqual(byKey(conds, "fearArmed"), { key: "fearArmed", polarity: "bad", phobia: "Heights", trigger: "heights" });
});

test("conditionsOf: no fearArmed chip when the field is absent", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar() }), []);
});

test("conditionsOf: fearArmed surfaces on its own outside combat (armed, but no fight open yet)", () => {
  const c = cleanChar({ fearArmed: { phobia: "Bodies of water", trigger: "water" } });
  assert.deepEqual(conditionsOf({ c }), [{ key: "fearArmed", polarity: "bad", phobia: "Bodies of water", trigger: "water" }]);
});

// --- Phase 19: foe-inflicted debuff chip (FOE-08 / D-09) ---

test("conditionsOf: a live foeEffect surfaces one BAD chip with its kind and remaining rounds", () => {
  const weakened = conditionsOf({ c: cleanChar({ foeEffect: { kind: "weakened", rounds: 3 } }) });
  assert.deepStrictEqual(byKey(weakened, "foeEffect"), { key: "foeEffect", polarity: "bad", kind: "weakened", remaining: 3 });

  const dazed = conditionsOf({ c: cleanChar({ foeEffect: { kind: "dazed", rounds: 1 } }) });
  assert.deepStrictEqual(byKey(dazed, "foeEffect"), { key: "foeEffect", polarity: "bad", kind: "dazed", remaining: 1 });
});

test("conditionsOf: no foeEffect key, foeEffect null, and rounds 0 all produce no chip", () => {
  const noKey = conditionsOf({ c: cleanChar() });
  const nullEffect = conditionsOf({ c: cleanChar({ foeEffect: null }) });
  const zeroRounds = conditionsOf({ c: cleanChar({ foeEffect: { kind: "weakened", rounds: 0 } }) });
  for (const conds of [noKey, nullEffect, zeroRounds]) {
    assert.ok(!keys(conds).includes("foeEffect"));
    assert.deepStrictEqual(conds, []);
  }
});

test("conditionsOf: affliction then foeEffect then darkness — stable BAD order, pure read", () => {
  const c = cleanChar({
    affliction: { kind: "Poison" },
    foeEffect: { kind: "dazed", rounds: 2 },
    darkFor: 3,
  });
  const before = structuredClone(c);
  const conds = conditionsOf({ c });
  assert.deepStrictEqual(keys(conds), ["affliction", "foeEffect", "darkness"]);
  assert.deepStrictEqual(c, before, "conditionsOf must not mutate the character");
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 77 (CMBUI-13): every live hero and party-member effect has a chip.
// The user's report (2026-09-25): "When I use the ability smoke, I have no
// indication on myself or the enemies that it's active ... Abilities and
// spells all need to have some sort of active indicator while in combat."
// conditionsOf gains the ability/braced/inspired/insulted/selfDot/halfNext/
// strengthBoost/fightDark/nightVision descriptors (appended — every older
// descriptor keeps its exact shape and order) and memberConditionsOf(state,
// i) lists a party member's own. States are built through the engine's own
// useAbility/startCombat where they exist; otherwise the field is set exactly
// as the engine writes it (the writing function is cited).
// ═══════════════════════════════════════════════════════════════════════════

function p77Hero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function p77Floor({ dark = false } = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function p77Foe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function p77Fight({ c = {}, combat = {}, dark = false, party = [] } = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: p77Hero(c),
    floor: p77Floor({ dark }),
    day: 1, steps: 0, store: null, beats: null, party,
    dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: [p77Foe()], type: "Beasts", round: 1, target: 0,
      pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
      ...combat,
    },
  };
}

/** p77Rng(face) — every draw returns `face` (a 20 makes the foe's swing miss, as test/unit/abilities.test.js's FILL does). */
function p77Rng(face = 20) {
  return { d: () => face, pick: (a) => a[0], shuffle: (a) => a };
}

const abilityRec = (left, cd = 4) => ({ cadence: "rounds", left, phase: "effect", cd });

test("CMBUI-13 ability: a Thief's Smoke (engine/abilities.js useAbility) gives an ability chip until its record cools down", () => {
  const state = p77Fight({ c: { cls: "Thief", sub: "Pilfer", abilities: ["smoke"] } });
  useAbility(state, "smoke", p77Rng(), []);
  const rec = state.c.timers["ability:smoke"];
  assert.equal(rec.phase, "effect");
  assert.ok(rec.left > 0);
  assert.deepEqual(conditionsOf(state), [
    { key: "ability", ability: "smoke", polarity: "good", remaining: rec.left, cadence: "rounds" },
  ]);
  // the record rolls into its cooldown phase: the effect is gone, so is the chip.
  state.c.timers["ability:smoke"] = { cadence: "rounds", left: 3, phase: "cooldown" };
  assert.deepEqual(conditionsOf(state), []);
});

test("CMBUI-13 ability: one chip per live duration ability, in c.timers insertion order", () => {
  const state = p77Fight({ c: { timers: { "ability:sidestep": abilityRec(2), "ability:battleRoar": abilityRec(1) } } });
  assert.deepEqual(conditionsOf(state), [
    { key: "ability", ability: "sidestep", polarity: "good", remaining: 2, cadence: "rounds" },
    { key: "ability", ability: "battleRoar", polarity: "good", remaining: 1, cadence: "rounds" },
  ]);
});

test("CMBUI-13 ability: left 1 gives remaining 1; left 0 or the cooldown phase gives none; an immediate ability's cooldown gives none", () => {
  const one = p77Fight({ c: { timers: { "ability:riposte": abilityRec(1) } } });
  assert.deepEqual(conditionsOf(one), [{ key: "ability", ability: "riposte", polarity: "good", remaining: 1, cadence: "rounds" }]);
  const zero = p77Fight({ c: { timers: { "ability:riposte": abilityRec(0) } } });
  assert.deepEqual(conditionsOf(zero), []);
  const cooling = p77Fight({ c: { timers: { "ability:taunt": { cadence: "rounds", left: 4, phase: "cooldown" } } } });
  assert.deepEqual(conditionsOf(cooling), []);
  // engine/abilities.js#startAbilityTimer: an immediate ability starts a plain cooldown.
  const pommel = p77Fight({ c: { abilities: ["pommelStrike"] } });
  useAbility(pommel, "pommelStrike", p77Rng(), []);
  assert.ok(pommel.c.timers["ability:pommelStrike"], "the cooldown started");
  assert.deepEqual(keys(conditionsOf(pommel)).filter((k) => k === "ability"), []);
});

test("CMBUI-13 braced: engine/abilities.js useAbility('brace') sets C.braced; the chip lasts until the blow consumes it", () => {
  const state = p77Fight({ c: { abilities: ["brace"] } });
  useAbility(state, "brace", p77Rng(20), []);
  assert.equal(state.combat.braced, true, "a missed swing leaves the stance up");
  assert.deepEqual(byKey(conditionsOf(state), "braced"), { key: "braced", polarity: "good" });
  // engine/combat.js applyFoeDamageToPlayer: `state.combat.braced = false` on the next landed blow.
  state.combat.braced = false;
  assert.equal(byKey(conditionsOf(state), "braced"), undefined);
});

test("CMBUI-13 inspired: engine/combat.js's level-2 song `C.inspired = 1` gives a good chip carrying its amount", () => {
  const state = p77Fight({ combat: { inspired: 1 } });
  assert.deepEqual(conditionsOf(state), [{ key: "inspired", polarity: "good", amount: 1 }]);
  assert.deepEqual(conditionsOf(p77Fight({ combat: { inspired: 0 } })), []);
});

test("CMBUI-13 insulted: engine/combat.js parley's `C.parleyInsulted = true` gives a bad chip", () => {
  assert.deepEqual(conditionsOf(p77Fight({ combat: { parleyInsulted: true } })), [{ key: "insulted", polarity: "bad" }]);
  assert.deepEqual(conditionsOf(p77Fight({ combat: { parleyInsulted: false } })), []);
});

test("CMBUI-13 halfNext: engine/items.js's Pendant of Fortitude `c.halfNext = true` gives a good chip, in or out of a fight", () => {
  assert.deepEqual(conditionsOf(p77Fight({ c: { halfNext: true } })), [{ key: "halfNext", polarity: "good" }]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ halfNext: true }) }), [{ key: "halfNext", polarity: "good" }]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ halfNext: false }) }), []);
});

test("CMBUI-13 strengthBoost: engine/magic.js's Strength `c.strengthBoost = c.maxWP` gives a good chip carrying its amount", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ strengthBoost: 40 }) }), [{ key: "strengthBoost", polarity: "good", amount: 40 }]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ strengthBoost: 0 }) }), []);
});

test("CMBUI-13 selfDot: engine/scrollFumble.js's `C.selfDot` gives a bad chip with remaining, by and spell; left 0 gives none", () => {
  const state = p77Fight({ combat: { selfDot: { left: 2, dmg: "1d6", by: "acid", spell: "Acid" } } });
  assert.deepEqual(conditionsOf(state), [{ key: "selfDot", polarity: "bad", remaining: 2, by: "acid", spell: "Acid" }]);
  state.combat.selfDot.left = 0;
  assert.deepEqual(conditionsOf(state), []);
});

test("CMBUI-13 fightDark: a fight on a dark square with the cap live gives fightDark; a torch, Sense Presence or a darkFor counter do not", () => {
  assert.deepEqual(conditionsOf(p77Fight({ dark: true })), [{ key: "fightDark", polarity: "bad" }]);
  // Sense Presence lifts the dark cap (engine/derived.js#toHit), so no chip.
  assert.deepEqual(keys(conditionsOf(p77Fight({ dark: true, c: { senses: 1 } }))), ["senses"]);
  // A lit torch waives the dark (darkWaiver "litTorch"): no fightDark chip.
  const lit = conditionsOf(p77Fight({ dark: true, c: { timers: { "item:Torch": { cadence: "squares", left: 20, phase: "effect" } } } }));
  assert.equal(byKey(lit, "fightDark"), undefined);
  // The persistent Darkness counter keeps its own chip; one cause, one chip.
  assert.deepEqual(keys(conditionsOf(p77Fight({ dark: true, c: { darkFor: 4 } }))), ["darkness"]);
  // Outside a fight, no fightDark.
  const walking = p77Fight({ dark: true });
  walking.combat = null;
  assert.deepEqual(conditionsOf(walking), []);
  // A lit square in a fight: nothing.
  assert.deepEqual(conditionsOf(p77Fight()), []);
});

test("CMBUI-13 nightVision: a fight on a dark square that Night Vision holds back gives a good nightVision chip, only in a fight", () => {
  const nv = { skills: { "Night Vision": 1 } };
  assert.deepEqual(conditionsOf(p77Fight({ dark: true, c: nv })), [{ key: "nightVision", polarity: "good" }]);
  assert.deepEqual(conditionsOf(p77Fight({ dark: false, c: nv })), []);
  const walking = p77Fight({ dark: true, c: nv });
  walking.combat = null;
  assert.deepEqual(conditionsOf(walking), []);
});

test("CMBUI-13 empty: outside a fight the combat-only chips never appear, even with their fields set", () => {
  const state = p77Fight({
    dark: true,
    c: { timers: { "ability:smoke": abilityRec(2) } },
    combat: { braced: true, inspired: 1, parleyInsulted: true, selfDot: { left: 2, by: "ice", spell: "Ice" } },
  });
  const combat = state.combat;
  state.combat = null;
  assert.deepEqual(conditionsOf(state), []);
  state.combat = combat;
  assert.deepEqual(keys(conditionsOf(state)), ["ability", "braced", "inspired", "fightDark", "insulted", "selfDot"]);
  // a hero with no live effect in a fight on a lit square yields nothing.
  assert.deepEqual(conditionsOf(p77Fight()), []);
});

test("CMBUI-13 order: ability chips follow the item effects; braced/inspired/halfNext/strengthBoost/nightVision end the good block before itemCooldown; fightDark/insulted/selfDot end the bad block", () => {
  const state = p77Fight({
    dark: true,
    c: {
      skills: { "Night Vision": 1 },
      timers: {
        "item:Cloak of Speed": rec("squares", 34, 50),
        "ability:smoke": abilityRec(2),
        "spell:reveal": rec("squares", 22),
        "item:Acuteness": { cadence: "rounds", left: 3, phase: "cooldown" },
      },
      might: 8,
      ward: { pool: 10, rounds: 3, name: "Shield" },
      halfNext: true,
      strengthBoost: 30,
      foeEffect: { kind: "dazed", rounds: 2 },
    },
    combat: { braced: true, inspired: 1, parleyInsulted: true, selfDot: { left: 1, by: "acid", spell: "Acid" }, afraid: 2 },
  });
  // fightDark is absent: Night Vision holds the dark back.
  assert.deepEqual(keys(conditionsOf(state)), [
    "haste", "ability", "might", "ward", "reveal", "braced", "inspired", "halfNext", "strengthBoost", "nightVision", "itemCooldown",
    "foeEffect", "afraid", "insulted", "selfDot",
  ]);
  assert.deepEqual(conditionsOf(state), conditionsOf(state), "two calls are deep-equal");
});

test("CMBUI-13 adjacency: Shield and Smoke on one hero are two chips; the same ability on the hero and on a member is one chip under each", () => {
  const party = [p77Hero({ name: "Joiner", timers: { "ability:sidestep": abilityRec(2) } })];
  const state = p77Fight({
    c: { ward: { pool: 10, rounds: 3, name: "Shield" }, timers: { "ability:smoke": abilityRec(2), "ability:sidestep": abilityRec(1) } },
    combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30 }] },
    party,
  });
  assert.deepEqual(keys(conditionsOf(state)), ["ability", "ability", "ward"]);
  assert.deepEqual(conditionsOf(state).filter((x) => x.key === "ability").map((x) => x.ability), ["smoke", "sidestep"]);
  assert.deepEqual(memberConditionsOf(state, 0), [{ key: "ability", ability: "sidestep", polarity: "good", remaining: 2, cadence: "rounds" }]);
});

test("CMBUI-13 member: a live Sidestep and a braced allies entry give the ability chip then braced", () => {
  const party = [p77Hero({ name: "Joiner", timers: { "ability:sidestep": abilityRec(1), "ability:taunt": { cadence: "rounds", left: 3, phase: "cooldown" } } })];
  const state = p77Fight({ combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30, braced: true }] }, party });
  assert.deepEqual(memberConditionsOf(state, 0), [
    { key: "ability", ability: "sidestep", polarity: "good", remaining: 1, cadence: "rounds" },
    { key: "braced", polarity: "good" },
  ]);
  // the hero's own list never picks up the member's effects.
  assert.deepEqual(conditionsOf(state), []);
});

test("CMBUI-13 member empty: a missing member, a missing combat, no timers and a malformed state all give [] without throwing", () => {
  const party = [p77Hero({ name: "Joiner" })];
  const state = p77Fight({ combat: { allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30 }] }, party });
  assert.deepEqual(memberConditionsOf(state, 0), [], "no timers and no braced entry");
  assert.deepEqual(memberConditionsOf(state, 1), [], "missing member");
  assert.deepEqual(memberConditionsOf(state, -1), []);
  assert.deepEqual(memberConditionsOf(state, "0"), []);
  const live = p77Fight({ party: [p77Hero({ timers: { "ability:sidestep": abilityRec(2) } })] });
  live.combat = null;
  assert.deepEqual(memberConditionsOf(live, 0), [], "missing combat");
  for (const bad of [null, undefined, 0, "state", [], {}, { party: "x" }, { party: [null], combat: {} }, { party: [{ timers: "x" }], combat: { allies: "x" } }]) {
    let out;
    assert.doesNotThrow(() => {
      out = memberConditionsOf(bad, 0);
    }, `state ${JSON.stringify(bad)}`);
    assert.deepEqual(out, []);
  }
});

test("CMBUI-13 purity: conditionsOf and memberConditionsOf never mutate the state and draw no rng", () => {
  const party = [p77Hero({ name: "Joiner", timers: { "ability:sidestep": abilityRec(2) } })];
  const state = p77Fight({
    dark: true,
    c: { timers: { "ability:smoke": abilityRec(2) }, halfNext: true, strengthBoost: 10 },
    combat: {
      braced: true, inspired: 1, parleyInsulted: true, selfDot: { left: 2, by: "ice", spell: "Ice" },
      allies: [{ partyIdx: 0, name: "Joiner", lvl: 1, wp: 30, maxWP: 30, braced: true }],
    },
    party,
  });
  const before = JSON.stringify(state);
  // No rng object exists anywhere in reach — a draw would throw.
  const a = conditionsOf(state);
  const b = conditionsOf(state);
  const ma = memberConditionsOf(state, 0);
  const mb = memberConditionsOf(state, 0);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(a, b);
  assert.deepEqual(ma, mb);
});

test("CMBUI-13 relaunch: a live fight's hero and member chips read deep-equal after serializeRun then validateSave/rehydrate", () => {
  const s = newRun(7);
  const m = rollCharacter(makeRng(3));
  m.wp = m.maxWP = 30;
  addPartyMember(s, m);
  const rng = makeRng(s.rngState);
  startCombat(s, false, null, rng);
  s.rngState = rng.getState();
  assert.ok(s.combat && Array.isArray(s.combat.allies) && s.combat.allies.length === 1, "the party joined the fight");
  s.c.timers = { ...(s.c.timers || {}), "ability:smoke": abilityRec(2) }; // engine/abilities.js useAbility("smoke")
  s.combat.braced = true; // engine/abilities.js useAbility("brace")
  s.combat.inspired = 1; // engine/combat.js the level-2 song
  s.combat.selfDot = { left: 2, dmg: "1d6", by: "acid", spell: "Acid" }; // engine/scrollFumble.js
  s.party[0].timers = { ...(s.party[0].timers || {}), "ability:sidestep": abilityRec(1) }; // combat.js startMemberAbilityTimer
  const heroBefore = conditionsOf(s);
  const memberBefore = memberConditionsOf(s, 0);
  for (const k of ["ability", "braced", "inspired", "selfDot"]) assert.ok(heroBefore.some((x) => x.key === k), `hero ${k}`);
  assert.ok(memberBefore.some((x) => x.key === "ability" && x.ability === "sidestep"));

  const json = JSON.stringify(serializeRun(s));
  const check = validateSave(json);
  assert.equal(check.ok, true);
  for (const loaded of [check.value, rehydrate(JSON.parse(json)), rehydrate(validateSave(json).value)]) {
    assert.ok(loaded.combat, "the fight survives the relaunch");
    assert.deepEqual(conditionsOf(loaded), heroBefore);
    assert.deepEqual(memberConditionsOf(loaded, 0), memberBefore);
  }
});
