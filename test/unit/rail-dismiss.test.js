// test/unit/rail-dismiss.test.js
//
// Phase 57 (LAYOUT-02/03), Plan 03 — the guarded tap-to-dismiss classifier
// and the doubled, line-scaled, bounded rail hold. Two sections:
//
// Section A — the pure classifier/bounds, imported directly from
// src/browser/rail.js: railDismissKind's totality, holdForCard's floor/
// per-line scaling/cap, restated here as the LAYOUT-02/03 acceptance
// (test/unit/rail.test.js already carries the same functions as plain
// module coverage — this file's angle is "does this actually satisfy the
// requirement", not "is the module internally consistent").
//
// Section B — the shell's own guarded #mw-rail body-tap handler, exercised
// through a REAL (never-stubbed) renderRail(). test/unit/harness/
// shellSandbox.js#loadShellSandbox stubs draw()/renderRail() to no-ops
// immediately AFTER the classic script runs (its own doc comment explains
// why: the Gear/Hero/Store snapshot surfaces it serves never need either).
// S/zoom/lastRailKeyShown/railTimer/railShownAt are plain top-level `let`
// bindings in the classic script's own lexical scope — NOT properties of
// the vm context's global object (confirmed empirically: a second
// vm.runInContext call in the same context throws "already declared" on
// any repeated top-level `let`) — so once loadShellSandbox's stub
// overwrites the one reference to the real renderRail(), there is no way
// to "capture it before the stub or reassign it back" without re-running
// the classic script text. This file therefore does not call
// loadShellSandbox() at all for Section B: loadRailDismissSandbox() below
// is a deliberate sibling loader, not a caller, that runs the SAME classic
// script exactly once, wires the SAME bridge set shellSandbox.js's
// wireBridges does (kept in sync by hand — shellSandbox.js's own header
// comment points back here), and additionally wires window.__mzRailVM
// (deliberately absent from wireBridges, since its own callers never reach
// for it) — but never stubs draw()/renderRail(), so the REAL renderRail()
// (and the real railShownAt/lastRailKeyShown/railTimer it closes over) is
// what every Section B test exercises.

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ROMAN } from "../../content/index.js";
import { nightlyEats } from "../../engine/movement.js";
import { PARTY_CAP, newRun } from "../../engine/state.js";
import { conditionsOf, itemEffectActive, inStone, mapViewRadius, inViewWindow, hasTool, takesBagSlot } from "../../engine/derived.js";
import { toolIndex } from "../../engine/items.js";
import { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled } from "../../src/browser/inputGuards.js";
import { armorDisplay, bagArmorText, lootCompare, usableBy, dropShelfItems } from "../../src/browser/viewModels.js";
import { bagUsage, renderGearTab, renderCarriedList } from "../../src/browser/gearTab.js";
import { rationsViewModel, eatsLineFor, renderHeroTab } from "../../src/browser/heroTab.js";
import { renderStoreScreen } from "../../src/browser/storeScreen.js";
import { identityLine, counterSlots } from "../../src/browser/hudBands.js";
import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "../../src/browser/motion.js";
import { createTypewriter, typeDurationMs } from "../../src/browser/typewriter.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import {
  railCardFor,
  railPush,
  railClear,
  railLineCard,
  railAnnouncement,
  RAIL_COPY,
  RAIL_HOLD,
  emptyRail,
  holdForCard,
  railDismissKind,
  RAIL_DISMISS_KINDS,
  HOLD_MIN,
  HOLD_MAX,
  HOLD_PER_LINE,
} from "../../src/browser/rail.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");

// ─── Section A: the pure classifier and the bounds ─────────────────────────

test("Section A: railDismissKind totality — every (locked, buttonCount) pair classifies to exactly one of the two named kinds; a locked rail or any live action row is 'locked'", () => {
  assert.equal(RAIL_DISMISS_KINDS.length, 2, "a third dismiss state must never be introduced");
  for (const locked of [true, false, undefined, null]) {
    for (const buttonCount of [0, 1, 2, undefined, NaN, -1]) {
      const kind = railDismissKind(locked, buttonCount);
      assert.ok(RAIL_DISMISS_KINDS.includes(kind));
      const expectLocked = !!locked || (Number.isFinite(Number(buttonCount)) && Number(buttonCount) > 0);
      assert.equal(kind, expectLocked ? "locked" : "dismissible", `railDismissKind(${locked}, ${buttonCount})`);
    }
  }
});

test("Section A: holdForCard — a one-line card can never hold shorter than the pre-Phase-57 floor (HOLD_MIN is exactly the doubled dullShort, 4400ms >= 2 * the old 2200ms minimum) — tap-to-dismiss is an addition to today's read time, never a shortening of it", () => {
  assert.ok(HOLD_MIN >= 2200 * 2, "HOLD_MIN must never sit below the doubled pre-phase floor");
  assert.equal(holdForCard({ hold: 1, lines: [{ text: "x", roll: null }] }), HOLD_MIN);
  assert.equal(holdForCard(null), HOLD_MIN);
  for (const key of Object.keys(RAIL_HOLD)) {
    const oneLine = holdForCard({ hold: RAIL_HOLD[key], lines: [{ text: "x", roll: null }] });
    assert.ok(oneLine >= HOLD_MIN, `RAIL_HOLD.${key} one-line hold ${oneLine} must be >= HOLD_MIN`);
  }
});

test("Section A: holdForCard — each additional line adds exactly HOLD_PER_LINE until the cap is reached", () => {
  let prev = holdForCard({ hold: RAIL_HOLD.default, lines: [{ text: "1", roll: null }] });
  for (let n = 2; n <= 12; n++) {
    const lines = Array.from({ length: n }, (_, i) => ({ text: String(i), roll: null }));
    const cur = holdForCard({ hold: RAIL_HOLD.default, lines });
    if (cur >= HOLD_MAX) {
      assert.equal(cur, HOLD_MAX);
      break;
    }
    assert.equal(cur, prev + HOLD_PER_LINE, `line ${n} must add exactly HOLD_PER_LINE over line ${n - 1}`);
    prev = cur;
  }
});

test("Section A: holdForCard — the cap is reached and never exceeded, however many lines a card carries", () => {
  for (const n of [13, 20, 40, 500]) {
    const lines = new Array(n);
    const hold = holdForCard({ hold: RAIL_HOLD.default, lines });
    assert.ok(hold <= HOLD_MAX, `holdForCard with ${n} lines (${hold}) must never exceed HOLD_MAX`);
  }
  assert.equal(holdForCard({ hold: RAIL_HOLD.default, lines: new Array(500) }), HOLD_MAX, "a pathologically long card is pinned exactly at the cap, not merely under it");
});

// ─── Section B: the shell handler's four branches ──────────────────────────

const CLASSIC_OPEN = "\n<script>\n";
const SCRIPT_CLOSE = "\n</script>\n";
function extractClassicScript(raw) {
  const start = raw.indexOf(CLASSIC_OPEN);
  assert.ok(start !== -1, "rail-dismiss sandbox: classic <script> not found");
  const end = raw.indexOf(SCRIPT_CLOSE, start + 1);
  assert.ok(end !== -1, "rail-dismiss sandbox: classic </script> not found");
  return raw.slice(start + CLASSIC_OPEN.length, end);
}

/**
 * loadRailDismissSandbox({ doc }) — a deliberate sibling of
 * test/unit/harness/shellSandbox.js#loadShellSandbox (see this file's own
 * header comment for why it is a sibling, not a caller): wires the SAME
 * bridge set wireBridges does, PLUS window.__mzRailVM (holdForCard/
 * dismissKind included — the two Phase 57-03 entries), and never stubs
 * draw()/renderRail(), so the classic script's own renderRail() runs for
 * real against this sandbox's recording document.
 */
function loadRailDismissSandbox({ doc }) {
  const raw = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");
  const classic = extractClassicScript(raw);

  const fakeStorage = new Map();
  const sandbox = {
    document: doc.document,
    console,
    Math,
    setTimeout: (() => {
      let id = 1;
      return () => id++;
    })(),
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    // Phase 58 (MOTION-05): reduced-by-default, the same behaviour as
    // test/unit/harness/shellSandbox.js#loadShellSandbox's own matchMedia
    // stub (see that function's doc comment for why).
    matchMedia: (q) => ({ matches: q === REDUCED_MOTION_QUERY, media: q, addEventListener() {}, removeEventListener() {} }),
    localStorage: {
      getItem: (k) => (fakeStorage.has(k) ? fakeStorage.get(k) : null),
      setItem: (k, v) => fakeStorage.set(k, String(v)),
      removeItem: (k) => fakeStorage.delete(k),
    },
    navigator: { userAgent: "node", vibrate() {} },
    performance: { now: () => 0 },
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 1,
    location: { search: "" },
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(classic, context, { filename: "mazeworld.html#classic (rail-dismiss sandbox)" });

  const w = context.window;
  w.__mzTables = Object.freeze({ ROMAN });
  w.__mzNightlyEats = nightlyEats;
  w.__mzPartyCap = PARTY_CAP;
  w.__mzConditionsOf = conditionsOf;
  w.__mzEther = { itemEffectActive, inStone };
  w.__mzMapView = { mapViewRadius, inViewWindow };
  w.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };
  w.__mzArmorDisplay = { armorDisplay, bagArmorText };
  w.__mzBagUsage = bagUsage;
  w.__mzTakesBagSlot = takesBagSlot;
  w.__mzLootCompare = lootCompare;
  w.__mzHasTool = hasTool;
  w.__mzToolIndex = toolIndex;
  w.__mzUsableBy = usableBy;
  w.__mzRations = { view: rationsViewModel, eatsLine: eatsLineFor };
  w.__mzDropShelfItems = dropShelfItems;
  w.__mzTabs = Object.freeze({ gear: renderGearTab, hero: renderHeroTab, store: renderStoreScreen });
  w.__mzCarriedList = renderCarriedList;
  w.__mzHudBands = { identityLine, counterSlots };
  // Deliberately absent from shellSandbox.js's wireBridges (renderRail is
  // stubbed there) — the real bridge every renderRail() call reads, and the
  // one this plan extends with holdForCard/dismissKind.
  w.__mzRailVM = {
    card: railCardFor,
    push: railPush,
    clear: railClear,
    lineCard: railLineCard,
    announcement: railAnnouncement,
    copy: RAIL_COPY,
    holdForCard,
    dismissKind: railDismissKind,
  };
  w.__mzRail = emptyRail();
  // Phase 58 (MOTION-04) — the REAL typewriter, reduced by default (this
  // sandbox's matchMedia stub above always answers reduced), so the
  // dismiss handler's new typing-complete branch runs against a real,
  // synchronous typewriter (type() resolves the full text in the same
  // call under reduced motion — never a run left mid-flight to interfere
  // with Section B's own dismiss-branch assertions).
  const typewriter = createTypewriter({
    now: () => w.performance.now(),
    raf: (fn) => w.requestAnimationFrame(fn),
    cancelRaf: (id) => w.cancelAnimationFrame(id),
    reduced: () => prefersReducedMotion(w),
    doc: w.document,
  });
  w.__mzTypewriter = {
    type: typewriter.type,
    adopt: typewriter.adopt,
    complete: typewriter.complete,
    cancel: typewriter.cancel,
    active: typewriter.active,
    durationFor: (text) => typeDurationMs(String(text ?? "").length),
  };

  return {
    context,
    setState: (s) => context.window.__mzState.set(s),
    renderRail: () => context.renderRail(),
    railEl: () => doc.document.getElementById("mw-rail"),
    actionsEl: () => doc.document.getElementById("mw-rail-actions"),
    doc,
  };
}

// A synthetic tap event whose target either resolves (button case) or does
// not resolve (body case) via its own `closest` — recordingDom.js's real
// elements stub `closest` to always return null (see its own header
// comment), so a genuine button click can only be simulated this way.
function bodyTapEvent() {
  return { target: { closest: () => null } };
}
function buttonTapEvent() {
  return { target: { closest: (sel) => (sel === ".mw-rail-btn" ? { tagName: "button" } : null) } };
}

function sleepPastArmWindow() {
  return new Promise((resolve) => setTimeout(resolve, ARM_DELAY_MS + 60));
}

test("Section B (1): a tap on a rail action button routes to the button — the handler returns before classifying, the view-model is unchanged and railPulse never runs", async () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  sandbox.setState(newRun(11));
  sandbox.context.window.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sandbox.renderRail();
  await sleepPastArmWindow();

  const before = sandbox.context.window.__mzRail;
  const railElBefore = sandbox.railEl();
  const pulseClassesBefore = railElBefore.className;

  railElBefore.onclick(buttonTapEvent());

  assert.equal(sandbox.context.window.__mzRail, before, "a button-target tap must never touch the rail view-model");
  assert.equal(sandbox.railEl().className, pulseClassesBefore, "a button-target tap must never re-trigger the pulse class");
});

test("Section B (2): an unarmed body tap (inside the arm window the card opened with) is swallowed — the view-model is unchanged", () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  sandbox.setState(newRun(12));
  sandbox.context.window.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sandbox.renderRail();
  // No wait — invoked immediately, still inside the ARM_DELAY_MS window the
  // render above just opened.

  const before = sandbox.context.window.__mzRail;
  sandbox.railEl().onclick(bodyTapEvent());

  assert.equal(sandbox.context.window.__mzRail, before, "an unarmed body tap must never touch the rail view-model");
});

test("Section B (3a): an armed body tap on a card locked by a pending decision (railLocked() true) pulses and leaves the card present", async () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  const s = newRun(13);
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 1 };
  sandbox.setState(s);
  sandbox.renderRail();
  await sleepPastArmWindow();

  const railEl = sandbox.railEl();
  railEl.classList.remove("mw-rail-pulse");
  const titleBefore = doc.document.getElementById("mw-rail-title").textContent;

  railEl.onclick(bodyTapEvent());

  assert.equal(doc.document.getElementById("mw-rail-title").textContent, titleBefore, "the locked card must still be present after the tap");
  assert.ok(railEl.classList.contains("mw-rail-pulse"), "railPulse() must re-trigger the pulse class");
});

test("Section B (3b): an armed body tap on a card with a live action row (buttonCount > 0, railLocked() false) also pulses and leaves the card present — buttons alone lock it", async () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  sandbox.setState(newRun(14));
  sandbox.context.window.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sandbox.renderRail();
  await sleepPastArmWindow();

  // Directly stuff a live action-row button, bypassing S's own pending
  // fields entirely — proves buttonCount alone (not just railLocked())
  // routes to the locked branch, per railDismissKind's own contract.
  const actions = sandbox.actionsEl();
  const btn = doc.document.createElement("button");
  btn.className = "mw-rail-btn";
  actions.appendChild(btn);
  assert.equal(actions.children.length, 1);

  const railEl = sandbox.railEl();
  railEl.classList.remove("mw-rail-pulse");
  const before = sandbox.context.window.__mzRail;

  railEl.onclick(bodyTapEvent());

  assert.equal(sandbox.context.window.__mzRail, before, "a live-action-row card must never be cleared by a body tap");
  assert.ok(railEl.classList.contains("mw-rail-pulse"), "railPulse() must re-trigger the pulse class");
});

test("Section B (4): an armed body tap on a plain card with no buttons and no lock dismisses — the rail view-model clears and the element ends in its hidden/idle state", async () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  sandbox.setState(newRun(15));
  sandbox.context.window.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sandbox.renderRail();
  await sleepPastArmWindow();

  assert.equal(sandbox.actionsEl().children.length, 0, "the plain card must carry no action row");
  const titleBefore = doc.document.getElementById("mw-rail-title").textContent;

  sandbox.railEl().onclick(bodyTapEvent());

  assert.equal(sandbox.context.window.__mzRail.card, null, "the dismiss branch must clear the rail view-model's card");
  const railEl = sandbox.railEl();
  assert.equal(railEl.hidden, true, "renderRail() must have re-run and hidden the now-idle rail");
  assert.equal(railEl.dataset.shown, "0", "the rail must have re-rendered into its idle state");
  // Phase 58 (MOTION-02): the idle re-render is a skip-repaint path — the
  // departing card's own content (title/lines/etc.) is retained on screen,
  // NOT overwritten with the idle copy, so it stays intact through its
  // 120ms slide-out. dataset.idle is therefore stale here (whatever it
  // was on the last SHOWN render) rather than freshly "1" — deliberate,
  // per the rail-retention rule (58-04-PLAN.md's Task 2).
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, titleBefore, "the departing card's title must be retained for the slide-out, not repainted to the idle copy");
});

test("Section B (5): on a screen where the rail has never shown, a body tap on the resting rail throws nothing and leaves the view-model at its resting value", () => {
  const doc = createRecordingDocument();
  const sandbox = loadRailDismissSandbox({ doc });
  // Deliberately no setState(...) and no renderRail() call — the rail has
  // never shown a card this session; railShownAt is still its initial 0.

  assert.doesNotThrow(() => sandbox.railEl().onclick(bodyTapEvent()));
  assert.equal(sandbox.context.window.__mzRail.card, null, "the resting view-model carries no card");
  assert.equal(sandbox.context.window.__mzRail.pending, null, "the resting view-model carries no pending decision");
});

// Phase 58 (MOTION-04, D-13): a source-anchor test — the typing-complete
// branch must sit strictly after the arm-window check and strictly before
// the locked-card pulse, so a tap on typing text can never also dismiss or
// pulse a card. The BEHAVIOUR itself (a tap mid-typing completes typing,
// leaves the card showing, schedules the hold, and the NEXT armed tap
// dismisses) is proven in typed-text.test.js (4), which drives the real
// renderRail()/typewriter through this same handler.
test("Section B: ordered anchor — the typing-complete branch sits after the arm-window check and before the locked-card check", () => {
  const raw = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");
  const stripped = stripHtml(raw);
  const start = stripped.indexOf('document.getElementById("mw-rail").onclick = (e) => {');
  assert.ok(start !== -1, "the #mw-rail body-tap handler was not found");
  const end = stripped.indexOf("};", start);
  assert.ok(end !== -1 && end > start, "the handler's closing `};` was not found");
  const region = stripped.slice(start, end);
  const armIdx = region.indexOf("isArmed(railShownAt");
  const typeCompleteIdx = region.indexOf('.complete("rail")');
  const lockedIdx = region.indexOf("railPulse()");
  assert.ok(armIdx !== -1 && typeCompleteIdx !== -1 && lockedIdx !== -1, "all three anchors (arm-window check, typing-complete, locked pulse) must be present");
  assert.ok(armIdx < typeCompleteIdx, "the typing-complete branch must sit after the arm-window check");
  assert.ok(typeCompleteIdx < lockedIdx, "the typing-complete branch must sit before the locked-card pulse");
});
