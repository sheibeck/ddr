// test/unit/shell-worn-slots.test.js
//
// Phase 37 (GEAR-03/GEAR-04), Plan 04 — mazeworld.html has no module surface
// a test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-company-panel.test.js / shell-gear-
// toolbar.test.js's own source-assertion pattern — this file reads the real
// shipped source with fs.readFileSync and asserts against it directly:
//   1. the SWAP trio (SWAP_CONFIRM_MS/swapConfirmRevert/revertSwapConfirm)
//      sits above renderCarriedList, mirroring the DROP trio; DROP_CONFIRM_MS
//      untouched;
//   2. the swap-confirm mechanics (arm/Yes/No/timeout/outside-tap revert)
//      inside renderCarriedList, alongside the still-intact Drop-confirm pins;
//   3. the equip branch: the weapon/armor Equip line is byte-identical, the
//      new slot branch reads S.c.worn/__mzSlotFor and calls mkSwapConfirm;
//   4. the Gear tab's worn rows (wornSlotRow, the WORN_SLOTS loop) sit
//      between the armor wornRow call and renderCarriedList, without
//      touching wornRow's pinned signature;
//   5. the classic eff(key) duplicate routes through window.__mzEff and
//      keeps its legacy loop as the fallback;
//   6. the derived.js import/bridge trio (__mzEff/__mzSlotFor/__mzWornSlots);
//   7. window.mzUseItem's ref (bag index | { slot }) form;
//   8. the resume-time surfaceWornReconcile() call site and its imports;
//   9. the new CSS rule, and that .mw-drop-confirm's own rule is untouched;
//   10. the new copy clears the family-friendly safety wordlist;
//   11. the build artefact (www/index.html) carries the new surface.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as the sibling shell-
// *.test.js files — line comments are stripped BEFORE block comments) ─────
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function renderCarriedListRegion() {
  return sliceBetween(CODE, "function renderCarriedList(", "function renderDropShelf(");
}

function paintCarryRegion() {
  return sliceBetween(CODE, 'const carry = document.getElementById("s-carry");', 'document.getElementById("doss-who")');
}

// The new worn-row block only — narrower than paintCarryRegion so the
// "once" pins below aren't confused by wornRow's own (pre-existing, byte-
// identical) window.mzUnequip?.(slot) call earlier in the same carry block.
function wornSlotRowRegion() {
  return sliceBetween(CODE, "const wornSlotRow = (slot, it) => {", "renderCarriedList(carry, items, {");
}

function effRegion() {
  const start = CODE.indexOf("function eff(key) {");
  assert.ok(start !== -1, "function eff(key) { found");
  const end = CODE.indexOf("\n}", start);
  assert.ok(end !== -1 && end > start, "closing } for eff(key) found");
  return CODE.slice(start, end);
}

// ─── 1. SWAP trio ───────────────────────────────────────────────────────────

test("Trio: SWAP_CONFIRM_MS/swapConfirmRevert/revertSwapConfirm() are declared once each, after revertDropConfirm() and before renderCarriedList; DROP_CONFIRM_MS untouched", () => {
  assert.equal((CODE.match(/const SWAP_CONFIRM_MS = 3000;/g) || []).length, 1);
  assert.equal((CODE.match(/let swapConfirmRevert = null;/g) || []).length, 1);
  assert.equal((CODE.match(/function revertSwapConfirm\(\)/g) || []).length, 1);
  const dropFnIdx = CODE.indexOf("function revertDropConfirm()");
  const carriedFnIdx = CODE.indexOf("function renderCarriedList(");
  const constIdx = CODE.indexOf("const SWAP_CONFIRM_MS = 3000;");
  const letIdx = CODE.indexOf("let swapConfirmRevert = null;");
  const revertFnIdx = CODE.indexOf("function revertSwapConfirm()");
  assert.ok(dropFnIdx !== -1 && carriedFnIdx !== -1, "anchors found");
  assert.ok(dropFnIdx < constIdx && constIdx < carriedFnIdx, "SWAP_CONFIRM_MS sits between revertDropConfirm() and renderCarriedList(");
  assert.ok(dropFnIdx < letIdx && letIdx < carriedFnIdx, "swapConfirmRevert sits between revertDropConfirm() and renderCarriedList(");
  assert.ok(dropFnIdx < revertFnIdx && revertFnIdx < carriedFnIdx, "revertSwapConfirm() sits between revertDropConfirm() and renderCarriedList(");
  assert.equal((CODE.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 1);
});

// ─── 2. Confirm mechanics ───────────────────────────────────────────────────

test("Confirm mechanics: swap arm/Yes/No/timeout/outside-tap revert inside renderCarriedList; the Phase 33 Drop pins are untouched in the same region", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /const mkSwapConfirm = \(i, wornName\) => \{/);
  assert.match(region, /`Swap for \$\{wornName\}\?`/);
  assert.equal((region.match(/className = "mw-swap-confirm"/g) || []).length, 1);
  assert.ok((region.match(/mkBtn\("Yes"/g) || []).length >= 2, "at least two Yes buttons (Drop + Swap confirms)");
  assert.ok((region.match(/mkBtn\("No"/g) || []).length >= 2, "at least two No buttons (Drop + Swap confirms)");
  assert.equal((region.match(/setTimeout\(revertSwapConfirm, SWAP_CONFIRM_MS\)/g) || []).length, 1);
  assert.equal((region.match(/document\.addEventListener\("pointerdown", onSwapTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/document\.removeEventListener\("pointerdown", onSwapTap, true\)/g) || []).length, 1);
  assert.match(region, /wrap\.replaceWith\(equip\)/);
  assert.equal((region.match(/revertSwapConfirm\(\); window\.mzEquipItem\?\.\(i\);/g) || []).length, 1);
  // the Phase 33 Drop confirm's own pins, re-asserted in the same region
  assert.equal((region.match(/className = "mw-drop-confirm"/g) || []).length, 1);
  assert.equal((region.match(/document\.addEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/document\.removeEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/setTimeout\(revertDropConfirm, DROP_CONFIRM_MS\)/g) || []).length, 1);
});

// ─── 3. Equip branch ─────────────────────────────────────────────────────────

test("Equip branch: the weapon/armor Equip line is byte-identical; the slot branch reads S.c.worn/__mzSlotFor and calls mkSwapConfirm", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /if \(it\.kind === "weapon" \|\| it\.kind === "armor"\) li\.appendChild\(mkBtn\("Equip", \(\) => window\.mzEquipItem\?\.\(i\)\)\);/);
  assert.match(region, /S\.c\.worn && window\.__mzSlotFor\?\.\(it\)/);
  assert.match(region, /mkSwapConfirm\(i, wornNow\.n\)/);
});

// ─── 4. Worn rows in the paint carry region ─────────────────────────────────

test("Worn rows: wornSlotRow sits between the armor wornRow call and renderCarriedList; wornRow's pinned signature is untouched", () => {
  assert.equal((CODE.match(/const wornSlotRow = \(slot, it\) => \{/g) || []).length, 1);
  assert.match(CODE, /const wornRow = \(label, sub, slot, canUnequip, noSlotNeeded\) =>/);
  const carryRegion = paintCarryRegion();
  const iArmorRow = carryRegion.indexOf("wornRow(armorD.label");
  const iWornSlotRow = carryRegion.indexOf("const wornSlotRow = (slot, it) => {");
  const iRenderCarried = carryRegion.indexOf("renderCarriedList(carry, items, {");
  assert.ok(iArmorRow !== -1 && iWornSlotRow !== -1 && iRenderCarried !== -1, "all three anchors found in the paint carry region");
  assert.ok(iArmorRow < iWornSlotRow && iWornSlotRow < iRenderCarried, "wornSlotRow sits after the armor wornRow call and before renderCarriedList");
  assert.ok((carryRegion.match(/<span class="mw-worn-tag">worn<\/span>/g) || []).length >= 1, "wornRow's innerHTML template still carries the worn tag");
  // Phase 39 (GEAR-02/GEAR-05), Plan 05 (T-38-11): wornSlotRow's OWN worn
  // tag moved off the innerHTML template onto createElement/textContent —
  // no innerHTML carries an item name in this region anymore.
  const wornSlotRegion = sliceBetween(CODE, "const wornSlotRow = (slot, it) => {", "renderCarriedList(carry, items, {");
  assert.doesNotMatch(wornSlotRegion, /innerHTML/);
  assert.match(wornSlotRegion, /tag\.className = "mw-worn-tag";/);
  assert.match(wornSlotRegion, /tag\.textContent = "worn";/);
  assert.equal((CODE.match(/gearRow: true/g) || []).length, 1, "gearRow:true is still passed at exactly the GEAR call site");
});

test("Worn rows: the new wornSlotRow block dispatches Use({slot})/Unequip(slot) and loops WORN_SLOTS exactly once each", () => {
  const region = wornSlotRowRegion();
  assert.equal((region.match(/window\.mzUseItem\?\.\(\{ slot \}\)/g) || []).length, 1);
  assert.equal((region.match(/window\.mzUnequip\?\.\(slot\)/g) || []).length, 1);
  assert.equal((region.match(/for \(const slot of \(window\.__mzWornSlots \|\| \[\]\)\)/g) || []).length, 1);
  // Phase 39 (GEAR-02/GEAR-05), Plan 05: the row-state rule moved off
  // it.every/usedAt onto window.__mzItemRowState(S, it).
  assert.match(region, /window\.__mzItemRowState\(S, it\)/);
});

// ─── 5. Classic eff routing ─────────────────────────────────────────────────

test("eff(key) routes through window.__mzEff, keeping the legacy sum-over-c.items loop as the fallback", () => {
  const region = effRegion();
  assert.match(region, /const f = window\.__mzEff; if \(f\) return f\(S\.c, key\);/);
  assert.match(region, /for \(const it of \(S\.c\.items \|\| \[\]\)\) if \(it\.eff && it\.eff\[key\]\) t \+= it\.eff\[key\];/);
});

// ─── 6. Module bridges ───────────────────────────────────────────────────────

test("Bridges: derived.js import carries eff/slotFor/WORN_SLOTS; window.__mzEff/__mzSlotFor/__mzWornSlots assigned once each, after __mzConditionsOf", () => {
  // Phase 39 (GEAR-01/GEAR-02/GEAR-05), Plan 05: the shared derived.js
  // import line gained hasTool/toHit/strikeDie as sibling named imports.
  assert.match(CODE, /import \{ conditionsOf, canCast, eff, slotFor, WORN_SLOTS, hasTool, toHit, strikeDie \} from "\.\/engine\/derived\.js";/);
  assert.equal((CODE.match(/window\.__mzEff = eff;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzSlotFor = slotFor;/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzWornSlots = WORN_SLOTS;/g) || []).length, 1);
  const iConditionsOf = CODE.indexOf("window.__mzConditionsOf = conditionsOf;");
  const iEff = CODE.indexOf("window.__mzEff = eff;");
  const iSlotFor = CODE.indexOf("window.__mzSlotFor = slotFor;");
  const iWornSlots = CODE.indexOf("window.__mzWornSlots = WORN_SLOTS;");
  assert.ok(iConditionsOf !== -1 && iEff > iConditionsOf && iSlotFor > iConditionsOf && iWornSlots > iConditionsOf, "the three new bridges land after __mzConditionsOf");
});

// ─── 7. mzUseItem slot form ──────────────────────────────────────────────────

test("window.mzUseItem accepts a bag index or { slot }, forwarding to engineCombatAction/inventoryAction identically", () => {
  assert.match(CODE, /window\.mzUseItem = \(ref\) => \{/);
  assert.match(CODE, /const params = ref && typeof ref === "object" \? \{ slot: ref\.slot \} : \{ i: ref \};/);
  assert.match(CODE, /engineCombatAction\("useItem", params\)/);
  assert.match(CODE, /inventoryAction\(\{ type: "useItem", \.\.\.params \}\)/);
});

// ─── 8. Resume-time reconciliation surfacing ────────────────────────────────

test("surfaceWornReconcile() is declared once, wired to the ENTER-resume branch, and imports takeBootWornReport/wornReconcileCard", () => {
  assert.equal((CODE.match(/function surfaceWornReconcile\(\)/g) || []).length, 1);
  const fnRegion = sliceBetween(CODE, "function surfaceWornReconcile()", "(function initTitleScreen()");
  assert.match(fnRegion, /wornReconcileCard\(takeBootWornReport\(\)\)/);
  assert.match(fnRegion, /window\.mzRailLine\?\.\(card\.title, card\.line, card\.tone, card\.hold, card\.icon\)/);
  assert.match(fnRegion, /window\.logLine\?\.\(card\.line\)/);
  assert.equal((CODE.match(/if \(resumeIntent\) \{ surfaceWornReconcile\(\); return; \}/g) || []).length, 1);
  assert.match(CODE, /takeBootWornReport \} from "\.\/src\/browser\/engineAdapter\.js";/);
  // Phase 38 (ABIL-01/03): rail.js's import gained abilityPoolCard as a
  // sibling named import on the same line — re-pinned, not deleted.
  assert.match(CODE, /wornReconcileCard, abilityPoolCard \} from "\.\/src\/browser\/rail\.js";/);
});

// ─── 9. CSS ───────────────────────────────────────────────────────────────────

test("CSS: .mw-swap-confirm exists once with no transition/animation/aria-disabled token; .mw-drop-confirm's own rule is untouched", () => {
  const ruleMatch = HTML.match(/^\.mw-swap-confirm\{[^}]*\}/m);
  assert.ok(ruleMatch, ".mw-swap-confirm rule found");
  assert.equal((HTML.match(/^\.mw-swap-confirm\{/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-swap-confirm button\.small\{margin:0\}/gm) || []).length, 1);
  assert.doesNotMatch(ruleMatch[0], /transition/i);
  assert.doesNotMatch(ruleMatch[0], /animation/i);
  assert.doesNotMatch(ruleMatch[0], /aria-disabled/i);
  const dropRuleMatch = HTML.match(/^\.mw-drop-confirm\{[^}]*\}/m);
  assert.ok(dropRuleMatch, ".mw-drop-confirm rule found");
  assert.equal(dropRuleMatch[0], '.mw-drop-confirm{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--ink-soft)}');
});

// ─── 10. Voice safety ─────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

test("Voice: 'Swap for', 'Unequip', 'Bag full', 'Use' and 'worn' clear the family-friendly safety wordlist", () => {
  for (const phrase of ["Swap for", "Unequip", "Bag full", "Use", "worn"]) {
    const offenders = findBannedTerms(phrase);
    assert.deepStrictEqual(offenders, [], `Banned copy in "${phrase}": ${JSON.stringify(offenders)}`);
  }
});

// ─── 11. Build artefact sanity ────────────────────────────────────────────────

test("Build artefact: www/index.html carries mw-swap-confirm and surfaceWornReconcile (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /mw-swap-confirm/);
  assert.match(built, /surfaceWornReconcile/);
});
