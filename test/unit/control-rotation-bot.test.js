// test/unit/control-rotation-bot.test.js
//
// Phase 75.3 (RULES-18, 75.3-02-PLAN.md Task 1) — synthetic-state coverage
// for tools/lib/tuning-bot.mjs's opt-in `controlRotation` scoring branch
// (chooseSpell) and its `botLine` echo, plus a source-level check that both
// tune-classes.mjs/tune-difficulty.mjs accept `--control-rotation`. Style
// mirrors test/unit/tuning-bot.test.js: hand-built synthetic states, never a
// number produced by a real playRun.
//
// USER RULING (2026-09-26): the bot balance runs themselves are deferred to
// Phase 79.1 — this file proves the ROTATION option's DECISIONS only.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { chooseSpell, makeBotContext, botLine, BOT_DEFAULTS } from "../../tools/lib/tuning-bot.mjs";
import { SPELLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's pins are canon-mechanic numbers, so it runs under the same
// explicit identity override test/unit/tuning-bot.test.js uses.
setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** idx(name) — the SPELLS index for a spell by exact display name. */
function idx(name) {
  return SPELLS.findIndex((s) => s.n === name);
}

/**
 * mu(over) — a level-5 Human Sorcerer Magic User sheet (broad "offense"-
 * school access; a Sorcerer's own `gate.healing` is 4, so level 5 also
 * legalizes Heal) — every field overridable per test.
 */
function mu(over = {}) {
  return {
    name: "T",
    race: "Human",
    cls: "Magic User",
    sub: "Sorcerer",
    level: 5,
    wp: 40,
    maxWP: 40,
    potions: 0,
    rations: 0,
    spellsUsed: 0,
    grimoire: [],
    items: [],
    skills: {},
    gold: 0,
    ...over,
  };
}

/** fight(nFoes, extra) — a minimal state.combat with nFoes plain, alive, awake foes. */
function fight(nFoes, extra = {}) {
  const foes = Array.from({ length: nFoes }, (_, i) => ({ name: `foe${i}`, alive: true, wp: 20, maxWP: 20, asleep: 0 }));
  return { type: "Beasts", foes, round: 2, target: 0, ...extra };
}

/** mkState(c, combat) — chooseSpell only ever reads state.c/state.combat. */
function mkState(c, combat) {
  return { c, combat };
}

test("ROTATION off by default: chooseSpell returns the same pick with controlRotation false or omitted, for a KILL, a DAMAGE and a DISABLE-tier state", () => {
  const ctxOff = makeBotContext({ controlRotation: false });
  const ctxOmitted = makeBotContext();

  const killState = mkState(mu({ grimoire: ["Freeze"] }), fight(1));
  assert.deepStrictEqual(chooseSpell(killState, ctxOff), chooseSpell(killState, ctxOmitted));
  assert.deepStrictEqual(chooseSpell(killState, ctxOmitted), { idx: idx("Freeze"), tier: "kill", score: 410 });

  const damageState = mkState(mu({ grimoire: ["Fireball"] }), fight(1));
  assert.deepStrictEqual(chooseSpell(damageState, ctxOff), chooseSpell(damageState, ctxOmitted));
  assert.deepStrictEqual(chooseSpell(damageState, ctxOmitted), { idx: idx("Fireball"), tier: "damage", score: 315 });

  const disableState = mkState(mu({ grimoire: ["Weaken"] }), fight(2));
  assert.deepStrictEqual(chooseSpell(disableState, ctxOff), chooseSpell(disableState, ctxOmitted));
  // 2 live foes, no castable KILL-tier spell -> USER RULING D defensive mode.
  assert.deepStrictEqual(chooseSpell(disableState, ctxOmitted), { idx: idx("Weaken"), tier: "disable", score: 440 });

  assert.equal(botLine(BOT_DEFAULTS).includes("controlRotation"), false);
  assert.equal("controlRotation" in BOT_DEFAULTS, false);
});

test("ROTATION on, one awake foe, Freeze/Weaken/Doze/Fireball all held: Freeze wins at 455", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const state = mkState(mu({ grimoire: ["Freeze", "Weaken", "Doze", "Fireball"] }), fight(1));
  assert.deepStrictEqual(chooseSpell(state, ctx), { idx: idx("Freeze"), tier: "rotation", score: 455 });
});

test("ROTATION on, Freeze uncastable: Weaken wins at 452", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const state = mkState(mu({ grimoire: ["Weaken", "Doze", "Fireball"] }), fight(1));
  assert.deepStrictEqual(chooseSpell(state, ctx), { idx: idx("Weaken"), tier: "rotation", score: 452 });
});

test("ROTATION on, the combat is already weakened: Doze wins at 450 (Weaken skipped, same as the normal table)", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const state = mkState(mu({ grimoire: ["Weaken", "Doze", "Fireball"] }), fight(1, { weakened: true }));
  assert.deepStrictEqual(chooseSpell(state, ctx), { idx: idx("Doze"), tier: "rotation", score: 450 });
});

test("ROTATION on, Freeze uncastable, the combat weakened AND the target already asleep: falls back to the normal table (Fireball)", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const combat = fight(1, { weakened: true });
  combat.foes[0].asleep = 3;
  const state = mkState(mu({ grimoire: ["Weaken", "Doze", "Fireball"] }), combat);
  assert.deepStrictEqual(chooseSpell(state, ctx), { idx: idx("Fireball"), tier: "damage", score: 315 });
});

test("ROTATION on, below the potion threshold with Heal castable: Heal (defensive, 460 + expected) still outranks the rotation", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const state = mkState(mu({ grimoire: ["Freeze", "Weaken", "Doze", "Heal"], wp: 10, maxWP: 40 }), fight(1));
  assert.deepStrictEqual(chooseSpell(state, ctx), { idx: idx("Heal"), tier: "heal", score: 465.5 });
});

test("ROTATION on, a non-Magic User: chooseSpell still returns null exactly as today", () => {
  const ctx = makeBotContext({ controlRotation: true });
  const fighter = { cls: "Fighter", sub: "Soldier", level: 1, wp: 40, maxWP: 40, grimoire: [], items: [], spellsUsed: 0 };
  const state = mkState(fighter, fight(1));
  assert.strictEqual(chooseSpell(state, ctx), null);
});

test("botLine: controlRotation=on is inserted immediately before startDepth, which stays last; the flag is omitted when falsy", () => {
  const off = botLine(BOT_DEFAULTS);
  assert.equal(off.includes("controlRotation"), false);
  assert.ok(off.endsWith(`startDepth=${BOT_DEFAULTS.startDepth}`));

  const on = botLine({ ...BOT_DEFAULTS, controlRotation: true });
  assert.ok(on.endsWith("controlRotation=on  startDepth=1"));
});

test("both tune CLIs accept --control-rotation (source check — neither exports its parser, and both run main() on import)", () => {
  const tuneClasses = fs.readFileSync(path.join(REPO_ROOT, "tools", "tune-classes.mjs"), "utf8");
  const tuneDifficulty = fs.readFileSync(path.join(REPO_ROOT, "tools", "tune-difficulty.mjs"), "utf8");
  assert.match(tuneClasses, /--control-rotation/);
  assert.match(tuneClasses, /opts\.controlRotation\s*=\s*true/);
  assert.match(tuneDifficulty, /--control-rotation/);
  assert.match(tuneDifficulty, /opts\.controlRotation\s*=\s*true/);
});
