// test/unit/identity-audit.test.js
//
// Phase 91 (IDENT-11, IDENT-12; plan 91-01) — the coverage and consistency
// test for docs/IDENTITY-AUDIT.md, the race and sub-class audit table. It
// parses every `###` identity section under `## Races` and `## Sub-classes`
// and checks it against the live footer data (`identityEntries`), so the doc
// can never silently lose a trait, double a trait, or leave a cell empty:
//
//   - the race sections equal Object.keys(RACES) in order and the sub-class
//     sections equal the CLASSES subs in order (Magic User, Fighter, Thief);
//   - every identityEntries id of an identity has exactly one row, and the
//     rows open in identityEntries order (authored first, then generated);
//     after them come the `unstated:` rows (an engine rule no trait states),
//     then the pre-registered rows (a trait a Phase 91 plan will add, or a
//     trait its owner plan removes). A row id that is not a live id is allowed
//     only with a `fix`, `ruled`, `retire` or `retired` verdict or an
//     `unstated:` prefix;
//   - no Trait, Side, Text, Engine, Canon, Verdict or Pinned by cell is empty,
//     every row has all seven cells, and a live row's Side is the entry's side;
//   - every Verdict part is one of the accepted tokens, and every owner
//     `(91-NN)` names a plan 01 to 10 of this phase;
//   - Human has exactly one row, its neutral line, and no good or bad;
//   - every Magic User sub-class has a school-limits row (a Trait that starts
//     with `chart-never` or `chart-gate`, or is `school-limits`);
//   - a `balance call (Qn)` row needs a `### Qn` question that has no ruling
//     yet, and a ruled Qn (a `- Qn (` line under Rulings) has no
//     `balance call (Qn)` row left;
//   - a `match` row never carries a cell that admits a gap ("not stated",
//     "not printed", "omits"): a mismatch is fixed or ruled, never waved
//     through (IDENT-12's prohibition).
//
// Edge coverage (the IDENT-11 / IDENT-12 fallback probes):
//   - adjacency: identities that share an engine rule keep their own row (the
//     Bard and the Court Mage both always parley Humans, the Elven and
//     Dwarven prices, the Samurai and the Master of Arms never leaving a
//     fight), and one identity's authored trait and a generated line with the
//     same id are ONE row, never two; the checker is run on a doctored copy
//     with a duplicated row and must fail it;
//   - empty: Human has exactly its neutral row; an identity with no authored
//     bad today (the Cleric) still shows its generated and pre-registered
//     rows; a trait the blurb says nothing about has Text "not stated" or the
//     footer line, never a blank cell; the checker must fail a doctored empty
//     cell;
//   - ordering: races in RACES key order, sub-classes in CLASSES order, rows
//     in identityEntries order, then unstated, then pre-registered, so a
//     regenerated table is stable; the checker must fail a doctored swap of
//     two rows.
//
// The doc is text and the test only reads it (plus content and the pure
// identityEntries list); no engine, rng or shell state runs. The doc is read
// with CRLF normalised (the main checkout keeps CRLF on disk).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { RACES, CLASSES } from "../../content/index.js";
import { identityEntries } from "../../src/browser/identityFooter.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DOC_PATH = path.join(REPO_ROOT, "docs", "IDENTITY-AUDIT.md");

const RACE_KEYS = Object.keys(RACES);
const SUB_KEYS = Object.values(CLASSES).flatMap((cls) => cls.subs);
const MU_SUBS = CLASSES["Magic User"].subs;

const HEADER = ["Trait", "Side", "Text", "Engine", "Canon", "Verdict", "Pinned by"];
const SIDES = new Set(["good", "bad", "neutral"]);

/** OWNERS — one or more plan numbers of this phase: "91-08" or "91-08, 91-10". */
const OWNERS = "91-\\d\\d(?:, 91-\\d\\d)*";

/** VERDICT_TOKENS — the accepted verdict parts (each must match whole). */
const VERDICT_TOKENS = [
  /^match$/,
  new RegExp(`^(?:fix|fixed) (?:engine|text) \\(${OWNERS}\\)$`),
  /^balance call \(Q\d+\)$/,
  new RegExp(`^ruled \\(\\d{4}-\\d{2}-\\d{2}\\) -> ${OWNERS}(?: - .+)?$`),
  new RegExp(`^ruled \\(Q\\d+, \\d{4}-\\d{2}-\\d{2}\\) -> ${OWNERS}(?: - .+)?$`),
  /^(?:retire|retired) \(91-\d\d\)$/,
];

/** The rows a Phase 91 plan adds or removes, pre-registered by this audit. */
const PRE_REGISTERED = [
  // Phase 91 plan 02 built wizard-day-one and cleric-heal-start (IDENT-13, IDENT-15):
  // both are live identityEntries now, so they left this list and sit in their
  // identity's authored-then-generated order with a fixed verdict.
  // Phase 91 plan 03 stated illusionist-book as a trait (IDENT-14 and the Phase 90
  // starting-book ruling): it is a live identityEntries id now, so it left this list
  // and sits in the Illusionist's authored order with the verdict fixed text (91-03).
  ["sub", "Master of Arms", "moa-never-leaves", /^ruled \(2026-09-30\) -> 91-05/],
  ["sub", "Pickpocket", "pickpocket-item", /^ruled \(2026-09-30\) -> 91-08/],
  ["sub", "Master of Arms", "moa-withdraw", /^(retire|retired) \(91-05\)$/],
  ["race", "Troll", "troll-weapons", /^(retire|retired) \(91-08\)$/],
];

const GAP_WORDS = /not stated|not printed|omits/i;

/** readDoc() — the audit doc with CRLF normalised. */
function readDoc() {
  return fs.readFileSync(DOC_PATH, "utf8").replace(/\r\n/g, "\n");
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
  const out = { sections: { race: [], sub: [] }, questions: [], rulings: [], haveSections: {} };
  let h2 = null;
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^## /.test(line)) {
      h2 = line.slice(3).trim();
      out.haveSections[h2] = true;
      current = null;
      continue;
    }
    if (/^### /.test(line)) {
      const h3 = line.slice(4).trim();
      if (h2 === "Races") {
        current = { kind: "race", name: h3, rows: [] };
        out.sections.race.push(current);
      } else if (h2 === "Sub-classes") {
        current = { kind: "sub", name: h3, rows: [] };
        out.sections.sub.push(current);
      } else if (h2 === "Balance calls") {
        const m = h3.match(/^Q(\d+)\b/);
        if (m) out.questions.push(Number(m[1]));
      }
      continue;
    }
    if (current && line.startsWith("|")) {
      const cells = splitCells(line);
      if (cells[0] === HEADER[0] || /^-+$/.test(cells[0].replace(/\s/g, ""))) continue;
      current.rows.push(cells);
    } else if (h2 === "Rulings") {
      const m = line.match(/^- Q(\d+) \(/);
      if (m) out.rulings.push(Number(m[1]));
    }
  }
  return out;
}

/** verdictParts(cell) — the "; "-joined parts of a Verdict cell. */
function verdictParts(cell) {
  return cell.split("; ").map((p) => p.trim());
}

/** checkDoc(text) — every problem the coverage rules find, as strings. */
function checkDoc(text) {
  const problems = [];
  const doc = parseDoc(text);
  const add = (msg) => problems.push(msg);

  for (const s of ["How to read this table", "Races", "Sub-classes", "Findings for other phases", "Balance calls", "Rulings"]) {
    if (!doc.haveSections[s]) add(`missing section "## ${s}"`);
  }

  const raceNames = doc.sections.race.map((s) => s.name);
  if (JSON.stringify(raceNames) !== JSON.stringify(RACE_KEYS)) {
    add(`race sections out of order or missing: got [${raceNames.join(", ")}], want [${RACE_KEYS.join(", ")}]`);
  }
  const subNames = doc.sections.sub.map((s) => s.name);
  if (JSON.stringify(subNames) !== JSON.stringify(SUB_KEYS)) {
    add(`sub-class sections out of order or missing: got [${subNames.join(", ")}]`);
  }

  const ruledQs = new Set(doc.rulings);
  const openQs = new Set();
  const doneQs = new Set();

  for (const section of [...doc.sections.race, ...doc.sections.sub]) {
    const where = `${section.kind} ${section.name}`;
    const entries = identityEntries(section.kind, section.name);
    const live = entries.map((e) => e.id);
    const sideOf = Object.fromEntries(entries.map((e) => [e.id, e.side]));
    const rows = section.rows;
    if (rows.length < 1) add(`${where}: no rows`);

    const ids = rows.map((r) => r[0]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) add(`${where}: duplicate row "${id}"`);
      seen.add(id);
    }

    // coverage and order: the live ids first, in identityEntries order
    for (const id of live) {
      if (!ids.includes(id)) add(`${where}: no row for the live entry "${id}"`);
    }
    const prefix = ids.slice(0, live.length);
    if (live.every((id) => ids.includes(id)) && JSON.stringify(prefix) !== JSON.stringify(live)) {
      add(`${where}: rows are out of identityEntries order (want [${live.join(", ")}] first, got [${prefix.join(", ")}])`);
    }

    // after the live rows: unstated rows, then pre-registered rows
    const rest = ids.filter((id) => !live.includes(id));
    let sawOther = false;
    for (const id of rest) {
      if (id.startsWith("unstated:")) {
        if (sawOther) add(`${where}: unstated row "${id}" comes after a pre-registered row`);
      } else sawOther = true;
    }

    for (const cells of rows) {
      if (cells.length !== HEADER.length) {
        add(`${where}: row "${cells[0]}" has ${cells.length} cells, not ${HEADER.length}`);
        continue;
      }
      const [trait, side, textCell, engine, canon, verdict, pinned] = cells;
      for (let i = 0; i < HEADER.length; i++) {
        if (!cells[i]) add(`${where}: row "${trait}" has an empty ${HEADER[i]} cell`);
      }
      if (side && !SIDES.has(side)) add(`${where}: row "${trait}" has an unknown side "${side}"`);
      if (live.includes(trait) && side !== sideOf[trait]) add(`${where}: row "${trait}" says side ${side}, the footer says ${sideOf[trait]}`);

      const parts = verdict ? verdictParts(verdict) : [];
      for (const part of parts) {
        if (!VERDICT_TOKENS.some((re) => re.test(part))) add(`${where}: row "${trait}" has an unknown verdict part "${part}"`);
        const open = part.match(/^balance call \(Q(\d+)\)$/);
        if (open) openQs.add(Number(open[1]));
        const done = part.match(/^ruled \(Q(\d+),/);
        if (done) doneQs.add(Number(done[1]));
      }
      for (const m of verdict.matchAll(/\b91-(\d\d)\b/g)) {
        const n = Number(m[1]);
        if (n < 1 || n > 10) add(`${where}: row "${trait}" names owner 91-${m[1]}, not a Phase 91 plan`);
      }
      if (parts.includes("match") && parts.length > 1) add(`${where}: row "${trait}" mixes match with another verdict`);
      if (verdict === "match" && cells.some((c) => GAP_WORDS.test(c))) add(`${where}: row "${trait}" reads match but a cell admits a gap`);

      // a row that is not a live entry must be unstated, or owned by a plan
      if (!live.includes(trait) && !trait.startsWith("unstated:")) {
        const owned = parts.length > 0 && parts.every((p) => /^(?:fix|fixed|ruled|retire|retired)\b/.test(p));
        if (!owned) add(`${where}: row "${trait}" is not a live entry and its verdict "${verdict}" is not a fix, ruled, retire or retired verdict`);
      }
      void textCell;
      void engine;
      void canon;
      void pinned;
    }

    // Human: exactly the neutral row
    if (section.kind === "race" && section.name === "Human") {
      if (ids.length !== 1 || ids[0] !== "human-neutral") add(`Human: must have exactly the one row "human-neutral", got [${ids.join(", ")}]`);
      else if (rows[0][1] !== "neutral") add("Human: its one row must be neutral, never good or bad");
    }

    // every Magic User sub-class names its school limits
    if (section.kind === "sub" && MU_SUBS.includes(section.name)) {
      if (!ids.some((id) => id.startsWith("chart-never") || id.startsWith("chart-gate") || id === "school-limits")) {
        add(`${where}: no school-limits row (chart-never, chart-gate-<school> or school-limits)`);
      }
    }
  }

  // balance calls versus rulings
  for (const q of openQs) {
    if (ruledQs.has(q)) add(`Q${q} has a ruling but a row still reads balance call (Q${q})`);
    if (!doc.questions.includes(q)) add(`a row reads balance call (Q${q}) but there is no "### Q${q}" question under Balance calls`);
  }
  for (const q of doneQs) {
    if (!ruledQs.has(q)) add(`a row reads ruled (Q${q}, ...) but Rulings has no "- Q${q} (" entry`);
  }

  // the pre-registered rows exist with their owners
  for (const [kind, name, id, re] of PRE_REGISTERED) {
    const section = doc.sections[kind].find((s) => s.name === name);
    const row = section && section.rows.find((r) => r[0] === id);
    if (!row) {
      add(`${kind} ${name}: the pre-registered row "${id}" is missing`);
    } else if (!re.test(row[5])) {
      add(`${kind} ${name}: row "${id}" has verdict "${row[5]}", want ${re}`);
    }
  }

  return problems;
}

/** mutate(text, fn) — the doc split into lines, edited, rejoined. */
function mutate(text, fn) {
  const lines = text.split("\n");
  fn(lines);
  return lines.join("\n");
}

/** rowIndex(lines, id, from) — the line index of the table row whose Trait is `id` at or after `from`. */
function rowIndex(lines, id, from = 0) {
  const needle = `| ${id} |`;
  for (let i = from; i < lines.length; i++) if (lines[i].startsWith(needle)) return i;
  return -1;
}

/** sectionStart(lines, heading) — the line index of a `### heading`. */
function sectionStart(lines, heading) {
  return lines.findIndex((l) => l === `### ${heading}`);
}

// ─── the live doc ───────────────────────────────────────────────────────

test("IDENT-11: docs/IDENTITY-AUDIT.md covers every race and sub-class trait and passes every rule", () => {
  const problems = checkDoc(readDoc());
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("IDENT-11: 6 race sections in RACES order and 24 sub-class sections in CLASSES order", () => {
  const doc = parseDoc(readDoc());
  assert.deepEqual(doc.sections.race.map((s) => s.name), RACE_KEYS);
  assert.equal(RACE_KEYS.length, 6);
  assert.deepEqual(doc.sections.sub.map((s) => s.name), SUB_KEYS);
  assert.equal(SUB_KEYS.length, 24);
  assert.deepEqual(SUB_KEYS.slice(0, 8), CLASSES["Magic User"].subs, "the Magic User subs come first");
  assert.deepEqual(SUB_KEYS.slice(8, 16), CLASSES.Fighter.subs, "then the Fighter subs");
  assert.deepEqual(SUB_KEYS.slice(16), CLASSES.Thief.subs, "then the Thief subs");
});

test("IDENT-11: every identityEntries id of every identity has exactly one row, in order", () => {
  const doc = parseDoc(readDoc());
  for (const section of [...doc.sections.race, ...doc.sections.sub]) {
    const live = identityEntries(section.kind, section.name).map((e) => e.id);
    const ids = section.rows.map((r) => r[0]);
    assert.deepEqual(ids.slice(0, live.length), live, `${section.name}: the rows open in identityEntries order`);
    for (const id of live) assert.equal(ids.filter((x) => x === id).length, 1, `${section.name}: exactly one row for ${id}`);
  }
});

test("IDENT-11 edge (adjacency): identities that share an engine rule keep their own row; an authored trait and a generated line with one id are one row", () => {
  const doc = parseDoc(readDoc());
  const row = (kind, name, id) => doc.sections[kind].find((s) => s.name === name).rows.find((r) => r[0] === id);
  // the Bard and the Court Mage both always parley Humans
  assert.ok(row("sub", "Bard", "bard-humans"), "the Bard keeps its own parley row");
  assert.ok(row("sub", "Court Mage", "court-mage-humans"), "the Court Mage keeps its own parley row");
  // the Elven and Dwarven prices
  assert.ok(row("race", "Elven", "elven-prices") && row("race", "Dwarven", "dwarven-prices"), "the Elven and Dwarven prices keep their own rows");
  // the Samurai and the Master of Arms never leaving a fight
  assert.ok(row("sub", "Samurai", "samurai-never"), "the Samurai keeps its own never-flee row");
  assert.ok(row("sub", "Master of Arms", "moa-never-leaves"), "the Master of Arms keeps its own never-leaves row");
  // one id in the authored list and in the generated list is ONE entry
  for (const [kind, key] of [...RACE_KEYS.map((k) => ["race", k]), ...SUB_KEYS.map((k) => ["sub", k])]) {
    const ids = identityEntries(kind, key).map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${key}: identityEntries never lists an id twice`);
  }
});

test("IDENT-11 edge (empty): Human has exactly its neutral row; an identity with no authored bad (the Cleric) still shows its generated and pre-registered rows", () => {
  const doc = parseDoc(readDoc());
  const human = doc.sections.race.find((s) => s.name === "Human");
  assert.deepEqual(human.rows.map((r) => r[0]), ["human-neutral"]);
  assert.equal(human.rows[0][1], "neutral");
  const cleric = doc.sections.sub.find((s) => s.name === "Cleric");
  const clericIds = cleric.rows.map((r) => r[0]);
  for (const id of ["chart-gate-divination", "chart-never", "cleric-heal-start"]) assert.ok(clericIds.includes(id), `the Cleric's section has ${id}`);
  // a trait the blurb says nothing about never has a blank Text cell
  for (const section of [...doc.sections.race, ...doc.sections.sub]) {
    for (const r of section.rows) assert.ok(r[2].length > 0, `${section.name}/${r[0]}: Text is never blank`);
  }
});

test("IDENT-11: the pre-registered rows exist with their owner plans, and every Magic User section names its school limits", () => {
  const problems = checkDoc(readDoc()).filter((p) => /pre-registered|school-limits/.test(p));
  assert.deepEqual(problems, []);
  const doc = parseDoc(readDoc());
  for (const sub of MU_SUBS) {
    const section = doc.sections.sub.find((s) => s.name === sub);
    assert.ok(section.rows.some((r) => /^chart-(never|gate)|^school-limits$/.test(r[0])), `${sub} has a school-limits row`);
  }
});

// ─── the checker, run on doctored copies ────────────────────────────────

test("IDENT-12: the checker fails a missing identity section", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = sectionStart(lines, "Pilfer");
    assert.ok(i >= 0);
    lines[i] = "### Pilferr";
  });
  assert.ok(checkDoc(bad).some((p) => /sub-class sections out of order or missing/.test(p)));
});

test("IDENT-12: the checker fails a live footer entry with no row", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "wizard-melee");
    assert.ok(i >= 0);
    lines.splice(i, 1);
  });
  assert.ok(checkDoc(bad).some((p) => /no row for the live entry "wizard-melee"/.test(p)));
});

test("IDENT-12 edge (adjacency): the checker fails a duplicated row", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "bard-camp");
    assert.ok(i >= 0);
    lines.splice(i, 0, lines[i]);
  });
  assert.ok(checkDoc(bad).some((p) => /duplicate row "bard-camp"/.test(p)));
});

test("IDENT-12 edge (empty): the checker fails an empty cell", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "knight-small");
    assert.ok(i >= 0);
    const cells = splitCells(lines[i]);
    cells[3] = "";
    lines[i] = `| ${cells.join(" | ")} |`;
  });
  assert.ok(checkDoc(bad).some((p) => /row "knight-small" has an empty Engine cell/.test(p)));
});

test("IDENT-12 edge (ordering): the checker fails a swap of two live rows", () => {
  const bad = mutate(readDoc(), (lines) => {
    const a = rowIndex(lines, "knight-small");
    const b = rowIndex(lines, "knight-big");
    assert.ok(a >= 0 && b === a + 1);
    [lines[a], lines[b]] = [lines[b], lines[a]];
  });
  assert.ok(checkDoc(bad).some((p) => /out of identityEntries order/.test(p)));
});

test("IDENT-12: the checker fails an unknown verdict token", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "barbarian-two");
    assert.ok(i >= 0);
    lines[i] = lines[i].replace("| match |", "| fine |");
  });
  assert.ok(checkDoc(bad).some((p) => /unknown verdict part "fine"/.test(p)));
});

test("IDENT-12: the checker fails an owner that is not a plan of this phase", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "guard-hard");
    assert.ok(i >= 0);
    lines[i] = lines[i].replace("fix text (91-10)", "fix text (91-11)");
  });
  assert.ok(checkDoc(bad).some((p) => /names owner 91-11, not a Phase 91 plan/.test(p)));
});

test("IDENT-12: the checker fails a row that reads match but admits a gap", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "barbarian-two");
    assert.ok(i >= 0);
    const cells = splitCells(lines[i]);
    cells[2] = "not stated";
    lines[i] = `| ${cells.join(" | ")} |`;
  });
  assert.ok(checkDoc(bad).some((p) => /reads match but a cell admits a gap/.test(p)));
});

test("IDENT-12: the checker fails a non-live row that is neither unstated nor owned (a match on a pre-registered trait)", () => {
  // Phase 91 plan 02 made wizard-day-one a live entry, so the probe no longer
  // leans on whichever trait a later plan has yet to add: it clones a live row
  // under an id no footer carries and gives it the verdict match.
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "barbarian-two");
    assert.ok(i >= 0);
    const cells = splitCells(lines[i]);
    cells[0] = "probe-not-live";
    cells[5] = "match";
    lines.splice(i + 1, 0, `| ${cells.join(" | ")} |`);
  });
  assert.ok(checkDoc(bad).some((p) => /is not a live entry and its verdict "match"/.test(p)));
});

test("IDENT-12: the checker fails a balance call whose question already has a ruling", () => {
  const live = checkDoc(readDoc());
  assert.deepEqual(live, []);
  const text = readDoc();
  // Q8 is open in the live doc only if a row still reads balance call (Q8);
  // doctor one in, and add a ruling for it, so the rule is exercised either way.
  const bad = mutate(text, (lines) => {
    const i = rowIndex(lines, "barbarian-two");
    assert.ok(i >= 0);
    lines[i] = lines[i].replace("| match |", "| balance call (Q99) |");
    lines.push("- Q99 (2026-10-01): A.");
  });
  const problems = checkDoc(bad);
  assert.ok(problems.some((p) => /Q99 has a ruling but a row still reads balance call \(Q99\)/.test(p)), problems.join("\n"));
});

test("IDENT-12: the checker fails a ruled Qn that Rulings does not record", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "barbarian-xp");
    assert.ok(i >= 0);
    lines[i] = lines[i].replace("| match |", "| ruled (Q77, 2026-09-30) -> 91-09 |");
  });
  assert.ok(checkDoc(bad).some((p) => /ruled \(Q77, \.\.\.\) but Rulings has no "- Q77 \(" entry/.test(p)));
});

test("IDENT-12: the checker fails a missing school-limits row on a Magic User sub-class", () => {
  const bad = mutate(readDoc(), (lines) => {
    const start = sectionStart(lines, "Apprentice");
    const i = rowIndex(lines, "chart-gate-divination", start);
    assert.ok(i > start);
    lines.splice(i, 1);
  });
  const problems = checkDoc(bad);
  assert.ok(problems.some((p) => /Apprentice: no school-limits row|no row for the live entry "chart-gate-divination"/.test(p)));
});

test("IDENT-12: the checker fails a Human that is given a good or bad row", () => {
  const bad = mutate(readDoc(), (lines) => {
    const i = rowIndex(lines, "human-neutral");
    assert.ok(i >= 0);
    lines.splice(i + 1, 0, "| unstated:human-extra | good | not stated | none | none | fix text (91-10) | — |");
  });
  assert.ok(checkDoc(bad).some((p) => /Human: must have exactly the one row/.test(p)));
});
