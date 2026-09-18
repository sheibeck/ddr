// test/unit/casters-can-act.test.js
//
// Phase 23 (IDENT-01/IDENT-03/IDENT-04) — direct unit coverage proving no
// Magic User sub-class can be dealt a character that cannot act:
//
//   IDENT-01: a Wizard refuses to melee ONLY while a spell charge remains
//   AND an attack-kind spell is castable right now (engine/combat.js's
//   playerStrike, via engine/derived.js's castableAttackSpells). A Wizard
//   holding only utility spells, or one who has spent every attack spell
//   for the day, fights with the staff; the refusal (when it fires) names
//   the spell to cast instead.
//
//   IDENT-03/IDENT-04: a level-1 Summoner can cast Summon (doubled formula,
//   backfire kept) and a level-1 Illusionist can raise an UNdoubled Phantom
//   Host, via Plan 01's SPELL_LEVEL_OVERRIDES table — with every other bad
//   (the Illusionist's d20 strike die until level 3, Mirror Self) intact.
//
// Helpers mirror test/unit/combat.test.js / test/unit/magic.test.js's
// established fakeRng/fixed* pattern verbatim.

import test from "node:test";
import assert from "node:assert/strict";

import { playerStrike } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { strikeDie, canCast, castableAttackSpells } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { SPELLS, STRIKE_DICE, SUB_NOTE } from "../../content/index.js";

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const spellByName = (n) => SPELLS.find((sp) => sp.n === n);

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; `.pick(arr)` returns `arr[0]` unless a picker is
 * supplied. Throws if the sequence underflows (ports test/unit/combat.test.js's
 * helper verbatim). */
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

function fixedCaster(overrides = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0,
    maxWP: 31, wp: 31, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Cloth", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 4, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Caster",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
    ...overrides,
  };
}

/** A tiny fully-lit 3x3 open floor, sufficient for inDark(state) reads. */
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
    c: fixedCaster(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
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

// A one-hit-kill foe + the standard playerStrike->killFoe rng sequence this
// suite reuses across every "the Wizard/Sorcerer swings normally" test:
// strike roll=1 (hit, need=3), club d6=3 (weaponDamage base), killFoe's own
// draws (sp d6=4, coin d10=5, treasure-check d20=20 skips, cooking-fallback
// d6=1 skips since <4) — identical shape to test/unit/combat.test.js's own
// "a hit applies weaponDamage..." test, generalized to any Magic User sub
// (cls "Magic User" never enters the Thief-only backstab/heavy-armor
// branches, so the sequence is sub-agnostic).
const KILL_SEQUENCE = [1, 3, 4, 5, 20, 1];
const lethalFoe = () => fixedFoe({ wp: 1, maxWP: 1 });

// --- IDENT-01: Wizard melee rule --------------------------------------

test("IDENT-01: a Wizard with a utility-only grimoire fights with the staff", () => {
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Heal", "Shield", "Map the Floor"], spellsUsed: 0 } });
  state.combat = fixedCombat([lethalFoe()]);
  const events = playerStrike(state, fakeRng(KILL_SEQUENCE), []);
  assert.equal(events.some((e) => e.type === "strikeRefused"), false, "no attack spell in the book -> no refusal");
  assert.ok(events.some((e) => e.type === "struck"), "the Wizard still swings");
});

test("IDENT-01: a Wizard who has spent every attack spell for the day fights with the staff", () => {
  const charges = maxCharges({ level: 1, items: [] });
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Freeze", "Doze"], spellsUsed: charges } });
  state.combat = fixedCombat([lethalFoe()]);
  const events = playerStrike(state, fakeRng(KILL_SEQUENCE), []);
  assert.equal(events.some((e) => e.type === "strikeRefused"), false, "every attack spell is spent -> no refusal");
  assert.ok(events.some((e) => e.type === "struck"));
});

test("IDENT-01: a Wizard at zero remaining charges (no items) fights with the staff", () => {
  // Same shape as the "spent" test above, phrased from the probe's "zero
  // charges" angle (CONTEXT's FLAGGED PLANNER ASSUMPTION wording) — kept as
  // its own test per the plan's explicit instruction.
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Freeze", "Doze"], spellsUsed: 4, items: [] } });
  state.combat = fixedCombat([lethalFoe()]);
  const events = playerStrike(state, fakeRng(KILL_SEQUENCE), []);
  assert.equal(events.some((e) => e.type === "strikeRefused"), false);
  assert.ok(events.some((e) => e.type === "struck"));
});

test("IDENT-01: the refusal names the spell to cast (SPELLS order: Doze precedes Freeze)", () => {
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Heal", "Doze", "Freeze"], spellsUsed: 0 } });
  state.combat = fixedCombat([fixedFoe({ wp: 10 })]);
  // fakeRng([]) throws on any draw — proving the refusal path draws zero rng.
  const events = playerStrike(state, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "strikeRefused", reason: "wizard", spell: "Doze" }]);
});

test("IDENT-01: a level-locked attack spell (Fireball, lvl 3) does not count as castable at level 1", () => {
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Fireball"], spellsUsed: 0 } });
  state.combat = fixedCombat([lethalFoe()]);
  const events = playerStrike(state, fakeRng(KILL_SEQUENCE), []);
  assert.equal(events.some((e) => e.type === "strikeRefused"), false, "Fireball is not legal yet -> no refusal");
  assert.ok(events.some((e) => e.type === "struck"));
});

test("IDENT-01: a school-locked attack spell does not count as castable (Summoner's offense gates at level 3)", () => {
  const summonerState = fixedState({ c: { sub: "Summoner", level: 1, grimoire: ["Stun"] } });
  assert.deepStrictEqual(castableAttackSpells(summonerState), [], "Summoner offense is gated to level 3");
  assert.equal(canCast(summonerState, spellByName("Stun")), false);

  const wizardState = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Stun"], spellsUsed: 0 } });
  wizardState.combat = fixedCombat([fixedFoe({ wp: 10 })]);
  const events = playerStrike(wizardState, fakeRng([]), []);
  assert.deepStrictEqual(events, [{ type: "strikeRefused", reason: "wizard", spell: "Stun" }]);
});

test("IDENT-01: a non-Wizard caster never refuses, even holding an attack spell with charges left", () => {
  const state = fixedState({ c: { sub: "Sorcerer", level: 1, grimoire: ["Freeze"], spellsUsed: 0 } });
  state.combat = fixedCombat([lethalFoe()]);
  const events = playerStrike(state, fakeRng(KILL_SEQUENCE), []);
  assert.equal(events.some((e) => e.type === "strikeRefused"), false);
  assert.ok(events.some((e) => e.type === "struck"));
});

// --- IDENT-03: Summoner at level 1, unchanged formula -------------------

test("IDENT-03: a level-1 Summoner summons in combat with the unchanged doubled formula", () => {
  const state = fixedState({ c: { sub: "Summoner", level: 1, grimoire: ["Summon"] } });
  const combat = fixedCombat([]); // empty foe list: afterPlayerAction clears the encounter with 0 extra draws
  state.combat = combat;
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([2, 3]), []); // d8=2 (no backfire), d4=3 (rounds)
  assert.ok(events.some((e) => e.type === "allySummoned" && e.lvl === 2 && e.rounds === 8), "lvl min(5,1+1)=2, rounds 2*3+2=8");
  assert.equal(combat.ally.lvl, 2);
  assert.equal(combat.ally.rounds, 8);
  assert.equal(state.c.spellsUsed, 1);
});

test("IDENT-03: out of combat, Summon queues a pendingAlly with the same doubled formula", () => {
  const state = fixedState({ c: { sub: "Summoner", level: 1, grimoire: ["Summon"] }, combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([5, 1]), []); // d8=5 (no backfire), d4=1 (rounds)
  assert.ok(state.c.pendingAlly, "queued for the next encounter");
  assert.equal(state.c.pendingAlly.lvl, 2);
  assert.equal(state.c.pendingAlly.rounds, 4, "2*1+2");
  assert.ok(events.some((e) => e.type === "allyPending"));
});

test("IDENT-03: the Summoner's one-in-eight backfire is kept", () => {
  const state = fixedState({ c: { sub: "Summoner", level: 1, grimoire: ["Summon"], wp: 50, maxWP: 50 }, combat: null });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([1, 4]), []); // d8=1 -> backfire, d6=4
  assert.ok(events.some((e) => e.type === "summonBackfired" && e.amount === 8), "lvl^2(2*2=4) + d6(4) = 8");
  assert.equal(state.c.wp, 42, "50 - 8");
  assert.equal(state.c.pendingAlly, undefined, "no ally on a backfire");
});

test("IDENT-03: before the override, a level-1 Wizard casting Summon is still refused (Summoner-only)", () => {
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Summon"] } });
  const events = castSpell(state, SPELL_IDX.Summon, fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "spellAboveLevel" && e.need === 2 && e.have === 1));
  assert.equal(state.c.spellsUsed, 0);
});

// --- IDENT-04: Illusionist at level 1 — FLAGGED PLANNER ASSUMPTION ------

test("IDENT-04: a level-1 Illusionist raises an UNdoubled Phantom Host (no backfire draw)", () => {
  const state = fixedState({ c: { sub: "Illusionist", level: 1, grimoire: ["Phantom Host"] } });
  const combat = fixedCombat([]);
  state.combat = combat;
  // A single fakeRng value, consumed by the d4 rounds roll, proves the
  // `doubled && rng.d(8) === 1` backfire check short-circuits on `doubled`
  // (false for an Illusionist) WITHOUT drawing — a fakeRng underflow would
  // throw if an extra d8 were rolled.
  const events = castSpell(state, SPELL_IDX["Phantom Host"], fakeRng([3]), []);
  const allyEvents = events.filter((e) => e.type === "allySummoned");
  assert.equal(allyEvents.length, 1, "exactly one ally event — no backfire branch taken");
  assert.equal(allyEvents[0].lvl, 1, "min(5, level) — NOT doubled");
  assert.equal(allyEvents[0].rounds, 5, "1*d4(3)+2, not the Summoner's 2*d4+2");
  assert.equal(events.some((e) => e.type === "summonBackfired"), false);
  assert.equal(combat.ally.rounds, 5);
});

test("IDENT-04: a non-Illusionist at level 1 (Wizard with Phantom Host) is still refused", () => {
  const state = fixedState({ c: { sub: "Wizard", level: 1, grimoire: ["Phantom Host"] } });
  const events = castSpell(state, SPELL_IDX["Phantom Host"], fakeRng([]), []);
  assert.ok(events.some((e) => e.type === "spellAboveLevel" && e.need === 3 && e.have === 1));
  assert.equal(state.c.spellsUsed, 0);
});

test("IDENT-04: strikeDie is unchanged — d20 for the Illusionist through level 2, d10 at level 3", () => {
  assert.equal(strikeDie({ level: 1, race: "Human", sub: "Illusionist", acute: 0 }), STRIKE_DICE[0]);
  assert.equal(strikeDie({ level: 2, race: "Human", sub: "Illusionist", acute: 0 }), STRIKE_DICE[0], "the Illusionist bad is the level-2 stall");
  assert.equal(strikeDie({ level: 3, race: "Human", sub: "Illusionist", acute: 0 }), STRIKE_DICE[2]);
  assert.equal(strikeDie({ level: 1, race: "Human", sub: "Wizard", acute: 0 }), STRIKE_DICE[0]);
});

test("IDENT-04: Mirror Self is unchanged", () => {
  const state = fixedState({ c: { sub: "Illusionist", level: 1, grimoire: ["Mirror Self"] }, combat: null });
  const events = castSpell(state, SPELL_IDX["Mirror Self"], fakeRng([4]), []);
  assert.ok(state.c.mirror > 0, "c.mirror is set");
  assert.ok(events.some((e) => e.type === "mirrorSelf"), "a mirror-family event fires");
});

// --- Voice: the three SUB_NOTE blurbs Task 3 lands ----------------------

test("SUB_NOTE: Wizard/Summoner/Illusionist describe the landed rules (guards Task 3's flavor edit)", () => {
  assert.match(SUB_NOTE.Wizard, /staff/i);
  assert.match(SUB_NOTE.Wizard, /attack spell/i);
  assert.match(SUB_NOTE.Summoner, /(first day|day one)/i);
  assert.match(SUB_NOTE.Illusionist, /Phantom Host/);
  assert.match(SUB_NOTE.Illusionist, /d20/);
});
