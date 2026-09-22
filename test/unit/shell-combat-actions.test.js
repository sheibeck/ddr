// test/unit/shell-combat-actions.test.js
//
// Phase 34 (CSCR-05/08), Plan 04 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring shell-combat-screen.test.js's own source-assertion
// pattern — this file reads the real shipped source with fs.readFileSync
// and asserts against it directly. combatMenu.js's own per-class row
// behaviour (Fighter/Bard/Magic User/Thief) is already proven directly in
// combatMenu.test.js — this file proves the SHELL wiring: the 2x2 grid and
// submenu DOM shape, the dispatch table, the two shell-owned potion
// refusals landing as dull fight-log entries (never a toast), the keyboard
// map, and that the old 7-button bar/use-list/spell menu are fully gone.

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

// ─── comment stripping (line comments first, then block comments — see
// shell-narration-wiring.test.js's own doc comment for why the order matters) ──
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

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it — stays valid when a later plan adds more render helpers between
// this function and its neighbour (shell-combat-screen.test.js's pattern).
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function actionRegion() {
  return fnRegion("function renderActionArea(host)");
}
function rowRegion() {
  return fnRegion("function cbRow(row, n)");
}
function refuseRegion() {
  return fnRegion("function fightLogRefuse(text)");
}
function pickRegion() {
  return fnRegion("function pickCombatRow(row)");
}
function copyRegion() {
  const start = CODE.indexOf("const COMBAT_COPY = {");
  assert.ok(start !== -1, "const COMBAT_COPY = { not found");
  const end = CODE.indexOf("\n};", start);
  assert.ok(end !== -1 && end > start, "no closing \\n}; found after COMBAT_COPY");
  return CODE.slice(start, end + "\n};".length);
}
function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}
function styleBlock() {
  const start = HTML.indexOf("<style>");
  const end = HTML.lastIndexOf("</style>") + "</style>".length;
  return HTML.slice(start, end);
}
function guardHelpersRegion() {
  return sliceBetween(CODE, "let encRenderedAt = 0;", "function wireDeathConfirm()");
}
function helpersAndRenderEncounterRegion() {
  return sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
}

// ─── a. Grid (CSCR-05) ─────────────────────────────────────────────────────

test("CSCR-05: the action area renders the 2x2 grid (STRIKE dispatches at once; the other three read vm.actions)", () => {
  const region = actionRegion();
  assert.match(region, /cb-prompt/);
  assert.match(region, /"cb-grid"/);
  for (const id of ["cb-strike", "cb-spells", "cb-items", "cb-social"]) {
    const hits = region.match(new RegExp(`guardTap\\(document\\.getElementById\\("${id}"\\)`, "g")) || [];
    assert.equal(hits.length, 1, `expected guardTap(document.getElementById("${id}") exactly once, found ${hits.length}`);
  }
  assert.match(region, /cb-btn-accent/);
  assert.match(region, /cb-btn-off/);
  assert.match(region, /cb-btn-label/);
  assert.match(region, /cb-btn-sub/);
  assert.match(region, /vm\.actions\[1\]/);
  assert.match(region, /vm\.actions\[2\]/);
  assert.match(region, /vm\.actions\[3\]/);
  assert.match(region, /window\.mzAttack\?\.\(\)/);
});

// ─── b. Submenu ─────────────────────────────────────────────────────────────

test("CSCR-05: the submenu renders title/BACK/list from combatMenuViewModel and resets window.__mzCombatMenu on BACK", () => {
  const region = actionRegion();
  assert.match(region, /cb-submenu/);
  assert.match(region, /cb-sub-title/);
  assert.match(region, /"cb-back"/);
  assert.match(region, /cb-sub-list/);
  const cbRowCalls = region.match(/cbRow\(row, /g) || [];
  assert.equal(cbRowCalls.length, 1, "cbRow(row, n) must be called exactly once inside renderActionArea");
  assert.match(region, /guardTap\(document\.getElementById\("cb-back"\)/);
  assert.match(region, /window\.__mzCombatMenu = null; renderEncounter\(\);/);
});

test("CSCR-05: cbRow builds every field via textContent/className, guards a dispatchable row exactly once, disables a placeholder row, and carries no innerHTML", () => {
  const region = rowRegion();
  assert.match(region, /cb-row-off/);
  assert.match(region, /cb-row-label/);
  assert.match(region, /cb-row-cost/);
  assert.match(region, /cb-row-desc/);
  assert.match(region, /data-cb-row|dataset\.cbRow/);
  const guardHits = region.match(/guardTap\(el, \(\) => pickCombatRow\(row\)\)/g) || [];
  assert.equal(guardHits.length, 1, "guardTap(el, () => pickCombatRow(row)) must appear exactly once");
  assert.match(region, /el\.disabled = true/);
  assert.doesNotMatch(region, /innerHTML/);
});

// ─── c. Dispatch table ──────────────────────────────────────────────────────

test("CSCR-05/Phase 38 (ABIL-01): COMBAT_DISPATCH carries exactly the nine row-dispatch types, each mapped to its window.mz* bridge", () => {
  const start = CODE.indexOf("const COMBAT_DISPATCH = {");
  assert.ok(start !== -1, "const COMBAT_DISPATCH = { not found");
  const end = CODE.indexOf("\n};", start);
  const region = CODE.slice(start, end + "\n};".length);
  const expected = {
    attack: /attack:\s*\(\)\s*=>\s*window\.mzAttack\?\.\(\)/,
    castSpell: /castSpell:\s*\(d\)\s*=>\s*window\.mzCastSpell\?\.\(d\.idx\)/,
    sing: /sing:\s*\(\)\s*=>\s*window\.mzSing\?\.\(\)/,
    drinkPotion: /drinkPotion:\s*\(\)\s*=>\s*window\.mzDrinkPotion\?\.\(\)/,
    readScroll: /readScroll:\s*\(\)\s*=>\s*window\.mzReadScroll\?\.\(\)/,
    // Phase 38 (ABIL-01): the ABILITIES submenu's real dispatch.
    useAbility: /useAbility:\s*\(d\)\s*=>\s*window\.mzUseAbility\?\.\(d\.key\)/,
    // Phase 37 (GEAR-03): forwards the worn-slot use form
    useItem: /useItem:\s*\(d\)\s*=>\s*window\.mzUseItem\?\.\(d\.slot !== undefined \? \{ slot: d\.slot \} : d\.i\)/,
    flee: /flee:\s*\(\)\s*=>\s*window\.mzFlee\?\.\(\)/,
    parley: /parley:\s*\(\)\s*=>\s*window\.mzParley\?\.\(\)/,
  };
  for (const [key, re] of Object.entries(expected)) {
    assert.match(region, re, `COMBAT_DISPATCH.${key} must map to the expected bridge`);
  }
  const keys = Object.keys(expected);
  assert.equal(keys.length, 9);
  assert.match(pickRegion(), /COMBAT_DISPATCH\[row\.dispatch\.type\]/);
});

// ─── d. Refusals as dull entries (CSCR-04/05) ───────────────────────────────

test("CSCR-04/05: fightLogRefuse appends a dull fight-log entry, resets the submenu and re-renders, never toasts", () => {
  const region = refuseRegion();
  assert.match(region, /__mzFightLogVM\.append\(/);
  assert.match(region, /__mzFightLogVM\.dull\(/);
  assert.match(region, /window\.__mzCombatMenu = null;/);
  assert.match(region, /renderEncounter\(\);/);
  assert.doesNotMatch(region, /mzToast/);
});

test("CSCR-05: pickCombatRow catches the two potion refusals shell-side before dispatch", () => {
  const region = pickRegion();
  assert.match(region, /fightLogRefuse\(COMBAT_COPY\.fullHealth\)/);
  assert.match(region, /fightLogRefuse\(COMBAT_COPY\.noPotions\)/);
});

test("Phase 35 (MAP-03): zero toast calls anywhere in CODE — the toast host is fully retired", () => {
  // literal built by concatenation so this pin can't itself satisfy a stray
  // comment mentioning the retired call shape.
  const toastCall = ["window.mz", "Toast?.("].join("");
  const toastCallHits = CODE.match(new RegExp(toastCall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
  assert.equal(toastCallHits.length, 0, `expected zero ${toastCall} calls, found ${toastCallHits.length}`);
});

// ─── e. Submenu state off S ──────────────────────────────────────────────────

test("Phase 34: the submenu is presentation-only — zero spellOpen, zero S.combat.menu/state.combat.menu", () => {
  assert.doesNotMatch(CODE, /spellOpen/);
  assert.doesNotMatch(CODE, /S\.combat\.menu/);
  assert.doesNotMatch(CODE, /state\.combat\.menu/);
  assert.match(actionRegion(), /window\.__mzCombatMenu/);
});

// ─── f. Keys ──────────────────────────────────────────────────────────────

test("CSCR-05/08: the keydown handler clicks the guarded grid/submenu buttons, never dispatches an engine bridge directly except mzFight", () => {
  const region = keydownRegion();
  assert.match(region, /\["cb-strike", "cb-spells", "cb-items", "cb-social"\]/);
  assert.match(region, /#cb-sub-list \[data-cb-row\]/);
  assert.match(region, /k === "escape"/);
  assert.match(region, /k === "backspace"/);
  assert.match(region, /document\.getElementById\("cb-back"\)\?\.click\(\)/);
  const mzFightHits = region.match(/window\.mzFight\?\.\(\)/g) || [];
  assert.equal(mzFightHits.length, 1, "window.mzFight?.() must appear exactly once");
  assert.doesNotMatch(region, /mzDrinkPotion|mzAttack|mzFlee|mzParley|mzSing|mzReadScroll/);
  const combatIdx = region.indexOf("if (S.combat) {");
  assert.ok(combatIdx !== -1, "if (S.combat) { must exist in the keydown handler");
  const afterCombat = region.slice(combatIdx + "if (S.combat) {".length);
  const firstStatement = afterCombat.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  assert.equal(firstStatement, "if (!encArmed()) return;");
});

// ─── g. Old bar gone ──────────────────────────────────────────────────────

test("Phase 34: the old 7-button bar, the combat use-list and the spell menu are fully gone", () => {
  for (const needle of ['"a-strike"', '"a-potion"', '"a-flee"', '"a-spell"', '"a-talk"', '"a-sing"', '"a-scroll"', "combat-use-list", "spellmenu"]) {
    assert.doesNotMatch(CODE, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must have zero non-comment occurrences`);
  }
  const style = styleBlock();
  assert.doesNotMatch(style, /\.spellmenu\{/);
  assert.doesNotMatch(style, /\.foes\{/);
  assert.doesNotMatch(style, /\.foe\{/);
});

// ─── h. Guards ────────────────────────────────────────────────────────────

test("Phase 34/35: guard: true occurs exactly once — the loot card (the combat use-list folded into the ITEMS submenu rows)", () => {
  const hits = CODE.match(/guard: true/g) || [];
  assert.equal(hits.length, 1);
  // Phase 58 (MOTION-03): both markers now carry the beat's `!bv && ` gate
  // (D-09/D-11) — re-pinned to the landed strings, same region.
  const lootIdx = CODE.indexOf("if (!bv && S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {");
  // Phase 35 (MAP-04): the joiner/find branches moved out of renderEncounter
  // — the loot branch's next renderEncounter sibling is the store guard now.
  const storeIdx = CODE.indexOf("if (!bv && S.store) {");
  const lootGuardIdx = CODE.indexOf("guard: true", lootIdx);
  assert.ok(lootIdx !== -1 && storeIdx !== -1 && lootGuardIdx > lootIdx && lootGuardIdx < storeIdx, "the sole guard:true must sit inside the loot branch");
});

test("Phase 34: the helpers + renderEncounter region carries no tap-anywhere-to-dismiss listener", () => {
  const region = helpersAndRenderEncounterRegion();
  for (const bad of [/card\.onclick/, /body\.onclick/, /panel\.onclick/, /body\.addEventListener/, /panel\.addEventListener/, /card\.addEventListener/]) {
    assert.doesNotMatch(region, bad);
  }
});

test("Phase 34: the guard-helper region carries no transition/animation token", () => {
  const region = guardHelpersRegion();
  assert.doesNotMatch(region, /transition/i);
  assert.doesNotMatch(region, /animation/i);
});

// ─── i. Voice ─────────────────────────────────────────────────────────────

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

test("Phase 34: every COMBAT_COPY string leaf is non-empty and clear of content/safety-wordlist.js BANNED", () => {
  const region = copyRegion();
  const leaves = [...region.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
  assert.ok(leaves.length > 0, "expected at least one string leaf inside COMBAT_COPY");
  for (const leaf of leaves) {
    assert.ok(leaf.length > 0, "every COMBAT_COPY string leaf must be non-empty");
    const offenders = findBannedTerms(leaf);
    assert.deepStrictEqual(offenders, [], `Banned copy in COMBAT_COPY: ${JSON.stringify(offenders)} (text: "${leaf}")`);
  }
});

test("Phase 34: COMBAT_COPY carries this plan's two keys (fullHealth, noPotions)", () => {
  const region = copyRegion();
  assert.match(region, /fullHealth:/);
  assert.match(region, /noPotions:/);
});
