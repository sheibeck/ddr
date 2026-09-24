// test/unit/gear-agreement.test.js
//
// Phase 62 (GSCR-11), Plan 03 — the ONE agreement suite that proves the Gear
// tab can never disagree with the ITEMS combat submenu, the loot drop shelf
// or the store: all of them read the SAME itemRowState/bagUsage/lootCompare
// view models (src/browser/gearTab.js), so a state shown on the Gear tab can
// never disagree with another screen (62-CONTEXT.md, "Shared lists
// (GSCR-11)"). This is an invariant, not a feature — it gets its own suite
// rather than riding on Plan 02's DOM tests (test/unit/gear-tab-dom.test.js).
//
// Every check below renders through the REAL classic paint()/renderEncounter()
// (test/unit/harness/shellSandbox.js) into a recording document
// (test/unit/harness/recordingDom.js) — the same harness Plan 02's own
// shell-tab-snapshots.test.js uses — so this proves the SHIPPED wiring, not
// just the pure view models Plan 01's gear-view-models.test.js already
// covers.
//
// Known, deliberate difference (not an agreement failure): mid-fight, the
// combat ITEMS submenu keeps its SCROLL row tappable even when the hero
// cannot read (the Phase 34 row ruling), while the Gear tab greys READ and
// states that same engine reason (the locked CONTEXT consumables decision).
// This suite compares scroll COUNTS only, never the READ/tappable state.
// Combat-time greying of the WORN/BAG action sheet itself is covered by
// gear-sheet-model.test.js and gear-sheet-agreement.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates, SNAPSHOT_IDS } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { itemRowState, bagUsage, GEAR_COPY } from "../../src/browser/gearTab.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { dropShelfItems } from "../../src/browser/viewModels.js";
import { itemTimerId, chargesTimerId, slotFor } from "../../engine/derived.js";
import { toolItem, toolIndex } from "../../engine/items.js";
import { STAVES } from "../../content/treasure-tables.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this suite's own fixtures are canon-mechanic numbers, so it runs under an
// explicit identity override for its whole lifetime, mirroring every other
// shell-*.test.js suite that reads fixedStates().
setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── paint helper (mirrors shell-tab-snapshots.test.js's own paintFresh) ───

function paintFresh(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return { doc, sandbox };
}

// findAll(root, cls) — every descendant (any depth) whose className token
// list includes `cls`, walking ONLY real `.children` (never a parsed
// innerHTML fragment) — mirrors recordingDom.js's own class-selector
// matching (elementMatches: split on whitespace, exact token membership).
function findAll(root, cls) {
  const out = [];
  const visit = (node) => {
    for (const child of node.children || []) {
      if (child.nodeType === 3) continue; // text nodes never match a class selector
      if ((child.className || "").split(/\s+/).filter(Boolean).includes(cls)) out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

// ─── the sweep's six-plus fixed states ──────────────────────────────────────
//
// Built via structuredClone(fixedStates()...) plus direct field edits, per
// the plan's own instruction — these are test-only states that never reach
// a fixture. The four thief-based clones (timerClone/fullHpClone/
// lowHpNoPotionsClone/healEnabledClone) deliberately keep the thief
// fixture's two worn, activatable jewelry pieces so the combat ITEMS
// submenu's own "usableCount" never collapses to its noItems placeholder —
// every clone below always has at least one real usable row to compare
// against.

const rawStates = fixedStates();

// thief clone: jewelry1's item timer in effect (left 7), jewelry2's cooling
// (left 3) — Edge GSCR-11/adjacency's own timer-decrement pair.
const timerClone = (() => {
  const s = structuredClone(rawStates.thief);
  const j1 = s.c.worn.jewelry1;
  const j2 = s.c.worn.jewelry2;
  s.c.timers = {
    ...(s.c.timers || {}),
    [itemTimerId(j1)]: { cadence: "squares", left: 7, phase: "effect" },
    [itemTimerId(j2)]: { cadence: "squares", left: 3, phase: "cooldown" },
  };
  return s;
})();

// mu clone: a real staff (Rowan Staff, from content/treasure-tables.js#STAVES
// — a real content name, so activationFor resolves) below its max charges
// (act.charges === 2; this fixture holds 1) plus its own "charges:<name>"
// recharge record, and a torch (the one activatable tool).
const STAFF_ITEM = { ...STAVES[0], kind: "staff", charges: 1 };
const TORCH_ITEM = toolItem("torch");
const muStaffTorchClone = (() => {
  const s = structuredClone(rawStates.mu);
  s.c.items = [...(s.c.items || []), STAFF_ITEM, TORCH_ITEM];
  s.c.timers = {
    ...(s.c.timers || {}),
    [chargesTimerId(STAFF_ITEM)]: { cadence: "squares", left: 40, phase: "cooldown" },
  };
  return s;
})();

// thief clone: full HP, potions 2 — the heal button must read disabled (full
// WP), agreeing with the combat ITEMS potion row.
const fullHpClone = (() => {
  const s = structuredClone(rawStates.thief);
  s.c.potions = 2;
  s.c.wp = s.c.maxWP;
  return s;
})();

// thief clone: wp < maxWP, potions 0 — the heal button must read disabled
// (no potions), agreeing with the combat ITEMS potion row.
const lowHpNoPotionsClone = (() => {
  const s = structuredClone(rawStates.thief);
  s.c.potions = 0;
  s.c.wp = Math.max(1, s.c.maxWP - 1);
  return s;
})();

// thief clone: potions 2, wp < maxWP — the ONE state in the sweep where the
// heal button must read ENABLED, agreeing with the combat ITEMS potion row.
const healEnabledClone = (() => {
  const s = structuredClone(rawStates.thief);
  s.c.potions = 2;
  s.c.wp = Math.max(1, s.c.maxWP - 1);
  return s;
})();

// The sweep: at least 6 states (behavior spec's own minimum) — 7 here.
const SWEEP_STATES = [rawStates.thief, rawStates.mu, timerClone, muStaffTorchClone, fullHpClone, lowHpNoPotionsClone, healEnabledClone];

// ─── USE-cell resolution: every rendered .mw-gear-use, paired with the item
// it belongs to and the combat ITEMS submenu row id it should agree with ───

function useCellPairs(doc, state) {
  const c = state.c;
  const pairs = [];

  const wornEl = doc.document.getElementById("gear-worn");
  for (const li of wornEl.children) {
    if (li.nodeType === 3) continue;
    const slot = li.dataset.slot;
    const it = c.worn && c.worn[slot];
    if (!it) continue; // empty slot, or weapon/armor (never in c.worn)
    const cell = li.children.find((n) => n.className === "mw-gear-use");
    if (!cell) continue; // the worn item shows no USE cell (itemRowState kind:"none")
    pairs.push({ it, cell, id: `worn-${slot}` });
  }

  const bagEl = doc.document.getElementById("gear-bag");
  for (const li of bagEl.children) {
    if (li.nodeType === 3) continue;
    if (li.dataset.i === undefined) continue; // the empty-bag li carries no dataset.i
    const i = Number(li.dataset.i);
    const it = c.items[i];
    const cell = li.children.find((n) => n.className === "mw-gear-use");
    if (!cell) continue; // a family (equippable) bag item never gets a USE cell
    pairs.push({ it, cell, id: `item-${i}` });
  }

  return pairs;
}

// ═══════════════════════ USE-cell / adjacency agreement ═══════════════════

test("Edge GSCR-11/adjacency: every rendered .mw-gear-use cell's data-phase and the combat ITEMS row's cost agree with itemRowState, across the sweep", () => {
  let pairCount = 0;
  for (const state of SWEEP_STATES) {
    const { doc } = paintFresh(state);
    const pairs = useCellPairs(doc, state);
    const menu = combatMenuViewModel(state);
    for (const { it, cell, id } of pairs) {
      const st = itemRowState(state, it);
      assert.equal(cell.dataset.phase, st.kind, `data-phase mismatch for ${id}`);
      const row = menu.submenus.items.rows.find((r) => r.id === id);
      assert.ok(row, `expected a combat ITEMS row with id ${id}`);
      assert.equal(row.cost, st.text, `combat cost mismatch for ${id}`);
      pairCount++;
    }
  }
  assert.ok(pairCount >= 10, `expected at least 10 (item, state) pairs, got ${pairCount}`);
});

test("Edge GSCR-11/adjacency: advancing jewelry1's timer left by -1 moves the Gear USE sub and the combat cost together", () => {
  const makeState = (left) => {
    const s = structuredClone(rawStates.thief);
    const j1 = s.c.worn.jewelry1;
    s.c.timers = { ...(s.c.timers || {}), [itemTimerId(j1)]: { cadence: "squares", left, phase: "effect" } };
    return s;
  };
  const before = makeState(10);
  const after = makeState(9);

  const findUseCell = (doc) => {
    const wornEl = doc.document.getElementById("gear-worn");
    const li = wornEl.children.find((row) => row.dataset.slot === "jewelry1");
    return li.children.find((n) => n.className === "mw-gear-use");
  };
  const subOf = (cell) => cell.children.find((n) => n.className === "mw-gear-use-sub").textContent;

  const { doc: docBefore } = paintFresh(before);
  const { doc: docAfter } = paintFresh(after);
  const subBefore = subOf(findUseCell(docBefore));
  const subAfter = subOf(findUseCell(docAfter));
  assert.notEqual(subBefore, subAfter);
  assert.equal(subAfter, "9 SQ");

  const costBefore = combatMenuViewModel(before).submenus.items.rows.find((r) => r.id === "worn-jewelry1").cost;
  const costAfter = combatMenuViewModel(after).submenus.items.rows.find((r) => r.id === "worn-jewelry1").cost;
  assert.notEqual(costBefore, costAfter);
  assert.equal(costAfter, "9 SQ");
});

// ═══════════════════════ heal agreement ════════════════════════════════════

function healRow(doc) {
  const consEl = doc.document.getElementById("gear-cons");
  const li = consEl.children.find((row) => row.dataset.key === "heal");
  const btn = li.children.find((n) => n.tagName === "button");
  const qty = findAll(li, "mw-gear-qty")[0];
  return { btn, qty };
}

test("heal agreement: the Gear HEALING POTION button's disabled flag and qty text agree with the combat ITEMS potion row, across the sweep", () => {
  let sawEnabled = false;
  let sawDisabledByZeroPotions = false;
  for (const state of SWEEP_STATES) {
    const { doc } = paintFresh(state);
    const { btn, qty } = healRow(doc);
    const menu = combatMenuViewModel(state);
    const potionRow = menu.submenus.items.rows.find((r) => r.id === "potion");
    assert.ok(potionRow, "expected a potion row in the combat ITEMS submenu");
    assert.equal(btn.disabled, !potionRow.enabled, "the Gear heal button's disabled flag must be the exact inverse of the combat potion row's enabled flag");
    assert.equal(qty.textContent, "×" + (state.c.potions || 0));
    if ((state.c.potions || 0) === 0) {
      assert.equal(btn.disabled, true);
      sawDisabledByZeroPotions = true;
    }
    if (potionRow.enabled) sawEnabled = true;
  }
  // The sweep must exercise both a genuinely enabled heal row (healEnabledClone)
  // and a genuinely potions:0-disabled one (lowHpNoPotionsClone) — never a
  // vacuous pass where every state happens to land on the same branch.
  assert.ok(sawEnabled, "expected at least one sweep state with an enabled heal button");
  assert.ok(sawDisabledByZeroPotions, "expected at least one sweep state with potions:0");
});

// ═══════════════════════ bagUsage agreement ════════════════════════════════

test("bagUsage agreement: the Gear BAG head count equals bagUsage(c).text, across the sweep; thiefStore reads mw-gear-full and its store shows 'Bag full ('", () => {
  for (const state of SWEEP_STATES) {
    const { doc } = paintFresh(state);
    const usage = bagUsage(state.c);
    const headCount = doc.document.getElementById("gear-bag-head").children.find((n) => n.tagName === "b");
    if (usage.text) {
      assert.ok(headCount, "expected a bag head count element");
      assert.equal(headCount.textContent, usage.text);
      assert.equal(/\bmw-gear-full\b/.test(headCount.className), usage.full);
    } else {
      assert.ok(!headCount, "expected no bag head count element when bagUsage(c).text is empty");
    }
  }

  const { doc, sandbox } = paintFresh(rawStates.thiefStore);
  const usage = bagUsage(rawStates.thiefStore.c);
  assert.equal(usage.full, true, "expected the thiefStore fixture's bag to be full");
  const headCount = doc.document.getElementById("gear-bag-head").children.find((n) => n.tagName === "b");
  assert.match(headCount.className, /\bmw-gear-full\b/);

  sandbox.renderEncounter();
  const storeText = doc.serializeElements(SNAPSHOT_IDS.store);
  assert.ok(storeText.includes("Bag full ("), "expected the bag-full store line");
});

// ═══════════════════════ Edge GSCR-11/empty ════════════════════════════════

test("Edge GSCR-11/empty: the mu fixture's #gear-bag shows GEAR_COPY.bagEmptyHead, and muStore's #sell-head is hidden", () => {
  const { doc } = paintFresh(rawStates.mu);
  const bagEl = doc.document.getElementById("gear-bag");
  assert.equal(bagEl.children.length, 1, "expected exactly one empty-state li");
  const empty = bagEl.children[0];
  assert.match(empty.className, /\bmw-empty\b/);
  const head = empty.children.find((n) => n.className === "mw-empty-head");
  assert.equal(head.textContent, GEAR_COPY.bagEmptyHead);

  const { doc: storeDoc, sandbox } = paintFresh(rawStates.muStore);
  sandbox.renderEncounter();
  const sellHead = storeDoc.document.getElementById("sell-head");
  assert.equal(sellHead.style.display, "none", "expected the empty-sell-list store to hide #sell-head");
});

// ═══════════════════════ Edge GSCR-11/ordering ═════════════════════════════

test("Edge GSCR-11/ordering: the Gear bag cards' data-i sequence equals dropShelfItems(c).map(e => e.i), and ascends", () => {
  for (const state of [rawStates.thief, muStaffTorchClone]) {
    const { doc } = paintFresh(state);
    const bagEl = doc.document.getElementById("gear-bag");
    const dataIs = bagEl.children.filter((li) => li.nodeType !== 3 && li.dataset.i !== undefined).map((li) => Number(li.dataset.i));
    const expected = dropShelfItems(state.c).map((e) => e.i);
    assert.deepStrictEqual(dataIs, expected);
    assert.deepStrictEqual([...dataIs].sort((a, b) => a - b), dataIs, "expected the data-i sequence to ascend");
  }
});

// ═══════════════════════ Edge GSCR-11/idempotency ══════════════════════════

test("Edge GSCR-11/idempotency: painting the same state twice serializes SNAPSHOT_IDS.gear byte-identically, with the same li.mw-gear-card count", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(rawStates.thief);

  sandbox.paint();
  const first = doc.serializeElements(SNAPSHOT_IDS.gear);
  const firstCount = findAll(doc.document.getElementById("gear-bag"), "mw-gear-card").length;

  sandbox.paint();
  const second = doc.serializeElements(SNAPSHOT_IDS.gear);
  const secondCount = findAll(doc.document.getElementById("gear-bag"), "mw-gear-card").length;

  assert.equal(second, first, "a second paint() on the same state must serialize byte-identically");
  assert.equal(secondCount, firstCount);
  assert.ok(firstCount >= 1, "expected at least one bag card to compare against");
});

// ═══════════════════════ Edge GSCR-11/concurrency ══════════════════════════

test("Edge GSCR-11/concurrency: opening the bagged jewel's sheet then the rope's leaves exactly one sheet shown, with the rope's title; a fresh paint() keeps it rendered; no in-row confirm exists under #gear-bag or #gear-worn", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(rawStates.thief);
  sandbox.paint();

  const bagEl = doc.document.getElementById("gear-bag");
  const jewelEntry = dropShelfItems(rawStates.thief.c).find(({ it }) => slotFor(it) === "jewelry");
  assert.ok(jewelEntry, "expected a bagged jewel in the thief fixture");
  const ropeI = toolIndex(rawStates.thief.c, "rope");
  assert.ok(ropeI !== -1, "expected a rope in the thief fixture's bag");

  const jewelLi = bagEl.children.find((li) => li.dataset.i === String(jewelEntry.i));
  assert.ok(jewelLi, "expected the bagged jewel's card");
  jewelLi.onclick();

  const sheet = doc.document.getElementById("mw-gear-sheet");
  assert.equal(sheet.hidden, false, "expected the sheet to open on the jewel card's tap");

  const ropeLi = bagEl.children.find((li) => li.dataset.i === String(ropeI));
  assert.ok(ropeLi, "expected the rope's card");
  ropeLi.onclick();

  assert.equal(sheet.hidden, false, "expected exactly one sheet shown after tapping a second card");
  const titleEl = doc.document.getElementById("mw-gear-sheet-title");
  assert.equal(titleEl.textContent, rawStates.thief.c.items[ropeI].n);

  sandbox.paint();
  const titleAfterPaint = doc.document.getElementById("mw-gear-sheet-title");
  assert.equal(titleAfterPaint.textContent, rawStates.thief.c.items[ropeI].n, "a fresh paint() must keep the sheet rendered with the same title");

  const bagEl2 = doc.document.getElementById("gear-bag");
  const wornEl2 = doc.document.getElementById("gear-worn");
  for (const root of [bagEl2, wornEl2]) {
    assert.equal(findAll(root, "mw-drop-confirm").length, 0, "expected no in-row Drop confirm");
    assert.equal(findAll(root, "mw-swap-confirm").length, 0, "expected no in-row swap confirm");
  }
});

// ═══════════════════════ no-fork source guard ══════════════════════════════
//
// Reads gearTab.js, combatMenu.js, storeScreen.js and mazeworld.html
// CRLF-normalized, strips comments with the same order-sensitive approach
// every shell-*.test.js suite uses (line comments first, then block
// comments), then slices the two Gear-tab regions the behavior spec names
// by their literal markers.

function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

function readNormalized(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = endMarker === null ? source.length : source.indexOf(endMarker, start);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

const GEAR_TAB_RAW = readNormalized("src/browser/gearTab.js");
const GEAR_TAB_STRIPPED = stripComments(GEAR_TAB_RAW);
const COMBAT_MENU_STRIPPED = stripComments(readNormalized("src/browser/combatMenu.js"));
const STORE_SCREEN_STRIPPED = stripComments(readNormalized("src/browser/storeScreen.js"));
const HTML_RAW = readNormalized("mazeworld.html");

const MODEL_REGION = sliceBetween(GEAR_TAB_STRIPPED, "export const GEAR_WORN_ORDER", "const DROP_CONFIRM_MS");
const RENDER_REGION = sliceBetween(GEAR_TAB_STRIPPED, "export function renderGearTab(", null);

const FORBIDDEN_TOKENS = [
  "bagCap(",
  "canStow(",
  "slotItems(",
  "isReady(",
  "remaining(",
  "activationFor(",
  "itemTimerId(",
  "chargesTimerId(",
  "armorSoak(",
  "weaponUpgradeDelta",
  "expectedStrike",
  "usedAt",
];

test("no-fork source guard: the Plan 01 model region (GEAR_WORN_ORDER..DROP_CONFIRM_MS) never calls a lower-level shared rule directly", () => {
  for (const token of FORBIDDEN_TOKENS) {
    assert.ok(!MODEL_REGION.includes(token), `model region unexpectedly calls ${token}`);
  }
});

test("no-fork source guard: the renderGearTab region never calls a lower-level shared rule directly", () => {
  for (const token of FORBIDDEN_TOKENS) {
    assert.ok(!RENDER_REGION.includes(token), `renderGearTab region unexpectedly calls ${token}`);
  }
});

test("no-fork source guard: combatMenu.js imports itemRowState from ./gearTab.js", () => {
  assert.ok(COMBAT_MENU_STRIPPED.includes('import { itemRowState } from "./gearTab.js";'));
});

test("no-fork source guard: storeScreen.js imports bagUsage from ./gearTab.js and storeRowState from ./viewModels.js", () => {
  assert.ok(STORE_SCREEN_STRIPPED.includes('import { bagUsage, renderCarriedList } from "./gearTab.js";'));
  // Phase 71 (D-04): itemStatLines joins the import — item rows read the ONE stat formatter.
  assert.ok(STORE_SCREEN_STRIPPED.includes('import { armorDisplay, usableBy, storeRowState, itemStatLines } from "./viewModels.js";'));
});

test("no-fork source guard: mazeworld.html bridges window.__mzBagUsage and window.__mzLootCompare to gearTab.js's own functions", () => {
  assert.ok(HTML_RAW.includes("window.__mzBagUsage = bagUsage;"));
  assert.ok(HTML_RAW.includes("window.__mzLootCompare = lootCompare;"));
});

test("no-fork source guard: renderCarriedList still reads itemRowState(state, it) and lootCompare(state.c, it).equipNow", () => {
  assert.ok(GEAR_TAB_STRIPPED.includes("itemRowState(state, it)"));
  assert.ok(GEAR_TAB_STRIPPED.includes("lootCompare(state.c, it).equipNow"));
});
