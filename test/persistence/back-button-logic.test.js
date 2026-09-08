// test/persistence/back-button-logic.test.js
//
// PLT-02 (02-RESEARCH.md "Back Button + Lifecycle") — a pure, unit-testable
// decision function for the Android hardware/gesture back button. `@capacitor/
// app`'s `backButton` event disables Capacitor's own default entirely once
// ANY listener is registered, so this game owns 100% of back semantics; the
// one hard invariant this whole test file exists to prove is that there is
// NO input combination that lets a live, unconfirmed run end silently.
//
// src/browser/nativeChrome.js (02-03 Task 3) does not exist yet — this file
// is written RED-first (Wave-0 Task 1) against its not-yet-built export.

import test from "node:test";
import assert from "node:assert/strict";
import { decideBackAction } from "../../src/browser/nativeChrome.js";

test("returns close-modal when a modal/encounter card is open, regardless of any other state", () => {
  assert.equal(
    decideBackAction({ hasOpenModal: true, hasLiveRun: true, isAtRoot: true, canGoBack: false, alreadyConfirming: false }),
    "close-modal",
  );
  assert.equal(
    decideBackAction({ hasOpenModal: true, hasLiveRun: false, isAtRoot: false, canGoBack: true, alreadyConfirming: true }),
    "close-modal",
    "an open modal always wins, even mid-confirm or with no live run",
  );
});

test("returns navigate-back when not at root, no open modal, and there is somewhere to go back to", () => {
  assert.equal(
    decideBackAction({ hasOpenModal: false, hasLiveRun: true, isAtRoot: false, canGoBack: true, alreadyConfirming: false }),
    "navigate-back",
  );
});

test("returns confirm-quit (never exit-app) on the FIRST back press at root with a live, non-dead/non-won run", () => {
  assert.equal(
    decideBackAction({ hasOpenModal: false, hasLiveRun: true, isAtRoot: true, canGoBack: false, alreadyConfirming: false }),
    "confirm-quit",
  );
});

test("returns exit-app only once alreadyConfirming is true (the confirm step already happened)", () => {
  assert.equal(
    decideBackAction({ hasOpenModal: false, hasLiveRun: true, isAtRoot: true, canGoBack: false, alreadyConfirming: true }),
    "exit-app",
  );
});

test("returns exit-app immediately when there is no live run to lose (root, no modal, not confirming)", () => {
  assert.equal(
    decideBackAction({ hasOpenModal: false, hasLiveRun: false, isAtRoot: true, canGoBack: false, alreadyConfirming: false }),
    "exit-app",
  );
});

test("PLT-02: NO input combination with a live, unconfirmed run at root silently ends it — never exit-app", () => {
  for (const canGoBack of [true, false]) {
    for (const isAtRoot of [true, false]) {
      const action = decideBackAction({
        hasOpenModal: false,
        hasLiveRun: true,
        isAtRoot,
        canGoBack,
        alreadyConfirming: false,
      });
      assert.notEqual(
        action,
        "exit-app",
        `hasLiveRun=true, alreadyConfirming=false, isAtRoot=${isAtRoot}, canGoBack=${canGoBack} must never exit-app`,
      );
    }
  }
});

test("decideBackAction is pure: identical input always yields identical output and is never mutated", () => {
  const input = { hasOpenModal: false, hasLiveRun: true, isAtRoot: true, canGoBack: false, alreadyConfirming: false };
  const before = JSON.stringify(input);
  const a = decideBackAction(input);
  const b = decideBackAction(input);
  assert.equal(a, b);
  assert.equal(JSON.stringify(input), before, "decideBackAction must not mutate its input");
});
