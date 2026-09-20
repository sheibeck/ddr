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
//   7. (Phase 44-02, DEAD-01: the classic CLOAKS table this section's mirror
//      test read is deleted — content/treasure-tables.js is the single
//      source now; hp-not-wp.test.js and the treasure unit tests already
//      read it directly. Test case removed, not re-pointed.)

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
// shell-narration-wiring.test.js/shell-party-camp.test.js — line comments
// are stripped BEFORE block comments) ─────────────────────────────────────
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
// Phase 47 (SHELL-01), Plan 03, Task 2: renderGearTab/renderCarriedList
// (wornRow, the gear worn row wiring) moved into src/browser/gearTab.js.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-02), Plan 04, Task 2: the sheet's #s-arm write (armorD)
// moved into src/browser/heroTab.js.
const HERO_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-03), Plan 05, Task 2: the store's repair row moved into
// src/browser/storeScreen.js.
const STORE_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "storeScreen.js"), "utf8").replace(/\r\n/g, "\n"));

// ─── 1. module bridge ──────────────────────────────────────────────────────

test("Phase 28 (ARMOR-02/03/04): the module bridges armorDisplay/bagArmorText from viewModels.js", () => {
  // Phase 47 (SHELL-01), Plan 03, Task 1: bagUsage/itemRowState moved to
  // gearTab.js — the shared viewModels.js import line no longer carries them.
  // Phase 47 (SHELL-02), Plan 04, Task 1: characterSheetViewModel/
  // grimoireViewModel moved to heroTab.js — the shared viewModels.js import
  // line no longer carries them either.
  assert.match(
    CODE,
    /import \{ armorDisplay, bagArmorText, lootCompare \} from "\.\/src\/browser\/viewModels\.js";/,
  );
  assert.match(CODE, /window\.__mzArmorDisplay = \{ armorDisplay, bagArmorText \};/);
});

// ─── 2. paint(): #s-arm and no inline current/max template ─────────────────

// Phase 47 (SHELL-02), Plan 04, Task 2: the sheet's #s-arm write moved into
// heroTab.js#renderHeroTab, which imports armorDisplay directly from
// viewModels.js (no more window.__mzArmorDisplay bridge for this reader —
// the bridge itself stays, for the gear tab / drop shelf / find card).
test("Phase 28 (ARMOR-02): renderHeroTab computes armorD once (a direct armorDisplay(c) import) and writes #s-arm from armorD.line", () => {
  assert.match(HERO_SRC, /const armorD = armorDisplay\(c\);/);
  assert.match(HERO_SRC, /getElementById\("s-arm"\)\.textContent = armorD\.line;/);
  assert.equal((CODE.match(/getElementById\("s-arm"\)/g) || []).length, 0, "the classic script must no longer write #s-arm");
  assert.equal((CODE.match(/\$\{c\.armorWP\}\/\$\{c\.armorMax\} hp/g) || []).length, 0);
});

// ─── 3. gear worn row: noSlotNeeded + armorD.label ──────────────────────────

test("Phase 28 (ARMOR-03/04): the gear worn row is wired through armorD, with a noSlotNeeded param", () => {
  assert.match(GEAR_SRC, /wornRow\(armorD\.label, /);
  assert.match(GEAR_SRC, /const wornRow = \(label, sub, slot, canUnequip, noSlotNeeded\) =>/);
});

// ─── 4. renderCarriedList armor row ─────────────────────────────────────────
// Phase 47 (SHELL-01), Plan 03, Task 2: renderCarriedList lives entirely in
// src/browser/gearTab.js now — no region-slicing needed, GEAR_SRC IS the region.

test("Phase 28 (ARMOR-03): renderCarriedList reads bagArmorText for a kind:\"armor\" item", () => {
  assert.match(GEAR_SRC, /it\.kind === "armor" \? bagArmorText\(it\)/);
});

// ─── 5. store repair row relabelled in the shell only ───────────────────────

// Phase 47 (SHELL-03), Plan 05: the store's whole render body is
// storeScreen.js#renderStoreScreen — no region-slicing needed, STORE_SRC IS
// the region.
test("Phase 28 (ARMOR-02): the store repair row reads armorDisplay(c).wornSub + hp to mend, engine text untouched", () => {
  assert.match(STORE_SRC, /item\.effectId === "repairArmor"/);
  assert.match(STORE_SRC, /ad\.wornSub/);
  assert.match(STORE_SRC, /hp to mend/);
});

// ─── 6. pending-find card + full-bag drop shelf ─────────────────────────────
// Phase 29 Plan 03: the drop shelf loop was extracted into the shared
// renderDropShelf(shelf, items) function — the shelf's bagArmorText(bi) read
// now lives THERE, not inline in the pendingFind branch. Intent unchanged:
// every bag armor row (including the drop shelf) still shows durability.

function pendingFindRegion() {
  const start = CODE.indexOf("if (S.pendingFind && !S.combat && !S.store)");
  // Phase 35 (MAP-04): the find prompt is a rail decision card now, living
  // (physically, in file order) AFTER renderEncounter's own store branch —
  // the old "if (S.store) {" end marker matches an EARLIER occurrence and
  // breaks the region. The next rail branch (CLIMB IT) is the correct,
  // content-based boundary.
  const end = CODE.indexOf('if (rail.pending && rail.pending.kind === "climb") {');
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

test("Phase 28 (ARMOR-03)/Phase 35: the pending-find card reads bagArmorText, and renderRail calls the shared renderDropShelf for a full bag", () => {
  const region = pendingFindRegion();
  assert.match(region, /bagArmorText\(it\)/);
  // Phase 35 (MAP-04): the shelf render call itself now lives in renderRail's
  // shared post-branch paint step (shelfItems set inside the find branch),
  // not inline inside the find branch's own {...} scope.
  const start = CODE.indexOf("function renderRail()");
  const end = CODE.indexOf("function syncRailLive(text)");
  assert.ok(start !== -1 && end !== -1 && end > start, "renderRail region bounds found");
  assert.match(CODE.slice(start, end), /renderDropShelf\(document\.getElementById\("find-drop-shelf"\), shelfItems\)/);
});

test("Phase 29 (LOOT-04): renderDropShelf (the shared drop shelf) reads bagArmorText", () => {
  const region = renderDropShelfRegion();
  assert.match(region, /bagArmorText\(bi\)/);
});

// ─── 7. classic CLOAKS mirror (Phase 44-02, DEAD-01) ────────────────────────
// The ARMOR-04 case that once compared the classic (dead) CLOAKS table's
// Cloak of Armor description against the live string is deleted, not
// re-pointed: the classic CLOAKS table it read no longer exists in
// mazeworld.html (this plan's layer-3 deletion). content/treasure-tables.js
// is the single source of truth for CLOAKS; its Cloak of Armor entry is
// already covered by hp-not-wp.test.js and the treasure/economy unit tests
// that import content/treasure-tables.js directly, so no replacement pin
// is needed here.
