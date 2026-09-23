// test/unit/party-sprite-shell.test.js
//
// Phase 59 (ANIM-01/03), Plan 03 — the shell-wiring proof for the party
// marker's DOM sprite and its dialled-back ring: mazeworld.html has no
// module surface a test could import directly (it is not an ESM module the
// test runner can load), so — mirroring shell-map-hud.test.js/shell-map-
// viewport.test.js's own source-assertion pattern — this file reads the
// real shipped source with fs.readFileSync and asserts against it directly,
// plus behaviour proofs driven through test/unit/harness/shellSandbox.js's
// (now extended) `stubDraw`/`canvasContext` options and a REAL
// window.__mzPartySprite. One named test per must_haves claim:
//
//   1. Markup — the sprite follows the ring, is aria-hidden, starts
//      data-art="static"/data-pose="idle", holds the 8 shipped frames in
//      PARTY_FRAME_ICONS order.
//   2. CSS/JS no-drift — the idle rule's duration and the k=2..4 delays
//      equal partySprite.js's own IDLE_CYCLE_MS/idleFrameDelaysMs(), in
//      seconds, parsed straight from the stylesheet.
//   3. Composited only — @keyframes mwpartyidle declares only opacity; no
//      sprite/frame rule declares a transition.
//   4. Reduced-motion freeze (D-05) — the blanket rule is byte-identical,
//      present once; only idle frame 1 has a base opacity:1.
//   5. Step states — each step frame k is made opaque under
//      data-pose="step"/data-frame="k"; idle frames hide in the step pose.
//   6. Fallback art — data-art="static"/"none" show party.png/the gold dot
//      and hide the frame images.
//   7. Covered — the .mw-party-pulse.covered sibling rule hides/pauses the
//      sprite; the sprite's markup source index is after the ring's.
//   8. Pointer and z safety — pointer-events:none, z-index:3 (ring z2,
//      rail z4).
//   9. The ring (ANIM-03) — no spread-only dark ring, a .25 halo, a .28
//      radial background; mwglow/will-change unchanged.
//   10. draw() paints no party (behaviour) — with the REAL draw() (via
//       shellSandbox's new stubDraw:false/canvasContext options) and a real
//       newRun state, no drawImage of the party icon, no arc, no fillText,
//       no createRadialGradient; every seen/visible feature still draws at
//       Math.round(CELL*0.75).
//   11. Lockstep at rest (D-01) — after positionCanvas(), the sprite's
//       translate3d equals the canvas's plus px*CELL/py*CELL, at dpr 1 and
//       2.625 (the Pixel 7's); the ring's left/top equal the pre-Phase-59
//       formula unchanged.
//   12. Module anchors — the bridge is built on the shared predicate and
//       the mzPositionParty render; settleAllMotion finishes it; the art
//       detection follows the preload line; positionPartyPulse reads
//       partyShown(), never cameraPan().

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createRecordingContext } from "./harness/recordingCanvas.js";
import { newRun } from "../../engine/state.js";
import { PARTY_FRAME_ICONS, IDLE_CYCLE_MS, idleFrameDelaysMs } from "../../src/browser/partySprite.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const RECT = Object.freeze({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600, x: 0, y: 0 });

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// cssSeconds(ms) — the exact CSS-source spelling this codebase uses for a
// millisecond duration (no leading zero — ".84s"/"1.12s", never "0.84s"),
// signed (mirrors panel-motion.test.js's own cssSeconds(ms), extended for
// idleFrameDelaysMs()'s negative delays).
function cssSeconds(ms) {
  const sign = ms < 0 ? "-" : "";
  let s = (Math.abs(ms) / 1000).toString();
  if (s.startsWith("0.")) s = s.slice(1);
  return `${sign}${s}s`;
}

function viewportRegion() {
  const start = HTML.indexOf('<div class="mw-maze-viewport" id="mw-maze-viewport">');
  const end = HTML.indexOf("<!-- DR5: the encounter/feature-event panel");
  assert.ok(start !== -1 && end !== -1 && end > start, "viewport region markers found");
  return HTML.slice(start, end);
}

function ruleDecls(selectorSource) {
  const m = HTML.match(new RegExp(`^${selectorSource}\\{([^}]*)\\}$`, "m"));
  assert.ok(m, `expected a rule for /^${selectorSource}\\{/m`);
  return m[1];
}

// ─── (1) markup ─────────────────────────────────────────────────────────

test('(1) markup: the sprite follows the ring inside the viewport, is aria-hidden, starts data-art="static"/data-pose="idle", and holds the 8 frames in PARTY_FRAME_ICONS order', () => {
  const region = viewportRegion();
  assert.equal((region.match(/id="mw-party-sprite"/g) || []).length, 1);
  assert.ok(region.indexOf('id="mw-party-sprite"') > region.indexOf('id="mw-party-pulse"'), "the sprite must follow the ring");
  assert.match(region, /<div class="mw-party-sprite" id="mw-party-sprite" aria-hidden="true" data-art="static" data-pose="idle">/);

  const imgs = [...region.matchAll(/<img class="mw-party-frame"([^>]*)>/g)].map((m) => m[1]);
  assert.equal(imgs.length, PARTY_FRAME_ICONS.length);
  imgs.forEach((attrs, i) => {
    const stem = PARTY_FRAME_ICONS[i];
    assert.match(attrs, new RegExp(`src="icons/optimized/${stem}\\.png"`), `frame ${i} src`);
    assert.match(attrs, /alt=""/, `frame ${i} alt`);
    assert.match(attrs, /draggable="false"/, `frame ${i} draggable`);
  });
});

// ─── (2) CSS/JS no-drift ────────────────────────────────────────────────

test("(2) CSS/JS no-drift: the idle rule's cycle duration and the k=2..4 delays equal partySprite.js's own IDLE_CYCLE_MS/idleFrameDelaysMs(), in seconds", () => {
  const cycleS = cssSeconds(IDLE_CYCLE_MS);
  assert.match(
    HTML,
    new RegExp(`^\\.mw-party-frame\\[data-set="idle"\\]\\{animation:mwpartyidle ${escapeRe(cycleS)} step-end infinite\\}$`, "m"),
  );
  const delays = idleFrameDelaysMs();
  for (let k = 2; k <= 4; k++) {
    const delayS = cssSeconds(delays[k - 1]);
    assert.match(
      HTML,
      new RegExp(`^\\.mw-party-frame\\[data-set="idle"\\]\\[data-k="${k}"\\]\\{animation-delay:${escapeRe(delayS)}\\}$`, "m"),
      `k=${k} delay`,
    );
  }
});

// ─── (3) composited only ────────────────────────────────────────────────

test("(3) composited only: @keyframes mwpartyidle occurs exactly once and declares only opacity; no .mw-party-sprite/.mw-party-frame rule declares a transition", () => {
  const kfLines = HTML.split("\n").filter((l) => l.trim().startsWith("@keyframes mwpartyidle"));
  assert.equal(kfLines.length, 1);
  assert.doesNotMatch(kfLines[0], /transform/);
  assert.doesNotMatch(kfLines[0], /background/);
  assert.match(kfLines[0], /opacity/);

  const spriteRuleLines = HTML.split("\n").filter((l) => /^\.mw-party-(sprite|frame)\b/.test(l.trim()));
  assert.ok(spriteRuleLines.length > 0, "expected at least one .mw-party-sprite/.mw-party-frame rule");
  for (const line of spriteRuleLines) {
    assert.doesNotMatch(line, /transition/, `unexpected transition in: ${line}`);
  }
});

// ─── (4) reduced-motion freeze (D-05) ───────────────────────────────────

test("(4) reduced-motion freeze (D-05): the blanket rule is byte-identical and present exactly once; exactly one idle frame (k=1) has a base opacity:1", () => {
  const blanket = "@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}";
  assert.equal((HTML.match(new RegExp(escapeRe(blanket), "g")) || []).length, 1);

  const idleFrameRules = [...HTML.matchAll(/^\.mw-party-frame\[data-set="idle"\]\[data-k="(\d)"\]\{([^}]*)\}$/gm)];
  assert.equal(idleFrameRules.length, 4);
  const opaque = idleFrameRules.filter((m) => m[2].includes("opacity:1"));
  assert.equal(opaque.length, 1, "exactly one idle frame rule may declare a base opacity:1");
  assert.equal(opaque[0][1], "1", "the base-opaque idle frame must be k=1");
});

// ─── (5) step states ────────────────────────────────────────────────────

test('(5) step states: for k=1..4 exactly one rule makes step frame k opaque under data-pose="step"[data-frame="k"]; idle frames hide in the step pose', () => {
  for (let k = 1; k <= 4; k++) {
    const re = new RegExp(
      `^\\.mw-party-sprite\\[data-pose="step"\\]\\[data-frame="${k}"\\] \\.mw-party-frame\\[data-set="step"\\]\\[data-k="${k}"\\]\\{opacity:1\\}$`,
      "m",
    );
    assert.match(HTML, re, `k=${k} step-opaque rule`);
  }
  assert.match(HTML, /^\.mw-party-sprite\[data-pose="step"\] \.mw-party-frame\[data-set="idle"\]\{visibility:hidden\}$/m);
});

// ─── (6) fallback art ───────────────────────────────────────────────────

test('(6) fallback art: data-art="static" shows party.png and hides the frames; data-art="none" shows the gold dot and hides the frames', () => {
  assert.match(HTML, /^\.mw-party-sprite\[data-art="static"\]\{background:url\(icons\/optimized\/party\.png\) center\/contain no-repeat\}$/m);
  assert.match(HTML, /^\.mw-party-sprite\[data-art="none"\]\{background:radial-gradient\(closest-side,#f4dc94 72%,rgba\(244,220,148,0\) 74%\)\}$/m);
  assert.match(
    HTML,
    /^\.mw-party-sprite\[data-art="static"\] \.mw-party-frame,\.mw-party-sprite\[data-art="none"\] \.mw-party-frame\{display:none\}$/m,
  );
});

// ─── (7) covered ────────────────────────────────────────────────────────

test("(7) covered: the .mw-party-pulse.covered sibling rule hides the sprite and pauses its frames; the sprite's markup source index is after the ring's", () => {
  assert.match(HTML, /^\.mw-party-pulse\.covered ~ \.mw-party-sprite\{visibility:hidden\}$/m);
  assert.match(HTML, /^\.mw-party-pulse\.covered ~ \.mw-party-sprite \.mw-party-frame\{animation-play-state:paused\}$/m);
  assert.ok(HTML.indexOf('id="mw-party-sprite"') > HTML.indexOf('id="mw-party-pulse"'));
});

// ─── (8) pointer and z safety ───────────────────────────────────────────

test("(8) pointer and z safety: .mw-party-sprite declares pointer-events:none and z-index:3; the ring stays z2, the rail stays z4", () => {
  const spriteDecls = ruleDecls("\\.mw-party-sprite");
  assert.match(spriteDecls, /pointer-events:none/);
  assert.match(spriteDecls, /z-index:3/);
  const ringDecls = ruleDecls("\\.mw-party-pulse");
  assert.match(ringDecls, /z-index:2/);
  const railDecls = ruleDecls("\\.mw-rail");
  assert.match(railDecls, /z-index:4/);
});

// ─── (9) the ring (ANIM-03) ─────────────────────────────────────────────

test("(9) the ring (ANIM-03): no spread-only dark ring, a .25 halo, a .28 radial background; mwglow and will-change unchanged", () => {
  const ringDecls = ruleDecls("\\.mw-party-pulse");
  assert.doesNotMatch(ringDecls, /0 0 0 3px/);
  assert.match(ringDecls, /box-shadow:0 0 14px 3px rgba\(232,201,122,\.25\)/);
  assert.match(ringDecls, /background:radial-gradient\(closest-side,rgba\(232,201,122,\.28\) 15%,rgba\(232,201,122,0\) 100%\)/);
  assert.match(ringDecls, /will-change:transform,opacity/);
  assert.match(ringDecls, /animation:mwglow 1\.6s ease-in-out infinite/);
  assert.equal(
    (HTML.match(/@keyframes mwglow\{0%,100%\{opacity:\.55;transform:scale\(1\)\}50%\{opacity:1;transform:scale\(1\.18\)\}\}/g) || []).length,
    1,
  );
});

// ─── (10) draw() paints no party (behaviour) ───────────────────────────

test("(10) draw() paints no party: with the REAL draw() and a real newRun state, no drawImage of the party icon, no arc, no fillText, no createRadialGradient; every seen/visible feature still draws at Math.round(CELL*0.75)", () => {
  const doc = createRecordingDocument();
  const ctx = createRecordingContext();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubDraw: false, canvasContext: ctx });
  // Force-visible: draw()'s `visible()` predicate fails open ("show
  // everything") when window.__mzMapView is missing — sidesteps the real
  // engine's dark/light render-window math, irrelevant to this test.
  sandbox.context.window.__mzMapView = null;

  const state = newRun(1);
  const { g, px, py } = state.floor;
  let fx = -1, fy = -1;
  outer: for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y].length; x++) {
      if (g[y][x].wall || (x === px && y === py)) continue;
      fx = x; fy = y;
      break outer;
    }
  }
  assert.ok(fx !== -1, "expected at least one non-wall, non-party cell");
  g[fy][fx] = { ...g[fy][fx], feat: "chest", seen: true };
  g[py][px] = { ...g[py][px], seen: true };

  sandbox.setState(state);
  sandbox.context.draw();

  assert.equal(ctx.calls.filter((c) => c.op === "arc").length, 0, "draw() must never arc (the old dot fallback/glow)");
  assert.equal(ctx.calls.filter((c) => c.op === "fillText").length, 0, "draw() must never fillText (the old \"P\" fallback)");
  assert.equal(ctx.calls.filter((c) => c.op === "createRadialGradient").length, 0, "draw() must never createRadialGradient (the old canvas glow)");

  const draws = ctx.imageDraws();
  const iconSize = Math.round(CELL * 0.75);
  const partyImg = sandbox.context.window.__mzIconMap.party;
  for (const d of draws) {
    assert.notEqual(d.img, partyImg, "draw() must never drawImage the party icon");
    assert.equal(d.w, iconSize, "every feature draw must be at Math.round(CELL*0.75)");
    assert.equal(d.h, iconSize);
  }
  const expectedIx = fx * CELL + (CELL - iconSize) / 2;
  const expectedIy = fy * CELL + (CELL - iconSize) / 2;
  assert.ok(
    draws.some((d) => Math.abs(d.x - expectedIx) < 1e-9 && Math.abs(d.y - expectedIy) < 1e-9),
    "the seeded, visible chest feature must still be drawn",
  );
});

// ─── (11) lockstep at rest (D-01) ───────────────────────────────────────

function lockstepScenario(dpr) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.context.window.devicePixelRatio = dpr;
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ ...RECT });

  const state = newRun(1);
  state.floor.px = 12;
  state.floor.py = 7;
  sandbox.setState(state);
  sandbox.context.anchorCamOnParty({ x: 13.7, y: -5.3 }); // a fractional, non-cell-aligned anchor
  sandbox.context.positionCanvas();

  return { sandbox, state, doc };
}

function transformXY(str) {
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\)/.exec(str || "");
  assert.ok(m, `expected a translate3d(...) transform, got: ${JSON.stringify(str)}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

test("(11) lockstep at rest (D-01): the sprite's translate3d equals the canvas's plus px*CELL/py*CELL, at dpr 1 and 2.625 (the Pixel 7's); the ring's left/top are unchanged from pre-Phase-59", () => {
  for (const dpr of [1, 2.625]) {
    const { sandbox, state, doc } = lockstepScenario(dpr);
    const cv = doc.document.getElementById("maze");
    const sprite = doc.document.getElementById("mw-party-sprite");
    const ring = doc.document.getElementById("mw-party-pulse");

    const canvasXY = transformXY(cv.style.transform);
    const spriteXY = transformXY(sprite.style.transform);
    assert.ok(Math.abs(spriteXY.x - (canvasXY.x + state.floor.px * CELL)) < 1e-9, `dpr ${dpr}: sprite x lockstep`);
    assert.ok(Math.abs(spriteXY.y - (canvasXY.y + state.floor.py * CELL)) < 1e-9, `dpr ${dpr}: sprite y lockstep`);
    assert.equal(sprite.style.width, `${CELL}px`);
    assert.equal(sprite.style.height, `${CELL}px`);
    assert.equal(sprite.dataset.pose, "idle");

    const p = sandbox.context.cameraPan();
    assert.equal(ring.style.left, `${RECT.width / 2 + p.x - CELL / 2}px`);
    assert.equal(ring.style.top, `${RECT.height / 2 + p.y - CELL / 2}px`);
  }
});

// ─── (12) module anchors ────────────────────────────────────────────────

test("(12) module anchors: the bridge is built with the shared predicate and the mzPositionParty render; settleAllMotion finishes it; the art detection follows the preload line; positionPartyPulse reads partyShown(), never cameraPan()", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const idx = stripped.indexOf("window.__mzPartySprite = createPartySprite(");
  assert.ok(idx !== -1, "window.__mzPartySprite = createPartySprite( not found");
  const closeIdx = stripped.indexOf(");", idx);
  const args = stripped.slice(idx, closeIdx);
  assert.match(args, /reduced:\s*\(\)\s*=>\s*prefersReducedMotion\(window\)/);
  assert.match(args, /render:\s*\(\)\s*=>\s*window\.mzPositionParty\?\.\(\)/);

  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /window\.__mzPartySprite\?\.finish\?\.\(\);/);

  const preloadIdx = stripped.indexOf('window.__mzIconMap = await preloadIcons("./icons/optimized");');
  const artIdx = stripped.indexOf("dataset.art = spriteArt(");
  assert.ok(preloadIdx !== -1 && artIdx !== -1 && preloadIdx < artIdx, "the art detection must follow the preload line");

  const ppIdx = stripped.indexOf("function positionPartyPulse(rect)");
  assert.ok(ppIdx !== -1, "function positionPartyPulse(rect) not found");
  const ppEnd = stripped.indexOf("\nfunction ", ppIdx + 1);
  const ppBody = stripped.slice(ppIdx, ppEnd === -1 ? stripped.length : ppEnd);
  assert.match(ppBody, /partyShown\(\)/);
  assert.doesNotMatch(ppBody, /cameraPan\(\)/);
});
