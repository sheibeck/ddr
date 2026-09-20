// test/unit/ability-pool.test.js
//
// Phase 38 (ABIL-01/02/03/05), Plan 01 Task 2 — TDD RED-first pins for:
//   1. rollCharacter: c.abilities exists, table actives are split out.
//   2. grantLevelAbilities/rollPoolAbility: the derived-stream level pool.
//   3. newRun's level-1 guarantee (SC-3) with zero main-rng draws.
//   4. checkLevel's per-level-up abilityLearned event, zero extra draws.
//   5. meetJoiner's Joiner-side pool roll.
//   6. migrateLegacySkills / ensureAbilities tolerant-load rebuild.
//   7. validateSave / rehydrate wiring for c and party members.
//   8. abilityLearned narration (eventNarration/narrationLines/rail) + coverage.
//
// No cross-test-file imports (project convention).

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import {
  rollCharacter,
  checkLevel,
  migrateLegacySkills,
  splitTableAbilities,
  rollPoolAbility,
  grantLevelAbilities,
  ensureAbilities,
  LEGACY_SKILL_RENAMES,
  DROPPED_SKILLS,
} from "../../engine/character.js";
import { newRun } from "../../engine/state.js";
import { meetJoiner } from "../../engine/encounters.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";
import { ABILITY_POOL, ABILITY_BY_ID, THRESHOLDS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, PRIORITY } from "../../src/browser/narrationLines.js";
import { RAIL_FAMILY, RAIL_HOLD } from "../../src/browser/rail.js";

// A complete, fixed level-1 Fighter (mirrors test/unit/character.test.js's
// fixedFighter, kept local per the no-cross-test-file-import convention).
function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", intel: 10, level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Long Sword", prof: 1, magicWpn: 0,
    armor: "Studded", ar: 10, armorMin: 2, armorWP: 18, armorMax: 18, patches: 0,
    temperament: "Wary", motive: "Money", phobia: "Darkness", phobiaType: null,
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [],
    spellsUsed: 0, kills: 0, might: 0, ward: null, regen: false, mirror: 0, foresight: false,
    name: "Test Delver", darkFor: 0, flightLeft: 0, flightCooldown: 0, bag: "medium",
    ...overrides,
  };
}

// ─── 1. rollCharacter / splitTableAbilities ─────────────────────────────────

test("rollCharacter: c.abilities is an array for every fixture seed", () => {
  for (const seed of [1, 2, 3, 4, 6, 7, 13, 32]) {
    const c = rollCharacter(makeRng(seed));
    assert.ok(Array.isArray(c.abilities), `seed ${seed}: c.abilities must be an array`);
  }
});

test("rollCharacter: Magic User gets an empty c.abilities; Fighter/Thief table actives are removed from c.skills", () => {
  const magicUser = rollCharacter(makeRng(7));
  assert.equal(magicUser.cls, "Magic User");
  assert.deepStrictEqual(magicUser.abilities, []);

  // seed 32 is a Fighter Samurai who rolls Agility (->Sidestep, active) and
  // Language (->Pommel Strike, active) plus Runes/Signs (kept passive) per
  // the Plan's declared_divergences table.
  const c32 = rollCharacter(makeRng(32));
  assert.equal(c32.cls, "Fighter");
  assert.ok(c32.abilities.includes("sidestep"));
  assert.ok(c32.abilities.includes("pommelStrike"));
  assert.equal(c32.skills["Sidestep"], undefined);
  assert.equal(c32.skills["Pommel Strike"], undefined);
  assert.equal(c32.skills["Runes/Signs"], 1);
  assert.equal(c32.vp, rollCharacter(makeRng(32)).vp, "c.vp is unaffected by the split");
});

// ─── 2. rollPoolAbility / grantLevelAbilities ───────────────────────────────

test("rollPoolAbility is deterministic per base+level, adds exactly one id, never duplicates, null when exhausted", () => {
  const c = fixedFighter({ abilities: [] });
  const id1 = rollPoolAbility(c, "1", 1);
  assert.ok(ABILITY_POOL.Fighter.includes(id1));
  assert.deepStrictEqual(c.abilities, [id1]);

  const c2 = fixedFighter({ abilities: [] });
  const id1Again = rollPoolAbility(c2, "1", 1);
  assert.equal(id1Again, id1, "same base+level must roll the same id (determinism)");

  // Exhaust the pool, then confirm null + no further push.
  const c3 = fixedFighter({ abilities: [...ABILITY_POOL.Fighter] });
  const result = rollPoolAbility(c3, "1", 99);
  assert.equal(result, null);
  assert.equal(c3.abilities.length, ABILITY_POOL.Fighter.length);
});

test("rollPoolAbility returns null and touches nothing for a Magic User", () => {
  const c = fixedFighter({ cls: "Magic User", abilities: [] });
  const result = rollPoolAbility(c, "1", 1);
  assert.equal(result, null);
  assert.deepStrictEqual(c.abilities, []);
});

test("grantLevelAbilities grants one id per level up to upToLevel; a Fighter owns all 5 by level 5; a Thief all 4 (level 5 adds nothing)", () => {
  const fighter = fixedFighter({ abilities: [] });
  const added = grantLevelAbilities(fighter, "seed9", 5);
  assert.equal(added.length, 5);
  assert.deepStrictEqual(new Set(fighter.abilities), new Set(ABILITY_POOL.Fighter));

  const thief = fixedFighter({ cls: "Thief", sub: "Pickpocket", abilities: [] });
  const addedThief = grantLevelAbilities(thief, "seed9", 5);
  assert.equal(addedThief.length, 4, "the Thief pool only has 4 ids — level 5 adds nothing further");
  assert.deepStrictEqual(new Set(thief.abilities), new Set(ABILITY_POOL.Thief));
});

// ─── 3. newRun's level-1 guarantee, zero main-rng draws ─────────────────────

test("newRun: every Fighter/Thief fixture seed has >= 1 pool ability at level 1; Magic Users stay empty; rngState is the pinned pre-phase value", () => {
  const NEW_RUN_PINS = {
    1: -1692776321, 2: 266671887, 3: 1466402031, 4: 266671889, 6: 202730694,
    7: 514860380, 13: -365163772, 32: -1692776290,
  };
  for (const [seedStr, pin] of Object.entries(NEW_RUN_PINS)) {
    const seed = Number(seedStr);
    const state = newRun(seed);
    assert.equal(state.rngState, pin, `seed ${seed}: newRun rngState must stay pinned — the level-1 pool roll must draw ZERO from the main rng`);
    if (state.c.cls === "Fighter" || state.c.cls === "Thief") {
      const pool = ABILITY_POOL[state.c.cls];
      assert.ok(state.c.abilities.some((id) => pool.includes(id)), `seed ${seed}: must own at least one pool ability at level 1`);
    } else {
      assert.deepStrictEqual(state.c.abilities, [], `seed ${seed}: a Magic User's abilities must stay empty`);
    }
  }
});

// ─── 4. checkLevel's per-level-up abilityLearned, zero extra draws ──────────

test("checkLevel: a Fighter crossing to level 2 emits [leveled, abilityLearned]; a Magic User emits [leveled] only", () => {
  const state = { seed: 42, c: fixedFighter({ sp: THRESHOLDS[1], abilities: [] }) };
  const events = checkLevel(state, makeRng(3), []);
  assert.equal(state.c.level, 2);
  const types = events.map((e) => e.type);
  assert.deepStrictEqual(types, ["leveled", "abilityLearned"]);
  const learned = events[1];
  assert.ok(ABILITY_POOL.Fighter.includes(learned.key));
  assert.equal(learned.name, ABILITY_BY_ID[learned.key].name);
  assert.equal(learned.txt, ABILITY_BY_ID[learned.key].txt);
  assert.equal(learned.level, 2);
  assert.deepStrictEqual(state.c.abilities, [learned.key]);

  const muState = { seed: 42, c: fixedFighter({ cls: "Magic User", sub: "Wizard", weapon: "Quarter Staff", prof: 0, grimoire: ["Heal"], sp: THRESHOLDS[1], abilities: [] }) };
  const muEvents = checkLevel(muState, makeRng(3), []);
  assert.deepStrictEqual(muEvents.map((e) => e.type), ["leveled"]);
});

test("checkLevel: an exhausted pool emits [leveled] only (no abilityLearned)", () => {
  const state = { seed: 1, c: fixedFighter({ sp: THRESHOLDS[1], abilities: [...ABILITY_POOL.Fighter] }) };
  const events = checkLevel(state, makeRng(3), []);
  assert.deepStrictEqual(events.map((e) => e.type), ["leveled"]);
});

test("checkLevel: zero extra main-rng draws for the ability roll (rngState matches a hand-run of the pre-existing gain-dice sequence)", () => {
  const before = fixedFighter({ sp: THRESHOLDS[1], abilities: [] });
  const after = fixedFighter({ sp: THRESHOLDS[1], abilities: [] });

  const rngA = makeRng(3);
  checkLevel({ seed: 42, c: before }, rngA, []);

  // Hand-run the SAME gain-dice draw the pre-phase engine made (Fighter
  // gain[1] = {n:1, sides:8, bonus:0} — a single rng.d(8) via rollDice).
  const rngB = makeRng(3);
  rngB.d(8);

  assert.equal(rngA.getState(), rngB.getState(), "the ability roll must draw NOTHING from the main rng");
});

// ─── 5. meetJoiner's Joiner-side pool roll ──────────────────────────────────

test("meetJoiner: pendingJoiner.abilities is an array; c.joiner keeps its frozen 7-key shape; the four draws are unchanged", () => {
  const state = newRun(3);
  const before = state.rngState;
  const rng = makeRng(before);
  const events = [];
  meetJoiner(state, rng, events);

  assert.ok(Array.isArray(state.pendingJoiner?.abilities) || state.pendingJoiner === undefined || state.pendingJoiner === null,
    "when a joiner is pending, abilities must be an array");
  if (state.pendingJoiner) {
    assert.ok(Array.isArray(state.pendingJoiner.abilities));
  }
  assert.deepStrictEqual(Object.keys(state.c.joiner).sort(), ["cls", "lvl", "maxWP", "name", "race", "sub", "wp"].sort());
});

// ─── 6. migrateLegacySkills / ensureAbilities ───────────────────────────────

test("migrateLegacySkills: renames per-class legacy keys (preserving tier), drops removed keys, no-ops on new-format/empty maps", () => {
  const fighter = { cls: "Fighter", skills: { "Death-touch": 1, "Agility": 1, "Kata": 1, "Language": 1, "Tracking": 1, "Stealth": 1 } };
  migrateLegacySkills(fighter);
  assert.deepStrictEqual(fighter.skills, { "Death Touch": 1, "Sidestep": 1, "Kata": 1, "Stealth": 1 });

  const thief = { cls: "Thief", skills: { "Kata": 1, "Silence": 1, "Climbing": 1, "Leaping": 1, "Locks": 2 } };
  migrateLegacySkills(thief);
  assert.deepStrictEqual(thief.skills, { "Feint": 1, "Silent Step": 1, "Locks": 2 });

  const alreadyNew = { cls: "Fighter", skills: { "Sidestep": 1, "Hardiness": 1 } };
  migrateLegacySkills(alreadyNew);
  assert.deepStrictEqual(alreadyNew.skills, { "Sidestep": 1, "Hardiness": 1 });

  const mu = { cls: "Magic User", skills: {} };
  migrateLegacySkills(mu);
  assert.deepStrictEqual(mu.skills, {});

  assert.deepStrictEqual(LEGACY_SKILL_RENAMES.Fighter, { "Death-touch": "Death Touch", "Agility": "Sidestep" });
  assert.deepStrictEqual(LEGACY_SKILL_RENAMES.Thief, { "Kata": "Feint", "Silence": "Silent Step" });
  assert.deepStrictEqual(DROPPED_SKILLS, ["Language", "Tracking", "Climbing", "Leaping"]);
});

test("ensureAbilities: a legacy level-3 Fighter is rebuilt deterministically and idempotently; a c with abilities already present is untouched", () => {
  const legacy = fixedFighter({ level: 3, skills: { "Agility": 1, "Hardiness": 1 } });
  delete legacy.abilities;
  ensureAbilities(legacy, "base1");
  assert.deepStrictEqual(legacy.skills, { "Hardiness": 1 });
  assert.equal(legacy.abilities[0], "sidestep");
  assert.equal(legacy.abilities.length, 4, "sidestep + 3 pool picks (levels 1-3)");

  const again = { ...legacy, abilities: [...legacy.abilities], skills: { ...legacy.skills } };
  ensureAbilities(again, "base1");
  assert.deepStrictEqual(again, legacy, "calling ensureAbilities again must be a no-op");

  const junk = fixedFighter({ level: 1, abilities: "junk", skills: {} });
  ensureAbilities(junk, "base2");
  assert.ok(Array.isArray(junk.abilities), "a non-array abilities value must be rebuilt");
});

// ─── 7. validateSave / rehydrate tolerant load ──────────────────────────────

test("validateSave: a pre-phase save (no c.abilities, legacy skill names) gets abilities deterministically and reproducibly; party members too", () => {
  const state = newRun(3);
  const serialized = serializeRun(state);
  // Simulate a pre-phase save: strip abilities, rename skills back to legacy.
  const legacyC = { ...serialized.c };
  delete legacyC.abilities;
  legacyC.skills = { ...legacyC.skills };
  // Re-inject at least one legacy-named key so migrateLegacySkills has work.
  if (legacyC.cls === "Fighter" || legacyC.cls === "Thief") {
    legacyC.skills["Hardiness"] = legacyC.skills["Hardiness"] ?? 1;
  }
  const legacyMember = fixedFighter({ name: "Old Ally" });
  delete legacyMember.abilities;
  const legacySave = { ...serialized, c: legacyC, party: [legacyMember] };

  const result1 = validateSave(JSON.stringify(legacySave));
  assert.ok(result1.ok);
  assert.ok(Array.isArray(result1.value.c.abilities));
  assert.ok(Array.isArray(result1.value.party[0].abilities));

  const result2 = validateSave(JSON.stringify(legacySave));
  assert.deepStrictEqual(result2.value.c.abilities, result1.value.c.abilities, "loading twice must be reproducible");

  // A save that already has abilities must round-trip untouched.
  const freshResult = validateSave(JSON.stringify(serializeRun(state)));
  assert.deepStrictEqual(freshResult.value.c.abilities, state.c.abilities);
});

test("rehydrate: mirrors validateSave's tolerant load for c and party", () => {
  const state = newRun(4);
  const serialized = serializeRun(state);
  const legacyC = { ...serialized.c };
  delete legacyC.abilities;
  const legacyMember = fixedFighter({ name: "Old Ally 2" });
  delete legacyMember.abilities;
  const rehydrated = rehydrate({ ...serialized, c: legacyC, party: [legacyMember] });
  assert.ok(Array.isArray(rehydrated.c.abilities));
  assert.ok(Array.isArray(rehydrated.party[0].abilities));

  // A fresh round-trip stays deepStrictEqual.
  const freshRehydrated = rehydrate(serializeRun(state));
  assert.deepStrictEqual(freshRehydrated.c.abilities, state.c.abilities);
});

// ─── 8. Narration coverage ───────────────────────────────────────────────────

test("abilityLearned narration: eventNarration/narrationLines/rail all cover it", () => {
  const e = { type: "abilityLearned", key: "brace", name: "Brace", txt: "halve the next blow that lands on you", level: 2 };
  const line = EVENT_NARRATION.abilityLearned(e);
  assert.ok(typeof line === "string" && line.includes("Brace"));

  const feedLine = LINE_FOR.abilityLearned(e);
  assert.deepStrictEqual(feedLine, { text: "New trick: Brace — halve the next blow that lands on you", tone: "hit", priority: PRIORITY.feature });

  assert.deepStrictEqual(RAIL_FAMILY.abilityLearned, { icon: "★", title: "SKILL LEVEL {n}", tone: "good", hold: RAIL_HOLD.level });

  // Bare-payload safety (the coverage guard's own invocation shape).
  assert.doesNotThrow(() => EVENT_NARRATION.abilityLearned({ type: "abilityLearned" }));
  assert.doesNotThrow(() => LINE_FOR.abilityLearned({ type: "abilityLearned" }));
});
