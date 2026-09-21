// Phase 33 (STORE-01) — the depth-rolled store's rng-guard, pinned.
//
// Proves: the depth tiers are derived from the existing BAG_FLOORS ladder
// (no new floor table); the potion/weapon/armor/premium pools are the
// explicit allow-lists content/store-stock.js declares (the trap potion is
// never reachable); the flag-off path is byte-identical to before Phase 33
// — same stock, same rng cursor, including a save missing the key or
// carrying a truthy non-boolean; the flag-on path draws EXACTLY N extra rng
// calls (N = (potionPool.length - 1) + (weaponPool.length - 1)) after every
// existing draw, in sequence; and the stock is rewritten in place per depth
// and class, never growing the array.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { canEquipArmor } from "../../engine/items.js";
import {
  openStore,
  priceFor,
  storeTier,
  storePotionPool,
  storeWeaponPool,
  storeArmorFor,
  enchantForTier,
  replaceStockLines,
} from "../../engine/economy.js";
import { setDialsForTuning } from "../../engine/difficulty.js";
import {
  POTIONS,
  WEAPONS,
  ARMORS,
  STORE_POTION_POOL,
  STORE_WEAPON_BANDS,
  STORE_ARMOR_CAP,
  STORE_PREMIUM_BONUS,
} from "../../content/index.js";

/** heroOf(seed, cls, depth, extraForce) — a forced-class hero on an arbitrary
 * floor.depth (a plain field write, no rng — the tests never need a real
 * descent). */
function heroOf(seed, cls, depth, extraForce = {}) {
  const s = newRun(seed, [], { force: { cls, ...extraForce } });
  s.floor.depth = depth;
  return s;
}

/** letterFor(cls) — the same class-letter mapping openStore itself uses. */
function letterFor(cls) {
  return cls === "Fighter" ? "F" : cls === "Thief" ? "T" : "M";
}

/** openWith(state, storeRoll) — clones `state`, sets `storeRoll`, opens the
 * store against a fresh rng seeded from the clone's own rngState, and
 * returns the resulting stock plus the (now-advanced) rng for cursor
 * comparisons. */
function openWith(state, storeRoll) {
  const clone = structuredClone(state);
  clone.storeRoll = storeRoll;
  const rng = makeRng(clone.rngState);
  openStore(clone, rng, []);
  return { stock: clone.store.stock, rng };
}

/** applyHaggle(rawCost, haggle) — mirrors openStore's own mk()-then-haggle
 * pipeline: Math.max(1, Math.round(...)), then (if haggle < 1) a second
 * Math.round through the haggle multiplier. */
function applyHaggle(rawCost, haggle) {
  const rounded = Math.max(1, Math.round(rawCost));
  return haggle < 1 ? Math.round(rounded * haggle) : rounded;
}

const CLASSES_UNDER_TEST = ["Fighter", "Thief", "Magic User"];
const DEPTHS_UNDER_TEST = [1, 2, 4, 5, 8, 9, 20];
const STATIC_EFFECTS = new Set(["eatRation", "giveLockpicks", "repairArmor", "buyScroll", "buyRations"]);

// --- Tier + table pins ------------------------------------------------

// Phase 54 (BAND-02, USER RULING D): storeTier(depth) now reads
// difficultyCurve(depth).storeTier (the STORE_TIER global dial) instead of
// the retired STORE_TIER_FLOORS/BAG_FLOORS ladder — its identity value
// reproduces the exact same 1..12 ladder the old ladder produced.
test("storeTier(depth) reads difficultyCurve(depth).storeTier; identity reproduces 011122223333 for depths 1..12; non-finite -> 0", () => {
  const seq = Array.from({ length: 12 }, (_, i) => storeTier(i + 1)).join("");
  assert.equal(seq, "011122223333");
  assert.equal(storeTier(1), 0);
  assert.equal(storeTier(2), 1);
  assert.equal(storeTier(4), 1);
  assert.equal(storeTier(5), 2);
  assert.equal(storeTier(8), 2);
  assert.equal(storeTier(9), 3);
  assert.equal(storeTier(99), 3);
  assert.equal(storeTier(NaN), 0);
  assert.equal(storeTier(undefined), 0);
});

test("STORE_TIER under setDialsForTuning gives a different ladder: { base: 0, perDepth: 0.55 } -> 112233333333 for depths 1..12", () => {
  const restore = setDialsForTuning({ STORE_TIER: { base: 0, perDepth: 0.55 } });
  try {
    const seq = Array.from({ length: 12 }, (_, i) => storeTier(i + 1)).join("");
    assert.equal(seq, "112233333333");
  } finally {
    restore();
  }
});

test("every per-tier table has exactly one entry per tier (length 4)", () => {
  assert.equal(STORE_WEAPON_BANDS.length, 4);
  assert.equal(STORE_ARMOR_CAP.length, 4);
  assert.equal(STORE_PREMIUM_BONUS.length, 4);
  for (let t = 0; t < 4; t++) assert.ok(storePotionPool(t).length > 0, `tier ${t} potion pool must be non-empty`);
});

test("STORE_POTION_POOL is an explicit allow-list: every name exists in POTIONS, none is the trap potion", () => {
  const trapName = POTIONS[8].n;
  assert.equal(trapName, "Death", "POTIONS[8] must still be the trap entry this allow-list excludes");
  for (const entry of STORE_POTION_POOL) {
    const p = POTIONS.find((x) => x.n === entry.n);
    assert.ok(p, `${entry.n} must exist in POTIONS`);
    assert.notEqual(p.eff, "death", `${entry.n} must not be the trap potion`);
    assert.notEqual(entry.n, trapName);
  }
});

test("storePotionPool(tier) is cumulative (4/7/8/8) and never includes the trap potion", () => {
  const expected = [4, 7, 8, 8];
  for (let t = 0; t < 4; t++) {
    const pool = storePotionPool(t);
    assert.equal(pool.length, expected[t], `tier ${t} pool length`);
    for (const p of pool) assert.notEqual(p.eff, "death");
  }
});

test("STORE_ARMOR_CAP names exist in ARMORS, in ascending ar order", () => {
  let lastAr = -Infinity;
  for (const name of STORE_ARMOR_CAP) {
    const a = ARMORS.find((x) => x.name === name);
    assert.ok(a, `${name} must exist in ARMORS`);
    assert.ok(a.ar >= lastAr, "STORE_ARMOR_CAP must be non-decreasing in ar across tiers");
    lastAr = a.ar;
  }
});

test("STORE_PREMIUM_BONUS is [1, 1, 2, 3]", () => {
  assert.deepStrictEqual(STORE_PREMIUM_BONUS, [1, 1, 2, 3]);
});

test("STORE_WEAPON_BANDS: every entry has lo <= hi, and hi is non-decreasing across tiers", () => {
  let lastHi = -Infinity;
  for (const band of STORE_WEAPON_BANDS) {
    assert.ok(band.lo <= band.hi);
    assert.ok(band.hi >= lastHi);
    lastHi = band.hi;
  }
});

// --- Weapon pool pins per class letter ---------------------------------

test("storeWeaponPool(letter, tier): always >= 2, class-legal, within the band's ceiling", () => {
  for (const letter of ["F", "T", "M"]) {
    for (let tier = 0; tier < 4; tier++) {
      const pool = storeWeaponPool(letter, tier);
      assert.ok(pool.length >= 2, `${letter} tier ${tier} must offer at least 2 weapons`);
      const band = STORE_WEAPON_BANDS[tier];
      for (const w of pool) {
        assert.ok(WEAPONS[w].cls.includes(letter), `${w} must be legal for ${letter}`);
        assert.ok(WEAPONS[w].cost <= band.hi, `${w} must be at or under the tier's ceiling`);
      }
      const legal = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes(letter));
      const strict = legal.filter((w) => WEAPONS[w].cost >= band.lo && WEAPONS[w].cost <= band.hi);
      if (strict.length >= 2) {
        for (const w of pool) assert.ok(WEAPONS[w].cost >= band.lo, `${w} must respect the band floor when the strict band has >=2 legal weapons`);
      }
    }
  }
});

test("storeWeaponPool('M', 3) is the fallback: every Magic User weapon costs <= 250 < 400, so it equals every M-legal weapon <= 900", () => {
  const pool = storeWeaponPool("M", 3);
  const legal = Object.keys(WEAPONS).filter((w) => WEAPONS[w].cls.includes("M"));
  assert.ok(legal.every((w) => WEAPONS[w].cost <= 250), "fixture assumption: every M weapon costs <= 250");
  assert.deepStrictEqual([...pool].sort(), [...legal].sort());
  assert.equal(pool.length, 8);
});

test("storeWeaponPool returns a fresh array on every call (shuffle-safe)", () => {
  const a = storeWeaponPool("F", 0);
  const b = storeWeaponPool("F", 0);
  assert.notEqual(a, b);
  assert.deepStrictEqual([...a].sort(), [...b].sort());
});

// --- Flag-off identity ---------------------------------------------------

test("flag-off identity: a missing key, storeRoll: false, and a truthy non-boolean all take the SAME byte-identical path", () => {
  for (const seed of [3, 7, 42]) {
    const s = newRun(seed);
    const withFalse = openWith(s, false);

    const clone = structuredClone(s);
    delete clone.storeRoll;
    const rng2 = makeRng(clone.rngState);
    openStore(clone, rng2, []);
    assert.deepStrictEqual(clone.store.stock, withFalse.stock, `seed ${seed}: a missing storeRoll key must match storeRoll: false`);
    assert.equal(rng2.getState(), withFalse.rng.getState(), `seed ${seed}: rng cursor must match too`);

    const truthy = openWith(s, "yes");
    assert.deepStrictEqual(truthy.stock, withFalse.stock, `seed ${seed}: a truthy non-boolean must still take the flag-off path (strict === true check)`);
    assert.equal(truthy.rng.getState(), withFalse.rng.getState());
  }
});

// Phase 39 (GEAR-01): Katana re-priced 525 -> 650 and the premium Casket's
// base (Broadsword) re-priced 500 -> 550, so their Pickpocket-marked-up
// numbers move too (Axe/Studded/Rations are unaffected). Measured live.
test("seed 3 flag-off stock still pins Katana 813 / Axe 63 / Studded 938 / Casket 4128 / Rations 38", () => {
  const s = newRun(3);
  assert.equal(s.c.sub, "Pickpocket", "seed 3's hero must be a Pickpocket for this pin to prove anything");
  const { stock } = openWith(s, false);
  const byName = Object.fromEntries(stock.map((x) => [x.n, x.cost]));
  assert.equal(byName["Katana"], 813);
  assert.equal(byName["Axe"], 63);
  assert.equal(byName["Studded"], 938);
  assert.equal(byName["Casket, a broadsword"], 4128);
  assert.equal(byName["Rations (+1 ration)"], 38);
});

// --- The draw-count pin --------------------------------------------------

test("draw-count pin: flag-on consumes exactly today's draws plus N = (potionPool.length - 1) + (weaponPool.length - 1), in sequence", () => {
  for (const cls of CLASSES_UNDER_TEST) {
    const letter = letterFor(cls);
    for (const depth of DEPTHS_UNDER_TEST) {
      const hero = heroOf(1, cls, depth);
      const off = openWith(hero, false);
      const on = openWith(hero, true);
      const tier = storeTier(depth);
      const N = (storePotionPool(tier).length - 1) + (storeWeaponPool(letter, tier).length - 1);

      for (let i = 0; i < N; i++) off.rng.next();
      assert.equal(
        off.rng.getState(),
        on.rng.getState(),
        `${cls} depth ${depth}: flag-on must consume exactly today's draws plus ${N} extra, after them`,
      );

      if (N > 0) {
        const offAgain = openWith(hero, false);
        assert.notEqual(on.rng.getState(), offAgain.rng.getState(), `${cls} depth ${depth}: the extra draws must be real`);
      }
    }
  }
});

// --- Stock-shape pins (flag on) ------------------------------------------

test("stock-shape pins: potions (Healing fixed + 3 drawn), weapons (2 drawn), non-rolled lines unchanged, no array growth", () => {
  for (const cls of CLASSES_UNDER_TEST) {
    const letter = letterFor(cls);
    for (const depth of DEPTHS_UNDER_TEST) {
      const hero = heroOf(2, cls, depth);
      const off = openWith(hero, false);
      const on = openWith(hero, true);
      const tier = storeTier(depth);

      // no GROWTH ever (armor may drop out entirely if it no longer fits
      // the tier's cap — see the dedicated boundary test below — but the
      // array can never grow). Every non-rolled (static) line is unchanged
      // content, matched by content rather than raw index since an armor
      // drop shifts every later index by one.
      assert.ok(on.stock.length <= off.stock.length, `${cls} depth ${depth}: in-place rewrite must never grow the stock array`);
      for (const line of off.stock) {
        if (STATIC_EFFECTS.has(line.effectId)) {
          const match = on.stock.find((l) => l.effectId === line.effectId && l.n === line.n);
          assert.ok(match, `${cls} depth ${depth}: static line ${line.effectId}:${line.n} must still be present flag-on`);
          assert.deepStrictEqual(match, line, `${cls} depth ${depth}: static line ${line.effectId}:${line.n} must be byte-identical flag-on`);
        }
      }

      // potions: Healing fixed at the same index, 3 others drawn from the allow-list pool
      const offHealIdx = off.stock.findIndex((l) => l.n === "Healing potion");
      const onHealIdx = on.stock.findIndex((l) => l.n === "Healing potion");
      assert.equal(onHealIdx, offHealIdx, `${cls} depth ${depth}: Healing potion must stay at the same index`);
      const onPotions = on.stock.filter((l) => l.effectId === "givePotion");
      assert.equal(onPotions.length, 4);
      const rolledNames = storePotionPool(tier).map((p) => `${p.n} potion`);
      const others = onPotions.filter((l) => l.n !== "Healing potion");
      assert.equal(others.length, 3);
      const seen = new Set();
      for (const p of others) {
        assert.ok(rolledNames.includes(p.n), `${cls} depth ${depth}: ${p.n} must come from storePotionPool(${tier})`);
        assert.notEqual(p.n, "Death potion");
        assert.ok(!seen.has(p.n), `${cls} depth ${depth}: rolled potions must be distinct`);
        seen.add(p.n);
      }

      // weapons: exactly 2, distinct, both drawn from storeWeaponPool
      const onWeapons = on.stock.filter((l) => l.effectId === "buyWeapon");
      assert.equal(onWeapons.length, 2);
      const wPool = storeWeaponPool(letter, tier);
      assert.notEqual(onWeapons[0].n, onWeapons[1].n);
      for (const w of onWeapons) assert.ok(wPool.includes(w.n), `${cls} depth ${depth}: ${w.n} must come from storeWeaponPool(${letter}, ${tier})`);

      // armor: present only if flag-off had one AND storeArmorFor finds a
      // capped fit; when the flag-off upgrade no longer fits under the
      // tier's cap, the line is dropped entirely (the one legal source of
      // a length SHRINK — never a growth).
      const offArmor = off.stock.find((l) => l.effectId === "buyArmor");
      const onArmor = on.stock.find((l) => l.effectId === "buyArmor");
      const mails = ARMORS.filter((a) => a.cls.includes(letter) && a.ar > hero.c.ar && canEquipArmor(hero.c, a));
      const capped = storeArmorFor(mails, tier);
      if (!offArmor) {
        assert.equal(onArmor, undefined, `${cls} depth ${depth}: no armor line flag-off means none flag-on either`);
        assert.equal(on.stock.length, off.stock.length, `${cls} depth ${depth}: no armor line on either side means no length change`);
      } else if (!capped) {
        assert.equal(onArmor, undefined, `${cls} depth ${depth}: nothing fits under the tier's cap — the armor line must be dropped entirely`);
        assert.equal(on.stock.length, off.stock.length - 1, `${cls} depth ${depth}: dropping the armor line must shrink the array by exactly one`);
      } else {
        assert.ok(onArmor, `${cls} depth ${depth}: an armor line flag-off with a capped fit must still be present flag-on`);
        assert.equal(onArmor.n, capped.name);
        const capIdx = ARMORS.findIndex((a) => a.name === STORE_ARMOR_CAP[tier]);
        assert.ok(ARMORS.indexOf(capped) <= capIdx, `${cls} depth ${depth}: the armor line must be at or under the tier's cap`);
        assert.equal(on.stock.length, off.stock.length, `${cls} depth ${depth}: armor line replaced 1-for-1, no length change`);
      }

      // premium: exactly one buyPremium line, bonus/cost re-derived from the tier
      const onPremium = on.stock.filter((l) => l.effectId === "buyPremium");
      assert.equal(onPremium.length, 1);
      const item = onPremium[0].effectParams.item;
      const bonus = STORE_PREMIUM_BONUS[tier];
      const haggle = hero.c.race === "Wilmsry" ? 0.7 : 1;
      if (item.kind === "weapon") {
        assert.equal(item.bonus, bonus);
        assert.ok(item.txt.endsWith(`+${bonus}`), `${cls} depth ${depth}: premium weapon txt must end +${bonus}`);
        const rawCost = priceFor(WEAPONS[item.base].cost, hero.c.race, hero.c.sub) * (2 + bonus);
        assert.equal(onPremium[0].cost, applyHaggle(rawCost, haggle));
      } else {
        const base = ARMORS.find((a) => a.name === item.armor);
        assert.equal(item.ar, base.ar + bonus);
        assert.equal(item.wp, base.wp + 10 * bonus);
        const rawCost = priceFor(base.cost, hero.c.race, hero.c.sub) * 2;
        assert.equal(onPremium[0].cost, applyHaggle(rawCost, haggle));
      }
    }
  }
});

test("boundary: a Fighter wearing Leather — depth 1 gets NO upgrade flag-on (cap is Leather, already worn) while flag-off offers Studded; depth 5 gets Mail, depth 9 gets Plate", () => {
  const cases = [
    [1, "Studded", undefined],
    [5, "Studded", "Mail"],
    [9, "Studded", "Plate"],
  ];
  for (const [depth, offExpected, onExpected] of cases) {
    const hero = heroOf(9001, "Fighter", depth, { race: "Human" });
    hero.c.armor = "Leather";
    hero.c.ar = 6;
    const off = openWith(hero, false);
    const on = openWith(hero, true);
    const offArmor = off.stock.find((l) => l.effectId === "buyArmor");
    const onArmor = on.stock.find((l) => l.effectId === "buyArmor");
    assert.ok(offArmor, `flag-off must offer an upgrade at depth ${depth}`);
    assert.equal(offArmor.n, offExpected);
    if (onExpected === undefined) {
      assert.equal(onArmor, undefined, `depth ${depth}: the cap is Leather, already worn — no upgrade offered`);
    } else {
      assert.ok(onArmor, `depth ${depth}: an upgrade must be offered flag-on`);
      assert.equal(onArmor.n, onExpected);
    }
  }
});

// --- Serialization / purity ------------------------------------------

test("an open flag-on store round-trips JSON and structuredClone without throwing", () => {
  const hero = heroOf(55, "Fighter", 9);
  const on = openWith(hero, true);
  assert.doesNotThrow(() => structuredClone(on.stock));
  const json = JSON.parse(JSON.stringify(on.stock));
  assert.deepStrictEqual(json, on.stock);
});

test("enchantForTier never mutates its input; replaceStockLines is a no-op when nothing matches", () => {
  const premium = { kind: "weapon", n: "Foo", base: "Axe", bonus: 1, txt: "d6 +1" };
  const before = structuredClone(premium);
  enchantForTier(premium, 2);
  assert.deepStrictEqual(premium, before);

  const stock = [
    { n: "a", effectId: "eatRation" },
    { n: "b", effectId: "buyWeapon" },
  ];
  const before2 = structuredClone(stock);
  const result = replaceStockLines(stock, (l) => l.effectId === "buyArmor", [{ n: "c" }]);
  assert.equal(result, stock, "replaceStockLines must return the SAME array when nothing matches");
  assert.deepStrictEqual(stock, before2, "replaceStockLines must leave the array unchanged when nothing matches");
});
