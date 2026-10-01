// test/unit/joiner-armour-soak.test.js
//
// Phase 89 plan 04 (ITEM-07, user 2026-09-30: "let their armor soak damage.
// Just like players."). A foe's landed blow on a Joiner goes through the
// Joiner's OWN pipeline, in the hero's order: its armed Pendant of Fortitude
// halves it, its Brace halves it, then its own armour soaks it (a d20 against
// engine/derived.js#armorSoak on the Joiner's sheet) and wears. One helper,
// engine/combat.js#applyFoeDamageToMember, serves the melee swing and the
// foe's bolt/drain. The soak die is a derived stream: no main-rng draw is
// added or moved.

import test from "node:test";
import assert from "node:assert/strict";

import { applyFoeDamageToMember, foeTurn } from "../../engine/combat.js";
import { armorSoak } from "../../engine/derived.js";
import { derivedRng } from "../../engine/rng.js";
import { rollCheck, atLeastFor } from "../../engine/dice.js";
import { startEffect } from "../../engine/effects.js";
import { ARMORS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { heroState, withMember, inCombat, foeFrom } from "./harness/rollOdds.js";

setIdentityDials();

const STUDDED = ARMORS.find((a) => a.name === "Studded");
const ROUND = 2;
const FOE_IDX = 0;
const SWING = 0;
const PARTY_IDX = 0;

/** A Joiner sheet with explicit armour fields (Studded by default). */
function joinerSheet(over = {}) {
  return {
    name: "Brom", cls: "Fighter", sub: "Soldier", race: "Human", level: 1,
    wp: 30, maxWP: 30, status: "ok", timers: [],
    armor: STUDDED.name, ar: STUDDED.ar, armorMin: STUDDED.min, armorWP: STUDDED.wp, armorMax: STUDDED.wp,
    ...over,
  };
}

/** A scene: the hero (own armour, must never change), one Joiner, one foe. */
function scene({ sheet = joinerSheet(), foeOver = {}, braced = false } = {}) {
  const foe = { name: "Ned", type: "Humans", lvl: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, ...foeOver };
  const member = { partyIdx: PARTY_IDX, name: sheet.name, lvl: 1, sub: sheet.sub, wp: 30, maxWP: 30, braced };
  const hero = { name: "Hero", cls: "Fighter", sub: "Soldier", race: "Human", wp: 40, maxWP: 40, ar: 12, armorMin: 2, armorWP: 30, armorMax: 30, timers: [] };
  const state = { c: hero, party: [sheet], combat: { foes: [foe], round: ROUND, allies: [member] } };
  return { state, foe, member, hero, sheet };
}

/** An rng whose main stream must never be drawn; getState is the cursor. */
function cursorRng(cursor) {
  return {
    d() { throw new Error("the main stream must not be drawn"); },
    pick() { throw new Error("the main stream must not be drawn"); },
    getState: () => cursor,
  };
}

/** The soak die the engine will roll for a cursor (same key, same threshold). */
function soakDie(cursor, sheet, swing = SWING) {
  const av = armorSoak(sheet);
  return rollCheck(derivedRng(cursor, "memberSoak", ROUND, FOE_IDX, swing, PARTY_IDX), 20, atLeastFor(av.ar, 20));
}

/** The first cursor whose soak die satisfies `want`. */
function cursorWhere(sheet, want, swing = SWING) {
  for (let cur = 0; cur < 20000; cur++) if (want(soakDie(cur, sheet, swing))) return cur;
  throw new Error("no cursor found");
}

const SOAKS = (sheet) => cursorWhere(sheet, (k) => k.ok);
const MISSES = (sheet) => cursorWhere(sheet, (k) => !k.ok);

function blow(state, foe, member, cursor, opts) {
  const events = [];
  const res = applyFoeDamageToMember(state, foe, member, cursorRng(cursor), events, { dmg: 7, roll: 15, atLeast: 12, dieN: 20, mods: [], critical: false, swing: SWING, ...opts });
  return { events, res };
}

const types = (events) => events.map((e) => e.type);

test("soak: a Studded Fighter Joiner hit for 7 with the soak die at the threshold or above takes 0 HP and its armour wears 7", () => {
  const { state, foe, member, sheet, hero } = scene();
  const heroBefore = JSON.stringify(hero);
  const { events, res } = blow(state, foe, member, SOAKS(sheet));
  assert.deepEqual(types(events), ["armorSoaked"]);
  assert.equal(events[0].member, "Brom");
  assert.equal(events[0].amount, 7);
  assert.equal(events[0].wear, 7);
  assert.equal(member.wp, 30);
  assert.equal(sheet.armorWP, STUDDED.wp - 7);
  assert.deepEqual(res, { downed: false, soaked: true, applied: 0 });
  assert.equal(JSON.stringify(hero), heroBefore, "the hero's armour never changes when a Joiner soaks");
});

test("miss the soak: the same blow takes 7 off the roster entry and memberStruck carries the failed soak die", () => {
  const { state, foe, member, sheet } = scene();
  const cur = MISSES(sheet);
  const die = soakDie(cur, sheet);
  const { events, res } = blow(state, foe, member, cur);
  assert.deepEqual(types(events), ["memberStruck"]);
  assert.equal(member.wp, 23);
  assert.equal(sheet.armorWP, STUDDED.wp, "a blow that gets through wears nothing");
  assert.deepEqual(events[0].soak, { roll: die.roll, atLeast: die.atLeast, dieN: 20 });
  assert.deepEqual(res, { downed: false, soaked: false, applied: 7 });
});

test("the soak die comes from derivedRng(cursor, 'memberSoak', round, foe index, swing, party index) and never the main stream", () => {
  const { state, foe, member, sheet } = scene();
  const cur = cursorWhere(sheet, (k) => k.ok);
  const { events } = blow(state, foe, member, cur); // cursorRng throws on any main draw
  const die = soakDie(cur, sheet);
  assert.equal(events[0].roll, die.roll);
  assert.equal(events[0].atLeast, die.atLeast);
  // A different swing index is a different stream: find a cursor where the two swings roll differently.
  let differing = -1;
  for (let c = 0; c < 500 && differing < 0; c++) if (soakDie(c, sheet, 0).roll !== soakDie(c, sheet, 1).roll) differing = c;
  assert.ok(differing >= 0);
  const second = scene();
  const swung = blow(second.state, second.foe, second.member, differing, { swing: 1 }).events[0];
  assert.equal(swung.roll, soakDie(differing, second.sheet, 1).roll);
});

test("edge (adjacency): a soak die exactly at the threshold soaks the blow", () => {
  const { state, foe, member, sheet } = scene();
  const cur = cursorWhere(sheet, (k) => k.roll === k.atLeast);
  const { events } = blow(state, foe, member, cur);
  assert.equal(events[0].type, "armorSoaked");
  assert.equal(events[0].roll, events[0].atLeast);
});

test("edge (adjacency): a soak die one under the threshold lets the blow through", () => {
  const { state, foe, member, sheet } = scene();
  const cur = cursorWhere(sheet, (k) => k.roll === k.atLeast - 1);
  const { events } = blow(state, foe, member, cur);
  assert.equal(events[0].type, "memberStruck");
});

test("edge (adjacency): a blow exactly at the armour's min soaks with no wear (underMin)", () => {
  const { state, foe, member, sheet } = scene();
  const { events } = blow(state, foe, member, SOAKS(sheet), { dmg: STUDDED.min });
  assert.equal(events[0].type, "armorSoaked");
  assert.equal(events[0].wear, 0);
  assert.equal(events[0].underMin, true);
  assert.equal(sheet.armorWP, STUDDED.wp);
});

test("a Dwarven Joiner's soaked blow wears ceil(dmg x armorWear), and the line says halved", () => {
  const { state, foe, member, sheet } = scene({ sheet: joinerSheet({ race: "Dwarven" }) });
  const { events } = blow(state, foe, member, SOAKS(sheet), { dmg: 7 });
  assert.equal(events[0].wear, 4);
  assert.equal(events[0].halved, true);
  assert.equal(sheet.armorWP, STUDDED.wp - 4);
});

test("armour worn to 0 is destroyed, armorDestroyed follows armorSoaked, and a later blow draws no soak die", () => {
  const { state, foe, member, sheet } = scene({ sheet: joinerSheet({ armorWP: 5 }) });
  const { events } = blow(state, foe, member, SOAKS(sheet), { dmg: 7 });
  assert.deepEqual(types(events), ["armorSoaked", "armorDestroyed"]);
  assert.equal(events[0].wear, 5, "wear never exceeds what remained");
  assert.equal(events[1].member, "Brom");
  assert.equal(sheet.armorWP, 0);
  const later = blow(state, foe, member, 0, { dmg: 7 });
  assert.deepEqual(types(later.events), ["memberStruck"]);
  assert.equal(later.events[0].soak, undefined, "0 durability draws no soak die");
});

test("edge (empty): a Joiner with no armour (AR 0, 0 durability, a Fridgian) draws no soak die at all", () => {
  for (const over of [{ ar: 0 }, { armorWP: 0 }, { race: "Fridgian", ar: 0, armorWP: 0 }]) {
    const { state, foe, member } = scene({ sheet: joinerSheet(over) });
    const { events } = blow(state, foe, member, 0);
    assert.deepEqual(types(events), ["memberStruck"], JSON.stringify(over));
    assert.equal(events[0].soak, undefined);
    // Phase 91 plan 09 (IDENT-20, Q7 A): the Fridgian Joiner's hide soaks 2 of the 7; Phase 91.1 plan 03 (V17 B,
    // 2026-10-01): it soaks 3 of the 7 (a 4 lands: 30 - 4 = 26).
    assert.equal(member.wp, over.race === "Fridgian" ? 26 : 23, JSON.stringify(over));
  }
});

test("edge (empty): a blow that ignores armour (a drain, a no-armour foe) draws no soak die", () => {
  for (const scn of [{ over: { ignoresArmor: true }, foeOver: {} }, { over: {}, foeOver: { sp: { noArmor: true } } }]) {
    const { state, foe, member, sheet } = scene({ foeOver: scn.foeOver });
    const { events } = blow(state, foe, member, SOAKS(sheet), scn.over);
    assert.deepEqual(types(events), ["memberStruck"]);
    assert.equal(events[0].soak, undefined);
    assert.equal(sheet.armorWP, STUDDED.wp);
  }
});

test("a missing sheet reads as a blank body: the blow lands, nothing throws", () => {
  const { state, foe, member } = scene();
  state.party = [];
  const { events } = blow(state, foe, member, 0);
  assert.deepEqual(types(events), ["memberStruck"]);
  assert.equal(member.wp, 23);
});

test("Cloak of Armor: a Joiner's own live Cloak soaks as plate (AR 15) and never wears", () => {
  const sheet = joinerSheet({ armor: "Nothing", ar: 0, armorWP: 0, armorMin: 0, armorMax: 0 });
  startEffect(sheet, "item:Cloak of Armor", { rounds: 50 });
  const av = armorSoak(sheet);
  assert.equal(av.magic, true);
  assert.ok(av.ar >= 15);
  const { state, foe, member } = scene({ sheet });
  const { events } = blow(state, foe, member, SOAKS(sheet), { dmg: 9 });
  assert.equal(events[0].type, "armorSoaked");
  assert.equal(events[0].magic, true);
  assert.equal(events[0].wear, 0);
  assert.equal(sheet.armorWP, 0);
  assert.equal(types(events).includes("armorDestroyed"), false);
});

test("Fighter multiplier: the Joiner's soak threshold is armorSoak(sheet), the same as the hero's for the same class and armour", () => {
  const { sheet, hero } = scene();
  const twin = { ...hero, ar: STUDDED.ar, armorMin: STUDDED.min, armorWP: STUDDED.wp };
  assert.equal(armorSoak(sheet).ar, armorSoak(twin).ar);
  const { state, foe, member } = scene();
  const cur = SOAKS(sheet);
  assert.equal(blow(state, foe, member, cur).events[0].atLeast, atLeastFor(armorSoak(sheet).ar, 20));
});

test("Taunt: a Joiner with its own live Taunt soaks at min(20, 2 x AR)", () => {
  const sheet = joinerSheet();
  startEffect(sheet, "ability:taunt", { rounds: 2 });
  const { state, foe, member } = scene({ sheet });
  const want = atLeastFor(Math.min(20, armorSoak(sheet).ar * 2), 20);
  const cur = cursorWhere(sheet, () => true);
  const events = blow(state, foe, member, cur).events;
  const die = rollCheck(derivedRng(cur, "memberSoak", ROUND, FOE_IDX, SWING, PARTY_IDX), 20, want);
  assert.equal(events[0].atLeast, want);
  assert.equal(events[0].roll, die.roll);
});

test("Pendant: an armed halfNext halves the landed blow (ceil) before the soak, then clears; damageHalved names the Joiner", () => {
  const sheet = joinerSheet({ halfNext: { slot: "jewel1", n: 1 } });
  const { state, foe, member } = scene({ sheet });
  const { events } = blow(state, foe, member, SOAKS(sheet), { dmg: 7 });
  assert.deepEqual(types(events), ["damageHalved", "armorSoaked"]);
  assert.equal(events[0].member, "Brom");
  assert.equal(events[1].amount, 4, "ceil(7 / 2)");
  assert.equal(sheet.halfNext, false);
});

test("Brace: member.braced halves the blow after the Pendant and before the soak (braceHeld names the Joiner)", () => {
  const sheet = joinerSheet();
  const { state, foe, member } = scene({ sheet, braced: true });
  const { events } = blow(state, foe, member, MISSES(sheet), { dmg: 7 });
  assert.deepEqual(types(events), ["braceHeld", "memberStruck"]);
  assert.equal(events[0].member, "Brom");
  assert.equal(events[0].soaked, 3);
  assert.equal(member.wp, 30 - 4);
  assert.equal(member.braced, false);
});

test("edge (ordering): damageHalved, then braceHeld, then armorSoaked (then armorDestroyed) or memberStruck, within one blow", () => {
  const soaking = joinerSheet({ halfNext: { slot: "jewel1", n: 1 }, armorWP: 2 });
  let s = scene({ sheet: soaking, braced: true });
  let { events } = blow(s.state, s.foe, s.member, SOAKS(soaking), { dmg: 20 });
  assert.deepEqual(types(events), ["damageHalved", "braceHeld", "armorSoaked", "armorDestroyed"]);
  const missing = joinerSheet({ halfNext: { slot: "jewel1", n: 1 } });
  s = scene({ sheet: missing, braced: true });
  ({ events } = blow(s.state, s.foe, s.member, MISSES(missing), { dmg: 20 }));
  assert.deepEqual(types(events), ["damageHalved", "braceHeld", "memberStruck"]);
});

test("a Joiner taken to 0 HP is downed (memberDowned), never die()", () => {
  const sheet = joinerSheet({ armorWP: 0 });
  const { state, foe, member } = scene({ sheet });
  member.wp = 5;
  const { events, res } = blow(state, foe, member, 0, { dmg: 7 });
  assert.deepEqual(types(events), ["memberStruck", "memberDowned"]);
  assert.equal(res.downed, true);
  assert.equal(state.party[0].status, "downed");
  assert.equal(state.combat.allies.length, 0);
});

test("bolt: a foe's bolt at a Joiner goes through the same pipeline (foeBolted names the Joiner, soak die on a miss)", () => {
  const sheet = joinerSheet();
  const { state, foe, member } = scene({ sheet });
  const soaked = blow(state, foe, member, SOAKS(sheet), { dmg: 6, ability: "krupkeFreeze", ignoresArmor: false });
  assert.deepEqual(types(soaked.events), ["armorSoaked"]);
  assert.equal(sheet.armorWP, STUDDED.wp - 6);
  const { state: s2, foe: f2, member: m2, sheet: sh2 } = scene();
  const miss = blow(s2, f2, m2, MISSES(sh2), { dmg: 6, ability: "krupkeFreeze", ignoresArmor: false });
  assert.deepEqual(types(miss.events), ["foeBolted"]);
  assert.equal(miss.events[0].member, "Brom");
  assert.ok(miss.events[0].soak);
  assert.equal(m2.wp, 24);
});

test("bolt: a drain and a no-armour foe's bolt ignore the armour (no soak die), as for the hero", () => {
  const { state, foe, member, sheet } = scene();
  const drain = blow(state, foe, member, SOAKS(sheet), { dmg: 6, ability: "vampireDrain", ignoresArmor: true });
  assert.deepEqual(types(drain.events), ["foeBolted"]);
  assert.equal(drain.events[0].soak, undefined);
  assert.equal(drain.events[0].ignoresArmor, true);
  assert.equal(drain.res.applied, 6);
});

// --- foeTurn integration: draws and isolation ------------------------------

/** A Taunting Joiner (zero-draw target pick) in a live fight; `armour` false strips its armour. */
function fightState({ armour }) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  const idx = withMember(s, { cls: "Fighter", sub: "Soldier", race: "Human" });
  const sheet = s.party[idx];
  if (armour) {
    Object.assign(sheet, { armor: STUDDED.name, ar: STUDDED.ar, armorMin: STUDDED.min, armorWP: STUDDED.wp, armorMax: STUDDED.wp });
  } else {
    Object.assign(sheet, { ar: 0, armorWP: 0, armorMin: 0 });
  }
  startEffect(sheet, "ability:taunt", { rounds: 1 });
  inCombat(s, [foeFrom("Humans", 1, "Ned")], {
    allies: [{ partyIdx: idx, name: sheet.name, lvl: 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  });
  return s;
}

function countingRng(log) {
  let i = 0;
  return {
    d(n) { log.push(n); i++; return i === 1 ? 1 : 3; },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 7,
  };
}

test("draws: an armoured Joiner's fight draws exactly the main-stream dice an unarmoured one's does", () => {
  const armoured = [];
  const bare = [];
  const evA = foeTurn(fightState({ armour: true }), countingRng(armoured), []);
  const evB = foeTurn(fightState({ armour: false }), countingRng(bare), []);
  assert.deepEqual(armoured, bare);
  assert.ok(evA.some((e) => e.member && (e.type === "armorSoaked" || e.type === "memberStruck")));
  assert.ok(evB.some((e) => e.type === "memberStruck"));
});

test("isolation: the hero's armour never soaks a Joiner's blow and never changes while the Joiner is hit", () => {
  const s = fightState({ armour: false });
  Object.assign(s.c, { armor: STUDDED.name, ar: 20, armorMin: 0, armorWP: 50, armorMax: 50 });
  const before = { ar: s.c.ar, wp: s.c.armorWP };
  const events = foeTurn(s, countingRng([]), []);
  assert.ok(events.some((e) => e.type === "memberStruck"), "the bare Joiner takes the blow; the hero's plate is not its armour");
  assert.equal(events.some((e) => e.type === "armorSoaked"), false);
  assert.deepEqual({ ar: s.c.ar, wp: s.c.armorWP }, before);
});

test("a solo fight touches no derived stream: no party, no cursor read", () => {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(s, [foeFrom("Humans", 1, "Ned")]);
  let cursorReads = 0;
  const rng = { d: () => 3, pick: (a) => a[0], shuffle: (a) => a, getState: () => { cursorReads++; return 1; } };
  foeTurn(s, rng, []);
  assert.equal(cursorReads, 0);
});

// --- narration -------------------------------------------------------------

const soakPayload = (extra = {}) => ({ type: "armorSoaked", name: "Ned", amount: 7, wear: 7, ...extra });

function renderEvent(e) {
  const f = EVENT_NARRATION[e.type];
  assert.equal(typeof f, "function", `${e.type} has a narration entry`);
  return String(f(e));
}

test("the three member forms name the Joiner on the Oracle and never say 'your armour'; the hero's forms are unchanged", () => {
  const forms = [
    soakPayload({ member: "Brom", roll: 14, atLeast: 11, dieN: 20 }),
    { type: "armorDestroyed", member: "Brom" },
    { type: "damageHalved", name: "Ned", member: "Brom" },
  ];
  for (const e of forms) {
    const text = renderEvent(e);
    assert.ok(text.includes("Brom"), `${e.type}: ${text}`);
    assert.equal(/your armou?r/i.test(text), false, `${e.type}: ${text}`);
    assert.equal(/\bWP\b/.test(text), false);
  }
  // A member payload never renders as the hero's; a hero payload is byte-stable.
  for (const e of [soakPayload(), { type: "armorDestroyed" }, { type: "damageHalved", name: "Ned" }]) {
    const text = renderEvent(e);
    assert.equal(text.includes("Brom"), false);
    assert.ok(text.length > 0);
  }
});

test("the rail twins name the Joiner for each member form", () => {
  const forms = [
    soakPayload({ member: "Brom", roll: 14, atLeast: 11, dieN: 20 }),
    { type: "armorDestroyed", member: "Brom" },
    { type: "damageHalved", name: "Ned", member: "Brom" },
  ];
  for (const e of forms) {
    const entry = LINE_FOR[e.type];
    assert.ok(entry, `${e.type} has a rail twin`);
    const text = String(entry(e).text);
    assert.ok(text.includes("Brom"), `${e.type}: ${text}`);
    assert.equal(/your armou?r/i.test(text), false, `${e.type}: ${text}`);
  }
});

test("memberStruck states the failed soak die when one was drawn; a bare payload renders clean", () => {
  const withSoak = renderEvent({ type: "memberStruck", name: "Ned", member: "Brom", dmg: 7, roll: 15, atLeast: 12, dieN: 20, critical: false, soak: { roll: 4, atLeast: 11, dieN: 20 } });
  assert.match(withSoak, /Brom/);
  assert.match(withSoak, /\b4\b/);
  const bare = renderEvent({ type: "memberStruck", name: "Ned", member: "Brom", dmg: 7 });
  assert.equal(/undefined|NaN/.test(bare), false, bare);
  for (const e of [soakPayload({ member: "Brom" }), { type: "armorDestroyed", member: "Brom" }, { type: "damageHalved", member: "Brom" }]) {
    assert.equal(/undefined|NaN/.test(renderEvent(e)), false, e.type);
  }
});

// ─── Phase 91 plan 09 (IDENT-20, Q7 A): a Fridgian Joiner's hide ─────────────
//
// User 2026-09-30 (Q7 A): a Joiner's own race traits that protect its body
// apply like the hero's. A Fridgian's thick hide soaks 2 from every landed
// blow, right after Hardiness, floor 1. The Joiner is armourless (a Fridgian
// wears none), so no soak die is drawn; the main stream is never touched.

const noArmour = (over = {}) => joinerSheet({ ar: 0, armorWP: 0, armorMax: 0, armorMin: 0, armor: "Nothing", ...over });

// Phase 91.1 plan 03 (V17 B, 2026-10-01): the hide soaks 3 (was 2): a 7 takes 4, and with Hardiness 7 -> 4 -> 1.
test("IDENT-20 hide: a foe's 7-damage hit on an unarmoured Fridgian Joiner takes 4 HP (V17); a Human Joiner takes 7", () => {
  for (const [race, taken] of [["Fridgian", 4], ["Human", 7]]) {
    const { state, foe, member } = scene({ sheet: noArmour({ race }) });
    const { events, res } = blow(state, foe, member, 0);
    assert.deepEqual(types(events), ["memberStruck"], race);
    assert.equal(member.wp, 30 - taken, race);
    assert.equal(res.applied, taken, race);
  }
});

test("IDENT-20 hide: it stacks with Hardiness (7 -> 4 -> 1) and floors at 1", () => {
  const hardy = scene({ sheet: noArmour({ race: "Fridgian", skills: { Hardiness: 1 } }) });
  const a = blow(hardy.state, hardy.foe, hardy.member, 0);
  assert.equal(a.res.applied, 1, "max(1, max(1, 7-3) - 3) = 1");
  const small = scene({ sheet: noArmour({ race: "Fridgian" }) });
  const b = blow(small.state, small.foe, small.member, 0, { dmg: 2 });
  assert.equal(b.res.applied, 1, "a blow of 2 still costs 1");
});

test("IDENT-20 hide (edge, empty): a Joiner of a race with no hide soaks nothing extra, and a missing sheet reads as a blank body", () => {
  for (const race of ["Human", "Elven", "Dwarven", "Wilmsry", "Troll"]) {
    const { state, foe, member } = scene({ sheet: noArmour({ race }) });
    assert.equal(blow(state, foe, member, 0).res.applied, 7, race);
  }
  const { state, foe, member } = scene({ sheet: noArmour() });
  state.party = [];
  assert.equal(blow(state, foe, member, 0).res.applied, 7, "no sheet, no hide");
});
