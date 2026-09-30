// test/unit/heal-over-time-lines.test.js
//
// Phase 88 plan 04 (ITEM-03): the heal-over-time lines and chip. User,
// 2026-09-30: every tick is narrated, "including a tick at full hp ('Nothing
// left to knit.')"; the Cloak of Regeneration has "its own 'Regenerating'
// chip" that shows the ticks left; taking the cloak off says how many ticks
// went unspent. Covers the Oracle and rail builders for healTick, the
// itemEffectStarted and itemEffectEnded knit entries, and the chip in the
// real shell sandbox.

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, CARD_EVENTS } from "../../src/browser/narrationLines.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";

const plain = (html) => String(html).replace(/<[^>]+>/g, "");
const oracle = (e) => plain(EVENT_NARRATION[e.type](e));
const rail = (e) => LINE_FOR[e.type](e, {}).text;

const CLOAK = "Cloak of Regeneration";
const tick = (over = {}) => ({ type: "healTick", item: CLOAK, amount: 4, gained: 4, tick: 1, ticks: 3, ...over });

// ─── healTick ──────────────────────────────────────────────────────────────

test("healTick: a tick that heals leads with the hp gained and says which tick it is, on both surfaces", () => {
  assert.equal(oracle(tick()), "Cloak of Regeneration knits you back: +4 hp. Tick 1 of 3.");
  assert.equal(rail(tick()), "+4 hp: Cloak of Regeneration (1/3).");
  assert.equal(oracle(tick({ tick: 3 })), "Cloak of Regeneration knits you back: +4 hp. Tick 3 of 3.");
});

test("healTick: a capped tick says the die was cut short, and prints the gain not the die", () => {
  const capped = tick({ amount: 6, gained: 2 });
  assert.match(oracle(capped), /\+2 hp \(6 rolled, back to full\)/);
  assert.doesNotMatch(oracle(capped), /\+6 hp/);
  assert.match(rail(capped), /\+2 hp: Cloak of Regeneration, back to full \(1\/3\)/);
  assert.doesNotMatch(rail(capped), /\+6/);
});

test("healTick: a tick at full hp reads 'Nothing left to knit.' on both surfaces, never '+0', and is spent", () => {
  const full = tick({ amount: 5, gained: 0, tick: 2 });
  assert.match(oracle(full), /^Nothing left to knit\./);
  assert.match(oracle(full), /Tick 2 of 3\./);
  assert.match(oracle(full), /spends a tick/);
  assert.equal(rail(full), "Nothing left to knit (2/3).");
  for (const text of [oracle(full), rail(full)]) assert.doesNotMatch(text, /\+0\b/, text);
});

test("healTick: a bare payload renders with no 'undefined' or 'NaN'", () => {
  for (const e of [{ type: "healTick" }, { type: "healTick", amount: 3 }, { type: "healTick", gained: 0 }]) {
    for (const text of [oracle(e), rail(e)]) {
      assert.doesNotMatch(text, /undefined|NaN|null/, text);
      assert.ok(text.length > 0);
    }
  }
});

test("healTick: player text says hp, never WP; it is a minor event, never a decision card", () => {
  for (const e of [tick(), tick({ gained: 0 })]) {
    for (const text of [oracle(e), rail(e)]) assert.doesNotMatch(text, /\bWP\b/i, text);
  }
  assert.equal(CARD_EVENTS.has("healTick"), false, "regeneration ticks are minor events: rail/Oracle lines only");
  assert.equal(CARD_EVENTS.has("itemEffectEnded"), false);
});

test("the retired use-time instant-heal event has no builder on either surface", () => {
  assert.equal(EVENT_NARRATION.cloakRegenerated, undefined);
  assert.equal(LINE_FOR.cloakRegenerated, undefined);
});

// ─── knit start and end ────────────────────────────────────────────────────

const started = (over = {}) => ({
  type: "itemEffectStarted", item: CLOAK, kind: "knit", left: 30, cadence: "squares",
  every: 10, ticks: 3, heal: { n: 1, sides: 6, bonus: 0 }, ...over,
});

test("knit start: the line states the window, the die, the cadence and the count from the event's own numbers", () => {
  const o = oracle(started());
  assert.match(o, /30 squares of knitting/);
  assert.match(o, /a d6 hp back every 10 squares you walk, 3 times/);
  assert.match(o, /Fights do not count/);
  const r = rail(started());
  assert.match(r, /30 squares of knitting: a d6 hp every 10 squares walked, 3 times\./);
  // a different item's numbers read through: nothing is hard-coded
  assert.match(oracle(started({ left: 20, every: 5, ticks: 4, heal: { n: 2, sides: 4, bonus: 1 } })), /20 squares of knitting: 2d4\+1 hp back every 5 squares you walk, 4 times/);
  assert.match(oracle(started({ ticks: 1, every: 1 })), /every 1 square you walk, once/);
});

test("knit start: a bare payload falls back to a plain line", () => {
  for (const e of [{ type: "itemEffectStarted", kind: "knit" }, started({ every: undefined }), started({ heal: undefined })]) {
    for (const text of [oracle(e), rail(e)]) {
      assert.doesNotMatch(text, /undefined|NaN/, text);
      assert.match(text, /knitting/);
    }
  }
});

const ended = (over = {}) => ({ type: "itemEffectEnded", item: CLOAK, kind: "knit", slot: "cloak", why: "off", left: 15, ready: 65, ticks: 2, ...over });

test("knit ended: the take-off line names the ticks left unspent and when the cloak is ready, on both surfaces", () => {
  const o = oracle(ended());
  assert.match(o, /^Your Cloak of Regeneration comes off/);
  assert.match(o, /the knitting stops, with 2 ticks still owed/);
  assert.match(o, /Ready again in 65 squares/);
  const r = rail(ended());
  assert.match(r, /the knitting stops, 2 ticks unspent/);
  assert.match(r, /ready in 65 squares/);
  assert.match(oracle(ended({ ticks: 1 })), /1 tick still owed/);
  assert.match(rail(ended({ ticks: 1 })), /1 tick unspent/);
});

test("knit ended: with no ticks left (or a bare payload) the line is plain", () => {
  for (const e of [ended({ ticks: 0 }), ended({ ticks: undefined }), { type: "itemEffectEnded", kind: "knit" }]) {
    assert.match(oracle(e), /the knitting stops\./);
    assert.doesNotMatch(oracle(e), /owed/);
    assert.doesNotMatch(rail(e), /unspent/);
    for (const text of [oracle(e), rail(e)]) assert.doesNotMatch(text, /undefined|NaN/, text);
  }
});

// ─── the chip, in the real shell ───────────────────────────────────────────

function chipState(left) {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 30, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0,
      worn: {},
      timers: { [`item:${CLOAK}`]: { cadence: "squares", left, cd: 50, phase: "effect", src: { slot: "cloak", n: CLOAK } } },
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

function rig() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion: true });
  const chip = (key) => doc.document.getElementById("mm-conditions").children.find((c) => c.className === "mw-cond" && c.dataset.key === key);
  return { sandbox, w: sandbox.context.window, chip };
}

test("chip: the Regenerating chip shows while the window is live and states the ticks left (3, 2, 1)", () => {
  for (const [left, text] of [[30, "3 ticks"], [21, "3 ticks"], [20, "2 ticks"], [10, "1 tick"], [1, "1 tick"]]) {
    const r = rig();
    r.w.__mzState.set(chipState(left));
    r.sandbox.paint();
    const c = r.chip("knit");
    assert.ok(c, `left ${left}: the knit chip is painted`);
    assert.match(c.textContent, /Regenerating/);
    const detail = c.children.find((el) => el.className === "mw-cond-detail");
    assert.ok(detail, `left ${left}: the chip carries a detail span`);
    assert.equal(detail.textContent, text, `left ${left}: the detail states the ticks left`);
  }
});

test("chip: no chip once the window has closed (the cloak is cooling)", () => {
  const r = rig();
  const s = chipState(30);
  s.c.timers[`item:${CLOAK}`] = { cadence: "squares", left: 50, phase: "cooldown" };
  r.w.__mzState.set(s);
  r.sandbox.paint();
  assert.equal(r.chip("knit"), undefined);
});

test("chip: the copy names the chip Regenerating and CONDITION_EXPLAIN.knit is its own sentence, not the default", () => {
  const r = rig();
  const ctx = r.sandbox.context;
  assert.equal(vm.runInContext('CONDITION_COPY.knit.label', ctx), "Regenerating");
  const explain = vm.runInContext("CONDITION_EXPLAIN.knit", ctx);
  const fallback = vm.runInContext("CONDITION_EXPLAIN.default", ctx);
  assert.ok(typeof explain === "string" && explain.length > 0 && explain !== fallback);
  assert.match(explain, /d6/);
  assert.match(explain, /ten squares/);
  assert.match(explain, /fighting/);
  assert.doesNotMatch(explain, /\bWP\b/);
});
