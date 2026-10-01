// src/browser/devBoardSeed.js
//
// Phase 84 (BOARD-18), Plan 08 Task 1. Dev-loop only: mazeworld.html's
// boardFetchFn() feeds this module's output to createFakeBoardFetch (Phase
// 83) so the browser dev loop's LEADERBOARD has runs to show, without ever
// touching a live Firestore project. The shell selects this fake only in
// the browser dev loop (a non-native platform) — Android debug and release
// builds always talk to the live board and never import this file at
// runtime for that purpose.
//
// devBoardRuns() returns the exact same frozen array on every call: twelve
// entries built from engine newRun() over fixed seeds with a forced
// {race, sub, cls} and a fixed stat spread (floor/steps/day/kills/gold/
// level), each killed through engine die() with a fixed foe name so note
// and epitaph are filled from the real content banks (content/epitaphs.js's
// CAUSE_TEXT/EPITAPHS), then turned into {id, doc} pairs via
// runDoc.js#buildRunDoc — the same shape createFakeBoardFetch's own seed
// runs expect. Every doc passes runDoc.js#validateRunDoc(doc, {}). Six
// dev uids ("devuid0001".."devuid0006") each own two of the twelve runs, each
// under its own board name (five gamer-style names and one legacy @handle), so
// a pinned "your best" can be exercised against a dev identity snapshot in
// tests; six races and twelve distinct sub-classes appear across the set.
//
// Pure, DOM-free: imports only engine/, content/ and this module's sibling
// src/browser/runDoc.js — nothing that touches the network, storage or the
// DOM.

import { newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { buildRunDoc } from "./runDoc.js";

const DEV_VERSION = "dev";

// One entry per dev run. `level` stays within content/misc-tables.js's
// THRESHOLDS bound (1..5); `kills` never exceeds `steps`; `day` stays well
// inside the day/steps camp-allowance bound runDoc.js#validateRunDoc
// checks. `race`/`sub`/`cls` are always a valid triple (rollCharacter's
// force option — see engine/character.js#normalizeForce); no Samurai is
// used, so the Fridgian+Samurai refusal never applies here.
const DEV_RUNS = Object.freeze([
  { seed: 900001, race: "Human", sub: "Wizard", cls: "Magic User", foe: "Werebeast", floor: 5, steps: 220, day: 4, kills: 9, gold: 640, level: 2, hoursAgo: 2, uid: 1 },
  { seed: 900002, race: "Elven", sub: "Knight", cls: "Fighter", foe: "China Wolf", floor: 9, steps: 480, day: 8, kills: 21, gold: 1180, level: 3, hoursAgo: 5, uid: 2 },
  { seed: 900003, race: "Dwarven", sub: "Pickpocket", cls: "Thief", foe: "Bat", floor: 3, steps: 140, day: 2, kills: 5, gold: 260, level: 1, hoursAgo: 9, uid: 3 },
  { seed: 900004, race: "Wilmsry", sub: "Warlock", cls: "Magic User", foe: "Stalka Beast", floor: 12, steps: 700, day: 13, kills: 34, gold: 2100, level: 4, hoursAgo: 14, uid: 4 },
  { seed: 900005, race: "Fridgian", sub: "Guard", cls: "Fighter", foe: "Herman", floor: 7, steps: 330, day: 6, kills: 15, gold: 890, level: 3, hoursAgo: 20, uid: 5 },
  { seed: 900006, race: "Troll", sub: "Pilfer", cls: "Thief", foe: "Rat", floor: 2, steps: 90, day: 1, kills: 2, gold: 80, level: 1, hoursAgo: 27, uid: 6 },
  { seed: 900007, race: "Human", sub: "Sorcerer", cls: "Magic User", foe: "Werebeast", floor: 15, steps: 910, day: 17, kills: 48, gold: 3200, level: 5, hoursAgo: 33, uid: 1 },
  { seed: 900008, race: "Elven", sub: "Woodsman", cls: "Fighter", foe: "China Wolf", floor: 6, steps: 300, day: 5, kills: 12, gold: 720, level: 2, hoursAgo: 41, uid: 2 },
  { seed: 900009, race: "Dwarven", sub: "Cat Burglar", cls: "Thief", foe: "Bat", floor: 10, steps: 560, day: 10, kills: 26, gold: 1450, level: 4, hoursAgo: 50, uid: 3 },
  { seed: 900010, race: "Wilmsry", sub: "Cleric", cls: "Magic User", foe: "Stalka Beast", floor: 4, steps: 190, day: 3, kills: 7, gold: 480, level: 2, hoursAgo: 58, uid: 4 },
  { seed: 900011, race: "Fridgian", sub: "Barbarian", cls: "Fighter", foe: "Herman", floor: 20, steps: 1240, day: 24, kills: 65, gold: 5100, level: 5, hoursAgo: 70, uid: 5 },
  { seed: 900012, race: "Troll", sub: "Ninja", cls: "Thief", foe: "Rat", floor: 8, steps: 410, day: 7, kills: 19, gold: 960, level: 3, hoursAgo: 80, uid: 6 },
]);

function devUid(n) {
  return `devuid${String(n).padStart(4, "0")}`;
}

// The dev players' board names (Phase 91.2): plausible, family-friendly gamer
// names, the way Play Games names look on the board, plus one legacy 2.2.0
// @handle so the dev board also shows a D-04 row. Module-private: the board
// reads the names off the docs, nothing else needs this list. One per dev uid
// (uid 1 is the first entry).
const DEV_NAMES = Object.freeze([
  "Moss Knuckle",
  "Dev Delver",
  "pipHollowbrook",
  "Nell of the Mines",
  "Cask_Warden_77",
  "@lanternjaw",
]);

function devHandle(n) {
  return DEV_NAMES[(n - 1) % DEV_NAMES.length];
}

/**
 * devBoardRuns({ now } = {}) — a frozen array of {id, doc} dev board run
 * entries, identical on every call (no Date.now()/Math.random() of its
 * own — `now` defaults to a fixed instant). Every doc passes
 * runDoc.js#validateRunDoc(doc, {}). Throws only if a future edit to
 * DEV_RUNS produces an invalid doc (a coding error in this file, never a
 * runtime condition).
 */
export function devBoardRuns({ now = () => Date.UTC(2026, 8, 29, 12, 0) } = {}) {
  const nowMs = now();
  const entries = DEV_RUNS.map((spec) => {
    const state = newRun(spec.seed, [], { force: { race: spec.race, sub: spec.sub, cls: spec.cls } });
    state.floor.depth = spec.floor;
    state.steps = spec.steps;
    state.day = spec.day;
    state.c.kills = spec.kills;
    state.c.gold = spec.gold;
    state.c.level = spec.level;
    const rng = makeRng(spec.seed + 500000);
    const when = nowMs - spec.hoursAgo * 3600000;
    const summary = die(state, "combat", spec.foe, rng, [], () => when);
    const built = buildRunDoc(summary, {
      uid: devUid(spec.uid),
      handle: devHandle(spec.uid),
      version: DEV_VERSION,
    });
    if (!built.ok) {
      throw new Error(`devBoardSeed: invalid dev run doc for seed ${spec.seed}: ${(built.fails || []).join(",")}`);
    }
    return Object.freeze({ id: built.id, doc: built.doc });
  });
  return Object.freeze(entries);
}
