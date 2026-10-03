// test/unit/ability-state.test.js
//
// Phase 94 plan 01 (ASTATE-04, engine half): abilityState(state, sheet, key) and
// singState(state), the one pure derived answer to "can this ability be used,
// how many rounds are left, and why not". useAbility's refusal ladder and sing()'s
// refusals read these functions, so a tap always agrees with the label (ROADMAP
// criterion 4). This file pins both directions: the state against what a real
// tap does, and the refusal payloads (keys, key order, values) so the refactor
// moved nothing.
//
// Engine gate (STATE.md Ground Truth): no rng draw, nothing serialized, no new
// event type. The purity pins prove it: JSON.stringify(state) is identical before
// and after every call, including state.rngState and a dead combat.target.
//
// Local helper copies (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/
// fixedCombat) mirror test/unit/abilities.test.js, this repo's per-file-fixture
// convention (never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility, abilityState, abilityRoundsLeft, ABILITY_UNAVAILABLE_REASONS } from "../../engine/abilities.js";
import { sing, songReady, singState, SING_UNAVAILABLE_REASONS, liveFoes, pickMemberAbility } from "../../engine/combat.js";
import { startCooldown, startEffect } from "../../engine/effects.js";
import { makeRng } from "../../engine/rng.js";
import { ABILITY_BY_ID, ONCE_A_FIGHT } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

setIdentityDials();

function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
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

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return {
    foes, type: (foes[0] && foes[0].type) || "Beasts", round: 1, target: 0,
    pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    ...overrides,
  };
}

const FILL = new Array(40).fill(20);
const ALL_IDS = Object.keys(ABILITY_BY_ID);
const FOE_KEYS = ALL_IDS.filter((id) => ABILITY_BY_ID[id].target === "foe" || ABILITY_BY_ID[id].target === "foes");
const SELF_KEYS = ALL_IDS.filter((id) => ABILITY_BY_ID[id].target === "self");

/** The hero state every sweep scenario starts from: owns every catalog id, one live foe. */
function base(extraC = {}) {
  return fixedState({ c: { abilities: ALL_IDS.slice(), ...extraC }, combat: fixedCombat([fixedFoe()]) });
}

/** The hand-built scenarios of the agreement sweep: each takes the key under test and returns a state. */
const SCENARIOS = [
  ["ready: one live foe, full hp", () => base()],
  ["startCooldown rounds 1", (k) => { const s = base(); startCooldown(s.c, `ability:${k}`, { rounds: 1 }); return s; }],
  ["startCooldown rounds 3", (k) => { const s = base(); startCooldown(s.c, `ability:${k}`, { rounds: 3 }); return s; }],
  ["startEffect rounds 2 cd 4", (k) => { const s = base(); startEffect(s.c, `ability:${k}`, { rounds: 2, cd: 4 }); return s; }],
  ["startCooldown ONCE_A_FIGHT", (k) => { const s = base(); startCooldown(s.c, `ability:${k}`, { rounds: ONCE_A_FIGHT }); return s; }],
  ["zero foes", () => { const s = base(); s.combat = fixedCombat([]); return s; }],
  ["every foe dead", () => { const s = base(); s.combat = fixedCombat([fixedFoe({ alive: false })]); return s; }],
  ["one live foe plus one dead", () => { const s = base(); s.combat = fixedCombat([fixedFoe({ alive: false, name: "Gone" }), fixedFoe()], { target: 1 }); return s; }],
  ["two live foes", () => { const s = base(); s.combat = fixedCombat([fixedFoe({ name: "A" }), fixedFoe({ name: "B" })]); return s; }],
  ["dead target, second foe hamstrung and marked", () => {
    const s = base();
    s.combat = fixedCombat([fixedFoe({ alive: false, name: "Gone" }), fixedFoe({ name: "Second", hamstrung: true, marked: true })], { target: 0 });
    return s;
  }],
  ["live target hamstrung and marked", () => {
    const s = base();
    s.combat = fixedCombat([fixedFoe({ name: "Both", hamstrung: true, marked: true })]);
    return s;
  }],
  ["hero hp at floor(maxWP * 0.25)", () => base({ wp: Math.floor(55 * 0.25) })],
  ["hero hp one above the quarter", () => base({ wp: Math.floor(55 * 0.25) + 1 })],
  ["pending fight", () => { const s = base(); s.combat.pending = true; return s; }],
  ["no combat", () => { const s = base(); s.combat = null; return s; }],
  ["key not owned", () => base({ abilities: [] })],
];

/**
 * agree(label, state, key) — abilityState is pure, and a real tap on a clone
 * agrees with it. Returns the state object for the caller's reason census.
 */
function agree(label, state, key) {
  const before = JSON.stringify(state);
  const st = abilityState(state, state.c, key);
  assert.equal(JSON.stringify(state), before, `${label} ${String(key)}: abilityState must write nothing`);
  assert.deepEqual(Object.keys(st), ["state", "roundsLeft", "reason"], `${label} ${String(key)}: result shape`);
  assert.ok(["ready", "recharging", "unavailable", "spent"].includes(st.state), `${label} ${String(key)}: state is one of four`);
  const clone = structuredClone(state);
  const events = [];
  if (st.state === "ready") {
    assert.equal(st.reason, null);
    assert.equal(st.roundsLeft, 0);
    try {
      useAbility(clone, key, fakeRng(FILL), events);
    } catch (_e) {
      // a hand-built foe-less fight's resolution may throw after abilityUsed is pushed: outside the ladder
    }
    assert.ok(events.length >= 1, `${label} ${String(key)}: a ready ability pushes an event`);
    assert.deepEqual(events[0], { type: "abilityUsed", key, name: ABILITY_BY_ID[key].name }, `${label} ${key}: ready means abilityUsed`);
  } else {
    useAbility(clone, key, fakeRng(FILL), events);
    assert.equal(events.length, 1, `${label} ${String(key)}: a refusal is a single event`);
    assert.equal(events[0].type, "abilityRefused");
    assert.equal(events[0].reason, st.reason, `${label} ${String(key)}: tap reason matches the label`);
    if (st.state === "recharging") {
      assert.equal(events[0].reason, "cooldown");
      assert.equal(events[0].left, st.roundsLeft, `${label} ${key}: rounds left match`);
      assert.ok(st.roundsLeft > 0);
    } else {
      assert.equal(st.roundsLeft, 0);
    }
  }
  return st;
}

test("exports: the reason lists are frozen and in ladder order", () => {
  assert.deepEqual(ABILITY_UNAVAILABLE_REASONS, ["notFought", "unknown", "notInCombat", "noTarget", "tooFewFoes", "alreadyOn", "notLowEnough"]);
  assert.ok(Object.isFrozen(ABILITY_UNAVAILABLE_REASONS));
  assert.deepEqual(SING_UNAVAILABLE_REASONS, ["notFought", "notInCombat", "wrongClass"]);
  assert.ok(Object.isFrozen(SING_UNAVAILABLE_REASONS));
});

test("rung order: pending first, then unknown, notInCombat, spent/recharging, then the fight rungs", () => {
  // pending beats ownership: the hero does not own "kata" here and still reads notFought
  const pendingUnowned = base({ abilities: [] });
  pendingUnowned.combat.pending = true;
  assert.deepEqual(abilityState(pendingUnowned, pendingUnowned.c, "kata"), { state: "unavailable", roundsLeft: 0, reason: "notFought" });

  const s = base();
  assert.equal(abilityState(s, s.c, "nope").reason, "unknown");
  assert.equal(abilityState(s, s.c, 42).reason, "unknown");
  const unowned = base({ abilities: [] });
  assert.equal(abilityState(unowned, unowned.c, "kata").reason, "unknown");
  s.combat = null;
  assert.deepEqual(abilityState(s, s.c, "kata"), { state: "unavailable", roundsLeft: 0, reason: "notInCombat" });

  const spent = base();
  startCooldown(spent.c, "ability:deathTouch", { rounds: ONCE_A_FIGHT });
  assert.deepEqual(abilityState(spent, spent.c, "deathTouch"), { state: "spent", roundsLeft: 0, reason: "spent" });

  const rest = base();
  startEffect(rest.c, "ability:smoke", { rounds: 2, cd: 3 });
  assert.deepEqual(abilityState(rest, rest.c, "smoke"), { state: "recharging", roundsLeft: abilityRoundsLeft(rest.c, "smoke"), reason: "cooldown" });
  assert.equal(abilityRoundsLeft(rest.c, "smoke"), 5);

  const sweep1 = base();
  assert.deepEqual(abilityState(sweep1, sweep1.c, "sweep"), { state: "unavailable", roundsLeft: 0, reason: "tooFewFoes" });
  assert.deepEqual(abilityState(sweep1, sweep1.c, "kata"), { state: "ready", roundsLeft: 0, reason: null });
});

test("a combat with no foes array does not throw: foe abilities read noTarget, self abilities read ready", () => {
  const s = base();
  s.combat = {};
  for (const k of FOE_KEYS) assert.equal(abilityState(s, s.c, k).reason, "noTarget", k);
  for (const k of SELF_KEYS) assert.equal(abilityState(s, s.c, k).state, "ready", k);
});

test("agreement sweep: every catalog ability x every scenario, a tap agrees with the state and nothing is written", () => {
  const reasons = new Set();
  const states = new Set();
  let n = 0;
  for (const key of ALL_IDS) {
    for (const [label, make] of SCENARIOS) {
      const st = agree(label, make(key), key);
      states.add(st.state);
      if (st.state === "unavailable") reasons.add(st.reason);
      n++;
    }
  }
  assert.equal(ALL_IDS.length, 20);
  assert.equal(n, 20 * SCENARIOS.length);
  assert.deepEqual([...states].sort(), ["ready", "recharging", "spent", "unavailable"]);
  // Coverage: every listed reason is reachable in a hand-built state, and no other appears.
  assert.deepEqual([...reasons].sort(), [...ABILITY_UNAVAILABLE_REASONS].sort());
});

test("agreement sweep: an unowned catalog key, 'nope' and a non-string key", () => {
  for (const key of ALL_IDS) {
    const st = agree("unowned", base({ abilities: [] }), key);
    assert.equal(st.reason, "unknown");
  }
  for (const key of ["nope", 42, null, undefined, {}]) {
    const s = base();
    const st = abilityState(s, s.c, key);
    assert.deepEqual(st, { state: "unavailable", roundsLeft: 0, reason: "unknown" });
    const events = [];
    useAbility(structuredClone(s), key, fakeRng(FILL), events);
    assert.equal(events.length, 1);
    assert.equal(events[0].reason, "unknown");
  }
});

test("purity: no rng draw and nothing written, rngState and a dead combat.target included", () => {
  const s = base();
  s.rngState = 987654;
  s.combat = fixedCombat([fixedFoe({ alive: false, name: "Gone" }), fixedFoe({ name: "Second" })], { target: 0 });
  const before = JSON.stringify(s);
  for (const key of ALL_IDS) abilityState(s, s.c, key);
  assert.equal(JSON.stringify(s), before);
  assert.equal(s.combat.target, 0, "the dead target is not moved");
  assert.equal(s.rngState, 987654);
  // abilityState takes no rng at all
  assert.equal(abilityState.length, 3);
  assert.equal(singState.length, 1);
});

test("payload shapes: exact keys, key order and values for every refusal", () => {
  const run = (state, key) => {
    const events = [];
    useAbility(state, key, fakeRng(FILL), events);
    assert.equal(events.length, 1);
    return events[0];
  };
  const kataName = ABILITY_BY_ID.kata.name;

  const pending = base();
  pending.combat.pending = true;
  let e = run(pending, "kata");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "kata", reason: "notFought" });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason"]);

  const unowned = base({ abilities: [] });
  e = run(unowned, "kata");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "kata", reason: "unknown", name: kataName });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name"]);

  e = run(base(), "nope");
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name"]);
  assert.equal(e.name, undefined);
  assert.equal(e.reason, "unknown");

  const noCombat = base();
  noCombat.combat = null;
  e = run(noCombat, "kata");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "kata", reason: "notInCombat", name: kataName });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name"]);

  const spent = base();
  startCooldown(spent.c, "ability:deathTouch", { rounds: ONCE_A_FIGHT });
  e = run(spent, "deathTouch");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "deathTouch", reason: "spent", name: ABILITY_BY_ID.deathTouch.name });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name"]);

  const cd = base();
  startCooldown(cd.c, "ability:kata", { rounds: 3 });
  e = run(cd, "kata");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "kata", reason: "cooldown", name: kataName, left: 3 });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name", "left"]);

  const none = base();
  none.combat = fixedCombat([]);
  e = run(none, "kata");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "kata", reason: "noTarget", name: kataName });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name"]);

  e = run(base(), "sweep");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "sweep", reason: "tooFewFoes", name: ABILITY_BY_ID.sweep.name, need: 2, have: 1 });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name", "need", "have"]);

  const on = base();
  on.combat = fixedCombat([fixedFoe({ name: "Bruno", hamstrung: true })]);
  e = run(on, "hamstring");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "hamstring", reason: "alreadyOn", name: ABILITY_BY_ID.hamstring.name, target: "Bruno" });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name", "target"]);

  const high = base({ wp: 30, maxWP: 55 });
  e = run(high, "lastStand");
  assert.deepStrictEqual(e, { type: "abilityRefused", key: "lastStand", reason: "notLowEnough", name: ABILITY_BY_ID.lastStand.name, have: 30, max: 55 });
  assert.deepEqual(Object.keys(e), ["type", "key", "reason", "name", "have", "max"]);
});

test("retarget order: a cooldown refusal leaves a dead target alone; a tooFewFoes refusal moves it; abilityState never does", () => {
  const cd = base();
  cd.combat = fixedCombat([fixedFoe({ alive: false, name: "Gone" }), fixedFoe({ name: "Live" })], { target: 0 });
  startCooldown(cd.c, "ability:kata", { rounds: 2 });
  abilityState(cd, cd.c, "kata");
  assert.equal(cd.combat.target, 0, "abilityState never retargets");
  useAbility(cd, "kata", fakeRng(FILL), []);
  assert.equal(cd.combat.target, 0, "a cooldown refusal comes before normalizeTarget");

  const few = base();
  few.combat = fixedCombat([fixedFoe({ alive: false, name: "Gone" }), fixedFoe({ name: "Live" })], { target: 0 });
  abilityState(few, few.c, "sweep");
  assert.equal(few.combat.target, 0, "abilityState never retargets");
  const events = [];
  useAbility(few, "sweep", fakeRng(FILL), events);
  assert.equal(events[0].reason, "tooFewFoes");
  assert.equal(few.combat.target, 1, "a tooFewFoes refusal retargets onto the first live foe");
});

/** A Joiner sheet (a persistent party member): its own timers and abilities. */
function joiner(cls, abilities, overrides = {}) {
  return {
    name: "Ada", level: 1, sub: cls === "Thief" ? "Cutpurse" : "Knight", cls, race: "Human",
    wp: 40, maxWP: 40, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities,
    ...overrides,
  };
}

/** A hero state with a Joiner in party[0] and (optionally) its combat ally entry. */
function withJoiner(sheet, foes, allyOverrides = {}, withAlly = true) {
  const s = base();
  s.party = [sheet];
  s.combat = fixedCombat(foes);
  if (withAlly) s.combat.allies = [{ partyIdx: 0, name: sheet.name, lvl: 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP, ...allyOverrides }];
  return s;
}

const FIGHTER_IDS = ALL_IDS.filter((id) => ABILITY_BY_ID[id].cls === "Fighter");
const THIEF_IDS = ALL_IDS.filter((id) => ABILITY_BY_ID[id].cls === "Thief");

test("hero vs Joiner aim: the hero aims at combat.target, a Joiner at the first live foe", () => {
  const foes = [fixedFoe({ name: "A", hamstrung: true }), fixedFoe({ name: "B" })];
  const s = withJoiner(joiner("Thief", THIEF_IDS.slice()), foes);
  s.combat.target = 1;
  const hero = abilityState(s, s.c, "hamstring");
  assert.deepEqual(hero, { state: "ready", roundsLeft: 0, reason: null }, "the hero's hamstring aims at B");
  const j = abilityState(s, s.party[0], "hamstring");
  assert.deepEqual(j, { state: "unavailable", roundsLeft: 0, reason: "alreadyOn" }, "the Joiner's aims at the first live foe");
  // the hero's real tap agrees
  const events = [];
  try { useAbility(structuredClone(s), "hamstring", fakeRng(FILL), events); } catch (_e) { /* resolution is outside the ladder */ }
  assert.equal(events[0].type, "abilityUsed");
});

test("Joiner: own timers, Sweep gate, Last Stand reads the ally entry", () => {
  const sheet = joiner("Fighter", FIGHTER_IDS.slice());
  const s = withJoiner(sheet, [fixedFoe()]);
  assert.deepEqual(abilityState(s, sheet, "kata"), { state: "ready", roundsLeft: 0, reason: null });

  startCooldown(sheet, "ability:kata", { rounds: 2 });
  assert.deepEqual(abilityState(s, sheet, "kata"), { state: "recharging", roundsLeft: 2, reason: "cooldown" });
  assert.equal(abilityState(s, s.c, "kata").state, "ready", "the hero's own timers are untouched");

  startCooldown(sheet, "ability:deathTouch", { rounds: ONCE_A_FIGHT });
  assert.deepEqual(abilityState(s, sheet, "deathTouch"), { state: "spent", roundsLeft: 0, reason: "spent" });

  assert.deepEqual(abilityState(s, sheet, "sweep"), { state: "unavailable", roundsLeft: 0, reason: "tooFewFoes" });
  assert.equal(abilityState(s, sheet, "nope").reason, "unknown");

  // Last Stand reads the combat ally entry, not the sheet: sheet 40/40, ally 10/40 is ready, 11/40 is not
  const low = withJoiner(joiner("Fighter", FIGHTER_IDS.slice()), [fixedFoe()], { wp: 10, maxWP: 40 });
  assert.equal(abilityState(low, low.party[0], "lastStand").state, "ready");
  const high = withJoiner(joiner("Fighter", FIGHTER_IDS.slice()), [fixedFoe()], { wp: 11, maxWP: 40 });
  assert.equal(abilityState(high, high.party[0], "lastStand").reason, "notLowEnough");
  // with no ally entry it reads the sheet
  const bare10 = withJoiner(joiner("Fighter", FIGHTER_IDS.slice(), { wp: 10, maxWP: 40 }), [fixedFoe()], {}, false);
  assert.equal(abilityState(bare10, bare10.party[0], "lastStand").state, "ready");
  const bare11 = withJoiner(joiner("Fighter", FIGHTER_IDS.slice(), { wp: 11, maxWP: 40 }), [fixedFoe()], {}, false);
  assert.equal(abilityState(bare11, bare11.party[0], "lastStand").reason, "notLowEnough");
  // and the Joiner reads are pure
  const snap = JSON.stringify(high);
  for (const k of FIGHTER_IDS) abilityState(high, high.party[0], k);
  assert.equal(JSON.stringify(high), snap);
});

test("pickMemberAbility soundness: whatever a Joiner picks is abilityState-ready", () => {
  let picked = 0;
  const pickedIds = new Set();
  const sheets = [
    ["Fighter", FIGHTER_IDS],
    ["Thief", THIEF_IDS],
    ["Fighter", ["lastStand"]], // alone, so the damage policy can reach it
  ];
  for (const [cls, ids] of sheets) {
    for (const round of [1, 2]) {
      for (const targetWp of [30, 10]) {
        for (const allyWp of [40, 10, 19]) {
          for (const foeCount of [1, 2]) {
            for (const firstFoeFlags of [false, true]) {
              for (const cdMode of ["none", "odd", "even"]) {
                const sheet = joiner(cls, ids.slice());
                ids.forEach((id, i) => {
                  if (cdMode === "odd" && i % 2 === 1) startCooldown(sheet, `ability:${id}`, { rounds: 2 });
                  if (cdMode === "even" && i % 2 === 0) startCooldown(sheet, `ability:${id}`, { rounds: 2 });
                });
                const foes = [fixedFoe({ name: "F1", wp: targetWp, maxWP: 30, ...(firstFoeFlags ? { hamstrung: true, marked: true } : {}) })];
                if (foeCount === 2) foes.push(fixedFoe({ name: "F2" }));
                const s = withJoiner(sheet, foes, { wp: allyWp, maxWP: 40 });
                s.combat.round = round;
                const live = liveFoes(s);
                const meta = pickMemberAbility(sheet, s.combat.allies[0], s.combat.round, live[0], live.length);
                if (!meta) continue;
                picked++;
                pickedIds.add(meta.id);
                const st = abilityState(s, sheet, meta.id);
                assert.equal(st.state, "ready", `${cls} r${round} tw${targetWp} aw${allyWp} f${foeCount} flags${firstFoeFlags} cd:${cdMode} picked ${meta.id}: ${JSON.stringify(st)}`);
              }
            }
          }
        }
      }
    }
  }
  assert.ok(picked > 50, `the sweep exercises real picks (got ${picked})`);
  assert.ok(pickedIds.has("lastStand"), "the sweep picks Last Stand at a quarter hp");
});

/** A level-3 Bard in a joined fight with a sleeper (its turn draws nothing from the main rng). */
function bardFight(extra = {}, sub = "Bard") {
  const state = heroState({ cls: "Fighter", sub, race: "Human", level: 3 });
  state.c.wp = state.c.maxWP = 200;
  inCombat(state, [{ ...foeFrom("Humans", 1, "Ned", { wp: 80 }), asleep: 9 }], extra);
  return state;
}

/** singAgrees(label, state) — singState is pure, songReady matches it, and sing() on a clone agrees. */
function singAgrees(label, state) {
  const before = JSON.stringify(state);
  const st = singState(state);
  assert.equal(JSON.stringify(state), before, `${label}: singState writes nothing`);
  assert.deepEqual(Object.keys(st), ["state", "roundsLeft", "reason"]);
  assert.equal(songReady(state), st.state === "ready", `${label}: songReady matches`);
  const clone = structuredClone(state);
  const events = [];
  sing(clone, makeRng(7), events);
  return { st, events };
}

test("singState: pending, no combat and a non-Bard are unavailable and sing() agrees", () => {
  let r = singAgrees("pending", bardFight({ pending: true }));
  assert.deepEqual(r.st, { state: "unavailable", roundsLeft: 0, reason: "notFought" });
  assert.deepEqual(r.events, [{ type: "actionRefused", action: "sing", reason: "notFought" }]);

  const noFight = heroState({ cls: "Fighter", sub: "Bard", race: "Human" });
  r = singAgrees("no combat", noFight);
  assert.deepEqual(r.st, { state: "unavailable", roundsLeft: 0, reason: "notInCombat" });
  assert.deepEqual(r.events, []);

  r = singAgrees("non-Bard", bardFight({}, "Soldier"));
  assert.deepEqual(r.st, { state: "unavailable", roundsLeft: 0, reason: "wrongClass" });
  assert.deepEqual(r.events, [{ type: "actionRefused", action: "sing", reason: "wrongClass" }]);
});

test("singState: ready before the first song and sing() sings", () => {
  const r = singAgrees("fresh Bard", bardFight());
  assert.deepEqual(r.st, { state: "ready", roundsLeft: 0, reason: null });
  assert.equal(r.events[0].type, "sang");
});

test("singState: recharging between the two songs with roundsLeft 4..1, ready at round 7", () => {
  const expected = { 3: 4, 4: 3, 5: 2, 6: 1 };
  for (const [round, left] of Object.entries(expected)) {
    const state = bardFight({ sang: true, sangAt: 2, round: Number(round) });
    const r = singAgrees(`round ${round}`, state);
    assert.deepEqual(r.st, { state: "recharging", roundsLeft: left, reason: "songResting" });
    assert.deepEqual(r.events, [{ type: "actionRefused", action: "sing", reason: "songResting", rounds: r.st.roundsLeft }]);
  }
  const r7 = singAgrees("round 7", bardFight({ sang: true, sangAt: 2, round: 7 }));
  assert.deepEqual(r7.st, { state: "ready", roundsLeft: 0, reason: null });
  assert.equal(r7.events[0].type, "sang");
});

test("singState: spent after the second song, or a bare sang with no sangAt", () => {
  for (const extra of [{ sang: true, sangAt: null, round: 9 }, { sang: true, round: 9 }]) {
    const r = singAgrees("spent", bardFight(extra));
    assert.deepEqual(r.st, { state: "spent", roundsLeft: 0, reason: "sungThisFight" });
    assert.deepEqual(r.events, [{ type: "actionRefused", action: "sing", reason: "sungThisFight" }]);
  }
});
