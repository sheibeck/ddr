// test/unit/dismiss-joiner.test.js
//
// Phase 36 Plan 05 (JOIN-01): the engine half of dismissing a Joiner from
// the Hero tab's Company panel — a new no-rng engine action `dismissJoiner`
// (registered beside `resolveJoiner`) that removes the member (by index,
// default 0) and pushes `joinerDismissed { name, sub }`, refusing with a
// named reason (`dismissRefused { reason }`) when the party is empty, a
// fight is in progress, or the index is out of range; plus the
// presentation-table half — the parting line as its own event with
// EVENT_NARRATION/toast-table/rail entries.

import test from "node:test";
import assert from "node:assert/strict";

import { applyAction, newRun } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";
import { dismissJoiner } from "../../engine/encounters.js";
import { swapPartyMember } from "../../engine/state.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";
import { narrateEvent, EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { TOAST_FOR, FEATURE_EVENTS, PRIORITY, toastsForAction } from "../../src/browser/toasts.js";
import { RAIL_FAMILY, railCardFor } from "../../src/browser/rail.js";
import { JOINER_PARTING_LINES } from "../../content/flavor.js";

/** hero(seed) — a fresh run with combat/pendingJoiner nulled, mirroring
 * cutthroat-joiner.test.js's own hero() seam. */
function hero(seed = 1) {
  const state = newRun(seed);
  state.combat = null;
  state.pendingJoiner = null;
  return state;
}

/** plantMember(state, seed) — swaps a full rollCharacter()-shaped sheet into
 * state.party (PARTY_CAP is 1) without going through meetJoiner. Copied
 * from cutthroat-joiner.test.js's own plantMember(). */
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
 * dismissJoiner(state, i, events) — pure unit behaviour
 * ============================================================ */

test("dismissJoiner: removes party[0] by default, pushes joinerDismissed with name/sub, party becomes []", () => {
  const state = plantMember(hero());
  const victim = { ...state.party[0] };
  const events = dismissJoiner(state, 0, []);
  assert.deepEqual(state.party, []);
  assert.deepEqual(events, [{ type: "joinerDismissed", name: victim.name, sub: victim.sub }]);
});

test("dismissJoiner: i omitted defaults to 0, identical to explicit i=0", () => {
  const stateA = plantMember(hero());
  const stateB = plantMember(hero());
  const eventsA = dismissJoiner(stateA, 0, []);
  const eventsB = dismissJoiner(stateB, undefined, []);
  assert.deepEqual(eventsA, eventsB);
  assert.deepEqual(stateA.party, stateB.party);
});

test("dismissJoiner: empty party refuses noParty, no mutation", () => {
  const state = hero();
  state.party = [];
  const before = structuredClone(state.party);
  const events = dismissJoiner(state, 0, []);
  assert.deepEqual(events, [{ type: "dismissRefused", reason: "noParty" }]);
  assert.deepEqual(state.party, before);
});

test("dismissJoiner: undefined/null/non-array party fails open to noParty, no throw, no key injected", () => {
  for (const bad of [undefined, null, "not-an-array", 42]) {
    const state = hero();
    state.party = bad;
    const events = dismissJoiner(state, 0, []);
    assert.deepEqual(events, [{ type: "dismissRefused", reason: "noParty" }]);
    assert.equal(state.party, bad, "party is left untouched, not replaced with []");
  }
});

test("dismissJoiner: combat in progress refuses inCombat FIRST, party untouched", () => {
  const state = plantMember(hero());
  state.combat = { pending: false };
  const before = structuredClone(state.party);
  const events = dismissJoiner(state, 0, []);
  assert.deepEqual(events, [{ type: "dismissRefused", reason: "inCombat" }]);
  assert.deepEqual(state.party, before);
});

test("dismissJoiner: out-of-range index refuses badIndex, party untouched", () => {
  const state = plantMember(hero());
  const before = structuredClone(state.party);
  const events = dismissJoiner(state, 3, []);
  assert.deepEqual(events, [{ type: "dismissRefused", reason: "badIndex" }]);
  assert.deepEqual(state.party, before);
});

/* ============================================================
 * validateAction / applyAction — the applyAction() boundary
 * ============================================================ */

test("validateAction: dismissJoiner with no i, or i=0, is ok; negative/non-integer i is rejected with the exact reason string", () => {
  assert.equal(validateAction({ type: "dismissJoiner" }).ok, true);
  assert.equal(validateAction({ type: "dismissJoiner", i: 0 }).ok, true);
  for (const bad of [-1, "0", 1.5]) {
    const result = validateAction({ type: "dismissJoiner", i: bad });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "dismissJoiner.i must be a non-negative integer when present");
  }
});

test("applyAction({type:'dismissJoiner'}): party becomes [], events carry joinerDismissed, rngState is unchanged (zero draws), input untouched, output round-trips through JSON", () => {
  const state = plantMember(hero());
  // Normalize the cursor through one makeRng round-trip first (mulberry32's
  // constructor coerces a signed seed to unsigned via `>>> 0`; without this
  // the very FIRST makeRng() call on a freshly-captured newRun() cursor can
  // change getState()'s numeric representation even with zero draws, which
  // is a pre-existing engine/rng.js artifact unrelated to dismissJoiner).
  state.rngState = makeRng(state.rngState).getState();
  const before = structuredClone(state);
  const { state: next, events } = applyAction(state, { type: "dismissJoiner" });
  assert.deepStrictEqual(state, before, "the input state object was not mutated");
  assert.deepEqual(next.party, []);
  assert.ok(events.some((e) => e.type === "joinerDismissed"));
  assert.deepEqual(next.rngState, before.rngState, "zero rng draws — the cursor is unchanged");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(next)));
});

test("applyAction with an empty party returns dismissRefused noParty and an otherwise deepStrictEqual state", () => {
  const state = hero();
  state.party = [];
  // Same cursor normalization as above.
  state.rngState = makeRng(state.rngState).getState();
  const before = structuredClone(state);
  const { state: next, events } = applyAction(state, { type: "dismissJoiner" });
  assert.deepEqual(events, [{ type: "dismissRefused", reason: "noParty" }]);
  assert.deepStrictEqual(next, before);
});

/* ============================================================
 * EVENT_NARRATION.joinerDismissed / .dismissRefused
 * ============================================================ */

test("EVENT_NARRATION.joinerDismissed: contains the name, is deterministic, escapes markup in the name, and a bare {type} call does not throw", () => {
  const line1 = narrateEvent({ type: "joinerDismissed", name: "Ada Brook", sub: "Guard" });
  assert.ok(line1.includes("Ada Brook"), `expected the name in: ${line1}`);
  const line2 = narrateEvent({ type: "joinerDismissed", name: "Ada Brook", sub: "Guard" });
  assert.equal(line1, line2, "same input produces the same line");

  const escaped = narrateEvent({ type: "joinerDismissed", name: "<b>Rook</b>", sub: "Guard" });
  assert.ok(!escaped.includes("<b>Rook</b>"), `expected the name html-escaped, got: ${escaped}`);
  assert.ok(escaped.includes("&lt;b&gt;"), `expected an escaped tag, got: ${escaped}`);

  assert.doesNotThrow(() => narrateEvent({ type: "joinerDismissed" }));
});

test("EVENT_NARRATION.joinerDismissed: five distinct names of lengths 1..5 reach five distinct lines (every JOINER_PARTING_LINES entry reachable)", () => {
  const names = ["A", "Bo", "Cat", "Dawn", "Ember"];
  const lines = new Set(names.map((n) => narrateEvent({ type: "joinerDismissed", name: n, sub: "Guard" })));
  assert.equal(lines.size, 5, `expected 5 distinct lines, got: ${[...lines].join(" | ")}`);
});

test("EVENT_NARRATION.dismissRefused: three distinct non-empty strings for noParty/inCombat/badIndex, non-empty fallback for an unknown reason", () => {
  const noParty = narrateEvent({ type: "dismissRefused", reason: "noParty" });
  const inCombat = narrateEvent({ type: "dismissRefused", reason: "inCombat" });
  const badIndex = narrateEvent({ type: "dismissRefused", reason: "badIndex" });
  const unknown = narrateEvent({ type: "dismissRefused", reason: "somethingElse" });
  for (const s of [noParty, inCombat, badIndex, unknown]) assert.ok(s && s.length > 0);
  assert.equal(new Set([noParty, inCombat, badIndex]).size, 3, "the three named reasons are distinct lines");
});

/* ============================================================
 * TOAST_FOR / NARRATIVE_ACTIONS / FEATURE_EVENTS
 * ============================================================ */

test("TOAST_FOR.joinerDismissed: priority feature, tone beat, text contains the name", () => {
  const t = TOAST_FOR.joinerDismissed({ name: "Ada Brook", sub: "Guard" });
  assert.equal(t.priority, PRIORITY.feature);
  assert.equal(t.tone, "beat");
  assert.ok(t.text.includes("Ada Brook"));
});

test("TOAST_FOR.dismissRefused: priority block for every reason", () => {
  for (const reason of ["noParty", "inCombat", "badIndex", "somethingElse"]) {
    const t = TOAST_FOR.dismissRefused({ reason });
    assert.equal(t.priority, PRIORITY.block);
  }
});

test("FEATURE_EVENTS includes dismissRefused", () => {
  assert.ok(FEATURE_EVENTS.includes("dismissRefused"));
});

test("NARRATIVE_ACTIONS deep-equals the set of camp/dismissJoiner/move/resolveJoiner", async () => {
  const { NARRATIVE_ACTIONS } = await import("../../src/browser/toasts.js");
  assert.deepEqual([...NARRATIVE_ACTIONS].sort(), ["camp", "dismissJoiner", "move", "resolveJoiner"]);
});

/* ============================================================
 * RAIL_FAMILY.joinerDismissed / railCardFor
 * ============================================================ */

test("RAIL_FAMILY.joinerDismissed: COMPANY / dull; no dismissRefused key (block fallback)", () => {
  assert.deepEqual(RAIL_FAMILY.joinerDismissed, { icon: "◇", title: "COMPANY", tone: "dull" });
  assert.equal(Object.prototype.hasOwnProperty.call(RAIL_FAMILY, "dismissRefused"), false);
});

test("railCardFor('dismissJoiner', ...) for a joinerDismissed event: title COMPANY, tone dull, first line is the parting sentence", () => {
  const events = [{ type: "joinerDismissed", name: "Ada Brook", sub: "Guard" }];
  const folded = toastsForAction("dismissJoiner", events, { narrate: narrateEvent }, { limit: Infinity, withIdx: true });
  const card = railCardFor("dismissJoiner", events, folded, { narrate: narrateEvent });

  assert.ok(card, "expected a rail card");
  assert.equal(card.title, "COMPANY");
  assert.equal(card.tone, "dull");
  assert.ok(card.lines[0].text.includes("Ada Brook"), `expected the parting sentence, got: ${JSON.stringify(card.lines[0])}`);
});

test("railCardFor('dismissJoiner', ...) for a dismissRefused event: title NOTHING DOING, tone dull", () => {
  const events = [{ type: "dismissRefused", reason: "noParty" }];
  const folded = toastsForAction("dismissJoiner", events, { narrate: narrateEvent }, { limit: Infinity, withIdx: true });
  const card = railCardFor("dismissJoiner", events, folded, { narrate: narrateEvent });

  assert.ok(card, "expected a rail card");
  assert.equal(card.title, "NOTHING DOING");
  assert.equal(card.tone, "dull");
});

/* ============================================================
 * JOINER_PARTING_LINES — data shape sanity (voice/safety-scan owns content)
 * ============================================================ */

test("JOINER_PARTING_LINES: exactly 5 lines, every one carries {name}", () => {
  assert.equal(JOINER_PARTING_LINES.length, 5);
  assert.ok(JOINER_PARTING_LINES.every((s) => s.includes("{name}")));
});
