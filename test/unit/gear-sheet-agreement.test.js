// test/unit/gear-sheet-agreement.test.js
//
// Phase 63 Plan 03 (GSCR-09, GRULE-02). Two things:
//
//   1. Rail-line coverage: itemDropped/itemUnequipped moved out of
//      ORACLE_ONLY into LINE_FOR (src/browser/narrationLines.js), so DROP,
//      UNEQUIP and DISCARD reach the rail in voice — the sheet closes on
//      the tap, and the rail is the one feedback surface. (Task 1)
//   2. The sheet-vs-engine agreement sweep: every action gearSheetModel
//      offers, across a state sweep, is dispatched through the REAL
//      applyAction. Every greyed reason must be exactly what the engine
//      says when the action is forced anyway (GSCR-09's honesty
//      prohibition — never grey with a reason the engine would not give).
//      Every enabled action must produce a rail or fight-log line. GRULE-02
//      (after the fight, everything works again) is proven directly. (Task 2)

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { startCombat, endCombat } from "../../engine/combat.js";
import { makeRng } from "../../engine/rng.js";
import { bagCap, weaponRefusalReason, armorRefusalReason } from "../../engine/items.js";
import { CLOAKS, JEWELRY, ARMORS } from "../../content/index.js";

import { ORACLE_ONLY, LINE_FOR, linesForAction, slotWord } from "../../src/browser/narrationLines.js";
import { railCardFor } from "../../src/browser/rail.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { gearSheetModel, GEAR_SHEET_COPY } from "../../src/browser/gearSheet.js";
import { gearBagCardsModel, GEAR_WORN_ORDER } from "../../src/browser/gearTab.js";
import { lootCompare, itemStatLines, wornItemFor } from "../../src/browser/viewModels.js";
import { fixedStates } from "./harness/shellSandbox.js";

// ════════════════════════════════════════════════════════════════════════
// Task 1 — itemDropped and itemUnequipped reach the rail
// ════════════════════════════════════════════════════════════════════════

test("rail lines: itemDropped/itemUnequipped are keys of LINE_FOR and NOT in ORACLE_ONLY", () => {
  assert.equal(ORACLE_ONLY.has("itemDropped"), false);
  assert.equal(ORACLE_ONLY.has("itemUnequipped"), false);
  assert.equal(typeof LINE_FOR.itemDropped, "function");
  assert.equal(typeof LINE_FOR.itemUnequipped, "function");
});

test("rail lines: dropItem's itemDropped folds into exactly one line naming the item", () => {
  const events = [{ type: "itemDropped", item: { n: "Rope" } }];
  const lines = linesForAction("dropItem", events, {}, { limit: Infinity });
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /Rope/);
});

test("rail lines: unequipSlot's itemUnequipped folds into one line naming the item and the slot's FAMILY word, never the raw key", () => {
  const events = [{ type: "itemUnequipped", item: { n: "Ring of Power" }, slot: "jewelry1" }];
  const lines = linesForAction("unequipSlot", events, {}, { limit: Infinity });
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /Ring of Power/);
  assert.match(lines[0].text, new RegExp(slotWord("jewelry1")));
  assert.doesNotMatch(lines[0].text, /jewelry1/);
});

test("rail lines: a destroyed unequip (DISCARD) reads its own line, distinct from the normal unequip line, naming the item", () => {
  const normalEvents = [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor" }];
  const destroyedEvents = [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor", destroyed: true }];
  const normalLines = linesForAction("unequipSlot", normalEvents, {}, { limit: Infinity });
  const destroyedLines = linesForAction("unequipSlot", destroyedEvents, {}, { limit: Infinity });
  assert.equal(normalLines.length, 1);
  assert.equal(destroyedLines.length, 1);
  assert.match(destroyedLines[0].text, /Plate/);
  assert.notEqual(destroyedLines[0].text, normalLines[0].text);
});

test("rail lines: railCardFor is non-null for a drop, a plain unequip and a destroyed unequip", () => {
  for (const [type, events] of [
    ["dropItem", [{ type: "itemDropped", item: { n: "Rope" } }]],
    ["unequipSlot", [{ type: "itemUnequipped", item: { n: "Ring of Power" }, slot: "jewelry1" }]],
    ["unequipSlot", [{ type: "itemUnequipped", item: { n: "Plate" }, slot: "armor", destroyed: true }]],
  ]) {
    const folded = linesForAction(type, events, {}, { limit: Infinity, withIdx: true });
    const card = railCardFor(type, events, folded);
    assert.ok(card, `railCardFor(${type}, ...) should be non-null for ${JSON.stringify(events)}`);
  }
});

test("rail lines: a bare {type} builder call never throws and never contains 'undefined'", () => {
  for (const type of ["itemDropped", "itemUnequipped"]) {
    let result;
    assert.doesNotThrow(() => {
      result = LINE_FOR[type]({ type });
    });
    assert.ok(result && typeof result.text === "string" && result.text.length > 0);
    assert.doesNotMatch(result.text, /undefined/);
  }
});

// ════════════════════════════════════════════════════════════════════════
// Task 2 — the state sweep's fixture builders
// ════════════════════════════════════════════════════════════════════════

// Seed 6, "Demons" — copied verbatim from test/unit/combat-gear-lock.test.js
// (see that file's own header comment for why this seed/category pair was
// chosen: a Troll Knight Fighter whose "Demons" encounter leaves
// combat.pending true).
const FIXTURE_SEED = 6;
const FORCED_CATEGORY = "Demons";

/**
 * buildBaseState() — the seed-6 fixture's inventory (four bag items, two
 * already-worn pieces), out of combat. This plan's sweep drops
 * pendingLoot/pendingFind (set to empty/null) — unlike combat-gear-lock's
 * own fixture, this plan's sweep never targets the loot/find pile, only the
 * sheet's WORN/BAG targets.
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
  state.pendingLoot = [];
  state.pendingFind = null;
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

const BASE = buildBaseState();
const PENDING = buildPending();
const LIVE = buildLive(PENDING);
const { thief: THIEF, mu: MU } = fixedStates();

/**
 * SPIKED — newRun(7).c is a level-1 Human Wizard (Quarter Staff, prof 0)
 * (test/unit/upgrade-why.test.js's own measured comment); bumped to level 3
 * with the Spiked Staff as the only bag item, matching the CONTEXT
 * acceptance example (a Magic User opens the Spiked Staff bag card).
 */
const SPIKED = (() => {
  const state = newRun(7);
  const c = state.c;
  c.level = 3;
  c.weapon = "Quarter Staff";
  c.prof = 0;
  c.magicWpn = 0;
  c.items = [{ kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" }];
  return state;
})();

/**
 * ILLEGAL — a Magic User (newRun(7)) with a bagged Long Sword (cls "FT",
 * illegal for a Magic User) and a bagged Mail (cls "F", illegal for a
 * Magic User) — two independent illegal-candidate cases, weapon and armor.
 */
const ILLEGAL = (() => {
  const state = newRun(7);
  const c = state.c;
  const mail = ARMORS.find((a) => a.name === "Mail");
  c.items = [
    { kind: "weapon", n: "Long Sword", base: "Long Sword", bonus: 0, txt: "d8+2" },
    { kind: "armor", n: mail.name, armor: mail.name, ar: mail.ar, wp: mail.wp, min: mail.min, cls: mail.cls, txt: `AR ${mail.ar}, ${mail.wp} hp` },
  ];
  return state;
})();

/**
 * SCRAP — a Fighter with destroyed worn armor (Mail, ar 12, armorWP 0,
 * armorMax 40 — the DISCARD case, which needs no bag room) AND a worn
 * cloak, on a bag filled to cap with plain filler weapons (the bag-full
 * UNEQUIP case: unequipping the cloak needs a free slot the full bag does
 * not have).
 */
const SCRAP = (() => {
  const state = newRun(11, [], { force: { cls: "Fighter" } });
  const c = state.c;
  c.armor = "Mail";
  c.ar = 12;
  c.armorMin = 3;
  c.armorMax = 40;
  c.armorWP = 0;
  c.patches = 0;
  c.worn.cloak = Object.assign({ kind: "cloak" }, CLOAKS[0]);
  const cap = bagCap(c);
  c.items = [];
  let n = 0;
  while (c.items.length < cap) {
    c.items.push({ kind: "weapon", n: `Filler ${n}`, base: "Short Sword", bonus: 0, txt: "d6+2" });
    n++;
  }
  return state;
})();

test("fixtures: ILLEGAL's Long Sword and Mail are really illegal for this Magic User (lootCompare legal === false)", () => {
  assert.equal(lootCompare(ILLEGAL.c, ILLEGAL.c.items[0]).legal, false, "Long Sword must be illegal");
  assert.equal(lootCompare(ILLEGAL.c, ILLEGAL.c.items[1]).legal, false, "Mail must be illegal");
});

test("fixtures: SCRAP's bag is genuinely full and its armor is genuinely destroyed", () => {
  assert.equal(SCRAP.c.items.length, bagCap(SCRAP.c), "SCRAP bag must be filled to cap");
  assert.ok(SCRAP.c.armor && SCRAP.c.armor !== "Nothing" && SCRAP.c.ar > 0 && SCRAP.c.armorWP <= 0, "SCRAP armor must be worn-but-destroyed");
});

// ════════════════════════════════════════════════════════════════════════
// The sweep itself — every target x every action, dispatched through the
// real applyAction exactly once each. Run ONCE at module scope (mirroring
// combat-gear-lock.test.js's own PENDING/LIVE-at-module-scope pattern) so
// every test() below reads the SAME dispatch results rather than re-running
// the sweep per assertion.
// ════════════════════════════════════════════════════════════════════════

/** gearSnapshot(c) — the fields a gear change can touch (never armorWP/wp — combat durability legitimately moves elsewhere, not exercised here). */
function gearSnapshot(c) {
  return JSON.stringify({ weapon: c.weapon, magicWpn: c.magicWpn, prof: c.prof, armor: c.armor, ar: c.ar, armorMax: c.armorMax, worn: c.worn });
}

const SWEEP_STATES = [
  ["BASE", BASE, false],
  ["PENDING", PENDING, true],
  ["LIVE", LIVE, true],
  ["THIEF", THIEF, false],
  ["MU", MU, false],
  ["SPIKED", SPIKED, false],
  ["ILLEGAL", ILLEGAL, false],
  ["SCRAP", SCRAP, false],
];

/**
 * runSweep() — builds `targets` for every state (every GEAR_WORN_ORDER slot
 * plus every dropShelfItems(c)-backed bag card, via gearBagCardsModel), and
 * for every gearSheetModel(state, target) action that carries a `run`,
 * dispatches applyAction(state, run) exactly once. Classifies every greyed
 * action's `reason` against the engine's own text (combat / bagFull /
 * illegal) and asserts the dispatched events + state-unchanged invariant
 * for greyed actions, or the produced-a-line invariant for enabled actions.
 * `state` itself is never mutated (applyAction structuredClones internally)
 * — one built state safely serves every one of its own targets/actions.
 */
function runSweep() {
  const results = [];
  const counters = { total: 0, combat: 0, bagFull: 0, illegal: 0, enabled: 0, nothing: 0 };
  const unclassified = [];

  for (const [label, state, inCombat] of SWEEP_STATES) {
    const cards = gearBagCardsModel(state);
    const targets = [...GEAR_WORN_ORDER.map((slot) => ({ from: "worn", slot })), ...cards.map((card) => ({ from: "bag", i: card.i, n: card.name }))];

    for (const target of targets) {
      const model = gearSheetModel(state, target);
      results.push({ label, target, model });
      if (!model) continue;

      for (const action of model.actions) {
        const c = state.c;

        if (!action.run) {
          counters.nothing++;
          results.push({ label, target, action, noRun: true });
          continue;
        }

        counters.total++;
        const before = gearSnapshot(c);
        const itemsLenBefore = c.items.length;
        const { state: after, events } = applyAction(state, action.run);

        if (!action.enabled) {
          const combatText = LINE_FOR.gearRefused({ type: "gearRefused", verb: action.run.type, reason: "combat" }).text;
          if (action.reason === combatText) {
            counters.combat++;
            results.push({ label, target, action, kind: "combat", state, before, itemsLenBefore, after, events });
          } else if (action.reason === GEAR_SHEET_COPY.sub.bagFull) {
            counters.bagFull++;
            results.push({ label, target, action, kind: "bagFull", state, before, itemsLenBefore, after, events });
          } else {
            const it = c.items[action.run.i];
            const expectedLine = it ? lootCompare(c, it).line : null;
            if (it && action.reason === expectedLine) {
              counters.illegal++;
              results.push({ label, target, action, kind: "illegal", state, c, it, before, itemsLenBefore, after, events });
            } else {
              unclassified.push({ label, key: action.key, reason: action.reason });
            }
          }
        } else {
          counters.enabled++;
          results.push({ label, target, action, kind: "enabled", inCombat, state, events });
        }
      }
    }
  }

  return { results, counters, unclassified };
}

const SWEEP = runSweep();

test("sweep: every WORN-slot and BAG-card target resolves (gearSheetModel is never null)", () => {
  const nulls = SWEEP.results.filter((r) => "model" in r && r.model === null);
  assert.deepStrictEqual(
    nulls.map((r) => `${r.label}/${JSON.stringify(r.target)}`),
    [],
    "every target built from GEAR_WORN_ORDER / gearBagCardsModel must resolve",
  );
});

test("sweep (Phase 71, D-04): every resolved target's stats is an array of non-empty strings, equal to the one formatter's own texts", () => {
  let targets = 0;
  for (const [label, state] of SWEEP_STATES) {
    const c = state.c;
    const cards = gearBagCardsModel(state);
    const all = [...GEAR_WORN_ORDER.map((slot) => ({ from: "worn", slot })), ...cards.map((card) => ({ from: "bag", i: card.i, n: card.name }))];
    for (const target of all) {
      let model;
      assert.doesNotThrow(() => {
        model = gearSheetModel(state, target);
      }, `${label}/${JSON.stringify(target)}`);
      assert.ok(model, `${label}/${JSON.stringify(target)} must resolve`);
      assert.ok(Array.isArray(model.stats), `${label}/${JSON.stringify(target)}: stats must be an array`);
      for (const s of model.stats) assert.ok(typeof s === "string" && s.length > 0, `${label}/${JSON.stringify(target)}: "${s}"`);
      const item = target.from === "bag" ? c.items[target.i] : wornItemFor(c, target.slot);
      assert.deepStrictEqual(model.stats, itemStatLines(item, c).map((l) => l.text), `${label}/${JSON.stringify(target)}`);
      targets++;
    }
  }
  assert.ok(targets >= 40, `expected at least 40 swept targets, got ${targets}`);
});

test("sweep: every greyed action's reason is unambiguously combat, bagFull or illegal — no unclassifiable reason", () => {
  assert.deepStrictEqual(SWEEP.unclassified, [], `unclassifiable greyed reason(s):\n${SWEEP.unclassified.map((u) => `${u.label}/${u.key}: "${u.reason}"`).join("\n")}`);
});

test("sweep, greyed by combat: the engine refuses with exactly one gearRefused{reason:'combat'} whose LINE_FOR text is the action's own reason, gear snapshot and item count untouched", () => {
  const combatRows = SWEEP.results.filter((r) => r.kind === "combat");
  assert.ok(combatRows.length > 0, "expected at least one combat-greyed dispatch");
  for (const row of combatRows) {
    const refused = row.events.filter((e) => e.type === "gearRefused");
    assert.equal(refused.length, 1, `${row.label}/${row.action.key}: expected exactly one gearRefused event`);
    assert.equal(refused[0].reason, "combat", `${row.label}/${row.action.key}: gearRefused.reason must be "combat"`);
    assert.equal(LINE_FOR.gearRefused(refused[0]).text, row.action.reason, `${row.label}/${row.action.key}: LINE_FOR.gearRefused(event).text must equal action.reason`);
    assert.equal(gearSnapshot(row.after.c), row.before, `${row.label}/${row.action.key}: gear snapshot must be unchanged`);
    assert.equal(row.after.c.items.length, row.itemsLenBefore, `${row.label}/${row.action.key}: item count must be unchanged`);
  }
});

test("sweep, greyed by a full bag: the engine pushes a bagFull event and the action's reason is GEAR_SHEET_COPY.sub.bagFull, gear snapshot untouched", () => {
  const bagFullRows = SWEEP.results.filter((r) => r.kind === "bagFull");
  assert.ok(bagFullRows.length > 0, "expected at least one bag-full-greyed dispatch");
  for (const row of bagFullRows) {
    assert.ok(row.events.some((e) => e.type === "bagFull"), `${row.label}/${row.action.key}: expected a bagFull event`);
    assert.equal(row.action.reason, GEAR_SHEET_COPY.sub.bagFull, `${row.label}/${row.action.key}: reason must be the bag-full copy`);
    assert.equal(gearSnapshot(row.after.c), row.before, `${row.label}/${row.action.key}: gear snapshot must be unchanged`);
  }
});

test("sweep, greyed by illegality: the engine's equipRejected.reason is the weapon/armor refusal reason, and the action's reason is lootCompare(c, it).line", () => {
  const illegalRows = SWEEP.results.filter((r) => r.kind === "illegal");
  assert.ok(illegalRows.length > 0, "expected at least one illegality-greyed dispatch");
  for (const row of illegalRows) {
    const rejected = row.events.find((e) => e.type === "equipRejected");
    assert.ok(rejected, `${row.label}/${row.action.key}: expected an equipRejected event`);
    const expectedReason = row.it.kind === "weapon" ? weaponRefusalReason(row.c, row.it) : armorRefusalReason(row.c, row.it);
    assert.equal(rejected.reason, expectedReason, `${row.label}/${row.action.key}: equipRejected.reason must match the engine's own refusal predicate`);
    assert.equal(row.action.reason, lootCompare(row.c, row.it).line, `${row.label}/${row.action.key}: action.reason must equal lootCompare(c, it).line`);
  }
});

test("sweep, enabled: the dispatch is never refused (no gearRefused/equipRejected/bagFull), and always produces a rail or fight-log line", () => {
  const enabledRows = SWEEP.results.filter((r) => r.kind === "enabled");
  assert.ok(enabledRows.length > 0, "expected at least one enabled dispatch");
  for (const row of enabledRows) {
    assert.ok(
      !row.events.some((e) => e.type === "gearRefused" || e.type === "equipRejected" || e.type === "bagFull"),
      `${row.label}/${row.action.key}: an enabled action must never be refused; events=${JSON.stringify(row.events)}`,
    );
    if (row.inCombat) {
      const lines = fightLogLinesFor(row.action.run.type, row.events, {});
      assert.ok(lines.length >= 1, `${row.label}/${row.action.key}: expected at least one fight-log line`);
    } else {
      const lines = linesForAction(row.action.run.type, row.events, {}, { limit: Infinity });
      assert.ok(lines.length >= 1, `${row.label}/${row.action.key}: expected at least one rail line`);
      const folded = linesForAction(row.action.run.type, row.events, {}, { limit: Infinity, withIdx: true });
      assert.ok(railCardFor(row.action.run.type, row.events, folded), `${row.label}/${row.action.key}: expected a non-null rail card`);
    }
  }
});

test("sweep, enabled: EQUIP/SWAP produce itemEquipped; UNEQUIP/DISCARD produce itemUnequipped; DROP produces itemDropped", () => {
  const enabledRows = SWEEP.results.filter((r) => r.kind === "enabled");
  let equipChecked = 0;
  let unequipChecked = 0;
  let dropChecked = 0;
  for (const row of enabledRows) {
    const key = row.action.key;
    if (key.startsWith("equip:") || key.startsWith("swap:") || key.startsWith("slot:")) {
      assert.ok(row.events.some((e) => e.type === "itemEquipped"), `${row.label}/${key}: expected itemEquipped`);
      equipChecked++;
    } else if (key === "unequip" || key === "discard") {
      assert.ok(row.events.some((e) => e.type === "itemUnequipped"), `${row.label}/${key}: expected itemUnequipped`);
      unequipChecked++;
    } else if (key === "drop") {
      assert.ok(row.events.some((e) => e.type === "itemDropped"), `${row.label}/${key}: expected itemDropped`);
      dropChecked++;
    }
  }
  assert.ok(equipChecked > 0 && unequipChecked > 0 && dropChecked > 0, `expected all three outcome shapes to be exercised; got equip=${equipChecked} unequip=${unequipChecked} drop=${dropChecked}`);
});

test("sweep: load-bearing counters — at least 40 dispatches, at least 10 greyed by combat, at least 1 by a full bag, at least 2 by illegality", () => {
  const { counters } = SWEEP;
  assert.ok(counters.total >= 40, `expected >=40 total dispatches; got ${counters.total} (${JSON.stringify(counters)})`);
  assert.ok(counters.combat >= 10, `expected >=10 combat-greyed dispatches; got ${counters.combat} (${JSON.stringify(counters)})`);
  assert.ok(counters.bagFull >= 1, `expected >=1 bag-full-greyed dispatch; got ${counters.bagFull} (${JSON.stringify(counters)})`);
  assert.ok(counters.illegal >= 2, `expected >=2 illegality-greyed dispatches; got ${counters.illegal} (${JSON.stringify(counters)})`);
});

test("Edge GSCR-09/encoding: every greyed reason is byte-equal to its engine-derived source, and contains no '<'", () => {
  const greyedRows = SWEEP.results.filter((r) => r.kind === "combat" || r.kind === "bagFull" || r.kind === "illegal");
  assert.ok(greyedRows.length > 0, "expected at least one greyed row to scan");
  for (const row of greyedRows) {
    assert.doesNotMatch(row.action.reason, /</, `${row.label}/${row.action.key}: greyed reason must never carry markup`);
    if (row.kind === "combat") {
      assert.equal(row.action.reason, LINE_FOR.gearRefused({ type: "gearRefused", verb: row.action.run.type, reason: "combat" }).text);
    } else if (row.kind === "bagFull") {
      assert.equal(row.action.reason, GEAR_SHEET_COPY.sub.bagFull);
    } else {
      assert.equal(row.action.reason, lootCompare(row.c, row.it).line);
    }
  }
  // NOTHING TO EQUIP's own greyed reason (no run) is also scanned — never markup.
  const nothingRows = SWEEP.results.filter((r) => r.noRun);
  for (const row of nothingRows) {
    assert.doesNotMatch(row.action.reason, /</, `${row.label}/${row.action.key}: NOTHING TO EQUIP's reason must never carry markup`);
    assert.ok(row.action.reason.length > 0, `${row.label}/${row.action.key}: NOTHING TO EQUIP must still carry a non-empty reason`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// GRULE-02 — after the fight, everything works again
// ════════════════════════════════════════════════════════════════════════

test("GRULE-02: every action greyed ONLY by the combat lock in PENDING/LIVE is enabled on the same inventory with combat cleared, and dispatching it succeeds", () => {
  const clearedLive = structuredClone(LIVE);
  const endEvents = [];
  endCombat(clearedLive, endEvents);
  assert.equal(clearedLive.combat, null, "fixture setup: endCombat must clear state.combat");
  assert.equal(gearSnapshot(clearedLive.c), gearSnapshot(BASE.c), "fixture setup: LIVE's inventory, combat cleared, must match BASE's inventory");

  const pairs = [
    ["PENDING", PENDING, BASE],
    ["LIVE", LIVE, clearedLive],
  ];

  let checked = 0;
  for (const [label, state, cleared] of pairs) {
    const cards = gearBagCardsModel(state);
    const targets = [...GEAR_WORN_ORDER.map((slot) => ({ from: "worn", slot })), ...cards.map((card) => ({ from: "bag", i: card.i, n: card.name }))];

    for (const target of targets) {
      const model = gearSheetModel(state, target);
      if (!model) continue;
      for (const action of model.actions) {
        if (!action.run || action.enabled) continue;
        const combatText = LINE_FOR.gearRefused({ type: "gearRefused", verb: action.run.type, reason: "combat" }).text;
        if (action.reason !== combatText) continue; // greyed for a different reason (never happens for PENDING/LIVE here, but stay honest)

        checked++;
        const clearedModel = gearSheetModel(cleared, target);
        assert.ok(clearedModel, `${label}/${action.key}: target must still resolve once combat is cleared`);
        const clearedAction = clearedModel.actions.find((a) => a.key === action.key);
        assert.ok(clearedAction, `${label}/${action.key}: the same action key must still exist once combat is cleared`);
        assert.equal(clearedAction.enabled, true, `${label}/${action.key}: must be enabled once combat is cleared (was greyed only by the combat lock)`);

        const { events } = applyAction(cleared, clearedAction.run);
        assert.ok(
          events.some((e) => e.type === "itemEquipped" || e.type === "itemUnequipped"),
          `${label}/${action.key}: dispatching the now-enabled action must succeed (itemEquipped or itemUnequipped); got ${JSON.stringify(events)}`,
        );
      }
    }
  }
  assert.ok(checked >= 10, `expected to re-check at least 10 combat-cleared actions; got ${checked}`);
});

test("GRULE-02: USE and DROP are enabled on every applicable target in BASE, PENDING and LIVE alike", () => {
  let useChecked = 0;
  let dropChecked = 0;
  for (const [, state] of [["BASE", BASE], ["PENDING", PENDING], ["LIVE", LIVE]]) {
    const cards = gearBagCardsModel(state);
    const targets = [...GEAR_WORN_ORDER.map((slot) => ({ from: "worn", slot })), ...cards.map((card) => ({ from: "bag", i: card.i, n: card.name }))];
    for (const target of targets) {
      const model = gearSheetModel(state, target);
      if (!model) continue;
      for (const action of model.actions) {
        if (action.key === "use") {
          assert.equal(action.enabled, true, "USE must never be greyed");
          useChecked++;
        } else if (action.key === "drop") {
          assert.equal(action.enabled, true, "DROP must never be greyed");
          dropChecked++;
        }
      }
    }
  }
  assert.ok(useChecked > 0, "expected at least one USE action across BASE/PENDING/LIVE");
  assert.ok(dropChecked > 0, "expected at least one DROP action across BASE/PENDING/LIVE");
});
