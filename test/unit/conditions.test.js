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
 * only c.*, so a bare-bones c is a valid, fully-inert baseline. */
function cleanChar(overrides = {}) {
  return {
    haste: 0, invis: 0, ether: 0, acute: 0, might: 0, ward: null,
    flightLeft: 0, flightCooldown: 0,
    affliction: null, darkFor: 0,
    items: [],
    ...overrides,
  };
}

const keys = (conds) => conds.map((x) => x.key);
const byKey = (conds, k) => conds.find((x) => x.key === k);

test("conditionsOf: no conditions active → empty array", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar() }), []);
});

test("conditionsOf: each GOOD counter surfaces with its remaining count", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ haste: 34 }) }), [
    { key: "haste", polarity: "good", remaining: 34 },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ invis: 100 }) }), [
    { key: "invis", polarity: "good", remaining: 100 },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ acute: 5 }) }), [
    { key: "acute", polarity: "good", remaining: 5 },
  ]);
  assert.deepEqual(conditionsOf({ c: cleanChar({ ether: 20 }) }), [
    { key: "ether", polarity: "good", remaining: 20 },
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

test("conditionsOf: ward with pool 0 (about to be nulled) is absent", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ ward: { pool: 0, rounds: 1, name: "Shield" } }) }), []);
});

test("conditionsOf: ward null is absent", () => {
  assert.deepEqual(conditionsOf({ c: cleanChar({ ward: null }) }), []);
});

test("conditionsOf: ward + might + flight order in a fully-loaded character", () => {
  const c = cleanChar({
    might: 8,
    ward: { pool: 50, rounds: 5, name: "Shield" },
    items: [{ n: "Bracelet of Flight" }],
  });
  const conds = conditionsOf({ c });
  assert.deepStrictEqual(keys(conds), ["might", "ward", "flight"]);
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

test("conditionsOf: flight — Bracelet is always-on, no charge count", () => {
  const conds = conditionsOf({ c: cleanChar({ items: [{ n: "Bracelet of Flight" }] }) });
  assert.deepEqual(conds, [{ key: "flight", polarity: "good", flight: "always" }]);
});

test("conditionsOf: flight — Cloak of Flying charged / recharging / ready sub-states", () => {
  const charged = conditionsOf({ c: cleanChar({ items: [{ n: "Cloak of Flying" }], flightLeft: 14 }) });
  assert.deepEqual(charged, [{ key: "flight", polarity: "good", flight: "charged", remaining: 14 }]);

  const cooling = conditionsOf({ c: cleanChar({ items: [{ n: "Cloak of Flying" }], flightCooldown: 30 }) });
  assert.deepEqual(cooling, [{ key: "flight", polarity: "good", flight: "cooldown", remaining: 30 }]);

  const ready = conditionsOf({ c: cleanChar({ items: [{ n: "Cloak of Flying" }] }) });
  assert.deepEqual(ready, [{ key: "flight", polarity: "good", flight: "ready" }]);
});

test("conditionsOf: a fully-loaded character enumerates good-then-bad in stable order", () => {
  const c = cleanChar({
    haste: 34, invis: 100, acute: 5, ether: 20, might: 8,
    items: [{ n: "Bracelet of Flight" }],
    affliction: { kind: "Poison", left: 10 },
    darkFor: 12,
  });
  const conds = conditionsOf({ c });
  assert.deepEqual(keys(conds), [
    "haste", "invis", "acute", "ether", "might", "flight", "affliction", "darkness",
  ]);
  // Good conditions all precede bad ones.
  const firstBad = conds.findIndex((x) => x.polarity === "bad");
  assert.ok(conds.slice(0, firstBad).every((x) => x.polarity === "good"));
  assert.ok(conds.slice(firstBad).every((x) => x.polarity === "bad"));
  assert.equal(byKey(conds, "affliction").kind, "Poison");
  assert.equal(byKey(conds, "darkness").remaining, 12);
});

test("conditionsOf: is a PURE read — no mutation of state or c, no rng needed", () => {
  const c = cleanChar({ haste: 34, affliction: { kind: "Poison", left: 10 }, darkFor: 12 });
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
