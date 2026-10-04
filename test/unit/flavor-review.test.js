// test/unit/flavor-review.test.js
//
// Phase 96 (FLAVOR-06; CONTEXT 'The review: Mechanism and Verdicts'), plan
// 96-08: the guard for the review mechanism that sits beside the Phase 79
// why-ledgers (tools/lib/flavor-review.mjs, tools/flavor-review.mjs and the
// verdict merge in tools/narrative-review.mjs). This file proves:
//   - lineHash is eight lowercase hex characters, stable, and sensitive to one
//     code unit (a decomposed accent included);
//   - reviewedLines keeps only the y-95 and y-96 ledger keys, resolved to the
//     last `after` in plan order, in a stable order;
//   - validateVerdicts names every defect (null, missing, unknown verdict,
//     unknown key, bad hash, revise without a note or check, pass listing a
//     failure, duplicate (key, round), bad header, round-1 coverage gap);
//   - validateClosed accepts only a latest pass with a matching hash, and
//     userOwned only on the frozen USER_OWNED_LINES key;
//   - both generated pages carry each key's review paragraph, escape the note,
//     list the counts, are byte-identical across two generations and are
//     byte-identical to the build with no verdict directory;
//   - live: every present verdict file is valid, a round-1 file covers every
//     live reviewed key, the committed pages are in sync and the worksheet
//     resolves every live reviewed key to a domain and its rules text.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

import {
  REVIEW_CHECKS, REVIEW_CHECKLIST, USER_OWNED_LINES, lineHash, reviewedLines, readVerdicts, validateVerdicts, validateClosed, worksheet,
  VERDICT_DIR, LEDGER_DIR,
} from "../../tools/lib/flavor-review.mjs";
import { buildReview, renderMarkdown, renderHtml, generate, checkPages, auditPage } from "../../tools/narrative-review.mjs";
import { readLedgers } from "../../tools/lib/voice-checks.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CLI = path.join(REPO_ROOT, "tools", "flavor-review.mjs");

// ─── Fixtures: a base, ledgers named like the live ones, verdict files ─────

const ROW = (key, after, why = "A new line.", before = "", surface = "blurbs") =>
  ({ key, surface, trigger: `the ${key} line`, before, after, reasons: ["joke"], why });

const FIX_BASE = { base: "abc1234", entries: [{ key: "bank:A.old", surface: "panels", texts: ["Old."] }] };
const FIX_LEDGERS = [
  { plan: "x-94-01", rows: [ROW("bank:OTHER_FLAVOR.skip", "Not a Phase 95 line.")] },
  { plan: "y-95-03", rows: [
    ROW("bank:SPELL_FLAVOR.Heal", "Heals you, mostly."),
    ROW("bank:SPELL_FLAVOR.Bolt", "Smites a thing, politely."),
  ] },
  { plan: "y-96-01", rows: [
    ROW("bank:RACE_FLAVOR.Human.line", "Middling, proudly."),
  ] },
  { plan: "y-96-09", rows: [
    ROW("bank:SPELL_FLAVOR.Bolt", "Smites a thing, rudely.", "A rewrite after the review.", "Smites a thing, politely."),
  ] },
];
const HEAL = "bank:SPELL_FLAVOR.Heal";
const BOLT = "bank:SPELL_FLAVOR.Bolt";
const HUMAN = "bank:RACE_FLAVOR.Human.line";
const FINAL = { [HEAL]: "Heals you, mostly.", [BOLT]: "Smites a thing, rudely.", [HUMAN]: "Middling, proudly." };
const LINES = reviewedLines({ ledgers: FIX_LEDGERS });
const h = (key) => lineHash(FINAL[key]);

const pass = (key, extra = {}) => ({ key, h: h(key), verdict: "pass", ...extra });
const revise = (key, extra = {}) => ({ key, h: h(key), verdict: "revise", fails: ["voice"], note: "Restates the rule; try a shrug.", ...extra });
const file = (round, rows, over = {}) => ({ file: `r${round}.json`, round, reviewer: "a fresh executor", rows, ...over });
const round1 = () => file(1, [pass(HEAL), revise(BOLT), pass(HUMAN)]);

// ─── lineHash ──────────────────────────────────────────────────────────────

test("lineHash: eight lowercase hex characters, stable, and sensitive to a single code unit", () => {
  const a = lineHash("Heals you, mostly.");
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.equal(a, lineHash("Heals you, mostly."));
  assert.notEqual(a, lineHash("Heals you, mostly,"));
  assert.notEqual(a, lineHash("Heals you, mostly. "));
  // a composed e-acute and an e plus a combining acute read the same on screen and hash apart
  assert.notEqual(lineHash("café"), lineHash("café"));
  assert.equal(lineHash(""), "da39a3ee");
});

// ─── reviewedLines ─────────────────────────────────────────────────────────

test("reviewedLines: only y-95 and y-96 keys, the last after wins, in a stable order", () => {
  const lines = reviewedLines({ ledgers: FIX_LEDGERS });
  assert.deepStrictEqual(lines.map((l) => l.key), [HUMAN, BOLT, HEAL]);
  assert.equal(lines.find((l) => l.key === BOLT).line, "Smites a thing, rudely.", "judged in its final wording");
  assert.equal(lines.find((l) => l.key === BOLT).plan, "y-96-09");
  assert.ok(!lines.some((l) => l.key.includes("OTHER_FLAVOR")), "x-94 keys are not reviewed");
  assert.deepStrictEqual(reviewedLines({ ledgers: structuredClone(FIX_LEDGERS) }), lines);
  // a line a later plan removed is no longer a line
  const gone = [...FIX_LEDGERS, { plan: "y-96-10", rows: [ROW(HEAL, "", "Removed.", "Heals you, mostly.")] }];
  assert.ok(!reviewedLines({ ledgers: gone }).some((l) => l.key === HEAL));
  assert.deepStrictEqual(reviewedLines({ ledgers: [] }), []);
  assert.deepStrictEqual(reviewedLines({}), []);
});

test("the checklist: five checks, each with its text, and the one user-owned line", () => {
  assert.deepStrictEqual([...REVIEW_CHECKS], ["voice", "family", "numberFree", "consistent", "goodBad"]);
  assert.deepStrictEqual(Object.keys(REVIEW_CHECKLIST), [...REVIEW_CHECKS]);
  for (const c of REVIEW_CHECKS) assert.ok(REVIEW_CHECKLIST[c].length > 20, c);
  assert.ok(Object.isFrozen(REVIEW_CHECKLIST) && Object.isFrozen(REVIEW_CHECKS) && Object.isFrozen(USER_OWNED_LINES));
});

// ─── validateVerdicts ──────────────────────────────────────────────────────

const errorsOf = (verdicts, opts) => validateVerdicts({ verdicts, lines: LINES }, opts);
const has = (errors, re) => errors.some((e) => re.test(e));

test("validateVerdicts: a clean round-1 file returns no errors", () => {
  assert.deepStrictEqual(errorsOf([round1()]), []);
  assert.deepStrictEqual(errorsOf([]), []);
});

test("validateVerdicts: a null, missing or unknown verdict is named", () => {
  const rows = [pass(HEAL), { key: BOLT, h: h(BOLT), verdict: null }, { key: HUMAN, h: h(HUMAN) }];
  const e = errorsOf([file(1, rows)]);
  assert.ok(has(e, /Bolt.*no verdict/), e.join("\n"));
  assert.ok(has(e, /Human.*no verdict/), e.join("\n"));
  assert.ok(has(errorsOf([file(1, [pass(HEAL), pass(HUMAN), { ...pass(BOLT), verdict: "maybe" }])]), /unknown verdict "maybe"/));
});

test("validateVerdicts: an unknown key, a bad hash and an unknown field are named", () => {
  const e = errorsOf([file(1, [...round1().rows, { key: "bank:SPELL_FLAVOR.Nope", h: "00000000", verdict: "pass" }])]);
  assert.ok(has(e, /Nope.*unknown key/));
  for (const bad of ["XYZ", "ABCDEF01", "abcdef0", "abcdef012", ""]) {
    assert.ok(has(errorsOf([file(1, [pass(HEAL, { h: bad }), pass(BOLT), pass(HUMAN)])]), /Heal.*h is not eight/), `h ${JSON.stringify(bad)}`);
  }
  assert.ok(has(errorsOf([file(1, [pass(HEAL, { mood: "cheerful" }), pass(BOLT), pass(HUMAN)])]), /unknown field mood/));
  // keys compare code unit for code unit: a case change is a different key
  assert.ok(has(errorsOf([file(1, [pass(HEAL), pass(BOLT), pass(HUMAN), { key: HEAL.toLowerCase(), h: h(HEAL), verdict: "pass" }])]), /unknown key/));
});

test("validateVerdicts: a revise needs a note and a known failed check; a pass may list none", () => {
  const noNote = errorsOf([file(1, [pass(HEAL), revise(BOLT, { note: "  " }), pass(HUMAN)])]);
  assert.ok(has(noNote, /Bolt.*needs a note/));
  const noNoteAtAll = errorsOf([file(1, [pass(HEAL), { key: BOLT, h: h(BOLT), verdict: "revise", fails: ["voice"] }, pass(HUMAN)])]);
  assert.ok(has(noNoteAtAll, /needs a note/));
  assert.ok(has(errorsOf([file(1, [pass(HEAL), revise(BOLT, { fails: [] }), pass(HUMAN)])]), /at least one failed check/));
  assert.ok(has(errorsOf([file(1, [pass(HEAL), { key: BOLT, h: h(BOLT), verdict: "revise", note: "Bad." }, pass(HUMAN)])]), /at least one failed check/));
  assert.ok(has(errorsOf([file(1, [pass(HEAL), revise(BOLT, { fails: ["tone"] }), pass(HUMAN)])]), /unknown check "tone"/));
  assert.ok(has(errorsOf([file(1, [pass(HEAL), revise(BOLT, { fails: ["voice", "voice"] }), pass(HUMAN)])]), /twice/));
  for (const c of REVIEW_CHECKS) assert.deepStrictEqual(errorsOf([file(1, [pass(HEAL), revise(BOLT, { fails: [c] }), pass(HUMAN)])]), [], c);
});

test("validateVerdicts: a pass that lists a failed check fails", () => {
  const e = errorsOf([file(1, [pass(HEAL, { fails: ["voice"] }), pass(BOLT), pass(HUMAN)])]);
  assert.ok(has(e, /Heal.*pass lists a failed check/), e.join("\n"));
  assert.deepStrictEqual(errorsOf([file(1, [pass(HEAL, { fails: [], note: "Fine, with a caveat." }), pass(BOLT), pass(HUMAN)])]), []);
});

test("validateVerdicts: a duplicate (key, round) fails within a file and across files; another round is fine", () => {
  assert.ok(has(errorsOf([file(1, [...round1().rows, pass(HEAL)])]), /Heal.*duplicate/));
  const a = file(1, round1().rows);
  const b = { ...file(1, [pass(HEAL)]), file: "other.json" };
  assert.ok(has(errorsOf([a, b]), /duplicate.*also in r1\.json/));
  assert.deepStrictEqual(errorsOf([a, file(2, [pass(BOLT)])]), []);
});

test("validateVerdicts: the header needs a reviewer and a whole round from 1; an unparsed file is named", () => {
  assert.ok(has(errorsOf([round1(), file(2, [], { reviewer: "" })]), /needs a reviewer/));
  assert.ok(has(errorsOf([file(1, round1().rows, { reviewer: undefined })]), /needs a reviewer/));
  for (const round of [0, -1, 1.5, "1", null, undefined]) {
    assert.ok(has(errorsOf([file(1, round1().rows, { round })]), /round that is a whole number/), String(round));
  }
  assert.ok(has(errorsOf([{ file: "bad.json", parseError: "Unexpected token" }]), /bad\.json: does not parse/));
  assert.ok(has(errorsOf([file(1, "nope")]), /rows is not an array/));
});

test("validateVerdicts: a round-1 file that omits a reviewed key names it; later rounds need not cover everything", () => {
  const e = errorsOf([file(1, [pass(HEAL), pass(BOLT)])]);
  assert.ok(has(e, /round 1 misses bank:RACE_FLAVOR\.Human\.line/), e.join("\n"));
  assert.deepStrictEqual(errorsOf([round1(), file(2, [pass(BOLT)])]), []);
  assert.deepStrictEqual(errorsOf([file(1, [pass(HEAL)])], { coverage: false }), []);
  assert.deepStrictEqual(errorsOf([file(2, [pass(HEAL)])]), [], "only round 1 must cover every line");
});

test("validateVerdicts: userOwned is valid only on a USER_OWNED_LINES key, as a pass", () => {
  assert.deepStrictEqual([...USER_OWNED_LINES], [HEAL]);
  assert.deepStrictEqual(errorsOf([file(1, [pass(HEAL, { userOwned: true, note: "Disagree; the user's own." }), pass(BOLT), pass(HUMAN)])]), []);
  assert.ok(has(errorsOf([file(1, [pass(HEAL), pass(BOLT, { userOwned: true }), pass(HUMAN)])]), /Bolt.*userOwned is valid only on/));
  assert.ok(has(errorsOf([file(1, [revise(HEAL, { userOwned: true }), pass(BOLT), pass(HUMAN)])]), /recorded as a pass/));
});

// ─── validateClosed ────────────────────────────────────────────────────────

const closedOf = (verdicts) => validateClosed({ verdicts, lines: LINES });

test("validateClosed: closed when every key's latest verdict is a pass with a hash equal to the current line's", () => {
  const closed = [file(1, [pass(HEAL), revise(BOLT), pass(HUMAN)]), file(2, [pass(BOLT)])];
  assert.deepStrictEqual(closedOf(closed).errors, []);
  assert.deepStrictEqual(closedOf(closed).selfChecked, []);
  const self = closedOf([file(1, [pass(HEAL), revise(BOLT), pass(HUMAN)]), file(2, [pass(BOLT, { selfChecked: true })])]);
  assert.deepStrictEqual(self.errors, []);
  assert.deepStrictEqual(self.selfChecked, [{ key: BOLT, round: 2, file: "r2.json" }]);
});

test("validateClosed: a latest revise, a stale hash, an unreviewed key and a round-2 row nobody revised each fail, naming the key", () => {
  const latestRevise = closedOf([file(1, [pass(HEAL), revise(BOLT), pass(HUMAN)])]).errors;
  assert.ok(has(latestRevise, /Bolt.*latest verdict is revise/), latestRevise.join("\n"));
  const stale = closedOf([file(1, [pass(HEAL), pass(BOLT, { h: lineHash("Smites a thing, politely.") }), pass(HUMAN)])]).errors;
  assert.ok(has(stale, /Bolt.*stale/), stale.join("\n"));
  const unreviewed = closedOf([file(1, [pass(HEAL), pass(BOLT)])]).errors;
  assert.ok(has(unreviewed, /Human.*unreviewed/), unreviewed.join("\n"));
  assert.ok(has(closedOf([]).errors, /Heal.*unreviewed/));
  const never = closedOf([file(1, [pass(HEAL), pass(BOLT), pass(HUMAN)]), file(2, [pass(HEAL)])]).errors;
  assert.ok(has(never, /Heal.*round 2 row but no earlier round revised it/), never.join("\n"));
  // a null verdict is not a review
  assert.ok(has(closedOf([file(1, [pass(HEAL), pass(BOLT), { key: HUMAN, h: h(HUMAN), verdict: null }])]).errors, /Human.*unreviewed/));
});

test("validateClosed: a userOwned pass is accepted only for the USER_OWNED_LINES key", () => {
  assert.deepStrictEqual(closedOf([file(1, [pass(HEAL, { userOwned: true, note: "Disagree, but it is the user's." }), pass(BOLT), pass(HUMAN)])]).errors, []);
  assert.ok(has(closedOf([file(1, [pass(HEAL), pass(BOLT, { userOwned: true }), pass(HUMAN)])]).errors, /Bolt.*userOwned/));
});

// ─── The pages ─────────────────────────────────────────────────────────────

function writeRoot(root, { verdicts = [], ledgers = FIX_LEDGERS } = {}) {
  fs.mkdirSync(path.join(root, LEDGER_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "narrative-pass", "corpus-base.json"), JSON.stringify(FIX_BASE));
  for (const l of ledgers) fs.writeFileSync(path.join(root, LEDGER_DIR, `${l.plan}.json`), JSON.stringify(l.rows, null, 1));
  if (verdicts.length) fs.mkdirSync(path.join(root, VERDICT_DIR), { recursive: true });
  verdicts.forEach((v, i) => fs.writeFileSync(path.join(root, VERDICT_DIR, `96-review-${i + 1}.json`), JSON.stringify({ round: v.round, reviewer: v.reviewer, rows: v.rows }, null, 1)));
}

const withRoot = (opts, fn) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flavor-review-"));
  try {
    writeRoot(tmp, opts);
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

const NASTY = "Too <b>loud</b> & vague | really *very* _much_ so.";
const PAGE_VERDICTS = [
  { round: 1, reviewer: "96-08 executor <fresh> & independent", rows: [pass(HEAL), revise(BOLT, { fails: ["voice", "consistent"], note: NASTY }), pass(HUMAN)] },
  { round: 2, reviewer: "second reader", rows: [pass(BOLT)] },
];

test("pages: each reviewed key's row carries its review paragraph (round, verdict, note) and the counts, escaped, in both pages", () => {
  withRoot({ verdicts: PAGE_VERDICTS }, (root) => {
    const { md, html, review } = generate({ root });
    assert.ok(review.review, "the verdict view is on the review");
    assert.deepStrictEqual(review.review.final, { total: 3, pass: 3, revise: 0, stale: 0, unreviewed: 0 });
    // markdown: the Why cell of the Bolt row
    const boltRow = md.split("\n").find((l) => l.startsWith("| `bank:SPELL_FLAVOR.Bolt`"));
    assert.ok(boltRow.includes("<br>**review** (round 1 revise (voice, consistent): Too &lt;b&gt;loud&lt;/b&gt; & vague \\| really \\*very\\* \\_much\\_ so.; round 2 pass)"), boltRow);
    assert.ok(!boltRow.includes("<b>"), "no raw tag from a note");
    assert.ok(md.includes("## The review verdicts"));
    assert.ok(md.indexOf("## The review verdicts") > md.indexOf("## The pass in numbers"));
    assert.match(md, /\| 3 \| 3 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /### Round 1: 96-08 executor &lt;fresh&gt; & independent/);
    assert.match(md, /### Round 2: second reader/);
    assert.deepStrictEqual(auditPage(md, readLedgers(path.join(root, LEDGER_DIR))), [], "the audit still finds every ledger row");
    // html: a verdict paragraph per reviewed row, every note escaped
    assert.equal((html.match(/<p class="step verdict">/g) ?? []).length, 3);
    assert.ok(html.includes("Too &lt;b&gt;loud&lt;/b&gt; &amp; vague | really *very* _much_ so."));
    assert.ok(!html.includes("<b>loud"), "no raw tag from a note");
    assert.ok(html.includes('<h2 id="review">The review verdicts</h2>'));
    assert.ok(html.includes("96-08 executor &lt;fresh&gt; &amp; independent"));
    assert.ok(!/<script/i.test(html));
  });
});

test("pages: a stale latest verdict says the line changed since, and a reviewed key with no verdict says so", () => {
  const stale = [{ round: 1, reviewer: "r", rows: [pass(HEAL), revise(BOLT, { h: lineHash("Smites a thing, politely.") }), pass(HUMAN)] }];
  withRoot({ verdicts: stale }, (root) => {
    const { md, html, review } = generate({ root });
    assert.deepStrictEqual(review.review.final, { total: 3, pass: 2, revise: 0, stale: 1, unreviewed: 0 });
    assert.match(md.split("\n").find((l) => l.startsWith("| `bank:SPELL_FLAVOR.Bolt`")), /round 1 revise \(voice\): Restates the rule; try a shrug\.; line changed since\)/);
    assert.match(html, /line changed since/);
  });
  const partial = [{ round: 1, reviewer: "r", rows: [pass(HEAL)] }];
  withRoot({ verdicts: partial }, (root) => {
    const { md, review } = generate({ root });
    assert.deepStrictEqual(review.review.final, { total: 3, pass: 1, revise: 0, stale: 0, unreviewed: 2 });
    assert.match(md.split("\n").find((l) => l.startsWith("| `bank:RACE_FLAVOR.Human.line`")), /review\*\* \(no verdict yet\)/);
  });
  // the page never claims a pass the files do not record: a skeleton of nulls reads as no verdict at all
  const skeleton = [{ round: 1, reviewer: "r", rows: [HEAL, BOLT, HUMAN].map((key) => ({ key, h: h(key), verdict: null })) }];
  withRoot({ verdicts: skeleton }, (root) => {
    const { review } = generate({ root });
    assert.deepStrictEqual(review.review.final, { total: 3, pass: 0, revise: 0, stale: 0, unreviewed: 3 });
  });
});

test("pages: rows keep the surface, key, plan order; two generations are byte-identical; the build with no verdict directory is the old build", () => {
  const a = withRoot({ verdicts: PAGE_VERDICTS }, (root) => generate({ root }));
  const b = withRoot({ verdicts: PAGE_VERDICTS }, (root) => generate({ root }));
  assert.equal(a.md, b.md);
  assert.equal(a.html, b.html);
  const keysOf = (md) => md.split("\n").filter((l) => l.startsWith("| `")).map((l) => l.slice(3, l.indexOf("`", 3)));
  assert.deepStrictEqual(keysOf(a.md), [...keysOf(a.md)].sort(), "one surface here, so the rows are in key order");
  assert.equal(keysOf(a.md).length, 4, "the x-94 row is on the page, unreviewed");
  const none = withRoot({}, (root) => generate({ root }));
  assert.ok(!("review" in none.review));
  assert.ok(!none.md.includes("review verdicts") && !none.md.includes("**review**"));
  assert.ok(!none.html.includes("verdict"));
  // the same rows without the verdict view: what generate() builds for no verdict directory equals buildReview with no third property
  const base = FIX_BASE;
  const plain = buildReview({ base, ledgers: FIX_LEDGERS });
  assert.equal(renderMarkdown(plain) + "\n", none.md);
  assert.equal(renderHtml(plain), none.html);
  assert.equal(renderMarkdown(buildReview({ base, ledgers: FIX_LEDGERS, verdicts: [] })), renderMarkdown(plain));
  // an empty verdict directory is the same as none
  const emptyDir = withRoot({}, (root) => {
    fs.mkdirSync(path.join(root, VERDICT_DIR), { recursive: true });
    return generate({ root });
  });
  assert.equal(emptyDir.md, none.md);
  assert.equal(emptyDir.html, none.html);
});

test("readVerdicts: absent directory means none, a bad file is named, CRLF and a BOM are tolerated", () => {
  withRoot({}, (root) => {
    assert.deepStrictEqual(readVerdicts(path.join(root, VERDICT_DIR)), []);
    fs.mkdirSync(path.join(root, VERDICT_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, VERDICT_DIR, "a.json"), "﻿" + JSON.stringify({ round: 1, reviewer: "r", rows: [] }, null, 2).replace(/\n/g, "\r\n"));
    fs.writeFileSync(path.join(root, VERDICT_DIR, "b.json"), "{ nope");
    fs.writeFileSync(path.join(root, VERDICT_DIR, "c.txt"), "ignored");
    const got = readVerdicts(path.join(root, VERDICT_DIR));
    assert.deepStrictEqual(got.map((v) => v.file), ["a.json", "b.json"]);
    assert.equal(got[0].round, 1);
    assert.ok(got[1].parseError);
  });
});

// ─── The CLI ───────────────────────────────────────────────────────────────

test("CLI: --check validates nothing without a verdict file, --closed fails without one, a bad flag exits 2", () => {
  const run = (root, ...args) => spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8" });
  withRoot({}, (root) => {
    assert.equal(run(root, "--check").status, 0);
    assert.equal(run(root, "--closed").status, 1);
    assert.equal(run(root, "--nonsense").status, 2);
    assert.equal(run(root).status, 2, "no mode is a usage error");
    assert.equal(run(root, "--check", "--closed").status, 2, "two modes are a usage error");
  });
  withRoot({ verdicts: [{ ...round1(), rows: [pass(HEAL), revise(BOLT), pass(HUMAN)] }] }, (root) => {
    assert.equal(run(root, "--check").status, 0);
    assert.equal(run(root, "--closed").status, 1, "Bolt is still revise");
  });
  withRoot({ verdicts: [{ round: 1, reviewer: "r", rows: [pass(HEAL), { key: BOLT, h: h(BOLT), verdict: null }, pass(HUMAN)] }] }, (root) => {
    const bad = run(root, "--check");
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /Bolt.*no verdict/);
  });
});

test("CLI: --skeleton writes null verdicts only, refuses to overwrite, and writes only under the verdicts directory", () => {
  const run = (root, ...args) => spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8" });
  // the fixture has no live content to resolve, so only the argument checks run against the fixture root
  withRoot({}, (root) => {
    assert.equal(run(root, "--skeleton", "--round", "1", "--reviewer", "r").status, 2, "needs --out");
    assert.equal(run(root, "--skeleton", "--round", "0", "--reviewer", "r", "--out", `${VERDICT_DIR}/x.json`).status, 2);
    assert.equal(run(root, "--skeleton", "--round", "1", "--reviewer", " ", "--out", `${VERDICT_DIR}/x.json`).status, 2);
    assert.equal(run(root, "--skeleton", "--round", "1", "--reviewer", "r", "--out", "docs/elsewhere.json").status, 2, "outside the verdicts directory");
    assert.equal(run(root, "--skeleton", "--round", "1", "--reviewer", "r", "--out", `${VERDICT_DIR}/../x.json`).status, 2);
    fs.mkdirSync(path.join(root, VERDICT_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, VERDICT_DIR, "taken.json"), "{}");
    assert.equal(run(root, "--skeleton", "--round", "1", "--reviewer", "r", "--out", `${VERDICT_DIR}/taken.json`).status, 2, "never overwrites");
  });
});

// ─── Live ──────────────────────────────────────────────────────────────────

const liveLedgers = readLedgers(path.join(REPO_ROOT, LEDGER_DIR));
const liveLines = reviewedLines({ ledgers: liveLedgers });
const liveVerdicts = readVerdicts(path.join(REPO_ROOT, VERDICT_DIR));

test("live: the reviewed set is the keys of the y-95 and y-96 ledgers", () => {
  const keys = new Set();
  for (const l of liveLedgers) if (/^y-9[56]-/.test(l.plan)) for (const r of l.rows) keys.add(r.key);
  assert.equal(liveLines.length, keys.size);
  assert.ok(liveLines.length >= 225, "225 lines at the end of Phase 96 plan 04");
  assert.ok(liveLines.some((l) => l.key === HEAL));
  assert.ok(liveLines.some((l) => l.key === "bank:RULES_COPY.label"), "the toggle words are reviewed too");
});

test("live: every present verdict file is valid and a round-1 file covers every reviewed key", () => {
  assert.deepStrictEqual(validateVerdicts({ verdicts: liveVerdicts, lines: liveLines }), []);
  for (const v of liveVerdicts.filter((x) => x.round === 1)) {
    const have = new Set(v.rows.map((r) => r.key));
    assert.deepStrictEqual(liveLines.filter((l) => !have.has(l.key)).map((l) => l.key), [], `${v.file} misses a line`);
    assert.ok(v.rows.every((r) => r.verdict === "pass" || r.verdict === "revise"), "round 1 judged every line");
  }
});

test("live: every verdict hash is the hash of a line the ledgers know, and the committed pages are in sync", () => {
  const current = new Map(liveLines.map((l) => [l.key, lineHash(l.line)]));
  for (const v of liveVerdicts) {
    for (const r of v.rows) assert.ok(current.has(r.key), `${v.file}: ${r.key}`);
  }
  const { ok, problems } = checkPages({ root: REPO_ROOT });
  assert.ok(ok, problems.join("\n"));
});

test("live: the worksheet resolves every reviewed key to a domain, its line and its rules text", async () => {
  const { entries, problems } = await worksheet({ root: REPO_ROOT });
  assert.deepStrictEqual(problems, []);
  assert.deepStrictEqual(entries.map((e) => e.key).sort(), liveLines.map((l) => l.key).sort());
  const domains = ["spell", "scroll", "potion", "tool", "bag", "magic", "weapon", "armor", "race", "sub", "class", "ability", "skill", "chip", "rules"];
  let at = 0;
  for (const e of entries) {
    const i = domains.indexOf(e.domain);
    assert.ok(i >= at, `${e.key} is out of the page's domain order`);
    at = i;
    assert.equal(e.hash, lineHash(e.line));
    assert.ok(e.rules.length > 0 && e.rules.every((t) => t.length > 0), `${e.key} has rules text`);
    if (!["weapon", "armor", "rules"].includes(e.domain)) assert.ok(!e.rules.includes("generated stat line") && !e.rules.includes("(toggle word)"), e.key);
    if (e.domain === "race" || e.domain === "sub") {
      assert.ok(e.tagged.good.length + e.tagged.bad.length + e.tagged.neutral.length > 0, `${e.key} has tagged entries`);
      for (const t of [...e.tagged.good, ...e.tagged.bad, ...e.tagged.neutral]) assert.ok(!t.text.startsWith("(no identity entry"), `${e.key} ${t.id}`);
    }
  }
  const by = (d) => entries.filter((e) => e.domain === d).length;
  assert.equal(by("race"), 6);
  assert.equal(by("sub"), 24);
  assert.equal(by("chip"), 47);
  assert.equal(by("rules"), 3);
});
