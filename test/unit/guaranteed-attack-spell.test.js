// test/unit/guaranteed-attack-spell.test.js
//
// IDENT-02 acceptance suite (Phase 23, Plan 02): every freshly rolled Magic
// User sub-class EXCEPT the Summoner has at least one level-1, day-one-
// castable ATTACK spell (Doze/Freeze/Stun/Weaken); the Summoner is exempt
// (its day-one "attack" is Summon, via IDENT-03's spell-level-override
// table). Locks the guarantee, the Summoner exemption, no-duplicate books,
// the OLD-vs-NEW adjacency bound (the change touches AT MOST one spell), and
// the zero-new-rng-draw property (FID-06) — all over >= 200 forced seeds per
// sub-class, mirroring test/determinism/forced-chargen.test.js's PAIRED seed
// convention (`i * 7919 + 1`).
//
// This file is self-contained: it restates the pinned per-sub rollGrimoire
// draw counts from test/unit/chargen-rng-pin.test.js (rather than importing
// them) so a regression here is visible without cross-referencing that file.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire } from "../../engine/character.js";
import { newRun } from "../../engine/engine.js";
import { SPELLS, CLASSES } from "../../content/index.js";
import { canLearn, schoolGate, isAttackSpell, castableAttackSpells, canCast, spellLevelFor } from "../../engine/derived.js";

// PAIRED seed convention, same as test/determinism/forced-chargen.test.js.
const SEED_COUNT = 200;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i * 7919 + 1);

const MU_SUBS = CLASSES["Magic User"].subs; // Wizard, Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage, Apprentice
const NON_SUMMONER_SUBS = MU_SUBS.filter((s) => s !== "Summoner");
const ATTACK_NAMES = new Set(["Doze", "Freeze", "Stun", "Weaken"]);

// --- countingRng: copied verbatim from test/unit/chargen-rng-pin.test.js /
// test/determinism/forced-chargen.test.js — wraps ANY rng object and counts
// every draw-producing call: d()/pick()/next() each count as 1 draw;
// shuffle(arr) counts max(0, arr.length - 1) draws, matching engine/rng.js's
// Fisher-Yates loop.
function countingRng(inner) {
  let draws = 0;
  const wrapped = {
    d(n) {
      draws++;
      return inner.d(n);
    },
    pick(a) {
      draws++;
      return inner.pick(a);
    },
    shuffle(a) {
      draws += Math.max(0, a.length - 1);
      return inner.shuffle(a);
    },
    get draws() {
      return draws;
    },
  };
  if (typeof inner.next === "function") {
    wrapped.next = () => {
      draws++;
      return inner.next();
    };
  }
  if (typeof inner.getState === "function") wrapped.getState = inner.getState;
  if (typeof inner.setState === "function") wrapped.setState = inner.setState;
  return wrapped;
}

// Pinned per-sub rollGrimoire draw counts, restated from
// test/unit/chargen-rng-pin.test.js so this file is self-contained.
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 39, Warlock: 33, Sorcerer: 35, Summoner: 31,
  Cleric: 34, Illusionist: 34, "Court Mage": 34, Apprentice: 38,
};

const spellByName = (n) => SPELLS.find((sp) => sp.n === n);

/**
 * oldRollGrimoire(rng, sub) — the byte-identical PRE-Phase-23 algorithm
 * (engine/character.js#rollGrimoire before the IDENT-02 attack top-up),
 * reproduced here so the adjacency test can measure exactly what changed.
 * The `spare` pool predicate below is the pre-override `usableNow`
 * (`sp.lvl === 1 && schoolGate(sub, sp.s) <= 1`) — never routed through
 * spellLevelFor, matching the frozen pre-change behavior.
 */
function oldRollGrimoire(rng, sub) {
  const pool = SPELLS.filter((sp) => canLearn(sub, sp));
  const low = pool.filter((sp) => sp.lvl <= 2),
    high = pool.filter((sp) => sp.lvl > 2);
  rng.shuffle(low);
  rng.shuffle(high);
  const n = Math.max(4, rng.d(10));
  const book = [];
  for (const sp of low) { if (book.length < Math.min(n, 6)) book.push(sp.n); }
  for (const sp of high) { if (book.length < n) book.push(sp.n); }
  if (sub === "Cleric") for (const n2 of ["Heal", "Major Heal"]) if (!book.includes(n2)) book.push(n2);
  if (sub === "Illusionist") for (const n2 of ["Mirror Self", "Phantom Host"]) if (!book.includes(n2)) book.push(n2);
  if (sub === "Summoner" && !book.includes("Summon")) book.push("Summon");
  if (sub === "Sorcerer") for (const n2 of ["Freeze", "Fireball"]) if (!book.includes(n2)) book.push(n2);
  const usableNow = (sp) => sp.lvl === 1 && schoolGate(sub, sp.s) <= 1;
  const ready = () => book.filter((n2) => usableNow(spellByName(n2))).length;
  const spare = pool.filter(usableNow);
  rng.shuffle(spare);
  for (const sp of spare) { if (ready() >= 2) break; if (!book.includes(sp.n)) book.push(sp.n); }
  return book;
}

/** oldUsableAttack(sub, book) — does `book` contain a spell that was already
 * "usable-now" (pre-override rule: sp.lvl===1 && schoolGate<=1) AND
 * attack-kind, under the OLD algorithm's own usableNow definition? Used by
 * the adjacency test to decide whether the top-up should have fired. */
function oldUsableAttack(sub, book) {
  return book.some((n2) => {
    const sp = spellByName(n2);
    return sp.lvl === 1 && schoolGate(sub, sp.s) <= 1 && isAttackSpell(sp);
  });
}

test("IDENT-02: every non-Summoner Magic User sub has a usable-now attack spell at level 1", () => {
  for (const sub of NON_SUMMONER_SUBS) {
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      const attacks = castableAttackSpells(state);
      assert.ok(
        attacks.length >= 1,
        `${sub} seed ${seed}: no castable attack spell (grimoire ${JSON.stringify(state.c.grimoire)})`,
      );
      assert.ok(
        state.c.grimoire.some((n) => ATTACK_NAMES.has(n)),
        `${sub} seed ${seed}: grimoire has no Doze/Freeze/Stun/Weaken (${JSON.stringify(state.c.grimoire)})`,
      );
    }
  }
});

test("IDENT-02/IDENT-03: the Summoner is exempt — no top-up attack, Summon is its day-one attack", () => {
  const Summon = spellByName("Summon");
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Summoner" } });
    assert.deepStrictEqual(
      castableAttackSpells(state),
      [],
      `Summoner seed ${seed}: expected no castable attack spell, got ${JSON.stringify(castableAttackSpells(state).map((s) => s.n))}`,
    );
    assert.ok(state.c.grimoire.includes("Summon"), `Summoner seed ${seed}: grimoire missing Summon`);
    assert.ok(canCast(state, Summon), `Summoner seed ${seed}: Summon should be castable at level 1`);

    // Independently re-derive "usable-now attack count" from the grimoire
    // names, mirroring rollGrimoire's own usableNow predicate — should be 0.
    const usableNowAttackCount = state.c.grimoire.filter((n) => {
      const sp = spellByName(n);
      return spellLevelFor("Summoner", sp) === 1 && state.c.level >= schoolGate("Summoner", sp.s) && isAttackSpell(sp);
    }).length;
    assert.equal(usableNowAttackCount, 0, `Summoner seed ${seed}: expected 0 usable-now attack spells`);
  }
});

test("no duplicate spell names in any rolled grimoire, across all 8 Magic User subs", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const rng = makeRng(seed);
      const book = rollGrimoire(rng, sub);
      assert.equal(new Set(book).size, book.length, `${sub} seed ${seed}: duplicate spell name in ${JSON.stringify(book)}`);
    }
  }
});

test("adjacency: the new algorithm differs from the old by at most one spell, for every sub and seed", () => {
  const SIX_NO_OVERRIDE = ["Wizard", "Warlock", "Sorcerer", "Cleric", "Court Mage", "Apprentice"];

  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const oldBook = oldRollGrimoire(makeRng(seed), sub);
      const newBook = rollGrimoire(makeRng(seed), sub);

      assert.ok(
        Math.abs(newBook.length - oldBook.length) <= 1,
        `${sub} seed ${seed}: books differ by more than one spell (old ${JSON.stringify(oldBook)}, new ${JSON.stringify(newBook)})`,
      );

      if (SIX_NO_OVERRIDE.includes(sub)) {
        if (oldUsableAttack(sub, oldBook)) {
          assert.deepStrictEqual(newBook, oldBook, `${sub} seed ${seed}: old book already had a usable-now attack, new book should be unchanged`);
        } else {
          assert.equal(newBook.length, oldBook.length + 1, `${sub} seed ${seed}: expected exactly one appended spell`);
          for (let i = 0; i < oldBook.length; i++) {
            assert.equal(newBook[i], oldBook[i], `${sub} seed ${seed}: new book is not a strict prefix-preserving extension of old`);
          }
          const appended = newBook[newBook.length - 1];
          assert.ok(isAttackSpell(spellByName(appended)), `${sub} seed ${seed}: appended spell ${appended} is not attack-kind`);
        }
      } else if (sub === "Summoner") {
        assert.ok(
          oldBook.length - newBook.length === 0 || oldBook.length - newBook.length === 1,
          `Summoner seed ${seed}: expected old.length - new.length in {0,1}, got ${oldBook.length - newBook.length}`,
        );
        for (const n of newBook) assert.ok(oldBook.includes(n), `Summoner seed ${seed}: new book has a name (${n}) old book lacks`);
        assert.ok(!oldUsableAttack(sub, newBook), `Summoner seed ${seed}: new book must contain no usable-now attack spell`);
      } else if (sub === "Illusionist") {
        const added = newBook.filter((n) => !oldBook.includes(n));
        const removed = oldBook.filter((n) => !newBook.includes(n));
        assert.ok(added.length <= 1, `Illusionist seed ${seed}: more than one added spell (${JSON.stringify(added)})`);
        if (added.length === 1) assert.ok(isAttackSpell(spellByName(added[0])), `Illusionist seed ${seed}: added spell ${added[0]} is not attack-kind`);
        assert.ok(removed.length <= 1, `Illusionist seed ${seed}: more than one removed spell (${JSON.stringify(removed)})`);
      }
    }
  }
});

test("zero-draw proof: rollGrimoire's rng draw count per sub is unchanged, over 200 seeds", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const rng = makeRng(seed);
      const counting = countingRng(rng);
      rollGrimoire(counting, sub);
      assert.equal(
        counting.draws,
        ROLL_GRIMOIRE_DRAW_COUNTS[sub],
        `${sub} seed ${seed}: rollGrimoire drew ${counting.draws} rng values, expected the pinned constant ${ROLL_GRIMOIRE_DRAW_COUNTS[sub]} (FID-06 ordering regression)`,
      );
    }
  }
});

test("fixture seeds: seed 24 (Apprentice) gains Freeze; seed 15 (Summoner) drops Heal", () => {
  assert.equal(newRun(24).c.grimoire.at(-1), "Freeze", `seed 24: expected Freeze as the last grimoire entry, got ${JSON.stringify(newRun(24).c.grimoire)}`);
  assert.deepStrictEqual(newRun(15).c.grimoire, ["Stupidity", "Stun", "Shield", "Summon"]);
});
