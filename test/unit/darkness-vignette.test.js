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
import { inDark, revealRadius, mapViewRadius, darkWaiver, darkWaived, DARK_WAIVERS } from "../../engine/derived.js";
import { conditionEffectText } from "../../src/browser/conditionEffects.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
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

// ─── waiverFor (DARK-02, Phase 76: the single-key contract) ─────────────────
//
// waiverFor takes the engine's ONE answer (engine/derived.js#darkWaiver) and
// returns it when it is a DARK_WAIVERS key, else null. Precedence lives only
// in the engine now; the shell never recomputes the rule.

test("waiverFor: returns each DARK_WAIVERS key unchanged", () => {
  for (const key of DARK_WAIVERS) assert.equal(waiverFor(key), key);
  assert.equal(waiverFor("litTorch"), "litTorch");
  assert.equal(waiverFor("nightVision"), "nightVision");
  assert.equal(waiverFor("amuletLight"), "amuletLight");
});

test("waiverFor: null for no waiver, an unknown key, or the retired flags-object form; never throws", () => {
  assert.equal(waiverFor(null), null);
  assert.equal(waiverFor(undefined), null);
  assert.equal(waiverFor("bogus"), null);
  assert.equal(waiverFor(""), null);
  assert.equal(waiverFor({ litTorch: true }), null, "greenfield: the Phase 57 flags object is gone");
  assert.equal(waiverFor(42), null);
  assert.doesNotThrow(() => waiverFor(Symbol("x")));
});

test("waiverFor: composes with the engine's darkWaiver, so the chip names exactly what the engine reports", () => {
  assert.equal(waiverFor(darkWaiver({ skills: { "Night Vision": 1 }, items: [], timers: {} })), "nightVision");
  assert.equal(waiverFor(darkWaiver({ skills: {}, items: [], timers: {} })), null);
  assert.equal(waiverFor(darkWaiver(null)), null);
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
  assert.equal(revealRadius(state), 2, "sanity: DARK-01 (Phase 76) — the torch waiver now widens revealRadius to 2 as well; the two radii no longer diverge");
  const result = vignetteFor(inDark(state), mapViewRadius(state));
  assert.equal(result.on, true, "the counter is still running");
  assert.equal(result.level, "off", "but the map is rendering everything, so the vignette must not lie by dimming it");
});

// ─── DARK-02 agreement table: one radius, one waiver ──────────────────────

const TORCH_LIT = { "item:Torch": { cadence: "squares", left: 40, phase: "effect" } };
const TORCH_COOLING = { "item:Torch": { cadence: "squares", left: 0, cd: 40, phase: "cooldown" } };
const AMULET_ITEMS = [{ n: "Amulet of Light", eff: { sight: 1, light: 1 } }];
const AMULET_LIVE = { "item:Amulet of Light": { cadence: "squares", left: 50, cd: 50, phase: "effect" } };

const WAIVER_CASES = [
  { name: "no waiver", c: {}, key: null },
  { name: "Night Vision", c: { skills: { "Night Vision": 1 } }, key: "nightVision" },
  { name: "a live Amulet of Light", c: { items: AMULET_ITEMS, timers: AMULET_LIVE }, key: "amuletLight" },
  { name: "a lit torch", c: { timers: TORCH_LIT }, key: "litTorch" },
  { name: "a cooling torch", c: { timers: TORCH_COOLING }, key: null },
];

test("DARK-02 agreement table: the vignette is close exactly when inDark && !darkWaived, the same condition under which revealRadius is 1", () => {
  for (const wc of WAIVER_CASES) {
    for (const darkFor of [30, 0]) {
      for (const darkTile of [false, true]) {
        const state = fixedState({ c: { darkFor, ...structuredClone(wc.c) } });
        if (darkTile) state.floor.g[5][5].dark = true;
        const label = `${wc.name}, darkFor ${darkFor}, ${darkTile ? "dark" : "lit"} tile`;
        assert.equal(darkWaiver(state.c), wc.key, `${label}: the engine's waiver`);
        const limited = inDark(state) && !darkWaived(state.c);
        const level = vignetteFor(inDark(state), mapViewRadius(state)).level;
        assert.equal(level, limited ? "close" : "off", `${label}: vignette level`);
        assert.equal(revealRadius(state) === 1, limited, `${label}: revealRadius is 1 exactly when the dark limits`);
      }
    }
  }
});

test("DARK-02 adjacency: a mapViewRadius of exactly 1 is the close vignette", () => {
  assert.equal(vignetteFor(true, 1).level, "close");
});

// ═══════════════════════════════════════════════════════════════════════════
// SHELL SECTION (Task 2) — through test/unit/harness/shellSandbox.js's
// loadShellSandbox, proving paintVignette()/paintConditions' waiver clause
// wire the pure module correctly, on the REAL classic paint().
// ═══════════════════════════════════════════════════════════════════════════

function darknessBridge() {
  return { inDark, revealRadius, mapViewRadius, darkWaiver, vignetteFor, waiverFor };
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

/**
 * tapDarknessCard(state, { withBridge }) — paints with a fake clock, taps the
 * DARK chip past its arm delay and returns the tap card's text (the rail
 * line or the combat condition card, whichever the shell routes to) plus the
 * chip's detail.
 */
function tapDarknessCard(state, { withBridge = true } = {}) {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock });
  const w = sandbox.context.window;
  if (withBridge) w.__mzDarkness = darknessBridge();
  let captured = null;
  w.mzRailLine = (title, line) => { captured = line; };
  w.mzConditionCard = (title, line) => { captured = line; };
  sandbox.setState(state);
  sandbox.paint();
  const chip = darknessChip(doc);
  assert.ok(chip, "the darkness chip must be painted");
  clock.advance(ARM_DELAY_MS + 10);
  chip.onclick();
  return { text: captured, detail: chipDetailText(chip) };
}

test("(shell) DARK-02 a lit torch: the tap card names the torch and says it is holding the dark back", () => {
  const { text, detail } = tapDarknessCard(baseThiefWithDarkness(30, { timers: structuredClone(TORCH_LIT) }));
  assert.match(detail, /your torch is holding it back/);
  assert.match(text, /The dark is on you, but your torch is holding it back\./);
  assert.doesNotMatch(text, /off the map/, "the old render-only wording is gone");
  assert.doesNotMatch(text, /to hit/, "a lit torch lifts the dark's to-hit cap, so the card leads with no penalty");
});

test("(shell) DARK-02 no light: the tap card leads with the to-hit penalty and names no waiver", () => {
  const { text, detail } = tapDarknessCard(baseThiefWithDarkness(30));
  assert.doesNotMatch(detail, /torch|amulet|night vision/i);
  assert.match(text, /to hit/, `expected a to-hit lead, got: ${text}`);
  assert.doesNotMatch(text, /is holding it back/);
});

test("(shell) DARK-02 ordering: Night Vision AND a lit torch, and the chip names night vision (the engine's precedence), every time", () => {
  for (let i = 0; i < 3; i++) {
    const state = baseThiefWithDarkness(30, { skills: { "Night Vision": 1 }, timers: structuredClone(TORCH_LIT) });
    const detail = chipDetailText(darknessChip(paintDarkness(state)));
    assert.match(detail, /your night vision is holding it back/);
    assert.doesNotMatch(detail, /torch/);
  }
});

test("(shell) DARK-02 a COOLING torch: the vignette is close and the chip names no waiver", () => {
  const doc = paintDarkness(baseThiefWithDarkness(30, { timers: structuredClone(TORCH_COOLING) }));
  assert.equal(doc.document.getElementById("mw-vignette").dataset.dark, "close");
  assert.doesNotMatch(chipDetailText(darknessChip(doc)), /torch|amulet|night vision|holding/i);
});

test("(shell) DARK-02 empty: the bridge withheld, so paint() throws nothing, the vignette is off and the chip names no waiver", () => {
  const state = baseThiefWithDarkness(30, { timers: structuredClone(TORCH_LIT) });
  let doc;
  assert.doesNotThrow(() => { doc = paintDarkness(state, { withBridge: false }); });
  assert.equal(doc.document.getElementById("mw-vignette").dataset.dark, "off");
  assert.doesNotMatch(chipDetailText(darknessChip(doc)), /holding/);
});

test("DARK-02 empty: a hero with no skills and no timers names no waiver", () => {
  assert.equal(waiverFor(darkWaiver({})), null);
  assert.equal(waiverFor(darkWaiver({ skills: {}, timers: {} })), null);
});

test("DARK-02 fight truth: conditionEffectText's darkness lead names the to-hit penalty with no light, and none under a lit torch or a live Amulet", () => {
  const cn = { key: "darkness", remaining: 30 };
  assert.match(conditionEffectText(cn, baseThiefWithDarkness(30)) || "", /to hit/);
  assert.equal(conditionEffectText(cn, baseThiefWithDarkness(30, { timers: structuredClone(TORCH_LIT) })), null);
  assert.equal(conditionEffectText(cn, baseThiefWithDarkness(30, { items: AMULET_ITEMS, timers: structuredClone(AMULET_LIVE) })), null);
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
  assert.doesNotMatch(body, /revealRadius/, "paintVignette reads the one radius, mapViewRadius (DARK-02: it shares revealRadius's waiver, so there is nothing else to read)");
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
  assert.deepStrictEqual(findBannedTerms("The dark is on you, but your torch is holding it back."), []);
  // DARK-02 (Phase 76): the rewritten explain copy tells the map AND the
  // fight truth, in voice.
  const m = RAW_HTML.match(/\n  darkness: "([^"]+)",/);
  assert.ok(m, "CONDITION_EXPLAIN.darkness not found");
  const explain = m[1];
  assert.deepStrictEqual(findBannedTerms(explain), [], `Banned copy in CONDITION_EXPLAIN.darkness: ${explain}`);
  assert.match(explain, /strike/i, "the explain copy names the fight");
  assert.match(explain, /critical/i);
  assert.match(explain, /Night Vision/);
  assert.match(explain, /torch/);
  assert.match(explain, /Amulet of Light/);
  assert.match(explain, /Sense Presence/);
  assert.doesNotMatch(explain, /\bWP\b|\d/, "no WP, no roll numbers");
});
