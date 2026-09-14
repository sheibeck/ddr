// test/unit/foe-effect-chip.test.js
//
// Phase 19 FOE-08 / D-21 (RESEARCH Pitfall 6) — the engine-side conditionsOf
// tests (test/unit/conditions.test.js) pass with ZERO html changes: they
// only prove the engine emits `{ key: "foeEffect", polarity: "bad", kind,
// remaining }`. Nothing in the engine's own test suite can ever catch a raw
// engine key or ability id leaking onto the player's screen instead of a
// voiced label ("Weakened"/"Dazed") — so THIS file is the only automated
// guard for that. mazeworld.html has no module surface (it is not an ESM
// module the test runner can import), so — mirroring
// test/unit/foe-damage.test.js's own source-assertion pattern — this file
// reads the real source with fs.readFileSync and asserts against it directly.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { conditionsOf } from "../../engine/derived.js";
import { FOE_ABILITIES } from "../../content/foe-abilities.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");

/** A minimal character with every condition field cleared, mirroring
 * test/unit/conditions.test.js's cleanChar verbatim. */
function cleanChar(overrides = {}) {
  return {
    haste: 0, invis: 0, ether: 0, acute: 0, might: 0,
    flightLeft: 0, flightCooldown: 0,
    affliction: null, darkFor: 0,
    items: [],
    ...overrides,
  };
}

/** extractLabelMap() — pulls the FOE_EFFECT_LABEL object literal straight out
 * of the real mazeworld.html source and parses it into a plain object, so
 * every assertion below checks the ACTUAL shipped constant, not a copy. */
function extractLabelMap() {
  const m = HTML.match(/const FOE_EFFECT_LABEL = \{([^}]*)\};/);
  assert.ok(m, "FOE_EFFECT_LABEL literal missing from mazeworld.html");
  return Object.fromEntries([...m[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map((x) => [x[1], x[2]]));
}

test("D-21: FOE_EFFECT_LABEL maps exactly the debuff kinds content declares, in voice", () => {
  const map = extractLabelMap();
  assert.deepStrictEqual(map, { weakened: "Weakened", dazed: "Dazed" });

  const kinds = new Set(FOE_ABILITIES.filter((a) => a.kind === "debuff").map((a) => a.effect));
  assert.deepStrictEqual([...kinds].sort(), Object.keys(map).sort(), "a debuff kind has no label, or a label has no kind");

  for (const [key, label] of Object.entries(map)) {
    assert.ok(label.length > 0, `${key}: label must be non-empty`);
    assert.equal(label[0], label[0].toUpperCase(), `${key}: label "${label}" must be Title-case`);
    assert.notEqual(label, key, `${key}: label must not echo the raw engine key`);
  }
});

test("D-21: paintConditions resolves foeEffect through FOE_EFFECT_LABEL[cn.kind] before the generic fallback, and CONDITION_COPY carries the foeEffect row with the rounds unit", () => {
  assert.match(
    HTML,
    /cn\.key === "foeEffect" \? \(FOE_EFFECT_LABEL\[cn\.kind\] \|\| CONDITION_COPY\.foeEffect\.label\)/,
  );
  assert.match(HTML, /foeEffect:\s*\{\s*label:\s*"Hexed",\s*unit:\s*"rds"\s*\}/);

  const phobiaIdx = HTML.indexOf('cn.key === "phobia"');
  const foeEffectIdx = HTML.indexOf('cn.key === "foeEffect"');
  const fallbackIdx = HTML.indexOf("(CONDITION_COPY[cn.key]?.label || cn.key)");
  assert.ok(phobiaIdx >= 0 && foeEffectIdx >= 0 && fallbackIdx >= 0, "one of the label-chain anchors is missing");
  assert.ok(foeEffectIdx > phobiaIdx, "the foeEffect branch must come after the phobia branch");
  assert.ok(foeEffectIdx < fallbackIdx, "the foeEffect branch must come before the generic fallback");

  assert.equal((HTML.match(/cn\.key === "foeEffect"/g) || []).length, 1, "exactly one foeEffect branch, no duplicate");
});

test("D-21 end-to-end: the engine's chip descriptor for each live debuff resolves to its voice label with a numeric remaining", () => {
  const map = extractLabelMap();
  for (const [kind, rounds, wantLabel] of [
    ["weakened", 3, "Weakened"],
    ["dazed", 1, "Dazed"],
  ]) {
    const chip = conditionsOf({ c: cleanChar({ foeEffect: { kind, rounds } }) }).find((x) => x.key === "foeEffect");
    assert.ok(chip, `no foeEffect chip for kind "${kind}"`);
    assert.equal(chip.polarity, "bad");
    assert.equal(map[chip.kind], wantLabel);
    assert.equal(typeof chip.remaining, "number");
    assert.equal(chip.remaining, rounds);
  }

  const noDebuff = conditionsOf({ c: cleanChar() });
  assert.equal(noDebuff.find((x) => x.key === "foeEffect"), undefined, "a clean character must carry no foeEffect chip");
});

test("D-21 fallback: an unmapped kind would still get a family-friendly label, never the raw key", () => {
  const map = extractLabelMap();
  const fallbackMatch = HTML.match(/foeEffect:\s*\{\s*label:\s*"([^"]+)"/);
  assert.ok(fallbackMatch, "CONDITION_COPY.foeEffect fallback label missing");
  const fallback = fallbackMatch[1];
  assert.equal(fallback, "Hexed");
  assert.equal(map["unknownKind"] || fallback, "Hexed");
  assert.notEqual(fallback, "foeEffect");
});
