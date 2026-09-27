// test/unit/event-order-fold.test.js
//
// Phase 77 Plan 02 (CMBUI-10) — the combat record reads in the order things
// happened. The user's device report (2026-09-21): "A Ned falls, then 2 Neds
// miss, then I riposted. Let's make sure the Oracle reads in order." The
// fight log (THE FIGHT SO FAR, the round strip, the beats) used the rail's
// PRIORITY fold, which groups a foe's swings across the whole action, sorts
// by priority with time only as the tiebreak, and folds a kill into " · felled".
// CONTEXT CMBUI-10: "time must become the key".
//
// This file pins:
//   1. linesForAction's `order: "event"` contract — one line per happening,
//      lines at their earliest event's position, only contiguous chains
//      merge, only back-to-back identical lines fold " ×N".
//   2. The riposte sequence from a REAL foeTurn (miss, pays, falls).
//   3. The rail's default (priority) fold is byte-identical to the plan base
//      over a recorded corpus (test/unit/fixtures/event-order/
//      default-fold-corpus.json). The corpus builder lives in this file;
//      regenerate ONLY as a declared change, with
//      `MZ_REGEN_EVENT_ORDER_CORPUS=1 node --test test/unit/event-order-fold.test.js`.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { applyAction, newRun } from "../../engine/engine.js";
import { foeTurn } from "../../engine/combat.js";
import { startEffect } from "../../engine/effects.js";
import { linesForAction, LINE_FOR, ORACLE_ONLY, NARRATIVE_ACTIONS, oracleDetailText } from "../../src/browser/narrationLines.js";
import { narrateEvent, EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { formatEvents } from "../../src/browser/engineAdapter.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { lineIdxsFor } from "../../src/browser/combatBeat.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CORPUS_PATH = path.join(__dirname, "fixtures", "event-order", "default-fold-corpus.json");

const EVENT = { limit: Infinity, withIdx: true, order: "event" };
const evLines = (type, events, ctx = {}) => linesForAction(type, events, ctx, EVENT);
const evTexts = (type, events, ctx = {}) => evLines(type, events, ctx).map((l) => l.text);
const lineText = (e) => LINE_FOR[e.type](e, {}).text;

// ─── fixed* helpers (copied from test/unit/fight-log-worst-case.test.js) ────

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0, abilities: [],
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return {
    foes, type: foes[0]?.type || "Beasts", round: 1, target: 0,
    pending: false, opened: false, opened2: false, spellOpen: false, tracked: false,
    ...overrides,
  };
}

function worstCaseFoes() {
  return [
    {
      name: "Stalka Beast", type: "Beasts", lvl: 4, size: "XL", intel: 15,
      wp: 94, maxWP: 94, alive: true, asleep: 0, lives: 1,
      sp: { atk: 2, dmg: { n: 1, sides: 4, bonus: 0 } }, frenzied: true,
      abilities: ["stalkaHeal", "stalkaLightning", "stalkaFireball", "stalkaFreeze"],
    },
    {
      name: "Djinni", type: "Beasts", lvl: 4, size: "G", intel: 16,
      wp: 65, maxWP: 65, alive: true, asleep: 0, lives: 1,
      sp: { caster: true, dmg: { n: 1, sides: 4, bonus: 0 }, fleesBelow: 0.25 }, frenzied: true,
      abilities: ["djinniFireball", "djinniDaze", "djinniLightning", "djinniFreeze"],
    },
    {
      name: "Krupke", type: "Beasts", lvl: 1, size: "H", intel: 8,
      wp: 17, maxWP: 17, alive: true, asleep: 0, lives: 1,
      sp: { caster: true, ar: 12, dmg: { n: 1, sides: 6, bonus: 2 } },
      abilities: ["krupkeWeaken", "krupkeFreeze"],
    },
    {
      name: "Giant Rat", type: "Beasts", lvl: 1, size: "S", intel: 1,
      wp: 10, maxWP: 10, alive: true, asleep: 0, lives: 1,
      sp: { atk: 2 }, frenzied: true,
    },
  ];
}

/** fakeRng(seq) — `.d()` pops the next value regardless of sides; throws on underflow. */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => 0,
  };
}

function ned() {
  return { name: "Ned", type: "Humans", lvl: 1, size: "M", intel: 1, wp: 3, maxWP: 3, alive: true, asleep: 0, sp: {}, lives: 1 };
}

/**
 * riposteRound() — the user's reported round, built from a REAL foeTurn: a
 * Fighter with a live `ability:riposte` effect-phase timer and three
 * low-hp Neds. Every d() reads 20 (a foe miss on the fake die; the Club's
 * riposte damage then drops each 3-hp Ned).
 */
function riposteRound() {
  const state = fixedState({ c: fixedFighter({ abilities: ["riposte"], wp: 999, maxWP: 999 }) });
  state.combat = fixedCombat([ned(), ned(), ned()], { type: "Humans" });
  startEffect(state.c, "ability:riposte", { rounds: 1, cd: 4 });
  return foeTurn(state, fakeRng(new Array(80).fill(20)), []);
}

// ─── The default-fold corpus (recorded at the plan base) ─────────────────────

/** SYNTHETIC — hand-built lists that drive every aggregation branch of the priority fold. */
const SYNTHETIC = [
  ["riposte-report", "useAbility", [
    { type: "riposteReady", rounds: 1 },
    { type: "foeMissed", name: "Ned", roll: 3, atLeast: 12, dieN: 20 },
    { type: "riposted", target: "Ned", dmg: 20 },
    { type: "foeKilled", name: "Ned", spGained: 10 },
    { type: "foeMissed", name: "Ned", roll: 4, atLeast: 12, dieN: 20 },
    { type: "riposted", target: "Ned", dmg: 20 },
    { type: "foeKilled", name: "Ned", spGained: 10 },
    { type: "struckByFoe", name: "Ned", dmg: 2, roll: 15, atLeast: 12, dieN: 20 },
  ]],
  ["three-foes-swing", "attack", [
    { type: "struck", target: "Kobold", dmg: 4, roll: 14, atLeast: 9, dieN: 20 },
    { type: "struckByFoe", name: "Kobold", dmg: 3 },
    { type: "foeMissed", name: "Goblin" },
    { type: "struckByFoe", name: "Orc", dmg: 5, critical: true, soaked: { hide: 2 } },
  ]],
  ["member-groups", "attack", [
    { type: "memberStruck", name: "Rat", member: "Ada", dmg: 2 },
    { type: "memberStruck", name: "Rat", member: "Ada", dmg: 3 },
    { type: "foeMissed", name: "Rat", member: "Ada" },
    { type: "foeMissed", name: "Bat", member: "Bo" },
  ]],
  ["your-round-k-of-m", "attack", [
    { type: "struck", target: "Troll", dmg: 4 },
    { type: "strikeMissed", target: "Troll", quip: "Close." },
    { type: "struck", target: "Troll", dmg: 6, critical: true, critBy: "backstab" },
    { type: "struck", target: "Imp", dmg: 3 },
    { type: "foeKilled", name: "Imp", spGained: 4 },
    { type: "strikeMissed", target: "Ghost", untouchable: true },
    { type: "strikeMissed", target: "Wisp" },
    { type: "strikeMissed", target: "Wisp", quip: "Air." },
  ]],
  ["lightning-collapse", "castSpell", [
    { type: "spellThrown", spell: "Lightning", target: "A", roll: 7, atLeast: 5, dieN: 8 },
    { type: "spellHit", target: "A", dmg: 6 },
    { type: "foeKilled", name: "A", spGained: 2 },
    { type: "spellThrown", spell: "Lightning", target: "B", roll: 2, atLeast: 5, dieN: 8 },
    { type: "spellMissed", target: "B" },
    { type: "spellThrown", spell: "Lightning", target: "C", roll: 8, atLeast: 5, dieN: 8 },
    { type: "spellHit", target: "C", dmg: 4 },
  ]],
  ["spell-ward-between", "castSpell", [
    { type: "spellThrown", spell: "Fire Bolt", target: "Ned", roll: 7, atLeast: 5, dieN: 8 },
    { type: "foeWardSoaked", name: "Ned", amount: 2, left: 0 },
    { type: "foeWardBroken", name: "Ned" },
    { type: "spellHit", target: "Ned", dmg: 3 },
    { type: "foeKilled", name: "Ned", spGained: 3 },
  ]],
  ["freeze-solid", "castSpell", [
    { type: "spellThrown", spell: "Freeze", target: "Yeti", roll: 9, atLeast: 5, dieN: 10 },
    { type: "spellHit", target: "Yeti", dmg: 5 },
    { type: "frozenSolid", target: "Yeti" },
    { type: "foeKilled", name: "Yeti", spGained: 8 },
    { type: "goldGained", amount: 4, why: "loot" },
  ]],
  ["resist-folds", "castSpell", [
    { type: "resistFailed", target: "Orc", roll: 3, atLeast: 12, dieN: 20 },
    { type: "dozed", target: "Orc", rounds: 2 },
    { type: "resistFailed", target: "Imp", roll: 4, atLeast: 12, dieN: 20 },
    { type: "struckByFoe", name: "Bat", dmg: 1 },
    { type: "stunned", target: "Imp", rounds: 1 },
  ]],
  ["flee-chains", "flee", [
    { type: "fleeRolled", roll: 3, atLeast: 10, dieN: 20 },
    { type: "struckByFoe", name: "Wolf", dmg: 2 },
    { type: "fleeFailed" },
    { type: "fleeRolled", roll: 15, atLeast: 10, dieN: 20 },
    { type: "fled" },
  ]],
  ["parley-chains", "parley", [
    { type: "parleyRolled", roll: 14, atLeast: 12, dieN: 20 },
    { type: "goldGained", amount: 5, why: "parley" },
    { type: "parleyRolled", roll: 2, atLeast: 12, dieN: 20 },
    { type: "foeMissed", name: "Brigand" },
    { type: "parleyFailed" },
  ]],
  ["chest-chains", "move", [
    { type: "chestLockRolled", roll: 12, atLeast: 10, dieN: 20 },
    { type: "chestOpened", gold: 7 },
    { type: "chestLockRolled", roll: 2, atLeast: 10, dieN: 20 },
    { type: "goldGained", amount: 1, why: "floor" },
    { type: "chestLocked" },
  ]],
  ["encounter-followers", "move", [
    { type: "encounterStarted", foes: [{ name: "Ned" }, { name: "Ned" }], samuraiNeverFirst: true },
    { type: "trackable" },
    { type: "allyJoined", name: "Bo" },
    { type: "goldGained", amount: 2, why: "floor" },
    { type: "foeBored", name: "Ned" },
    { type: "combatInDark" },
  ]],
  ["dedupe-by-type", "attack", [
    { type: "goldGained", amount: 3, why: "loot" },
    { type: "lootDropped", item: { n: "Club" } },
    { type: "goldGained", amount: 5, why: "loot" },
    { type: "goldGained", amount: 3, why: "loot" },
    { type: "lootDropped", item: { n: "Rope" } },
    { type: "strikeRefused" },
  ]],
  ["count-equality", "attack", ["frenzy", "phobiaAfraid", "lootDropped", "combatJoined", "struck", "foeMissed"].map((type) => ({ type }))],
  ["struck-and-refusal", "attack", [{ type: "struck" }, { type: "strikeRefused" }]],
  // out of combat: the rail's own fold (narrate ctx, as the shell passes it for NARRATIVE_ACTIONS)
  ["move-with-find", "move", [
    { type: "moved", x: 1, y: 2 },
    { type: "findOffered", name: "Club", kind: "weapon" },
    { type: "goldGained", amount: 2, why: "floor" },
  ], true],
  ["store-buy", "buyItem", [
    { type: "bought", item: "Rope", cost: 5 },
    { type: "purchaseBagged", item: { n: "Rope" }, why: "tool" },
  ]],
  ["camp-night", "camp", [
    { type: "rested", amount: 6 },
    { type: "dayBegan", day: 2 },
    { type: "spellChargeRecovered" },
  ], true],
];

const WALK_DIRS = ["N", "E", "S", "W"];

/** walkAction(state, k) — a deterministic, dumb walker: fights, loots, camps, shops and moves. */
function walkAction(state, k) {
  if (state.combat && state.combat.pending) return { type: "fight" };
  if (state.combat) return k % 7 === 6 ? { type: "flee" } : { type: "attack" };
  if (state.pendingFind) return k % 2 ? { type: "takeFind" } : { type: "leaveFind" };
  if (state.pendingJoiner) return { type: "resolveJoiner", accept: false };
  if (state.store) return k % 3 === 0 ? { type: "buyItem", idx: 0 } : { type: "leaveStore" };
  if (Array.isArray(state.pendingLoot) && state.pendingLoot.length) return { type: "takeAllLoot" };
  if (k % 23 === 22) return { type: "camp" };
  return { type: "move", dir: WALK_DIRS[(k >> 2) % 4] };
}

/** buildCorpusCases() — the corpus inputs (events recorded, not re-derived at test time). */
function buildCorpusCases() {
  const cases = SYNTHETIC.map(([name, type, events, narrate = false]) => ({ name, type, narrate, events }));
  for (const [scenario, action, first] of [["fight", { type: "fight" }, null], ["attack", { type: "attack" }, "foe"]]) {
    for (let seed = 1; seed <= 24; seed++) {
      const state = fixedState({ c: fixedFighter({ race: "Fridgian", maxWP: 400, wp: 400, potions: 0 }) });
      state.combat = fixedCombat(worstCaseFoes(), scenario === "fight" ? { pending: true } : { first });
      const { events } = applyAction({ ...state, rngState: seed }, action);
      cases.push({ name: `worst-case-${scenario}-${seed}`, type: action.type, narrate: false, events });
    }
  }
  for (const seed of [1, 2, 3, 4]) {
    let state = newRun(seed);
    let kept = 0;
    for (let k = 0; k < 400 && !state.dead && kept < 30; k++) {
      const action = walkAction(state, k);
      const { state: next, events } = applyAction(state, action);
      state = next;
      const interesting = events.some((e) => e.type !== "moved");
      if (!interesting) continue;
      kept++;
      cases.push({ name: `walk-${seed}-${k}-${action.type}`, type: action.type, narrate: NARRATIVE_ACTIONS.has(action.type), events });
    }
  }
  return JSON.parse(JSON.stringify(cases));
}

const ctxFor = (c) => (c.narrate ? { narrate: narrateEvent } : {});

if (process.env.MZ_REGEN_EVENT_ORDER_CORPUS === "1") {
  const cases = buildCorpusCases().map((c) => ({
    ...c,
    lines: linesForAction(c.type, c.events, ctxFor(c)),
    linesIdx: linesForAction(c.type, c.events, ctxFor(c), { limit: Infinity, withIdx: true }),
  }));
  fs.mkdirSync(path.dirname(CORPUS_PATH), { recursive: true });
  fs.writeFileSync(CORPUS_PATH, JSON.stringify({ note: "Phase 77-02 (CMBUI-10): linesForAction's DEFAULT (priority) fold, recorded at the plan base. The rail reads this fold; it must never move.", cases }, null, 1) + "\n");
}

// ─── 1. The rail's default fold is byte-identical to the plan base ──────────

test("CMBUI-10: the default (priority) fold is byte-identical to the plan base over the recorded corpus", () => {
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8"));
  assert.ok(corpus.cases.length >= 60, `corpus holds ${corpus.cases.length} cases`);
  const kinds = new Set(corpus.cases.map((c) => c.type));
  for (const t of ["move", "camp", "fight", "attack", "flee", "castSpell"]) assert.ok(kinds.has(t), `the corpus covers a ${t} action`);
  for (const c of corpus.cases) {
    assert.deepEqual(linesForAction(c.type, c.events, ctxFor(c)), c.lines, `${c.name}: default fold moved`);
    assert.deepEqual(linesForAction(c.type, c.events, ctxFor(c), { limit: Infinity, withIdx: true }), c.linesIdx, `${c.name}: default withIdx fold moved`);
    assert.deepEqual(linesForAction(c.type, c.events, ctxFor(c), { order: "priority", limit: Infinity, withIdx: true }), c.linesIdx, `${c.name}: explicit priority order equals the default`);
  }
});

// ─── 2. The event-order contract ─────────────────────────────────────────────

/** lineableEvents(events) — the events a line would narrate one by one. */
const lineable = (events) => events.map((e, i) => ({ e, i })).filter(({ e }) => !ORACLE_ONLY.has(e.type) && LINE_FOR[e.type]);

test("CMBUI-10: the riposte round from a real foeTurn reads miss, pays, falls for each Ned, in time order", () => {
  const events = riposteRound();
  // engine emission pin: each foeMissed is followed by its riposted, then its foeKilled.
  const combatTypes = events.map((e) => e.type).filter((t) => ["foeMissed", "riposted", "foeKilled"].includes(t));
  assert.deepEqual(combatTypes.slice(0, 9), ["foeMissed", "riposted", "foeKilled", "foeMissed", "riposted", "foeKilled", "foeMissed", "riposted", "foeKilled"]);

  const lines = evLines("useAbility", events);
  const texts = lines.map((l) => l.text);
  const missIdx = texts.map((t, k) => (t.startsWith("Ned misses you") ? k : -1)).filter((k) => k >= 0);
  const paysIdx = texts.map((t, k) => (/^Ned misses, and pays \d+ for it\.$/.test(t) ? k : -1)).filter((k) => k >= 0);
  const fallsIdx = texts.map((t, k) => (/^Ned falls \(\+\d+ XP\)\.$/.test(t) ? k : -1)).filter((k) => k >= 0);
  assert.equal(missIdx.length, 3, "one line per miss (never 'misses you 3 times')");
  assert.equal(paysIdx.length, 3, "one 'pays' line per riposte");
  assert.equal(fallsIdx.length, 3, "one 'falls' line per kill");
  for (let n = 0; n < 3; n++) {
    assert.ok(missIdx[n] < paysIdx[n] && paysIdx[n] < fallsIdx[n], `Ned ${n + 1}: miss, then pays, then falls (${texts.join(" | ")})`);
    if (n > 0) assert.ok(fallsIdx[n - 1] < missIdx[n], "a kill never follows the next miss");
  }
  // strictly ascending idx, each line at its own event
  const idxs = lines.map((l) => l.idx);
  assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b));
  assert.equal(new Set(idxs).size, idxs.length);
  // with no chain in play, the event order is exactly one LINE_FOR line per lineable event
  assert.deepEqual(texts, lineable(events).map(({ e }) => lineText(e)));
});

test("CMBUI-10: two identical adjacent lines fold ' ×2'; the same two lines split by another line stay two", () => {
  const miss = { type: "foeMissed", name: "Ned", roll: 3, atLeast: 12, dieN: 20 };
  const adjacent = evLines("attack", [miss, { ...miss, roll: 5 }]);
  assert.equal(adjacent.length, 1);
  assert.equal(adjacent[0].text, `${lineText(miss)} ×2`);
  assert.equal(adjacent[0].idx, 0, "the fold sits at the first line's position");

  const three = evTexts("attack", [miss, miss, miss]);
  assert.deepEqual(three, [`${lineText(miss)} ×3`]);

  const split = evTexts("attack", [miss, { type: "riposted", target: "Ned", dmg: 7 }, miss]);
  assert.deepEqual(split, [lineText(miss), "Ned misses, and pays 7 for it.", lineText(miss)]);

  // different text never folds, even for the same event type back to back
  assert.deepEqual(evTexts("attack", [{ type: "struckByFoe", name: "Ned", dmg: 2 }, { type: "struckByFoe", name: "Ned", dmg: 3 }]), ["Ned hits you (2)", "Ned hits you (3)"]);
});

test("CMBUI-10: a foe with two swings gives two lines in swing order, never 'hits you 1 of 2'", () => {
  const hit = { type: "struckByFoe", name: "Ogre", dmg: 6 };
  const miss = { type: "foeMissed", name: "Ogre" };
  assert.deepEqual(evTexts("attack", [hit, miss]), [lineText(hit), lineText(miss)]);
  assert.deepEqual(evTexts("attack", [miss, hit]), [lineText(miss), lineText(hit)]);
  for (const t of evTexts("attack", [hit, miss])) assert.doesNotMatch(t, / of \d/);
});

test("CMBUI-10: three foes swinging give one line per swing, never '3 foes swing'", () => {
  const events = [
    { type: "struckByFoe", name: "A", dmg: 1 },
    { type: "foeMissed", name: "B" },
    { type: "struckByFoe", name: "C", dmg: 2 },
  ];
  assert.deepEqual(evTexts("attack", events), events.map(lineText));
});

test("CMBUI-10: a hit then that foe's kill gives the hit line, then the kill line, never ' · felled'", () => {
  const events = [
    { type: "struck", target: "Imp", dmg: 3 },
    { type: "foeKilled", name: "Imp", spGained: 4 },
  ];
  const texts = evTexts("attack", events);
  assert.deepEqual(texts, events.map(lineText));
  assert.ok(texts.every((t) => !t.includes("felled")));
  // and my own swings at one target stay one line each (no "You hit X 2 of 3")
  const swings = [
    { type: "struck", target: "Troll", dmg: 4 },
    { type: "strikeMissed", target: "Troll" },
    { type: "struck", target: "Troll", dmg: 5 },
  ];
  assert.deepEqual(evTexts("attack", swings), swings.map(lineText));
});

test("CMBUI-10: flee, parley and chest rolls merge with a directly-following outcome only (roll first)", () => {
  const fr = { type: "fleeRolled", roll: 15, atLeast: 10, dieN: 20 };
  const merged = evLines("flee", [fr, { type: "fled" }]);
  assert.equal(merged.length, 1);
  assert.ok(merged[0].text.startsWith(`${lineText(fr)}. `), "roll first");
  assert.equal(merged[0].idx, 0);

  const split = evTexts("flee", [fr, { type: "struckByFoe", name: "Wolf", dmg: 2 }, { type: "fleeFailed" }]);
  assert.deepEqual(split, [lineText(fr), "Wolf hits you (2)", lineText({ type: "fleeFailed" })]);

  const pr = { type: "parleyRolled", roll: 14, atLeast: 12, dieN: 20 };
  assert.equal(evLines("parley", [pr, { type: "goldGained", amount: 5, why: "parley" }]).length, 1);
  assert.equal(evLines("parley", [pr, { type: "foeMissed", name: "X" }, { type: "parleyFailed" }]).length, 3);

  const cr = { type: "chestLockRolled", roll: 12, atLeast: 10, dieN: 20 };
  assert.equal(evLines("move", [cr, { type: "chestOpened", gold: 7 }]).length, 1);
  assert.equal(evLines("move", [cr, { type: "goldGained", amount: 1, why: "floor" }, { type: "chestLocked" }]).length, 3);

  // a no-line event between (ORACLE_ONLY) does not break contiguity
  assert.equal(evLines("flee", [fr, { type: "spGained", amount: 1 }, { type: "fled" }]).length, 1);
});

test("CMBUI-10: a single-target spell merges throw and outcome; Lightning gives one line per target", () => {
  const one = evLines("castSpell", [
    { type: "spellThrown", spell: "Fire Bolt", target: "Ned", roll: 7, atLeast: 5, dieN: 8 },
    { type: "spellHit", target: "Ned", dmg: 5 },
  ]);
  assert.equal(one.length, 1);
  assert.equal(one[0].text, lineText({ type: "spellHit", target: "Ned", dmg: 5, spell: "Fire Bolt" }));
  assert.equal(one[0].idx, 0);

  const missed = evTexts("castSpell", [
    { type: "spellThrown", spell: "Fire Bolt", target: "Ned" },
    { type: "spellMissed", target: "Ned" },
  ]);
  assert.deepEqual(missed, [lineText({ type: "spellMissed", target: "Ned", spell: "Fire Bolt" })]);

  const lightning = [
    { type: "spellThrown", spell: "Lightning", target: "A" },
    { type: "spellHit", target: "A", dmg: 6 },
    { type: "foeKilled", name: "A", spGained: 2 },
    { type: "spellThrown", spell: "Lightning", target: "B" },
    { type: "spellMissed", target: "B" },
    { type: "spellThrown", spell: "Lightning", target: "C" },
    { type: "spellHit", target: "C", dmg: 4 },
  ];
  const lt = evLines("castSpell", lightning);
  assert.deepEqual(lt.map((l) => l.text), [
    lineText({ type: "spellHit", target: "A", dmg: 6, spell: "Lightning" }),
    lineText({ type: "foeKilled", name: "A", spGained: 2 }),
    lineText({ type: "spellMissed", target: "B", spell: "Lightning" }),
    lineText({ type: "spellHit", target: "C", dmg: 4, spell: "Lightning" }),
  ]);
  assert.deepEqual(lt.map((l) => l.idx), [0, 2, 3, 5]);
  assert.ok(lt.every((l) => !/targets/.test(l.text)), "no 3+ target collapse");

  // a throw whose outcome is not next keeps its own line; the outcome still names the spell
  const warded = evTexts("castSpell", [
    { type: "spellThrown", spell: "Fire Bolt", target: "Ned" },
    { type: "foeWardSoaked", name: "Ned", amount: 2, left: 1 },
    { type: "spellHit", target: "Ned", dmg: 3 },
  ]);
  assert.deepEqual(warded, [
    lineText({ type: "spellThrown", spell: "Fire Bolt", target: "Ned" }),
    lineText({ type: "foeWardSoaked", name: "Ned", amount: 2, left: 1 }),
    lineText({ type: "spellHit", target: "Ned", dmg: 3, spell: "Fire Bolt" }),
  ]);

  // Freeze: frozen solid joins only when it comes right after the hit, and the kill right after it
  const frozen = evTexts("castSpell", [
    { type: "spellThrown", spell: "Freeze", target: "Yeti" },
    { type: "spellHit", target: "Yeti", dmg: 5 },
    { type: "frozenSolid", target: "Yeti" },
    { type: "foeKilled", name: "Yeti", spGained: 8 },
  ]);
  assert.deepEqual(frozen, ["Freeze — Yeti frozen solid"]);
});

test("CMBUI-10: a resistFailed folds only into an effect that directly follows it", () => {
  const rf = { type: "resistFailed", target: "Orc", roll: 3, atLeast: 12, dieN: 20 };
  const dozed = { type: "dozed", target: "Orc", rounds: 2 };
  const merged = evLines("castSpell", [rf, dozed]);
  assert.deepEqual(merged.map((l) => l.text), [lineText(dozed)]);
  assert.equal(merged[0].idx, 0, "the merged line sits at its earliest event");

  const split = evTexts("castSpell", [rf, { type: "struckByFoe", name: "Bat", dmg: 1 }, dozed]);
  assert.deepEqual(split, [lineText(rf), "Bat hits you (1)", lineText(dozed)]);
});

test("CMBUI-10: an encounter start folds only the followers that come right after it", () => {
  const start = { type: "encounterStarted", foes: [{ name: "Ned" }] };
  const texts = evTexts("move", [
    start,
    { type: "trackable" },
    { type: "allyJoined", name: "Bo" },
    { type: "goldGained", amount: 2, why: "floor" },
    { type: "foeBored", name: "Ned" },
  ]);
  assert.equal(texts.length, 3);
  assert.equal(texts[0], `${lineText(start)} · unnoticed · Bo joins`);
  assert.equal(texts[2], lineText({ type: "foeBored", name: "Ned" }), "a separated follower keeps its own line");
});

test("CMBUI-10: every event-order line's idx is its earliest event, lines ascend, over the worst-case sweep", () => {
  for (const [action, extra] of [[{ type: "fight" }, { pending: true }], [{ type: "attack" }, { first: "foe" }]]) {
    for (let seed = 1; seed <= 60; seed++) {
      const state = fixedState({ c: fixedFighter({ race: "Fridgian", maxWP: 400, wp: 400, potions: 0 }) });
      state.combat = fixedCombat(worstCaseFoes(), extra);
      const { events } = applyAction({ ...state, rngState: seed }, action);
      const lines = evLines(action.type, events);
      const idxs = lines.map((l) => l.idx);
      for (let k = 1; k < idxs.length; k++) assert.ok(idxs[k] > idxs[k - 1], `seed ${seed}: idx ascends`);
      for (const l of lines) assert.ok(!ORACLE_ONLY.has(events[l.idx].type), `seed ${seed}: a line sits on a narrated event`);
      for (let k = 1; k < lines.length; k++) {
        assert.ok(!(lines[k].text === lines[k - 1].text && lines[k].tone === lines[k - 1].tone), `seed ${seed}: no two identical neighbours survive the fold`);
      }
      // no cross-time aggregation text ever appears
      for (const l of lines) assert.doesNotMatch(l.text, / \d+ of \d+ \(|foes swing| · felled| targets, /, `seed ${seed}: ${l.text}`);
    }
  }
});

test("CMBUI-10: the event order never drops a narrated event (every lineable event is at or inside some line)", () => {
  for (const c of JSON.parse(fs.readFileSync(CORPUS_PATH, "utf8")).cases) {
    const lines = evLines(c.type, c.events, ctxFor(c));
    const firsts = lines.map((l) => l.idx);
    // each line owns a contiguous run [idx, nextIdx); every lineable event falls in one run
    for (const { i } of lineable(c.events)) {
      assert.ok(firsts.some((f) => f <= i), `${c.name}: event ${i} (${c.events[i].type}) precedes every line`);
    }
  }
});

// ─── 3. The engine already emits in time order (pinned, never edited) ────────

test("CMBUI-10 engine pin: a real `fight` pushes combatJoined before any opening foe swing (a Samurai: they go first)", () => {
  let sawSwing = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = fixedState({ c: fixedFighter({ sub: "Samurai", wp: 400, maxWP: 400 }) });
    state.combat = fixedCombat([ned(), ned(), ned()], { type: "Humans", pending: true });
    const { events } = applyAction({ ...state, rngState: seed }, { type: "fight" });
    const joined = events.findIndex((e) => e.type === "combatJoined");
    const firstSwing = events.findIndex((e) => e.type === "struckByFoe" || e.type === "foeMissed");
    assert.ok(joined !== -1, `seed ${seed}: combatJoined is pushed`);
    if (firstSwing !== -1) {
      sawSwing++;
      assert.ok(joined < firstSwing, `seed ${seed}: Initiative (${joined}) comes before the first swing (${firstSwing})`);
      const lines = fightLogLinesFor("fight", events);
      assert.match(lines[0].text, /^Initiative — /, `seed ${seed}: the fight log opens on the Initiative line`);
    }
  }
  assert.ok(sawSwing >= 10, `the Samurai sweep reached the opening swings (${sawSwing} seeds)`);
});

test("CMBUI-10 engine pin: a real riposte turn pushes foeMissed, then riposted, then foeKilled for the same foe", () => {
  const events = riposteRound();
  for (let i = 0; i < events.length; i++) {
    if (events[i].type !== "riposted") continue;
    const before = events.slice(0, i).map((e) => e.type).lastIndexOf("foeMissed");
    const after = events.findIndex((e, j) => j > i && e.type === "foeKilled");
    assert.ok(before !== -1 && events[before].name === events[i].target, "the miss that triggered it comes first");
    assert.ok(after !== -1 && events[after].name === events[i].target, "the kill comes after");
    const nextSwing = events.findIndex((e, j) => j > i && e.type === "foeMissed");
    if (nextSwing !== -1) assert.ok(after < nextSwing, "the kill lands before the next foe swings");
  }
});

// ─── 4. The Oracle tab (#log): one line per event, engine order, newest first ─

test("CMBUI-10 Oracle pin: formatEvents is EVENT_NARRATION of each narrated event, in engine order (no folding)", () => {
  const events = riposteRound();
  const html = formatEvents(events);
  const expected = events.filter((e) => e.type !== "moved" && typeof EVENT_NARRATION[e.type] === "function").map((e) => EVENT_NARRATION[e.type](e)).filter(Boolean);
  assert.deepEqual(html, expected);
  assert.equal(html.filter((h) => /misses/.test(h) && /Ned/.test(h)).length >= 3, true, "each miss keeps its own Oracle line");
  // the same identical miss twice reads twice on the Oracle (the fold is the fight log's, never the Oracle's)
  const miss = { type: "foeMissed", name: "Ned", roll: 3, atLeast: 12, dieN: 20 };
  assert.equal(formatEvents([miss, miss]).length, 2);
});

test("CMBUI-10 Oracle pin: the shell's logLine inserts at logEl.firstChild (the Oracle reads newest first)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "mazeworld.html"), "utf8");
  const m = src.match(/function logLine\(html\) \{[\s\S]*?\n\}/);
  assert.ok(m, "logLine exists");
  assert.match(m[0], /logEl\.insertBefore\(p, logEl\.firstChild\)/);
});

// ─── 5. The fight log and the beats share the event order ────────────────────

test("CMBUI-10: fightLogLinesFor on the riposte round reads in time order; lineIdxsFor ascends, aligned 1:1", () => {
  const events = riposteRound();
  const lines = fightLogLinesFor("useAbility", events);
  const idxs = lineIdxsFor("useAbility", events);
  assert.equal(lines.length, idxs.length, "1:1 with the beat's idxs");
  for (let k = 1; k < idxs.length; k++) assert.ok(idxs[k] > idxs[k - 1], "strictly ascending");
  assert.deepEqual(lines.map((l) => l.text), evTexts("useAbility", events));
  const kinds = lines.map((l) => (l.text.startsWith("Ned misses you") ? "miss" : /pays/.test(l.text) ? "pays" : /falls/.test(l.text) ? "falls" : "other")).filter((k) => k !== "other");
  assert.deepEqual(kinds, ["miss", "pays", "falls", "miss", "pays", "falls", "miss", "pays", "falls"]);
  // each line's dice come from its own (earliest) event
  lines.forEach((l, k) => {
    const want = oracleDetailText(narrateEvent(events[idxs[k]])) || null;
    assert.equal(l.roll, want);
  });
  assert.ok(lines[0].roll, "the first miss reveals its own die");
});

test("CMBUI-10: fightLogLinesFor and lineIdxsFor stay aligned over the worst-case sweep", () => {
  for (const [action, extra] of [[{ type: "fight" }, { pending: true }], [{ type: "attack" }, { first: "foe" }]]) {
    for (let seed = 1; seed <= 40; seed++) {
      const state = fixedState({ c: fixedFighter({ race: "Fridgian", maxWP: 400, wp: 400, potions: 0 }) });
      state.combat = fixedCombat(worstCaseFoes(), extra);
      const { events } = applyAction({ ...state, rngState: seed }, action);
      const lines = fightLogLinesFor(action.type, events);
      const idxs = lineIdxsFor(action.type, events);
      assert.equal(lines.length, idxs.length, `seed ${seed}`);
      assert.deepEqual(idxs, evLines(action.type, events).map((l) => l.idx), `seed ${seed}`);
    }
  }
});
