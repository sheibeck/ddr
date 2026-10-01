// test/unit/cutthroat-joiner.test.js
//
// Phase 36 Plan 04 (CUT-01/CUT-02): the Cutthroat's reversed Joiner refusal
// (a Joiner now travels with a Cutthroat like anyone else) and the new
// per-descent murder risk (a natural 1 on a d20, gated on
// `c.sub === "Cutthroat" && state.party?.length`, drawn LAST in descend —
// after checkLevel and genFloor, both of which draw — so the new floor is
// identical with or without the draw and every fixture/bot/pre-Phase-36
// save, none of which is ever a Cutthroat with a party, draws nothing).
//
// Task 1 covers the murder mechanics + narration/line/rail entries while
// the OLD Cutthroat refusal still stands (reachable here only through a
// planted party, since meetJoiner itself still refuses a Cutthroat at this
// point in the plan). Task 2 extends this file with the reversed-refusal
// behaviour once the ternary is flipped.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { swapPartyMember } from "../../engine/state.js";
import { rollCharacter } from "../../engine/character.js";
import { meetJoiner, resolveJoiner } from "../../engine/encounters.js";
import { cutthroatMurderCheck, descend, resolveFeature } from "../../engine/movement.js";
import { makeRng } from "../../engine/rng.js";
import { narrateEvent, EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, FEATURE_EVENTS, PRIORITY, linesForAction } from "../../src/browser/narrationLines.js";
import { RAIL_FAMILY, railCardFor } from "../../src/browser/rail.js";
import { JOINER_MURDER_LINES, SUB_NOTE } from "../../content/flavor.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq`; throws on underflow
 * (doubles as a "no more rng draws expected" assertion). Copied from
 * test/unit/identity-contract.test.js's own helper. */
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

/** countingRng(rng) — wraps any rng, counting every `.d()` call. Copied
 * from test/unit/identity-contract.test.js's own helper. */
function countingRng(rng) {
  let draws = 0;
  return {
    d(sides) {
      draws++;
      return rng.d(sides);
    },
    pick: (...args) => rng.pick(...args),
    shuffle: (...args) => rng.shuffle(...args),
    get draws() {
      return draws;
    },
  };
}

/** hero(sub, race = "Human", seed = 1) — a fresh forced-sub run with
 * combat/pendingJoiner nulled, mirroring identity-contract.test.js's own
 * hero() seam. */
function hero(sub, race = "Human", seed = 1) {
  const state = newRun(seed, [], { force: { sub, race } });
  state.combat = null;
  state.pendingJoiner = null;
  return state;
}

/** plantMember(state, seed) — swaps a full rollCharacter()-shaped sheet
 * into state.party (PARTY_CAP is 1) so cutthroatMurderCheck/descend have a
 * real victim to draw against, without going through meetJoiner (which
 * still refuses a Cutthroat until Task 2). */
function plantMember(state, seed = 99) {
  const member = rollCharacter(makeRng(seed));
  member.lvl = 2;
  member.level = 2;
  member.wp = 40;
  member.maxWP = 40;
  swapPartyMember(state, member);
  return state;
}

/* ============================================================
 * cutthroatMurderCheck(state, rng, events) — pure unit behaviour
 * ============================================================ */

test("cutthroatMurderCheck: a natural 1 murders party[0], pushes joinerMurdered, empties the party", () => {
  const state = plantMember(hero("Cutthroat"));
  const victim = state.party[0];
  const events = cutthroatMurderCheck(state, fakeRng([1]), []);
  assert.deepEqual(
    events.map((e) => e.type),
    ["joinerMurdered"],
  );
  assert.equal(events[0].name, victim.name);
  assert.equal(events[0].sub, victim.sub);
  assert.equal(events[0].depth, state.floor.depth);
  assert.deepEqual(state.party, []);
});

test("cutthroatMurderCheck: 2..10 spares the party (no event, party unchanged, same array length)", () => {
  for (const roll of [2, 10]) {
    const state = plantMember(hero("Cutthroat"));
    const before = state.party[0];
    const events = cutthroatMurderCheck(state, fakeRng([roll]), []);
    assert.deepEqual(events, []);
    assert.equal(state.party.length, 1);
    assert.equal(state.party[0], before);
  }
});

test("cutthroatMurderCheck: a non-Cutthroat with a party draws nothing (fakeRng([]) would throw)", () => {
  const state = plantMember(hero("Soldier"));
  const events = cutthroatMurderCheck(state, fakeRng([]), []);
  assert.deepEqual(events, []);
  assert.equal(state.party.length, 1);
});

test("cutthroatMurderCheck: a Cutthroat with no party draws nothing", () => {
  const state = hero("Cutthroat");
  state.party = [];
  const events = cutthroatMurderCheck(state, fakeRng([]), []);
  assert.deepEqual(events, []);
  assert.deepEqual(state.party, []);
});

test("cutthroatMurderCheck: fail-open on party undefined/null/non-array — no draw, no throw", () => {
  for (const partyValue of [undefined, null, "not-an-array", 5]) {
    const state = hero("Cutthroat");
    state.party = partyValue;
    assert.doesNotThrow(() => {
      const events = cutthroatMurderCheck(state, fakeRng([]), []);
      assert.deepEqual(events, []);
    });
  }
});

/* ============================================================
 * descend() — draw order, gating, and a measured murder-via-descend seed
 * ============================================================ */

test("descend: the murder draw is strictly AFTER genFloor/reveal — new floor identical, cursor differs by exactly one d10", () => {
  const A = plantMember(hero("Cutthroat"));
  const B = structuredClone(A);
  B.party = [];

  const rngA = makeRng(5);
  descend(A, rngA, []);
  const rngB = makeRng(5);
  const eventsB = descend(B, rngB, []);

  // B never draws the murder d10 (no party) — consume exactly one more draw
  // on rngB (standing in for the murder roll A already drew) and the two
  // cursors converge, proving A's extra draw landed strictly after every
  // draw B also made (checkLevel, genFloor).
  rngB.d(10);
  assert.equal(rngA.getState(), rngB.getState());
  assert.deepEqual(A.floor, B.floor, "the new floor is identical with or without the murder draw");
  assert.equal(A.c.sp, B.c.sp);
  assert.deepEqual(
    eventsB.map((e) => e.type),
    ["spGained", "floorChanged"],
    "no murder event for a party-less clone",
  );
});

test("descend: joinerMurdered (when it fires) is the LAST event, after floorChanged", () => {
  // Seed 5 does not happen to roll a natural 1 for this planted party; scan
  // forward for a seed that does (mirrors the measured-seed test below) so
  // this assertion is exercised against a real firing, not just shape.
  let firedSeed = null;
  let firedEvents = null;
  for (let seed = 1; seed <= 200; seed++) {
    const state = plantMember(hero("Cutthroat"));
    const events = descend(state, makeRng(seed), []);
    if (events.some((e) => e.type === "joinerMurdered")) {
      firedSeed = seed;
      firedEvents = events;
      break;
    }
  }
  assert.ok(firedSeed !== null, "expected at least one seed in 1..200 to fire the murder");
  assert.equal(firedEvents[firedEvents.length - 1].type, "joinerMurdered");
  const floorChangedIdx = firedEvents.findIndex((e) => e.type === "floorChanged");
  const murderIdx = firedEvents.findIndex((e) => e.type === "joinerMurdered");
  assert.ok(floorChangedIdx !== -1 && murderIdx > floorChangedIdx, "murder comes after floorChanged");
});

test("descend: zero-draw gate — a non-Cutthroat with a party draws nothing extra", () => {
  const A = plantMember(hero("Cutthroat"));
  const B = structuredClone(A);
  B.party = [];
  const C = structuredClone(A);
  C.c.sub = "Soldier"; // party kept

  const rngB = makeRng(5);
  descend(B, rngB, []);
  const rngC = makeRng(5);
  descend(C, rngC, []);
  assert.equal(rngC.getState(), rngB.getState(), "a non-Cutthroat with a party draws exactly like a Cutthroat with no party");
});

test("descend: zero-draw gate — a Cutthroat with an empty party draws nothing extra", () => {
  const B = plantMember(hero("Cutthroat"));
  B.party = [];
  const D = structuredClone(B);

  const rngB = makeRng(5);
  descend(B, rngB, []);
  const rngD = makeRng(5);
  descend(D, rngD, []);
  assert.equal(rngD.getState(), rngB.getState());
});

test("descend after genFloor: a measured seed fires the murder, empties the party, and the event depth matches the NEW floor", () => {
  let firedSeed = null;
  let firedState = null;
  let firedEvents = null;
  for (let seed = 1; seed <= 200; seed++) {
    const state = plantMember(hero("Cutthroat"));
    const events = descend(state, makeRng(seed), []);
    if (events.some((e) => e.type === "joinerMurdered")) {
      firedSeed = seed;
      firedState = state;
      firedEvents = events;
      break;
    }
  }
  assert.ok(firedSeed !== null, "expected a firing seed in 1..200 (measured, not hand-computed)");
  assert.deepEqual(firedState.party, []);
  const murder = firedEvents.find((e) => e.type === "joinerMurdered");
  assert.equal(murder.depth, firedState.floor.depth);
});

/* ============================================================
 * EVENT_NARRATION.joinerMurdered — deterministic, escaped, reachable
 * ============================================================ */

test("EVENT_NARRATION.joinerMurdered: names the victim, deterministic, every line reachable, escapes markup", () => {
  const line = narrateEvent({ type: "joinerMurdered", name: "Ada Brook", sub: "Guard", depth: 3 });
  assert.ok(line.includes("Ada Brook"));

  const again = narrateEvent({ type: "joinerMurdered", name: "Ada Brook", sub: "Guard", depth: 3 });
  assert.equal(line, again, "same input always yields the same line");

  const seen = new Set();
  for (let depth = 1; depth <= 6; depth++) {
    seen.add(narrateEvent({ type: "joinerMurdered", name: "Ada Brook", sub: "Guard", depth }));
  }
  assert.equal(seen.size, 6, "all six lines are reachable across depths 1..6 for a fixed name");

  const escaped = narrateEvent({ type: "joinerMurdered", name: "<b>Ada</b>", sub: "Guard", depth: 1 });
  assert.ok(escaped.includes("&lt;b&gt;"), `expected escaped name, got: ${escaped}`);
  assert.ok(!escaped.includes("<b>Ada</b>"), "raw markup must not survive");

  assert.doesNotThrow(() => EVENT_NARRATION.joinerMurdered({ type: "joinerMurdered" }));
});

/* ============================================================
 * LINE_FOR.joinerMurdered / FEATURE_EVENTS
 * ============================================================ */

test("LINE_FOR.joinerMurdered: priority feature, tone hurt, names the victim; FEATURE_EVENTS includes it", () => {
  const line = LINE_FOR.joinerMurdered({ type: "joinerMurdered", name: "Ada Brook", sub: "Guard", depth: 3 });
  assert.equal(line.priority, PRIORITY.feature);
  assert.equal(line.tone, "hurt");
  assert.ok(line.text.includes("Ada Brook"));
  assert.ok(FEATURE_EVENTS.includes("joinerMurdered"));
});

/* ============================================================
 * RAIL_FAMILY.joinerMurdered / railCardFor
 * ============================================================ */

test("RAIL_FAMILY.joinerMurdered: COMPANY / bad; railCardFor surfaces the murder sentence as the card's first line", () => {
  assert.deepEqual(RAIL_FAMILY.joinerMurdered, { icon: "◇", title: "COMPANY", tone: "bad" });

  const events = [{ type: "spGained", amount: 70, reason: "descend" }, { type: "floorChanged", depth: 3 }, { type: "joinerMurdered", name: "Ada Brook", sub: "Guard", depth: 3 }];
  const folded = linesForAction("move", events, { narrate: narrateEvent }, { limit: Infinity, withIdx: true });
  const card = railCardFor("move", events, folded, { narrate: narrateEvent });

  assert.ok(card, "expected a rail card");
  assert.equal(card.title, "COMPANY");
  assert.equal(card.tone, "bad");
  assert.ok(card.lines[0].text.includes("Ada Brook"), `expected the murder sentence, got: ${JSON.stringify(card.lines[0])}`);
});

/* ============================================================
 * Task 2 (CUT-01) — the reversed refusal: a Cutthroat is OFFERED a Joiner
 * like anyone else; the Wilmsry-vs-Magic-User refusal is untouched.
 * ============================================================ */

test("meetJoiner: a Cutthroat is offered a Joiner (pendingJoiner set, joinerMet, no joinerRefused); rng cursor matches a Soldier control", () => {
  const cutthroat = hero("Cutthroat");
  const events = meetJoiner(cutthroat, makeRng(555), []);
  assert.ok(cutthroat.pendingJoiner, "pendingJoiner is set for a Cutthroat");
  assert.ok(cutthroat.pendingJoiner.name && cutthroat.pendingJoiner.sub && cutthroat.pendingJoiner.race && cutthroat.pendingJoiner.cls, "a full sheet");
  assert.ok(Number.isFinite(cutthroat.pendingJoiner.lvl) && Number.isFinite(cutthroat.pendingJoiner.level));
  assert.ok(Number.isFinite(cutthroat.pendingJoiner.wp) && Number.isFinite(cutthroat.pendingJoiner.maxWP));
  assert.ok(events.some((e) => e.type === "joinerMet"));
  assert.ok(!events.some((e) => e.type === "joinerRefused"), "no refusal for a Cutthroat anymore");

  const control = hero("Soldier");
  meetJoiner(control, makeRng(555), []);
  assert.deepEqual(cutthroat.c.joiner, control.c.joiner, "the joiner is rolled identically regardless of sub");

  const rngCutthroat = makeRng(555);
  const cutRunner = countingRng(rngCutthroat);
  meetJoiner(hero("Cutthroat"), cutRunner, []);
  const rngSoldier = makeRng(555);
  const solRunner = countingRng(rngSoldier);
  meetJoiner(hero("Soldier"), solRunner, []);
  assert.equal(cutRunner.draws, solRunner.draws, "same draw count (4) either way");
  assert.equal(rngCutthroat.getState(), rngSoldier.getState(), "the next d20 after the call matches the Soldier control");
});

test("meetJoiner: a Wilmsry still refuses a Magic User Joiner (reason wilmsry), pendingJoiner null — unchanged by CUT-01", () => {
  const state = hero("Soldier", "Wilmsry");
  const events = meetJoiner(state, makeRng(1), []);
  assert.equal(state.c.joiner.cls, "Magic User", "pinned seed rolls a Magic User joiner");
  assert.equal(state.pendingJoiner, null);
  const refused = events.find((e) => e.type === "joinerRefused");
  assert.ok(refused);
  assert.equal(refused.reason, "wilmsry");
});

test("full flow: a Cutthroat meets, accepts, then loses the Joiner to a natural 1 on the murder check", () => {
  const state = hero("Cutthroat");
  meetJoiner(state, makeRng(555), []);
  const joinerName = state.pendingJoiner.name;
  const joinerSub = state.pendingJoiner.sub;
  const joinEvents = resolveJoiner(state, true, []);
  assert.equal(state.party.length, 1);
  assert.ok(joinEvents.some((e) => e.type === "joinerJoined"));

  const murderEvents = cutthroatMurderCheck(state, fakeRng([1]), []);
  assert.deepEqual(
    murderEvents.map((e) => e.type),
    ["joinerMurdered"],
  );
  assert.equal(murderEvents[0].name, joinerName);
  assert.equal(murderEvents[0].sub, joinerSub);
  assert.deepEqual(state.party, []);
});

test("identity-contract Cutthroat BAD (new rule): a Cutthroat with an accepted Joiner loses it on a natural 1; a Soldier control keeps it", () => {
  const cutthroat = hero("Cutthroat");
  meetJoiner(cutthroat, makeRng(555), []);
  resolveJoiner(cutthroat, true, []);
  assert.equal(cutthroat.party.length, 1);
  const events = cutthroatMurderCheck(cutthroat, fakeRng([1]), []);
  assert.ok(events.some((e) => e.type === "joinerMurdered"));
  assert.equal(cutthroat.party.length, 0);

  const control = hero("Soldier");
  meetJoiner(control, makeRng(555), []);
  resolveJoiner(control, true, []);
  assert.equal(control.party.length, 1);
  const controlEvents = cutthroatMurderCheck(control, fakeRng([]), []);
  assert.deepEqual(controlEvents, []);
  assert.equal(control.party.length, 1, "a non-Cutthroat never loses the Joiner to this check");
});

test("LINE_FOR.joinerRefused: wilmsry text differs from the generic fallback; SUB_NOTE.Cutthroat states the odds and the new blurb", () => {
  const wilmsryText = LINE_FOR.joinerRefused({ type: "joinerRefused", reason: "wilmsry" }).text;
  const fallbackText = LINE_FOR.joinerRefused({ type: "joinerRefused", reason: "definitelyNotAReason" }).text;
  assert.notEqual(wilmsryText, fallbackText);

  assert.match(SUB_NOTE.Cutthroat, /one descent in ten/i);
  assert.match(SUB_NOTE.Cutthroat, /first landed blow/i);
  assert.doesNotMatch(SUB_NOTE.Cutthroat, /no Joiner will ever/i);
});

/* ============================================================
 * Phase 91 plan 08 (IDENT-19, user 2026-09-30): "whenever you descend with a
 * Joiner, roll a d10; on a 1 that Joiner dies (replaces one-in-twenty)."
 * ============================================================ */

/** sidesRng(value) — records every `.d(sides)` request and answers `value`. */
function sidesRng(value) {
  const sides = [];
  return { sides, d: (n) => (sides.push(n), value), pick: (a) => a[0], shuffle: (a) => a };
}

test("IDENT-19: the check rolls ONE d10 (not a d20): a 1 kills the Joiner and says dieN 10; 2 to 10 spare it", () => {
  const killed = plantMember(hero("Cutthroat"));
  const r1 = sidesRng(1);
  const events = cutthroatMurderCheck(killed, r1, []);
  assert.deepEqual(r1.sides, [10], "one die, ten sides");
  assert.deepEqual(events.map((e) => e.type), ["joinerMurdered"]);
  assert.equal(events[0].roll, 1);
  assert.equal(events[0].atLeast, 2);
  assert.equal(events[0].dieN, 10);
  assert.deepEqual(killed.party, []);
  for (let roll = 2; roll <= 10; roll++) {
    const spared = plantMember(hero("Cutthroat"));
    const r = sidesRng(roll);
    assert.deepEqual(cutthroatMurderCheck(spared, r, []), [], `roll ${roll}`);
    assert.deepEqual(r.sides, [10]);
    assert.equal(spared.party.length, 1);
  }
});

test("IDENT-19: over a real stream the d10 kills about one descent in ten, not one in twenty", () => {
  let kills = 0;
  const N = 4000;
  const rng = makeRng(2026);
  for (let i = 0; i < N; i++) {
    const state = plantMember(hero("Cutthroat"));
    if (cutthroatMurderCheck(state, rng, []).length) kills++;
  }
  assert.ok(kills / N > 0.08 && kills / N < 0.12, `kill rate ${kills / N} is about 1 in 10`);
});

test("IDENT-19: every descent with a Joiner rolls: the stairs and a legacy gate tile each draw one die, last", () => {
  for (const feat of ["exit", "gate"]) {
    const withJoiner = plantMember(hero("Cutthroat"));
    const without = structuredClone(withJoiner);
    without.party = [];
    const ra = makeRng(31);
    const rb = makeRng(31);
    resolveFeature(withJoiner, { feat }, ra, []);
    resolveFeature(without, { feat }, rb, []);
    rb.d(10); // the one extra draw the Joiner's descent made, after every other draw
    assert.equal(ra.getState(), rb.getState(), `${feat}: one extra draw, after every other draw`);
  }
});

test("IDENT-19: the lost Joiner is named in its own narrated line, and only the exact sub key 'Cutthroat' rolls", () => {
  const state = plantMember(hero("Cutthroat"));
  const name = state.party[0].name;
  const events = cutthroatMurderCheck(state, fakeRng([1]), []);
  assert.ok(narrateEvent(events[0]).includes(name), "the Oracle line names the Joiner");
  assert.ok(LINE_FOR.joinerMurdered(events[0]).text.includes(name), "the rail twin names the Joiner");
  for (const sub of ["cutthroat", " Cutthroat", "Cutthroat "]) {
    const other = plantMember(hero("Soldier"));
    other.c.sub = sub;
    assert.deepEqual(cutthroatMurderCheck(other, fakeRng([]), []), [], JSON.stringify(sub));
    assert.equal(other.party.length, 1);
  }
});
