// test/unit/flavor-drift.test.js
//
// Phase 95 (CONTEXT 'Data shape and guards' test three, ROADMAP criterion 3):
// the flavour layer must not weaken the truth guards. A number deliberately
// drifted in a rules `txt` must still fail its v2.3 guard. The only honest
// proof runs the REAL guard file against a mutated COPY of the tree: the temp
// mirror is built under os.tmpdir(), mutated there, and the guard is run as a
// child `node --test`. The real tree is never touched.
//
// Two mutations (Phase 95):
//   - Heal "d10 hp" -> "d12 hp" must fail test/unit/spell-skill-text-engine.test.js
//     at the Heal truth test;
//   - the Ring of Power's "fifty squares" -> "sixty squares" must fail
//     test/unit/item-text-engine.test.js at "truth: every stated number
//     equals the engine's, for every row".
// Three more (Phase 96, plan 96-11; ROADMAP criteria 2 and 4: five mutations in
// all, one per Phase 96 domain that has rules text a number can drift in):
//   - the Gauntlet of the Giant chip sentence in mazeworld.html's CONDITION_EXPLAIN,
//     "+6 damage" -> "+7 damage", must fail test/unit/authored-ranges.test.js;
//   - the Kata row's "+3 to hit on this strike" -> "+4" in content/abilities.js must
//     fail test/unit/spell-skill-text-engine.test.js;
//   - the Troll's RACE_NOTE "+11 damage per swing" -> "+12" in content/flavor.js must
//     fail test/unit/identity-text.test.js.
// Each mutation first asserts its anchor was found exactly where expected, so
// a future rewording cannot make this test vacuous. makeMirror takes extra files
// for a guard that reads beyond engine, content, src and the harness.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const COPY_DIRS = ["engine", "content", "src", path.join("test", "unit", "harness")];
const COPY_FILES = ["package.json"];

/**
 * makeMirror(guardRel, extras) — copy engine, content, src and the harness plus the guard file into a temp dir.
 * `extras` (Phase 96, plan 96-11) are further repo-relative files or directories a guard reads: authored-ranges
 * reads mazeworld.html, builds the voice corpus from tools/ and opens the proof files it names; identity-text reads
 * mazeworld.html and tools/ident-sweep.mjs. Found by grepping each guard for readFileSync, imports and `proof:`.
 */
function makeMirror(guardRel, extras = []) {
  const mirror = fs.mkdtempSync(path.join(os.tmpdir(), "mz-flavor-drift-"));
  for (const d of COPY_DIRS) fs.cpSync(path.join(ROOT, d), path.join(mirror, d), { recursive: true });
  for (const f of [...COPY_FILES, guardRel, ...extras]) {
    const from = path.join(ROOT, f);
    assert.ok(fs.existsSync(from), `${f}: the mirror needs this file and it does not exist`);
    fs.mkdirSync(path.dirname(path.join(mirror, f)), { recursive: true });
    fs.cpSync(from, path.join(mirror, f), { recursive: true });
  }
  return mirror;
}

/** mutate(mirror, rel, edit) — read, let `edit(text)` return the new text, write back (line endings kept as read). */
function mutate(mirror, rel, edit) {
  const file = path.join(mirror, rel);
  const before = fs.readFileSync(file, "utf8");
  const after = edit(before);
  assert.notEqual(after, before, `${rel}: the mutation changed nothing`);
  fs.writeFileSync(file, after);
}

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

function runGuard(mirror, guardRel) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // report as a top-level run, not as a subtest of this one
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", guardRel], {
    cwd: mirror,
    encoding: "utf8",
    timeout: 240000,
    env,
  });
  return { r, ms: Date.now() - t0, out: `${r.stdout || ""}\n${r.stderr || ""}` };
}

function proveGuardFails({ guardRel, mutation, expectedTitle, extras = [] }) {
  const mirror = makeMirror(guardRel, extras);
  try {
    mutate(mirror, mutation.file, mutation.edit);
    const { r, ms, out } = runGuard(mirror, guardRel);
    console.log(`# flavor-drift: ${guardRel} ran ${(ms / 1000).toFixed(1)}s against the drifted mirror`);
    assert.notEqual(r.status, 0, `${guardRel} must exit non-zero against a drifted txt\n${out.slice(-2000)}`);
    assert.ok(out.includes("not ok"), `${guardRel}: output must report a failing test`);
    assert.ok(out.includes(expectedTitle), `${guardRel}: the failing test must be named "${expectedTitle}"`);
    const failing = out.split("\n").filter((l) => /^\s*not ok /.test(l));
    assert.ok(
      failing.some((l) => l.includes(expectedTitle)),
      `${guardRel}: "${expectedTitle}" must be among the failing tests, saw:\n${failing.join("\n")}`,
    );
  } finally {
    fs.rmSync(mirror, { recursive: true, force: true });
  }
}

test("a drifted Heal die (d10 -> d12 in the txt) still fails the spell truth guard", { timeout: 300000 }, () => {
  proveGuardFails({
    guardRel: path.join("test", "unit", "spell-skill-text-engine.test.js"),
    expectedTitle: "Heal: every number the text states is claimed by one fact and equals the engine",
    mutation: {
      file: path.join("content", "spells.js"),
      edit: (text) => {
        const anchor = "healing · you · d10 hp";
        assert.equal(countOf(text, anchor), 1, "the Heal txt anchor must occur exactly once in content/spells.js");
        return text.replace(anchor, "healing · you · d12 hp");
      },
    },
  });
});

test("a drifted Ring of Power (fifty -> sixty squares in the txt) still fails the item truth guard", { timeout: 300000 }, () => {
  proveGuardFails({
    guardRel: path.join("test", "unit", "item-text-engine.test.js"),
    expectedTitle: "truth: every stated number equals the engine's, for every row",
    mutation: {
      file: path.join("content", "treasure-tables.js"),
      edit: (text) => {
        const start = text.indexOf('n: "Ring of Power"');
        assert.ok(start >= 0, "the Ring of Power row must exist in content/treasure-tables.js");
        const end = text.indexOf("act:", start);
        assert.ok(end > start, "the Ring of Power row must carry an act: record");
        const row = text.slice(start, end);
        const anchor = "for fifty squares";
        assert.equal(countOf(row, anchor), 1, 'the Ring of Power txt must contain "for fifty squares" exactly once');
        return text.slice(0, start) + row.replace(anchor, "for sixty squares") + text.slice(end);
      },
    },
  });
});

// ─── Phase 96 (plan 96-11): the three more domains ─────────────────────────
// The Phase 96 lines (races, sub-classes, abilities, skills, chips) sit beside rules text the technical layer owns.
// Each proof drifts one number in that rules text and shows the real guard still bites.

/** The test files a guard names as `proof: "test/..."` rows (authored-ranges opens each of them), so a mirror can hold them. */
function proofFilesOf(guardRel) {
  const src = fs.readFileSync(path.join(ROOT, guardRel), "utf8");
  return [...new Set([...src.matchAll(/proof:\s*"([^"]+\.js)"/g)].map((m) => m[1]))];
}

test("a drifted Gauntlet of the Giant chip number (CONDITION_EXPLAIN giant +6 -> +7 damage) still fails the authored-ranges guard", { timeout: 300000 }, () => {
  const guardRel = path.join("test", "unit", "authored-ranges.test.js");
  proveGuardFails({
    guardRel,
    extras: ["mazeworld.html", "tools", ...proofFilesOf(guardRel)],
    expectedTitle: "CONDITION_EXPLAIN.giant and itemEffectStarted (giant)",
    mutation: {
      file: "mazeworld.html",
      edit: (text) => {
        const anchor = "One size larger while it lasts: +6 damage";
        assert.equal(countOf(text, anchor), 1, "the giant CONDITION_EXPLAIN sentence must occur exactly once in mazeworld.html");
        return text.replace(anchor, "One size larger while it lasts: +7 damage");
      },
    },
  });
});

test("a drifted Kata number (+3 -> +4 to hit on this strike) still fails the spell and skill truth guard", { timeout: 300000 }, () => {
  proveGuardFails({
    guardRel: path.join("test", "unit", "spell-skill-text-engine.test.js"),
    expectedTitle: "Kata: every number the text states is claimed by one fact and equals the engine",
    mutation: {
      file: path.join("content", "abilities.js"),
      edit: (text) => {
        const start = text.indexOf('{ id: "kata"');
        assert.ok(start >= 0, "the Kata row must exist in content/abilities.js");
        const end = text.indexOf("\n", start);
        const row = text.slice(start, end);
        const anchor = "+3 to hit on this strike";
        assert.equal(countOf(row, anchor), 1, 'the Kata txt must contain "+3 to hit on this strike" exactly once');
        return text.slice(0, start) + row.replace(anchor, "+4 to hit on this strike") + text.slice(end);
      },
    },
  });
});

test("a drifted Troll number (+11 -> +12 damage per swing in the race note) still fails the identity text guard", { timeout: 300000 }, () => {
  const guardRel = path.join("test", "unit", "identity-text.test.js");
  proveGuardFails({
    guardRel,
    extras: ["mazeworld.html", path.join("tools", "ident-sweep.mjs")],
    expectedTitle: "TEXT-01: the ruled wordings hold (Ninja, Acrobat, Elven, Troll)",
    mutation: {
      file: path.join("content", "flavor.js"),
      edit: (text) => {
        const anchor = "+11 damage per swing";
        assert.equal(countOf(text, anchor), 1, 'the Troll race note must contain "+11 damage per swing" exactly once in content/flavor.js');
        return text.replace(anchor, "+12 damage per swing");
      },
    },
  });
});
