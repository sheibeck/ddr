// test/unit/ailment-narration.test.js
//
// Phase 75 (RULES-07), Plan 04 Task 1 — pins the honest ailment 5-6
// narration fix. AFFLICTIONS rows 5 and 6 stay canon (a disease of the mind
// that gives a phobia — content/afflictions.js and engine/encounters.js are
// unchanged); only the words eventNarration.js's Oracle line and
// narrationLines.js's rail line print for those two rolls change, so the
// player is never told "Disease." for a roll that gives a phobia instead.
// The real Disease/Poison rows (1-4, 7, 8) keep their exact wording.

import test from "node:test";
import assert from "node:assert/strict";

import { AFFLICTIONS } from "../../content/afflictions.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";

// Sanity on the fixture itself — the rows this test depends on stay canon.
test("AFFLICTIONS rows 5-6 are the phobia rows; rows 1-4/7/8 are real Disease/Poison", () => {
  assert.equal(AFFLICTIONS[4].phobia, true);
  assert.equal(AFFLICTIONS[5].phobia, true);
  assert.equal(AFFLICTIONS[4].kind, "Disease");
  assert.equal(AFFLICTIONS[5].kind, "Disease");
  assert.equal(AFFLICTIONS[1].phobia, undefined, "row 2 (index 1) is a real Disease row");
  assert.equal(AFFLICTIONS[7].phobia, undefined, "row 8 (index 7) is a real Disease row");
  assert.equal(AFFLICTIONS[0].phobia, undefined, "row 1 (index 0) is a real Poison row");
});

// ─── eventNarration.js (Oracle) ─────────────────────────────────────────────

test("EVENT_NARRATION.afflictionRolled: roll 5 keeps the roll clause in its span, names the fear, never 'Disease'", () => {
  const text = EVENT_NARRATION.afflictionRolled({ roll: 5, kind: "Disease" });
  assert.match(text, /<span class="roll">The die turns up 5\.<\/span>/);
  assert.doesNotMatch(text, /Disease/);
});

test("EVENT_NARRATION.afflictionRolled: roll 6 behaves the same way as roll 5", () => {
  const text = EVENT_NARRATION.afflictionRolled({ roll: 6, kind: "Disease" });
  assert.match(text, /<span class="roll">The die turns up 6\.<\/span>/);
  assert.doesNotMatch(text, /Disease/);
});

test("EVENT_NARRATION.afflictionRolled: rolls 2 and 8 (real Disease rows) still end 'Disease.'", () => {
  assert.match(EVENT_NARRATION.afflictionRolled({ roll: 2, kind: "Disease" }), /Disease\.$/);
  assert.match(EVENT_NARRATION.afflictionRolled({ roll: 8, kind: "Disease" }), /Disease\.$/);
});

test("EVENT_NARRATION.afflictionRolled: roll 1 (real Poison row) still ends 'Poison.'", () => {
  assert.match(EVENT_NARRATION.afflictionRolled({ roll: 1, kind: "Poison" }), /Poison\.$/);
});

test("EVENT_NARRATION.afflictionRolled: a missing roll falls back to today's wording, never a false diagnosis", () => {
  const bare = EVENT_NARRATION.afflictionRolled({});
  assert.match(bare, /Something has its hooks in you\.$/);
  assert.doesNotMatch(bare, /Disease|nerve/);
});

test("EVENT_NARRATION.afflictionRolled: a zero/out-of-range roll has no matching row — prints e.kind exactly as today rather than guessing a fear", () => {
  const zero = EVENT_NARRATION.afflictionRolled({ roll: 0, kind: "Disease" });
  assert.match(zero, /Disease\.$/, "no row to read phobia from, so kind is printed unchanged — never overridden to a fear line it cannot confirm");
});

test("EVENT_NARRATION.afflictionRolled: stripping the roll span off the roll-5 line leaves a clean sentence", () => {
  const text = EVENT_NARRATION.afflictionRolled({ roll: 5, kind: "Disease" });
  const stripped = text.replace(/<span class="roll">.*?<\/span>/, "").replace(/\s+/g, " ").trim();
  assert.equal(stripped, "Something is wrong with you. Not your body — your nerve.");
});

// ─── narrationLines.js (rail) ───────────────────────────────────────────────

test("LINE_FOR.afflictionRolled: rolls 5 and 6 read the mind wording, no 'Disease'", () => {
  const line5 = LINE_FOR.afflictionRolled({ roll: 5, kind: "Disease" });
  const line6 = LINE_FOR.afflictionRolled({ roll: 6, kind: "Disease" });
  assert.doesNotMatch(line5.text, /Disease/);
  assert.doesNotMatch(line6.text, /Disease/);
  assert.match(line5.text, /nerve/);
});

test("LINE_FOR.afflictionRolled: roll 2 (real Disease row) still says 'Disease'", () => {
  const line = LINE_FOR.afflictionRolled({ roll: 2, kind: "Disease" });
  assert.match(line.text, /Disease/);
});

test("LINE_FOR.afflictionRolled: a missing roll falls back to today's wording", () => {
  const line = LINE_FOR.afflictionRolled({});
  assert.equal(line.text, "Something is wrong with you: it has its hooks in you.");
});
