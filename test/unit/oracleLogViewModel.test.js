// Task 2 (TDD) — Oracle-log view-model with dice-reveal gating (UX-05).
//
// RED-first: this file imports oracleLogViewModel from
// src/browser/viewModels.js, which does not export it yet, so `node --test`
// fails to load it. Adding the export (GREEN) turns it green.
//
// entries is the array of HTML narration lines src/browser/engineAdapter.js's
// formatEvents() already produces (04-RESEARCH.md read_first) — some lines
// embed a `<span class="roll">...</span>` roll-detail span, some don't.
// oracleLogViewModel splits each line into {narration, roll} and applies the
// diceMode gate: 'on tap' hides the roll until tapped (revealable, not
// revealed by default); 'always' shows it inline; 'never' omits it entirely.
// Reverse-chronological regardless of input order (entries accumulate
// oldest-first; the view-model reverses to newest-first for rendering). The
// combat log reuses this SAME function per 04-UI-SPEC.md.

import test from "node:test";
import assert from "node:assert/strict";

import { oracleLogViewModel } from "../../src/browser/viewModels.js";

const ENTRIES = [
  `<span class="banner">Day 1.</span>`, // no roll — a roll-less narration line
  `Surviving the floor is worth <span class="roll">7</span> skill points.`,
  `Rest restores <span class="hit">+4 wp</span>.`, // has markup but no roll span
  `Wandering monster check: <span class="roll">3</span> of 8 hours disturbed.`,
];

test("oracleLogViewModel(entries, diceMode): empty entries render as an empty array", () => {
  assert.deepEqual(oracleLogViewModel([], "on tap"), []);
});

test("oracleLogViewModel(entries, diceMode): one entry renders as a single row", () => {
  const rows = oracleLogViewModel([ENTRIES[1]], "on tap");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].roll, "7");
});

test("oracleLogViewModel(entries, diceMode): reverse-chronological ordering regardless of input order", () => {
  const rows = oracleLogViewModel(ENTRIES, "always");
  assert.equal(rows.length, ENTRIES.length);
  // newest (last-pushed) entry first
  assert.ok(rows[0].narration.includes("Wandering monster check"));
  assert.ok(rows[rows.length - 1].narration.includes("Day 1"));
});

test("oracleLogViewModel(entries, diceMode): 'on tap' -> revealable true, hidden (revealedByDefault false), roll data present for reveal", () => {
  const rows = oracleLogViewModel(ENTRIES, "on tap");
  const spGained = rows.find((r) => r.narration.includes("skill points"));
  assert.equal(spGained.revealable, true);
  assert.equal(spGained.revealedByDefault, false);
  assert.equal(spGained.roll, "7");
});

test("oracleLogViewModel(entries, diceMode): 'always' -> revealed by default, roll data present", () => {
  const rows = oracleLogViewModel(ENTRIES, "always");
  const spGained = rows.find((r) => r.narration.includes("skill points"));
  assert.equal(spGained.revealable, true);
  assert.equal(spGained.revealedByDefault, true);
  assert.equal(spGained.roll, "7");
});

test("oracleLogViewModel(entries, diceMode): 'never' -> roll omitted/null, not revealable", () => {
  const rows = oracleLogViewModel(ENTRIES, "never");
  const spGained = rows.find((r) => r.narration.includes("skill points"));
  assert.equal(spGained.roll, null);
  assert.equal(spGained.revealable, false);
  assert.equal(spGained.revealedByDefault, false);
});

test("oracleLogViewModel(entries, diceMode): a roll-less narration line has no reveal affordance under any diceMode", () => {
  for (const diceMode of ["on tap", "always", "never"]) {
    const rows = oracleLogViewModel(ENTRIES, diceMode);
    const dayBanner = rows.find((r) => r.narration.includes("Day 1"));
    assert.equal(dayBanner.roll, null, `diceMode=${diceMode}`);
    assert.equal(dayBanner.revealable, false, `diceMode=${diceMode}`);
    assert.equal(dayBanner.revealedByDefault, false, `diceMode=${diceMode}`);

    const restLine = rows.find((r) => r.narration.includes("Rest restores"));
    assert.equal(restLine.roll, null, `diceMode=${diceMode}`);
    assert.equal(restLine.revealable, false, `diceMode=${diceMode}`);
  }
});

test("oracleLogViewModel(entries, diceMode): narration text has the roll span stripped out (dice detail is a separate field, not embedded twice)", () => {
  const rows = oracleLogViewModel(ENTRIES, "always");
  const spGained = rows.find((r) => r.roll === "7");
  assert.equal(spGained.narration.includes("<span"), false);
  assert.ok(spGained.narration.includes("Surviving the floor is worth"));
  assert.ok(spGained.narration.includes("skill points"));
});
