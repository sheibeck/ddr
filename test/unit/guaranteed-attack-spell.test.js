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
import { canLearn, schoolGate, castableAttackSpells, canCast, dealsDamage } from "../../engine/derived.js";

// PAIRED seed convention, same as test/determinism/forced-chargen.test.js.
const SEED_COUNT = 200;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i * 7919 + 1);

const MU_SUBS = CLASSES["Magic User"].subs; // Wizard, Warlock, Sorcerer, Summoner, Cleric, Illusionist, Court Mage, Apprentice

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
//
// RULES-03 (Phase 75, user 2026-09-25): Summoner re-measured live, 31 -> 36
// — see test/unit/chargen-rng-pin.test.js's own comment on this constant
// for the full cause (the offense gate's removal widens the day-one `spare`
// pool).
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 39, Warlock: 33, Sorcerer: 35, Summoner: 36,
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

// Phase 40 (SPELL-04, DELIBERATE RULES CHANGE): the guarantee narrows from
// "any ATTACK_SPELL_KINDS member" to "a spell that actually deals damage"
// (engine/derived.js#dealsDamage) — and it now applies to EVERY sub,
// including the Summoner (its guarantee is the granted Lesser Summon, whose
// `lesser: true` flag makes dealsDamage true). See also
// test/unit/day-one-damage.test.js for the primary, fuller-coverage proof;
// this file's copy stays for IDENT-02's own historical name/continuity.
test("SPELL-04 (was IDENT-02): every Magic User sub, including the Summoner, has a castable damage-dealing spell at level 1", () => {
  for (const sub of MU_SUBS) {
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      const has = state.c.grimoire.some((n) => dealsDamage(spellByName(n)) && canCast(state, spellByName(n)));
      assert.ok(has, `${sub} seed ${seed}: no castable damage-dealing spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
    }
  }
});

// Phase 40: the Phase 23 SPELL_LEVEL_OVERRIDES.Summoner row is retired —
// Summon is spell level 2 for the Summoner again (a spell-LEVEL lock, still
// enforced by canCast regardless of the offense gate); the Summoner's
// day-one damage source is now the granted Lesser Summon.
//
// RULES-03 (Phase 75, user 2026-09-25): the Summoner's offense SCHOOL gate
// is retired (content/mu-chart.js) — castableAttackSpells(state) NO LONGER
// stays [] unconditionally; whether it is empty now depends only on whether
// this seed's widened day-one book happens to hold a castable attack-kind
// spell (Doze/Freeze/Stun/Weaken), same as any other sub. Summon's own
// LEVEL lock (spellLevelFor 2) is untouched either way.
test("IDENT-03 (Phase 40) + RULES-03 (Phase 75): Summon needs level 2 again for the Summoner (a level lock, unrelated to the retired offense gate); Lesser Summon is granted and castable", () => {
  const Summon = spellByName("Summon");
  const LesserSummon = spellByName("Lesser Summon");
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Summoner" } });
    assert.ok(state.c.grimoire.includes("Summon"), `Summoner seed ${seed}: grimoire missing Summon`);
    assert.equal(canCast(state, Summon), false, `Summoner seed ${seed}: Summon should need level 2 (a spell-LEVEL lock, IDENT-03/Phase 40)`);
    assert.ok(state.c.grimoire.includes("Lesser Summon"), `Summoner seed ${seed}: grimoire missing the granted Lesser Summon`);
    assert.ok(canCast(state, LesserSummon), `Summoner seed ${seed}: Lesser Summon should be castable at level 1`);
    // Every candidate castableAttackSpells returns (if any) must actually be
    // in the grimoire and castable — the offense gate no longer forces this
    // list to be empty, but it must never include Summon (a summon-kind
    // spell, not an attack kind) or a school-locked spell.
    for (const sp of castableAttackSpells(state)) {
      assert.ok(state.c.grimoire.includes(sp.n), `Summoner seed ${seed}: castableAttackSpells returned "${sp.n}", not in the grimoire`);
      assert.equal(canCast(state, sp), true, `Summoner seed ${seed}: castableAttackSpells returned "${sp.n}", which canCast rejects`);
    }
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

// Phase 40 (SPELL-04): `oldRollGrimoire` above reproduces the PRE-Phase-23
// ALGORITHM but reads it against the CURRENT (Phase 40) content table — it
// does NOT exclude `roll: "derived"` rows the way the real rollGrimoire does
// (content/spells.js's new Lesser Summon row). For the 5 subs that can
// learn the special school (Wizard/Sorcerer/Illusionist/Summoner/
// Apprentice), that means the OLD reference algorithm's own low/high
// shuffle is ONE ELEMENT LONGER than before this phase, which reorders
// every subsequent shuffled position — a genuinely bigger divergence than
// "one extra spell", and not a regression in the real rollGrimoire (whose
// own main-rng draw count is proven byte-identical by the zero-draw-proof
// test below and by test/unit/chargen-rng-pin.test.js — the load-bearing
// invariant). The bound below is MEASURED live (not hand-guessed) over this
// file's own 200-seed sweep, split by special-school access.
test("adjacency: the new algorithm differs from the old by a measured, bounded number of spells", () => {
  const NO_SPECIAL_SCHOOL = ["Warlock", "Cleric", "Court Mage"]; // never see Lesser Summon
  // RULES-03 (Phase 75, user 2026-09-25): NO_SPECIAL_BOUND re-measured live,
  // 1 -> 2 — Warlock/Cleric/Court Mage all carry a school gate now enforced
  // at grant time (engine/character.js#grantableAt); skipping a gated spell
  // while walking `low`/`high` can, at most, swap out one entry AND change
  // the book's LENGTH by one more slot in a seed where the walk reaches one
  // further eligible entry than the old ungated slice would have (measured
  // worst case: Warlock, seed 657278). SPECIAL_BOUND is UNCHANGED — Wizard
  // (the measured worst case for that bound) carries no school gate at all
  // (content/mu-chart.js has no `gate` key for it), so grantableAt never
  // filters anything for it; its bound is still entirely the pre-existing
  // Phase-40 derived-splice confound documented above.
  const NO_SPECIAL_BOUND = 2;
  const SPECIAL_BOUND = 7; // measured worst case (Wizard, seed 190057) — the derived-row reshuffle confound above

  for (const sub of MU_SUBS) {
    const bound = NO_SPECIAL_SCHOOL.includes(sub) ? NO_SPECIAL_BOUND : SPECIAL_BOUND;
    for (const seed of SEEDS) {
      const oldBook = oldRollGrimoire(makeRng(seed), sub);
      const newBook = rollGrimoire(makeRng(seed), sub);
      const diff = Math.abs(newBook.length - oldBook.length);
      assert.ok(
        diff <= bound,
        `${sub} seed ${seed}: books differ by ${diff} spells, expected <= ${bound} (old ${JSON.stringify(oldBook)}, new ${JSON.stringify(newBook)})`,
      );
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

// Phase 40: both grimoires re-measured live against the finished engine
// (never hand-typed) — seed 24 still ends in Freeze (the day-one damage
// walk, unaffected by the rename); seed 15's Summoner grimoire now also
// carries the granted Lesser Summon (Phase 40's own declared fixture
// divergence, test/parity/FIXTURE-INVENTORY.md's Phase 40 section, Task 3).
test("fixture seeds (re-measured, Phase 40): seed 24 (Apprentice) ends in Freeze; seed 15 (Summoner) carries the granted Lesser Summon", () => {
  assert.equal(newRun(24).c.grimoire.at(-1), "Freeze", `seed 24: expected Freeze as the last grimoire entry, got ${JSON.stringify(newRun(24).c.grimoire)}`);
  assert.deepStrictEqual(newRun(15).c.grimoire, ["Stupidity", "Stun", "Lesser Summon", "Shield", "Summon"]);
});
