// test/unit/hero-out-shell.test.js
//
// RULES-10 (Phase 75.1, plan 09) — the MENU-DRIVEN no-soft-lock drivers and
// the unchanged-menu pin. test/unit/hero-out.test.js already proves the
// three soft-lock drivers directly against applyAction({ type: "loseTurn" })
// — this file proves the SAME three scenarios one level up, through
// combatMenuViewModel's own single enabled action, exactly the path a real
// tap takes: read the view model, find the one enabled action (there must be
// exactly one at every step), dispatch ITS OWN `dispatch` payload through
// applyAction, repeat. Local fixtures mirror test/unit/hero-out.test.js
// verbatim, per this suite's established per-file convention.

import test from "node:test";
import assert from "node:assert/strict";

import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { applyAction } from "../../engine/engine.js";

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
    darkFor: 0,
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
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/**
 * onlyEnabledAction(vm) — asserts the view model carries exactly one
 * enabled top-level action (the must_haves' "at every out step exactly one
 * action is enabled" rule) and returns it.
 */
function onlyEnabledAction(vm) {
  const enabled = vm.actions.filter((a) => a.enabled);
  assert.equal(enabled.length, 1, `expected exactly one enabled action, found ${enabled.length} (${enabled.map((a) => a.key).join(", ")})`);
  assert.ok(enabled[0].dispatch, "the one enabled action must carry a dispatch payload");
  return enabled[0];
}

// ══════════════════════════════════════════════════════════════════════════
// Driver A — a lone hero, every foe stupefied (harmless)
// ══════════════════════════════════════════════════════════════════════════

test("menu driver A: a lone hero out for 4 against harmless (stupefied) foes — dispatching the view model's single enabled action always advances the fight and reaches an acting hero within HERO_OUT_MAX (4) dispatches; exactly one action is enabled at every step", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "stupefied", left: 4, spell: "Stupidity" } });
  let current = state;
  let dispatches = 0;
  while (current.combat && current.combat.heroOut && dispatches < 4) {
    const vm = combatMenuViewModel(current);
    const action = onlyEnabledAction(vm);
    assert.deepEqual(action.dispatch, { type: "loseTurn" });
    const result = applyAction(current, action.dispatch);
    current = result.state;
    dispatches++;
  }
  assert.ok(dispatches <= 4, "resolved within HERO_OUT_MAX dispatches");
  assert.ok(current.combat, "the single harmless foe never dies — combat stays open");
  assert.equal(current.combat.heroOut, undefined, "the hero can act again");
  const finalVm = combatMenuViewModel(current);
  assert.equal(finalVm.actions.filter((a) => a.enabled).length > 1, true, "the normal menu (more than one enabled action) returns once the hero can act");
});

// ══════════════════════════════════════════════════════════════════════════
// Driver B — a lone low-hp hero against a foe that hits
// ══════════════════════════════════════════════════════════════════════════

test("menu driver B: a lone low-hp hero out for 4 against a foe that hits — dispatching the view model's single enabled action always advances the fight and reaches death or an acting hero within 4 dispatches", () => {
  const state = fixedState({ c: { wp: 10 } });
  state.combat = fixedCombat([fixedFoe()], { heroOut: { kind: "asleep", left: 4, spell: "Doze" } });
  let current = state;
  let dispatches = 0;
  let resolved = false;
  while (!resolved && dispatches < 4) {
    const vm = combatMenuViewModel(current);
    const action = onlyEnabledAction(vm);
    const result = applyAction(current, action.dispatch);
    current = result.state;
    dispatches++;
    if (current.dead || !current.combat || !current.combat.heroOut) resolved = true;
  }
  assert.ok(resolved, "reached death, a cleared fight or an acting hero within 4 dispatches");
});

// ══════════════════════════════════════════════════════════════════════════
// Driver C — a hero with a party
// ══════════════════════════════════════════════════════════════════════════

test("menu driver C: a hero with a party, out for 4 — dispatching the view model's single enabled action always advances the fight and reaches a cleared fight or an acting hero within 4 dispatches", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ wp: 5, maxWP: 5 })], {
    heroOut: { kind: "asleep", left: 4, spell: "Doze" },
    allies: [{ partyIdx: 0, name: "Ada", lvl: 5, wp: 100, maxWP: 100 }],
  });
  let current = state;
  let dispatches = 0;
  let resolved = false;
  while (!resolved && dispatches < 4) {
    const vm = combatMenuViewModel(current);
    const action = onlyEnabledAction(vm);
    const result = applyAction(current, action.dispatch);
    current = result.state;
    dispatches++;
    if (!current.combat || !current.combat.heroOut) resolved = true;
  }
  assert.ok(resolved, "reached a cleared fight or an acting hero within 4 dispatches");
});

// ══════════════════════════════════════════════════════════════════════════
// The Phase 71 locked shape still applies while heroOut is set
// ══════════════════════════════════════════════════════════════════════════

test("Phase 71 locked shape: while heroOut is set, combatMenuViewModel(state, { locked: true }) locks the single action like any other, and it is enabled again unlocked", () => {
  const state = fixedState();
  state.combat = fixedCombat([fixedFoe({ stupid: true })], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } });
  const locked = combatMenuViewModel(state, { locked: true });
  const lockedEnabled = locked.actions.filter((a) => a.enabled);
  assert.equal(lockedEnabled.length, 1);
  assert.equal(lockedEnabled[0].locked, true);

  const unlocked = combatMenuViewModel(state);
  const unlockedEnabled = unlocked.actions.filter((a) => a.enabled);
  assert.equal(unlockedEnabled.length, 1);
  assert.equal(unlockedEnabled[0].locked, undefined);
});

// ══════════════════════════════════════════════════════════════════════════
// A blinded or shrunk hero (no heroOut) keeps the normal menu
// ══════════════════════════════════════════════════════════════════════════

test("a blinded or shrunk hero who can act (no heroOut) gets the normal four-action menu, with more than one enabled action", () => {
  const blindState = fixedState();
  blindState.combat = fixedCombat([fixedFoe()], { heroBlind: true });
  const blindVm = combatMenuViewModel(blindState);
  assert.ok(blindVm.actions.filter((a) => a.enabled).length > 1);

  const shrunkState = fixedState();
  shrunkState.combat = fixedCombat([fixedFoe()], { heroShrunk: true });
  const shrunkVm = combatMenuViewModel(shrunkState);
  assert.ok(shrunkVm.actions.filter((a) => a.enabled).length > 1);
});
