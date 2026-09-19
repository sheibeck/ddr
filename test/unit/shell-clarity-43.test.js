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
import { GEAR_COPY } from "../../src/browser/viewModels.js";

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

// ─── (1) module bridge block ────────────────────────────────────────────

test("import: the pinned viewModels import line is byte-identical and occurs exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ characterSheetViewModel, grimoireViewModel, armorDisplay, bagArmorText, lootCompare, bagUsage, itemRowState \} from "\.\/src\/browser\/viewModels\.js";/g,
    ) || []).length,
    1,
  );
});

test("import: a NEW, separate viewModels import line carries the six Phase 43 exports, exactly once", () => {
  assert.equal(
    (CODE.match(
      /import \{ usableBy, rationsViewModel, eatsLineFor, dropShelfItems, emptySlotRows, GEAR_COPY \} from "\.\/src\/browser\/viewModels\.js";/g,
    ) || []).length,
    1,
  );
});

test("bridges: the four Phase 43 read-only bridges each occur exactly once, after window.__mzItemRowState", () => {
  const iItemRowState = CODE.indexOf("window.__mzItemRowState = itemRowState;");
  assert.notEqual(iItemRowState, -1);
  for (const bridge of [
    "window.__mzUsableBy = usableBy;",
    "window.__mzRations = { view: rationsViewModel, eatsLine: eatsLineFor };",
    "window.__mzDropShelfItems = dropShelfItems;",
    "window.__mzGear = { emptySlotRows, copy: GEAR_COPY };",
  ]) {
    const matches = CODE.match(new RegExp(bridge.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(matches.length, 1, `expected exactly one occurrence of: ${bridge}`);
    assert.ok(CODE.indexOf(bridge) > iItemRowState, `${bridge} must come after window.__mzItemRowState`);
  }
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

// ─── (10) build artefact ─────────────────────────────────────────────────

test("Build artefact: www/index.html carries __mzRations, __mzUsableBy and rations-panel (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /__mzRations/);
  assert.match(built, /__mzUsableBy/);
  assert.match(built, /rations-panel/);
});
