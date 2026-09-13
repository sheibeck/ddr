#!/usr/bin/env node
// tools/bestiary-yardstick.mjs
//
// Dev-only, zero-dependency Node ESM script — NOT shipped, NOT a node:test
// file (it makes no assertions, so `node --test` never picks it up). Pure,
// deterministic (no Math.random, no engine/ import) TTK/RTD calculator that
// reproduces .planning/phases/18-bestiary-rebalance-canon-combat-fixes/
// 18-RESEARCH.md's "Rebalance Yardstick" methodology (BEST-01/BEST-02,
// D-01/D-02) from the LIVE content/bestiary.js table — never a hand-copied
// one. Imports nothing from engine/ and nothing third-party: only node:
// builtins plus a dynamic import() of the bestiary module (default
// content/bestiary.js, resolved relative to THIS FILE's own location, never
// relative to cwd; override with --bestiary=<path> for e.g. a historical
// snapshot such as `git show e01ac46:content/bestiary.js > /tmp/before.js`).
//
// THIS IS AN INFORMATIONAL SANITY SIGNAL (D-16), NOT A PASS/FAIL GATE. It
// flags outliers (>2x tier-median TTK or lethality — D-02's strict rule) for
// a human (or the planner) to review in content/BESTIARY-REBALANCE.md — it
// never blocks a build, a commit, or a CI check.
//
// Run:
//   node tools/bestiary-yardstick.mjs --mechanics=prototype   (the BEFORE table)
//   node tools/bestiary-yardstick.mjs                          (AFTER, canon — the default)
//   node tools/bestiary-yardstick.mjs --json
//   node tools/bestiary-yardstick.mjs --bestiary=./tmp/before-bestiary.js

import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

// --- constants (18-RESEARCH.md "Rebalance Yardstick" methodology) ---------

// Hero strikes on STRIKE_DICE[level-1] (content/misc-tables.js).
const STRIKE_DICE = [20, 12, 10, 8, 6];
// Foe strikes on max(8, STRIKE_DICE[level-1]) (engine/derived.js#foeDie).
const FOE_DIE = [20, 12, 10, 8, 8];
// Composite hero maxWP per level: averaged across MU/Fighter/Thief at
// chargen + average level-ups, Human race, no store purchases, no skills
// (18-RESEARCH.md "Hero-side formulas").
const HERO_HP = [41.7, 46.2, 50.0, 54.5, 60.0];
// Generic composite hero to-hit need — the midpoint of MU=3 / Fighter=5 /
// Thief=4 (content/classes.js), used as a single-composite proxy across all
// three classes (18-RESEARCH.md).
const GENERIC_NEED = 4;
// A tier-N foe needs <=5 to hit an unarmoured, unskilled Human hero
// (engine/derived.js#foeToHitVs's baseline of 5).
const FOE_NEED = 5;

/**
 * heroAvgDmg(L) — the composite hero's average damage per HIT (not per
 * swing) at level L: level^2 (the universal per-level base-damage term,
 * engine/combat.js#playerStrike) + 4.69 (the three classes' weapon+prof
 * average, 18-RESEARCH.md).
 */
function heroAvgDmg(L) {
  return L * L + 4.69;
}

// sp flags surfaced in the per-row "flags" column, in a fixed, deterministic
// order (matches 18-RESEARCH.md's own flag vocabulary for this phase).
const SP_FLAGS = ["twice", "slow", "halfDmg", "magicOnly", "fast", "caster", "never_melee"];

/**
 * computeYardstick(BESTIARY, { mechanics }) -> { mechanics, rows, tiers }
 *
 * Pure, no rng, no engine import. Iterates `Object.entries(BESTIARY)` in
 * insertion order, then tier index 0..4, then array order — THIS ORDERING
 * IS A CONTRACT: it makes two runs against the same content byte-identical
 * (see toMarkdown's determinism), so the generated table is diffable across
 * commits.
 *
 * mechanics:
 *   "prototype" — ar/slow/halfDmg are inert (matches the engine's ACTUAL
 *     behavior before this phase's CANON-01/03/05 land).
 *   "canon" (default) — models the four canon modifiers this phase adds:
 *     foe natural armor soak (D-05..D-07), Sterling halfDmg (D-10), and
 *     Philly-style slow (D-12). The source-x-type multiplier table
 *     (CANON-04) is NOT modeled here — it depends on the caster's class,
 *     which the composite hero abstraction doesn't have; it is out of this
 *     script's scope by design (spells never reach this melee-only yardstick).
 */
export function computeYardstick(BESTIARY, { mechanics = "canon" } = {}) {
  const rows = [];
  for (const [type, tierArrays] of Object.entries(BESTIARY)) {
    for (let tierIndex = 0; tierIndex < tierArrays.length; tierIndex++) {
      const L = tierIndex + 1;
      const entries = tierArrays[tierIndex] || [];
      for (const entry of entries) {
        rows.push(computeRow(type, L, entry, mechanics));
      }
    }
  }

  // Per-tier medians, then per-row ratios + the strict D-02 flag.
  const tiers = {};
  for (let L = 1; L <= 5; L++) {
    const tierRows = rows.filter((r) => r.tier === L);
    const finiteTtks = tierRows.map((r) => r.ttk).filter((t) => Number.isFinite(t));
    const rtds = tierRows.map((r) => r.rtd);
    const medianTTK = median(finiteTtks);
    const medianRTD = median(rtds);
    tiers[L] = { medianTTK, medianRTD, rows: tierRows.length };
    for (const r of tierRows) {
      r.ttkRatio = Number.isFinite(r.ttk) ? r.ttk / medianTTK : Infinity;
      r.lethality = medianRTD / r.rtd;
      if (!Number.isFinite(r.ttk)) {
        r.flag = "infinite";
      } else if (r.ttkRatio > 2.0 || r.lethality > 2.0) {
        // STRICT greater-than (D-02): a row at exactly 2.00x is NOT flagged.
        r.flag = "over-tier";
      } else if (r.ttkRatio < 0.5 || r.lethality < 0.5) {
        r.flag = "under-tier";
      } else {
        r.flag = "";
      }
    }
  }

  return { mechanics, rows, tiers };
}

function computeRow(type, L, entry, mechanics) {
  const sp = entry.sp || {};
  const d = STRIKE_DICE[L - 1];

  // Effective hero to-hit need against THIS foe.
  let need = GENERIC_NEED;
  if (sp.toHit !== undefined) need = Math.min(need, sp.toHit);
  if (sp.fast) need = Math.max(1, need - 1);
  if (sp.magicOnly) need = 0; // the composite hero carries no magic weapon

  // Hit / crit probabilities on the hero's strike die.
  let pHit;
  let pCrit;
  if (mechanics === "canon" && sp.slow) {
    // D-12: roll twice, keep the LOWER — player-favorable (low = hit).
    pHit = 1 - Math.pow((d - need) / d, 2);
    pCrit = 1 - Math.pow((d - 1) / d, 2);
  } else {
    pHit = need / d;
    pCrit = 1 / d;
  }

  // D-05: foe natural armor fully soaks a non-crit physical hit with
  // probability sp.ar/20 — melee-only yardstick, so this always applies to
  // the hero's own strike.
  const arBlock = mechanics === "canon" && sp.ar > 0 ? sp.ar / 20 : 0;

  let E;
  if (need === 0) {
    E = 0; // magicOnly, no magic weapon in this composite hero's kit
  } else {
    // Non-crit hits (pHit - pCrit) are soaked with probability arBlock; the
    // natural-1 crit (pCrit) is doubled and bypasses the soak (D-07).
    E = heroAvgDmg(L) * ((pHit - pCrit) * (1 - arBlock) + 2 * pCrit);
    if (mechanics === "canon" && sp.halfDmg) E = E / 2; // D-10, applies to everything
  }

  const ttk = E > 0 ? (entry.wp / E) * (sp.twice ? 2 : 1) : Infinity;

  // Foe side (engine/combat.js#foeTurn's actual formula, mirrored exactly):
  // dmg = lvl*lvl + (sp.dmg ? rollDice(sp.dmg) : d6-fallback).
  const atk = sp.atk || 1;
  const avgDice = sp.dmg ? (sp.dmg.n * (sp.dmg.sides + 1)) / 2 + (sp.dmg.bonus || 0) : 3.5;
  const foeDie = FOE_DIE[L - 1];
  const foeDPR = (atk * (L * L + avgDice) * (FOE_NEED + 1)) / foeDie;
  const rtd = HERO_HP[L - 1] / foeDPR;

  const flags = SP_FLAGS.filter((f) => sp[f]);

  return {
    tier: L,
    type,
    name: entry.n,
    wp: entry.wp,
    atk,
    dmg: sp.dmg ? sp.dmg : null,
    toHit: sp.toHit !== undefined ? sp.toHit : null,
    ar: sp.ar ? sp.ar : null,
    flags,
    E,
    ttk,
    foeDPR,
    rtd,
    // ttkRatio / lethality / flag are filled in above, once the tier's
    // medians are known.
  };
}

/** median(values) — standard median: middle value, or the mean of the two
 * middle values for an even-length array. Returns NaN for an empty array
 * (an empty tier — never happens on the live 53-row bestiary, but a
 * synthetic test bestiary may pad unused tiers with `[]`). */
function median(values) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

// --- rendering -------------------------------------------------------------

function fmt(n) {
  if (n === Infinity) return "inf";
  if (Number.isNaN(n)) return "inf";
  return n.toFixed(2);
}

function fmtDmg(dmg) {
  if (!dmg) return "d6*"; // engine's own fallback (engine/combat.js#foeTurn)
  return `${dmg.n}d${dmg.sides}+${dmg.bonus || 0}`;
}

const COLUMNS = [
  "Tier", "Type", "Creature", "wp", "atk", "dmg", "toHit", "ar", "flags",
  "heroE", "TTK", "xTTKmed", "foeDPR", "RTD", "xLethal", "Flag",
];

/**
 * toMarkdown(result) -> string
 *
 * One markdown table (no surrounding headings): a one-line mechanics/median
 * summary (does NOT start with "| ", so it's not mistaken for a table row),
 * then the header row, the separator row, then one row per creature — all
 * three of which DO start with "| ". Deterministic: identical input always
 * produces byte-identical output.
 */
export function toMarkdown(result) {
  const { mechanics, rows, tiers } = result;
  const medianParts = [1, 2, 3, 4, 5]
    .filter((L) => tiers[L] && tiers[L].rows > 0)
    .map((L) => `T${L} med TTK=${fmt(tiers[L].medianTTK)} RTD=${fmt(tiers[L].medianRTD)}`)
    .join(" | ");

  const lines = [];
  lines.push(`Mechanics: ${mechanics} | ${medianParts}`);
  lines.push(`| ${COLUMNS.join(" | ")} |`);
  lines.push(`| ${COLUMNS.map(() => "---").join(" | ")} |`);
  for (const r of rows) {
    lines.push(
      `| ${[
        String(r.tier),
        r.type,
        r.name,
        fmt(r.wp),
        String(r.atk),
        fmtDmg(r.dmg),
        r.toHit !== null ? fmt(r.toHit) : "",
        r.ar !== null ? fmt(r.ar) : "",
        r.flags.join(","),
        fmt(r.E),
        fmt(r.ttk),
        fmt(r.ttkRatio),
        fmt(r.foeDPR),
        fmt(r.rtd),
        fmt(r.lethality),
        r.flag,
      ].join(" | ")} |`,
    );
  }
  return lines.join("\n");
}

// --- CLI ---------------------------------------------------------------

function usage() {
  return 'Usage: node tools/bestiary-yardstick.mjs [--mechanics=prototype|canon] [--json] [--bestiary=<path>]';
}

async function loadBestiary(bestiaryPath) {
  const resolved = bestiaryPath
    ? path.resolve(process.cwd(), bestiaryPath)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "bestiary.js");
  const mod = await import(pathToFileURL(resolved).href);
  return mod.BESTIARY;
}

async function main() {
  const args = process.argv.slice(2);
  let mechanics = "canon";
  let json = false;
  let bestiaryPath = null;

  for (const arg of args) {
    if (arg.startsWith("--mechanics=")) {
      mechanics = arg.slice("--mechanics=".length);
    } else if (arg === "--json") {
      json = true;
    } else if (arg.startsWith("--bestiary=")) {
      bestiaryPath = arg.slice("--bestiary=".length);
    }
  }

  if (mechanics !== "prototype" && mechanics !== "canon") {
    console.error(usage());
    console.error(`Unknown --mechanics value: "${mechanics}" (expected "prototype" or "canon")`);
    process.exitCode = 1;
    return;
  }

  const BESTIARY = await loadBestiary(bestiaryPath);
  const result = computeYardstick(BESTIARY, { mechanics });

  if (json) {
    // Infinity is not representable in JSON — replace it with the string
    // "inf" in the replacer so it survives round-tripping instead of
    // silently becoming `null` (JSON.stringify's default for non-finite
    // numbers).
    console.log(JSON.stringify(result, (_key, value) => (value === Infinity ? "inf" : value), 2));
  } else {
    console.log(toMarkdown(result) + "\n");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
