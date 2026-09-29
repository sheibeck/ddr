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
  // Every other token takes the full scale (no cap), except band 1's
  // --mw-font-hud-ident (78-05, pinned in the band-1 test below).
  for (const [name, v] of decls) {
    if (name === "--mw-font-hud-label" || name === "--mw-font-hud-num" || name === "--mw-font-hud-ident") continue;
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

test("HUD-01 band-1 cap: band 1's --mw-font-hud-ident caps at 1.1 like band 2, so S < M < L holds and more of 'Race Sub-class · Lvl N' fits 412px at L", () => {
  const decls = new Map(tokenDeclarations().map((d) => [d.name, d.value]));
  const v = decls.get("--mw-font-hud-ident");
  const m = v.match(/min\(var\(--mw-text-scale\),\s*([\d.]+)\)/);
  assert.ok(m, `--mw-font-hud-ident (${v}) caps its scale`);
  assert.equal(Number(m[1]), 1.1, "--mw-font-hud-ident caps at 1.1");
  const [s, mid, l] = [0.85, 1, 1.25].map((x) => Math.min(x, Number(m[1])));
  assert.ok(s < mid && mid < l, `band 1: S ${s} < M ${mid} < L ${l}`);
  // Band 1's budget (13px Courier Prime Bold, 0.6em advance; 412px minus the
  // 28px padding and two 8px gaps): a typical "Thrain Anvilborn" with
  // "Dwarven Pickpocket · Lvl 3" and "18/18 HP" is 50 glyphs. At the capped
  // L that is 50 x 8.58 = 429px of 368, so the line ellipsizes. Since 78-06
  // (HUD-01) only the "Race Sub-class" span ellipsizes: " · Lvl N" is its
  // own flex:none span, and test/unit/shell-map-hud.test.js (c2) proves the
  // level fits at S, M and L for the longest names. 78-05 measured the
  // single-span line over 2,000 rolls: the full line fit L 4.2% -> 29.3%
  // with the cap, M 72.4%.
  const glyph = 13 * l * 0.6;
  assert.equal(glyph.toFixed(2), "8.58");
  console.log(`text-scale: band 1 at the capped L is ${glyph.toFixed(2)}px per glyph (uncapped ${(13 * 1.25 * 0.6).toFixed(2)}).`);
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

// ─── Task 2: every screen's text scales, the combat screen included ────────

// The only fixed sizes left: glyphs and icons sized to a fixed box (not
// running text), and the dev-only readouts that never ship. Each entry is
// the exact selector and value, with its reason.
const ALLOWLIST = [
  { selector: ".mw-major-icon", value: "54px", reason: "the major card's icon glyph (or its PNG), sized to the card's fixed icon box" },
  { selector: ".mw-rail-icon", value: "20px", reason: "the rail's icon glyph (or its PNG), sized to the rail's fixed icon slot" },
  { selector: ".mw-hud-menu-face", value: "18px", reason: "the ☰ glyph inside band 2's fixed 34px button face" },
  { selector: ".mw-acct-initials", value: "10px", reason: "the account monogram inside the fixed 34px avatar disc it replaces the ☰ in" },
  { selector: ".mw-acct-glyph", value: "15px", reason: "the '?' avatar glyph inside the title chip's fixed disc" },
  { selector: '.mw-hud-menu-glyph[data-glyph="marks"]', value: "13px", reason: "a ☰ dropdown row's icon glyph, beside the scaled row label" },
  { selector: '.mw-hud-menu-glyph[data-glyph="camp"]', value: "16px", reason: "a ☰ dropdown row's icon glyph, beside the scaled row label" },
  { selector: '.mw-hud-menu-glyph[data-glyph="settings"]', value: "15px", reason: "a ☰ dropdown row's icon glyph, beside the scaled row label" },
  // Phase 79.3 (BUG-01 D-08, NOTES-02 D-20): the two new always-enabled rows.
  { selector: '.mw-hud-menu-glyph[data-glyph="report"]', value: "14px", reason: "a ☰ dropdown row's icon glyph, beside the scaled row label" },
  { selector: '.mw-hud-menu-glyph[data-glyph="notes"]', value: "15px", reason: "a ☰ dropdown row's icon glyph, beside the scaled row label" },
  { selector: "#mw-dev-perf", value: "10px", reason: "the dev-only frame-timing readout, never shown in a release build" },
];
// The `font:` shorthand's one fixed size (a dev-only chip).
const SHORTHAND_ALLOWLIST = [
  { selector: ".mw-dev-chip", reason: "the dev-only DEV chip, never shown in a release build" },
];

// The combat screen: the foe cards, YOUR LOT and its chips, the action area
// and its submenus, the round strip, the over-panels, the encounter panel
// and THE FIGHT SO FAR sheet. None of it may be allowlisted.
const COMBAT_SELECTOR = /(^|[\s,>+~])(\.cb-|#cb-|\.enc-|#enc-|\.mw-fl-|#mw-fightlog)/;

function fontSizeDeclarations() {
  const out = [];
  for (const rule of RULES) {
    for (const d of rule.body.matchAll(/(?:^|;|\s)font-size\s*:\s*([^;]+)/g)) {
      out.push({ selector: rule.selector, value: d[1].trim() });
    }
  }
  return out;
}

function isScaled(value) {
  const v = value.replace(/\s*!important$/, "");
  if (/^var\(--mw-font-[a-z0-9-]+\)$/.test(v)) return true;
  // A scaled expression: multiplies by the scale, and every length in it is
  // rem (or a viewport unit inside a clamp) — never px, never em.
  return /var\(--mw-text-scale\)/.test(v) && !/\d(px|em)\b/.test(v);
}

test("HUD-04 every font-size: each is a token, a scaled rem, or an allowlisted glyph size with a reason", () => {
  const decls = fontSizeDeclarations();
  assert.ok(decls.length > 200, `the walker found the shell's font sizes (${decls.length})`);
  const used = new Set();
  for (const d of decls) {
    if (isScaled(d.value)) continue;
    const entry = ALLOWLIST.find((a) => a.selector === d.selector && a.value === d.value);
    assert.ok(entry, `${d.selector} { font-size:${d.value} } must scale with var(--mw-text-scale) or be allowlisted`);
    assert.ok(entry.reason.length > 10, `${d.selector} carries a reason`);
    used.add(entry.selector);
  }
  // No stale allowlist rows.
  for (const a of ALLOWLIST) assert.ok(used.has(a.selector), `allowlist row ${a.selector} still matches a rule`);
});

test("HUD-04 font shorthand: no `font:` declaration carries a fixed size outside the allowlist", () => {
  for (const rule of RULES) {
    for (const d of rule.body.matchAll(/(?:^|;|\s)font\s*:\s*([^;]+)/g)) {
      if (!/\d(px|em)\b/.test(d[1])) continue;
      assert.ok(
        SHORTHAND_ALLOWLIST.some((a) => a.selector === rule.selector),
        `${rule.selector} { font:${d[1]} } carries a fixed size`,
      );
    }
  }
});

test("HUD-04 combat: no combat-screen selector is allowlisted, and every combat font-size scales", () => {
  for (const a of ALLOWLIST) assert.doesNotMatch(a.selector, COMBAT_SELECTOR, `${a.selector} is a combat selector`);
  for (const a of SHORTHAND_ALLOWLIST) assert.doesNotMatch(a.selector, COMBAT_SELECTOR);
  const combat = fontSizeDeclarations().filter((d) => COMBAT_SELECTOR.test(d.selector));
  assert.ok(combat.length >= 40, `the combat screen's sizes were found (${combat.length})`);
  for (const d of combat) assert.ok(isScaled(d.value), `${d.selector} { font-size:${d.value} } scales`);
});

test("HUD-04 combat spot pins: a submenu row label, an action label and a foe name read their scaled rem (exact at M)", () => {
  const size = (selector) => {
    const rule = RULES.find((r) => r.selector === selector);
    assert.ok(rule, `${selector} rule found`);
    return rule.body.match(/font-size:([^;]+)/)[1].trim();
  };
  assert.equal(size(".cb-row-label"), "calc(0.46875rem * var(--mw-text-scale))", "7.5px at M");
  assert.equal(size(".cb-btn-label"), "calc(0.46875rem * var(--mw-text-scale))", "7.5px at M");
  assert.equal(size(".cb-foe-name"), "calc(0.5rem * var(--mw-text-scale))", "8px at M");
});

test("HUD-04 adjacency: every scaled rem equals its old px at M (1rem is 16px) and grows strictly S < M < L", () => {
  for (const d of fontSizeDeclarations()) {
    const m = d.value.match(/^calc\(([\d.]+)rem \* var\(--mw-text-scale\)\)/);
    if (!m) continue;
    const px = Number(m[1]) * 16;
    // Every converted size is a whole or half pixel at M.
    assert.equal(px * 2, Math.round(px * 2), `${d.selector}: ${m[1]}rem is ${px}px at M`);
    const [s, mid, l] = [0.85, 1, 1.25].map((k) => px * k);
    assert.ok(s < mid && mid < l, `${d.selector}: S < M < L`);
  }
});

test("HUD-04 encoding: no font size anywhere is written in em", () => {
  for (const d of fontSizeDeclarations()) assert.doesNotMatch(d.value, /\d(\.\d+)?em\b/, `${d.selector}: ${d.value}`);
});
