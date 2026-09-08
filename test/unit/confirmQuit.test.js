// Task 2 (TDD) — Confirm-before-quit gate (pure).
//
// RED-first: shouldConfirmQuit doesn't exist on src/browser/settings.js yet.
//
// Proves (04-UI-SPEC.md "Confirm-before-quit"): the gate honors the
// confirmBeforeQuit setting and only that setting — pure, no side effects,
// mirroring src/browser/nativeChrome.js#decideBackAction's pure-gate
// posture. Used to gate the Sheet's CUT LOSSES / ROLL ANOTHER action; RUN
// AWAY (combat) is deliberately NEVER routed through this gate — see
// settings.js's header note.

import test from "node:test";
import assert from "node:assert/strict";

import { shouldConfirmQuit } from "../../src/browser/settings.js";

test("shouldConfirmQuit: true when confirmBeforeQuit is ON", () => {
  assert.equal(shouldConfirmQuit({ confirmBeforeQuit: true }), true);
});

test("shouldConfirmQuit: false when confirmBeforeQuit is OFF", () => {
  assert.equal(shouldConfirmQuit({ confirmBeforeQuit: false }), false);
});

test("shouldConfirmQuit: false when confirmBeforeQuit is missing/undefined", () => {
  assert.equal(shouldConfirmQuit({}), false);
  assert.equal(shouldConfirmQuit(undefined), false);
});

test("shouldConfirmQuit: ignores unrelated fields on the settings object", () => {
  assert.equal(shouldConfirmQuit({ confirmBeforeQuit: true, sound: false, diceMode: "never" }), true);
  assert.equal(shouldConfirmQuit({ confirmBeforeQuit: false, sound: true }), false);
});
