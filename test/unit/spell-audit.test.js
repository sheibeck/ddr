// test/unit/spell-audit.test.js
//
// Phase 90 (SPELL-08; plan 90-01) — the coverage and consistency test for
// docs/SPELL-AUDIT.md, the spell audit table. It parses the `### Spells` table
// under `## Spells`, the two `## School gates` tables, the Balance calls and the
// Rulings, and checks them against the live content tables, so the doc can
// never silently lose a spell, double a spell, or leave a cell empty:
//
//   - every spell in SPELLS (content/spells.js) has exactly one row, and so does
//     every spell the user ruled in (the ten-spell SLATE) and every spell the
//     user ruled out (REMOVED, kept as a `removed (90-06)` row after plan 90-06
//     deletes it from SPELLS);
//   - no Spell, Lvl · School, Text, Engine, Rolls, Canon or Verdict cell is
//     empty, and every row has all eight cells;
//   - every Verdict starts with one accepted token, and every owner `90-NN`
//     names a Phase 90 plan (01 to 12); slate rows read `new (90-NN)` with the
//     plan that builds them, removed rows `removed (90-06)`;
//   - the `## School gates` section has one row per Magic User sub-class
//     (every MU_CHART key) and a hand-out paths table naming every path that
//     gives out a spell;
//   - a `balance call (Qn)` row needs a Qn question in `## Balance calls` that
//     has no ruling yet, and a ruled Qn has no `balance call (Qn)` row left;
//   - a `match` row never carries a cell that admits a gap.
//
// Edge coverage (the SPELL-08 fallback probes):
//   - adjacency: spells that share a kind or a name stem each keep their own
//     row (Fireball and Fireballs; Summon, Lesser Summon and Phantom Host;
//     Heal and Major Heal; Doze and Stun; the offensive Death, which is level 5
//     offense, never the potion Death); the checker is run on doctored copies of
//     the doc and must fail a merged row and a duplicated row;
//   - empty: a spell with no to-hit roll, no damage or no resist says so in its
//     Rolls cell ("no to-hit roll", "no damage", "never resisted"), and the
//     checker must fail a doctored empty cell;
//   - encoding: the Spell cell equals the content name code unit for code unit
//     (Open/Lock with its slash, Size of the Behemoth), compared WITHOUT
//     normalising, and a Rolls cell writes ranges with the en dash and
//     negative modifiers with the minus sign the rollRange.js formatter uses;
//   - ordering: rows follow SPELLS array order, then the slate rows in their
//     planned append order. The test pins the RELATIVE order of every row whose
//     name is in SPELLS now, so later plans that remove or append SPELLS rows
//     keep it green without reordering the doc; the checker must fail a
//     doctored swap of two rows.
//
// The doc is text and the test only reads it (plus content); no engine, rng or
// shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { SPELLS, MU_CHART } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SPELL-AUDIT.md");

/** SLATE — the ten spells the user ruled in (90-CONTEXT), in their planned append order, with the plan that builds each. */
const SLATE = ["Open/Lock", "Fly", "Enchant Character", "Speed of Sound", "Stop Time", "Senseless", "Duplicate Foe", "Door Illusion", "Chameleon Tongue", "Size of the Behemoth"];
const SLATE_OWNER = {
  "Open/Lock": "90-07",
  Fly: "90-07",
  "Enchant Character": "90-07",
  "Speed of Sound": "90-07",
  "Stop Time": "90-08",
  Senseless: "90-08",
  "Duplicate Foe": "90-08",
  "Door Illusion": "90-09",
  "Chameleon Tongue": "90-09",
  "Size of the Behemoth": "90-09",
};

/** REMOVED — the spells the user ruled out; plan 90-06 deletes them and the doc keeps their row. */
const REMOVED = ["Lesser Summon", "Phantom Host"];

/** VERDICT_TOKENS — the accepted verdict cells. */
const VERDICT_TOKENS = [
  /^match$/,
  /^(fix|fixed) (engine|text) \(90-\d\d\)$/,
  /^balance call \(Q\d+\)$/,
  /^ruled \(Q\d+, 2026-09-30\) -> 90-\d\d( .+)?$/,
  /^ruled \(2026-09-30\) -> 90-\d\d( .+)?$/,
  /^new \(90-\d\d\)$/,
  /^removed \(90-06\)$/,
  /^Phase 91 \(IDENT-\d\d\)$/,
  /^Phase 92$/,
];

/** PRE_OWNED — the rows the user already ruled, and the plan that builds each. */
const PRE_OWNED = {
  Strength: "90-03",
  Petrify: "90-04",
  Blind: "90-04",
  Doze: "90-05",
  Stun: "90-05",
  Ice: "90-05",
  Summon: "90-06",
  "Mirror Self": "90-06",
};

const SECTIONS = ["How to read this table", "Spells", "School gates", "Cross-cutting rules", "Findings for other phases", "Balance calls", "Rulings"];
const PATH_NEEDLES = ["rollGrimoire", "checkLevel", "findGrimoire", "readScroll", "Sealed scroll", "canCast"];
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

const isSeparator = (cells) => /^-+$/.test(cells[0].replace(/\s/g, ""));

/** parseDoc(text) — the audit doc as plain data. */
function parseDoc(text) {
  const out = { rows: [], subs: [], paths: [], questions: [], rulings: [], haveSections: {} };
  let h2 = null;
  let h3 = null;
  let mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^## /.test(line)) {
      h2 = line.slice(3).trim();
      out.haveSections[h2] = true;
      h3 = null;
      mode = null;
      continue;
    }
    if (/^### /.test(line)) {
      h3 = line.slice(4).trim();
      if (h2 === "Balance calls") {
        const m = h3.match(/^Q(\d+)\b/);
        if (m) out.questions.push(Number(m[1]));
      }
      continue;
    }
    if (h2 === "Spells" && h3 === "Spells" && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "Spell" || isSeparator(cells)) continue;
      out.rows.push(cells);
    } else if (h2 === "School gates" && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "Sub-class") {
        mode = "subs";
        continue;
      }
      if (cells[0] === "Path") {
        mode = "paths";
        continue;
      }
      if (isSeparator(cells)) continue;
      if (mode === "subs") out.subs.push(cells);
      else if (mode === "paths") out.paths.push(cells);
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

  for (const s of SECTIONS) if (!doc.haveSections[s]) add(`missing section "## ${s}"`);

  const names = doc.rows.map((r) => r[0]);
  const seen = new Set();
  for (const n of names) {
    if (seen.has(n)) add(`duplicate row "${n}"`);
    seen.add(n);
  }
  const contentNames = SPELLS.map((s) => s.n);
  const known = new Set([...contentNames, ...SLATE, ...REMOVED]);
  for (const n of contentNames) if (!names.includes(n)) add(`missing a row for the spell "${n}"`);
  for (const n of SLATE) if (!names.includes(n)) add(`missing a row for the slate spell "${n}"`);
  for (const n of REMOVED) if (!names.includes(n)) add(`missing a row for the removed spell "${n}"`);
  for (const n of names) if (!known.has(n)) add(`row "${n}" is not in SPELLS, the slate or the removed list`);

  // Ordering: SPELLS names in SPELLS relative order; slate rows in slate order and after every other row.
  const inSpells = names.filter((n) => contentNames.includes(n) && !SLATE.includes(n));
  const idx = inSpells.map((n) => contentNames.indexOf(n));
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] < idx[i - 1]) {
      add(`rows out of order: "${inSpells[i - 1]}" must come after "${inSpells[i]}" (SPELLS order)`);
      break;
    }
  }
  const slatePos = SLATE.map((n) => names.indexOf(n)).filter((p) => p >= 0);
  for (let i = 1; i < slatePos.length; i++) {
    if (slatePos[i] < slatePos[i - 1]) {
      add("slate rows out of order (planned append order: " + SLATE.join(", ") + ")");
      break;
    }
  }
  const firstSlate = slatePos.length ? Math.min(...slatePos) : Infinity;
  names.forEach((n, i) => {
    if (!SLATE.includes(n) && i > firstSlate) add(`row "${n}" comes after a slate row (slate rows go last)`);
  });

  const allVerdicts = []; // [name, verdict]
  for (const cells of doc.rows) {
    if (cells.length !== 8) {
      add(`row "${cells[0]}" has ${cells.length} cells, not 8`);
      continue;
    }
    const [name, lvl, textCell, engine, rolls, canon, verdict, pinned] = cells;
    for (const [label, v] of [["Spell", name], ["Lvl · School", lvl], ["Text", textCell], ["Engine", engine], ["Rolls", rolls], ["Canon", canon], ["Verdict", verdict], ["Pinned by", pinned]]) {
      if (!v) add(`row "${name}" has an empty ${label} cell`);
    }
    if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`row "${name}" has an unknown verdict "${verdict}"`);
    for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 12) add(`row "${name}" names owner 90-${m[1]}, not a Phase 90 plan`);
    }
    if (SLATE.includes(name) && verdict !== `new (${SLATE_OWNER[name]})`) add(`slate row "${name}" must read new (${SLATE_OWNER[name]}), not "${verdict}"`);
    if (REMOVED.includes(name) && verdict !== "removed (90-06)") add(`removed row "${name}" must read removed (90-06), not "${verdict}"`);
    if (PRE_OWNED[name] && !verdict.includes(PRE_OWNED[name])) add(`pre-owned row "${name}" does not name ${PRE_OWNED[name]} in "${verdict}"`);
    if (verdict === "match" && cells.some((c) => GAP_WORDS.test(c))) add(`row "${name}" reads match but a cell admits a gap`);
    // Encoding: authored ranges use the en dash and negative modifiers the minus sign.
    const rollsNoPlans = rolls.replace(/\b90-\d\d\b/g, "90"); // a plan id (90-04) is not a range
    if (/\d-\d/.test(rollsNoPlans) || /(^|[\s(])-\d/.test(rollsNoPlans)) add(`row "${name}" writes a range or a negative modifier with an ASCII hyphen in its Rolls cell (use – and −)`);
    // Empty: every Rolls cell says its to-hit, resist, backfire and fumble state, even when the answer is none.
    if (rolls && !/to-hit|to hit|hits on|\+\d to hit/i.test(rolls)) add(`row "${name}" Rolls cell states no to-hit roll`);
    if (rolls && !/never resisted|resist|(parley is the roll)/i.test(rolls)) add(`row "${name}" Rolls cell states no resist`);
    if (rolls && !/damage|heals|absorbs|kill|dies|no hp/i.test(rolls)) add(`row "${name}" Rolls cell states no damage`);
    if (rolls && !/backfire/i.test(rolls)) add(`row "${name}" Rolls cell states no backfire`);
    if (rolls && !/fumble/i.test(rolls)) add(`row "${name}" Rolls cell states no scroll fumble`);
    allVerdicts.push([name, verdict]);
  }

  // School gates: one row per MU_CHART sub-class, then the hand-out paths table.
  const subNames = doc.subs.map((r) => r[0]);
  const chartKeys = Object.keys(MU_CHART);
  if (new Set(subNames).size !== subNames.length) add("School gates: duplicate sub-class row");
  for (const k of chartKeys) if (!subNames.includes(k)) add(`School gates: missing the sub-class "${k}"`);
  for (const n of subNames) if (!chartKeys.includes(n)) add(`School gates: "${n}" is not a MU_CHART sub-class`);
  if (JSON.stringify(subNames) !== JSON.stringify(chartKeys) && !problems.some((p) => p.startsWith("School gates"))) add("School gates: sub-class rows are out of MU_CHART order");
  for (const cells of doc.subs) {
    if (cells.length !== 8) {
      add(`School gates: row "${cells[0]}" has ${cells.length} cells, not 8`);
      continue;
    }
    if (cells.some((c) => !c)) add(`School gates: row "${cells[0]}" has an empty cell`);
  }
  const wizard = doc.subs.find((r) => r[0] === "Wizard");
  if (wizard && wizard.length === 8 && !/Illusion/.test(wizard[7])) add("School gates: the Wizard's After Phase 90 cell must name the lost Illusion school");
  const summoner = doc.subs.find((r) => r[0] === "Summoner");
  if (summoner && summoner.length === 8 && !/Summon/.test(summoner[7])) add("School gates: the Summoner's After Phase 90 cell must name its Summon exception");
  if (doc.paths.length < 10) add(`School gates: the hand-out paths table has ${doc.paths.length} rows, expected at least 10`);
  for (const needle of PATH_NEEDLES) {
    if (!doc.paths.some((r) => r[0].includes(needle))) add(`School gates: no hand-out path row names "${needle}"`);
  }
  for (const cells of doc.paths) {
    if (cells.length !== 3) {
      add(`School gates: path row "${cells[0]}" has ${cells.length} cells, not 3`);
      continue;
    }
    if (cells.some((c) => !c)) add(`School gates: path row "${cells[0]}" has an empty cell`);
    const verdict = cells[2];
    if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`School gates: path row "${cells[0]}" has an unknown verdict "${verdict}"`);
    for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 12) add(`School gates: path row "${cells[0]}" names owner 90-${m[1]}, not a Phase 90 plan`);
    }
    allVerdicts.push([`path: ${cells[0]}`, verdict]);
  }

  // Balance calls versus rulings.
  const ruled = new Set(doc.rulings);
  const openQ = new Set();
  const ruledQ = new Set();
  for (const [where, verdict] of allVerdicts) {
    const open = verdict.match(/^balance call \(Q(\d+)\)$/);
    const done = verdict.match(/^ruled \(Q(\d+),/);
    if (open) {
      const q = Number(open[1]);
      openQ.add(q);
      if (!doc.questions.includes(q)) add(`row "${where}" points at Q${q}, which is not in Balance calls`);
      if (ruled.has(q)) add(`row "${where}" still reads balance call (Q${q}) but Q${q} has a ruling`);
    }
    if (done) {
      const q = Number(done[1]);
      ruledQ.add(q);
      if (!ruled.has(q)) add(`row "${where}" reads ruled (Q${q}) but Rulings records no Q${q}`);
    }
  }
  for (const q of doc.questions) {
    if (ruled.has(q)) {
      // A ruled question is carried by a `ruled (Qn, 2026-09-30)` verdict, or (a cross-cutting rule such as Q6) named in a row's Rolls cell.
      const named = doc.rows.some((r) => r.length === 8 && new RegExp(`\\bQ${q}\\b`).test(r[4]));
      if (!ruledQ.has(q) && !named) add(`Q${q} is ruled but no row reads ruled (Q${q}, 2026-09-30) or names Q${q} in its Rolls cell`);
    } else if (!openQ.has(q)) {
      add(`Q${q} is asked but no row reads balance call (Q${q}) (and it has no ruling)`);
    }
  }
  for (const q of doc.rulings) {
    if (!doc.questions.includes(q)) add(`Rulings records Q${q}, which is not in Balance calls`);
  }
  return problems;
}

const DOC_TEXT = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // a CRLF checkout reads like the LF one

/** doctor(fn) — the real doc, with `fn` applied to its lines (and a finder for a spell's row). */
function doctor(fn) {
  const lines = DOC_TEXT.split(/\r?\n/);
  fn(lines, (name) => lines.findIndex((l) => l.startsWith(`| ${name} |`)));
  return lines.join("\n");
}

test("docs/SPELL-AUDIT.md passes every coverage and consistency rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("the doc has its required sections and a row for every spell, slate spell and removed spell", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const s of SECTIONS) assert.ok(doc.haveSections[s], s);
  const names = doc.rows.map((r) => r[0]);
  for (const sp of SPELLS) assert.equal(names.filter((n) => n === sp.n).length, 1, `${sp.n}: one row`);
  for (const n of [...SLATE, ...REMOVED]) assert.equal(names.filter((x) => x === n).length, 1, `${n}: one row`);
  assert.equal(names.length, new Set([...SPELLS.map((s) => s.n), ...SLATE, ...REMOVED]).size);
});

test("encoding: the Spell cell equals the content name code unit for code unit, with no normalising", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  for (const sp of SPELLS) {
    const hit = names.find((n) => n === sp.n);
    assert.equal(hit, sp.n);
    assert.equal(hit.length, sp.n.length);
  }
  assert.ok(names.includes("Open/Lock"), "the slash in Open/Lock survives");
  assert.ok(names.includes("Size of the Behemoth"));
  assert.ok(names.includes("Map the Floor"));
  // Ranges use the en dash and negative modifiers the minus sign (rollRange.js).
  assert.ok(doc.rows.some((r) => r[4].includes("16–20")), "an authored resist range uses the en dash");
  assert.ok(doc.rows.some((r) => r[4].includes("−2")), "a negative modifier uses the minus sign");
  for (const r of doc.rows) assert.ok(!/\d-\d/.test(r[4].replace(/\b90-\d\d\b/g, "90")), `${r[0]}: no ASCII-hyphen range in Rolls`);
});

test("adjacency: spells that share a kind or a name stem each keep their own row", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  for (const [a, b] of [["Fireball", "Fireballs"], ["Summon", "Lesser Summon"], ["Summon", "Phantom Host"], ["Heal", "Major Heal"], ["Doze", "Stun"], ["Mirror Self", "Phantom Host"]]) {
    assert.ok(names.includes(a) && names.includes(b), `${a} and ${b} each have a row`);
    assert.notEqual(names.indexOf(a), names.indexOf(b));
  }
  // The offensive Death is a level-5 offense spell, never the potion of the same name.
  const death = doc.rows.find((r) => r[0] === "Death");
  assert.match(death[1], /^5 · offense$/);
  assert.equal(names.filter((n) => n === "Death").length, 1);
  // Fireball and Fireballs are different spells at different levels.
  assert.match(doc.rows.find((r) => r[0] === "Fireball")[1], /^3 · offense$/);
  assert.match(doc.rows.find((r) => r[0] === "Fireballs")[1], /^4 · offense$/);
});

test("empty: a spell with no to-hit roll, no damage or no resist says so in its Rolls cell", () => {
  const doc = parseDoc(DOC_TEXT);
  const rolls = (n) => doc.rows.find((r) => r[0] === n)[4];
  assert.match(rolls("Heal"), /no to-hit roll/);
  assert.match(rolls("Heal"), /never resisted/);
  assert.match(rolls("Doze"), /no damage/);
  assert.match(rolls("Fly"), /no damage/);
  assert.match(rolls("Open/Lock"), /never resisted/);
  assert.match(rolls("Fireball"), /to hit/);
  for (const r of doc.rows) for (const c of r) assert.ok(c.length > 0, `${r[0]}: no blank cell`);
});

test("ordering: rows follow SPELLS order, then the ten slate rows in their append order", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  const tail = names.slice(-SLATE.length);
  assert.deepEqual(tail, SLATE);
  const contentNames = SPELLS.map((s) => s.n).filter((n) => !SLATE.includes(n));
  const idx = contentNames.map((n) => names.indexOf(n));
  assert.ok(idx.every((p, i) => p >= 0 && (i === 0 || p > idx[i - 1])), "SPELLS relative order");
});

test("pre-owned rows name the plan that builds them", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const [name, plan] of Object.entries(PRE_OWNED)) {
    const row = doc.rows.find((r) => r[0] === name);
    assert.ok(row[6].includes(plan), `${name}: ${row[6]}`);
  }
  for (const n of REMOVED) assert.equal(doc.rows.find((r) => r[0] === n)[6], "removed (90-06)");
  for (const n of SLATE) assert.equal(doc.rows.find((r) => r[0] === n)[6], `new (${SLATE_OWNER[n]})`);
});

test("School gates: one row per MU_CHART sub-class and a hand-out paths table that names every path", () => {
  const doc = parseDoc(DOC_TEXT);
  assert.deepEqual(doc.subs.map((r) => r[0]), Object.keys(MU_CHART));
  assert.ok(doc.paths.length >= 10);
  for (const needle of PATH_NEEDLES) assert.ok(doc.paths.some((r) => r[0].includes(needle)), needle);
});

test("the checker fails a missing row, a duplicate row, a merged row, an empty cell and an unknown verdict", () => {
  const i = (lines) => lines.findIndex((l) => l.startsWith("| Heal |"));
  // missing
  assert.ok(checkDoc(doctor((c) => c.splice(i(c), 1))).some((p) => /missing a row for the spell "Heal"/.test(p)));
  // duplicate
  assert.ok(checkDoc(doctor((c) => c.splice(i(c), 0, c[i(c)]))).some((p) => /duplicate row "Heal"/.test(p)));
  // merged: Fireballs folded into Fireball
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Fireballs"), 1))).some((p) => /Fireballs/.test(p)));
  // merged: a slate spell folded away
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Open/Lock"), 1))).some((p) => /slate spell "Open\/Lock"/.test(p)));
  // empty cell
  const empty = doctor((c) => {
    const cells = splitCells(c[i(c)]);
    cells[3] = "";
    c[i(c)] = `| ${cells.join(" | ")} |`;
  });
  assert.ok(checkDoc(empty).some((p) => /empty Engine cell/.test(p)));
  // unknown verdict and a non-Phase-90 owner
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| sort of |")))).some((p) => /unknown verdict "sort of"/.test(p)));
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| fix text (90-13) |")))).some((p) => /90-13/.test(p)));
  // a slate row that does not read its own plan
  assert.ok(checkDoc(doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace("| new (90-07) |", "| new (90-08) |")))).some((p) => /slate row "Fly"/.test(p)));
});

test("the checker fails a doctored swap of two rows and of two slate rows", () => {
  const swapped = doctor((c, at) => {
    const a = at("Heal");
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(swapped).some((p) => /out of order/.test(p)));
  const slateSwapped = doctor((c, at) => {
    const a = at("Fly");
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(slateSwapped).some((p) => /slate rows out of order/.test(p)));
});

test("the checker fails a balance call whose question already has a ruling, and a ruling with no question", () => {
  // Q8 is answered: turn its Lightning row back into an open call and the checker must object.
  // (Phase 90 plan 03: Strength, Q1's row, now reads fixed engine (90-03), so Lightning is the probe.)
  const reopened = doctor((c, at) => {
    const i = at("Lightning");
    c[i] = c[i].replace("| ruled (Q8, 2026-09-30) -> 90-10 |", "| balance call (Q8) |");
  });
  assert.ok(checkDoc(reopened).some((p) => /still reads balance call \(Q8\) but Q8 has a ruling/.test(p)));
  // And a doc where a question has no open row and no ruling fails too.
  const unasked = DOC_TEXT.replace(/^- Q6 \(2026-09-30\):/m, "- Q60 (2026-09-30):");
  assert.ok(checkDoc(unasked).some((p) => /Q60, which is not in Balance calls/.test(p) || /Q6 is asked but no row/.test(p)));
  const orphan = DOC_TEXT.replace("## Rulings\n", "## Rulings\n\n- Q99 (2026-09-30): doctored.\n");
  assert.ok(checkDoc(orphan).some((p) => /Q99, which is not in Balance calls/.test(p)));
});

test("the checker fails a match row that admits a gap and a Rolls cell with an ASCII-hyphen range", () => {
  const gap = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Heal |"));
    c[i] = c[i].replace("the single-hero reading the whole game uses", "the single-hero reading (the target count is not stated)");
  });
  assert.ok(checkDoc(gap).some((p) => /admits a gap/.test(p)));
  const hyphen = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Freeze |"));
    c[i] = c[i].replace("hits on 5–10 (60%)", "hits on 5-10 (60%)");
  });
  assert.ok(checkDoc(hyphen).some((p) => /ASCII hyphen/.test(p)));
});

test("the checker fails a missing sub-class row and a hand-out path with no verdict", () => {
  const noWizard = doctor((c) => c.splice(c.findIndex((l) => l.startsWith("| Wizard |")), 1));
  assert.ok(checkDoc(noWizard).some((p) => /missing the sub-class "Wizard"/.test(p)));
  const noPath = doctor((c) => c.splice(c.findIndex((l) => l.includes("`encounters.js#findGrimoire`")), 1));
  assert.ok(checkDoc(noPath).some((p) => /findGrimoire/.test(p)));
});
