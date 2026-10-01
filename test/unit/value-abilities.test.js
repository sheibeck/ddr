// test/unit/value-abilities.test.js
//
// Phase 91.1 plan 02 (part A: the cooldown family, VALUE-02 / VALUE-03 /
// VALUE-04; part B, plan 02b: the effect changes V8 to V14, from the section
// "PART B" below). One pin per built ledger row, each titled with its question id
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

import {
  useAbility, abilityReadyAfter, abilityTargetShortfall, abilityRoundsLeft, abilityEffectTicks,
  BRACE_BLOWS, DURATION_ROUNDS, POISON_ROUNDS, markBonus,
} from "../../engine/abilities.js";
import {
  playerStrike, alliesTurn, endCombat, pickMemberAbility, foeTurn,
  applyFoeDamageToPlayer, applyFoeDamageToMember, STEALTH_CRIT_FACES,
} from "../../engine/combat.js";
import { readScroll, scrollKeepRng, RUNES_KEEP_FACES, RUNES_KEEP_DIE } from "../../engine/magic.js";
import { newDay, SEWING_PATCHES } from "../../engine/movement.js";
import { rollCheck, atLeastFor } from "../../engine/dice.js";
import { derivedRng } from "../../engine/rng.js";
import { abilityEffectActive } from "../../engine/derived.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
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
  assert.equal(foes[0].marked, 1, "Phase 91.1 plan 02 (V10): the flag carries the marker's level (a level 1 hero)");
  passRound(s);
  passRound(s);
  const ev = useAbility(s, "mark", constRng(1), []);
  assert.deepEqual(ev, [{ type: "abilityRefused", key: "mark", reason: "alreadyOn", name: "Mark", target: "A" }]);
  s.combat.target = 1;
  assert.ok(used(useAbility(s, "mark", constRng(1), [])));
  assert.equal(foes[1].marked, 1);
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

// ===========================================================================
// PART B (plan 02b): V8 to V14, the effect changes. The user's rulings, 2026-10-01:
//   V8 B:  Brace halves the next TWO blows that land; Taunt lasts two rounds
//          (Pommel Strike and Riposte unchanged).
//   V9 B:  Poisoned Edge ticks d4 + your level a round for three rounds (no roll).
//   V10 B: Mark adds + your level per strike instead of +2 (a Joiner's strikes too).
//   V11 B: Cutpurse is a normal strike that also lifts d10 x level gold when it
//          lands; still once per fight.
//   V12 B: Stealth crits on the top three numbers of the strike die (18-20 on a
//          d20): first landed blow only, never in plate or the dark.
//   V13 B: Sewing's first tier patches 6 times in all instead of 4.
//   V14 B: a scroll read through Runes/Signs is spent only 5 times in 6.
//
// Raw draws here are faces the engine mirrors roll-high: a raw 1 on a d20 is the
// best roll (20), a raw 20 the worst (1). constRng(20) therefore makes every
// swing miss, constRng(1) makes every swing land.
// ===========================================================================

/** seqRng(fn) - the i-th draw is fn(i); the rest of the engine's draws come from the same function. */
function seqRng(fn) {
  let i = 0;
  return { d: () => fn(i++), pick: (a) => a[0], shuffle: (a) => a };
}

/** countingRng(rng) - wraps a double and counts the main draws it serves. */
function countingRng(rng) {
  const wrapped = { n: 0, d: (s) => { wrapped.n++; return rng.d(s); }, pick: rng.pick, shuffle: rng.shuffle };
  if (rng.getState) wrapped.getState = rng.getState;
  return wrapped;
}

const strikeEvent = (events) => events.find((e) => e.type === "struck" || e.type === "allyStruck");

// ---------------------------------------------------------------------------
// V8 Brace and Taunt (Pommel Strike and Riposte unchanged)
// ---------------------------------------------------------------------------

test("V8 Brace: halves the next two blows that land, and the third lands whole", () => {
  assert.equal(BRACE_BLOWS, 2);
  const s = state({ abilities: ["brace"] });
  const used1 = useAbility(s, "brace", constRng(20), []); // every swing misses: nothing consumed
  assert.ok(used(used1));
  assert.equal(s.combat.braced, 2, "two blows held");
  assert.deepEqual(used1.find((e) => e.type === "braced"), { type: "braced", blows: 2 });
  const blow = () => {
    const ev = [];
    const before = s.c.wp;
    applyFoeDamageToPlayer(s, s.combat.foes[0], constRng(20), ev, { dmg: 10, roll: 10, atLeast: 8, dieN: 20, mods: [] });
    return { loss: before - s.c.wp, held: ev.find((e) => e.type === "braceHeld") };
  };
  const first = blow();
  const second = blow();
  const third = blow();
  assert.equal(first.loss, 5, "the first blow is halved");
  assert.equal(first.held.left, 1, "one blow still held");
  assert.equal(second.loss, 5, "the second blow is halved");
  assert.equal(second.held.left, 0);
  assert.equal(third.loss, 10, "the third lands whole");
  assert.equal(third.held, undefined);
  assert.equal(s.combat.braced, false, "spent");
});

test("V8 Brace: a blow that misses holds nothing back, and a Brace saved as true by an older build still halves one blow", () => {
  const s = state({ abilities: ["brace"] });
  useAbility(s, "brace", constRng(20), []);
  for (let i = 0; i < 4; i++) foeTurn(s, constRng(20), []); // four rounds of foes missing
  assert.equal(s.combat.braced, 2, "misses never spend a Brace");
  const old = state();
  old.combat.braced = true; // the flag a pre-91.1 save carries
  const ev = [];
  applyFoeDamageToPlayer(old, old.combat.foes[0], constRng(20), ev, { dmg: 10, roll: 10, atLeast: 8, dieN: 20, mods: [] });
  assert.equal(999 - old.c.wp, 5);
  assert.equal(old.combat.braced, false);
  const again = [];
  const before = old.c.wp;
  applyFoeDamageToPlayer(old, old.combat.foes[0], constRng(20), again, { dmg: 10, roll: 10, atLeast: 8, dieN: 20, mods: [] });
  assert.equal(before - old.c.wp, 10, "one blow only, as before");
});

test("V8 Brace: a Joiner's Brace halves its next two blows on its own body", () => {
  const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0, abilities: ["brace"] };
  const ally = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 5, maxWP: 20 };
  const s = state({}, [foe({ type: "Humans" })], { allies: [ally], round: 2 });
  s.party = [sheet];
  const events = alliesTurn(s, constRng(1), []);
  assert.deepEqual(events.find((e) => e.type === "braced"), { type: "braced", blows: 2, member: "Ada" });
  assert.equal(ally.braced, 2);
  const blow = () => {
    const ev = [];
    const before = ally.wp;
    ally.wp = 999;
    applyFoeDamageToMember(s, s.combat.foes[0], ally, constRng(20), ev, { dmg: 10, roll: 10, atLeast: 8, dieN: 20, mods: [], swing: 0 });
    const loss = 999 - ally.wp;
    ally.wp = before;
    return { loss, held: ev.find((e) => e.type === "braceHeld") };
  };
  const a = blow();
  const b = blow();
  const c3 = blow();
  assert.deepEqual([a.loss, b.loss, c3.loss].map((n) => n > 0), [true, true, true]);
  assert.equal(a.held.left, 1);
  assert.equal(b.held.left, 0);
  assert.equal(c3.held, undefined, "the third blow is whole");
  assert.ok(c3.loss > b.loss, "the third lands harder than the second");
});

test("V8 Taunt: lasts two rounds (this round and the next), then cools down; the chip reads 1 right after the use", () => {
  assert.equal(DURATION_ROUNDS.taunt, 2);
  assert.equal(abilityEffectTicks("taunt"), 2);
  const s = state({ abilities: ["taunt"] });
  const ev = useAbility(s, "taunt", constRng(20), []);
  assert.deepEqual(ev.find((e) => e.type === "taunted"), { type: "taunted", rounds: 2 });
  const live = () => abilityEffectActive(s.c, "taunt");
  assert.equal(live(), true, "still live after the use round's own foe turn");
  assert.deepEqual(s.c.timers["ability:taunt"], { cadence: "rounds", left: 1, phase: "effect", cd: 4 });
  foeTurn(s, constRng(20), []);
  assert.equal(live(), false, "the second round was the last");
  assert.deepEqual(s.c.timers["ability:taunt"], { cadence: "rounds", left: 4, phase: "cooldown", cd: 4 });
});

test("V8 Taunt: the armour soaks double on both rounds, and not on the third", () => {
  // the soak die: ar 3 needs a roll of 18 or better (a raw 3), ar 6 a roll of 15 (a raw 6); a raw 5 is a roll of 16,
  // so only the doubled soak holds it
  const hurt = (s) => {
    const before = s.c.wp;
    applyFoeDamageToPlayer(s, s.combat.foes[0], seqRng(() => 5), [], { dmg: 12, roll: 10, atLeast: 8, dieN: 20, mods: [] });
    return before - s.c.wp;
  };
  const armoured = { armor: "Leather", ar: 3, armorWP: 99, armorMin: 0, armorMax: 99 };
  const s = state({ abilities: ["taunt"], ...armoured });
  const plain = hurt(state({ ...armoured }));
  useAbility(s, "taunt", constRng(20), []);
  const round1 = hurt(s);
  foeTurn(s, constRng(20), []);
  assert.equal(abilityEffectActive(s.c, "taunt"), false);
  const round3 = hurt(s);
  assert.ok(round1 < plain, `double soak on a taunted round: ${round1} < ${plain}`);
  assert.equal(round3, plain, "the soak is the plain one once it has run out");
});

test("V8 Taunt: a Joiner's Taunt runs on its own sheet for the same two rounds", () => {
  const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 5, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["taunt"] };
  const s = state({}, [foe({ type: "Humans" })], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 5, maxWP: 20 }], round: 2 });
  s.party = [sheet];
  const events = alliesTurn(s, constRng(20), []);
  assert.deepEqual(events.find((e) => e.type === "taunted"), { type: "taunted", rounds: 2, member: "Ada" });
  assert.deepEqual({ phase: sheet.timers["ability:taunt"].phase, left: sheet.timers["ability:taunt"].left }, { phase: "effect", left: 2 });
});

test("V8 Pommel Strike and Riposte: unchanged (Pommel still stuns one turn on a hit, Riposte still one round)", () => {
  assert.equal(DURATION_ROUNDS.riposte, 1);
  assert.equal(abilityEffectTicks("riposte"), 2);
  assert.equal(ABILITY_BY_ID.riposte.txt, "for one round every foe that misses you eats your weapon damage");
  assert.equal(ABILITY_BY_ID.pommelStrike.txt, "the blunt end, to the temple: a normal strike, and a hit also costs the target its next turn");
  assert.equal(ABILITY_BY_ID.riposte.cd, 4);
  assert.equal(ABILITY_BY_ID.pommelStrike.cd, 4);
});

// ---------------------------------------------------------------------------
// V9 Poisoned Edge
// ---------------------------------------------------------------------------

/** poisonTicks(level, raw) - use Poisoned Edge at this level against a big foe and run it out; every d4 reads `raw`. */
function poisonTicks(level, raw) {
  const f = foe({ wp: 99999, maxWP: 99999 });
  const s = state({ cls: "Thief", sub: "Burglar", level, abilities: ["poisonedEdge"] }, [f]);
  const events = [];
  const d4Only = () => ({ d: (sides) => (sides === 4 ? raw : 20), pick: (a) => a[0], shuffle: (a) => a }); // the d4 reads `raw`, every swing misses
  useAbility(s, "poisonedEdge", d4Only(), events);
  for (let i = 0; i < 6; i++) foeTurn(s, d4Only(), events);
  return { ticks: events.filter((e) => e.type === "dotTick"), foe: f, events };
}

test("V9 Poisoned Edge: ticks d4 + your level a round for three rounds (16.5 in all at level 3, 22.5 at level 5)", () => {
  assert.equal(POISON_ROUNDS, 3);
  for (const [level, raw] of [[3, 2], [5, 4], [1, 1]]) {
    const r = poisonTicks(level, raw);
    assert.equal(r.ticks.length, 3, `level ${level}: three ticks, no more`);
    for (const t of r.ticks) assert.equal(t.dmg, raw + level, `level ${level}: d4 (${raw}) + level`);
    assert.equal(r.foe.dot, undefined, "the poison has run out");
  }
  // the means the ruling quotes: 3 x (2.5 + level)
  for (const [level, mean] of [[3, 16.5], [5, 22.5]]) {
    let sum = 0;
    for (let raw = 1; raw <= 4; raw++) sum += poisonTicks(level, raw).ticks.reduce((a, t) => a + t.dmg, 0);
    assert.equal(sum / 4, mean, `level ${level}`);
  }
});

test("V9 Poisoned Edge: still no roll to hit (one d4 a tick, armour does not help the foe) and the level is stamped into the record", () => {
  const f = foe({ wp: 99999, maxWP: 99999, ar: 9 });
  const s = state({ cls: "Thief", sub: "Burglar", level: 4, abilities: ["poisonedEdge"] }, [f]);
  const ev = useAbility(s, "poisonedEdge", { d: (sides) => (sides === 4 ? 3 : 20), pick: (a) => a[0], shuffle: (a) => a }, []);
  assert.deepEqual(f.dot, { left: 2, dmg: { n: 1, sides: 4, bonus: 4 }, by: "poisonedEdge" }, "stamped at the user's level, one tick already spent");
  assert.deepEqual(ev.find((e) => e.type === "poisonedEdgeApplied"), { type: "poisonedEdgeApplied", target: "Target", rounds: 3, bonus: 4 });
  assert.equal(ev.find((e) => e.type === "dotTick").dmg, 3 + 4);
  assert.equal(abilityReadyAfter("poisonedEdge"), 5, "the wait is unchanged");
});

test("V9 Poisoned Edge: a Joiner's edge poisons at the Joiner's own level", () => {
  const sheet = { name: "Bo", level: 4, sub: "Burglar", cls: "Thief", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Dagger", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["poisonedEdge"] };
  const f = foe({ type: "Humans", wp: 99999, maxWP: 99999 });
  const s = state({}, [f], { allies: [{ partyIdx: 0, name: "Bo", lvl: 4, sub: "Thief", wp: 20, maxWP: 20 }], round: 2 });
  s.party = [sheet];
  const ev = alliesTurn(s, constRng(20), []);
  assert.deepEqual(f.dot.dmg, { n: 1, sides: 4, bonus: 4 });
  assert.equal(ev.find((e) => e.type === "poisonedEdgeApplied").bonus, 4);
});

// ---------------------------------------------------------------------------
// V10 Mark
// ---------------------------------------------------------------------------

/** markedDamage(level) - the extra damage one landed blow does to a foe the level-`level` hero has Marked. */
function markedDamage(level) {
  const run = (marked) => {
    const s = state({ sub: "Soldier", level, abilities: marked ? ["mark"] : [] });
    if (marked) useAbility(s, "mark", constRng(20), []);
    const ev = [];
    playerStrike(s, seqRng((i) => (i === 0 ? 1 : 3)), ev); // a raw 1 lands; the weapon die reads 3
    return ev.find((e) => e.type === "struck").dmg;
  };
  return run(true) - run(false);
}

test("V10 Mark: adds your level per strike instead of +2 (3 at level 3, 5 at level 5)", () => {
  assert.equal(markedDamage(3), 3);
  assert.equal(markedDamage(5), 5);
  assert.equal(markedDamage(1), 1);
  const s = state({ level: 4, abilities: ["mark"] });
  const ev = useAbility(s, "mark", constRng(20), []);
  assert.equal(s.combat.foes[0].marked, 4, "the flag carries the marker's level");
  assert.deepEqual(ev.find((e) => e.type === "marked"), { type: "marked", target: "Target", bonus: 4 });
});

test("V10 Mark: a Joiner's strikes add it too, at the level of whoever laid the Mark; a Joiner's own Mark carries its level", () => {
  const sheet = { name: "Ada", level: 2, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: [] };
  const swing = (marked) => {
    const f = foe({ type: "Humans", wp: 99999, maxWP: 99999, ...(marked ? { marked } : {}) });
    const s = state({}, [f], { allies: [{ partyIdx: 0, name: "Ada", lvl: 2, sub: "Fighter", wp: 20, maxWP: 20 }], round: 2 });
    s.party = [{ ...sheet }];
    return alliesTurn(s, seqRng((i) => (i === 0 ? 3 : 4)), []).find((e) => e.type === "allyStruck").dmg;
  };
  assert.equal(swing(5) - swing(false), 5, "the hero's level 5 Mark, on a Joiner's blow");
  assert.equal(swing(true) - swing(false), 2, "a flag an older build saved as true keeps the old +2");
  const thief = { ...sheet, name: "Bo", level: 4, sub: "Burglar", cls: "Thief", weapon: "Dagger", abilities: ["mark"] };
  const f = foe({ type: "Humans", wp: 99999, maxWP: 99999 });
  const s = state({}, [f], { allies: [{ partyIdx: 0, name: "Bo", lvl: 4, sub: "Thief", wp: 20, maxWP: 20 }], round: 1 });
  s.party = [thief];
  const ev = alliesTurn(s, constRng(20), []);
  assert.equal(f.marked, 4);
  assert.equal(ev.find((e) => e.type === "marked").bonus, 4);
});

test("V10 Mark: a Mark never adds a second time to the same foe (still refused on a foe already marked)", () => {
  const f = foe({ marked: 3 });
  assert.equal(abilityTargetShortfall("mark", f), "alreadyOn");
  assert.equal(markBonus(f), 3);
  assert.equal(markBonus(foe()), 0);
});

// ---------------------------------------------------------------------------
// V11 Cutpurse
// ---------------------------------------------------------------------------

const HIT_THEN_THREE = (i) => (i === 0 ? 1 : 3); // a raw 1 lands, the weapon die reads 3

test("V11 Cutpurse: a normal strike (the plain strike's roll and damage) that also lifts d10 x level gold when it lands", () => {
  const level = 3;
  const mk = (abilities) => state({ cls: "Thief", sub: "Pilfer", level, gold: 0, abilities }, [foe({ wp: 99999, maxWP: 99999 })]);
  const plain = mk([]);
  const plainEv = [];
  playerStrike(plain, countingRng(seqRng(HIT_THEN_THREE)), plainEv);
  const s = mk(["cutpurse"]);
  const rng = countingRng(seqRng(HIT_THEN_THREE));
  const plainRng = countingRng(seqRng(HIT_THEN_THREE));
  playerStrike(mk([]), plainRng, []);
  const ev = useAbility(s, "cutpurse", rng, []);
  const struck = ev.find((e) => e.type === "struck");
  assert.equal(struck.dmg, plainEv.find((e) => e.type === "struck").dmg, "the plain strike's damage");
  assert.equal(struck.roll, plainEv.find((e) => e.type === "struck").roll, "the plain strike's roll");
  const gold = derivedRng(0, "cutpurse", 0, "you").d(10) * level;
  assert.equal(s.c.gold, gold);
  assert.deepEqual(ev.find((e) => e.type === "cutpursed"), { type: "cutpursed", target: "Target", amount: gold });
  assert.ok(ev.some((e) => e.type === "goldGained" && e.amount === gold && e.why === "cutpurse"));
});

test("V11 Cutpurse: the gold is d10 x level on a derived stream: the strike's main draws are the plain strike's", () => {
  const mk = (abilities) => state({ cls: "Thief", sub: "Pilfer", level: 2, gold: 0, abilities }, [foe({ wp: 99999, maxWP: 99999 })]);
  const plainRng = countingRng(seqRng(HIT_THEN_THREE));
  playerStrike(mk([]), plainRng, []);
  const rng = countingRng(seqRng(HIT_THEN_THREE));
  rng.getState = () => 12345; // the derived stream keys off the main cursor
  const s = mk(["cutpurse"]);
  s.acts = 7;
  useAbility(s, "cutpurse", rng, []);
  assert.equal(rng.n, plainRng.n, "no main-rng draw for the gold");
  assert.equal(s.c.gold, derivedRng(12345, "cutpurse", 7, "you").d(10) * 2);
});

test("V11 Cutpurse: a miss lifts nothing and still spends the once-a-fight use; the strike is in the event order before the gold", () => {
  const s = state({ cls: "Thief", sub: "Pilfer", level: 3, gold: 0, abilities: ["cutpurse"] });
  const miss = useAbility(s, "cutpurse", constRng(20), []);
  assert.ok(miss.some((e) => e.type === "strikeMissed"));
  assert.equal(miss.some((e) => e.type === "cutpursed"), false);
  assert.equal(s.c.gold, 0);
  assert.equal(refusal(useAbility(s, "cutpurse", constRng(1), [])).reason, "spent", "the miss still spent it");
  const hit = state({ cls: "Thief", sub: "Pilfer", level: 3, gold: 0, abilities: ["cutpurse"] });
  const ev = useAbility(hit, "cutpurse", seqRng(HIT_THEN_THREE), []);
  const order = ev.map((e) => e.type);
  assert.ok(order.indexOf("struck") < order.indexOf("cutpursed"), "the blow first, then the gold it explains");
  assert.ok(order.indexOf("cutpursed") < order.indexOf("goldGained"));
});

test("V11 Cutpurse: still once per fight (no second use all fight), and a fresh fight restores it", () => {
  assert.equal(ABILITY_BY_ID.cutpurse.cd, "fight");
  assert.equal(abilityReadyAfter("cutpurse"), null);
  const s = state({ cls: "Thief", sub: "Pilfer", abilities: ["cutpurse"] });
  assert.ok(used(useAbility(s, "cutpurse", constRng(20), [])));
  for (let i = 0; i < 6; i++) {
    assert.equal(refusal(useAbility(s, "cutpurse", constRng(20), [])).reason, "spent");
    passRound(s);
  }
  endCombat(s, []);
  assert.equal(isReady(s.c, "ability:cutpurse"), true);
});

test("V11 Cutpurse: a Joiner Thief's Cutpurse is the same strike, the gold paid to the hero's purse", () => {
  const sheet = { name: "Bo", level: 3, sub: "Burglar", cls: "Thief", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Dagger", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["cutpurse"] };
  const f = foe({ type: "Humans", wp: 99999, maxWP: 99999 });
  const s = state({ gold: 10 }, [f], { allies: [{ partyIdx: 0, name: "Bo", lvl: 3, sub: "Thief", wp: 20, maxWP: 20 }], round: 2 });
  s.party = [sheet];
  const ev = alliesTurn(s, seqRng((i) => (i === 0 ? 1 : 3)), []);
  const gold = derivedRng(0, "cutpurse", 0, "Bo").d(10) * 3;
  assert.ok(ev.some((e) => e.type === "allyStruck" && e.via === "cutpurse"));
  assert.deepEqual(ev.find((e) => e.type === "cutpursed"), { type: "cutpursed", target: "Target", amount: gold, member: "Bo" });
  assert.equal(s.c.gold, 10 + gold);
  assert.ok(sheet.timers["ability:cutpurse"].left > 900, "once per fight on its own sheet");
});

// ---------------------------------------------------------------------------
// V12 Stealth
// ---------------------------------------------------------------------------

/** stealthRaws(over, combat) - the raw d20 draws on which the hero's first landed blow is a Stealth crit. */
function stealthRaws(cOver = {}, combatOver = {}, mutate = null) {
  const hits = [];
  for (let raw = 1; raw <= 20; raw++) {
    const s = state({ sub: "Knight", skills: { Stealth: 1 }, ...cOver }, [foe()], { opened2: false, ...combatOver });
    if (mutate) mutate(s);
    const ev = [];
    playerStrike(s, seqRng((i) => (i === 0 ? raw : 20)), ev);
    if (ev.some((e) => e.type === "stealthStrike")) hits.push(raw);
  }
  return hits;
}

test("V12 Stealth: crits on the top three numbers of the strike die (18-20 on a d20), the first landed blow only", () => {
  assert.equal(STEALTH_CRIT_FACES, 3);
  assert.deepEqual(stealthRaws(), [1, 2, 3], "rolls 20, 19 and 18");
  const s = state({ sub: "Knight", skills: { Stealth: 1 } }, [foe()], { opened2: false });
  const ev = [];
  playerStrike(s, seqRng((i) => (i === 0 ? 3 : 20)), ev);
  const struck = ev.find((e) => e.type === "struck");
  assert.equal(struck.critical, true);
  assert.equal(struck.critBy, "stealth");
  assert.equal(struck.critAtLeast, 18);
  assert.deepEqual(stealthRaws({}, { opened2: true }), [], "never on a later blow");
});

test("V12 Stealth: never in plate, never in the dark (without a light)", () => {
  assert.deepEqual(stealthRaws({ armor: "Plate" }), []);
  assert.deepEqual(stealthRaws({}, {}, (s) => { s.floor.g[s.floor.py][s.floor.px].dark = true; }), []);
});

test("V12 Stealth: a Joiner's own Stealth crits on the same three numbers, on its first landed blow", () => {
  const raws = [];
  for (let raw = 1; raw <= 20; raw++) {
    const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: { Stealth: 1 }, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: [] };
    const s = state({}, [foe({ type: "Humans", wp: 99999, maxWP: 99999 })], { allies: [{ partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20 }], round: 2 });
    s.party = [sheet];
    const ev = alliesTurn(s, seqRng((i) => (i === 0 ? raw : 4)), []);
    if (ev.some((e) => e.type === "stealthStrike" && e.member === "Ada")) raws.push(raw);
  }
  assert.deepEqual(raws, [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// V13 Sewing
// ---------------------------------------------------------------------------

/** sewingNights(tier or sub) - the nightly patches a worn piece takes before the patching stops (armour kept hurt). */
function sewingNights(over, nights = 12) {
  const s = state({ armor: "Leather", ar: 3, armorWP: 0, armorMax: 999, rations: 99, ...over });
  s.combat = null;
  let patched = 0;
  const amounts = [];
  for (let d = 0; d < nights; d++) {
    const ev = [];
    s.c.armorWP = 0;
    newDay(s, true, seqRng(() => 1), ev);
    const patches = ev.filter((e) => e.type === "armorPatched");
    patched += patches.length;
    for (const p of patches) amounts.push(p.amount);
  }
  return { patched, amounts, left: s.c.patches };
}

test("V13 Sewing: the first tier patches 6 times in all instead of 4 (d6 each, 21 hit points in a run)", () => {
  assert.equal(SEWING_PATCHES[1], 6);
  const r = sewingNights({ cls: "Thief", sub: "Burglar", skills: { Sewing: 1 } });
  assert.equal(r.patched, 6, "six patches, then it stops");
  assert.deepEqual(r.amounts, [1, 1, 1, 1, 1, 1], "a d6 each (a raw 1 reads 1)");
  assert.equal(r.left, 6);
  // 21 = 6 patches x the mean of a d6 (3.5)
  let sum = 0;
  for (let raw = 1; raw <= 6; raw++) sum += sewingNightsWith(raw).amounts.reduce((a, b) => a + b, 0);
  assert.equal(sum / 6, 21);
});

function sewingNightsWith(raw) {
  const s = state({ cls: "Thief", sub: "Burglar", skills: { Sewing: 1 }, armor: "Leather", ar: 3, armorWP: 0, armorMax: 999, rations: 99 });
  s.combat = null;
  const amounts = [];
  for (let d = 0; d < 12; d++) {
    const ev = [];
    s.c.armorWP = 0;
    newDay(s, true, seqRng(() => raw), ev);
    for (const p of ev.filter((e) => e.type === "armorPatched")) amounts.push(p.amount);
  }
  return { amounts };
}

test("V13 Sewing: the second tier is unchanged (d6+3, 6 times), a Master of Arms still patches d6+3 every night with no limit", () => {
  assert.equal(SEWING_PATCHES[2], 6);
  const second = sewingNights({ cls: "Thief", sub: "Burglar", skills: { Sewing: 2 } });
  assert.equal(second.patched, 6);
  assert.deepEqual(second.amounts, [4, 4, 4, 4, 4, 4], "d6 + 3");
  const moa = sewingNights({ cls: "Fighter", sub: "Master of Arms", skills: {} });
  assert.equal(moa.patched, 12, "every night, no limit");
  assert.deepEqual(moa.amounts, new Array(12).fill(4));
});

test("V13 Sewing: the seventh night is refused (the boundary), and a fresh piece of armour starts its count again", () => {
  const s = state({ cls: "Thief", sub: "Burglar", skills: { Sewing: 1 }, armor: "Leather", ar: 3, armorWP: 0, armorMax: 999, rations: 99, patches: 5 });
  s.combat = null;
  const nightly = () => {
    const ev = [];
    s.c.armorWP = 0;
    newDay(s, true, seqRng(() => 1), ev);
    return ev.filter((e) => e.type === "armorPatched").length;
  };
  assert.equal(nightly(), 1, "the sixth patch lands");
  assert.equal(nightly(), 0, "the seventh does not");
  s.c.patches = 0; // a piece swapped in: items.js resets the count
  assert.equal(nightly(), 1);
});

// ---------------------------------------------------------------------------
// V14 Runes/Signs
// ---------------------------------------------------------------------------

/** runesRead(acts, over) - a Runes/Signs Fighter with one scroll reads it at `state.acts`; returns the events and the scrolls left. */
function runesRead(acts, c = {}) {
  const s = state({ skills: { "Runes/Signs": 1 }, scrolls: 1, intel: 14, wp: 10, maxWP: 40, ...c });
  s.combat = null;
  s.acts = acts;
  s.floor.depth = 1;
  const rng = seqRng(() => 10);
  rng.pick = (arr) => arr.find((sp) => sp.n === "Heal");
  const ev = readScroll(s, rng, []);
  return { ev, scrolls: s.c.scrolls, s };
}
const keepAt = (acts) => rollCheck(scrollKeepRng({ acts }, {}), RUNES_KEEP_DIE, atLeastFor(RUNES_KEEP_FACES, RUNES_KEEP_DIE)).ok;

test("V14 Runes/Signs: a scroll read is spent only 5 times in 6 (a 1-in-6 keep from the derived scrollKeep stream)", () => {
  assert.equal(RUNES_KEEP_FACES / RUNES_KEEP_DIE, 1 / 6);
  let kept = 0;
  const N = 600;
  for (let acts = 0; acts < N; acts++) {
    const r = runesRead(acts);
    const wantKept = keepAt(acts);
    assert.equal(r.scrolls, wantKept ? 1 : 0, `acts ${acts}`);
    assert.equal(r.ev.some((e) => e.type === "scrollKept"), wantKept, `acts ${acts}`);
    if (wantKept) kept++;
  }
  assert.ok(kept > N / 6 - 40 && kept < N / 6 + 40, `${kept} kept of ${N}: about one in six`);
  assert.ok(kept > 0 && kept < N);
});

test("V14 Runes/Signs: the keep comes before the cast it precedes, the cast still happens, and the main rng is not touched", () => {
  let acts = 0;
  while (!keepAt(acts)) acts++;
  const r = runesRead(acts);
  const order = r.ev.map((e) => e.type);
  assert.deepEqual(order.slice(0, 3), ["scrollRead", "scrollKept", "scrollCast"]);
  assert.ok(order.includes("healed"), "a kept scroll still pays its free cast");
  // a keep draws nothing from the main rng that a spend does not
  let spendAt = 0;
  while (keepAt(spendAt)) spendAt++;
  const drawsOf = (a) => {
    const s = state({ skills: { "Runes/Signs": 1 }, scrolls: 1, intel: 14, wp: 10, maxWP: 40 });
    s.combat = null;
    s.acts = a;
    const rng = countingRng(seqRng(() => 10));
    rng.pick = (arr) => arr.find((sp) => sp.n === "Heal");
    readScroll(s, rng, []);
    return rng.n;
  };
  assert.equal(drawsOf(acts), drawsOf(spendAt), "the keep roll is on its own stream");
});

test("V14 Runes/Signs: only Runes/Signs readers keep a scroll (a Magic User and an intelligence reader always spend it)", () => {
  for (let acts = 0; acts < 120; acts++) {
    const mu = runesRead(acts, { cls: "Magic User", sub: "Wizard", level: 5, grimoire: ["Heal"], skills: {} });
    assert.equal(mu.scrolls, 0, `Magic User at acts ${acts}`);
    assert.equal(mu.ev.some((e) => e.type === "scrollKept"), false);
    const intel = runesRead(acts, { skills: {}, intel: 20 });
    assert.equal(intel.scrolls, 0, `intel reader at acts ${acts}`);
    assert.equal(intel.ev.some((e) => e.type === "scrollKept"), false);
  }
});

test("V14 Runes/Signs: the skill text says it, and its cost never moves", () => {
  assert.ok(FIGHTER_SKILLS["Runes/Signs"].txt.includes("one read in six does not use the scroll up"));
  assert.equal(FIGHTER_SKILLS["Runes/Signs"].cost, 2, "the cost never moves (chargen-rng-pin)");
});

// ---------------------------------------------------------------------------
// Part B: texts, narration, edges
// ---------------------------------------------------------------------------

test("V8 V9 V10 V11 V12 V13 V14: the text states the ruled numbers in plain words (and the table twins are the same line)", () => {
  assert.equal(ABILITY_BY_ID.brace.txt, "halve the next two blows that land on you");
  assert.equal(ABILITY_BY_ID.taunt.txt, "every foe swings at you this round and the next, and your armour soaks double both times");
  assert.equal(ABILITY_BY_ID.poisonedEdge.txt, "the blade weeps: d4 + your level a round to the target for three rounds");
  assert.ok(ABILITY_BY_ID.mark.txt.includes("adds your level in damage"));
  assert.equal(/\+2/.test(ABILITY_BY_ID.mark.txt), false, "no stale +2");
  assert.equal(ABILITY_BY_ID.cutpurse.txt, "a normal strike that also lifts d10 × level gold off the target when it lands; it has other problems; once per fight");
  assert.equal(FIGHTER_SKILLS.Stealth.txt, "your first landed blow of a fight crits on the top three numbers of your die (18–20 on a d20), and so does a Joiner's own if it has Stealth; never in plate");
  assert.equal(THIEF_SKILLS.Sewing.txt, "once on each fed day's rest, patch hurt armour: d6 hp back, 6 times in all");
  assert.equal(THIEF_SKILLS.Sewing.txt2, "once on each fed day's rest, patch hurt armour: d6+3 hp back, 6 times in all");
});

test("V8 V9 V10 V11 V14: the new numbers come out of the event, in the Oracle and on the rail", () => {
  const cases = [
    [{ type: "braced", blows: 2 }, /next 2 blows/, /next 2 blows/],
    [{ type: "braced", blows: 2, member: "Ada" }, /Ada: Braced/, /Ada: Braced/],
    [{ type: "braceHeld", name: "Goblin", soaked: 3, left: 1 }, /1 more blow to go/, /1 more to go/],
    [{ type: "taunted", rounds: 2 }, /2 rounds/, /2 rounds/],
    [{ type: "poisonedEdgeApplied", target: "Rat", rounds: 3, bonus: 3 }, /d4 \+ 3 a round/, /d4 \+ 3 a round/],
    [{ type: "marked", target: "Rat", bonus: 5 }, /\+5 damage/, /\+5 damage/],
    [{ type: "scrollKept", spell: "Heal" }, /still whole/, /still whole/],
  ];
  for (const [e, oracle, rail] of cases) {
    assert.match(EVENT_NARRATION[e.type](e), oracle, "Oracle " + e.type);
    assert.match(LINE_FOR[e.type](e).text, rail, "rail " + e.type);
  }
});

test("edge (adjacency, V8 V9 V13): the use right after the last allowed one is refused or does nothing, and the fight-over reset restores every use", () => {
  const s = state({ abilities: ["brace", "taunt"] });
  useAbility(s, "brace", constRng(20), []);
  assert.equal(refusal(useAbility(s, "brace", constRng(20), [])).reason, "cooldown", "Brace stays on its cooldown of 3 whatever it still holds");
  useAbility(s, "taunt", constRng(20), []);
  assert.equal(refusal(useAbility(s, "taunt", constRng(20), [])).reason, "cooldown");
  endCombat(s, []);
  for (const key of ["brace", "taunt"]) assert.equal(isReady(s.c, `ability:${key}`), true, key);
  assert.equal(s.combat, null);
});

test("edge (empty): the abilities ruled keep change nothing (Riposte, Pommel Strike, Death Touch, Silent Step), and no new field joins the combat state", () => {
  for (const key of ["riposte", "pommelStrike"]) assert.equal(ABILITY_BY_ID[key].cd, 4, key);
  assert.equal(ABILITY_BY_ID.deathTouch.cd, "fight");
  assert.equal(ABILITY_BY_ID.silentStep.cd, "fight");
  const s = state({ abilities: ["brace"] });
  const before = Object.keys(s.combat).sort();
  useAbility(s, "brace", constRng(20), []);
  assert.deepEqual(Object.keys(s.combat).filter((k) => !before.includes(k)), ["braced"], "the existing braced flag, now a count: nothing new");
});

test("edge (ordering): effect first, cooldown after for Taunt; the use round's foe turn ticks the fresh timer once", () => {
  const s = state({ abilities: ["taunt"] });
  const seen = [];
  useAbility(s, "taunt", constRng(20), []);
  const rec = () => (s.c.timers["ability:taunt"] ? s.c.timers["ability:taunt"].phase + ":" + s.c.timers["ability:taunt"].left : "ready");
  seen.push(rec());
  for (let i = 0; i < 5; i++) {
    foeTurn(s, constRng(20), []);
    seen.push(rec());
  }
  assert.deepEqual(seen, ["effect:1", "cooldown:4", "cooldown:3", "cooldown:2", "cooldown:1", "ready"]);
});
