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
});

test("CMB-01: the keydown handler's Fight! gate reads S.combat.pending", () => {
  const keydownRegion = region('addEventListener("keydown"', "addEventListener(\"resize\"");
  assert.match(keydownRegion, /S\.combat\.pending/);
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
