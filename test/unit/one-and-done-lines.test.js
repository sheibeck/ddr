// test/unit/one-and-done-lines.test.js
//
// Phase 54 (BAND-02, 2026-09-21, USER RULING D) — the one-and-done
// climb/leap rule: a failed climb/leap still hurts, but the hero crosses
// either way (`draggedOver`). This file proves both in-voice lines
// (src/browser/narrationLines.js's LINE_FOR.draggedOver and
// src/browser/eventNarration.js's EVENT_NARRATION.draggedOver) render for
// both feats, are BANNED-clean, and that a real engine replay produces
// exactly the event sequence the movement.js block promises.
//
// Pure imports only (mirrors test/unit/initiative-line.test.js's BANNED-scan
// pattern and fixedState/fixedFoe helpers, copied verbatim below) — no DOM,
// no engine mutation beyond the one real replay.

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION, narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR, narrativeLineText } from "../../src/browser/narrationLines.js";
import { move } from "../../engine/movement.js";
import { GW, GH } from "../../engine/maze.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

// ─── BANNED scan (verbatim pattern from test/unit/initiative-line.test.js) ─
const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}
function assertClean(text) {
  const hits = findBannedTerms(text);
  assert.deepStrictEqual(hits, [], `BANNED scan failed for "${text}": ${JSON.stringify(hits)}`);
}

/** fakeRng(seq) — verbatim copy of test/unit/movement.test.js's helper. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0,
    ...overrides,
  };
}

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
}

function open(g, x, y, extra = {}) {
  g[y][x] = { wall: false, seen: false, feat: null, ...extra };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: { g: wallGrid(), px: 5, py: 5, depth: 1, ...floorOverrides },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

// ─── Test 1: both lines render for both feats, BANNED-clean ───────────────

test("draggedOver: both LINE_FOR and EVENT_NARRATION render for both feats, no BANNED term", () => {
  for (const feat of ["climb", "gorge"]) {
    const e = { type: "draggedOver", feat };

    const line = LINE_FOR.draggedOver(e);
    assert.equal(typeof line.text, "string");
    assert.ok(line.text.trim().length > 0, `LINE_FOR.draggedOver must render for feat=${feat}`);
    assert.equal(line.tone, "hurt");
    assertClean(line.text);

    const html = EVENT_NARRATION.draggedOver(e);
    assert.equal(typeof html, "string");
    assert.ok(html.trim().length > 0, `EVENT_NARRATION.draggedOver must render for feat=${feat}`);
    assertClean(narrativeLineText(html));

    const rendered = narrateEvent(e);
    assert.equal(rendered, html, "narrateEvent must dispatch to EVENT_NARRATION.draggedOver");
  }

  // The two feats must NOT read identically — a climb crossing and a gorge
  // crossing are different failures with different copy.
  assert.notEqual(LINE_FOR.draggedOver({ type: "draggedOver", feat: "climb" }).text, LINE_FOR.draggedOver({ type: "draggedOver", feat: "gorge" }).text);
  assert.notEqual(
    EVENT_NARRATION.draggedOver({ type: "draggedOver", feat: "climb" }),
    EVENT_NARRATION.draggedOver({ type: "draggedOver", feat: "gorge" }),
  );
});

// ─── Test 2: a bare { type } (no feat) still renders without throwing ─────

test("draggedOver: a bare { type } (no feat) still renders without throwing (defaults to the climb copy)", () => {
  assert.doesNotThrow(() => LINE_FOR.draggedOver({ type: "draggedOver" }));
  assert.doesNotThrow(() => EVENT_NARRATION.draggedOver({ type: "draggedOver" }));
  assert.ok(LINE_FOR.draggedOver({ type: "draggedOver" }).text.length > 0);
});

// ─── Test 3: a real engine replay produces the exact promised sequence ────

test("one and done (SC): a real failed climb replay pushes [fellClimbing, draggedOver, moved] and both lines render clean", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "climb" });
  // feet = 10*(1+d(2)=1) = 20; first rung r = d(10)=9 > rope.success(7) -> fail;
  // fall check for g=0: d(20)=15 (>2, hurt rolls); fall damage d6 = 4.
  const events = move(state, "N", fakeRng([1, 9, 15, 4]), []);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("fellClimbing"));
  assert.ok(types.includes("draggedOver"));
  assert.ok(types.includes("moved"), "the clean-step tail still runs after a survived failure");
  assert.ok(types.indexOf("fellClimbing") < types.indexOf("draggedOver"), "fellClimbing precedes draggedOver");
  assert.ok(types.indexOf("draggedOver") < types.indexOf("moved"), "draggedOver precedes the step tail's moved");

  const dragged = events.find((e) => e.type === "draggedOver");
  assertClean(narrativeLineText(narrateEvent(dragged)));
  assertClean(LINE_FOR.draggedOver(dragged).text);
});

test("one and done (SC): a real failed leap replay pushes [fellInGorge, draggedOver, moved]", () => {
  const state = fixedState();
  open(state.floor.g, 5, 4, { feat: "gorge" });
  // LEAP_TABLE[d(4)-1=0] -> {ft:"3-4 feet", F:10, T:10, M:9}; Fighter needs <=10;
  // r = d(10) - leapBonus(0) = 11 (fail, > need 10); fall = d6+d6.
  const events = move(state, "N", fakeRng([1, 11, 3, 4]), []);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("fellInGorge"));
  assert.ok(types.includes("draggedOver"));
  assert.ok(types.includes("moved"));
  assert.equal(events.find((e) => e.type === "draggedOver").feat, "gorge");
});
