// test/unit/worn-model.test.js
//
// Phase 37 Plan 01 (GEAR-03/GEAR-04) — the worn-slot data model and the
// two-path eff() refactor. Proves:
//   - the slot taxonomy (content/treasure-tables.js SLOT_OF, 24 entries)
//     and that no exported JEWELRY/CLOAKS/STAVES row (or any rolled item)
//     ever carries a `slot` key;
//   - engine/derived.js's WORN_SLOTS/slotFor/carriedItems/reconcileWorn;
//   - eff(c, key) is two-path: worn-only when c.worn is present, the
//     byte-identical legacy sum over c.items otherwise;
//   - hasItemNamed (and therefore isFlying/conditionsOf) reads bag ∪ worn;
//   - a pinned, MEASURED legacy-equivalence table over every chargen
//     fixture seed;
//   - the companion invariant (no worn item is ever double-counted from the
//     bag) and rng/parity proofs (Task 3).
//
// No cross-test-file imports (project convention for these deterministic
// unit suites) — every rng/state helper this file needs is defined or
// imported directly.

import test from "node:test";
import assert from "node:assert/strict";

import { JEWELRY, CLOAKS, STAVES, SLOT_OF } from "../../content/treasure-tables.js";
import {
  WORN_SLOTS,
  slotFor,
  carriedItems,
  reconcileWorn,
  eff,
  hasItemNamed,
  isFlying,
  conditionsOf,
} from "../../engine/derived.js";
import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { rollJewel, rollCloak, rollStaff } from "../../engine/items.js";
import { makeRng } from "../../engine/rng.js";

const CHARGEN_SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 15, 19, 24, 29, 32, 35];
const EFF_KEYS = ["dmg", "size", "sight", "light", "foeToHit", "tongue", "fly", "cloakHeal", "noCrit", "cloakRegen", "cloakArmor"];

// MEASURED against the pre-refactor engine (see the plan's Task 1 action
// note) — not hand-computed. Sparse: only non-zero (seed, key) pairs.
const LEGACY_EFF_PINS = {
  2: { cloakRegen: 1 },
  4: { cloakRegen: 1 },
};

/* ============================================================
 * Slot taxonomy (content/treasure-tables.js)
 * ============================================================ */

test("SLOT_OF has exactly 24 own keys and is frozen", () => {
  assert.equal(Object.keys(SLOT_OF).length, 24);
  assert.ok(Object.isFrozen(SLOT_OF));
});

test("SLOT_OF matches the locked taxonomy for every JEWELRY name", () => {
  assert.equal(SLOT_OF["Ring of Power"], "ring");
  assert.equal(SLOT_OF["Bracelet of Flight"], "bracelet");
  assert.equal(SLOT_OF["Anklet of Invisibility"], "bracelet");
  assert.equal(SLOT_OF["Amulet of Light"], "amulet");
  assert.equal(SLOT_OF["Amulet of Stone"], "amulet");
  assert.equal(SLOT_OF["Pendant of Fortitude"], "amulet");
  assert.equal(SLOT_OF["Helm of Knowledge"], "helm");
  assert.equal(SLOT_OF["Gauntlet of the Giant"], "helm");
});

test("SLOT_OF maps every CLOAKS row to cloak and every STAVES row to staff", () => {
  for (const row of CLOAKS) assert.equal(SLOT_OF[row.n], "cloak", `${row.n} must map to cloak`);
  for (const row of STAVES) assert.equal(SLOT_OF[row.n], "staff", `${row.n} must map to staff`);
});

test("JEWELRY/CLOAKS/STAVES have 8 rows each, no row carries an own slot key, and eff.wp is never present", () => {
  for (const table of [JEWELRY, CLOAKS, STAVES]) {
    assert.equal(table.length, 8);
    for (const row of table) {
      assert.equal("slot" in row, false, `${row.n} must not carry a slot key`);
      if (row.eff) assert.equal("wp" in row.eff, false, `${row.n}.eff must never carry wp`);
    }
  }
});

test("JEWELRY row shapes are byte-identical to the pre-Phase-37 literals", () => {
  const pins = {
    "Ring of Power": { eff: { dmg: 1 }, txt: "+1 damage to all attacks" },
    "Gauntlet of the Giant": { eff: { size: 1 }, txt: "one size larger" },
    "Amulet of Light": { eff: { sight: 1, light: 1 }, txt: "a standing light spell; dispels darkness" },
    "Pendant of Fortitude": { eff: {}, use: "half", every: 100, txt: "half damage from one attack, once every 100 squares" },
    "Anklet of Invisibility": { eff: { foeToHit: -2 }, txt: "unseen; foes need two better to land" },
    "Helm of Knowledge": { eff: { tongue: 1 }, txt: "perfect fluency in one language" },
    "Bracelet of Flight": { eff: { fly: 1 }, txt: "flight — walls and crevices are nothing" },
    "Amulet of Stone": { eff: {}, use: "stone", every: 200, aoe: 4, txt: "turns up to 4 squares of opponents to stone, once every 200 squares" },
  };
  for (const row of JEWELRY) {
    const { n, ...rest } = row;
    assert.deepStrictEqual(rest, pins[n], `${n} row drifted from its pre-Phase-37 literal`);
  }
});

test("rollJewel/rollCloak/rollStaff and a Thief's starting cloak never carry a slot key (tripwire)", () => {
  const rng = makeRng(7);
  assert.equal("slot" in rollJewel(rng), false);
  assert.equal("slot" in rollCloak(rng), false);
  assert.equal("slot" in rollStaff(rng), false);
  const thief = newRun(2).c; // seed 2 is a Thief per the chargen fixture
  assert.equal(thief.cls, "Thief");
  assert.equal(thief.items.length > 0, true);
  for (const it of thief.items) assert.equal("slot" in it, false, `${it.n} must not carry a slot key`);
});

/* ============================================================
 * engine/derived.js: WORN_SLOTS / slotFor / carriedItems
 * ============================================================ */

test("WORN_SLOTS is the frozen six-slot order", () => {
  assert.deepStrictEqual(WORN_SLOTS, ["ring", "bracelet", "amulet", "helm", "cloak", "staff"]);
  assert.ok(Object.isFrozen(WORN_SLOTS));
});

test("slotFor derives from it.slot first, else SLOT_OF, else kind fallback for cloak/staff, else null", () => {
  assert.equal(slotFor({ kind: "jewel", n: "Ring of Power" }), "ring");
  assert.equal(slotFor({ kind: "cloak", n: "Cloak of Speed" }), "cloak");
  assert.equal(slotFor({ kind: "staff", n: "Oak Staff" }), "staff");
  assert.equal(slotFor({ kind: "cloak", n: "Unknown Cloak" }), "cloak");
  assert.equal(slotFor({ kind: "staff", n: "Unknown Staff" }), "staff");
  assert.equal(slotFor({ kind: "jewel", n: "Unknown Trinket" }), null);
  assert.equal(slotFor({ kind: "potion", n: "Healing potion" }), null);
  assert.equal(slotFor({ kind: "weapon", n: "Axe" }), null);
  assert.equal(slotFor({ kind: "jewel", n: "Ring of Power", slot: "amulet" }), "amulet");
  assert.equal(slotFor(null), null);
  assert.equal(slotFor({}), null);
});

test("carriedItems returns bag items followed by truthy worn entries, defensively, without mutating", () => {
  const a = { n: "a" };
  const b = { n: "b" };
  const r = { n: "Ring of Power" };
  assert.deepStrictEqual(carriedItems({ items: [a, b] }), [a, b]);
  const c2 = { items: [a], worn: { ring: r, cloak: null } };
  const before = JSON.stringify(c2);
  assert.deepStrictEqual(carriedItems(c2), [a, r]);
  assert.equal(JSON.stringify(c2), before, "carriedItems must never mutate its input");
  assert.deepStrictEqual(carriedItems({}), []);
  assert.deepStrictEqual(carriedItems({ worn: { ring: r } }), [r]);
});

/* ============================================================
 * eff(c, key) — two-path
 * ============================================================ */

test("eff legacy path (no worn key): sums over c.items exactly like before", () => {
  const ring = { n: "Ring of Power", eff: { dmg: 1 } };
  assert.equal(eff({ items: [ring, ring, ring] }, "dmg"), 3);
  for (const key of EFF_KEYS) assert.equal(eff({ items: [] }, key), 0);
  for (const key of EFF_KEYS) assert.equal(eff({}, key), 0);
});

test("eff new-model path (worn key present): sums over c.worn only, never c.items", () => {
  const ring = { n: "Ring of Power", eff: { dmg: 1 } };
  const gauntlet = { n: "Gauntlet of the Giant", eff: { size: 1 } };
  assert.equal(eff({ items: [ring, ring, ring], worn: { ring } }, "dmg"), 1);
  assert.equal(eff({ items: [ring], worn: {} }, "dmg"), 0);
  const c3 = { items: [], worn: { ring, helm: gauntlet } };
  assert.equal(eff(c3, "dmg"), 1);
  assert.equal(eff(c3, "size"), 1);
});

test("eff skips null/undefined worn entries", () => {
  const c = { worn: { ring: null, cloak: undefined } };
  for (const key of EFF_KEYS) assert.equal(eff(c, key), 0);
});

test("a c with worn survives a JSON round-trip with identical eff results", () => {
  const ring = { n: "Ring of Power", eff: { dmg: 1 } };
  const c = { items: [], worn: { ring } };
  const round = JSON.parse(JSON.stringify(c));
  for (const key of EFF_KEYS) assert.equal(eff(round, key), eff(c, key));
});

/* ============================================================
 * hasItemNamed / isFlying / conditionsOf via carriedItems
 * ============================================================ */

test("hasItemNamed/isFlying/conditionsOf see a worn item exactly as they saw it in the bag", () => {
  const bracelet = { n: "Bracelet of Flight", kind: "jewel", eff: { fly: 1 } };
  const wornState = { c: { items: [], worn: { bracelet }, haste: 0 } };
  assert.equal(hasItemNamed(wornState.c, "Bracelet of Flight"), true);
  assert.equal(isFlying(wornState), true);
  const conds = conditionsOf(wornState);
  assert.ok(conds.some((x) => x.key === "flight" && x.flight === "always"));

  const cloakFlying = { n: "Cloak of Flying", kind: "cloak", eff: { fly: 1 } };
  const cloakState = { c: { items: [], worn: { cloak: cloakFlying }, flightLeft: 5, flightCooldown: 0, haste: 0 } };
  const condsCloak = conditionsOf(cloakState);
  assert.ok(condsCloak.some((x) => x.key === "flight" && x.flight === "charged" && x.remaining === 5));

  const legacyState = { c: { items: [bracelet], haste: 0 } };
  assert.equal(hasItemNamed(legacyState.c, "Bracelet of Flight"), true);
  assert.equal(isFlying(legacyState), true);
});

/* ============================================================
 * reconcileWorn
 * ============================================================ */

test("reconcileWorn moves the first item of each slot type into c.worn, in WORN_SLOTS order, leaving later duplicates bagged", () => {
  const ring1 = { n: "Ring of Power", kind: "jewel" };
  const ring2 = { n: "Ring of Power", kind: "jewel" };
  const cloakA = { n: "Cloak of Speed", kind: "cloak" };
  const cloakB = { n: "Cloak of Healing", kind: "cloak" };
  const potion = { n: "Healing potion", kind: "potion" };
  const picks = { n: "Lockpicks", kind: "picks" };
  const c = { cls: "Fighter", items: [ring1, ring2, cloakA, potion, picks, cloakB] };

  const report = reconcileWorn(c);
  assert.deepStrictEqual(report, [
    { slot: "ring", worn: "Ring of Power", bagged: ["Ring of Power"] },
    { slot: "cloak", worn: "Cloak of Speed", bagged: ["Cloak of Healing"] },
  ]);
  assert.deepStrictEqual(c.worn, { ring: ring1, cloak: cloakA });
  assert.equal(c.worn.ring, ring1, "same object identity");
  assert.equal(c.worn.cloak, cloakA, "same object identity");
  assert.deepStrictEqual(c.items, [ring2, potion, picks, cloakB]);

  const secondReport = reconcileWorn(c);
  assert.equal(secondReport, null, "never re-migrates a present worn key");
  assert.deepStrictEqual(c.worn, { ring: ring1, cloak: cloakA }, "unchanged by the second call");
});

test("reconcileWorn on an empty Thief returns [] and sets c.worn to {}", () => {
  const c = { cls: "Thief", items: [] };
  const report = reconcileWorn(c);
  assert.deepStrictEqual(report, []);
  assert.deepStrictEqual(c.worn, {});
});

test("reconcileWorn: a staff stays bagged for a non-Magic-User and is worn for a Magic User", () => {
  const staff = { n: "Oak Staff", kind: "staff" };
  const fighter = { cls: "Fighter", items: [staff] };
  const reportF = reconcileWorn(fighter);
  assert.deepStrictEqual(reportF, []);
  assert.deepStrictEqual(fighter.worn, {});
  assert.deepStrictEqual(fighter.items, [staff]);

  const staff2 = { n: "Oak Staff", kind: "staff" };
  const mu = { cls: "Magic User", items: [staff2] };
  const reportM = reconcileWorn(mu);
  assert.deepStrictEqual(reportM, [{ slot: "staff", worn: "Oak Staff", bagged: [] }]);
  assert.deepStrictEqual(mu.worn, { staff: staff2 });
  assert.deepStrictEqual(mu.items, []);
});

test("reconcileWorn(null) / reconcileWorn([]) return null without throwing", () => {
  assert.equal(reconcileWorn(null), null);
  assert.equal(reconcileWorn([]), null);
});

test("reconcileWorn report objects carry exactly the keys slot, worn, bagged", () => {
  const ring = { n: "Ring of Power", kind: "jewel" };
  const c = { cls: "Fighter", items: [ring] };
  const [entry] = reconcileWorn(c);
  assert.deepStrictEqual(Object.keys(entry).sort(), ["bagged", "slot", "worn"]);
});

/* ============================================================
 * legacy-equivalence pinned table
 * ============================================================ */

test("legacy-equivalence: every chargen fixture seed has no worn key and eff matches the pinned pre-refactor table", () => {
  for (const seed of CHARGEN_SEEDS) {
    const c = newRun(seed).c;
    assert.equal("worn" in c, false, `seed ${seed}: newRun must not create c.worn`);
    for (const key of EFF_KEYS) {
      const expected = (LEGACY_EFF_PINS[seed] && LEGACY_EFF_PINS[seed][key]) || 0;
      assert.equal(eff(c, key), expected, `seed ${seed} key ${key}`);
    }
  }
});

// --- Plan 01 Task 3: invariant + parity proofs ---

/** wornOnlySum(c, key) — a local oracle summing ONLY over Object.values(c.worn
 * || {}), independent of eff()'s own implementation, so the invariant test
 * below is a genuine cross-check rather than eff() grading its own homework. */
function wornOnlySum(c, key) {
  let t = 0;
  for (const it of Object.values(c.worn || {})) if (it && it.eff && it.eff[key]) t += it.eff[key];
  return t;
}

test("companion invariant: no populated c.worn[slot] item is ever also present in c.items, and eff matches wornOnlySum", () => {
  const ring1 = { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 } };
  const ring2 = { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 } };
  const cloakA = { n: "Cloak of Speed", kind: "cloak", eff: {} };
  const cloakB = { n: "Cloak of Healing", kind: "cloak", eff: { cloakHeal: 1 } };
  const gauntlet = { n: "Gauntlet of the Giant", kind: "jewel", eff: { size: 1 } };

  // (a) a hand-built worn state
  const stateA = { items: [ring2], worn: { ring: ring1 } };
  // (b) the reconcileWorn output for a mixed bag
  const stateB = { cls: "Fighter", items: [ring1, ring2, cloakA, cloakB, gauntlet] };
  reconcileWorn(stateB);
  // (c) a state built by planting c.worn = {} on newRun(2).c then calling
  // reconcileWorn — proves the "never re-migrate a present worn key" refusal
  // path (Task 1) leaves the invariant trivially (vacuously) true: an empty
  // worn map, unchanged by the no-op call.
  const stateC = newRun(2).c;
  stateC.worn = {};
  const reportC = reconcileWorn(stateC);
  assert.equal(reportC, null, "reconcileWorn refuses to touch a c that already carries a worn key, even an empty one");

  for (const c of [stateA, stateB, stateC]) {
    assert.ok(c.worn && typeof c.worn === "object", "state must carry c.worn");
    const wornItems = Object.values(c.worn).filter(Boolean);
    for (const it of wornItems) {
      assert.equal(c.items.includes(it), false, `${it.n} must not also be present in c.items`);
    }
    for (const key of EFF_KEYS) {
      assert.equal(eff(c, key), wornOnlySum(c, key), `state key ${key} must equal wornOnlySum`);
    }
  }
});

test("chargen shape: newRun(seed).c never carries worn, and two fresh newRun calls in the same process are byte-identical", () => {
  for (const seed of CHARGEN_SEEDS) {
    const a = newRun(seed);
    const b = newRun(seed);
    assert.equal("worn" in a.c, false);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `seed ${seed}: newRun must stay byte-identical across calls in the same process`);
  }
});

test("rng invariance: 20 legal moves from newRun(3) never create c.worn and produce a deterministic rngState/event sequence", () => {
  const DIRS = ["N", "E", "S", "W"];
  function drive() {
    let state = newRun(3);
    const eventTypes = [];
    for (let i = 0; i < 20; i++) {
      const dir = DIRS[i % DIRS.length];
      const result = applyAction(state, { type: "move", dir });
      state = result.state;
      for (const ev of result.events) eventTypes.push(ev.type);
    }
    return { rngState: state.rngState, eventTypes, worn: "worn" in state.c };
  }
  const run1 = drive();
  const run2 = drive();
  assert.equal(run1.rngState, run2.rngState);
  assert.deepStrictEqual(run1.eventTypes, run2.eventTypes);
  assert.equal(run1.worn, false, "no code path in this plan creates c.worn during play");
  assert.equal(run2.worn, false);
});
