// test/unit/shell-loot-screen.test.js
//
// Phase 29 (LOOT-02/03/04/05/06), Plan 03 — mazeworld.html has no module
// surface a test could import directly (it is not an ESM module the test
// runner can load), so — mirroring test/unit/shell-armor-display.test.js's
// own source-assertion pattern — this file reads the real shipped source
// with fs.readFileSync and asserts against it directly:
//   1. the module bridges lootCompare/bagUsage onto window.__mzLootCompare/
//      window.__mzBagUsage, and the four pending-pile action bridges
//      (mzTakeLoot/mzLeaveLoot/mzTakeAllLoot/mzLeaveAllLoot) route through
//      inventoryAction();
//   2. hasActiveEncounter() parks the map while a pending pile is non-empty;
//   3. noteCombat() hands the end-of-fight report to window.__mzLootReport
//      instead of building "Move on" beats when drops are pending;
//   4. renderCarriedList knows opts.subFor and the three loot row actions
//      (lootEquip/lootTake/lootLeave);
//   5. renderDropShelf is a shared function (find card + loot screen), and
//      the pendingFind branch calls it;
//   6. (Task 2) the loot screen branch itself — one card, before the joiner
//      branch, with Take all/Leave all and the shared list/shelf renderers;
//   7. (Task 3) every capacity readout routes through window.__mzBagUsage —
//      no raw array-length count survives.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-armor-display.test.js/shell-party-camp.test.js — line comments are
// stripped BEFORE block comments) ─────────────────────────────────────────
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

const CODE = stripComments(HTML);

// ─── 1. module bridges ──────────────────────────────────────────────────

test("Phase 29 (LOOT-03/04): the module bridges lootCompare/bagUsage from viewModels.js", () => {
  // Phase 39 (GEAR-02/GEAR-05), Plan 05: the shared viewModels.js import
  // line gained itemRowState as a sibling named import.
  assert.match(
    CODE,
    /import \{ characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage, itemRowState \} from "\.\/src\/browser\/viewModels\.js";/,
  );
  assert.match(CODE, /window\.__mzBagUsage = bagUsage;/);
  assert.match(CODE, /window\.__mzLootCompare = lootCompare;/);
});

test("Phase 29 (LOOT-02/03/06): the pending-pile action bridges route through inventoryAction", () => {
  const takeMatch = /window\.mzTakeLoot = \([^)]*\) => ([\s\S]*?);/.exec(CODE);
  assert.ok(takeMatch, "window.mzTakeLoot bridge found");
  assert.match(takeMatch[1], /inventoryAction\(/);

  const leaveMatch = /window\.mzLeaveLoot = \([^)]*\) => ([\s\S]*?);/.exec(CODE);
  assert.ok(leaveMatch, "window.mzLeaveLoot bridge found");
  assert.match(leaveMatch[1], /inventoryAction\(/);

  const takeAllMatch = /window\.mzTakeAllLoot = \(\) => ([\s\S]*?);/.exec(CODE);
  assert.ok(takeAllMatch, "window.mzTakeAllLoot bridge found");
  assert.match(takeAllMatch[1], /inventoryAction\(/);

  const leaveAllMatch = /window\.mzLeaveAllLoot = \(\) => ([\s\S]*?);/.exec(CODE);
  assert.ok(leaveAllMatch, "window.mzLeaveAllLoot bridge found");
  assert.match(leaveAllMatch[1], /inventoryAction\(/);
});

// ─── 2. hasActiveEncounter parks the map ─────────────────────────────────

function hasActiveEncounterRegion() {
  const start = CODE.indexOf("function hasActiveEncounter()");
  const end = CODE.indexOf("function vitalsStrip()");
  assert.ok(start !== -1 && end !== -1 && end > start, "hasActiveEncounter region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-02/06): hasActiveEncounter() includes a non-empty pending pile", () => {
  const region = hasActiveEncounterRegion();
  assert.match(region, /S\.pendingLoot && S\.pendingLoot\.length/);
});

// ─── 3. noteCombat hands the report to the loot card ─────────────────────

function noteCombatRegion() {
  const start = CODE.indexOf("function noteCombat(");
  const end = CODE.indexOf("function hapticForEvents(");
  assert.ok(start !== -1 && end !== -1 && end > start, "noteCombat region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-02, RESEARCH Pitfall 4): noteCombat hands the report to window.__mzLootReport when drops are pending", () => {
  const region = noteCombatRegion();
  assert.match(region, /after\.pendingLoot/);
  assert.match(region, /window\.__mzLootReport = rep/);
  assert.match(region, /window\.__mzLootReport = null/);
});

// ─── 4. renderCarriedList knows subFor + the three loot actions ──────────

function renderCarriedListRegion() {
  const start = CODE.indexOf("function renderCarriedList(");
  const end = CODE.indexOf("function renderDropShelf(");
  assert.ok(start !== -1 && end !== -1 && end > start, "renderCarriedList region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-03): renderCarriedList supports opts.subFor and the loot row actions", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /opts\.subFor/);
  assert.match(region, /"lootEquip"/);
  assert.match(region, /"lootTake"/);
  assert.match(region, /"lootLeave"/);
  assert.match(region, /Equip now/);
});

// ─── 5. renderDropShelf is shared; pendingFind calls it ──────────────────

function renderDropShelfRegion() {
  const start = CODE.indexOf("function renderDropShelf(");
  assert.ok(start !== -1, "renderDropShelf found");
  const end = CODE.indexOf("\nfunction ", start + 1);
  assert.ok(end !== -1 && end > start, "renderDropShelf region end found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-04): renderDropShelf is the one drop-shelf renderer (find card + loot screen)", () => {
  assert.equal((CODE.match(/function renderDropShelf\(/g) || []).length, 1);
  const region = renderDropShelfRegion();
  assert.match(region, /bagArmorText\(bi\)/);
  assert.match(region, /window\.mzDropItem/);
});

function pendingFindRegion() {
  const start = CODE.indexOf("if (S.pendingFind && !S.combat && !S.store)");
  // Phase 35 (MAP-04): the find prompt is a rail decision card now — its
  // region ends at the next rail branch (the CLIMB IT card), not at the
  // (now-unrelated) store guard.
  const end = CODE.indexOf('if (rail.pending && rail.pending.kind === "climb") {');
  assert.ok(start !== -1 && end !== -1 && end > start, "pendingFind region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-04)/Phase 35: the find card (rail decision, a full bag) calls the shared renderDropShelf", () => {
  // Phase 35 (MAP-04): the shelf render call itself now lives in renderRail's
  // shared post-branch paint step (shelfItems set inside the find branch,
  // rendered once after every branch's lines are painted) rather than
  // inline inside the pendingFind branch's own {...} scope.
  const start = CODE.indexOf("function renderRail()");
  const end = CODE.indexOf("function syncRailLive(text)");
  assert.ok(start !== -1 && end !== -1 && end > start, "renderRail region bounds found");
  const region = CODE.slice(start, end);
  // Phase 43 (CLAR-04): the find card's drop shelf now reads the ONE
  // bag-only source list (window.__mzDropShelfItems) instead of raw
  // c.items — never a worn/wielded piece, never a potion.
  assert.match(region, /shelfItems = window\.__mzDropShelfItems\(c\);/);
  assert.match(region, /renderDropShelf\(document\.getElementById\("find-drop-shelf"\), shelfItems\)/);
});

// ─── 6. the loot screen card ──────────────────────────────────────────────

const LOOT_GUARD = 'if (S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {';
const JOINER_GUARD = 'if (S.pendingJoiner && !S.combat && !S.store)';
const WON_GUARD = 'if (S.won) {';
const STORE_GUARD = 'if (S.store) {';

function lootRegion() {
  const start = CODE.indexOf(LOOT_GUARD);
  // Phase 35 (MAP-04): the joiner/find branches moved out of renderEncounter
  // entirely — the loot branch's next renderEncounter sibling is the store
  // guard now.
  const end = CODE.indexOf(STORE_GUARD);
  assert.ok(start !== -1 && end !== -1 && end > start, "loot branch bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-02/03/04/06)/2026-09-17 UAT: no inline bag-full line, the shelf remains — the loot screen card renders the folded report, the shared list, the shelf, and take-all/leave-all", () => {
  const region = lootRegion();
  assert.match(region, /window\.__mzBagUsage\(c\)/);
  assert.match(region, /window\.__mzLootReport/);
  assert.match(region, /id="loot-list"/);
  assert.match(region, /renderCarriedList\(/);
  assert.match(region, /actions: \["lootEquip", "lootTake", "lootLeave"\]/);
  assert.match(region, /subFor/);
  assert.match(region, /window\.__mzLootCompare\(c, it\)/);
  assert.match(region, /id="loot-drop-shelf"/);
  assert.match(region, /renderDropShelf\(/);
  // Phase 34 (CSCR-07), Plan 05: the take-all/leave-all buttons are now
  // built through renderCombatOver's generic buttons array (`id:
  // "a-loot-take-all"`, a JS object property) rather than an HTML
  // `id="a-loot-take-all"` attribute string — the id itself is unchanged,
  // just how it reaches the DOM.
  assert.match(region, /"a-loot-take-all"/);
  assert.match(region, /"a-loot-leave-all"/);
  assert.match(region, /window\.mzTakeAllLoot/);
  assert.match(region, /window\.mzLeaveAllLoot/);
  // 2026-09-17 UAT (user ruling): the inline red bag-full paragraph is gone
  // — the rail's bagFull refusal card carries the message. The shelf and
  // header stay.
  assert.doesNotMatch(region, /Bag full \(/);
  assert.match(region, /usage\.full && needsSlot/);
  assert.match(region, /COMBAT_COPY\.lootHead/);
  assert.doesNotMatch(region, /color:var\(--rust\)/);
  assert.match(region, /renderCombatOver\(body, kind/);
  assert.match(region, /panel\.dataset\.mode = "dark"/);
});

test("Phase 29 (LOOT-02)/Phase 35: the loot branch sits after won/beats and before the store branch (the joiner/find branches moved into renderRail)", () => {
  const lootIdx = CODE.indexOf(LOOT_GUARD);
  const storeIdx = CODE.indexOf(STORE_GUARD);
  const wonIdx = CODE.indexOf(WON_GUARD);
  assert.ok(lootIdx !== -1 && storeIdx !== -1 && wonIdx !== -1);
  assert.ok(lootIdx > wonIdx, "loot branch comes after the won branch");
  assert.ok(lootIdx < storeIdx, "loot branch comes before the store branch");
});

function pendingJoinerRegion() {
  const start = CODE.indexOf(JOINER_GUARD);
  const end = CODE.indexOf("if (S.pendingFind && !S.combat && !S.store)");
  assert.ok(start !== -1 && end !== -1 && end > start, "pendingJoiner branch bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-02): the joiner region is untouched (no pendingLoot leaked into it)", () => {
  const region = pendingJoinerRegion();
  assert.ok(!region.includes("pendingLoot"), "the joiner branch does not reference pendingLoot");
});

// ─── 7. LOOT-04: every readout routes through bagUsage — no raw count survives ──

function paintCarryRegion() {
  const start = CODE.indexOf('const carry = document.getElementById("s-carry");');
  const end = CODE.indexOf("renderCarriedList(carry,");
  assert.ok(start !== -1 && end !== -1 && end > start, "paint() carried-treasure region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-04): paint()'s carried-treasure readout and full-bag gate read window.__mzBagUsage", () => {
  const region = paintCarryRegion();
  assert.match(region, /window\.__mzBagUsage\(c\)/);
  assert.match(region, /usage\.text/);
  assert.match(region, /usage\.full/);
});

test("Phase 29 (LOOT-04)/Phase 35: the find card's capacity readout and full-bag gate read window.__mzBagUsage (the full-bag copy now lives in RAIL_COPY.find.full)", () => {
  const region = pendingFindRegion();
  assert.match(region, /window\.__mzBagUsage\(c\)/);
  assert.match(region, /usage\.have/);
  assert.match(region, /usage\.slots/);
  assert.match(region, /copy\.find\.full\.replace\("\{have\}", usage\.have\)\.replace\("\{slots\}", usage\.slots\)/);
});

function storeRegion() {
  const start = CODE.indexOf("if (S.store) {");
  const end = CODE.indexOf("const C = S.combat;", start);
  assert.ok(start !== -1 && end !== -1 && end > start, "store region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-04): the store reads window.__mzBagUsage and offers Drop when full", () => {
  const region = storeRegion();
  assert.match(region, /window\.__mzBagUsage\(S\.c\)/);
  assert.match(region, /\["sell", "drop"\]/);
});

test("Phase 29 (LOOT-04): no raw capacity count survives in mazeworld.html (the four negative greps)", () => {
  // Each literal below is copied verbatim from the PRE-Task-3 source at the
  // line ranges cited in 29-03-PLAN.md Task 3's read_first — written only
  // here, in the test file, never reintroduced into mazeworld.html.
  assert.equal(CODE.includes("items.length >= bagSlots"), false, "paint()'s old raw-length bagFull comparison must be gone");
  assert.equal(CODE.includes("(c.items || []).length >= slots"), false, "the find card's old raw-length full comparison must be gone");
  assert.equal(CODE.includes("${items.length} / ${bagSlots}"), false, "paint()'s old raw-length readout template must be gone");
  assert.equal(CODE.includes("(c.items || []).length}/${slots}"), false, "the find card's old raw-length rust-line template must be gone");
});

// ─── 8. quick 260918-vvt: potions & scrolls never count against bag space ──

test("quick 260918-vvt (a): a SEPARATE import { takesBagSlot } line exists; the pinned derived.js import is untouched", () => {
  assert.equal(
    (CODE.match(/^\s*import \{ takesBagSlot \} from "\.\/engine\/derived\.js";\s*$/gm) || []).length,
    1,
  );
  assert.match(
    CODE,
    /import \{ conditionsOf, canCast, eff, slotFor, WORN_SLOTS, WORN_KEYS_OF, hasTool, toHit, strikeDie, mapViewRadius, inViewWindow \} from "\.\/engine\/derived\.js";/,
  );
});

test("quick 260918-vvt (b): window.__mzTakesBagSlot = takesBagSlot; appears exactly once, on the line after window.__mzBagUsage = bagUsage;", () => {
  const matches = CODE.match(/^\s*window\.__mzTakesBagSlot = takesBagSlot;\s*$/gm) || [];
  assert.equal(matches.length, 1);
  const lines = CODE.split("\n").map((l) => l.trim());
  const bagUsageIdx = lines.indexOf("window.__mzBagUsage = bagUsage;");
  assert.ok(bagUsageIdx !== -1, "window.__mzBagUsage = bagUsage; line found");
  // The bridge line lands somewhere shortly after __mzBagUsage (comment lines
  // may separate them) — walk forward to the next non-comment statement.
  let i = bagUsageIdx + 1;
  while (i < lines.length && (lines[i] === "" || lines[i].startsWith("//"))) i++;
  assert.equal(lines[i], "window.__mzTakesBagSlot = takesBagSlot;");
});

test("quick 260918-vvt (c): the find card's full flag is gated per item; the copy.find.full expression and takeNow label survive", () => {
  const region = pendingFindRegion();
  assert.match(region, /const full = usage\.full && window\.__mzTakesBagSlot\(it\);/);
  assert.match(region, /copy\.find\.full\.replace\("\{have\}", usage\.have\)\.replace\("\{slots\}", usage\.slots\)/);
  assert.match(region, /label: full \? copy\.find\.takeNow : copy\.find\.take/);
});

test("quick 260918-vvt (d): the loot screen's needsSlot routes through window.__mzTakesBagSlot; usage.full && needsSlot survives", () => {
  const region = lootRegion();
  assert.match(region, /const needsSlot = S\.pendingLoot\.some\(\(it\) => window\.__mzTakesBagSlot\(it\)\);/);
  assert.match(region, /usage\.full && needsSlot/);
});

test("quick 260918-vvt (e): paint()'s carried-treasure header appends gearCopy.freeRide only for a capped bag", () => {
  const region = paintCarryRegion();
  assert.match(region, /gearCopy\.freeRide/);
  assert.match(region, /usage\.slots !== null/);
});

test("quick 260918-vvt (f): the store's bag-full line ends with the free-ride clause", () => {
  const region = storeRegion();
  assert.match(region, /Potions and scrolls still ride free\./);
});

test("quick 260918-vvt (g): NEGATIVE SWEEP — the four bag-CAPACITY inline kind inequalities are gone (the Set replaces the literal in derived.js too)", () => {
  // Scoped to the four specific bag-CAPACITY call sites this quick task
  // rewrote (slotItems/stowItem/dropShelfItems/needsSlot) — NOT a blanket
  // sweep for every `kind !== "potion"` in the codebase. A separate,
  // unrelated "is this item activatable" readiness check (itemReady/
  // itemRowState in engine/items.js, src/browser/viewModels.js and the
  // classic mazeworld.html mirror) legitimately keeps its own independent
  // `kind !== "potion"` rule — that is a different mechanism (out of this
  // task's scope) and matching it here would be a false positive.
  const itemsSrc = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "items.js"), "utf8").replace(/\r\n/g, "\n"));
  const vmSrc = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "viewModels.js"), "utf8").replace(/\r\n/g, "\n"));
  const derivedSrc = stripComments(fs.readFileSync(path.join(REPO_ROOT, "engine", "derived.js"), "utf8").replace(/\r\n/g, "\n"));

  // The old slotItems filter body (derived.js) — gone.
  assert.doesNotMatch(derivedSrc, /\(it\) => it && it\.kind !== "potion"/);
  // The old stowItem capacity gate (items.js) — gone.
  assert.doesNotMatch(itemsSrc, /it\.kind !== "potion" && !canStow\(c\)/);
  // The old dropShelfItems filter (viewModels.js) — gone.
  assert.doesNotMatch(vmSrc, /\(\{ it \}\) => it && it\.kind !== "potion"/);
  // The old loot-screen needsSlot check (mazeworld.html) — gone.
  assert.doesNotMatch(CODE, /it\.kind !== "potion" && it\.kind !== "bag"/);

  // BAG_FREE_KINDS is the one home of the bag-CAPACITY rule. (derived.js
  // also legitimately keeps two OTHER, unrelated `kind === "potion"` checks
  // out of this task's scope: clampCarry's own exempt-from-trim predicate,
  // which the plan explicitly leaves untouched, and activationKeyFor's
  // potion-vs-treasure activation-key lookup — neither is a bag-capacity
  // gate.)
  assert.match(derivedSrc, /BAG_FREE_KINDS = new Set\(\["potion", "scroll", "bag"\]\)/);
});

test("quick 260918-vvt (h): takesBagSlot ties the shell pins and the engine predicate together in one file", async () => {
  const { takesBagSlot } = await import("../../engine/derived.js");
  assert.equal([{ kind: "potion" }, { kind: "scroll" }, { kind: "bag" }].some(takesBagSlot), false);
  assert.equal(takesBagSlot({ kind: "gear" }), true);
});
