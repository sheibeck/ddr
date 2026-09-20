// test/unit/shell-input-guards.test.js
//
// Phase 32 (CMBUI-04/05), Plan 03 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-loot-screen.test.js / shell-round-
// card.test.js's own source-assertion pattern — this file reads the real
// shipped source with fs.readFileSync and asserts against it directly:
//   1. the guard-helper region (encRenderedAt/armTimer/lastDismissAt/
//      encWasActive + encArmed()/encounterSettled()/armEncounterButtons()/
//      guardTap()) exists, is a Date.now()-only comparison through
//      window.__mzInputGuards, sets/clears aria-disabled, and carries no
//      transition/animation token of any kind;
//   2. src/browser/inputGuards.js's two constants are both 250 and the
//      window.__mzInputGuards bridge is intact;
//   3. every §6.3 decision button is wired through guardTap (and NOT
//      through a bare .onclick assignment), including both find sub-
//      branches and wireDeathConfirm's Confirm button;
//   4. renderCarriedList's opts.guard wiring and the exact two call sites
//      that pass guard:true (the loot card, the combat use-list) — the
//      store's sell list stays unguarded;
//   5. renderEncounter's dismissal-transition stamp and its call to
//      armEncounterButtons();
//   6. engineMove carries exactly one settle clause, immediately after its
//      hasActiveEncounter() gate, and no isSettled/encounterSettled call
//      exists anywhere else in the file;
//   7. the keydown S.combat branch's arm check is its first statement;
//   8. no surface gained a tap-anywhere-to-dismiss gesture, and the
//      <style> block carries no aria-disabled selector (no visual flicker).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ARM_DELAY_MS, DISMISS_SETTLE_MS } from "../../src/browser/inputGuards.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-round-card.test.js / shell-loot-screen.test.js) ──────────────────
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

function guardHelpersRegion() {
  return sliceBetween(CODE, "let encRenderedAt = 0;", "function wireDeathConfirm()");
}

// Phase 34: the render helpers that wire guarded buttons sit directly
// before renderEncounter (renderMajorOverlay's mw-major-primary/secondary
// guardTap wiring among them), so the region now starts at the first of
// those helpers rather than at renderEncounter() itself.
function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
}

function wireDeathConfirmRegion() {
  return sliceBetween(CODE, "function wireDeathConfirm", "function foeStatusBadges(");
}

// Phase 47 (SHELL-01), Plan 03, Task 2: renderCarriedList moved into
// src/browser/gearTab.js — its own source is the region now, not mazeworld.html.
const GEAR_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "gearTab.js"), "utf8").replace(/\r\n/g, "\n"));
// Phase 47 (SHELL-03), Plan 05, Task 2: the whole S.store branch moved into
// src/browser/storeScreen.js — its own source is the region now, not
// mazeworld.html.
const STORE_SRC = stripComments(fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "storeScreen.js"), "utf8").replace(/\r\n/g, "\n"));

function storeRegion() {
  return STORE_SRC;
}

function engineMoveRegion() {
  return sliceBetween(CODE, "window.move = function engineMove", "window.mzDevStartAtDepth = ");
}

function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}

// ─── 1. the guard-helper region ──────────────────────────────────────────

test("guard-helper region: defines encArmed/encounterSettled/guardTap/armEncounterButtons", () => {
  const region = guardHelpersRegion();
  assert.match(region, /function encArmed\(\)/);
  assert.match(region, /function encounterSettled\(\)/);
  assert.match(region, /function guardTap\(btn, fn\)/);
  assert.match(region, /function armEncounterButtons\(\)/);
});

test("guard-helper region: both predicates are Date.now() comparisons through window.__mzInputGuards", () => {
  const region = guardHelpersRegion();
  assert.match(region, /isArmed\(encRenderedAt, Date\.now\(\)\)/);
  assert.match(region, /isSettled\(lastDismissAt, Date\.now\(\)\)/);
});

test("guard-helper region: aria-disabled is set on guard and cleared once the arm window elapses", () => {
  const region = guardHelpersRegion();
  assert.match(region, /setAttribute\("aria-disabled", "true"\)/);
  assert.match(region, /removeAttribute\("aria-disabled"\)/);
});

test("guard-helper region: no transition/animation token of any kind (reduced-motion safety)", () => {
  const region = guardHelpersRegion();
  assert.doesNotMatch(region, /transitionend/i);
  assert.doesNotMatch(region, /animationend/i);
  assert.doesNotMatch(region, /\.animate\(/i);
  assert.doesNotMatch(region, /transition/i);
  assert.doesNotMatch(region, /animation/i);
});

// ─── 2. src/browser/inputGuards.js constants + the bridge ────────────────

test("src/browser/inputGuards.js: both timing constants are 250ms", () => {
  assert.equal(ARM_DELAY_MS, 250);
  assert.equal(DISMISS_SETTLE_MS, 250);
});

test("mazeworld.html: the window.__mzInputGuards bridge is intact", () => {
  assert.match(
    CODE,
    /window\.__mzInputGuards = \{ ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled \};/,
  );
});

// ─── 3. every §6.3 decision button is wired through guardTap ─────────────

const GUARDED_IDS = [
  // Phase 34 (CSCR-06): the Fight! gate is now the major overlay's primary
  // button (mw-major-primary) — the old #a-fight id is fully retired.
  // Phase 34 (CSCR-05), Plan 04: the old 7-button bar (a-strike/a-potion/
  // a-flee/a-spell/a-talk/a-sing/a-scroll) is retired — replaced by the
  // grid (cb-strike/cb-spells/cb-items/cb-social) and the submenu's BACK
  // chip (cb-back). Plan 05 appends cb-over-btn — the over-panel's own
  // ending button (won-without-drops/soothed/fled), wired generically
  // through renderCombatOver's buttons array.
  // Phase 35 (MAP-04): the Phase 25.1 Move-on card's header dismiss control
  // (the retired "a-next" id) is gone; the joiner/find/climb decisions are
  // rail cards now, wired through the same generic railButtons() builder as
  // a-loot-take-all/a-loot-leave-all/btn-death-oracle/cb-over-btn.
  "mw-major-primary", "cb-strike", "cb-spells", "cb-items", "cb-social", "cb-back",
  "a-join-yes", "a-join-no", "a-loot-take-all", "a-loot-leave-all",
  "a-find-take", "a-find-leave", "btn-death-oracle", "cb-over-btn", "mw-rail-climb",
];

// A guarded id is wired one of three ways in renderEncounter:
//   1. directly (`guardTap(document.getElementById("id"), fn)`);
//   2. via a local variable captured first (`const sb =
//      document.getElementById("id"); if (sb) guardTap(sb, fn);` — the
//      optional action-bar buttons a-spell/a-talk/a-sing/a-scroll, which
//      may not exist and keep their `if (x) …` null-guard);
//   3. Phase 34 (CSCR-07), Plan 05: generically, through renderCombatOver's
//      buttons array — the region carries `id: "<id>"` inside a
//      `buttons: [` array AND the one generic
//      `guardTap(document.getElementById(b.id), b.onTap)` call exists
//      somewhere in the region (a-loot-take-all/a-loot-leave-all,
//      btn-death-oracle and cb-over-btn are all wired this way now).
// All three count as "wired through guardTap".
function countGuardedWiring(region, id) {
  const direct = region.match(new RegExp(`guardTap\\([^,]*getElementById\\("${id}"\\)`, "g")) || [];
  let indirect = 0;
  const assignRe = new RegExp(`const (\\w+)\\s*=\\s*document\\.getElementById\\("${id}"\\);`, "g");
  let m;
  while ((m = assignRe.exec(region))) {
    const varName = m[1];
    const guardRe = new RegExp(`guardTap\\(${varName},`);
    if (guardRe.test(region)) indirect++;
  }
  let generic = 0;
  const hasGenericIdEntry = region.includes(`id: "${id}"`);
  const hasGenericGuardTap = /guardTap\(document\.getElementById\(b\.id\), b\.onTap\)/.test(region);
  if (hasGenericIdEntry && hasGenericGuardTap) generic = 1;
  return direct.length + indirect + generic;
}

test("renderEncounter region: every §6.3 decision button id is wired through guardTap", () => {
  const region = renderEncounterRegion();
  for (const id of GUARDED_IDS) {
    const count = countGuardedWiring(region, id);
    // Phase 35 (MAP-04): a-find-take/a-find-leave are wired ONCE now (the
    // generic railButtons() builder), not twice (the retired two-branch
    // full-bag/room-left duplication renderEncounter used to carry).
    assert.ok(
      count >= 1,
      `expected "${id}" wired through guardTap at least 1x, found ${count}`,
    );
  }
});

test("renderEncounter region: none of the §6.3 ids still carry a bare .onclick assignment", () => {
  const region = renderEncounterRegion();
  for (const id of GUARDED_IDS) {
    assert.doesNotMatch(
      region,
      new RegExp(`getElementById\\("${id}"\\)\\.onclick =`),
      `"${id}" must be wired only through guardTap, never a bare .onclick =`,
    );
  }
});

test("wireDeathConfirm region: Confirm is wired through guardTap", () => {
  const region = wireDeathConfirmRegion();
  assert.match(region, /guardTap\(btn,/);
  assert.doesNotMatch(region, /btn\.onclick =/);
});

test("renderCarriedList (gearTab.js): mkBtn routes through deps.guardTap when opts.guard is set", () => {
  assert.match(GEAR_SRC, /opts\.guard \? deps\.guardTap\(bt, onClick\)/);
});

test("guard: true appears exactly once — the loot card (Phase 34 folded the combat use-list into the ITEMS submenu)", () => {
  const hits = CODE.match(/guard: true/g) || [];
  assert.equal(hits.length, 1);
  const lootIdx = CODE.indexOf("if (S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {");
  // Phase 35 (MAP-04): the joiner/find branches moved out of renderEncounter
  // — the loot branch's next renderEncounter sibling is the store guard now.
  const storeIdx = CODE.indexOf("if (S.store) {");
  const lootGuardIdx = CODE.indexOf("guard: true", lootIdx);
  assert.ok(lootIdx !== -1 && storeIdx !== -1 && lootGuardIdx > lootIdx && lootGuardIdx < storeIdx, "loot card's guard:true must sit inside the loot branch");
});

test("Phase 34: submenu rows are wired through guardTap inside cbRow", () => {
  const start = CODE.indexOf("function cbRow(row, n)");
  assert.ok(start !== -1, "function cbRow(row, n) not found");
  const end = CODE.indexOf("\nfunction ", start + "function cbRow(row, n)".length);
  const region = CODE.slice(start, end);
  const hits = region.match(/guardTap\(el, \(\) => pickCombatRow\(row\)\)/g) || [];
  assert.equal(hits.length, 1, "guardTap(el, () => pickCombatRow(row)) must appear exactly once inside cbRow");
});

test("store region: no guardTap wiring — the store stays outside the ratified §6.3 list", () => {
  const region = storeRegion();
  assert.doesNotMatch(region, /guardTap\(/);
});

// ─── 4. renderEncounter's dismissal-transition stamp + arm stamp ─────────

test("renderEncounter region: stamps lastDismissAt on the encWasActive true->false transition", () => {
  const region = renderEncounterRegion();
  assert.match(region, /encWasActive && !active/);
  assert.match(region, /lastDismissAt = Date\.now\(\)/);
  assert.match(region, /armEncounterButtons\(\);/);
});

// ─── 5. engineMove: exactly one settle clause, right after hasActiveEncounter() ──

test("engineMove region: the settle clause is the very next statement after hasActiveEncounter()", () => {
  const region = engineMoveRegion();
  const hits = region.match(/if \(hasActiveEncounter\(\)\) return;/g) || [];
  assert.equal(hits.length, 1, "engineMove must gate on hasActiveEncounter() exactly once");
  const gateIdx = region.indexOf("if (hasActiveEncounter()) return;");
  const settleIdx = region.indexOf("if (!encounterSettled()) return;");
  assert.ok(settleIdx !== -1, "engineMove must carry the settle clause");
  const between = region.slice(gateIdx + "if (hasActiveEncounter()) return;".length, settleIdx).trim();
  assert.equal(between, "", "no statement may sit between the two guard clauses");
});

test("Phase 35 (MAP-04, decision 2): engineMove's railLocked() clause is the statement right after the settle clause", () => {
  const region = engineMoveRegion();
  const settleIdx = region.indexOf("if (!encounterSettled()) return;");
  assert.ok(settleIdx !== -1, "engineMove must carry the settle clause");
  const lockIdx = region.indexOf("if (railLocked()) { window.mzRailPulse?.(); return; }");
  assert.ok(lockIdx !== -1, "engineMove must carry the railLocked() clause");
  const between = region.slice(settleIdx + "if (!encounterSettled()) return;".length, lockIdx).trim();
  assert.equal(between, "", "no statement may sit between the settle clause and the railLocked() clause");
});

test("no other isSettled/encounterSettled call exists outside engineMove's one guard", () => {
  const settledHits = CODE.match(/encounterSettled\(\)/g) || [];
  // exactly 2: the function's own definition-site body call to
  // window.__mzInputGuards.isSettled (inside encounterSettled() itself, not
  // a second CALLER of encounterSettled) plus the one caller in engineMove.
  assert.equal(settledHits.length, 2, `expected encounterSettled() to appear exactly twice (its own def + the one caller), found ${settledHits.length}`);
});

// ─── 6. keydown: the arm check is the S.combat branch's first statement ──

test("keydown region: the arm check is the first statement inside if (S.combat) {", () => {
  const region = keydownRegion();
  const combatIdx = region.indexOf("if (S.combat) {");
  assert.ok(combatIdx !== -1, "if (S.combat) { must exist in the keydown handler");
  const afterCombat = region.slice(combatIdx + "if (S.combat) {".length);
  const firstStatement = afterCombat.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  assert.equal(firstStatement, "if (!encArmed()) return;");
  assert.match(region, /window\.mzFight\?\.\(\)/);
});

// ─── 7. no tap-anywhere-to-dismiss gesture anywhere ───────────────────────

test("renderEncounter region: no panel/body/card gains a tap-anywhere-to-dismiss listener", () => {
  const region = renderEncounterRegion();
  assert.doesNotMatch(region, /panel\.onclick/);
  assert.doesNotMatch(region, /panel\.addEventListener/);
  assert.doesNotMatch(region, /body\.onclick/);
  assert.doesNotMatch(region, /body\.addEventListener/);
  assert.doesNotMatch(region, /card\.onclick/);
  assert.doesNotMatch(region, /card\.addEventListener/);
});

test("the <style> block carries no aria-disabled selector — no visual flicker for the arm window", () => {
  const styleStart = HTML.indexOf("<style>");
  const styleEnd = HTML.indexOf("</style>", styleStart);
  assert.ok(styleStart !== -1 && styleEnd !== -1);
  const styleBlock = HTML.slice(styleStart, styleEnd);
  assert.doesNotMatch(styleBlock, /aria-disabled/);
});
