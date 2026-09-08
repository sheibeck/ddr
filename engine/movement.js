// engine/movement.js
//
// The movement domain (ENG-01, ENG-05) — the first rule domain routed
// through applyAction, and the walking skeleton's proof slice. Ports
// mazeworld.html's move/newDay/makeCamp/teleport/bestTeleportDir/descend/
// winGame (lines 1614-1868), replacing every D()/pick()-backed Math.random()
// draw with the injected engine rng (in the prototype's exact consumption
// order), and every say()/evt()/beginEvent() narration call with a pushed
// `{type, ...}` event. No DOM, no localStorage, no Math.random, no global S
// — every function here takes an explicit `state` (already a fresh
// applyAction clone) and mutates it directly, matching the applyAction seam.
//
// Feature-tile dispatch on the destination cell ("dot"/"trap"/"chest"/
// "tele"/"exit"/"gate") is fully wired as of 01-10: "dot"/"trap"/"chest" now
// call the real encounterDot/springTrap/openChest handlers from
// engine/encounters.js (the 01-07/01-09 stubs that only pushed a "pending*"
// event are gone), alongside the already-complete "tele" (teleport) and
// "exit"/"gate" (descend/winGame) paths. Circular import with
// engine/encounters.js (encounterDot/springTrap/openChest call back into
// teleport() here; move()/teleport() call them) is safe — see
// engine/encounters.js's header comment for why.

import { GW, GH, genFloor, reveal } from "./maze.js";
import { skill, skillTier, upkeep, eff } from "./derived.js";
import { rollDice } from "./dice.js";
import { die, epitaphFor, epitaphCtx } from "./death.js";
import { checkLevel } from "./character.js";
import { startCombat } from "./combat.js";
import { encounterDot, springTrap, openChest } from "./encounters.js";
import { moved, floorChanged, won } from "./events.js";
import { CLIMB_TABLE, LEAP_TABLE, DIRECTION_TABLE, RACES } from "../content/index.js";

/** DIRV — the four cardinal direction vectors. Ports mazeworld.html line 1615. */
export const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** climbBonus/leapBonus(c) — ports mazeworld.html lines 1467-1468. */
const climbBonus = (c) => (skill(c, "Climbing") ? 4 : 0);
const leapBonus = (c) => (skill(c, "Leaping") ? 2 : 0);

/** maxCharges(c) — a Magic User's spell charges. Ports mazeworld.html line 914. */
export const maxCharges = (c) => 2 * c.level + 2 + eff(c, "charges");

/* ---------------- movement ---------------- */

/**
 * move(state, dir, rng, events, now) — the core traversal action. Ports
 * mazeworld.html move() (lines 1618-1715). Mutates `state` (a fresh
 * applyAction clone) in place and pushes structured events; returns
 * `events`. A wall/out-of-bounds move, or a one-way door entered/exited from
 * the wrong side, is a no-op: no state mutation beyond (for the door case) a
 * pushed event.
 */
export function move(state, dir, rng, events = [], now = Date.now) {
  if (state.combat || state.store || state.dead || state.won) return events;

  const f = state.floor;
  const [dx, dy] = DIRV[dir];
  const nx = f.px + dx;
  const ny = f.py + dy;
  if (!f.g[ny] || !f.g[ny][nx] || f.g[ny][nx].wall) return events;

  const here = f.g[f.py][f.px];
  const there = f.g[ny][nx];
  if (there.feat === "one" && there.dir !== dir) {
    events.push({ type: "oneWayBlocked", side: "approach" });
    return events;
  }
  if (here.feat === "one" && here.dir !== dir) {
    events.push({ type: "oneWayBlocked", side: "departure" });
    return events;
  }

  // p.49: climbing is a d10 per ten feet by wall type; leaping is a d10 by
  // distance and class.
  if (there.feat === "climb" || there.feat === "gorge") {
    const climbing = there.feat === "climb";
    let ok = true;
    let hurt = 0;
    if (climbing) {
      const kind = rng.pick(["rope", "rock", "wood"]);
      const tbl = CLIMB_TABLE[kind];
      const feet = 10 * (1 + rng.d(2));
      for (let ft = 0; ft < feet && ok; ft += 10) {
        const r = rng.d(10) - climbBonus(state.c);
        if (r <= tbl.success) continue;
        ok = false;
        for (let g = 0; g <= ft; g += 10) if (rng.d(20) > 2) hurt += rollDice(rng, tbl.fall);
        if (skill(state.c, "Climbing")) hurt = Math.ceil(hurt / 2);
      }
    } else {
      const row = LEAP_TABLE[rng.d(4) - 1];
      const need = state.c.cls === "Fighter" ? row.F : state.c.cls === "Thief" ? row.T : row.M;
      const r = rng.d(10) - leapBonus(state.c);
      if (r > need) {
        ok = false;
        hurt = rng.d(6) + rng.d(6);
        if (skill(state.c, "Climbing")) hurt = Math.ceil(hurt / 2);
      }
    }
    if (!ok) {
      state.c.wp -= hurt;
      events.push({ type: climbing ? "fellClimbing" : "fellInGorge", hurt });
      if (state.c.wp <= 0) die(state, climbing ? "fall" : "gorge", null, rng, events, now);
      return events;
    }
    events.push({ type: climbing ? "climbedOver" : "leaptOver" });
    there.feat = null;
  }

  f.px = nx;
  f.py = ny;
  state.steps++;
  reveal(f);
  events.push(moved({ x: nx, y: ny }));

  const c = state.c;
  if (c.affliction) {
    const af = c.affliction;
    if (state.steps % af.per === 0) {
      const l = Math.min(rollDice(rng, af.loss), Math.max(0, c.wp - 1));
      c.wp -= l;
      events.push({ type: "afflictionTick", kind: af.kind, loss: l });
      if (--af.left <= 0) {
        c.affliction = null;
        events.push({ type: "afflictionPassed" });
      }
    }
  }
  if (c.haste > 0) c.haste--;
  if (c.invis > 0) c.invis--;
  if (c.ether > 0) c.ether--;

  // the book recharges a Magic User every hundred squares; a solo caster
  // needs it oftener.
  if (c.cls === "Magic User" && state.steps % 20 === 0 && c.spellsUsed > 0) {
    c.spellsUsed--;
    events.push({ type: "spellChargeRecovered", charges: maxCharges(c) - c.spellsUsed, max: maxCharges(c) });
  }

  if (state.steps % 100 === 0) newDay(state, false, rng, events, now);
  if (state.dead) return events;

  const cell = f.g[ny][nx];
  if (state.combat) return events; // a wandering monster already found you (01-08)
  if (cell.feat === "dot") {
    cell.feat = null;
    encounterDot(state, rng, events);
  } else if (cell.feat === "trap") {
    cell.feat = null;
    springTrap(state, rng, events);
  } else if (cell.feat === "chest") {
    cell.feat = null;
    openChest(state, rng, events);
  } else if (cell.feat === "tele") {
    cell.feat = null;
    teleport(state, rng, events);
  } else if (cell.feat === "exit") {
    descend(state, rng, events);
  } else if (cell.feat === "gate") {
    winGame(state, rng, events, now);
  }

  return events;
}

/* ---------------- day cycle / camp ---------------- */

/**
 * newDay(state, camped, rng, events, now) — ports mazeworld.html newDay()
 * (lines 1717-1772). Advances the day counter, resolves upkeep/rations
 * (starving into `die("starve")` when unfed and out of wp), rests, and rolls
 * the 8-hour wandering-monster check, starting a forced-random encounter via
 * combat.js's startCombat when at least one hour is disturbed (01-08).
 */
export function newDay(state, camped, rng, events = [], now = Date.now) {
  const c = state.c;
  state.day++;
  c.spellsUsed = 0;
  c.might = 0;
  if (c.strengthBoost) {
    c.maxWP -= c.strengthBoost;
    c.wp = Math.min(c.wp, c.maxWP);
    c.strengthBoost = 0;
  }
  const R = RACES[c.race];
  const cost = upkeep(c);
  const eats = R.eats || 1;
  events.push({ type: "dayBegan", day: state.day, camped: !!camped });

  if (c.rations >= eats) {
    c.rations -= eats;
    let heal = rng.d(10) + 2 * c.level;
    if (R.heal2x || c.sub === "Soldier") heal *= 2;
    const before = c.wp;
    c.wp = Math.min(c.maxWP, c.wp + heal);
    if (c.wp > before) events.push({ type: "rested", amount: c.wp - before });

    if (c.affliction) {
      c.affliction = null;
      events.push({ type: "afflictionCured" });
    }

    // Patching armour by the fire: Sewing for thieves, Master of Arms for
    // fighters. NOTE (fidelity, not a bug): the prototype's condition reads
    // `S.c.dr`, a field `rollCharacter()` never sets anywhere in
    // mazeworld.html — this branch is unreachable dead code in the shipped
    // prototype (mazeworld.html lines 1737-1754). Ported verbatim rather
    // than "fixed" to `c.ar`, per the project's fidelity rule (deviations
    // from the canon prototype must be deliberate, not accidental).
    if (c.armorWP < c.armorMax && c.dr > 0) {
      const tier = skillTier(c, "Sewing");
      const maxPatch = tier === 2 ? 6 : 4;
      if (tier && c.patches < maxPatch) {
        const amt = tier === 2 ? rng.d(6) + 3 : rng.d(6);
        c.armorWP = Math.min(c.armorMax, c.armorWP + amt);
        c.patches++;
        events.push({ type: "armorPatched", amount: amt });
      } else if (c.sub === "Master of Arms") {
        const amt = rng.d(6) + 3;
        c.armorWP = Math.min(c.armorMax, c.armorWP + amt);
        events.push({ type: "armorPatched", amount: amt });
      } else {
        const amt = rng.d(4);
        c.armorWP = Math.min(c.armorMax, c.armorWP + amt);
        events.push({ type: "armorPatched", amount: amt });
      }
    }
    // a Warlock can copy a potion once a week
    if (c.sub === "Warlock" && state.day - (c.dupAt || 0) >= 7 && c.potions > 0) {
      c.dupAt = state.day;
      c.potions++;
      events.push({ type: "potionDuplicated" });
    }
  } else {
    c.wp -= cost;
    events.push({ type: "wentHungry", cost });
    if (c.wp <= 0) {
      die(state, "starve", null, rng, events, now);
      return events;
    }
  }

  // wandering monsters: d20 per hour slept, a 1 wakes you
  let woke = 0;
  for (let h = 0; h < 8; h++) if (rng.d(20) === 1) woke++;
  if (woke) {
    events.push({ type: "wanderingMonster", hours: woke });
    startCombat(state, true, null, rng, events);
  }
  return events;
}

/**
 * makeCamp(state, rng, events, now) — ports mazeworld.html makeCamp() (lines
 * 1774-1785). Refuses to camp without enough rations for the night; otherwise
 * runs a `camped` newDay.
 */
export function makeCamp(state, rng, events = [], now = Date.now) {
  if (state.combat || state.store || state.dead || state.won) return events;
  const R = RACES[state.c.race];
  const eats = R.eats || 1;
  if (state.c.rations < eats) {
    events.push({ type: "campFailed", reason: "noRations" });
    return events;
  }
  return newDay(state, true, rng, events, now);
}

/* ---------------- teleport ---------------- */

/**
 * teleport(state, rng, events) — ports mazeworld.html teleport() (lines
 * 1787-1832). An Illusionist chooses the best direction and travels a fixed
 * 12 squares; everyone else rolls 2d8 for direction (contradictory rolls
 * favor the first) and d20 for distance, falling back toward the nearest
 * open square (never off the map) if the full distance would leave the maze.
 */
export function teleport(state, rng, events = []) {
  const c = state.c;
  const illusionist = c.sub === "Illusionist";
  let dir;
  let other = null;
  if (illusionist) {
    dir = bestTeleportDir(state);
  } else {
    const a = DIRECTION_TABLE[rng.d(8) - 1];
    const b = DIRECTION_TABLE[rng.d(8) - 1];
    dir = a;
    other = b;
  }
  const dist = illusionist ? 12 : rng.d(20);
  const f = state.floor;

  let x = f.px;
  let y = f.py;
  let travelled = 0;
  let used = dir;
  const tryDir = (dd) => {
    const [ax, ay] = DIRV[dd];
    for (let d = dist; d >= 1; d--) {
      const nx = f.px + ax * d;
      const ny = f.py + ay * d;
      if (nx < 1 || ny < 1 || nx > GW - 2 || ny > GH - 2) continue; // never off the map
      if (f.g[ny][nx].wall) continue; // land on floor, not in stone
      return [nx, ny, d];
    }
    return null;
  };
  // the rolled direction first, then the second roll, then whatever the maze
  // allows — a teleport square always moves you somewhere.
  const order = [dir, other, "N", "S", "E", "W"].filter((d, i, a) => d && a.indexOf(d) === i);
  let hit = null;
  for (const d of order) {
    hit = tryDir(d);
    if (hit) {
      used = d;
      break;
    }
  }
  if (hit) {
    x = hit[0];
    y = hit[1];
    travelled = hit[2];
  }
  f.px = x;
  f.py = y;
  reveal(f);
  events.push({ type: "teleported", dir, other, dist, used, travelled, to: { x, y } });

  const cell = f.g[y][x];
  if (cell.feat === "dot") {
    cell.feat = null;
    encounterDot(state, rng, events);
  }
  if (cell.feat === "trap") {
    cell.feat = null;
    springTrap(state, rng, events);
  }
  return events;
}

/**
 * bestTeleportDir(state) — the longest clear run from where you stand (an
 * Illusionist's teleport is a choice, not a roll). Ports mazeworld.html
 * bestTeleportDir() (lines 1834-1844). No RNG.
 */
export function bestTeleportDir(state) {
  const f = state.floor;
  let best = "N";
  let bestRun = -1;
  for (const d of ["N", "S", "E", "W"]) {
    const [dx, dy] = DIRV[d];
    let x = f.px;
    let y = f.py;
    let run = 0;
    while (run < 12) {
      const nx = x + dx;
      const ny = y + dy;
      if (!f.g[ny] || !f.g[ny][nx] || f.g[ny][nx].wall) break;
      x = nx;
      y = ny;
      run++;
    }
    if (run > bestRun) {
      bestRun = run;
      best = d;
    }
  }
  return best;
}

/* ---------------- descend / win ---------------- */

/**
 * descend(state, rng, events) — ports mazeworld.html descend() (lines
 * 1846-1856). Awards the depth-scaled skill-point bonus, checks for a level
 * up, then generates and reveals the next floor (a fixed 5-floor Gate stays
 * intact behind this contract; endless descent is Phase 3).
 */
export function descend(state, rng, events = []) {
  const bonus = 40 + 30 * state.floor.depth;
  state.c.sp += bonus;
  events.push({ type: "spGained", amount: bonus, reason: "descend" });
  checkLevel(state, rng, events);
  state.floor = genFloor(state.floor.depth + 1, rng);
  reveal(state.floor);
  events.push(floorChanged(state.floor.depth));
  return events;
}

/**
 * winGame(state, rng, events, now) — ports mazeworld.html winGame() (lines
 * 1858-1868), minus paint()/renderEncounter() (presentation) and bury()
 * (owned by the persistence layer, matching engine/death.js's pattern: the
 * caller supplies the current graveyard array and calls `bury` itself once
 * it has one to persist). Sets `state.won`, NOT `state.dead` — a winner
 * keeps walking, they just already won.
 */
export function winGame(state, rng, events = [], now = Date.now) {
  state.won = true;
  state.deathAt = now();
  state.deathNote = "walked out";
  state.epitaph = epitaphFor("won", epitaphCtx(state), rng);
  events.push(won(state.c.level, state.day, state.steps));
  return events;
}
