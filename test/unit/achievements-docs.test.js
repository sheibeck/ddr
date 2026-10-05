// test/unit/achievements-docs.test.js
//
// Phase 98 plan 98-03 (ZIP-03): docs/ACHIEVEMENTS.md carries the import path
// and the one-way doors, its numbers match the catalog, and the generated
// docs/ACHIEVEMENTS-COPY.md is fresh.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { REPO_ROOT, copyTable } from "../../tools/lib/achievements-zip.mjs";

const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const howTo = read("docs/ACHIEVEMENTS.md");
const copy = read("docs/ACHIEVEMENTS-COPY.md");

test("docs/ACHIEVEMENTS.md pins the Play Console path, the commands and the warnings", () => {
  for (const literal of [
    "Grow users > Play Games Services > Setup and management > Achievements",
    "Import achievements",
    "Save as draft",
    "Review and publish",
    "Get resources",
    "Testers",
    "node tools/achievements-zip.mjs --build",
    "--check",
    "--copy-table",
    "docs/ACHIEVEMENTS-COPY.md",
  ]) {
    assert.ok(howTo.includes(literal), `missing: ${literal}`);
  }
  assert.match(howTo, /exactly once/i);
  assert.match(howTo, /cannot be deleted/i);
  assert.match(howTo, /Import the zip exactly once/);
});

test("docs/ACHIEVEMENTS.md names the CSV byte constants to change if the importer objects", () => {
  assert.ok(howTo.includes("CSV_ROW_SEPARATOR"));
  assert.ok(howTo.includes("CSV_TRAILING_NEWLINE"));
});

test("the docs state the catalog's count, points, incremental and hidden numbers", () => {
  const points = ACHIEVEMENTS.reduce((s, a) => s + a.points, 0);
  const incremental = ACHIEVEMENTS.filter((a) => a.type === "incremental").length;
  const hidden = ACHIEVEMENTS.filter((a) => a.initialState === "Hidden").length;
  const phrase = `${ACHIEVEMENTS.length} achievements, ${points} points, ${incremental} incremental, ${hidden} hidden`;
  assert.ok(howTo.toLowerCase().includes(phrase), `docs lack: ${phrase}`);
  const draft = `${ACHIEVEMENTS.length} achievements, ${points} points, ${incremental} incremental and ${hidden} hidden`;
  assert.ok(howTo.toLowerCase().includes(draft), `docs lack the draft check: ${draft}`);
  assert.ok(howTo.includes(`${2000 - points} points of Play's 2000-point cap`));
});

test("neither doc uses the retired working title", () => {
  for (const [name, text] of [["ACHIEVEMENTS.md", howTo], ["ACHIEVEMENTS-COPY.md", copy]]) {
    assert.ok(!/\bmazeworld\b/i.test(text), `${name} uses the retired working title`);
  }
});

test("docs/ACHIEVEMENTS-COPY.md is exactly what the generator prints (the freshness pin)", () => {
  assert.equal(copy, copyTable(ACHIEVEMENTS));
});

test("the copy table lists every achievement, in seven blocks, with the 8 reveal pairs", () => {
  for (const a of ACHIEVEMENTS) assert.ok(copy.includes(`| ${a.name} |`), `missing ${a.name}`);
  const dataRows = (text) => text.split("\n").filter((l) => /^\| \d+ \|/.test(l));
  assert.equal(dataRows(copy).length, 77);
  assert.equal(copy.split("\n").filter((l) => /^## \d+\. /.test(l)).length, 7);
  const pairs = copy.split("## Reveal pairs")[1].split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Revealer") && !l.startsWith("|--"));
  assert.equal(pairs.length, 8);
  assert.ok(copy.endsWith("\n") && !copy.endsWith("\n\n"), "one trailing newline");
});
