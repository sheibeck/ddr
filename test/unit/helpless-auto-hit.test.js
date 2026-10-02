// test/unit/helpless-auto-hit.test.js
//
// Phase 92.3 plan 01, ruling 2 (user 2026-10-02): "When attacking an enemy that
// is frozen, stunned, sleeping, etc, should be an automatic hit with melee. If
// it can't move you can hit it." The hero's and a Joiner's melee hit a foe that
// skips its turn with no roll. Foes still roll against a held or sleeping hero.
//
// Pins: the one list of helpless conditions (derived.js#foeHelplessKind), the
// hero and Joiner strikes (a draw that would miss hits; the strike die is still
// drawn and ignored, so the draw count is the ordinary strike's; the damage is
// rolled as usual), the crit decision (the roll is skipped, so no natural crit,
// no roll-read bonus; the unconditional backstab stays), an untouchable foe
// stays untouchable, a foe that acts is rolled as before, the narration (Oracle
// and rail) and the foe card odds and chip text.

import test from "node:test";
import assert from "node:assert/strict";

import { playerStrike, alliesTurn, foeTurn } from "../../engine/combat.js";
import { foeHelplessKind, helplessAutoHit, heroAutoHitVs } from "../../engine/derived.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, narrativeLineText } from "../../src/browser/narrationLines.js";
import { FOE_CONDITION_DESC, foeConditionChips } from "../../src/browser/foeConditions.js";
import { foeConditionEffect, foeDetailsCard } from "../../src/browser/foeDetails.js";
import { heroHitOddsVs } from "../../src/browser/rollOdds.js";
import { SPELLS } from "../../content/index.js";

/** fakeRng(seq): `.d()` pops the next raw draw (raw 20 on a d20 is roll 1: a miss; raw 1 is the top face). */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function countingRng(inner) {
  let draws = 0;
  return { d(n) { draws++; return inner.d(n); }, pick(a) { return inner.pick(a); }, shuffle(a) { return inner.shuffle(a); }, get draws() { return draws; } };
}

function fighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
    might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0,
    ...overrides,
  };
}

function state(overrides = {}) {
  const { c, ...rest } = overrides;
  const g = [];
  for (let y = 0; y < 3; y++) { g.push([]); for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null }); }
  return {
    version: 1, seed: 1, rngState: 1, c: fighter(c), floor: { g, px: 1, py: 1, depth: 1 }, day: 1, steps: 0, combat: null,
    store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "", ...rest,
  };
}

function foe(overrides = {}) {
  // a deep copy: the hold records are shared table rows and foeTurn counts them down in place
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 60, maxWP: 60, alive: true, asleep: 0, sp: {}, lives: 1, ...structuredClone(overrides) };
}

function combat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const FILL = new Array(24).fill(20);

/** The helpless conditions, one foe each: [label, foe fields, the kind foeHelplessKind names]. */
const HELPLESS = [
  ["frozen (Freeze or Ice hold)", { held: { kind: "frozen", left: 2 } }, "frozen"],
  ["stunned (the Stun spell's hold)", { held: { kind: "stunned", left: 2 } }, "stunned"],
  ["stopped (Stop Time's hold)", { held: { kind: "time", left: 2 } }, "stopped"],
  ["asleep (Noxious Vapor, Insane, a staff, a song)", { asleep: 3 }, "asleep"],
  ["dozing (Doze)", { asleep: 3, dozing: true }, "dozing"],
  ["stunned (Pommel Strike's lost turn)", { stunned: true }, "stunned"],
];

// ─── the list of helpless conditions ─────────────────────────────────────

test("92.3 foeHelplessKind: exactly the conditions foeTurn skips a turn for", () => {
  for (const [label, fields, kind] of HELPLESS) assert.equal(foeHelplessKind(foe(fields)), kind, label);
  // a foe that acts is not helpless
  assert.equal(foeHelplessKind(foe()), null);
  assert.equal(foeHelplessKind(foe({ asleep: 0 })), null);
  assert.equal(foeHelplessKind(foe({ stunned: false })), null);
  assert.equal(foeHelplessKind(foe({ stupid: true, intel: 1 })), null, "Stupidity does not skip its turns");
  assert.equal(foeHelplessKind(foe({ blind: true })), null, "a blind foe still swings");
  assert.equal(foeHelplessKind(foe({ misdirect: { at: "friends", left: 2 } })), null, "a Senseless foe still takes its turn (at its own side)");
  assert.equal(foeHelplessKind(null), null);
});

test("92.3 foeHelplessKind agrees with foeTurn: every helpless foe skips its turn and draws nothing; an ordinary foe does not", () => {
  for (const [label, fields] of HELPLESS) {
    const s = state();
    const f = foe({ ...fields, sp: { atk: 1 } });
    s.combat = combat([f]);
    const events = [];
    const rng = countingRng(fakeRng([]));
    foeTurn(s, rng, events);
    assert.equal(rng.draws, 0, `${label}: a skipped turn draws nothing`);
    assert.ok(events.some((e) => ["foeStillHeld", "foeHoldBroken", "foeSlept", "foeStunned"].includes(e.type)), `${label}: foeTurn skipped it: ${events.map((e) => e.type)}`);
  }
});

test("92.3 helplessAutoHit: an untouchable foe (faces 0) is not hit automatically", () => {
  assert.equal(helplessAutoHit(foe({ asleep: 2 }), 5), "asleep");
  assert.equal(helplessAutoHit(foe({ asleep: 2 }), 0), null);
  assert.equal(helplessAutoHit(foe(), 5), null);
});

// ─── the hero's strike ───────────────────────────────────────────────────

test("92.3 hero: a draw that would miss hits every helpless foe automatically, with the ordinary draws and a rolled damage", () => {
  for (const [label, fields, kind] of HELPLESS) {
    // raw 20 = roll 1 on the d20: a miss against need 5 (a Soldier). Then the damage dice.
    const s = state();
    s.combat = combat([foe(fields)]);
    const rng = countingRng(fakeRng([20, 4, ...FILL]));
    const events = playerStrike(s, rng, []);
    const struck = events.find((e) => e.type === "struck");
    assert.ok(struck, `${label}: expected a hit on a draw that would miss`);
    assert.equal(struck.helpless, kind, label);
    assert.equal(struck.auto, true, label);
    assert.ok(struck.dmg > 0, `${label}: the damage is rolled as usual`);
    assert.ok(!events.some((e) => e.type === "strikeMissed"), `${label}: no miss`);
    assert.ok(!("mods" in struck), `${label}: no to-hit modifiers are claimed on a roll that was skipped`);
  }
});

test("92.3 hero: the same draw misses a foe that is not helpless (the rule is the condition, not the fixture)", () => {
  const s = state();
  s.combat = combat([foe()]);
  const events = playerStrike(s, fakeRng([20, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "strikeMissed"), "an ordinary foe is still rolled against");
  assert.ok(!events.some((e) => e.type === "struck"));
});

test("92.3 hero draw order: the strike die is still drawn (and ignored), so a helpless strike draws the same as an ordinary hit", () => {
  // an ordinary foe, a draw that hits (raw 3 = roll 18 against need 5): the draws are the strike die and then the damage.
  const sA = state();
  sA.combat = combat([foe()]);
  const rA = countingRng(fakeRng([3, 4, ...FILL]));
  const evA = playerStrike(sA, rA, []);
  assert.ok(evA.some((e) => e.type === "struck"));
  const sB = state();
  sB.combat = combat([foe({ asleep: 3 })]);
  const rB = countingRng(fakeRng([3, 4, ...FILL]));
  const evB = playerStrike(sB, rB, []);
  assert.ok(evB.some((e) => e.type === "struck" && e.helpless === "asleep"));
  // the die the strike drew is in the event even though the line does not print it
  assert.equal(evB.find((e) => e.type === "struck").roll, evA.find((e) => e.type === "struck").roll);
  // the strike drew its die and its damage exactly like the ordinary hit (the foe's turn after it differs: it slept)
  const strikeDraws = (events, rng) => rng.draws;
  assert.ok(strikeDraws(evB, rB) <= strikeDraws(evA, rA), "a sleeping foe's turn draws less, never more");
});

test("92.3 hero crit decision: a helpless foe is hit with no roll, so the natural top-face crit does not happen", () => {
  // raw 1 = roll 20: on a normal foe the top face of a Club crits.
  const normal = state({ c: { sub: "Knight" } });
  normal.combat = combat([foe()]);
  const evN = playerStrike(normal, fakeRng([1, 4, ...FILL]), []);
  assert.equal(evN.find((e) => e.type === "struck").critical, true, "control: the top face crits on a foe that acts");
  const sleeping = state({ c: { sub: "Knight" } });
  sleeping.combat = combat([foe({ asleep: 3 })]);
  const evS = playerStrike(sleeping, fakeRng([1, 4, ...FILL]), []);
  const struck = evS.find((e) => e.type === "struck");
  assert.equal(struck.helpless, "asleep");
  assert.equal(struck.critical, false, "the roll is skipped: no natural crit");
});

test("92.3 hero crit decision: the unconditional crits stay (a Thief's opening backstab on a sleeper)", () => {
  const s = state({ c: { cls: "Thief", sub: "Pickpocket" } });
  s.combat = combat([foe({ asleep: 3 })]);
  const events = playerStrike(s, fakeRng([20, 4, ...FILL]), []);
  const struck = events.find((e) => e.type === "struck");
  assert.ok(events.some((e) => e.type === "backstab"), "the opening backstab is not a roll");
  assert.equal(struck.critical, true);
  assert.equal(struck.helpless, "asleep");
});

test("92.3 hero: an untouchable foe (magic only) stays untouchable even asleep", () => {
  const s = state();
  s.combat = combat([foe({ asleep: 3, sp: { magicOnly: true } })]);
  const events = playerStrike(s, fakeRng([1, 4, ...FILL]), []);
  const missed = events.find((e) => e.type === "strikeMissed");
  assert.ok(missed && missed.untouchable === true, "a sleeping ghost still cannot be touched without a magic weapon");
  assert.ok(!events.some((e) => e.type === "struck"));
});

test("92.3 hero: a Doze wakes on the first hit, so the next blow is rolled again", () => {
  const s = state({ c: { sub: "Barbarian" } }); // two attacks a strike
  s.combat = combat([foe({ asleep: 3, dozing: true })]);
  // blow 1 (raw 20 would miss): hits automatically and wakes it; blow 2 (raw 20): rolled, misses
  const events = playerStrike(s, fakeRng([20, 4, 20, 4, ...FILL]), []);
  const struck = events.filter((e) => e.type === "struck");
  const missed = events.filter((e) => e.type === "strikeMissed");
  assert.equal(struck.length, 1);
  assert.equal(struck[0].helpless, "dozing");
  assert.equal(missed.length, 1, "the woken foe is rolled against like any other");
});

// ─── a Joiner's strike ───────────────────────────────────────────────────

function joinerState(foeFields, sub = "Soldier") {
  const sheet = {
    name: "Ada", cls: "Fighter", sub, race: "Human", level: 1, maxWP: 40, wp: 40, weapon: "Club", prof: 0,
    magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, skills: {}, potions: 0, items: [], abilities: [],
  };
  const s = state();
  s.party = [sheet];
  const f = foe(foeFields);
  s.combat = combat([f], { allies: [{ name: "Ada", partyIdx: 0, wp: 40, maxWP: 40, lvl: 1 }] });
  return s;
}

test("92.3 Joiner: a draw that would miss hits a helpless foe automatically; the same draw misses a foe that acts", () => {
  for (const [label, fields, kind] of HELPLESS) {
    const s = joinerState(fields);
    const events = alliesTurn(s, fakeRng([20, 4, ...FILL]), []);
    const struck = events.find((e) => e.type === "allyStruck");
    assert.ok(struck, `${label}: the Joiner hits`);
    assert.equal(struck.helpless, kind, label);
    assert.equal(struck.auto, true, label);
  }
  const s = joinerState({});
  const events = alliesTurn(s, fakeRng([20, 4, ...FILL]), []);
  assert.ok(events.some((e) => e.type === "allyMissed"), "an ordinary foe is still rolled against");
});

test("92.3 Joiner crit decision: the natural top-face crit does not happen on a helpless foe", () => {
  const normal = joinerState({}, "Knight");
  const evN = alliesTurn(normal, fakeRng([1, 4, ...FILL]), []);
  assert.equal(evN.find((e) => e.type === "allyStruck").crit, true, "control: a Joiner's top face crits on a foe that acts");
  const sleeping = joinerState({ asleep: 3 }, "Knight");
  const evS = alliesTurn(sleeping, fakeRng([1, 4, ...FILL]), []);
  const struck = evS.find((e) => e.type === "allyStruck");
  assert.equal(struck.helpless, "asleep");
  assert.ok(!struck.crit, "no natural crit with the roll skipped");
});

// ─── foes still roll against a helpless hero ─────────────────────────────

test("92.3 the foe's side is unchanged: a foe still rolls to hit a hero who is out", () => {
  const s = state();
  const f = foe({ sp: { atk: 1 } });
  s.combat = combat([f]);
  const rng = countingRng(fakeRng([20, 20, ...FILL]));
  foeTurn(s, rng, []);
  assert.ok(rng.draws >= 1, "an ordinary foe's swing draws its to-hit die (the rule this ruling leaves alone)");
});

// ─── narration, rail and the foe card ────────────────────────────────────

test("92.3 narration: struck and allyStruck say the foe cannot dodge, in the Oracle and on the rail; other lines are unchanged", () => {
  const plain = { type: "struck", target: "Viper", roll: 12, atLeast: 16, dieN: 20, dmg: 6, critical: false };
  const helpless = { ...plain, helpless: "asleep", auto: true };
  assert.ok(!/cannot dodge/.test(EVENT_NARRATION.struck(plain)));
  assert.ok(!/cannot dodge/.test(LINE_FOR.struck(plain).text));
  const oracle = EVENT_NARRATION.struck(helpless);
  assert.match(oracle, /Viper cannot dodge\./);
  assert.match(oracle, /You hit Viper for <span class="roll">6<\/span> hp\./);
  assert.ok(!/vs/.test(oracle), "no to-hit range is printed for a roll that was skipped");
  const rail = LINE_FOR.struck(helpless).text;
  assert.equal(rail, "You hit Viper (6, it cannot dodge)");
  assert.equal(narrativeLineText(oracle), "Viper cannot dodge. You hit Viper for hp.");

  const ally = { type: "allyStruck", name: "Ada", target: "Viper", dmg: 5, weapon: "Club" };
  assert.ok(!/cannot dodge/.test(EVENT_NARRATION.allyStruck(ally)));
  assert.match(EVENT_NARRATION.allyStruck({ ...ally, helpless: "frozen" }), /Viper cannot dodge\./);
  assert.equal(LINE_FOR.allyStruck({ ...ally, helpless: "frozen" }).text, "Ada lands a hit on Viper (5, it cannot dodge).");
  assert.equal(LINE_FOR.allyStruck(ally).text, "Ada lands a hit on Viper (5).");
});

test("92.3 the foe card: a helpless foe reads 'You hit it automatically' (odds line and chip), never a range", () => {
  for (const [label, fields] of HELPLESS) {
    const s = state();
    s.combat = combat([foe({ ...fields, name: "Target" })]);
    const f = s.combat.foes[0];
    assert.ok(heroAutoHitVs(s, f), `${label}: the display twin of the engine rule`);
    assert.ok(heroHitOddsVs(s, f).auto, label);
    const card = foeDetailsCard(0, s);
    const text = card.lines.map((l) => l.text).join("\n");
    assert.match(text, /You hit it automatically/, `${label}: odds line: ${text}`);
    const chips = foeConditionChips(f, s);
    assert.ok(chips.length >= 1, label);
    for (const chip of chips) assert.match(foeConditionEffect(chip, f, s) ?? "", /you hit it automatically/, `${label}: ${chip.text}`);
  }
  const s = state();
  s.combat = combat([foe()]);
  assert.ok(!/automatically/.test(foeDetailsCard(0, s).lines.map((l) => l.text).join("\n")), "a foe that acts keeps its range");
});

test("92.3 chip text and spell text state the rule", () => {
  for (const key of ["stunned", "asleep", "dozing", "held", "stopped"]) {
    assert.match(FOE_CONDITION_DESC[key], /melee blows, and your Joiners', hit it automatically/, key);
  }
  const stopTime = SPELLS.find((sp) => sp.n === "Stop Time");
  assert.match(stopTime.txt, /your melee blows, and your Joiners', hit it automatically/);
  assert.ok(!/top five numbers/.test(stopTime.txt), "the old five-numbers floor is gone from the text");
});
