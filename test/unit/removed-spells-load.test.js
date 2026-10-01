// test/unit/removed-spells-load.test.js
//
// Phase 90 plan 06 (SPELL-12, user 2026-09-30): Lesser Summon and Phantom
// Host are removed; the Summoner casts the level-2 Summon from level 1 through
// the named exception in content/spell-level-overrides.js; Wizards lose the
// Illusion school (content/mu-chart.js). An OLD SAVE must never fail to load
// or show a removed spell as castable ("old saves tolerant-load only"):
//
//   - Lesser Summon becomes Summon (one copy, at the first one's position)
//   - Phantom Host, and any name no SPELLS row carries, is dropped
//   - a spell whose school the sheet's sub-class can never learn is dropped
//     (a Wizard's Mirror Self)
//   - the rest keep their saved order; a save with none of these is untouched
//   - the hero AND every Joiner sheet get the same treatment, through both
//     load chains (validateSave and rehydrate)
//
// Probe edges (fallback probes SPELL-12): adjacency (both Lesser Summon and
// Summon), empty (only Phantom Host), boundary (Summon at level 1), ordering
// (the SPELLS rows after the removed Phantom Host keep their relative order).

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { canCast, spellLevelFor } from "../../engine/derived.js";
import { castSpell } from "../../engine/magic.js";
import { makeRng } from "../../engine/rng.js";
import { SPELLS, MU_CHART, SPELL_LEVEL_OVERRIDES } from "../../content/index.js";
import { grimoireViewModel } from "../../src/browser/heroTab.js";

const byName = (n) => SPELLS.find((sp) => sp.n === n);
const FLOOR = { g: [[{ wall: false }]], px: 0, py: 0, depth: 1 };

/** A minimal Magic User sheet of the given sub-class holding `grimoire`. */
const sheet = (sub, grimoire, extra = {}) => ({
  wp: 10, maxWP: 10, level: 1, skills: {}, cls: "Magic User", sub, grimoire: [...grimoire], ...extra,
});

/** Load through validateSave, and again through rehydrate; return both books. */
function loadHero(sub, grimoire) {
  const check = validateSave(JSON.stringify({ c: sheet(sub, grimoire), floor: FLOOR }));
  assert.equal(check.ok, true);
  const re = rehydrate({ c: sheet(sub, grimoire), floor: FLOOR, seed: 1, rngState: 1 });
  assert.deepStrictEqual(re.c.grimoire, check.value.c.grimoire, "rehydrate mirrors validateSave");
  return check.value.c.grimoire;
}

test("an old hero book [Freeze, Lesser Summon, Summon, Phantom Host] loads as [Freeze, Summon] (adjacency: one Summon, the first one's position)", () => {
  assert.deepStrictEqual(loadHero("Summoner", ["Freeze", "Lesser Summon", "Summon", "Phantom Host"]), ["Freeze", "Summon"]);
});

test("a Lesser Summon that comes AFTER Summon is dropped as the duplicate; one that comes BEFORE becomes the Summon", () => {
  assert.deepStrictEqual(loadHero("Summoner", ["Summon", "Heal", "Lesser Summon"]), ["Summon", "Heal"]);
  assert.deepStrictEqual(loadHero("Summoner", ["Lesser Summon", "Heal", "Summon"]), ["Summon", "Heal"]);
});

test("a Lesser Summon alone becomes Summon", () => {
  assert.deepStrictEqual(loadHero("Summoner", ["Heal", "Lesser Summon"]), ["Heal", "Summon"]);
});

test("empty edge: a book of only Phantom Host loads empty, and the Grimoire shows its no-spells row", () => {
  const book = loadHero("Illusionist", ["Phantom Host"]);
  assert.deepStrictEqual(book, []);
  const state = newRun(1, [], { force: { sub: "Illusionist" } });
  state.c.grimoire = book;
  const vm = grimoireViewModel(state);
  assert.equal(vm.rows.length, 0, "no spell row to show");
});

test("a name no SPELLS row carries is dropped; the surviving names keep their saved order (ordering edge)", () => {
  assert.deepStrictEqual(loadHero("Sorcerer", ["Fireball", "Nonsense Bolt", "Freeze", "Phantom Host", "Heal"]), ["Fireball", "Freeze", "Heal"]);
});

test("a Wizard's old book drops Mirror Self (the Wizard lost Illusion): [Mirror Self, Freeze] loads as [Freeze]", () => {
  assert.deepStrictEqual(loadHero("Wizard", ["Mirror Self", "Freeze"]), ["Freeze"]);
});

test("an Illusionist keeps Mirror Self; an Apprentice keeps it too (they still learn Illusion)", () => {
  assert.deepStrictEqual(loadHero("Illusionist", ["Mirror Self", "Freeze"]), ["Mirror Self", "Freeze"]);
  assert.deepStrictEqual(loadHero("Apprentice", ["Mirror Self", "Heal"]), ["Mirror Self", "Heal"]);
});

test("a spell of a school the sub-class can never learn is dropped (a Warlock holding Summon); an old Cleric's offense spells go too (IDENT-15, Phase 91 plan 02), the rest of its book stays", () => {
  assert.deepStrictEqual(loadHero("Warlock", ["Freeze", "Summon"]), ["Freeze"]);
  // Phase 91 plan 02 (IDENT-15): the Cleric's offense school is closed (chart value null), so an
  // old save's Fireball and Strength load out of the book; Heal and Major Heal stay, in saved order.
  // Phase 91.1 plan 03 (V20 B, 2026-10-01): Strength is the Cleric's one named exception, so it now stays.
  assert.deepStrictEqual(loadHero("Cleric", ["Heal", "Fireball", "Strength", "Major Heal"]), ["Heal", "Strength", "Major Heal"], "Cleric never learns offense (but Strength): the rest is dropped on load");
});

test("a save with none of these is byte-identical after load (a genuine no-op)", () => {
  const book = ["Heal", "Freeze", "Summon", "Map the Floor"];
  const check = validateSave(JSON.stringify({ c: sheet("Summoner", book), floor: FLOOR }));
  assert.deepStrictEqual(check.value.c.grimoire, book);
  const original = newRun(2026);
  const json = JSON.stringify(serializeRun(original));
  const reloaded = validateSave(json);
  assert.equal(reloaded.ok, true);
  assert.deepStrictEqual(reloaded.value.c.grimoire, original.c.grimoire);
});

test("a character with no sub-class chart row keeps every real spell (only unknown names go)", () => {
  const check = validateSave(JSON.stringify({ c: { wp: 10, maxWP: 10, level: 1, skills: {}, grimoire: ["Heal", "Shield", "Phantom Host"] }, floor: FLOOR }));
  assert.deepStrictEqual(check.value.c.grimoire, ["Heal", "Shield"]);
});

test("every Joiner sheet is fixed the same way, through both load chains", () => {
  const joiner = (sub, book) => sheet(sub, book, { name: `Joiner ${sub}`, abilities: [] });
  const raw = {
    c: sheet("Summoner", ["Freeze", "Summon"]),
    floor: FLOOR,
    party: [joiner("Wizard", ["Mirror Self", "Freeze"]), joiner("Summoner", ["Lesser Summon", "Phantom Host"]), joiner("Sorcerer", ["Fireball"])],
  };
  const check = validateSave(JSON.stringify(raw));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.party.map((m) => m.grimoire), [["Freeze"], ["Summon"], ["Fireball"]]);
  const re = rehydrate({ ...JSON.parse(JSON.stringify(raw)), seed: 1, rngState: 1 });
  assert.deepStrictEqual(re.party.map((m) => m.grimoire), [["Freeze"], ["Summon"], ["Fireball"]]);
});

test("the load is silent and never throws on a tampered book (non-string entries, no grimoire)", () => {
  const check = validateSave(JSON.stringify({ c: sheet("Wizard", ["Freeze", null, 7, { n: "Heal" }, "Heal"]), floor: FLOOR }));
  assert.equal(check.ok, true);
  assert.deepStrictEqual(check.value.c.grimoire, ["Freeze", "Heal"]);
  const noBook = validateSave(JSON.stringify({ c: { wp: 10, maxWP: 10, level: 1, skills: {}, sub: "Wizard" }, floor: FLOOR }));
  assert.equal("grimoire" in noBook.value.c, false);
});

// --- the content the load leans on -----------------------------------------

// Phase 90 plan 07 (SPELL-10) appended the four Special spells: 35 rows; plan 08 the three control spells: 38 rows; plan 09 the last three Illusion spells: 41 rows.
test("content: 41 rows, no Lesser Summon, no Phantom Host, the Summoner's one named exception, Wizard.illusion null", () => {
  assert.equal(SPELLS.length, 41);
  assert.equal(byName("Lesser Summon"), undefined);
  assert.equal(byName("Phantom Host"), undefined);
  assert.deepStrictEqual(SPELL_LEVEL_OVERRIDES, { Summoner: { Summon: 1 } });
  assert.equal(MU_CHART.Wizard.illusion, null);
  assert.notEqual(MU_CHART.Illusionist.illusion, null);
  assert.notEqual(MU_CHART.Apprentice.illusion, null);
});

test("ordering edge: the rows after the removed Phantom Host keep their relative order", () => {
  const names = SPELLS.map((sp) => sp.n);
  const i = (n) => names.indexOf(n);
  assert.ok(i("Sense Presence") < i("Lightning") && i("Lightning") < i("Regeneration") && i("Regeneration") < i("Mangle") && i("Mangle") < i("Death"));
  assert.equal(i("Lightning"), 27, "Lightning moved down one, into Phantom Host's old place");
  assert.equal(i("Death"), 30);
});

// --- the Summoner's exception (boundary edge) -------------------------------

test("boundary: a level-1 Summoner's Summon passes canCast; any other sub-class's Summon needs level 2; at level 2 both pass", () => {
  const summon = byName("Summon");
  assert.equal(spellLevelFor("Summoner", summon), 1);
  for (const sub of ["Wizard", "Sorcerer", "Illusionist", "Apprentice"]) assert.equal(spellLevelFor(sub, summon), 2, `${sub} needs level 2`);

  const summoner = newRun(1, [], { force: { sub: "Summoner" } });
  summoner.c.grimoire = ["Summon"];
  assert.equal(summoner.c.level, 1);
  assert.equal(canCast(summoner, summon), true);

  const wizard = newRun(1, [], { force: { sub: "Wizard" } });
  wizard.c.grimoire = ["Summon"];
  assert.equal(canCast(wizard, summon), false);
  const events = castSpell(wizard, SPELLS.indexOf(summon), makeRng(5));
  const refusal = events.find((e) => e.type === "spellAboveLevel");
  assert.ok(refusal, "the refusal is spellAboveLevel");
  assert.equal(refusal.need, 2);
  assert.equal(wizard.c.spellsUsed, 0, "a refused cast spends no charge");
  wizard.c.level = 2;
  assert.equal(canCast(wizard, summon), true);
});

test("a level-1 Summoner casts Summon: a doubled ally (level 2) is pending, or the one-in-eight backfire answers instead", () => {
  const summon = byName("Summon");
  let allies = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = newRun(seed, [], { force: { sub: "Summoner" } });
    s.c.grimoire = ["Summon"];
    s.c.wp = s.c.maxWP;
    const events = castSpell(s, SPELLS.indexOf(summon), makeRng(seed));
    assert.equal(s.c.spellsUsed, 1, "the cast spends one charge");
    if (events.some((e) => e.type === "allyPending")) {
      allies++;
      assert.equal(s.c.pendingAlly.lvl, 2, "a Summoner's full Summon is doubled: level 1 + 1");
    } else assert.ok(events.some((e) => e.type === "summonBackfired" || e.type === "death" || e.type === "died" || s.dead), "otherwise it backfired");
  }
  assert.ok(allies > 0, "most casts summon an ally");
});

// --- canCast re-checks the school (a tampered or old book never casts) -------

test("canCast refuses a spell whose school the sub-class can never learn, even in its book (a Warlock holding Summon at level 5)", () => {
  const warlock = newRun(1, [], { force: { sub: "Warlock" } });
  warlock.c.level = 5;
  warlock.c.grimoire = ["Summon", "Mirror Self"];
  assert.equal(canCast(warlock, byName("Summon")), false);
  assert.equal(canCast(warlock, byName("Mirror Self")), false);
  const events = castSpell(warlock, SPELLS.indexOf(byName("Summon")), makeRng(3));
  const refusal = events.find((e) => e.type === "spellSchoolLocked");
  assert.ok(refusal, "the refusal is spellSchoolLocked");
  assert.equal(refusal.forbidden, true);
  assert.equal(warlock.c.spellsUsed, 0, "nothing is spent");
});
