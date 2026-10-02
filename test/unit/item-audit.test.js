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
// Phase 89 plan 10 (the close): the same checker now also enforces the CLOSE
// state of the table, so it can never reopen unnoticed:
//   - no Verdict (row or system) reads `fix engine`, `fix text` or
//     `balance call`: every mismatch is fixed or ruled;
//   - every `fixed engine`, `fixed text` and `ruled` row has a Pinned by that
//     names at least one test as `test/unit/<file>.test.js: <title>`; every
//     named file exists and its source contains the named title, so a pin
//     cannot name a test that is gone or renamed; only `match` and
//     `not in game` rows may read `—`;
//   - every Systems entry reads `built (89-NN)` or `ruled (Qn, ...) -> 89-NN`
//     followed by `; pinned by` and pins that exist;
//   - the header's "Closed" line states the true number of distinct pins.
//
// The doc is text and the test only reads it (plus content and the named test
// files); no engine, rng or shell module runs.

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
  // Phase 92.2 plan 01 (user 2026-10-02): a row a later phase fixed, e.g. the Strength potion also boosting spells.
  /^fixed \(92\.2-\d\d\)$/,
  /^balance call \(Q\d+\)$/,
];

/** OPEN_VERDICT — the open states a closed table may not contain. */
const OPEN_VERDICT = /^(fix engine|fix text|balance call)\b/;

/** SYSTEM_VERDICT — a Systems cell: built or ruled, then "; pinned by" and the pins. */
const SYSTEM_VERDICT = /^(built \(89-\d\d(?:, 89-\d\d)*\)|ruled \(Q\d+, 2026-09-30\) -> 89-\d\d); pinned by (.+)$/;

/** PIN — one pin: a test file, and (required on a fixed or ruled row) the title. */
const PIN = /^(test\/[A-Za-z0-9_\-/.]+\.test\.js)(?:: (.+))?$/;

const GAP_WORDS = /not stated|not printed|omits/i;

const sourceCache = new Map();
/** sourceOf(relPath) — a test file's source, or null when it is missing. */
function sourceOf(rel) {
  if (!sourceCache.has(rel)) {
    const abs = path.join(REPO_ROOT, rel);
    sourceCache.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null);
  }
  return sourceCache.get(rel);
}

/**
 * pinProblems(where, pinned, { needTitle, allowDash }) — every problem with a
 * Pinned by cell: malformed pins, a missing file, a title the file does not
 * contain, and (needTitle) no pin that names a title at all.
 */
function pinProblems(where, pinned, { needTitle, allowDash }) {
  if (pinned === "—") return allowDash ? [] : [`${where}: is not pinned (—), but it is fixed or ruled`];
  const out = [];
  let titled = 0;
  for (const raw of pinned.split("; ")) {
    const m = PIN.exec(raw.trim());
    if (!m) {
      out.push(`${where}: malformed pin "${raw}" (want test/unit/<file>.test.js: <title>)`);
      continue;
    }
    const src = sourceOf(m[1]);
    if (src === null) {
      out.push(`${where}: is pinned by "${m[1]}", which does not exist`);
      continue;
    }
    if (m[2] !== undefined) {
      titled++;
      if (!src.includes(m[2])) out.push(`${where}: pin "${m[1]}: ${m[2]}" names a test title that is not in the file`);
    }
  }
  if (needTitle && titled === 0) out.push(`${where}: pinned by file only, but a fixed or ruled row must name a test title`);
  return out;
}

/** distinctPins(text) — every distinct titled pin in the rows and systems of the doc. */
function distinctPins(text) {
  const doc = parseDoc(text);
  const set = new Set();
  const add = (cell) => {
    for (const raw of cell.split("; ")) if (PIN.exec(raw.trim()) && raw.includes(": ")) set.add(raw.trim());
  };
  for (const rows of Object.values(doc.rows)) for (const cells of rows) if (cells.length === 6) add(cells[5]);
  for (const cells of doc.systems) {
    if (cells.length !== 3) continue;
    const m = SYSTEM_VERDICT.exec(cells[2]);
    if (m) add(m[2]);
  }
  return set;
}

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
      if (OPEN_VERDICT.test(verdict)) add(`${family}: row "${item}" is still open ("${verdict}"): a closed table has no fix engine, fix text or balance call`);
      if (pinned) {
        const settled = /^(fixed (engine|text)|fixed \(92\.2-\d\d\)|ruled)/.test(verdict);
        for (const p of pinProblems(`${family}: row "${item}"`, pinned, { needTitle: settled, allowDash: !settled })) add(p);
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
    const cell = cells[2];
    if (OPEN_VERDICT.test(cell)) add(`Systems: row "${cells[0]}" is still open ("${cell}"): every system is built or ruled`);
    const sys = SYSTEM_VERDICT.exec(cell);
    if (!sys) {
      add(`Systems: row "${cells[0]}" has an unknown verdict "${cell}" (want built (89-NN) or ruled (Qn, 2026-09-30) -> 89-NN, then "; pinned by" and its pins)`);
    } else {
      for (const p of pinProblems(`Systems: row "${cells[0]}"`, sys[2], { needTitle: true, allowDash: false })) add(p);
    }
    const verdict = sys ? sys[1] : cell;
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

  // Pre-owned verdicts: the rows 89-01 handed to a plan end as "fixed", with that plan's owner.
  const find = (family, item) => (doc.rows[family] || []).find((r) => r[0] === item);
  const pre = [
    ["Potions", "Enlarge", /^fixed engine \(89-02\)$/],
    ["Staves", "Poplar Staff", /^fixed engine \(89-03\)$/],
    ["Jewellery", "Pendant of Fortitude", /^fixed engine \(89-03\)$/],
    ["Potions", "Death", /^fixed text \(89-09\)$/],
  ];
  for (const [family, item, re] of pre) {
    const row = find(family, item);
    if (!row || !re.test(row[4] || "")) add(`${family}: pre-owned row "${item}" does not read its final verdict`);
  }

  // The close: the header says so, and states the true pin count.
  const closed = /^\*\*Closed:\*\* 2026-09-30 \(plan 89-10\).*?\((\d+) distinct pins\)/m.exec(text.replace(/\r\n/g, "\n"));
  if (!closed) add('the header has no "**Closed:** 2026-09-30 (plan 89-10)" line stating its distinct pins');
  else if (Number(closed[1]) !== distinctPins(text).size) add(`the Closed line says ${closed[1]} distinct pins but the table names ${distinctPins(text).size}`);
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

// --- the close (89-10) -------------------------------------------------------

/** doctor(fn) — the real doc, with `fn` applied to its lines. */
function doctor(fn) {
  const lines = DOC_TEXT.split("\n");
  fn(lines, (item) => lines.findIndex((l) => l.startsWith(`| ${item} |`)));
  return lines.join("\n");
}

test("the close: no row and no system reads fix engine, fix text or balance call, and the Rows hold at least 20 titled pins", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const [family, rows] of Object.entries(doc.rows)) {
    for (const r of rows) assert.ok(!OPEN_VERDICT.test(r[4]), `${family}: ${r[0]} reads ${r[4]}`);
  }
  for (const s of doc.systems) assert.ok(!OPEN_VERDICT.test(s[2]), `Systems: ${s[0]} reads ${s[2]}`);
  const titled = Object.values(doc.rows).flat().filter((r) => / test\/unit\/[^;]*\.test\.js: /.test(` ${r[5]}`)).length;
  assert.ok(titled >= 20, `${titled} rows name a test title`);
});

test("the close: a row turned back into fix text, fix engine or balance call fails", () => {
  const back = doctor((lines, at) => {
    const i = at("Rapier");
    lines[i] = lines[i].replace("| fixed text (89-09) |", "| fix text (89-09) |");
  });
  assert.ok(checkDoc(back).some((p) => /Rapier.*still open/.test(p)));
  const engine = doctor((lines, at) => {
    const i = at("Poplar Staff");
    lines[i] = lines[i].replace("| fixed engine (89-03) |", "| fix engine (89-03) |");
  });
  assert.ok(checkDoc(engine).some((p) => /Poplar Staff.*still open/.test(p)));
  const call = doctor((lines, at) => {
    const i = at("Amulet of Stone");
    lines[i] = lines[i].replace(/\| ruled \(Q1, 2026-09-30\) -> 89-08[^|]*\|/, "| balance call (Q1) |");
  });
  assert.ok(checkDoc(call).some((p) => /Amulet of Stone.*still open/.test(p)));
});

test("the close: a fixed or ruled row whose pin names a missing title, a missing file, no title or no pin fails", () => {
  const pinnedAs = (item, pin) =>
    doctor((lines, at) => {
      const i = at(item);
      const cells = splitCells(lines[i]);
      cells[5] = pin;
      lines[i] = `| ${cells.join(" | ")} |`;
    });
  assert.ok(checkDoc(pinnedAs("Ring of Power", "test/unit/authored-ranges.test.js: a title that was never written")).some((p) => /Ring of Power.*title that is not in the file/.test(p)));
  assert.ok(checkDoc(pinnedAs("Ring of Power", "test/unit/nope-not-there.test.js: whatever")).some((p) => /Ring of Power.*does not exist/.test(p)));
  assert.ok(checkDoc(pinnedAs("Ring of Power", "test/unit/authored-ranges.test.js")).some((p) => /Ring of Power.*must name a test title/.test(p)));
  assert.ok(checkDoc(pinnedAs("Ring of Power", "—")).some((p) => /Ring of Power.*is not pinned/.test(p)));
  assert.ok(checkDoc(pinnedAs("Ring of Power", "authored-ranges, not a path")).some((p) => /Ring of Power.*malformed pin/.test(p)));
  // A match row may keep a bare file, and the Wands row (not in game) may read —.
  assert.deepEqual(checkDoc(pinnedAs("Club", "test/unit/gear-axes.test.js")), []);
});

test("the close: a system that is not built or ruled, or whose pin is gone, fails", () => {
  const sysAs = (system, cell) =>
    doctor((lines, at) => {
      const i = at(system);
      const cells = splitCells(lines[i]);
      cells[2] = cell;
      lines[i] = `| ${cells.join(" | ")} |`;
    });
  assert.ok(checkDoc(sysAs("Joiner scroll", "fix engine (89-05)")).some((p) => /Joiner scroll.*still open/.test(p)));
  assert.ok(checkDoc(sysAs("Joiner scroll", "built (89-05)")).some((p) => /Joiner scroll.*unknown verdict/.test(p)));
  assert.ok(checkDoc(sysAs("Joiner scroll", "built (89-05); pinned by test/unit/joiner-item-use.test.js: no such title anywhere")).some((p) => /Joiner scroll.*title that is not in the file/.test(p)));
});

test("the close: the Closed line states the true number of distinct pins, and its absence fails", () => {
  const n = distinctPins(DOC_TEXT).size;
  assert.ok(n >= 20, `${n} distinct pins`);
  const wrong = DOC_TEXT.replace(`(${n} distinct pins)`, `(${n + 1} distinct pins)`);
  assert.ok(checkDoc(wrong).some((p) => /Closed line says/.test(p)));
  const gone = DOC_TEXT.replace("**Closed:**", "**Opened:**");
  assert.ok(checkDoc(gone).some((p) => /no "\*\*Closed:\*\*/.test(p)));
});

test("the close: the rows the fix plans owned each read their final verdict and name the plan's own pin file", () => {
  const doc = parseDoc(DOC_TEXT);
  const row = (family, item) => doc.rows[family].find((r) => r[0] === item);
  const expect = [
    ["Potions", "Enlarge", "fixed engine (89-02)", "test/unit/enlarge-potion.test.js"],
    ["Staves", "Poplar Staff", "fixed engine (89-03)", "test/unit/poplar-party-heal.test.js"],
    ["Jewellery", "Pendant of Fortitude", "fixed engine (89-03)", "test/unit/pendant-source-link.test.js"],
    ["Potions", "Death", "fixed text (89-09)", "test/unit/item-text-wording.test.js"],
    ["Staves", "Walnut Staff", "ruled (Q6, 2026-09-30) -> 89-08", "test/unit/item-audit-fixes.test.js"],
    ["Potions", "Cure Poison", "ruled (Q5, 2026-09-30) -> 89-08", "test/unit/item-audit-fixes.test.js"],
    ["Jewellery", "Amulet of Stone", "ruled (Q1, 2026-09-30) -> 89-08", "test/unit/item-audit-fixes.test.js"],
  ];
  for (const [family, item, verdict, file] of expect) {
    const r = row(family, item);
    assert.ok(r[4].startsWith(verdict), `${item}: ${r[4]}`);
    assert.ok(r[5].includes(file), `${item} is pinned by ${file}`);
  }
});
