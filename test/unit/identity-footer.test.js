// test/unit/identity-footer.test.js
//
// VOX-04 (Phase 79, Plan 03): every sub-class and race footer states both
// sides, generated from the rules tables (MU_CHART, SPELL_LEVEL_OVERRIDES,
// RACES) where a table exists and from content/identity.js#IDENTITY_TRAITS
// (each trait tied to the test that proves it) where none does.
//
// The chart assertions re-derive their expectations from MU_CHART at run
// time, so a later chart edit is checked against the chart as it then reads,
// never against a copy of today's numbers.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { IDENTITY_TRAITS, MU_CHART, SPELL_LEVEL_OVERRIDES, RACES, CLASSES, SPELLS, THRESHOLDS, WEAPONS, RACE_NOTE, CLASS_NOTE, SUB_NOTE, STRIKE_DICE, BESTIARY } from "../../content/index.js";
import { facesRangeText } from "../../src/browser/rollRange.js";
import { classNeed, foeToHitVs, weaponDamage, healMulFor } from "../../engine/derived.js";
import { identityFooter, footerLines, RACE_FIELD_LINES, RACE_COSMETIC_FIELDS, unphrasedRaceFields } from "../../src/browser/identityFooter.js";
import { checkLevel } from "../../engine/character.js";
import { newRun } from "../../engine/state.js";
import { openStore } from "../../engine/economy.js";
import { makeRng } from "../../engine/rng.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const ALL_SUBS = [...CLASSES["Magic User"].subs, ...CLASSES.Fighter.subs, ...CLASSES.Thief.subs];
const SCHOOLS = new Set(SPELLS.map((sp) => sp.s));
const THROWN_SCHOOLS = new Set(SPELLS.filter((sp) => sp.kind === "thrown").map((sp) => sp.s));

function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

// ─── the Summoner, the Warlock and the Illusionist ──────────────────────

test("Summoner: Bad names half-strength healing and the summon backfire, and no line claims an offense gate (VOX-04 as amended 2026-09-25)", () => {
  const f = identityFooter("sub", "Summoner");
  assert.ok(f.bad.some((t) => /healing/i.test(t) && /half strength/i.test(t)), `no half-strength healing entry in ${JSON.stringify(f.bad)}`);
  assert.ok(f.bad.some((t) => /one full Summon in eight turns on you/.test(t)), "no summon backfire entry");
  for (const t of [...f.good, ...f.bad]) {
    assert.ok(!(/offense/i.test(t) && /level/i.test(t)), `"${t}" pairs offense with a level`);
  }
});

test("Warlock: Bad names protection until level 4, healing until level 3, and never learning special or illusion", () => {
  const bad = identityFooter("sub", "Warlock").bad;
  assert.ok(bad.includes("no protection spells until level 4"), JSON.stringify(bad));
  assert.ok(bad.includes("no healing spells until level 3"), JSON.stringify(bad));
  assert.ok(bad.some((t) => /never learns/.test(t) && /special/.test(t) && /illusion/.test(t)), JSON.stringify(bad));
});

// Phase 90 plan 06 (SPELL-12): the Summoner's Summon from level 1 is a chart override
// (generated from SPELL_LEVEL_OVERRIDES, so the footer reads the data); Phantom Host and
// its override are gone; the Wizard's closed Illusion school is a generated never-learns line.
test("Summoner: Good names Summon castable from level 1 (generated from the override) and the day-one Summon trait", () => {
  const good = identityFooter("sub", "Summoner").good;
  assert.ok(good.some((t) => t === "Summon castable from level 1 (level 2 for everyone else)"), JSON.stringify(good));
  assert.ok(good.some((t) => /Summon/.test(t) && /day one/.test(t)), JSON.stringify(good));
  assert.ok(![...good, ...identityFooter("sub", "Summoner").bad].some((t) => /Lesser Summon/.test(t)));
});

test("Illusionist: no line names Phantom Host (removed) or a level-1 override; the Wizard's Bad names never learning illusion", () => {
  const f = identityFooter("sub", "Illusionist");
  for (const t of [...f.good, ...f.bad]) assert.ok(!/Phantom Host|castable from level/.test(t), t);
  const wiz = identityFooter("sub", "Wizard");
  assert.ok(wiz.bad.some((t) => t.startsWith("never learns") && t.includes("illusion")), JSON.stringify(wiz.bad));
  assert.ok(!wiz.good.includes("every school of magic from level 1"), "a Wizard no longer reads every school");
});

// ─── chart-generated lines, re-derived from MU_CHART ────────────────────

test("chart: every gate above level 1, every never-learned school, every healMul below 1, every thrown-school bonus and every override is named", () => {
  for (const sub of CLASSES["Magic User"].subs) {
    const row = MU_CHART[sub];
    const f = identityFooter("sub", sub);
    for (const school of Object.keys(row).filter((k) => SCHOOLS.has(k))) {
      const v = row[school];
      if (v === null) {
        assert.ok(f.bad.some((t) => t.startsWith("never learns") && t.includes(school)), `${sub}: never-learned ${school} missing`);
        continue;
      }
      const gate = (row.gate && row.gate[school]) || 1;
      if (gate > 1) assert.ok(f.bad.includes(`no ${school} spells until level ${gate}`), `${sub}: ${school} gate ${gate} missing`);
      if (v > 0 && THROWN_SCHOOLS.has(school)) {
        assert.ok(f.good.some((t) => t.includes(`thrown ${school} spells`)), `${sub}: ${school} bonus missing`);
      }
    }
    if (typeof row.healMul === "number" && row.healMul < 1) {
      assert.ok(f.bad.some((t) => /healing spells you cast heal at/.test(t)), `${sub}: healMul missing`);
    }
    for (const [spell, lvl] of Object.entries(SPELL_LEVEL_OVERRIDES[sub] || {})) {
      assert.ok(f.good.some((t) => t.includes(spell) && t.includes(`level ${lvl}`)), `${sub}: override ${spell} missing`);
    }
  }
});

test("chart: the bonus line reads the schoolBonus face count exactly (offense bonus 3 -> three more faces)", () => {
  assert.ok(identityFooter("sub", "Wizard").good.includes(`your thrown offense spells land on three more faces`));
  assert.ok(identityFooter("sub", "Warlock").good.includes(`your thrown offense spells land on four more faces`));
});

test("chart (deliberate): the engine reads schoolBonus only in the thrown-spell branches, so a bonus on a school with no thrown spell is never stated", () => {
  const engineFiles = fs.readdirSync(path.join(REPO_ROOT, "engine")).filter((f) => f.endsWith(".js"));
  const readers = {};
  for (const f of engineFiles) {
    const src = stripJs(read(`engine/${f}`));
    const n = (src.match(/schoolBonus\(/g) || []).length;
    if (n) readers[f] = n;
  }
  // derived.js defines it (and, since Phase 90 plan 07, reads it twice more in
  // spellEffectSquares / spellEffectRounds: the school bonus stretches the new
  // timed Special spells, Q6 A); magic.js (the hero's thrown branch) and
  // combat.js (a member's thrown cast) are the only other readers. A new
  // reader means the footer's BONUS_SCHOOLS rule has to be revisited (91-02
  // owns whether a footer line states the Special stretch).
  assert.deepEqual(readers, { "combat.js": 1, "derived.js": 3, "magic.js": 1 });
  assert.deepEqual([...THROWN_SCHOOLS], ["offense"]);
  // Summoner divination +4 changes no roll, so it is not claimed.
  assert.ok(!identityFooter("sub", "Summoner").good.some((t) => /divination/.test(t)));
});

// ─── both sides, neutral, empty ─────────────────────────────────────────

test("every sub-class and every non-Human race has at least one Good and one Bad; Human has only the neutral line", () => {
  for (const sub of ALL_SUBS) {
    const f = identityFooter("sub", sub);
    assert.ok(f.good.length >= 1, `${sub}: no Good`);
    assert.ok(f.bad.length >= 1, `${sub}: no Bad`);
    assert.equal(f.neutral, undefined);
  }
  for (const race of Object.keys(RACES)) {
    const f = identityFooter("race", race);
    if (race === "Human") {
      assert.deepEqual(f.good, []);
      assert.deepEqual(f.bad, []);
      assert.match(f.neutral, /No advantages and no disadvantages/);
      assert.deepEqual(footerLines("race", race), [f.neutral]);
    } else {
      assert.ok(f.good.length >= 1, `${race}: no Good`);
      assert.ok(f.bad.length >= 1, `${race}: no Bad`);
      assert.equal(f.neutral, undefined, `${race} is not neutral`);
    }
  }
});

test("empty: an unknown kind or key returns empty lists and never throws", () => {
  assert.deepEqual(identityFooter("sub", "Plumber"), { good: [], bad: [] });
  assert.deepEqual(identityFooter("race", "Gnome"), { good: [], bad: [] });
  assert.deepEqual(identityFooter("class", "Fighter"), { good: [], bad: [] });
  assert.deepEqual(identityFooter("sub", undefined), { good: [], bad: [] });
  assert.deepEqual(identityFooter("race", "toString"), { good: [], bad: [] });
  assert.deepEqual(footerLines("sub", "Plumber"), []);
});

test("encoding: the multi-word keys resolve exactly", () => {
  for (const key of ["Master of Arms", "Court Mage", "Con Artist", "Cat Burglar"]) {
    assert.equal(footerLines("sub", key).length, 2, key);
  }
  assert.deepEqual(identityFooter("sub", "master of arms"), { good: [], bad: [] }, "keys are exact, case included");
});

// ─── adjacency ──────────────────────────────────────────────────────────

test("adjacency: a bonus of 0, a gate of 1 or none, and a race field equal to Human's value produce no line", () => {
  // Wizard: protection/healing/divination/special are all 0 and ungated, so no line names them.
  // (Phase 90 plan 06: illusion is closed to the Wizard, which IS named, as never learned.)
  const wizard = identityFooter("sub", "Wizard");
  for (const school of ["protection", "healing", "divination", "special"]) {
    assert.ok(![...wizard.good, ...wizard.bad].some((t) => t.includes(school)), `Wizard ${school} named`);
  }
  // Apprentice: every bonus 0; only the divination gate is named from the chart.
  const apprentice = identityFooter("sub", "Apprentice");
  assert.ok(!apprentice.good.some((t) => /thrown/.test(t)));
  // Wilmsry and Fridgian share the Human upkeep (4): no upkeep line.
  assert.equal(RACES.Wilmsry.upkeep, RACES.Human.upkeep);
  for (const race of ["Wilmsry", "Fridgian"]) {
    const f = identityFooter("race", race);
    assert.ok(![...f.good, ...f.bad].some((t) => /without rations/.test(t)), `${race} upkeep named`);
    assert.ok(![...f.good, ...f.bad].some((t) => /^being /.test(t)), `${race} (Human size) size named`);
  }
});

// ─── race field coverage ────────────────────────────────────────────────

test("coverage: every non-cosmetic RACES field has a RACE_FIELD_LINES entry (the Phase 75.2 size fields included)", () => {
  assert.deepEqual(unphrasedRaceFields(), []);
  assert.deepEqual([...RACE_COSMETIC_FIELDS], ["note"]);
  for (const field of ["size", "sizeAxes"]) assert.ok(field in RACE_FIELD_LINES, field);
});

test("coverage: a scratch RACES field nobody phrased is reported", () => {
  const scratch = { ...RACES, Gnome: { ...RACES.Elven, zapFactor: 2 } };
  assert.deepEqual(unphrasedRaceFields(scratch), ["zapFactor"]);
});

test("race lines: the size signature reads the engine's net truth (Dwarven +2 kept, one face harder; Elven 2 less damage, no size face line; Troll +11 with 2 of it for being large, one face easier)", () => {
  const dwarven = identityFooter("race", "Dwarven");
  assert.ok(dwarven.good.includes("+2 damage with every weapon"));
  assert.ok(dwarven.good.includes("being small makes you one face harder to hit"));
  assert.ok(!dwarven.bad.some((t) => /damage/.test(t) && /small/.test(t)), "the Dwarven damage axis is masked");
  const elven = identityFooter("race", "Elven");
  assert.ok(elven.bad.includes("being small costs 2 damage"));
  assert.ok(![...elven.good, ...elven.bad].some((t) => /harder to hit/.test(t)), "the Elven face axis is masked");
  assert.ok(elven.bad.includes("foes land on one face more against you"));
  assert.ok(elven.bad.includes("60% of the usual HP, at every level"));
  const troll = identityFooter("race", "Troll");
  assert.ok(troll.good.includes("+11 damage with every weapon (2 of it for being large)"));
  assert.ok(!troll.good.some((t) => t.startsWith("being large adds")), "the size share joins the damage line");
  assert.ok(troll.bad.includes("being large makes you one face easier to hit"));
});

test("race lines: the Fridgian frenzy odds match the engine's own frenzy check (five of the d8's eight faces)", () => {
  const combat = stripJs(read("engine/combat.js"));
  const i = combat.indexOf("if (R.frenzy) {");
  assert.ok(i !== -1);
  assert.match(combat.slice(i, i + 200), /rollCheck\(rng, 8, atLeastFor\(5, 8\)\)/);
  assert.ok(identityFooter("race", "Fridgian").good.some((t) => t.startsWith("five times in eight, a frenzy")));
});

// ─── authored traits and their proofs ───────────────────────────────────

function allTraits() {
  const out = [];
  for (const kind of ["sub", "race"]) {
    for (const [key, row] of Object.entries(IDENTITY_TRAITS[kind])) {
      for (const sideName of ["good", "bad"]) for (const t of row[sideName]) out.push({ kind, key, side: sideName, t });
      if (row.neutral) out.push({ kind, key, side: "neutral", t: row.neutral });
    }
  }
  return out;
}

test("proofs: every IDENTITY_TRAITS entry names a test file that holds its proof string", () => {
  const cache = new Map();
  for (const { kind, key, t } of allTraits()) {
    assert.ok(t.proof && t.proof.file && t.proof.contains, `${kind} ${key} ${t.id}: no proof`);
    if (!cache.has(t.proof.file)) {
      const abs = path.join(REPO_ROOT, t.proof.file);
      cache.set(t.proof.file, fs.existsSync(abs) ? read(t.proof.file) : null);
    }
    const src = cache.get(t.proof.file);
    assert.ok(src !== null, `${kind} ${key} ${t.id}: proof file ${t.proof.file} is missing`);
    assert.ok(src.includes(t.proof.contains), `${kind} ${key} ${t.id}: ${t.proof.file} does not contain "${t.proof.contains}"`);
  }
});

test("proofs: IDENTITY_TRAITS covers exactly the 24 sub-classes and every race, keys exact", () => {
  assert.deepEqual(Object.keys(IDENTITY_TRAITS.sub).sort(), [...ALL_SUBS].sort());
  assert.deepEqual(Object.keys(IDENTITY_TRAITS.race).sort(), Object.keys(RACES).sort());
  const ids = allTraits().map(({ t }) => t.id);
  assert.equal(new Set(ids).size, ids.length, "trait ids are unique");
});

test("proofs: every Fighter and Thief sub-class's traits cover its identity-contract good and bad halves", () => {
  const contract = read("test/unit/identity-contract.test.js");
  for (const sub of [...CLASSES.Fighter.subs, ...CLASSES.Thief.subs]) {
    const at = contract.indexOf(`key: "${sub}",`);
    assert.ok(at !== -1, sub);
    const names = [...contract.slice(at).matchAll(/name: "([^"]+)"/g)].slice(0, 2).map((m) => m[1]);
    const row = IDENTITY_TRAITS.sub[sub];
    for (const [sideName, name] of [["good", names[0]], ["bad", names[1]]]) {
      assert.ok(
        row[sideName].some((t) => t.proof.file === "test/unit/identity-contract.test.js" && name.includes(t.proof.contains)),
        `${sub} ${sideName}: no trait proven by the contract half "${name}"`,
      );
    }
  }
});

test("ordering: authored traits come first, then the chart lines in MU_CHART school order", () => {
  const bad = identityFooter("sub", "Warlock").bad;
  assert.equal(bad[0], IDENTITY_TRAITS.sub.Warlock.bad[0].text);
  assert.ok(bad.indexOf("no protection spells until level 4") < bad.indexOf("no healing spells until level 3"));
  assert.ok(bad.indexOf("no healing spells until level 3") < bad.findIndex((t) => t.startsWith("never learns")));
  const good = identityFooter("race", "Elven").good;
  assert.equal(good[0], IDENTITY_TRAITS.race.Elven.good[0].text);
});

// ─── footerLines shape and hygiene ──────────────────────────────────────

test("footerLines: [\"Good: …\", \"Bad: …\"] in that order, each ending in a full stop", () => {
  const lines = footerLines("sub", "Summoner");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Good: .+\.$/);
  assert.match(lines[1], /^Bad: .+\.$/);
  const f = identityFooter("sub", "Summoner");
  assert.equal(lines[0], `Good: ${f.good.join("; ")}.`);
  assert.equal(lines[1], `Bad: ${f.bad.join("; ")}.`);
});

test("hygiene: no footer line holds a hyphen-minus before a digit, a standalone WP or a roll-under phrase", () => {
  const all = [...ALL_SUBS.map((k) => ["sub", k]), ...Object.keys(RACES).map((k) => ["race", k])];
  for (const [kind, key] of all) {
    for (const line of footerLines(kind, key)) {
      assert.doesNotMatch(line, /-\d/, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\bwp\b/i, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\b(or|and) (under|less|lower|below)\b/i, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\bneeds? (a |an )?\d/i, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\bneeds? \w+ better\b/i, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\ba \d+ to hit\b/i, `${key}: "${line}"`);
      assert.doesNotMatch(line, /\bon a [1-4]\b/i, `${key}: "${line}"`);
    }
  }
});

// ─── identity proofs no other test carried ──────────────────────────────

test("identity-proof: a Sorcerer forgets one spell that isn't Freeze, Fireball or Lightning on a level-up d8 of 1", () => {
  let forgets = 0;
  for (let face = 1; face <= 8; face++) {
    const state = { c: { cls: "Magic User", sub: "Sorcerer", race: "Human", level: 1, sp: THRESHOLDS[1], maxWP: 55, wp: 55, grimoire: ["Freeze", "Fireball", "Lightning", "Doze"] } };
    checkLevel(state, fakeRng([5, face]), []);
    assert.equal(state.c.level, 2);
    for (const kept of ["Freeze", "Fireball", "Lightning"]) assert.ok(state.c.grimoire.includes(kept), `face ${face}: ${kept} forgotten`);
    if (!state.c.grimoire.includes("Doze")) forgets++;
    assert.equal(state.c.grimoire.length, face === 1 ? 5 : 6, `face ${face}: two learned, ${face === 1 ? "one" : "none"} forgotten`);
  }
  assert.equal(forgets, 1, "exactly one face in eight forgets");
});

test("identity-proof: a Troll's store weapon line costs six times the base price", () => {
  let checked = 0;
  for (let seed = 1; seed <= 20 && checked < 3; seed++) {
    const troll = newRun(seed, [], { force: { race: "Troll", sub: "Soldier" } });
    openStore(troll, makeRng(troll.rngState), []);
    for (const line of troll.store.stock.filter((s) => s.effectId === "buyWeapon")) {
      assert.equal(line.cost, Math.max(1, Math.round(WEAPONS[line.n].cost * 6)), `seed ${seed}: ${line.n}`);
      checked++;
    }
  }
  assert.ok(checked > 0, "no Troll store offered a weapon over 20 seeds");
});

// ─── Task 2: the blurbs read roll-high and every number agrees with the engine ─

const FACE_WORD = ["zero", "one", "two", "three", "four", "five", "six"];
const D20 = STRIKE_DICE[0];

function hero(sub, race = "Human") {
  return newRun(1, [], { force: { sub, race } });
}

test("ROLL-04 pin: the Fighter note's face count, level-1 range and miss odds come from CLASSES.Fighter.toHit", () => {
  const n = CLASSES.Fighter.toHit;
  assert.ok(CLASS_NOTE.Fighter.includes(`your top ${FACE_WORD[n]} faces to hit — ${facesRangeText(n, D20)} on the d20 at skill level I`));
  assert.equal((D20 - n) / D20, 3 / 4, "three swings in four miss");
  assert.match(CLASS_NOTE.Fighter, /three swings in four hit nothing/);
});

test("ROLL-04 pin: the Magic User note's face count, level-1 range and miss odds come from CLASSES['Magic User'].toHit", () => {
  const n = CLASSES["Magic User"].toHit;
  assert.ok(CLASS_NOTE["Magic User"].includes(`only your top ${FACE_WORD[n]} faces to hit — ${facesRangeText(n, D20)} on the d20 at skill level I`));
  assert.equal(D20 - n, 17);
  assert.match(CLASS_NOTE["Magic User"], /seventeen swings in twenty are decorative/);
});

test("ROLL-04 pin: the Elven notes' face floor is RACES.Elven.toHit; the Dwarven note's night costs RACES.Dwarven.upkeep", () => {
  const n = RACES.Elven.toHit;
  assert.ok(RACE_NOTE.Elven.includes(`your top ${FACE_WORD[n]} faces land whatever the class`));
  assert.ok(RACES.Elven.note.includes(`lands on its top ${FACE_WORD[n]} faces whatever the class`));
  assert.equal(RACES.Dwarven.upkeep, 1);
  assert.match(RACE_NOTE.Dwarven, /a single Hit Point a night when the rations run out/);
  assert.equal(RACES.Dwarven.dmg, 2);
  assert.match(RACE_NOTE.Dwarven, /^Two extra damage/);
});

test("ROLL-04 pin: the Guard note's damage and face numbers come from weaponDamage and foeToHitVs", () => {
  const armed = (sub, level) => {
    const s = hero(sub);
    Object.assign(s.c, { weapon: "Club", prof: 0, magicWpn: 0, level });
    return s;
  };
  const gap = (level) => weaponDamage(armed("Soldier", level).c, fakeRng([4])) - weaponDamage(armed("Guard", level).c, fakeRng([4]));
  assert.equal(gap(1), 3, "three off at level one");
  assert.equal(gap(2), 2, "one less each level");
  assert.equal(gap(4), 0, "gone at four");
  assert.equal(foeToHitVs(hero("Guard")), foeToHitVs(hero("Soldier")) - 1, "one face fewer");
  assert.match(SUB_NOTE.Guard, /three damage off every blow at level one, one less each level until it is gone at four/);
  assert.match(SUB_NOTE.Guard, /lands on one face fewer against you/);
});

// Quick 260928-nrf (user ruling 2026-09-28): the Acrobat's foe need is four
// faces (was three).
test("ROLL-04 pin: the Acrobat's four faces and the Cleric's four are the engine's own numbers", () => {
  assert.equal(foeToHitVs(hero("Acrobat")), 4);
  assert.match(SUB_NOTE.Acrobat, /except on its top four faces/);
  assert.equal(classNeed({ cls: "Magic User", sub: "Cleric", race: "Human" }), 4);
  assert.equal(classNeed({ cls: "Magic User", sub: "Wizard", race: "Human" }), 3);
  assert.match(SUB_NOTE.Cleric, /Your top four faces hit instead of three/);
});

test("ROLL-04 pin: the Soldier's and Ninja's two crit faces and the Con Artist's two in three are the engine's own checks", () => {
  const combat = stripJs(read("engine/combat.js"));
  assert.match(combat, /atLeastFor\(c\.sub === "Soldier" \? 2 : 1, dieN\)/);
  assert.match(SUB_NOTE.Soldier, /^Foes crit you on their top two faces instead of one/);
  assert.match(combat, /c\.sub === "Ninja" && !opening && roll >= atLeastFor\(2, dieN\)/);
  assert.match(SUB_NOTE.Ninja, /your top two faces open something up/);
  const i = combat.indexOf('c.sub === "Con Artist" && f.lvl <= 1');
  assert.ok(i !== -1);
  assert.match(combat.slice(i, i + 400), /rollCheck\(rng, 6, atLeastFor\(4, 6\)\)/, "four faces of six: two times in three");
  assert.match(SUB_NOTE["Con Artist"], /any level-one foe declines to fight you two times in three/);
});

test("VOX-04 pin: the Summoner prose states the half-strength healing and the one-in-eight backfire the engine applies", () => {
  assert.equal(healMulFor("Summoner"), 0.5);
  assert.match(SUB_NOTE.Summoner, /heal at half strength/);
  const magic = stripJs(read("engine/magic.js"));
  assert.match(magic, /const doubledBackfireRoll = doubled \? rng\.d\(8\) : null;/);
  assert.match(magic, /if \(doubledBackfireRoll === 1\)/);
  assert.match(SUB_NOTE.Summoner, /one time in eight it arrives on the wrong side/);
  assert.doesNotMatch(SUB_NOTE.Summoner, /offense/i, "the removed offense gate is never claimed");
});

test("accuracy pin: the Sorcerer, Master of Arms and Pilfer notes match the engine", () => {
  const character = stripJs(read("engine/character.js"));
  assert.match(character, /if \(sub === "Sorcerer"\) for \(const n2 of \["Freeze", "Fireball"\]\)/);
  assert.match(character, /!\["Fireball", "Freeze", "Lightning"\]\.includes\(n2\)/);
  assert.match(SUB_NOTE.Sorcerer, /^Freeze and Fireball in the book from day one and two more spells each level, with a one-in-eight chance per level of simply forgetting one that isn't fire, frost or lightning/);
  const movement = stripJs(read("engine/movement.js"));
  assert.match(movement, /events\.push\(\{ type: "armorPatched", amount: amt, by: "Master of Arms" \}\)/);
  assert.match(SUB_NOTE["Master of Arms"], /every night in camp you hammer the dents out of your own armour/);
  assert.doesNotMatch(SUB_NOTE["Master of Arms"], /plus three/i, "no unenforced +3 rule");
  const items = stripJs(read("engine/items.js"));
  assert.match(items, /rollCheck\(fumbleRng, 20, atLeastFor\(19, 20\)\)/, "the Pilfer fumbles on one face of twenty");
  assert.match(SUB_NOTE.Pilfer, /about one time in twenty/);
  assert.match(SUB_NOTE.Pilfer, /a d10 of your own hp/);
});

// VOX-05 rubric 4 (plan 79-12, the lore claims 79-03 handed on): the Thief,
// Woodsman, Bard and Pilfer prose now states what the engine does.
test("accuracy pin (79-12): the Thief's armour, the Woodsman's beasts, the Bard's Humans and the Pilfer's staves match the engine", () => {
  const items = stripJs(read("engine/items.js"));
  // Thief: Studded is class-legal (cls "FT"), Mail only through Heft (AR 12 or less).
  const ARMORS_SRC = read("content/armors.js");
  assert.match(ARMORS_SRC, /name: "Studded", cost: 750, wp: 18, ar: 10, cls: "FT"/);
  assert.match(ARMORS_SRC, /name: "Mail", cost: 1000, wp: 30, ar: 12, cls: "F"/);
  assert.match(items, /c\.cls === "Thief" && skill\(c, "Heft"\) && it\.ar <= 12/);
  assert.match(CLASS_NOTE.Thief, /^Forty Hit Points, studded leather at the very best \(mail, if you learn Heft\)/);
  // Woodsman: parleys Beasts and Lair Beasts, and the Drake is a Beast.
  const combat = stripJs(read("engine/combat.js"));
  assert.match(combat, /c\.sub === "Woodsman" && \(t === "Beasts" \|\| t === "Lair Beasts"\)\) return true/);
  assert.ok(BESTIARY.Beasts.flat().some((f) => f.n === "Drake"), "the Drake is in the Beasts table");
  assert.match(SUB_NOTE.Woodsman, /You speak to every beast in here, the Drake included/);
  assert.doesNotMatch(SUB_NOTE.Woodsman, /dragon/i, "no dragon exception the engine does not make");
  // Bard: parleys Humans; nothing in the engine gives a Bard gifts from dragons.
  assert.match(combat, /c\.sub === "Bard" && t === "Humans"\) return true/);
  assert.match(SUB_NOTE.Bard, /every Human in here will at least hear you out/);
  assert.doesNotMatch(SUB_NOTE.Bard, /dragon/i);
  // Pilfer: jewelry, cloaks AND staves fumble.
  assert.match(items, /PILFER_FUMBLE_KINDS = Object\.freeze\(\["jewel", "cloak", "staff"\]\)/);
  assert.match(SUB_NOTE.Pilfer, /a magic ring, amulet, cloak or staff/);
});

test("ROLL-04: no class, sub-class or race blurb and no RACES note keeps a roll-under phrase", () => {
  const texts = [
    ...Object.entries(RACE_NOTE).map(([k, v]) => [`RACE_NOTE.${k}`, v]),
    ...Object.entries(CLASS_NOTE).map(([k, v]) => [`CLASS_NOTE.${k}`, v]),
    ...Object.entries(SUB_NOTE).map(([k, v]) => [`SUB_NOTE.${k}`, v]),
    ...Object.entries(RACES).map(([k, v]) => [`RACES.${k}.note`, v.note]),
  ];
  const n = "(\\d+|one|two|three|four|five|six)";
  const patterns = [
    new RegExp(`\\bneeds? (a |an )?${n}\\b`, "i"),
    /\bnatural (1|one)\b/i,
    new RegExp(`\\b${n} or (under|less|lower|below)\\b`, "i"),
    new RegExp(`\\ba ${n} to hit\\b`, "i"),
    new RegExp(`\\bon an? ${n}\\b`, "i"),
    /\bneeds? (\w+ )?better\b/i,
    /[−-]\d+ on to-hit/i,
    /\b1[–—-]\d+\b/,
  ];
  for (const [key, text] of texts) {
    for (const p of patterns) assert.doesNotMatch(text, p, `${key}: "${text}"`);
  }
});

test("VOX-05: the 79-03 why-ledger parses, every row carries reasons and a why, and every row's `after` is the current text", () => {
  const ledger = JSON.parse(read("docs/narrative-pass/why/79-03.json"));
  assert.ok(Array.isArray(ledger) && ledger.length > 0);
  const REASONS = new Set(["fact", "natural", "joke", "accurate", "roll-under", "number", "identity", "naming", "hygiene"]);
  const current = (key) => {
    let m = /^bank:(RACE_NOTE|CLASS_NOTE|SUB_NOTE)\.(.+)$/.exec(key);
    if (m) return { RACE_NOTE, CLASS_NOTE, SUB_NOTE }[m[1]][m[2]];
    m = /^content:RACES\.(.+)\.note$/.exec(key);
    if (m) return RACES[m[1]].note;
    m = /^bank:IDENTITY_FOOTER\.(sub|race)\.(.+)$/.exec(key);
    if (m) return footerLines(m[1], m[2]).join(" ");
    // 79-13: the authored trait lines the footers read (a name may hold a space).
    m = /^bank:IDENTITY_TRAITS\.(sub|race)\.(.+)\.(good|bad)\.(\d+)\.text$/.exec(key);
    if (m) return IDENTITY_TRAITS[m[1]][m[2]][m[3]][Number(m[4])].text;
    m = /^bank:IDENTITY_TRAITS\.(sub|race)\.(.+)\.neutral\.text$/.exec(key);
    if (m) return IDENTITY_TRAITS[m[1]][m[2]].neutral.text;
    return undefined;
  };
  // 79-13: a raw generator fragment (src/browser/identityFooter.js) records
  // one representative literal with its interpolations as "…"; it has no
  // single current string here, so tools/voice-inventory.mjs --check-ledgers
  // --after and test/unit/narrative-review.test.js prove it against the corpus.
  const isFragment = (key) => key.startsWith("raw:src/browser/identityFooter.js#");
  // 79-12: a key a LATER plan's ledger also touches carries that plan's
  // after (tools/lib/voice-checks.mjs#validateLedgers checks only the last
  // plan to touch a key), so 79-03's own after is history for it.
  const whyDir = path.join(REPO_ROOT, "docs", "narrative-pass", "why");
  const laterKeys = new Set(
    fs.readdirSync(whyDir)
      .filter((f) => f.endsWith(".json") && f.replace(/\.json$/, "") > "79-03")
      .flatMap((f) => JSON.parse(read(`docs/narrative-pass/why/${f}`).replace(/^﻿/, "")).map((r) => r.key)),
  );
  for (const row of ledger) {
    for (const f of ["key", "surface", "trigger", "before", "after", "reasons", "why"]) assert.ok(f in row, `${row.key}: missing ${f}`);
    assert.ok(row.reasons.length > 0 && row.reasons.every((r) => REASONS.has(r)), `${row.key}: bad reasons`);
    assert.ok(row.why.trim().length > 0, `${row.key}: empty why`);
    if (laterKeys.has(row.key) || isFragment(row.key)) continue;
    assert.equal(row.after, current(row.key), `${row.key}: ledger after is stale`);
  }
  const footers = ledger.filter((r) => r.key.startsWith("bank:IDENTITY_FOOTER.")).map((r) => r.key);
  assert.equal(footers.length, ALL_SUBS.length + Object.keys(RACES).length, "one ledger row per footer");
});
