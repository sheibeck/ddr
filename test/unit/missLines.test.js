// test/unit/missLines.test.js
//
// Direct unit coverage for src/browser/missLines.js (Phase 25, FEED-05): the
// fledgling-miss quip corpus, its deterministic integer rotation, and the
// decorateMisses() decorator that stamps a quip onto a strikeMissed event
// while the hero is still green (c.level <= QUIP_MAX_LEVEL).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { MISS_LINES, QUIP_MAX_LEVEL, missLineAt, decorateMisses } from "../../src/browser/missLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

test("MISS_LINES: at least 12 distinct entries, each <= 40 characters, no shouting", () => {
  assert.ok(MISS_LINES.length >= 12, `expected >= 12 entries, got ${MISS_LINES.length}`);
  for (const line of MISS_LINES) {
    assert.equal(typeof line, "string");
    assert.ok(line.length >= 1 && line.length <= 40, `entry too long/empty: "${line}" (${line.length})`);
    assert.ok(!line.includes("!"), `entry has exclamation-mark hysteria: "${line}"`);
  }
  assert.equal(new Set(MISS_LINES).size, MISS_LINES.length, "every entry must be distinct");
});

test("QUIP_MAX_LEVEL is 2", () => {
  assert.equal(QUIP_MAX_LEVEL, 2);
});

test("missLineAt: a full rotation visits every entry exactly once, with no repeat", () => {
  const n = MISS_LINES.length;
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const line = missLineAt(i);
    assert.ok(!seen.has(line), `repeat within one full rotation at seq=${i}: "${line}"`);
    seen.add(line);
  }
  assert.equal(seen.size, n, "every entry appeared exactly once");
});

test("missLineAt: wraps forward and is negative-safe", () => {
  const n = MISS_LINES.length;
  assert.equal(missLineAt(n), missLineAt(0));
  assert.equal(missLineAt(-1), MISS_LINES[n - 1]);
  assert.equal(missLineAt(2 * n + 3), MISS_LINES[3]);
  assert.doesNotThrow(() => missLineAt(-1));
});

test("decorateMisses: at level 1, stamps a quip on every non-untouchable strikeMissed event", () => {
  const events = [
    { type: "moved" },
    { type: "strikeMissed", target: "Rat", roll: 12, need: 5 },
    { type: "struck", target: "Rat", dmg: 3 },
    { type: "strikeMissed", target: "Rat", roll: 15, need: 5 },
  ];
  const before = JSON.parse(JSON.stringify(events));
  const { events: decorated, seq } = decorateMisses(events, 1, 0);

  assert.equal(seq, 2, "seq advances by the number of misses stamped");
  assert.equal(decorated[0], events[0], "non-strikeMissed events pass through by reference");
  assert.equal(decorated[2], events[2], "non-strikeMissed events pass through by reference");
  assert.equal(decorated[1].quip, missLineAt(0));
  assert.equal(decorated[3].quip, missLineAt(1));
  assert.notEqual(decorated[1], events[1], "a decorated event is a NEW object (copy, not mutation)");
  assert.notEqual(decorated[3], events[3]);
  assert.deepEqual(events, before, "decorateMisses never mutates its input events");
});

test("decorateMisses: at level 2, still decorates (QUIP_MAX_LEVEL boundary)", () => {
  const events = [{ type: "strikeMissed", target: "Rat", roll: 12, need: 5 }];
  const { events: decorated, seq } = decorateMisses(events, 2, 5);
  assert.equal(seq, 6);
  assert.equal(decorated[0].quip, missLineAt(5));
});

test("decorateMisses: at level 3, is the identity (same array reference, same seq)", () => {
  const events = [{ type: "strikeMissed", target: "Rat", roll: 12, need: 5 }];
  const { events: decorated, seq } = decorateMisses(events, 3, 7);
  assert.equal(decorated, events, "level 3 returns the identical array reference");
  assert.equal(seq, 7, "seq is unchanged at level 3");
  assert.equal(decorated[0].quip, undefined, "no quip stamped at level 3");
});

test("decorateMisses: an untouchable strikeMissed is never decorated", () => {
  const events = [{ type: "strikeMissed", target: "Ward", roll: 5, need: 0, untouchable: true }];
  const { events: decorated, seq } = decorateMisses(events, 1, 0);
  assert.equal(seq, 0, "no quip stamped means seq does not advance");
  assert.equal(decorated[0], events[0], "untouchable event passes through by reference, unchanged");
  assert.equal(decorated[0].quip, undefined);
});

test("decorateMisses: a non-array input is returned as-is", () => {
  const notAnArray = null;
  const result = decorateMisses(notAnArray, 1, 3);
  assert.equal(result.events, notAnArray);
  assert.equal(result.seq, 3);
});

test("missLines.js source contains no Math.random / Date.now on any non-comment line", () => {
  const file = path.join(REPO_ROOT, "src", "browser", "missLines.js");
  const source = fs.readFileSync(file, "utf8");
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const lines = noBlockComments.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
  const offenses = [];
  lines.forEach((line, i) => {
    if (/Math\.random|Date\.now/.test(line)) offenses.push(`${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(offenses, [], `Found Math.random/Date.now in missLines.js:\n${offenses.join("\n")}`);
});
