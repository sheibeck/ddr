// test/unit/party-abilities.test.js
//
// Phase 38 Plan 04 (ABIL-05) — direct coverage for engine/combat.js's Joiner
// class-driven ability policy: pickMemberAbility (pure), resolveMemberAbility
// (all 20 member resolutions via the shared abilities.js primitives), the
// alliesTurn ability branch's zero-draw fall-through, memberStrike's `mod`
// parameter, the foeTurn member-branch need shifts/riposte/brace hooks,
// pickFoeTarget's member Taunt bypass, the per-member tick/clear sites, and
// derived.js#partyEffectActive. Local helper copies (fakeRng/fixedFighter/
// fixedFloor/fixedState/fixedFoe/fixedCombat/fixedAlly/fixedMember/
// classedMember) mirror test/unit/party-combat.test.js verbatim — this
// repo's established per-file-fixture convention (never imported
// cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import { startCombat, alliesTurn, foeTurn, endCombat, pickFoeTarget, pickMemberAbility } from "../../engine/combat.js";
import { isReady, remaining, startEffect, startCooldown, clearRoundTimers } from "../../engine/effects.js";
import { abilityEffectActive, partyEffectActive, foeToHitVs, foeToHitBreakdown, DEATH_PANIC_THRESHOLD } from "../../engine/derived.js";

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (a "no more draws expected"
 * assertion). */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
  };
}

// A generous tail of harmless filler draws for a scenario that KILLS a foe —
// killFoe's own sp/coin/loot-gate/cooking draws are not the point of these
// tests; 20 is safe for every one of them (no loot-gate hit at f.lvl 1, no
// Cooking-skill branch, "Humans" type skips the cooking check entirely).
const FILL = new Array(20).fill(20);

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
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
    name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return {
    foes, type: foes[0]?.type || "Beasts", round: 1, target: 0,
    pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    ...overrides,
  };
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
 * Thief scenarios below. Phase 38: `abilities: []` by default (no ability
 * key on this fixture is the zero-draw fall-through gate). */
function classedMember(overrides = {}) {
  return fixedMember({
    cls: "Fighter", sub: "Knight", race: "Human", weapon: "Club", prof: 2, magicWpn: 0, might: 0,
    items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. pickMemberAbility — pure policy matrix (no rng)
// ---------------------------------------------------------------------------

test("pickMemberAbility: round 1 picks the first READY opener over a ready damage ability (opener preferred, round 1 only)", () => {
  const sheet = classedMember({ abilities: ["kata", "pommelStrike"] });
  const ally = fixedAlly();
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  const meta = pickMemberAbility(sheet, ally, 1, target);
  assert.equal(meta.id, "pommelStrike");
});

test("pickMemberAbility: round 2 vs a full-hp foe picks the first READY damage ability", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  const ally = fixedAlly();
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  const meta = pickMemberAbility(sheet, ally, 2, target);
  assert.equal(meta.id, "kata");
});

test("pickMemberAbility: round 2 vs a foe under half hp with the member at full hp picks nothing (plain strike)", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  const ally = fixedAlly({ wp: 20, maxWP: 20 });
  const target = fixedFoe({ wp: 10, maxWP: 30 });
  assert.equal(pickMemberAbility(sheet, ally, 2, target), null);
});

test("pickMemberAbility: round 2 with the member under half hp picks the first READY defensive ability", () => {
  const sheet = classedMember({ abilities: ["brace"] });
  const ally = fixedAlly({ wp: 5, maxWP: 20 });
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  const meta = pickMemberAbility(sheet, ally, 2, target);
  assert.equal(meta.id, "brace");
});

test("pickMemberAbility: lastStand vs a full-hp foe is skipped unless the member is at/below the death-panic threshold", () => {
  const sheet = classedMember({ abilities: ["lastStand"] });
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  assert.equal(pickMemberAbility(sheet, fixedAlly({ wp: 20, maxWP: 20 }), 2, target), null, "full hp — skipped");
  const meta = pickMemberAbility(sheet, fixedAlly({ wp: 5, maxWP: 20 }), 2, target);
  assert.equal(meta.id, "lastStand", "at/below 25% — allowed");
});

test("pickMemberAbility: an owned ability of the OTHER class is ignored (T-38-09)", () => {
  const sheet = classedMember({ cls: "Fighter", abilities: ["feint"] }); // Thief-only id
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  assert.equal(pickMemberAbility(sheet, fixedAlly(), 2, target), null);
});

test("pickMemberAbility: an unknown id is ignored", () => {
  const sheet = classedMember({ abilities: ["notARealAbility"] });
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  assert.equal(pickMemberAbility(sheet, fixedAlly(), 2, target), null);
});

test("pickMemberAbility: a cooldown-phase ability is not READY", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  startEffect(sheet, "ability:kata", { rounds: 1, cd: 3 }); // will still read effect-phase not-ready
  sheet.timers["ability:kata"].phase = "cooldown";
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  assert.equal(pickMemberAbility(sheet, fixedAlly(), 2, target), null);
});

test("pickMemberAbility: sheet.abilities order breaks ties among equally-tagged ready abilities", () => {
  const sheet = classedMember({ abilities: ["overheadBlow", "kata"] }); // both tag: damage
  const target = fixedFoe({ wp: 30, maxWP: 30 });
  const meta = pickMemberAbility(sheet, fixedAlly(), 2, target);
  assert.equal(meta.id, "overheadBlow");
});

// ---------------------------------------------------------------------------
// 2. Zero-draw fall-through — DFB-05 identity preserved
// ---------------------------------------------------------------------------

test("zero-draw fall-through: no abilities key produces today's plain strike, byte-identical", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember(); // abilities: []
  delete sheet.abilities;
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 23);
  const ev = events.find((e) => e.type === "allyStruck");
  assert.equal(ev.dmg, 7);
  assert.equal(events.some((e) => e.type === "memberAbilityUsed"), false);
});

test("zero-draw fall-through: abilities: [] produces today's plain strike", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ abilities: [] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 23);
  assert.equal(events.some((e) => e.type === "memberAbilityUsed"), false);
});

test("zero-draw fall-through: only Thief ids planted on a Fighter member falls through", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const state = fixedState({ party: [classedMember({ abilities: ["feint", "silentStep"] })] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 23);
  assert.equal(events.some((e) => e.type === "memberAbilityUsed"), false);
});

test("zero-draw fall-through: every ability on cooldown falls through", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["kata"] });
  startEffect(sheet, "ability:kata", { rounds: 3 });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()] });
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  assert.equal(foe.wp, 23);
  assert.equal(events.some((e) => e.type === "memberAbilityUsed"), false);
});

// ---------------------------------------------------------------------------
// 3. Strike-kind resolutions via memberStrike(mod)
// ---------------------------------------------------------------------------

test("kata/feint: auto-hit, +level damage, memberAbilityUsed is the first event, timer starts on the SHEET not `ally`", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["kata"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly();
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // roll=20 would normally miss (need 5) — autoHit ignores it; weaponDamage d6=4.
  const events = alliesTurn(state, fakeRng([20, 4]), []);
  assert.equal(events[0].type, "memberAbilityUsed");
  assert.equal(events[0].name, "Ada");
  assert.equal(events[0].key, "kata");
  assert.equal(events[0].target, "Target");
  // dmg = level^2(1) + base(4) + prof(2) + bonusDmg(level 1) = 8
  assert.equal(foe.wp, 22);
  assert.equal(isReady(sheet, "ability:kata"), false);
  assert.equal("timers" in ally, false, "the transient C.allies entry never gains a timers key");
});

test("silentStep: auto-hit + forced crit, denied by heavy armor for a Thief (round 1, opener)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ cls: "Thief", sub: "Pickpocket", weapon: "Dagger", prof: 0, armor: "Leather", abilities: ["silentStep"] });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly({ backstabUsed: true })], round: 1 });
  const events = alliesTurn(state, fakeRng([20, 4]), []);
  const struck = events.find((e) => e.type === "allyStruck");
  assert.equal(struck.crit, true);
  assert.equal(struck.via, "silentStep");

  const foe2 = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet2 = classedMember({ cls: "Thief", sub: "Pickpocket", weapon: "Dagger", prof: 0, armor: "Plate", abilities: ["silentStep"] });
  const state2 = fixedState({ party: [sheet2] });
  state2.combat = fixedCombat([foe2], { allies: [fixedAlly({ backstabUsed: true })], round: 1 });
  const events2 = alliesTurn(state2, fakeRng([20, 4]), []);
  const struck2 = events2.find((e) => e.type === "allyStruck");
  assert.equal("crit" in struck2, false, "heavy armor denies the forced crit");
});

test("deathTouch: finishes a foe under 15 hp (event carries member) — the weaponDamage roll is still consumed, then discarded", () => {
  const foe = fixedFoe({ wp: 14, maxWP: 20 }); // above half (damage-tag eligible) but under 15 (finish-eligible)
  const sheet = classedMember({ sub: "Knight", abilities: ["deathTouch"] });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()], round: 2 });
  // roll=3 lands normally (need 5); weaponDamage base draw is still consumed
  // even though discarded; FILL covers killFoe's own sp/coin/loot-gate draws.
  const events = alliesTurn(state, fakeRng([3, 4, ...FILL]), []);
  const dt = events.find((e) => e.type === "deathTouch");
  assert.ok(dt);
  assert.equal(dt.target, "Target");
  assert.equal(dt.member, "Ada");
  assert.equal(foe.alive, false);
});

test("overheadBlow: needShift -2 (floor 1) and dmgMul 2", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["overheadBlow"] });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [fixedAlly()], round: 2 });
  // memberToHit Fighter Human = 5; needShift -2 => need 3. roll 3 hits.
  const events = alliesTurn(state, fakeRng([3, 4]), []);
  const struck = events.find((e) => e.type === "allyStruck");
  // dmg = (1 + 4 + 2) * 2 = 14
  assert.equal(struck.dmg, 14);
  assert.equal(struck.via, "overheadBlow");
});

test("lastStand: three attacks this round, lastStandCalled carries member", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 }); // full hp — eligible for the "damage" tag filter
  const sheet = classedMember({ abilities: ["lastStand"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly({ wp: 4, maxWP: 20 }); // at/below 25% — lastStand's own extra gate
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // three (roll, weaponDamage) pairs — every roll lands (need 5).
  const events = alliesTurn(state, fakeRng([3, 4, 3, 4, 3, 4]), []);
  const called = events.find((e) => e.type === "lastStandCalled");
  assert.equal(called.attacks, 3);
  assert.equal(called.member, "Ada");
  const struck = events.filter((e) => e.type === "allyStruck");
  assert.equal(struck.length, 3, "three attacks this round");
  assert.equal(foe.wp, 30 - 3 * 7);
});

test("lastStand: stops early once the foe dies", () => {
  const foe = fixedFoe({ wp: 6, maxWP: 30 }); // dies to the first attack (dmg 7)
  const sheet = classedMember({ abilities: ["lastStand"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly({ wp: 4, maxWP: 20 });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // one (roll, weaponDamage) pair — the loop stops before a second/third
  // attack once the foe is dead; FILL covers killFoe's own draws.
  const events = alliesTurn(state, fakeRng([3, 4, ...FILL]), []);
  const struck = events.filter((e) => e.type === "allyStruck");
  assert.equal(struck.length, 1);
  assert.equal(foe.alive, false);
});

// ---------------------------------------------------------------------------
// 4. Foe-flag kinds — shared appliers + member-tagged events
// ---------------------------------------------------------------------------

test("pommelStrike/dirtyTrick/poisonedEdge/hamstring/mark: set the shared foe flags and narrate with `member`", () => {
  const cases = [
    { id: "pommelStrike", cls: "Fighter", type: "pommelStruck", check: (f) => f.stunned === true },
    { id: "dirtyTrick", cls: "Thief", type: "dirtyTrickLanded", check: (f) => f.blind === true && f.blindFor === 2 },
    { id: "poisonedEdge", cls: "Thief", type: "poisonedEdgeApplied", check: (f) => f.dot && f.dot.left === 3 },
    { id: "hamstring", cls: "Thief", type: "hamstrung", check: (f) => f.hamstrung === true },
    { id: "mark", cls: "Thief", type: "marked", check: (f) => f.marked === true },
  ];
  for (const { id, cls, type, check } of cases) {
    const foe = fixedFoe({ wp: 30, maxWP: 30 });
    const sheet = classedMember({ cls, abilities: [id] });
    const state = fixedState({ party: [sheet] });
    // round 1: pommelStrike/dirtyTrick/hamstring/mark are tag "opener";
    // poisonedEdge is tag "damage" (falls through round 1's opener check to
    // the target-above-half-hp check, which the default full-hp foe satisfies).
    state.combat = fixedCombat([foe], { allies: [fixedAlly()], round: 1 });
    const events = alliesTurn(state, fakeRng([]), []); // zero draws — none of these strike
    const ev = events.find((e) => e.type === type);
    assert.ok(ev, `${id} did not push ${type}`);
    assert.equal(ev.member, "Ada", `${id}'s event should carry member`);
    assert.ok(check(foe), `${id} did not set its foe flag`);
  }
});

test("cutpurse: rng.d(10) * level gold, paid to the HERO via gainWilmst", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ cls: "Thief", abilities: ["cutpurse"] });
  const state = fixedState({ party: [sheet] });
  const goldBefore = state.c.gold;
  state.combat = fixedCombat([foe], { allies: [fixedAlly()], round: 2 });
  const events = alliesTurn(state, fakeRng([7]), []); // d10 -> 7 * level 1 = 7
  const ev = events.find((e) => e.type === "cutpursed");
  assert.equal(ev.amount, 7);
  assert.equal(ev.member, "Ada");
  assert.equal(state.c.gold, goldBefore + 7);
});

test("secondWind: heals rng.d(8)+level, capped at maxWP, memberSecondWind names amount", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["secondWind"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly({ wp: 8, maxWP: 20 }); // strictly below half (< 10)
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  const events = alliesTurn(state, fakeRng([5]), []); // heal = 5 + 1 = 6
  const ev = events.find((e) => e.type === "memberSecondWind");
  assert.equal(ev.amount, 6);
  assert.equal(ally.wp, 14);
});

test("sweep: half weapon damage to every live foe, memberSwept + sweptFoe", () => {
  const foes = [fixedFoe({ name: "A", wp: 30, maxWP: 30 }), fixedFoe({ name: "B", wp: 30, maxWP: 30 })];
  const sheet = classedMember({ abilities: ["sweep"] });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat(foes, { allies: [fixedAlly()], round: 2 });
  // weaponDamage base d6=4 -> (1+4+2)=7, ceil(7/2)=4
  const events = alliesTurn(state, fakeRng([4]), []);
  const ev = events.find((e) => e.type === "memberSwept");
  assert.equal(ev.dmg, 4);
  assert.equal(ev.count, 2);
  assert.equal(foes[0].wp, 26);
  assert.equal(foes[1].wp, 26);
});

test("brace: sets ally.braced, braced event carries member", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["brace"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly({ wp: 5, maxWP: 20 }); // below half -> defensive picked
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  const events = alliesTurn(state, fakeRng([]), []);
  assert.equal(ally.braced, true);
  const ev = events.find((e) => e.type === "braced");
  assert.equal(ev.member, "Ada");
});

// riposte/taunt/sidestep/smoke are tag: "defensive" — picked with a
// below-half-hp member outside round 1.
for (const [id, cls, type] of [
  ["riposte", "Fighter", "riposteReady"],
  ["taunt", "Fighter", "taunted"],
  ["sidestep", "Fighter", "sidestepped"],
  ["smoke", "Thief", "smokeThrown"],
]) {
  test(`${id}: starts its timer and narrates ${type} with member`, () => {
    const foe = fixedFoe({ wp: 30, maxWP: 30 });
    const sheet = classedMember({ cls, abilities: [id] });
    const state = fixedState({ party: [sheet] });
    const ally = fixedAlly({ wp: 5, maxWP: 20 });
    state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
    const events = alliesTurn(state, fakeRng([]), []);
    const ev = events.find((e) => e.type === type);
    assert.ok(ev, `${id} did not push ${type}`);
    assert.equal(ev.member, "Ada");
    assert.equal(isReady(sheet, `ability:${id}`), false);
  });
}

// battleRoar is tag: "opener" — picked in round 1 only.
test("battleRoar: starts its timer and narrates battleRoarRaised with member (round 1, opener)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: ["battleRoar"] });
  const state = fixedState({ party: [sheet] });
  const ally = fixedAlly();
  state.combat = fixedCombat([foe], { allies: [ally], round: 1 });
  const events = alliesTurn(state, fakeRng([]), []);
  const ev = events.find((e) => e.type === "battleRoarRaised");
  assert.ok(ev);
  assert.equal(ev.member, "Ada");
  assert.equal(isReady(sheet, "ability:battleRoar"), false);
});

// ---------------------------------------------------------------------------
// 5. foeTurn member-branch hooks: Sidestep/Smoke need shifts, Riposte, Brace
// ---------------------------------------------------------------------------

test("foeTurn member branch: the member's OWN Sidestep shifts its own need (-2, floor 1)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: [] });
  startEffect(sheet, "ability:sidestep", { rounds: 2 });
  const ally = fixedAlly();
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // pool pick 2 -> member; mRoll 4 vs need 3 (5 - 2) -> miss.
  const events = foeTurn(state, fakeRng([2, 4]), []);
  const missed = events.find((e) => e.type === "foeMissed");
  assert.ok(missed);
  assert.equal(missed.member, "Ada");
  assert.equal(missed.need, 3);
  assert.ok(missed.needMods.some((m) => m.name === "Sidestep" && m.delta === -2));
});

test("foeTurn member branch: the member's OWN Smoke overrides its own need to 1", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: [] });
  startEffect(sheet, "ability:smoke", { rounds: 2 });
  const ally = fixedAlly();
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // pool pick 2 -> member; mRoll 2 vs need 1 -> miss.
  const events = foeTurn(state, fakeRng([2, 2]), []);
  const missed = events.find((e) => e.type === "foeMissed");
  assert.ok(missed);
  assert.equal(missed.need, 1);
  assert.ok(missed.needMods.some((m) => m.name === "Smoke"));
});

test("foeTurn member branch: the member's OWN Riposte counters a miss on THAT member", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: [] });
  startEffect(sheet, "ability:riposte", { rounds: 1 });
  const ally = fixedAlly();
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // pool pick 2 -> member; mRoll 20 -> miss (need 5); riposte counter: weaponDamage base d6=4 -> dmg 7.
  const events = foeTurn(state, fakeRng([2, 20, 4]), []);
  const rip = events.find((e) => e.type === "memberRiposted");
  assert.ok(rip);
  assert.equal(rip.name, "Ada");
  assert.equal(rip.target, "Target");
  assert.equal(rip.dmg, 7);
  assert.equal(foe.wp, 23);
});

test("foeTurn: a member's Riposte does not fire when the foe misses the HERO instead", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: [] });
  startEffect(sheet, "ability:riposte", { rounds: 1 });
  const ally = fixedAlly();
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // pool pick 1 -> hero; hero-branch roll 20 -> miss; hero's own riposte is
  // inactive (only the member's sheet carries the timer) — no counter.
  const events = foeTurn(state, fakeRng([1, 20]), []);
  assert.equal(events.some((e) => e.type === "memberRiposted"), false);
  assert.equal(events.some((e) => e.type === "riposted"), false);
});

test("foeTurn member branch: the member's OWN Brace halves the next landed blow once, then clears", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30 });
  const sheet = classedMember({ abilities: [] });
  const ally = fixedAlly({ wp: 20, maxWP: 20, braced: true });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([foe], { allies: [ally], round: 2 });
  // pool pick 2 -> member; mRoll 3 hits (need 5); mDmg = 1 + 6 = 7, halved to 4.
  const events = foeTurn(state, fakeRng([2, 3, 6]), []);
  const braceHeld = events.find((e) => e.type === "braceHeld");
  assert.ok(braceHeld);
  assert.equal(braceHeld.member, "Ada");
  assert.equal(ally.braced, false);
  const struck = events.find((e) => e.type === "memberStruck");
  assert.equal(struck.dmg, 4);
  assert.equal(ally.wp, 16);
});

// ---------------------------------------------------------------------------
// 6. pickFoeTarget: a member's own Taunt
// ---------------------------------------------------------------------------

test("pickFoeTarget: a member's OWN Taunt makes every foe target that member without drawing", () => {
  const sheetA = classedMember({});
  const sheetB = classedMember({});
  startEffect(sheetB, "ability:taunt", { rounds: 1 });
  const allyA = fixedAlly({ name: "Ada", partyIdx: 0, wp: 20 });
  const allyB = fixedAlly({ name: "Beo", partyIdx: 1, wp: 20 });
  const state = { combat: { foes: [], allies: [allyA, allyB] }, party: [sheetA, sheetB] };
  const target = pickFoeTarget(state, fakeRng([]));
  assert.equal(target.name, "Beo");
});

test("pickFoeTarget: the hero's own Taunt still wins over a member's Taunt (checked first)", () => {
  const sheetA = classedMember({});
  startEffect(sheetA, "ability:taunt", { rounds: 1 });
  const allyA = fixedAlly({ name: "Ada", partyIdx: 0, wp: 20 });
  const state = { c: fixedFighter(), combat: { foes: [], allies: [allyA] }, party: [sheetA] };
  startEffect(state.c, "ability:taunt", { rounds: 1 });
  assert.equal(pickFoeTarget(state, fakeRng([])), null);
});

// ---------------------------------------------------------------------------
// 7. Per-member tick/clear sites
// ---------------------------------------------------------------------------

test("tick: a live member's own sheet.timers rounds-cadence record ticks once per foeTurn call", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  startCooldown(sheet, "ability:kata", { rounds: 3 });
  const ally = fixedAlly({ wp: 20, maxWP: 20 });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([], { allies: [ally], round: 2 });
  foeTurn(state, fakeRng([]), []);
  assert.equal(remaining(sheet, "ability:kata"), 2);
});

test("tick: a downed member's sheet is NOT ticked", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  startCooldown(sheet, "ability:kata", { rounds: 3 });
  const ally = fixedAlly({ wp: 0, maxWP: 20 }); // downed
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([], { allies: [ally], round: 2 });
  foeTurn(state, fakeRng([]), []);
  assert.equal(remaining(sheet, "ability:kata"), 3);
});

test("tick: a sheet without timers gains no key", () => {
  const sheet = classedMember({ abilities: [] });
  const ally = fixedAlly({ wp: 20, maxWP: 20 });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([], { allies: [ally], round: 2 });
  foeTurn(state, fakeRng([]), []);
  assert.equal("timers" in sheet, false);
});

test("clear: endCombat clears every surviving member's rounds records, leaves a squares record alone", () => {
  const sheet = classedMember({ abilities: ["kata"] });
  startCooldown(sheet, "ability:kata", { rounds: 3 });
  startEffect(sheet, "campfire", { squares: 5 });
  const ally = fixedAlly({ wp: 20, maxWP: 20, partyIdx: 0 });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([], { allies: [ally] });
  endCombat(state, []);
  assert.equal(isReady(sheet, "ability:kata"), true);
  assert.equal(remaining(sheet, "campfire"), 5);
});

// ---------------------------------------------------------------------------
// 8. derived.js#partyEffectActive
// ---------------------------------------------------------------------------

test("partyEffectActive: false with no party, no combat, no allies, a downed member, or a cooldown-phase record", () => {
  assert.equal(partyEffectActive({ party: null, combat: { allies: [] } }, "battleRoar"), false, "no party");
  assert.equal(partyEffectActive({ party: [classedMember()] }, "battleRoar"), false, "no combat");
  assert.equal(partyEffectActive({ party: [classedMember()], combat: {} }, "battleRoar"), false, "no allies");

  const sheet = classedMember({});
  startEffect(sheet, "ability:battleRoar", { rounds: 2, cd: 5 });
  const downedAlly = fixedAlly({ partyIdx: 0, wp: 0 });
  assert.equal(
    partyEffectActive({ party: [sheet], combat: { allies: [downedAlly] } }, "battleRoar"),
    false,
    "a downed carrier does not count",
  );

  const sheet2 = classedMember({});
  startCooldown(sheet2, "ability:battleRoar", { rounds: 3 });
  const liveAlly = fixedAlly({ partyIdx: 0, wp: 20 });
  assert.equal(
    partyEffectActive({ party: [sheet2], combat: { allies: [liveAlly] } }, "battleRoar"),
    false,
    "a cooldown-phase record does not count",
  );
});

test("partyEffectActive: true when a LIVE member's own sheet carries a live effect for the key", () => {
  const sheet = classedMember({});
  startEffect(sheet, "ability:battleRoar", { rounds: 2, cd: 5 });
  const ally = fixedAlly({ partyIdx: 0, wp: 20 });
  assert.equal(partyEffectActive({ party: [sheet], combat: { allies: [ally] } }, "battleRoar"), true);
});

test("foeToHitVs/foeToHitBreakdown: a member's OWN Battle Roar shifts the hero's own to-hit too (party-wide)", () => {
  const sheet = classedMember({});
  startEffect(sheet, "ability:battleRoar", { rounds: 2, cd: 5 });
  const ally = fixedAlly({ wp: 20 });
  const state = fixedState({ party: [sheet] });
  state.combat = fixedCombat([], { allies: [ally] });
  assert.equal(foeToHitVs(state), 3); // 5 - 2
  const bd = foeToHitBreakdown(state);
  assert.equal(bd.need, 3);
  assert.ok(bd.mods.some((m) => m.name === "Battle Roar" && m.delta === -2));
  assert.equal(bd.need, foeToHitVs(state), "twin equality (must_haves)");
});
