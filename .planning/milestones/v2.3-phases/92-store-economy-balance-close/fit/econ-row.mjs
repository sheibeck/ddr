// Scratch script of plan 92-03 (ECON-12): turn one tune-economy eval JSON into one
// econ-log.jsonl row. Usage: node econ-row.mjs <n> <block> <eval.json> [append]
// Ruled basis (docs/ECONOMY-READOUT.md ## Ruling): depth-7 median share of a whole store,
// gold held PLUS the bag's sale value, floor-arrival sample, visits beside it.
// Band 33-50%, middle of the band 41.5%, middle third 38.67-44.33%.
import fs from "node:fs";
const [, , nArg, blockArg, evalPath, append] = process.argv;
const BAND = [0.33, 0.5];
const MID = (BAND[0] + BAND[1]) / 2;
const THIRD = [BAND[0] + (BAND[1] - BAND[0]) / 3, BAND[1] - (BAND[1] - BAND[0]) / 3];
const here = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const before = JSON.parse(fs.readFileSync("C:/projects/mazeworld/docs/economy/econ-before-1000.json", "utf8")).readout.depths;
const ev = JSON.parse(fs.readFileSync(evalPath, "utf8"));
const d = ev.readout.depths;
const at = (L) => d[L - 1];
const d7 = at(7);
const shape = d.slice(0, 12).map((r) => (r.arrivals ? r.arrivals.shareWithSalesP50 : null));
const goldShape = d.slice(0, 12).map((r) => (r.arrivals ? r.arrivals.shareP50 : null));
const beforeShape = before.slice(0, 12).map((r) => r.arrivals.shareWithSalesP50);
const beforeGold = before.slice(0, 12).map((r) => r.arrivals.shareP50);
const share7 = d7.arrivals.shareWithSalesP50;
const early = [0, 1, 2, 3].every((i) => shape[i] <= beforeShape[i] + 1e-9 && goldShape[i] === beforeGold[i]);
const late8to9 = [8, 9].every((L) => shape[L - 1] === null || shape[L - 1] <= share7 + 1e-9);
const late10to12 = [10, 11, 12].every((L) => shape[L - 1] === null || shape[L - 1] <= share7 + 1e-9);
const row = {
  n: Number(nArg),
  block: Number(blockArg),
  dials: ev.meta.dials,
  seeds: ev.meta.seeds,
  commit: ev.meta.commit,
  basis: "gold + bag sold, floor arrivals; visits beside",
  depth7: {
    visits: d7.visits.n,
    visitShareP50: d7.visits.shareWithSalesP50,
    shareP50: share7,
    buyOutPct: d7.arrivals.buyOutWithSalesPct,
    arrivals: d7.arrivals.n,
    arrivalShareP50: share7,
    arrivalGoldShareP50: d7.arrivals.shareP50,
  },
  shapeP50: shape,
  goldShapeP50: goldShape,
  inBand: share7 >= BAND[0] && share7 <= BAND[1],
  inMiddleThird: share7 >= THIRD[0] && share7 <= THIRD[1],
  // shapeOk = the part of the ruled shape a sell fraction CAN hold: floors 1-4 with-bag no
  // higher than today's and gold-held identical. Floors 8-12 are reported, not gated: S
  // flat from the ramp end cannot keep 8-9 under depth 7 (gold alone climbs 9-11 points
  // there), and 10-12 are accepted as income (user, 2026-10-01).
  shapeOk: early,
  shape: { floors1to4: early, floors8to9NotAbove7: late8to9, floors10to12NotAbove7: late10to12 },
  distance: Math.round(Math.abs(share7 - MID) * 10000) / 100,
};
const line = JSON.stringify(row);
console.log(line);
if (append === "append") fs.appendFileSync("C:/projects/mazeworld/.planning/phases/92-store-economy-balance-close/fit/econ-log.jsonl", line + "\n");
