// test/unit/item-combat-gate.test.js
//
// CMB-03/CMB-06 (Phase 31, Plan 02) — useItem's full refusal ladder for
// targeted attack items (combatOnly/wrongClass/cooldown), buff-potion parity
// in/out of combat, the Amulet of Stone's foeStoned + payout-equals-killFoe
// pin, the multi-foe stone AoE, the item-kill narrow cleared-check (CMB-06),
// and the "items stay free actions" invariant (no foe retaliation).

import test from "node:test";
import assert from "node:assert/strict";

import { useItem, TARGETED_KINDS } from "../../engine/items.js";
import { killFoe } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";

/** fakeRng(seq) — verbatim copy of test/unit/magic.test.js's helper. */
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
    gold: 50, kills: 0, might: 0, ward: null, regen: false, mirror: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null,
    items: [], motive: "Money", name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, ...rest } = overrides;
  return {
    c: fixedFighter(cOverrides),
    floor: { depth: 1 },
    day: 1,
    steps: 0,
    combat: null,
    dead: false,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1,
    wp: 12, maxWP: 12, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const NOW = () => 12345;

// --- combatOnly: every TARGETED_KINDS staff outside combat ----------------

// RULES-13 (Phase 75, Plan 09): a staff's power works only while wielded —
// re-pinned to wield each staff (`c.weapon`/`c.staff`, `{ slot: "weapon" }`)
// so the refusal ladder reaches combatOnly instead of stopping at
// notWielded; the "stays carried" bag assertion is dropped since a wielded
// staff is never in `c.items`.
test("every TARGETED_KINDS staff refuses combatOnly outside combat — zero draws, item untouched", () => {
  assert.deepStrictEqual([...TARGETED_KINDS].sort(), ["fire", "freeze", "gas", "stone", "weaken"]);
  for (const kind of TARGETED_KINDS) {
    const staff = { kind: "staff", n: `Test ${kind} Staff`, use: kind };
    const state = fixedState({ c: { cls: "Magic User", weapon: staff.n, staff, items: [] } }); // combat: null
    const events = useItem(state, { slot: "weapon" }, fakeRng([]), [], NOW);
    assert.deepStrictEqual(events, [{ type: "useRefused", item: staff, reason: "combatOnly" }]);
    assert.equal(staff.usedAt, undefined, "usedAt never set on a refusal");
  }
});

test("a non-Magic-User's staff use is refused wrongClass, even in combat with a live target", () => {
  // Phase 39 (GEAR-02): "Oak Staff" is a real content activation key — give
  // it a charge so itemReady's staff branch (Number.isInteger(it.charges) &&
  // it.charges > 0) isn't what refuses this use; wrongClass must fire first.
  const staff = { kind: "staff", n: "Oak Staff", use: "stone", charges: 1 };
  const state = fixedState({ c: { cls: "Fighter", items: [staff] }, combat: fixedCombat([fixedFoe()]) });
  const events = useItem(state, 0, fakeRng([]), [], NOW);
  assert.deepStrictEqual(events, [{ type: "useRefused", item: staff, reason: "wrongClass" }]);
  assert.equal(staff.usedAt, undefined);
  assert.equal(state.combat.foes[0].alive, true, "the wrongClass refusal never touches the foe");
});

// --- buff potions: identical outside vs inside combat (CMB-03) ------------

test("every potion eff2 resolves identically outside vs inside combat", () => {
  const POTIONS_TO_TEST = [
    { eff2: "heal", rng: [5] },
    { eff2: "full", rng: [] },
    { eff2: "poison", rng: [] },
    { eff2: "disease", rng: [] },
    { eff2: "strength", rng: [] },
    { eff2: "enlarge", rng: [] },
    { eff2: "speed", rng: [] },
    { eff2: "acute", rng: [6] },
    { eff2: "invis", rng: [] },
    { eff2: "death", rng: [] },
  ];
  for (const { eff2, rng } of POTIONS_TO_TEST) {
    const potion = () => ({ kind: "potion", n: `Test ${eff2}`, eff2, uses: 1 });

    const outState = fixedState({ c: { wp: 20, maxWP: 40, items: [potion()] } }); // combat: null
    const outEvents = useItem(outState, 0, fakeRng([...rng]), [], NOW);

    const inState = fixedState({ c: { wp: 20, maxWP: 40, items: [potion()] } });
    inState.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    const inEvents = useItem(inState, 0, fakeRng([...rng]), [], NOW);

    assert.deepStrictEqual(outState.c, inState.c, `${eff2}: the character ends up identical in/out of combat`);
    assert.ok(outEvents.length > 0 && inEvents.length > 0, `${eff2}: an effect event fired both times`);
  }
});

test("a heal potion used in combat does NOT trigger a foe turn — items stay free actions", () => {
  const potion = { kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 };
  const state = fixedState({ c: { wp: 10, maxWP: 55, items: [potion] } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
  const events = useItem(state, 0, fakeRng([5]), [], NOW);
  assert.ok(events.some((e) => e.type === "healed"));
  assert.equal(events.some((e) => e.type === "struckByFoe" || e.type === "foeMissed"), false, "no foe turn fired");
  assert.equal(state.combat.round, 1, "the round never advanced");
});

// --- Amulet of Stone: foeStoned + payout equals a direct killFoe kill -----

test("Amulet of Stone on the last live foe pays out exactly like a direct killFoe kill of the same foe", () => {
  const AMULET_STONE = { n: "Amulet of Stone", use: "stone", every: 200, aoe: 4 };
  const foe = fixedFoe({ name: "Loner", wp: 12, maxWP: 12, type: "Humans" });
  const amuletState = fixedState({ c: { cls: "Magic User", sub: "Wizard", items: [AMULET_STONE] }, combat: fixedCombat([foe]) });
  const events = useItem(amuletState, 0, makeRng(42), [], NOW);

  const stoned = events.find((e) => e.type === "foeStoned");
  assert.deepStrictEqual(stoned.names, ["Loner"]);
  assert.ok(events.some((e) => e.type === "foeKilled" && e.name === "Loner"));
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.ok(events.some((e) => e.type === "combatEnded"));
  assert.equal(amuletState.combat, null, "the encounter closes — no stranded combat screen");

  const stonedIdx = events.findIndex((e) => e.type === "foeStoned");
  const killedIdx = events.findIndex((e) => e.type === "foeKilled");
  assert.ok(stonedIdx < killedIdx, "foeStoned precedes the per-foe foeKilled line");

  const controlFoe = fixedFoe({ name: "Loner", wp: 12, maxWP: 12, type: "Humans" });
  const controlState = fixedState({ c: { cls: "Magic User", sub: "Wizard" } });
  killFoe(controlState, controlFoe, makeRng(42), []);

  assert.equal(amuletState.c.sp, controlState.c.sp, "identical skill-point payout");
  assert.equal(amuletState.c.gold, controlState.c.gold, "identical coin payout");
  assert.equal(amuletState.c.kills, controlState.c.kills, "identical kill count");
});

test("Amulet of Stone on 5 foes stones only 4 (aoe:4), leaving combat open with exactly 1 live foe", () => {
  const AMULET_STONE = { n: "Amulet of Stone", use: "stone", every: 200, aoe: 4 };
  const foes = [1, 2, 3, 4, 5].map((n) => fixedFoe({ name: `F${n}`, wp: 10, maxWP: 10, type: "Humans" }));
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", items: [AMULET_STONE] }, combat: fixedCombat(foes) });
  const events = useItem(state, 0, makeRng(7), [], NOW);

  const stoned = events.find((e) => e.type === "foeStoned");
  assert.equal(stoned.names.length, 4);
  assert.deepStrictEqual(stoned.names, ["F1", "F2", "F3", "F4"], "roster order, first 4");
  assert.notEqual(state.combat, null, "combat stays open — one foe survives");
  assert.equal(state.combat.foes.filter((f) => f.alive).length, 1);
  assert.equal(state.combat.foes.find((f) => f.alive).name, "F5");
  assert.equal(events.some((e) => e.type === "encounterCleared"), false);
});

// --- item kills close the encounter through the normal cleared path -------

// RULES-13 (Phase 75, Plan 09): re-pinned to the wielded form — a bagged
// Oak Staff is now inert (notWielded), so this test wields it first.
test("Oak Staff (aoe default 2) on 2 foes clears the encounter", () => {
  // Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
  const OAK_STAFF = { kind: "staff", n: "Oak Staff", use: "stone", charges: 1 };
  const foes = [fixedFoe({ name: "A", wp: 10, maxWP: 10, type: "Humans" }), fixedFoe({ name: "B", wp: 10, maxWP: 10, type: "Humans" })];
  const state = fixedState({ c: { cls: "Magic User", weapon: "Oak Staff", staff: OAK_STAFF, items: [] }, combat: fixedCombat(foes) });
  const events = useItem(state, { slot: "weapon" }, makeRng(3), [], NOW);
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.ok(events.some((e) => e.type === "combatEnded"));
  assert.equal(state.combat, null);
});

test("the Pine Staff's fire kill on the last foe clears the encounter", () => {
  const foe = fixedFoe({ name: "Ember", wp: 1, maxWP: 1, type: "Humans" });
  // Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
  const state = fixedState({ c: { items: [{ n: "Pine Staff", use: "fire", charges: 1 }] }, combat: fixedCombat([foe]) });
  // n=d6=1 ball; dmg d10=1 -> 1+4=5, lethal at 1 wp; killFoe: sp d6=1, coin d10=1, loot d20=20 skip.
  const events = useItem(state, 0, fakeRng([1, 1, 1, 1, 20]), [], NOW);
  assert.ok(events.some((e) => e.type === "encounterCleared"));
  assert.ok(events.some((e) => e.type === "combatEnded"));
  assert.equal(state.combat, null);
});

// RULES-13 (Phase 75, Plan 09): re-pinned to the wielded form for both
// staves — a bagged staff is now inert (notWielded).
test("a freeze/gas use with no kill leaves combat open", () => {
  // Phase 39 (GEAR-02): a real content staff name needs a charge to itemReady.
  const freezeStaff = { kind: "staff", n: "Birch Staff", use: "freeze", charges: 2 };
  const foe = fixedFoe({ wp: 20, maxWP: 20 });
  const state = fixedState({ c: { cls: "Magic User", weapon: "Birch Staff", staff: freezeStaff, items: [] }, combat: fixedCombat([foe]) });
  const events = useItem(state, { slot: "weapon" }, fakeRng([]), [], NOW);
  assert.notEqual(state.combat, null);
  assert.equal(state.combat.foes[0].alive, true);
  assert.equal(state.combat.foes[0].asleep, 99);
  assert.equal(events.some((e) => e.type === "encounterCleared"), false);

  const gasStaff = { kind: "staff", n: "Test Gas Staff", use: "gas" };
  const foe2 = fixedFoe({ wp: 20, maxWP: 20 });
  const state2 = fixedState({ c: { cls: "Magic User", weapon: "Test Gas Staff", staff: gasStaff, items: [] }, combat: fixedCombat([foe2]) });
  const events2 = useItem(state2, { slot: "weapon" }, fakeRng([]), [], NOW);
  assert.notEqual(state2.combat, null);
  assert.equal(events2.some((e) => e.type === "encounterCleared"), false);
});
