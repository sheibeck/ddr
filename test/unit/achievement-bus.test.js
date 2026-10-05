// test/unit/achievement-bus.test.js
//
// Phase 100 (AUI-01): src/browser/achievementBus.js, the fan-out over the
// adapter's one achievement listener slot. The banner subscribes now, the
// Phase 101 Play mirror subscribes later; a failing consumer must never
// disturb another consumer or the publisher.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createAchievementBus, achievementEvents } from "../../src/browser/achievementBus.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const PAYLOAD = Object.freeze({ unlocks: Object.freeze([{ id: "depth_t1", at: 5 }]), reveals: Object.freeze([]), progress: Object.freeze([]) });

test("publish with no subscriber is a no-op that returns undefined", () => {
  const bus = createAchievementBus();
  assert.equal(bus.size(), 0);
  assert.equal(bus.publish(PAYLOAD), undefined);
});

test("subscribers hear the identical payload in subscription order", () => {
  const bus = createAchievementBus();
  const seen = [];
  bus.subscribe((p) => seen.push(["A", p]));
  bus.subscribe((p) => seen.push(["B", p]));
  bus.publish(PAYLOAD);
  assert.deepEqual(seen.map((s) => s[0]), ["A", "B"]);
  assert.equal(seen[0][1], PAYLOAD);
  assert.equal(seen[1][1], PAYLOAD);
  assert.equal(seen[0][1], seen[1][1]);
});

test("a subscriber that throws stops nobody and never reaches the publisher", () => {
  const bus = createAchievementBus();
  const seen = [];
  bus.subscribe(() => {
    throw new Error("boom");
  });
  bus.subscribe((p) => seen.push(p));
  assert.doesNotThrow(() => bus.publish(PAYLOAD));
  assert.deepEqual(seen, [PAYLOAD]);
});

test("a subscriber that returns a rejected promise stops nobody and leaves no unhandled rejection", async () => {
  const bus = createAchievementBus();
  const seen = [];
  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.once("unhandledRejection", onRejection);
  try {
    bus.subscribe(() => Promise.reject(new Error("async boom")));
    bus.subscribe((p) => seen.push(p));
    const out = bus.publish(PAYLOAD);
    assert.equal(out, undefined);
    assert.deepEqual(seen, [PAYLOAD]);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(rejections, []);
  } finally {
    process.removeListener("unhandledRejection", onRejection);
  }
});

test("a thenable that throws from its own then is swallowed too", () => {
  const bus = createAchievementBus();
  const seen = [];
  bus.subscribe(() => ({
    then() {
      throw new Error("bad thenable");
    },
  }));
  bus.subscribe((p) => seen.push(p));
  assert.doesNotThrow(() => bus.publish(PAYLOAD));
  assert.deepEqual(seen, [PAYLOAD]);
});

test("the returned unsubscribe removes the subscriber and is harmless twice", () => {
  const bus = createAchievementBus();
  let a = 0;
  let b = 0;
  const offA = bus.subscribe(() => a++);
  bus.subscribe(() => b++);
  assert.equal(bus.size(), 2);
  bus.publish(PAYLOAD);
  offA();
  assert.equal(bus.size(), 1);
  assert.doesNotThrow(() => offA());
  assert.equal(bus.size(), 1);
  bus.publish(PAYLOAD);
  assert.equal(a, 1);
  assert.equal(b, 2);
});

test("subscribing the same function twice registers it once", () => {
  const bus = createAchievementBus();
  let n = 0;
  const fn = () => n++;
  bus.subscribe(fn);
  bus.subscribe(fn);
  assert.equal(bus.size(), 1);
  bus.publish(PAYLOAD);
  assert.equal(n, 1);
});

test("a non-function registers nothing and returns a callable no-op", () => {
  const bus = createAchievementBus();
  for (const bad of [null, undefined, 5, "x", {}, []]) {
    const off = bus.subscribe(bad);
    assert.equal(typeof off, "function");
    assert.equal(off(), undefined);
    assert.equal(bus.size(), 0);
  }
});

test("a subscriber added during a publish first hears the next one", () => {
  const bus = createAchievementBus();
  const late = [];
  let added = false;
  bus.subscribe(() => {
    if (!added) {
      added = true;
      bus.subscribe((p) => late.push(p));
    }
  });
  bus.publish(PAYLOAD);
  assert.deepEqual(late, []);
  bus.publish(PAYLOAD);
  assert.deepEqual(late, [PAYLOAD]);
});

test("a subscriber removed by an earlier one during a publish still hears that publish", () => {
  const bus = createAchievementBus();
  const seen = [];
  let offB = null;
  bus.subscribe(() => offB());
  offB = bus.subscribe((p) => seen.push(p));
  bus.publish(PAYLOAD);
  assert.deepEqual(seen, [PAYLOAD]);
  bus.publish(PAYLOAD);
  assert.deepEqual(seen, [PAYLOAD]);
});

test("publish and subscribe are closures: they work detached from their object", () => {
  const bus = createAchievementBus();
  const { publish, subscribe, size } = bus;
  const seen = [];
  subscribe((p) => seen.push(p));
  publish(PAYLOAD);
  assert.deepEqual(seen, [PAYLOAD]);
  assert.equal(size(), 1);
  assert.equal(Object.isFrozen(bus), true);
});

test("achievementEvents is the one shared instance, empty at load, and its publish works as a bare function", async () => {
  const again = await import("../../src/browser/achievementBus.js");
  assert.equal(again.achievementEvents, achievementEvents);
  assert.equal(achievementEvents.size(), 0);
  const seen = [];
  const off = achievementEvents.subscribe((p) => seen.push(p));
  const bare = achievementEvents.publish;
  bare(PAYLOAD);
  assert.deepEqual(seen, [PAYLOAD]);
  off();
  assert.equal(achievementEvents.size(), 0);
});

test("purity: the module has no import, no this and no window or document", () => {
  const src = stripJs(readFileSync(new URL("../../src/browser/achievementBus.js", import.meta.url), "utf8"));
  assert.doesNotMatch(src, /^\s*import\b/m);
  assert.doesNotMatch(src, /\bimport\s*\(/);
  assert.doesNotMatch(src, /\bthis\b/);
  assert.doesNotMatch(src, /\bwindow\b/);
  assert.doesNotMatch(src, /\bdocument\b/);
});
