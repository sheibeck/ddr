// test/unit/hero-size-display.test.js
//
// RULES-11 (Phase 75.2, Plan 03, "Hero Size Matters" — display half): the
// hero sheet's SIZE row (src/browser/heroTab.js#sizeRowFor, exercised via
// characterSheetViewModel) and the damage bracket's size term
// (damageBracket, exercised via the DAMAGE stats row). Every state below is
// a real newRun() with only race/cls/sub/level/weapon/prof/magicWpn/skills
// overridden, per the plan's own read_first instruction — every other
// c/state field (timers, floor, combat) is genuine engine output.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { weaponDamage } from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { characterSheetViewModel, renderHeroTab, HERO_SIZE_COPY } from "../../src/browser/heroTab.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

/** soldier(race, extra) — a level-1 Fighter/Soldier on a Club, prof 0,
 * magicWpn 0, no skills — the plan's own canonical damage-case rig, matching
 * test/unit/hero-size.test.js's own soldierOverrides() shape. */
function soldier(race, extra = {}) {
  const state = newRun(1);
  Object.assign(state.c, { race, cls: "Fighter", sub: "Soldier", weapon: "Club", prof: 0, magicWpn: 0, skills: {}, level: 1, ...extra });
  return state;
}

/** withGauntlet(state) — starts a live Gauntlet-of-the-Giant item effect
 * (+1 size step, both axes, in full), mirroring test/unit/hero-size.test.js's
 * own withGauntlet() helper via the same real startEffect seam. */
function withGauntlet(state) {
  startEffect(state.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
  return state;
}

function sizeRow(state) {
  return characterSheetViewModel(state).stats.find((s) => s.key === "size");
}

test("sizeRowFor: a plain Human reads value 'Human', step 0, no detail", () => {
  const row = sizeRow(soldier("Human"));
  assert.equal(row.value, "Human");
  assert.equal(row.step, 0);
  assert.equal(row.detail, "");
  assert.equal(row.text, "Human");
});

test("sizeRowFor: Troll, Elven and Dwarven each state their own net effect from the player's side", () => {
  assert.equal(sizeRow(soldier("Troll")).text, "Large · +2 damage, −1 vs their swings");
  assert.equal(sizeRow(soldier("Elven")).text, "Small · −2 damage");
  assert.equal(sizeRow(soldier("Dwarven")).text, "Small · +1 vs their swings");
});

test("sizeRowFor: a live Gauntlet of the Giant adds a 'by birth' clause once the displayed name diverges from the race's own base size", () => {
  assert.equal(sizeRow(withGauntlet(soldier("Human"))).text, "Large · +2 damage, −1 vs their swings · Human by birth");
  assert.equal(sizeRow(withGauntlet(soldier("Troll"))).text, "Huge · +4 damage, −2 vs their swings · Large by birth");
  assert.equal(sizeRow(withGauntlet(soldier("Dwarven"))).text, "Human · +2 damage · Small by birth");
  assert.equal(sizeRow(withGauntlet(soldier("Elven"))).text, "Human · −1 vs their swings · Small by birth");
});

test("sizeRowFor: every signed number is U+2212, never an ASCII hyphen-minus directly before a digit", () => {
  const rows = [
    sizeRow(soldier("Troll")),
    sizeRow(soldier("Elven")),
    sizeRow(soldier("Dwarven")),
    sizeRow(withGauntlet(soldier("Human"))),
    sizeRow(withGauntlet(soldier("Troll"))),
    sizeRow(withGauntlet(soldier("Dwarven"))),
    sizeRow(withGauntlet(soldier("Elven"))),
  ];
  for (const row of rows) {
    assert.doesNotMatch(row.text, /-\d/, `expected no ASCII hyphen-minus before a digit in "${row.text}"`);
  }
});

test("sizeRowFor: HERO_SIZE_COPY is frozen and carries the label/join/sep/born vocabulary", () => {
  assert.equal(HERO_SIZE_COPY.label, "SIZE");
  assert.ok(Object.isFrozen(HERO_SIZE_COPY));
  assert.equal(sizeRow(soldier("Human")).label, "SIZE");
});

test("DAMAGE row brackets 200 real weaponDamage(c, rng) draws for a level-1 Club Soldier of every sized race", () => {
  const testRng = makeRng(999);
  for (const state of [soldier("Troll"), soldier("Elven"), soldier("Dwarven"), withGauntlet(soldier("Human"))]) {
    const damage = characterSheetViewModel(state).stats.find((s) => s.key === "damage");
    for (let i = 0; i < 200; i++) {
      const rolled = weaponDamage(state.c, testRng);
      assert.ok(
        rolled >= damage.min && rolled <= damage.max,
        `weaponDamage() rolled ${rolled}, outside view-model bracket [${damage.min}, ${damage.max}] for ${state.c.race}`,
      );
    }
  }
});

test("DAMAGE row: a level-1 Club Troll Soldier with prof 0 and magicWpn 0 reads min 13 and max 18", () => {
  const damage = characterSheetViewModel(soldier("Troll")).stats.find((s) => s.key === "damage");
  assert.equal(damage.min, 13);
  assert.equal(damage.max, 18);
  assert.equal(damage.value, "13–18");
});

test("characterSheetViewModel(state): stats[] keeps toStrike, toHit, damage first; size sits right after damage; every existing row is unchanged", () => {
  const state = soldier("Human");
  const keys = characterSheetViewModel(state).stats.map((s) => s.key);
  assert.deepEqual(keys.slice(0, 4), ["toStrike", "toHit", "damage", "size"]);
  assert.deepEqual(keys, ["toStrike", "toHit", "damage", "size", "armor", "intelligence", "skillPoints", "nextLevel", "upkeep"]);
});

// ─── Task 2: renderHeroTab writes #s-size and folds sizeDamage(c) into
// #s-dmg's bonus ────────────────────────────────────────────────────────

test("renderHeroTab: writes 'Large · +2 damage, −1 vs their swings' to #s-size and '1² + d6 + 11' to #s-dmg for a level-1 Club Troll Soldier with prof 0 and magicWpn 0", () => {
  const state = soldier("Troll");
  const { document } = createRecordingDocument();
  const host = document.createElement("div");
  renderHeroTab(host, state, {});
  assert.equal(document.getElementById("s-size").textContent, "Large · +2 damage, −1 vs their swings");
  assert.equal(document.getElementById("s-dmg").textContent, "1² + d6 + 11");
});
