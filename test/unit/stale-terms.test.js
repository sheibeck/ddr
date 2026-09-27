// test/unit/stale-terms.test.js
//
// Phase 48 (DOCS-01/DOCS-03)'s standing tripwire — pins tools/stale-terms.mjs's
// table to zero unlisted on every enforced row over the real, shipped
// surface, and zero allow-list rot (no ALLOWED entry pointing at a line that
// no longer exists). A future stale comment, describe()/test() title, or
// rotted survivor entry fails `npm test` from here on.
//
// How to add a survivor: append an `{ term, file, match, reason }` entry to
// tools/stale-terms.mjs's ALLOWED array — never weaken a TERMS regex to make
// a hit disappear. `reason` should name the survivor class (A/B/C/D, see
// tools/stale-terms.mjs's own header comment).
//
// Unlike tools/ident-sweep.mjs / test/unit/bridge-registry.test.js's
// comment-stripped scans, tools/stale-terms.mjs deliberately reads RAW
// lines — comments and describe()/test() title strings are exactly what
// this tool is built to catch, not noise to strip before matching.

import test from "node:test";
import assert from "node:assert/strict";

import { TERMS, ALLOWED, scan, defaultSources } from "../../tools/stale-terms.mjs";

// --- (a) the real, shipped surface: every enforced row is fully listed ---

test("DOCS-01/03: every enforced stale-term row reports zero unlisted lines over the shipped surface", () => {
  const { rows, hits } = scan(defaultSources());
  for (const row of rows.filter((r) => r.enforced)) {
    if (row.unlisted === 0) continue;
    const offenders = hits
      .filter((h) => h.term === row.id && h.allowedBy === null)
      .map((h) => `${h.file}:${h.line}: ${h.text}`)
      .join("\n");
    assert.equal(row.unlisted, 0, `term "${row.id}" has ${row.unlisted} unlisted hit(s):\n${offenders}`);
  }
});

// --- (b) no allow-list entry has rotted ---

test("DOCS-01: no allow-list entry has rotted (every ALLOWED entry still matches a live line)", () => {
  const { unusedAllow } = scan(defaultSources());
  const offenders = unusedAllow.map((a) => `${a.term} / ${a.file} / ${a.match} — ${a.reason}`).join("\n");
  assert.equal(unusedAllow.length, 0, `rotted ALLOWED entries (match zero live lines):\n${offenders}`);
});

// --- (c) teeth: a synthetic retired-surface comment is caught, and an ---
// --- ALLOWED entry excusing it is honored -------------------------------

test("teeth: a synthetic comment that presents a retired surface as live is reported unlisted", () => {
  const sources = [{ path: "x/a.js", text: "// the D-pad moves the party\nconst a = 1;\n" }];

  const { rows: rowsNoAllow } = scan(sources, { allowed: [] });
  const dpadNoAllow = rowsNoAllow.find((r) => r.id === "dpad");
  assert.equal(dpadNoAllow.unlisted, 1, "expected the synthetic D-pad line to be unlisted with no ALLOWED entries");

  const allowed = [{ term: "dpad", file: "x/a.js", match: "moves the party", reason: "t" }];
  const { rows: rowsAllowed } = scan(sources, { allowed });
  const dpadAllowed = rowsAllowed.find((r) => r.id === "dpad");
  assert.equal(dpadAllowed.unlisted, 0, "expected the ALLOWED entry to excuse the synthetic D-pad line");
  assert.equal(dpadAllowed.allowed, 1);
});

// --- (c2) Phase 79 (ROLL-04), plan 79-12: the retired roll-under phrasings ---

test("teeth: the roll-under term reports a comment or title quoting a retired roll-under phrase, and passes its roll-high rewrite", () => {
  const term = TERMS.find((t) => t.id === "roll-under");
  assert.ok(term && term.enforced, "the roll-under term is enforced");
  // Each retired family, built from parts so this file never spells one.
  const retired = [
    ["// Mirror Self: foes need", "a 1 to hit"],
    ["test(\"Smoke: every foe needs", "a natural 1\")"],
    ["// Battle Roar: every foe needs", "two better"],
    ["// a Zit is hittable", "only on a 4"],
    ["// traps are dodged", "on 1–5"],
    ["// Lockpicks: 1–5", "on d10 against any lock"],
    ["// Weaken: they hit", "on a 3"],
  ].map(([a, b]) => `${a} ${b}`);
  for (const line of retired) {
    const { rows } = scan([{ path: "x/r.js", text: `${line}\n` }], { allowed: [] });
    assert.equal(rows.find((r) => r.id === "roll-under").unlisted, 1, `expected "${line}" to be reported`);
  }
  const rollHigh = [
    "// Mirror Self: foes hit you only on their die's top face",
    "// Battle Roar: every foe has two fewer faces to hit",
    "// Lockpicks: 6–10 on d10 against any lock",
    "// a natural 1 fumbles the pick",
    "// a Fighter in Plate needs a natural 16",
    "// Weaken: no more than their die's top three faces hit",
  ];
  for (const line of rollHigh) {
    const { rows } = scan([{ path: "x/r.js", text: `${line}\n` }], { allowed: [] });
    assert.equal(rows.find((r) => r.id === "roll-under").total, 0, `expected "${line}" to pass`);
  }
});

// --- (d) informational rows never fail --------------------------------

test("informational rows never fail: classic-script and legacy-won are enforced:false", () => {
  const classicScript = TERMS.find((t) => t.id === "classic-script");
  const legacyWon = TERMS.find((t) => t.id === "legacy-won");
  assert.ok(classicScript, "classic-script term must exist");
  assert.ok(legacyWon, "legacy-won term must exist");
  assert.equal(classicScript.enforced, false);
  assert.equal(legacyWon.enforced, false);

  // A synthetic classic-script line lands only on that row and never
  // affects any enforced row's counts.
  const sources = [{ path: "x/b.js", text: "// the classic script owns paint()\n" }];
  const { rows } = scan(sources, { allowed: [] });
  const classicRow = rows.find((r) => r.id === "classic-script");
  assert.equal(classicRow.total, 1);
  for (const row of rows.filter((r) => r.enforced)) {
    assert.equal(row.total, 0, `enforced row "${row.id}" must not see the synthetic classic-script line`);
  }
});

// --- (e) shape: TERMS/ALLOWED are internally well-formed ----------------

test("shape: TERMS ids are unique and every ALLOWED entry names a known term with a non-empty file, match and reason", () => {
  const ids = TERMS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "TERMS ids must be unique");

  const termIds = new Set(ids);
  for (const entry of ALLOWED) {
    assert.ok(termIds.has(entry.term), `ALLOWED entry's term "${entry.term}" is not a known TERMS id`);
    assert.ok(typeof entry.file === "string" && entry.file.length > 0, `ALLOWED entry for "${entry.term}" has an empty file`);
    assert.ok(typeof entry.match === "string" && entry.match.length > 0, `ALLOWED entry for "${entry.term}" has an empty match`);
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 0, `ALLOWED entry for "${entry.term}" has an empty reason`);
    assert.doesNotThrow(() => new RegExp(entry.match), `ALLOWED entry for "${entry.term}" has an invalid match regex: ${entry.match}`);
  }
});
