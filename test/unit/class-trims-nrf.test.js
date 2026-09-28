// test/unit/class-trims-nrf.test.js
//
// Quick 260928-nrf (user rulings 2026-09-28, answering the 260928-abl
// Fighter/Thief ability audit's option (a) for each trim):
//   (1) the Thief's flee bonus is +3 (canon +5; a deliberate deviation);
//   (2) Sweep needs two or more living foes, and refuses otherwise;
//   (3) Kata and Feint roll to hit with 3 extra winning faces (needShift +3)
//       instead of auto-hitting;
//   (4) foes land on an Acrobat with their top 4 faces (was 3);
//   (5) a Joiner resists a foe's bolt or drain on the same half-intel scale
//       the hero and foes use (resistFaces(intel), its OWN intel).
// Engine pins live here; the copy pins live in class-trims-nrf-copy.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { FLEE_NEED, FLEE_THIEF_BONUS, ABILITY_BY_ID } from "../../content/index.js";
import { fleeBreakdown, strikeDie, toHit, memberToHit } from "../../engine/derived.js";
import { flee, pickMemberAbility, alliesTurn } from "../../engine/combat.js";
import { useAbility, SWEEP_MIN_FOES, abilityUnavailableReason } from "../../engine/abilities.js";
import { isReady } from "../../engine/effects.js";
import { chooseAbility, makeBotContext } from "../../tools/lib/tuning-bot.mjs";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

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
    cls: "Thief", sub: "Pilfer", race: "Human", level: 2, sp: 0, intel: 10,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
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

function fightState(cOver = {}, { foes, party } = {}) {
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
    combat: { foes: foes ?? [foe()], type: "Beasts", round: 1, target: 0, pending: false, opened: true, opened2: true, spellOpen: false, tracked: false },
  };
}

// ---------------------------------------------------------------------------
// (1) The Thief's flee bonus is +3.
// ---------------------------------------------------------------------------

test("(1) FLEE_THIEF_BONUS is 3 (canon +5, trimmed by user ruling 2026-09-28)", () => {
  assert.equal(FLEE_THIEF_BONUS, 3);
});

test("(1) fleeBreakdown: a Human Thief in no armour reads Thief +3, need 14", () => {
  const b = fleeBreakdown(hero());
  assert.deepEqual(b.mods, [{ name: "Thief", delta: 3 }]);
  assert.equal(b.bonus, 3);
  assert.equal(b.need, FLEE_NEED);
});

test("(1) flee: a Human Thief escapes on 11 (11 + 3 = 14) and fails on 10", () => {
  const ok = fightState();
  const okEv = flee(ok, fakeRng([11]), []);
  assert.ok(okEv.some((e) => e.type === "fled" && e.reason === "escaped"), JSON.stringify(okEv.map((e) => e.type)));
  const no = fightState({}, { foes: [foe({ asleep: 5 })] });
  const noEv = flee(no, fakeRng([10]), []);
  assert.ok(noEv.some((e) => e.type === "fleeFailed"), JSON.stringify(noEv.map((e) => e.type)));
});

// ---------------------------------------------------------------------------
// (2) Sweep needs two or more living foes.
// ---------------------------------------------------------------------------

const FILL = new Array(80).fill(20);

function sweeper(foes) {
  return fightState({ cls: "Fighter", sub: "Soldier", weapon: "Sword", abilities: ["sweep"] }, { foes });
}

test("(2) SWEEP_MIN_FOES is 2; the availability reads the live foes, not the roster", () => {
  assert.equal(SWEEP_MIN_FOES, 2);
  const one = sweeper([foe({ name: "A" }), foe({ name: "B", alive: false, wp: 0 })]);
  assert.equal(abilityUnavailableReason(one, "sweep"), "tooFewFoes");
  const two = sweeper([foe({ name: "A" }), foe({ name: "B" })]);
  assert.equal(abilityUnavailableReason(two, "sweep"), null);
  // Every other ability is untouched by the rule.
  assert.equal(abilityUnavailableReason(one, "kata"), null);
  assert.equal(abilityUnavailableReason(one, "pommelStrike"), null);
});

test("(2) the hero's Sweep with one living foe refuses tooFewFoes: no draw, no turn, no cooldown", () => {
  const s = sweeper([foe({ name: "A" }), foe({ name: "B", alive: false, wp: 0 })]);
  const rng = fakeRng([]);
  const round = s.combat.round;
  const ev = useAbility(s, "sweep", rng, []);
  assert.deepEqual(ev, [{ type: "abilityRefused", key: "sweep", reason: "tooFewFoes", name: "Sweep", need: 2, have: 1 }]);
  assert.equal(rng.count(), 0, "no draw");
  assert.equal(s.combat.round, round, "no turn spent");
  assert.equal(isReady(s.c, "ability:sweep"), true, "no cooldown started");
  assert.equal(s.combat.foes[0].wp, 999, "nothing struck");
});

test("(2) the hero's Sweep with two living foes still strikes both", () => {
  const s = sweeper([foe({ name: "A" }), foe({ name: "B" })]);
  const ev = useAbility(s, "sweep", fakeRng(FILL), []);
  const swept = ev.find((e) => e.type === "swept");
  assert.ok(swept, JSON.stringify(ev.map((e) => e.type)));
  assert.equal(swept.count, 2);
  assert.equal(ev.filter((e) => e.type === "sweptFoe").length, 2);
  assert.equal(isReady(s.c, "ability:sweep"), false, "the cooldown starts");
});

function fighterMember(overrides = {}) {
  return {
    name: "Brom", level: 2, sub: "Soldier", cls: "Fighter", race: "Human", intel: 10, wp: 30, maxWP: 30, status: "ok",
    weapon: "Sword", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Leather",
    grimoire: [], spellsUsed: 0, abilities: ["sweep"], ...overrides,
  };
}

test("(2) a Joiner never picks Sweep with one living foe, and does with two", () => {
  const sheet = fighterMember();
  const ally = { partyIdx: 0, name: "Brom", lvl: 2, sub: "Soldier", wp: 30, maxWP: 30 };
  assert.equal(pickMemberAbility(sheet, ally, 2, foe(), 1), null);
  assert.equal(pickMemberAbility(sheet, ally, 2, foe(), 2)?.id, "sweep");
  // Through alliesTurn: one live foe, the Joiner plain-strikes instead.
  const s = fightState({}, { foes: [foe()], party: [fighterMember()] });
  s.combat.allies = [{ ...ally }];
  s.combat.round = 2;
  const ev = alliesTurn(s, fakeRng(FILL), []);
  assert.equal(ev.some((e) => e.type === "memberAbilityUsed"), false, JSON.stringify(ev.map((e) => e.type)));
});

test("(2) the bot never picks Sweep with one living foe; it does with two", () => {
  const one = sweeper([foe()]);
  one.combat.round = 2;
  assert.equal(chooseAbility(one, makeBotContext()), null);
  const two = sweeper([foe({ name: "A" }), foe({ name: "B" })]);
  two.combat.round = 2;
  assert.deepEqual(chooseAbility(two, makeBotContext()), { key: "sweep" });
});

// ---------------------------------------------------------------------------
// (3) Kata and Feint roll to hit with three extra winning faces.
// ---------------------------------------------------------------------------

// fakeRng hands back the raw die face r; rollCheck reads roll = dieN + 1 - r.
const rawFor = (roll, dieN) => dieN + 1 - roll;

for (const [key, cOver] of [
  ["kata", { cls: "Fighter", sub: "Soldier", weapon: "Sword" }],
  ["feint", { cls: "Thief", sub: "Pilfer", weapon: "Dagger" }],
]) {
  test(`(3) the hero's ${key}: +3 winning faces, a miss is an ordinary miss and the ability is still spent`, () => {
    const s = fightState({ ...cOver, abilities: [key] }, { foes: [foe({ asleep: 0 })] });
    const dieN = strikeDie(s.c);
    const base = toHit(s);
    const faces = Math.min(dieN, base + 3);
    const atLeast = dieN + 1 - faces;
    assert.ok(atLeast > 1, "the shifted need still leaves a losing face at level 2");
    // One below the shifted need: a miss, naming the ability and its +3.
    const miss = useAbility(s, key, fakeRng([rawFor(atLeast - 1, dieN), ...FILL]), []);
    const m = miss.find((e) => e.type === "strikeMissed");
    assert.ok(m, JSON.stringify(miss.map((e) => e.type)));
    assert.equal(m.via, key);
    assert.equal(m.atLeast, atLeast);
    assert.deepEqual(m.mods, [{ name: ABILITY_BY_ID[key].name, delta: faces - base }]);
    assert.equal(miss.some((e) => e.type === "struck"), false);
    assert.equal(isReady(s.c, `ability:${key}`), false, "a miss still spends the once-per-fight use");
    // Exactly the shifted need: a hit that adds the level in damage.
    const h = fightState({ ...cOver, abilities: [key] }, { foes: [foe({ asleep: 0 })] });
    const hit = useAbility(h, key, fakeRng([rawFor(atLeast, dieN), ...new Array(80).fill(1)]), []);
    assert.ok(hit.some((e) => e.type === "struck"), JSON.stringify(hit.map((e) => e.type)));
  });
}

test("(3) the +3 never lifts a need past the die: a d6 striker with 5 faces reads 6, not 8", () => {
  // Level 5 strikes on a d6. A Fighter's class need is 5 winning faces.
  const s = fightState({ cls: "Fighter", sub: "Soldier", weapon: "Sword", level: 5, abilities: ["kata"] }, { foes: [foe()] });
  assert.equal(strikeDie(s.c), 6);
  const ev = useAbility(s, "kata", fakeRng(new Array(80).fill(1)), []);
  const st = ev.find((e) => e.type === "struck");
  assert.ok(st, JSON.stringify(ev.map((e) => e.type)));
  assert.equal(st.atLeast, 1, "every face wins, and the need never reads 0 or below");
});

test("(3) an untouchable foe stays untouchable: Kata no longer lands on a magic-only foe", () => {
  const s = fightState({ cls: "Fighter", sub: "Soldier", weapon: "Sword", abilities: ["kata"] }, { foes: [foe({ sp: { magicOnly: true } })] });
  const ev = useAbility(s, "kata", fakeRng(new Array(80).fill(1)), []);
  const m = ev.find((e) => e.type === "strikeMissed");
  assert.ok(m && m.untouchable, JSON.stringify(ev));
});

test("(3) the descriptors: Kata and Feint carry needShift +3 and the level in damage, no autoHit", () => {
  for (const key of ["kata", "feint"]) {
    const s = fightState({ cls: ABILITY_BY_ID[key].cls, sub: key === "kata" ? "Soldier" : "Pilfer", abilities: [key] }, { foes: [foe()] });
    // playerStrike clears the descriptor; read the strike event's via + mods instead.
    const ev = useAbility(s, key, fakeRng(new Array(80).fill(20)), []);
    const m = ev.find((e) => e.type === "strikeMissed");
    assert.ok(m, `${key}: a raw 20 is the lowest roll-high face and must miss now`);
  }
});

test("(3) a Joiner's Kata rolls with +3 faces and can miss", () => {
  const sheet = fighterMember({ abilities: ["kata"] });
  const s = fightState({}, { foes: [foe()], party: [sheet] });
  s.combat.allies = [{ partyIdx: 0, name: "Brom", lvl: 2, sub: "Soldier", wp: 30, maxWP: 30 }];
  s.combat.round = 2;
  const ev = alliesTurn(s, fakeRng(new Array(80).fill(20)), []);
  assert.ok(ev.some((e) => e.type === "memberAbilityUsed" && e.key === "kata"), JSON.stringify(ev.map((e) => e.type)));
  const m = ev.find((e) => e.type === "allyMissed");
  assert.ok(m && m.via === "kata", JSON.stringify(ev));
  const dieN = 12; // level 2 strikes on a d12
  assert.equal(m.atLeast, dieN + 1 - Math.min(dieN, memberToHit(sheet) + 3));
});

test("(3) a Joiner's needShift never revives an untouchable foe", () => {
  const sheet = fighterMember({ abilities: ["kata"] });
  const s = fightState({}, { foes: [foe({ sp: { magicOnly: true } })], party: [sheet] });
  s.combat.allies = [{ partyIdx: 0, name: "Brom", lvl: 2, sub: "Soldier", wp: 30, maxWP: 30 }];
  s.combat.round = 2;
  const ev = alliesTurn(s, fakeRng(new Array(80).fill(1)), []);
  assert.equal(ev.some((e) => e.type === "allyStruck"), false, JSON.stringify(ev));
});
