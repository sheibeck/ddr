// test/unit/ablation-switch.test.js
//
// Quick 260928-abl — the bot-side ablation switch (tools/lib/ablation.mjs,
// read by tools/lib/tuning-bot.mjs as `opts.ablate`). Pins: it is OFF by
// default (BOT_DEFAULTS carries no `ablate`, and every helper is a no-op for
// null), each kind touches only the hero it names, and `affectsRow` is a
// superset of the runs an ablation can change. Synthetic states only, plus
// two short real runs proving the switch is inert when it does not apply.

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseAblation,
  abilityAblated,
  applyStartAblation,
  applyStrikeAblation,
  affectsRow,
  SUB_ABLATED,
  dialOverridesFor,
} from "../../tools/lib/ablation.mjs";
import { chooseAbility, makeBotContext, playRun, BOT_DEFAULTS, botLine } from "../../tools/lib/tuning-bot.mjs";
import { fleeBreakdown } from "../../engine/derived.js";
import { setDialsForTuning } from "../../engine/difficulty.js";
import { FLEE_THIEF_BONUS } from "../../content/index.js";

// Quick 260928-nrf (user ruling 2026-09-28): the bonus is +3 now; the
// override reads FLEE_THIEF_BONUS, so it cancels whatever the bonus is.
test("ablation: thiefFlee is a Thief-only dial override that exactly cancels the Thief flee bonus", () => {
  const a = parseAblation("thiefFlee");
  assert.equal(a.kind, "dial");
  assert.equal(a.cls, "Thief");
  assert.equal(dialOverridesFor(null, thief()), null);
  assert.equal(dialOverridesFor("thiefFlee", fighter()), null);
  assert.equal(dialOverridesFor("ability:feint", thief()), null);
  assert.deepEqual(dialOverridesFor("thiefFlee", thief()), { FLEE_NEED_MOD: FLEE_THIEF_BONUS });
  assert.equal(FLEE_THIEF_BONUS, 3);
  assert.equal(affectsRow({ cls: "Thief", sub: "Pilfer", startSkills: [], usage: {} }, "thiefFlee"), true);
  assert.equal(affectsRow({ cls: "Fighter", sub: "Knight", startSkills: [], usage: {} }, "thiefFlee"), false);
  // the override's lowest winning roll equals a no-bonus hero's, for every race
  for (const race of ["Human", "Elven", "Dwarven", "Troll"]) {
    const t = thief({ race, armor: "Leather" });
    const plain = fleeBreakdown(t);
    const noBonus = plain.need - (plain.bonus - FLEE_THIEF_BONUS);
    try {
      setDialsForTuning(dialOverridesFor("thiefFlee", t));
      const abl = fleeBreakdown(t);
      assert.equal(abl.need - abl.bonus, noBonus, race);
    } finally {
      setDialsForTuning({});
    }
    assert.deepEqual(fleeBreakdown(t), plain, "dials restored");
  }
});

test("ablation: playRun hands onStep the chosen action as a third argument", () => {
  const seen = [];
  playRun(1, { ...BOT_DEFAULTS, maxActions: 40, force: { cls: "Thief" } }, (events, state, action) => seen.push(action));
  assert.equal(seen.length, 40);
  for (const a of seen) assert.equal(typeof a.type, "string");
});

function fighter(over = {}) {
  return { cls: "Fighter", sub: "Knight", race: "Human", level: 1, wp: 40, maxWP: 40, skills: {}, timers: {}, abilities: [], ...over };
}
function thief(over = {}) {
  return { cls: "Thief", sub: "Pilfer", race: "Human", level: 1, wp: 40, maxWP: 40, skills: {}, timers: {}, abilities: [], ...over };
}
function fight(round = 1, extra = {}) {
  return { type: "Beasts", foes: [{ name: "f", alive: true, lvl: 1, wp: 20, maxWP: 20 }], round, target: 0, ...extra };
}

test("ablation: off by default — BOT_DEFAULTS has no ablate key and the Bot line does not mention it", () => {
  assert.equal(Object.prototype.hasOwnProperty.call(BOT_DEFAULTS, "ablate"), false);
  assert.equal(/ablat/i.test(botLine(BOT_DEFAULTS)), false);
  for (const off of [null, undefined, ""]) {
    assert.equal(parseAblation(off), null);
    assert.equal(abilityAblated(off, "kata"), false);
    const state = { c: fighter({ skills: { Hardiness: 1 } }), combat: fight() };
    assert.equal(applyStartAblation(state, off), false);
    assert.equal(applyStrikeAblation(state, { type: "attack" }, off), false);
    assert.deepEqual(state.c.skills, { Hardiness: 1 });
    assert.equal(state.combat.opened2, undefined);
    assert.equal(affectsRow({ cls: "Fighter", sub: "Knight", startSkills: ["Hardiness"], usage: { kata: 3 } }, off), false);
  }
});

test("ablation: parseAblation accepts the five kinds and refuses anything else", () => {
  assert.deepEqual(parseAblation("ability:kata"), { kind: "ability", key: "kata", cls: "Fighter", spec: "ability:kata" });
  assert.deepEqual(parseAblation("ability:feint"), { kind: "ability", key: "feint", cls: "Thief", spec: "ability:feint" });
  assert.deepEqual(parseAblation("skill:Heft"), { kind: "skill", key: "Heft", cls: "Thief", spec: "skill:Heft" });
  assert.deepEqual(parseAblation("skill:Hardiness"), { kind: "skill", key: "Hardiness", cls: "Fighter", spec: "skill:Hardiness" });
  assert.deepEqual(parseAblation("sub:Master of Arms"), { kind: "sub", key: "Master of Arms", cls: "Fighter", spec: "sub:Master of Arms" });
  assert.equal(parseAblation("thiefBackstab").kind, "strike");
  assert.equal(parseAblation("subOpener").kind, "strike");
  assert.equal(parseAblation("cutthroatCrit").kind, "strike");
  assert.equal(parseAblation("samuraiBlade").kind, "samuraiBlade");
  for (const bad of ["ability:nope", "skill:Kata", "skill:Nope", "sub:Wizard", "sub:Nope", "backstab", "ability", 7]) {
    assert.throws(() => parseAblation(bad), /ablation/);
  }
});

test("ablation: ability:<id> removes only that id from chooseAbility's choices", () => {
  const combat = fight(1);
  const state = { combat, c: fighter({ abilities: ["pommelStrike", "kata"] }), party: [] };
  assert.deepEqual(chooseAbility(state, makeBotContext()), { key: "pommelStrike" });
  // the opener is gone, so round 1 falls through to the damage ability
  assert.deepEqual(chooseAbility(state, makeBotContext({ ablate: "ability:pommelStrike" })), { key: "kata", target: 0 });
  // a pre-parsed record works the same
  assert.deepEqual(chooseAbility(state, makeBotContext({ ablate: parseAblation("ability:pommelStrike") })), { key: "kata", target: 0 });
  const onlyKata = { combat: fight(2), c: fighter({ abilities: ["kata"] }), party: [] };
  assert.equal(chooseAbility(onlyKata, makeBotContext({ ablate: "ability:kata" })), null);
  // an ablation of another kind never filters abilities
  assert.deepEqual(chooseAbility(onlyKata, makeBotContext({ ablate: "skill:Hardiness" })), { key: "kata", target: 0 });
  // ability:* removes the whole kit
  assert.deepEqual(parseAblation("ability:*"), { kind: "ability", key: "*", cls: null, spec: "ability:*" });
  assert.equal(chooseAbility(state, makeBotContext({ ablate: "ability:*" })), null);
  assert.equal(chooseAbility(onlyKata, makeBotContext({ ablate: "ability:*" })), null);
});

test("ablation: applyStartAblation writes only when the hero has the named skill/sub", () => {
  const s1 = { c: fighter({ skills: { Hardiness: 1, Cooking: 1 } }) };
  assert.equal(applyStartAblation(s1, "skill:Hardiness"), true);
  assert.deepEqual(s1.c.skills, { Cooking: 1 });
  assert.equal(applyStartAblation(s1, "skill:Hardiness"), false);

  const s2 = { c: thief({ sub: "Acrobat" }) };
  assert.equal(applyStartAblation(s2, "sub:Ninja"), false);
  assert.equal(s2.c.sub, "Acrobat");
  assert.equal(applyStartAblation(s2, "sub:Acrobat"), true);
  assert.equal(s2.c.sub, SUB_ABLATED);

  const s3 = { c: fighter({ sub: "Samurai", magicWpn: 2 }) };
  assert.equal(applyStartAblation(s3, "samuraiBlade"), true);
  assert.equal(s3.c.magicWpn, 0);
  const s4 = { c: fighter({ sub: "Knight", magicWpn: 2 }) };
  assert.equal(applyStartAblation(s4, "samuraiBlade"), false);
  assert.equal(s4.c.magicWpn, 2);

  // strike/ability kinds never write at run start
  const s5 = { c: thief({ skills: { Heft: 1 } }) };
  assert.equal(applyStartAblation(s5, "thiefBackstab"), false);
  assert.equal(applyStartAblation(s5, "ability:feint"), false);
  assert.deepEqual(s5.c.skills, { Heft: 1 });
});

test("ablation: applyStrikeAblation marks the per-fight flag only before a strike, only for the hero it names", () => {
  const t = { c: thief(), combat: fight() };
  assert.equal(applyStrikeAblation(t, { type: "flee" }, "thiefBackstab"), false);
  assert.equal(applyStrikeAblation(t, { type: "castSpell", idx: 0 }, "thiefBackstab"), false);
  assert.equal(t.combat.opened2, undefined);
  assert.equal(applyStrikeAblation(t, { type: "attack" }, "thiefBackstab"), true);
  assert.equal(t.combat.opened2, true);
  assert.equal(applyStrikeAblation(t, { type: "attack" }, "thiefBackstab"), false); // already set

  const u = { c: thief(), combat: fight() };
  assert.equal(applyStrikeAblation(u, { type: "useAbility", key: "feint" }, "thiefBackstab"), true);

  const con = { c: thief({ sub: "Con Artist" }), combat: fight() };
  assert.equal(applyStrikeAblation(con, { type: "attack" }, "thiefBackstab"), false);
  assert.equal(con.combat.opened2, undefined);

  const f = { c: fighter(), combat: fight() };
  assert.equal(applyStrikeAblation(f, { type: "attack" }, "thiefBackstab"), false);

  const noCombat = { c: thief(), combat: null };
  assert.equal(applyStrikeAblation(noCombat, { type: "attack" }, "thiefBackstab"), false);

  const ninja = { c: thief({ sub: "Ninja" }), combat: fight() };
  assert.equal(applyStrikeAblation(ninja, { type: "attack" }, "subOpener"), true);
  assert.equal(ninja.combat.opened, true);
  assert.equal(ninja.combat.opened2, undefined);
  const pilfer = { c: thief({ sub: "Pilfer" }), combat: fight() };
  assert.equal(applyStrikeAblation(pilfer, { type: "attack" }, "subOpener"), false);

  const cut = { c: thief({ sub: "Cutthroat" }), combat: fight() };
  assert.equal(applyStrikeAblation(cut, { type: "attack" }, "cutthroatCrit"), true);
  assert.equal(cut.combat.cut, true);
});

test("ablation: affectsRow flags exactly the baseline rows the ablation can touch", () => {
  const row = { cls: "Thief", sub: "Ninja", startSkills: ["Heft", "Locks"], usage: { feint: 2 }, refused: { mark: 1 } };
  assert.equal(affectsRow(row, "ability:feint"), true);
  assert.equal(affectsRow(row, "ability:mark"), true); // a refusal changes the bot's next step too
  assert.equal(affectsRow(row, "ability:smoke"), false);
  assert.equal(affectsRow(row, "ability:*"), true);
  assert.equal(affectsRow({ ...row, usage: {}, refused: {} }, "ability:*"), false);
  assert.equal(affectsRow({ ...row, usage: { feint: 0 }, refused: {} }, "ability:*"), false);
  assert.equal(affectsRow(row, "skill:Heft"), true);
  assert.equal(affectsRow(row, "skill:Night Vision"), false);
  assert.equal(affectsRow(row, "sub:Ninja"), true);
  assert.equal(affectsRow(row, "sub:Cloaker"), false);
  assert.equal(affectsRow(row, "subOpener"), true);
  assert.equal(affectsRow(row, "thiefBackstab"), true);
  assert.equal(affectsRow({ ...row, sub: "Con Artist" }, "thiefBackstab"), false);
  assert.equal(affectsRow(row, "cutthroatCrit"), false);
  assert.equal(affectsRow({ cls: "Fighter", sub: "Samurai", startSkills: [], usage: {} }, "samuraiBlade"), true);
});

test("ablation: an ablation that does not apply leaves a real run byte-identical; one that applies really writes", () => {
  const opts = { ...BOT_DEFAULTS, maxActions: 300, force: { cls: "Fighter", sub: "Knight" } };
  const base = playRun(1, opts);
  const inert = playRun(1, { ...opts, ablate: "sub:Ninja" });
  assert.equal(inert.actions, base.actions);
  assert.equal(inert.deathDepth, base.deathDepth);
  assert.deepEqual(inert.state, base.state);

  const renamed = playRun(1, { ...opts, maxActions: 1, ablate: "sub:Knight" });
  assert.equal(renamed.state.c.sub, SUB_ABLATED);
});
