// test/unit/round-summary-band.test.js
//
// Phase 71 (POLISH-07; D-07, with D-06's skip), Plan 05 — the "ROUND n ·
// WHAT HAPPENED" strip from the user's combat v2 mock
// (design/Mazeworld Combat Panel v2.dc.html, design/COMBAT-V2-NOTES.md).
// The strip sits in the flex flow between the scrolling #cb-mid (foes and
// party only, R-19) and the fixed #cb-act, and shows the last 3 lines of the
// latest round through roundSummary (fightLog.js). While a round plays it
// reads RESOLVING, shows only the lines the beat has revealed, and types the
// newest one through the shared "fightlog" typewriter (R-20). A tap on it
// mid-round is Phase 58's beatHurryTap (R-18): it skips and opens nothing.
//
// Sandbox proofs (a)-(f) drive the REAL renderEncounter through a REAL
// resolved round and the REAL beat runner, on a fake clock (the midFightRound
// / driveHandoff helpers are copied from combat-beat-shell.test.js); source
// pins cover the placement, the CSS and the lift.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog, roundSummary, ROUND_STRIP_COPY } from "../../src/browser/fightLog.js";
import { planBeat, beatOffsets, beatEndMs } from "../../src/browser/combatBeat.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);
const STYLE = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// ─── fixtures (copied from combat-beat-shell.test.js) ───────────────────────

function fixedFighter(overrides = {}) {
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

function fixedState(overrides = {}) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(),
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...overrides,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

/** midFightRound() — the same real rngState-32 round combat-beat-shell uses: three folded lines, no ending. */
function midFightRound() {
  const before = fixedState({ rngState: 32 });
  before.combat = {
    foes: [fixedFoe({ name: "Goblin Grunt", wp: 1, maxWP: 10 }), fixedFoe({ name: "Cave Rat", wp: 40, maxWP: 40 })],
    type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const { state: after, events } = applyAction(before, { type: "attack" });
  return { before, after, events };
}

const durationFor = (text) => typeDurationMs(String(text ?? "").length);

function driveHandoff(sandbox, { before, after, events, actionType = "attack" }) {
  const w = sandbox.context.window;
  const beforeLog = w.__mzFightLog;
  w.__mzState.set(after);
  const lines = fightLogLinesFor(actionType, events, {});
  w.__mzFightLog = appendFightLog(beforeLog, lines, before.combat.round);
  const plan = planBeat({ actionType, events, before, after, beforeLog, afterLog: w.__mzFightLog, ctx: {} });
  const started = sandbox.beatRunner.start(plan);
  return { plan, started, lines };
}

function scenario() {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  return { clock, doc, sandbox, w: sandbox.context.window };
}

const encBody = (doc) => doc.document.getElementById("enc-body");
const kids = (el) => el.children.filter((c) => c.nodeType !== 3);
const strip = (doc) => kids(encBody(doc)).find((el) => el.id === "cb-summary") || null;
const stripRows = (doc) => {
  const s = strip(doc);
  return s ? Array.from(s.querySelectorAll(".cb-sum-line")) : [];
};
const rowText = (row) => {
  const t = row.querySelector(".cb-sum-text");
  return t.children.length ? t.children.map((c) => c.textContent).join("") : t.textContent;
};
const fill = (tpl, n) => tpl.replace("{n}", String(n));

// ─── (a) a settled round ───────────────────────────────────────────────────

test("round-summary (a): after a settled round, #cb-summary sits between #cb-mid and #cb-act, its rows are roundSummary's texts, #cb-mid holds no log, and the label reads the round", () => {
  const { clock, doc, sandbox, w } = scenario();
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatEndMs(plan.texts, durationFor) + 64);
  assert.equal(w.__mzBeat.active(), false, "the beat has settled");

  const order = kids(encBody(doc)).map((el) => el.id || el.className);
  const midIdx = order.indexOf("cb-mid");
  const sumIdx = order.indexOf("cb-summary");
  const actIdx = order.indexOf("cb-act");
  assert.ok(midIdx !== -1 && sumIdx === midIdx + 1 && actIdx === sumIdx + 1, `order: ${order.join(" > ")}`);

  const expected = roundSummary(w.__mzFightLog);
  assert.deepEqual(stripRows(doc).map(rowText), expected.lines.map((l) => l.text));
  assert.equal(stripRows(doc).filter((r) => r.classList.contains("cb-sum-newest")).length, 1, "exactly one newest row");
  assert.ok(stripRows(doc).at(-1).classList.contains("cb-sum-newest"), "the newest is the last (bottom) row");

  const mid = doc.document.getElementById("cb-mid");
  assert.equal(mid.querySelectorAll(".cb-log-entry").length, 0, "the in-panel log left the middle (R-19)");
  assert.equal(mid.querySelector("#cb-log"), null);

  const s = strip(doc);
  assert.equal(s.querySelector(".cb-sum-label").textContent, fill(ROUND_STRIP_COPY.roundHappened, 3));
  assert.notEqual(s.querySelector(".cb-sum-label").dataset.busy, "1");
  assert.equal(s.querySelector(".cb-sum-chip").textContent, fill(ROUND_STRIP_COPY.fullLog, w.__mzFightLog.entries.length));
  assert.equal(s.getAttribute("aria-live"), null, "the strip is not a second live region");
});

// ─── (b) mid-beat: no spoilers ─────────────────────────────────────────────

test("round-summary (b): mid-beat, the rows are exactly the revealed lines, the label reads RESOLVING with data-busy=1, and the typed row is aria-hidden while it types", () => {
  const { clock, doc, sandbox, w } = scenario();
  const { plan, started, lines } = driveHandoff(sandbox, midFightRound());
  assert.ok(started);
  assert.equal(plan.count, 3);

  let rows = stripRows(doc);
  assert.equal(rows.length, 1, "only the first line has been revealed");
  const textEl = rows[0].querySelector(".cb-sum-text");
  assert.equal(textEl.children.length, 2, "the newest row types (typed+rest spans)");
  assert.equal(rowText(rows[0]), lines[0].text);
  assert.equal(rows[0].getAttribute("aria-hidden"), "true", "the typed row is aria-hidden while typing");
  const label = strip(doc).querySelector(".cb-sum-label");
  assert.equal(label.textContent, ROUND_STRIP_COPY.resolving);
  assert.equal(label.dataset.busy, "1");

  const offsets = beatOffsets(plan.texts, durationFor);
  clock.advance(offsets[1] + 1);
  rows = stripRows(doc);
  assert.equal(rows.length, 2, "the second line lands at its own offset, never before");
  assert.deepEqual(rows.map(rowText), [lines[0].text, lines[1].text]);
  assert.equal(rows[0].getAttribute("aria-hidden"), null, "an older row is never left hidden");
  assert.equal(rows[1].getAttribute("aria-hidden"), "true");
  assert.ok(!rows.map(rowText).includes(lines[2].text), "the unrevealed third line never shows");
});

// ─── (c) a tap on the strip mid-round skips (R-18) ─────────────────────────

test("round-summary (c): beatHurryTap with a target inside #cb-summary stops propagation, ends the beat and opens nothing (R-18)", () => {
  const { clock, doc, sandbox, w } = scenario();
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatOffsets(plan.texts, durationFor)[1] + 10);
  const target = stripRows(doc)[0];
  assert.ok(target, "a strip row to tap");
  // 71-06 gave the strip its guardTap-wired open-the-full-log tap; mid-round
  // the capture-phase skip below still stops the tap before it, and
  // encArmed() refuses it anyway (fight-log-sheet.test.js (c)).
  assert.equal(typeof strip(doc).onclick, "function", "the strip's open tap is wired (71-06)");

  let stopped = false;
  let prevented = false;
  sandbox.context.beatHurryTap({ target, stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } });
  assert.equal(stopped, true);
  assert.equal(prevented, true);
  assert.equal(w.__mzBeat.active(), false, "the round lands at once");
  assert.equal(stripRows(doc).length, 3, "every line of the round now shows");
  for (const r of stripRows(doc)) assert.equal(r.getAttribute("aria-hidden"), null, "none left typing");
  const order = kids(encBody(doc)).map((el) => el.id || el.className);
  assert.deepEqual(order.slice(-3), ["cb-mid", "cb-summary", "cb-act"], "the settle render is the plain combat screen");
  assert.equal(encBody(doc).querySelector("#cb-over"), null, "nothing else opened");
});

// ─── (d) many foes never push the strip off the actions ────────────────────

test("round-summary (d): a 4-foe fight still renders the strip as the sibling directly before #cb-act", () => {
  const { doc, sandbox, w } = scenario();
  const s = fixedState();
  s.combat = {
    foes: ["Wolf", "Rat", "Bat", "Toad"].map((name) => fixedFoe({ name })),
    type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  w.__mzState.set(s);
  w.__mzFightLog = appendFightLog(null, [{ text: "The wolf yawns at you.", tone: "narrative", roll: null }], 1);
  sandbox.context.renderEncounter();
  const order = kids(encBody(doc)).map((el) => el.id || el.className);
  assert.equal(doc.document.getElementById("cb-mid").querySelectorAll(".cb-foe").length, 4);
  assert.equal(order.indexOf("cb-summary") + 1, order.indexOf("cb-act"), `order: ${order.join(" > ")}`);
  assert.equal(order.indexOf("cb-mid") + 1, order.indexOf("cb-summary"));
  assert.deepEqual(stripRows(doc).map(rowText), ["The wolf yawns at you."]);
});

// ─── (e) no strip on the overlay; no stale lines in a new fight ────────────

test("round-summary (e): the pending overlay builds no strip, and a fresh fight after a finished one shows none of the old lines", () => {
  const { doc, sandbox, w } = scenario();
  const s = fixedState();
  s.combat = { foes: [fixedFoe({ name: "Wolf" })], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, first: "you", pending: true };
  w.__mzState.set(s);
  sandbox.context.renderEncounter();
  assert.equal(strip(doc), null, "the pending overlay has no strip");
  assert.equal(kids(encBody(doc)).some((el) => el.id === "cb-act"), false);

  // A finished fight clears the log (dispatchWithNarration's `= null`); the next fight starts clean.
  w.__mzFightLog = null;
  const s2 = fixedState();
  s2.combat = { foes: [fixedFoe({ name: "Newt" })], type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, first: "you" };
  w.__mzState.set(s2);
  sandbox.context.renderEncounter();
  assert.ok(strip(doc), "a live fight renders the strip");
  assert.equal(stripRows(doc).length, 0, "no previous fight's lines");
  assert.equal(strip(doc).querySelector(".cb-sum-chip").textContent, fill(ROUND_STRIP_COPY.fullLog, 0));
});

// ─── (f) the announcer still reads the whole round once ────────────────────

test("round-summary (f): #enc-round-live holds the whole round after the first beat render (D-16 unchanged)", () => {
  const { doc, sandbox } = scenario();
  const { lines } = driveHandoff(sandbox, midFightRound());
  assert.equal(stripRows(doc).length, 1);
  assert.equal(doc.document.getElementById("enc-round-live").textContent, lines.map((l) => l.text).join(" "));
});

// ─── source pins ───────────────────────────────────────────────────────────

function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  return CODE.slice(start, end === -1 ? CODE.length : end);
}

test("pins: the combat branch builds header -> cb-mid (foes, lot, no log) -> strip -> cb-act, and the log scroll gate is gone", () => {
  const start = CODE.indexOf("const V = bv ? bv.state : S;");
  const region = CODE.slice(start, CODE.indexOf("function noteCombat(", start));
  const i = (s) => region.indexOf(s);
  assert.ok(i("renderCombatHeader(body") < i('mid.id = "cb-mid"'));
  assert.ok(i("renderYourLot(mid") < i("body.appendChild(mid)"));
  assert.ok(i("body.appendChild(mid)") < i("renderRoundStrip(body"));
  assert.ok(i("renderRoundStrip(body") < i('act.id = "cb-act"'));
  assert.equal(i("renderFightLog(mid)"), -1, "the in-panel log left the middle (R-19)");
  assert.doesNotMatch(CODE, /lastLogSeqShown/, "nothing in the middle scrolls to a log any more");
});

test("pins: renderRoundStrip builds #cb-summary through createElement/textContent from __mzFightLogVM.summary and .copy, types the newest line through the fightlog typewriter, and adds no listener", () => {
  const region = fnRegion("function renderRoundStrip(host");
  assert.match(region, /window\.__mzFightLogVM\.summary\(/);
  assert.match(region, /window\.__mzFightLogVM\.copy/);
  assert.match(region, /\.id = "cb-summary"/);
  assert.match(region, /syncFightLogLive\(log\);/);
  assert.match(region, /__mzTypewriter\?\.type\?\.\("fightlog"/);
  assert.match(region, /__mzTypewriter\.adopt\("fightlog"/);
  assert.match(region, /__mzTypewriter\?\.cancel\?\.\("fightlog"\)/);
  assert.match(region, /lastBeatTypedId/);
  assert.doesNotMatch(region, /innerHTML/);
  assert.doesNotMatch(region, /onclick|addEventListener|aria-live/);
  for (const lit of ["WHAT HAPPENED", "RESOLVING", "FULL LOG"]) assert.ok(!region.includes(lit), `${lit} comes from ROUND_STRIP_COPY, never a shell literal`);
});

test("pins: the strip's CSS follows the mock — in the flow (flex:none, never absolute/fixed), a 78px bottom-aligned masked body, 14px bold lines, and #cb-mid still scrolls", () => {
  const rule = (sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = STYLE.match(new RegExp("(^|\\n)" + esc + "\\{([^}]*)\\}"));
    assert.ok(m, `${sel}{...} rule must exist`);
    return m[2];
  };
  const s = rule("#cb-summary");
  assert.match(s, /flex:none/);
  assert.match(s, /border-top:3px solid #3a3226/);
  assert.match(s, /background:#16120c/);
  assert.match(s, /padding:9px 12px 10px/);
  for (const m of STYLE.matchAll(/#cb-summary[^{]*\{([^}]*)\}/g)) assert.doesNotMatch(m[1], /position:(absolute|fixed)/, "the strip never overlays anything");
  const body = rule(".cb-sum-body");
  assert.match(body, /height:78px/);
  assert.match(body, /justify-content:flex-end/);
  assert.match(body, /overflow:hidden/);
  assert.match(body, /-webkit-mask-image:linear-gradient\(to bottom,transparent 0,#000 22px\)/);
  assert.match(body, /(^|;)mask-image:linear-gradient\(to bottom,transparent 0,#000 22px\)/);
  const line = rule(".cb-sum-line");
  assert.match(line, /font-size:14px/);
  assert.match(line, /font-weight:700/);
  assert.match(line, /line-height:1\.4/);
  assert.match(line, /color:#8f856f/);
  assert.match(rule(".cb-sum-line.cb-sum-newest"), /color:#e6ddc6/);
  assert.match(rule(".cb-sum-line.cb-sum-rise"), /animation:mwrise \.22s/);
  const label = rule(".cb-sum-label");
  assert.match(label, /color:#a89c82/);
  const busy = rule('.cb-sum-label[data-busy="1"]');
  assert.match(busy, /color:#e07260/);
  assert.match(busy, /animation:mwtorch \.9s steps\(2\) infinite/);
  assert.match(STYLE, /@keyframes mwtorch\{0%,100%\{opacity:\.9\}50%\{opacity:\.5\}\}/);
  const chip = rule(".cb-sum-chip");
  assert.match(chip, /font-size:6px/);
  assert.match(chip, /color:#8f856f/);
  const mid = rule(".cb-mid");
  assert.match(mid, /flex:1/);
  assert.match(mid, /overflow:auto/);
  assert.match(mid, /min-height:0/);
  // Reduced motion: the blanket rule drops the pulse and the rise.
  assert.match(STYLE, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
});

test("pins: 71-04's rail lift reads #cb-summary's top first, else #cb-act's, so the foe card covers neither the strip nor the actions", () => {
  const start = CODE.indexOf("function renderRail()");
  const region = CODE.slice(start, CODE.indexOf("\nfunction ", start + 10));
  const sumIdx = region.indexOf('getElementById("cb-summary")');
  const actIdx = region.indexOf('getElementById("cb-act")');
  assert.ok(sumIdx !== -1 && actIdx !== -1 && sumIdx < actIdx, "the strip is measured first, #cb-act is the fallback");
  assert.match(region, /--mw-rail-lift/);
});

test("pins: window.__mzFightLogVM bridges summary: roundSummary and copy: ROUND_STRIP_COPY (module and sandbox mirror)", () => {
  assert.match(CODE, /window\.__mzFightLogVM = \{[^}]*summary: roundSummary[^}]*copy: ROUND_STRIP_COPY[^}]*\}/);
  const sandboxSrc = fs.readFileSync(path.join(REPO_ROOT, "test", "unit", "harness", "shellSandbox.js"), "utf8");
  assert.match(sandboxSrc, /w\.__mzFightLogVM = \{[^}]*summary: roundSummary[^}]*copy: ROUND_STRIP_COPY[^}]*\}/);
});

// ─── (g) the rise plays once per new newest line ───────────────────────────

test("round-summary (g): the newest line rises in when it is new, and a same-round re-render (a submenu toggle) does not replay the rise", () => {
  const { doc, sandbox, w } = scenario();
  const s = fixedState();
  s.combat = { foes: [fixedFoe({ name: "Wolf" })], type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you" };
  w.__mzState.set(s);
  w.__mzFightLog = appendFightLog(null, [{ text: "One.", tone: "narrative", roll: null }], 1);
  sandbox.context.renderEncounter();
  assert.ok(stripRows(doc).at(-1).classList.contains("cb-sum-rise"), "a new newest line rises");
  sandbox.context.renderEncounter();
  assert.equal(stripRows(doc).at(-1).classList.contains("cb-sum-rise"), false, "a re-render of the same round does not rise again");
  w.__mzFightLog = appendFightLog(w.__mzFightLog, [{ text: "Two.", tone: "narrative", roll: null }], 2);
  sandbox.context.renderEncounter();
  const rows = stripRows(doc);
  assert.deepEqual(rows.map(rowText), ["Two."], "the latest round only");
  assert.ok(rows[0].classList.contains("cb-sum-rise"));
});
