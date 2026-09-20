// test/unit/fightLog.test.js
//
// Phase 34 (CSCR-04), Plan 01 — direct unit coverage for
// src/browser/narrationLines.js's new `withIdx`/`oracleDetailText` additions and
// src/browser/fightLog.js's whole-fight, newest-first, tap-reveal log
// contract. Synthetic event lists only — no engine calls needed (mirrors
// test/unit/linesForAction.test.js's own approach).
//
// REFUSAL_TYPES is copied verbatim from test/unit/shell-round-card.test.js
// (lines 174-181) — that file is deleted in Plan 02, so this file becomes
// the canonical carrier of that manifest for the fight log's own
// block<->dull partition proof.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { linesForAction, LINE_FOR, PRIORITY, oracleDetailText } from "../../src/browser/narrationLines.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import {
  FIGHT_LOG_TONES,
  fightLogLinesFor,
  emptyFightLog,
  appendFightLog,
  dullFightLogLine,
  fightLogRows,
  toggleFightLogEntry,
  fightLogAnnouncement,
} from "../../src/browser/fightLog.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const REFUSAL_TYPES = [
  "strikeRefused", "fleeRefused", "parleyRefused", "withdrawalDenied", "vanishDenied",
  "itemRejected", "equipRejected", "useRefused", "scrollRefused", "noChargesLeft",
  "spellNotKnown", "spellAboveLevel", "spellSchoolLocked", "campFailed", "joinerRefused",
  "buyFailed", "backstabDenied", "bagFull", "nothingToThrowAt", "nothingToTurn",
  "gateRefused", "insaneNoTarget", "deathSpellTooWeak", "parleyExhausted",
  "castRefused", "actionRefused",
];

// ─── Test 1: default shape unchanged ───────────────────────────────────────

test("linesForAction: default call (no withIdx) returns exactly {text, tone, priority} — no idx, no type", () => {
  const out = linesForAction("attack", [{ type: "struck", name: "Giant Rat", dmg: 4 }], {});
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), ["priority", "text", "tone"]);
});

// ─── Test 2: withIdx carries idx (always) and type (direct-mapped only) ───

test("linesForAction withIdx: every entry carries a non-negative integer idx", () => {
  const out = linesForAction("attack", [{ type: "struck", name: "Giant Rat", dmg: 4 }], {}, { limit: Infinity, withIdx: true });
  assert.equal(out.length, 1);
  assert.ok(Number.isInteger(out[0].idx) && out[0].idx >= 0);
});

test("linesForAction withIdx: a direct-mapped event (not folded by any grouper) also carries type", () => {
  const out = linesForAction("move", [{ type: "combatJoined", first: "you" }], {}, { limit: Infinity, withIdx: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].type, "combatJoined");
  assert.ok(Number.isInteger(out[0].idx) && out[0].idx >= 0);
});

// ─── Test 3: oracleDetailText ───────────────────────────────────────────────

test("oracleDetailText: keeps dice, strips tags; empty when no roll span; empty for undefined", () => {
  assert.equal(
    oracleDetailText('<span class="roll">7</span> vs 12. You hit <b>Giant Rat</b> for <span class="roll">5</span> hp.'),
    "7 vs 12. You hit Giant Rat for 5 hp."
  );
  assert.equal(oracleDetailText('<span class="hit">It falls.</span>'), "");
  assert.equal(oracleDetailText(undefined), "");
});

// ─── Test 4: fightLogLinesFor — narrative line with roll ──────────────────

test("fightLogLinesFor: a struck event yields one narrative line whose roll is the roll-bearing Oracle sentence", () => {
  const lines = fightLogLinesFor("attack", [{ type: "struck", target: "Giant Rat", roll: 7, need: 12, dmg: 5 }]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].tone, "narrative");
  assert.equal(lines[0].roll, "7 vs 12. You hit Giant Rat for 5 hp.");
  assert.ok(FIGHT_LOG_TONES.includes(lines[0].tone));
});

// ─── Test 5: fightLogLinesFor — dull refusal, and a narrate-ctx line ──────

test("fightLogLinesFor: a refusal yields a dull line with no roll; a narrate-ctx line with no roll span yields narrative/null", () => {
  const refusalLines = fightLogLinesFor("attack", [{ type: "strikeRefused" }]);
  assert.equal(refusalLines.length, 1);
  assert.equal(refusalLines[0].tone, "dull");
  assert.equal(refusalLines[0].roll, null);

  const narrated = fightLogLinesFor("move", [{ type: "encounterStarted", foes: [{ name: "Kobold" }] }], { narrate: narrateEvent });
  assert.equal(narrated.length, 1);
  assert.equal(narrated[0].tone, "narrative");
  assert.equal(narrated[0].roll, null);
});

// ─── Test 6: the block<->dull partition (proof over the whole LINE_FOR manifest) ─

test("partition: PRIORITY.block lines fold to dull-only fight-log entries; everything else folds to narrative-only", () => {
  for (const [type, fn] of Object.entries(LINE_FOR)) {
    const isBlock = fn({ type }, {}).priority === PRIORITY.block;
    const lines = fightLogLinesFor("attack", [{ type }]);
    if (lines.length === 0) continue; // events fully folded away with no output (e.g. a bare spellThrown) — not applicable here
    const allDull = lines.every((l) => l.tone === "dull");
    const allNarrative = lines.every((l) => l.tone === "narrative");
    assert.ok(allDull || allNarrative, `${type}: a single event must not produce mixed tones`);
    assert.equal(allDull, isBlock, `${type}: block<->dull partition mismatch`);
  }

  for (const t of REFUSAL_TYPES) {
    const lines = fightLogLinesFor("attack", [{ type: t }]);
    assert.ok(lines.length > 0, `${t} must produce at least one fight-log line`);
    assert.ok(lines.every((l) => l.tone === "dull"), `${t} must be dull-only`);
  }

  for (const t of ["encounterStarted", "combatJoined", "phobiaAfraid", "struck", "strikeMissed", "struckByFoe", "foeMissed", "frenzy", "lootDropped"]) {
    const lines = fightLogLinesFor("attack", [{ type: t }]);
    assert.ok(lines.length > 0, `${t} must produce at least one fight-log line`);
    assert.ok(lines.every((l) => l.tone === "narrative"), `${t} must be narrative-only`);
  }
});

// ─── Test 7: count equality (folded count, uncapped) ───────────────────────

test("count equality: fightLogLinesFor's line count equals the uncapped folded line count", () => {
  const types = ["frenzy", "phobiaAfraid", "lootDropped", "combatJoined", "struck", "foeMissed"];
  const events = types.map((type) => ({ type }));
  const lines = fightLogLinesFor("attack", events);
  const folded = linesForAction("attack", events, {}, { limit: Infinity });
  assert.equal(lines.length, 6);
  assert.equal(folded.length, 6);
  assert.equal(lines.length, folded.length);

  const mixed = fightLogLinesFor("attack", [{ type: "struck" }, { type: "strikeRefused" }]);
  assert.equal(mixed.length, 2);
  assert.equal(mixed.filter((l) => l.tone === "dull").length, 1);
});

// ─── Test 8: appendFightLog / emptyFightLog / fightLogRows ────────────────

test("appendFightLog: builds sequential batches with strictly-increasing ids and per-entry round/show", () => {
  const lines1 = [{ text: "a", tone: "narrative", roll: null }];
  const log1 = appendFightLog(null, lines1, 1);
  assert.equal(log1.seq, 1);
  assert.ok(log1.nextId > 1);
  assert.equal(log1.entries.length, 1);
  assert.deepEqual(
    { id: log1.entries[0].id, seq: log1.entries[0].seq, text: log1.entries[0].text, tone: log1.entries[0].tone, round: log1.entries[0].round, show: log1.entries[0].show },
    { id: log1.entries[0].id, seq: 1, text: "a", tone: "narrative", round: 1, show: false }
  );

  const lines2 = [{ text: "b", tone: "dull", roll: null }, { text: "c", tone: "narrative", roll: "1 vs 2" }];
  const log2 = appendFightLog(log1, lines2, 2);
  assert.equal(log2.seq, 2);
  assert.equal(log2.entries.length, 3);
  const ids = log2.entries.map((e) => e.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, 3, "every id is unique/strictly increasing");

  assert.deepEqual(fightLogRows(null), []);
  const rows = fightLogRows(log2);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].text, "c", "newest-first: the last appended entry comes first");
  assert.equal(rows[2].text, "a");
});

// ─── Test 9: toggleFightLogEntry ───────────────────────────────────────────

test("toggleFightLogEntry: flips exactly one entry's show, leaves seq unchanged, never mutates the input", () => {
  const log = appendFightLog(null, [{ text: "a", tone: "narrative", roll: null }, { text: "b", tone: "dull", roll: null }], 1);
  const targetId = log.entries[1].id;
  const toggled = toggleFightLogEntry(log, targetId);
  assert.notEqual(toggled, log, "returns a new object");
  assert.equal(toggled.seq, log.seq);
  assert.equal(toggled.entries.find((e) => e.id === targetId).show, true);
  assert.equal(toggled.entries.find((e) => e.id === log.entries[0].id).show, false);
  assert.equal(log.entries[1].show, false, "the input log's entry is not mutated");
});

// ─── Test 10: fightLogAnnouncement ─────────────────────────────────────────

test("fightLogAnnouncement: joins only entries newer than announcedSeq, in append order", () => {
  const log1 = appendFightLog(null, [{ text: "a", tone: "narrative", roll: null }, { text: "b", tone: "dull", roll: null }], 1);
  const ann1 = fightLogAnnouncement(log1, 0);
  assert.equal(ann1.seq, log1.seq);
  assert.equal(ann1.text, "a b");

  const ann1b = fightLogAnnouncement(log1, log1.seq);
  assert.equal(ann1b.text, "");

  const log2 = appendFightLog(log1, [{ text: "c", tone: "narrative", roll: null }], 2);
  const ann2 = fightLogAnnouncement(log2, log1.seq);
  assert.equal(ann2.text, "c");
});

// ─── Test 11: dullFightLogLine ─────────────────────────────────────────────

test("dullFightLogLine: builds a {text, tone:'dull', roll:null} entry", () => {
  assert.deepEqual(dullFightLogLine("Already at full health."), { text: "Already at full health.", tone: "dull", roll: null });
});

// ─── Test 12: purity ────────────────────────────────────────────────────────

test("fightLog.js is pure: no window/document/Date.now/localStorage/setTimeout/innerHTML, and imports only from narrationLines.js and eventNarration.js", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "fightLog.js"), "utf8");
  for (const needle of ["window", "document", "Date.now", "localStorage", "setTimeout", "innerHTML"]) {
    assert.doesNotMatch(src, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must not appear in fightLog.js`);
  }
  const importLines = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(importLines.sort(), ["./eventNarration.js", "./narrationLines.js"].sort());
});
