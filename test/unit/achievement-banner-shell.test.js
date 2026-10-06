// test/unit/achievement-banner-shell.test.js
//
// Phase 100 (AUI-01), Plan 04 — the unlock banner on screen. Two parts:
//
// Part 1 (the classic script): the rail's icon path, the card-kind stamp,
// the drain hook and the summary card's tap; the death panel's Earned strip.
// Exercised through the REAL classic script in a recording-DOM sandbox (a
// sibling of rail-dismiss.test.js's loader: the real renderRail and
// renderCombatOver run, window.__mzAchBanner and window.mzOpenAchievements
// are stubbed per test, the module script is never imported).
//
// Part 2 (the module glue): source anchors and a factory harness over the
// sliced glue, appended below.

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ROMAN } from "../../content/index.js";
import { ACHIEVEMENTS } from "../../content/achievements.js";
import { nightlyEats } from "../../engine/movement.js";
import { PARTY_CAP, newRun } from "../../engine/state.js";
import { die } from "../../engine/death.js";
import { makeRng } from "../../engine/rng.js";
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
} from "../../src/browser/rail.js";
import { achievementCardFor, achievementSummaryCard, earnedStripView } from "../../src/browser/achievementCard.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(REPO_ROOT, "mazeworld.html");
const RAW_HTML = fs.readFileSync(HTML_PATH, "utf8").replace(/\r\n/g, "\n");

const CLASSIC_OPEN = "\n<script>\n";
const SCRIPT_CLOSE = "\n</script>\n";
function extractClassicScript(raw) {
  const start = raw.indexOf(CLASSIC_OPEN);
  assert.ok(start !== -1, "banner sandbox: classic <script> not found");
  const end = raw.indexOf(SCRIPT_CLOSE, start + 1);
  assert.ok(end !== -1, "banner sandbox: classic </script> not found");
  return raw.slice(start + CLASSIC_OPEN.length, end);
}

function loadBannerSandbox({ doc }) {
  const classic = extractClassicScript(RAW_HTML);
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
  vm.runInContext(classic, context, { filename: "mazeworld.html#classic (banner sandbox)" });

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
    w,
    setState: (s) => context.window.__mzState.set(s),
    renderRail: () => context.renderRail(),
    railEl: () => doc.document.getElementById("mw-rail"),
    doc,
  };
}

function bodyTapEvent() {
  return { target: { closest: () => null } };
}
function sleepPastArmWindow() {
  return new Promise((resolve) => setTimeout(resolve, ARM_DELAY_MS + 60));
}

const IDS = ACHIEVEMENTS.map((e) => e.id);
const FIRST = ACHIEVEMENTS[0];

function liveState(seed) {
  const s = newRun(seed, [], { force: { cls: "Fighter" } });
  s.c.wp = s.c.maxWP;
  return s;
}
function deadState() {
  const s = liveState(11);
  die(s, "combat", "a rat", makeRng(4), [], () => 1);
  return s;
}

// ─── Part 1a: the rail ─────────────────────────────────────────────────────

test("AUI-01 rail: an achievement card shows its in-game icon (empty alt, aria-hidden, no glyph), ACHIEVEMENT, the name then the line, and stamps data-card-kind", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(21));
  const card = achievementCardFor(FIRST.id);
  sb.w.__mzRail = railPush(emptyRail(), card);
  sb.renderRail();

  const iconEl = doc.document.getElementById("mw-rail-icon");
  assert.equal(iconEl.children.length, 1, "exactly one icon child");
  const img = iconEl.children[0];
  assert.equal(img.tagName, "img");
  assert.equal(img.src, card.iconSrc, "the card's iconSrc is the image source");
  assert.equal(img.alt, "");
  assert.equal(img.getAttribute("aria-hidden"), "true");
  assert.equal(iconEl.textContent, "", "no glyph text beside the image");
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, "ACHIEVEMENT");
  const lines = doc.document.getElementById("mw-rail-lines");
  const texts = lines.children.map((c) => c.textContent);
  assert.ok(texts.includes(FIRST.name), "the name line is present");
  assert.ok(texts.includes(FIRST.line), "the sarcastic line is present");
  assert.ok(texts.indexOf(FIRST.name) < texts.indexOf(FIRST.line), "the name comes before the line");
  assert.equal(sb.railEl().dataset.cardKind, "achievement");
});

test("AUI-01 rail: pushing an ordinary card after an achievement card removes the stamp and builds the icon the old way", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(22));
  sb.w.__mzRail = railPush(emptyRail(), achievementCardFor(FIRST.id));
  sb.renderRail();
  assert.equal(sb.railEl().dataset.cardKind, "achievement");

  sb.w.__mzRail = railPush(sb.w.__mzRail, railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sb.renderRail();
  assert.equal(sb.railEl().dataset.cardKind, undefined, "the stamp is gone");
  const iconEl = doc.document.getElementById("mw-rail-icon");
  assert.equal(iconEl.children.length, 0, "the plain glyph card builds no image");
  assert.equal(iconEl.textContent, "✕");
});

test("AUI-01 rail: a card with both an iconSrc and an iconKey draws the iconSrc", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(23));
  const card = { ...achievementCardFor(FIRST.id), iconKey: "torch" };
  sb.w.__mzRail = railPush(emptyRail(), card);
  sb.renderRail();
  const img = doc.document.getElementById("mw-rail-icon").children[0];
  assert.equal(img.src, card.iconSrc);
});

test("AUI-01 rail: the drain hook runs right after the guard; a true drain stops the render, false or an absent bridge renders as before", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(24));
  sb.w.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));

  let calls = 0;
  sb.w.__mzAchBanner = { drain: () => { calls++; return true; } };
  sb.renderRail();
  assert.equal(calls, 1, "drain is asked once");
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, "", "a true drain writes nothing else");

  sb.w.__mzAchBanner = { drain: () => { calls++; return false; } };
  sb.renderRail();
  assert.equal(calls, 2);
  assert.equal(doc.document.getElementById("mw-rail-title").textContent, "A TRAP");

  const doc2 = createRecordingDocument();
  const sb2 = loadBannerSandbox({ doc: doc2 });
  sb2.setState(liveState(25));
  sb2.w.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  sb2.renderRail();
  assert.equal(doc2.document.getElementById("mw-rail-title").textContent, "A TRAP", "no bridge: renders exactly as before");
});

test("AUI-01 rail: a body tap on a single achievement card clears it and never opens the list", async () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(26));
  let opened = 0;
  sb.w.mzOpenAchievements = () => { opened++; };
  sb.w.__mzRail = railPush(emptyRail(), achievementCardFor(FIRST.id));
  sb.renderRail();
  await sleepPastArmWindow();
  sb.railEl().onclick(bodyTapEvent());
  assert.equal(sb.w.__mzRail.card, null, "the card cleared");
  assert.equal(opened, 0);
});

test("AUI-01 rail: a body tap on the summary card clears it, then opens the list exactly once", async () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(27));
  const order = [];
  sb.w.mzOpenAchievements = () => { order.push({ cardAtOpen: sb.w.__mzRail.card }); };
  const many = achievementSummaryCard(IDS.slice(0, 4));
  assert.equal(many.opensList, true);
  sb.w.__mzRail = railPush(emptyRail(), many);
  sb.renderRail();
  await sleepPastArmWindow();
  sb.railEl().onclick(bodyTapEvent());
  assert.equal(order.length, 1, "opened once");
  assert.equal(order[0].cardAtOpen, null, "the card was cleared before the list opened");
  assert.equal(sb.w.__mzRail.card, null);
});

test("AUI-01 rail: a tap inside the arm window changes nothing and does not open the list", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(liveState(28));
  let opened = 0;
  sb.w.mzOpenAchievements = () => { opened++; };
  sb.w.__mzRail = railPush(emptyRail(), achievementSummaryCard(IDS.slice(0, 4)));
  sb.renderRail();
  const before = sb.w.__mzRail;
  sb.railEl().onclick(bodyTapEvent());
  assert.equal(sb.w.__mzRail, before);
  assert.equal(opened, 0);
});

test("AUI-01 rail: a decision card (pending joiner) still pulses on a tap and never opens the list", async () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  const s = liveState(29);
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 1 };
  sb.setState(s);
  let opened = 0;
  sb.w.mzOpenAchievements = () => { opened++; };
  sb.renderRail();
  await sleepPastArmWindow();
  sb.railEl().classList.remove("mw-rail-pulse");
  sb.railEl().onclick(bodyTapEvent());
  assert.ok(sb.railEl().classList.contains("mw-rail-pulse"));
  assert.equal(opened, 0);
});

test("AUI-01 rail: the body-tap handler holds no `};` (rail-dismiss's Section B anchor slices to the first one) and ends with the list-open block", () => {
  const stripped = stripHtml(RAW_HTML);
  const start = stripped.indexOf('document.getElementById("mw-rail").onclick = (e) => {');
  assert.ok(start !== -1);
  const first = stripped.indexOf("};", start);
  const handler = stripped.slice(start, first + 2);
  assert.ok(handler.includes("if (tapped && tapped.opensList) { window.mzOpenAchievements?.(); }"), "the list-open block is inside the handler's first `};`");
  assert.ok(handler.trimEnd().endsWith("};"), "the first `};` is the handler's own end");
  assert.ok(handler.indexOf("opensList") > handler.indexOf("renderRail();"), "the list opens after the clear and re-render");
});

// ─── Part 1b: the death panel's Earned strip ───────────────────────────────

function drawDead(sb, host) {
  sb.context.renderCombatOver(host, "dead", {
    buttons: [
      { id: "cb-bury", label: "BURY THEM", cls: "dead" },
      { id: "cb-new", label: "NEW CHARACTER", cls: "secondary" },
    ],
  });
}
function overOf(host) {
  return host.children.find((c) => c.id === "cb-over");
}

function twoItemStrip() {
  return earnedStripView([IDS[0], IDS[1]]);
}

test("AUI-01 strip: a strip view draws #cb-over-earned inside #cb-over: label first, a list of icon + name items, before the buttons", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  const strip = twoItemStrip();
  sb.w.__mzAchBanner = { takeStrip: () => strip };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  const over = overOf(host);
  assert.ok(over, "the dead panel exists");
  const box = over.children.find((c) => c.id === "cb-over-earned");
  assert.ok(box, "the strip exists");
  assert.equal(box.className, "cb-over-earned");
  assert.equal(box.children[0].className, "cb-over-earned-label");
  assert.equal(box.children[0].textContent, strip.label);
  const list = box.children[1];
  assert.equal(list.tagName, "ul");
  assert.equal(list.children.length, 2);
  list.children.forEach((li, i) => {
    assert.equal(li.tagName, "li");
    const img = li.children[0];
    assert.equal(img.tagName, "img");
    assert.equal(img.src, strip.items[i].iconSrc);
    assert.equal(img.alt, "");
    assert.equal(img.getAttribute("aria-hidden"), "true");
    assert.equal(li.children[1].textContent, strip.items[i].name);
  });
  const actionsIdx = over.children.findIndex((c) => c.className === "cb-over-actions");
  const boxIdx = over.children.indexOf(box);
  assert.ok(actionsIdx > boxIdx, "the strip sits before the buttons");
  assert.equal(over.children[actionsIdx].children.length, 2, "both buttons are still there");
});

test("AUI-01 strip: it sits after the NEW PERSONAL BEST block and the rank line when they are present", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  sb.w.__mzDeathRecord = { head: "NEW PERSONAL BEST", rows: ["DEEPEST DESCENT · floor 9"], quip: "Q" };
  sb.w.__mzPlacement = { hash: "h", line: "Ranked somewhere.", fresh: false };
  sb.w.__mzAchBanner = { takeStrip: () => twoItemStrip() };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  const over = overOf(host);
  const idxOf = (pred) => over.children.findIndex(pred);
  const best = idxOf((c) => c.className === "cb-over-best");
  const rank = idxOf((c) => c.id === "cb-over-rank");
  const earned = idxOf((c) => c.id === "cb-over-earned");
  const actions = idxOf((c) => c.className === "cb-over-actions");
  assert.ok(best !== -1 && rank !== -1 && earned !== -1 && actions !== -1);
  assert.ok(best < rank && rank < earned && earned < actions, "best, rank, strip, buttons");
});

test("AUI-01 strip: null, an empty-items strip, a missing takeStrip and an absent bridge all draw no strip", () => {
  const variants = [
    { takeStrip: () => null },
    { takeStrip: () => ({ label: "X", items: [] }) },
    { takeStrip: () => undefined },
    {},
    null,
  ];
  for (const bridge of variants) {
    const doc = createRecordingDocument();
    const sb = loadBannerSandbox({ doc });
    sb.setState(deadState());
    sb.w.__mzAchBanner = bridge;
    const host = doc.document.createElement("div");
    drawDead(sb, host);
    const over = overOf(host);
    assert.ok(over, "the panel still draws");
    assert.equal(over.children.some((c) => c.id === "cb-over-earned"), false);
    assert.equal(over.children.find((c) => c.className === "cb-over-actions").children.length, 2);
  }
});

test("AUI-01 strip: redrawing the panel twice leaves exactly one strip", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  const strip = twoItemStrip();
  sb.w.__mzAchBanner = { takeStrip: () => strip };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  drawDead(sb, host);
  const overs = host.children.filter((c) => c.id === "cb-over");
  let strips = 0;
  for (const o of overs) strips += o.children.filter((c) => c.id === "cb-over-earned").length;
  assert.equal(strips, overs.length, "one strip per drawn panel, never two inside one");
  // The builder itself replaces an old strip in its own host.
  const over = overs[overs.length - 1];
  sb.context.renderEarnedStrip(over, strip);
  assert.equal(over.children.filter((c) => c.id === "cb-over-earned").length, 1);
});

test("AUI-01 strip: names are written with textContent, so markup in a name shows literally", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  sb.w.__mzAchBanner = {
    takeStrip: () => ({ label: "EARNED & <b>", items: [{ id: "x", name: "Fish & <b>Chips</b>", iconSrc: "achievements/ingame/x.png" }] }),
  };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  const box = overOf(host).children.find((c) => c.id === "cb-over-earned");
  assert.equal(box.children[0].textContent, "EARNED & <b>");
  assert.equal(box.children[1].children[0].children[1].textContent, "Fish & <b>Chips</b>");
});

test("AUI-01 strip: the builder carries no innerHTML and no copy literal; renderCombatOver reads takeStrip once, after the rank line, before the buttons", () => {
  const code = stripHtml(RAW_HTML);
  const bStart = code.indexOf("function renderEarnedStrip(host, view)");
  assert.ok(bStart !== -1);
  const bEnd = code.indexOf("\nfunction ", bStart + 10);
  const builder = code.slice(bStart, bEnd);
  assert.doesNotMatch(builder, /innerHTML/);
  const oStart = code.indexOf("function renderCombatOver(host, kind, opts = {})");
  const oEnd = code.indexOf("\nfunction ", oStart + 10);
  const over = code.slice(oStart, oEnd);
  assert.doesNotMatch(over, /innerHTML/);
  const rankIdx = over.indexOf('if (kind === "dead") renderRankLine(over, window.__mzPlacement);');
  const stripIdx = over.indexOf('if (kind === "dead") renderEarnedStrip(over, window.__mzAchBanner?.takeStrip?.() ?? null);');
  const actionsIdx = over.indexOf('actions.className = "cb-over-actions";');
  assert.ok(rankIdx !== -1 && stripIdx !== -1 && actionsIdx !== -1);
  assert.ok(rankIdx < stripIdx && stripIdx < actionsIdx);
  assert.equal(over.split("takeStrip").length - 1, 1, "takeStrip is read exactly once");
});

test("AUI-01 css: the strip is bounded and scrolls inside itself; the rail icon enlarges by the card-kind stamp; none of it animates", () => {
  const css = RAW_HTML;
  const rule = (sel) => {
    const i = css.indexOf(sel + "{");
    assert.ok(i !== -1, sel + " rule not found");
    return css.slice(i, css.indexOf("}", i) + 1);
  };
  const list = rule(".cb-over-earned-list");
  assert.match(list, /max-height:9\.5em/);
  assert.match(list, /overflow-y:auto/);
  assert.match(list, /overscroll-behavior:contain/);
  for (const sel of [".cb-over-earned", ".cb-over-earned-label", ".cb-over-earned-list", ".cb-over-earned-item", ".cb-over-earned-icon", ".cb-over-earned-name"]) {
    assert.doesNotMatch(rule(sel), /animation|transition/, sel + " must not animate");
  }
  assert.match(rule(".cb-over-earned-icon"), /width:32px;height:32px/);
  assert.match(rule('#mw-rail[data-card-kind="achievement"] .mw-rail-icon'), /width:44px/);
  assert.match(rule('#mw-rail[data-card-kind="achievement"] .mw-rail-icon img'), /width:44px;height:44px/);
  for (const sel of [".cb-over-earned-label", ".cb-over-earned-name"]) {
    assert.match(rule(sel), /--mw-text-scale/);
  }
});

// ─── Part 1c: the beat end already repaints the rail ───────────────────────

test("AUI-01 beat end: the last round's playback settles through paint(), and paint() calls renderRail, so a held card appears the moment the playback ends", () => {
  const code = stripHtml(RAW_HTML);
  assert.match(code, /onSettle: \(\) => \{ window\.paint\(\); window\.renderEncounter\(\); \}/);
  const pStart = code.indexOf("\nfunction paint() {");
  assert.ok(pStart !== -1);
  const pEnd = code.indexOf("\nfunction ", pStart + 10);
  assert.match(code.slice(pStart, pEnd), /\n  renderRail\(\);/);
});

// ═══════════════════════ Part 2: the module glue ═══════════════════════════

import { BRIDGE } from "../../src/browser/bridge.js";
import { emptyBannerQueue, bannerEnqueue, bannerNext, deathHintFor } from "../../src/browser/achievementCard.js";

const CODE = stripHtml(RAW_HTML);

function occurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

const GLUE_START = CODE.indexOf("let bannerQueue = emptyBannerQueue();");
const GLUE_END_MARK = "takeHint: takeDeathHint, clearStrip: clearDeathStrip };";
const GLUE_END = CODE.indexOf(GLUE_END_MARK, GLUE_START) + GLUE_END_MARK.length;
const GLUE = CODE.slice(GLUE_START, GLUE_END);

test("AUI-01 anchors: the listener is registered once, with the banner subscribed after it, both before boot", () => {
  const reg = "setAchievementListener(achievementEvents.publish);";
  const sub = "achievementEvents.subscribe(onAchievementBanner);";
  assert.equal(occurrences(CODE, reg), 1);
  assert.equal(occurrences(CODE, sub), 1);
  assert.equal(occurrences(CODE, "setAchievementListener("), 1, "the adapter slot is taken exactly once");
  const regAt = CODE.indexOf(reg);
  const subAt = CODE.indexOf(sub);
  const runRecorded = CODE.indexOf("setRunRecordedListener(onRunRecorded);");
  const bootAt = CODE.indexOf("await boot(");
  assert.ok(runRecorded !== -1 && runRecorded < regAt, "registered next to setRunRecordedListener, after it");
  assert.ok(regAt < subAt, "the subscription follows the registration");
  assert.ok(subAt < bootAt, "both before `await boot(`");
});

test("AUI-01 anchors: the three new imports sit on their own lines and the pinned adapter imports are byte-identical", () => {
  for (const line of [
    'import { setAchievementListener } from "./src/browser/engineAdapter.js";',
    'import { achievementEvents } from "./src/browser/achievementBus.js";',
    'import { emptyBannerQueue, bannerEnqueue, bannerNext, deathHintFor } from "./src/browser/achievementCard.js";',
    'import { boot, dispatch, startNewRun, waitForPending, takeBootWornReport } from "./src/browser/engineAdapter.js";',
    'import { takeBootResumeEvents, formatEvents } from "./src/browser/engineAdapter.js";',
  ]) {
    assert.equal(CODE.split("\n").filter((l) => l.trim() === line).length, 1, line);
  }
});

test("AUI-01 anchors: __mzAchBanner is assigned once, right after the rail parcel, with exactly five members; showTitleScreen clears the strip beside the death-record reset", () => {
  assert.equal(occurrences(CODE, "window.__mzAchBanner ="), 1);
  const m = CODE.match(/window\.__mzAchBanner = \{ onEvent: onAchievementBanner, drain: drainAchievementBanner, takeStrip: takeDeathStrip, takeHint: takeDeathHint, clearStrip: clearDeathStrip \};/);
  assert.ok(m, "the five members, in order");
  assert.ok(CODE.indexOf("window.__mzRail = emptyRail();") < CODE.indexOf("window.__mzAchBanner ="));
  const start = CODE.indexOf("function showTitleScreen({ allowResume } = {})");
  assert.ok(start !== -1);
  const region = CODE.slice(start, CODE.indexOf("\n  function ", start + 20));
  const rec = region.indexOf("window.__mzDeathRecord = null;");
  const clr = region.indexOf("clearDeathStrip();");
  assert.ok(rec !== -1 && clr > rec, "clearDeathStrip() follows the death-record reset");
  assert.equal(region.includes("bannerQueue"), false, "the queue is deliberately not cleared on the title screen");
});

test("AUI-01 anchors: the glue block holds no network, storage or Capacitor token and no dispatch call", () => {
  assert.ok(GLUE_START !== -1 && GLUE.length > 200);
  for (const token of ["fetch", "localStorage", "mzStorage", "setItem", "getItem", "Capacitor", "dispatch(", "XMLHttpRequest", "WebSocket"]) {
    assert.equal(GLUE.includes(token), false, `glue must not contain ${token}`);
  }
});

function makeGlue(over = {}) {
  const st = { s: { c: { name: "hero" }, dead: false }, visible: true, fighting: false, decision: false, fade: false, renders: 0, syncs: 0, refreshes: 0 };
  const w = {
    __mzState: { get: () => st.s },
    __mzRail: emptyRail(),
    __mzStairsFade: { active: () => st.fade },
    renderRail: () => { st.renders++; },
    mzSyncAchievementsCount: () => { st.syncs++; },
    mzRefreshAchievementsSheet: () => { st.refreshes++; },
    ...over,
  };
  const factory = new Function(
    "window", "dungeonVisible", "combatScreenUp", "railLocked", "emptyBannerQueue", "bannerEnqueue", "bannerNext", "deathHintFor", "railPush", "queueMicrotask",
    `${GLUE}\nreturn { queue: () => bannerQueue, strip: () => deathStrip, bridge: window.__mzAchBanner };`,
  );
  const g = factory(w, () => st.visible, () => st.fighting, () => st.decision, emptyBannerQueue, bannerEnqueue, bannerNext, deathHintFor, railPush, queueMicrotask);
  return { st, w, ...g };
}
const unlocksOf = (...ids) => ({ unlocks: ids.map((id) => ({ id, at: 1 })), reveals: [], progress: [] });
const flush = () => new Promise((r) => setImmediate(r));
const clearRail = (w) => { w.__mzRail = railClear(w.__mzRail); };

test("AUI-01 glue: an unlock schedules one render; drain then pushes one achievement card and re-enters renderRail once, returning true", async () => {
  const g = makeGlue();
  g.bridge.onEvent(unlocksOf(IDS[0]));
  assert.equal(g.st.renders, 0, "the render waits for the microtask");
  await flush();
  assert.equal(g.st.renders, 1, "exactly one scheduled render");
  assert.equal(g.bridge.drain(), true);
  assert.equal(g.w.__mzRail.card.kind, "achievement");
  assert.equal(g.w.__mzRail.card.achievementId, IDS[0]);
  assert.equal(g.st.renders, 2, "the drain re-entered renderRail once");
  assert.equal(g.bridge.drain(), false, "a card is up: the rail is busy");
  assert.equal(g.w.__mzRail.card.achievementId, IDS[0]);
});

test("AUI-01 glue: three queued come out as three cards in list order, one per free rail; four collapse into one list-opening card", () => {
  const g = makeGlue();
  g.bridge.onEvent(unlocksOf(IDS[2], IDS[0], IDS[1]));
  const seen = [];
  for (let i = 0; i < 3; i++) {
    assert.equal(g.bridge.drain(), true);
    seen.push(g.w.__mzRail.card.achievementId);
    assert.equal(g.bridge.drain(), false);
    clearRail(g.w);
  }
  assert.deepEqual(seen, [IDS[0], IDS[1], IDS[2]]);
  assert.equal(g.bridge.drain(), false, "nothing left");

  const h = makeGlue();
  h.bridge.onEvent(unlocksOf(IDS[0], IDS[1], IDS[2], IDS[3]));
  assert.equal(h.bridge.drain(), true);
  assert.equal(h.w.__mzRail.card.kind, "achievement-many");
  assert.equal(h.w.__mzRail.card.opensList, true);
  clearRail(h.w);
  assert.equal(h.bridge.drain(), false, "all four were in the one summary: none left over, none lost");
});

test("AUI-01 glue: unlocks arriving while a card is up never overwrite it; they wait their turn", () => {
  const g = makeGlue();
  g.bridge.onEvent(unlocksOf(IDS[0]));
  assert.equal(g.bridge.drain(), true);
  g.bridge.onEvent(unlocksOf(IDS[1]));
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.w.__mzRail.card.achievementId, IDS[0]);
  clearRail(g.w);
  assert.equal(g.bridge.drain(), true);
  assert.equal(g.w.__mzRail.card.achievementId, IDS[1]);
});

test("AUI-01 glue: a fight holds the queue and nothing is lost; the held card appears once the fight is over", () => {
  const g = makeGlue();
  g.st.fighting = true;
  g.bridge.onEvent(unlocksOf(IDS[0]));
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.w.__mzRail.card, null);
  assert.deepEqual([...g.queue().pending], [IDS[0]]);
  g.st.fighting = false;
  assert.equal(g.bridge.drain(), true);
  assert.equal(g.w.__mzRail.card.achievementId, IDS[0]);
});

test("AUI-01 glue: a pending decision, the stairs fade, a hidden dungeon and a missing hero each hold the card", () => {
  const live = () => ({ c: { name: "hero" }, dead: false });
  const cases = [
    ["decision", (g) => { g.st.decision = true; }, (g) => { g.st.decision = false; }],
    ["fade", (g) => { g.st.fade = true; }, (g) => { g.st.fade = false; }],
    ["dungeon hidden", (g) => { g.st.visible = false; }, (g) => { g.st.visible = true; }],
    ["no hero", (g) => { g.st.s = { c: null, dead: false }; }, (g) => { g.st.s = live(); }],
    ["no state", (g) => { g.st.s = null; }, (g) => { g.st.s = live(); }],
  ];
  for (const [name, block, release] of cases) {
    const g = makeGlue();
    g.bridge.onEvent(unlocksOf(IDS[0]));
    block(g);
    assert.equal(g.bridge.drain(), false, name + " blocks");
    assert.equal(g.w.__mzRail.card, null, name + " pushed nothing");
    release(g);
    assert.equal(g.bridge.drain(), true, name + " released");
  }
});

test("AUI-01 glue: on death drain pushes no card; takeStrip returns everything queued in list order, the queue empties, and the same strip comes back on a redraw", () => {
  const g = makeGlue();
  g.st.s = { c: { name: "hero" }, dead: true };
  g.bridge.onEvent(unlocksOf(IDS[1], IDS[0]));
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.w.__mzRail.card, null);
  const strip = g.bridge.takeStrip();
  assert.deepEqual(strip.items.map((i) => i.id), [IDS[0], IDS[1]]);
  assert.equal(g.queue().pending.length, 0);
  assert.equal(g.bridge.takeStrip(), strip, "idempotent: the very same parked strip");
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.bridge.takeStrip(), strip, "a later empty result never overwrites it");
});

test("AUI-01 glue: with the hero next seen alive the parked strip is cleared and shows no card; clearStrip empties it", () => {
  const g = makeGlue();
  g.st.s = { c: { name: "hero" }, dead: true };
  g.bridge.onEvent(unlocksOf(IDS[0]));
  assert.ok(g.bridge.takeStrip());
  g.st.s = { c: { name: "next" }, dead: false };
  assert.equal(g.bridge.drain(), false, "the parked strip never becomes a card");
  assert.equal(g.w.__mzRail.card, null);
  assert.equal(g.strip(), null, "stale strip dropped");
  assert.equal(g.bridge.takeStrip(), null);

  const h = makeGlue();
  h.st.s = { c: { name: "hero" }, dead: true };
  h.bridge.onEvent(unlocksOf(IDS[0]));
  assert.ok(h.bridge.takeStrip());
  h.bridge.clearStrip();
  assert.equal(h.strip(), null);
  assert.equal(h.bridge.takeStrip(), null);
});

test("AUI-01 glue: takeStrip is null when nothing is parked or the hero is alive", () => {
  const g = makeGlue();
  assert.equal(g.bridge.takeStrip(), null);
  g.bridge.onEvent(unlocksOf(IDS[0]));
  assert.equal(g.bridge.takeStrip(), null, "alive: the queue stays for the rail");
  assert.equal(g.queue().pending.length, 1);
  g.st.s = { c: { name: "hero" }, dead: true };
  assert.equal(g.bridge.takeStrip().items.length, 1);
});

test("AUI-01 glue: a reveals-only payload leaves the queue unchanged, schedules no render, and refreshes the sheet and count", async () => {
  const g = makeGlue();
  const before = g.queue();
  g.bridge.onEvent({ unlocks: [], reveals: [IDS[5]], progress: [] });
  await flush();
  assert.equal(g.queue(), before);
  assert.equal(g.st.renders, 0);
  assert.equal(g.st.syncs, 1);
  assert.equal(g.st.refreshes, 1);
  assert.equal(g.bridge.drain(), false);
});

test("AUI-01 glue: null, {} and empty arrays do nothing and do not throw", async () => {
  const g = makeGlue();
  for (const p of [null, undefined, {}, { unlocks: [], reveals: [], progress: [] }, { unlocks: "x", reveals: 3 }, 7]) {
    assert.doesNotThrow(() => g.bridge.onEvent(p));
  }
  await flush();
  assert.equal(g.st.renders, 0);
  assert.equal(g.st.syncs, 0);
  assert.equal(g.st.refreshes, 0);
  assert.equal(g.queue().pending.length, 0);
  assert.equal(g.bridge.drain(), false, "an empty queue drains to false and writes nothing");
  assert.equal(g.w.__mzRail.card, null);
});

test("AUI-01 glue: an unlock calls the count sync and the sheet refresh; a throwing refresh never escapes", async () => {
  const g = makeGlue({
    mzRefreshAchievementsSheet: () => { throw new Error("boom"); },
    mzSyncAchievementsCount: () => { throw new Error("boom"); },
  });
  assert.doesNotThrow(() => g.bridge.onEvent(unlocksOf(IDS[0])));
  await flush();
  assert.equal(g.st.renders, 1, "the render is still scheduled");
  assert.deepEqual([...g.queue().pending], [IDS[0]]);

  const h = makeGlue();
  h.bridge.onEvent(unlocksOf(IDS[0]));
  assert.equal(h.st.syncs, 1);
  assert.equal(h.st.refreshes, 1);
});

test("AUI-01 glue: drain and takeStrip are total (a throwing state read returns false / null)", () => {
  const g = makeGlue({ __mzState: { get: () => { throw new Error("boom"); } } });
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.bridge.takeStrip(), null);
});

test("AUI-01 glue: ids are matched exactly: a near-miss id queues nothing", () => {
  const g = makeGlue();
  g.bridge.onEvent({ unlocks: [{ id: IDS[0].toUpperCase() + " ", at: 1 }, { id: "nope" }], reveals: [] });
  assert.equal(g.queue().pending.length, 0);
});

test("AUI-01 bridge: __mzAchBanner is registered with the module as owner, its consumers and a purpose", () => {
  const e = BRIDGE.__mzAchBanner;
  assert.ok(e, "registered");
  assert.equal(e.owner, "mazeworld.html (module)");
  const joined = e.consumers.join("\n");
  for (const needle of ["renderRail", "renderCombatOver", "showTitleScreen", "tools/layout-check.mjs"]) {
    assert.ok(joined.includes(needle), "consumers name " + needle);
  }
  assert.ok(e.purpose.length > 20);
});

// ═══════ Quick 261005-vn5: the death screen hint line for a death-revealed secret ═══════

import { ACHIEVEMENT_CARD_COPY } from "../../src/browser/achievementCard.js";

const HINT = ACHIEVEMENT_CARD_COPY.strip.hint;

test("vn5 hint: renderDeathHint draws #cb-over-hint with textContent, after the strip and before the buttons; null and empty draw nothing", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  const strip = twoItemStrip();
  sb.w.__mzAchBanner = { takeStrip: () => strip, takeHint: () => HINT };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  const over = overOf(host);
  const kids = over.children;
  const stripAt = kids.findIndex((c) => c.id === "cb-over-earned");
  const hintAt = kids.findIndex((c) => c.id === "cb-over-hint");
  const actionsAt = kids.findIndex((c) => c.className === "cb-over-actions");
  assert.ok(stripAt !== -1 && hintAt !== -1 && actionsAt !== -1);
  assert.ok(stripAt < hintAt && hintAt < actionsAt, "strip, then hint, then the buttons");
  assert.equal(kids[hintAt].className, "cb-over-hint");
  assert.equal(kids[hintAt].textContent, HINT);
  assert.equal(kids[actionsAt].children.length, 2, "both death buttons are still drawn");

  for (const takeHint of [() => null, () => "", () => undefined, () => 5, undefined]) {
    const d2 = createRecordingDocument();
    const s2 = loadBannerSandbox({ doc: d2 });
    s2.setState(deadState());
    s2.w.__mzAchBanner = { takeStrip: () => null, takeHint };
    const h2 = d2.document.createElement("div");
    drawDead(s2, h2);
    assert.ok(overOf(h2), "the panel still draws");
    assert.equal(overOf(h2).children.some((c) => c.id === "cb-over-hint"), false);
  }
  const d3 = createRecordingDocument();
  const s3 = loadBannerSandbox({ doc: d3 });
  s3.setState(deadState());
  s3.w.__mzAchBanner = null;
  const h3 = d3.document.createElement("div");
  drawDead(s3, h3);
  assert.equal(overOf(h3).children.some((c) => c.id === "cb-over-hint"), false, "an absent bridge draws no hint");
});

test("vn5 hint: with no strip the hint still draws; redrawing leaves exactly one; markup shows literally", () => {
  const doc = createRecordingDocument();
  const sb = loadBannerSandbox({ doc });
  sb.setState(deadState());
  sb.w.__mzAchBanner = { takeStrip: () => null, takeHint: () => "Floor <b>1</b> & friends" };
  const host = doc.document.createElement("div");
  drawDead(sb, host);
  const over = overOf(host);
  assert.equal(over.children.some((c) => c.id === "cb-over-earned"), false);
  const hint = over.children.find((c) => c.id === "cb-over-hint");
  assert.equal(hint.textContent, "Floor <b>1</b> & friends");
  sb.context.renderDeathHint(over, "again");
  assert.equal(over.children.filter((c) => c.id === "cb-over-hint").length, 1);
  assert.equal(over.children.find((c) => c.id === "cb-over-hint").textContent, "again");
});

test("vn5 hint: renderCombatOver reads takeHint once, after the strip, before the buttons; the builder has no innerHTML and no copy literal", () => {
  const code = stripHtml(RAW_HTML);
  const oStart = code.indexOf("function renderCombatOver(host, kind, opts = {})");
  const oEnd = code.indexOf("\nfunction ", oStart + 10);
  const over = code.slice(oStart, oEnd);
  const stripIdx = over.indexOf('if (kind === "dead") renderEarnedStrip(over, window.__mzAchBanner?.takeStrip?.() ?? null);');
  const hintIdx = over.indexOf('if (kind === "dead") renderDeathHint(over, window.__mzAchBanner?.takeHint?.() ?? null);');
  const actionsIdx = over.indexOf('actions.className = "cb-over-actions";');
  assert.ok(stripIdx !== -1 && hintIdx !== -1 && actionsIdx !== -1);
  assert.ok(stripIdx < hintIdx && hintIdx < actionsIdx);
  assert.equal(over.split("takeHint").length - 1, 1, "takeHint is read exactly once");
  const bStart = code.indexOf("function renderDeathHint(host, text)");
  assert.ok(bStart !== -1);
  const builder = code.slice(bStart, code.indexOf("\nfunction ", bStart + 10));
  assert.doesNotMatch(builder, /innerHTML/);
  assert.doesNotMatch(builder, /floor 1|died|prize/i, "no copy literal in the builder");
  assert.equal(code.includes(HINT), false, "the line lives only in ACHIEVEMENT_CARD_COPY");
});

test("vn5 hint css: the hint is a plain wrapping line (not a nested scroller, so the panel scrolls as a whole), follows the text scale, and does not animate", () => {
  const i = RAW_HTML.indexOf(".cb-over-hint{");
  assert.ok(i !== -1);
  const rule = RAW_HTML.slice(i, RAW_HTML.indexOf("}", i) + 1);
  assert.doesNotMatch(rule, /max-height|overflow-y|(^|[;{])height:/);
  assert.match(rule, /overflow-wrap:anywhere/);
  assert.match(rule, /--mw-text-scale/);
  assert.doesNotMatch(rule, /animation|transition|vh|dvh/);
});

test("vn5 hint glue: the death that reveals Special Snowflake without earning it parks the hint; takeHint returns it on every redraw", () => {
  const g = makeGlue();
  g.st.s = { c: { name: "hero" }, dead: true };
  g.bridge.onEvent({ unlocks: [], reveals: ["special_snowflake"], progress: [] });
  assert.equal(g.bridge.takeHint(), HINT);
  assert.equal(g.bridge.takeHint(), HINT, "the same line on a redraw");
  assert.equal(g.bridge.takeStrip(), null, "nothing was earned, so no strip");
});

test("vn5 hint glue: no hint when the death earned it, revealed a different secret, or the hero is alive; a payload that arrives before the hero reads dead still shows on the death", () => {
  const earned = makeGlue();
  earned.st.s = { c: { name: "hero" }, dead: true };
  earned.bridge.onEvent({ unlocks: [{ id: "special_snowflake", at: 1 }], reveals: ["special_snowflake"], progress: [] });
  assert.equal(earned.bridge.takeHint(), null);
  assert.equal(earned.bridge.takeStrip().items[0].id, "special_snowflake");

  const other = makeGlue();
  other.st.s = { c: { name: "hero" }, dead: true };
  other.bridge.onEvent({ unlocks: [{ id: "death_trap", at: 1 }], reveals: ["death_trap"], progress: [] });
  assert.equal(other.bridge.takeHint(), null);

  const alive = makeGlue();
  alive.bridge.onEvent({ unlocks: [], reveals: ["special_snowflake"], progress: [] });
  assert.equal(alive.bridge.takeHint(), null, "alive: nothing to show");
  alive.st.s = { c: { name: "hero" }, dead: true };
  assert.equal(alive.bridge.takeHint(), HINT, "the death that follows shows the parked line");
});

test("vn5 hint glue: the next hero never sees it; clearStrip drops it; takeHint is total", () => {
  const g = makeGlue();
  g.st.s = { c: { name: "hero" }, dead: true };
  g.bridge.onEvent({ unlocks: [], reveals: ["special_snowflake"], progress: [] });
  assert.equal(g.bridge.takeHint(), HINT);
  g.st.s = { c: { name: "next" }, dead: false };
  assert.equal(g.bridge.drain(), false);
  assert.equal(g.bridge.takeHint(), null, "alive: dropped");
  g.st.s = { c: { name: "next" }, dead: true };
  assert.equal(g.bridge.takeHint(), null, "and it does not come back on the next death");

  const h = makeGlue();
  h.st.s = { c: { name: "hero" }, dead: true };
  h.bridge.onEvent({ unlocks: [], reveals: ["special_snowflake"], progress: [] });
  h.bridge.clearStrip();
  assert.equal(h.bridge.takeHint(), null);

  const t = makeGlue({ __mzState: { get: () => { throw new Error("boom"); } } });
  assert.equal(t.bridge.takeHint(), null);
  for (const p of [null, undefined, {}, 7, { reveals: "x" }]) assert.doesNotThrow(() => makeGlue().bridge.onEvent(p));
});

test("vn5 hint: deathHintFor is the glue decision, and the bridge entry names takeHint", () => {
  assert.equal(deathHintFor({ unlocks: [], reveals: ["special_snowflake"] }), HINT);
  assert.ok(BRIDGE.__mzAchBanner.purpose.includes("takeHint"));
  assert.ok(BRIDGE.__mzAchBanner.consumers.join("\n").includes("takeHint()"));
});
