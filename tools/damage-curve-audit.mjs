#!/usr/bin/env node
// tools/damage-curve-audit.mjs
//
// Phase 52 (DMG-01/SC4) — an ANALYTIC (no rng, exhaustive, deterministic)
// audit of every bestiary row's max single hit, per tier, per depth band,
// against a level-appropriate hero's HP. This is a report tool (always
// exits 0, no assertions — NOT a `*.test.js` file, `node --test` never
// picks it up), in the `tools/bestiary-yardstick.mjs` mould.
//
// THIS IS A MEASUREMENT / TUNING PROXY, NOT A PASS/FAIL GATE — it flags
// outliers for a human (or the planner) to review; it never blocks a build,
// a commit, or a CI check.
//
// CLI:
//   --rule=whole|dice   REQUIRED. "whole" = today's rule (a foe crit doubles
//                       the WHOLE lvl^2 + dmgBonus + dice sum). "dice" = the
//                       Phase 52 rule (a foe crit doubles the dice only:
//                       lvl^2 + dmgBonus + 2*dice).
//   --smoke=<path>      default docs/class-pass/v17-p51-after-smoke.json —
//                       the locked yardstick source for each band's hero
//                       level (median meanLevel over cells whose p50Depth
//                       falls in the band).
//   --levels=a,b,c,d    optional override of the four band levels (Filter,
//                       Wall, Breakaway, Endgame, in that order) — when
//                       given, the smoke file is never read.
//
// Yardstick (D-05, 52-CONTEXT.md): four depth bands — Filter 1-4, Wall 5-8,
// Breakaway 9-15, Endgame 16-20 (the user's own bands). A band's own hero
// level is the median of every smoke cell's `meanLevel` whose `p50Depth`
// lies in the band, rounded to the nearest integer, clamped 1..5; a band
// with no cells (Breakaway/Endgame today — the Phase 51 smoke's deepest
// p50Depth is 7) defaults to 5 (the level cap). Two HP bars per level L,
// computed from the LIVE content/classes.js table for a Human (no race
// wpMul/flatWP): mean max HP = baseWP.base + mean(baseWP.dice) +
// sum_{k=1}^{L-1} mean(gain[k]), for "Magic User" (the weakest class) and
// "Fighter" (the sturdiest).
//
// Row evaluation: every bestiary row at its tier T (array index + 1, 1..5)
// is evaluated in every band whose max depth is >= T (a tier-T foe is only
// ever reachable at depth >= T — see engine/combat.js#startCombat's
// maxLvl/lvl tiering). The row's EFFECTIVE hero level in that band is
// `max(T, bandLevel)` capped at 5 — a tier-4 row met in a level-3 band is
// still met by a hero of level >= 4 (a tier-T foe implies a level->=T
// hero), so the row's own MU/Fighter bars (the per-row table columns) are
// computed at this effective level, which may exceed the band's own
// printed baseline level.
//
// `dmgBonus` for a row/band pair is the MAXIMUM of
// `foeDmgBonusFor(T, difficultyCurve(d))` over every floor d in the band
// with d >= T (exhaustive over floors — grace floors 2-4 can legitimately
// produce a NEGATIVE dmgBonus; this audit reports the row's WORST case,
// i.e. the max).
//
// `levelBase` reads `sp.strikesAs` when present (Phase 52 Plan 02 adds this
// field to Herman) else `T * T` — so this tool needs no change for the
// AFTER run.
// `diceMax` = `sp.dmg ? n*sides+bonus : 6` (the default dice notation when
// a row carries no `sp.dmg` of its own).
// `hitMax` = `levelBase + dmgBonus + diceMax`.
// `critMax` (rule=whole) = `2 * hitMax`; (rule=dice) =
// `levelBase + dmgBonus + 2*diceMax`.
// `boltMax` = the max `dmg` (n*sides+bonus) over the row's kit's
// bolt/drain descriptors (0 when the row carries no kit, or its kit has no
// bolt/drain entries).
// `maxSingleHit` = `max(critMax, boltMax)`.
// `worstTurn` (informational only) = `(sp.atk || 1) * critMax`.
//
// Verdict: FLAG when `maxSingleHit >= 0.6 * MUbar(effectiveLevel)`; note
// (not already flagged) when `>= 0.6 * FTbar(effectiveLevel)`; otherwise
// blank. Every FLAG row also gets a `category`: `bolt:<id>` when the flag
// is bolt-driven (`boltMax > critMax`); else `deep-tier` when `T === 5`;
// else `level-base` when the tier's DEFAULT die (1d6+0, same levelBase/
// dmgBonus) would ALSO flag under the same rule (the lvl^2 base, not this
// row's own dice, trips the flag); else `row-dice` (the row's own `sp.dmg`
// is what trips it) with a `wouldBeTrim` column: the largest same-family
// notation (bonus reduced first, then the sides ladder 12->10->8->6, then n
// down to 1, never below 1d6+0) that would clear the bar.
//
// Run:
//   node tools/damage-curve-audit.mjs --rule=whole > tools/damage-curve-audit-output.txt   (the BEFORE section)
//   node tools/damage-curve-audit.mjs --rule=dice                                            (the AFTER section, Plan 02 appends)

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BESTIARY, FOE_ABILITIES, CLASSES } from "../content/index.js";
import { difficultyCurve, foeDmgBonusFor } from "../engine/difficulty.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const BANDS = [
  { name: "Filter", min: 1, max: 4 },
  { name: "Wall", min: 5, max: 8 },
  { name: "Breakaway", min: 9, max: 15 },
  { name: "Endgame", min: 16, max: 20 },
];

const FOE_ABILITIES_BY_ID = new Map(FOE_ABILITIES.map((a) => [a.id, a]));

// --- CLI -------------------------------------------------------------------

function parseArgs(argv) {
  const args = { rule: null, smoke: "docs/class-pass/v17-p51-after-smoke.json", levels: null };
  for (const arg of argv) {
    if (arg.startsWith("--rule=")) args.rule = arg.slice("--rule=".length);
    else if (arg.startsWith("--smoke=")) args.smoke = arg.slice("--smoke=".length);
    else if (arg.startsWith("--levels=")) args.levels = arg.slice("--levels=".length).split(",").map(Number);
  }
  if (args.rule !== "whole" && args.rule !== "dice") {
    process.stderr.write("damage-curve-audit: --rule=whole|dice is required\n");
    process.exit(1);
  }
  return args;
}

// --- Hero HP bars (D-05: Human, no race modifiers) --------------------------

function meanDice(d) {
  if (!d) return 0;
  return (d.n * (d.sides + 1)) / 2 + d.bonus;
}

/** classBarAt(clsName, level) — mean max HP at `level` for a Human with no
 * store purchases/skills: base + mean(baseWP.dice) + the mean of every
 * gain[1..level-1] dice entry. */
function classBarAt(clsName, level) {
  const cls = CLASSES[clsName];
  let hp = cls.baseWP.base + meanDice(cls.baseWP.dice);
  for (let k = 1; k < level; k++) hp += meanDice(cls.gain[k]);
  return hp;
}

function muBarAt(level) {
  return classBarAt("Magic User", level);
}
function ftBarAt(level) {
  return classBarAt("Fighter", level);
}

// --- Band levels (from the smoke file, or a --levels override) -------------

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length / 2;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[mid - 1] + s[mid]) / 2;
}

function computeBandLevels(args) {
  if (args.levels) {
    return BANDS.map((b, i) => ({ ...b, level: args.levels[i], source: "--levels override" }));
  }
  const smokePath = path.isAbsolute(args.smoke) ? args.smoke : path.join(REPO_ROOT, args.smoke);
  const smoke = JSON.parse(fs.readFileSync(smokePath, "utf8"));
  return BANDS.map((b) => {
    const cells = smoke.cells.filter((c) => c.p50Depth >= b.min && c.p50Depth <= b.max);
    if (!cells.length) {
      return { ...b, level: 5, cellCount: 0, source: `${args.smoke} (commit ${smoke.meta.commit}) — no cells, defaults to level 5` };
    }
    const lvl = Math.min(5, Math.max(1, Math.round(median(cells.map((c) => c.meanLevel)))));
    return { ...b, level: lvl, cellCount: cells.length, source: `${args.smoke} (commit ${smoke.meta.commit})` };
  });
}

// --- Per-row metrics ---------------------------------------------------------

function formatDice(sp) {
  if (!sp || !sp.dmg) return "d6 (default)";
  const { n, sides, bonus } = sp.dmg;
  if (n === 0 && sides === 0) return `flat+${bonus}`;
  return `${n}d${sides}+${bonus}`;
}

function diceMaxOf(sp) {
  if (!sp || !sp.dmg) return 6;
  return sp.dmg.n * sp.dmg.sides + sp.dmg.bonus;
}

function levelBaseOf(row, T) {
  if (row.sp && typeof row.sp.strikesAs === "number") return row.sp.strikesAs * row.sp.strikesAs;
  return T * T;
}

function boltMaxOf(row) {
  if (!row.abilities || !row.abilities.length) return { max: 0, id: null };
  let best = { max: 0, id: null };
  for (const id of row.abilities) {
    const a = FOE_ABILITIES_BY_ID.get(id);
    if (!a || (a.kind !== "bolt" && a.kind !== "drain") || !a.dmg) continue;
    const m = a.dmg.n * a.dmg.sides + a.dmg.bonus;
    if (m > best.max) best = { max: m, id: a.id };
  }
  return best;
}

/** dmgBonusForBand(T, band) — the MAX foeDmgBonusFor(T, curve(d)) over every
 * floor d in the band with d >= T (exhaustive over floors; grace floors 2-4
 * can legitimately return a negative bonus). */
function dmgBonusForBand(T, band) {
  const lo = Math.max(band.min, T);
  if (lo > band.max) return null; // band cannot reach this tier at all
  let best = -Infinity;
  for (let d = lo; d <= band.max; d++) {
    const b = foeDmgBonusFor(T, difficultyCurve(d));
    if (b > best) best = b;
  }
  return best;
}

function critMaxOf(rule, levelBase, dmgBonus, diceMax) {
  return rule === "whole" ? 2 * (levelBase + dmgBonus + diceMax) : levelBase + dmgBonus + 2 * diceMax;
}

/** wouldBeTrim — the largest same-family notation that clears the bar:
 * bonus reduced to 0 first, then the sides ladder 12->10->8->6, then n down
 * to 1; never below 1d6+0. `clears(n,sides,bonus)` recomputes maxSingleHit
 * with that candidate notation and checks it against the 60% MU-bar
 * threshold. */
function wouldBeTrim(sp, rule, levelBase, dmgBonus, boltMax, muBar) {
  const orig = sp.dmg;
  const clears = (n, sides, bonus) => {
    const diceMaxC = n * sides + bonus;
    const critC = critMaxOf(rule, levelBase, dmgBonus, diceMaxC);
    const maxC = Math.max(critC, boltMax);
    return maxC < 0.6 * muBar;
  };
  for (let b = orig.bonus; b >= 0; b--) {
    if (clears(orig.n, orig.sides, b)) return `${orig.n}d${orig.sides}+${b}`;
  }
  const ladder = [12, 10, 8, 6].filter((s) => s <= Math.max(orig.sides, 6));
  for (const s of ladder) {
    if (clears(orig.n, s, 0)) return `${orig.n}d${s}+0`;
  }
  for (let n = orig.n; n >= 1; n--) {
    if (clears(n, 6, 0)) return `${n}d6+0`;
  }
  return "none";
}

function categorize({ T, boltMax, critMax, rule, levelBase, dmgBonus, muBar, boltId }) {
  if (boltMax > critMax) return `bolt:${boltId}`;
  if (T === 5) return "deep-tier";
  const defaultCrit = critMaxOf(rule, levelBase, dmgBonus, 6);
  if (defaultCrit >= 0.6 * muBar) return "level-base";
  return "row-dice";
}

// --- Main --------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bandLevels = computeBandLevels(args);

  const out = [];
  out.push(`# damage-curve-audit — rule=${args.rule}`);
  out.push("");
  out.push(
    `Rule: ${args.rule === "whole" ? "today's rule — a foe crit doubles the WHOLE lvl^2 + dmgBonus + dice sum" : "the Phase 52 rule — a foe crit doubles the DICE only (lvl^2 + dmgBonus + 2*dice)"}.`,
  );
  if (args.levels) {
    out.push(`Band levels: --levels override (${args.levels.join(",")}), smoke file not read.`);
  } else {
    out.push(`Band levels: median meanLevel from ${bandLevels[0].source}.`);
  }
  out.push("");
  for (const b of bandLevels) {
    out.push(
      `${b.name} (depth ${b.min}-${b.max}): hero level ${b.level}${b.cellCount !== undefined ? ` (${b.cellCount} smoke cells)` : ""} — MU bar ${muBarAt(b.level).toFixed(1)}, Fighter bar ${ftBarAt(b.level).toFixed(1)}`,
    );
  }
  out.push("");

  let totalFlagged = 0;
  let totalNoted = 0;
  const flaggedRows = [];
  let cellCount = 0;
  let deepTierCount = 0;
  let levelBaseCount = 0;
  let rowDiceCount = 0;
  let boltCount = 0;

  const hermanReadout = [];

  for (const band of bandLevels) {
    out.push(`## ${band.name} (depth ${band.min}-${band.max}, hero level ${band.level})`);
    out.push("");
    out.push("| tier | type | name | dice | atk | levelBase | dmgBonus | hitMax | critMax | boltMax | maxSingleHit | worstTurn | MU bar | FT bar | % of MU bar | verdict |");
    out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

    for (const type of Object.keys(BESTIARY)) {
      const tiers = BESTIARY[type];
      for (let tIdx = 0; tIdx < tiers.length; tIdx++) {
        const T = tIdx + 1;
        const dmgBonus = dmgBonusForBand(T, band);
        if (dmgBonus === null) continue; // this band never reaches tier T
        for (const row of tiers[tIdx]) {
          cellCount++;
          const levelBase = levelBaseOf(row, T);
          const diceMax = diceMaxOf(row.sp);
          const hitMax = levelBase + dmgBonus + diceMax;
          const critMax = critMaxOf(args.rule, levelBase, dmgBonus, diceMax);
          const { max: boltMax, id: boltId } = boltMaxOf(row);
          const maxSingleHit = Math.max(critMax, boltMax);
          const worstTurn = ((row.sp && row.sp.atk) || 1) * critMax;
          const effLevel = Math.min(5, Math.max(T, band.level));
          const muBar = muBarAt(effLevel);
          const ftBar = ftBarAt(effLevel);
          const pct = (maxSingleHit / muBar) * 100;

          let verdict = "-";
          if (maxSingleHit >= 0.6 * muBar) verdict = "FLAG";
          else if (maxSingleHit >= 0.6 * ftBar) verdict = "note";

          out.push(
            `| ${T} | ${type} | ${row.n} | ${formatDice(row.sp)} | ${(row.sp && row.sp.atk) || 1} | ${levelBase} | ${dmgBonus} | ${hitMax} | ${critMax} | ${boltMax} | ${maxSingleHit} | ${worstTurn} | ${muBar.toFixed(1)} | ${ftBar.toFixed(1)} | ${pct.toFixed(0)}% | ${verdict} |`,
          );

          if (row.n === "Herman") {
            hermanReadout.push({ band: band.name, T, hitMax, critMax });
          }

          if (verdict === "FLAG") {
            totalFlagged++;
            const category = categorize({ T, boltMax, critMax, rule: args.rule, levelBase, dmgBonus, muBar, boltId });
            if (category === "deep-tier") deepTierCount++;
            else if (category === "level-base") levelBaseCount++;
            else if (category.startsWith("bolt:")) boltCount++;
            else rowDiceCount++;
            let trim = "";
            if (category === "row-dice" && row.sp && row.sp.dmg) {
              trim = wouldBeTrim(row.sp, args.rule, levelBase, dmgBonus, boltMax, muBar);
            }
            flaggedRows.push({
              band: band.name,
              T,
              type,
              name: row.n,
              dice: formatDice(row.sp),
              maxSingleHit,
              muBar,
              pct,
              category,
              trim,
            });
          } else if (verdict === "note") {
            totalNoted++;
          }
        }
      }
    }
    out.push("");
  }

  out.push(`## Flagged (rule=${args.rule})`);
  out.push("");
  out.push("band | tier | type | name | dice | maxSingleHit | MU bar | % | category | wouldBeTrim");
  out.push("---|---|---|---|---|---|---|---|---|---");
  for (const r of flaggedRows) {
    out.push(
      `${r.band} | ${r.T} | ${r.type} | ${r.name} | ${r.dice} | ${r.maxSingleHit} | ${r.muBar.toFixed(1)} | ${r.pct.toFixed(0)}% | ${r.category} | ${r.trim || "-"}`,
    );
  }
  out.push("");
  out.push(
    `FLAGGED: ${totalFlagged} rows across ${cellCount} row×band cells (deep-tier ${deepTierCount}, level-base ${levelBaseCount}, row-dice ${rowDiceCount}, bolt ${boltCount})`,
  );
  out.push(`NOTED: ${totalNoted} rows`);
  out.push("");

  out.push("## Herman");
  out.push("");
  out.push(
    args.rule === "whole"
      ? "Herman is content/bestiary.js's Humans tier-4 AND tier-5 row (the SC4 anchor — the user's pasted 'Herman hits for 80 on floor 5' log). Both rows share the same stat block (`sp.dmg: {n:0, sides:0, bonus:25}`, no strikesAs field yet in this BEFORE run — Plan 02 adds `sp.strikesAs: 5`)."
      : "Herman is content/bestiary.js's Humans tier-4 AND tier-5 row (the SC4 anchor — the user's pasted 'Herman hits for 80 on floor 5' log). Both rows now carry `sp.strikesAs: 5` (Phase 52, DMG-02) instead of the old flat-25 notation — the level-base term reads 25 (5^2), the damage die is the default d6 (see engine/combat.js#foeLevelBase).",
  );
  out.push("");
  out.push("band | tier | hitMax | critMax");
  out.push("---|---|---|---");
  for (const h of hermanReadout) {
    out.push(`${h.band} | ${h.T} | ${h.hitMax} | ${h.critMax}`);
  }
  out.push("");

  process.stdout.write(out.join("\n") + "\n");
}

main();
