// test/unit/joiner-item-chips.test.js
//
// Phase 89 plan 06 (ITEM-07, the chips; 88-03 finding: memberConditionsOf
// reported only duration abilities and Brace). A Joiner's live item effects
// show chips like the hero's: the SAME descriptors from ONE builder
// (engine/derived.js#liveItemChips, shared with conditionsOf), with or without
// a fight, so YOUR LOT (fight chips, via heroConditions.js#lotChips) and the
// Company panel (89-07) read them. Ability and Brace chips stay fight-only. The
// hero's chips are unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { conditionsOf, memberConditionsOf } from "../../engine/derived.js";
import { startEffect, startCooldown } from "../../engine/effects.js";
import { lotChips } from "../../src/browser/heroConditions.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function sheet(overrides = {}) {
  return {
    cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0, maxWP: 30, wp: 30, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    potions: 1, rations: 6, gold: 50, scrolls: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null, regen: false, mirror: 0, foresight: false,
    name: "Ada", darkFor: 0, halfNext: false, worn: {}, status: "ok",
    ...overrides,
  };
}

function floor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

const FOE = () => ({ name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1 });

/** A state with a hero (Hero) and one Joiner sheet at party index 0; in a fight when `fight`. */
function world(joinerSheet, { fight = false, hero = sheet({ name: "Hero" }), allyExtra = {} } = {}) {
  const state = { version: 1, seed: 1, rngState: 1, c: hero, floor: floor(), day: 1, steps: 0, combat: null, party: [joinerSheet], dead: false };
  if (fight) {
    state.combat = {
      foes: [FOE()], type: "Humans", round: 1, target: 0, pending: false, spellOpen: false, tracked: false,
      allies: [{ partyIdx: 0, name: joinerSheet.name, lvl: 1, wp: joinerSheet.wp, maxWP: joinerSheet.maxWP, ...allyExtra }],
    };
  }
  return state;
}

const keys = (list) => list.map((c) => c.key);
const live = (s, id, opts = { squares: 50, cd: 50 }) => startEffect(s, id, opts);

// ─── live item chips ────────────────────────────────────────────────────────

test("a live Cloak of Strength on a Joiner gives the hero's critWard chip shape, in a fight and out of one", () => {
  const j = sheet();
  live(j, "item:Cloak of Strength");
  const expected = { key: "critWard", polarity: "good", remaining: 50, cadence: "squares", source: "Cloak of Strength" };
  assert.deepEqual(memberConditionsOf(world(j, { fight: true }), 0), [expected]);
  assert.deepEqual(memberConditionsOf(world(j, { fight: false }), 0), [expected]);
});

test("the Joiner's chip for each kind of live item equals the hero's chip for the same record (one builder)", () => {
  const cases = [
    ["item:Cloak of Strength", { squares: 50, cd: 50 }],
    ["item:Cloak of Speed", { squares: 50 }],
    ["item:Cloak of Invisibility", { squares: 50 }],
    ["item:Cloak of Armor", { squares: 50, cd: 50 }],
    ["item:Cloak of Flying", { squares: 20, cd: 50 }],
    ["item:Cloak of Regeneration", { squares: 30, cd: 50 }],
    ["item:Ring of Power", { squares: 50, cd: 50 }],
    ["item:Gauntlet of the Giant", { squares: 50, cd: 50 }],
    ["item:Anklet of Invisibility", { squares: 50, cd: 50 }],
    ["item:Strength", { squares: 50 }],
    ["item:Enlarge", { squares: 50 }],
  ];
  for (const [id, opts] of cases) {
    const asJoiner = sheet();
    live(asJoiner, id, opts);
    const asHero = sheet({ name: "Hero" });
    live(asHero, id, opts);
    const fromHero = conditionsOf({ c: asHero, floor: floor(), combat: null, party: [] });
    const fromJoiner = memberConditionsOf(world(asJoiner), 0);
    assert.ok(fromHero.length >= 1, `${id} makes a hero chip`);
    assert.deepEqual(fromJoiner, fromHero, id);
  }
});

test("a live flight item gives the flight chip; Regeneration gives its ticks; a size item gives step, size and dmgTotal", () => {
  const j = sheet();
  live(j, "item:Cloak of Flying", { squares: 20, cd: 50 });
  assert.deepEqual(memberConditionsOf(world(j), 0), [{ key: "flight", polarity: "good", flight: "charged", remaining: 20, cadence: "squares", source: "Cloak of Flying" }]);

  const r = sheet();
  live(r, "item:Cloak of Regeneration", { squares: 30, cd: 50 });
  const [regen] = memberConditionsOf(world(r), 0);
  assert.equal(regen.key, "knit");
  assert.equal(regen.ticks, 3);

  const g = sheet();
  live(g, "item:Gauntlet of the Giant");
  const [giant] = memberConditionsOf(world(g), 0);
  assert.equal(giant.key, "giant");
  assert.equal(giant.step, 1);
  assert.equal(typeof giant.size, "string");
  assert.ok(giant.size.length > 0);
  assert.equal(typeof giant.dmgTotal, "number");
  assert.ok(giant.dmgTotal > 0);
});

test("the Joiner's own size name reads its OWN race, not the hero's", () => {
  const dwarf = sheet({ race: "Dwarven" });
  live(dwarf, "item:Gauntlet of the Giant");
  const human = sheet();
  live(human, "item:Gauntlet of the Giant");
  const a = memberConditionsOf(world(dwarf, { hero: sheet({ name: "Hero", race: "Troll" }) }), 0)[0];
  const b = memberConditionsOf(world(human, { hero: sheet({ name: "Hero", race: "Troll" }) }), 0)[0];
  const solo = conditionsOf({ c: (() => { const h = sheet({ name: "Hero", race: "Dwarven" }); live(h, "item:Gauntlet of the Giant"); return h; })(), floor: floor(), combat: null, party: [] })[0];
  assert.equal(a.size, solo.size, "a Dwarven Joiner reads like a Dwarven hero");
  assert.ok(typeof b.size === "string");
});

// ─── pendant, cooldown, fight-only and ordering ─────────────────────────────

test("Pendant: a Joiner's armed halfNext gives the halfNext chip anywhere", () => {
  const j = sheet({ halfNext: { slot: "jewelry1", n: "Pendant of Fortitude" } });
  assert.deepEqual(memberConditionsOf(world(j), 0), [{ key: "halfNext", polarity: "good" }]);
  assert.deepEqual(memberConditionsOf(world(j, { fight: true }), 0), [{ key: "halfNext", polarity: "good" }]);
  assert.deepEqual(memberConditionsOf(world(sheet({ halfNext: false })), 0), []);
});

test("Cooling: a Joiner's item in its cooldown gives an itemCooldown chip { item, remaining }, anywhere", () => {
  const j = sheet();
  startCooldown(j, "item:Ring of Power", { squares: 35 });
  const expected = { key: "itemCooldown", polarity: "good", item: "Ring of Power", remaining: 35 };
  assert.deepEqual(memberConditionsOf(world(j), 0), [expected]);
  assert.deepEqual(memberConditionsOf(world(j, { fight: true }), 0), [expected]);
});

test("Fight-only: ability and Brace chips still come only in a fight; item chips come both ways", () => {
  const j = sheet();
  live(j, "item:Cloak of Strength");
  startEffect(j, "ability:sidestep", { rounds: 2 });
  const outside = memberConditionsOf(world(j), 0);
  assert.deepEqual(keys(outside), ["critWard"], "no ability chip outside a fight");
  const inside = memberConditionsOf(world(j, { fight: true, allyExtra: { braced: true } }), 0);
  assert.deepEqual(keys(inside), ["critWard", "ability", "braced"]);
});

test("Order: item chips first (insertion order), then ability chips, then braced, then halfNext, then itemCooldown", () => {
  const j = sheet({ halfNext: { slot: "jewelry1", n: "Pendant of Fortitude" } });
  startCooldown(j, "item:Ring of Power", { squares: 10 });
  live(j, "item:Cloak of Speed", { squares: 50 });
  startEffect(j, "ability:smoke", { rounds: 2 });
  live(j, "item:Cloak of Strength");
  startCooldown(j, "item:Anklet of Invisibility", { squares: 40 });
  const out = memberConditionsOf(world(j, { fight: true, allyExtra: { braced: true } }), 0);
  assert.deepEqual(keys(out), ["haste", "critWard", "ability", "braced", "halfNext", "itemCooldown", "itemCooldown"]);
  assert.deepEqual(out.filter((c) => c.key === "itemCooldown").map((c) => c.item), ["Ring of Power", "Anklet of Invisibility"]);
});

test("never the hero's: a live item on the hero gives a Joiner nothing", () => {
  const hero = sheet({ name: "Hero" });
  live(hero, "item:Cloak of Speed", { squares: 50 });
  hero.halfNext = true;
  startCooldown(hero, "item:Ring of Power", { squares: 10 });
  assert.deepEqual(memberConditionsOf(world(sheet(), { hero, fight: true }), 0), []);
});

// ─── the hero is unchanged ──────────────────────────────────────────────────

test("Hero unchanged: conditionsOf gives exactly the old descriptors for a matrix of hero states (every item kind live, cooling, halfNext, in and out of a fight)", () => {
  const hero = sheet({ name: "Hero" });
  live(hero, "item:Cloak of Speed", { squares: 50 });
  live(hero, "item:Cloak of Flying", { squares: 20, cd: 50 });
  live(hero, "item:Cloak of Regeneration", { squares: 30, cd: 50 });
  live(hero, "item:Cloak of Strength");
  startCooldown(hero, "item:Ring of Power", { squares: 10 });
  hero.halfNext = true;
  const pre = [
    { key: "haste", polarity: "good", remaining: 50, cadence: "squares", source: "Cloak of Speed" },
    { key: "flight", polarity: "good", flight: "charged", remaining: 20, cadence: "squares", source: "Cloak of Flying" },
    { key: "knit", polarity: "good", remaining: 30, cadence: "squares", source: "Cloak of Regeneration", ticks: 3 },
    { key: "critWard", polarity: "good", remaining: 50, cadence: "squares", source: "Cloak of Strength" },
  ];
  const out = { key: "halfNext", polarity: "good" };
  const cool = { key: "itemCooldown", polarity: "good", item: "Ring of Power", remaining: 10 };
  assert.deepEqual(conditionsOf({ c: hero, floor: floor(), combat: null, party: [] }), [...pre, out, cool]);
  // in a fight the same descriptors (plus nothing for the member's own chips)
  const fighting = { c: hero, floor: floor(), combat: { foes: [FOE()], round: 1, target: 0, pending: false }, party: [sheet()] };
  assert.deepEqual(conditionsOf(fighting).filter((c) => c.key !== "fightDark"), [...pre, out, cool]);
  // the hero's own list never picks up the Joiner's effects
  live(fighting.party[0], "item:Cloak of Armor", { squares: 50, cd: 50 });
  assert.deepEqual(conditionsOf(fighting).filter((c) => c.key !== "fightDark"), [...pre, out, cool]);
});

// ─── robust ─────────────────────────────────────────────────────────────────

test("Robust: a missing member, a bad index, a sheet with no timers and a malformed state give [] and never throw", () => {
  const state = world(sheet());
  assert.deepEqual(memberConditionsOf(state, 0), [], "no timers");
  assert.deepEqual(memberConditionsOf(state, 1), [], "missing member");
  assert.deepEqual(memberConditionsOf(state, -1), []);
  assert.deepEqual(memberConditionsOf(state, 0.5), []);
  assert.deepEqual(memberConditionsOf(state, "0"), []);
  for (const bad of [null, undefined, 0, "state", [], {}, { party: "x" }, { party: [null] }, { party: [{ timers: "x" }] }, { party: [{ timers: { "item:Cloak of Strength": null } }], combat: {} }, { party: [{ timers: [] }], combat: { allies: "x" } }]) {
    let out;
    assert.doesNotThrow(() => {
      out = memberConditionsOf(bad, 0);
    }, `state ${JSON.stringify(bad)}`);
    assert.deepEqual(out, []);
  }
});

test("Purity: memberConditionsOf mutates nothing", () => {
  const j = sheet({ halfNext: { slot: "cloak", n: "x" } });
  live(j, "item:Cloak of Strength");
  startCooldown(j, "item:Ring of Power", { squares: 5 });
  const state = world(j, { fight: true });
  const before = JSON.stringify(state);
  memberConditionsOf(state, 0);
  assert.equal(JSON.stringify(state), before);
});

// ─── YOUR LOT ───────────────────────────────────────────────────────────────

test("YOUR LOT: lotChips keeps the Joiner's fight item chips (critWard, invis, haste, plate, unseen, power, giant, enlarge, halfNext) and drops the rest", () => {
  const j = sheet({ halfNext: { slot: "jewelry1", n: "Pendant of Fortitude" } });
  live(j, "item:Cloak of Strength"); // critWard: in
  live(j, "item:Cloak of Speed", { squares: 50 }); // haste: in
  live(j, "item:Cloak of Armor"); // plate: in
  live(j, "item:Anklet of Invisibility"); // unseen: in
  live(j, "item:Ring of Power"); // power: in
  live(j, "item:Gauntlet of the Giant"); // giant: in
  live(j, "item:Cloak of Invisibility", { squares: 50 }); // invis: in
  live(j, "item:Enlarge", { squares: 50 }); // enlarge: in
  live(j, "item:Cloak of Flying", { squares: 20, cd: 50 }); // flight: out
  live(j, "item:Cloak of Regeneration", { squares: 30, cd: 50 }); // knit: out
  startCooldown(j, "item:Helm of Knowledge", { squares: 40 }); // itemCooldown: out
  const conds = memberConditionsOf(world(j, { fight: true }), 0);
  assert.ok(conds.some((c) => c.key === "flight") && conds.some((c) => c.key === "itemCooldown") && conds.some((c) => c.key === "knit"));
  const chips = lotChips(conds);
  assert.deepEqual(
    chips.map((c) => c.key).sort(),
    ["critWard", "enlarge", "giant", "halfNext", "haste", "invis", "plate", "power", "unseen"],
  );
  assert.ok(chips.every((c) => c.tone === "good"));
});
