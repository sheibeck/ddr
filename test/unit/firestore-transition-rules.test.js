// test/unit/firestore-transition-rules.test.js
//
// Phase 87 (BOARD-28) DEPTH-key transition, widened by Phase 91.2 (BOARD-31,
// BOARD-33, D-13) to the names gate. Shipped 2.2.0 (vc12) clients write
// deepKey with the OLD formula (floor * 1e6 + (999999 - steps), fewer steps
// first), post an anonymous-account @handle, and re-roll it with a handle-only
// update. The final rules (firebase/firestore.rules) refuse all of that: the
// new deepKey formula only, a run only under the poster's verified Play Games
// name (names/{uid}), no client update at all. Deploying them alone would drop
// every run a still-in-the-field 2.2.0 client sends during the device-test
// window. firebase/firestore.transition.rules is the final rules plus EXACTLY:
//   1. Phase 87's either-formula deepKey clause,
//   2. the isLegacyHandle function (the 2.2.0 @handle regex, verbatim),
//   3. one legacy create disjunct (an UNNAMED uid posting a 2.2.0 @handle),
//   4. the legacy handle-only update for UNNAMED owners.
// This file performs that reduction on the transition text and compares it to
// the final rules byte for byte, so the two files can never silently drift
// while the transition config is the deployed one, and proves a named uid can
// never use either legacy branch.
//
// DELETE this file, firebase/firestore.transition.rules and
// firebase.transition.json at the 2.3 cutover (docs/RELEASING.md, Release 2.3.0).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  deepKeyOf,
  legacyDeepKeyOf,
  buildRunDoc,
  validateRunDoc,
  LEGACY_HANDLE_PATTERN,
  isLegacyHandle,
} from "../../src/browser/runDoc.js";
import { newRun } from "../../engine/state.js";
import { buildRunSummary } from "../../engine/death.js";

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

/** removeOnce(text, block) — text without the one occurrence of block (asserted). */
function removeOnce(text, block, label) {
  assert.equal(text.split(block).length - 1, 1, `${label} must appear exactly once in the transition rules`);
  return text.replace(block, "");
}

/** replaceOnce(text, from, to) — text with the one occurrence of `from` replaced by `to` (asserted). */
function replaceOnce(text, from, to, label) {
  assert.equal(text.split(from).length - 1, 1, `${label} must appear exactly once`);
  return text.replace(from, () => to);
}

// The 2.2.0 (vc12) handle regex, held here as fixed history: the rolled-handle
// word tables it was built from no longer drive any rule.
const LEGACY_REGEX_LITERAL =
  "^@(lantern|moss|soot|gloom|rusty|candle|cellar|crypt|torch|mildew|cobweb|gravel|barrel|dusty|toad|slug|grub|damp|grim|shadow|ember|brine|murky|tomb|ashen|briar|hollow|wretch|musty|grave)(jaw|toe|knee|nose|boot|sock|hood|beard|elbow|spoon|ladle|mop|kettle|mitten|bonnet|knuckle|thumb|chin|shin|wrist|apron|bucket|skillet|tunic|cloak|helmet|buckle|sandal|goblet|pouch)$";

const FINAL_DEEP_CLAUSE = "        && d.deepKey is int && d.deepKey == deepKeyOf(d)";
const TRANSITION_DEEP_CLAUSE =
  "        && d.deepKey is int && (d.deepKey == deepKeyOf(d) || d.deepKey == d.floor * 1000000 + (999999 - d.steps))";

// The four additions, exactly as they sit in the transition file.
const LEGACY_FN_BLOCK = `    // Transition only (D-13): the exact 2.2.0 rolled-handle shape. Deleted with this file at the 2.3 cutover.
    function isLegacyHandle(h) {
      return h is string && h.matches('${LEGACY_REGEX_LITERAL}');
    }

`;

const LEGACY_CREATE_DISJUNCT = `
                    || (request.auth != null
                      && request.resource.data.uid == request.auth.uid
                      && runId == request.auth.uid + '_' + request.resource.data.hash
                      && isValidBoardRun(request.resource.data)
                      && isLegacyHandle(request.resource.data.handle)
                      && !isNamed(request.auth.uid)
                      && !exists(/databases/$(database)/documents/banned/$(request.auth.uid)))`;

const FINAL_UPDATE = "// D-11: no client ever updates a run (no rename path).\n      allow update: if false;";
const LEGACY_UPDATE = `// Transition only (D-13): the 2.2.0 handle-only re-roll, for an owner with no names document.
      allow update: if request.auth != null
                    && !isNamed(request.auth.uid)
                    && resource.data.uid == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['handle'])
                    && isLegacyHandle(request.resource.data.handle);`;

/** reduceToFinal(transitionRaw) — the transition text with its four additions and header taken away. */
function reduceToFinal(transitionRaw) {
  let t = stripTransitionHeader(transitionRaw);
  t = removeOnce(t, LEGACY_FN_BLOCK, "the isLegacyHandle function block");
  t = removeOnce(t, LEGACY_CREATE_DISJUNCT, "the legacy create disjunct");
  t = replaceOnce(t, LEGACY_UPDATE, FINAL_UPDATE, "the legacy update rule");
  t = replaceOnce(t, TRANSITION_DEEP_CLAUSE, FINAL_DEEP_CLAUSE, "the two-formula deepKey clause");
  return t;
}

test("firestore.transition.rules reduces to firestore.rules once the header, isLegacyHandle, the legacy create disjunct, the legacy update and the deepKey swap are taken away", () => {
  const finalText = normalize(fs.readFileSync(FINAL_PATH, "utf8"));
  const transitionRaw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));

  assert.equal(finalText.split(FINAL_DEEP_CLAUSE).length - 1, 1, "the final rules must contain the exact deepKey clause once");
  assert.equal(finalText.split(FINAL_UPDATE).length - 1, 1, "the final rules must refuse client updates once");
  assert.equal(finalText.includes("isLegacyHandle"), false, "the final rules carry no legacy branch");

  assert.equal(reduceToFinal(transitionRaw), finalText, "byte-identical to the final rules apart from the four named additions and the header");
});

test("every legacy branch in the transition rules excludes a named uid (T-91.2-14)", () => {
  const raw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  const body = stripTransitionHeader(raw);
  // The create disjunct and the update rule each carry the guard.
  assert.ok(LEGACY_CREATE_DISJUNCT.includes("&& !isNamed(request.auth.uid)"));
  assert.ok(LEGACY_UPDATE.includes("&& !isNamed(request.auth.uid)"));
  // isLegacyHandle is called from exactly those two places and nowhere else.
  const calls = body.split("isLegacyHandle(").length - 1;
  assert.equal(calls, 3, "one definition plus the create disjunct plus the update rule");
  const runsBlock = body.slice(body.indexOf("match /runs/{runId}"), body.indexOf("match /banned/{uid}"));
  const callSites = runsBlock.split("isLegacyHandle(").length - 1;
  assert.equal(callSites, 2);
  // The named path of the create rule (everything before the disjunct) still demands the verified name.
  assert.equal(body.split("handle == verifiedName(request.auth.uid)").length - 1, 1);
  assert.ok(body.indexOf("handle == verifiedName(request.auth.uid)") < body.indexOf("isLegacyHandle(request.resource.data.handle)"));
});

test("the transition header block sits right after rules_version and names its purpose and deletion point", () => {
  const raw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  assert.ok(raw.startsWith("rules_version = '2';\n\n// === TRANSITION HEADER BEGIN ===\n"));
  const header = raw.slice(raw.indexOf("// === TRANSITION HEADER BEGIN ==="), raw.indexOf("// === TRANSITION HEADER END ==="));
  assert.match(header, /Phase 87/);
  assert.match(header, /BOARD-28/);
  assert.match(header, /Phase 91\.2/);
  assert.match(header, /D-13/);
  assert.match(header, /isLegacyHandle/);
  assert.match(header, /firebase\.transition\.json/);
  assert.match(header, /firestore-transition-rules\.test\.js/);
  assert.match(header, /Release 2\.3\.0/);
});

// --- the legacy handle regex -------------------------------------------------

test("isLegacyHandle's regex equals LEGACY_HANDLE_PATTERN, which equals the literal 2.2.0 regex held in this test", () => {
  const raw = normalize(fs.readFileSync(TRANSITION_PATH, "utf8"));
  const m = /function isLegacyHandle\(h\) \{\s*return h is string && h\.matches\('([^']*)'\);\s*\}/.exec(raw);
  assert.ok(m, "isLegacyHandle must be a single string-and-matches return");
  assert.equal(m[1], LEGACY_HANDLE_PATTERN);
  assert.equal(LEGACY_HANDLE_PATTERN, LEGACY_REGEX_LITERAL);
});

test("isLegacyHandle (the JS mirror) accepts a 2.2.0 @handle and refuses a Play Games name", () => {
  assert.equal(isLegacyHandle("@mossjaw"), true);
  assert.equal(isLegacyHandle("@graveskillet"), true);
  assert.equal(isLegacyHandle("Moss Knuckle"), false);
  assert.equal(isLegacyHandle("@mossjaw "), false);
  assert.equal(isLegacyHandle("@nope"), false);
  assert.equal(isLegacyHandle(""), false);
  assert.equal(isLegacyHandle(undefined), false);
  assert.equal(isLegacyHandle(42), false);
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
  const built = buildRunDoc(summary, { uid: "u1", handle: "@mossjaw", version: "2.2.0 (12)" });
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
