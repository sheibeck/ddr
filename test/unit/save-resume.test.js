// test/unit/save-resume.test.js
//
// Phase 76 (SAV-06/SAV-07), plan 76-03: the load keeps what the player was in
// the middle of. A live fight, an open store, a pending find, a pending
// hazard decision, a pending tile (RULES-12's handoff) and a pending Joiner
// offer (user ruling 2026-09-25) are each validated and resumed WHOLESALE
// when sound, or dropped (the rest of the save loads as before) when not.
// A declared canon divergence from the 1994 prototype's load(), which never
// resumed any of them.
//
// Every case runs through BOTH load chains: validateSave(...).value and a
// standalone rehydrate(raw), plus the real boot path rehydrate(validateSave).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, addPartyMember } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate, resumeEventsFor } from "../../engine/saveState.js";
import { applyAction } from "../../engine/engine.js";
import { startCombat } from "../../engine/combat.js";
import { openStore } from "../../engine/economy.js";
import { meetJoiner } from "../../engine/encounters.js";
import { rollCharacter } from "../../engine/character.js";
import { startEffect } from "../../engine/effects.js";
import { makeRng } from "../../engine/rng.js";

const PROBE = () => ({ nested: [1, "x", true, null] });

/** Loads `state`'s save through validateSave, standalone rehydrate, and the boot path. */
function loadAll(state) {
  const json = typeof state === "string" ? state : JSON.stringify(serializeRun(state));
  const check = validateSave(json);
  assert.equal(check.ok, true, "the save still loads");
  const viaValidate = check.value;
  let viaRehydrate;
  assert.doesNotThrow(() => {
    viaRehydrate = rehydrate(JSON.parse(json));
  });
  const booted = rehydrate(validateSave(json).value);
  return { json, viaValidate, viaRehydrate, booted, all: [viaValidate, viaRehydrate, booted] };
}

/** A newRun with a freshly started (pending) fight, rng cursor advanced. */
function fightState(seed = 7, forced = null) {
  const s = newRun(seed);
  const rng = makeRng(s.rngState);
  startCombat(s, false, forced, rng);
  s.rngState = rng.getState();
  return s;
}

/** A newRun with an open store, rng cursor advanced. */
function storeState(seed = 7) {
  const s = newRun(seed);
  s.c.gold = 1000; // within every bag's purse cap (clampCarry runs on load)
  const rng = makeRng(s.rngState);
  openStore(s, rng);
  s.rngState = rng.getState();
  return s;
}

/** A save JSON for `base` after `mutate(serialized)` edits the raw save. */
function tampered(base, mutate) {
  const raw = JSON.parse(JSON.stringify(serializeRun(base)));
  mutate(raw);
  return JSON.stringify(raw);
}

/** A fight joined and carried a few rounds in (hero alive, fight still up). */
function joinedFight() {
  for (let seed = 1; seed < 400; seed++) {
    let s = fightState(seed, "Demons");
    s = applyAction(s, { type: "fight" }).state;
    for (let i = 0; i < 2 && s.combat && !s.dead; i++) s = applyAction(s, { type: "attack" }).state;
    if (s.combat && !s.dead && !s.combat.pending && s.combat.round >= 2 && !s.combat.heroOut) return s;
  }
  throw new Error("no seed produced a fight still up after two attacks");
}

function member(seed) {
  const m = rollCharacter(makeRng(seed));
  m.wp = m.maxWP = 30;
  return m;
}

// ─── the fight ─────────────────────────────────────────────────────────────

test("SAV-06: a freshly started (pending) fight survives the load deep-equal; beats is null", () => {
  const s = fightState();
  s.beats = { anim: "swing" };
  const saved = structuredClone(s.combat);
  for (const st of loadAll(s).all) {
    assert.deepStrictEqual(st.combat, saved);
    if ("beats" in st) assert.equal(st.beats, null);
  }
});

test("SAV-06: a fight rounds in keeps its combat, the hero's foeEffect and a rounds timer; a squares timer survives too", () => {
  const s = joinedFight();
  s.c.foeEffect = { kind: "weakened", rounds: 2 };
  startEffect(s.c, "test:rounds", { rounds: 3 });
  startEffect(s.c, "test:squares", { squares: 9 });
  const saved = structuredClone(s.combat);
  for (const st of loadAll(s).all) {
    assert.deepStrictEqual(st.combat, saved, "the whole combat, round and foes intact");
    assert.deepStrictEqual(st.c.foeEffect, { kind: "weakened", rounds: 2 });
    assert.ok(st.c.timers["test:rounds"], "the rounds record rides the surviving fight");
    assert.ok(st.c.timers["test:squares"]);
  }
});

test("no fight in the save: the foeEffect is nulled and the rounds timer cleared (today's clear); a squares timer survives", () => {
  const s = newRun(7);
  s.c.foeEffect = { kind: "weakened", rounds: 2 };
  startEffect(s.c, "test:rounds", { rounds: 3 });
  startEffect(s.c, "test:squares", { squares: 9 });
  for (const st of loadAll(s).all) {
    assert.equal(st.combat, null);
    assert.equal(st.c.foeEffect, null);
    assert.equal(st.c.timers["test:rounds"], undefined);
    assert.ok(st.c.timers["test:squares"]);
  }
});

test("a tampered foeEffect with a valid fight is nulled; the fight is kept", () => {
  const s = fightState();
  s.c.foeEffect = "999";
  for (const st of loadAll(s).all) {
    assert.ok(st.combat, "the fight is kept");
    assert.equal(st.c.foeEffect, null);
  }
  s.c.foeEffect = { kind: 7, rounds: 2 };
  for (const st of loadAll(s).all) assert.equal(st.c.foeEffect, null);
});

test("wholesale carry: unknown keys at combat, foe, ally, store and stock-line level all survive", () => {
  const s = fightState();
  s.combat.__probe = PROBE();
  s.combat.foes[0].__probe = PROBE();
  s.combat.ally = { name: "Summoned Thing", wp: 5, maxWP: 5, __probe: PROBE() };
  for (const st of loadAll(s).all) {
    assert.deepStrictEqual(st.combat.__probe, PROBE());
    assert.deepStrictEqual(st.combat.foes[0].__probe, PROBE());
    assert.deepStrictEqual(st.combat.ally.__probe, PROBE());
  }
  const p = newRun(7);
  addPartyMember(p, member(3));
  const rng = makeRng(p.rngState);
  startCombat(p, false, null, rng);
  p.rngState = rng.getState();
  assert.ok(p.combat.allies?.length, "the party synced into the fight");
  p.combat.allies[0].__probe = PROBE();
  const savedAllies = structuredClone(p.combat.allies);
  for (const st of loadAll(p).all) assert.deepStrictEqual(st.combat.allies, savedAllies);

  const t = storeState();
  t.store.__probe = PROBE();
  t.store.stock[0].__probe = PROBE();
  for (const st of loadAll(t).all) {
    assert.deepStrictEqual(st.store.__probe, PROBE());
    assert.deepStrictEqual(st.store.stock[0].__probe, PROBE());
  }
});

test("each broken combat invariant drops the fight, and the save still loads without throwing", () => {
  const s = fightState();
  const party2 = newRun(7);
  addPartyMember(party2, member(3));
  const rng = makeRng(party2.rngState);
  startCombat(party2, false, null, rng);
  party2.rngState = rng.getState();
  assert.equal(party2.combat.allies.length, 1);

  const cases = [
    ["combat not an object", s, (r) => (r.combat = "fight")],
    ["combat an array", s, (r) => (r.combat = [])],
    ["empty foes", s, (r) => (r.combat.foes = [])],
    ["foes not an array", s, (r) => (r.combat.foes = "x")],
    ["a foe that is null", s, (r) => (r.combat.foes[0] = null)],
    ["a foe without a name", s, (r) => delete r.combat.foes[0].name],
    ["wp a string", s, (r) => (r.combat.foes[0].wp = "10")],
    ["maxWP missing", s, (r) => delete r.combat.foes[0].maxWP],
    ["alive a string", s, (r) => (r.combat.foes[0].alive = "yes")],
    ["every foe dead, no pendingFoes", s, (r) => r.combat.foes.forEach((f) => (f.alive = false))],
    ["round 0", s, (r) => (r.combat.round = 0)],
    ["round 1.5", s, (r) => (r.combat.round = 1.5)],
    ["target -1", s, (r) => (r.combat.target = -1)],
    ["target = foes.length", s, (r) => (r.combat.target = r.combat.foes.length)],
    ["type not a bestiary key", s, (r) => (r.combat.type = "Dragons")],
    ["pending a string", s, (r) => (r.combat.pending = "no")],
    ["ally a number", s, (r) => (r.combat.ally = 7)],
    ["pendingFoes a string", s, (r) => (r.combat.pendingFoes = "x")],
    ["allies partyIdx beyond the party", party2, (r) => (r.combat.allies[0].partyIdx = 5)],
    ["allies not an array", party2, (r) => (r.combat.allies = "x")],
    ["an ally with no wp", party2, (r) => delete r.combat.allies[0].wp],
    [
      "a valid allies list but one party member dropped by the tolerant party load",
      party2,
      // partyIdx 0 still indexes the one surviving member, but the load
      // dropped a member, so the index can no longer be trusted
      (r) => r.party.unshift(null),
    ],
  ];
  for (const [name, base, mutate] of cases) {
    const json = tampered(base, mutate);
    const { all } = loadAll(json);
    for (const st of all) {
      assert.equal(st.combat, null, `${name}: the fight is dropped`);
      assert.ok(st.c && st.floor, `${name}: the rest of the save loads`);
    }
  }
});

test("every foe dead but a pendingFoes summon queued: the fight is kept", () => {
  const s = fightState();
  const summon = { ...structuredClone(s.combat.foes[0]), name: "Late Arrival" };
  s.combat.foes.forEach((f) => (f.alive = false));
  s.combat.pendingFoes = [{ by: "Drekk", foe: summon }];
  const saved = structuredClone(s.combat);
  for (const st of loadAll(s).all) assert.deepStrictEqual(st.combat, saved);
});

// ─── the store ─────────────────────────────────────────────────────────────

test("SAV-07: an open store survives deep-equal; a purchase's sold flag and gold survive; two loads agree; rng is never advanced", () => {
  const s = storeState();
  const saved = structuredClone(s.store);
  for (const st of loadAll(s).all) {
    assert.deepStrictEqual(st.store, saved);
    assert.equal(st.rngState, s.rngState, "the load copies the rng cursor, never advances it");
  }
  const idx = s.store.stock.findIndex((x) => x.cost <= s.c.gold);
  const bought = applyAction(s, { type: "buyItem", idx }).state;
  assert.equal(bought.store.stock[idx].sold, true);
  const first = loadAll(bought);
  for (const st of first.all) {
    assert.equal(st.store.stock[idx].sold, true, "the sold line stays sold");
    assert.equal(st.c.gold, bought.c.gold, "no refund, no re-charge");
    assert.deepStrictEqual(st.store, bought.store);
  }
  const second = loadAll(bought);
  assert.deepStrictEqual(second.booted.store, first.booted.store, "loading twice gives identical stores");
  const again = loadAll(first.booted);
  assert.deepStrictEqual(again.booted.store, first.booted.store, "re-save then re-load is idempotent");
  assert.equal(again.booted.rngState, bought.rngState);
});

test("each broken store invariant drops the store, and the save still loads", () => {
  const s = storeState();
  const itemLine = s.store.stock.findIndex((x) => x.effectParams && x.effectParams.item);
  assert.ok(itemLine >= 0, "the store sells at least one item line");
  const cases = [
    ["store a string", (r) => (r.store = "shop")],
    ["empty stock", (r) => (r.store.stock = [])],
    ["stock not an array", (r) => (r.store.stock = {})],
    ["a null stock line", (r) => (r.store.stock[0] = null)],
    ["a line with no name", (r) => delete r.store.stock[0].n],
    ["unknown effectId", (r) => (r.store.stock[0].effectId = "stealEverything")],
    ["cost -1", (r) => (r.store.stock[0].cost = -1)],
    ["cost a string", (r) => (r.store.stock[0].cost = "9")],
    ["sold a string", (r) => (r.store.stock[0].sold = "no")],
    ["effectParams a number", (r) => (r.store.stock[0].effectParams = 5)],
    ["effectParams.item a string", (r) => (r.store.stock[itemLine].effectParams.item = "x")],
    ["haggle 0", (r) => (r.store.haggle = 0)],
    ["haggle 1.5", (r) => (r.store.haggle = 1.5)],
    ["race a number", (r) => (r.store.race = 7)],
  ];
  for (const [name, mutate] of cases) {
    for (const st of loadAll(tampered(s, mutate)).all) {
      assert.equal(st.store, null, `${name}: the store is dropped`);
      assert.ok(st.c && st.floor, `${name}: the rest of the save loads`);
    }
  }
});

test("a save with both a valid fight and a valid store keeps the fight and drops the store", () => {
  const s = fightState();
  const t = storeState();
  s.store = structuredClone(t.store);
  for (const st of loadAll(s).all) {
    assert.ok(st.combat, "the fight wins");
    assert.equal(st.store, null, "a store never opens mid-fight");
  }
});

// ─── the pending decisions ─────────────────────────────────────────────────

test("pendingFind: a named find survives; a string or a nameless find loads null", () => {
  const s = newRun(7);
  s.pendingFind = { kind: "cloak", n: "Cloak of Testing" };
  for (const st of loadAll(s).all) assert.deepStrictEqual(st.pendingFind, { kind: "cloak", n: "Cloak of Testing" });
  s.pendingFind = "x";
  for (const st of loadAll(s).all) assert.equal(st.pendingFind, null);
  s.pendingFind = { kind: "cloak" };
  for (const st of loadAll(s).all) assert.equal(st.pendingFind, null);
});

test("pendingJoiner: a real meetJoiner offer survives deep-equal; malformed ones load null; null stays null; an absent key stays absent", () => {
  let s = null;
  for (let seed = 1; seed < 200 && !s; seed++) {
    const t = newRun(seed);
    const rng = makeRng(t.rngState);
    meetJoiner(t, rng);
    t.rngState = rng.getState();
    if (t.pendingJoiner) s = t;
  }
  assert.ok(s, "some seed produced a Joiner offer");
  const offer = structuredClone(s.pendingJoiner);
  for (const st of loadAll(s).all) assert.deepStrictEqual(st.pendingJoiner, offer);

  for (const bad of ["x", { ...offer, wp: undefined }, (() => { const o = structuredClone(offer); delete o.name; return o; })()]) {
    const json = tampered(s, (r) => (r.pendingJoiner = bad));
    for (const st of loadAll(json).all) assert.equal(st.pendingJoiner, null);
  }
  s.pendingJoiner = null;
  for (const st of loadAll(s).all) {
    assert.ok("pendingJoiner" in st);
    assert.equal(st.pendingJoiner, null);
  }
  for (const st of loadAll(newRun(7)).all) assert.equal("pendingJoiner" in st, false, "never injected");
});

/** A floor neighbour in bounds of the party, as [dir, x, y]. */
function neighbour(floor) {
  for (const [dir, dx, dy] of [["N", 0, -1], ["S", 0, 1], ["E", 1, 0], ["W", -1, 0]]) {
    const x = floor.px + dx;
    const y = floor.py + dy;
    if (floor.g[y] && floor.g[y][x]) return [dir, x, y];
  }
  throw new Error("no neighbour");
}

test("pendingHazard: one matching the neighbour cell's feat survives; a bad dir, tool or feat loads null", () => {
  const s = newRun(7);
  const [dir, x, y] = neighbour(s.floor);
  s.floor.g[y][x].feat = "climb";
  s.pendingHazard = { feat: "climb", dir, tool: "ladder", declined: false };
  for (const st of loadAll(s).all) assert.deepStrictEqual(st.pendingHazard, { feat: "climb", dir, tool: "ladder", declined: false });
  const cases = [
    { feat: "climb", dir: "Q", tool: "ladder", declined: false },
    { feat: "climb", dir, tool: "jetpack", declined: false },
    { feat: "gorge", dir, tool: "rope", declined: false },
    { feat: "climb", dir, tool: "ladder", declined: "no" },
    "x",
  ];
  for (const bad of cases) {
    s.pendingHazard = bad;
    for (const st of loadAll(s).all) assert.equal(st.pendingHazard, null, JSON.stringify(bad));
  }
});

test("pendingTile: a tile on the current floor survives; another floor's depth, a non-integer x or an off-grid cell loads null", () => {
  const s = newRun(7);
  const tile = { x: s.floor.px, y: s.floor.py, depth: s.floor.depth };
  s.pendingTile = tile;
  for (const st of loadAll(s).all) assert.deepStrictEqual(st.pendingTile, tile);
  for (const bad of [{ ...tile, depth: tile.depth + 1 }, { ...tile, x: 1.5 }, { ...tile, x: 999 }, { ...tile, y: -1 }, "x"]) {
    s.pendingTile = bad;
    for (const st of loadAll(s).all) assert.equal(st.pendingTile, null, JSON.stringify(bad));
  }
});

test("a pre-Phase-76 quiet save (no combat, store or pending keys) loads exactly as a fresh run", () => {
  for (const seed of [1, 42]) {
    const original = newRun(seed);
    const json = tampered(original, (r) => {
      for (const k of ["combat", "store", "beats", "pendingFind", "pendingHazard", "pendingTile"]) delete r[k];
    });
    const { viaRehydrate, booted } = loadAll(json);
    assert.deepStrictEqual(booted, original);
    assert.deepStrictEqual(viaRehydrate, original);
  }
});

// ─── resumeEventsFor ───────────────────────────────────────────────────────

test("resumeEventsFor: a pending fight, a joined fight, an open store and neither; pure", () => {
  const s = fightState();
  const living = s.combat.foes.filter((f) => f.alive).length;
  const before = JSON.stringify(s);
  assert.deepStrictEqual(resumeEventsFor(s), [{ type: "fightResumed", round: 1, pending: true, foes: living }]);
  assert.equal(JSON.stringify(s), before, "never mutates");

  const j = joinedFight();
  j.combat.round = 3;
  const jl = j.combat.foes.filter((f) => f.alive).length;
  assert.deepStrictEqual(resumeEventsFor(j), [{ type: "fightResumed", round: 3, pending: false, foes: jl }]);

  const t = storeState();
  const tBefore = t.rngState;
  assert.deepStrictEqual(resumeEventsFor(t), [{ type: "storeResumed" }]);
  assert.equal(t.rngState, tBefore);

  assert.deepStrictEqual(resumeEventsFor(newRun(7)), []);
});
