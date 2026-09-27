// test/unit/no-descent-heal.test.js
//
// Quick fix 79-02c (user ruling 2026-09-27): "We shouldn't heal at all when
// we go down a floor." Phase 54 (BAND-02, USER RULING D) had added a
// per-floor regen — HERO_REGEN_PER_FLOOR (fitted 0.25) × maxHP restored on
// arriving at a new floor, narrated by a `floorRegen` event. The ruling
// removes it outright (greenfield: no dead path, no dial that could turn it
// back on). The stairs heal nothing; every other heal (camp, rations,
// potions, spells, Table 4 dots, the level-up HP gain added to current HP)
// is unchanged, and so is the descend SP bonus.
//
// This file runs at the SHIPPED dials (no identity override): the rule is
// about the game a player actually gets.

import test from "node:test";
import assert from "node:assert/strict";

import { descend } from "../../engine/movement.js";
import { newRun } from "../../engine/state.js";
import { makeRng } from "../../engine/rng.js";
import * as difficulty from "../../engine/difficulty.js";
import * as events from "../../engine/events.js";
import { EVENT_NARRATION, narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR, linesForAction } from "../../src/browser/narrationLines.js";
import { formatEvents } from "../../src/browser/engineAdapter.js";

const { DIALS, setDialsForTuning } = difficulty;

/** levelGain(evts) — the HP every level-up on this step added to current HP. */
const levelGain = (evts) => evts.filter((e) => e.type === "leveled").reduce((s, e) => s + (e.gained ?? e.wpGain ?? 0), 0);

test("descend heals nothing: a wounded hero arrives on the next floor with the same hp (shipped dials, several depths and seeds)", () => {
  let checked = 0;
  for (const seed of [7, 42, 606, 1234]) {
    for (const startDepth of [1, 2, 4, 7, 12]) {
      const state = newRun(seed, [], { startDepth });
      // Keep any level-up off this step so the only hp change a heal could
      // make is the one this ruling removes (the next test isolates the
      // level-up gain).
      state.c.sp = 0;
      state.c.wp = Math.max(1, Math.floor(state.c.maxWP / 3));
      const before = state.c.wp;
      const out = descend(state, makeRng(seed * 31 + startDepth), []);
      assert.equal(state.floor.depth, startDepth + 1, `seed ${seed} depth ${startDepth}: arrived`);
      assert.equal(levelGain(out), 0, `seed ${seed} depth ${startDepth}: no level-up on this step`);
      assert.equal(state.c.wp, before, `seed ${seed} depth ${startDepth}: hp unchanged on the stairs`);
      assert.ok(!out.some((e) => e.type === "floorRegen"), `seed ${seed} depth ${startDepth}: no floorRegen event`);
      checked++;
    }
  }
  assert.equal(checked, 20);
});

test("descend: a level-up on the stairs still adds its own HP gain, and nothing else comes back", () => {
  let levelled = 0;
  for (const seed of [7, 42, 606, 1234]) {
    for (const startDepth of [1, 3, 6]) {
      const state = newRun(seed, [], { startDepth });
      // Enough SP that the descend bonus tips the hero over a level.
      state.c.sp = 1e6;
      state.c.wp = 1;
      const before = state.c.wp;
      const out = descend(state, makeRng(seed + startDepth), []);
      const gain = levelGain(out);
      assert.equal(state.c.wp, before + gain, `seed ${seed} depth ${startDepth}: hp = before + level-up gain only`);
      assert.ok(!out.some((e) => e.type === "floorRegen"));
      if (gain > 0) levelled++;
    }
  }
  // Most cases level (a hero already at the level cap cannot); enough do
  // that the level-up gain is really in play.
  assert.ok(levelled >= 6, `levelled in ${levelled} of 12 cases`);
});

test("descend still grants its SP bonus (unchanged by the ruling)", () => {
  const state = newRun(7, [], { startDepth: 3 });
  state.c.sp = 0;
  const out = descend(state, makeRng(1), []);
  const sp = out.find((e) => e.type === "spGained" && e.reason === "descend");
  assert.ok(sp && sp.amount > 0, "the descend SP bonus still fires");
});

test("the per-floor regen is gone: no HERO_REGEN_PER_FLOOR dial, no heroRegenFor, no floorRegen event builder", () => {
  assert.equal("HERO_REGEN_PER_FLOOR" in DIALS, false, "the dial is deleted, not zeroed");
  assert.equal("heroRegenFor" in difficulty, false, "heroRegenFor is deleted");
  assert.equal("floorRegen" in events, false, "the floorRegen builder is deleted");
  assert.equal(Object.values(events.EVENT_TYPES).includes("floorRegen"), false, "EVENT_TYPES has no floorRegen");
});

test("a dial set that still names HERO_REGEN_PER_FLOOR fails loudly (setDialsForTuning rejects an unknown dial)", () => {
  assert.throws(() => setDialsForTuning({ HERO_REGEN_PER_FLOOR: 0.25 }), /unknown dial "HERO_REGEN_PER_FLOOR"/);
});

test("no Oracle or rail line promises a floor heal, and a stray old floorRegen event renders nothing (dropped quietly)", () => {
  assert.equal("floorRegen" in EVENT_NARRATION, false);
  assert.equal("floorRegen" in LINE_FOR, false);
  const stray = { type: "floorRegen", amount: 5, gained: 5 };
  assert.equal(narrateEvent(stray), "");
  assert.deepEqual(formatEvents([stray]), []);
  const lines = linesForAction("move", [stray, { type: "floorChanged", depth: 3 }], {});
  assert.ok(Array.isArray(lines));
  for (const l of lines) assert.doesNotMatch(String(l.text ?? ""), /keep \+\d+ hp|new floor, and the dungeon lets you/i);
});
