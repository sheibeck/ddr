// test/unit/reduced-motion.test.js
//
// Phase 58's MOTION-05 ledger — one section per timed shell effect, each
// proving the effect reaches its end state SYNCHRONOUSLY, with nothing
// lost, whenever `prefers-reduced-motion: reduce` is in force — including
// a live flip of the OS preference mid-session. Plans 58-04..58-07 each
// append their own effect's section below the marker comment; 58-07's own
// audit checks every section named in MOTION-05's requirement text is
// present.
//
// Every test in this file drives test/unit/harness/shellSandbox.js's
// `loadShellSandbox({ doc, reducedMotion, clock })` — reduced-motion state
// lives entirely in that sandbox's own `matchMedia` stub (or a live
// reassignment of it, for the "flip mid-session" tests), never a
// hand-rolled predicate.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { newRun } from "../../engine/state.js";
import { keepInViewAxis } from "../../src/browser/controls.js";
import { REDUCED_MOTION_QUERY, createPanelMotion } from "../../src/browser/motion.js";
import { createCameraGlide } from "../../src/browser/cameraGlide.js";
import { createTypewriter } from "../../src/browser/typewriter.js";
import { createPartySprite } from "../../src/browser/partySprite.js";
import { railPush, emptyRail, RAIL_HOLD } from "../../src/browser/rail.js";
import { stripHtml, stripJs } from "../../tools/ident-sweep.mjs";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import { planBeat, createBeat, createBeatRunner } from "../../src/browser/combatBeat.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CELL = 28; // the classic script's declared default — fit() is never called in this harness
const RECT = Object.freeze({ width: 400, height: 600, top: 0, left: 0, right: 400, bottom: 600, x: 0, y: 0 });

function expectedTransformStr(camPoint, dpr = 1) {
  const tx = RECT.width / 2 - camPoint.x * CELL;
  const ty = RECT.height / 2 - camPoint.y * CELL;
  const X = Math.round(tx * dpr) / dpr;
  const Y = Math.round(ty * dpr) / dpr;
  return `translate3d(${X}px, ${Y}px, 0)`;
}

function buildScenario({ reducedMotion, clock = null, stubRail = true } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock, stubRail });
  sandbox.context.window.__mzControls = { keepInViewAxis };
  const vp = doc.document.getElementById("mw-maze-viewport");
  vp.getBoundingClientRect = () => ({ ...RECT });
  const cv = doc.document.getElementById("maze");

  const state = newRun(1);
  state.floor.px = 40;
  state.floor.py = 40;
  sandbox.setState(state);

  return { sandbox, state, cv, context: sandbox.context };
}

/** Anchors cam on the party, then moves the party 6 cells left of that
 * anchor — inside EDGE_TRIGGER_CELLS of the (now-stale) left edge, so the
 * next keepPartyInView() call is genuinely owed a nudge. */
function triggerLeftEdgeNudge(scn) {
  scn.context.centerMap();
  const before = scn.context.partyCentre();
  scn.state.floor.px -= 6;
  const partyX = scn.state.floor.px + 0.5;
  const target = { x: keepInViewAxis(before.x, partyX, RECT.width / CELL), y: before.y };
  assert.notEqual(target.x, before.x, "scenario setup must actually trigger a nudge");
  return { before, target };
}

// ═══════════════════════════════════════════════════════════════════════
// ─── pan (MOTION-01, Plan 58-03) ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("reduced-motion/pan: with the default (reduced) sandbox, keepPartyInView() lands cam on its target synchronously", () => {
  const scn = buildScenario({ reducedMotion: true });
  const { target } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false, "reduced motion must never leave a run in flight");
});

test("reduced-motion/pan: with the default (reduced) sandbox, glideCenterMap() lands cam on the party centre synchronously", () => {
  const scn = buildScenario({ reducedMotion: true });
  scn.context.positionCanvas(); // establish the {0,0} baseline transform
  const target = scn.context.partyCentre();

  scn.context.glideCenterMap();
  assert.equal(scn.cv.style.transform, expectedTransformStr(target, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);
});

test("reduced-motion/pan: prefersReducedMotion is read LIVE — flipping the OS preference to reduced mid-session lands the very next nudge synchronously", () => {
  const clock = createFakeClock();
  const scn = buildScenario({ reducedMotion: false, clock });
  const { before, target: target1 } = triggerLeftEdgeNudge(scn);

  scn.context.keepPartyInView();
  clock.advance(50);
  assert.equal(scn.context.window.__mzCameraGlide.active(), true, "the first nudge must still be easing (reducedMotion was false)");
  const midTransform = scn.cv.style.transform;
  assert.notEqual(midTransform, expectedTransformStr(before, 1));
  assert.notEqual(midTransform, expectedTransformStr(target1, 1));

  // Flip the stub's answer live — mirrors a real OS "Remove animations"
  // toggle firing mid-session. prefersReducedMotion(window) calls
  // window.matchMedia FRESH on every call (no caching, per motion.js's own
  // doc comment) — a plain reassignment of the sandbox's matchMedia is
  // therefore enough; no change-event/subscription plumbing is needed for
  // the classic camera path itself (only settleAllMotion's own module-
  // script subscription, covered by the source-anchor test below, needs
  // the change EVENT — the classic reads are call-time, always live).
  scn.context.window.matchMedia = (q) => ({
    matches: q === REDUCED_MOTION_QUERY,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  });

  // A second nudge is now owed (move the party further left, same as
  // map-pan.test.js's own retarget scenario).
  scn.state.floor.px -= 3;
  const partyX2 = scn.state.floor.px + 0.5;
  const target2 = { x: keepInViewAxis(target1.x, partyX2, RECT.width / CELL), y: target1.y };
  assert.notEqual(target2.x, target1.x, "scenario setup must actually trigger a second nudge");

  scn.context.keepPartyInView();
  // Landed SYNCHRONOUSLY — no clock.advance() call between the trigger and
  // this assertion.
  assert.equal(scn.cv.style.transform, expectedTransformStr(target2, 1));
  assert.equal(scn.context.window.__mzCameraGlide.active(), false);

  // And nothing further ever lands, proving the run really did finish
  // rather than merely being mid-flight at a coincidentally-matching point.
  clock.advance(500);
  assert.equal(scn.cv.style.transform, expectedTransformStr(target2, 1));
});

test("reduced-motion/pan: source anchors — the camera instance reads prefersReducedMotion(window), settleAllMotion() finishes it, and the mid-session subscription is wired exactly once", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const glideIdx = stripped.indexOf("window.__mzCameraGlide = createCameraGlide(");
  assert.ok(glideIdx !== -1, "window.__mzCameraGlide = createCameraGlide( not found");
  const glideCloseIdx = stripped.indexOf(");", glideIdx);
  const glideCallSlice = stripped.slice(glideIdx, glideCloseIdx);
  assert.match(glideCallSlice, /reduced:\s*\(\)\s*=>\s*prefersReducedMotion\(window\)/);

  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /window\.__mzCameraGlide\?\.finish\?\.\(\);/);

  const subscribeMatches = stripped.match(/onReducedMotionChange\(window,/g) || [];
  assert.equal(subscribeMatches.length, 1, "onReducedMotionChange(window, must be wired exactly once");
});

// ═══════════════════════════════════════════════════════════════════════
// ─── panels (MOTION-02, Plan 58-04) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("reduced-motion/panels: with the default (reduced) sandbox, closeMarksLegend()/closeCampSheet() set hidden synchronously and write no data-motion", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const legend = doc.document.getElementById("mw-legend-sheet");
  sandbox.context.openMarksLegend();
  sandbox.context.closeMarksLegend();
  assert.equal(legend.hidden, true, "reduced motion must resolve the close synchronously");
  assert.equal(legend.dataset.motion, undefined);

  const camp = doc.document.getElementById("mw-camp-sheet");
  sandbox.context.openCampSheet();
  sandbox.context.closeCampSheet();
  assert.equal(camp.hidden, true);
  assert.equal(camp.dataset.motion, undefined);
});

test("reduced-motion/panels: with the default (reduced) sandbox, renderEncounter's close sets #enc-panel hidden synchronously with no data-motion", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const panel = doc.document.getElementById("enc-panel");
  sandbox.context.window.__mzStair = {};
  sandbox.context.renderEncounter();
  assert.equal(panel.hidden, false);

  sandbox.context.window.__mzStair = null;
  sandbox.context.renderEncounter();
  assert.equal(panel.hidden, true, "reduced motion must resolve the close synchronously");
  assert.equal(panel.dataset.motion, undefined);
});

test("reduced-motion/panels: with the default (reduced) sandbox, showTab's outgoing screen hides synchronously and writes no inline transform", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  const maze = doc.document.getElementById("screen-maze");
  const hero = doc.document.getElementById("screen-hero");
  sandbox.context.window.__mzShowTab("hero");
  assert.equal(hero.hidden, false);
  assert.equal(maze.hidden, true, "reduced motion must hide the outgoing screen synchronously");
  assert.equal(maze.dataset.motion, undefined);
  assert.equal(maze.style.transform, "", "reduced motion must write no inline leaving transform");
});

test("reduced-motion/panels: source anchor — settleAllMotion()'s body drains the panel-close helper via panelMotion.finishAll()", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /panelMotion\.finishAll\(\);/);
});

// ═══════════════════════════════════════════════════════════════════════
// ─── typing (MOTION-04, Plan 58-05) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

test("reduced-motion/typing: with the default (reduced) sandbox, a new rail card's lines hold their plain full text in the same render, #mw-rail-lines never gets aria-hidden, and the hold timer is scheduled synchronously in that same render (the sandbox's timer count rises by one)", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubRail: false });
  sandbox.setState(newRun(1));

  // Count setTimeout calls at the sandbox's own scheduler — under reduced
  // motion, __mzTypewriter.type()'s onDone (startHold) runs SYNCHRONOUSLY
  // inside type() itself (never deferred to a raf loop), so the card's one
  // hold timer is the only setTimeout call this render makes.
  let timeoutCalls = 0;
  const realSetTimeout = sandbox.context.setTimeout;
  sandbox.context.setTimeout = (...args) => {
    timeoutCalls++;
    return realSetTimeout(...args);
  };

  const text = "The lock gives way with a click that sounds far too pleased with itself.";
  sandbox.context.window.__mzRail = railPush(emptyRail(), { icon: "✕", iconKey: null, title: "A TRAP", lines: [{ text, roll: null }], tone: "bad", hold: RAIL_HOLD.default });
  sandbox.context.renderRail();

  assert.equal(timeoutCalls, 1, "the hold's own setTimeout must be scheduled synchronously in this same render");

  const lineEl = doc.document.getElementById("mw-rail-lines").querySelectorAll(".mw-rail-line")[0];
  assert.equal(lineEl.textContent, text, "reduced motion must write the plain full text in the same render");
  assert.equal(lineEl.children.length, 0, "reduced motion must never build typed/rest span children");
  assert.equal(doc.document.getElementById("mw-rail-lines").getAttribute("aria-hidden"), null, "reduced motion must never touch aria-hidden on the typing host");
});

test("reduced-motion/typing: with the default (reduced) sandbox, the encounter overlay's line is plain full text with no aria-hidden, and #mw-major-desc still carries the same complete text", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  sandbox.setState(newRun(1));

  sandbox.context.window.__mzStair = { dir: "n" };
  sandbox.context.renderEncounter();

  const lineEl = doc.document.getElementById("enc-body").querySelectorAll(".mw-major-line")[0];
  assert.ok(lineEl, "the overlay's line element must exist");
  assert.equal(lineEl.getAttribute("aria-hidden"), null, "reduced motion must never touch aria-hidden on the overlay's line");
  const desc = doc.document.getElementById("mw-major-desc");
  assert.equal(desc.textContent, lineEl.textContent, "the description and the (already-full) line must carry the same complete text");
});

test("reduced-motion/typing: source anchor — settleAllMotion()'s body drains the typewriter via typewriter.completeAll()", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /typewriter\.completeAll\(\);/);
});

// ═══════════════════════════════════════════════════════════════════════
// ─── beat (MOTION-03, Plan 58-06) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

// fixed* helpers — copied verbatim from test/unit/combat-beat-shell.test.js's
// own (see that file's header comment for why applyAction, not hand-built
// events, is the plan's documented fallback source of a real resolved
// round).
function fixedFighterB(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Sword", prof: 2, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}
function fixedFloorB(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}
function fixedStateB(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighterB(cOverrides),
    floor: fixedFloorB(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}
function fixedFoeB(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

/** A real, resolved, mid-fight round (rngState 32 — the same scenario
 * combat-beat-shell.test.js's own midFightRound() uses): the hero kills
 * Goblin Grunt (line 0) and Cave Rat strikes back (line 1); Cave Rat stays
 * alive, so `after.combat` is still set — no ending. */
function midFightRoundB() {
  const before = fixedStateB({ rngState: 32 });
  before.combat = {
    foes: [fixedFoeB({ name: "Goblin Grunt", wp: 1, maxWP: 10 }), fixedFoeB({ name: "Cave Rat", wp: 40, maxWP: 40 })],
    type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const { state: after, events } = applyAction(before, { type: "attack" });
  return { before, after, events };
}

test("reduced-motion/beat: source anchor — engineCombatAction computes planBeat only when prefersReducedMotion(window) is false", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const start = stripped.indexOf("function engineCombatAction(type, extra) {");
  assert.ok(start !== -1, "function engineCombatAction(type, extra) { not found");
  const end = stripped.indexOf("window.mzAttack = ", start);
  const body = stripped.slice(start, end);
  const planIdx = body.indexOf("planBeat({");
  assert.equal((body.match(/planBeat\(\{/g) || []).length, 1, "planBeat({ must appear exactly once");
  const guardIdx = body.lastIndexOf("if (!prefersReducedMotion(window)) {", planIdx);
  assert.ok(guardIdx !== -1 && guardIdx < planIdx, "planBeat({ must sit inside the !prefersReducedMotion(window) branch");
});

test("reduced-motion/beat: with the default (reduced) sandbox, beatRunner.start(plan) renders every line at once with none typing and settles synchronously", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true });
  const { before, after, events } = midFightRoundB();

  const w = sandbox.context.window;
  const beforeLog = w.__mzFightLog;
  w.__mzState.set(after);
  const lines = fightLogLinesFor("attack", events, {});
  w.__mzFightLog = appendFightLog(beforeLog, lines, before.combat.round);
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog, afterLog: w.__mzFightLog, ctx: {} });

  const started = sandbox.beatRunner.start(plan);
  assert.ok(started, "beatRunner.start(plan) must return true for a real resolved round");

  // Landed SYNCHRONOUSLY — no clock.advance() call between start() and
  // this assertion (this sandbox has no clock at all: the default inert
  // never-firing setTimeout/rAF would strand a REAL timed beat forever, so
  // a synchronous landing here is itself proof the reduced path never
  // scheduled a timer).
  assert.equal(w.__mzBeat.active(), false, "reduced motion must resolve the whole beat synchronously, in the same call");
  const rows = Array.from(doc.document.getElementById("enc-body").querySelectorAll(".cb-log-entry"));
  assert.equal(rows.length, 3, "every line must land at once, not one at a time");
  for (const row of rows) {
    assert.equal(row.getAttribute("aria-hidden"), null, "reduced motion must never leave a row mid-typed");
    const textEl = row.querySelector(".cb-log-text");
    assert.equal(textEl.children.length, 0, "reduced motion must never build typed/rest span children");
  }
  // D-17: reduced motion collapses the BEAT itself to nothing — the
  // buttons still "arm on the normal delay" (58-CONTEXT.md), the very same
  // ARM_DELAY_MS window every settle render stamps.
  assert.equal(sandbox.context.encArmed(), false, "the arm window itself is unaffected by reduced motion — only the beat's reveal collapses");
});

test("reduced-motion/beat: source anchor — settleAllMotion()'s body contains beatRunner.hurry()", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);
  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);
  assert.match(settleBody, /beatRunner\.hurry\(\);/);
});

// ═══════════════════════════════════════════════════════════════════════
// ─── audit (MOTION-05, Plan 58-07) — the phase-wide ledger closing all
// four effects into ONE predicate, ONE settle point, a mid-session flip of
// all four together, a same-tick smoke test spanning every effect at once,
// and the modularity proof that paint()/draw() carry no Phase 58 code.
// ═══════════════════════════════════════════════════════════════════════

// ─── (1) one predicate ─────────────────────────────────────────────────

test("reduced-motion/audit: one predicate — \"prefers-reduced-motion\" appears in JS only as src/browser/motion.js's REDUCED_MOTION_QUERY; the blanket CSS rule occurs exactly once", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const BLANKET = "@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}";
  const blanketCount = stripped.split(BLANKET).length - 1;
  assert.equal(blanketCount, 1, "the blanket CSS rule must occur exactly once");
  const withoutBlanket = stripped.split(BLANKET).join("");
  assert.equal(
    withoutBlanket.includes("prefers-reduced-motion"),
    false,
    "\"prefers-reduced-motion\" must never appear anywhere else in mazeworld.html — never inside a <script> region"
  );

  const browserDir = path.join(REPO_ROOT, "src", "browser");
  const jsFiles = fs.readdirSync(browserDir).filter((f) => f.endsWith(".js"));
  assert.ok(jsFiles.includes("motion.js"), "sanity: motion.js must exist in src/browser/");
  for (const f of jsFiles) {
    const fileRaw = fs.readFileSync(path.join(browserDir, f), "utf8");
    const fileStripped = stripJs(fileRaw);
    if (f === "motion.js") {
      assert.match(
        fileStripped,
        /REDUCED_MOTION_QUERY = "\(prefers-reduced-motion: reduce\)";/,
        "motion.js must define REDUCED_MOTION_QUERY as this exact string"
      );
    } else {
      assert.equal(
        fileStripped.includes("prefers-reduced-motion"),
        false,
        `${f} must never mention "prefers-reduced-motion" directly — only motion.js's REDUCED_MOTION_QUERY may`
      );
    }
  }
});

// ─── (2) four controllers, one predicate ──────────────────────────────

test("reduced-motion/audit: four controllers, one predicate — every constructor call site builds with reduced: () => prefersReducedMotion(window); prefersReducedMotion is imported exactly once, from ./src/browser/motion.js", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  function extractCallArgs(source, marker) {
    const idx = source.indexOf(marker);
    if (idx === -1) return null;
    const parenStart = idx + marker.length - 1;
    let depth = 0;
    for (let i = parenStart; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") {
        depth--;
        if (depth === 0) return source.slice(parenStart, i + 1);
      }
    }
    return null;
  }

  // Phase 59 (ANIM-01/02): createPartySprite( joins the controller list —
  // the party marker's step-glide controller shares the SAME predicate as
  // every Phase 58 effect, never a second reduced-motion read.
  for (const marker of ["createCameraGlide(", "createTypewriter(", "createBeat(", "createPanelMotion(", "createPartySprite("]) {
    const args = extractCallArgs(stripped, marker);
    assert.ok(args, `${marker} call not found`);
    assert.match(
      args,
      /reduced:\s*\(\)\s*=>\s*prefersReducedMotion\(window\)/,
      `${marker} must construct with reduced: () => prefersReducedMotion(window)`
    );
  }

  const importMatches =
    stripped.match(/import \{ prefersReducedMotion, onReducedMotionChange, createPanelMotion \} from "\.\/src\/browser\/motion\.js";/g) || [];
  assert.equal(importMatches.length, 1, "prefersReducedMotion must be imported exactly once, from ./src/browser/motion.js");
});

// ─── (3) settle-all ────────────────────────────────────────────────────

test("reduced-motion/audit: settle-all — settleAllMotion() drains all five effects (camera glide finish, party-sprite finish, panelMotion.finishAll(), typewriter.completeAll(), beatRunner.hurry()); onReducedMotionChange(window, is wired exactly once and its callback calls settleAllMotion() only when the new value is true", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const settleIdx = stripped.indexOf("function settleAllMotion(");
  assert.ok(settleIdx !== -1, "function settleAllMotion( not found");
  const settleNextFn = stripped.indexOf("\nfunction ", settleIdx + 1);
  const settleBody = stripped.slice(settleIdx, settleNextFn === -1 ? stripped.length : settleNextFn);

  assert.match(settleBody, /window\.__mzCameraGlide\?\.finish\?\.\(\);/, "settleAllMotion must finish the camera glide");
  // Phase 59 (ANIM-02): settleAllMotion must also finish the party-marker
  // step glide.
  assert.match(settleBody, /window\.__mzPartySprite\?\.finish\?\.\(\);/, "settleAllMotion must finish the party-sprite step glide");
  assert.match(settleBody, /panelMotion\.finishAll\(\);/, "settleAllMotion must drain every pending panel close");
  assert.match(settleBody, /typewriter\.completeAll\(\);/, "settleAllMotion must complete every in-flight typing run");
  assert.match(settleBody, /beatRunner\.hurry\(\);/, "settleAllMotion must hurry a live beat");

  const subscribeMatches = stripped.match(/onReducedMotionChange\(window,/g) || [];
  assert.equal(subscribeMatches.length, 1, "onReducedMotionChange(window, must be wired exactly once");
  assert.match(
    stripped,
    /onReducedMotionChange\(window, \(reduced\) => \{ if \(reduced\) settleAllMotion\(\); \}\);/,
    "the subscription's callback must call settleAllMotion() only when the new value is true"
  );
});

// ─── (4) mid-session flip, all five together ──────────────────────────

test("reduced-motion/audit: mid-session flip — all five REAL controllers, sharing one switchable reduced flag on one fake clock, land together the instant the same five settle calls settleAllMotion's body makes are run", () => {
  const clock = createFakeClock();
  let reducedFlag = false;
  const reduced = () => reducedFlag;

  // 1. camera glide — a real ease-out tween, in flight (reduced=false).
  const glide = createCameraGlide({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced,
  });
  let camApplied = null;
  glide.to({ x: 0, y: 0 }, { x: 10, y: 20 }, (p) => { camApplied = p; });
  assert.equal(glide.active(), true, "scenario setup: the glide must still be in flight");

  // 2. panel close — a real timer-driven close, pending (reduced=false).
  const panelMotion = createPanelMotion({
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    reduced,
  });
  const el = { hidden: false, dataset: {} };
  let onHiddenCalls = 0;
  panelMotion.close(el, () => { onHiddenCalls++; });
  assert.equal(el.hidden, false, "scenario setup: the panel must still be open");

  // 3. typing — a real in-flight typewriter run (reduced=false).
  const typewriter = createTypewriter({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced,
    doc: { createElement: () => ({ textContent: "", appendChild() {} }) },
  });
  let onDoneCalls = 0;
  const target = { textContent: "", appendChild() {} };
  const text = "A longer line, typed at 12ms a character, so it is still in flight when we flip.";
  typewriter.type("audit", { targets: [target], texts: [text], onDone: () => { onDoneCalls++; } });
  assert.equal(onDoneCalls, 0, "scenario setup: typing must still be in flight");

  // 4. beat — a real multi-line round, one line landed (reduced=false).
  const { before, after, events } = midFightRoundB();
  const lines = fightLogLinesFor("attack", events, {});
  const afterLog = appendFightLog(null, lines, before.combat.round);
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog: null, afterLog, ctx: {} });
  const beat = createBeat({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, reduced });
  const renders = [];
  let settleCalls = 0;
  const runner = createBeatRunner({
    beat,
    durationFor: () => 0,
    onRender: (v) => renders.push(v),
    onSettle: () => { settleCalls++; },
    playClips: () => {},
  });
  runner.start(plan);
  assert.equal(renders.length, 1, "scenario setup: only line 0 has landed so far");
  assert.equal(settleCalls, 0);

  // 5. party sprite (Phase 59, ANIM-02) — a real step glide, in flight
  // (reduced=false).
  const partySprite = createPartySprite({
    now: clock.now,
    raf: clock.requestAnimationFrame,
    cancelRaf: clock.cancelAnimationFrame,
    reduced,
    render: () => {},
  });
  partySprite.stepTo({ x: 0, y: 0 }, { x: 1, y: 0 });
  assert.equal(partySprite.active(), true, "scenario setup: the party-sprite glide must still be in flight");

  // Flip the OS preference mid-session, then run the SAME five calls
  // settleAllMotion's own body makes.
  reducedFlag = true;
  glide.finish();
  partySprite.finish();
  panelMotion.finishAll();
  typewriter.completeAll();
  runner.hurry();

  assert.deepEqual(camApplied, { x: 10, y: 20 }, "the glide must have applied its exact target");
  assert.equal(glide.active(), false);

  assert.equal(partySprite.active(), false, "the party-sprite glide must be finished");
  assert.equal(partySprite.pose(), "idle", "the marker must settle to idle");
  assert.deepEqual(partySprite.displayed({ x: 1, y: 0 }), { x: 1, y: 0 }, "the marker must land exactly at its target");

  assert.equal(el.hidden, true, "the element must be hidden");
  assert.equal(onHiddenCalls, 1, "onHidden must fire exactly once");

  assert.equal(target.textContent, text, "the text must be full");
  assert.equal(onDoneCalls, 1, "onDone must fire exactly once");

  assert.equal(renders.length, 2, "the hurry must render exactly once more — the round's last line");
  assert.equal(settleCalls, 1, "the beat must settle exactly once");
  assert.equal(runner.active(), false);
  const lastRender = renders[renders.length - 1];
  assert.equal(lastRender.line, plan.count - 1, "the hurried render must be the round's last line");
  assert.equal(lastRender.hurried, true);

  // Advancing the clock afterwards changes nothing.
  clock.advance(100000);
  assert.deepEqual(camApplied, { x: 10, y: 20 });
  assert.equal(partySprite.active(), false);
  assert.equal(el.hidden, true);
  assert.equal(onHiddenCalls, 1);
  assert.equal(target.textContent, text);
  assert.equal(onDoneCalls, 1);
  assert.equal(renders.length, 2);
  assert.equal(settleCalls, 1);
});

// ─── (5) nothing lost under reduced (smoke) ───────────────────────────

test("reduced-motion/audit: nothing lost under reduced (smoke) — a pan nudge, a sheet close, a tab switch, a new rail card and a beat start all land in the same tick, in one default (reduced) sandbox", () => {
  const scn = buildScenario({ reducedMotion: true, stubRail: false });
  const w = scn.context.window;

  // 1. a pan nudge
  const { before: camBefore, target: camTarget } = triggerLeftEdgeNudge(scn);
  scn.context.keepPartyInView();
  assert.equal(scn.cv.style.transform, expectedTransformStr(camTarget, 1), "the pan nudge must land synchronously");
  assert.equal(w.__mzCameraGlide.active(), false);

  // 2. a sheet close
  const legend = scn.sandbox.doc.document.getElementById("mw-legend-sheet");
  scn.context.openMarksLegend();
  scn.context.closeMarksLegend();
  assert.equal(legend.hidden, true, "the sheet close must land synchronously");

  // 3. a tab switch
  const maze = scn.sandbox.doc.document.getElementById("screen-maze");
  const hero = scn.sandbox.doc.document.getElementById("screen-hero");
  w.__mzShowTab("hero");
  assert.equal(hero.hidden, false);
  assert.equal(maze.hidden, true, "the outgoing screen must hide synchronously");

  // 4. a new rail card
  const cardText = "The lock gives way with a click that sounds far too pleased with itself.";
  w.__mzRail = railPush(emptyRail(), {
    icon: "✕", iconKey: null, title: "A TRAP", lines: [{ text: cardText, roll: null }], tone: "bad", hold: RAIL_HOLD.default,
  });
  scn.context.renderRail();
  const lineEl = scn.sandbox.doc.document.getElementById("mw-rail-lines").querySelectorAll(".mw-rail-line")[0];
  assert.equal(lineEl.textContent, cardText, "the card's text must be full in the same render");
  assert.equal(lineEl.children.length, 0, "reduced motion must never build typed/rest span children");

  // 5. a beat start
  const beforeLog = w.__mzFightLog;
  const { before: cBefore, after: cAfter, events: cEvents } = midFightRoundB();
  w.__mzState.set(cAfter);
  const cLines = fightLogLinesFor("attack", cEvents, {});
  w.__mzFightLog = appendFightLog(beforeLog, cLines, cBefore.combat.round);
  const plan = planBeat({ actionType: "attack", events: cEvents, before: cBefore, after: cAfter, beforeLog, afterLog: w.__mzFightLog, ctx: {} });
  const started = scn.sandbox.beatRunner.start(plan);
  assert.ok(started, "beatRunner.start(plan) must return true for a real resolved round");
  assert.equal(w.__mzBeat.active(), false, "the whole beat must land synchronously");
  const rows = Array.from(scn.sandbox.doc.document.getElementById("enc-body").querySelectorAll(".cb-log-entry"));
  assert.equal(rows.length, plan.count, "every line must be visible at once");
  for (const row of rows) {
    assert.equal(row.getAttribute("aria-hidden"), null, "no row may be left mid-typed");
  }
});

// ─── (6) modularity — paint()/draw() carry no Phase 58 code ──────────

// PRE58 = the Phase 57 closing commit, the one just before Phase 58's
// first code landed — computed once (2026-09-22) via:
//   git rev-parse "$(git log --diff-filter=A --format=%H -- src/browser/motion.js | tail -1)^"
// -> ab3fca94a351b2f1515bd837bbd57bb27ae0b896 ("docs(phase-57): complete
// phase execution — 5/5 plans, verification passed, docs amended for the
// 2026-09-22 HUD mock"). BASE_58 (a01b38e) is NOT used here: it postdates
// 57-05's own HUD work, which legitimately changed paint()/draw(), so
// comparing against BASE_58 would hide a real Phase 58 regression inside
// noise BASE_58 already carries. PRE58_PAINT_SHA256 is the SHA-256 of
// PRE58's own comment-stripped, CRLF-normalised paint() body, computed by a
// one-off node script reading `git show ab3fca9:mazeworld.html` through
// tools/ident-sweep.mjs#stripHtml — pinned here as a literal so `npm test`
// stays independent of git history while still proving no Phase 58 (or
// later) statement grew it. paint() is untouched by Phase 59 — this digest
// stays byte-identical to PRE58's.
//
// DRAW_SHA256 (Phase 59, Plan 03 re-pin): draw() is NOT held to PRE58 any
// longer — Plan 03 deliberately removed the canvas's own party-marker
// paint (the drawImage/radial-glow/dot-fallback block; the party is now
// the DOM sprite #mw-party-sprite, positioned by positionPartySprite()).
// This is the SHA-256 of draw()'s own comment-stripped body AFTER that
// removal, computed the same one-off way; nothing was added to draw() by
// this plan, only removed (PRE_DRAW_LINES's line count dropped, per this
// plan's own discovery step).
const PRE58_PAINT_SHA256 = "b90c5e4f80290d1cd3bc4c7f53a2ad8441a3c356d9703d73c9a2ab2f1f9e6f2f";
const DRAW_SHA256 = "cfd8d6f145c3ba6277f8c2dbc4d3f66addf552efa068e3c1b58ccb7f4419c2a9";

test("reduced-motion/audit: modularity — paint() is byte-identical to PRE58's (ab3fca9); draw() is re-pinned for Phase 59 Plan 03 (the canvas party-marker paint removed, nothing added) — both pinned by SHA-256, unchanged by any OTHER plan", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
  const stripped = stripHtml(raw);

  function extractFunctionBody(source, signatureRe) {
    const m = signatureRe.exec(source);
    if (!m) return null;
    const braceStart = source.indexOf("{", m.index);
    if (braceStart === -1) return null;
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    return null;
  }

  const paintBody = extractFunctionBody(stripped, /function paint\(\)\s*\{/);
  const drawBody = extractFunctionBody(stripped, /function draw\(\)\s*\{/);
  assert.ok(paintBody, "function paint() { not found");
  assert.ok(drawBody, "function draw() { not found");

  const paintHash = crypto.createHash("sha256").update(paintBody, "utf8").digest("hex");
  const drawHash = crypto.createHash("sha256").update(drawBody, "utf8").digest("hex");

  assert.equal(paintHash, PRE58_PAINT_SHA256, "paint()'s comment-stripped body must be byte-identical to PRE58's — no Phase 58/59 plan may grow it");
  assert.equal(drawHash, DRAW_SHA256, "draw()'s comment-stripped body must match Phase 59 Plan 03's re-pin exactly — the canvas party paint removed, nothing added");
});
