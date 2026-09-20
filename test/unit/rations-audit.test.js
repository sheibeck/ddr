// test/unit/rations-audit.test.js
//
// Phase 43 (CLAR-03/05) — the ration/upkeep audit's pin test. Proves the ONE
// appetite read (`eatsFor`) is value-identical to the three inline reads it
// replaced, that the new `rationsEaten`/`wentHungry` payload shapes are
// exactly what docs/RATIONS.md declares, that `makeCamp`'s refusal shape is
// untouched, and that every numeric claim the ledger states (upkeep by
// race/Heft, starting rations by class, `cooked`/`buyRations`/`clampCarry`)
// is true against the live engine — not hand-computed. Also parses
// docs/RATIONS.md's own `## Rules (audited)` table so the ledger can never
// silently drift from the engine files it names.
//
// Mirrors test/unit/movement.test.js's fakeRng/fixedFighter/fixedState/
// member helpers verbatim (same discipline: each test documents, in order,
// exactly which die roll the engine consumes).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { GW, GH } from "../../engine/maze.js";
import { move, newDay, makeCamp, nightlyEats, eatsFor } from "../../engine/movement.js";
import { upkeep, clampCarry } from "../../engine/derived.js";
import { killFoe } from "../../engine/combat.js";
import { STORE_EFFECTS } from "../../engine/economy.js";
import { newRun } from "../../engine/state.js";
import { BAGS } from "../../content/index.js";
import { EVENT_NARRATION, RATION_RULE_LINE, narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR, narrativeLineText } from "../../src/browser/narrationLines.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws on underflow (doubles as a "no more draws
 * expected" assertion). Ports test/unit/movement.test.js's helper verbatim. */
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

function wallGrid() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, seen: false, feat: null });
  }
  return g;
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

function member(overrides = {}) {
  return fixedFighter({ name: "Hired Muscle", ...overrides });
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

// ─── eatsFor / nightlyEats ──────────────────────────────────────────────────

test("eatsFor: Troll=2; Human/Elven/Dwarven/Wilmsry/Fridgian=1; {} and null default to 1", () => {
  assert.equal(eatsFor({ race: "Troll" }), 2);
  for (const race of ["Human", "Elven", "Dwarven", "Wilmsry", "Fridgian"]) {
    assert.equal(eatsFor({ race }), 1, race);
  }
  assert.equal(eatsFor({}), 1);
  assert.equal(eatsFor(null), 1);
});

test("nightlyEats: solo Human=1, solo Troll=2, Human+Troll member=3, Troll+two Human members=4", () => {
  assert.equal(nightlyEats(fixedState()), 1, "solo Human");
  assert.equal(nightlyEats(fixedState({ c: { race: "Troll" } })), 2, "solo Troll");
  assert.equal(nightlyEats(fixedState({ party: [member({ race: "Troll" })] })), 3, "Human + Troll member");
  assert.equal(
    nightlyEats(fixedState({ c: { race: "Troll" }, party: [member({ race: "Human" }), member({ race: "Human" })] })),
    4,
    "Troll + two Human members",
  );
});

// ─── newDay: rationsEaten (fed) ─────────────────────────────────────────────

test("newDay fed: pushes dayBegan, then rationsEaten (exact keys), then rested — eats/left/eaters all agree with nightlyEats/c.rations/eatsFor", () => {
  const state = fixedState({ c: { rations: 6, wp: 10 }, party: [member({ name: "Grunk", race: "Troll" })] });
  const before = state.c.rations;
  const eatsExpected = nightlyEats(state);
  const rng = fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]); // heal roll + 8 safe monster-check draws
  const events = newDay(state, false, rng, []);
  const types = events.map((e) => e.type);
  assert.equal(types[0], "dayBegan");
  const rationsIdx = types.indexOf("rationsEaten");
  assert.ok(rationsIdx > 0, "rationsEaten follows dayBegan");
  const evt = events[rationsIdx];
  assert.deepEqual(Object.keys(evt).sort(), ["eats", "eaters", "left", "type"].sort());
  assert.equal(evt.eats, eatsExpected);
  assert.equal(evt.left, state.c.rations);
  assert.equal(state.c.rations, before - eatsExpected, "arithmetic unchanged");
  assert.deepEqual(evt.eaters[0], { name: state.c.name, race: state.c.race, eats: eatsFor(state.c), hero: true });
  assert.deepEqual(evt.eaters[1], { name: "Grunk", race: "Troll", eats: 2 });
  const restedIdx = types.indexOf("rested");
  assert.ok(restedIdx > rationsIdx, "rested comes after rationsEaten");
});

test("newDay fed, solo, no heal (already at max hp): rationsEaten still fires with a single-eater eaters array", () => {
  const state = fixedState({ c: { rations: 6, wp: 55, maxWP: 55 } });
  const rng = fakeRng([1, 2, 2, 2, 2, 2, 2, 2, 2]); // heal 1 -> min(55, 55+1)=55, no rested push
  const events = newDay(state, false, rng, []);
  assert.ok(!events.some((e) => e.type === "rested"), "no hp headroom means no rested event");
  const evt = events.find((e) => e.type === "rationsEaten");
  assert.equal(evt.eats, 1);
  assert.equal(evt.left, 5);
  assert.deepEqual(evt.eaters, [{ name: state.c.name, race: state.c.race, eats: 1, hero: true }]);
});

// ─── newDay: wentHungry (unfed) ─────────────────────────────────────────────

test("newDay unfed, solo: wentHungry carries need/have/mouths, no heft key when the hero lacks Heft", () => {
  const state = fixedState({ c: { rations: 0, wp: 20 } });
  const events = newDay(state, false, fakeRng([2, 2, 2, 2, 2, 2, 2, 2]), []); // 8 safe monster checks
  const hungry = events.find((e) => e.type === "wentHungry");
  assert.deepEqual(Object.keys(hungry).sort(), ["cost", "have", "mouths", "need", "type"].sort());
  assert.equal(hungry.need, nightlyEats(state) === 1 ? 1 : hungry.need, "need equals the solo hero's own appetite");
  assert.equal(hungry.have, 0);
  assert.equal(hungry.mouths, 1);
  assert.equal(hungry.heft, undefined);
});

test("newDay unfed, with a live member: need/mouths count the party, matching nightlyEats/1+party.length", () => {
  const state = fixedState({ c: { rations: 0, wp: 20 }, party: [member({ race: "Human" })] });
  const need = nightlyEats(state);
  const events = newDay(state, false, fakeRng([2, 2, 2, 2, 2, 2, 2, 2]), []); // cost 8, wp 20 survives
  const hungry = events.find((e) => e.type === "wentHungry");
  assert.equal(hungry.need, need, "hero(1)+member(1)=2");
  assert.equal(hungry.mouths, 2);
});

test("newDay unfed with Heft: wentHungry carries heft:true and the halved (floored) cost", () => {
  const state = fixedState({ c: { rations: 0, wp: 20, skills: { Heft: 1 } } });
  const events = newDay(state, false, fakeRng([2, 2, 2, 2, 2, 2, 2, 2]), []); // upkeep halved to 2, survives
  const hungry = events.find((e) => e.type === "wentHungry");
  assert.equal(hungry.heft, true);
  assert.equal(hungry.cost, upkeep(state.c));
});

// ─── makeCamp: shape unchanged, members[].eats reads eatsFor ───────────────

test("makeCamp: the solo refusal shape is byte-identical, and members[].eats equals eatsFor(m)", () => {
  const state = fixedState({ c: { rations: 0 } });
  const events = makeCamp(state, fakeRng([]), []);
  assert.deepStrictEqual(events.find((e) => e.type === "campFailed"), { type: "campFailed", reason: "noRations", need: 1, have: 0 });

  const withMembers = fixedState({
    c: { rations: 0 },
    party: [member({ name: "Grunk", race: "Troll" }), member({ name: "Bram", race: "Human" })],
  });
  const events2 = makeCamp(withMembers, fakeRng([]), []);
  const failed = events2.find((e) => e.type === "campFailed");
  assert.deepStrictEqual(failed.members, [
    { name: "Grunk", eats: eatsFor({ race: "Troll" }) },
    { name: "Bram", eats: eatsFor({ race: "Human" }) },
  ]);
});

// ─── audit outcome pins ─────────────────────────────────────────────────────

test("audit pin: upkeep(c) — Human 4, Dwarven 1, Troll 15, Heft halves (Dwarven floors at 1)", () => {
  assert.equal(upkeep({ race: "Human", skills: {}, items: [] }), 4);
  assert.equal(upkeep({ race: "Dwarven", skills: {}, items: [] }), 1);
  assert.equal(upkeep({ race: "Troll", skills: {}, items: [] }), 15);
  assert.equal(upkeep({ race: "Human", skills: { Heft: 1 }, items: [] }), 2);
  assert.equal(upkeep({ race: "Dwarven", skills: { Heft: 1 }, items: [] }), 1, "max(1, ...) floor");
});

test("audit pin: starting rations are Fighter 6 / Thief 5 / Magic User 4 (chargen fixture seeds 1/2/7)", () => {
  const fighter = newRun(1);
  assert.equal(fighter.c.cls, "Fighter");
  assert.equal(fighter.c.rations, 6);

  const thief = newRun(2);
  assert.equal(thief.c.cls, "Thief");
  assert.equal(thief.c.rations, 5);

  const mu = newRun(7);
  assert.equal(mu.c.cls, "Magic User");
  assert.equal(mu.c.rations, 4);
});

test("audit pin: the fed-night heal doubles for a Wilmsry hero (heal2x) and for any Soldier, naming which", () => {
  const wilmsry = fixedState({ c: { race: "Wilmsry", sub: "Ranger", rations: 6, wp: 10 } });
  const events1 = newDay(wilmsry, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(events1.find((e) => e.type === "rested").doubled, "Wilmsry");

  const soldier = fixedState({ c: { race: "Human", sub: "Soldier", rations: 6, wp: 10 } });
  const events2 = newDay(soldier, false, fakeRng([5, 2, 2, 2, 2, 2, 2, 2, 2]), []);
  assert.equal(events2.find((e) => e.type === "rested").doubled, "Soldier");
});

test("audit pin: a Cooking-skilled Beast kill always adds exactly 1 ration (no cook-luck roll drawn)", () => {
  const state = fixedState({ c: { skills: { Cooking: 1 }, rations: 3 } });
  const foe = fixedFoe({ type: "Beasts", wp: 0, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  const events = killFoe(state, foe, fakeRng([4, 6, 20]), []); // sp d6, coin d10, treasure-check d20 (skips)
  const cooked = events.find((e) => e.type === "cooked");
  assert.ok(cooked);
  assert.equal(cooked.rations, 1);
  assert.equal(state.c.rations, 4);
});

test("audit pin: an unskilled Beast kill adds exactly 1 ration on a lucky (>=4) d6 meat roll", () => {
  const state = fixedState({ c: { skills: {}, rations: 3 } });
  const foe = fixedFoe({ type: "Beasts", wp: 0, maxWP: 20 });
  state.combat = fixedCombat([foe]);
  const events = killFoe(state, foe, fakeRng([4, 6, 20, 4]), []); // sp, coin, treasure-check skip, meat-luck roll 4
  const cooked = events.find((e) => e.type === "cooked");
  assert.ok(cooked);
  assert.equal(cooked.rations, 1);
  assert.equal(state.c.rations, 4);
});

test("audit pin: STORE_EFFECTS.buyRations adds params.amount ?? 1", () => {
  const state = fixedState({ c: { rations: 2 } });
  const events = [];
  STORE_EFFECTS.buyRations(state, {}, events);
  assert.equal(state.c.rations, 3);
  assert.ok(events.some((e) => e.type === "rationsBought" && e.amount === 1));

  const state2 = fixedState({ c: { rations: 2 } });
  STORE_EFFECTS.buyRations(state2, { amount: 5 }, []);
  assert.equal(state2.c.rations, 7);
});

test("audit pin: clampCarry caps c.rations at BAGS[c.bag].rations", () => {
  const c = { bag: "small", rations: 999, items: [], gold: 0 };
  clampCarry(c);
  assert.equal(c.rations, BAGS.small.rations);
});

// 260918-w4n (deviation — this file is not in the plan's file list, but its
// literal line-count pin moved when the Cloak of Healing/Regeneration
// per-step tick block was deleted from engine/movement.js, taking its one
// `rng.d(6)` line with it): re-measured live at 19 (22 - 3: the deleted
// block's rng.d(6) plus two now-gone comment lines that happened to contain
// the string "rng." — re-verify against the live file if this ever moves
// again rather than hand-adjusting).
test("draw-count pin: engine/movement.js's rng.-bearing line count is unchanged by rations work (grep -c parity, 19 post-260918-w4n)", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "engine", "movement.js"), "utf8");
  const lineCount = src.split("\n").filter((l) => l.includes("rng.")).length;
  assert.equal(lineCount, 19, "eatsFor/rationsEaten/wentHungry are all additive reads/pushes, never a new rng draw");
});

// ─── narration (Task 2): exact Oracle strings, line texts, RATION_RULE_LINE ─

test("narration: RATION_RULE_LINE names the Troll doubling rule; both builders are functions", () => {
  assert.deepEqual(RATION_RULE_LINE, { Troll: "Trolls eat for two." });
  assert.equal(typeof EVENT_NARRATION.rationsEaten, "function");
  assert.equal(typeof EVENT_NARRATION.wentHungry, "function");
});

test("narration: rationsEaten renders the exact Oracle sentence for a single fed hero, a Troll hero, and a mixed party", () => {
  const t = (e) => narrativeLineText(narrateEvent(e));
  assert.equal(
    t({ type: "rationsEaten", eats: 1, left: 4, eaters: [{ name: "Ada", race: "Human", eats: 1, hero: true }] }),
    "Rations: you eat 1. −1 ration, 4 left.",
  );
  assert.equal(
    t({ type: "rationsEaten", eats: 2, left: 3, eaters: [{ name: "Grunk", race: "Troll", eats: 2, hero: true }] }),
    "Rations: you eat 2. Trolls eat for two. −2 rations, 3 left.",
  );
  assert.equal(
    t({
      type: "rationsEaten",
      eats: 3,
      left: 4,
      eaters: [
        { name: "Ada", race: "Human", eats: 1, hero: true },
        { name: "Grunk", race: "Troll", eats: 2 },
      ],
    }),
    "Rations: you eat 1; Grunk (Troll) eats 2. Trolls eat for two. −3 rations, 4 left.",
  );
});

test("narration: a bare rationsEaten payload renders a non-empty string without throwing", () => {
  assert.doesNotThrow(() => EVENT_NARRATION.rationsEaten({ type: "rationsEaten" }));
  const text = narrativeLineText(narrateEvent({ type: "rationsEaten" }));
  assert.ok(text.length > 0);
});

test("narration: wentHungry renders the exact Oracle sentence (solo, party, and the Heft clause)", () => {
  const t = (e) => narrativeLineText(narrateEvent(e));
  assert.equal(
    t({ type: "wentHungry", cost: 4, need: 1, have: 0, mouths: 1 }),
    "Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −4 hp.",
  );
  assert.equal(
    t({ type: "wentHungry", cost: 6, need: 3, have: 1, mouths: 2 }),
    "Hunger: nobody packed — the party eats 3 a night, and you had 1. Cost of living −6 hp.",
  );
  assert.equal(
    t({ type: "wentHungry", cost: 2, need: 1, have: 0, mouths: 1, heft: true }),
    "Hunger: nobody packed — you eat 1 a night, and you had 0. Cost of living −2 hp (Heft: half, as promised).",
  );
});

test("narration: a bare wentHungry payload renders without throwing and contains 'Hunger:'", () => {
  assert.doesNotThrow(() => EVENT_NARRATION.wentHungry({ type: "wentHungry" }));
  const text = narrativeLineText(narrateEvent({ type: "wentHungry" }));
  assert.ok(text.includes("Hunger:"));
});

test("narration: LINE_FOR.rationsEaten/.wentHungry render the terse line texts", () => {
  assert.equal(LINE_FOR.rationsEaten({ type: "rationsEaten", eats: 3, left: 4 }).text, "Rations: −3 (4 left).");
  assert.equal(LINE_FOR.rationsEaten({ type: "rationsEaten", eats: 3, left: 4 }).tone, "beat");
  assert.equal(LINE_FOR.wentHungry({ type: "wentHungry", cost: 4 }).text, "Hunger: no rations (−4 hp).");
});

// ─── docs/RATIONS.md ledger pin ─────────────────────────────────────────────

test("docs/RATIONS.md ledger: at least 12 audited rules, every Engine-site .js path exists, missing-rules verdict recorded", () => {
  const doc = fs.readFileSync(path.join(REPO_ROOT, "docs", "RATIONS.md"), "utf8");
  const rows = doc.split("\n").filter((l) => /^\| R\d+ \|/.test(l));
  assert.ok(rows.length >= 12, `expected >= 12 audited rules, found ${rows.length}`);

  const jsPathRe = /`([\w./-]+\.js)/g;
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim());
    const engineSite = cells[5] || "";
    let m;
    while ((m = jsPathRe.exec(engineSite))) {
      const filePath = path.join(REPO_ROOT, m[1]);
      assert.ok(fs.existsSync(filePath), `Engine site references a missing file: ${m[1]} (row: ${row})`);
    }
    jsPathRe.lastIndex = 0;
  }

  const missingSection = doc.split("## Missing prototype rules found")[1]?.split("\n## ")[0] ?? "";
  const body = missingSection.trim();
  assert.ok(
    body.startsWith("None.") || /DECLARED DIVERGENCE/.test(body),
    `## Missing prototype rules found must read None. or contain DECLARED DIVERGENCE, got: ${JSON.stringify(body.slice(0, 80))}`,
  );

  assert.ok(doc.includes("a1f4d0dc29782218d8e5aab65bc5989c33f917f0"), "the master hash must be recorded in the ledger");
});
