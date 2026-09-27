// test/unit/hazard-card.test.js
//
// Phase 78 (CLIMB-01/02), plan 78-03: the pre-roll wall/crevice decision
// card on the rail. src/browser/hazardCard.js#hazardCardViewModel builds the
// whole card (title, lines, odds, ordered buttons) from the engine's own
// pending record (`state.pendingHazard`, set by a real `move` through
// applyAction) and the engine's own odds (engine/movement.js#hazardOdds, via
// src/browser/rollOdds.js#hazardOddsText). Every state here is a real engine
// state: a golden base from 78-01's hazard-commit fixture, a hand-set
// climb/gorge cell next to the party, and a `move` toward it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";
import { hazardOdds } from "../../engine/movement.js";
import { toolItem } from "../../engine/items.js";
import { facesRangeText } from "../../src/browser/rollRange.js";
import { hazardOddsText } from "../../src/browser/rollOdds.js";
import { HAZARD_CARD_COPY, hazardCardViewModel } from "../../src/browser/hazardCard.js";
import { RAIL_FAMILY, RAIL_COPY, railFamilyFor, railCardFor } from "../../src/browser/rail.js";
import { PRIORITY } from "../../src/browser/narrationLines.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";

const GOLDEN = JSON.parse(readFileSync(new URL("./fixtures/hazard-commit/golden.json", import.meta.url), "utf8"));

/** paused(base, feat, cPatch, opts) — a real engine state paused at a wall or crevice. */
function paused(baseKey, feat, cPatch = {}, { tool = false } = {}) {
  const sc = GOLDEN.scenarios.find((x) => x.base === baseKey);
  const s = structuredClone(GOLDEN.bases[sc.base]);
  Object.assign(s.c, cPatch);
  s.floor.g[sc.y][sc.x].feat = feat;
  if (tool) s.c.items.push(toolItem(feat === "climb" ? "ladder" : "rope"));
  const { state, events } = applyAction(s, sc.action);
  assert.ok(state.pendingHazard, `${baseKey} ${feat}: the engine paused`);
  assert.deepStrictEqual(events.map((e) => e.type), ["hazardChoice"]);
  return { state, dir: sc.action.dir };
}

const labels = (vm) => vm.buttons.map((b) => b.label);
const texts = (vm) => vm.lines.map((l) => l.text);

// ─── the card's shape per feat and tool ────────────────────────────────────

test("CLIMB-01: a Fighter at a wall with no ladder: A WALL, CLIMB IT with the per-10-ft range and rock named, the fall and one-and-done lines, [CLIMB IT, TURN BACK]", () => {
  const { state, dir } = paused("fighter-s1", "climb", { armor: "Leather" });
  const vm = hazardCardViewModel(state);
  assert.equal(vm.title, "A WALL");
  assert.equal(vm.feat, "climb");
  assert.equal(vm.dir, dir);
  assert.equal(vm.iconKey, "wall");
  assert.deepEqual(labels(vm), ["CLIMB IT", "TURN BACK"]);
  assert.deepEqual(vm.buttons.map((b) => b.act), ["cross", "back"]);
  assert.equal(vm.lines[0].text, "CLIMB IT: 4–10 on a d10 for each 10 ft (rock: 5–10), 2 or 3 rolls.");
  assert.equal(vm.lines[0].roll, null, "no penalty clause without a penalty");
  assert.ok(texts(vm).includes(HAZARD_CARD_COPY.fall));
  assert.ok(texts(vm).includes(HAZARD_CARD_COPY.oneAndDone));
  assert.ok(texts(vm).includes(HAZARD_CARD_COPY.back.line));
  assert.equal(texts(vm).some((t) => t.startsWith("USE ")), false, "no tool line without the tool");
  assert.equal(vm.intro, HAZARD_CARD_COPY.intro.climb);
});

test("CLIMB-01: the same hero carrying a ladder: [CLIMB IT, USE LADDER, TURN BACK], and the tool line says it crosses with no roll and stays behind", () => {
  const { state, dir } = paused("fighter-s1", "climb", { armor: "Leather" }, { tool: true });
  const vm = hazardCardViewModel(state);
  assert.deepEqual(labels(vm), ["CLIMB IT", "USE LADDER", "TURN BACK"]);
  const toolBtn = vm.buttons[1];
  assert.deepEqual({ act: toolBtn.act, tool: toolBtn.tool, id: toolBtn.id }, { act: "tool", tool: "ladder", id: "a-hazard-tool" });
  assert.equal(vm.dir, dir);
  const toolLine = texts(vm).find((t) => t.startsWith("USE LADDER"));
  assert.equal(toolLine, HAZARD_CARD_COPY.tool.ladder.line);
  assert.match(toolLine, /no roll/);
  assert.match(toolLine, /stays behind/);
  assert.equal(vm.buttons[vm.buttons.length - 1].label, "TURN BACK", "TURN BACK is always last");
});

test("CLIMB-01: a Magic User at a crevice with a rope: LEAP IT from 2–10 (narrowest) to 10 (widest), USE ROPE offered", () => {
  const { state } = paused("mu-s1", "gorge", {}, { tool: true });
  const vm = hazardCardViewModel(state);
  assert.equal(vm.title, "A CREVICE");
  assert.equal(vm.iconKey, "crevice");
  assert.deepEqual(labels(vm), ["LEAP IT", "USE ROPE", "TURN BACK"]);
  assert.equal(vm.lines[0].text, "LEAP IT: 2–10 on a d10 for a 3–4 ft gap, down to 10 for 12–15 ft, one roll.");
  assert.ok(texts(vm).includes(HAZARD_CARD_COPY.tool.rope.line));
});

test("CLIMB-01: the tool is read live — the card drops USE LADDER the moment the ladder leaves the bag", () => {
  const { state } = paused("fighter-s1", "climb", {}, { tool: true });
  assert.deepEqual(labels(hazardCardViewModel(state)), ["CLIMB IT", "USE LADDER", "TURN BACK"]);
  const noLadder = structuredClone(state);
  noLadder.c.items = noLadder.c.items.filter((it) => !(it.tool === "ladder" || it.n === "Ladder"));
  assert.deepEqual(labels(hazardCardViewModel(noLadder)), ["CLIMB IT", "TURN BACK"]);
  const injected = hazardCardViewModel(state, { hasTool: () => false });
  assert.deepEqual(labels(injected), ["CLIMB IT", "TURN BACK"], "deps.hasTool overrides the engine's");
});

test("CLIMB-01: a Heights-phobic climber in Plate — both penalties folded into the range and named with U+2212 on the odds line", () => {
  const { state } = paused("fighter-s1", "climb", { phobia: "Heights", armor: "Plate" });
  const vm = hazardCardViewModel(state);
  assert.equal(vm.lines[0].text, "CLIMB IT: 8–10 on a d10 for each 10 ft (rock: 9–10), 2 or 3 rolls.");
  assert.equal(vm.lines[0].roll, "Heights −2, armour −2, already counted");
});

test("CLIMB-01: a leap whose widest gap has no winning face reads 'nothing' there", () => {
  const { state } = paused("mu-s1", "gorge", { armor: "Studded" });
  const vm = hazardCardViewModel(state);
  assert.match(vm.lines[0].text, /down to nothing for 12–15 ft/);
  assert.equal(vm.lines[0].roll, "armour −1, already counted");
});

// ─── agreement with the engine ─────────────────────────────────────────────

test("CLIMB-01 agreement: for every base, feat and penalty mix, each range on the card is facesRangeText of the engine's own case faces, and the penalties are the engine's", () => {
  const patches = [{}, { phobia: "Heights" }, { phobia: "Bodies of water" }, { armor: "Plate" }, { phobia: "Heights", armor: "Plate" }, { phobia: "Bodies of water", skills: { Hardiness: 1 } }];
  let checked = 0;
  for (const base of Object.keys(GOLDEN.bases)) {
    for (const feat of ["climb", "gorge"]) {
      for (const patch of patches) {
        const { state } = paused(base, feat, patch);
        const eng = hazardOdds(state, feat);
        const odds = hazardOddsText(state, feat);
        const vm = hazardCardViewModel(state);
        const label = `${base} ${feat} ${JSON.stringify(patch)}`;
        assert.deepEqual(odds.cases.map((k) => k.range), eng.cases.map((k) => facesRangeText(k.faces, eng.dieN)), label);
        assert.deepEqual(odds.penalties, eng.penalties, label);
        assert.ok(vm.lines[0].text.includes(odds.text), `${label}: the card carries the odds text`);
        if (feat === "climb") for (const k of odds.cases) assert.ok(vm.lines[0].text.includes(k.range), `${label}: ${k.label} ${k.range}`);
        else {
          assert.ok(vm.lines[0].text.includes(facesRangeText(eng.cases[0].faces, 10)), `${label}: narrowest`);
          assert.ok(vm.lines[0].text.includes(facesRangeText(eng.cases[eng.cases.length - 1].faces, 10)), `${label}: widest`);
        }
        assert.equal(vm.lines[0].roll === null, eng.penalties.length === 0, `${label}: a penalty clause exactly when the engine names one`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 100, `a real matrix (${checked})`);
});

// ─── when there is no card ─────────────────────────────────────────────────

test("CLIMB-01: no pending record, a combat, an open store or a dead hero: the view model is null", () => {
  const { state } = paused("thief-s1", "climb");
  assert.ok(hazardCardViewModel(state));
  assert.equal(hazardCardViewModel({ ...state, pendingHazard: null }), null);
  assert.equal(hazardCardViewModel({ ...state, combat: { pending: true, foes: [] } }), null);
  assert.equal(hazardCardViewModel({ ...state, store: { stock: [] } }), null);
  assert.equal(hazardCardViewModel({ ...state, dead: true }), null);
  assert.equal(hazardCardViewModel({ ...state, pendingHazard: { feat: "one", dir: "N", tool: "ladder" } }), null);
  assert.equal(hazardCardViewModel(null), null);
});

test("CLIMB-01: building the card rolls nothing and mutates nothing", () => {
  const { state } = paused("fighter-s2", "gorge", {}, { tool: true });
  const before = structuredClone(state);
  hazardCardViewModel(state);
  hazardCardViewModel(state);
  assert.deepStrictEqual(state, before);
  assert.deepStrictEqual(hazardCardViewModel(state), hazardCardViewModel(before));
});

// ─── TURN BACK's rail line ─────────────────────────────────────────────────

test("CLIMB-02: turnedBack has its own TURNED BACK family, and its card takes the wall icon for a climb and the crevice icon for a gorge", () => {
  const fam = railFamilyFor("turnedBack", "beat", PRIORITY.other);
  assert.equal(fam.title, "TURNED BACK");
  assert.equal(fam.tone, RAIL_FAMILY.turnedBack.tone);
  for (const [feat, icon] of [["climb", "wall"], ["gorge", "crevice"]]) {
    const events = [{ type: "turnedBack", feat, dir: "N" }];
    const folded = [{ text: "You leave it.", idx: 0, priority: PRIORITY.other, type: "turnedBack", tone: "beat" }];
    const card = railCardFor("resolveHazard", events, folded);
    assert.equal(card.title, "TURNED BACK");
    assert.equal(card.iconKey, icon, feat);
  }
});

test("CLIMB-02: the old retry and pre-roll copy is retired from RAIL_COPY (the card's copy lives in HAZARD_CARD_COPY)", () => {
  assert.equal(RAIL_COPY.climb, undefined);
  assert.equal(RAIL_COPY.hazard, undefined);
  assert.equal(RAIL_COPY.dark.torch, "USE TORCH", "the dark card's USE TORCH offer is untouched");
});

// ─── the view model and the engine across a commit ─────────────────────────

test("CLIMB-02: after a commit that crosses (success or fail-and-cross), no record is left and the card is gone", () => {
  const outcomes = new Set();
  for (const sc of GOLDEN.scenarios.filter((x) => x.outcome !== "died")) {
    const s = structuredClone(GOLDEN.bases[sc.base]);
    Object.assign(s.c, sc.cPatch || {});
    s.floor.g[sc.y][sc.x].feat = sc.feat;
    const p = applyAction(s, sc.action).state;
    assert.ok(hazardCardViewModel(p), `${sc.label}: the card is up before the commit`);
    const { state: after, events } = applyAction(p, { type: "resolveHazard", cross: true });
    outcomes.add(sc.outcome);
    assert.equal(after.pendingHazard, null, sc.label);
    assert.equal(hazardCardViewModel(after), null, `${sc.label}: no card survives the crossing`);
    assert.ok(events.some((e) => ["climbedOver", "leaptOver", "draggedOver"].includes(e.type)), sc.label);
  }
  assert.deepEqual([...outcomes].sort(), ["failedCrossed", "succeeded"]);
});

test("CLIMB-02: a second tap after the first dispatch finds no record and changes nothing", () => {
  for (const cross of [true, false]) {
    const { state } = paused("thief-s2", "gorge");
    const first = applyAction(state, { type: "resolveHazard", cross }).state;
    assert.equal(hazardCardViewModel(first), null);
    const { state: second, events } = applyAction(first, { type: "resolveHazard", cross });
    assert.deepStrictEqual(events, []);
    // The rng cursor compared unsigned (newRun may store it signed; applyAction persists `>>> 0`).
    assert.equal(second.rngState >>> 0, first.rngState >>> 0);
    assert.equal(hazardCardViewModel(second), null);
  }
});

test("CLIMB-02: TURN BACK clears the card, and the next step toward the same wall shows the same card again", () => {
  const { state, dir } = paused("fighter-s1", "climb");
  const card = hazardCardViewModel(state);
  const back = applyAction(state, { type: "resolveHazard", cross: false });
  assert.deepStrictEqual(back.events.map((e) => e.type), ["turnedBack"]);
  assert.equal(hazardCardViewModel(back.state), null);
  const again = applyAction(back.state, { type: "move", dir }).state;
  assert.deepStrictEqual(hazardCardViewModel(again), card);
});

test("CLIMB-02: a relaunch with the card up shows the same card (validateSave and rehydrate keep the record)", () => {
  for (const [base, feat, tool] of [["fighter-s1", "climb", true], ["mu-s2", "gorge", false], ["thief-s3", "climb", false]]) {
    const { state } = paused(base, feat, {}, { tool });
    const card = hazardCardViewModel(state);
    const json = JSON.stringify(serializeRun(state));
    const validated = validateSave(json);
    assert.ok(validated.ok, `${base}: the save validates`);
    assert.deepStrictEqual(hazardCardViewModel(validated.value), card, `${base}: validateSave`);
    assert.deepStrictEqual(hazardCardViewModel(rehydrate(JSON.parse(json))), card, `${base}: rehydrate`);
  }
});

// ─── the card on the real rail (shell sandbox) ─────────────────────────────
//
// The REAL classic renderRail()/railLocked() from mazeworld.html, run in
// test/unit/harness/shellSandbox.js with the real __mzRailVM (hazardCard
// included), against a real paused engine state.

function railSandbox(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: true, stubRail: false });
  sandbox.setState(state);
  return { doc, sandbox };
}

function railView(doc) {
  const d = doc.document;
  return {
    title: d.getElementById("mw-rail-title").textContent,
    lines: d.getElementById("mw-rail-lines").children.map((el) => el.textContent),
    buttons: d.getElementById("mw-rail-actions").children.map((b) => ({ id: b.id, label: b.textContent })),
    hidden: d.getElementById("mw-rail").hidden,
  };
}

test("CLIMB-01 (shell): a paused wall shows the decision card on the real rail — A WALL, the intro line on a relaunch (no narration), the odds, [CLIMB IT, USE LADDER, TURN BACK] with their ids", () => {
  const { state } = paused("fighter-s1", "climb", { armor: "Leather" }, { tool: true });
  const { doc, sandbox } = railSandbox(state);
  sandbox.context.window.__mzPendingNarration = null;
  sandbox.context.renderRail();
  const v = railView(doc);
  assert.equal(v.hidden, false);
  assert.equal(v.title, "A WALL");
  assert.equal(v.lines[0], HAZARD_CARD_COPY.intro.climb);
  assert.ok(v.lines.includes("CLIMB IT: 4–10 on a d10 for each 10 ft (rock: 5–10), 2 or 3 rolls."));
  assert.deepEqual(v.buttons, [
    { id: "a-hazard-cross", label: "CLIMB IT" },
    { id: "a-hazard-tool", label: "USE LADDER" },
    { id: "a-hazard-back", label: "TURN BACK" },
  ]);
});

// (The live-step path, where the hazardChoice narration heads the card, goes
// through htmlToPlain's <template> parse, which the recording DOM does not
// model; test/unit/shell-map-rail.test.js pins that source shape instead.)
test("CLIMB-01 (shell): a paused crevice with no rope shows A CREVICE with [LEAP IT, TURN BACK] and no tool line", () => {
  const { state } = paused("mu-s1", "gorge");
  const { doc, sandbox } = railSandbox(state);
  sandbox.context.renderRail();
  const v = railView(doc);
  assert.equal(v.title, "A CREVICE");
  assert.equal(v.lines[0], HAZARD_CARD_COPY.intro.gorge);
  assert.equal(v.lines.some((t) => t.startsWith("USE ROPE")), false);
  assert.deepEqual(v.buttons.map((b) => b.label), ["LEAP IT", "TURN BACK"]);
});

test("CLIMB-01 (shell): railLocked() covers a pending hazard (so a map tap or an arrow key pulses the card), and the card classifies as locked, never body-tap dismissible", () => {
  const { state } = paused("thief-s1", "climb");
  const { sandbox } = railSandbox(state);
  const ctx = sandbox.context;
  assert.equal(ctx.railLocked(), true);
  assert.equal(ctx.window.__mzRailVM.dismissKind(ctx.railLocked(), 2), "locked");
  sandbox.setState({ ...state, pendingHazard: null });
  assert.equal(ctx.railLocked(), false);
  sandbox.setState({ ...state, store: { stock: [] } });
  assert.equal(ctx.railLocked(), false, "an open store owns the screen, not the card");
});

test("CLIMB-02 (shell): once the record clears (a crossing), the real rail shows no wall/crevice card and no retry button", () => {
  const { state } = paused("fighter-s2", "climb", {}, { tool: true });
  const crossed = applyAction(state, { type: "resolveHazard", cross: true }).state;
  const { doc, sandbox } = railSandbox(crossed);
  sandbox.context.renderRail();
  const ids = railView(doc).buttons.map((b) => b.id);
  assert.equal(ids.some((id) => id.startsWith("a-hazard-") || id === "mw-rail-climb" || id === "mw-rail-tool"), false);
});

// ─── voice ─────────────────────────────────────────────────────────────────

function leaves(obj, out = []) {
  if (typeof obj === "string") out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) leaves(v, out);
  return out;
}

test("voice: every HAZARD_CARD_COPY leaf is non-empty, clear of BANNED, never says WP, and uses no ASCII hyphen as a minus or range", () => {
  const escaped = BANNED.filter((w) => !ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const bannedRe = new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
  const all = leaves(HAZARD_CARD_COPY);
  assert.ok(all.length >= 12);
  for (const s of all) {
    assert.ok(s.trim().length > 0);
    assert.doesNotMatch(s, bannedRe, s);
    assert.doesNotMatch(s, /(?<![\w.$-])(wp|WP)(?![\w:])/, s);
    assert.doesNotMatch(s, /\d-\d|(^|\s)-\d/, s);
  }
});
