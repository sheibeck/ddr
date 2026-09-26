// test/unit/scroll-read-surfaces.test.js
//
// RULES-10 (Phase 75.1), plan 75.1-07 — dedicated coverage for
// src/browser/rollOdds.js#scrollReadOdds, the ONE odds text both SCROLLS
// rows (src/browser/gearTab.js's CONSUMABLES row and
// src/browser/combatMenu.js's ITEMS row) append to their description, and
// for the Runes/Signs skill text + the three CLASS_NOTE blurbs this plan's
// Task 2 rewrites to state the new rule.
//
// The engine tie-in test below reuses test/unit/scroll-read.test.js's own
// forceOutcome technique verbatim (a REAL makeRng/scrollReadRng/rollCheck/
// scrollReadOutcome search over state.acts, never a mocked derivedRng) so
// the surface's printed range is proven to equal the range a real
// readScroll draw actually resolves against.

import test from "node:test";
import assert from "node:assert/strict";

import { scrollReadOdds } from "../../src/browser/rollOdds.js";
import { rangeText } from "../../src/browser/rollRange.js";
import { scrollReaderOf, scrollReadBands, scrollReadOutcome } from "../../engine/derived.js";
import { readScroll, scrollReadRng } from "../../engine/magic.js";
import { rollCheck } from "../../engine/dice.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { gearConsumablesModel } from "../../src/browser/gearTab.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { FIGHTER_SKILLS } from "../../content/skills.js";
import { CLASS_NOTE } from "../../content/flavor.js";

// ─── fixtures (mirror test/unit/scroll-read.test.js verbatim) ─────────────

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedChar(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 40, wp: 40, skills: {}, vp: 0, intel: 10,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Reader",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedChar(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const OPTIONS_DEPTH1 = SPELLS.filter((sp) => sp.lvl <= Math.min(5, 1 + 1));

/** forceOutcome — ported verbatim from test/unit/scroll-read.test.js. */
function forceOutcome(seed, intel, wantOutcome) {
  const bands = scrollReadBands(intel);
  for (let acts = 0; acts <= 5000; acts++) {
    const probe = makeRng(seed);
    probe.pick(OPTIONS_DEPTH1);
    const stream = scrollReadRng({ acts }, probe);
    const check = rollCheck(stream, bands.dieN, bands.atLeast);
    if (scrollReadOutcome(check, bands) === wantOutcome) {
      return { acts, roll: check.roll, atLeast: check.atLeast, dieN: check.dieN, fumbleAtLeast: bands.fumbleAtLeast };
    }
  }
  throw new Error(`forceOutcome: no acts within bound produced "${wantOutcome}" for intel ${intel}, seed ${seed}`);
}

// ─── the two automatic readers ──────────────────────────────────────────

test("scrollReadOdds: a Wizard reads without fail, naming Magic User", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", intel: 14 } });
  const text = scrollReadOdds(state);
  assert.match(text, /without fail/i);
  assert.match(text, /Magic User/);
});

test("scrollReadOdds: a Fighter with Runes/Signs reads without fail, naming Runes/Signs", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 }, intel: 14 } });
  const text = scrollReadOdds(state);
  assert.match(text, /without fail/i);
  assert.match(text, /Runes\/Signs/);
});

// ─── the intel reader worked example ────────────────────────────────────

test("scrollReadOdds: a Fighter with intel 14 reads the exact worked example — 8–20 (d20, intel 14); 1–3 backfires", () => {
  const state = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: {}, intel: 14 } });
  assert.equal(scrollReadOdds(state), "Reads on 8–20 (d20, intel 14); 1–3 backfires.");
});

test("scrollReadOdds: intel 1 shows 'nothing' with a 1–10 fumble band; intel 20 shows no fumble band at all", () => {
  const worst = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: {}, intel: 1 } });
  assert.equal(scrollReadOdds(worst), "Reads on nothing (d20, intel 1); 1–10 backfires.");

  const best = fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: {}, intel: 20 } });
  const bestText = scrollReadOdds(best);
  assert.doesNotMatch(bestText, /backfires/);
  assert.match(bestText, /2–20 \(d20, intel 20\)/);
});

// ─── the Pilfer reads exactly like anyone else ──────────────────────────

test("scrollReadOdds: a Pilfer with intel 11 sees its own honest intel range, exactly like any other intel reader", () => {
  const state = fixedState({ c: { cls: "Thief", sub: "Pilfer", skills: {}, intel: 11 } });
  const bands = scrollReadBands(11);
  const text = scrollReadOdds(state);
  assert.ok(text.includes(rangeText(bands.atLeast, bands.dieN)), `expected the Pilfer's own range in "${text}"`);
});

// ─── the two SCROLLS rows always agree ──────────────────────────────────

test("scrollReadOdds: the Gear tab SCROLLS desc and the combat ITEMS SCROLL desc both contain the same odds text for the same state", () => {
  for (const c of [
    { cls: "Magic User", sub: "Wizard", scrolls: 1 },
    { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 }, scrolls: 1 },
    { cls: "Fighter", sub: "Soldier", skills: {}, intel: 14, scrolls: 1 },
  ]) {
    const state = fixedState({ c });
    state.combat = fixedCombat([]);
    const gearDesc = gearConsumablesModel(state).rows.find((r) => r.key === "scroll").desc;
    const menuDesc = combatMenuViewModel(state).submenus.items.rows.find((r) => r.id === "scroll").desc;
    const odds = scrollReadOdds(state);
    assert.ok(gearDesc.includes(odds), `Gear tab desc should include "${odds}" -> "${gearDesc}"`);
    assert.ok(menuDesc.includes(odds), `combat ITEMS desc should include "${odds}" -> "${menuDesc}"`);
  }
});

// ─── engine tie-in guard: the printed range is the range readScroll rolls against ─

test("scrollReadOdds: for intel 3, 9, 14 and 19, the surface's reading range equals rangeText(scrollReadBands(intel).atLeast, 20), and a real readScroll by that reader emits an event whose atLeast gives the same range", () => {
  for (const intel of [3, 9, 14, 19]) {
    const bands = scrollReadBands(intel);
    const expectedRange = rangeText(bands.atLeast, bands.dieN);

    const surfaceText = scrollReadOdds(fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: {}, intel } }));
    assert.ok(surfaceText.includes(expectedRange), `intel ${intel}: expected "${expectedRange}" in "${surfaceText}"`);

    // A real readScroll draw (forced to "read" so a scrollDeciphered event
    // carries an atLeast) proves the SAME range is what the engine actually
    // rolls against — never a re-derived formula on either side.
    const seed = 7;
    const { acts } = forceOutcome(seed, intel, "read");
    const state = fixedState({ acts, c: { cls: "Fighter", sub: "Soldier", skills: {}, intel, scrolls: 1, grimoire: [] } });
    const events = readScroll(state, makeRng(seed), []);
    const deciphered = events.find((e) => e.type === "scrollDeciphered");
    assert.ok(deciphered, `intel ${intel}: expected a scrollDeciphered event`);
    assert.equal(rangeText(deciphered.atLeast, deciphered.dieN), expectedRange, `intel ${intel}: the real event's own range must equal the surface's`);
  }
});

// ─── format guard ────────────────────────────────────────────────────────

test("scrollReadOdds: no hyphen-minus between digits, no '%' and no 'N+' shorthand, for every intel 0-20 plus both automatic readers", () => {
  const samples = [
    scrollReadOdds(fixedState({ c: { cls: "Magic User", sub: "Wizard" } })),
    scrollReadOdds(fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: { "Runes/Signs": 1 } } })),
  ];
  for (let intel = 0; intel <= 20; intel++) {
    samples.push(scrollReadOdds(fixedState({ c: { cls: "Fighter", sub: "Soldier", skills: {}, intel } })));
  }
  for (const text of samples) {
    assert.ok(!text.includes("%"), `"${text}" must not contain "%"`);
    assert.ok(!/\d\+(?!\d)/.test(text), `"${text}" must not contain an "N+" shorthand`);
    assert.doesNotMatch(text, /\d-\d/, `"${text}" must not use a hyphen-minus between digits`);
  }
});

// ─── Task 2: the Runes/Signs skill text and the class blurbs ───────────

test("FIGHTER_SKILLS['Runes/Signs']: states it reads any scroll without fail, and that without it a scroll is an intelligence roll that can backfire", () => {
  const txt = FIGHTER_SKILLS["Runes/Signs"].txt;
  assert.match(txt, /without fail/i);
  assert.match(txt, /intelligence/i);
});

test("CLASS_NOTE: Magic User, Fighter and Thief each mention scrolls, stating the new reading rule", () => {
  assert.match(CLASS_NOTE["Magic User"], /scroll/i);
  assert.match(CLASS_NOTE["Fighter"], /scroll/i);
  assert.match(CLASS_NOTE["Thief"], /scroll/i);
});
