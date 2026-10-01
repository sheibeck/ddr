// test/unit/once-per-fight.test.js
//
// Quick 260927-opf (user ruling 2026-09-27): "feint ability should only be
// usable once per fight." Then: "Skills that can essentially one shot should
// be once per combat." Every strike ability that can plausibly kill a
// same-depth foe at full HP in one use is spent for the rest of the fight
// after one use: Feint, Kata, Death Touch, Silent Step, Overhead Blow
// (flagged borderline) and Last Stand (already once a fight). Pommel Strike
// (a stun) is not a one-shot and keeps its cooldown.
//
// The per-fight mark is the existing once-a-fight record (`cd: "fight"`,
// ONCE_A_FIGHT rounds): endCombat's clearRoundTimers drops it, a mid-fight
// save keeps it (SAV-06), an old save without it loads the ability ready.
//
// Pins: the one-shot set; the hero's second use refused `spent` (no draw,
// no turn); a Joiner never picks a spent ability again this fight; the next
// fight clears the mark (hero and Joiner); save/load mid-fight keeps it; the
// refusal's Oracle and rail lines and the combat menu row live in
// test/unit/once-per-fight-copy.test.js.
//
// Phase 91.1 plan 02 (user rulings V1 to V5, 2026-10-01): part of that list came
// back. Kata, Feint, Overhead Blow, Last Stand, Second Wind, Smoke, Hamstring and
// Mark are ready again after a wait (test/unit/value-abilities.test.js); the
// three that stay once per fight are Death Touch, Silent Step and Cutpurse, so
// every pin below that used a returned ability now uses one of those three
// (declared re-pin: Feint -> Silent Step for the hero and the save, Feint ->
// Cutpurse for the Joiner, whose Silent Step is a round-1 opener).

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility } from "../../engine/abilities.js";
import { endCombat, pickMemberAbility, alliesTurn } from "../../engine/combat.js";
import { isReady, tickRounds } from "../../engine/effects.js";
import { ABILITY_BY_ID } from "../../content/index.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { newRun } from "../../engine/engine.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const FILL = new Array(60).fill(20);

function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    count: () => i,
  };
}

function hero(overrides = {}) {
  return {
    cls: "Thief", sub: "Pilfer", race: "Human", level: 2, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: ["silentStep"],
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0,
    ...overrides,
  };
}

function foe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fightState(cOver = {}, party) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: hero(cOver),
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party: party ?? [],
    dead: false, deathNote: "", epitaph: "",
    combat: { foes: [foe()], type: "Beasts", round: 1, target: 0, pending: false, opened: true, opened2: true, spellOpen: false, tracked: false },
  };
}

// ---------------------------------------------------------------------------
// The set.
// ---------------------------------------------------------------------------

test("Death Touch, Silent Step and Cutpurse are once per fight; every other ability has a numeric cooldown (V1 to V5)", () => {
  for (const id of ["deathTouch", "silentStep", "cutpurse"]) {
    assert.equal(ABILITY_BY_ID[id].cd, "fight", id);
    assert.match(ABILITY_BY_ID[id].txt, /once per fight/, `${id}'s text says so`);
  }
  for (const id of ["feint", "kata", "overheadBlow", "lastStand", "secondWind", "smoke", "hamstring", "mark", "pommelStrike"]) {
    assert.equal(typeof ABILITY_BY_ID[id].cd, "number", id);
    assert.doesNotMatch(ABILITY_BY_ID[id].txt, /once per fight/, `${id}'s text no longer says so`);
  }
});

// ---------------------------------------------------------------------------
// The hero.
// ---------------------------------------------------------------------------

test("the hero's Silent Step: one use, then refused `spent` for the rest of the fight — no draw, no turn", () => {
  const s = fightState();
  const first = useAbility(s, "silentStep", fakeRng(FILL), []);
  assert.ok(first.some((e) => e.type === "abilityUsed" && e.key === "silentStep"));
  // Many rounds later the mark is still there (not a cooldown that runs out).
  for (let r = 0; r < 60; r++) tickRounds(s.c);
  assert.equal(isReady(s.c, "ability:silentStep"), false);
  const rng = fakeRng([]);
  const round = s.combat.round;
  const second = useAbility(s, "silentStep", rng, []);
  assert.deepEqual(second, [{ type: "abilityRefused", key: "silentStep", reason: "spent", name: "Silent Step" }]);
  assert.equal(rng.count(), 0, "no draw");
  assert.equal(s.combat.round, round, "no turn spent");
});

test("every once-per-fight ability refuses as `spent`, never with a rounds count", () => {
  for (const id of ["deathTouch", "silentStep", "cutpurse"]) {
    const cls = ABILITY_BY_ID[id].cls;
    const s = fightState({ cls, sub: cls === "Fighter" ? "Soldier" : "Pilfer", abilities: [id], timers: { [`ability:${id}`]: { cadence: "rounds", left: 900, phase: "cooldown" } } });
    const ev = useAbility(s, id, fakeRng([]), []);
    assert.equal(ev[0].reason, "spent", id);
    assert.equal("left" in ev[0], false, id);
  }
  // A numeric-cooldown ability still names its rounds (Kata, a 4-round wait since V1, too).
  const k = fightState({ cls: "Fighter", sub: "Soldier", abilities: ["kata"], timers: { "ability:kata": { cadence: "rounds", left: 3, phase: "cooldown" } } });
  assert.deepEqual(useAbility(k, "kata", fakeRng([]), [])[0], { type: "abilityRefused", key: "kata", reason: "cooldown", name: "Kata", left: 3 });
  const p = fightState({ cls: "Fighter", sub: "Soldier", abilities: ["pommelStrike"], timers: { "ability:pommelStrike": { cadence: "rounds", left: 2, phase: "cooldown" } } });
  assert.deepEqual(useAbility(p, "pommelStrike", fakeRng([]), [])[0], { type: "abilityRefused", key: "pommelStrike", reason: "cooldown", name: "Pommel Strike", left: 2 });
});

test("the next fight clears the mark: after endCombat the hero's Silent Step is ready again", () => {
  const s = fightState();
  useAbility(s, "silentStep", fakeRng(FILL), []);
  assert.equal(isReady(s.c, "ability:silentStep"), false);
  endCombat(s, []);
  assert.equal(isReady(s.c, "ability:silentStep"), true);
});

// ---------------------------------------------------------------------------
// A Joiner.
// ---------------------------------------------------------------------------

function thiefMember(overrides = {}) {
  return {
    name: "Nim", level: 2, sub: "Pilfer", cls: "Thief", race: "Human", wp: 30, maxWP: 30, status: "ok",
    weapon: "Dagger", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Leather",
    grimoire: [], spellsUsed: 0, abilities: ["cutpurse"], ...overrides,
  };
}

test("a Joiner's Cutpurse: used once, never picked again this fight, ready again next fight", () => {
  const s = fightState({}, [thiefMember()]);
  s.combat.allies = [{ partyIdx: 0, name: "Nim", lvl: 2, sub: "Pilfer", wp: 30, maxWP: 30 }];
  s.combat.round = 2; // past the round-1 opener pick; the target is above half hp
  const ev = alliesTurn(s, fakeRng(FILL), []);
  assert.ok(ev.some((e) => e.type === "memberAbilityUsed" && e.key === "cutpurse"), JSON.stringify(ev.map((e) => e.type)));
  const sheet = s.party[0];
  for (let r = 0; r < 60; r++) tickRounds(sheet);
  assert.equal(isReady(sheet, "ability:cutpurse"), false);
  assert.equal(pickMemberAbility(sheet, s.combat.allies[0], 5, s.combat.foes[0]), null, "never picked again this fight");
  const ev2 = alliesTurn(s, fakeRng(FILL), []);
  assert.equal(ev2.some((e) => e.type === "memberAbilityUsed"), false);
  endCombat(s, []);
  assert.equal(isReady(s.party[0], "ability:cutpurse"), true, "the next fight clears it");
});

// ---------------------------------------------------------------------------
// Save and load mid-fight.
// ---------------------------------------------------------------------------

test("a fight saved mid-combat keeps the spent mark; an old save without it loads the ability ready", () => {
  const s = newRun(4242, [], { force: { cls: "Thief", sub: "Pilfer", race: "Human" } });
  s.c.abilities = ["silentStep"];
  s.combat = { foes: [foe()], type: "Beasts", round: 3, target: 0, pending: false, opened: true, opened2: true, spellOpen: false, tracked: false };
  useAbility(s, "silentStep", fakeRng(FILL), []);
  assert.equal(isReady(s.c, "ability:silentStep"), false);
  const raw = serializeRun(s);
  const check = validateSave(raw, { freshSeed: 1 });
  assert.ok(check.ok, check.reason);
  const loaded = rehydrate(check.value);
  assert.ok(loaded.combat, "the live fight survives the relaunch");
  assert.equal(isReady(loaded.c, "ability:silentStep"), false, "still spent after the load");
  assert.equal(useAbility(loaded, "silentStep", fakeRng([]), [])[0].reason, "spent");

  const old = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  const oldC = old.c ?? old.state?.c;
  if (oldC && oldC.timers) delete oldC.timers["ability:silentStep"];
  const oldCheck = validateSave(typeof raw === "string" ? JSON.stringify(old) : old, { freshSeed: 1 });
  assert.ok(oldCheck.ok, oldCheck.reason);
  assert.equal(isReady(rehydrate(oldCheck.value).c, "ability:silentStep"), true, "missing mark = unspent");
});

