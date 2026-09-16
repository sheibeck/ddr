// test/unit/shell-armor-display.test.js
//
// Phase 28 (ARMOR-02/03/04), Plan 03 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-party-camp.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly:
//   1. the module script bridges armorDisplay/bagArmorText (viewModels.js)
//      onto window.__mzArmorDisplay, read-only;
//   2. paint() computes armorD ONCE and writes #s-arm from armorD.line — the
//      actual site of the reported "toast says wear, panel shows no damage"
//      bug — and no inline current/max template literal survives;
//   3. the gear worn row's wornRow() gained a noSlotNeeded parameter and is
//      called with armorD.label, so the cloak headline + underneath piece
//      and the destroyed-piece-needs-no-slot rule are both wired;
//   4. renderCarriedList's bag row reads bagArmorText for a kind:"armor" item
//      (covers GEAR tab, store sell list, and combat use list — one renderer,
//      three hosts);
//   5. the store repair row is relabelled in the shell (engine's own stock
//      `sub` string is left untouched — parity-safe);
//   6. the pending-find card reads bagArmorText for a found armor piece, and
//      its full-bag drop shelf lives in the shared renderDropShelf(shelf,
//      items) function (Phase 29 Plan 03), which itself reads bagArmorText;
//   7. the classic (dead) CLOAKS table's Cloak of Armor txt mirrors the live
//      content/treasure-tables.js string, and the PRE-Phase-28 flavor line
//      (still frozen in test/parity/prototype-master.js.txt) is gone from the
//      live HTML.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { CLOAKS } from "../../content/treasure-tables.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-toast-wiring.test.js/shell-party-camp.test.js — line comments are
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

// ─── 1. module bridge ──────────────────────────────────────────────────────

test("Phase 28 (ARMOR-02/03/04): the module bridges armorDisplay/bagArmorText from viewModels.js", () => {
  assert.match(
    CODE,
    /import \{ characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage \} from "\.\/src\/browser\/viewModels\.js";/,
  );
  assert.match(CODE, /window\.__mzArmorDisplay = \{ armorDisplay, bagArmorText \};/);
});

// ─── 2. paint(): #s-arm and no inline current/max template ─────────────────

test("Phase 28 (ARMOR-02): paint() computes armorD once and writes #s-arm from armorD.line", () => {
  assert.match(CODE, /const armorD = window\.__mzArmorDisplay\.armorDisplay\(c\);/);
  assert.match(CODE, /getElementById\("s-arm"\)\.textContent = armorD\.line;/);
  assert.equal((CODE.match(/\$\{c\.armorWP\}\/\$\{c\.armorMax\} hp/g) || []).length, 0);
});

// ─── 3. gear worn row: noSlotNeeded + armorD.label ──────────────────────────

test("Phase 28 (ARMOR-03/04): the gear worn row is wired through armorD, with a noSlotNeeded param", () => {
  assert.match(CODE, /wornRow\(armorD\.label, /);
  assert.match(CODE, /const wornRow = \(label, sub, slot, canUnequip, noSlotNeeded\) =>/);
});

// ─── 4. renderCarriedList armor row ─────────────────────────────────────────

function renderCarriedListRegion() {
  const start = CODE.indexOf("function renderCarriedList(");
  const end = CODE.indexOf("function openStore()");
  assert.ok(start !== -1 && end !== -1 && end > start, "renderCarriedList region bounds found");
  return CODE.slice(start, end);
}

test("Phase 28 (ARMOR-03): renderCarriedList reads bagArmorText for a kind:\"armor\" item", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /it\.kind === "armor" \? window\.__mzArmorDisplay\.bagArmorText\(it\)/);
});

// ─── 5. store repair row relabelled in the shell only ───────────────────────

function storeRegion() {
  const start = CODE.indexOf("if (S.store) {");
  const end = CODE.indexOf('document.getElementById("a-leave").onclick');
  assert.ok(start !== -1 && end !== -1 && end > start, "store region bounds found");
  return CODE.slice(start, end);
}

test("Phase 28 (ARMOR-02): the store repair row reads armorDisplay(S.c).wornSub + hp to mend, engine text untouched", () => {
  const region = storeRegion();
  assert.match(region, /item\.effectId === "repairArmor"/);
  assert.match(region, /ad\.wornSub/);
  assert.match(region, /hp to mend/);
});

// ─── 6. pending-find card + full-bag drop shelf ─────────────────────────────
// Phase 29 Plan 03: the drop shelf loop was extracted into the shared
// renderDropShelf(shelf, items) function — the shelf's bagArmorText(bi) read
// now lives THERE, not inline in the pendingFind branch. Intent unchanged:
// every bag armor row (including the drop shelf) still shows durability.

function pendingFindRegion() {
  const start = CODE.indexOf("if (S.pendingFind && !S.combat && !S.store)");
  const end = CODE.indexOf("if (S.store) {");
  assert.ok(start !== -1 && end !== -1 && end > start, "pendingFind region bounds found");
  return CODE.slice(start, end);
}

function renderDropShelfRegion() {
  const start = CODE.indexOf("function renderDropShelf(");
  assert.ok(start !== -1, "renderDropShelf found");
  const end = CODE.indexOf("\nfunction ", start + 1);
  assert.ok(end !== -1 && end > start, "renderDropShelf region end found");
  return CODE.slice(start, end);
}

test("Phase 28 (ARMOR-03): the pending-find card reads bagArmorText and calls the shared renderDropShelf", () => {
  const region = pendingFindRegion();
  assert.match(region, /bagArmorText\(it\)/);
  assert.match(region, /renderDropShelf\(/);
});

test("Phase 29 (LOOT-04): renderDropShelf (the shared drop shelf) reads bagArmorText", () => {
  const region = renderDropShelfRegion();
  assert.match(region, /bagArmorText\(bi\)/);
});

// ─── 7. classic CLOAKS mirror + old flavor line gone ────────────────────────

test("Phase 28 (ARMOR-04): the classic (dead) CLOAKS table's Cloak of Armor txt mirrors the live string", () => {
  const cloak = CLOAKS.find((k) => k.n === "Cloak of Armor");
  assert.ok(cloak, "sanity: CLOAKS exports a Cloak of Armor entry");
  assert.ok(HTML.includes(cloak.txt), "the live HTML's classic CLOAKS entry carries the same txt");

  // Derive the PRE-Phase-28 flavor line from the frozen parity master (never
  // pasted by hand — keeps this test honest if the master's wording is ever
  // consulted again) and assert it no longer appears in the live HTML.
  const MASTER = fs.readFileSync(path.join(REPO_ROOT, "test", "parity", "prototype-master.js.txt"), "utf8");
  const match = /\{n:"Cloak of Armor",\s*eff:\{cloakArmor:1\},\s*txt:"([^"]+)"\}/.exec(MASTER);
  assert.ok(match, "sanity: the frozen master still carries a Cloak of Armor entry");
  const OLD_TXT = match[1];
  assert.ok(OLD_TXT.length > 0);
  assert.notEqual(OLD_TXT, cloak.txt);
  assert.equal(HTML.includes(OLD_TXT), false, "the pre-Phase-28 flavor line must be gone from the live HTML");
});
