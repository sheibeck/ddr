// Task 1 — the engine contract & its purity guard (ENG-01).
//
// Proves the single applyAction boundary loads and runs in a bare Node context
// with zero DOM globals, that the whole engine/ tree references no DOM/render/
// storage/Math.random on any non-comment line, that input validation makes
// unknown/malformed actions safe no-ops, and that newRun's GameState is
// JSON-serializable.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { applyAction, newRun } from "../../engine/engine.js";
import { validateAction } from "../../engine/actions.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_DIR = path.join(REPO_ROOT, "engine");

// --- bare-context sanity ----------------------------------------------------

test("engine loads and runs with no DOM globals defined", () => {
  // node:test runs in a plain Node context — no document/window/localStorage
  // exist. If any engine module referenced them at import time this file would
  // already have failed to load; assert the environment explicitly too.
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  assert.equal(typeof localStorage, "undefined");

  const state = newRun(12345);
  const { state: next, events } = applyAction(state, { type: "camp" });
  assert.ok(next, "applyAction returns a state");
  assert.ok(Array.isArray(events), "applyAction returns an events array");
});

// --- static purity guard ----------------------------------------------------

/** Recursively collect every .js file under `dir`. */
function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** Strip block + line comments, keeping line count stable for reporting. */
function stripComments(source) {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  return noBlock.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
}

test("engine/ references no DOM/render/storage/Math.random on any code line", () => {
  const forbidden = [
    { label: "document", re: /\bdocument\b/ },
    { label: "window", re: /\bwindow\b/ },
    { label: "localStorage", re: /\blocalStorage\b/ },
    { label: "Math.random", re: /Math\.random/ },
    { label: "console.", re: /console\./ },
  ];
  const offenses = [];
  for (const file of collectJsFiles(ENGINE_DIR)) {
    const lines = stripComments(fs.readFileSync(file, "utf8"));
    lines.forEach((line, i) => {
      for (const { label, re } of forbidden) {
        if (re.test(line)) {
          offenses.push(`${path.relative(REPO_ROOT, file)}:${i + 1} [${label}]: ${line.trim()}`);
        }
      }
    });
  }
  assert.deepStrictEqual(offenses, [], `Forbidden engine references:\n${offenses.join("\n")}`);
});

// --- input validation / safe no-ops -----------------------------------------

test("validateAction rejects malformed actions", () => {
  assert.equal(validateAction(null).ok, false);
  assert.equal(validateAction(42).ok, false);
  assert.equal(validateAction([]).ok, false);
  assert.equal(validateAction({ type: "no-such-action" }).ok, false);
  assert.equal(validateAction({ type: "move", dir: "X" }).ok, false);
  assert.equal(validateAction({ type: "move", dir: "N" }).ok, true);
  assert.equal(validateAction({ type: "buyItem", idx: -1 }).ok, false);
  assert.equal(validateAction({ type: "buyItem", idx: 0 }).ok, true);
});

// LO-01 regression: castSpell.idx/useItem.i now apply the same non-negative
// integer guard buyItem.idx always used, for a consistent index contract
// across every action type.
test("LO-01: validateAction rejects a negative castSpell.idx / useItem.i, consistent with buyItem.idx", () => {
  assert.equal(validateAction({ type: "castSpell", idx: -1 }).ok, false);
  assert.equal(validateAction({ type: "castSpell", idx: 0 }).ok, true);
  assert.equal(validateAction({ type: "useItem", i: -1 }).ok, false);
  assert.equal(validateAction({ type: "useItem", i: 0 }).ok, true);
});

test("applyAction is a safe no-op on an unknown action", () => {
  const state = newRun(999);
  const { state: next, events } = applyAction(state, { type: "definitely-not-real" });
  assert.equal(next, state, "state is returned unchanged (same reference)");
  assert.deepStrictEqual(events, []);
});

test("applyAction is a safe no-op on a malformed move", () => {
  const state = newRun(999);
  const before = structuredClone(state);
  const { state: next, events } = applyAction(state, { type: "move", dir: "DOWN" });
  assert.equal(next, state);
  assert.deepStrictEqual(next, before, "state is unmutated");
  assert.deepStrictEqual(events, []);
});

// --- serializability --------------------------------------------------------

test("newRun produces a JSON round-trippable GameState", () => {
  const state = newRun(12345);
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.deepStrictEqual(roundTripped, state);
  // Sanity on the required shape.
  for (const key of ["version", "seed", "rngState", "c", "floor", "day", "steps", "combat", "store", "beats", "dead", "won"]) {
    assert.ok(key in state, `GameState missing field: ${key}`);
  }
  assert.equal(state.combat, null);
  assert.equal(state.store, null);
  assert.equal(state.dead, false);
  assert.equal(state.won, false);
});
