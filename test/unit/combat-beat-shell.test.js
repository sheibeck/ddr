// test/unit/combat-beat-shell.test.js
//
// Phase 58 (MOTION-03), Plan 06 — the shell wiring behind the combat beat:
// engineCombatAction() lives in mazeworld.html's trailing <script
// type="module"> and cannot run inside this classic-only sandbox (see
// test/unit/harness/shellSandbox.js's own doc comment), so every test below
// reproduces its documented handoff by hand, against a REAL combat round
// resolved through engine/engine.js#applyAction (never hand-built events):
//   1. take a real combat state, applyAction("attack") to resolve the whole
//      round exactly as engineCombatAction's own dispatchWithNarration call
//      would,
//   2. set S to the after-state,
//   3. append the round's folded fight-log lines to window.__mzFightLog
//      (appendFightLog(beforeLog, fightLogLinesFor("attack", events),
//      round)) — the SAME two calls dispatchWithNarration itself makes,
//   4. start the REAL beat runner (test/unit/harness/shellSandbox.js's
//      `beatRunner`, wired over a REAL createBeatRunner) via
//      beatRunner.start(planBeat({...})).
//
// Every test drives a deterministic fake clock (test/unit/harness/
// fakeClock.js) — no test here ever sleeps; clock.advance(ms) is the only
// way time moves.

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
import { stripHtml } from "../../tools/ident-sweep.mjs";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fixed* helpers — copied verbatim from test/unit/combat-beat.test.js's
// own fixedFighter/fixedFloor/fixedState/fixedCombat (itself copied from
// test/unit/fight-log-worst-case.test.js/combatPanel.test.js), extended
// with a real `combat.first: "you"` so applyAction("attack") resolves a
// real (already-joined, not pending) round through the real engine. ───────

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

/**
 * midFightRound() — a real, resolved, MID-FIGHT round (rngState 32): the
 * hero attacks two foes. Goblin Grunt (wp 1) is struck and killed on the
 * FIRST folded line (struck+foeKilled+goldGained fold to one line); Cave
 * Rat (wp 40, alive) strikes back on the SECOND line (struckByFoe, a
 * critical hit); a third line ("+1 wilmst", the level/sp-gain narration)
 * carries no foe/hero HP change. `after.combat` stays set (Cave Rat is
 * still alive) — three real fight-log lines, a uniquely-named foe struck,
 * no ending.
 */
function midFightRound() {
  const before = fixedState({ rngState: 32 });
  before.combat = {
    foes: [fixedFoe({ name: "Goblin Grunt", wp: 1, maxWP: 10 }), fixedFoe({ name: "Cave Rat", wp: 40, maxWP: 40 })],
    type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const { state: after, events } = applyAction(before, { type: "attack" });
  return { before, after, events };
}

/**
 * endingRound() — a real, resolved, COMBAT-ENDING round (rngState 7): the
 * hero attacks a single foe (Lone Wolf, wp 1), kills it, and the fight
 * ends (`after.combat` is null — a victory, no drops). Three real
 * fight-log lines (struck+foeKilled+goldGained fold to one, "+1 wilmst",
 * "Nothing left standing.").
 */
function endingRound() {
  const before = fixedState({ rngState: 7 });
  before.combat = {
    foes: [fixedFoe({ name: "Lone Wolf", wp: 1, maxWP: 10 })],
    type: "Beasts", round: 5, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const { state: after, events } = applyAction(before, { type: "attack" });
  return { before, after, events };
}

const durationFor = (text) => typeDurationMs(String(text ?? "").length);

/**
 * driveHandoff(sandbox, { before, after, events }) — reproduces
 * engineCombatAction's own beat handoff (see this file's header comment)
 * against a REAL resolved round. Returns `{ plan, started, lines }`.
 */
function driveHandoff(sandbox, { before, after, events, actionType = "attack" }) {
  const w = sandbox.context.window;
  const beforeLog = w.__mzFightLog;
  w.__mzState.set(after);
  const lines = fightLogLinesFor(actionType, events, {});
  w.__mzFightLog = appendFightLog(beforeLog, lines, before.combat.round);
  const plan = planBeat({
    actionType,
    events,
    before,
    after,
    beforeLog,
    afterLog: w.__mzFightLog,
    ctx: {},
  });
  const started = sandbox.beatRunner.start(plan);
  return { plan, started, lines };
}

function scenario({ clock } = {}) {
  const doc = createRecordingDocument();
  // reducedMotion: false — every test here exercises the REAL timed reveal;
  // the reduced path is covered separately in reduced-motion.test.js's own
  // "beat" section.
  const sandbox = loadShellSandbox({ doc, reducedMotion: false, clock });
  return { doc, sandbox };
}

// document.querySelectorAll() is hard-stubbed to [] in this harness (its
// own doc comment: the classic script's only document-level callers run
// inside code paths this harness never exercises) — every query below runs
// from a real element root (#enc-body) instead.
function encBody(doc) {
  return doc.document.getElementById("enc-body");
}

function logRows(doc) {
  return Array.from(encBody(doc).querySelectorAll(".cb-log-entry"));
}

function foeCard(doc, i) {
  return Array.from(encBody(doc).querySelectorAll(".cb-foe")).find((el) => el.dataset.foe === String(i));
}

// ─── (1) the first exchange lands immediately ─────────────────────────────

test("combat-beat-shell (1): the first exchange lands immediately — the panel shows the combat body, exactly the first line of the batch is visible, and that row is aria-hidden while it types", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();

  const { plan, started, lines } = driveHandoff(sandbox, { before, after, events });
  assert.ok(started, "beatRunner.start(plan) must return true for a real resolved round");
  assert.equal(plan.count, 3, "scenario setup must actually fold to three fight-log lines");

  const panel = doc.document.getElementById("enc-panel");
  assert.equal(panel.hidden, false, "the encounter panel must be showing");
  assert.ok(encBody(doc).querySelector("#cb-foes"), "the combat body (foe cards) must be rendered, not the over-panel");

  const rows = logRows(doc);
  assert.equal(rows.length, 1, "exactly the first line of the batch must be visible");
  // The row is actively typing (a typed+rest span pair, per typewriter.js) —
  // reconstruct the full line from that pair rather than reading a single
  // aggregate .textContent (which reads only the LAST plain-text write,
  // never live child content, on this fake harness).
  const textEl = rows[0].querySelector(".cb-log-text");
  assert.equal(textEl.children.length, 2, "a typing row must hold a typed+rest span pair");
  assert.equal(textEl.children[0].textContent + textEl.children[1].textContent, lines[0].text, "the typed+rest split must reconstruct the full first line");

  assert.equal(rows[0].getAttribute("aria-hidden"), "true", "the revealed row must be aria-hidden for its typing window");
});

// ─── (2) each later exchange lands at its offset ──────────────────────────

test("combat-beat-shell (2): the next exchange lands at its offset, and so on to the last — never before, never skipped", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  const { plan } = driveHandoff(sandbox, { before, after, events });

  const offsets = beatOffsets(plan.texts, durationFor);
  assert.equal(offsets.length, 3);

  // Just short of the second line's offset: still exactly one row.
  clock.advance(offsets[1] - 1);
  assert.equal(logRows(doc).length, 1, "the second line must not land before its own offset");

  // At (and past) the second line's offset: two rows.
  clock.advance(2);
  assert.equal(logRows(doc).length, 2, "the second line must land at its own offset");

  // Just short of the third line's offset: still two rows.
  clock.advance(offsets[2] - offsets[1] - 3);
  assert.equal(logRows(doc).length, 2, "the third line must not land before its own offset");

  // At (and past) the third (last) line's offset: all three rows.
  clock.advance(4);
  assert.equal(logRows(doc).length, 3, "the last line must land at its own offset");
});

// ─── (3) the announcer gets the whole batch at once ───────────────────────

test("combat-beat-shell (3): #enc-round-live holds the whole round's text after the FIRST beat render, even though the visible rows reveal one by one", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  const { lines } = driveHandoff(sandbox, { before, after, events });

  assert.equal(logRows(doc).length, 1, "only the first line is VISIBLE this render");
  const live = doc.document.getElementById("enc-round-live");
  assert.equal(live.textContent, lines.map((l) => l.text).join(" "), "the announcer must carry the WHOLE round's text in the very first beat render");
});

// ─── (4) the buttons arm only after the last line ─────────────────────────

test("combat-beat-shell (4): encArmed() is false and #cb-strike is swallowed for the whole beat; ARM_DELAY_MS after the last line lands, the same click fires", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  let strikeCalls = 0;
  sandbox.context.window.mzAttack = () => { strikeCalls++; };

  const { plan } = driveHandoff(sandbox, { before, after, events });
  const endMs = beatEndMs(plan.texts, durationFor);

  assert.equal(sandbox.context.encArmed(), false, "encArmed() must be false while the beat is live");
  doc.document.getElementById("cb-strike").onclick();
  assert.equal(strikeCalls, 0, "a tap on #cb-strike during a live beat must be swallowed");

  // Mid-GAP (well past ARM_DELAY_MS=250ms since the first render, but well
  // short of the second line's own 600ms offset — no fresh render has
  // stamped encRenderedAt in between): this is the moment that gives the
  // encArmed() beat check its teeth — without it, the plain
  // Date.now()-vs-encRenderedAt arm-delay comparison alone would already
  // read armed here, even though the beat is still live.
  clock.advance(300);
  assert.equal(sandbox.context.window.__mzBeat.active(), true, "scenario setup must still be mid-beat here, between renders");
  assert.equal(sandbox.context.encArmed(), false, "encArmed() must stay false mid-beat even well past a plain ARM_DELAY_MS window");
  doc.document.getElementById("cb-strike").onclick();
  assert.equal(strikeCalls, 0, "a tap on #cb-strike mid-beat (past ARM_DELAY_MS since the last render) must still be swallowed");

  // Generous margin past endMs (relative to t=0 — subtract the 300ms
  // already advanced above) to absorb the fake clock's frame quantization
  // (advance() steps in 16ms increments) — never a real sleep.
  clock.advance(endMs - 300 + 64);
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the beat must have ended by beatEndMs");
  assert.equal(sandbox.context.encArmed(), false, "the settle render's own arm-delay window must still be running");

  clock.advance(ARM_DELAY_MS + 10);
  assert.equal(sandbox.context.encArmed(), true, "the buttons must arm ARM_DELAY_MS after the settle render");
  doc.document.getElementById("cb-strike").onclick();
  assert.equal(strikeCalls, 1, "the SAME click must now fire, exactly once");
});

// ─── (5) tap to hurry ──────────────────────────────────────────────────────

test("combat-beat-shell (5): beatHurryTap mid-beat stops propagation, reveals every line in full with none typing, runs the settle exactly once, and ends the beat; with no beat live it touches nothing", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  const { plan, lines } = driveHandoff(sandbox, { before, after, events });

  clock.advance(beatOffsets(plan.texts, durationFor)[1] + 10); // mid-beat: two lines landed, one still to come

  // onSettle's own body is `window.paint(); window.renderEncounter();` —
  // paint() itself also calls renderEncounter() (its own trailing line), so
  // a plain renderEncounter() call count would double-count one settle.
  // Spying on paint() alone proves the settle ran exactly once.
  let paintCount = 0;
  const realPaint = sandbox.context.paint;
  sandbox.context.window.paint = () => { paintCount++; return realPaint(); };

  let stopped = false;
  let prevented = false;
  const evt = { stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } };
  sandbox.context.beatHurryTap(evt);

  assert.equal(stopped, true, "beatHurryTap must stopPropagation while a beat is live");
  assert.equal(prevented, true, "beatHurryTap must preventDefault while a beat is live");
  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the hurry must end the beat");
  assert.equal(logRows(doc).length, 3, "every line must be revealed in full");
  for (const row of logRows(doc)) {
    assert.equal(row.getAttribute("aria-hidden"), null, "no row may be left mid-typed after a hurry");
  }
  assert.equal(sandbox.context.window.__mzFightLog.entries.length, 3, "nothing is lost — every line stays in the log");
  assert.equal(paintCount, 1, "the settle paint (and its own render) must run exactly once");

  // With no beat live, the SAME handler touches nothing on the event.
  let stopped2 = false;
  let prevented2 = false;
  const evt2 = { stopPropagation: () => { stopped2 = true; }, preventDefault: () => { prevented2 = true; } };
  sandbox.context.beatHurryTap(evt2);
  assert.equal(stopped2, false, "beatHurryTap must be a no-op with no beat live");
  assert.equal(prevented2, false);
});

// ─── (6) a struck foe's HP/strike-pop moves with its own line ────────────

test("combat-beat-shell (6): a uniquely-named foe struck on line k shows the frame's reduced HP label and cb-foe-hit on that line's render; on the last line its label equals the real after-state's", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  const { plan } = driveHandoff(sandbox, { before, after, events });

  // Line 0: Goblin Grunt (index 0) was struck and killed on THIS line.
  const grunt0 = foeCard(doc, 0);
  assert.ok(grunt0.classList.contains("cb-foe-hit"), "the struck foe's card must carry cb-foe-hit on the line that struck it");
  assert.equal(grunt0.querySelector(".cb-foe-wp").textContent, "—", "the frame's reduced HP label (dead) must show on this line");
  const rat0 = foeCard(doc, 1);
  assert.equal(rat0.querySelector(".cb-foe-wp").textContent, "40 / 40", "an untouched foe's HP must be unchanged on this line");

  // Advance to the LAST line — Goblin Grunt's label must equal the real
  // after-state's (still dead), and cb-foe-hit must no longer be on it
  // (the hit pop belongs to the line that caused it, not every later one).
  clock.advance(beatEndMs(plan.texts, durationFor) - 1);
  const gruntLast = foeCard(doc, 0);
  assert.equal(gruntLast.querySelector(".cb-foe-wp").textContent, "—");
  assert.equal(gruntLast.classList.contains("cb-foe-hit"), false, "cb-foe-hit must not persist past the line that caused it");
  assert.equal(after.combat.foes[0].alive, false, "sanity: the real after-state agrees Goblin Grunt is dead");
});

// ─── (7) the killing round reads before the end card ──────────────────────

test("combat-beat-shell (7): a killing blow — during the beat the combat body renders (not the over-panel) and hasActiveEncounter() is true; after the end, the normal over-panel branch renders", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = endingRound();
  // Simulate the (module-only) noteCombat's own aftermath: a won ending
  // with no loot pending folds into S.beats, exactly like the real
  // dispatch would before the beat starts (noteCombat runs BEFORE the
  // beat handoff in engineCombatAction).
  after.beats = { groups: [{ title: "They fall", tone: "moss", lines: [] }], i: 0, action: null, over: "won" };

  const { plan } = driveHandoff(sandbox, { before, after, events });
  assert.equal(after.combat, null, "sanity: the real after-state has no combat — the fight is over");

  assert.equal(sandbox.context.hasActiveEncounter(), true, "hasActiveEncounter() must stay true for the whole beat");
  assert.ok(encBody(doc).querySelector("#cb-foes"), "the combat body must render from the beat's frame, not the over-panel, while the beat is live");
  assert.equal(encBody(doc).querySelector("#cb-over"), null, "the over-panel must not render while the beat is live");

  // Generous margin past endMs to absorb the fake clock's frame
  // quantization (advance() steps in 16ms increments) — never a real sleep.
  clock.advance(beatEndMs(plan.texts, durationFor) + 64);

  assert.equal(sandbox.context.window.__mzBeat.active(), false, "the beat must have ended");
  assert.ok(encBody(doc).querySelector("#cb-over"), "the over-panel must render once the beat has ended");
  assert.equal(encBody(doc).querySelector("#cb-foes"), null, "the combat body must no longer render once the over-panel takes over");
});

// ─── (8) a tab switch lands the round ─────────────────────────────────────

test("combat-beat-shell (8): window.__mzShowTab(\"oracle\") mid-beat ends the beat with every line in the log", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events } = midFightRound();
  const { plan } = driveHandoff(sandbox, { before, after, events });

  clock.advance(beatOffsets(plan.texts, durationFor)[1] + 10); // mid-beat

  sandbox.context.window.__mzShowTab("oracle");

  assert.equal(sandbox.context.window.__mzBeat.active(), false, "a tab switch must land the round the same way a hurry tap does");
  assert.equal(sandbox.context.window.__mzFightLog.entries.length, 3, "nothing is lost — every line stays in the log");
});

// ─── (9) handoff anchor (stripped module script) ──────────────────────────

test("combat-beat-shell (9): engineCombatAction returns right after beatRunner.start(plan) succeeds, and only reaches window.paint() when no beat started", () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const stripped = stripHtml(raw);

  const start = stripped.indexOf("function engineCombatAction(type, extra) {");
  assert.ok(start !== -1, "function engineCombatAction(type, extra) { not found");
  const end = stripped.indexOf("window.mzAttack = ", start);
  assert.ok(end !== -1 && end > start, "window.mzAttack = not found after engineCombatAction");
  const body = stripped.slice(start, end);

  const beforeIdx = body.indexOf("const before = window.__mzState.get();");
  const beforeLogIdx = body.indexOf("const beforeLog = window.__mzFightLog;");
  const dispatchIdx = body.indexOf("dispatchWithNarration(");
  assert.ok(beforeIdx !== -1 && beforeLogIdx !== -1 && dispatchIdx !== -1, "before/beforeLog/dispatchWithNarration all present");
  assert.ok(beforeIdx < dispatchIdx && beforeLogIdx < dispatchIdx, "before/beforeLog must both precede dispatchWithNarration(");

  const planIdx = body.indexOf("planBeat({");
  assert.equal((body.match(/planBeat\(\{/g) || []).length, 1, "planBeat({ must appear exactly once");
  const reducedGuardIdx = body.lastIndexOf("if (!prefersReducedMotion(window)) {", planIdx);
  assert.ok(reducedGuardIdx !== -1 && reducedGuardIdx < planIdx, "planBeat({ must sit inside the !prefersReducedMotion(window) branch");

  const startIdx = body.indexOf("beatRunner.start(plan)");
  assert.ok(startIdx !== -1 && startIdx > planIdx);
  const returnIdx = body.indexOf("return;", startIdx);
  assert.ok(returnIdx !== -1 && returnIdx - startIdx < 40, "return; must immediately follow beatRunner.start(plan)");

  const paintIdx = body.indexOf("window.paint();", returnIdx);
  const renderIdx = body.indexOf("window.renderEncounter();", paintIdx);
  assert.ok(paintIdx !== -1 && renderIdx !== -1 && paintIdx > returnIdx, "window.paint(); then window.renderEncounter(); must still close the function, reached only past the early return");
});
