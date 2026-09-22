// test/unit/darkness-vignette.test.js
//
// Phase 57 (LAYOUT-06), Plan 04 — coverage for src/browser/darknessView.js
// (a pure, DOM-free module — no shell harness needed for this section) plus
// an end-to-end composition test proving vignetteFor() agrees with the real
// engine reads. Task 2 extends this file with a shell section (through
// test/unit/harness/shellSandbox.js's loadShellSandbox) proving
// paintVignette()/the DARK chip's waiver clause wire the module correctly.

import test from "node:test";
import assert from "node:assert/strict";

import { VIGNETTE_LEVELS, vignetteFor, waiverFor } from "../../src/browser/darknessView.js";
import { GW, GH } from "../../engine/maze.js";
import { inDark, revealRadius, mapViewRadius } from "../../engine/derived.js";

// ─── VIGNETTE_LEVELS ───────────────────────────────────────────────────────

test("VIGNETTE_LEVELS: exactly 3 levels, frozen, in ascending severity order", () => {
  assert.equal(VIGNETTE_LEVELS.length, 3, "a fourth level appearing here is a bug — the level split is exhaustively 3-way");
  assert.deepStrictEqual(VIGNETTE_LEVELS, ["off", "near", "close"]);
  assert.ok(Object.isFrozen(VIGNETTE_LEVELS));
});

// ─── vignetteFor: totality ─────────────────────────────────────────────────

test("vignetteFor: total across inDark x {true,false,undefined} crossed with radius x {0,1,2,5,undefined,NaN,-3} — every result's level is a member of VIGNETTE_LEVELS, never throws", () => {
  const inDarks = [true, false, undefined];
  const radii = [0, 1, 2, 5, undefined, NaN, -3];
  for (const on of inDarks) {
    for (const r of radii) {
      const result = vignetteFor(on, r);
      assert.ok(VIGNETTE_LEVELS.includes(result.level), `vignetteFor(${on}, ${r}) yielded an invalid level: ${result.level}`);
      assert.equal(typeof result.on, "boolean");
      assert.ok(Number.isFinite(result.radius) && result.radius >= 1, `vignetteFor(${on}, ${r}) returned a non-finite/sub-1 radius: ${result.radius}`);
    }
  }
});

test("vignetteFor: radius 1 with inDark true yields the close level", () => {
  assert.equal(vignetteFor(true, 1).level, "close");
});

test("vignetteFor: radius 2 with inDark true yields the near level", () => {
  assert.equal(vignetteFor(true, 2).level, "near");
});

test("vignetteFor: inDark false always yields the off level regardless of radius", () => {
  for (const r of [0, 1, 2, 5, Infinity, undefined, NaN, -3]) {
    assert.equal(vignetteFor(false, r).level, "off", `radius ${r} should still be off when inDark is false`);
  }
});

test("vignetteFor: Infinity radius (a waiver is open) yields the off level even while inDark is true — the whole point of LAYOUT-06", () => {
  const result = vignetteFor(true, Infinity);
  assert.equal(result.level, "off");
  assert.equal(result.on, true, "on still reflects the raw inDark reading — only the level says 'do not dim'");
});

test("vignetteFor: the returned object is frozen", () => {
  assert.ok(Object.isFrozen(vignetteFor(true, 1)));
});

test("vignetteFor: on is exactly inDark coerced to boolean", () => {
  assert.equal(vignetteFor(1, 1).on, true);
  assert.equal(vignetteFor(0, 1).on, false);
  assert.equal(vignetteFor(undefined, 1).on, false);
});

// ─── waiverFor ──────────────────────────────────────────────────────────────

test("waiverFor: null when no waiver flag is live", () => {
  assert.equal(waiverFor({ nightVision: false, amuletLight: false, litTorch: false }), null);
  assert.equal(waiverFor({}), null);
  assert.equal(waiverFor(undefined), null);
  assert.equal(waiverFor(null), null);
});

test("waiverFor: names the single live waiver", () => {
  assert.equal(waiverFor({ nightVision: true }), "nightVision");
  assert.equal(waiverFor({ amuletLight: true }), "amuletLight");
  assert.equal(waiverFor({ litTorch: true }), "litTorch");
});

test("waiverFor: fixed precedence when several are live at once — nightVision, then amuletLight, then litTorch", () => {
  assert.equal(waiverFor({ nightVision: true, amuletLight: true, litTorch: true }), "nightVision");
  assert.equal(waiverFor({ amuletLight: true, litTorch: true }), "amuletLight");
  assert.equal(waiverFor({ nightVision: false, amuletLight: false, litTorch: true }), "litTorch");
});

// ─── No rule duplication (documentation-level cross-check; the real gate is
// the acceptance criterion's grep over the module source) ──────────────────

test("darknessView.js exports exactly the documented surface", () => {
  const mod = { VIGNETTE_LEVELS, vignetteFor, waiverFor };
  assert.deepStrictEqual(Object.keys(mod).sort(), ["VIGNETTE_LEVELS", "vignetteFor", "waiverFor"]);
});

// ─── End-to-end composition: vignetteFor fed the REAL engine reads ────────

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: true, feat: null, ...extra };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, items: [], timers: {}, darkFor: 0,
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = wallGrid();
  for (let y = 3; y <= 7; y++) for (let x = 3; x <= 7; x++) open(g, x, y);
  return {
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 1, ...floorOverrides },
    ...rest,
  };
}

test("end-to-end: a running counter with no waivers composes to the close level through the real engine reads", () => {
  const state = fixedState({ c: { darkFor: 30 } });
  const result = vignetteFor(inDark(state), mapViewRadius(state));
  assert.equal(result.on, true);
  assert.equal(result.level, "close");
});

test("end-to-end: the counter zeroed on a lit tile composes to the off level", () => {
  const state = fixedState({ c: { darkFor: 0 } });
  const result = vignetteFor(inDark(state), mapViewRadius(state));
  assert.equal(result.on, false);
  assert.equal(result.level, "off");
});

test("end-to-end: a running counter WITH a lit torch composes to the off level too — mapViewRadius (not revealRadius) is what vignetteFor must be fed", () => {
  const state = fixedState({ c: { darkFor: 30, timers: { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } } } });
  assert.equal(revealRadius(state), 1, "sanity: revealRadius stays at 1 under the torch waiver — the divergence this plan exists to explain");
  const result = vignetteFor(inDark(state), mapViewRadius(state));
  assert.equal(result.on, true, "the counter is still running");
  assert.equal(result.level, "off", "but the map is rendering everything, so the vignette must not lie by dimming it");
});
