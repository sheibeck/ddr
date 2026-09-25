// Task 1 (TDD) — Character-sheet view-model bound to real GameState (UX-04).
//
// RED-first: this file imports src/browser/viewModels.js, which does not
// exist yet, so `node --test` fails to load it. Implementing
// characterSheetViewModel(state) (GREEN) turns it green.
//
// Proves (04-03-PLAN.md must_haves / T-04-05 / T-04-06): every UI-SPEC HERO
// row binds to the REAL GameState.c + engine/derived.js — never the design
// mockup's placeholder shape (s.ch.wp, s.pos, s.feats) — and the sheet
// render NEVER advances state.rngState (the DAMAGE row must be a static
// descriptor, never a call to weaponDamage(c, rng)).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { strikeDie, upkeep, weaponDamage } from "../../engine/derived.js";
import { THRESHOLDS, ABILITY_BY_ID } from "../../content/index.js";
import { startCooldown } from "../../engine/effects.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { heroHitOdds } from "../../src/browser/rollOdds.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

function statByKey(vm, key) {
  const row = vm.stats.find((s) => s.key === key);
  assert.ok(row, `expected a stats[] row with key "${key}"`);
  return row;
}

test("characterSheetViewModel(state): binds name/level/class/race/sub to the real character", () => {
  const state = newRun(42); // Fighter / Soldier / Human, per fixture inspection
  const vm = characterSheetViewModel(state);
  assert.equal(vm.name, state.c.name);
  assert.equal(vm.level, state.c.level);
  assert.equal(vm.classLabel, state.c.cls);
  assert.equal(vm.raceLabel, state.c.race);
  assert.equal(vm.subLabel, state.c.sub);
});

test("characterSheetViewModel(state): TO STRIKE / TO HIT / ARMOR / INTELLIGENCE / EXPERIENCE / NEXT LEVEL / UPKEEP bind to engine/derived.js and real GameState.c fields", () => {
  const state = newRun(42);
  const vm = characterSheetViewModel(state);

  assert.equal(statByKey(vm, "toStrike").value, `d${strikeDie(state.c)}`);
  // Phase 74 (ROLL-02, roll-display honesty): roll-HIGH — the sheet shows
  // the current strike die's own winning range (Afraid included), the SAME
  // value heroHitOdds(state) (src/browser/rollOdds.js) returns; supersedes
  // the Phase 31 low-roll "1–N" reading (that era's engine still rolled low;
  // Phase 73 flipped the engine to roll-high).
  assert.equal(statByKey(vm, "toHit").value, heroHitOdds(state).text);
  // Phase 28 (ARMOR-02/04): the ARMOR stat now reads through the shared
  // armorDisplay(c) formatter, showing durability (seed 42 wears Studded
  // 18/18) so the sheet can never disagree with the line/gear panel.
  assert.equal(
    statByKey(vm, "armor").value,
    `${state.c.armor.toUpperCase()} · AR ${state.c.ar} · ${state.c.armorWP}/${state.c.armorMax} hp`,
  );
  assert.equal(statByKey(vm, "intelligence").value, state.c.intel);
  assert.equal(statByKey(vm, "skillPoints").value, state.c.sp);
  assert.equal(statByKey(vm, "skillPoints").label, "EXPERIENCE", "TERM-01: the sheet's sp row reads EXPERIENCE, not the old SKILL POINTS label");
  assert.equal(statByKey(vm, "upkeep").value, `${upkeep(state.c)} hp/day`, "TERM-02: upkeep's unit reads hp, not wp");

  // NEXT LEVEL: the sp threshold for the next skill level, from THRESHOLDS.
  assert.equal(statByKey(vm, "nextLevel").value, THRESHOLDS[state.c.level]);
});

test("characterSheetViewModel(state): 74-CONTEXT specifics — a level-1 Human Magic User, Thief and Fighter on a Club read the class range on d20", () => {
  // 74-CONTEXT "Specific Ideas": "On a d20 a caster needs 18–20, a thief
  // 17–20 and a fighter 16–20." Each state starts from a real newRun (so
  // every other c/state field — timers, floor, combat — is genuine engine
  // output) with only race/cls/sub/level/weapon overridden to pin the exact
  // class case.
  const mu = newRun(1);
  Object.assign(mu.c, { race: "Human", cls: "Magic User", sub: "Wizard", level: 1, weapon: "Club" });
  assert.equal(statByKey(characterSheetViewModel(mu), "toHit").value, "18–20 (d20)");

  const thief = newRun(1);
  Object.assign(thief.c, { race: "Human", cls: "Thief", sub: "Pilfer", level: 1, weapon: "Club" });
  assert.equal(statByKey(characterSheetViewModel(thief), "toHit").value, "17–20 (d20)");

  const fighter = newRun(1);
  Object.assign(fighter.c, { race: "Human", cls: "Fighter", sub: "Soldier", level: 1, weapon: "Club" });
  assert.equal(statByKey(characterSheetViewModel(fighter), "toHit").value, "16–20 (d20)");
});

test("characterSheetViewModel(state): NEXT LEVEL reads MAX at the top skill level (no THRESHOLDS entry beyond level 5)", () => {
  const state = newRun(42);
  state.c.level = THRESHOLDS.length; // level 5 — the highest ROMAN/STRIKE_DICE index
  const vm = characterSheetViewModel(state);
  assert.equal(statByKey(vm, "nextLevel").value, "MAX");
});

test("characterSheetViewModel(state): HIT POINTS (winPotential) binds to c.wp/c.maxWP (not a mockup placeholder)", () => {
  const state = newRun(6); // Troll — flatWP 75, a distinctive real value to bind against
  const vm = characterSheetViewModel(state);
  assert.equal(vm.winPotential.value, state.c.wp);
  assert.equal(vm.winPotential.max, state.c.maxWP);
  assert.equal(vm.winPotential.pct, state.c.wp / state.c.maxWP);
  assert.equal(state.c.maxWP, 75, "Troll is flatWP 75 per content/races.js — confirms real-race binding, not a mockup constant");
});

test("characterSheetViewModel(state): DAMAGE row is a static min-max descriptor bracketing every real weaponDamage(c, rng) roll", () => {
  const state = newRun(42); // Fighter/Soldier/Human with the Kata skill — exercises a skill-based damage modifier
  const vm = characterSheetViewModel(state);
  const damage = statByKey(vm, "damage");
  assert.equal(typeof damage.min, "number");
  assert.equal(typeof damage.max, "number");
  assert.ok(damage.min >= 1);
  assert.ok(damage.max >= damage.min);
  assert.equal(damage.value, `${damage.min}–${damage.max}`);

  // Cross-check against the REAL engine weaponDamage() over many independent
  // draws (a fresh rng, never state.rngState) — every roll must fall inside
  // the static bracket the view-model reports.
  const testRng = makeRng(999);
  for (let i = 0; i < 200; i++) {
    const rolled = weaponDamage(state.c, testRng);
    assert.ok(
      rolled >= damage.min && rolled <= damage.max,
      `weaponDamage() rolled ${rolled}, outside view-model bracket [${damage.min}, ${damage.max}]`
    );
  }
});

test("characterSheetViewModel(state): calling the view-model NEVER advances state.rngState (DAMAGE must not call weaponDamage(c, rng) on the live rng)", () => {
  const state = newRun(1234);
  const before = structuredClone(state.rngState);
  characterSheetViewModel(state);
  assert.deepEqual(state.rngState, before);
});

test("characterSheetViewModel(state): quirk box binds to the real phobia, not a mockup QUIRKS placeholder", () => {
  const state = newRun(42);
  const vm = characterSheetViewModel(state);
  assert.equal(typeof vm.quirk.label, "string");
  assert.ok(vm.quirk.text.includes(state.c.phobia), "quirk text should reference the character's real phobia");
});

test("characterSheetViewModel(state): snarkLine assembles temperament/motive/phobia (tone reference only, no external generator call)", () => {
  const state = newRun(42);
  const vm = characterSheetViewModel(state);
  assert.equal(typeof vm.snarkLine, "string");
  assert.ok(vm.snarkLine.includes(state.c.temperament));
  assert.ok(vm.snarkLine.includes(state.c.motive));
  assert.ok(vm.snarkLine.includes(state.c.phobia));
});

test("characterSheetViewModel(state): skills[] binds to the real c.skills tiers with content/skills.js descriptions (Fighter)", () => {
  const state = newRun(42); // Fighter/Soldier/Human — skills: Death-touch, Kata (per fixture inspection)
  const vm = characterSheetViewModel(state);
  const realSkillNames = Object.keys(state.c.skills || {});
  assert.equal(vm.skills.length, realSkillNames.length);
  for (const row of vm.skills) {
    assert.ok(realSkillNames.includes(row.name));
    assert.equal(row.tier, state.c.skills[row.name]);
    assert.equal(typeof row.description, "string");
    assert.ok(row.description.length > 0);
  }
});

test("characterSheetViewModel(state): skills[] is empty for a Magic User (no skill table, matches engine/character.js skillTable())", () => {
  const state = newRun(7); // Magic User / Wizard / Human — no skills table
  assert.deepEqual(state.c.skills, {});
  const vm = characterSheetViewModel(state);
  assert.deepEqual(vm.skills, []);
});

test("characterSheetViewModel(state): ARMOR row reflects a no-armor Fridgian (real content/races.js noArmor, not a mockup default)", () => {
  const state = newRun(1); // Fighter/Knight/Fridgian per fixture inspection
  assert.equal(state.c.race, "Fridgian");
  assert.equal(state.c.armor, "Nothing");
  assert.equal(state.c.ar, 0);
  const vm = characterSheetViewModel(state);
  assert.equal(statByKey(vm, "armor").value, `NOTHING · AR 0`);
});

// ─── Phase 38 (ABIL-01/04): abilities[] ────────────────────────────────────

test("characterSheetViewModel(state): abilities[] out of combat reads the ability's OWN cd/once-a-fight text, tagged table/pool by source", () => {
  const state = newRun(42); // Fighter/Soldier/Human
  state.c.abilities = ["feint", "mark"];
  state.combat = null;
  const vm = characterSheetViewModel(state);
  assert.deepEqual(vm.abilities, [
    { id: "feint", name: "Feint", description: ABILITY_BY_ID.feint.txt, source: "table", state: "cd 3 rounds" },
    { id: "mark", name: "Mark", description: ABILITY_BY_ID.mark.txt, source: "pool", state: "once a fight" },
  ]);
});

test("characterSheetViewModel(state): abilities[] in combat reads READY / N rounds / once a fight · used", () => {
  const state = newRun(42);
  state.c.abilities = ["feint", "secondWind"];
  state.combat = {};
  const readyVm = characterSheetViewModel(state);
  assert.equal(readyVm.abilities.find((a) => a.id === "feint").state, "READY");

  startCooldown(state.c, "ability:feint", { rounds: 2 });
  startCooldown(state.c, "ability:secondWind", { rounds: 999 });
  const vm = characterSheetViewModel(state);
  assert.equal(vm.abilities.find((a) => a.id === "feint").state, "2 rounds");
  assert.equal(vm.abilities.find((a) => a.id === "secondWind").state, "once a fight · used");
});

test("characterSheetViewModel(state): abilities[] is [] for a Magic User", () => {
  const state = newRun(7); // Magic User / Wizard / Human
  assert.deepEqual(state.c.abilities, []);
  const vm = characterSheetViewModel(state);
  assert.deepEqual(vm.abilities, []);
});

test("characterSheetViewModel(state): calling the view-model with abilities present never advances state.rngState", () => {
  const state = newRun(1234);
  state.c.abilities = ["feint"];
  const before = structuredClone(state.rngState);
  characterSheetViewModel(state);
  assert.deepEqual(state.rngState, before);
});

test("src/browser/heroTab.js does not read the design mockup's placeholder field shape (s.ch, s.pos, s.feats, .wp as a lone field)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/heroTab.js", import.meta.url), "utf8");
  assert.equal(/\bs\.ch\b|\bs\.pos\b|\bs\.feats\b/.test(src), false);
});
