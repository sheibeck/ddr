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

// =============================================================================
// TASK 2 — foe-side, member/ally, ordering/identity rows, and the RED pending
// rows for the four known bugs.
// =============================================================================

// --- Foe against the hero ---------------------------------------------------

test('[foe-vs-hero:elven] "easy to hit" (content/races.js:23, deliberate Phase 31) — a strict bonus to the FOE', () => {
  const elven = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Elven" }), [NEUTRAL_FOE()]);
  const human = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(elven(), rng), { label: "foe-vs-hero:elven" });
  const without = faceOdds((rng) => foeHitsHero(human(), rng), { label: "foe-vs-hero:elven (baseline)" });
  assertBonus(withMod, without, { label: "foe-vs-hero:elven" });
});

test("[foe-vs-hero:acrobat] Acrobat harder to hit (need 3, not 5), a strict penalty to the foe", () => {
  const acrobat = () => inCombat(heroState({ cls: "Thief", sub: "Acrobat", race: "Human" }), [NEUTRAL_FOE()]);
  const pickpocket = () => inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(acrobat(), rng), { label: "foe-vs-hero:acrobat" });
  const without = faceOdds((rng) => foeHitsHero(pickpocket(), rng), { label: "foe-vs-hero:acrobat (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:acrobat" });
});

test('[foe-vs-hero:guard] "the profession is standing there" (Phase 24) — a strict penalty to the foe', () => {
  const guard = () => inCombat(heroState({ cls: "Fighter", sub: "Guard", race: "Human" }), [NEUTRAL_FOE()]);
  const soldier = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(guard(), rng), { label: "foe-vs-hero:guard" });
  const without = faceOdds((rng) => foeHitsHero(soldier(), rng), { label: "foe-vs-hero:guard (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:guard" });
});

test('[foe-vs-hero:gear-foe-to-hit] Anklet of Invisibility, "foes need two better to land" — a strict penalty to the foe', () => {
  const anklet = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    startEffect(s.c, "item:Anklet of Invisibility", { rounds: 50 });
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(anklet(), rng), { label: "foe-vs-hero:gear-foe-to-hit" });
  const without = faceOdds((rng) => foeHitsHero(plain(), rng), { label: "foe-vs-hero:gear-foe-to-hit (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:gear-foe-to-hit" });
});

test("[foe-vs-hero:foe-accuracy] the FOE_ACCURACY dial — identity is a no-op, a positive value is a strict bonus to the foe", () => {
  const build = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const identity = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:foe-accuracy (identity)" });
  const identityExplicit = (() => {
    const restore = setDialsForTuning({ FOE_ACCURACY: DIALS.FOE_ACCURACY });
    const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:foe-accuracy (identity, explicit)" });
    restore();
    return result;
  })();
  assertSame(identityExplicit, identity, { label: "foe-vs-hero:foe-accuracy (identity is a no-op)" });
  const bumped = (() => {
    const restore = setDialsForTuning({ FOE_ACCURACY: 1 });
    const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:foe-accuracy (+1)" });
    restore();
    return result;
  })();
  assertBonus(bumped, identity, { label: "foe-vs-hero:foe-accuracy" });
});

test('[foe-vs-hero:battle-roar] the hero\'s OWN live Battle Roar timer — a strict penalty to the foe, engine/derived.js#foeToHitVs ~L1230', () => {
  const roaring = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    startEffect(s.c, "ability:battleRoar", { rounds: 2 });
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(roaring(), rng), { label: "foe-vs-hero:battle-roar" });
  const without = faceOdds((rng) => foeHitsHero(plain(), rng), { label: "foe-vs-hero:battle-roar (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:battle-roar" });
});

test('[foe-vs-hero:party-battle-roar] a MEMBER\'s own Battle Roar covers the hero too, engine/derived.js#foeToHitVs ~L1230', () => {
  const roaringMember = () => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    const idx = withMember(s, { cls: "Fighter", sub: "Guard", race: "Human" });
    const sheet = s.party[idx];
    startEffect(sheet, "ability:battleRoar", { rounds: 2 });
    inCombat(s, [NEUTRAL_FOE()], { allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level ?? 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }] });
    return s;
  };
  const noMember = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  // A LIVE (non-taunting) party member makes pickFoeTarget draw a pool-pick
  // die FIRST (engine/combat.js#pickFoeTarget) — fill(0,2)=1 selects the
  // hero (pick > 1 is a member), so the row's own probed draw is the SECOND
  // one, index 1. The baseline has no party at all, so pickFoeTarget draws
  // nothing and the to-hit die stays index 0.
  const withMod = faceOdds((rng) => foeHitsHero(roaringMember(), rng), { isProbe: (i) => i === 1, label: "foe-vs-hero:party-battle-roar" });
  const without = faceOdds((rng) => foeHitsHero(noMember(), rng), { label: "foe-vs-hero:party-battle-roar (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:party-battle-roar" });
});

test('[foe-vs-hero:sidestep] the hero\'s own live Sidestep timer — a strict penalty to the foe', () => {
  const sidestepping = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    startEffect(s.c, "ability:sidestep", { rounds: 2 });
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(sidestepping(), rng), { label: "foe-vs-hero:sidestep" });
  const without = faceOdds((rng) => foeHitsHero(plain(), rng), { label: "foe-vs-hero:sidestep (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:sidestep" });
});

test('[foe-vs-hero:smoke] a live Smoke timer gives the foe exactly one winning face', () => {
  const smoked = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    startEffect(s.c, "ability:smoke", { rounds: 2 });
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(smoked(), rng), { label: "foe-vs-hero:smoke" });
  assert.equal(result.wins, 1, "[foe-vs-hero:smoke] the foe must win on exactly one face");
});

test('[foe-vs-hero:mirror-self] c.mirror ("foes need a 1 to hit") gives the foe exactly one winning face', () => {
  const mirrored = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    s.c.mirror = 3;
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(mirrored(), rng), { label: "foe-vs-hero:mirror-self" });
  assert.equal(result.wins, 1, "[foe-vs-hero:mirror-self] the foe must win on exactly one face");
});

test('[foe-vs-hero:invisibility] a live invis item effect gives the foe exactly one winning face', () => {
  const invisible = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    startEffect(s.c, "item:Invisible", { rounds: 90 });
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(invisible(), rng), { label: "foe-vs-hero:invisibility" });
  assert.equal(result.wins, 1, "[foe-vs-hero:invisibility] the foe must win on exactly one face");
});

test("[foe-vs-hero:blind] a blinded foe still gives itself exactly one winning face", () => {
  const build = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    s.combat.foes[0].blind = true;
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:blind" });
  assert.equal(result.wins, 1, "[foe-vs-hero:blind] the foe must win on exactly one face");
});

test('[foe-vs-hero:weaken] a live Weaken cast ("they hit on a 3") is a strict penalty to the foe for a base-5 hero', () => {
  const weakenIdx = SPELLS.findIndex((sp) => sp.n === "Weaken");
  const weakened = () => {
    const s = inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 }), [foeFrom("Humans", 1, "Ned")]);
    s.c.scrollCast = true; // bypass the grimoire/level/school gate — we are testing the EFFECT, not chargen
    castSpell(s, weakenIdx, probeRng({ isProbe: () => false, fill: () => 1 }), []);
    assert.ok(s.combat.foeToHitPenalty, "[foe-vs-hero:weaken] the cast must leave a live foeToHitPenalty");
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 }), [foeFrom("Humans", 1, "Ned")]);
  const withMod = faceOdds((rng) => foeHitsHero(weakened(), rng), { label: "foe-vs-hero:weaken" });
  const without = faceOdds((rng) => foeHitsHero(plain(), rng), { label: "foe-vs-hero:weaken (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-hero:weaken" });
});

test("[foe-vs-hero:insult] a live parleyInsulted flag is exactly one more winning face on the same die", () => {
  const plainBuild = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const insultBuild = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { parleyInsulted: true });
  const without = faceOdds((rng) => foeHitsHero(plainBuild(), rng), { label: "foe-vs-hero:insult (baseline)" });
  const withMod = faceOdds((rng) => foeHitsHero(insultBuild(), rng), { label: "foe-vs-hero:insult" });
  assert.equal(withMod.n, without.n, "[foe-vs-hero:insult] the insult must not change the die size");
  assert.equal(withMod.wins, without.wins + 1, "[foe-vs-hero:insult] the insult must be exactly one more winning face");
});

test('[foe-vs-hero:insult-after-smoke] Smoke overrides to the single best face, THEN the insult adds one — exactly two faces (passing today)', () => {
  const build = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { parleyInsulted: true });
    startEffect(s.c, "ability:smoke", { rounds: 2 });
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:insult-after-smoke" });
  assert.equal(result.wins, 2, "[foe-vs-hero:insult-after-smoke] insulted-plus-smoked must win on exactly two faces");
});

test('[foe-vs-hero:insult-after-mirror] Mirror Self overrides, then the insult adds one — exactly two faces (passing today)', () => {
  const build = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { parleyInsulted: true });
    s.c.mirror = 3;
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:insult-after-mirror" });
  assert.equal(result.wins, 2, "[foe-vs-hero:insult-after-mirror] insulted-plus-mirrored must win on exactly two faces");
});

test('[foe-vs-hero:insult-after-invisibility] a live invis effect overrides, then the insult adds one — exactly two faces (passing today)', () => {
  const build = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { parleyInsulted: true });
    startEffect(s.c, "item:Invisible", { rounds: 90 });
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:insult-after-invisibility" });
  assert.equal(result.wins, 2, "[foe-vs-hero:insult-after-invisibility] insulted-plus-invisible must win on exactly two faces");
});

test('[foe-vs-hero:insult-after-blind] a blinded foe overrides, then the insult adds one — exactly two faces (passing today)', () => {
  const build = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()], { parleyInsulted: true });
    s.combat.foes[0].blind = true;
    return s;
  };
  const result = faceOdds((rng) => foeHitsHero(build(), rng), { label: "foe-vs-hero:insult-after-blind" });
  assert.equal(result.wins, 2, "[foe-vs-hero:insult-after-blind] insulted-plus-blind must win on exactly two faces");
});

test('[foe-vs-hero:dwarven-foe-strike-step] "foes strike at a better die" against a Dwarf, content/races.js:29', () => {
  const dwarf = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Dwarven" }), [NEUTRAL_FOE()]);
  const human = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = faceOdds((rng) => foeHitsHero(dwarf(), rng), { label: "foe-vs-hero:dwarven-foe-strike-step" });
  const without = faceOdds((rng) => foeHitsHero(human(), rng), { label: "foe-vs-hero:dwarven-foe-strike-step (baseline)" });
  assertBonus(withMod, without, { label: "foe-vs-hero:dwarven-foe-strike-step" });
});

test("[foe-vs-hero:foe-level-die] a higher-tier foe strikes no worse than a lower-tier one of the same need, engine/derived.js#foeDie", () => {
  const highTier = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Walking Dead", 2, "Skeleton")]);
  const lowTier = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Walking Dead", 1, "Philly")]);
  const withMod = faceOdds((rng) => foeHitsHero(highTier(), rng), { label: "foe-vs-hero:foe-level-die" });
  const without = faceOdds((rng) => foeHitsHero(lowTier(), rng), { label: "foe-vs-hero:foe-level-die (baseline)" });
  assertBonus(withMod, without, { strict: false, label: "foe-vs-hero:foe-level-die" });
});

test(
  '[foe-vs-hero:thief-evasion] a positive evasion dial should make a Thief HARDER to hit (a penalty to the foe), engine/difficulty.js#classEvasionFor ~L591 (72-04 flips the sign)',
  () => {
    const thief = () => inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]);
    const nonThief = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);

    const identity = faceOdds((rng) => foeHitsHero(thief(), rng), { label: "thief-evasion (identity)" });
    let restore = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief } } });
    const identityExplicit = faceOdds((rng) => foeHitsHero(thief(), rng), { label: "thief-evasion (identity, explicit)" });
    restore();
    assertSame(identityExplicit, identity, { label: "thief-evasion (identity is a no-op)" });

    restore = setDialsForTuning({ CLASS_MITIGATION: { Thief: { ...DIALS.CLASS_MITIGATION.Thief, evasion: 1 } } });
    const bumped = faceOdds((rng) => foeHitsHero(thief(), rng), { label: "thief-evasion (+1)" });
    const bumpedNonThief = faceOdds((rng) => foeHitsHero(nonThief(), rng), { label: "thief-evasion (+1, non-Thief)" });
    restore();
    const nonThiefBaseline = faceOdds((rng) => foeHitsHero(nonThief(), rng), { label: "thief-evasion (baseline, non-Thief)" });

    assertPenalty(bumped, identity, { label: "foe-vs-hero:thief-evasion" });
    assertSame(bumpedNonThief, nonThiefBaseline, { label: "foe-vs-hero:thief-evasion (non-Thief unaffected)" });
  },
);

// --- Foe crit against the hero -----------------------------------------------

test('[foe-crit-vs-hero:soldier] "a BAD trait" — a Soldier hero widens the FOE\'s crit window to 1-2', () => {
  // NEUTRAL_FOE (Ned) carries no `abilities` kit and no `sp.atk` — every
  // Humans-tier-2 row carries one or the other, either of which would
  // insert an extra, unprobed draw ahead of the row's own probed to-hit
  // roll.
  // Bare armor (ar 0) so a landed blow is never soaked into an `armorSoaked`
  // event instead of `struckByFoe` — a soaked blow carries no crit flag at
  // all, which would silently zero out this row regardless of the sign
  // under test.
  const bareArmor = (s) => {
    s.c.armor = "Nothing";
    s.c.ar = 0;
    s.c.armorWP = 0;
    s.c.armorMax = 0;
    return s;
  };
  const soldier = () => bareArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]));
  const knight = () => bareArmor(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [NEUTRAL_FOE()]));
  const withMod = faceOdds((rng) => foeCritOnHero(soldier(), rng), { label: "foe-crit-vs-hero:soldier" });
  const without = faceOdds((rng) => foeCritOnHero(knight(), rng), { label: "foe-crit-vs-hero:soldier (baseline)" });
  assertBonus(withMod, without, { label: "foe-crit-vs-hero:soldier" });
});

// --- Foe against a party member ---------------------------------------------

/** memberCombatState(heroOpts, memberOpts, foe) — builds a live encounter with
 * one taunting party member (a zero-draw, deterministic foeTurn target, per
 * pickFoeTarget's own taunt short-circuit), so every foe-vs-member row always
 * exercises the MEMBER branch. */
function memberCombatState(heroOpts, memberOpts, foe) {
  const s = heroState(heroOpts);
  const idx = withMember(s, memberOpts);
  const sheet = s.party[idx];
  startEffect(sheet, "ability:taunt", { rounds: 1 });
  inCombat(s, [foe], { allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level ?? 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }] });
  return s;
}

test('[foe-vs-member:battle-roar] a party member\'s own Battle Roar is a strict penalty to the foe', () => {
  const roaringMember = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    startEffect(s.party[0], "ability:battleRoar", { rounds: 2 });
    return s;
  };
  const plain = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => foeHitsMember(roaringMember(), rng), { label: "foe-vs-member:battle-roar" });
  const without = faceOdds((rng) => foeHitsMember(plain(), rng), { label: "foe-vs-member:battle-roar (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-member:battle-roar" });
});

test("[foe-vs-member:member-sidestep] a member's own Sidestep is a strict penalty to the foe", () => {
  const sidestepping = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    startEffect(s.party[0], "ability:sidestep", { rounds: 2 });
    return s;
  };
  const plain = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => foeHitsMember(sidestepping(), rng), { label: "foe-vs-member:member-sidestep" });
  const without = faceOdds((rng) => foeHitsMember(plain(), rng), { label: "foe-vs-member:member-sidestep (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-member:member-sidestep" });
});

test("[foe-vs-member:member-smoke] a member's own Smoke gives the foe exactly one winning face", () => {
  const smoked = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    startEffect(s.party[0], "ability:smoke", { rounds: 2 });
    return s;
  };
  const result = faceOdds((rng) => foeHitsMember(smoked(), rng), { label: "foe-vs-member:member-smoke" });
  assert.equal(result.wins, 1, "[foe-vs-member:member-smoke] the foe must win on exactly one face");
});

test("[foe-vs-member:blind] a blinded foe against a member still gives itself exactly one winning face", () => {
  const build = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    s.combat.foes[0].blind = true;
    return s;
  };
  const result = faceOdds((rng) => foeHitsMember(build(), rng), { label: "foe-vs-member:blind" });
  assert.equal(result.wins, 1, "[foe-vs-member:blind] the foe must win on exactly one face");
});

test('[foe-vs-member:weaken] a live Weaken cast is a strict penalty to the foe attacking a member', () => {
  const weakenIdx = SPELLS.findIndex((sp) => sp.n === "Weaken");
  const weakened = () => {
    const s = memberCombatState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 }, { cls: "Fighter", sub: "Guard", race: "Human" }, foeFrom("Humans", 1, "Ned"));
    s.c.scrollCast = true;
    // castSpell's own tail runs afterPlayerAction (the cast IS the round's
    // action) — on a disposable rng, so it never touches the row's real
    // probed rng, but it DOES run one full foeTurn against this same
    // combat, which can tick the member's own one-round taunt timer past
    // its effect phase. Refreshed here so the row's own explicit foeTurn
    // call below still deterministically targets the member.
    castSpell(s, weakenIdx, probeRng({ isProbe: () => false, fill: () => 1 }), []);
    startEffect(s.party[0], "ability:taunt", { rounds: 1 });
    return s;
  };
  const plain = () => memberCombatState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 }, { cls: "Fighter", sub: "Guard", race: "Human" }, foeFrom("Humans", 1, "Ned"));
  const withMod = faceOdds((rng) => foeHitsMember(weakened(), rng), { label: "foe-vs-member:weaken" });
  const without = faceOdds((rng) => foeHitsMember(plain(), rng), { label: "foe-vs-member:weaken (baseline)" });
  assertPenalty(withMod, without, { label: "foe-vs-member:weaken" });
});

test("[foe-vs-member:insult] a live parleyInsulted flag is exactly one more winning face against a member", () => {
  const plainBuild = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const insultBuild = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    s.combat.parleyInsulted = true;
    return s;
  };
  const without = faceOdds((rng) => foeHitsMember(plainBuild(), rng), { label: "foe-vs-member:insult (baseline)" });
  const withMod = faceOdds((rng) => foeHitsMember(insultBuild(), rng), { label: "foe-vs-member:insult" });
  assert.equal(withMod.n, without.n, "[foe-vs-member:insult] the insult must not change the die size");
  assert.equal(withMod.wins, without.wins + 1, "[foe-vs-member:insult] the insult must be exactly one more winning face");
});

test("[foe-vs-member:foe-accuracy] the FOE_ACCURACY dial — identity is a no-op, a positive value is a strict bonus to the foe", () => {
  const build = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const identity = faceOdds((rng) => foeHitsMember(build(), rng), { label: "foe-vs-member:foe-accuracy (identity)" });
  const bumped = (() => {
    const restore = setDialsForTuning({ FOE_ACCURACY: 1 });
    const result = faceOdds((rng) => foeHitsMember(build(), rng), { label: "foe-vs-member:foe-accuracy (+1)" });
    restore();
    return result;
  })();
  assertBonus(bumped, identity, { label: "foe-vs-member:foe-accuracy" });
});

test("[foe-vs-member:hero-only-terms] the HERO's own Sidestep/Smoke leave a member's own odds unchanged — scope, per foeToHitVs's vs rule", () => {
  const heroEffects = () => {
    const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    startEffect(s.c, "ability:sidestep", { rounds: 2 });
    startEffect(s.c, "ability:smoke", { rounds: 2 });
    return s;
  };
  const plain = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => foeHitsMember(heroEffects(), rng), { label: "foe-vs-member:hero-only-terms" });
  const without = faceOdds((rng) => foeHitsMember(plain(), rng), { label: "foe-vs-member:hero-only-terms (baseline)" });
  assertSame(withMod, without, { label: "foe-vs-member:hero-only-terms" });
});

test(
  '[foe-vs-member:insult-after-member-smoke] the member\'s own Smoke plus insulted should give exactly two faces, like [foe-vs-hero:insult-after-smoke] — engine/combat.js#foeTurn member branch ~L2446-2467 applies insult BEFORE the member\'s own Sidestep/Smoke (72-04 moves it to the end)',
  () => {
    const build = () => {
      const s = memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
      startEffect(s.party[0], "ability:smoke", { rounds: 2 });
      s.combat.parleyInsulted = true;
      return s;
    };
    const result = faceOdds((rng) => foeHitsMember(build(), rng), { label: "foe-vs-member:insult-after-member-smoke" });
    assert.equal(result.wins, 2, "[foe-vs-member:insult-after-member-smoke] insulted-plus-member-smoked must win on exactly two faces");
  },
);

test("[foe-crit-vs-member:natural-best] a landed blow on a member crits on exactly one face", () => {
  const build = () => memberCombatState({ cls: "Fighter", sub: "Soldier", race: "Human" }, { cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const result = faceOdds((rng) => foeCritOnMember(build(), rng), { label: "foe-crit-vs-member:natural-best" });
  assert.equal(result.wins, 1, "[foe-crit-vs-member:natural-best] the member crit window must be exactly one face");
});

// --- Pursuit (a successful flee against a live sp.pursues Spectre) ---------

function pursuitState(extra = {}) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
  inCombat(s, [foeFrom("Demons", 4, "Spectre")], extra);
  return s;
}

test("[pursuit:blind] a blinded pursuer wins on exactly one face", () => {
  const build = () => {
    const s = pursuitState();
    s.combat.foes[0].blind = true;
    return s;
  };
  const result = faceOdds((rng) => pursuitLanded(build(), rng), { isProbe: (i) => i === 1, fill: alwaysMax, label: "pursuit:blind" });
  assert.equal(result.wins, 1, "[pursuit:blind] a blinded pursuer must win on exactly one face");
});

test("[pursuit:weaken] a live Weaken cast is a strict penalty to the pursuer", () => {
  const weakenIdx = SPELLS.findIndex((sp) => sp.n === "Weaken");
  const weakened = () => {
    const s = heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 });
    inCombat(s, [foeFrom("Demons", 4, "Spectre")]);
    s.c.scrollCast = true;
    castSpell(s, weakenIdx, probeRng({ isProbe: () => false, fill: () => 1 }), []);
    return s;
  };
  const plain = () => {
    const s = heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 });
    inCombat(s, [foeFrom("Demons", 4, "Spectre")]);
    return s;
  };
  const opts = { isProbe: (i) => i === 1, fill: alwaysMax };
  const withMod = faceOdds((rng) => pursuitLanded(weakened(), rng), { ...opts, label: "pursuit:weaken" });
  const without = faceOdds((rng) => pursuitLanded(plain(), rng), { ...opts, label: "pursuit:weaken (baseline)" });
  assertPenalty(withMod, without, { label: "pursuit:weaken" });
});

test("[pursuit:insult] a live parleyInsulted flag is exactly one more winning face for the pursuer", () => {
  const opts = { isProbe: (i) => i === 1, fill: alwaysMax };
  const plain = faceOdds((rng) => pursuitLanded(pursuitState(), rng), { ...opts, label: "pursuit:insult (baseline)" });
  const insulted = faceOdds((rng) => pursuitLanded(pursuitState({ parleyInsulted: true }), rng), { ...opts, label: "pursuit:insult" });
  assert.equal(insulted.n, plain.n, "[pursuit:insult] the insult must not change the die size");
  assert.equal(insulted.wins, plain.wins + 1, "[pursuit:insult] the insult must be exactly one more winning face");
});

test("[pursuit:insult-after-blind] a blinded pursuer, insulted, wins on exactly two faces", () => {
  const build = () => {
    const s = pursuitState({ parleyInsulted: true });
    s.combat.foes[0].blind = true;
    return s;
  };
  const result = faceOdds((rng) => pursuitLanded(build(), rng), { isProbe: (i) => i === 1, fill: alwaysMax, label: "pursuit:insult-after-blind" });
  assert.equal(result.wins, 2, "[pursuit:insult-after-blind] a blinded-and-insulted pursuer must win on exactly two faces");
});

// --- Member and ally strikes (roller = the member/ally) ---------------------

function memberStrikeState(memberOpts, foe, { round = 2 } = {}) {
  const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }); // hero identity is inert here — memberToHit reads the MEMBER's own sheet
  const idx = withMember(s, memberOpts);
  const sheet = s.party[idx];
  sheet.abilities = [];
  sheet.spellsUsed = 999; // exhaust any Magic User charges — falls to the plain staff swing
  sheet.weapon = "Club"; // isolate the class/race/sub axis from weapon choice
  s.combat = {
    foes: [foe],
    type: foe.type,
    round,
    target: 0,
    spellOpen: false,
    tracked: false,
    pending: false,
    allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level ?? 1, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }],
  };
  return s;
}

test('[member-strike:class-fighter] a Fighter member hits more easily than an MU member, engine/derived.js#memberToHit', () => {
  const fighter = () => memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const mage = () => memberStrikeState({ cls: "Magic User", sub: "Wizard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => memberLanded(fighter(), rng), { label: "member-strike:class-fighter" });
  const without = faceOdds((rng) => memberLanded(mage(), rng), { label: "member-strike:class-fighter (baseline)" });
  assertBonus(withMod, without, { label: "member-strike:class-fighter" });
});

test("[member-strike:elven] an Elven member floors at 5, engine/derived.js#memberToHit", () => {
  const elven = () => memberStrikeState({ cls: "Magic User", sub: "Wizard", race: "Elven" }, NEUTRAL_FOE());
  const human = () => memberStrikeState({ cls: "Magic User", sub: "Wizard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => memberLanded(elven(), rng), { label: "member-strike:elven" });
  const without = faceOdds((rng) => memberLanded(human(), rng), { label: "member-strike:elven (baseline)" });
  assertBonus(withMod, without, { label: "member-strike:elven" });
});

test("[member-strike:acrobat] an Acrobat member strikes as a fighter, engine/derived.js#memberToHit", () => {
  const acrobat = () => memberStrikeState({ cls: "Thief", sub: "Acrobat", race: "Human" }, NEUTRAL_FOE());
  const pickpocket = () => memberStrikeState({ cls: "Thief", sub: "Pickpocket", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => memberLanded(acrobat(), rng), { label: "member-strike:acrobat" });
  const without = faceOdds((rng) => memberLanded(pickpocket(), rng), { label: "member-strike:acrobat (baseline)" });
  assertBonus(withMod, without, { label: "member-strike:acrobat" });
});

test("[member-strike:cleric] a Cleric member rolls 4, not 3, engine/derived.js#memberToHit", () => {
  const cleric = () => memberStrikeState({ cls: "Magic User", sub: "Cleric", race: "Human" }, NEUTRAL_FOE());
  const plainMU = () => memberStrikeState({ cls: "Magic User", sub: "Wizard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => memberLanded(cleric(), rng), { label: "member-strike:cleric" });
  const without = faceOdds((rng) => memberLanded(plainMU(), rng), { label: "member-strike:cleric (baseline)" });
  assertBonus(withMod, without, { label: "member-strike:cleric" });
});

test("[member-strike:level-die] a level-2 member strikes on a smaller die than a level-1 member, engine/combat.js#memberStrike", () => {
  const lvl2 = () => {
    const s = memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
    s.combat.allies[0].lvl = 2;
    return s;
  };
  const lvl1 = () => memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, NEUTRAL_FOE());
  const withMod = faceOdds((rng) => memberLanded(lvl2(), rng), { label: "member-strike:level-die" });
  const without = faceOdds((rng) => memberLanded(lvl1(), rng), { label: "member-strike:level-die (baseline)" });
  assertBonus(withMod, without, { label: "member-strike:level-die" });
});

test("[ally-strike:ally-level-die] a higher-level summon strikes no worse than a lower-level one, engine/combat.js#allyTurn", () => {
  const highLevel = () => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    inCombat(s, [NEUTRAL_FOE()], { ally: { name: "A tall grey silence", lvl: 3, rounds: 5 } });
    return s;
  };
  const lowLevel = () => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    inCombat(s, [NEUTRAL_FOE()], { ally: { name: "A tall grey silence", lvl: 1, rounds: 5 } });
    return s;
  };
  const withMod = faceOdds((rng) => allyLanded(highLevel(), rng), { label: "ally-strike:ally-level-die" });
  const without = faceOdds((rng) => allyLanded(lowLevel(), rng), { label: "ally-strike:ally-level-die (baseline)" });
  assertBonus(withMod, without, { strict: false, label: "ally-strike:ally-level-die" });
});

// --- Skeleton shatter (PENDING, 72-06) --------------------------------------
//
// "Rolling max on your dice triggers the shatter" (user ruling 2026-09-24):
// any to-hit roll against a Skeleton that shows its die's own best face
// destroys it outright, including its second (kill-twice) life. Today the
// engine has no such rule — a best-face roll just lands an ordinary hit — so
// every row below is RED: `wins` is asserted at 1 (the post-fix claim), but
// today's engine lands the SAME ordinary hit on several faces and never
// actually shatters the Skeleton in one call. wp is set high enough that no
// single ordinary hit is ever lethal on its own, so a wins > 1 reading below
// would mean "landed a hit", never "shattered it".

function skeletonFoe(wp = 60) {
  return foeFrom("Walking Dead", 2, "Skeleton", { wp });
}

test('[shatter:hero-strike] "a 1 shatters it" — the hero\'s own strike, content/bestiary.js:151', { todo: "fixed by 72-06" }, () => {
  const build = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      playerStrike(s, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:hero-strike" },
  );
  assert.equal(result.wins, 1, "[shatter:hero-strike] only the best face may shatter the Skeleton in one strike");
});

test('[shatter:hero-strike-second-life] the shatter also destroys the SECOND (kill-twice) life outright', { todo: "fixed by 72-06" }, () => {
  const build = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [skeletonFoe()]));
    s.combat.foes[0].lives = 1; // already on its last life
    return s;
  };
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      playerStrike(s, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:hero-strike-second-life" },
  );
  assert.equal(result.wins, 1, "[shatter:hero-strike-second-life] only the best face may shatter the Skeleton's last life outright");
});

test("[shatter:member-strike] a party member's own strike can shatter the Skeleton", { todo: "fixed by 72-06" }, () => {
  const build = () => memberStrikeState({ cls: "Fighter", sub: "Guard", race: "Human" }, skeletonFoe());
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      alliesTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:member-strike" },
  );
  assert.equal(result.wins, 1, "[shatter:member-strike] only the best face may shatter the Skeleton");
});

test("[shatter:ally-strike] a summoned ally's own strike can shatter the Skeleton", { todo: "fixed by 72-06" }, () => {
  const build = () => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    inCombat(s, [skeletonFoe()], { ally: { name: "A tall grey silence", lvl: 3, rounds: 5 } });
    return s;
  };
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      allyTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:ally-strike" },
  );
  assert.equal(result.wins, 1, "[shatter:ally-strike] only the best face may shatter the Skeleton");
});

test('[shatter:thrown] the hero\'s thrown attack spell (Fireball) can shatter the Skeleton', { todo: "fixed by 72-06" }, () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const build = () => {
    const s = heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 });
    inCombat(s, [skeletonFoe()]);
    s.c.scrollCast = true;
    return s;
  };
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      castSpell(s, fireballIdx, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:thrown" },
  );
  assert.equal(result.wins, 1, "[shatter:thrown] only the best face may shatter the Skeleton");
});

test('[shatter:ally-thrown] a Magic User party member\'s own thrown spell can shatter the Skeleton', { todo: "fixed by 72-06" }, () => {
  const build = () => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    const idx = withMember(s, { cls: "Magic User", sub: "Wizard", race: "Human" });
    const sheet = s.party[idx];
    sheet.abilities = [];
    sheet.level = 5;
    sheet.grimoire = ["Fireball"];
    sheet.spellsUsed = 0;
    const foe = skeletonFoe();
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
  };
  const result = faceOdds(
    (rng) => {
      const s = build();
      const foe = s.combat.foes[0];
      alliesTurn(s, rng, []);
      return foe.alive === false;
    },
    { label: "shatter:ally-thrown" },
  );
  assert.equal(result.wins, 1, "[shatter:ally-thrown] only the best face may shatter the Skeleton");
});
