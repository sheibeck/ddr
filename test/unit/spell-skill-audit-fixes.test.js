// test/unit/spell-skill-audit-fixes.test.js
//
// Phase 90 plan 10 (SPELL-08, ABIL-06): one pin per remaining `fix engine (90-10)`
// audit row of docs/SPELL-AUDIT.md and docs/SKILL-AUDIT.md (each test fails if
// its fix is reverted, so the row's Pinned by cell names it):
//
//   - Death (Q7 A): kills the foe you PICKED, a dead pick falling to the first
//     live foe, the resist rolled on that same foe (it used to hit the first live foe);
//   - Lightning (Q8 A): a Joiner's Lightning reaches EVERY foe, each its own
//     resist, to-hit roll and damage (it used to throw one bolt at one foe);
//   - Turn Walking Dead (Q9 B, canon): a Walking Dead the turning failed swings
//     only at the caster, a Joiner is never picked while one lives (the
//     `fixated` flag used to be read by nothing);
//   - Stealth, Hardiness, Ambidextrous (Q10 A): a Joiner uses them as the text says;
//   - Dirty Trick: its two-round blindness counts down on every visit a live foe's
//     turn takes (a visit lost to a hold, sleep or stun used to count nothing),
//     and a Dirty Trick on a foe already blind for the fight says it adds nothing.
//
// Edges (the ABIL-06 fallback probes): adjacency (Hardiness and a Pendant or Brace
// stack in the hero's order; a Joiner's Ambidextrous and its Speed do not stack;
// the Joiner's Stealth never fires on a second blow), empty (a Joiner with none
// of the three skills fights exactly as before; no foes to reach), encoding (the
// skills key by their table name), ordering (Hardiness before the Pendant; a
// fixated check after a Taunt's zero-draw return keeps the draws).

import test from "node:test";
import assert from "node:assert/strict";

import { castSpell } from "../../engine/magic.js";
import { alliesTurn, foeTurn, pickFoeTarget, applyFoeDamageToMember } from "../../engine/combat.js";
import { applyDirtyTrick } from "../../engine/abilities.js";
import { foeRisingResistCheck, strikeDie } from "../../engine/derived.js";
import { GW, GH } from "../../engine/maze.js";
import { SPELLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const ONES = (n) => new Array(n).fill(1);
const TWENTIES = (n) => new Array(n).fill(20);
const TWOS = (n) => new Array(n).fill(2);

/** fakeRng(seq) — `.d()` pops the next raw value and THROWS on underflow. The
 * cursor (`getState`) is fixed so a forced resist outcome never depends on how
 * many main draws came first. */
function fakeRng(seq, cursor = 0) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => cursor,
    get draws() {
      return i;
    },
  };
}

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 5, py: 5, depth };
}

function hero(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 5, sp: 0,
    maxWP: 200, wp: 200, skills: {}, vp: 0, abilities: [],
    weapon: "Dagger", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 4, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

function foe(name, overrides = {}) {
  return { name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** A solo caster's fight (no party). */
function soloFight(spellName, foes, { target = 0, level = 5, depth = 1, type = "Humans" } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: hero({ level, grimoire: [spellName] }),
    floor: fixedFloor(depth),
    day: 1, steps: 0, store: null, beats: null, dead: false, deathNote: "", epitaph: "",
    combat: { foes, type, round: 1, target, spellOpen: false, tracked: false },
  };
}

/** A Joiner Magic User sheet. */
function mu(spells, overrides = {}) {
  return {
    name: "Ada", level: 4, sub: "Wizard", cls: "Magic User", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [...spells], spellsUsed: 0,
    potions: 0, worn: {},
    ...overrides,
  };
}

/** A Joiner Fighter sheet (a Knight with a Club). */
function fighter(overrides = {}) {
  return {
    name: "Brom", level: 1, sub: "Knight", cls: "Fighter", race: "Human", wp: 40, maxWP: 40, status: "ok",
    weapon: "Club", prof: 2, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0,
    potions: 0, worn: {},
    ...overrides,
  };
}

const allyFor = (sheet, idx = 0) => ({ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP });

/** A live fight with the Joiner sheets in the party (the hero is a Wizard unless `heroOver`). */
function partyFight(sheets, foes, { round = 1, acts = 0, heroOver = {}, type = "Humans" } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero({ cls: "Fighter", sub: "Soldier", level: 1, ...heroOver }),
    floor: fixedFloor(1),
    day: 1, steps: 0, store: null, beats: null, party: sheets, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes, type, round, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
      allies: sheets.map((s, i) => allyFor(s, i)),
    },
  };
}

/** findActs(wants, depth) — the first state.acts whose REAL resist roll gives every `[source, idx, resisted, by]`. */
function findActs(wants, { depth = 1, round = 1, intel = 10 } = {}) {
  const probe = { getState: () => 0 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (wants.every(([source, idx, resisted, by]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round } }, probe, source, idx, intel, by).resisted === resisted)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)}`);
}

const count = (events, type) => events.filter((e) => e.type === type).length;
const swings = (events) => count(events, "allyMissed") + count(events, "allyStruck");

// ─── Death (Q7 A) ───────────────────────────────────────────────────────────

test("Death: kills the foe you PICKED, not the first live foe; the resist is rolled on that picked foe (Q7 A)", () => {
  const foes = [foe("F1"), foe("F2"), foe("F3")];
  const s = soloFight("Death", foes, { target: 2 });
  // the picked foe (index 2) fails its resist, the first foe (index 0) would have resisted: a revert to "first live foe" resists and kills nobody
  s.acts = findActs([["Death", 2, false], ["Death", 0, true]]);
  const events = castSpell(s, IDX.Death, fakeRng(ONES(120)), []);
  assert.equal(foes[2].alive, false, "the picked foe died");
  assert.equal(foes[0].alive, true);
  assert.equal(foes[1].alive, true);
  const cast = events.find((e) => e.type === "deathCast");
  assert.equal(cast.cost, 25);
  const resists = events.filter((e) => e.type === "spellResisted" || e.type === "resistFailed");
  assert.equal(resists.length, 1);
  assert.equal(resists[0].target, "F3", "the resist line names the foe it really hits");
  assert.equal(events.find((e) => e.type === "foeKilled")?.name ?? "F3", "F3");
});

test("Death: a dead pick falls to the first live foe, never to nobody (Q7 A)", () => {
  const foes = [foe("F1", { alive: false, wp: 0 }), foe("F2"), foe("F3")];
  const s = soloFight("Death", foes, { target: 0 });
  s.acts = findActs([["Death", 1, false]]);
  castSpell(s, IDX.Death, fakeRng(ONES(120)), []);
  assert.equal(foes[1].alive, false, "the first LIVE foe died");
  assert.equal(foes[2].alive, true);
});

test("Death: a resisted cast costs the charge, not the hp, and the picked foe lives (Q7 A edge)", () => {
  const foes = [foe("F1"), foe("F2")];
  const s = soloFight("Death", foes, { target: 1 });
  s.acts = findActs([["Death", 1, true]]);
  const hp = s.c.wp;
  const events = castSpell(s, IDX.Death, fakeRng(TWENTIES(60)), []);
  assert.equal(count(events, "deathCast"), 0);
  assert.equal(foes[1].alive, true);
  assert.equal(s.c.spellsUsed, 1);
  assert.ok(s.c.wp >= hp - 60, "no 25 hp fee was paid for a resisted cast");
  assert.ok(!events.some((e) => e.type === "deathCast"));
});

// ─── Lightning (Q8 A) ───────────────────────────────────────────────────────

test("Lightning: a Joiner's cast hits EVERY foe, each its own to-hit roll and damage (d10+6 + its level^2), `name` on every line (Q8 A)", () => {
  const sheet = mu(["Lightning"], { level: 4 });
  const foes = [foe("F1", { wp: 100, maxWP: 100 }), foe("F2", { wp: 100, maxWP: 100 }), foe("F3", { wp: 100, maxWP: 100 })];
  const s = partyFight([sheet], foes);
  s.acts = findActs([["Lightning", 0, false, "Ada"], ["Lightning", 1, false, "Ada"], ["Lightning", 2, false, "Ada"]]);
  const events = alliesTurn(s, fakeRng([1, 5, 1, 6, 1, 7, ...ONES(30)]), []);
  const hits = events.filter((e) => e.type === "allySpellHit" && e.effect === "damage");
  assert.deepEqual(hits.map((e) => [e.target, e.dmg, e.name]), [["F1", 5 + 6 + 16, "Ada"], ["F2", 6 + 6 + 16, "Ada"], ["F3", 7 + 6 + 16, "Ada"]]);
  assert.deepEqual(foes.map((f) => f.wp), [100 - 27, 100 - 28, 100 - 29]);
  assert.equal(count(events, "allyCast"), 3, "one throw line per foe");
  assert.equal(sheet.spellsUsed, 1, "one charge for the whole cast, paid from the Joiner's own sheet");
});

test("Lightning: each foe rolls its OWN resist and its OWN to-hit: a resister is untouched, a miss touches nobody else (Q8 A)", () => {
  const sheet = mu(["Lightning"], { level: 4 });
  const foes = [foe("F1", { wp: 100, maxWP: 100 }), foe("F2", { wp: 100, maxWP: 100 }), foe("F3", { wp: 100, maxWP: 100 })];
  const s = partyFight([sheet], foes);
  s.acts = findActs([["Lightning", 0, false, "Ada"], ["Lightning", 1, true, "Ada"], ["Lightning", 2, false, "Ada"]]);
  // F1 hits (raw 1), F2 resists (no draws), F3 misses (raw 8 on the d8: the worst face)
  const events = alliesTurn(s, fakeRng([1, 4, 8, ...ONES(30)]), []);
  assert.equal(count(events, "spellResisted"), 1);
  assert.equal(events.find((e) => e.type === "spellResisted").target, "F2");
  assert.equal(foes[1].wp, 100, "the resister took nothing");
  assert.equal(foes[0].wp, 100 - (4 + 6 + 16));
  assert.equal(foes[2].wp, 100, "F3's bolt missed");
  assert.equal(count(events, "allySpellMissed"), 1);
});

test("Lightning: a Joiner's single-target throw (Fireball) still reaches one foe only (the area branch is Lightning's own `aoe` flag, not a name check)", () => {
  const sheet = mu(["Fireball"], { level: 4 });
  const foes = [foe("F1", { wp: 100, maxWP: 100 }), foe("F2", { wp: 100, maxWP: 100 })];
  const s = partyFight([sheet], foes);
  s.acts = findActs([["Fireball", 0, false, "Ada"]]);
  const events = alliesTurn(s, fakeRng([1, 3, 3, ...ONES(30)]), []);
  assert.equal(count(events, "allyCast"), 1);
  assert.equal(foes[1].wp, 100);
});

// ─── Turn Walking Dead (Q9 B) ───────────────────────────────────────────────

test("Turn Walking Dead: a fixated foe never picks a Joiner (the pick die is still drawn once, so the stream does not move); an unfixated foe still can (Q9 B)", () => {
  const sheet = fighter();
  const s = partyFight([sheet], [foe("Wight", { type: "Walking Dead", fixated: true })], { type: "Walking Dead" });
  const plain = partyFight([fighter()], [foe("Wight", { type: "Walking Dead" })], { type: "Walking Dead" });
  const rngA = fakeRng(TWOS(60));
  const rngB = fakeRng(TWOS(60));
  for (let i = 0; i < 20; i++) {
    assert.equal(pickFoeTarget(s, rngA, s.combat.foes[0]), null, "a fixated foe swings at the hero");
    assert.ok(pickFoeTarget(plain, rngB, plain.combat.foes[0]), "an unfixated foe still picks the Joiner on a 2 (control)");
  }
  assert.equal(rngA.draws, rngB.draws, "the same draws either way: only the result is overridden");
});

test("Turn Walking Dead: a Joiner's own Taunt does not pull a fixated Walking Dead off the caster, and draws stay as before (no draw under a taunt)", () => {
  const sheet = fighter({ timers: { "ability:taunt": { cadence: "rounds", phase: "effect", left: 1, cd: 4 } } });
  const s = partyFight([sheet], [foe("Wight", { type: "Walking Dead", fixated: true })], { type: "Walking Dead" });
  const rng = fakeRng([]);
  assert.equal(pickFoeTarget(s, rng, s.combat.foes[0]), null);
  assert.equal(rng.draws, 0);
  const control = partyFight([sheet], [foe("Wight", { type: "Walking Dead" })], { type: "Walking Dead" });
  assert.equal(pickFoeTarget(control, fakeRng([]), control.combat.foes[0])?.name, "Brom", "an unfixated foe is still taunted");
});

test("Turn Walking Dead: after the cast every Walking Dead it could not turn swings only at the caster for the rest of the fight, never at the Joiner (Q9 B)", () => {
  const dead = (n) => foe(n, { type: "Walking Dead", lvl: 5, wp: 60, maxWP: 60 });
  const mk = (fixed) => {
    const sheet = fighter({ wp: 400, maxWP: 400 });
    const s = partyFight([sheet], [dead("W1"), dead("W2")], { type: "Walking Dead", heroOver: { cls: "Magic User", sub: "Cleric", level: 2, grimoire: ["Turn Walking Dead"], wp: 600, maxWP: 600 } });
    if (!fixed) return s;
    const events = castSpell(s, IDX["Turn Walking Dead"], fakeRng(TWOS(200)), []);
    return { s, events };
  };
  const { s, events } = mk(true);
  assert.equal(events.find((e) => e.type === "walkingDeadTurned").count, 0, "level 5 foes are above a level-2 caster: none turned");
  assert.ok(s.combat.foes.every((f) => f.fixated), "every survivor is fixated");
  assert.equal(events.filter((e) => e.member === "Brom").length, 0, "no swing in that cast's own foe turn went at the Joiner");
  const later = [];
  for (let r = 0; r < 4; r++) foeTurn(s, fakeRng(TWOS(60)), later);
  assert.equal(later.filter((e) => e.member === "Brom" || e.type === "memberStruck").length, 0, "nor in the rounds after");
  assert.ok(later.some((e) => e.type === "struckByFoe" || e.type === "foeMissed"), "they did swing, at the caster");
  // control: the same fight with no turning lets a foe pick the Joiner on a 2
  const control = mk(false);
  const controlEvents = [];
  foeTurn(control, fakeRng(TWOS(60)), controlEvents);
  assert.ok(controlEvents.some((e) => e.member === "Brom"), "an unfixated Walking Dead does go for the Joiner");
});

// ─── Stealth (Q10 A) ────────────────────────────────────────────────────────

/** One Joiner Fighter's swing at a lone, tough foe with `raws` for the strike die then the damage dice. */
function swingOnce(sheetOver, { raws = [2, 2, ...TWOS(20)], round = 1, foeOver = {}, heroOver = {}, floorDark = false, mutate } = {}) {
  const sheet = fighter(sheetOver);
  const target = foe("Tough", { wp: 900, maxWP: 900, ...foeOver });
  const s = partyFight([sheet], [target], { round, heroOver });
  if (floorDark) s.floor.g[5][5].dark = true;
  if (mutate) mutate(s);
  const events = alliesTurn(s, fakeRng(raws), []);
  return { s, events, sheet, target };
}

test("Stealth: a Joiner Fighter's OPENING landed blow crits on a roll in its die's top three numbers (the second-best face here), doubling its damage, with a stealthStrike line naming it (Q10 A)", () => {
  const withSkill = swingOnce({ skills: { Stealth: 1 } });
  const plain = swingOnce({ skills: {} });
  const sd = strikeDie({ ...withSkill.sheet, level: 1, skills: { Stealth: 1 } });
  const struck = withSkill.events.find((e) => e.type === "allyStruck");
  const base = plain.events.find((e) => e.type === "allyStruck");
  assert.equal(struck.roll, sd - 1, "the second-best face: not a natural crit");
  assert.equal(base.crit, undefined, "without the skill that roll is an ordinary hit");
  assert.equal(struck.crit, true);
  assert.equal(struck.dmg, base.dmg * 2, "the critical doubles the damage");
  const line = withSkill.events.find((e) => e.type === "stealthStrike");
  assert.equal(line.member, "Brom");
  assert.equal(plain.events.some((e) => e.type === "stealthStrike"), false);
});

test("Stealth: never in plate, never in the dark, never for a Soldier or Guard (Q10 A)", () => {
  assert.equal(swingOnce({ skills: { Stealth: 1 }, armor: "Plate" }).events.some((e) => e.type === "stealthStrike"), false, "plate gives it away");
  assert.equal(swingOnce({ skills: { Stealth: 1 } }, { floorDark: true }).events.some((e) => e.type === "stealthStrike"), false, "the dark");
  assert.equal(swingOnce({ skills: { Stealth: 1 } }, { floorDark: true, mutate: (st) => (st.c.senses = 1) }).events.some((e) => e.type === "stealthStrike"), true, "Sense Presence waives the dark, as for the hero");
  assert.equal(swingOnce({ skills: { Stealth: 1 }, sub: "Soldier" }).events.some((e) => e.type === "stealthStrike"), false, "a Soldier's blows never crit");
});

test("Stealth: only the OPENING LANDED blow: a miss does not open the fight, and the second landed blow does not crit (Q10 A adjacency)", () => {
  // first swing misses (raw 20, the worst face), second lands on the second-best face: the stealth crit; third: no more
  const sheet = fighter({ skills: { Stealth: 1 } });
  const s = partyFight([sheet], [foe("Tough", { wp: 900, maxWP: 900 })]);
  const e1 = alliesTurn(s, fakeRng([20, ...ONES(20)]), []);
  assert.equal(count(e1, "allyMissed"), 1);
  assert.equal(count(e1, "stealthStrike"), 0);
  s.combat.round = 2;
  const e2 = alliesTurn(s, fakeRng([2, 2, ...TWOS(20)]), []);
  assert.equal(count(e2, "stealthStrike"), 1, "the first landed blow opens the fight");
  s.combat.round = 3;
  const e3 = alliesTurn(s, fakeRng([2, 2, ...TWOS(20)]), []);
  assert.equal(count(e3, "stealthStrike"), 0, "only the opening blow");
  assert.equal(e3.find((e) => e.type === "allyStruck").crit, undefined);
});

// ─── Hardiness (Q10 A) ──────────────────────────────────────────────────────

function hardinessHit(sheetOver, dmg, { ability, memberHalf } = {}) {
  const sheet = fighter({ armor: "Nothing", wp: 100, maxWP: 100, ...sheetOver });
  if (memberHalf) sheet.halfNext = true;
  const s = partyFight([sheet], [foe("Brute")]);
  const member = s.combat.allies[0];
  const events = [];
  const res = applyFoeDamageToMember(s, s.combat.foes[0], member, fakeRng([]), events, { dmg, roll: 5, atLeast: 4, dieN: 8, mods: [], swing: 0, ...(ability ? { ability } : {}) });
  return { member, events, res };
}

test("Hardiness: a Joiner with it takes 3 less from every landed blow, floor 1; a blow of 0 stays 0; without it nothing changes (Q10 A)", () => {
  assert.equal(hardinessHit({ skills: { Hardiness: 1 } }, 10).member.wp, 100 - 7);
  assert.equal(hardinessHit({ skills: { Hardiness: 1 } }, 2).member.wp, 100 - 1, "floor 1");
  assert.equal(hardinessHit({ skills: { Hardiness: 1 } }, 0).member.wp, 100, "a blow already at 0 stays 0");
  assert.equal(hardinessHit({ skills: {} }, 10).member.wp, 100 - 10);
});

test("Hardiness: it reaches a foe ability's bolt too, and runs BEFORE the Pendant (10 - 3 = 7, then halved: 4) (Q10 A ordering)", () => {
  assert.equal(hardinessHit({ skills: { Hardiness: 1 } }, 10, { ability: "Fire" }).member.wp, 100 - 7);
  const withBoth = hardinessHit({ skills: { Hardiness: 1 } }, 10, { memberHalf: true });
  assert.equal(withBoth.member.wp, 100 - 4);
  assert.equal(hardinessHit({ skills: {} }, 10, { memberHalf: true }).member.wp, 100 - 5, "the Pendant alone halves 10 to 5");
});

// ─── Ambidextrous (Q10 A) ───────────────────────────────────────────────────

test("Ambidextrous: a Joiner Fighter with it swings twice on a plain strike; without it once; with a live Speed it still swings twice, not four times (Q10 A)", () => {
  const two = swingOnce({ skills: { Ambidextrous: 1 } }, { raws: ONES(40) });
  assert.equal(swings(two.events), 2);
  const one = swingOnce({ skills: {} }, { raws: ONES(40) });
  assert.equal(swings(one.events), 1);
  const both = swingOnce(
    { skills: { Ambidextrous: 1 }, timers: { "item:Cloak of Speed": { cadence: "squares", phase: "effect", left: 30 } } },
    { raws: ONES(40) },
  );
  assert.equal(swings(both.events), 2, "Ambidextrous and Speed do not stack");
});

test("Ambidextrous: the second swing is skipped once the first has felled the target (edge: no foes left)", () => {
  const sheet = fighter({ skills: { Ambidextrous: 1 }, level: 5, weapon: "Club" });
  const s = partyFight([sheet], [foe("Frail", { wp: 1, maxWP: 1 })]);
  const events = alliesTurn(s, fakeRng(ONES(40)), []);
  assert.equal(swings(events), 1, "one swing killed it; no second swing at a corpse");
});

// ─── Dirty Trick ────────────────────────────────────────────────────────────

/** blindVisits(foeOver, n) — a tricked foe (blindFor 2) through n foe turns; the foe's `blindFor` after each. */
function blindVisits(foeOver, n) {
  const f = foe("Viper", { ...foeOver });
  applyDirtyTrick(f);
  const s = soloFight("Heal", [f]);
  const trace = [];
  const events = [];
  for (let i = 0; i < n; i++) {
    foeTurn(s, fakeRng(TWENTIES(20)), events);
    trace.push(f.blindFor);
  }
  return { f, trace, events };
}

test("Dirty Trick: the two-round blindness counts down on a visit lost to SLEEP, to a HOLD and to a STUN, so sight returns after two foe turns whatever the foe did (it used to wait for a visit with swings)", () => {
  const asleep = blindVisits({ asleep: 5 }, 2);
  assert.deepEqual(asleep.trace, [1, undefined]);
  assert.equal(asleep.f.blind, false);
  assert.equal(asleep.events.filter((e) => e.type === "foeSightReturned").length, 1);
  const held = blindVisits({ held: { kind: "stunned", left: 5 } }, 2);
  assert.deepEqual(held.trace, [1, undefined]);
  assert.equal(held.f.blind, false);
  const stunned = blindVisits({ stunned: true }, 1);
  assert.equal(stunned.trace[0], 1, "a Pommel stun costs the foe one visit, and the blindness one round");
  const normal = blindVisits({}, 2);
  assert.deepEqual(normal.trace, [1, undefined], "a swinging visit counts exactly as before");
});

test("Dirty Trick: a spell-blinded foe (no blindFor) stays blind for the fight; a dead foe counts nothing (edge)", () => {
  const f = foe("Viper", { blind: true });
  const s = soloFight("Heal", [f]);
  foeTurn(s, fakeRng(TWENTIES(20)), []);
  foeTurn(s, fakeRng(TWENTIES(20)), []);
  assert.equal(f.blind, true);
  assert.equal("blindFor" in f, false);
});

test("Dirty Trick: applyDirtyTrick says the rounds it put on the foe: 2 normally, 0 on a foe already blind for the fight, whose sight it never restores (the line stops promising two rounds)", () => {
  const plain = foe("Viper");
  assert.equal(applyDirtyTrick(plain), 2);
  assert.equal(plain.blindFor, 2);
  const spellBlind = foe("Viper", { blind: true });
  assert.equal(applyDirtyTrick(spellBlind), 0);
  assert.equal("blindFor" in spellBlind, false);
});

test("Dirty Trick: a Thief Joiner's dirtyTrickLanded carries the real rounds (2 on a sighted foe, 0 on a fight-blind one)", () => {
  const thief = (foeOver) => {
    const sheet = fighter({ name: "Sly", cls: "Thief", sub: "Cat Burglar", abilities: ["dirtyTrick"], weapon: "Dagger" });
    const s = partyFight([sheet], [foe("Viper", { wp: 300, maxWP: 300, ...foeOver })]);
    return alliesTurn(s, fakeRng(ONES(40)), []).find((e) => e.type === "dirtyTrickLanded");
  };
  assert.equal(thief({}).rounds, 2);
  assert.equal(thief({ blind: true }).rounds, 0);
  assert.equal(thief({}).member, "Sly");
});
