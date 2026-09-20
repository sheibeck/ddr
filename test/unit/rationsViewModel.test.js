// test/unit/rationsViewModel.test.js
//
// Phase 43 (CLAR-03/05), Plan 02 — direct unit coverage for
// src/browser/viewModels.js#rationsViewModel/#eatsLineFor/RATIONS_COPY: the
// ONE ration readout the Hero RATIONS panel, Joiner offer card and Company
// panel (Plan 04) will all read. The central invariant this file exists to
// pin: `rationsViewModel(state).total === nightlyEats(state)`, always —
// `total` IS `nightlyEats(state)` itself, never a re-sum, so the Hero
// sheet, the camp refusal and the fed-night charge can never disagree.

import test from "node:test";
import assert from "node:assert/strict";

import { rationsViewModel, eatsLineFor, RATIONS_COPY } from "../../src/browser/heroTab.js";
import { nightlyEats } from "../../engine/movement.js";
import { BANNED } from "../../content/safety-wordlist.js";

function collectStringLeaves(obj, pathLabel = "") {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push([pathLabel, obj]);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) leaves.push(...collectStringLeaves(v, pathLabel ? `${pathLabel}.${k}` : k));
  }
  return leaves;
}

// ─── RATIONS_COPY — frozen shape pin ────────────────────────────────────────

test("RATIONS_COPY carries the exact frozen literal shape", () => {
  assert.deepEqual(RATIONS_COPY, {
    you: "You eat {n} a rest{why}",
    member: "{name} ({race}) eats {n}{why}",
    party: "Party: {n} a rest",
    carried: "{n} carried",
    nights0: " — nothing for tonight. Camp is a rumour.",
    nights1: " — one night, then the arguing starts.",
    nightsN: " — {n} nights, then the arguing starts.",
    eats: "eats {n} a rest",
    why: { Troll: " (Troll: eats for two)" },
  });
  assert.ok(Object.isFrozen(RATIONS_COPY));
  assert.ok(Object.isFrozen(RATIONS_COPY.why));
});

test("RATIONS_COPY: every string leaf clears the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const [leafPath, value] of collectStringLeaves(RATIONS_COPY)) {
    for (const re of bannedRe) {
      assert.doesNotMatch(value, re, `RATIONS_COPY.${leafPath} -> "${value}" matches banned term ${re}`);
    }
  }
});

// ─── eatsLineFor ─────────────────────────────────────────────────────────────

test("eatsLineFor: 'eats N a rest' for Troll (2) and every other race (1); pure, no mutation", () => {
  assert.equal(eatsLineFor({ race: "Troll" }), "eats 2 a rest");
  for (const race of ["Human", "Elven", "Dwarven", "Wilmsry", "Fridgian"]) {
    assert.equal(eatsLineFor({ race }), "eats 1 a rest", race);
  }
  const sheet = { race: "Human" };
  const before = JSON.stringify(sheet);
  eatsLineFor(sheet);
  assert.equal(JSON.stringify(sheet), before, "no mutation");
});

// ─── rationsViewModel — the four worked examples from the plan's own <behavior> ─

test("rationsViewModel: a solo Human with 4 rations", () => {
  const state = { c: { name: "Ada", race: "Human", rations: 4 } };
  const v = rationsViewModel(state);
  assert.deepEqual(v.hero, { name: "Ada", race: "Human", eats: 1, why: "" });
  assert.deepEqual(v.members, []);
  assert.equal(v.total, 1);
  assert.equal(v.carried, 4);
  assert.equal(v.nights, 4);
  assert.equal(v.carriedText, "4 carried");
  assert.equal(v.line, "You eat 1 a rest · 4 carried — 4 nights, then the arguing starts.");
  assert.equal(v.total, nightlyEats(state));
  assert.equal(v.carried, state.c.rations);
});

test("rationsViewModel: a solo Troll with 3 rations — eats 2, one night, why names the rule", () => {
  const state = { c: { name: "Grunk", race: "Troll", rations: 3 } };
  const v = rationsViewModel(state);
  assert.equal(v.total, 2);
  assert.equal(v.nights, 1);
  assert.equal(v.hero.why, " (Troll: eats for two)");
  assert.equal(v.line, "You eat 2 a rest (Troll: eats for two) · 3 carried — one night, then the arguing starts.");
  assert.equal(v.total, nightlyEats(state));
});

test("rationsViewModel: a Human hero with a Troll member Grunk and 7 rations — the Party clause and 2 nights", () => {
  const state = { c: { name: "Ada", race: "Human", rations: 7 }, party: [{ name: "Grunk", race: "Troll" }] };
  const v = rationsViewModel(state);
  assert.equal(v.total, 3);
  assert.equal(v.nights, 2);
  assert.deepEqual(v.members, [{ name: "Grunk", race: "Troll", eats: 2, why: " (Troll: eats for two)" }]);
  assert.equal(
    v.line,
    "You eat 1 a rest. Grunk (Troll) eats 2 (Troll: eats for two). Party: 3 a rest · 7 carried — 2 nights, then the arguing starts.",
  );
  assert.equal(v.total, nightlyEats(state));
  assert.equal(v.carried, state.c.rations);
});

test("rationsViewModel: 0 rations reads 'nothing for tonight. Camp is a rumour.'", () => {
  const state = { c: { name: "Ada", race: "Human", rations: 0 } };
  const v = rationsViewModel(state);
  assert.equal(v.nights, 0);
  assert.equal(v.line, "You eat 1 a rest · 0 carried — nothing for tonight. Camp is a rumour.");
});

test("rationsViewModel: total === nightlyEats(state) and carried === state.c.rations across solo/Troll/party states", () => {
  const states = [
    { c: { name: "Ada", race: "Human", rations: 5 } },
    { c: { name: "Grunk", race: "Troll", rations: 9 } },
    { c: { name: "Ada", race: "Human", rations: 12 }, party: [{ name: "Grunk", race: "Troll" }, { name: "Bram", race: "Human" }] },
  ];
  for (const state of states) {
    const v = rationsViewModel(state);
    assert.equal(v.total, nightlyEats(state), JSON.stringify(state));
    assert.equal(v.carried, state.c.rations, JSON.stringify(state));
  }
});

test("rationsViewModel: pure — never mutates the input state", () => {
  const state = { c: { name: "Ada", race: "Human", rations: 4 }, party: [{ name: "Grunk", race: "Troll" }] };
  const before = JSON.stringify(state);
  rationsViewModel(state);
  assert.equal(JSON.stringify(state), before);
});
