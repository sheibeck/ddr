// test/unit/typewriter.test.js
//
// Phase 58 (MOTION-04/05), Plan 01, Task 3 — pins src/browser/typewriter.js's
// typing schedule (typeDurationMs/typedCount/splitTyped) and the keyed
// controller (createTypewriter). One named test per <behavior> bullet in
// 58-01-PLAN.md, plus the two stripped-source checks shared with this
// plan's other two modules.
//
// Uses an inline fake clock/raf (advance(ms) steps in 16ms frames, matching
// camera-glide.test.js) and a minimal fake doc whose elements model:
//  - textContent: setting it replaces all children with one text value;
//    getting it concatenates the children's text.
//  - children: only the APPENDED ELEMENT children (never the synthetic
//    text node textContent-assignment produces) — this is what lets a test
//    assert "no child spans remain" after a block completes.
//  - appendChild, className, setAttribute/getAttribute/removeAttribute
//    (with a call log for the "zero setAttribute calls" assertion).
// This is the exact minimal surface test/unit/harness/recordingDom.js's own
// head comment describes for a new, purpose-built fake — recordingDom.js
// itself is untouched by this plan (58-01-PLAN.md prohibitions).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  TYPE_MS_PER_CHAR,
  TYPE_MAX_MS,
  TYPE_REST_CLASS,
  typeDurationMs,
  typedCount,
  splitTyped,
  createTypewriter,
} from "../../src/browser/typewriter.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fake clock + raf (16ms frames, mirrors camera-glide.test.js) ─────────
function makeFakeClock() {
  let now = 0;
  let nextId = 1;
  let queue = [];
  return {
    now: () => now,
    raf(fn) {
      const id = nextId++;
      queue.push({ id, fn });
      return id;
    },
    cancelRaf(id) {
      queue = queue.filter((e) => e.id !== id);
    },
    advance(ms) {
      let remaining = ms;
      while (remaining > 0) {
        const step = Math.min(16, remaining);
        now += step;
        remaining -= step;
        const due = queue;
        queue = [];
        for (const entry of due) entry.fn();
      }
    },
  };
}

// ─── minimal fake DOM ──────────────────────────────────────────────────────
function makeElement() {
  const el = {
    className: "",
    _nodes: [],
    _attrs: new Map(),
    setAttributeCalls: [],
    removeAttributeCalls: [],
  };
  Object.defineProperty(el, "textContent", {
    get() {
      return el._nodes.map((n) => (n.isText ? n.text : n.textContent)).join("");
    },
    set(v) {
      el._nodes = [{ isText: true, text: String(v ?? "") }];
    },
  });
  Object.defineProperty(el, "children", {
    get() {
      return el._nodes.filter((n) => !n.isText);
    },
  });
  el.appendChild = (child) => {
    el._nodes.push(child);
    return child;
  };
  el.setAttribute = (name, value) => {
    el._attrs.set(name, value);
    el.setAttributeCalls.push([name, value]);
  };
  el.getAttribute = (name) => (el._attrs.has(name) ? el._attrs.get(name) : null);
  el.removeAttribute = (name) => {
    el._attrs.delete(name);
    el.removeAttributeCalls.push([name]);
  };
  return el;
}

function makeDoc() {
  return { createElement: () => makeElement() };
}

// ─── 1. TYPE_MS_PER_CHAR / TYPE_MAX_MS / typeDurationMs ───────────────────

test("TYPE_MS_PER_CHAR is 12, TYPE_MAX_MS is 700; typeDurationMs pins its sample values", () => {
  assert.equal(TYPE_MS_PER_CHAR, 12);
  assert.equal(TYPE_MAX_MS, 700);
  assert.equal(typeDurationMs(0), 0);
  assert.equal(typeDurationMs(-3), 0);
  assert.equal(typeDurationMs(NaN), 0);
  assert.equal(typeDurationMs(10), 120);
  assert.equal(typeDurationMs(58), 696);
  assert.equal(typeDurationMs(59), 700);
  assert.equal(typeDurationMs(5000), 700);
});

// ─── 2. typedCount ─────────────────────────────────────────────────────────

test("typedCount pins its sample values, including the capped-block rate", () => {
  assert.equal(typedCount(40, 0), 0);
  assert.equal(typedCount(40, 240), 20);
  assert.equal(typedCount(40, 480), 40);
  assert.equal(typedCount(40, 10000), 40);
  assert.equal(typedCount(200, 350), 100);
});

// ─── 3. splitTyped ─────────────────────────────────────────────────────────

test("splitTyped distributes count across texts in order; 0 is all rest, past-total is all typed", () => {
  assert.deepEqual(splitTyped(["abc", "defg"], 5), [
    { typed: "abc", rest: "" },
    { typed: "de", rest: "fg" },
  ]);
  assert.deepEqual(splitTyped(["abc", "defg"], 0), [
    { typed: "", rest: "abc" },
    { typed: "", rest: "defg" },
  ]);
  assert.deepEqual(splitTyped(["abc", "defg"], 100), [
    { typed: "abc", rest: "" },
    { typed: "defg", rest: "" },
  ]);
});

// ─── 4. type(): aria sync, two-span layout, monotonic growth, exact landing ──

test("createTypewriter: type() hides aria synchronously, reserves layout with two spans per target, types monotonically, and completes at typeDurationMs", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const b = makeElement();
  const h = makeElement();
  let doneCalls = 0;

  tw.type("rail", { targets: [a, b], texts: ["abc", "defg"], ariaHost: h, onDone: () => doneCalls++ });

  assert.equal(h.getAttribute("aria-hidden"), "true");
  assert.equal(a.children.length, 2);
  assert.equal(a.children[1].className, TYPE_REST_CLASS);
  assert.equal(b.children.length, 2);
  assert.equal(b.children[1].className, TYPE_REST_CLASS);
  assert.equal(a.children[0].textContent, "");
  assert.equal(a.children[1].textContent, "abc");
  assert.equal(b.children[1].textContent, "defg");

  const total = 7;
  const duration = typeDurationMs(total); // 84ms

  clock.advance(16);
  assert.ok(tw.active("rail"));
  const firstTypedLen = a.children[0].textContent.length + b.children[0].textContent.length;
  assert.ok(firstTypedLen >= 0 && firstTypedLen < total);

  clock.advance(48); // 64ms total, still under 84ms
  assert.ok(tw.active("rail"));
  const secondTypedLen = a.children[0].textContent.length + b.children[0].textContent.length;
  assert.ok(secondTypedLen >= firstTypedLen);

  clock.advance(duration - 64 + 16); // crosses 84ms
  assert.equal(tw.active("rail"), false);
  assert.equal(a.textContent, "abc");
  assert.equal(a.children.length, 0);
  assert.equal(b.textContent, "defg");
  assert.equal(b.children.length, 0);
  assert.equal(h.getAttribute("aria-hidden"), null);
  assert.equal(doneCalls, 1);
});

// ─── 5. prior aria-hidden restored, not blindly removed ────────────────────

test("createTypewriter: an ariaHost carrying aria-hidden=\"true\" before typing keeps \"true\" afterwards", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const h = makeElement();
  h.setAttribute("aria-hidden", "true");
  h.setAttributeCalls.length = 0; // only count calls made BY typewriter from here

  tw.type("rail", { targets: [a], texts: ["hi"], ariaHost: h });
  assert.equal(h.getAttribute("aria-hidden"), "true");
  assert.equal(h.setAttributeCalls.length, 1, "the type()-time set");

  clock.advance(typeDurationMs(2) + 16);
  assert.equal(tw.active("rail"), false);
  assert.equal(h.getAttribute("aria-hidden"), "true");
  // Teeth: a coincidentally-unchanged final value ("true" in, "true" out) is
  // NOT proof of restoration — a second recorded setAttribute call is, since
  // it proves finishRun actually invoked the restore path rather than just
  // leaving the type()-time value untouched.
  assert.equal(h.setAttributeCalls.length, 2, "the finishRun()-time restore");
});

// ─── 6. complete() ──────────────────────────────────────────────────────────

test("createTypewriter: complete() mid-block writes full text, restores aria, fires onDone once, and a second complete() returns false", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const h = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a], texts: ["hello"], ariaHost: h, onDone: () => doneCalls++ });
  clock.advance(16);

  const result1 = tw.complete("rail");
  assert.equal(result1, true);
  assert.equal(a.textContent, "hello");
  assert.equal(h.getAttribute("aria-hidden"), null);
  assert.equal(doneCalls, 1);

  const result2 = tw.complete("rail");
  assert.equal(result2, false);
  assert.equal(doneCalls, 1);
});

// ─── 7. cancel() ─────────────────────────────────────────────────────────

test("createTypewriter: cancel() mid-block writes full text, restores aria, and never fires onDone", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const h = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a], texts: ["hello"], ariaHost: h, onDone: () => doneCalls++ });
  clock.advance(16);

  tw.cancel("rail");
  assert.equal(a.textContent, "hello");
  assert.equal(h.getAttribute("aria-hidden"), null);
  assert.equal(doneCalls, 0);
  assert.equal(tw.active("rail"), false);
});

// ─── 8. type() on an already-typing key cancels the old block ─────────────

test("createTypewriter: type() on an already-typing key cancels the old block (full text, no onDone) and starts the new one", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const oldTarget = makeElement();
  let oldDoneCalls = 0;
  tw.type("rail", { targets: [oldTarget], texts: ["old text"], onDone: () => oldDoneCalls++ });
  clock.advance(16);

  const newTarget = makeElement();
  let newDoneCalls = 0;
  tw.type("rail", { targets: [newTarget], texts: ["new"], onDone: () => newDoneCalls++ });

  assert.equal(oldTarget.textContent, "old text");
  assert.equal(oldDoneCalls, 0);
  assert.ok(tw.active("rail"));

  clock.advance(typeDurationMs(3) + 16);
  assert.equal(newTarget.textContent, "new");
  assert.equal(newDoneCalls, 1);
  assert.equal(tw.active("rail"), false);
});

// ─── 9. completeAll() ───────────────────────────────────────────────────

test("createTypewriter: completeAll() completes every active key", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const b = makeElement();
  let aDone = 0;
  let bDone = 0;
  tw.type("rail", { targets: [a], texts: ["alpha"], onDone: () => aDone++ });
  tw.type("encounter", { targets: [b], texts: ["beta"], onDone: () => bDone++ });

  tw.completeAll();
  assert.equal(a.textContent, "alpha");
  assert.equal(b.textContent, "beta");
  assert.equal(aDone, 1);
  assert.equal(bDone, 1);
  assert.equal(tw.active("rail"), false);
  assert.equal(tw.active("encounter"), false);
});

// ─── 10. adopt(): mid-flight, same count, continues, lands at original end time ──

test("createTypewriter: adopt() moves a run to fresh targets at the same typed count and completes at the original end time", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const b = makeElement();
  const h = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a, b], texts: ["abc", "defg"], ariaHost: h, onDone: () => doneCalls++ });

  clock.advance(60); // typedCount(7, 60) === 5

  const c = makeElement();
  const d = makeElement();
  const h2 = makeElement();
  const adopted = tw.adopt("rail", [c, d], h2);
  assert.equal(adopted, true);

  assert.equal(c.children.length, 2);
  assert.equal(d.children.length, 2);
  const adoptedTypedLen = c.children[0].textContent.length + d.children[0].textContent.length;
  assert.equal(adoptedTypedLen, 5);
  assert.equal(c.children[0].textContent, "abc");
  assert.equal(d.children[0].textContent, "de");
  assert.equal(h2.getAttribute("aria-hidden"), "true");
  assert.equal(h.getAttribute("aria-hidden"), null); // old host's prior value (none) restored

  clock.advance(24); // total elapsed from t0 reaches 84ms — the ORIGINAL end time
  assert.equal(tw.active("rail"), false);
  assert.equal(c.textContent, "abc");
  assert.equal(d.textContent, "defg");
  assert.equal(doneCalls, 1);
  assert.equal(h2.getAttribute("aria-hidden"), null);
});

// ─── 11. adopt() on an inactive key ───────────────────────────────────────

test("createTypewriter: adopt() on an inactive key returns false and writes nothing", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const c = makeElement();
  const d = makeElement();
  const result = tw.adopt("rail", [c, d], makeElement());
  assert.equal(result, false);
  assert.equal(c.children.length, 0);
  assert.equal(c.textContent, "");
  assert.equal(d.children.length, 0);
});

// ─── 12. adopt() with a mismatched target count cancels the run ───────────

test("createTypewriter: adopt() with a different target count cancels the run (no onDone) and returns false", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const b = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a, b], texts: ["abc", "defg"], onDone: () => doneCalls++ });
  clock.advance(16);

  const result = tw.adopt("rail", [makeElement(), makeElement(), makeElement()], null);
  assert.equal(result, false);
  assert.equal(doneCalls, 0);
  assert.equal(tw.active("rail"), false);
  assert.equal(a.textContent, "abc");
  assert.equal(b.textContent, "defg");
});

// ─── 13. reduced=true at type() ────────────────────────────────────────────

test("createTypewriter: reduced true — type() writes full text and fires onDone synchronously, never touching aria, scheduling no frame", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => true, doc });

  const a = makeElement();
  const h = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a], texts: ["hi"], ariaHost: h, onDone: () => doneCalls++ });

  assert.equal(a.textContent, "hi");
  assert.equal(doneCalls, 1);
  assert.equal(h.setAttributeCalls.length, 0);
  assert.equal(tw.active("rail"), false);
});

// ─── 14. reduced flips true mid-block ──────────────────────────────────────

test("createTypewriter: reduced flipping true mid-block completes the block on the very next frame, onDone once", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  let reducedFlag = false;
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => reducedFlag, doc });

  const a = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a], texts: ["hello"], onDone: () => doneCalls++ });
  clock.advance(16);
  assert.ok(tw.active("rail"));

  reducedFlag = true;
  clock.advance(16);

  assert.equal(a.textContent, "hello");
  assert.equal(doneCalls, 1);
  assert.equal(tw.active("rail"), false);
});

// ─── 15. all-zero-length texts ─────────────────────────────────────────────

test("createTypewriter: a block whose texts are all zero-length completes synchronously, onDone once, never touching aria", () => {
  const clock = makeFakeClock();
  const doc = makeDoc();
  const tw = createTypewriter({ now: clock.now, raf: clock.raf, cancelRaf: clock.cancelRaf, reduced: () => false, doc });

  const a = makeElement();
  const b = makeElement();
  const h = makeElement();
  let doneCalls = 0;
  tw.type("rail", { targets: [a, b], texts: ["", ""], ariaHost: h, onDone: () => doneCalls++ });

  assert.equal(a.textContent, "");
  assert.equal(b.textContent, "");
  assert.equal(doneCalls, 1);
  assert.equal(h.setAttributeCalls.length, 0);
  assert.equal(tw.active("rail"), false);
});

// ─── source assertions ────────────────────────────────────────────────────

const TYPEWRITER_SRC_STRIPPED = stripJs(
  fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "typewriter.js"), "utf8"),
);

test("typewriter.js source: holds no completion-event listener of any kind", () => {
  assert.doesNotMatch(TYPEWRITER_SRC_STRIPPED, /transitionend/i);
  assert.doesNotMatch(TYPEWRITER_SRC_STRIPPED, /animationend/i);
});

test("typewriter.js source: never reads the window or document global directly", () => {
  assert.doesNotMatch(TYPEWRITER_SRC_STRIPPED, /\bwindow\./);
  assert.doesNotMatch(TYPEWRITER_SRC_STRIPPED, /\bdocument\./);
});
