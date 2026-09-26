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

import { conditionsOf } from "../../engine/derived.js";

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
  assert.deepStrictEqual(byKey(conds, "reveal"), { key: "reveal", polarity: "good", remaining: 17, cadence: "squares" });
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
// fields.
test("conditionsOf: a live Gauntlet record carries step and the hero's current size name; a plain haste chip carries neither", () => {
  const conds = conditionsOf({
    c: cleanChar({ race: "Human", timers: { "item:Gauntlet of the Giant": rec("squares", 30, 50) } }),
  });
  assert.deepStrictEqual(conds, [
    { key: "giant", polarity: "good", remaining: 30, cadence: "squares", source: "Gauntlet of the Giant", step: 1, size: "Large" },
  ]);

  const hasteConds = conditionsOf({ c: cleanChar({ timers: { "item:Cloak of Speed": rec("squares", 34, 50) } }) });
  assert.equal("step" in hasteConds[0], false);
  assert.equal("size" in hasteConds[0], false);
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
  assert.equal(byKey(conds, "reveal").remaining, 22);
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
