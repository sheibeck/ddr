// test/unit/bard-song.test.js
//
// Phase 91 (IDENT-17, plan 91-06): the hero Bard's SING. User, 2026-09-30:
// "Let's allow this to be used once per fight as a combat action." The song's
// effect is one spell picked uniformly from every offense and protection spell
// at or below the Bard's level, resolved at full strength exactly as a Magic
// User of the Bard's level would cast it (castSpell's free mode), with a sung
// title, from one derived stream (derivedRng(cursor, "song", acts)); no charge
// is spent and the foe turn after it runs on the main rng.
//
// Task 1 pins: the pool, once per fight, full strength against a Magic User
// twin, no charges, the streams, the free mode's scope, the self-costs, the
// title, and the three edges. Task 2 appends the menu row and the bot case.

import test from "node:test";
import assert from "node:assert/strict";

import { derivedRng, makeRng } from "../../engine/rng.js";
import { songPool, songReady, sing, startCombat, endCombat, afterPlayerAction, pickFoeTarget } from "../../engine/combat.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { decideAction, makeBotContext } from "../../tools/lib/tuning-bot.mjs";
import { castSpell } from "../../engine/magic.js";
import { maxCharges } from "../../engine/movement.js";
import { applyAction } from "../../engine/engine.js";
import { SPELLS, SONG_TITLES, SONG_SCHOOLS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { heroState, foeFrom, inCombat } from "./harness/rollOdds.js";

// Same discipline as combat.test.js: the fitted dials move canon numbers.
setIdentityDials();

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const SEED = 7;

/** A level-`level` Bard in a joined fight against `foes` (an array of foe objects). */
function bardFight(level, foes, extra = {}) {
  const state = heroState({ cls: "Fighter", sub: "Bard", race: "Human", level });
  state.c.wp = state.c.maxWP = 200; // headroom for Death's fee and Earthquake's backlash
  inCombat(state, foes, extra);
  return state;
}

/** A sleeping, sturdy foe (its turn draws nothing from the main rng). */
const sleeper = (name = "Ned", wp = 80) => ({ ...foeFrom("Humans", 1, "Ned", { wp }), name, asleep: 9 });
const awake = (wp = 80) => foeFrom("Humans", 1, "Ned", { wp });

/** A main rng that counts every draw. */
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

/** The first state.acts whose derived song stream picks `spellName` at `level` (cursor = the main rng's state). */
function actsPicking(level, spellName, seed = SEED) {
  const cursor = makeRng(seed).getState();
  const pool = songPool(level);
  for (let acts = 0; acts < 20000; acts++) {
    if (pool[derivedRng(cursor, "song", acts).d(pool.length) - 1].n === spellName) return acts;
  }
  throw new Error(`no acts picks ${spellName}`);
}

// --- the pool -----------------------------------------------------------------

test("IDENT-17 pool: songPool(1) is every level-1 offense and protection spell, in SPELLS order", () => {
  const want = SPELLS.filter((sp) => (sp.s === "offense" || sp.s === "protection") && sp.lvl === 1).map((sp) => sp.n);
  assert.deepEqual(songPool(1).map((sp) => sp.n), want);
  assert.deepEqual(want, ["Shield", "Strength", "Doze", "Freeze", "Stun", "Weaken"]);
});

test("IDENT-17 pool: songPool(3) adds exactly the level 2 and 3 offense and protection spells; Special, Illusion, healing and divination never appear at any level", () => {
  const one = new Set(songPool(1).map((sp) => sp.n));
  const three = songPool(3);
  const added = three.filter((sp) => !one.has(sp.n));
  assert.ok(added.length > 0);
  assert.ok(added.every((sp) => sp.lvl === 2 || sp.lvl === 3));
  assert.deepEqual(
    three.map((sp) => sp.n),
    SPELLS.filter((sp) => SONG_SCHOOLS.includes(sp.s) && sp.lvl <= 3).map((sp) => sp.n),
  );
  for (let lvl = 1; lvl <= 5; lvl++) {
    for (const sp of songPool(lvl)) assert.ok(sp.s === "offense" || sp.s === "protection", `${sp.n} (${sp.s}) is not a song`);
  }
  const all = songPool(5).map((sp) => sp.n);
  for (const banned of ["Heal", "Major Heal", "Summon", "Mirror Self", "Map the Floor", "Sense Danger", "Open/Lock", "Fly", "Stop Time", "Door Illusion", "Chameleon Tongue", "Senseless", "Duplicate Foe", "Regeneration"]) {
    assert.equal(all.includes(banned), false, `${banned} must not be in the pool`);
  }
});

test("IDENT-17 edge (adjacency): a spell exactly at the Bard's level is in the pool and one level above is not; two titles for one spell are distinct songs", () => {
  assert.ok(songPool(2).some((sp) => sp.n === "Acid"), "Acid (level 2) is in the level-2 pool");
  assert.equal(songPool(1).some((sp) => sp.n === "Acid"), false, "...and not in the level-1 pool");
  assert.ok(songPool(4).some((sp) => sp.n === "Lightning") && !songPool(3).some((sp) => sp.n === "Lightning"));
  // Two titles for the same spell are two songs: the title list holds an old name and a template that
  // both name the same spell ("An Ode to Death" and "An Ode to {spell}" with Death), never merged.
  const ode = SONG_TITLES.filter((t) => t === "An Ode to Death" || t === "An Ode to {spell}");
  assert.equal(ode.length, 2);
  assert.equal(new Set(SONG_TITLES).size, SONG_TITLES.length, "no title is listed twice");
});

test("IDENT-17 edge (empty): the pool is never empty at level 1, over SPELLS", () => {
  assert.ok(songPool(1).length >= 1);
  assert.ok(SPELLS.some((sp) => SONG_SCHOOLS.includes(sp.s) && sp.lvl === 1));
});

test("IDENT-17 edge (ordering): the pool order is SPELLS order, so a derived pick index is stable", () => {
  for (let lvl = 1; lvl <= 5; lvl++) {
    const idxs = songPool(lvl).map((sp) => SPELL_IDX[sp.n]);
    assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b));
  }
});

// --- once per fight -----------------------------------------------------------

test("IDENT-17 once per fight: songReady is true only for a Bard in a live joined fight that has not sung; the next fight is ready again", () => {
  const state = heroState({ cls: "Fighter", sub: "Bard", race: "Human", level: 2 });
  assert.equal(songReady(state), false, "no fight");
  inCombat(state, [awake()], { pending: true });
  assert.equal(songReady(state), false, "before FIGHT");
  state.combat.pending = false;
  assert.equal(songReady(state), true);
  state.steps = 999999; // squares walked mean nothing now
  state.combat.sang = true;
  assert.equal(songReady(state), false, "sung this fight");
  endCombat(state, []);
  inCombat(state, [awake()]);
  assert.equal(songReady(state), true, "the next fight is ready again");
  const soldier = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(soldier, [awake()]);
  assert.equal(songReady(soldier), false, "a non-Bard");
});

test("IDENT-17 once per fight: a second SING in the same fight is refused sungThisFight with zero draws; before FIGHT it is notFought; a non-Bard is wrongClass", () => {
  const state = bardFight(3, [sleeper()]);
  const rng = countingRng();
  const first = sing(state, rng, []);
  assert.ok(first.some((e) => e.type === "sang"));
  assert.equal(state.combat.sang, true);
  const before = rng.count();
  const second = sing(state, rng, []);
  // Phase 91.1 plan 03 part B (V7 B, 2026-10-01): a second song is due 5 rounds after the first, so a
  // second SING straight away is refused "songResting" (rounds left carried), still with zero draws.
  assert.deepEqual(second, [{ type: "actionRefused", action: "sing", reason: "songResting", rounds: state.combat.sangAt + 5 - state.combat.round }]);
  assert.equal(rng.count(), before, "the refusal draws nothing");

  const pending = bardFight(3, [awake()], { pending: true });
  const p = sing(pending, countingRng(), []);
  assert.deepEqual(p, [{ type: "actionRefused", action: "sing", reason: "notFought" }]);
  assert.equal(pending.combat.sang, undefined, "a pending refusal never spends the song");

  const soldier = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(soldier, [awake()]);
  assert.deepEqual(sing(soldier, countingRng(), []), [{ type: "actionRefused", action: "sing", reason: "wrongClass" }]);

  const noFight = heroState({ cls: "Fighter", sub: "Bard", race: "Human" });
  assert.deepEqual(sing(noFight, countingRng(), []), [], "outside a fight there is nothing to sing at");
});

test("IDENT-17 once per fight: through applyAction a second sing is refused, and a fresh startCombat is ready again", () => {
  const state = bardFight(2, [sleeper("A"), sleeper("B")]);
  const one = applyAction(state, { type: "sing" });
  assert.ok(one.events.some((e) => e.type === "sang"));
  assert.equal(one.state.combat.sang, true);
  const two = applyAction(one.state, { type: "sing" });
  assert.ok(two.events.some((e) => e.type === "actionRefused" && e.action === "sing" && e.reason === "songResting"), "V7 B: the second song is not due yet");
  assert.equal(two.events.some((e) => e.type === "sang"), false);
  const next = structuredClone(two.state);
  endCombat(next, []);
  startCombat(next, false, "Beasts", makeRng(3), []);
  assert.equal(next.combat.sang, undefined);
  assert.equal(songReady(next), !next.combat.pending, "a new fight carries no flag");
});

// --- full strength: the same cast a Magic User of the Bard's level makes --------

test("IDENT-17 resolution: a level-3 Bard's song of Freeze is sang then exactly the events a level-3 Magic User's Freeze makes from the same stream", () => {
  const acts = actsPicking(3, "Freeze");
  const bard = bardFight(3, [sleeper("Ned", 60)]);
  bard.acts = acts;
  const events = [];
  sing(bard, makeRng(SEED), events);
  const sang = events[0];
  assert.equal(sang.type, "sang");
  assert.equal(sang.spell, "Freeze");
  assert.equal(sang.level, 1);

  // The twin: a level-3 Magic User with no school bonus (an Illusionist: offense and protection +0, as a Bard has none) with Freeze in the book, on the same song stream (past the pick and the title).
  const twin = heroState({ cls: "Magic User", sub: "Illusionist", race: "Human", level: 3 });
  twin.c.wp = twin.c.maxWP = 200;
  twin.c.grimoire = ["Freeze"];
  inCombat(twin, [sleeper("Ned", 60)]);
  twin.acts = acts; // the resist stream is keyed on state.acts as well
  const stream = derivedRng(makeRng(SEED).getState(), "song", acts);
  stream.d(songPool(3).length);
  stream.d(SONG_TITLES.length);
  const twinEvents = castSpell(twin, SPELL_IDX.Freeze, stream, [], Date.now, { afterRng: makeRng(SEED) });
  assert.deepEqual(events.slice(1), twinEvents, "the same dice, the same resist, the same foe turn");
  assert.equal(bard.combat?.foes[0].wp, twin.combat?.foes[0].wp, "the foe ends in the same state");
});

test("IDENT-17 resolution: every spell in the level-5 pool resolves as the Magic User twin resolves it (no spell is weaker as a song)", () => {
  for (const sp of songPool(5)) {
    const acts = actsPicking(5, sp.n);
    const bard = bardFight(5, [sleeper("Ned", 120), sleeper("Back", 120)]);
    bard.acts = acts;
    const events = [];
    sing(bard, makeRng(SEED), events);
    assert.equal(events[0].spell, sp.n);

    const twin = heroState({ cls: "Magic User", sub: "Illusionist", race: "Human", level: 5 });
    twin.c.wp = twin.c.maxWP = 200;
    twin.c.grimoire = [sp.n];
    inCombat(twin, [sleeper("Ned", 120), sleeper("Back", 120)]);
    twin.acts = acts; // the resist stream is keyed on state.acts as well
    const stream = derivedRng(makeRng(SEED).getState(), "song", acts);
    stream.d(songPool(5).length);
    stream.d(SONG_TITLES.length);
    const twinEvents = castSpell(twin, SPELL_IDX[sp.n], stream, [], Date.now, { afterRng: makeRng(SEED) });
    assert.deepEqual(events.slice(1), twinEvents, `${sp.n}: the song and the cast agree`);
  }
});

// --- no charges ----------------------------------------------------------------

test("IDENT-17 no charges: a song spends no spell charge, a Bard with no charges sings, and the Apprentice backfire never draws", () => {
  const bard = bardFight(3, [sleeper()]);
  bard.c.spellsUsed = 99; // far past any charge cap
  assert.ok(maxCharges(bard.c) - bard.c.spellsUsed <= 0, "no charge is left, and the song does not need one");
  const before = bard.c.spellsUsed;
  const events = sing(bard, makeRng(SEED), []);
  assert.ok(events.some((e) => e.type === "sang"));
  assert.equal(events.some((e) => e.type === "noChargesLeft"), false);
  assert.equal(bard.c.spellsUsed, before, "spellsUsed is untouched");

  // castSpell's free mode on an Apprentice with a book that lacks the spell: no refusal, no backfire draw.
  const app = heroState({ cls: "Magic User", sub: "Apprentice", race: "Human", level: 3 });
  inCombat(app, [sleeper()]);
  app.c.grimoire = [];
  app.c.spellsUsed = 99;
  const draws = [];
  const probe = {
    d: (s) => { draws.push(s); return 2; },
    pick: (a) => a[0],
    getState: () => 0,
  };
  castSpell(app, SPELL_IDX.Shield, probe, [], Date.now, { free: true, afterRng: makeRng(SEED) });
  assert.equal(draws.includes(8), false, "no d8 backfire roll on a free cast");
  assert.ok(app.c.ward, "the Shield landed from an empty book with no charges");
});

// --- the streams ---------------------------------------------------------------

test("IDENT-17 streams: the song draws nothing from the main rng; a sung song reproduces from derivedRng(cursor, 'song', acts)", () => {
  // A sleeping foe: its turn draws nothing, so any main draw would be the song's.
  for (const name of ["Shield", "Strength", "Doze", "Freeze", "Stun", "Weaken", "Insane", "Ice", "Fireball", "Noxious Vapor"]) {
    const lvl = SPELLS[SPELL_IDX[name]].lvl;
    const level = Math.max(lvl, 4);
    const acts = actsPicking(level, name);
    const bard = bardFight(level, [sleeper("A"), sleeper("B")]);
    bard.acts = acts;
    const rng = countingRng();
    sing(bard, rng, []);
    assert.equal(rng.count(), 0, `${name}: the main rng is untouched by the song`);
  }
  // Reproduces: the same state, acts and cursor give the same song.
  const run = () => {
    const bard = bardFight(4, [sleeper("A"), sleeper("B")]);
    bard.acts = 12;
    return sing(bard, makeRng(SEED), []);
  };
  assert.deepEqual(run(), run());
  const cursor = makeRng(SEED).getState();
  const stream = derivedRng(cursor, "song", 12);
  const pool = songPool(4);
  const sp = pool[stream.d(pool.length) - 1];
  const raw = SONG_TITLES[stream.d(SONG_TITLES.length) - 1];
  const sang = run()[0];
  assert.equal(sang.spell, sp.n);
  assert.equal(sang.title, raw.replace("{spell}", sp.n));
});

test("IDENT-17 streams: the foe turn after the song runs on the main rng exactly as after any other action", () => {
  const acts = actsPicking(1, "Shield");
  const withSong = bardFight(1, [awake(40)]);
  withSong.acts = acts;
  const rngA = countingRng();
  sing(withSong, rngA, []);
  // The baseline: the same state, the same ward, then a bare afterPlayerAction on the same main stream.
  const bare = bardFight(1, [awake(40)]);
  const shield = SPELLS[SPELL_IDX.Shield];
  bare.c.ward = { pool: shield.pool, rounds: shield.rounds, name: "Shield" };
  const rngB = countingRng();
  afterPlayerAction(bare, rngB, []);
  assert.ok(rngA.count() > 0, "an awake foe takes its turn on the main rng");
  assert.equal(rngA.count(), rngB.count(), "the same main draws as any other action's foe turn");
});

// --- the free mode is scoped ---------------------------------------------------

test("IDENT-17 free mode is scoped: a plain castSpell still refuses a spell not in the book, still spends a charge, and still draws the Apprentice backfire", () => {
  const wiz = heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 3 });
  inCombat(wiz, [sleeper()]);
  wiz.c.grimoire = [];
  const refused = castSpell(wiz, SPELL_IDX.Shield, makeRng(SEED), []);
  assert.ok(refused.some((e) => e.type === "spellNotKnown"));
  assert.equal(wiz.c.spellsUsed, 0);

  wiz.c.grimoire = ["Shield"];
  castSpell(wiz, SPELL_IDX.Shield, makeRng(SEED), []);
  assert.equal(wiz.c.spellsUsed, 1, "a charge is spent");

  const app = heroState({ cls: "Magic User", sub: "Apprentice", race: "Human", level: 3 });
  inCombat(app, [sleeper()]);
  app.c.grimoire = ["Shield"];
  const draws = [];
  const probe = { d: (s) => { draws.push(s); return 5; }, pick: (a) => a[0], getState: () => 0 };
  castSpell(app, SPELL_IDX.Shield, probe, [], Date.now);
  assert.ok(draws.includes(8), "the Apprentice backfire d8 is still drawn on an ordinary cast");
});

// --- the self-costs ------------------------------------------------------------

test("IDENT-17 self-costs: a song that picks Earthquake hurts the Bard as the spell hurts its caster; a song that picks Death costs the Bard 25 HP", () => {
  const quakeActs = actsPicking(4, "Earthquake");
  const bard = bardFight(4, [sleeper("A"), sleeper("B")]);
  bard.acts = quakeActs;
  const hp = bard.c.wp;
  const events = sing(bard, makeRng(SEED), []);
  assert.ok(events.some((e) => e.type === "earthquakeSelfDamage"), "Earthquake's backlash lands on the singer");
  assert.ok(bard.c.wp < hp);

  const deathActs = actsPicking(5, "Death");
  const b2 = bardFight(5, [sleeper("A"), sleeper("B")]);
  b2.acts = deathActs;
  const hp2 = b2.c.wp;
  const ev2 = sing(b2, makeRng(SEED), []);
  assert.ok(ev2.some((e) => e.type === "deathCast" && e.cost === 25));
  assert.equal(b2.c.wp, hp2 - 25);
});

test("IDENT-17 self-costs: a sung Death the Bard cannot afford fizzles, spends the song, and gives no charge back", () => {
  const acts = actsPicking(5, "Death");
  const bard = bardFight(5, [awake(40)]);
  bard.c.wp = 20;
  bard.acts = acts;
  const spent = bard.c.spellsUsed;
  const events = sing(bard, makeRng(SEED), []);
  assert.ok(events.some((e) => e.type === "deathSpellTooWeak"));
  assert.equal(bard.c.spellsUsed, spent, "no charge to refund, none went negative");
  assert.equal(bard.combat?.sang ?? true, true, "the song is spent");
});

// --- the title -----------------------------------------------------------------

test("IDENT-17 title: the sang title is one SONG_TITLES entry with {spell} replaced by the spell's name; an entry without a slot is used as is", () => {
  const seen = new Set();
  for (let acts = 0; acts < 400; acts++) {
    const bard = bardFight(5, [sleeper("A"), sleeper("B")]);
    bard.acts = acts;
    const sang = sing(bard, makeRng(SEED), [])[0];
    const matches = SONG_TITLES.some((t) => t.replace("{spell}", sang.spell) === sang.title);
    assert.ok(matches, `${sang.title} is a SONG_TITLES entry`);
    assert.equal(sang.title.includes("{spell}"), false);
    seen.add(SONG_TITLES.find((t) => t.replace("{spell}", sang.spell) === sang.title));
  }
  assert.ok([...seen].some((t) => !t.includes("{spell}")), "an old name is used as is");
  assert.ok([...seen].some((t) => t.includes("{spell}")), "a templated title names its spell");
});

test("IDENT-17 edge (empty): a song whose spell has nothing to affect (Turn Walking Dead against Beasts) resolves as the spell would, does nothing, and the song is still spent", () => {
  const acts = actsPicking(2, "Turn Walking Dead");
  const bard = bardFight(2, [sleeper("A")]);
  bard.acts = acts;
  const events = sing(bard, makeRng(SEED), []);
  assert.equal(events[0].spell, "Turn Walking Dead");
  assert.ok(events.some((e) => e.type === "nothingToTurn"));
  assert.equal(bard.combat.sang, true, "the song is spent");
});

test("IDENT-17 edge (ordering): the sang event comes first, then the spell's own events, then the foe turn", () => {
  const acts = actsPicking(1, "Weaken");
  const bard = bardFight(1, [awake(60)]);
  bard.acts = acts;
  const events = sing(bard, makeRng(SEED), []);
  assert.equal(events[0].type, "sang");
  const weakened = events.findIndex((e) => e.type === "weakened");
  assert.ok(weakened > 0, "Weaken's own event follows the song");
  const foeAct = events.findIndex((e, i) => i > weakened && (e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "foeStruck" || e.type === "foeSwing"));
  assert.ok(foeAct === -1 || foeAct > weakened, "any foe action comes after the spell");
});

// ============================================================================
// Task 2 (plan 91-06): the combat menu row, the bot, the drawback.
// ============================================================================

test("IDENT-17 menu: the SING row is enabled while songReady, says READY, then SPENT THIS FIGHT, and describes the song in plain words", () => {
  const state = bardFight(3, [sleeper()]);
  const ready = combatMenuViewModel(state);
  const readyRow = ready.submenus.abilities.rows[0];
  assert.equal(readyRow.id, "sing");
  assert.equal(readyRow.cost, "READY");
  assert.equal(readyRow.enabled, true);
  assert.equal(ready.actions[1].sub, "SING · READY");
  assert.equal(readyRow.desc, COMBAT_MENU_COPY.singDesc);
  assert.match(readyRow.desc, /second song 5 rounds after the first/); // V7 B (91.1-03): was "Once per fight"
  assert.match(readyRow.desc, /random offense or defense spell of your level or lower/);
  assert.match(readyRow.desc, /full strength/);
  assert.match(readyRow.desc, /no charges spent/);

  sing(state, makeRng(SEED), []);
  assert.equal(state.combat.sang, true);
  const sung = combatMenuViewModel(state);
  const sungRow = sung.submenus.abilities.rows[0];
  // V7 B (91.1-03): between the two songs the row counts the rounds left; the spent words are after the second (or a bare sang flag).
  // Phase 94 (ASTATE-02): the count reads READY IN N (was AGAIN IN N) and the spent words SPENT THIS FIGHT (was SUNG THIS FIGHT).
  assert.equal(sungRow.cost, `READY IN ${state.combat.sangAt + 5 - state.combat.round}`);
  assert.equal(sungRow.enabled, false);
  assert.equal(sung.actions[1].sub, "SING · SUNG");
});

test("IDENT-17 bot: a Bard sings once in every fight (round 1, before its strike logic) and never again in that fight", () => {
  const policyRng = { pick: (arr) => arr[0] };
  const ctx = makeBotContext();
  const dead = (name) => ({ ...sleeper(name, 200), type: "Walking Dead" }); // a Bard talks to Humans first
  const state = bardFight(2, [dead("A")]);
  const first = decideAction(state, policyRng, ctx);
  assert.deepEqual(first, { type: "sing" });
  const after = applyAction(state, first);
  assert.equal(after.state.combat.sang, true);
  const second = decideAction(after.state, policyRng, ctx);
  assert.notEqual(second.type, "sing", "never again in the same fight");
  // The next fight sings again.
  const next = structuredClone(after.state);
  endCombat(next, []);
  inCombat(next, [dead("B")]);
  assert.deepEqual(decideAction(next, policyRng, ctx), { type: "sing" });
});

test("IDENT-17 drawback: foes with intelligence 3 or less always attack the Bard when a Joiner is in the fight; a Stupidity'd foe (intelligence 1) counts; intelligence 4 does not", () => {
  const bard = bardFight(3, [awake()]);
  bard.combat.allies = [{ partyIdx: 0, name: "Ada", wp: 20, maxWP: 20 }];
  const foe = (intel, extra = {}) => ({ ...awake(), intel, ...extra });
  const pick = (f, d) => pickFoeTarget(bard, { d: () => d, pick: (a) => a[0] }, f);
  assert.equal(pick(foe(3), 2), null, "intelligence 3: the Bard, even when the pick die points at the Joiner");
  assert.equal(pick(foe(1), 2), null, "intelligence 1");
  assert.equal(pick(foe(1, { stupid: true }), 2), null, "a Stupidity'd foe (intelligence 1, stupid) comes for the Bard");
  assert.equal(pick(foe(4), 2)?.name, "Ada", "intelligence 4 is not too stupid");
  // No Joiner in the fight: nothing to override.
  const solo = bardFight(3, [awake()]);
  assert.equal(pickFoeTarget(solo, { d: () => 1, pick: (a) => a[0] }, foe(1)), null);
});
