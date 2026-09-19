// test/unit/shell-fight-gate.test.js
//
// Phase 31 (CMB-01/CMB-02/CMB-04), Plan 03 — mazeworld.html has no module
// surface a test could import (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-loot-screen.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly:
//   Task 1 (CMB-01): window.mzFight is a real `fight` dispatch, the
//     renderEncounter/keydown gates read the engine's combat.pending, the
//     AMBUSH pre-death special case is gone, and no classic `function
//     fight(` shadow was added.
//   Task 2 (CMB-02/CMB-04): the CONDITION_COPY ward/afraid rows, the
//     never-disable-silently Use/Sing/Scroll buttons, and the __mzCanCast
//     bridge (see spell-menu-mirror.test.js for the cell-by-cell mirror).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, then block comments — see
// shell-toast-wiring.test.js's own doc comment for why the order matters:
// mazeworld.html has `//` comments that mention glob-style paths containing
// a literal `/*` substring) ────────────────────────────────────────────────
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

function region(startMarker, endMarker) {
  const start = CODE.indexOf(startMarker);
  const end = CODE.indexOf(endMarker, start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return CODE.slice(start, end);
}

// ─── Task 1: Fight! is a real dispatch; the preview gates on combat.pending ─

test("CMB-01: window.mzFight dispatches the engine's fight action exactly once", () => {
  const hits = CODE.match(/window\.mzFight = \(\) => engineCombatAction\("fight"\)/g) || [];
  assert.equal(hits.length, 1, "expected exactly one window.mzFight = () => engineCombatAction(\"fight\") definition");
});

test("CMB-01: renderEncounter's Fight! gate reads combat.pending, not a presentation flag", () => {
  const renderEncounterRegion = region("function renderEncounter", "function noteCombat");
  assert.match(renderEncounterRegion, /if \(C\.pending\)/);
  // Phase 34 (CSCR-06): the gate renders the MAJOR OVERLAY, not the old
  // #a-fight button inside the combat-panel markup.
  assert.match(renderEncounterRegion, /renderMajorOverlay\(body/);
  assert.doesNotMatch(renderEncounterRegion, /"a-fight"/);
});

test("CMB-01: the keydown handler's Fight! gate reads S.combat.pending", () => {
  const keydownRegion = region('addEventListener("keydown"', "addEventListener(\"resize\"");
  assert.match(keydownRegion, /S\.combat\.pending/);
  // Phase 34 (CSCR-06): only Enter/Space dispatch fight on the MAJOR
  // OVERLAY — the digit-1 shortcut is gone (1 now selects the action grid).
  assert.doesNotMatch(keydownRegion, /k === "1"\) \{ e\.preventDefault\(\); window\.mzFight/);
});

test("CMB-01: the old awaitingFight presentation flag has zero non-comment occurrences", () => {
  assert.doesNotMatch(CODE, /awaitingFight/);
});

test("CMB-01: preDeath: true appears exactly once; the AMBUSH beats.foes/combatType carry is gone", () => {
  const preDeathHits = CODE.match(/preDeath: true/g) || [];
  assert.equal(preDeathHits.length, 1);
  assert.doesNotMatch(CODE, /state\.beats\.foes/);
  assert.doesNotMatch(CODE, /state\.beats\.combatType/);
});

test("CMB-01: no classic shadow `function fight(` was added — the engine owns the fight action", () => {
  assert.doesNotMatch(CODE, /function fight\(/);
});

// ─── Task 2: the spell gate bridge, the grimoire/never-disable-silently
// shell wiring, and the ward/afraid chip copy ─────────────────────────────

test("CMB-02: CONDITION_COPY has a ward row and an afraid row and no phobia row", () => {
  assert.match(CODE, /ward:\s*\{\s*label:\s*"Shield"\s*\}/);
  assert.match(CODE, /afraid:\s*\{\s*label:\s*"Afraid",\s*unit:\s*"rds"\s*\}/);
  assert.doesNotMatch(CODE, /phobia:\s*\{\s*label:\s*"Phobia"/);
});

test("CMB-04: the cn.key === \"ward\" branch renders both hp and rds on one chip", () => {
  const wardIdx = CODE.indexOf('cn.key === "ward"');
  assert.ok(wardIdx !== -1, "the ward detail branch is missing");
  const branchRegion = CODE.slice(wardIdx, wardIdx + 200);
  assert.match(branchRegion, /hp/);
  assert.match(branchRegion, /rds/);
});

test("CMB-02: renderCarriedList's use branch no longer gates the Use button on itemReady", () => {
  assert.doesNotMatch(CODE, /itemReady\(it\)\) li\.appendChild/);
  // 260918-w4n (use-activated-only): the gate moved from a raw `it.use`
  // string to the ONE row-state rule (st.kind !== "none") — see
  // src/browser/viewModels.js#itemRowState.
  assert.match(CODE, /st\.kind !== "none"\) li\.appendChild\(mkBtn\("Use"/);
});

test("Phase 34/39: the ITEMS/ABILITIES rows never hide on readiness — combatMenu.js lists the Sing row and carried usables with enabled flags, never filters them", () => {
  const combatMenuSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "combatMenu.js"), "utf8");
  assert.match(combatMenuSrc, /enabled: singReady/);
  // Phase 39 (GEAR-02/GEAR-05): a carried/worn row's readiness moved from a
  // local `cd === 0` gate onto viewModels.js#itemRowState's cost TEXT — the
  // row itself stays `enabled: true` always (the Phase 38 ability-row
  // ruling: a tap on cooldown reaches the engine's own named refusal).
  assert.match(combatMenuSrc, /cost: itemRowState\(state, it\)\.text/);
  assert.doesNotMatch(combatMenuSrc, /enabled: cd === 0/);
  assert.doesNotMatch(combatMenuSrc, /\.filter\(\(it\) => .*itemReady/);
  assert.doesNotMatch(combatMenuSrc, /songReady\(\) \?/);
});

test("CMB-02: the spell gate bridge — window.__mzCanCast = canCast, and the classic canCast(sp) delegates to it", () => {
  assert.equal((CODE.match(/window\.__mzCanCast = canCast;/g) || []).length, 1);
  assert.equal((CODE.match(/__mzCanCast\(S, sp\)/g) || []).length, 1);
});
