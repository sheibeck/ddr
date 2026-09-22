// test/unit/darkness-filter.test.js
//
// Phase 41 (TERR-03), Plan 04 — direct unit coverage for
// engine/derived.js#mapViewRadius/inViewWindow/DARK_VIEW_RADIUS: the pure
// 3x3 darkness RENDER filter the shell's draw() consumes every paint. Every
// <behavior> bullet from 41-04-PLAN.md's Task 1, using the same
// wallGrid/open hand-built-floor pattern test/unit/movement.test.js
// established.

import test from "node:test";
import assert from "node:assert/strict";

import { GW, GH } from "../../engine/maze.js";
import { mapViewRadius, inViewWindow, DARK_VIEW_RADIUS, inDark, revealRadius } from "../../engine/derived.js";

/** A minimal, fully-walled 21x21 grid (matches engine/maze.js's GW/GH) with
 * a hole punched wherever a test needs an open cell — mirrors
 * test/unit/movement.test.js's own wallGrid/open helpers verbatim. */
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

/** A 5x5 open room centered on (5,5), every cell `seen`, so the "hide a
 * previously-seen cell" claim is actually testable. */
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

// ─── mapViewRadius: Infinity on a lit tile, darkFor 0 ─────────────────────

test("mapViewRadius: Infinity on a lit tile with darkFor 0 (the normal case)", () => {
  const state = fixedState();
  assert.equal(mapViewRadius(state), Infinity);
});

// ─── mapViewRadius: DARK_VIEW_RADIUS on a .dark tile, no waivers ──────────

test("mapViewRadius: DARK_VIEW_RADIUS (1) on a .dark tile with no waiver", () => {
  const state = fixedState();
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), 1);
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
});

// ─── mapViewRadius: Night Vision waiver ────────────────────────────────────

test("mapViewRadius: Infinity on a dark tile with Night Vision", () => {
  const state = fixedState({ c: { skills: { "Night Vision": 1 } } });
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), Infinity);
});

// ─── mapViewRadius: Amulet of Light waiver ─────────────────────────────────

test("mapViewRadius: Infinity on a dark tile with a LIVE Amulet of Light effect (eff(c, \"light\") > 0)", () => {
  // 260918-w4n (use-activated-only): the Amulet's sight/light payload
  // applies only while its own item:Amulet of Light record is live.
  const state = fixedState({
    c: {
      items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }],
      timers: { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    },
  });
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), Infinity);
});

// ─── mapViewRadius: lit-torch waiver ───────────────────────────────────────

test("mapViewRadius: Infinity on a dark tile with a live item:Torch effect", () => {
  const state = fixedState({ c: { timers: { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } } } });
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), Infinity);
});

test("mapViewRadius: a COOLING (not effect-phase) item:Torch record does NOT waive the filter", () => {
  const state = fixedState({ c: { timers: { "item:Torch": { cadence: "squares", left: 40, phase: "cooldown" } } } });
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
});

// ─── mapViewRadius: persistent darkness (darkFor > 0) on a LIT tile ───────

test("mapViewRadius: DARK_VIEW_RADIUS on a LIT tile while c.darkFor > 0 (persistent darkness)", () => {
  const state = fixedState({ c: { darkFor: 5 } });
  assert.equal(state.floor.g[5][5].dark, undefined, "the tile itself is lit");
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
});

// ─── inViewWindow: Infinity radius shows everything ────────────────────────

test("inViewWindow: true for every cell (including far ones) when mapViewRadius is Infinity", () => {
  const state = fixedState();
  assert.equal(inViewWindow(state, 5, 5), true);
  assert.equal(inViewWindow(state, 3, 3), true);
  assert.equal(inViewWindow(state, 0, 0), true);
  assert.equal(inViewWindow(state, GW - 1, GH - 1), true);
});

// ─── inViewWindow: the 3x3 window, exact boundary ──────────────────────────

test("inViewWindow: exactly the 3x3 (Chebyshev <=1) cells around the party are true when dark; every other explored cell (including previously seen ones) is false", () => {
  const state = fixedState();
  state.floor.g[5][5].dark = true;
  for (let y = 4; y <= 6; y++) {
    for (let x = 4; x <= 6; x++) {
      assert.equal(inViewWindow(state, x, y), true, `(${x},${y}) expected inside the 3x3 window`);
    }
  }
  // Every cell one step outside the window, still within the seen 5x5 room —
  // proving the window hides previously-seen cells too, not just new ones.
  const outside = [
    [3, 3], [7, 7], [3, 5], [7, 5], [5, 3], [5, 7], [7, 3], [3, 7],
  ];
  for (const [x, y] of outside) {
    assert.equal(inViewWindow(state, x, y), false, `(${x},${y}) expected outside the 3x3 window`);
    assert.equal(state.floor.g[y][x].seen, true, `(${x},${y}) is still 'seen' — the filter hides at render time only`);
  }
});

// ─── inViewWindow / mapViewRadius: never mutate seen/spellSeen or state ───

test("mapViewRadius/inViewWindow: mutate nothing — seen/spellSeen unchanged, state deepStrictEqual before/after any number of calls", () => {
  const state = fixedState();
  state.floor.g[5][5].dark = true;
  state.floor.g[4][4].spellSeen = true;
  const before = JSON.parse(JSON.stringify(state));
  for (let i = 0; i < 5; i++) {
    mapViewRadius(state);
    inViewWindow(state, 4, 4);
    inViewWindow(state, 2, 2);
  }
  assert.deepStrictEqual(state, before);
  assert.equal(state.floor.g[4][4].spellSeen, true, "spellSeen is untouched by the filter");
});

// ─── leaving the dark restores Infinity, nothing was ever stored ──────────

test("leaving the dark: moving to a lit tile (darkFor 0) returns Infinity again — nothing to 'restore' because nothing was stored", () => {
  const state = fixedState();
  state.floor.g[5][5].dark = true;
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
  // Move off the dark tile onto a lit one.
  state.floor.px = 6;
  state.floor.py = 6;
  state.c.darkFor = 0;
  assert.equal(state.floor.g[6][6].dark, undefined);
  assert.equal(mapViewRadius(state), Infinity);
  assert.equal(inViewWindow(state, 3, 3), true, "the whole explored room is visible again");
});

// ─── Phase 57 characterisation: the counter already drives the render window ──
//
// 57-CONTEXT.md's correction 3 / 57-04-PLAN.md's discovery block: LAYOUT-06
// was planned on the premise that "draw() dims only tile.dark cells and
// nothing reads the counter". That premise is FALSE at HEAD — this block
// PINS the already-correct existing behaviour (a running c.darkFor counter
// drives mapViewRadius/inViewWindow exactly like a natural dark tile does,
// and the three waivers open the SAME filter back to Infinity while
// c.darkFor keeps ticking) so a future reader does not "fix" a filter that
// was never broken. The real, residual gap (surfaced by LAYOUT-06's actual
// work) is that nothing on the map or the DARK chip EXPLAINED any of this —
// see darkness-vignette.test.js for the vignette + waiver-naming coverage.

test("Phase 57 characterisation: darkFor alone (no .dark tile, no waiver) drives inDark/revealRadius/mapViewRadius/inViewWindow exactly like a natural dark tile", () => {
  const state = fixedState({ c: { darkFor: 30 } });
  assert.equal(state.floor.g[5][5].dark, undefined, "the tile itself is NOT dark — only the counter is running");
  assert.equal(inDark(state), true);
  assert.equal(revealRadius(state), 1);
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
  // The far corner of the fixedState 5x5 room (already `seen`) — outside
  // the 3x3 window, mirroring the existing inViewWindow test's own "outside" set.
  assert.equal(state.floor.g[3][3].seen, true, "still seen — the filter hides at render time only");
  assert.equal(inViewWindow(state, 3, 3), false, "outside the 3x3 window, even though seen");
});

test("Phase 57 characterisation: the mirror case — darkFor 0 on a .dark tile — yields the SAME four answers (the symmetry the user's report appeared to contradict)", () => {
  const state = fixedState();
  state.floor.g[5][5].dark = true;
  assert.equal(state.c.darkFor, 0, "the counter is NOT running — only the tile's own .dark flag is set");
  assert.equal(inDark(state), true);
  assert.equal(revealRadius(state), 1);
  assert.equal(mapViewRadius(state), DARK_VIEW_RADIUS);
  assert.equal(state.floor.g[3][3].seen, true, "still seen — the filter hides at render time only");
  assert.equal(inViewWindow(state, 3, 3), false);
});

test("Phase 57 characterisation: darkFor running WITH a lit torch — the waiver divergence that is the confirmed explanation of the 2026-09-21 device report", () => {
  const state = fixedState({ c: { darkFor: 30, timers: { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } } } });
  assert.equal(inDark(state), true, "the counter is still running — the player is still 'in the dark'");
  assert.equal(revealRadius(state), 1, "revealRadius waives ONLY on Night Vision — a torch does not touch it");
  assert.equal(mapViewRadius(state), Infinity, "mapViewRadius waives on a lit torch too — the map shows everything");
  assert.equal(inViewWindow(state, 3, 3), true, "the whole explored room renders, even though inDark is true and revealRadius is 1");
});

test("Phase 57 characterisation: darkFor running WITH a live Amulet of Light — the same divergence", () => {
  const state = fixedState({
    c: {
      darkFor: 30,
      items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }],
      timers: { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
    },
  });
  assert.equal(inDark(state), true);
  assert.equal(revealRadius(state), 2, "the Amulet's own sight:1 effect DOES widen revealRadius (eff(c,\"sight\") is added unconditionally)");
  assert.equal(mapViewRadius(state), Infinity);
  assert.equal(inViewWindow(state, 3, 3), true);
});

test("Phase 57 characterisation: darkFor running WITH Night Vision — the one waiver revealRadius ALSO respects", () => {
  const state = fixedState({ c: { darkFor: 30, skills: { "Night Vision": 1 } } });
  assert.equal(inDark(state), true);
  assert.equal(revealRadius(state), 2, "Night Vision is the ONE waiver revealRadius itself respects");
  assert.equal(mapViewRadius(state), Infinity);
  assert.equal(inViewWindow(state, 3, 3), true);
});
