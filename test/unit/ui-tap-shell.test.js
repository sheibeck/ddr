// test/unit/ui-tap-shell.test.js
//
// Phase 71 (POLISH-10, D-15), Plan 07, Task 2 — the shell wiring of the
// click-driven UI tap sound.
//
// Sandbox proof (loadShellSandbox runs the classic script only, over a fake
// clock): guardTap registers every element it wraps in the tapGuards
// registry, and window.__mzTapArmed(el) answers that element's own arm
// guard (encArmed) — false inside the arm window and mid-beat, true once it
// has passed, null for an element guardTap never wrapped (R-24).
//
// Source pins over the comment-stripped shell: the pointerdown listener only
// unlocks; one document capture-phase click listener plays the tap through
// createUiTapSound and never stops or prevents the click (T-71-13); 71-04's
// window capture-phase suppressor still runs first (R-27); #enc-panel keeps
// its one capture-phase click listener (CSCR-08).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { UI_TAP_SELECTOR, uiTapShouldPlay } from "../../src/browser/uiTap.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CODE = stripHtml(fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n"));

/** extractCallArgs(source, marker, from) — marker ends with "("; returns "( ... )". */
function extractCallArgs(source, marker, from = 0) {
  const idx = source.indexOf(marker, from);
  if (idx === -1) return null;
  const open = idx + marker.length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function sandbox() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sb = loadShellSandbox({ doc, clock });
  return { clock, doc, sb, w: sb.context.window };
}

/** fakeEl(attrs) — a plain element for guardTap, with a real attribute map. */
function fakeEl(attrs = {}) {
  const map = new Map(Object.entries(attrs));
  const el = {
    tag: "button",
    onclick: null,
    getAttribute: (n) => (map.has(n) ? map.get(n) : null),
    setAttribute: (n, v) => map.set(n, String(v)),
    removeAttribute: (n) => map.delete(n),
    closest: (sel) => (sel === UI_TAP_SELECTOR ? el : null),
  };
  return el;
}

// ─── Sandbox proof ───────────────────────────────────────────────────────

test("ui-tap-shell (a) R-24: guardTap registers its element; __mzTapArmed answers the arm guard, false mid-beat, null when unwrapped", () => {
  const { clock, sb, w } = sandbox();
  const el = fakeEl();
  let ran = 0;
  sb.context.guardTap(el, () => { ran++; });
  sb.context.armEncounterButtons();
  assert.equal(w.__mzTapArmed(el), false, "inside the arm window the guard would swallow the tap");
  el.onclick();
  assert.equal(ran, 0, "and the handler agrees");
  clock.advance(ARM_DELAY_MS);
  assert.equal(w.__mzTapArmed(el), true, "once ARM_DELAY_MS has passed the guard acts");
  el.onclick();
  assert.equal(ran, 1);

  const realBeat = w.__mzBeat;
  w.__mzBeat = { ...realBeat, active: () => true };
  try {
    assert.equal(w.__mzTapArmed(el), false, "mid-beat, encArmed() is false");
  } finally {
    w.__mzBeat = realBeat;
  }
  assert.equal(w.__mzTapArmed(fakeEl()), null, "an element guardTap never wrapped answers null");
  assert.equal(w.__mzTapArmed(null), null);
  assert.equal(w.__mzTapArmed(undefined), null);
});

test("ui-tap-shell (a) T-71-14: __mzTapArmed answers null on a throw", () => {
  const { sb, w } = sandbox();
  const el = fakeEl();
  sb.context.guardTap(el, () => {});
  const realBeat = w.__mzBeat;
  w.__mzBeat = { active: () => { throw new Error("boom"); } };
  try {
    assert.equal(w.__mzTapArmed(el), null);
  } finally {
    w.__mzBeat = realBeat;
  }
});

test("ui-tap-shell (b) R-24 regression guard: a real #mm-conditions chip keeps its stale aria-disabled marker, and the tap still sounds once armed", () => {
  const { clock, sb, doc, w } = sandbox();
  const s = structuredClone(fixedStates().thief);
  s.c.might = 2; // one live condition, so paintConditions builds one chip
  sb.setState(s);
  sb.paint();
  const host = doc.document.getElementById("mm-conditions");
  const chip = host.children.find((c) => c.tagName === "button" || c.tag === "button" || c.className === "mw-cond");
  assert.ok(chip, "paintConditions built a chip");
  // recordingDom's closest() answers null for everything; the chip IS a
  // real <button>, so answer the tap selector with itself.
  chip.closest = (sel) => (sel === UI_TAP_SELECTOR ? chip : null);
  const deps = { armedFor: (el) => w.__mzTapArmed(el), beatActive: () => false };
  assert.equal(uiTapShouldPlay(chip, deps), false, "inside the arm window the chip's guard swallows the tap");
  clock.advance(ARM_DELAY_MS);
  sb.paint(); // a repaint rebuilds the chip and re-stamps the marker
  const chip2 = host.children.find((c) => c.className === "mw-cond");
  chip2.closest = (sel) => (sel === UI_TAP_SELECTOR ? chip2 : null);
  assert.equal(chip2.getAttribute("aria-disabled"), "true", "#mm-conditions is never swept: the marker is stale");
  assert.equal(w.__mzTapArmed(chip2), true);
  assert.equal(uiTapShouldPlay(chip2, deps), true, "the stale marker never mutes a live chip");
});

test("ui-tap-shell (c) R-25: a locked action and a guarded foe card during a beat are silent", () => {
  const { clock, sb, w } = sandbox();
  const panel = { id: "enc-panel" };
  const card = fakeEl({ role: "button" });
  card.closest = (sel) => (sel === UI_TAP_SELECTOR ? card : sel === "#enc-panel" ? panel : null);
  sb.context.guardTap(card, () => {});
  sb.context.armEncounterButtons();
  clock.advance(ARM_DELAY_MS);
  const locked = fakeEl({ "data-locked": "1", "aria-disabled": "true" });
  locked.closest = (sel) => (sel === UI_TAP_SELECTOR || sel === "[data-locked]" ? locked : sel === "#enc-panel" ? panel : null);

  const realBeat = w.__mzBeat;
  w.__mzBeat = { ...realBeat, active: () => true };
  try {
    const deps = { armedFor: (el) => w.__mzTapArmed(el), beatActive: () => !!w.__mzBeat?.active?.() };
    assert.equal(uiTapShouldPlay(locked, deps), false);
    assert.equal(uiTapShouldPlay(card, deps), false);
  } finally {
    w.__mzBeat = realBeat;
  }
  const deps = { armedFor: (el) => w.__mzTapArmed(el), beatActive: () => !!w.__mzBeat?.active?.() };
  assert.equal(uiTapShouldPlay(card, deps), true, "control: after the round the armed card ticks");
});

// ─── Source pins ─────────────────────────────────────────────────────────

test("ui-tap-shell pins: guardTap keeps its head and registers with tapGuards; tapGuards sits directly above it", () => {
  assert.match(CODE, /const tapGuards = new WeakMap\(\);\s*function guardTap\(btn, fn\) \{/);
  const body = CODE.slice(CODE.indexOf("function guardTap(btn, fn) {"), CODE.indexOf("function guardTap(btn, fn) {") + 300);
  assert.match(body, /if \(!btn\) return;\s*tapGuards\.set\(btn, encArmed\);/);
  assert.match(body, /btn\.setAttribute\("aria-disabled", "true"\);/);
  assert.match(body, /btn\.onclick = \(\) => \{ if \(encArmed\(\)\) fn\(\); \};/);
  assert.match(CODE, /window\.__mzTapArmed = \(el\) =>/);
});

test("ui-tap-shell pins (D-15): the pointerdown listener only unlocks", () => {
  const idx = CODE.search(/"pointerdown",\s*\(e\) => \{\s*unlockAudioAndSync\(\);/);
  assert.ok(idx > -1, "the first-gesture pointerdown listener keeps its (e) => { head with the unlock first");
  const region = CODE.slice(idx, CODE.indexOf("{ capture: true }", idx));
  assert.ok(region.includes("unlockAudioAndSync();"));
  assert.ok(!region.includes("playUiTap"), "the tap moved to the click listener");
  assert.ok(!region.includes("closest"), "the pointerdown listener no longer matches buttons");
});

test("ui-tap-shell pins (D-15, T-71-13): exactly one document capture-phase click listener, calling uiTapSound.onClick, never stopping or preventing", () => {
  const hits = CODE.match(/document\.addEventListener\(\s*"click"/g) || [];
  assert.equal(hits.length, 1);
  const args = extractCallArgs(CODE, "document.addEventListener(", CODE.indexOf('document.addEventListener("click", '));
  assert.ok(args, "the tap listener is written on one line: document.addEventListener(\"click\", …");
  assert.match(args, /\(e\) => uiTapSound\.onClick\(e\)/);
  assert.match(args, /\{ capture: true \}/);
  assert.doesNotMatch(args, /stopPropagation|preventDefault/);
  // It sits directly after the pointerdown listener.
  const pointer = CODE.search(/"pointerdown",\s*\(e\) => \{\s*unlockAudioAndSync\(\);/);
  const pointerEnd = CODE.indexOf("{ capture: true }", pointer);
  const click = CODE.indexOf('document.addEventListener("click", ');
  assert.ok(click > pointerEnd);
  assert.match(CODE.slice(pointerEnd, click), /^\{ capture: true \},?\s*\);\s*$/);
});

test("ui-tap-shell pins (R-26): createUiTapSound is wired with playUiTap, sfxClipCount, __mzBeat, __mzTapArmed and a one-task schedule", () => {
  assert.ok(CODE.includes('import { createUiTapSound } from "./src/browser/uiTap.js";'));
  const sfxLine = CODE.split("\n").find((l) => l.includes('from "./src/browser/sfx.js"'));
  assert.match(sfxLine, /\bsfxClipCount\b/);
  const args = extractCallArgs(CODE, "const uiTapSound = createUiTapSound(");
  assert.ok(args, "const uiTapSound = createUiTapSound( not found");
  assert.match(args, /play: \(\) => playUiTap\(\)/);
  assert.match(args, /clipCount: \(\) => sfxClipCount\(\)/);
  assert.match(args, /beatActive: \(\) => !!window\.__mzBeat\?\.active\?\.\(\)/);
  assert.match(args, /armedFor: \(el\) => window\.__mzTapArmed\?\.\(el\) \?\? null/);
  assert.match(args, /schedule: \(fn\) => setTimeout\(fn, 0\)/);
  assert.ok(CODE.indexOf("const uiTapSound = createUiTapSound(") < CODE.indexOf('document.addEventListener("click", '));
});

test("ui-tap-shell pins (R-27): 71-04's suppressor is still on window in the capture phase; the tap listener is on document", () => {
  const idx = CODE.indexOf('window.addEventListener("click", (e) => {');
  assert.ok(idx > -1);
  const body = CODE.slice(idx, idx + 300);
  assert.match(body, /foeLongPress\.consumeClick\(\)/);
  assert.match(body, /e\.stopPropagation\(\);/);
  assert.match(body, /\}, true\);/);
  assert.equal((CODE.match(/window\.addEventListener\("click"/g) || []).length, 1);
  assert.doesNotMatch(CODE, /window\.addEventListener\("click",\s*\(e\) => uiTapSound/);
});

test("ui-tap-shell pins (CSCR-08): #enc-panel still has exactly one capture-phase click listener, beatHurryTap", () => {
  assert.equal((CODE.match(/getElementById\("enc-panel"\)\?\.addEventListener\("click"/g) || []).length, 1);
  assert.match(CODE, /document\.getElementById\("enc-panel"\)\?\.addEventListener\("click", beatHurryTap, true\);/);
});

test("ui-tap-shell pins: the shell has one unlockSfx( and two playUiTap( call sites", () => {
  assert.equal((CODE.match(/unlockSfx\(/g) || []).length, 1);
  assert.equal((CODE.match(/playUiTap\(/g) || []).length, 2);
  assert.equal((CODE.match(/if \(key === "volEffects"\) playUiTap\(\);/g) || []).length, 1);
});

// ─── Phase 71 (POLISH-12, D-17): water steps always sound wet ────────────

test("ui-tap-shell pins (D-17): the dispatch audioCtx carries onWater, read from the post-dispatch floor grid, fully guarded", () => {
  const idx = CODE.indexOf("const audioCtx = {");
  assert.ok(idx > -1, "the dispatch audioCtx must exist");
  const block = CODE.slice(idx, CODE.indexOf("};", idx) + 2);
  assert.match(block, /stepped:/);
  assert.match(block, /combatType:/);
  assert.match(block, /onWater: !!postFloor\?\.g\?\.\[postFloor\.py\]\?\.\[postFloor\.px\]\?\.water,/);
  assert.match(CODE.slice(Math.max(0, idx - 200), idx), /const postFloor = result\.state\?\.floor;/);
  assert.equal((CODE.match(/const audioCtx = \{/g) || []).length, 1);
});
