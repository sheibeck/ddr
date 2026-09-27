// test/unit/fight-log-oldest-row.test.js
//
// Phase 77 (CMBUI-12), Plan 06 — the oldest (last) row of THE FIGHT SO FAR
// can be tapped to reveal its roll like every other row. The user's
// 2026-09-24 device report: the entry nearest the bottom of the fight log
// could not be tapped to show its dice.
//
// Reproduction (a): a hero steps onto a dot square whose encounter table
// raises a fight, taps Fight!, and plays rounds; the move, the Fight! step
// and each round are appended to the fight log exactly as the shell's
// dispatchWithNarration routes them (the move's post state holds a pending
// combat, so its lines join the log at the combat's round, ROUND 1). The
// oldest row of the sheet is that move's encounter-start line. Its own
// event (encounterStarted) carries no <span class="roll">, and the table
// dice that raised the fight sit on the SAME action's encounterRolled event,
// which is ORACLE_ONLY and never has a line of its own. At the plan base the
// entry's roll was null, so renderFightLog gave the row no tap handler (R-23)
// and the tap did nothing: that is the reported bug. fightLogLinesFor now
// gives the encounter-start line the Oracle detail of the same action's
// encounterRolled events that precede it.
//
// The sandbox helpers follow fight-log-sheet.test.js (test files are
// module-local, so they are copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog, dullFightLogLine, emptyFightLog } from "../../src/browser/fightLog.js";
import { narrateEvent } from "../../src/browser/eventNarration.js";
import { oracleDetailText } from "../../src/browser/narrationLines.js";
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);
const STYLE = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// ─── fixtures (the fixed hero/floor shape of fight-log-sheet.test.js) ───────

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

/** fixedState(rngState) — a 3x3 lit floor, the hero in the middle, a dot square to the north. */
function fixedState(rngState) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  g[0][1].feat = "dot";
  return {
    version: 1, seed: 1, rngState,
    c: fixedFighter(),
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
  };
}

function scenario() {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  return { doc, sandbox, w: sandbox.context.window, ctx: sandbox.context };
}

/**
 * dispatch(w, action) — one engine action through the fight-log routing of
 * mazeworld.html#dispatchWithNarration: when the post state holds a combat,
 * the action's fightLogLinesFor lines join the log at `roundBefore ??
 * combat.round`. Returns the engine result.
 */
function dispatch(w, action) {
  const before = w.__mzState.get();
  const roundBefore = before && before.combat ? before.combat.round : null;
  const result = applyAction(before, action);
  w.__mzState.set(result.state);
  if (result.state.combat) {
    const lines = fightLogLinesFor(action.type, result.events, {});
    if (lines.length) w.__mzFightLog = appendFightLog(w.__mzFightLog, lines, roundBefore ?? result.state.combat.round);
  }
  return result;
}

/** firstTileEncounter() — the first rngState whose step onto the dot raises a fight. */
function firstTileEncounter() {
  for (let s = 1; s < 500; s++) {
    const { state, events } = applyAction(fixedState(s), { type: "move", dir: "N" });
    if (state.combat && events.some((e) => e.type === "encounterRolled") && events.some((e) => e.type === "encounterStarted")) return s;
  }
  throw new Error("no tile encounter found");
}

/** firstCampAmbush() — the first rngState whose camp is disturbed into a fight. */
function firstCampAmbush() {
  for (let s = 1; s < 500; s++) {
    const { state, events } = applyAction(fixedState(s), { type: "camp" });
    if (state.combat && events.some((e) => e.type === "wanderingMonster")) return s;
  }
  throw new Error("no camp ambush found");
}

const byId = (doc, id) => doc.document.getElementById(id);
const sheetRows = (doc) => byId(doc, "mw-fightlog-sheet-rows");
const entries = (doc) => Array.from(sheetRows(doc).querySelectorAll(".cb-log-entry"));
const entryText = (el) => el.querySelector(".cb-log-text").textContent;
const entryOf = (w, el) => w.__mzFightLog.entries.find((e) => e.id === Number(el.dataset.logId));

// ─── (a) the reproduction: a tile-started fight ─────────────────────────────

test("CMBUI-12 (a): the oldest row of a tile-started fight is the encounter start, and it reveals the table dice that raised the fight", () => {
  const { doc, w, ctx } = scenario();
  const seed = firstTileEncounter();
  w.__mzState.set(fixedState(seed));
  const moved = dispatch(w, { type: "move", dir: "N" });
  assert.equal(moved.state.combat.pending, true, "the step raised a pending fight (the Fight! gate)");
  dispatch(w, { type: "fight" });
  for (let r = 0; r < 2 && w.__mzState.get().combat && !w.__mzState.get().dead; r++) dispatch(w, { type: "attack" });
  assert.ok(w.__mzState.get().combat, "the fight is still running, so the sheet can open");

  ctx.openFightLogSheet();
  assert.equal(ctx.fightLogSheetOpen(), true);
  const rows = entries(doc);
  assert.ok(rows.length >= 3, "the move, the Fight! step and the rounds are all logged");
  const oldest = rows[rows.length - 1];
  const entry = entryOf(w, oldest);
  assert.equal(entry.id, w.__mzFightLog.entries[0].id, "the last row of the sheet is the log's first entry");

  // The oldest row is the move's encounter-start line (its first line).
  const startedEv = moved.events.find((e) => e.type === "encounterStarted");
  const moveLines = fightLogLinesFor("move", moved.events, {});
  assert.equal(entryText(oldest), moveLines[0].text);
  for (const f of startedEv.foes) assert.match(entryText(oldest), new RegExp(f.name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")));

  // Its roll is the same action's encounter-table dice, exactly.
  const rolled = moved.events.filter((e) => e.type === "encounterRolled");
  const expected = rolled.map((e) => oracleDetailText(narrateEvent(e))).join(" · ");
  assert.match(expected, /^Table \d, roll \d+:/);
  assert.equal(entry.roll, expected, "the encounter-start entry carries the table dice");

  // A tap reveals it, a second tap hides it.
  const roll = oldest.querySelector(".cb-log-roll");
  assert.ok(roll, "the oldest row has a roll line");
  assert.equal(roll.textContent, expected);
  assert.equal(typeof oldest.onclick, "function", "the oldest row carries the tap handler");
  assert.equal(oldest.getAttribute("role"), "button");
  assert.equal(roll.hidden, true);
  oldest.onclick();
  assert.equal(roll.hidden, false, "the first tap reveals the dice");
  assert.equal(oldest.getAttribute("aria-expanded"), "true");
  assert.equal(entryOf(w, oldest).show, true);
  oldest.onclick();
  assert.equal(roll.hidden, true, "a second tap hides them");
  assert.equal(oldest.getAttribute("aria-expanded"), "false");
});

// ─── (b) a camp ambush: the wandering row reveals its own dice ──────────────

test("CMBUI-12 (b): a camp ambush's disturbed-camp row reveals its night-hours; dice-less camp lines stay plain", () => {
  const { doc, w, ctx } = scenario();
  w.__mzState.set(fixedState(firstCampAmbush()));
  const camped = dispatch(w, { type: "camp" });
  assert.ok(camped.events.some((e) => e.type === "wanderingMonster"));
  assert.ok(!camped.events.some((e) => e.type === "encounterRolled"), "a wandering fight rolls no encounter table");

  ctx.openFightLogSheet();
  const rows = entries(doc);
  const byText = (re) => rows.find((el) => re.test(entryText(el)));

  const wander = rows.find((el) => entryOf(w, el).roll && /night-hours disturbed/.test(entryOf(w, el).roll));
  assert.ok(wander, "the disturbed-camp row carries its own dice");
  assert.equal(typeof wander.onclick, "function");
  wander.onclick();
  assert.equal(wander.querySelector(".cb-log-roll").hidden, false);

  // The rations line has no dice in its own events: plain, no handler (R-23).
  const rations = byText(/^Rations/);
  assert.ok(rations, "the camp's rations line is logged with the fight");
  assert.equal(entryOf(w, rations).roll, null);
  assert.equal(rations.onclick ?? null, null);
  assert.equal(rations, rows[rows.length - 1], "recorded: in a camp ambush the oldest row is the dice-less rations line");

  // The wandering encounter start has no encounterRolled in its action, so nothing is invented for it.
  const start = rows.find((el) => /^Wandering/.test(entryText(el)));
  assert.ok(start);
  assert.equal(entryOf(w, start).roll, null);
  assert.equal(start.onclick ?? null, null);
});

// ─── (c) no dice anywhere: plain ────────────────────────────────────────────

test("CMBUI-12 (c): a line whose action carries no dice anywhere keeps roll null and no handler", () => {
  const { doc, w, ctx } = scenario();
  const seed = firstTileEncounter();
  w.__mzState.set(applyAction(fixedState(seed), { type: "move", dir: "N" }).state);
  w.__mzFightLog = appendFightLog(null, [dullFightLogLine("You cannot run from here.")], 1);
  ctx.openFightLogSheet();
  const rows = entries(doc);
  assert.equal(rows.length, 1);
  assert.equal(entryOf(w, rows[0]).roll, null);
  assert.equal(rows[0].onclick ?? null, null);
  assert.equal(rows[0].querySelector(".cb-log-roll"), null);
  assert.equal(byId(doc, "mw-fightlog-sheet-hint").hidden, true, "no roll anywhere: no dice hint");
});

// ─── (d) a single row, straight under ROUND 1 ───────────────────────────────

test("CMBUI-12 (d): when the oldest row is the only row, under its ROUND 1 header, a tap toggles only that row", () => {
  const { doc, w, ctx } = scenario();
  w.__mzState.set(fixedState(firstTileEncounter()));
  dispatch(w, { type: "move", dir: "N" });
  ctx.openFightLogSheet();
  const heads = Array.from(sheetRows(doc).querySelectorAll(".mw-fl-round")).map((h) => h.textContent);
  assert.deepEqual(heads, ["ROUND 1"]);
  const rows = entries(doc);
  assert.equal(rows.length, 1, "only the encounter start is logged");
  assert.equal(byId(doc, "mw-fightlog-sheet-hint").hidden, false, "its dice make the hint show");
  const before = JSON.stringify(w.__mzFightLog.entries.map((e) => ({ ...e, show: undefined })));
  rows[0].onclick();
  assert.equal(rows[0].querySelector(".cb-log-roll").hidden, false);
  assert.equal(w.__mzFightLog.entries[0].show, true);
  assert.equal(JSON.stringify(w.__mzFightLog.entries.map((e) => ({ ...e, show: undefined }))), before, "nothing else in the log changed");
  rows[0].onclick();
  assert.equal(rows[0].querySelector(".cb-log-roll").hidden, true);
});

// ─── (e) an empty log ───────────────────────────────────────────────────────

test("CMBUI-12 (e): an empty log shows no rows and no dice hint, and never throws", () => {
  for (const log of [null, emptyFightLog()]) {
    const { doc, w, ctx } = scenario();
    w.__mzState.set(applyAction(fixedState(firstTileEncounter()), { type: "move", dir: "N" }).state);
    w.__mzFightLog = log;
    assert.doesNotThrow(() => ctx.openFightLogSheet());
    assert.equal(entries(doc).length, 0);
    assert.equal(byId(doc, "mw-fightlog-sheet-hint").hidden, true);
  }
});

// ─── (f) revealing scrolls the dice into view ───────────────────────────────

test("CMBUI-12 (f): revealing a row scrolls its roll line into view (block nearest); hiding does not; a DOM without the method never throws", () => {
  const { doc, w, ctx } = scenario();
  w.__mzState.set(fixedState(firstTileEncounter()));
  dispatch(w, { type: "move", dir: "N" });
  dispatch(w, { type: "fight" });
  ctx.openFightLogSheet();
  const rows = entries(doc);
  const oldest = rows[rows.length - 1];
  const roll = oldest.querySelector(".cb-log-roll");
  const calls = [];
  roll.scrollIntoView = (opts) => calls.push(opts);
  oldest.onclick();
  assert.deepEqual(calls, [{ block: "nearest" }], "the reveal scrolls the dice line into view");
  oldest.onclick();
  assert.equal(calls.length, 1, "hiding never scrolls");

  const other = rows[0].querySelector(".cb-log-roll");
  assert.ok(other, "the Fight! step's initiative line carries dice too");
  other.scrollIntoView = undefined;
  assert.doesNotThrow(() => rows[0].onclick());
  assert.equal(other.hidden, false);

  const region = CODE.slice(CODE.indexOf("function renderFightLog(host)"), CODE.indexOf("\nfunction ", CODE.indexOf("function renderFightLog(host)") + 10));
  assert.match(region, /roll\.scrollIntoView\?\.\(\{ block: "nearest" \}\)/);
});

// ─── (g) the rows clear the gesture area ────────────────────────────────────

test("CMBUI-12 (g) CSS: the rows list keeps bottom room of at least a row plus the safe-area inset", () => {
  const m = STYLE.match(/\.mw-fl-rows\{([^}]*)\}/);
  assert.ok(m, ".mw-fl-rows{...} rule must exist");
  assert.match(m[1], /overflow-y:auto/);
  const pb = /padding-bottom:calc\((\d+)px \+ var\(--safe-area-inset-bottom, env\(safe-area-inset-bottom, 0px\)\)\)/.exec(m[1]);
  assert.ok(pb, `the bottom padding adds the safe-area inset: ${m[1]}`);
  assert.ok(Number(pb[1]) >= 48, "at least a row's height (the 48px touch target) of bottom room");
});

// ─── fightLogLinesFor: the encounter-start roll rule, unit cases ────────────

const rolledEv = (table, roll, result) => ({ type: "encounterRolled", table, roll, result });
const startedEv = (name) => ({ type: "encounterStarted", foes: [{ name }] });
const detail = (e) => oracleDetailText(narrateEvent(e));

test("CMBUI-12 unit: the encounter-start line takes the same action's preceding encounterRolled dice", () => {
  const r = rolledEv(3, 7, "Humans");
  const lines = fightLogLinesFor("move", [{ type: "moved" }, r, startedEv("Ned")]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].roll, detail(r));
  assert.equal(lines[0].roll, "Table 3, roll 7: The dice decide — Humans.");
});

test("CMBUI-12 unit: nothing is invented — no encounterRolled, or only one after the start, leaves the start plain", () => {
  assert.equal(fightLogLinesFor("move", [startedEv("Ned")])[0].roll, null);
  assert.equal(fightLogLinesFor("camp", [{ type: "wanderingMonster", hours: 1 }, startedEv("Ned")]).find((l) => /Ned/.test(l.text)).roll, null);
  const after = fightLogLinesFor("move", [startedEv("Ned"), rolledEv(1, 1, "Beasts")]);
  assert.equal(after[0].roll, null, "a roll that comes after the start never raised it");
});

test("CMBUI-12 unit: a second encounter in one action takes only the rolls since the first", () => {
  const r1 = rolledEv(2, 4, "Beasts");
  const r2 = rolledEv(5, 9, "Demons");
  const lines = fightLogLinesFor("move", [r1, startedEv("Zit"), { type: "combatEnded" }, r2, startedEv("Imp")]);
  const zit = lines.find((l) => /Zit/.test(l.text));
  const imp = lines.find((l) => /Imp/.test(l.text));
  assert.equal(zit.roll, detail(r1));
  assert.equal(imp.roll, detail(r2));
});

test("CMBUI-12 unit: several table rolls before one start are joined in order with ' · '", () => {
  const r1 = rolledEv(4, 2, "Teleport");
  const r2 = rolledEv(1, 6, "Beasts");
  const lines = fightLogLinesFor("move", [r1, r2, startedEv("Zit")]);
  assert.equal(lines.find((l) => /Zit/.test(l.text)).roll, `${detail(r1)} · ${detail(r2)}`);
});
