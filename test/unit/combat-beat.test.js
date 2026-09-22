// test/unit/combat-beat.test.js
//
// Phase 58 (MOTION-03/05), Plan 02 — direct unit coverage for
// src/browser/combatBeat.js: the reveal schedule (D-10), the line/event
// alignment, the payload-only HP frames (D-09's discretion clause), the
// lossless cue ownership (D-12), the mid-fight/ending beat plan, the timer-
// driven beat controller with hurry/reduced-motion (D-11/D-17), and the
// render/sound runner (D-12).
//
// fixedFighter/fixedFloor/fixedState/fixedCombat are copied verbatim from
// test/unit/combatPanel.test.js's own fixed* helpers (itself copied from
// test/unit/fight-log-worst-case.test.js) — the established convention for
// a synthetic, hand-built combat-shaped state in this test suite.
//
// Event corpora below are hand-built, shaped exactly like engine/combat.js's
// own pushes (struck ~L792, strikeMissed ~L649, foeKilled ~L855, allyStruck
// ~L1466/~L1528, struckByFoe ~L2222) — the plan's documented fallback when a
// real applyAction() dispatch would add RNG-seeding complexity without
// adding coverage.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripJs } from "../../tools/ident-sweep.mjs";
import { fightLogLinesFor, appendFightLog } from "../../src/browser/fightLog.js";
import {
  BEAT_GAP_MS,
  beatOffsets,
  beatEndMs,
  lineIdxsFor,
  cueLines,
  foeFrames,
  heroFrames,
  frameStateFor,
  planBeat,
} from "../../src/browser/combatBeat.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const COMBAT_BEAT_PATH = path.join(REPO_ROOT, "src", "browser", "combatBeat.js");

// ─── fixed* helpers, copied verbatim from test/unit/combatPanel.test.js ──

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
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

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ─── test-local helpers ─────────────────────────────────────────────────

/** deepFreeze(obj) — recursively freezes so any accidental mutation throws (ES modules run strict). */
function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.getOwnPropertyNames(obj).forEach((key) => deepFreeze(obj[key]));
    Object.freeze(obj);
  }
  return obj;
}

/**
 * makeFakeTimerQueue() — a synchronous injectable timer: advance(ms) fires
 * every timer due by the target time, in `at` order, re-checking for newly
 * scheduled timers after each fire (a fired callback may itself schedule
 * the next one) — no promises, no real event-loop hop, matching
 * combatBeat.js's own fully-synchronous timer callbacks.
 */
function makeFakeTimerQueue() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimeout_(fn, ms) {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, ms || 0), fn });
    return id;
  }
  function clearTimeout_(id) {
    timers.delete(id);
  }
  function advance(ms) {
    const target = now + ms;
    for (;;) {
      let dueId = null;
      let due = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (due === null || t.at < due.at)) {
          dueId = id;
          due = t;
        }
      }
      if (dueId === null) break;
      timers.delete(dueId);
      now = due.at;
      due.fn();
    }
    now = target;
  }
  return { setTimeout: setTimeout_, clearTimeout: clearTimeout_, advance, now: () => now };
}

// ═══════════════════════════════════════════════════════════════════════
// Task 1 — schedule, line/event alignment, HP frames, cue ownership,
// frame states, the beat plan.
// ═══════════════════════════════════════════════════════════════════════

test("combatBeat: BEAT_GAP_MS is 600", () => {
  assert.equal(BEAT_GAP_MS, 600);
});

test("combatBeat: beatOffsets lands the first line at 0, paces later lines at max(BEAT_GAP_MS, prior duration)", () => {
  assert.deepEqual(beatOffsets(["a", "b", "c"]), [0, 600, 1200]);
  const durationFor = (t) => t.length * 100;
  assert.deepEqual(beatOffsets(["aaaaaaa", "b"], durationFor), [0, 700]);
  assert.deepEqual(beatOffsets([]), []);
  assert.deepEqual(beatOffsets(["x"]), [0]);
});

test("combatBeat: beatEndMs is the last line's own offset plus its own typing duration", () => {
  assert.equal(beatEndMs(["a", "b"], () => 0), 600);
  assert.equal(beatEndMs(["a", "b"], () => 300), 900);
  assert.equal(beatEndMs([]), 0);
});

test("combatBeat: lineIdxsFor is aligned 1:1 with fightLogLinesFor over a corpus", () => {
  const cases = [
    { name: "plain hit", events: [{ type: "struck", target: "Rat", dmg: 5 }] },
    {
      name: "hit plus foeKilled (a fold)",
      events: [{ type: "struck", target: "Rat", dmg: 5 }, { type: "foeKilled", name: "Rat", spGained: 1 }],
    },
    {
      name: "two struckByFoe from different foes",
      events: [{ type: "struckByFoe", name: "Rat", dmg: 3 }, { type: "struckByFoe", name: "Ogre", dmg: 2 }],
    },
    {
      name: "a spell chain",
      events: [{ type: "spellThrown", target: "Rat", spell: "Fire" }, { type: "spellHit", target: "Rat", dmg: 6 }],
    },
    { name: "a dull refusal", events: [{ type: "strikeRefused" }] },
    { name: "an empty list", events: [] },
  ];
  for (const { name, events } of cases) {
    const idxs = lineIdxsFor("attack", events, {});
    const lines = fightLogLinesFor("attack", events, {});
    assert.equal(idxs.length, lines.length, `${name}: idx count must match line count`);
    for (const idx of idxs) {
      assert.ok(Number.isInteger(idx) && idx >= 0 && idx < events.length, `${name}: idx ${idx} must be a valid events index`);
    }
  }
});

test("combatBeat: lineIdxsFor returns [] for a non-array events", () => {
  assert.deepEqual(lineIdxsFor("attack", null, {}), []);
  assert.deepEqual(lineIdxsFor("attack", "not-an-array", {}), []);
});

test("combatBeat: cueLines assigns each cue to the line with the greatest idx <= the cue's idx; ties go to the earlier line; nothing is dropped", () => {
  const cues = [
    { clip: "walk1", idx: -1 },
    { clip: "hit1", idx: 0 },
    { clip: "hurt1", idx: 3 },
    { clip: "foe-die", idx: 1 },
  ];
  assert.deepEqual(cueLines(cues, [2, 0]), [["walk1", "hurt1"], ["hit1", "foe-die"]]);

  const flattened = cueLines(cues, [2, 0]).flat();
  assert.deepEqual([...flattened].sort(), cues.map((c) => c.clip).sort(), "the flattened result must be a permutation of the input clips");
});

test("combatBeat: cueLines puts everything in a single line-0 bucket when idxs is empty", () => {
  const cues = [{ clip: "a", idx: -1 }, { clip: "b", idx: 5 }];
  assert.deepEqual(cueLines(cues, []), [["a", "b"]]);
});

test("combatBeat: foeFrames moves only the foe a line's event names uniquely, cumulative, hit reset per line", () => {
  const foes = [{ name: "Rat", wp: 6, alive: true }, { name: "Ogre", wp: 20, alive: true }];
  const lineEvents = [
    { type: "struck", target: "Ogre", dmg: 5 },
    { type: "struckByFoe", name: "Rat", dmg: 2 },
    { type: "struck", target: "Rat", dmg: 9 },
  ];
  const frames = foeFrames(foes, lineEvents);
  assert.equal(frames.length, 3);
  assert.deepEqual(frames[0], [
    { wp: 6, alive: true, hit: false },
    { wp: 15, alive: true, hit: true },
  ]);
  assert.deepEqual(frames[1], [
    { wp: 6, alive: true, hit: false },
    { wp: 15, alive: true, hit: false },
  ]);
  assert.deepEqual(frames[2], [
    { wp: 0, alive: false, hit: true },
    { wp: 15, alive: true, hit: false },
  ]);
});

test("combatBeat: foeFrames leaves an ambiguous shared-name event unresolved; resolves once only one foe of that name still stands", () => {
  const twoGoblins = [{ name: "Goblin", wp: 5, alive: true }, { name: "Goblin", wp: 5, alive: true }];

  const struckAmbiguous = foeFrames(twoGoblins, [{ type: "struck", target: "Goblin", dmg: 3 }]);
  assert.deepEqual(struckAmbiguous[0], [
    { wp: 5, alive: true, hit: false },
    { wp: 5, alive: true, hit: false },
  ]);

  const killedAmbiguous = foeFrames(twoGoblins, [{ type: "foeKilled", name: "Goblin" }]);
  assert.deepEqual(killedAmbiguous[0], [
    { wp: 5, alive: true, hit: false },
    { wp: 5, alive: true, hit: false },
  ]);

  const oneDown = [{ name: "Goblin", wp: 5, alive: false }, { name: "Goblin", wp: 5, alive: true }];
  const resolved = foeFrames(oneDown, [{ type: "struck", target: "Goblin", dmg: 3 }]);
  assert.deepEqual(resolved[0], [
    { wp: 5, alive: false, hit: false },
    { wp: 2, alive: true, hit: true },
  ]);
});

test("combatBeat: foeFrames changes nothing for a non-numeric dmg or an unrecognized event type", () => {
  const foes = [{ name: "Rat", wp: 6, alive: true }];
  const frames = foeFrames(foes, [
    { type: "struck", target: "Rat", dmg: "five" },
    { type: "somethingElse", target: "Rat", dmg: 5 },
  ]);
  assert.deepEqual(frames[0], [{ wp: 6, alive: true, hit: false }]);
  assert.deepEqual(frames[1], [{ wp: 6, alive: true, hit: false }]);
});

test("combatBeat: heroFrames is cumulative hero HP, clamped at 0, moved only by a numeric struckByFoe.dmg", () => {
  const frames = heroFrames(20, [
    { type: "struckByFoe", dmg: 3 },
    { type: "struck", target: "Rat", dmg: 4 },
    { type: "struckByFoe", dmg: 30 },
  ]);
  assert.deepEqual(frames, [17, 17, 0]);
});

test("combatBeat: frameStateFor returns a new state with only the frame's foe wp/alive and c.wp overridden; a base without combat is returned as-is", () => {
  const before = deepFreeze(fixedState({ combat: fixedCombat([{ name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" }], { round: 1 }) }));
  const frame = [{ wp: 1, alive: true, hit: true }];
  const framed = frameStateFor(before, frame, 40);

  assert.notEqual(framed, before);
  assert.equal(framed.combat.foes[0].wp, 1);
  assert.equal(framed.combat.foes[0].alive, true);
  assert.equal(framed.combat.foes[0].name, "Rat", "every other foe field must be kept");
  assert.equal(framed.combat.foes[0].maxWP, 6, "every other foe field must be kept");
  assert.equal(framed.c.wp, 40);
  assert.equal(framed.c.name, before.c.name, "every other c field must be kept");
  assert.equal(before.combat.foes[0].wp, 6, "the base object must be unchanged");
  assert.equal(before.c.wp, 55, "the base object must be unchanged");

  const withoutCombat = deepFreeze(fixedState());
  assert.equal(frameStateFor(withoutCombat, [], 10), withoutCombat, "a base with no combat is returned as-is");
});

// ─── planBeat ────────────────────────────────────────────────────────────

function planBeatFixtures() {
  const foes = [{ name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" }];
  const before = fixedState({ combat: fixedCombat(foes, { round: 2 }) });
  const events = [{ type: "struck", target: "Rat", dmg: 5 }];
  const ctx = {};
  const lines = fightLogLinesFor("attack", events, ctx);
  return { before, events, ctx, lines };
}

test("combatBeat: planBeat returns null when before has no combat, after.combat.pending is true, events is not an array, or the fold yields zero lines", () => {
  const { before, events, ctx } = planBeatFixtures();
  const afterMid = fixedState({ combat: fixedCombat(before.combat.foes.map((f) => ({ ...f, wp: 1 })), { round: before.combat.round }) });

  const noCombatBefore = fixedState({ combat: null });
  assert.equal(planBeat({ actionType: "attack", events, before: noCombatBefore, after: afterMid, ctx }), null);

  const pendingAfter = fixedState({ combat: { ...fixedCombat(before.combat.foes, { round: before.combat.round }), pending: true } });
  assert.equal(planBeat({ actionType: "attack", events, before, after: pendingAfter, ctx }), null);

  assert.equal(planBeat({ actionType: "attack", events: "not-an-array", before, after: afterMid, ctx }), null);
  assert.equal(planBeat({ actionType: "attack", events: null, before, after: afterMid, ctx }), null);

  assert.equal(planBeat({ actionType: "attack", events: [], before, after: afterMid, ctx }), null, "zero-line fold must return null");
});

test("combatBeat: planBeat for a mid-fight round uses afterLog as the log; firstId lines up with this batch; ending is false", () => {
  const { before, events, ctx, lines } = planBeatFixtures();
  const afterMid = fixedState({ combat: fixedCombat([{ ...before.combat.foes[0], wp: 1 }], { round: before.combat.round }) });
  const afterLog = appendFightLog(null, lines, before.combat.round);

  const plan = planBeat({ actionType: "attack", events, before, after: afterMid, beforeLog: null, afterLog, ctx });
  assert.ok(plan);
  assert.equal(plan.ending, false);
  assert.equal(plan.log, afterLog);
  assert.equal(plan.firstId, afterLog.nextId - plan.count);
  const batch = afterLog.entries.filter((e) => e.id >= plan.firstId);
  assert.equal(batch.length, plan.count);
  assert.deepEqual(batch.map((e) => e.text), lines.map((l) => l.text));
});

test("combatBeat: planBeat for an ending round builds the log via appendFightLog(beforeLog, lines, round); ending is true; a null beforeLog still builds from an empty log", () => {
  const { before, events, ctx, lines } = planBeatFixtures();
  const afterEnding = fixedState({ combat: null });

  const plan1 = planBeat({ actionType: "attack", events, before, after: afterEnding, beforeLog: null, ctx });
  assert.ok(plan1);
  assert.equal(plan1.ending, true);
  assert.deepEqual(plan1.log, appendFightLog(null, lines, before.combat.round));
  assert.equal(plan1.log.entries[0].id, 1, "a null beforeLog must still build from an empty log");

  const priorLog = appendFightLog(null, [{ text: "earlier", tone: "narrative", roll: null }], 1);
  const plan2 = planBeat({ actionType: "attack", events, before, after: afterEnding, beforeLog: priorLog, ctx });
  assert.deepEqual(plan2.log, appendFightLog(priorLog, lines, before.combat.round));
});

test("combatBeat: planBeat never mutates before, after, beforeLog, afterLog or events — deep-frozen inputs do not throw", () => {
  const { before, events, ctx, lines } = planBeatFixtures();
  const afterMid = fixedState({ combat: fixedCombat([{ ...before.combat.foes[0], wp: 1 }], { round: before.combat.round }) });
  const afterLog = appendFightLog(null, lines, before.combat.round);
  const beforeLog = appendFightLog(null, [{ text: "earlier", tone: "narrative", roll: null }], 1);

  const frozenBefore = deepFreeze(JSON.parse(JSON.stringify(before)));
  const frozenAfter = deepFreeze(JSON.parse(JSON.stringify(afterMid)));
  const frozenEvents = deepFreeze(JSON.parse(JSON.stringify(events)));
  const frozenBeforeLog = deepFreeze(JSON.parse(JSON.stringify(beforeLog)));
  const frozenAfterLog = deepFreeze(JSON.parse(JSON.stringify(afterLog)));

  assert.doesNotThrow(() =>
    planBeat({
      actionType: "attack",
      events: frozenEvents,
      before: frozenBefore,
      after: frozenAfter,
      beforeLog: frozenBeforeLog,
      afterLog: frozenAfterLog,
      ctx,
    })
  );
});

test("combatBeat: planBeat exposes cueLines(cues, idxs) as plan.cueLines; every entry is [] when cues is omitted", () => {
  const foes = [
    { name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" },
    { name: "Ogre", alive: true, wp: 20, maxWP: 20, type: "Beasts" },
  ];
  const before = fixedState({ combat: fixedCombat(foes, { round: 1 }) });
  const afterMid = fixedState({ combat: fixedCombat(foes, { round: 1 }) });
  const events = [
    { type: "struckByFoe", name: "Rat", dmg: 3 },
    { type: "struckByFoe", name: "Ogre", dmg: 2 },
  ];
  const ctx = {};
  const idxs = lineIdxsFor("attack", events, ctx);
  const cues = [
    { clip: "hurt1", idx: idxs[0] },
    { clip: "hurt2", idx: idxs[1] },
  ];
  const afterLog = appendFightLog(null, fightLogLinesFor("attack", events, ctx), before.combat.round);

  const withCues = planBeat({ actionType: "attack", events, before, after: afterMid, afterLog, ctx, cues });
  assert.deepEqual(withCues.cueLines, cueLines(cues, idxs));

  const withoutCues = planBeat({ actionType: "attack", events, before, after: afterMid, afterLog, ctx });
  assert.equal(withoutCues.cueLines.length, 2);
  assert.ok(withoutCues.cueLines.every((arr) => Array.isArray(arr) && arr.length === 0));
});

// ─── source scan ─────────────────────────────────────────────────────────

test("combatBeat: source scan — imports only ./fightLog.js and ./narrationLines.js, touches neither window nor document, draws no Math.random", () => {
  const raw = fs.readFileSync(COMBAT_BEAT_PATH, "utf8").replace(/\r\n/g, "\n");
  const stripped = stripJs(raw);

  const importSpecifiers = [...stripped.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(importSpecifiers)].sort(), ["./fightLog.js", "./narrationLines.js"]);

  assert.doesNotMatch(stripped, /\bwindow\b/, "combatBeat.js must never read window");
  assert.doesNotMatch(stripped, /\bdocument\b/, "combatBeat.js must never read document");
  assert.doesNotMatch(stripped, /Math\.random/, "combatBeat.js must draw no pseudo-random number");
});
