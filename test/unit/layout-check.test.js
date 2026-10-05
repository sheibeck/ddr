// test/unit/layout-check.test.js
//
// Phase 97 (SCREEN-03..06): pins the pure parts of tools/layout-check.mjs, the
// CDP layout check: its profile list, its boundary probes and its overlap
// rule. Importing the module must not start Chrome or a server.

import test from "node:test";
import assert from "node:assert/strict";
import { PROFILES, BOUNDARY_PROBES, SCENES, rectsIntersect } from "../../tools/layout-check.mjs";
import { layoutClassFor } from "../../src/browser/layoutClass.js";

test("every profile's expected class is what layoutClassFor says", () => {
  for (const p of PROFILES) {
    assert.equal(layoutClassFor(p.width, p.height), p.expect, `${p.name} ${p.width}x${p.height}`);
  }
});

test("the twelve named profiles exist, each class at least twice", () => {
  const names = PROFILES.map((p) => p.name);
  for (const n of [
    "phone-portrait",
    "phone-landscape",
    "phone-landscape-360",
    "tablet7-portrait",
    "tablet7-landscape",
    "tablet10-portrait",
    "tablet10-landscape",
    "foldable-folded",
    "foldable-unfolded",
    "foldable-unfolded-portrait",
    "chromebook-window",
    "chromebook-half",
  ]) {
    assert.ok(names.includes(n), `missing profile ${n}`);
  }
  assert.equal(PROFILES.length, 12);
  assert.equal(new Set(names).size, 12);
  for (const cls of ["short", "compact", "medium", "expanded"]) {
    assert.ok(PROFILES.filter((p) => p.expect === cls).length >= 2, `class ${cls} needs two profiles`);
  }
  assert.ok(Object.isFrozen(PROFILES));
  const sizes = Object.fromEntries(PROFILES.map((p) => [p.name, `${p.width}x${p.height}`]));
  assert.equal(sizes["phone-portrait"], "412x915");
  assert.equal(sizes["phone-landscape-360"], "800x360");
  assert.equal(sizes["foldable-unfolded"], "841x701");
  assert.equal(sizes["chromebook-half"], "683x768");
  assert.equal(PROFILES.find((p) => p.name === "chromebook-window").mobile, false);
  assert.equal(PROFILES.find((p) => p.name === "chromebook-half").mobile, false);
});

test("every boundary probe's expected class is what layoutClassFor says, and each threshold and neighbour is probed", () => {
  for (const p of BOUNDARY_PROBES) {
    assert.equal(layoutClassFor(p.width, p.height), p.expect, `${p.name}`);
  }
  assert.equal(BOUNDARY_PROBES.length, 7);
  const names = BOUNDARY_PROBES.map((p) => p.name);
  for (const n of ["915x479", "915x480", "599x900", "600x900", "839x900", "840x900", "840x479"]) {
    assert.ok(names.includes(n), `missing probe ${n}`);
  }
});

test("the scene list covers every screen the run conventions name", () => {
  assert.deepEqual([...SCENES], [
    "title", "roller", "map", "map-card", "settings", "hero", "gear", "oracle", "dead",
    "encounter", "combat", "combat-turn", "store", "store-turn", "camp",
  ]);
});

test("rectsIntersect: touching edges are no overlap, sub-pixel slivers too", () => {
  const a = { left: 0, top: 0, right: 10, bottom: 10 };
  assert.equal(rectsIntersect(a, { left: 10, top: 0, right: 20, bottom: 10 }), false);
  assert.equal(rectsIntersect(a, { left: 9.5, top: 0, right: 20, bottom: 10 }), true);
  assert.equal(rectsIntersect(a, { left: 9.6, top: 0, right: 20, bottom: 10 }), false);
  assert.equal(rectsIntersect(a, { left: 30, top: 30, right: 40, bottom: 40 }), false);
  assert.equal(rectsIntersect(a, { left: 2, top: 2, right: 4, bottom: 4 }), true);
  assert.equal(rectsIntersect({ left: 2, top: 2, right: 4, bottom: 4 }, a), true);
  assert.equal(rectsIntersect(a, { left: 5, top: 5, right: 5, bottom: 8 }), false);
  assert.equal(rectsIntersect(a, { left: 0, top: 10, right: 10, bottom: 20 }), false);
});
