// test/unit/honest-gains.test.js
//
// Phase 79, plan 79-02 (VOX-05 rubric point 4: "accurate to what the engine
// actually did"). Two routed number-honesty todos:
//
//   - 2026-09-25 "heal lines narrate the raw roll, not the HP gained": every
//     event that narrates HP coming back to the hero or a party member
//     carries an additive `gained` — the HP actually added after the clamp
//     to max (after minus before), 0 when already full. Existing fields
//     (`amount`, `wp`, `halved`, `doubled`, `rolled`) keep their meaning.
//   - 2026-09-26 "Table 4 roll line prints the canon cell": every tableFour
//     event carries additive `row` (the cell it dispatched on), `stat`
//     ("hp" | "maxHp" | "xp" | "armor") and, for a numeric row, a signed
//     `amount` equal to the change the row really made (HERO_HP_SCALE /
//     HERO_SP_SCALE-scaled, clamped for a heal). The engine's `result` prose
//     keeps the voice and loses the number.
//
// Every case drives the REAL engine function. The draw-count pins were
// measured at the plan base (cd560cc8) before any engine edit: the fields
// are additive and draw nothing.
//
// This file runs at the SHIPPED dials (no identity override), so the Table
// 4 amounts are the numbers a player actually sees.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, drinkPotion } from "../../engine/magic.js";
import { useItem } from "../../engine/items.js";
import { foeTurn, killFoe, alliesTurn } from "../../engine/combat.js";
import { useAbility } from "../../engine/abilities.js";
import { tableFour, findFood, meetFaerie, encounterDot } from "../../engine/encounters.js";
import { newDay, descend } from "../../engine/movement.js";
import { checkLevel } from "../../engine/character.js";
import { buyFrom } from "../../engine/economy.js";
import { newRun } from "../../engine/state.js";
import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";
import { dotHpFor, heroSpFor } from "../../engine/difficulty.js";
import { SPELLS, THRESHOLDS } from "../../content/index.js";
import { ENCOUNTER_TABLES } from "../../content/encounters.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));

/** countingRng(seq, fill) — `.d()`/`.pick()` pop `seq`, then return `fill`
 * forever; `counter.draws` tallies every draw (the draw-count pins). */
function countingRng(seq = [], fill = 20) {
  let i = 0;
  const counter = { draws: 0 };
  const next = () => {
    counter.draws++;
    return i < seq.length ? seq[i++] : fill;
  };
  return { d: () => next(), pick: (arr) => (next(), arr[0]), shuffle: (a) => a, counter };
}

function fixedHero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Guard", race: "Human", level: 1, sp: 0,
    maxWP: 100, wp: 50, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 3, rations: 6, gold: 500, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    strengthBoost: 0, regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 5, py: 5, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedHero(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "", pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 2, target: 0, pending: false, spellOpen: false, tracked: false, ...overrides };
}

const find = (events, type) => events.find((e) => e.type === type);

/** The three standard cases every gain site is pinned at. */
const NEAR = 3; // hp below max
const FAR = 90; // hp below max (more than any single roll here)

// ── 1. `gained` at every hero gain site ───────────────────────────────────

test("potionDrunk: `gained` is the HP actually added (near full 3, far from full the roll, full 0); `amount` stays the roll; 1 draw", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 21], [0, 0]]) {
    const state = fixedState({ c: { wp: 100 - missing } });
    const rng = countingRng([8]); // 2*8 + 5 = 21
    const e = find(drinkPotion(state, rng, []), "potionDrunk");
    assert.equal(e.amount, 21, "amount keeps the roll");
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(state.c.wp, 100 - missing + expectGained);
    assert.equal(rng.counter.draws, 1);
  }
});

test("potionDrunk: a heal2x race's doubled dose keeps `doubled` and reports the clamped gain", () => {
  const state = fixedState({ c: { race: "Wilmsry", wp: 100 - NEAR } });
  const e = find(drinkPotion(state, countingRng([8]), []), "potionDrunk");
  assert.equal(e.amount, 42);
  assert.equal(e.doubled, "Wilmsry");
  assert.equal(e.gained, NEAR);
});

test("healed (castSpell Heal): `gained` near full, far and full; a Summoner's halved heal never gains more than the halved amount; 1 draw", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 8], [0, 0]]) {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: ["Heal"], wp: 100 - missing } });
    const rng = countingRng([8]);
    const e = find(castSpell(state, SPELL_IDX.Heal, rng, []), "healed");
    assert.equal(e.amount, 8);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(rng.counter.draws, 1);
  }
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 4], [0, 0]]) {
    const state = fixedState({ c: { cls: "Magic User", sub: "Summoner", grimoire: ["Heal"], wp: 100 - missing } });
    const e = find(castSpell(state, SPELL_IDX.Heal, countingRng([8]), []), "healed");
    assert.equal(e.amount, 4);
    assert.equal(e.halved, true);
    assert.equal(e.gained, expectGained, `Summoner missing ${missing}`);
    assert.ok(e.gained <= e.amount);
  }
});

test("healed (a healing potion item, and an Xtra Healing 'full' potion): `gained` is the real delta; draws 1 and 0", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 10], [0, 0]]) {
    const state = fixedState({ c: { wp: 100 - missing, items: [{ kind: "potion", n: "Healing potion", eff2: "heal", uses: 1 }] } });
    const rng = countingRng([8]); // d10 8 + 2
    const e = find(useItem(state, 0, rng, []), "healed");
    assert.equal(e.amount, 10);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(rng.counter.draws, 1);
  }
  for (const missing of [NEAR, FAR, 0]) {
    const state = fixedState({ c: { wp: 100 - missing, items: [{ kind: "potion", n: "Xtra Healing potion", eff2: "full", uses: 1 }] } });
    const rng = countingRng([]);
    const e = find(useItem(state, 0, rng, []), "healed");
    assert.equal(e.amount, 100, "amount keeps its old meaning (maxWP)");
    assert.equal(e.gained, missing);
    assert.equal(rng.counter.draws, 0);
  }
});

test("cloakRegenerated: `gained` equals the clamped amount; 1 draw", () => {
  const CLOAK = { kind: "cloak", n: "Cloak of Regeneration", eff: { cloakRegen: 1 }, txt: "" };
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 6], [0, 0]]) {
    const state = fixedState({ c: { wp: 100 - missing, worn: { cloak: { ...CLOAK } } } });
    const rng = countingRng([6]);
    const e = find(useItem(state, { slot: "cloak" }, rng, []), "cloakRegenerated");
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(e.amount, expectGained, "amount was already the clamped value");
    assert.equal(rng.counter.draws, 1);
  }
});

test("regenerated (the hero's Regeneration tick): `gained` near full and far; no tick event at full; 1 draw", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 7]]) {
    const state = fixedState({ c: { regen: true, wp: 100 - missing } });
    state.combat = fixedCombat([]);
    const rng = countingRng([7]);
    const e = find(foeTurn(state, rng, []), "regenerated");
    assert.equal(e.amount, 7);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(rng.counter.draws, 1);
  }
  const full = fixedState({ c: { regen: true, wp: 100 } });
  full.combat = fixedCombat([]);
  const rng = countingRng([7]);
  assert.equal(find(foeTurn(full, rng, []), "regenerated"), undefined);
  assert.equal(rng.counter.draws, 1, "the d8 is still drawn at full");
});

test("foodFound: `gained` is the real delta, `wp` keeps the food's value; 1 draw", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 15], [0, 0]]) {
    const state = fixedState({ c: { wp: 100 - missing } });
    const rng = countingRng([6]); // Meat, 15
    const e = find(findFood(state, rng, []), "foodFound");
    assert.equal(e.wp, 15);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(rng.counter.draws, 1);
  }
});

test("secondWindHealed (hero): `gained` equals the clamped amount; `rolled` unchanged", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 10], [0, 0]]) {
    const state = fixedState({ c: { abilities: ["secondWind"], level: 2, wp: 100 - missing } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    const rng = countingRng([8]);
    const e = find(useAbility(state, "secondWind", rng, []), "secondWindHealed");
    assert.equal(e.rolled, 10);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(e.amount, expectGained);
  }
});

test("memberSecondWind (a Joiner): carries `gained` for the member (and the roll as `rolled`)", () => {
  const sheet = { name: "Ada", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 20, maxWP: 20, status: "ok", weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Studded", grimoire: [], spellsUsed: 0, abilities: ["secondWind"] };
  for (const [allyWp, expectGained] of [[8, 6], [9, 6]]) {
    const state = fixedState({ party: [{ ...sheet }] });
    const ally = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: allyWp, maxWP: 20 };
    state.combat = fixedCombat([fixedFoe()], { allies: [ally] });
    const e = find(alliesTurn(state, countingRng([5]), []), "memberSecondWind"); // 5 + 1
    assert.equal(e.gained, expectGained);
    assert.equal(e.amount, expectGained);
    assert.equal(e.rolled, 6);
  }
  // Capped: 4/9 below half, a roll of 6 would reach 10; the clamp keeps 5.
  const state = fixedState({ party: [{ ...sheet }] });
  const ally = { partyIdx: 0, name: "Ada", lvl: 1, sub: "Fighter", wp: 4, maxWP: 9 };
  state.combat = fixedCombat([fixedFoe()], { allies: [ally] });
  const e = find(alliesTurn(state, countingRng([5]), []), "memberSecondWind");
  assert.equal(e.gained, 5);
  assert.equal(e.rolled, 6);
  assert.equal(ally.wp, 9);
});

test("cooked (a Cooking hero eats the beast): `gained` is the real delta, `wp` keeps the portion", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 10], [0, 0]]) {
    const state = fixedState({ c: { skills: { Cooking: 1 }, level: 5, sp: 99999, wp: 100 - missing } });
    const foe = fixedFoe({ type: "Beasts", maxWP: 40, wp: 0 });
    state.combat = fixedCombat([foe]);
    const e = find(killFoe(state, foe, countingRng([1, 1, 20]), []), "cooked");
    assert.equal(e.wp, 10);
    assert.equal(e.gained, expectGained, `missing ${missing}`);
  }
});

test("rested (a fed night's camp heal): carries `gained` equal to the real delta; no rested event at full", () => {
  for (const missing of [NEAR, FAR]) {
    const state = fixedState({ c: { wp: 100 - missing } });
    const before = state.c.wp;
    const e = find(newDay(state, true, countingRng([], 20), []), "rested");
    assert.ok(e, "a rested event");
    assert.equal(e.gained, state.c.wp - before);
    assert.equal(e.gained, e.amount);
  }
  const full = fixedState({ c: { wp: 100 } });
  assert.equal(find(newDay(full, true, countingRng([], 20), []), "rested"), undefined);
});

test("rested: the draw count is the same near full, far and at full (the fields draw nothing)", () => {
  const counts = [NEAR, FAR, 0].map((missing) => {
    const rng = countingRng([], 20);
    newDay(fixedState({ c: { wp: 100 - missing } }), true, rng, []);
    return rng.counter.draws;
  });
  assert.deepEqual(counts, [9, 9, 9]);
});

// Quick fix 79-02c (user ruling 2026-09-27): the stairs heal nothing. The
// per-floor regen and its floorRegen event are gone; this row now pins that
// arriving on a new floor brings no hp back and emits no gain event, and that
// the rng cursor is the plan base's (the regen never drew).
test("descend (arrival on a new floor): no hp comes back and no floorRegen event; the rng cursor matches the plan base", () => {
  for (const missing of [NEAR, 40]) {
    const state = newRun(7, [], { startDepth: 2 });
    state.c.wp = state.c.maxWP - missing;
    const before = state.c.wp;
    const rng = makeRng(12345);
    const events = descend(state, rng, []);
    assert.equal(find(events, "floorRegen"), undefined, "no floorRegen event");
    const levelGain = events.filter((e) => e.type === "leveled").reduce((s, e) => s + e.gained, 0);
    assert.equal(state.c.wp, before + levelGain, "hp = before (+ any level-up gain), nothing from the stairs");
    assert.equal(rng.getState(), DESCEND_CURSOR[missing], `missing ${missing}: rng cursor`);
  }
});
// Measured at the plan base (cd560cc8), seed 7 / rng 12345.
const DESCEND_CURSOR = { [NEAR]: -869104716, 40: -869104716 };

test("leveled: `gained` equals the HP the level-up added (a raise, never clamped)", () => {
  for (const missing of [NEAR, FAR, 0]) {
    const state = fixedState({ c: { wp: 100 - missing, sp: THRESHOLDS[1] } });
    const before = state.c.wp;
    const rng = countingRng([5]);
    const e = find(checkLevel(state, rng, []), "leveled");
    assert.ok(e);
    assert.equal(e.gained, e.wpGain);
    assert.equal(state.c.wp - before, e.gained);
  }
});

test("faerieBoon (+d20 base HP): `gained` equals the raise; 2 draws", () => {
  const state = fixedState({ c: { wp: 97 } });
  const rng = countingRng([2, 13]);
  const e = find(meetFaerie(state, rng, []), "faerieBoon");
  assert.equal(e.amount, 13);
  assert.equal(e.gained, 13);
  assert.equal(state.c.wp, 110);
  assert.equal(rng.counter.draws, 2);
});

test("bought (a store meal): the purchase event carries `gained`, the HP the meal really restored", () => {
  for (const [missing, expectGained] of [[NEAR, NEAR], [FAR, 12], [0, 0]]) {
    const state = fixedState({ c: { wp: 100 - missing } });
    state.store = { stock: [{ n: "Chicken (+12 hp)", sub: null, cost: 20, effectId: "eatRation", effectParams: { wp: 12 }, sold: false }] };
    const e = find(buyFrom(state, 0, []), "bought");
    assert.equal(e.gained, expectGained, `missing ${missing}`);
    assert.equal(e.meal, 12, "the meal's portion rides beside it");
    assert.equal(state.c.wp, 100 - missing + expectGained);
  }
  // A non-food purchase carries no `gained` at all.
  const state = fixedState();
  state.store = { stock: [{ n: "Rations", sub: null, cost: 30, effectId: "buyRations", effectParams: { amount: 1 }, sold: false }] };
  assert.equal(Object.hasOwn(find(buyFrom(state, 0, []), "bought"), "gained"), false);
});

// ── 2. Table 4: row / stat / amount, number-free prose ─────────────────────

test("tableFour '-15 HP' at depth 3, shipped dials: row, stat 'hp', amount −dotHpFor('mid'), and HP drops by exactly that", () => {
  const n = dotHpFor("mid");
  assert.equal(n, 19, "sanity: the user's device log read 19");
  const state = fixedState({ c: { wp: 60 }, floor: { depth: 3 } });
  const rng = countingRng([]);
  const e = find(tableFour(state, "-15 HP", rng, []), "tableFour");
  assert.equal(e.row, "-15 HP");
  assert.equal(e.stat, "hp");
  assert.equal(e.amount, -n);
  assert.equal(state.c.wp, 60 - n);
  assert.equal(rng.counter.draws, 0);
});

test("tableFour '+10 HP' and '-10 HP': a heal three below full reads +3 (clamped); at full +0; the loss is −dotHpFor('small')", () => {
  const n = dotHpFor("small");
  const near = fixedState({ c: { wp: 100 - NEAR } });
  const eNear = find(tableFour(near, "+10 HP", countingRng([]), []), "tableFour");
  assert.equal(eNear.stat, "hp");
  assert.equal(eNear.amount, NEAR);
  assert.equal(eNear.rolled, n, "the row's scaled heal rides as `rolled`");
  const far = fixedState({ c: { wp: 10 } });
  assert.equal(find(tableFour(far, "+10 HP", countingRng([]), []), "tableFour").amount, n);
  const full = fixedState({ c: { wp: 100 } });
  assert.equal(find(tableFour(full, "+10 HP", countingRng([]), []), "tableFour").amount, 0);
  const hurt = fixedState({ c: { wp: 50 } });
  const eHurt = find(tableFour(hurt, "-10 HP", countingRng([]), []), "tableFour");
  assert.deepEqual([eHurt.row, eHurt.stat, eHurt.amount], ["-10 HP", "hp", -n]);
  assert.equal(hurt.c.wp, 50 - n);
});

test("tableFour '+25 HP': stat 'maxHp', amount +dotHpFor('large'), max and current both rise by it", () => {
  const n = dotHpFor("large");
  const state = fixedState({ c: { wp: 40 } });
  const e = find(tableFour(state, "+25 HP", countingRng([]), []), "tableFour");
  assert.deepEqual([e.row, e.stat, e.amount], ["+25 HP", "maxHp", n]);
  assert.equal(state.c.maxWP, 100 + n);
  assert.equal(state.c.wp, 40 + n);
});

test("tableFour XP rows: stat 'xp', amount +heroSpFor(10 | 25)", () => {
  for (const [row, base] of [["+10 XP", 10], ["+25 XP", 25]]) {
    const state = fixedState({ c: { level: 5, sp: 99999 } });
    const e = find(tableFour(state, row, countingRng([]), []), "tableFour");
    assert.deepEqual([e.row, e.stat, e.amount], [row, "xp", heroSpFor(base)]);
  }
});

test("tableFour '-All armour': stat 'armor' and no amount", () => {
  const state = fixedState();
  const e = find(tableFour(state, "-All armour", countingRng([]), []), "tableFour");
  assert.equal(e.row, "-All armour");
  assert.equal(e.stat, "armor");
  assert.equal(Object.hasOwn(e, "amount"), false);
});

test("tableFour: no row's `result` prose holds a digit (the builder prints the number)", () => {
  for (const row of ["+10 HP", "-10 HP", "+10 XP", "+25 HP", "+25 XP", "-15 HP", "-All armour"]) {
    const state = fixedState({ c: { level: 5, sp: 99999, wp: 90 } });
    const e = find(tableFour(state, row, countingRng([]), []), "tableFour");
    assert.ok(e && typeof e.result === "string" && e.result.length > 0, row);
    assert.doesNotMatch(e.result, /\d/, `${row}: "${e.result}"`);
  }
});

// ── 3. The clamp-site source guard ─────────────────────────────────────────

function stripComments(source) {
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  return noBlock.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
}

/** An HP clamp to max: `Math.min(X.maxWP, X.wp + …)`, `Math.min(…, X.maxWP - X.wp …)`, or `X.wp = X.maxWP;`. */
const CLAMP_PATTERNS = [
  /Math\.min\(\s*([\w.]+)\.maxWP\s*,\s*\1\.wp\s*\+/,
  /Math\.min\([^;]*?\b([\w.]+)\.maxWP\s*-\s*\1\.wp\b/,
  /\b([\w.]+)\.wp\s*=\s*\1\.maxWP\s*;/,
];

/** The allowlist: FOE heals, which already report the clamped amount (or
 * carry no hero/member HP at all). Keyed by file and the exact clamp text. */
const CLAMP_ALLOWLIST = [
  { file: "engine/foeAbilities.js", text: "f.wp = Math.min(f.maxWP, f.wp + amt)", why: "a foe's own Heal ability; foeHealed already reports the clamped amount" },
  { file: "engine/foeAbilities.js", text: "f.wp = Math.min(f.maxWP, f.wp + dmg)", why: "a foe's life-drain heals the foe, not the hero" },
  { file: "engine/foeAbilities.js", text: "f.wp = Math.min(f.maxWP, f.wp + hit.applied)", why: "a foe's life-drain heals the foe, not the hero" },
  { file: "engine/scrollFumble.js", text: "t.wp = Math.min(t.maxWP, t.wp + amount)", why: "a fumbled heal lands on a foe; fumbleOnFoe already reports the clamped amount" },
  { file: "engine/combat.js", text: "const amount = Math.min(f.maxWP - f.wp, foeRegenRng.d(8))", why: "foe Regeneration; foeRegenerated already reports the clamped amount" },
  { file: "engine/combat.js", text: "f.wp = f.maxWP;", why: "a foe's second life (foeRevived), not a hero or member heal" },
];

test("source guard: every hero or member HP clamp to max in engine/*.js sits beside an event carrying `gained` (or is allowlisted with a reason)", () => {
  const dir = path.join(REPO_ROOT, "engine");
  const offenders = [];
  const allowHits = new Map(CLAMP_ALLOWLIST.map((a) => [a, 0]));
  let clampSites = 0;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const rel = `engine/${name}`;
    const lines = stripComments(fs.readFileSync(path.join(dir, name), "utf8"));
    lines.forEach((line, i) => {
      if (!CLAMP_PATTERNS.some((re) => re.test(line))) return;
      clampSites++;
      const allow = CLAMP_ALLOWLIST.find((a) => a.file === rel && line.includes(a.text));
      if (allow) {
        allowHits.set(allow, allowHits.get(allow) + 1);
        return;
      }
      const window = lines.slice(i, i + 8).join("\n");
      if (!/\bgained\b/.test(window)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], "a new hero/member HP clamp must push an event carrying `gained` (or be allowlisted with a reason)");
  for (const [a, hits] of allowHits) assert.ok(hits > 0, `stale allowlist entry: ${a.file} "${a.text}"`);
  assert.ok(clampSites >= 15, `non-vacuity: the scan found ${clampSites} clamp sites`);
});

// ── 4. The death log's engine half: one event, one number ─────────────────

test("death log (engine): Table 4 roll 7 at depth 3 lands the '-15 HP' row; tableFour's amount equals the HP the hero really lost", () => {
  const state = fixedState({ c: { wp: 15 }, floor: { depth: 3 } });
  const before = state.c.wp;
  const events = encounterDot(state, countingRng([4, 7]), []);
  const rolled = find(events, "encounterRolled");
  assert.deepEqual([rolled.table, rolled.roll, rolled.result], [4, 7, "-15 HP"]);
  const t4 = find(events, "tableFour");
  assert.equal(t4.amount, -19);
  assert.ok(state.dead, "15 hp against a 19 hp toll is fatal");
  assert.ok(before + t4.amount <= 0, "the narrated loss explains the death");
});

// ── 5. The lines say it (Task 3): Oracle and rail ─────────────────────────

const plain = (html) => String(html).replace(/<[^>]+>/g, "");
const oracle = (e) => plain(EVENT_NARRATION[e.type](e));
const rail = (e) => LINE_FOR[e.type](e, {}).text;

/** Every gain builder the scan found: a factory for (on offer, gained). */
const GAIN_BUILDERS = {
  healed: (n, g) => ({ type: "healed", amount: n, gained: g, spell: "Heal" }),
  potionDrunk: (n, g) => ({ type: "potionDrunk", amount: n, gained: g, remaining: 2 }),
  regenerated: (n, g) => ({ type: "regenerated", amount: n, gained: g }),
  foodFound: (n, g) => ({ type: "foodFound", name: "Meat", wp: n, gained: g }),
  secondWindHealed: (n, g) => ({ type: "secondWindHealed", amount: g, rolled: n, gained: g }),
  memberSecondWind: (n, g) => ({ type: "memberSecondWind", name: "Ada", amount: g, rolled: n, gained: g }),
  cooked: (n, g) => ({ type: "cooked", wp: n, rations: 1, gained: g }),
  bought: (n, g) => ({ type: "bought", item: "Chicken", cost: 20, meal: n, gained: g }),
  tableFour: (n, g) => ({ type: "tableFour", result: "The maze, for once, gives something back.", row: "+10 HP", stat: "hp", amount: g, rolled: n, gained: g }),
};

test("gain lines lead with the HP actually gained: capped adds the roll and 'full'; exact reads plain; zero says nothing came back (Oracle and rail)", () => {
  for (const [type, make] of Object.entries(GAIN_BUILDERS)) {
    // capped: 8 on offer, 3 gained
    const capped = make(8, 3);
    const oc = oracle(capped);
    const rc = rail(capped);
    assert.match(oc, /\+3 hp/, `${type} Oracle capped: ${oc}`);
    assert.match(oc, /\b8\b/, `${type} Oracle capped names the 8: ${oc}`);
    assert.match(oc, /full/, `${type} Oracle capped says full: ${oc}`);
    assert.doesNotMatch(oc, /\+8 hp/, `${type} Oracle capped never prints the roll as the gain: ${oc}`);
    assert.match(rc, /\+3 hp/, `${type} rail capped: ${rc}`);
    assert.match(rc, /full/, `${type} rail capped says full: ${rc}`);
    assert.doesNotMatch(rc, /\+8 hp/, `${type} rail capped: ${rc}`);
    // The gain leads: the 8 only appears after the "+3 hp".
    assert.doesNotMatch(oc.slice(0, oc.indexOf("+3 hp")), /\b8\b/, `${type}: the gain leads, the 8 trails: ${oc}`);
    // exact: 8 on offer, 8 gained — no capped clause
    const exact = make(8, 8);
    assert.match(oracle(exact), /\+8 hp/, `${type} Oracle exact`);
    assert.doesNotMatch(oracle(exact), /back to full/, `${type} Oracle exact has no capped clause: ${oracle(exact)}`);
    assert.match(rail(exact), /\+8 hp/, `${type} rail exact`);
    assert.doesNotMatch(rail(exact), /back to full/, `${type} rail exact: ${rail(exact)}`);
    // zero: already full — no "+0"
    const zero = make(8, 0);
    for (const [surface, text] of [["Oracle", oracle(zero)], ["rail", rail(zero)]]) {
      assert.doesNotMatch(text, /\+0\b/, `${type} ${surface} zero prints no +0: ${text}`);
      assert.doesNotMatch(text, /\+8 hp/, `${type} ${surface} zero: ${text}`);
      assert.match(text, /already at full/, `${type} ${surface} zero says nothing came back: ${text}`);
    }
  }
});

test("the gain lines with no pre-clamp value (cloak, rest, level-up, faerie) read `gained`; the cloak at full says so", () => {
  assert.match(oracle({ type: "cloakRegenerated", amount: 4, gained: 4 }), /\+4 hp/);
  assert.match(rail({ type: "cloakRegenerated", amount: 4, gained: 4 }), /\+4 hp/);
  for (const text of [oracle({ type: "cloakRegenerated", amount: 0, gained: 0 }), rail({ type: "cloakRegenerated", amount: 0, gained: 0 })]) {
    assert.doesNotMatch(text, /\+0\b/, text);
    assert.match(text, /already at full/, text);
  }
  assert.match(oracle({ type: "rested", amount: 6, gained: 6 }), /\+6 hp/);
  assert.match(rail({ type: "rested", amount: 5, gained: 5 }), /\+5 hp/);
  assert.match(oracle({ type: "leveled", level: 2, wpGain: 7, gained: 7 }), /\+7 hp/);
  assert.match(rail({ type: "faerieBoon", amount: 13, gained: 13 }), /\+13 base hp/);
});

test("a potion's doubled dose keeps its clause on the honest line", () => {
  const e = { type: "potionDrunk", amount: 42, gained: 3, remaining: 1, doubled: "Wilmsry" };
  assert.match(oracle(e), /\+3 hp/);
  assert.match(oracle(e), /Wilmsry: twice the dose/);
  assert.match(rail(e), /Wilmsry/);
});

test("a hand-built gain event without `gained` still renders its amount", () => {
  assert.match(oracle({ type: "healed", amount: 5 }), /\+5 hp/);
  assert.match(rail({ type: "potionDrunk", amount: 7, remaining: 0 }), /\+7 hp/);
});

test("encounterRolled: no ENCOUNTER_TABLES cell renders a digit or a sign after 'The dice decide'; every Table 4 numeric row reads as its effect", () => {
  const TABLE_FOUR_SIGNED = ENCOUNTER_TABLES[3].filter((cell) => /[\d+\-−]/.test(cell));
  assert.ok(TABLE_FOUR_SIGNED.length >= 7, "sanity: the Table 4 numeric/signed cells");
  ENCOUNTER_TABLES.forEach((cells, t) => cells.forEach((cell, r) => {
    const text = oracle({ type: "encounterRolled", table: t + 1, roll: r + 1, result: cell });
    assert.match(text, /^Table \d+, roll \d+: The dice decide — /, text);
    const tail = text.replace(/^Table \d+, roll \d+: The dice decide — /, "");
    assert.doesNotMatch(tail, /\d/, `table ${t + 1} roll ${r + 1}: ${text}`);
    assert.doesNotMatch(tail, /(^|\s)[+\-−]/, `table ${t + 1} roll ${r + 1}: ${text}`);
    if (TABLE_FOUR_SIGNED.includes(cell)) assert.ok(!tail.includes(cell), `${cell} reads as its effect: ${text}`);
  }));
  assert.match(oracle({ type: "encounterRolled", table: 4, roll: 7, result: "-15 HP" }), /The dice decide — a toll\.$/);
});

test("tableFour lines: the prose, then the signed amount (U+2212 for a loss) on both surfaces; XP reads experience; armour prints no number", () => {
  const toll = { type: "tableFour", result: "The maze extracts a toll you did not agree to.", row: "-15 HP", stat: "hp", amount: -19 };
  assert.equal(oracle(toll), "The maze extracts a toll you did not agree to. −19 hp.");
  assert.match(rail(toll), /−19 hp/);
  assert.doesNotMatch(oracle(toll) + rail(toll), /-19|-15|15/);
  const big = { type: "tableFour", result: "A rare kindness — you come away tougher, for keeps.", row: "+25 HP", stat: "maxHp", amount: 31, gained: 31 };
  assert.match(oracle(big), /\+31 max hp/);
  assert.match(rail(big), /\+31 max hp/);
  const xp = { type: "tableFour", result: "A hard lesson, and you actually learned it.", row: "+25 XP", stat: "xp", amount: 31 };
  assert.match(oracle(xp), /\+31 experience/);
  assert.match(rail(xp), /\+31 experience/);
  const armour = { type: "tableFour", result: "Your armour sloughs off in useless flakes. Whatever you were wearing, you no longer are.", row: "-All armour", stat: "armor" };
  assert.doesNotMatch(oracle(armour) + rail(armour), /\d/);
});

test("death log reproduction (depth 3, the '-15 HP' row) through the real engine and both surfaces: the roll line has no number, the effect line's number is the HP lost, nothing prints -15", () => {
  const run = (wp) => {
    const state = fixedState({ c: { wp }, floor: { depth: 3 } });
    const events = encounterDot(state, countingRng([4, 7]), []);
    const oracleLines = events.filter((e) => EVENT_NARRATION[e.type]).map((e) => oracle(e));
    const railLines = events.filter((e) => LINE_FOR[e.type]).map((e) => rail(e));
    return { state, oracleLines, railLines };
  };
  // A survivor: the number printed is exactly the HP that left.
  const alive = run(40);
  const lost = 40 - alive.state.c.wp;
  assert.equal(lost, 19);
  assert.ok(alive.oracleLines.includes("Table 4, roll 7: The dice decide — a toll."), alive.oracleLines.join(" | "));
  assert.ok(alive.oracleLines.includes(`The maze extracts a toll you did not agree to. −${lost} hp.`), alive.oracleLines.join(" | "));
  assert.ok(alive.railLines.some((l) => l.includes(`−${lost} hp`)), alive.railLines.join(" | "));
  // The user's death: the same one number, once, with a minus sign.
  const dead = run(15);
  assert.ok(dead.state.dead);
  const all = [...dead.oracleLines, ...dead.railLines].join("\n");
  assert.doesNotMatch(all, /-15|15 HP|\b15\b/, all);
  assert.match(all, /−19 hp/);
  assert.equal(dead.oracleLines.filter((l) => /19/.test(l)).length, 1, "one Oracle line carries the number");
});
