// test/unit/worn-model.test.js
//
// Phase 37 Plan 01 (GEAR-03/GEAR-04) — the worn-slot data model. Proves:
//   - the slot taxonomy (content/treasure-tables.js SLOT_OF, 15 entries —
//     260918-w4n: 8 JEWELRY + 7 CLOAKS; a staff has NO slot) and that no
//     exported JEWELRY/CLOAKS/STAVES row (or any rolled item) ever carries a
//     `slot` key;
//   - engine/derived.js's WORN_SLOTS (five keys)/slotFor/carriedItems/
//     reconcileWorn;
//   - eff(c, key) is timer-only (260918-w4n, use-activated-only): an effect
//     exists only while its own item:<name> c.timers record is live — a bag
//     copy or a worn-but-unused item never counts;
//   - a live item effect (therefore isFlying/conditionsOf) reads through
//     itemEffectActive, keyed by the record's own name, not a bag∪worn scan;
//   - the companion invariant (no worn item is ever double-counted from the
//     bag) and rng/parity proofs (Task 3).
//
// No cross-test-file imports (project convention for these deterministic
// unit suites) — every rng/state helper this file needs is defined or
// imported directly.

import test from "node:test";
import assert from "node:assert/strict";

import { JEWELRY, CLOAKS, STAVES, SLOT_OF, ACTIVATION_OF } from "../../content/index.js";
import {
  WORN_SLOTS,
  SLOT_FAMILIES,
  WORN_KEYS_OF,
  WORN_FAMILY_OF,
  freeWornKey,
  slotFor,
  carriedItems,
  reconcileWorn,
  eff,
  itemEffectActive,
  isFlying,
  conditionsOf,
} from "../../engine/derived.js";
import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { rollJewel, rollCloak, rollStaff } from "../../engine/items.js";
import { makeRng } from "../../engine/rng.js";

const CHARGEN_SEEDS = [1, 2, 3, 4, 6, 7, 8, 13, 15, 19, 24, 29, 32, 35];
const EFF_KEYS = ["dmg", "size", "sight", "light", "foeToHit", "tongue", "fly", "noCrit", "cloakRegen", "cloakArmor"];

/** liveRecord(cadence, left, cd) — a plain c.timers "effect"-phase record,
 * matching what buildActivation/applyActivation actually produce. */
function liveRecord(left, cd) {
  const r = { cadence: "squares", left, phase: "effect" };
  if (cd !== undefined) r.cd = cd;
  return r;
}

/* ============================================================
 * Slot taxonomy (content/treasure-tables.js)
 * ============================================================ */

test("SLOT_OF has exactly 15 own keys (8 JEWELRY + 7 CLOAKS; a staff has no slot) and is frozen", () => {
  assert.equal(Object.keys(SLOT_OF).length, 15);
  assert.ok(Object.isFrozen(SLOT_OF));
  for (const row of STAVES) assert.equal(SLOT_OF[row.n], undefined, `${row.n} must not have a slot`);
});

test("SLOT_OF matches the locked taxonomy for every JEWELRY name — 260918-wy1: all 8 map to the single family jewelry", () => {
  assert.equal(SLOT_OF["Ring of Power"], "jewelry");
  assert.equal(SLOT_OF["Bracelet of Flight"], "jewelry");
  assert.equal(SLOT_OF["Anklet of Invisibility"], "jewelry");
  assert.equal(SLOT_OF["Amulet of Light"], "jewelry");
  assert.equal(SLOT_OF["Amulet of Stone"], "jewelry");
  assert.equal(SLOT_OF["Pendant of Fortitude"], "jewelry");
  assert.equal(SLOT_OF["Helm of Knowledge"], "jewelry");
  assert.equal(SLOT_OF["Gauntlet of the Giant"], "jewelry");
  for (const row of JEWELRY) assert.equal(SLOT_OF[row.n], "jewelry", `${row.n} must map to jewelry`);
});

test("SLOT_OF's value set is exactly {jewelry, cloak} across all 15 entries", () => {
  assert.equal(Object.keys(SLOT_OF).length, 15);
  assert.deepStrictEqual([...new Set(Object.values(SLOT_OF))].sort(), ["cloak", "jewelry"]);
});

test("SLOT_OF maps every CLOAKS row to cloak; STAVES rows are absent (260918-w4n staff amendment)", () => {
  for (const row of CLOAKS) assert.equal(SLOT_OF[row.n], "cloak", `${row.n} must map to cloak`);
  for (const row of STAVES) assert.equal(row.n in SLOT_OF, false, `${row.n} must not be in SLOT_OF`);
});

test("JEWELRY (8)/CLOAKS (7, the dropped healing cloak removed)/STAVES (8) rows carry no own slot/act key, and eff.wp is never present", () => {
  assert.equal(JEWELRY.length, 8);
  assert.equal(CLOAKS.length, 7);
  assert.equal(STAVES.length, 8);
  for (const table of [JEWELRY, CLOAKS, STAVES]) {
    for (const row of table) {
      assert.equal("slot" in row, false, `${row.n} must not carry a slot key`);
      assert.equal("act" in row, false, `${row.n} must not carry an act key`);
      if (row.eff) assert.equal("wp" in row.eff, false, `${row.n}.eff must never carry wp`);
    }
  }
  assert.equal(CLOAKS.some((r) => r.n === "Cloak of Healing"), false, "the dropped healing cloak no longer exists");
});

test("JEWELRY row eff payloads are byte-identical to the pre-260918-w4n literals (only txt/act changed)", () => {
  const effPins = {
    "Ring of Power": { dmg: 1 },
    "Gauntlet of the Giant": { size: 1 },
    "Amulet of Light": { sight: 1, light: 1 },
    "Pendant of Fortitude": {},
    "Anklet of Invisibility": { foeToHit: -2 },
    "Helm of Knowledge": { tongue: 1 },
    "Bracelet of Flight": { fly: 1 },
    "Amulet of Stone": {},
  };
  for (const row of JEWELRY) {
    assert.deepStrictEqual(row.eff, effPins[row.n], `${row.n}.eff drifted`);
  }
});

test("rollJewel/rollCloak/rollStaff and a Thief's starting cloak never carry a slot key (tripwire)", () => {
  const rng = makeRng(7);
  assert.equal("slot" in rollJewel(rng), false);
  assert.equal("slot" in rollCloak(rng), false);
  assert.equal("slot" in rollStaff(rng), false);
  const thief = newRun(2).c; // seed 2 is a Thief per the chargen fixture
  assert.equal(thief.cls, "Thief");
  // Phase 45 (HEDGE-01): the starting cloak is now WORN at chargen, not
  // bagged — c.items is empty for this Thief; the roll itself is checked on
  // c.worn.cloak instead.
  assert.deepStrictEqual(thief.items, []);
  assert.ok(thief.worn && thief.worn.cloak, "a Thief's starting cloak is worn at chargen");
  assert.equal("slot" in thief.worn.cloak, false, `${thief.worn.cloak.n} must not carry a slot key`);
  for (const it of thief.items) assert.equal("slot" in it, false, `${it.n} must not carry a slot key`);
});

/* ============================================================
 * engine/derived.js: WORN_SLOTS / slotFor / carriedItems
 * ============================================================ */

test("WORN_SLOTS is the frozen three-key order (260918-wy1: jewelry1, jewelry2, cloak) and equals the flatMap of WORN_KEYS_OF over SLOT_FAMILIES", () => {
  assert.deepStrictEqual(WORN_SLOTS, ["jewelry1", "jewelry2", "cloak"]);
  assert.ok(Object.isFrozen(WORN_SLOTS));
  assert.deepStrictEqual(WORN_SLOTS, SLOT_FAMILIES.flatMap((f) => WORN_KEYS_OF[f]));
});

test("SLOT_FAMILIES / WORN_KEYS_OF / WORN_FAMILY_OF are the frozen family tables", () => {
  assert.deepStrictEqual(SLOT_FAMILIES, ["jewelry", "cloak"]);
  assert.ok(Object.isFrozen(SLOT_FAMILIES));
  assert.deepStrictEqual(WORN_KEYS_OF, { jewelry: ["jewelry1", "jewelry2"], cloak: ["cloak"] });
  assert.ok(Object.isFrozen(WORN_KEYS_OF));
  assert.ok(Object.isFrozen(WORN_KEYS_OF.jewelry));
  assert.ok(Object.isFrozen(WORN_KEYS_OF.cloak));
  assert.deepStrictEqual(WORN_FAMILY_OF, { jewelry1: "jewelry", jewelry2: "jewelry", cloak: "cloak" });
  assert.ok(Object.isFrozen(WORN_FAMILY_OF));
  assert.equal(WORN_FAMILY_OF.jewelry2, "jewelry");
});

test("freeWornKey is the one first-free-key rule: jewelry1 on empty, jewelry2 once jewelry1 is worn, null when both are; cloak / null; never creates c.worn", () => {
  assert.equal(freeWornKey({}, "jewelry"), "jewelry1");
  assert.equal(freeWornKey({ worn: {} }, "jewelry"), "jewelry1");
  assert.equal(freeWornKey({ worn: { jewelry1: { n: "Ring of Power" } } }, "jewelry"), "jewelry2");
  assert.equal(
    freeWornKey({ worn: { jewelry1: { n: "a" }, jewelry2: { n: "b" } } }, "jewelry"),
    null,
    "both jewelry keys occupied",
  );
  assert.equal(freeWornKey({}, "cloak"), "cloak");
  assert.equal(freeWornKey({ worn: { cloak: { n: "Cloak of Speed" } } }, "cloak"), null);
  assert.equal(freeWornKey({}, "unknown-family"), null);
  const c = {};
  assert.equal(freeWornKey(c, "jewelry"), "jewelry1");
  assert.equal("worn" in c, false, "freeWornKey is a pure read — never creates c.worn");
});

test("slotFor returns the FAMILY: it.slot first, else SLOT_OF, else jewel/cloak kind fallback, else null; a staff is ALWAYS null", () => {
  assert.equal(slotFor({ kind: "jewel", n: "Ring of Power" }), "jewelry");
  assert.equal(slotFor({ kind: "cloak", n: "Cloak of Speed" }), "cloak");
  assert.equal(slotFor({ kind: "cloak", n: "Unknown Cloak" }), "cloak");
  assert.equal(slotFor({ kind: "jewel", n: "Unknown Trinket" }), "jewelry", "260918-wy1: jewel kind fallback, mirrors the cloak fallback");
  assert.equal(slotFor({ kind: "staff", n: "Oak Staff" }), null, "260918-w4n: a staff has no slot anywhere");
  assert.equal(slotFor({ kind: "staff", n: "Unknown Staff" }), null);
  assert.equal(slotFor({ kind: "potion", n: "Healing potion" }), null);
  assert.equal(slotFor({ kind: "weapon", n: "Axe" }), null);
  assert.equal(slotFor({ kind: "jewel", n: "Ring of Power", slot: "cloak" }), "cloak", "it.slot forward-compat wins first");
  assert.equal(slotFor(null), null);
  assert.equal(slotFor({}), null);
  for (const row of JEWELRY) assert.equal(slotFor({ kind: "jewel", n: row.n }), "jewelry", `${row.n} must resolve to jewelry`);
  for (const row of CLOAKS) assert.equal(slotFor({ kind: "cloak", n: row.n }), "cloak", `${row.n} must resolve to cloak`);
});

test("carriedItems returns bag items followed by truthy worn entries, defensively, without mutating — shape-agnostic across jewelry1/jewelry2/cloak", () => {
  const a = { n: "a" };
  const b = { n: "b" };
  const r = { n: "Ring of Power" };
  assert.deepStrictEqual(carriedItems({ items: [a, b] }), [a, b]);
  const c2 = { items: [a], worn: { jewelry1: r, jewelry2: null, cloak: null } };
  const before = JSON.stringify(c2);
  assert.deepStrictEqual(carriedItems(c2), [a, r]);
  assert.equal(JSON.stringify(c2), before, "carriedItems must never mutate its input");
  assert.deepStrictEqual(carriedItems({}), []);
  assert.deepStrictEqual(carriedItems({ worn: { jewelry1: r } }), [r]);
  const anklet = { n: "Anklet of Invisibility" };
  assert.deepStrictEqual(carriedItems({ worn: { jewelry1: r, jewelry2: anklet } }).sort((x, y) => x.n.localeCompare(y.n)), [anklet, r]);
});

/* ============================================================
 * eff(c, key) — timer-only (260918-w4n, use-activated-only)
 * ============================================================ */

test("eff sums a key ONLY across LIVE item:<name> records — a bagged copy contributes nothing, worn or not", () => {
  const ring = { n: "Ring of Power", eff: { dmg: 1 } };
  // Bagged, no c.worn, no live record — a plain item in c.items never
  // contributes any more (the retired two-path bag-sum rule).
  assert.equal(eff({ items: [ring, ring, ring] }, "dmg"), 0);
  for (const key of EFF_KEYS) assert.equal(eff({ items: [] }, key), 0);
  for (const key of EFF_KEYS) assert.equal(eff({}, key), 0);

  // Worn but with no live timers record — still nothing (worn-but-unused
  // grants nothing).
  assert.equal(eff({ items: [], worn: { ring } }, "dmg"), 0);

  // A LIVE item:Ring of Power record — now it contributes, regardless of
  // whether the item object itself is bagged, worn, or absent from c
  // entirely (eff() reads the record's OWN act.eff via ACTIVATION_OF, not
  // the item object at all).
  const live = { timers: { "item:Ring of Power": liveRecord(50, 50) } };
  assert.equal(eff(live, "dmg"), 1);
  const liveAndWorn = { items: [], worn: { ring }, timers: { "item:Ring of Power": liveRecord(50, 50) } };
  assert.equal(eff(liveAndWorn, "dmg"), 1);

  // Two DIFFERENT live records both contribute (summed, insertion order).
  const gauntletLive = {
    timers: {
      "item:Ring of Power": liveRecord(50, 50),
      "item:Gauntlet of the Giant": liveRecord(50, 50),
    },
  };
  assert.equal(eff(gauntletLive, "dmg"), 1);
  assert.equal(eff(gauntletLive, "size"), 1);
});

test("eff skips a cooling (not effect-phase) record, an unresolvable key, and a non-numeric eff entry", () => {
  const c = {
    timers: {
      "item:Ring of Power": { cadence: "squares", left: 50, cd: 50, phase: "cooldown" }, // cooling, not live
      "item:Bogus Item": liveRecord(50), // unresolvable ACTIVATION_OF key
    },
  };
  for (const key of EFF_KEYS) assert.equal(eff(c, key), 0);
});

test("a c with a live timers record survives a JSON round-trip with identical eff results", () => {
  const c = { timers: { "item:Ring of Power": liveRecord(50, 50) } };
  const round = JSON.parse(JSON.stringify(c));
  for (const key of EFF_KEYS) assert.equal(eff(round, key), eff(c, key));
});

/* ============================================================
 * itemEffectActive / isFlying / conditionsOf — timer-only reads
 * ============================================================ */

test("itemEffectActive/isFlying/conditionsOf key off a LIVE record's own act.kind, not a bag∪worn name scan", () => {
  const bracelet = { n: "Bracelet of Flight", kind: "jewel", eff: { fly: 1 } };
  // Worn but with no live record — NOT flying, no flight chip at all
  // (260918-w4n retires the old "worn Bracelet is unconditionally flying"
  // rule).
  const wornUnused = { c: { items: [], worn: { bracelet } } };
  assert.equal(isFlying(wornUnused), false);
  assert.deepStrictEqual(conditionsOf(wornUnused), []);

  // Worn AND with a live fly record — flying, with a flight chip.
  const wornLive = {
    c: { items: [], worn: { bracelet }, timers: { "item:Bracelet of Flight": liveRecord(20, 50) } },
  };
  assert.equal(isFlying(wornLive), true);
  const conds = conditionsOf(wornLive);
  assert.ok(conds.some((x) => x.key === "flight" && x.flight === "charged" && x.remaining === 20));

  const cloakState = {
    c: { items: [], timers: { "item:Cloak of Flying": { cadence: "squares", left: 5, cd: 50, phase: "effect" } } },
  };
  const condsCloak = conditionsOf(cloakState);
  assert.ok(condsCloak.some((x) => x.key === "flight" && x.flight === "charged" && x.remaining === 5));
  assert.equal(itemEffectActive(cloakState.c, "fly"), true);

  // A legacy state (no c.worn at all) with a bagged item but NO live
  // record — still not flying; the record is what matters, not the bag.
  const legacyState = { c: { items: [bracelet] } };
  assert.equal(isFlying(legacyState), false);
});

/* ============================================================
 * reconcileWorn
 * ============================================================ */

test("reconcileWorn moves up to TWO jewelry items and one cloak into c.worn, in SLOT_FAMILIES order, leaving later duplicates bagged (per-family report, worn as an array)", () => {
  const ring1 = { n: "Ring of Power", kind: "jewel" };
  const anklet = { n: "Anklet of Invisibility", kind: "jewel" };
  const helm = { n: "Helm of Knowledge", kind: "jewel" };
  const cloakA = { n: "Cloak of Speed", kind: "cloak" };
  const cloakB = { n: "Cloak of Strength", kind: "cloak" };
  const potion = { n: "Healing potion", kind: "potion" };
  const picks = { n: "Lockpicks", kind: "picks" };
  const c = { cls: "Fighter", items: [ring1, anklet, helm, cloakA, potion, picks, cloakB] };

  const report = reconcileWorn(c);
  assert.deepStrictEqual(report, [
    { slot: "jewelry", worn: ["Ring of Power", "Anklet of Invisibility"], bagged: ["Helm of Knowledge"] },
    { slot: "cloak", worn: ["Cloak of Speed"], bagged: ["Cloak of Strength"] },
  ]);
  assert.deepStrictEqual(c.worn, { jewelry1: ring1, jewelry2: anklet, cloak: cloakA });
  assert.equal(c.worn.jewelry1, ring1, "same object identity");
  assert.equal(c.worn.jewelry2, anklet, "same object identity");
  assert.equal(c.worn.cloak, cloakA, "same object identity");
  assert.deepStrictEqual(c.items, [helm, potion, picks, cloakB]);

  const secondReport = reconcileWorn(c);
  assert.equal(secondReport, null, "never re-migrates a present worn key");
  assert.deepStrictEqual(c.worn, { jewelry1: ring1, jewelry2: anklet, cloak: cloakA }, "unchanged by the second call");
});

test("reconcileWorn: the five-item bag from the plan's own behavior list wears Ring+Anklet into jewelry1/jewelry2, Cloak of Speed into cloak, bags Helm+Amulet", () => {
  const ring = { n: "Ring of Power", kind: "jewel" };
  const anklet = { n: "Anklet of Invisibility", kind: "jewel" };
  const helm = { n: "Helm of Knowledge", kind: "jewel" };
  const cloakOfSpeed = { n: "Cloak of Speed", kind: "cloak" };
  const amulet = { n: "Amulet of Light", kind: "jewel" };
  const c = { cls: "Fighter", items: [ring, anklet, helm, cloakOfSpeed, amulet] };
  const report = reconcileWorn(c);
  assert.deepStrictEqual(report, [
    { slot: "jewelry", worn: ["Ring of Power", "Anklet of Invisibility"], bagged: ["Helm of Knowledge", "Amulet of Light"] },
    { slot: "cloak", worn: ["Cloak of Speed"], bagged: [] },
  ]);
});

test("reconcileWorn on an empty Thief returns [] and sets c.worn to {}", () => {
  const c = { cls: "Thief", items: [] };
  const report = reconcileWorn(c);
  assert.deepStrictEqual(report, []);
  assert.deepStrictEqual(c.worn, {});
});

test("reconcileWorn: 260918-w4n — a staff ALWAYS stays bagged, for a non-Magic-User AND a Magic User (it has no slot)", () => {
  const staff = { n: "Oak Staff", kind: "staff" };
  const fighter = { cls: "Fighter", items: [staff] };
  const reportF = reconcileWorn(fighter);
  assert.deepStrictEqual(reportF, []);
  assert.deepStrictEqual(fighter.worn, {});
  assert.deepStrictEqual(fighter.items, [staff]);

  const staff2 = { n: "Oak Staff", kind: "staff" };
  const mu = { cls: "Magic User", items: [staff2] };
  const reportM = reconcileWorn(mu);
  assert.deepStrictEqual(reportM, [], "a staff never wears, even for a Magic User");
  assert.deepStrictEqual(mu.worn, {});
  assert.deepStrictEqual(mu.items, [staff2], "the staff stays bagged with no report entry");
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
 * chargen: no fresh character ever starts with a live item effect
 * ============================================================ */

// 260918-w4n (use-activated-only): eff() is now timer-only — there is no
// more "legacy path" to pin against a bag-sum table. What DOES still hold
// for every fresh chargen seed is that NOTHING starts pre-activated: a
// brand-new character carries no c.timers key at all, so every eff() read
// is 0 regardless of what a Thief's starting cloak roll happens to be.
test("chargen: every fixture seed starts with no c.timers key, so every eff() read is 0", () => {
  for (const seed of CHARGEN_SEEDS) {
    const c = newRun(seed).c;
    assert.equal(typeof c.worn, "object", `seed ${seed}: newRun always creates c.worn (Phase 45, HEDGE-01)`);
    assert.equal("timers" in c, false, `seed ${seed}: newRun must not create c.timers`);
    for (const key of EFF_KEYS) assert.equal(eff(c, key), 0, `seed ${seed} key ${key}`);
  }
});

// --- Plan 01 Task 3: invariant + parity proofs ---

/** liveOnlySum(c, key) — a local oracle summing ONLY over live item:<name>
 * c.timers records whose act carries the numeric key, walking ACTIVATION_OF
 * independently of eff()'s own implementation, so the invariant test below
 * is a genuine cross-check rather than eff() grading its own homework. */
function liveOnlySum(c, key) {
  let t = 0;
  for (const id of Object.keys(c.timers || {})) {
    if (!id.startsWith("item:")) continue;
    const rec = c.timers[id];
    if (!rec || rec.phase !== "effect" || !(rec.left > 0)) continue;
    const act = ACTIVATION_OF[id.slice("item:".length)];
    if (act && act.eff && typeof act.eff[key] === "number") t += act.eff[key];
  }
  return t;
}

test("companion invariant: no populated c.worn[slot] item is ever also present in c.items, and eff matches liveOnlySum", () => {
  const ring1 = { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 } };
  const ring2 = { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 } };
  const cloakA = { n: "Cloak of Speed", kind: "cloak", eff: {} };
  const cloakB = { n: "Cloak of Strength", kind: "cloak", eff: { noCrit: 1 } };
  const gauntlet = { n: "Gauntlet of the Giant", kind: "jewel", eff: { size: 1 } };

  // (a) a hand-built worn state with a live Ring of Power record.
  const stateA = { items: [ring2], worn: { jewelry1: ring1 }, timers: { "item:Ring of Power": liveRecord(50, 50) } };
  // (b) the reconcileWorn output for a mixed bag, with a live Gauntlet record.
  const stateB = { cls: "Fighter", items: [ring1, ring2, cloakA, cloakB, gauntlet] };
  reconcileWorn(stateB);
  stateB.timers = { "item:Gauntlet of the Giant": liveRecord(50, 50) };
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
      assert.equal(eff(c, key), liveOnlySum(c, key), `state key ${key} must equal liveOnlySum`);
    }
  }
});

test("chargen shape: newRun(seed).c always carries worn, and two fresh newRun calls in the same process are byte-identical", () => {
  for (const seed of CHARGEN_SEEDS) {
    const a = newRun(seed);
    const b = newRun(seed);
    assert.ok("worn" in a.c, `seed ${seed}: newRun always creates c.worn (Phase 45, HEDGE-01)`);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `seed ${seed}: newRun must stay byte-identical across calls in the same process`);
  }
});

test("rng invariance: 20 legal moves from newRun(3) never add a worn key beyond chargen's and produce a deterministic rngState/event sequence", () => {
  const DIRS = ["N", "E", "S", "W"];
  const chargenWornKeyCount = Object.keys(newRun(3).c.worn).length;
  function drive() {
    let state = newRun(3);
    const eventTypes = [];
    for (let i = 0; i < 20; i++) {
      const dir = DIRS[i % DIRS.length];
      const result = applyAction(state, { type: "move", dir });
      state = result.state;
      for (const ev of result.events) eventTypes.push(ev.type);
    }
    return { rngState: state.rngState, eventTypes, wornKeyCount: Object.keys(state.c.worn).length };
  }
  const run1 = drive();
  const run2 = drive();
  assert.equal(run1.rngState, run2.rngState);
  assert.deepStrictEqual(run1.eventTypes, run2.eventTypes);
  assert.equal(run1.wornKeyCount, chargenWornKeyCount, "no code path in this plan grows c.worn beyond chargen's own reconcile (1 — the cloak — for this seed's Thief)");
  assert.equal(run2.wornKeyCount, chargenWornKeyCount);
});
