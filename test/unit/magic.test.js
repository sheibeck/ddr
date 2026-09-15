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
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 20 } });
  // d8=1 -> backfire; sp.dmg = {n:1,sides:6}, d6=6 -> self = ceil(6/2) = 3
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 6]), []);
  assert.equal(state.c.wp, 17, "backfire self-damage applied");
  assert.ok(events.some((e) => e.type === "spellBackfired"));
  assert.ok(events.some((e) => e.type === "backfireSelfDamage" && e.amount === 3));
});

test("castSpell: a lethal Apprentice backfire kills the caster", () => {
  const state = fixedState({ c: { sub: "Apprentice", grimoire: ["Freeze"], wp: 2 } });
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

test("castSpell: nothing to throw at is a safe no-op (no foe turn)", () => {
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 }, combat: null });
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
  assert.deepStrictEqual(state.c.ward, { pool: 50, rounds: 5, reflect: false, name: "Shield" });
  assert.ok(events.some((e) => e.type === "wardRaised"));
});

test("castSpell: Bubble sets a reflecting ward pool", () => {
  const state = fixedState({ c: { grimoire: ["Bubble"], level: 3 } });
  const events = castSpell(state, SPELL_IDX.Bubble, fakeRng([]), []);
  assert.deepStrictEqual(state.c.ward, { pool: 100, rounds: 12, reflect: true, name: "Bubble" });
  assert.ok(events.some((e) => e.type === "wardRaised" && e.reflect === true));
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

test("castSpell: Earthquake spares the caster behind a ward", () => {
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: { pool: 10, rounds: 1, reflect: false, name: "Shield" } },
    combat: null,
  });
  castSpell(state, SPELL_IDX.Earthquake, fakeRng([1, 1, 1]), []);
  assert.equal(state.c.wp, 50, "warded, so no self-damage");
});

// --- 04-DR10: out-of-combat casting (Group 2 — content/spells.js#combatOnly) ---
// These document WHY each spell is classified the way it is: a non-combat
// spell's effect branch is unconditional (works with state.combat === null);
// a combat-only spell's branch needs a live foe/encounter to do anything
// useful, and some (Earthquake, Death) actively harm the caster for zero
// benefit when cast with nothing to fight — engine/magic.js#castSpell is a
// faithful, unconditional port of the prototype and is NOT gated here; the
// Grimoire UI (src/browser/viewModels.js#grimoireViewModel) is what refuses
// to offer a combat-only spell's Cast button outside an encounter.

test("castSpell: Detect Magic (non-combat) works with no active encounter", () => {
  const state = fixedState({ c: { grimoire: ["Detect Magic"] }, combat: null });
  state.floor.g[2][2].wall = true; // one wall cell, left alone by reveal
  const events = castSpell(state, SPELL_IDX["Detect Magic"], fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "detectMagic"));
  assert.equal(state.floor.g[0][0].seen, true, "every non-wall cell is revealed");
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

test("castSpell: an intel-12 foe resists Weaken on a d20 of 11 — spellResisted payload unchanged, one d20 then the foe turn", () => {
  const foe = fixedFoe({ intel: 12, wp: 10, maxWP: 10 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Weaken"], level: 1, wp: 10 },
    combat: fixedCombat([foe]),
  });
  // 11 -> resistRoll resists (11 < 12); tail 7/15/10 = foe miss + two
  // initiative draws inside afterPlayerAction (traced against this exact
  // fixture — exactly 4 draws total, no more).
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([11, 7, 15, 10]), []);
  assert.ok(
    events.some((e) => e.type === "spellResisted" && e.target === "Target" && e.spell === "Weaken" && e.roll === 11 && e.intel === 12),
  );
  assert.ok(!events.some((e) => e.type === "weakened"));
  assert.ok(!state.combat.weakened, "the resisted Weaken never lands");
  assert.equal(state.c.spellsUsed, 1);
});

test("castSpell: a d20 of 12 fails to resist — resistFailed { target, roll: 12 } then Weaken lands", () => {
  const foe = fixedFoe({ intel: 12, wp: 10, maxWP: 10 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Weaken"], level: 1, wp: 10 },
    combat: fixedCombat([foe]),
  });
  // 12 -> resistRoll fails to resist (12 is NOT < 12); same 7/15/10 tail.
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([12, 7, 15, 10]), []);
  assert.ok(events.some((e) => e.type === "resistFailed" && e.target === "Target" && e.roll === 12));
  assert.ok(events.some((e) => e.type === "weakened"));
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
  const events = castSpell(state, SPELL_IDX.Weaken, fakeRng([7, 15, 10]), []);
  assert.ok(!events.some((e) => e.type === "spellResisted"));
  assert.ok(!events.some((e) => e.type === "resistFailed"));
  assert.ok(events.some((e) => e.type === "weakened"));
});

test("castSpell: Summon (non-combat) queues a pendingAlly instead of C.ally when there is no encounter", () => {
  const state = fixedState({ c: { grimoire: ["Summon"], level: 2 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([4]), []); // rounds d4=4
  assert.ok(state.c.pendingAlly, "queued for the next encounter");
  assert.equal(state.combat, null, "still no active encounter");
  assert.ok(events.some((e) => e.type === "allyPending"));
});

test("castSpell: Earthquake (combat-only) cast with no foes present still self-damages for zero benefit", () => {
  // Documents WHY Earthquake is combatOnly:true — liveFoes() is empty with no
  // state.combat, so nothing is hurt, but the caster's own self-damage guard
  // (`if (!c.ward)`) fires unconditionally regardless of combat state.
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Earthquake"], level: 4, wp: 50, maxWP: 50, ward: null },
    combat: null,
  });
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10]), []); // 3d10+8=38
  assert.equal(state.c.wp, 31, "self-damage (ceil(38/2)=19) applies with nothing gained");
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage"));
});

test("castSpell: Death (combat-only) cast with no foe present still costs 25wp for nothing", () => {
  const state = fixedState({ c: { grimoire: ["Death"], level: 5, wp: 40 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Death, fakeRng([]), []);
  assert.equal(state.c.wp, 15, "25wp spent regardless of whether a foe existed");
  assert.ok(events.some((e) => e.type === "deathCast"));
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
  // doubled to 28 vs Demons; then one foe-turn miss (7) and fresh initiative
  // (15 vs 10 -> "you") — 6 draws total, no armor-soak draw for a spell.
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7, 15, 10]), []);
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
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7, 15, 10]), []);
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
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7, 15, 10]), []);
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
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 7, 15, 10]), []);
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
  // and fresh initiative (15 vs 10 -> "you").
  const events = castSpell(state, SPELL_IDX.Earthquake, fakeRng([10, 10, 10, 7, 7, 15, 10]), []);
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
  // miss (7) and fresh initiative (15 vs 10 -> "you").
  const events = castSpell(state, SPELL_IDX.Fireballs, fakeRng([2, 5, 3, 7, 15, 10]), []);
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
  // foe-turn misses (7, 7) and fresh initiative (15 vs 10 -> "you").
  const events = castSpell(state, SPELL_IDX.Insane, fakeRng([2, 4, 5, 7, 7, 15, 10]), []);
  assert.ok(events.some((e) => e.type === "foeArmorSoaked" && e.name === "B" && e.amount === 5));
  assert.ok(!events.some((e) => e.type === "insaneStruckAlly"), "a fully-soaked blow reports no insaneStruckAlly");
  assert.equal(b.wp, 10, "the soaked blow left B untouched");

  const a2 = fixedFoe({ name: "A", type: "Beasts", lvl: 1, wp: 10, maxWP: 10, intel: 1 });
  const b2 = fixedFoe({ name: "B", type: "Beasts", wp: 10, maxWP: 10, intel: 1 }); // no sp.ar -> no soak draw
  const control = fixedState({
    c: { sub: "Wizard", grimoire: ["Insane"], level: 2 },
    combat: fixedCombat([a2, b2], { target: 0 }),
  });
  const controlEvents = castSpell(control, SPELL_IDX.Insane, fakeRng([2, 4, 7, 7, 15, 10]), []);
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
