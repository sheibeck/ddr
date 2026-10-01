// test/unit/skill-audit.test.js
//
// Phase 90 (ABIL-06; plan 90-01) — the coverage and consistency test for
// docs/SKILL-AUDIT.md, the skill and ability audit table. It parses the
// `### Skills` table under `## Skills`, the Balance calls and the Rulings, and
// checks them against the live content tables, so the doc can never silently
// lose a skill, double a skill, or leave a cell empty:
//
//   - every FIGHTER_SKILLS key, every THIEF_SKILLS key, every pool ability in
//     ABILITY_POOL order (Fighter, then Thief) and the Bard's Sing has exactly
//     one row;
//   - the Kind · Class cell agrees with the content (a skill with an `active`
//     marker is a "table active", one without is a "passive", a pool entry is a
//     "pool active", and the class is the table's own class);
//   - no cell is empty: the Hero and Joiner cells always say who can use it (an
//     engine site, or "cannot" and why);
//   - every Verdict starts with one accepted token, every owner `90-NN` names a
//     Phase 90 plan (01 to 12), Pommel Strike is owned by 90-02 and Sing is
//     handed to Phase 91 (IDENT-17);
//   - a `balance call (Qn)` row needs a Qn question that has no ruling yet, and
//     a ruled Qn has no `balance call (Qn)` row left;
//   - a `match` row never carries a cell that admits a gap.
//
// Edge coverage (the ABIL-06 fallback probes):
//   - adjacency: a table skill whose `active` marker points at a catalog ability
//     (Pommel Strike, Kata, Feint, Silent Step) is ONE row, never two, and no
//     row is named by a catalog id; Kata (Fighter) and Feint (Thief) each keep
//     their own row; the checker is run on doctored copies of the doc and must
//     fail a merged row and a duplicated row;
//   - empty: a skill no Joiner can use says "cannot" in its Joiner cell (Locks,
//     Sewing), and the checker must fail a doctored empty cell;
//   - encoding: the Skill cell equals the content name code unit for code unit
//     (Runes/Signs with its slash, Death Touch, Silent Step), compared WITHOUT
//     normalising, and a Rule cell writes a negative modifier with the minus
//     sign and a range with the en dash the rollRange.js formatter uses;
//   - ordering: rows follow FIGHTER_SKILLS key order, THIEF_SKILLS key order,
//     ABILITY_POOL (Fighter, Thief), then Sing; the checker must fail a
//     doctored swap of two rows.
//
// The doc is text and the test only reads it (plus content); no engine, rng or
// shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { FIGHTER_SKILLS, THIEF_SKILLS, ABILITIES, ABILITY_BY_ID, ABILITY_POOL } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SKILL-AUDIT.md");

/** EXPECTED — every row the table must hold, in order, with the Kind · Class cell the content implies. */
const EXPECTED = [
  ...Object.entries(FIGHTER_SKILLS).map(([name, s]) => ({ name, kind: `${s.active ? "table active" : "passive"} · Fighter` })),
  ...Object.entries(THIEF_SKILLS).map(([name, s]) => ({ name, kind: `${s.active ? "table active" : "passive"} · Thief` })),
  ...ABILITY_POOL.Fighter.map((id) => ({ name: ABILITY_BY_ID[id].name, kind: "pool active · Fighter" })),
  ...ABILITY_POOL.Thief.map((id) => ({ name: ABILITY_BY_ID[id].name, kind: "pool active · Thief" })),
  { name: "Sing", kind: "class action · Bard" },
];
const EXPECTED_NAMES = EXPECTED.map((e) => e.name);

/** VERDICT_TOKENS — the accepted verdict cells. */
const VERDICT_TOKENS = [
  /^match$/,
  /^(fix|fixed) (engine|text) \(90-\d\d\)$/,
  /^balance call \(Q\d+\)$/,
  /^ruled \(Q\d+, 2026-09-30\) -> 90-\d\d( .+)?$/,
  /^ruled \(2026-09-30\) -> 90-\d\d( .+)?$/,
  /^Phase 91 \(IDENT-\d\d\)$/,
  /^Phase 92$/,
];

const SECTIONS = ["How to read this table", "Skills", "Findings for other phases", "Balance calls", "Rulings"];
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
  const out = { rows: [], questions: [], rulings: [], haveSections: {} };
  let h2 = null;
  let h3 = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^## /.test(line)) {
      h2 = line.slice(3).trim();
      out.haveSections[h2] = true;
      h3 = null;
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
    if (h2 === "Skills" && h3 === "Skills" && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "Skill" || isSeparator(cells)) continue;
      out.rows.push(cells);
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
  for (const n of EXPECTED_NAMES) if (!names.includes(n)) add(`missing a row for "${n}"`);
  for (const n of names) if (!EXPECTED_NAMES.includes(n)) add(`row "${n}" is not a FIGHTER_SKILLS key, a THIEF_SKILLS key, a pool ability or Sing`);
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_NAMES) && !problems.length) add("rows are out of order (FIGHTER_SKILLS, THIEF_SKILLS, ABILITY_POOL Fighter then Thief, Sing)");

  const allVerdicts = [];
  for (const cells of doc.rows) {
    if (cells.length !== 10) {
      add(`row "${cells[0]}" has ${cells.length} cells, not 10`);
      continue;
    }
    const [name, kind, textCell, engine, rule, hero, joiner, canon, verdict, pinned] = cells;
    for (const [label, v] of [["Skill", name], ["Kind · Class", kind], ["Text", textCell], ["Engine", engine], ["Rule", rule], ["Hero", hero], ["Joiner", joiner], ["Canon", canon], ["Verdict", verdict], ["Pinned by", pinned]]) {
      if (!v) add(`row "${name}" has an empty ${label} cell`);
    }
    const expected = EXPECTED.find((e) => e.name === name);
    if (expected && kind !== expected.kind) add(`row "${name}" Kind · Class reads "${kind}", the content says "${expected.kind}"`);
    if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`row "${name}" has an unknown verdict "${verdict}"`);
    for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 12) add(`row "${name}" names owner 90-${m[1]}, not a Phase 90 plan`);
    }
    if (name === "Pommel Strike" && !verdict.includes("90-02")) add(`Pommel Strike must be owned by 90-02, not "${verdict}"`);
    if (name === "Sing" && verdict !== "Phase 91 (IDENT-17)") add(`Sing must read Phase 91 (IDENT-17), not "${verdict}"`);
    if (verdict === "match" && cells.some((c) => GAP_WORDS.test(c))) add(`row "${name}" reads match but a cell admits a gap`);
    const ruleNoPlans = rule.replace(/\b90-\d\d\b/g, "90");
    if (/\d-\d/.test(ruleNoPlans) || /(^|[\s(])-\d/.test(ruleNoPlans)) add(`row "${name}" writes a range or a negative modifier with an ASCII hyphen in its Rule cell (use – and −)`);
    allVerdicts.push([name, verdict]);
  }

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
      if (!ruledQ.has(q)) add(`Q${q} is ruled but no row reads ruled (Q${q}, 2026-09-30)`);
    } else if (!openQ.has(q)) {
      add(`Q${q} is asked but no row reads balance call (Q${q})`);
    }
  }
  for (const q of doc.rulings) {
    if (!doc.questions.includes(q)) add(`Rulings records Q${q}, which is not in Balance calls`);
  }
  return problems;
}

const DOC_TEXT = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // a CRLF checkout reads like the LF one

/** doctor(fn) — the real doc, with `fn` applied to its lines (and a finder for a skill's row). */
function doctor(fn) {
  const lines = DOC_TEXT.split(/\r?\n/);
  fn(lines, (name) => lines.findIndex((l) => l.startsWith(`| ${name} |`)));
  return lines.join("\n");
}

test("docs/SKILL-AUDIT.md passes every coverage and consistency rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("the doc has its required sections and a row for every skill, pool ability and Sing", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const s of SECTIONS) assert.ok(doc.haveSections[s], s);
  assert.deepEqual(doc.rows.map((r) => r[0]), EXPECTED_NAMES);
  assert.equal(EXPECTED_NAMES.length, 12 + 9 + 5 + 4 + 1);
});

test("adjacency: a table skill whose active marker names a catalog ability is one row, never two", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  for (const a of ABILITIES.filter((x) => x.source === "table")) {
    assert.equal(a.name, a.skillKey, `${a.id}: the catalog name is the skill key`);
    assert.equal(names.filter((n) => n === a.name).length, 1, `${a.name}: exactly one row`);
    assert.ok(!names.includes(a.id), `no row is named by the catalog id ${a.id}`);
  }
  for (const key of ["Pommel Strike", "Kata", "Feint", "Silent Step"]) assert.equal(names.filter((n) => n === key).length, 1, key);
  // Kata (Fighter) and Feint (Thief) are two skills with their own rows.
  assert.match(doc.rows.find((r) => r[0] === "Kata")[1], /Fighter$/);
  assert.match(doc.rows.find((r) => r[0] === "Feint")[1], /Thief$/);
});

test("empty: a skill no Joiner can use says cannot, and no cell is ever blank", () => {
  const doc = parseDoc(DOC_TEXT);
  const joiner = (n) => doc.rows.find((r) => r[0] === n)[6];
  for (const n of ["Locks", "Sewing", "Night Vision", "Acute Hearing", "Cooking", "Runes/Signs"]) assert.match(joiner(n), /^cannot/, n);
  assert.match(joiner("Kata"), /resolveMemberAbility/);
  for (const r of doc.rows) for (const c of r) assert.ok(c.length > 0, `${r[0]}: no blank cell`);
});

test("encoding: the Skill cell equals the content name code unit for code unit, and ranges use the en dash and the minus sign", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  for (const n of EXPECTED_NAMES) {
    const hit = names.find((x) => x === n);
    assert.equal(hit, n);
    assert.equal(hit.length, n.length);
  }
  assert.ok(names.includes("Runes/Signs"), "the slash in Runes/Signs survives");
  assert.ok(doc.rows.some((r) => r[4].includes("−2")), "a negative modifier uses the minus sign");
  for (const r of doc.rows) assert.ok(!/\d-\d/.test(r[4].replace(/\b90-\d\d\b/g, "90")), `${r[0]}: no ASCII-hyphen range in Rule`);
  assert.ok(doc.rows.some((r) => /\d–\d/.test(r[4] + r[3])), "an authored range uses the en dash");
});

test("ordering: rows follow FIGHTER_SKILLS, THIEF_SKILLS, ABILITY_POOL (Fighter, Thief), then Sing", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  assert.deepEqual(names.slice(0, 12), Object.keys(FIGHTER_SKILLS));
  assert.deepEqual(names.slice(12, 21), Object.keys(THIEF_SKILLS));
  assert.deepEqual(names.slice(21, 26), ABILITY_POOL.Fighter.map((id) => ABILITY_BY_ID[id].name));
  assert.deepEqual(names.slice(26, 30), ABILITY_POOL.Thief.map((id) => ABILITY_BY_ID[id].name));
  assert.equal(names[30], "Sing");
});

test("pre-owned rows name the plan that builds them, and Kind · Class agrees with the content", () => {
  const doc = parseDoc(DOC_TEXT);
  assert.match(doc.rows.find((r) => r[0] === "Pommel Strike")[8], /90-02/);
  assert.equal(doc.rows.find((r) => r[0] === "Sing")[8], "Phase 91 (IDENT-17)");
  for (const e of EXPECTED) assert.equal(doc.rows.find((r) => r[0] === e.name)[1], e.kind, e.name);
});

test("the checker fails a missing row, a duplicate row, a merged row, an empty cell and an unknown verdict", () => {
  const i = (lines) => lines.findIndex((l) => l.startsWith("| Brace |"));
  assert.ok(checkDoc(doctor((c) => c.splice(i(c), 1))).some((p) => /missing a row for "Brace"/.test(p)));
  assert.ok(checkDoc(doctor((c) => c.splice(i(c), 0, c[i(c)]))).some((p) => /duplicate row "Brace"/.test(p)));
  // merged: Feint folded into Kata
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Feint"), 1))).some((p) => /missing a row for "Feint"/.test(p)));
  const empty = doctor((c) => {
    const cells = splitCells(c[i(c)]);
    cells[5] = "";
    c[i(c)] = `| ${cells.join(" | ")} |`;
  });
  assert.ok(checkDoc(empty).some((p) => /empty Hero cell/.test(p)));
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| sort of |")))).some((p) => /unknown verdict "sort of"/.test(p)));
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| fix text (90-13) |")))).some((p) => /90-13/.test(p)));
  // a wrong Kind · Class
  assert.ok(checkDoc(doctor((c, at) => (c[at("Brace")] = c[at("Brace")].replace("| pool active · Fighter |", "| passive · Fighter |")))).some((p) => /Kind · Class/.test(p)));
});

test("the checker fails a doctored swap of two rows", () => {
  const swapped = doctor((c, at) => {
    const a = at("Brace");
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(swapped).some((p) => /out of order/.test(p)));
});

test("the checker fails a balance call whose question already has a ruling, and a ruling with no question", () => {
  const open = DOC_TEXT.match(/\| balance call \(Q(\d+)\) \|/);
  const done = DOC_TEXT.match(/\| ruled \(Q(\d+), 2026-09-30\) -> 90-\d\d[^|]*\|/);
  assert.ok(open || done, "the doc carries a balance call or a ruled one");
  if (open) {
    const doctored = DOC_TEXT.replace("## Rulings\n", `## Rulings\n\n- Q${open[1]} (2026-09-30): doctored.\n`);
    assert.ok(checkDoc(doctored).some((p) => /still reads balance call/.test(p)));
  }
  if (done) {
    const reopened = DOC_TEXT.replace(done[0], `| balance call (Q${done[1]}) |`);
    assert.ok(checkDoc(reopened).some((p) => /still reads balance call/.test(p)));
  }
  const orphan = DOC_TEXT.replace("## Rulings\n", "## Rulings\n\n- Q99 (2026-09-30): doctored.\n");
  assert.ok(checkDoc(orphan).some((p) => /Q99, which is not in Balance calls/.test(p)));
});

test("the checker fails a match row that admits a gap and a Rule cell with an ASCII-hyphen range", () => {
  const gap = doctor((c, at) => {
    const i = at("Brace");
    c[i] = c[i].replace("the next landed blow halved; no roll", "the next landed blow halved (the duration is not stated); no roll");
  });
  assert.ok(checkDoc(gap).some((p) => /admits a gap/.test(p)));
  const hyphen = doctor((c, at) => {
    const i = at("Second Wind");
    c[i] = c[i].replace("(level 3: 4–11)", "(level 3: 4-11)");
  });
  assert.ok(checkDoc(hyphen).some((p) => /ASCII hyphen/.test(p)));
});
