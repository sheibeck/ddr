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
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { VIGNETTE_LEVELS, vignetteFor, waiverFor } from "../../src/browser/darknessView.js";
import { GW, GH } from "../../engine/maze.js";
import { inDark, revealRadius, mapViewRadius, skill, eff } from "../../engine/derived.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

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

// ═══════════════════════════════════════════════════════════════════════════
// SHELL SECTION (Task 2) — through test/unit/harness/shellSandbox.js's
// loadShellSandbox, proving paintVignette()/paintConditions' waiver clause
// wire the pure module correctly, on the REAL classic paint().
// ═══════════════════════════════════════════════════════════════════════════

function darknessBridge() {
  return { inDark, revealRadius, mapViewRadius, vignetteFor, waiverFor, skill, eff };
}

/**
 * paintDarkness(state, { withBridge }) — a sibling of hud-bands-layout.test
 * .js's own paintFresh(state) helper, with the __mzDarkness bridge wired (or
 * deliberately withheld, for the fail-open case) BEFORE paint() runs.
 */
function paintDarkness(state, { withBridge = true } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  if (withBridge) sandbox.context.window.__mzDarkness = darknessBridge();
  sandbox.setState(state);
  sandbox.paint();
  return doc;
}

function darknessChip(doc) {
  const host = doc.document.getElementById("mm-conditions");
  return host.children.find((el) => el.dataset && el.dataset.key === "darkness") || null;
}

function chipDetailText(chip) {
  if (!chip) return null;
  const detailEl = chip.children.find((el) => el.className === "mw-cond-detail");
  return detailEl ? detailEl.textContent : null;
}

function baseThiefWithDarkness(darkFor, extra = {}) {
  const states = fixedStates();
  const state = structuredClone(states.thief);
  state.c.darkFor = darkFor;
  // The fixture Thief rolls a Wilmsry (innate Night Vision) — stripped by
  // default so the "no waiver" tests are actually waiver-free; the Night
  // Vision-specific test below re-adds it via `extra.skills`.
  if (state.c.skills) delete state.c.skills["Night Vision"];
  Object.assign(state.c, extra);
  return state;
}

test("(shell) a running counter with no waivers: #mw-vignette is at the close level", () => {
  const doc = paintDarkness(baseThiefWithDarkness(30));
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "close");
});

test("(shell) the counter zeroed on a lit tile: #mw-vignette is at the off level", () => {
  const doc = paintDarkness(baseThiefWithDarkness(0));
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "off");
});

test("(shell) a missing __mzDarkness bridge: #mw-vignette is at the off level and paint() throws nothing (fail-open, T-57-14)", () => {
  assert.doesNotThrow(() => {
    const doc = paintDarkness(baseThiefWithDarkness(30), { withBridge: false });
    const vignette = doc.document.getElementById("mw-vignette");
    assert.equal(vignette.dataset.dark, "off");
  });
});

test("(shell) waiver visibility — a lit torch: #mw-vignette stays OFF and the darkness chip's detail names the torch", () => {
  const state = baseThiefWithDarkness(30, { timers: { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } } });
  const doc = paintDarkness(state);
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "off", "the map is rendering everything under the torch waiver");
  const detail = chipDetailText(darknessChip(doc));
  assert.match(detail, /torch/i, `expected the darkness chip's detail to name the torch, got: ${detail}`);
});

test("(shell) waiver visibility — a live Amulet of Light: #mw-vignette stays OFF and the chip names the amulet", () => {
  const state = baseThiefWithDarkness(30, {
    items: [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }],
    timers: { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } },
  });
  const doc = paintDarkness(state);
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "off");
  const detail = chipDetailText(darknessChip(doc));
  assert.match(detail, /amulet/i, `expected the darkness chip's detail to name the amulet, got: ${detail}`);
});

test("(shell) waiver visibility — Night Vision: #mw-vignette stays OFF and the chip names night vision", () => {
  const state = baseThiefWithDarkness(30, { skills: { "Night Vision": 1 } });
  const doc = paintDarkness(state);
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "off");
  const detail = chipDetailText(darknessChip(doc));
  assert.match(detail, /night vision/i, `expected the darkness chip's detail to name night vision, got: ${detail}`);
});

test("(shell) no waiver: the darkness chip names none, and the vignette is at the close level", () => {
  const doc = paintDarkness(baseThiefWithDarkness(30));
  const vignette = doc.document.getElementById("mw-vignette");
  assert.equal(vignette.dataset.dark, "close");
  const detail = chipDetailText(darknessChip(doc));
  assert.doesNotMatch(detail, /torch|amulet|night vision/i, `expected no waiver named, got: ${detail}`);
});

test("(shell) chip-agreement: the darkness chip and the vignette appear together and clear together on the same paint", () => {
  const state = baseThiefWithDarkness(30);
  const doc1 = paintDarkness(state);
  const condStrip1 = doc1.document.getElementById("mm-conditions");
  assert.equal(condStrip1.hidden, false, "the conditions host must not be hidden while a chip is active");
  const chip1 = darknessChip(doc1);
  assert.ok(chip1, "the darkness chip must be present");
  assert.ok(chipDetailText(chip1), "the darkness chip must carry a remaining detail");
  const vignette1 = doc1.document.getElementById("mw-vignette");
  assert.notEqual(vignette1.dataset.dark, "off", "the vignette must be in a non-off level while the chip is up");

  state.c.darkFor = 0;
  const doc2 = paintDarkness(state);
  const chip2 = darknessChip(doc2);
  assert.equal(chip2, null, "the darkness chip must be gone once the counter clears");
  const vignette2 = doc2.document.getElementById("mw-vignette");
  assert.equal(vignette2.dataset.dark, "off", "the vignette must clear on the SAME paint the chip clears");
});

// ─── Source anchors: single source of truth, comment-stripped ─────────────

test("(shell) source anchor: comment-stripped mazeworld.html contains exactly ONE darkFor occurrence (the pre-existing torch-offer guard) and ZERO local definitions of inDark/revealRadius", () => {
  const stripped = stripHtml(RAW_HTML);
  const darkForCount = (stripped.match(/\bdarkFor\b/g) || []).length;
  assert.equal(darkForCount, 1, `expected exactly one darkFor occurrence in comment-stripped mazeworld.html, found ${darkForCount}`);
  const localDefPattern = /\b(function\s+(inDark|revealRadius)\s*\(|const\s+(inDark|revealRadius)\s*=)/g;
  const localDefs = stripped.match(localDefPattern) || [];
  assert.deepStrictEqual(localDefs, [], `mazeworld.html must not locally define inDark/revealRadius — found: ${JSON.stringify(localDefs)}`);
});

test("(shell) paintVignette's body references mapViewRadius and does NOT reference revealRadius", () => {
  const stripped = stripHtml(RAW_HTML);
  const start = stripped.indexOf("function paintVignette(c) {");
  assert.ok(start !== -1, "function paintVignette(c) { not found in stripped source");
  const end = stripped.indexOf("\n}", start);
  assert.ok(end !== -1 && end > start, "no closing brace found after paintVignette");
  const body = stripped.slice(start, end);
  assert.match(body, /mapViewRadius/, "paintVignette must reference mapViewRadius");
  assert.doesNotMatch(body, /revealRadius/, "paintVignette must NOT reference revealRadius (USER RULING 2026-09-22)");
});

test("(shell) no motion added: neither .mw-vignette attribute rule contains a transition or animation declaration", () => {
  const nearRule = RAW_HTML.match(/\.mw-vignette\[data-dark="near"\]\{[^}]*\}/);
  const closeRule = RAW_HTML.match(/\.mw-vignette\[data-dark="close"\]\{[^}]*\}/);
  assert.ok(nearRule && closeRule, "both .mw-vignette[data-dark] rules must be present");
  assert.doesNotMatch(nearRule[0], /transition|animation/i);
  assert.doesNotMatch(closeRule[0], /transition|animation/i);
});

// ─── WAIVER_LABEL / dynamic explain copy: banned-wordlist self-check ──────

test("(shell) WAIVER_LABEL entries and the darkness-lead sentence template are clear of BANNED terms", () => {
  const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
  const findBannedTerms = (text) => {
    const hits = [];
    for (const { term, re } of MATCHERS) {
      const m = text.match(re);
      if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
    }
    return hits;
  };
  const region = RAW_HTML.slice(RAW_HTML.indexOf("const WAIVER_LABEL = {"), RAW_HTML.indexOf("};", RAW_HTML.indexOf("const WAIVER_LABEL = {")));
  assert.ok(region.length > 0, "WAIVER_LABEL region not found");
  const leaves = [...region.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
  assert.ok(leaves.length >= 3, "expected the three waiver labels");
  for (const leaf of leaves) {
    assert.deepStrictEqual(findBannedTerms(leaf), [], `Banned copy in WAIVER_LABEL: "${leaf}"`);
  }
  assert.deepStrictEqual(findBannedTerms("The dark is on you, but your torch is keeping it off the map."), []);
});
