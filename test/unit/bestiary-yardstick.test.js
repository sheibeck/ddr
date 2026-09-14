// test/unit/bestiary-yardstick.test.js
//
// Pins tools/bestiary-yardstick.mjs's formulas (18-RESEARCH.md "Rebalance
// Yardstick" methodology, BEST-01/BEST-02, D-01/D-02) against SYNTHETIC
// mini-bestiaries (so 18-05's live-content number changes cannot break this
// file), plus a live-bestiary smoke section (18-01's must_haves "ordering"/
// "precision"/"empty" contracts against the real content/bestiary.js).
//
// This is an informational tool (D-16), not a gate — but its FORMULAS are
// pinned exactly, because Phase 21's consolidated retune re-runs this same
// script and needs its math to be trustworthy.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { computeYardstick, toMarkdown } from "../../tools/bestiary-yardstick.mjs";
import { BESTIARY } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const EPS = 0.01;
function closeTo(actual, expected, eps = EPS) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  );
}

test("formula: a plain tier-1 foe (wp 10, no sp)", () => {
  const b = { Test: [[{ n: "Plain", wp: 10 }], [], [], [], []] };
  const result = computeYardstick(b, { mechanics: "canon" });
  const row = result.rows[0];
  assert.equal(row.atk, 1);
  assert.equal(row.dmg, null);
  // E = 5.69 * 5/20 = 1.4225
  closeTo(row.E, 1.4225, 0.0001);
  // TTK = 10 / 1.4225 = 7.03
  closeTo(row.ttk, 7.03);
  // foeDPR = 1 * (1 + 3.5) * 6/20 = 1.35
  closeTo(row.foeDPR, 1.35, 0.0001);
  // RTD = 41.7 / 1.35 = 30.89
  closeTo(row.rtd, 30.89);
});

test("twice doubles TTK; toHit lowers the effective need; fast lowers it by one; magicOnly gives Infinity and 'infinite' flag and is excluded from the tier median", () => {
  const b = {
    Test: [
      [
        { n: "Twicer", wp: 10, sp: { twice: true } },
        { n: "Accurate", wp: 10, sp: { toHit: 2 } },
        { n: "Fastie", wp: 10, sp: { fast: true } },
        { n: "Ghosty", wp: 10, sp: { magicOnly: true } },
      ],
      [],
      [],
      [],
      [],
    ],
  };
  const result = computeYardstick(b, { mechanics: "canon" });
  const byName = Object.fromEntries(result.rows.map((r) => [r.name, r]));

  // Twicer: baseline E (1.4225) but ttk is doubled by `twice`.
  closeTo(byName.Twicer.E, 1.4225, 0.0001);
  closeTo(byName.Twicer.ttk, (10 / 1.4225) * 2);

  // Accurate: toHit:2 lowers need from 4 to 2, raising TTK vs the baseline.
  assert.ok(byName.Accurate.ttk > byName.Twicer.ttk / 2, "toHit should raise TTK relative to the un-doubled baseline");
  closeTo(byName.Accurate.E, 0.8535, 0.001);

  // Fastie: fast lowers need from 4 to 3.
  closeTo(byName.Fastie.E, 1.138, 0.001);

  // Ghosty: magicOnly -> need 0 -> E 0 -> Infinity, flagged "infinite".
  assert.equal(byName.Ghosty.ttk, Infinity);
  assert.equal(byName.Ghosty.flag, "infinite");

  // The tier median must be computed over FINITE ttks only (excludes Ghosty).
  assert.ok(Number.isFinite(result.tiers[1].medianTTK));
});

test("flag is strict: a row at exactly 2.00x the tier median is NOT flagged; 2.01x is", () => {
  const bAtBoundary = {
    Test: [[{ n: "A", wp: 10 }, { n: "B", wp: 10 }, { n: "C", wp: 20 }], [], [], [], []],
  };
  const atBoundary = computeYardstick(bAtBoundary, { mechanics: "canon" });
  const rowC = atBoundary.rows.find((r) => r.name === "C");
  closeTo(rowC.ttkRatio, 2.0, 0.0001);
  assert.equal(rowC.flag, "", "a row at exactly 2.00x the median must NOT be flagged (strict >)");

  const bOverBoundary = {
    Test: [[{ n: "A", wp: 10 }, { n: "B", wp: 10 }, { n: "C", wp: 21 }], [], [], [], []],
  };
  const overBoundary = computeYardstick(bOverBoundary, { mechanics: "canon" });
  const rowC2 = overBoundary.rows.find((r) => r.name === "C");
  assert.ok(rowC2.ttkRatio > 2.0);
  assert.equal(rowC2.flag, "over-tier");
});

test("under-tier: ttkRatio < 0.5 flags 'under-tier'", () => {
  const b = {
    Test: [[{ n: "A", wp: 10 }, { n: "B", wp: 10 }, { n: "C", wp: 4 }], [], [], [], []],
  };
  const result = computeYardstick(b, { mechanics: "canon" });
  const rowC = result.rows.find((r) => r.name === "C");
  assert.ok(rowC.ttkRatio < 0.5);
  assert.equal(rowC.flag, "under-tier");
});

test("canon mechanics: ar 12 scales non-crit damage by 0.4 while the crit share is untouched", () => {
  const b = { Test: [[], [], [{ n: "Armored", wp: 100, sp: { ar: 12 } }], [], []] };
  const proto = computeYardstick(b, { mechanics: "prototype" }).rows[0];
  const canon = computeYardstick(b, { mechanics: "canon" }).rows[0];
  // prototype ignores ar entirely: E = 13.69 * 5/10 = 6.845
  closeTo(proto.E, 6.845, 0.001);
  // canon: E = 13.69 * ((0.4 - 0.1) * 0.4 + 0.2) = 4.3808
  closeTo(canon.E, 4.3808, 0.001);
});

test("canon mechanics: halfDmg halves E; slow uses two-dice-keep-lower", () => {
  const b = {
    Test: [
      [
        { n: "Half", wp: 100, sp: { halfDmg: true } },
        { n: "Slow", wp: 100, sp: { slow: true } },
      ],
      [],
      [],
      [],
      [],
    ],
  };
  const proto = computeYardstick(b, { mechanics: "prototype" });
  const canon = computeYardstick(b, { mechanics: "canon" });
  const protoByName = Object.fromEntries(proto.rows.map((r) => [r.name, r]));
  const canonByName = Object.fromEntries(canon.rows.map((r) => [r.name, r]));

  // Prototype mode: ar/slow/halfDmg are ALL inert -> both equal the plain 1.4225.
  closeTo(protoByName.Half.E, 1.4225, 0.0001);
  closeTo(protoByName.Slow.E, 1.4225, 0.0001);

  // Canon halfDmg: E = 1.4225 / 2 = 0.71125
  closeTo(canonByName.Half.E, 0.71125, 0.0001);

  // Canon slow: pHit = 1 - (16/20)^2 = 0.36, pCrit = 1 - (19/20)^2 = 0.0975
  // E = 5.69 * (0.2625 + 0.195) = 2.603
  closeTo(canonByName.Slow.E, 2.603, 0.01);
});

test("ordering: rows follow Object.entries type order, then tier, then array order", () => {
  const b = {
    Zebra: [[{ n: "Z1a" }, { n: "Z1b" }], [{ n: "Z2a" }]],
    Alpha: [[{ n: "A1a" }], [{ n: "A2a" }, { n: "A2b" }]],
  };
  // give every entry a wp so ttk/rtd compute without crashing
  for (const arr of Object.values(b)) for (const tier of arr) for (const e of tier) e.wp = 10;

  const result = computeYardstick(b, { mechanics: "canon" });
  assert.deepEqual(
    result.rows.map((r) => r.name),
    ["Z1a", "Z1b", "Z2a", "A1a", "A2a", "A2b"],
  );

  const md1 = toMarkdown(result);
  const md2 = toMarkdown(computeYardstick(b, { mechanics: "canon" }));
  assert.equal(md1, md2, "toMarkdown must be byte-identical across runs on the same content");
});

test("precision: toMarkdown prints two decimals and 'inf'", () => {
  const b = {
    Test: [
      [
        { n: "FlatTwentyFive", wp: 10, sp: { dmg: { n: 0, sides: 0, bonus: 25 } } },
        { n: "Ghosty", wp: 10, sp: { magicOnly: true } },
      ],
      [],
      [],
      [],
      [],
    ],
  };
  const result = computeYardstick(b, { mechanics: "canon" });
  const md = toMarkdown(result);

  assert.match(md, /0d0\+25/, "flat-25 dmg must render as 0d0+25");
  assert.match(md, /\binf\b/, "an Infinity TTK must render as 'inf'");

  const lines = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| ---"));
  const dataLines = lines.slice(1); // drop the header row
  for (const line of dataLines) {
    const cells = line
      .slice(2, -2) // strip leading "| " and trailing " |"
      .split(" | ");
    // numeric metric columns: wp(3), heroE(9), TTK(10), xTTKmed(11), foeDPR(12), RTD(13), xLethal(14)
    for (const idx of [3, 9, 10, 11, 12, 13, 14]) {
      const cell = cells[idx];
      assert.ok(
        /^-?\d+\.\d{2}$/.test(cell) || cell === "inf",
        `cell "${cell}" (column ${idx}) must be a 2-decimal number or "inf"`,
      );
    }
  }
});

test("live bestiary smoke (prototype mode): 53 rows; only Ghost and Spectre are infinite; prototype tier medians are pinned", () => {
  const result = computeYardstick(BESTIARY, { mechanics: "prototype" });
  assert.equal(result.rows.length, 53);

  const infiniteNames = result.rows.filter((r) => !Number.isFinite(r.ttk)).map((r) => r.name);
  assert.deepEqual(infiniteNames.sort(), ["Ghost", "Spectre"]);

  closeTo(result.tiers[1].medianTTK, 3.51);
  closeTo(result.tiers[1].medianRTD, 30.89);
  closeTo(result.tiers[2].medianTTK, 3.31);
  closeTo(result.tiers[2].medianRTD, 10.87);
  closeTo(result.tiers[3].medianTTK, 2.34);
  closeTo(result.tiers[3].medianRTD, 5.56);
  closeTo(result.tiers[4].medianTTK, 1.43);
  closeTo(result.tiers[4].medianRTD, 3.73);
  closeTo(result.tiers[5].medianTTK, 1.62);
  closeTo(result.tiers[5].medianRTD, 2.81);

  const fixtureRows = result.rows.filter(
    (r) => r.tier === 1 && ["Bat/Rat", "Shriek", "Viper", "Dante"].includes(r.name),
  );
  const wpByName = Object.fromEntries(fixtureRows.map((r) => [r.name, r.wp]));
  assert.equal(wpByName["Bat/Rat"], 1);
  assert.equal(wpByName.Shriek, 3);
  assert.equal(wpByName.Viper, 3);
  assert.equal(wpByName.Dante, 20);
});

test("live bestiary smoke (canon mode): Philly's TTK drops below 4.0 (slow), Sterling's TTK exceeds 9.0 (halfDmg), and every sp.ar row has a canon TTK strictly greater than its prototype TTK", () => {
  const proto = computeYardstick(BESTIARY, { mechanics: "prototype" });
  const canon = computeYardstick(BESTIARY, { mechanics: "canon" });

  const philly = canon.rows.find((r) => r.name === "Philly");
  assert.ok(philly.ttk < 4.0, `Philly's canon TTK should be < 4.0, got ${philly.ttk}`);

  const sterling = canon.rows.find((r) => r.name === "Sterling");
  assert.ok(sterling.ttk > 9.0, `Sterling's canon TTK should be > 9.0, got ${sterling.ttk}`);

  const arNames = ["Drat", "Krupke", "Craig", "Herman", "Google"];
  for (const name of arNames) {
    const protoRows = proto.rows.filter((r) => r.name === name);
    const canonRows = canon.rows.filter((r) => r.name === name);
    assert.equal(protoRows.length, canonRows.length, `${name} row count mismatch`);
    for (let i = 0; i < protoRows.length; i++) {
      assert.ok(
        canonRows[i].ttk > protoRows[i].ttk,
        `${name} (tier ${canonRows[i].tier}): canon TTK ${canonRows[i].ttk} should exceed prototype TTK ${protoRows[i].ttk}`,
      );
    }
  }
});

// --- D-04 doc consistency: BESTIARY-REBALANCE.md's AFTER block must match ---

test("BESTIARY-REBALANCE.md AFTER block matches the live canon-mode yardstick (D-04 doc consistency)", () => {
  const docPath = path.join(REPO_ROOT, "content", "BESTIARY-REBALANCE.md");
  const doc = fs.readFileSync(docPath, "utf8");
  const beginMarker = "<!-- yardstick:after:begin -->";
  const endMarker = "<!-- yardstick:after:end -->";
  const beginIdx = doc.indexOf(beginMarker);
  const endIdx = doc.indexOf(endMarker);
  assert.ok(beginIdx !== -1 && endIdx !== -1, "content/BESTIARY-REBALANCE.md must contain both yardstick:after markers");

  const normalize = (block) =>
    block
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/, ""))
      .join("\n")
      .trim();

  const docBlock = normalize(doc.slice(beginIdx + beginMarker.length, endIdx));
  const liveBlock = normalize(toMarkdown(computeYardstick(BESTIARY, { mechanics: "canon" })));

  assert.equal(
    docBlock,
    liveBlock,
    "content/BESTIARY-REBALANCE.md's AFTER block drifted from tools/bestiary-yardstick.mjs — regenerate with `node tools/bestiary-yardstick.mjs` and paste verbatim between the markers",
  );
});
