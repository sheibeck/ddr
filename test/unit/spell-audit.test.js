// test/unit/spell-audit.test.js
//
// Phase 90 (SPELL-08; plans 90-01 and 90-12) — the coverage, consistency and CLOSE
// test for docs/SPELL-AUDIT.md, the spell audit table. It parses the `### Spells`
// and `### Removed` tables under `## Spells`, the two `## School gates` tables, the
// Balance calls and the Rulings, and checks them against the live content tables,
// so the doc can never silently lose a spell, double a spell, leave a cell empty,
// or reopen:
//
//   - every spell in SPELLS (content/spells.js) has exactly one row, in SPELLS order
//     (the ten slate spells last), and the `### Removed` table holds exactly the two
//     spells the user ruled out (REMOVED), neither of which is in SPELLS;
//   - no Spell, Lvl · School, Text, Engine, Rolls, Canon, Verdict or Pinned by cell
//     is empty, every row has all eight cells, and each row's Text cell is the live
//     `txt` (the final text, after TEXT-01);
//   - every Verdict is one of the closed vocabulary (match, fixed engine, fixed text,
//     ruled, removed, Phase 91, Phase 92) and every owner `90-NN` names a Phase 90
//     plan (01 to 12); slate rows read `fixed engine (90-NN)` with the plan that
//     built them, removed rows `removed (90-06)`;
//   - THE CLOSE (plan 90-12): no Verdict reads `fix engine`, `fix text`, `new (` or
//     `balance call`; every Pinned by is a list of `test/unit/<file>.test.js: <title>`
//     whose file exists and whose source contains the title (only a `match` row or a
//     row handed to Phase 91 or 92 may read `—`, and every fixed, ruled or removed
//     row names at least one title); the header's "Closed" line states the true
//     number of distinct pins; Findings for other phases names Phases 91, 91.1 and 92;
//   - the `## School gates` section has one row per Magic User sub-class (every
//     MU_CHART key), each cell equal to the live chart (the bonus, "never" for a
//     null, the gate when one is set), a hand-out paths table naming every path that
//     gives out a spell, and a "pinned by" line whose pins exist;
//   - a `balance call (Qn)` row needs a Qn question in `## Balance calls` that
//     has no ruling yet, and a ruled Qn has no `balance call (Qn)` row left;
//   - a `match` row never carries a cell that admits a gap.
//
// Edge coverage (the SPELL-08 fallback probes):
//   - adjacency: spells that share a kind or a name stem each keep their own
//     row (Fireball and Fireballs; Summon next to the removed Lesser Summon and
//     Phantom Host; Heal and Major Heal; Doze and Stun; the offensive Death, which is
//     level 5 offense, never the potion Death); the checker is run on doctored copies
//     of the doc and must fail a merged row and a duplicated row;
//   - empty: a spell with no to-hit roll, no damage or no resist says so in its
//     Rolls cell ("no to-hit roll", "no damage", "never resisted"), and the
//     checker must fail a doctored empty cell;
//   - encoding: the Spell cell equals the content name code unit for code unit
//     (Open/Lock with its slash, Size of the Behemoth), compared WITHOUT
//     normalising, and a Rolls cell writes ranges with the en dash and
//     negative modifiers with the minus sign the rollRange.js formatter uses;
//   - ordering: rows follow SPELLS array order exactly; the checker must fail a
//     doctored swap of two rows.
//
// The doc is text and the test only reads it (plus content and the named test
// files); no engine, rng or shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { SPELLS, MU_CHART, SPELL_LEVEL_OVERRIDES } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "SPELL-AUDIT.md");

/** SLATE — the ten spells the user ruled in (90-CONTEXT), in their append order, with the plan that built each. */
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

/** REMOVED — the spells the user ruled out; plan 90-06 deleted them and the doc keeps their row in `### Removed`. */
const REMOVED = ["Lesser Summon", "Phantom Host"];

/** VERDICT_TOKENS — the accepted verdict cells: the closed vocabulary (no `fix`, `new` or `balance call`). */
const VERDICT_TOKENS = [
  /^match$/,
  /^fixed (engine|text) \(90-\d\d\)$/,
  /^ruled \(Q\d+, 2026-09-30\) -> 90-\d\d( .+)?$/,
  /^ruled \(2026-09-30\) -> 90-\d\d( .+)?$/,
  /^removed \(90-06\)$/,
  /^Phase 91 \(IDENT-\d\d\)$/,
  /^Phase 92$/,
];

/** OPEN_VERDICT — the open states a closed table may not contain. */
const OPEN_VERDICT = /^(fix engine|fix text|balance call|new \()/;

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
const SCHOOLS = ["offense", "protection", "healing", "divination", "special", "illusion"];

/** PIN — one pin: a test file, and (required on a fixed, ruled or removed row) the title. */
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
  if (pinned === "—") return allowDash ? [] : [`${where}: is not pinned (—), but it is fixed, ruled or removed`];
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
  if (needTitle && titled === 0) out.push(`${where}: pinned by file only, but a fixed, ruled or removed row must name a test title`);
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
  const out = { rows: [], removed: [], subs: [], paths: [], questions: [], rulings: [], haveSections: {}, schoolPins: null, findings: "", closedLine: "" };
  let h2 = null;
  let h3 = null;
  let mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^\*\*Closed:\*\*/.test(line)) out.closedLine = line;
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
    if (h2 === "Findings for other phases") out.findings += line + "\n";
    if (h2 === "Spells" && (h3 === "Spells" || h3 === "Removed") && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === "Spell" || isSeparator(cells)) continue;
      (h3 === "Spells" ? out.rows : out.removed).push(cells);
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
    } else if (h2 === "School gates" && /^\*\*School gates pinned by:\*\*/.test(line)) {
      out.schoolPins = line.replace(/^\*\*School gates pinned by:\*\*\s*/, "");
    } else if (h2 === "Rulings") {
      const m = line.match(/^- Q(\d+) \(/);
      if (m) out.rulings.push(Number(m[1]));
    }
  }
  return out;
}

/** chartCell(sub, school) — the School gates cell the live MU_CHART implies: "never", "+N" or "+N (gate G)". */
function chartCell(sub, school) {
  const row = MU_CHART[sub];
  const bonus = row[school];
  if (bonus === null || bonus === undefined) return "never";
  const gate = row.gate && row.gate[school];
  return `${bonus >= 0 ? "+" : "−"}${Math.abs(bonus)}${gate ? ` (gate ${gate})` : ""}`;
}

/** distinctPins(doc) — every distinct titled pin in the rows, the removed rows and the School gates line. */
function distinctPins(doc) {
  const set = new Set();
  const add = (cell) => {
    for (const raw of cell.split("; ")) if (PIN.exec(raw.trim()) && raw.includes(": ")) set.add(raw.trim());
  };
  for (const cells of [...doc.rows, ...doc.removed]) if (cells.length === 8) add(cells[7]);
  if (doc.schoolPins) add(doc.schoolPins);
  return set;
}

/** rowProblems(cells, where) — the cell-level rules every row (a spell's or a removed spell's) must meet. */
function rowProblems(cells, add, allVerdicts) {
  if (cells.length !== 8) {
    add(`row "${cells[0]}" has ${cells.length} cells, not 8`);
    return;
  }
  const [name, lvl, textCell, engine, rolls, canon, verdict, pinned] = cells;
  for (const [label, v] of [["Spell", name], ["Lvl · School", lvl], ["Text", textCell], ["Engine", engine], ["Rolls", rolls], ["Canon", canon], ["Verdict", verdict], ["Pinned by", pinned]]) {
    if (!v) add(`row "${name}" has an empty ${label} cell`);
  }
  if (OPEN_VERDICT.test(verdict)) add(`row "${name}" is still open ("${verdict}"): a closed table has no fix engine, fix text, new or balance call`);
  else if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`row "${name}" has an unknown verdict "${verdict}"`);
  for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
    const n = Number(m[1]);
    if (n < 1 || n > 12) add(`row "${name}" names owner 90-${m[1]}, not a Phase 90 plan`);
  }
  if (SLATE.includes(name) && verdict !== `fixed engine (${SLATE_OWNER[name]})`) add(`slate row "${name}" must read fixed engine (${SLATE_OWNER[name]}), not "${verdict}"`);
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
  // The close: no stale draft language, and a real pin on every row.
  if ([textCell, engine, rolls].some((cell) => /to be added|\bdraft txt\b|^new:/i.test(cell))) add(`row "${name}" still carries draft or to-do language ("draft txt", "new:" or "to be added")`);
  const dashOk = verdict === "match" || /^Phase 9[12]/.test(verdict);
  for (const p of pinProblems(`row "${name}"`, pinned, { needTitle: !dashOk, allowDash: dashOk })) add(p);
  allVerdicts.push([name, verdict]);
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
  const contentNames = SPELLS.map((s) => s.n);
  for (const n of contentNames) if (!names.includes(n)) add(`missing a row for the spell "${n}"`);
  for (const n of SLATE) if (!names.includes(n)) add(`missing a row for the slate spell "${n}"`);
  for (const n of names) if (!contentNames.includes(n)) add(`row "${n}" is not in SPELLS (a removed spell belongs in the Removed table)`);

  // Ordering: rows follow SPELLS order exactly (the slate rows are the last ten of SPELLS).
  const inSpells = names.filter((n) => contentNames.includes(n));
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
      add("slate rows out of order (append order: " + SLATE.join(", ") + ")");
      break;
    }
  }
  const firstSlate = slatePos.length ? Math.min(...slatePos) : Infinity;
  names.forEach((n, i) => {
    if (!SLATE.includes(n) && i > firstSlate) add(`row "${n}" comes after a slate row (slate rows go last)`);
  });

  // The Removed table: exactly the two removed names, neither of them a SPELLS row.
  const removedNames = doc.removed.map((r) => r[0]);
  if (!doc.haveSections.Spells || !/^### Removed$/m.test(text)) add('missing the "### Removed" table');
  if (JSON.stringify(removedNames) !== JSON.stringify(REMOVED)) add(`the Removed table holds ${JSON.stringify(removedNames)}, expected exactly ${JSON.stringify(REMOVED)}`);
  for (const n of removedNames) if (contentNames.includes(n)) add(`removed spell "${n}" is still in SPELLS`);

  const allVerdicts = []; // [name, verdict]
  for (const cells of doc.rows) {
    rowProblems(cells, add, allVerdicts);
    // The final Text: the Text cell carries the live txt, so a text change re-opens the row.
    const sp = SPELLS.find((s) => s.n === cells[0]);
    if (sp && cells.length === 8 && !cells[2].includes(sp.txt)) add(`row "${sp.n}" Text cell is not the live txt "${sp.txt}"`);
  }
  for (const cells of doc.removed) rowProblems(cells, add, allVerdicts);

  // School gates: one row per MU_CHART sub-class, equal to the live chart, then the hand-out paths table.
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
    if (MU_CHART[cells[0]]) {
      SCHOOLS.forEach((school, i) => {
        const want = chartCell(cells[0], school);
        if (cells[i + 1] !== want) add(`School gates: ${cells[0]} ${school} reads "${cells[i + 1]}", the live MU_CHART says "${want}"`);
      });
    }
  }
  const wizard = doc.subs.find((r) => r[0] === "Wizard");
  if (wizard && wizard.length === 8 && !/Illusion/.test(wizard[7])) add("School gates: the Wizard's After Phase 90 cell must name the lost Illusion school");
  const summoner = doc.subs.find((r) => r[0] === "Summoner");
  if (summoner && summoner.length === 8 && !/Summon/.test(summoner[7])) add("School gates: the Summoner's After Phase 90 cell must name its Summon exception");
  if (JSON.stringify(SPELL_LEVEL_OVERRIDES) !== JSON.stringify({ Summoner: { Summon: 1 } })) add("School gates: the only named exception must be the Summoner's Summon (SPELL_LEVEL_OVERRIDES changed)");
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
    if (OPEN_VERDICT.test(verdict)) add(`School gates: path row "${cells[0]}" is still open ("${verdict}")`);
    else if (verdict && !VERDICT_TOKENS.some((re) => re.test(verdict))) add(`School gates: path row "${cells[0]}" has an unknown verdict "${verdict}"`);
    for (const m of verdict.matchAll(/\b90-(\d\d)\b/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 12) add(`School gates: path row "${cells[0]}" names owner 90-${m[1]}, not a Phase 90 plan`);
    }
    allVerdicts.push([`path: ${cells[0]}`, verdict]);
  }
  if (!doc.schoolPins) add("School gates: no `School gates pinned by:` line (the sweep's and the scroll table's pins)");
  else {
    for (const p of pinProblems("School gates pins", doc.schoolPins, { needTitle: true, allowDash: false })) add(p);
    for (const need of ["test/unit/school-gates.test.js", "test/unit/scroll-pool.test.js"]) if (!doc.schoolPins.includes(need)) add(`School gates: the pinned by line must name ${need}`);
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
      // A ruled question is carried by a `ruled (Qn, 2026-09-30)` verdict, or (a rule that spans rows, built and read `fixed engine`) named in a row's Rolls cell.
      const named = doc.rows.some((r) => r.length === 8 && new RegExp(`\\bQ${q}\\b`).test(r[4]));
      if (!ruledQ.has(q) && !named) add(`Q${q} is ruled but no row reads ruled (Q${q}, 2026-09-30) or names Q${q} in its Rolls cell`);
    } else if (!openQ.has(q)) {
      add(`Q${q} is asked but no row reads balance call (Q${q}) (and it has no ruling)`);
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
// docs/SPELLS.md "Phase 90 close": the tables there are GENERATED from this audit and the live content, so they cannot be re-derived by hand
// and drift. The generators are exported so the one-off that wrote the section and the test that guards it are the same code.
// ---------------------------------------------------------------------------

/** splitClauses(cell) — the "; "-separated clauses of a Rolls cell, never splitting inside parentheses. */
export function splitClauses(cell) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < cell.length; i++) {
    const ch = cell[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0 && cell[i + 1] === " ") {
      out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** rollsBuckets(rolls) — a Rolls cell's clauses sorted into the six columns of the close table, in the cell's own words. */
export function rollsBuckets(rolls) {
  const b = { toHit: [], resist: [], damage: [], duration: [], backfire: [], fumble: [] };
  for (const clause of splitClauses(rolls)) {
    if (/backfire/i.test(clause)) b.backfire.push(clause);
    else if (/fumble/i.test(clause)) b.fumble.push(clause);
    else if (/^(no to-hit roll|to hit\b|no roll|a \+)/i.test(clause) || /\bto-hit roll\b/.test(clause)) b.toHit.push(clause);
    else if (/resist/i.test(clause)) b.resist.push(clause);
    else if (/^(no damage|damage|heals|absorbs|an extra|an outright kill|kill chance)/i.test(clause) || /^no hp/i.test(clause)) b.damage.push(clause);
    else b.duration.push(clause);
  }
  return b;
}

/** spellCloseTable(auditText) — the Phase 90 close table: one row per SPELLS spell, its audit Rolls cell in six columns. */
export function spellCloseTable(auditText) {
  const doc = parseDoc(auditText);
  const lines = ["| Spell | Lvl · School | To hit | Resist | Damage | Duration, reach and effect | Backfire | Scroll fumble |", "|---|---|---|---|---|---|---|---|"];
  for (const sp of SPELLS) {
    const row = doc.rows.find((r) => r[0] === sp.n);
    const b = rollsBuckets(row[4]);
    const cell = (xs) => (xs.length ? xs.join("; ") : "—");
    lines.push(`| ${sp.n} | ${row[1]} | ${cell(b.toHit)} | ${cell(b.resist)} | ${cell(b.damage)} | ${cell(b.duration)} | ${cell(b.backfire)} | ${cell(b.fumble)} |`);
  }
  return lines.join("\n");
}

/** scrollPoolTable() — the scroll pool by depth band, from SPELLS (`rng.pick(SPELLS.filter(sp => sp.lvl <= min(5, depth + 1)))`). */
export function scrollPoolTable() {
  const lines = ["| Depth | Spell levels | Spells in the pool | Added at this depth |", "|---|---|---|---|"];
  let before = new Set();
  for (const depth of [1, 2, 3, 4]) {
    const top = Math.min(5, depth + 1);
    const pool = SPELLS.filter((s) => s.lvl <= top);
    const added = pool.filter((s) => !before.has(s.n)).map((s) => s.n);
    lines.push(`| ${depth === 4 ? "4 and deeper" : depth} | 1 to ${top} | ${pool.length} | ${added.join(", ")} |`);
    before = new Set(pool.map((s) => s.n));
  }
  return lines.join("\n");
}

/** gatesTable() — the school bonus and gate of every Magic User sub-class, from the live MU_CHART. */
export function gatesTable() {
  const lines = ["| Sub-class | Offense | Protection | Healing | Divination | Special | Illusion |", "|---|---|---|---|---|---|---|"];
  for (const sub of Object.keys(MU_CHART)) lines.push(`| ${sub} | ${SCHOOLS.map((s) => chartCell(sub, s)).join(" | ")} |`);
  return lines.join("\n");
}

/** closeBlock(text, name) — the text between `<!-- phase90-close:NAME:start -->` and `<!-- phase90-close:NAME:end -->`, or null. */
export function closeBlock(text, name) {
  const a = text.indexOf(`<!-- phase90-close:${name}:start -->\n`);
  const b = text.indexOf(`\n<!-- phase90-close:${name}:end -->`);
  if (a < 0 || b < 0) return null;
  return text.slice(a + `<!-- phase90-close:${name}:start -->\n`.length, b);
}

/** doctor(fn) — the real doc, with `fn` applied to its lines (and a finder for a spell's row). */
function doctor(fn) {
  const lines = DOC_TEXT.split(/\r?\n/);
  fn(lines, (name) => lines.findIndex((l) => l.startsWith(`| ${name} |`)));
  return lines.join("\n");
}

test("docs/SPELL-AUDIT.md passes every coverage, consistency and close rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("the doc has its required sections and a row for every spell, slate spell and removed spell", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const s of SECTIONS) assert.ok(doc.haveSections[s], s);
  const names = doc.rows.map((r) => r[0]);
  for (const sp of SPELLS) assert.equal(names.filter((n) => n === sp.n).length, 1, `${sp.n}: one row`);
  assert.deepEqual(names, SPELLS.map((s) => s.n), "the Spells table is SPELLS, row for row");
  assert.deepEqual(doc.removed.map((r) => r[0]), REMOVED, "the Removed table holds exactly the two removed spells");
  for (const n of REMOVED) assert.ok(!SPELLS.some((s) => s.n === n), `${n} is not in SPELLS`);
});

test("the close: no row and no hand-out path reads fix engine, fix text, new or balance call, and the table holds at least 70 titled pins", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const cells of [...doc.rows, ...doc.removed]) assert.doesNotMatch(cells[6], OPEN_VERDICT, `${cells[0]}: ${cells[6]}`);
  for (const cells of doc.paths) assert.doesNotMatch(cells[2], OPEN_VERDICT, `${cells[0]}: ${cells[2]}`);
  assert.ok(distinctPins(doc).size >= 70, `distinct pins: ${distinctPins(doc).size}`);
  // every fixed or ruled row names a test title; every row is pinned by the text-vs-engine guard
  for (const cells of doc.rows) {
    assert.ok(cells[7].includes("test/unit/spell-skill-text-engine.test.js: every number the text states"), `${cells[0]}: pinned by the text-vs-engine guard`);
    if (/^(fixed|ruled)/.test(cells[6])) assert.ok(cells[7].split("; ").filter((p) => p.includes(": ")).length >= 2, `${cells[0]}: a fixed row names its fix's test as well as the guard`);
  }
});

test("the close: a row turned back into fix engine, fix text, new or balance call fails", () => {
  for (const [name, from, to] of [["Strength", "| fixed engine (90-03) |", "| fix engine (90-03) |"], ["Fly", "| fixed engine (90-07) |", "| new (90-07) |"], ["Lightning", "| fixed engine (90-10) |", "| balance call (Q8) |"], ["Heal", "| match |", "| fix text (90-11) |"]]) {
    const reopened = doctor((c, at) => (c[at(name)] = c[at(name)].replace(from, to)));
    assert.ok(checkDoc(reopened).some((p) => new RegExp(`row "${name}" is still open`).test(p)), name);
  }
});

test("the close: a pin naming a missing file or a title the file does not hold fails", () => {
  const noFile = doctor((c, at) => (c[at("Strength")] = c[at("Strength")].replace("test/unit/strength-spell.test.js:", "test/unit/strength-spells.test.js:")));
  assert.ok(checkDoc(noFile).some((p) => /strength-spells\.test\.js", which does not exist/.test(p)));
  const noTitle = doctor((c, at) => (c[at("Strength")] = c[at("Strength")].replace("restart: a recast 40 squares in goes back to 100", "restart: a recast 40 squares in goes back to 200")));
  assert.ok(checkDoc(noTitle).some((p) => /names a test title that is not in the file/.test(p)));
  const fileOnly = doctor((c, at) => (c[at("Strength")] = c[at("Strength")].split(" | ").map((cell, i, all) => (i === all.length - 1 ? "test/unit/strength-spell.test.js" : cell)).join(" | ")));
  assert.ok(checkDoc(fileOnly).some((p) => /pinned by file only/.test(p)));
  const dash = doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace(/\|[^|]*\|$/, "| — |")));
  assert.ok(checkDoc(dash).some((p) => /row "Fly": is not pinned/.test(p)));
  const malformed = doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace("test/unit/special-timed-spells.test.js: Fly:", "special-timed-spells: Fly:")));
  assert.ok(checkDoc(malformed).some((p) => /malformed pin/.test(p)));
});

test("the close: a spell with no row, a removed spell back in the table, or a Removed table that is not exactly the two fails", () => {
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Mangle"), 1))).some((p) => /missing a row for the spell "Mangle"/.test(p)));
  const back = doctor((c, at) => {
    const removedRow = c.find((l) => l.startsWith("| Lesser Summon |"));
    c.splice(at("Summon") + 1, 0, removedRow);
  });
  assert.ok(checkDoc(back).some((p) => /row "Lesser Summon" is not in SPELLS/.test(p)));
  const oneRemoved = doctor((c) => c.splice(c.findIndex((l) => l.startsWith("| Phantom Host |")), 1));
  assert.ok(checkDoc(oneRemoved).some((p) => /the Removed table holds/.test(p)));
  const extra = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Phantom Host |"));
    c.splice(i + 1, 0, c[i].replace("| Phantom Host |", "| Wand of Wonder |"));
  });
  assert.ok(checkDoc(extra).some((p) => /the Removed table holds/.test(p)));
  const noTable = DOC_TEXT.replace(/^### Removed$/m, "### Gone");
  assert.ok(checkDoc(noTable).some((p) => /missing the "### Removed" table/.test(p)));
});

test("the close: a Text cell that is not the live txt, or one that keeps draft language, fails", () => {
  const stale = doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace("flight for 30 squares, +10 squares per school bonus point", "flight for 30 squares")));
  assert.ok(checkDoc(stale).some((p) => /row "Fly" Text cell is not the live txt/.test(p)));
  const draft = doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace(" | built in 90-07:", " | new: built in 90-07:")));
  assert.ok(checkDoc(draft).some((p) => /still carries draft or to-do language/.test(p)));
});

test("the close: the header's Closed line states the true pin count, and Findings names Phases 91, 91.1 and 92", () => {
  const m = /\((\d+) distinct pins\)/.exec(DOC_TEXT);
  assert.ok(m, "the Closed line states its pin count");
  assert.equal(Number(m[1]), distinctPins(parseDoc(DOC_TEXT)).size);
  assert.ok(checkDoc(DOC_TEXT.replace(/\(\d+ distinct pins\)/, "(7 distinct pins)")).some((p) => /Closed line says 7 distinct pins/.test(p)));
  assert.ok(checkDoc(DOC_TEXT.replace("**Closed:**", "**Shut:**")).some((p) => /no "Closed:" line/.test(p)));
  assert.ok(checkDoc(DOC_TEXT.replace("- **Phase 91.1 (value review):**", "- **Phase 99 (value review):**")).some((p) => /does not name Phase 91\.1/.test(p)));
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

test("adjacency: spells that share a kind or a name stem each keep their own row, and the removed ones their own table", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  for (const [a, b] of [["Fireball", "Fireballs"], ["Heal", "Major Heal"], ["Doze", "Stun"]]) {
    assert.ok(names.includes(a) && names.includes(b), `${a} and ${b} each have a row`);
    assert.notEqual(names.indexOf(a), names.indexOf(b));
  }
  assert.ok(names.includes("Summon"), "Summon keeps its row");
  for (const n of ["Lesser Summon", "Phantom Host"]) assert.ok(!names.includes(n) && doc.removed.some((r) => r[0] === n), `${n} is in the Removed table only`);
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
  for (const r of [...doc.rows, ...doc.removed]) for (const c of r) assert.ok(c.length > 0, `${r[0]}: no blank cell`);
});

test("ordering: rows follow SPELLS order, which ends with the ten slate rows in their append order", () => {
  const doc = parseDoc(DOC_TEXT);
  const names = doc.rows.map((r) => r[0]);
  assert.deepEqual(names.slice(-SLATE.length), SLATE);
  assert.deepEqual(names, SPELLS.map((s) => s.n));
});

test("pre-owned rows name the plan that builds them; removed rows read removed (90-06); slate rows read fixed engine with their plan", () => {
  const doc = parseDoc(DOC_TEXT);
  for (const [name, plan] of Object.entries(PRE_OWNED)) {
    const row = doc.rows.find((r) => r[0] === name);
    assert.ok(row[6].includes(plan), `${name}: ${row[6]}`);
  }
  for (const n of REMOVED) assert.equal(doc.removed.find((r) => r[0] === n)[6], "removed (90-06)");
  for (const n of SLATE) assert.equal(doc.rows.find((r) => r[0] === n)[6], `fixed engine (${SLATE_OWNER[n]})`);
  for (const n of REMOVED) assert.ok(doc.removed.find((r) => r[0] === n)[7].includes("test/unit/removed-spells-load.test.js"), `${n}: pinned by the tolerant-load test`);
});

test("School gates: one row per MU_CHART sub-class, each cell equal to the live chart, and a hand-out paths table that names every path", () => {
  const doc = parseDoc(DOC_TEXT);
  assert.deepEqual(doc.subs.map((r) => r[0]), Object.keys(MU_CHART));
  assert.ok(doc.paths.length >= 10);
  for (const needle of PATH_NEEDLES) assert.ok(doc.paths.some((r) => r[0].includes(needle)), needle);
  for (const r of doc.subs) SCHOOLS.forEach((school, i) => assert.equal(r[i + 1], chartCell(r[0], school), `${r[0]} ${school}`));
  // The chart facts the audit rests on, read live.
  assert.equal(MU_CHART.Wizard.illusion, null, "the Wizard lost the Illusion school");
  assert.deepEqual(SPELL_LEVEL_OVERRIDES, { Summoner: { Summon: 1 } }, "the one named exception");
  assert.equal(MU_CHART.Illusionist.illusion, 0, "the Illusion bonus is 0 (Phase 91.1)");
  assert.equal(MU_CHART.Apprentice.illusion, 0);
});

test("School gates: a doctored cell that disagrees with MU_CHART, a missing sub-class row, and a path with no verdict fail", () => {
  const wrongBonus = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Wizard |"));
    c[i] = c[i].replace("| +3 |", "| +4 |");
  });
  assert.ok(checkDoc(wrongBonus).some((p) => /School gates: Wizard offense reads "\+4", the live MU_CHART says "\+3"/.test(p)));
  const wrongGate = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Warlock |"));
    c[i] = c[i].replace("+0 (gate 4)", "+0 (gate 5)");
  });
  assert.ok(checkDoc(wrongGate).some((p) => /Warlock protection reads "\+0 \(gate 5\)"/.test(p)));
  const wrongNever = doctor((c) => {
    const i = c.findIndex((l) => l.startsWith("| Wizard |"));
    c[i] = c[i].replace("| never |", "| +0 |");
  });
  assert.ok(checkDoc(wrongNever).some((p) => /Wizard illusion reads "\+0", the live MU_CHART says "never"/.test(p)));
  const noWizard = doctor((c) => c.splice(c.findIndex((l) => l.startsWith("| Wizard |")), 1));
  assert.ok(checkDoc(noWizard).some((p) => /missing the sub-class "Wizard"/.test(p)));
  const noPath = doctor((c) => c.splice(c.findIndex((l) => l.includes("`encounters.js#findGrimoire`")), 1));
  assert.ok(checkDoc(noPath).some((p) => /findGrimoire/.test(p)));
  const openPath = doctor((c) => {
    const i = c.findIndex((l) => l.includes("`encounters.js#findGrimoire`"));
    c[i] = c[i].replace(/\| match \|$/, "| fix engine (90-09) |");
  });
  assert.ok(checkDoc(openPath).some((p) => /path row .* is still open/.test(p)));
  const noPins = DOC_TEXT.replace(/\*\*School gates pinned by:\*\*[^\n]*/, "");
  assert.ok(checkDoc(noPins).some((p) => /no `School gates pinned by:` line/.test(p)));
  const badSweep = DOC_TEXT.replace("sweep, chargen: every Magic User sub-class x seeds 1-500 x levels 1-5", "sweep, chargen: every Magic User sub-class x seeds 1-900");
  assert.ok(checkDoc(badSweep).some((p) => /School gates pins: pin .* names a test title that is not in the file/.test(p)));
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
  assert.ok(checkDoc(doctor((c) => (c[i(c)] = c[i(c)].replace("| match |", "| fixed text (90-13) |")))).some((p) => /90-13/.test(p)));
  // a slate row that does not read its own plan
  assert.ok(checkDoc(doctor((c, at) => (c[at("Fly")] = c[at("Fly")].replace("| fixed engine (90-07) |", "| fixed engine (90-08) |")))).some((p) => /slate row "Fly"/.test(p)));
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
  const reopened = doctor((c, at) => {
    const i = at("Lightning");
    c[i] = c[i].replace("| fixed engine (90-10) |", "| balance call (Q8) |");
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

// ---------------------------------------------------------------------------
// docs/SPELLS.md "Phase 90 close" (plan 90-12): the generated tables match the audit and the live content
// ---------------------------------------------------------------------------

const SPELLS_DOC = fs.readFileSync(path.join(REPO_ROOT, "docs", "SPELLS.md"), "utf8").replace(/\r\n/g, "\n");

test("docs/SPELLS.md has one Phase 90 close section, summarising every rule the phase changed", () => {
  assert.equal((SPELLS_DOC.match(/^## Phase 90 close/gm) || []).length, 1);
  const section = SPELLS_DOC.slice(SPELLS_DOC.indexOf("## Phase 90 close"));
  for (const needle of ["Strength", "depth-rising resist", "Doze", "Stun", "Ice", "Lesser Summon", "Phantom Host", "Summoner", "Illusion", "Open/Lock", "Stop Time", "Door Illusion", "Joiner", "TEXT-01", "scroll"]) {
    assert.ok(section.includes(needle), `the close section names ${needle}`);
  }
});

test("docs/SPELLS.md Phase 90 close: the rolls table is generated from the audit's Rolls cells, one row per spell", () => {
  assert.equal(closeBlock(SPELLS_DOC, "rolls"), spellCloseTable(DOC_TEXT));
  const rows = closeBlock(SPELLS_DOC, "rolls").split("\n").slice(2);
  assert.deepEqual(rows.map((r) => r.split(" | ")[0].replace(/^\| /, "")), SPELLS.map((s) => s.n));
  // every row has its eight cells (a dash is the honest "none")
  for (const r of rows) assert.equal(r.split(" | ").length, 8, `${r.slice(0, 30)}: eight cells`);
  assert.ok(closeBlock(SPELLS_DOC, "rolls").includes("hits on 5–10"), "a to-hit range in roll-high form");
});

test("docs/SPELLS.md Phase 90 close: the school gates equal the live MU_CHART and the scroll pool equals SPELLS by depth band", () => {
  assert.equal(closeBlock(SPELLS_DOC, "gates"), gatesTable());
  assert.equal(closeBlock(SPELLS_DOC, "pool"), scrollPoolTable());
  const pool = closeBlock(SPELLS_DOC, "pool").split("\n").slice(2).map((r) => Number(r.split(" | ")[2]));
  assert.deepEqual(pool, [19, 29, 36, 41], "the scroll pool by band");
  assert.ok(!/Lesser Summon|Phantom Host/.test(closeBlock(SPELLS_DOC, "pool")), "no removed spell in any band");
});

test("docs/SPELLS.md Phase 90 close: a doctored generated table fails", () => {
  assert.notEqual(closeBlock(SPELLS_DOC.replace("hits on 5–10", "hits on 5–11"), "rolls"), spellCloseTable(DOC_TEXT));
  assert.notEqual(closeBlock(SPELLS_DOC.replace("| Warlock | +4 |", "| Warlock | +5 |"), "gates"), gatesTable());
  assert.equal(closeBlock(SPELLS_DOC, "no-such-block"), null);
});
