// test/unit/flavor-drift.test.js
//
// Phase 95 (CONTEXT 'Data shape and guards' test three, ROADMAP criterion 3):
// the flavour layer must not weaken the truth guards. A number deliberately
// drifted in a rules `txt` must still fail its v2.3 guard. The only honest
// proof runs the REAL guard file against a mutated COPY of the tree: the temp
// mirror is built under os.tmpdir(), mutated there, and the guard is run as a
// child `node --test`. The real tree is never touched.
//
// Two mutations:
//   - Heal "d10 hp" -> "d12 hp" must fail test/unit/spell-skill-text-engine.test.js
//     at the Heal truth test;
//   - the Ring of Power's "fifty squares" -> "sixty squares" must fail
//     test/unit/item-text-engine.test.js at "truth: every stated number
//     equals the engine's, for every row".
// Each mutation first asserts its anchor was found exactly where expected, so
// a future rewording cannot make this test vacuous.

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

function makeMirror(guardRel) {
  const mirror = fs.mkdtempSync(path.join(os.tmpdir(), "mz-flavor-drift-"));
  for (const d of COPY_DIRS) fs.cpSync(path.join(ROOT, d), path.join(mirror, d), { recursive: true });
  for (const f of [...COPY_FILES, guardRel]) {
    fs.mkdirSync(path.dirname(path.join(mirror, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(mirror, f));
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

function proveGuardFails({ guardRel, mutation, expectedTitle }) {
  const mirror = makeMirror(guardRel);
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
