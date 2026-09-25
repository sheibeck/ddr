// test/unit/bubble-mirror.test.js
//
// RULES-14 (Phase 75, user 2026-09-25) — Bubble stops being a bigger Shield.
// It reflects the next blow in full at the attacker, then pops into a small
// pool for the rest of that round. Direct unit coverage for
// engine/combat.js#applyFoeDamageToPlayer/foeTurn/endCombat/flee,
// engine/magic.js#castSpell's ward branch, and engine/saveState.js#rehydrate's
// tolerant load — mirroring test/unit/combat.test.js's established
// fakeRng/fixedFighter/fixedState/fixedFoe/fixedCombat pattern (kept local
// per that file's own convention).

import test from "node:test";
import assert from "node:assert/strict";

import { applyFoeDamageToPlayer, foeTurn, endCombat, flee } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { bestAttackSpell, isAttackSpell, ATTACK_SPELL_KINDS } from "../../engine/derived.js";
import { rehydrate } from "../../engine/saveState.js";
import { newRun } from "../../engine/state.js";
import { SPELLS } from "../../content/index.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count. Throws if the sequence underflows. */
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

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
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
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const ARMED_MIRROR = { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null };

// ─── 1: casting Bubble/Shield ───────────────────────────────────────────────

test("castSpell: Bubble raises an armed mirror; wardRaised carries mirror true and popPool 25", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Cleric", grimoire: ["Bubble"], level: 3 } });
  const events = castSpell(state, SPELL_IDX.Bubble, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, ARMED_MIRROR);
  const raised = events.find((e) => e.type === "wardRaised");
  assert.equal(raised.mirror, true);
  assert.equal(raised.popPool, 25);
});

test("castSpell: Shield sets exactly the old pool/rounds shape, no reflect key ever", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Cleric", grimoire: ["Shield"], level: 1 } });
  const events = castSpell(state, SPELL_IDX.Shield, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { pool: 50, rounds: 5, name: "Shield" });
  assert.equal("reflect" in state.c.ward, false);
});

test("a Bubble raised out of combat waits, untouched, for the next fight's first landed blow", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Cleric", grimoire: ["Bubble"], level: 3 } });
  state.combat = null;
  castSpell(state, SPELL_IDX.Bubble, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, ARMED_MIRROR, "armed and waiting, no combat needed to raise it");
});

// ─── 2: the mirror reflects a landed blow in full ──────────────────────────

test("applyFoeDamageToPlayer: a 14-damage foe swing on an armed mirror reflects the full 14 (no natural armor), the caster takes none, and the ward pops to { pool: 25, rounds: 1 }", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe({ wp: 40, maxWP: 40 });
  state.combat = fixedCombat([foe]);
  const events = [];
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 14, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events, [{ type: "wardReflected", target: "Target", amount: 14, mirror: true }]);
  assert.equal(foe.wp, 26, "the foe took the full 14");
  assert.equal(state.c.wp, 55, "the caster took none of it");
  assert.deepStrictEqual(result, { died: false, onArmour: false, applied: 0 });
  assert.deepStrictEqual(state.c.ward, { name: "Bubble", pool: 25, rounds: 1 });
});

test("applyFoeDamageToPlayer: a mirror reflect that kills the attacker runs killFoe, and the ward still pops (Pitfall 1 contract)", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe({ wp: 3, maxWP: 3 });
  state.combat = fixedCombat([foe]);
  const events = [];
  // killFoe's four draws: d6 sp(1), d10 coin(1), d20 item(20 -> none), d6 cook(1 -> none).
  const result = applyFoeDamageToPlayer(state, foe, fakeRng([1, 1, 20, 1]), events, { dmg: 5, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events.map((e) => e.type), ["wardReflected", "foeKilled"]);
  assert.equal(foe.alive, false);
  assert.deepStrictEqual(result, { died: false, onArmour: false, applied: 0 });
  assert.deepStrictEqual(state.c.ward, { name: "Bubble", pool: 25, rounds: 1 });
});

// ─── 3: adjacency — the mirrored blow never soaks off its own pop pool ────

test("adjacency: the blow that triggers the mirror is never also absorbed by the pool it just popped into", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 10, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(events.some((e) => e.type === "wardAbsorbed"), false, "no absorb on the triggering blow itself");
  assert.equal(state.c.wp, 55, "the triggering blow cost the caster nothing");
});

// ─── 4: boundary — after the pop, in the SAME foe turn ─────────────────────

test("boundary: after the pop, a 25 blow shatters the pool, a 26 blow lets 1 through, a 24 blow leaves 1", () => {
  const cases = [
    { dmg: 25, wp: 55, poolAfter: null, struck: false },
    { dmg: 26, wp: 54, poolAfter: null, struck: true },
    { dmg: 24, wp: 55, poolAfter: 1, struck: false },
  ];
  for (const { dmg, wp, poolAfter, struck } of cases) {
    const state = fixedState({ c: { ward: { name: "Bubble", pool: 25, rounds: 1 } } });
    const foe = fixedFoe();
    state.combat = fixedCombat([foe]);
    const events = [];
    applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg, roll: 18, atLeast: 16, dieN: 20 });
    assert.equal(state.c.wp, wp, `dmg ${dmg}: wp`);
    assert.equal(events.some((e) => e.type === "struckByFoe"), struck, `dmg ${dmg}: struckByFoe`);
    if (poolAfter === null) {
      assert.equal(state.c.ward, null, `dmg ${dmg}: ward shattered`);
      assert.ok(events.some((e) => e.type === "wardShattered"), `dmg ${dmg}: wardShattered event`);
    } else {
      assert.equal(state.c.ward.pool, poolAfter, `dmg ${dmg}: ward remaining`);
    }
  }
});

// ─── 5: the pop pool always fades at THIS foe turn's own tail tick ────────

test("foeTurn: a popped pool always fades at the tail of the SAME foe turn it popped in", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe({ wp: 40, maxWP: 40 });
  state.combat = fixedCombat([foe]);
  // to-hit d20(3) hits (need <=5 for a plain foe), dmg 1+d6(4)=5.
  const events = foeTurn(state, fakeRng([3, 4]), []);
  assert.deepEqual(events.map((e) => e.type), ["wardReflected", "wardFaded"]);
  assert.equal(state.c.ward, null);
});

test("foeTurn: an armed mirror survives a foe turn where every swing misses — the tail tick never fades it (rounds stays null)", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  // a huge raw draw mirrors to a deeply negative roll-high face — guaranteed miss.
  const events = foeTurn(state, fakeRng([999]), []);
  assert.deepEqual(events.map((e) => e.type), ["foeMissed"]);
  assert.deepStrictEqual(state.c.ward, ARMED_MIRROR);
});

// ─── 6: ordering — the mirror sits ahead of Hardiness/hide/halfNext/Brace ──

test("applyFoeDamageToPlayer: a mirrored blow leaves halfNext and Brace both still set (the mirror is checked first, so neither buffer is spent)", () => {
  const state = fixedState({ c: { halfNext: true, ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe], { braced: true });
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 10, roll: 18, atLeast: 16, dieN: 20 });
  assert.equal(state.c.halfNext, true);
  assert.equal(state.combat.braced, true);
  assert.ok(events.some((e) => e.type === "wardReflected"));
  assert.equal(events.some((e) => e.type === "damageHalved" || e.type === "braceHeld"), false);
});

// ─── 7: a pursuit strike triggers the mirror too ───────────────────────────

test("flee (Cloaker's free-vanish pursuit strike): the pursuer's parting blow triggers the mirror just like an ordinary swing", () => {
  const state = fixedState({ c: { sub: "Cloaker", ward: { ...ARMED_MIRROR } } });
  const foe = fixedFoe({ sp: { pursues: true }, wp: 40, maxWP: 40 });
  state.combat = fixedCombat([foe], { pending: false, opened2: false });
  const events = flee(state, fakeRng([1, 6]), []);
  assert.ok(events.some((e) => e.type === "wardReflected" && e.mirror === true));
  assert.equal(state.c.wp, 55, "the caster took none of the pursuit strike");
});

// ─── 8: endCombat clears an armed mirror ───────────────────────────────────

test("endCombat clears an armed mirror", () => {
  const state = fixedState({ c: { ward: { ...ARMED_MIRROR } } });
  state.combat = fixedCombat([]);
  endCombat(state, []);
  assert.equal(state.c.ward, null);
});

// ─── 9: Shield is exactly unchanged ─────────────────────────────────────────

test("applyFoeDamageToPlayer: Shield (a plain pool) still absorbs/shatters with no reflect and no mirror pop, exactly as before", () => {
  const state = fixedState({ c: { ward: { pool: 50, rounds: 5, name: "Shield" } } });
  const foe = fixedFoe();
  state.combat = fixedCombat([foe]);
  const events = [];
  applyFoeDamageToPlayer(state, foe, fakeRng([]), events, { dmg: 20, roll: 18, atLeast: 16, dieN: 20 });
  assert.deepEqual(events, [{ type: "wardAbsorbed", amount: 20, remaining: 30 }]);
  assert.equal(state.c.wp, 55);
  assert.equal(state.c.ward.pool, 30);
});

// ─── 10: allyCast never casts a ward kind ──────────────────────────────────

test("bestAttackSpell: a grimoire containing only Bubble yields no attack spell — a member never casts a ward", () => {
  assert.equal(ATTACK_SPELL_KINDS.has("ward"), false);
  const bubble = SPELLS.find((sp) => sp.n === "Bubble");
  assert.equal(isAttackSpell(bubble), false);
  const state = { c: { sub: "Wizard", level: 3, grimoire: ["Bubble"] } };
  assert.equal(bestAttackSpell(state), null);
});

// ─── 11: old-save tolerant load ─────────────────────────────────────────────

test("saveState#rehydrate: an old save's reflecting ward tolerant-loads as the armed mirror; a Shield ward simply loses its stray reflect key", () => {
  const withOldBubble = newRun(1);
  withOldBubble.c.ward = { pool: 100, rounds: 12, reflect: true, name: "Bubble" };
  const outA = rehydrate(withOldBubble);
  assert.deepStrictEqual(outA.c.ward, ARMED_MIRROR);

  const withOldShield = newRun(1);
  withOldShield.c.ward = { pool: 34, rounds: 3, reflect: false, name: "Shield" };
  const outB = rehydrate(withOldShield);
  assert.deepStrictEqual(outB.c.ward, { pool: 34, rounds: 3, name: "Shield" });

  const withNoWard = newRun(1);
  const outC = rehydrate(withNoWard);
  assert.equal(outC.c.ward, withNoWard.c.ward ?? null);
});
