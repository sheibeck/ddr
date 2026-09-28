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
// Plan 79-12 (section 8) extends the pins outside content/: the narration
// lines, chip sentences, menu and panel copy Phase 79 wrote, each computed
// from the engine, plus a coverage guard over the live corpus that names
// the test pinning every other stated face count or fixed-die range
// (blurbs, the legend, the trap epitaph).
//
// Local fixture copies (fakeRng/fixedFighter/fixedFloor/fixedState/fixedFoe/
// fixedCombat) mirror test/unit/odds-helpers.test.js — this repo's
// per-file-fixture convention (never imported cross-file).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  foeToHitVs,
  foeSwingVsHero,
  targetStrikeFaces,
  heroStrikeFacesVs,
  strikeDie,
  foeDie,
  weaponDamage,
  sizeAxisStep,
  SIZE_DAMAGE_PER_STEP,
  SIZE_FACES_PER_STEP,
} from "../../engine/derived.js";
import { playerStrike, parley, FREEZE_HOLD_DIE } from "../../engine/combat.js";
import { actsWhere } from "./harness/spellResistActs.js";
import { drinkPotion, castSpell } from "../../engine/magic.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { FOE_CONDITION_DESC } from "../../src/browser/foeConditions.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { GEAR_COPY } from "../../src/browser/gearTab.js";
import { buildCorpus } from "../../tools/lib/voice-corpus.mjs";

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
import { useAbility } from "../../engine/abilities.js";
import { openChest } from "../../engine/encounters.js";
import { openStore } from "../../engine/economy.js";
import { rollTreasureItem } from "../../engine/items.js";
import { facesRangeText, hitRangeText } from "../../src/browser/rollRange.js";
// Quick 260927-rsx / 260928-hrs: the one resist scale (both sides) and the
// foe card copy.
import { resistFaces, resistRoll } from "../../engine/derived.js";
import { FOE_DETAILS_COPY } from "../../src/browser/foeDetails.js";
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

// ---------------------------------------------------------------------------
// 8. Outside content (Phase 79, plan 79-12): the narration lines, chip
//    sentences, menu and panel copy, blurbs, legend and epitaphs Phase 79
//    rewrote. Every corpus string (tools/lib/voice-corpus.mjs) outside
//    content/ that states a face count or a fixed-die range is either pinned
//    to the engine here or named with the test file that pins it, so a new
//    one cannot slip in unpinned.
// ---------------------------------------------------------------------------

const html = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

/** conditionExplain() — mazeworld.html's classic-script CONDITION_EXPLAIN, key → sentence. */
function conditionExplain() {
  const start = html.indexOf("const CONDITION_EXPLAIN = {");
  assert.ok(start >= 0, "mazeworld.html should declare CONDITION_EXPLAIN");
  const end = html.indexOf("\n};", start);
  const out = {};
  for (const m of html.slice(start, end).matchAll(/^\s*(\w+): "((?:[^"\\]|\\.)*)",?\s*$/gm)) out[m[1]] = m[2];
  return out;
}
const EXPLAIN = conditionExplain();

/** statedTop(text) — "top face" 1, "top N faces" N; every occurrence in order. */
const statedTop = (text) => [...String(text).replace(/<[^>]+>/g, " ").matchAll(/\btop(?: (one|two|three|four|five|six)\b)?(?: faces?\b)?/g)].map((m) => (m[1] ? WORD.indexOf(m[1]) : 1));
const plainText = (html_) => String(html_).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("CONDITION_EXPLAIN and itemEffectStarted: invisibility's 'very best roll' and 'top face (top two)' are the foe's measured faces", () => {
  const { plain, insulted } = foeFacesVsHero({ timers: itemTimer("Cloak of Invisibility") });
  assert.equal(plain, 1, "only the foe's top face finds an invisible hero");
  // "only a foe's very best roll" names exactly one face.
  assert.match(EXPLAIN.invis, /only a foe's very best roll finds you/);
  assert.equal(foeFacesVsHero({ mirror: 3 }).plain, 1);
  assert.match(EXPLAIN.mirror, /only a foe's very best roll finds the real you/);
  const ev = { type: "itemEffectStarted", kind: "invis", item: "Cloak of Invisibility", left: 3 };
  assert.deepEqual(statedTop(EVENT_NARRATION.itemEffectStarted(ev)), [plain, insulted], plainText(EVENT_NARRATION.itemEffectStarted(ev)));
  assert.deepEqual(statedTop(LINE_FOR.itemEffectStarted(ev, {}).text), [plain, insulted], LINE_FOR.itemEffectStarted(ev, {}).text);
});

test("CONDITION_EXPLAIN.unseen and itemEffectStarted (unseen): the Anklet's 'two fewer faces' is the engine's shift", () => {
  const lost = foeToHitVs(fixedState({})) - foeToHitVs(fixedState({ timers: itemTimer("Anklet of Invisibility") }));
  const phrase = `${fewerFaces(lost)} that hit you`;
  assert.ok(EXPLAIN.unseen.includes(`Every foe has ${phrase}`), EXPLAIN.unseen);
  const ev = { type: "itemEffectStarted", kind: "unseen", item: "Anklet of Invisibility", left: 3 };
  assert.ok(plainText(EVENT_NARRATION.itemEffectStarted(ev)).includes(phrase), plainText(EVENT_NARRATION.itemEffectStarted(ev)));
  assert.ok(LINE_FOR.itemEffectStarted(ev, {}).text.includes(phrase), LINE_FOR.itemEffectStarted(ev, {}).text);
});

test("CONDITION_EXPLAIN.acute and itemEffectStarted (acute): 'you strike on a d6' is the strike die Acuteness sets", () => {
  const die = strikeDie(fixedFighter({ timers: itemTimer("Acuteness") }));
  assert.ok(die < strikeDie(fixedFighter()), "Acuteness should improve the strike die");
  assert.ok(EXPLAIN.acute.startsWith(`You strike on a d${die},`), EXPLAIN.acute);
  const ev = { type: "itemEffectStarted", kind: "acute", item: "Acuteness", rounds: 3 };
  assert.ok(plainText(EVENT_NARRATION.itemEffectStarted(ev)).includes(`strike on a d${die}`), plainText(EVENT_NARRATION.itemEffectStarted(ev)));
  assert.ok(LINE_FOR.itemEffectStarted(ev, {}).text.includes(`strike on a d${die}`), LINE_FOR.itemEffectStarted(ev, {}).text);
});

test("CONDITION_EXPLAIN (giant, enlarge) and itemEffectStarted: one size step is '+2 damage, and one face easier for foes to hit'", () => {
  for (const [key, item] of [["giant", "Gauntlet of the Giant"], ["enlarge", "Enlarge"]]) {
    const hero = fixedFighter({ timers: itemTimer(item) });
    const dmg = SIZE_DAMAGE_PER_STEP * sizeAxisStep(hero, "dmg");
    const faces = foeToHitVs(fixedState({ timers: itemTimer(item) })) - foeToHitVs(fixedState({}));
    assert.equal(faces, 1, `${item}: one face easier`);
    const phrase = `+${dmg} damage, and one face easier for foes to hit`;
    assert.ok(EXPLAIN[key].includes(phrase), `${key}: ${EXPLAIN[key]}`);
    // engine/items.js stamps `size` and `sizeDmg` (SIZE_DAMAGE_PER_STEP × the item's step) on the event.
    const ev = { type: "itemEffectStarted", kind: key, item, left: 3, size: "Large", sizeDmg: dmg };
    assert.ok(plainText(EVENT_NARRATION.itemEffectStarted(ev)).includes(phrase), plainText(EVENT_NARRATION.itemEffectStarted(ev)));
    assert.ok(LINE_FOR.itemEffectStarted(ev, {}).text.includes(phrase), LINE_FOR.itemEffectStarted(ev, {}).text);
  }
});

test("CONDITION_EXPLAIN.heroBlind: 'only your die's top face lands' is the hero's measured faces while blind", () => {
  const state = fixedState({}, { combat: fixedCombat([fixedFoe()], { heroBlind: true }) });
  assert.equal(heroStrikeFacesVs(state, state.combat.foes[0]), 1);
  assert.equal(EXPLAIN.heroBlind, "Only your die's top face lands.");
});

test("CONDITION_EXPLAIN.tongue: 'the roll gets two more faces' is the Helm's parley bonus", () => {
  const parleyAt = (cOverrides) => {
    const state = fixedState({ race: "Wilmsry", ...cOverrides }, { combat: fixedCombat([fixedFoe({ type: "Humans" })], { type: "Humans" }) });
    const ev = parley(state, fakeRng([], 20), []).find((e) => e.type === "parleyRolled");
    assert.ok(ev, `a parleyRolled event, got ${JSON.stringify(state.combat)}`);
    return ev.atLeast;
  };
  const more = parleyAt({}) - parleyAt({ timers: itemTimer("Helm of Knowledge") });
  assert.equal(more, 2);
  assert.ok(EXPLAIN.tongue.includes(`the roll gets ${WORD[more]} more faces`), EXPLAIN.tongue);
});

test("battleRoarRaised and sidestepped (Oracle and rail): 'two fewer faces' is the engine's shift", () => {
  for (const [type, key] of [["battleRoarRaised", "battleRoar"], ["sidestepped", "sidestep"]]) {
    const lost = foeToHitVs(fixedState({})) - foeToHitVs(fixedState({ timers: abilityTimer(key) }));
    const phrase = `${WORD[lost]} fewer faces to hit`;
    const ev = { type };
    assert.ok(plainText(EVENT_NARRATION[type](ev)).includes(phrase), `${type}: ${plainText(EVENT_NARRATION[type](ev))}`);
    assert.ok(LINE_FOR[type](ev, {}).text.includes(phrase), `${type}: ${LINE_FOR[type](ev, {}).text}`);
  }
});

test("blinded (Oracle and rail) and FOE_CONDITION_DESC.blind: a blind foe 'hits only on its top face'", () => {
  const foe = fixedFoe({ blind: true });
  const faces = foeSwingVsHero(fixedState({}, { combat: fixedCombat([foe]) }), foe).faces;
  assert.equal(faces, 1);
  const ev = { type: "blinded", target: "Viper", rounds: 2 };
  for (const text of [EVENT_NARRATION.blinded(ev), LINE_FOR.blinded(ev, {}).text, FOE_CONDITION_DESC.blind]) {
    assert.deepEqual(statedTop(text), [faces], plainText(text));
  }
});

test("fumbleOnFoe (mirror, Oracle and rail): 'you hit it only on your top face' is the hero's measured faces against a mirrored foe", () => {
  const foe = fixedFoe({ mirror: 3 });
  const state = fixedState({}, { combat: fixedCombat([foe]) });
  assert.equal(heroStrikeFacesVs(state, foe), 1);
  const ev = { type: "fumbleOnFoe", effect: "mirror", spell: "Mirror Self", target: "Viper", rounds: 3 };
  assert.deepEqual(statedTop(EVENT_NARRATION.fumbleOnFoe(ev)), [1], plainText(EVENT_NARRATION.fumbleOnFoe(ev)));
  assert.deepEqual(statedTop(LINE_FOR.fumbleOnFoe(ev, {}).text), [1], LINE_FOR.fumbleOnFoe(ev, {}).text);
});

test("struck (critBy ninja): 'A Ninja's top two faces' is the faces a Ninja's later strikes crit on", () => {
  const hero = { cls: "Thief", sub: "Ninja" };
  const dieN = strikeDie(fixedFighter(hero));
  let n = 0;
  for (let roll = dieN; roll >= dieN - 5; roll--) {
    const state = fixedState(hero, { combat: fixedCombat([fixedFoe()], { opened2: true }) });
    const events = [];
    playerStrike(state, fakeRng([dieN + 1 - roll], 1), events);
    if (events.some((e) => e.critBy === "ninja")) n++;
    else break;
  }
  assert.ok(n > 0, "a Ninja crits on the top face at least");
  const text = plainText(EVENT_NARRATION.struck({ type: "struck", target: "Viper", dmg: 6, critical: true, critBy: "ninja" }));
  assert.ok(text.includes(`A Ninja's ${topFaces(n)}`), text);
});

test("COMBAT_MENU_COPY.parleyDesc: a failed parley's insult makes every foe 'one face easier'", () => {
  const foe = fixedFoe();
  const plain = foeSwingVsHero(fixedState({}, { combat: fixedCombat([foe]) }), foe).faces;
  const insulted = foeSwingVsHero(fixedState({}, { combat: fixedCombat([foe], { parleyInsulted: true }) }), foe).faces;
  assert.equal(insulted - plain, 1);
  assert.ok(COMBAT_MENU_COPY.parleyDesc.includes("every foe hits you and yours one face easier"), COMBAT_MENU_COPY.parleyDesc);
});

test("GEAR_COPY.healingDesc: 'Heals 7–25 hp (double for a Wilmsry)' is drinkPotion's own range", () => {
  const healed = (race, draw) => {
    const state = fixedState({ race, wp: 1, maxWP: 999, potions: 1 });
    const ev = drinkPotion(state, fakeRng([draw], draw), []).find((e) => e.type === "potionDrunk");
    assert.ok(ev, "a potionDrunk event");
    return ev.amount;
  };
  const lo = healed("Human", 1);
  const hi = healed("Human", 10);
  assert.ok(GEAR_COPY.healingDesc.startsWith(`Heals ${lo}–${hi} hp (double for a Wilmsry)`), GEAR_COPY.healingDesc);
  assert.equal(healed("Wilmsry", 1), 2 * lo);
});

// Quick 260927-rsx (user ruling 2026-09-27): the foe card's "resists your
// spells on {range}" and the spell row's "{target} resists on {range}" are
// templates filled from engine/derived.js#resistFaces; the numbers
// the ruling states (intel 1–2 → 5%, 3 → 10%, 6 → 15%, 10 → 25%, 16 → 40%)
// are the engine's faces over the d20, and the stated range is the top faces.
test("FOE_DETAILS_COPY.resistsSpells and COMBAT_MENU_COPY.spellResist: the spell resist range is the engine's half-intel faces on a d20", () => {
  assert.equal(FOE_DETAILS_COPY.resistsSpells, "resists your spells on {range}");
  assert.equal(COMBAT_MENU_COPY.spellResist, "{target} resists on {range}");
  const ruling = { 1: 5, 2: 5, 3: 10, 6: 15, 10: 25, 16: 40 };
  for (const [intel, pct] of Object.entries(ruling)) {
    const faces = resistFaces(Number(intel));
    assert.equal((faces / 20) * 100, pct, `intel ${intel}`);
    const wins = [...Array(20).keys()].filter((raw) => resistRoll(fakeRng([raw + 1]), Number(intel)).resisted).length;
    assert.equal(wins, faces, `intel ${intel}: the roll's own winning faces`);
    assert.equal(hitRangeText(faces, 20), `${facesRangeText(faces, 20)} (d20)`);
  }
});

// ---------------------------------------------------------------------------
// 9. Quick 260928-tsx (user request 2026-09-28): the thrown attack spells
//    (Freeze, Fireball, Lightning, Mangle) label each die. The to-hit is a
//    FIXED die (d10 for Freeze, d8 for the rest), so the text states its
//    Phase 74 range "before bonuses" (the per-hero school and throw bonuses
//    widen it); the damage dice are the row's own `dmg`, read as "damage".
//    Quick 260928-sq2 (user ruling 2026-09-28): every damage spell's text
//    says "<dice> + your level² damage", and the engine adds exactly the
//    caster's level²: +1 for a no-bonus level-1 caster, +9 at level 3. The
//    area and damage-over-time spells (Earthquake, Fireballs, Acid, Ice) are
//    pinned the same way below. Freeze's "d4 rounds" is FREEZE_HOLD_DIE.
// ---------------------------------------------------------------------------

/** "d6", "2d10+4": the dice a `dmg` literal rolls, written the way the texts write them. */
const diceText = ({ n, sides, bonus }) => `${n === 1 ? "" : n}d${sides}${bonus ? `+${bonus}` : ""}`;

/**
 * A no-bonus caster's cast of thrown spell `n` at caster level `level`
 * (default the spell's own; a level below it is a scroll's free cast,
 * c.scrollCast, which skips the level gate), against one plain foe, with
 * every draw after the to-hit set to `fill` (the damage dice's face).
 * Illusionist: offense school bonus 0 on the chart, and no item grants a
 * throw bonus.
 */
function thrownCast(n, toHitDraw, fill, level) {
  const sp = SPELLS.find((s) => s.n === n);
  const foe = fixedFoe({ intel: 0 });
  const lvl = level ?? sp.lvl;
  const state = fixedState(
    { cls: "Magic User", sub: "Illusionist", level: lvl, grimoire: [n], scrollCast: lvl < sp.lvl },
    { combat: fixedCombat([foe]) },
  );
  const events = castSpell(state, SPELLS.indexOf(sp), fakeRng([toHitDraw], fill), []);
  return { sp, events };
}

for (const n of ["Freeze", "Fireball", "Lightning", "Mangle"]) {
  test(`SPELLS.${n}.txt states its to-hit range and its damage dice + your level² from the engine`, () => {
    const { sp, events } = thrownCast(n, 2, 1);
    assert.equal(sp.kind, "thrown");
    const thrown = events.find((e) => e.type === "spellThrown");
    assert.ok(thrown, `${n}: a spellThrown event, got ${events.map((e) => e.type)}`);
    assert.equal(thrown.mods, undefined, `${n}: the pinned range is the one before any bonus`);
    const range = hitRangeText(thrown.dieN + 1 - thrown.atLeast, thrown.dieN);
    assert.ok(sp.txt.includes(`on ${range} before bonuses, for ${diceText(sp.dmg)} + your level² damage`), `${n}: "${sp.txt}" should state ${range} and ${diceText(sp.dmg)} + your level² damage`);
    // Every face at or above atLeast hits, every face below misses.
    for (let face = 1; face <= thrown.dieN; face++) {
      const cast = thrownCast(n, thrown.dieN + 1 - face, 1).events;
      assert.equal(cast.find((e) => e.type === "spellThrown").roll, face);
      assert.equal(cast.some((e) => e.type === "spellHit"), face >= thrown.atLeast, `${n}: face ${face}`);
    }
    // The damage the hit deals is the row's dice + the caster's level²:
    // every die low, then every die high, at level 1 (+1) and level 3 (+9).
    for (const [level, levelSq] of [[1, 1], [3, 9]]) {
      for (const [fill, want] of [[1, sp.dmg.n + (sp.dmg.bonus || 0)], [sp.dmg.sides, sp.dmg.n * sp.dmg.sides + (sp.dmg.bonus || 0)]]) {
        const hit = thrownCast(n, 2, fill, level).events.find((e) => e.type === "spellHit");
        assert.ok(hit, `${n} L${level}: the throw hits`);
        assert.equal(hit.levelSq, levelSq);
        assert.equal(hit.dmg, want + levelSq, `${n} L${level}: ${diceText(sp.dmg)} with every die on ${fill}, + ${levelSq}`);
      }
    }
  });
}

test("SPELLS.Freeze.txt's 'frozen for d4 rounds' is the engine's FREEZE_HOLD_DIE", () => {
  assert.equal(FREEZE_HOLD_DIE, 4);
  assert.ok(spell("Freeze").includes(`frozen for d${FREEZE_HOLD_DIE} rounds`), spell("Freeze"));
});

/** A sides-aware fake rng: `.d(sides)` answers `fn(sides)`; the cursor is a fixed 0. */
const rngBy = (fn) => ({ d: (sides) => fn(sides), pick: (arr) => arr[0], shuffle: (a) => a, getState: () => 0 });

/** A level-`level` no-bonus caster's cast of `n` at two sleeping foes (a scroll's free cast below its level). */
function areaCast(n, level, fn) {
  const sp = SPELLS.find((s) => s.n === n);
  const foes = [fixedFoe({ name: "A", intel: 0, asleep: 99 }), fixedFoe({ name: "B", intel: 0, asleep: 99 })];
  const state = fixedState(
    { cls: "Magic User", sub: "Illusionist", level, grimoire: [n], scrollCast: level < sp.lvl, wp: 999, maxWP: 999 },
    // Neither foe resists (the 2026-09-27 intel resist, a derived stream).
    { combat: fixedCombat(foes), acts: actsWhere(n, [[0, false], [1, false]], { intels: { 0: 0, 1: 0 } }) },
  );
  const events = castSpell(state, SPELLS.indexOf(sp), rngBy(fn), []);
  return { sp, state, events };
}

test("SPELLS.Earthquake.txt: '3d10+8 + your level² damage to each foe', and half the 3d10+8 to you, from the engine", () => {
  const sp = SPELLS.find((s) => s.n === "Earthquake");
  assert.ok(sp.txt.includes(`${diceText(sp.dmg)} + your level² damage to each foe; you get half the ${diceText(sp.dmg)}`), sp.txt);
  for (const [level, levelSq] of [[1, 1], [3, 9]]) {
    for (const face of [1, sp.dmg.sides]) {
      const { state, events } = areaCast("Earthquake", level, (sides) => (sides === sp.dmg.sides ? face : 1));
      const rolled = sp.dmg.n * face + sp.dmg.bonus;
      assert.deepEqual(state.combat.foes.map((f) => 999 - f.wp), [rolled + levelSq, rolled + levelSq], `L${level} face ${face}`);
      assert.equal(events.find((e) => e.type === "earthquakeSelfDamage").amount, Math.ceil(rolled / 2));
    }
  }
});

test("SPELLS.Fireballs.txt: 'd10+2 damage each … + your level² damage once to each foe struck', from the engine", () => {
  const sp = SPELLS.find((s) => s.n === "Fireballs");
  assert.ok(sp.txt.includes(`d8 bolts · ${diceText(sp.dmg)} damage each, spread across the foes, + your level² damage once to each foe struck`), sp.txt);
  for (const [level, levelSq] of [[1, 1], [3, 9]]) {
    for (const face of [1, sp.dmg.sides]) {
      // 3 bolts: A, B, A.
      const { state } = areaCast("Fireballs", level, (sides) => (sides === 8 ? 3 : sides === sp.dmg.sides ? face : 1));
      const per = face + sp.dmg.bonus;
      assert.deepEqual(state.combat.foes.map((f) => 999 - f.wp), [2 * per + levelSq, per + levelSq], `L${level} face ${face}`);
    }
  }
});

for (const [n, tick, phrase] of [["Acid", "acidTick", "a round, d6 rounds; the first round adds your level² damage"], ["Ice", "dotTick", "a round for d4+1 rounds, the first adding your level² damage"]]) {
  test(`SPELLS.${n}.txt: its first round adds your level², from the engine`, () => {
    const sp = SPELLS.find((s) => s.n === n);
    assert.ok(sp.txt.includes(`${diceText(sp.dmg)} ${phrase}`), sp.txt);
    for (const [level, levelSq] of [[1, 1], [3, 9]]) {
      for (const face of [1, sp.dmg.sides]) {
        let drawn = 0;
        const { events } = areaCast(n, level, (sides) => (drawn++ === 0 ? 4 : sides === sp.dmg.sides ? face : 4));
        const first = events.find((e) => e.type === tick);
        assert.equal(first.dmg, sp.dmg.n * face + sp.dmg.bonus + levelSq, `${n} L${level} face ${face}`);
      }
    }
  });
}

// Every non-content corpus key stating a face count or a fixed-die range,
// and where it is pinned. "here" rows are the tests above; a file names the
// test that pins the key against the engine.
const PINNED_OUTSIDE_CONTENT = Object.freeze([
  { match: "bank:CLASS_NOTE.", proof: "test/unit/identity-footer.test.js", token: "CLASS_NOTE" },
  { match: "bank:SUB_NOTE.", proof: "test/unit/identity-footer.test.js", token: "SUB_NOTE" },
  { match: "bank:RACE_NOTE.", proof: "test/unit/identity-footer.test.js", token: "RACE_NOTE" },
  { match: "bank:IDENTITY_FOOTER.", proof: "test/unit/identity-footer.test.js", token: "footerLines" },
  { match: "bank:IDENTITY_TRAITS.", proof: "test/unit/identity-footer.test.js", token: "IDENTITY_TRAITS" },
  { match: "bank:EPITAPHS.trap.", proof: "test/unit/death-copy.test.js", token: "EPITAPHS.trap" },
  { match: "bank:MARKS_LEGEND.", proof: "test/unit/mapMarks.test.js", token: "MARKS_LEGEND" },
  { match: "oracle:smokeThrown", proof: "test/unit/roll-sign-consistency.test.js", token: "smokeThrown" },
  { match: "rail:smokeThrown", proof: "test/unit/roll-sign-consistency.test.js", token: "smokeThrown" },
  { match: "oracle:mirrorSelf", proof: "test/unit/roll-sign-consistency.test.js", token: "mirrorSelf" },
  { match: "rail:mirrorSelf", proof: "test/unit/roll-sign-consistency.test.js", token: "mirrorSelf" },
  { match: "oracle:weakened", proof: "test/unit/roll-sign-consistency.test.js", token: "EVENT_NARRATION.weakened" },
  { match: "rail:weakened", proof: "test/unit/roll-sign-consistency.test.js", token: "LINE_FOR.weakened" },
  { match: "bank:FOE_CONDITION_DESC.weakened", proof: "test/unit/roll-sign-consistency.test.js", token: "FOE_CONDITION_DESC.weakened" },
  { match: "raw:engine/items.js#rollTreasureItem", proof: "here" },
  { match: "raw:engine/economy.js#openStore", proof: "here" },
  { match: "raw:mazeworld.html#CONDITION_EXPLAIN", proof: "here" },
  { match: "oracle:itemEffectStarted", proof: "here" },
  { match: "rail:itemEffectStarted", proof: "here" },
  { match: "oracle:battleRoarRaised", proof: "here" },
  { match: "rail:battleRoarRaised", proof: "here" },
  { match: "oracle:sidestepped", proof: "here" },
  { match: "rail:sidestepped", proof: "here" },
  { match: "oracle:blinded", proof: "here" },
  { match: "rail:blinded", proof: "here" },
  { match: "bank:FOE_CONDITION_DESC.blind", proof: "here" },
  { match: "oracle:fumbleOnFoe", proof: "here" },
  { match: "rail:fumbleOnFoe", proof: "here" },
  { match: "oracle:struck", proof: "here" },
  { match: "bank:COMBAT_MENU_COPY.parleyDesc", proof: "here" },
  { match: "bank:GEAR_COPY.healingDesc", proof: "here" },
]);

// A face count or a fixed-die range in prose. A computed roll line ("7 vs
// 12–20") is rollRange.js's own output, not authored, and never matches.
const STATES_FACES_OR_RANGE =
  /\btop (?:(?:one|two|three|four|five|six) )?faces?\b|\b(?:one|two|three|four|five|six) (?:fewer|more) faces\b|\bone face (?:easier|harder|fewer|more|better|worse)\b|\bvery best roll\b|\bon (?:a |the )?d(?:4|6|8|10|12|20)\b|\b\d+–\d+ (?:on (?:a |the )?d\d+|dodges|avoids)\b|\b\d+–\d+ hp\b|\bdie one size\b|\ba die better\b/;

const corpus = await buildCorpus();
const flagged = corpus.entries.filter((e) => !e.key.startsWith("content:") && e.texts.some((t) => STATES_FACES_OR_RANGE.test(t))).map((e) => e.key);
const pinFor = (key) => PINNED_OUTSIDE_CONTENT.find((p) => (p.match.endsWith(".") ? key.startsWith(p.match) : key === p.match));

test("coverage: every non-content corpus string stating a face count or a fixed-die range is pinned (here or in a named test)", () => {
  assert.ok(flagged.length >= 30, `the scan should see Phase 79's authored ranges, saw ${flagged.length}`);
  const unpinned = flagged.filter((k) => !pinFor(k));
  assert.deepEqual(unpinned, [], "pin each new authored face count or range to the engine (a row above, or a named test) and list it in PINNED_OUTSIDE_CONTENT");
});

test("coverage: no PINNED_OUTSIDE_CONTENT row has rotted, and every named proof file pins its key", () => {
  for (const p of PINNED_OUTSIDE_CONTENT) {
    assert.ok(flagged.some((k) => (p.match.endsWith(".") ? k.startsWith(p.match) : k === p.match)), `${p.match}: no live corpus string states a range any more, so the row is dead`);
    if (p.proof === "here") continue;
    const src = fs.readFileSync(path.join(REPO_ROOT, p.proof), "utf8");
    assert.ok(src.includes(p.token), `${p.proof} should pin ${p.match} (it never names ${p.token})`);
  }
});
