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
import { yourLotViewModel, COMBAT_PANEL_COPY } from "../../src/browser/combatPanel.js";
import * as heroTab from "../../src/browser/heroTab.js";
import { foeTurn, endCombat } from "../../engine/combat.js";
import { newRun } from "../../engine/state.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

setIdentityDials();

/** fakeRng(seq) — `.d()` pops the next value; throws on underflow. */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

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

// --- the report #5 scene, end to end ----------------------------------------

function heroFixture() {
  return {
    cls: "Fighter", sub: "Knight", race: "Dwarf", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    potions: 0, rations: 6, gold: 50, scrolls: 0, items: [], grimoire: [],
    spellsUsed: 0, kills: 0, might: 0, name: "Test Delver",
  };
}

function caveBearScene() {
  const foe = {
    name: "Cave Bear", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
  };
  const ally = roster();
  const state = {
    version: 1, seed: 1, rngState: 1, c: heroFixture(),
    floor: { g: [[{ wall: false, dark: false, seen: true, feat: null }]], px: 0, py: 0, depth: 2 },
    day: 3, steps: 200, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    party: [sheet()],
    combat: { foes: [foe], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, allies: [ally] },
  };
  return { state, ally };
}

function companyCardHtml(state) {
  const { document } = createRecordingDocument();
  const runState = newRun(1, []);
  runState.party = state.party;
  runState.combat = state.combat;
  heroTab.renderHeroTab(document.getElementById("screen-hero"), runState, {});
  return { document, cards: document.getElementById("hero-party-list").children };
}

test("#5 scene: a Cave Bear hit on Zell Bonecrack shows on YOUR LOT and the Company panel before the fight ends", () => {
  const { state, ally } = caveBearScene();
  // pick d(2)=2 -> member; to-hit d(20)=3 (hit); damage dice d(6)=4.
  const events = foeTurn(state, fakeRng([2, 3, 4]), []);
  const struck = events.find((e) => e.type === "memberStruck" && e.member === "Zell Bonecrack");
  assert.ok(struck, "the Cave Bear turned on Zell Bonecrack");
  const D = struck.dmg;
  assert.ok(D > 0);
  assert.equal(ally.wp, 30 - D, "the engine took it off the roster entry");
  assert.equal(state.party[0].wp, 30, "the persistent sheet is still stale mid-fight");

  const lot = yourLotViewModel(state);
  assert.equal(lot.cards[1].wpLabel, `${30 - D}/30`);
  assert.equal(lot.cards[1].down, false);

  const { cards } = companyCardHtml(state);
  assert.equal(cards.length, 1);
  assert.ok(cards[0].innerHTML.includes(`HP <b>${30 - D}</b>/<b>30</b>`), cards[0].innerHTML);
});

test("#5 scene, the literal report numbers: 11 damage reads 19/30 on both displays while the sheet says 30", () => {
  const { state } = caveBearScene();
  state.combat.allies[0].wp = 19;
  assert.equal(state.party[0].wp, 30);
  assert.equal(yourLotViewModel(state).cards[1].wpLabel, "19/30");
  const { cards } = companyCardHtml(state);
  assert.ok(cards[0].innerHTML.includes("HP <b>19</b>/<b>30</b>"), cards[0].innerHTML);
});

test("a Joiner reaching 0 through foeTurn shows DOWN on YOUR LOT (never 0/30) and the Downed chip on the Company card", () => {
  const { state } = caveBearScene();
  state.combat.allies[0].wp = 3;
  state.party[0].wp = 3;
  // pick=2 -> member; hit d(20)=3; dmg = 1 + d6(6) = 7 -> downed.
  const events = foeTurn(state, fakeRng([2, 3, 6]), []);
  assert.ok(events.some((e) => e.type === "memberDowned"));
  const card = yourLotViewModel(state).cards[1];
  assert.equal(card.wpLabel, COMBAT_PANEL_COPY.down);
  assert.equal(card.down, true);
  const { cards } = companyCardHtml(state);
  assert.ok(cards[0].innerHTML.includes("Downed"), cards[0].innerHTML);
});

test("a Joiner at 1 hp reads 1/30 on YOUR LOT", () => {
  const { state } = caveBearScene();
  state.combat.allies[0].wp = 1;
  const card = yourLotViewModel(state).cards[1];
  assert.equal(card.wpLabel, "1/30");
  assert.equal(card.down, false);
});

test("two Joiners, the first downed and spliced mid-fight: the second card shows its own roster hp", () => {
  const { state } = caveBearScene();
  state.party = [sheet({ status: "downed", wp: 0 }), sheet({ name: "Ada", wp: 25, maxWP: 25 })];
  state.combat.allies = [roster({ partyIdx: 1, name: "Ada", wp: 7, maxWP: 25 })];
  const cards = yourLotViewModel(state).cards;
  assert.equal(cards[1].wpLabel, COMBAT_PANEL_COPY.down);
  assert.equal(cards[2].wpLabel, "7/25");
  const html = companyCardHtml(state).cards;
  assert.ok(html[1].innerHTML.includes("HP <b>7</b>/<b>25</b>"), html[1].innerHTML);
});

test("no Joiners: YOUR LOT has only the hero card and the Company panel stays hidden", () => {
  const { state } = caveBearScene();
  state.party = [];
  delete state.combat.allies;
  assert.equal(yourLotViewModel(state).cards.length, 1);
  const { document } = createRecordingDocument();
  const runState = newRun(1, []);
  heroTab.renderHeroTab(document.getElementById("screen-hero"), runState, {});
  assert.equal(document.getElementById("hero-party").hidden, true);
});

test("after endCombat the displays read the synced sheet and show the same numbers", () => {
  const { state } = caveBearScene();
  state.combat.allies[0].wp = 19;
  const during = yourLotViewModel(state).cards[1].wpLabel;
  endCombat(state, []);
  assert.equal(state.combat, null);
  assert.equal(state.party[0].wp, 19);
  assert.equal(yourLotViewModel(state).cards[1].wpLabel, during);
  const { cards } = companyCardHtml(state);
  assert.ok(cards[0].innerHTML.includes("HP <b>19</b>/<b>30</b>"), cards[0].innerHTML);
});
