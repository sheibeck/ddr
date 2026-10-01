// test/unit/value-abilities.test.js
//
// Phase 91.1 plan 02 (part A: the cooldown family, VALUE-02 / VALUE-03 /
// VALUE-04). One pin per built ledger row, each titled with its question id
// (docs/VALUE-LEDGER.md cites these titles). The user's rulings, 2026-10-01:
//   V1 B: Kata and Feint are ready again 4 rounds after the use.
//   V2 B: Overhead Blow and Last Stand are ready again after 4 rounds
//         (Last Stand still only at a quarter hit points); Death Touch and
//         Silent Step stay once per fight.
//   V3 B: Second Wind is ready again 5 rounds after the use (heal unchanged).
//   V4 B: Smoke is ready again 6 rounds after the use.
//   V5 B: Hamstring and Mark are ready again 3 rounds after the use, only on
//         a foe that does not already carry the effect; Cutpurse stays once
//         per fight.
//
// "N rounds after the use" is counted the way every numeric cooldown in this
// engine is: the use round's own foe turn ticks the fresh timer once, so an
// ability used in round R is usable again in round R + N. Smoke is a duration
// ability (three ticks of effect: the use round and two more), so its six
// rounds are those three plus a three-round cooldown (content `cd: 3`).
//
// Local fixtures mirror test/unit/abilities.test.js (the repo's per-file
// fixture convention, never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility, abilityReadyAfter, abilityTargetShortfall, abilityRoundsLeft } from "../../engine/abilities.js";
import { playerStrike, alliesTurn, endCombat, pickMemberAbility } from "../../engine/combat.js";
import { isReady, tickRounds } from "../../engine/effects.js";
import { ABILITY_BY_ID, ABILITIES, ONCE_A_FIGHT } from "../../content/index.js";
import { FIGHTER_SKILLS, THIEF_SKILLS } from "../../content/skills.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

/** constRng(v) — every draw returns v (a hero strike on v = 1 simply misses,
 * a foe swing misses too); never exhausts. */
function constRng(v = 1) {
  return { d: () => v, pick: (a) => a[0], shuffle: (a) => a };
}

function fighter(overrides = {}) {
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

function state(cOverrides = {}, foes = [foe()], combatOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fighter(cOverrides),
    floor: floor(),
    day: 1, steps: 0, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    combat: {
      foes, type: foes[0].type, round: 1, target: 0,
      pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
      ...combatOverrides,
    },
  };
}

const used = (events) => events.some((e) => e.type === "abilityUsed");
const refusal = (events) => events.find((e) => e.type === "abilityRefused") || null;

/** passRound(s) — one plain strike: the round's action, the foes' turn, the tick. */
function passRound(s) {
  playerStrike(s, constRng(1), []);
}

/**
 * roundsUntilReady(s, key) — use `key` once (it must succeed), then pass plain
 * rounds until a use succeeds again; returns how many rounds after the first
 * use the second use landed (round 1 use, round 5 use: 4). Each refusal in
 * between must be a `cooldown` that names a falling count.
 */
function roundsUntilReady(s, key) {
  const startRound = s.combat.round;
  assert.ok(used(useAbility(s, key, constRng(1), [])), `${key}: first use succeeds`);
  let lastLeft = Infinity;
  for (let guard = 0; guard < 30; guard++) {
    const ev = useAbility(s, key, constRng(1), []);
    if (used(ev)) return s.combat.round - 1 - startRound; // the use ticked a round itself
    const r = refusal(ev);
    assert.equal(r.reason, "cooldown", `${key}: a wait is a cooldown refusal, never spent`);
    assert.ok(r.left < lastLeft, `${key}: the rounds left count down (${r.left} after ${lastLeft})`);
    lastLeft = r.left;
    passRound(s);
  }
  assert.fail(`${key}: never ready again`);
}

// ---------------------------------------------------------------------------
// V1 Kata and Feint
// ---------------------------------------------------------------------------

test("V1 Kata: ready again 4 rounds after the use (a cooldown of 4, no longer once per fight)", () => {
  assert.equal(ABILITY_BY_ID.kata.cd, 4);
  const s = state({ abilities: ["kata"] });
  assert.equal(roundsUntilReady(s, "kata"), 4);
});

test("V1 Feint: ready again 4 rounds after the use (a cooldown of 4, no longer once per fight)", () => {
  assert.equal(ABILITY_BY_ID.feint.cd, 4);
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["feint"] });
  assert.equal(roundsUntilReady(s, "feint"), 4);
});

test("V1 Kata and Feint: the boundary is exact: refused with 1 round left, then the 4th round later the use lands; a fresh fight restores it", () => {
  const s = state({ abilities: ["kata"] });
  useAbility(s, "kata", constRng(1), []);
  // use round R: ticked once by its own foe turn -> 3 left, then 2, 1
  for (const left of [3, 2, 1]) {
    const r = refusal(useAbility(s, "kata", constRng(1), []));
    assert.deepEqual({ reason: r.reason, left: r.left }, { reason: "cooldown", left });
    passRound(s);
  }
  assert.equal(isReady(s.c, "ability:kata"), true, "ready on the 4th round after the use");
  endCombat(s, []);
  assert.equal(isReady(s.c, "ability:kata"), true);
});

test("V1 Kata and Feint: each keeps its own data (same shape, own id, own timer)", () => {
  const k = ABILITY_BY_ID.kata;
  const f = ABILITY_BY_ID.feint;
  assert.equal(k.cd, f.cd);
  assert.notEqual(k.id, f.id);
  assert.equal(k.cls, "Fighter");
  assert.equal(f.cls, "Thief");
  assert.equal(k.skillKey, "Kata");
  assert.equal(f.skillKey, "Feint");
  assert.equal(FIGHTER_SKILLS.Kata.txt, k.txt);
  assert.equal(THIEF_SKILLS.Feint.txt, f.txt);
  const s = state({ abilities: ["kata"] });
  useAbility(s, "kata", constRng(1), []);
  assert.deepEqual(Object.keys(s.c.timers), ["ability:kata"]);
});

test("V1 Kata: a Joiner Fighter uses it with the same cooldown, on its own sheet", () => {
  const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["kata"] };
  const s = state({}, [foe({ type: "Humans" })], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }], round: 2 });
  s.party = [sheet];
  const events = alliesTurn(s, constRng(10), []);
  assert.ok(events.some((e) => e.type === "memberAbilityUsed" && e.key === "kata"), "the Joiner threw Kata");
  assert.deepEqual({ phase: sheet.timers["ability:kata"].phase, left: sheet.timers["ability:kata"].left }, { phase: "cooldown", left: 4 });
  assert.equal(pickMemberAbility(sheet, { wp: 20, maxWP: 20, lvl: 1 }, 3, foe(), 1), null, "spent while the timer runs");
  for (let i = 0; i < 4; i++) tickRounds(sheet);
  assert.equal(pickMemberAbility(sheet, { wp: 20, maxWP: 20, lvl: 1 }, 6, foe(), 1).id, "kata", "ready again 4 rounds later");
});

test("V1 Feint: a Joiner Thief uses it with the same cooldown, on its own sheet", () => {
  const sheet = { name: "Bo", level: 1, sub: "Burglar", cls: "Thief", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Dagger", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["feint"] };
  const s = state({}, [foe({ type: "Humans" })], { allies: [{ partyIdx: 0, name: "Bo", lvl: 1, sub: "Thief", wp: 20, maxWP: 20 }], round: 2 });
  s.party = [sheet];
  alliesTurn(s, constRng(10), []);
  assert.equal(sheet.timers["ability:feint"].left, 4);
  for (let i = 0; i < 4; i++) tickRounds(sheet);
  assert.equal(isReady(sheet, "ability:feint"), true);
});

// ---------------------------------------------------------------------------
// V2 Overhead Blow and Last Stand (Death Touch and Silent Step stay once)
// ---------------------------------------------------------------------------

test("V2 Overhead Blow: ready again 4 rounds after the use", () => {
  assert.equal(ABILITY_BY_ID.overheadBlow.cd, 4);
  const s = state({ abilities: ["overheadBlow"] });
  assert.equal(roundsUntilReady(s, "overheadBlow"), 4);
});

test("V2 Last Stand: ready again 4 rounds after the use, and still only at a quarter hit points", () => {
  assert.equal(ABILITY_BY_ID.lastStand.cd, 4);
  const s = state({ abilities: ["lastStand"], wp: 100, maxWP: 999 });
  assert.equal(roundsUntilReady(s, "lastStand"), 4);
  const healthy = state({ abilities: ["lastStand"], wp: 999, maxWP: 999 });
  assert.equal(refusal(useAbility(healthy, "lastStand", constRng(1), [])).reason, "notLowEnough");
  assert.equal(isReady(healthy.c, "ability:lastStand"), true, "a refused use starts no timer");
});

test("V2 Death Touch and Silent Step: stay once per fight (spent, no second use all fight)", () => {
  for (const [key, cls] of [["deathTouch", "Fighter"], ["silentStep", "Thief"]]) {
    assert.equal(ABILITY_BY_ID[key].cd, "fight", key);
    const s = state({ cls, sub: cls === "Thief" ? "Burglar" : "Soldier", abilities: [key] });
    assert.ok(used(useAbility(s, key, constRng(1), [])));
    for (let i = 0; i < 12; i++) {
      const r = refusal(useAbility(s, key, constRng(1), []));
      assert.equal(r.reason, "spent", `${key} round ${i + 2}`);
      passRound(s);
    }
    assert.equal(s.c.timers[`ability:${key}`].left > 900, true);
    endCombat(s, []);
    assert.equal(isReady(s.c, `ability:${key}`), true, "a fresh fight restores it");
  }
});

// ---------------------------------------------------------------------------
// V3 Second Wind
// ---------------------------------------------------------------------------

test("V3 Second Wind: ready again 5 rounds after the use; the heal is still d8 + level", () => {
  assert.equal(ABILITY_BY_ID.secondWind.cd, 5);
  const s = state({ abilities: ["secondWind"], level: 3, wp: 10, maxWP: 999 });
  const rng = { d: (n) => (n === 8 ? 5 : 1), pick: (a) => a[0], shuffle: (a) => a };
  const ev = useAbility(s, "secondWind", rng, []);
  const healed = ev.find((e) => e.type === "secondWindHealed");
  assert.equal(healed.rolled, 5 + 3, "d8 + level, unchanged");
  assert.equal(roundsUntilReady(state({ abilities: ["secondWind"], wp: 500, maxWP: 999 }), "secondWind"), 5);
});

// ---------------------------------------------------------------------------
// V4 Smoke
// ---------------------------------------------------------------------------

test("V4 Smoke: the effect still lasts two rounds after the use; ready again 6 rounds after the use", () => {
  assert.equal(abilityReadyAfter("smoke"), 6);
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["smoke"] });
  assert.equal(roundsUntilReady(s, "smoke"), 6);
});

test("V4 Smoke: the effect is first, the cooldown after (effect 3 ticks, then cooldown 3), one record", () => {
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["smoke"] });
  useAbility(s, "smoke", constRng(1), []);
  assert.deepEqual(s.c.timers["ability:smoke"], { cadence: "rounds", left: 2, phase: "effect", cd: 3 });
  assert.equal(abilityRoundsLeft(s.c, "smoke"), 5);
  passRound(s);
  passRound(s);
  assert.deepEqual(s.c.timers["ability:smoke"], { cadence: "rounds", left: 3, phase: "cooldown", cd: 3 });
});

// ---------------------------------------------------------------------------
// V5 Hamstring, Mark, Cutpurse
// ---------------------------------------------------------------------------

test("V5 Hamstring: ready again 3 rounds after the use, on a foe that does not carry it", () => {
  assert.equal(ABILITY_BY_ID.hamstring.cd, 3);
  const foes = [foe({ name: "A" }), foe({ name: "B" })];
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["hamstring"] }, foes);
  assert.ok(used(useAbility(s, "hamstring", constRng(1), [])));
  assert.equal(foes[0].hamstrung, true);
  // wait the cooldown out: refused as cooldown first
  assert.equal(refusal(useAbility(s, "hamstring", constRng(1), [])).reason, "cooldown");
  passRound(s);
  passRound(s);
  assert.equal(isReady(s.c, "ability:hamstring"), true, "3 rounds after the use");
  // ready, but the target still carries it: refused, no turn, no draw, no timer
  const before = s.combat.round;
  const ev = useAbility(s, "hamstring", { d() { throw new Error("no draw on a refusal"); } }, []);
  assert.deepEqual(ev, [{ type: "abilityRefused", key: "hamstring", reason: "alreadyOn", name: "Hamstring", target: "A" }]);
  assert.equal(s.combat.round, before);
  assert.equal(isReady(s.c, "ability:hamstring"), true);
  // a second foe can be worked
  s.combat.target = 1;
  assert.ok(used(useAbility(s, "hamstring", constRng(1), [])));
  assert.equal(foes[1].hamstrung, true);
});

test("V5 Mark: ready again 3 rounds after the use, on a foe that does not carry it", () => {
  assert.equal(ABILITY_BY_ID.mark.cd, 3);
  const foes = [foe({ name: "A" }), foe({ name: "B" })];
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["mark"] }, foes);
  assert.ok(used(useAbility(s, "mark", constRng(1), [])));
  assert.equal(foes[0].marked, true);
  passRound(s);
  passRound(s);
  const ev = useAbility(s, "mark", constRng(1), []);
  assert.deepEqual(ev, [{ type: "abilityRefused", key: "mark", reason: "alreadyOn", name: "Mark", target: "A" }]);
  s.combat.target = 1;
  assert.ok(used(useAbility(s, "mark", constRng(1), [])));
  assert.equal(foes[1].marked, true);
});

test("V5 Hamstring and Mark: a lone foe that carries it is never targeted twice (the guard reads the foe, not the timer)", () => {
  const f = foe();
  assert.equal(abilityTargetShortfall("hamstring", f), null);
  assert.equal(abilityTargetShortfall("mark", f), null);
  f.hamstrung = true;
  assert.equal(abilityTargetShortfall("hamstring", f), "alreadyOn");
  assert.equal(abilityTargetShortfall("mark", f), null, "Mark is not Hamstring");
  f.marked = true;
  assert.equal(abilityTargetShortfall("mark", f), "alreadyOn");
  assert.equal(abilityTargetShortfall("kata", f), null, "no other ability reads it");
  assert.equal(abilityTargetShortfall("hamstring", null), null);
});

test("V5 Hamstring and Mark: the combat row names the target that already carries it", () => {
  const foes = [foe({ name: "A" }), foe({ name: "B" })];
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["hamstring", "mark"] }, foes);
  const row = (key) => combatMenuViewModel(s).submenus.abilities.rows.find((r) => r.id === `ability-${key}`);
  assert.equal(row("hamstring").cost, "READY");
  foes[0].hamstrung = true;
  assert.equal(row("hamstring").cost, "ALREADY ON IT");
  assert.equal(row("hamstring").enabled, false);
  assert.equal(row("mark").cost, "READY");
  s.combat.target = 1;
  assert.equal(row("hamstring").cost, "READY");
});

test("V5 Hamstring and Mark: a Joiner Thief uses them with the same cooldown, and never on a foe that carries it", () => {
  const sheet = { name: "Bo", level: 1, sub: "Burglar", cls: "Thief", race: "Human", wp: 20, maxWP: 20, status: "ok", abilities: ["hamstring", "mark"] };
  const ally = { wp: 20, maxWP: 20, lvl: 1 };
  const a = foe({ name: "A" });
  const b = foe({ name: "B" });
  assert.equal(pickMemberAbility(sheet, ally, 1, a, 2).id, "hamstring");
  a.hamstrung = true;
  assert.equal(pickMemberAbility(sheet, ally, 1, a, 2).id, "mark", "Hamstring is on it: the next opener");
  a.marked = true;
  assert.equal(pickMemberAbility(sheet, ally, 1, a, 2), null, "both on it: nothing to open with");
  assert.equal(pickMemberAbility(sheet, ally, 1, b, 2).id, "hamstring", "a clean foe is fair game");
  // the cooldown on the Joiner's own sheet
  const s = state({}, [foe({ type: "Humans" })], { allies: [{ partyIdx: 0, name: "Bo", lvl: 1, sub: "Thief", wp: 20, maxWP: 20 }], round: 1 });
  s.party = [{ ...sheet, abilities: ["hamstring"], weapon: "Dagger", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0 }];
  alliesTurn(s, constRng(10), []);
  assert.equal(s.party[0].timers["ability:hamstring"].left, 3);
});

test("V5 Cutpurse: stays once per fight (spent, no second use all fight)", () => {
  assert.equal(ABILITY_BY_ID.cutpurse.cd, "fight");
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["cutpurse"] });
  assert.ok(used(useAbility(s, "cutpurse", constRng(3), [])));
  for (let i = 0; i < 8; i++) {
    assert.equal(refusal(useAbility(s, "cutpurse", constRng(3), [])).reason, "spent");
    passRound(s);
  }
});

// ---------------------------------------------------------------------------
// Texts, rows, edges
// ---------------------------------------------------------------------------

const BUILT = [
  ["kata", 4], ["feint", 4], ["overheadBlow", 4], ["lastStand", 4], ["secondWind", 5], ["smoke", 6], ["hamstring", 3], ["mark", 3],
];

test("V1 V2 V3 V4 V5: the text states the ruled wait in plain words, and only the abilities still once per fight say 'once per fight'", () => {
  for (const [key, n] of BUILT) {
    const txt = ABILITY_BY_ID[key].txt;
    assert.ok(txt.includes(`ready again ${n} rounds after you use it`), `${key}: ${txt}`);
    assert.equal(abilityReadyAfter(key), n, `${key}: the engine's wait`);
    assert.equal(/once per fight/.test(txt), false, `${key} no longer says once per fight`);
  }
  for (const a of ABILITIES) assert.equal(/once per fight/.test(a.txt), a.cd === "fight", a.id);
  assert.deepEqual(
    ABILITIES.filter((a) => a.cd === "fight").map((a) => a.id),
    ["deathTouch", "silentStep", "cutpurse"],
    "the three that stay once per fight, nothing else",
  );
  assert.ok(ABILITY_BY_ID.hamstring.txt.includes("on a foe that is not already hamstrung"));
  assert.ok(ABILITY_BY_ID.mark.txt.includes("on a foe that is not already marked"));
});

test("V1 V3 V4: each table-skill twin carries the same text as its catalog ability", () => {
  assert.equal(FIGHTER_SKILLS.Kata.txt, ABILITY_BY_ID.kata.txt);
  assert.equal(FIGHTER_SKILLS["Second Wind"].txt, ABILITY_BY_ID.secondWind.txt);
  assert.equal(THIEF_SKILLS.Feint.txt, ABILITY_BY_ID.feint.txt);
  assert.equal(THIEF_SKILLS.Smoke.txt, ABILITY_BY_ID.smoke.txt);
});

test("V1 V3 V4: the combat row and the Hero row say the ruled state: READY, then N ROUNDS while it runs, never ONCE PER FIGHT", () => {
  const s = state({ abilities: ["kata", "secondWind", "deathTouch"], wp: 10, maxWP: 999 });
  const rows = () => Object.fromEntries(combatMenuViewModel(s).submenus.abilities.rows.map((r) => [r.id, r.cost]));
  assert.equal(rows()["ability-kata"], "READY");
  assert.equal(rows()["ability-secondWind"], "READY");
  assert.equal(rows()["ability-deathTouch"], "READY · ONCE PER FIGHT");
  useAbility(s, "kata", constRng(1), []);
  useAbility(s, "deathTouch", constRng(1), []);
  assert.equal(rows()["ability-kata"], "2 ROUNDS", "used in round 1, one more round has passed");
  assert.equal(rows()["ability-deathTouch"], "ONCE PER FIGHT · SPENT");
  const hero = characterSheetViewModel(s);
  const byId = Object.fromEntries(hero.abilities.map((a) => [a.id, a.state]));
  assert.equal(byId.kata, "2 rounds");
  assert.equal(byId.deathTouch, "once per fight · spent");
  const out = characterSheetViewModel({ ...s, combat: null });
  const idle = Object.fromEntries(out.abilities.map((a) => [a.id, a.state]));
  assert.equal(idle.kata, "cd 4 rounds");
  assert.equal(idle.secondWind, "cd 5 rounds");
  assert.equal(idle.deathTouch, "once per fight");
});

test("edge (adjacency): the use after the last allowed use is refused with the existing cooldown path, and a fresh fight resets every wait", () => {
  const s = state({ abilities: ["kata", "secondWind", "overheadBlow"], wp: 10, maxWP: 999 });
  for (const key of ["kata", "secondWind", "overheadBlow"]) useAbility(s, key, constRng(1), []);
  for (const key of ["kata", "secondWind", "overheadBlow"]) {
    const r = refusal(useAbility(s, key, constRng(1), []));
    assert.equal(r.reason, "cooldown", key);
    assert.equal(typeof r.left, "number", key);
  }
  endCombat(s, []);
  for (const key of ["kata", "secondWind", "overheadBlow"]) assert.equal(isReady(s.c, `ability:${key}`), true, key);
});

test("edge (empty): the abilities ruled keep change nothing: Death Touch, Silent Step and Cutpurse keep cd 'fight' and map to ONCE_A_FIGHT", () => {
  for (const key of ["deathTouch", "silentStep", "cutpurse"]) assert.equal(ABILITY_BY_ID[key].cd, "fight");
  const s = state({ abilities: ["deathTouch"] });
  useAbility(s, "deathTouch", constRng(1), []);
  assert.equal(s.c.timers["ability:deathTouch"].left, ONCE_A_FIGHT - 1);
});

test("edge (ordering): Smoke's effect ticks first and its cooldown after, and the use round's foe turn ticks the fresh timer once", () => {
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["smoke"] });
  const seen = [];
  useAbility(s, "smoke", constRng(1), []);
  seen.push(s.c.timers["ability:smoke"].phase + ":" + s.c.timers["ability:smoke"].left);
  passRound(s);
  seen.push(s.c.timers["ability:smoke"].phase + ":" + s.c.timers["ability:smoke"].left);
  passRound(s);
  seen.push(s.c.timers["ability:smoke"].phase + ":" + s.c.timers["ability:smoke"].left);
  for (let i = 0; i < 3; i++) {
    passRound(s);
    seen.push(s.c.timers["ability:smoke"] ? s.c.timers["ability:smoke"].phase + ":" + s.c.timers["ability:smoke"].left : "ready");
  }
  assert.deepEqual(seen, ["effect:2", "effect:1", "cooldown:3", "cooldown:2", "cooldown:1", "ready"]);
});

test("edge (ordering): the refusal for a foe that already carries the effect comes before any strike or effect event", () => {
  const f = foe({ hamstrung: true });
  const s = state({ cls: "Thief", sub: "Burglar", abilities: ["hamstring"] }, [f]);
  const ev = useAbility(s, "hamstring", constRng(1), []);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, "abilityRefused");
});
