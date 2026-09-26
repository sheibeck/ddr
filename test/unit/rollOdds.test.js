// test/unit/rollOdds.test.js
//
// Phase 74 (ROLL-02/03), plan 74-04 Task 1 — coverage for
// src/browser/rollOdds.js: the one module every non-event "right now" odds
// reading is computed through. Every case below is checked against the
// engine's own derived functions directly (never a hand-rolled formula), so
// this test proves rollOdds.js reads what it claims to read, not merely
// that its output matches a hardcoded string.
//
// fixedFighter/fixedFloor/fixedState/fixedFoe mirror
// test/unit/odds-helpers.test.js's own fixtures verbatim (this repo's
// established per-file-fixture convention — never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { heroHitOdds, heroHitOddsVs, foeHitOddsVs, fleeOdds, scrollReadOdds } from "../../src/browser/rollOdds.js";
import { toHit, afraidNeed, strikeDie, foeDie, fleeBreakdown, heroStrikeFacesVs, foeSwingVsHero, scrollReaderOf, scrollReadBands } from "../../engine/derived.js";
import { rangeText } from "../../src/browser/rollRange.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// ─── fixed* helpers, mirroring test/unit/odds-helpers.test.js verbatim ────

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const { dark = false, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...rest };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

// ─── heroHitOdds ────────────────────────────────────────────────────────

test("heroHitOdds: level-1 Human Fighter/Thief/Magic User on a Club read the class range on d20", () => {
  const fighter = fixedState();
  const thief = fixedState({ c: { cls: "Thief", sub: "Pilfer" } });
  const mu = fixedState({ c: { cls: "Magic User", sub: "Wizard" } });

  const fighterOdds = heroHitOdds(fighter);
  assert.equal(fighterOdds.faces, 5);
  assert.equal(fighterOdds.dieN, 20);
  assert.equal(fighterOdds.text, "16–20 (d20)");

  const thiefOdds = heroHitOdds(thief);
  assert.equal(thiefOdds.faces, 4);
  assert.equal(thiefOdds.dieN, 20);
  assert.equal(thiefOdds.text, "17–20 (d20)");

  const muOdds = heroHitOdds(mu);
  assert.equal(muOdds.faces, 3);
  assert.equal(muOdds.dieN, 20);
  assert.equal(muOdds.text, "18–20 (d20)");
});

test("heroHitOdds: reads the live Afraid penalty, a dazed foeEffect, and a higher-level strike die — all through toHit/afraidNeed/strikeDie", () => {
  const afraid = fixedState({ combat: { afraid: 2 } });
  assert.equal(heroHitOdds(afraid).text, "19–20 (d20)");
  assert.equal(heroHitOdds(afraid).faces, afraidNeed(afraid, toHit(afraid)));

  const dazed = fixedState({ c: { foeEffect: { kind: "dazed", rounds: 1 } } });
  assert.equal(heroHitOdds(dazed).text, "18–20 (d20)");

  const lvl2 = fixedState({ c: { level: 2 } });
  assert.equal(heroHitOdds(lvl2).text, "8–12 (d12)");
  assert.equal(heroHitOdds(lvl2).dieN, strikeDie(lvl2.c));
});

// ─── heroHitOddsVs ──────────────────────────────────────────────────────

test("heroHitOddsVs: reads heroStrikeFacesVs against a capped, an untouchable, and a dozing target", () => {
  const capped = fixedState();
  const cappedFoe = fixedFoe({ sp: { toHit: 4 } });
  const cappedOdds = heroHitOddsVs(capped, cappedFoe);
  assert.equal(cappedOdds.faces, heroStrikeFacesVs(capped, cappedFoe));
  assert.equal(cappedOdds.text, "17–20 (d20)");
  assert.equal(cappedOdds.untouchable, false);

  const untouchableState = fixedState();
  const magicOnlyFoe = fixedFoe({ sp: { magicOnly: true } });
  const untouchableOdds = heroHitOddsVs(untouchableState, magicOnlyFoe);
  assert.equal(untouchableOdds.faces, 0);
  assert.equal(untouchableOdds.untouchable, true);

  const muState = fixedState({ c: { cls: "Magic User", sub: "Wizard" } });
  const dozingFoe = fixedFoe({ asleep: 1 });
  const dozingOdds = heroHitOddsVs(muState, dozingFoe);
  assert.equal(dozingOdds.text, "16–20 (d20)");
});

// ─── foeHitOddsVs ───────────────────────────────────────────────────────

test("foeHitOddsVs: a level-1 foe against a Soldier, then a Guard, gets the honest range and modifier", () => {
  const soldier = fixedState();
  const foe = fixedFoe();
  const soldierOdds = foeHitOddsVs(soldier, foe);
  assert.equal(soldierOdds.text, "16–20 (d20)");
  assert.equal(soldierOdds.dieN, foeDie(soldier.c, foe));

  const guard = fixedState({ c: { sub: "Guard" } });
  const guardOdds = foeHitOddsVs(guard, foe);
  assert.equal(guardOdds.text, "17–20 (d20; Guard +1)");
});

test("foeHitOddsVs: Sidestep + an insult stack; a blind foe's insult still reads player-signed", () => {
  const sidestepState = fixedState({
    c: { timers: { "ability:sidestep": { phase: "effect", left: 2, cadence: "rounds" } } },
    combat: { parleyInsulted: true },
  });
  const foe = fixedFoe();
  const sidestepOdds = foeHitOddsVs(sidestepState, foe);
  assert.equal(sidestepOdds.text, "17–20 (d20; Sidestep +2, insulted −1)");

  const blindState = fixedState({ combat: { parleyInsulted: true } });
  const blindFoe = fixedFoe({ blind: true });
  const blindOdds = foeHitOddsVs(blindState, blindFoe);
  assert.equal(blindOdds.text, "19–20 (d20; blind +4, insulted −1)");
});

test("foeHitOddsVs: a Weaken cap (combat.foeToHitPenalty) shows the relabelled mod; plainText omits it", () => {
  const state = fixedState({ combat: { foeToHitPenalty: 3 } });
  const foe = fixedFoe();
  const odds = foeHitOddsVs(state, foe);
  assert.equal(odds.text, "18–20 (d20; Weaken +2)");
  assert.equal(odds.plainText, "18–20 (d20)");
  assert.deepEqual(odds.mods, foeSwingVsHero(state, foe).mods);
});

// ─── fleeOdds ───────────────────────────────────────────────────────────

test("fleeOdds: a Human Fighter in unarmoured kit reads its plain flee range with no mods", () => {
  const c = fixedFighter();
  const odds = fleeOdds(c);
  const fb = fleeBreakdown(c);
  assert.equal(odds.atLeast, fb.need - fb.bonus);
  assert.equal(odds.atLeast, 14);
  assert.equal(odds.text, "14–20 (d20)");
  assert.equal(odds.modsText, "");
});

test("fleeOdds: a Human Thief reads the +5 Thief bonus, both in its range and its standalone modsText", () => {
  const c = fixedFighter({ cls: "Thief", sub: "Pilfer" });
  const odds = fleeOdds(c);
  const fb = fleeBreakdown(c);
  assert.equal(odds.atLeast, fb.need - fb.bonus);
  assert.equal(odds.atLeast, 9);
  assert.equal(odds.text, "9–20 (d20)");
  assert.equal(odds.modsText, "Thief +5");
});

test("fleeOdds: atLeast always equals fleeBreakdown(c).need − fleeBreakdown(c).bonus (Troll Fighter in Plate)", () => {
  const c = fixedFighter({ race: "Troll", armor: "Plate" });
  const odds = fleeOdds(c);
  const fb = fleeBreakdown(c);
  assert.equal(odds.atLeast, fb.need - fb.bonus);
  assert.equal(odds.text, "17–20 (d20)");
});

// ─── scrollReadOdds (RULES-10, Phase 75.1, plan 75.1-07) ──────────────────

test("scrollReadOdds: a Magic User reads without fail, naming Magic User", () => {
  const mu = fixedState({ c: { cls: "Magic User", sub: "Wizard", intel: 11 } });
  assert.equal(scrollReaderOf(mu.c), "magicUser");
  assert.equal(scrollReadOdds(mu), "Reads without fail (Magic User).");
});

test("scrollReadOdds: a Fighter with Runes/Signs reads without fail, naming Runes/Signs", () => {
  const runes = fixedState({ c: { skills: { "Runes/Signs": 1 }, intel: 11 } });
  assert.equal(scrollReaderOf(runes.c), "runes");
  assert.equal(scrollReadOdds(runes), "Reads without fail (Runes/Signs).");
});

test("scrollReadOdds: a Fighter with intel 14 reads the exact worked example", () => {
  const state = fixedState({ c: { intel: 14 } });
  assert.equal(scrollReaderOf(state.c), "intel");
  assert.equal(scrollReadOdds(state), "Reads on 8–20 (d20, intel 14); 1–3 backfires.");
});

test("scrollReadOdds: intel 1 reads 'nothing' with a 1–10 fumble band; intel 20 shows no fumble band", () => {
  const worst = fixedState({ c: { intel: 1 } });
  assert.equal(scrollReadOdds(worst), "Reads on nothing (d20, intel 1); 1–10 backfires.");

  const best = fixedState({ c: { intel: 20 } });
  assert.equal(scrollReadOdds(best), "Reads on 2–20 (d20, intel 20).");
  assert.ok(!scrollReadOdds(best).includes("backfires"));
});

test("scrollReadOdds: a Pilfer reads under the exact same intel rule as anyone else", () => {
  const pilfer = fixedState({ c: { cls: "Thief", sub: "Pilfer", intel: 11 } });
  assert.equal(scrollReaderOf(pilfer.c), "intel");
  const bands = scrollReadBands(11);
  const expected = `Reads on ${bands.atLeast}–20 (d20, intel 11); 1–${bands.fumbleAtLeast - 1} backfires.`;
  assert.equal(scrollReadOdds(pilfer), expected);
});

test("scrollReadOdds: the reading range always equals rangeText(scrollReadBands(intel).atLeast, 20), for intel 3, 9, 14 and 19", () => {
  for (const intel of [3, 9, 14, 19]) {
    const state = fixedState({ c: { intel } });
    const bands = scrollReadBands(intel);
    const expectedRange = rangeText(bands.atLeast, bands.dieN);
    assert.ok(scrollReadOdds(state).includes(expectedRange), `intel ${intel}: expected "${expectedRange}" in "${scrollReadOdds(state)}"`);
  }
});

test("scrollReadOdds: no hyphen-minus between digits, no '%' and no 'N+' shorthand", () => {
  for (const intel of [0, 1, 3, 9, 14, 19, 20]) {
    const text = scrollReadOdds(fixedState({ c: { intel } }));
    assert.ok(!text.includes("%"), `intel ${intel}: "${text}" must not contain "%"`);
    assert.ok(!/\d\+(?!\d)/.test(text), `intel ${intel}: "${text}" must not contain an "N+" shorthand`);
    assert.doesNotMatch(text, /\d-\d/, `intel ${intel}: "${text}" must not use a hyphen-minus between digits`);
  }
});

// ─── purity ─────────────────────────────────────────────────────────────

test("purity: no function mutates state/c/foe, and two calls return deep-equal results", () => {
  const state = Object.freeze({
    ...fixedState({ combat: { afraid: 2 } }),
    c: Object.freeze(fixedFighter()),
  });
  const foe = Object.freeze(fixedFoe({ sp: Object.freeze({ toHit: 4 }) }));

  assert.deepEqual(heroHitOdds(state), heroHitOdds(state));
  assert.deepEqual(heroHitOddsVs(state, foe), heroHitOddsVs(state, foe));
  assert.deepEqual(foeHitOddsVs(state, foe), foeHitOddsVs(state, foe));
  assert.deepEqual(fleeOdds(state.c), fleeOdds(state.c));
});

test("rollOdds.js source: no document/window/Math.random/Date.now", () => {
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "rollOdds.js"), "utf8");
  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const src = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /document\./);
  assert.doesNotMatch(src, /window\./);
  assert.doesNotMatch(src, /Math\.random/);
  assert.doesNotMatch(src, /Date\.now/);
});
