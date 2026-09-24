// test/unit/combat-lock-shell.test.js
//
// Phase 71 (POLISH-07, D-05/D-06), Plan 03, Task 3 — the lock, skip and
// no-replay proof against a REAL resolved combat round in the shell sandbox.
//
// D-05: while a round's beats play, every combat action renders visibly
// unavailable, taps are never queued or replayed after the settle, and the
// actions re-enable the moment the round settles.
// D-06: a tap during playback (including one on a locked action) lands the
// round's result and never acts.
// R-08: the skip is Phase 58's ONE beatHurryTap (a capture-phase click
// listener on #enc-panel); this plan adds no second listener.
//
// Built the same way test/unit/combat-beat-shell.test.js builds its own
// scenarios: engineCombatAction lives in mazeworld.html's module script and
// cannot run in the classic-only sandbox, so every test reproduces its beat
// handoff by hand (driveHandoff, copied, not imported) on a round resolved
// through engine/engine.js#applyAction. A deterministic fake clock drives
// every timer — no test here sleeps.
//
// The sandbox's document.querySelectorAll is hard-stubbed to [] (see
// test/unit/harness/recordingDom.js), which would make the Phase 32 arm
// sweep a silent no-op. installSweepQuery() below swaps in a tiny matcher
// for exactly the selector shapes the sweep uses, so case (2) proves the
// :not([data-locked]) exclusion against the sweep's REAL selector string,
// with a control element (a live foe card) that the sweep does strip.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import { planBeat, beatOffsets, beatEndMs } from "../../src/browser/combatBeat.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

// ─── fixed* helpers — copied from test/unit/combat-beat-shell.test.js ─────

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

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

/** midFightRound() — combat-beat-shell's real, resolved, mid-fight round
 * (rngState 32): three fight-log lines, Cave Rat still standing, so the
 * settle render draws the action grid again. */
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

/** driveHandoff — engineCombatAction's own beat handoff, reproduced by hand. */
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

// ─── a tiny matcher for the arm sweep's own selector shapes ───────────────

function matchesCompound(el, compound) {
  const tokenRe = /\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:not\(([^)]*)\)/g;
  let consumed = 0;
  for (const m of compound.matchAll(tokenRe)) {
    consumed += m[0].length;
    if (m[1] !== undefined) {
      if (!String(el.className || "").split(/\s+/).includes(m[1])) return false;
    } else if (m[2] !== undefined) {
      const v = el.getAttribute(m[2]);
      if (v === null || v === undefined) return false;
      if (m[3] !== undefined && v !== m[3]) return false;
    } else if (m[4] !== undefined) {
      if (matchesCompound(el, m[4])) return false;
    }
  }
  if (consumed !== compound.length) throw new Error(`sweep matcher: unsupported compound ${JSON.stringify(compound)}`);
  return true;
}

function descendants(root, out = []) {
  for (const child of root.children || []) {
    if (child.nodeType === 3) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

/** installSweepQuery(doc) — document.querySelectorAll for "ANCESTOR COMPOUND"
 * parts joined by commas (the arm sweep's shape). #enc-body is the only
 * #enc-panel child the classic script renders into (the recording DOM keeps
 * ids as roots rather than parsing the static markup's nesting), so an
 * #enc-panel ancestor walks #enc-panel and #enc-body both. Returns the list
 * of selectors seen, so a test can prove the sweep actually ran. */
function installSweepQuery(doc) {
  const seen = [];
  doc.document.querySelectorAll = (sel) => {
    seen.push(sel);
    const out = [];
    for (const part of sel.split(",").map((s) => s.trim())) {
      const [ancestor, compound] = part.split(/\s+/);
      const roots = [];
      if (ancestor === "#enc-panel") roots.push(doc.document.getElementById("enc-panel"), doc.document.getElementById("enc-body"));
      else if (ancestor.startsWith("#")) roots.push(doc.document.getElementById(ancestor.slice(1)));
      for (const root of roots.filter(Boolean)) {
        for (const el of descendants(root)) if (matchesCompound(el, compound) && !out.includes(el)) out.push(el);
      }
    }
    return out;
  };
  return seen;
}

// ─── DOM helpers ───────────────────────────────────────────────────────────

function scenario({ clock }) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  let strikeCalls = 0;
  sandbox.context.window.mzAttack = () => { strikeCalls++; };
  return { doc, sandbox, strikes: () => strikeCalls };
}

const encBody = (doc) => doc.document.getElementById("enc-body");
const act = (doc) => encBody(doc).querySelector("#cb-act");
const byId = (doc, id) => encBody(doc).querySelector(`#${id}`);
const GRID = ["cb-strike", "cb-spells", "cb-items", "cb-social"];
const foeCards = (doc) => Array.from(encBody(doc).querySelectorAll(".cb-foe"));
const hurryEvent = (target) => {
  const e = { target, stopped: false, prevented: false };
  e.stopPropagation = () => { e.stopped = true; };
  e.preventDefault = () => { e.prevented = true; };
  return e;
};

// ─── (1) the lock at the first beat render ────────────────────────────────

test("combat-lock (1): at the first beat render #cb-act is data-locked, all four actions carry data-locked and aria-disabled, and the prompt reads the resolving line", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { started } = driveHandoff(sandbox, midFightRound());
  assert.ok(started, "the real round must start a beat");
  assert.equal(sandbox.context.window.__mzBeat.active(), true);

  assert.equal(act(doc).getAttribute("data-locked"), "1");
  for (const id of GRID) {
    const btn = byId(doc, id);
    assert.ok(btn, `${id} must render`);
    assert.equal(btn.getAttribute("data-locked"), "1", `${id} data-locked`);
    assert.equal(btn.getAttribute("aria-disabled"), "true", `${id} aria-disabled`);
  }
  assert.equal(act(doc).querySelector(".cb-prompt").textContent, COMBAT_MENU_COPY.resolving);
  assert.equal(COMBAT_MENU_COPY.resolving, "HOLD · THE DICE ARE STILL OUT");
});

// ─── (2) the arm sweep never strips a locked action mid-beat ─────────────

test("combat-lock (2): past ARM_DELAY_MS but still mid-beat, the arm sweep has run and stripped a live foe card, yet the locked actions keep aria-disabled", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const seen = installSweepQuery(doc);
  const { plan } = driveHandoff(sandbox, midFightRound());
  const offsets = beatOffsets(plan.texts, durationFor);
  assert.ok(offsets[1] > ARM_DELAY_MS + 40, "scenario setup: the second line lands well after the arm window");
  const liveCard0 = foeCards(doc).find((el) => el.dataset.foe === "1");
  assert.equal(liveCard0.getAttribute("aria-disabled"), "true", "control setup: a live foe card starts with its arm marker");

  clock.advance(ARM_DELAY_MS + 30);
  assert.equal(sandbox.context.window.__mzBeat.active(), true, "still mid-beat");
  assert.ok(seen.some((s) => s.includes(":not([data-locked])")), "the real arm sweep must have run with its data-locked exclusion");

  const liveCard = foeCards(doc).find((el) => el.dataset.foe === "1");
  assert.ok(liveCard, "Cave Rat's card renders");
  assert.equal(liveCard.getAttribute("aria-disabled"), null, "control: the sweep strips a live foe card's arm marker");

  for (const id of GRID) {
    assert.equal(byId(doc, id).getAttribute("aria-disabled"), "true", `${id} keeps aria-disabled mid-beat`);
    assert.equal(byId(doc, id).getAttribute("data-locked"), "1");
  }
});

// ─── (3) + (4) a tap on a locked action skips and never acts; no replay ───

test("combat-lock (3)(4): beatHurryTap on a tap targeted at #cb-strike stops propagation, ends the beat and never attacks — and nothing replays across the settle, ARM_DELAY_MS and 2 s more", () => {
  const clock = createFakeClock();
  const { doc, sandbox, strikes } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatOffsets(plan.texts, durationFor)[1] + 10);
  assert.equal(sandbox.context.window.__mzBeat.active(), true);

  // A real tap on the locked button would also try its own guarded onclick:
  // it is swallowed (encArmed is false for the whole beat).
  byId(doc, "cb-strike").onclick();
  const e = hurryEvent(byId(doc, "cb-strike"));
  sandbox.context.beatHurryTap(e);
  assert.equal(e.stopped, true, "the hurry stops propagation");
  assert.equal(e.prevented, true);
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the hurry ends the beat");
  assert.equal(sandbox.context.window.__mzFightLog.entries.length, 3, "the whole round landed");
  assert.equal(strikes(), 0, "the tap never acts");

  clock.advance(ARM_DELAY_MS + 2000);
  assert.equal(strikes(), 0, "no tap is queued or replayed after the settle");
});

// ─── (5) the settle unlocks; the arm window still guards ghost taps ──────

test("combat-lock (5): after the settle #cb-act and its actions are unlocked and the prompt is back; a tap inside ARM_DELAY_MS is swallowed, a fresh tap after it attacks exactly once", () => {
  const clock = createFakeClock();
  const { doc, sandbox, strikes } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatEndMs(plan.texts, durationFor) + 32);
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the beat has ended");

  assert.equal(act(doc).getAttribute("data-locked"), null, "#cb-act unlocked");
  assert.equal(act(doc).querySelector(".cb-prompt").textContent, COMBAT_MENU_COPY.prompt);
  for (const id of GRID) assert.equal(byId(doc, id).getAttribute("data-locked"), null, `${id} unlocked`);

  byId(doc, "cb-strike").onclick();
  assert.equal(strikes(), 0, "a tap inside the settle render's arm window is swallowed");
  clock.advance(ARM_DELAY_MS + 10);
  byId(doc, "cb-strike").onclick();
  assert.equal(strikes(), 1, "a fresh tap after ARM_DELAY_MS attacks exactly once");
  clock.advance(2000);
  assert.equal(strikes(), 1, "and only once");
});

// ─── (6) one frame either side of the settle ─────────────────────────────

test("combat-lock (6): a direct #cb-strike tap one clock frame before the beat ends calls nothing, and the settle shows the result with nothing replayed", () => {
  const clock = createFakeClock();
  const { doc, sandbox, strikes } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  const endMs = beatEndMs(plan.texts, durationFor);

  clock.advance(endMs - 16);
  assert.equal(sandbox.context.window.__mzBeat.active(), true, "one frame before the end, the beat is still live");
  assert.equal(byId(doc, "cb-strike").getAttribute("data-locked"), "1");
  byId(doc, "cb-strike").onclick();
  assert.equal(strikes(), 0);

  clock.advance(48);
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the beat has settled");
  assert.equal(sandbox.context.window.__mzFightLog.entries.length, 3, "the settle shows the whole round");
  assert.equal(act(doc).getAttribute("data-locked"), null);
  assert.equal(strikes(), 0, "the pre-settle tap is never replayed by the settle");
  clock.advance(ARM_DELAY_MS + 2000);
  assert.equal(strikes(), 0, "nor later");
});

test("combat-lock (6b): a hurry tap one clock frame before the beat ends only skips — the settle runs once and nothing acts", () => {
  const clock = createFakeClock();
  const { doc, sandbox, strikes } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatEndMs(plan.texts, durationFor) - 16);
  assert.equal(sandbox.context.window.__mzBeat.active(), true);

  let paints = 0;
  const realPaint = sandbox.context.paint;
  sandbox.context.window.paint = () => { paints++; return realPaint(); };
  sandbox.context.beatHurryTap(hurryEvent(byId(doc, "cb-strike")));
  assert.equal(sandbox.context.window.__mzBeat.active(), false);
  clock.advance(ARM_DELAY_MS + 2000);
  assert.equal(paints, 1, "the settle ran exactly once — the natural end never fires a second one");
  assert.equal(strikes(), 0);
});

// ─── (7) foe cards are never locked or dimmed ────────────────────────────

test("combat-lock (7): during the beat no foe card is data-locked, and the lock CSS never reaches a foe card, YOUR LOT or the log", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  for (const t of [0, beatOffsets(plan.texts, durationFor)[1] + 10]) {
    clock.advance(t);
    assert.equal(sandbox.context.window.__mzBeat.active(), true);
    const cards = foeCards(doc);
    assert.equal(cards.length, 2);
    for (const card of cards) assert.equal(card.getAttribute("data-locked"), null, "a foe card is never locked");
    assert.equal(act(doc).querySelector(".cb-foe"), null, "foe cards live outside the locked action area");
  }
  const lockRules = HTML.match(/^#cb-act\[data-locked="1"\][^{]*\{[^}]*\}/gm) || [];
  assert.ok(lockRules.length > 0);
  // Phase 71 (D-07): the what-happened strip (#cb-summary / .cb-sum-*) is not an action either.
  for (const rule of lockRules) assert.doesNotMatch(rule, /cb-foe|cb-lot|cb-log|cb-mid|cb-summary|cb-sum-/, "the lock styles only the action area");
});

// ─── (8) a tab switch still lands the round, and the next render is unlocked ─

test("combat-lock (8): window.__mzShowTab(\"oracle\") mid-beat ends the beat (Phase 70 R-C) and the next render is unlocked", () => {
  const clock = createFakeClock();
  const { doc, sandbox, strikes } = scenario({ clock });
  const { plan } = driveHandoff(sandbox, midFightRound());
  clock.advance(beatOffsets(plan.texts, durationFor)[1] + 10);
  assert.equal(act(doc).getAttribute("data-locked"), "1");

  sandbox.context.window.__mzShowTab("oracle");
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "a tab switch lands the round");
  sandbox.context.renderEncounter();
  assert.ok(act(doc), "the combat body still renders");
  assert.equal(act(doc).getAttribute("data-locked"), null, "the next render is unlocked");
  assert.equal(act(doc).querySelector(".cb-prompt").textContent, COMBAT_MENU_COPY.prompt);
  for (const id of GRID) assert.equal(byId(doc, id).getAttribute("data-locked"), null);
  assert.equal(strikes(), 0);
});
