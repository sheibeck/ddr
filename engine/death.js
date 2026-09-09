// engine/death.js
//
// Pure death, graveyard and epitaph filling (ENG-01, ENG-03). Ports
// mazeworld.html's epitaphFor/epitaphCtx (lines 1030-1033, 2929-2936),
// die() (lines 2914-2927, sans DOM), and bury() (lines 2950-2961, sans
// localStorage). Wall-clock reads (S.deathAt, the graveyard `when`) are the
// ONLY two Date.now() sites in this module, and both are funneled through a
// single injectable `now()` parameter (default Date.now) so tests can pin a
// fixed clock and the determinism/round-trip/parity harnesses can keep
// excluding them (01-RESEARCH.md Pitfall 1).

import { EPITAPHS, CAUSE_TEXT, ROMAN } from "../content/index.js";
import { died } from "./events.js";

/** fillTemplate(str, ctx) — replaces every {token} in `str` from `ctx`. */
function fillTemplate(str, ctx) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : ""));
}

/**
 * epitaphFor(cause, ctx, rng) — picks one of the cause's epitaph templates
 * via the injected rng and fills its {tokens} from `ctx`. Ports
 * mazeworld.html epitaphFor() (lines 1030-1033).
 */
export function epitaphFor(cause, ctx, rng) {
  const bank = EPITAPHS[cause] || EPITAPHS.maze;
  return fillTemplate(rng.pick(bank), ctx);
}

/**
 * epitaphCtx(state, detail) — the token object epitaphFor fills templates
 * from. Ports mazeworld.html epitaphCtx() (lines 2929-2936).
 *
 * MD-03: the prototype's `gold.toLocaleString()` was a live-DOM-render
 * helper whose output was never itself stored or compared byte-for-byte. In
 * the extracted engine, this same string feeds `state.epitaph`, which IS
 * persisted GameState and compared byte-for-byte by the round-trip/
 * determinism/parity suites. `toLocaleString()` with no explicit locale
 * follows the JS runtime's default locale/ICU data, which the seed does not
 * control — two devices (or the same seed under two different system
 * locales) could otherwise produce a different `state.epitaph` string from
 * this call alone. Pin a fixed locale so the formatted digit-grouping is a
 * pure function of `c.gold`, not of the host runtime.
 */
export function epitaphCtx(state, detail) {
  const c = state.c;
  return {
    name: c.name,
    foe: detail || "creature",
    sub: c.sub,
    race: c.race,
    floor: state.floor.depth,
    day: state.day,
    sp: Math.round(c.sp),
    gold: c.gold.toLocaleString("en-US"),
    motive: c.motive.toLowerCase(),
    lvl: ROMAN[c.level - 1],
  };
}

/** buildRunSummary(state, cause, when) — the serializable graveyard entry shape. */
function buildRunSummary(state, cause, when) {
  const c = state.c;
  return {
    name: c.name,
    race: c.race,
    sub: c.sub,
    cls: c.cls,
    level: c.level,
    sp: Math.round(c.sp),
    floor: state.floor.depth,
    day: state.day,
    steps: state.steps,
    gold: c.gold,
    kills: c.kills || 0,
    cause,
    note: state.deathNote || (cause === "won" ? "walked out" : "died"),
    epitaph: state.epitaph,
    when,
  };
}

/**
 * die(state, cause, detail, rng, events, now) — kills the run: clears combat
 * and wards, fills the death note + epitaph from the content banks, captures
 * `lastWords` from the current beat group (if any), pushes a `died` event,
 * and returns a serializable RunSummary. Ports mazeworld.html die() (lines
 * 2914-2927), minus paint()/save() (presentation/persistence concerns).
 */
export function die(state, cause, detail, rng, events = [], now = Date.now) {
  const c = state.c;
  state.dead = true;
  state.combat = null;
  c.wp = 0;
  c.ward = null;
  c.regen = false;
  c.mirror = 0;

  const timestamp = now();
  state.deathAt = timestamp;
  state.deathNote = CAUSE_TEXT[cause]
    ? fillTemplate(CAUSE_TEXT[cause], { foe: detail })
    : "killed by something the dungeon did not name";
  state.epitaph = epitaphFor(cause, epitaphCtx(state, detail), rng);
  state.lastWords =
    state.beats && state.beats.groups && state.beats.groups.length
      ? state.beats.groups[state.beats.groups.length - 1].lines.slice(-4)
      : [];

  events.push(died(cause));
  return buildRunSummary(state, cause, timestamp);
}

/**
 * bury(state, cause, detail, graves, now) — builds this run's RunSummary
 * (from state.deathNote/state.epitaph, already set by die() or a winGame
 * path) and returns a NEW graves array with it unshifted and capped at 60.
 * The graveyard array itself is owned by the persistence layer — this
 * function never touches localStorage (ports mazeworld.html bury(), lines
 * 2950-2961, sans storage and DOM re-render).
 */
export function bury(state, cause, detail, graves = [], now = Date.now) {
  const summary = buildRunSummary(state, cause, now());
  return [summary, ...graves].slice(0, 60);
}
