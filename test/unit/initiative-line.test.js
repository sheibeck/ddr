// test/unit/initiative-line.test.js
//
// Phase 51 (INIT-02) — the once-per-fight "Initiative — you N, {foe|them}
// M. <verdict>" line: every `why` branch renders in voice on both the
// Oracle (src/browser/eventNarration.js) and the roll-free fight-log/rail
// text (src/browser/narrationLines.js), the dice reveal through the
// existing `.roll`/`oracleDetailText` fold, the foe-name rule holds, the
// line appears EXACTLY ONCE per fight over a real 3-round engine replay
// (SC3), and a legacy no-dice event still renders without throwing.
//
// Pure imports only (mirrors test/unit/rail.test.js's BANNED-scan pattern
// and test/unit/combat.test.js's fixedState/fixedFoe/fixedCombat/fakeRng
// helpers, copied verbatim below) — no DOM, no engine mutation beyond the
// one real replay in the SC3 test.

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION, narrateEvent } from "../../src/browser/eventNarration.js";
import { LINE_FOR, oracleDetailText, narrativeLineText } from "../../src/browser/narrationLines.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { fight, playerStrike } from "../../engine/combat.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

// ─── BANNED scan (verbatim pattern from test/unit/rail.test.js) ────────────
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

// ─── fixedState/fixedFoe/fixedCombat/fakeRng (verbatim copy from
// test/unit/combat.test.js, needed for the SC3 real-engine replay) ─────────
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
    day: 1, steps: 0, combat: null, store: null, beats: null,
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

// ─── Test 1: every why branch, both modules, BANNED-clean ─────────────────

const WHY_BRANCHES = [
  { why: "samurai", first: "foe", phrases: ["Samurai honour", "they go first"] },
  { why: "slow", first: "foe", phrases: ["they go first"] },
  { why: "foreseen", first: "you", phrases: ["Foresight", "you go first"] },
  { why: "acuteHearing", first: "you", phrases: ["Acute Hearing", "you go first"] },
  { why: "senses", first: "you", phrases: ["You felt them coming"] },
  { why: "knight", first: "foe", phrases: ["A Knight's welcome"] },
  { why: "courtMage", first: "foe", phrases: ["Court Mage"] },
  { why: undefined, first: "you", phrases: ["You go first."] },
  { why: undefined, first: "foe", phrases: ["They go first."] },
];

test("INIT-02: every why branch renders in voice, both modules agree on the verdict, and no line trips BANNED", () => {
  for (const branch of WHY_BRANCHES) {
    const e = {
      type: "combatJoined",
      first: branch.first,
      mine: 14,
      theirs: 9,
      foe: "Stalka Beast",
      ...(branch.why ? { why: branch.why } : {}),
      ...(branch.why === "senses" ? { senses: true } : {}),
    };

    const html = EVENT_NARRATION.combatJoined(e);
    const rollSpanCount = (html.match(/<span class="roll">/g) || []).length;
    assert.equal(rollSpanCount, 2, `expected two .roll spans for why=${branch.why}`);
    for (const phrase of branch.phrases) {
      assert.ok(html.includes(phrase), `Oracle html missing "${phrase}" for why=${branch.why}: ${html}`);
    }

    const line = LINE_FOR.combatJoined(e);
    assert.ok(line.text.startsWith("Initiative — "), `LINE_FOR text must start with "Initiative — " for why=${branch.why}`);
    for (const phrase of branch.phrases) {
      assert.ok(line.text.includes(phrase), `LINE_FOR text missing "${phrase}" for why=${branch.why}: ${line.text}`);
    }
    assert.ok(!/\d/.test(line.text), `LINE_FOR text must be digit-free (roll-free) for why=${branch.why}: ${line.text}`);
    assert.equal(line.tone, branch.first === "you" ? "hit" : "hurt", `tone mismatch for why=${branch.why}`);

    assertClean(narrativeLineText(html));
    assertClean(line.text);
  }
});

// ─── Test 2: foe-name rule ──────────────────────────────────────────────────

test("INIT-02: the foe's name appears when the event carries `foe`, 'them' otherwise", () => {
  const withFoe = EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you", mine: 14, theirs: 9, foe: "Stalka Beast" });
  assert.ok(oracleDetailText(withFoe).includes("Stalka Beast 9"));

  const withoutFoe = EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you", mine: 14, theirs: 9 });
  assert.ok(oracleDetailText(withoutFoe).includes("them 9"));
});

// ─── Test 3: the .roll reveal fold ─────────────────────────────────────────

test("INIT-02: the fight log reveals both dice through the existing .roll fold", () => {
  const e = { type: "combatJoined", first: "you", mine: 14, theirs: 9, foe: "Stalka Beast" };
  const html = narrateEvent(e);
  assert.equal(oracleDetailText(html), "Initiative — you 14, Stalka Beast 9. You go first.");
  const stripped = narrativeLineText(html);
  assert.ok(!stripped.includes("14"));
  assert.ok(!stripped.includes("9"));
});

// ─── Test 4: once-per-fight, over a real engine replay (SC3) ──────────────

test("INIT-02 (SC3): a 3-round fight narrates the initiative line exactly once in the Oracle and the fight log — a second appearance fails", () => {
  const state = fixedState({ c: { sub: "Samurai" } });
  state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { pending: true });
  // Plan 02's own SC2 scenario, replayed verbatim: fight() on [10, 1, 20]
  // (forced-foe Samurai init, then the opening foe-first miss), then three
  // rounds of (hero miss 20, foe miss 20) — one shared fakeRng, 9 draws.
  const rng = fakeRng([10, 1, 20, 20, 20, 20, 20, 20, 20]);
  const events = fight(state, rng, []);
  for (let i = 0; i < 3; i++) playerStrike(state, rng, events);

  const oracleInitiativeLines = events.map((e) => narrateEvent(e)).filter((h) => h.includes("Initiative — "));
  assert.equal(oracleInitiativeLines.length, 1, "the Oracle must show the initiative line exactly once, not per round");

  const logLines = fightLogLinesFor("attack", events);
  const initiativeLogLines = logLines.filter((l) => l.text.startsWith("Initiative — "));
  assert.equal(initiativeLogLines.length, 1, "the fight log must show the initiative line exactly once, not per round");
  assert.equal(
    initiativeLogLines[0].roll,
    "Initiative — you 10, Target 1. Samurai honour — they go first.",
    "the revealed roll must contain both dice and the in-voice verdict",
  );
});

// ─── Test 5: legacy no-dice shape ───────────────────────────────────────────

test("INIT-02: a combatJoined without dice still renders (legacy shape)", () => {
  const html = EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you" });
  assert.doesNotThrow(() => EVENT_NARRATION.combatJoined({ type: "combatJoined", first: "you" }));
  const rollSpanValues = [...html.matchAll(/<span class="roll">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepStrictEqual(rollSpanValues, ["?", "?"]);
});
