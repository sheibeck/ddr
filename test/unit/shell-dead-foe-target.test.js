// test/unit/shell-dead-foe-target.test.js
//
// Phase 36 Plan 03 (TGT-01/TGT-02) — mazeworld.html has no module surface a
// test could import directly, so — mirroring shell-input-guards.test.js /
// shell-combat-screen.test.js's own source-assertion pattern — this file
// reads the real shipped source with fs.readFileSync and asserts against it
// directly:
//   1. the module import + the one post-dispatch normalizeTarget(state.combat)
//      call, placed between window.__mzState.set(state); and
//      window.renderEncounter() inside engineCombatAction;
//   2. renderFoeCards' dead-card else-branch (aria-disabled only, no role/
//      tabIndex/handler) and the live branch's unchanged guardTap/tabIndex
//      wiring, with no innerHTML;
//   3. armEncounterButtons' :not(.cb-foe.dead) sweep exclusion, and the
//      <style> block still carries no aria-disabled selector;
//   4. the Decision-3 pin restated (S.combat.target = i; renderEncounter();
//      exactly once) and the forbidden re-aim compound word absent from the
//      whole comment-stripped file;
//   5. a DOM-free SIMULATION of Pitfall 10's arm-window race: a kill +
//      normalize refreshes the renderedAt stamp, a tap inside ARM_DELAY_MS
//      is refused, a tap on a live card at/after the window sets the
//      target, and the dead card exposes no handler at all;
//   6. normalize never moves the aim off a still-live target when a
//      DIFFERENT foe dies.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { isArmed, ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { normalizeTarget } from "../../engine/combat.js";
import { foeListViewModel } from "../../src/browser/combatPanel.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — same
// order-sensitive approach as shell-input-guards.test.js / shell-combat-
// screen.test.js) ───────────────────────────────────────────────────────
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

function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function engineCombatActionRegion() {
  return sliceBetween(CODE, "function engineCombatAction(type, extra) {", "window.mzAttack = ");
}

function armEncounterButtonsRegion() {
  return fnRegion("function armEncounterButtons()");
}

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}

/* ============================================================
 * (a) module import + the one post-dispatch normalizeTarget call
 * ============================================================ */

test('the module import line "import { normalizeTarget } from "./engine/combat.js";" appears exactly once', () => {
  const hits = CODE.match(/import \{ normalizeTarget \} from "\.\/engine\/combat\.js";/g) || [];
  assert.equal(hits.length, 1);
});

test("engineCombatAction: normalizeTarget(state.combat) occurs exactly once, between the state swap and the re-render", () => {
  const region = engineCombatActionRegion();
  const hits = region.match(/normalizeTarget\(state\.combat\)/g) || [];
  assert.equal(hits.length, 1, "normalizeTarget(state.combat) must appear exactly once in engineCombatAction");
  const setIdx = region.indexOf("window.__mzState.set(state);");
  const normIdx = region.indexOf("normalizeTarget(state.combat)");
  const renderIdx = region.lastIndexOf("window.renderEncounter();");
  assert.ok(setIdx !== -1, "window.__mzState.set(state); not found");
  assert.ok(renderIdx !== -1, "window.renderEncounter(); not found");
  assert.ok(setIdx < normIdx, "normalizeTarget must run AFTER the state swap");
  assert.ok(normIdx < renderIdx, "normalizeTarget must run BEFORE the re-render");
});

/* ============================================================
 * (b) renderFoeCards: dead-card else branch, live branch unchanged
 * ============================================================ */

test("renderFoeCards: the dead-card else branch sets aria-disabled only, with no role/tabIndex/handler", () => {
  const region = fnRegion("function renderFoeCards(host, vm, onPick)");
  const ifIdx = region.indexOf("if (c.alive) {");
  assert.ok(ifIdx !== -1, "if (c.alive) { not found");
  const elseIdx = region.indexOf("} else {", ifIdx);
  assert.ok(elseIdx !== -1, "the dead-card else branch must directly follow the alive branch");
  const elseBlockEnd = region.indexOf("}", elseIdx + "} else {".length);
  const elseBlock = region.slice(elseIdx, elseBlockEnd);
  assert.match(elseBlock, /el\.setAttribute\("aria-disabled", "true"\)/);
  assert.doesNotMatch(elseBlock, /el\.tabIndex/);
  assert.doesNotMatch(elseBlock, /setAttribute\("role"/);
  assert.doesNotMatch(elseBlock, /guardTap\(/);
  assert.doesNotMatch(elseBlock, /onkeydown/);
});

test("renderFoeCards: the live branch's guardTap/tabIndex wiring is unchanged (exactly once each), no innerHTML anywhere", () => {
  const region = fnRegion("function renderFoeCards(host, vm, onPick)");
  const guardHits = region.match(/guardTap\(el, \(\) => onPick\(/g) || [];
  assert.equal(guardHits.length, 1, "guardTap(el, () => onPick( must appear exactly once");
  const tabHits = region.match(/el\.tabIndex = 0/g) || [];
  assert.equal(tabHits.length, 1, "el.tabIndex = 0 must appear exactly once");
  assert.doesNotMatch(region, /innerHTML/);
});

/* ============================================================
 * (c) armEncounterButtons sweep exclusion + no CSS aria-disabled rule
 * ============================================================ */

test("armEncounterButtons: the arm-window sweep excludes .cb-foe.dead exactly once", () => {
  const region = armEncounterButtonsRegion();
  const hits = region.match(/:not\(\.cb-foe\.dead\)/g) || [];
  assert.equal(hits.length, 1);
});

test("the <style> block carries no aria-disabled selector (dead cards style via .cb-foe.dead, not CSS aria-disabled)", () => {
  const styleStart = HTML.indexOf("<style>");
  const styleEnd = HTML.indexOf("</style>", styleStart);
  assert.ok(styleStart !== -1 && styleEnd !== -1);
  const styleBlock = HTML.slice(styleStart, styleEnd);
  assert.doesNotMatch(styleBlock, /aria-disabled/);
});

/* ============================================================
 * (d) Decision-3 pin restated + forbidden compound word absent
 * ============================================================ */

test("Decision 3 restated: S.combat.target = i; renderEncounter(); appears exactly once in the renderEncounter region", () => {
  const region = renderEncounterRegion();
  const hits = region.match(/S\.combat\.target = i; renderEncounter\(\);/g) || [];
  assert.equal(hits.length, 1);
});

test("no re-aim compound word (built from parts so this file never spells it) appears anywhere in the source", () => {
  const forbidden = new RegExp("[Rr]e" + "target");
  assert.doesNotMatch(CODE, forbidden);
});

/* ============================================================
 * (e) SIMULATION — Pitfall 10's arm-window race, no DOM
 * ============================================================ */

test("SIMULATION: kill + normalize settles the aim, a tap inside ARM_DELAY_MS is refused, a tap on a live card at/after the window lands, the dead card has no handler", () => {
  const foeA = { name: "A", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  const foeB = { name: "B", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  const C = { foes: [foeA, foeB], target: 0, round: 1, spellOpen: false, tracked: false };

  // Foe A (the current target) dies.
  foeA.alive = false;
  foeA.wp = 0;

  // The shell's post-dispatch call (mirrors engineCombatAction).
  normalizeTarget(C);
  assert.equal(C.target, 1, "target must settle on foe B, the sole survivor");

  const vm = foeListViewModel({ combat: C });
  assert.equal(vm.cards[0].alive, false);
  assert.equal(vm.cards[0].state, "dead");
  assert.equal(vm.cards[1].targeted, true);

  // The re-render that follows the normalize stamps a fresh renderedAt
  // (armEncounterButtons() in the real shell).
  const renderedAt = 1000;

  // A DOM-free mirror of renderFoeCards' wiring: a handler exists ONLY for
  // an alive card (guardTap-equivalent), exactly matching the real
  // if (c.alive) { ... } else { aria-disabled only } branch.
  const clickHandlers = vm.cards.map((card) => (card.alive ? (i, now) => (isArmed(renderedAt, now) ? i : null) : null));

  // A tap on the dead card (index 0) is impossible by construction — no
  // handler was ever attached.
  assert.equal(clickHandlers[0], null, "a dead card must carry no click handler at all");

  // A tap on the live card (index 1) arriving INSIDE the arm window is
  // refused — the simulated handler returns null (guardTap's real
  // equivalent: the tap is swallowed, target is left unchanged).
  const insideWindowNow = renderedAt + ARM_DELAY_MS - 1;
  const resultInside = clickHandlers[1](1, insideWindowNow);
  assert.equal(resultInside, null, "a tap inside ARM_DELAY_MS must be refused");
  assert.equal(C.target, 1, "a refused tap must never change the target");

  // A tap on the live card AT/AFTER the arm window lands and sets the
  // target to the tapped index.
  const atWindowNow = renderedAt + ARM_DELAY_MS;
  const resultAtWindow = clickHandlers[1](1, atWindowNow);
  assert.equal(resultAtWindow, 1, "a tap at/after ARM_DELAY_MS must be armed");
  C.target = resultAtWindow;
  assert.equal(C.target, 1);

  // Even a forced bogus assignment onto the dead foe's index is corrected
  // right back by the next normalize — the belt-and-braces engine rule.
  C.target = 0;
  normalizeTarget(C);
  assert.equal(C.target, 1, "normalizeTarget must restore the live target even after a bogus assignment");
});

/* ============================================================
 * (f) normalize never jumps the aim off a still-live target
 * ============================================================ */

test("two live foes, kill the NON-target: normalize leaves the aim unchanged", () => {
  const foeA = { name: "A", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  const foeB = { name: "B", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1 };
  const C = { foes: [foeA, foeB], target: 0, round: 1, spellOpen: false, tracked: false };

  // Foe B (NOT the target) dies.
  foeB.alive = false;
  foeB.wp = 0;

  normalizeTarget(C);
  assert.equal(C.target, 0, "a still-live target must never be moved off");
});
