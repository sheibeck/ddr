// test/unit/authored-ranges.test.js
//
// Phase 79 (ROLL-04), plan 79-05 — every range or face count an authored
// content text states is pinned to the engine rule it describes. Each row
// builds a small state carrying the condition the text names (Mirror Self
// up, Smoke up, Weaken on the room, an insult, a Locks tier, lockpicks in
// the bag), reads the winning faces from the engine's OWN functions (the
// ones combat and the lock check call), and asserts the text states them.
//
// The phrasing rule (79-CONTEXT, docs/narrative-pass/README.md):
//   - a FIXED die (the d10 lock check) states the Phase 74 range, written
//     by src/browser/rollRange.js#facesRangeText ("6–10");
//   - a die that SCALES speaks in faces. The hero's strike die runs d20 to
//     d6 with level, and a foe's strike die runs d20 to d8 with the foe's
//     level (engine/derived.js#strikeDie, #foeDie), so a face NUMBER would
//     be wrong at most levels: "their die's top face", "two fewer faces".
//     The first block proves both dice really scale, which is why those
//     rows are faces rows.
//
// A mishap on a 1 is roll-high canon and is never a row here.
//
// Local fixture copies (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/
// fixedCombat) mirror test/unit/odds-helpers.test.js — this repo's
// per-file-fixture convention (never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";

import {
  foeToHitVs,
  foeSwingVsHero,
  targetStrikeFaces,
  strikeDie,
  foeDie,
  weaponDamage,
  sizeAxisStep,
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
} from "../../engine/derived.js";
import { playerStrike } from "../../engine/combat.js";
import { useAbility } from "../../engine/abilities.js";
import { openChest } from "../../engine/encounters.js";
import { openStore } from "../../engine/economy.js";
import { rollTreasureItem } from "../../engine/items.js";
import { facesRangeText } from "../../src/browser/rollRange.js";
import {
  SPELLS, ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS, BESTIARY, POTIONS, JEWELRY, CLOAKS, STAVES,
} from "../../content/index.js";

// --- local fixtures (mirror test/unit/odds-helpers.test.js) ---------------

function fakeRng(seq, fill) {
  let i = 0;
  return {
    d(_sides) {
      if (i < seq.length) return seq[i++];
      if (fill !== undefined) return fill;
      throw new Error(`fakeRng: sequence exhausted at index ${i}`);
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, intel: 10, timers: {},
    ...overrides,
  };
}

function fixedFloor() {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1 };
}

function fixedState(cOverrides = {}, rest = {}) {
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/** A live `ability:<key>` effect record (Phase 36's c.timers shape). */
const abilityTimer = (key) => ({ [`ability:${key}`]: { cadence: "rounds", left: 2, phase: "effect", cd: 5 } });
/** A live `item:<name>` effect record (Phase 39's c.timers shape). */
const itemTimer = (name) => ({ [`item:${name}`]: { cadence: "squares", left: 10, phase: "effect", cd: 0 } });

// --- the words a faces row is written in ------------------------------------

const WORD = ["zero", "one", "two", "three", "four", "five", "six"];
/** topFaces(n) — "top face" for 1, else "top two faces" (the phrase a faces row states). */
const topFaces = (n) => (n === 1 ? "top face" : `top ${WORD[n]} faces`);
/** fewerFaces(n) — "one face fewer" / "two fewer faces" (a shrinking range). */
const fewerFaces = (n) => (n === 1 ? "one face fewer" : `${WORD[n]} fewer faces`);

// --- the content rows under test -------------------------------------------

const spell = (n) => SPELLS.find((s) => s.n === n).txt;
const potion = (n) => POTIONS.find((p) => p.n === n).txt;
const row = (table, n) => table.find((r) => r.n === n).txt;
const foeNote = (n) => {
  for (const tiers of Object.values(BESTIARY)) {
    for (const cell of tiers) {
      const list = Array.isArray(cell) ? cell : [cell];
      for (const f of list) if (f && f.n === n) return f;
    }
  }
  throw new Error(`no bestiary row ${n}`);
};

// ---------------------------------------------------------------------------
// 0. Why the strike rows speak in faces: both strike dice scale.
// ---------------------------------------------------------------------------

test("the hero's and a foe's strike dice both scale with level (so those texts speak in faces)", () => {
  const heroDice = new Set([1, 2, 3, 4, 5].map((level) => strikeDie(fixedFighter({ level }))));
  const foeDice = new Set([1, 2, 3, 4, 5].map((lvl) => foeDie(fixedFighter(), { lvl })));
  assert.ok(heroDice.size > 1, `hero strike die should scale, got ${[...heroDice]}`);
  assert.ok(foeDice.size > 1, `foe strike die should scale, got ${[...foeDice]}`);
});

// ---------------------------------------------------------------------------
// 1. "Only their die's top face": Mirror Self, Smoke, invisibility.
// ---------------------------------------------------------------------------

/** The hero-side faces a foe swings with, plain and insulted, under `cOverrides`. */
function foeFacesVsHero(cOverrides) {
  const foe = fixedFoe();
  const plain = fixedState(cOverrides, { combat: fixedCombat([foe]) });
  const insulted = fixedState(cOverrides, { combat: fixedCombat([foe], { parleyInsulted: true }) });
  return { plain: foeSwingVsHero(plain, foe).faces, insulted: foeSwingVsHero(insulted, foe).faces };
}

const TOP_FACE_ROWS = [
  { id: "SPELLS.Mirror Self.txt", text: () => spell("Mirror Self"), c: { mirror: 3 } },
  { id: "ABILITIES.smoke.txt", text: () => ABILITY_BY_ID.smoke.txt, c: { cls: "Thief", sub: "Burglar", timers: abilityTimer("smoke") } },
  { id: "THIEF_SKILLS.Smoke.txt", text: () => THIEF_SKILLS.Smoke.txt, c: { cls: "Thief", sub: "Burglar", timers: abilityTimer("smoke") } },
  { id: "STAVES.Crystal Staff.txt", text: () => row(STAVES, "Crystal Staff"), c: { timers: itemTimer("Crystal Staff") } },
  { id: "CLOAKS.Cloak of Invisibility.txt", text: () => row(CLOAKS, "Cloak of Invisibility"), c: { timers: itemTimer("Cloak of Invisibility") } },
  { id: "POTIONS.Invisible.txt", text: () => potion("Invisible"), c: { timers: itemTimer("Invisible") } },
];

for (const r of TOP_FACE_ROWS) {
  test(`${r.id} states the foe's winning faces, plain and insulted, from the engine`, () => {
    const { plain, insulted } = foeFacesVsHero(r.c);
    // Sanity: the condition really is live (without it a foe has more faces).
    assert.ok(foeFacesVsHero({}).plain > plain, "the condition should narrow the foe's faces");
    const txt = r.text();
    assert.match(txt, new RegExp(`their die's ${topFaces(plain)}\\b`), `${r.id}: "${txt}" should state ${topFaces(plain)}`);
    assert.ok(txt.includes(`the ${topFaces(insulted)} if you insulted them`), `${r.id}: "${txt}" should state the insulted ${topFaces(insulted)}`);
  });
}

// ---------------------------------------------------------------------------
// 2. Weaken: a cap on every foe's faces.
// ---------------------------------------------------------------------------

test("SPELLS.Weaken.txt states the cap Weaken puts on every foe's faces", () => {
  const foe = fixedFoe();
  // Across heroes whose foes start above, at and below the cap, Weaken never
  // leaves a foe more than the stated faces (and leaves a lower count alone).
  let cap = 0;
  for (const c of [{}, { sub: "Guard" }, { sub: "Acrobat" }, { mirror: 2 }]) {
    const before = foeSwingVsHero(fixedState(c, { combat: fixedCombat([foe]) }), foe).faces;
    const after = foeSwingVsHero(fixedState(c, { combat: fixedCombat([foe], { foeToHitPenalty: 3 }) }), foe).faces;
    assert.equal(after, Math.min(before, 3));
    cap = Math.max(cap, after);
  }
  assert.equal(cap, 3);
  assert.ok(spell("Weaken").includes(`no more than their die's ${topFaces(cap)} hit`), spell("Weaken"));
});

// ---------------------------------------------------------------------------
// 3. "N fewer faces": Battle Roar, Sidestep, the Anklet, Overhead Blow.
// ---------------------------------------------------------------------------

const FEWER_ROWS = [
  { id: "ABILITIES.battleRoar.txt", text: () => ABILITY_BY_ID.battleRoar.txt, c: { timers: abilityTimer("battleRoar") }, phrase: "that hit anyone on your side" },
  { id: "FIGHTER_SKILLS.Battle Roar.txt", text: () => FIGHTER_SKILLS["Battle Roar"].txt, c: { timers: abilityTimer("battleRoar") }, phrase: "that hit anyone on your side" },
  { id: "ABILITIES.sidestep.txt", text: () => ABILITY_BY_ID.sidestep.txt, c: { timers: abilityTimer("sidestep") }, phrase: "that hit you" },
  { id: "FIGHTER_SKILLS.Sidestep.txt", text: () => FIGHTER_SKILLS.Sidestep.txt, c: { timers: abilityTimer("sidestep") }, phrase: "that hit you" },
  { id: "JEWELRY.Anklet of Invisibility.txt", text: () => row(JEWELRY, "Anklet of Invisibility"), c: { timers: itemTimer("Anklet of Invisibility") }, phrase: "that hit you" },
];

for (const r of FEWER_ROWS) {
  test(`${r.id} states how many faces the foe loses, from the engine`, () => {
    const base = foeToHitVs(fixedState({}));
    const under = foeToHitVs(fixedState(r.c));
    const lost = base - under;
    assert.ok(base - lost >= 1 && lost > 0, `a base of ${base} faces should show the full shift`);
    const txt = r.text();
    assert.ok(txt.includes(`every foe has ${fewerFaces(lost)} ${r.phrase}`), `${r.id}: "${txt}" should state ${fewerFaces(lost)}`);
  });
}

test("ABILITIES.overheadBlow.txt states how many faces the hero's own swing loses", () => {
  const foe = fixedFoe();
  const state = fixedState({ abilities: ["overheadBlow"] }, { combat: fixedCombat([foe]) });
  const events = [];
  // A raw draw equal to the die's sides mirrors to a roll of 1: a sure miss,
  // so the strike event carries its mods and draws nothing else.
  useAbility(state, "overheadBlow", fakeRng([], 20), events);
  const strike = events.find((e) => e.type === "strikeMissed" || e.type === "struck");
  assert.ok(strike, `a strike event, got ${events.map((e) => e.type)}`);
  const mod = (strike.mods || []).find((m) => m.name === "overhead");
  assert.ok(mod, `an overhead mod, got ${JSON.stringify(strike.mods)}`);
  const lost = -mod.delta;
  assert.ok(ABILITY_BY_ID.overheadBlow.txt.includes(`your die has ${fewerFaces(lost)} that land it`), ABILITY_BY_ID.overheadBlow.txt);
});

// ---------------------------------------------------------------------------
// 4. Stealth: the opening crit on the strike die's top faces.
// ---------------------------------------------------------------------------

test("FIGHTER_SKILLS.Stealth.txt states the top faces a Stealth opener crits on", () => {
  // Walk down from the top face: the Stealth crit fires on exactly the top
  // `n` faces of the hero's strike die (a Club crits on the top face alone,
  // so any crit below that is Stealth's own).
  // A Woodsman: a Soldier or Guard never crits at all (noCritFor).
  const hero = { sub: "Woodsman", skills: { Stealth: 1 } };
  const dieN = strikeDie(fixedFighter(hero));
  let n = 0;
  for (let roll = dieN; roll >= dieN - 5; roll--) {
    const state = fixedState(hero, { combat: fixedCombat([fixedFoe()]) });
    const events = [];
    playerStrike(state, fakeRng([dieN + 1 - roll], 1), events);
    if (events.some((e) => e.type === "stealthStrike")) n++;
    else break;
  }
  assert.ok(n > 0, "Stealth should crit on the top face at least");
  assert.ok(FIGHTER_SKILLS.Stealth.txt.includes(`critical on your die's ${topFaces(n)}`), FIGHTER_SKILLS.Stealth.txt);
});

// ---------------------------------------------------------------------------
// 5. The d10 lock check: Locks (both tiers), the Lockpicks item and store row.
// ---------------------------------------------------------------------------

/** The winning range of the chest's lock roll (a fixed d10) for `cOverrides`. */
function lockRange(cOverrides) {
  const state = fixedState(cOverrides);
  const events = [];
  // Draw 10 mirrors to a roll of 1: the lock stays shut and nothing else draws.
  openChest(state, fakeRng([10]), events);
  const ev = events.find((e) => e.type === "chestLockRolled");
  assert.ok(ev, `a chestLockRolled event, got ${events.map((e) => e.type)}`);
  assert.equal(ev.dieN, 10);
  return facesRangeText(ev.dieN + 1 - ev.atLeast, ev.dieN);
}

const LOCKPICKS = { kind: "picks", n: "Lockpicks", txt: "" };

test("THIEF_SKILLS.Locks.txt and .txt2 state the lock check's d10 range per tier", () => {
  const t1 = lockRange({ cls: "Thief", sub: "Burglar", skills: { Locks: 1 } });
  const t2 = lockRange({ cls: "Thief", sub: "Burglar", skills: { Locks: 2 } });
  assert.ok(THIEF_SKILLS.Locks.txt.includes(`${t1} on d10`), `${THIEF_SKILLS.Locks.txt} vs ${t1}`);
  assert.ok(THIEF_SKILLS.Locks.txt2.includes(`${t2} on d10`), `${THIEF_SKILLS.Locks.txt2} vs ${t2}`);
});

test("the Lockpicks item text (engine/items.js) and store row (engine/economy.js) state the picks' d10 range", () => {
  const range = lockRange({ items: [LOCKPICKS] });
  // engine/items.js#rollTreasureItem's Lockpicks drop: a d12 face of 1 picks it.
  const found = rollTreasureItem(fakeRng([1], 1), 1, fixedFighter());
  assert.equal(found.kind, "picks");
  assert.ok(found.txt.includes(`${range} on d10`), `${found.txt} vs ${range}`);
  // engine/economy.js#openStore's lockpick row: the item text and the row line.
  const state = fixedState({ gold: 99999 });
  openStore(state, fakeRng([], 1), []);
  const picks = state.store.stock.find((s) => s.effectParams && s.effectParams.item && s.effectParams.item.kind === "picks");
  assert.ok(picks, "the store lists a lockpick row");
  assert.ok(picks.effectParams.item.txt.includes(`${range} on d10`), `${picks.effectParams.item.txt} vs ${range}`);
  assert.ok(picks.sub.includes(`opens boxes on ${range}`), `${picks.sub} vs ${range}`);
});

// ---------------------------------------------------------------------------
// 6. Bestiary notes that state a face count: the hero's strike against them.
// ---------------------------------------------------------------------------

test("BESTIARY notes with a to-hit cap state it as the strike die's top faces", () => {
  for (const n of ["Zit", "Stink Bug"]) {
    const f = foeNote(n);
    const cap = targetStrikeFaces(fixedFighter(), fixedFoe({ sp: f.sp }), 20);
    assert.equal(cap, f.sp.toHit);
    assert.ok(f.sp.note.includes(`at best your die's ${topFaces(cap)} hit it`), `${n}: "${f.sp.note}"`);
  }
});

test("BESTIARY.Pogo.sp.note states the face its speed takes off your die", () => {
  const f = foeNote("Pogo");
  const lost = 5 - targetStrikeFaces(fixedFighter(), fixedFoe({ sp: f.sp }), 5);
  assert.ok(f.sp.note.includes(`your die has ${fewerFaces(lost)} that hits it`), f.sp.note);
});

// ---------------------------------------------------------------------------
// 7. Signed numbers in content text agree with the engine (+ is better for
//    the player; Phase 74's sign rule). A mismatch is fixed in the text.
// ---------------------------------------------------------------------------

const SIGNED_ROWS = [
  { id: "BESTIARY.Wolf.sp.note", text: () => foeNote("Wolf").sp.note, signed: "+2 damage", engine: () => foeNote("Wolf").sp.dmg.bonus, value: 2 },
  { id: "BESTIARY.Gremlin.sp.note", text: () => foeNote("Gremlin").sp.note, signed: "+3 damage", engine: () => foeNote("Gremlin").sp.dmg.bonus, value: 3 },
  { id: "BESTIARY.Pogo.sp.note", text: () => foeNote("Pogo").sp.note, signed: "+4 damage", engine: () => foeNote("Pogo").sp.dmg.bonus, value: 4 },
  { id: "BESTIARY.Rast.sp.note", text: () => foeNote("Rast").sp.note, signed: "+4 with any weapon", engine: () => foeNote("Rast").sp.dmg.bonus, value: 4 },
  { id: "POTIONS.Strength.txt", text: () => potion("Strength"), signed: "+8 damage", engine: () => POTIONS.find((p) => p.n === "Strength").act.might, value: 8 },
  { id: "JEWELRY.Ring of Power.txt", text: () => row(JEWELRY, "Ring of Power"), signed: "+1 damage", engine: () => JEWELRY.find((p) => p.n === "Ring of Power").eff.dmg, value: 1 },
  { id: "POTIONS.Enlarge.txt", text: () => potion("Enlarge"), signed: "+2 damage", engine: () => SIZE_DAMAGE_PER_STEP * sizeAxisStep(fixedFighter({ timers: itemTimer("Enlarge") }), "dmg"), value: 2 },
  { id: "JEWELRY.Gauntlet of the Giant.txt", text: () => row(JEWELRY, "Gauntlet of the Giant"), signed: "+2 damage", engine: () => SIZE_DAMAGE_PER_STEP * sizeAxisStep(fixedFighter({ timers: itemTimer("Gauntlet of the Giant") }), "dmg"), value: 2 },
  { id: "THIEF_SKILLS.Heft.txt", text: () => THIEF_SKILLS.Heft.txt, signed: "+2 damage", engine: () => weaponDamage(fixedFighter({ skills: { Heft: 1 } }), fakeRng([], 1)) - weaponDamage(fixedFighter(), fakeRng([], 1)), value: 2 },
  { id: "ABILITIES.mark.txt", text: () => ABILITY_BY_ID.mark.txt, signed: "+2 damage", engine: () => markedStrike(true) - markedStrike(false), value: 2 },
];

/** markedStrike(marked) — the damage one fixed landed blow (a raw 2: a hit, no crit) does to a marked or unmarked foe. */
function markedStrike(marked) {
  const state = fixedState({ sub: "Woodsman" }, { combat: fixedCombat([fixedFoe({ marked })], { opened2: true }) });
  const events = [];
  playerStrike(state, fakeRng([2], 1), events);
  return events.find((e) => e.type === "struck").dmg;
}

for (const r of SIGNED_ROWS) {
  test(`${r.id}: its signed number agrees with the engine`, () => {
    assert.equal(r.engine(), r.value, `${r.id}: the engine's value`);
    assert.ok(r.text().includes(r.signed), `${r.id}: "${r.text()}" should state ${r.signed}`);
  });
}

test("every signed number in a bestiary note is that foe's own damage bonus", () => {
  for (const tiers of Object.values(BESTIARY)) {
    for (const cell of tiers) {
      for (const f of Array.isArray(cell) ? cell : [cell]) {
        const note = f && f.sp && f.sp.note;
        if (!note) continue;
        for (const m of note.matchAll(/([+−])(\d+)/g)) {
          const n = (m[1] === "+" ? 1 : -1) * Number(m[2]);
          assert.equal((f.sp.dmg && f.sp.dmg.bonus) || 0, n, `${f.n}: "${note}" states ${m[0]}`);
        }
      }
    }
  }
});

test("Enlarge and the Gauntlet state the size step's face change for foes", () => {
  assert.equal(SIZE_FACES_PER_STEP, 1);
  assert.ok(potion("Enlarge").includes("one face easier for foes to hit"));
  assert.ok(row(JEWELRY, "Gauntlet of the Giant").includes("one face easier for foes to hit"));
});
