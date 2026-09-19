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
import { startCombat, alliesTurn, foeTurn, killFoe, endCombat, afterPlayerAction, pickFoeTarget } from "../../engine/combat.js";
import { memberToHit, bestAttackSpell } from "../../engine/derived.js";
import { newDay } from "../../engine/movement.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, ORACLE_ONLY, FEATURE_EVENTS, linesForAction } from "../../src/browser/narrationLines.js";

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

/** DFB-05: a fully class-shaped party sheet — Knight + Club + prof 2 by
 * default (a classed Fighter fixture); override cls/sub/weapon/etc. for the
 * Thief/Magic User scenarios below. */
function classedMember(overrides = {}) {
  return fixedMember({
    cls: "Fighter", sub: "Knight", race: "Human", weapon: "Club", prof: 2, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0,
    ...overrides,
  });
}

/** DFB-05: a Magic User party sheet, prof 0 (so weaponDamage's staff-swing
 * math is exactly level^2 + weapon base, no proficiency term). */
function muMember(overrides = {}) {
  return classedMember({ cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, grimoire: [], spellsUsed: 0, ...overrides });
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

// --- pickFoeTarget: target pool helper (Phase 17, FID-03) ------------------

test("pickFoeTarget: an absent allies key draws ZERO rng and returns null", () => {
  const state = { combat: { foes: [] } };
  const result = pickFoeTarget(state, fakeRng([]));
  assert.equal(result, null);
});

test("pickFoeTarget: an empty allies array draws ZERO rng and returns null", () => {
  const state = { combat: { foes: [], allies: [] } };
  const result = pickFoeTarget(state, fakeRng([]));
  assert.equal(result, null);
});

test("pickFoeTarget: a party whose members are all at 0 wp draws ZERO rng and returns null", () => {
  const state = { combat: { foes: [], allies: [fixedAlly({ wp: 0 }), fixedAlly({ name: "Beo", wp: 0 })] } };
  const result = pickFoeTarget(state, fakeRng([]));
  assert.equal(result, null);
});

test("pickFoeTarget: draw 1 targets the hero (null); draw k>1 targets live member k-2, in C.allies order", () => {
  const members = [fixedAlly({ name: "Ada", wp: 20 }), fixedAlly({ name: "Beo", wp: 5 })];
  const state = { combat: { foes: [], allies: members } };
  assert.equal(pickFoeTarget(state, fakeRng([1])), null, "draw 1 => hero");
  assert.equal(pickFoeTarget(state, fakeRng([2])).name, "Ada", "draw 2 => first live member");
  assert.equal(pickFoeTarget(state, fakeRng([3])).name, "Beo", "draw 3 => second live member");
  // Each call above consumed exactly one draw off its own single-entry
  // fakeRng — a second draw on any of them would throw "sequence exhausted".
  const rng = fakeRng([2]);
  pickFoeTarget(state, rng);
  assert.throws(() => rng.d(3), /sequence exhausted/, "exactly one draw was consumed");
});

test("pickFoeTarget: downed members are excluded from the pool before the draw", () => {
  const members = [fixedAlly({ name: "Ada", wp: 0 }), fixedAlly({ name: "Beo", wp: 5 })];
  const state = { combat: { foes: [], allies: members } };
  // Only Beo is live, so the pool is [hero, Beo] (2 sides); draw 2 => the
  // LIVE list's index 0 (Beo), not raw C.allies index 1.
  assert.equal(pickFoeTarget(state, fakeRng([2])).name, "Beo");
});

test("pickFoeTarget: the pool die has exactly (live members + 1) sides", () => {
  function recordingRng() {
    const sides = [];
    return { d: (n) => { sides.push(n); return 1; }, pick: (a) => a[0], shuffle: (a) => a, sides };
  }
  const two = [fixedAlly({ name: "Ada", wp: 20 }), fixedAlly({ name: "Beo", wp: 5 })];
  let rng = recordingRng();
  pickFoeTarget({ combat: { foes: [], allies: two } }, rng);
  assert.deepEqual(rng.sides, [3], "two live members -> a 3-sided pool die");

  const one = [fixedAlly({ name: "Ada", wp: 20 })];
  rng = recordingRng();
  pickFoeTarget({ combat: { foes: [], allies: one } }, rng);
  assert.deepEqual(rng.sides, [2], "one live member -> a 2-sided pool die");
});

// --- DFB-05 (Phase 25.1): party members fight by class ---------------------

test("DFB-05 Fighter: strikes with its weapon on the class to-hit — Knight + Club + prof 2, roll 3 hits (need 5), d6 4 -> 7", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember()] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 23);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 7);
  assert.equal(ev.weapon, "Club");
  assert.equal("crit" in ev, false);
  assert.equal("backstab" in ev, false);
});

test("DFB-05 Fighter: a natural 1 is a critical (x2, crit: true) and bypasses the armor soak draw", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember()] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([1, 4]), []);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 14);
  assert.equal(ev.crit, true);

  // A foe carrying sp.ar would normally draw an armor-soak d20 — a
  // fakeRng of length 2 proves crit bypasses it (a third draw would throw).
  const foe2 = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, sp: { ar: 10 } });
  const state2 = fixedState({ party: [classedMember()] });
  state2.combat = fixedCombat([foe2], { allies: [fixedAlly()] });
  const events2 = alliesTurn(state2, fakeRng([1, 4]), []);
  const ev2 = events2.find((e) => e.type === "allyStruck");
  assert.equal(ev2.dmg, 14);
});

test("DFB-05 Fighter: a Guard or Soldier never crits", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ sub: "Soldier" })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([1, 4]), []);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 7);
  assert.equal("crit" in ev, false);
});

test("DFB-05 to-hit: memberToHit follows class, race floor, Acrobat, Cleric", () => {
  assert.equal(memberToHit({ cls: "Fighter", race: "Human" }), 5);
  assert.equal(memberToHit({ cls: "Magic User", race: "Human" }), 3);
  assert.equal(memberToHit({ cls: "Thief", race: "Human" }), 4);
  assert.equal(memberToHit({ cls: "Thief", race: "Elven" }), 5);
  assert.equal(memberToHit({ cls: "Magic User", race: "Human", sub: "Cleric" }), 4);
  assert.equal(memberToHit({ cls: "Thief", race: "Human", sub: "Acrobat" }), 5);
  assert.equal(memberToHit({}), 5);
});

test("DFB-05 Thief: the first landed blow is a backstab (x2, backstab + crit flags), the next is normal", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ cls: "Thief", sub: "Pickpocket", weapon: "Dagger", prof: 0, armor: "Leather" })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  let events = alliesTurn(state, fakeRng([4, 4]), []);
  let ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 6);
  assert.equal(ev.backstab, true);
  assert.equal(ev.crit, true);
  assert.equal(state.combat.allies[0].backstabUsed, true);

  events = alliesTurn(state, fakeRng([4, 4]), []);
  ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 3);
  assert.equal("backstab" in ev, false);
});

test("DFB-05 Thief: a missed opener keeps the backstab for the next landed blow", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ cls: "Thief", sub: "Pickpocket", weapon: "Dagger", prof: 0, armor: "Leather" })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  let events = alliesTurn(state, fakeRng([9]), []);
  let ev = events.find((e) => e.type === "allyMissed");
  assert.equal(ev.target, foe.name);
  assert.equal(ev.roll, 9);
  assert.equal(ev.need, 4);
  assert.equal(ev.weapon, "Dagger");
  assert.ok(!state.combat.allies[0].backstabUsed);

  events = alliesTurn(state, fakeRng([4, 4]), []);
  ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 6);
  assert.equal(ev.backstab, true);
});

test("DFB-05 Thief: Plate armor denies the backstab (hero's rule mirrored)", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ cls: "Thief", sub: "Pickpocket", weapon: "Dagger", prof: 0, armor: "Plate" })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([4, 4]), []);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 3);
  assert.equal("backstab" in ev, false);
});

test("DFB-05 Magic User: casts Freeze at the hero's current target — d10 5 with bonus 3 hits need 6, d6 4 damage, the target is frozen and killed through killFoe, the SHEET pays the charge", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([5, 4, 4, 1, 20]), []);
  const cast = events.find((e) => e.type === "allyCast");
  assert.equal(cast.roll, 5);
  assert.equal(cast.need, 6);
  assert.equal(cast.bonus, 3);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "frozen");
  assert.equal(hit.dmg, 4);
  assert.ok(events.indexOf(hit) > events.indexOf(cast), "allySpellHit follows allyCast");
  assert.equal(foe.alive, false);
  assert.equal(state.party[0].spellsUsed, 1);
  assert.equal(events.some((e) => e.type === "allyStruck"), false);
});

test("DFB-05 Magic User: a Freeze miss (d10 10 - 3 > 6) is allySpellMissed { resisted: false } and still spends the charge", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([10]), []);
  const miss = events.find((e) => e.type === "allySpellMissed");
  assert.equal(miss.resisted, false);
  assert.equal(foe.wp, 30);
  assert.equal(state.party[0].spellsUsed, 1);
});

test("DFB-05 Magic User: Doze on a dim foe draws no resist roll and puts it to sleep d4", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 1 });
  const state = fixedState({ party: [muMember({ grimoire: ["Doze"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  // A single-entry fakeRng proves NO resist roll is drawn (intel 1 < 12).
  const events = alliesTurn(state, fakeRng([3]), []);
  const cast = events.find((e) => e.type === "allyCast");
  assert.equal("roll" in cast, false);
  const hit = events.find((e) => e.type === "allySpellHit");
  assert.equal(hit.effect, "asleep");
  assert.equal(hit.rounds, 3);
  assert.equal(foe.asleep, 3);
});

test("DFB-05 Magic User: an intelligent foe can resist Doze (d20 below its intel) -> allySpellMissed { resisted: true }", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30, intel: 15 });
  const state = fixedState({ party: [muMember({ grimoire: ["Doze"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([10]), []);
  const miss = events.find((e) => e.type === "allySpellMissed");
  assert.equal(miss.resisted, true);
  assert.equal(foe.asleep, 0);
  assert.equal(state.party[0].spellsUsed, 1);
});

test("DFB-05 Magic User: no charge left -> staff swing on the Magic User to-hit (3)", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [muMember({ grimoire: ["Freeze"], spellsUsed: 4 })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([2, 5]), []);
  assert.equal(events.some((e) => e.type === "allyCast"), false);
  const struck = events.find((e) => e.type === "allyStruck");
  assert.equal(struck.dmg, 6);
  assert.equal(struck.weapon, "Quarter Staff");

  const foe2 = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state2 = fixedState({ party: [muMember({ grimoire: ["Freeze"], spellsUsed: 4 })] });
  state2.combat = fixedCombat([foe2], { allies: [fixedAlly()] });
  const events2 = alliesTurn(state2, fakeRng([4]), []);
  assert.ok(events2.some((e) => e.type === "allyMissed"));
});

test("DFB-05 Magic User: an attack spell above the member's level is not castable -> staff swing", () => {
  const foe = fixedFoe({ type: "Humans", wp: 30, maxWP: 30 });
  const state = fixedState({ party: [muMember({ grimoire: ["Fireball"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  assert.equal(bestAttackSpell({ c: state.party[0] }), null);
  const events = alliesTurn(state, fakeRng([2, 5]), []);
  assert.ok(events.some((e) => e.type === "allyStruck"));
});

test("DFB-05 bestAttackSpell: highest effective level wins, thrown beats status at equal level, none -> null", () => {
  assert.equal(bestAttackSpell({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Doze", "Freeze"] } }).n, "Freeze");
  assert.equal(bestAttackSpell({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Doze"] } }).n, "Doze");
  assert.equal(bestAttackSpell({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: [] } }), null);
  assert.equal(bestAttackSpell({ c: { cls: "Magic User", sub: "Wizard", level: 3, grimoire: ["Freeze", "Fireball"] } }).n, "Fireball");
});

test("DFB-05 legacy fallback: an allies entry with no persistent sheet strikes exactly as before", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ party: [] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 5);
  assert.equal("weapon" in ev, false);

  const foe2 = fixedFoe({ wp: 30, maxWP: 30 });
  const state2 = fixedState({ party: [] });
  state2.combat = fixedCombat([foe2], { allies: [fixedAlly()] });
  const events2 = alliesTurn(state2, fakeRng([9]), []);
  const ev2 = events2.find((e) => e.type === "allyMissed");
  assert.deepEqual(ev2, { type: "allyMissed", name: "Ada" });
});

test("DFB-05 newDay: member spell charges reset with the day; a sheet without the field never gains one", () => {
  const m1 = classedMember({ cls: "Magic User", sub: "Wizard", spellsUsed: 2 });
  const m2 = classedMember({ cls: "Magic User", sub: "Wizard", spellsUsed: 0 });
  delete m2.spellsUsed;
  const state = fixedState({ c: { rations: 6 }, party: [m1, m2] });
  // fed branch: heal d10(5); 8 wandering-monster checks at 2 (never <=1, no encounter).
  newDay(state, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(state.party[0].spellsUsed, 0);
  assert.equal("spellsUsed" in state.party[1], false);
});

// --- DFB-05: narration + toasts for the class-based ally events -------------

test("DFB-05 narration: legacy allyStruck/allyMissed lines are byte-identical without the new fields", () => {
  assert.equal(
    EVENT_NARRATION.allyStruck({ type: "allyStruck", name: "Ada", target: "Dante", dmg: 5 }),
    `Ada lands a hit on Dante for <span class="roll">5</span> hp.`
  );
  assert.equal(EVENT_NARRATION.allyMissed({ type: "allyMissed", name: "Ada" }), "Ada swings and misses.");
  assert.equal(LINE_FOR.allyStruck({ type: "allyStruck", name: "Ada", target: "Dante", dmg: 5 }).text, "Ada lands a hit on Dante (5).");
  assert.equal(LINE_FOR.allyMissed({ type: "allyMissed", name: "Ada" }).text, "Ada swings and misses.");
});

test("DFB-05 narration + toast: backstab, crit and weapon render", () => {
  const backstabEvent = { type: "allyStruck", name: "Bram", target: "Dante", dmg: 14, backstab: true, crit: true, weapon: "Dagger" };
  assert.match(EVENT_NARRATION.allyStruck(backstabEvent), /backstabs Dante with a Dagger/);
  assert.equal(LINE_FOR.allyStruck(backstabEvent).text, "Bram backstabs Dante (14)");

  const critEvent = { type: "allyStruck", name: "Bram", target: "Dante", dmg: 14, crit: true, weapon: "Club" };
  assert.match(EVENT_NARRATION.allyStruck(critEvent), /Critical\./);
  assert.ok(LINE_FOR.allyStruck(critEvent).text.endsWith(" · CRIT"));
});

test("DFB-05 toast: a cast is exactly one toast naming the spell and the outcome", () => {
  let toasts = linesForAction(
    "attack",
    [
      { type: "allyCast", name: "Ysolde", spell: "Freeze", target: "Goblin", roll: 5, need: 6, bonus: 3 },
      { type: "allySpellHit", name: "Ysolde", spell: "Freeze", target: "Goblin", effect: "frozen", dmg: 4 },
    ],
    {}
  );
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].text, "Ysolde casts Freeze — Goblin frozen solid");
  assert.equal(toasts[0].tone, "magic");

  toasts = linesForAction(
    "attack",
    [
      { type: "allyCast", name: "Ysolde", spell: "Doze", target: "Goblin" },
      { type: "allySpellMissed", name: "Ysolde", spell: "Doze", target: "Goblin", resisted: true, roll: 10 },
    ],
    {}
  );
  assert.equal(toasts[0].text, "Ysolde casts Doze — Goblin resists");
  assert.equal(toasts[0].tone, "miss");

  toasts = linesForAction(
    "attack",
    [
      { type: "allyCast", name: "Ysolde", spell: "Fireball", target: "Goblin" },
      { type: "allySpellMissed", name: "Ysolde", spell: "Fireball", target: "Goblin", resisted: false },
    ],
    {}
  );
  assert.equal(toasts[0].text, "Ysolde casts Fireball — misses Goblin");

  toasts = linesForAction(
    "attack",
    [
      { type: "allyCast", name: "Ysolde", spell: "Fireball", target: "Goblin" },
      { type: "allySpellHit", name: "Ysolde", spell: "Fireball", target: "Goblin", effect: "damage", dmg: 12 },
    ],
    {}
  );
  assert.equal(toasts[0].text, "Ysolde casts Fireball — Goblin (12)");
});

test("DFB-05 coverage: allyCast is Oracle-only, the other four ally events are FEATURE_EVENTS with narration and toast, and none throws on a bare payload", () => {
  assert.ok(ORACLE_ONLY.has("allyCast"));
  assert.equal(typeof EVENT_NARRATION.allyCast, "function");
  for (const t of ["allyStruck", "allyMissed", "allySpellHit", "allySpellMissed"]) {
    assert.ok(FEATURE_EVENTS.includes(t), `${t} is a FEATURE_EVENT`);
    const toastText = LINE_FOR[t]({ type: t }).text;
    assert.ok(toastText && toastText.length > 0, `${t} toast text non-empty`);
    const narr = EVENT_NARRATION[t]({ type: t });
    assert.ok(narr && narr.length > 0, `${t} narration non-empty`);
    assert.doesNotMatch(narr, /undefined/);
    assert.doesNotMatch(narr, /NaN/);
  }
});
