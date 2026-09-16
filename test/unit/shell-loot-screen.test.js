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
  assert.match(
    CODE,
    /import \{ characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage \} from "\.\/src\/browser\/viewModels\.js";/,
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
  const end = CODE.indexOf("if (S.store) {");
  assert.ok(start !== -1 && end !== -1 && end > start, "pendingFind region bounds found");
  return CODE.slice(start, end);
}

test("Phase 29 (LOOT-04): the pendingFind branch calls the shared renderDropShelf", () => {
  const region = pendingFindRegion();
  assert.match(region, /renderDropShelf\(/);
});
