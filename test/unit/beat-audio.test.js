// test/unit/beat-audio.test.js
//
// Phase 58 (MOTION-03, D-12), Plan 07 — proves the beat plays each combat
// line's clip when that line lands (not all at dispatch time), that nothing
// is lost or added versus Phase 56's pre-beat playForDispatch, that Sound
// Off stays silent through a full beat and a hurry, and that the family cry
// (fired on the `move`/`fight` dispatch that joins combat, never inside a
// beat) is unaffected.
//
// Uses REAL sfx.js against an injected fake Web Audio backend (mirrors
// test/unit/sfx.test.js's/test/unit/sfx-cues.test.js's makeFakeBackend and
// per-test state-isolation convention), a REAL createBeat/createBeatRunner
// driven by test/unit/harness/fakeClock.js's deterministic clock (no test
// here ever sleeps), and a REAL multi-line combat round resolved through
// engine/engine.js#applyAction with a fixed rngState — the same
// midFightRound() pattern test/unit/combat-beat-shell.test.js established
// (rngState 32: Goblin Grunt struck+killed on line 0, Cave Rat's critical
// strikeback folds into line 1 with no audio cue of its own once the
// dispatch's 3-clip cap is spent on hit1/foe-die/gold, "+1 wilmst" on line
// 2 carries the gold cue) — a real round whose clips land on more than one
// line, not a contrived one.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { applyAction } from "../../engine/engine.js";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import { planBeat, beatOffsets, createBeat, createBeatRunner } from "../../src/browser/combatBeat.js";
import { createFakeClock } from "./harness/fakeClock.js";
import {
  cuesForDispatch,
  clipsForDispatch,
  createVariation,
  unlockSfx,
  applySfxSettings,
  playClipIds,
  stopAllSfx,
} from "../../src/browser/sfx.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── Fake backend (mirrors test/unit/sfx.test.js's/sfx-cues.test.js's
// makeFakeBackend — the established per-file duplication convention) ──────

function makeFakeBackend() {
  const calls = { opens: 0, loads: [], starts: [], stops: [], closes: 0 };
  let nextVoice = 0;
  const backend = {
    async open() {
      calls.opens++;
      return { fakeHandle: true };
    },
    async load(handle, clipId) {
      calls.loads.push(clipId);
      return clipId; // the "buffer" IS the clip id string
    },
    start(handle, buffer) {
      calls.starts.push(buffer);
      return ++nextVoice;
    },
    stop(voice) {
      calls.stops.push(voice);
    },
    close() {
      calls.closes++;
    },
  };
  return { calls, backend };
}

function flushMicrotasks(times = 5) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => {});
  return p;
}

async function withFakeBackend(fake, fn) {
  const prevOverride = globalThis.__mzSfxBackendOverride;
  globalThis.__mzSfxBackendOverride = () => fake.backend;
  try {
    await fn();
  } finally {
    stopAllSfx();
    applySfxSettings({ sound: false });
    applySfxSettings({ sound: true });
    if (prevOverride === undefined) delete globalThis.__mzSfxBackendOverride;
    else globalThis.__mzSfxBackendOverride = prevOverride;
  }
}

// ─── fixed* helpers — copied verbatim from test/unit/combat-beat-shell.test.js's
// own fixedFighter/fixedFloor/fixedState/fixedFoe/midFightRound (itself
// copied from test/unit/combat-beat.test.js), the established real-round
// fixture for a deterministic engine.js#applyAction combat resolution. ────

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
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

/**
 * midFightRound() — a real, resolved, MID-FIGHT round (rngState 32),
 * verbatim from test/unit/combat-beat-shell.test.js: the hero attacks two
 * foes. Goblin Grunt (wp 1) is struck and killed on the FIRST folded line
 * (struck+foeKilled+goldGained fold to one line); Cave Rat (wp 40, alive)
 * strikes back on the SECOND line (struckByFoe, a critical hit); a third
 * line ("+1 wilmst") carries no foe/hero HP change. `after.combat` stays
 * set (Cave Rat is still alive) — three real fight-log lines.
 *
 * Its four mapped events (struck->hit, foeKilled->foeDie, goldGained->gold,
 * struckByFoe->hurt) hit the dispatch's 3-clip cap (DISPATCH_CLIP_CAP):
 * cuesForDispatch resolves to hit1(line0)/foe-die(line0)/gold(line2) — the
 * hurt cue is capped away, exactly as a pre-beat playForDispatch call on
 * this SAME round would drop it too (Phase 56's cap, untouched by Phase
 * 58) — so the beat's line-1 legitimately plays nothing, a real case this
 * suite must not paper over.
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

/** buildPlanFor(before, after, events, actionType) — the same three calls
 * dispatchWithNarration + engineCombatAction make in sequence: fold the
 * lines, append them to a fresh log, resolve this dispatch's cues, then
 * build the beat plan with those cues attached. */
function buildPlanFor(before, after, events, actionType = "attack", variation = createVariation()) {
  const ctx = {};
  const lines = fightLogLinesFor(actionType, events, ctx);
  const afterLog = appendFightLog(null, lines, before.combat.round);
  const cues = cuesForDispatch(actionType, events, ctx, variation);
  return planBeat({ actionType, events, before, after, beforeLog: null, afterLog, ctx, cues });
}

/** makeRunner(clock) — a real createBeat/createBeatRunner over a real fake
 * clock, playing through the exact playClipIds seam engineCombatAction's
 * own beatRunner construction uses (mazeworld.html's `playClips: (clips) =>
 * playClipIds(clips)`). */
function makeRunner(clock) {
  const beat = createBeat({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, reduced: () => false });
  return createBeatRunner({
    beat,
    durationFor: () => 0,
    onRender: () => {},
    onSettle: () => {},
    playClips: (clips) => playClipIds(clips),
  });
}

// ─── (1) per-line playback, parity with clipsForDispatch ──────────────────

test("beat-audio (1): a real beat plays only line 0's clips at start; each later offset starts exactly that line's clips; the total sequence equals clipsForDispatch computed on a parallel fresh variation", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    const { before, after, events } = midFightRound();
    const plan = buildPlanFor(before, after, events);
    assert.ok(plan, "the real round must yield a beat plan");
    assert.equal(plan.count, 3, "scenario setup must actually fold to three fight-log lines");

    const clock = createFakeClock();
    const runner = makeRunner(clock);

    runner.start(plan);
    assert.deepEqual(fake.calls.starts, ["hit1", "foe-die"], "line 0's clips (and only line 0's) must start synchronously");

    const offsets = beatOffsets(plan.texts, () => 0);
    clock.advance(offsets[1] - offsets[0]);
    assert.deepEqual(fake.calls.starts, ["hit1", "foe-die"], "line 1 carries no clip of its own (capped away) — nothing new must start");

    clock.advance(offsets[2] - offsets[1]);
    assert.deepEqual(fake.calls.starts, ["hit1", "foe-die", "gold"], "line 2's clip must start exactly at line 2's own offset");

    const expected = clipsForDispatch("attack", events, {}, createVariation());
    assert.deepEqual(fake.calls.starts, expected, "the whole beat's started-clip sequence must equal a parallel clipsForDispatch call, fresh variation each side");
  });
});

// ─── (2) hurry loses nothing ────────────────────────────────────────────

test("beat-audio (2): runner.hurry() after line 0 starts every remaining line's clips at once, in order; the beat's total equals the no-beat total", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    const { before, after, events } = midFightRound();
    const plan = buildPlanFor(before, after, events);

    const clock = createFakeClock();
    const runner = makeRunner(clock);

    runner.start(plan);
    assert.deepEqual(fake.calls.starts, ["hit1", "foe-die"]);

    runner.hurry();
    assert.deepEqual(fake.calls.starts, ["hit1", "foe-die", "gold"], "hurry must start every remaining line's clips, losing nothing");

    const expected = clipsForDispatch("attack", events, {}, createVariation());
    assert.deepEqual(fake.calls.starts, expected, "the hurried total must equal the no-beat (pre-Phase-58 playForDispatch) total");
  });
});

// ─── (3) variation rotates across beats exactly as across dispatches ─────

test("beat-audio (3): two consecutive beats of single-hit rounds start hit1 then hit2 — the same rotation two consecutive playForDispatch calls would produce", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: true });
    await unlockSfx();
    await flushMicrotasks();

    // The independent reference: two consecutive clipsForDispatch calls
    // sharing ONE variation instance — exactly how two consecutive
    // pre-beat playForDispatch dispatches would have shared sfx.js's
    // module-level defaultVariation counter.
    const reference = createVariation();
    const expected1 = clipsForDispatch("combatAction", [{ type: "struck" }], {}, reference);
    const expected2 = clipsForDispatch("combatAction", [{ type: "struck" }], {}, reference);
    assert.deepEqual(expected1, ["hit1"]);
    assert.deepEqual(expected2, ["hit2"]);

    // The beat side: two consecutive one-line rounds, sharing one variation
    // instance across their two planBeat calls, each played through its
    // own beat runner.
    const vBeat = createVariation();
    function runOneHitBeat(round) {
      const foes = [{ name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" }];
      const before = fixedState({ combat: fixedCombat(foes, { round }) });
      const events = [{ type: "struck", target: "Rat", dmg: 5 }];
      const plan = buildPlanFor(before, before, events, "combatAction", vBeat);
      assert.ok(plan, "a single-line round must still yield a plan");
      const clock = createFakeClock();
      const runner = makeRunner(clock);
      runner.start(plan);
    }

    runOneHitBeat(1);
    assert.deepEqual(fake.calls.starts, ["hit1"]);
    runOneHitBeat(2);
    assert.deepEqual(fake.calls.starts, ["hit1", "hit2"], "the second beat's clip must be the rotation's next clip, matching the reference");
  });
});

// ─── (4) Sound Off — a full beat plus a hurry record zero device activity ─

test("beat-audio (4): with Sound Off, unlockSfx plus a full beat plus a hurry record zero open()/start() calls", async () => {
  const fake = makeFakeBackend();
  await withFakeBackend(fake, async () => {
    applySfxSettings({ sound: false });
    await unlockSfx();

    const { before, after, events } = midFightRound();
    const plan = buildPlanFor(before, after, events);

    const clock = createFakeClock();
    const runner = makeRunner(clock);

    runner.start(plan);
    runner.hurry();

    assert.equal(fake.calls.opens, 0, "no audio device may be opened while Sound reads Off, whole beat included");
    assert.equal(fake.calls.starts.length, 0);
  });
});

// ─── (5) the family cry stays dispatch-time, unaffected by the beat ──────

test("beat-audio (5): the family cry is resolved by cuesForDispatch on the move/fight dispatch itself, and mazeworld.html's move path still calls dispatchWithNarration with ONE argument (dispatch-time audio)", () => {
  const cues = cuesForDispatch("move", [{ type: "combatJoined" }], { combatType: "Beasts" });
  assert.deepEqual(cues, [{ clip: "enemy-beast", idx: 0 }]);

  const htmlRaw = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
  const htmlStripped = stripHtml(htmlRaw);
  assert.ok(
    htmlStripped.includes("const { state, events, html } = dispatchWithNarration(action);"),
    "stepWith(action) — the move path's dispatch body — must still call dispatchWithNarration with exactly one argument, so its clips (including the family cry) still play at dispatch time, not deferred into a beat"
  );
});
