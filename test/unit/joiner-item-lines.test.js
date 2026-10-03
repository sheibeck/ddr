// test/unit/joiner-item-lines.test.js
//
// Phase 89 plan 05 (ITEM-07): every Joiner item event has its own Oracle line
// and rail twin that names the Joiner, and every new refusal reason has its own
// line on both surfaces (never the generic "does not work for you" fallback).
// The hero's forms for a hero payload are byte-identical to before, and a bare
// payload renders clean (no "undefined" / "NaN"). User, 2026-09-30: "let joiners
// use items they have ... Just like players." Ruling Q2 (docs/ITEM-AUDIT.md):
// the party-moving and leading items stay with the one in front.

import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { EVENT_CLIP_GROUP } from "../../src/browser/sfx.js";

const strip = (html) => String(html).replace(/<[^>]*>/g, "");
const oracle = (e) => strip(EVENT_NARRATION[e.type](e));
const rail = (e) => strip(LINE_FOR[e.type](e).text);
const SURFACES = { oracle, rail };

const M = "Brom";

// Phrases a Joiner's line must never use about the Joiner.
const HERO_ONLY = /\byou (drink|uncork|use|strike|are (Large|unseen))|\byour (cloak|potion|hands|ring|amulet|bracelet|item|cooldown)|back: you\b|knits you back/i;

// ─── the Joiner's own potion ────────────────────────────────────────────────

const POTION_FORMS = [
  { name: "a real drink", e: { type: "memberPotionDrunk", member: M, amount: 12, gained: 12, remaining: 1 } },
  { name: "a capped drink", e: { type: "memberPotionDrunk", member: M, amount: 18, gained: 7, remaining: 0 } },
  { name: "a full-hp drink", e: { type: "memberPotionDrunk", member: M, amount: 12, gained: 0, remaining: 2 } },
  { name: "a doubled drink", e: { type: "memberPotionDrunk", member: M, amount: 24, gained: 24, remaining: 1, doubled: "Wilmsry" } },
];

for (const [surface, render] of Object.entries(SURFACES)) {
  for (const { name, e } of POTION_FORMS) {
    test(`${surface}: memberPotionDrunk ${name} names the Joiner, states the hp and the potions left`, () => {
      const text = render(e);
      assert.ok(text.includes(M), text);
      assert.ok(!HERO_ONLY.test(text), text);
      if (e.gained > 0) assert.ok(text.includes(`+${e.gained} hp`), text);
      else assert.match(text, /full hp/, text);
      assert.ok(text.includes(String(e.remaining)), `${text} (says what is left)`);
      if (e.amount > e.gained && e.gained > 0) assert.match(text, /back to full/, "a capped drink says so");
      if (e.doubled) assert.ok(text.includes(e.doubled), text);
    });
  }
}

test("memberPotionDrunk is a rail feature line, a drink sound, and not a card event", async () => {
  const { CARD_EVENTS, FEATURE_EVENTS, ORACLE_ONLY } = await import("../../src/browser/narrationLines.js");
  assert.ok(FEATURE_EVENTS.includes("memberPotionDrunk"));
  assert.ok(!CARD_EVENTS.has("memberPotionDrunk"));
  assert.ok(!ORACLE_ONLY.has("memberPotionDrunk"));
  assert.equal(EVENT_CLIP_GROUP.memberPotionDrunk, "drink");
});

// ─── a Joiner's item events ─────────────────────────────────────────────────

const STARTED_KINDS = [
  ["haste", { item: "Cloak of Speed", left: 50 }],
  ["invis", { item: "Cloak of Invisibility", left: 50 }],
  ["unseen", { item: "Anklet of Invisibility", left: 50 }],
  ["acute", { item: "Acute Potion", left: 5 }],
  ["might", { item: "Potion of Strength", left: 25, might: 8 }],
  ["power", { item: "Ring of Power", left: 50 }],
  ["giant", { item: "Gauntlet of the Giant", left: 50, size: "Large", step: 1, sizeDmg: 2, dmgTotal: 6 }],
  ["enlarge", { item: "Potion of Enlarge", left: 50, size: "Large", step: 1, sizeDmg: 2, dmgTotal: 11 }],
  ["critWard", { item: "Cloak of Strength", left: 50 }],
  ["plate", { item: "Cloak of Armor", left: 50 }],
  ["knit", { item: "Cloak of Regeneration", left: 30, every: 10, ticks: 3, heal: { n: 1, sides: 6, bonus: 0 } }],
];

for (const [surface, render] of Object.entries(SURFACES)) {
  for (const [kind, extra] of STARTED_KINDS) {
    test(`${surface}: itemEffectStarted (${kind}) for a Joiner names the Joiner and never speaks to the hero`, () => {
      const text = render({ type: "itemEffectStarted", kind, cadence: "squares", member: M, ...extra });
      assert.ok(text.includes(M), text);
      assert.ok(!HERO_ONLY.test(text), text);
      assert.ok(!/\b(undefined|NaN)\b/.test(text), text);
      assert.ok(text.includes(String(extra.left)) || kind === "acute", `${text} (states the length)`);
    });
  }

  test(`${surface}: a Joiner's Enlarge states the ruled +11 from the event's own dmgTotal and the to-hit cost`, () => {
    const text = render({ type: "itemEffectStarted", kind: "enlarge", member: M, left: 50, size: "Large", step: 1, sizeDmg: 2, dmgTotal: 11 });
    assert.match(text, /\+11 damage/);
    assert.match(text, /\+1 to hit/);
  });

  test(`${surface}: a Joiner's Gauntlet states the ruled +6 from the event's own dmgTotal and the to-hit cost`, () => {
    const text = render({ type: "itemEffectStarted", kind: "giant", member: M, left: 50, size: "Large", step: 1, sizeDmg: 2, dmgTotal: 6 });
    assert.match(text, /\+6 damage/);
    assert.match(text, /\+1 to hit/);
  });

  test(`${surface}: itemUsed, itemEffectFaded and itemCooled name the Joiner`, () => {
    const used = render({ type: "itemUsed", member: M, item: { n: "Cloak of Strength" } });
    assert.ok(used.includes(M) && used.includes("Cloak of Strength") && !HERO_ONLY.test(used), used);
    assert.ok(!/^You use/.test(used), used);
    const faded = render({ type: "itemEffectFaded", member: M, item: "Cloak of Strength", kind: "critWard" });
    assert.ok(faded.includes(M) && faded.includes("Cloak of Strength") && /wears off/.test(faded), faded);
    const cooled = render({ type: "itemCooled", member: M, item: "Cloak of Strength" });
    assert.ok(cooled.includes(M) && cooled.includes("Cloak of Strength") && /ready again/.test(cooled), cooled);
  });

  test(`${surface}: healTick for a Joiner names the Joiner (a real tick, a capped tick, a full-hp tick)`, () => {
    const real = render({ type: "healTick", member: M, item: "Cloak of Regeneration", amount: 4, gained: 4, tick: 1, ticks: 3 });
    assert.ok(real.includes(M) && real.includes("+4 hp") && !HERO_ONLY.test(real), real);
    const capped = render({ type: "healTick", member: M, item: "Cloak of Regeneration", amount: 6, gained: 2, tick: 2, ticks: 3 });
    assert.ok(capped.includes(M) && capped.includes("+2 hp") && /back to full/.test(capped), capped);
    const full = render({ type: "healTick", member: M, item: "Cloak of Regeneration", amount: 5, gained: 0, tick: 3, ticks: 3 });
    assert.ok(full.includes(M) && /Nothing left to knit/.test(full) && !/\+0/.test(full) && !/hero/.test(full), full);
  });

  test(`${surface}: pilferFumbled for a Joiner names the Joiner's hands and hp, never "your"`, () => {
    const text = render({ type: "pilferFumbled", member: M, item: "Cloak of Speed", slot: "cloak", dmg: 6, roll: 1, atLeast: 2, dieN: 20 });
    assert.ok(text.includes(M) && text.includes("6 hp") && /dust/i.test(text) && !HERO_ONLY.test(text), text);
  });
}

// ─── the refusals: each reason its own line ─────────────────────────────────

const DAGGER = { n: "Cloak of Strength" };
const REFUSALS = [
  ["noMember", { type: "useRefused", reason: "noMember" }, /no such companion/i, false],
  ["inCombat", { type: "useRefused", member: M, reason: "inCombat" }, /in a fight/i, true],
  ["noPotions", { type: "useRefused", member: M, reason: "noPotions" }, /no potions/i, true],
  ["fullHealth", { type: "useRefused", member: M, reason: "fullHealth" }, /full hp/i, true],
  ["leaderOnly", { type: "useRefused", member: M, reason: "leaderOnly", item: { n: "Cloak of Flying" } }, /Cloak of Flying/, true],
  ["cooldown", { type: "useRefused", member: M, reason: "cooldown", left: 12, item: DAGGER }, /ready again in 12 squares/, true],
  ["combatOnly", { type: "useRefused", member: M, reason: "combatOnly", item: DAGGER }, /wants a target/, true],
];

for (const [surface, render] of Object.entries(SURFACES)) {
  for (const [reason, e, pattern, named] of REFUSALS) {
    test(`${surface}: useRefused "${reason}" has its own line (not the generic fallback)`, () => {
      const text = render(e);
      assert.match(text, pattern, text);
      assert.ok(!/does not work for you/.test(text), text);
      assert.ok(!/undefined|NaN/.test(text), text);
      if (named) assert.ok(text.includes(M), text);
      assert.ok(!HERO_ONLY.test(text), text);
    });
  }

  test(`${surface}: the seven Joiner refusal lines are all different from one another`, () => {
    const texts = REFUSALS.map(([, e]) => render(e));
    assert.equal(new Set(texts).size, texts.length, texts.join(" | "));
  });

  test(`${surface}: leaderOnly says why, in one line, per ruling Q2 (only the one in front can use it)`, () => {
    const text = render({ type: "useRefused", member: M, reason: "leaderOnly", item: { n: "Helm of Knowledge" } });
    assert.match(text, /in front/);
    assert.match(text, /party/);
  });
}

// ─── joining: what it wore, what its scroll did ─────────────────────────────

for (const [surface, render] of Object.entries(SURFACES)) {
  test(`${surface}: joinerJoined says what the Joiner put on, and what its scroll did (a spell, or nothing)`, () => {
    const base = { type: "joinerJoined", name: M, sub: "Pilfer", lvl: 2 };
    const plain = render(base);
    const wore = render({ ...base, wore: ["Cloak of Speed"] });
    assert.ok(wore.includes("Cloak of Speed") && wore.startsWith(plain.slice(0, 20)), wore);
    const two = render({ ...base, wore: ["Ring of Power", "Cloak of Speed"] });
    assert.ok(two.includes("Ring of Power") && two.includes("Cloak of Speed"), two);
    const spell = render({ ...base, scroll: "Freeze" });
    assert.ok(spell.includes("Freeze") && /scroll/i.test(spell), spell);
    const nothing = render({ ...base, scroll: null });
    assert.ok(/scroll/i.test(nothing) && /nothing/i.test(nothing), nothing);
    assert.ok(!/undefined|NaN|null/.test(`${wore} ${two} ${spell} ${nothing}`));
  });
}

// ─── the hero's forms are byte-identical ────────────────────────────────────

test("hero forms (no member) are byte-identical to before, on both surfaces", () => {
  const hero = (type, e) => ({ oracle: oracle({ type, ...e }), rail: rail({ type, ...e }) });
  assert.deepEqual(hero("itemUsed", { item: { n: "Cloak of Speed" } }), { oracle: "You use Cloak of Speed.", rail: "You use Cloak of Speed." });
  assert.deepEqual(hero("itemEffectFaded", { item: "Cloak of Speed" }), { oracle: "Cloak of Speed wears off.", rail: "Cloak of Speed wears off." });
  assert.deepEqual(hero("itemCooled", { item: "Cloak of Speed" }), { oracle: "Cloak of Speed is ready again.", rail: "Cloak of Speed is ready again." });
  assert.equal(oracle({ type: "itemEffectStarted", kind: "haste", left: 50 }), "Double attacks for 50 squares.");
  assert.equal(rail({ type: "itemEffectStarted", kind: "haste", left: 50 }), "Double attacks for 50 squares.");
  assert.equal(oracle({ type: "itemEffectStarted", kind: "enlarge", left: 50, size: "Large", step: 1, sizeDmg: 2, dmgTotal: 11 }), "50 squares one size larger: you are Large. +11 damage, and foes +1 to hit you. A bigger stick and a bigger target. Nobody said it was free.");
  assert.equal(oracle({ type: "healTick", item: "Cloak of Regeneration", amount: 4, gained: 4, tick: 1, ticks: 3 }), "Cloak of Regeneration knits you back: +4 hp. Tick 1 of 3.");
  assert.equal(rail({ type: "healTick", item: "Cloak of Regeneration", amount: 4, gained: 4, tick: 1, ticks: 3 }), "+4 hp: Cloak of Regeneration (1/3).");
  assert.equal(oracle({ type: "useRefused", reason: "cooldown", left: 12, item: { n: "Cloak of Speed" } }), "Cloak of Speed: ready again in 12 squares. It is not a vending machine.");
  assert.equal(rail({ type: "useRefused", reason: "combatOnly", item: { n: "Cloak of Speed" } }), "Cloak of Speed wants a target. Save it for a fight.");
  assert.equal(oracle({ type: "pilferFumbled", item: "Cloak of Speed", dmg: 6, roll: 1, atLeast: 2, dieN: 20 }), "Cloak of Speed comes apart in your hands. 1 vs 2–20. −6 hp, and it is dust now.");
  assert.equal(rail({ type: "pilferFumbled", item: "Cloak of Speed", dmg: 6 }), "Cloak of Speed comes apart (−6 hp). Dust now.");
  const joined = { type: "joinerJoined", name: M, sub: "Pilfer", lvl: 2 };
  assert.equal(oracle(joined), `${M} falls in beside you, already quietly revising their life expectancy downward.`);
  assert.equal(rail(joined), `${M} falls in beside you.`);
});

// ─── bare payloads render clean ─────────────────────────────────────────────

const NEW_TYPES = ["memberPotionDrunk", "useRefused", "itemUsed", "itemEffectStarted", "itemEffectFaded", "itemCooled", "healTick", "pilferFumbled", "joinerJoined"];

for (const [surface, render] of Object.entries(SURFACES)) {
  test(`${surface}: a bare { type } and a bare { type, member } payload render clean for every Joiner event`, () => {
    for (const type of NEW_TYPES) {
      for (const e of [{ type }, { type, member: M }]) {
        const text = render(e);
        assert.ok(text.length > 0, type);
        assert.ok(!/undefined|NaN|\[object/.test(text), `${type} ${JSON.stringify(e)}: ${text}`);
      }
    }
    for (const reason of ["noMember", "inCombat", "noPotions", "fullHealth", "leaderOnly", "cooldown", "combatOnly"]) {
      for (const e of [{ type: "useRefused", reason }, { type: "useRefused", reason, member: M }]) {
        const text = render(e);
        assert.ok(!/undefined|NaN|\[object/.test(text), `${reason} ${JSON.stringify(e)}: ${text}`);
      }
    }
  });
}
