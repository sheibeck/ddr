// test/unit/chip-flavor.test.js
//
// Phase 96 (FLAVOR-04; CONTEXT 'Abilities and chips: Condition chips'): every
// condition chip the hero or a Joiner can show has one flavour sentence, and a
// new chip explanation can never ship without one. The shell's explanation
// tables are read out of mazeworld.html as text (the shell is a classic script,
// not importable): CONDITION_EXPLAIN, FOE_EFFECT_EXPLAIN, HERO_OUT_EXPLAIN,
// HASTE_SPELL_EXPLAIN and the Bubble-mirror ward branch of explainCondition.
// CHIP_FLAVOR needs one line per CONDITION_EXPLAIN key (the `default` sentence
// is the fallback and has none) plus one variant line for each sentence that
// differs by kind or source, and CHIP_FLAVOR_VARIANTS must be exactly that
// derived set.
//
// Also pins flavorOfChip(cn): the ability's own line for an ability chip, the
// variant lines, the plain key line, and "" for anything it cannot resolve
// (a null, a string, an array, an unknown key, an unknown ability id, a
// throwing Proxy). No chip line may equal the explanation it sits above.
//
// The slicing helper is a per-file copy of the idiom in
// test/unit/hero-conditions.test.js (never imported across tests).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FLAVOR_DOMAINS, CHIP_FLAVOR_VARIANTS, flavorOf, flavorOfChip, flavorOfAbility } from "../../src/browser/flavorText.js";
import { HERO_CONDITIONS } from "../../src/browser/heroConditions.js";
import { CHIP_FLAVOR, ABILITIES, ABILITY_BY_ID } from "../../content/index.js";

const HTML = readFileSync(new URL("../../mazeworld.html", import.meta.url), "utf8");

/** shellLiteral(name) — the text of `const name = { ... }` in the shell, brace-matched; fails by name when absent. */
function shellLiteral(name) {
  const start = HTML.indexOf(`const ${name} = {`);
  assert.ok(start !== -1, `mazeworld.html has no "const ${name} = {": the chip-flavor coverage test would go vacuous`);
  const open = HTML.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < HTML.length; i++) {
    if (HTML[i] === "{") depth++;
    else if (HTML[i] === "}") { depth--; if (depth === 0) break; }
  }
  return HTML.slice(open, i + 1);
}

/** stringMap(name, min) — the literal's `key: "text"` leaves (key bare or quoted) as a Map; at least `min` of them. */
function stringMap(name, min) {
  const m = new Map(
    [...shellLiteral(name).matchAll(/(?:"([^"]+)"|(\w+)):\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((x) => [x[1] || x[2], x[3]]),
  );
  assert.ok(m.size >= min, `${name}: expected at least ${min} entries, found ${m.size}`);
  return m;
}

const CONDITION_EXPLAIN = stringMap("CONDITION_EXPLAIN", 40);
const FOE_EFFECT_EXPLAIN = stringMap("FOE_EFFECT_EXPLAIN", 2);
const HERO_OUT_EXPLAIN = stringMap("HERO_OUT_EXPLAIN", 1);
const HASTE_SPELL_EXPLAIN = stringMap("HASTE_SPELL_EXPLAIN", 1);
// The Bubble mirror's own sentence lives in explainCondition's first branch.
const MIRROR_BRANCH = /if \(cn\.key === "ward" && cn\.mirror\) \{\s*return "([^"\\]*(?:\\.[^"\\]*)*)";/.exec(HTML);

/** derivedVariants() — the variant keys the shell's kind- and source-specific sentences require, in a stable order. */
function derivedVariants() {
  return [
    ...[...FOE_EFFECT_EXPLAIN.keys()].map((k) => `foeEffect/${k}`),
    ...[...HERO_OUT_EXPLAIN.keys()].map((k) => `heroOut/${k}`),
    ...(MIRROR_BRANCH ? ["ward/mirror"] : []),
    ...[...HASTE_SPELL_EXPLAIN.keys()].map((k) => `haste/${k}`),
  ];
}

/** explanationOf(key) — the shell sentence a CHIP_FLAVOR key sits above. */
function explanationOf(key) {
  const slash = key.indexOf("/");
  if (slash === -1) return CONDITION_EXPLAIN.get(key);
  const base = key.slice(0, slash);
  const sub = key.slice(slash + 1);
  if (base === "foeEffect") return FOE_EFFECT_EXPLAIN.get(sub);
  if (base === "heroOut") return HERO_OUT_EXPLAIN.get(sub);
  if (base === "haste") return HASTE_SPELL_EXPLAIN.get(sub);
  if (key === "ward/mirror") return MIRROR_BRANCH && MIRROR_BRANCH[1];
  return undefined;
}

test("the shell tables were found (the coverage tests cannot go vacuous)", () => {
  assert.ok(CONDITION_EXPLAIN.get("default"), "CONDITION_EXPLAIN keeps its default");
  assert.ok(MIRROR_BRANCH, "explainCondition's Bubble-mirror ward branch was found");
  assert.deepEqual([...FOE_EFFECT_EXPLAIN.keys()].sort(), ["dazed", "weakened"]);
  assert.deepEqual([...HERO_OUT_EXPLAIN.keys()], ["stopped"]);
  assert.deepEqual([...HASTE_SPELL_EXPLAIN.keys()], ["Speed of Sound"]);
});

test("Test 1: every CONDITION_EXPLAIN key (other than default) is a CHIP_FLAVOR key and a HERO_CONDITIONS key, and the table lacks none", () => {
  const heroKeys = HERO_CONDITIONS.map((e) => e.key);
  for (const k of CONDITION_EXPLAIN.keys()) {
    if (k === "default") continue;
    assert.ok(Object.prototype.hasOwnProperty.call(CHIP_FLAVOR, k), `CONDITION_EXPLAIN.${k} has no CHIP_FLAVOR line: a new chip explanation cannot ship without one`);
    assert.ok(heroKeys.includes(k), `CONDITION_EXPLAIN.${k} is not a HERO_CONDITIONS key`);
  }
  for (const k of heroKeys) assert.ok(CONDITION_EXPLAIN.has(k), `HERO_CONDITIONS key ${k} has no CONDITION_EXPLAIN sentence`);
  assert.ok(!Object.prototype.hasOwnProperty.call(CHIP_FLAVOR, "default"), "the default explanation has no chip line");
  assert.equal(heroKeys.length, 42);
});

test("Test 2: every kind- or source-specific sentence has a variant key, and CHIP_FLAVOR_VARIANTS is exactly that set", () => {
  const derived = derivedVariants();
  assert.deepEqual([...CHIP_FLAVOR_VARIANTS].sort(), [...derived].sort());
  assert.equal(CHIP_FLAVOR_VARIANTS.length, 5);
  assert.ok(Object.isFrozen(CHIP_FLAVOR_VARIANTS));
  for (const k of derived) assert.ok(Object.prototype.hasOwnProperty.call(CHIP_FLAVOR, k), `variant ${k} has no CHIP_FLAVOR line`);
});

test("the chip domain: keys are the HERO_CONDITIONS keys in emit order then the variants, identically on every call, and match the map exactly", () => {
  const d = FLAVOR_DOMAINS.find((x) => x.id === "chip");
  assert.ok(d, "the chip domain is registered");
  assert.equal(FLAVOR_DOMAINS[FLAVOR_DOMAINS.length - 1], d, "chip is last in the domain order");
  assert.equal(d.module, "content/flavor.js");
  assert.equal(d.exportName, "CHIP_FLAVOR");
  const want = [...HERO_CONDITIONS.map((e) => e.key), ...CHIP_FLAVOR_VARIANTS];
  const a = d.keys();
  const b = d.keys();
  assert.deepEqual(a, want);
  assert.deepEqual(a, b, "the order is the same on every call");
  assert.notEqual(a, b, "keys() returns a fresh array");
  assert.equal(a.length, 47);
  assert.deepEqual(Object.keys(CHIP_FLAVOR), want);
  assert.ok(Object.isFrozen(CHIP_FLAVOR));
});

test("Test 3: flavorOfChip resolves each chip shape", () => {
  // an ability chip reads the ability's own line; every ability is covered by the ABILITY domain
  for (const a of ABILITIES) {
    const line = flavorOfChip({ key: "ability", ability: a.id });
    assert.equal(line, flavorOfAbility(a.name), `${a.id}: the ability's own line`);
    assert.ok(line, `${a.id} has a line`);
  }
  // an unknown ability id, or none, falls back to the chip's own ability key line
  assert.equal(flavorOfChip({ key: "ability", ability: "nope" }), CHIP_FLAVOR.ability);
  assert.equal(flavorOfChip({ key: "ability" }), CHIP_FLAVOR.ability);
  assert.equal(flavorOfChip({ key: "ability", ability: "__proto__" }), CHIP_FLAVOR.ability);
  // a foeEffect reads its kind line; an unmapped kind or none reads the plain line
  assert.equal(flavorOfChip({ key: "foeEffect", kind: "dazed" }), CHIP_FLAVOR["foeEffect/dazed"]);
  assert.equal(flavorOfChip({ key: "foeEffect", kind: "weakened" }), CHIP_FLAVOR["foeEffect/weakened"]);
  assert.equal(flavorOfChip({ key: "foeEffect", kind: "cursed" }), CHIP_FLAVOR.foeEffect);
  assert.equal(flavorOfChip({ key: "foeEffect" }), CHIP_FLAVOR.foeEffect);
  assert.equal(flavorOfChip({ key: "foeEffect", kind: "heroOut/stopped" }), CHIP_FLAVOR.foeEffect, "a kind cannot reach another key's variant");
  // a heroOut: stopped has its own line, asleep and the rest read the plain one
  assert.equal(flavorOfChip({ key: "heroOut", kind: "stopped" }), CHIP_FLAVOR["heroOut/stopped"]);
  assert.equal(flavorOfChip({ key: "heroOut", kind: "asleep" }), CHIP_FLAVOR.heroOut);
  assert.equal(flavorOfChip({ key: "heroOut" }), CHIP_FLAVOR.heroOut);
  // a ward: a mirror reads the mirror line, Shield the plain one
  assert.equal(flavorOfChip({ key: "ward", mirror: true }), CHIP_FLAVOR["ward/mirror"]);
  assert.equal(flavorOfChip({ key: "ward" }), CHIP_FLAVOR.ward);
  assert.equal(flavorOfChip({ key: "ward", mirror: false }), CHIP_FLAVOR.ward);
  // haste: only Speed of Sound has its own line
  assert.equal(flavorOfChip({ key: "haste", source: "Speed of Sound" }), CHIP_FLAVOR["haste/Speed of Sound"]);
  assert.equal(flavorOfChip({ key: "haste", source: "Cloak of Speed" }), CHIP_FLAVOR.haste);
  assert.equal(flavorOfChip({ key: "haste" }), CHIP_FLAVOR.haste);
  // every other chip key reads its key line
  for (const e of HERO_CONDITIONS) {
    if (e.key === "ability") continue;
    assert.equal(flavorOfChip({ key: e.key }), CHIP_FLAVOR[e.key], e.key);
    assert.ok(flavorOfChip({ key: e.key }), `${e.key} resolves`);
  }
  // a variant key is not a chip key
  assert.equal(flavorOfChip({ key: "foeEffect/dazed" }), "");
  // never throws, never resolves what it cannot: hostile and malformed descriptors read ""
  const hostile = new Proxy({}, { get() { throw new Error("hostile getter"); } });
  const bad = [null, undefined, "haste", 7, [], ["haste"], {}, { key: "nope" }, { key: "default" }, { key: 5 }, { key: "constructor" }, { key: "__proto__" }, hostile];
  for (const cn of bad) assert.equal(flavorOfChip(cn), "", `bad descriptor: ${String(typeof cn)}`);
  // never mutates
  const cn = Object.freeze({ key: "foeEffect", kind: "dazed" });
  assert.doesNotThrow(() => flavorOfChip(cn));
  assert.equal(flavorOf("chip", "haste"), CHIP_FLAVOR.haste);
  assert.equal(flavorOf("chip", "default"), "");
});

test("Test 4: no chip line equals the explanation sentence it sits above, and none is empty", () => {
  for (const [k, line] of Object.entries(CHIP_FLAVOR)) {
    assert.ok(typeof line === "string" && line, `${k} has a line`);
    const sentence = explanationOf(k);
    assert.ok(sentence, `${k}: found the shell sentence to compare against`);
    assert.notEqual(line, sentence, `${k}: the flavour line repeats its explanation`);
    assert.notEqual(line.toLowerCase(), sentence.toLowerCase(), `${k}: the flavour line repeats its explanation`);
  }
});

test("an ability chip's line is its ability's line, so the two never drift", () => {
  for (const id of Object.keys(ABILITY_BY_ID)) {
    assert.equal(flavorOfChip({ key: "ability", ability: id }), flavorOfAbility(ABILITY_BY_ID[id].name));
  }
});
