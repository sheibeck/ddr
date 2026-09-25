// test/unit/skeleton-shatter.test.js
//
// Phase 72-06 (ROLL-01 (c), user ruling 2026-09-24): "Rolling max on your
// dice triggers the shatter." Any to-hit roll aimed at a shatter-flagged foe
// (sp.shatterOnBest, the Skeleton) that shows its die's best face (a natural
// 1 in today's roll-under engine) destroys it outright, both lives — see
// docs/ROLL-LEDGER.md `## Skeleton shatter scope` for exactly which
// strikers count and why. Covers engine/dice.js#isBestFace,
// engine/combat.js#shatterIfBest, and every call site in scope: hero
// strikes (auto-hit openers included), party-member strikes, legacy and
// summoned ally strikes, and hero/member thrown attack spells. The Con
// Artist's no-injury opener is the one exception.

import test from "node:test";
import assert from "node:assert/strict";

import { isBestFace } from "../../engine/dice.js";
import { playerStrike, alliesTurn, allyTurn, killFoe } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { SPELLS } from "../../content/index.js";
import { heroState, foeFrom, inCombat, withMember, faceOdds, probeRng } from "./harness/rollOdds.js";

// Same shape as rollDirection.test.js's own withClub — a plain weapon, no
// castable-spell melee refusal, no chargen-random skill contamination.
function withClub(state) {
  state.c.weapon = "Club";
  state.c.magicWpn = 0;
  state.c.prof = 0;
  state.c.spellsUsed = 999;
  state.c.skills = {};
  return state;
}

function skeletonFoe(wp = 60) {
  return foeFrom("Walking Dead", 2, "Skeleton", { wp });
}

/** alwaysOneRng() — a deterministic rng that always returns the minimum face
 * (1) for every draw, on any die size, and records every `sides` argument it
 * was called with (in call order) on `.draws`. Used for exact draw-sequence
 * comparisons (the "zero extra draws on a shatter" behaviour). */
function alwaysOneRng() {
  const draws = [];
  return {
    d(sides) {
      draws.push(sides);
      return 1;
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
    getState: () => 1,
    draws,
  };
}

test("isBestFace(roll, dieN) — today's roll-under reading: a natural 1", () => {
  assert.equal(isBestFace(1, 20), true);
  assert.equal(isBestFace(2, 20), false);
  assert.equal(isBestFace(20, 20), false);
  assert.equal(isBestFace(1, 6), true);
  assert.equal(isBestFace(6, 6), false);
});

// --- Hero strike ------------------------------------------------------------

test("[skeleton-shatter] a hero strike on its best face shatters a full-HP Skeleton outright, both lives, on exactly one face", () => {
  const build = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      playerStrike(s, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:hero-strike" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton in one strike");
});

test("[skeleton-shatter] on the shattering face: foeShattered fires, then foeKilled, never foeRevived or struck", () => {
  const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const foe = s.combat.foes[0];
  const rng = probeRng({ face: 1 });
  const events = [];
  playerStrike(s, rng, events);
  assert.equal(foe.alive, false);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("foeShattered"), `expected foeShattered, got: ${types.join(", ")}`);
  assert.ok(types.includes("foeKilled"), `expected foeKilled, got: ${types.join(", ")}`);
  assert.equal(types.includes("foeRevived"), false, "a shatter must not revive the Skeleton's second life");
  assert.equal(types.includes("struck"), false, "a shatter skips the ordinary struck event entirely");
  const shattered = events.find((e) => e.type === "foeShattered");
  assert.equal(shattered.target, "Skeleton");
  assert.equal(shattered.by, "you");
});

test("[skeleton-shatter] every other landing face damages the Skeleton normally — no shatter", () => {
  const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const foe = s.combat.foes[0];
  // The Skeleton's own sp.toHit:4 caps the hero's need at 4, so face 2 still
  // lands an ordinary hit (a landing, non-best face).
  const rng = probeRng({ face: 2 });
  const events = [];
  playerStrike(s, rng, events);
  const types = events.map((e) => e.type);
  assert.equal(types.includes("foeShattered"), false, "a non-best landing face must not shatter");
  assert.ok(types.includes("struck"), `expected an ordinary struck event, got: ${types.join(", ")}`);
  assert.equal(foe.alive, true, "one ordinary hit on a 60-wp Skeleton must not kill it outright");
});

test("[skeleton-shatter] an ordinary (non-shatter) killing blow still triggers foeRevived first — the kill-twice rule is intact", () => {
  const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe(1)]));
  const foe = s.combat.foes[0];
  // face 2: a landing, non-best face — an ordinary hit, lethal to a 1-wp Skeleton.
  const rng = probeRng({ face: 2 });
  const events = [];
  playerStrike(s, rng, events);
  const types = events.map((e) => e.type);
  assert.ok(types.includes("foeRevived"), `expected foeRevived (kill-twice), got: ${types.join(", ")}`);
  assert.equal(types.includes("foeShattered"), false);
  assert.equal(foe.alive, true, "the kill-twice rule keeps the Skeleton up on its second life");
  assert.equal(foe.lives, 1);
});

// --- Party-member strike -----------------------------------------------------

function memberStrikeState(memberOpts, foe) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  const idx = withMember(s, memberOpts);
  const sheet = s.party[idx];
  sheet.abilities = [];
  inCombat(s, [foe], {
    allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  });
  return s;
}

test("[skeleton-shatter] a party member's own strike can shatter the Skeleton on exactly one face", () => {
  const build = () => memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      alliesTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:member-strike" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton via a member strike");
});

test("[skeleton-shatter] the member-strike shatter fires foeShattered with the member's own name", () => {
  const s = memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, skeletonFoe());
  const memberName = s.party[0].name;
  const rng = probeRng({ face: 1 });
  const events = [];
  alliesTurn(s, rng, events);
  const shattered = events.find((e) => e.type === "foeShattered");
  assert.ok(shattered, "expected a foeShattered event from the member's strike");
  assert.equal(shattered.by, memberName);
  assert.equal(s.combat.foes[0].alive, false);
});

// --- Legacy ally strike -------------------------------------------------------

function legacyAllyState(foe) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(s, [foe], { allies: [{ partyIdx: 0, name: "A hired hand", lvl: 2, wp: 5, maxWP: 5 }] });
  // No state.party sheet at partyIdx 0 (or an unclassed one) — alliesTurn's
  // `classed` guard falls through to the pre-25.1 LEGACY strike branch.
  s.party = [];
  return s;
}

test("[skeleton-shatter] a legacy ally strike can shatter the Skeleton on exactly one face", () => {
  const build = () => legacyAllyState(skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      alliesTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:legacy-ally-strike" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton via a legacy ally strike");
});

// --- Summoned ally strike (allyTurn) — rounds countdown still ticks --------

function summonedAllyState(foe) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(s, [foe], { ally: { name: "A tall grey silence", lvl: 3, rounds: 5 } });
  return s;
}

test("[skeleton-shatter] a summoned ally's own strike can shatter the Skeleton on exactly one face", () => {
  const build = () => summonedAllyState(skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      allyTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:ally-strike" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton via a summoned ally strike");
});

test("[skeleton-shatter] the summoned ally's rounds countdown still ticks after a shatter", () => {
  const s = summonedAllyState(skeletonFoe());
  const rng = probeRng({ face: 1 });
  const events = [];
  allyTurn(s, rng, events);
  assert.ok(events.some((e) => e.type === "foeShattered"));
  assert.equal(s.combat.foes[0].alive, false);
  // rounds started at 5; one round elapsed (--C.ally.rounds), still above 0,
  // so the ally has not yet departed.
  assert.equal(s.combat.ally.rounds, 4);
});

// --- Hero thrown attack spell (Fireball) -------------------------------------

function heroThrownState(foe) {
  const s = heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 });
  inCombat(s, [foe]);
  s.c.scrollCast = true;
  return s;
}

test("[skeleton-shatter] the hero's thrown attack spell (Fireball) can shatter the Skeleton on exactly one face", () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const build = () => heroThrownState(skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      castSpell(s, fireballIdx, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:thrown" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton via a thrown attack spell");
});

test("[skeleton-shatter] the hero's thrown-spell shatter fires foeShattered naming the spell", () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const s = heroThrownState(skeletonFoe());
  const foe = s.combat.foes[0];
  const rng = probeRng({ face: 1 });
  const events = [];
  // NOTE: castSpell's own tail (afterPlayerAction) ends combat and nulls
  // state.combat once the Skeleton dies, so `foe` is captured up front and
  // read directly — never via s.combat after this call.
  castSpell(s, fireballIdx, rng, events);
  const shattered = events.find((e) => e.type === "foeShattered");
  assert.ok(shattered, "expected a foeShattered event from the thrown spell");
  assert.equal(shattered.by, "you");
  assert.equal(shattered.spell, "Fireball");
  assert.equal(foe.alive, false);
});

// --- Member thrown attack spell -----------------------------------------------

function memberThrownState(foe) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  const idx = withMember(s, { cls: "Magic User", sub: "Wizard", race: "Human" });
  const sheet = s.party[idx];
  sheet.abilities = [];
  sheet.level = 5;
  sheet.grimoire = ["Fireball"];
  sheet.spellsUsed = 0;
  s.combat = {
    foes: [foe],
    type: foe.type,
    round: 2,
    target: 0,
    spellOpen: false,
    tracked: false,
    pending: false,
    allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  };
  return s;
}

test("[skeleton-shatter] a Magic User party member's own thrown spell can shatter the Skeleton on exactly one face", () => {
  const build = () => memberThrownState(skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      alliesTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "skeleton-shatter:ally-thrown" },
  );
  assert.equal(result.wins, 1, "only the best face may shatter the Skeleton via a member's thrown spell");
});

// --- Con Artist's opener is the one exception --------------------------------

test("[skeleton-shatter] a Con Artist's opening warning blow on its best face does NOT shatter; the strike after it can", () => {
  const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Con Artist", race: "Human" }), [skeletonFoe()]));
  const foe = s.combat.foes[0];
  const rng = { d: () => 1, pick: (arr) => arr[0], shuffle: (a) => a, getState: () => 1 };

  const openerEvents = [];
  playerStrike(s, rng, openerEvents);
  const openerTypes = openerEvents.map((e) => e.type);
  assert.ok(openerTypes.includes("conArtistOpener"), `expected conArtistOpener, got: ${openerTypes.join(", ")}`);
  assert.equal(openerTypes.includes("foeShattered"), false, "the Con Artist's opener must never shatter");
  assert.equal(foe.alive, true, "the opener deals no injury — the Skeleton survives");

  const followUpEvents = [];
  playerStrike(s, rng, followUpEvents);
  const followUpTypes = followUpEvents.map((e) => e.type);
  assert.ok(followUpTypes.includes("foeShattered"), `expected the follow-up strike to shatter, got: ${followUpTypes.join(", ")}`);
  assert.equal(foe.alive, false);
});

// --- A shatter draws no damage dice ------------------------------------------

test("[skeleton-shatter] a shatter draws no weapon-damage dice — the draws after the to-hit die are exactly killFoe's own", () => {
  const rngA = alwaysOneRng();
  const sA = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const foeA = sA.combat.foes[0];
  playerStrike(sA, rngA, []);
  assert.equal(foeA.alive, false);

  // A standalone killFoe call on a fresh, equivalent state, with the foe
  // left in the exact same pre-killFoe shape shatterIfBest leaves it in
  // (lives forced to 1, wp forced to 0) — an independent, deterministic
  // rng with the identical "always 1" policy.
  const rngB = alwaysOneRng();
  const sB = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const foeB = sB.combat.foes[0];
  foeB.lives = 1;
  foeB.wp = 0;
  killFoe(sB, foeB, rngB, []);

  assert.deepEqual(rngA.draws.slice(1), rngB.draws, "every draw after the to-hit die must exactly match killFoe's own draw sequence");
});

// --- A non-Skeleton foe never shatters ---------------------------------------

test("[skeleton-shatter] a non-Skeleton foe (no sp.shatterOnBest flag) never emits foeShattered, even on the best face", () => {
  const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Lair Beasts", 1, "M&M", { wp: 30 })]));
  const foe = s.combat.foes[0];
  assert.equal(!!foe.sp.shatterOnBest, false, "M&M must not carry the Skeleton's own flag");
  const rng = probeRng({ face: 1 });
  const events = [];
  playerStrike(s, rng, events);
  assert.equal(events.some((e) => e.type === "foeShattered"), false, "a non-shatter-flagged foe must never emit foeShattered");
});
