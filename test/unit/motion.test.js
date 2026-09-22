// test/unit/motion.test.js
//
// Phase 58 (MOTION-02/05), Plan 01, Task 1 — pins src/browser/motion.js's
// one live reduced-motion predicate, its change subscription, the pinned
// open/close durations, and the timer-driven, cancellable panel close
// helper. One named test per <behavior> bullet in 58-01-PLAN.md, plus the
// two stripped-source checks (no completion-event listener, no window/
// document global) every Phase 58 pure module carries.
//
// Uses a tiny hand-rolled fake timer queue: an array of { id, at, fn }, a
// `now` counter, and `advance(ms)` that runs due entries in time order —
// mirrors this plan's own discovery note, no real setTimeout anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  REDUCED_MOTION_QUERY,
  prefersReducedMotion,
  onReducedMotionChange,
  OPEN_MS,
  MENU_OPEN_MS,
  CLOSE_MS,
  CLOSE_SLACK_MS,
  EASE_OUT_CSS,
  EASE_IN_CSS,
  createPanelMotion,
} from "../../src/browser/motion.js";
import { DISMISS_SETTLE_MS } from "../../src/browser/inputGuards.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fake timer queue ──────────────────────────────────────────────────
function makeFakeTimers() {
  let nextId = 1;
  let now = 0;
  const queue = [];
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      queue.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      const idx = queue.findIndex((e) => e.id === id);
      if (idx !== -1) queue.splice(idx, 1);
    },
    advance(ms) {
      now += ms;
      // run due entries in time order; a fired entry may itself schedule
      // another timer, so re-sort/re-scan until nothing more is due.
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const due = queue.findIndex((e) => e.at <= now);
        if (due === -1) break;
        const [entry] = queue.splice(due, 1);
        entry.fn();
      }
    },
    pendingCount() {
      return queue.length;
    },
  };
}

function makeEl() {
  return { hidden: false, dataset: {} };
}

// ─── 1. prefersReducedMotion basic true/false ────────────────────────────

test("prefersReducedMotion: matches true -> true, matches false -> false", () => {
  const winTrue = { matchMedia: (q) => ({ matches: q === REDUCED_MOTION_QUERY }) };
  assert.equal(prefersReducedMotion(winTrue), true);

  const winFalse = { matchMedia: () => ({ matches: false }) };
  assert.equal(prefersReducedMotion(winFalse), false);
});

// ─── 2. no caching ────────────────────────────────────────────────────────

test("prefersReducedMotion: no caching — a flipping stub returns the new value on the second call", () => {
  let matches = false;
  const win = { matchMedia: () => ({ matches }) };
  assert.equal(prefersReducedMotion(win), false);
  matches = true;
  assert.equal(prefersReducedMotion(win), true);
});

// ─── 3. fail-to-instant ────────────────────────────────────────────────────

test("prefersReducedMotion: fails to true on missing win, missing matchMedia, and a throwing matchMedia", () => {
  assert.equal(prefersReducedMotion(undefined), true);
  assert.equal(prefersReducedMotion({}), true);
  const throwingWin = {
    matchMedia() {
      throw new Error("boom");
    },
  };
  assert.equal(prefersReducedMotion(throwingWin), true);
});

// ─── 4. onReducedMotionChange ──────────────────────────────────────────────

test("onReducedMotionChange: addEventListener subscribes, fires cb, and unsubscribes cleanly", () => {
  let storedHandler = null;
  let removed = null;
  const list = {
    addEventListener(type, handler) {
      assert.equal(type, "change");
      storedHandler = handler;
    },
    removeEventListener(type, handler) {
      assert.equal(type, "change");
      removed = handler;
    },
  };
  const win = { matchMedia: () => list };
  const calls = [];
  const unsubscribe = onReducedMotionChange(win, (v) => calls.push(v));

  assert.equal(typeof storedHandler, "function");
  storedHandler({ matches: true });
  assert.deepEqual(calls, [true]);

  unsubscribe();
  assert.equal(removed, storedHandler);
});

test("onReducedMotionChange: legacy addListener API still subscribes", () => {
  let storedHandler = null;
  let removedViaLegacy = null;
  const list = {
    addListener(handler) {
      storedHandler = handler;
    },
    removeListener(handler) {
      removedViaLegacy = handler;
    },
  };
  const win = { matchMedia: () => list };
  const calls = [];
  const unsubscribe = onReducedMotionChange(win, (v) => calls.push(v));

  assert.equal(typeof storedHandler, "function");
  storedHandler({ matches: false });
  assert.deepEqual(calls, [false]);

  unsubscribe();
  assert.equal(removedViaLegacy, storedHandler);
});

test("onReducedMotionChange: a missing API returns a callable no-op and never throws", () => {
  const unsubA = onReducedMotionChange(undefined, () => {});
  assert.equal(typeof unsubA, "function");
  assert.doesNotThrow(() => unsubA());

  const unsubB = onReducedMotionChange({}, () => {});
  assert.equal(typeof unsubB, "function");
  assert.doesNotThrow(() => unsubB());

  const winNoSubscribeApi = { matchMedia: () => ({}) };
  const unsubC = onReducedMotionChange(winNoSubscribeApi, () => {});
  assert.equal(typeof unsubC, "function");
  assert.doesNotThrow(() => unsubC());

  const throwingWin = {
    matchMedia() {
      throw new Error("boom");
    },
  };
  const unsubD = onReducedMotionChange(throwingWin, () => {});
  assert.equal(typeof unsubD, "function");
  assert.doesNotThrow(() => unsubD());
});

// ─── 5. durations ───────────────────────────────────────────────────────

test("motion.js: pinned durations and easing tokens", () => {
  assert.equal(OPEN_MS, 180);
  assert.equal(MENU_OPEN_MS, 160);
  assert.equal(CLOSE_MS, 120);
  assert.equal(CLOSE_SLACK_MS, 34);
  assert.equal(EASE_OUT_CSS, "ease-out");
  assert.equal(EASE_IN_CSS, "ease-in");
  assert.ok(CLOSE_MS + CLOSE_SLACK_MS < DISMISS_SETTLE_MS);
});

// ─── 6. createPanelMotion: close() under reduced=false ───────────────────

test("createPanelMotion: close() stays visible, marks closing, schedules exactly one timer; advancing hides and fires cb once", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => false });
  const el = makeEl();
  let doneCalls = 0;

  motion.close(el, () => doneCalls++);
  assert.equal(el.hidden, false);
  assert.equal(el.dataset.motion, "closing");
  assert.equal(timers.pendingCount(), 1);

  timers.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(el.hidden, true);
  assert.equal(el.dataset.motion, undefined);
  assert.equal(doneCalls, 1);
});

// ─── 7. open() cancels a pending close ───────────────────────────────────

test("createPanelMotion: open() during a pending close clears the timer, never calls cb, and advancing afterward changes nothing", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => false });
  const el = makeEl();
  let doneCalls = 0;

  motion.close(el, () => doneCalls++);
  motion.open(el);

  assert.equal(el.hidden, false);
  assert.equal(el.dataset.motion, undefined);
  assert.equal(timers.pendingCount(), 0);

  timers.advance(CLOSE_MS + CLOSE_SLACK_MS);
  assert.equal(el.hidden, false);
  assert.equal(doneCalls, 0);
});

// ─── 8. no-op on already-hidden / already-closing ────────────────────────

test("createPanelMotion: close() on an already-hidden, not-closing element is a no-op; a second close while closing adds no second timer", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => false });

  const hiddenEl = makeEl();
  hiddenEl.hidden = true;
  let cbCalls = 0;
  motion.close(hiddenEl, () => cbCalls++);
  assert.equal(timers.pendingCount(), 0);
  assert.equal(hiddenEl.dataset.motion, undefined);
  assert.equal(cbCalls, 0);

  const el = makeEl();
  motion.close(el, () => {});
  assert.equal(timers.pendingCount(), 1);
  motion.close(el, () => {}); // second close while closing
  assert.equal(timers.pendingCount(), 1);
});

// ─── 9. reduced=true close() ──────────────────────────────────────────────

test("createPanelMotion: reduced true — close() hides synchronously, calls cb once, schedules no timer, writes no motion key", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => true });
  const el = makeEl();
  let doneCalls = 0;

  motion.close(el, () => doneCalls++);
  assert.equal(el.hidden, true);
  assert.equal(doneCalls, 1);
  assert.equal(timers.pendingCount(), 0);
  assert.equal(el.dataset.motion, undefined);
});

// ─── 10. finishAll() ────────────────────────────────────────────────────

test("createPanelMotion: finishAll() lands every pending close, calling each cb once, leaving no timer live", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => false });
  const elA = makeEl();
  const elB = makeEl();
  let aCalls = 0;
  let bCalls = 0;

  motion.close(elA, () => aCalls++);
  motion.close(elB, () => bCalls++);
  assert.equal(timers.pendingCount(), 2);

  motion.finishAll();
  assert.equal(elA.hidden, true);
  assert.equal(elB.hidden, true);
  assert.equal(aCalls, 1);
  assert.equal(bCalls, 1);
  assert.equal(timers.pendingCount(), 0);
});

// ─── 11. close(null) / open(null) ────────────────────────────────────────

test("createPanelMotion: close(null) and open(null) are no-ops that never throw", () => {
  const timers = makeFakeTimers();
  const motion = createPanelMotion({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, reduced: () => false });
  assert.doesNotThrow(() => motion.close(null, () => {}));
  assert.doesNotThrow(() => motion.open(null));
  assert.equal(timers.pendingCount(), 0);
});

// ─── source assertions ────────────────────────────────────────────────────

const MOTION_SRC_STRIPPED = stripJs(
  fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "motion.js"), "utf8"),
);

test("motion.js source: holds no completion-event listener of any kind", () => {
  assert.doesNotMatch(MOTION_SRC_STRIPPED, /transitionend/i);
  assert.doesNotMatch(MOTION_SRC_STRIPPED, /animationend/i);
});

test("motion.js source: never reads the window or document global directly", () => {
  assert.doesNotMatch(MOTION_SRC_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(MOTION_SRC_STRIPPED, /\bdocument\./);
});
