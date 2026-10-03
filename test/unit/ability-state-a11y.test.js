// test/unit/ability-state-a11y.test.js
//
// Phase 94 (ASTATE-01 look, ASTATE-05 a11y half; CONTEXT "Four colour
// families", "Non-colour cue", "Themes"). The four ability-state inks are CSS
// tokens defined once in mazeworld.html's :root, and each state has its own
// row edge (solid, dashed, dotted plus a hatch, faded with no edge) so the
// states read apart without colour. This file pins, as pure arithmetic over
// the shipped CSS (no browser, no dependency):
//   - the shipped dark theme: every label ink >= 4.5:1 on its own background
//     (the hatch at its declared alpha included), every visible edge >= 3:1;
//   - greyscale distinctness: pairwise relative-luminance ratio >= 1.30;
//   - colour-blind distinctness: pairwise CIE76 distance >= 20 for normal
//     vision, protanopia and deuteranopia (Machado 2009, severity 1.0);
//   - the non-colour cue: four distinct edge signatures on the combat rows and
//     on the Hero tab rows.
// Fail-first habit (as in bridge-registry.test.js): the same checks must FAIL
// for the old good/warn/bad/disabled inks and for a doctored edge, so a green
// run here means the checks can actually fail.
// The shell-snapshot half of ASTATE-05 is plan 94-05.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HTML = fs.readFileSync(path.join(ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// Named thresholds.
const MIN_TEXT = 4.5; // WCAG AA, normal text
const MIN_EDGE = 3; // WCAG non-text contrast
const MAX_SPENT_EDGE = 1.5; // the spent edge must read as no edge
const MIN_GREY_RATIO = 1.3; // pairwise luminance ratio
const MIN_DELTA_E = 20; // pairwise CIE76 distance
const MAX_HATCH_ALPHA = 0.14; // the hatch stays a hint; the dotted edge carries the cue

const STATES = ["ready", "recharging", "unavailable", "spent"];
const TOKEN = (s) => "--mw-ast-" + s;

// ---- CSS helpers (the same shape as combat-submenu-fit.test.js) ----------

function rulesIn(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: m[2] });
  }
  return out;
}

function ruleBySel(css, sel) {
  const found = rulesIn(css).filter((r) => r.selector === sel);
  assert.equal(found.length, 1, `exactly one rule with the selector ${sel} (found ${found.length})`);
  return found[0].body;
}

function decl(body, prop) {
  const m = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)").exec(body);
  return m ? m[1].trim() : null;
}

// The first :root block's custom properties.
function rootTokens(css) {
  const m = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(m, ":root block exists");
  const map = {};
  for (const d of m[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!(d[1] in map)) map[d[1]] = d[2].trim();
  }
  return map;
}

const ROOT_MAP = rootTokens(STYLE);

function resolve(value, map = ROOT_MAP) {
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (!m) return value.trim();
  assert.ok(m[1] in map, `${m[1]} is defined in :root`);
  return map[m[1]];
}

// ---- Colour maths ---------------------------------------------------------

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `a six-digit hex colour, got ${hex}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linRgb = (hex) => hexToRgb(hex).map(toLinear);
function lum(hex) {
  const [r, g, b] = linRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// Composite an sRGB hex over a background hex at alpha, back to a hex string.
function composite(fg, bg, alpha) {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  const mix = f.map((c, i) => c * alpha + b[i] * (1 - alpha));
  return "#" + mix.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
}

const PROTAN = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];
const DEUTAN = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const apply = (m, v) => m.map((row) => clamp01(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));

function linToLab(lin) {
  const [r, g, b] = lin;
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const labOf = (hex, matrix) => linToLab(matrix ? apply(matrix, linRgb(hex)) : linRgb(hex));
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function pairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

function minGreyRatio(hexes) {
  return Math.min(
    ...pairs(hexes).map(([a, b]) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }),
  );
}
function minDeltaE(hexes, matrix) {
  return Math.min(...pairs(hexes).map(([a, b]) => dE(labOf(a, matrix), labOf(b, matrix))));
}

// ---- The shipped values ---------------------------------------------------

const INKS = STATES.map((s) => ROOT_MAP[TOKEN(s)]);
const OLD_INKS = ["#a8cc72", "#e8c97a", "#e07260", "#8f856f"]; // good, warn, bad, disabled

const BG_ROW = hexValue(decl(ruleBySel(STYLE, ".cb-row"), "background"));
const BG_PANEL = ROOT_MAP["--paper-2"];
const BG_PAGE = ROOT_MAP["--paper"];
const BG_SPENT = hexValue(decl(ruleBySel(STYLE, '.cb-row[data-state="spent"]'), "background"));
const INK_DESC = hexValue(decl(ruleBySel(STYLE, ".cb-row-desc"), "color"));

function hexValue(v) {
  assert.ok(v, "a colour value is declared");
  return resolve(v);
}

function hatchOf(css) {
  const body = ruleBySel(css, '.cb-row[data-state="unavailable"]');
  const bg = decl(body, "background-image");
  assert.ok(bg && /^repeating-linear-gradient\(/.test(bg), "unavailable declares a repeating-linear-gradient hatch");
  const m = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(bg);
  assert.ok(m, "the hatch uses a literal rgba()");
  const hex = "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return { hex, alpha: Number(m[4]) };
}

// The border signature of one state's rule: the line style, or "none" when the
// edge is transparent or reads as no edge on its own background.
function edgeSignature(css, selector, prop, bgHex) {
  const body = ruleBySel(css, selector);
  const v = decl(body, prop);
  assert.ok(v, `${selector} declares ${prop}`);
  const m = /(\d+)px\s+(solid|dashed|dotted)\s+(.+)$/.exec(v);
  assert.ok(m, `${selector} ${prop} is "<n>px <style> <colour>" (got ${v})`);
  if (m[3].trim() === "transparent") return "none";
  const colour = resolve(m[3]);
  if (contrast(colour, bgHex) < MAX_SPENT_EDGE) return "none";
  const extra = /background-image\s*:/.test(body) ? "+hatch" : "";
  return m[2] + extra;
}

function combatSignatures(css) {
  return STATES.map((s) => edgeSignature(css, `.cb-row[data-state="${s}"]`, "border", BG_SPENT));
}
function heroSignatures(css) {
  return STATES.map((s) => edgeSignature(css, `ul.skills li[data-state="${s}"]`, "border-left", BG_PANEL));
}
const allDistinct = (sigs) => new Set(sigs).size === sigs.length;

// ---- Tokens ---------------------------------------------------------------

test("ASTATE-01: the four tokens are declared once in :root and their hex is written nowhere else", () => {
  const want = { ready: "#cbee86", recharging: "#eeb433", unavailable: "#fc7970", spent: "#86898c" };
  for (const s of STATES) {
    assert.equal(ROOT_MAP[TOKEN(s)], want[s], `${TOKEN(s)} value`);
    const decls = HTML.match(new RegExp(TOKEN(s).replace(/-/g, "\\-") + "\\s*:", "g")) || [];
    assert.equal(decls.length, 1, `${TOKEN(s)} is declared exactly once`);
    const hexes = HTML.match(new RegExp(want[s], "gi")) || [];
    assert.equal(hexes.length, 1, `${want[s]} is written exactly once (the token)`);
  }
});

// ---- Rule shapes ----------------------------------------------------------

test("ASTATE-01: combat rows - solid, dashed, dotted plus hatch, and a faded spent row", () => {
  const edge = (s) => decl(ruleBySel(STYLE, `.cb-row[data-state="${s}"]`), "border");
  assert.equal(edge("ready"), "2px solid var(--mw-ast-ready)");
  assert.equal(edge("recharging"), "2px dashed var(--mw-ast-recharging)");
  assert.equal(edge("unavailable"), "2px dotted var(--mw-ast-unavailable)");
  assert.equal(edge("spent"), "2px solid #241f16");
  const spent = ruleBySel(STYLE, '.cb-row[data-state="spent"]');
  assert.equal(decl(spent, "background"), "#191510");
  assert.equal(decl(spent, "color"), "#8f856f");
  assert.doesNotMatch(spent, /opacity/, "spent uses explicit colours, never opacity");
  for (const s of STATES) {
    assert.equal(
      decl(ruleBySel(STYLE, `.cb-row[data-state="${s}"] .cb-row-cost`), "color"),
      `var(${TOKEN(s)})`,
      `${s} cost ink reads its token`,
    );
  }
  const hatch = hatchOf(STYLE);
  assert.equal(hatch.hex, ROOT_MAP[TOKEN("unavailable")], "the hatch rgb is the unavailable token's rgb");
  assert.ok(hatch.alpha > 0 && hatch.alpha <= MAX_HATCH_ALPHA, `hatch alpha ${hatch.alpha} in (0, ${MAX_HATCH_ALPHA}]`);
  assert.doesNotMatch(STYLE, /color-mix\(/, "no color-mix() (older Android System WebViews)");
});

test("ASTATE-01: Hero tab rows carry the same four edges on the left rule", () => {
  const edge = (s) => decl(ruleBySel(STYLE, `ul.skills li[data-state="${s}"]`), "border-left");
  assert.equal(edge("ready"), "4px solid var(--mw-ast-ready)");
  assert.equal(edge("recharging"), "4px dashed var(--mw-ast-recharging)");
  assert.equal(edge("unavailable"), "4px dotted var(--mw-ast-unavailable)");
  assert.equal(edge("spent"), "4px solid transparent");
  for (const s of STATES) {
    assert.equal(
      decl(ruleBySel(STYLE, `ul.skills li[data-state="${s}"] span`), "color"),
      `var(${TOKEN(s)})`,
      `${s} span ink reads its token`,
    );
  }
});

// ---- Contrast in the shipped dark theme -----------------------------------

test("ASTATE-05: every label ink is at least 4.5:1 on its own background", () => {
  const [ready, recharging, unavailable, spent] = INKS;
  const hatch = hatchOf(STYLE);
  const hatchBg = composite(hatch.hex, BG_ROW, hatch.alpha);
  for (const [name, ink] of [["ready", ready], ["recharging", recharging], ["unavailable", unavailable]]) {
    assert.ok(contrast(ink, BG_ROW) >= MIN_TEXT, `${name} on the row background: ${contrast(ink, BG_ROW).toFixed(2)}`);
    assert.ok(contrast(ink, BG_PANEL) >= MIN_TEXT, `${name} on the Hero panel: ${contrast(ink, BG_PANEL).toFixed(2)}`);
  }
  assert.ok(contrast(unavailable, hatchBg) >= MIN_TEXT, `unavailable on the hatch: ${contrast(unavailable, hatchBg).toFixed(2)}`);
  assert.ok(contrast(INK_DESC, hatchBg) >= MIN_TEXT, `description on the hatch: ${contrast(INK_DESC, hatchBg).toFixed(2)}`);
  assert.ok(contrast(spent, BG_SPENT) >= MIN_TEXT, `spent on the spent background: ${contrast(spent, BG_SPENT).toFixed(2)}`);
  assert.ok(contrast(spent, BG_PANEL) >= MIN_TEXT, `spent on the Hero panel: ${contrast(spent, BG_PANEL).toFixed(2)}`);
  const spentLabel = hexValue(decl(ruleBySel(STYLE, '.cb-row[data-state="spent"]'), "color"));
  assert.ok(contrast(spentLabel, BG_SPENT) >= MIN_TEXT, `spent label on the spent background: ${contrast(spentLabel, BG_SPENT).toFixed(2)}`);
});

test("ASTATE-05: every visible edge is at least 3:1; the spent edge reads as no edge", () => {
  for (const s of ["ready", "recharging", "unavailable"]) {
    const ink = ROOT_MAP[TOKEN(s)];
    assert.ok(contrast(ink, BG_PAGE) >= MIN_EDGE, `${s} edge on the page: ${contrast(ink, BG_PAGE).toFixed(2)}`);
    assert.ok(contrast(ink, BG_ROW) >= MIN_EDGE, `${s} edge on the row: ${contrast(ink, BG_ROW).toFixed(2)}`);
  }
  const spentEdge = "#241f16";
  assert.ok(contrast(spentEdge, BG_SPENT) < MAX_SPENT_EDGE, `spent edge on its background: ${contrast(spentEdge, BG_SPENT).toFixed(2)}`);
});

// ---- Non-colour cue -------------------------------------------------------

test("ASTATE-01: the four states have four distinct edge signatures (combat rows and Hero rows)", () => {
  assert.deepEqual(combatSignatures(STYLE), ["solid", "dashed", "dotted+hatch", "none"]);
  assert.deepEqual(heroSignatures(STYLE), ["solid", "dashed", "dotted", "none"]);
  assert.ok(allDistinct(combatSignatures(STYLE)));
  assert.ok(allDistinct(heroSignatures(STYLE)));
});

// ---- Greyscale and colour-blind distinctness ------------------------------

test("ASTATE-05: the four inks stay apart in greyscale (pairwise luminance ratio)", () => {
  const min = minGreyRatio(INKS);
  assert.ok(min >= MIN_GREY_RATIO, `min greyscale ratio ${min.toFixed(2)}`);
});

test("ASTATE-05: the four inks stay apart for normal vision, protanopia and deuteranopia (CIE76)", () => {
  const normal = minDeltaE(INKS, null);
  const protan = minDeltaE(INKS, PROTAN);
  const deutan = minDeltaE(INKS, DEUTAN);
  assert.ok(normal >= MIN_DELTA_E, `normal min deltaE ${normal.toFixed(1)}`);
  assert.ok(protan >= MIN_DELTA_E, `protanopia min deltaE ${protan.toFixed(1)}`);
  assert.ok(deutan >= MIN_DELTA_E, `deuteranopia min deltaE ${deutan.toFixed(1)}`);
});

// ---- Teeth ----------------------------------------------------------------

test("teeth: the old good/warn/bad/disabled inks fail the greyscale check (good vs warn collapse)", () => {
  assert.ok(minGreyRatio(OLD_INKS) < MIN_GREY_RATIO, `old inks min ratio ${minGreyRatio(OLD_INKS).toFixed(2)}`);
});

test("teeth: the old inks fail the protanopia check (bad vs the disabled grey collapse)", () => {
  assert.ok(minDeltaE(OLD_INKS, PROTAN) < MIN_DELTA_E, `old inks protanopia ${minDeltaE(OLD_INKS, PROTAN).toFixed(1)}`);
});

test("teeth: a doctored edge (recharging dashed -> solid) fails the signature check", () => {
  const doctored = STYLE.replace("2px dashed var(--mw-ast-recharging)", "2px solid var(--mw-ast-recharging)");
  assert.notEqual(doctored, STYLE, "the doctoring changed the CSS");
  assert.ok(!allDistinct(combatSignatures(doctored)), "two states share an edge signature");
});

test("teeth: a hatch alpha above the cap would be caught", () => {
  const doctored = STYLE.replace("rgba(252,121,112,.12)", "rgba(252,121,112,.30)");
  assert.notEqual(doctored, STYLE, "the doctoring changed the CSS");
  assert.ok(hatchOf(doctored).alpha > MAX_HATCH_ALPHA);
});
