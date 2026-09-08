// Task 3 (TDD) — Coach-mark sequencer + feature-icon loader (UX-06, UX-03 icons).
//
// RED-first: this file imports src/browser/tutorial.js (does not exist yet)
// and featureKeyForCell from src/browser/icons.js (does not exist yet), so
// `node --test` fails to load it. Implementing both modules (GREEN) turns it
// green.
//
// Covers (04-03-PLAN.md must_haves / T-04-07): the sequencer's
// current()/next()/dismiss()/isComplete() transitions, tutorialSeen
// round-tripping ONLY through window.mzStorage/storage.js (never raw
// localStorage), every COACH_MARK_STEPS copy staying within the "no wall of
// text" length cap, and featureKeyForCell mapping every engine feat key
// mazeworld.html's draw() renders (dot/tele/one/trap/chest/climb/gorge/
// exit/gate) to the correct one of the 9 provided PNG keys. icons.js's
// Image()/canvas parts are browser-only and deferred to device-UAT — this
// file only exercises the pure featureKeyForCell mapping, and asserts icons.js
// imports cleanly under node --test (no Image() construction at module top
// level).

import test from "node:test";
import assert from "node:assert/strict";

import {
  COACH_MARK_STEPS,
  COACH_MARK_COPY_MAX_CHARS,
  makeTutorialSequencer,
  getTutorialSeen,
  setTutorialSeen,
  TUTORIAL_SEEN_KEY,
} from "../../src/browser/tutorial.js";
import { flush as flushStorage } from "../../src/browser/storage.js";
import { FEATURE_ICONS, PLAYER_MARKER_ICON, featureKeyForCell, drawFeatureIcon } from "../../src/browser/icons.js";

/** A minimal fake CanvasRenderingContext2D that just records call order/args. */
function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (x, y) => calls.push(["translate", x, y]),
    rotate: (rad) => calls.push(["rotate", rad]),
    drawImage: (img, x, y, w, h) => calls.push(["drawImage", x, y, w, h]),
  };
}

async function withFakeLocalStorage(fn) {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    return await fn(globalThis.localStorage, store);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

// --- sequencer transitions ---------------------------------------------------

test("makeTutorialSequencer: current() starts at the first step", () => {
  const seq = makeTutorialSequencer(COACH_MARK_STEPS);
  assert.equal(seq.current(), COACH_MARK_STEPS[0]);
  assert.equal(seq.isComplete(), false);
});

test("makeTutorialSequencer: next() advances through every fixed step in order", () => {
  const seq = makeTutorialSequencer(COACH_MARK_STEPS);
  for (let i = 1; i < COACH_MARK_STEPS.length; i++) {
    const step = seq.next();
    assert.equal(step, COACH_MARK_STEPS[i]);
    assert.equal(seq.current(), COACH_MARK_STEPS[i]);
  }
});

test("makeTutorialSequencer: next() past the last step completes the sequence", () => {
  const seq = makeTutorialSequencer(COACH_MARK_STEPS);
  for (let i = 1; i < COACH_MARK_STEPS.length; i++) seq.next();
  assert.equal(seq.isComplete(), false); // still on the last real step
  const past = seq.next();
  assert.equal(past, null);
  assert.equal(seq.isComplete(), true);
  assert.equal(seq.current(), null);
});

test("makeTutorialSequencer: dismiss() completes the sequence immediately from any step", () => {
  const seq = makeTutorialSequencer(COACH_MARK_STEPS);
  seq.next();
  seq.dismiss();
  assert.equal(seq.isComplete(), true);
  assert.equal(seq.current(), null);
  assert.equal(seq.next(), null); // no-op once complete
});

test("makeTutorialSequencer: an empty step list starts already complete", () => {
  const seq = makeTutorialSequencer([]);
  assert.equal(seq.isComplete(), true);
  assert.equal(seq.current(), null);
});

// --- tutorialSeen persistence (window.mzStorage / storage.js ONLY) ----------

test("getTutorialSeen(): unset store defaults to false (fail-open — tutorial shows on a genuine first run)", async () => {
  await withFakeLocalStorage(async () => {
    assert.equal(await getTutorialSeen(), false);
  });
});

test("setTutorialSeen()/getTutorialSeen(): round-trips through storage.js (window.mzStorage's backing abstraction)", async () => {
  await withFakeLocalStorage(async (_ls, store) => {
    await setTutorialSeen(true);
    await flushStorage();
    assert.equal(await getTutorialSeen(), true);
    assert.equal(store.has(TUTORIAL_SEEN_KEY), true);

    await setTutorialSeen(false);
    await flushStorage();
    assert.equal(await getTutorialSeen(), false);
  });
});

test("tutorial.js never touches raw localStorage directly (only via storage.js/window.mzStorage)", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../src/browser/tutorial.js", import.meta.url), "utf8");
  assert.equal(/\blocalStorage\b/.test(src), false);
});

// --- coach-mark copy length cap ("no wall of text") -------------------------

test("COACH_MARK_STEPS: exactly the ~4 fixed onboarding steps from 04-CONTEXT.md (move / trap / descend / starving)", () => {
  assert.equal(COACH_MARK_STEPS.length, 4);
  for (const step of COACH_MARK_STEPS) {
    assert.equal(typeof step.id, "string");
    assert.equal(typeof step.target, "string");
    assert.equal(typeof step.copy, "string");
  }
});

test("COACH_MARK_STEPS: every step's copy stays within the 'no wall of text' length cap", () => {
  for (const step of COACH_MARK_STEPS) {
    assert.ok(
      step.copy.length <= COACH_MARK_COPY_MAX_CHARS,
      `step "${step.id}" copy is ${step.copy.length} chars, over the ${COACH_MARK_COPY_MAX_CHARS} cap: "${step.copy}"`
    );
    // "1-2 short lines" — no more than one internal line break.
    assert.ok(step.copy.split("\n").length <= 2, `step "${step.id}" copy has more than 2 lines`);
  }
});

// --- featureKeyForCell (icons.js, pure, DOM-free) ----------------------------

test("icons.js: FEATURE_ICONS is exactly the 9 provided PNG keys", () => {
  assert.deepEqual(
    [...FEATURE_ICONS].sort(),
    ["chest", "crevice", "descent", "encounter", "onewaydoor", "party", "teleport", "trap", "wall"].sort()
  );
});

test("icons.js: PLAYER_MARKER_ICON is the party icon", () => {
  assert.equal(PLAYER_MARKER_ICON, "party");
  assert.ok(FEATURE_ICONS.includes(PLAYER_MARKER_ICON));
});

test("featureKeyForCell: maps every engine feat key mazeworld.html draw() renders to the correct PNG key", () => {
  const cases = [
    ["dot", "encounter"],
    ["tele", "teleport"],
    ["one", "onewaydoor"],
    ["trap", "trap"],
    ["chest", "chest"],
    ["climb", "wall"],
    ["gorge", "crevice"],
    ["exit", "descent"],
    ["gate", "descent"],
  ];
  for (const [feat, expected] of cases) {
    assert.equal(featureKeyForCell(feat), expected, `feat "${feat}"`);
    // Also accept a real engine/maze.js floor-cell shape (g[y][x] = {feat, ...}).
    assert.equal(featureKeyForCell({ feat, seen: true, dark: false }), expected, `cell.feat "${feat}"`);
  }
});

test("featureKeyForCell: an unfeatured/unrecognized cell returns null (no icon drawn, never a crash)", () => {
  assert.equal(featureKeyForCell(null), null);
  assert.equal(featureKeyForCell(undefined), null);
  assert.equal(featureKeyForCell({ feat: null }), null);
  assert.equal(featureKeyForCell("not-a-real-feat"), null);
});

test("icons.js imports cleanly under node --test (no Image()/canvas construction at module top level)", () => {
  assert.equal(typeof featureKeyForCell, "function");
});

// --- drawFeatureIcon dir/rotation (DR5, pure logic against a fake ctx) ------

test("drawFeatureIcon: no dir arg draws unrotated (every non-door icon + the player marker)", () => {
  const ctx = makeFakeCtx();
  const img = {};
  drawFeatureIcon(ctx, img, 10, 20, 32);
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["drawImage"]);
  assert.equal(ctx.calls[0][1], 10 + (32 - Math.round(32 * 1.08)) / 2);
});

test("drawFeatureIcon: an unrecognized dir value fails open — draws unrotated", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "NE");
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["drawImage"]);
});

test("drawFeatureIcon: dir='E' rotates 0deg (base onewaydoor.png already points East/right)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "E");
  assert.deepEqual(ctx.calls.map((c) => c[0]), ["save", "translate", "rotate", "drawImage", "restore"]);
  assert.equal(ctx.calls[2][1], 0);
});

test("drawFeatureIcon: dir='S' rotates 90deg clockwise (points down)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "S");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - Math.PI / 2) < 1e-9);
});

test("drawFeatureIcon: dir='W' rotates 180deg (points left)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "W");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - Math.PI) < 1e-9);
});

test("drawFeatureIcon: dir='N' rotates 270deg (points up)", () => {
  const ctx = makeFakeCtx();
  drawFeatureIcon(ctx, {}, 0, 0, 32, "N");
  assert.equal(ctx.calls[2][0], "rotate");
  assert.ok(Math.abs(ctx.calls[2][1] - (3 * Math.PI) / 2) < 1e-9);
});

test("drawFeatureIcon: rotated draw is centered on the cell (translate to cell center, drawImage offset by -iconSize/2)", () => {
  const ctx = makeFakeCtx();
  const size = 32;
  drawFeatureIcon(ctx, {}, 100, 200, size, "S");
  const iconSize = Math.round(size * 1.08);
  assert.deepEqual(ctx.calls[1], ["translate", 100 + size / 2, 200 + size / 2]);
  assert.deepEqual(ctx.calls[3], ["drawImage", -iconSize / 2, -iconSize / 2, iconSize, iconSize]);
});
