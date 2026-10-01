// test/unit/joiner-casters.test.js
//
// Phase 90 plan 10 (SPELL-10, 90-CONTEXT "Joiner Magic Users cast the new
// spells when useful"). A Joiner Magic User casts from its OWN gated book when
// the fight calls for it, through engine/combat.js#pickMemberSpell (pure, no
// rng) after Phase 89's Joiner item policy and before its plain best-attack
// cast and its staff:
//   1. at or below HALF its hit points: a castable healing spell on itself;
//   2. three or more live foes: the highest-level castable room control
//      (Stop Time, Size of the Behemoth, Doze) not already in force;
//   3. round 1: a self buff (Speed of Sound, Enchant Character) not already
//      live on its sheet;
//   4. a live foe at or above its level with more than half its hit points: a
//      castable single control (Duplicate Foe, Senseless, Stun) not already on it;
//   5. else its best attack spell (Ice included), else its staff.
// It never casts Door Illusion, Chameleon Tongue, Fly, Open/Lock or Summon (the
// hero's decisions and the maze tools), nor a spell with no member-side read.
// allyCast resolves each pick through the hero's own shared tails with the
// Joiner's name on every event and the charge paid from the Joiner's own sheet.
//
// Edges (the ABIL-06 fallback probes): adjacency (a Joiner's and the hero's
// party-wide effect never double; a heal beats Stop Time at half hp), empty (no
// charge, or nothing the policy can pick, strikes with the staff; no spells at
// all strikes), encoding (picks key spells by their SPELLS name and kinds by
// the engine kind, never a display string), ordering (item policy, then class
// ability, then pickMemberSpell, then the strike; ties go to the higher level,
// then SPELLS order).

import test from "node:test";
import assert from "node:assert/strict";

import { alliesTurn, pickMemberSpell, MEMBER_ROOM_CONTROL_KINDS, MEMBER_BUFF_ACT_KINDS, MEMBER_SINGLE_CONTROL_KINDS, stopTime } from "../../engine/combat.js";
import { foeRisingResistCheck, bestAttackSpell, spellLevelFor } from "../../engine/derived.js";
import { maxCharges, move } from "../../engine/movement.js";
import { derivedRng } from "../../engine/rng.js";
import { rollDice } from "../../engine/dice.js";
import { GW, GH } from "../../engine/maze.js";
import { SPELLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const ONES = (n) => new Array(n).fill(1);

/** fakeRng(seq) — `.d()` pops the next raw value and THROWS on underflow, so
 * fakeRng([]) doubles as a "no main-rng draw expected" assertion. The cursor
 * is what derived streams read. */
function fakeRng(seq = [], cursor = 4242) {
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

function hero(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 0, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, halfNext: false, worn: {},
    ...overrides,
  };
}

function fixedFloor(depth = 1) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, dark: false, seen: false, feat: null });
  }
  g[5][5] = { wall: false, dark: false, seen: false, feat: null };
  g[4][5] = { wall: false, dark: false, seen: false, feat: null };
  g[6][5] = { wall: false, dark: false, seen: false, feat: null };
  return { g, px: 5, py: 5, depth };
}

function foe(name, overrides = {}) {
  return { name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** A Joiner Magic User sheet. */
function mu(spells, overrides = {}) {
  return {
    name: "Ada", level: 3, sub: "Wizard", cls: "Magic User", race: "Human", wp: 20, maxWP: 20, status: "ok",
    weapon: "Quarter Staff", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [...spells], spellsUsed: 0,
    potions: 0, worn: {},
    ...overrides,
  };
}

/** The combat entry startCombat's sync makes for `sheet`. */
const allyFor = (sheet, idx = 0) => ({ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP });

/** A live fight: the hero is a Fighter, `sheets` are the Joiners. */
function fightWith(sheets, foes, { round = 1, acts = 0 } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(), floor: fixedFloor(1),
    day: 1, steps: 0, store: null, beats: null, party: sheets, dead: false, deathNote: "", epitaph: "", combat: null,
    ...{
      combat: {
        foes, type: "Humans", round, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
        allies: sheets.map((s, i) => allyFor(s, i)),
      },
    },
  };
}

/** findActs(wants, round) — the first state.acts whose REAL resist roll gives every `[source, idx, resisted, by]`. */
function findActs(wants, { round = 1, depth = 1, intel = 10 } = {}) {
  const probe = { getState: () => 4242 };
  for (let acts = 0; acts <= 20000; acts++) {
    if (wants.every(([source, idx, resisted, by]) => foeRisingResistCheck({ floor: { depth }, acts, combat: { round } }, probe, source, idx, intel, by).resisted === resisted)) return acts;
  }
  throw new Error(`findActs: nothing for ${JSON.stringify(wants)}`);
}
const failActs = (source, n, by, opts) => findActs(Array.from({ length: n }, (_, i) => [source, i, false, by]), opts);

const types = (events) => events.map((e) => e.type);
const count = (events, type) => events.filter((e) => e.type === type).length;
const swings = (events) => count(events, "allyMissed") + count(events, "allyStruck");
const view = (sheet, lvl = sheet.level) => ({ ...sheet, level: lvl, prof: 0, magicWpn: 0, might: 0, items: [], skills: sheet.skills ?? {}, grimoire: sheet.grimoire, spellsUsed: sheet.spellsUsed ?? 0 });
/** pick(state, i, round) — pickMemberSpell for Joiner i against the live foes. */
function pick(state, i = 0, round = state.combat.round) {
  const sheet = state.party[i];
  const ally = state.combat.allies[i];
  return pickMemberSpell(state, sheet, ally, view(sheet, ally.lvl), round, state.combat.foes.filter((f) => f.alive));
}

// ─── the lists ──────────────────────────────────────────────────────────────

test("the policy lists are frozen and keyed by engine kinds that exist in SPELLS (encoding: no display-name matching)", () => {
  assert.deepEqual([...MEMBER_ROOM_CONTROL_KINDS], ["timestop", "behemoth", "status"]);
  assert.deepEqual([...MEMBER_BUFF_ACT_KINDS], ["haste", "enchant"]);
  assert.deepEqual([...MEMBER_SINGLE_CONTROL_KINDS], ["misdirect", "stun"]);
  for (const list of [MEMBER_ROOM_CONTROL_KINDS, MEMBER_BUFF_ACT_KINDS, MEMBER_SINGLE_CONTROL_KINDS]) assert.ok(Object.isFrozen(list));
  for (const k of [...MEMBER_ROOM_CONTROL_KINDS, ...MEMBER_SINGLE_CONTROL_KINDS]) assert.ok(SPELLS.some((sp) => sp.kind === k), `${k} is a SPELLS kind`);
  for (const k of MEMBER_BUFF_ACT_KINDS) assert.ok(SPELLS.some((sp) => sp.kind === "timed" && sp.act.kind === k), `${k} is a timed act kind`);
});

// ─── step 1: heal first ─────────────────────────────────────────────────────

test("heal first: a Joiner Wizard at 40% hp with Heal and Stop Time against three foes heals itself (memberHealed), it does not stop time", () => {
  const sheet = mu(["Heal", "Stop Time"], { wp: 8, maxWP: 20 });
  const s = fightWith([sheet], [foe("A"), foe("B"), foe("C")]);
  const events = alliesTurn(s, fakeRng([]), []); // fakeRng([]): not one main draw (the roll is a derived stream)
  const healed = events.filter((e) => e.type === "memberHealed");
  assert.equal(healed.length, 1);
  assert.equal(healed[0].name, "Ada");
  assert.equal(healed[0].spell, "Heal");
  assert.equal(count(events, "timeStopped"), 0);
  assert.equal(s.combat.allies[0].wp, 8 + healed[0].gained);
  assert.ok(healed[0].gained >= 1 && healed[0].gained <= 10, "a d10 for a Wizard");
});

test("heal: a Cleric Joiner adds its +3, the dice come from a derived stream, and the heal clamps to the Joiner's own maximum", () => {
  const sheet = mu(["Heal"], { sub: "Cleric", wp: 4, maxWP: 20 });
  const s = fightWith([sheet], [foe("A")]);
  const roll = rollDice(derivedRng(4242, "memberHeal", 1, 0, 1), SP.Heal.dmg);
  const events = alliesTurn(s, fakeRng([]), []);
  const healed = events.find((e) => e.type === "memberHealed");
  assert.equal(healed.amount, roll + 3);
  assert.equal(s.combat.allies[0].wp, Math.min(20, 4 + roll + 3));
  assert.equal(healed.gained, s.combat.allies[0].wp - 4);
});

test("heal: a Summoner Joiner's heal is halved (the chart's healMul) and says so; a heal2x race's doubles first", () => {
  const sheet = mu(["Heal"], { sub: "Summoner", wp: 4, maxWP: 40, level: 3 });
  const s = fightWith([sheet], [foe("A")]);
  const roll = rollDice(derivedRng(4242, "memberHeal", 1, 0, 1), SP.Heal.dmg);
  const events = alliesTurn(s, fakeRng([]), []);
  const healed = events.find((e) => e.type === "memberHealed");
  assert.equal(healed.amount, Math.max(1, Math.floor(roll * 0.5)));
  assert.equal(healed.halved, healed.amount !== roll ? true : undefined);
});

test("ordering edge: exactly half its hit points still heals first (10 of 20, three foes, Stop Time castable); one hp above half stops time instead", () => {
  const half = fightWith([mu(["Heal", "Stop Time"], { wp: 10, maxWP: 20 })], [foe("A"), foe("B"), foe("C")]);
  assert.equal(pick(half).sp.n, "Heal");
  const above = fightWith([mu(["Heal", "Stop Time"], { wp: 11, maxWP: 20 })], [foe("A"), foe("B"), foe("C")]);
  assert.equal(pick(above).sp.n, "Stop Time");
});

test("a Joiner with a heal at half hp but no charge left strikes with its staff (empty edge)", () => {
  const sheet = mu(["Heal"], { wp: 5, maxWP: 20 });
  sheet.spellsUsed = maxCharges(view(sheet));
  const s = fightWith([sheet], [foe("A")]);
  const events = alliesTurn(s, fakeRng(ONES(40)), []);
  assert.equal(count(events, "memberHealed"), 0);
  assert.equal(swings(events), 1);
});

// ─── step 2: room control against a crowd ───────────────────────────────────

test("room control: a level-4 Joiner Illusionist at full hp, round 2, three foes, casts Size of the Behemoth through behemothRoar with `by`: the lower foe flees, the rest cower", () => {
  const sheet = mu(["Size of the Behemoth"], { sub: "Illusionist", level: 4, wp: 20, maxWP: 20 });
  const foes = [foe("Low", { lvl: 2 }), foe("Same", { lvl: 4 }), foe("High", { lvl: 5 })];
  const s = fightWith([sheet], foes, { round: 2, acts: failActs("Size of the Behemoth", 3, "Ada", { round: 2 }) });
  const events = alliesTurn(s, fakeRng([]), []);
  const cast = events.find((e) => e.type === "behemothCast");
  assert.ok(cast, "a behemothCast line");
  assert.equal(cast.by, "Ada");
  assert.equal(cast.routed, 1, "level 2 is below the Joiner's level 4");
  assert.equal(cast.cowering, 2, "level 4 and level 5 are not below it");
  assert.equal(foes[0].alive, false);
  assert.equal(foes[0].fled, true);
  assert.equal(foes[1].cowering, true);
  assert.equal(foes[2].cowering, true);
  for (const e of events.filter((x) => x.type === "spellResisted" || x.type === "resistFailed")) assert.equal(e.by, "Ada");
});

test("room control: a Joiner's Stop Time holds every foe that fails its resist, kind time, `by` on every line; the highest-level room control wins (Behemoth over Stop Time over Doze)", () => {
  const sheet = mu(["Doze", "Stop Time", "Size of the Behemoth"], { sub: "Illusionist", level: 4 });
  const s = fightWith([sheet], [foe("A"), foe("B"), foe("C")]);
  assert.equal(pick(s).sp.n, "Size of the Behemoth");
  // the level-3 Joiner has Stop Time but not the level-4 Behemoth
  const lower = fightWith([mu(["Doze", "Stop Time"], { sub: "Illusionist", level: 3 })], [foe("A"), foe("B"), foe("C")]);
  assert.equal(pick(lower).sp.n, "Stop Time");
  lower.acts = failActs("Stop Time", 3, "Ada");
  const events = alliesTurn(lower, fakeRng([]), []);
  const held = events.filter((e) => e.type === "controlHeld");
  assert.equal(held.length, 3);
  for (const h of held) {
    assert.equal(h.kind, "time");
    assert.equal(h.by, "Ada");
  }
  assert.equal(events.find((e) => e.type === "timeStopped").by, "Ada");
});

test("room control: already in force on every foe, the next room control is picked (Behemoth cowering -> Stop Time; all held in time -> Doze; all asleep -> nothing)", () => {
  const book = ["Doze", "Stop Time", "Size of the Behemoth"];
  const cowering = fightWith([mu(book, { sub: "Illusionist", level: 4 })], [foe("A", { cowering: true }), foe("B", { cowering: true }), foe("C", { cowering: true })]);
  assert.equal(pick(cowering).sp.n, "Stop Time");
  const stopped = [foe("A", { cowering: true, held: { kind: "time", left: 2 } }), foe("B", { cowering: true, held: { kind: "time", left: 2 } }), foe("C", { cowering: true, held: { kind: "time", left: 2 } })];
  assert.equal(pick(fightWith([mu(book, { sub: "Illusionist", level: 4 })], stopped)).sp.n, "Doze");
  const asleep = stopped.map((f) => ({ ...f, asleep: 2 }));
  assert.equal(pick(fightWith([mu(book, { sub: "Illusionist", level: 4 })], asleep)), null);
});

test("two foes are not a crowd: with only two live foes the room controls are not picked", () => {
  const s = fightWith([mu(["Stop Time"], { sub: "Illusionist", level: 3 })], [foe("A"), foe("B")]);
  assert.equal(pick(s), null);
});

test("adjacency: the hero's Stop Time and a Joiner's never double a party-wide effect (a longer or equal hold stands, the rounds never add)", () => {
  const sheet = mu(["Stop Time"], { sub: "Wizard", level: 3 });
  const foes = [foe("A"), foe("B")];
  const s = fightWith([sheet], foes);
  s.acts = failActs("Stop Time", 2, undefined);
  const mine = [];
  stopTime(s, SP["Stop Time"], fakeRng([]), mine, { sub: "Wizard" }); // the hero's cast
  assert.deepEqual(foes.map((f) => f.held.left), [2, 2]);
  s.acts = failActs("Stop Time", 2, "Ada");
  const theirs = [];
  stopTime(s, SP["Stop Time"], fakeRng([]), theirs, { by: "Ada", sub: "Wizard" }); // the Joiner's
  assert.deepEqual(foes.map((f) => f.held.left), [2, 2], "two casts never make four rounds");
});

// ─── step 3: the round-1 buff ───────────────────────────────────────────────

test("round-1 buff: a level-5 Joiner Sorcerer casts Speed of Sound on its own sheet (50 + 10 per Special point = 60 squares); later rounds it does not recast and its staff swings twice", () => {
  const sheet = mu(["Speed of Sound"], { sub: "Sorcerer", level: 5, wp: 30, maxWP: 30 });
  const s = fightWith([sheet], [foe("A", { wp: 400, maxWP: 400, lvl: 1 })], { round: 1 });
  const first = alliesTurn(s, fakeRng(ONES(40)), []);
  const started = first.find((e) => e.type === "spellEffectStarted");
  assert.ok(started, "spellEffectStarted");
  assert.equal(started.spell, "Speed of Sound");
  assert.equal(started.kind, "haste");
  assert.equal(started.member, "Ada");
  assert.equal(started.squares, 60);
  assert.equal(started.restarted, false);
  assert.equal(sheet.timers["spell:Speed of Sound"].left, 60);
  assert.equal(sheet.timers["spell:Speed of Sound"].phase, "effect");
  assert.equal(swings(first), 0, "the cast was the Joiner's action");
  assert.equal(s.c.timers, undefined, "the hero's own timers never gain a record");
  s.combat.round = 2;
  const second = alliesTurn(s, fakeRng(ONES(40)), []);
  assert.equal(count(second, "spellEffectStarted"), 0, "a live buff is not recast");
  assert.equal(swings(second), 2, "its next strikes are two blows (the Joiner haste read)");
});

test("round-1 buff: Enchant Character at level 4; round 2 is too late (no buff is picked after round 1); a live Speed (a potion's or cloak's) blocks Speed of Sound", () => {
  const book = ["Enchant Character", "Speed of Sound"];
  const lvl4 = fightWith([mu(["Enchant Character"], { sub: "Wizard", level: 4 })], [foe("A")], { round: 1 });
  assert.equal(pick(lvl4).sp.n, "Enchant Character");
  assert.equal(pick(lvl4, 0, 2), null, "round 2: no buff");
  const live = mu(book, { sub: "Sorcerer", level: 5 });
  const s = fightWith([live], [foe("A")]);
  assert.equal(pick(s).sp.n, "Speed of Sound", "nothing live: the higher-level buff (level 5) wins the tie inside the step");
  // a live haste effect on the sheet (here the spell's own record; a Speed potion's or cloak's reads the same)
  live.timers = { "spell:Speed of Sound": { cadence: "squares", phase: "effect", left: 30 } };
  assert.equal(pick(s).sp.n, "Enchant Character", "Speed is live, so the other buff is picked");
  live.timers["spell:Enchant Character"] = { cadence: "squares", phase: "effect", left: 30 };
  assert.equal(pick(s), null, "both live: no buff");
});

// ─── step 4: a single control on a strong foe ───────────────────────────────

test("single control: a level-5 Joiner Illusionist against a lone level-5 foe above half hp casts Duplicate Foe (misdirectFoe, `by`); the foe fights its double", () => {
  const sheet = mu(["Duplicate Foe"], { sub: "Illusionist", level: 5, wp: 30, maxWP: 30 });
  const f = foe("Big", { lvl: 5, wp: 50, maxWP: 50 });
  const s = fightWith([sheet], [f], { acts: failActs("Duplicate Foe", 1, "Ada") });
  const events = alliesTurn(s, fakeRng([3, ...ONES(20)]), []);
  const m = events.find((e) => e.type === "foeMisdirected");
  assert.ok(m, "foeMisdirected");
  assert.equal(m.by, "Ada");
  assert.equal(m.at, "self");
  assert.equal(m.rounds, 3 + 1, "d4 (3) + 1 for a +0 Illusion bonus");
  assert.equal(f.misdirect.at, "self");
});

test("single control: Senseless needs another live foe to turn it on (skipped against a lone foe); a foe already misdirected, held or stunned is not re-targeted", () => {
  const sensible = mu(["Senseless"], { sub: "Illusionist", level: 2 });
  const lone = fightWith([sensible], [foe("A", { lvl: 3 })]);
  assert.equal(pick(lone), null);
  const pair = fightWith([sensible], [foe("A", { lvl: 3 }), foe("B", { lvl: 1 })]);
  assert.equal(pick(pair).sp.n, "Senseless");
  assert.equal(pick(pair).target.name, "A");
  const already = fightWith([sensible], [foe("A", { lvl: 3, misdirect: { at: "friends", left: 2 } }), foe("B", { lvl: 1 })]);
  assert.equal(pick(already), null, "A is misdirected; B is below the Joiner's level");
  const stun = mu(["Stun"], { sub: "Wizard", level: 3 });
  assert.equal(pick(fightWith([stun], [foe("A", { lvl: 4 })])).sp.n, "Stun");
  assert.equal(pick(fightWith([stun], [foe("A", { lvl: 4, held: { kind: "stunned", left: 2 } })])), null);
  assert.equal(pick(fightWith([stun], [foe("A", { lvl: 4, stunned: true })])), null);
});

test("single control: a foe below the Joiner's level, or at half hp or less, is no target for a control (the staff or the best attack spell instead)", () => {
  const stun = mu(["Stun"], { sub: "Wizard", level: 3 });
  assert.equal(pick(fightWith([stun], [foe("Weak", { lvl: 2 })])), null, "level 2 is below 3");
  assert.equal(pick(fightWith([stun], [foe("Hurt", { lvl: 4, wp: 15, maxWP: 30 })])), null, "exactly half is not above half");
  assert.equal(pick(fightWith([stun], [foe("Fresh", { lvl: 4, wp: 16, maxWP: 30 })])).sp.n, "Stun");
});

test("single control: a level-3 Joiner Apprentice stuns a lone level-4 foe: stunFoe holds it d4 rounds as stunned with `by` after its own resist", () => {
  const sheet = mu(["Stun"], { sub: "Apprentice", level: 3 });
  const f = foe("Big", { lvl: 4, wp: 40, maxWP: 40 });
  const s = fightWith([sheet], [f], { acts: failActs("Stun", 1, "Ada") });
  const events = alliesTurn(s, fakeRng([3, ...ONES(20)]), []);
  const held = events.find((e) => e.type === "controlHeld");
  assert.equal(held.kind, "stunned");
  assert.equal(held.rounds, 3);
  assert.equal(held.by, "Ada");
  assert.equal(f.held.kind, "stunned");
});

test("the hero's current target is the foe a single control looks at first", () => {
  const sheet = mu(["Stun"], { sub: "Wizard", level: 3 });
  const s = fightWith([sheet], [foe("A", { lvl: 4 }), foe("B", { lvl: 4 })]);
  s.combat.target = 1;
  assert.equal(pick(s).target.name, "B");
});

// ─── step 5: the fallbacks ──────────────────────────────────────────────────

test("fallback: no pick applies -> the best attack spell (Ice counts) -> no charge -> the staff", () => {
  // Ice (an attack spell) with two foes, a low-level Joiner: no policy pick, so bestAttackSpell casts Ice
  const ice = fightWith([mu(["Ice"], { level: 3 })], [foe("A", { lvl: 1 }), foe("B", { lvl: 1 })]);
  assert.equal(pick(ice), null);
  ice.acts = failActs("Ice", 2, "Ada");
  const events = alliesTurn(ice, fakeRng([5, 2, 3, 2, ...ONES(60)]), []);
  assert.equal(count(events, "iceCast"), 1);
  assert.equal(events.find((e) => e.type === "iceCast").by, "Ada");
  assert.equal(ice.party[0].spellsUsed, 1);
  // no charge left: the staff
  const dry = mu(["Ice"], { level: 3 });
  dry.spellsUsed = maxCharges(view(dry));
  const s = fightWith([dry], [foe("A", { wp: 400, maxWP: 400 })]);
  const staff = alliesTurn(s, fakeRng(ONES(40)), []);
  assert.equal(swings(staff), 1);
  assert.equal(count(staff, "iceCast"), 0);
});

test("empty edge: a Joiner Magic User whose book holds nothing the policy can pick (and no attack spell) strikes with its staff; no spells at all strikes too", () => {
  const book = mu(["Map the Floor", "Shield"], { level: 3 });
  const s = fightWith([book], [foe("A", { wp: 400, maxWP: 400 })]);
  assert.equal(pick(s), null);
  assert.equal(bestAttackSpell({ c: view(book) }), null);
  assert.equal(swings(alliesTurn(s, fakeRng(ONES(40)), [])), 1);
  assert.equal(book.spellsUsed, 0);
  const none = mu([], { level: 3 });
  const s2 = fightWith([none], [foe("A", { wp: 400, maxWP: 400 })]);
  assert.equal(pick(s2), null);
  assert.equal(swings(alliesTurn(s2, fakeRng(ONES(40)), [])), 1);
});

// ─── never ──────────────────────────────────────────────────────────────────

test("never: a Joiner holding Door Illusion, Chameleon Tongue, Fly, Open/Lock, Summon, the sight spells, a ward, Mirror Self, Regeneration or Strength never casts them, in 200 scripted fights", () => {
  const never = ["Door Illusion", "Chameleon Tongue", "Fly", "Open/Lock", "Summon", "Map the Floor", "Sense Danger", "Sense Presence", "Shield", "Bubble", "Mirror Self", "Strength"];
  let castsSeen = 0;
  for (let i = 0; i < 200; i++) {
    const sheet = mu(never, { sub: "Illusionist", level: 5, wp: 1 + (i % 20), maxWP: 20 });
    const foes = Array.from({ length: 1 + (i % 3) }, (_, k) => foe(`F${k}`, { lvl: 1 + ((i + k) % 5), wp: 10 + 5 * ((i + k) % 7), maxWP: 40 }));
    const s = fightWith([sheet], foes, { round: 1 + (i % 4), acts: i });
    assert.equal(pick(s), null, `fight ${i}: the policy picks nothing from that book`);
    const events = alliesTurn(s, fakeRng(ONES(60)), []);
    castsSeen += sheet.spellsUsed;
    for (const e of events) {
      assert.ok(!["spellEffectStarted", "memberHealed", "timeStopped", "behemothCast", "foeMisdirected", "doorIllusionSeen", "tongueCast", "allySummoned"].includes(e.type), `fight ${i}: ${e.type}`);
    }
  }
  assert.equal(castsSeen, 0, "not one charge was spent");
});

// ─── charges ────────────────────────────────────────────────────────────────

test("charges: every Joiner cast increments its OWN sheet's spellsUsed, never the hero's", () => {
  const sheet = mu(["Heal"], { wp: 3, maxWP: 20 });
  const s = fightWith([sheet], [foe("A")]);
  s.c.spellsUsed = 0;
  alliesTurn(s, fakeRng([]), []);
  assert.equal(sheet.spellsUsed, 1);
  assert.equal(s.c.spellsUsed, 0);
  const buff = mu(["Speed of Sound"], { sub: "Sorcerer", level: 5 });
  const s2 = fightWith([buff], [foe("A")]);
  alliesTurn(s2, fakeRng(ONES(20)), []);
  assert.equal(buff.spellsUsed, 1);
  assert.equal(s2.c.spellsUsed, 0);
});

test("a Joiner never casts a spell outside its own book or its sub-class gates (the policy reads canCast on the Joiner's own grimoire)", () => {
  // Stop Time is in the book of a Cleric (a tampered book), but the Cleric can never learn Special
  const cleric = mu(["Stop Time", "Heal"], { sub: "Cleric", level: 5, wp: 5, maxWP: 20 });
  const s = fightWith([cleric], [foe("A"), foe("B"), foe("C")]);
  assert.equal(pick(s).sp.n, "Heal", "the Cleric heals; Stop Time is a closed school for it");
  const notInBook = mu(["Heal"], { sub: "Wizard", level: 5, wp: 20, maxWP: 20 });
  assert.equal(pick(fightWith([notInBook], [foe("A"), foe("B"), foe("C")])), null, "full hp, no room control in the book");
});

// ─── tick ───────────────────────────────────────────────────────────────────

test("tick: a Joiner's spell: record ticks down by the squares the party walks and fades with spellEffectFaded naming the member", () => {
  const sheet = mu(["Speed of Sound"], { sub: "Sorcerer", level: 5 });
  const state = {
    version: 1, seed: 1, rngState: 1, acts: 3, c: hero({ name: "Hero" }), floor: fixedFloor(1),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [sheet], dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
  };
  sheet.timers = { "spell:Speed of Sound": { cadence: "squares", phase: "effect", left: 3 } };
  const events = [];
  for (let i = 0; i < 3; i++) move(state, state.floor.py === 5 ? "N" : "S", fakeRng([]), events);
  assert.equal(sheet.timers["spell:Speed of Sound"], undefined, "the window ran out after 3 squares");
  const faded = events.filter((e) => e.type === "spellEffectFaded");
  assert.deepEqual(faded, [{ type: "spellEffectFaded", spell: "Speed of Sound", kind: "haste", member: "Ada" }]);
  assert.equal(state.c.timers, undefined, "the hero never gains a timers map");
});

// ─── ordering ───────────────────────────────────────────────────────────────

test("ordering: a Joiner's turn tries the item policy first (a potion at one third hp), and the spell policy comes before the strike", () => {
  const sheet = mu(["Heal"], { wp: 6, maxWP: 20, potions: 1 });
  const s = fightWith([sheet], [foe("A")]);
  const events = alliesTurn(s, fakeRng([5, ...ONES(30)]), []);
  // 6 of 20 is below one third (6 * 3 = 18 <= 20): it drinks its potion INSTEAD of casting
  assert.equal(count(events, "memberPotionDrunk"), 1, `a potion line: ${types(events).join(",")}`);
  assert.equal(count(events, "memberHealed"), 0);
  assert.equal(sheet.spellsUsed, 0);
});

test("ties inside a step go to the higher level, then SPELLS order: Stun (L1) and Duplicate Foe (L5) against a strong foe -> Duplicate Foe; two equal-level picks keep SPELLS order", () => {
  const sheet = mu(["Stun", "Duplicate Foe"], { sub: "Illusionist", level: 5 });
  const s = fightWith([sheet], [foe("A", { lvl: 5, wp: 50, maxWP: 50 })]);
  assert.equal(pick(s).sp.n, "Duplicate Foe");
  assert.ok(spellLevelFor("Illusionist", SP["Duplicate Foe"]) > spellLevelFor("Illusionist", SP.Stun));
});

test("pure: calling the policy twice gives the same pick and mutates nothing", () => {
  const sheet = mu(["Heal", "Stop Time"], { wp: 4, maxWP: 20 });
  const s = fightWith([sheet], [foe("A"), foe("B"), foe("C")]);
  const before = JSON.stringify(s);
  const a = pick(s);
  const b = pick(s);
  assert.equal(a.sp, b.sp);
  assert.equal(JSON.stringify(s), before);
});
