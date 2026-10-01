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
// pool). Phase 90 plan 06 (SPELL-12): Wizard 39 -> 36, Illusionist 34 -> 33,
// Apprentice 38 -> 37, measured live — see that file's declaration. Phase 91 plan 02
// (IDENT-15): Cleric 34 -> 10, measured live (the offense school left both pool
// shuffles) — same declaration.
const ROLL_GRIMOIRE_DRAW_COUNTS = {
  Wizard: 36, Warlock: 33, Sorcerer: 35, Summoner: 36,
  Cleric: 12, Illusionist: 33, "Court Mage": 34, Apprentice: 37,
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
  if (sub === "Illusionist") for (const n2 of ["Mirror Self"]) if (!book.includes(n2)) book.push(n2);
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
// including the Summoner. Phase 90 plan 06 (SPELL-12): the Summoner's granted
// Lesser Summon (whose `lesser: true` flag made dealsDamage true) is removed;
// the Summoner gets its damage spell from the same top-up as everyone. See also
// test/unit/day-one-damage.test.js for the primary, fuller-coverage proof;
// this file's copy stays for IDENT-02's own historical name/continuity.
test("SPELL-04 (was IDENT-02): every Magic User sub but the Cleric, including the Summoner, has a castable damage-dealing spell at level 1", () => {
  // Phase 91 plan 02 (IDENT-15, user 2026-09-30): the Cleric never learns the
  // offense school, so it holds no damage spell by ruling (a test-side
  // exclusion only; the engine has no Cleric check). Pinned in
  // test/unit/cleric-offense-ban.test.js and test/unit/day-one-damage.test.js.
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Cleric" } });
    assert.ok(!state.c.grimoire.some((n) => dealsDamage(spellByName(n))), `Cleric seed ${seed}: holds a damage spell (${JSON.stringify(state.c.grimoire)})`);
  }
  for (const sub of MU_SUBS.filter((s) => s !== "Cleric")) {
    for (const seed of SEEDS) {
      const state = newRun(seed, [], { force: { sub } });
      const has = state.c.grimoire.some((n) => dealsDamage(spellByName(n)) && canCast(state, spellByName(n)));
      assert.ok(has, `${sub} seed ${seed}: no castable damage-dealing spell (grimoire ${JSON.stringify(state.c.grimoire)})`);
    }
  }
});

// Phase 90 plan 06 (SPELL-12): the Summoner casts the level-2 Summon from
// level 1 (the named exception in content/spell-level-overrides.js); Phase
// 40's Lesser Summon is removed.
//
// RULES-03 (Phase 75, user 2026-09-25): the Summoner's offense SCHOOL gate
// is retired (content/mu-chart.js) — castableAttackSpells(state) NO LONGER
// stays [] unconditionally; whether it is empty now depends only on whether
// this seed's widened day-one book happens to hold a castable attack-kind
// spell (Doze/Freeze/Stun/Weaken), same as any other sub. Summon's own
// LEVEL lock (spellLevelFor 2) is untouched either way.
test("IDENT-03 (Phase 90 plan 06, SPELL-12) + RULES-03 (Phase 75): the Summoner is granted Summon and casts it at level 1 (the named exception); Lesser Summon is gone", () => {
  const Summon = spellByName("Summon");
  assert.equal(spellByName("Lesser Summon"), undefined);
  for (const seed of SEEDS) {
    const state = newRun(seed, [], { force: { sub: "Summoner" } });
    assert.ok(state.c.grimoire.includes("Summon"), `Summoner seed ${seed}: grimoire missing Summon`);
    assert.equal(canCast(state, Summon), true, `Summoner seed ${seed}: Summon should be castable at level 1 (the SPELL-12 exception)`);
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
  // Phase 90 plan 07 (SPELL-10): the four Special spells are four more derived rows, so the five
  // special-school subs (and the old reference algorithm, which does not exclude them) differ by
  // up to one more spell; re-measured live over this file's 200 seeds, 7 -> 8 (worst case: Illusionist,
  // seed 411789). NO_SPECIAL_BOUND is unchanged (Warlock, Cleric and Court Mage never see a Special row).
  // Phase 90 plan 09 (SPELL-10): the three Illusion rows are three more derived rows, and the
  // Illusionist's book now ends with Door Illusion and one random Illusion spell (two appended
  // entries the old reference algorithm never makes); re-measured live over this file's 200 seeds,
  // 8 -> 9 (worst case: Illusionist, seed 174219).
  const SPECIAL_BOUND = 9; // measured worst case (Illusionist, seed 174219) — the derived-row reshuffle confound above

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
//
// Phase 90 plan 06 (SPELL-12): seed 15's Summoner book re-measured live, before
// -> after: ["Stupidity", "Stun", "Lesser Summon", "Shield", "Summon"] ->
// ["Stupidity", "Stun", "Shield", "Summon", "Freeze"] (Lesser Summon is gone; the
// day-one damage top-up adds Freeze, since a summon never counts as damage).
//
// Phase 90 plan 07 (SPELL-10): seed 15's Summoner book re-measured live, before -> after:
// ["Stupidity", "Stun", "Shield", "Summon", "Freeze"] -> ["Stupidity", "Stun", "Open/Lock",
// "Shield", "Summon", "Freeze"] (a Summoner may learn Special, so the derived splice puts Open/Lock
// in its low walk). Seed 24 still ends in Freeze.
test("fixture seeds (re-measured, Phase 90 plan 07): seed 24 (Apprentice) ends in Freeze; seed 15 (Summoner) holds Summon and the topped-up Freeze", () => {
  assert.equal(newRun(24).c.grimoire.at(-1), "Freeze", `seed 24: expected Freeze as the last grimoire entry, got ${JSON.stringify(newRun(24).c.grimoire)}`);
  assert.deepStrictEqual(newRun(15).c.grimoire, ["Stupidity", "Stun", "Open/Lock", "Shield", "Summon", "Freeze"]);
});
