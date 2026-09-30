// test/unit/poplar-party-heal.test.js
//
// Phase 89 plan 03 (ITEM-01, ITEM-06; CONTEXT "Poplar Staff", user 2026-09-30):
// the Poplar Staff does what its text and canon promise. Canon (mazeworld.pdf
// p.46): "Healing staff, adds 1d20+10 WP to 1d6". Before this plan its use was
// "heal", which fell into useItem's Healing-potion branch (d10+2 on the main
// rng, the hero only). Now using a wielded Poplar heals the hero AND every
// living Joiner d20+10 each (clamped to each one's maximum), every die from
// ONE derived stream (derivedRng(cursor, "partyHeal", acts, item name)), never
// the main rng. One `partyHealed` event names every body healed.
//
// Clauses -> tests:
//   record ............. "the Poplar's activation record carries its heal dice ..."
//   solo ............... "solo: a hero's Poplar use heals only the hero ..."
//   party out of fight . "party out of a fight: ..."
//   party in a fight ... "party in a fight: ..."
//   downed member ...... "a Joiner downed this fight ..."
//   full hp (adjacency)  "a body already at full hp gains 0 ..."
//   ordering ........... "ordering: hero first, then state.party order ..."
//   old save ........... "an old save's Poplar (use \"heal\") heals the party too"
//   potion untouched ... "the Healing potion is untouched ..."
//   charge model ....... "the staff's charge model is unchanged ..."
//   no main-rng draw ... "no main-rng draw: ..."
//   invisibility edge .. "Crystal Staff party invisibility and a Joiner's own invisibility ..."

import test from "node:test";
import assert from "node:assert/strict";

import { useItem, healPartyMember } from "../../engine/items.js";
import { derivedRng } from "../../engine/rng.js";
import { rollDice } from "../../engine/dice.js";
import { foeToHitVs, itemEffectActive } from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { ACTIVATION_OF, STAVES } from "../../content/index.js";

const CURSOR = 7;
const DICE = Object.freeze({ n: 1, sides: 20, bonus: 10 });

/** mainRng() — a main rng whose `.d()` throws (the heal dice must never touch
 * it) and whose cursor is fixed, so the derived stream is predictable. */
function mainRng() {
  const rng = {
    draws: 0,
    d() {
      rng.draws++;
      throw new Error("the main rng must not be drawn for a Poplar heal");
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => CURSOR,
  };
  return rng;
}

function poplar(overrides = {}) {
  return { kind: "staff", n: "Poplar Staff", use: "partyHeal", charges: 3, txt: "", ...overrides };
}

function fixedChar(overrides = {}) {
  const staff = poplar();
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1,
    wp: 10, maxWP: 60, might: 0, gold: 50, kills: 0,
    weapon: "Poplar Staff", staff, prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    ward: null, regen: false, mirror: 0, affliction: null, halfNext: false,
    items: [], worn: {}, skills: {}, timers: {}, darkFor: 0,
    name: "Hero", motive: "Money",
    ...overrides,
  };
}

function joiner(name, wp, maxWP, extra = {}) {
  return { name, cls: "Fighter", sub: "Soldier", race: "Human", level: 1, wp, maxWP, timers: {}, worn: {}, items: [], halfNext: false, ...extra };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedChar(cOverrides),
    floor: { depth: 1, py: 0, px: 0, g: [[{ wall: false, dark: false }]] },
    day: 1, steps: 0, combat: null, acts: 0, dead: false, party: [],
    ...rest,
  };
}

function fight(state, allies) {
  state.combat = {
    foes: [{ name: "Rat", type: "Beasts", alive: true, wp: 9, maxWP: 9, asleep: 0 }],
    type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, pending: false,
    allies,
  };
  return state;
}

/** The predicted dice: the same derived stream, rolled in the same order. */
function predicted(acts = 0, n = 2) {
  const stream = derivedRng(CURSOR, "partyHeal", acts, "Poplar Staff");
  return Array.from({ length: n }, () => rollDice(stream, DICE));
}

const use = (state, rng = mainRng()) => {
  const events = [];
  useItem(state, { slot: "weapon" }, rng, events);
  return events;
};

test("the Poplar's activation record carries its heal dice, and its row keeps no act/slot key", () => {
  assert.deepStrictEqual(ACTIVATION_OF["Poplar Staff"], {
    kind: "partyHeal", charges: 3, recharge: 60, heal: { n: 1, sides: 20, bonus: 10 },
  });
  const row = STAVES.find((r) => r.n === "Poplar Staff");
  assert.equal(row.use, "partyHeal");
  assert.ok(!("act" in row) && !("slot" in row));
  assert.match(row.txt, /d20\+10/, "the text states the dice the engine uses");
  assert.match(row.txt, /Joiner|party/i, "the text says who it reaches");
  assert.ok(Object.isFrozen(ACTIVATION_OF["Poplar Staff"].heal), "the heal dice are frozen");
});

test("solo: a hero's Poplar use heals only the hero, draws exactly one heal die and spends a charge", () => {
  const s = fixedState();
  const events = use(s);
  const [a] = predicted();
  assert.equal(s.c.wp, 10 + a);
  const healed = events.find((e) => e.type === "partyHealed");
  assert.deepStrictEqual(healed, {
    type: "partyHealed", item: "Poplar Staff",
    heals: [{ name: "Hero", hero: true, amount: a, gained: a }],
  });
  assert.equal(s.c.staff.charges, 2, "one charge spent");
  assert.ok(a >= 11 && a <= 30, "d20+10");
});

test("no main-rng draw: a Poplar use with an rng that throws on any draw never throws and never advances it", () => {
  const rng = mainRng();
  const s = fixedState({ party: [joiner("Grum", 5, 40)] });
  assert.doesNotThrow(() => use(s, rng));
  assert.equal(rng.draws, 0);
});

test("party out of a fight: the hero then the Joiner heal d20+10 each from one stream, on the Joiner's sheet", () => {
  const s = fixedState({ party: [joiner("Grum", 5, 40)] });
  const events = use(s);
  const [a, b] = predicted();
  assert.equal(s.c.wp, 10 + a);
  assert.equal(s.party[0].wp, 5 + b);
  const healed = events.find((e) => e.type === "partyHealed");
  assert.deepStrictEqual(healed.heals, [
    { name: "Hero", hero: true, amount: a, gained: a },
    { name: "Grum", amount: b, gained: b },
  ]);
});

test("party in a fight: the Joiner's live fight hp rises, its sheet only at endCombat", () => {
  const s = fight(fixedState({ party: [joiner("Grum", 5, 40)] }), [
    { partyIdx: 0, name: "Grum", lvl: 1, sub: "Soldier", wp: 5, maxWP: 40 },
  ]);
  const events = use(s);
  const [a, b] = predicted();
  assert.equal(s.c.wp, 10 + a);
  assert.equal(s.combat.allies[0].wp, 5 + b, "the live fight entry took the heal");
  assert.equal(s.party[0].wp, 5, "the sheet is synced by endCombat, not here");
  assert.deepStrictEqual(events.find((e) => e.type === "partyHealed").heals[1], { name: "Grum", amount: b, gained: b });
});

test("a Joiner downed this fight (spliced out of the fight) is not healed and not listed; the heal is the hero's only", () => {
  const s = fight(fixedState({ party: [joiner("Grum", 0, 40, { status: "downed" })] }), []);
  const events = use(s);
  const [a] = predicted();
  assert.equal(s.c.wp, 10 + a);
  assert.equal(s.party[0].wp, 0);
  assert.deepStrictEqual(events.find((e) => e.type === "partyHealed").heals.map((h) => h.name), ["Hero"]);
  // healPartyMember's own contract: a missing, downed or departed member is null.
  assert.equal(healPartyMember(s, 0, 9), null);
  assert.equal(healPartyMember(s, 5, 9), null);
  const s2 = fight(fixedState({ party: [joiner("Grum", 5, 40)] }), []);
  assert.equal(healPartyMember(s2, 0, 9), null, "in a fight with no live entry the member is out of it");
});

test("a body already at full hp gains 0 and is still listed with its roll; clamps at each maximum", () => {
  const s = fixedState({ c: { wp: 59, maxWP: 60 }, party: [joiner("Grum", 40, 40)] });
  const events = use(s);
  const [a, b] = predicted();
  assert.equal(s.c.wp, 60);
  assert.equal(s.party[0].wp, 40);
  assert.deepStrictEqual(events.find((e) => e.type === "partyHealed").heals, [
    { name: "Hero", hero: true, amount: a, gained: 1 },
    { name: "Grum", amount: b, gained: 0 },
  ]);
});

test("ordering: hero first, then state.party order; the event lists them in that order", () => {
  const s = fixedState({ party: [joiner("Ann", 1, 40), joiner("Bob", 2, 40)] });
  const events = use(s);
  const [a, b, c] = predicted(0, 3);
  assert.deepStrictEqual(events.find((e) => e.type === "partyHealed").heals.map((h) => [h.name, h.amount]), [
    ["Hero", a], ["Ann", b], ["Bob", c],
  ]);
});

test("the stream is keyed by acts: the same use at another act count rolls another stream", () => {
  const s = fixedState({ acts: 5 });
  use(s);
  assert.equal(s.c.wp, 10 + predicted(5, 1)[0]);
});

test("an old save's Poplar (its item still says use \"heal\") heals the party too", () => {
  const old = { kind: "staff", n: "Poplar Staff", use: "heal", charges: 3, txt: "1d20+10 hp to up to 6" };
  const s = fixedState({ c: { staff: old }, party: [joiner("Grum", 5, 40)] });
  const events = use(s);
  const [a, b] = predicted();
  assert.equal(s.c.wp, 10 + a);
  assert.equal(s.party[0].wp, 5 + b);
  assert.ok(!events.some((e) => e.type === "healed"), "no Healing-potion line");
  assert.ok(events.some((e) => e.type === "partyHealed"));
});

test("the Healing potion is untouched: d10+2 on the main rng, the hero only", () => {
  const potion = { kind: "potion", n: "Healing", eff2: "heal", txt: "+d10+2 hp" };
  const s = fixedState({ c: { items: [potion] }, party: [joiner("Grum", 5, 40)] });
  const rng = { d: () => 4, pick: (a) => a[0], shuffle: (a) => a, getState: () => CURSOR };
  const events = [];
  useItem(s, 0, rng, events);
  assert.equal(s.c.wp, 10 + 6);
  assert.equal(s.party[0].wp, 5, "a potion never reaches the Joiner");
  assert.deepStrictEqual(events.find((e) => e.type === "healed"), { type: "healed", amount: 6, gained: 6 });
  assert.ok(!events.some((e) => e.type === "partyHealed"));
});

test("the staff's charge model is unchanged: 3 charges, a 60-square recharge starts on the first use, none left refuses", () => {
  const s = fixedState();
  use(s);
  assert.equal(s.c.staff.charges, 2);
  assert.deepStrictEqual(s.c.timers["charges:Poplar Staff"], { cadence: "squares", left: 60, phase: "cooldown" });
  s.c.staff.charges = 0;
  const events = use(s);
  assert.ok(events.some((e) => e.type === "useRefused" && e.reason === "recharging"));
  assert.ok(!events.some((e) => e.type === "partyHealed"));
});

test("a non-caster still cannot use it (wrongClass refuses first)", () => {
  const s = fixedState({ c: { cls: "Fighter" } });
  const events = use(s);
  assert.ok(events.some((e) => e.type === "useRefused" && e.reason === "wrongClass"));
  assert.equal(s.c.wp, 10);
});

test("edge (adjacency): a Crystal Staff's party invisibility and a Joiner's own invisibility never stack past the one-face override", () => {
  const s = fight(fixedState({ party: [joiner("Grum", 40, 40)] }), [
    { partyIdx: 0, name: "Grum", lvl: 1, sub: "Soldier", wp: 40, maxWP: 40 },
  ]);
  const sheet = s.party[0];
  const plain = foeToHitVs(s, "member", sheet);
  startEffect(s.c, "item:Crystal Staff", { squares: 10 });
  const partyOnly = foeToHitVs(s, "member", sheet);
  assert.notEqual(partyOnly, plain, "the hero's Crystal Staff reaches the Joiner");
  startEffect(sheet, "item:Cloak of Invisibility", { squares: 50, cd: 50 });
  assert.ok(itemEffectActive(sheet, "invis"), "the Joiner's own invisibility is live");
  assert.equal(foeToHitVs(s, "member", sheet), partyOnly, "a second invisibility does not push the foe past its top face");
});
