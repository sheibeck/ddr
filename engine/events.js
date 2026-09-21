// engine/events.js
//
// Structured engine output (ENG-01). The engine never emits HTML or narration
// copy — it pushes plain, JSON-serializable `{type, ...fields}` event objects
// into an `events` array that applyAction returns. Presentation (Phase 4/5)
// consumes these to rebuild the prototype's "beat card" log; the engine stays
// UI-free. Event field shapes are intentionally loose for now (01-RESEARCH.md
// Open Question 1: assert state strictly, events loosely) and will tighten as
// presentation consumers stabilize.

export const EVENT_TYPES = {
  MOVED: "moved",
  STRUCK: "struck",
  FLOOR_CHANGED: "floorChanged",
  DIED: "died",
  LEVELED: "leveled",
  // Phase 54 (BAND-02, USER RULING D): a hero-only, floor-arrival regen tick.
  FLOOR_REGEN: "floorRegen",
};

/** moved(to) — the player stepped to grid cell `to` ({x, y}). */
export const moved = (to) => ({ type: EVENT_TYPES.MOVED, to });

/** struck(actor, roll, hit, dmg) — a strike was attempted/resolved. */
export const struck = (actor, roll, hit, dmg) => ({ type: EVENT_TYPES.STRUCK, actor, roll, hit, dmg });

/** floorChanged(depth) — the run descended (or was gated) to `depth`. */
export const floorChanged = (depth) => ({ type: EVENT_TYPES.FLOOR_CHANGED, depth });

/** died(cause) — the run ended; `cause` keys into the epitaph banks. */
export const died = (cause) => ({ type: EVENT_TYPES.DIED, cause });

/** leveled(level, wpGain) — the character reached a new skill level. */
export const leveled = (level, wpGain) => ({ type: EVENT_TYPES.LEVELED, level, wpGain });

/** floorRegen(amount) — HERO_REGEN_PER_FLOOR healed the hero on arrival at
 * a new floor (Phase 54, BAND-02, USER RULING D). Only pushed when
 * `amount > 0` — identity (0) never fires. */
export const floorRegen = (amount) => ({ type: EVENT_TYPES.FLOOR_REGEN, amount });
