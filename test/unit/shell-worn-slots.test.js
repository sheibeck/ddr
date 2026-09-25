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
//      new slot branch reads state.c.worn/slotFor(it) and calls mkSwapConfirm;
//   4. the Gear tab's worn rows (wornSlotRow, the WORN_SLOTS loop) sit
//      between the armor wornRow call and renderCarriedList, without
//      touching wornRow's pinned signature;
//   5. the classic eff(key) duplicate is retired — heroTab.js imports eff
//      directly (section 5 pins the absence);
//   6. the derived.js import line carries conditionsOf/hasTool/
//      mapViewRadius/inViewWindow only;
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
import { renderGearTab, GEAR_WORN_ORDER, gearWornModel } from "../../src/browser/gearTab.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { fixedStates } from "./harness/shellSandbox.js";

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
// Phase 47 (SHELL-01), Plan 03, Task 2: renderCarriedList, the confirm
// trios, wornSlotRow and the ON YOU/BAG paint body all moved into
// src/browser/gearTab.js.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function renderCarriedListRegion() {
  return sliceBetween(GEAR_SRC, "export function renderCarriedList(", "export function renderGearTab(");
}



// ─── 1. SWAP trio ───────────────────────────────────────────────────────────

test("Trio: SWAP_CONFIRM_MS/swapConfirmRevert/revertSwapConfirm() are declared once each, after revertDropConfirm() and before renderCarriedList (src/browser/gearTab.js); DROP_CONFIRM_MS untouched", () => {
  assert.equal((GEAR_SRC.match(/const SWAP_CONFIRM_MS = 3000;/g) || []).length, 1);
  assert.equal((GEAR_SRC.match(/let swapConfirmRevert = null;/g) || []).length, 1);
  assert.equal((GEAR_SRC.match(/function revertSwapConfirm\(\)/g) || []).length, 1);
  const dropFnIdx = GEAR_SRC.indexOf("function revertDropConfirm()");
  const carriedFnIdx = GEAR_SRC.indexOf("export function renderCarriedList(");
  const constIdx = GEAR_SRC.indexOf("const SWAP_CONFIRM_MS = 3000;");
  const letIdx = GEAR_SRC.indexOf("let swapConfirmRevert = null;");
  const revertFnIdx = GEAR_SRC.indexOf("function revertSwapConfirm()");
  assert.ok(dropFnIdx !== -1 && carriedFnIdx !== -1, "anchors found");
  assert.ok(dropFnIdx < constIdx && constIdx < carriedFnIdx, "SWAP_CONFIRM_MS sits between revertDropConfirm() and renderCarriedList(");
  assert.ok(dropFnIdx < letIdx && letIdx < carriedFnIdx, "swapConfirmRevert sits between revertDropConfirm() and renderCarriedList(");
  assert.ok(dropFnIdx < revertFnIdx && revertFnIdx < carriedFnIdx, "revertSwapConfirm() sits between revertDropConfirm() and renderCarriedList(");
  assert.equal((GEAR_SRC.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 1);
});

// ─── 2. Confirm mechanics ───────────────────────────────────────────────────

test("Confirm mechanics: swap arm/choices/No/timeout/outside-tap revert inside renderCarriedList (src/browser/gearTab.js); the Phase 33 Drop pins are untouched in the same region (260918-wy1: generalized to a choices array)", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /const mkSwapConfirm = \(i, choices\) => \{/);
  assert.match(region, /choices\.length === 1 \? `Swap for \$\{choices\[0\]\.name\}\?` : "Swap for which\?"/);
  assert.equal((region.match(/className = "mw-swap-confirm"/g) || []).length, 1);
  assert.match(region, /for \(const choice of choices\) \{/);
  // Phase 47 (SHELL-01), Plan 03: window.mzEquipItem?. -> deps.equipItem?.
  assert.match(region, /revertSwapConfirm\(\); deps\.equipItem\?\.\(i, choice\.slot\); \}/);
  // Drop confirm's own literal "Yes" survives (unchanged); the swap confirm's
  // button label is now dynamic (choices.length === 1 ? "Yes" : choice.name),
  // so no literal "Yes" string appears at its call site any more.
  assert.equal((region.match(/mkBtn\("Yes"/g) || []).length, 1, "exactly one literal Yes button (Drop confirm only)");
  assert.ok((region.match(/mkBtn\("No"/g) || []).length >= 2, "at least two No buttons (Drop + Swap confirms)");
  assert.equal((region.match(/setTimeout\(revertSwapConfirm, SWAP_CONFIRM_MS\)/g) || []).length, 1);
  // Phase 47 (SHELL-01), Plan 03: document.addEventListener -> doc.addEventListener.
  assert.equal((region.match(/doc\.addEventListener\("pointerdown", onSwapTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/doc\.removeEventListener\("pointerdown", onSwapTap, true\)/g) || []).length, 1);
  assert.match(region, /wrap\.replaceWith\(equip\)/);
  // the Phase 33 Drop confirm's own pins, re-asserted in the same region
  assert.equal((region.match(/className = "mw-drop-confirm"/g) || []).length, 1);
  assert.equal((region.match(/doc\.addEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/doc\.removeEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/setTimeout\(revertDropConfirm, DROP_CONFIRM_MS\)/g) || []).length, 1);
});

// ─── 3. Equip branch ─────────────────────────────────────────────────────────

test("Equip branch: the weapon/armor Equip line is byte-identical; the family branch reads state.c.worn/slotFor/WORN_KEYS_OF and calls mkSwapConfirm(i, keys.map(", () => {
  const region = renderCarriedListRegion();
  assert.match(region, /if \(it\.kind === "weapon" \|\| it\.kind === "armor"\) li\.appendChild\(mkBtn\("Equip", \(\) => deps\.equipItem\?\.\(i\)\)\);/);
  // Phase 47 (SHELL-01), Plan 03: S.c/window.__mzSlotFor/window.__mzWornKeysOf
  // -> state.c/slotFor/WORN_KEYS_OF (direct engine/derived.js imports).
  assert.match(region, /state\.c\.worn && slotFor\(it\)/);
  assert.match(region, /WORN_KEYS_OF\[family\] \|\| \[\]/);
  assert.match(region, /mkSwapConfirm\(i, keys\.map\(\(k\) => \(\{ slot: k, name: state\.c\.worn\[k\]\.n \}\)\)\)/);
});

// ─── 4. Worn rows: gearWornModel (Phase 62, GSCR-02 successor) ──────────────

// Phase 62 (GSCR-01..06), Plan 02: wornSlotRow/wornRow/the ON YOU paint body
// are retired with the two-panel renderer — the WORN list's five rows
// (weapon/armor/cloak/jewelry1/jewelry2) now come from ONE pure model,
// gearWornModel(state), read by renderGearTab. These two tests (4/5) become
// behavioral pins on that model and its render wiring; tests 1-3 above and
// every later test in this file stay byte-identical.
//
// Phase 63 (GSCR-07/08/10): the per-card harvest through the shared
// carried-item list (the gearRow:true call site) is gone — every WORN row
// and BAG card opens the bottom action sheet instead. This test now pins
// gearRow: true's absence from gearTab.js entirely.
test("Worn rows: gearWornModel(state) iterates GEAR_WORN_ORDER, and gearRow: true appears zero times anywhere in the codebase's shipped source", () => {
  const { thief } = fixedStates();
  const model = gearWornModel(thief);
  assert.deepStrictEqual(model.rows.map((r) => r.key), [...GEAR_WORN_ORDER]);

  assert.equal((CODE.match(/gearRow: true/g) || []).length, 0);
  assert.equal((GEAR_SRC.match(/gearRow: true/g) || []).length, 0, "gearRow:true is retired with the Phase 62 per-card harvest");
});

test("Worn rows: a worn jewel's USE cell dispatches deps.useItem?.({ slot })", () => {
  const { thief } = fixedStates();
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-gear");
  const useCalls = [];
  renderGearTab(host, thief, { useItem: (ref) => useCalls.push(ref) });
  const jewelry1 = doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === "jewelry1");
  const useCell = jewelry1.children.find((n) => n.className === "mw-gear-use");
  assert.ok(useCell, "expected the thief fixture's worn jewelry1 to carry a USE cell");
  useCell.children.find((n) => n.tagName === "button").onclick({ stopPropagation() {} });
  assert.deepStrictEqual(useCalls, [{ slot: "jewelry1" }]);
});

test("Worn rows: tapping a worn jewel's row opens the sheet on that slot", () => {
  const c = {
    cls: "Fighter", weapon: "Axe", armor: "Mail", ar: 12, armorWP: 30, armorMax: 30,
    gold: 0, items: [], bag: "small",
    worn: { cloak: null, jewelry1: { kind: "jewelry", n: "Ring of Power", txt: "used, it adds +1 damage to every attack for fifty squares; then fifty squares of quiet" }, jewelry2: null },
    potions: 0, scrolls: 0, rations: 0, kills: 0, timers: {},
  };
  const doc = createRecordingDocument();
  const host = doc.document.getElementById("screen-gear");
  const openCalls = [];
  renderGearTab(host, { c }, { openGearSheet: (target, openerId) => openCalls.push([target, openerId]) });
  const jewelry1 = doc.document.getElementById("gear-worn").children.find((li) => li.dataset.slot === "jewelry1");
  jewelry1.onclick();
  assert.deepStrictEqual(openCalls, [[{ from: "worn", slot: "jewelry1" }, "gear-open-jewelry1"]]);
});

// ─── 5. Classic eff routing — retired ───────────────────────────────────────

// Phase 47 (SHELL-02), Plan 04, Task 2: the classic eff(key) duplicate (and
// its window.__mzEff bridge) are gone — eff(key)'s only remaining callers
// (the Hero sheet's damage-bonus/upkeep reads) moved into heroTab.js, which
// imports eff from engine/derived.js directly (a two-argument eff(c, key)
// call, not the classic script's own zero-arg-closure duplicate).
test("the classic eff(key) duplicate is retired; heroTab.js imports eff(c, key) directly from engine/derived.js", () => {
  assert.equal((CODE.match(/function eff\(key\) \{/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzEff/g) || []).length, 0);
  const heroSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "heroTab.js"), "utf8").replace(/\r\n/g, "\n");
  // Phase 74 (ROLL-02): `toHit` was dropped from this import line — nothing
  // else in heroTab.js reads it since #s-hit/the TO HIT stat row both moved
  // to heroHitOdds(state) (src/browser/rollOdds.js).
  assert.match(heroSrc, /import \{ strikeDie, upkeep, skill, eff, intelBonus, spellLevelFor, schoolGate, potionMight \} from "\.\.\/\.\.\/engine\/derived\.js";/);
  assert.match(heroSrc, /eff\(c, "dmg"\)/);
});

// ─── 6. Module bridges ───────────────────────────────────────────────────────

test("Bridges: derived.js import carries conditionsOf/hasTool/mapViewRadius/inViewWindow (eff/toHit/strikeDie retired). Phase 47 (SHELL-01), Plan 03: __mzSlotFor/__mzWornSlots/__mzWornKeysOf are retired — gearTab.js imports slotFor/WORN_SLOTS/WORN_KEYS_OF from engine/derived.js directly", () => {
  // Phase 39 (GEAR-01/GEAR-02/GEAR-05), Plan 05: the shared derived.js
  // import line gained hasTool/toHit/strikeDie as sibling named imports.
  // Phase 41 (TERR-03), Plan 04: mapViewRadius/inViewWindow joined the same
  // import line. Phase 47 (SHELL-02), Plan 04: eff/toHit/strikeDie dropped
  // off it (heroTab.js imports them from engine/derived.js directly).
  assert.match(CODE, /import \{ conditionsOf, hasTool, mapViewRadius, inViewWindow \} from "\.\/engine\/derived\.js";/);
  assert.equal((CODE.match(/window\.__mzEff = eff;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzToHit = toHit;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzStrikeDie = strikeDie;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzSlotFor = slotFor;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzWornSlots = WORN_SLOTS;/g) || []).length, 0);
  assert.equal((CODE.match(/window\.__mzWornKeysOf = WORN_KEYS_OF;/g) || []).length, 0);
  assert.ok(CODE.indexOf("window.__mzConditionsOf = conditionsOf;") !== -1, "__mzConditionsOf still assigned");
  // gearTab.js's own direct imports of slotFor/WORN_SLOTS/WORN_KEYS_OF.
  assert.match(GEAR_SRC, /import \{ WORN_SLOTS, WORN_KEYS_OF, activationFor, itemTimerId, chargesTimerId, slotFor \} from "\.\.\/\.\.\/engine\/derived\.js";/);
});

test("Bridge: window.mzEquipItem forwards an optional targeted swap key (260918-wy1)", () => {
  assert.match(CODE, /window\.mzEquipItem = \(i, slot\) => inventoryAction\(slot === undefined \? \{ type: "equipItem", i \} : \{ type: "equipItem", i, slot \}\);/);
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
