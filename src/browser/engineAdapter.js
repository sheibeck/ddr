// src/browser/engineAdapter.js
//
// The walking skeleton's browser adapter (ENG-01, SKELETON.md "Browser
// render"). This is presentation/persistence GLUE, not engine code — it is
// the one place allowed to touch `localStorage` and to be imported as a
// browser `<script type="module">`. It holds the live engine `GameState`,
// drives it forward one `applyAction` call at a time, and translates the
// structured `events` applyAction returns into the same HTML narration
// strings the prototype's `logLine()` already knows how to render — so
// mazeworld.html's existing `paint()`/`draw()`/`logLine()` functions can
// keep doing the rendering, unmodified, from engine-shaped state.
//
// Per ARCHITECTURE.md's suggested build order, this is explicitly a
// TEMPORARY adapter: it maps a still-small vocabulary of event types to
// hand-written copy. A later phase's presentation rewrite
// (`presentation/render/log.ts`, per SKELETON.md) replaces it wholesale —
// this file's job is only to prove the seam works end-to-end and keep the
// dev loop playable while later plans extract the rest of the rules.

import { newRun, applyAction } from "../../engine/engine.js";
import { validateSave, rehydrate, serializeRun } from "../../engine/saveState.js";

// Mirrors mazeworld.html's `const SAVE_KEY = "mazeworld.delve.v1";` (line
// ~488). Deliberately duplicated as a literal rather than imported — the
// classic <script> that owns SAVE_KEY is not a module and exports nothing;
// keeping the string in sync here is a documented, temporary coupling this
// adapter's replacement will resolve.
const SAVE_KEY = "mazeworld.delve.v1";

let currentState = null;

/** getState() — the adapter's current engine GameState (or null before boot). */
export function getState() {
  return currentState;
}

/**
 * initRun(seed) — starts a brand-new run from an integer seed, replacing
 * whatever state (if any) the adapter was holding.
 */
export function initRun(seed) {
  currentState = newRun(seed);
  return currentState;
}

/**
 * boot(freshSeed) — the adapter's load-on-page-open entry point (threat
 * T-01-07a). Reads the active-run save from localStorage and validates it
 * through engine/saveState.js's fail-closed `validateSave`; a missing,
 * corrupt, or tampered save (or a private-window storage exception) falls
 * back to a brand-new run seeded with `freshSeed` — it never throws.
 */
export function boot(freshSeed) {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    const check = validateSave(raw, { freshSeed });
    if (check.ok) {
      currentState = rehydrate(check.value);
      return currentState;
    }
  }
  return initRun(freshSeed);
}

/** persist() — best-effort save of the current state; never throws (a
 * private window or a full storage quota just means the delve won't persist,
 * matching mazeworld.html's own save()). */
function persist() {
  if (!currentState) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeRun(currentState)));
  } catch {
    /* private window, blocked storage — the delve just won't persist */
  }
}

/**
 * dispatch(action) — the adapter's core seam: runs `action` through
 * engine/engine.js's `applyAction`, swaps in the resulting state, persists
 * it, and pre-formats its events into the HTML lines `logLine()` expects.
 * Returns `{ state, events, html }` so a caller can render from `state`,
 * inspect the structured `events`, or just push `html` straight to the log.
 */
export function dispatch(action) {
  if (!currentState) {
    throw new Error("engineAdapter.dispatch: call boot()/initRun() before dispatch()");
  }
  const { state, events } = applyAction(currentState, action);
  currentState = state;
  persist();
  return { state: currentState, events, html: formatEvents(events) };
}

/**
 * formatEvents(events) — maps a structured `events` array to the prototype's
 * span-class HTML narration copy. Loosely scoped on purpose (01-RESEARCH.md
 * Open Question 1): unrecognized event types are silently dropped rather
 * than crashing the render loop, since new event types land with every
 * later slice plan.
 */
export function formatEvents(events) {
  return events.map(formatEvent).filter((html) => html !== null);
}

function formatEvent(e) {
  switch (e.type) {
    case "moved":
      return null; // a plain step needs no narration line of its own
    case "oneWayBlocked":
      return e.side === "approach"
        ? `The arrow points the other way. <span class="miss">It will not open from this side.</span>`
        : `<span class="miss">You came through it. There is no coming back.</span>`;
    case "climbedOver":
    case "leaptOver":
      return `<span class="hit">Over.</span>`;
    case "fellClimbing":
      return `<span class="hurt">You come off — ${e.hurt} wp.</span>`;
    case "fellInGorge":
      return `<span class="hurt">Short. ${e.hurt} wp on the way down.</span>`;
    case "afflictionTick":
      return e.loss > 0
        ? `<span class="hurt">${e.kind}: −${e.loss} wp.</span>`
        : `<span class="hurt">${e.kind} has taken everything it can. You are on one wp.</span>`;
    case "afflictionPassed":
      return `<span class="hit">It passes.</span>`;
    case "afflictionCured":
      return `You sweat the sickness out overnight. <span class="hit">Cured.</span>`;
    case "spellChargeRecovered":
      return `<span class="beat">Twenty quiet squares. A charge comes back (${e.charges} of ${e.max}).</span>`;
    case "dayBegan":
      return `<span class="banner">Day ${e.day}.</span>`;
    case "rested":
      return `Rest restores <span class="hit">+${e.amount} wp</span>.`;
    case "armorPatched":
      return `<span class="hit">+${e.amount}</span> back into your kit.`;
    case "potionDuplicated":
      return `The Warlock spends the small hours duplicating a potion. <span class="hit">+1 potion.</span>`;
    case "wentHungry":
      return `<span class="hurt">No rations.</span> Cost of living takes <span class="hurt">${e.cost} wp</span> straight out of you.`;
    case "wanderingMonster":
      return `Wandering monster check: <span class="roll">${e.hours}</span> of 8 hours disturbed.`;
    case "campFailed":
      return `<span class="miss">Not enough food to make camp.</span> Find rations first.`;
    case "teleported":
      return `<span class="beat">Teleport square.</span>`;
    case "spGained":
      return `Surviving the floor is worth <span class="roll">${e.amount}</span> skill points.`;
    case "floorChanged":
      return `<span class="banner">Floor ${e.depth}.</span> The air gets worse.`;
    case "leveled":
      return `<span class="hit">Skill level ${e.level}</span> (+${e.wpGain} wp).`;
    case "won":
      return `<span class="banner">The Gate.</span> Walked out on day ${e.day}, after ${e.steps} squares.`;
    case "died":
      return `<span class="hurt">You have died.</span>`;
    case "pendingEncounter":
    case "pendingTrap":
    case "pendingChest":
      // dot/trap/chest resolution lands in 01-09/01-10; the tile is already
      // consumed, this just flags that a later slice owes real narration.
      return `<span class="beat">Something happened here. The maze isn't saying what yet.</span>`;
    default:
      return null;
  }
}
