// engine/phobias.js
//
// Phase 41 (TERR-04/05) — the user-chosen Key Decision "Arm Afraid for the
// next fight" (41-CONTEXT.md Area 3, ratified 2026-09-18): a region model
// (`c.phobiaState`) that fires each terrain phobia exactly once on fresh
// entry into its region, narrates immediately on the rail with the trigger
// named, and arms a zero-rng `c.fearArmed` flag that engine/combat.js#fight
// reads as a fourth OR-condition — so the NEXT fight opens Afraid through
// the real Phase 31 mechanism (afraidNeed/afraidDamage), never a lost
// action; the arm is consumed by that fight, whether or not Hardiness
// shrugs it off. Existing mechanics (heightsPenalty/waterPenalty on the
// climb/leap roll itself, trappedPanic's flat hp loss) are UNTOUCHED — the
// two penalties land on two different rolls (the climb/leap/tile event vs.
// a future combat strike), so nothing is double-counted (41-RESEARCH.md
// Pitfall 2).
//
// The region model: a small `c.phobiaState` map (`{ [phobia]: true|false }`
// for the three plain-region phobias, a tile-key STRING for Heights, a
// boolean for Death) — a trigger fires when the condition becomes true from
// false, stays silent while it remains true, and re-arms when it becomes
// false again (left the water / left the dark / off the dead end / more
// than one square from the attempted climb/gorge tile / hp back above the
// Death re-arm line). The map is created ONLY on a first trigger — a
// character whose phobia is not one of the five TERRAIN_PHOBIAS never gains
// `c.phobiaState`/`c.fearArmed` at all (no key creation).
//
// Every function here mutates only `state.c.phobiaState`/`state.c.fearArmed`
// and pushes `phobiaTriggered` events — zero rng draws anywhere in this
// file. A cycle-free leaf: imports ONLY from ./derived.js.

import { inDark, DEATH_PANIC_THRESHOLD } from "./derived.js";

/** TERRAIN_PHOBIAS — the five phobias this region model governs (the five
 * `t: null` entries in content/flavor.js#PHOBIAS). The five type-matched
 * combat phobias (Bats and rats, Vampires and the undead, Fire, Sorcery,
 * Crowds) are untouched by this module — they still fire only at fight()
 * exactly as before Phase 41. */
export const TERRAIN_PHOBIAS = Object.freeze(["Bodies of water", "Darkness", "Heights", "Being trapped", "Death"]);

/** PHOBIA_TRIGGER_KEY — the short `trigger` payload vocabulary pushed on
 * every phobiaTriggered event and stashed on `c.fearArmed.trigger`; the
 * shell (src/browser/eventNarration.js#PHOBIA_TRIGGER_PHRASE) maps these
 * short keys to the narrated phrase. */
export const PHOBIA_TRIGGER_KEY = Object.freeze({
  "Bodies of water": "water",
  Darkness: "dark",
  Heights: "heights",
  "Being trapped": "deadEnd",
  Death: "nearDeath",
});

/** DEATH_REARM_FRACTION — Death's region re-arms only once hp climbs back
 * ABOVE half of maxWP (user-chosen, 41-CONTEXT.md Area 3) — deliberately a
 * wide hysteresis band above DEATH_PANIC_THRESHOLD's own 25% entry line, so
 * a hero hovering near 25% does not re-trigger on every single hp tick. */
export const DEATH_REARM_FRACTION = 0.5;

// DIRV4 — the four cardinal direction vectors (N, S, E, W order), a local
// equivalent of engine/movement.js's own DIRV/Object.values(DIRV) order.
// Duplicated here (not imported from movement.js) so this module stays a
// cycle-free leaf — movement.js imports FROM this file, never the reverse.
const DIRV4 = [
  [0, -1],
  [0, 1],
  [1, 0],
  [-1, 0],
];

/**
 * isDeadEnd(f, x, y) — MOVED verbatim from engine/movement.js (Phase 41,
 * TERR-04; the original PHOBIA-01/04.1-06 function, relocated here since
 * the region model needs it too, both for the leave-check below and for
 * trappedPanic's own still-unchanged entry check in movement.js). Does
 * (x, y) have exactly one (or zero) non-wall orthogonal neighbor?
 */
export function isDeadEnd(f, x, y) {
  let openNeighbors = 0;
  for (const [ddx, ddy] of DIRV4) {
    const ax = x + ddx;
    const ay = y + ddy;
    if (f.g[ay] && f.g[ay][ax] && !f.g[ay][ax].wall) openNeighbors++;
  }
  return openNeighbors <= 1;
}

/** tileKey(x, y) — the string key Heights' region model stores on
 * `c.phobiaState.Heights` ("this exact tile is the one I just attempted"). */
export function tileKey(x, y) {
  return x + "," + y;
}

/**
 * armFear(state, trigger, events) — sets `state.c.fearArmed` and pushes the
 * ONE `phobiaTriggered` event this entire module ever pushes. Zero rng.
 */
export function armFear(state, trigger, events) {
  const c = state.c;
  c.fearArmed = { phobia: c.phobia, trigger };
  events.push({ type: "phobiaTriggered", phobia: c.phobia, trigger });
}

/**
 * regionActive(state, phobia) — pure: is the region for `phobia` currently
 * true, read fresh off already-computed state (never `c.phobiaState`
 * itself)? Covers the three plain region phobias (water/darkness/being
 * trapped) that checkTerrainPhobias below drives through a single enter/
 * leave toggle. Heights (a tile-key model) and Death (an hp-hysteresis
 * model) are NOT plain booleans and are handled by their own dedicated
 * functions instead — this always returns false for them.
 */
export function regionActive(state, phobia) {
  const f = state.floor;
  if (!f) return false;
  if (phobia === "Bodies of water") {
    const cell = f.g[f.py] && f.g[f.py][f.px];
    return !!(cell && cell.water === true);
  }
  if (phobia === "Darkness") return inDark(state);
  if (phobia === "Being trapped") return isDeadEnd(f, f.px, f.py);
  return false;
}

/**
 * checkDeathPhobia(state, events) — the Death phobia's own hysteresis
 * region check: no-op unless `state.c.phobia === "Death"` and the hero is
 * alive. Enters at/below DEATH_PANIC_THRESHOLD (25%) of maxWP; re-arms only
 * once hp climbs back ABOVE DEATH_REARM_FRACTION (50%). Called both from
 * checkTerrainPhobias (movement/teleport's fresh-entry site) and directly
 * from engine/combat.js's foeTurn tail (the in-combat half of the same
 * trigger, since hp can cross the line mid-fight too).
 */
export function checkDeathPhobia(state, events) {
  const c = state.c;
  if (c.phobia !== "Death" || state.dead) return;
  const was = !!(c.phobiaState && c.phobiaState.Death);
  const enter = c.wp <= c.maxWP * DEATH_PANIC_THRESHOLD;
  const stay = !(c.wp > c.maxWP * DEATH_REARM_FRACTION);
  const now = was ? stay : enter;
  if (now && !was) {
    if (!c.phobiaState) c.phobiaState = {};
    c.phobiaState.Death = true;
    armFear(state, "nearDeath", events);
  } else if (!now && was) {
    c.phobiaState.Death = false;
  }
}

/**
 * checkTerrainPhobias(state, events) — the hero's own fresh-entry check, run
 * after every genuine movement (move()'s per-step tick site, teleport()'s
 * landing). No-op when dead, or when the hero's phobia is not one of the
 * five TERRAIN_PHOBIAS this module governs (a combat-type-phobic character
 * never gains `c.phobiaState`/`c.fearArmed` at all — no key creation).
 * Death delegates to checkDeathPhobia (its own hysteresis model); Heights
 * runs ONLY its leave-check here (the enter-check is noteHeightsAttempt,
 * fired separately from the climb/gorge roll branch, before the roll); the
 * other three (water/dark/dead end) run the plain enter/leave region toggle
 * via regionActive above.
 */
export function checkTerrainPhobias(state, events) {
  const c = state.c;
  const phobia = c.phobia;
  if (state.dead || !TERRAIN_PHOBIAS.includes(phobia)) return;
  if (phobia === "Death") {
    checkDeathPhobia(state, events);
    return;
  }
  if (phobia === "Heights") {
    if (typeof c.phobiaState?.Heights === "string") {
      const [tx, ty] = c.phobiaState.Heights.split(",").map(Number);
      const f = state.floor;
      if (Math.abs(f.px - tx) + Math.abs(f.py - ty) > 1) c.phobiaState.Heights = false;
    }
    return;
  }
  const was = c.phobiaState?.[phobia] === true;
  const now = regionActive(state, phobia);
  if (now && !was) {
    if (!c.phobiaState) c.phobiaState = {};
    c.phobiaState[phobia] = true;
    armFear(state, PHOBIA_TRIGGER_KEY[phobia], events);
  } else if (!now && was) {
    c.phobiaState[phobia] = false;
  }
}

/**
 * noteHeightsAttempt(state, x, y, events) — Heights' enter-check: called
 * from the climb/gorge roll branch, BEFORE the roll, for every climb/gorge
 * attempt (not just Heights-phobic characters — this function gates on
 * `c.phobia` itself, so it is a no-op call for every other character). A
 * retry of the SAME tile (the stored key unchanged) is silent; a fresh tile
 * — a fall followed by a climb elsewhere, or walking more than one square
 * away and coming back (checkTerrainPhobias' own leave-check above clears
 * the stored key once that happens) — fires again.
 */
export function noteHeightsAttempt(state, x, y, events) {
  const c = state.c;
  if (c.phobia !== "Heights") return;
  const key = tileKey(x, y);
  if (c.phobiaState?.Heights !== key) {
    if (!c.phobiaState) c.phobiaState = {};
    c.phobiaState.Heights = key;
    armFear(state, "heights", events);
  }
}

/**
 * resetFloorPhobiaRegions(c) — descend()'s floor-bound reset: the four
 * floor-bound region keys (water/dark/heights/trapped) die with the floor —
 * a fresh floor's tiles have no meaning to the SAME tile-key/region state.
 * Death (hp-based, not tile-based) and `c.fearArmed` (the still-pending arm,
 * if any) both survive a descent unchanged. No-op when `c.phobiaState` is
 * absent or not a plain object (mirrors this module's additive-with-default
 * discipline elsewhere — never injects the key).
 */
export function resetFloorPhobiaRegions(c) {
  if (!c || !c.phobiaState || typeof c.phobiaState !== "object" || Array.isArray(c.phobiaState)) return;
  delete c.phobiaState["Bodies of water"];
  delete c.phobiaState["Darkness"];
  delete c.phobiaState["Heights"];
  delete c.phobiaState["Being trapped"];
}
