// 04-DR10 (Group 2/3) — src/browser/viewModels.js#grimoireViewModel: the HERO
// tab's Grimoire rows. Bound to the REAL GameState.c.grimoire (a list of
// spell names) and content/spells.js#combatOnly, sorted by level then
// alphabetically, with a castable/disabledReason verdict per row that
// mirrors engine/derived.js#canCast (grimoire/level/school gate) plus the
// spell's own combatOnly flag, in/out-of-combat state, and the caster's
// remaining charge economy (engine/movement.js#maxCharges) — never a second,
// divergent copy of that gating logic.

import test from "node:test";
import assert from "node:assert/strict";

import { grimoireViewModel } from "../../src/browser/viewModels.js";

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    version: 1,
    seed: 1,
    rngState: 1,
    c: {
      cls: "Magic User",
      sub: "Wizard",
      level: 3,
      grimoire: [],
      spellsUsed: 0,
      ...cOverrides,
    },
    floor: { g: [], px: 0, py: 0, depth: 1 },
    day: 1,
    steps: 0,
    combat: null,
    store: null,
    beats: null,
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
    ...rest,
  };
}

test("grimoireViewModel: a non-caster with no grimoire reports isCaster=false, hasSpells=false", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", grimoire: [] } });
  const vm = grimoireViewModel(state);
  assert.equal(vm.isCaster, false);
  assert.equal(vm.hasSpells, false);
  assert.deepEqual(vm.rows, []);
});

test("grimoireViewModel: a Magic User with an empty grimoire reports isCaster=true, hasSpells=false", () => {
  const state = fixedState({ c: { grimoire: [] } });
  const vm = grimoireViewModel(state);
  assert.equal(vm.isCaster, true);
  assert.equal(vm.hasSpells, false);
});

test("grimoireViewModel: rows sort by level, then alphabetically within a level", () => {
  // Wizard learns every school at level 0 (schoolGate defaults to 1) so no
  // gate blocks these — all four are lvl-1 spells except Acid (lvl 2).
  const state = fixedState({ c: { grimoire: ["Weaken", "Map the Floor", "Acid", "Doze"], level: 3 } });
  const vm = grimoireViewModel(state);
  assert.deepEqual(vm.rows.map((r) => r.name), ["Doze", "Map the Floor", "Weaken", "Acid"]);
  assert.deepEqual(vm.rows.map((r) => r.lvl), [1, 1, 1, 2]);
});

test("grimoireViewModel: each row carries name/lvl/txt/combatOnly/idx matching content/spells.js", () => {
  const state = fixedState({ c: { grimoire: ["Heal"] } });
  const vm = grimoireViewModel(state);
  const row = vm.rows[0];
  assert.equal(row.name, "Heal");
  assert.equal(row.lvl, 1);
  assert.equal(typeof row.txt, "string");
  assert.equal(row.combatOnly, false);
  assert.equal(typeof row.idx, "number");
});

test("grimoireViewModel: a non-combat spell outside combat with charges available is castable", () => {
  const state = fixedState({ c: { grimoire: ["Heal"], level: 3, spellsUsed: 0 }, combat: null });
  const vm = grimoireViewModel(state);
  assert.equal(vm.rows[0].castable, true);
  assert.equal(vm.rows[0].disabledReason, null);
});

test("grimoireViewModel: a combat-only spell is never castable outside combat, regardless of gates/charges", () => {
  const state = fixedState({ c: { grimoire: ["Fireball"], level: 3, sub: "Wizard", spellsUsed: 0 }, combat: null });
  const vm = grimoireViewModel(state);
  const row = vm.rows.find((r) => r.name === "Fireball");
  assert.equal(row.combatOnly, true);
  assert.equal(row.castable, false);
  assert.equal(row.disabledReason, "Combat only");
});

test("grimoireViewModel: during a fight the Hero grimoire defers casting to the combat screen", () => {
  // DR13: Heal (a non-combatOnly self-heal the engine DOES handle in combat)
  // must not be labeled "outside combat only" on the Hero sheet while the
  // combat SPELLS menu is simultaneously offering it — that contradiction was
  // the reported bug. In combat, the Hero grimoire is a reference and points
  // the player to the combat screen for ALL spells.
  const state = fixedState({
    c: { grimoire: ["Heal"], level: 3, spellsUsed: 0 },
    combat: { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false },
  });
  const vm = grimoireViewModel(state);
  assert.equal(vm.rows[0].castable, false);
  assert.equal(vm.rows[0].disabledReason, "On the combat screen");
});

test("grimoireViewModel: a non-combat spell above the caster's level names the level it needs (CMB-02)", () => {
  const state = fixedState({ c: { grimoire: ["Major Heal"], level: 1, spellsUsed: 0 }, combat: null }); // Major Heal is lvl 3
  const vm = grimoireViewModel(state);
  const row = vm.rows.find((r) => r.name === "Major Heal");
  assert.equal(row.castable, false);
  assert.equal(row.disabledReason, "Needs level 3");
});

test("grimoireViewModel: a school-locked spell names the school and level it opens at (CMB-02)", () => {
  // Sorcerer: healing:0 (allowed) but gate:{healing:4} — a level-1 Sorcerer
  // knows Heal (a level-1 spell) but the healing SCHOOL stays locked until
  // level 4, distinct from a level gate on the spell itself.
  const state = fixedState({ c: { grimoire: ["Heal"], level: 1, sub: "Sorcerer", spellsUsed: 0 }, combat: null });
  const vm = grimoireViewModel(state);
  const row = vm.rows.find((r) => r.name === "Heal");
  assert.equal(row.castable, false);
  assert.equal(row.disabledReason, "healing opens at level 4");
});

// Phase 40 (SPELL-04): the Phase 23 Summoner/Summon override is retired —
// Summon is printed lvl 2 and spellLevelFor now falls back to sp.lvl for
// the Summoner, so a level-1 Summoner's Summon row reads "Needs level 2"
// again. The Summoner's level-1 summon is the new Lesser Summon row
// instead, which IS castable at level 1.
test("grimoireViewModel: a level-1 Summoner's Summon needs level 2 (Phase 40 retires the override); Lesser Summon is castable instead", () => {
  const state = fixedState({ c: { grimoire: ["Summon", "Lesser Summon"], level: 1, sub: "Summoner", spellsUsed: 0 }, combat: null });
  const vm = grimoireViewModel(state);
  const summonRow = vm.rows.find((r) => r.name === "Summon");
  assert.equal(summonRow.castable, false);
  assert.equal(summonRow.disabledReason, "Needs level 2");
  const lesserRow = vm.rows.find((r) => r.name === "Lesser Summon");
  assert.equal(lesserRow.castable, true);
  assert.equal(lesserRow.disabledReason, null);
});

test("grimoireViewModel: a non-combat spell with no charges left is disabled (No charges left)", () => {
  // maxCharges(level 3) = 2*3+2 = 8
  const state = fixedState({ c: { grimoire: ["Heal"], level: 3, spellsUsed: 8 }, combat: null });
  const vm = grimoireViewModel(state);
  assert.equal(vm.rows[0].castable, false);
  assert.equal(vm.rows[0].disabledReason, "No charges left");
});

test("grimoireViewModel: never mutates state or advances rngState (read-only)", () => {
  const state = fixedState({ c: { grimoire: ["Heal", "Fireball", "Map the Floor"], level: 3 } });
  const before = structuredClone(state);
  grimoireViewModel(state);
  assert.deepEqual(state, before);
});
