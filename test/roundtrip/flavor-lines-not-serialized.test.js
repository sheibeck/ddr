// test/roundtrip/flavor-lines-not-serialized.test.js
//
// Phase 96 (Engine Gate; CONTEXT 'Established Patterns'): the standing guard
// that no flavour line is ever a serialized field, for EVERY flavour domain
// present. Flavour is keyed beside the content and looked up by name at draw
// time (src/browser/flavorText.js); a flavour map on a row, or a flavour copy
// on the run, would leak into every save. This reads everyFlavorLine(), so each
// domain added later (sub-class, ability, skill, chip) is covered with no edit.
//
// For seeds 1 to 5 and each class: build a run, serialize it, and assert that
// no flavour line occurs in the JSON and that no object key named flavor or
// flavour exists anywhere in the parsed tree.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { serializeRun } from "../../engine/saveState.js";
import { CLASSES } from "../../content/index.js";
import { everyFlavorLine } from "../../src/browser/flavorText.js";

/** keyNames(v) — every object key in the tree under `v`. */
function keyNames(v, out = new Set()) {
  if (Array.isArray(v)) for (const x of v) keyNames(x, out);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { out.add(k); keyNames(x, out); }
  }
  return out;
}

test("the walk is live: it reads at least one flavour line", () => {
  assert.ok(everyFlavorLine().length > 0);
});

test("no flavour line and no flavor/flavour key in a serialized run (seeds 1 to 5, every class)", () => {
  const lines = everyFlavorLine().map((t) => t[2]);
  for (const cls of Object.keys(CLASSES)) {
    for (let seed = 1; seed <= 5; seed++) {
      const state = newRun(seed, [], { force: { cls } });
      const json = JSON.stringify(serializeRun(state));
      for (const line of lines) assert.ok(!json.includes(line), `seed ${seed} ${cls}: a flavour line is in the serialized run: ${line}`);
      const bad = [...keyNames(JSON.parse(json))].filter((k) => /flavou?r/i.test(k));
      assert.deepEqual(bad, [], `seed ${seed} ${cls}: flavour keys in the serialized run`);
    }
  }
});

test("teeth: the walk would catch a leaked line and a leaked key", () => {
  const line = everyFlavorLine()[0][2];
  const state = newRun(1);
  state.c.leak = line;
  assert.ok(JSON.stringify(serializeRun(state)).includes(line));
  assert.deepEqual([...keyNames({ a: { b: [{ flavor: 1 }] } })].filter((k) => /flavou?r/i.test(k)), ["flavor"]);
});
