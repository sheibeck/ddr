// test/unit/skill-audit.test.js
//
// Phase 90 (ABIL-06; plans 90-01 and 90-12) — the coverage, consistency and CLOSE
// test for docs/SKILL-AUDIT.md, the skill and ability audit table. It parses the
// `### Skills` table under `## Skills`, the Balance calls and the Rulings, and
// checks them against the live content tables, so the doc can never silently
// lose a skill, double a skill, leave a cell empty, or reopen:
//
//   - every FIGHTER_SKILLS key, every THIEF_SKILLS key, every pool ability in
//     ABILITY_POOL order (Fighter, then Thief) and the Bard's Sing has exactly
//     one row;
//   - the Kind · Class cell agrees with the content (a skill with an `active`
//     marker is a "table active", one without is a "passive", a pool entry is a
//     "pool active", and the class is the table's own class);
//   - no cell is empty: the Hero and Joiner cells always say who can use it (an
//     engine site, or "cannot" and why); each Text cell holds the live `txt` (and a
//     skill's `txt2`), the final text after TEXT-01;
//   - every Verdict is one of the closed vocabulary (match, fixed engine, fixed text,
//     ruled, Phase 91, Phase 92) and every owner `90-NN` names a Phase 90 plan (01 to
//     12); Pommel Strike is owned by 90-02 and Sing is handed to Phase 91 (IDENT-17);
//   - THE CLOSE (plan 90-12): no Verdict reads `fix engine`, `fix text` or
//     `balance call`; every Pinned by is a list of `test/unit/<file>.test.js: <title>`
//     whose file exists and whose source contains the title (only a `match` row or the
//     row handed to Phase 91 or 92 may read `—`, and every fixed or ruled row names at
//     least one title); the header's "Closed" line states the true number of distinct
//     pins; Findings for other phases names Phases 91, 91.1 and 92;
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
// The doc is text and the test only reads it (plus content and the named test
// files); no engine, rng or shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { FIGHTER_SKILLS, THIEF_SKILLS, ABILITIES, ABILITY_BY_ID, ABILITY_POOL } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SKILL-AUDIT.md");

/** EXPECTED — every row the table must hold, in order, with the Kind · Class cell the content implies and the live text(s) its Text cell must carry. */
const SING_TEXT = "Sings the best song your level knows, then a hundred squares before the next. Pick the moment.";
const EXPECTED = [
  ...Object.entries(FIGHTER_SKILLS).map(([name, s]) => ({ name, kind: `${s.active ? "table active" : "passive"} · Fighter`, texts: [s.txt, ...(s.txt2 ? [s.txt2] : [])] })),
  ...Object.entries(THIEF_SKILLS).map(([name, s]) => ({ name, kind: `${s.active ? "table active" : "passive"} · Thief`, texts: [s.txt, ...(s.txt2 ? [s.txt2] : [])] })),
  ...ABILITY_POOL.Fighter.map((id) => ({ name: ABILITY_BY_ID[id].name, kind: "pool active · Fighter", texts: [ABILITY_BY_ID[id].txt] })),
  ...ABILITY_POOL.Thief.map((id) => ({ name: ABILITY_BY_ID[id].name, kind: "pool active · Thief", texts: [ABILITY_BY_ID[id].txt] })),
  { name: "Sing", kind: "class action · Bard", texts: [SING_TEXT] },
];
const EXPECTED_NAMES = EXPECTED.map((e) => e.name);

/** VERDICT_TOKENS — the accepted verdict cells: the closed vocabulary (no `fix` or `balance call`). */
const VERDICT_TOKENS = [
  /^match$/,
  /^fixed (engine|text) \(90-\d\d\)$/,
  /^ruled \(Q\d+, 2026-09-30\) -> 90-\d\d( .+)?$/,
  /^ruled \(2026-09-30\) -> 90-\d\d( .+)?$/,
  /^Phase 91 \(IDENT-\d\d\)$/,
  /^Phase 92$/,
];

/** VALUE_CHANGE — the optional trailing part Phase 91.1 build plans (91.1-02 to 91.1-05) add to any verdict. */
const VALUE_CHANGE = /; value change \(91\.1-0[2-5]\)$/;

/** OPEN_VERDICT — the open states a closed table may not contain. */
const OPEN_VERDICT = /^(fix engine|fix text|balance call)\b/;

const SECTIONS = ["How to read this table", "Skills", "Findings for other phases", "Balance calls", "Rulings"];
const GAP_WORDS = /not stated|not printed|omits/i;

/** PIN — one pin: a test file, and (required on a fixed or ruled row) the title. */
const PIN = /^(test\/[A-Za-z0-9_\-/.]+\.test\.js)(?:: (.+))?$/;

const sourceCache = new Map();
/** sourceOf(relPath) — a test file's source (LF), or null when it is missing. */
function sourceOf(rel) {
  if (!sourceCache.has(rel)) {
    const abs = path.join(REPO_ROOT, rel);
    sourceCache.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n") : null);
  }
  return sourceCache.get(rel);
}

/**
 * pinProblems(where, pinned, { needTitle, allowDash }) — every problem with a Pinned by
 * cell: malformed pins, a missing file, a title the file does not contain, and (needTitle)
 * no pin that names a title at all.
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
  const out = { rows: [], questions: [], rulings: [], haveSections: {}, findings: "", closedLine: "" };
  let h2 = null;
  let h3 = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^\*\*Closed:\*\*/.test(line)) out.closedLine = line;
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
    if (h2 === "Findings for other phases") out.findings += line + "\n";
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

/** distinctPins(doc) — every distinct titled pin in the rows. */
function distinctPins(doc) {
  const set = new Set();
  for (const cells of doc.rows) {
    if (cells.length !== 10) continue;
    for (const raw of cells[9].split("; ")) if (PIN.exec(raw.trim()) && raw.includes(": ")) set.add(raw.trim());
  }
  return set;
}

/** checkDoc(text) — every problem the coverage and close rules find, as strings. */
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
    // The final Text: the Text cell carries the live txt (and txt2), so a text change re-opens the row.
    if (expected) for (const t of expected.texts) if (!textCell.includes(t)) add(`row "${name}" Text cell is not the live text "${t}"`);
    if (OPEN_VERDICT.test(verdict)) add(`row "${name}" is still open ("${verdict}"): a closed table has no fix engine, fix text or balance call`);
    else if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict.replace(VALUE_CHANGE, "")))) add(`row "${name}" has an unknown verdict "${verdict}"`);
    // Phase 91.1 (plan 91.1-01): the value-review plans 91.1-02 to 91.1-05 may add a trailing "; value change (91.1-0N)"
    for (const m of verdict.matchAll(/\b91\.1-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 2 || n > 5) add(`row "${name}" names owner 91.1-${m[1]}, not a Phase 91.1 build plan (91.1-02 to 91.1-05)`);
    }
    for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 12) add(`row "${name}" names owner 90-${m[1]}, not a Phase 90 plan`);
    }
    if (name === "Pommel Strike" && !verdict.includes("90-02")) add(`Pommel Strike must be owned by 90-02, not "${verdict}"`);
    if (name === "Sing" && verdict !== "Phase 91 (IDENT-17)") add(`Sing must read Phase 91 (IDENT-17), not "${verdict}"`);
    if (verdict === "match" && cells.some((c) => GAP_WORDS.test(c))) add(`row "${name}" reads match but a cell admits a gap`);
    const ruleNoPlans = rule.replace(/\b90-\d\d\b/g, "90");
    if (/\d-\d/.test(ruleNoPlans) || /(^|[\s(])-\d/.test(ruleNoPlans)) add(`row "${name}" writes a range or a negative modifier with an ASCII hyphen in its Rule cell (use – and −)`);
    // The close: no stale draft language, and a real pin on every row but the hand-off.
    if ([textCell, engine, rule].some((cell) => /to be added|\bdraft txt\b/i.test(cell))) add(`row "${name}" still carries draft or to-do language`);
    const dashOk = verdict === "match" || /^Phase 9[12]/.test(verdict);
    for (const p of pinProblems(`row "${name}"`, pinned, { needTitle: !dashOk, allowDash: dashOk })) add(p);
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
      // A ruled question is carried by a `ruled (Qn, 2026-09-30)` verdict, or (Q10, a rule that spans rows, built and read `fixed engine (90-10)`)
      // named in a row's Joiner cell, the spell audit's allowance for a rule that spans rows.
      const named = doc.rows.some((r) => r.length === 10 && new RegExp(`\\bQ${q}\\b`).test(r[6]));
      if (!ruledQ.has(q) && !named) add(`Q${q} is ruled but no row reads ruled (Q${q}, 2026-09-30) or names Q${q} in its Joiner cell`);
    } else if (!openQ.has(q)) {
      add(`Q${q} is asked but no row reads balance call (Q${q})`);
    }
  }
  for (const q of doc.rulings) {
    if (!doc.questions.includes(q)) add(`Rulings records Q${q}, which is not in Balance calls`);
  }

  // The close: the header states the true number of pins, and the hand-offs are named.
  const stated = /\((\d+) distinct pins\)/.exec(doc.closedLine);
  if (!stated) add('the header has no "Closed:" line stating "(N distinct pins)"');
  else if (Number(stated[1]) !== distinctPins(doc).size) add(`the header's Closed line says ${stated[1]} distinct pins, the table holds ${distinctPins(doc).size}`);
  for (const phase of ["Phase 91", "Phase 91.1", "Phase 92"]) if (!doc.findings.includes(phase)) add(`Findings for other phases does not name ${phase}`);
  return problems;
}

const DOC_TEXT = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // a CRLF checkout reads like the LF one

// ---------------------------------------------------------------------------
// docs/ABILITIES.md "Phase 90 close": the table there is GENERATED from this audit, so it cannot be re-derived by hand and drift.
// The generator is exported so the one-off that wrote the section and the test that guards it are the same code.
// ---------------------------------------------------------------------------

/** skillCloseTable(auditText) — one row per skill and ability: its kind, rule, who can use it (the Joiner cell) and its verdict, from the audit. */
export function skillCloseTable(auditText) {
  const doc = parseDoc(auditText);
  const lines = ["| Skill | Kind · Class | Rule | Joiner use | Verdict |", "|---|---|---|---|---|"];
  for (const r of doc.rows) lines.push(`| ${r[0]} | ${r[1]} | ${r[4]} | ${r[6]} | ${r[8]} |`);
  return lines.join("\n");
}

/** closeBlock(text, name) — the text between `<!-- phase90-close:NAME:start -->` and `<!-- phase90-close:NAME:end -->`, or null. */
export function closeBlock(text, name) {
  const a = text.indexOf(`<!-- phase90-close:${name}:start -->\n`);
  const b = text.indexOf(`\n<!-- phase90-close:${name}:end -->`);
  if (a < 0 || b < 0) return null;
  return text.slice(a + `<!-- phase90-close:${name}:start -->\n`.length, b);
}

/** doctor(fn) — the real doc, with `fn` applied to its lines (and a finder for a skill's row). */
function doctor(fn) {
  const lines = DOC_TEXT.split(/\r?\n/);
  fn(lines, (name) => lines.findIndex((l) => l.startsWith(`| ${name} |`)));
  return lines.join("\n");
}

test("docs/SKILL-AUDIT.md passes every coverage, consistency and close rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("the doc has its required sections and a row for every skill, pool ability and Sing", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const s of SECTIONS) assert.ok(doc.haveSections[s], s);
  assert.deepEqual(doc.rows.map((r) => r[0]), EXPECTED_NAMES);
  assert.equal(EXPECTED_NAMES.length, 12 + 9 + 5 + 4 + 1);
});

test("the close: no row reads fix engine, fix text or balance call, and the table holds at least 25 titled pins", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const cells of doc.rows) assert.doesNotMatch(cells[8], OPEN_VERDICT, `${cells[0]}: ${cells[8]}`);
  assert.ok(distinctPins(doc).size >= 25, `distinct pins: ${distinctPins(doc).size}`);
  // every row but the Phase 91 hand-off is pinned by the text-vs-engine guard; a fixed or ruled row names its fix's test as well
  for (const cells of doc.rows) {
    if (cells[0] === "Sing") {
      assert.equal(cells[9], "—", "the hand-off has no pin");
      continue;
    }
    assert.ok(cells[9].includes("test/unit/spell-skill-text-engine.test.js: every number the text states"), `${cells[0]}: pinned by the text-vs-engine guard`);
    if (/^(fixed|ruled)/.test(cells[8])) assert.ok(cells[9].split("; ").filter((p) => p.includes(": ")).length >= 2, `${cells[0]}: a fixed row names its fix's test as well as the guard`);
  }
});

test("the close: a row turned back into fix engine, fix text or balance call fails", () => {
  for (const [name, from, to] of [["Stealth", "| fixed engine (90-10) |", "| fix engine (90-10) |"], ["Kata", "| fixed text (90-11) |", "| fix text (90-11) |"], ["Brace", "| match |", "| balance call (Q10) |"]]) {
    const reopened = doctor((c, at) => (c[at(name)] = c[at(name)].replace(from, to)));
    assert.ok(checkDoc(reopened).some((p) => new RegExp(`row "${name}" is still open`).test(p)), name);
  }
});

test("the close: a pin naming a missing file or a title the file does not hold fails", () => {
  const noFile = doctor((c, at) => (c[at("Pommel Strike")] = c[at("Pommel Strike")].replace("test/unit/pommel-strike.test.js:", "test/unit/pommel-strikes.test.js:")));
  assert.ok(checkDoc(noFile).some((p) => /pommel-strikes\.test\.js", which does not exist/.test(p)));
  const noTitle = doctor((c, at) => (c[at("Pommel Strike")] = c[at("Pommel Strike")].replace("hero, hit: damage equals the same roll of a plain strike", "hero, hit: damage equals double a plain strike")));
  assert.ok(checkDoc(noTitle).some((p) => /names a test title that is not in the file/.test(p)));
  const fileOnly = doctor((c, at) => (c[at("Pommel Strike")] = c[at("Pommel Strike")].split(" | ").map((cell, i, all) => (i === all.length - 1 ? "test/unit/pommel-strike.test.js" : cell)).join(" | ")));
  assert.ok(checkDoc(fileOnly).some((p) => /pinned by file only/.test(p)));
  const dash = doctor((c, at) => (c[at("Stealth")] = c[at("Stealth")].replace(/\|[^|]*\|$/, "| — |")));
  assert.ok(checkDoc(dash).some((p) => /row "Stealth": is not pinned/.test(p)));
  const malformed = doctor((c, at) => (c[at("Stealth")] = c[at("Stealth")].replace("test/unit/spell-skill-audit-fixes.test.js: Stealth: never", "spell-skill-audit-fixes: Stealth: never")));
  assert.ok(checkDoc(malformed).some((p) => /malformed pin/.test(p)));
});

test("the close: a Text cell that is not the live text, a stale second text, or draft language fails", () => {
  const stale = doctor((c, at) => (c[at("Kata")] = c[at("Kata")].replace('one perfect form: +3 to hit on this strike, and it adds your level in damage; once per fight', "one perfect form: it never misses")));
  assert.ok(checkDoc(stale).some((p) => /row "Kata" Text cell is not the live text/.test(p)));
  const stale2 = doctor((c, at) => (c[at("Locks")] = c[at("Locks")].replace("3–10 with lockpicks", "2–10 with lockpicks")));
  assert.ok(checkDoc(stale2).some((p) => /row "Locks" Text cell is not the live text/.test(p)));
  const draft = doctor((c, at) => (c[at("Kata")] = c[at("Kata")].replace("| once per fight;", "| to be added; once per fight;")));
  assert.ok(checkDoc(draft).some((p) => /still carries draft or to-do language/.test(p) || /Rule/.test(p)) || checkDoc(draft).length > 0);
});

test("the close: the header's Closed line states the true pin count, and Findings names Phases 91, 91.1 and 92", () => {
  const m = /\((\d+) distinct pins\)/.exec(DOC_TEXT);
  assert.ok(m, "the Closed line states its pin count");
  assert.equal(Number(m[1]), distinctPins(parseDoc(DOC_TEXT)).size);
  assert.ok(checkDoc(DOC_TEXT.replace(/\(\d+ distinct pins\)/, "(7 distinct pins)")).some((p) => /Closed line says 7 distinct pins/.test(p)));
  assert.ok(checkDoc(DOC_TEXT.replace("**Closed:**", "**Shut:**")).some((p) => /no "Closed:" line/.test(p)));
  assert.ok(checkDoc(DOC_TEXT.replace("- **Phase 91.1 (value review):**", "- **Phase 99 (value review):**")).some((p) => /does not name Phase 91\.1/.test(p)));
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
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| fixed text (90-13) |")))).some((p) => /90-13/.test(p)));
  // a wrong Kind · Class
  assert.ok(checkDoc(doctor((c, at) => (c[at("Brace")] = c[at("Brace")].replace("| pool active · Fighter |", "| passive · Fighter |")))).some((p) => /Kind · Class/.test(p)));
});

test("Phase 91.1: a verdict may end with value change (91.1-0N), and an owner outside 91.1-02 to 91.1-05 fails", () => {
  const ok = doctor((c, at) => (c[at("Kata")] = c[at("Kata")].replace("| fixed text (90-11) |", "| fixed text (90-11); value change (91.1-02) |")));
  assert.deepEqual(checkDoc(ok), []);
  for (const bad of ["91.1-06", "91.1-01"]) {
    const doc = doctor((c, at) => (c[at("Kata")] = c[at("Kata")].replace("| fixed text (90-11) |", `| fixed text (90-11); value change (${bad}) |`)));
    assert.ok(checkDoc(doc).some((p) => /not a Phase 91\.1 build plan/.test(p)), bad);
  }
});

test("the checker fails a doctored swap of two rows", () => {
  const swapped = doctor((c, at) => {
    const a = at("Brace");
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(swapped).some((p) => /out of order/.test(p)));
});

test("the checker fails a balance call whose question already has a ruling, and a ruling with no question", () => {
  const done = DOC_TEXT.match(/\| ruled \(Q(\d+), 2026-09-30\) -> 90-\d\d[^|]*\|/);
  assert.ok(done, "the doc carries a ruled row (Death Touch)");
  const reopened = DOC_TEXT.replace(done[0], `| balance call (Q${done[1]}) |`);
  assert.ok(checkDoc(reopened).some((p) => /still reads balance call/.test(p)));
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

// ---------------------------------------------------------------------------
// docs/ABILITIES.md "Phase 90 close" (plan 90-12): the generated table matches the audit
// ---------------------------------------------------------------------------

const ABILITIES_DOC = fs.readFileSync(path.join(REPO_ROOT, "docs", "ABILITIES.md"), "utf8").replace(/\r\n/g, "\n");

test("docs/ABILITIES.md has one Phase 90 close section, naming Pommel Strike, the Joiner passives and the guard", () => {
  assert.equal((ABILITIES_DOC.match(/^## Phase 90 close/gm) || []).length, 1);
  const section = ABILITIES_DOC.slice(ABILITIES_DOC.indexOf("## Phase 90 close"));
  for (const needle of ["Pommel Strike", "Dirty Trick", "Stealth", "Hardiness", "Ambidextrous", "Death Touch", "TEXT-01", "Joiner", "once per fight"]) {
    assert.ok(section.includes(needle), `the close section names ${needle}`);
  }
});

test("docs/ABILITIES.md Phase 90 close: the skills table is generated from the audit, one row per skill and ability, Joiner use included", () => {
  assert.equal(closeBlock(ABILITIES_DOC, "skills"), skillCloseTable(DOC_TEXT));
  const rows = closeBlock(ABILITIES_DOC, "skills").split("\n").slice(2);
  assert.deepEqual(rows.map((r) => r.split(" | ")[0].replace(/^\| /, "")), EXPECTED_NAMES);
  for (const r of rows) assert.equal(r.split(" | ").length, 5, `${r.slice(0, 30)}: five cells`);
  assert.ok(rows.some((r) => /\| cannot/.test(r)), "a skill no Joiner can use says cannot");
});

test("docs/ABILITIES.md Phase 90 close: a doctored generated table fails", () => {
  assert.ok(ABILITIES_DOC.includes("| Brace | pool active · Fighter |"), "the generated table carries the Brace row");
  assert.notEqual(closeBlock(ABILITIES_DOC.replace("| Brace | pool active · Fighter |", "| Brace | pool active · Thief |"), "skills"), skillCloseTable(DOC_TEXT));
  assert.equal(closeBlock(ABILITIES_DOC, "no-such-block"), null);
});
