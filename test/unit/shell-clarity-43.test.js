// test/unit/shell-clarity-43.test.js
//
// Phase 43 (CLAR-02/03/04/05), Plan 04 — mazeworld.html has no ESM surface a
// test can import directly, so — mirroring test/unit/shell-terrain-41.test.js's
// own fs.readFileSync pattern — this file reads the real shipped source and
// asserts against it directly:
//   Task 1: the clarity view-model bridges (a NEW import line + four
//     bridges), "(usable by …)" on the FIND card / victory LOOT rows /
//     store rows, "eats N a rest" on the Joiner offer card and the Company
//     panel, and the Hero tab's RATIONS panel.
//   Task 2: the Gear tab as two panels (ON YOU / BAG) with in-voice empty
//     worn-slot rows, and the bag-only drop shelf.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { GEAR_COPY } from "../../src/browser/gearTab.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (HTML comments first, THEN line comments, THEN block
// comments — test/unit/hp-not-wp.test.js's own header documents why: an HTML
// comment containing the literal text "icons/optimized/*.png" has a bare "/*"
// that a naive block-comment-first pass mistakes for a real comment opener,
// silently swallowing everything up to the next literal "*/" it can find) ──
function stripComments(source) {
  const noHtmlComments = source.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));
  const noLineComments = noHtmlComments
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const CODE = stripComments(HTML);
// Phase 47 (SHELL-01), Plan 03, Task 2: the ON YOU/ALSO ON YOU/BAG paint
// body (the carry region + the kit rows) moved into src/browser/gearTab.js.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function findRegion() {
  return sliceBetween(
    CODE,
    "if (S.pendingFind && !S.combat && !S.store)",
    'if (rail.pending && rail.pending.kind === "climb") {',
  );
}

function lootRegion() {
  return sliceBetween(CODE, "if (S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {", "if (S.store) {");
}

function storeRegion() {
  return sliceBetween(CODE, "if (S.store) {", 'document.getElementById("a-leave").onclick');
}

function joinerRegion() {
  return sliceBetween(
    CODE,
    "if (S.pendingJoiner && !S.combat && !S.store)",
    "if (S.pendingFind && !S.combat && !S.store)",
  );
}

function partyRosterRegion() {
  return sliceBetween(CODE, "function renderPartyRoster() {", "function ");
}

function heroPaintRegion() {
  return sliceBetween(
    CODE,
    'document.getElementById("s-cost").textContent = upkeep() + " hp/day";',
    'document.getElementById("s-trait").innerHTML =',
  );
}

function gearScreenMarkup() {
  return sliceBetween(HTML, '<section class="mw-screen" id="screen-gear"', '</section>\n\n    <!-- ORACLE');
}

function paintCarryRegion() {
  const start = GEAR_SRC.indexOf('const carry = doc.getElementById("s-carry");');
  assert.ok(start !== -1, 'start marker not found: const carry = doc.getElementById("s-carry");');
  return GEAR_SRC.slice(start);
}

function kitRegion() {
  return sliceBetween(GEAR_SRC, "const rows = [", 'rows.push(["Kills"');
}

function renderDropShelfRegion() {
  const start = CODE.indexOf("function renderDropShelf(");
  const end = CODE.indexOf("\nfunction ", start + 1);
  return CODE.slice(start, end);
}

// ─── (1) module bridge block ────────────────────────────────────────────

test("import: the pinned viewModels import line is byte-identical and occurs exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ armorDisplay, bagArmorText, lootCompare \} from "\.\/src\/browser\/viewModels\.js";/g,
    ) || []).length,
    1,
  );
});

test("import: a NEW, separate viewModels import line carries the four Phase 43 exports, exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ usableBy, dropShelfItems \} from "\.\/src\/browser\/viewModels\.js";/g,
    ) || []).length,
    1,
  );
});

// Phase 47 (SHELL-02), Plan 04, Task 1 — characterSheetViewModel/
// grimoireViewModel/rationsViewModel/eatsLineFor moved from viewModels.js to
// heroTab.js; the classic module script gained a new import line for them.
test("import: the heroTab.js import line carries the four moved view models, exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ characterSheetViewModel, grimoireViewModel, rationsViewModel, eatsLineFor \} from "\.\/src\/browser\/heroTab\.js";/g,
    ) || []).length,
    1,
  );
});

// Phase 47 (SHELL-01), Plan 03, Task 1 — bagUsage/itemRowState/emptySlotRows/
// GEAR_COPY moved from viewModels.js to gearTab.js. Task 2 — the classic
// module script's import line was extended to renderGearTab/renderCarriedList
// (the mount function + shared list) and itemRowState/emptySlotRows/GEAR_COPY
// dropped off it (gearTab.js is their only remaining classic-script-adjacent
// reader, and it reaches them as plain in-module bindings, not an import).
test("import: the gearTab.js import line carries bagUsage/renderGearTab/renderCarriedList, exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ bagUsage, renderGearTab, renderCarriedList \} from "\.\/src\/browser\/gearTab\.js";/g,
    ) || []).length,
    1,
  );
});

test("bridges: __mzUsableBy/__mzRations/__mzDropShelfItems occur exactly once each, after __mzConditionsOf; __mzGear/__mzItemRowState are retired", () => {
  const iConditionsOf = CODE.indexOf("window.__mzConditionsOf = conditionsOf;");
  assert.notEqual(iConditionsOf, -1);
  for (const bridge of [
    "window.__mzUsableBy = usableBy;",
    "window.__mzRations = { view: rationsViewModel, eatsLine: eatsLineFor };",
    "window.__mzDropShelfItems = dropShelfItems;",
  ]) {
    const matches = CODE.match(new RegExp(bridge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(matches.length, 1, `expected exactly one occurrence of: ${bridge}`);
    assert.ok(CODE.indexOf(bridge) > iConditionsOf, `${bridge} must come after __mzConditionsOf`);
  }
  assert.equal((CODE.match(/window\.__mzGear = /g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzItemRowState = /g) || []).length, 0);
});

test("bridges: window.__mzNightlyEats stays byte-identical (the camp button's own source, untouched)", () => {
  assert.equal((CODE.match(/window\.__mzNightlyEats = nightlyEats;/g) || []).length, 1);
});

// ─── (2) FIND card ───────────────────────────────────────────────────────

test("FIND branch: computes usable via window.__mzUsableBy(it, c) and appends it to the pushed line", () => {
  const region = findRegion();
  assert.equal((region.match(/window\.__mzUsableBy\(it, c\)/g) || []).length, 1);
  assert.match(
    region,
    /lines\.push\(\{ text: `\$\{it\.n \|\| "An item"\}\$\{findSub \? ` · \$\{findSub\}` : ""\}\$\{usable \? ` \$\{usable\}` : ""\}`, roll: null \}\);/,
  );
});

test("FIND branch: the drop shelf source is window.__mzDropShelfItems(c), never raw c.items", () => {
  const region = findRegion();
  assert.match(region, /shelfItems = window\.__mzDropShelfItems\(c\);/);
  assert.doesNotMatch(region, /shelfItems = c\.items \|\| \[\];/);
  // Existing pins untouched.
  assert.match(region, /bagArmorText\(it\)/);
  assert.match(region, /copy\.find\.full\.replace\(/);
});

// ─── (3) victory LOOT screen ─────────────────────────────────────────────

test("LOOT branch: subFor appends cmp.usable, and the drop shelf reads window.__mzDropShelfItems(c)", () => {
  const region = lootRegion();
  assert.match(
    region,
    /return \(cmp\.sub \? `\$\{cmp\.line\} · \$\{cmp\.sub\}` : cmp\.line\) \+ \(cmp\.usable \? ` \$\{cmp\.usable\}` : ""\);/,
  );
  assert.match(region, /renderDropShelf\(dropShelf, window\.__mzDropShelfItems\(c\)\);/);
});

// ─── (4) store rows ──────────────────────────────────────────────────────

test("Store rows: usable is computed guarded on effectParams.item and appended into the <i> sub", () => {
  const region = storeRegion();
  assert.match(
    region,
    /const usable = item\.effectParams && item\.effectParams\.item \? window\.__mzUsableBy\(item\.effectParams\.item, S\.c\) : "";/,
  );
  assert.match(region, /\$\{sub \|\| usable \? `<i>\$\{sub \|\| ""\}\$\{sub && usable \? " " : ""\}\$\{usable\}<\/i>` : ""\}/);
});

// ─── (5) Joiner offer card ───────────────────────────────────────────────

test("Joiner branch: the roll line ends with the eatsLine bridge read, and the region stays innerHTML-free", () => {
  const region = joinerRegion();
  assert.equal((region.match(/window\.__mzRations\.eatsLine\(j\)/g) || []).length, 1);
  assert.match(region, /const headLine = walker/);
  assert.doesNotMatch(region, /innerHTML/);
});

// ─── (6) Company panel ───────────────────────────────────────────────────

test("Company panel: eatsLine(m) is read once, capitalised locally, and rendered through escText", () => {
  const region = partyRosterRegion();
  assert.equal((region.match(/window\.__mzRations\.eatsLine\(m\)/g) || []).length, 1);
  assert.match(region, /const eatsText = eatsLine\.charAt\(0\)\.toUpperCase\(\) \+ eatsLine\.slice\(1\);/);
  assert.match(region, /escText\(eatsText\)/);
  assert.doesNotMatch(region, /RACES\[m\.race\]/);
  // The old field order still holds: Weapon precedes the Eats row.
  const iWeapon = region.indexOf("Weapon: ");
  const iEats = region.indexOf("escText(eatsText)");
  assert.ok(iWeapon !== -1 && iEats !== -1 && iWeapon < iEats);
});

// ─── (7) Hero RATIONS panel ──────────────────────────────────────────────

test("Markup: #rations-panel exists once, positioned after #s-trait and before #hero-party", () => {
  assert.equal((CODE.match(/id="rations-panel"/g) || []).length, 1);
  assert.equal((CODE.match(/id="s-rations"/g) || []).length, 1);
  assert.equal((CODE.match(/id="s-rations-n"/g) || []).length, 1);
  assert.match(CODE, /<h2>Rations <span id="s-rations-n"><\/span><\/h2>/);
  const iTrait = CODE.indexOf('id="s-trait"');
  const iRations = CODE.indexOf('id="rations-panel"');
  const iHeroParty = CODE.indexOf('id="hero-party"');
  assert.ok(iTrait !== -1 && iRations !== -1 && iHeroParty !== -1);
  assert.ok(iTrait < iRations && iRations < iHeroParty);
});

test("paint(): window.__mzRations.view(S) is read once and writes #s-rations/#s-rations-n via textContent", () => {
  const region = heroPaintRegion();
  assert.equal((region.match(/window\.__mzRations\.view\(S\)/g) || []).length, 1);
  assert.match(region, /getElementById\("s-rations"\)\.textContent = rv\.line;/);
  assert.match(region, /getElementById\("s-rations-n"\)\.textContent = rv\.carriedText;/);
  assert.doesNotMatch(region, /getElementById\("s-rations"\)\.innerHTML/);
});

// ─── (8) voice safety ────────────────────────────────────────────────────

test("Voice: 'Rations' and GEAR_COPY's headings clear the family-friendly safety wordlist", () => {
  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MATCHERS = BANNED.map((term) => new RegExp("\\b" + escapeRegExp(term) + "\\b", "i"));
  for (const phrase of ["Rations", GEAR_COPY.onYou, GEAR_COPY.bag, GEAR_COPY.wielded, GEAR_COPY.worn, GEAR_COPY.alsoOnYou]) {
    for (const re of MATCHERS) {
      const hit = phrase.match(re);
      assert.ok(!hit || ALLOW.has(hit[0].toLowerCase()), `banned term found in "${phrase}"`);
    }
  }
});

// ─── (9) HP-not-WP on the new regions ────────────────────────────────────
//
// The standing test/unit/hp-not-wp.test.js guard already walks
// RATIONS_COPY/GEAR_COPY/USABLE_COPY and mazeworld.html's own tag-stripped
// player-facing text with a code-identifier-aware regex — re-deriving that
// regex here against raw (un-tag-stripped) source would false-positive on
// legitimate identifiers like `const wp = m.wp ?? 0`. This test instead
// pins that the OLD literal "Eats {n} a rest" template string (the thing
// that used to read RACES[m.race]) is gone from the Company panel source.
test("HP-not-WP hand-off: the old inline 'Eats {n} a rest' template literal is gone from the Company panel", () => {
  const region = partyRosterRegion();
  assert.doesNotMatch(region, /Eats \$\{RACES\[m\.race\]/);
});

// ─── (10) Gear tab markup: two panels, ON YOU / BAG ──────────────────────

test("Markup: #screen-gear has exactly two panels, id=onyou-panel then id=bag-panel, in the pinned source-index order", () => {
  const region = gearScreenMarkup();
  assert.equal((region.match(/<section class="panel"/g) || []).length, 2, "exactly two panel sections inside #screen-gear");
  const iOnyouPanel = region.indexOf('id="onyou-panel"');
  const iSOnyou = region.indexOf('id="s-onyou"');
  const iSKit = region.indexOf('id="s-kit"');
  const iBagPanel = region.indexOf('id="bag-panel"');
  const iSCarryN = region.indexOf('id="s-carry-n"');
  const iSCarry = region.indexOf('id="s-carry"');
  assert.ok(
    [iOnyouPanel, iSOnyou, iSKit, iBagPanel, iSCarryN, iSCarry].every((i) => i !== -1),
    "every anchor id found inside #screen-gear",
  );
  assert.ok(
    iOnyouPanel < iSOnyou && iSOnyou < iSKit && iSKit < iBagPanel && iBagPanel < iSCarryN && iSCarryN < iSCarry,
    "source-index order: onyou-panel < s-onyou < s-kit < bag-panel < s-carry-n < s-carry",
  );
});

test("GEAR_COPY.onYou/bag match the two h2 headings case-insensitively", () => {
  const region = gearScreenMarkup();
  assert.match(region, /<h2>On you<\/h2>/i);
  assert.match(region, /<h2>Bag <span id="s-carry-n"><\/span><\/h2>/i);
  assert.equal(GEAR_COPY.onYou.toLowerCase(), "on you");
  assert.equal(GEAR_COPY.bag.toLowerCase(), "bag");
});

// ─── (11) paint()'s carry region: onyou rows, head rows, empty rows ──────

test("renderGearTab (gearTab.js): #s-onyou is declared right beside #s-carry, both cleared; wornRow/wornSlotRow/headRow/emptyRow all append to onyou", () => {
  const region = paintCarryRegion();
  assert.match(region, /const onyou = doc\.getElementById\("s-onyou"\);/);
  assert.match(region, /onyou\.innerHTML = "";/);
  assert.equal((region.match(/onyou\.appendChild\(li\)/g) || []).length, 4, "wornRow + wornSlotRow + headRow + emptyRow each append to onyou");
  assert.match(region, /emptySlotRows\(c\)/);
  assert.match(region, /headRow\(GEAR_COPY\.wielded\);/);
  assert.match(region, /headRow\(GEAR_COPY\.worn\);/);
  // The pinned anchors/order from shell-worn-slots.test.js still hold.
  const iArmorRow = region.indexOf("wornRow(armorD.label");
  const iWornSlotRow = region.indexOf("const wornSlotRow = (slot, it) => {");
  const iRenderCarried = region.indexOf("renderCarriedList(carry, state, items, {");
  assert.ok(iArmorRow !== -1 && iWornSlotRow !== -1 && iRenderCarried !== -1);
  assert.ok(iArmorRow < iWornSlotRow && iWornSlotRow < iRenderCarried);
});

test("renderGearTab (gearTab.js): the WORN_SLOTS loop and wornSlotRow's own body stay innerHTML-free, falling back to an in-voice empty row", () => {
  const wornSlotRegion = sliceBetween(GEAR_SRC, "const wornSlotRow = (slot, it) => {", "renderCarriedList(carry, state, items, {");
  assert.doesNotMatch(wornSlotRegion, /innerHTML/);
  // Phase 47 (SHELL-01), Plan 03: window.__mzWornSlots -> the direct
  // WORN_SLOTS import (always an array — no `|| []` fallback needed). Two
  // occurrences now: emptySlotRows' own loop (Task 1, unchanged) and
  // renderGearTab's wornSlotRow loop (Task 2, this test's real subject).
  assert.equal((GEAR_SRC.match(/for \(const slot of WORN_SLOTS\)/g) || []).length, 2);
  assert.match(wornSlotRegion, /const r = emptyFor\(slot\); if \(r\) emptyRow\(r\.text\);/);
});

// ─── (12) the kit list: no weapon/armor duplicate, ALSO ON YOU head row ──

test("Kit (gearTab.js): the rows array no longer duplicates the weapon/armor rows; ALSO ON YOU heads the list", () => {
  const region = kitRegion();
  assert.doesNotMatch(region, /armorD\.label, armorD\.under/);
  assert.match(region, /const rows = \[\s*\["Potions", c\.potions\],/);
  assert.match(GEAR_SRC, /li\.textContent = GEAR_COPY\.alsoOnYou;/);
});

// ─── (13) renderDropShelf: bag-only entries, both call sites ─────────────

test("renderDropShelf(shelf, entries) destructures { it, i }; both call sites read window.__mzDropShelfItems(c)", () => {
  assert.equal((CODE.match(/function renderDropShelf\(shelf, entries\)/g) || []).length, 1);
  const region = renderDropShelfRegion();
  assert.match(region, /forEach\(\(\{ it: bi, i \}\) =>/);
  assert.doesNotMatch(region, /c\.items|c\.worn|c\.weapon|c\.armor/);
  assert.equal((CODE.match(/window\.__mzDropShelfItems\(c\)/g) || []).length, 2);
});

// ─── (14) CSS ─────────────────────────────────────────────────────────────

test("CSS: .mw-onyou-head/.mw-worn-empty/.mw-kit-head exist once each, carrying no transition/animation/aria-disabled token", () => {
  for (const cls of [".mw-onyou-head", ".mw-worn-empty", ".mw-kit-head"]) {
    const ruleMatch = HTML.match(new RegExp("^" + cls.replace(".", "\\.") + "\\{[^}]*\\}", "m"));
    assert.ok(ruleMatch, `${cls} rule found`);
    assert.doesNotMatch(ruleMatch[0], /transition/i);
    assert.doesNotMatch(ruleMatch[0], /animation/i);
    assert.doesNotMatch(ruleMatch[0], /aria-disabled/i);
  }
});

// ─── (15) build artefact ─────────────────────────────────────────────────

test("Build artefact: www/index.html carries __mzRations, __mzUsableBy, rations-panel, onyou-panel and mw-kit-head (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /__mzRations/);
  assert.match(built, /__mzUsableBy/);
  assert.match(built, /rations-panel/);
  assert.match(built, /onyou-panel/);
  assert.match(built, /mw-kit-head/);
});
