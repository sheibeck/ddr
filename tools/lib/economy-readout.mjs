// tools/lib/economy-readout.mjs
//
// ECON-11 readout (Phase 92, 92-02) -- the store-affordability aggregation
// behind tools/tune-economy.mjs. Pure over an array of per-run records the
// CLI builds (see economyReadout's JSDoc); nothing here touches engine state.
//
// A TUNING PROXY, NOT A GATE (same standing caveat as tuning-bot.mjs and
// band-readout.mjs): the numbers describe what the fair bot's runs hold, they
// are not a pass/fail check and not a substitute for a human playtest.
//
// Two samples:
//   - STORE VISITS: every time a hero actually opens a store, the gold held on
//     opening against the whole shelf (every line at the price THIS hero pays:
//     race, Pickpocket and the Wilmsry haggle are already in `line.cost`; the
//     Rations line counts as its price x the stock left).
//   - FLOOR ARRIVALS: every floor the hero reaches, priced against the store
//     that hero would face there (the CLI opens a store on a discarded clone of
//     the state), so the deeper floors carry more samples than the literal
//     visits do.
//
// Two caveats that travel with every number:
//   1. The fair bot never sells and never buys repairs. A human sells the bag,
//      so every row also shows gold + the bag's sale value.
//   2. The deeper rows are survivors of a bot whose median death is about
//      floor 4; n is stated on every row.

import { percentile } from "./tuning-bot.mjs";
import { rationsLeft } from "../../engine/economy.js";

/** STOCK_GROUP_OF -- store effectId -> the group a shelf line belongs to. */
export const STOCK_GROUP_OF = Object.freeze({
  eatRation: "food",
  givePotion: "potions",
  giveLockpicks: "lockpicks",
  repairArmor: "repair",
  buyWeapon: "weapons",
  buyArmor: "armour",
  buyScroll: "scroll",
  buyPremium: "premium",
  buyRations: "rations",
  giveTool: "tools",
});

/** GROUP_ORDER -- the fixed column order of every stock table. */
export const GROUP_ORDER = Object.freeze(["food", "potions", "lockpicks", "repair", "weapons", "armour", "scroll", "premium", "rations", "tools"]);

/**
 * stockGroups(stock) -> { food, potions, ..., tools, total }: the price of
 * every UNSOLD line on a shelf, by group. The Rations line counts as its price
 * x the stock left (rationsLeft); a sold line counts 0.
 */
export function stockGroups(stock) {
  const out = {};
  for (const g of GROUP_ORDER) out[g] = 0;
  out.total = 0;
  for (const line of stock || []) {
    const g = STOCK_GROUP_OF[line.effectId];
    if (!g) throw new Error(`stockGroups: unknown store effect "${line.effectId}"`);
    if (line.sold) continue;
    const price = line.effectId === "buyRations" ? line.cost * rationsLeft(line) : line.cost;
    out[g] += price;
    out.total += price;
  }
  return out;
}

// --- small numeric helpers (never NaN) ---------------------------------------

const round = (v, places) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};
const sortedNums = (a) => a.slice().sort((x, y) => x - y);
const q = (sorted, p) => (sorted.length ? percentile(sorted, p) : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const pctOf = (count, n) => (n ? round((count / n) * 100, 1) : null);

/** shareOf(gold, total) -> the fraction of the store that gold buys, capped at 1; null when the shelf is empty. */
export function shareOf(gold, total) {
  if (!(total > 0)) return null;
  return Math.min(1, Math.max(0, gold) / total);
}

const pick3 = (sorted, places) => ({ p25: roundN(q(sorted, 0.25), places), p50: roundN(q(sorted, 0.5), places), p75: roundN(q(sorted, 0.75), places) });
const roundN = (v, places) => (v === null ? null : round(v, places));

// --- the aggregation -----------------------------------------------------------

/**
 * economyReadout(runs, { maxDepth = 12 }) -> { depths, deeper, sources, maxDepth, runs }.
 *
 * Each run: { seed, cls, sub, race, startGold, deathDepth, visits, arrivals,
 *   incomeByDepth: { depth: { why: amount } }, spentByDepth: { depth: amount } };
 * each visit { depth, gold, bagCap, sellValue, groups, incomeSoFar, spentSoFar };
 * each arrival { depth, gold, sellValue, bagCap, wouldFace, incomeSoFar }.
 */
export function economyReadout(runs, { maxDepth = 12 } = {}) {
  // pooled sources (the starting purse is the source `start`)
  const pooled = {};
  let startTotal = 0;
  for (const r of runs) {
    startTotal += r.startGold || 0;
    for (const byWhy of Object.values(r.incomeByDepth || {})) {
      for (const [why, amt] of Object.entries(byWhy)) pooled[why] = (pooled[why] || 0) + amt;
    }
  }
  const whys = Object.keys(pooled).sort((a, b) => pooled[b] - pooled[a] || (a < b ? -1 : 1));
  const order = ["start", ...whys];
  const amtOf = (why) => (why === "start" ? startTotal : pooled[why]);
  const grand = order.reduce((s, why) => s + amtOf(why), 0);
  const sources = {
    order,
    total: grand,
    earned: grand - startTotal,
    rows: order.map((why) => ({ why, amt: amtOf(why), pct: grand ? round((amtOf(why) / grand) * 100, 1) : 0 })),
  };

  const incomeSum = (list, lo, hi) => {
    // mean per run, by source, of the income on floors lo..hi (start counts on floor 1)
    const out = {};
    for (const why of order) out[why] = 0;
    for (const r of list) {
      if (lo <= 1 && hi >= 1) out.start += r.startGold || 0;
      for (const [d, byWhy] of Object.entries(r.incomeByDepth || {})) {
        const depth = Number(d);
        if (depth < lo || depth > hi) continue;
        for (const [why, amt] of Object.entries(byWhy)) out[why] += amt;
      }
    }
    for (const why of order) out[why] = list.length ? round(out[why] / list.length, 1) : 0;
    return out;
  };
  const spentSum = (list, lo, hi) => {
    let s = 0;
    for (const r of list) for (const [d, amt] of Object.entries(r.spentByDepth || {})) if (Number(d) >= lo && Number(d) <= hi) s += amt;
    return list.length ? round(s / list.length, 1) : 0;
  };

  const rowFor = (label, lo, hi) => {
    const reached = runs.filter((r) => r.deathDepth >= lo);
    const visits = [];
    const arrivals = [];
    for (const r of runs) {
      for (const v of r.visits || []) if (v.depth >= lo && v.depth <= hi) visits.push(v);
      for (const a of r.arrivals || []) if (a.depth >= lo && a.depth <= hi) arrivals.push(a);
    }

    const gold = sortedNums(visits.map((v) => v.gold));
    const total = sortedNums(visits.map((v) => v.groups.total));
    const shares = sortedNums(visits.map((v) => shareOf(v.gold, v.groups.total)).filter((s) => s !== null));
    const withSales = sortedNums(visits.map((v) => shareOf(v.gold + (v.sellValue || 0), v.groups.total)).filter((s) => s !== null));
    const buyOut = visits.filter((v) => v.groups.total > 0 && v.gold >= v.groups.total).length;
    const buyOutSales = visits.filter((v) => v.groups.total > 0 && v.gold + (v.sellValue || 0) >= v.groups.total).length;
    const capped = visits.filter((v) => v.bagCap !== null && v.bagCap !== undefined && v.gold >= v.bagCap);
    const withCap = visits.filter((v) => v.bagCap !== null && v.bagCap !== undefined).length;
    const groupMedians = {};
    for (const g of GROUP_ORDER) groupMedians[g] = visits.length ? q(sortedNums(visits.map((v) => v.groups[g])), 0.5) : null;

    const aGold = sortedNums(arrivals.map((a) => a.gold));
    const aTotal = sortedNums(arrivals.map((a) => a.wouldFace.total));
    const aShares = sortedNums(arrivals.map((a) => shareOf(a.gold, a.wouldFace.total)).filter((s) => s !== null));
    const aWithSales = sortedNums(arrivals.map((a) => shareOf(a.gold + (a.sellValue || 0), a.wouldFace.total)).filter((s) => s !== null));
    const aBuyOut = arrivals.filter((a) => a.wouldFace.total > 0 && a.gold >= a.wouldFace.total).length;
    const aBuyOutSales = arrivals.filter((a) => a.wouldFace.total > 0 && a.gold + (a.sellValue || 0) >= a.wouldFace.total).length;

    const onFloor = incomeSum(reached, lo, hi);
    const toFloor = incomeSum(reached, 1, hi);
    const sum = (o) => round(order.reduce((s, why) => s + o[why], 0), 1);

    return {
      L: label,
      runsReached: reached.length,
      visits: {
        n: visits.length,
        gold: { ...pick3(gold, 0), p90: roundN(q(gold, 0.9), 0) },
        total: pick3(total, 0),
        share: pick3(shares, 4),
        buyOutCount: buyOut,
        buyOutPct: pctOf(buyOut, visits.length),
        shareWithSalesP50: roundN(q(withSales, 0.5), 4),
        buyOutWithSalesPct: pctOf(buyOutSales, visits.length),
        atBagCapPct: pctOf(capped.length, withCap),
        groups: groupMedians,
        spentBefore: visits.length ? round(mean(visits.map((v) => v.spentSoFar || 0)), 1) : null,
      },
      arrivals: {
        n: arrivals.length,
        goldP50: roundN(q(aGold, 0.5), 0),
        totalP50: roundN(q(aTotal, 0.5), 0),
        shareP50: roundN(q(aShares, 0.5), 4),
        buyOutPct: pctOf(aBuyOut, arrivals.length),
        shareWithSalesP50: roundN(q(aWithSales, 0.5), 4),
        buyOutWithSalesPct: pctOf(aBuyOutSales, arrivals.length),
      },
      income: {
        onFloor,
        onFloorTotal: sum(onFloor),
        toFloor,
        toFloorTotal: sum(toFloor),
        spentToFloor: spentSum(reached, 1, hi),
      },
    };
  };

  const depths = [];
  for (let L = 1; L <= maxDepth; L++) depths.push(rowFor(L, L, L));
  const deeper = rowFor(`${maxDepth + 1}+`, maxDepth + 1, Infinity);
  return { maxDepth, runs: runs.length, depths, deeper, sources };
}

// --- lever projections -----------------------------------------------------------

const sumGroups = (groups, names) => (names || []).reduce((s, g) => s + (groups[g] || 0), 0);

/**
 * projectLever(runs, { lever, groups, sources, values, basis, maxDepth, focusDepth })
 * -> { lever, basis, scope, note, values: [{ value, visitShare: [per depth], arrivalShare: [per depth],
 *      focus: { depth, visitShare, arrivalShare, visitBuyOutPct, arrivalBuyOutPct } }] }.
 *
 * A FIRST GUESS with the bot's own buying held fixed (the gold each hero held
 * is the gold it really held; only the arithmetic changes):
 *   price  (m on named groups): share = gold / (total - S + m x S), S = the named groups' price
 *   income (g on named sources): gold' = max(0, gold - (1 - g) x income so far from those sources)
 *   cap    (k on the bag cap):   gold' = min(gold, k x bagCap)
 * basis "goldWithSales" adds the bag's sale value to the gold before dividing.
 */
export function projectLever(runs, { lever, groups = [], sources = [], values, basis = "gold", maxDepth = 12, focusDepth = 7 }) {
  const withSales = basis === "goldWithSales";
  const projectOne = (value, sample) => {
    const goldP = (s) => {
      let g = s.gold;
      if (lever === "income") {
        const lost = (1 - value) * sources.reduce((a, why) => a + ((s.incomeSoFar && s.incomeSoFar[why]) || 0), 0);
        g = Math.max(0, g - lost);
      } else if (lever === "cap" && s.bagCap !== null && s.bagCap !== undefined) {
        g = Math.min(g, value * s.bagCap);
      }
      return g + (withSales ? s.sellValue || 0 : 0);
    };
    const totalP = (grp) => {
      if (lever !== "price") return grp.total;
      const S = sumGroups(grp, groups);
      return grp.total - S + value * S;
    };
    const shares = [];
    let buyOut = 0;
    for (const s of sample) {
      const grp = s.groups || s.wouldFace;
      const t = totalP(grp);
      const g = goldP(s);
      const sh = shareOf(g, t);
      if (sh === null) continue;
      shares.push(sh);
      if (g >= t) buyOut++;
    }
    return { shares: sortedNums(shares), buyOut };
  };

  const out = [];
  for (const value of values) {
    const visitShare = [];
    const arrivalShare = [];
    let focus = { depth: focusDepth, visitShare: null, arrivalShare: null, visitBuyOutPct: null, arrivalBuyOutPct: null };
    for (let L = 1; L <= maxDepth; L++) {
      const vs = [];
      const as = [];
      for (const r of runs) {
        for (const v of r.visits || []) if (v.depth === L) vs.push(v);
        for (const a of r.arrivals || []) if (a.depth === L) as.push(a);
      }
      const pv = projectOne(value, vs);
      const pa = projectOne(value, as);
      visitShare.push(roundN(q(pv.shares, 0.5), 4));
      arrivalShare.push(roundN(q(pa.shares, 0.5), 4));
      if (L === focusDepth) {
        focus = {
          depth: focusDepth,
          visitShare: visitShare[L - 1],
          arrivalShare: arrivalShare[L - 1],
          visitBuyOutPct: pctOf(pv.buyOut, pv.shares.length),
          arrivalBuyOutPct: pctOf(pa.buyOut, pa.shares.length),
        };
      }
    }
    out.push({ value, visitShare, arrivalShare, focus });
  }
  return {
    lever,
    basis,
    scope: lever === "price" ? groups : lever === "income" ? sources : null,
    note: "first guess: the bot's own buying is held fixed",
    values: out,
  };
}

/**
 * valueForTarget(projection, target, sample = "visit") -> the lever value at
 * which the focus-depth median share crosses `target`, linearly interpolated
 * between the two grid values that bracket it; null when the grid does not
 * bracket it.
 */
export function valueForTarget(projection, target, sample = "visit") {
  const key = sample === "arrival" ? "arrivalShare" : "visitShare";
  const pts = projection.values.filter((v) => v.focus[key] !== null).map((v) => ({ x: v.value, y: v.focus[key] }));
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.y - target) * (b.y - target) <= 0 && a.y !== b.y) {
      return round(a.x + ((target - a.y) * (b.x - a.x)) / (b.y - a.y), 3);
    }
  }
  const hit = pts.find((p) => p.y === target);
  return hit ? hit.x : null;
}

// --- renderers -------------------------------------------------------------------

const pc = (v) => (v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`);
const num = (v) => (v === null || v === undefined ? "n/a" : String(Math.round(v)));
const pct1 = (v) => (v === null || v === undefined ? "n/a" : `${v.toFixed(1)}%`);
const lab = (row) => String(row.L);
const allRows = (ro) => [...ro.depths, ro.deeper];

/** formatEconomyReadout(readout) -> text lines for stdout (byte-stable). */
export function formatEconomyReadout(ro) {
  const lines = [];
  lines.push(`Store affordability by depth (floors 1-${ro.maxDepth}): gold held on opening a store vs the whole shelf`);
  lines.push("  floor  visits  gold p50   store p50  share p25/p50/p75      buys-out  +bag p50  +bag buys-out  | arrivals  gold p50  store p50  share p50  buys-out");
  for (const r of allRows(ro)) {
    const v = r.visits;
    const a = r.arrivals;
    lines.push(
      `  ${lab(r).padEnd(5)}  ${String(v.n).padStart(6)}  ${num(v.gold.p50).padStart(8)}  ${num(v.total.p50).padStart(9)}  ${`${pc(v.share.p25)}/${pc(v.share.p50)}/${pc(v.share.p75)}`.padEnd(20)}  ${pct1(v.buyOutPct).padStart(8)}  ${pc(v.shareWithSalesP50).padStart(8)}  ${pct1(v.buyOutWithSalesPct).padStart(13)}  | ${String(a.n).padStart(8)}  ${num(a.goldP50).padStart(8)}  ${num(a.totalP50).padStart(9)}  ${pc(a.shareP50).padStart(9)}  ${pct1(a.buyOutPct).padStart(8)}`,
    );
  }
  lines.push("");
  lines.push("Gold income by source and depth (mean per run that reached the floor; start = the starting purse):");
  lines.push(`  ${"floor".padEnd(5)}  ${"runs".padStart(5)}  ${ro.sources.order.map((w) => w.padStart(11)).join(" ")}  ${"on floor".padStart(9)}  ${"to floor".padStart(9)}  ${"spent to".padStart(9)}`);
  for (const r of allRows(ro)) {
    const cells = ro.sources.order.map((w) => num(r.income.onFloor[w]).padStart(11)).join(" ");
    lines.push(`  ${lab(r).padEnd(5)}  ${String(r.runsReached).padStart(5)}  ${cells}  ${num(r.income.onFloorTotal).padStart(9)}  ${num(r.income.toFloorTotal).padStart(9)}  ${num(r.income.spentToFloor).padStart(9)}`);
  }
  lines.push("");
  lines.push("Pooled income by source (all runs):");
  for (const s of ro.sources.rows) lines.push(`  ${String(s.why).padEnd(14)} ${String(s.amt).padStart(10)} (${s.pct.toFixed(1)}%)`);
  return lines;
}

const table = (header, rows) => [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const withRange = (mid, lo, hi, f) => (mid === null ? "n/a" : `${f(mid)} (${f(lo)}–${f(hi)})`);

/** formatEconomyMarkdown(readout, projections) -> { affordability, sources, stock, levers } (Markdown strings, byte-stable). */
export function formatEconomyMarkdown(ro, projections) {
  const rows = allRows(ro);

  const visitTable = table(
    ["Floor", "Runs reaching", "Visits", "Gold held, median (p25–p75)", "Whole store, median", "Share of the store the hero can afford, median (p25–p75)", "Visits that buy the whole store", "Gold plus bag sold: share, median", "Gold plus bag sold: buys the whole store", "Gold at the bag cap", "Spent at stores so far (mean)"],
    rows.map((r) => {
      const v = r.visits;
      return [
        lab(r),
        String(r.runsReached),
        String(v.n),
        withRange(v.gold.p50, v.gold.p25, v.gold.p75, num),
        num(v.total.p50),
        withRange(v.share.p50, v.share.p25, v.share.p75, pc),
        v.n ? `${v.buyOutCount} of ${v.n} (${pct1(v.buyOutPct)})` : "n/a",
        pc(v.shareWithSalesP50),
        pct1(v.buyOutWithSalesPct),
        pct1(v.atBagCapPct),
        num(v.spentBefore),
      ];
    }),
  );
  const arrivalTable = table(
    ["Floor", "Arrivals", "Gold held, median", "Store they would face, median", "Share affordable, median", "Buys the whole store", "Gold plus bag sold: share, median", "Gold plus bag sold: buys the whole store"],
    rows.map((r) => {
      const a = r.arrivals;
      return [lab(r), String(a.n), num(a.goldP50), num(a.totalP50), pc(a.shareP50), pct1(a.buyOutPct), pc(a.shareWithSalesP50), pct1(a.buyOutWithSalesPct)];
    }),
  );
  const affordability = [
    "**Store visits** (the gold the hero holds when a store opens, against the whole shelf)",
    "",
    visitTable,
    "",
    "**Floor arrivals** (the gold the hero holds on reaching the floor, against the store that hero would face there)",
    "",
    arrivalTable,
  ].join("\n");

  const src = ro.sources.order;
  const sourceTotals = table(
    ["Source", "Gold (all runs)", "Share"],
    ro.sources.rows.map((s) => [String(s.why), String(s.amt), pct1(s.pct)]),
  );
  const onFloorTable = table(
    ["Floor", "Runs reaching", ...src, "Total on this floor"],
    rows.map((r) => [lab(r), String(r.runsReached), ...src.map((w) => num(r.income.onFloor[w])), num(r.income.onFloorTotal)]),
  );
  const toFloorTable = table(
    ["Floor", "Runs reaching", ...src, "Total to this floor", "Spent at stores to this floor"],
    rows.map((r) => [lab(r), String(r.runsReached), ...src.map((w) => num(r.income.toFloor[w])), num(r.income.toFloorTotal), num(r.income.spentToFloor)]),
  );
  const sources = [
    "**All runs, by source**",
    "",
    sourceTotals,
    "",
    "**Mean income on each floor** (per run that reached it; `start` is the starting purse, counted on floor 1)",
    "",
    onFloorTable,
    "",
    "**Mean income cumulative to each floor** (per run that reached it)",
    "",
    toFloorTable,
  ].join("\n");

  const stock = [
    "**Median price of each group of shelf lines at store visits** (the whole shelf, each line at the price this hero pays; Rations as price × stock left; the medians of the groups do not add up to the median of the total)",
    "",
    table(
      ["Floor", "Visits", "Whole store", ...GROUP_ORDER],
      rows.map((r) => [lab(r), String(r.visits.n), num(r.visits.total.p50), ...GROUP_ORDER.map((g) => num(r.visits.groups[g]))]),
    ),
  ].join("\n");

  const blocks = [];
  for (const p of projections || []) {
    const scope = p.scope ? p.scope.join(", ") : "the bag cap";
    const unit = p.lever === "price" ? "price multiplier" : p.lever === "income" ? "income factor" : "bag-cap factor";
    blocks.push(`**Lever ${p.lever} on ${scope}, judged on ${p.basis === "goldWithSales" ? "gold plus the bag sold" : "gold held"}** (${p.note})`);
    blocks.push("");
    blocks.push(
      table(
        [unit, "Floor 7 store visits: median share", "Floor 7 arrivals: median share", "Floor 7 visits that buy the whole store", "Share by floor at visits (floors 1–" + ro.maxDepth + ")"],
        p.values.map((v) => [
          String(v.value),
          pc(v.focus.visitShare),
          pc(v.focus.arrivalShare),
          pct1(v.focus.visitBuyOutPct),
          v.visitShare.map((s) => pc(s)).join(" "),
        ]),
      ),
    );
    blocks.push("");
  }
  const levers = blocks.join("\n").replace(/\n+$/, "");

  return { affordability, sources, stock, levers };
}
