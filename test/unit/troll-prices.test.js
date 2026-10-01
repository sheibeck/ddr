// test/unit/troll-prices.test.js
//
// Phase 91 plan 08 (IDENT-21, user 2026-09-30): "Troll store prices doubled (today tripled,
// weapons doubled again)." Plus the audit rulings that ride with it:
//   Q5 A  stores pay every race the ordinary price when SELLING; the race multiplier is a
//         buying rule only (the Pickpocket's x0.75 on selling stays);
//   Q8 A  (user 2026-10-01, against the recommendation) every store stock line EXCEPT the three
//         flat-priced tools goes through the race and Pickpocket buy rule: potions, food,
//         lockpicks and the sealed scroll included (Elven/Dwarven half, Troll double,
//         Pickpocket x1.25); `troll-weapons` is retired (no weapon double on top).
// The Wilmsry's x0.7 haggle still reaches every line, tools too, and a Wilmsry still never takes
// a Magic User Joiner on.

import test from "node:test";
import assert from "node:assert/strict";

import { priceFor, sellPriceFor, openStore, leaveStore, buyFrom } from "../../engine/economy.js";
import { meetJoiner } from "../../engine/encounters.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { WEAPONS, TOOLS } from "../../content/index.js";
import { IDENTITY_TRAITS } from "../../content/identity.js";
import { RACE_NOTE } from "../../content/flavor.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const ROUTED = ["eatRation", "givePotion", "giveLockpicks", "buyScroll", "buyWeapon", "buyArmor", "buyPremium", "buyRations", "repairArmor"];

/** a store-ready hero: forced sub/race, a worn, damaged armour so a repair line appears. */
function hero(sub, race = "Human", depth = 3) {
  const s = newRun(5, [], { force: { sub, race } });
  s.combat = null;
  s.floor.depth = depth;
  s.c.gold = 1000000;
  return s;
}

/** open a store for `base` with `race`/`sub` swapped in, from the SAME rng seed, so the stock
 * (names, order, lines) is identical across the comparison and only the prices can differ. */
function storeFor(base, { race = base.c.race, sub = base.c.sub, rngSeed = 77 } = {}) {
  const s = structuredClone(base);
  s.c.race = race;
  s.c.sub = sub;
  openStore(s, makeRng(rngSeed), []);
  return s;
}

const lines = (s) => s.store.stock;
const costs = (s) => lines(s).map((l) => l.cost);
const names = (s) => lines(s).map((l) => l.n);

test("priceFor: a Troll's price is exactly doubled, and weapons are not doubled again", () => {
  assert.equal(priceFor(100, "Troll"), 200);
  assert.equal(priceFor(550, "Troll"), 1100);
  assert.equal(priceFor(100, "Human"), 100);
  assert.equal(priceFor(101, "Elven"), 51);
  assert.equal(priceFor(101, "Dwarven"), 51);
  assert.equal(priceFor(100, "Troll", "Pickpocket"), 250);
});

test("edge (empty): priceFor(0, 'Troll') is 0, priceFor(1, 'Troll') is 2, and no Troll store line is ever NaN or free", () => {
  assert.equal(priceFor(0, "Troll"), 0);
  assert.equal(priceFor(1, "Troll"), 2);
  for (const sub of ["Soldier", "Wizard", "Cutthroat"]) {
    for (const depth of [1, 3, 8]) {
      const s = storeFor(hero(sub, "Troll", depth));
      for (const l of lines(s)) {
        assert.ok(Number.isFinite(l.cost) && l.cost >= 1, `${sub} d${depth} ${l.n}: ${l.cost}`);
      }
    }
  }
});

test("a Troll's store prices every routed line at exactly twice a Human's, the weapon lines included", () => {
  for (const sub of ["Soldier", "Cutthroat", "Wizard"]) {
    const base = hero(sub);
    base.c.armorWP = 5; // a hurt, worn armour: the repair line is stocked too
    base.c.armorMax = 15;
    const human = storeFor(base);
    const troll = storeFor(base, { race: "Troll" });
    assert.deepEqual(names(troll), names(human), "same stock, only prices differ");
    let weapons = 0;
    lines(human).forEach((h, i) => {
      const t = lines(troll)[i];
      if (h.effectId === "repairArmor") return; // a fractional tenth-per-point price: checked by formula below
      if (ROUTED.includes(h.effectId)) assert.equal(t.cost, h.cost * 2, `${sub}: ${h.n} (${h.effectId})`);
      if (h.effectId === "buyWeapon") {
        weapons++;
        assert.equal(t.cost, WEAPONS[h.n].cost * 2, `${h.n}: twice the base, no weapon double on top`);
      }
    });
    assert.ok(weapons > 0, `${sub}: the store offered a weapon`);
  }
});

test("Q8 A: potions, food, lockpicks and the sealed scroll are routed through the race and Pickpocket rule", () => {
  const wizard = hero("Wizard");
  const human = storeFor(wizard);
  const byEffect = (s, id) => lines(s).filter((l) => l.effectId === id);
  for (const id of ["eatRation", "givePotion", "giveLockpicks", "buyScroll"]) {
    assert.ok(byEffect(human, id).length > 0, `a Wizard's store stocks ${id}`);
  }
  const potion = byEffect(human, "givePotion")[0].cost;
  const elf = storeFor(wizard, { race: "Elven" });
  const dwarf = storeFor(wizard, { race: "Dwarven" });
  const troll = storeFor(wizard, { race: "Troll" });
  for (const id of ["eatRation", "givePotion", "giveLockpicks", "buyScroll"]) {
    byEffect(human, id).forEach((h, i) => {
      assert.equal(byEffect(elf, id)[i].cost, Math.round(h.cost / 2), `Elven ${id}`);
      assert.equal(byEffect(dwarf, id)[i].cost, Math.round(h.cost / 2), `Dwarven ${id}`);
      assert.equal(byEffect(troll, id)[i].cost, h.cost * 2, `Troll ${id}`);
    });
  }
  assert.equal(byEffect(troll, "givePotion")[0].cost, potion * 2);
  // the Healing potion: 150 for a Human, 75 for an Elf, 300 for a Troll, 188 for a Pickpocket
  const heal = (s) => lines(s).find((l) => l.n === "Healing potion").cost;
  assert.equal(heal(human), 150);
  assert.equal(heal(elf), 75);
  assert.equal(heal(troll), 300);
  const thief = hero("Cutthroat");
  assert.equal(heal(storeFor(thief, { sub: "Pickpocket" })), 188);
});

test("Q8 A: a Pickpocket pays x1.25 on every routed line; the three tools stay flat for everyone", () => {
  const cut = hero("Cutthroat");
  const human = storeFor(cut);
  const pick = storeFor(cut, { sub: "Pickpocket" });
  assert.deepEqual(names(pick), names(human));
  let tools = 0;
  let routed = 0;
  lines(human).forEach((h, i) => {
    const p = lines(pick)[i];
    if (h.effectId === "giveTool") {
      tools++;
      assert.equal(p.cost, h.cost, `${h.n}: flat for a Pickpocket`);
    } else if (ROUTED.includes(h.effectId) && h.effectId !== "repairArmor" && h.effectId !== "buyPremium") {
      // (the premium piece multiplies the ALREADY rounded priceFor by its enchant, so a x1.25
      // is not a rounded multiple of the Human line; the Troll's exact double above covers it)
      routed++;
      assert.equal(p.cost, Math.max(1, Math.round(h.cost * 1.25)), `${h.n} (${h.effectId})`);
    }
  });
  assert.ok(tools > 0 && routed > 0);
  for (const race of ["Elven", "Dwarven", "Troll"]) {
    const s = storeFor(cut, { race });
    for (const l of lines(s).filter((x) => x.effectId === "giveTool")) {
      const key = Object.keys(TOOLS).find((k) => TOOLS[k].n === l.n);
      assert.equal(l.cost, TOOLS[key].cost, `${race}: ${l.n} is flat`);
    }
  }
});

test("the Wilmsry haggle stays x0.7 on every line, tools included, and a Wilmsry gets no race multiplier", () => {
  const base = hero("Soldier");
  const human = storeFor(base);
  const wil = storeFor(base, { race: "Wilmsry" });
  assert.equal(wil.store.haggle, 0.7);
  lines(human).forEach((h, i) => assert.equal(lines(wil)[i].cost, Math.round(h.cost * 0.7), h.n));
  assert.ok(lines(wil).some((l) => l.effectId === "giveTool"), "tools are in the haggle's reach");
});

test("with a storeRoll run (the shell's stock) the rewritten potion and weapon lines are routed and doubled the same way", () => {
  const base = hero("Soldier", "Human", 6);
  base.storeRoll = true;
  const human = storeFor(base);
  const troll = storeFor(base, { race: "Troll" });
  const elf = storeFor(base, { race: "Elven" });
  lines(human).forEach((h, i) => {
    if (h.effectId === "repairArmor" || !ROUTED.includes(h.effectId)) return;
    assert.equal(lines(troll)[i].cost, h.cost * 2, `Troll ${h.n}`);
    if (h.effectId !== "buyPremium") assert.equal(lines(elf)[i].cost, Math.round(h.cost / 2), `Elven ${h.n}`);
  });
  const wl = lines(troll).filter((l) => l.effectId === "buyWeapon");
  assert.ok(wl.length > 0);
  for (const l of wl) assert.equal(l.cost, WEAPONS[l.n].cost * 2, `${l.n}: twice the base`);
});

test("Q5 A: stores pay every race the ordinary price when selling; a Pickpocket keeps its x0.75", () => {
  const items = [
    { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0 },
    { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 },
    { kind: "cloak", n: "Cloak of Armor" },
  ];
  for (const it of items) {
    const ordinary = sellPriceFor(it, "Human");
    for (const race of ["Elven", "Dwarven", "Troll", "Wilmsry", "Fridgian"]) {
      assert.equal(sellPriceFor(it, race), ordinary, `${it.n} sold by a ${race}`);
    }
    assert.equal(sellPriceFor(it, "Troll", "Pickpocket"), sellPriceFor(it, "Human", "Pickpocket"));
    assert.ok(sellPriceFor(it, "Human", "Pickpocket") < ordinary, `${it.n}: the Pickpocket's x0.75 is kept`);
  }
  assert.equal(sellPriceFor({ kind: "cloak", n: "Cloak of Armor" }, "Human", "Pickpocket"), 938);
});

test("edge (encoding): the doubling is for the exact race key 'Troll' only", () => {
  for (const key of ["troll", " Troll", "Troll ", "TROLL", "Trolls", ""]) {
    assert.equal(priceFor(100, key), 100, JSON.stringify(key));
  }
  assert.equal(priceFor(100, "Troll"), 200);
});

test("edge (encoding): the Wilmsry refusal is for the exact race key 'Wilmsry' only, and it is the Wilmsry who refuses", () => {
  // the pinned seed 1 meets a Magic User Joiner (the contract's Wilmsry scenario)
  const wil = newRun(1, [], { force: { sub: "Soldier", race: "Wilmsry" } });
  wil.combat = null;
  wil.pendingJoiner = null;
  const ev = meetJoiner(wil, makeRng(1), []);
  assert.equal(wil.c.joiner.cls, "Magic User");
  assert.equal(wil.pendingJoiner, null);
  assert.ok(ev.some((e) => e.type === "joinerRefused" && e.reason === "wilmsry"));
  for (const key of ["wilmsry", " Wilmsry", "Wilmsry "]) {
    const other = newRun(1, [], { force: { sub: "Soldier", race: "Wilmsry" } });
    other.combat = null;
    other.pendingJoiner = null;
    other.c.race = key;
    const e2 = meetJoiner(other, makeRng(1), []);
    assert.ok(!e2.some((e) => e.type === "joinerRefused"), JSON.stringify(key));
    assert.ok(other.pendingJoiner, `${JSON.stringify(key)} is offered the Magic User`);
  }
  // the trait and the notes say the Wilmsry refuses, not that they refuse the Wilmsry
  const t = IDENTITY_TRAITS.race.Wilmsry.bad.find((x) => x.id === "wilmsry-joiners");
  assert.match(t.text, /^you refuse to take Magic User Joiners on/);
  assert.match(RACE_NOTE.Wilmsry, /you will not take a Magic User on/i);
  assert.doesNotMatch(RACE_NOTE.Wilmsry, /not one of them will so much as travel with you/);
});

test("edge (idempotency): a store's prices are computed once when it opens: JSON round trips, re-reading and buying never re-multiply them", () => {
  const troll = storeFor(hero("Soldier", "Troll"));
  const before = costs(troll);
  const round = JSON.parse(JSON.stringify(troll));
  assert.deepEqual(costs(round), before);
  const loaded = validateSave(JSON.stringify(serializeRun(troll)));
  assert.equal(loaded.ok, true);
  assert.deepEqual(costs(loaded.value), before, "saving and loading never multiplies them again");
  // buying one line moves no other line's price
  const idx = lines(troll).findIndex((l) => l.effectId === "givePotion");
  buyFrom(troll, idx, []);
  const after = costs(troll);
  assert.deepEqual(after, before, "a purchase leaves every price alone");
  // re-opening the store (a new store) prices from base again, not from the old prices
  leaveStore(troll, []);
  openStore(troll, makeRng(77), []);
  assert.deepEqual(costs(troll), before);
});

test("edge (concurrency): a save taken with a store open from before this change keeps that store's prices until it closes; the next store prices at x2", () => {
  const troll = storeFor(hero("Soldier", "Troll"));
  const human = storeFor(hero("Soldier", "Human"));
  // the old rule: x3 on every routed line that was routed then (weapon lines x6); flat lines flat
  const old = structuredClone(troll);
  old.store.stock.forEach((l, i) => {
    const h = lines(human)[i];
    if (["buyArmor", "buyPremium", "buyRations"].includes(l.effectId)) l.cost = h.cost * 3;
    if (l.effectId === "buyWeapon") l.cost = h.cost * 6;
  });
  const oldCosts = costs(old);
  const loaded = validateSave(JSON.stringify(serializeRun(old)));
  assert.equal(loaded.ok, true);
  assert.deepEqual(costs(loaded.value), oldCosts, "the saved store keeps the prices it was saved with (tolerant load)");
  leaveStore(loaded.value, []);
  assert.equal(loaded.value.store, null);
  openStore(loaded.value, makeRng(77), []);
  assert.deepEqual(costs(loaded.value), costs(troll), "the next store opened prices by the new rules");
  assert.notDeepEqual(costs(loaded.value), oldCosts);
});

test("the traits state the rule: troll-prices doubled, troll-weapons retired, the Elven and Dwarven proofs renamed", () => {
  const bad = IDENTITY_TRAITS.race.Troll.bad;
  assert.ok(bad.some((t) => t.id === "troll-prices" && /doubled/.test(t.text)));
  assert.ok(!bad.some((t) => t.id === "troll-weapons"), "troll-weapons is retired");
  assert.match(RACE_NOTE.Troll, /double/i);
  assert.doesNotMatch(RACE_NOTE.Troll, /triple/i);
});
