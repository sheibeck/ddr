// test/unit/narrativeLines.test.js
//
// Phase 25.1 (Device Feedback Batch), Plan 01 — unit coverage for the
// narrationLines.js surface (CARD_EVENTS, NARRATIVE_ACTIONS,
// narrativeLineText, the ctx.narrate hook in linesForAction's step 7, and
// the tableFour/tableFourNoop builders that replace their old ORACLE_ONLY
// entries) plus eventNarration.js's new narrateEvent(e).

import test from "node:test";
import assert from "node:assert/strict";

import {
  CARD_EVENTS,
  NARRATIVE_ACTIONS,
  narrativeLineText,
  linesForAction,
  LINE_FOR,
  ORACLE_ONLY,
} from "../../src/browser/narrationLines.js";
import { narrateEvent, EVENT_NARRATION } from "../../src/browser/eventNarration.js";

// ─── CARD_EVENTS / NARRATIVE_ACTIONS ────────────────────────────────────

test("CARD_EVENTS is exactly floorChanged + leveled, disjoint from ORACLE_ONLY, and contains no line-only move event", () => {
  assert.deepEqual([...CARD_EVENTS].sort(), ["floorChanged", "leveled"]);

  const lineOnlyMoveEvents = [
    "trapSprung",
    "trapAvoided",
    "climbedOver",
    "fellInGorge",
    "chestOpened",
    "goldGained",
    "teleported",
    "darknessFell",
    "afflictionCured",
    "rested",
  ];
  for (const t of lineOnlyMoveEvents) {
    assert.equal(CARD_EVENTS.has(t), false, `${t} must not be in CARD_EVENTS`);
  }

  // leveled keeps its table line AND its card (they coexist); floorChanged
  // stays Oracle-only (the HUD's depth banner already shows it) even though
  // it is also a card event.
  assert.equal(typeof LINE_FOR.leveled, "function");
  assert.equal(ORACLE_ONLY.has("floorChanged"), true);
});

test("NARRATIVE_ACTIONS is exactly move + camp + resolveJoiner + dismissJoiner", () => {
  assert.deepEqual([...NARRATIVE_ACTIONS].sort(), ["camp", "dismissJoiner", "move", "resolveJoiner"]);
  for (const t of ["attack", "castSpell", "buyItem", "equipItem"]) {
    assert.equal(NARRATIVE_ACTIONS.has(t), false, `${t} must not be a narrative action`);
  }
});

// ─── narrativeLineText ──────────────────────────────────────────────────

test("narrativeLineText: strips the roll span, nested tags, decodes entities, collapses whitespace", () => {
  assert.equal(
    narrativeLineText('<span class="hurt">Pit trap finds you first.</span> <span class="roll">5 hp.</span>'),
    "Pit trap finds you first.",
  );
  assert.equal(
    narrativeLineText('<span class="hit"><b>Bram &amp; Co</b> say &quot;hi&quot; &lt;quietly&gt;&nbsp;now</span>'),
    'Bram & Co say "hi" <quietly> now',
  );
  assert.equal(narrativeLineText('<span class="roll">7 vs 5.</span>'), "");
  assert.equal(narrativeLineText(""), "");
  assert.equal(narrativeLineText(undefined), "");

  const stripped = narrativeLineText(narrateEvent({ type: "trapSprung", name: "Pit trap", dmg: 5 }));
  assert.doesNotMatch(stripped, /<[a-zA-Z]/, "no tag may survive");
  assert.doesNotMatch(stripped, /&[a-z#0-9]+;/, "no entity sequence may survive");
});

// ─── ctx.narrate hook ─────────────────────────────────────────────────────

// Phase 43 (CLAR-01): cause-first rewrite — trapSprung now leads with
// "Trap: " and states the cost as "−N hp." (see docs/CLARITY.md).
test("ctx.narrate: on a narrative action a direct-mapped line carries the Oracle sentence; without it the table text is unchanged", () => {
  const withNarrate = linesForAction("move", [{ type: "trapSprung", name: "Pit trap", dmg: 5 }], { narrate: narrateEvent });
  const withoutNarrate = linesForAction("move", [{ type: "trapSprung", name: "Pit trap", dmg: 5 }], {});

  assert.equal(withNarrate[0].text, "Trap: Pit trap finds you first. −5 hp.");
  assert.equal(withoutNarrate[0].text, "Trap: Pit trap (−5 hp).");
  assert.notEqual(withNarrate[0].text, withoutNarrate[0].text);
  assert.equal(withNarrate[0].tone, withoutNarrate[0].tone);
  assert.equal(withNarrate[0].priority, withoutNarrate[0].priority);
});

test("ctx.narrate never replaces a CARD_EVENTS line or an aggregated line", () => {
  const leveledWith = linesForAction("move", [{ type: "leveled", level: 2, wpGain: 5 }], { narrate: narrateEvent });
  const leveledWithout = linesForAction("move", [{ type: "leveled", level: 2, wpGain: 5 }], {});
  assert.deepEqual(leveledWith, leveledWithout);

  const struckEvents = [
    { type: "struckByFoe", name: "Rat", dmg: 3, roll: 2, need: 5 },
    { type: "struckByFoe", name: "Rat", dmg: 4, roll: 1, need: 5 },
  ];
  const aggWith = linesForAction("move", struckEvents, { narrate: narrateEvent });
  const aggWithout = linesForAction("move", struckEvents, {});
  assert.deepEqual(aggWith, aggWithout);
});

test("ctx.narrate fallback: a narration that strips to nothing falls back to the table text, never a blank line", () => {
  const tableText = linesForAction("move", [{ type: "goldGained", amount: 3 }], {})[0].text;

  const rollOnly = linesForAction("move", [{ type: "goldGained", amount: 3 }], {
    narrate: () => '<span class="roll">7 vs 5.</span>',
  });
  assert.equal(rollOnly[0].text, tableText);

  const empty = linesForAction("move", [{ type: "goldGained", amount: 3 }], { narrate: () => "" });
  assert.equal(empty[0].text, tableText);

  for (const line of [...rollOnly, ...empty]) {
    assert.notEqual(line.text, "", "a line text must never be blank");
  }
});

// ─── ordering / adjacency / empty ────────────────────────────────────────

test("ordering: three same-priority line-only events keep event order and each carries its own sentence", () => {
  const events = [
    { type: "climbedOver" },
    { type: "foodFound", name: "Bread", wp: 3 },
    { type: "darknessFell" },
  ];
  const out = linesForAction("move", events, { narrate: narrateEvent });
  assert.equal(out.length, 3);
  events.forEach((e, i) => {
    assert.equal(out[i].text, narrativeLineText(narrateEvent(e)));
  });
});

test("adjacency: a move carrying floorChanged AND a trap yields the trap line only (the card owns the floor line)", () => {
  const out = linesForAction(
    "move",
    [{ type: "floorChanged", depth: 2 }, { type: "trapSprung", name: "Pit trap", dmg: 5 }],
    { narrate: narrateEvent },
  );
  assert.equal(out.length, 1);
  // Phase 43 (CLAR-01): cause-first rewrite — see docs/CLARITY.md.
  assert.equal(out[0].text, "Trap: Pit trap finds you first. −5 hp.");
  assert.equal(CARD_EVENTS.has("floorChanged"), true);
});

test("empty: no events -> no lines under either ctx", () => {
  assert.deepEqual(linesForAction("move", [], { narrate: narrateEvent }), []);
});

// ─── tableFour / tableFourNoop ────────────────────────────────────────────

test("tableFour / tableFourNoop narrate their prose result and are no longer Oracle-only", () => {
  const result = LINE_FOR.tableFour({ type: "tableFour", result: "Something unseen takes its cut — 10 hp, gone." });
  assert.equal(result.text, "Something unseen takes its cut — 10 hp, gone.");
  assert.equal(result.tone, "beat");

  const noop = LINE_FOR.tableFourNoop({ type: "tableFourNoop" });
  assert.ok(typeof noop.text === "string" && noop.text.length > 0);

  assert.equal(ORACLE_ONLY.has("tableFour"), false);
  assert.equal(ORACLE_ONLY.has("tableFourNoop"), false);
});

// ─── narrateEvent ─────────────────────────────────────────────────────────

test("narrateEvent: '' for moved/unknown/null, the EVENT_NARRATION line otherwise", () => {
  assert.equal(narrateEvent({ type: "moved" }), "");
  assert.equal(narrateEvent({ type: "nonsenseType" }), "");
  assert.equal(narrateEvent(null), "");
  assert.equal(narrateEvent({ type: "teleported" }), EVENT_NARRATION.teleported({ type: "teleported" }));
});

// ─── joinerLeft (Phase 25.1, DFB-04) ───────────────────────────────────────

test("joinerLeft: a name containing '<' renders escaped and the pick is deterministic", () => {
  const html = EVENT_NARRATION.joinerLeft({ type: "joinerLeft", name: "<b>Ada", sub: "Knight", replacedBy: "Bo" });
  assert.ok(html.includes("&lt;b&gt;Ada"), "the name is escaped");
  assert.ok(!html.includes("<b>Ada"), "the raw tag never appears");
  const again = EVENT_NARRATION.joinerLeft({ type: "joinerLeft", name: "<b>Ada", sub: "Knight", replacedBy: "Bo" });
  assert.equal(html, again, "the pick is deterministic — same input, same line");
});

test("joinerLeft: every JOINER_EXIT_LINES entry contains {name}", async () => {
  const { JOINER_EXIT_LINES } = await import("../../content/flavor.js");
  assert.ok(JOINER_EXIT_LINES.length > 0);
  for (const line of JOINER_EXIT_LINES) assert.ok(line.includes("{name}"), `missing {name} in: ${line}`);
});

test("joinerLeft: narrativeLineText starts with the leaver's name", () => {
  const html = EVENT_NARRATION.joinerLeft({ type: "joinerLeft", name: "Ada", sub: "Knight", replacedBy: "Bo" });
  const text = narrativeLineText(html);
  assert.ok(text.startsWith("Ada "), `expected to start with "Ada ", got: ${text}`);
});
