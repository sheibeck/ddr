// test/unit/firestore-transition-rules.test.js
//
// Phase 87 (BOARD-28) DEPTH-key transition. Shipped 2.2.0 (vc12) clients write
// deepKey with the OLD formula (floor * 1e6 + (999999 - steps), fewer steps
// first). The final rules (firebase/firestore.rules) only accept the NEW
// formula (floor * 1e6 + steps), so deploying them alone would refuse every
// run a vc12 client submits. firebase/firestore.transition.rules is the final
// rules with exactly ONE clause swapped (isValidBoardRun's deepKey line) to
// accept either formula, computed from the doc's own floor and steps, and
// nothing else. This file proves that, so the two rules files can never
// silently drift while the transition config is the deployed one.
//
// DELETE this file, firebase/firestore.transition.rules and
// firebase.transition.json at the 2.3 cutover (docs/RELEASING.md, Release 2.3.0).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { deepKeyOf, legacyDeepKeyOf, buildRunDoc, validateRunDoc } from "../../src/browser/runDoc.js";
import { newRun } from "../../engine/state.js";
import { buildRunSummary } from "../../engine/death.js";
import { rollHandle } from "../../src/browser/handles.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FINAL_PATH = path.join(REPO_ROOT, "firebase", "firestore.rules");
const TRANSITION_PATH = path.join(REPO_ROOT, "firebase", "firestore.transition.rules");
const TRANSITION_JSON_PATH = path.join(REPO_ROOT, "firebase.transition.json");

function normalize(text) {
  return text.replace(/\r\n/g, "\n");
}

/** stripTransitionHeader(text) — removes the "=== TRANSITION HEADER BEGIN/END ===" comment block, inclusive. */
function stripTransitionHeader(text) {
  const beginMarker = "// === TRANSITION HEADER BEGIN ===";
  const endMarker = "// === TRANSITION HEADER END ===";
  const beginIdx = text.indexOf(beginMarker);
  const endIdx = text.indexOf(endMarker);
  assert.ok(beginIdx >= 0, "transition file must contain the header BEGIN marker");
  assert.ok(endIdx >= 0, "transition file must contain the header END marker");
  const before = text.slice(0, beginIdx);
  const after = text.slice(endIdx + endMarker.length);
  // `before` already ends in the blank line that follows `rules_version`, so
  // drop every newline right after the END marker rather than just one.
  return before + after.replace(/^\n+/, "");
}

const FINAL_DEEP_CLAUSE = "        && d.deepKey is int && d.deepKey == deepKeyOf(d)";
const TRANSITION_DEEP_CLAUSE =
  "        && d.deepKey is int && (d.deepKey == deepKeyOf(d) || d.deepKey == d.floor * 1000000 + (999999 - d.steps))";

test("firestore.transition.rules equals firestore.rules with exactly the deepKey clause swapped (header excluded)", () => {
  const finalText = normalize(fs.readFileSync(FINAL_PATH, "utf8"));
  const transitionRaw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  const transitionText = stripTransitionHeader(transitionRaw);

  assert.equal(finalText.split(FINAL_DEEP_CLAUSE).length - 1, 1, "the final rules must contain the exact deepKey clause once");
  assert.equal(transitionRaw.split(TRANSITION_DEEP_CLAUSE).length - 1, 1, "the transition rules must contain the two-formula clause once");

  const expected = finalText.replace(FINAL_DEEP_CLAUSE, TRANSITION_DEEP_CLAUSE);
  assert.equal(transitionText, expected, "byte-identical to the final rules apart from the header and the deepKey clause");
});

test("the transition header block sits right after rules_version and names its purpose and deletion point", () => {
  const raw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  assert.ok(raw.startsWith("rules_version = '2';\n\n// === TRANSITION HEADER BEGIN ===\n"));
  const header = raw.slice(raw.indexOf("// === TRANSITION HEADER BEGIN ==="), raw.indexOf("// === TRANSITION HEADER END ==="));
  assert.match(header, /Phase 87/);
  assert.match(header, /BOARD-28/);
  assert.match(header, /firebase\.transition\.json/);
  assert.match(header, /firestore-transition-rules\.test\.js/);
  assert.match(header, /Release 2\.3\.0/);
});

// Evaluate the transition clause's expression in JS with runDoc.js's deepKeyOf bound.
function transitionExpression() {
  const marker = "d.deepKey is int && ";
  const at = TRANSITION_DEEP_CLAUSE.indexOf(marker);
  assert.ok(at >= 0);
  return TRANSITION_DEEP_CLAUSE.slice(at + marker.length);
}

test("transition deep clause accepts the old and the new formula and refuses every third value (T-87-01)", () => {
  const expr = transitionExpression();
  const accepts = new Function("d", "deepKeyOf", `return ${expr};`);
  const floors = [1, 2, 5, 13, 200];
  const stepsList = [0, 1, 250, 499999, 500000, 999998, 999999];
  for (const floor of floors) {
    for (const steps of stepsList) {
      const base = { floor, steps };
      const newKey = deepKeyOf(base);
      const oldKey = legacyDeepKeyOf(base);
      assert.equal(accepts({ ...base, deepKey: newKey }, deepKeyOf), true, `new ${JSON.stringify(base)}`);
      assert.equal(accepts({ ...base, deepKey: oldKey }, deepKeyOf), true, `old ${JSON.stringify(base)}`);
      const thirds = [0, newKey + 1, newKey - 1, oldKey + 1, oldKey - 1, floor * 1000000 - 1];
      for (const third of thirds) {
        if (third === newKey || third === oldKey) continue; // filtered: equals one of the two accepted formulas
        assert.equal(accepts({ ...base, deepKey: third }, deepKeyOf), false, `third ${third} for ${JSON.stringify(base)}`);
      }
    }
  }
});

test("a run doc shaped like the shipped 2.2.0 (vc12) client builds it passes the transition clause and differs from a 2.3 doc only in deepKey", () => {
  const summary = buildRunSummary(newRun(3), "combat", 0);
  const built = buildRunDoc(summary, { uid: "u1", handle: rollHandle(() => 0.15, null), version: "2.2.0 (12)" });
  assert.equal(built.ok, true, JSON.stringify(built));
  const doc23 = built.doc;
  const docVc12 = { ...doc23, deepKey: legacyDeepKeyOf(doc23) };

  assert.deepEqual(validateRunDoc(doc23), []);
  assert.deepEqual(validateRunDoc(docVc12), ["deepkey"], "the final rules refuse the vc12 doc");
  const accepts = new Function("d", "deepKeyOf", `return ${transitionExpression()};`);
  assert.equal(accepts(docVc12, deepKeyOf), true, "the transition rules accept the vc12 doc");
  assert.equal(accepts(doc23, deepKeyOf), true, "the transition rules accept the 2.3 doc");

  const diff = Object.keys(doc23).filter((k) => JSON.stringify(doc23[k]) !== JSON.stringify(docVc12[k]));
  assert.deepEqual(diff, ["deepKey"]);
});

test("firebase.transition.json points at firebase/firestore.transition.rules and the same indexes file as firebase.json", () => {
  const transitionJson = JSON.parse(fs.readFileSync(TRANSITION_JSON_PATH, "utf8"));
  const finalJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "firebase.json"), "utf8"));
  assert.equal(transitionJson.firestore.rules, "firebase/firestore.transition.rules");
  assert.equal(transitionJson.firestore.indexes, finalJson.firestore.indexes);
  assert.ok(fs.existsSync(TRANSITION_PATH));
});
