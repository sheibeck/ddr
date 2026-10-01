// test/unit/petrify-blind-stupidity.test.js
//
// Phase 90 plan 04 (SPELL-12, user 2026-09-30; Q2 A and Q7 A in
// docs/SPELL-AUDIT.md "## Rulings"): the three reworks.
//
//   Petrify  (level 5) turns one foe to stone and it dies, both lives; the foe
//            may still resist; the stone foe pays its experience like any kill
//            (Q2 A) and drops no coin, no treasure, no bag item, no cooking.
//   Stupidity (level 2) drops its target's intelligence to 1 for the rest of the
//            fight (after the target's own resist, rolled on its old
//            intelligence); the foe keeps acting and is no easier to hit; it
//            aims at the picked foe (Q7 A).
//   Blind    (level 3) limits its target to its to-hit die's top face and no
//            critical for the fight, at any depth; the cap is the LAST term of a
//            swing, so an insult does not raise it (flagged assumption).
//
// None of them has a floor-12 clause any more (the one depth-rising resist
// replaces it: test/unit/spell-depth-resist.test.js).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { foeTurn, killFoe } from "../../engine/combat.js";
import { applyDirtyTrick } from "../../engine/abilities.js";
import { foeRisingResistCheck, risingResistFaces, foeSwingVsHero, heroStrikeFacesVs, targetStrikeFaces } from "../../engine/derived.js";
import { SPELLS } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { foeConditionChips, FOE_CONDITION_DESC } from "../../src/browser/foeConditions.js";

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const ONES = (n) => new Array(n).fill(1);
const TENS = (n) => new Array(n).fill(10);

function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 0,
    count: () => i,
  };
}

function fixedFloor(depth) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 5, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    ...overrides,
  };
}

function foe(name, overrides = {}) {
  return { name, type: "Beasts", lvl: 1, size: "S", intel: 12, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

function spellState(depth, spellName, level, foes) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ level, grimoire: [spellName] }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: { foes, type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false },
  };
}

const isResistLine = (e) => e.type === "spellResisted" || e.type === "resistFailed";

/** acts where foe idx `idx` (intelligence `intel`) gets `resisted` for `source`. */
function actsFor(depth, source, idx, intel, resisted) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (foeRisingResistCheck({ floor: { depth }, acts, combat: { round: 1 } }, probe, source, idx, intel).resisted === resisted) return acts;
  }
  throw new Error(`actsFor: nothing for ${source}`);
}

/** markingEvents(rng, type) — records the main-draw count each time an event of `type` is pushed. */
function markingEvents(rng, type) {
  const ev = [];
  ev.marks = [];
  ev.push = function push(...xs) {
    for (const x of xs) if (x && x.type === type) ev.marks.push(rng.count());
    return Array.prototype.push.apply(ev, xs);
  };
  return ev;
}

// ---------------------------------------------------------------------------
// Petrify
// ---------------------------------------------------------------------------

for (const depth of [1, 12, 13, 20]) {
  test(`Petrify floor ${depth}: a landed Petrify on a two-life foe ends BOTH lives and pays its experience (Q2 A) with no coin, no treasure and no cooking; no hold`, () => {
    const s = spellState(depth, "Petrify", 5, [foe("F1", { lives: 2, wp: 30, intel: 1 }), foe("F2")]);
    s.acts = actsFor(depth, "Petrify", 0, 1, false);
    const rng = fakeRng(TENS(80));
    const events = castSpell(s, IDX.Petrify, rng, []);
    const [f1, f2] = s.combat.foes;
    assert.equal(f1.alive, false);
    assert.equal(f1.lives, 1, "the kill-twice foe's second life went with the first");
    assert.equal(events.some((e) => e.type === "foeRevived"), false);
    assert.equal(events.filter((e) => e.type === "foeKilled").length, 1);
    const killed = events.find((e) => e.type === "foeKilled");
    assert.ok(killed.spGained > 0, "experience is paid");
    assert.equal(s.c.sp, killed.spGained);
    assert.equal(s.c.kills, 1);
    for (const type of ["goldGained", "lootDropped", "cooked", "controlHeld"]) assert.equal(events.some((e) => e.type === type), false, `no ${type}`);
    assert.equal(s.pendingLoot ? s.pendingLoot.length : 0, 0);
    assert.equal(f2.alive, true);
    assert.equal(foeConditionChips(f1, s).length, 0, "the foe card shows it gone");
    const order = events.map((e) => e.type);
    assert.ok(order.indexOf("petrified") < order.indexOf("foeKilled"), "petrified, then the kill");
  });
}

test("Petrify takes only killFoe's experience draw: no coin d10, no treasure d20, no bag d20, no cooking d6 (a normal kill of the same foe takes all of them)", () => {
  const withMarks = (spell, level) => {
    const s = spellState(1, spell, level, [foe("F1", { intel: 1, type: "Humans" }), foe("F2")]);
    s.acts = actsFor(1, spell, 0, 1, false);
    const rng = fakeRng([1, 10, ...ONES(80)]);
    const events = markingEvents(rng, "foeKilled");
    castSpell(s, IDX[spell], rng, events);
    return { marks: events.marks, total: rng.count(), types: events.map((e) => e.type) };
  };
  const stone = withMarks("Petrify", 5);
  assert.deepEqual(stone.marks, [1], "the experience d6 is the only draw before the kill line");
  assert.equal(stone.types.includes("goldGained"), false);
  const death = withMarks("Death", 5); // Death kills through killFoe with spoils on
  assert.ok(death.types.includes("goldGained") && death.types.includes("lootDropped"), "the control: a plain kill pays coin and offers treasure");
});

test("Petrify, resisted: the foe stays flesh, nothing is paid, and the charge is spent", () => {
  const s = spellState(13, "Petrify", 5, [foe("F1", { intel: 1 })]);
  s.acts = actsFor(13, "Petrify", 0, 1, true);
  const events = castSpell(s, IDX.Petrify, fakeRng(TENS(40)), []);
  assert.equal(s.combat.foes[0].alive, true);
  assert.equal(s.c.sp, 0);
  assert.equal(events.some((e) => e.type === "petrified" || e.type === "foeKilled"), false);
  assert.equal(events.filter((e) => e.type === "spellResisted").length, 1);
  assert.equal(s.c.spellsUsed, 1);
});

test("edge (adjacency): a Petrify on a foe already held by a Freeze: the stone wins, the foe is dead and its hold never ticks again", () => {
  const f1 = foe("F1", { intel: 1, held: { kind: "frozen", left: 3 } });
  const s = spellState(1, "Petrify", 5, [f1, foe("F2")]);
  s.acts = actsFor(1, "Petrify", 0, 1, false);
  const events = castSpell(s, IDX.Petrify, fakeRng(TENS(80)), []);
  assert.equal(f1.alive, false);
  assert.equal(events.some((e) => e.type === "foeStillHeld" && e.name === "F1"), false, "a dead foe's hold is not counted down");
});

// ---------------------------------------------------------------------------
// Stupidity
// ---------------------------------------------------------------------------

test("Stupidity: a landed cast on an intelligence-12 foe sets its intelligence to 1 and says stupefied { target, intel: 1, was: 12 }; the resist was rolled on the OLD intelligence", () => {
  for (const depth of [1, 20]) {
    const s = spellState(depth, "Stupidity", 2, [foe("F1", { intel: 12 })]);
    s.acts = actsFor(depth, "Stupidity", 0, 12, false);
    const events = castSpell(s, IDX.Stupidity, fakeRng(TENS(40)), []);
    const f = s.combat.foes[0];
    assert.equal(f.intel, 1, `depth ${depth}`);
    assert.equal(f.stupid, true);
    const line = events.find(isResistLine);
    assert.equal(line.intel, 12, "the resist saw the foe's old intelligence");
    assert.equal(line.faces, risingResistFaces(depth, 12));
    assert.deepEqual(events.find((e) => e.type === "stupefied"), { type: "stupefied", target: "F1", intel: 1, was: 12 });
    assert.equal("held" in f, false, "no hold at any depth");
  }
});

test("Stupidity: the foe keeps acting (no foeStupefied, it swings) and is no easier to hit (no floor of 5 on the hero's strike faces)", () => {
  const f = foe("F1", { intel: 12 });
  const s = spellState(1, "Stupidity", 2, [f]);
  s.c.cls = "Fighter";
  s.c.sub = "Soldier";
  s.acts = actsFor(1, "Stupidity", 0, 12, false);
  const before = heroStrikeFacesVs(s, f);
  const events = castSpell(s, IDX.Stupidity, fakeRng(TENS(80)), []);
  assert.equal(f.stupid, true);
  assert.equal(events.some((e) => e.type === "foeStupefied"), false);
  assert.ok(events.some((e) => e.type === "foeMissed" || e.type === "struckByFoe"), "the stupid foe took its turn in the cast's own foe turn");
  assert.equal(heroStrikeFacesVs(s, f), before);
  assert.equal(targetStrikeFaces(s.c, f, 3), 3, "targetStrikeFaces floors only dozing and held foes");
  assert.equal(targetStrikeFaces(s.c, { stupid: true, asleep: 1 }, 3), 5);
  assert.equal(targetStrikeFaces(s.c, { held: { kind: "frozen", left: 1 } }, 3), 5);
  // a later foeTurn: it acts every round
  const again = foeTurn(s, fakeRng(TENS(40)), []);
  assert.ok(again.some((e) => e.type === "foeMissed" || e.type === "struckByFoe"));
  assert.equal(again.some((e) => e.type === "foeStupefied"), false);
});

test("Stupidity: every later resist the foe rolls uses intelligence 1 (1 face; a 20 on a d20 up to floor 12, more deeper)", () => {
  for (const [depth, faces] of [[1, 1], [12, 1], [13, 2], [20, 9]]) {
    const f = foe("F1", { intel: 12, stupid: true });
    f.intel = 1; // as Stupidity leaves it
    const s = spellState(depth, "Fireball", 3, [f]);
    s.acts = 5;
    const events = castSpell(s, IDX.Fireball, fakeRng(ONES(80)), []);
    const line = events.find(isResistLine);
    assert.equal(line.intel, 1);
    assert.equal(line.faces, faces, `depth ${depth}`);
  }
});

test("Stupidity aims at the foe you picked (Q7 A); a dead pick falls to the first live foe and never burns the charge on a corpse", () => {
  const s = spellState(1, "Stupidity", 2, [foe("F1"), foe("F2"), foe("F3")]);
  s.combat.target = 2;
  s.acts = actsFor(1, "Stupidity", 2, 12, false);
  const events = castSpell(s, IDX.Stupidity, fakeRng(TENS(60)), []);
  assert.deepEqual(s.combat.foes.map((f) => f.intel), [12, 12, 1]);
  assert.equal(events.find((e) => e.type === "stupefied").target, "F3");

  const dead = spellState(1, "Stupidity", 2, [foe("F1", { alive: false, wp: 0 }), foe("F2"), foe("F3")]);
  dead.combat.target = 0;
  dead.acts = actsFor(1, "Stupidity", 0, 12, false);
  // the resist is rolled for the retargeted foe (index 1)
  dead.acts = actsFor(1, "Stupidity", 1, 12, false);
  const ev2 = castSpell(dead, IDX.Stupidity, fakeRng(TENS(60)), []);
  assert.equal(ev2.find((e) => e.type === "stupefied").target, "F2");
  assert.equal(dead.combat.foes[0].intel, 12, "the corpse is untouched");
  assert.equal(dead.c.spellsUsed, 1);
});

test("edge (precision): Stupidity on a foe already at intelligence 1 still lands, and the line says so (was 1)", () => {
  const s = spellState(1, "Stupidity", 2, [foe("F1", { intel: 1 })]);
  s.acts = actsFor(1, "Stupidity", 0, 1, false);
  const events = castSpell(s, IDX.Stupidity, fakeRng(TENS(60)), []);
  assert.deepEqual(events.find((e) => e.type === "stupefied"), { type: "stupefied", target: "F1", intel: 1, was: 1 });
  assert.equal(s.combat.foes[0].intel, 1);
  assert.match(EVENT_NARRATION.stupefied({ target: "Viper", intel: 1, was: 1 }), /already/);
  assert.match(LINE_FOR.stupefied({ target: "Viper", intel: 1, was: 1 }).text, /already/);
});

// ---------------------------------------------------------------------------
// Blind
// ---------------------------------------------------------------------------

test("Blind: a landed cast blinds the target for the fight at EVERY depth (no blindFor, no rounds on the line, no hold)", () => {
  for (const depth of [1, 12, 13, 20]) {
    const s = spellState(depth, "Blind", 3, [foe("F1")]);
    s.acts = actsFor(depth, "Blind", 0, 12, false);
    const events = castSpell(s, IDX.Blind, fakeRng(TENS(60)), []);
    const f = s.combat.foes[0];
    assert.equal(f.blind, true, `depth ${depth}`);
    assert.equal("blindFor" in f, false);
    assert.equal("held" in f, false);
    assert.deepEqual(events.find((e) => e.type === "blinded"), { type: "blinded", target: "F1" });
    // it lasts: many foe turns later it is still blind
    for (let r = 0; r < 6; r++) foeTurn(s, fakeRng(TENS(40)), []);
    assert.equal(f.blind, true);
  }
});

test("Blind: a blind foe's swing needs only its die's top face (one face), an insult does not raise it, and a Weaken cap does not change it", () => {
  const f = foe("F1", { blind: true });
  const s = spellState(1, "Blind", 3, [f]);
  s.c.cls = "Fighter";
  s.c.sub = "Soldier";
  const plain = foeSwingVsHero(s, f);
  assert.equal(plain.faces, 1);
  s.combat.parleyInsulted = true;
  const insulted = foeSwingVsHero(s, f);
  assert.equal(insulted.faces, 1, "the insult's +1 is applied before the blind cap, which is the last term");
  assert.equal(insulted.mods[insulted.mods.length - 1].name, "blind");
  s.combat.foeToHitPenalty = 3;
  assert.equal(foeSwingVsHero(s, f).faces, 1);
  const sighted = foeSwingVsHero(s, foe("F2"));
  assert.ok(sighted.faces > 1, "a sighted foe is unaffected");
});

test("Blind: a blind foe never lands a critical: its top-face hit is an ordinary hit (hero branch, struckByFoe not critical, damage never doubled), for any class", () => {
  const run = (blind, sub) => {
    const f = foe("F1", { blind });
    const s = spellState(1, "Blind", 3, [f]);
    s.c.cls = sub === "Soldier" ? "Fighter" : "Magic User";
    s.c.sub = sub;
    // raw 1 -> the top face (a hit); the foe's damage die then rolls raw 3
    const events = foeTurn(s, fakeRng([1, 3, ...TENS(40)]), []);
    return events.find((e) => e.type === "struckByFoe");
  };
  for (const sub of ["Wizard", "Soldier"]) {
    const sighted = run(false, sub);
    const blind = run(true, sub);
    assert.equal(sighted.critical, true, `${sub}: a sighted foe's top face is a critical`);
    assert.equal(blind.critical, false, `${sub}: a blind foe's is not`);
    assert.equal("critAtLeast" in blind, false);
    assert.ok(blind.dmg < sighted.dmg, `${sub}: a blind foe's damage is not doubled (${blind.dmg} < ${sighted.dmg})`);
  }
});

test("edge (adjacency): Blind on a Dirty-Tricked foe removes the two-round countdown (fight-long); a Dirty Trick on a spell-blinded foe adds no countdown; a Dirty Trick blind never crits either", () => {
  const tricked = foe("F1");
  applyDirtyTrick(tricked);
  assert.equal(tricked.blindFor, 2);
  const s = spellState(1, "Blind", 3, [tricked]);
  s.acts = actsFor(1, "Blind", 0, 12, false);
  castSpell(s, IDX.Blind, fakeRng(TENS(60)), []);
  assert.equal(tricked.blind, true);
  assert.equal("blindFor" in tricked, false, "the countdown is gone: the blindness lasts the fight");

  const spellBlind = foe("F2", { blind: true });
  applyDirtyTrick(spellBlind);
  assert.equal(spellBlind.blind, true);
  assert.equal("blindFor" in spellBlind, false, "no countdown that could restore its sight");

  const plain = foe("F3");
  applyDirtyTrick(plain);
  assert.equal(plain.blindFor, 2, "a Dirty Trick on a sighted foe is the same two rounds as before");
  const st = spellState(1, "Blind", 3, [plain]);
  const events = foeTurn(st, fakeRng([1, 3, ...TENS(40)]), []);
  assert.equal(events.find((e) => e.type === "struckByFoe").critical, false, "a Dirty Trick blind never crits");
});

// ---------------------------------------------------------------------------
// Edges shared by the three: dead target, no foe outside combat.
// ---------------------------------------------------------------------------

test("edge (empty): Petrify, Blind and Stupidity with a dead current target retarget to the first live foe and never burn a charge on a corpse", () => {
  for (const [name, level, effect] of [["Petrify", 5, "petrified"], ["Blind", 3, "blinded"], ["Stupidity", 2, "stupefied"]]) {
    const s = spellState(1, name, level, [foe("F1", { alive: false, wp: 0 }), foe("F2", { intel: 1 })]);
    s.combat.target = 0;
    s.acts = actsFor(1, name, 1, 1, false);
    const events = castSpell(s, IDX[name], fakeRng(TENS(80)), []);
    assert.equal(s.c.spellsUsed, 1, `${name}: one charge`);
    assert.equal(events.find((e) => e.type === effect).target, "F2", `${name}: the live foe took it`);
  }
});

test("edge (empty): outside combat Petrify, Blind and Stupidity are refused as combat-only and spend nothing", () => {
  for (const [name, level] of [["Petrify", 5], ["Blind", 3], ["Stupidity", 2]]) {
    const s = spellState(1, name, level, []);
    s.combat = null;
    const events = castSpell(s, IDX[name], fakeRng(TENS(10)), []);
    assert.deepEqual(events.map((e) => ({ type: e.type, reason: e.reason })), [{ type: "castRefused", reason: "combatOnly" }]);
    assert.equal(s.c.spellsUsed, 0);
  }
});

// ---------------------------------------------------------------------------
// Text, chips and narration say the new rules, with no floor-12 language.
// ---------------------------------------------------------------------------

test("texts: the Petrify, Blind and Stupidity rows state the new rules and carry no floor-12 or three-round language", () => {
  const by = (n) => SPELLS.find((x) => x.n === n).txt;
  assert.match(by("Petrify"), /stone/);
  assert.match(by("Petrify"), /dies/);
  assert.match(by("Petrify"), /none of the spoils/);
  assert.match(by("Blind"), /top face/);
  assert.match(by("Blind"), /never lands a critical/);
  assert.match(by("Blind"), /for the fight/);
  assert.match(by("Stupidity"), /intelligence drops to 1/);
  assert.match(by("Stupidity"), /a 20 on a d20/);
  for (const sp of SPELLS) assert.doesNotMatch(sp.txt, /floor 12|three rounds|five days/i, `${sp.n}: "${sp.txt}"`);
});

test("chips and card: a stupid foe's chip says intelligence 1 and still swinging; a blind foe's says top face and no criticals; the Held chip is only a Freeze's", () => {
  const stupid = foeConditionChips(foe("F1", { stupid: true, intel: 1 }), spellState(1, "Stupidity", 2, []))[0];
  assert.equal(stupid.text, "Stupefied");
  assert.match(stupid.desc, /intelligence is down to 1/);
  assert.match(stupid.desc, /still swinging/);
  assert.doesNotMatch(stupid.desc, /does nothing|easier to hit/);
  assert.match(FOE_CONDITION_DESC.blind, /top face and never lands a critical/);
  const held = foeConditionChips(foe("F1", { held: { kind: "frozen", left: 2 } }), spellState(1, "Freeze", 1, []))[0];
  assert.equal(held.text, "Frozen · 2");
});

test("narration: stupefied (was and the 1), blinded (no rounds, no critical) and petrified (no spoils) read the new rules on the Oracle and the rail", () => {
  const strip = (t) => t.replace(/<[^>]*>/g, "");
  const st = { target: "Viper", intel: 1, was: 12 };
  assert.match(strip(EVENT_NARRATION.stupefied(st)), /intelligence 12 down to 1/);
  assert.match(LINE_FOR.stupefied(st).text, /intelligence 12 down to 1/);
  const bl = { target: "Viper" };
  assert.match(strip(EVENT_NARRATION.blinded(bl)), /rest of the fight.*top face.*never lands a critical/);
  assert.match(LINE_FOR.blinded(bl).text, /for the fight.*top face.*never crits/);
  assert.doesNotMatch(strip(EVENT_NARRATION.blinded(bl)), /round/);
  assert.match(strip(EVENT_NARRATION.petrified(bl)), /stone.*no spoils/);
  assert.match(LINE_FOR.petrified(bl).text, /stone and dies.*No spoils/);
  assert.equal(EVENT_NARRATION.foeStupefied, undefined, "the per-turn skip line is gone with the skip");
  assert.equal(LINE_FOR.foeStupefied, undefined);
});

test("killFoe's spoils option: opts.spoils === false pays the experience and checks the level, and nothing else; the default kill is unchanged", () => {
  const mk = () => {
    const s = spellState(1, "Death", 5, [foe("F1", { intel: 1, type: "Humans" })]);
    return s;
  };
  const a = mk();
  const evA = killFoe(a, a.combat.foes[0], fakeRng([1, 10, ...ONES(80)]), [], { spoils: false });
  assert.ok(evA.some((e) => e.type === "foeKilled"));
  assert.equal(evA.some((e) => e.type === "goldGained" || e.type === "lootDropped"), false);
  const b = mk();
  const evB = killFoe(b, b.combat.foes[0], fakeRng([1, 10, ...ONES(80)]), []);
  assert.ok(evB.some((e) => e.type === "goldGained"));
  assert.equal(a.c.sp, b.c.sp, "the same experience either way");
});
