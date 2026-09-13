// engine/combat.js
//
// The combat domain (ENG-01, ENG-05) — the heaviest rule domain in the maze.
// Ports mazeworld.html's encounter setup, initiative, player strikes, kills,
// foe turns, allies, and the flee/parley/sing exits (lines 2257-2903),
// replacing every D()/pick()-backed Math.random() draw with the injected
// engine rng (in the prototype's exact consumption order — including its
// short-circuiting ternary re-rolls) and every say()/evt() narration call
// with a pushed `{type, ...}` event. No DOM, no localStorage, no Math.random,
// no global S — every function here takes an explicit `state` (already a
// fresh applyAction clone) and mutates it directly, matching the applyAction
// seam.
//
// castSpell (magic) is its own rule domain and is intentionally NOT ported
// here — Wizard's spell-refusal check and the "magic user in combat" gates
// are preserved verbatim (they read `c.spellsUsed`/`maxCharges`, which exist
// on every character regardless of whether a spell has ever been cast), but
// no spell effect itself (ward/regen/mirror/weaken/etc.) is SET by anything
// in this module — those fields simply stay at their rollCharacter defaults
// until a later magic-domain plan lands castSpell. foeTurn/playerStrike still
// faithfully READ them (c.ward, c.regen, c.mirror, C.weakened,
// C.foeToHitPenalty) so combat is correct once magic lands, without this
// plan needing to implement magic itself.
//
// Most BESTIARY creature `sp.*` flags (poison/disease/steals/enthrall/awe/
// grapple/entangle/possess/raise/shriek/quills/ar/critOn/loot/song/pack/
// slow/halfDmg/age/pursues/seesInvis/noTurn/never_melee/dark/daggerOnly/
// caster/breaks/every, etc.) are flavor-only in the frozen prototype — grep
// confirms none of them are ever read anywhere in mazeworld.html's live
// logic (only `sp.note` feeds the UI). Only `sp.atk`, `sp.dmg`, `sp.toHit`,
// `sp.fast`, `sp.magicOnly`, `sp.noArmor`, and `sp.twice` (via `lives`) have
// any mechanical effect, and this module implements exactly those, matching
// the prototype's ACTUAL behavior rather than the aspirational flavor text
// (fidelity rule: port what the prototype DOES, not what its comments imply).

import { skill, eff, strikeDie, toHit, weaponDamage, foeDie, foeToHitVs, inDark, armorSoak } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { checkLevel } from "./character.js";
import { takeItem, gainWilmst, rollTreasureItem, LOOT_DIVISOR } from "./items.js";
import { maxCharges } from "./movement.js";
import { BESTIARY, ENC_TYPES, RACES, WEAPON_MAX, STRIKE_DICE } from "../content/index.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const TALKATIVE = ["Humans", "Demons", "Lair Beasts", "Beasts"];

// The Bard's song bank (mazeworld.html lines 2736-2742). Not yet extracted to
// content/*.js (nothing else in the engine needs it) — kept local, pure data.
const SONGS = [
  { lvl: 1, n: "Soothe the Savage", txt: "calms beasts" },
  { lvl: 2, n: "Inspire the Heart", txt: "+1 to hit this fight" },
  { lvl: 3, n: "Lullaby", txt: "d6 foes sleep" },
  { lvl: 4, n: "Cry of Thunder", txt: "d12 foes frozen d8 rounds" },
  { lvl: 5, n: "An Ode to Death", txt: "equals reduced to 1 wp" },
];

/** liveFoes(state) — the still-standing foes in the current encounter. */
export function liveFoes(state) {
  return state.combat ? state.combat.foes.filter((f) => f.alive) : [];
}

/**
 * rollInitiative(state, rng) — a fresh d20 each side; a Samurai/Fridgian is
 * last unless foreseen; foresight/Acute Hearing move first. Ports
 * mazeworld.html rollInitiative() (lines 2317-2327), minus its narration
 * string (a presentation concern — see the module header).
 */
export function rollInitiative(state, rng) {
  const C = state.combat;
  if (!C) return undefined;
  const c = state.c;
  const R = RACES[c.race];
  const mine = rng.d(20);
  const theirs = rng.d(20);
  const samurai = c.sub === "Samurai";
  const slow = !!R.slow;
  const foreseen = c.foresight;
  c.foresight = false;
  C.first =
    (samurai || slow) && !foreseen
      ? "foe"
      : foreseen || skill(c, "Acute Hearing")
        ? "you"
        : mine >= theirs
          ? "you"
          : "foe";
  return C.first;
}

/**
 * startCombat(state, wandering, forced, rng, events) — builds `state.combat`
 * from the BESTIARY: encounter type, level-scaled foe count/roster, Tracking,
 * Warlock's walking-dead boost, Knight/Con Artist/Court Mage foe removals,
 * phobia freeze, ally join, and first-move via rollInitiative. Ports
 * mazeworld.html startCombat() (lines 2257-2315).
 */
export function startCombat(state, wandering, forced, rng, events = []) {
  const c = state.c;
  const type = forced || rng.pick(ENC_TYPES);
  let tracked = false;
  if (skill(c, "Tracking")) {
    const r = rng.d(20);
    tracked = r <= 5;
    events.push({ type: "trackingRolled", roll: r, tracked });
  }
  const maxLvl = clamp(Math.min(c.level, state.floor.depth), 1, 5);
  // a level I delver never faces a mob; the maze scales up as you do
  const cap = c.level <= 2 ? 2 : 3;
  // NOTE: this ternary chain can consume ONE or TWO d4 rolls, exactly like
  // the prototype's `D(4) <= 2 ? 1 : D(4) <= 3 ? 2 : 3` — the second D(4) is
  // only rolled if the first roll was > 2. Preserve the short-circuit shape
  // verbatim; do not hoist to a single pre-rolled value.
  const n = wandering ? 1 : Math.min(cap, rng.d(4) <= 2 ? 1 : rng.d(4) <= 3 ? 2 : 3);
  const foes = [];
  for (let i = 0; i < n; i++) {
    const lvl = clamp(maxLvl - (rng.d(4) === 1 ? 1 : 0), 1, 5);
    // LO-02: no `||` fallback needed here — `lvl` is always clamped to
    // [1,5] above, and every BESTIARY category has exactly 5 tiers
    // (confirmed by 01-VERIFICATION.md's creature count audit), so
    // BESTIARY[type][lvl - 1] can never be undefined.
    const roster = BESTIARY[type][lvl - 1];
    const picked = rng.pick(roster);
    foes.push({
      name: picked.n,
      type,
      lvl,
      size: picked.sz,
      intel: picked.i,
      wp: picked.wp,
      maxWP: picked.wp,
      alive: true,
      asleep: 0,
      sp: picked.sp || {},
      lives: picked.sp && picked.sp.twice ? 2 : 1,
    });
  }
  state.combat = { foes, type, round: 1, target: 0, spellOpen: false, tracked };
  const first = rollInitiative(state, rng);
  const R = RACES[c.race];
  events.push({
    type: "encounterStarted",
    wandering: !!wandering,
    combatType: type,
    // DELIBERATE RULES CHANGE (audit-bugs, 2026-09-09, E4): additive field —
    // this event previously mapped foes to {name, lvl, wp} only, dropping
    // maxWP. Nothing in the live render path was actually found to depend on
    // this event for its foe hp display (mazeworld.html's renderEncounter
    // reads state.combat.foes directly, which always carries the real,
    // stable starting maxWP), but a foe's starting hp is exactly the kind of
    // value a narration/summary consumer would reasonably expect this event
    // to carry, and dropping it silently is a footgun for any future
    // consumer (e.g. a combat-start toast/report) that reads this event
    // instead of live state. Safe/additive: no existing event-shape
    // assertion pins this array to exactly {name, lvl, wp}.
    foes: foes.map((f) => ({ name: f.name, lvl: f.lvl, wp: f.wp, maxWP: f.maxWP })),
    first,
    samuraiNeverFirst: c.sub === "Samurai",
    fridgianSlow: !!R.slow,
    acuteHearing: skill(c, "Acute Hearing"),
  });
  if (tracked) events.push({ type: "trackable" });
  if (c.pendingAlly) {
    state.combat.ally = c.pendingAlly;
    c.pendingAlly = null;
    events.push({ type: "allyJoined", name: state.combat.ally.name });
  }

  // PARTY-03/PARTY-04 (Phase 8): sync the persistent roster (state.party) into
  // a COMBAT-SCOPED C.allies list, exactly the way `c.pendingAlly → C.ally`
  // hands the summon into combat just above. Each entry MIRRORS a persistent
  // member (its own in-fight `wp` this fight) and back-references it via
  // `partyIdx` so endCombat can sync surviving hp out and drop the downed.
  //
  // DETERMINISM GATE (the dominant constraint): this is a pure data copy — it
  // draws ZERO rng — and, critically, the `state.combat.allies` KEY is only
  // ever ADDED when `state.party?.length` is truthy. An empty party (every
  // parity fixture) leaves `state.combat` WITHOUT an `allies` field at all, so
  // the combat object stays byte-identical to the frozen master and never
  // reaches a compared-field mismatch (mirrors the null-`C.ally` precedent:
  // absent, not empty). All downstream party rng draws (alliesTurn, foeTurn
  // target selection, killFoe split) are likewise gated on `C.allies`.
  if (state.party?.length) {
    state.combat.allies = state.party.map((m, i) => ({
      partyIdx: i,
      name: m.name,
      lvl: clamp(m.level ?? m.lvl ?? 1, 1, 5),
      sub: m.sub,
      wp: m.wp,
      maxWP: m.maxWP ?? m.wp,
    }));
  }

  // a Warlock props up every walking dead thing in the room, whether he means
  // to or not
  if (c.sub === "Warlock" && type === "Walking Dead") {
    const boost = c.level;
    foes.forEach((f) => {
      f.wp += boost;
      f.maxWP += boost;
    });
    events.push({ type: "warlockBoost", amount: boost });
  }

  // a Knight is beneath the notice of small things; a Con Artist is not
  // worth the trouble
  for (const f of foes.slice()) {
    if (c.sub === "Knight" && f.maxWP < 5) {
      f.alive = false;
      f.fled = true;
      events.push({ type: "foeFled", name: f.name, reason: "knight" });
    } else if (c.sub === "Con Artist" && f.lvl <= 1 && rng.d(6) <= 4) {
      f.alive = false;
      f.fled = true;
      events.push({ type: "foeFled", name: f.name, reason: "conArtist" });
    } else if (c.sub === "Court Mage" && rng.d(12) === 1) {
      f.lives = 1;
      events.push({ type: "foeBored", name: f.name });
      killFoe(state, f, rng, events);
    }
  }
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    state.combat = null;
    return events;
  }

  // DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): the Darkness
  // phobia (`c.phobia === "Darkness"`) has `phobiaType: null` in the
  // PHOBIAS catalog (content/flavor.js) — it was one of the 6 phobias with
  // NO game effect (04.1-RESEARCH.md's Phobias audit). Generalized the
  // existing type-matched freeze condition to ALSO trigger when the
  // character is Darkness-phobic AND inDark(state) is true at encounter
  // start (reusing Task 1's persistent-darkness-aware inDark), reusing the
  // exact same frozen/shookOffFrozen seam and Hardiness-halved mitigation
  // the 5 type-matched phobias already use. The two conditions are
  // mutually exclusive per character (Darkness's phobiaType is always
  // null, so a Darkness-phobic character never also carries a
  // type-matched phobiaType), so this never double-triggers or
  // double-rolls Hardiness for a single character. Because the left side
  // of the `&&` short-circuits, rng.d(2) is drawn ONLY when one of the two
  // conditions is already true AND the character has Hardiness — never for
  // a non-phobic or non-triggered character, and never during chargen — so
  // RNG consumption order is unchanged for everyone else.
  //
  // DELIBERATE RULES CHANGE (04.1-06, 2026-09-09, PHOBIA-01): the Death
  // phobia (`c.phobia === "Death"`, `phobiaType: null` in the PHOBIAS
  // catalog) was likewise inert — 04.1-RESEARCH.md flagged it as having "no
  // existing near-death state hook". Generalized the same freeze condition
  // a third time to ALSO trigger a near-death panic: a Death-phobic
  // character whose own `c.wp` is at/below DEATH_PANIC_THRESHOLD (25%) of
  // `c.maxWP` at encounter start. Death's phobiaType is also always null in
  // the catalog, so this operand stays mutually exclusive with the other
  // two per character (a character carries exactly one `c.phobia` value),
  // and it reuses the identical frozen/shookOffFrozen seam and single
  // Hardiness rng.d(2) mitigation roll — never a second roll, never for a
  // non-Death-phobic or non-near-death character, never during chargen.
  const DEATH_PANIC_THRESHOLD = 0.25; // near-death: at/below 25% of maxWP
  const nearDeathPanic = c.phobia === "Death" && c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD;
  if (
    (c.phobiaType === type || (c.phobia === "Darkness" && inDark(state)) || nearDeathPanic) &&
    !(skill(c, "Hardiness") && rng.d(2) === 1)
  ) {
    state.combat.frozen = true;
    events.push({ type: "phobiaFrozen" });
  }
  if (inDark(state) && !skill(c, "Night Vision")) events.push({ type: "combatInDark" });
  if (first === "foe") foeTurn(state, rng, events);
  return events;
}

/**
 * playerStrike(state, rng, events) — the player's attack action. Ports
 * mazeworld.html playerStrike() (lines 2331-2408): Wizard's melee refusal
 * while a spell charge remains, the frozen-round skip, the attack count
 * (Barbarian/Ambidextrous/haste/Fridgian frenzy, including the
 * wasted-swing-on-a-corpse roll), per-attack toHit vs strikeDie, all the
 * critical-strike rules (Stealth/Cat Burglar/Cutthroat/Ninja/Death-touch/
 * Guard/Soldier no-crit), weaponDamage, and killFoe on lethal.
 */
export function playerStrike(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  if (!C) return events;
  // a Wizard does not lower himself to hand-to-hand while a spell remains
  if (c.sub === "Wizard" && maxCharges(c) - c.spellsUsed > 0) {
    events.push({ type: "strikeRefused", reason: "wizard" });
    return events;
  }
  if (C.frozen) {
    C.frozen = false;
    events.push({ type: "shookOffFrozen" });
    afterPlayerAction(state, rng, events);
    return events;
  }
  const foe = C.foes[C.target];
  if (!foe || !foe.alive) C.target = C.foes.findIndex((f) => f.alive);
  const t = C.foes[C.target];
  if (!t) return events;

  const R = RACES[c.race];
  let attacks = 1;
  if (c.sub === "Barbarian") attacks = 2;
  if (skill(c, "Ambidextrous")) attacks = Math.max(attacks, 2);
  if (c.haste > 0) attacks = Math.max(attacks, 2);
  if (R.frenzy && rng.d(8) <= 5) {
    attacks = 2;
    events.push({ type: "frenzy" });
    const corpse = C.foes.find((f) => !f.alive);
    if (corpse && rng.d(10) <= 5) {
      events.push({ type: "frenzyWasted", target: corpse.name });
      afterPlayerAction(state, rng, events);
      return events;
    }
  }

  for (let a = 0; a < attacks && t.alive; a++) {
    const dieN = strikeDie(c);
    const roll = rng.d(dieN);
    let need = a === 1 && R.frenzy ? 3 : toHit(state);
    if (t.asleep > 0) need = Math.max(need, 5); // p.27: 5 to hit a dozing creature
    if (t.sp && t.sp.toHit !== undefined) need = Math.min(need, t.sp.toHit); // hard to hit
    if (t.sp && t.sp.fast) need = Math.max(1, need - 1); // "roll 1 higher to strike"
    if (t.sp && t.sp.magicOnly && !c.magicWpn) need = 0; // only magic touches it
    const auto = (c.sub === "Cat Burglar" || c.sub === "Ninja") && !C.opened;
    if (auto) C.opened = true;
    const hit = auto || (need > 0 && roll <= need);
    if (!hit) {
      events.push({ type: "strikeMissed", target: t.name, roll, need, dieN, untouchable: need === 0 });
      continue;
    }

    let dmg = weaponDamage(c, rng);
    // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Cloak of
    // Strength (content/treasure-tables.js, eff:{noCrit:1}, "no critical
    // damage ever lands on you") was inert — the prototype's noCrit was
    // class-only (Guard/Soldier/dark) and never read eff(c,"noCrit"). This
    // flag ("no critical damage lands ON YOU") reads as PLAYER protection, but
    // the same field name is reused here as the player's OWN crit-suppression
    // (the only noCrit hook in combat), matching the prototype's Guard/Soldier
    // "your blows never crit" seam. Pure read (no rng), so parity is unaffected
    // for every character not carrying the cloak (eff noCrit === 0).
    const noCrit =
      c.sub === "Guard" || c.sub === "Soldier" || (inDark(state) && !skill(c, "Night Vision")) || eff(c, "noCrit") > 0;
    let crit = roll === 1 && !noCrit;
    const opening = !C.opened2;
    C.opened2 = true;

    // Death-touch: a 1 kills anything already weak
    if (roll === 1 && skill(c, "Death-touch") && t.wp < 15) {
      events.push({ type: "deathTouch", target: t.name });
      t.wp = 0;
      killFoe(state, t, rng, events);
      continue;
    }
    // "Heavy armor negates any advantages they may gain for stealthiness"
    const heavy = c.cls === "Thief" && ["Studded Leather", "Chain Mail", "Plate"].includes(c.armor);
    if (opening && heavy) events.push({ type: "backstabDenied", reason: "heavyArmor" });
    // opening strike: Stealth, Silence, and the plain Thief backstab.
    // DELIBERATE FIX (04.2 Bugs B, E7): a Con Artist's opening blow is a
    // deliberate no-damage "warning" (the `conArtistOpener` bail below emits
    // no `struck` and `continue`s without applying damage). Emitting a
    // backstab/silence/stealth crit here made the game announce "A blade in
    // the back. Critical." for a hit that dealt nothing. Skipping this whole
    // block for a Con Artist opener leaves `conArtistOpener` as the only
    // opener event. No rng change (crit only doubles already-rolled damage
    // that is then discarded by the bail), so determinism/parity are intact.
    if (opening && !noCrit && !heavy && c.sub !== "Con Artist") {
      if (skill(c, "Silence")) {
        crit = true;
        events.push({ type: "silenceStrike" });
      } else if (skill(c, "Stealth") && roll <= 2 && c.armor !== "Plate") {
        crit = true;
        events.push({ type: "stealthStrike" });
      } else if (c.cls === "Thief") {
        crit = true;
        events.push({ type: "backstab" });
      }
    }
    if (c.sub === "Ninja" && !opening && roll <= 2) crit = true;
    // a Con Artist's first blow is a warning, not an injury
    if (opening && c.sub === "Con Artist") {
      events.push({ type: "conArtistOpener" });
      continue;
    }
    if (c.sub === "Ninja" && auto) {
      dmg = c.level * c.level + (WEAPON_MAX[c.weapon] || 6) + c.prof;
      events.push({ type: "ninjaFirstStrike" });
    }
    if (c.sub === "Cutthroat" && !C.cut) {
      crit = true;
      C.cut = true;
    }
    if (crit) dmg *= 2;
    t.wp -= dmg;
    events.push({ type: "struck", target: t.name, roll, dmg, critical: crit });
    if (t.wp <= 0) killFoe(state, t, rng, events);
  }
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * killFoe(state, f, rng, events) — a foe's death: lives (kill-twice), the
 * skill-point formula (d6 x level x mul, with spMul/Barbarian/Apprentice
 * modifiers), coin via gainWilmst, treasure via rollTreasureItem/takeItem,
 * cooking, and checkLevel. Ports mazeworld.html killFoe() (lines 2410-2443).
 */
export function killFoe(state, f, rng, events = []) {
  const c = state.c;
  if (f.lives > 1) {
    f.lives--;
    f.wp = f.maxWP;
    events.push({ type: "foeRevived", name: f.name });
    return events;
  }
  f.alive = false;
  f.wp = 0;
  c.kills = (c.kills || 0) + 1;
  const roll = rng.d(6);
  const raw = roll * f.lvl;
  const R = RACES[c.race];
  const mul = 5 * (R.spMul || 1) * (c.sub === "Barbarian" ? 0.5 : 1) * (c.sub === "Apprentice" && c.level < 3 ? 2 : 1);
  const gained = Math.round(raw * mul);
  // PARTY-06 (Phase 8): canon splits the XP award among participants (hero +
  // members present). Members are hired muscle in v1 (no XP progression), so
  // their shares are simply DISCARDED — the split's only effect is to damp the
  // hero's gain, the built-in counterweight to a party's faster clears. Loot
  // and wilmst (below) stay 100% the hero's.
  //
  // DETERMINISM GATE: the `rng.d(6)` that produced `raw` above is UNCHANGED and
  // still drawn unconditionally (it must be — every combat fixture pins it).
  // The split is pure post-draw arithmetic, applied ONLY when `shares > 1`
  // (i.e. live members are present). With no members `shares === 1` and
  // `heroShare === gained` exactly, so both `c.sp` and the `foeKilled` event
  // are byte-identical to today.
  const liveMembers = state.combat && state.combat.allies ? state.combat.allies.filter((a) => a.wp > 0) : [];
  const shares = 1 + liveMembers.length;
  const heroShare = shares > 1 ? Math.round(gained / shares) : gained;
  c.sp += heroShare;
  events.push({ type: "foeKilled", name: f.name, spGained: heroShare });

  // creatures carry things, and the things are worth wilmst
  const purse = { Humans: 12, Demons: 8, Magical: 8, "Walking Dead": 6, "Lair Beasts": 3, Beasts: 1 }[f.type] || 4;
  const coin = Math.round((rng.d(10) * f.lvl * purse) / LOOT_DIVISOR);
  if (coin > 0) gainWilmst(state, coin, "off the body", rng, events);
  if (rng.d(20) <= 2 + f.lvl) takeItem(state, rollTreasureItem(rng, state.floor.depth, c), events);

  if (f.type === "Beasts" || f.type === "Lair Beasts") {
    if (skill(c, "Cooking")) {
      const fed = Math.max(1, Math.round(f.maxWP / 4));
      c.wp = Math.min(c.maxWP, c.wp + fed);
      c.rations++;
      events.push({ type: "cooked", wp: fed, rations: 1 });
    } else if (rng.d(6) >= 4) {
      c.rations++;
      events.push({ type: "cooked", wp: 0, rations: 1 });
    }
  }
  checkLevel(state, rng, events);
  return events;
}

/**
 * flee(state, rng, events) — the escape action. Ports mazeworld.html flee()
 * (lines 2684-2697): Samurai never runs, a Cloaker always gets away for
 * free, a tracked round-1 withdrawal is clean, otherwise d20 (+5 Thief) vs
 * 11; failure triggers a foeTurn and advances the round.
 */
export function flee(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  if (!C) return events;
  if (c.sub === "Samurai") {
    events.push({ type: "fleeRefused", reason: "samurai" });
    return events;
  }
  if (c.sub === "Cloaker") {
    events.push({ type: "fled", reason: "cloaker" });
    endCombat(state, events);
    return events;
  }
  if (C.tracked && C.round === 1) {
    events.push({ type: "fled", reason: "tracked" });
    endCombat(state, events);
    return events;
  }
  const bonus = c.cls === "Thief" ? 5 : 0; // getting out is the Thief's whole trade
  const roll = rng.d(20);
  events.push({ type: "fleeRolled", roll, bonus, need: 11 });
  if (roll + bonus >= 11) {
    events.push({ type: "fled", reason: "escaped" });
    endCombat(state, events);
    return events;
  }
  events.push({ type: "fleeFailed" });
  foeTurn(state, rng, events);
  if (!state.dead) C.round++;
  return events;
}

/**
 * canParley(state) — can the current encounter be talked down? Ports
 * mazeworld.html canParley() (lines 2701-2714).
 */
export function canParley(state) {
  if (!state.combat) return false;
  const c = state.c;
  const t = state.combat.type;
  if (t === "Walking Dead" || t === "Magical") return false;
  if (c.sub === "Con Artist") return true;
  if (c.sub === "Woodsman" && (t === "Beasts" || t === "Lair Beasts")) return true;
  if (c.sub === "Bard" && t === "Humans") return true;
  // DELIBERATE RULES CHANGE (Phase 15 item-wiring, DR15-A / ECON-08): the Helm
  // of Knowledge (content/treasure-tables.js, eff:{tongue:1}, "perfect fluency
  // in one language") was inert — `tongue` was READ NOWHERE. Carrying it now
  // grants the Language capability (parley the TALKATIVE encounter types),
  // OR-ed with the trained Language skill here. Pure read (no rng): canParley
  // is a boolean gate; parley() only draws rng once talking is attempted, so
  // this never shifts the rng stream for a non-carrier (eff tongue === 0).
  if ((skill(c, "Language") || eff(c, "tongue") > 0) && TALKATIVE.includes(t)) return true;
  // "All good and evil creatures recognize the Wilmsry and often desire to barter with them."
  if (c.race === "Wilmsry" && t !== "Magical") return true;
  // "Most humans treasure the sighting of an elf as a good omen."
  if (c.race === "Elven" && t === "Humans") return true;
  return false;
}

/**
 * parley(state, rng, events) — talk the encounter down. Ports mazeworld.html
 * parley() (lines 2715-2734): a d20 vs 9+bonus, awarding half the skill
 * points (and a Humans-only bonus payout) on success, ending combat cleanly.
 */
export function parley(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  if (!C || !canParley(state)) return events;
  // LO-03: guard the empty-foes edge defensively. Currently unreachable
  // (state.combat is nulled the instant liveFoes empties on every path that
  // could produce it), but Math.max(...[]) === -Infinity would otherwise
  // inflate `bonus` below to +Infinity and make parley un-failable if that
  // invariant is ever changed.
  const foes = liveFoes(state);
  if (!foes.length) return events;
  const top = Math.max(...foes.map((f) => f.lvl));
  if (c.race === "Wilmsry" && C.type === "Magical") {
    events.push({ type: "parleyRefused", reason: "wilmsryVsMagical" });
    return events;
  }
  const bonus =
    (c.sub === "Con Artist" ? 6 : 0) +
    (c.sub === "Woodsman" ? 3 : 0) +
    (c.race === "Wilmsry" ? 4 : 0) + // noted for their bargaining
    (c.race === "Elven" && C.type === "Humans" ? 3 : 0) + // a good omen
    c.level -
    top;
  const roll = rng.d(20);
  const need = 9 + bonus;
  events.push({ type: "parleyRolled", roll, need });
  if (roll <= need) {
    const sp = Math.round(liveFoes(state).reduce((sum, f) => sum + rng.d(6) * f.lvl, 0) * 2.5);
    c.sp += sp;
    events.push({ type: "spGained", amount: sp, reason: "parley" });
    if (C.type === "Humans" && rng.d(6) >= 4) {
      const wm = rng.d(6) * 100 * state.floor.depth;
      c.gold += wm;
      events.push({ type: "goldGained", amount: wm, why: "parley" });
    }
    checkLevel(state, rng, events);
    endCombat(state, events);
    return events;
  }
  events.push({ type: "parleyFailed" });
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * songReady(state) — a Bard's song comes back every 100 squares. Ports
 * mazeworld.html songReady() (lines 2743-2745).
 */
export function songReady(state) {
  return state.c.sub === "Bard" && state.steps - (state.c.songAt ?? -999) >= 100;
}

/**
 * sing(state, rng, events) — the Bard's action, picking the highest song the
 * character's level allows. Ports mazeworld.html sing() (lines 2746-2770).
 */
export function sing(state, rng, events = []) {
  const c = state.c;
  const C = state.combat;
  if (!C || !songReady(state)) return events;
  const song = SONGS.filter((s) => s.lvl <= c.level).pop();
  c.songAt = state.steps;
  events.push({ type: "sang", song: song.n, level: song.lvl });
  const foes = liveFoes(state);
  if (song.lvl === 1) {
    if (C.type === "Beasts" || C.type === "Lair Beasts") {
      foes.forEach((f) => {
        f.alive = false;
        f.fled = true;
      });
      events.push({ type: "beastsSoothed", count: foes.length });
    } else {
      events.push({ type: "songIgnored" });
    }
  } else if (song.lvl === 2) {
    C.inspired = 1;
  } else if (song.lvl === 3) {
    const n = rng.d(6);
    foes.slice(0, n).forEach((f) => {
      if (f.lvl <= c.level) f.asleep = 24;
    });
    events.push({ type: "lullabyRolled", n });
  } else if (song.lvl === 4) {
    const n = rng.d(12);
    const r = rng.d(8);
    foes.slice(0, n).forEach((f) => {
      if (f.lvl <= c.level) f.asleep = r;
    });
    events.push({ type: "thunderRolled", n, r });
  } else {
    foes.forEach((f) => {
      if (f.lvl <= c.level) f.wp = 1;
    });
  }
  afterPlayerAction(state, rng, events);
  return events;
}

/**
 * endCombat(state, events) — clears combat and the encounter-scoped magic
 * fields. Ports mazeworld.html endCombat() (lines 2796-2804), minus
 * paint()/save(). NOTE: this unconditionally sets `c.senses = 0`, adding
 * that field to the character the first time ANY combat ends — matching the
 * prototype's own side effect exactly (fidelity: `S.c.senses = 0;` runs even
 * on a character that never had a `senses` field before), so a save/parity
 * comparison after the FIRST fight stays byte-identical on both sides.
 */
export function endCombat(state, events = []) {
  // PARTY-05 (Phase 8): sync surviving party members' in-fight `wp` back to the
  // persistent roster, then drop any member that was downed this fight (its
  // combat entry was already spliced out of C.allies by downMember, and it was
  // flagged `status:"downed"` on state.party). GATE: this whole block only runs
  // when `C.allies` exists — i.e. a non-empty party was synced in at
  // startCombat. An empty party never gets a `C.allies`, so this is skipped
  // entirely and endCombat stays byte-identical to today for solo fixtures.
  const C = state.combat;
  if (C && C.allies && Array.isArray(state.party)) {
    for (const ally of C.allies) {
      if (typeof ally.partyIdx === "number" && state.party[ally.partyIdx]) {
        state.party[ally.partyIdx].wp = ally.wp;
      }
    }
    state.party = state.party.filter((m) => m.status !== "downed");
  }
  state.combat = null;
  state.c.regen = false;
  state.c.ward = null;
  state.c.mirror = 0;
  state.c.senses = 0;
  events.push({ type: "combatEnded" });
  return events;
}

/**
 * afterPlayerAction(state, rng, events) — the post-action turn sequence:
 * check for a cleared encounter, run the ally's turn, run the foe's turn,
 * then (if nobody died) advance the round and roll fresh initiative — with a
 * second foe turn if the foes win that reroll. Ports mazeworld.html
 * afterPlayerAction() (lines 2806-2822), minus paint()/save().
 */
export function afterPlayerAction(state, rng, events = []) {
  const C = state.combat;
  if (!C) return events;
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  allyTurn(state, rng, events);
  // PARTY-04 (Phase 8): the party members act in the SAME slot the summon ally
  // does, right after it. GATE: alliesTurn is an immediate no-op (zero rng) on
  // an empty/absent C.allies, so for solo fixtures this call is invisible and
  // the shared clear-check below is byte-identical to today.
  alliesTurn(state, rng, events);
  if (!liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  foeTurn(state, rng, events);
  // A foe can DIE during foeTurn (an acid-over-time tick, or a ward reflecting a
  // blow back onto it) — not just on the player's own strike. Re-check for a
  // cleared encounter here too, or combat stays open with nothing left to fight
  // and the player is stranded on the combat screen. (The pre-foeTurn checks
  // above only catch kills from the player's action / the ally's turn.)
  if (state.combat && !liveFoes(state).length) {
    events.push({ type: "encounterCleared" });
    endCombat(state, events);
    return events;
  }
  if (!state.dead && state.combat) {
    state.combat.round++;
    rollInitiative(state, rng); // p.24: a fresh d20 each round
    if (state.combat.first === "foe") {
      foeTurn(state, rng, events);
      if (state.combat && !liveFoes(state).length) {
        events.push({ type: "encounterCleared" });
        endCombat(state, events);
        return events;
      }
      // ROUND-COUNT FIX (user directive 2026-09-09): a round is ONE full cycle
      // (every entity acts once), not per-attack. The foes winning this fresh
      // initiative act FIRST in the round already begun by the `round++` above;
      // that pre-emptive turn must NOT advance the counter a second time (it
      // made the displayed round jump 1→3→5). The player's next action completes
      // this round and the round++ at the top of the next afterPlayerAction
      // advances it. round===1 mechanics are unaffected (697 only fired ≥ round 2).
    }
  }
  return events;
}

/**
 * allyTurn(state, rng, events) — a summoned ally's strike (if any). Ports
 * mazeworld.html allyTurn() (lines 2824-2836).
 */
export function allyTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.ally) return events;
  const t = liveFoes(state)[0];
  if (!t) return events;
  const roll = rng.d(STRIKE_DICE[C.ally.lvl - 1]);
  if (roll <= 5) {
    const d = C.ally.lvl * C.ally.lvl + rng.d(6);
    t.wp -= d;
    events.push({ type: "allyStruck", name: C.ally.name, target: t.name, dmg: d });
    if (t.wp <= 0) killFoe(state, t, rng, events);
  } else {
    events.push({ type: "allyMissed", name: C.ally.name });
  }
  if (--C.ally.rounds <= 0) {
    events.push({ type: "allyDeparted", name: C.ally.name });
    C.ally = null;
  }
  return events;
}

/**
 * alliesTurn(state, rng, events) — every persistent party member's strike this
 * round (PARTY-04). Generalizes allyTurn's single-`C.ally` striker over the
 * combat-scoped `C.allies` roster synced in at startCombat, reusing the exact
 * same STRIKE_DICE hit math and reusing the `allyStruck`/`allyMissed` event
 * family (so member strikes need no new narration entry). The summon `C.ally`
 * path (allyTurn) is left entirely untouched and still fires independently.
 *
 * DETERMINISM GATE: the guard `!C.allies || !C.allies.length` returns
 * IMMEDIATELY drawing ZERO rng when there is no party — modeled on allyTurn's
 * own null-`C.ally` early return. An empty party (every parity fixture) never
 * enters the loop, so the seeded cursor is untouched and parity stays
 * byte-identical.
 *
 * LOOP SAFETY (PARTY-07): a bounded `for` over a SNAPSHOT (`C.allies.slice()`),
 * never a `while`; re-checks `liveFoes()` every iteration and BREAKS the
 * instant foes clear; skips a downed member (`wp <= 0`) rather than retrying —
 * so it can never spin.
 */
export function alliesTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C || !C.allies || !C.allies.length) return events;
  for (const ally of C.allies.slice()) {
    if (ally.wp <= 0) continue; // a downed member takes no swing
    const foes = liveFoes(state);
    if (!foes.length) break; // nothing left to hit — end the party's turn
    const t = foes[0];
    const roll = rng.d(STRIKE_DICE[clamp(ally.lvl, 1, 5) - 1]);
    if (roll <= 5) {
      const d = ally.lvl * ally.lvl + rng.d(6);
      t.wp -= d;
      events.push({ type: "allyStruck", name: ally.name, target: t.name, dmg: d });
      if (t.wp <= 0) killFoe(state, t, rng, events);
    } else {
      events.push({ type: "allyMissed", name: ally.name });
    }
  }
  return events;
}

/**
 * downMember(state, member, events) — a party member reaches 0 wp (PARTY-05).
 * It is pulled from the combat roster (`C.allies`) so no foe/ally targets it
 * again, and flagged `status:"downed"` on the persistent `state.party` so
 * endCombat drops it from the run. It emits a `memberDowned` event and — the
 * critical fork — NEVER calls die() (that terminator ends the HERO's run); a
 * companion falling must not end the run.
 */
function downMember(state, member, events) {
  member.wp = 0;
  const C = state.combat;
  if (C && Array.isArray(C.allies)) {
    const ci = C.allies.indexOf(member);
    if (ci >= 0) C.allies.splice(ci, 1);
  }
  if (typeof member.partyIdx === "number" && Array.isArray(state.party) && state.party[member.partyIdx]) {
    state.party[member.partyIdx].status = "downed";
  }
  events.push({ type: "memberDowned", name: member.name });
}

/**
 * foeTurn(state, rng, events) — every live foe's attack: regen tick, an
 * acid-over-time tick, sleep, per-swing foeDie vs foeToHitVs (blind/weakened
 * overrides), damage (sp.dmg dice, criticals, Hardiness reduction), a ward's
 * absorb/reflect/shatter, armor soak, and die() on wp<=0. Ports
 * mazeworld.html foeTurn() (lines 2838-2903).
 */
export function foeTurn(state, rng, events = []) {
  const C = state.combat;
  if (!C) return events;
  const c = state.c;
  if (c.regen) {
    const r = rng.d(8);
    if (c.wp < c.maxWP) {
      c.wp = Math.min(c.maxWP, c.wp + r);
      events.push({ type: "regenerated", amount: r });
    }
  }
  for (const f of C.foes) {
    if (f.acid && f.acid.rounds > 0) {
      const d = rollDice(rng, f.acid.dmg);
      f.wp -= d;
      f.acid.rounds--;
      events.push({ type: "acidTick", target: f.name, dmg: d });
      if (f.wp <= 0 && f.alive) {
        killFoe(state, f, rng, events);
        continue;
      }
    }
    if (!f.alive) continue;
    if (f.asleep > 0) {
      f.asleep--;
      events.push({ type: "foeSlept", name: f.name });
      continue;
    }
    const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);
    for (let s = 0; s < swings; s++) {
      if (!f.alive) break;

      // PARTY-04/PARTY-05 (Phase 8): each foe swing chooses a target from the
      // pool [hero] + live party members. DETERMINISM GATE (the single hottest
      // parity loop in the engine): the target-selection roll `rng.d(pool)` is
      // drawn ONLY when at least one live member exists. With an empty/absent
      // party `liveMembers` is empty, NO roll is drawn, `member` stays null,
      // and control falls straight through to the byte-identical hero branch
      // below — exactly the path every solo parity fixture already exercises.
      // Only when members are present is the extra draw taken (pick 1 ⇒ hero,
      // 2..N+1 ⇒ that member), which is new, unfrozen behavior.
      const liveMembers = C.allies ? C.allies.filter((a) => a.wp > 0) : [];
      let member = null;
      if (liveMembers.length) {
        const pick = rng.d(liveMembers.length + 1);
        if (pick > 1) member = liveMembers[pick - 2];
      }
      if (member) {
        // SIMPLIFIED member branch: no ward/armor/mirror/Hardiness (all
        // hero-only machinery), no die(). Same to-hit shape, then straight to
        // the member's own `wp`; a member at 0 wp is downed + departs.
        const mDieN = foeDie(c, f);
        const mRoll = rng.d(mDieN);
        let mNeed = foeToHitVs(state);
        if (f.blind) mNeed = 1;
        if (C.foeToHitPenalty) mNeed = Math.min(mNeed, C.foeToHitPenalty);
        if (mRoll > mNeed) {
          // name the member as the intended target so a whiff at a party
          // member reads distinctly from a whiff at the hero (PARTY: Oracle
          // shows who was targeted). `member` field is additive + only set in
          // this live-member branch, which never runs in solo parity fixtures.
          events.push({ type: "foeMissed", name: f.name, roll: mRoll, need: mNeed, member: member.name });
          continue;
        }
        let mDmg = f.lvl * f.lvl + (f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6));
        if (C.weakened) mDmg = Math.ceil(mDmg / 2);
        if (mRoll === 1) mDmg *= 2;
        member.wp -= mDmg;
        events.push({ type: "memberStruck", name: f.name, member: member.name, dmg: mDmg, roll: mRoll, need: mNeed, critical: mRoll === 1 });
        if (member.wp <= 0) downMember(state, member, events);
        continue;
      }

      const dieN = foeDie(c, f);
      const roll = rng.d(dieN);
      let need = foeToHitVs(state);
      if (f.blind) need = 1;
      if (C.foeToHitPenalty) need = Math.min(need, C.foeToHitPenalty);
      if (roll > need) {
        events.push({ type: "foeMissed", name: f.name, roll, need });
        continue;
      }
      let dmg = f.lvl * f.lvl + (f.sp && f.sp.dmg ? rollDice(rng, f.sp.dmg) : rng.d(6));
      if (C.weakened) dmg = Math.ceil(dmg / 2);
      if (roll === 1 || (roll <= 2 && c.sub === "Soldier")) dmg *= 2;
      if (skill(c, "Hardiness")) dmg = Math.max(1, dmg - 3);

      // DELIBERATE RULES CHANGE (Phase 15 item-wiring, ECON-08): the Pendant of
      // Fortitude (content/treasure-tables.js, use:"half") sets `c.halfNext`
      // (items.js:"half" case) but the flag was READ NOWHERE. Wired here: it
      // halves ONE incoming landed blow (this hero-damage branch only runs on a
      // successful foe hit), then clears — a single-charge damage buffer. Pure
      // (no rng): `c.halfNext` is only ever set by USING the Pendant, so it is
      // falsy on every parity fixture and this block never runs for them.
      if (c.halfNext) {
        dmg = Math.ceil(dmg / 2);
        c.halfNext = false;
        events.push({ type: "damageHalved", name: f.name });
      }

      // a ward eats the blow before armour or flesh does
      let warded = 0;
      if (c.ward && c.ward.pool > 0) {
        warded = Math.min(c.ward.pool, dmg);
        c.ward.pool -= warded;
        dmg -= warded;
        if (c.ward.reflect && warded > 0) {
          f.wp -= warded;
          events.push({ type: "wardReflected", target: f.name, amount: warded });
          if (f.wp <= 0) {
            killFoe(state, f, rng, events);
            continue;
          }
        } else if (warded > 0) {
          events.push({ type: "wardAbsorbed", amount: warded, remaining: c.ward.pool });
        }
        if (c.ward.pool <= 0) {
          events.push({ type: "wardShattered" });
          c.ward = null;
        }
      }
      if (dmg <= 0) continue;

      // p.44: roll d20; at or under your AR the blow lands on the armour
      // instead of you
      let onArmour = false;
      let blocked = 0;
      const ignores = f.sp && f.sp.noArmor;
      // E8: read EFFECTIVE armour (worn armour, or PLATE when the Cloak of
      // Armor is carried — see engine/derived.js armorSoak). For any character
      // WITHOUT the cloak av === the worn c.ar/c.armorWP/c.armorMin values, so
      // the soak roll fires exactly as before (no new rng draw). A cloak-bearer
      // soaks as plate; the magical plate never wears out (av.magic), so no
      // worn-armour durability is consumed and armorDestroyed never fires.
      const av = armorSoak(c);
      if (av.wp > 0 && av.ar > 0 && !ignores) {
        const soak = rng.d(20);
        if (soak <= av.ar) {
          onArmour = true;
          blocked = dmg;
          if (!av.magic && dmg > av.min) c.armorWP = Math.max(0, c.armorWP - dmg);
          dmg = 0;
          if (!av.magic && c.armorWP <= 0) events.push({ type: "armorDestroyed" });
        }
      }
      if (onArmour) {
        events.push({ type: "armorSoaked", name: f.name, amount: blocked });
        continue;
      }
      c.wp -= dmg;
      events.push({
        type: "struckByFoe",
        name: f.name,
        roll,
        need,
        dmg,
        ignoresArmor: !!ignores,
        critical: roll === 1,
      });
      if (c.wp <= 0) {
        die(state, "combat", f.name, rng, events);
        return events;
      }
    }
  }
  if (c.ward && --c.ward.rounds <= 0) {
    events.push({ type: "wardFaded" });
    c.ward = null;
  }
  if (c.mirror > 0 && --c.mirror <= 0) events.push({ type: "mirrorFaded" });
  return events;
}
