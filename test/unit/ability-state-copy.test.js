// test/unit/ability-state-copy.test.js
//
// Phase 94 (ASTATE-01/02/03), 94-03: the words an ability row shows for the
// engine's derived state (94-CONTEXT "Full-word labels"). One frozen bank in
// src/browser/abilityStates.js, read by the combat ABILITIES submenu, the
// Bard's Sing row and the Hero tab, so they say identical words. The reason
// map is pinned against the engine's own reason lists, so a future engine
// reason cannot ship without words.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import url from "node:url";

import { ABILITY_STATE_COPY, abilityStateLabel } from "../../src/browser/abilityStates.js";
import { ABILITY_UNAVAILABLE_REASONS } from "../../engine/abilities.js";
import { SING_UNAVAILABLE_REASONS } from "../../engine/combat.js";

const st = (state, roundsLeft, reason) => ({ state, roundsLeft, reason });

function leaves(obj, out = []) {
  for (const v of Object.values(obj)) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") leaves(v, out);
  }
  return out;
}

test("the reason map covers exactly the engine's unavailable reasons", () => {
  const engine = new Set([...ABILITY_UNAVAILABLE_REASONS, ...SING_UNAVAILABLE_REASONS]);
  assert.equal(engine.size, 8);
  assert.deepEqual(new Set(Object.keys(ABILITY_STATE_COPY.reason)), engine);
});

test("the bank and its reason map are frozen", () => {
  assert.ok(Object.isFrozen(ABILITY_STATE_COPY));
  assert.ok(Object.isFrozen(ABILITY_STATE_COPY.reason));
});

test("the exact words", () => {
  assert.equal(ABILITY_STATE_COPY.ready, "READY");
  assert.equal(ABILITY_STATE_COPY.readyOnce, "READY · ONCE PER FIGHT");
  assert.equal(ABILITY_STATE_COPY.recharging, "READY IN {n}");
  assert.equal(ABILITY_STATE_COPY.spent, "SPENT THIS FIGHT");
  const r = ABILITY_STATE_COPY.reason;
  assert.equal(r.tooFewFoes, "NEEDS TWO OR MORE FOES");
  assert.equal(r.alreadyOn, "ALREADY ON IT");
  assert.equal(r.noTarget, "NO FOE IN REACH");
  assert.equal(r.notLowEnough, "NEEDS A QUARTER HP OR LESS");
  assert.equal(r.notInCombat, "NOT IN A FIGHT");
  assert.equal(r.notFought, "FIGHT FIRST");
  assert.equal(r.unknown, "NOT ONE OF YOURS");
  assert.equal(r.wrongClass, "NOT FOR YOU");
});

test("abilityStateLabel: ready, and ready once a fight", () => {
  const ready = st("ready", 0, null);
  assert.equal(abilityStateLabel(ready, { cd: 4 }), "READY");
  assert.equal(abilityStateLabel(ready, { cd: "fight" }), "READY · ONCE PER FIGHT");
  assert.equal(abilityStateLabel(ready, null), "READY");
});

test("abilityStateLabel: recharging reads READY IN n with no plural logic", () => {
  for (const reason of ["cooldown", "songResting"]) {
    assert.equal(abilityStateLabel(st("recharging", 1, reason), { cd: 4 }), "READY IN 1");
    assert.equal(abilityStateLabel(st("recharging", 3, reason), null), "READY IN 3");
    assert.equal(abilityStateLabel(st("recharging", 6, reason), { cd: 6 }), "READY IN 6");
  }
});

test("abilityStateLabel: spent", () => {
  assert.equal(abilityStateLabel(st("spent", 0, "spent"), { cd: "fight" }), "SPENT THIS FIGHT");
  assert.equal(abilityStateLabel(st("spent", 0, "sungThisFight"), null), "SPENT THIS FIGHT");
});

test("abilityStateLabel: each unavailable reason returns its own words; an unlisted one falls back", () => {
  for (const [reason, words] of Object.entries(ABILITY_STATE_COPY.reason)) {
    assert.equal(abilityStateLabel(st("unavailable", 0, reason), null), words);
  }
  assert.equal(abilityStateLabel(st("unavailable", 0, "somethingNew"), null), "NOT ONE OF YOURS");
});

test("the categories stay distinct", () => {
  const reasons = Object.values(ABILITY_STATE_COPY.reason);
  const taken = new Set([ABILITY_STATE_COPY.ready, ABILITY_STATE_COPY.readyOnce, ABILITY_STATE_COPY.spent]);
  for (const w of reasons) {
    assert.ok(!taken.has(w), `${w} collides with a state word`);
    assert.ok(!w.startsWith("READY IN"), `${w} reads like a countdown`);
  }
  assert.equal(new Set(reasons).size, reasons.length, "reason labels are pairwise distinct");
  assert.equal(reasons.length, 8);
});

test("house style: upper case, plain glyphs, no wp, at most 26 characters", () => {
  const all = leaves(ABILITY_STATE_COPY);
  assert.equal(all.length, 12);
  for (const s of all) {
    assert.match(s.replace("{n}", ""), /^[A-Z0-9 ·]+$/, `${s} has a glyph outside A-Z, digits, space, middle dot, {n}`);
    assert.ok(!/\bwp\b/i.test(s), `${s} has a standalone WP token`);
    assert.ok(s.length <= 26, `${s} is ${s.length} characters`);
  }
});

test("purity: no DOM, no storage, no rng, no import", () => {
  const file = url.fileURLToPath(new URL("../../src/browser/abilityStates.js", import.meta.url));
  const code = fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage", "Math.random"]) {
    assert.ok(!code.includes(bad), `module code uses ${bad}`);
  }
  assert.ok(!/^\s*import\s/m.test(code), "module has an import statement");
});
