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
import { setIdentityDials, withIdentity } from "./harness/identityDials.js";
import { DIALS } from "../../engine/difficulty.js";

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

  // User rulings 2026-09-28 (re-pinned): Freeze never kills outright any
  // more, so the KILL-tier example is a Wizard's Plane Gate against Demons
  // (402); a lone Freeze is a DISABLE (230 offensive) at every depth.
  const killState = mkState(mu({ sub: "Wizard", grimoire: ["Plane Gate"] }), fight(1, { type: "Demons" }));
  assert.deepStrictEqual(chooseSpell(killState, ctxOff), chooseSpell(killState, ctxOmitted));
  assert.deepStrictEqual(chooseSpell(killState, ctxOmitted), { idx: idx("Plane Gate"), tier: "kill", score: 402 });
  const freezeState = mkState(mu({ grimoire: ["Freeze"] }), fight(1));
  assert.deepStrictEqual(chooseSpell(freezeState, ctxOff), chooseSpell(freezeState, ctxOmitted));
  assert.deepStrictEqual(chooseSpell(freezeState, ctxOmitted), { idx: idx("Freeze"), tier: "disable", score: 230 });

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

// ---------------------------------------------------------------------------
// Phase 75.3, Plan 05 (RULES-18): the default bot plays the new Freeze. Past
// the knee a landed Freeze holds instead of killing, so chooseSpell scores it
// as a DISABLE (Stun's 230 / 450, allowed against one foe) and
// hasCastableKillTier ignores it; the opt-in rotation still ranks it first at
// every depth (it replays the exploit). These run under the SHIPPED
// CONTROL_AT_DEPTH (holdRounds 3 past floor 12) on top of this file's
// identity default — the identity dial never holds, so it cannot show the
// change.
// ---------------------------------------------------------------------------

const SHIPPED_CONTROL = { CONTROL_AT_DEPTH: DIALS.CONTROL_AT_DEPTH };

/** atDepth(state, depth) — chooseSpell reads state.floor.depth for the hold dial. */
function atDepth(state, depth) {
  return { ...state, floor: { depth } };
}

// User rulings 2026-09-28 (re-pinned, plan 79.2-01): a Freeze never kills
// outright at any depth (its damage, then a d4 hold), so the default bot
// scores it as a DISABLE on floor 12 exactly as on floor 20 — the bot plays
// the new rule.
test("default bot (user rulings 2026-09-28): Freeze + Fireball vs one foe picks Fireball (DAMAGE) on floor 12 and floor 20 alike — Freeze is no KILL", () => {
  withIdentity(SHIPPED_CONTROL, () => {
    const ctx = makeBotContext();
    const base = mkState(mu({ grimoire: ["Freeze", "Fireball"] }), fight(1));
    for (const depth of [12, 20]) {
      const pick = chooseSpell(atDepth(base, depth), ctx);
      assert.equal(pick.idx, idx("Fireball"), `depth ${depth}`);
      assert.equal(pick.tier, "damage", `depth ${depth}`);
    }
  });
});

test("default bot (user rulings 2026-09-28): a lone castable Freeze scores Stun's DISABLE (230 offensive, 450 defensive) at every depth, even against one foe", () => {
  withIdentity(SHIPPED_CONTROL, () => {
    const ctx = makeBotContext();
    for (const depth of [12, 20]) {
      const one = atDepth(mkState(mu({ grimoire: ["Freeze"] }), fight(1)), depth);
      assert.deepStrictEqual(chooseSpell(one, ctx), { idx: idx("Freeze"), tier: "disable", score: 230 }, `depth ${depth}`);
      // Two foes and no castable KILL tier (Freeze never counts): defensive.
      const two = atDepth(mkState(mu({ grimoire: ["Freeze"] }), fight(2)), depth);
      assert.deepStrictEqual(chooseSpell(two, ctx), { idx: idx("Freeze"), tier: "disable", score: 450 }, `depth ${depth}`);
      assert.equal(ctx.lastSpellMode, "defensive", `depth ${depth}`);
    }
  });
});

test("RULES-18 rotation: with controlRotation on, Freeze + Fireball vs one foe picks Freeze (455) on floor 12 and floor 20 alike", () => {
  withIdentity(SHIPPED_CONTROL, () => {
    const ctx = makeBotContext({ controlRotation: true });
    const base = mkState(mu({ grimoire: ["Freeze", "Fireball"] }), fight(1));
    for (const depth of [12, 20]) {
      assert.deepStrictEqual(chooseSpell(atDepth(base, depth), ctx), { idx: idx("Freeze"), tier: "rotation", score: 455 }, `depth ${depth}`);
    }
  });
});
