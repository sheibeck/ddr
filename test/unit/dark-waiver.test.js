// test/unit/dark-waiver.test.js
//
// Phase 76 (DARK-01, user rulings 2026-09-22 and 2026-09-25 "combat too"):
// ONE darkness-waiver predicate governs the map and the fight.
// engine/derived.js#darkWaiver names the light holding the dark back
// (Night Vision, a live Amulet of Light, a lit torch — most-durable-first,
// the frozen DARK_WAIVERS order) or null; darkWaived(c) is
// `darkWaiver(c) !== null`; darkLimited(state) is
// `inDark(state) && !darkWaived(state.c)`. Every hero-side dark read follows
// it: revealRadius, mapViewRadius/inViewWindow, toHit's dark cap, fight()'s
// combatInDark line, playerStrike's no-crit-in-the-dark rule, and both
// Darkness-phobia triggers (the fight-join check and phobias.js#regionActive's
// terrain arm). Sense Presence (`c.senses`) stays a separate, fight-only
// relief layered beside the predicate (the cap, the line, the crit ban).
//
// The grid helpers are local copies of test/unit/darkness-filter.test.js's
// wallGrid/open/fixedFighter/fixedState (that file's header documents the
// pattern), so this file stays independently readable.

import test from "node:test";
import assert from "node:assert/strict";

import { GW, GH } from "../../engine/maze.js";
import {
  DARK_WAIVERS,
  darkWaiver,
  darkWaived,
  darkLimited,
  inDark,
  eff,
  revealRadius,
  mapViewRadius,
  inViewWindow,
  DARK_VIEW_RADIUS,
  toHit,
} from "../../engine/derived.js";
import { fight, playerStrike } from "../../engine/combat.js";
import { regionActive } from "../../engine/phobias.js";
import { move } from "../../engine/movement.js";
import { faceOdds, heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

// ─── local helpers ─────────────────────────────────────────────────────────

/** fakeRng(seq) — pops `seq` for every `.d()`; throws on underflow, so a
 * test that supplies an exact sequence also proves no extra draw fired. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: true, feat: null, ...extra };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    timers: {}, darkFor: 0,
    ...overrides,
  };
}

/** A 5x5 open, all-`seen` room centred on (5,5). */
function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  for (let y = 3; y <= 7; y++) for (let x = 3; x <= 7; x++) open(g, x, y);
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

const TORCH_LIVE = () => ({ "item:Torch": { cadence: "squares", left: 40, phase: "effect" } });
const TORCH_COOLING = () => ({ "item:Torch": { cadence: "squares", left: 40, phase: "cooldown" } });
const AMULET_LIVE = () => ({ "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } });
const AMULET_COOLING = () => ({ "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "cooldown" } });

/** Every waiver case the matrix walks, with the key darkWaiver must name. */
const WAIVERS = [
  { name: "none", apply: () => {}, key: null },
  { name: "Night Vision", apply: (c) => { c.skills = { ...c.skills, "Night Vision": 1 }; }, key: "nightVision" },
  { name: "live Amulet", apply: (c) => { c.timers = { ...c.timers, ...AMULET_LIVE() }; }, key: "amuletLight" },
  { name: "lit torch", apply: (c) => { c.timers = { ...c.timers, ...TORCH_LIVE() }; }, key: "litTorch" },
  { name: "COOLING torch", apply: (c) => { c.timers = { ...c.timers, ...TORCH_COOLING() }; }, key: null },
  { name: "COOLING Amulet", apply: (c) => { c.timers = { ...c.timers, ...AMULET_COOLING() }; }, key: null },
];
const TILES = [
  { name: "dark tile", dark: true },
  { name: "lit tile", dark: false },
];
const DARK_FOR = [0, 30];

function matrixState(w, tile, darkFor, extraC = {}) {
  const state = fixedState({ c: { darkFor, ...extraC } });
  w.apply(state.c);
  if (tile.dark) state.floor.g[5][5].dark = true;
  return state;
}

// ─── darkWaiver: the named waiver, precedence, empty ──────────────────────

test("DARK_WAIVERS is the frozen most-durable-first precedence list", () => {
  assert.deepEqual([...DARK_WAIVERS], ["nightVision", "amuletLight", "litTorch"]);
  assert.ok(Object.isFrozen(DARK_WAIVERS));
});

test("darkWaiver names each single waiver, and null with none", () => {
  for (const w of WAIVERS) {
    const state = fixedState();
    w.apply(state.c);
    assert.equal(darkWaiver(state.c), w.key, `${w.name}`);
    assert.equal(darkWaived(state.c), w.key !== null, `${w.name}: darkWaived agrees with darkWaiver`);
  }
});

test("darkWaiver precedence: Night Vision, then the Amulet, then the torch", () => {
  const all = fixedState({ c: { skills: { "Night Vision": 1 }, timers: { ...AMULET_LIVE(), ...TORCH_LIVE() } } });
  assert.equal(darkWaiver(all.c), "nightVision");
  const amuletAndTorch = fixedState({ c: { timers: { ...TORCH_LIVE(), ...AMULET_LIVE() } } });
  assert.equal(darkWaiver(amuletAndTorch.c), "amuletLight", "the Amulet outranks the torch whatever the timer insertion order");
  const nvAndTorch = fixedState({ c: { skills: { "Night Vision": 1 }, timers: TORCH_LIVE() } });
  assert.equal(darkWaiver(nvAndTorch.c), "nightVision");
});

test("darkWaiver: Sense Presence (c.senses) alone is not a light", () => {
  const state = fixedState({ c: { senses: 1 } });
  assert.equal(darkWaiver(state.c), null);
  assert.equal(darkWaived(state.c), false);
});

test("darkWaiver: undefined, null and {} return null and never throw", () => {
  assert.equal(darkWaiver(undefined), null);
  assert.equal(darkWaiver(null), null);
  assert.equal(darkWaiver({}), null);
  assert.equal(darkWaived(undefined), false);
  assert.equal(darkWaived({}), false);
});

test("darkWaiver adjacency: an effect-phase record at left 1 waives; the cooldown phase or left 0 does not", () => {
  for (const [id, key] of [["item:Torch", "litTorch"], ["item:Amulet of Light", "amuletLight"]]) {
    const one = fixedState({ c: { timers: { [id]: { cadence: "squares", left: 1, phase: "effect" } } } });
    assert.equal(darkWaiver(one.c), key, `${id} effect left 1 waives`);
    const cooling = fixedState({ c: { timers: { [id]: { cadence: "squares", left: 1, phase: "cooldown" } } } });
    assert.equal(darkWaiver(cooling.c), null, `${id} cooldown phase does not waive`);
    const spent = fixedState({ c: { timers: { [id]: { cadence: "squares", left: 0, phase: "effect" } } } });
    assert.equal(darkWaiver(spent.c), null, `${id} effect left 0 does not waive`);
  }
});

test("darkWaiver/darkLimited are pure: no mutation of the state", () => {
  const state = fixedState({ c: { darkFor: 30, timers: TORCH_LIVE() } });
  state.floor.g[5][5].dark = true;
  const before = JSON.parse(JSON.stringify(state));
  darkWaiver(state.c);
  darkWaived(state.c);
  darkLimited(state);
  revealRadius(state);
  mapViewRadius(state);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state)), before);
});

// ─── the map matrix: revealRadius and mapViewRadius never disagree ─────────

test("map matrix: waiver x tile x darkFor — revealRadius, mapViewRadius and inViewWindow all follow darkLimited", () => {
  for (const w of WAIVERS) {
    for (const tile of TILES) {
      for (const darkFor of DARK_FOR) {
        const state = matrixState(w, tile, darkFor);
        const label = `${w.name} / ${tile.name} / darkFor ${darkFor}`;
        const expectLimited = (tile.dark || darkFor > 0) && w.key === null;
        assert.equal(inDark(state), tile.dark || darkFor > 0, `${label}: inDark`);
        assert.equal(darkLimited(state), expectLimited, `${label}: darkLimited`);
        assert.equal(revealRadius(state), (expectLimited ? 1 : 2) + eff(state.c, "sight"), `${label}: revealRadius`);
        assert.equal(mapViewRadius(state), expectLimited ? DARK_VIEW_RADIUS : Infinity, `${label}: mapViewRadius`);
        assert.equal(state.floor.g[5][7].seen, true);
        assert.equal(inViewWindow(state, 7, 5), !expectLimited, `${label}: a seen cell two squares away`);
      }
    }
  }
});

test("map concrete values: darkFor 30 on a lit tile — torch 2/Infinity, live Amulet 3/Infinity, no waiver 1/1", () => {
  const torch = fixedState({ c: { darkFor: 30, timers: TORCH_LIVE() } });
  assert.equal(revealRadius(torch), 2, "a lit torch now lights your way as you walk");
  assert.equal(mapViewRadius(torch), Infinity);
  const amulet = fixedState({ c: { darkFor: 30, timers: AMULET_LIVE() } });
  assert.equal(revealRadius(amulet), 3, "the Amulet waives the dark AND keeps its sight:1 additive");
  assert.equal(mapViewRadius(amulet), Infinity);
  const none = fixedState({ c: { darkFor: 30 } });
  assert.equal(revealRadius(none), 1);
  assert.equal(mapViewRadius(none), 1);
});

// ─── the fight matrix: toHit's dark cap ────────────────────────────────────

test("fight matrix: toHit equals the lit-tile toHit unless darkLimited with no senses, then Math.min(lit, 2)", () => {
  for (const senses of [0, 1]) {
    for (const w of WAIVERS) {
      for (const tile of TILES) {
        for (const darkFor of DARK_FOR) {
          const state = matrixState(w, tile, darkFor, { senses });
          const lit = matrixState(w, { dark: false }, 0, { senses });
          const litToHit = toHit(lit);
          const label = `senses ${senses} / ${w.name} / ${tile.name} / darkFor ${darkFor}`;
          const capped = darkLimited(state) && !senses;
          assert.equal(toHit(state), capped ? Math.min(litToHit, 2) : litToHit, label);
        }
      }
    }
  }
  // Sanity: the cap is a real change for this build (a Soldier's lit need is above 2).
  assert.ok(toHit(fixedState()) > 2);
});

// ─── the fight matrix: the no-crit-in-the-dark rule ────────────────────────

function heroCrit(state, rng) {
  const events = [];
  playerStrike(state, rng, events);
  const hit = events.find((e) => e.type === "struck");
  return !!(hit && hit.critical);
}

/** A Knight (no class crit ban) with a precise Rapier against a plain foe. */
function critBuild(w, tile, darkFor, senses) {
  const s = inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [foeFrom("Humans", 1, "Ned")]);
  s.c.weapon = "Rapier";
  s.c.magicWpn = 0;
  s.c.prof = 0;
  s.c.spellsUsed = 999;
  s.c.skills = {};
  s.c.darkFor = darkFor;
  s.c.senses = senses;
  w.apply(s.c);
  s.floor.g[s.floor.py][s.floor.px].dark = tile.dark;
  return s;
}

test("fight matrix: the no-crit-in-the-dark rule follows darkLimited (Sense Presence still lifts it)", () => {
  for (const senses of [0, 1]) {
    for (const w of WAIVERS) {
      for (const tile of TILES) {
        for (const darkFor of DARK_FOR) {
          const probe = critBuild(w, tile, darkFor, senses);
          const banned = darkLimited(probe) && !senses;
          const label = `senses ${senses} / ${w.name} / ${tile.name} / darkFor ${darkFor}`;
          const result = faceOdds((rng) => heroCrit(critBuild(w, tile, darkFor, senses), rng), { label });
          if (banned) assert.equal(result.wins, 0, `${label}: no crits in the unlit dark`);
          else assert.ok(result.wins > 0, `${label}: crits land`);
        }
      }
    }
  }
});

// ─── fight(): the combatInDark line ────────────────────────────────────────

function joinState(c, { dark = true } = {}) {
  const state = fixedState({ c });
  state.floor.g[5][5].dark = dark;
  // `pending: true` — the encounter is waiting on Fight!, so fight() joins it.
  state.combat = { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, pending: true };
  return state;
}

test("fight: combatInDark fires in the unlit dark and not with a lit torch, a live Amulet or Night Vision", () => {
  const none = fight(joinState({}), fakeRng([20, 1]), []);
  assert.ok(none.some((e) => e.type === "combatInDark"), "no light: you cannot see what you are fighting");
  for (const [name, c] of [
    ["lit torch", { timers: TORCH_LIVE() }],
    ["live Amulet", { timers: AMULET_LIVE() }],
    ["Night Vision", { skills: { "Night Vision": 1 } }],
  ]) {
    const events = fight(joinState(c), fakeRng([20, 1]), []);
    assert.ok(events.some((e) => e.type === "combatJoined"), `${name}: the fight joined`);
    assert.equal(events.some((e) => e.type === "combatInDark"), false, `${name} lifts the line`);
  }
  const senses = fight(joinState({ senses: 1 }), fakeRng([1, 20]), []);
  assert.equal(senses.some((e) => e.type === "combatInDark"), false, "Sense Presence still lifts it, as today");
  const coolingTorch = fight(joinState({ timers: TORCH_COOLING() }), fakeRng([20, 1]), []);
  assert.ok(coolingTorch.some((e) => e.type === "combatInDark"), "a cooling torch is no light");
});

// ─── fight(): the Darkness phobia's join trigger ───────────────────────────

test("fight: a Darkness-phobic hero joining in the dark is afraid with no waiver, and not with a lit torch, a live Amulet or Night Vision", () => {
  const phobic = { phobia: "Darkness", phobiaType: null };
  const none = joinState({ ...phobic });
  const evNone = fight(none, fakeRng([20, 1]), []);
  assert.ok(none.combat.afraid > 0, "no light: afraid");
  assert.ok(evNone.some((e) => e.type === "phobiaAfraid"));
  for (const [name, c] of [
    ["lit torch", { timers: TORCH_LIVE() }],
    ["live Amulet", { timers: AMULET_LIVE() }],
    ["Night Vision", { skills: { "Night Vision": 1 } }],
  ]) {
    const state = joinState({ ...phobic, ...c });
    // fakeRng([20, 1]) supplies exactly the two initiative draws: the phobia
    // does not fire, and no Hardiness draw is ever asked for.
    const events = fight(state, fakeRng([20, 1]), []);
    assert.ok(events.some((e) => e.type === "combatJoined"), `${name}: the fight joined`);
    assert.ok(!state.combat.afraid, `${name}: not afraid`);
    assert.equal(events.some((e) => e.type === "phobiaAfraid"), false, `${name}: no phobiaAfraid`);
  }
});

// ─── phobias.js: the Darkness phobia's terrain arm ─────────────────────────

test("regionActive(state, \"Darkness\") is true in the unlit dark and false with a lit torch", () => {
  const unlit = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  unlit.floor.g[5][5].dark = true;
  assert.equal(regionActive(unlit, "Darkness"), true);
  const torch = fixedState({ c: { phobia: "Darkness", phobiaType: null, timers: TORCH_LIVE() } });
  torch.floor.g[5][5].dark = true;
  assert.equal(regionActive(torch, "Darkness"), false);
  const amulet = fixedState({ c: { phobia: "Darkness", phobiaType: null, darkFor: 10, timers: AMULET_LIVE() } });
  assert.equal(regionActive(amulet, "Darkness"), false);
});

test("checkTerrainPhobias (via move): entering an unlit dark tile arms fear; entering it with a torch lit does not", () => {
  const unlit = fixedState({ c: { phobia: "Darkness", phobiaType: null } });
  unlit.floor.g[4][5].dark = true;
  const e1 = move(unlit, "N", fakeRng([]), []);
  assert.ok(e1.some((ev) => ev.type === "phobiaTriggered" && ev.trigger === "dark"));
  assert.deepEqual(unlit.c.fearArmed, { phobia: "Darkness", trigger: "dark" });

  const lit = fixedState({ c: { phobia: "Darkness", phobiaType: null, timers: TORCH_LIVE() } });
  lit.floor.g[4][5].dark = true;
  const e2 = move(lit, "N", fakeRng([]), []);
  assert.equal(e2.some((ev) => ev.type === "phobiaTriggered"), false, "a lit torch keeps the dark from frightening you");
  assert.equal(lit.c.fearArmed, undefined);
});
