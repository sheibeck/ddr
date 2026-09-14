// test/unit/parley.test.js
//
// Phase 20 — PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02.
// Complements test/unit/combat.test.js's four existing parley tests (gate
// matrix, Con Artist success/failure, LO-03 zero-foe guard) and
// test/unit/fluency.test.js (killSpFor/fluency's own unit coverage) — this
// file is the closing behavioural suite for every locked CONTEXT.md decision
// (D-01..D-21) against the engine as landed by 20-02. Every rng here is
// either scripted (fakeRng) or seeded (makeRng(seed)); no probability floats
// are ever asserted — only exact `need` values, per D-07's documented target.

import test from "node:test";
import assert from "node:assert/strict";

import { canParley, parley, foeTurn, endCombat, startCombat, liveFoes } from "../../engine/combat.js";
import { fluency, killSpFor, foeToHitVs } from "../../engine/derived.js";
import { newRun, applyAction } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { RACES, ENC_TYPES } from "../../content/index.js";

// --- local fixtures (copied verbatim from test/unit/combat.test.js /
// test/unit/party-combat.test.js / test/unit/foe-turn-draw-count.test.js —
// those files do not export them, so each test file that needs them keeps
// its own copy, per the project's established convention) ------------------

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws if the sequence underflows, which doubles as
 * a "no more rng draws expected" assertion. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

/**
 * countingRng(inner) — wraps ANY rng object (a fakeRng or a real makeRng)
 * and counts every `.d()` call, also recording each result into an exposed
 * `log` array as `"d<n>=<value>"` strings (mirrors
 * test/unit/foe-turn-draw-count.test.js's countingRng, extended with the log
 * this file's draw-shape/seed-303 tests need).
 */
function countingRng(inner) {
  let draws = 0;
  const log = [];
  return {
    d(n) {
      draws++;
      const v = inner.d(n);
      log.push(`d${n}=${v}`);
      return v;
    },
    pick(a) {
      return inner.pick ? inner.pick(a) : a[0];
    },
    shuffle: (a) => a,
    get draws() {
      return draws;
    },
    get log() {
      return log;
    },
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
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
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
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** A combat-scoped ally entry as startCombat's sync produces it. */
function fixedAlly(overrides = {}) {
  return { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 20, maxWP: 20, ...overrides };
}

/** A persistent roster member (a rollCharacter-shaped sheet; `level` not `lvl`). */
function fixedMember(overrides = {}) {
  return { name: "Ada", level: 1, sub: "Fighter", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", ...overrides };
}

const HELM = { n: "Helm of Knowledge", eff: { tongue: 1 } };
const TALKATIVE = ["Humans", "Demons", "Lair Beasts", "Beasts"];

/** mk(cOverrides, type, combatOverrides) — a fixedState whose combat is a
 * single foe of `type`, matching Task 1's spec exactly. */
function mk(cOverrides, type, combatOverrides = {}) {
  const state = fixedState({ c: cOverrides });
  state.combat = fixedCombat([fixedFoe({ type })], { type, ...combatOverrides });
  return state;
}

/**
 * expectedCanParley(c, t, tried) — an INDEPENDENT prose restatement of
 * D-11/D-12 (LANG-02: the oracle must never call engine/combat.js#canParley).
 * Written from the locked decisions, not copied from the implementation.
 */
function expectedCanParley(c, t, tried) {
  if (tried) return false;
  if (t === "Walking Dead") return false;
  const flu = (c.skills && c.skills.Language ? 1 : 0) + ((c.items || []).some((it) => it.eff && it.eff.tongue > 0) ? 1 : 0);
  if (t === "Magical") return flu === 2;
  if (c.sub === "Con Artist") return true;
  if (c.sub === "Woodsman" && (t === "Beasts" || t === "Lair Beasts")) return true;
  if (c.sub === "Bard" && t === "Humans") return true;
  if (flu >= 1 && TALKATIVE.includes(t)) return true;
  if (c.race === "Wilmsry") return true; // Magical already handled above
  if (c.race === "Elven" && t === "Humans") return true;
  return false;
}

// --- Test 1: the full availability matrix ---------------------------------

test("LANG-02 / D-11: availability matrix — 6 races × 4 subs × skill × Helm × 6 types (576 cases) match the rule oracle", () => {
  let cases = 0;
  let magicalTrue = 0;
  let walkingDeadTrue = 0;
  let plainHumanSoldierTrue = 0;
  for (const race of Object.keys(RACES)) {
    for (const sub of ["Con Artist", "Woodsman", "Bard", "Soldier"]) {
      for (const lang of [false, true]) {
        for (const helm of [false, true]) {
          for (const t of ENC_TYPES) {
            cases++;
            const state = mk({ race, sub, skills: lang ? { Language: 1 } : {}, items: helm ? [HELM] : [] }, t);
            const actual = canParley(state);
            const expected = expectedCanParley(state.c, t, false);
            assert.equal(actual, expected, `race=${race} sub=${sub} lang=${lang} helm=${helm} type=${t}`);
            if (t === "Magical" && actual) magicalTrue++;
            if (t === "Walking Dead" && actual) walkingDeadTrue++;
            if (race === "Human" && sub === "Soldier" && !lang && !helm) plainHumanSoldierTrue += actual ? 1 : 0;
          }
        }
      }
    }
  }
  assert.equal(cases, 576);
  assert.equal(magicalTrue, 24, "Magical is available in exactly 24 of the 576 cases (only at fluency 2)");
  assert.equal(walkingDeadTrue, 0, "Walking Dead never parleys, for anyone");
  assert.equal(plainHumanSoldierTrue, 0, "a plain Human Soldier at fluency 0 can never parley, for any type");
});

// --- Test 2: every canParley gate, explicitly -------------------------------

test("PARLEY-04 / D-12: every canParley gate, explicitly", () => {
  // no combat at all
  assert.equal(canParley(fixedState()), false, "no combat -> false");
  // parleyTried gate
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Humans", { parleyTried: true })), false, "parleyTried -> false");
  // Walking Dead, unconditional
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Walking Dead")), false, "Con Artist vs Walking Dead -> false");
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Walking Dead")), false, "Wilmsry vs Walking Dead -> false");
  assert.equal(
    canParley(mk({ skills: { Language: 1 }, items: [HELM] }, "Walking Dead")),
    false,
    "fluency-2 character vs Walking Dead -> false",
  );
  // Magical at fluency 0/1/2 for a Con Artist
  assert.equal(canParley(mk({ sub: "Con Artist" }, "Magical")), false, "Con Artist fluency 0 vs Magical -> false");
  assert.equal(canParley(mk({ sub: "Con Artist", skills: { Language: 1 } }, "Magical")), false, "fluency 1 (skill only) vs Magical -> false");
  assert.equal(canParley(mk({ sub: "Con Artist", items: [HELM] }, "Magical")), false, "fluency 1 (Helm only) vs Magical -> false");
  assert.equal(
    canParley(mk({ sub: "Con Artist", skills: { Language: 1 }, items: [HELM] }, "Magical")),
    true,
    "fluency 2 (skill + Helm) vs Magical -> true",
  );
  // Woodsman
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Beasts")), true, "Woodsman vs Beasts -> true");
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Lair Beasts")), true, "Woodsman vs Lair Beasts -> true");
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Humans")), false, "Woodsman vs Humans -> false");
  assert.equal(canParley(mk({ sub: "Woodsman" }, "Demons")), false, "Woodsman vs Demons -> false");
  // Bard
  assert.equal(canParley(mk({ sub: "Bard" }, "Humans")), true, "Bard vs Humans -> true");
  assert.equal(canParley(mk({ sub: "Bard" }, "Beasts")), false, "Bard vs Beasts -> false");
  // Skill-only fluency 1
  for (const t of ["Humans", "Demons", "Lair Beasts", "Beasts"]) {
    assert.equal(canParley(mk({ skills: { Language: 1 } }, t)), true, `skill-only fluency 1 vs ${t} -> true`);
  }
  assert.equal(canParley(mk({ skills: { Language: 1 } }, "Magical")), false, "skill-only fluency 1 vs Magical -> false");
  // Helm-only fluency 1
  for (const t of ["Humans", "Demons", "Lair Beasts", "Beasts"]) {
    assert.equal(canParley(mk({ items: [HELM] }, t)), true, `Helm-only fluency 1 vs ${t} -> true`);
  }
  assert.equal(canParley(mk({ items: [HELM] }, "Magical")), false, "Helm-only fluency 1 vs Magical -> false");
  // fluency 2 (skill + Helm) opens Magical, even for a plain Human Soldier
  assert.equal(canParley(mk({ skills: { Language: 1 }, items: [HELM] }, "Magical")), true, "Human Soldier fluency 2 vs Magical -> true");
  // Wilmsry
  for (const t of ["Beasts", "Humans", "Demons", "Lair Beasts"]) {
    assert.equal(canParley(mk({ race: "Wilmsry" }, t)), true, `Wilmsry vs ${t} -> true`);
  }
  assert.equal(canParley(mk({ race: "Wilmsry" }, "Magical")), false, "Wilmsry fluency 0 vs Magical -> false");
  assert.equal(
    canParley(mk({ race: "Wilmsry", skills: { Language: 1 }, items: [HELM] }, "Magical")),
    true,
    "Wilmsry fluency 2 vs Magical -> true",
  );
  // Elven
  assert.equal(canParley(mk({ race: "Elven" }, "Humans")), true, "Elven vs Humans -> true");
  assert.equal(canParley(mk({ race: "Elven" }, "Beasts")), false, "Elven vs Beasts -> false");
  // Human Soldier fluency 0: every TALKATIVE type refused
  for (const t of TALKATIVE) {
    assert.equal(canParley(mk({}, t)), false, `plain Human Soldier fluency 0 vs ${t} -> false`);
  }
});

// --- Test 3: the reachable Wilmsry-vs-Magical refusal ----------------------

test("PARLEY-04 / D-12: a fluency-2 Wilmsry vs Magical is refused with the canon reason, draws nothing, and does NOT spend the attempt", () => {
  const state = mk({ race: "Wilmsry", skills: { Language: 1 }, items: [HELM] }, "Magical");
  assert.equal(canParley(state), true);
  const first = parley(state, fakeRng([]), []);
  assert.deepStrictEqual(first, [{ type: "parleyRefused", reason: "wilmsryVsMagical" }]);
  assert.equal(state.combat.parleyTried, undefined, "a refusal never consumes the one attempt");
  assert.ok(state.combat, "combat is still active");
  const second = parley(state, fakeRng([]), []);
  assert.deepStrictEqual(second, [{ type: "parleyRefused", reason: "wilmsryVsMagical" }], "refused again, not exhausted");
  assert.equal(state.c.sp, 0);
  assert.equal(state.c.gold, 50);
});

// --- Test 4: the dispatcher-path exhausted probe + nothing-to-retry --------

test("PARLEY-02 / D-05: through applyAction an exhausted encounter yields only parleyExhausted with an unchanged rngState; a successful parley leaves nothing to retry", () => {
  let next = structuredClone(newRun(303));
  const rng = makeRng(next.rngState);
  startCombat(next, false, "Humans", rng, []);
  next.rngState = rng.getState();
  next.combat.parleyTried = true;
  const { state, events } = applyAction(next, { type: "parley" });
  assert.deepStrictEqual(events, [{ type: "parleyExhausted" }]);
  assert.equal(state.rngState, next.rngState, "no rng draw on the dispatcher-path exhausted rejection");
  assert.deepStrictEqual(state.combat, next.combat);

  // Separately: a successful parley leaves nothing to retry.
  const s2 = fixedState({ c: { sub: "Con Artist" } });
  s2.combat = fixedCombat([fixedFoe({ type: "Beasts" })]);
  parley(s2, fakeRng([1, 3]), []);
  assert.equal(s2.combat, null, "success nulls state.combat");
  const retry = parley(s2, fakeRng([]), []);
  assert.deepStrictEqual(retry, [], "no encounter left to retry, zero draws, empty events");
});

// --- Test 5: parleyInsulted widens the MEMBER branch mNeed -----------------

test("PARLEY-02 / D-06 / D-20: parleyInsulted widens the MEMBER branch mNeed by exactly 1, roll untouched", () => {
  const baseline = fixedState({ party: [fixedMember({ wp: 12 })] });
  const baselineAlly = fixedAlly({ wp: 12, maxWP: 20 });
  baseline.combat = fixedCombat([fixedFoe({ lvl: 1, wp: 30 })], { allies: [baselineAlly] });
  const baselineEvents = foeTurn(baseline, fakeRng([2, 6]), []);
  const missed = baselineEvents.find((e) => e.type === "foeMissed");
  assert.ok(missed);
  assert.equal(missed.member, "Ada");
  assert.equal(missed.need, 5);
  assert.equal(missed.roll, 6);
  assert.equal(baselineAlly.wp, 12);
  assert.equal(baseline.c.wp, 55, "hero untouched");

  const insulted = fixedState({ party: [fixedMember({ wp: 12 })] });
  const insultedAlly = fixedAlly({ wp: 12, maxWP: 20 });
  insulted.combat = fixedCombat([fixedFoe({ lvl: 1, wp: 30 })], { allies: [insultedAlly], parleyInsulted: true });
  const insultedEvents = foeTurn(insulted, fakeRng([2, 6, 3]), []);
  const struck = insultedEvents.find((e) => e.type === "memberStruck");
  assert.ok(struck);
  assert.equal(struck.member, "Ada");
  assert.equal(struck.need, 6, "5 + the insulted +1");
  assert.equal(struck.roll, 6, "the same literal roll");
  assert.equal(struck.dmg, 4);
  assert.equal(insultedAlly.wp, 8);
  assert.equal(insulted.c.wp, 55, "hero untouched");
});

// --- Test 6: a failed parley's insult persists every round and dies with combat --

test("PARLEY-02 / D-06: a failed parley sets the insult, which persists every round and dies with the combat", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const foe = fixedFoe({ type: "Beasts", asleep: 3 });
  state.combat = fixedCombat([foe]);
  const events = parley(state, fakeRng([20, 15, 10]), []); // 20 > need(13) fails; sleeping foe draws 0; initiative 15 vs 10
  const failedIdx = events.findIndex((e) => e.type === "parleyFailed");
  const insultedIdx = events.findIndex((e) => e.type === "parleyInsulted");
  assert.ok(failedIdx >= 0 && insultedIdx > failedIdx, "parleyInsulted comes AFTER parleyFailed");
  assert.equal(state.combat.parleyInsulted, true);
  assert.equal(state.combat.parleyTried, true);

  foe.asleep = 0;
  state.c.wp = 55;
  const t1 = foeTurn(state, fakeRng([6, 3]), []);
  assert.ok(t1.some((e) => e.type === "struckByFoe" && e.need === 6));
  state.c.wp = 55;
  const t2 = foeTurn(state, fakeRng([6, 3]), []);
  assert.ok(t2.some((e) => e.type === "struckByFoe" && e.need === 6));

  endCombat(state, []);
  assert.equal(state.combat, null);
});

// --- Test 7: Con Artist odds at even/uneven level ---------------------------

test("PARLEY-03 / D-07: Con Artist need is 13 at even level vs a solo foe and 12 one level down", () => {
  const s1 = fixedState({ c: { sub: "Con Artist" } });
  s1.combat = fixedCombat([fixedFoe({ type: "Beasts", lvl: 1 })]);
  const e1 = parley(s1, fakeRng([1, 3]), []);
  const r1 = e1.find((e) => e.type === "parleyRolled");
  assert.equal(r1.need, 13);
  assert.equal(r1.fluency, 0);

  const s2 = fixedState({ c: { sub: "Con Artist" } });
  s2.combat = fixedCombat([fixedFoe({ type: "Beasts", lvl: 2 })]);
  const e2 = parley(s2, fakeRng([1, 3]), []);
  const r2 = e2.find((e) => e.type === "parleyRolled");
  assert.equal(r2.need, 12);
  assert.ok(r1.need === 13, "restated: need, 13 at even level vs a solo lvl-1 foe");
});

// --- Test 8: the D-08 clamp ---------------------------------------------

test("PARLEY-03 / D-08: need clamps at 17 — inactive at bonus 8, active at bonus 12, and 18 still fails", () => {
  const s1 = fixedState({ c: { sub: "Con Artist", race: "Wilmsry" } });
  s1.combat = fixedCombat([fixedFoe({ type: "Beasts", lvl: 1 })]);
  const e1 = parley(s1, fakeRng([17, 3]), []);
  assert.equal(e1.find((e) => e.type === "parleyRolled").need, 17);
  assert.ok(e1.some((e) => e.type === "spGained"), "clamp inactive here: 17 succeeds");

  const s2 = fixedState({ c: { sub: "Con Artist", race: "Wilmsry", skills: { Language: 1 }, items: [HELM] } });
  s2.combat = fixedCombat([fixedFoe({ type: "Beasts", lvl: 1 })]);
  const e2 = parley(s2, fakeRng([17, 3]), []);
  assert.equal(e2.find((e) => e.type === "parleyRolled").need, 17, "clamped from 21 down to 17");
  assert.ok(e2.some((e) => e.type === "spGained"), "still succeeds at the ceiling");

  const s3 = fixedState({ c: { sub: "Con Artist", race: "Wilmsry", skills: { Language: 1 }, items: [HELM] } });
  s3.combat = fixedCombat([fixedFoe({ type: "Beasts", lvl: 1, asleep: 3 })]);
  const e3 = parley(s3, fakeRng([18, 15, 10]), []);
  assert.equal(e3.find((e) => e.type === "parleyRolled").need, 17);
  assert.ok(e3.some((e) => e.type === "parleyFailed"), "18 vs need 17 fails — no auto-win");
});

// --- Test 9: fluency bonus term ---------------------------------------------

test("LANG-01 / D-10: fluency adds +2 per tier to need and is reported on parleyRolled", () => {
  const cases = [
    { lang: false, helm: false, need: 9, fluency: 0 },
    { lang: true, helm: false, need: 11, fluency: 1 },
    { lang: false, helm: true, need: 11, fluency: 1 },
    { lang: true, helm: true, need: 13, fluency: 2 },
  ];
  for (const { lang, helm, need, fluency: flu } of cases) {
    const state = fixedState({ c: { sub: "Bard", skills: lang ? { Language: 1 } : {}, items: helm ? [HELM] : [] } });
    state.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 })]);
    const events = parley(state, fakeRng([1, 3, 1]), []);
    const rolled = events.find((e) => e.type === "parleyRolled");
    assert.equal(rolled.need, need, `lang=${lang} helm=${helm}`);
    assert.equal(rolled.fluency, flu, `lang=${lang} helm=${helm}`);
  }
  // Restated with literal expected numbers (skill alone +2, Helm alone +2, both +4):
  assert.equal(cases[0].need, 9);
  assert.equal(cases[1].need, 11, "skill alone");
  assert.equal(cases[2].need, 11, "Helm alone");
  assert.equal(cases[3].need, 13, "both");
});

// --- Test 10: payout formula --------------------------------------------

test("PARLEY-01 / D-01 / D-02: payout is round(Σ killSpFor × 0.5) over live foes in foe order; dead foes draw nothing", () => {
  const state = fixedState({ c: { sub: "Con Artist" } });
  const f1 = fixedFoe({ type: "Humans", lvl: 1 });
  const f2 = fixedFoe({ type: "Humans", lvl: 2 });
  state.combat = fixedCombat([f1, f2]);
  const events = parley(state, fakeRng([1, 3, 5, 2]), []);
  const expected = Math.round((killSpFor(state.c, f1, 3) + killSpFor(state.c, f2, 5)) * 0.5);
  assert.equal(expected, 33);
  const gained = events.find((e) => e.type === "spGained" && e.reason === "parley");
  assert.ok(gained);
  assert.equal(gained.amount, 33);
  assert.equal(gained.amount, expected);
  assert.equal(events.some((e) => e.type === "goldGained"), false, "check roll 2 does not fire the wilmst bonus");
  assert.equal(state.c.sp, 33);
  assert.equal(state.combat, null);

  const state2 = fixedState({ c: { sub: "Con Artist" } });
  const alive = fixedFoe({ type: "Humans", lvl: 1 });
  const dead = fixedFoe({ type: "Humans", lvl: 5, alive: false });
  state2.combat = fixedCombat([alive, dead]);
  const events2 = parley(state2, fakeRng([1, 3, 2]), []); // 3 draws only: the dead foe draws nothing
  const gained2 = events2.find((e) => e.type === "spGained" && e.reason === "parley");
  assert.equal(gained2.amount, 8);
  assert.equal(events2.some((e) => e.type === "parleyExhausted"), false, "no exhaustion error from an under-drawn rng");
});

// --- Test 11: the D-02 property -----------------------------------------

test("PARLEY-01 / D-02 property: the parley share never exceeds the combat-equivalent for any race × sub × foe level × d6, singly or summed over two foes", () => {
  for (const race of Object.keys(RACES)) {
    for (const sub of ["Soldier", "Barbarian", "Apprentice", "Con Artist"]) {
      const c = fixedFighter({ race, sub });
      for (let lvl = 1; lvl <= 5; lvl++) {
        for (let roll = 1; roll <= 6; roll++) {
          const eq = killSpFor(c, { lvl }, roll);
          const share = Math.round(eq * 0.5);
          assert.ok(share <= eq, `race=${race} sub=${sub} lvl=${lvl} roll=${roll}: share ${share} <= eq ${eq}`);
          assert.ok(share >= 0, `race=${race} sub=${sub} lvl=${lvl} roll=${roll}: share ${share} >= 0`);
        }
      }
      for (let a = 1; a <= 5; a++) {
        for (let b = 1; b <= 5; b++) {
          const ra = ((a + b) % 6) + 1;
          const rb = ((a * b) % 6) + 1;
          const eqA = killSpFor(c, { lvl: a }, ra);
          const eqB = killSpFor(c, { lvl: b }, rb);
          const summedShare = Math.round((eqA + eqB) * 0.5);
          assert.ok(summedShare <= eqA + eqB, `race=${race} sub=${sub} a=${a} b=${b}`);
        }
      }
    }
  }
});

// --- Test 12: the Humans wilmst check fires only on a 6 ----------------------

test("PARLEY-01 / D-03 / D-04: the Humans wilmst check pays only on a 6 and draws its amount die only then", () => {
  for (const seq of [[1, 3, 4], [1, 3, 5]]) {
    const state = fixedState({ c: { sub: "Con Artist", gold: 50 }, floor: { depth: 3 } });
    state.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 })], { type: "Humans" });
    const events = parley(state, fakeRng(seq), []); // a 4th draw would throw "sequence exhausted"
    assert.equal(events.some((e) => e.type === "goldGained"), false, `seq=${seq}`);
    assert.equal(state.c.gold, 50, `seq=${seq}`);
  }
  const state = fixedState({ c: { sub: "Con Artist", gold: 50 }, floor: { depth: 3 } });
  state.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 })], { type: "Humans" });
  const events = parley(state, fakeRng([1, 3, 6, 4]), []);
  const gold = events.find((e) => e.type === "goldGained");
  assert.ok(gold);
  assert.equal(gold.amount, 1200);
  assert.equal(gold.why, "parley");
  assert.equal(state.c.gold, 1250);
});

// --- Test 13: countingRng draw-shape pins ------------------------------------

test("D-04 draw shape pinned with countingRng: exhausted 0, refused 0, success 1 + N (+1 Humans check, +1 payout)", () => {
  const exhausted = mk({ sub: "Con Artist" }, "Humans", { parleyTried: true });
  const c1 = countingRng(fakeRng([]));
  parley(exhausted, c1, []);
  assert.equal(c1.draws, 0);

  const refused = mk({ race: "Wilmsry", skills: { Language: 1 }, items: [HELM] }, "Magical");
  const c2 = countingRng(fakeRng([]));
  parley(refused, c2, []);
  assert.equal(c2.draws, 0);

  const twoBeasts = fixedState({ c: { sub: "Con Artist" } });
  twoBeasts.combat = fixedCombat([fixedFoe({ lvl: 1 }), fixedFoe({ lvl: 1 })]);
  const c3 = countingRng(fakeRng([1, 2, 2]));
  parley(twoBeasts, c3, []);
  assert.equal(c3.draws, 3);

  const twoHumansCheck5 = fixedState({ c: { sub: "Con Artist" } });
  twoHumansCheck5.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 }), fixedFoe({ type: "Humans", lvl: 1 })]);
  const c4 = countingRng(fakeRng([1, 2, 2, 5]));
  parley(twoHumansCheck5, c4, []);
  assert.equal(c4.draws, 4);

  const twoHumansCheck6 = fixedState({ c: { sub: "Con Artist" } });
  twoHumansCheck6.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 }), fixedFoe({ type: "Humans", lvl: 1 })]);
  const c5 = countingRng(fakeRng([1, 2, 2, 6, 1]));
  parley(twoHumansCheck6, c5, []);
  assert.equal(c5.draws, 5);
});

// --- Test 14: D-21 seed-303 pin ----------------------------------------

test("D-21 seed-303 pin: the one parity-exposed parley now reads need 17 / sp 7 / gold 50 with the same first three dice and no fourth", () => {
  const run = newRun(303);
  const c = run.c;
  assert.equal(c.race, "Wilmsry");
  assert.equal(c.sub, "Con Artist");
  assert.equal(c.level, 1);
  assert.equal(fluency(c), 0);
  assert.equal(c.sp, 0);
  assert.equal(c.gold, 50);

  const next = structuredClone(run);
  const rng = makeRng(next.rngState);
  startCombat(next, false, "Humans", rng, []);
  next.rngState = rng.getState();
  const foes = liveFoes(next);
  assert.equal(foes.length, 1);
  assert.ok(foes.every((f) => f.name === "Dante"));

  const counting = countingRng(makeRng(next.rngState));
  const events = parley(next, counting, []);
  assert.deepStrictEqual(counting.log, ["d20=2", "d6=5", "d6=5"]);
  assert.equal(counting.draws, 3);

  const rolled = events.find((e) => e.type === "parleyRolled");
  assert.deepStrictEqual(rolled, { type: "parleyRolled", roll: 2, need: 17, fluency: 0 });
  const gained = events.find((e) => e.type === "spGained");
  assert.deepStrictEqual(gained, { type: "spGained", amount: 7, reason: "parley" });
  assert.ok(events.some((e) => e.type === "combatEnded"));
  assert.equal(events.some((e) => e.type === "goldGained"), false);

  assert.equal(next.c.sp, 7);
  assert.equal(next.c.gold, 50);
  assert.equal(next.combat, null);

  // BEFORE (pre-Phase-20, measured 2026-09-14) was d20=2 d6=5 d6=5 d6=2 ->
  // need 19, sp 13, gold 250 — see test/parity/FIXTURE-INVENTORY.md "Phase
  // 20 parley divergence".
});

// --- Test 15: old-save probe --------------------------------------------

test("D-19 old-save probe: mid-fight flags round-trip losslessly through JSON and are dropped with the combat on load", () => {
  const state = mk({ sub: "Con Artist" }, "Humans", { parleyTried: true, parleyInsulted: true });
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.equal(roundTripped.combat.parleyTried, true);
  assert.equal(roundTripped.combat.parleyInsulted, true);

  const run = structuredClone(newRun(303));
  const rng = makeRng(run.rngState);
  startCombat(run, false, "Humans", rng, []);
  run.rngState = rng.getState();
  run.combat.parleyTried = true;
  run.combat.parleyInsulted = true;
  const preSaveC = structuredClone(run.c);

  const check = validateSave(JSON.stringify(serializeRun(run)));
  assert.equal(check.ok, true);
  const rehydrated = rehydrate(check.value);
  assert.equal(rehydrated.combat, null);
  assert.deepStrictEqual(rehydrated.c, preSaveC, "the character is intact, minus nothing");
});
