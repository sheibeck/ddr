// test/unit/ability-state-view.test.js
//
// Phase 94 plan 04 (ASTATE-01..04, ROADMAP criterion 4, view half). The combat
// ABILITIES submenu (every ability row and the Bard's SING row) and the Hero
// tab's in-combat ability rows read the engine's derived state
// (engine/abilities.js#abilityState, engine/combat.js#singState) and print the
// shared words (src/browser/abilityStates.js). The proof that matters: a row's
// words and a tap on that row can never disagree. Local fixtures follow
// test/unit/value-abilities.test.js (the repo's per-file fixture convention).

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility } from "../../engine/abilities.js";
import { sing } from "../../engine/combat.js";
import { startCooldown, startEffect, tickRounds } from "../../engine/effects.js";
import { ONCE_A_FIGHT } from "../../content/index.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { ABILITY_STATE_COPY } from "../../src/browser/abilityStates.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

function constRng(v = 1) {
  return { d: () => v, pick: (a) => a[0], shuffle: (a) => a };
}

function hero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver", intel: 1,
    darkFor: 0,
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

function foe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 9999, maxWP: 9999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fight(cOverrides = {}, foes = [foe()], combatOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: hero(cOverrides),
    floor: floor(),
    day: 1, steps: 0, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    combat: {
      foes, type: foes[0] ? foes[0].type : "Beasts", round: 1, target: 0,
      pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
      ...combatOverrides,
    },
  };
}

const rowsOf = (s) => combatMenuViewModel(s).submenus.abilities.rows;
const rowFor = (s, key) => rowsOf(s).find((r) => r.id === `ability-${key}`);

/** The Task-1 Fighter: one live foe, full hp, three abilities in distinct states. */
function fighterScenario() {
  const s = fight({ abilities: ["kata", "pommelStrike", "deathTouch", "sweep", "lastStand", "sidestep"] });
  startCooldown(s.c, "ability:pommelStrike", { rounds: 1 });
  startCooldown(s.c, "ability:deathTouch", { rounds: ONCE_A_FIGHT });
  startEffect(s.c, "ability:sidestep", { rounds: 2, cd: 4 });
  return s;
}

/** The Thief: foes [A dead, B alive and hamstrung], aim still on the dead A. */
function thiefScenario() {
  const a = foe({ name: "A", alive: false, wp: 0 });
  const b = foe({ name: "B", hamstrung: true });
  return fight({ cls: "Thief", sub: "Burglar", abilities: ["hamstring", "mark"] }, [a, b], { target: 0 });
}

/** The words a refusal event stands for, through the shared copy. */
function refusalWords(ev) {
  if (ev.reason === "cooldown") return ABILITY_STATE_COPY.recharging.replace("{n}", String(ev.left));
  if (ev.reason === "spent") return ABILITY_STATE_COPY.spent;
  return ABILITY_STATE_COPY.reason[ev.reason];
}

// ---------------------------------------------------------------------------
// The combat ABILITIES rows (ASTATE-01..03)
// ---------------------------------------------------------------------------

test("ASTATE-01..03 Fighter: ready, recharging, spent, and two reasons, each in the shared words with its state", () => {
  const s = fighterScenario();
  const want = {
    kata: ["READY", "ready"],
    pommelStrike: ["READY IN 1", "recharging"],
    deathTouch: ["SPENT THIS FIGHT", "spent"],
    sweep: ["NEEDS TWO OR MORE FOES", "unavailable"],
    lastStand: ["NEEDS A QUARTER HP OR LESS", "unavailable"],
    sidestep: ["READY IN 6", "recharging"],
  };
  for (const [key, [cost, state]] of Object.entries(want)) {
    const row = rowFor(s, key);
    assert.equal(row.cost, cost, key);
    assert.equal(row.state, state, key);
    assert.equal(row.enabled, state === "ready", `${key}: enabled is the semantic truth`);
    assert.deepEqual(row.dispatch, { type: "useAbility", key }, `${key} stays dispatchable`);
  }
  assert.equal(combatMenuViewModel(s).actions.find((a) => a.key === "abilities").sub, "1/6 READY");
});

test("ASTATE-02 a recharging row counts down READY IN N to READY as the rounds tick", () => {
  const s = fight({ abilities: ["pommelStrike"] });
  startCooldown(s.c, "ability:pommelStrike", { rounds: 3 });
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(rowFor(s, "pommelStrike").cost);
    tickRounds(s.c);
  }
  assert.deepEqual(seen, ["READY IN 3", "READY IN 2", "READY IN 1", "READY"]);
});

test("ASTATE-03 Last Stand reads READY at a quarter hp or less", () => {
  const s = fight({ abilities: ["lastStand"], wp: Math.floor(999 / 4), maxWP: 999 });
  const row = rowFor(s, "lastStand");
  assert.equal(row.cost, "READY");
  assert.equal(row.state, "ready");
  assert.equal(row.enabled, true);
});

test("ASTATE-03 Hamstring and Mark see past a dead aimed target: the next live foe already carries it", () => {
  const s = thiefScenario();
  assert.equal(rowFor(s, "hamstring").cost, "ALREADY ON IT");
  assert.equal(rowFor(s, "hamstring").state, "unavailable");
  assert.equal(rowFor(s, "hamstring").enabled, false);
  assert.equal(rowFor(s, "mark").cost, "READY");
  assert.equal(rowFor(s, "mark").state, "ready");
});

test("ASTATE-03 a foe-less fight: a foe ability reads NO FOE IN REACH, a self ability reads READY", () => {
  const s = fight({ abilities: ["kata", "brace"] }, []);
  assert.equal(rowFor(s, "kata").cost, "NO FOE IN REACH");
  assert.equal(rowFor(s, "kata").state, "unavailable");
  assert.equal(rowFor(s, "brace").cost, "READY");
  assert.equal(rowFor(s, "brace").state, "ready");
});

test("every ability row keeps a dispatch, and enabled is exactly state ready", () => {
  for (const s of [fighterScenario(), thiefScenario(), fight({ abilities: ["kata", "brace"] }, [])]) {
    for (const r of rowsOf(s)) {
      assert.ok(r.dispatch && r.dispatch.type === "useAbility", r.id);
      assert.equal(r.enabled, r.state === "ready", r.id);
    }
  }
});

// ---------------------------------------------------------------------------
// ROADMAP criterion 4: a tap agrees with the row (the sweep)
// ---------------------------------------------------------------------------

test("criterion 4: a tap on any ability row agrees with its words (ready acts, anything else refuses with exactly those words)", () => {
  const scenarios = [
    fighterScenario(),
    thiefScenario(),
    fight({ abilities: ["kata", "brace"] }, []),
    fight({ abilities: ["lastStand"], wp: Math.floor(999 / 4), maxWP: 999 }),
    fight({ abilities: ["sweep", "kata"] }, [foe({ name: "A" }), foe({ name: "B" })]),
  ];
  let ready = 0;
  let refused = 0;
  for (const s of scenarios) {
    for (const row of rowsOf(s)) {
      const clone = structuredClone(s);
      const events = useAbility(clone, row.dispatch.key, constRng(1), []);
      if (row.state === "ready") {
        ready++;
        assert.ok(events.some((e) => e.type === "abilityUsed"), `${row.id} ready: the tap acts`);
        assert.ok(!events.some((e) => e.type === "abilityRefused"), `${row.id} ready: no refusal`);
      } else {
        refused++;
        const refusals = events.filter((e) => e.type === "abilityRefused");
        assert.equal(refusals.length, 1, `${row.id}: exactly one refusal`);
        assert.equal(refusalWords(refusals[0]), row.cost, `${row.id}: the refusal is the reason the row names`);
      }
    }
  }
  assert.ok(ready >= 4 && refused >= 6, `the sweep covers both sides (ready ${ready}, refused ${refused})`);
});

// ---------------------------------------------------------------------------
// The Bard's SING row
// ---------------------------------------------------------------------------

function bardFight(foes = [foe({ asleep: 99, wp: 5000, maxWP: 5000 })]) {
  const s = fight({ sub: "Bard", abilities: ["kata"] }, foes);
  s.c.level = 3;
  return s;
}

test("ASTATE-01 Bard SING: never sung READY, after the first song READY IN N, after the second SPENT THIS FIGHT; the grid sub-line is as today", () => {
  const s = bardFight();
  let sr = rowsOf(s)[0];
  assert.equal(sr.id, "sing");
  assert.deepEqual([sr.cost, sr.state, sr.enabled], ["READY", "ready", true]);
  assert.deepEqual(sr.dispatch, { type: "sing" });
  assert.equal(combatMenuViewModel(s).actions[1].sub, "SING · READY");

  sing(s, constRng(1), []);
  sr = rowsOf(s)[0];
  assert.equal(sr.cost, `READY IN ${s.combat.sangAt + 5 - s.combat.round}`);
  assert.deepEqual([sr.state, sr.enabled], ["recharging", false]);
  assert.deepEqual(sr.dispatch, { type: "sing" });
  assert.equal(combatMenuViewModel(s).actions[1].sub, "SING · SUNG");

  s.combat.round = s.combat.sangAt + 5;
  sr = rowsOf(s)[0];
  assert.deepEqual([sr.cost, sr.state, sr.enabled], ["READY", "ready", true]);

  sing(s, constRng(1), []);
  sr = rowsOf(s)[0];
  assert.deepEqual([sr.cost, sr.state, sr.enabled], ["SPENT THIS FIGHT", "spent", false]);
  assert.deepEqual(sr.dispatch, { type: "sing" });
});

test("criterion 4: a tap on the SING row agrees with its words (resting and spent)", () => {
  const s = bardFight();
  sing(s, constRng(1), []);
  const resting = rowsOf(s)[0];
  const e1 = sing(structuredClone(s), constRng(1), []).filter((e) => e.type === "actionRefused");
  assert.equal(e1.length, 1);
  assert.equal(e1[0].reason, "songResting");
  assert.equal(ABILITY_STATE_COPY.recharging.replace("{n}", String(e1[0].rounds)), resting.cost);

  s.combat.round = s.combat.sangAt + 5;
  sing(s, constRng(1), []);
  const spent = rowsOf(s)[0];
  const e2 = sing(structuredClone(s), constRng(1), []).filter((e) => e.type === "actionRefused");
  assert.equal(e2.length, 1);
  assert.equal(e2[0].reason, "sungThisFight");
  assert.equal(spent.cost, ABILITY_STATE_COPY.spent);
});

test("the Bard's own ability rows follow SING and carry state", () => {
  const rows = rowsOf(bardFight());
  assert.equal(rows[0].id, "sing");
  assert.equal(rows[1].id, "ability-kata");
  assert.equal(rows[1].state, "ready");
});

// ---------------------------------------------------------------------------
// The retired copy keys
// ---------------------------------------------------------------------------

test("no second wording survives: the retired COMBAT_MENU_COPY state keys are gone", () => {
  for (const k of ["abilityReady", "abilityReadyOnce", "abilityUsedUp", "abilityTooFewFoes", "abilityAlreadyOn", "abilityRound", "abilityRounds", "singReady", "singSung", "singAgain"]) {
    assert.ok(!(k in COMBAT_MENU_COPY), `COMBAT_MENU_COPY.${k} is retired`);
  }
  for (const k of ["abilitiesSub", "sing", "singDesc", "noAbilities", "noAbilitiesDesc"]) {
    assert.ok(k in COMBAT_MENU_COPY, `COMBAT_MENU_COPY.${k} stays`);
  }
});
