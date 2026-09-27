// test/unit/hero-damage-agreement.test.js
//
// Phase 79 (VOX-05, Plan 09; todo 2026-09-25 "hero sheet damage range
// leaves out bonuses the engine applies"): the Hero sheet's DAMAGE row
// (characterSheetViewModel's `damage` stat) and its #s-dmg formula line
// (renderHeroTab) must agree with engine/derived.js#weaponDamage — the
// number a real strike rolls — for every sub-class, every race and a spread
// of weapons and bonuses, Master of Arms and Heft included. Before this plan
// the sheet restated the modifier stack and had drifted: the range left out
// Master of Arms' +2, and the formula line also left out Heft, might and the
// Guard's early penalty. The sheet now reads the engine's own
// weaponDamageTerms/weaponDamageRange; this file is the agreement guard in
// the style of the Phase 74 sign guard.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { weaponDamage, weaponDamageTerms, weaponDamageRange } from "../../engine/derived.js";
import { startEffect } from "../../engine/effects.js";
import { CLASSES, RACES, WEAPONS } from "../../content/index.js";
import { characterSheetViewModel, renderHeroTab } from "../../src/browser/heroTab.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

// Every die lands on its lowest face, or on its highest.
const LOW = { d: () => 1 };
const HIGH = { d: (sides) => sides };

const WEAPON_SPREAD = ["Club", "Dagger", "Whip", "Claymore", "Bastard Sword", "Bardiche", "Short Sword", "Fists"];

/** hero(cls, sub, race, extra) — a real newRun() with only the fields under
 * test overridden (the hero-size-display.test.js rig). */
function hero(cls, sub, race, extra = {}) {
  const state = newRun(1);
  Object.assign(state.c, { cls, sub, race, weapon: "Club", prof: 0, magicWpn: 0, might: 0, skills: {}, level: 1, ...extra });
  return state;
}

function sheetDamage(state) {
  return characterSheetViewModel(state).stats.find((s) => s.key === "damage");
}

function sDmg(state) {
  const { document } = createRecordingDocument();
  const host = document.createElement("div");
  renderHeroTab(host, state, {});
  return document.getElementById("s-dmg").textContent;
}

/** Every combination this guard walks: each class's sub-classes, each race,
 * a spread of weapons, levels 1 and 3, and three bonus shapes (none; prof +
 * enchantment + a Strength spell; Heft with a live Gauntlet of the Giant). */
function* cases() {
  const bonusShapes = [
    {},
    { prof: 2, magicWpn: 1, might: 3 },
    { skills: { Heft: 1 }, gauntlet: true },
  ];
  for (const [cls, row] of Object.entries(CLASSES)) {
    for (const sub of row.subs) {
      for (const race of Object.keys(RACES)) {
        for (const weapon of WEAPON_SPREAD) {
          for (const level of [1, 3]) {
            for (const shape of bonusShapes) {
              const { gauntlet, ...extra } = shape;
              const state = hero(cls, sub, race, { weapon, level, ...extra });
              if (gauntlet) startEffect(state.c, "item:Gauntlet of the Giant", { squares: 50, cd: 50 });
              yield { state, label: `${race} ${sub} (${cls}) L${level} ${weapon} ${JSON.stringify(shape)}` };
            }
          }
        }
      }
    }
  }
}

test("the sheet's DAMAGE range is weaponDamage at its lowest and highest faces, for every sub-class, race, weapon and bonus shape", () => {
  let n = 0;
  for (const { state, label } of cases()) {
    const c = state.c;
    const row = sheetDamage(state);
    const lo = weaponDamage(c, LOW);
    const hi = weaponDamage(c, HIGH);
    assert.equal(row.min, lo, `${label}: sheet min ${row.min} vs weaponDamage ${lo}`);
    assert.equal(row.max, hi, `${label}: sheet max ${row.max} vs weaponDamage ${hi}`);
    assert.equal(row.value, `${lo}–${hi}`, label);
    n++;
  }
  assert.ok(n > 1000, `walked ${n} cases`);
});

test("the #s-dmg line is the engine's own terms: level² + the dice + every other bonus, signed, with the Sorcerer's cap named", () => {
  // Every 11th case (11 is prime to every axis length, so the stride still
  // visits every sub-class, race, weapon, level and bonus shape): rendering
  // the whole Hero tab per case is the slow part.
  let i = 0;
  for (const { state, label } of cases()) {
    if (i++ % 11 !== 0) continue;
    const c = state.c;
    const t = weaponDamageTerms(c);
    const line = sDmg(state);
    const m = /^(\d+)² \+ (\S+)(?: ([+−]) (\d+))?( \(max (\d+)\))?$/.exec(line);
    assert.ok(m, `${label}: unexpected #s-dmg "${line}"`);
    assert.equal(Number(m[1]), c.level, label);
    assert.equal(m[2], t.weapon.lab, label);
    const bonus = m[3] ? (m[3] === "+" ? 1 : -1) * Number(m[4]) : 0;
    assert.equal(bonus, t.bonus, `${label}: #s-dmg bonus ${bonus} vs engine ${t.bonus}`);
    assert.equal(m[6] ? Number(m[6]) : null, t.cap, label);
    // The line's own arithmetic at the dice's highest face is the real
    // strike (before the floor of 1), so no term can be missing from it.
    const { n: dn, sides, bonus: db } = t.weapon.dice;
    const top = t.weapon.halve ? Math.ceil((dn * sides + (db || 0)) / 2) : dn * sides + (db || 0);
    let sum = c.level * c.level + top + bonus;
    if (t.cap !== null) sum = Math.min(sum, t.cap);
    assert.equal(Math.max(1, sum), weaponDamage(c, HIGH), `${label}: "${line}" does not add up to weaponDamage`);
  }
});

test("Master of Arms: the sheet shows the +2 the engine adds (the todo's own case)", () => {
  const moa = hero("Fighter", "Master of Arms", "Human", { weapon: "Club" });
  const soldier = hero("Fighter", "Soldier", "Human", { weapon: "Club" });
  assert.equal(sheetDamage(moa).min - sheetDamage(soldier).min, 2);
  assert.equal(sheetDamage(moa).max - sheetDamage(soldier).max, 2);
  assert.equal(sDmg(moa), "1² + d6 + 2");
  assert.deepEqual(weaponDamageRange(moa.c), { min: 4, max: 9 });
});

test("Heft and might: the #s-dmg line counts both (it used to leave them out)", () => {
  const thief = hero("Thief", Object.values(CLASSES.Thief.subs)[0], "Human", { weapon: "Club", skills: { Heft: 1 }, might: 3 });
  assert.equal(weaponDamageTerms(thief.c).bonus, 5);
  assert.equal(sDmg(thief), "1² + d6 + 5");
});

test("a level-1 Guard's early penalty reads as a signed minus with U+2212; a Sorcerer's arm names its cap", () => {
  const guard = hero("Fighter", "Guard", "Human", { weapon: "Club" });
  assert.equal(sDmg(guard), "1² + d6 − 3");
  const sorcerer = hero("Magic User", "Sorcerer", "Troll", { weapon: "Claymore", level: 3 });
  assert.match(sDmg(sorcerer), / \(max 9\)$/);
  assert.equal(sheetDamage(sorcerer).max, 9);
});

test("weaponDamageRange and weaponDamageTerms are pure: no rng, and the character is untouched", () => {
  const state = hero("Fighter", "Master of Arms", "Dwarven", { weapon: "Bardiche", level: 3, skills: { Heft: 1 } });
  const before = JSON.stringify(state);
  weaponDamageRange(state.c);
  weaponDamageTerms(state.c);
  assert.equal(JSON.stringify(state), before);
  assert.ok(WEAPONS.Bardiche);
});
