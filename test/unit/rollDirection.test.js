// test/unit/rollDirection.test.js
//
// Phase 72-02 (ROLL-01) — the COMBAT half of the roll-direction audit's
// direction test. For every combat modifier source, this file computes the
// ROLLER's success ODDS with and without the modifier and asserts the
// change goes the way the modifier's player-facing text or name claims: a
// bonus raises the roller's odds, a penalty lowers them. See
// test/unit/harness/rollOdds.js's header for the two load-bearing contracts
// (odds-only, no roll-convention number ever written) — Phase 73's roll-high
// mirror MUST be able to run this file UNCHANGED.
//
// Rows run under the SHIPPED DIALS (engine/difficulty.js's fitted values,
// not identity) — every row that needs a specific dial value applies it
// itself via setDialsForTuning and restores the shipped DIALS afterward.
//
// Four rows are PENDING (node:test's `todo` option, naming the fixing plan):
// the party-member insult-ordering bug (72-04), the Thief evasion sign
// inversion (72-04), the Fridgian frenzy second-swing math (72-05, two
// rows), and the Skeleton shatter mechanic (72-06, six rows split from the
// plan's five listed ids — the sixth pins the "even on your last life"
// case). Every other row passes today.

import test from "node:test";
import assert from "node:assert/strict";

import {
  probeRng,
  faceOdds,
  jointOdds,
  compareOdds,
  assertBonus,
  assertPenalty,
  assertSame,
  heroState,
  foeFrom,
  inCombat,
  withMember,
} from "./harness/rollOdds.js";

import { playerStrike, foeTurn, flee, alliesTurn, allyTurn, liveFoes } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { startEffect } from "../../engine/effects.js";
import { setDialsForTuning, DIALS } from "../../engine/difficulty.js";
import { SPELLS } from "../../content/index.js";

// ---------------------------------------------------------------------------
// Module-private helpers. Every one of these reads only EVENT TYPES and
// OUTCOME FLAGS (never a need/roll/target/dieN field), per the harness's odds
// contract.
// ---------------------------------------------------------------------------

/** landed(state, rng) — the hero's strike connected (a clean hit OR an
 * armor-soaked blow both count as "the roller's roll succeeded" — the target
 * number was met; only strikeMissed is a failure). */
function landed(state, rng) {
  const events = [];
  playerStrike(state, rng, events);
  return events.some((e) => e.type === "struck" || e.type === "foeArmorSoaked");
}

/** heroCrit(state, rng) — the hero's landed strike was a critical. */
function heroCrit(state, rng) {
  const events = [];
  playerStrike(state, rng, events);
  const hit = events.find((e) => e.type === "struck");
  return !!(hit && hit.critical);
}

/** foeHitsHero(state, rng) — the foe's swing at the HERO connected (the
 * hero-branch `foeMissed` carries no `member` field; any other outcome is a
 * landed blow, soaked-or-not). */
function foeHitsHero(state, rng) {
  const events = [];
  foeTurn(state, rng, events);
  const miss = events.find((e) => e.type === "foeMissed" && !e.member);
  return !miss;
}

/** foeCritOnHero(state, rng) — the foe's landed blow on the hero was a
 * critical (the plain `critical` flag, or the Soldier-only `soldierCrit`
 * additive flag that widens the window without changing `critical` itself). */
function foeCritOnHero(state, rng) {
  const events = [];
  foeTurn(state, rng, events);
  const hit = events.find((e) => e.type === "struckByFoe");
  return !!(hit && (hit.critical || hit.soldierCrit));
}

/** foeHitsMember(state, rng) — the foe's swing at the party MEMBER connected. */
function foeHitsMember(state, rng) {
  const events = [];
  foeTurn(state, rng, events);
  const miss = events.find((e) => e.type === "foeMissed" && e.member);
  return !miss;
}

/** foeCritOnMember(state, rng) — the foe's landed blow on the member was a
 * critical. */
function foeCritOnMember(state, rng) {
  const events = [];
  foeTurn(state, rng, events);
  const hit = events.find((e) => e.type === "memberStruck");
  return !!(hit && hit.critical);
}

/** memberLanded(state, rng) — a party member's own strike (via alliesTurn)
 * connected. */
function memberLanded(state, rng) {
  const events = [];
  alliesTurn(state, rng, events);
  return events.some((e) => e.type === "allyStruck");
}

/** allyLanded(state, rng) — a summoned ally's own strike (via allyTurn)
 * connected. */
function allyLanded(state, rng) {
  const events = [];
  allyTurn(state, rng, events);
  return events.some((e) => e.type === "allyStruck");
}

/** fledAndPursued(state, rng) — the flee roll (drawn first, unprobed and
 * always filled to its own die's best face by the pursuit rows below)
 * succeeded AND the pursuer's own strike is the row's probed draw; returns
 * whether that pursuit strike landed. */
function pursuitLanded(state, rng) {
  const events = [];
  flee(state, rng, events);
  return events.some((e) => e.type === "struckByFoe");
}

/** withClub(state) — pins the hero's weapon to Club (need 0, crit range 1),
 * so a class/race/sub comparison row isn't also, silently, a weapon-choice
 * comparison. A plain content-name assignment (the SAME field chargen itself
 * already sets this way) — never a roll-convention number. */
function withClub(state) {
  state.c.weapon = "Club";
  state.c.magicWpn = 0;
  state.c.prof = 0;
  // A Wizard with a castable attack spell refuses to melee
  // (engine/combat.js#playerStrike ~L565) — every hero-strike/hero-crit row
  // in this file is testing the MELEE to-hit odds, so every hero's daily
  // spell charges are exhausted here (a plain count, the same field
  // chargen itself sets) to keep the strike path reachable regardless of
  // sub-class.
  state.c.spellsUsed = 999;
  // chargen's own random skill draw (seeded, but not controllable per row)
  // can hand a build Ambidextrous/ Stealth/Night Vision/etc — any of which
  // would silently confound a row that isn't testing that skill (e.g. a
  // second attack roll folded into the SAME probed draw index). Cleared
  // here so every skill a row exercises is one it explicitly re-adds
  // afterward.
  state.c.skills = {};
  return state;
}

/** alwaysMax(_i, sides) — a `fill` strategy for a row whose FIRST (unprobed)
 * draw is a roll-HIGH mechanic (flee's d20) that must reliably succeed so a
 * later probed draw (the pursuit strike) is actually reached. Never encodes
 * the roll-under convention numerically — it just always returns the die's
 * own best face, whichever mechanic reads it. */
const alwaysMax = (_i, sides) => sides;

// Ned (Humans tier 1) carries no `sp.atk` (a single swing per visit) and no
// `abilities` kit — the plainest possible foe for a row that isn't itself
// testing multi-swing or ability-gate behaviour. Bat/Rat (the prototype's
// classic "plain foe") carries `sp.atk: 2`, which silently contaminates any
// row driven by a single probed draw (a second, unprobed swing can land or
// crit independently of the probed face).
const NEUTRAL_FOE = () => foeFrom("Humans", 1, "Ned");

// ---------------------------------------------------------------------------
// Self-test — the vacuous-probe guard itself.
// ---------------------------------------------------------------------------

test("[harness:vacuous-guard] faceOdds throws when a row's run() never draws", () => {
  assert.throws(() => faceOdds(() => true));
});

// =============================================================================
// HERO-SIDE COMBAT ROWS (Task 1) — the roller is the HERO.
// =============================================================================

test('[hero-strike:class-fighter] "the profession is standing there" — a Fighter hits more easily than a Magic User, engine/derived.js#classNeed ~L884', () => {
  const fighter = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const mage = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(fighter(), rng), { label: "hero-strike:class-fighter (Fighter)" });
  const without = faceOdds((rng) => landed(mage(), rng), { label: "hero-strike:class-fighter (Magic User)" });
  assertBonus(withMod, without, { label: "hero-strike:class-fighter" });
});

test('[hero-strike:elven] "hits on 5 whatever the class" — an Elven Magic User floors at 5, content/races.js:22', () => {
  const elven = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Elven" }), [NEUTRAL_FOE()]));
  const human = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(elven(), rng), { label: "hero-strike:elven (Elven MU)" });
  const without = faceOdds((rng) => landed(human(), rng), { label: "hero-strike:elven (Human MU)" });
  assertBonus(withMod, without, { label: "hero-strike:elven" });
});

test('[hero-strike:acrobat] an Acrobat strikes as a fighter with the dagger, engine/derived.js#classNeed', () => {
  const acrobat = () => withClub(inCombat(heroState({ cls: "Thief", sub: "Acrobat", race: "Human" }), [NEUTRAL_FOE()]));
  const pickpocket = () => withClub(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(acrobat(), rng), { label: "hero-strike:acrobat (Acrobat)" });
  const without = faceOdds((rng) => landed(pickpocket(), rng), { label: "hero-strike:acrobat (Pickpocket)" });
  assertBonus(withMod, without, { label: "hero-strike:acrobat" });
});

test('[hero-strike:cleric] "Clerics roll 4, not 3", engine/derived.js#classNeed', () => {
  const cleric = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Cleric", race: "Human" }), [NEUTRAL_FOE()]));
  const plainMU = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(cleric(), rng), { label: "hero-strike:cleric (Cleric)" });
  const without = faceOdds((rng) => landed(plainMU(), rng), { label: "hero-strike:cleric (plain MU)" });
  assertBonus(withMod, without, { label: "hero-strike:cleric" });
});

test('[hero-strike:inspired] a Bard\'s own song, "+1 to hit this fight" (content/abilities-adjacent combat.js#SONGS), in the light', () => {
  const inspired = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Bard", race: "Human" }), [NEUTRAL_FOE()], { inspired: 1 }));
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Bard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(inspired(), rng), { label: "hero-strike:inspired (light)" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:inspired (light, baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:inspired (light)" });
});

test("[hero-strike:inspired] the same +1 song, absorbed by the dark cap — OK (clamp), never worsening", () => {
  const dark = (inspiredAmt) => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Bard", race: "Human" }), [NEUTRAL_FOE()], inspiredAmt ? { inspired: inspiredAmt } : {}));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const withMod = faceOdds((rng) => landed(dark(1), rng), { label: "hero-strike:inspired (dark)" });
  const without = faceOdds((rng) => landed(dark(0), rng), { label: "hero-strike:inspired (dark, baseline)" });
  assertBonus(withMod, without, { strict: false, label: "hero-strike:inspired (dark, clamp)" });
});

test('[hero-strike:weapon-light] "a light weapon\'s bonus" (content/weapons.js header) — Rapier (need +1) vs Club (need 0)', () => {
  const light = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.weapon = "Rapier";
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(light(), rng), { label: "hero-strike:weapon-light" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:weapon-light (baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:weapon-light" });
});

test('[hero-strike:weapon-heavy] the device trigger — "-2 to hit" really IS worse: Bardiche (need -2) vs Club (need 0)', () => {
  const heavy = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.weapon = "Bardiche";
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(heavy(), rng), { label: "hero-strike:weapon-heavy" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:weapon-heavy (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:weapon-heavy" });
});

test('[hero-strike:dazed] "you need 2 lower to hit" while a live dazed foeEffect is up, engine/derived.js#toHit ~L1134', () => {
  const dazed = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.foeEffect = { kind: "dazed", rounds: 2 };
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(dazed(), rng), { label: "hero-strike:dazed" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:dazed (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:dazed" });
});

test('[hero-strike:dark-cap] a dark tile caps the hero\'s own need at 2 (no Night Vision), engine/derived.js#toHit ~L1135', () => {
  const dark = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const lit = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(dark(), rng), { label: "hero-strike:dark-cap" });
  const without = faceOdds((rng) => landed(lit(), rng), { label: "hero-strike:dark-cap (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:dark-cap" });
});

test('[hero-strike:night-vision] "darkness costs you nothing", content/skills.js:49 — Night Vision waives the dark cap', () => {
  const withSkill = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    s.c.skills["Night Vision"] = 1;
    return s;
  };
  const withoutSkill = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const withMod = faceOdds((rng) => landed(withSkill(), rng), { label: "hero-strike:night-vision" });
  const without = faceOdds((rng) => landed(withoutSkill(), rng), { label: "hero-strike:night-vision (baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:night-vision" });
});

test("[hero-strike:senses] a live c.senses waives the dark cap exactly like Night Vision, engine/derived.js#toHit ~L1135", () => {
  const withSenses = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    s.c.senses = 1;
    return s;
  };
  const withoutSenses = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    return s;
  };
  const withMod = faceOdds((rng) => landed(withSenses(), rng), { label: "hero-strike:senses" });
  const without = faceOdds((rng) => landed(withoutSenses(), rng), { label: "hero-strike:senses (baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:senses" });
});

test('[hero-strike:dozing] "5 to hit a dozing creature" (p.27) — a bonus against an MU\'s normally-worse need', () => {
  const dozing = () => {
    const s = withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.foes[0].asleep = 3;
    return s;
  };
  const awake = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(dozing(), rng), { label: "hero-strike:dozing (MU)" });
  const without = faceOdds((rng) => landed(awake(), rng), { label: "hero-strike:dozing (MU, baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:dozing (MU)" });
});

test("[hero-strike:dozing] the same dozing floor, absorbed by a Fighter's already-5 need — OK (clamp)", () => {
  const dozing = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.foes[0].asleep = 3;
    return s;
  };
  const awake = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(dozing(), rng), { label: "hero-strike:dozing (Fighter)" });
  const without = faceOdds((rng) => landed(awake(), rng), { label: "hero-strike:dozing (Fighter, baseline)" });
  assertSame(withMod, without, { label: "hero-strike:dozing (Fighter, clamp)" });
});

test("[hero-strike:stupid] Stupidity is hit exactly like dozing (Phase 40 SPELL-01) — a bonus against an MU", () => {
  const stupid = () => {
    const s = withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.foes[0].stupid = true;
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(stupid(), rng), { label: "hero-strike:stupid (MU)" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:stupid (MU, baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:stupid (MU)" });
});

test("[hero-strike:stupid] the same floor, absorbed by a Fighter's already-5 need — OK (clamp)", () => {
  const stupid = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.foes[0].stupid = true;
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(stupid(), rng), { label: "hero-strike:stupid (Fighter)" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:stupid (Fighter, baseline)" });
  assertSame(withMod, without, { label: "hero-strike:stupid (Fighter, clamp)" });
});

test('[hero-strike:hard-to-hit] a Zit ("hittable only on a 4") is a strict penalty for a Fighter', () => {
  const zit = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Beasts", 2, "Zit")]));
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(zit(), rng), { label: "hero-strike:hard-to-hit (Fighter)" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:hard-to-hit (Fighter, baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:hard-to-hit (Fighter)" });
});

test("[hero-strike:hard-to-hit] the same Zit floor, a clamp (no worsening) for an MU whose need is already lower", () => {
  const zit = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [foeFrom("Beasts", 2, "Zit")]));
  const plain = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(zit(), rng), { label: "hero-strike:hard-to-hit (MU)" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:hard-to-hit (MU, baseline)" });
  assertSame(withMod, without, { label: "hero-strike:hard-to-hit (MU, clamp)" });
});

test('[hero-strike:fast] a Pogo ("fast — strike one higher") is a strict penalty, engine/combat.js#playerStrike ~L616', () => {
  const pogo = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Lair Beasts", 1, "Pogo")]));
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(pogo(), rng), { label: "hero-strike:fast" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:fast (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:fast" });
});

test('[hero-strike:magic-only] a Ghost ("only magic touches it") is untouchable with no magic weapon', () => {
  const noMagic = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Demons", 4, "Ghost")]));
  const result = faceOdds((rng) => landed(noMagic(), rng), { label: "hero-strike:magic-only (no magic weapon)" });
  assert.equal(result.wins, 0, "[hero-strike:magic-only] an untouchable foe must win on ZERO faces");
});

test("[hero-strike:magic-only] the same Ghost, hittable once the hero carries a magic weapon", () => {
  const withMagic = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Demons", 4, "Ghost")]));
    s.c.magicWpn = 1;
    return s;
  };
  const result = faceOdds((rng) => landed(withMagic(), rng), { label: "hero-strike:magic-only (magic weapon)" });
  assert.ok(result.wins > 0, "[hero-strike:magic-only] a magic weapon must land on at least one face");
});

test('[hero-strike:overhead-blow] "you need two better to land it" — a strict self-penalty, engine/abilities.js:188', () => {
  const overhead = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.abilityStrike = { key: "overheadBlow", dmgMul: 2, needShift: -2 };
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(overhead(), rng), { label: "hero-strike:overhead-blow" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:overhead-blow (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:overhead-blow" });
});

test("[hero-strike:afraid] a live combat.afraid penalty is a strict self-penalty, engine/derived.js#afraidNeed", () => {
  const afraid = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { afraid: 2 }));
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(afraid(), rng), { label: "hero-strike:afraid" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:afraid (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:afraid" });
});

test('[hero-strike:afraid-vs-untouchable] Afraid "never revives an untouchable" Ghost with no magic weapon', () => {
  const afraidGhost = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Demons", 4, "Ghost")], { afraid: 2 }));
  const result = faceOdds((rng) => landed(afraidGhost(), rng), { label: "hero-strike:afraid-vs-untouchable" });
  assert.equal(result.wins, 0, "[hero-strike:afraid-vs-untouchable] fear must never make an untouchable foe hittable");
});

test('[hero-strike:floor-clamp] Overhead Blow + Afraid on an already-floored need never goes below one face', () => {
  const floored = () => {
    // Bardiche (need -2) narrows a Thief's already-lower need close to the
    // floor; Overhead Blow (-2) and Afraid (-3) stack on top of it — the
    // combination must floor at 1, never go negative/untouchable.
    const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()], { afraid: 2 }));
    s.c.weapon = "Bardiche";
    s.combat.abilityStrike = { key: "overheadBlow", dmgMul: 2, needShift: -2 };
    return s;
  };
  const withoutAfraid = () => {
    const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.weapon = "Bardiche";
    s.combat.abilityStrike = { key: "overheadBlow", dmgMul: 2, needShift: -2 };
    return s;
  };
  const withMod = faceOdds((rng) => landed(floored(), rng), { label: "hero-strike:floor-clamp" });
  const without = faceOdds((rng) => landed(withoutAfraid(), rng), { label: "hero-strike:floor-clamp (baseline)" });
  assertBonus(withMod, without, { strict: false, label: "hero-strike:floor-clamp (non-worsening)" });
  assert.ok(withMod.wins >= 1, "[hero-strike:floor-clamp] a floored need still wins on at least one face while the target is touchable");
});

test('[hero-strike:philly-slow] a Philly ("kill it twice") keeps the LOWER of two dice — a strict bonus', () => {
  const build = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Walking Dead", 1, "Philly")]));
  const withMod = jointOdds((rng) => landed(build(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "hero-strike:philly-slow" });
  const without = faceOdds((rng) => landed(withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()])), rng), {
    label: "hero-strike:philly-slow (baseline)",
  });
  assertBonus(withMod, without, { label: "hero-strike:philly-slow" });
});

test('[hero-strike:auto-hit] a Cat Burglar\'s first strike (C.opened false) wins on every face', () => {
  const build = () => withClub(inCombat(heroState({ cls: "Thief", sub: "Cat Burglar", race: "Human" }), [NEUTRAL_FOE()]));
  const result = faceOdds((rng) => landed(build(), rng), { label: "hero-strike:auto-hit" });
  assert.equal(result.wins, result.n, "[hero-strike:auto-hit] a Cat Burglar's opener must win on every face");
});

test("[hero-strike:level-die] a level-2 hero strikes on a smaller (better) die than a level-1 hero, engine/derived.js#strikeDie", () => {
  const lvl2 = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human", level: 2 }), [NEUTRAL_FOE()]));
  const lvl1 = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human", level: 1 }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(lvl2(), rng), { label: "hero-strike:level-die (level 2)" });
  const without = faceOdds((rng) => landed(lvl1(), rng), { label: "hero-strike:level-die (level 1)" });
  assertBonus(withMod, without, { label: "hero-strike:level-die" });
});

test('[hero-strike:elven-strike-step] "strikes a die better", content/races.js:23 — Elven vs Human at the same level', () => {
  const elven = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Elven" }), [NEUTRAL_FOE()]));
  const human = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(elven(), rng), { label: "hero-strike:elven-strike-step" });
  const without = faceOdds((rng) => landed(human(), rng), { label: "hero-strike:elven-strike-step (baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:elven-strike-step" });
});

test('[hero-strike:illusionist-d20] "d20 until level three", engine/derived.js#strikeDie ~L770 — Illusionist vs Wizard at level 2', () => {
  const illusionist = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Illusionist", race: "Human", level: 2 }), [NEUTRAL_FOE()]));
  const wizard = () => withClub(inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 2 }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(illusionist(), rng), { label: "hero-strike:illusionist-d20" });
  const without = faceOdds((rng) => landed(wizard(), rng), { label: "hero-strike:illusionist-d20 (baseline)" });
  assertPenalty(withMod, without, { label: "hero-strike:illusionist-d20" });
});

test('[hero-strike:acuteness] a live Potion of Acuteness effect ("strike on a d6"), engine/derived.js#strikeDie ~L773', () => {
  const acute = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    startEffect(s.c, "item:Acuteness", { rounds: 4 });
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => landed(acute(), rng), { label: "hero-strike:acuteness" });
  const without = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:acuteness (baseline)" });
  assertBonus(withMod, without, { label: "hero-strike:acuteness" });
});

// --- Fridgian frenzy (PENDING, 72-05) ---------------------------------------

test(
  '[hero-strike:frenzy-second-swing] "your normal to-hit, one worse" — the actual frenzy swing only, engine/combat.js#playerStrike ~L611 (72-05 replaces the canon hard-set)',
  { todo: "fixed by 72-05" },
  () => {
    // Draw 0 = the frenzy trigger (a d8 <= 5 fires it); fixed at face 1 (always
    // fires). Draw 1 = swing 1's strike die, filled to its OWN worst face (a
    // guaranteed miss) so swing 2 is reachable. Draw 2 = swing 2, the row's
    // own probed draw.
    const frenzied = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" }), [NEUTRAL_FOE()]));
    const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
    const opts = { isProbe: (i) => i === 2, fill: (i, sides) => (i === 0 ? 1 : sides) };
    const swing2 = faceOdds((rng) => landed(frenzied(), rng), { ...opts, label: "hero-strike:frenzy-second-swing (swing 2)" });
    const normal = faceOdds((rng) => landed(plain(), rng), { label: "hero-strike:frenzy-second-swing (normal to-hit)" });
    // POST-FIX claim: swing 2's odds equal the normal swing's odds narrowed by
    // exactly one face on the same die, never below one face.
    assert.equal(swing2.n, normal.n, "[hero-strike:frenzy-second-swing] the frenzy swing must roll the hero's own normal die");
    assert.equal(swing2.wins, Math.max(1, normal.wins - 1), "[hero-strike:frenzy-second-swing] swing 2 must be exactly one face worse than the normal to-hit");
  },
);

test(
  "[hero-strike:frenzy-dark-cap] the same frenzy swing in the dark — never better than the dark-capped normal swing",
  { todo: "fixed by 72-05" },
  () => {
    const frenziedDark = () => {
      const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" }), [NEUTRAL_FOE()]));
      s.floor.g[s.floor.py][s.floor.px].dark = true;
      return s;
    };
    const plainDark = () => {
      const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
      s.floor.g[s.floor.py][s.floor.px].dark = true;
      return s;
    };
    const opts = { isProbe: (i) => i === 2, fill: (i, sides) => (i === 0 ? 1 : sides) };
    const swing2 = faceOdds((rng) => landed(frenziedDark(), rng), { ...opts, label: "hero-strike:frenzy-dark-cap (swing 2)" });
    const normal = faceOdds((rng) => landed(plainDark(), rng), { label: "hero-strike:frenzy-dark-cap (normal, dark)" });
    assertPenalty(swing2, normal, { strict: false, label: "hero-strike:frenzy-dark-cap (never above the dark-capped normal swing)" });
  },
);

// --- Crit rows (success = struck.critical) ----------------------------------

test('[hero-crit:precise-blade] "crit on a 1 OR 2" — Rapier (crit 2) vs Club (crit 1)', () => {
  const precise = () => {
    // A Knight (not Guard/Soldier) so the weapon's own crit range is the
    // only axis under test — Guard/Soldier never crit regardless of weapon.
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.weapon = "Rapier";
    return s;
  };
  const plain = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => heroCrit(precise(), rng), { label: "hero-crit:precise-blade" });
  const without = faceOdds((rng) => heroCrit(plain(), rng), { label: "hero-crit:precise-blade (baseline)" });
  assertBonus(withMod, without, { label: "hero-crit:precise-blade" });
});

test('[hero-crit:no-crit-sub] a Guard/Soldier "never crits", engine/combat.js#playerStrike ~L673', () => {
  const build = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const result = faceOdds((rng) => heroCrit(build(), rng), { label: "hero-crit:no-crit-sub" });
  assert.equal(result.wins, 0, "[hero-crit:no-crit-sub] a Soldier must never land a critical");
});

test("[hero-crit:dark] darkness without Night Vision suppresses every critical, engine/combat.js#playerStrike ~L673", () => {
  const build = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
    s.floor.g[s.floor.py][s.floor.px].dark = true;
    s.c.weapon = "Rapier"; // precise blade, so a lit fight WOULD crit on faces 1-2
    return s;
  };
  const result = faceOdds((rng) => heroCrit(build(), rng), { label: "hero-crit:dark" });
  assert.equal(result.wins, 0, "[hero-crit:dark] darkness without Night Vision must suppress every critical");
});

test('[hero-crit:stealth] "critical on a 2 when you open a fight", content/skills.js:28', () => {
  // A non-Thief (Knight) opener — a Thief's opening strike already crits via
  // its own plain backstab rule regardless of Stealth (the else-if fallback
  // in engine/combat.js#playerStrike), so a Thief comparison can never show
  // Stealth's own marginal effect. A Knight has no such fallback.
  const withStealth = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.skills.Stealth = 1;
    s.c.armor = "Nothing";
    s.c.ar = 0;
    return s;
  };
  const withoutStealth = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
    s.c.armor = "Nothing";
    s.c.ar = 0;
    return s;
  };
  const withMod = faceOdds((rng) => heroCrit(withStealth(), rng), { label: "hero-crit:stealth" });
  const without = faceOdds((rng) => heroCrit(withoutStealth(), rng), { label: "hero-crit:stealth (baseline)" });
  assertBonus(withMod, without, { label: "hero-crit:stealth" });
});

test('[hero-crit:ninja] a Ninja\'s NON-opening strike still crits on a 1 or 2, engine/combat.js#playerStrike ~L731', () => {
  const ninja = () => {
    const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Ninja", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.opened = true; // the free opener has already fired
    s.combat.opened2 = true; // this is not the opening strike either
    return s;
  };
  const nonNinja = () => {
    const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.opened = true;
    s.combat.opened2 = true;
    return s;
  };
  const withMod = faceOdds((rng) => heroCrit(ninja(), rng), { label: "hero-crit:ninja" });
  const without = faceOdds((rng) => heroCrit(nonNinja(), rng), { label: "hero-crit:ninja (baseline)" });
  assertBonus(withMod, without, { label: "hero-crit:ninja" });
});

test('[hero-crit:silent-step] a forced crit (Silent Step\'s own descriptor) always lands a critical, engine/abilities.js:184', () => {
  const build = () => {
    const s = withClub(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]));
    s.combat.opened = true;
    s.combat.opened2 = true;
    s.combat.abilityStrike = { key: "silentStep", autoHit: true, forceCrit: true };
    return s;
  };
  const result = faceOdds((rng) => heroCrit(build(), rng), { label: "hero-crit:silent-step" });
  assert.equal(result.wins, result.n, "[hero-crit:silent-step] a forced crit must win on every face");
});
