// test/unit/trap-death-repro.test.js
//
// RULES-06 (Phase 75, plan 75-01) — the resumed root-cause session for the
// 2026-09-22 field report ("a floor-2 trap that the Oracle showed as -1 HP
// killed a 21-HP Elven Ninja"). See .planning/debug/trap-death-21hp-oracle-
// minus1.md for the full evidence trail (the 2026-09-22 session, re-verified
// here, plus this Phase 75 session's engine-scale reproduction (500 seeds,
// ~197k actions) and shell-level 8-path audit).
//
// This file pins the two re-verified facts the debug file's Phase 75
// session confirms still hold on master (Phases 73/74 did not regress
// them): (1) the trap's narrated dmg is the SAME value subtracted from
// c.wp — narration can never disagree with the actual loss for a single
// trapSprung event; (2) planBeat's last hero-hp frame still equals the
// real final hp for a K-of-M multi-swing fold (the 2026-09-22 fix,
// src/browser/combatBeat.js, regression-tested in combat-beat.test.js —
// pinned again here as this session's own artifact, per the plan's own
// instruction to "build the states directly, the way combat-beat.test.js
// and encounters.test.js do").
//
// No production file changed by this plan — every case below is a PASSING
// pin of already-correct, already-fixed behavior. Nothing here is marked
// { todo: true } because this session's Verdict is "no NEW cause confirmed"
// (see the debug file's Phase 75 ### Verdict) — the 2026-09-22 root cause
// and its fix are re-verified, not superseded.

import test from "node:test";
import assert from "node:assert/strict";

import { springTrap } from "../../engine/encounters.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { planBeat, beatOffsets, beatEndMs } from "../../src/browser/combatBeat.js";
import { setIdentityDials } from "./harness/identityDials.js";

// Phase 54-07: this suite's damage pins are canon-mechanic numbers, so it
// runs under the same identity-dials override encounters.test.js uses.
setIdentityDials();

/** fakeRng(seq) — mirrors test/unit/encounters.test.js's own helper. */
function fakeRng(seq) {
  let i = 0;
  return {
    d: () => {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 21, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    ...overrides,
  };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 11; y++) {
    g.push([]);
    for (let x = 0; x < 11; x++) g[y].push({ wall: x === 0 || y === 0 || x === 10 || y === 10, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g, px: 5, py: 5, depth: 2, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: "Beasts", round: 3, target: 0, spellOpen: false, tracked: false, first: "you", ...overrides };
}

// ── (1) trapSprung's narrated dmg is the SAME value subtracted from c.wp ──

test("RULES-06 (Phase 75 re-verification): a sprung trap's narrated dmg equals the real c.wp loss — the report's central claim (a small narrated number killing a much-higher-hp hero) cannot happen for a single trapSprung event", () => {
  // A 21-hp Elven Ninja (the report's own numbers), floor 2 (state.floor.depth
  // set in fixedState above). dodge=20 (misses nimble=5+3 Acrobat-only bonus,
  // n/a here); trap table roll=2 -> Falling Rocks (d20); damage roll=1 -> the
  // exact "-1 HP" shape the report described.
  const state = fixedState({ c: { sub: "Thief", wp: 21 } });
  const before = state.c.wp;
  const events = springTrap(state, fakeRng([20, 2, 1]), []);

  const sprung = events.find((e) => e.type === "trapSprung");
  assert.ok(sprung, "sanity: a trapSprung event must fire on a missed dodge");
  assert.equal(sprung.dmg, 1, "sanity: this scripted roll must reproduce the report's own '-1 HP' shape");

  // The engine's own subtraction and the event's own dmg field are read off
  // the SAME local variable in engine/encounters.js#springTrap (`c.wp -=
  // dmg; ...events.push({ type: "trapSprung", ..., dmg })`) — assert the
  // OBSERVABLE consequence holds, not the implementation detail.
  assert.equal(before - state.c.wp, sprung.dmg, "the hp actually removed must equal the event's own dmg field");
  assert.equal(state.c.wp, 20, "a 21-hp hero survives a genuine -1 HP trap");
  assert.equal(state.dead, false);

  // The Oracle's own narration table reads the SAME event field — no
  // second, independently-computed number that could ever disagree.
  const line = EVENT_NARRATION.trapSprung(sprung);
  assert.match(line, /−1 hp/, "the Oracle line must print the SAME -1, not a different number");
});

test("RULES-06 (Phase 75 re-verification): a sprung trap's narrated dmg equals the real c.wp loss even when it is fatal (an overkill blow clamps c.wp to 0, not below — die() owns the clamp, not springTrap)", () => {
  // dodge=20 (miss); table roll=8 -> Spike (d10, times 5); damage roll=5 -> 25,
  // well past this hero's 21 hp — the OPPOSITE shape from the report (a
  // correctly-narrated, sufficient blow), included here because the Phase 75
  // engine-scale reproduction's own (ii) count flagged this exact shape (a
  // narratedLossSum that reads MORE than the clamped actualChange) as
  // something to explain, not a bug — see the debug file's Evidence.
  const state = fixedState({ c: { sub: "Thief", wp: 21 } });
  const events = springTrap(state, fakeRng([20, 8, 5]), []);
  const sprung = events.find((e) => e.type === "trapSprung");
  assert.equal(sprung.dmg, 25, "sanity: 5 * the Spike trap's 5x multiplier");
  assert.equal(state.c.wp, 0, "die() clamps c.wp to exactly 0, never negative");
  assert.equal(state.dead, true);
  assert.ok(events.some((e) => e.type === "died"));
});

// ── (2) planBeat's last hero-hp frame — re-pinned this session ────────────

test("RULES-06 (Phase 75 re-verification): planBeat's last hero-hp frame still equals the real final hp for a K-of-M multi-swing fold — the 2026-09-22 fix (src/browser/combatBeat.js) holds on master after Phases 73/74", () => {
  const foes = [
    { name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" },
    { name: "Ogre", alive: true, wp: 20, maxWP: 20, type: "Beasts" },
  ];
  const before = fixedState({ combat: fixedCombat(foes, { round: 4 }), c: { wp: 55 } });
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "foeKilled", name: "Rat", spGained: 1 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 9 },
  ];
  const ctx = {};

  const lines = fightLogLinesFor("attack", events, ctx);
  const ogreLine = lines.find((l) => l.text.includes("Ogre"));
  assert.ok(ogreLine, "sanity: the Ogre exchange must fold to one fight-log line");
  assert.match(ogreLine.text, /17/, "sanity: the fold's TEXT already carries the true combined damage (8+9=17)");

  const after = fixedState({ c: { wp: 55 - 17 }, combat: null }); // true final: 38
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog: null, ctx });
  assert.ok(plan);
  assert.equal(plan.ending, true);
  assert.equal(
    plan.heroHp[plan.heroHp.length - 1],
    38,
    "the LAST frame — the one on screen the instant before the over-panel/settle takes over — must equal the real final hp, never an under-count from only the fold's first constituent event (55-8=47)"
  );
});

// ── (3) Phase 75 finding: the intermediate (non-last) frame of a K-of-M ───
// fold still under-counts (blind spot 1, named-but-unfixed by the
// 2026-09-22 session) — pinned here as a KNOWN, CONFIRMED, NON-FATAL fact:
// this transient frame is never the one on screen at an actionable moment
// (combat-beat-shell.test.js's own test (4) already proves the action
// buttons stay disarmed for the WHOLE beat), so it cannot itself explain a
// death. Not a { todo: true } case — nothing here needs to change; this is
// a passing pin of a already-understood, already-bounded limitation.

test("RULES-06 (Phase 75 finding): an intermediate (not-last) K-of-M fold frame still under-counts — the true value returns on the very next line, and the ROUND's own last frame is always correct regardless", () => {
  const foes = [
    { name: "Rat", alive: true, wp: 6, maxWP: 6, type: "Beasts" },
    { name: "Ogre", alive: true, wp: 20, maxWP: 20, type: "Beasts" },
  ];
  const before = fixedState({ combat: fixedCombat(foes, { round: 4 }), c: { wp: 55 } });
  // The Ogre fold is deliberately NOT the round's last line — Rat's own
  // single hit follows it, so the fold's transient under-count is genuinely
  // on screen for one beat-gap, not masked by the last-frame pin.
  const events = [
    { type: "struck", target: "Rat", dmg: 5 },
    { type: "struckByFoe", name: "Ogre", dmg: 8 },
    { type: "struckByFoe", name: "Ogre", dmg: 9 },
    { type: "struckByFoe", name: "Rat", dmg: 2 },
  ];
  const after = fixedState({ c: { wp: 55 - 17 - 2 }, combat: fixedCombat([{ ...foes[0], wp: 1 }, foes[1]], { round: 5 }) });
  const plan = planBeat({ actionType: "attack", events, before, after, beforeLog: null, ctx: {} });
  assert.ok(plan);
  assert.equal(plan.count, 3, "sanity: three fight-log lines (hero's own hit, the Ogre fold, Rat's own hit)");

  // Frame 1 (the Ogre fold, index 1, NOT the last index 2): still reads the
  // fold's first-constituent-only under-count (55-8=47), not the true
  // running total at that point (55-17=38) — this is blind spot 1, still
  // present, and this test documents (not fixes) it.
  assert.equal(plan.heroHp[1], 47, "blind spot 1: the fold's own frame is STILL an under-count (documented, not fixed by this plan)");

  // Frame 2 (the LAST line, Rat's own single hit) is always correct — the
  // 2026-09-22 fix pins the LAST entry to after.c.wp regardless of any
  // upstream fold's own math.
  assert.equal(plan.heroHp[2], 36, "the round's own last frame is always correct: 55-17-2=36");

  // The player can never act while any of this is on screen: every offset
  // before the round's last one falls strictly inside the beat's own timed
  // window (beatOffsets/beatEndMs), during which the shell's own encArmed()
  // gate stays false for the whole beat (test/unit/combat-beat-shell.test.js
  // test (4)) — so frame 1's transient overstatement is never the number a
  // player can act on.
  const offsets = beatOffsets(plan.texts, () => 0);
  const endMs = beatEndMs(plan.texts, () => 0);
  assert.ok(offsets[1] < endMs, "the fold's own offset must fall strictly before the beat's own end — it is never the settled, actionable frame");
});
