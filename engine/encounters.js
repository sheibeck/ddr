// engine/encounters.js
//
// The encounter/trap/chest domain (ENG-01, ENG-05) — the glue between
// movement and every other rule domain. Ports mazeworld.html's springTrap/
// openChest/encounterDot/tableFour/findFood/findGrimoire/findGear/findMisc/
// meetFaerie/meetJoiner/catchAffliction/goInsane/newPhobia/fallDark (lines
// 2064-2255), replacing every D()/pick()/shuffle()-backed Math.random() draw
// with the injected engine rng (in the prototype's exact consumption order,
// including redundant rolls the prototype discards — see meetJoiner) and
// every say()/evt() narration call with a pushed `{type, ...}` event. No
// DOM, no localStorage, no Math.random, no global S.
//
// A locked chest's prototype fallback ("Smash it open", mazeworld.html lines
// 1647-1654) stores a retry CALLBACK on `S.beats.action` — a presentation
// concern (`state.beats` stays null throughout the engine by design, per
// engine/movement.js's header and engine/saveState.js's rehydrate) with no
// engine action type defined for it yet. This plan does not invent one:
// openChest simply stops after pushing `chestLocked` on a failed roll,
// matching every other "the roll failed, nothing further happens" branch in
// this module. Deferred, not lost — a UI-layer concern for a later phase.
//
// Circular imports with engine/movement.js (encounterDot/springTrap/openChest
// call teleport(); move()/teleport() call encounterDot/springTrap/openChest)
// are safe by the same reasoning engine/items.js's header documents for its
// combat.js cycle: every export on both sides is a hoisted `function`
// declaration, and each only touches the other module's binding from inside
// a function body invoked at runtime, never at module-evaluation time.

import { skill, skillTier, canLearn, intelBonus, itemEffectActive } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { difficultyCurve, scaleHazard } from "./difficulty.js";
import { checkLevel, rollCharacter, grantLevelAbilities } from "./character.js";
import { gainWilmst, hasPicks, rollBlade, rollMailPiece, rollTreasureItem, rollStaff, LOOT_DIVISOR } from "./items.js";
import { startCombat } from "./combat.js";
import { openStore } from "./economy.js";
import { teleport } from "./movement.js";
import { swapPartyMember } from "./state.js";
import {
  TRAPS,
  AFFLICTIONS,
  ENCOUNTER_TABLES,
  ENC_ALIAS,
  FOODS,
  POTIONS,
  SPELLS,
  CLOAKS,
  JEWELRY,
  MISC_MAGIC,
  FAERIE,
  PHOBIAS,
  SPELL_LEVEL_TABLE,
  THRESHOLDS,
  INSANITY,
} from "../content/index.js";

/**
 * springTrap(state, rng, events) — Acrobat dodge, a Pilfer's free disarm,
 * TRAPS[d8] damage (Cat Burglar doubles it, Hardiness reduces it), a
 * poisoned arrow's affliction, and die() on lethal. Ports mazeworld.html
 * springTrap() (lines 2065-2079).
 *
 * Phase 38 (ABIL-02): the retired Agility and Leaping dodge terms are gone —
 * only the Acrobat sub bonus remains.
 */
export function springTrap(state, rng, events = []) {
  const c = state.c;
  const nimble = 5 + (c.sub === "Acrobat" ? 3 : 0);
  const dodge = rng.d(20);
  if (dodge <= nimble) {
    events.push({ type: "trapAvoided", roll: dodge, need: nimble });
    return events;
  }
  if (c.sub === "Pilfer") {
    events.push({ type: "trapDisarmed", reason: "pilfer" });
    return events;
  }
  const r = rng.d(8);
  const tr = TRAPS[r - 1];
  let dmg = rollDice(rng, tr.dmg);
  if (tr.times) dmg *= tr.times;
  if (c.sub === "Cat Burglar") {
    dmg *= 2;
    events.push({ type: "trapDoubled", reason: "catBurglar" });
  }
  if (skill(c, "Hardiness")) dmg = Math.max(1, dmg - 3);
  // Phase 27 (TUNE-06): hazardScale — post-draw arithmetic, 0 new draws,
  // identity outside floors HAZARD_FROM_DEPTH..HAZARD_CANON_FROM_DEPTH-1
  dmg = scaleHazard(dmg, difficultyCurve(state.floor.depth));
  c.wp -= dmg;
  events.push({ type: "trapSprung", roll: r, name: tr.n, dmg });
  if (tr.poison) {
    // The prototype's inline closure (`loss:()=>2*D(6)`) is AFFLICTIONS[0]'s
    // exact dice notation ({n:2,sides:6,bonus:0}, kind "Poison", per 1) —
    // hand-ported to that same plain-data shape rather than duplicating a
    // second closure-turned-notation object.
    c.affliction = { kind: "Poison", loss: { n: 2, sides: 6, bonus: 0 }, per: 1, left: 10 };
    events.push({ type: "trapPoisoned" });
  }
  if (c.wp <= 0) die(state, "trap", null, rng, events);
  return events;
}

/**
 * openChest(state, rng, events) — Pilfer's free open, a Locks-skill/lockpick
 * roll (or a bare d20 with none), gold via gainWilmst, a scroll chance, and
 * treasure via rollTreasureItem/takeItem. Ports mazeworld.html openChest()
 * (lines 2082-2112), minus its UI-tied "Smash it open" retry (see module
 * header).
 */
export function openChest(state, rng, events = []) {
  const c = state.c;
  const tier = skillTier(c, "Locks") + (hasPicks(c) ? 1 : 0);
  let opened = false;
  // DELIBERATE RULES CHANGE (04.1-04, 2026-09-09, RULE-01): Intelligence had
  // no mechanical read anywhere in the engine (04.1-RESEARCH.md's clearest
  // cosmetic-orphan finding). intelBonus(c) (derived.js) now raises the lock
  // roll's SUCCESS THRESHOLD — a smarter character needs a higher/easier
  // number, not a better roll — in both the tiered (Locks-skill/lockpick)
  // and bare-d20 paths below. This changes the COMPARISON only: the
  // rng.d(10)/rng.d(20) lock-roll draw, and every following gainWilmst/
  // scroll/treasure draw, stay in the exact same order, so RNG consumption
  // is unaffected and parity/determinism stay green.
  if (c.sub === "Pilfer") {
    opened = true;
    events.push({ type: "chestOpened", reason: "pilfer" });
  } else if (tier) {
    const need = [0, 5, 7, 8][Math.min(tier, 3)] + intelBonus(c);
    const roll = rng.d(10);
    opened = roll <= need;
    events.push({ type: "chestLockRolled", roll, need, dieN: 10, picks: hasPicks(c), opened });
  } else {
    const need = 8 + intelBonus(c);
    const roll = rng.d(20);
    opened = roll <= need;
    events.push({ type: "chestLockRolled", roll, need, dieN: 20, picks: false, opened });
  }
  if (!opened) {
    events.push({ type: "chestLocked" });
    return events;
  }
  if (!(c.sub === "Pilfer")) events.push({ type: "chestOpened" });
  gainWilmst(state, Math.round(((rng.d(10) + 6) * 100 * state.floor.depth) / LOOT_DIVISOR), "chest", rng, events);
  if (rng.d(6) >= 3) {
    c.scrolls = (c.scrolls || 0) + 1;
    events.push({ type: "scrollFound" });
  }
  // ECON-03 (Phase 13): OFFER the rolled treasure instead of auto-taking it.
  // rollTreasureItem still draws the same rng in the same order (the whole
  // point — the DELIBERATE divergence is take→offer, NOT the roll), so
  // determinism is unchanged; offerFind adds no rng. See offerFind's header.
  offerFind(state, rollTreasureItem(rng, state.floor.depth, c), events);
  return events;
}

/**
 * offerFind(state, it, events) — ECON-03 (Phase 13): stash a rolled find in
 * state.pendingFind and push `findOffered` INSTEAD of auto-adding/equipping it
 * (the old takeItem/giveItem behavior). The player then accepts it (items.js
 * takeFind) or declines it (leaveFind). This is the DELIBERATE, documented
 * divergence from the frozen prototype (test/parity/prototype-master.js.txt,
 * which auto-takes) — see engine/encounters.js callers and the
 * reconcilePendingFind carve-out in test/parity/harness/comparables.js. Adds
 * NO rng draw (plain assignment, like meetJoiner's pendingJoiner stash), so the
 * seeded cursor never shifts; state.pendingFind is a top-level sibling of
 * pendingJoiner, already carved out of every parity comparison (Phase 12).
 */
export function offerFind(state, it, events = []) {
  state.pendingFind = it;
  events.push({ type: "findOffered", name: it.n, kind: it.kind });
  return events;
}

/**
 * encounterDot(state, rng, events) — ENCOUNTER_TABLES[d8][d10] resolution:
 * a monster-type result dispatches to startCombat via ENC_ALIAS, "Store"
 * opens the shop, everything else dispatches to its own helper (or
 * tableFour for the plain WP/SP/WM/armour rows). Ports mazeworld.html
 * encounterDot() (lines 2114-2138).
 */
export function encounterDot(state, rng, events = []) {
  const t = rng.d(8);
  const r = rng.d(10);
  const result = ENCOUNTER_TABLES[t - 1][r - 1];
  events.push({ type: "encounterRolled", table: t, roll: r, result });

  if (ENC_ALIAS[result]) {
    startCombat(state, false, ENC_ALIAS[result], rng, events);
    return events;
  }

  switch (result) {
    case "Store":
      openStore(state, rng, events);
      return events;
    case "Teleport":
      teleport(state, rng, events);
      return events;
    case "Joiner":
      meetJoiner(state, rng, events);
      return events;
    case "Faerie":
      meetFaerie(state, rng, events);
      return events;
    case "Food":
      findFood(state, rng, events);
      return events;
    case "Ailment":
      catchAffliction(state, rng, events);
      return events;
    case "Insanity":
      goInsane(state, rng, events);
      return events;
    case "Phobia":
      newPhobia(state, rng, events);
      return events;
    case "Darkness":
      fallDark(state, rng, events);
      return events;
    case "Grimoire":
      findGrimoire(state, rng, events);
      return events;
    case "Weapon":
      findGear(state, "weapon", rng, events);
      return events;
    case "Magic Weapon":
      findGear(state, "magicweapon", rng, events);
      return events;
    case "Magic Armor":
      findGear(state, "magicarmor", rng, events);
      return events;
    case "Misc Magic":
      findMisc(state, rng, events);
      return events;
    default:
      tableFour(state, result, rng, events);
      return events;
  }
}

// ECON-09 (Phase 16, Economy E): the Table-4 gold row ("wilmst cache") pays a
// depth-scaled FLAT amount — a documented TUNING KNOB. The ported prototype
// handed a flat 3000 for a single red-dot pull, an order of magnitude richer
// than any other grant (openChest tops out ~160*depth; a faerie ~1000). This
// cuts it to ~300 per floor depth: 300 at depth 1, scaling linearly. CRITICAL:
// this is a FLAT/derived formula with NO new rng draw — the row drew zero rng
// before (gainWilmst only rolls for a Pickpocket, independent of the amount),
// and a new draw here would shift the entire downstream seeded stream and break
// same-seed-same-result + parity. Keep it flat.
// Phase 21 (TUNE-04, D-13): also read by engine/state.js#newRun's dev
// start-at-depth purse — exported (was module-private) so the dev branch
// reuses this exact row rather than duplicating the constant.
export const WILMST_CACHE_PER_DEPTH = 300;

/**
 * tableFour(state, result, rng, events) — Table 4 on p.45, a straight list
 * of things that happen to you. Ports mazeworld.html tableFour() (lines
 * 2141-2155).
 */
export function tableFour(state, result, rng, events = []) {
  const c = state.c;
  // P1 (04.2 Text batch): the `tableFour` beat used to echo the raw table cell
  // ("+10 WP", "+3000 WM", "-All armour") verbatim — literal dev jargon. The
  // switch still DISPATCHES on the (dual-purpose) cell string, but the event
  // now carries a prose sentence in the game's deadpan voice so the beat reads
  // as a line, not a stat token. E10: rows already narrated by another event
  // (the "wilmst cache" row → goldGained) do NOT also push a redundant beat.
  switch (result) {
    case "+10 HP":
      c.wp = Math.min(c.maxWP, c.wp + 10);
      events.push({ type: "tableFour", result: "The maze, for once, gives something back. 10 hp." });
      break;
    case "-10 HP":
      c.wp -= 10;
      events.push({ type: "tableFour", result: "Something unseen takes its cut — 10 hp, gone." });
      break;
    case "+10 XP":
      c.sp += 10;
      events.push({ type: "tableFour", result: "You are, marginally, wiser for the ordeal. 10 experience." });
      checkLevel(state, rng, events);
      break;
    case "+25 HP":
      c.maxWP += 25;
      c.wp += 25;
      events.push({ type: "tableFour", result: "A rare kindness — you come away tougher. +25 to your health, for keeps." });
      break;
    case "+25 XP":
      c.sp += 25;
      events.push({ type: "tableFour", result: "A hard lesson, and you actually learned it. 25 experience." });
      checkLevel(state, rng, events);
      break;
    case "-15 HP":
      c.wp -= 15;
      events.push({ type: "tableFour", result: "The maze extracts a toll you did not agree to. 15 hp." });
      break;
    case "wilmst cache":
      // E10: gainWilmst already pushes a goldGained beat that narrates the
      // actual amount — pushing a second `tableFour` beat here was the redundant
      // raw-jargon line the player used to see as the triple "+3000 WM". Dropped.
      // ECON-09 (Phase 16): the flat 3000 is now a depth-scaled FLAT amount
      // (WILMST_CACHE_PER_DEPTH * depth). gainWilmst's only rng draw is the
      // Pickpocket take (independent of `n`), so scaling the amount adds NO new
      // draw — the seeded stream is byte-identical. The generic "wilmst cache"
      // key (renamed atomically with content/encounters.js) lets the payout vary
      // by depth without a dual-purpose string hard-coding a stale number.
      gainWilmst(state, WILMST_CACHE_PER_DEPTH * state.floor.depth, "tableFour", rng, events);
      break;
    case "-All armour":
      c.armor = "Nothing";
      c.ar = 0;
      c.armorWP = 0;
      c.armorMax = 0;
      events.push({ type: "tableFour", result: "Your armour sloughs off in useless flakes. Whatever you were wearing, you no longer are." });
      break;
    default:
      events.push({ type: "tableFourNoop", result });
  }
  if (c.wp <= 0) die(state, "maze", null, rng, events);
  return events;
}

/** findFood(state, rng, events) — ports mazeworld.html findFood() (lines 2157-2163). */
export function findFood(state, rng, events = []) {
  // DELIBERATE RULES CHANGE (04.1-03, RATION-01): a found food heals HP
  // only — the old silent `c.rations++` side effect is removed here in
  // lockstep with the matching decoupling in engine/economy.js's eatRation
  // (the "any food = +1 ration" rule is removed from BOTH acquisition
  // paths together, per 04.1-CONTEXT.md).
  const c = state.c;
  const f = FOODS[rng.d(6) - 1];
  c.wp = Math.min(c.maxWP, c.wp + f.wp);
  events.push({ type: "foodFound", name: f.n, wp: f.wp });
  return events;
}

/**
 * findGrimoire(state, rng, events) — sells an unusable book for gold, or
 * (a Magic User) copies out up to `max(1, d4)` new learnable spells. Ports
 * mazeworld.html findGrimoire() (lines 2165-2173).
 */
export function findGrimoire(state, rng, events = []) {
  const c = state.c;
  if (c.cls !== "Magic User") {
    events.push({ type: "grimoireSold" });
    gainWilmst(state, 150, "grimoire", rng, events);
    return events;
  }
  const learnable = SPELLS.filter((sp) => canLearn(c.sub, sp) && !c.grimoire.includes(sp.n));
  rng.shuffle(learnable);
  const got = learnable.slice(0, Math.max(1, rng.d(4))).map((sp) => sp.n);
  c.grimoire.push(...got);
  events.push({ type: "grimoireLearned", spells: got });
  return events;
}

/**
 * findGear(state, kind, rng, events) — a mundane weapon, a magic weapon, or
 * magic armor via takeItem. Ports mazeworld.html findGear() (lines
 * 2175-2180).
 */
export function findGear(state, kind, rng, events = []) {
  // ECON-03 (Phase 13): OFFER the rolled gear (offerFind) instead of auto-
  // taking it. rollBlade/rollMailPiece still draw the same rng in the same
  // order; offerFind adds none — determinism unchanged.
  if (kind === "weapon") {
    offerFind(state, rollBlade(rng, state.floor.depth, false), events);
    return events;
  }
  if (kind === "magicweapon") {
    offerFind(state, rollBlade(rng, state.floor.depth, true), events);
    return events;
  }
  offerFind(state, rollMailPiece(rng), events);
  return events;
}

/**
 * findMisc(state, rng, events) — the miscellaneous-magic table (d10): a
 * potion, a scroll, a grimoire (recurses into findGrimoire), a cloak, a
 * staff, or jewelry. Ports mazeworld.html findMisc() (lines 2182-2192).
 */
export function findMisc(state, rng, events = []) {
  const c = state.c;
  const what = MISC_MAGIC[rng.d(10) - 1];
  events.push({ type: "miscMagicRolled", what });
  // ECON-03 (Phase 13): OFFER a rolled item (potion/cloak/staff/jewelry)
  // instead of auto-adding it. Each roller still draws the same rng in the same
  // order; offerFind adds none. The Scroll (c.scrolls++) and Grimoire
  // (findGrimoire — sells/learns, no carried item) branches are NOT item adds,
  // so they keep their immediate resolution — nothing to offer.
  if (what === "Potion") {
    const p = POTIONS[rng.d(10) - 1];
    offerFind(state, { kind: "potion", n: `${p.n} potion (${p.col.toLowerCase()})`, txt: p.txt, eff2: p.eff, uses: 1 }, events);
  } else if (what === "Scroll") {
    c.scrolls = (c.scrolls || 0) + 1;
    events.push({ type: "scrollFound" });
  } else if (what === "Grimoire") {
    findGrimoire(state, rng, events);
  } else if (what === "Cloak") {
    offerFind(state, Object.assign({ kind: "cloak" }, CLOAKS[rng.d(8) - 1]), events);
  } else if (what === "Staff") {
    // Phase 39 (GEAR-02): rollStaff (engine/items.js) is the one staff
    // constructor now — same single rng.d(8) draw, charge pool instead of
    // the retired every:250 cooldown.
    offerFind(state, rollStaff(rng), events);
  } else if (what === "Jewelry") {
    offerFind(state, Object.assign({ kind: "jewel" }, JEWELRY[rng.d(8) - 1]), events);
  }
  return events;
}

/**
 * meetFaerie(state, rng, events) — FAERIE[d8]'s gift: a level boost, a base
 * WP swing (up or down), a magic weapon/armor, misc magic, or gold. Ports
 * mazeworld.html meetFaerie() (lines 2194-2208).
 */
export function meetFaerie(state, rng, events = []) {
  const c = state.c;
  const r = rng.d(8);
  const gift = FAERIE[r - 1];
  events.push({ type: "faerieMet", roll: r, gift });
  if (gift === "+1 Level" || gift === "+2 Level") {
    const n = gift === "+2 Level" ? 2 : 1;
    c.sp = Math.max(c.sp, THRESHOLDS[Math.min(4, c.level - 1 + n)]);
    checkLevel(state, rng, events);
  } else if (gift === "+d20 Base HP") {
    const a = rng.d(20);
    c.maxWP += a;
    c.wp += a;
    events.push({ type: "faerieBoon", amount: a });
  } else if (gift === "-d10 Base HP") {
    const a = rng.d(10);
    c.maxWP = Math.max(5, c.maxWP - a);
    c.wp = Math.min(c.wp, c.maxWP);
    events.push({ type: "faerieBane", amount: a });
  } else if (gift === "Magic Weapon") {
    // ECON-03 (Phase 13): OFFER the faerie's gift (offerFind) instead of auto-
    // taking it; the roll order is unchanged, offerFind adds no rng.
    offerFind(state, rollBlade(rng, state.floor.depth, true), events);
  } else if (gift === "Magic Armor") {
    offerFind(state, rollMailPiece(rng), events);
  } else if (gift === "Miscellaneous Magic") {
    findMisc(state, rng, events);
  } else if (gift === "d10 x 100 wilmst") {
    gainWilmst(state, rng.d(10) * 100, "faerie", rng, events);
  }
  return events;
}

/**
 * meetJoiner(state, rng, events) — an NPC ally rolled via rollCharacter joins
 * for `SPELL_LEVEL_TABLE[d10]` levels of fight. Ports mazeworld.html
 * meetJoiner() (lines 2210-2217). NOTE (fidelity): the prototype rolls TWO
 * separate `D(20)` draws (`wp: 20*lvl+D(20), maxWP: 20*lvl+D(20)`) then
 * immediately overwrites `maxWP` with `wp`, discarding the second roll's
 * computed value — but the roll itself is still consumed from the stream.
 * Preserved verbatim so the same seed draws the same subsequent rolls.
 *
 * DELIBERATE RULES CHANGE (Phase 36, 2026-09-17, CUT-01): the Phase 24
 * Cutthroat refusal is REVERSED — a Joiner now travels with a Cutthroat
 * like any other hero (the offer proceeds through resolveJoiner unchanged);
 * the Cutthroat's bad is instead the per-descent murder risk in
 * movement.js#cutthroatMurderCheck (CUT-02). A Magic User Joiner still
 * refuses a Wilmsry (any other class still joins a Wilmsry normally).
 * Rationale: "no Joiner ever" made a whole party feature unreachable for
 * one sub-class; a stated 1-in-20 loss keeps the identity (the reputation)
 * and the joke. Zero rng change: the four draws are untouched; the refusal
 * remains a pure read.
 *
 * After the joiner is rolled EXACTLY as above (all four draws unchanged,
 * `c.joiner` set identically either way), a pure read decides whether the
 * joiner will travel with this hero. On a refusal `state.pendingJoiner` is
 * simply left null (never touched — every caller reaches this function
 * with it already null) and a `joinerRefused` event is pushed after
 * `joinerMet`. Zero new rng draws either way.
 */
export function meetJoiner(state, rng, events = []) {
  const c = state.c;
  const lvl = SPELL_LEVEL_TABLE[rng.d(10) - 1];
  const joinerChar = rollCharacter(rng);
  const wp = 20 * lvl + rng.d(20);
  // eslint-disable-next-line no-unused-vars -- consumed for RNG-order fidelity only
  const discardedMaxWP = 20 * lvl + rng.d(20);
  // Phase 38 (ABIL-05): the Joiner's own level-pool picks, from a DERIVED
  // stream keyed by name+depth (never the main `rng`) — zero draws off this
  // function's four fixed draws above, so they stay byte-identical. Rolled
  // onto `joinerChar` (the sheet `pendingJoiner` spreads below) BEFORE
  // `c.joiner`'s frozen 7-key shape is built, so `c.joiner` never gains a
  // field and the joinerMet event stays exactly as before.
  grantLevelAbilities(joinerChar, `joiner:${joinerChar.name}:${state.floor.depth}`, lvl);
  c.joiner = { name: joinerChar.name, race: joinerChar.race, sub: joinerChar.sub, cls: joinerChar.cls, lvl, wp, maxWP: wp };
  const refusal = c.race === "Wilmsry" && joinerChar.cls === "Magic User" ? "wilmsry" : null;
  events.push({ type: "joinerMet", name: joinerChar.name, race: joinerChar.race, sub: joinerChar.sub, lvl });
  if (refusal) {
    events.push({ type: "joinerRefused", reason: refusal, name: joinerChar.name, sub: joinerChar.sub, cls: joinerChar.cls, lvl });
    return events;
  }
  // PARTY-01 (Phase 9): stash the FULL already-rolled joiner sheet as a pending
  // recruitment candidate for resolveJoiner to accept/decline — NO new rng
  // draw. We reuse the already-rolled `joinerChar` (spread whole so the member
  // carries a real rollCharacter-shaped sheet) and the already-drawn joiner
  // `wp`/`lvl`; only plain data overrides follow. The spread's own `level: 1`
  // is overridden to the joiner `lvl` so Phase 8's startCombat/alliesTurn
  // (which read `m.level ?? m.lvl`) fight the member at its rolled joiner level,
  // and `wp`/`maxWP` are set to the joiner's fight pool. This is a top-level
  // SIBLING field (like `party`), carved out of every parity comparison the
  // same way `state.party` is, so it never shifts the frozen master and adds no
  // draw. `c.joiner` + the `joinerMet` event above stay byte-identical.
  state.pendingJoiner = { ...joinerChar, lvl, level: lvl, wp, maxWP: wp };
  return events;
}

/**
 * resolveJoiner(state, accept, events) — the pure (NO rng) accept/decline of a
 * pending recruitment stashed by meetJoiner (PARTY-01, Phase 9). DELIBERATE
 * RULES CHANGE, Phase 25.1, 2026-09-15 (DFB-04): on accept with a candidate,
 * swapPartyMember (engine/state.js) is always used instead of addPartyMember
 * — under PARTY_CAP it just appends (no `left`); at PARTY_CAP it SWAPS the
 * longest-serving member out. When a member is swapped out, a `joinerLeft`
 * event (`{ name, sub, replacedBy }`) is pushed BEFORE `joinerJoined` so the
 * presentation layer can narrate the exit first. Declining (or no candidate)
 * pushes `joinerDeclined` and leaves the roster untouched. `state.pendingJoiner`
 * is ALWAYS cleared. Still draws zero rng — plain data bookkeeping — so it
 * never shifts the seeded cursor; it is not part of any parity fixture (no
 * fixture ever meets a Joiner).
 */
export function resolveJoiner(state, accept, events = []) {
  const pending = state.pendingJoiner;
  if (accept && pending) {
    const { left } = swapPartyMember(state, pending);
    if (left) {
      events.push({ type: "joinerLeft", name: left.name, sub: left.sub, replacedBy: pending.name });
    }
    events.push({ type: "joinerJoined", name: pending.name, sub: pending.sub, lvl: pending.lvl });
  } else {
    events.push({ type: "joinerDeclined", name: pending ? pending.name : undefined });
  }
  state.pendingJoiner = null;
  return events;
}

/**
 * dismissJoiner(state, i = 0, events) — Phase 36 (JOIN-01): the player sends
 * a party member away from the Hero tab's Company panel (the shell asks for
 * a confirmation first; the engine never assumes one). Pure, NO rng (a plain
 * roster splice, like resolveJoiner/swapPartyMember) so it never shifts the
 * seeded cursor; not part of any parity fixture. Order of checks: a fight in
 * progress keeps its allies (endCombat syncs them) so `state.combat` truthy
 * refuses "inCombat" FIRST; then an empty/missing roster refuses "noParty";
 * then an out-of-range index refuses "badIndex"; otherwise the member at `i`
 * (default 0) is spliced out and a `joinerDismissed { name, sub }` event is
 * pushed. Never adds a key to state.
 */
export function dismissJoiner(state, i = 0, events = []) {
  if (state.combat) {
    events.push({ type: "dismissRefused", reason: "inCombat" });
    return events;
  }
  if (!Array.isArray(state.party) || state.party.length === 0) {
    events.push({ type: "dismissRefused", reason: "noParty" });
    return events;
  }
  if (!state.party[i]) {
    events.push({ type: "dismissRefused", reason: "badIndex" });
    return events;
  }
  const [gone] = state.party.splice(i, 1);
  events.push({ type: "joinerDismissed", name: gone.name, sub: gone.sub });
  return events;
}

/**
 * catchAffliction(state, rng, events) — AFFLICTIONS[d8]: a permanent phobia
 * row sets one via PHOBIAS[d10], otherwise a periodic wp-loss affliction is
 * set with an immediate first tick. Ports mazeworld.html catchAffliction()
 * (lines 2219-2228).
 */
export function catchAffliction(state, rng, events = []) {
  const c = state.c;
  const r = rng.d(8);
  const a = AFFLICTIONS[r - 1];
  events.push({ type: "afflictionRolled", roll: r, kind: a.kind });
  if (a.phobia) {
    const ph = PHOBIAS[rng.d(10) - 1];
    c.phobia = ph.n;
    c.phobiaType = ph.t;
    events.push({ type: "phobiaAcquired", name: ph.n });
    return events;
  }
  c.affliction = { kind: a.kind, loss: a.loss, per: a.per, left: rng.d(20) };
  const first = Math.min(rollDice(rng, a.loss), Math.max(0, c.wp - 1));
  c.wp -= first;
  events.push({ type: "afflictionCaught", kind: a.kind, first });
  return events;
}

/**
 * goInsane(state, rng, events) — INSANITY[d6]: self-harm, a teleport, or a
 * damage-boosting rage; a lethal self-harm dies via die("insanity"). Ports
 * mazeworld.html goInsane() (lines 2230-2238).
 */
export function goInsane(state, rng, events = []) {
  const c = state.c;
  const r = rng.d(6);
  events.push({ type: "insanityRolled", roll: r, result: INSANITY[r - 1] });
  if (r === 1) {
    const before = c.wp;
    c.wp = Math.ceil(c.wp / 2);
    // Phase 43 (CLAR-01, additive): loss names the cause for the
    // narration; fixtures compare state, so this moves none.
    events.push({ type: "insanitySelfHarm", loss: before - c.wp });
  } else if (r === 3) {
    teleport(state, rng, events);
  } else if (r === 5) {
    c.might = rng.d(10);
    events.push({ type: "insanityRage", amount: c.might });
  }
  if (c.wp <= 0) die(state, "insanity", null, rng, events);
  return events;
}

/** newPhobia(state, rng, events) — ports mazeworld.html newPhobia() (lines 2240-2245). */
export function newPhobia(state, rng, events = []) {
  const c = state.c;
  const ph = PHOBIAS[rng.d(10) - 1];
  c.phobia = ph.n;
  c.phobiaType = ph.t;
  events.push({ type: "phobiaAcquired", name: ph.n });
  return events;
}

// A "Darkness" table result's persistent-condition duration, in steps.
// DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01) — see fallDark
// below.
const DARKNESS_DURATION = 30;

/**
 * fallDark(state, rng, events) — darkens a 4-square radius around the
 * player. Ports mazeworld.html fallDark() (lines 2247-2255). No RNG.
 *
 * DELIBERATE RULES CHANGE (04.1-05, 2026-09-09, PHOBIA-01): the prototype's
 * "Darkness" content-table result only ever painted a local 4-square radius
 * of tiles `.dark = true` — a purely cosmetic effect once the player
 * stepped off those specific tiles, and one of the phase-04.1 rules audit's
 * flagged "inert table effects." Per the phase's PHOBIA-01 directive (and
 * the user's explicit steer), this now ALSO sets a persistent darkness
 * counter (`state.c.darkFor`, in steps) so the table result has lasting
 * mechanical weight: while the counter is active, engine/derived.js's
 * inDark(state) reads true regardless of the player's current tile, which
 * shrinks revealRadius and applies the existing in-dark to-hit penalty
 * (Night Vision still waives both, since its checks already wrap inDark);
 * engine/movement.js's per-step tick decrements and clears it. This is a
 * plain assignment — no rng draw added — so determinism/parity are
 * unaffected.
 *
 * Phase 39 (GEAR-05): a live torch `lit` effect (`itemEffectActive(state.c,
 * "lit")`) holds this off entirely — one `darknessResisted` event, no tile
 * painted, `c.darkFor` left exactly as it was (0 for a torch-carrying
 * character who was not already dark). The torch touches ONLY `c.darkFor`
 * — Phase 41 owns the tile `.dark` model, unaffected either way.
 */
export function fallDark(state, rng, events = []) {
  if (itemEffectActive(state.c, "lit")) {
    events.push({ type: "darknessResisted", by: "torch" });
    return events;
  }
  const f = state.floor;
  const r = 4;
  for (let y = f.py - r; y <= f.py + r; y++)
    for (let x = f.px - r; x <= f.px + r; x++) if (f.g[y] && f.g[y][x] && !f.g[y][x].wall) f.g[y][x].dark = true;
  state.c.darkFor = DARKNESS_DURATION;
  events.push({ type: "darknessFell", nightVision: skill(state.c, "Night Vision"), duration: DARKNESS_DURATION });
  return events;
}
