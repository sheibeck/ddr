// test/unit/pickpocket-item.test.js
//
// Phase 91 plan 08 (IDENT-18, user 2026-09-30): "whenever you gain an item from a chest or a
// monster, you gain one extra item as well; the shop drawback stays (+25% buy, -25% sell)."
// Audit Q1 B: the extra item REPLACES the Pickpocket's extra take of gold (gainWilmst's
// Pickpocket bonus is gone).
//
// The extra is one more entry in state.pendingLoot (the spoils pile), rolled with
// rollTreasureItem from derivedRng(cursor, "pickpocket", acts, pile length), and announced by a
// `lootDropped { pickpocket: true }` right behind the item it follows. No other hero gets one.

import test from "node:test";
import assert from "node:assert/strict";

import { foeSpoils, killFoe, parley } from "../../engine/combat.js";
import { openChest, findGear, findMisc, meetFaerie } from "../../engine/encounters.js";
import { gainWilmst, pickpocketExtra, rollTreasureItem, bagUpgradeTier } from "../../engine/items.js";
import { priceFor, sellPriceFor, openStore, buyFrom } from "../../engine/economy.js";
import { derivedRng, makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

/** a real run state for a given sub (the Phase 22 force seam), ready for spoils and chests. */
function hero(sub = "Pickpocket", depth = 1) {
  const s = newRun(1, [], { force: { sub, race: "Human" } });
  s.combat = null;
  s.pendingLoot = [];
  s.pendingFind = null;
  s.c.items = [];
  s.floor.depth = depth;
  return s;
}

/** twin(state, sub) — the same state with another sub (same draws, same everything else). */
function twin(state, sub) {
  const t = structuredClone(state);
  t.c.sub = sub;
  return t;
}

function foe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 3, size: "S", intel: 2, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** first seed in 1..3000 for which `pred(seed)` is true. */
function findSeed(pred) {
  for (let seed = 1; seed <= 3000; seed++) if (pred(seed)) return seed;
  throw new Error("no seed found");
}

const dropped = (events) => events.filter((e) => e.type === "lootDropped");

/** a seed whose foeSpoils passes the item-drop check (Pickpocket pile of 2). */
function dropSeed(depth = 1) {
  return findSeed((seed) => {
    const s = hero("Cutthroat", depth);
    const ev = [];
    foeSpoils(s, foe(), makeRng(seed), ev);
    return s.pendingLoot.length === 1;
  });
}

test("kill: a Pickpocket whose drop check passes gets the regular item then one extra, events in that order, the second marked pickpocket", () => {
  const seed = dropSeed();
  const s = hero("Pickpocket");
  const ev = [];
  const got = foeSpoils(s, foe(), makeRng(seed), ev);
  assert.equal(s.pendingLoot.length, 2);
  assert.equal(got.items, 2);
  const drops = dropped(ev);
  assert.equal(drops.length, 2);
  assert.equal(drops[0].pickpocket, undefined, "the regular drop is not marked");
  assert.equal(drops[1].pickpocket, true);
  assert.equal(drops[0].name, s.pendingLoot[0].n);
  assert.equal(drops[1].name, s.pendingLoot[1].n);
  // ordering: the extra's event is the very next lootDropped after the regular item's own
  const i0 = ev.indexOf(drops[0]);
  assert.equal(ev[i0 + 1], drops[1], "the extra's event comes right after the item's own");
});

test("kill: a Cutthroat twin with the same rng gains only the regular item, and the main rng ends in the same place", () => {
  const seed = dropSeed();
  const pp = hero("Pickpocket");
  const cut = twin(pp, "Cutthroat");
  const ra = makeRng(seed);
  const rb = makeRng(seed);
  foeSpoils(pp, foe(), ra, []);
  const evB = [];
  const got = foeSpoils(cut, foe(), rb, evB);
  assert.equal(cut.pendingLoot.length, 1);
  assert.equal(got.items, 1);
  assert.ok(!dropped(evB).some((e) => e.pickpocket), "a Cutthroat never gets an extra");
  assert.deepEqual(pp.pendingLoot[0], cut.pendingLoot[0], "the regular drop is the same item");
  assert.equal(ra.getState(), rb.getState(), "the extra never touches the main rng: draws identical");
  assert.equal(pp.c.gold, cut.c.gold, "no gold take any more: the coin is the same");
});

test("kill through killFoe: the pile gets the extra and the main rng is a Cutthroat's", () => {
  const seed = findSeed((sd) => {
    const s = hero("Cutthroat");
    killFoe(s, foe(), makeRng(sd), []);
    return s.pendingLoot.length === 1;
  });
  const pp = hero("Pickpocket");
  const cut = twin(pp, "Cutthroat");
  const ra = makeRng(seed);
  const rb = makeRng(seed);
  const evA = [];
  killFoe(pp, foe(), ra, evA);
  killFoe(cut, foe(), rb, []);
  assert.equal(pp.pendingLoot.length, 2);
  assert.equal(cut.pendingLoot.length, 1);
  assert.equal(ra.getState(), rb.getState());
  assert.equal(dropped(evA)[1].pickpocket, true);
});

test("streams: the extra is reproducible from derivedRng(cursor, 'pickpocket', acts, pile length) and rollTreasureItem", () => {
  const seed = dropSeed();
  const s = hero("Pickpocket");
  s.acts = 7;
  const rng = makeRng(seed);
  const cut = twin(s, "Cutthroat");
  cut.acts = 7;
  const rc = makeRng(seed);
  foeSpoils(cut, foe(), rc, []);
  // the cursor after the regular draws is the cursor the extra is keyed on
  foeSpoils(s, foe(), rng, []);
  assert.equal(rng.getState(), rc.getState());
  const expected = rollTreasureItem(derivedRng(rng.getState(), "pickpocket", 7, 1), s.floor.depth, s.c);
  assert.deepEqual(s.pendingLoot[1], expected);
});

test("streams: the pile length is part of the key, so two drops in one action get different extras", () => {
  const s = hero("Pickpocket");
  const rng = makeRng(5);
  const seen = new Set();
  for (let n = 0; n < 12; n++) {
    s.pendingLoot = new Array(n).fill({ kind: "x", n: "filler" });
    const before = s.pendingLoot.length;
    pickpocketExtra(s, rng, []);
    seen.add(JSON.stringify(s.pendingLoot[before]));
  }
  assert.ok(seen.size > 1, "twelve different pile lengths do not all roll the same item");
});

test("a non-Pickpocket never gets an extra: no pile entry, no event, no draw", () => {
  for (const sub of ["Cutthroat", "Pilfer", "Soldier", "Wizard", "Cleric"]) {
    const s = hero(sub);
    const ev = [];
    const rng = makeRng(3);
    const before = rng.getState();
    assert.equal(pickpocketExtra(s, rng, ev), 0, sub);
    assert.equal(s.pendingLoot.length, 0);
    assert.equal(ev.length, 0);
    assert.equal(rng.getState(), before);
  }
});

test("empty: a failed item-drop check gives no extra", () => {
  const seed = findSeed((sd) => {
    const s = hero("Cutthroat");
    foeSpoils(s, foe(), makeRng(sd), []);
    return s.pendingLoot.length === 0;
  });
  const s = hero("Pickpocket");
  const ev = [];
  const got = foeSpoils(s, foe(), makeRng(seed), ev);
  assert.equal(s.pendingLoot.length, 0);
  assert.equal(got.items, 0);
  assert.equal(dropped(ev).length, 0);
});

test("adjacency: when the extra is the very same item as the regular drop, the pile holds two separate entries", () => {
  // learn the extra the stream rolls for a pile of one, then plant that very item as the regular drop
  const seed = dropSeed();
  const probe = hero("Pickpocket");
  foeSpoils(probe, foe(), makeRng(seed), []);
  const same = structuredClone(probe.pendingLoot[1]);
  const cursorRng = makeRng(seed);
  foeSpoils(twin(probe, "Cutthroat"), foe(), cursorRng, []);
  const s = hero("Pickpocket");
  s.pendingLoot = [structuredClone(same)];
  assert.equal(pickpocketExtra(s, cursorRng, []), 1);
  assert.equal(s.pendingLoot.length, 2);
  assert.deepEqual(s.pendingLoot[0], s.pendingLoot[1], "the same item twice");
  assert.notEqual(s.pendingLoot[0], s.pendingLoot[1], "but two separate entries, never merged");
});

test("adjacency: a bag-upgrade drop and the extra are both kept", () => {
  // depth 2 opens the medium bag tier; find a seed whose bag check swaps the regular item for the bag
  const seed = findSeed((sd) => {
    const s = hero("Cutthroat", 2);
    s.c.bag = "small";
    foeSpoils(s, foe(), makeRng(sd), []);
    return s.pendingLoot.length === 1 && s.pendingLoot[0].kind === "bag";
  });
  const s = hero("Pickpocket", 2);
  s.c.bag = "small";
  assert.ok(bagUpgradeTier(s));
  const ev = [];
  foeSpoils(s, foe(), makeRng(seed), ev);
  assert.equal(s.pendingLoot.length, 2);
  assert.equal(s.pendingLoot[0].kind, "bag", "the bag is the regular drop");
  assert.equal(dropped(ev)[1].pickpocket, true, "and the extra is kept behind it");
});

test("parley: a Pickpocket's won parley whose spoils drop an item adds one extra after it", () => {
  const mkState = (sub) => {
    const s = hero(sub);
    s.c.race = "Elven"; // an Elf can always parley with Humans
    s.c.level = 3;
    s.floor.depth = 1;
    s.acts = 0;
    s.combat = { foes: [foe({ type: "Humans" })], type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false };
    s.party = [];
    return s;
  };
  const fake = (cursor) => {
    const seq = [1, 3, 2]; // d20 win, the experience d6, the Humans tip d6 (not a 6)
    let i = 0;
    return { d: () => seq[i++], pick: (a) => a[0], shuffle: (a) => a, getState: () => cursor };
  };
  // a cursor whose derived spoils stream passes the item-drop check
  const cursor = findSeed((cu) => {
    const t = mkState("Cutthroat");
    parley(t, fake(cu), []);
    return (t.pendingLoot || []).length === 1;
  });
  const pp = mkState("Pickpocket");
  const ev = [];
  parley(pp, fake(cursor), ev);
  assert.equal(pp.pendingLoot.length, 2);
  const drops = dropped(ev);
  assert.equal(drops.length, 2);
  assert.equal(drops[1].pickpocket, true);
  const won = ev.find((e) => e.type === "parleyWon");
  assert.equal(won.items, 2, "the parley card counts the extra");
});

/** a seed whose chest opens for the hero (and one whose chest stays locked). */
function chestSeed(sub, wantOpen) {
  return findSeed((sd) => {
    const s = hero(sub);
    const ev = openChest(s, makeRng(sd), []);
    return wantOpen ? ev.some((e) => e.type === "chestOpened") : ev.some((e) => e.type === "chestLocked");
  });
}

test("chest: a Pickpocket opening a chest gets the find offer as before plus one extra in the pending pile", () => {
  const seed = chestSeed("Pickpocket", true);
  const pp = hero("Pickpocket");
  const cut = twin(pp, "Cutthroat");
  const ra = makeRng(seed);
  const rb = makeRng(seed);
  const ev = openChest(pp, ra, []);
  openChest(cut, rb, []);
  assert.ok(pp.pendingFind, "the find card still carries the usual item");
  assert.deepEqual(pp.pendingFind, cut.pendingFind, "the same usual item as a Cutthroat's");
  assert.equal(pp.pendingLoot.length, 1);
  assert.equal(cut.pendingLoot.length, 0);
  const drop = dropped(ev);
  assert.equal(drop.length, 1);
  assert.equal(drop[0].pickpocket, true);
  const iFind = ev.findIndex((e) => e.type === "findOffered");
  assert.equal(ev[iFind + 1], drop[0], "the extra's event follows the find offer");
  assert.equal(ra.getState(), rb.getState(), "main rng draws match a Cutthroat's");
  assert.equal(pp.c.gold, cut.c.gold, "chest gold is the ordinary amount: the gold take is gone");
});

test("chest: the extra is reproducible from its derived stream", () => {
  const seed = chestSeed("Pickpocket", true);
  const pp = hero("Pickpocket");
  pp.acts = 4;
  const rng = makeRng(seed);
  openChest(pp, rng, []);
  const expected = rollTreasureItem(derivedRng(rng.getState(), "pickpocket", 4, 0), pp.floor.depth, pp.c);
  assert.deepEqual(pp.pendingLoot[0], expected);
});

test("empty: a locked chest gives no extra", () => {
  const seed = chestSeed("Pickpocket", false);
  const s = hero("Pickpocket");
  const ev = openChest(s, makeRng(seed), []);
  assert.ok(ev.some((e) => e.type === "chestLocked"));
  assert.equal(s.pendingLoot.length, 0);
  assert.equal(dropped(ev).length, 0);
});

test("empty: a Faerie gift, a Misc Magic find, a gear find and a store purchase never give an extra", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const a = hero("Pickpocket");
    meetFaerie(a, makeRng(seed), []);
    assert.equal(a.pendingLoot.length, 0, `faerie seed ${seed}`);
    const b = hero("Pickpocket");
    findMisc(b, makeRng(seed), []);
    assert.equal(b.pendingLoot.length, 0, `misc seed ${seed}`);
  }
  const g = hero("Pickpocket");
  findGear(g, "magicweapon", makeRng(2), []);
  assert.equal(g.pendingLoot.length, 0);
  const st = hero("Pickpocket");
  st.c.gold = 100000;
  openStore(st, makeRng(9), []);
  const idx = st.store.stock.findIndex((l) => l.effectId === "givePotion");
  buyFrom(st, idx, []);
  assert.equal(st.pendingLoot.length, 0);
});

test("Q1 (B): gainWilmst takes no draw and pays a Pickpocket exactly what it pays a Cutthroat; no pickpocket gold beat", () => {
  const pp = hero("Pickpocket", 3);
  const cut = hero("Cutthroat", 3);
  const noDraw = { d() { throw new Error("gainWilmst must not draw"); }, pick: (a) => a[0], shuffle: (a) => a };
  const evA = [];
  const a = gainWilmst(pp, 100, "test", noDraw, evA);
  const b = gainWilmst(cut, 100, "test", noDraw, []);
  assert.equal(a, b);
  assert.deepEqual(evA.map((e) => e.type), ["goldGained"]);
  assert.equal(evA[0].why, "test");
  assert.ok(!evA.some((e) => e.why === "pickpocket"));
});

test("shops: the Pickpocket drawback stays exactly: buy x1.25 on a routed line, sell x0.75", () => {
  assert.equal(priceFor(100, "Human", "Pickpocket"), 125);
  assert.equal(priceFor(100, "Human"), 100);
  const cloak = { kind: "cloak", n: "Cloak of Armor" };
  assert.equal(sellPriceFor(cloak, "Human", "Pickpocket"), 938);
  assert.equal(sellPriceFor(cloak, "Human"), 1250);
});
