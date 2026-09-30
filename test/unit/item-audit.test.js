// test/unit/item-audit.test.js
//
// Phase 89 (ITEM-01, ITEM-06; plan 89-01) — the coverage and consistency test
// for docs/ITEM-AUDIT.md, the item audit table. It parses every `###` family
// table under `## Rows` and checks it against the live content tables, so the
// doc can never silently lose an item, double an item, or leave a cell empty:
//
//   - every weapon, armour, cloak, jewel, staff, potion, tool and bag has
//     exactly one row, in its content table's order (WEAPONS key order, ARMORS,
//     CLOAKS, JEWELRY, STAVES, POTIONS, TOOL_ORDER, BAG_ORDER), so a
//     regenerated table is stable;
//   - the families appear in a fixed order and the families without a content
//     table (Magic weapons, Magic armour, Wands, Scrolls and books, Lockpicks,
//     Treasure) each have at least one row; the Treasure rows also cover every
//     Misc Magic and Faerie outcome in table order;
//   - no Item, Text, Engine, Canon or Verdict cell is empty, and every row has
//     all six cells;
//   - every Verdict is one of the accepted tokens, and every owner `(89-NN)`
//     names a Phase 89 plan (01 to 10);
//   - the Systems (ITEM-06) section has a row for every system the audit names;
//   - a `balance call (Qn)` row needs a Qn question that has no ruling yet, a
//     ruled Qn has no `balance call (Qn)` row left and at least one
//     `ruled (Qn, 2026-09-30)` row;
//   - a `match` row never carries a cell that admits a gap ("not stated",
//     "not printed", "omits"): a mismatch is fixed or ruled, never waved
//     through (ITEM-01's prohibition).
//
// Edge coverage (the ITEM-01 fallback probes):
//   - adjacency: items that share a name stem or an activation kind keep their
//     own row — the stock "Healing potion (stock)" and the Healing potion item,
//     the Cloak of Flying and the Bracelet of Flight, the Cure Poison and Cure
//     Disease potions; the checker is run on doctored copies of the doc and
//     must fail a merged row and a duplicated row;
//   - empty: a family with no item in the game (Wands) still has a row saying
//     so, and an item with no text of its own (a weapon, an armour) has its
//     Text cell filled from the stat line the player sees; the checker must
//     fail a doctored empty cell;
//   - ordering: rows follow the content tables' order; the checker must fail
//     a doctored swap of two rows.
//
// The doc is text and the test only reads it (plus content); no engine,
// rng or shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  WEAPONS,
  ARMORS,
  CLOAKS,
  JEWELRY,
  STAVES,
  POTIONS,
  TOOLS,
  TOOL_ORDER,
  BAG_ITEMS,
  BAG_ORDER,
  FAERIE,
  MISC_MAGIC,
} from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "ITEM-AUDIT.md");

/** FAMILIES — the fixed order of the `###` tables under `## Rows`. */
const FAMILIES = [
  "Weapons",
  "Magic weapons",
  "Armour",
  "Magic armour",
  "Cloaks",
  "Jewellery",
  "Staves",
  "Wands",
  "Potions",
  "Scrolls and books",
  "Tools",
  "Lockpicks",
  "Bags",
  "Treasure",
];

/** Families with a content table: the expected Item column, in content order. */
const STOCK_POTION_ROW = "Healing potion (stock)";
const EXPECTED_ITEMS = {
  Weapons: Object.keys(WEAPONS),
  Armour: ARMORS.map((a) => a.name),
  Cloaks: CLOAKS.map((r) => r.n),
  Jewellery: JEWELRY.map((r) => r.n),
  Staves: STAVES.map((r) => r.n),
  Potions: [STOCK_POTION_ROW, ...POTIONS.map((p) => p.n)],
  Tools: TOOL_ORDER.map((k) => TOOLS[k].n),
  Bags: BAG_ORDER.map((tier) => (tier === "small" ? "Small bag (starting)" : BAG_ITEMS[tier].n)),
};

/** The Treasure family's rows beyond the free-named chest and drop rows. */
const MISC_OUTCOMES = [...new Set(MISC_MAGIC)];
const EXPECTED_TREASURE_TAIL = [
  ...MISC_OUTCOMES.map((what) => `Misc Magic: ${what}`),
  ...FAERIE.map((gift) => `Faerie: ${gift}`),
];

/** SYSTEMS — every system the audit finds missing (plan step 6). */
const SYSTEMS = [
  "Joiner item use",
  "Joiner armour soak",
  "Wear-on-join",
  "Joiner item chips",
  "Joiner item timers and heal-over-time ticking",
  "Joiner Cloak of Speed second swing",
  "Poplar party heal",
  "Pendant source link",
  "Party-wide reach",
  "Joiner movement and sense items",
  "Joiner scroll",
  "Joiner armour repair",
];

/** VERDICT_TOKENS — the accepted verdict cells (each must match whole). */
const VERDICT_TOKENS = [
  /^match$/,
  /^not in game$/,
  /^ruled \(\d{4}-\d{2}-\d{2}\)$/,
  /^ruled \(Q\d+, 2026-09-30\) -> 89-\d\d( .+)?$/,
  /^(fix|fixed) (engine|text) \(89-\d\d(, 89-\d\d)*\)$/,
  /^balance call \(Q\d+\)$/,
];

const GAP_WORDS = /not stated|not printed|omits/i;

/** splitCells(line) — the cells of one table row (cells never hold a pipe). */
function splitCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** parseDoc(text) — the audit doc as plain data. */
function parseDoc(text) {
  const out = { families: [], rows: {}, systems: [], questions: [], rulings: [], haveSections: {} };
  let h2 = null;
  let family = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^## /.test(line)) {
      h2 = line.slice(3).trim();
      out.haveSections[h2] = true;
      family = null;
      continue;
    }
    if (/^### /.test(line)) {
      const h3 = line.slice(4).trim();
      if (h2 === "Rows") {
        family = h3;
        out.families.push(h3);
        out.rows[h3] = [];
      } else if (h2 === "Balance calls") {
        const m = h3.match(/^Q(\d+)\b/);
        if (m) out.questions.push(Number(m[1]));
      }
      continue;
    }
    if (h2 === "Rows" && family && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "Item" || /^-+$/.test(cells[0].replace(/\s/g, ""))) continue;
      out.rows[family].push(cells);
    } else if (h2 === "Systems (ITEM-06)" && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "System" || /^-+$/.test(cells[0].replace(/\s/g, ""))) continue;
      out.systems.push(cells);
    } else if (h2 === "Rulings") {
      const m = line.match(/^- Q(\d+) \(/);
      if (m) out.rulings.push(Number(m[1]));
    }
  }
  return out;
}

/** checkDoc(text) — every problem the coverage rules find, as strings. */
function checkDoc(text) {
  const problems = [];
  const doc = parseDoc(text);
  const add = (msg) => problems.push(msg);

  for (const s of ["How to read this table", "Rows", "Systems (ITEM-06)", "Findings for other phases", "Balance calls", "Rulings"]) {
    if (!doc.haveSections[s]) add(`missing section "## ${s}"`);
  }
  if (JSON.stringify(doc.families) !== JSON.stringify(FAMILIES)) {
    add(`families out of order or missing: got [${doc.families.join(", ")}]`);
  }

  const allVerdictRows = []; // [where, item, verdict]
  for (const family of FAMILIES) {
    const rows = doc.rows[family] || [];
    if (rows.length < 1) add(`${family}: no rows`);
    const names = rows.map((r) => r[0]);
    const seen = new Set();
    for (const n of names) {
      if (seen.has(n)) add(`${family}: duplicate row "${n}"`);
      seen.add(n);
    }
    if (EXPECTED_ITEMS[family]) {
      if (JSON.stringify(names) !== JSON.stringify(EXPECTED_ITEMS[family])) {
        const missing = EXPECTED_ITEMS[family].filter((n) => !names.includes(n));
        const extra = names.filter((n) => !EXPECTED_ITEMS[family].includes(n));
        add(`${family}: rows differ from the content table (missing [${missing.join(", ")}], extra [${extra.join(", ")}], or out of order)`);
      }
    }
    if (family === "Treasure") {
      const tail = names.filter((n) => /^(Misc Magic|Faerie): /.test(n));
      if (JSON.stringify(tail) !== JSON.stringify(EXPECTED_TREASURE_TAIL)) add("Treasure: Misc Magic and Faerie rows differ from the tables or are out of order");
      for (const need of ["Chest: wilmst", "Chest: sealed scroll", "Chest: treasure roll"]) {
        if (!names.includes(need)) add(`Treasure: missing row "${need}"`);
      }
    }
    for (const cells of rows) {
      if (cells.length !== 6) {
        add(`${family}: row "${cells[0]}" has ${cells.length} cells, not 6`);
        continue;
      }
      const [item, textCell, engine, canon, verdict, pinned] = cells;
      for (const [label, v] of [["Item", item], ["Text", textCell], ["Engine", engine], ["Canon", canon], ["Verdict", verdict], ["Pinned by", pinned]]) {
        if (!v) add(`${family}: row "${item}" has an empty ${label} cell`);
      }
      if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`${family}: row "${item}" has an unknown verdict "${verdict}"`);
      for (const m of verdict.matchAll(/\b89-(\d\d)\b/g)) {
        const n = Number(m[1]);
        if (n < 1 || n > 10) add(`${family}: row "${item}" names owner 89-${m[1]}, not a Phase 89 plan`);
      }
      if (verdict === "match" && cells.some((c) => GAP_WORDS.test(c))) add(`${family}: row "${item}" reads match but a cell admits a gap`);
      if (pinned && pinned !== "—") {
        for (const p of pinned.split(",").map((s) => s.trim())) {
          if (!fs.existsSync(path.join(REPO_ROOT, p))) add(`${family}: row "${item}" is pinned by "${p}", which does not exist`);
        }
      }
      allVerdictRows.push([family, item, verdict]);
    }
  }

  // Systems (ITEM-06)
  const systemNames = doc.systems.map((r) => r[0]);
  for (const s of SYSTEMS) {
    if (!systemNames.includes(s)) add(`Systems: missing row "${s}"`);
  }
  if (new Set(systemNames).size !== systemNames.length) add("Systems: duplicate row");
  for (const cells of doc.systems) {
    if (cells.length !== 3) {
      add(`Systems: row "${cells[0]}" has ${cells.length} cells, not 3`);
      continue;
    }
    if (cells.some((c) => !c)) add(`Systems: row "${cells[0]}" has an empty cell`);
    const verdict = cells[2];
    if (!VERDICT_TOKENS.some((re) => re.test(verdict))) add(`Systems: row "${cells[0]}" has an unknown verdict "${verdict}"`);
    for (const m of verdict.matchAll(/\b89-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 10) add(`Systems: row "${cells[0]}" names owner 89-${m[1]}, not a Phase 89 plan`);
    }
    allVerdictRows.push(["Systems", cells[0], verdict]);
  }

  // Balance calls versus rulings
  const ruled = new Set(doc.rulings);
  const openQ = new Set();
  const ruledQ = new Set();
  for (const [where, item, verdict] of allVerdictRows) {
    const open = verdict.match(/^balance call \(Q(\d+)\)$/);
    const done = verdict.match(/^ruled \(Q(\d+),/);
    if (open) {
      const q = Number(open[1]);
      openQ.add(q);
      if (!doc.questions.includes(q)) add(`${where}: row "${item}" points at Q${q}, which is not in Balance calls`);
      if (ruled.has(q)) add(`${where}: row "${item}" still reads balance call (Q${q}) but Q${q} has a ruling`);
    }
    if (done) {
      const q = Number(done[1]);
      ruledQ.add(q);
      if (!ruled.has(q)) add(`${where}: row "${item}" reads ruled (Q${q}) but Rulings records no Q${q}`);
    }
  }
  for (const q of doc.questions) {
    if (ruled.has(q)) {
      if (!ruledQ.has(q)) add(`Q${q} is ruled but no row reads ruled (Q${q}, 2026-09-30)`);
    } else if (!openQ.has(q)) {
      add(`Q${q} is asked but no row reads balance call (Q${q})`);
    }
  }
  for (const q of doc.rulings) {
    if (!doc.questions.includes(q)) add(`Rulings records Q${q}, which is not in Balance calls`);
  }
  // Q1 covers the three past-floor-12 rows by name.
  const q1Rows = allVerdictRows.filter(([, , v]) => /\(Q1\)|\(Q1,/.test(v)).map(([, item]) => item);
  for (const n of ["Amulet of Stone", "Oak Staff", "Cedar Staff"]) {
    if (!q1Rows.includes(n)) add(`Q1 must cover "${n}"`);
  }

  // Pre-owned verdicts (the fix may later read "fixed", never anything else).
  const find = (family, item) => (doc.rows[family] || []).find((r) => r[0] === item);
  const pre = [
    ["Potions", "Enlarge", /^(fix|fixed) engine \(89-02\)$/],
    ["Staves", "Poplar Staff", /^(fix|fixed) engine \(89-03\)$/],
    ["Jewellery", "Pendant of Fortitude", /^(fix|fixed) engine \(89-03\)$/],
    ["Potions", "Death", /^(fix|fixed) text \(89-09\)$/],
  ];
  for (const [family, item, re] of pre) {
    const row = find(family, item);
    if (!row || !re.test(row[4] || "")) add(`${family}: pre-owned row "${item}" does not carry its owner`);
  }
  return problems;
}

const DOC_TEXT = fs.readFileSync(DOC_PATH, "utf8");

test("docs/ITEM-AUDIT.md passes every coverage and consistency rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("the doc has its required sections and at least 14 family tables", () => {
  const doc = parseDoc(DOC_TEXT);
  assert.equal(doc.families.length, FAMILIES.length);
  assert.ok(FAMILIES.length >= 14);
  for (const s of ["Rows", "Systems (ITEM-06)", "Balance calls", "Rulings"]) assert.ok(doc.haveSections[s], s);
});

test("every content table is covered row for row, in content order", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const [family, expected] of Object.entries(EXPECTED_ITEMS)) {
    assert.deepEqual(
      doc.rows[family].map((r) => r[0]),
      expected,
      family,
    );
  }
});

test("adjacency: name-stem and activation-kind neighbours each keep their own row", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = (f) => doc.rows[f].map((r) => r[0]);
  // the stock healing potion vs the Healing potion item
  assert.ok(names("Potions").includes(STOCK_POTION_ROW));
  assert.ok(names("Potions").includes("Healing"));
  // the two fly items, the two cures, the two stone items, the two haste items
  assert.ok(names("Cloaks").includes("Cloak of Flying"));
  assert.ok(names("Jewellery").includes("Bracelet of Flight"));
  assert.ok(names("Potions").includes("Cure Poison") && names("Potions").includes("Cure Disease"));
  assert.ok(names("Jewellery").includes("Amulet of Stone") && names("Staves").includes("Oak Staff"));
  assert.ok(names("Cloaks").includes("Cloak of Speed") && names("Potions").includes("Speed"));
  // the Text cell of a potion says both the found and the store names where they differ
  const invisible = doc.rows.Potions.find((r) => r[0] === "Invisible");
  assert.match(invisible[1], /Invisible potion \(clear\)/);
  assert.match(invisible[1], /store line "Invisible potion"/);
});

test("empty: Wands has its row, and weapons and armours have Text from the stat line", () => {
  const doc = parseDoc(DOC_TEXT);
  assert.equal(doc.rows.Wands.length, 1);
  assert.equal(doc.rows.Wands[0][4], "not in game");
  for (const family of ["Weapons", "Armour"]) {
    for (const r of doc.rows[family]) assert.ok(r[1].length > 10, `${family} ${r[0]} has no text`);
  }
});

test("the checker fails a missing row, a duplicate row, a merged row, an empty cell and an unknown verdict", () => {
  const lines = DOC_TEXT.split("\n");
  const rowIdx = (item) => lines.findIndex((l) => l.startsWith(`| ${item} |`));
  const mutate = (fn) => {
    const copy = lines.slice();
    fn(copy);
    return copy.join("\n");
  };
  // missing
  const i = rowIdx("Club");
  assert.ok(checkDoc(mutate((c) => c.splice(i, 1))).some((p) => /Weapons/.test(p)));
  // duplicate
  assert.ok(checkDoc(mutate((c) => c.splice(i, 0, c[i]))).some((p) => /duplicate row "Club"/.test(p)));
  // merged: the Bracelet of Flight folded into the Cloak of Flying
  const b = rowIdx("Bracelet of Flight");
  assert.ok(checkDoc(mutate((c) => c.splice(b, 1))).some((p) => /Jewellery/.test(p)));
  // empty cell
  const empty = mutate((c) => {
    const cells = splitCells(c[i]);
    cells[2] = "";
    c[i] = `| ${cells.join(" | ")} |`;
  });
  assert.ok(checkDoc(empty).some((p) => /empty Engine cell/.test(p)));
  // unknown verdict and a non-Phase-89 owner
  const badVerdict = mutate((c) => (c[i] = c[i].replace("| match |", "| sort of |")));
  assert.ok(checkDoc(badVerdict).some((p) => /unknown verdict "sort of"/.test(p)));
  const badOwner = mutate((c) => (c[i] = c[i].replace("| match |", "| fix text (89-11) |")));
  assert.ok(checkDoc(badOwner).some((p) => /89-11/.test(p)));
  // ordering: swap two weapons
  const a = rowIdx("Axe");
  const swapped = mutate((c) => {
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(swapped).some((p) => /out of order/.test(p)));
});

test("the checker fails a balance call whose question already has a ruling", () => {
  assert.ok(DOC_TEXT.includes("balance call (Q1)") || DOC_TEXT.includes("ruled (Q1, 2026-09-30)"));
  const doctored = DOC_TEXT.replace("## Rulings\n", "## Rulings\n\n- Q5 (2026-09-30): doctored.\n");
  const problems = checkDoc(doctored);
  if (/\| balance call \(Q5\) \|/.test(DOC_TEXT)) {
    assert.ok(problems.some((p) => /still reads balance call \(Q5\)/.test(p)));
  }
});

test("the checker fails a match row that admits a gap", () => {
  const i = DOC_TEXT.split("\n").findIndex((l) => l.startsWith("| Club |"));
  const lines = DOC_TEXT.split("\n");
  lines[i] = lines[i].replace("d6, 25", "d6, 25 (the to-hit is not stated)");
  assert.ok(checkDoc(lines.join("\n")).some((p) => /admits a gap/.test(p)));
});

test("Systems (ITEM-06) names every system the audit found missing", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.systems.map((r) => r[0]);
  for (const s of SYSTEMS) assert.ok(names.includes(s), s);
});
