// test/unit/dressing-shell.test.js
//
// Phase 59 (DRESS-01..05), Plan 05 — the shell-wiring proof for dungeon set
// dressing, on the REAL draw() (test/unit/harness/shellSandbox.js's
// `stubDraw: false`/`canvasContext` options plus its new `dressing` option,
// wiring the REAL src/browser/dressing.js#createDressingBridge over an
// injectable art source). One named test per must_haves claim:
//
//   1. Props draw beneath the features (D-11).
//   2. Dimming and size (DRESS-02): 0.35/0.85 alpha, 0.6 scale; features
//      stay at alpha 1, 0.75 scale.
//   3. Exclusions (DRESS-03): never on a feature (stairs included), the
//      party's square, or (1,1); a prop reappears once its feature resolves.
//   4. Fog: no prop on an unseen cell.
//   5. The render window: the 57-04 dark-square 3x3 collapse.
//   6. Off (DRESS-05, D-16): zero prop draws; features unaffected.
//   7. Before the lazy load (D-14): the default sandbox draws zero props
//      and throws nothing.
//   8. Determinism (DRESS-04): identical across repeat draw() calls and a
//      save/reload round trip.
//   9. The engine is untouched: JSON.stringify(state) before/after draw().
//   10. Settings wiring (source): the row, the handler redraw, setEnabled,
//       the TDZ order.
//   11. Lazy load (source): loadIconSet( only inside createDressingArt('s
//       argument slice; dressingArt.release() scheduled once, after boot.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { newRun } from "../../engine/state.js";
import { serializeRun, validateSave, rehydrate } from "../../engine/saveState.js";
import { DRESSING_ICON_NAMES, PROP_SCALE, FLOOR_PROP_ALPHA, WALL_PROP_ALPHA, visibleProps } from "../../src/browser/dressing.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const PROP_ICON_SIZE = Math.round(CELL * PROP_SCALE);
const FEATURE_ICON_SIZE = Math.round(CELL * 0.75);

// ─── helpers ────────────────────────────────────────────────────────────

/** makeDressingImages() — one fake decoded image per DRESSING_ICON_NAMES
 * entry, tagged `dressingIcon` (its own name) so a recorded drawImage call
 * can be told apart from a feature-icon draw (tagged `key` by shellSandbox's
 * own stubDraw:false fake iconMap). */
function makeDressingImages() {
  const map = {};
  for (const name of DRESSING_ICON_NAMES) map[name] = { complete: true, naturalWidth: 96, dressingIcon: name };
  return map;
}

/** seenAll(state) — mutates every cell's `seen` to true, in place, so fog
 * (D-10) never suppresses a prop this test wants to see. */
function seenAll(state) {
  for (const row of state.floor.g) for (const cell of row) cell.seen = true;
  return state;
}

/** buildScenario({ seed, dressing, mutate }) — a fresh sandbox wired with a
 * REAL draw() over a recording canvas and a REAL __mzDressing bridge over
 * the given injectable art source (defaults to enabled, fully decoded); a
 * real newRun(seed) state with every cell seen unless `mutate` says
 * otherwise. */
function buildScenario({ seed = 1, dressing = { enabled: true, images: makeDressingImages() }, mutate = seenAll } = {}) {
  const doc = createRecordingDocument();
  const ctx = createRecordingContext();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw: false, canvasContext: ctx, dressing });
  const state = newRun(seed);
  if (mutate) mutate(state);
  sandbox.setState(state);
  return { sandbox, ctx, state };
}

function propDraws(ctx) {
  return ctx.imageDraws().filter((d) => d.img && d.img.dressingIcon);
}
function featureDraws(ctx) {
  return ctx.imageDraws().filter((d) => d.img && d.img.key);
}

/** expectedVisible(sandbox, state) — the SAME visibleProps computation
 * draw()'s own dressing call performs internally: propsFor(state) filtered
 * by the real window.__mzMapView.inViewWindow predicate (wired by every
 * sandbox, stubDraw or not). */
function expectedVisible(sandbox, state) {
  const props = sandbox.context.window.__mzDressing.propsFor(state);
  const view = sandbox.context.window.__mzMapView;
  const visible = (x, y) => !view || view.inViewWindow(state, x, y);
  return visibleProps(props, { grid: state.floor.g, party: { x: state.floor.px, y: state.floor.py }, visible });
}

function expectedXY(x, y, size) {
  return { x: x * CELL + (CELL - size) / 2, y: y * CELL + (CELL - size) / 2 };
}

// ─── (1) beneath the features (D-11) ───────────────────────────────────

test("(1) props draw beneath the features: every prop drawImage precedes the first feature drawImage in recorded call order", () => {
  const { sandbox, ctx, state } = buildScenario();
  const expected = expectedVisible(sandbox, state);
  assert.ok(expected.length > 0, "expected at least one visible prop for this fixture");
  sandbox.context.draw();

  const calls = ctx.calls.filter((c) => c.op === "drawImage");
  const firstFeatureIdx = calls.findIndex((c) => c.args[0] && c.args[0].key);
  assert.notEqual(firstFeatureIdx, -1, "expected at least one feature draw");
  const propIdxs = calls
    .map((c, i) => (c.args[0] && c.args[0].dressingIcon ? i : -1))
    .filter((i) => i !== -1);
  assert.equal(propIdxs.length, expected.length);
  for (const i of propIdxs) {
    assert.ok(i < firstFeatureIdx, `expected every prop draw (index ${i}) before the first feature draw (index ${firstFeatureIdx})`);
  }
});

// ─── (2) dimming and size (DRESS-02) ───────────────────────────────────

test("(2) dimming and size: every floor-prop draw is alpha 0.35, every wall-prop draw 0.85, all at Math.round(CELL*0.6); every feature draw is alpha 1 at Math.round(CELL*0.75)", () => {
  const { sandbox, ctx, state } = buildScenario();
  const expected = expectedVisible(sandbox, state);
  sandbox.context.draw();

  const kindByIcon = Object.fromEntries(expected.map((p) => [p.icon, p.kind]));
  for (const d of propDraws(ctx)) {
    const kind = kindByIcon[d.img.dressingIcon];
    assert.ok(kind, `unexpected prop draw for icon ${d.img.dressingIcon}`);
    assert.equal(d.alpha, kind === "wall" ? WALL_PROP_ALPHA : FLOOR_PROP_ALPHA);
    assert.equal(d.w, PROP_ICON_SIZE);
    assert.equal(d.h, PROP_ICON_SIZE);
  }
  for (const d of featureDraws(ctx)) {
    assert.equal(d.alpha, 1, "feature icons must never be dimmed by the dressing layer");
    assert.equal(d.w, FEATURE_ICON_SIZE);
    assert.equal(d.h, FEATURE_ICON_SIZE);
  }
});

// ─── (3) exclusions (DRESS-03) ─────────────────────────────────────────

// A one-off seed search (`node --eval` against placeDressing) found seed 1,
// depth 1: placeDressing puts a floor prop (`fern`, set_dungeon_fern) at
// (17, 9), a cell genFloor(1, rng) also gives a "climb" feature — the exact
// "a floor prop's square holds a feature" case DRESS-03/visibleProps must
// exclude. Pinned as a literal so this test never depends on git/rng
// re-derivation at run time.
const RESOLVED_FEATURE_SEED = 1;
const RESOLVED_FEATURE_CELL = Object.freeze({ x: 17, y: 9 });

test("(3) exclusions: no prop draw lands on a cell holding a live feature (the stairs included), the party's square, or (1,1); a prop reappears once its feature resolves", () => {
  const { sandbox, ctx, state } = buildScenario({ seed: RESOLVED_FEATURE_SEED });
  const { g, px, py } = state.floor;
  assert.equal(g[RESOLVED_FEATURE_CELL.y][RESOLVED_FEATURE_CELL.x].feat, "climb", "fixture assumption: the pinned cell must hold a live feature");

  sandbox.context.draw();
  const featCellXY = expectedXY(RESOLVED_FEATURE_CELL.x, RESOLVED_FEATURE_CELL.y, PROP_ICON_SIZE);
  const partyCellXY = expectedXY(px, py, PROP_ICON_SIZE);
  for (const d of propDraws(ctx)) {
    assert.ok(!(Math.abs(d.x - featCellXY.x) < 1e-9 && Math.abs(d.y - featCellXY.y) < 1e-9), "no prop may draw on the resolved-feature cell while its feature is live");
    assert.ok(!(Math.abs(d.x - partyCellXY.x) < 1e-9 && Math.abs(d.y - partyCellXY.y) < 1e-9), "no prop may draw on the party's own square");
  }
  // Broader sweep: no drawn prop may ever land on ANY cell this grid marks
  // with a live feature (stairs included — featureKeyForCell covers every
  // feat kind, and visibleProps excludes on the raw `feat` field directly).
  for (const d of propDraws(ctx)) {
    const gx = Math.round((d.x - CELL / 2 + PROP_ICON_SIZE / 2) / CELL);
    const gy = Math.round((d.y - CELL / 2 + PROP_ICON_SIZE / 2) / CELL);
    const cell = g[gy] && g[gy][gx];
    assert.ok(cell && !cell.feat, `a prop drew on (${gx},${gy}), which holds feat=${cell && cell.feat}`);
  }

  // Never on (1,1) — the party's floor-start square.
  const startXY = expectedXY(1, 1, PROP_ICON_SIZE);
  for (const d of propDraws(ctx)) {
    assert.ok(!(Math.abs(d.x - startXY.x) < 1e-9 && Math.abs(d.y - startXY.y) < 1e-9), "no prop may ever draw on the (1,1) start square");
  }

  // The feature resolves (its `feat` clears) — the SAME floor prop must now
  // draw, on a clone with a fresh sandbox/bridge (placement is memoised per
  // sandbox instance; a fresh sandbox recomputes it identically, per DRESS-04).
  const resolvedState = structuredClone(state);
  resolvedState.floor.g[RESOLVED_FEATURE_CELL.y][RESOLVED_FEATURE_CELL.x].feat = null;
  const doc2 = createRecordingDocument();
  const ctx2 = createRecordingContext();
  const sandbox2 = loadShellSandbox({ doc: doc2, reducedMotion: true, stubDraw: false, canvasContext: ctx2, dressing: { enabled: true, images: makeDressingImages() } });
  sandbox2.setState(resolvedState);
  sandbox2.context.draw();
  const resolvedXY = expectedXY(RESOLVED_FEATURE_CELL.x, RESOLVED_FEATURE_CELL.y, PROP_ICON_SIZE);
  const nowDrawn = propDraws(ctx2).some((d) => Math.abs(d.x - resolvedXY.x) < 1e-9 && Math.abs(d.y - resolvedXY.y) < 1e-9);
  assert.ok(nowDrawn, "the floor prop must reappear once its cell's feature has resolved");
});

// ─── (4) fog ────────────────────────────────────────────────────────────

test("(4) fog: on a clone where only part of the grid is seen, no prop draws on an unseen cell", () => {
  const { sandbox, ctx, state } = buildScenario({
    mutate: (s) => {
      // Reveal only a small strip near the start — leave the rest unseen,
      // exactly the "only part of the grid is seen" fixture the plan asks
      // for (genFloor's own initial reveal already leaves most unseen; this
      // just makes the boundary explicit and deterministic).
      for (const row of s.floor.g) for (const cell of row) cell.seen = false;
      for (let y = 0; y <= 3; y++) for (let x = 0; x <= 3; x++) s.floor.g[y][x].seen = true;
    },
  });
  const expected = expectedVisible(sandbox, state);
  sandbox.context.draw();
  const draws = propDraws(ctx);
  assert.equal(draws.length, expected.length, "only the seen-cell props may draw");
  for (const d of draws) {
    const gx = Math.round((d.x - (CELL - PROP_ICON_SIZE) / 2) / CELL);
    const gy = Math.round((d.y - (CELL - PROP_ICON_SIZE) / 2) / CELL);
    assert.ok(state.floor.g[gy][gx].seen, `a prop drew on unseen cell (${gx},${gy})`);
  }
});

// ─── (5) the render window ──────────────────────────────────────────────

test("(5) the render window: with the party on a dark square and no waiver, no prop draws outside the 3x3 window; props inside it still draw", () => {
  const { sandbox, ctx, state } = buildScenario({
    mutate: (s) => {
      seenAll(s);
      s.floor.g[s.floor.py][s.floor.px].dark = true; // TERR-03: collapses mapViewRadius to 1, no waiver on a fresh state
    },
  });
  const expected = expectedVisible(sandbox, state);
  const { px, py } = state.floor;
  sandbox.context.draw();
  const draws = propDraws(ctx);
  assert.equal(draws.length, expected.length);
  for (const d of draws) {
    const gx = Math.round((d.x - (CELL - PROP_ICON_SIZE) / 2) / CELL);
    const gy = Math.round((d.y - (CELL - PROP_ICON_SIZE) / 2) / CELL);
    assert.ok(Math.abs(gx - px) <= 1 && Math.abs(gy - py) <= 1, `a prop drew at (${gx},${gy}), outside the 3x3 dark window around (${px},${py})`);
  }
});

// ─── (6) Off (DRESS-05, D-16) ───────────────────────────────────────────

test("(6) Off: with dressing disabled, zero prop draws; the feature draw list equals the enabled run's feature draws exactly", () => {
  const images = makeDressingImages();
  const onScn = buildScenario({ dressing: { enabled: true, images } });
  onScn.sandbox.context.draw();
  const onFeatures = featureDraws(onScn.ctx);

  const offScn = buildScenario({ dressing: { enabled: false, images } });
  offScn.sandbox.context.draw();
  assert.equal(propDraws(offScn.ctx).length, 0, "Off must draw zero props");
  const offFeatures = featureDraws(offScn.ctx);
  assert.equal(offFeatures.length, onFeatures.length);
  for (let i = 0; i < onFeatures.length; i++) {
    assert.equal(offFeatures[i].x, onFeatures[i].x);
    assert.equal(offFeatures[i].y, onFeatures[i].y);
    assert.equal(offFeatures[i].alpha, onFeatures[i].alpha);
  }
});

// ─── (7) before the lazy load (D-14) ────────────────────────────────────

test("(7) before the lazy load: the default sandbox (no dressing option, images not yet loaded) records zero prop draws and throws nothing", () => {
  const doc = createRecordingDocument();
  const ctx = createRecordingContext();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw: false, canvasContext: ctx });
  const state = seenAll(newRun(1));
  sandbox.setState(state);
  assert.doesNotThrow(() => sandbox.context.draw());
  assert.equal(propDraws(ctx).length, 0);
});

// ─── (8) determinism (DRESS-04) ─────────────────────────────────────────

test("(8) determinism: two draw() calls record identical call lists, and a state round-tripped through serializeRun/validateSave/rehydrate draws its props at identical positions", () => {
  const images = makeDressingImages();
  const { sandbox, ctx, state } = buildScenario({ dressing: { enabled: true, images } });
  sandbox.context.draw();
  const first = propDraws(ctx).map((d) => ({ icon: d.img.dressingIcon, x: d.x, y: d.y, alpha: d.alpha }));
  sandbox.context.draw();
  const combined = propDraws(ctx).map((d) => ({ icon: d.img.dressingIcon, x: d.x, y: d.y, alpha: d.alpha }));
  const second = combined.slice(first.length);
  assert.deepEqual(second, first, "a second draw() call on the same state must record an identical prop-draw list");

  const reloaded = rehydrate(validateSave(JSON.stringify(serializeRun(state))).value);
  const doc2 = createRecordingDocument();
  const ctx2 = createRecordingContext();
  const sandbox2 = loadShellSandbox({ doc: doc2, reducedMotion: true, stubDraw: false, canvasContext: ctx2, dressing: { enabled: true, images } });
  sandbox2.setState(reloaded);
  sandbox2.context.draw();
  const reloadedDraws = propDraws(ctx2).map((d) => ({ icon: d.img.dressingIcon, x: d.x, y: d.y, alpha: d.alpha }));
  assert.deepEqual(reloadedDraws, first, "a save/reload round trip must draw the identical prop positions");
});

// ─── (9) the engine is untouched ────────────────────────────────────────

test("(9) the engine is untouched: JSON.stringify(state) before and after draw() is identical", () => {
  const { sandbox, state } = buildScenario();
  const before = JSON.stringify(state);
  sandbox.context.draw();
  const after = JSON.stringify(state);
  assert.equal(after, before);
});

// ─── (10) settings wiring (source) ──────────────────────────────────────

test("(10) settings wiring (source): the Set dressing row's shape/position, the handler redraw, setEnabled in applySettings, and the TDZ order", () => {
  const stripped = stripHtml(HTML);

  const hapticsIdx = stripped.indexOf('data-setting="haptics"');
  const dressingIdx = stripped.indexOf('data-setting="dressing"');
  const versionRowIdx = stripped.indexOf('id="mw-settings-version-row"');
  assert.ok(hapticsIdx !== -1 && dressingIdx !== -1 && versionRowIdx !== -1);
  assert.ok(hapticsIdx < dressingIdx && dressingIdx < versionRowIdx, "the dressing row must sit after Haptics and before the version row");
  assert.equal((stripped.match(/data-setting="dressing"/g) || []).length, 1);

  assert.equal((stripped.match(/if \(key === "dressing"\) window\.draw\?\.\(\);/g) || []).length, 1);
  assert.equal((stripped.match(/dressingArt\.setEnabled\(settings\.dressing === true\);/g) || []).length, 1);

  const dressingArtIdx = stripped.indexOf("const dressingArt = createDressingArt(");
  const firstApplySettingsCallIdx = stripped.indexOf("applySettings(await readSettings())");
  assert.notEqual(dressingArtIdx, -1);
  assert.notEqual(firstApplySettingsCallIdx, -1);
  assert.ok(dressingArtIdx < firstApplySettingsCallIdx, "dressingArt must be declared before the first applySettings(await readSettings()) call (TDZ)");
});

// ─── (11) lazy load (source) ─────────────────────────────────────────────

test("(11) lazy load (source): loadIconSet( appears in the module script only inside createDressingArt('s argument slice; dressingArt.release() is scheduled once, inside requestAnimationFrame(() => setTimeout(, after __mzClassicBoot()", () => {
  const stripped = stripHtml(HTML);
  const modStart = stripped.indexOf('<script type="module">');
  assert.notEqual(modStart, -1);
  const modSlice = stripped.slice(modStart);

  assert.equal((modSlice.match(/loadIconSet\(/g) || []).length, 1, "loadIconSet( must appear exactly once in the module script");
  const createIdx = modSlice.indexOf("createDressingArt(");
  const closeIdx = modSlice.indexOf("});", createIdx);
  const argSlice = modSlice.slice(createIdx, closeIdx);
  assert.ok(argSlice.includes("loadIconSet("), "loadIconSet( must be inside createDressingArt('s own argument slice");

  assert.equal((modSlice.match(/dressingArt\.release\(\)/g) || []).length, 1);
  const releaseIdx = modSlice.indexOf("dressingArt.release()");
  const rafIdx = modSlice.lastIndexOf("requestAnimationFrame(() => setTimeout(", releaseIdx);
  assert.notEqual(rafIdx, -1);
  assert.ok(rafIdx < releaseIdx, "release() must be scheduled inside requestAnimationFrame(() => setTimeout(");
  const bootIdx = modSlice.indexOf("await window.__mzClassicBoot();");
  assert.notEqual(bootIdx, -1);
  assert.ok(releaseIdx > bootIdx, "release() must be scheduled after __mzClassicBoot()");
});
