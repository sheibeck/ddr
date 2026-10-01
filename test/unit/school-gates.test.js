// test/unit/school-gates.test.js
//
// Phase 90 plan 06 (SPELL-10, SPELL-12): the SCHOOL-GATE GUARD.
//
// The user's words (90-CONTEXT.md, "School gates hold for the new spells",
// 2026-09-30): "We need to make sure that sub-classes or races that cannot cast
// personalized [Special] or illusionist spell schools are properly excluded
// after we add those." Pinned: a seed-sweep test (every Magic User sub-class x
// a wide seed range x levels 1-5) proves no book ever holds, and no menu ever
// offers, a spell from a school that sub-class cannot learn, and a content guard
// fails if a new spell's school is missing from MU_CHART. The Summoner's ruled
// exception (Summon from level 1) is a NAMED entry in the gate data
// (content/spell-level-overrides.js), never a name check scattered in code.
//
// EVERY path that hands out a spell is swept (90-CONTEXT: "chargen rollGrimoire
// (hero and Joiner Magic Users), level-up spell picks, the Wizard's day-one
// pool, copying a scroll into the book (scribing), store and loot scroll offers
// made for the hero's own book, and the combat spell menu"):
//
//   1. chargen rollGrimoire, every sub-class x seeds 1-500 x levels 1-5 (the
//      Wizard's day-one pool is the Wizard's rollGrimoire)
//   2. a Joiner Magic User's book (rollCharacter, and meetJoiner -> resolveJoiner,
//      which also reads the Joiner's starting scroll into its book)
//   3. level-up picks: a Sorcerer levelled 1 -> 5 through checkLevel, and an
//      Apprentice's level-3 reveal (checkLevel), including the Wizard and the
//      Illusionist outcomes
//   4. engine/encounters.js#findGrimoire (a found grimoire)
//   5. engine/magic.js#readScroll's copy into the book (scribing). A store or
//      loot scroll is a plain scroll item: it holds no spell until it is read,
//      so this is the one path a scroll hands a spell to a book. One-shot
//      scroll READING stays RULES-10 (anyone may try; the scroll pool is every
//      SPELLS row, the new schools included); only the COPY obeys the gates
//   6. the combat spell menu, over a tampered book holding every spell
//
// The sweeps iterate SPELLS and the charts, never a list of spell names, so
// they keep proving the gates as 90-07 to 90-09 append the ten Special and
// Illusion rows. A content guard fails when a spell's school is missing from
// any MU_CHART row, when a chart row lacks a school, or when a
// SPELL_LEVEL_OVERRIDES entry names an unknown sub-class, spell or a school
// that sub-class cannot learn; its own negative cases prove it can fail.
//
// Probe edges covered (fallback probes SPELL-12 / SPELL-10): a Warlock, Court
// Mage or Cleric gets no Special or Illusion spell from any path; an Apprentice
// revealed as a Wizard drops its Illusion spells and as an Illusionist keeps
// them; a Wizard reading an Illusion scroll never copies it.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { rollGrimoire, rollCharacter, checkLevel, grantableAt } from "../../engine/character.js";
import { findGrimoire, meetJoiner, resolveJoiner } from "../../engine/encounters.js";
import { readScroll } from "../../engine/magic.js";
import { newRun } from "../../engine/engine.js";
import { GW, GH } from "../../engine/maze.js";
import { canCast, canLearn, schoolAllowed, schoolGate, spellLevelFor } from "../../engine/derived.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { SPELLS, MU_CHART, CLASSES, THRESHOLDS, SPELL_LEVEL_OVERRIDES, MU_SPELL_EXCEPTIONS } from "../../content/index.js";

const MU_SUBS = Object.keys(MU_CHART);
const SCHOOLS = ["offense", "protection", "healing", "divination", "special", "illusion"];
const byName = (n) => SPELLS.find((sp) => sp.n === n);
// Phase 91.1 plan 03 (V20 B, user 2026-10-01): the NAMED exceptions to a closed school (the Cleric's Strength), content/mu-chart.js
// #MU_SPELL_EXCEPTIONS. The test reads the same data table the engine does, never a sub-class name.
const excepted = (sub, name) => (MU_SPELL_EXCEPTIONS[sub] || []).includes(name);
const learnable = (sub, sp) => schoolAllowed(sub, sp.s) || excepted(sub, sp.n);
const seedRange = (n) => Array.from({ length: n }, (_, i) => i + 1);

/** problem(sub, name, level, how) — why `name` may not sit in `sub`'s book at `level`, or null. */
function bookProblem(sub, name, level) {
  const sp = byName(name);
  if (!sp) return `"${name}" is not a SPELLS row`;
  if (!learnable(sub, sp)) return `${sub} can never learn the ${sp.s} school (${name})`;
  if (schoolGate(sub, sp.s) > level) return `${sub} opens ${sp.s} at level ${schoolGate(sub, sp.s)}, above level ${level} (${name})`;
  return null;
}

function assertLegalBook(sub, book, level, where) {
  assert.ok(Array.isArray(book), `${where}: no book`);
  assert.equal(new Set(book).size, book.length, `${where}: duplicate in ${JSON.stringify(book)}`);
  for (const name of book) {
    const why = bookProblem(sub, name, level);
    assert.equal(why, null, `${where}: ${why} in ${JSON.stringify(book)}`);
  }
}

// ─── 1. chargen rollGrimoire (hero, and the Wizard's day-one pool) ─────────

test("sweep, chargen: every Magic User sub-class x seeds 1-500 x levels 1-5 — rollGrimoire never deals a spell from a school the sub-class cannot learn, or one gated above the level it is dealt at", () => {
  for (const sub of MU_SUBS) {
    for (const seed of seedRange(500)) {
      for (let level = 1; level <= 5; level++) {
        assertLegalBook(sub, rollGrimoire(makeRng(seed), sub, level), level, `${sub} seed ${seed} level ${level}`);
      }
    }
  }
});

test("sweep, chargen via newRun: the hero's own day-one book of every sub-class (seeds 1-120) is legal at level 1, and a Summoner's holds Summon castable at once", () => {
  for (const sub of MU_SUBS) {
    for (const seed of seedRange(120)) {
      const state = newRun(seed, [], { force: { sub } });
      assertLegalBook(sub, state.c.grimoire, 1, `${sub} newRun seed ${seed}`);
      if (sub === "Summoner") assert.ok(canCast(state, byName("Summon")), `seed ${seed}: the Summoner's Summon is castable at level 1`);
    }
  }
});

test("a Warlock, Court Mage or Cleric is dealt no Special or Illusion spell by any rollGrimoire (the chart closes both schools to them)", () => {
  for (const sub of ["Warlock", "Court Mage", "Cleric"]) {
    assert.equal(MU_CHART[sub].special, null, `${sub}: special is closed`);
    assert.equal(MU_CHART[sub].illusion, null, `${sub}: illusion is closed`);
    for (const seed of seedRange(300)) {
      for (const name of rollGrimoire(makeRng(seed), sub, 5)) {
        assert.ok(!["special", "illusion"].includes(byName(name).s), `${sub} seed ${seed}: ${name}`);
      }
    }
  }
});

test("a Wizard is never dealt an Illusion spell (Mirror Self or any later one): the Wizard lost the school (SPELL-12)", () => {
  assert.equal(MU_CHART.Wizard.illusion, null);
  for (const seed of seedRange(500)) {
    for (const name of rollGrimoire(makeRng(seed), "Wizard", 3)) assert.notEqual(byName(name).s, "illusion", `seed ${seed}: ${name}`);
  }
});

// ─── 2. a Joiner Magic User's book ─────────────────────────────────────────

test("sweep, Joiner chargen: a Joiner Magic User of each sub-class (rollCharacter, seeds 1-100) holds only learnable spells", () => {
  for (const sub of MU_SUBS) {
    for (const seed of seedRange(100)) {
      const sheet = rollCharacter(makeRng(seed), [], { cls: "Magic User", sub, race: "Human" });
      assert.equal(sheet.sub, sub);
      assertLegalBook(sub, sheet.grimoire, 1, `Joiner ${sub} seed ${seed}`);
    }
  }
});

test("sweep, Joiner meeting: meetJoiner -> resolveJoiner (which reads the Joiner's starting scroll into its book) never leaves a Magic User Joiner a spell it cannot learn (seeds 1-150)", () => {
  let magicUsers = 0;
  for (const seed of seedRange(150)) {
    const state = newRun(seed);
    meetJoiner(state, makeRng(seed + 9000), []);
    const pending = state.pendingJoiner;
    if (!pending || pending.cls !== "Magic User") continue;
    magicUsers++;
    const level = pending.level ?? pending.lvl ?? 1;
    assertLegalBook(pending.sub, pending.grimoire, 1, `pending Joiner ${pending.sub} seed ${seed}`);
    resolveJoiner(state, true, []);
    const member = state.party.find((m) => m.name === pending.name);
    if (!member) continue;
    for (const name of member.grimoire) {
      assert.ok(learnable(member.sub, byName(name)), `seed ${seed}: Joiner ${member.sub} holds ${name}`);
      assert.ok(schoolGate(member.sub, byName(name).s) <= Math.max(1, level), `seed ${seed}: Joiner ${member.sub} holds ${name} above level ${level}`);
    }
  }
  assert.ok(magicUsers > 5, `only ${magicUsers} Magic User Joiners met in the sweep; widen it`);
});

// ─── 3. level-up picks ─────────────────────────────────────────────────────

/** A minimal Magic User state: checkLevel and findGrimoire read only c. */
function muState(sub, level, grimoire, extra = {}) {
  return { c: { cls: "Magic User", sub, race: "Human", level, sp: 0, maxWP: 55, wp: 55, grimoire: [...grimoire], ...extra } };
}

test("sweep, level-ups: a Sorcerer levelled 1 -> 5 one level at a time through checkLevel (seeds 1-200) holds only learnable spells, each granted at a level that opens its school", () => {
  for (const seed of seedRange(200)) {
    const rng = makeRng(seed);
    const state = muState("Sorcerer", 1, rollGrimoire(makeRng(seed + 31), "Sorcerer", 1));
    for (let target = 2; target <= 5; target++) {
      state.c.sp = THRESHOLDS[target - 1];
      checkLevel(state, rng, []);
      assert.equal(state.c.level, target, `seed ${seed}: expected level ${target}`);
      assertLegalBook("Sorcerer", state.c.grimoire, target, `Sorcerer seed ${seed} level ${target}`);
    }
  }
});

test("sweep, level-ups: an Apprentice levelled to 3 (the reveal, seeds 1-200) ends with a real sub-class and a book that sub-class can hold at level 3", () => {
  const seen = new Set();
  for (const seed of seedRange(200)) {
    const state = muState("Apprentice", 2, rollGrimoire(makeRng(seed + 17), "Apprentice", 1), { sp: THRESHOLDS[2] });
    checkLevel(state, makeRng(seed), []);
    assert.equal(state.c.level, 3);
    assert.notEqual(state.c.sub, "Apprentice", `seed ${seed}: the reveal picks a real sub-class`);
    seen.add(state.c.sub);
    assertLegalBook(state.c.sub, state.c.grimoire, 3, `Apprentice -> ${state.c.sub} seed ${seed}`);
  }
  assert.ok(seen.size >= 5, `the sweep reached only ${[...seen]}`);
});

test("an Apprentice holding EVERY spell, revealed as a Wizard, drops its Illusion spells; revealed as an Illusionist, keeps them; revealed as a Warlock, drops Special and Illusion (the reveal is forced through the rng's d8: 1 Wizard, 6 Illusionist, 2 Warlock)", () => {
  const everything = SPELLS.filter((sp) => canLearn("Apprentice", sp)).map((sp) => sp.n);
  const reveal = (d8) => {
    const state = muState("Apprentice", 2, everything, { sp: THRESHOLDS[2] });
    const rng = { d: (() => { const seq = [5, d8]; let i = 0; return () => seq[i++] ?? 1; })(), pick: (a) => a[0], shuffle: (a) => a };
    checkLevel(state, rng, []);
    return state.c;
  };
  const schoolsOf = (c) => new Set(c.grimoire.map((n) => byName(n).s));

  const wizard = reveal(1);
  assert.equal(wizard.sub, "Wizard");
  assert.ok(!schoolsOf(wizard).has("illusion"), "a Wizard keeps no Illusion spell");
  assert.ok(schoolsOf(wizard).has("special"), "a Wizard still reads Special");

  const illusionist = reveal(6);
  assert.equal(illusionist.sub, "Illusionist");
  assert.ok(schoolsOf(illusionist).has("illusion"), "an Illusionist keeps its Illusion spells");

  const warlock = reveal(2);
  assert.equal(warlock.sub, "Warlock");
  assert.ok(!schoolsOf(warlock).has("special") && !schoolsOf(warlock).has("illusion"), "a Warlock keeps neither Special nor Illusion");
});

// ─── 4. a found grimoire ───────────────────────────────────────────────────

test("sweep, finds: findGrimoire (every sub-class, levels 1-5, seeds 1-100) adds only learnable spells its school gate opens at the hero's level", () => {
  for (const sub of MU_SUBS) {
    for (let level = 1; level <= 5; level++) {
      for (const seed of seedRange(100)) {
        const state = muState(sub, level, []);
        const events = findGrimoire(state, makeRng(seed), []);
        const learned = events.find((e) => e.type === "grimoireLearned");
        assert.ok(learned, `${sub} L${level} seed ${seed}: no grimoireLearned`);
        for (const name of learned.spells) {
          const why = bookProblem(sub, name, level);
          assert.equal(why, null, `${sub} L${level} seed ${seed}: findGrimoire gave ${why}`);
        }
        assertLegalBook(sub, state.c.grimoire, level, `${sub} L${level} seed ${seed} (find)`);
      }
    }
  }
});

// ─── 5. scribing a scroll into the book ────────────────────────────────────

function scrollState(sub, level, depth) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Magic User", sub, race: "Human", level, sp: 0, maxWP: 500, wp: 500, intel: 20,
      skills: {}, vp: 0, weapon: "Club", prof: 0, magicWpn: 0, armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      potions: 2, rations: 4, gold: 50, scrolls: 1, haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
      items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null, regen: false, mirror: 0, foresight: false,
      name: "Scribe", darkFor: 0, temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    },
    floor: { g, px: 1, py: 1, depth },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

test("sweep, scribing: readScroll's copy into the book (every sub-class, levels 1-5, depths 1-5, seeds 1-60) copies only a spell the sub-class can learn AND cast right now", () => {
  let copied = 0;
  for (const sub of MU_SUBS) {
    for (let level = 1; level <= 5; level++) {
      for (let depth = 1; depth <= 5; depth++) {
        for (const seed of seedRange(60)) {
          const state = scrollState(sub, level, depth);
          const events = readScroll(state, makeRng(seed * 131 + depth), []);
          const read = events.find((e) => e.type === "scrollRead");
          assert.ok(read, `${sub} L${level} D${depth} seed ${seed}: the scroll was not read`);
          const copy = events.find((e) => e.type === "scrollCopiedToGrimoire");
          if (copy) {
            copied++;
            const sp = byName(copy.spell);
            assert.ok(canLearn(sub, sp), `${sub} L${level} D${depth} seed ${seed}: copied ${copy.spell} from a closed school`);
            assert.ok(spellLevelFor(sub, sp) <= level && schoolGate(sub, sp.s) <= level, `${sub} L${level} D${depth} seed ${seed}: copied ${copy.spell} it cannot cast yet`);
            assert.deepStrictEqual(state.c.grimoire, [copy.spell]);
          } else {
            assert.deepStrictEqual(state.c.grimoire, [], `${sub} L${level} D${depth} seed ${seed}: the book changed without a copy`);
          }
        }
      }
    }
  }
  assert.ok(copied > 100, `only ${copied} copies in the sweep; it proves nothing if scribing never happens`);
});

test("scroll READING stays RULES-10: every SPELLS row is on the scroll pool (the new schools included) and a scroll of a school the reader cannot learn is read (free-cast once) and never copied", () => {
  // The pool is every row whose level the floor allows: at depth 4+ that is every row.
  const options = SPELLS.filter((sp) => sp.lvl <= Math.min(5, 5 + 1));
  assert.equal(options.length, SPELLS.length, "no row is filtered out of the scroll pool by school");
  for (const sub of MU_SUBS) {
    for (const sp of SPELLS) {
      if (canLearn(sub, sp)) continue;
      const state = scrollState(sub, 5, 5);
      const rng = { d: () => 3, pick: (a) => (a.includes(sp) ? sp : a[0]), shuffle: (a) => a };
      const events = readScroll(state, rng, []);
      assert.ok(events.some((e) => e.type === "scrollRead" && e.spell === sp.n), `${sub}/${sp.n}: the scroll is still read`);
      assert.ok(!events.some((e) => e.type === "scrollCopiedToGrimoire"), `${sub}/${sp.n}: a closed-school scroll was copied`);
      assert.deepStrictEqual(state.c.grimoire, [], `${sub}/${sp.n}: the book gained a closed-school spell`);
    }
  }
});

test("a Wizard reading an Illusion scroll free-casts it once (Mirror Self goes up) and never copies it into the book", () => {
  const mirror = byName("Mirror Self");
  const state = scrollState("Wizard", 5, 5);
  const rng = { d: () => 4, pick: () => mirror, shuffle: (a) => a };
  const events = readScroll(state, rng, []);
  assert.ok(!events.some((e) => e.type === "scrollCopiedToGrimoire"));
  assert.deepStrictEqual(state.c.grimoire, []);
  assert.ok(state.c.mirror > 0, "the one-shot read still casts it");
});

// ─── 6. the combat spell menu ──────────────────────────────────────────────

test("sweep, menu: the combat spell menu over a book holding EVERY spell (every sub-class, levels 1-5) offers only canCast spells, none from a school the sub-class cannot learn", () => {
  const everything = SPELLS.map((sp) => sp.n);
  for (const sub of MU_SUBS) {
    for (let level = 1; level <= 5; level++) {
      const state = scrollState(sub, level, 3);
      state.c.grimoire = [...everything];
      state.c.scrolls = 0;
      state.combat = { foes: [], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false };
      const rows = combatMenuViewModel(state).submenus.spells.rows;
      for (const row of rows) {
        const sp = SPELLS[Number(row.id.replace("spell-", ""))];
        assert.ok(sp, `${sub} L${level}: row ${row.id} names no spell`);
        assert.equal(canCast(state, sp), true, `${sub} L${level}: the menu offers ${sp.n}, which canCast refuses`);
        assert.ok(learnable(sub, sp), `${sub} L${level}: the menu offers ${sp.n} from the closed ${sp.s} school`);
        assert.ok(level >= schoolGate(sub, sp.s), `${sub} L${level}: the menu offers ${sp.n} before its school opens`);
      }
      // ...and every spell canCast allows IS offered (the menu hides nothing castable).
      const offered = new Set(rows.map((r) => Number(r.id.replace("spell-", ""))));
      SPELLS.forEach((sp, i) => {
        if (canCast(state, sp)) assert.ok(offered.has(i), `${sub} L${level}: ${sp.n} is castable but not offered`);
      });
    }
  }
});

// ─── the content guard ─────────────────────────────────────────────────────

/**
 * gateProblems(spells, chart, overrides) — every way the gate data can be wrong.
 * Takes its data as arguments so the negative cases below can hand it a doctored
 * copy and prove it fails.
 */
function gateProblems(spells, chart, overrides) {
  const problems = [];
  const known = new Set(SCHOOLS);
  for (const [sub, row] of Object.entries(chart)) {
    for (const school of SCHOOLS) {
      if (!(school in row)) problems.push(`MU_CHART.${sub} has no ${school} entry (set it to a bonus number or null)`);
    }
  }
  for (const sp of spells) {
    if (!known.has(sp.s)) problems.push(`${sp.n}: school "${sp.s}" is not one of the six schools`);
    for (const [sub, row] of Object.entries(chart)) {
      if (!(sp.s in row)) problems.push(`${sp.n}: its school ${sp.s} is missing from MU_CHART.${sub}`);
    }
    if (!Object.values(chart).some((row) => row[sp.s] !== null && row[sp.s] !== undefined)) {
      problems.push(`${sp.n}: no sub-class can ever learn the ${sp.s} school`);
    }
  }
  for (const [sub, byLevel] of Object.entries(overrides)) {
    if (!(sub in chart)) {
      problems.push(`SPELL_LEVEL_OVERRIDES names the unknown sub-class ${sub}`);
      continue;
    }
    for (const [name, level] of Object.entries(byLevel)) {
      const sp = spells.find((s) => s.n === name);
      if (!sp) {
        problems.push(`SPELL_LEVEL_OVERRIDES.${sub} names the unknown spell ${name}`);
        continue;
      }
      if (chart[sub][sp.s] === null || chart[sub][sp.s] === undefined) problems.push(`SPELL_LEVEL_OVERRIDES.${sub}.${name}: ${sub} can never learn ${sp.s}`);
      if (!Number.isInteger(level) || level < 1 || level > 5) problems.push(`SPELL_LEVEL_OVERRIDES.${sub}.${name}: ${level} is not a level 1-5`);
    }
  }
  return problems;
}

test("guard: the live content has no gate problem (every spell's school is in every MU_CHART row, every row has the six schools, every override names a real, learnable cell)", () => {
  assert.deepStrictEqual(gateProblems(SPELLS, MU_CHART, SPELL_LEVEL_OVERRIDES), []);
  assert.deepStrictEqual(MU_SUBS.sort(), [...CLASSES["Magic User"].subs].sort(), "MU_CHART has exactly the Magic User sub-classes");
});

test("guard: it FAILS on a new spell whose school no chart row carries, a chart row missing a school, and an override naming an unknown sub-class, an unknown spell or a school the sub-class cannot learn", () => {
  // a new Special-style spell added with a typo'd school
  const newSpell = { n: "Doorway", lvl: 2, s: "specail", kind: "summon" };
  assert.ok(gateProblems([...SPELLS, newSpell], MU_CHART, SPELL_LEVEL_OVERRIDES).some((p) => p.startsWith("Doorway")));
  // a chart row that forgot the illusion school
  const noIllusion = { ...MU_CHART, Wizard: { offense: 3, protection: 0, healing: 0, divination: 0, special: 0 } };
  assert.ok(gateProblems(SPELLS, noIllusion, SPELL_LEVEL_OVERRIDES).some((p) => /MU_CHART\.Wizard has no illusion/.test(p)));
  assert.ok(gateProblems(SPELLS, noIllusion, SPELL_LEVEL_OVERRIDES).some((p) => /Mirror Self: its school illusion is missing from MU_CHART\.Wizard/.test(p)));
  // a new school nobody has a row for
  assert.ok(gateProblems([...SPELLS, { n: "Hexling", lvl: 1, s: "hexes", kind: "ward" }], MU_CHART, SPELL_LEVEL_OVERRIDES).some((p) => p.startsWith("Hexling")));
  // overrides
  assert.ok(gateProblems(SPELLS, MU_CHART, { Plumber: { Summon: 1 } }).some((p) => /unknown sub-class Plumber/.test(p)));
  assert.ok(gateProblems(SPELLS, MU_CHART, { Summoner: { "Summon of Doom": 1 } }).some((p) => /unknown spell Summon of Doom/.test(p)));
  assert.ok(gateProblems(SPELLS, MU_CHART, { Warlock: { Summon: 1 } }).some((p) => /Warlock can never learn special/.test(p)));
  assert.ok(gateProblems(SPELLS, MU_CHART, { Wizard: { "Mirror Self": 1 } }).some((p) => /Wizard can never learn illusion/.test(p)));
});

test("guard: grantableAt agrees with the gate data for every sub-class, spell and level (no school a chart closes is ever grantable)", () => {
  for (const sub of MU_SUBS) {
    for (const sp of SPELLS) {
      for (let level = 1; level <= 5; level++) {
        const expected = learnable(sub, sp) && schoolGate(sub, sp.s) <= level;
        assert.equal(grantableAt(sub, sp, level), expected, `${sub}/${sp.n}/L${level}`);
      }
    }
  }
});

test("the Cleric's exception is data, not code (V20): exactly one named spell, Strength, an offense spell whose school the chart closes; every other sub-class has none", () => {
  assert.deepStrictEqual(MU_SPELL_EXCEPTIONS, { Cleric: ["Strength"] });
  for (const [sub, names] of Object.entries(MU_SPELL_EXCEPTIONS)) {
    assert.ok(MU_SUBS.includes(sub), `unknown sub-class ${sub}`);
    for (const n of names) {
      const sp = byName(n);
      assert.ok(sp, `unknown spell ${n}`);
      assert.equal(schoolAllowed(sub, sp.s), false, `${sub} already learns the ${sp.s} school: ${n} needs no exception`);
      assert.equal(canLearn(sub, sp), true);
    }
  }
  for (const sub of MU_SUBS) for (const sp of SPELLS) assert.equal(canLearn(sub, sp), learnable(sub, sp), `${sub}/${sp.n}`);
});

test("the Summoner's exception is data, not code: exactly one named override, read through spellLevelFor, and no other sub-class is touched", () => {
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES, { Summoner: { Summon: 1 } });
  for (const sub of MU_SUBS) {
    for (const sp of SPELLS) {
      const expected = sub === "Summoner" && sp.n === "Summon" ? 1 : sp.lvl;
      assert.equal(spellLevelFor(sub, sp), expected, `${sub}/${sp.n}`);
    }
  }
});
