// test/unit/foe-conditions.test.js
//
// Phase 71 (POLISH-09, D-14) — the ONE foe-condition chip table
// (src/browser/foeConditions.js) and its engine-scan coverage guard.
//
// The user's report (2026-09-24): "the hamstring ability doesn't show up on
// enemies as a condition chit. Let's make sure conditions from all
// abilities, spells show up on enemies when affected." The shell's old
// hand-written foeStatusBadges list missed Hamstrung and Marked (and
// Pommel's Stunned, and Dirty Trick's timed Blind).
//
// Sections:
//   (a) one case per condition, built from the engine's own apply* functions
//       where they are exported and pure (engine/abilities.js), otherwise
//       with the field set exactly as the engine writes it (line cited);
//   (b) the rounds cases;
//   (c) tone, order and determinism;
//   (d) malformed and hostile inputs;
//   (e) the coverage guard: every foe field and every combat-wide flag the
//       engine assigns is either a chip or on NOT_A_CONDITION with a reason,
//       plus a self-check that the scan still sees the known fields, and a
//       synthetic miss that proves an uncovered field is reported;
//   (f) FOE_CONDITION_COPY is frozen and voice-safe.
//
// R-11: the guard reads the engine as text and never edits it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import * as foeCondNS from "../../src/browser/foeConditions.js";
import { FOE_CONDITIONS, FOE_CONDITION_COPY, foeConditionChips } from "../../src/browser/foeConditions.js";
// Phase 71 (D-16, R-30): read through the namespace so a missing export fails its own tests.
const FOE_CONDITION_DESC = foeCondNS.FOE_CONDITION_DESC || {};
import { applyPommel, applyDirtyTrick, applyPoison, applyHamstring, applyMark } from "../../engine/abilities.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── fixtures ──────────────────────────────────────────────────────────────

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedState({ combat = {}, timers = {} } = {}) {
  return {
    c: { name: "Test Delver", timers },
    combat: { foes: [], round: 2, target: 0, ...combat },
  };
}

const texts = (foe, state = fixedState()) => foeConditionChips(foe, state).map((ch) => ch.text);

// ─── (a) one case per condition ────────────────────────────────────────────

test("Stunned: engine/abilities.js applyPommel sets the chip", () => {
  const f = fixedFoe();
  applyPommel(f);
  assert.deepEqual(texts(f), ["Stunned"]);
  f.stunned = false; // engine/combat.js foeTurn consumes it (`f.stunned = false`)
  assert.deepEqual(texts(f), []);
});

test("Blind: engine/abilities.js applyDirtyTrick shows its two rounds", () => {
  const f = fixedFoe();
  applyDirtyTrick(f);
  assert.deepEqual(texts(f), ["Blind · 2"]);
});

test("Hamstrung: engine/abilities.js applyHamstring sets the chip (the user's D-14 report)", () => {
  const f = fixedFoe();
  applyHamstring(f);
  assert.deepEqual(texts(f), ["Hamstrung"]);
});

test("Marked: engine/abilities.js applyMark sets the chip", () => {
  const f = fixedFoe();
  applyMark(f);
  assert.deepEqual(texts(f), ["Marked"]);
});

test("Poison: engine/abilities.js applyPoison (Poisoned Edge) shows its rounds", () => {
  const f = fixedFoe();
  applyPoison(f, { left: 3, dmg: "1d4", by: "poison" });
  assert.deepEqual(texts(f), ["Poison · 3"]);
});

test("Ice: engine/magic.js Ice sets `t.dot = { left, dmg, by: \"ice\" }` and reads Ice", () => {
  const f = fixedFoe({ dot: { left: 4, dmg: "1d6", by: "ice" } });
  assert.deepEqual(texts(f), ["Ice · 4"]);
  f.dot.left = 0;
  assert.deepEqual(texts(f), []);
});

test("Asleep: engine/magic.js `f.asleep = Math.max(f.asleep, rng.d(4))` shows its rounds; 0 shows nothing", () => {
  assert.deepEqual(texts(fixedFoe({ asleep: 3 })), ["Asleep · 3"]);
  assert.deepEqual(texts(fixedFoe({ asleep: 0 })), []);
});

test("Frozen: a live foe carrying engine/magic.js's `t.frozen = true` shows the chip", () => {
  assert.deepEqual(texts(fixedFoe({ frozen: true })), ["Frozen"]);
});

test("Acid: engine/magic.js `t.acid = { rounds, dmg }` shows its rounds", () => {
  assert.deepEqual(texts(fixedFoe({ acid: { rounds: 3, dmg: "1d6" } })), ["Acid · 3"]);
  assert.deepEqual(texts(fixedFoe({ acid: { rounds: 0, dmg: "1d6" } })), []);
});

test("Stupefied: engine/magic.js `t.stupid = true`", () => {
  assert.deepEqual(texts(fixedFoe({ stupid: true })), ["Stupefied"]);
});

test("Blind (spell): engine/magic.js `t.blind = true` with no countdown reads the bare label", () => {
  assert.deepEqual(texts(fixedFoe({ blind: true })), ["Blind"]);
});

test("Shrunk: engine/magic.js `f.shrunk = true`", () => {
  assert.deepEqual(texts(fixedFoe({ shrunk: true })), ["Shrunk"]);
});

test("Fixated: engine/magic.js `f.fixated = true`", () => {
  assert.deepEqual(texts(fixedFoe({ fixated: true })), ["Fixated"]);
});

test("Frenzied: engine/magic.js `t.frenzied = true` is the one foe BUFF, tone bad", () => {
  const chips = foeConditionChips(fixedFoe({ frenzied: true }), fixedState());
  assert.equal(chips.length, 1);
  assert.equal(chips[0].text, "Frenzied");
  assert.equal(chips[0].tone, "bad");
});

test("Weakened: the combat-wide `C.weakened = true` (engine/magic.js, engine/items.js) shows on every live foe", () => {
  const state = fixedState({ combat: { weakened: true, foeToHitPenalty: 3 } });
  assert.deepEqual(texts(fixedFoe({ name: "A" }), state), ["Weakened"]);
  assert.deepEqual(texts(fixedFoe({ name: "B" }), state), ["Weakened"]);
});

// ─── (b) rounds ────────────────────────────────────────────────────────────

test("rounds: blindFor 1 reads Blind · 1; a deleted blindFor with blind still true reads Blind", () => {
  const f = fixedFoe();
  applyDirtyTrick(f);
  f.blindFor--; // engine/combat.js `f.blindFor--`
  assert.deepEqual(texts(f), ["Blind · 1"]);
  delete f.blindFor; // engine/combat.js `delete f.blindFor` (then `f.blind = false`)
  assert.deepEqual(texts(f), ["Blind"]);
  f.blind = false;
  assert.deepEqual(texts(f), []);
});

test("rounds: Weakened reads the hero's spell:weaken timer when it is live, else the bare label", () => {
  const withTimer = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { phase: "effect", left: 2 } } });
  assert.deepEqual(texts(fixedFoe(), withTimer), ["Weakened · 2"]);
  const spentTimer = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { phase: "effect", left: 0 } } });
  assert.deepEqual(texts(fixedFoe(), spentTimer), ["Weakened"]);
  const noTimer = fixedState({ combat: { weakened: true } });
  assert.deepEqual(texts(fixedFoe(), noTimer), ["Weakened"]);
  const notWeakened = fixedState({ timers: { "spell:weaken": { phase: "effect", left: 2 } } });
  assert.deepEqual(texts(fixedFoe(), notWeakened), []);
});

test("rounds: every chip carries { key, label, tone, rounds, text, desc }, text = label · rounds only when rounds is set", () => {
  const f = fixedFoe({ acid: { rounds: 2 }, shrunk: true });
  const chips = foeConditionChips(f, fixedState());
  // Phase 71 (D-16, R-30): desc joins the chip; the other five fields are unchanged.
  assert.deepEqual(chips.map(({ desc, ...c }) => ({ ...c })), [
    { key: "acid", label: "Acid", tone: "good", rounds: 2, text: "Acid · 2" },
    { key: "shrunk", label: "Shrunk", tone: "good", rounds: null, text: "Shrunk" },
  ]);
  assert.deepEqual(chips.map((c) => c.desc), [FOE_CONDITION_DESC.acid, FOE_CONDITION_DESC.shrunk]);
});

// ─── (c) tone, order, determinism ──────────────────────────────────────────

test("tone: every foe debuff is good; Frenzied alone is bad", () => {
  for (const entry of FOE_CONDITIONS) {
    assert.equal(entry.tone, entry.key === "frenzied" ? "bad" : "good", `${entry.key} tone`);
  }
});

test("order: chips come out in table order — Stunned, Blind, Hamstrung, Marked, Asleep, Frozen, Acid, Poison/Ice, Stupefied, Shrunk, Fixated, Frenzied, Weakened", () => {
  assert.deepEqual(FOE_CONDITIONS.map((e) => e.key), [
    "stunned", "blind", "hamstrung", "marked", "asleep", "frozen", "acid", "dot", "stupid", "shrunk", "fixated", "frenzied", "weakened",
  ]);
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "poison" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  assert.deepEqual(texts(everything, state), [
    "Stunned", "Blind · 1", "Hamstrung", "Marked", "Asleep · 2", "Frozen", "Acid · 1", "Poison · 2",
    "Stupefied", "Shrunk", "Fixated", "Frenzied", "Weakened · 3",
  ]);
});

test("determinism: two calls are deep-equal, and the result and its chips are frozen", () => {
  const f = fixedFoe({ hamstrung: true, marked: true });
  const a = foeConditionChips(f, fixedState());
  const b = foeConditionChips(f, fixedState());
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  for (const ch of a) assert.ok(Object.isFrozen(ch));
  assert.ok(Object.isFrozen(FOE_CONDITIONS));
  for (const e of FOE_CONDITIONS) assert.ok(Object.isFrozen(e));
});

test("purity: foeConditionChips never mutates the foe or the state", () => {
  const f = fixedFoe({ blind: true, blindFor: 2, dot: { left: 2, by: "ice" } });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 1 } } });
  const fBefore = JSON.stringify(f);
  const sBefore = JSON.stringify(state);
  foeConditionChips(f, state);
  assert.equal(JSON.stringify(f), fBefore);
  assert.equal(JSON.stringify(state), sBefore);
});

// ─── (d) malformed and hostile inputs ──────────────────────────────────────

test("malformed: a dead foe, a non-object foe, and null/malformed state never throw", () => {
  const dead = fixedFoe({ alive: false, hamstrung: true, frozen: true });
  assert.deepEqual(foeConditionChips(dead, fixedState()), []);
  for (const bad of [null, undefined, 0, "foe", 7, true]) {
    assert.deepEqual(foeConditionChips(bad, fixedState()), [], `foe ${String(bad)}`);
  }
  const f = fixedFoe({ marked: true });
  for (const s of [null, undefined, 0, "state", {}, { combat: null }, { c: null, combat: { weakened: true } }, { c: { timers: null }, combat: { weakened: true } }]) {
    let out;
    assert.doesNotThrow(() => { out = foeConditionChips(f, s); }, `state ${JSON.stringify(s)}`);
    assert.ok(out.map((c) => c.text).includes("Marked"), "foe-only chips still show");
  }
  // combat-wide Weakened with no hero timers falls back to the bare label.
  assert.deepEqual(texts(fixedFoe(), { combat: { weakened: true } }), ["Weakened"]);
});

test("hostile: a getter that throws drops only that chip, never the call", () => {
  const f = fixedFoe({ marked: true });
  Object.defineProperty(f, "hamstrung", { get() { throw new Error("boom"); }, enumerable: true });
  let out;
  assert.doesNotThrow(() => { out = foeConditionChips(f, fixedState()); });
  assert.deepEqual(out.map((c) => c.text), ["Marked"]);

  const hostileState = {};
  Object.defineProperty(hostileState, "combat", { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => { out = foeConditionChips(fixedFoe({ shrunk: true }), hostileState); });
  assert.deepEqual(out.map((c) => c.text), ["Shrunk"]);

  const hostileAlive = {};
  Object.defineProperty(hostileAlive, "alive", { get() { throw new Error("boom"); } });
  assert.doesNotThrow(() => foeConditionChips(hostileAlive, fixedState()));
});

test("hostile: odd field values render nothing rather than a nonsense chip", () => {
  assert.deepEqual(texts(fixedFoe({ asleep: -2, acid: { rounds: "x" }, dot: { left: NaN }, blindFor: -1 })), []);
  assert.deepEqual(texts(fixedFoe({ acid: null, dot: "poison" })), []);
});

// ─── (e) the engine-scan coverage guard ────────────────────────────────────

const ENGINE_FILES = [
  "engine/abilities.js",
  "engine/magic.js",
  "engine/combat.js",
  "engine/foeAbilities.js",
  "engine/items.js",
  "engine/foeDamage.js",
];

/** NOT_A_CONDITION — every field the scan finds that is NOT a foe condition
 * the player should see as a chip, each with its one-line reason. Test-owned
 * (R-11): the engine is never edited to satisfy this guard. */
const NOT_A_CONDITION = Object.freeze({
  // ── per-foe fields ──
  wp: "hit points: the card's HP line shows them",
  maxWP: "max hit points: the card's HP line shows them",
  alive: "life itself: a dead card reads DOWN, and chips render only for live foes",
  fled: "set together with alive = false: the foe has left the fight",
  lives: "kill-twice bookkeeping, not a status the player applied",
  turned: "R-12: Turn Undead and Gate set it together with alive = false, so the card reads DOWN",
  cd: "the foe's own ability cooldowns (engine/foeAbilities.js), not a condition on it",
  uses: "the foe's own ability use counts (engine/foeAbilities.js), not a condition on it",
  // ── combat-wide flags ──
  foeToHitPenalty: "the to-hit half of Weaken, shown by the Weakened chip",
  afraid: "the HERO's fear, not a foe condition",
  braced: "the hero's Brace stance",
  inspired: "the hero's Inspire, a hero buff",
  abilityStrike: "the hero's pending ability strike for this round",
  ally: "the hero's summoned ally",
  allies: "the party members' combat sheets",
  first: "initiative: who swings first",
  target: "the hero's aim",
  round: "the round counter the header shows",
  cut: "the Cutthroat's once-a-fight crit is spent (hero-side)",
  opened: "the Cat Burglar/Ninja free opener is spent (hero-side)",
  opened2: "the hero's opening strike has landed (opening-crit and Cloaker-vanish bookkeeping)",
  spellOpen: "the spell submenu's open flag",
  parleyTried: "the one parley attempt is spent",
  parleyInsulted: "the parley went badly; a fight-wide flag, not a foe status",
  pendingFoes: "summoned foes waiting to join the fight",
  pending: "the pre-join encounter marker",
  // RULES-10 (Phase 75.1, plan 03): the foe-side fumble-effect fields land
  // in state ahead of any indicator — CMBUI-13 (Phase 77) draws the chip.
  ward: "RULES-10 (Phase 75.1): the foe's own Shield pool / Bubble mirror — CMBUI-13 (Phase 77) draws its indicator",
  rebound: "RULES-10 (Phase 75.1): a caught blow queued to throw back at the foe's own next turn — engine bookkeeping, not a chip",
  mirror: "RULES-10 (Phase 75.1): the foe's own Mirror Self — CMBUI-13 (Phase 77) draws its indicator",
  // RULES-10 (Phase 75.1, plan 04, Task 1): the reader's own burn — this
  // table (src/browser/foeConditions.js) is FOE-card chips only; the hero's
  // own burn is combat-scoped bookkeeping, narrated via selfDotTick, not a
  // foe chip.
  selfDot: "RULES-10 (Phase 75.1): the reader's own burn — combat-scoped bookkeeping narrated via selfDotTick, not a foe chip",
});

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
}

const ASSIGN = String.raw`\s*(?:=(?![=>])|\+=|-=|\*=|\/=|\+\+|--)`;
const FOE_BINDING = String.raw`(?<![\w.$])(?:t|f|foe|target|tgt)`;
const COMBAT_BINDING = String.raw`(?<![\w.$])(?:state\.combat|combat|C)`;

/** scanEngineFields(src) — { foe: Set, combat: Set } of every field the
 * source assigns (=, op=, ++, --, prefix ++/--, delete) on a foe binding
 * (t, f, foe, target, tgt) or a combat-wide binding (C, combat,
 * state.combat). Comments are stripped first. */
function scanEngineFields(rawSrc) {
  const src = stripComments(rawSrc);
  const foe = new Set();
  const combat = new Set();
  const collect = (binding, into) => {
    const patterns = [
      new RegExp(`${binding}\\.([A-Za-z_$][\\w$]*)${ASSIGN}`, "g"),
      new RegExp(`(?:\\+\\+|--)\\s*${binding}\\.([A-Za-z_$][\\w$]*)`, "g"),
      new RegExp(`delete\\s+${binding}\\.([A-Za-z_$][\\w$]*)`, "g"),
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) into.add(m[1]);
  };
  collect(FOE_BINDING, foe);
  collect(COMBAT_BINDING, combat);
  return { foe, combat };
}

function scanAll() {
  const foe = new Set();
  const combat = new Set();
  for (const rel of ENGINE_FILES) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    const r = scanEngineFields(src);
    r.foe.forEach((k) => foe.add(k));
    r.combat.forEach((k) => combat.add(k));
  }
  return { foe, combat };
}

/** coveredFields() — every table key plus every engine field a table entry reads. */
function coveredFields() {
  const out = new Set();
  for (const e of FOE_CONDITIONS) {
    out.add(e.key);
    for (const fld of e.fields || []) out.add(fld);
  }
  return out;
}

function uncovered(fields) {
  const covered = coveredFields();
  return [...fields].filter((k) => !covered.has(k) && !Object.hasOwn(NOT_A_CONDITION, k)).sort();
}

test("coverage guard: every foe field and combat-wide flag the engine assigns is a chip or a reasoned NOT_A_CONDITION", () => {
  const { foe, combat } = scanAll();
  const missing = uncovered(new Set([...foe, ...combat]));
  assert.deepEqual(missing, [], `engine fields with no chip and no NOT_A_CONDITION reason: ${missing.join(", ")} — add a FOE_CONDITIONS entry (src/browser/foeConditions.js) or a reasoned exclusion here`);
});

test("coverage guard self-check: the scan still sees hamstrung, marked, stunned, blindFor and weakened", () => {
  const { foe, combat } = scanAll();
  for (const k of ["hamstrung", "marked", "stunned", "blindFor", "blind", "asleep", "acid", "dot", "stupid", "shrunk", "fixated", "frenzied", "turned"]) {
    assert.ok(foe.has(k), `the scan must find the foe field ${k}`);
  }
  assert.ok(combat.has("weakened"), "the scan must find the combat-wide weakened flag");
  assert.ok(combat.has("foeToHitPenalty"), "the scan must find foeToHitPenalty");
});

test("coverage guard self-check: a synthetic `t.newHex = true` (and a combat-wide one) is reported as uncovered", () => {
  const synthetic = "function applyHex(t) {\n  t.newHex = true;\n  C.hexStorm = 2;\n  // t.commentOnly = true;\n}\n";
  const r = scanEngineFields(synthetic);
  assert.deepEqual(uncovered(new Set([...r.foe, ...r.combat])), ["hexStorm", "newHex"]);
  // comparisons and arrows are not assignments
  const r2 = scanEngineFields("if (t.blind === true && f.asleep == 0) run((f) => f.marked);\n");
  assert.deepEqual([...r2.foe], []);
  // delete, ++, -- and prefix forms all count
  const r3 = scanEngineFields("delete f.a; f.b++; t.c--; ++foe.d; tgt.e += 2; state.combat.g = 1;");
  assert.deepEqual([...r3.foe].sort(), ["a", "b", "c", "d", "e"]);
  assert.deepEqual([...r3.combat], ["g"]);
});

test("coverage guard: NOT_A_CONDITION never lists a field that is also a chip, and every reason is a non-empty line", () => {
  const covered = coveredFields();
  for (const [k, reason] of Object.entries(NOT_A_CONDITION)) {
    assert.equal(covered.has(k), false, `${k} is both a chip field and on NOT_A_CONDITION`);
    assert.ok(typeof reason === "string" && reason.trim().length > 0 && !reason.includes("\n"), `${k} needs a one-line reason`);
  }
});

// ─── (f) copy ──────────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));

test("FOE_CONDITION_COPY: frozen, the house labels, every leaf non-empty and clear of BANNED", () => {
  assert.ok(Object.isFrozen(FOE_CONDITION_COPY));
  assert.deepEqual(Object.values(FOE_CONDITION_COPY).sort(), [
    "Acid", "Asleep", "Blind", "Fixated", "Frenzied", "Frozen", "Hamstrung", "Ice", "Marked", "Poison", "Shrunk", "Stunned", "Stupefied", "Weakened",
  ]);
  for (const [key, value] of Object.entries(FOE_CONDITION_COPY)) {
    assert.ok(typeof value === "string" && value.length > 0, `${key} must be a non-empty string`);
    for (const { term, re } of MATCHERS) {
      const m = value.match(re);
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `${key} ("${value}") hits BANNED term ${term}`);
    }
  }
  for (const e of FOE_CONDITIONS) {
    assert.ok(Object.values(FOE_CONDITION_COPY).includes(e.label), `${e.key}'s label comes from FOE_CONDITION_COPY`);
  }
});

// ─── (g) Phase 71 (D-16, R-30): the foe condition descriptions ─────────────
// The long-press card is where a foe condition is explained (a chip tap on a
// foe card aims). FOE_CONDITION_DESC holds one sentence per label key.

// The hp-not-wp guard's own regex, verbatim (test/unit/hp-not-wp.test.js).
const PLAYER_WP_RULE = /(?<![\w.$-])(wp|WP)(?![\w:])/;

test("FOE_CONDITION_DESC: exported, frozen, one sentence per FOE_CONDITIONS key plus poison and ice for the dot", () => {
  assert.ok(foeCondNS.FOE_CONDITION_DESC, "FOE_CONDITION_DESC must be exported");
  assert.ok(Object.isFrozen(FOE_CONDITION_DESC));
  const want = new Set([...FOE_CONDITIONS.map((e) => e.key).filter((k) => k !== "dot"), "poison", "ice"]);
  assert.deepEqual(Object.keys(FOE_CONDITION_DESC).sort(), [...want].sort());
  // The desc keys are the label keys: each label has exactly one description.
  assert.deepEqual(Object.keys(FOE_CONDITION_DESC).sort(), Object.keys(FOE_CONDITION_COPY).sort());
});

test("FOE_CONDITION_DESC: every sentence is non-empty, one line, clear of BANNED, free of WP, and never the label alone", () => {
  for (const [key, value] of Object.entries(FOE_CONDITION_DESC)) {
    assert.ok(typeof value === "string" && value.trim().length > 12, `${key} needs a real sentence`);
    assert.ok(!/\n/.test(value), `${key} is one line`);
    assert.ok(/[.!?]$/.test(value), `${key} ends as a sentence`);
    assert.notEqual(value, FOE_CONDITION_COPY[key]);
    for (const { term, re } of MATCHERS) {
      const m = value.match(re);
      assert.ok(!m || ALLOW.has(m[0].toLowerCase()), `${key} ("${value}") hits BANNED term ${term}`);
    }
    assert.ok(!PLAYER_WP_RULE.test(value), `${key} ("${value}") says WP; the player reads HP`);
  }
});

test("FOE_CONDITION_DESC: never states a hidden rule number (only the +2 and the 3 the ability and spell text already show)", () => {
  for (const [key, value] of Object.entries(FOE_CONDITION_DESC)) {
    const numbers = value.match(/\d+/g) || [];
    for (const n of numbers) assert.ok(["2", "3"].includes(n), `${key} states ${n}, which the player cannot see`);
  }
});

test("chips carry desc: every entry's chip has its own description; the dot's follows its Poison or Ice label", () => {
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "poison" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  const chips = foeConditionChips(everything, state);
  assert.equal(chips.length, FOE_CONDITIONS.length);
  for (const chip of chips) {
    const descKey = chip.key === "dot" ? "poison" : chip.key;
    assert.equal(chip.desc, FOE_CONDITION_DESC[descKey], `${chip.key} desc`);
    assert.ok(typeof chip.desc === "string" && chip.desc.length > 0);
  }
  const ice = foeConditionChips(fixedFoe({ dot: { left: 3, by: "ice" } }), fixedState());
  assert.equal(ice[0].label, "Ice");
  assert.equal(ice[0].desc, FOE_CONDITION_DESC.ice);
  const poison = foeConditionChips(fixedFoe({ dot: { left: 3, by: "poison" } }), fixedState());
  assert.equal(poison[0].desc, FOE_CONDITION_DESC.poison);
  assert.notEqual(FOE_CONDITION_DESC.ice, FOE_CONDITION_DESC.poison);
});

test("chips carry desc: chip text is byte-identical to before (the combat foe cards do not move)", () => {
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "ice" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  assert.deepEqual(texts(everything, state), [
    "Stunned", "Blind · 1", "Hamstrung", "Marked", "Asleep · 2", "Frozen", "Acid · 1", "Ice · 2",
    "Stupefied", "Shrunk", "Fixated", "Frenzied", "Weakened · 3",
  ]);
  for (const chip of foeConditionChips(everything, state)) {
    assert.deepEqual(Object.keys(chip), ["key", "label", "tone", "rounds", "text", "desc"]);
    assert.ok(Object.isFrozen(chip));
  }
});

test("an entry without a description fails: the chip builder reads the desc table, never invents one", () => {
  // Every FOE_CONDITIONS entry resolves to a FOE_CONDITION_DESC sentence; a
  // key added to the table with no sentence would give an undefined desc here.
  for (const e of FOE_CONDITIONS) {
    const keys = e.key === "dot" ? ["poison", "ice"] : [e.key];
    for (const k of keys) assert.ok(typeof FOE_CONDITION_DESC[k] === "string" && FOE_CONDITION_DESC[k].length > 0, `${k} has no description`);
  }
});
