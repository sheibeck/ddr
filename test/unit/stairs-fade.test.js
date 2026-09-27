// test/unit/stairs-fade.test.js
//
// Phase 78 (HUD-06), Plan 08, Task 1 — pins src/browser/stairsFade.js, the
// pure timer-injected controller behind the stairs descent's fade to black
// (about 0.6s out under the stairs sound, about 0.4s in on the new floor, an
// instant cut for a reduced-motion player). Driven on the shared fake clock;
// no test here sleeps.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { STAIRS_FADE_MS, createStairsFade } from "../../src/browser/stairsFade.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { stripJs } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

function rig({ reduced = false } = {}) {
  const clock = createFakeClock();
  const phases = [];
  const fade = createStairsFade({
    setPhase: (p) => phases.push(p),
    reduced: () => reduced,
    schedule: clock.setTimeout,
    cancel: clock.clearTimeout,
  });
  return { clock, phases, fade };
}

test("STAIRS_FADE_MS is frozen at 600ms out and 400ms in", () => {
  assert.deepEqual({ ...STAIRS_FADE_MS }, { out: 600, in: 400 });
  assert.ok(Object.isFrozen(STAIRS_FADE_MS));
});

test("with motion: out, then onDark at 600ms, then in, then onDone at 1000ms", () => {
  const { clock, phases, fade } = rig();
  const calls = [];
  fade.start(() => calls.push("dark"), () => calls.push("done"));
  assert.deepEqual(phases, ["out"]);
  assert.equal(fade.active(), true);
  assert.equal(fade.holding(), true);
  assert.deepEqual(calls, []);

  clock.advance(599);
  assert.deepEqual(calls, []);
  assert.equal(fade.holding(), true);

  clock.advance(1);
  assert.deepEqual(calls, ["dark"]);
  assert.deepEqual(phases, ["out", "in"]);
  assert.equal(fade.holding(), false);
  assert.equal(fade.active(), true);

  clock.advance(399);
  assert.deepEqual(calls, ["dark"]);
  assert.equal(fade.active(), true);

  clock.advance(1);
  assert.deepEqual(calls, ["dark", "done"]);
  assert.deepEqual(phases, ["out", "in", "idle"]);
  assert.equal(fade.active(), false);
  assert.equal(fade.holding(), false);
  assert.equal(clock.pending(), 0);

  clock.advance(5000);
  assert.deepEqual(calls, ["dark", "done"], "each callback runs exactly once");
});

test("reduced motion: onDark then onDone synchronously, only ever idle, never black", () => {
  const { clock, phases, fade } = rig({ reduced: true });
  const calls = [];
  const seen = [];
  fade.start(
    () => {
      calls.push("dark");
      seen.push([fade.active(), fade.holding()]);
    },
    () => calls.push("done"),
  );
  assert.deepEqual(calls, ["dark", "done"]);
  assert.ok(phases.every((p) => p === "idle"), `phases ${phases}`);
  assert.equal(fade.active(), false);
  assert.equal(fade.holding(), false);
  assert.deepEqual(seen, [[false, false]]);
  assert.equal(clock.pending(), 0);
});

test("a restart during the fade-out runs the first onDark at once and fires only the last onDone", () => {
  const { clock, phases, fade } = rig();
  const calls = [];
  fade.start(() => calls.push("dark1"), () => calls.push("done1"));
  clock.advance(300);
  fade.start(() => calls.push("dark2"), () => calls.push("done2"));
  assert.deepEqual(calls, ["dark1"], "the first floor is drawn at once");
  assert.equal(fade.holding(), true);
  assert.equal(phases[phases.length - 1], "out");

  clock.advance(600);
  assert.deepEqual(calls, ["dark1", "dark2"]);
  clock.advance(400);
  assert.deepEqual(calls, ["dark1", "dark2", "done2"]);
  clock.advance(5000);
  assert.deepEqual(calls, ["dark1", "dark2", "done2"]);
  assert.equal(fade.active(), false);
  assert.equal(clock.pending(), 0);
});

test("a restart during the fade-in does not rerun the first onDark", () => {
  const { clock, fade } = rig();
  const calls = [];
  fade.start(() => calls.push("dark1"), () => calls.push("done1"));
  clock.advance(700);
  assert.deepEqual(calls, ["dark1"]);
  fade.start(() => calls.push("dark2"), () => calls.push("done2"));
  assert.deepEqual(calls, ["dark1"]);
  clock.advance(1000);
  assert.deepEqual(calls, ["dark1", "dark2", "done2"]);
});

test("cancel() jumps to idle, runs a pending onDark then onDone once, and clears timers", () => {
  const { clock, phases, fade } = rig();
  const calls = [];
  fade.start(() => calls.push("dark"), () => calls.push("done"));
  clock.advance(200);
  fade.cancel();
  assert.deepEqual(calls, ["dark", "done"]);
  assert.equal(phases[phases.length - 1], "idle");
  assert.equal(fade.active(), false);
  assert.equal(fade.holding(), false);
  assert.equal(clock.pending(), 0);
  clock.advance(5000);
  assert.deepEqual(calls, ["dark", "done"]);

  // cancel mid fade-in: onDark already ran, only onDone runs.
  calls.length = 0;
  fade.start(() => calls.push("dark"), () => calls.push("done"));
  clock.advance(800);
  fade.cancel();
  assert.deepEqual(calls, ["dark", "done"]);
  // cancel while idle is a no-op.
  fade.cancel();
  assert.deepEqual(calls, ["dark", "done"]);
});

test("a throwing callback never strands the controller", () => {
  const { clock, fade } = rig();
  fade.start(
    () => {
      throw new Error("draw failed");
    },
    () => {
      throw new Error("rail failed");
    },
  );
  clock.advance(1000);
  assert.equal(fade.active(), false);
  assert.equal(clock.pending(), 0);
});

test("pure: no DOM or window reads, no real timers, imports nothing", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src/browser/stairsFade.js"), "utf8");
  const code = stripJs(src);
  assert.doesNotMatch(code, /\b(window|document|globalThis)\b/);
  assert.doesNotMatch(code, /\bsetTimeout\s*\(|\bclearTimeout\s*\(|requestAnimationFrame/);
  assert.doesNotMatch(code, /^\s*import\b/m);
  assert.match(src, /HUD-06/);
});
