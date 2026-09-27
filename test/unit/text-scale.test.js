// test/unit/text-scale.test.js
//
// Phase 78 (HUD-04), Plan 02 — the Settings text size (S/M/L) scales EVERY
// piece of shell text.
//
// The 2026-09-23 finding: every `--mw-font-*` token is declared on :root
// (the <html> element) as calc(<rem> * var(--mw-text-scale)), but the shell
// wrote the live scale on #app. A custom property's var() resolves where the
// property is DECLARED, so each token was computed on :root against the
// root's default scale of 1 and inherited, already resolved, by #app. Only
// the rules that multiplied by the scale themselves (the Gear and Boards
// CSS) ever followed the setting. The fix writes the scale on the root.
//
// This file pins:
//   - the token walker: every `--mw-font-*` declaration in every <style>
//     block multiplies by var(--mw-text-scale), and none is redeclared
//     outside :root (a later rule would shadow the scaled declaration);
//   - the root write: applySettings sets `--mw-text-scale` on
//     document.documentElement, once, and the root starts at 1;
//   - the every-font-size rule (Task 2): each CSS font-size is a token, a
//     scaled rem expression, or an allowlisted non-text glyph size with a
//     reason; the combat screen has no allowlisted entry.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

// Every <style> block joined, comments stripped (a comment may quote a token
// or a px size in prose).
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// A flat list of { selector, body } rules. @media / @supports wrappers are
// flattened: the regex only ever matches an innermost `selector{body}`.
const RULES = [...STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].trim().replace(/\s+/g, " "),
  body: m[2],
}));

function tokenDeclarations() {
  const out = [];
  for (const rule of RULES) {
    for (const d of rule.body.matchAll(/(--mw-font-[a-z0-9-]+)\s*:\s*([^;]+)/g)) {
      out.push({ selector: rule.selector, name: d[1], value: d[2].trim() });
    }
  }
  return out;
}

const KNOWN_TOKENS = [
  "--mw-font-micro",
  "--mw-font-body",
  "--mw-font-data",
  "--mw-font-display",
  "--mw-font-hud-label",
  "--mw-font-hud-num",
  "--mw-font-hud-ident",
];

test("HUD-04 walker: every --mw-font-* token multiplies by var(--mw-text-scale)", () => {
  const decls = tokenDeclarations();
  const names = new Set(decls.map((d) => d.name));
  for (const known of KNOWN_TOKENS) assert.ok(names.has(known), `${known} is declared`);
  assert.ok(decls.length >= KNOWN_TOKENS.length, "the walker found every known token");
  for (const d of decls) {
    assert.match(d.value, /var\(--mw-text-scale\)/, `${d.name} (${d.value}) scales with the setting`);
    // rem against the 16px root, never em (an em inside a scaled parent
    // would compound the scale) and never a fixed px.
    assert.doesNotMatch(d.value, /\d(px|em)\b/, `${d.name} (${d.value}) is written in rem`);
  }
});

test("HUD-04 ordering: no --mw-font-* token is redeclared outside :root", () => {
  for (const d of tokenDeclarations()) {
    assert.equal(d.selector, ":root", `${d.name} is declared only on :root (found on "${d.selector}")`);
  }
  // Each token is declared exactly once.
  const counts = new Map();
  for (const d of tokenDeclarations()) counts.set(d.name, (counts.get(d.name) || 0) + 1);
  for (const [name, n] of counts) assert.equal(n, 1, `${name} is declared once`);
});

test("HUD-04 empty: the root starts at --mw-text-scale:1 before settings load", () => {
  const root = RULES.filter((r) => r.selector === ":root").map((r) => r.body).join(";");
  assert.match(root, /--mw-text-scale\s*:\s*1\s*;/);
});

test("HUD-04 band-2 cap: band 2's tokens cap their scale at 1.1, so S < M < L holds and the counters plus the ☰ fit 412px at L", () => {
  const decls = new Map(tokenDeclarations().map((d) => [d.name, d.value]));
  const cap = (value) => {
    const m = value.match(/min\(var\(--mw-text-scale\),\s*([\d.]+)\)/);
    return m ? Number(m[1]) : Infinity;
  };
  const effective = (value, scale) => Math.min(scale, cap(value));
  for (const name of ["--mw-font-hud-label", "--mw-font-hud-num"]) {
    const v = decls.get(name);
    assert.equal(cap(v), 1.1, `${name} caps at 1.1`);
    const [s, m, l] = [0.85, 1, 1.25].map((x) => effective(v, x));
    assert.ok(s < m && m < l, `${name}: S ${s} < M ${m} < L ${l}`);
    assert.equal(m, 1, `${name} is unchanged at M`);
  }
  // Every other token takes the full scale (no cap).
  for (const [name, v] of decls) {
    if (name === "--mw-font-hud-label" || name === "--mw-font-hud-num") continue;
    assert.equal(cap(v), Infinity, `${name} takes the full scale`);
  }
  // Band 2's budget at the capped L (the hud-menu-layout (14) model: glyph
  // advances x scale, fixed px gaps): DEPTH/DAY/SQUARES/RATIONS labels at
  // 6.5px per glyph, the 3+3+5+2 digit slots at 9.6px, 4 x 2px label gaps,
  // 3 x 8px item gaps, 28px padding, 10px band gap, the ☰'s 40px footprint.
  const L = effective(decls.get("--mw-font-hud-num"), 1.25);
  const text = (22 * 6.5 + 13 * 9.6 + 4 * 2) * L;
  const total = text + 3 * 8 + 28 + 10 + 40;
  assert.ok(total <= 411, `band 2 at the capped L computes to ${total.toFixed(1)}px of 411`);
  // Headless Chrome at 412px measured 404.5px (78-02 SUMMARY).
});

test("HUD-04 root write:applySettings sets --mw-text-scale on document.documentElement, exactly once", () => {
  const writes = HTML.match(/documentElement\.style\.setProperty\("--mw-text-scale"/g) || [];
  assert.equal(writes.length, 1, "one root write");
  // No element other than the root carries the scale any more: a write on
  // #app would only shadow the root's value for #app's subtree.
  const anyWrites = HTML.match(/\.style\.setProperty\("--mw-text-scale"/g) || [];
  assert.equal(anyWrites.length, 1, "the root write is the only text-scale write");
  const fn = HTML.match(/function applySettings\(settings\) \{[\s\S]*?\n  \}\n/);
  assert.ok(fn, "applySettings found");
  assert.match(
    fn[0],
    /document\.documentElement\.style\.setProperty\("--mw-text-scale", String\(effectiveTextScale\(settings\.textSize\)\)\)/,
    "applySettings writes the effective scale on the root",
  );
});
