// test/unit/bot-balance-close.test.js
//
// Phase 92 plan 01 (TUNE-10, ECON-11): probes for the bot-only fixes the
// milestone-end balance close leans on. Every test here is a hand-built state
// or a short bounded bot run; no balance readout runs in this file.
//   - "camp gate:"  the fair bot camps on the whole party's nightly need
//                   (nightlyEats), the number makeCamp refuses on (89-06).
//   - "cloak:"      a Cloak of Regeneration is a heal over time, not a free
//                   instant heal (88-04).
//   - "tally:"      a Joiner's itemUsed is counted apart from the hero's (89-07).
//   - "cutpurse:"   the 91.1 Cutpurse is the never-worse-than-STRIKE fallback.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun, applyAction } from "../../engine/engine.js";
import { eatsFor, nightlyEats } from "../../engine/movement.js";
import { itemEffectActive } from "../../engine/derived.js";
import { CLOAKS } from "../../content/index.js";
import {
  decideAction,
  makeBotContext,
  forceParty,
  playRun,
  chooseFieldItem,
  chooseMemberItem,
  chooseAbility,
  knitWindowHeal,
  makeTallies,
  tallyUsage,
  DIRS,
  BOT_DEFAULTS,
  RUN_FLAGS,
} from "../../tools/lib/tuning-bot.mjs";
import { setIdentityDials } from "./harness/identityDials.js";

// The real-run probes are measured against the identity dials, like the other
// bot-driven suites (tuning-bot.test.js, bot-tactics.test.js).
setIdentityDials();

const FIRST = { pick: (arr) => arr[0] };

// A fresh solo state, hurt below campThreshold with no potions: the setup the
// camp gate decides on.
function hurtSolo(seed = 1) {
  const state = newRun(seed, [], { ...RUN_FLAGS });
  state.c.wp = Math.max(1, Math.floor(state.c.maxWP * BOT_DEFAULTS.campThreshold) - 1);
  state.c.potions = 0;
  return state;
}

test("camp gate: a solo hero below campThreshold with rations equal to its own appetite camps", () => {
  const state = hurtSolo(1);
  state.c.rations = nightlyEats(state);
  assert.equal(nightlyEats(state), eatsFor(state.c), "a solo hero's need is its own appetite");
  assert.deepStrictEqual(decideAction(state, FIRST, makeBotContext()), { type: "camp" });
});

test("camp gate: with a Joiner, rations at the hero's appetite alone do not camp; at nightlyEats they do", () => {
  const state = hurtSolo(1);
  forceParty(state);
  assert.ok(state.party.length >= 1, "forceParty must recruit at least one member");
  state.c.wp = Math.max(1, Math.floor(state.c.maxWP * BOT_DEFAULTS.campThreshold) - 1);
  state.c.potions = 0;
  assert.ok(nightlyEats(state) > eatsFor(state.c), "a Joiner adds to the nightly need");

  state.c.rations = eatsFor(state.c);
  const short = decideAction(state, FIRST, makeBotContext());
  assert.notEqual(short.type, "camp", "rations short of the party's need must not camp (makeCamp would refuse)");

  state.c.rations = nightlyEats(state);
  assert.deepStrictEqual(decideAction(state, FIRST, makeBotContext()), { type: "camp" });
});

test("camp gate: a seed that used to loop campFailed ends dead within its budget with no campFailed and not stuck", () => {
  // Measured live at identity dials, maxActions 1500 (never hand-typed): seed 4
  // stalled at depth 5 on the plan base with 1032 campFailed events (a Joiner's
  // appetite the hero-only gate did not count); with the gate on nightlyEats it
  // dies at action 527, depth 6, with none.
  let campFailed = 0;
  const r = playRun(4, { ...BOT_DEFAULTS, maxActions: 1500 }, (events) => {
    for (const e of events) if (e.type === "campFailed") campFailed++;
  });
  assert.equal(campFailed, 0, "no campFailed event");
  assert.equal(r.stuck, false, "not stuck");
  assert.equal(r.dead, true, "ends dead inside its budget");
});

// ─── the Cloak of Regeneration is a heal over time (88-04) ──────────────────

const REGEN = { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Regeneration") };
function ctxFresh() {
  return makeBotContext();
}

// A hero in a lit single-cell room wearing a ready Cloak of Regeneration.
function cloaked({ wp, maxWP = 40, potions = 0, rations = 0 } = {}) {
  const state = newRun(1, [], { ...RUN_FLAGS });
  state.floor = { g: [[{ wall: false, seen: true, feat: null, dark: false }]], px: 0, py: 0, depth: 1 };
  state.c.maxWP = maxWP;
  state.c.wp = wp;
  state.c.potions = potions;
  state.c.rations = rations;
  state.c.worn = { ...(state.c.worn || {}), cloak: { ...REGEN } };
  state.c.timers = {};
  return state;
}

test("cloak: knitWindowHeal reads the item's own heal-over-time record (3 x d6 = 10.5), 0 for an item with none", () => {
  assert.equal(knitWindowHeal(REGEN), 10.5);
  assert.equal(knitWindowHeal({ kind: "cloak", n: "Cloak of Armor" }), 0);
  assert.equal(knitWindowHeal(null), 0);
});

test("cloak: missing hp that covers the window's heal uses the cloak though the hero is above potionThreshold", () => {
  const ctx = ctxFresh();
  // 28/40 = 0.70 >= 0.60: the old trigger would not fire; 12 missing >= 10.5.
  const s = cloaked({ wp: 28 });
  assert.ok(28 / 40 >= ctx.opts.potionThreshold);
  assert.deepStrictEqual(chooseFieldItem(s, ctx), { type: "useItem", slot: "cloak" });
  assert.deepStrictEqual(decideAction(s, FIRST, ctx), { type: "useItem", slot: "cloak" });
});

test("cloak: missing hp below the window's heal and above potionThreshold does not use it", () => {
  const ctx = ctxFresh();
  // 30/40: 10 missing < 10.5, ratio 0.75 >= 0.60.
  assert.equal(chooseFieldItem(cloaked({ wp: 30 }), ctx), null);
  assert.equal(chooseFieldItem(cloaked({ wp: 40 }), ctx), null);
});

test("cloak: below potionThreshold the old trigger still fires (a small heart whose missing hp never reaches the window heal)", () => {
  const ctx = ctxFresh();
  // 5/10: 5 missing < 10.5 but ratio 0.5 < 0.6.
  assert.deepStrictEqual(chooseFieldItem(cloaked({ wp: 5, maxWP: 10 }), ctx), { type: "useItem", slot: "cloak" });
});

test("cloak: with the hero's own knit window live the bot walks on instead of drinking a potion out of a fight; a spent window drinks again", () => {
  // Start the window through the engine's own use path, not by hand-writing a timer.
  const hurt = cloaked({ wp: 14, potions: 2, rations: 9 });
  const { state: live, events } = applyAction(hurt, { type: "useItem", slot: "cloak" });
  assert.ok(events.some((e) => e.type === "itemUsed"), "the engine used the cloak");
  assert.equal(itemEffectActive(live.c, "knit"), true, "the knit window is live");
  live.c.wp = 14; // still low, with potions in the bag
  const a = decideAction(live, FIRST, ctxFresh());
  assert.notEqual(a.type, "drinkPotion", "no potion while the window heals as the bot walks");
  assert.equal(a.type, "camp", "below campThreshold with the rations it still camps (the camp gate is unchanged)");

  // No rations: it walks on.
  live.c.rations = 0;
  assert.equal(decideAction(live, FIRST, ctxFresh()).type, "move");

  // Control: with no live window the same hero drinks.
  const bare = cloaked({ wp: 14, potions: 2 });
  bare.c.worn = {};
  assert.deepStrictEqual(decideAction(bare, FIRST, ctxFresh()), { type: "drinkPotion" });
});

test("cloak: the window heals as the hero walks (at most three ticks), the premise of the wait", () => {
  const s = newRun(1, [], { ...RUN_FLAGS });
  s.c.maxWP = 400;
  s.c.wp = 100;
  s.c.worn = { ...(s.c.worn || {}), cloak: { ...REGEN } };
  s.c.timers = {};
  let { state } = applyAction(s, { type: "useItem", slot: "cloak" });
  let ticks = 0;
  let gained = 0;
  for (let i = 0; i < 60 && !state.combat && !state.dead; i++) {
    const dir = ["E", "W", "S", "N"].find((d) => {
      const f = state.floor;
      const [dx, dy] = DIRS[d];
      const cell = f.g[f.py + dy] && f.g[f.py + dy][f.px + dx];
      return cell && !cell.wall && !cell.feat;
    });
    if (!dir) break;
    const r = applyAction(state, { type: "move", dir });
    state = r.state;
    for (const e of r.events) {
      if (e.type === "healTick") {
        ticks++;
        gained += e.gained;
      }
    }
  }
  assert.ok(ticks <= 3, `at most three ticks in one window (saw ${ticks})`);
  assert.ok(gained >= ticks, "each tick that lands heals at least a point (hp is far from full)");
});

// A standing Joiner on a hand-built party sheet.
function joiner(over = {}) {
  return { name: "Brom", cls: "Fighter", sub: "Knight", race: "Human", level: 1, wp: 40, maxWP: 40, potions: 0, status: "ok", worn: { cloak: { ...REGEN } }, timers: {}, items: [], ...over };
}
function withParty(party) {
  const s = cloaked({ wp: 40 });
  s.party = party;
  return s;
}

test("cloak: a Joiner's ready worn cloak is used at the same missing-hp trigger; the potion rule (a third of its hp) is unchanged", () => {
  const ctx = ctxFresh();
  // 28/40 = 0.70 above potionThreshold, 12 missing >= 10.5.
  assert.deepStrictEqual(chooseMemberItem(withParty([joiner({ wp: 28 })]), ctx), { type: "memberUseItem", i: 0, slot: "cloak" });
  // 30/40: 10 missing < 10.5 and ratio 0.75: not used.
  assert.equal(chooseMemberItem(withParty([joiner({ wp: 30 })]), ctx), null);
  // below potionThreshold on a small heart: used by the old trigger.
  assert.deepStrictEqual(chooseMemberItem(withParty([joiner({ wp: 5, maxWP: 10 })]), ctx), { type: "memberUseItem", i: 0, slot: "cloak" });
  // the potion rule still wins at a third with a potion in hand.
  assert.deepStrictEqual(chooseMemberItem(withParty([joiner({ wp: 12, potions: 1 })]), ctx), { type: "memberUseItem", i: 0, potion: true });
  // a Joiner whose own window is live is skipped.
  const liveJ = joiner({ wp: 12, timers: { "item:Cloak of Regeneration": { cadence: "squares", left: 20, phase: "effect", cd: 50 } } });
  assert.equal(chooseMemberItem(withParty([liveJ]), ctx), null);
});

// ─── the member tally (89-07) ───────────────────────────────────────────────

test("tally: a member-tagged itemUsed counts in usage.memberItems and never in usage.items; the hero's counts in usage.items", () => {
  const t = makeTallies();
  assert.deepStrictEqual(t.usage, { abilities: {}, spells: {}, items: {}, memberItems: {} });
  tallyUsage(t, { type: "memberUseItem" }, [{ type: "itemUsed", item: REGEN, member: "Brom" }], {}, {});
  assert.deepStrictEqual(t.usage.memberItems, { "Cloak of Regeneration": 1 });
  assert.deepStrictEqual(t.usage.items, {});
  tallyUsage(t, { type: "useItem", slot: "cloak" }, [{ type: "itemUsed", item: REGEN }], {}, {});
  assert.deepStrictEqual(t.usage.items, { "Cloak of Regeneration": 1 });
  assert.deepStrictEqual(t.usage.memberItems, { "Cloak of Regeneration": 1 });
});

test("tally: the engine's own Joiner item use (memberUseItem through applyAction) lands in memberItems", () => {
  const s = withParty([joiner({ wp: 12 })]);
  const { state, events } = applyAction(s, { type: "memberUseItem", i: 0, slot: "cloak" });
  const used = events.find((e) => e.type === "itemUsed");
  assert.ok(used && used.member === "Brom", "the engine tags a Joiner's itemUsed with member");
  const t = makeTallies();
  tallyUsage(t, { type: "memberUseItem", i: 0, slot: "cloak" }, events, s, state);
  assert.deepStrictEqual(t.usage.items, {});
  assert.deepStrictEqual(t.usage.memberItems, { "Cloak of Regeneration": 1 });
});

// ─── Cutpurse (91.1 V11) ────────────────────────────────────────────────────

function thiefFight({ round, foeWp = 5 }) {
  const state = newRun(1, [], { ...RUN_FLAGS });
  state.c.cls = "Thief";
  state.c.sub = "Pilfer";
  state.c.abilities = ["cutpurse"];
  state.c.timers = {};
  state.combat = { type: "Beasts", foes: [{ name: "f", alive: true, lvl: 1, wp: foeWp, maxWP: 20 }], round, target: 0 };
  return state;
}

test("cutpurse: a Thief whose only ready ability is Cutpurse uses it in any round with nothing else applying (a foe below half hp); a spent one is not picked", () => {
  const ctx = ctxFresh();
  for (const round of [1, 2, 5]) {
    const s = thiefFight({ round });
    assert.deepStrictEqual(chooseAbility(s, ctx), { key: "cutpurse", target: 0 }, `round ${round}`);
  }
  const spent = thiefFight({ round: 3 });
  spent.c.timers = { "ability:cutpurse": { cadence: "rounds", left: 996, phase: "cooldown" } };
  assert.equal(chooseAbility(spent, ctx), null);
  assert.deepStrictEqual(decideAction(spent, FIRST, ctxFresh()), { type: "attack" });
});
