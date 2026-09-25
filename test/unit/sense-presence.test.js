// test/unit/sense-presence.test.js
//
// RULES-05 (Phase 75, user 2026-09-25) — Sense Presence delivers what its
// text promises: the hero always goes first, never sees "You cannot see
// what you are fighting", and can crit in the dark. Direct unit coverage
// for engine/combat.js#resolveInitiative/fight/playerStrike, mirroring
// test/unit/combat.test.js's established fakeRng/fixedFighter/fixedState/
// fixedFoe/fixedCombat pattern (kept local and trimmed to this file's own
// needs, per that file's own convention of not sharing fixtures across
// test files).

import test from "node:test";
import assert from "node:assert/strict";

import { resolveInitiative, fight, playerStrike } from "../../engine/combat.js";
import { initiativeVerdictText } from "../../src/browser/narrationLines.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. Throws if the sequence underflows, which doubles as
 * a "no more rng draws expected" assertion. */
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

// "Master of Arms" carries no special initiative or crit hook anywhere in
// combat.js (only a to-hit bonus and a parley/flee refusal) — the plain,
// unforced sub used for every scenario that should NOT force a foe-first
// roll or an unrelated crit rule.
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Master of Arms", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
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

function fixedFloor({ dark = false } = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  if (dark) g[1][1].dark = true;
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState({ c: cOverrides = {}, dark = false, ...rest } = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor({ dark }),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, pending: true, ...overrides };
}

// ─── 1: Court Mage — senses flips the forced-foe roll to an outright win ──

test("resolveInitiative: a Court Mage in round 1 with senses wins outright on (1, 20), why senses; without senses the same pair still forces foe", () => {
  const withSenses = fixedState({ c: { sub: "Court Mage", senses: 1 } });
  withSenses.combat = fixedCombat([], { round: 1 });
  const r1 = resolveInitiative(withSenses, fakeRng([1, 20]));
  assert.equal(r1.first, "you");
  assert.equal(r1.why, "senses");
  assert.equal(r1.mine, 1);
  assert.equal(r1.theirs, 20);

  const withoutSenses = fixedState({ c: { sub: "Court Mage" } });
  withoutSenses.combat = fixedCombat([], { round: 1 });
  const r2 = resolveInitiative(withoutSenses, fakeRng([1, 20]));
  assert.equal(r2.first, "foe");
  assert.equal(r2.why, "courtMage");
});

// ─── 2: Samurai and a plain hero both go first with senses; Foresight wins the why race ──

test("resolveInitiative: a Samurai and a plain hero both go first with senses (why 'senses'); Foresight + senses reports why 'foreseen'", () => {
  for (const sub of ["Samurai", "Master of Arms"]) {
    const state = fixedState({ c: { sub, senses: 1 } });
    state.combat = fixedCombat([], { round: 1 });
    const r = resolveInitiative(state, fakeRng([1, 20]));
    assert.equal(r.first, "you", `sub ${sub}`);
    assert.equal(r.why, "senses", `sub ${sub}`);
  }

  const foreseenAndSensed = fixedState({ c: { sub: "Samurai", senses: 1, foresight: true } });
  foreseenAndSensed.combat = fixedCombat([], { round: 1 });
  const r = resolveInitiative(foreseenAndSensed, fakeRng([1, 20]));
  assert.equal(r.first, "you");
  assert.equal(r.why, "foreseen", "foresight is checked before senses in the why chain");
});

// ─── 3: the draw count is unchanged, with and without senses ──────────────

test("resolveInitiative: draws exactly two dice with and without senses", () => {
  const withSenses = fixedState({ c: { senses: 1 } });
  withSenses.combat = fixedCombat([], { round: 1 });
  const rngA = fakeRng([5, 9]);
  resolveInitiative(withSenses, rngA);
  assert.throws(() => rngA.d(20), /sequence exhausted/, "exactly two draws with senses");

  const withoutSenses = fixedState();
  withoutSenses.combat = fixedCombat([], { round: 1 });
  const rngB = fakeRng([5, 9]);
  resolveInitiative(withoutSenses, rngB);
  assert.throws(() => rngB.d(20), /sequence exhausted/, "exactly two draws without senses");
});

// ─── 4: combatInDark honours senses ────────────────────────────────────────

test("fight: combatInDark does not fire with senses up on a dark tile; it fires without senses", () => {
  const withSenses = fixedState({ c: { senses: 1 }, dark: true });
  withSenses.combat = fixedCombat([], { round: 1 });
  // senses forces "you" outright — no foeTurn runs, no extra draws needed.
  const eventsA = fight(withSenses, fakeRng([1, 20]), []);
  assert.ok(eventsA.some((e) => e.type === "combatJoined" && e.first === "you"));
  assert.equal(eventsA.some((e) => e.type === "combatInDark"), false);

  const withoutSenses = fixedState({ dark: true });
  withoutSenses.combat = fixedCombat([], { round: 1 });
  // a fair win (mine >= theirs) also keeps "you" first, so no foeTurn runs.
  const eventsB = fight(withoutSenses, fakeRng([20, 1]), []);
  assert.ok(eventsB.some((e) => e.type === "combatJoined" && e.first === "you"));
  assert.ok(eventsB.some((e) => e.type === "combatInDark"));
});

// ─── 5: the dark crit ban is waived by senses ──────────────────────────────

test("playerStrike: a strike on the weapon's crit face is critical in the dark with senses; not critical without senses", () => {
  const withSenses = fixedState({ c: { senses: 1 }, dark: true });
  const foeA = fixedFoe();
  withSenses.combat = fixedCombat([foeA], { pending: false });
  // draw 1 -> mirrored to the d20's top face (roll 20, the weapon's own top-
  // face crit threshold); draw 2 -> the d6 weapon-damage roll (Club);
  // playerStrike always runs afterPlayerAction -> foeTurn next (the foe
  // survives a single hit at 999 wp) — draw 3 is a huge raw value, which
  // mirrors to a deeply negative roll-high face and guarantees the foe's own
  // counter-swing misses, so no further draws are needed.
  const eventsA = playerStrike(withSenses, fakeRng([1, 3, 999]), []);
  const struckA = eventsA.find((e) => e.type === "struck");
  assert.ok(struckA, "the strike must land");
  assert.equal(struckA.critical, true, "senses waives the dark no-crit ban");

  const withoutSenses = fixedState({ dark: true });
  const foeB = fixedFoe();
  withoutSenses.combat = fixedCombat([foeB], { pending: false });
  const eventsB = playerStrike(withoutSenses, fakeRng([1, 3, 999]), []);
  const struckB = eventsB.find((e) => e.type === "struck");
  assert.ok(struckB, "the strike must land");
  assert.equal(struckB.critical, false, "no senses: the dark no-crit ban still applies");
});

// ─── 6: the verdict line ────────────────────────────────────────────────────

test("initiativeVerdictText: why 'senses' reads in voice and still says you go first; every other why case is untouched", () => {
  const text = initiativeVerdictText({ first: "you", why: "senses" });
  assert.ok(text.includes("You felt them coming."), text);
  assert.ok(/you go first/i.test(text), text);

  assert.equal(initiativeVerdictText({ first: "you", why: "foreseen" }), "Foresight — you go first.");
  assert.equal(initiativeVerdictText({ first: "foe", why: "samurai" }), "Samurai honour — they go first.");
  assert.equal(initiativeVerdictText({ first: "you" }), "You go first.");
  assert.equal(initiativeVerdictText({ first: "foe" }), "They go first.");
});
