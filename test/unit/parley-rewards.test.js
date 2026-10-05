// test/unit/parley-rewards.test.js
//
// Phase 91 plan 05 (PARLEY-01, user 2026-09-30: "We should definitely"): a successful parley
// pays what winning the fight would. FULL experience (the same killSpFor sum a kill of every
// live foe pays, never halved), and for every live foe the spoils a kill of it would roll (its
// coin purse and its item-drop check, the bag-upgrade check included) into the pending loot
// pile, drawn from a derived stream (derivedRng(cursor, "parleySpoils", acts)); the Humans tip
// (d6 x 100 x depth wilmst on a 6) still pays on top. One new event, parleyWon, says so.
//
// The kill side is pinned byte-identical against golden values recorded from the base code
// (the commit before this plan) before foeSpoils was extracted from killFoe.

import test from "node:test";
import assert from "node:assert/strict";

import { parley, foeSpoils, killFoe, liveFoes } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { killSpFor } from "../../engine/derived.js";
import { heroSpFor } from "../../engine/difficulty.js";
import { derivedRng, makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/state.js";
import { SPELLS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction } from "../../src/browser/narrationLines.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { IDENTITY_TRAITS } from "../../content/identity.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const CURSOR = 777;

/** fakeRng(seq, cursor) — `.d()` pops the next raw value; throws when exhausted (a main-rng
 * draw outside the pinned layout fails the test); `getState` is the cursor the derived
 * spoils stream is keyed on. `draws` counts every main draw. */
function fakeRng(seq, cursor = CURSOR) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => cursor,
    get draws() {
      return i;
    },
  };
}

function hero(overrides = {}) {
  return {
    cls: "Thief", sub: "Con Artist", race: "Human", level: 3, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function floor(depth = 1) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function foe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 3, size: "S", intel: 2, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function mk({ c = {}, foes, type, depth = 1, acts = 0 } = {}) {
  const fs = foes ?? [foe()];
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(c),
    floor: floor(depth),
    day: 1, steps: 0, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
    combat: { foes: fs, type: type ?? fs[0].type, round: 1, target: 0, spellOpen: false, tracked: false },
  };
}

/** predictSpoils(state, foes, cursor, acts) — replays foeSpoils for `foes` in order on a CLONE of
 * `state` through the derived stream the parley draws from, to predict gold, items and events. */
function predictSpoils(state, foes, cursor = CURSOR) {
  const clone = structuredClone(state);
  clone.pendingLoot = clone.pendingLoot ?? [];
  const sr = derivedRng(cursor, "parleySpoils", state.acts ?? 0);
  const events = [];
  const out = { gold: 0, items: 0 };
  for (const f of foes) {
    const got = foeSpoils(clone, structuredClone(f), sr, events, { why: "parley spoils" });
    out.gold += got.gold;
    out.items += got.items;
  }
  return { ...out, events, pile: clone.pendingLoot, c: clone.c };
}

// A winning d20 (raw 1 is the best face of a roll-high check).
const WIN = 1;

test("full experience: two live foes pay exactly heroSpFor(round(sum of killSpFor(c, f, d6))), the same d6 per foe in the same order, never halved", () => {
  const f1 = foe({ name: "A", type: "Humans", lvl: 1 });
  const f2 = foe({ name: "B", type: "Humans", lvl: 2 });
  const s = mk({ c: { level: 2 }, foes: [f1, f2] });
  const rng = fakeRng([WIN, 3, 5, 2]); // d20, d6 (A), d6 (B), the Humans tip d6 (not a 6)
  const ev = parley(s, rng, []);
  const expected = heroSpFor(Math.round(killSpFor(s.c, f1, 3) + killSpFor(s.c, f2, 5)));
  const gained = ev.find((e) => e.type === "spGained" && e.reason === "parley");
  assert.equal(gained.amount, expected);
  assert.equal(s.c.sp, expected);
  assert.equal(expected, 65);
  // twice the old half, up to rounding
  assert.equal(Math.round(expected / 2), 33, "the Phase 20 half of the same fight was 33");
  assert.equal(rng.draws, 4);
});

test("a parley never pays more experience than killing the same foes: no doubled experience, no spoils for a foe already slain", () => {
  const alive = foe({ name: "Alive", type: "Humans", lvl: 1 });
  const dead = foe({ name: "Dead", type: "Humans", lvl: 5, alive: false, wp: 0 });
  const s = mk({ c: { level: 1 }, foes: [alive, dead] });
  const before = structuredClone(s);
  const rng = fakeRng([WIN, 3, 2]); // a draw for the dead foe would run the sequence dry
  const ev = parley(s, rng, []);
  const won = ev.find((e) => e.type === "parleyWon");
  assert.equal(won.count, 1, "only the live foe is talked down");
  assert.equal(ev.find((e) => e.type === "spGained").amount, heroSpFor(killSpFor(before.c, alive, 3)));
  // the spoils are exactly the live foe's, and nobody else's
  const predicted = predictSpoils(before, [alive]);
  assert.equal(won.gold, predicted.gold);
  assert.equal(won.items, predicted.items);
});

test("spoils: each live foe's purse (goldGained why 'parley spoils') and its item-drop check, in C.foes order, from the derived stream; a passing check adds one item to the pile (lootDropped)", () => {
  // level-18 foes: the drop check (2 + lvl faces) always passes; depth 3 opens the bag-upgrade check
  const foes = [foe({ name: "A", type: "Humans", lvl: 18 }), foe({ name: "B", type: "Demons", lvl: 18 })];
  const s = mk({ c: { level: 18 }, foes, depth: 3, acts: 41 });
  const predicted = predictSpoils(s, foes);
  assert.equal(predicted.items, 2, "both checks pass");
  const rng = fakeRng([WIN, 3, 3, 2]); // d20, d6, d6, the tip d6 (2: no tip)
  const ev = parley(s, rng, []);
  const coins = ev.filter((e) => e.type === "goldGained" && e.why === "parley spoils");
  assert.ok(coins.length >= 1, "a purse was paid");
  assert.deepEqual(
    ev.filter((e) => ["goldGained", "lootDropped"].includes(e.type)),
    predicted.events.filter((e) => ["goldGained", "lootDropped"].includes(e.type)),
    "the same coin and drop events a kill's helper rolls, in foe order",
  );
  assert.equal(ev.filter((e) => e.type === "lootDropped").length, 2);
  assert.deepEqual(s.pendingLoot.map((it) => it.n), predicted.pile.map((it) => it.n));
  assert.equal(s.c.gold, predicted.c.gold);
});

test("draw isolation: the main rng draws exactly the d20, the experience d6 per foe and (Humans) the tip d6 and amount d6, in that order; the spoils draw only from the derived stream", () => {
  const foes = [foe({ name: "A", type: "Humans", lvl: 18 }), foe({ name: "B", type: "Humans", lvl: 18 })];
  const s = mk({ c: { level: 18 }, foes, depth: 3 });
  const rng = fakeRng([WIN, 4, 2, 6, 3]); // d20, d6, d6, the tip d6 (6), the amount d6; a sixth draw would throw
  const ev = parley(s, rng, []);
  assert.equal(rng.draws, 5, "exactly the pre-existing draws; every spoils draw is derived");
  const tip = ev.find((e) => e.type === "goldGained" && e.why === "parley");
  assert.equal(tip.amount, 3 * 100 * 3);
  // the same fight and the same rolls with a different cursor: only the spoils change
  const s2 = mk({ c: { level: 18 }, foes: structuredClone(foes), depth: 3 });
  const ev2 = parley(s2, fakeRng([WIN, 4, 2, 6, 3], CURSOR + 1), []);
  assert.deepEqual(ev2.find((e) => e.type === "spGained"), ev.find((e) => e.type === "spGained"), "experience never reads the spoils stream");
  assert.deepEqual(ev2.find((e) => e.type === "goldGained" && e.why === "parley"), tip, "the tip never reads it either");
});

test("a Pickpocket's extra ITEM comes from the derived stream too: it moves no main-rng draw", () => {
  // Phase 91 plan 08 (IDENT-18, Q1 B): this test pinned the Pickpocket's extra GOLD take (a d10 +
  // d10 + d4 off the derived stream, `goldGained why "pickpocket"`); that take is retired and the
  // extra ITEM replaces it. A Wilmsry Pickpocket may parley anything but Magical foes; level 18
  // foes always drop an item.
  const foes = [foe({ name: "A", type: "Beasts", lvl: 18 })];
  const s = mk({ c: { sub: "Pickpocket", cls: "Thief", race: "Wilmsry", level: 18 }, foes, depth: 2 });
  const rng = fakeRng([WIN, 3]); // d20, d6: a Beasts parley has no tip draw, and a third draw would throw
  const ev = parley(s, rng, []);
  assert.ok(ev.some((e) => e.type === "parleyWon"));
  assert.equal(rng.draws, 2, "the Pickpocket's extra item comes off the derived stream");
  assert.equal(ev.some((e) => e.type === "goldGained" && e.why === "pickpocket"), false, "the extra gold take is retired");
  const drops = ev.filter((e) => e.type === "lootDropped");
  assert.equal(drops.length, 2, "the regular drop and the Pickpocket's extra");
  assert.equal(drops[1].pickpocket, true);
  assert.equal(s.pendingLoot.length, 2);
  assert.equal(ev.find((e) => e.type === "parleyWon").items, 2);
});

test("Humans: a tip d6 of 6 pays the tip AND the spoils; a tip d6 of 1 to 5 pays the spoils only; parleyWon.gold is both", () => {
  const foes = [foe({ name: "A", type: "Humans", lvl: 3 })];
  const base = mk({ c: { level: 3 }, foes, depth: 4 });
  const predicted = predictSpoils(base, foes);
  for (const tipRoll of [1, 2, 3, 4, 5]) {
    const s = structuredClone(base);
    const ev = parley(s, fakeRng([WIN, 3, tipRoll]), []);
    assert.equal(ev.some((e) => e.type === "goldGained" && e.why === "parley"), false, `tip d6 ${tipRoll}: no tip`);
    assert.equal(ev.find((e) => e.type === "parleyWon").gold, predicted.gold, `tip d6 ${tipRoll}: the spoils only`);
    assert.equal(s.c.gold, 50 + predicted.gold);
  }
  const s = structuredClone(base);
  const ev = parley(s, fakeRng([WIN, 3, 6, 2]), []); // the tip's amount d6 is 2
  const tip = ev.find((e) => e.type === "goldGained" && e.why === "parley");
  assert.equal(tip.amount, 2 * 100 * 4);
  assert.equal(ev.find((e) => e.type === "parleyWon").gold, predicted.gold + 800, "the tip is on top of the spoils");
  assert.equal(s.c.gold, 50 + predicted.gold + 800);
});

test("parleyWon: { count, sp, gold, items } is pushed after the spoils and before the fight ends", () => {
  const foes = [foe({ name: "A", type: "Beasts", lvl: 18 }), foe({ name: "B", type: "Beasts", lvl: 18 })];
  const s = mk({ c: { sub: "Woodsman", cls: "Thief", level: 18 }, foes, depth: 3 });
  const predicted = predictSpoils(s, foes);
  const ev = parley(s, fakeRng([WIN, 2, 2]), []);
  const types = ev.map((e) => e.type);
  const i = types.indexOf("parleyWon");
  assert.ok(i > types.lastIndexOf("lootDropped") && i > types.lastIndexOf("goldGained"), "after every spoil");
  assert.ok(i < types.indexOf("combatEnded"));
  const won = ev[i];
  assert.deepEqual(Object.keys(won).sort(), ["count", "gold", "items", "sp", "type"]);
  assert.equal(won.count, 2);
  assert.equal(won.sp, ev.find((e) => e.type === "spGained").amount);
  assert.equal(won.gold, predicted.gold);
  assert.equal(won.items, predicted.items);
  assert.equal(won.items, 2);
});

test("a Beast talked down gives no Cooking ration: it walks away alive", () => {
  const s = mk({ c: { sub: "Woodsman", cls: "Thief", level: 18, skills: { Cooking: 1 } }, foes: [foe({ type: "Beasts", lvl: 18 })], depth: 3 });
  const rations = s.c.rations;
  const ev = parley(s, fakeRng([WIN, 2]), []);
  assert.ok(ev.some((e) => e.type === "parleyWon"));
  assert.equal(ev.some((e) => e.type === "cooked"), false);
  assert.equal(s.c.rations, rations);
  assert.equal(s.c.kills ?? 0, 0, "nothing was killed");
});

test("failure unchanged: a failed parley pays nothing, insults the group and runs the foes' turn", () => {
  const s = mk({ c: { level: 3 }, foes: [foe({ type: "Humans", lvl: 3, asleep: 5 })] });
  const ev = parley(s, fakeRng([20]), []);
  assert.ok(ev.some((e) => e.type === "parleyFailed"));
  assert.ok(ev.some((e) => e.type === "parleyInsulted"));
  assert.equal(ev.some((e) => ["parleyWon", "spGained", "goldGained", "lootDropped"].includes(e.type)), false);
  assert.equal(s.c.sp, 0);
  assert.equal(s.c.gold, 50);
  assert.equal(s.combat.parleyInsulted, true);
  assert.ok((s.pendingLoot ?? []).length === 0);
});

test("pile: after a won parley the fight is over and state.pendingLoot holds the drops for the ordinary loot screen", () => {
  const foes = [foe({ name: "A", type: "Humans", lvl: 18 })];
  const s = mk({ c: { level: 18 }, foes, depth: 3 });
  s.pendingLoot = [{ kind: "gold", n: "an earlier drop" }];
  const ev = parley(s, fakeRng([WIN, 3, 2]), []);
  assert.equal(s.combat, null, "the fight is over");
  assert.equal(s.pendingLoot.length, 2, "the new drop joins the pile, the earlier one stays");
  assert.equal(s.pendingLoot[0].n, "an earlier drop");
  assert.equal(ev.filter((e) => e.type === "lootDropped").length, 1);
});

test("Chameleon Tongue's parley is this parley: it pays full experience and spoils too", () => {
  const idx = SPELLS.findIndex((sp) => sp.n === "Chameleon Tongue");
  const foes = [foe({ name: "A", type: "Magical", lvl: 18 })];
  const s = mk({ c: { cls: "Magic User", sub: "Illusionist", level: 18, grimoire: ["Chameleon Tongue"] }, foes, depth: 3 });
  const predicted = predictSpoils(s, foes);
  const ev = castSpell(s, idx, fakeRng([WIN, 2, 2, 2, 2]), []);
  const won = ev.find((e) => e.type === "parleyWon");
  assert.ok(won, "the cast parleyed and won");
  assert.equal(won.sp, heroSpFor(killSpFor(s.c, foes[0], 2)));
  assert.equal(won.gold, predicted.gold);
  assert.equal(s.combat, null);
});

// ---------------------------------------------------------------------------
// Kills are byte-identical (golden values recorded from the base commit's killFoe)
// ---------------------------------------------------------------------------

const KILL_GOLDEN = [
  { seed: 1, sub: "Soldier", race: "Human", depth: 1, type: "Beasts", lvl: 1,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":5,\"group\":\"Beasts\"},{\"type\":\"lootDropped\",\"name\":\"Amulet of Stone\",\"kind\":\"jewel\",\"roll\":18,\"atLeast\":18,\"dieN\":20},{\"type\":\"cooked\",\"wp\":0,\"rations\":1}]",
    gold: 50, sp: 5, rngState: -63940196, loot: ["Amulet of Stone"], rations: 7 },
  { seed: 2, sub: "Knight", race: "Human", depth: 3, type: "Humans", lvl: 3,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":45,\"group\":\"Humans\"},{\"type\":\"goldGained\",\"amount\":22,\"why\":\"off the body\"}]",
    gold: 72, sp: 45, rngState: 1199731145, loot: [], rations: 6 },
  // Phase 91 plan 08 (IDENT-18, audit Q1 B): this one entry MOVED and was re-recorded alone. A
  // Pickpocket's extra gold take is retired, so the kill loses its `goldGained why "pickpocket"`
  // beat (83) and the three main-rng draws behind it: before gold 143 / cursor -1895506007 /
  // off-the-body coin 93; after gold 60 / cursor 1199731146 / coin 10 (the purse alone).
  { seed: 3, sub: "Pickpocket", race: "Human", depth: 4, type: "Demons", lvl: 4,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":60,\"group\":\"Demons\"},{\"type\":\"goldGained\",\"amount\":10,\"why\":\"off the body\"}]",
    gold: 60, sp: 60, rngState: 1199731146, loot: [], rations: 5 },
  { seed: 4, sub: "Soldier", race: "Wilmsry", depth: 6, type: "Lair Beasts", lvl: 5,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":25,\"group\":\"Lair Beasts\"},{\"type\":\"goldGained\",\"amount\":5,\"why\":\"off the body\"},{\"type\":\"cooked\",\"wp\":0,\"rations\":1}]",
    gold: 55, sp: 25, rngState: -1263670336, loot: [], rations: 7 },
  { seed: 5, sub: "Barbarian", race: "Troll", depth: 2, type: "Magical", lvl: 2,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":15,\"group\":\"Magical\"},{\"type\":\"goldGained\",\"amount\":11,\"why\":\"off the body\"}]",
    gold: 61, sp: 15, rngState: 1199731148, loot: [], rations: 6 },
  { seed: 6, sub: "Master of Arms", race: "Dwarven", depth: 8, type: "Walking Dead", lvl: 6,
    events: "[{\"type\":\"foeKilled\",\"name\":\"Target\",\"spGained\":90,\"group\":\"Walking Dead\"},{\"type\":\"goldGained\",\"amount\":11,\"why\":\"off the body\"}]",
    gold: 61, sp: 90, rngState: 1199731149, loot: [], rations: 6 },
];

test("kill byte-identical: killFoe (now routed through foeSpoils) gives the same events, gold, experience, pile, rations and rng cursor as the base code on seeded states", () => {
  for (const k of KILL_GOLDEN) {
    const state = newRun(k.seed, [], { force: { sub: k.sub, race: k.race } });
    state.floor.depth = k.depth;
    const f = { name: "Target", type: k.type, lvl: k.lvl, size: "S", intel: 2, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
    state.combat = { foes: [f], type: k.type, round: 1, target: 0, spellOpen: false, tracked: false };
    state.pendingLoot = [];
    const rng = makeRng(1000 + k.seed);
    const events = killFoe(state, f, rng, []);
    const label = `seed ${k.seed} (${k.sub})`;
    assert.equal(JSON.stringify(events), k.events, `${label}: events`);
    assert.equal(state.c.gold, k.gold, `${label}: gold`);
    assert.equal(state.c.sp, k.sp, `${label}: sp`);
    assert.equal(rng.getState(), k.rngState, `${label}: rng cursor`);
    assert.deepEqual(state.pendingLoot.map((it) => it.n), k.loot, `${label}: pile`);
    assert.equal(state.c.rations, k.rations, `${label}: rations`);
  }
});

test("foeSpoils: the coin and drop a kill rolls, returning { gold, items }; the 'why' only renames the coin; a Petrify-style spoils-free kill still skips it", () => {
  const f = foe({ type: "Humans", lvl: 18 });
  const a = mk({ foes: [f], depth: 3 });
  const b = structuredClone(a);
  const evA = [];
  const evB = [];
  const ra = foeSpoils(a, structuredClone(f), makeRng(5), evA);
  const rb = foeSpoils(b, structuredClone(f), makeRng(5), evB, { why: "parley spoils" });
  assert.deepEqual(ra, rb);
  assert.equal(evA.find((e) => e.type === "goldGained")?.why, "off the body");
  assert.equal(evB.find((e) => e.type === "goldGained")?.why, "parley spoils");
  assert.equal(ra.items, 1);
  assert.equal(a.pendingLoot.length, 1);
  // killFoe's spoils:false path never calls it
  const c = mk({ foes: [structuredClone(f)], depth: 3 });
  const evC = killFoe(c, c.combat.foes[0], makeRng(5), [], { spoils: false });
  assert.equal(evC.some((e) => e.type === "goldGained" || e.type === "lootDropped"), false);
});

// ---------------------------------------------------------------------------
// Narration and the card
// ---------------------------------------------------------------------------

test("parleyWon has an Oracle line and a rail twin that say what the parley paid, and no undefined or NaN on a bare payload", () => {
  const full = { type: "parleyWon", count: 2, sp: 65, gold: 130, items: 1 };
  const oracle = EVENT_NARRATION.parleyWon(full);
  assert.match(oracle, /2 foes/);
  assert.match(oracle, /\+65 XP/);
  assert.match(oracle, /\+130 wilmst/);
  assert.match(oracle, /1 item left on the pile/);
  const rail = LINE_FOR.parleyWon(full);
  assert.match(rail.text, /Talked down 2 foes/);
  assert.match(rail.text, /\+65 XP/);
  assert.match(rail.text, /\+130 wilmst/);
  assert.match(rail.text, /1 item for you/);
  for (const payload of [{ type: "parleyWon" }, { type: "parleyWon", count: 1, sp: 0, gold: 0, items: 0 }]) {
    const o = EVENT_NARRATION.parleyWon(payload);
    const r = LINE_FOR.parleyWon(payload).text;
    assert.doesNotMatch(o, /undefined|NaN/);
    assert.doesNotMatch(r, /undefined|NaN/);
    assert.doesNotMatch(o, /wilmst/, "a zero purse is left out");
    assert.doesNotMatch(o, /\bitems?\b.*pile/, "no items, no pile line");
  }
  assert.match(EVENT_NARRATION.goldGained({ type: "goldGained", amount: 7, why: "parley spoils" }), /purses.*\+7 wilmst/);
  assert.equal(LINE_FOR.goldGained({ type: "goldGained", amount: 7, why: "parley spoils" }).text, "+7 wilmst (parley spoils)");
});

test("the rail folds the parley roll with parleyWon into one line", () => {
  const events = [
    { type: "parleyRolled", roll: 16, atLeast: 4, dieN: 20, fluency: 0 },
    { type: "spGained", amount: 10, reason: "parley" },
    { type: "parleyWon", count: 1, sp: 10, gold: 0, items: 0 },
    { type: "combatEnded" },
  ];
  const out = linesForAction("parley", events, {});
  const won = out.filter((l) => /Talked down/.test(l.text));
  assert.equal(won.length, 1);
  assert.match(won[0].text, /\(16 vs 4–20\)/, "the roll is folded into the pay line");
  assert.equal(out.some((l) => /^Talk it down/.test(l.text)), false, "the roll is not repeated on its own line");
});

test("the PARLEY row says what a parley is and what it pays", () => {
  const d = COMBAT_MENU_COPY.parleyDesc;
  assert.match(d, /^One try per fight\./);
  assert.match(d, /fight ends as if you had won it/);
  assert.match(d, /full experience/);
  assert.match(d, /spoils/);
  assert.match(d, /Humans sometimes tip on top/);
  // Phase 91 plan 10 (TEXT-01): "one face easier" is "+1 to hit".
  assert.match(d, /Fail and they take it personally: every foe gets \+1 to hit you and yours until it ends\./);
});

test("liveFoes is what a parley talks down (a sanity read of the shared helper)", () => {
  const s = mk({ foes: [foe({ name: "A" }), foe({ name: "B", alive: false })] });
  assert.deepEqual(liveFoes(s).map((f) => f.name), ["A"]);
});

// ---------------------------------------------------------------------------
// The traits that open a parley say so, and say the bonus the engine adds
// ---------------------------------------------------------------------------

test("the parley traits read \"can always parley with X\" and state the bonus the engine adds", () => {
  const text = (kind, key, id) => {
    const t = [...IDENTITY_TRAITS[kind][key].good, ...IDENTITY_TRAITS[kind][key].bad].find((x) => x.id === id);
    assert.ok(t, `${key} has ${id}`);
    return t.text;
  };
  assert.equal(text("race", "Elven", "elven-humans"), "can always parley with Humans, +3 on that parley roll");
  assert.equal(text("sub", "Woodsman", "woodsman-talk"), "can always parley with Beasts and Lair Beasts; +3 on every parley roll");
  assert.equal(text("sub", "Con Artist", "con-artist-talk"), "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll");
  assert.equal(text("race", "Wilmsry", "wilmsry-talk"), "can always parley with anything but Magical foes and the Walking Dead; +4 on every parley roll");
  assert.equal(text("sub", "Bard", "bard-humans"), "can always parley with Humans");
  assert.equal(text("sub", "Court Mage", "court-mage-humans"), "can always parley with Humans");
  assert.equal(text("sub", "Master of Arms", "moa-parley"), "can never talk a fight down");

  // the stated bonuses are the engine's own: at equal level against one foe the winning range opens
  // at 21 minus (9 + bonus) on the d20 (parleyRolled.atLeast), so +4 reads 8, +3 reads 9, none reads 12
  const atLeast = (c, type) => {
    const s = mk({ c: { level: 3, ...c }, foes: [foe({ type, lvl: 3, asleep: 5 })] });
    const ev = parley(s, fakeRng([WIN, 2, 2]), []);
    return ev.find((e) => e.type === "parleyRolled").atLeast;
  };
  assert.equal(atLeast({ sub: "Con Artist", cls: "Thief" }, "Humans"), 8, "Con Artist +4");
  assert.equal(atLeast({ sub: "Woodsman", cls: "Thief" }, "Beasts"), 9, "Woodsman +3");
  assert.equal(atLeast({ sub: "Soldier", cls: "Fighter", race: "Wilmsry" }, "Beasts"), 8, "Wilmsry +4");
  assert.equal(atLeast({ sub: "Soldier", cls: "Fighter", race: "Elven" }, "Humans"), 9, "Elven +3 vs Humans");
  assert.equal(atLeast({ sub: "Bard", cls: "Thief" }, "Humans"), 12, "the Bard adds nothing");
  assert.equal(atLeast({ sub: "Court Mage", cls: "Magic User" }, "Humans"), 12, "the Court Mage adds nothing");
});
