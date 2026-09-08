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

import { skill, skillTier, canLearn } from "./derived.js";
import { rollDice } from "./dice.js";
import { die } from "./death.js";
import { checkLevel, rollCharacter } from "./character.js";
import { giveItem, takeItem, gainWilmst, hasPicks, rollBlade, rollMailPiece, rollTreasureItem, LOOT_DIVISOR } from "./items.js";
import { startCombat } from "./combat.js";
import { openStore } from "./economy.js";
import { teleport } from "./movement.js";
import {
  TRAPS,
  AFFLICTIONS,
  ENCOUNTER_TABLES,
  ENC_ALIAS,
  FOODS,
  POTIONS,
  SPELLS,
  CLOAKS,
  STAVES,
  JEWELRY,
  MISC_MAGIC,
  FAERIE,
  PHOBIAS,
  SPELL_LEVEL_TABLE,
  THRESHOLDS,
  INSANITY,
} from "../content/index.js";

/**
 * springTrap(state, rng, events) — Agility/Leaping/Acrobat dodge, a Pilfer's
 * free disarm, TRAPS[d8] damage (Cat Burglar doubles it, Hardiness reduces
 * it), a poisoned arrow's affliction, and die() on lethal. Ports
 * mazeworld.html springTrap() (lines 2065-2079).
 */
export function springTrap(state, rng, events = []) {
  const c = state.c;
  const nimble = 5 + (skill(c, "Agility") ? 2 : 0) + (skill(c, "Leaping") ? 1 : 0) + (c.sub === "Acrobat" ? 3 : 0);
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
  if (c.sub === "Pilfer") {
    opened = true;
    events.push({ type: "chestOpened", reason: "pilfer" });
  } else if (tier) {
    const need = [0, 5, 7, 8][Math.min(tier, 3)];
    const roll = rng.d(10);
    opened = roll <= need;
    events.push({ type: "chestLockRolled", roll, need, dieN: 10, picks: hasPicks(c), opened });
  } else {
    const roll = rng.d(20);
    opened = roll <= 8;
    events.push({ type: "chestLockRolled", roll, need: 8, dieN: 20, picks: false, opened });
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
  takeItem(state, rollTreasureItem(rng, state.floor.depth, c), events);
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
    case "Disease":
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

/**
 * tableFour(state, result, rng, events) — Table 4 on p.45, a straight list
 * of things that happen to you. Ports mazeworld.html tableFour() (lines
 * 2141-2155).
 */
export function tableFour(state, result, rng, events = []) {
  const c = state.c;
  switch (result) {
    case "+10 WP":
      c.wp = Math.min(c.maxWP, c.wp + 10);
      events.push({ type: "tableFour", result });
      break;
    case "-10 WP":
      c.wp -= 10;
      events.push({ type: "tableFour", result });
      break;
    case "+10 SP":
      c.sp += 10;
      events.push({ type: "tableFour", result });
      checkLevel(state, rng, events);
      break;
    case "+25 WP":
      c.maxWP += 25;
      c.wp += 25;
      events.push({ type: "tableFour", result });
      break;
    case "+25 SP":
      c.sp += 25;
      events.push({ type: "tableFour", result });
      checkLevel(state, rng, events);
      break;
    case "-15 WP":
      c.wp -= 15;
      events.push({ type: "tableFour", result });
      break;
    case "+3000 WM":
      gainWilmst(state, 3000, "tableFour", rng, events);
      events.push({ type: "tableFour", result });
      break;
    case "-All armour":
      c.armor = "Nothing";
      c.ar = 0;
      c.armorWP = 0;
      c.armorMax = 0;
      events.push({ type: "tableFour", result });
      break;
    default:
      events.push({ type: "tableFourNoop", result });
  }
  if (c.wp <= 0) die(state, "maze", null, rng, events);
  return events;
}

/** findFood(state, rng, events) — ports mazeworld.html findFood() (lines 2157-2163). */
export function findFood(state, rng, events = []) {
  const c = state.c;
  const f = FOODS[rng.d(6) - 1];
  c.wp = Math.min(c.maxWP, c.wp + f.wp);
  c.rations++;
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
  if (kind === "weapon") {
    takeItem(state, rollBlade(rng, state.floor.depth, false), events);
    return events;
  }
  if (kind === "magicweapon") {
    takeItem(state, rollBlade(rng, state.floor.depth, true), events);
    return events;
  }
  takeItem(state, rollMailPiece(rng), events);
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
  if (what === "Potion") {
    const p = POTIONS[rng.d(10) - 1];
    giveItem(state, { kind: "potion", n: `${p.n} potion (${p.col.toLowerCase()})`, txt: p.txt, eff2: p.eff, uses: 1 }, false, events);
  } else if (what === "Scroll") {
    c.scrolls = (c.scrolls || 0) + 1;
    events.push({ type: "scrollFound" });
  } else if (what === "Grimoire") {
    findGrimoire(state, rng, events);
  } else if (what === "Cloak") {
    takeItem(state, Object.assign({ kind: "cloak" }, CLOAKS[rng.d(8) - 1]), events);
  } else if (what === "Staff") {
    takeItem(state, Object.assign({ kind: "staff", every: 250 }, STAVES[rng.d(8) - 1]), events);
  } else if (what === "Jewelry") {
    takeItem(state, Object.assign({ kind: "jewel" }, JEWELRY[rng.d(8) - 1]), events);
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
  } else if (gift === "+d20 Base WP") {
    const a = rng.d(20);
    c.maxWP += a;
    c.wp += a;
    events.push({ type: "faerieBoon", amount: a });
  } else if (gift === "-d10 Base WP") {
    const a = rng.d(10);
    c.maxWP = Math.max(5, c.maxWP - a);
    c.wp = Math.min(c.wp, c.maxWP);
    events.push({ type: "faerieBane", amount: a });
  } else if (gift === "Magic Weapon") {
    takeItem(state, rollBlade(rng, state.floor.depth, true), events);
  } else if (gift === "Magic Armor") {
    takeItem(state, rollMailPiece(rng), events);
  } else if (gift === "Miscellaneous Magic") {
    findMisc(state, rng, events);
  } else if (gift === "d10 x 100 WM") {
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
 */
export function meetJoiner(state, rng, events = []) {
  const c = state.c;
  const lvl = SPELL_LEVEL_TABLE[rng.d(10) - 1];
  const joinerChar = rollCharacter(rng);
  const wp = 20 * lvl + rng.d(20);
  // eslint-disable-next-line no-unused-vars -- consumed for RNG-order fidelity only
  const discardedMaxWP = 20 * lvl + rng.d(20);
  c.joiner = { name: joinerChar.name, race: joinerChar.race, sub: joinerChar.sub, cls: joinerChar.cls, lvl, wp, maxWP: wp };
  events.push({ type: "joinerMet", name: joinerChar.name, race: joinerChar.race, sub: joinerChar.sub, lvl });
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
    c.wp = Math.ceil(c.wp / 2);
    events.push({ type: "insanitySelfHarm" });
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

/**
 * fallDark(state, rng, events) — darkens a 4-square radius around the
 * player. Ports mazeworld.html fallDark() (lines 2247-2255). No RNG.
 */
export function fallDark(state, rng, events = []) {
  const f = state.floor;
  const r = 4;
  for (let y = f.py - r; y <= f.py + r; y++)
    for (let x = f.px - r; x <= f.px + r; x++) if (f.g[y] && f.g[y][x] && !f.g[y][x].wall) f.g[y][x].dark = true;
  events.push({ type: "darknessFell", nightVision: skill(state.c, "Night Vision") });
  return events;
}
