// test/unit/fight-log-sheet.test.js
//
// Phase 71 (POLISH-07; D-07, with D-06's skip), Plan 06 — THE FIGHT SO FAR,
// the full-log bottom sheet the what-happened strip opens (the user's combat
// v2 mock, design/COMBAT-V2-NOTES.md section 5 and the showLog block of
// design/Mazeworld Combat Panel v2.dc.html).
//
// R-22: the sheet is a body-level member of the .mw-legend-sheet family
// (#mw-fightlog-sheet), opened and closed through the shared panel-motion
// helper, styled to the mock (scrim rgba(10,8,6,.72), max-height 74%).
// R-23: a line reveals exactly the roll its fight-log entry carries (the
// engine event's own Oracle detail text); a line with no roll is plain.
// R-18 holds: mid-round a strip tap is beatHurryTap's skip; the strip's own
// open handler is guardTap-wired, so encArmed() refuses it mid-beat too.
//
// Sandbox proofs (a)-(f) drive the REAL renderEncounter through REAL
// resolved rounds and the REAL beat runner on a fake clock (the
// midFightRound / driveHandoff helpers are copied from
// round-summary-band.test.js); source pins cover the markup, the CSS, the
// closeModal order and the render-region discipline.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog, dullFightLogLine, fightLogByRound, ROUND_STRIP_COPY } from "../../src/browser/fightLog.js";
import { planBeat, beatEndMs } from "../../src/browser/combatBeat.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);
const STYLE = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

// ─── fixtures (copied from round-summary-band.test.js) ──────────────────────

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

/** firstRound() — the real rngState-32 round combat-beat-shell uses: three folded lines, no ending. */
function firstRound() {
  const before = fixedState({ rngState: 32 });
  before.combat = {
    foes: [fixedFoe({ name: "Goblin Grunt", wp: 1, maxWP: 10 }), fixedFoe({ name: "Cave Rat", wp: 40, maxWP: 40 })],
    type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const { state: after, events } = applyAction(before, { type: "attack" });
  return { before, after, events };
}

/** nextRound(prev) — a second real attack round from the first round's result. */
function nextRound(prev) {
  const before = structuredClone(prev.after);
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
  return { clock, doc, sandbox, w: sandbox.context.window, ctx: sandbox.context };
}

/** twoSettledRounds() — two real rounds, each played out to its settle, then past the arm window. */
function twoSettledRounds() {
  const scn = scenario();
  const r1 = firstRound();
  const h1 = driveHandoff(scn.sandbox, r1);
  scn.clock.advance(beatEndMs(h1.plan.texts, durationFor) + 64);
  const r2 = nextRound(r1);
  assert.ok(r2.after.combat, "the second round leaves the fight running");
  const h2 = driveHandoff(scn.sandbox, r2);
  scn.clock.advance(beatEndMs(h2.plan.texts, durationFor) + 64);
  assert.equal(scn.w.__mzBeat.active(), false, "both rounds have settled");
  scn.clock.advance(400); // past the 250ms arm window of the settle render
  return { ...scn, r1, r2 };
}

const byId = (doc, id) => doc.document.getElementById(id);
const encBody = (doc) => byId(doc, "enc-body");
const kids = (el) => el.children.filter((c) => c.nodeType !== 3);
const strip = (doc) => kids(encBody(doc)).find((el) => el.id === "cb-summary") || null;
const sheetRows = (doc) => byId(doc, "mw-fightlog-sheet-rows");
const headers = (doc) => Array.from(sheetRows(doc).querySelectorAll(".mw-fl-round")).map((h) => h.textContent);
const entries = (doc) => Array.from(sheetRows(doc).querySelectorAll(".cb-log-entry"));
const entryText = (el) => el.querySelector(".cb-log-text").textContent;
const fill = (tpl, n) => tpl.replace("{n}", String(n));

// ─── (a) the strip opens the sheet, grouped by round, newest first ─────────

test("fight-log sheet (a): after two settled rounds, the strip's tap opens THE FIGHT SO FAR, ROUND n headers newest first, entries newest first", () => {
  const { doc, w, ctx } = twoSettledRounds();
  const s = strip(doc);
  assert.ok(s, "the strip is on the combat screen");
  assert.equal(typeof s.onclick, "function", "the strip carries its guarded open tap");
  assert.equal(s.getAttribute("role"), "button");
  assert.equal(s.tabIndex, 0);
  assert.equal(s.getAttribute("aria-label"), ROUND_STRIP_COPY.openLog);
  assert.equal(ctx.fightLogSheetOpen(), false, "the sheet starts closed");

  s.onclick();
  assert.equal(ctx.fightLogSheetOpen(), true, "the strip tap opened the sheet");
  assert.equal(byId(doc, "mw-fightlog-sheet").hidden, false);
  assert.equal(byId(doc, "mw-fightlog-sheet-title").textContent, ROUND_STRIP_COPY.sheetTitle);
  assert.equal(byId(doc, "mw-fightlog-sheet-close").textContent, ROUND_STRIP_COPY.close);

  const groups = fightLogByRound(w.__mzFightLog);
  assert.equal(groups.length, 2, "two rounds of log");
  assert.deepEqual(headers(doc), groups.map((g) => fill(ROUND_STRIP_COPY.roundHead, g.round)));
  assert.ok(groups[0].round > groups[1].round, "the newest round is first");
  const expected = groups.flatMap((g) => g.entries.map((e) => e.text));
  assert.deepEqual(entries(doc).map(entryText), expected, "every line of the fight, newest first within each round");
  assert.equal(entries(doc).length, w.__mzFightLog.entries.length, "the WHOLE log, not the strip's last 3");
  assert.equal(byId(doc, "mw-fightlog-sheet").getAttribute("aria-live"), null, "the sheet is not a live region");
});

// ─── (b) the dice reveal is honest (R-23) ──────────────────────────────────

test("fight-log sheet (b): a line with a roll toggles its gold roll line on tap and off on a second tap; a line without one has no handler; the hint shows only when some line has a roll", () => {
  const { doc, w, ctx } = twoSettledRounds();
  // A plain refusal line in the latest round (no roll to reveal).
  w.__mzFightLog = appendFightLog(w.__mzFightLog, [dullFightLogLine("You cannot run from here.")], w.__mzState.get().combat.round);
  strip(doc).onclick();
  assert.equal(ctx.fightLogSheetOpen(), true);

  const rows = entries(doc);
  const withRoll = rows.filter((el) => el.querySelector(".cb-log-roll"));
  const noRoll = rows.filter((el) => !el.querySelector(".cb-log-roll"));
  assert.ok(withRoll.length >= 1, "a real round carries at least one roll");
  assert.ok(noRoll.length >= 1, "the refusal carries none");
  assert.equal(byId(doc, "mw-fightlog-sheet-hint").hidden, false, "the dice hint shows");
  assert.equal(byId(doc, "mw-fightlog-sheet-hint").textContent, ROUND_STRIP_COPY.diceHint);

  const row = withRoll[0];
  const id = Number(row.dataset.logId);
  const entry = w.__mzFightLog.entries.find((e) => e.id === id);
  const roll = row.querySelector(".cb-log-roll");
  assert.equal(roll.textContent, entry.roll, "the reveal is exactly the entry's own roll");
  assert.equal(roll.hidden, true, "hidden until tapped");
  assert.equal(row.tabIndex, 0, "a revealable line is tabbable");
  row.onclick();
  assert.equal(roll.hidden, false, "the first tap reveals it");
  assert.equal(w.__mzFightLog.entries.find((e) => e.id === id).show, true, "through __mzFightLogVM.toggle on __mzFightLog");
  row.onclick();
  assert.equal(roll.hidden, true, "a second tap hides it");
  assert.equal(w.__mzFightLog.entries.find((e) => e.id === id).show, false);

  for (const el of noRoll) {
    assert.equal(el.onclick ?? null, null, "a line with no roll gets no handler (nothing invented)");
    assert.ok(!el.classList.contains("cb-log-revealable"));
  }
  assert.equal(noRoll.map(entryText)[0], "You cannot run from here.");

  // A log with no roll anywhere: no hint.
  ctx.closeFightLogSheet();
  w.__mzFightLog = appendFightLog(null, [dullFightLogLine("Nothing to see.")], 1);
  ctx.openFightLogSheet();
  assert.equal(ctx.fightLogSheetOpen(), true);
  assert.equal(byId(doc, "mw-fightlog-sheet-hint").hidden, true, "no roll anywhere: no dice hint");
});

// ─── (c) never mid-round (R-18, D-06) ──────────────────────────────────────

test("fight-log sheet (c): mid-beat the strip's onclick opens nothing (encArmed false) and openFightLogSheet() is a no-op; beatHurryTap still skips first", () => {
  const { clock, doc, sandbox, w, ctx } = scenario();
  const { plan, started } = driveHandoff(sandbox, firstRound());
  assert.ok(started);
  clock.advance(400);
  assert.equal(w.__mzBeat.active(), true, "the round is still resolving");
  const s = strip(doc);
  assert.equal(typeof s.onclick, "function");
  assert.equal(ctx.encArmed(), false, "encArmed refuses mid-beat");
  s.onclick();
  assert.equal(ctx.fightLogSheetOpen(), false, "a mid-round strip tap never opens the sheet");
  ctx.openFightLogSheet();
  assert.equal(ctx.fightLogSheetOpen(), false, "openFightLogSheet is a no-op while a beat is live");
  assert.equal(sheetRows(doc).children.length, 0, "nothing was rendered into the sheet");

  let stopped = false;
  ctx.beatHurryTap({ target: s, stopPropagation: () => { stopped = true; }, preventDefault: () => {} });
  assert.equal(stopped, true, "the capture-phase skip still stops the tap first");
  assert.equal(w.__mzBeat.active(), false, "the round lands");
  assert.equal(ctx.fightLogSheetOpen(), false, "and the skip opened nothing");
  clock.advance(beatEndMs(plan.texts, durationFor));
});

// ─── (d) CLOSE and the scrim close it; the panel does not ──────────────────

test("fight-log sheet (d): CLOSE and a scrim tap close the sheet; the panel carries no close handler", () => {
  const { clock, doc, ctx } = twoSettledRounds();
  strip(doc).onclick();
  assert.equal(ctx.fightLogSheetOpen(), true);
  assert.equal(byId(doc, "mw-fightlog-sheet-panel").onclick ?? null, null, "a tap inside the panel does not close it");
  byId(doc, "mw-fightlog-sheet-close").onclick();
  assert.equal(ctx.fightLogSheetOpen(), false, "CLOSE closes it");
  clock.advance(400);
  assert.equal(byId(doc, "mw-fightlog-sheet").hidden, true, "hidden once the shared close finishes");

  clock.advance(400);
  strip(doc).onclick();
  assert.equal(ctx.fightLogSheetOpen(), true, "it reopens");
  byId(doc, "mw-fightlog-sheet-scrim").onclick();
  assert.equal(ctx.fightLogSheetOpen(), false, "a scrim tap closes it");
  clock.advance(400);
  assert.equal(byId(doc, "mw-fightlog-sheet").hidden, true);
});

// ─── (e) Android back: the sheet's early return ────────────────────────────

test("fight-log sheet (e): closeModal closes the sheet with an early return after the ☰ return and before the Gear sheet; hasOpenModal lists it", () => {
  const region = sliceBetween(CODE, "closeModal: () => {", "navigateBack:");
  assert.match(region, /if \(fightLogSheetOpen\(\)\) \{ closeFightLogSheet\(\); return; \}/);
  const menuIdx = region.indexOf('if (hudMenuIsOpen()) { hudMenuEvent("escape"); return; }');
  const sheetIdx = region.indexOf("if (fightLogSheetOpen())");
  const gearIdx = region.indexOf("if (gearSheetTarget !== null)");
  assert.ok(menuIdx !== -1 && sheetIdx !== -1 && gearIdx !== -1);
  assert.ok(menuIdx < sheetIdx && sheetIdx < gearIdx, "☰ first, then the fight-log sheet, then the Gear sheet");
  const ctxRegion = sliceBetween(CODE, "getGameContext: () => ({", "closeModal: () => {");
  assert.match(ctxRegion, /hasOpenModal:[^\n]*fightLogSheetOpen\(\)/);
});

// ─── (f) the encounter ending closes it ────────────────────────────────────

test("fight-log sheet (f): an encounter that ends closes an open sheet", () => {
  const { doc, w, ctx } = twoSettledRounds();
  strip(doc).onclick();
  assert.equal(ctx.fightLogSheetOpen(), true);
  const s = structuredClone(w.__mzState.get());
  s.combat = null;
  w.__mzState.set(s);
  w.__mzFightLog = null;
  ctx.renderEncounter();
  assert.equal(ctx.fightLogSheetOpen(), false, "the sheet closed with the encounter");
});

// ─── source pins: markup, CSS, wiring ──────────────────────────────────────

test("markup: #mw-fightlog-sheet is a hidden .mw-legend-sheet with a scrim, a dialog panel named The fight so far, a head (title, hint, CLOSE) and a rows container", () => {
  const markup = sliceBetween(HTML, '<div id="mw-fightlog-sheet"', "\n</div>\n");
  assert.match(markup, /^<div id="mw-fightlog-sheet" class="mw-legend-sheet mw-fightlog-sheet" hidden>/);
  assert.match(markup, /<div class="mw-legend-scrim" id="mw-fightlog-sheet-scrim"><\/div>/);
  assert.match(markup, /id="mw-fightlog-sheet-panel" role="dialog" aria-modal="true" aria-label="The fight so far"/);
  assert.match(markup, /id="mw-fightlog-sheet-title" tabindex="-1"/);
  assert.match(markup, /id="mw-fightlog-sheet-hint" hidden/);
  assert.match(markup, /<button type="button" class="mw-fl-close" id="mw-fightlog-sheet-close"><\/button>/);
  assert.match(markup, /id="mw-fightlog-sheet-rows"/);
  assert.doesNotMatch(markup, /aria-live/, "the sheet is not a live region (#enc-round-live stays the one announcer)");
  const scrimIdx = markup.indexOf("mw-fightlog-sheet-scrim");
  const panelIdx = markup.indexOf("mw-fightlog-sheet-panel");
  assert.ok(scrimIdx < panelIdx, "the scrim is the panel's sibling, never its ancestor");
  // It sits with the other legend sheets, outside #enc-panel.
  const encIdx = HTML.indexOf('id="enc-panel"');
  const encEnd = HTML.indexOf("</section>", encIdx);
  const sheetIdx = HTML.indexOf('<div id="mw-fightlog-sheet"');
  assert.ok(sheetIdx > encEnd || sheetIdx < encIdx, "the sheet is body-level, not inside #enc-panel");
});

test("CSS: the mock's scrim and 74% panel, the head/chip/ROUND n styles, the gold roll; no motion of its own, no aria-disabled", () => {
  const rule = (sel) => {
    const m = STYLE.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}"));
    assert.ok(m, `${sel}{...} rule must exist`);
    return m[1];
  };
  assert.match(rule("#mw-fightlog-sheet .mw-legend-scrim"), /background:rgba\(10,8,6,\.72\)/);
  const panel = rule("#mw-fightlog-sheet .mw-legend-panel");
  assert.match(panel, /max-height:74%/);
  assert.match(panel, /display:flex/);
  assert.match(panel, /flex-direction:column/);
  const title = rule(".mw-fl-title");
  assert.match(title, /font-size:7px/);
  assert.match(title, /#e8c97a/);
  const hint = rule(".mw-fl-hint");
  assert.match(hint, /font-size:6px/);
  assert.match(hint, /#8f856f/);
  const close = rule(".mw-fl-close");
  assert.match(close, /font-size:7px/);
  assert.match(close, /border:2px solid #4a4032/);
  const rows = rule(".mw-fl-rows");
  assert.match(rows, /overflow-y:auto/);
  assert.match(rows, /min-height:0/);
  assert.ok(rule(".mw-fl-round").length > 0);
  // The roll line is the existing gold .cb-log-roll (shell-fight-log pins its values).
  assert.match(rule(".cb-log-roll"), /#e8c97a/);
  const sheetCss = STYLE.split("\n").filter((l) => /mw-fightlog-sheet|mw-fl-/.test(l)).join("\n");
  assert.doesNotMatch(sheetCss, /transition|animation/, "no motion beyond the family's own");
  assert.doesNotMatch(STYLE, /aria-disabled/);
});

test("wiring: renderRoundStrip guards the strip's open tap; CLOSE and the scrim are wired once, outside the render region; renderFightLog builds the sheet rows", () => {
  const strip = fnRegion("function renderRoundStrip(host, fallbackRound)");
  assert.match(strip, /guardTap\(strip, openFightLogSheet\);/);
  assert.match(strip, /strip\.setAttribute\("role", "button"\);/);
  assert.match(strip, /strip\.tabIndex = 0;/);
  assert.match(strip, /strip\.setAttribute\("aria-label", copy\.openLog\);/);

  const closeHits = CODE.match(/getElementById\("mw-fightlog-sheet-close"\)\.onclick = closeFightLogSheet;/g) || [];
  const scrimHits = CODE.match(/getElementById\("mw-fightlog-sheet-scrim"\)\.onclick = closeFightLogSheet;/g) || [];
  assert.equal(closeHits.length, 1, "CLOSE wired exactly once");
  assert.equal(scrimHits.length, 1, "the scrim wired exactly once");
  const render = sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
  assert.doesNotMatch(render, /mw-fightlog-sheet-(close|scrim)/, "neither is wired inside the render region");

  const open = fnRegion("function openFightLogSheet()");
  assert.match(open, /if \(window\.__mzBeat\?\.active\?\.\(\)\) return;/, "R-18: a no-op mid-round");
  assert.match(open, /renderFightLog\(/);
  assert.match(open, /showPanel\(/);
  const close = fnRegion("function closeFightLogSheet()");
  assert.match(close, /hidePanel\(/);

  const inactive = sliceBetween(CODE, "if (encWasActive && !active) {", "encWasActive = active;");
  assert.match(inactive, /if \(fightLogSheetOpen\(\)\) closeFightLogSheet\(\);/, "the encounter ending closes the sheet");

  const bridge = CODE.match(/window\.__mzFightLogVM = \{[^}]*\}/);
  assert.ok(bridge && /byRound: fightLogByRound/.test(bridge[0]), "__mzFightLogVM gains byRound");
});
