// test/unit/joiner-bard-song.test.js
//
// Phase 91 (IDENT-17, plan 91-07): the Joiner half of the Bard's song. CONTEXT
// "Joiner Bards sing once per fight, automatically on their turn": a Joiner Bard
// sings on its FIRST turn of each fight, before any ability, cast or strike, one
// random offense or protection spell at or below ITS level, at full strength,
// resolved as the Joiner's own cast (engine/combat.js#allyCast, the Joiner cast
// path Phase 90 extended), with no charge spent from any sheet. "You" in a sung
// spell's text means the singer: a sung Shield wards the Joiner, a sung Strength
// is on the Joiner's own sheet, a sung Earthquake's backlash and a sung Death's
// fee come out of the Joiner's hit points (and can down it), and none of it ever
// touches the hero's sheet.
//
// Pins: once per fight and the first turn; the pool and the derived stream; every
// songPool(5) kind resolves for a Joiner singer; "you" is the singer (ward,
// mirror, Strength, Sense Presence, backlash, fee); no charges; a hero Bard and a
// Joiner Bard each sing once, separately; a non-Bard Joiner's turn is untouched.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { alliesTurn, applyFoeDamageToMember, foeTurn, sing, songPool, afterPlayerAction } from "../../engine/combat.js";
import { derivedRng, makeRng } from "../../engine/rng.js";
import { strengthRoll } from "../../engine/derived.js";
import { startSpellEffect } from "../../engine/combat.js";
import { GW, GH } from "../../engine/maze.js";
import { SPELLS, SONG_TITLES } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const SP = Object.fromEntries(SPELLS.map((sp) => [sp.n, sp]));
const SEED = 7;

/** A main rng that counts every draw; getState is the cursor derived streams read. */
function countingRng(seed = SEED) {
  const r = makeRng(seed);
  let n = 0;
  return {
    d: (s) => { n++; return r.d(s); },
    pick: (a) => { n++; return r.pick(a); },
    next: () => { n++; return r.next(); },
    shuffle: (a) => { n++; return r.shuffle(a); },
    getState: () => r.getState(),
    setState: (s) => r.setState(s),
    count: () => n,
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
  return { g, px: 5, py: 5, depth };
}

function foe(name, overrides = {}) {
  return { name, type: "Humans", lvl: 1, size: "S", intel: 10, wp: 300, maxWP: 300, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}

/** A Joiner Bard sheet (the party member), level 5 unless overridden. */
function bardSheet(overrides = {}) {
  return {
    name: "Lyra", level: 5, sub: "Bard", cls: "Fighter", race: "Human", wp: 60, maxWP: 60, status: "ok",
    weapon: "Club", prof: 0, magicWpn: 0, might: 0, items: [], skills: {}, armor: "Nothing", grimoire: [], spellsUsed: 0,
    potions: 0, worn: {},
    ...overrides,
  };
}

/** The combat entry startCombat's sync makes for `sheet`. */
const allyFor = (sheet, idx = 0) => ({ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP });

/** A live fight: the hero is a Soldier (or `heroOver`), `sheets` are the Joiners. */
function fightWith(sheets, foes, { round = 1, acts = 0, type = "Humans", heroOver = {} } = {}) {
  return {
    version: 1, seed: 1, rngState: 1, acts,
    c: hero(heroOver), floor: fixedFloor(1),
    day: 1, steps: 0, store: null, beats: null, party: sheets, dead: false, deathNote: "", epitaph: "",
    combat: {
      foes, type, round, target: 0, pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
      allies: sheets.map((s, i) => allyFor(s, i)),
    },
  };
}

/** The derived stream the Joiner's song uses for a main cursor, party index and acts. */
const songStream = (cursor, partyIdx, acts) => derivedRng(cursor, "memberSong", partyIdx, acts);

/** The first state.acts whose Joiner song stream picks `spellName` at `level` (cursor = the main rng's state). */
function actsPicking(level, spellName, { seed = SEED, partyIdx = 0 } = {}) {
  const cursor = makeRng(seed).getState();
  const pool = songPool(level);
  for (let acts = 0; acts < 20000; acts++) {
    if (pool[songStream(cursor, partyIdx, acts).d(pool.length) - 1].n === spellName) return acts;
  }
  throw new Error(`no acts picks ${spellName}`);
}

/** One Joiner turn (alliesTurn) on a counting main rng. */
function turn(state, rng = countingRng()) {
  const events = [];
  alliesTurn(state, rng, events);
  return { events, rng };
}

/** A Joiner Bard fight set to sing `spellName` on its first turn. */
function singing(spellName, { sheetOver = {}, foes = [foe("Ned"), foe("Bob"), foe("Cy")], type = "Humans", heroOver = {} } = {}) {
  const sheet = bardSheet(sheetOver);
  const acts = actsPicking(sheet.level, spellName);
  return fightWith([sheet], foes, { acts, type, heroOver });
}

const sangOf = (events) => events.filter((e) => e.type === "sang");
const types = (events) => events.map((e) => e.type);
const STRIKES = new Set(["allyStruck", "allyMissed", "allyCast"]);

// --- once per fight, first turn ------------------------------------------------

test("IDENT-17 Joiner: a Joiner Bard sings on its first turn, takes no strike that turn, and sings once per fight", () => {
  const state = fightWith([bardSheet()], [foe("Ned", { asleep: 9 })], { acts: 3 });
  const first = turn(state);
  const sang = sangOf(first.events);
  assert.equal(sang.length, 1, "one song on the first turn");
  assert.equal(sang[0].member, "Lyra", "named for the singer");
  assert.equal(typeof sang[0].title, "string");
  assert.equal(typeof sang[0].spell, "string");
  assert.equal(sang[0].level, SP[sang[0].spell].lvl);
  assert.equal(first.events.filter((e) => e.type === "allyStruck" || e.type === "allyMissed").length, 0, "no weapon strike on the song turn");
  assert.equal(state.combat.allies[0].sang, true, "the once-per-fight flag lives on the fight's ally entry");

  state.combat.round = 2;
  const second = turn(state);
  assert.equal(sangOf(second.events).length, 0, "never twice in one fight");
  assert.ok(second.events.some((e) => e.type === "allyStruck" || e.type === "allyMissed"), "later turns act as before: a strike");
  assert.equal(sangOf(turn(state).events).length, 0, "still not on the third turn");
});

test("IDENT-17 Joiner: the next fight sings again (a fresh fight entry)", () => {
  const sheets = [bardSheet()];
  const one = fightWith(sheets, [foe("Ned", { asleep: 9 })], { acts: 3 });
  assert.equal(sangOf(turn(one).events).length, 1);
  const two = fightWith(sheets, [foe("Ned", { asleep: 9 })], { acts: 4 });
  assert.equal(two.combat.allies[0].sang, undefined);
  assert.equal(sangOf(turn(two).events).length, 1, "the next fight sings again");
});

// --- the pool and the stream ----------------------------------------------------

test("IDENT-17 Joiner: the pick is from songPool(the Joiner's level), reproducible from derivedRng(cursor, 'memberSong', partyIdx, acts)", () => {
  const cursor = makeRng(SEED).getState();
  for (let acts = 0; acts < 60; acts++) {
    const level = 1 + (acts % 5);
    const state = fightWith([bardSheet({ level, wp: 60 })], [foe("Ned", { asleep: 9 }), foe("Bob", { asleep: 9 })], { acts });
    const { events } = turn(state);
    const sang = sangOf(events)[0];
    const pool = songPool(level);
    const stream = songStream(cursor, 0, acts);
    const sp = pool[stream.d(pool.length) - 1];
    const raw = SONG_TITLES[stream.d(SONG_TITLES.length) - 1];
    assert.equal(sang.spell, sp.n, `acts ${acts}: the spell`);
    assert.equal(sang.title, raw.replace("{spell}", sp.n), `acts ${acts}: the title`);
    assert.ok(sp.lvl <= level, "never a spell above the Joiner's level");
    assert.equal(sang.level, sp.lvl);
  }
});

test("IDENT-17 Joiner: the main rng draws nothing for the song (the whole song runs on the derived stream)", () => {
  const state = singing("Freeze");
  const { events, rng } = turn(state);
  assert.equal(sangOf(events)[0].spell, "Freeze");
  assert.equal(rng.count(), 0, "no main-rng draw on the song turn");
});

// --- every kind -----------------------------------------------------------------

/** What a Joiner's sung spell legitimately changes on the hero's `c`: kills pay the hero (kills, xp, sp, gold), and Weaken is party-wide (the hero's `spell:weaken` timer). */
const HERO_SHARED = new Set(["kills", "xp", "sp", "gold"]);
const heroView = (c, shared = HERO_SHARED) => {
  const o = {};
  for (const k of Object.keys(c).sort()) if (!shared.has(k)) o[k] = c[k];
  return JSON.parse(JSON.stringify(o));
};

for (const sp of songPool(5)) {
  test(`IDENT-17 Joiner (every kind): a Joiner Bard forced to sing ${sp.n} (${sp.kind}) resolves it without throwing and leaves the hero's sheet alone`, () => {
    const walking = sp.kind === "turn" || sp.kind === "gate";
    const foes = [foe("Ned", { lvl: 1 }), foe("Bob", { lvl: 1 }), foe("Cy", { lvl: 1 })];
    const state = singing(sp.n, { foes, type: walking ? "Walking Dead" : "Humans" });
    const shared = sp.kind === "weaken" ? new Set([...HERO_SHARED, "timers"]) : HERO_SHARED;
    const before = heroView(state.c, shared);
    const spellsUsedBefore = state.c.spellsUsed;
    const { events } = turn(state);
    const sang = sangOf(events);
    assert.equal(sang.length, 1);
    assert.equal(sang[0].spell, sp.n);
    assert.equal(sang[0].member, "Lyra");
    assert.deepEqual(heroView(state.c, shared), before, `${sp.n}: the hero's sheet is untouched`);
    assert.equal(state.c.spellsUsed, spellsUsedBefore, "no hero charge spent");
    assert.equal(state.party[0].spellsUsed, 0, "no Joiner charge spent");
    // the song turn is the Joiner's whole action: nothing but the song's own events follow it
    assert.ok(!events.some((e) => e.type === "allyStruck" && !e.name), "no stray strike");
    // the hero's own ward/mirror/senses never moved
    assert.equal(state.c.ward, null);
    assert.equal(state.c.mirror, 0);
    assert.ok(!state.c.senses);
  });
}

// --- "you" is the singer ---------------------------------------------------------

test("IDENT-17 Joiner (you): a sung Shield wards the Joiner, and a foe's blow goes through that ward in the Joiner's pipeline", () => {
  const state = singing("Shield", { foes: [foe("Ned")] });
  const { events } = turn(state);
  const raised = events.find((e) => e.type === "wardRaised");
  assert.equal(raised.member, "Lyra");
  assert.equal(raised.spell, "Shield");
  const ally = state.combat.allies[0];
  assert.deepEqual(ally.ward, { pool: 50, rounds: 5, name: "Shield" });
  assert.equal(state.c.ward, null, "the hero is not warded in the Joiner's place");
  const hit = [];
  const res = applyFoeDamageToMember(state, state.combat.foes[0], ally, countingRng(), hit, { dmg: 7, roll: 15, atLeast: 12, dieN: 20, mods: [], critical: false, swing: 0 });
  assert.deepEqual(types(hit), ["wardAbsorbed"]);
  assert.equal(hit[0].member, "Lyra");
  assert.equal(hit[0].amount, 7);
  assert.equal(hit[0].remaining, 43);
  assert.equal(ally.wp, 60, "the ward ate the blow: no hit points lost");
  assert.deepEqual(res, { downed: false, soaked: true, applied: 0 });
  assert.equal(ally.ward.pool, 43);
});

test("IDENT-17 Joiner (you): a ward that runs out shatters, and the rest of the blow lands on the Joiner", () => {
  const state = singing("Shield", { foes: [foe("Ned")] });
  turn(state);
  const ally = state.combat.allies[0];
  ally.ward.pool = 5;
  const hit = [];
  const res = applyFoeDamageToMember(state, state.combat.foes[0], ally, countingRng(), hit, { dmg: 9, roll: 15, atLeast: 12, dieN: 20, mods: [], critical: false, swing: 0 });
  assert.deepEqual(types(hit), ["wardAbsorbed", "wardShattered", "memberStruck"]);
  assert.equal(hit[1].member, "Lyra");
  assert.equal(ally.ward, null);
  assert.equal(ally.wp, 56, "9 minus the 5 the ward ate");
  assert.equal(res.applied, 4);
});

test("IDENT-17 Joiner (you): a sung Shield fades on the round tick with the Joiner's name, and the hero's ward is not ticked for it", () => {
  const state = singing("Shield", { foes: [foe("Ned", { asleep: 99 })] });
  turn(state);
  const ally = state.combat.allies[0];
  ally.ward.rounds = 1;
  const events = [];
  foeTurn(state, countingRng(), events);
  const faded = events.find((e) => e.type === "wardFaded");
  assert.equal(faded.member, "Lyra");
  assert.equal(ally.ward, null);
});

test("IDENT-17 Joiner (you): a sung Bubble catches the Joiner's next blow and sends it back, then leaves a film for the round", () => {
  const state = singing("Bubble", { foes: [foe("Ned")] });
  const { events } = turn(state);
  const raised = events.find((e) => e.type === "wardRaised");
  assert.equal(raised.member, "Lyra");
  assert.equal(raised.mirror, true);
  const ally = state.combat.allies[0];
  assert.equal(ally.ward.mirror, true);
  assert.equal(state.c.ward, null);
  const f = state.combat.foes[0];
  const wpBefore = f.wp;
  const hit = [];
  const res = applyFoeDamageToMember(state, f, ally, countingRng(), hit, { dmg: 12, roll: 15, atLeast: 12, dieN: 20, mods: [], critical: false, swing: 0 });
  assert.equal(hit[0].type, "wardReflected");
  assert.equal(hit[0].member, "Lyra");
  assert.equal(hit[0].mirror, true);
  assert.equal(ally.wp, 60, "the Joiner takes none of it");
  assert.ok(f.wp < wpBefore, "the foe took the bounce");
  assert.deepEqual(ally.ward, { name: "Bubble", pool: 25, rounds: 1 });
  assert.equal(res.applied, 0);
});

test("IDENT-17 Joiner (you): a sung Strength is a record on the Joiner's own sheet, never the hero's, and the Joiner's next blow rolls it", () => {
  const state = singing("Strength", { foes: [foe("Ned")] });
  const { events } = turn(state);
  const cast = events.find((e) => e.type === "strengthCast");
  assert.equal(cast.member, "Lyra");
  assert.equal(cast.squares, 100);
  const rec = state.party[0].timers["spell:Strength"];
  assert.ok(rec && rec.phase === "effect" && rec.left === 100, "the record is on the Joiner's sheet");
  assert.equal(state.c.timers, undefined, "the hero has no timers record");
  const probe = makeRng(3);
  assert.ok(strengthRoll(state.party[0], probe) >= 1, "the Joiner's sheet rolls the extra die");
  assert.equal(strengthRoll(state.c, probe), 0, "the hero's sheet does not");

  // The Joiner's next blow (a strike on round 2) is the same blow plus the d10: compare with an identical fight without the record.
  const base = fightWith([bardSheet({ level: 5 })], [foe("Ned")], { round: 2, acts: 0 });
  base.combat.allies[0].sang = true;
  const boosted = fightWith([bardSheet({ level: 5 })], [foe("Ned")], { round: 2, acts: 0 });
  boosted.combat.allies[0].sang = true;
  startSpellEffect(boosted.party[0], SP.Strength, []);
  let landed = 0;
  for (let seed = 1; seed < 40 && landed < 3; seed++) {
    const a = turn(structuredClone(base), countingRng(seed)).events.find((e) => e.type === "allyStruck");
    const b = turn(structuredClone(boosted), countingRng(seed)).events.find((e) => e.type === "allyStruck");
    if (!a || !b) continue;
    landed++;
    assert.ok(b.dmg > a.dmg, `seed ${seed}: the boosted blow is bigger (${b.dmg} vs ${a.dmg})`);
  }
  assert.ok(landed >= 1, "at least one landed pair was compared");
});

test("IDENT-17 Joiner (you): a sung Earthquake's backlash comes out of the Joiner (half the dice) and never the hero", () => {
  const state = singing("Earthquake", { foes: [foe("Ned"), foe("Bob")] });
  const heroWp = state.c.wp;
  const { events } = turn(state);
  const quake = events.find((e) => e.type === "earthquake");
  const back = events.find((e) => e.type === "earthquakeSelfDamage");
  assert.ok(quake && back, "the floor heaves and does not take sides");
  assert.equal(back.member, "Lyra");
  assert.equal(state.combat.allies[0].wp, 60 - back.amount, "the Joiner paid the backlash");
  assert.equal(state.c.wp, heroWp, "the hero did not");
  assert.ok(back.amount >= 1);
});

test("IDENT-17 Joiner (you): a Joiner already warded takes no Earthquake backlash, as a warded hero takes none", () => {
  const state = singing("Earthquake", { foes: [foe("Ned"), foe("Bob")] });
  state.combat.allies[0].ward = { pool: 10, rounds: 3, name: "Shield" };
  const { events } = turn(state);
  assert.ok(events.some((e) => e.type === "earthquake"));
  assert.equal(events.some((e) => e.type === "earthquakeSelfDamage"), false);
  assert.equal(state.combat.allies[0].wp, 60);
});

test("IDENT-17 Joiner (you): a sung Earthquake that costs the Joiner its last hit points downs it through downMember, and the hero lives", () => {
  const state = singing("Earthquake", { sheetOver: { wp: 1, maxWP: 60 }, foes: [foe("Ned"), foe("Bob")] });
  const heroWp = state.c.wp;
  const { events } = turn(state);
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage" && e.member === "Lyra"));
  const down = events.find((e) => e.type === "memberDowned");
  assert.equal(down.name, "Lyra");
  assert.equal(state.combat.allies.length, 0, "pulled from the roster");
  assert.equal(state.party[0].status, "downed");
  assert.equal(state.c.wp, heroWp);
  assert.equal(state.dead, false);
});

test("IDENT-17 Joiner (you): a sung Death costs the Joiner 25 hp and kills the picked foe; the hero pays nothing", () => {
  const state = singing("Death", { foes: [foe("Ned"), foe("Bob")] });
  state.combat.target = 1;
  const heroWp = state.c.wp;
  const { events } = turn(state);
  const cast = events.find((e) => e.type === "deathCast");
  assert.equal(cast.member, "Lyra");
  assert.equal(cast.cost, 25);
  assert.equal(state.combat.allies[0].wp, 60 - 25);
  assert.equal(state.c.wp, heroWp);
  assert.equal(state.combat.foes[1].alive, false, "the picked foe dies");
  assert.equal(state.combat.foes[0].alive, true);
});

test("IDENT-17 Joiner (you): a sung Death the Joiner cannot afford fizzles with its name on it and costs nobody anything", () => {
  const state = singing("Death", { sheetOver: { wp: 20, maxWP: 60 }, foes: [foe("Ned")] });
  const { events } = turn(state);
  const weak = events.find((e) => e.type === "deathSpellTooWeak");
  assert.equal(weak.member, "Lyra");
  assert.equal(state.combat.allies[0].wp, 20, "nothing was paid");
  assert.equal(state.combat.foes[0].alive, true);
  assert.equal(state.combat.allies[0].sang, true, "the song is spent");
});

test("IDENT-17 Joiner (you): a sung Sense Presence is the Joiner's (its own flag), never the hero's", () => {
  const state = singing("Sense Presence", { foes: [foe("Ned")] });
  const { events } = turn(state);
  const gained = events.find((e) => e.type === "sensesGained");
  assert.equal(gained.member, "Lyra");
  assert.equal(state.combat.allies[0].senses, true);
  assert.ok(!state.c.senses, "the hero's senses are untouched");
});

test("IDENT-17 Joiner (you): a sung Turn Walking Dead resolves at the Joiner's level and fixates nothing on the hero", () => {
  const foes = [foe("Wight", { lvl: 1 }), foe("Wraith", { lvl: 5, intel: 20 })];
  const state = singing("Turn Walking Dead", { foes, type: "Walking Dead" });
  const { events } = turn(state);
  assert.ok(events.some((e) => e.type === "walkingDeadTurned"));
  for (const f of state.combat.foes) assert.ok(!f.fixated, "fixation is a hero-only rule; a Joiner's song never aims it at the hero");
});

// --- no charges ------------------------------------------------------------------

test("IDENT-17 Joiner (no charges): the song spends no charge from the Joiner or the hero, and a Joiner with every charge spent still sings", () => {
  const state = singing("Fireball", { sheetOver: { spellsUsed: 99 }, foes: [foe("Ned")] });
  state.c.spellsUsed = 99;
  const { events } = turn(state);
  assert.equal(sangOf(events)[0].spell, "Fireball");
  assert.equal(state.party[0].spellsUsed, 99);
  assert.equal(state.c.spellsUsed, 99);
  assert.ok(events.some((e) => e.type === "allyCast" || e.type === "spellResisted"), "the spell was cast");
});

// --- hero and Joiner side by side -------------------------------------------------

test("IDENT-17 Joiner (side by side): a hero Bard and a Joiner Bard each sing once, separately, and neither blocks the other", () => {
  const sheet = bardSheet({ level: 3, wp: 40, maxWP: 40 });
  const state = fightWith([sheet], [foe("Ned", { asleep: 99 }), foe("Bob", { asleep: 99 })], { acts: 0, heroOver: { sub: "Bard", level: 3, wp: 200, maxWP: 200 } });
  const rng = countingRng();
  const events = [];
  sing(state, rng, events);
  const sang = sangOf(events);
  assert.equal(sang.length, 2, "two songs in one action: the hero's, then the Joiner's");
  assert.equal(sang[0].member, undefined, "the hero's song carries no member");
  assert.equal(sang[1].member, "Lyra");
  assert.equal(state.combat.sang, true);
  assert.equal(state.combat.allies[0].sang, true);
  // the hero cannot sing again; the Joiner does not either
  const again = [];
  sing(state, rng, again);
  assert.deepEqual(again.map((e) => [e.type, e.reason]), [["actionRefused", "sungThisFight"]]);
  state.combat.round = 2;
  const next = [];
  afterPlayerAction(state, rng, next);
  assert.equal(sangOf(next).length, 0, "no second Joiner song in the fight");
});

test("IDENT-17 Joiner (side by side): a Joiner Bard sings when the hero is not a Bard, and a hero Bard's song never marks the Joiner's flag", () => {
  const state = fightWith([bardSheet({ level: 2, wp: 40, maxWP: 40 })], [foe("Ned", { asleep: 99 })], { acts: 1 });
  assert.equal(state.c.sub, "Soldier");
  assert.equal(sangOf(turn(state).events).length, 1);
  assert.equal(state.combat.sang, undefined, "the fight's own flag is the hero's");
});

// --- non-Bards -------------------------------------------------------------------

test("IDENT-17 Joiner (non-Bards): a Joiner Fighter's and a Joiner Magic User's turn never sings and never gains a song flag", () => {
  for (const [sub, cls] of [["Soldier", "Fighter"], ["Wizard", "Magic User"]]) {
    const sheet = bardSheet({ sub, cls, grimoire: sub === "Wizard" ? ["Freeze"] : [] });
    const state = fightWith([sheet], [foe("Ned")], { acts: 5 });
    const { events } = turn(state, countingRng(11));
    assert.equal(sangOf(events).length, 0, `${sub}: no song`);
    assert.equal(state.combat.allies[0].sang, undefined, `${sub}: no flag`);
    assert.ok(events.length > 0, `${sub}: it acted`);
  }
});

test("IDENT-17 Joiner (non-Bards): a Joiner Soldier's and Wizard's two seeded turns are byte-identical to the base (events and main rng state), measured on baab91a2 before this plan", () => {
  // (sub, seed) -> [event count, main rng state, sha1 of the events JSON, first 12 hex], from the base tree.
  const BASE = {
    "Soldier:11": [2, -1263671329, "3010177150c7"],
    "Soldier:12": [2, -1263671328, "62c86a68f79c"],
    "Soldier:13": [2, -1263671327, "dec0ae6ef238"],
    "Wizard:11": [6, -1895506999, "c988ff19068c"],
    "Wizard:12": [6, -1263671328, "0b82ec578375"],
    "Wizard:13": [7, -1895506997, "b7fdb88f0739"],
  };
  for (const [sub, cls] of [["Soldier", "Fighter"], ["Wizard", "Magic User"]]) {
    for (const seed of [11, 12, 13]) {
      const sheet = bardSheet({ sub, cls, grimoire: sub === "Wizard" ? ["Freeze"] : [] });
      const state = fightWith([sheet], [foe("Ned"), foe("Bob")], { acts: 5 });
      const rng = makeRng(seed);
      const events = [];
      alliesTurn(state, rng, events);
      state.combat.round = 2;
      alliesTurn(state, rng, events);
      const sha = crypto.createHash("sha1").update(JSON.stringify(events)).digest("hex").slice(0, 12);
      assert.deepEqual([events.length, rng.getState(), sha], BASE[`${sub}:${seed}`], `${sub} seed ${seed}`);
    }
  }
});

// --- narration ---------------------------------------------------------------------

test("IDENT-17 Joiner: every event a Joiner song can push has an Oracle line and a rail line", () => {
  const sample = ["sang", "wardRaised", "wardAbsorbed", "wardShattered", "wardFaded", "wardReflected", "strengthCast", "sensesGained", "earthquakeSelfDamage", "deathCast", "deathSpellTooWeak"];
  for (const t of sample) {
    assert.equal(typeof EVENT_NARRATION[t], "function", `${t} has an Oracle builder`);
    assert.ok(LINE_FOR[t] !== undefined, `${t} has a rail line`);
  }
});
