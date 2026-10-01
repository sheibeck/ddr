// test/unit/illusionist-book.test.js
//
// Phase 90 plan 09 (SPELL-10; canon p.17: an Illusionist starts with "3
// illusion spells on top of the beginning roll"; the user-accepted default of
// 2026-09-30): a new Illusionist's book holds Mirror Self, Door Illusion and
// ONE more Illusion spell it did not roll, picked on rollGrimoire's derived
// stream (castable once it reaches that spell's level). The grants are appended
// after the rolled book and its day-one top-ups, so they never reorder a
// main-rng draw, and no other sub-class gets them.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire } from "../../engine/character.js";
import { SPELLS } from "../../content/index.js";
import { canLearn } from "../../engine/derived.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ILLUSION = SPELLS.filter((sp) => sp.s === "illusion").map((sp) => sp.n);
const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);

/** countingRng — wraps a real rng and counts every main-rng draw (d/pick/next,
 * and shuffle's n-1), so a derived-stream grant is provably free. */
function countingRng(inner) {
  let draws = 0;
  return {
    d(n) { draws++; return inner.d(n); },
    pick(a) { draws++; return inner.pick(a); },
    next() { draws++; return inner.next(); },
    shuffle(arr) { draws += Math.max(0, arr.length - 1); return inner.shuffle(arr); },
    getState: () => inner.getState(),
    get draws() { return draws; },
  };
}

test("a new Illusionist's book holds Mirror Self, Door Illusion and at least one other Illusion spell, on every seed 1-500", () => {
  for (const seed of SEEDS) {
    const book = rollGrimoire(makeRng(seed), "Illusionist", 1);
    assert.ok(book.includes("Mirror Self"), `seed ${seed}: Mirror Self`);
    assert.ok(book.includes("Door Illusion"), `seed ${seed}: Door Illusion`);
    const illusions = book.filter((n) => ILLUSION.includes(n));
    assert.ok(illusions.length >= 3, `seed ${seed}: three illusions (${illusions.join(", ")})`);
    assert.equal(new Set(book).size, book.length, `seed ${seed}: no duplicates`);
  }
});

test("the grants follow the rolled book in the order Mirror Self, Door Illusion, then the random illusion", () => {
  let checked = 0;
  for (const seed of SEEDS) {
    const book = rollGrimoire(makeRng(seed), "Illusionist", 1);
    const mirror = book.indexOf("Mirror Self");
    const door = book.indexOf("Door Illusion");
    // the random grant is the LAST entry when it is appended (a rolled Door or other
    // illusion can already be anywhere earlier in the book)
    const last = book[book.length - 1];
    if (!ILLUSION.includes(last) || last === "Door Illusion" || last === "Mirror Self") continue;
    // when the grant appended Door too, it sits right before it; otherwise Door was rolled earlier
    assert.ok(mirror < book.length - 1, `seed ${seed}: Mirror Self before the random grant`);
    assert.ok(door < book.length - 1, `seed ${seed}: Door Illusion before the random grant`);
    if (door === book.length - 2) assert.ok(mirror < door, `seed ${seed}: Mirror Self before Door Illusion`);
    checked++;
  }
  assert.ok(checked > 400, "the order is checked on nearly every seed");
});

test("the random pick is an Illusion spell the book did not otherwise hold; it can be any level (a level-5 pick waits in the book)", () => {
  const picked = new Set();
  for (const seed of SEEDS) {
    const book = rollGrimoire(makeRng(seed), "Illusionist", 1);
    const last = book[book.length - 1];
    if (ILLUSION.includes(last) && last !== "Mirror Self" && last !== "Door Illusion") picked.add(last);
  }
  for (const n of picked) assert.ok(canLearn("Illusionist", SP[n]), `${n} is learnable by an Illusionist`);
  assert.ok(picked.size >= 3, `the pick varies across seeds (${[...picked].join(", ")})`);
  assert.ok([...picked].some((n) => SP[n].lvl > 1), "a pick above level 1 happens, and sits in the book until the Illusionist reaches it");
});

test("the grant is free of main-rng draws: the cursor after rollGrimoire is exactly what the shuffles and the d10 take (33 for the Illusionist, as pinned)", () => {
  for (const seed of [1, 2, 3, 8, 24, 99]) {
    const a = countingRng(makeRng(seed));
    rollGrimoire(a, "Illusionist", 1);
    assert.equal(a.draws, 33, `seed ${seed}: draw count`);
    const b = makeRng(seed);
    const c2 = makeRng(seed);
    rollGrimoire(b, "Illusionist", 1);
    rollGrimoire(c2, "Illusionist", 1);
    assert.equal(b.getState(), c2.getState(), "deterministic");
  }
});

test("rollGrimoire is deterministic: the same seed gives the same book including the grants", () => {
  for (const seed of [5, 50, 500]) {
    assert.deepEqual(rollGrimoire(makeRng(seed), "Illusionist", 1), rollGrimoire(makeRng(seed), "Illusionist", 1));
  }
});

test("only the Illusionist gets the grants: every other sub-class's book holds no Door Illusion it was not dealt by the roll, and no sub-class that cannot learn Illusion ever holds one", () => {
  const subs = ["Wizard", "Warlock", "Sorcerer", "Court Mage", "Cleric", "Summoner", "Apprentice"];
  for (const sub of subs) {
    for (const seed of SEEDS) {
      const book = rollGrimoire(makeRng(seed), sub, 1);
      for (const n of book) {
        if (SP[n].s === "illusion") assert.ok(canLearn(sub, SP[n]), `${sub} seed ${seed} holds ${n}`);
      }
      if (sub !== "Apprentice") {
        assert.equal(book.some((n) => SP[n].s === "illusion"), false, `${sub} seed ${seed}: no Illusion spell at all`);
      }
    }
  }
});
