// test/unit/identity-rulings.test.js
//
// Phase 91 plan 09: one pin per checkpoint ruling and per "fix engine (91-09)"
// audit row that plan 91-09 builds (docs/IDENTITY-AUDIT.md). Titles read
// "<identity> <trait>: <ruled behaviour> (Qn or audit row)" so the audit's
// "Pinned by" column can cite them.
//
//   - race-heal2x (Q4 A): every healing potion a Wilmsry drinks heals double.
//   - unstated:cleric-scroll (Q3 B): a scroll that rolls an offense spell still
//     free-casts for a Cleric (RULES-10); the ban is the Cleric's own book.
//   - Q2 A: no Cleric hit-point rule (the engine is unchanged; pinned).
//   - the orchestrator's parley amendment (user 2026-10-01): a won parley's
//     experience splits with Joiners exactly as a kill's does.
// The Fridgian frenzy and hide (race-frenzy, race-hide) are pinned in
// test/unit/fridgian-frenzy.test.js and test/unit/joiner-armour-soak.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { makeRng } from "../../engine/rng.js";
import { newRun } from "../../engine/engine.js";
import { useItem, memberDrinkPotion } from "../../engine/items.js";
import { drinkPotion, readScroll } from "../../engine/magic.js";
import { parley, killFoe, partyXpShares } from "../../engine/combat.js";
import { SPELLS } from "../../content/index.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { heroState, foeFrom, inCombat, withMember } from "./harness/rollOdds.js";

setIdentityDials();

/** A scripted rng: `seq` raw draws in order (`d`), then 1s; `pick` takes a chooser. */
function scripted(seq = [], pick = (a) => a[0]) {
  let i = 0;
  const draws = [];
  return {
    d(n) {
      draws.push(n);
      const v = i < seq.length ? seq[i] : 1;
      i++;
      return Math.min(n, Math.max(1, v));
    },
    pick,
    shuffle: (a) => a,
    getState: () => 1,
    draws,
  };
}

const healingPotion = () => ({ kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 });
const xtraPotion = () => ({ kind: "potion", n: "Xtra Healing potion", txt: "heal to maximum", eff2: "full", uses: 1 });

function hurt(race, wp = 1, maxWP = 200) {
  const state = heroState({ cls: "Fighter", sub: "Soldier", race });
  state.c.maxWP = maxWP;
  state.c.wp = wp;
  state.c.items = [];
  return state;
}

// ─── race-heal2x (Q4 A) ──────────────────────────────────────────────────

test("Wilmsry race-heal2x: a found Healing potion heals double (Q4 A), the same one die drawn", () => {
  const roll = 5; // d10 + 2 = 7
  const human = hurt("Human");
  human.c.items.push(healingPotion());
  const hRng = scripted([roll]);
  const hEvents = useItem(human, 0, hRng, []);
  assert.equal(human.c.wp, 1 + 7, "a Human is healed d10 + 2");
  assert.equal(hEvents.find((e) => e.type === "healed").doubled, undefined);

  const wilmsry = hurt("Wilmsry");
  wilmsry.c.items.push(healingPotion());
  const wRng = scripted([roll]);
  const wEvents = useItem(wilmsry, 0, wRng, []);
  assert.equal(wilmsry.c.wp, 1 + 14, "a Wilmsry is healed twice that");
  const healed = wEvents.find((e) => e.type === "healed");
  assert.equal(healed.amount, 14);
  assert.equal(healed.doubled, "Wilmsry");
  assert.deepEqual(wRng.draws, hRng.draws, "no new roll: the die count and sizes match a Human's");
});

test("Wilmsry race-heal2x: the stock potion still doubles, and every other race's potions are untouched (Q4 A)", () => {
  const w = hurt("Wilmsry");
  w.c.potions = 1;
  drinkPotion(w, scripted([5]), []);
  assert.equal(w.c.wp, 1 + (2 * 5 + 5) * 2);
  for (const race of ["Human", "Elven", "Dwarven", "Fridgian", "Troll"]) {
    const s = hurt(race);
    s.c.items.push(healingPotion());
    useItem(s, 0, scripted([5]), []);
    assert.equal(s.c.wp, 1 + 7, `${race}: a found Healing potion is not doubled`);
  }
});

test("Wilmsry race-heal2x (edge): Xtra Healing restores to the maximum for a Wilmsry too, a doubled heal clamps at max and says how much it gained", () => {
  const w = hurt("Wilmsry");
  w.c.items.push(xtraPotion());
  const events = useItem(w, 0, scripted([]), []);
  assert.equal(w.c.wp, w.c.maxWP);
  assert.equal(events.find((e) => e.type === "healed").doubled, undefined, "a full heal cannot be doubled past full");

  const nearFull = hurt("Wilmsry", 195);
  nearFull.c.items.push(healingPotion());
  const e2 = useItem(nearFull, 0, scripted([10]), []);
  assert.equal(nearFull.c.wp, 200, "12 doubled to 24 still stops at the maximum");
  assert.equal(e2.find((e) => e.type === "healed").gained, 5);
});

test("Wilmsry race-heal2x: a Joiner Wilmsry's own potion doubles too (already built, pinned for the audit row)", () => {
  const state = hurt("Human");
  const idx = withMember(state, { cls: "Fighter", sub: "Soldier", race: "Wilmsry" });
  state.party[idx].potions = 1;
  state.party[idx].maxWP = 200;
  state.party[idx].wp = 1;
  const events = memberDrinkPotion(state, idx, makeRng(1), []);
  const drunk = events.find((e) => e.type === "memberPotionDrunk");
  assert.equal(drunk.doubled, "Wilmsry");
  assert.ok(drunk.amount % 2 === 0 && drunk.amount >= 14, `2d10+5 doubled is even and at least 14, got ${drunk.amount}`);
});

test("Wilmsry race-heal2x (narration): the doubled Healing potion says so on the Oracle and on the rail", () => {
  const e = { type: "healed", amount: 14, gained: 14, doubled: "Wilmsry" };
  assert.match(EVENT_NARRATION.healed(e), /Wilmsry: twice the dose/);
  assert.match(LINE_FOR.healed(e).text, /Wilmsry/);
  const plain = { type: "healed", amount: 7, gained: 7 };
  assert.doesNotMatch(EVENT_NARRATION.healed(plain), /twice the dose/);
  assert.doesNotMatch(LINE_FOR.healed(plain).text, /Wilmsry/);
});

// ─── unstated:cleric-scroll (Q3 B) ───────────────────────────────────────

test("Cleric unstated:cleric-scroll: a scroll that rolls a damage spell still free-casts for a Cleric in a fight, never copied (Q3 B)", () => {
  const state = heroState({ cls: "Magic User", sub: "Cleric", race: "Human" });
  state.c.level = 5;
  const foe = foeFrom("Humans", 1, "Ned", { wp: 999 });
  inCombat(state, [foe]);
  state.c.scrolls = 1;
  const book = [...state.c.grimoire];
  const freeze = SPELLS.find((sp) => sp.n === "Freeze");
  assert.equal(freeze.s, "offense");
  // raw 1s hit on the best face; the Cleric's own book can neither learn nor cast Freeze
  const events = readScroll(state, scripted([], (a) => a.find((sp) => sp.n === "Freeze")), []);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.spell === "Freeze"), JSON.stringify(events.map((e) => e.type)));
  assert.ok(events.some((e) => e.type === "scrollCast" && e.spell === "Freeze"), "the free cast fired");
  assert.equal(events.some((e) => e.type === "scrollCopiedToGrimoire"), false, "the book never copies it");
  assert.equal(events.some((e) => e.type === "spellSchoolLocked"), false, "the scroll path is not school-locked");
  assert.ok(events.some((e) => e.type === "spellThrown" && e.spell === "Freeze"), "the spell was thrown at the foe");
  assert.ok(foe.wp < 999, `the foe took the spell: ${JSON.stringify(events.map((e) => e.type))}`);
  assert.deepEqual(state.c.grimoire, book);
});

test("Cleric unstated:cleric-scroll (edge, adjacency): any other reader's scroll is unchanged; a Wizard's scroll of Freeze also fires", () => {
  const state = heroState({ cls: "Magic User", sub: "Wizard", race: "Human" });
  state.c.level = 5;
  inCombat(state, [foeFrom("Humans", 1, "Ned", { wp: 999 })]);
  state.c.scrolls = 1;
  const events = readScroll(state, scripted([], (a) => a.find((sp) => sp.n === "Freeze")), []);
  assert.ok(events.some((e) => e.type === "scrollRead" && e.spell === "Freeze"));
});

// ─── Q2 A: no Cleric hit-point rule ──────────────────────────────────────

test("Cleric unstated:cleric-mail: Q2 A builds no Cleric hit-point rule, a Cleric rolls the hit points any Magic User of its race rolls", () => {
  // The user ruled A (2026-09-30): the blurb states the chain mail and the +1 to hit; no HP rule.
  // Same seed and race, a Cleric against a Sorcerer: the class dice (not the sub) set the starting HP.
  for (let seed = 1; seed <= 200; seed++) {
    const cleric = newRun(seed, [], { force: { cls: "Magic User", sub: "Cleric", race: "Human" } }).c;
    const sorcerer = newRun(seed, [], { force: { cls: "Magic User", sub: "Sorcerer", race: "Human" } }).c;
    assert.equal(cleric.maxWP, sorcerer.maxWP, `seed ${seed}: a Cleric's starting hit points equal a Sorcerer's`);
  }
});

// ─── the parley amendment: experience splits like a kill's ───────────────

function partyFight(withJoiner) {
  // An Elf may always parley a Humans foe (the Human Fighter cannot talk to one at fluency 0).
  const state = heroState({ cls: "Fighter", sub: "Soldier", race: "Elven" });
  state.c.items = [];
  const foe = { ...foeFrom("Humans", 1, "Ned", { wp: 5 }), lvl: 4 };
  const extra = {};
  if (withJoiner) {
    const idx = withMember(state, { cls: "Fighter", sub: "Soldier", race: "Human" });
    extra.allies = [{ partyIdx: idx, name: state.party[idx].name, lvl: 1, sub: "Soldier", wp: 20, maxWP: 20 }];
  }
  inCombat(state, [foe], extra);
  return { state, foe };
}

/** The sp a hero gains from the first `spGained` or `foeKilled` event. */
const spOf = (events) => {
  const e = events.find((x) => x.type === "spGained" || x.type === "foeKilled");
  return e.type === "spGained" ? e.amount : e.spGained;
};

// d20 raw 1 (a roll of 20, a sure win), d6 raw 4 for the experience, then 1s.
const PARLEY_DRAWS = [1, 4, 1, 1];

test("Joiner parley-xp: a solo hero's won parley pays exactly what it paid before (one share)", () => {
  const { state, foe } = partyFight(false);
  assert.equal(partyXpShares(state), 1);
  const events = parley(state, scripted(PARLEY_DRAWS), []);
  assert.ok(events.some((e) => e.type === "parleyWon"));
  // killSpFor = d6 4 x level 4 x 5 = 80, whole.
  assert.equal(spOf(events), 80);
  const kill = partyFight(false);
  const killEvents = killFoe(kill.state, kill.foe, scripted([4]), []);
  assert.equal(spOf(killEvents), 80, "the kill pays the same");
});

test("Joiner parley-xp: with a live Joiner the hero's parley share is the kill's share (the award split two ways)", () => {
  const { state } = partyFight(true);
  assert.equal(partyXpShares(state), 2);
  const events = parley(state, scripted(PARLEY_DRAWS), []);
  assert.ok(events.some((e) => e.type === "parleyWon"));
  assert.equal(spOf(events), 40, "80 split between the hero and one Joiner");
  const kill = partyFight(true);
  const killEvents = killFoe(kill.state, kill.foe, scripted([4]), []);
  assert.equal(spOf(killEvents), 40, "a kill splits it the same way");
  assert.equal(events.find((e) => e.type === "parleyWon").sp, 40, "parleyWon states the hero's share");
});

test("Joiner parley-xp (edge, empty): a downed Joiner takes no share, and the draws of a parley are the same with or without a Joiner", () => {
  const { state } = partyFight(true);
  state.combat.allies[0].wp = 0;
  assert.equal(partyXpShares(state), 1, "a Joiner at 0 hp is not a share");
  const solo = partyFight(false);
  const withJoiner = partyFight(true);
  const rngA = scripted(PARLEY_DRAWS);
  const rngB = scripted(PARLEY_DRAWS);
  parley(solo.state, rngA, []);
  parley(withJoiner.state, rngB, []);
  assert.deepEqual(rngA.draws, rngB.draws, "the split is arithmetic after the draws: none moved");
});
