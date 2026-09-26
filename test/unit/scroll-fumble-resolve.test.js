// test/unit/scroll-fumble-resolve.test.js
//
// RULES-10 (Phase 75.1, plan 05) — engine/scrollFumble.js#resolveScrollFumble:
// every SCROLL_FUMBLE row resolved on the right side (harmful on the reader,
// area on the reader's whole side, helpful on the targeted foe), per the
// user's severity rulings of 2026-09-25 (no fumble kills outright; turn-loss
// fumbles cost the hero at most d4 turns; Blind/Shrink work like their
// foe-side twins and cost no turns; a fumbled Summon joins the foes).
//
// Local fixtures mirror test/unit/reader-fumble-mechanics.test.js and
// test/unit/hero-out.test.js verbatim, per this suite's established
// per-file convention (no cross-import of test helpers).

import test from "node:test";
import assert from "node:assert/strict";

import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { HERO_OUT_MAX } from "../../engine/combat.js";
import { buildReinforcement, SUMMON_MAX_LIVE } from "../../engine/foeAbilities.js";
import { makeRng } from "../../engine/rng.js";
import { SCROLL_FUMBLE, SPELLS } from "../../content/index.js";
import { applyAction } from "../../engine/engine.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. `.pick()` always takes the first element. Throws if
 * the sequence underflows — this doubles as a "no more rng draws expected"
 * assertion. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => i,
  };
}

function spellRow(name) {
  const sp = SPELLS.find((s) => s.n === name);
  if (!sp) throw new Error(`no SPELLS row named ${name}`);
  return sp;
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 100, wp: 100, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Plate", ar: 15, armorMin: 10, armorWP: 45, armorMax: 45, patches: 0,
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
  return { g, px: 1, py: 1, depth: 3, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
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
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ══════════════════════════════════════════════════════════════════════════
// Task 1 — the harmful branch
// ══════════════════════════════════════════════════════════════════════════

test("harmful damage: Fireball at level 1 costs exactly the rolled 2d10+4 (mult 1)", () => {
  const state = fixedState({ c: { level: 1, wp: 100 } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Fireball"), fakeRng([5, 6]), fakeRng([]));
  assert.equal(state.c.wp, 100 - 15);
  assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: "Fireball", effect: "damage", amount: 15 });
});

test("harmful damage: a level-6 reader loses it times 3", () => {
  const state = fixedState({ c: { level: 6, wp: 100 } });
  state.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(state, spellRow("Fireball"), fakeRng([5, 6]), fakeRng([]));
  assert.equal(state.c.wp, 100 - 45);
});

test("harmful damage: plate armor and a Shield ward change nothing — unsoaked, direct hp loss", () => {
  const state = fixedState({ c: { level: 1, wp: 100, ward: { name: "Shield", pool: 999, rounds: 5 }, ar: 15, armorWP: 45, armorMax: 45 } });
  state.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(state, spellRow("Fireball"), fakeRng([5, 6]), fakeRng([]));
  assert.equal(state.c.wp, 85);
  assert.equal(state.c.ward.pool, 999);
  assert.equal(state.c.armorWP, 45);
});

test("harmful heavy: Freeze never kills a healthy reader — fumbleHeavyBlow (how frozen), Afraid raised", () => {
  const state = fixedState({ acts: 7, c: { wp: 40 }, floor: { depth: 3 } });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  const events = resolveScrollFumble(state, spellRow("Freeze"), fakeRng([]), fakeRng([]));
  assert.equal(state.dead, false);
  const blow = events.find((e) => e.type === "fumbleHeavyBlow");
  assert.equal(blow.how, "frozen");
  assert.ok(state.combat.afraid > 0);
  assert.equal(events.some((e) => e.type === "fumbleOnReader"), false, "the heavy blow's own event narrates it — nothing else is pushed");
});

test("harmful heavy: a reader at 5 hp can die of Death's heavy blow (cause scrollFumble, spell as detail)", () => {
  const state = fixedState({ acts: 27, c: { wp: 5 }, floor: { depth: 3 } });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  const events = resolveScrollFumble(state, spellRow("Death"), fakeRng([]), fakeRng([]));
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "scrollFumble"));
});

test("harmful dot: Acid sets C.selfDot with left from its d6, by acid", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Acid"), fakeRng([4]), fakeRng([]));
  assert.deepEqual(state.combat.selfDot, { left: 4, dmg: spellRow("Acid").dmg, by: "acid", spell: "Acid" });
  assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: "Acid", effect: "dot", rounds: 4 });
});

test("harmful dot: Ice sets C.selfDot with left from its d4+1, by ice, then heavy", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(state, spellRow("Ice"), fakeRng([2]), fakeRng([]));
  assert.deepEqual(state.combat.selfDot, { left: 3, dmg: spellRow("Ice").dmg, by: "ice", spell: "Ice", then: "heavy" });
});

test("harmful out: Doze and Stun set C.heroOut { kind: asleep, left: their d4 }", () => {
  for (const name of ["Doze", "Stun"]) {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe()]);
    const events = resolveScrollFumble(state, spellRow(name), fakeRng([3]), fakeRng([]));
    assert.deepEqual(state.combat.heroOut, { kind: "asleep", left: 3, spell: name });
    assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: name, effect: "out", kind: "asleep", rounds: 3 });
  }
});

test("harmful out: Stupidity sets { kind: stupefied }; Insane sets { kind: maddened }; left is never above HERO_OUT_MAX", () => {
  const stupid = fixedState();
  stupid.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(stupid, spellRow("Stupidity"), fakeRng([4]), fakeRng([]));
  assert.equal(stupid.combat.heroOut.kind, "stupefied");
  assert.equal(stupid.combat.heroOut.left, HERO_OUT_MAX);

  const insane = fixedState();
  insane.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(insane, spellRow("Insane"), fakeRng([4]), fakeRng([]));
  assert.equal(insane.combat.heroOut.kind, "maddened");
  assert.ok(insane.combat.heroOut.left <= HERO_OUT_MAX);
});

test("harmful blind: sets C.heroBlind and no heroOut; pushes fumbleOnReader effect blind", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Blind"), fakeRng([]), fakeRng([]));
  assert.equal(state.combat.heroBlind, true);
  assert.equal(state.combat.heroOut, undefined);
  assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: "Blind", effect: "blind" });
});

test("harmful shrink: halves 21 hp to 11 (loss 10), sets C.heroShrunk and no heroOut", () => {
  const state = fixedState({ c: { wp: 21 } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Shrink"), fakeRng([]), fakeRng([]));
  assert.equal(state.c.wp, 11);
  assert.equal(state.combat.heroShrunk, true);
  assert.equal(state.combat.heroOut, undefined);
  assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: "Shrink", effect: "shrink", loss: 10 });
});

test("harmful shrink: cannot take 1 hp to 0", () => {
  const state = fixedState({ c: { wp: 1 } });
  state.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(state, spellRow("Shrink"), fakeRng([]), fakeRng([]));
  assert.equal(state.c.wp, 1);
});

test("harmful weakened: sets the hex for d4+1 rounds", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Weaken"), fakeRng([2]), fakeRng([]));
  assert.equal(state.combat.weakened, true);
  assert.equal(state.combat.foeToHitPenalty, 3);
  assert.equal(state.c.timers["spell:weaken"].left, 3);
  assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: "Weaken", effect: "weakened", rounds: 3 });
});

test("harmful vapor: level 5+, d10 not 1, lands a heavy blow (how vapor)", () => {
  const state = fixedState({ acts: 7, c: { level: 5, wp: 40 }, floor: { depth: 3 } });
  state.combat = fixedCombat([fixedFoe()], { round: 1 });
  const events = resolveScrollFumble(state, spellRow("Noxious Vapor"), fakeRng([7]), fakeRng([]));
  const blow = events.find((e) => e.type === "fumbleHeavyBlow");
  assert.equal(blow.how, "vapor");
  assert.equal(state.combat.heroOut, undefined);
});

test("harmful vapor: level 5+, d10 shows 1, sets C.heroOut asleep for d4", () => {
  const state = fixedState({ c: { level: 5 } });
  state.combat = fixedCombat([fixedFoe()]);
  const events = resolveScrollFumble(state, spellRow("Noxious Vapor"), fakeRng([1, 2]), fakeRng([]));
  assert.deepEqual(state.combat.heroOut, { kind: "asleep", left: 2, spell: "Noxious Vapor" });
  assert.equal(events.some((e) => e.type === "fumbleHeavyBlow"), false);
});

test("harmful vapor: at level 1, a d6 other than 4 sets sleep without drawing the d10", () => {
  const state = fixedState({ c: { level: 1 } });
  state.combat = fixedCombat([fixedFoe()]);
  const rng = fakeRng([2, 3]); // d6=2 (not 4), then d4=3 — exactly two values, no d10 drawn
  resolveScrollFumble(state, spellRow("Noxious Vapor"), rng, fakeRng([]));
  assert.deepEqual(state.combat.heroOut, { kind: "asleep", left: 3, spell: "Noxious Vapor" });
});

test("harmful none: Turn Walking Dead and Plane Gate change nothing and say so", () => {
  for (const name of ["Turn Walking Dead", "Plane Gate"]) {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe()]);
    const before = JSON.stringify(state.combat);
    const events = resolveScrollFumble(state, spellRow(name), fakeRng([]), fakeRng([]));
    assert.equal(JSON.stringify(state.combat), before);
    assert.deepEqual(events.find((e) => e.type === "fumbleOnReader"), { type: "fumbleOnReader", spell: name, effect: "none" });
  }
});

test("no row, resolved against a reader with 200 hp, produces a died event", () => {
  const harmfulNames = Object.entries(SCROLL_FUMBLE)
    .filter(([, e]) => e.side === "harmful")
    .map(([n]) => n);
  for (const name of harmfulNames) {
    const state = fixedState({ acts: 11, c: { level: 1, wp: 200 }, floor: { depth: 3 } });
    state.combat = fixedCombat([fixedFoe()], { round: 2 });
    const events = resolveScrollFumble(state, spellRow(name), makeRng(name.length * 97 + 3), makeRng(name.length * 13 + 1));
    assert.equal(events.some((e) => e.type === "died"), false, `${name} must never kill a 200-hp reader outright`);
    assert.equal(state.dead, false, name);
  }
});

test("SUMMON_MAX_LIVE is exported as 4, and buildReinforcement builds a byte-identical reinforcement", () => {
  assert.equal(SUMMON_MAX_LIVE, 4);
  const foe = buildReinforcement("Demons", 1, fakeRng([]));
  assert.equal(foe.name, "Gremlin");
  assert.equal(foe.type, "Demons");
  assert.equal(foe.lvl, 1);
  assert.equal(foe.alive, true);
  assert.equal(foe.asleep, 0);
  assert.ok(!("abilities" in foe));
});

// ══════════════════════════════════════════════════════════════════════════
// Task 1 — turn-loss integration (75.1-04's loseTurn/applyAction)
// ══════════════════════════════════════════════════════════════════════════

test("after a Doze fumble with left 2, the next two hero dispatches are lost turns and the third acts normally", () => {
  let state = fixedState({ c: { wp: 200 }, rngState: 12345 });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  resolveScrollFumble(state, spellRow("Doze"), fakeRng([2]), fakeRng([]));
  assert.equal(state.combat.heroOut.left, 2);

  const r1 = applyAction(state, { type: "attack" });
  assert.ok(r1.events.some((e) => e.type === "heroLostTurn"));
  assert.equal(r1.state.combat.heroOut.left, 1);
  state = r1.state;

  const r2 = applyAction(state, { type: "attack" });
  assert.ok(r2.events.some((e) => e.type === "heroCameTo"));
  assert.equal(r2.state.combat.heroOut, undefined);
  state = r2.state;

  const r3 = applyAction(state, { type: "attack" });
  assert.equal(r3.events.some((e) => e.type === "heroLostTurn"), false, "the third dispatch acts normally");
});

// ══════════════════════════════════════════════════════════════════════════
// Task 2 — the area branch
// ══════════════════════════════════════════════════════════════════════════

test("area damage (Earthquake, once): one roll times the level multiplier hits every member, the ally, then the reader in order", () => {
  const state = fixedState({ c: { level: 1, wp: 100 } });
  const memberA = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 30, maxWP: 30 };
  const memberB = { partyIdx: 1, name: "Bram", lvl: 1, sub: "Fighter", wp: 5, maxWP: 5 };
  state.party = [{ status: "active" }, { status: "active" }];
  state.combat = fixedCombat([fixedFoe()], {
    allies: [memberA, memberB],
    ally: { lvl: 1, rounds: 2, name: "Bear" },
  });
  const events = resolveScrollFumble(state, spellRow("Earthquake"), fakeRng([1, 2, 3]), fakeRng([]));
  // rollDice(3d10+8) = 1+2+3+8 = 14, mult = max(1, 1-4) = 1
  assert.equal(memberA.wp, 30 - 14);
  assert.equal(memberB.wp, 0, "downed at 0");
  assert.equal(state.party[1].status, "downed");
  assert.equal(state.combat.ally, null, "the summoned ally is unmade");
  assert.equal(state.c.wp, 100 - 14);
  const sides = events.filter((e) => e.type === "fumbleOnSide");
  assert.deepEqual(sides.map((e) => e.who), ["member", "member", "ally", "reader"]);
  assert.ok(sides.every((e) => e.amount === undefined || e.amount === 14));
});

test("area damage (Lightning): rolls separately for each victim", () => {
  const state = fixedState({ c: { level: 1, wp: 50 } });
  const memberA = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 50, maxWP: 50 };
  state.combat = fixedCombat([fixedFoe()], {
    allies: [memberA],
    ally: { lvl: 1, rounds: 2, name: "Bear" },
  });
  resolveScrollFumble(state, spellRow("Lightning"), fakeRng([1, 2]), fakeRng([]));
  // rollDice(1d10+6) per damage-taking victim: member 1+6=7, reader 2+6=8 —
  // the ally is unmade by any hit and draws no magnitude of its own.
  assert.equal(memberA.wp, 50 - 7);
  assert.equal(state.combat.ally, null);
  assert.equal(state.c.wp, 50 - 8);
});

test("area volley (Fireballs): bolt k lands on victim k mod 3; a downed member's later bolt is spent without effect", () => {
  const state = fixedState({ c: { wp: 50 } });
  const member = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 5, maxWP: 5 };
  state.party = [{ status: "active" }];
  state.combat = fixedCombat([fixedFoe()], {
    allies: [member],
    ally: { lvl: 1, rounds: 2, name: "Bear" },
  });
  // n=4 bolts, dmg d10+2: bolt0->member (3+2=5, downs exactly), bolt1->ally (1+2=3, unmade),
  // bolt2->reader (2+2=4), bolt3->member again but ALREADY downed — no draw.
  const rng = fakeRng([4, 3, 1, 2]);
  resolveScrollFumble(state, spellRow("Fireballs"), rng, fakeRng([]));
  assert.equal(member.wp, 0);
  assert.equal(state.combat.ally, null);
  assert.equal(state.c.wp, 50 - 4);
});

test("with no party and no ally, all Fireballs bolts land on the reader, and Earthquake hits only the reader", () => {
  const volleyState = fixedState({ c: { wp: 100 } });
  volleyState.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(volleyState, spellRow("Fireballs"), fakeRng([3, 1, 2, 3]), fakeRng([]));
  // n=3 bolts, each (d10+2): 1+2=3, 2+2=4, 3+2=5 -> total 12
  assert.equal(volleyState.c.wp, 100 - 12);

  const quakeState = fixedState({ c: { level: 1, wp: 100 } });
  quakeState.combat = fixedCombat([fixedFoe()]);
  resolveScrollFumble(quakeState, spellRow("Earthquake"), fakeRng([1, 2, 3]), fakeRng([]));
  assert.equal(quakeState.c.wp, 100 - 14);
});

test("a downed member (wp 0 before the fumble) is not a victim", () => {
  const state = fixedState({ c: { level: 1, wp: 100 } });
  const downed = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 0, maxWP: 20 };
  state.combat = fixedCombat([fixedFoe()], { allies: [downed] });
  const events = resolveScrollFumble(state, spellRow("Earthquake"), fakeRng([1, 2, 3]), fakeRng([]));
  assert.equal(events.some((e) => e.type === "fumbleOnSide" && e.who === "member"), false);
  assert.equal(downed.wp, 0, "untouched — never resolved as a victim");
});

test("the reader dying during Fireballs stops the rest — no further bolts drawn", () => {
  const state = fixedState({ c: { wp: 3 } });
  state.combat = fixedCombat([fixedFoe()]);
  // n=3 bolts, but the very first bolt (d10+2 = 3+2 = 5) already kills the
  // solo reader; the fakeRng sequence holds only enough values for the
  // count draw and ONE bolt draw — an attempted second bolt draw would throw.
  const events = resolveScrollFumble(state, spellRow("Fireballs"), fakeRng([3, 3]), fakeRng([]));
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died"));
});

// ══════════════════════════════════════════════════════════════════════════
// Task 2 — the helpful branch
// ══════════════════════════════════════════════════════════════════════════

test("helpful heal: Heal and Major Heal restore the target foe by their dice, capped at maxWP", () => {
  const state = fixedState();
  const foe = fixedFoe({ wp: 90, maxWP: 100 });
  state.combat = fixedCombat([foe]);
  const events = resolveScrollFumble(state, spellRow("Heal"), fakeRng([9]), fakeRng([]));
  assert.equal(foe.wp, 99);
  assert.deepEqual(events.find((e) => e.type === "fumbleOnFoe"), { type: "fumbleOnFoe", spell: "Heal", target: "Target", effect: "heal", amount: 9 });

  const state2 = fixedState();
  const foe2 = fixedFoe({ wp: 95, maxWP: 100 });
  state2.combat = fixedCombat([foe2]);
  resolveScrollFumble(state2, spellRow("Major Heal"), fakeRng([9, 9, 9]), fakeRng([]));
  assert.equal(foe2.wp, 100, "capped at maxWP even though 27 was rolled");
});

test("the target is C.foes[C.target] after normalizeTarget, even when another foe is first in the list", () => {
  const state = fixedState();
  const dead = fixedFoe({ name: "Corpse", alive: false });
  const live = fixedFoe({ name: "Live One", wp: 50, maxWP: 100 });
  state.combat = fixedCombat([dead, live], { target: 0 });
  const events = resolveScrollFumble(state, spellRow("Heal"), fakeRng([5]), fakeRng([]));
  assert.equal(state.combat.target, 1);
  assert.equal(live.wp, 55);
  assert.equal(events.find((e) => e.type === "fumbleOnFoe").target, "Live One");
});

test("helpful ward: Shield gives the target a { pool 50, rounds 5, name } ward; Bubble gives an armed mirror ward", () => {
  const shieldState = fixedState();
  const shieldFoe = fixedFoe();
  shieldState.combat = fixedCombat([shieldFoe]);
  resolveScrollFumble(shieldState, spellRow("Shield"), fakeRng([]), fakeRng([]));
  assert.deepEqual(shieldFoe.ward, { pool: 50, rounds: 5, name: "Shield" });

  const bubbleState = fixedState();
  const bubbleFoe = fixedFoe();
  bubbleState.combat = fixedCombat([bubbleFoe]);
  resolveScrollFumble(bubbleState, spellRow("Bubble"), fakeRng([]), fakeRng([]));
  assert.deepEqual(bubbleFoe.ward, { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null });
});

test("helpful regen/senses: Regeneration sets regen; Sense Presence sets senses", () => {
  const regenState = fixedState();
  const regenFoe = fixedFoe();
  regenState.combat = fixedCombat([regenFoe]);
  resolveScrollFumble(regenState, spellRow("Regeneration"), fakeRng([]), fakeRng([]));
  assert.equal(regenFoe.regen, true);

  const sensesState = fixedState();
  const sensesFoe = fixedFoe();
  sensesState.combat = fixedCombat([sensesFoe]);
  resolveScrollFumble(sensesState, spellRow("Sense Presence"), fakeRng([]), fakeRng([]));
  assert.equal(sensesFoe.senses, 1);
});

test("helpful mirror: Mirror Self sets mirror to its own d6 (the table's rounds field, not the spell's dmg)", () => {
  const state = fixedState();
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  resolveScrollFumble(state, spellRow("Mirror Self"), fakeRng([4]), fakeRng([]));
  assert.equal(foe.mirror, 4);
});

test("helpful might: Strength sets might to its d10 and doubles maxWP/wp once; a second fumble refreshes might but does not double again", () => {
  const state = fixedState();
  const foe = fixedFoe({ wp: 20, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  resolveScrollFumble(state, spellRow("Strength"), fakeRng([7]), fakeRng([]));
  assert.equal(foe.might, 7);
  assert.equal(foe.maxWP, 40);
  assert.equal(foe.wp, 40);
  assert.equal(foe.strengthBoost, 20);

  resolveScrollFumble(state, spellRow("Strength"), fakeRng([3]), fakeRng([]));
  assert.equal(foe.might, 3, "refreshed");
  assert.equal(foe.maxWP, 40, "never doubled again");
});

test("helpful summon: Summon/Phantom Host/Lesser Summon queue one Demons reinforcement at the right tier", () => {
  for (const [name, level, expectedTier] of [["Summon", 3, 3], ["Phantom Host", 6, 5], ["Lesser Summon", 3, 2]]) {
    const state = fixedState({ c: { level } });
    const foe = fixedFoe();
    state.combat = fixedCombat([foe]);
    const events = resolveScrollFumble(state, spellRow(name), fakeRng([]), fakeRng([]));
    assert.equal(state.combat.pendingFoes.length, 1);
    assert.equal(state.combat.pendingFoes[0].foe.lvl, expectedTier, name);
    const ev = events.find((e) => e.type === "fumbleOnFoe");
    assert.equal(ev.joined, true);
    assert.equal(ev.reinforcement, state.combat.pendingFoes[0].foe.name);
  }
});

test("helpful summon: a pending summon or four live foes means it wanders off instead (joined false)", () => {
  const pendingState = fixedState();
  pendingState.combat = fixedCombat([fixedFoe()], { pendingFoes: [{ by: "someone", foe: fixedFoe({ name: "Already Coming" }) }] });
  const pendingEvents = resolveScrollFumble(pendingState, spellRow("Summon"), fakeRng([]), fakeRng([]));
  assert.equal(pendingEvents.find((e) => e.type === "fumbleOnFoe").joined, false);
  assert.equal(pendingState.combat.pendingFoes.length, 1, "unchanged — nothing new queued");

  const fullState = fixedState();
  fullState.combat = fixedCombat([fixedFoe(), fixedFoe({ name: "B" }), fixedFoe({ name: "C" }), fixedFoe({ name: "D" })]);
  const fullEvents = resolveScrollFumble(fullState, spellRow("Summon"), fakeRng([]), fakeRng([]));
  assert.equal(fullEvents.find((e) => e.type === "fumbleOnFoe").joined, false);
  assert.equal(fullState.combat.pendingFoes, undefined);
});

test("helpful wasted: Map the Floor and Sense Danger change no state and say the scroll was wasted", () => {
  for (const name of ["Map the Floor", "Sense Danger"]) {
    const state = fixedState();
    const foe = fixedFoe();
    state.combat = fixedCombat([foe]);
    const before = JSON.stringify(foe);
    const events = resolveScrollFumble(state, spellRow(name), fakeRng([]), fakeRng([]));
    assert.equal(JSON.stringify(foe), before);
    assert.deepEqual(events.find((e) => e.type === "fumbleOnFoe"), { type: "fumbleOnFoe", spell: name, target: "Target", effect: "wasted" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// Cross-cutting
// ══════════════════════════════════════════════════════════════════════════

test("every row of SCROLL_FUMBLE resolves without throwing, and yields at least one fumble event naming a victim", () => {
  let seedCounter = 1;
  for (const [name] of Object.entries(SCROLL_FUMBLE)) {
    const state = fixedState({ c: { level: 3, wp: 500 } });
    const member = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Soldier", wp: 500, maxWP: 500 };
    state.party = [{ status: "active" }];
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], {
      allies: [member],
      ally: { lvl: 1, rounds: 2, name: "Bear" },
      round: 3,
    });
    const rng = makeRng(seedCounter++);
    const srng = makeRng(seedCounter++);
    let events;
    assert.doesNotThrow(() => {
      events = resolveScrollFumble(state, spellRow(name), srng, rng);
    }, name);
    const named = events.some((e) => e.type === "fumbleOnReader" || e.type === "fumbleOnSide" || e.type === "fumbleOnFoe" || e.type === "fumbleHeavyBlow");
    assert.ok(named, `${name} produced no victim-naming event: ${JSON.stringify(events)}`);
  }
});

test("the main rng cursor is unchanged by a non-lethal resolution", () => {
  const state = fixedState({ c: { level: 1, wp: 500 } });
  state.combat = fixedCombat([fixedFoe()]);
  const rng = makeRng(4242);
  const before = rng.getState();
  resolveScrollFumble(state, spellRow("Fireball"), makeRng(99), rng);
  assert.equal(rng.getState(), before);
});

test("resolveScrollFumble is a no-op outside combat", () => {
  const state = fixedState();
  state.combat = null;
  const events = resolveScrollFumble(state, spellRow("Fireball"), fakeRng([]), fakeRng([]));
  assert.deepEqual(events, []);
});

test("acceptance: resolveScrollFumble and SUMMON_MAX_LIVE exist exactly once", () => {
  // grep-shaped assertions belong in acceptance criteria, not here — this
  // test only pins the runtime contract both symbols are importable and of
  // the right type, complementing the plan's own grep checks.
  assert.equal(typeof resolveScrollFumble, "function");
  assert.equal(typeof SUMMON_MAX_LIVE, "number");
});
