// test/unit/value-ledger.test.js
//
// Phase 91.1 (VALUE-01 to VALUE-04; plan 91.1-01) — the coverage, consistency and (once
// `**Status:** closed`) close test for docs/VALUE-LEDGER.md, the value ledger: one row per race
// (6), sub-class (24), skill (21), level-up ability (9) and the Bard's Sing, plus five
// cross-cutting rows; the known findings K01..K20; the numbered value calls V1..Vn with their
// recommended default; the rulings; and the build-ownership table. It reads the live content
// (RACES, CLASSES, FIGHTER_SKILLS, THIEF_SKILLS, ABILITY_POOL, the identity footer's entry ids,
// the combat menu's Sing text) and fails when the doc loses a row, doubles a row, leaves a
// cell empty, uses a flag, recommendation or verdict outside the closed vocabulary, flags a
// system with no recommendation or no question, leaves a question uncited, loses a known
// finding, leaves a ruled question open or lets the ownership table disagree with the verdicts.
//
// Edge coverage (the VALUE-01 and VALUE-02 fallback probes):
//   - adjacency: Kata (Fighter) and Feint (Thief) each keep their own row, a table skill and its
//     catalog ability are ONE row (never two), and a race row and a sub-class row that share a
//     system id (race-dmg on the Dwarven and Troll rows, chart-never on every Magic User) each
//     keep their own;
//   - empty: Human has a row whose Systems cell says it has no systems and whose flags are none;
//     an unflagged row reads flags `—`, recommendation keep, Q `—`, verdict ok; a cleanup row
//     reads flags `—`, a cleanup recommendation, no question;
//   - ordering: rows follow RACES order, CLASSES subs order, FIGHTER_SKILLS then THIEF_SKILLS key
//     order, ABILITY_POOL order and then Sing; questions are numbered V1 upward in part order;
//     the checker fails a doctored swap of two rows;
//   - encoding: an Entry cell equals the content name code unit for code unit (Runes/Signs with
//     its slash, Master of Arms, Con Artist), and every number written in a Systems or
//     Recommendation cell uses the U+2212 minus and the U+2013 en dash (no ASCII-hyphen range).
//
// Phase 91.1 plan 05 (2026-10-01): the ledger is CLOSED (**Status:** closed), so the close rules run on the live doc: every verdict final, every
// built and cleaned row pinned by a titled test that exists, the Closed line's distinct-pin count true, no Systems item reading GAP (a former gap
// reads `accepted: <reason> (V<n>)` or `fixed in 91.1-0N (V<n>` and names every question that covers it), and the doctored-closed-ledger tests
// below prove each rule fails when broken. The open-state tests keep running on test/fixtures/value-ledger-open.md (the checkpoint copy).
//
// The doc is text and the test only reads it (plus content, the identity footer, the combat menu
// copy and the named test files); no engine, rng or shell module runs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { RACES, CLASSES, FIGHTER_SKILLS, THIEF_SKILLS, ABILITY_BY_ID, ABILITY_POOL } from "../../content/index.js";
import { identityEntries } from "../../src/browser/identityFooter.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "VALUE-LEDGER.md");

// ---------------------------------------------------------------------------
// the expectations
// ---------------------------------------------------------------------------

const RACE_NAMES = Object.keys(RACES);
const SUB_NAMES = Object.fromEntries(Object.entries(CLASSES).map(([c, d]) => [c, d.subs.slice()]));
const SKILL_NAMES = [...Object.keys(FIGHTER_SKILLS), ...Object.keys(THIEF_SKILLS)];
const LEVELUP_NAMES = [...ABILITY_POOL.Fighter, ...ABILITY_POOL.Thief].map((id) => ABILITY_BY_ID[id].name);
const ACTION_NAMES = ["Sing"];
const CROSS_NAMES = ["Joiner staff blows", "Walking Dead fixation", "Misdirected swings", "Inspired chip", "Soothed-beasts outcome"];
const CLEANUP_ROWS = { "Inspired chip": "inspired-chip", "Soothed-beasts outcome": "soothed-outcome" };
const K_KEYS = Array.from({ length: 20 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);
const K_CLEANUP = ["K19", "K20"];

/** The live text(s) an ability row's Systems cell must quote. */
function liveTexts(name) {
  if (FIGHTER_SKILLS[name]) return [FIGHTER_SKILLS[name].txt, ...(FIGHTER_SKILLS[name].txt2 ? [FIGHTER_SKILLS[name].txt2] : [])];
  if (THIEF_SKILLS[name]) return [THIEF_SKILLS[name].txt, ...(THIEF_SKILLS[name].txt2 ? [THIEF_SKILLS[name].txt2] : [])];
  if (name === "Sing") return [COMBAT_MENU_COPY.singDesc];
  const ab = Object.values(ABILITY_BY_ID).find((a) => a.name === name);
  return ab ? [ab.txt] : [];
}

const FLAGS = ["gap", "no-value", "low-bonus", "one-round", "once-per-fight", "joiner-gap"];
const RECS = ["keep", "buff", "lengthen", "rework", "allow more uses", "cut", "new system", "engine to text", "text to engine"];
const REC_ITEM = new RegExp(`^(${RECS.join("|")})@(\\S+): (.+)$`);
const OWNER = /91\.1-0[2-5]/;
const OWNERS = "91\\.1-0[2-5]";
const DATE = "\\d{4}-\\d\\d-\\d\\d";
/** VERDICT_PARTS — the closed verdict vocabulary (one part; a cell joins parts with "; "). */
const VERDICT_PARTS = [
  /^ok$/,
  /^question \(V\d+\)$/,
  new RegExp(`^ruled keep \\(V\\d+, ${DATE}\\)$`),
  new RegExp(`^ruled \\(V\\d+, ${DATE}\\) -> ${OWNERS}(, ${OWNERS})?( - .+)?$`),
  new RegExp(`^built \\(${OWNERS}\\)$`),
  /^cleanup \(91\.1-05\)$/,
  /^cleaned \(91\.1-05\)$/,
];
const PARTS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const SECTIONS = ["How to read this ledger", "Races", "Sub-classes", "Abilities", "Cross-cutting systems", "Known findings", "Value calls", "Build ownership", "Rulings", "Findings for other phases"];
const H3 = { "Sub-classes": ["Magic User", "Fighter", "Thief"], Abilities: ["Skills", "Level-up abilities", "Class action"] };
const COLUMNS = ["Entry", "Systems named → exists", "Value flags", "Recommendation", "Q", "Verdict", "Pinned by"];

// ---------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------

/** splitCells(line) — the cells of one table row (cells never hold a pipe). */
function splitCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}
const isSeparator = (cells) => /^-+$/.test(cells[0].replace(/\s/g, ""));

/** parseDoc(text) — the ledger as plain data. */
function parseDoc(text) {
  const doc = { h2: {}, h3: {}, tables: {}, header: {}, known: [], ownership: [], questions: [], parts: [], rulings: [], findings: "", problems: [] };
  let h2 = null;
  let h3 = null;
  let part = null;
  let q = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const hm = /^\*\*(Phase|Date|Status|Closed):\*\* ?(.*)$/.exec(line);
    if (hm && h2 === null) doc.header[hm[1]] = hm[2];
    if (/^## /.test(line)) {
      h2 = line.slice(3).trim();
      doc.h2[h2] = true;
      h3 = null;
      q = null;
      continue;
    }
    if (/^### /.test(line)) {
      h3 = line.slice(4).trim();
      doc.h3[`${h2}/${h3}`] = true;
      if (h2 === "Value calls") {
        const m = /^Part ([A-Z])\b/.exec(h3);
        if (m) {
          part = m[1];
          doc.parts.push(part);
        }
      }
      continue;
    }
    if (h2 === "Findings for other phases") doc.findings += line + "\n";
    if (h2 === "Value calls" && /^#### /.test(line)) {
      const m = /^#### V(\d+) (.+)$/.exec(line);
      q = m ? { n: Number(m[1]), title: m[2], part, rows: null, rowsRaw: null, today: null, options: [] } : null;
      if (q) doc.questions.push(q);
      else doc.problems.push(`malformed question heading "${line}"`);
      continue;
    }
    if (h2 === "Value calls" && q) {
      let m;
      if ((m = /^\*\*Rows:\*\* (.+)$/.exec(line))) {
        q.rowsRaw = m[1];
        q.rows = m[1].split("; ").map((item) => {
          const r = /^(.+) \((.+)\)$/.exec(item);
          return r ? { entry: r[1], pairs: r[2].split(", ") } : { entry: item, pairs: [], bad: true };
        });
      } else if ((m = /^\*\*Today:\*\* (.+)$/.exec(line))) q.today = m[1];
      else if (line.startsWith("- ")) {
        const o = new RegExp(`^- \\*\\*([A-Z])( \\(recommended default\\))?: (.+)\\*\\* -> (nothing built|${OWNERS}(?:, ${OWNERS})?)$`).exec(line);
        q.options.push(o ? { letter: o[1], rec: !!o[2], text: o[3], to: o[4] } : { bad: line });
      }
      continue;
    }
    if (h2 === "Rulings") {
      const m = /^- V(\d+) \((\d{4}-\d\d-\d\d)\): (.+)$/.exec(line);
      if (m) doc.rulings.push({ n: Number(m[1]), date: m[2], text: m[3] });
      continue;
    }
    if (line.startsWith("|") && h2) {
      const cells = splitCells(line);
      if (["Entry", "Key", "Plan"].includes(cells[0]) || isSeparator(cells)) continue;
      if (h2 === "Known findings") doc.known.push(cells);
      else if (h2 === "Build ownership") doc.ownership.push(cells);
      else {
        const key = h3 ? `${h2}/${h3}` : h2;
        (doc.tables[key] = doc.tables[key] || []).push(cells);
      }
    }
  }
  return doc;
}

const TABLES = [
  ["Races", RACE_NAMES, "race"],
  ["Sub-classes/Magic User", SUB_NAMES["Magic User"], "sub-MU"],
  ["Sub-classes/Fighter", SUB_NAMES["Fighter"], "sub-Fighter"],
  ["Sub-classes/Thief", SUB_NAMES["Thief"], "sub-Thief"],
  ["Abilities/Skills", SKILL_NAMES, "ability"],
  ["Abilities/Level-up abilities", LEVELUP_NAMES, "ability"],
  ["Abilities/Class action", ACTION_NAMES, "ability"],
  ["Cross-cutting systems", CROSS_NAMES, "cross"],
];

/** partOf(kind, flag) — the part a flagged pair belongs to (the placement rule, applied in order). */
function partOf(kind, flag) {
  if (flag === "once-per-fight") return "A";
  if (flag === "one-round") return "B";
  if (flag === "joiner-gap" || kind === "cross") return "H";
  if (kind === "ability") return "C";
  if (kind === "race") return "D";
  return { "sub-MU": "E", "sub-Fighter": "F", "sub-Thief": "G" }[kind];
}

/** itemsOf(systems) — the backticked-id items of a Systems cell: [{ id, text }]. */
function itemsOf(systems) {
  return systems
    .split(/; (?=(?:No systems: )?`[^`]+`(?: \(|:))/)
    .map((t) => {
      const m = /^(?:No systems: )?`([^`]+)`/.exec(t);
      return m ? { id: m[1], text: t } : null;
    })
    .filter(Boolean);
}

/** stripIds(text) — a cell with the plan owners, dates and phase ids removed (their hyphens are not ranges). */
const stripIds = (t) => t.replace(/\d{4}-\d\d-\d\d/g, "D").replace(/\b9\d(?:\.\d)?-\d\d\b/g, "P");

// ---------------------------------------------------------------------------
// pins (the skill-audit shape)
// ---------------------------------------------------------------------------

const PIN = /^(test\/[A-Za-z0-9_\-/.]+\.test\.js)(?:: (.+))?$/;
const sourceCache = new Map();
function sourceOf(rel) {
  if (!sourceCache.has(rel)) {
    const abs = path.join(REPO_ROOT, rel);
    sourceCache.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n") : null);
  }
  return sourceCache.get(rel);
}
function pinProblems(where, pinned, { needTitle, allowDash }) {
  if (pinned === "—") return allowDash ? [] : [`${where}: is not pinned (—), but it is built`];
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
  if (needTitle && titled === 0) out.push(`${where}: pinned by file only, but a built row must name a test title`);
  return out;
}
function distinctPins(doc) {
  const set = new Set();
  for (const [key] of TABLES) for (const cells of doc.tables[key] || []) {
    if (cells.length !== 7) continue;
    for (const raw of cells[6].split("; ")) if (PIN.exec(raw.trim()) && raw.includes(": ")) set.add(raw.trim());
  }
  return set;
}

// ---------------------------------------------------------------------------
// the checker
// ---------------------------------------------------------------------------

/** checkDoc(text, { only }) — every problem the coverage, consistency and close rules find, as strings. `only` limits to a rule family. */
function checkDoc(text) {
  const problems = [];
  const add = (m) => problems.push(m);
  const doc = parseDoc(text);
  problems.push(...doc.problems);

  // ---- structure
  for (const s of SECTIONS) if (!doc.h2[s]) add(`missing section "## ${s}"`);
  for (const [h2, subs] of Object.entries(H3)) for (const s of subs) if (!doc.h3[`${h2}/${s}`]) add(`missing "### ${s}" under "## ${h2}"`);
  for (const k of ["Phase", "Date", "Status"]) if (!doc.header[k]) add(`the header has no "**${k}:**" line`);
  const closed = /^closed/.test(doc.header.Status || "");
  if (doc.header.Status && !/^(open|closed)/.test(doc.header.Status)) add(`the Status line must start with open or closed, not "${doc.header.Status}"`);

  // ---- rows
  const byEntry = new Map(); // entry -> { cells, kind, key }
  const questionNs = new Set(doc.questions.map((q) => q.n));
  for (const [key, expected, kind] of TABLES) {
    const rows = doc.tables[key] || [];
    const names = rows.map((r) => r[0]);
    const seen = new Set();
    for (const n of names) {
      if (seen.has(n)) add(`duplicate row "${n}" in ${key}`);
      seen.add(n);
    }
    for (const n of expected) if (!names.includes(n)) add(`missing a row for "${n}" in ${key}`);
    for (const n of names) if (!expected.includes(n)) add(`row "${n}" in ${key} is not one of the expected entries`);
    if (JSON.stringify(names) !== JSON.stringify(expected) && !problems.some((p) => p.includes(key))) add(`rows of ${key} are out of order`);
    for (const cells of rows) {
      if (cells.length !== 7) {
        add(`row "${cells[0]}" has ${cells.length} cells, not 7`);
        continue;
      }
      if (byEntry.has(cells[0])) add(`entry "${cells[0]}" appears in two tables`);
      byEntry.set(cells[0], { cells, kind, key });
    }
  }

  const pairsOf = new Map(); // entry -> [{ flag, id, rec }]
  const ownerPairs = new Set();
  for (const [entry, { cells, kind }] of byEntry) {
    const [name, systems, flags, rec, qcell, verdict, pinned] = cells;
    for (const [label, v] of [["Entry", name], ["Systems", systems], ["Value flags", flags], ["Recommendation", rec], ["Q", qcell], ["Verdict", verdict], ["Pinned by", pinned]]) {
      if (!v) add(`row "${name}" has an empty ${label} cell`);
    }
    const items = itemsOf(systems);
    const ids = items.map((i) => i.id);
    // race / sub-class: an item for every identity-footer entry id
    if (kind === "race" || kind.startsWith("sub-")) {
      for (const e of identityEntries(kind === "race" ? "race" : "sub", name)) if (!ids.includes(e.id)) add(`row "${name}" has no Systems item for the footer entry \`${e.id}\``);
    }
    if (name === "Human" && !/no systems/i.test(systems)) add('row "Human" must say it has no systems');
    if (kind === "ability") for (const t of liveTexts(name)) if (!systems.includes(t)) add(`row "${name}" Systems cell is not the live text "${t}"`);
    if (kind === "ability") {
      if (!/; timing: /.test(systems)) add(`row "${name}" has no timing (in foe turns)`);
      if (!/; who: /.test(systems)) add(`row "${name}" does not say who can use it (the hero, a Joiner)`);
    }
    // encoding: no ASCII-hyphen range or negative in the numbers of a Systems or Recommendation cell
    for (const [label, v] of [["Systems", systems], ["Recommendation", rec]]) {
      const s = stripIds(v);
      if (/\d-\d/.test(s) || /(^|[\s(])-\d/.test(s)) add(`row "${name}" writes a range or a negative number with an ASCII hyphen in its ${label} cell (use – and −)`);
    }
    // ---- cleanup rows
    if (CLEANUP_ROWS[name]) {
      const id = CLEANUP_ROWS[name];
      if (flags !== "—") add(`cleanup row "${name}" must have flags —`);
      if (rec !== `cleanup@${id}`) add(`cleanup row "${name}" must read cleanup@${id}`);
      if (qcell !== "—") add(`cleanup row "${name}" must have no question`);
      if (!ids.includes(id)) add(`cleanup row "${name}" has no Systems item \`${id}\``);
      if (!/^(cleanup|cleaned) \(91\.1-05\)$/.test(verdict)) add(`cleanup row "${name}" verdict must be cleanup (91.1-05) or cleaned (91.1-05), not "${verdict}"`);
      ownerPairs.add(`${name}|91.1-05`); // the plan owns the row before and after it is cleaned
      // Phase 91.1 plan 05: a cleaned row pins at least one titled test that exists; an open cleanup row pins nothing
      if (/^cleaned/.test(verdict)) {
        for (const p of pinProblems(`cleanup row "${name}"`, pinned, { needTitle: true, allowDash: false })) add(p);
        if (!/^test\/unit\/value-cleanup\.test\.js: Cleanup: /.test(pinned)) add(`cleanup row "${name}" must be pinned by test/unit/value-cleanup.test.js: Cleanup: ...`);
      } else if (pinned !== "—") add(`cleanup row "${name}" is pinned but not yet cleaned`);
      if (closed && /^cleanup /.test(verdict)) add(`row "${name}" is still a cleanup (not cleaned) in a closed ledger`);
      if (closed && /GAP:/.test(systems)) add(`row "${name}" still has a GAP: item in a closed ledger (a closed gap reads exists or accepted: <reason> (V<n>))`);
      continue;
    }
    // ---- flags and recommendations
    const flagItems = flags === "—" ? [] : flags.split("; ");
    const pairs = [];
    for (const it of flagItems) {
      const m = /^([a-z-]+)@(.+)$/.exec(it);
      if (!m) {
        add(`row "${name}": malformed flag "${it}" (want flag@id)`);
        continue;
      }
      if (!FLAGS.includes(m[1])) add(`row "${name}": unknown flag "${m[1]}"`);
      if (!ids.includes(m[2])) add(`row "${name}": flag ${m[1]}@${m[2]} names an id that is not a backticked item of its Systems cell`);
      pairs.push({ flag: m[1], id: m[2] });
    }
    const recItems = rec === "keep" ? [] : rec.split("; ");
    const recs = [];
    for (const it of recItems) {
      const m = REC_ITEM.exec(it);
      if (!m) {
        add(`row "${name}": malformed or unknown recommendation "${it}" (want <token>@id: the change in numbers)`);
        continue;
      }
      recs.push({ token: m[1], id: m[2], text: m[3] });
    }
    if (!pairs.length) {
      if (rec !== "keep") add(`row "${name}" is unflagged but its recommendation is not keep`);
      if (qcell !== "—") add(`row "${name}" is unflagged but cites a question`);
      if (verdict !== "ok") add(`row "${name}" is unflagged but its verdict is not ok`);
    } else {
      if (recs.length !== pairs.length) add(`row "${name}" has ${pairs.length} flagged system(s) but ${recs.length} recommendation item(s)`);
      for (let i = 0; i < Math.min(pairs.length, recs.length); i++) {
        if (pairs[i].id !== recs[i].id) add(`row "${name}": flag ${pairs[i].flag}@${pairs[i].id} has no matching recommendation (item ${i + 1} is for ${recs[i].id})`);
        pairs[i].rec = recs[i];
      }
      if (!/^V\d+(, V\d+)*$/.test(qcell)) add(`row "${name}" is flagged but its Q cell is "${qcell}"`);
    }
    // GAP rules. While the ledger is open: a GAP item is flagged, and a gap or joiner-gap flag has a GAP item.
    // Phase 91.1 plan 05: once closed, no item reads GAP (the rule below); a gap or joiner-gap flag stays (the question was asked) and its item
    // reads "accepted: <reason> (V<n>)" (the user's keep ruling) or "fixed in 91.1-0N (V<n>" (built), naming every question that covers the pair.
    if (!closed) {
      for (const it of items) {
        if (/GAP:/.test(it.text) && !pairs.some((p) => p.id === it.id)) add(`row "${name}": item \`${it.id}\` says GAP but no flag names it`);
      }
      for (const p of pairs) {
        const it = items.find((i) => i.id === p.id);
        if (it && (p.flag === "gap" || p.flag === "joiner-gap") && !/GAP:/.test(it.text)) add(`row "${name}": ${p.flag}@${p.id} but the item does not say GAP`);
      }
    } else {
      for (const p of pairs) {
        if (p.flag !== "gap" && p.flag !== "joiner-gap") continue;
        const it = items.find((i) => i.id === p.id);
        if (!it) continue;
        if (!/accepted: .+\(V\d+/.test(it.text) && !/fixed in 91\.1-0[2-5] \(V\d+/.test(it.text)) add(`row "${name}": ${p.flag}@${p.id} reads neither "accepted: <reason> (V<n>)" nor "fixed in 91.1-0N (V<n>)" in a closed ledger`);
        for (const q of doc.questions) {
          const covers = (q.rows || []).some((r) => r.entry === name && r.pairs.includes(`${p.flag}@${p.id}`));
          if (covers && !new RegExp(`\\(V${q.n}\\b|\\bV${q.n} [A-Z]\\b`).test(it.text)) add(`row "${name}": the closed item \`${p.id}\` does not name V${q.n}, which covers ${p.flag}@${p.id}`);
        }
      }
    }
    pairsOf.set(name, pairs);
    // ---- the Q cell and the verdict
    const cited = /^V\d+(, V\d+)*$/.test(qcell) ? qcell.split(", ").map((v) => Number(v.slice(1))) : [];
    for (const n of cited) if (!questionNs.has(n)) add(`row "${name}" cites V${n}, which is not in Value calls`);
    const parts = verdict.split("; ");
    const verdictNs = [];
    for (const p of parts) {
      if (!VERDICT_PARTS.some((re) => re.test(p))) {
        add(`row "${name}" has an unknown verdict part "${p}"`);
        continue;
      }
      let m;
      if ((m = /^question \(V(\d+)\)$/.exec(p))) verdictNs.push(Number(m[1]));
      if ((m = /^ruled keep \(V(\d+),/.exec(p))) verdictNs.push(Number(m[1]));
      if ((m = /^ruled \(V(\d+), \S+\) -> ([^ ]+(?:, 91\.1-0[2-5])?)/.exec(p))) {
        verdictNs.push(Number(m[1]));
        for (const o of m[2].split(", ")) ownerPairs.add(`${name}|${o}`);
      }
      if ((m = /^built \((91\.1-0[2-5])\)$/.exec(p))) ownerPairs.add(`${name}|${m[1]}`);
    }
    if (pairs.length) {
      // Phase 91.1 plan 02a: a `built (91.1-0N)` part carries no V number of its own: it stands for every cited question
      // the row's other parts (question, ruled, ruled keep) do not still name, so a built row keeps its Q cell.
      if (parts.some((p) => /^built \(/.test(p))) for (const n of cited) if (!verdictNs.includes(n)) verdictNs.push(n);
      const a = [...new Set(verdictNs)].sort((x, y) => x - y).join(",");
      const b = [...new Set(cited)].sort((x, y) => x - y).join(",");
      if (a !== b) add(`row "${name}": the verdict covers V${a || "-"} but the Q cell cites V${b || "-"}`);
    }
    // ---- pins
    const isBuilt = /built \(/.test(verdict);
    const isCleaned = /cleaned \(/.test(verdict);
    if (pinned !== "—") for (const p of pinProblems(`row "${name}"`, pinned, { needTitle: false, allowDash: true })) add(p);
    else if (closed && isBuilt) add(`row "${name}" is built but not pinned (—)`);
    if (pinned !== "—" && !isBuilt && !isCleaned) add(`row "${name}" is pinned but its verdict is not built or cleaned`);
    if (closed && isBuilt) for (const p of pinProblems(`row "${name}"`, pinned, { needTitle: true, allowDash: false })) add(p);
    // ---- the close
    if (closed) {
      if (/question \(|ruled \(/.test(verdict)) add(`row "${name}" is still open ("${verdict}"): a closed ledger has no question or ruled part`);
      if (/^cleanup /.test(verdict)) add(`row "${name}" is still a cleanup (not cleaned) in a closed ledger`);
      if (/GAP:/.test(systems)) add(`row "${name}" still has a GAP: item in a closed ledger (a closed gap reads exists or accepted: <reason> (V<n>))`);
    }
  }

  // ---- questions
  const nums = doc.questions.map((q) => q.n);
  if (JSON.stringify(nums) !== JSON.stringify(nums.map((_, i) => i + 1))) add(`question numbers must run V1 upward without a gap, found ${nums.join(",")}`);
  if (JSON.stringify(doc.parts) !== JSON.stringify(PARTS)) add(`Value calls must have parts ${PARTS.join(", ")} in order, found ${doc.parts.join(", ")}`);
  let lastPart = "A";
  const covered = new Set(); // entry|flag|id
  const questionRows = new Map(); // n -> Set(entry)
  for (const q of doc.questions) {
    const w = `question V${q.n}`;
    if (q.part < lastPart) add(`${w} is out of part order (part ${q.part} after ${lastPart})`);
    lastPart = q.part;
    if (!q.rows || q.rows.some((r) => r.bad)) add(`${w} has no parseable **Rows:** line`);
    if (!q.today) add(`${w} has no **Today:** line`);
    if (q.options.length < 2) add(`${w} has fewer than two options`);
    if (q.options.some((o) => o.bad)) add(`${w} has a malformed option "${(q.options.find((o) => o.bad) || {}).bad}"`);
    const opts = q.options.filter((o) => !o.bad);
    if (opts.filter((o) => o.rec).length !== 1) add(`${w} must mark exactly one option (recommended default)`);
    if (opts.map((o) => o.letter).join("") !== "ABCDEFGH".slice(0, opts.length)) add(`${w} options must be lettered A, B, ... in order`);
    questionRows.set(q.n, new Set());
    // once the user has ruled (heading ends (answered X)) the rows follow the CHOSEN option, otherwise the recommended default
    const answered = /\(answered ([A-Z])\)$/.exec(q.title);
    const recOpt = answered ? opts.find((o) => o.letter === answered[1]) : opts.find((o) => o.rec);
    let anyNonKeep = false;
    let anyPair = false;
    for (const r of q.rows || []) {
      const row = byEntry.get(r.entry);
      if (!row) {
        add(`${w} names "${r.entry}", which is not a ledger entry`);
        continue;
      }
      questionRows.get(q.n).add(r.entry);
      const rowPairs = pairsOf.get(r.entry) || [];
      for (const pr of r.pairs) {
        const m = /^([a-z-]+)@(.+)$/.exec(pr);
        const found = m && rowPairs.find((p) => p.flag === m[1] && p.id === m[2]);
        if (!found) {
          add(`${w} cites ${pr} for "${r.entry}", which that row does not carry`);
          continue;
        }
        anyPair = true;
        covered.add(`${r.entry}|${m[1]}|${m[2]}`);
        if (partOf(row.kind, m[1]) !== q.part) add(`${w} is in part ${q.part} but ${r.entry} ${pr} belongs in part ${partOf(row.kind, m[1])}`);
        if (found.rec && found.rec.token !== "keep") anyNonKeep = true;
        if (recOpt && recOpt.to === "nothing built" && found.rec && found.rec.token !== "keep") add(`${w}: the chosen option (or the recommended default) builds nothing but "${r.entry}" ${pr} recommends ${found.rec.token}`);
      }
      const cellQ = (row.cells[4] || "").split(", ");
      if (!cellQ.includes(`V${q.n}`)) add(`${w} covers "${r.entry}" but that row's Q cell does not cite it`);
    }
    if (recOpt && recOpt.to !== "nothing built" && anyPair && !anyNonKeep) add(`${w}: the chosen option (or the recommended default) builds (${recOpt.to}) but every covered row recommends keep`);
  }
  for (const [entry, pairs] of pairsOf) for (const p of pairs) if (!covered.has(`${entry}|${p.flag}|${p.id}`)) add(`flagged pair ${p.flag}@${p.id} of "${entry}" is not covered by any question's Rows line`);
  const citedBy = new Set();
  for (const [, { cells }] of byEntry) if (/^V\d+/.test(cells[4])) for (const v of cells[4].split(", ")) citedBy.add(Number(v.slice(1)));
  for (const q of doc.questions) if (!citedBy.has(q.n)) add(`question V${q.n} is cited by no row's Q cell`);

  // ---- known findings
  const kKeys = doc.known.map((r) => r[0]);
  for (const k of K_KEYS) if (!kKeys.includes(k)) add(`missing known finding ${k}`);
  for (const k of kKeys) if (!K_KEYS.includes(k)) add(`unknown known finding "${k}"`);
  if (JSON.stringify(kKeys) !== JSON.stringify(K_KEYS) && K_KEYS.every((k) => kKeys.includes(k)) && kKeys.length === K_KEYS.length) add("known findings are out of order");
  for (const cells of doc.known) {
    if (cells.length !== 5) {
      add(`known finding "${cells[0]}" has ${cells.length} cells, not 5`);
      continue;
    }
    cells.forEach((c, i) => c || add(`known finding "${cells[0]}" has an empty cell ${i + 1}`));
    for (const e of cells[3].split(", ")) if (!byEntry.has(e)) add(`known finding ${cells[0]} names "${e}", which is not a ledger entry`);
    if (K_CLEANUP.includes(cells[0])) {
      if (!/^clean(up|ed) \(91\.1-05\)$/.test(cells[4]) || (closed && cells[4] !== "cleaned (91.1-05)")) add(`known finding ${cells[0]} must read cleanup (91.1-05), or cleaned (91.1-05) once the ledger is closed`);
    } else if (!/^V\d+(, V\d+)*$/.test(cells[4])) add(`known finding ${cells[0]} must name its question(s), not "${cells[4]}"`);
    else for (const v of cells[4].split(", ")) if (!questionNs.has(Number(v.slice(1)))) add(`known finding ${cells[0]} cites ${v}, which is not in Value calls`);
  }

  // ---- rulings (all or nothing: once any is recorded every question has one and no row waits)
  const ruledNs = new Set(doc.rulings.map((r) => r.n));
  for (const r of doc.rulings) if (!questionNs.has(r.n)) add(`Rulings records V${r.n}, which is not a question`);
  const dupe = doc.rulings.map((r) => r.n).filter((n, i, a) => a.indexOf(n) !== i);
  for (const n of new Set(dupe)) add(`Rulings records V${n} twice`);
  for (const [name, { cells }] of byEntry) {
    for (const p of cells[5].split("; ")) {
      let m;
      if ((m = /^question \(V(\d+)\)$/.exec(p)) && ruledNs.has(Number(m[1]))) add(`row "${name}" still reads question (V${m[1]}) but V${m[1]} has a ruling`);
      if ((m = /^ruled(?: keep)? \(V(\d+),/.exec(p)) && !ruledNs.has(Number(m[1]))) add(`row "${name}" reads ruled (V${m[1]}) but Rulings records no V${m[1]}`);
    }
  }
  if (doc.rulings.length) for (const q of doc.questions) if (!ruledNs.has(q.n)) add(`Rulings is incomplete: V${q.n} has no ruling`);
  if (doc.rulings.length) for (const q of doc.questions) if (!new RegExp(`^#### V${q.n} .*\\(answered [A-Z]\\)$`).test(`#### V${q.n} ${q.title}`)) add(`question V${q.n} heading must end with (answered <letter>) once rulings are recorded`);

  // ---- build ownership
  const anyRuled = [...byEntry.values()].some(({ cells }) => /ruled \(|built \(|cleanup \(|cleaned \(/.test(cells[5]) && /ruled \(|built \(/.test(cells[5]));
  if (anyRuled) {
    const table = new Set();
    const plans = new Set();
    for (const cells of doc.ownership) {
      if (cells.length !== 2) {
        add(`a Build ownership row has ${cells.length} cells, not 2`);
        continue;
      }
      if (!/^91\.1-0[2-5]$/.test(cells[0])) add(`Build ownership names plan "${cells[0]}", not one of 91.1-02 to 91.1-05`);
      plans.add(cells[0]);
      if (cells[1] === "none") continue;
      for (const item of cells[1].split("; ")) {
        const m = /^(.+?)(?: \(V[\d, V]+\))?$/.exec(item);
        table.add(`${m[1]}|${cells[0]}`);
      }
    }
    for (const p of ["91.1-02", "91.1-03", "91.1-04", "91.1-05"]) if (!plans.has(p)) add(`Build ownership has no row for plan ${p}`);
    for (const k of ownerPairs) if (!table.has(k)) add(`Build ownership is missing ${k.split("|")[0]} under ${k.split("|")[1]}`);
    for (const k of table) if (!ownerPairs.has(k)) add(`Build ownership lists ${k.split("|")[0]} under ${k.split("|")[1]}, which no verdict names`);
  }

  // ---- the close
  if (closed) {
    const stated = /\((\d+) distinct pins\)/.exec(doc.header.Closed || "");
    if (!stated) add('the header has no "**Closed:**" line stating "(N distinct pins)"');
    else if (Number(stated[1]) !== distinctPins(doc).size) add(`the header's Closed line says ${stated[1]} distinct pins, the tables hold ${distinctPins(doc).size}`);
  }
  for (const phase of ["Phase 92"]) if (!doc.findings.includes(phase)) add(`Findings for other phases does not name ${phase}`);
  return problems;
}

const DOC_TEXT = fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n"); // a CRLF checkout reads like the LF one
const DOC = parseDoc(DOC_TEXT);
// the ledger as it stood at the batched checkpoint (open, nothing ruled): the checker-mechanics tests doctor THIS copy, so they
// keep proving every rule after the real doc records the user's rulings
const OPEN_TEXT = fs.readFileSync(path.join(REPO_ROOT, "test", "fixtures", "value-ledger-open.md"), "utf8").replace(/\r\n/g, "\n");
const OPEN_DOC = parseDoc(OPEN_TEXT);

/** doctor(fn) — the real doc, with `fn` applied to its lines (and a finder for an entry's row). */
function doctor(fn, text = OPEN_TEXT) {
  const lines = text.split("\n");
  fn(lines, (name) => lines.findIndex((l) => l.startsWith(`| ${name} |`)));
  return lines.join("\n");
}
const setCell = (line, i, v) => {
  const cells = splitCells(line);
  cells[i] = v;
  return `| ${cells.join(" | ")} |`;
};

/**
 * ruledDoc(text, answers) — a copy of the ledger with every question ruled (default: the recommended option),
 * the verdicts, Rulings and Build ownership written the way plan 91.1-01 Task 4 writes them. The positive
 * tests below prove the checker accepts that shape before the user rules anything.
 */
function ruledDoc(text, answers = {}) {
  const doc = parseDoc(text);
  const date = "2026-10-01";
  const choice = new Map();
  for (const q of doc.questions) {
    const rec = q.options.find((o) => o.rec);
    const letter = answers[q.n] || rec.letter;
    choice.set(q.n, q.options.find((o) => o.letter === letter));
  }
  const owners = { "91.1-02": [], "91.1-03": [], "91.1-04": [], "91.1-05": [] };
  const lines = text.split("\n").map((line) => {
    const hm = /^#### V(\d+) (.+)$/.exec(line);
    if (hm) return `${line} (answered ${choice.get(Number(hm[1])).letter})`;
    if (!line.startsWith("| ")) return line;
    const cells = splitCells(line);
    if (cells.length !== 7 || !/^question \(V/.test(cells[5])) {
      if (cells.length === 7 && /^cleanup \(/.test(cells[5])) owners["91.1-05"].push(cells[0]);
      return line;
    }
    const parts = cells[5].split("; ").map((p) => {
      const n = Number(/V(\d+)/.exec(p)[1]);
      const o = choice.get(n);
      if (o.to === "nothing built") return `ruled keep (V${n}, ${date})`;
      for (const plan of o.to.split(", ")) owners[plan].push(`${cells[0]} (V${n})`);
      return `ruled (V${n}, ${date}) -> ${o.to}`;
    });
    return setCell(line, 5, parts.join("; "));
  });
  let out = lines.join("\n");
  const rulings = doc.questions.map((q) => {
    const o = choice.get(q.n);
    return `- V${q.n} (${date}): recommended default accepted\n  ${o.to === "nothing built" ? "Nothing is built." : `Built by ${o.to}.`}`;
  });
  out = out.replace("## Rulings\n", `## Rulings\n\n${rulings.join("\n")}\n`);
  const ownership = ["| Plan | Rows (question) |", "|---|---|", ...Object.entries(owners).map(([p, rows]) => `| ${p} | ${rows.length ? [...new Set(rows)].join("; ") : "none"} |`)].join("\n");
  out = out.replace(/## Build ownership\n[\s\S]*?(?=\n## Rulings)/, `## Build ownership\n\n${ownership}\n`);
  return out;
}

// ---------------------------------------------------------------------------
// the tests
// ---------------------------------------------------------------------------

const problemsIn = (families) => checkDoc(DOC_TEXT).filter((p) => families.some((f) => f.test(p)));

test("ledger races: docs/VALUE-LEDGER.md passes every coverage, consistency and close rule", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), []);
});

test("ledger races: the doc has its sections and one row per race in RACES order, Human with no systems", () => {
  for (const s of SECTIONS) assert.ok(DOC.h2[s], s);
  assert.deepEqual(DOC.tables["Races"].map((r) => r[0]), RACE_NAMES);
  assert.equal(RACE_NAMES.length, 6);
  const human = DOC.tables["Races"].find((r) => r[0] === "Human");
  assert.match(human[1], /No systems/);
  assert.deepEqual(human.slice(2), ["—", "keep", "—", "ok", "—"]);
  assert.equal(DOC.header.Phase.startsWith("91.1-"), true);
});

test("ledger races: every race row names every footer entry id of the race", () => {
  for (const r of DOC.tables["Races"]) {
    const ids = itemsOf(r[1]).map((i) => i.id);
    for (const e of identityEntries("race", r[0])) assert.ok(ids.includes(e.id), `${r[0]}: ${e.id}`);
  }
});

test("ledger sub-classes: 24 rows, each under its own class heading in CLASSES subs order, every footer entry id present", () => {
  for (const [cls, subs] of Object.entries(SUB_NAMES)) {
    const rows = DOC.tables[`Sub-classes/${cls}`];
    assert.deepEqual(rows.map((r) => r[0]), subs, cls);
    for (const r of rows) {
      const ids = itemsOf(r[1]).map((i) => i.id);
      for (const e of identityEntries("sub", r[0])) assert.ok(ids.includes(e.id), `${r[0]}: ${e.id}`);
    }
  }
  assert.equal(Object.values(SUB_NAMES).flat().length, 24);
});

test("ledger sub-classes: adjacency, a shared system id keeps one row in each identity (race-dmg, chart-never)", () => {
  const dwarf = itemsOf(DOC.tables["Races"].find((r) => r[0] === "Dwarven")[1]).map((i) => i.id);
  const troll = itemsOf(DOC.tables["Races"].find((r) => r[0] === "Troll")[1]).map((i) => i.id);
  assert.ok(dwarf.includes("race-dmg") && troll.includes("race-dmg"));
  const mu = DOC.tables["Sub-classes/Magic User"].filter((r) => itemsOf(r[1]).some((i) => i.id === "chart-never"));
  assert.ok(mu.length >= 6, `chart-never on ${mu.map((r) => r[0]).join(", ")}`);
  assert.equal(new Set(mu.map((r) => r[0])).size, mu.length);
});

test("ledger abilities: rows follow FIGHTER_SKILLS, THIEF_SKILLS, ABILITY_POOL (Fighter, Thief), then Sing, each quoting its live text", () => {
  assert.deepEqual(DOC.tables["Abilities/Skills"].map((r) => r[0]), SKILL_NAMES);
  assert.deepEqual(DOC.tables["Abilities/Level-up abilities"].map((r) => r[0]), LEVELUP_NAMES);
  assert.deepEqual(DOC.tables["Abilities/Class action"].map((r) => r[0]), ["Sing"]);
  assert.equal(SKILL_NAMES.length, 21);
  assert.equal(LEVELUP_NAMES.length, 9);
  for (const [key] of TABLES.filter((t) => t[2] === "ability")) {
    for (const r of DOC.tables[key]) for (const t of liveTexts(r[0])) assert.ok(r[1].includes(t), `${r[0]}: ${t}`);
  }
});

test("ledger abilities: adjacency, Kata and Feint keep their own row and a table skill with its catalog ability is one row", () => {
  const names = SKILL_NAMES;
  for (const a of Object.values(ABILITY_BY_ID).filter((x) => x.source === "table")) {
    assert.equal(names.filter((n) => n === a.name).length, 1, a.name);
    assert.ok(!names.includes(a.id), `no row is named by the catalog id ${a.id}`);
  }
  assert.ok(DOC.tables["Abilities/Skills"].find((r) => r[0] === "Kata")[1].includes("kata-once"));
  assert.ok(DOC.tables["Abilities/Skills"].find((r) => r[0] === "Feint")[1].includes("feint-once"));
});

test("ledger abilities: every once-per-fight ability, skill and first-blow system is flagged once-per-fight and asked (VALUE-03)", () => {
  // Phase 91.1 plan 02a: eight of the eleven came back (V1 to V5), so the live catalog lists three `cd: "fight"` entries;
  // the ledger keeps the flag on all eleven (the question was asked), and each built row now reads built (91.1-02).
  const fight = Object.values(ABILITY_BY_ID).filter((a) => a.cd === "fight").map((a) => a.name);
  assert.deepEqual(fight, ["Death Touch", "Silent Step", "Cutpurse"], "the catalog's cd: fight entries after V1 to V5");
  const askedOnce = ["Kata", "Death Touch", "Second Wind", "Overhead Blow", "Last Stand", "Silent Step", "Feint", "Smoke", "Cutpurse", "Hamstring", "Mark"];
  const flagged = (name) => {
    const row = [...Object.values(DOC.tables)].flat().find((r) => r[0] === name);
    return row && row[2].includes("once-per-fight@");
  };
  for (const n of [...askedOnce, "Sing", "Stealth", "Cat Burglar", "Cutthroat", "Ninja"]) assert.ok(flagged(n), `${n} carries once-per-fight`);
  for (const n of ["Kata", "Second Wind", "Overhead Blow", "Last Stand", "Feint", "Smoke", "Hamstring", "Mark"]) {
    const row = [...Object.values(DOC.tables)].flat().find((r) => r[0] === n);
    assert.match(row[5], /^built \(91\.1-02\)/, `${n} reads built`);
    assert.match(row[6], /test\/unit\/value-abilities\.test\.js: V[1-5] /, `${n} names its value-abilities pin`);
  }
  // the 2026-09-27 ruling: a strike that can one-shot a same-depth foe stays once per fight unless the user rules otherwise,
  // so at the checkpoint (the open copy) every one of them carried the recommendation keep
  for (const n of ["Kata", "Death Touch", "Overhead Blow", "Silent Step", "Feint", "Last Stand"]) {
    const row = [...Object.values(OPEN_DOC.tables)].flat().find((r) => r[0] === n);
    assert.match(row[3], /^keep@/, `${n}: the recommended default keeps it once per fight`);
  }
});

test("ledger abilities: the cross-cutting rows exist; the two cleanup rows were cleanup (91.1-05) at the checkpoint and read cleaned (91.1-05), pinned by value-cleanup.test.js, once closed", () => {
  assert.deepEqual(DOC.tables["Cross-cutting systems"].map((r) => r[0]), CROSS_NAMES);
  const at = (d, name) => d.tables["Cross-cutting systems"].find((r) => r[0] === name);
  // the open copy (the checkpoint): cleanup, no pin, the worklist in the Systems cell
  assert.deepEqual(at(OPEN_DOC, "Inspired chip").slice(2), ["—", "cleanup@inspired-chip", "—", "cleanup (91.1-05)", "—"]);
  assert.deepEqual(at(OPEN_DOC, "Soothed-beasts outcome").slice(2), ["—", "cleanup@soothed-outcome", "—", "cleanup (91.1-05)", "—"]);
  // the live ledger (Phase 91.1 plan 05, 2026-10-01): cleaned and pinned; the worklist the plan worked through is still in the cell
  const inspired = at(DOC, "Inspired chip");
  const soothed = at(DOC, "Soothed-beasts outcome");
  assert.deepEqual(inspired.slice(2, 6), ["—", "cleanup@inspired-chip", "—", "cleaned (91.1-05)"]);
  assert.deepEqual(soothed.slice(2, 6), ["—", "cleanup@soothed-outcome", "—", "cleaned (91.1-05)"]);
  for (const row of [inspired, soothed]) assert.match(row[6], /^test\/unit\/value-cleanup\.test\.js: Cleanup: /);
  for (const f of ["engine/derived.js", "src/browser/conditionEffects.js", "src/browser/heroConditions.js", "mazeworld.html", "docs/ROLL-LEDGER.md"]) assert.ok(inspired[1].includes(f), f);
  for (const f of ["mazeworld.html", "THEY STAND DOWN"]) assert.ok(soothed[1].includes(f), f);
});

test("ledger abilities: encoding, an Entry equals the content name code unit for code unit, and numbers use the minus sign and en dash", () => {
  for (const n of ["Runes/Signs", "Master of Arms", "Con Artist"]) {
    const row = [...Object.values(DOC.tables)].flat().find((r) => r[0] === n);
    assert.ok(row, n);
    assert.equal(row[0].length, n.length);
  }
  const all = Object.values(DOC.tables).flat();
  assert.ok(all.some((r) => r[1].includes("−2")), "a negative modifier uses U+2212");
  assert.ok(all.some((r) => /\d–\d/.test(r[1])), "a range uses U+2013");
  for (const r of all) for (const c of [r[1], r[3]]) assert.ok(!/\d-\d/.test(stripIds(c)) && !/(^|[\s(])-\d/.test(stripIds(c)), `${r[0]}: no ASCII-hyphen number`);
});

test("ledger questions: V1 upward in part order A to H, each with rows, today and exactly one recommended default", () => {
  assert.deepEqual(DOC.parts, PARTS);
  assert.ok(DOC.questions.length >= 15, `questions: ${DOC.questions.length}`);
  assert.deepEqual(DOC.questions.map((q) => q.n), DOC.questions.map((_, i) => i + 1));
  for (const q of DOC.questions) {
    assert.ok(q.rows && q.rows.length, `V${q.n} rows`);
    assert.ok(q.today, `V${q.n} today`);
    assert.equal(q.options.filter((o) => o.rec).length, 1, `V${q.n} recommended default`);
    assert.ok(q.options.length >= 2);
  }
  assert.ok(DOC.questions.filter((q) => q.part === "A").length >= 5, "Part A holds the once-per-fight questions");
});

test("ledger questions: every flagged pair is covered by a question, every question is cited, no question mixes parts", () => {
  assert.deepEqual(problemsIn([/not covered/, /cited by no row/, /belongs in part/, /does not carry/, /does not cite it/]), []);
});

test("ledger questions: a recommended default of keep builds nothing, a building default has a non-keep recommendation", () => {
  assert.deepEqual(problemsIn([/recommended default builds/]), []);
  const building = DOC.questions.filter((q) => !q.options.find((o) => o.rec).to.startsWith("nothing"));
  assert.ok(building.length >= 10, "the batch changes the game in at least ten places");
});

test("ledger findings: K01 to K20 each have a row, an existing entry and a question (K19 and K20 are cleanups)", () => {
  assert.deepEqual(DOC.known.map((r) => r[0]), K_KEYS);
  for (const cells of DOC.known) {
    if (K_CLEANUP.includes(cells[0])) assert.equal(cells[4], DOC.header.Status.startsWith("closed") ? "cleaned (91.1-05)" : "cleanup (91.1-05)");
    else assert.match(cells[4], /^V\d+/);
  }
  assert.deepEqual(problemsIn([/known finding/i]), []);
});

test("ledger rulings: the ledger is open (no rulings yet) or every question is ruled and every ownership row agrees", () => {
  assert.deepEqual(problemsIn([/Rulings/, /Build ownership/, /still reads question/, /reads ruled/, /answered/]), []);
  if (DOC.rulings.length) {
    assert.equal(DOC.rulings.length, DOC.questions.length);
    for (const r of [...Object.values(DOC.tables)].flat()) assert.doesNotMatch(r[5], /^question \(|; question \(/, r[0]);
  }
});

test("ledger close: an open ledger needs no close rules, and a closed one fails while any row is open", () => {
  // Phase 91.1 plan 05: the live ledger is closed, so the open-state half runs on the checkpoint copy
  assert.match(DOC.header.Status, /^closed/, "the live ledger is closed");
  assert.deepEqual(checkDoc(OPEN_TEXT.replace("**Status:** open", "**Status:** open")).filter((p) => /Closed:|still open|GAP: item/.test(p)), [], "an open ledger is not held to the close rules");
  const closedEarly = OPEN_TEXT.replace(/\*\*Status:\*\* open/, "**Status:** closed");
  assert.ok(checkDoc(closedEarly).some((p) => /still open|no "\*\*Closed:\*\*"|Closed:/.test(p)), "a closed ledger with open verdicts fails");
  assert.ok(checkDoc(DOC_TEXT.replace("**Status:** closed", "**Status:** sort of")).some((p) => /Status line must start with open or closed/.test(p)));
});

test("ledger close: the closed ledger states its date and plan, every built and cleaned row is pinned, and no Systems cell reads GAP", () => {
  assert.match(DOC.header.Closed, /^2026-10-01 \(plan 91\.1-05\): /);
  const rows = Object.values(DOC.tables).flat();
  for (const r of rows) {
    assert.doesNotMatch(r[1], /GAP:/, r[0]);
    assert.doesNotMatch(r[5], /question \(|ruled \(|^cleanup /, r[0]);
    if (/built \(|cleaned \(/.test(r[5])) assert.match(r[6], /^test\/unit\/[A-Za-z0-9_.-]+\.test\.js: \S/, `${r[0]} is built or cleaned and names a titled pin`);
  }
  // every former GAP item is a flagged gap or joiner-gap item that reads accepted or fixed, never GAP
  const accepted = rows.filter((r) => /accepted: /.test(r[1])).length;
  assert.ok(accepted >= 20, `accepted gap items: ${accepted}`);
  assert.deepEqual(problemsIn([/GAP/, /accepted/, /fixed in/, /pin/i]), []);
  assert.match(DOC.findings, /Phase 92/);
});

// ---- the doctored-doc tests: the checker must fail each broken copy -----------------------------------

test("ledger races: the checker fails a missing row, a duplicate row, a swapped pair and an empty cell", () => {
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Dwarven"), 1))).some((p) => /missing a row for "Dwarven"/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => c.splice(at("Dwarven"), 0, c[at("Dwarven")]))).some((p) => /duplicate row "Dwarven"/.test(p)));
  const swapped = doctor((c, at) => {
    const a = at("Elven");
    [c[a], c[a + 1]] = [c[a + 1], c[a]];
  });
  assert.ok(checkDoc(swapped).some((p) => /out of order/.test(p)));
  const empty = doctor((c, at) => (c[at("Troll")] = setCell(c[at("Troll")], 3, "")));
  assert.ok(checkDoc(empty).some((p) => /empty Recommendation cell/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Kata")] = setCell(c[at("Kata")], 1, "")))).some((p) => /empty Systems cell/.test(p)));
});

test("ledger sub-classes: the checker fails an unknown flag, a flagged row with no Q, a flag with no recommendation and an unknown token", () => {
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("no-value@knight-small", "meh@knight-small")))).some((p) => /unknown flag "meh"/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = setCell(c[at("Knight")], 4, "—")))).some((p) => /flagged but its Q cell/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = setCell(c[at("Knight")], 3, "keep")))).some((p) => /1 flagged system\(s\) but 0 recommendation/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("buff@knight-small", "fix@knight-small")))).some((p) => /unknown recommendation/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("buff@knight-small", "buff@guard-hard")))).some((p) => /no matching recommendation/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("no-value@knight-small", "no-value@made-up-id")))).some((p) => /not a backticked item/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("question (V21)", "meh (V21)")))).some((p) => /unknown verdict part/.test(p)));
});

test("ledger abilities: the checker fails a stale live text, an ASCII-hyphen range and an unflagged row that does not read keep", () => {
  assert.ok(checkDoc(doctor((c, at) => (c[at("Kata")] = c[at("Kata")].replace("+3 to hit on this strike", "+4 to hit on this strike")))).some((p) => /not the live text/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Sewing")] = c[at("Sewing")].replace("4 patches in all", "4-6 patches in all")))).some((p) => /ASCII hyphen/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Guard")] = setCell(c[at("Guard")], 3, "buff@guard-hard: more")))).some((p) => /unflagged but its recommendation is not keep/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Sidestep")] = setCell(c[at("Sidestep")], 5, "question (V1)")))).some((p) => /unflagged but its verdict is not ok/.test(p)));
  assert.ok(checkDoc(doctor((c, at) => (c[at("Dwarven")] = c[at("Dwarven")].replace("race-dmg", "race-dmg-gone")))).some((p) => /no Systems item for the footer entry `race-dmg`|not a backticked item/.test(p)));
});

test("ledger questions: the checker fails a question no row cites, a flagged pair no question covers and a question in the wrong part", () => {
  const dropV = doctor((c) => {
    const i = c.findIndex((l) => /^#### V4 /.test(l));
    const j = c.findIndex((l, k) => k > i && /^#### V5 /.test(l));
    c.splice(i, j - i);
  });
  assert.ok(checkDoc(dropV).some((p) => /not covered by any question|numbers must run V1/.test(p)));
  // a question that no row cites: its only row's Q cell now points elsewhere
  const uncited = doctor((c, at) => (c[at("Smoke")] = setCell(c[at("Smoke")], 4, "V99")));
  assert.ok(checkDoc(uncited).some((p) => /question V4 is cited by no row/.test(p)));
  const noPair = doctor((c) => {
    const i = c.findIndex((l) => /^\*\*Rows:\*\* Smoke \(once-per-fight@smoke-once\)$/.test(l));
    c[i] = "**Rows:** Sidestep (once-per-fight@sidestep-shift)";
  });
  assert.ok(checkDoc(noPair).some((p) => /which that row does not carry/.test(p) && /not covered by any question|which that row does not carry/.test(p)));
  const wrongPart = doctor((c) => {
    const i = c.findIndex((l) => /^### Part A /.test(l));
    c[i] = c[i].replace("Part A", "Part B");
  });
  assert.ok(checkDoc(wrongPart).some((p) => /must have parts|out of part order|belongs in part/.test(p)));
  const twoDefaults = doctor((c) => {
    const i = c.findIndex((l) => /^- \*\*B: Both are ready again 4 rounds/.test(l));
    c[i] = c[i].replace("- **B:", "- **B (recommended default):");
  });
  assert.ok(checkDoc(twoDefaults).some((p) => /exactly one option/.test(p)));
  const badDefault = doctor((c, at) => (c[at("Knight")] = c[at("Knight")].replace("buff@knight-small: under 5 -> under 10 hit points", "keep@knight-small: stays"))); // default still builds
  assert.ok(checkDoc(badDefault).some((p) => /every covered row recommends keep/.test(p)));
});

test("ledger findings: the checker fails a missing known finding, an unknown row in a finding and a finding with no question", () => {
  assert.ok(checkDoc(doctor((c) => c.splice(c.findIndex((l) => l.startsWith("| K07 |")), 1))).some((p) => /missing known finding K07/.test(p)));
  assert.ok(checkDoc(doctor((c) => { const i = c.findIndex((l) => l.startsWith("| K09 |")); c[i] = c[i].replace("Walking Dead fixation, Bard", "Walking Dead fixation, Bardy"); })).some((p) => /names "Bardy"/.test(p)));
  assert.ok(checkDoc(doctor((c) => { const i = c.findIndex((l) => l.startsWith("| K10 |")); c[i] = setCell(c[i], 4, "cleanup (91.1-05)"); })).some((p) => /K10 must name its question/.test(p)));
  assert.ok(checkDoc(doctor((c) => { const i = c.findIndex((l) => l.startsWith("| K19 |")); c[i] = setCell(c[i], 4, "V1"); })).some((p) => /K19 must read cleanup/.test(p)));
});

test("ledger rulings: a fully ruled copy (every default accepted) passes, and the same copy with a wrong ownership table fails", () => {
  const ruled = ruledDoc(OPEN_TEXT);
  assert.deepEqual(checkDoc(ruled), []);
  const building = DOC.questions.filter((q) => !q.options.find((o) => o.rec).to.startsWith("nothing"));
  assert.ok(building.length > 0);
  const off = ruled.replace(/\| 91\.1-02 \| [^|]+\|/, "| 91.1-02 | none |");
  assert.ok(checkDoc(off).some((p) => /Build ownership is missing/.test(p)), "an ownership table that drops a row fails");
  const extra = ruled.replace(/\| 91\.1-05 \| ([^|]+)\|/, "| 91.1-05 | $1; Kata (V1) |");
  assert.ok(checkDoc(extra).some((p) => /Build ownership lists Kata under 91\.1-05/.test(p)));
});

test("ledger rulings: a ruled question left as question, a ruling for an unknown question and a missing ruling all fail", () => {
  const ruled = ruledDoc(OPEN_TEXT);
  const left = ruled.replace(/\| ruled keep \(V1, 2026-10-01\)/, "| question (V1)");
  assert.ok(checkDoc(left).some((p) => /still reads question \(V1\)/.test(p)));
  assert.ok(checkDoc(ruled.replace("## Rulings\n", "## Rulings\n\n- V99 (2026-10-01): doctored.\n")).some((p) => /V99, which is not a question/.test(p)));
  const missing = ruled.replace(/^- V3 \(2026-10-01\): .*\n.*\n/m, "");
  assert.ok(checkDoc(missing).some((p) => /V3 has no ruling|reads ruled \(V3/.test(p)));
});

test("ledger rulings: a user answer other than the default is carried through (V3 B builds 91.1-02, V3 A builds nothing)", () => {
  // the rows follow the chosen option once ruled: Second Wind goes back to keep
  const a = ruledDoc(OPEN_TEXT, { 3: "A" }).replace(/allow more uses@second-wind-once: [^|;]+/, "keep@second-wind-once: stays once per fight");
  assert.deepEqual(checkDoc(a), []);
  assert.match(a, /\| Second Wind \|[^\n]*ruled keep \(V3, 2026-10-01\)/);
  const b = ruledDoc(OPEN_TEXT, { 3: "B" });
  assert.deepEqual(checkDoc(b), []);
  assert.match(b, /\| Second Wind \|[^\n]*ruled \(V3, 2026-10-01\) -> 91\.1-02/);
});

test("ledger close: a closed copy is held to the close rules (no open verdict, no GAP item, built rows pinned, a true pin count)", () => {
  const ruled = ruledDoc(OPEN_TEXT).replace("**Status:** open", "**Status:** closed");
  const problems = checkDoc(ruled);
  assert.ok(problems.some((p) => /is still open/.test(p)), "a ruled-but-not-built row is still open");
  assert.ok(problems.some((p) => /still has a GAP: item/.test(p)), "a GAP item must read exists or accepted when closed");
  assert.ok(problems.some((p) => /Closed:/.test(p)), "the Closed line states the pin count");
  assert.ok(checkDoc(OPEN_TEXT.replace("**Status:** open", "**Status:** closed")).some((p) => /still open/.test(p)));
});

// ---- Phase 91.1 plan 05: the doctored CLOSED ledger. The checker must fail each way a closed ledger can be wrong. -----

const closedDoctor = (fn) => doctor(fn, DOC_TEXT);

test("ledger close: a doctored closed ledger fails on an open verdict part, a leftover cleanup, a GAP item and a gap item that is neither accepted nor fixed", () => {
  assert.deepEqual(checkDoc(DOC_TEXT), [], "the live closed ledger is clean");
  // a question or ruled part left in a verdict
  const open = closedDoctor((c, at) => (c[at("Knight")] = setCell(c[at("Knight")], 5, "question (V21)")));
  assert.ok(checkDoc(open).some((p) => /row "Knight" is still open/.test(p)));
  const ruled = closedDoctor((c, at) => (c[at("Kata")] = setCell(c[at("Kata")], 5, "ruled (V1, 2026-10-01) -> 91.1-02")));
  assert.ok(checkDoc(ruled).some((p) => /row "Kata" is still open/.test(p)));
  // a cleanup that is not cleaned (and a cleaned row with no pin)
  const cleanup = closedDoctor((c, at) => (c[at("Inspired chip")] = setCell(setCell(c[at("Inspired chip")], 5, "cleanup (91.1-05)"), 6, "—")));
  assert.ok(checkDoc(cleanup).some((p) => /Inspired chip/.test(p) && /still a cleanup/.test(p)));
  const unpinnedClean = closedDoctor((c, at) => (c[at("Soothed-beasts outcome")] = setCell(c[at("Soothed-beasts outcome")], 6, "—")));
  assert.ok(checkDoc(unpinnedClean).some((p) => /Soothed-beasts outcome/.test(p) && /not pinned|titled/.test(p)));
  // the K cleanup cells read cleaned once closed
  const kOpen = closedDoctor((c) => { const i = c.findIndex((l) => l.startsWith("| K19 |")); c[i] = setCell(c[i], 4, "cleanup (91.1-05)"); });
  assert.ok(checkDoc(kOpen).some((p) => /K19 must read/.test(p)));
  // a GAP item back in a Systems cell
  const gap = closedDoctor((c, at) => (c[at("Fridgian")] = c[at("Fridgian")].replace("accepted: a Joiner Fridgian never frenzies", "GAP: a Joiner Fridgian never frenzies")));
  assert.ok(checkDoc(gap).some((p) => /row "Fridgian" still has a GAP: item/.test(p)));
  // a gap flag whose item reads neither accepted nor fixed, and one that forgets the question that covers it
  const neither = closedDoctor((c, at) => (c[at("Barbarian")] = c[at("Barbarian")].replace("accepted: a Joiner Barbarian swings once (hero only, K12) (V33)", "a Joiner Barbarian swings once (hero only, K12)")));
  assert.ok(checkDoc(neither).some((p) => /row "Barbarian": joiner-gap@barbarian-two reads neither/.test(p)));
  const noQ = closedDoctor((c, at) => (c[at("Barbarian")] = c[at("Barbarian")].replace("(hero only, K12) (V33)", "(hero only, K12) (V34)")));
  assert.ok(checkDoc(noQ).some((p) => /row "Barbarian": the closed item .barbarian-two. does not name V33/.test(p)));
});

test("ledger close: a doctored closed ledger fails on a stale Closed count, a missing Closed line, a built row with no pin or a pin whose test is gone", () => {
  const stale = DOC_TEXT.replace(/\((\d+) distinct pins\)/, (_, n) => `(${Number(n) + 1} distinct pins)`);
  assert.ok(checkDoc(stale).some((p) => /Closed line says \d+ distinct pins, the tables hold \d+/.test(p)));
  const missing = DOC_TEXT.split("\n").filter((l) => !l.startsWith("**Closed:**")).join("\n");
  assert.ok(checkDoc(missing).some((p) => /no "\*\*Closed:\*\*" line/.test(p)));
  const unpinned = closedDoctor((c, at) => (c[at("Kata")] = setCell(c[at("Kata")], 6, "—")));
  assert.ok(checkDoc(unpinned).some((p) => /row "Kata" is built but not pinned/.test(p)));
  const fileOnly = closedDoctor((c, at) => (c[at("Kata")] = setCell(c[at("Kata")], 6, "test/unit/value-abilities.test.js")));
  assert.ok(checkDoc(fileOnly).some((p) => /row "Kata": pinned by file only/.test(p)));
  const gone = closedDoctor((c, at) => (c[at("Kata")] = setCell(c[at("Kata")], 6, "test/unit/value-abilities.test.js: V1 Kata: a title nobody wrote")));
  assert.ok(checkDoc(gone).some((p) => /row "Kata": pin .* names a test title that is not in the file/.test(p)));
  const missingFile = closedDoctor((c, at) => (c[at("Cutthroat")] = setCell(c[at("Cutthroat")], 6, "test/unit/no-such-file.test.js: V26 Cutthroat")));
  assert.ok(checkDoc(missingFile).some((p) => /row "Cutthroat": is pinned by "test\/unit\/no-such-file\.test\.js", which does not exist/.test(p)));
  // Findings for other phases must still name Phase 92
  const noHandoff = DOC_TEXT.replace(/Phase 92/g, "a later phase");
  assert.ok(checkDoc(noHandoff).some((p) => /does not name Phase 92/.test(p)));
});

test("ledger rulings: the user's rulings of 2026-10-01 are recorded as given (V27 B after the Cloaker change, Joiner parity skipped)", () => {
  const A = new Set([6, 21, 22, 23, 24, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37]);
  assert.equal(DOC.rulings.length, 37);
  for (const q of DOC.questions) {
    const letter = A.has(q.n) ? "A" : "B";
    assert.match(q.title, new RegExp(`\\(answered ${letter}\\)$`), `V${q.n}`);
  }
  const cloaker = DOC.tables["Sub-classes/Thief"].find((r) => r[0] === "Cloaker");
  // 91.1-03 part B (2026-10-01) built V27: the row's verdict moved from "ruled (V27, 2026-10-01) -> 91.1-03" to built.
  assert.match(cloaker[5], /^built \(91\.1-03\)$/);
  assert.match(DOC.rulings.find((r) => r.n === 27).text, /Cloaker ability should work on specter, too/);
  // 91.1-04 (Joiner parity) owns nothing, 91.1-05 owns the text-only ruling and the two cleanups
  const row = (p) => DOC.ownership.find((r) => r[0] === p)[1];
  assert.equal(row("91.1-04"), "none");
  assert.match(row("91.1-05"), /Cutthroat \(V26\); Ninja \(V26\); Inspired chip; Soothed-beasts outcome/);
  for (const v of ["V7", "V15", "V16", "V17", "V18", "V19", "V20", "V25", "V27"]) assert.ok(row("91.1-03").includes(v), v);
  for (const v of ["V1", "V2", "V3", "V4", "V5", "V8", "V9", "V10", "V11", "V12", "V13", "V14"]) assert.ok(row("91.1-02").includes(v), v);
});
