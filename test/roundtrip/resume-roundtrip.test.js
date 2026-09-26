// test/roundtrip/resume-roundtrip.test.js
//
// SAV-06/SAV-07 (Phase 76, plan 76-04): the generic relaunch proof. A
// relaunch is `rehydrate(validateSave(JSON.stringify(serializeRun(state))))`
// (exactly what engineAdapter#persist writes and engineAdapter#boot reads),
// and it must hand back the live state unchanged: every fight, store and
// pending decision a real run produces, down to every key path.
//
// The orchestrator's rule: this proof is GENERIC over fields. `diffPaths`
// walks both values and names every key path that differs (a key present on
// one side only, or a leaf that is not Object.is-equal), so a field a later
// phase adds to combat, c, party, store or any pending sub-state is covered
// here with no edit. Only the wall-clock fields stripVolatileFields already
// strips (deathAt, graves[].when) are excluded; pendingJoiner is compared
// like everything else (user ruling 2026-09-25).
//
// Corpus:
//   - the parity combat, magic, economy and encounters action scripts,
//     replayed with test/roundtrip/serialize-rehydrate.test.js's shapes, at
//     EVERY action;
//   - a tuning-bot corpus (tools/lib/tuning-bot.mjs#playRun): solo runs,
//     party runs, a forced Magic User (spells, effects), a forced Thief, and
//     deep starts at 8, 14 and 20 (elites begin at floor 16 after 75.3).
//     Every resumable state (live combat, open store, pendingFind,
//     pendingHazard, pendingTile, pendingJoiner) is walked, up to a per-run
//     cap, and then probed: the same next action applied to the live and
//     the loaded state must give the same next state and events (the fight
//     continues on the same dice).
//
// Dead states are not walked: a dead save relaunches to the roller
// (mazeworld.html's hadSaveAtLaunch is false for `dead`), so it is never
// resumed, and its leftover in-fight hero effects are cleared on load by
// design (engine/saveState.js#clearFoeEffect/clearStaleTimers with no
// surviving fight).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun, applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate, serializeRun, resumeEventsFor } from "../../engine/saveState.js";
import { startCombat } from "../../engine/combat.js";
import { descend } from "../../engine/movement.js";
import { makeRng } from "../../engine/rng.js";
import { openStore } from "../../engine/economy.js";
import { springTrap, openChest, encounterDot, meetJoiner } from "../../engine/encounters.js";
import { stripVolatileFields } from "../parity/harness/diffState.js";
import { playRun, legalDirs } from "../../tools/lib/tuning-bot.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "parity", "fixtures", `action-script.${name}.json`), "utf8"));

// ─── the generic walk ────────────────────────────────────────────────────

/**
 * diffPaths(live, loaded) — every key path where the two values differ: a
 * key present on one side only, an array length, or a leaf that is not
 * Object.is-equal (so Infinity, NaN, undefined and -0 all count). Returns
 * [] when the two are identical. Names paths like `combat.foes[1].elite`.
 */
function diffPaths(live, loaded, at = "", out = []) {
  if (Object.is(live, loaded)) return out;
  const lo = live !== null && typeof live === "object";
  const ro = loaded !== null && typeof loaded === "object";
  if (!lo || !ro || Array.isArray(live) !== Array.isArray(loaded)) {
    out.push(`${at || "(root)"}: ${describe(live)} -> ${describe(loaded)}`);
    return out;
  }
  if (Array.isArray(live)) {
    if (live.length !== loaded.length) out.push(`${at}.length: ${live.length} -> ${loaded.length}`);
    const n = Math.min(live.length, loaded.length);
    for (let i = 0; i < n; i++) diffPaths(live[i], loaded[i], `${at}[${i}]`, out);
    return out;
  }
  for (const k of new Set([...Object.keys(live), ...Object.keys(loaded)])) {
    const p = at ? `${at}.${k}` : k;
    const inLive = Object.prototype.hasOwnProperty.call(live, k);
    const inLoaded = Object.prototype.hasOwnProperty.call(loaded, k);
    if (!inLive || !inLoaded) {
      out.push(`${p}: ${inLive ? `${describe(live[k])} -> (missing after load)` : `(absent live) -> ${describe(loaded[k])}`}`);
      continue;
    }
    diffPaths(live[k], loaded[k], p, out);
  }
  return out;
}

function describe(v) {
  if (v === undefined) return "undefined";
  if (typeof v === "number" && (Number.isNaN(v) || !Number.isFinite(v) || Object.is(v, -0))) return String(Object.is(v, -0) ? "-0" : v);
  const s = JSON.stringify(v);
  return s && s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/** The relaunch: exactly what persist() writes and boot() reads. */
function relaunched(state) {
  const check = validateSave(JSON.stringify(serializeRun(state)), { freshSeed: 1 });
  assert.ok(check.ok, `the save validates (${check.reason})`);
  return rehydrate(check.value);
}

/** Every key path the relaunch changes (wall-clock fields excluded). */
function relaunchDiff(state) {
  return diffPaths(stripVolatileFields(state), stripVolatileFields(relaunched(state)));
}

/** The sub-states a relaunch must resume. */
const RESUMABLE = ["combat", "store", "pendingFind", "pendingHazard", "pendingTile", "pendingJoiner"];
const resumable = (s) => !s.dead && RESUMABLE.some((k) => s[k]);

/** The next action the determinism probe applies, by sub-state. */
function probeAction(s) {
  if (s.combat) return s.combat.pending ? { type: "fight" } : { type: "attack" };
  if (s.store) return { type: "leaveStore" };
  if (s.pendingFind) return { type: "leaveFind" };
  if (s.pendingHazard) return { type: "move", dir: s.pendingHazard.dir };
  if (s.pendingJoiner) return { type: "resolveJoiner", accept: false };
  const dirs = legalDirs(s);
  return { type: "move", dir: dirs[0] || "N" };
}

// ─── the fixture replay shapes (test/roundtrip/serialize-rehydrate.test.js) ─

function applyInternal(state, fn) {
  const next = structuredClone(state);
  const rng = makeRng(next.rngState);
  const events = [];
  fn(next, rng, events);
  next.rngState = rng.getState();
  return { state: next, events };
}

const INTERNAL_FNS = { openStore, springTrap, openChest, encounterDot, descend };

function replayStep(state, action) {
  if (action.type === "startCombat") return applyInternal(state, (s, rng, ev) => startCombat(s, action.wandering, action.forced, rng, ev));
  if (action.type in INTERNAL_FNS) return applyInternal(state, INTERNAL_FNS[action.type]);
  return applyAction(state, action);
}

const FIXTURE_SCENARIOS = [
  ...fixture("combat").scenarios.map((s) => ({ ...s, name: `combat/${s.name}` })),
  ...fixture("magic").scenarios.map((s) => ({ ...s, name: `magic/${s.name}` })),
  { ...fixture("economy"), name: "economy/store" },
  ...fixture("encounters").scenarios.map((s) => ({ ...s, name: `encounters/${s.name}` })),
];

// ─── the bot corpus ──────────────────────────────────────────────────────

// Walked states per run are capped so the whole file stays under about 60 s
// (tune the cap, never the breadth of this list).
const PER_RUN_CAP = 150;
const MU = Object.freeze({ cls: "Magic User", sub: "Sorcerer", race: "Human" });
const THIEF = Object.freeze({ cls: "Thief", sub: "Pilfer", race: "Human" });
const CORPUS = [
  { label: "solo-101", seed: 101, opts: { maxActions: 800 } },
  { label: "solo-202", seed: 202, opts: { maxActions: 800 } },
  { label: "solo-808", seed: 808, opts: { maxActions: 800 } },
  { label: "solo-909", seed: 909, opts: { maxActions: 800 } },
  { label: "party-404", seed: 404, opts: { maxActions: 800, party: true } },
  { label: "party-1404", seed: 1404, opts: { maxActions: 800, party: true } },
  { label: "mu-505", seed: 505, opts: { maxActions: 800, force: MU } },
  { label: "mu-deep8-515", seed: 515, opts: { maxActions: 600, startDepth: 8, force: MU } },
  { label: "thief-303", seed: 303, opts: { maxActions: 800, force: THIEF } },
  { label: "deep8-606", seed: 606, opts: { maxActions: 600, startDepth: 8 } },
  { label: "deep8-616", seed: 616, opts: { maxActions: 600, startDepth: 8 } },
  { label: "deep14-party-626", seed: 626, opts: { maxActions: 600, startDepth: 14, party: true } },
  { label: "deep14-646", seed: 646, opts: { maxActions: 600, startDepth: 14 } },
  { label: "deep20-707", seed: 707, opts: { maxActions: 400, startDepth: 20 } },
  { label: "deep20-717", seed: 717, opts: { maxActions: 400, startDepth: 20 } },
  { label: "deep20-727", seed: 727, opts: { maxActions: 400, startDepth: 20 } },
];

/**
 * The explicit states walked beside the bot corpus, so the store and Joiner
 * non-vacuity floors never hinge on the bot's route: a pending Joiner offer
 * built through the real meetJoiner (seed 4247: an Elven hero meets a
 * Fighter, no Wilmsry refusal) and an open store built through the real
 * openStore.
 */
function explicitStates() {
  const joiner = newRun(4247);
  meetJoiner(joiner, makeRng(joiner.rngState));
  const store = newRun(4246);
  openStore(store, makeRng(store.rngState));
  return [
    { label: "explicit-joiner", state: joiner },
    { label: "explicit-store", state: store },
  ];
}

let corpusCache = null;

/**
 * corpus() — runs the whole corpus once (memoised) and returns the counts
 * and every failure, so each test below asserts one property of the same
 * sweep. The bot is never perturbed: serializeRun copies, applyAction
 * clones its input, and the probes run on their own copies.
 */
function corpus() {
  if (corpusCache) return corpusCache;
  const counts = {
    runs: 0,
    steps: 0,
    walked: 0,
    combat: 0,
    combatWithAllies: 0,
    combatWithElite: 0,
    joinedPastRound2: 0,
    heroEffectInFight: 0,
    store: 0,
    pendingFind: 0,
    pendingHazard: 0,
    pendingTile: 0,
    pendingJoiner: 0,
    explicitStore: 0,
    explicitJoiner: 0,
    probes: 0,
  };
  const walkFailures = [];
  const precisionFailures = [];
  const probeFailures = [];

  const visit = (label, step, state) => {
    counts.walked++;
    const C = state.combat;
    if (C) {
      counts.combat++;
      if (Array.isArray(C.allies) && C.allies.length) counts.combatWithAllies++;
      if (Array.isArray(C.foes) && C.foes.some((f) => f && f.elite)) counts.combatWithElite++;
      if (!C.pending && C.round > 2) counts.joinedPastRound2++;
      if (state.c.foeEffect) counts.heroEffectInFight++;
    }
    for (const k of RESUMABLE.slice(1)) if (state[k]) counts[k]++;

    // Precision: each resumable value, and the rng cursor, JSON round-trips
    // Object.is-equal at every path (no Infinity, NaN, undefined or -0).
    for (const k of [...RESUMABLE, "rngState"]) {
      if (state[k] === undefined || state[k] === null) continue;
      const paths = diffPaths(state[k], JSON.parse(JSON.stringify(state[k])), k);
      if (paths.length) precisionFailures.push({ label, step, paths });
    }

    let loaded;
    try {
      loaded = relaunched(state);
    } catch (err) {
      walkFailures.push({ label, step, paths: [`relaunch threw: ${err.message}`] });
      return;
    }
    const paths = diffPaths(stripVolatileFields(state), stripVolatileFields(loaded));
    if (paths.length) {
      walkFailures.push({ label, step, paths });
      return;
    }

    // Resume determinism: the same next action on the live and the loaded
    // state gives the same next state and events.
    const action = probeAction(state);
    counts.probes++;
    try {
      const a = applyAction(structuredClone(state), action);
      const b = applyAction(loaded, action);
      const statePaths = diffPaths(stripVolatileFields(a.state), stripVolatileFields(b.state));
      const eventPaths = diffPaths(stripVolatileFields(a.events), stripVolatileFields(b.events), "events");
      if (statePaths.length || eventPaths.length) probeFailures.push({ label, step, action, paths: [...statePaths, ...eventPaths] });
    } catch (err) {
      probeFailures.push({ label, step, action, paths: [`probe threw: ${err.message}`] });
    }
  };

  for (const { label, seed, opts } of CORPUS) {
    counts.runs++;
    let step = 0;
    let walked = 0;
    playRun(seed, opts, (events, state) => {
      step++;
      counts.steps++;
      if (walked >= PER_RUN_CAP || !resumable(state)) return;
      walked++;
      visit(label, step, state);
    });
  }
  for (const { label, state } of explicitStates()) {
    if (state.store) counts.explicitStore++;
    if (state.pendingJoiner) counts.explicitJoiner++;
    visit(label, 0, state);
  }

  corpusCache = { counts, walkFailures, precisionFailures, probeFailures };
  return corpusCache;
}

const report = (failures) =>
  failures
    .slice(0, 5)
    .map((f) => `${f.label} step ${f.step}${f.action ? ` ${JSON.stringify(f.action)}` : ""}: ${f.paths.slice(0, 6).join("; ")}`)
    .join("\n");

// ─── tests ───────────────────────────────────────────────────────────────

test("SAV-06/SAV-07 (Phase 76): the parity combat, magic, economy and encounters scripts survive a relaunch at EVERY action, every key path unchanged", () => {
  let walked = 0;
  let sawCombat = false;
  let sawStore = false;
  for (const scenario of FIXTURE_SCENARIOS) {
    let state = newRun(scenario.seed);
    scenario.actions.forEach((action, i) => {
      state = replayStep(state, action).state;
      if (state.dead) return; // a dead save is never resumed (header)
      walked++;
      if (state.combat) sawCombat = true;
      if (state.store) sawStore = true;
      const paths = relaunchDiff(state);
      assert.deepStrictEqual(paths, [], `${scenario.name}, action ${i} (${JSON.stringify(action)}): the relaunch changed ${paths.join("; ")}`);
    });
  }
  assert.ok(walked > 20, `the fixture sweep walked ${walked} states`);
  assert.ok(sawCombat && sawStore, "the fixture sweep covered a live fight and an open store");
});

test("SAV-06/SAV-07 (Phase 76): every resumable state in the bot corpus survives a relaunch with every key path unchanged (combat, c, party, store, every pending field)", () => {
  const { counts, walkFailures } = corpus();
  assert.ok(counts.walked > 0, "the corpus walked states");
  assert.equal(walkFailures.length, 0, `${walkFailures.length} relaunched states differ from the live ones:\n${report(walkFailures)}`);
});

test("SAV-06 (Phase 76) precision: no JSON-unsafe value (Infinity, NaN, undefined, -0) in any live fight, store or pending decision, and the rng cursor round-trips exactly", () => {
  const { precisionFailures } = corpus();
  assert.equal(precisionFailures.length, 0, `a JSON-unsafe value in a live fight, store or pending decision:\n${report(precisionFailures)}`);
});

test("SAV-06 (Phase 76) resume determinism: the same next action on the live and the relaunched state gives the same next state and events", () => {
  const { counts, probeFailures } = corpus();
  assert.ok(counts.probes > 0, "the probe ran");
  assert.equal(probeFailures.length, 0, `the relaunched state plays differently:\n${report(probeFailures)}`);
});

test("SAV-06/SAV-07 (Phase 76) non-vacuity: the corpus saw enough fights (with allies, and joined past round 2), an open store and a pending Joiner offer", () => {
  const { counts } = corpus();
  // Recorded in 76-04-SUMMARY.md.
  console.log(`resume-roundtrip corpus counts: ${JSON.stringify(counts)}`);
  assert.ok(counts.combat >= 50, `at least 50 combat states (saw ${counts.combat})`);
  assert.ok(counts.combatWithAllies >= 1, `at least one fight with allies (saw ${counts.combatWithAllies})`);
  assert.ok(counts.joinedPastRound2 >= 1, `at least one joined fight past round 2 (saw ${counts.joinedPastRound2})`);
  assert.ok(counts.store >= 1, `at least one open store (saw ${counts.store}, ${counts.explicitStore} of them explicit)`);
  assert.ok(counts.pendingJoiner >= 1, `at least one pending Joiner offer (saw ${counts.pendingJoiner}, ${counts.explicitJoiner} of them explicit)`);
  assert.ok(counts.combatWithElite >= 1, `the deep starts met an elite (saw ${counts.combatWithElite})`);
});

test("SAV-06 (Phase 76): a relaunch keeps a purse above the bag's cap (the load only clamps a bag a legacy worn fold spilled into)", () => {
  const s = newRun(4246);
  s.c.bag = "small"; // a 2,000-wilmst purse cap
  s.c.gold = 2729;
  s.c.rations = 11; // above the small bag's 10
  const loaded = relaunched(s);
  assert.equal(loaded.c.gold, 2729, "the over-cap purse survives the relaunch (live play never clamps a gain)");
  assert.equal(loaded.c.rations, 11, "over-cap rations survive too");
  assert.deepStrictEqual(relaunchDiff(s), []);
});

// Old-shape fight: a combat carrying only the keys startCombat's literals
// write unconditionally (state.combat's { foes, type, round, target,
// spellOpen, tracked, pending } and each foe's eleven base keys). Every
// optional field added since (abilities, elite, initiative and effect
// fields, and anything 75.x or later adds) is stripped, as in a save written
// by an older build.
const COMBAT_LITERAL_KEYS = ["foes", "type", "round", "target", "spellOpen", "tracked", "pending"];
const FOE_LITERAL_KEYS = ["name", "type", "lvl", "size", "intel", "wp", "maxWP", "alive", "asleep", "sp", "lives"];

function oldShape(combat) {
  const out = {};
  for (const k of COMBAT_LITERAL_KEYS) if (k in combat) out[k] = combat[k];
  out.foes = combat.foes.map((f) => {
    const foe = {};
    for (const k of FOE_LITERAL_KEYS) if (k in f) foe[k] = f[k];
    return foe;
  });
  return out;
}

test("SAV-06 (Phase 76): an old-shape fight (only startCombat's literal keys) resumes, and survives fight, attack and flee without throwing", () => {
  for (const seed of [4254, 4242, 4264]) {
    // (1) the encounter step, stripped to the literal.
    const s = newRun(seed);
    startCombat(s, false, null, makeRng(s.rngState));
    s.combat = oldShape(s.combat);
    const loaded = relaunched(s);
    assert.ok(loaded.combat, `seed ${seed}: the old-shape encounter resumes`);
    assert.deepStrictEqual(resumeEventsFor(loaded), [{ type: "fightResumed", round: 1, pending: true, foes: s.combat.foes.length }]);
    let joined;
    assert.doesNotThrow(() => {
      joined = applyAction(loaded, { type: "fight" }).state;
    }, `seed ${seed}: fight`);
    for (const type of ["attack", "flee"]) {
      assert.doesNotThrow(() => applyAction(structuredClone(joined), { type }), `seed ${seed}: ${type} after fight`);
    }

    // (2) a joined fight (fight clears `pending`), stripped to the literal.
    const t = newRun(seed);
    startCombat(t, false, null, makeRng(t.rngState));
    const joinedLive = applyAction(t, { type: "fight" }).state;
    if (!joinedLive.combat) continue; // the fight ended at initiative
    joinedLive.combat = oldShape(joinedLive.combat);
    const loadedJoined = relaunched(joinedLive);
    assert.ok(loadedJoined.combat, `seed ${seed}: the old-shape joined fight resumes`);
    assert.ok(!loadedJoined.combat.pending, `seed ${seed}: it resumes joined`);
    for (const type of ["attack", "flee", "fight"]) {
      assert.doesNotThrow(() => applyAction(structuredClone(loadedJoined), { type }), `seed ${seed}: ${type} on the joined old-shape fight`);
    }
  }
});
