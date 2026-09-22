// test/unit/hud-bands-layout.test.js
//
// Phase 57 (LAYOUT-04, LAYOUT-05), Plan 01, Task 3 — the structural proof
// that the four HUD bands render in the ruled order and that lifting the
// map chip strip out of #mw-maze-viewport actually fixes both reported
// symptoms: (a) a chip tap can never reach the canvas's tap-to-move
// (hit-test proof) and (b) the rect keepInViewAxis measures is honest (the
// gesture tracker's host is unchanged, so the rect it reads via
// getBoundingClientRect() no longer contains the chip band). A fifth
// section proves paint() routes band 1/band 2 through the __mzHudBands
// bridge (src/browser/hudBands.js) rather than formatting inline, using the
// real shell sandbox (test/unit/harness/shellSandbox.js).
//
// mazeworld.html has no ESM module surface a test could import directly —
// mirrors shell-map-hud.test.js/shell-gear-toolbar.test.js's own
// fs.readFileSync source-assertion pattern for (1)-(3); (4)/(5) use the
// real classic paint() through the vm sandbox.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { HUD_BAND_ANCHORS, identityLine, counterSlots } from "../../src/browser/hudBands.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

function sliceBetween(source, startMarker, endMarker, fromIndex = 0) {
  const start = source.indexOf(startMarker, fromIndex);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// ─── (1) band order matches HUD_BAND_ANCHORS exactly ───────────────────

test("(1) the four bands' anchors appear in mazeworld.html in exactly the order HUD_BAND_ANCHORS declares", () => {
  assert.equal(HUD_BAND_ANCHORS.length, 4, "HUD_BAND_ANCHORS must declare exactly four anchors");
  let cursor = -1;
  for (const anchor of HUD_BAND_ANCHORS) {
    const idx = HTML.indexOf(anchor);
    assert.ok(idx !== -1, `anchor not found in mazeworld.html: ${anchor}`);
    assert.ok(idx > cursor, `anchor out of order: "${anchor}" (index ${idx}) must come after the previous anchor (index ${cursor})`);
    cursor = idx;
  }
});

// ─── (2) LAYOUT-04(a): a chip tap can never reach the canvas gesture
// tracker because the chips are not inside its host ──────────────────────

test("(2) a chip tap can never reach the canvas gesture tracker because the chips are not inside its host: the .mw-maze-viewport slice contains no chip markup and no .mw-map-chip class occurrence", () => {
  const viewportRegion = sliceBetween(HTML, '<div class="mw-maze-viewport" id="mw-maze-viewport">', '<!-- DR5: the encounter/feature-event panel');
  assert.doesNotMatch(viewportRegion, /id="mw-map-chips"/, "the chip band id must not appear inside the viewport");
  assert.doesNotMatch(viewportRegion, /mw-map-chip/, "no .mw-map-chip class occurrence must appear inside the viewport");
  assert.doesNotMatch(viewportRegion, /id="mw-chip-marks"|id="mw-chip-centre"|id="btn-camp"|id="mw-gear-btn"/, "none of the four chip ids may appear inside the viewport");
});

// ─── (3) LAYOUT-04(b): the gesture tracker's host is unchanged, so the
// rect it measures is now chip-free (rect honesty) ───────────────────────

test("(3) the gesture tracker's host is still #mw-maze-viewport (rect honesty): initMazeViewportControls's region contains exactly one getElementById(\"mw-maze-viewport\") call and its pointerdown listener is attached to that same local", () => {
  const region = sliceBetween(HTML, "(function initMazeViewportControls() {", "\n})();");
  const getByIdCalls = (region.match(/getElementById\("mw-maze-viewport"\)/g) || []).length;
  assert.equal(getByIdCalls, 1, "expected exactly one getElementById(\"mw-maze-viewport\") call inside initMazeViewportControls");
  assert.match(region, /const vp = document\.getElementById\("mw-maze-viewport"\);/, "vp is assigned from that one call");
  assert.match(region, /vp\.addEventListener\("pointerdown"/, "the pointerdown listener is attached to vp, the same local");
});

// ─── (4)/(5) BEHAVIOUR: paint() routes bands 1/2 through the bridge ─────

function paintFresh(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return doc;
}

test("(4) BEHAVIOUR: paint() writes #m-steps and #mw-hud-name through __mzHudBands, matching counterSlots()/identityLine() at 999, 1000 and 100000 steps", () => {
  const states = fixedStates();
  for (const steps of [999, 1000, 100000]) {
    const state = structuredClone(states.thief);
    state.steps = steps;
    const doc = paintFresh(state);
    const expectedSlots = counterSlots(state);
    const stepsSlot = expectedSlots.find((s) => s.id === "m-steps");
    const el = doc.document.getElementById("m-steps");
    assert.equal(el.textContent, stepsSlot.text, `#m-steps must equal counterSlots()'s text at steps=${steps}`);

    const expectedIdentity = identityLine(state.c);
    const nameEl = doc.document.getElementById("mw-hud-name");
    assert.equal(nameEl.textContent, expectedIdentity, `#mw-hud-name must equal identityLine(c) at steps=${steps}`);
  }
});

// ─── (5) first-frame: no conditions, fresh state, complete bands 1/2, band 3 hidden ──

test("(5) BEHAVIOUR: a freshly-booted fixed state with no conditions paints without throwing — #mm-conditions is hidden, bands 1/2 are non-empty", () => {
  const states = fixedStates();
  const doc = paintFresh(states.thief);

  const condStrip = doc.document.getElementById("mm-conditions");
  assert.equal(condStrip.hidden, true, "#mm-conditions must be hidden with no active conditions");

  const nameEl = doc.document.getElementById("mw-hud-name");
  assert.ok(nameEl.textContent.length > 0, "band 1's identity line must be non-empty");

  for (const id of ["m-floor", "m-day", "m-steps", "m-rations"]) {
    const el = doc.document.getElementById(id);
    assert.ok(el.textContent.length > 0, `band 2's #${id} must be non-empty`);
  }
});
