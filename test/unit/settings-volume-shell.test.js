// test/unit/settings-volume-shell.test.js
//
// Phase 71 (POLISH-05, D-03): the MASTER / MUSIC / EFFECTS volume sliders in
// the settings sheet, pinned by a comment-stripped source scan of
// mazeworld.html (tools/ident-sweep.mjs's stripHtml, the stripper
// title-music-shell.test.js and sfx-settings.test.js trust).
//
// Rulings pinned here:
//  - R-01: the slider group is static markup under the Sound row, carrying
//    `hidden` while Sound is Off (the existing `.mw-settings-row[hidden]`
//    rule takes it out of layout, tab order and the accessibility tree).
//  - R-02: an `input` event applies the dragged level live through
//    applySettings and never writes storage; the `change` event (release)
//    persists once through writeSetting; the ui-tap preview plays on
//    EFFECTS release only.
//
// The level behaviour itself (volumeLevels, setLevels, setLoopLevel) is
// pinned in test/unit/sfx-levels.test.js; the persisted keys in
// test/unit/settings.test.js.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const html = stripHtml(fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n"));

/**
 * extractBody(source, signatureRe) — finds signatureRe (which must end with
 * the body's own opening `{`) and brace-counts to the matching `}`.
 */
function extractBody(source, signatureRe) {
  const m = signatureRe.exec(source);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

// Every <style> block, first open to last close (the shell has several; the
// shell-combat-screen styleBlock() shape).
function styleBlock() {
  const open = html.indexOf("<style>");
  const close = html.lastIndexOf("</style>");
  assert.ok(open > -1 && close > open, "the <style> blocks exist");
  return html.slice(open, close);
}

/** Every CSS rule whose selector mentions `mw-vol`. */
function volRules() {
  return styleBlock().match(/[^{}]*mw-vol[^{}]*\{[^}]*\}/g) || [];
}

/** The slider group's markup: from its opening tag to the Haptics row. */
function volRegion() {
  const start = html.indexOf('id="mw-vol-rows"');
  const end = html.indexOf('data-setting="haptics"', start);
  assert.ok(start > -1 && end > start, "the #mw-vol-rows group sits before the Haptics row");
  return html.slice(html.lastIndexOf("<div", start), end);
}

function listenerBody(eventName) {
  const marker = `getElementById("mw-settings-rows")?.addEventListener("${eventName}"`;
  const idx = html.indexOf(marker);
  assert.ok(idx > -1, `a delegated ${eventName} listener on #mw-settings-rows`);
  assert.equal(html.indexOf(marker, idx + 1), -1, `exactly one delegated ${eventName} listener`);
  const body = extractBody(html.slice(idx), /(?:async )?\(e\) => \{/);
  assert.ok(body, `${eventName} listener body found`);
  return body;
}

const VOLS = [
  { key: "volMaster", label: "Master", aria: "Master volume" },
  { key: "volMusic", label: "Music", aria: "Music volume" },
  { key: "volEffects", label: "Effects", aria: "Effects volume" },
];

test("settings-volume-shell (1): the Sound row, then #mw-vol-rows, then the Haptics row — the group directly follows the Sound row", () => {
  const sound = html.indexOf('data-setting="sound"');
  const vol = html.indexOf('id="mw-vol-rows"');
  const haptics = html.indexOf('data-setting="haptics"');
  assert.ok(sound > -1 && vol > sound && haptics > vol, "Sound < vol group < Haptics");
  // Between the Sound options and the vol group: only the two Sound
  // buttons and the closing tags of the Sound row — no other row.
  const between = html.slice(sound, html.lastIndexOf("<div", vol));
  assert.equal((between.match(/class="mw-settings-row/g) || []).length, 0, "no row sits between Sound and the sliders");
  assert.equal((between.match(/<button/g) || []).length, 2, "just the Sound On/Off buttons");
  assert.equal((html.match(/id="mw-vol-rows"/g) || []).length, 1);
});

test("settings-volume-shell (2): the group is one .mw-settings-row that starts hidden (R-01: no first-paint flash)", () => {
  const region = volRegion();
  const openTag = region.slice(0, region.indexOf(">") + 1);
  assert.match(openTag, /class="mw-settings-row\b[^"]*"/);
  assert.match(openTag, /\shidden(\s|>)/, "the group starts hidden");
  assert.match(styleBlock(), /\.mw-settings-row\[hidden\]\{display:none\}/, "the existing [hidden] rule removes it from layout");
});

test("settings-volume-shell (3): three native range inputs MASTER, MUSIC, EFFECTS — min 0, max 100, step 1, data-vol and aria-label, in that order", () => {
  const region = volRegion();
  const inputs = region.match(/<input\b[^>]*>/g) || [];
  assert.equal(inputs.length, 3);
  VOLS.forEach((v, i) => {
    const tag = inputs[i];
    assert.match(tag, /type="range"/);
    assert.match(tag, /min="0"/);
    assert.match(tag, /max="100"/);
    assert.match(tag, /step="1"/);
    assert.match(tag, new RegExp(`data-vol="${v.key}"`));
    assert.match(tag, new RegExp(`aria-label="${v.aria}"`));
  });
  // Each row shows its label and its current percentage, in order.
  let from = 0;
  for (const v of VOLS) {
    const at = region.indexOf(`>${v.label}<`, from);
    assert.ok(at > -1, `${v.label} label in order`);
    const pct = region.indexOf(`data-vol-pct="${v.key}"`, at);
    assert.ok(pct > -1, `${v.label} shows a percentage`);
    const input = region.indexOf(`data-vol="${v.key}"`, at);
    assert.ok(input > -1, `${v.label} input follows its label`);
    from = Math.max(pct, input);
  }
});

test("settings-volume-shell (4): renderSettingsSheet hides the group unless Sound is On, writes each value and percentage (fallback 100), and keeps its .active loop", () => {
  const body = extractBody(html, /function renderSettingsSheet\(\)\s*\{/);
  assert.ok(body, "renderSettingsSheet found");
  assert.match(body, /getElementById\("mw-vol-rows"\)/);
  assert.match(body, /\.hidden = currentSettings\.sound !== true/);
  assert.match(body, /\[data-vol\]/);
  assert.match(body, /\.value = String\(/);
  assert.match(body, /: 100/, "a missing level falls back to 100");
  assert.match(body, /\.textContent = `\$\{[a-zA-Z]+\}%`/);
  assert.ok(body.includes('btn.classList.toggle("active", btn.dataset.value === current);'), "the existing .active loop is unchanged");
});

test("settings-volume-shell (5): the input listener applies the dragged level live through applySettings and NEVER writes storage (R-02)", () => {
  const body = listenerBody("input");
  assert.match(body, /closest\?\.\("\[data-vol\]"\)/, "acts only on [data-vol] targets");
  assert.match(body, /applySettings\(\{ \.\.\.currentSettings, \[key\]: value \}\)/);
  assert.doesNotMatch(body, /writeSetting/);
  assert.doesNotMatch(body, /playUiTap/);
  assert.match(body, /Math\.min\(100, Math\.max\(0,|volSliderValue\(/, "the value is clamped to 0-100");
  assert.match(body, /\.textContent = `\$\{value\}%`/, "the row's percentage follows the drag");
});

test("settings-volume-shell (6): the change listener persists once (writeSetting -> applySettings -> renderSettingsSheet) and previews ui-tap on EFFECTS release only", () => {
  const body = listenerBody("change");
  assert.match(body, /closest\?\.\("\[data-vol\]"\)/, "acts only on [data-vol] targets");
  const w = body.indexOf("writeSetting(key, value)");
  const a = body.indexOf("applySettings(next)");
  const r = body.indexOf("renderSettingsSheet()");
  assert.ok(w > -1 && a > w && r > a, "writeSetting, then applySettings, then renderSettingsSheet");
  assert.equal((body.match(/writeSetting\(/g) || []).length, 1);
  assert.equal((body.match(/playUiTap\(/g) || []).length, 1);
  assert.ok(body.includes('if (key === "volEffects") playUiTap();'));
});

test("settings-volume-shell (7): the slider clamp helper is inline and parses an integer clamped to 0-100", () => {
  const body = extractBody(html, /function volSliderValue\(input\)\s*\{/);
  assert.ok(body, "volSliderValue found");
  assert.match(body, /Math\.round\(/);
  assert.match(body, /Math\.min\(100, Math\.max\(0, /);
});

test("settings-volume-shell (8): CSS — full-width range with a 44px touch box, the settings palette, text-scaled labels, no motion", () => {
  const rules = volRules();
  assert.ok(rules.length >= 4, "the slider rules exist");
  const all = rules.join("\n");
  const range = rules.find((r) => /^\s*\.mw-vol-range\{/.test(r));
  assert.ok(range, ".mw-vol-range rule");
  assert.match(range, /width:100%/);
  const minH = range.match(/min-height:(\d+)px/);
  assert.ok(minH && Number(minH[1]) >= 44, "at least a 44px touch box");
  assert.match(range, /appearance:none/);
  for (const color of ["#1b170f", "#4a4032", "#e8c97a"]) {
    assert.ok(all.includes(color), `the slider rules use ${color}`);
  }
  const thumb = rules.find((r) => /::-webkit-slider-thumb/.test(r));
  assert.ok(thumb, "a styled thumb");
  const thumbW = thumb.match(/width:(\d+)px/);
  assert.ok(thumbW && Number(thumbW[1]) >= 28, "a thumb of at least 28px");
  for (const cls of [".mw-vol-label", ".mw-vol-pct"]) {
    const rule = rules.find((r) => r.trim().startsWith(`${cls}{`));
    assert.ok(rule, `${cls} rule`);
    assert.match(rule, /font-size:calc\([^)]*\* var\(--mw-text-scale\)\)/, `${cls} scales with text size`);
  }
  assert.doesNotMatch(all, /transition|animation/, "no motion in the slider rules");
  assert.doesNotMatch(styleBlock(), /aria-disabled/);
});

test("settings-volume-shell (9): the click handler's Sound re-sync line is untouched and occurs exactly once", () => {
  assert.equal((html.match(/if \(key === "sound"\) unlockAudioAndSync\(\);/g) || []).length, 1);
  const body = listenerBody("click");
  assert.ok(body.includes('if (key === "sound") unlockAudioAndSync();'));
  assert.match(body, /closest\("\.mw-settings-opt"\)/, "the click handler still acts only on the option buttons");
});
