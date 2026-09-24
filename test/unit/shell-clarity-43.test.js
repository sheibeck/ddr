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
import { GEAR_COPY, gearKitRows } from "../../src/browser/gearTab.js";

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
// Phase 47 (SHELL-02), Plan 04, Task 2: the Hero RATIONS panel + the Company
// panel (renderPartyRoster) moved into src/browser/heroTab.js.
const HERO_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-03), Plan 05, Task 2: the whole S.store branch (including
// the usable-by store rows) moved into src/browser/storeScreen.js.
const STORE_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "storeScreen.js"), "utf8").replace(/\r\n/g, "\n"));

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
  // Phase 58 (MOTION-03): both markers now carry the beat's `!bv && ` gate
  // (D-09/D-11) — re-pinned to the landed strings, same region.
  return sliceBetween(CODE, "if (!bv && S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {", "if (!bv && S.store) {");
}

// Phase 47 (SHELL-03), Plan 05: the store's whole render body is
// storeScreen.js#renderStoreScreen — no region-slicing needed, STORE_SRC IS
// the region.
function storeRegion() {
  return STORE_SRC;
}

function joinerRegion() {
  return sliceBetween(
    CODE,
    "if (S.pendingJoiner && !S.combat && !S.store)",
    "if (S.pendingFind && !S.combat && !S.store)",
  );
}

function partyRosterRegion() {
  return sliceBetween(HERO_SRC, "function renderPartyRoster(doc, state, deps) {", "\nexport function renderHeroTab(");
}

function heroPaintRegion() {
  return sliceBetween(
    HERO_SRC,
    'doc.getElementById("s-cost").textContent = upkeep(c) + " hp/day";',
    'doc.getElementById("s-trait").innerHTML =',
  );
}

function gearScreenMarkup() {
  return sliceBetween(HTML, '<section class="mw-screen" id="screen-gear"', '</section>\n\n    <!-- ORACLE');
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
// Task 2: grimoireViewModel dropped off this line (renderGrimoire, its only
// classic-module-script reader, moved into heroTab.js too) and renderHeroTab
// was added (the mount function).
test("import: the heroTab.js import line carries the moved view models + renderHeroTab, exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ characterSheetViewModel, rationsViewModel, eatsLineFor, renderHeroTab \} from "\.\/src\/browser\/heroTab\.js";/g,
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

test("FIND branch: a weapon/armor find shows the explained compare line via window.__mzLootCompare(c, it).line", () => {
  // Phase 61 (STORE-03)
  const region = findRegion();
  assert.match(
    region,
    /if \(it\.kind === "weapon" \|\| it\.kind === "armor"\) lines\.push\(\{ text: window\.__mzLootCompare\(c, it\)\.line, roll: null \}\);/,
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

test("Store rows: usable is computed guarded on effectParams.item and rs.showUsable, row.disabled reads rs.disabled, and the sub composes sub/compareLine/reasonText via storeRowState (Phase 61, STORE-02/03)", () => {
  const region = storeRegion();
  assert.match(region, /const rs = storeRowState\(c, item\);/);
  assert.match(region, /row\.disabled = rs\.disabled;/);
  // Phase 71 (D-04): an item line's stats (usable-by included, gated on
  // rs.showUsable) come from the ONE formatter via storeItemStats; the
  // separate usable suffix survives only as the fallback for a line the
  // formatter renders nothing for.
  assert.match(region, /const stats = item\.effectId === "repairArmor" \? null : storeItemStats\(item, c, rs\.showUsable\);/);
  assert.match(
    region,
    /const usable = !stats && rs\.showUsable && item\.effectParams && item\.effectParams\.item \? usableBy\(item\.effectParams\.item, c\) : "";/,
  );
  assert.match(region, /const subText = \[sub, rs\.compareLine, rs\.reasonText\]\.filter\(Boolean\)\.join\(" · "\);/);
  assert.match(region, /\$\{subText \|\| usable \? `<i>\$\{subText \|\| ""\}\$\{subText && usable \? " " : ""\}\$\{usable\}<\/i>` : ""\}/);
});

// ─── (5) Joiner offer card ───────────────────────────────────────────────

test("Joiner branch: the roll line ends with the eatsLine bridge read, and the region stays innerHTML-free", () => {
  const region = joinerRegion();
  assert.equal((region.match(/window\.__mzRations\.eatsLine\(j\)/g) || []).length, 1);
  assert.match(region, /const headLine = walker/);
  assert.doesNotMatch(region, /innerHTML/);
});

// ─── (6) Company panel ───────────────────────────────────────────────────

// Phase 47 (SHELL-02), Plan 04, Task 2: renderPartyRoster moved into
// heroTab.js, which declares eatsLineFor in the SAME module — a direct call,
// no more window.__mzRations.eatsLine bridge for this reader (the bridge
// itself stays, for the classic renderEncounter Joiner card).
test("Company panel: eatsLineFor(m) is read once, capitalised locally, and rendered through escText", () => {
  const region = partyRosterRegion();
  assert.equal((region.match(/eatsLineFor\(m\)/g) || []).length, 1);
  assert.doesNotMatch(region, /window\.__mzRations/);
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

// Phase 47 (SHELL-02), Plan 04, Task 2: renderHeroTab reads rationsViewModel
// directly (declared in the SAME module) — no more window.__mzRations.view
// bridge for this reader.
test("renderHeroTab: rationsViewModel(state) is read once and writes #s-rations/#s-rations-n via textContent", () => {
  const region = heroPaintRegion();
  assert.equal((region.match(/rationsViewModel\(state\)/g) || []).length, 1);
  assert.doesNotMatch(region, /window\.__mzRations/);
  assert.match(region, /getElementById\("s-rations"\)\.textContent = rv\.line;/);
  assert.match(region, /getElementById\("s-rations-n"\)\.textContent = rv\.carriedText;/);
  assert.doesNotMatch(region, /getElementById\("s-rations"\)\.innerHTML/);
});

// ─── (8) voice safety ────────────────────────────────────────────────────

test("Voice: 'Rations' and GEAR_COPY's headings clear the family-friendly safety wordlist", () => {
  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MATCHERS = BANNED.map((term) => new RegExp("\\b" + escapeRegExp(term) + "\\b", "i"));
  for (const phrase of ["Rations", GEAR_COPY.consumables, GEAR_COPY.bag, GEAR_COPY.worn, GEAR_COPY.alsoOnYou]) {
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

// ─── (10) Gear tab markup: the Phase 62 five-section skeleton ────────────

// Phase 62 (GSCR-01..06), Plan 02: the two-panel ON YOU/BAG markup is
// replaced outright by the ten-id skeleton (header/WORN/BAG/CONSUMABLES/
// ALSO ON YOU) — greenfield, no dual path.
test("Markup: #screen-gear holds zero old-style panel sections, and the ten gear ids appear in source order", () => {
  const region = gearScreenMarkup();
  assert.equal((region.match(/<section class="panel"/g) || []).length, 0, "the old two-panel markup is gone");
  const ids = [
    "gear-stats", "gear-worn-head", "gear-worn",
    "gear-bag-head", "gear-bag-meter", "gear-bag",
    "gear-cons-head", "gear-cons",
    "gear-kit-head", "gear-kit",
  ];
  const positions = ids.map((id) => region.indexOf(`id="${id}"`));
  assert.ok(positions.every((i) => i !== -1), "every one of the ten gear ids found inside #screen-gear");
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i - 1] < positions[i], `${ids[i - 1]} must sit before ${ids[i]} in source order`);
  }
});

test("GEAR_COPY.worn/bag/consumables/alsoOnYou match their section heads (WORN/BAG/CONSUMABLES/ALSO ON YOU); the four head ids are h2 elements", () => {
  assert.equal(GEAR_COPY.worn, "WORN");
  assert.equal(GEAR_COPY.bag, "BAG");
  assert.equal(GEAR_COPY.consumables, "CONSUMABLES");
  assert.equal(GEAR_COPY.alsoOnYou, "ALSO ON YOU");
  const region = gearScreenMarkup();
  for (const id of ["gear-worn-head", "gear-bag-head", "gear-cons-head", "gear-kit-head"]) {
    assert.match(region, new RegExp(`<h2 class="mw-gear-head" id="${id}">`));
  }
});

// ─── (11) the WORN list: gearWornModel + emptySlotRows, no innerHTML ─────

// Phase 62 (GSCR-01..06), Plan 02: wornRow/wornSlotRow/headRow/emptyRow are
// retired with the two-panel renderer — the WORN list's five rows (empty or
// filled) now come from ONE pure model, gearWornModel(state), which reads
// emptySlotRows(c) as its ONE empty-slot source.
test("renderGearTab (gearTab.js): renderGearTab reads gearWornModel(state); emptySlotRows(c) is read inside gearWornModel's own region", () => {
  const renderRegion = GEAR_SRC.slice(GEAR_SRC.indexOf("export function renderGearTab("));
  assert.match(renderRegion, /gearWornModel\(state\)/);
  const wornModelRegion = sliceBetween(GEAR_SRC, "export function gearWornModel(state) {", "\nexport ");
  assert.match(wornModelRegion, /emptySlotRows\(c\)/);
  // renderGearTab's own region does not re-read emptySlotRows directly —
  // it only ever sees empty rows through gearWornModel's rows.
  assert.doesNotMatch(renderRegion, /emptySlotRows\(/);
});

test("renderGearTab (gearTab.js): its region carries no HTML-string write, and emptySlotRows' own WORN_SLOTS loop remains", () => {
  const renderRegion = GEAR_SRC.slice(GEAR_SRC.indexOf("export function renderGearTab("));
  assert.doesNotMatch(renderRegion, /\.innerHTML\s*=/);
  // emptySlotRows(c) still loops WORN_SLOTS once, unchanged since Task 1.
  assert.equal((GEAR_SRC.match(/for \(const slot of WORN_SLOTS\)/g) || []).length, 1);
});

// ─── (12) the kit list: no weapon/armor/potions/scrolls/wilmst row ───────

// Phase 62 (GSCR-01..06), Plan 02: potions/scrolls moved to CONSUMABLES and
// wilmst moved to the header — gearKitRows(state) (ALSO ON YOU) never
// duplicates the weapon/armor rows (they were never in the kit list) and no
// longer carries Potions/Scrolls/Wilmst either. renderGearTab writes
// GEAR_COPY.alsoOnYou to #gear-kit-head via its shared head() helper.
test("Kit (gearTab.js): gearKitRows has no weapon/armor/Potions/Scrolls/Wilmst row; renderGearTab writes GEAR_COPY.alsoOnYou to #gear-kit-head", () => {
  const c = {
    weapon: "Axe", armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    potions: 3, scrolls: 2, gold: 500, rations: 3, kills: 1,
  };
  const rows = gearKitRows({ c });
  const labels = rows.map((r) => r.label);
  for (const banned of ["Axe", "Mail", "Potions", "Scrolls", "Wilmst"]) {
    assert.ok(!labels.includes(banned), `expected gearKitRows to carry no "${banned}" row`);
  }
  assert.match(GEAR_SRC, /head\("gear-kit-head", GEAR_COPY\.alsoOnYou, "", false\);/);
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

// Phase 62 (GSCR-01..06), Plan 02: .mw-onyou-head/.mw-worn-empty/.mw-kit-head
// (and .mw-wilmst) are retired outright — the Phase 62 Gear CSS block's
// .mw-gear-row/.mw-gear-card/.mw-gear-head rules replace them.
test("CSS: the three Phase 43 rules and .mw-wilmst are absent; .mw-gear-row/.mw-gear-card/.mw-gear-head exist once each with no transition/animation/disabled-ARIA token", () => {
  for (const cls of [".mw-onyou-head", ".mw-worn-empty", ".mw-kit-head", ".mw-wilmst"]) {
    const ruleMatch = HTML.match(new RegExp("^" + cls.replace(".", "\\.") + "\\{", "m"));
    assert.equal(ruleMatch, null, `expected ${cls} to be absent`);
  }
  for (const cls of [".mw-gear-row", ".mw-gear-card", ".mw-gear-head"]) {
    const ruleMatch = HTML.match(new RegExp("^" + cls.replace(".", "\\.") + "\\{[^}]*\\}", "m"));
    assert.ok(ruleMatch, `${cls} rule found`);
    assert.equal((HTML.match(new RegExp("^" + cls.replace(".", "\\.") + "\\{", "gm")) || []).length, 1, `${cls} appears exactly once`);
    assert.doesNotMatch(ruleMatch[0], /transition/i);
    assert.doesNotMatch(ruleMatch[0], /animation/i);
    assert.doesNotMatch(ruleMatch[0], /aria-disabled/i);
  }
});

// ─── (15) build artefact ─────────────────────────────────────────────────

test("Build artefact: www/index.html carries __mzRations, __mzUsableBy, rations-panel, gear-worn and mw-gear-row (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /__mzRations/);
  assert.match(built, /__mzUsableBy/);
  assert.match(built, /rations-panel/);
  assert.match(built, /gear-worn/);
  assert.match(built, /mw-gear-row/);
});
