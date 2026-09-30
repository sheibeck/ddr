// test/unit/bot-joiner-items.test.js
//
// Phase 89 plan 07 (ITEM-07; "the bot always plays the new rules"). Outside a
// fight the tuning bot makes a Joiner at or below one third of its HP drink one
// of its OWN potions, and makes a hurt Joiner (below potionThreshold) use its
// ready worn Cloak of Regeneration, through the engine action memberUseItem.
// chooseMemberItem is pure (no rng) and only ever proposes what the engine
// will not refuse (an illegal pick would loop forever on the refusal). No bot
// run here: bots only at the milestone end.

import test from "node:test";
import assert from "node:assert/strict";

import { chooseMemberItem, decideAction, makeBotContext, observe } from "../../tools/lib/tuning-bot.mjs";
import { memberUseItem } from "../../engine/items.js";
import { CLOAKS } from "../../content/index.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const fixedPolicyRng = { pick: (arr) => arr[0] };
const regen = { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Regeneration") };
const strength = { kind: "cloak", ...CLOAKS.find((r) => r.n === "Cloak of Strength") };

function member(over = {}) {
  return {
    name: "Brom", cls: "Fighter", sub: "Knight", race: "Human", level: 1,
    wp: 40, maxWP: 40, potions: 0, status: "ok", worn: {}, timers: {}, items: [],
    ...over,
  };
}
function mkState(party, over = {}) {
  return {
    c: { name: "Hero", race: "Human", cls: "Fighter", sub: "Soldier", level: 1, wp: 40, maxWP: 40, potions: 0, rations: 0, spellsUsed: 0, grimoire: [], items: [], skills: {}, gold: 0, timers: {} },
    combat: null, store: null, pendingFind: null, pendingJoiner: null,
    party,
    floor: { g: [[{ wall: false, seen: true, feat: null }]], px: 0, py: 0, depth: 1 },
    dead: false,
    ...over,
  };
}

/** Would the engine refuse this action? (run on a deep copy; the rng is never drawn from except the derived cursor) */
function engineRefuses(state, action) {
  const copy = JSON.parse(JSON.stringify(state));
  const events = memberUseItem(copy, action.i, action.potion ? { potion: true } : { slot: action.slot }, { getState: () => 7, d: () => 5 }, []);
  return events.some((e) => e.type === "useRefused");
}

// ─── the potion rule ────────────────────────────────────────────────────────

test("a Joiner at or below one third of its HP with potions drinks one of its own", () => {
  const ctx = makeBotContext();
  const s = mkState([member({ wp: 13, maxWP: 40, potions: 2 })]);
  const a = chooseMemberItem(s, ctx);
  assert.deepEqual(a, { type: "memberUseItem", i: 0, potion: true });
  assert.equal(engineRefuses(s, a), false);
});

test("exactly a third drinks (exact integer test); one HP above does not", () => {
  const ctx = makeBotContext();
  assert.deepEqual(chooseMemberItem(mkState([member({ wp: 10, maxWP: 30, potions: 1 })]), ctx), { type: "memberUseItem", i: 0, potion: true });
  assert.equal(chooseMemberItem(mkState([member({ wp: 11, maxWP: 30, potions: 1 })]), ctx), null);
  // a max that does not divide by three: 10 of 31 drinks, 11 of 32 does not
  assert.notEqual(chooseMemberItem(mkState([member({ wp: 10, maxWP: 31, potions: 1 })]), ctx), null);
  assert.equal(chooseMemberItem(mkState([member({ wp: 11, maxWP: 32, potions: 1 })]), ctx), null);
});

test("no potions (0 or missing) means no potion pick", () => {
  const ctx = makeBotContext();
  assert.equal(chooseMemberItem(mkState([member({ wp: 5, maxWP: 40, potions: 0 })]), ctx), null);
  const bare = member({ wp: 5, maxWP: 40 });
  delete bare.potions;
  assert.equal(chooseMemberItem(mkState([bare]), ctx), null);
});

// ─── the Cloak of Regeneration rule ─────────────────────────────────────────

test("a hurt Joiner (below potionThreshold) wearing a ready Cloak of Regeneration uses it; the potion rule wins when both fire", () => {
  const ctx = makeBotContext();
  const low = Math.floor(ctx.opts.potionThreshold * 40) - 1;
  assert.ok(low > 40 / 3, "the threshold sits above the one-third potion line, so the cloak fires where the potion does not");
  const hurt = mkState([member({ wp: low, maxWP: 40, worn: { cloak: regen } })]);
  const pick = chooseMemberItem(hurt, ctx);
  assert.deepEqual(pick, { type: "memberUseItem", i: 0, slot: "cloak" });
  assert.equal(engineRefuses(hurt, pick), false);
  // both rules: one third with a potion in hand -> the potion first
  const both = mkState([member({ wp: 12, maxWP: 40, potions: 1, worn: { cloak: regen } })]);
  assert.deepEqual(chooseMemberItem(both, ctx), { type: "memberUseItem", i: 0, potion: true });
});

test("the cloak is skipped when cooling, live, blocked, at or above the threshold, or some other cloak", () => {
  const ctx = makeBotContext();
  const low = Math.floor(ctx.opts.potionThreshold * 40) - 1;
  const cooling = mkState([member({ wp: low, maxWP: 40, worn: { cloak: regen }, timers: { "item:Cloak of Regeneration": { cadence: "squares", left: 9, phase: "cooldown" } } })]);
  assert.equal(chooseMemberItem(cooling, ctx), null);
  const live = mkState([member({ wp: low, maxWP: 40, worn: { cloak: regen }, timers: { "item:Cloak of Regeneration": { cadence: "squares", left: 9, phase: "effect", cd: 50 } } })]);
  assert.equal(chooseMemberItem(live, ctx), null);
  const blockedCtx = makeBotContext();
  blockedCtx.itemBlocked.add("Cloak of Regeneration");
  assert.equal(chooseMemberItem(mkState([member({ wp: low, maxWP: 40, worn: { cloak: regen } })]), blockedCtx), null);
  assert.equal(chooseMemberItem(mkState([member({ wp: 40, maxWP: 40, worn: { cloak: regen } })]), ctx), null);
  assert.equal(chooseMemberItem(mkState([member({ wp: low, maxWP: 40, worn: { cloak: strength } })]), ctx), null);
});

// ─── nothing to do ──────────────────────────────────────────────────────────

test("full HP, a fight, a downed Joiner, no party or a solo hero give null", () => {
  const ctx = makeBotContext();
  assert.equal(chooseMemberItem(mkState([member({ potions: 3, worn: { cloak: regen } })]), ctx), null);
  assert.equal(chooseMemberItem(mkState([member({ wp: 5, potions: 3 })], { combat: { foes: [], round: 1 } }), ctx), null);
  assert.equal(chooseMemberItem(mkState([member({ wp: 0, potions: 3, status: "downed" })]), ctx), null);
  assert.equal(chooseMemberItem(mkState([]), ctx), null);
  assert.equal(chooseMemberItem({ c: {}, party: undefined }, ctx), null);
  assert.equal(chooseMemberItem(null, ctx), null);
});

test("the second Joiner is served when the first needs nothing; party order otherwise", () => {
  const ctx = makeBotContext();
  const s = mkState([member({ name: "A" }), member({ name: "B", wp: 4, maxWP: 40, potions: 1 })]);
  assert.deepEqual(chooseMemberItem(s, ctx), { type: "memberUseItem", i: 1, potion: true });
  const both = mkState([member({ name: "A", wp: 4, maxWP: 40, potions: 1 }), member({ name: "B", wp: 4, maxWP: 40, potions: 1 })]);
  assert.deepEqual(chooseMemberItem(both, ctx), { type: "memberUseItem", i: 0, potion: true });
});

test("purity: never mutates the state, draws nothing", () => {
  const ctx = makeBotContext();
  const s = mkState([member({ wp: 4, maxWP: 40, potions: 2, worn: { cloak: regen } })]);
  const before = JSON.stringify(s);
  chooseMemberItem(s, ctx);
  assert.equal(JSON.stringify(s), before);
  assert.equal(chooseMemberItem.length, 2);
});

// ─── decideAction ───────────────────────────────────────────────────────────

test("decideAction: out of a fight a low Joiner drinks before the bot does anything else", () => {
  const ctx = makeBotContext();
  const s = mkState([member({ wp: 6, maxWP: 40, potions: 1 })]);
  assert.deepEqual(decideAction(s, fixedPolicyRng, ctx), { type: "memberUseItem", i: 0, potion: true });
});

test("decideAction: the hero's own field item (a ready Cloak of Regeneration) still comes first; the hero's own potion comes after the Joiner's", () => {
  const ctx = makeBotContext();
  const heroCloak = mkState([member({ wp: 6, maxWP: 40, potions: 1 })]);
  heroCloak.c = { ...heroCloak.c, wp: 5, maxWP: 40, worn: { cloak: regen } };
  assert.deepEqual(decideAction(heroCloak, fixedPolicyRng, ctx), { type: "useItem", slot: "cloak" });
  const heroPotion = mkState([member({ wp: 6, maxWP: 40, potions: 1 })]);
  heroPotion.c = { ...heroPotion.c, wp: 5, maxWP: 40, potions: 2 };
  assert.deepEqual(decideAction(heroPotion, fixedPolicyRng, ctx), { type: "memberUseItem", i: 0, potion: true });
});

test("decideAction: a healthy Joiner changes nothing (no memberUseItem)", () => {
  const ctx = makeBotContext();
  const a = decideAction(mkState([member({ potions: 2, worn: { cloak: regen } })]), fixedPolicyRng, ctx);
  assert.notEqual(a.type, "memberUseItem");
});

test("decideAction: in a fight the bot never asks a Joiner to use an item (the fight is automatic)", () => {
  const ctx = makeBotContext();
  const combat = { type: "Beasts", foes: [{ name: "f", alive: true, lvl: 1, wp: 20, maxWP: 20 }], round: 1, target: 0 };
  const a = decideAction(mkState([member({ wp: 3, maxWP: 40, potions: 2 })], { combat }), fixedPolicyRng, ctx);
  assert.notEqual(a.type, "memberUseItem");
});

test("a refused memberUseItem is blocked by label and never loops (observe adds it to itemBlocked)", () => {
  const ctx = makeBotContext();
  observe(ctx, [{ type: "useRefused", item: regen, member: "Brom", reason: "cooldown", left: 5 }]);
  assert.ok(ctx.itemBlocked.has("Cloak of Regeneration"));
  const low = Math.floor(ctx.opts.potionThreshold * 40) - 1;
  assert.equal(chooseMemberItem(mkState([member({ wp: low, maxWP: 40, worn: { cloak: regen } })]), ctx), null);
});
