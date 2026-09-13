// Direct unit coverage for engine/combat.js's Phase 8 PARTY COMBAT seams
// (PARTY-03..PARTY-06): startCombat syncing state.party into a combat-scoped
// C.allies, alliesTurn (party members striking), foeTurn's target pool + the
// simplified member-damage branch + member down/depart, endCombat syncing
// surviving hp back, and killFoe's XP split among participants.
//
// The dominant constraint is DETERMINISM: every new rng draw is gated behind
// party presence so an empty party is byte-identical to the frozen prototype.
// The parity suite (test/parity/*) proves the empty-party gate at the byte
// level; these tests prove (a) the party BEHAVIOR when a member is present and
// (b) — via fakeRng's throw-on-underflow — that the gated paths draw EXACTLY
// the expected dice and NOT ONE MORE. In particular:
//   - alliesTurn on an empty/absent C.allies draws ZERO rng (fakeRng([])).
//   - foeTurn with an empty party draws NO target-selection roll (only the
//     hero to-hit + damage), matching today's solo draw order exactly.
//   - killFoe with no members applies NO split (byte-identical sp award).
//
// Mirrors test/unit/combat.test.js's fakeRng/fixedState helpers verbatim.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { startCombat, alliesTurn, foeTurn, killFoe, endCombat, afterPlayerAction } from "../../engine/combat.js";

/** fakeRng(seq) — `.d()` pops the next value regardless of side count; throws
 * on underflow, which doubles as a "no more rng draws expected" assertion. */
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

// --- startCombat: party sync into C.allies ---------------------------------

test("startCombat: a persistent party member syncs into a combat-scoped C.allies entry", () => {
  const state = fixedState({ party: [fixedMember({ name: "Gru", level: 2, wp: 999, maxWP: 999 })] });
  startCombat(state, true, "Beasts", makeRng(42), []);
  assert.ok(state.combat, "combat did not clear");
  assert.ok(Array.isArray(state.combat.allies), "C.allies was synced");
  assert.equal(state.combat.allies.length, 1);
  const a = state.combat.allies[0];
  assert.equal(a.name, "Gru");
  assert.equal(a.lvl, 2, "persistent `level` maps to combat `lvl`");
  assert.equal(a.partyIdx, 0, "back-reference to state.party index");
  assert.equal(a.maxWP, 999);
});

test("startCombat: an EMPTY party never adds an `allies` key (parity gate — absent, not empty)", () => {
  const state = fixedState({ party: [] });
  startCombat(state, true, "Beasts", makeRng(42), []);
  assert.ok(state.combat, "combat did not clear");
  assert.equal("allies" in state.combat, false, "no allies field on state.combat for a solo run");
});

// --- alliesTurn: party members strike --------------------------------------

test("alliesTurn: a member strikes a live foe and reduces its wp (reuses allyStruck)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ party: [fixedMember()] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // lvl 1 -> STRIKE_DICE[0] = d20. roll 3 (<=5 hit); dmg = 1*1 + d6(4) = 5.
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 25);
  assert.ok(events.some((e) => e.type === "allyStruck" && e.name === "Ada" && e.dmg === 5));
});

test("alliesTurn: an empty/absent C.allies returns immediately drawing ZERO rng", () => {
  const state = fixedState({ party: [] });
  state.combat = fixedCombat([fixedFoe()]);
  // fakeRng([]) throws on ANY draw — reaching this line proves zero draws.
  assert.doesNotThrow(() => alliesTurn(state, fakeRng([]), []));
});

test("alliesTurn: a member miss emits allyMissed and leaves the foe untouched", () => {
  const foe = fixedFoe({ wp: 30 });
  const state = fixedState({ party: [fixedMember()] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // roll 9 (> 5) -> miss; NO damage roll drawn (fakeRng of length 1 proves it).
  const events = alliesTurn(state, fakeRng([9]), []);
  assert.equal(foe.wp, 30);
  assert.ok(events.some((e) => e.type === "allyMissed"));
});

// --- foeTurn: target pool + member branch ----------------------------------

test("foeTurn: with a live member, a foe can pick and strike the member (member wp drops, hero untouched)", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30 });
  const ally = fixedAlly({ wp: 12, maxWP: 20 });
  const state = fixedState({ party: [fixedMember({ wp: 12 })] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  // pick d(2)=2 -> member; to-hit d(20)=3 (<=5 hit); dmg = 1 + d6(4) = 5.
  const events = foeTurn(state, fakeRng([2, 3, 4]), []);
  assert.equal(ally.wp, 7, "member took 5 damage");
  assert.equal(state.c.wp, 55, "hero untouched");
  assert.ok(events.some((e) => e.type === "memberStruck" && e.member === "Ada" && e.dmg === 5));
});

test("foeTurn: a member reaching 0 wp is downed + departs and NEVER ends the hero's run", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30 });
  const ally = fixedAlly({ wp: 3, maxWP: 20 });
  const state = fixedState({ party: [fixedMember({ wp: 3 })] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  // pick=2 -> member; hit d(20)=3; dmg = 1 + d6(6) = 7 -> member.wp -4 -> downed.
  const events = foeTurn(state, fakeRng([2, 3, 6]), []);
  assert.equal(state.dead, false, "the hero's run did NOT end when the companion fell");
  assert.equal(state.c.wp, 55, "hero untouched");
  assert.equal(state.combat.allies.length, 0, "downed member spliced out of combat");
  assert.equal(state.party[0].status, "downed", "persistent member flagged downed");
  assert.ok(events.some((e) => e.type === "memberDowned" && e.name === "Ada"));
  assert.equal(events.some((e) => e.type === "died"), false, "no death event");
});

test("foeTurn: when the foe picks the hero (pick=1), the full hero branch runs unchanged", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30 });
  const ally = fixedAlly({ wp: 20 });
  const state = fixedState({ party: [fixedMember()] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  // pick d(2)=1 -> hero; hero to-hit d(20)=3 (<=5 hit); dmg = 1 + d6(4) = 5.
  foeTurn(state, fakeRng([1, 3, 4]), []);
  assert.equal(state.c.wp, 50, "hero took the blow via the normal path");
  assert.equal(ally.wp, 20, "member untouched");
});

test("foeTurn: an EMPTY party draws NO target-selection roll (byte-identical solo draw order)", () => {
  const foe = fixedFoe({ lvl: 1, wp: 30 });
  const state = fixedState({ party: [] });
  state.combat = fixedCombat([foe]); // no allies
  // NO pick roll: hero to-hit d(20)=3, dmg = 1 + d6(4) = 5. Exactly two draws.
  foeTurn(state, fakeRng([3, 4]), []);
  assert.equal(state.c.wp, 50);
});

// --- killFoe: XP split among participants, loot to hero only ---------------

test("killFoe: with no members the sp award and its rng draw are byte-identical to today", () => {
  const state = fixedState({ party: [] });
  state.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 })]);
  const foe = state.combat.foes[0];
  // d6(4) -> raw 4, mul 5 -> gained 20 (no split). coin d10(1); treasure d20(20 -> none).
  killFoe(state, foe, fakeRng([4, 1, 20]), []);
  assert.equal(state.c.sp, 20, "solo hero keeps the full award");
});

test("killFoe: XP splits among participants (hero + live members); loot/wilmst stay the hero's", () => {
  const state = fixedState({ party: [fixedMember()] });
  const ally = fixedAlly({ wp: 20 });
  state.combat = fixedCombat([fixedFoe({ type: "Humans", lvl: 1 })], { allies: [ally] });
  const foe = state.combat.foes[0];
  const goldBefore = state.c.gold;
  // Same draws as the solo case: d6(4) -> gained 20, shares 2 -> heroShare 10.
  killFoe(state, foe, fakeRng([4, 1, 20]), []);
  assert.equal(state.c.sp, 10, "hero's share is halved by the 1-member split");
  assert.ok(state.c.gold > goldBefore, "wilmst/loot still flows entirely to the hero");
  assert.equal("sp" in ally, false, "the member accrues no XP (hired muscle, v1)");
});

// --- endCombat: sync member hp back, drop the downed -----------------------

test("endCombat: surviving members' wp syncs back to state.party; downed members are dropped", () => {
  const state = fixedState({
    party: [fixedMember({ name: "Ada" }), fixedMember({ name: "Bo", status: "downed" })],
  });
  // Bo was already downed + spliced from C.allies mid-fight; only Ada remains,
  // and her in-fight wp fell to 8.
  state.combat = fixedCombat([fixedFoe()], { allies: [fixedAlly({ partyIdx: 0, name: "Ada", wp: 8 })] });
  endCombat(state, []);
  assert.equal(state.party.length, 1, "the downed member departed the run");
  assert.equal(state.party[0].name, "Ada");
  assert.equal(state.party[0].wp, 8, "survivor's in-fight hp persisted back");
});

// --- loop safety: bounded combat still terminates with a member ------------

test("afterPlayerAction: a party member landing the kill still ends combat the instant foes clear", () => {
  const foe = fixedFoe({ type: "Humans", lvl: 1, wp: 2 });
  const ally = fixedAlly({ wp: 20 });
  const state = fixedState({ party: [fixedMember()] });
  state.combat = fixedCombat([foe], { allies: [ally] });
  // allyTurn: no C.ally -> 0 draws. alliesTurn: d20(3) hit, d6(6) dmg=7 -> foe dies;
  // killFoe: d6(4) sp, d10(1) coin, d20(20) treasure. Then liveFoes empty -> endCombat.
  const events = afterPlayerAction(state, fakeRng([3, 6, 4, 1, 20]), []);
  assert.equal(state.combat, null, "combat ended (bounded — no hang, no stranded screen)");
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.ok(events.some((e) => e.type === "combatEnded"));
});
