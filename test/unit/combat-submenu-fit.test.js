// test/unit/combat-submenu-fit.test.js
//
// Phase 77 (CMBUI-07, user device report 2026-09-21: "the button text runs
// past the bottom of the button"). Every combat submenu row (SPELLS,
// ABILITIES, ITEMS, SOCIAL) GROWS to fit its whole label and description.
// The measured root cause: .cb-sub-list is a column flex container capped at
// 206px with overflow:auto, and .cb-row's explicit min-height:48px replaced
// the flex item's content-based minimum, so a long submenu shrank every row
// to 48px and its description ran past the bottom border. These are source
// pins on the joined <style> text (CRLF-normalised): the row never shrinks,
// nothing cuts its words, and the list still scrolls. The Pixel 7 check at
// milestone close is the visual backstop.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HTML = fs.readFileSync(path.join(ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// Every declaration block whose selector list names `sel` as a whole class
// token (so `.cb-row` does not match `.cb-row-label`).
function rulesFor(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const token = new RegExp(esc + "(?![\\w-])");
  const out = [];
  for (const m of STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(",").map((s) => s.replace(/\/\*[\s\S]*?\*\//g, "").trim());
    if (selectors.some((s) => token.test(s))) out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

// The one base rule whose selector is exactly `sel`.
function baseRule(sel) {
  const found = rulesFor(sel).filter((r) => r.selector.replace(/\/\*[\s\S]*?\*\//g, "").trim() === sel);
  assert.equal(found.length, 1, `exactly one base ${sel} rule`);
  return found[0].body;
}

function decl(body, prop) {
  const m = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)").exec(body);
  return m ? m[1].trim() : null;
}

test("CMBUI-07: .cb-row never shrinks inside the capped list (flex:none or flex-shrink:0)", () => {
  const body = baseRule(".cb-row");
  const flex = decl(body, "flex");
  const shrink = decl(body, "flex-shrink");
  assert.ok(flex === "none" || shrink === "0", `.cb-row must not shrink (flex=${flex}, flex-shrink=${shrink})`);
});

test("CMBUI-07: .cb-row leaves at least as much room at the bottom as at the top, and keeps its 48px tap target", () => {
  const body = baseRule(".cb-row");
  const pad = decl(body, "padding");
  assert.ok(pad, ".cb-row declares a padding");
  const parts = pad.split(/\s+/).map((p) => parseFloat(p));
  const top = parts[0];
  const bottom = parts.length >= 3 ? parts[2] : top;
  assert.ok(bottom >= top, `bottom padding ${bottom}px >= top padding ${top}px`);
  assert.equal(decl(body, "min-height"), "48px");
});

test("CMBUI-07: no rule cuts a submenu row's words (no hidden overflow, ellipsis, line clamp or nowrap)", () => {
  for (const sel of [".cb-row", ".cb-row-head", ".cb-row-label", ".cb-row-desc", ".cb-row-cost"]) {
    for (const { selector, body } of rulesFor(sel)) {
      assert.doesNotMatch(body, /overflow(-x|-y)?\s*:\s*(hidden|clip)/, `${selector} must not hide overflow`);
      assert.doesNotMatch(body, /text-overflow/, `${selector} must not set text-overflow`);
      assert.doesNotMatch(body, /line-clamp/, `${selector} must not clamp lines`);
      assert.doesNotMatch(body, /white-space\s*:\s*nowrap/, `${selector} must not forbid wrapping`);
    }
  }
});

test("CMBUI-07: the label and the description wrap long words (overflow-wrap:anywhere)", () => {
  assert.equal(decl(baseRule(".cb-row-label"), "overflow-wrap"), "anywhere");
  assert.equal(decl(baseRule(".cb-row-desc"), "overflow-wrap"), "anywhere");
  // The label keeps its shrinkable min-width and display font.
  assert.equal(decl(baseRule(".cb-row-label"), "min-width"), "0");
  assert.equal(decl(baseRule(".cb-row-label"), "font-family"), "var(--disp)");
});

test("CMBUI-07: the row head aligns to the top so a wrapped label and the cost read cleanly", () => {
  assert.equal(decl(baseRule(".cb-row-head"), "align-items"), "flex-start");
});

test("CMBUI-07: no rule fixes a .cb-row height or max-height (content decides)", () => {
  for (const { selector, body } of rulesFor(".cb-row")) {
    assert.doesNotMatch(body, /(^|;)\s*height\s*:/, `${selector} must not fix a height`);
    assert.doesNotMatch(body, /max-height\s*:/, `${selector} must not cap a height`);
  }
});

test("CMBUI-07: .cb-sub-list keeps its 206px cap and still scrolls", () => {
  const body = baseRule(".cb-sub-list");
  assert.equal(decl(body, "overflow"), "auto");
  assert.equal(decl(body, "max-height"), "206px");
  assert.equal(decl(body, "flex-direction"), "column");
});

test("CMBUI-07: the CSS names CMBUI-07 and the confirmed root cause", () => {
  assert.match(STYLE, /CMBUI-07/);
  assert.match(STYLE, /min-height:48px replaces the flex item's content-based\s+minimum/);
});

test("CMBUI-07: cbRow builds the head, label, cost and description whole, via textContent (no JS truncation)", () => {
  const start = HTML.indexOf("function cbRow(row, n)");
  assert.ok(start > 0, "cbRow exists");
  const end = HTML.indexOf("\n}\n", start);
  const fn = HTML.slice(start, end);
  assert.match(fn, /className = "cb-row-head"/);
  assert.match(fn, /className = "cb-row-label"/);
  assert.match(fn, /className = "cb-row-cost"/);
  assert.match(fn, /className = "cb-row-desc"/);
  assert.match(fn, /label\.textContent = row\.label;/);
  assert.match(fn, /cost\.textContent = row\.cost;/);
  assert.match(fn, /desc\.textContent = row\.desc;/);
  assert.doesNotMatch(fn, /innerHTML|\.slice\(|\.substring\(|\.substr\(|…|\.\.\./);
});
