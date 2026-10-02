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
//   (a2) Phase 77 (CMBUI-13): the gifts a fumbled helpful scroll hands a
//       foe (ward/Bubble, Rebound, Mirror Self, Strength, Regeneration,
//       Sense Presence), each landed by the real resolver;
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
import { resolveScrollFumble } from "../../engine/scrollFumble.js";
import { damageFoe } from "../../engine/foeDamage.js";
import { SPELLS } from "../../content/spells.js";
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

// Phase 90 plan 05 (SPELL-12): Ice is the area freeze, so there is no Ice chip (its dot is gone);
// Ice's hold shows as a Frozen chip, Stun's as Stunned, Doze's sleepers as Dozing.
test("Dozing: engine/combat.js#dozeFoes' `f.dozing` shows its own chip with the sleep's rounds, and the plain Asleep chip does not double it", () => {
  assert.deepEqual(texts(fixedFoe({ asleep: 3, dozing: true })), ["Dozing · 3"]);
  assert.deepEqual(texts(fixedFoe({ asleep: 0, dozing: true })), [], "a spent sleep shows nothing");
  assert.deepEqual(texts(fixedFoe({ asleep: 3 })), ["Asleep · 3"], "no dozing mark: the plain sleep chip");
  const chip = foeConditionChips(fixedFoe({ asleep: 2, dozing: true }), fixedState())[0];
  assert.equal(chip.key, "dozing");
  assert.equal(chip.desc, FOE_CONDITION_DESC.dozing);
  assert.match(chip.desc, /wakes it/, "the description says a hit wakes it");
  assert.match(FOE_CONDITION_DESC.asleep, /does not wake it/, "the plain sleep says a hit does not");
});

test("Stunned hold: engine/combat.js#stunFoe's held kind \"stunned\" reads Stunned with its rounds, and says a hit does not end it", () => {
  const chips = foeConditionChips(fixedFoe({ held: { kind: "stunned", left: 3 } }), fixedState());
  assert.deepEqual(chips.map((c) => c.text), ["Stunned · 3"]);
  assert.equal(chips[0].key, "held");
  assert.match(chips[0].desc, /does not end the hold/);
  assert.deepEqual(texts(fixedFoe({ held: { kind: "frozen", left: 2 } })), ["Frozen · 2"], "Ice's and Freeze's hold still reads Frozen");
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

// ─── (a2) Phase 77 (CMBUI-13): the gifts a fumbled helpful scroll hands a foe ─
// Each case runs the REAL resolver, engine/scrollFumble.js#resolveHelpful
// (through resolveScrollFumble), on the combat's current target with a
// fixed fumble-stream rng — the field lands exactly as it does in play. A
// foe buff is tone "bad" (bad for the player), like Frenzied.

/** fumbleOn(spellName, foe, faces) — resolves a fumbled helpful scroll onto `foe`. */
function fumbleOn(spellName, foe, face = 2) {
  const sp = SPELLS.find((s) => s.n === spellName);
  assert.ok(sp, `no SPELLS row ${spellName}`);
  const state = fixedState({ combat: { foes: [foe], target: 0 } });
  state.c.level = 1;
  const srng = { d: () => face };
  const rng = { d: () => { throw new Error("the main rng is never drawn by a helpful fumble"); } };
  resolveScrollFumble(state, sp, srng, rng, []);
  return state;
}

test("Phase 77 (CMBUI-13) Shielded: a fumbled Shield (resolveHelpful's plain ward) reads its rounds, tone bad", () => {
  const f = fixedFoe();
  const state = fumbleOn("Shield", f);
  assert.equal(typeof f.ward.pool, "number");
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), [`Shielded · ${f.ward.rounds}`]);
  assert.equal(chips[0].tone, "bad");
  // engine/combat.js#foeTurn's tail ticks it; at 0 it is deleted (`delete f.ward`).
  f.ward.rounds = 1;
  assert.deepEqual(texts(f), ["Shielded · 1"]);
  delete f.ward;
  assert.deepEqual(texts(f), []);
});

test("Phase 77 (CMBUI-13) Shielded: a pool of 12 with 3 rounds reads Shielded · 3; an emptied pool reads nothing", () => {
  assert.deepEqual(texts(fixedFoe({ ward: { pool: 12, rounds: 3, name: "Shield" } })), ["Shielded · 3"]);
  assert.deepEqual(texts(fixedFoe({ ward: { pool: 0, rounds: 3, name: "Shield" } })), []);
});

test("Phase 77 (CMBUI-13) Bubbled: a fumbled Bubble (the armed mirror ward) reads its bare label; the pop turns it into Shielded · 1", () => {
  const f = fixedFoe();
  const state = fumbleOn("Bubble", f);
  assert.equal(f.ward.mirror, true);
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), ["Bubbled"]);
  assert.equal(chips[0].tone, "bad");
  // engine/foeDamage.js#damageFoe: the armed Bubble catches a hero blow whole,
  // stores it as f.rebound and pops into a plain one-round pool.
  const events = [];
  damageFoe(state, f, 5, { kind: "melee" }, { d: () => 1 }, events);
  assert.equal(f.rebound, 5);
  assert.deepEqual(texts(f), ["Shielded · 1", "Rebound"]);
  // engine/combat.js#foeTurn's head throws it back and deletes it.
  delete f.rebound;
  assert.deepEqual(texts(f), ["Shielded · 1"]);
});

test("Phase 77 (CMBUI-13) Rebound: a caught blow waiting to come back reads its bare label, tone bad", () => {
  const chips = foeConditionChips(fixedFoe({ rebound: 7 }), fixedState());
  assert.deepEqual(chips.map((c) => c.text), ["Rebound"]);
  assert.equal(chips[0].tone, "bad");
});

test("Phase 77 (CMBUI-13) Mirrored: a fumbled Mirror Self (its d6 rounds) reads Mirrored · 2; foeTurn's tick to 0 clears it", () => {
  const f = fixedFoe();
  const state = fumbleOn("Mirror Self", f, 2);
  assert.equal(f.mirror, 2);
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), ["Mirrored · 2"]);
  assert.equal(chips[0].tone, "bad");
  f.mirror = 0; // engine/combat.js#foeTurn `--f.mirror`
  assert.deepEqual(texts(f), []);
});

test("Phase 77 (CMBUI-13) Strong: a fumbled Strength (a flat might, and since Phase 90 no hit points) reads its bare label", () => {
  const f = fixedFoe();
  const state = fumbleOn("Strength", f);
  assert.ok(f.might > 0 && !("strengthBoost" in f));
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), ["Strong"]);
  assert.equal(chips[0].tone, "bad");
});

test("Phase 77 (CMBUI-13) Regenerating: a fumbled Regeneration (`t.regen = true`) reads its bare label", () => {
  const f = fixedFoe();
  const state = fumbleOn("Regeneration", f);
  assert.equal(f.regen, true);
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), ["Regenerating"]);
  assert.equal(chips[0].tone, "bad");
});

test("Phase 77 (CMBUI-13) Senses: a fumbled Sense Presence (`t.senses = 1`) reads its bare label, and says it does nothing mid-fight", () => {
  const f = fixedFoe();
  const state = fumbleOn("Sense Presence", f);
  assert.equal(f.senses, 1);
  const chips = foeConditionChips(f, state);
  assert.deepEqual(chips.map((c) => c.text), ["Senses"]);
  assert.equal(chips[0].tone, "bad");
  assert.match(chips[0].desc, /nothing/i, "the description says plainly that it changes nothing once the fight is on");
});

test("Phase 77 (CMBUI-13) the fumble gifts never show on a dead foe, and odd values drop only that chip", () => {
  const gifts = { ward: { pool: 12, rounds: 3 }, rebound: 4, mirror: 2, might: 5, regen: true, senses: 1 };
  assert.deepEqual(texts(fixedFoe({ alive: false, ...gifts })), []);
  assert.deepEqual(
    texts(fixedFoe({ ward: { pool: "x", rounds: 3 }, rebound: -1, mirror: NaN, might: 0, marked: true })),
    ["Marked"],
  );
  assert.deepEqual(texts(fixedFoe({ ward: null, mirror: "2", rebound: "7", marked: true })), ["Marked"]);
  const f = fixedFoe({ regen: true, senses: 1 });
  Object.defineProperty(f, "mirror", { get() { throw new Error("boom"); }, enumerable: true });
  Object.defineProperty(f, "ward", { get() { throw new Error("boom"); }, enumerable: true });
  assert.deepEqual(texts(f), ["Regenerating", "Senses"]);
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

// Phase 77 (CMBUI-13): every foe BUFF is tone bad (bad for the player) —
// Frenzied, Unmoved, and the gifts a fumbled helpful scroll hands a foe.
const FOE_BUFF_KEYS = ["frenzied", "shielded", "bubbled", "rebound", "mirror", "might", "regen", "senses", "resisted"];

test("tone: every foe debuff is good; every foe buff (Frenzied, the Phase 77 fumble gifts, Unmoved) is bad", () => {
  for (const entry of FOE_CONDITIONS) {
    assert.equal(entry.tone, FOE_BUFF_KEYS.includes(entry.key) ? "bad" : "good", `${entry.key} tone`);
  }
});

test("order: chips come out in table order — Stunned … Frenzied, the Phase 77 fumble gifts (Shielded, Bubbled, Rebound, Mirrored, Strong, Regenerating, Senses), Weakened, Unmoved", () => {
  assert.deepEqual(FOE_CONDITIONS.map((e) => e.key), [
    "stunned", "blind", "hamstrung", "marked", "asleep", "dozing", "held", "stopped", "frozen", "acid", "dot", "stupid", "senseless", "double", "cowering", "shrunk", "fixated", "frenzied",
    "shielded", "bubbled", "rebound", "mirror", "might", "regen", "senses",
    "weakened", "resisted",
  ]);
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "poison" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
    held: { kind: "frozen", left: 2 }, resisted: "sleep",
    ward: { pool: 12, rounds: 3 }, rebound: 4, mirror: 2, might: 5, regen: true, senses: 1,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  assert.deepEqual(texts(everything, state), [
    "Stunned", "Blind · 1", "Hamstrung", "Marked", "Asleep · 2", "Frozen · 2", "Frozen", "Acid · 1", "Poison · 2",
    "Stupefied", "Shrunk", "Fixated", "Frenzied",
    "Shielded · 3", "Rebound", "Mirrored · 2", "Strong", "Regenerating", "Senses",
    "Weakened · 3", "Unmoved",
  ]);
  // The armed Bubble takes the Shielded slot's neighbour: one ward, one chip.
  assert.deepEqual(texts(fixedFoe({ ward: { name: "Bubble", mirror: true, pool: 0, popPool: 25, rounds: null }, mirror: 1 })), ["Bubbled", "Mirrored · 1"]);
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
  // Phase 77 (CMBUI-13): resolveScrollFumble's helpful branch is the ONE
  // place a foe's ward/might/mirror/regen/senses are SET.
  "engine/scrollFumble.js",
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
  intel: "Phase 90 plan 04: Stupidity sets the foe's intelligence to 1; the Stupefied chip (stupid) is the mark, and the card's INT line shows the number",
  cd: "the foe's own ability cooldowns (engine/foeAbilities.js), not a condition on it",
  uses: "the foe's own ability use counts (engine/foeAbilities.js), not a condition on it",
  weakenResisted: "quick 260927-rsx: the foe resisted the room's Weaken, so its Weakened chip is simply absent (the when() reads this flag)",
  // ── combat-wide flags ──
  foeToHitPenalty: "the to-hit half of Weaken, shown by the Weakened chip",
  afraid: "the HERO's fear, not a foe condition",
  braced: "the hero's Brace stance",
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
  tongue: "Phase 90 plan 09: Chameleon Tongue's fight-scoped fluency (the hero's own parley source), not a foe status",
  sang: "Phase 91 plan 06: the Bard's once-per-fight SING is spent (the SING row shows it), not a foe status",
  sangAt: "Phase 91.1 plan 03 part B (V7 B): the round of the Bard's first song (null after the second), the SING row's clock (AGAIN IN n), not a foe status",
  pendingFoes: "summoned foes waiting to join the fight",
  pending: "the pre-join encounter marker",
  // Phase 77 (CMBUI-13): the foe-side fumble gifts 75.1-03 parked here
  // (ward, rebound, mirror) are chips now — Shielded/Bubbled, Rebound,
  // Mirrored — alongside might (Strong), regen and senses.
  // ── combat-wide flags a fumble sets on the READER (engine/scrollFumble.js) ──
  heroBlind: "RULES-10 (Phase 75.1): the reader's own fumbled Blind — a hero-side condition (engine/derived.js#conditionsOf), not a foe chip",
  heroShrunk: "RULES-10 (Phase 75.1): the reader's own fumbled Shrink — a hero-side condition (engine/derived.js#conditionsOf), not a foe chip",
  // RULES-17 (Phase 75.3): set on the spawned foe literal (never an
  // assignment the scan sees); listed so the reason is on record.
  elite: "RULES-17 (Phase 75.3): the foe's elite rank — its title on the name says so, and the long press's hits-for range includes it; not an effect",
  // RULES-10 (Phase 75.1, plan 04, Task 1): the reader's own burn — this
  // table (src/browser/foeConditions.js) is FOE-card chips only; the hero's
  // own burn is combat-scoped bookkeeping, narrated via selfDotTick, not a
  // foe chip.
  selfDot: "RULES-10 (Phase 75.1): the reader's own burn — combat-scoped bookkeeping narrated via selfDotTick, not a foe chip",
  // RULES-10 (Phase 75.1, plan 04, Task 2): the hero-cannot-act state — a
  // hero-side condition (engine/derived.js#conditionsOf already exposes it
  // as data), not a foe chip; 75.1-09 builds its own shell (the LET THE
  // ROUND PLAY action bridge + the "Can't act" chip).
  heroOut: "RULES-10 (Phase 75.1): the hero-cannot-act state — a hero-side condition (engine/derived.js#conditionsOf), not a foe chip; 75.1-09 builds its shell",
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
  // Phase 77 (CMBUI-13): the fumble gifts (engine/scrollFumble.js,
  // engine/foeDamage.js, engine/combat.js) are seen too.
  for (const k of ["ward", "rebound", "mirror", "might", "regen", "senses", "held", "resisted"]) {
    assert.ok(foe.has(k), `the scan must find the foe field ${k}`);
  }
  assert.ok(combat.has("heroBlind") && combat.has("heroShrunk"), "the scan must find the reader's own fumble flags");
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

test("coverage guard, Phase 77 (CMBUI-13): no exclusion is parked for a later indicator, and every fumble gift is a chip field", () => {
  for (const [k, reason] of Object.entries(NOT_A_CONDITION)) {
    assert.ok(!/Phase 77|CMBUI-13|draws its indicator/.test(reason), `${k} is still parked for a later indicator: ${reason}`);
  }
  const covered = coveredFields();
  for (const k of ["ward", "rebound", "mirror", "might", "regen", "senses"]) {
    assert.ok(covered.has(k), `${k} must be a FOE_CONDITIONS field`);
  }
});

// ─── (f) copy ──────────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));

test("FOE_CONDITION_COPY: frozen, the house labels, every leaf non-empty and clear of BANNED", () => {
  assert.ok(Object.isFrozen(FOE_CONDITION_COPY));
  assert.deepEqual(Object.values(FOE_CONDITION_COPY).sort(), [
    "Acid", "Asleep", "Blind", "Bubbled", "Cowering", "Dozing", "Fighting its double", "Fixated", "Frenzied", "Frozen", "Hamstrung", "Held", "Marked", "Mirrored", "Poison",
    "Rebound", "Regenerating", "Senseless", "Senses", "Shielded", "Shrunk", "Stopped", "Strong", "Stunned", "Stupefied", "Unmoved", "Weakened",
  ]);
  // House style: one capitalised word. Phase 90 plan 08: the one named exception is Duplicate
  // Foe's chip, "Fighting its double", which says what the spell does in the spell's own words.
  for (const value of Object.values(FOE_CONDITION_COPY)) {
    if (value === "Fighting its double") continue;
    assert.match(value, /^[A-Z][a-z]+$/, `${value} is one capitalised word`);
  }
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

test("FOE_CONDITION_DESC: exported, frozen, one sentence per FOE_CONDITIONS key plus poison/ice for the dot and unmoved for resisted", () => {
  assert.ok(foeCondNS.FOE_CONDITION_DESC, "FOE_CONDITION_DESC must be exported");
  assert.ok(Object.isFrozen(FOE_CONDITION_DESC));
  // RULES-18 (Phase 75.3, Plan 04): "held"'s own key covers every kind
  // generically (its label varies by kind, its desc does not — see
  // src/browser/foeConditions.js's own comment); "resisted" is the SAME
  // dot-style indirection dot itself uses for poison/ice — its static desc
  // key is "unmoved", not its own FOE_CONDITIONS key.
  const want = new Set([
    ...FOE_CONDITIONS.map((e) => e.key).filter((k) => k !== "dot" && k !== "resisted"),
    "poison", "unmoved",
  ]);
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

test("FOE_CONDITION_DESC: never states a hidden rule number (only the +2, the 3 and the Stupidity spell's own intelligence 1, which the ability and spell text already show)", () => {
  for (const [key, value] of Object.entries(FOE_CONDITION_DESC)) {
    // Phase 90 plan 11 (TEXT-01): a hard cap's d20 range ("(18–20 on a d20; 17–20 if you insulted them)") is stated on purpose, computed
    // from the engine's faces in test/unit/spell-skill-text-wording.test.js; every other number must still be one the player can see.
    const numbers = value.replace(/\([^)]*on a d20[^)]*\)/g, "").match(/\d+/g) || [];
    for (const n of numbers) assert.ok(["1", "2", "3"].includes(n), `${key} states ${n}, which the player cannot see`);
  }
});

test("chips carry desc: every entry's chip has its own description; the dot's follows its Poison or Ice label", () => {
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "poison" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
    held: { kind: "frozen", left: 2 }, resisted: "sleep",
    ward: { pool: 12, rounds: 3 }, rebound: 4, mirror: 2, might: 5, regen: true, senses: 1,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  const chips = foeConditionChips(everything, state);
  // One ward shows one chip: a plain pool here (Shielded), so Bubbled is absent; a sleep shows one of
  // Asleep or Dozing (this foe carries no dozing mark), so Dozing is absent too; and this foe is
  // neither stopped nor misdirected (Phase 90 plan 08), so Stopped, Senseless and Fighting its double are absent, and nor does it cower (Phase 90 plan 09).
  assert.equal(chips.length, FOE_CONDITIONS.length - 6);
  const bubble = foeConditionChips(fixedFoe({ ward: { mirror: true, pool: 0, popPool: 25, rounds: null } }), fixedState());
  assert.equal(bubble[0].desc, FOE_CONDITION_DESC.bubbled);
  for (const chip of chips) {
    if (chip.key === "resisted") {
      // RULES-18: the resist chip's desc is built at read time (%s filled in
      // with the effect's own word) — never a byte-for-byte dictionary value.
      assert.ok(chip.desc.includes("sleep"), "resisted desc names the effect");
      continue;
    }
    const descKey = chip.key === "dot" ? "poison" : chip.key;
    assert.equal(chip.desc, FOE_CONDITION_DESC[descKey], `${chip.key} desc`);
    assert.ok(typeof chip.desc === "string" && chip.desc.length > 0);
  }
  const poison = foeConditionChips(fixedFoe({ dot: { left: 3, by: "poison" } }), fixedState());
  assert.equal(poison[0].label, "Poison");
  assert.equal(poison[0].desc, FOE_CONDITION_DESC.poison);
});

// RULES-18 (Phase 75.3, Plan 04): held/resisted chip specifics — the label
// varies by kind (held) or is always Unmoved (resisted), a dead foe still
// returns [], and both are absent from a live foe carrying neither field.
test("Held: labelFor is Frozen (a Freeze's or Ice's freeze) or Stunned (Stun's hold, Phase 90 plan 05); a dead foe returns []", () => {
  assert.deepEqual(texts(fixedFoe({ held: { kind: "frozen", left: 3 } })), ["Frozen · 3"]);
  assert.deepEqual(texts(fixedFoe({ held: { kind: "stunned", left: 3 } })), ["Stunned · 3"]);
  assert.deepEqual(texts(fixedFoe({ alive: false, held: { kind: "frozen", left: 3 } })), []);
  assert.deepEqual(texts(fixedFoe({ held: { kind: "frozen", left: 0 } })), [], "left 0 is not a live hold");
});

// Phase 90 plan 08 (SPELL-10): Stop Time's hold and the two misdirected foes.
test("Stopped: engine/combat.js#stopTime's held kind \"time\" reads Stopped with its rounds, as its own chip (never also Held), and says a hit does not start time again", () => {
  const chips = foeConditionChips(fixedFoe({ held: { kind: "time", left: 2 } }), fixedState());
  assert.deepEqual(chips.map((c) => c.text), ["Stopped · 2"]);
  assert.equal(chips[0].key, "stopped");
  assert.equal(chips[0].tone, "good");
  assert.equal(chips[0].desc, FOE_CONDITION_DESC.stopped);
  assert.match(FOE_CONDITION_DESC.stopped, /no turns/);
  assert.match(FOE_CONDITION_DESC.stopped, /does not start time again/);
  assert.deepEqual(texts(fixedFoe({ held: { kind: "time", left: 0 } })), [], "left 0 is not a live hold");
  assert.deepEqual(texts(fixedFoe({ alive: false, held: { kind: "time", left: 2 } })), []);
});

test("Senseless and Fighting its double: engine/combat.js#misdirectFoe's `misdirect` reads one chip per aim with the rounds left, and states the rule in one line", () => {
  const s = foeConditionChips(fixedFoe({ misdirect: { at: "friends", left: 3 } }), fixedState());
  assert.deepEqual(s.map((c) => c.text), ["Senseless · 3"]);
  assert.equal(s[0].key, "senseless");
  assert.equal(s[0].desc, FOE_CONDITION_DESC.senseless);
  assert.match(FOE_CONDITION_DESC.senseless, /never your side/);
  assert.match(FOE_CONDITION_DESC.senseless, /swings at the air/);
  assert.match(FOE_CONDITION_DESC.senseless, /does not end this/);
  const d = foeConditionChips(fixedFoe({ misdirect: { at: "self", left: 2 } }), fixedState());
  assert.deepEqual(d.map((c) => c.text), ["Fighting its double · 2"]);
  assert.equal(d[0].key, "double");
  assert.equal(d[0].desc, FOE_CONDITION_DESC.double);
  assert.match(FOE_CONDITION_DESC.double, /lands on itself/);
  assert.match(FOE_CONDITION_DESC.double, /never on your side/);
  assert.deepEqual(texts(fixedFoe({ misdirect: { at: "friends", left: 0 } })), []);
  assert.deepEqual(texts(fixedFoe({ alive: false, misdirect: { at: "self", left: 2 } })), []);
  assert.deepEqual(texts(fixedFoe({ misdirect: { at: "nowhere", left: 2 } })), [], "an unknown aim shows nothing");
});

// Phase 90 plan 09 (SPELL-10): Size of the Behemoth's per-foe cower.
test("Cowering: engine/combat.js#behemothRoar's `cowering` flag reads one chip with no count (it lasts the fight) and states the rule in one line, top three numbers and half damage", () => {
  const chips = foeConditionChips(fixedFoe({ cowering: true }), fixedState());
  assert.deepEqual(chips.map((c) => c.text), ["Cowering"]);
  assert.equal(chips[0].key, "cowering");
  assert.equal(chips[0].tone, "good");
  assert.equal(chips[0].rounds, null);
  assert.equal(chips[0].desc, FOE_CONDITION_DESC.cowering);
  assert.match(FOE_CONDITION_DESC.cowering, /a high roll \(18–20 on a d20; 17–20 if you insulted them\)/);
  assert.match(FOE_CONDITION_DESC.cowering, /half damage/);
  assert.match(FOE_CONDITION_DESC.cowering, /rest of the fight/);
  assert.deepEqual(texts(fixedFoe({ alive: false, cowering: true })), [], "a dead foe shows nothing");
  // it shows beside the room's Weaken, not instead of it (a Weaken ending never clears it)
  assert.deepEqual(texts(fixedFoe({ cowering: true }), fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } })), ["Cowering", "Weakened · 3"]);
});

test("Unmoved: always the bare label (no rounds); its desc names the resisted effect; a dead foe returns []", () => {
  const chips = foeConditionChips(fixedFoe({ resisted: "weaken" }), fixedState());
  assert.deepEqual(chips.map((c) => c.text), ["Unmoved"]);
  assert.equal(chips[0].tone, "bad");
  assert.ok(chips[0].desc.includes("weaken"), "desc names the resisted effect");
  assert.deepEqual(texts(fixedFoe({ alive: false, resisted: "freeze" })), []);
});

test("chips carry desc: chip text is byte-identical to before (the combat foe cards do not move)", () => {
  const everything = fixedFoe({
    frenzied: true, fixated: true, shrunk: true, stupid: true, dot: { left: 2, by: "poison" }, acid: { rounds: 1 },
    frozen: true, asleep: 2, marked: true, hamstrung: true, blind: true, blindFor: 1, stunned: true,
  });
  const state = fixedState({ combat: { weakened: true }, timers: { "spell:weaken": { left: 3 } } });
  assert.deepEqual(texts(everything, state), [
    "Stunned", "Blind · 1", "Hamstrung", "Marked", "Asleep · 2", "Frozen", "Acid · 1", "Poison · 2",
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
    const keys = e.key === "dot" ? ["poison"] : e.key === "resisted" ? ["unmoved"] : [e.key];
    for (const k of keys) assert.ok(typeof FOE_CONDITION_DESC[k] === "string" && FOE_CONDITION_DESC[k].length > 0, `${k} has no description`);
  }
});

// VOX-05/ROLL-04 (Phase 79, plan 79-07): the two foe-card lines that move a
// foe's swing say so roll-high, matching engine/derived.js#foeSwingChain (a
// blind foe swings on one face; Weaken caps every swing at three faces).
test("VOX-05 (79-07): blind and weakened descriptions state their to-hit effect roll-high, before the flavour", () => {
  // Phase 90 plan 11 (TEXT-01): the same effects as a range on a d20, never faces.
  assert.match(FOE_CONDITION_DESC.blind, /^It hits only on its best roll \(20 on a d20\) and never lands a critical/);
  assert.match(FOE_CONDITION_DESC.weakened, /^Every one of them hits only on a high roll \(18–20 on a d20; 17–20 if you insulted them\), and does half damage/);
});
