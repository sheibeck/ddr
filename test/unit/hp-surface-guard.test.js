// test/unit/hp-surface-guard.test.js
//
// RULES-06 (Phase 75, plan 75-08, Task 2) — the standing HP-surface guard.
// Promotes 75-01's own ad hoc "75-01-shell-audit.mjs" scratchpad reproduction
// (never committed — see .planning/debug/trap-death-21hp-oracle-minus1.md's
// "### Shell-level audit across every beat-ending path") into a permanent,
// committed test: on all EIGHT named beat-ending paths (natural settle,
// hurry, tab switch, flee, a kill, a superseded dispatch, the over-panel
// dismiss, reduced motion), every visible hero-HP readout the player can
// actually act on (#mw-hud-wp, the YOUR LOT hero card) equals engine truth
// (state.c.wp), under a deliberately worst-case fold — a two-swing foe (the
// exact shape the 2026-09-22 combatBeat.js fix closed) AND a three-foe
// landing collapse (narrationLines.js#enemyRound's OTHER fold shape).
//
// Technique: the SAME real-beat-runner-against-classic-shell approach
// test/unit/combat-beat-shell.test.js uses (a REAL createBeatRunner driven
// against the REAL classic <script>, via test/unit/harness/shellSandbox.js
// and a REAL fake clock, test/unit/harness/fakeClock.js) — helpers copied
// verbatim from that file per this plan's own instruction ("Copy the small
// helpers; do not import from another test file"), since combatBeat.js's own
// planBeat is fed hand-built before/after/events fixtures here (the SAME
// technique test/unit/combat-beat.test.js and trap-death-repro.test.js use),
// not a real engine applyAction dispatch — planBeat trusts `after` directly,
// so a hand-built "ending" round (after.combat === null) is exactly as valid
// an input as a real engine-resolved one, and lets every one of the 8 named
// paths reuse the SAME worst-case fixture instead of hunting for a real seed
// that happens to produce the exact fold shape needed.
//
// The YOUR LOT card is only ever on screen WHILE the beat is live — once an
// ending round settles, the over-panel (or the loot/dead screen) replaces
// the combat body entirely (renderEncounter()'s own !bv branches). So this
// file reads the lot card's value the instant BEFORE settle repaints —
// captured via a paint() spy (the SAME technique test 5 in
// combat-beat-shell.test.js uses to count settle calls), reading the DOM
// inside the spy, before calling through to the real paint(). Because
// createBeat's own control flow always fires the round's LAST onLine (i.e.
// the last real render) before firing onEnd/onSettle — for every one of the
// 8 named paths, natural or hurried — the DOM the spy reads is always
// exactly what a player watching the beat would have seen an instant before
// settle, on every path.

import test from "node:test";
import assert from "node:assert/strict";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import { planBeat, beatEndMs } from "../../src/browser/combatBeat.js";
import { typeDurationMs } from "../../src/browser/typewriter.js";

// durationFor — the SAME real typing-duration function shellSandbox.js's own
// createBeatRunner is wired with (`durationFor: (text) => typeDurationMs(...)`)
// — beatEndMs must be computed with the SAME function the runner itself uses
// internally, or clock.advance() undershoots the real settle time.
const durationFor = (text) => typeDurationMs(String(text ?? "").length);

// ─── fixed* helpers — copied verbatim from test/unit/combat-beat-shell.test.js
// (itself copied from combat-beat.test.js/fight-log-worst-case.test.js/
// combatPanel.test.js) — per this plan's own instruction, not imported. ─────

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

function fixedCombat(foes, overrides = {}) {
  return { foes, type: "Beasts", round: 4, target: 0, spellOpen: false, tracked: false, first: "you", ...overrides };
}

const OVER_WON = { groups: [{ title: "They fall", tone: "moss", lines: [] }], i: 0, action: null, over: "won" };
const OVER_FLED = { groups: [{ title: "You slip away", tone: "moss", lines: [] }], i: 0, action: null, over: "fled" };

// ─── scenario builders — hand-built before/after/events, the SAME technique
// combat-beat.test.js's own K-of-M regression pin and trap-death-repro
// .test.js's re-pin use (planBeat trusts `after` directly; it does not care
// how the round was resolved). ────────────────────────────────────────────

/**
 * kOfMEndingRound() — the exact worst-case fold 75-01's own shell audit used
 * (an Ogre landing two swings, 8+9=17, folded into ONE fight-log line) on a
 * round that ALSO kills the round's other foe, ending the fight as a win.
 * True final hp: 55-17=38.
 */
function kOfMEndingRound() {
  const foes = [fixedFoe({ name: "Rat", wp: 6, maxWP: 6 }), fixedFoe({ name: "Ogre", wp: 20, maxWP: 20 })];
  const before = fixedState({ combat: fixedCombat(foes), c: { wp: 55 } });
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "foeKilled", name: "Rat", spGained: 1 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 9 },
  ];
  const after = fixedState({ c: { wp: 38 }, combat: null, beats: OVER_WON });
  return { before, after, events, actionType: "attack" };
}

/**
 * fleeEndingRound() — the SAME worst-case Ogre 2-swing fold, on a flee round
 * (no hero strike; the Oracle's own "You get clear." line leads, per
 * src/browser/narrationLines.js LINE_FOR.fled). True final hp: 55-17=38.
 */
function fleeEndingRound() {
  const foes = [fixedFoe({ name: "Ogre", wp: 20, maxWP: 20 })];
  const before = fixedState({ combat: fixedCombat(foes), c: { wp: 55 } });
  const events = [
    { type: "fled" },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 9 },
  ];
  const after = fixedState({ c: { wp: 38 }, combat: null, beats: OVER_FLED });
  return { before, after, events, actionType: "flee" };
}

/**
 * threeFoeLandingEndingRound() — narrationLines.js#enemyRound's OTHER fold
 * shape: 3+ distinct foe names landing in the SAME round collapse into ONE
 * "3 foes swing, 3 land (N)" line, regardless of any one foe's own swing
 * count. The hero kills a 4th foe this round, ending the fight. True final
 * hp: 55-(4+5+6)=40.
 */
function threeFoeLandingEndingRound() {
  const foes = [
    fixedFoe({ name: "Rat", wp: 6, maxWP: 6 }),
    fixedFoe({ name: "Goblin", wp: 10, maxWP: 10 }),
    fixedFoe({ name: "Wolf", wp: 12, maxWP: 12 }),
    fixedFoe({ name: "Bat", wp: 4, maxWP: 4 }),
  ];
  const before = fixedState({ combat: fixedCombat(foes), c: { wp: 55 } });
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "foeKilled", name: "Rat", spGained: 1 },
    { type: "struckByFoe", name: "Goblin", dmg: 4 },
    { type: "struckByFoe", name: "Wolf", dmg: 5 },
    { type: "struckByFoe", name: "Bat", dmg: 6 },
  ];
  const after = fixedState({ c: { wp: 40 }, combat: null, beats: OVER_WON });
  return { before, after, events, actionType: "attack" };
}

/**
 * midFightKOfMRound() — the SAME Ogre 2-swing fold, but the fight does NOT
 * end this round (Rat survives at 1 hp, Ogre survives) — used only to drive
 * the "superseded dispatch" path's FIRST (soon-to-be-hurried) beat. True
 * hp after this round alone: 55-17=38 (not the scenario's own final check
 * value — the superseding round's own after.c.wp is).
 */
function midFightKOfMRound() {
  const foes = [fixedFoe({ name: "Rat", wp: 6, maxWP: 6 }), fixedFoe({ name: "Ogre", wp: 20, maxWP: 20 })];
  const before = fixedState({ combat: fixedCombat(foes), c: { wp: 55 } });
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 9 },
  ];
  const after = fixedState({
    c: { wp: 38 },
    combat: fixedCombat([fixedFoe({ name: "Rat", wp: 1, maxWP: 6 }), fixedFoe({ name: "Ogre", wp: 20, maxWP: 20 })]),
  });
  return { before, after, events, actionType: "attack" };
}

// ─── driveHandoff — copied verbatim from combat-beat-shell.test.js (adapted
// to take a fully hand-built {before, after, events}, never applyAction). ──

function driveHandoff(sandbox, { before, after, events, actionType = "attack" }) {
  const w = sandbox.context.window;
  const beforeLog = w.__mzFightLog;
  w.__mzState.set(after);
  const lines = fightLogLinesFor(actionType, events, {});
  w.__mzFightLog = appendFightLog(beforeLog, lines, before.combat.round);
  const plan = planBeat({ actionType, events, before, after, beforeLog, afterLog: w.__mzFightLog, ctx: {} });
  const started = sandbox.beatRunner.start(plan);
  return { plan, started };
}

function scenario({ clock, reducedMotion = false } = {}) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, reducedMotion, clock });
  return { doc, sandbox };
}

// ─── readout helpers ───────────────────────────────────────────────────────

function hudText(doc) {
  const el = doc.document.getElementById("mw-hud-wp");
  return el ? el.textContent : null;
}

function fmtHud(after) {
  return `${Math.max(0, after.c.wp)}/${after.c.maxWP} HP`;
}

function fmtLot(after) {
  return `${Math.max(0, after.c.wp)}/${after.c.maxWP}`;
}

/**
 * withLotCapture(sandbox, doc, drive) — wraps paint() (the SAME spy
 * technique combat-beat-shell.test.js's own test 5 uses) so the YOUR LOT
 * hero card's `.cb-lot-wp` text is captured the instant BEFORE each real
 * paint() call runs (i.e. exactly what was on screen from the beat's own
 * last render, before settle's renderEncounter() replaces the combat body
 * with the over-panel/loot/dead screen). `drive()` runs the path under
 * test; returns the LAST captured value (the one that matters — the final
 * settle's own pre-paint snapshot).
 */
function withLotCapture(sandbox, doc, drive) {
  const realPaint = sandbox.context.paint;
  let lastLotWp = null;
  let paintCalls = 0;
  sandbox.context.window.paint = () => {
    paintCalls++;
    const card = doc.document.getElementById("cb-lot")?.querySelector(".cb-lot-wp");
    if (card) lastLotWp = card.textContent;
    return realPaint();
  };
  drive();
  return { lastLotWp, paintCalls };
}

// ─── (1) natural settle ────────────────────────────────────────────────────

test("hp-surface-guard (1): natural settle — #mw-hud-wp and the YOUR LOT hero card both equal state.c.wp after a two-swing-foe ending round", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    const { plan } = driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(beatEndMs(plan.texts, durationFor) + 64);
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp after a natural settle");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value (captured right before settle) must equal engine-true hp");
});

// ─── (2) hurry (tap-to-hurry) ──────────────────────────────────────────────

test("hp-surface-guard (2): hurry (tap-to-hurry) — both readouts equal state.c.wp", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(50); // mid-beat, well before the round's own last line
    sandbox.context.beatHurryTap({ stopPropagation() {}, preventDefault() {} });
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp after a hurry");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp after a hurry");
});

// ─── (3) tab switch mid-beat ────────────────────────────────────────────────

test("hp-surface-guard (3): tab switch mid-beat (window.__mzShowTab, which itself hurries the beat) — both readouts equal state.c.wp", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(50);
    sandbox.context.window.__mzShowTab("oracle");
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp after a tab switch");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp after a tab switch");
});

// ─── (4) flee (combat-ending) ───────────────────────────────────────────────

test("hp-surface-guard (4): flee (combat-ending) — both readouts equal state.c.wp, even with no hero strike line leading the round", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = fleeEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    const { plan } = driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(beatEndMs(plan.texts, durationFor) + 64);
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp after a flee ending");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp after a flee ending");
});

// ─── (5) a kill (combat-ending, over-panel up) ─────────────────────────────

test("hp-surface-guard (5): a kill (combat-ending) — both readouts equal state.c.wp, and the over-panel is genuinely up once settled", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    const { plan } = driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(beatEndMs(plan.texts, durationFor) + 64);
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp once the over-panel is up");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp right before the over-panel replaced it");
  assert.ok(doc.document.getElementById("cb-over"), "sanity: the over-panel must actually be up once settled, proving this path really exercised the kill/over-panel branch");
});

// ─── (6) a superseded dispatch ──────────────────────────────────────────────

test("hp-surface-guard (6): a superseded dispatch (a second round arrives mid-first-beat) — both readouts equal the SECOND round's state.c.wp, not the first's", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const first = midFightKOfMRound();
  const second = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    driveHandoff(sandbox, first);
    clock.advance(50); // mid-first-beat — the first round has not settled yet
    // A second dispatch arriving now (createBeat#start's own "if (run)
    // hurry()" — starting a NEW beat first hurries the ACTIVE one to its own
    // onEnd) — driveHandoff below both settles `first` (via the automatic
    // hurry) AND starts `second` fresh.
    const { plan: plan2 } = driveHandoff(sandbox, second);
    clock.advance(beatEndMs(plan2.texts, durationFor) + 64);
  });

  assert.equal(hudText(doc), fmtHud(second.after), "the top HUD must read the SECOND (superseding) round's engine-true hp, not the first's");
  assert.equal(lastLotWp, fmtLot(second.after), "the YOUR LOT card's own last-frame value must equal the SECOND round's engine-true hp");
});

// ─── (7) the over-panel dismiss ─────────────────────────────────────────────

test("hp-surface-guard (7): the over-panel dismiss (S.beats = null; renderEncounter()) — the top HUD stays correct, and the panel genuinely closes", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = kOfMEndingRound();

  const { plan } = driveHandoff(sandbox, { before, after, events, actionType });
  clock.advance(beatEndMs(plan.texts, durationFor) + 64);

  assert.equal(hudText(doc), fmtHud(after), "sanity: the top HUD must already be correct once the over-panel settles");
  assert.ok(doc.document.getElementById("cb-over"), "sanity: the over-panel must be up before it is dismissed");

  // COMBAT_COPY.over[b.over].btn's own onTap, mazeworld.html renderEncounter:
  // `{ id: "cb-over-btn", ..., onTap: () => { S.beats = null; renderEncounter(); } }`.
  // `S` is a classic-script `let` binding — vm.runInContext never attaches a
  // `let` to the context object (only `var`/function declarations do), so
  // window.__mzState (the shell's own sanctioned S accessor, wired right
  // after `let S`) is the only way to reach it from outside the script.
  const live = sandbox.context.window.__mzState.get();
  live.beats = null;
  sandbox.renderEncounter();

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must STILL read engine-true hp after the over-panel is dismissed — dismissing never reverts to a stale number");
  // hidePanel() routes through the REAL, animated __mzMotion.close() under
  // non-reduced motion (this scenario's own clock) — advance past its own
  // CLOSE_MS+CLOSE_SLACK_MS (src/browser/motion.js) so `hidden` has actually
  // landed, the same margin panel-motion.test.js's own close assertions use.
  clock.advance(200);
  assert.equal(doc.document.getElementById("enc-panel").hidden, true, "sanity: the panel must actually close once nothing is left to show (hasActiveEncounter() now false)");
});

// ─── (8) reduced motion ──────────────────────────────────────────────────────

test("hp-surface-guard (8): reduced motion (the whole beat resolves synchronously, no timers) — both readouts equal state.c.wp", () => {
  const { doc, sandbox } = scenario({ reducedMotion: true }); // no clock: reduced() never needs a timer
  const { before, after, events, actionType } = kOfMEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    driveHandoff(sandbox, { before, after, events, actionType });
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp once a reduced-motion beat resolves");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp under reduced motion");
});

// ─── (9) the other fold shape: a three-foe landing collapse ────────────────
// Not one of the 8 named PATHS (all 8 above use the natural-settle-shaped
// timing) — this plan's own <behavior> also names "a three-foe landing" as
// a fold shape to exercise, alongside the two-swing-foe fold every path
// above already covers, so this pins the SAME natural-settle path against
// narrationLines.js#enemyRound's OTHER collapse rule (3+ distinct foe names
// landing together, not any one foe's own swing count).

test("hp-surface-guard (9): the other fold shape — a three-foe landing collapse on an ending round — both readouts equal state.c.wp", () => {
  const clock = createFakeClock();
  const { doc, sandbox } = scenario({ clock });
  const { before, after, events, actionType } = threeFoeLandingEndingRound();

  const { lastLotWp } = withLotCapture(sandbox, doc, () => {
    const { plan } = driveHandoff(sandbox, { before, after, events, actionType });
    clock.advance(beatEndMs(plan.texts, durationFor) + 64);
  });

  assert.equal(hudText(doc), fmtHud(after), "the top HUD must read engine-true hp after a three-foe-landing ending round");
  assert.equal(lastLotWp, fmtLot(after), "the YOUR LOT card's own last-frame value must equal engine-true hp after a three-foe-landing ending round");
});
