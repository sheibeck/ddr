// Phase 9 (PARTY-01/PARTY-09) — Joiner ACQUISITION at the engine level:
//   - encounters.js#meetJoiner ALSO stashes a full `state.pendingJoiner` sheet
//     (fit to fight per Phase 8) WITHOUT adding any rng draw to its frozen,
//     parity-pinned draw order (d10 lvl, rollCharacter, wp d20, discarded d20).
//   - encounters.js#resolveJoiner is the pure (no rng) accept/decline: accept
//     recruits into state.party under PARTY_CAP + emits joinerJoined; decline
//     (or cap-full / no-candidate) emits joinerDeclined; the candidate is
//     ALWAYS cleared.
//   - Integration: a recruited joiner actually fights the next combat — it
//     syncs into the combat-scoped C.allies (startCombat) and lands a strike
//     (alliesTurn -> allyStruck).
//
// The empty-party / draw-order parity is proven at the byte level by
// test/parity/* (pendingJoiner is carved out of every comparable() exactly
// like state.party); these tests prove the ACQUISITION behavior + assert the
// no-extra-draw contract directly via a hand-replayed control rng.

import test from "node:test";
import assert from "node:assert/strict";

import { meetJoiner, resolveJoiner } from "../../engine/encounters.js";
import { rollCharacter } from "../../engine/character.js";
import { makeRng } from "../../engine/rng.js";
import { PARTY_CAP } from "../../engine/state.js";
import { startCombat, alliesTurn } from "../../engine/combat.js";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow (doubles as a "no more rng draws expected" assertion). */
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

/** A pending candidate shaped exactly as meetJoiner produces it (a full
 * rollCharacter sheet spread + joiner-specific lvl/level/wp/maxWP). */
function fixedPending(overrides = {}) {
  const sheet = rollCharacter(makeRng(4321));
  return { ...sheet, name: "Ada", sub: "Fighter", lvl: 1, level: 1, wp: 20, maxWP: 20, ...overrides };
}

// --- meetJoiner: stashes a full pendingJoiner without adding an rng draw -----

test("meetJoiner: stashes a full pendingJoiner sheet fit to fight (Phase 8 member shape)", () => {
  const state = fixedState();
  meetJoiner(state, makeRng(555), []);
  const pj = state.pendingJoiner;
  assert.ok(pj, "pendingJoiner was set");
  // carries a real rollCharacter-shaped sheet, not a thin stub
  assert.ok(pj.name && pj.race && pj.sub && pj.cls, "carries a full character sheet");
  // joiner-specific combat fields mirror the frozen c.joiner
  assert.equal(pj.lvl, state.c.joiner.lvl, "lvl matches the rolled joiner lvl");
  assert.equal(pj.wp, state.c.joiner.wp, "wp matches the rolled joiner wp");
  assert.equal(pj.maxWP, pj.wp, "maxWP mirrors wp (the discarded second roll)");
  // Phase 8's startCombat reads `m.level ?? m.lvl`; level is overridden to lvl
  // so the member fights at its rolled joiner level, not rollCharacter's 1.
  assert.equal(pj.level, pj.lvl, "combat level (m.level) equals the joiner lvl");
});

test("meetJoiner: setting pendingJoiner consumes NO extra rng (cursor matches the 4-draw control)", () => {
  // Hand-replay meetJoiner's EXACT draw order on a sibling rng from the same
  // seed — d10 (lvl), rollCharacter, wp d20, the discarded d20 — then compare
  // the NEXT draw. Equality proves pendingJoiner added zero draws.
  const ctrl = makeRng(777);
  ctrl.d(10);
  rollCharacter(ctrl);
  ctrl.d(20);
  ctrl.d(20);
  const ctrlNext = ctrl.d(20);

  const state = fixedState();
  const rng = makeRng(777);
  meetJoiner(state, rng, []);
  assert.equal(rng.d(20), ctrlNext, "the draw following meetJoiner is unchanged — pendingJoiner drew nothing");
});

test("meetJoiner: c.joiner + joinerMet stay unchanged alongside the new pendingJoiner", () => {
  const state = fixedState();
  const events = meetJoiner(state, makeRng(555), []);
  assert.ok(state.c.joiner, "c.joiner still set");
  assert.equal(state.c.joiner.maxWP, state.c.joiner.wp, "c.joiner shape intact");
  assert.ok(events.some((e) => e.type === "joinerMet"), "joinerMet still emitted");
});

// --- resolveJoiner: pure accept / decline -----------------------------------

test("resolveJoiner{accept:true}: recruits the candidate into state.party and clears it", () => {
  const state = fixedState({ pendingJoiner: fixedPending({ name: "Gru" }) });
  const events = resolveJoiner(state, true, []);
  assert.equal(state.party.length, 1, "recruited into the roster");
  assert.equal(state.party[0].name, "Gru");
  assert.equal(state.pendingJoiner, null, "candidate cleared");
  assert.ok(events.some((e) => e.type === "joinerJoined" && e.name === "Gru"), "joinerJoined emitted");
});

test("resolveJoiner{accept:false}: discards the candidate without recruiting", () => {
  const state = fixedState({ pendingJoiner: fixedPending({ name: "Gru" }) });
  const events = resolveJoiner(state, false, []);
  assert.equal(state.party.length, 0, "no recruit on decline");
  assert.equal(state.pendingJoiner, null, "candidate cleared");
  assert.ok(events.some((e) => e.type === "joinerDeclined"), "joinerDeclined emitted");
});

test("resolveJoiner: a second accept is refused at PARTY_CAP and still clears the candidate", () => {
  assert.equal(PARTY_CAP, 1, "v1 caps the roster at a single joiner");
  const state = fixedState({ pendingJoiner: fixedPending({ name: "Ada" }) });
  resolveJoiner(state, true, []); // fills the single cap slot
  state.pendingJoiner = fixedPending({ name: "Bo" }); // a second candidate appears
  const events = resolveJoiner(state, true, []);
  assert.equal(state.party.length, 1, "cap 1 respected — no second recruit");
  assert.equal(state.party[0].name, "Ada", "the first recruit stays");
  assert.equal(state.pendingJoiner, null, "candidate still cleared on the refused accept");
  assert.ok(events.some((e) => e.type === "joinerDeclined"), "cap-full accept narrates as a decline");
});

test("resolveJoiner: an accept with NO candidate is a safe no-op decline", () => {
  const state = fixedState({ pendingJoiner: null });
  const events = resolveJoiner(state, true, []);
  assert.equal(state.party.length, 0);
  assert.equal(state.pendingJoiner, null);
  assert.ok(events.some((e) => e.type === "joinerDeclined"));
});

test("resolveJoiner: is rng-free — takes no rng argument and its rngState never shifts", () => {
  // resolveJoiner(state, accept, events) has no rng parameter at all, so the
  // seeded cursor cannot move across it. Assert the persisted rngState is
  // untouched on both the accept and the decline paths.
  const accept = fixedState({ pendingJoiner: fixedPending(), rngState: 12345 });
  resolveJoiner(accept, true, []);
  assert.equal(accept.rngState, 12345, "accept path draws no rng");
  const decline = fixedState({ pendingJoiner: fixedPending(), rngState: 12345 });
  resolveJoiner(decline, false, []);
  assert.equal(decline.rngState, 12345, "decline path draws no rng");
});

// --- integration: a recruited joiner fights the next combat -----------------

test("integration: a recruited joiner syncs into C.allies and lands a strike in the next combat", () => {
  const state = fixedState({ pendingJoiner: fixedPending({ name: "Ada", lvl: 1, level: 1, wp: 20, maxWP: 20 }) });
  // 1) Accept the recruitment — the candidate joins the persistent roster.
  resolveJoiner(state, true, []);
  assert.equal(state.party.length, 1, "joiner is now a persistent party member");

  // 2) The next combat syncs the roster into a combat-scoped C.allies list.
  startCombat(state, true, "Beasts", makeRng(42), []);
  assert.ok(state.combat, "combat started");
  assert.ok(Array.isArray(state.combat.allies) && state.combat.allies.length === 1, "recruit synced into C.allies");
  const ally = state.combat.allies[0];
  assert.equal(ally.name, "Ada");
  assert.equal(ally.lvl, 1, "combat level came from the joiner lvl");

  // 3) The member takes its swing: lvl 1 -> STRIKE_DICE[0] = d20; roll 3 (<=5
  //    hit), dmg = 1*1 + d6(4) = 5 -> the recruit lands an allyStruck. Bump the
  //    generated foe's wp first so the 5 damage does NOT kill it (which would
  //    route into killFoe's extra draws) — this test isolates the strike path.
  state.combat.foes[0].wp = 30;
  state.combat.foes[0].maxWP = 30;
  const foeBefore = state.combat.foes[0].wp;
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.ok(events.some((e) => e.type === "allyStruck" && e.name === "Ada" && e.dmg === 5), "recruit struck a foe");
  assert.equal(state.combat.foes[0].wp, foeBefore - 5, "foe took the member's damage");
});
