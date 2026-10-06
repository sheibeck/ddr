// tools/store-screenshots/seed.mjs
//
// Phase 102 (SHOTS-01). The one harness file that imports repo code. It builds,
// offline and with no browser, everything the capture run needs to reach a
// screen quickly: the mid-game achievements record, the resumable saves and
// the injected overlay states, all from the game's own engine and pure
// modules. Then it runs its consistency checks and writes seeds.json, which
// the browser side reads as data.
//
//   node seed.mjs --check   run every check, print PASS or FAIL per check
//   node seed.mjs           run the checks, then write seeds.json
//
// Rules this file keeps:
//   - It never imports the engine adapter and never spells the achievements
//     storage key; the key comes in through ACHIEVEMENTS_KEY and travels to
//     the browser side inside seeds.json.
//   - Nothing built here ships. seeds.json is gitignored and no repo folder
//     that ships (engine, content, src, the page, android, www) is touched.
//   - Every state it hands over has dev false, so no DEV chip can appear and
//     the tracker counts the run.
//   - Expected on-screen strings are computed from the game's own copy
//     modules, never typed here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "./config.js";

import { newRun } from "../../engine/state.js";
import { applyAction } from "../../engine/engine.js";
import { validateSave, serializeRun } from "../../engine/saveState.js";
import { openStore } from "../../engine/economy.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
import { abilityState } from "../../engine/abilities.js";
import { reveal } from "../../engine/maze.js";
import { revealRadius } from "../../engine/derived.js";
import { liveFoes } from "../../engine/combat.js";
import { ABILITY_BY_ID } from "../../content/index.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { BESTIARY } from "../../content/bestiary.js";
import { CLASSES } from "../../content/classes.js";
import { RACES } from "../../content/races.js";

import { ACHIEVEMENTS_KEY, emptyRecord, sanitizeRecord, serializeRecord } from "../../src/browser/achievementRecord.js";
import { beginRun, foldAction, progressFor } from "../../src/browser/achievementTracker.js";
import { buildAchievementsView, ACHIEVEMENTS_SHEET_COPY, ACHIEVEMENT_BLOCKS, formatEarnedDate } from "../../src/browser/achievementsSheet.js";
import { earnedStripView, ACHIEVEMENT_CARD_COPY } from "../../src/browser/achievementCard.js";
import { abilityStateLabel } from "../../src/browser/abilityStates.js";
import { flavorOfAbility, flavorOfIdentity, flavorOfSkill } from "../../src/browser/flavorText.js";
import { devBoardRuns } from "../../src/browser/devBoardSeed.js";
import { layoutClassFor } from "../../src/browser/layoutClass.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SEEDS_PATH = path.join(HERE, "seeds.json");

const DAY_MS = 86400000;
const HERO_SEEDS = Array.from({ length: 54 }, (_, i) => 7 + i); // 7 to 60
const DEEP_DEPTH = 9;
const DEATH_DEPTH = 10;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clone = (v) => JSON.parse(JSON.stringify(v));
const norm = (s) => String(s).normalize("NFC").replace(/\s+/g, " ").trim();
const uniq = (list) => [...new Set(list)];

function fail(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const saveOf = (state) => JSON.stringify(serializeRun(state));

/** The save the shell resumes: validateSave is what the shell runs on load. */
function resumed(save) {
  const v = validateSave(save);
  assert(v.ok, "validateSave refused a seeded save: " + (v.reason || "?"));
  return v.value;
}

function versionName() {
  const text = fs.readFileSync(path.join(REPO, "android", "version.properties"), "utf8");
  const m = /^versionName=(.+)$/m.exec(text);
  assert(m, "android/version.properties has no versionName");
  return m[1].trim();
}

// ---------------------------------------------------------------------------
// The achievements record
// ---------------------------------------------------------------------------

const BY_ID = new Map(ACHIEVEMENTS.map((e) => [e.id, e]));
const CATALOG = [...ACHIEVEMENTS].sort((a, b) => a.listOrder - b.listOrder);

// Standard entries a mid-game player has earned: the Teetotaler flag (a start
// at floor 5 or deeper reads as a run with no healing potion drunk, so a first
// beginRun would earn it) and a first-floor death.
const STANDARD_EARNED = Object.freeze(["teetotaler", "special_snowflake"]);

/**
 * The mid-game numbers. Kill counts sit well below their next threshold so a
 * fight or two in the capture run can never cross one, and every best sits at
 * or above what any scene's hero holds, so a first fold raises no surprise.
 */
function midGameNumbers(heroes) {
  const bestGold = Math.max(5420, ...heroes.map((h) => h.c.gold));
  const bestDays = Math.max(27, ...heroes.map((h) => h.day));
  const depthByRace = { Human: 6, Elven: 7, Dwarven: 5, Wilmsry: 8, Fridgian: 4, Troll: 6 };
  const depthByClass = { "Magic User": 7, Fighter: 8, Thief: 6 };
  for (const h of heroes) {
    depthByRace[h.c.race] = Math.max(depthByRace[h.c.race] || 0, DEEP_DEPTH);
    depthByClass[h.c.cls] = Math.max(depthByClass[h.c.cls] || 0, DEEP_DEPTH);
  }
  return {
    counters: { deaths: 31, joinersAccepted: 12, joinersFallen: 6, parleysWon: 6, trapsSurvived: 27 },
    kills: { Beasts: 112, Demons: 23, Humans: 64, "Lair Beasts": 55, Magical: 52, "Walking Dead": 31 },
    bests: { depth: DEEP_DEPTH, days: bestDays, wilmstHeld: bestGold, fleesWon: 4, depthByRace, depthByClass },
  };
}

/** The first n sub-class names in catalog order, always including `must`. */
function delvedSubs(must, n) {
  const all = Object.values(CLASSES).flatMap((cls) => cls.subs);
  const picked = all.filter((name) => name !== must).slice(0, n - 1);
  picked.splice(Math.min(3, picked.length), 0, must);
  return picked;
}

/**
 * buildMidGameRecord(heroes, hero, now) — the record the list reads. unlocked
 * is derived from the numbers (every incremental entry whose measured value
 * has reached its steps, plus the two standard entries above), revealed from
 * the reveal pairs, dates spread over the 30 days before `now` with earlier
 * tiers earlier.
 */
function buildMidGameRecord(heroes, hero, now) {
  const nums = midGameNumbers(heroes);
  const draft = clone(emptyRecord());
  Object.assign(draft.counters, nums.counters);
  Object.assign(draft.kills, nums.kills);
  Object.assign(draft.bests, { depth: nums.bests.depth, days: nums.bests.days, wilmstHeld: nums.bests.wilmstHeld, fleesWon: nums.bests.fleesWon });
  Object.assign(draft.bests.depthByRace, nums.bests.depthByRace);
  Object.assign(draft.bests.depthByClass, nums.bests.depthByClass);
  draft.subClassesDelved = delvedSubs(hero.c.sub, 9);
  draft.run = null;

  const earnedIds = [];
  for (const entry of CATALOG) {
    if (entry.type === "incremental") {
      const p = progressFor(draft, entry);
      if (p && p.value >= p.steps) earnedIds.push(entry.id);
    } else if (STANDARD_EARNED.includes(entry.id)) {
      earnedIds.push(entry.id);
    }
  }

  // Dates: earlier tiers earlier, then list order; 28.5 days ago down to 0.6.
  const order = earnedIds
    .map((id) => BY_ID.get(id))
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.listOrder - b.listOrder);
  order.forEach((entry, i) => {
    const frac = order.length > 1 ? i / (order.length - 1) : 1;
    const daysAgo = 28.5 - frac * 27.9;
    const jitterHours = (i * 7) % 11;
    draft.unlocked[entry.id] = Math.floor(now - daysAgo * DAY_MS - jitterHours * 3600000);
  });

  // Reveals: a Hidden entry is revealed when an earned entry names it.
  const earned = new Set(earnedIds);
  const revealed = [];
  for (const entry of CATALOG) {
    if (!earned.has(entry.id)) continue;
    for (const id of Array.isArray(entry.reveals) ? entry.reveals : []) {
      const target = BY_ID.get(id);
      if (target && target.initialState === "Hidden" && !revealed.includes(id)) revealed.push(id);
    }
  }
  draft.revealed = revealed;

  const rec = sanitizeRecord(draft);
  // Through the game's own writer and reader, so the stored text is what the game writes.
  return sanitizeRecord(JSON.parse(serializeRecord(rec)));
}

// ---------------------------------------------------------------------------
// The hero and its scenes
// ---------------------------------------------------------------------------

const FORCE = Object.freeze({ cls: "Fighter" });

function freshHero(seed, startDepth) {
  const state = newRun(seed, [], { force: { ...FORCE }, storeRoll: true, startDepth });
  state.dev = false; // the dev flag drives the DEV chip, and the tracker ignores dev states
  return state;
}

/** Settle a non-fight decision the way a player declining it would. */
function settle(state) {
  let s = state;
  for (let i = 0; i < 6; i++) {
    if (s.pendingFind) s = applyAction(s, { type: "leaveFind" }).state;
    else if (s.pendingJoiner) s = applyAction(s, { type: "resolveJoiner", accept: false }).state;
    else if (s.pendingLoot && s.pendingLoot.length) s = applyAction(s, { type: "leaveAllLoot" }).state;
    else if (s.store) s = applyAction(s, { type: "leaveStore" }).state;
    else if (s.pendingHazard) s = applyAction(s, { type: "resolveHazard", cross: false }).state;
    else break;
  }
  return s;
}

/**
 * findFight(hero) — a breadth-first walk of floor 1 with real move actions
 * (each applyAction clones, so every node is its own state) to the nearest
 * step that starts a fight with at least two foes. Returns the state before
 * that step and the direction, or null.
 */
function findFight(hero) {
  const root = resumed(saveOf(hero));
  const seen = new Set([root.floor.px + "," + root.floor.py]);
  const queue = [{ st: root, steps: 0 }];
  let nodes = 0;
  while (queue.length && nodes < 1500) {
    const { st, steps } = queue.shift();
    nodes++;
    for (const dir of ["N", "S", "E", "W"]) {
      const r = applyAction(st, { type: "move", dir });
      const s = r.state;
      if (s.combat) {
        if (s.combat.pending && liveFoes(s).length >= 2) return { before: st, dir, foes: liveFoes(s).length, steps: steps + 1 };
        continue;
      }
      const settled = settle(s);
      if (settled.dead || settled.combat || settled.pendingTeleport || settled.pendingTile) continue;
      if (settled.floor.depth !== st.floor.depth) continue;
      const key = settled.floor.px + "," + settled.floor.py;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ st: settled, steps: steps + 1 });
    }
  }
  return null;
}

/**
 * The click path the capture will take, replayed in node on the resumed save:
 * the move, the fight step, one ability the menu shows ready, one strike.
 */
function replayFight(fight) {
  let s = applyAction(fight.before, { type: "move", dir: fight.dir }).state;
  assert(s.combat && s.combat.pending, "the move no longer starts a fight");
  s = applyAction(s, { type: "fight" }).state;
  assert(s.combat && !s.dead, "the fight step ended the run or the fight");
  const owned = s.c.abilities || [];
  const ready = owned.filter((key) => abilityState(s, s.c, key).state === "ready");
  assert(ready.length >= 1, "no ability reads ready after the fight step");
  const pointed = ready.filter((key) => {
    const meta = ABILITY_BY_ID[key];
    return meta && (meta.target === "foe" || meta.target === "foes");
  });
  const key = (pointed.length ? pointed : ready)[0];
  const used = applyAction(s, { type: "useAbility", key });
  assert(!used.events.some((e) => e.type === "abilityRefused"), "the ability was refused");
  s = used.state;
  assert(s.combat && !s.dead, "the fight ended on the ability");
  s = applyAction(s, { type: "attack" }).state;
  assert(!s.dead, "the hero died in the replay");
  assert(s.combat && liveFoes(s).length > 0, "the fight finished inside the replay");
  assert(s.c.wp > 0, "the hero is down in the replay");
  return { end: s, abilityKey: key };
}

/** Mark a believable explored region on a fresh floor and walk the party into it. */
function exploreFloor(state) {
  const floor = state.floor;
  const dist = new Map([["1,1", 0]]);
  const prev = new Map();
  const queue = [[1, 1]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const cell = floor.g[ny] && floor.g[ny][nx];
      const key = nx + "," + ny;
      if (!cell || cell.wall || cell.feat || cell.water || dist.has(key)) continue;
      dist.set(key, dist.get(x + "," + y) + 1);
      prev.set(key, x + "," + y);
      queue.push([nx, ny]);
    }
  }
  for (const target of [34, 44, 54, 24, 64, 74, 84, 94, 104, 114]) {
    // The cell whose walking distance is nearest the target, farthest first on a tie.
    let best = null;
    for (const [key, d] of dist) {
      if (best === null || Math.abs(d - target) < Math.abs(dist.get(best) - target) || (Math.abs(d - target) === Math.abs(dist.get(best) - target) && d > dist.get(best))) best = key;
    }
    const trial = clone(state);
    const walk = [];
    for (let k = best; k !== undefined; k = prev.get(k)) walk.unshift(k);
    for (const k of walk) {
      const [x, y] = k.split(",").map(Number);
      trial.floor.px = x;
      trial.floor.py = y;
      reveal(trial.floor, revealRadius({ floor: trial.floor, c: trial.c }));
    }
    let open = 0;
    for (const row of trial.floor.g) for (const cell of row) if (cell.seen && !cell.wall) open++;
    if (open >= 70) return { state: trial, walked: walk.length - 1, openSeen: open };
  }
  return fail("no walk reveals 70 open cells");
}

function seenOpenCells(state) {
  let open = 0;
  for (const row of state.floor.g) for (const cell of row) if (cell.seen && !cell.wall) open++;
  return open;
}

function buildHeroBundle(seed, now) {
  const level1 = freshHero(seed, 1);
  assert((level1.c.abilities || []).length >= 2, "the level-1 hero owns fewer than two abilities");
  const fight = findFight(level1);
  assert(fight, "no step on floor 1 starts a fight with two or more foes");
  const replay = replayFight(fight);

  // deep: the same hero levelled to the depth, explored a little.
  const deepBase = freshHero(seed, DEEP_DEPTH);
  const explored = exploreFloor(deepBase);
  const deep = explored.state;
  deep.steps = 40 * DEEP_DEPTH + explored.walked;
  deep.day = Math.ceil(deep.steps / 48);
  deep.c.kills = 41;

  // store: the deep hero in a store, with gold that buys some lines and not others.
  const store = clone(deep);
  openStore(store, makeRng(5), []);
  const costs = store.store.stock.map((l) => l.cost).sort((a, b) => a - b);
  assert(costs.length >= 6, "the store has fewer than six stock lines");
  store.c.gold = costs[Math.floor(costs.length / 2)] + 5;

  // death: a hero on the floor below, taken through the real die() with a named foe.
  const deathBase = freshHero(seed, DEATH_DEPTH);
  const deathExplored = exploreFloor(deathBase);
  const beforeDeath = deathExplored.state;
  beforeDeath.steps = 40 * DEATH_DEPTH + deathExplored.walked;
  beforeDeath.day = Math.ceil(beforeDeath.steps / 48);
  beforeDeath.c.kills = 47;
  const foeName = BESTIARY.Beasts[3][0].n;
  const afterDeath = clone(beforeDeath);
  const deathEvents = [];
  die(afterDeath, "combat", foeName, makeRng(4), deathEvents, () => now);

  return { seed, level1, fight, replay, deep, store, beforeDeath, afterDeath, deathEvents, foeName };
}

// ---------------------------------------------------------------------------
// The scenes' data
// ---------------------------------------------------------------------------

function heroLines(c) {
  const lines = [];
  for (const [kind, key] of [["race", c.race], ["class", c.cls], ["sub", c.sub]]) {
    const line = flavorOfIdentity(kind, key);
    if (line) lines.push(norm(line));
  }
  for (const key of c.abilities || []) {
    const meta = ABILITY_BY_ID[key];
    const line = meta ? flavorOfAbility(meta.name) : "";
    if (line) lines.push(norm(line));
  }
  for (const name of Object.keys(c.skills || {})) {
    const line = flavorOfSkill(name);
    if (line) lines.push(norm(line));
  }
  return uniq(lines);
}

function boardExpect() {
  const runs = devBoardRuns();
  // The deepest run per player, the order the board shows them in.
  const byUid = new Map();
  for (const { doc } of runs) {
    const have = byUid.get(doc.uid);
    if (!have || doc.floor > have.floor) byUid.set(doc.uid, doc);
  }
  const docs = [...byUid.values()].sort((a, b) => b.floor - a.floor);
  const names = docs.map((d) => norm(d.handle));
  return { text: names.slice(0, 3), optional: names.slice(3), floors: docs.map((d) => d.floor) };
}

function buildScenes(bundle, records, now) {
  const { level1, fight, replay, deep, store, afterDeath, foeName } = bundle;
  const { midGame, afterDeathRecord, stripIds } = records;

  const settings = { compete: true, movement: "arrows", padSide: "right", nameWelcomed: true, sound: false };

  const abilityRows = (replay.end.c.abilities || []).map((key) => {
    const meta = ABILITY_BY_ID[key];
    return { key, name: meta.name, label: abilityStateLabel(abilityState(replay.end, replay.end.c, key), meta) };
  });

  const view = buildAchievementsView(midGame, { tzOffset: 0 });
  const strip = earnedStripView(stripIds);
  const deepHeroLines = heroLines(deep.c);

  const scenes = {
    title: { record: serializeRecord(midGame) },
    combat: {
      save: saveOf(fight.before),
      dir: fight.dir,
      abilityKey: replay.abilityKey,
      abilityName: ABILITY_BY_ID[replay.abilityKey].name,
      record: serializeRecord(midGame),
      expect: {
        text: uniq(abilityRows.map((r) => norm(r.label))),
        abilities: abilityRows.map((r) => ({ key: r.key, name: norm(r.name), label: norm(r.label) })),
        foes: replay.end.combat.foes.length,
      },
    },
    deep: {
      save: saveOf(deep),
      record: serializeRecord(midGame),
      expect: { text: [], depth: deep.floor.depth },
    },
    achievements: {
      save: saveOf(deep),
      record: serializeRecord(midGame),
      expect: {
        text: [norm(ACHIEVEMENTS_SHEET_COPY.title), norm(view.earnedText), norm(view.secretsText), norm(view.blocks[0].title)],
        earned: view.earned,
        total: view.total,
        secrets: view.secrets,
      },
    },
    death: {
      state: JSON.stringify(serializeRun(afterDeath)),
      record: serializeRecord(afterDeathRecord),
      stripIds,
      expect: {
        text: [norm(ACHIEVEMENT_CARD_COPY.strip.label), ...strip.items.map((i) => norm(i.name))],
        epitaph: norm(afterDeath.epitaph),
        foe: foeName,
      },
    },
    hero: {
      save: saveOf(deep),
      record: serializeRecord(midGame),
      expect: { text: deepHeroLines, name: norm(deep.c.name) },
    },
    store: {
      state: JSON.stringify(serializeRun(store)),
      record: serializeRecord(midGame),
      expect: { text: [], optional: store.store.stock.slice(0, 4).map((l) => norm(l.n)), lines: store.store.stock.length, gold: store.c.gold },
    },
    board: {
      save: saveOf(deep),
      record: serializeRecord(midGame),
      expect: boardExpect(),
    },
  };
  return { settings, scenes };
}

// ---------------------------------------------------------------------------
// Build everything for one hero seed
// ---------------------------------------------------------------------------

function buildAll(seed, now) {
  const bundle = buildHeroBundle(seed, now);
  const heroes = [bundle.level1, bundle.fight.before, bundle.deep, bundle.store, bundle.beforeDeath];
  const midGame = buildMidGameRecord(heroes, bundle.level1, now);

  // The death: beginRun at the start, then foldAction over the events die() emitted.
  const begun = beginRun(midGame, bundle.beforeDeath, { now });
  const folded = foldAction(begun.record, bundle.deathEvents, bundle.beforeDeath, bundle.afterDeath, { now });
  const stripIds = folded.unlocks.map((u) => u.id);
  const afterDeathRecord = folded.record;

  const records = { midGame, afterDeathRecord, stripIds, begun, folded };
  const built = buildScenes(bundle, records, now);
  return { seed, now, bundle, records, ...built };
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

function runChecks(all) {
  const { bundle, records, scenes, now } = all;
  const { midGame, afterDeathRecord, stripIds } = records;
  const results = [];
  const check = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, ok: true, detail: detail === undefined ? "" : String(detail) });
    } catch (e) {
      results.push({ name, ok: false, detail: e.message });
    }
  };
  const earnedIds = Object.keys(midGame.unlocked);

  check("record: 14 to 30 unlocked entries", () => {
    assert(earnedIds.length >= 14 && earnedIds.length <= 30, `${earnedIds.length} unlocked`);
    return `${earnedIds.length} of ${ACHIEVEMENTS.length}`;
  });
  check("record: dates inside the 30 days before the build time", () => {
    const lo = now - 30 * DAY_MS;
    for (const [id, at] of Object.entries(midGame.unlocked)) assert(Number.isInteger(at) && at > lo && at < now, `${id} at ${at} is outside the window`);
    assert(formatEarnedDate(Math.min(...Object.values(midGame.unlocked)), 0) !== null, "a date does not format");
  });
  check("record: earlier tiers carry earlier dates", () => {
    const t = (id) => midGame.unlocked[id];
    assert(t("depth_t1") < t("hoarder_t2") || t("kills_beasts_t1") < t("kills_beasts_t2"), "tier order is not reflected");
    assert(t("kills_beasts_t1") < t("kills_beasts_t2"), "Beasts tier I is not before tier II");
    assert(t("survivor_t1") < t("survivor_t2"), "Survivor tier I is not before tier II");
  });
  check("record: at least three incremental tracks in progress", () => {
    const tracks = new Set();
    for (const entry of ACHIEVEMENTS) {
      if (entry.type !== "incremental" || midGame.unlocked[entry.id] !== undefined) continue;
      const p = progressFor(midGame, entry);
      if (p.value > 0 && p.value < p.steps) tracks.add(entry.id.replace(/_t\d$/, ""));
    }
    assert(tracks.size >= 3, `${tracks.size} in progress`);
    return `${tracks.size} tracks`;
  });
  check("record: at least four Hidden entries still unrevealed", () => {
    const hidden = ACHIEVEMENTS.filter((e) => e.initialState === "Hidden" && midGame.unlocked[e.id] === undefined && !midGame.revealed.includes(e.id));
    assert(hidden.length >= 4, `${hidden.length} unrevealed`);
    return `${hidden.length} unrevealed`;
  });
  check("record: nothing its numbers already earn is missing from unlocked", () => {
    const probe = foldAction(midGame, [], bundle.level1, clone(bundle.level1), { now });
    assert(probe.unlocks.length === 0, `a fold would unlock ${probe.unlocks.map((u) => u.id).join(", ")}`);
    assert(probe.reveals.length === 0, `a fold would reveal ${probe.reveals.join(", ")}`);
    for (const entry of ACHIEVEMENTS) {
      if (entry.type !== "incremental") continue;
      const p = progressFor(midGame, entry);
      const has = midGame.unlocked[entry.id] !== undefined;
      assert(has === (p.value >= p.steps), `${entry.id}: unlocked ${has} but value ${p.value} of ${p.steps}`);
    }
  });
  check("record: it survives the game's own writer and reader unchanged", () => {
    assert(serializeRecord(sanitizeRecord(JSON.parse(serializeRecord(midGame)))) === serializeRecord(midGame), "round trip differs");
  });
  check("record: every best sits at or above every scene's hero", () => {
    for (const h of [bundle.level1, bundle.deep, bundle.store, bundle.beforeDeath]) {
      assert(midGame.bests.days >= h.day, "days best is under a hero's day");
      assert(midGame.bests.wilmstHeld >= h.c.gold, "wilmst best is under a hero's gold");
      assert(midGame.bests.depthByRace[h.c.race] >= DEEP_DEPTH, "race best is under the deep floor");
    }
    assert(midGame.bests.depth >= DEEP_DEPTH, "depth best is under the deep floor");
  });
  for (const [label, hero] of [
    ["combat hero", bundle.level1],
    ["deep hero", bundle.deep],
    ["store hero", bundle.store],
    ["death hero", bundle.beforeDeath],
  ]) {
    check(`beginRun over the ${label} returns zero unlocks`, () => {
      const r = beginRun(midGame, hero, { now });
      assert(r.unlocks.length === 0, `unlocks ${r.unlocks.map((u) => u.id).join(", ")}`);
      assert(r.reveals.length === 0, `reveals ${r.reveals.join(", ")}`);
    });
  }
  check("death: strip ids come from the real tracker over a real death", () => {
    assert(records.begun.unlocks.length === 0, "beginRun unlocked something before the death");
    const folded = records.folded.unlocks.map((u) => u.id);
    assert(stripIds.every((id) => folded.includes(id)), "a strip id is not in the fold result");
    assert(stripIds.length >= 2 && stripIds.length <= 4, `${stripIds.length} strip ids`);
    assert(bundle.deathEvents.some((e) => e.type === "died"), "die() emitted no died event");
    assert(bundle.afterDeath.dead === true, "die() left the run alive");
    assert(earnedStripView(stripIds) !== null, "the strip view is empty");
    assert(Object.keys(afterDeathRecord.unlocked).length === earnedIds.length + stripIds.length, "the post-death record does not hold the strip unlocks");
    return stripIds.join(", ");
  });
  check("combat: two or more abilities and the replay survives", () => {
    assert((bundle.level1.c.abilities || []).length >= 2, "fewer than two abilities");
    assert(bundle.fight.foes >= 2, "fewer than two foes");
    assert(bundle.replay.end.combat && liveFoes(bundle.replay.end).length > 0 && !bundle.replay.end.dead, "the fight did not survive the replay");
    return `${bundle.level1.c.abilities.length} abilities, ${bundle.fight.foes} foes, ${bundle.fight.steps} steps, ${bundle.replay.abilityKey}`;
  });
  check("combat: the saved state is what the shell resumes", () => {
    const back = resumed(scenes.combat.save);
    assert(!back.dev && !back.combat && !back.store && !back.pendingFind, "the save carries a pending screen");
    assert(back.floor.depth === 1, "the combat save is not on floor 1");
  });
  check("deep: depth, dev flag and explored cells", () => {
    assert(bundle.deep.floor.depth >= 8, `depth ${bundle.deep.floor.depth}`);
    assert(bundle.deep.dev === false, "dev is set");
    const cells = seenOpenCells(bundle.deep);
    assert(cells >= 70, `${cells} seen open cells`);
    assert(resumed(scenes.deep.save).dev === false, "the resumed save carries dev");
    return `depth ${bundle.deep.floor.depth}, ${cells} open cells seen`;
  });
  check("store: at least six stock lines, some affordable and some not", () => {
    const lines = bundle.store.store.stock;
    assert(lines.length >= 6, `${lines.length} lines`);
    const gold = bundle.store.c.gold;
    assert(lines.some((l) => l.cost <= gold) && lines.some((l) => l.cost > gold), "gold does not split the stock");
    assert(bundle.store.dev === false, "dev is set");
    return `${lines.length} lines at ${gold} wilmst`;
  });
  check("scenes: all eight, with the data each needs", () => {
    for (const s of config.SCENES) assert(scenes[s.id], `scene ${s.id} is missing`);
    for (const id of ["combat", "deep", "achievements", "hero", "board"]) assert(typeof scenes[id].save === "string" && scenes[id].save.length > 100, `${id} has no save`);
    for (const id of ["death", "store"]) assert(typeof scenes[id].state === "string" && scenes[id].state.length > 100, `${id} has no state`);
    for (const id of Object.keys(scenes)) assert(typeof scenes[id].record === "string", `${id} has no record`);
    assert(scenes.hero.expect.text.length >= 3, "the hero scene has fewer than three flavour lines");
    assert(scenes.board.expect.text.length === 3, "the board scene does not name three players");
  });
  check("layout classes: phone compact, both tablets expanded (at least 840 x 480)", () => {
    const { SIZES } = config;
    assert(layoutClassFor(...SIZES.phone.css) === "compact" && SIZES.phone.layoutClass === "compact", "the phone is not compact");
    for (const key of ["tab7", "tab10"]) {
      const [w, h] = SIZES[key].css;
      assert(layoutClassFor(w, h) === "expanded" && SIZES[key].layoutClass === "expanded", `${key} is not expanded`);
      assert(w >= 840 && h >= 480, `${key} is under 840 x 480`);
    }
  });
  check("export sizes sit strictly inside Play's limits", () => {
    for (const [key, size] of Object.entries(config.SIZES)) {
      const [w, h] = size.px;
      const hi = Math.max(w, h);
      const lo = Math.min(w, h);
      assert(hi < 3840 && lo > 320, `${key}: ${w} x ${h} sits on a side limit`);
      assert(hi / lo < 2, `${key}: aspect ${(hi / lo).toFixed(3)} sits on the 2:1 limit`);
      assert(Math.abs(hi / lo - 16 / 9) < 0.001, `${key}: not 16:9`);
      assert((h > w) === (size.orientation === "portrait"), `${key}: orientation`);
      if (key !== "phone") assert(lo >= 1080, `${key}: a tablet side is under 1080`);
      assert(Math.round(size.css[0] * size.dpr) === w && Math.round(size.css[1] * size.dpr) === h, `${key}: css times scale is not the export size`);
    }
  });
  check("harness data stays out of the shipping folders", () => {
    // seed.mjs writes one file, and it is the gitignored seeds.json beside it.
    assert(path.dirname(SEEDS_PATH) === HERE, "seeds.json is not beside this file");
    assert(fs.readFileSync(path.join(HERE, ".gitignore"), "utf8").split(/\r?\n/).includes("seeds.json"), "seeds.json is not gitignored");
  });
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const checkOnly = process.argv.includes("--check");
  const now = Date.now();

  let all = null;
  const tried = [];
  for (const seed of HERO_SEEDS) {
    try {
      const candidate = buildAll(seed, now);
      const results = runChecks(candidate);
      const bad = results.filter((r) => !r.ok);
      if (bad.length === 0) {
        all = { candidate, results };
        break;
      }
      tried.push(`seed ${seed}: ${bad.map((b) => b.name + " (" + b.detail + ")").join("; ")}`);
    } catch (e) {
      tried.push(`seed ${seed}: ${e.message}`);
    }
  }
  if (!all) {
    for (const line of tried) console.log("SKIP " + line);
    console.log("FAIL no hero seed in 7 to 60 passes every check");
    process.exit(1);
  }

  for (const line of tried) console.log("SKIP " + line);
  const { candidate, results } = all;
  const hero = candidate.bundle.level1.c;
  console.log(`hero seed ${candidate.seed}: ${hero.name}, ${hero.race} ${hero.sub} (${hero.cls}), abilities ${hero.abilities.join(", ")}`);
  for (const r of results) console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? " - " + r.detail : ""));

  if (checkOnly) return;

  const out = {
    generatedAt: new Date(candidate.now).toISOString(),
    notesVersion: versionName(),
    achievementsKey: ACHIEVEMENTS_KEY,
    heroSeed: candidate.seed,
    settings: candidate.settings,
    scenes: candidate.scenes,
  };
  fs.writeFileSync(SEEDS_PATH, JSON.stringify(out, null, 1) + "\n");
  console.log("wrote " + path.relative(REPO, SEEDS_PATH));
}

main();
