// test/unit/longPress.test.js
//
// Phase 71 (POLISH-08, D-08) — the long-press recognizer,
// src/browser/longPress.js: fire at the hold, cancel on travel, a second
// finger, a pointercancel or a scroll, and hand the shell a once-only
// click-suppression answer (so a long press never also fires the tap).
// A fake timer and a fake clock drive every case; the thresholds are the
// map's own hold-inspect constants from src/browser/tapStep.js.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createLongPress, CLICK_SUPPRESS_MS } from "../../src/browser/longPress.js";
import { HOLD_MS, TAP_MAX_TRAVEL_PX } from "../../src/browser/tapStep.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "src", "browser", "longPress.js"), "utf8");

/** clock() — a fake setTimeout/clearTimeout/now with advance(ms). */
function clock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, due: t + ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [id, tm] of timers) if (tm.due <= end && (!next || tm.due < next[1].due)) next = [id, tm];
        if (!next) break;
        timers.delete(next[0]);
        t = next[1].due;
        next[1].fn();
      }
      t = end;
    },
    pending: () => timers.size,
  };
}

function rig(over = {}) {
  const k = clock();
  const fired = [];
  const lp = createLongPress({
    setTimeout: k.setTimeout,
    clearTimeout: k.clearTimeout,
    now: k.now,
    onLongPress: (foe) => fired.push(foe),
    ...over,
  });
  return { k, lp, fired };
}

const P = (over = {}) => ({ id: 1, x: 100, y: 200, foe: 2, ...over });

test("defaults are the map's hold-inspect constants (450 ms, 10 px), imported not retyped", () => {
  assert.equal(HOLD_MS, 450);
  assert.equal(TAP_MAX_TRAVEL_PX, 10);
  assert.match(SRC, /import\s*\{[^}]*HOLD_MS[^}]*TAP_MAX_TRAVEL_PX[^}]*\}\s*from\s*"\.\/tapStep\.js"/);
  assert.ok(!/\b450\b/.test(SRC.replace(/\/\/.*$/gm, "")), "450 is not retyped");
});

test("fires at exactly HOLD_MS, not at HOLD_MS - 1, and only once", () => {
  const { k, lp, fired } = rig();
  lp.down(P());
  k.advance(HOLD_MS - 1);
  assert.deepEqual(fired, []);
  k.advance(1);
  assert.deepEqual(fired, [2]);
  k.advance(5000);
  assert.deepEqual(fired, [2]);
  assert.deepEqual(lp.up(P()), { fired: true });
});

test("travel of exactly maxTravel still fires; maxTravel + 1 cancels (max travel from the down point)", () => {
  const a = rig();
  a.lp.down(P());
  a.lp.move(P({ x: 100 + TAP_MAX_TRAVEL_PX }));
  a.lp.move(P({ x: 100 }));
  a.k.advance(HOLD_MS);
  assert.deepEqual(a.fired, [2]);

  const b = rig();
  b.lp.down(P());
  b.lp.move(P({ y: 200 + TAP_MAX_TRAVEL_PX + 1 }));
  b.lp.move(P({ y: 200 })); // coming back does not re-arm
  b.k.advance(HOLD_MS * 2);
  assert.deepEqual(b.fired, []);
  assert.equal(b.lp.consumeClick(), false);

  const c = rig();
  c.lp.down(P());
  c.lp.move(P({ x: 106, y: 208 })); // hypot(6, 8) = 10
  c.k.advance(HOLD_MS);
  assert.deepEqual(c.fired, [2]);
});

test("a move from another pointer id is ignored", () => {
  const { k, lp, fired } = rig();
  lp.down(P());
  lp.move(P({ id: 9, x: 900 }));
  k.advance(HOLD_MS);
  assert.deepEqual(fired, [2]);
});

test("a second finger while one is armed cancels both; nothing fires", () => {
  const { k, lp, fired } = rig();
  lp.down(P());
  k.advance(100);
  lp.down(P({ id: 2, x: 300 }));
  k.advance(HOLD_MS * 2);
  assert.deepEqual(fired, []);
  assert.equal(k.pending(), 0);
  assert.equal(lp.consumeClick(), false);
});

test("up before the hold cancels: nothing fires and the click is not swallowed", () => {
  const { k, lp, fired } = rig();
  lp.down(P());
  k.advance(HOLD_MS - 1);
  assert.deepEqual(lp.up(P()), { fired: false });
  k.advance(HOLD_MS);
  assert.deepEqual(fired, []);
  assert.equal(lp.consumeClick(), false);
});

test("consumeClick: true exactly once after a fired press, false on the second call", () => {
  const { k, lp } = rig();
  lp.down(P());
  k.advance(HOLD_MS);
  lp.up(P());
  assert.equal(lp.consumeClick(), true);
  assert.equal(lp.consumeClick(), false);
});

test("consumeClick: false after the next down (a new gesture owns its own click)", () => {
  const { k, lp } = rig();
  lp.down(P());
  k.advance(HOLD_MS);
  lp.up(P());
  lp.down(P({ id: 3 }));
  assert.equal(lp.consumeClick(), false);
});

test("consumeClick: bounded window after the up, so a lost click never swallows a later tap", () => {
  const a = rig();
  a.lp.down(P());
  a.k.advance(HOLD_MS + 2000); // held well past the hold
  a.lp.up(P());
  a.k.advance(CLICK_SUPPRESS_MS);
  assert.equal(a.lp.consumeClick(), true, "at the window's edge the trailing click is still swallowed");

  const b = rig();
  b.lp.down(P());
  b.k.advance(HOLD_MS);
  b.lp.up(P());
  b.k.advance(CLICK_SUPPRESS_MS + 1);
  assert.equal(b.lp.consumeClick(), false);
  assert.ok(CLICK_SUPPRESS_MS > 0 && CLICK_SUPPRESS_MS <= 1000);
});

test("cancel() clears everything; a pending timer never fires afterwards", () => {
  const { k, lp, fired } = rig();
  lp.down(P());
  k.advance(HOLD_MS - 10);
  lp.cancel();
  k.advance(HOLD_MS);
  assert.deepEqual(fired, []);
  assert.equal(k.pending(), 0);

  lp.down(P());
  k.advance(HOLD_MS);
  assert.deepEqual(fired, [2]);
  lp.cancel();
  assert.equal(lp.consumeClick(), false);
  assert.deepEqual(lp.up(P()), { fired: false });
});

test("custom holdMs and maxTravel are honoured", () => {
  const { k, lp, fired } = rig({ holdMs: 200, maxTravel: 3 });
  lp.down(P());
  lp.move(P({ x: 103 }));
  k.advance(199);
  assert.deepEqual(fired, []);
  k.advance(1);
  assert.deepEqual(fired, [2]);
});

test("never throws on a missing or malformed pointer, and a missing hook is harmless", () => {
  const { k, lp, fired } = rig();
  for (const bad of [undefined, null, {}, { id: 1 }, { id: 1, x: "a", y: NaN }, 7, "x"]) {
    assert.doesNotThrow(() => lp.down(bad));
    assert.doesNotThrow(() => lp.move(bad));
    assert.doesNotThrow(() => lp.up(bad));
  }
  k.advance(HOLD_MS * 2);
  assert.deepEqual(fired, []);
  assert.doesNotThrow(() => lp.cancel());
  assert.doesNotThrow(() => lp.consumeClick());
  assert.doesNotThrow(() => createLongPress());
  const bare = createLongPress();
  assert.doesNotThrow(() => {
    bare.down(P());
    bare.move(P());
    bare.up(P());
    bare.cancel();
    bare.consumeClick();
  });
  const k2 = clock();
  const throwing = createLongPress({ setTimeout: k2.setTimeout, clearTimeout: k2.clearTimeout, now: k2.now, onLongPress: () => { throw new Error("boom"); } });
  throwing.down(P());
  assert.doesNotThrow(() => k2.advance(HOLD_MS));
  throwing.up(P());
  assert.equal(throwing.consumeClick(), true, "a fired press still swallows its click even if the hook threw");
});

test("pure factory: no DOM, window, document or Date access", () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(window|document|Date|performance|navigator)\b/.test(code), "no globals");
});
