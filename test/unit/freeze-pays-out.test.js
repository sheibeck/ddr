// Phase 23 Plan 04 (IDENT-01..04, FID-06): unit coverage for the "Freeze
// pays out" rules change — a successful Freeze now routes its kill through
// engine/combat.js#killFoe (experience via killSpFor, coin, treasure roll,
// kill count, party split) instead of only flagging the foe dead, and
// castSpell's spellAboveLevel diagnostic now reads the effective level
// through engine/derived.js#spellLevelFor (the same helper canCast already
// uses), so the two can never disagree.
//
// Helpers (fakeRng/fixedWizard/fixedState/fixedFloor/fixedFoe/fixedCombat)
// are copied verbatim from test/unit/magic.test.js's established pattern —
// see that file's header for the full rationale.

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { killSpFor } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows. */
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

// --- a successful Freeze kill pays out --------------------------------

test("castSpell: a Freeze kill pays sp/coin/kill count exactly like a melee kill, and frozenSolid still narrates it", () => {
  const foe = fixedFoe({ wp: 3, maxWP: 3, lvl: 1, intel: 1, lives: 1, type: "Beasts" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Freeze"], level: 1 },
    combat: fixedCombat([foe]),
  });
  // d10=1 (hit: 1 - bonus 3 <= 6); d6=3 (dmg); killFoe: d6=4 (sp roll), d10=5
  // (coin roll), d20=20 (treasure check, skips: 20 > 2+1), d6=1 (Beasts
  // cooking check, skips: 1 < 4). All foes now dead -> afterPlayerAction's
  // FIRST liveFoes-empty check fires immediately (0 extra draws).
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 3, 4, 5, 20, 1]), []);

  const types = events.map((e) => e.type);
  assert.ok(types.includes("spellThrown"));
  assert.ok(types.includes("spellHit"));
  assert.ok(types.includes("frozenSolid"));
  assert.ok(types.includes("foeKilled"));
  assert.ok(types.includes("goldGained"));
  assert.ok(types.includes("encounterCleared"));

  const foeKilled = events.find((e) => e.type === "foeKilled");
  assert.ok(foeKilled.spGained > 0, "a Freeze kill pays experience");

  assert.equal(state.c.kills, 1);
  assert.ok(state.c.sp > 0, "a Freeze kill pays skill points");
  assert.ok(state.c.gold > 50, "a Freeze kill pays coin");
  assert.equal(foe.alive, false);
  assert.equal(foe.frozen, true);
  assert.equal(foe.wp, 0);
});

test("castSpell: frozenSolid narrates before the kill is awarded (event order)", () => {
  const foe = fixedFoe({ wp: 3, maxWP: 3, lvl: 1, intel: 1, lives: 1, type: "Beasts" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Freeze"], level: 1 },
    combat: fixedCombat([foe]),
  });
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 3, 4, 5, 20, 1]), []);
  const frozenIdx = events.findIndex((e) => e.type === "frozenSolid");
  const killedIdx = events.findIndex((e) => e.type === "foeKilled");
  assert.ok(frozenIdx >= 0 && killedIdx >= 0 && frozenIdx < killedIdx);
});

// --- a missed Freeze pays nothing --------------------------------------

test("castSpell: a missed Freeze throw pays nothing (no frozenSolid, no foeKilled, no kill/sp)", () => {
  // asleep:1 keeps the still-living foe from swinging back in the trailing
  // afterPlayerAction round (a miss does not clear the encounter, so the
  // normal post-action round-continuation machinery — foeTurn, then the
  // round advance — still runs; that machinery is unrelated to Freeze and
  // would run identically for any other missed thrown spell, so it is not
  // part of what this test is proving).
  const foe = fixedFoe({ wp: 3, maxWP: 3, lvl: 1, intel: 1, lives: 1, asleep: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Freeze"], level: 1 },
    combat: fixedCombat([foe]),
  });
  // d10=10 (miss: 10 - bonus 3 = 7 > 6); foeTurn's asleep check skips the
  // foe's own attack (0 draws); the round advance itself draws zero rng —
  // initiative is rolled once, Phase 51.
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([10]), []);

  assert.ok(events.some((e) => e.type === "spellMissed"));
  assert.ok(!events.some((e) => e.type === "frozenSolid"));
  assert.ok(!events.some((e) => e.type === "foeKilled"));
  assert.equal(state.c.kills, 0);
  assert.equal(state.c.sp, 0);
  assert.equal(foe.alive, true);
  assert.ok(!foe.frozen);
});

// --- kill-twice (lives) creature: Freeze follows canon, not the old bypass --

test("castSpell: a lives-2 (kill-twice) foe is revived by killFoe's lives rule instead of dying to Freeze", () => {
  const foe = fixedFoe({ wp: 5, maxWP: 5, lvl: 1, intel: 1, lives: 2, asleep: 1 });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Freeze"], level: 1 },
    combat: fixedCombat([foe]),
  });
  // d10=1 (hit); d6=3 (dmg) -- killFoe sees lives>1 and returns BEFORE any of
  // its own draws (no sp/coin/treasure/cooking rolls). The foe is still
  // alive afterward, so the trailing afterPlayerAction round proceeds: the
  // sleeping foe skips its attack (0 draws); the round advance itself draws
  // zero rng — initiative is rolled once, Phase 51.
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 3]), []);

  const frozenIdx = events.findIndex((e) => e.type === "frozenSolid");
  const revivedIdx = events.findIndex((e) => e.type === "foeRevived");
  assert.ok(frozenIdx >= 0 && revivedIdx >= 0 && frozenIdx < revivedIdx);
  assert.ok(!events.some((e) => e.type === "foeKilled"));

  assert.equal(foe.alive, true);
  assert.equal(foe.wp, 5, "killFoe's lives rule restores the foe to full wp");
  assert.equal(foe.frozen, false, "a standing (revived) foe is not frozen");
  assert.equal(state.c.kills, 0);
});

// --- party split still applies through the shared killFoe routine ------

test("castSpell: a Freeze kill's sp payout still splits across live party members", () => {
  const foe = fixedFoe({ wp: 3, maxWP: 3, lvl: 1, intel: 1, lives: 1, type: "Beasts" });
  const c = fixedWizard({ sub: "Wizard", grimoire: ["Freeze"], level: 1 });
  const state = fixedState({
    c,
    combat: fixedCombat([foe], { allies: [{ wp: 5 }] }), // one live member present
  });
  const events = castSpell(state, SPELL_IDX.Freeze, fakeRng([1, 3, 4, 5, 20, 1]), []);

  const gained = killSpFor(c, foe, 4); // the d6 roll killFoe drew, per the comment above
  const expectedShare = Math.round(gained / 2); // hero + 1 live member = 2 shares
  const foeKilled = events.find((e) => e.type === "foeKilled");
  assert.equal(foeKilled.spGained, expectedShare);
  assert.equal(state.c.sp, expectedShare);
});

// --- a non-Freeze thrown spell is unaffected ----------------------------

test("castSpell: a non-Freeze thrown spell still kills via the plain t.wp<=0 path (no frozenSolid)", () => {
  // type "Humans" (not Beasts/Lair Beasts) so killFoe skips the optional
  // cooking-check roll, matching the exact sequence test/unit/magic.test.js
  // already pins for this Fireball scenario.
  const foe = fixedFoe({ wp: 1, maxWP: 1, intel: 1, type: "Humans" });
  const state = fixedState({
    c: { sub: "Wizard", grimoire: ["Fireball"], level: 3 },
    combat: fixedCombat([foe]),
  });
  // d8=1 (hit); dmg 2d10+4 = 5+5+4=14; killFoe: sp d6=1, coin d10=1,
  // treasure-check d20=20 (skips).
  const events = castSpell(state, SPELL_IDX.Fireball, fakeRng([1, 5, 5, 1, 1, 20]), []);

  assert.equal(foe.alive, false);
  assert.equal(foe.wp, 0);
  assert.ok(events.some((e) => e.type === "spellHit" && e.dmg === 14));
  assert.ok(events.some((e) => e.type === "foeKilled"));
  assert.ok(!events.some((e) => e.type === "frozenSolid"), "a non-Freeze thrown spell never sets frozenSolid");
});

// --- spellAboveLevel's diagnostic reads the effective level -------------

test("castSpell: spellAboveLevel names the effective level via spellLevelFor (no override for Wizard)", () => {
  const state = fixedState({ c: { sub: "Wizard", grimoire: ["Phantom Host"], level: 1 } });
  const events = castSpell(state, SPELL_IDX["Phantom Host"], fakeRng([]), []);
  const refusal = events.find((e) => e.type === "spellAboveLevel");
  assert.ok(refusal, "a level-1 Wizard cannot yet cast a level-3 spell");
  assert.equal(refusal.need, 3);
  assert.equal(refusal.have, 1);
  assert.equal(state.c.spellsUsed, 0);
});

test("castSpell: an Illusionist's level-1 Phantom Host is castable (the diagnostic is unreachable for the override cell)", () => {
  const state = fixedState({ c: { sub: "Illusionist", grimoire: ["Phantom Host"], level: 1 }, combat: null });
  // sp.kind "summon" is resist-immune and Illusionist is not doubled: one d4
  // draw for the ally's rounds, no backfire draw (only a Summoner doubles).
  const events = castSpell(state, SPELL_IDX["Phantom Host"], fakeRng([4]), []);
  assert.ok(!events.some((e) => e.type === "spellAboveLevel"));
  assert.ok(!events.some((e) => e.type === "spellNotKnown"));
  assert.ok(!events.some((e) => e.type === "spellSchoolLocked"));
  assert.ok(events.some((e) => e.type === "allyPending"));
  assert.equal(state.c.spellsUsed, 1);
});
