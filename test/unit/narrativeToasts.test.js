// test/unit/narrativeToasts.test.js
//
// Phase 25.1 (Device Feedback Batch), Plan 01 — unit coverage for the new
// toasts.js surface (CARD_EVENTS, NARRATIVE_ACTIONS, toastLifetime +
// constants, narrativeToastText, the ctx.narrate hook in toastsForAction's
// step 7, and the tableFour/tableFourNoop builders that replace their old
// ORACLE_ONLY entries) plus eventNarration.js's new narrateEvent(e).

import test from "node:test";
import assert from "node:assert/strict";

import {
  CARD_EVENTS,
  NARRATIVE_ACTIONS,
  TOAST_BASE_MS,
  TOAST_PER_CHAR_MS,
  TOAST_CAP_MS,
  TOAST_STACK_BONUS_MS,
  toastLifetime,
  narrativeToastText,
  toastsForAction,
  TOAST_FOR,
  ORACLE_ONLY,
} from "../../src/browser/toasts.js";
import { narrateEvent, EVENT_NARRATION } from "../../src/browser/eventNarration.js";

// ─── CARD_EVENTS / NARRATIVE_ACTIONS ────────────────────────────────────

test("CARD_EVENTS is exactly floorChanged + leveled, disjoint from ORACLE_ONLY, and contains no toast-only move event", () => {
  assert.deepEqual([...CARD_EVENTS].sort(), ["floorChanged", "leveled"]);

  const toastOnlyMoveEvents = [
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
  for (const t of toastOnlyMoveEvents) {
    assert.equal(CARD_EVENTS.has(t), false, `${t} must not be in CARD_EVENTS`);
  }

  // leveled keeps its table toast AND its card (they coexist); floorChanged
  // stays Oracle-only (the HUD's depth banner already shows it) even though
  // it is also a card event.
  assert.equal(typeof TOAST_FOR.leveled, "function");
  assert.equal(ORACLE_ONLY.has("floorChanged"), true);
});

test("NARRATIVE_ACTIONS is exactly move + camp + resolveJoiner", () => {
  assert.deepEqual([...NARRATIVE_ACTIONS].sort(), ["camp", "move", "resolveJoiner"]);
  for (const t of ["attack", "castSpell", "buyItem", "equipItem"]) {
    assert.equal(NARRATIVE_ACTIONS.has(t), false, `${t} must not be a narrative action`);
  }
});

// ─── narrativeToastText ──────────────────────────────────────────────────

test("narrativeToastText: strips the roll span, nested tags, decodes entities, collapses whitespace", () => {
  assert.equal(
    narrativeToastText('<span class="hurt">Pit trap finds you first.</span> <span class="roll">5 hp.</span>'),
    "Pit trap finds you first.",
  );
  assert.equal(
    narrativeToastText('<span class="hit"><b>Bram &amp; Co</b> say &quot;hi&quot; &lt;quietly&gt;&nbsp;now</span>'),
    'Bram & Co say "hi" <quietly> now',
  );
  assert.equal(narrativeToastText('<span class="roll">7 vs 5.</span>'), "");
  assert.equal(narrativeToastText(""), "");
  assert.equal(narrativeToastText(undefined), "");

  const stripped = narrativeToastText(narrateEvent({ type: "trapSprung", name: "Pit trap", dmg: 5 }));
  assert.doesNotMatch(stripped, /<[a-zA-Z]/, "no tag may survive");
  assert.doesNotMatch(stripped, /&[a-z#0-9]+;/, "no entity sequence may survive");
});

// ─── toastLifetime ────────────────────────────────────────────────────────

test("toastLifetime: the DFB-02 boundary table, integer output, clamped visible", () => {
  assert.equal(toastLifetime(0, 0), 3000);
  assert.equal(toastLifetime(1, 0), 3060);
  assert.equal(toastLifetime(99, 0), 8940);
  assert.equal(toastLifetime(100, 0), 9000);
  assert.equal(toastLifetime(101, 0), 9000);

  assert.equal(toastLifetime(0, 3), 6600);
  assert.equal(toastLifetime(100, 3), 12600);
  assert.equal(toastLifetime(100, 4), toastLifetime(100, 3), "visible 4 clamps to 3 (MAX_TOASTS - 1)");
  assert.equal(toastLifetime(0, -1), toastLifetime(0, 0), "visible -1 clamps to 0");

  for (const [len, visible] of [
    [0, 0],
    [1, 0],
    [99, 0],
    [100, 0],
    [101, 0],
    [0, 3],
    [100, 3],
  ]) {
    assert.ok(Number.isInteger(toastLifetime(len, visible)), `toastLifetime(${len}, ${visible}) must be an integer`);
  }

  assert.equal(TOAST_BASE_MS, 3000);
  assert.equal(TOAST_PER_CHAR_MS, 60);
  assert.equal(TOAST_CAP_MS, 9000);
  assert.equal(TOAST_STACK_BONUS_MS, 1200);
});

// ─── ctx.narrate hook ─────────────────────────────────────────────────────

test("ctx.narrate: on a narrative action a direct-mapped toast carries the Oracle sentence; without it the table text is unchanged", () => {
  const withNarrate = toastsForAction("move", [{ type: "trapSprung", name: "Pit trap", dmg: 5 }], { narrate: narrateEvent });
  const withoutNarrate = toastsForAction("move", [{ type: "trapSprung", name: "Pit trap", dmg: 5 }], {});

  assert.equal(withNarrate[0].text, "Pit trap finds you first.");
  assert.equal(withoutNarrate[0].text, "Pit trap (5).");
  assert.notEqual(withNarrate[0].text, withoutNarrate[0].text);
  assert.equal(withNarrate[0].tone, withoutNarrate[0].tone);
  assert.equal(withNarrate[0].priority, withoutNarrate[0].priority);
});

test("ctx.narrate never replaces a CARD_EVENTS toast or an aggregated toast", () => {
  const leveledWith = toastsForAction("move", [{ type: "leveled", level: 2, wpGain: 5 }], { narrate: narrateEvent });
  const leveledWithout = toastsForAction("move", [{ type: "leveled", level: 2, wpGain: 5 }], {});
  assert.deepEqual(leveledWith, leveledWithout);

  const struckEvents = [
    { type: "struckByFoe", name: "Rat", dmg: 3, roll: 2, need: 5 },
    { type: "struckByFoe", name: "Rat", dmg: 4, roll: 1, need: 5 },
  ];
  const aggWith = toastsForAction("move", struckEvents, { narrate: narrateEvent });
  const aggWithout = toastsForAction("move", struckEvents, {});
  assert.deepEqual(aggWith, aggWithout);
});

test("ctx.narrate fallback: a narration that strips to nothing falls back to the table text, never a blank toast", () => {
  const tableText = toastsForAction("move", [{ type: "goldGained", amount: 3 }], {})[0].text;

  const rollOnly = toastsForAction("move", [{ type: "goldGained", amount: 3 }], {
    narrate: () => '<span class="roll">7 vs 5.</span>',
  });
  assert.equal(rollOnly[0].text, tableText);

  const empty = toastsForAction("move", [{ type: "goldGained", amount: 3 }], { narrate: () => "" });
  assert.equal(empty[0].text, tableText);

  for (const toast of [...rollOnly, ...empty]) {
    assert.notEqual(toast.text, "", "a toast text must never be blank");
  }
});

// ─── ordering / adjacency / empty ────────────────────────────────────────

test("ordering: three same-priority toast-only events keep event order and each carries its own sentence", () => {
  const events = [
    { type: "climbedOver" },
    { type: "foodFound", name: "Bread", wp: 3 },
    { type: "darknessFell" },
  ];
  const out = toastsForAction("move", events, { narrate: narrateEvent });
  assert.equal(out.length, 3);
  events.forEach((e, i) => {
    assert.equal(out[i].text, narrativeToastText(narrateEvent(e)));
  });
});

test("adjacency: a move carrying floorChanged AND a trap yields the trap toast only (the card owns the floor line)", () => {
  const out = toastsForAction(
    "move",
    [{ type: "floorChanged", depth: 2 }, { type: "trapSprung", name: "Pit trap", dmg: 5 }],
    { narrate: narrateEvent },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Pit trap finds you first.");
  assert.equal(CARD_EVENTS.has("floorChanged"), true);
});

test("empty: no events -> no toasts under either ctx", () => {
  assert.deepEqual(toastsForAction("move", [], { narrate: narrateEvent }), []);
});

// ─── tableFour / tableFourNoop ────────────────────────────────────────────

test("tableFour / tableFourNoop toast their prose result and are no longer Oracle-only", () => {
  const result = TOAST_FOR.tableFour({ type: "tableFour", result: "Something unseen takes its cut — 10 hp, gone." });
  assert.equal(result.text, "Something unseen takes its cut — 10 hp, gone.");
  assert.equal(result.tone, "beat");

  const noop = TOAST_FOR.tableFourNoop({ type: "tableFourNoop" });
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
