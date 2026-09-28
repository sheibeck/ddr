// test/unit/spell-damage-level-sq.test.js
//
// Quick 260928-sq2 (user ruling 2026-09-28): "What if we square spell damage
// just like we do with weapons damage." An offensive spell's damage is its
// dice (plus any flat bonus in `dmg`) + the CASTER's level squared, replacing
// the p.26 max(1, caster level − spell level) multiplier FOR DAMAGE. An area
// spell adds level² to EACH foe it damages ("each foe gets it"): once per
// foe per cast (Lightning's own throw at each foe, Earthquake's one roll on
// every foe, the first Fireballs bolt to strike each foe), and a damage-
// over-time spell (Acid, Ice) adds it to its first tick. The p.26 multiplier
// stays for what is not damage (Stun's reach). Heals, the Earthquake
// backlash and an Apprentice's backfire never add it. No new rng draw.
//
// Every case walks the dice's lowest and highest faces at caster levels 1,
// 3 and 5. A level below the spell's own is a scroll's free cast
// (c.scrollCast skips the level gate, exactly as readScroll's free cast).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { alliesTurn, foeTurn } from "../../engine/combat.js";
import { spellLevelSq } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { actsWhere } from "./harness/spellResistActs.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

const LEVELS = [1, 3, 5];
const idx = (n) => SPELLS.findIndex((s) => s.n === n);
const row = (n) => SPELLS[idx(n)];
const lo = ({ n, bonus }) => n + (bonus || 0);
const hi = ({ n, sides, bonus }) => n * sides + (bonus || 0);

/**
 * rngBy(fn) — a fake rng whose `.d(sides)` answers `fn(sides)`, so a to-hit
 * die and a damage die of different sizes can be steered apart. The cursor
 * is a fixed 0 (the derived resist streams read the same key every time).
 */
function rngBy(fn) {
  let count = 0;
  return {
    d(sides) {
      count++;
      return fn(sides);
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    count: () => count,
  };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Illusionist", race: "Human", level: 1, sp: 0,
    maxWP: 999, wp: 999, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster", timers: {},
    ...overrides,
  };
}

function floor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function foe(name, overrides = {}) {
  // asleep 99: the foes never swing back, so the cast's own dispatch draws
  // nothing but the spell's (and the foe turn's ticks).
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 99, sp: {}, lives: 1, ...overrides };
}

function fight(cOverrides, foes, acts = 0, extra = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(cOverrides),
    floor: floor(),
    day: 1, steps: 0, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false },
    ...extra,
  };
}

/** A caster of level `level` who knows `n`; below the spell's level, a scroll's free cast. */
const caster = (n, level) => ({ level, grimoire: [n], scrollCast: level < row(n).lvl });
const noResist = (n, count = 1) => actsWhere(n, Array.from({ length: count }, (_, i) => [i, false]));

test("spellLevelSq is the caster's level squared (the weapon's levelSq term)", () => {
  for (const level of [1, 2, 3, 4, 5, 6]) assert.equal(spellLevelSq({ level }), level * level);
});

// --- thrown: Freeze, Fireball, Mangle (one foe) -------------------------------

for (const n of ["Freeze", "Fireball", "Mangle"]) {
  test(`${n}: a hit deals its dice + the caster's level² at levels 1, 3, 5 (lowest and highest faces)`, () => {
    const sp = row(n);
    const toHitDie = sp.onHit === "freeze" ? 10 : 8;
    for (const level of LEVELS) {
      for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
        const s = fight(caster(n, level), [foe("F1")], noResist(n));
        // to-hit raw 1 mirrors to the die's top face (a hit); the damage dice
        // show `face`; a Freeze's d4 hold shows 1.
        const events = castSpell(s, idx(n), rngBy((sides) => (sides === toHitDie ? 1 : sides === sp.dmg.sides ? face : 1)), []);
        const hit = events.find((e) => e.type === "spellHit");
        assert.ok(hit, `${n} L${level}: a hit, got ${events.map((e) => e.type)}`);
        assert.equal(hit.dmg, want + level * level, `${n} L${level} face ${face}`);
        assert.equal(hit.levelSq, level * level, `${n} L${level}: the event names the level² it added`);
        assert.equal("mult" in hit, false, `${n} L${level}: no level multiplier on damage any more`);
        assert.equal(s.combat.foes[0].wp, 999 - want - level * level);
      }
    }
  });
}

// --- Lightning: every foe, each its own throw and its own level² ---------------

test("Lightning: each foe hit takes its own dice + level² at levels 1, 3, 5 (lowest and highest faces)", () => {
  const sp = row("Lightning");
  for (const level of LEVELS) {
    for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
      const s = fight(caster("Lightning", level), [foe("F1"), foe("F2")], noResist("Lightning", 2));
      const events = castSpell(s, idx("Lightning"), rngBy((sides) => (sides === 8 ? 1 : sides === sp.dmg.sides ? face : 1)), []);
      const hits = events.filter((e) => e.type === "spellHit");
      assert.equal(hits.length, 2, `L${level}`);
      for (const h of hits) assert.equal(h.dmg, want + level * level, `L${level} face ${face} ${h.target}`);
      assert.deepEqual(s.combat.foes.map((f) => f.wp), [999 - want - level * level, 999 - want - level * level]);
    }
  }
});

// --- Earthquake: one roll, every foe gets level², the backlash does not -------

test("Earthquake: every foe takes the one roll + level²; the caster's half is the roll's alone (levels 1, 3, 5)", () => {
  const sp = row("Earthquake");
  for (const level of LEVELS) {
    for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
      const s = fight(caster("Earthquake", level), [foe("F1"), foe("F2")], noResist("Earthquake", 2));
      const events = castSpell(s, idx("Earthquake"), rngBy((sides) => (sides === sp.dmg.sides ? face : 1)), []);
      const quake = events.find((e) => e.type === "earthquake");
      assert.equal(quake.amount, want + level * level, `L${level} face ${face}`);
      assert.deepEqual(s.combat.foes.map((f) => f.wp), [999 - want - level * level, 999 - want - level * level]);
      const self = events.find((e) => e.type === "earthquakeSelfDamage");
      assert.equal(self.amount, Math.ceil(want / 2), `L${level} face ${face}: the backlash never adds level²`);
      assert.equal(s.c.wp, 999 - Math.ceil(want / 2));
    }
  }
});

// --- Fireballs: level² once to each foe a bolt strikes -------------------------

test("Fireballs: each bolt deals its dice, and each foe struck takes level² once (levels 1, 3, 5)", () => {
  const sp = row("Fireballs");
  for (const level of LEVELS) {
    for (const [face, per] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
      // d8 = 3 bolts over two foes: F1, F2, F1.
      const s = fight(caster("Fireballs", level), [foe("F1"), foe("F2")], noResist("Fireballs", 2));
      const events = castSpell(s, idx("Fireballs"), rngBy((sides) => (sides === 8 ? 3 : sides === sp.dmg.sides ? face : 1)), []);
      const L2 = level * level;
      assert.deepEqual(s.combat.foes.map((f) => f.wp), [999 - 2 * per - L2, 999 - per - L2], `L${level} face ${face}`);
      const volley = events.find((e) => e.type === "volley");
      assert.equal(volley.totalDamage, 3 * per + 2 * L2);
      assert.equal(volley.rolls, 3);
    }
  }
});

// --- damage over time: level² on the first tick only ---------------------------

for (const [n, tickType, rec] of [["Acid", "acidTick", "acid"], ["Ice", "dotTick", "dot"]]) {
  test(`${n}: the first tick deals its dice + level², the later ticks their dice alone (levels 1, 3, 5)`, () => {
    const sp = row(n);
    for (const level of LEVELS) {
      for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
        const s = fight(caster(n, level), [foe("F1")], noResist(n));
        // The cast's first draw (Acid's rounds d6, Ice's d4+1) reads 4: long
        // enough for two ticks; every later damage die shows `face`.
        let drawn = 0;
        const rng = rngBy((sides) => (drawn++ === 0 ? 4 : sides === sp.dmg.sides ? face : 4));
        const events = castSpell(s, idx(n), rng, []);
        const first = events.filter((e) => e.type === tickType);
        assert.equal(first.length, 1, `${n} L${level}: the cast's own foe turn ticks once`);
        assert.equal(first[0].dmg, want + level * level, `${n} L${level} face ${face}: the first tick`);
        assert.equal("levelSq" in s.combat.foes[0][rec], false, `${n} L${level}: spent on the first tick`);
        const next = foeTurn(s, rng, []).filter((e) => e.type === tickType);
        assert.equal(next.length, 1);
        assert.equal(next[0].dmg, want, `${n} L${level} face ${face}: a later tick is the dice alone`);
      }
    }
  });
}

// --- a Joiner's cast: the Joiner's own level ------------------------------------

function joinerFight(level, grimoire, acts) {
  const sheet = {
    name: "Ada", level, sub: "Illusionist", cls: "Magic User", race: "Human", wp: 99, maxWP: 99, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Cloth", grimoire, spellsUsed: 0,
  };
  const s = fight({ level: 1 }, [foe("F1", { asleep: 0 })], acts, { party: [sheet] });
  s.combat.allies = [{ partyIdx: 0, name: "Ada", lvl: level, sub: "Illusionist", wp: 99, maxWP: 99 }];
  return s;
}

for (const [n, levels] of [["Freeze", LEVELS], ["Fireball", [3, 5]], ["Mangle", [5]]]) {
  test(`a Joiner's ${n} deals its dice + the JOINER's level² (levels ${levels.join(", ")})`, () => {
    const sp = row(n);
    const toHitDie = sp.onHit === "freeze" ? 10 : 8;
    for (const level of levels) {
      for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
        const s = joinerFight(level, [n], actsWhere(n, [[0, false]], { caster: "Ada" }));
        const events = alliesTurn(s, rngBy((sides) => (sides === toHitDie ? 1 : sides === sp.dmg.sides ? face : 1)), []);
        const hit = events.find((e) => e.type === "allySpellHit");
        assert.ok(hit, `${n} L${level}: a hit, got ${events.map((e) => e.type)}`);
        assert.equal(hit.dmg, want + level * level, `${n} L${level} face ${face}`);
      }
    }
  });
}

// --- what the ruling leaves alone ----------------------------------------------

test("Stun: the p.26 multiplier still sets its reach: d6 × max(1, level − 1) foes (levels 1, 3, 5)", () => {
  for (const [level, want] of [[1, 1], [3, 2], [5, 4]]) {
    const foes = [1, 2, 3, 4, 5, 6].map((i) => foe(`F${i}`, { asleep: 0 }));
    const s = fight(caster("Stun", level), foes, noResist("Stun", 6));
    const events = castSpell(s, idx("Stun"), rngBy((sides) => (sides === 6 ? 1 : 2)), []);
    assert.equal(events.find((e) => e.type === "stunned").count, want, `L${level}`);
  }
});

test("heals never add level²: Heal and Major Heal restore their dice at levels 1, 3, 5", () => {
  for (const n of ["Heal", "Major Heal"]) {
    const sp = row(n);
    for (const level of LEVELS) {
      for (const [face, want] of [[1, lo(sp.dmg)], [sp.dmg.sides, hi(sp.dmg)]]) {
        const s = fight({ ...caster(n, level), wp: 100, maxWP: 999 }, [foe("F1")]);
        const events = castSpell(s, idx(n), rngBy((sides) => (sides === sp.dmg.sides ? face : 1)), []);
        assert.equal(events.find((e) => e.type === "healed").amount, want, `${n} L${level} face ${face}`);
      }
    }
  }
});

test("an Apprentice's backfire is half the dice alone, never level²", () => {
  const sp = row("Fireball");
  for (const level of [3, 5]) {
    const s = fight({ ...caster("Fireball", level), sub: "Apprentice" }, [foe("F1")], noResist("Fireball"));
    const events = castSpell(s, idx("Fireball"), rngBy((sides) => (sides === 8 ? 1 : sp.dmg.sides)), []);
    assert.equal(events.find((e) => e.type === "backfireSelfDamage").amount, Math.ceil(hi(sp.dmg) / 2), `L${level}`);
  }
});

test("a resisted Fireball still does nothing at all; a resisted Freeze still lands its dice + level², only the freeze stops", () => {
  for (const level of [3, 5]) {
    const s = fight(caster("Fireball", level), [foe("F1")], actsWhere("Fireball", [[0, true]]));
    const events = castSpell(s, idx("Fireball"), rngBy(() => 1), []);
    assert.ok(events.some((e) => e.type === "spellResisted"), `L${level}`);
    assert.equal(events.some((e) => e.type === "spellHit"), false);
    assert.equal(s.combat.foes[0].wp, 999);
  }
  const fz = row("Freeze");
  for (const level of LEVELS) {
    const s = fight(caster("Freeze", level), [foe("F1")], actsWhere("Freeze", [[0, true]]));
    const events = castSpell(s, idx("Freeze"), rngBy((sides) => (sides === 10 ? 1 : sides === 6 ? 6 : 2)), []);
    const hit = events.find((e) => e.type === "spellHit");
    assert.equal(hit.dmg, hi(fz.dmg) + level * level, `L${level}`);
    assert.equal(events.find((e) => e.type === "spellResisted").freeze, true);
    assert.equal("held" in s.combat.foes[0], false, `L${level}: no freeze`);
  }
});

test("the level² takes no rng draw: a Fireball hit draws the same count at levels 3 and 5", () => {
  const counts = [3, 5].map((level) => {
    const s = fight(caster("Fireball", level), [foe("F1")], noResist("Fireball"));
    const rng = rngBy((sides) => (sides === 8 ? 1 : 5));
    castSpell(s, idx("Fireball"), rng, []);
    return rng.count();
  });
  assert.equal(counts[0], counts[1]);
  assert.equal(counts[0], 3, "the to-hit d8 and the two damage d10s");
});

// --- the lines: the level² the damage already holds -----------------------------

test("the Oracle and rail hit lines name the level² from level 2 up; a level-1 caster's +1 goes unsaid", () => {
  const hit = { type: "spellHit", spell: "Fireball", target: "Viper", dmg: 23, levelSq: 9 };
  assert.equal(EVENT_NARRATION.spellHit(hit), `<span class="hit">Hit.</span> Viper takes <span class="roll">23</span> hp (the roll +9, for your level).`);
  assert.equal(LINE_FOR.spellHit(hit).text, "Fireball hits Viper (23, the roll +9 for your level)");
  const low = { ...hit, dmg: 5, levelSq: 1 };
  assert.equal(EVENT_NARRATION.spellHit(low), `<span class="hit">Hit.</span> Viper takes <span class="roll">5</span> hp.`);
  assert.equal(LINE_FOR.spellHit(low).text, "Fireball hits Viper (5)");
  assert.equal(EVENT_NARRATION.spellHit({ ...hit, mult: 3, levelSq: undefined }).includes("×"), false, "the retired ×mult is never printed");
});

test("Ice's landing line names the first tick's level² from level 2 up, from a real cast", () => {
  for (const [level, clause, rail] of [[1, "", ""], [3, " (the first +9, for your level)", " (the first +9)"]]) {
    const s = fight(caster("Ice", level), [foe("F1")], noResist("Ice"));
    const events = castSpell(s, idx("Ice"), rngBy(() => 2), []);
    const applied = events.find((e) => e.type === "iceApplied");
    assert.equal(applied.levelSq, level * level);
    assert.equal(EVENT_NARRATION.iceApplied(applied), `<span class="hit">Ice climbs F1: d6 a round for 3 rounds${clause}, then it stops moving.</span>`);
    assert.equal(LINE_FOR.iceApplied(applied).text, `Ice climbs F1: d6 a round${rail}, 3 rounds.`);
  }
});
