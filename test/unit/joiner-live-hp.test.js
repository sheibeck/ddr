// test/unit/joiner-live-hp.test.js
//
// Phase 87 (PARTY-11, player report #5): a Joiner's hp must show every hit it
// takes at once. The engine subtracts a foe hit from the fight's roster entry
// (state.combat.allies[k].wp) and only syncs the persistent sheet at
// endCombat; the party displays used to read the stale sheet. This file pins
// the shared view helper memberLiveWp and both displays that read it.

import test from "node:test";
import assert from "node:assert/strict";

import { memberLiveWp } from "../../src/browser/partyHp.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();


function sheet(overrides = {}) {
  return {
    name: "Zell Bonecrack", level: 1, lvl: 1, sub: "Knight", cls: "Fighter", race: "Troll",
    weapon: "Awl Pike", wp: 30, maxWP: 30, status: "ok", ...overrides,
  };
}

function roster(overrides = {}) {
  return { partyIdx: 0, name: "Zell Bonecrack", lvl: 1, sub: "Knight", wp: 30, maxWP: 30, ...overrides };
}

// --- memberLiveWp unit pins -------------------------------------------------

test("memberLiveWp: outside a fight it reads the persistent sheet", () => {
  const state = { party: [{ wp: 12, maxWP: 20, status: "ok" }], combat: null };
  assert.deepEqual(memberLiveWp(state, 0), { wp: 12, maxWP: 20, down: false });
});

test("memberLiveWp: in a fight it reads the roster entry, not the stale sheet", () => {
  const state = {
    party: [{ wp: 30, maxWP: 30, status: "ok" }],
    combat: { allies: [{ partyIdx: 0, wp: 19, maxWP: 30 }] },
  };
  assert.deepEqual(memberLiveWp(state, 0), { wp: 19, maxWP: 30, down: false });
});

test("memberLiveWp: 1 hp reads 1 and up; 0 or negative reads 0 and down", () => {
  const mk = (wp) => ({ party: [{ wp: 30, maxWP: 30 }], combat: { allies: [{ partyIdx: 0, wp, maxWP: 30 }] } });
  assert.deepEqual(memberLiveWp(mk(1), 0), { wp: 1, maxWP: 30, down: false });
  assert.deepEqual(memberLiveWp(mk(0), 0), { wp: 0, maxWP: 30, down: true });
  assert.deepEqual(memberLiveWp(mk(-4), 0), { wp: 0, maxWP: 30, down: true });
});

test("memberLiveWp: a sheet flagged downed reads 0 and down whatever the stale sheet wp says", () => {
  const state = { party: [{ wp: 30, maxWP: 30, status: "downed" }], combat: { allies: [] } };
  assert.deepEqual(memberLiveWp(state, 0), { wp: 0, maxWP: 30, down: true });
});

test("memberLiveWp: looks up by partyIdx, not array position (member 0 downed and spliced)", () => {
  const state = {
    party: [{ wp: 30, maxWP: 30, status: "downed" }, { wp: 25, maxWP: 25, status: "ok" }],
    combat: { allies: [{ partyIdx: 1, wp: 7, maxWP: 25 }] },
  };
  assert.deepEqual(memberLiveWp(state, 1), { wp: 7, maxWP: 25, down: false });
  assert.deepEqual(memberLiveWp(state, 0), { wp: 0, maxWP: 30, down: true });
});

test("memberLiveWp: missing state, empty party, out-of-range index never throw", () => {
  const gone = { wp: 0, maxWP: 1, down: true };
  assert.deepEqual(memberLiveWp(null, 0), gone);
  assert.deepEqual(memberLiveWp(undefined, 0), gone);
  assert.deepEqual(memberLiveWp({}, 0), gone);
  assert.deepEqual(memberLiveWp({ party: [] }, 0), gone);
  assert.deepEqual(memberLiveWp({ party: [{ wp: 5, maxWP: 5 }] }, 3), gone);
});

test("memberLiveWp: a solo fight (combat present, no allies key) falls back to the sheet", () => {
  const state = { party: [{ wp: 9, maxWP: 20 }], combat: { foes: [] } };
  assert.deepEqual(memberLiveWp(state, 0), { wp: 9, maxWP: 20, down: false });
});

test("memberLiveWp: does not mutate its input", () => {
  const state = { party: [{ wp: 30, maxWP: 30 }], combat: { allies: [{ partyIdx: 0, wp: 19, maxWP: 30 }] } };
  const before = JSON.stringify(state);
  memberLiveWp(state, 0);
  assert.equal(JSON.stringify(state), before);
});

