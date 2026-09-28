#!/usr/bin/env node
// tools/ability-ablation.mjs
//
// Quick 260928-abl: a PAIRED ablation readout for the Fighter and Thief
// special abilities and passives. Dev-only, zero-dependency Node ESM — NOT
// shipped, NOT a node:test file. A TUNING PROXY, not a gate.
//
// Method:
//   1. BASELINE — every seed (i*7919+1, the tools' own list) played with the
//      class forced (`--cls`), shipped dials, BOT_DEFAULTS. One compact row
//      per seed (depth, outcome, the chargen sub/skills, ability use, and
//      the per-ability damage/kill attribution below).
//   2. ABLATION — the same seeds with ONE ability/passive switched off for
//      the hero (tools/lib/ablation.mjs, `opts.ablate`). A seed the ablation
//      cannot touch (ablation.mjs#affectsRow, read off its baseline row) is
//      the baseline run byte for byte, so only the affected seeds are
//      re-played and the rest are copied. `--verify-full` re-plays EVERY
//      seed instead, to prove the shortcut on a small seed count.
//   3. REPORT — per ablation: p50 death depth (interpolated median over
//      non-stuck runs, band-readout.mjs's own), mean depth, reach5, reach8,
//      each with the paired delta vs baseline and a 95% paired-bootstrap
//      interval (2,000 resamples of the seed list, fixed seed).
//
// Attribution (per run, hero only): each step's foe HP removed (the drop in
// every foe's wp across the step, 0-floored; a fight that ends in the step
// resolves its foes through the step's foeKilled events) is credited to the
// hero ability used that step, else "other"; Poisoned Edge's later dotTick
// damage is moved to poisonedEdge. Kills are the step's foeKilled events,
// credited the same way. Joiner damage in the same step rides along (the
// bot accepts one Joiner), so shares are "HP removed on the steps the hero
// pressed X", an upper bound on X's own damage.
//
// The report also carries the baseline split by sub-class, a per-hero-level
// table (combat turns, foe HP removed and hero HP lost per turn, HP removed
// per plain strike / cast / ability turn — the structural class comparison;
// `--cls="Magic User"` gives the caster's row), and for the defensives the
// hero HP lost on the use step and the next.
//
// Flags: --base-seeds=N pairs a smaller --seeds run against the first rows
// of an N-seed baseline (the seed list is prefix-stable); --include-stuck
// counts a stuck run at the depth it reached instead of dropping it (the
// band-readout convention), so both sides of a pair hold the same seeds.
//
// Run:
//   node tools/ability-ablation.mjs --cls=Fighter --seeds=200 --base-seeds=1000 --ablations=all
//   node tools/ability-ablation.mjs --cls=Fighter --seeds=500 --ablations=all
//   node tools/ability-ablation.mjs --cls=Thief --seeds=500 --ablations=ability:feint,skill:Heft
//   node tools/ability-ablation.mjs --cls=Fighter --seeds=500 --report
//   node tools/ability-ablation.mjs --cls=Fighter --seeds=40 --verify-full=ability:kata

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { playRun, BOT_DEFAULTS } from "./lib/tuning-bot.mjs";
import { parseAblation, affectsRow, dialOverridesFor } from "./lib/ablation.mjs";
import { setDialsForTuning } from "../engine/difficulty.js";
import { interpolatedMedian } from "./lib/band-readout.mjs";
import { newRun } from "../engine/engine.js";
import { ABILITIES, ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS, CLASSES } from "../content/index.js";
import { RUN_FLAGS } from "./lib/tuning-bot.mjs";

// --- one run -> one compact row ---------------------------------------------

/** foeDropAcross(prev, next, events) — foe HP removed across one step. */
function foeDropAcross(prev, next, events) {
  if (!prev || !prev.combat || !Array.isArray(prev.combat.foes)) return 0;
  let drop = 0;
  const before = prev.combat.foes;
  if (next.combat && Array.isArray(next.combat.foes)) {
    for (let i = 0; i < before.length; i++) {
      const a = before[i];
      const b = next.combat.foes[i];
      if (!a || !b || !a.alive) continue;
      drop += Math.max(0, Math.max(0, a.wp) - Math.max(0, b.wp));
    }
    return drop;
  }
  // The fight ended inside this step: a foe named by a foeKilled event lost
  // everything it had left; the rest (fled from, talked down) lost nothing.
  const killed = {};
  for (const e of events) if (e.type === "foeKilled") killed[e.name] = (killed[e.name] || 0) + 1;
  for (const a of before) {
    if (!a || !a.alive) continue;
    if (killed[a.name] > 0) {
      killed[a.name]--;
      drop += Math.max(0, a.wp);
    } else {
      // a foe struck this step but not killed, in a fight that ended (a flee
      // after the blow is impossible in one step) — nothing to count.
    }
  }
  return drop;
}

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

/** playRow(seed, opts) — one run, the compact row the report reads. */
export function playRow(seed, opts) {
  const start = newRun(seed, [], { startDepth: opts.startDepth, force: opts.force, ...RUN_FLAGS });
  const row = {
    seed,
    cls: start.c.cls,
    sub: start.c.sub,
    race: start.c.race,
    startSkills: Object.keys(start.c.skills || {}).sort(),
    startAbilities: [...(start.c.abilities || [])],
    fights: 0,
    usage: {},
    refused: {},
    ownerFights: {},
    usedFights: {},
    dmgBy: {},
    killsBy: {},
    dmgTotal: 0,
    killsTotal: 0,
    healed: 0,
    fleeTries: 0,
    fleeOk: 0,
    strikeDmg: {},
    // per hero level (read before the step): combat turns, foe HP removed,
    // hero HP lost, and the removed HP split by the hero's action kind
    byLevel: {},
    // defensives: hero HP lost on the use step and the step after it
    defTaken: {},
    defSteps: {},
    takenTotal: 0,
    combatSteps: 0,
  };
  let prev = start;
  let usedThisFight = new Set();
  let defWindow = null; // { key, left }
  row.startMaxWP = start.c.maxWP;
  // a `dial` ablation (tools/lib/ablation.mjs#dialOverridesFor): the
  // harness-only override lives for this one run and is always restored.
  const dials = dialOverridesFor(opts.ablate, start.c);
  if (dials) setDialsForTuning(dials);
  let run;
  try {
    run = playRunWithRow();
  } finally {
    if (dials) setDialsForTuning({});
  }
  function playRunWithRow() {
  return playRun(seed, opts, (events, state, action) => {
    let used = null;
    for (const e of events) {
      if (e.type === "abilityUsed") {
        used = e.key;
        bump(row.usage, e.key);
        if (!usedThisFight.has(e.key)) {
          usedThisFight.add(e.key);
          bump(row.usedFights, e.key);
        }
      } else if (e.type === "abilityRefused") bump(row.refused, e.key);
      else if (e.type === "encounterStarted") {
        row.fights++;
        usedThisFight = new Set();
        for (const id of state.c.abilities || []) bump(row.ownerFights, id);
      } else if (e.type === "secondWindHealed") row.healed += e.gained ?? e.amount ?? 0;
      else if (e.type === "fled") {
        row.fleeTries++;
        row.fleeOk++;
      } else if (e.type === "fleeFailed") row.fleeTries++;
      else if (e.type === "struck" && e.member === undefined) {
        const tag = e.via || (e.critBy && e.critBy !== "roll" ? e.critBy : e.critical ? "crit" : "plain");
        bump(row.strikeDmg, tag, e.dmg || 0);
      } else if (e.type === "ninjaFirstStrike") bump(row.strikeDmg, "ninjaFirstStrike:count");
    }
    let drop = foeDropAcross(prev, state, events);
    let poison = 0;
    for (const e of events) if (e.type === "dotTick" && e.by === "poisonedEdge") poison += e.dmg || 0;
    poison = Math.min(poison, drop);
    if (poison) {
      bump(row.dmgBy, "poisonedEdge", poison);
      drop -= poison;
    }
    const kind = action && action.type === "attack" ? "attack" : action && action.type === "castSpell" ? "spell" : "other";
    const label = used || kind;
    if (drop) bump(row.dmgBy, label, drop);
    row.dmgTotal += drop + poison;
    let kills = 0;
    for (const e of events) if (e.type === "foeKilled") kills++;
    if (kills) bump(row.killsBy, label, kills);
    row.killsTotal += kills;
    if (prev.combat) {
      const taken = Math.max(0, (prev.c.wp || 0) - (state.c.wp || 0));
      row.takenTotal += taken;
      row.combatSteps++;
      const L = prev.c.level;
      const b = row.byLevel[L] || (row.byLevel[L] = { turns: 0, drop: 0, taken: 0, attack: 0, spell: 0, ability: 0, other: 0, attackTurns: 0, spellTurns: 0, abilityTurns: 0 });
      b.turns++;
      b.drop += drop + poison;
      b.taken += taken;
      const bk = used ? "ability" : kind;
      b[bk] += drop + poison;
      if (bk !== "other") b[`${bk}Turns`]++;
      if (defWindow) {
        bump(row.defTaken, defWindow.key, taken);
        bump(row.defSteps, defWindow.key);
        if (--defWindow.left <= 0) defWindow = null;
      }
      if (used && ABILITY_BY_ID[used] && ABILITY_BY_ID[used].tag === "defensive") {
        bump(row.defTaken, used, taken);
        bump(row.defSteps, used);
        defWindow = { key: used, left: 1 };
      }
    }
    if (!state.combat) defWindow = null;
    prev = state;
  });
  }
  row.deathDepth = run.deathDepth;
  row.dead = run.dead;
  row.stuck = run.stuck;
  row.actions = run.actions;
  row.level = run.state.c.level;
  row.cause = run.cause;
  return row;
}

// --- worker pool ---------------------------------------------------------------

if (!isMainThread) {
  parentPort.on("message", ({ id, seeds, opts }) => {
    const rows = seeds.map((s) => playRow(s, opts));
    parentPort.postMessage({ id, rows });
  });
}

function makePool(n) {
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(new Worker(new URL(import.meta.url)));
  return {
    /** run(seeds, opts) — plays `seeds` across the pool in chunks, rows in seed-list order. */
    run(seeds, opts, chunk = 3) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        for (let i = 0; i < seeds.length; i += chunk) chunks.push(seeds.slice(i, i + chunk));
        const out = new Array(chunks.length);
        let next = 0;
        let done = 0;
        if (!chunks.length) return resolve([]);
        const feed = (w) => {
          if (next >= chunks.length) return;
          const id = next++;
          w.postMessage({ id, seeds: chunks[id], opts });
        };
        for (const w of workers) {
          w.removeAllListeners("message");
          w.removeAllListeners("error");
          w.on("message", ({ id, rows }) => {
            out[id] = rows;
            done++;
            if (done === chunks.length) resolve(out.flat());
            else feed(w);
          });
          w.on("error", reject);
          feed(w);
        }
      });
    },
    close() {
      for (const w of workers) w.terminate();
    },
  };
}

// --- statistics ----------------------------------------------------------------

let INCLUDE_STUCK = false;

function summarize(rows) {
  // --include-stuck: a stuck run (the bot hit maxActions alive) counts at
  // the depth it reached, so both sides of a pair always hold the same seeds.
  const completed = INCLUDE_STUCK ? rows : rows.filter((r) => !r.stuck);
  const depths = completed.map((r) => r.deathDepth).sort((a, b) => a - b);
  const pct = (f) => (completed.length ? (completed.filter((r) => r.deathDepth >= f).length / completed.length) * 100 : 0);
  const mean = completed.length ? depths.reduce((s, d) => s + d, 0) / completed.length : 0;
  return { n: rows.length, stuck: rows.filter((r) => r.stuck).length, p50: interpolatedMedian(depths), mean, reach5: pct(5), reach8: pct(8) };
}

/** mulberry32 — a tiny fixed-seed PRNG for the bootstrap (tooling only). */
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** pairedDelta(base, abl) — point deltas (abl - base) and 95% paired-bootstrap intervals. */
function pairedDelta(base, abl, B = 2000) {
  const n = base.length;
  const b0 = summarize(base);
  const a0 = summarize(abl);
  const keys = ["p50", "mean", "reach5", "reach8"];
  const point = Object.fromEntries(keys.map((k) => [k, a0[k] - b0[k]]));
  const rand = mulberry32(260928);
  const draws = Object.fromEntries(keys.map((k) => [k, []]));
  for (let i = 0; i < B; i++) {
    const bs = new Array(n);
    const as = new Array(n);
    for (let j = 0; j < n; j++) {
      const k = Math.floor(rand() * n);
      bs[j] = base[k];
      as[j] = abl[k];
    }
    const sb = summarize(bs);
    const sa = summarize(as);
    for (const k of keys) draws[k].push(sa[k] - sb[k]);
  }
  const ci = {};
  for (const k of keys) {
    const d = draws[k].sort((x, y) => x - y);
    ci[k] = [d[Math.floor(0.025 * B)], d[Math.floor(0.975 * B) - 1]];
  }
  return { base: b0, abl: a0, point, ci };
}

// --- files ---------------------------------------------------------------------

function slug(spec) {
  return spec.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function clsSlug(cls) {
  return cls.replace(/\s+/g, "").toLowerCase();
}
function rowsPath(o, spec) {
  return path.join(o.dir, `${o.prefix}${clsSlug(o.cls)}-${spec ? slug(spec) : "baseline"}-${o.seeds}.json`);
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(`${p}.tmp`, JSON.stringify(obj));
  fs.renameSync(`${p}.tmp`, p);
}

/** allAblations(cls) — every ablation spec that applies to class `cls`. */
function allAblations(cls) {
  const out = [];
  if (cls === "Fighter" || cls === "Thief") out.push("ability:*");
  for (const a of ABILITIES) if (a.cls === cls) out.push(`ability:${a.id}`);
  const table = cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : {};
  for (const [k, v] of Object.entries(table)) if (!v.active) out.push(`skill:${k}`);
  for (const s of CLASSES[cls]?.subs || []) out.push(`sub:${s}`);
  if (cls === "Thief") out.push("thiefBackstab", "subOpener", "cutthroatCrit", "thiefFlee");
  if (cls === "Fighter") out.push("samuraiBlade");
  return out;
}

// --- CLI -------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { cls: "Fighter", seeds: 500, workers: Math.min(4, os.availableParallelism()), dir: "tools/readouts", reportDir: null, prefix: "260928-abl-", ablations: [], report: false, verifyFull: null, baseSeeds: null };
  for (const arg of argv) {
    const [flag, ...rest] = arg.split("=");
    const v = rest.join("=");
    if (flag === "--cls") o.cls = v;
    else if (flag === "--seeds") o.seeds = parseInt(v, 10);
    else if (flag === "--workers") o.workers = parseInt(v, 10);
    else if (flag === "--dir") o.dir = v;
    else if (flag === "--report-dir") o.reportDir = v;
    else if (flag === "--prefix") o.prefix = v;
    else if (flag === "--ablations") o.ablations = v === "all" ? "all" : v.split(",").filter(Boolean);
    else if (flag === "--report") o.report = true;
    else if (flag === "--verify-full") o.verifyFull = v;
    else if (flag === "--base-seeds") o.baseSeeds = parseInt(v, 10);
    else if (flag === "--include-stuck") o.includeStuck = true;
    else {
      process.stderr.write(`Unknown flag: ${arg}\n`);
      process.exit(2);
    }
  }
  if (!CLASSES[o.cls]) {
    process.stderr.write(`--cls must be one of ${Object.keys(CLASSES).join(", ")}\n`);
    process.exit(2);
  }
  if (o.ablations === "all") o.ablations = allAblations(o.cls);
  for (const s of o.ablations) parseAblation(s); // throws on a bad spec, before any run
  return o;
}

const fmt = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? "-" : (x >= 0 ? "+" : "") + x.toFixed(d));
const fmtAbs = (x, d = 1) => (x === null || x === undefined ? "-" : x.toFixed(d));

function usageLines(base, cls) {
  const lines = [];
  const tot = (k) => base.reduce((s, r) => s + (r[k] || 0), 0);
  const sumMap = (k) => {
    const m = {};
    for (const r of base) for (const [kk, v] of Object.entries(r[k] || {})) m[kk] = (m[kk] || 0) + v;
    return m;
  };
  const usage = sumMap("usage");
  const owner = sumMap("ownerFights");
  const usedF = sumMap("usedFights");
  const dmg = sumMap("dmgBy");
  const kills = sumMap("killsBy");
  const dmgTotal = tot("dmgTotal");
  const killsTotal = tot("killsTotal");
  const fights = tot("fights");
  const ownersRuns = (id) => base.filter((r) => (r.ownerFights[id] || 0) > 0).length;
  const usersRuns = (id) => base.filter((r) => (r.usage[id] || 0) > 0).length;
  lines.push(`Usage and damage share (baseline, ${base.length} runs, ${fights} fights, ${dmgTotal} foe HP removed, ${killsTotal} kills):`);
  lines.push(`  ${"ability".padEnd(14)} ${"ownRuns".padStart(7)} ${"useRuns".padStart(7)} ${"ownFights".padStart(9)} ${"uses".padStart(6)} ${"use/ownFight".padStart(12)} ${"fightsUsed%".padStart(11)} ${"dmg%".padStart(6)} ${"kills%".padStart(6)} ${"dmg/use".padStart(7)}`);
  for (const a of ABILITIES.filter((x) => x.cls === cls)) {
    const id = a.id;
    const u = usage[id] || 0;
    const of = owner[id] || 0;
    lines.push(
      `  ${id.padEnd(14)} ${String(ownersRuns(id)).padStart(7)} ${String(usersRuns(id)).padStart(7)} ${String(of).padStart(9)} ${String(u).padStart(6)} ${(of ? u / of : 0).toFixed(2).padStart(12)} ${(of ? ((usedF[id] || 0) / of) * 100 : 0).toFixed(1).padStart(11)} ${(dmgTotal ? ((dmg[id] || 0) / dmgTotal) * 100 : 0).toFixed(1).padStart(6)} ${(killsTotal ? ((kills[id] || 0) / killsTotal) * 100 : 0).toFixed(1).padStart(6)} ${(u ? (dmg[id] || 0) / u : 0).toFixed(1).padStart(7)}`,
    );
  }
  for (const k of ["attack", "spell", "other"])
    lines.push(`  ${k.padEnd(6)} (hero ${k === "attack" ? "plain strikes" : k === "spell" ? "casts" : "items/flees/waits"}; Joiner damage rides along): dmg ${(dmgTotal ? ((dmg[k] || 0) / dmgTotal) * 100 : 0).toFixed(1)}%  kills ${(killsTotal ? ((kills[k] || 0) / killsTotal) * 100 : 0).toFixed(1)}%`);
  const sd = sumMap("strikeDmg");
  const sdTot = Object.entries(sd).filter(([k]) => !k.endsWith(":count")).reduce((s, [, v]) => s + v, 0);
  lines.push(`Hero strike damage by source (struck events): ${Object.entries(sd).filter(([k]) => !k.endsWith(":count")).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((v / sdTot) * 100).toFixed(1)}%`).join(", ")}`);
  const heal = tot("healed");
  if (heal) lines.push(`Second Wind healed ${heal} HP in total (${(heal / Math.max(1, usage.secondWind || 0)).toFixed(1)} per use)`);
  lines.push(`Flee: ${tot("fleeOk")}/${tot("fleeTries")} attempts succeeded (${((tot("fleeOk") / Math.max(1, tot("fleeTries"))) * 100).toFixed(1)}%), ${(tot("fleeTries") / base.length).toFixed(2)} attempts per run`);
  return lines;
}

/** subLines(base) — the baseline split by sub-class (p50/mean/reach5/reach8). */
function subLines(base) {
  const lines = ["Baseline by sub-class:"];
  const subs = [...new Set(base.map((r) => r.sub))].sort();
  for (const s of subs) {
    const x = summarize(base.filter((r) => r.sub === s));
    lines.push(`  ${s.padEnd(15)} n=${String(x.n).padStart(4)} stuck=${String(x.stuck).padStart(3)} p50=${fmtAbs(x.p50).padStart(4)} mean=${fmtAbs(x.mean, 2).padStart(5)} reach5=${fmtAbs(x.reach5).padStart(5)} reach8=${fmtAbs(x.reach8).padStart(5)}`);
  }
  return lines;
}

/**
 * structuralLines(base) — per hero level: combat turns, foe HP removed per
 * turn, hero HP lost per turn, and HP removed per turn of each action kind
 * (attack = plain strike, spell = a cast, ability = a pressed ability).
 * Joiner/DoT damage rides along on whatever the hero did that step.
 */
function structuralLines(base) {
  const agg = {};
  for (const r of base)
    for (const [L, b] of Object.entries(r.byLevel || {})) {
      const a = agg[L] || (agg[L] = {});
      for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + v;
    }
  const lines = ["Damage per combat turn by hero level (foe HP removed on the step; Joiner/DoT damage rides along):"];
  lines.push(`  ${"lvl".padEnd(4)} ${"turns".padStart(7)} ${"drop/turn".padStart(9)} ${"taken/turn".padStart(10)} ${"atk/atkTurn".padStart(11)} ${"atkTurn%".padStart(8)} ${"spell/cast".padStart(10)} ${"cast%".padStart(6)} ${"abil/use".padStart(8)} ${"abil%".padStart(6)}`);
  for (const L of Object.keys(agg).sort((x, y) => x - y)) {
    const a = agg[L];
    const per = (n, d) => (d ? (n / d).toFixed(2) : "-");
    const pct = (n) => ((n / a.turns) * 100).toFixed(1);
    lines.push(
      `  ${String(L).padEnd(4)} ${String(a.turns).padStart(7)} ${per(a.drop, a.turns).padStart(9)} ${per(a.taken, a.turns).padStart(10)} ${per(a.attack, a.attackTurns).padStart(11)} ${pct(a.attackTurns).padStart(8)} ${per(a.spell, a.spellTurns).padStart(10)} ${pct(a.spellTurns).padStart(6)} ${per(a.ability, a.abilityTurns).padStart(8)} ${pct(a.abilityTurns).padStart(6)}`,
    );
  }
  const tot = (k) => base.reduce((s, r) => s + (r[k] || 0), 0);
  lines.push(`  all: ${tot("combatSteps")} combat turns, ${(tot("dmgTotal") / Math.max(1, tot("combatSteps"))).toFixed(2)} foe HP removed/turn, ${(tot("takenTotal") / Math.max(1, tot("combatSteps"))).toFixed(2)} hero HP lost/turn, ${(tot("fights") / base.length).toFixed(2)} fights/run, ${(tot("combatSteps") / Math.max(1, tot("fights"))).toFixed(2)} turns/fight`);
  return lines;
}

/** defensiveLines(base, cls) — hero HP lost on a defensive's use step + the next, vs the run-wide mean. */
function defensiveLines(base, cls) {
  const sum = (k) => {
    const m = {};
    for (const r of base) for (const [kk, v] of Object.entries(r[k] || {})) m[kk] = (m[kk] || 0) + v;
    return m;
  };
  const taken = sum("defTaken");
  const steps = sum("defSteps");
  const all = base.reduce((s, r) => s + (r.takenTotal || 0), 0) / Math.max(1, base.reduce((s, r) => s + (r.combatSteps || 0), 0));
  const lines = [`Defensives: hero HP lost per combat turn in the use step + the next (all combat turns: ${all.toFixed(2)}; the bot presses these only under half HP, so the window is biased toward hard fights):`];
  for (const a of ABILITIES.filter((x) => x.cls === cls && x.tag === "defensive")) {
    const n = steps[a.id] || 0;
    lines.push(`  ${a.id.padEnd(14)} window turns=${String(n).padStart(6)} lost/turn=${n ? ((taken[a.id] || 0) / n).toFixed(2) : "-"}`);
  }
  return lines;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  INCLUDE_STUCK = !!o.includeStuck;
  // --base-seeds=N: the baseline is the first-N-seed file (played if
  // absent); the ablations and the report pair against its first --seeds
  // rows (the seed list is a prefix-stable i*7919+1).
  const bSeeds = Math.max(o.baseSeeds || 0, o.seeds);
  const seeds = Array.from({ length: o.seeds }, (_, i) => i * 7919 + 1);
  const botOpts = { ...BOT_DEFAULTS, force: { cls: o.cls } };
  const t0 = Date.now();
  const needPool = !o.report || o.verifyFull;
  const pool = needPool ? makePool(o.workers) : null;
  try {
    // --- baseline -------------------------------------------------------------
    const bPath = rowsPath({ ...o, seeds: bSeeds }, null);
    let base;
    if (fs.existsSync(bPath)) base = JSON.parse(fs.readFileSync(bPath, "utf8")).rows;
    else {
      if (!pool) throw new Error(`no baseline at ${bPath}; run without --report first`);
      const t = Date.now();
      base = await pool.run(Array.from({ length: bSeeds }, (_, i) => i * 7919 + 1), botOpts);
      writeJson(bPath, { meta: { tool: "ability-ablation", cls: o.cls, seeds: bSeeds, spec: null, replayed: base.length, elapsedSec: (Date.now() - t) / 1000 }, rows: base });
      process.stderr.write(`baseline ${o.cls}: ${base.length} runs in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
    }
    base = base.slice(0, o.seeds);

    // --- verify the pairing shortcut ----------------------------------------------
    if (o.verifyFull) {
      const ablate = parseAblation(o.verifyFull);
      const t = Date.now();
      const full = await pool.run(seeds, { ...botOpts, ablate });
      const affected = base.map((r) => affectsRow(r, ablate));
      let same = 0;
      let differ = 0;
      let wrong = 0;
      for (let i = 0; i < full.length; i++) {
        const eq = full[i].deathDepth === base[i].deathDepth && full[i].actions === base[i].actions && full[i].dmgTotal === base[i].dmgTotal;
        if (eq) same++;
        else differ++;
        if (!affected[i] && !eq) wrong++;
      }
      console.log(`verify-full ${o.verifyFull}: ${full.length} runs, ${affected.filter(Boolean).length} flagged affected, ${differ} actually differ, ${wrong} differ while flagged unaffected (must be 0) [${((Date.now() - t) / 1000).toFixed(1)}s]`);
      return;
    }

    // --- ablations ------------------------------------------------------------------
    for (const spec of o.report ? [] : o.ablations) {
      const p = rowsPath(o, spec);
      if (fs.existsSync(p)) continue;
      const ablate = parseAblation(spec);
      const idx = [];
      for (let i = 0; i < base.length; i++) if (affectsRow(base[i], ablate)) idx.push(i);
      const t = Date.now();
      const replayed = await pool.run(idx.map((i) => base[i].seed), { ...botOpts, ablate });
      const rows = base.slice();
      idx.forEach((i, k) => {
        // meta from the baseline row (a sub ablation renames the hero's sub)
        rows[i] = { ...replayed[k], sub: base[i].sub, startSkills: base[i].startSkills, affected: true };
      });
      writeJson(p, { meta: { tool: "ability-ablation", cls: o.cls, seeds: o.seeds, spec, replayed: idx.length, elapsedSec: (Date.now() - t) / 1000 }, rows });
      process.stderr.write(`${spec}: replayed ${idx.length}/${base.length} in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
    }

    // --- report -------------------------------------------------------------------
    const b = summarize(base);
    const lines = [];
    lines.push(`ability-ablation ${o.cls}: ${o.seeds} paired seeds (i*7919+1), shipped dials, BOT_DEFAULTS, class forced (sub/race rolled); stuck runs ${INCLUDE_STUCK ? "INCLUDED at the depth reached" : "excluded (band-readout convention)"}`);
    lines.push(`BASELINE p50=${fmtAbs(b.p50)} mean=${fmtAbs(b.mean, 2)} reach5=${fmtAbs(b.reach5)} reach8=${fmtAbs(b.reach8)} stuck=${b.stuck}`);
    lines.push("");
    lines.push(`${"ablation".padEnd(26)} ${"aff".padStart(4)} | ${"p50".padStart(5)} ${"dP50".padStart(6)} ${"[95%]".padEnd(13)} | ${"dMean".padStart(6)} ${"[95%]".padEnd(15)} | ${"reach5".padStart(6)} ${"dR5".padStart(6)} ${"[95%]".padEnd(13)} | ${"reach8".padStart(6)} ${"dR8".padStart(6)} ${"[95%]".padEnd(13)} | stk | affected seeds only: p50 base->abl, dMean [95%], dR5 [95%]`);
    const specs = o.ablations.length ? o.ablations : allAblations(o.cls);
    const json = { cls: o.cls, seeds: o.seeds, baseline: b, ablations: [] };
    for (const spec of specs) {
      const p = rowsPath(o, spec);
      if (!fs.existsSync(p)) continue;
      const rows = JSON.parse(fs.readFileSync(p, "utf8")).rows;
      const d = pairedDelta(base, rows);
      const affIdx = rows.map((r, i) => (r.affected ? i : -1)).filter((i) => i >= 0);
      // the same paired statistics over the affected seeds only (the heroes
      // the ablation acted on: owners/users of the ability, holders of the
      // skill or sub-class)
      const aff = affIdx.length ? pairedDelta(affIdx.map((i) => base[i]), affIdx.map((i) => rows[i])) : null;
      const ciS = (x, k, dd = 1) => `[${fmt(x.ci[k][0], dd)},${fmt(x.ci[k][1], dd)}]`;
      lines.push(
        `${spec.padEnd(26)} ${String(affIdx.length).padStart(4)} | ${fmtAbs(d.abl.p50).padStart(5)} ${fmt(d.point.p50).padStart(6)} ${ciS(d, "p50").padEnd(13)} | ${fmt(d.point.mean, 2).padStart(6)} ${ciS(d, "mean", 2).padEnd(15)} | ${fmtAbs(d.abl.reach5).padStart(6)} ${fmt(d.point.reach5).padStart(6)} ${ciS(d, "reach5").padEnd(13)} | ${fmtAbs(d.abl.reach8).padStart(6)} ${fmt(d.point.reach8).padStart(6)} ${ciS(d, "reach8").padEnd(13)} | ${String(d.abl.stuck).padStart(3)} | ${aff ? `p50 ${fmtAbs(aff.base.p50)}->${fmtAbs(aff.abl.p50)} dMean ${fmt(aff.point.mean, 2)} ${ciS(aff, "mean", 2)} dR5 ${fmt(aff.point.reach5)} ${ciS(aff, "reach5")}` : "-"}`,
      );
      json.ablations.push({ spec, affected: affIdx.length, ...d, affectedOnly: aff });
    }
    lines.push("");
    if (o.cls !== "Magic User") lines.push(...usageLines(base, o.cls));
    lines.push("", ...subLines(base), "", ...structuralLines(base));
    if (o.cls !== "Magic User") lines.push("", ...defensiveLines(base, o.cls));
    const text = lines.join("\n");
    console.log(text);
    const rp = path.join(o.reportDir || o.dir, `${o.prefix}${clsSlug(o.cls)}-report-${o.seeds}${INCLUDE_STUCK ? "-inclstuck" : ""}`);
    fs.writeFileSync(`${rp}.txt`, `${text}\n`);
    writeJson(`${rp}.json`, json);
  } finally {
    if (pool) pool.close();
    process.stderr.write(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s  workers=${o.workers}\n`);
  }
}

if (isMainThread) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
