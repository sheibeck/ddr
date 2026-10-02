// test/unit/starting-hp-text.test.js
//
// Phase 92.3 plan 01 (user rulings 2026-10-02): every starting hit point a
// player is told is a starting hit point the engine deals. The user's report:
// "The Troll says it starts with 75 hitpoints, but my new troll actually
// started with 105." The ruling that followed: the Troll starts at a FINAL 75
// whatever the class, the Thief at a FINAL 50 (an Elven Thief 30), and the
// Magic User blurb says its real range (36 to 49). Level-ups are unchanged.
//
// This guard runs on the SHIPPED dials (never `setIdentityDials`): the hit
// points a player meets are the ones the shipped HERO_HP_SCALE gives, so a
// later retune of that dial, or of a class or race row, fails here until the
// text says the new truth. It has six parts:
//   1. a truth table over EVERY race x class x sub-class (143 combinations),
//      measured through rollCharacter and cross-checked against a closed form;
//   2. registered claims, parsed from the digits or number words the text
//      actually prints, each checked against the table;
//   3. a coverage scan that fails on any unregistered hit-point number in a
//      player-facing text (an allowlist names the ones that are not a start:
//      upkeep, soak, the Knight thresholds, the Pilfer d10, the Warlock's
//      per-level hit points);
//   4. the Elven 60% ratio at every class and level 1, plus the level-up
//      rule (a Troll's and a Thief's gains still go through the dial);
//   5. the Hero tab's view model reads a value inside the range.
//   6. (plan 02) the mean-hero reference behind ROUND_DAMAGE_CEILING reads the same start (Thief 50, Troll 75).

import test from "node:test";
import assert from "node:assert/strict";

import { rollCharacter, checkLevel } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { makeRng } from "../../engine/rng.js";
import { heroMaxWpFor, heroMeanMaxWpFor, startWpMeanFor, DIALS } from "../../engine/difficulty.js";
import { RACES, CLASSES, RACE_NOTE, CLASS_NOTE, SUB_NOTE, IDENTITY_TRAITS, THRESHOLDS } from "../../content/index.js";
import { identityFooter } from "../../src/browser/identityFooter.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";

const SEEDS = 240; // a d10 (the widest start die) shows every face in 240 seeds with certainty to ~1e-10

// ─── number words ────────────────────────────────────────────────────────

const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const WORD = `(?:${[...Object.keys(ONES), ...Object.keys(TENS), "hundred"].join("|")})`;
const NUM = String.raw`(?:\d+|d\d+|${WORD}(?:[- ]${WORD})*|a single)`;
// "75 starting hit points", "Fifty Hit Points", "Thirty-six to forty-nine Hit Points", "15 HP", "5 more HP",
// "a d10 of your own hp" (up to three words allowed between the number and the unit).
const HP_NUMBER_RE = new RegExp(String.raw`\b${NUM}(?:\s+(?:to|or|plus|and)\s+${NUM})?\s+(?:[a-z]+\s+){0,3}(?:hit points?|hp|wp)\b`, "gi");
// "60% of the usual HP", "(60%" after Hit Points.
const HP_PERCENT_RE = /\b\d+%\s+of\s+(?:the\s+usual|a\s+person's)\s+(?:hp|hit points)\b|\b(?:hp|hit points)\s*\(\d+%/gi;

/** wordValue("Thirty-six") -> 36; "forty nine" -> 49; "75" -> 75; "a single" -> 1. */
function wordValue(s) {
  const t = s.toLowerCase().trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (t === "a single") return 1;
  let total = null;
  for (const part of t.split(/[-\s]+/)) {
    const v = part in ONES ? ONES[part] : part in TENS ? TENS[part] : null;
    if (v === null) return null;
    total = (total ?? 0) + v;
  }
  return total;
}

/** claimRange(matchText) -> [lo, hi] from the numbers the text prints ("a to b" is a range). */
function claimRange(matchText) {
  const m = matchText.match(new RegExp(String.raw`^(${NUM})(?:\s+(?:to|or)\s+(${NUM}))?\s`, "i"));
  assert.ok(m, `no number in ${JSON.stringify(matchText)}`);
  const lo = wordValue(m[1]);
  const hi = m[2] === undefined ? lo : wordValue(m[2]);
  assert.ok(Number.isInteger(lo) && Number.isInteger(hi), `unparsed number in ${JSON.stringify(matchText)}`);
  return [lo, hi];
}

// ─── 1. the truth table ──────────────────────────────────────────────────

/** All (race, cls, sub) the roller can deal: every combination but a Fridgian Samurai. */
function combos() {
  const out = [];
  for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) for (const sub of CLASSES[cls].subs) {
    if (race === "Fridgian" && sub === "Samurai") continue;
    out.push({ race, cls, sub });
  }
  return out;
}

/**
 * closedForm(race, cls) -> [lo, hi] a level 1 hero's max hit points, from the
 * content tables alone: a race's flatWP and a class's startWP are FINAL (no
 * dial); otherwise base + dice, the Elven wpMul, then the shipped dial.
 */
function closedForm(race, cls) {
  const R = RACES[race];
  const C = CLASSES[cls];
  if (R.flatWP) return [R.flatWP, R.flatWP];
  const mul = R.wpMul ?? 1;
  if (C.startWP !== undefined) return [Math.round(C.startWP * mul), Math.round(C.startWP * mul)];
  const d = C.baseWP.dice;
  const lo = C.baseWP.base + d.n + d.bonus;
  const hi = C.baseWP.base + d.n * d.sides + d.bonus;
  return [heroMaxWpFor(Math.round(lo * mul), cls), heroMaxWpFor(Math.round(hi * mul), cls)];
}

/** measured: "race|cls|sub" -> { min, max, values:Set, wpMismatch }, over SEEDS forced chargens. */
const measured = new Map();
for (const { race, cls, sub } of combos()) {
  let min = Infinity;
  let max = -Infinity;
  let wpMismatch = 0;
  const values = new Set();
  for (let s = 1; s <= SEEDS; s++) {
    const c = rollCharacter(makeRng(s * 7919 + 1), [], { cls, sub, race });
    min = Math.min(min, c.maxWP);
    max = Math.max(max, c.maxWP);
    values.add(c.maxWP);
    if (c.wp !== c.maxWP) wpMismatch++;
  }
  measured.set(`${race}|${cls}|${sub}`, { min, max, values, wpMismatch });
}

test("92.3 truth table: the shipped dials are the shipped dials (the guard never overrides them)", () => {
  assert.ok(DIALS.HERO_HP_SCALE > 1, "HERO_HP_SCALE ships above 1 (the Phase 79.2 lock); this guard is meaningless at identity");
});

test("92.3 truth table: every race x class x sub-class starts inside the closed form, with wp == maxWP", () => {
  assert.equal(measured.size, 143, "6 races x 24 sub-classes, less the Fridgian Samurai that is never dealt");
  for (const [key, got] of measured) {
    const [race, cls] = key.split("|");
    const [lo, hi] = closedForm(race, cls);
    assert.equal(got.min, lo, `${key}: lowest start ${got.min}, closed form ${lo}`);
    assert.equal(got.max, hi, `${key}: highest start ${got.max}, closed form ${hi}`);
    assert.equal(got.wpMismatch, 0, `${key}: a new hero starts at full hit points`);
  }
});

test("92.3 truth table: the sub-class changes nothing about the starting hit points", () => {
  for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) {
    const sets = CLASSES[cls].subs
      .filter((sub) => !(race === "Fridgian" && sub === "Samurai"))
      .map((sub) => [...measured.get(`${race}|${cls}|${sub}`).values].sort((a, b) => a - b).join(","));
    assert.equal(new Set(sets).size, 1, `${race} ${cls}: the sub-classes start at different values: ${sets.join(" | ")}`);
  }
});

test("92.3 the ruling: a Troll starts at exactly 75 in every class, a Thief at exactly 50, an Elven Thief at 30", () => {
  for (const cls of Object.keys(CLASSES)) {
    for (const sub of CLASSES[cls].subs) {
      const t = measured.get(`Troll|${cls}|${sub}`);
      assert.deepEqual([t.min, t.max], [75, 75], `Troll ${cls}/${sub}`);
    }
  }
  for (const race of ["Human", "Dwarven", "Wilmsry", "Fridgian"]) {
    for (const sub of CLASSES.Thief.subs) {
      const t = measured.get(`${race}|Thief|${sub}`);
      assert.deepEqual([t.min, t.max], [50, 50], `${race} Thief/${sub}`);
    }
  }
  for (const sub of CLASSES.Thief.subs) {
    const t = measured.get(`Elven|Thief|${sub}`);
    assert.deepEqual([t.min, t.max], [30, 30], `Elven Thief/${sub}: the Elven 60% still applies to the Thief's final 50`);
  }
  // The Magic User and the Fighter are unchanged (the dial still scales them).
  assert.deepEqual([measured.get("Human|Magic User|Wizard").min, measured.get("Human|Magic User|Wizard").max], [36, 49]);
  assert.deepEqual([measured.get("Human|Fighter|Knight").min, measured.get("Human|Fighter|Knight").max], [71, 81]);
});

test("92.3 level-ups are unchanged: a Troll's and a Thief's gains still go through the dial, a Troll's start does not", () => {
  const seen = { Troll: 0, Thief: 0 };
  for (const [race, cls, sub] of [["Troll", "Fighter", "Knight"], ["Human", "Thief", "Pickpocket"]]) {
    for (let s = 1; s <= 40; s++) {
      const rng = makeRng(s * 31 + 7);
      const c = rollCharacter(rng, [], { cls, sub, race });
      const before = c.maxWP;
      c.sp = THRESHOLDS[1];
      const events = [];
      checkLevel({ c, seed: s }, rng, events);
      assert.equal(c.level, 2);
      const gain = c.maxWP - before;
      // the gain is the class's own die, scaled by the shipped dial like every other class's
      const die = CLASSES[cls].gain[1];
      const lo = heroMaxWpFor(die.n + die.bonus, cls);
      const hi = heroMaxWpFor(die.n * die.sides + die.bonus, cls);
      assert.ok(gain >= lo && gain <= hi, `${race} ${cls} level 2 gain ${gain} outside the scaled die [${lo}, ${hi}]`);
      seen[race === "Troll" ? "Troll" : "Thief"]++;
    }
  }
  assert.deepEqual(seen, { Troll: 40, Thief: 40 });
});

// ─── 2. registered claims ────────────────────────────────────────────────

const flavourText = {
  "RACE_NOTE.Troll": RACE_NOTE.Troll,
  "RACES.Troll.note": RACES.Troll.note,
  "CLASS_NOTE.Thief": CLASS_NOTE.Thief,
  "CLASS_NOTE.Magic User": CLASS_NOTE["Magic User"],
};
const footerOf = (kind, key) => {
  const f = identityFooter(kind, key);
  return [...f.good, ...f.bad];
};

/**
 * CLAIMS — every player-facing text that states a STARTING hit-point number.
 * `from` is where the text lives; `text` the whole text; `match` the exact
 * phrase it prints (the test parses the number out of it); `races`/`cls` the
 * heroes the claim is about. The Troll's claims are "whatever the class"; the
 * Thief's and the Magic User's blurbs speak for the races with no hit-point
 * modifier of their own (the Elven 60% is the Elf's own claim, part 4).
 */
const PLAIN_RACES = ["Human", "Dwarven", "Wilmsry", "Fridgian"];
const CLAIMS = [
  { from: "RACE_NOTE.Troll", text: flavourText["RACE_NOTE.Troll"], match: "75 starting hit points", races: ["Troll"], classes: Object.keys(CLASSES) },
  { from: "RACES.Troll.note", text: flavourText["RACES.Troll.note"], match: "75 hp", races: ["Troll"], classes: Object.keys(CLASSES) },
  { from: "footer.race.Troll", text: footerOf("race", "Troll").join(" | "), match: "75 HP", races: ["Troll"], classes: Object.keys(CLASSES) },
  { from: "CLASS_NOTE.Thief", text: flavourText["CLASS_NOTE.Thief"], match: "Fifty Hit Points", races: PLAIN_RACES, classes: ["Thief"] },
  { from: "CLASS_NOTE.Magic User", text: flavourText["CLASS_NOTE.Magic User"], match: "Thirty-six to forty-nine Hit Points", races: PLAIN_RACES, classes: ["Magic User"] },
];

test("92.3 claims: every registered starting hit-point claim appears in its text and is the engine's number", () => {
  for (const claim of CLAIMS) {
    assert.ok(claim.text.includes(claim.match), `${claim.from} no longer says ${JSON.stringify(claim.match)} (text: ${claim.text.slice(0, 120)})`);
    const [lo, hi] = claimRange(claim.match);
    for (const race of claim.races) for (const cls of claim.classes) {
      const [tlo, thi] = closedForm(race, cls);
      assert.deepEqual([lo, hi], [tlo, thi], `${claim.from} says ${claim.match} (${lo}-${hi}); a ${race} ${cls} starts at ${tlo}-${thi}`);
      for (const sub of CLASSES[cls].subs) {
        const got = measured.get(`${race}|${cls}|${sub}`);
        if (!got) continue;
        assert.deepEqual([got.min, got.max], [lo, hi], `${claim.from}: measured ${race} ${cls}/${sub} ${got.min}-${got.max}, text says ${lo}-${hi}`);
      }
    }
  }
});

test("92.3 claims: the number parser reads digits and number words", () => {
  assert.deepEqual(claimRange("75 starting hit points"), [75, 75]);
  assert.deepEqual(claimRange("Fifty Hit Points"), [50, 50]);
  assert.deepEqual(claimRange("Thirty-six to forty-nine Hit Points"), [36, 49]);
  assert.deepEqual(claimRange("seventy-one to eighty-one hp"), [71, 81]);
  assert.deepEqual(claimRange("15 HP"), [15, 15]);
});

// ─── 3. the coverage scan ────────────────────────────────────────────────

/** Every player-facing text that can name a hit-point number, labelled by where it lives. */
function allTexts() {
  const out = [];
  for (const [k, v] of Object.entries(RACE_NOTE)) out.push([`RACE_NOTE.${k}`, v]);
  for (const [k, v] of Object.entries(CLASS_NOTE)) out.push([`CLASS_NOTE.${k}`, v]);
  for (const [k, v] of Object.entries(SUB_NOTE)) out.push([`SUB_NOTE.${k}`, v]);
  for (const [k, v] of Object.entries(RACES)) out.push([`RACES.${k}.note`, v.note]);
  for (const kind of ["race", "sub"]) {
    for (const [key, rows] of Object.entries(IDENTITY_TRAITS[kind] ?? {})) {
      for (const side of ["good", "bad"]) (rows[side] ?? []).forEach((t, i) => out.push([`IDENTITY_TRAITS.${kind}.${key}.${side}.${i}`, t.text ?? t]));
    }
  }
  for (const race of Object.keys(RACES)) for (const t of footerOf("race", race)) out.push([`footer.race.${race}`, t]);
  for (const cls of Object.values(CLASSES)) for (const sub of cls.subs) for (const t of footerOf("sub", sub)) out.push([`footer.sub.${sub}`, t]);
  return out;
}

/**
 * ALLOWED — hit-point numbers that are NOT a starting value, each with its
 * source and the reason. Anything else the scan finds must be a registered
 * CLAIM (above) or the Elven percentage (part 4).
 */
const ALLOWED = [
  // upkeep: what a night without rations costs
  ["RACES.Dwarven.note", "1 HP", "upkeep"],
  ["RACES.Troll.note", "15 HP", "upkeep"],
  ["RACE_NOTE.Dwarven", "a single Hit Point", "upkeep"],
  ["RACE_NOTE.Troll", "15 HP", "upkeep"],
  ["footer.race.Dwarven", "1 HP", "upkeep"],
  ["footer.race.Troll", "15 HP", "upkeep"],
  // soak: what a Shield spell absorbs
  ["SUB_NOTE.Sorcerer", "5 more HP", "soak"],
  ["SUB_NOTE.Court Mage", "10 more HP", "soak"],
  ["SUB_NOTE.Cleric", "15 more HP", "soak"],
  ["SUB_NOTE.Summoner", "10 more HP", "soak"],
  ["footer.sub.Sorcerer", "5 more HP", "soak"],
  ["footer.sub.Summoner", "10 more HP", "soak"],
  ["footer.sub.Cleric", "15 more HP", "soak"],
  ["footer.sub.Court Mage", "10 more HP", "soak"],
  // the Knight's foe thresholds
  ["SUB_NOTE.Knight", "5 hp", "Knight threshold"],
  ["SUB_NOTE.Knight", "20 hit points", "Knight threshold"],
  ["IDENTITY_TRAITS.sub.Knight.good.0", "5 HP", "Knight threshold"],
  ["IDENTITY_TRAITS.sub.Knight.bad.0", "20 HP", "Knight threshold"],
  ["footer.sub.Knight", "5 HP", "Knight threshold"],
  ["footer.sub.Knight", "20 HP", "Knight threshold"],
  // the Pilfer's d10 of its own hp
  ["SUB_NOTE.Pilfer", "d10 of your own hp", "Pilfer d10"],
  ["IDENTITY_TRAITS.sub.Pilfer.bad.0", "d10 HP", "Pilfer d10"],
  ["footer.sub.Pilfer", "d10 HP", "Pilfer d10"],
];

test("92.3 coverage: no player-facing text names a hit-point number that is neither a registered claim nor an allowlisted non-start", () => {
  const claimed = new Set(CLAIMS.map((c) => `${c.from}\u0000${c.match.toLowerCase()}`));
  const allowed = new Set(ALLOWED.map(([from, match]) => `${from}\u0000${match.toLowerCase()}`));
  const seenAllowed = new Set();
  const problems = [];
  for (const [from, text] of allTexts()) {
    for (const m of String(text).matchAll(HP_NUMBER_RE)) {
      const key = `${from}\u0000${m[0].toLowerCase()}`;
      if (claimed.has(key)) continue;
      if (allowed.has(key)) { seenAllowed.add(key); continue; }
      problems.push(`${from}: ${JSON.stringify(m[0])} (in: ${String(text).slice(Math.max(0, m.index - 30), m.index + m[0].length + 20)})`);
    }
  }
  assert.deepEqual(problems, [], `unregistered hit-point numbers (register the claim in CLAIMS against the engine, or allowlist a non-start with its reason):\n${problems.join("\n")}`);
  // the allowlist is not stale: every entry still matches a real text
  const dead = ALLOWED.filter(([from, match]) => !seenAllowed.has(`${from}\u0000${match.toLowerCase()}`));
  assert.deepEqual(dead, [], "allowlist entries that no longer match any text");
});

test("92.3 coverage: the scan catches the shapes the guard exists for", () => {
  const hit = (s) => [...s.matchAll(HP_NUMBER_RE)].map((m) => m[0]);
  assert.deepEqual(hit("A Troll starts with 105 HP whatever the class"), ["105 HP"]);
  assert.deepEqual(hit("Forty Hit Points, studded leather"), ["Forty Hit Points"]);
  assert.deepEqual(hit("Twenty-five Hit Points plus whatever the d10 pities you with"), ["Twenty-five Hit Points"]);
  assert.deepEqual(hit("a d10 of your own hp"), ["d10 of your own hp"]);
  assert.deepEqual(hit("Thirty-six to forty-nine Hit Points"), ["Thirty-six to forty-nine Hit Points"]);
});

// ─── 4. the Elven 60% ────────────────────────────────────────────────────

test("92.3 the Elven claim: 60% of the usual hit points, checked at every class and against both Elven texts", () => {
  assert.equal(RACES.Elven.wpMul, 0.6);
  assert.match(RACE_NOTE.Elven, /\(60%/, "the Elven blurb says 60%");
  assert.ok(footerOf("race", "Elven").some((t) => /^60% of the usual HP, at every level$/.test(t)), "the Elven footer says 60%");
  // every percentage the texts print next to hit points is the Elven one
  for (const [from, text] of allTexts()) {
    for (const m of String(text).matchAll(HP_PERCENT_RE)) {
      assert.ok(/Elven/.test(from), `${from}: an unregistered hit-point percentage ${JSON.stringify(m[0])}`);
      assert.equal(Number(m[0].match(/\d+/)[0]), 60, `${from}: the Elven percentage is 60`);
    }
  }
  for (const cls of Object.keys(CLASSES)) {
    for (const sub of CLASSES[cls].subs) {
      const elf = measured.get(`Elven|${cls}|${sub}`);
      const human = measured.get(`Human|${cls}|${sub}`);
      for (const [e, h, which] of [[elf.min, human.min, "lowest"], [elf.max, human.max, "highest"]]) {
        const ratio = e / h;
        assert.ok(Math.abs(ratio - 0.6) <= 0.03, `Elven ${cls}/${sub} ${which} start ${e} vs Human ${h}: ratio ${ratio.toFixed(3)} is not about 60%`);
      }
    }
  }
});

// ─── 5. the Hero tab's view model ────────────────────────────────────────

test("92.3 the Hero tab: a new hero's hit-point bar is inside the stated range for every race and class", () => {
  for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) {
    const [lo, hi] = closedForm(race, cls);
    let checked = 0;
    for (let seed = 1; seed <= 4000 && checked < 2; seed++) {
      const state = newRun(seed);
      if (state.c.race !== race || state.c.cls !== cls) continue;
      const vm = characterSheetViewModel(state);
      assert.ok(vm.winPotential.max >= lo && vm.winPotential.max <= hi, `${race} ${cls} seed ${seed}: the Hero tab says ${vm.winPotential.max}, the range is ${lo}-${hi}`);
      assert.equal(vm.winPotential.value, vm.winPotential.max, "a new hero starts at full hit points");
      checked++;
    }
    assert.ok(checked > 0, `no seed under 4000 rolls a ${race} ${cls} (the Hero-tab check would be vacuous)`);
  }
});

// ─── 6. the damage-limit reference reads the same starting hit points (Phase 92.3 plan 02) ───

test("92.3-02 the mean-hero reference reads the shipped start: startWpMeanFor agrees with rollCharacter for every race and class", () => {
  for (const race of Object.keys(RACES)) for (const cls of Object.keys(CLASSES)) {
    const { wp, final } = startWpMeanFor(cls, race);
    const subs = CLASSES[cls].subs.filter((s) => !(race === "Fridgian" && s === "Samurai"));
    const m = measured.get(`${race}|${cls}|${subs[0]}`);
    const mean = [...m.values].reduce((a, b) => a + b, 0) / m.values.size; // a flat mean of the distinct faces: close enough for the unscaled branch
    if (final) {
      assert.equal(m.min, m.max, `${race} ${cls}: a final start never varies`);
      assert.equal(m.min, Math.round(wp), `${race} ${cls}: the engine deals the final start the reference reads`);
    } else {
      const scaled = wp * DIALS.HERO_HP_SCALE * (DIALS.CLASS_MITIGATION[cls]?.hpMul || 1);
      assert.ok(scaled >= m.min - 1 && scaled <= m.max + 1, `${race} ${cls}: the scaled mean ${scaled} is inside the dealt range ${m.min}-${m.max}`);
      assert.ok(Math.abs(scaled - mean) < 2, `${race} ${cls}: the scaled mean ${scaled} is near the dealt mean ${mean}`);
    }
  }
});

test("92.3-02 the ruled finals: the Thief reads 50 (an Elven Thief 30) and the Troll 75 in every class; the Thief's baseWP stays the canon 40", () => {
  assert.deepEqual(startWpMeanFor("Thief"), { wp: 50, final: true });
  assert.deepEqual(startWpMeanFor("Thief", "Elven"), { wp: 30, final: true });
  for (const cls of Object.keys(CLASSES)) assert.deepEqual(startWpMeanFor(cls, "Troll"), { wp: 75, final: true }, cls);
  assert.equal(CLASSES.Thief.baseWP.base, 40, "baseWP is the prototype's canon 40; only the start reads startWP");
});

test("92.3-02 heroMeanMaxWpFor(1) is the mean of the three classes' shipped Human starts (the Thief's 50 unscaled)", () => {
  const humanMean = (cls) => {
    const values = [...measured.get(`Human|${cls}|${CLASSES[cls].subs[0]}`).values];
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
  const dealt = Object.keys(CLASSES).reduce((sum, cls) => sum + humanMean(cls), 0) / Object.keys(CLASSES).length;
  assert.ok(Math.abs(heroMeanMaxWpFor(1) - dealt) < 1.5, `heroMeanMaxWpFor(1) ${heroMeanMaxWpFor(1)} is near the dealt mean ${dealt}`);
  // the Thief term is the final 50, not the canon 40 scaled to 56
  const without = heroMeanMaxWpFor(1) * 3 - 50;
  const mu = startWpMeanFor("Magic User").wp * DIALS.HERO_HP_SCALE;
  const ft = startWpMeanFor("Fighter").wp * DIALS.HERO_HP_SCALE;
  assert.ok(Math.abs(without - (mu + ft)) < 1e-9, "level 1: 3 x mean = Magic User scaled + Fighter scaled + 50");
});
