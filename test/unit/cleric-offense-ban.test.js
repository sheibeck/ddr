// test/unit/cleric-offense-ban.test.js
//
// Phase 91 plan 02 (IDENT-15), user ruling 2026-09-30: "cannot cast offensive
// spells, because they gain more hit points" + "always starts with the
// level-1 Heal spell". The ban is gate DATA (content/mu-chart.js: the Cleric's
// offense school is null, never learned), the same data Phase 90 plan 06 wrote
// for the new Special and Illusion spells, so canLearn / grantableAt / the
// scribe gate / canCast / the combat spell menu all follow it with no Cleric
// name check anywhere.
//
// FLAGGED ASSUMPTION (unclassified probe IDENT-15): "offensive spells" means
// the offense school (MU_CHART's offense column), including its buff Strength.
// Bard songs and staves are not Cleric casting. Q3 B (user 2026-09-30, RULES-10):
// a SCROLL that rolls an offense spell still free-casts for a Cleric; the ban is
// the Cleric's own book (learn, deal, copy, cast), pinned below.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { rollGrimoire, checkLevel } from "../../engine/character.js";
import { findGrimoire, meetJoiner } from "../../engine/encounters.js";
import { castSpell, readScroll } from "../../engine/magic.js";
import { SPELLS, MU_CHART, CLASSES } from "../../content/index.js";
import { canCast, canLearn, schoolAllowed, castableAttackSpells, bestAttackSpell } from "../../engine/derived.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { maxCharges } from "../../engine/movement.js";

const byName = (n) => SPELLS.find((sp) => sp.n === n);
const OFFENSE = SPELLS.filter((sp) => sp.s === "offense");
const isOffense = (n) => byName(n).s === "offense";
const SEEDS_1000 = Array.from({ length: 1000 }, (_, i) => i + 1);
const clericOf = (seed) => newRun(seed, [], { force: { cls: "Magic User", sub: "Cleric" } });

test("IDENT-15 gate data: the Cleric's offense school is never learned, and every other school's value is unchanged", () => {
  assert.equal(MU_CHART.Cleric.offense, null);
  assert.equal(schoolAllowed("Cleric", "offense"), false);
  assert.ok(OFFENSE.length > 0);
  for (const sp of OFFENSE) assert.equal(canLearn("Cleric", sp), false, sp.n);
  // the rest of the row is what Phase 90 left
  assert.deepEqual(MU_CHART.Cleric, {
    offense: null, protection: 3, healing: 4, divination: 0, special: null, illusion: null,
    gate: { divination: 3 },
  });
  // every other sub-class still learns offense except the Illusionist-style closures Phase 90 owns
  for (const sub of CLASSES["Magic User"].subs.filter((s) => s !== "Cleric")) assert.equal(schoolAllowed(sub, "offense"), true, sub);
});

test("IDENT-15: every new Cleric holds Heal and can cast it on day one, seeds 1 to 1000", () => {
  const heal = byName("Heal");
  for (const seed of SEEDS_1000) {
    const state = clericOf(seed);
    assert.equal(state.c.sub, "Cleric");
    assert.equal(state.c.level, 1);
    assert.ok(state.c.grimoire.includes("Heal"), `seed ${seed}: no Heal in ${JSON.stringify(state.c.grimoire)}`);
    assert.equal(canCast(state, heal), true, `seed ${seed}: Heal not castable at level 1`);
    assert.ok(maxCharges(state.c) - state.c.spellsUsed > 0, `seed ${seed}: no charge`);
  }
});

test("IDENT-15: no new Cleric's book holds an offense spell, seeds 1 to 1000 (rolled, never dealt)", () => {
  for (const seed of SEEDS_1000) {
    const book = clericOf(seed).c.grimoire;
    assert.ok(book.every((n) => !isOffense(n)), `seed ${seed}: ${JSON.stringify(book)}`);
    assert.ok(book.includes("Major Heal"), `seed ${seed}`);
    assert.equal(new Set(book).size, book.length, `seed ${seed}: duplicate`);
  }
});

test("IDENT-15: the Cleric's day-one damage top-up ends quietly (nothing castable that damages, no throw, a Cleric still has an act)", () => {
  for (const seed of SEEDS_1000.slice(0, 200)) {
    const state = clericOf(seed);
    assert.equal(castableAttackSpells(state).length, 0, `seed ${seed}`);
    assert.equal(bestAttackSpell(state), null, `seed ${seed}`);
  }
});

test("IDENT-15: level-ups never give a Cleric an offense spell (checkLevel walked to level 5, seeds 1 to 50)", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const state = clericOf(seed);
    state.c.sp = 1501; // level 5
    checkLevel(state, makeRng(seed), []);
    assert.equal(state.c.level, 5);
    assert.ok(state.c.grimoire.every((n) => !isOffense(n)), `seed ${seed}: ${JSON.stringify(state.c.grimoire)}`);
  }
});

test("IDENT-15: a found grimoire never adds an offense spell to a Cleric, seeds 1 to 200", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const state = clericOf(seed);
    state.c.level = 5;
    findGrimoire(state, makeRng(seed), []);
    assert.ok(state.c.grimoire.every((n) => !isOffense(n)), `seed ${seed}: ${JSON.stringify(state.c.grimoire)}`);
  }
});

test("IDENT-15 scribe gate: a scroll never copies an offense spell into a Cleric's book, seeds 1 to 300", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const state = clericOf(seed);
    state.c.level = 5;
    state.c.scrolls = 3;
    const rng = makeRng(seed);
    for (let i = 0; i < 3; i++) readScroll(state, rng, []);
    assert.ok(state.c.grimoire.every((n) => !isOffense(n)), `seed ${seed}: ${JSON.stringify(state.c.grimoire)}`);
  }
});

test("Q3 B (RULES-10): a scroll that rolls an offense spell STILL casts for a Cleric (not copied, free cast), the ban is the book's", () => {
  const state = clericOf(1);
  const strength = byName("Strength"); // an offense-school spell that is not combat-only, so it fires outside a fight
  const before = [...state.c.grimoire];
  state.c.scrolls = 1;
  const events = readScroll(state, { pick: (a) => a.find((sp) => sp.n === "Strength"), d: () => 1, shuffle: (a) => a }, []);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.spell === "Strength"));
  assert.equal(events.some((e) => e.type === "scrollCopiedToGrimoire"), false, "the book never copies it");
  assert.equal(events.some((e) => e.type === "spellSchoolLocked"), false, "the scroll path is not school-locked");
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Strength"), JSON.stringify(events));
  assert.ok(events.some((e) => e.type === "strengthCast"), "the free cast took effect");
  assert.ok(state.c.timers && state.c.timers["spell:Strength"], "Strength's timed effect started");
  assert.deepEqual(state.c.grimoire, before);
  assert.equal(canCast(state, strength), false);
});

test("IDENT-15 cast gate: an old book that holds an offense spell never casts it (spellSchoolLocked, forbidden, no charge spent)", () => {
  const state = clericOf(1);
  state.c.level = 5;
  for (const sp of OFFENSE) state.c.grimoire.push(sp.n);
  for (const sp of OFFENSE) {
    assert.equal(canCast(state, sp), false, sp.n);
    const before = state.c.spellsUsed;
    const events = castSpell(state, SPELLS.indexOf(sp), makeRng(3), []);
    const locked = events.find((e) => e.type === "spellSchoolLocked");
    assert.ok(locked, `${sp.n}: ${JSON.stringify(events)}`);
    assert.equal(locked.forbidden, true);
    assert.equal(locked.school, "offense");
    assert.equal(state.c.spellsUsed, before, `${sp.n}: a charge was spent`);
  }
});

test("IDENT-15 menu: the combat spell rows for a Cleric never include an offense spell, even from an old book", () => {
  const state = clericOf(2);
  state.c.level = 5;
  for (const sp of OFFENSE) if (!state.c.grimoire.includes(sp.n)) state.c.grimoire.push(sp.n);
  const rows = combatMenuViewModel(state).submenus.spells.rows;
  assert.ok(rows.length > 0, "the menu still lists the Cleric's other spells");
  assert.ok(rows.some((r) => r.id === `spell-${SPELLS.indexOf(byName("Heal"))}`), "Heal is on the menu");
  for (const sp of OFFENSE) assert.equal(rows.some((r) => r.id === `spell-${SPELLS.indexOf(sp)}`), false, `${sp.n} listed`);
});

test("IDENT-15 Joiner: a Joiner Cleric (meetJoiner) holds no offense spell, and its book still holds Heal", () => {
  let seen = 0;
  for (let k = 1; k <= 1500 && seen < 25; k++) {
    const state = newRun(1, [], { force: { cls: "Fighter", sub: "Soldier", race: "Human" } });
    meetJoiner(state, makeRng(k), []);
    const j = state.pendingJoiner;
    if (!j || j.sub !== "Cleric") continue;
    seen++;
    assert.ok(j.grimoire.every((n) => !isOffense(n)), `k ${k}: ${JSON.stringify(j.grimoire)}`);
    assert.ok(j.grimoire.includes("Heal"), `k ${k}`);
  }
  assert.ok(seen >= 10, `only ${seen} Cleric Joiners found in the scan`);
});

test("IDENT-15: rollGrimoire's Cleric draws a pinned, smaller main-rng count (ten: the offense school left both shuffles) and never throws", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rng = makeRng(seed);
    let draws = 0;
    const counting = {
      d(n) { draws++; return rng.d(n); },
      pick(a) { draws++; return rng.pick(a); },
      shuffle(a) { draws += Math.max(0, a.length - 1); return rng.shuffle(a); },
      getState: rng.getState,
      setState: rng.setState,
    };
    const book = rollGrimoire(counting, "Cleric");
    assert.equal(draws, 10, `seed ${seed}`);
    assert.ok(book.includes("Heal"));
  }
});
