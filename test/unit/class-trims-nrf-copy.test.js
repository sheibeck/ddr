// test/unit/class-trims-nrf-copy.test.js
//
// Quick 260928-nrf (user rulings 2026-09-28): the presentation half of the
// class trims and the Joiner resist (test/unit/class-trims-nrf.test.js holds
// the engine half). Pins every new or changed player-facing line:
//   - Sweep's text and its refusal (Oracle, rail, the ability menu row);
//   - Kata's and Feint's text (no "cannot miss" anywhere) and a missed
//     Kata/Feint on the Oracle and the rail;
//   - the Acrobat's four faces in the trait line and the blurb;
//   - a Thief's flee line reading +3;
//   - a Joiner's resist lines, which name the Joiner and state the roll, the
//     range and the Joiner's intel.

import test from "node:test";
import assert from "node:assert/strict";

import { ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS, IDENTITY_TRAITS, SUB_NOTE } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { resistRoll } from "../../engine/derived.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const strip = (html) => String(html).replace(/<[^>]+>/g, "");
const NEVER_MISSES = /cannot miss|can't miss|never miss|always (hits|lands)|sure hit|automatic hit/i;

function fightState(cOver, foes) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 2, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: ["sweep", "kata"],
      weapon: "Sword", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, intel: 10,
      ...cOver,
    },
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Beasts", round: 2, target: 0, pending: false, opened: true, opened2: true, spellOpen: false, tracked: false },
  };
}

const foe = (name, over = {}) => ({ name, type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1, ...over });

// ---------------------------------------------------------------------------
// (2) Sweep.
// ---------------------------------------------------------------------------

test("(2) Sweep's text says it needs two or more foes (ability and skill)", () => {
  assert.equal(ABILITY_BY_ID.sweep.txt, "one wide arc: every living foe takes half damage; needs two or more foes");
  assert.equal(FIGHTER_SKILLS.Sweep.txt, ABILITY_BY_ID.sweep.txt);
});

test("(2) the Sweep refusal reads in voice on the Oracle and the rail", () => {
  const e = { type: "abilityRefused", key: "sweep", reason: "tooFewFoes", name: "Sweep", need: 2, have: 1 };
  assert.equal(strip(EVENT_NARRATION.abilityRefused(e)), "Sweep: needs two or more foes, and there is only one. A wide arc at a single foe is a swing with extra steps.");
  assert.equal(LINE_FOR.abilityRefused(e).text, "Sweep: needs two or more foes.");
  assert.equal(LINE_FOR.abilityRefused(e).tone, "block");
});

test("(2) the ability menu shows Sweep disabled with its reason while one foe stands, and ready with two", () => {
  const rowOf = (st, key) => combatMenuViewModel(st).submenus.abilities.rows.find((r) => r.id === `ability-${key}`);
  const one = fightState({}, [foe("A"), foe("B", { alive: false, wp: 0 })]);
  const sweep = rowOf(one, "sweep");
  assert.equal(COMBAT_MENU_COPY.abilityTooFewFoes, "NEEDS TWO OR MORE FOES");
  assert.equal(sweep.cost, COMBAT_MENU_COPY.abilityTooFewFoes);
  assert.equal(sweep.enabled, false, "disabled-styled");
  assert.deepEqual(sweep.dispatch, { type: "useAbility", key: "sweep" }, "still tappable: the engine's refusal explains");
  assert.equal(combatMenuViewModel(one).actions.find((a) => a.key === "abilities").sub, "1/2 READY", "Sweep is not counted ready");
  const two = fightState({}, [foe("A"), foe("B")]);
  assert.equal(rowOf(two, "sweep").cost, COMBAT_MENU_COPY.abilityReady);
  assert.equal(rowOf(two, "sweep").enabled, true);
  assert.equal(combatMenuViewModel(two).actions.find((a) => a.key === "abilities").sub, "2/2 READY");
});

// ---------------------------------------------------------------------------
// (3) Kata and Feint.
// ---------------------------------------------------------------------------

// Phase 90 plan 11 (TEXT-01, user 2026-09-30): the shift reads "+3 to hit", never "three more faces" (the number is pinned to the
// engine's KATA_FEINT_NEED_SHIFT in test/unit/spell-skill-text-wording.test.js).
test("(3) Kata's and Feint's texts state the +3 to hit and never promise a sure hit", () => {
  for (const txt of [ABILITY_BY_ID.kata.txt, ABILITY_BY_ID.feint.txt, FIGHTER_SKILLS.Kata.txt, THIEF_SKILLS.Feint.txt]) {
    assert.doesNotMatch(txt, NEVER_MISSES, txt);
    assert.match(txt, /\+3 to hit on this strike/, txt);
    assert.match(txt, /adds your level in damage; ready again 4 rounds after you use it$/, txt); // Phase 91.1 plan 02 (V1)
  }
  assert.equal(ABILITY_BY_ID.kata.txt, "one perfect form: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it");
  assert.equal(ABILITY_BY_ID.feint.txt, "look left, stab right: +3 to hit on this strike, and it adds your level in damage; ready again 4 rounds after you use it");
});

test("(3) a missed Kata or Feint is an ordinary miss that names the ability, on the Oracle and the rail", () => {
  const kata = { type: "strikeMissed", target: "Viper", roll: 7, atLeast: 9, dieN: 12, mods: [{ name: "Kata", delta: 3 }], via: "kata" };
  assert.equal(strip(EVENT_NARRATION.strikeMissed(kata)), "7 vs 9–12 (Kata +3). You miss Viper. Kata is spent all the same: one perfect form, one imperfect result.");
  assert.equal(LINE_FOR.strikeMissed(kata).text, "You miss Viper with Kata, spent anyway");
  const feint = { ...kata, mods: [{ name: "Feint", delta: 3 }], via: "feint" };
  assert.equal(strip(EVENT_NARRATION.strikeMissed(feint)), "7 vs 9–12 (Feint +3). You miss Viper. Feint is spent all the same: they looked left, and so did your blade.");
  assert.equal(LINE_FOR.strikeMissed(feint).text, "You miss Viper with Feint, spent anyway");
  for (const e of [kata, feint]) {
    assert.doesNotMatch(strip(EVENT_NARRATION.strikeMissed(e)), NEVER_MISSES);
    assert.doesNotMatch(LINE_FOR.strikeMissed(e).text, NEVER_MISSES);
  }
  // An Overhead Blow miss (its own −2) is unchanged: no spent clause.
  const overhead = { ...kata, mods: [{ name: "overhead", delta: -2 }], via: "overheadBlow" };
  assert.equal(strip(EVENT_NARRATION.strikeMissed(overhead)), "7 vs 9–12 (Overhead Blow −2). You miss Viper.");
  assert.equal(LINE_FOR.strikeMissed(overhead).text, "You miss Viper");
});

// ---------------------------------------------------------------------------
// (4) The Acrobat's four faces.
// ---------------------------------------------------------------------------

// Phase 91 plan 10 (TEXT-01, user 2026-09-30): "top four faces" is plain words now, the four winning faces of the d20
// written as the range they are (17–20); test/unit/identity-text.test.js reads the number back from foeToHitVs.
test("(4) the Acrobat's trait line and blurb say the foe's four winning numbers plainly (17–20 on a d20)", () => {
  const good = IDENTITY_TRAITS.sub.Acrobat.good;
  assert.equal(good[0].text, "foes hit you only on a high roll (17–20 on a d20)");
  assert.match(SUB_NOTE.Acrobat, /^Foes hit you only on a high roll \(17–20 on a d20\),/);
  assert.doesNotMatch(SUB_NOTE.Acrobat, /\bfaces?\b/i);
});

// ---------------------------------------------------------------------------
// (1) The Thief's flee line reads +3.
// ---------------------------------------------------------------------------

test("(1) a Thief's flee line reads Thief +3 on the Oracle and the rail", () => {
  const e = { type: "fleeRolled", roll: 12, atLeast: 11, dieN: 20, mods: [{ name: "Thief", delta: 3 }] };
  assert.match(strip(EVENT_NARRATION.fleeRolled(e)), /12 vs 11–20 \(Thief \+3\)/);
  assert.match(LINE_FOR.fleeRolled(e).text, /12 vs 11–20 \(Thief \+3\)/);
});

// ---------------------------------------------------------------------------
// (5) A Joiner's resist lines.
// ---------------------------------------------------------------------------

test("(5) a Joiner's resist lines name the Joiner and the foe, and state the roll, the range and the intel", () => {
  for (const intel of [2, 10, 20]) {
    const faces = Math.max(1, Math.round(intel / 2));
    const atLeast = 21 - faces;
    const range = atLeast === 20 ? "20" : `${atLeast}–20`;
    const ok = { type: "memberResisted", name: "Krupke", ability: "krupkeFreeze", member: "Ada", roll: 20, atLeast, dieN: 20, intel, faces };
    assert.equal(strip(EVENT_NARRATION.memberResisted(ok)), `Ada resists Krupke's spell. 20 vs ${range} (intel ${intel}). Somebody on your side was paying attention.`);
    assert.equal(LINE_FOR.memberResisted(ok).text, `Ada resists Krupke's spell (20 vs ${range}, intel ${intel}).`);
    assert.equal(LINE_FOR.memberResisted(ok).tone, "hit");
    const no = { ...ok, type: "memberResistFailed", roll: 1 };
    assert.equal(strip(EVENT_NARRATION.memberResistFailed(no)), `Ada fails to resist Krupke's spell. 1 vs ${range} (intel ${intel}). Shrugging it off is harder than it looks.`);
    assert.equal(LINE_FOR.memberResistFailed(no).text, `Krupke gets through — Ada fails to resist (1 vs ${range}, intel ${intel}).`);
    assert.equal(LINE_FOR.memberResistFailed(no).tone, "hurt");
  }
});

test("(5) the lines print the engine's own range (resistRoll's atLeast)", () => {
  const fixed = { d: () => 1 }; // raw 1 on a d20 is a roll-high 20
  const res = resistRoll(fixed, 16);
  const e = { type: "memberResisted", name: "Krupke", member: "Ada", roll: res.roll, atLeast: res.atLeast, dieN: res.dieN, intel: 16, faces: res.faces };
  assert.ok(strip(EVENT_NARRATION.memberResisted(e)).includes(`20 vs ${res.atLeast}–20 (intel 16)`));
  assert.ok(LINE_FOR.memberResisted(e).text.includes(`20 vs ${res.atLeast}–20, intel 16`));
});
