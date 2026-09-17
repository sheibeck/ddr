// test/unit/shell-combat-screen.test.js
//
// Phase 34 (CSCR-01/02/03/06/08), Plan 03 — mazeworld.html has no module
// surface a test could import directly (it is not an ESM module the test
// runner can load), so — mirroring shell-fight-log.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly. The VIEW-MODEL behaviour
// itself (header/foe/lot/overlay content) is proven in combatPanel.test.js;
// this file proves the SHELL wiring: layout order, CSS, the four render
// helpers' DOM shape, the guarded foe-card tap, the MAJOR OVERLAY gate, the
// Enter/Space key path, and that no tap-anywhere-to-dismiss/transition-
// coupled guard crept in.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const COMBAT_PANEL_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "combatPanel.js"), "utf8");

// ─── comment stripping (line comments first, THEN block comments — a
// literal `/*`-looking substring inside a `//` comment must not be misread
// as an unterminated block-comment opener; see 31-01-SUMMARY.md / 34-RESEARCH
// Pitfall 4) ───────────────────────────────────────────────────────────────
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
// this function and its neighbour.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function helpersRegion() {
  return sliceBetween(CODE, "function renderFightLog(host)", "function renderEncounter()");
}

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}

function combatBranch() {
  const region = renderEncounterRegion();
  const start = region.indexOf("const C = S.combat;");
  assert.ok(start !== -1, "combatBranch: const C = S.combat; not found inside renderEncounter region");
  return region.slice(start);
}

function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}

// The whole self-hosted <style> area spans four adjacent <style>...</style>
// tags in <head> (base reset / fonts / theme+combat CSS / animation
// keyframes) — first "<style>" to the LAST "</style>" covers all of them.
function styleBlock() {
  const start = HTML.indexOf("<style>");
  const end = HTML.lastIndexOf("</style>") + "</style>".length;
  assert.ok(start !== -1 && end > start, "style block not found");
  return HTML.slice(start, end);
}

function guardHelpersRegion() {
  return sliceBetween(CODE, "let encRenderedAt = 0;", "function vitalsStrip()");
}

// ─── a. Layout order (CSCR-01) ─────────────────────────────────────────────

test("CSCR-01: combat branch builds the pending gate, then header -> cb-mid -> foes -> lot -> log -> cb-act in strictly increasing order", () => {
  const region = combatBranch();
  const modeIdx = region.indexOf('panel.dataset.mode = "dark";');
  const pendingIdx = region.indexOf("if (C.pending)");
  const headerIdx = region.indexOf("renderCombatHeader(body");
  const midIdx = region.indexOf('mid.id = "cb-mid"');
  const foesIdx = region.indexOf("renderFoeCards(mid");
  const lotIdx = region.indexOf("renderYourLot(mid");
  const logIdx = region.indexOf("renderFightLog(mid)");
  const actIdx = region.indexOf('act.id = "cb-act"');
  assert.ok(modeIdx !== -1, 'panel.dataset.mode = "dark"; must be set in the combat branch');
  assert.ok(modeIdx < pendingIdx, "dark mode is set before the pending gate");
  assert.ok(
    pendingIdx > -1 && headerIdx > pendingIdx && midIdx > headerIdx && foesIdx > midIdx &&
    lotIdx > foesIdx && logIdx > lotIdx && actIdx > logIdx,
    "expected strictly increasing order: pending -> header -> cb-mid -> foes -> lot -> log -> cb-act",
  );
});

// ─── b. Three bands in CSS ──────────────────────────────────────────────────

test("CSCR-01: .cb-head/.cb-mid/.cb-act and the dark panel mode carry the mock's exact values", () => {
  const headRule = HTML.match(/\.cb-head\{([^}]*)\}/);
  assert.ok(headRule, ".cb-head{...} rule must exist");
  assert.match(headRule[1], /flex:none/);
  assert.match(headRule[1], /border-bottom:3px solid #6b2c22/);
  assert.match(headRule[1], /background:#1e120f/);

  const midRule = HTML.match(/\.cb-mid\{([^}]*)\}/);
  assert.ok(midRule, ".cb-mid{...} rule must exist");
  assert.match(midRule[1], /flex:1/);
  assert.match(midRule[1], /overflow:auto/);
  assert.match(midRule[1], /min-height:0/);

  const actRule = HTML.match(/\.cb-act\{([^}]*)\}/);
  assert.ok(actRule, ".cb-act{...} rule must exist");
  assert.match(actRule[1], /flex:none/);
  assert.match(actRule[1], /border-top:3px solid #3a3226/);
  assert.match(actRule[1], /background:#1b170f/);

  const darkRule = HTML.match(/#enc-panel\[data-mode="dark"\]\{([^}]*)\}/);
  assert.ok(darkRule, '#enc-panel[data-mode="dark"]{...} rule must exist');
  assert.match(darkRule[1], /background:#120f0a/);
  assert.match(darkRule[1], /color:#e6ddc6/);

  assert.match(HTML, /#enc-panel\[data-mode="dark"\] \.enc-topbar\{display:none\}/);
});

// ─── c. Fonts (CSCR-01) ──────────────────────────────────────────────────

test("CSCR-01: no Google Fonts, three @font-face declarations, and every new label/data rule reuses the bundled faces", () => {
  const block = styleBlock();
  assert.doesNotMatch(block, /fonts\.googleapis/);
  const faceHits = block.match(/@font-face/g) || [];
  assert.equal(faceHits.length, 3, `expected exactly 3 @font-face declarations, found ${faceHits.length}`);

  const headLabelRule = HTML.match(/\.cb-head-label\{([^}]*)\}/);
  assert.ok(headLabelRule, ".cb-head-label{...} rule must exist");
  assert.match(headLabelRule[1], /var\(--disp\)/);

  const logTextRule = HTML.match(/\.cb-log-text\{([^}]*)\}/);
  assert.ok(logTextRule, ".cb-log-text{...} rule must exist");
  assert.match(logTextRule[1], /var\(--mono\)/);

  const rootRule = HTML.match(/:root\{([\s\S]*?)\n\}/);
  assert.ok(rootRule, ":root{...} rule must exist");
  assert.match(rootRule[1], /--disp:"Press Start 2P"/);
  assert.match(rootRule[1], /--mono:"Courier Prime"/);
});

// ─── d. Foe cards (CSCR-02) ─────────────────────────────────────────────

test("CSCR-02: renderFoeCards builds every card field via textContent/className, guards the live-card tap exactly once, and carries no innerHTML", () => {
  const region = fnRegion("function renderFoeCards(host, vm, onPick)");
  for (const needle of ["cb-foe-glyph", "cb-foe-name", "cb-foe-meta", "cb-foe-wp", "cb-foe-tag", "cb-bar-fill"]) {
    assert.match(region, new RegExp(needle), `renderFoeCards must reference ${needle}`);
  }
  assert.match(region, /dataset\.foe|data-foe/);
  const guardHits = region.match(/guardTap\(el, \(\) => onPick\(/g) || [];
  assert.equal(guardHits.length, 1, "guardTap(el, () => onPick( must appear exactly once");
  assert.match(region, /el\.tabIndex = 0/);
  assert.doesNotMatch(region, /innerHTML/);
});

test("CSCR-02/08 (Decision 3): the combat branch mutates S.combat.target through a guarded onPick, chip source stays foeStatusBadges, and no retarget-flavoured literal remains anywhere", () => {
  const region = renderEncounterRegion();
  const targetHits = region.match(/S\.combat\.target = i; renderEncounter\(\);/g) || [];
  assert.equal(targetHits.length, 1, "S.combat.target = i; renderEncounter(); must appear exactly once");
  const chipHits = region.match(/chipsFor: \(f\) => foeStatusBadges\(f\)\.map\(\(b\) => b\.t\)/g) || [];
  assert.equal(chipHits.length, 1, "the chipsFor callback must appear exactly once");
  assert.doesNotMatch(CODE, /C\.target = i; renderEncounter\(\);/);
  assert.doesNotMatch(CODE, /[Rr]etarget/);
});

// ─── e. YOUR LOT (CSCR-03) ────────────────────────────────────────────────

test("CSCR-03: renderYourLot builds the scrollable strip via textContent/className/dataset with no innerHTML", () => {
  const region = fnRegion("function renderYourLot(host, vm)");
  for (const needle of ["cb-lot-strip", "cb-lot-card", "cb-lot-name", "cb-lot-wp", "cb-lot-fill", "cb-lot-third"]) {
    assert.match(region, new RegExp(needle), `renderYourLot must reference ${needle}`);
  }
  assert.match(region, /dataset\.overflow/);
  assert.doesNotMatch(region, /innerHTML/);
});

test("CSCR-03: .cb-lot-strip overflows horizontally, the active card is gold, and the low-hp fill is red", () => {
  const stripRule = HTML.match(/\.cb-lot-strip\{([^}]*)\}/);
  assert.ok(stripRule, ".cb-lot-strip{...} rule must exist");
  assert.match(stripRule[1], /overflow-x:auto/);

  const activeRule = HTML.match(/\.cb-lot-card\.active\{([^}]*)\}/);
  assert.ok(activeRule, ".cb-lot-card.active{...} rule must exist");
  assert.match(activeRule[1], /border-color:#e8c97a/);

  assert.match(HTML, /\.cb-lot-fill\.low\{background:#e05a48\}/);
});

// ─── f. MAJOR OVERLAY (CSCR-06, Decision 2) ──────────────────────────────

test("CSCR-06 (Decision 2): renderMajorOverlay exists before renderEncounter and builds the icon/title/line/roll/actions column with a guarded, optional secondary button, no innerHTML", () => {
  assert.match(helpersRegion(), /function renderMajorOverlay\(host, spec\)/);
  const region = fnRegion("function renderMajorOverlay(host, spec)");
  for (const needle of ["mw-major-icon", "mw-major-title", "mw-major-line", "mw-major-roll", "mw-major-actions"]) {
    assert.match(region, new RegExp(needle), `renderMajorOverlay must reference ${needle}`);
  }
  assert.match(region, /"mw-major-primary"/);
  const primaryGuardHits = region.match(/guardTap\(document\.getElementById\("mw-major-primary"\)/g) || [];
  assert.equal(primaryGuardHits.length, 1, 'guardTap(document.getElementById("mw-major-primary") must appear exactly once');
  const secondaryHits = region.match(/spec\.secondary/g) || [];
  assert.ok(secondaryHits.length >= 2, "spec.secondary must be referenced at least twice (the Phase 35 hook)");
  assert.doesNotMatch(region, /innerHTML/);
  // 2026-09-17 UAT ruling: the overlay shows the tile's actual PNG when the
  // spec carries an iconKey; specs without one keep the glyph path.
  assert.match(region, /if \(spec\.iconKey\) \{/);
  assert.match(region, /img\.className = "mw-major-icon-img";/);
  assert.match(region, /img\.src = featureIconSrc\(spec\.iconKey\);/);
  assert.match(region, /else \{ icon\.textContent = spec\.icon; \}/);
  assert.match(COMBAT_PANEL_SRC, /iconKey: "encounter",/);
  assert.match(HTML, /^\.mw-major-icon-img\{width:60px;height:60px;object-fit:contain;display:block\}$/m);
});

test("CSCR-06: the pending gate renders the overlay from encounterOverlaySpec, maps its dispatch to window.mzFight, and returns before any combat-panel band", () => {
  const region = combatBranch();
  assert.match(region, /window\.__mzCombatVM\.overlay\(S\)/);
  assert.match(region, /onTap: \(\) => window\.mzFight\?\.\(\)/);
  const pendingStart = region.indexOf("if (C.pending)");
  assert.ok(pendingStart !== -1, "if (C.pending) must exist in the combat branch");
  const braceEnd = region.indexOf("}", region.indexOf("return;", pendingStart));
  const pendingBlock = region.slice(pendingStart, braceEnd + 1);
  assert.match(pendingBlock, /return;/);
  const headerAfterPending = region.indexOf("renderCombatHeader(", braceEnd);
  assert.ok(headerAfterPending > braceEnd, "renderCombatHeader must come after the pending block's return");
  assert.doesNotMatch(CODE, /"a-fight"/);
});

// ─── g. Keys (CSCR-06) ────────────────────────────────────────────────────

test("CSCR-06: keydown reads S.combat.pending, dispatches window.mzFight only on Enter/Space, and the arm check stays the S.combat branch's first statement", () => {
  const region = keydownRegion();
  assert.match(region, /S\.combat\.pending/);
  assert.match(region, /window\.mzFight\?\.\(\)/);
  assert.doesNotMatch(region, /k === "1"\) \{ e\.preventDefault\(\); window\.mzFight/);

  const combatIdx = region.indexOf("if (S.combat) {");
  assert.ok(combatIdx !== -1, "if (S.combat) { must exist in the keydown handler");
  const afterCombat = region.slice(combatIdx + "if (S.combat) {".length);
  const firstStatement = afterCombat.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  assert.equal(firstStatement, "if (!encArmed()) return;");
});

// ─── h. Guards (CSCR-08) ──────────────────────────────────────────────────

test("CSCR-08: the render-helpers + renderEncounter region carries no tap-anywhere-to-dismiss listener", () => {
  const region = sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
  for (const bad of [/card\.onclick/, /body\.onclick/, /panel\.onclick/, /body\.addEventListener/, /panel\.addEventListener/, /card\.addEventListener/]) {
    assert.doesNotMatch(region, bad);
  }
});

test("CSCR-08: the guard-helper region carries no transition/animation token", () => {
  const region = guardHelpersRegion();
  assert.doesNotMatch(region, /transition/i);
  assert.doesNotMatch(region, /animation/i);
});

test("CSCR-08: the <style> block carries no aria-disabled selector, and no transitionend/animationend listener exists anywhere", () => {
  assert.doesNotMatch(styleBlock(), /aria-disabled/);
  assert.doesNotMatch(CODE, /transitionend/i);
  assert.doesNotMatch(CODE, /animationend/i);
});

// ─── i. Bridge + imports ──────────────────────────────────────────────────

test("the module imports combatPanel.js/combatMenu.js once each and bridges window.__mzCombatVM exactly once", () => {
  const combatPanelImportHits = CODE.match(/from "\.\/src\/browser\/combatPanel\.js"/g) || [];
  assert.equal(combatPanelImportHits.length, 1, "combatPanel.js must be imported exactly once");
  const combatMenuImportHits = CODE.match(/from "\.\/src\/browser\/combatMenu\.js"/g) || [];
  assert.equal(combatMenuImportHits.length, 1, "combatMenu.js must be imported exactly once");
  const bridgeHits = CODE.match(/window\.__mzCombatVM = \{/g) || [];
  assert.equal(bridgeHits.length, 1, "window.__mzCombatVM bridge must be assigned exactly once");
});

// ─── j. Ally folded into YOUR LOT ─────────────────────────────────────────

test("CSCR-03: the old ally-as-foe-card markup is gone; the ally now folds into YOUR LOT via combatPanel.js's allyThird", () => {
  assert.doesNotMatch(CODE, /className = "foe ally"/);
  assert.doesNotMatch(CODE, /Fighting for you ·/);
  assert.match(COMBAT_PANEL_SRC, /allyThird/);
});
