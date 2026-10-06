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
