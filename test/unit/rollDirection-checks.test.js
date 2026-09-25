// test/unit/rollDirection-checks.test.js
//
// Phase 72-03 (ROLL-01) — the NON-COMBAT half of the roll-direction audit's
// direction test: soak (both ways), thrown spells (hero and member),
// resistance, initiative, flee, parley, traps, locks, climbs, leaps, cures,
// wake and drops. Uses the SAME shared odds harness 72-02 built
// (test/unit/harness/rollOdds.js) — see that file's header for the two
// load-bearing contracts (odds-only, no roll-convention number ever
// written) — Phase 73's roll-high mirror MUST be able to run this file
// UNCHANGED, exactly like test/unit/rollDirection.test.js.
//
// Rows run under the SHIPPED DIALS (engine/difficulty.js's fitted values,
// not identity) unless a row explicitly probes a dial itself via
// setDialsForTuning and restores the shipped DIALS afterward.
//
// One row is PENDING (node:test's `todo` option, naming the fixing plan):
// [parley:parley-need-mod] — PARLEY_NEED_MOD is documented "up = harder" but
// today it is ADDED to a roll-under need, making parley EASIER (finding
// F5). 72-07 fixes the sign; this row's only required edit there is
// deleting the `todo` option. Every other row passes today.

import test from "node:test";
import assert from "node:assert/strict";

import {
  probeRng,
  faceOdds,
  jointOdds,
  assertBonus,
  assertPenalty,
  assertSame,
  heroState,
  foeFrom,
  inCombat,
  withMember,
  armorFrom,
} from "./harness/rollOdds.js";

import { playerStrike, foeTurn, flee, parley, killFoe, resolveInitiative, alliesTurn } from "../../engine/combat.js";
import { castSpell } from "../../engine/magic.js";
import { startEffect } from "../../engine/effects.js";
import { setDialsForTuning, DIALS } from "../../engine/difficulty.js";
import { resistRoll } from "../../engine/derived.js";
import { springTrap, openChest } from "../../engine/encounters.js";
import { move, newDay } from "../../engine/movement.js";
import { SPELLS } from "../../content/index.js";

// ---------------------------------------------------------------------------
// Module-private helpers. Every one reads only EVENT TYPES and OUTCOME
// FLAGS (never a need/roll/target/dieN field), per the harness's odds
// contract.
// ---------------------------------------------------------------------------

/** heroSoaked(state, rng) — the foe's swing at the hero was absorbed by the
 * hero's own armour (engine/combat.js#applyFoeDamageToPlayer). */
function heroSoaked(state, rng) {
  const events = [];
  foeTurn(state, rng, events);
  return events.some((e) => e.type === "armorSoaked");
}

/** foeSoaked(state, rng) — the hero's landed strike was absorbed by the
 * foe's own natural armour (engine/foeDamage.js#damageFoe). */
function foeSoaked(state, rng) {
  const events = [];
  playerStrike(state, rng, events);
  return events.some((e) => e.type === "foeArmorSoaked");
}

/** firstIsYou(state, rng) — the hero won initiative this fight. */
function firstIsYou(state, rng) {
  return resolveInitiative(state, rng)?.first === "you";
}

/** fled(state, rng) — the hero's flee roll succeeded. */
function fled(state, rng) {
  const events = [];
  flee(state, rng, events);
  return events.some((e) => e.type === "fled");
}

/** parleySucceeded(state, rng) — the hero talked the encounter down. */
function parleySucceeded(state, rng) {
  const events = [];
  parley(state, rng, events);
  return events.some((e) => e.type === "spGained" && e.reason === "parley");
}

/** trapAvoided(state, rng) — the hero dodged a sprung trap. */
function trapAvoided(state, rng) {
  const events = [];
  springTrap(state, rng, events);
  return events.some((e) => e.type === "trapAvoided");
}

/** lockOpened(state, rng) — a rolled (non-Pilfer) lock roll succeeded. */
function lockOpened(state, rng) {
  const events = [];
  openChest(state, rng, events);
  const rec = events.find((e) => e.type === "chestLockRolled");
  return !!(rec && rec.opened);
}

/** climbedClean(state, rng) — every probed climb segment passed. */
function climbedClean(state, rng) {
  const events = [];
  move(state, "E", rng, events);
  return events.some((e) => e.type === "climbedOver");
}

/** leapedClean(state, rng) — the leap roll passed. */
function leapedClean(state, rng) {
  const events = [];
  move(state, "E", rng, events);
  return events.some((e) => e.type === "leaptOver");
}

/** afflictionCured(state, rng) — the night's rest cure roll succeeded. */
function afflictionCured(state, rng) {
  const events = [];
  newDay(state, false, rng, events);
  return events.some((e) => e.type === "afflictionCured");
}

/** wanderTriggered(state, rng) — the probed hourly wake draw woke the party. */
function wanderTriggered(state, rng) {
  const events = [];
  newDay(state, false, rng, events);
  return events.some((e) => e.type === "wanderingMonster");
}

/** lootDropped(state, rng) — killFoe offered a loot drop. */
function lootDropped(state, rng) {
  const events = [];
  killFoe(state, state.combat.foes[0], rng, events);
  return events.some((e) => e.type === "lootDropped");
}

/** withArmor(state, name) — equips a real content/armors.js#ARMORS row the
 * same way engine/items.js#takeItem's armor branch does (armor/ar/armorMin/
 * armorMax/armorWP), never a hand-typed roll-convention number. */
function withArmor(state, name) {
  const armor = armorFrom(name);
  state.c.armor = armor.name;
  state.c.ar = armor.ar;
  state.c.armorMin = armor.min;
  state.c.armorMax = armor.wp;
  state.c.armorWP = armor.wp;
  return state;
}

/** noArmor(state) — the "Nothing" baseline every armor-bulk/soak comparison
 * row starts from, so chargen's own randomly-rolled starting armor never
 * confounds a row that isn't itself testing armor. */
function noArmor(state) {
  state.c.armor = "Nothing";
  state.c.ar = 0;
  state.c.armorMin = 0;
  state.c.armorMax = 0;
  state.c.armorWP = 0;
  return state;
}

/** withClub(state) — pins the hero's weapon to Club and clears the
 * chargen-random skill/spell state that could silently fold a second draw
 * into a row expecting exactly one — the same helper
 * test/unit/rollDirection.test.js uses, copied here (module-private, no
 * shared export) so this file's own imports stay self-contained. */
function withClub(state) {
  state.c.weapon = "Club";
  state.c.magicWpn = 0;
  state.c.prof = 0;
  state.c.spellsUsed = 999;
  state.c.skills = {};
  return state;
}

// Ned (Humans tier 1) — the plainest possible foe: no `sp.atk` multiplier, no
// `abilities` kit, no `sp.dmg`/`sp.ar`. Same rationale as
// test/unit/rollDirection.test.js's own NEUTRAL_FOE.
const NEUTRAL_FOE = () => foeFrom("Humans", 1, "Ned");

// =============================================================================
// TASK 1 — soak (both ways), thrown spells (hero and member), resistance,
// initiative.
// =============================================================================

// --- Hero armor soak [the hero wants the soak]: armorSoaked -----------------

test('[hero-soak:armor-ar] a higher-AR ARMORS row soaks more often, engine/derived.js#armorSoak ~L742', () => {
  const build = (armorName) => withArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]), armorName);
  const withMod = faceOdds((rng) => heroSoaked(build("Mail"), rng), { isProbe: (i) => i === 2, label: "hero-soak:armor-ar (Mail, ar12)" });
  const without = faceOdds((rng) => heroSoaked(build("Leather"), rng), { isProbe: (i) => i === 2, label: "hero-soak:armor-ar (Leather, ar6)" });
  assertBonus(withMod, without, { label: "hero-soak:armor-ar" });
});

test('[hero-soak:cloak-of-armor] a live Cloak of Armor effect soaks like plate over a light armor, engine/derived.js#armorSoak ~L749', () => {
  const build = (withCloak) => {
    const s = withArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]), "Cloth");
    if (withCloak) startEffect(s.c, "item:Cloak of Armor", { rounds: 50 });
    return s;
  };
  const withMod = faceOdds((rng) => heroSoaked(build(true), rng), { isProbe: (i) => i === 2, label: "hero-soak:cloak-of-armor" });
  const without = faceOdds((rng) => heroSoaked(build(false), rng), { isProbe: (i) => i === 2, label: "hero-soak:cloak-of-armor (baseline)" });
  assertBonus(withMod, without, { label: "hero-soak:cloak-of-armor" });
});

test('[hero-soak:taunt] "your armour soaks double" while Taunt is active, engine/combat.js#applyFoeDamageToPlayer ~L2167', () => {
  const build = (withTaunt) => {
    const s = withArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]), "Leather");
    if (withTaunt) startEffect(s.c, "ability:taunt", { rounds: 2 });
    return s;
  };
  const withMod = faceOdds((rng) => heroSoaked(build(true), rng), { isProbe: (i) => i === 2, label: "hero-soak:taunt" });
  const without = faceOdds((rng) => heroSoaked(build(false), rng), { isProbe: (i) => i === 2, label: "hero-soak:taunt (baseline)" });
  assertBonus(withMod, without, { label: "hero-soak:taunt" });
});

test('[hero-soak:fighter-armor-mul] CLASS_MITIGATION.Fighter.armorMul — identity a no-op, a Fighter bonus, a non-Fighter unaffected, engine/difficulty.js#classArmorMulFor', () => {
  const withMul = (mul) => setDialsForTuning({ CLASS_MITIGATION: { Fighter: { hpMul: 1, armorMul: mul, killSpeed: 1 } } });
  const fighter = () => withArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]), "Leather");
  const thief = () => withArmor(inCombat(heroState({ cls: "Thief", sub: "Pickpocket", race: "Human" }), [NEUTRAL_FOE()]), "Leather");

  const fighterIdentity = faceOdds((rng) => heroSoaked(fighter(), rng), { isProbe: (i) => i === 2, label: "hero-soak:fighter-armor-mul (Fighter identity)" });
  const fighterIdentityExplicit = (() => {
    const restore = withMul(1);
    const result = faceOdds((rng) => heroSoaked(fighter(), rng), { isProbe: (i) => i === 2, label: "hero-soak:fighter-armor-mul (Fighter identity, explicit)" });
    restore();
    return result;
  })();
  assertSame(fighterIdentityExplicit, fighterIdentity, { label: "hero-soak:fighter-armor-mul (identity is a no-op)" });

  const fighterBumped = (() => {
    const restore = withMul(2);
    const result = faceOdds((rng) => heroSoaked(fighter(), rng), { isProbe: (i) => i === 2, label: "hero-soak:fighter-armor-mul (Fighter x2)" });
    restore();
    return result;
  })();
  assertBonus(fighterBumped, fighterIdentity, { label: "hero-soak:fighter-armor-mul (Fighter)" });

  const thiefIdentity = faceOdds((rng) => heroSoaked(thief(), rng), { isProbe: (i) => i === 2, label: "hero-soak:fighter-armor-mul (Thief identity)" });
  const thiefBumped = (() => {
    const restore = withMul(2);
    const result = faceOdds((rng) => heroSoaked(thief(), rng), { isProbe: (i) => i === 2, label: "hero-soak:fighter-armor-mul (Thief x2)" });
    restore();
    return result;
  })();
  assertSame(thiefBumped, thiefIdentity, { label: "hero-soak:fighter-armor-mul (Thief, no-op)" });
});

test('[hero-soak:no-armor-foe] a noArmor foe (Flube) is never soaked; the soak d20 is never requested', () => {
  const build = () => withArmor(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Beasts", 3, "Flube")]), "Mail");
  assert.throws(() => faceOdds((rng) => heroSoaked(build(), rng), { isProbe: (i) => i === 2, label: "hero-soak:no-armor-foe" }));
  const events = [];
  foeTurn(build(), probeRng({ isProbe: () => false }), events);
  assert.ok(!events.some((e) => e.type === "armorSoaked"), "[hero-soak:no-armor-foe] a noArmor foe must never trigger the hero's armor soak");
});

// --- Foe natural soak [the foe wants the soak]: foeArmorSoaked ---------------

test('[foe-soak:natural-ar] a higher sp.ar foe soaks the hero\'s strike more often (Google ar15 vs Drat ar12), engine/foeDamage.js#damageFoe ~L96', () => {
  const higher = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Walking Dead", 2, "Google")]));
  const lower = () => withClub(inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [foeFrom("Beasts", 3, "Drat")]));
  const withMod = faceOdds((rng) => foeSoaked(higher(), rng), { isProbe: (i) => i === 2, label: "foe-soak:natural-ar (Google ar15)" });
  const without = faceOdds((rng) => foeSoaked(lower(), rng), { isProbe: (i) => i === 2, label: "foe-soak:natural-ar (Drat ar12)" });
  assertBonus(withMod, without, { label: "foe-soak:natural-ar" });
});

test('[foe-soak:crit-bypass] a hero critical is never soaked by natural armor, engine/foeDamage.js#damageFoe ~L96', () => {
  // A forced crit (silentStep) against a natural-ar foe (Google, ar15).
  // `damageFoe`'s soak gate is `physical && !source.crit && ...`, so the
  // ONLY event this strike itself can push for the blow is `struck` — the
  // seam's own soak draw is never reached. (`afterPlayerAction`'s own
  // foeTurn tail runs afterward and CAN draw further armor-soak rolls of
  // its own — a separate mechanic, `armorSoaked` not `foeArmorSoaked` —
  // which is why this row checks the event type directly rather than
  // through the vacuous-probe pattern the other soak rows use.)
  const build = () => {
    const s = withClub(inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [foeFrom("Walking Dead", 2, "Google")]));
    s.combat.opened = true;
    s.combat.opened2 = true;
    s.combat.abilityStrike = { key: "silentStep", autoHit: true, forceCrit: true };
    return s;
  };
  const events = [];
  playerStrike(build(), probeRng({ isProbe: () => false }), events);
  assert.ok(events.some((e) => e.type === "struck" && e.critical), "[foe-soak:crit-bypass] the forced strike must land as a critical");
  assert.ok(!events.some((e) => e.type === "foeArmorSoaked"), "[foe-soak:crit-bypass] a critical hit must never be absorbed by natural armor");
});

// --- Thrown [hero]: spellHit --------------------------------------------------

test('[thrown:school-bonus] "the offensive bonus from the subclass chart" — Warlock 4 vs Illusionist 0, content/mu-chart.js, engine/magic.js#castSpell ~L480', () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const cast = (sub) => (rng) => {
    const s = inCombat(heroState({ cls: "Magic User", sub, race: "Human", level: 5 }), [NEUTRAL_FOE()]);
    s.c.scrollCast = true; // bypass the grimoire/level/school gate — testing the EFFECT, not chargen
    const events = [];
    castSpell(s, fireballIdx, rng, events);
    return events.some((e) => e.type === "spellHit");
  };
  const withMod = faceOdds(cast("Warlock"), { label: "thrown:school-bonus (Warlock)" });
  const without = faceOdds(cast("Illusionist"), { label: "thrown:school-bonus (Illusionist)" });
  assertBonus(withMod, without, { label: "thrown:school-bonus" });
});

test('[thrown:afraid] a live combat.afraid shrinks the thrown-spell target, engine/magic.js#castSpell ~L499-504', () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const cast = (afraid) => (rng) => {
    const s = inCombat(heroState({ cls: "Magic User", sub: "Wizard", race: "Human", level: 5 }), [NEUTRAL_FOE()], afraid ? { afraid: 2 } : {});
    s.c.scrollCast = true;
    const events = [];
    castSpell(s, fireballIdx, rng, events);
    return events.some((e) => e.type === "spellHit");
  };
  const withMod = faceOdds(cast(true), { label: "thrown:afraid" });
  const without = faceOdds(cast(false), { label: "thrown:afraid (baseline)" });
  assertPenalty(withMod, without, { label: "thrown:afraid" });
});

test('[ally-thrown:school-bonus] a Magic User member throws with its OWN subclass bonus, engine/combat.js#allyCast ~L1883', () => {
  const fireballIdx = SPELLS.findIndex((sp) => sp.n === "Fireball");
  const cast = (sub) => (rng) => {
    const s = heroState({ cls: "Fighter", sub: "Soldier", race: "Human" });
    const idx = withMember(s, { cls: "Magic User", sub, race: "Human" });
    const sheet = s.party[idx];
    sheet.level = 5;
    sheet.grimoire = ["Fireball"];
    sheet.spellsUsed = 0;
    inCombat(s, [NEUTRAL_FOE()], { allies: [{ partyIdx: idx, name: sheet.name, lvl: sheet.level, sub: sheet.sub, wp: sheet.wp, maxWP: sheet.maxWP }] });
    const events = [];
    alliesTurn(s, rng, events);
    return events.some((e) => e.type === "allySpellHit");
  };
  const withMod = faceOdds(cast("Warlock"), { label: "ally-thrown:school-bonus (Warlock)" });
  const without = faceOdds(cast("Illusionist"), { label: "ally-thrown:school-bonus (Illusionist)" });
  assertBonus(withMod, without, { label: "ally-thrown:school-bonus" });
});

// --- Resist [the resistor] ----------------------------------------------------

test('[resist:intel] a higher intel resists more often — a stat, not a threshold, engine/derived.js#resistRoll ~L1427', () => {
  const withMod = faceOdds((rng) => resistRoll(rng, 18).resisted, { label: "resist:intel (18)" });
  const without = faceOdds((rng) => resistRoll(rng, 12).resisted, { label: "resist:intel (12)" });
  assertBonus(withMod, without, { label: "resist:intel" });
});

test('[resist:intel-gate] intel < 12 never rolls and never resists, engine/derived.js#resistRoll ~L1428', () => {
  assert.throws(() => faceOdds((rng) => resistRoll(rng, 11).resisted, { label: "resist:intel-gate" }));
});

// --- Initiative [hero]: jointOdds over the two d20s; success = first === "you" ---

test('[initiative:samurai] "never wins the first roll of anything" (content/flavor.js:46) — forced foe-first, engine/combat.js#resolveInitiative ~L183', () => {
  const samurai = () => inCombat(heroState({ cls: "Fighter", sub: "Samurai", race: "Human" }), [NEUTRAL_FOE()]);
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(samurai(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:samurai" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:samurai (baseline)" });
  assert.equal(withMod.wins, 0, "[initiative:samurai] a Samurai must never win initiative");
  assertPenalty(withMod, without, { label: "initiative:samurai" });
});

test('[initiative:fridgian-slow] a Fridgian "strikes last" — forced foe-first, engine/combat.js#resolveInitiative ~L184', () => {
  const fridgian = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Fridgian" }), [NEUTRAL_FOE()]);
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(fridgian(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:fridgian-slow" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:fridgian-slow (baseline)" });
  assert.equal(withMod.wins, 0, "[initiative:fridgian-slow] a Fridgian must never win initiative");
  assertPenalty(withMod, without, { label: "initiative:fridgian-slow" });
});

test('[initiative:knight-big-foe] "everything over 20 comes straight at you" — forced foe-first, engine/combat.js#knightFacesBigFoe', () => {
  const knightBig = () => inCombat(heroState({ cls: "Fighter", sub: "Knight", race: "Human" }), [foeFrom("Humans", 1, "Ned", { wp: 25 })]);
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(knightBig(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:knight-big-foe" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:knight-big-foe (baseline)" });
  assert.equal(withMod.wins, 0, "[initiative:knight-big-foe] a Knight facing a big foe must never win initiative");
  assertPenalty(withMod, without, { label: "initiative:knight-big-foe" });
});

test('[initiative:court-mage] "everyone else gets there first" (content/flavor.js:61) — forced foe-first in round 1, engine/combat.js#resolveInitiative ~L186', () => {
  const courtMage = () => inCombat(heroState({ cls: "Magic User", sub: "Court Mage", race: "Human" }), [NEUTRAL_FOE()]);
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(courtMage(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:court-mage" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:court-mage (baseline)" });
  assert.equal(withMod.wins, 0, "[initiative:court-mage] a Court Mage must never win round-1 initiative");
  assertPenalty(withMod, without, { label: "initiative:court-mage" });
});

test('[initiative:foresight] c.foresight forces "you" — a strict bonus, engine/combat.js#resolveInitiative ~L188', () => {
  const foreseen = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    s.c.foresight = true;
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(foreseen(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:foresight" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:foresight (baseline)" });
  const { wins, total } = withMod;
  assert.equal(wins, total, "[initiative:foresight] a foreseen hero must win initiative on every combination");
  assertBonus(withMod, without, { label: "initiative:foresight" });
});

test('[initiative:acute-hearing] the Acute Hearing skill forces "you" — a strict bonus, engine/combat.js#resolveInitiative ~L189', () => {
  const acute = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
    s.c.skills["Acute Hearing"] = 1;
    return s;
  };
  const plain = () => inCombat(heroState({ cls: "Fighter", sub: "Soldier", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(acute(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:acute-hearing" });
  const without = jointOdds((rng) => firstIsYou(plain(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:acute-hearing (baseline)" });
  const { wins, total } = withMod;
  assert.equal(wins, total, "[initiative:acute-hearing] Acute Hearing must win initiative on every combination");
  assertBonus(withMod, without, { label: "initiative:acute-hearing" });
});

test('[initiative:senses] c.senses waives every forced-foe rule, engine/combat.js#resolveInitiative ~L150', () => {
  const withSenses = () => {
    const s = inCombat(heroState({ cls: "Fighter", sub: "Samurai", race: "Human" }), [NEUTRAL_FOE()]);
    s.c.senses = 1;
    return s;
  };
  const withoutSenses = () => inCombat(heroState({ cls: "Fighter", sub: "Samurai", race: "Human" }), [NEUTRAL_FOE()]);
  const withMod = jointOdds((rng) => firstIsYou(withSenses(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:senses" });
  const without = jointOdds((rng) => firstIsYou(withoutSenses(), rng), { isProbeA: (i) => i === 0, isProbeB: (i) => i === 1, label: "initiative:senses (baseline)" });
  assert.equal(without.wins, 0, "[initiative:senses] the baseline forced-foe Samurai must never win initiative");
  assertBonus(withMod, without, { label: "initiative:senses" });
});
