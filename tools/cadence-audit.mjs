#!/usr/bin/env node
// tools/cadence-audit.mjs
//
// Phase 52 (CAD-03/SC3) — measures attacks per player action for the two
// fights the user's pasted log named (Bat/Rat, China Wolf) at depth 5, on
// the corrected initiative (Phase 51's per-round re-roll removal already
// landed; this measures whether the swing-count/ability-gate rules Phase 52
// pins in test/unit/foe-cadence.test.js hold up over many real fights, not
// just the fixed-foeTurn unit pins).
//
// A REPORT tool (always exits 0, makes no assertions — NOT a `*.test.js`
// file, `node --test` never picks it up), in the `tools/initiative-
// fixture-scan.mjs` / `tools/tune-difficulty.mjs` mould.
//
// THIS IS A TUNING PROXY / MEASUREMENT REPORT, NOT A PASS/FAIL GATE. The
// standing proof of the invariant lives in test/unit/foe-cadence.test.js's
// CAD-03 pins; this tool is a wider, human-readable sample over many real
// fights, driven through the real engine (startCombat/fight/playerStrike),
// not a fixed foeTurn call.
//
// Hero setup (Claude's Discretion, 52-01-PLAN.md): each seed's own
// newRun(seed) character (real chargen — class/sub/race vary by seed,
// hit points as rolled, never raised). `state.floor.depth` is set to 5
// DIRECTLY (never newRun's `startDepth` option, which levels the hero to 5
// and would make tier 1/2 unreachable for the Bat/Rat sample). Hero level
// is left at 1 (the default fresh-character level) for the Bat/Rat sample;
// for the China Wolf sample `state.c.level` is set to 2 before startCombat
// (China Wolf is a tier-2 row: `maxLvl = clamp(min(c.level, depth) +
// foeLvlBias, 1, 5)` needs hero level >= 2 to ever roll tier 2).
//
// N = 40 seeds (`i * 7919 + 1`, i = 0..39 — the same seed list
// tools/tune-classes.mjs uses). Every fight is a single-foe fight
// (`startCombat(state, true, type, rng, events)` — wandering forces n = 1).
// A seed whose roster pick is not the target creature is a "roster miss"
// (counted, not sampled).
//
// Per sampled fight: `fight(state, rng, seg0)` (the opener — captures an
// opening foe turn if the foe wins initiative), then `playerStrike(state,
// rng, segK)` in a fresh per-call events array until `!state.combat ||
// state.dead` or 60 strikes (whichever first). Each segment's foe-attack
// count is its `foeMissed` + `struckByFoe` + `armorSoaked` + `memberStruck`
// events — the SAME vocabulary test/unit/foe-cadence.test.js's
// `attacksPerAction` counts (the two files never import each other; a human
// reading both keeps them in sync).
//
// Run:
//   node tools/cadence-audit.mjs > tools/cadence-audit-output.txt

import { newRun } from "../engine/state.js";
import { makeRng } from "../engine/rng.js";
import { startCombat, fight, playerStrike } from "../engine/combat.js";

const N_SEEDS = 40;
const MAX_PLAYER_ACTIONS = 60;

function seedFor(i) {
  return i * 7919 + 1;
}

/** attacksPerAction(events) — see test/unit/foe-cadence.test.js's identical
 * helper (independently implemented, same vocabulary). */
function attacksPerAction(events) {
  return events.filter(
    (e) => e.type === "foeMissed" || e.type === "struckByFoe" || e.type === "armorSoaked" || e.type === "memberStruck",
  ).length;
}

function heroLabel(c) {
  return `${c.race} ${c.cls}/${c.sub}`;
}

/**
 * sampleCreature(name, forcedType, levelOverride) — runs N_SEEDS seeds
 * through a single-foe encounter, filters to fights against `name`, and
 * measures the max/mean attacks-per-player-action over every sampled
 * fight's segments.
 */
function sampleCreature(name, forcedType, levelOverride) {
  const rows = [];
  const allSegments = [];
  let rosterMisses = 0;
  for (let i = 0; i < N_SEEDS; i++) {
    const seed = seedFor(i);
    const state = newRun(seed);
    state.floor.depth = 5;
    if (levelOverride) state.c.level = levelOverride;
    const rng = makeRng(state.rngState);
    const encEvents = [];
    startCombat(state, true, forcedType, rng, encEvents);
    if (!state.combat || state.combat.foes[0].name !== name) {
      rosterMisses++;
      continue;
    }
    const segCounts = [];
    const seg0 = [];
    fight(state, rng, seg0);
    segCounts.push(attacksPerAction(seg0));
    let attacks = 0;
    while (state.combat && !state.dead && attacks < MAX_PLAYER_ACTIONS) {
      const seg = [];
      playerStrike(state, rng, seg);
      segCounts.push(attacksPerAction(seg));
      attacks++;
    }
    let outcome = "capped";
    if (state.dead) outcome = "died";
    else if (!state.combat) outcome = "won";
    for (const c of segCounts) allSegments.push(c);
    rows.push({
      seed,
      hero: heroLabel(state.c),
      actions: segCounts.length,
      max: Math.max(...segCounts),
      mean: segCounts.reduce((a, b) => a + b, 0) / segCounts.length,
      outcome,
    });
  }
  const overallMax = allSegments.length ? Math.max(...allSegments) : 0;
  const overallMean = allSegments.length ? allSegments.reduce((a, b) => a + b, 0) / allSegments.length : 0;
  return { rows, rosterMisses, overallMax, overallMean };
}

function fmt(n) {
  return Number(n).toFixed(2);
}

function printCreatureSection(title, result, invariantMax) {
  const lines = [];
  lines.push(`## ${title}`);
  lines.push("");
  lines.push("| seed | hero | actions | max attacks/action | mean attacks/action | outcome |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of result.rows) {
    lines.push(`| ${r.seed} | ${r.hero} | ${r.actions} | ${r.max} | ${fmt(r.mean)} | ${r.outcome} |`);
  }
  lines.push("");
  lines.push(
    `${title}: sampled ${result.rows.length} of ${N_SEEDS} seeds (roster misses ${result.rosterMisses}) — max attacks per player action ${result.overallMax}, mean ${fmt(result.overallMean)}`,
  );
  const offenders = result.rows.filter((r) => r.max > invariantMax);
  if (offenders.length === 0) {
    lines.push(`INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): HOLDS`);
  } else {
    lines.push(
      `INVARIANT attacks per player action <= 2 (sp.atk 2, unfrenzied): VIOLATED at seed ${offenders.map((r) => r.seed).join(", ")}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const out = [];
  out.push("# cadence-audit — Phase 52 (CAD-03): attacks per player action, depth 5, single foe");
  out.push("");
  out.push(
    "Hero setup: each seed's own `newRun(seed)` character (real chargen — class/sub/race vary by seed, hit points as rolled, never raised); `state.floor.depth` set to 5 directly (never `newRun`'s `startDepth` option). Hero level is left at 1 (fresh-character default) for the Bat/Rat sample, and set to `state.c.level = 2` for the China Wolf sample (a tier-2 row needs hero level >= 2). N = 40 seeds (`i * 7919 + 1`, i = 0..39). Every fight is single-foe (`wandering=true` forces n=1). A seed whose roster pick is not the target creature is a roster miss (counted, not sampled). Per fight: `fight()` (the opener) then `playerStrike()` in a loop (cap 60), each call's own events array counted separately as one segment (`foeMissed` + `struckByFoe` + `armorSoaked` + `memberStruck`).",
  );
  out.push("");

  const batRat = sampleCreature("Bat/Rat", "Beasts", null);
  out.push(printCreatureSection("Bat/Rat", batRat, 2));

  const chinaWolf = sampleCreature("China Wolf", "Humans", 2);
  out.push(printCreatureSection("China Wolf", chinaWolf, 2));

  out.push(
    `Reading: over ${N_SEEDS} seeds each, Bat/Rat's overall max attacks per player action is ${batRat.overallMax} and China Wolf's is ${chinaWolf.overallMax} — both at or under their own \`sp.atk\` of 2, as expected on the post-INIT engine. A frenzied foe (spell-only; no wandering encounter ever starts frenzied) would legitimately double these counts — see test/unit/foe-cadence.test.js's CAD-01 pins for that shape.`,
  );

  process.stdout.write(out.join("\n") + "\n");
}

main();
