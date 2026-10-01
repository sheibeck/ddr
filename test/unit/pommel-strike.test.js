// test/unit/pommel-strike.test.js
//
// Phase 90 plan 02 (ABIL-07, report #4: "A pommel strike seems kind of
// pointless ... It's a wash."): Pommel Strike is a real strike that also
// stuns. The hero swings as normal (the plain strike's to-hit roll, weapon
// damage, crits and extra attacks) through the ability-strike descriptor
// `C.abilityStrike = { key: "pommelStrike", stunOnHit: true }`; a landed blow
// that leaves the target standing costs it its next turn (applyPommel ->
// f.stunned, consumed by foeTurn). A Joiner Fighter's round-1 opener is the
// same through memberStrike's `mod`. The stun is a flag: no new rng draw.
//
// Local helper copies mirror test/unit/abilities.test.js and
// test/unit/party-abilities.test.js (this repo's per-file fixture convention).

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility, abilityRoundsLeft } from "../../engine/abilities.js";
import { playerStrike, alliesTurn } from "../../engine/combat.js";
import { ABILITY_BY_ID, FIGHTER_SKILLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

// DIALS ships FITTED, not identity; this file's pins are canon-mechanic
// numbers, so it runs under the identity override (see abilities.test.js).
setIdentityDials();

function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
  };
}

/** countingRng(inner) — counts every draw-producing call. */
function countingRng(inner) {
  let draws = 0;
  return {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0, abilities: ["pommelStrike"],
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
    name: "Rat", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return {
    foes, type: foes[0]?.type || "Beasts", round: 1, target: 0,
    pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    ...overrides,
  };
}

// Raw draw 3 lands the Soldier's strike (the roll-high mirror of 18; need 5),
// raw 20 misses it. weaponDamage's base die takes the next draw (4).
const HIT = [3, 4];
const MISS = [20];
// Harmless filler: every foe swing misses, every kill-side draw is benign.
const FILL = new Array(40).fill(20);

function heroFight(foeOverrides = {}, cOverrides = {}) {
  const foe = fixedFoe(foeOverrides);
  const state = fixedState({ c: cOverrides });
  state.combat = fixedCombat([foe]);
  return { state, foe };
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

test("hero, hit: the plain strike's hit events (via pommelStrike), then pommelStruck, then the foe loses its turn", () => {
  const { state, foe } = heroFight();
  const events = useAbility(state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  const types = events.map((e) => e.type);
  assert.equal(types[0], "abilityUsed");
  const iStruck = types.indexOf("struck");
  const iPommel = types.indexOf("pommelStruck");
  const iStunned = types.indexOf("foeStunned");
  assert.ok(iStruck > 0 && iPommel > iStruck && iStunned > iPommel, `order was ${types.join(",")}`);
  assert.equal(events[iStruck].via, "pommelStrike");
  assert.equal(events[iPommel].target, "Rat");
  assert.equal("member" in events[iPommel], false);
  assert.equal(events.filter((e) => e.type === "pommelStruck").length, 1);
  assert.ok(foe.wp < 999, "the blow dealt weapon damage");
  assert.equal(events.some((e) => e.type === "foeMissed" || e.type === "struckByFoe"), false, "the stunned foe never reaches its swing");
  assert.equal(foe.stunned, false, "consumed by foeTurn: one lost turn, not a duration");
});

test("hero, hit: damage equals the same roll of a plain strike", () => {
  const plain = heroFight();
  playerStrike(plain.state, fakeRng([...HIT, ...FILL]), []);
  const pommel = heroFight();
  useAbility(pommel.state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  assert.equal(pommel.foe.wp, plain.foe.wp);
  assert.ok(plain.foe.wp < 999);
});

test("hero, hit: the descriptor stuns only the struck foe, and is transient", () => {
  const a = fixedFoe({ name: "A" });
  const b = fixedFoe({ name: "B" });
  const state = fixedState();
  state.combat = fixedCombat([a, b], { target: 1 });
  state.combat.abilityStrike = { key: "pommelStrike", stunOnHit: true };
  const events = playerStrike(state, fakeRng([...HIT, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "pommelStruck" && e.target === "B"));
  assert.equal(a.stunned, undefined, "only the struck foe is stunned");
  assert.equal(state.combat.abilityStrike, undefined, "the descriptor is transient");
});

test("hero, miss: a miss is a plain miss, no stun, no pommelStruck, and the cooldown still starts", () => {
  const { state, foe } = heroFight();
  const events = useAbility(state, "pommelStrike", fakeRng([...MISS, ...FILL]), []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.ok(missed && missed.via === "pommelStrike");
  assert.equal(foe.wp, 999);
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
  assert.equal(events.some((e) => e.type === "foeStunned"), false);
  assert.notEqual(foe.stunned, true);
  assert.equal(abilityRoundsLeft(state.c, "pommelStrike"), 3, "cd 4, one round already ticked by this dispatch's foe turn");
});

test("hero, hit and miss start the same 4-round cooldown", () => {
  const hit = heroFight();
  useAbility(hit.state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  const miss = heroFight();
  useAbility(miss.state, "pommelStrike", fakeRng([...MISS, ...FILL]), []);
  assert.equal(abilityRoundsLeft(hit.state.c, "pommelStrike"), 3);
  assert.equal(abilityRoundsLeft(miss.state.c, "pommelStrike"), 3);
  assert.equal(ABILITY_BY_ID.pommelStrike.cd, 4);
});

test("hero, kill: a blow that drops the target to 0 kills it and stuns nobody", () => {
  const { state, foe } = heroFight({ wp: 1, maxWP: 30 });
  const events = useAbility(state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  assert.equal(foe.alive, false);
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
  assert.equal(events.some((e) => e.type === "foeStunned"), false);
});

test("hero, shatter: a Skeleton shattered by the blow is simply dead", () => {
  const { state, foe } = heroFight({ name: "Skeleton", sp: { shatterOnBest: true } });
  const events = useAbility(state, "pommelStrike", fakeRng([1, ...FILL]), []); // raw 1 = the die's best face
  assert.ok(events.some((e) => e.type === "foeShattered"));
  assert.equal(foe.alive, false);
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
});

test("no extra draw: a landed Pommel Strike draws exactly the strike (to-hit, damage), the stun is a flag", () => {
  const { state } = heroFight();
  const rng = countingRng(fakeRng([...HIT, ...FILL]));
  useAbility(state, "pommelStrike", rng, []);
  assert.equal(rng.draws, 2, "to-hit die and weapon damage die only; the stunned foe's turn draws nothing");
});

test("no extra draw: a missed Pommel Strike draws exactly what a missed plain strike draws", () => {
  const plain = heroFight();
  const plainRng = countingRng(fakeRng([...MISS, ...FILL]));
  playerStrike(plain.state, plainRng, []);
  const pommel = heroFight();
  const pommelRng = countingRng(fakeRng([...MISS, ...FILL]));
  useAbility(pommel.state, "pommelStrike", pommelRng, []);
  assert.equal(pommelRng.draws, plainRng.draws);
});

test("double strike: a Barbarian whose two blows both land stuns once, never twice", () => {
  const { state, foe } = heroFight({}, { sub: "Barbarian" });
  const events = useAbility(state, "pommelStrike", fakeRng([3, 4, 3, 4, ...FILL]), []);
  assert.equal(events.filter((e) => e.type === "struck").length, 2);
  assert.equal(events.filter((e) => e.type === "pommelStruck").length, 1);
  assert.equal(events.filter((e) => e.type === "foeStunned").length, 1);
  assert.equal(foe.stunned, false);
});

test("double strike: one blow landing is enough (hit then miss still stuns)", () => {
  const { state } = heroFight({}, { sub: "Barbarian" });
  const events = useAbility(state, "pommelStrike", fakeRng([3, 4, 20, ...FILL]), []);
  assert.equal(events.filter((e) => e.type === "struck").length, 1);
  assert.equal(events.filter((e) => e.type === "strikeMissed").length, 1);
  assert.equal(events.filter((e) => e.type === "pommelStruck").length, 1);
});

test("double strike: a first blow that lands and a second that kills stuns nobody", () => {
  const { state, foe } = heroFight({ wp: 8, maxWP: 30 }, { sub: "Barbarian" });
  const events = useAbility(state, "pommelStrike", fakeRng([3, 4, 3, 4, ...FILL]), []);
  // dmg 1 + 4 = 5 per blow: 8 -> 3 -> dead
  assert.equal(foe.alive, false);
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
});

test("never worse than a plain strike: same roll, same damage, same foe state apart from the stun", () => {
  for (const seq of [HIT, MISS]) {
    const plain = heroFight();
    playerStrike(plain.state, fakeRng([...seq, ...FILL]), []);
    const pommel = heroFight();
    useAbility(pommel.state, "pommelStrike", fakeRng([...seq, ...FILL]), []);
    assert.equal(pommel.foe.wp, plain.foe.wp);
  }
});

test("the cooldown refuses a second use (4 rounds) like before", () => {
  const { state } = heroFight();
  useAbility(state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  const events = useAbility(state, "pommelStrike", fakeRng([...HIT, ...FILL]), []);
  assert.equal(events[0].type, "abilityRefused");
  assert.equal(events[0].reason, "cooldown");
});

// ---------------------------------------------------------------------------
// Joiner Fighter
// ---------------------------------------------------------------------------

function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Knight", wp: 20, maxWP: 20, ...overrides };
}

function classedMember(overrides = {}) {
  return {
    name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded",
    grimoire: [], spellsUsed: 0, abilities: ["pommelStrike"],
    ...overrides,
  };
}

function joinerFight(foeOverrides = {}) {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, ...foeOverrides });
  const sheet = classedMember();
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()], round: 1 });
  return { state, foe, sheet };
}

test("joiner, hit: the round-1 opener strikes for weapon damage and stuns, pommelStruck names the Joiner", () => {
  const { state, foe } = joinerFight();
  const events = alliesTurn(state, fakeRng([...HIT, ...FILL]), []);
  assert.equal(events[0].type, "memberAbilityUsed");
  assert.equal(events[0].key, "pommelStrike");
  const struck = events.find((e) => e.type === "allyStruck");
  assert.ok(struck && struck.via === "pommelStrike");
  assert.equal(foe.wp, 30 - 7, "level 1 + d6 4 + prof 2");
  const pommel = events.find((e) => e.type === "pommelStruck");
  assert.ok(pommel);
  assert.equal(pommel.member, "Ada");
  assert.equal(pommel.target, "Rat");
  assert.equal(foe.stunned, true);
  assert.ok(events.indexOf(pommel) > events.indexOf(struck), "the stun follows the blow");
});

test("joiner, miss: allyMissed via pommelStrike, no stun, the cooldown is still spent", () => {
  const { state, foe, sheet } = joinerFight();
  const events = alliesTurn(state, fakeRng([...MISS, ...FILL]), []);
  const missed = events.find((e) => e.type === "allyMissed");
  assert.ok(missed && missed.via === "pommelStrike");
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
  assert.notEqual(foe.stunned, true);
  assert.equal(foe.wp, 30);
  assert.equal(abilityRoundsLeft(sheet, "pommelStrike"), 4, "a 4-round cooldown on the member's own sheet");
});

test("joiner, kill: a blow that kills stuns nobody", () => {
  const { state, foe } = joinerFight({ wp: 5, maxWP: 30 });
  const events = alliesTurn(state, fakeRng([...HIT, ...FILL]), []);
  assert.equal(foe.alive, false);
  assert.equal(events.some((e) => e.type === "pommelStruck"), false);
});

test("joiner: a landed blow draws exactly the plain member strike's two draws", () => {
  const { state } = joinerFight();
  const rng = countingRng(fakeRng([...HIT, ...FILL]));
  alliesTurn(state, rng, []);
  assert.equal(rng.draws, 2);
});

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

test("text: the ability and the skill say the same thing, a normal strike and a hit costs the next turn", () => {
  const ab = ABILITY_BY_ID.pommelStrike.txt;
  assert.equal(ab, FIGHTER_SKILLS["Pommel Strike"].txt);
  assert.match(ab, /normal strike/);
  assert.match(ab, /a hit also costs the target its next turn/);
  assert.doesNotMatch(ab, /^the blunt end, to the temple: the target loses its next turn$/);
});
