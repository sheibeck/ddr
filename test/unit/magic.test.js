// Direct unit coverage for engine/magic.js — castSpell's charge/grimoire
// gating, the Apprentice backfire, a representative sample of spell kinds
// (thrown damage + kill, heal cap, ward, might, earthquake self-damage), and
// drinkPotion/readScroll. The full byte-for-byte prototype comparison lives
// in test/parity/magic-parity.test.js; these tests fill in branches a single
// parity fixture can't reach without hand-crafted character/foe states,
// mirroring test/unit/combat.test.js's established pattern (fakeRng/
// fixedFighter/fixedState/fixedFoe/fixedCombat).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, drinkPotion, readScroll, canRead } from "../../engine/magic.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { setDialsForTuning } from "../../engine/difficulty.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/combat.test.js's
 * helper verbatim). */
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

function fixedWizard(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 31, wp: 31, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

// 04-DR10: full GW x GH (engine/maze.js: 21x21), not an undersized 3x3 —
// castSpell's "reveal" kind (Detect Magic) iterates the WHOLE grid
// unconditionally (`for y in [0,GH) for x in [0,GW)`), so an undersized
// fixture floor throws "Cannot read properties of undefined (reading
// 'wall')" the moment any test exercises that branch.
function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedWizard(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
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

// --- charge / grimoire / school gating --------------------------------

test("castSpell: no charges left is a no-op", () => {
  const state = fixedState({ c: { grimoire: ["Heal"], spellsUsed: 4 } }); // maxCharges(lvl1) = 4
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 4, "no charge consumed");
  assert.equal(state.c.wp, 31, "no effect applied");
  assert.ok(events.some((e) => e.type === "noChargesLeft"));
});

test("castSpell: a spell not in the grimoire is refused", () => {
  const state = fixedState({ c: { grimoire: [] } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellNotKnown"));
});

test("castSpell: a spell above the caster's skill level is refused", () => {
  const state = fixedState({ c: { grimoire: ["Mangle"], level: 1 } }); // Mangle is lvl 5
  const events = castSpell(state, SPELL_IDX.Mangle, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellAboveLevel"));
});

test("castSpell: a school the subclass may not yet work is refused", () => {
  // Sorcerer's healing school is gated to skill level 4 (MU_CHART).
  const state = fixedState({ c: { sub: "Sorcerer", grimoire: ["Heal"], level: 1 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([]), []);
  assert.equal(state.c.spellsUsed, 0);
  assert.ok(events.some((e) => e.type === "spellSchoolLocked"));
});

test("castSpell: an unknown scroll-cast spell ignores grimoire/level gating", () => {
  const state = fixedState({ c: { grimoire: [], level: 1, scrollCast: true } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([10]), []);
  assert.ok(events.some((e) => e.type === "healed"));
});

// --- Apprentice backfire ------------------------------------------------

test("castSpell: an Apprentice's thrown spell can backfire and hurt the caster", () => {
  // Freeze is combatOnly:true (Phase 31 CMB-02) — an empty-foes combat (not
  // `combat: null`) bypasses the new combatOnly guard while keeping the
  // draw sequence untouched: afterPlayerAction sees zero live foes and
  // clears with no further rng consumption.
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 20 }, combat: fixedCombat([]) });
  // d8=1 -> backfire; sp.dmg = {n:1,sides:6}, d6=6 -> self = ceil(6/2) = 3
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 6]), []);
  assert.equal(state.c.wp, 17, "backfire self-damage applied");
  assert.ok(events.some((e) => e.type === "spellBackfired"));
  assert.ok(events.some((e) => e.type === "backfireSelfDamage" && e.amount === 3));
});

test("castSpell: a lethal Apprentice backfire kills the caster", () => {
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 2 }, combat: fixedCombat([]) });
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 6]), []);
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died" && e.cause === "backfire"));
});

// --- damage / kill --------------------------------------------------------

test("castSpell: a thrown damage spell (Fireball) applies rollDice damage and kills the foe on lethal wp", () => {
  // type "Humans" (not Beasts/Lair Beasts) so killFoe skips the optional
  // cooking-check roll and its rng consumption stays exactly 3 draws.
  const foe = fixedFoe({ wp: 10, maxWP: 10, intel: 1, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // toHit d8=1 (bonus 3 for Wizard offense, still a hit); dmg 2d10+4 = 5+5+4=14;
  // killFoe: sp d6=1, coin d10=1, treasure-check d20=20 (skip, >2+lvl)
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 1, 1, 20]), []);
  assert.equal(foe.alive, false, "the foe died");
  assert.equal(foe.wp, 0);
  assert.ok(events.some((e) => e.type === "spellHit" && e.dmg === 14));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

test("castSpell: Fireball (combat-only, thrown) cast with combat: null is refused combatOnly, not a silent nothingToThrowAt no-op", () => {
  // Phase 31 (CMB-02): every combatOnly spell — including every thrown kind,
  // since all of them are combatOnly:true — now refuses BEFORE the targeting
  // logic that used to produce a silent nothingToThrowAt. Zero draws, zero
  // charge spent, zero mutation.
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Fireball"], level: 3, spellsUsed: 0 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "castRefused" && e.spell === "Fireball" && e.reason === "combatOnly"));
  assert.ok(!events.some((e) => e.type === "nothingToThrowAt"));
  assert.equal(state.c.spellsUsed, 0, "no charge consumed");
});

test("castSpell: nothingToThrowAt still fires in-combat when the retarget finds no live foe (an already-cleared encounter)", () => {
  // The retarget line (mirroring playerStrike) resolves C.target to -1 when
  // no foe is alive; nothingToThrowAt is the resulting safe no-op — this is
  // the one remaining path to it (combatOnly no longer routes here outside
  // combat, per the test above).
  const foe = fixedFoe({ alive: false, wp: 0 });
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 }, combat: fixedCombat([foe]) });
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "nothingToThrowAt"));
});

// --- heal / ward / might / earthquake --------------------------------------

test("castSpell: Heal caps at maxWP", () => {
  const state = fixedState({ c: { grimoire: ["Heal"], wp: 25, maxWP: 31 } });
  const events = castSpell(state, SPELL_IDX.Heal, fakeRng([10]), []); // d10=10
  assert.equal(state.c.wp, 31, "healing is capped, not 25+10=35");
  assert.ok(events.some((e) => e.type === "healed" && e.amount === 10));
});

test("castSpell: Shield sets a ward pool/rounds", () => {
  const state = fixedState({ c: { grimoire: ["Shield"] } });
  const events = castSpell(state, SPELL_IDX.Shield, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { pool: 50, rounds: 5, name: "Shield" });
  assert.ok(events.some((e) => e.type === "wardRaised"));
});

// RULES-14 (Phase 75, user 2026-09-25): Bubble is a one-shot mirror now, not
// a bigger Shield — re-pinned from the old reflecting-pool shape. See
// test/unit/bubble-mirror.test.js for the full mirror/pop-pool behaviour.
test("castSpell: Bubble raises an armed mirror, not a soak pool", () => {
  const state = fixedState({ c: { grimoire: ["Bubble"], level: 3 } });
  const events = castSpell(state, SPELL_IDX.Bubble, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null });
  const raised = events.find((e) => e.type === "wardRaised");
  assert.ok(raised);
  assert.equal(raised.mirror, true);
  assert.equal(raised.popPool, 25);
});

test("castSpell: Strength grants +damage and doubles Win Potential once", () => {
  const state = fixedState({ c: { grimoire: ["Strength"], maxWP: 31, wp: 20 } });
  const events = castSpell(state, SPELL_IDX.Strength, fakeRng([10]), []); // d10=10
  assert.equal(state.c.might, 10);
  assert.equal(state.c.strengthBoost, 31);
  assert.equal(state.c.maxWP, 62, "maxWP doubled");
  assert.equal(state.c.wp, 51, "current wp boosted by the same amount");
  assert.ok(events.some((e) => e.type === "strengthCast"));
});

test("castSpell: Earthquake damages every foe AND the caster when unwarded", () => {
  // The foe's wp is set low enough that the quake kills it outright, so the
  // trailing afterPlayerAction() sees an empty encounter and returns before
  // drawing any further foeTurn rolls (matching killFoe's own event chain).
  // type "Humans" so killFoe skips the optional cooking-check roll.
  const foe = fixedFoe({ wp: 30, maxWP: 30, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null },
    combat: fixedCombat([foe]),
  });
  // dmg 3d10+8: d10,d10,d10 = 10,10,10 -> 30+8=38; killFoe: sp d6=1, coin
  // d10=1, treasure-check d20=20 (skip, >2+lvl)
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10, 1, 1, 20]), []);
  assert.equal(foe.wp, 0, "the foe died to the full 38");
  assert.equal(foe.alive, false);
  assert.equal(state.c.wp, 31, "the caster took half (ceil(38/2)=19), with no ward up");
  assert.ok(events.some((e) => e.type === "earthquake" && e.amount === 38));
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage" && e.amount === 19));
  assert.ok(events.some((e) => e.type === "foeKilled"));
});

// Phase 54 (BAND-02, USER RULING D): CLASS_MITIGATION["Magic User"]
// .spellPower scales Earthquake's rolled damage (and, through it, the
// self-damage that is derived FROM the already-scaled amount) via
// engine/difficulty.js#spellDamageFor. Identity (1) reproduces the existing
// pin above exactly; restored after.
test("castSpell: spellPower 1.15 scales Earthquake's rolled damage (38 -> 44) and the self-damage derived from it (19 -> 22)", () => {
  const foe = fixedFoe({ wp: 30, maxWP: 30, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null },
    combat: fixedCombat([foe]),
  });
  const restore = setDialsForTuning({ CLASS_MITIGATION: { "Magic User": { spellPower: 1.15 } } });
  try {
    const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10, 1, 1, 20]), []);
    assert.equal(foe.wp, 0, "the foe still dies to the scaled amount");
    assert.equal(state.c.wp, 50 - 22, "the caster's self-damage is derived from the SCALED amount");
    assert.ok(events.some((e) => e.type === "earthquake" && e.amount === 44));
    assert.ok(events.some((e) => e.type === "earthquakeSelfDamage" && e.amount === 22));
  } finally {
    restore();
  }
});

test("castSpell: Earthquake spares the caster behind a ward (in combat)", () => {
  // Phase 31 (CMB-02): Earthquake is combatOnly:true — moved in-combat (an
  // empty-foes combat, not `combat: null`) so this keeps testing the
  // ward-sparing arithmetic itself rather than the combatOnly guard
  // (covered separately below); an empty foe list also keeps
  // afterPlayerAction's trailing call a zero-draw no-op (encounterCleared).
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: { pool: 10, rounds: 1, name: "Shield" } },
    combat: fixedCombat([]),
  });
  castSpell(state, SPELL_IDX.Earthquake, fakeRng([1, 1, 1]), []);
  assert.equal(state.c.wp, 50, "warded, so no self-damage");
});

test("castSpell: Earthquake (combat-only) cast with combat: null is refused combatOnly, never self-damaging", () => {
  // Phase 31 (CMB-02): the OLD "self-damages for zero benefit" bug this test
  // used to document (Earthquake's self-damage guard fired unconditionally,
  // even with no combat/foes present — RESEARCH §4.4) is now closed: the
  // combatOnly guard refuses the cast before the switch ever runs. Zero
  // draws, zero charge spent, zero self-damage.
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null, spellsUsed: 0 },
    combat: null,
  });
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "castRefused" && e.spell === "Earthquake" && e.reason === "combatOnly"));
  assert.ok(!events.some((e) => e.type === "earthquakeSelfDamage"));
  assert.equal(state.c.wp, 50, "no self-damage — the cast never happened");
  assert.equal(state.c.spellsUsed, 0, "no charge consumed");
});

// --- 04-DR10: out-of-combat casting (Group 2 — content/spells.js#combatOnly) ---
// These document WHY each spell is classified the way it is: a non-combat
// spell's effect branch is unconditional (works with state.combat === null);
// a combatOnly spell now REFUSES outside combat instead of silently doing
// nothing useful or (as Earthquake/Death used to) actively harming the
// caster for zero benefit — Phase 31 (CMB-02) closed that gap engine-side;
// the Grimoire UI (src/browser/viewModels.js#grimoireViewModel) also keeps
// a combatOnly spell's Cast button disabled outside an encounter.

// Phase 40 (SPELL-05, Plan 04): Map the Floor is now a TIME-BOXED,
// re-fogging reveal — see test/unit/map-reveal.test.js for the full
// provenance/timer/sweep/recast/descend/teleport/conditionsOf/tolerant-load
// coverage. This test stays as the minimal "the kind still works with no
// active encounter" smoke check.
test("castSpell: Map the Floor (non-combat) works with no active encounter", () => {
  const state = fixedState({ c: { grimoire: ["Map the Floor"] }, combat: null });
  state.floor.g[2][2].wall = true; // one wall cell, left alone by reveal
  const events = castSpell(state, SPELL_IDX["Map the Floor"], fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "floorMapped" && e.squares === 40));
  assert.equal(state.floor.g[0][0].seen, true, "every non-wall cell is revealed");
  assert.equal(state.floor.g[0][0].spellSeen, true, "a newly-revealed cell carries the provenance flag");
  assert.equal(state.floor.g[2][2].seen, false, "wall cells are left alone");
});

test("castSpell: Sense Presence (non-combat) sets c.senses without a foe present", () => {
  const state = fixedState({ c: { grimoire: ["Sense Presence"], level: 2 } }); // Sense Presence is lvl 2
  const events = castSpell(state, SPELL_IDX["Sense Presence"], fakeRng([]), []);
  assert.equal(state.c.senses, 1);
  assert.ok(events.some((e) => e.type === "sensesGained"));
});

test("castSpell: Sense Danger (non-combat) sets foresight and picks the next encounter type", () => {
  const state = fixedState({ c: { grimoire: ["Sense Danger"], level: 3 } }); // Sense Danger is lvl 3
  const events = castSpell(state, SPELL_IDX["Sense Danger"], fakeRng([]), []);
  assert.equal(state.c.foresight, true);
  assert.ok(events.some((e) => e.type === "senseDanger"));
});

// --- Phase 19: resistance via the shared resistRoll (FOE-07) ---------------

test("castSpell: an intel-12 foe resists Weaken on a raw d20 of 11 (mirrored roll 10 vs atLeast 10) — spellResisted, one d20 then the foe turn", () => {
  const foe = fixedFoe({ intel: 12, wp: 10, maxWP: 10 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Weaken"], level: 1, wp: 10 },
    combat: fixedCombat([foe]),
  });
  // raw 11 -> resistRoll resists (11 < 12; mirrored roll 21-11=10 >= atLeast
  // 22-12=10); tail 7 = foe miss — no round-advance draws, initiative is
  // rolled once, Phase 51 (exactly 2 draws total).
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([11, 7]), []);
  assert.ok(
    events.some(
      (e) =>
        e.type === "spellResisted" &&
        e.target === "Target" &&
        e.spell === "Weaken" &&
        e.roll === 10 &&
        e.atLeast === 10 &&
        e.dieN === 20 &&
        e.intel === 12,
    ),
  );
  assert.ok(!events.some((e) => e.type === "weakened"));
  assert.ok(!state.combat.weakened, "the resisted Weaken never lands");
  assert.equal(state.c.spellsUsed, 1);
});

test("castSpell: a raw d20 of 12 fails to resist — resistFailed { target, roll: 9 (mirrored), atLeast: 10, dieN: 20 } then Weaken lands", () => {
  const foe = fixedFoe({ intel: 12, wp: 10, maxWP: 10 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Weaken"], level: 1, wp: 10 },
    combat: fixedCombat([foe]),
  });
  // raw 12 -> resistRoll fails to resist (12 is NOT < 12; mirrored roll
  // 21-12=9 < atLeast 22-12=10); Phase 40 (SPELL-01) adds ONE d4 draw for
  // the new spell:weaken duration (2 -> rounds 3) between the resist roll
  // and the same foe-miss tail (7) — no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([12, 2, 7]), []);
  assert.ok(
    events.some(
      (e) => e.type === "resistFailed" && e.target === "Target" && e.roll === 9 && e.atLeast === 10 && e.dieN === 20,
    ),
  );
  const weakened = events.find((e) => e.type === "weakened");
  assert.ok(weakened);
  assert.equal(weakened.rounds, 3, "d4(2)+1");
  assert.equal(state.combat.weakened, true, "an unresisted Weaken sets the foe-side weakened flag");
});

test("castSpell: an intel-1 foe never triggers a resist roll (the cast-damage fixture shape)", () => {
  const foe = fixedFoe({ intel: 1, wp: 10, maxWP: 10 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Weaken"], level: 1, wp: 10 },
    combat: fixedCombat([foe]),
  });
  // No leading d20 in the sequence at all — a resist draw here would throw
  // (fakeRng underflow), proving zero draws for an intel-below-12 target.
  // Phase 40 (SPELL-01) adds the ONE d4 duration draw (3 -> rounds 4) ahead
  // of the same foe-miss tail (7) — no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([3, 7]), []);
  assert.ok(!events.some((e) => e.type === "spellResisted"));
  assert.ok(!events.some((e) => e.type === "resistFailed"));
  const weakened = events.find((e) => e.type === "weakened");
  assert.ok(weakened);
  assert.equal(weakened.rounds, 4, "d4(3)+1");
});

test("castSpell: Summon (non-combat) queues a pendingAlly instead of C.ally when there is no encounter", () => {
  const state = fixedState({ c: { grimoire: ["Summon"], level: 2 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([4]), []); // rounds d4=4
  assert.ok(state.c.pendingAlly, "queued for the next encounter");
  assert.equal(state.combat, null, "still no active encounter");
  assert.ok(events.some((e) => e.type === "allyPending"));
});

test("castSpell: Death (combat-only) cast with combat: null is refused combatOnly, never spending its 25wp for nothing", () => {
  // Phase 31 (CMB-02): the OLD "costs 25wp for nothing" bug this test used
  // to document is now closed the same way Earthquake's was — the
  // combatOnly guard refuses before the switch (and before the wp<=26
  // too-weak check) ever runs. Zero draws, zero charge spent, zero wp lost.
  const state = fixedState({ c: { grimoire: ["Death"], level: 5, wp: 40, spellsUsed: 0 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Death, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "castRefused" && e.spell === "Death" && e.reason === "combatOnly"));
  assert.ok(!events.some((e) => e.type === "deathCast"));
  assert.equal(state.c.wp, 40, "no wp spent — the cast never happened");
  assert.equal(state.c.spellsUsed, 0, "no charge consumed");
});

// --- drinkPotion ------------------------------------------------------

test("drinkPotion: heals and decrements the potion count; a no-op with none left", () => {
  const state = fixedState({ c: { potions: 2, wp: 10, maxWP: 40 } });
  const events = drinkPotion(state, fakeRng([10]), []); // 2*10+5 = 25
  assert.equal(state.c.potions, 1);
  assert.equal(state.c.wp, 35);
  assert.ok(events.some((e) => e.type === "potionDrunk" && e.amount === 25));

  const dry = fixedState({ c: { potions: 0 } });
  const noEvents = drinkPotion(dry, fakeRng([]), []);
  assert.equal(noEvents.length, 0);
});

test("drinkPotion: caps at maxWP", () => {
  const state = fixedState({ c: { potions: 1, wp: 38, maxWP: 40 } });
  drinkPotion(state, fakeRng([10]), []); // amount 25, would overflow to 63
  assert.equal(state.c.wp, 40);
});

// --- canRead / readScroll -----------------------------------------------

test("canRead: a Pilfer can never read a scroll; a Magic User always can", () => {
  assert.equal(canRead(fixedState({ c: { sub: "Pilfer", cls: "Thief" } })), false);
  assert.equal(canRead(fixedState({ c: { cls: "Magic User", sub: "Wizard" } })), true);
  assert.equal(canRead(fixedState({ c: { cls: "Fighter", sub: "Knight", skills: {} } })), false);
  assert.equal(canRead(fixedState({ c: { cls: "Fighter", sub: "Knight", skills: { "Runes/Signs": 1 } } })), true);
});

test("readScroll: a learnable, unknown spell is copied into the grimoire instead of cast", () => {
  const state = fixedState({ c: { scrolls: 1, cls: "Magic User", sub: "Wizard", level: 5, grimoire: [] } });
  // pick() defaults to options[0]; Heal (lvl1, healing) is learnable by a Wizard.
  const events = readScroll(state, fakeRng([], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.ok(state.c.grimoire.includes("Heal"));
  assert.ok(events.some((e) => e.type === "scrollCopiedToGrimoire"));
});

test("readScroll: an already-known spell is cast for free, ignoring the charge economy", () => {
  const state = fixedState({
    c: { scrolls: 1, cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal"], spellsUsed: 4, wp: 10, maxWP: 31 },
  });
  const events = readScroll(state, fakeRng([10], { pick: (arr) => arr.find((sp) => sp.n === "Heal") }), []);
  assert.equal(state.c.scrolls, 0);
  assert.equal(state.c.spellsUsed, 4, "the caster's own charge count is restored, untouched");
  assert.equal(state.c.wp, 20, "the heal still applied");
  assert.ok(events.some((e) => e.type === "scrollCast"));
  assert.ok(events.some((e) => e.type === "healed"));
});

test("readScroll: no scrolls or cannot read refuses out loud with a reason, zero draws, no mutation", () => {
  // Phase 25 (FEED-02): the old silent no-op is replaced by a named
  // `scrollRefused` event — zero rng draws either way (fakeRng([]) throws on
  // any draw), and neither branch mutates `c.scrolls`.
  const noScrolls = fixedState({ c: { scrolls: 0, cls: "Magic User" } });
  assert.deepStrictEqual(readScroll(noScrolls, fakeRng([]), []), [{ type: "scrollRefused", reason: "noScrolls" }]);
  assert.equal(noScrolls.c.scrolls, 0);

  const cannotRead = fixedState({ c: { scrolls: 1, cls: "Thief", sub: "Pilfer" } });
  assert.deepStrictEqual(readScroll(cannotRead, fakeRng([]), []), [{ type: "scrollRefused", reason: "pilfer" }]);
  assert.equal(cannotRead.c.scrolls, 1);

  const noRunes = fixedState({ c: { scrolls: 1, cls: "Fighter", sub: "Soldier" } });
  assert.deepStrictEqual(readScroll(noRunes, fakeRng([]), []), [{ type: "scrollRefused", reason: "noRunes" }]);
  assert.equal(noRunes.c.scrolls, 1);
});

// --- Phase 18: damageFoe routing (CANON-04 / CANON-03 / D-06) ---

test("castSpell: a Cleric's Fireball deals double to a Demons foe (CANON-04, D-11)", () => {
  const foe = fixedFoe({ type: "Demons", wp: 40, maxWP: 40, intel: 1 });
  const state = fixedState({
    c: { sub: "Cleric", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // toHit d8=1 (Cleric offense bonus 0, 1-0<=4 hits); dmg 2d10+4 = 5+5+4=14,
  // doubled to 28 vs Demons; then one foe-turn miss (7) — no round-advance
  // draws, Phase 51 — 4 draws total, no armor-soak draw for a spell.
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7]), []);
  const hit = events.find((e) => e.type === "spellHit");
  assert.equal(hit.dmg, 28, "Cleric spell damage doubles vs Demons");
  assert.equal(foe.wp, 12);
  assert.ok(!events.some((e) => e.type === "foeArmorSoaked"));
});

test("castSpell: a Wizard's Fireball does NOT double against Demons (Cleric-only row)", () => {
  const foe = fixedFoe({ type: "Demons", wp: 40, maxWP: 40, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // toHit d8=1 (Wizard offense bonus 3, 1-3<=4 hits); same 14 raw damage,
  // undoubled (Wizard is not a Cleric).
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7]), []);
  const hit = events.find((e) => e.type === "spellHit");
  assert.equal(hit.dmg, 14, "no Cleric-only doubling for a Wizard");
  assert.equal(foe.wp, 26);
});

test("castSpell: any caster's Fireball doubles against Walking Dead (magic x2, D-11)", () => {
  const foe = fixedFoe({ type: "Walking Dead", wp: 40, maxWP: 40, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7]), []);
  const hit = events.find((e) => e.type === "spellHit");
  assert.equal(hit.dmg, 28, "any spell doubles vs Walking Dead, not just Cleric-cast");
  assert.equal(foe.wp, 12);
});

test("castSpell: a spell never draws the armor soak (D-06) — Fireball vs sp.ar 15 lands in full", () => {
  const foe = fixedFoe({ type: "Humans", sp: { ar: 15 }, wp: 40, maxWP: 40, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // The same 6-draw sequence as above — a 7th draw (the armor-soak d20)
  // would throw fakeRng's underflow error if the spell ever reached it.
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7]), []);
  const hit = events.find((e) => e.type === "spellHit");
  assert.equal(hit.dmg, 14, "spells bypass foe armor entirely");
  assert.equal(foe.wp, 26);
  assert.ok(!events.some((e) => e.type === "foeArmorSoaked"));
});

test("castSpell: Earthquake is applied per foe — Walking Dead takes 2x, Humans 1x; earthquake.amount stays the rolled 38", () => {
  const wd = fixedFoe({ type: "Walking Dead", wp: 100, maxWP: 100, intel: 1 });
  const humans = fixedFoe({ name: "Target2", type: "Humans", wp: 100, maxWP: 100, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null },
    combat: fixedCombat([wd, humans]),
  });
  // dmg 3d10+8: 10+10+10+8=38 (mult = max(1,4-4)=1); Walking Dead doubles to
  // 76 (wp 24), Humans stays at 38 (wp 62); then two foe-turn misses (7, 7)
  // — no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10, 7, 7]), []);
  assert.equal(wd.wp, 24, "Walking Dead took the doubled 76");
  assert.equal(humans.wp, 62, "Humans took the unmultiplied 38");
  assert.ok(events.some((e) => e.type === "earthquake" && e.amount === 38), "the event reports the single rolled base");
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage" && e.amount === 19));
  assert.equal(state.c.wp, 31, "caster took ceil(38/2)=19, unaffected by the per-foe multiplier");
});

test("castSpell: Fireballs (volley) totals APPLIED damage — each ball on a halfDmg foe is ceil-halved (CANON-03)", () => {
  const foe = fixedFoe({ type: "Humans", sp: { halfDmg: true }, wp: 50, maxWP: 50, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireballs"], level: 4 },
    combat: fixedCombat([foe]),
  });
  // n=d8=2 balls; ball 1 d10=5 -> 5+2=7 -> ceil(7/2)=4; ball 2 d10=3 -> 3+2=5
  // -> ceil(5/2)=3; total APPLIED = 7 (not the 12 raw); then one foe-turn
  // miss (7) — no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Fireballs, fakeRng([2, 5, 3, 7]), []);
  const volley = events.find((e) => e.type === "volley");
  assert.deepStrictEqual(volley, { type: "volley", rolls: 2, totalDamage: 7 });
  assert.equal(foe.wp, 43);
});

test("castSpell: Insanity r=2 — the foe-on-foe blow is physical and can be soaked by the victim's natural armor (one gated d20, no insaneStruckAlly)", () => {
  const a = fixedFoe({ name: "A", type: "Beasts", lvl: 1, wp: 10, maxWP: 10, intel: 1 });
  const b = fixedFoe({ name: "B", type: "Beasts", sp: { ar: 12 }, wp: 10, maxWP: 10, intel: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Insane"], level: 2 },
    combat: fixedCombat([a, b], { target: 0 }),
  });
  // d6=2 (r=2, the foe-on-foe blow); d = 1*1 + d6=4 = 5; armor-soak d20=5,
  // 5<=12 soaks entirely -> no insaneStruckAlly, B.wp untouched; then two
  // foe-turn misses (7, 7) — no round-advance draws, Phase 51.
  const events = castSpell(state, SPELL_IDX.Insane, fakeRng([2, 4, 5, 7, 7]), []);
  assert.ok(events.some((e) => e.type === "foeArmorSoaked" && e.name === "B" && e.amount === 5));
  assert.ok(!events.some((e) => e.type === "insaneStruckAlly"), "a fully-soaked blow reports no insaneStruckAlly");
  assert.equal(b.wp, 10, "the soaked blow left B untouched");

  const a2 = fixedFoe({ name: "A", type: "Beasts", lvl: 1, wp: 10, maxWP: 10, intel: 1 });
  const b2 = fixedFoe({ name: "B", type: "Beasts", wp: 10, maxWP: 10, intel: 1 }); // no sp.ar -> no soak draw
  const control = fixedState({
    c: { sub: "Wizard", grimoire: ["Insane"], level: 2 },
    combat: fixedCombat([a2, b2], { target: 0 }),
  });
  const controlEvents = castSpell(control, SPELL_IDX.Insane, fakeRng([2, 4, 7, 7]), []);
  assert.ok(controlEvents.some((e) => e.type === "insaneStruckAlly" && e.target === "B" && e.dmg === 5));
  assert.equal(b2.wp, 5, "the unsoaked blow applied the full 5");
});

// --- purity ---------------------------------------------------------------

/** Strip block + line comments before scanning source for forbidden refs. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("magic.js references no Math.random/document/localStorage", () => {
  const src = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "magic.js"), "utf8"));
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\bdocument\b/.test(src));
  assert.ok(!/\blocalStorage\b/.test(src));
});
