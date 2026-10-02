// test/unit/value-cleanup.test.js
//
// Phase 91.1 plan 05 (VALUE-01, VALUE-04) -- the two dead-code cleanups the Phase 91 close handed
// on (.planning/phases/91-race-sub-class-audit/deferred-items.md, ledger rows K19 and K20):
//
//   1. The Inspire the Heart term. Nothing writes `state.combat.inspired` any more (the Bard's
//      level-2 song was retired in 91-06), so the term in engine/derived.js (toHit,
//      toHitBreakdown, conditionsOf), the chip's effect reset (src/browser/conditionEffects.js),
//      its table entry (src/browser/heroConditions.js) and its label, tone and explanation
//      (mazeworld.html) were dead. They are removed.
//   2. The "THEY STAND DOWN" check. mazeworld.html tested the fight-over events for a
//      `beastsSoothed` event no engine function emits; a won fight's outcome is plainly victory.
//
// Zero behaviour change: every number a hero rolls is identical to the base commit (fef7c779).
// The matrix digest below was recorded BEFORE the edit; the absence tests read the engine and
// the shell as text and ignore comment lines, so a comment recording the removal never trips them.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { playerStrike } from "../../engine/combat.js";
import { toHit, toHitBreakdown, conditionsOf } from "../../engine/derived.js";
import { makeRng, hashString } from "../../engine/rng.js";
import { serializeRun, validateSave } from "../../engine/saveState.js";
import { startCombat } from "../../engine/combat.js";
import { WHAT_IF } from "../../src/browser/conditionEffects.js";
import { HERO_CONDITIONS } from "../../src/browser/heroConditions.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");
/** code(rel) -- the file's lines without comment lines (`//`, `*`, `/*`, `<!--`). */
const code = (rel) => read(rel).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l)).join("\n");

// ---------------------------------------------------------------------------
// the sample: a Bard, a Soldier and a Sorcerer over levels 1 to 5 and five states, in and out of a fight
// ---------------------------------------------------------------------------

const BASE = newRun(1);
const HEROES = [
  { cls: "Fighter", sub: "Bard", race: "Human" },
  { cls: "Fighter", sub: "Soldier", race: "Human" },
  { cls: "Magic User", sub: "Sorcerer", race: "Human" },
];
const STATES = [
  { key: "lit", dark: false },
  { key: "dark", dark: true },
  { key: "dazed", dark: false, c: { foeEffect: { kind: "dazed", rounds: 2 } } },
  { key: "heroBlind", dark: false, combat: { heroBlind: true } },
  { key: "afraid", dark: false, combat: { afraid: 2 } },
];
const FOE = () => ({ name: "T", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1 });

function sampleState(h, level, st, inFight, stray) {
  const s = structuredClone(BASE);
  Object.assign(s.c, { ...h, level, weapon: "Club", ...(st.c || {}) });
  if (s.c.skills) delete s.c.skills["Night Vision"];
  s.floor.g[s.floor.py][s.floor.px].dark = st.dark;
  s.combat = inFight
    ? { foes: [FOE()], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...(st.combat || {}), ...(stray ? { inspired: stray } : {}) }
    : null;
  return s;
}

function matrix(stray) {
  const out = [];
  for (const h of HEROES) for (let level = 1; level <= 5; level++) for (const st of STATES) for (const inFight of [false, true]) {
    const s = sampleState(h, level, st, inFight, stray);
    out.push([`${h.sub}/${level}/${st.key}/${inFight ? "fight" : "idle"}`, toHit(s), toHitBreakdown(s).need, conditionsOf(s).map((c) => c.key).join(",")]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// the pins
// ---------------------------------------------------------------------------

test("Cleanup: toHit, the breakdown's need and the chip list over a Bard, Soldier and Sorcerer matrix equal the base commit's (fef7c779)", () => {
  const rows = matrix(0);
  assert.equal(rows.length, 150);
  // recorded at fef7c779, before the Inspire term was removed: hashString(JSON.stringify(rows))
  assert.equal(hashString(JSON.stringify(rows)).toString(16), "7576c70d");
  const at = (label) => rows.find((r) => r[0] === label);
  assert.deepEqual(at("Bard/1/lit/fight"), ["Bard/1/lit/fight", 5, 5, ""]);
  assert.deepEqual(at("Bard/5/dark/fight"), ["Bard/5/dark/fight", 2, 2, "fightDark"]);
});

test("Cleanup: a stray combat.inspired from an old save gives the same toHit, toHitBreakdown and chip list as the same state without it", () => {
  const plain = matrix(0);
  for (const stray of [1, 2, 5]) assert.deepEqual(matrix(stray), plain, `stray inspired ${stray}`);
});

test("Cleanup: a stray combat.inspired changes no strike (same events, same draws, same state apart from the field itself)", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = (stray) => {
      const s = sampleState(HEROES[0], 1, STATES[0], true, stray);
      const rng = makeRng(seed * 7919);
      const events = playerStrike(s, rng, []);
      if (s.combat) delete s.combat.inspired;
      return { events, state: s, next: rng.getState() };
    };
    assert.deepEqual(run(1), run(0), `seed ${seed}`);
  }
});

test("Cleanup: an old save that carries combat.inspired still loads (tolerant load, no migration)", () => {
  const s = newRun(7);
  const rng = makeRng(s.rngState);
  startCombat(s, false, null, rng);
  s.rngState = rng.getState();
  assert.ok(s.combat, "a fight is live");
  s.combat.inspired = 1;
  const check = validateSave(JSON.stringify(serializeRun(s)));
  assert.equal(check.ok, true);
  assert.equal(conditionsOf(check.value).some((c) => c.key === "inspired"), false);
});

test("Cleanup: no chip list holds an inspired chip, with the stray field or without it", () => {
  for (const stray of [0, 1]) {
    for (const h of HEROES) for (const st of STATES) {
      const keys = conditionsOf(sampleState(h, 3, st, true, stray)).map((c) => c.key);
      assert.ok(!keys.includes("inspired"), `${h.sub}/${st.key}/${stray}`);
    }
  }
});

test("Cleanup: the condition-effect reset map and the hero chip table hold no inspired entry", () => {
  assert.equal("inspired" in WHAT_IF, false);
  assert.equal(HERO_CONDITIONS.some((e) => e.key === "inspired" || e.fields.includes("inspired")), false);
});

test("Cleanup: no engine or browser source outside a comment reads combat.inspired or names an inspired chip", () => {
  for (const rel of ["engine/derived.js", "engine/combat.js", "src/browser/conditionEffects.js", "src/browser/heroConditions.js", "src/browser/rollOdds.js"]) {
    const src = code(rel);
    assert.doesNotMatch(src, /combat\.inspired/, `${rel}: combat.inspired`);
    assert.doesNotMatch(src, /["']inspired["']/, `${rel}: an inspired key`);
    assert.doesNotMatch(src, /\binspired\s*:/, `${rel}: an inspired entry`);
  }
});

test("Cleanup: the shell's chip label, tone and explanation tables hold no inspired entry", () => {
  const src = code("mazeworld.html");
  assert.doesNotMatch(src, /\binspired\s*:/);
  assert.doesNotMatch(src, /Your song is still ringing/);
  assert.doesNotMatch(src, /label:\s*"Inspired"/);
});

test("Cleanup: the chips beside the removed one keep their keys, order and text (braced, halfNext, nightVision, strength, unlock, enchant)", () => {
  const src = read("mazeworld.html");
  // label table: ability, braced, halfNext, nightVision, fightDark, insulted
  assert.match(
    src,
    /ability: \{ label: "Ability", unit: "rds" \},\n\s*braced: \{ label: "Bracing" \},\n\s*halfNext: \{ label: "Fortified" \},\n\s*nightVision: \{ label: "Nightsight" \},\n\s*fightDark: \{ label: "Dark" \},\n\s*insulted: \{ label: "Provoked" \},/,
  );
  // tone map
  assert.match(src, /ability: "good", braced: "good", halfNext: "good", nightVision: "good", strength: "good", unlock: "odd", enchant: "good",/);
  // explanation text: braced then halfNext then nightVision
  assert.match(
    src,
    /braced: "The next blow that lands does half damage\. Planning ahead, for once\.",\n\s*halfNext: "The next blow that lands on you does half damage\. The Pendant takes the other half personally\.",\n\s*nightVision: "Your own eyes see in the dark/,
  );
  // the hero chip table: braced, halfNext, nightVision in order, nothing between
  const keys = HERO_CONDITIONS.map((e) => e.key);
  const i = keys.indexOf("braced");
  assert.deepEqual(keys.slice(i, i + 4), ["braced", "halfNext", "nightVision", "itemCooldown"]);
  for (const k of ["strength", "unlock", "enchant"]) assert.ok(keys.includes(k), k);
});

test("Cleanup: the fight-over outcome is the plain victory, no beastsSoothed is tested anywhere, and the flee branch is untouched", () => {
  const html = code("mazeworld.html");
  assert.doesNotMatch(html, /beastsSoothed/);
  assert.match(html, /outcome: "victory",/);
  assert.match(html, /events\.some\(\(e\) => e\.type === "fled"\)/, "the fled branch stays");
  for (const rel of ["engine/combat.js", "engine/engine.js", "engine/magic.js", "engine/abilities.js", "engine/foeAbilities.js", "engine/derived.js"]) {
    assert.doesNotMatch(code(rel), /beastsSoothed/, rel);
  }
});
