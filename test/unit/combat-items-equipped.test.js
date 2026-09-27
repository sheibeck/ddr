// test/unit/combat-items-equipped.test.js
//
// Phase 77 (CMBUI-14, user device report 2026-09-25: "show equipped on gear
// that is equipped, grey out unequipped gear that isn't usable during
// combat"). The combat ITEMS submenu:
//   - a worn jewelry/cloak row reads `EQUIPPED · <its state>` and stays
//     enabled (the RULES-13 wielded-staff row's pattern);
//   - a BAG row the engine would refuse as notWorn (a wearable reached by bag
//     index while `c.worn` exists — engine/items.js#useItem's own gate) is
//     disabled, reads NOT EQUIPPED and says why; its dispatch is unchanged so
//     a tap still lands the engine's own refusal line;
//   - the title's `N USABLE` and the grid's `N usable` count only enabled,
//     dispatchable rows (the potion row only while it is enabled).
// Presentation only: the engine's item rules are never edited to match the
// menu, and the engine-agreement test below proves the menu never disables
// anything the engine would let the player use.

import test from "node:test";
import assert from "node:assert/strict";

import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { applyAction } from "../../engine/engine.js";
import { WORN_SLOTS } from "../../engine/derived.js";
import { JEWELRY, CLOAKS } from "../../content/index.js";

// ─── fixtures (the fixed* shape of test/unit/combatMenu.test.js) ──────────

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, bag: "medium", worn: {},
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function fixedCombat(overrides = {}) {
  const foes = [fixedFoe()];
  return { foes, type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** A live fight (round 2, one foe) around the given hero. */
function inFight(cOverrides = {}, combatOverrides = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: fixedCombat(combatOverrides), store: null, beats: null, party: [],
    pendingJoiner: null, pendingFind: null, pendingLoot: [],
    dead: false, deathNote: "", epitaph: "",
  };
}

const RING = () => ({ kind: "jewel", ...JEWELRY.find((j) => j.n === "Ring of Power") });
const AMULET = () => ({ kind: "jewel", ...JEWELRY.find((j) => j.n === "Amulet of Light") });
const CLOAK = () => ({ kind: "cloak", ...CLOAKS.find((k) => k.n === "Cloak of Strength") });
const TORCH = () => ({ kind: "tool", tool: "torch", n: "Torch", use: "light", txt: "light for the dark" });
const BAG_POTION = () => ({ kind: "potion", n: "Healing", eff2: "heal", uses: 1, txt: "+d10+2 hp" });
const BIRCH = () => ({ n: "Birch Staff", kind: "staff", use: "heal", charges: 3, txt: "a staff" });

const items = (vm) => vm.submenus.items;
const row = (vm, id) => items(vm).rows.find((r) => r.id === id);
const enabledCount = (vm) => items(vm).rows.filter((r) => r.enabled && r.dispatch).length;

function assertCount(vm, n) {
  assert.equal(items(vm).title, `TEST DELVER · ITEMS · ${n} USABLE`);
  assert.equal(vm.actions[2].sub, `${n} usable`);
  assert.equal(enabledCount(vm), n, "the count is exactly the enabled, dispatchable rows");
}

// ─── the copy ─────────────────────────────────────────────────────────────

test("CMBUI-14: COMBAT_MENU_COPY carries notEquipped / notEquippedDesc — HP not WP, family-friendly, says it can't be swapped mid-fight", () => {
  assert.equal(COMBAT_MENU_COPY.notEquipped, "NOT EQUIPPED");
  const desc = COMBAT_MENU_COPY.notEquippedDesc;
  assert.equal(typeof desc, "string");
  assert.match(desc, /worn/i);
  assert.match(desc, /mid-fight/i);
  assert.doesNotMatch(desc, /\bWP\b/);
  // The BANNED-term scan over every COMBAT_MENU_COPY leaf (including these
  // two) lives in test/unit/combatMenu.test.js.
});

// ─── the behaviours ───────────────────────────────────────────────────────

test("CMBUI-14: worn ring, bagged cloak, two potions below full HP — POTION on, cloak NOT EQUIPPED off, ring EQUIPPED on; 2 USABLE", () => {
  const vm = combatMenuViewModel(inFight({ potions: 2, wp: 30, worn: { jewelry1: RING() }, items: [CLOAK()] }));
  assert.deepEqual(items(vm).rows.map((r) => r.id), ["potion", "item-0", "worn-jewelry1"]);
  assert.equal(row(vm, "potion").enabled, true);
  const cloak = row(vm, "item-0");
  assert.equal(cloak.label, "CLOAK OF STRENGTH");
  assert.equal(cloak.enabled, false);
  assert.equal(cloak.cost, COMBAT_MENU_COPY.notEquipped);
  assert.equal(cloak.desc, COMBAT_MENU_COPY.notEquippedDesc);
  assert.deepEqual(cloak.dispatch, { type: "useItem", i: 0 }, "dispatch unchanged: a tap still lands the engine's own notWorn line");
  const ring = row(vm, "worn-jewelry1");
  assert.equal(ring.enabled, true);
  assert.equal(ring.cost, `${COMBAT_MENU_COPY.equipped} · READY`);
  assert.deepEqual(ring.dispatch, { type: "useItem", slot: "jewelry1" });
  assertCount(vm, 2);
});

test("CMBUI-14: the same at full HP — the potion row is disabled and the count drops by one", () => {
  const vm = combatMenuViewModel(inFight({ potions: 2, wp: 55, worn: { jewelry1: RING() }, items: [CLOAK()] }));
  assert.equal(row(vm, "potion").enabled, false);
  assertCount(vm, 1);
});

test("CMBUI-14 boundary: only a bagged ring and a bagged cloak — both rows show disabled, 0 USABLE, no NOTHING TO USE collapse", () => {
  const vm = combatMenuViewModel(inFight({ items: [RING(), CLOAK()] }));
  const ids = items(vm).rows.map((r) => r.id);
  assert.ok(ids.includes("item-0") && ids.includes("item-1"));
  assert.ok(!ids.includes("none"), "the collapse stays presence-based");
  for (const id of ["item-0", "item-1"]) {
    assert.equal(row(vm, id).enabled, false);
    assert.equal(row(vm, id).cost, COMBAT_MENU_COPY.notEquipped);
  }
  assertCount(vm, 0);
});

test("CMBUI-14 boundary: exactly one enabled row reads 1 USABLE", () => {
  const vm = combatMenuViewModel(inFight({ items: [CLOAK()], worn: { jewelry1: RING() } }));
  assertCount(vm, 1);
});

test("CMBUI-14 adjacency: the same ring worn and a copy in the bag — two rows, EQUIPPED on and NOT EQUIPPED off", () => {
  const vm = combatMenuViewModel(inFight({ items: [RING()], worn: { jewelry1: RING() } }));
  const bag = row(vm, "item-0");
  const worn = row(vm, "worn-jewelry1");
  assert.equal(bag.label, worn.label);
  assert.equal(bag.enabled, false);
  assert.equal(bag.cost, COMBAT_MENU_COPY.notEquipped);
  assert.equal(worn.enabled, true);
  assert.equal(worn.cost, `${COMBAT_MENU_COPY.equipped} · READY`);
  assertCount(vm, 1);
});

test("CMBUI-14 empty: no items at all is today's single NOTHING TO USE row, 0 USABLE", () => {
  const vm = combatMenuViewModel(inFight({}));
  assert.deepEqual(items(vm).rows, [
    { id: "none", label: COMBAT_MENU_COPY.noItems, cost: "", desc: COMBAT_MENU_COPY.noItemsDesc, enabled: false, dispatch: null },
  ]);
  assertCount(vm, 0);
});

test("CMBUI-14 legacy: a character with no c.worn keeps a bagged ring enabled (the engine's notWorn gate never fires without c.worn)", () => {
  const state = inFight({ items: [RING()] });
  delete state.c.worn;
  const vm = combatMenuViewModel(state);
  const ring = row(vm, "item-0");
  assert.equal(ring.enabled, true);
  assert.equal(ring.cost, "READY");
  assert.equal(ring.desc, RING().txt);
  assertCount(vm, 1);
});

test("CMBUI-14: a bag torch and a bag potion stay enabled; a bagged staff keeps NOT WIELDED; the wielded staff keeps its EQUIPPED row", () => {
  const vm = combatMenuViewModel(
    inFight({ cls: "Magic User", sub: "Wizard", weapon: "Birch Staff", staff: BIRCH(), items: [TORCH(), BAG_POTION(), BIRCH()] }),
  );
  assert.equal(row(vm, "item-0").enabled, true, "torch");
  assert.equal(row(vm, "item-1").enabled, true, "bag potion");
  const bagStaff = row(vm, "item-2");
  assert.equal(bagStaff.enabled, false);
  assert.equal(bagStaff.cost, COMBAT_MENU_COPY.notWielded);
  assert.equal(bagStaff.desc, COMBAT_MENU_COPY.notWieldedDesc);
  const wielded = row(vm, "worn-weapon");
  assert.equal(wielded.enabled, true);
  assert.equal(wielded.cost, `${COMBAT_MENU_COPY.equipped} · READY`);
  assertCount(vm, 3);
});

test("CMBUI-14: a worn row mid-effect reads EQUIPPED · <its state>, never a bare state", () => {
  const ring = RING();
  const vm = combatMenuViewModel(inFight({ worn: { jewelry1: ring }, timers: { [`item:${ring.n}`]: { phase: "effect", until: 12, at: 0 } }, steps: 0 }));
  const worn = row(vm, "worn-jewelry1");
  assert.match(worn.cost, new RegExp(`^${COMBAT_MENU_COPY.equipped} · \\S`));
  assert.equal(worn.enabled, true);
});

test("CMBUI-14 ordering: potion, scroll, bag rows in bag order, the wielded staff, worn rows in WORN_SLOTS order; disabling never moves a row", () => {
  const vm = combatMenuViewModel(
    inFight({
      cls: "Magic User", sub: "Wizard", weapon: "Birch Staff", staff: BIRCH(),
      potions: 1, wp: 20, scrolls: 1,
      items: [TORCH(), CLOAK(), RING()],
      worn: { cloak: CLOAK(), jewelry2: AMULET(), jewelry1: RING() },
    }),
  );
  assert.deepEqual(items(vm).rows.map((r) => r.id), [
    "potion", "scroll", "item-0", "item-1", "item-2", "worn-weapon",
    ...WORN_SLOTS.map((s) => `worn-${s}`),
  ]);
  assert.deepEqual(items(vm).rows.map((r) => r.enabled), [true, true, true, false, false, true, true, true, true]);
  assertCount(vm, 7);
});

// ─── agreement with the engine ────────────────────────────────────────────

const FIXTURES = [
  () => inFight({ potions: 2, wp: 30, worn: { jewelry1: RING() }, items: [CLOAK()] }),
  () => inFight({ items: [RING(), CLOAK()] }),
  () => inFight({ items: [RING()], worn: { jewelry1: RING() } }),
  () => {
    const s = inFight({ items: [RING(), CLOAK(), TORCH()] });
    delete s.c.worn;
    return s;
  },
  () => inFight({ cls: "Magic User", sub: "Wizard", weapon: "Birch Staff", staff: BIRCH(), items: [TORCH(), BAG_POTION(), BIRCH()] }),
  () => inFight({ cls: "Magic User", sub: "Wizard", weapon: "Fists", staff: null, items: [BIRCH(), AMULET()], worn: { cloak: CLOAK() } }),
  () =>
    inFight({
      cls: "Magic User", sub: "Wizard", weapon: "Birch Staff", staff: BIRCH(),
      potions: 1, wp: 20, scrolls: 1,
      items: [TORCH(), CLOAK(), RING()],
      worn: { cloak: CLOAK(), jewelry2: AMULET(), jewelry1: RING() },
    }),
];

test("CMBUI-14 agreement: every bag-index row is disabled exactly when the engine's own useItem refuses it notWorn or notWielded", () => {
  let checked = 0;
  for (const make of FIXTURES) {
    const state = make();
    const vm = combatMenuViewModel(state);
    for (const r of items(vm).rows) {
      if (!r.dispatch || r.dispatch.type !== "useItem") continue;
      const { events } = applyAction(structuredClone(state), r.dispatch);
      const refusedAsUnworn = events.some((e) => e.type === "useRefused" && (e.reason === "notWorn" || e.reason === "notWielded"));
      if (r.dispatch.i !== undefined) {
        assert.equal(r.enabled, !refusedAsUnworn, `${r.id} (${r.label}): menu enabled=${r.enabled}, engine ${JSON.stringify(events.map((e) => e.reason || e.type))}`);
        checked++;
      } else {
        // A slot row (worn gear, the wielded staff) is never an unworn refusal.
        assert.equal(refusedAsUnworn, false, `${r.id}: a worn/wielded row is never refused as unworn`);
        assert.equal(r.enabled, true);
      }
    }
  }
  assert.ok(checked >= 10, `checked ${checked} bag rows`);
});

test("CMBUI-14 precision: over every fixture the title and grid sub agree and equal the enabled, dispatchable row count", () => {
  for (const make of FIXTURES) {
    const vm = combatMenuViewModel(make());
    const n = enabledCount(vm);
    assert.equal(items(vm).title, `TEST DELVER · ITEMS · ${n} USABLE`);
    assert.equal(vm.actions[2].sub, `${n} usable`);
  }
});
