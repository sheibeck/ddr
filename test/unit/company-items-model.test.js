// test/unit/company-items-model.test.js
//
// Phase 89 plan 07 (ITEM-07, player side). companyItemsModel(state, idx) is the
// ONE pure view model the Hero tab's Company panel draws each Joiner's armour,
// healing potions and worn items from: what it carries, the state of each worn
// item (ready, live, cooling) and whether DRINK / USE is offered, with one line
// of reason when it is not. It restates no rule: the legality comes from the
// engine's own refusals (memberUseItem / memberUseWorn: MEMBER_LEADER_KINDS,
// TARGETED_KINDS, isReady, fullHealth, noPotions, the fight).

import test from "node:test";
import assert from "node:assert/strict";

import { companyItemsModel, COMPANY_COPY } from "../../src/browser/heroTab.js";
import { itemStatLines } from "../../src/browser/viewModels.js";
import { MEMBER_LEADER_KINDS, memberUseItem } from "../../engine/items.js";
import { CLOAKS, JEWELRY } from "../../content/index.js";
import { BANNED } from "../../content/safety-wordlist.js";

const cloakRow = (name) => ({ kind: "cloak", ...CLOAKS.find((r) => r.n === name) });
const jewelRow = (name) => ({ kind: "jewel", ...JEWELRY.find((r) => r.n === name) });

function joiner(over = {}) {
  return {
    name: "Brom", cls: "Fighter", sub: "Knight", race: "Human", level: 1,
    wp: 20, maxWP: 40, potions: 2, status: "ok",
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0,
    items: [], worn: {}, timers: {},
    ...over,
  };
}
const stateOf = (member, extra = {}) => ({ c: { name: "Hero", potions: 9, wp: 10, maxWP: 10 }, party: [member], combat: null, ...extra });

// ─── potions ────────────────────────────────────────────────────────────────

test("potions: two potions at 20/40 outside a fight can be drunk", () => {
  const m = companyItemsModel(stateOf(joiner()), 0);
  assert.deepEqual(m.potions, { n: 2, canDrink: true, reason: null });
  assert.equal(m.inFight, false);
});

test("potions: at full HP the drink is off and says so; with none left it says that", () => {
  const full = companyItemsModel(stateOf(joiner({ wp: 40 })), 0);
  assert.equal(full.potions.canDrink, false);
  assert.equal(full.potions.reason, COMPANY_COPY.reason.fullHealth);
  const dry = companyItemsModel(stateOf(joiner({ potions: 0 })), 0);
  assert.equal(dry.potions.canDrink, false);
  assert.equal(dry.potions.n, 0);
  assert.equal(dry.potions.reason, COMPANY_COPY.reason.noPotions);
});

test("potions: a downed Joiner cannot drink (the engine refuses noMember)", () => {
  const m = companyItemsModel(stateOf(joiner({ status: "downed", wp: 0 })), 0);
  assert.equal(m.potions.canDrink, false);
  assert.equal(m.potions.reason, COMPANY_COPY.reason.downed);
});

test("potions: the model agrees with the engine (DRINK enabled exactly when memberUseItem would not refuse)", () => {
  for (const over of [{ wp: 10 }, { wp: 40 }, { potions: 0 }, { status: "downed", wp: 0 }]) {
    const state = stateOf(joiner(over));
    const enabled = companyItemsModel(state, 0).potions.canDrink;
    const events = memberUseItem(JSON.parse(JSON.stringify(state)), 0, { potion: true }, { getState: () => 7, d: () => 1 }, []);
    assert.equal(enabled, !events.some((e) => e.type === "useRefused"), JSON.stringify(over));
  }
});

// ─── worn items ─────────────────────────────────────────────────────────────

test("worn: a ready Cloak of Strength lists its own effect text and can be used", () => {
  const cloak = cloakRow("Cloak of Strength");
  const m = companyItemsModel(stateOf(joiner({ worn: { cloak } })), 0);
  assert.equal(m.worn.length, 1);
  const row = m.worn[0];
  assert.equal(row.slot, "cloak");
  assert.equal(row.name, "Cloak of Strength");
  assert.equal(row.effect, itemStatLines(cloak, joiner()).find((l) => l.key === "effect").text);
  assert.equal(row.status, "ready");
  assert.equal(row.canUse, true);
  assert.equal(row.reason, null);
});

test("worn: a live effect reads live with its count and cannot be used again", () => {
  const cloak = cloakRow("Cloak of Strength");
  const m = companyItemsModel(stateOf(joiner({ worn: { cloak }, timers: { "item:Cloak of Strength": { cadence: "squares", left: 31, phase: "effect", cd: 50 } } })), 0);
  const row = m.worn[0];
  assert.equal(row.status, "live");
  assert.equal(row.left, 31);
  assert.equal(row.canUse, false);
  assert.match(row.reason, /31/);
});

test("worn: a cooling item reads cooling with its count and the reason names the squares", () => {
  const cloak = cloakRow("Cloak of Strength");
  const m = companyItemsModel(stateOf(joiner({ worn: { cloak }, timers: { "item:Cloak of Strength": { cadence: "squares", left: 12, phase: "cooldown" } } })), 0);
  const row = m.worn[0];
  assert.equal(row.status, "cooling");
  assert.equal(row.left, 12);
  assert.equal(row.canUse, false);
  assert.equal(row.reason, COMPANY_COPY.reason.cooling.replace("{n}", 12));
});

test("worn: every leader-only kind is refused with the Q2 line, ready or not", () => {
  const named = ["Cloak of Flying", "Cloak of Ether", "Bracelet of Flight", "Amulet of Light", "Helm of Knowledge", "Amulet of Stone"];
  const leaders = [...CLOAKS.map((r) => cloakRow(r.n)), ...JEWELRY.map((r) => jewelRow(r.n))].filter((it) => named.includes(it.n));
  assert.equal(leaders.length, 6);
  assert.equal(MEMBER_LEADER_KINDS.length, 5);
  for (const it of leaders) {
    const slot = it.kind === "cloak" ? "cloak" : "jewelry1";
    const m = companyItemsModel(stateOf(joiner({ worn: { [slot]: it } })), 0);
    assert.equal(m.worn[0].canUse, false, it.n);
    assert.equal(m.worn[0].reason, COMPANY_COPY.reason.leaderOnly, it.n);
  }
});

test("worn: the model agrees with the engine for every cloak and jewel, ready and cooling", () => {
  const all = [...CLOAKS.map((r) => cloakRow(r.n)), ...JEWELRY.map((r) => jewelRow(r.n))];
  for (const it of all) {
    const slot = it.kind === "cloak" ? "cloak" : "jewelry1";
    for (const cooling of [false, true]) {
      const timers = cooling ? { [`item:${it.n}`]: { cadence: "squares", left: 9, phase: "cooldown" } } : {};
      const state = stateOf(joiner({ worn: { [slot]: it }, timers }));
      const row = companyItemsModel(state, 0).worn[0];
      const events = memberUseItem(JSON.parse(JSON.stringify(state)), 0, { slot }, { getState: () => 7, d: () => 10 }, []);
      const refused = events.some((e) => e.type === "useRefused");
      assert.equal(row.canUse, !refused, `${it.n} cooling=${cooling}`);
      if (refused) assert.ok(row.reason, `${it.n} says why`);
    }
  }
});

test("worn: an armed Pendant of Fortitude reads live (armed) and cannot be used again", () => {
  const pendant = jewelRow("Pendant of Fortitude");
  const m = companyItemsModel(stateOf(joiner({ worn: { jewelry1: pendant }, halfNext: { slot: "jewelry1", n: "Pendant of Fortitude" }, timers: { "item:Pendant of Fortitude": { cadence: "squares", left: 100, phase: "cooldown" } } })), 0);
  const row = m.worn[0];
  assert.equal(row.status, "live");
  assert.equal(row.canUse, false);
  assert.equal(row.reason, COMPANY_COPY.reason.armed);
});

test("worn: rows come in WORN_SLOTS order and only for what is worn", () => {
  const m = companyItemsModel(stateOf(joiner({ worn: { cloak: cloakRow("Cloak of Speed"), jewelry2: jewelRow("Ring of Power") } })), 0);
  assert.deepEqual(m.worn.map((r) => r.slot), ["jewelry2", "cloak"]);
});

// ─── armour ─────────────────────────────────────────────────────────────────

test("armour: Leather at 12/15 reads its AR and durability", () => {
  const m = companyItemsModel(stateOf(joiner({ armor: "Leather", ar: 6, armorWP: 12, armorMax: 15 })), 0);
  assert.deepEqual(m.armour, { name: "Leather", ar: 6, left: 12, max: 15, destroyed: false });
});

test("armour: at 0 it is destroyed; unarmoured gives null", () => {
  const gone = companyItemsModel(stateOf(joiner({ armor: "Leather", ar: 6, armorWP: 0, armorMax: 15 })), 0);
  assert.equal(gone.armour.destroyed, true);
  assert.equal(gone.armour.left, 0);
  assert.equal(companyItemsModel(stateOf(joiner()), 0).armour, null);
});

// ─── fight ──────────────────────────────────────────────────────────────────

test("fight: every DRINK and USE is off and inFight is true", () => {
  const state = stateOf(joiner({ wp: 10, worn: { cloak: cloakRow("Cloak of Strength") } }), { combat: { foes: [], allies: [] } });
  const m = companyItemsModel(state, 0);
  assert.equal(m.inFight, true);
  assert.equal(m.potions.canDrink, false);
  assert.ok(m.worn.every((r) => r.canUse === false));
});

test("fight: the potion count and the HP read come from the live fight roster entry", () => {
  const state = stateOf(joiner({ wp: 40, potions: 1 }), { combat: { foes: [], allies: [{ partyIdx: 0, wp: 5, maxWP: 40 }] } });
  assert.equal(companyItemsModel(state, 0).potions.n, 1);
});

// ─── robustness ─────────────────────────────────────────────────────────────

test("robustness: a bad index, no state, no worn map, no timers, no potions field never throw", () => {
  assert.doesNotThrow(() => companyItemsModel(null, 0));
  assert.doesNotThrow(() => companyItemsModel({}, 0));
  assert.doesNotThrow(() => companyItemsModel(stateOf(joiner()), 7));
  assert.doesNotThrow(() => companyItemsModel(stateOf(joiner()), -1));
  assert.doesNotThrow(() => companyItemsModel(stateOf(joiner()), "x"));
  const bare = { name: "Bare", wp: 3, maxWP: 9 };
  const m = companyItemsModel(stateOf(bare), 0);
  assert.equal(m.armour, null);
  assert.deepEqual(m.worn, []);
  assert.equal(m.potions.n, 0);
  assert.equal(m.potions.canDrink, false);
  const none = companyItemsModel(stateOf(joiner()), 7);
  assert.deepEqual(none.worn, []);
  assert.equal(none.armour, null);
});

test("purity: the model never mutates the state", () => {
  const state = stateOf(joiner({ worn: { cloak: cloakRow("Cloak of Strength") }, timers: { "item:Cloak of Strength": { cadence: "squares", left: 3, phase: "effect", cd: 50 } } }));
  const before = JSON.stringify(state);
  companyItemsModel(state, 0);
  assert.equal(JSON.stringify(state), before);
});

// ─── copy ───────────────────────────────────────────────────────────────────

test("COMPANY_COPY: frozen, every leaf a string, says HP never WP, clears the safety wordlist", () => {
  const leaves = [];
  const walk = (o, at) => {
    assert.ok(Object.isFrozen(o), `${at} frozen`);
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") leaves.push([`${at}.${k}`, v]);
      else walk(v, `${at}.${k}`);
    }
  };
  walk(COMPANY_COPY, "COMPANY_COPY");
  assert.ok(leaves.length > 10);
  const bannedRe = BANNED.map((t) => new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const [at, v] of leaves) {
    assert.doesNotMatch(v, /\bwp\b/i, `${at} must not say WP`);
    for (const re of bannedRe) assert.doesNotMatch(v, re, `${at} matches banned ${re}`);
  }
  assert.equal(COMPANY_COPY.drink, "DRINK");
  assert.equal(COMPANY_COPY.use, "USE");
});
