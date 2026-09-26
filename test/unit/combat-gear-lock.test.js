// test/unit/combat-gear-lock.test.js
//
// Phase 61 (GRULE-01): the combat gear lock. While a fight is up (the
// pending Fight! preview included), the engine refuses every player-
// reachable gear change — equipItem (weapon/armor/the targeted jewelry-cloak
// swap), unequipSlot, and the two loot/find verbs that can legitimately be
// reached mid-fight (a multi-foe kill parks its drop in state.pendingLoot
// while state.combat is still set; a pendingFind can linger into a fight) —
// with exactly one `gearRefused { verb, reason: "combat" }` event, zero rng
// draws, and the state otherwise byte-identical. After the fight (endCombat
// clears state.combat), every gated verb works exactly as before this
// phase. A property test proves no dispatchable ACTION_TYPES entry can move
// worn gear while state.combat is set. USE/potions/scrolls/spells/Drop stay
// live mid-fight (never refused with gearRefused). Both narration tables
// voice the refusal.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat, endCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { gearLockReason } from "../../engine/items.js";
import { ACTION_TYPES } from "../../engine/actions.js";
import { WORN_SLOTS } from "../../engine/derived.js";
import { CLOAKS, JEWELRY, ARMORS, SPELLS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, PRIORITY, FEATURE_EVENTS } from "../../src/browser/narrationLines.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";

// Seed 6 — the first newRun(seed), scanned 1..200, whose hero is a Fighter,
// a race that is NOT noArmor, and a sub that is NOT Woodsman (a Troll
// Knight). "Beasts" (CONTEXT's suggested category) ends the encounter
// INSIDE startCombat for this seed — the Knight's "beneath the notice of
// small things" rule flees every roster foe with maxWP < 5 before
// `combat.pending` is ever set — so this fixture forces "Demons" instead
// (measured directly: Demons/Humans/Magical/Walking Dead all leave
// combat.pending true for seed 6; Beasts and Lair Beasts do not).
const FIXTURE_SEED = 6;
const FORCED_CATEGORY = "Demons";

/**
 * buildBaseState() — a fresh seed-6 run with a hand-built inventory: four
 * plain bag items (weapon/armor/cloak/jewel), two ALREADY-worn pieces
 * (cloak + jewelry1, leaving jewelry2 free for the targeted-swap variant), a
 * two-item pending loot pile (a weapon + a jewel — CONTEXT's "a multi-foe
 * fight can park a kill's drop in state.pendingLoot while state.combat is
 * still set" case), and a lingering pendingFind (a cloak).
 */
function buildBaseState() {
  const state = newRun(FIXTURE_SEED);
  const c = state.c;
  const shortSword = { kind: "weapon", n: "Short Sword", base: "Short Sword", bonus: 0, txt: "d6+2" };
  const studded = ARMORS.find((a) => a.name === "Studded");
  const armorItem = {
    kind: "armor",
    n: studded.name,
    armor: studded.name,
    ar: studded.ar,
    wp: studded.wp,
    min: studded.min,
    cls: studded.cls,
    txt: `AR ${studded.ar}, ${studded.wp} hp`,
  };
  const bagCloak = Object.assign({ kind: "cloak" }, CLOAKS[0]);
  const bagJewel = Object.assign({ kind: "jewel" }, JEWELRY[0]);
  c.items = [shortSword, armorItem, bagCloak, bagJewel];
  c.worn = {
    cloak: Object.assign({ kind: "cloak" }, CLOAKS[1]),
    jewelry1: Object.assign({ kind: "jewel" }, JEWELRY[1]),
  };
  state.pendingLoot = [
    { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0, txt: "d8+2" },
    Object.assign({ kind: "jewel" }, JEWELRY[2]),
  ];
  state.pendingFind = Object.assign({ kind: "cloak" }, CLOAKS[2]);
  return state;
}

/** buildPending() — startCombat only (the pending Fight! preview). */
function buildPending() {
  const clone = buildBaseState();
  const rng = makeRng(clone.rngState);
  const events = [];
  startCombat(clone, false, FORCED_CATEGORY, rng, events);
  clone.rngState = rng.getState();
  assert.equal(clone.combat && clone.combat.pending, true, "fixture setup: expected combat.pending === true");
  return clone;
}

/** buildLive(pending) — dispatches "fight" to join the encounter for real. */
function buildLive(pending) {
  const { state } = applyAction(pending, { type: "fight" });
  assert.ok(state.combat && !state.combat.pending, "fixture setup: expected a LIVE (non-pending) combat");
  return state;
}

const PENDING = buildPending();
const LIVE = buildLive(PENDING);

/** gearSnapshot(c) — the fields a gear change can touch. Never armorWP/wp — combat durability and HP legitimately move. */
function gearSnapshot(c) {
  return JSON.stringify({ weapon: c.weapon, magicWpn: c.magicWpn, prof: c.prof, armor: c.armor, ar: c.ar, armorMax: c.armorMax, worn: c.worn });
}

/** rngNorm(n) — canonical unsigned 32-bit form (mulberry32's own getState() representation can be signed or unsigned depending on whether next() ran; both encode the same cursor). */
function rngNorm(n) {
  return n >>> 0;
}

const STATES = [
  ["PENDING", PENDING],
  ["LIVE", LIVE],
];

test("gearLockReason: null with no combat, \"combat\" for a pending or live fight", () => {
  const base = buildBaseState();
  assert.equal(gearLockReason(base), null);
  assert.equal(gearLockReason(PENDING), "combat");
  assert.equal(gearLockReason(LIVE), "combat");
});

// ─── equipItem refusal (weapon/armor/untargeted cloak/targeted jewel) ──────

for (const [label, S] of STATES) {
  test(`equipItem: ${label} — weapon/armor/cloak refuse with one gearRefused, state untouched`, () => {
    for (const i of [0, 1, 2]) {
      const before = { c: S.c, pendingLoot: S.pendingLoot, pendingFind: S.pendingFind, rngState: S.rngState };
      const it = S.c.items[i];
      const r = applyAction(S, { type: "equipItem", i });
      assert.deepStrictEqual(r.events, [{ type: "gearRefused", verb: "equipItem", reason: "combat", item: it }]);
      assert.deepStrictEqual(r.state.c, before.c);
      assert.deepStrictEqual(r.state.pendingLoot, before.pendingLoot);
      assert.deepStrictEqual(r.state.pendingFind, before.pendingFind);
      assert.equal(rngNorm(r.state.rngState), rngNorm(before.rngState));
    }
  });

  test(`equipItem: ${label} — the targeted jewelry2 swap refuses and carries the slot`, () => {
    const it = S.c.items[3];
    const r = applyAction(S, { type: "equipItem", i: 3, slot: "jewelry2" });
    assert.deepStrictEqual(r.events, [{ type: "gearRefused", verb: "equipItem", reason: "combat", item: it, slot: "jewelry2" }]);
    assert.deepStrictEqual(r.state.c, S.c);
  });

  test(`equipItem: ${label} — an out-of-range index stays a silent no-op`, () => {
    const r = applyAction(S, { type: "equipItem", i: 99 });
    assert.deepStrictEqual(r.events, []);
  });
}

// ─── unequipSlot refusal (weapon/armor/cloak/jewelry1/EMPTY jewelry2) ──────

for (const [label, S] of STATES) {
  test(`unequipSlot: ${label} — every slot (occupied or empty) refuses with one gearRefused, state untouched`, () => {
    for (const slot of ["weapon", "armor", "cloak", "jewelry1", "jewelry2"]) {
      const r = applyAction(S, { type: "unequipSlot", slot });
      assert.deepStrictEqual(r.events, [{ type: "gearRefused", verb: "unequipSlot", reason: "combat", slot }]);
      assert.deepStrictEqual(r.state.c, S.c);
    }
  });
}

// ─── loot/find refusal (takeLoot both forms, takeAllLoot, takeFind) ────────

for (const [label, S] of STATES) {
  test(`takeLoot/takeAllLoot/takeFind: ${label} — each refuses with one gearRefused, pile/find untouched`, () => {
    const equipNow = applyAction(S, { type: "takeLoot", i: 0, equip: true });
    assert.deepStrictEqual(equipNow.events, [{ type: "gearRefused", verb: "takeLoot", reason: "combat", item: S.pendingLoot[0] }]);
    assert.deepStrictEqual(equipNow.state.pendingLoot, S.pendingLoot);

    const stow = applyAction(S, { type: "takeLoot", i: 1 });
    assert.deepStrictEqual(stow.events, [{ type: "gearRefused", verb: "takeLoot", reason: "combat", item: S.pendingLoot[1] }]);

    const all = applyAction(S, { type: "takeAllLoot" });
    assert.deepStrictEqual(all.events, [{ type: "gearRefused", verb: "takeAllLoot", reason: "combat" }]);
    assert.deepStrictEqual(all.state.pendingLoot, S.pendingLoot);

    const find = applyAction(S, { type: "takeFind" });
    assert.deepStrictEqual(find.events, [{ type: "gearRefused", verb: "takeFind", reason: "combat", item: S.pendingFind }]);
    assert.deepStrictEqual(find.state.pendingFind, S.pendingFind);
  });

  test(`takeAllLoot/takeFind: ${label} — an empty pile / no pending find stay silent no-ops`, () => {
    const emptyPile = structuredClone(S);
    emptyPile.pendingLoot = [];
    const r1 = applyAction(emptyPile, { type: "takeAllLoot" });
    assert.deepStrictEqual(r1.events, []);

    const noFind = structuredClone(S);
    noFind.pendingFind = null;
    const r2 = applyAction(noFind, { type: "takeFind" });
    assert.deepStrictEqual(r2.events, []);
  });
}

// ─── after the fight: every gated verb works exactly as before this phase ─

test("after endCombat: equipItem/unequipSlot/takeLoot(equip)/takeFind all succeed exactly as before", () => {
  const clone = structuredClone(LIVE);
  const endEvents = [];
  endCombat(clone, endEvents);
  assert.equal(clone.combat, null);

  const weapon = applyAction(clone, { type: "equipItem", i: 0 });
  assert.ok(weapon.events.some((e) => e.type === "itemEquipped" && e.slot === "weapon"));
  assert.equal(weapon.state.c.weapon, "Short Sword");

  const unequip = applyAction(weapon.state, { type: "unequipSlot", slot: "cloak" });
  assert.ok(unequip.events.some((e) => e.type === "itemUnequipped" && e.slot === "cloak"));

  const lootEquip = applyAction(unequip.state, { type: "takeLoot", i: 0, equip: true });
  assert.ok(lootEquip.events.some((e) => e.type === "itemEquipped" && e.slot === "weapon"));

  const find = applyAction(lootEquip.state, { type: "takeFind" });
  assert.ok(find.events.some((e) => e.type === "findTaken"));
});

// ─── the property test: no ACTION_TYPES entry moves worn gear mid-fight ───

/**
 * payloadTable(c) — every ACTION_TYPES key mapped to its payload variant
 * list, per the plan's <action> enumeration. Asserted below to have EXACTLY
 * ACTION_TYPES's key set, so a future action type forces a decision here.
 */
function payloadTable(c) {
  return {
    move: [{ dir: "N" }],
    fight: [{}],
    attack: [{}],
    castSpell: Array.from({ length: SPELLS.length }, (_, k) => ({ idx: k })),
    drinkPotion: [{}],
    flee: [{}],
    parley: [{}],
    sing: [{}],
    readScroll: [{}],
    // RULES-10 (Phase 75.1): the ONE action a hero who cannot act may take —
    // no payload, like fight/attack.
    loseTurn: [{}],
    buyItem: [{ idx: 0 }],
    leaveStore: [{}],
    useItem: [...[0, 1, 2, 3].map((i) => ({ i })), ...WORN_SLOTS.map((slot) => ({ slot }))],
    camp: [{}],
    newGame: [{}],
    abandon: [{}],
    resolveJoiner: [{ accept: true }, { accept: false }],
    dismissJoiner: [{}],
    takeFind: [{}],
    leaveFind: [{}],
    dropItem: [{ i: 0 }],
    sellItem: [{ i: 0 }],
    equipItem: [...[0, 1, 2, 3].map((i) => ({ i })), { i: 2, slot: "cloak" }, { i: 3, slot: "jewelry2" }],
    unequipSlot: [...WORN_SLOTS, "weapon", "armor"].map((slot) => ({ slot })),
    takeLoot: [{ i: 0, equip: true }, { i: 0 }, { i: 1 }],
    leaveLoot: [{ i: 0 }],
    takeAllLoot: [{}],
    leaveAllLoot: [{}],
    useAbility: [...(c.abilities || []).map((key) => ({ key })), { key: "x" }],
    useTool: [{ tool: "rope", dir: "N" }],
  };
}

test("payload table covers exactly ACTION_TYPES (no entry added or missed)", () => {
  const table = payloadTable(PENDING.c);
  assert.deepStrictEqual(Object.keys(table).sort(), [...ACTION_TYPES].sort());
});

for (const [label, S] of STATES) {
  test(`property: ${label} — no ACTION_TYPES entry x payload variant moves the gear snapshot mid-fight`, () => {
    const table = payloadTable(S.c);
    let checked = 0;
    for (const [type, variants] of Object.entries(table)) {
      for (const payload of variants) {
        const before = gearSnapshot(S.c);
        const r = applyAction(S, { type, ...payload });
        assert.equal(gearSnapshot(r.state.c), before, `${type} ${JSON.stringify(payload)} moved the gear snapshot mid-fight`);
        checked++;
      }
    }
    assert.ok(checked > 50, `expected a substantial number of action x payload combinations checked; got ${checked}`);
  });
}

// ─── USE/potions/scrolls/spells/Drop stay live — never gearRefused ────────

for (const [label, S] of STATES) {
  test(`useItem/drinkPotion/readScroll/castSpell/dropItem: ${label} — never refused with gearRefused mid-fight`, () => {
    const table = payloadTable(S.c);
    for (const type of ["useItem", "drinkPotion", "readScroll", "castSpell", "dropItem"]) {
      for (const payload of table[type]) {
        const r = applyAction(S, { type, ...payload });
        assert.ok(
          !r.events.some((e) => e.type === "gearRefused"),
          `${type} ${JSON.stringify(payload)} was refused with gearRefused mid-fight`,
        );
      }
    }
  });
}

// ─── narration: both tables voice the refusal ─────────────────────────────

test("EVENT_NARRATION.gearRefused: equip/unequip verbs say \"Not the moment to change outfits.\"; loot/find verbs say \"The spoils can wait until the fight is over.\"", () => {
  assert.match(EVENT_NARRATION.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" }), /Not the moment to change outfits\./);
  assert.match(EVENT_NARRATION.gearRefused({ type: "gearRefused", verb: "unequipSlot", reason: "combat" }), /Not the moment to change outfits\./);
  for (const verb of ["takeLoot", "takeAllLoot", "takeFind"]) {
    assert.match(EVENT_NARRATION.gearRefused({ type: "gearRefused", verb, reason: "combat" }), /The spoils can wait until the fight is over\./);
  }
  // Defends every field — a bare { type } call must still return the gear line.
  assert.match(EVENT_NARRATION.gearRefused({ type: "gearRefused" }), /Not the moment to change outfits\./);
});

test("LINE_FOR.gearRefused: block-priority line, dull in the fight log", () => {
  const equipLine = LINE_FOR.gearRefused({ type: "gearRefused", verb: "equipItem", reason: "combat" });
  assert.deepStrictEqual(equipLine, { text: "Not the moment to change outfits.", tone: "block", priority: PRIORITY.block });

  const lootLine = LINE_FOR.gearRefused({ type: "gearRefused", verb: "takeLoot", reason: "combat" });
  assert.deepStrictEqual(lootLine, { text: "The spoils can wait until the fight is over.", tone: "block", priority: PRIORITY.block });

  const e = { type: "gearRefused", verb: "equipItem", reason: "combat", item: { n: "Short Sword" } };
  const lines = fightLogLinesFor("equipItem", [e]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].tone, "dull");
});

test("FEATURE_EVENTS includes \"gearRefused\"", () => {
  assert.ok(FEATURE_EVENTS.includes("gearRefused"));
});
