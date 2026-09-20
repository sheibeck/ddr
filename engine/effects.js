// engine/effects.js
//
// Phase 36 (BAL foundation, ROADMAP SC-6) — the ONE timer shape every v1.5
// timer will share instead of inventing three bespoke ones: ability
// cooldowns (Phase 38), item use-then-effect-then-cooldown (Phase 39), and
// timed map reveal (Phase 40). Item effects/cooldowns (haste/invis/ether/
// acute/the Cloak-of-Flying pair/staff usedAt) all moved onto this shape in
// Phase 39. Do NOT retrofit the few fields that still keep their own
// bespoke shape (darkFor/ward/afraid/foeEffect) onto this shape — those
// stay exactly as they are (ARCHITECTURE §1's recommendation); this module
// only serves NEW timers.
//
// This is a cycle-free leaf module (mirrors engine/derived.js): ZERO
// imports, zero rng, zero mutation of anything but the `timers` map passed
// in on `c`. It emits no events and does no narration of its own — every
// tick function RETURNS the list of ids that expired or flipped this call
// (`{ id, from, to }`), and the CALLER decides whether/how to narrate that.
//
// Record shape — one plain-JSON map, lazily created on `c` (like `f.cd` in
// engine/foeAbilities.js), absent on every fixture/bot run/old save until a
// later phase's start* caller exists:
//
//   c.timers[id] = {
//     cadence: "rounds" | "squares",  // what advances it
//     left:    number,                // remaining ticks (integer >= 0)
//     cd?:     number,                // optional cooldown length (positive integer)
//     phase:   "effect" | "cooldown", // which half of the lifecycle it's in
//   }
//
// `id` is a consumer-chosen string key, by convention `ability:<key>`,
// `item:<name>`, or `spell:<key>` — this module never inspects or validates
// the convention, only that it is a non-empty string.
//
// Duration -> cooldown: a record with `cd` set flips from `phase: "effect"`
// to `phase: "cooldown"` (and `left` is reset to `cd`) the instant its
// `left` reaches 0 via a tick; the record is deleted entirely when the
// cooldown phase itself reaches 0. A record with no `cd` is simply deleted
// the instant its `left` reaches 0. Both transitions are reported in the
// tick function's return value; effects.js itself never decides what to do
// about them.
//
// Once `c.timers` exists (created by the first startEffect/startCooldown
// call), the key stays for the life of the character — an empty map (`{}`)
// is a legal, expected steady state, exactly like `f.cd` never disappearing
// once a foe has cast an ability with a cooldown.

/** isPlainObject(v) — true for a non-null, non-array object. */
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** isPosInt(v) — true for a finite, strictly-positive integer. */
function isPosInt(v) {
  return Number.isInteger(v) && v > 0;
}

/**
 * durationOf(opts) — reads exactly one of `opts.rounds` / `opts.squares`
 * (both a positive integer) and returns `{ cadence, left }`, or `null` when
 * `opts` is not a plain object, neither key is present, both are present, or
 * the supplied value is not a positive integer. Pure, no mutation.
 */
function durationOf(opts) {
  if (!isPlainObject(opts)) return null;
  const hasRounds = Object.prototype.hasOwnProperty.call(opts, "rounds");
  const hasSquares = Object.prototype.hasOwnProperty.call(opts, "squares");
  if (hasRounds === hasSquares) return null; // neither, or both — invalid either way
  if (hasRounds) {
    if (!isPosInt(opts.rounds)) return null;
    return { cadence: "rounds", left: opts.rounds };
  }
  if (!isPosInt(opts.squares)) return null;
  return { cadence: "squares", left: opts.squares };
}

/** ensureTimers(c) — lazily creates `c.timers = {}` if it is not already a
 * plain-object map. Called ONLY from startEffect/startCooldown — no other
 * function in this module ever creates the key. */
function ensureTimers(c) {
  if (!isPlainObject(c.timers)) c.timers = {};
}

/** invalidStart(c, id) — the shared guard both start* functions apply
 * before touching `c`: `c` must be a plain object and `id` a non-empty
 * string. */
function invalidStart(c, id) {
  return !isPlainObject(c) || typeof id !== "string" || id.length === 0;
}

/**
 * tick(c, cadence, n) — shared decrement/transition engine for tickRounds/
 * tickSquares. No-ops (`[]`) when `c` is not a plain object or `c.timers` is
 * absent/not a plain object — no key is ever created here (only the two
 * start* functions create it). Walks `c.timers` in `Object.keys` insertion
 * order; records of a DIFFERENT cadence are left completely untouched
 * (cross-cadence isolation). A matching record's `left` is decremented by
 * `n`, floored at 0 (no negative overshoot ever carries into a cooldown
 * flip). On reaching 0: an "effect" record with a positive-integer `cd`
 * flips to `phase: "cooldown"` with `left` reset to `cd`; an "effect"
 * record with no `cd` is deleted; a "cooldown" record is always deleted.
 * Every transition is pushed onto the returned list as `{ id, from, to }`
 * (`to` is `null` when the record was deleted).
 */
function tick(c, cadence, n) {
  const transitions = [];
  if (!isPlainObject(c) || !isPlainObject(c.timers)) return transitions;
  for (const id of Object.keys(c.timers)) {
    const rec = c.timers[id];
    if (!rec || rec.cadence !== cadence) continue;
    rec.left = Math.max(0, rec.left - n);
    if (rec.left !== 0) continue;
    if (rec.phase === "effect") {
      if (isPosInt(rec.cd)) {
        rec.phase = "cooldown";
        rec.left = rec.cd;
        transitions.push({ id, from: "effect", to: "cooldown" });
      } else {
        delete c.timers[id];
        transitions.push({ id, from: "effect", to: null });
      }
    } else {
      delete c.timers[id];
      transitions.push({ id, from: "cooldown", to: null });
    }
  }
  return transitions;
}

/**
 * startEffect(c, id, { rounds | squares, cd? }) — creates (or overwrites) a
 * `phase: "effect"` record keyed by `id`, lazily creating `c.timers` on
 * first use. `cd`, when supplied, must be a positive integer and is kept on
 * the record verbatim (through its later cooldown phase too — simpler than
 * stashing it elsewhere, and harmless since a "effect" phase never reads
 * `left` as anything but the remaining effect duration). Exactly one of
 * `rounds`/`squares` must be a positive integer, or this is a silent no-op
 * returning `null` (invalid `c`/`id`/`opts`/`cd` never throws — engine V5
 * discipline). Returns the created record on success.
 */
export function startEffect(c, id, opts) {
  if (invalidStart(c, id)) return null;
  const dur = durationOf(opts);
  if (!dur) return null;
  let cd;
  if (isPlainObject(opts) && Object.prototype.hasOwnProperty.call(opts, "cd")) {
    if (!isPosInt(opts.cd)) return null;
    cd = opts.cd;
  }
  ensureTimers(c);
  const record = { cadence: dur.cadence, left: dur.left, phase: "effect" };
  if (cd !== undefined) record.cd = cd;
  c.timers[id] = record;
  return record;
}

/**
 * startCooldown(c, id, { rounds | squares }) — creates (or overwrites) a
 * `phase: "cooldown"` record keyed by `id`, lazily creating `c.timers` on
 * first use. Same validation and no-op-on-invalid-input discipline as
 * startEffect; no `cd` concept applies to a record that is already a
 * cooldown. Returns the created record on success, `null` on invalid input.
 */
export function startCooldown(c, id, opts) {
  if (invalidStart(c, id)) return null;
  const dur = durationOf(opts);
  if (!dur) return null;
  ensureTimers(c);
  const record = { cadence: dur.cadence, left: dur.left, phase: "cooldown" };
  c.timers[id] = record;
  return record;
}

/**
 * tickRounds(c) — advances every `cadence: "rounds"` record by exactly 1.
 * The combat-round tick site (engine/combat.js#foeTurn). No-ops (`[]`) on a
 * `c` without a `timers` map; never creates the key. Returns the list of
 * `{ id, from, to }` transitions this call caused.
 */
export function tickRounds(c) {
  return tick(c, "rounds", 1);
}

/**
 * tickSquares(c, n = 1) — advances every `cadence: "squares"` record by `n`.
 * `n` must be a positive integer (the exploration per-step tick site,
 * engine/movement.js, passes the step's own cost — 1 for a normal square,
 * a terrain-specific value like 2 for a Phase 41 water square) or this is a
 * silent no-op returning `[]`; same for a `c` without a `timers` map. Never
 * creates the key. Returns the list of `{ id, from, to }` transitions this
 * call caused.
 */
export function tickSquares(c, n = 1) {
  if (!isPosInt(n)) return [];
  return tick(c, "squares", n);
}

/**
 * remaining(c, id) — the record's `left`, or `0` when there is no record for
 * `id` (or no `timers` map at all, or `c` itself is not a plain object).
 * Never throws.
 */
export function remaining(c, id) {
  if (!isPlainObject(c) || !isPlainObject(c.timers)) return 0;
  const rec = c.timers[id];
  return rec && typeof rec.left === "number" ? rec.left : 0;
}

/**
 * isReady(c, id) — `true` only when NO record exists for `id` — an active
 * effect and a running cooldown both read as not-ready. `true` (nothing is
 * blocking `id`) on a `c` without a `timers` map, or on an invalid `c`.
 */
export function isReady(c, id) {
  if (!isPlainObject(c) || !isPlainObject(c.timers)) return true;
  return c.timers[id] === undefined;
}

/**
 * clearRoundTimers(c) — deletes every `cadence: "rounds"` record (whichever
 * phase it is in), leaving every `cadence: "squares"` record untouched. The
 * `engine/combat.js#endCombat` clear site (Phase 31 ward/afraid precedent:
 * combat-scoped state is cleared unconditionally when the fight ends;
 * squares-cadence timers are NOT combat-scoped and survive). No-ops (`[]`)
 * on a `c` without a `timers` map; never creates the key. Returns the
 * deleted ids in insertion order.
 */
export function clearRoundTimers(c) {
  const deleted = [];
  if (!isPlainObject(c) || !isPlainObject(c.timers)) return deleted;
  for (const id of Object.keys(c.timers)) {
    const rec = c.timers[id];
    if (rec && rec.cadence === "rounds") {
      delete c.timers[id];
      deleted.push(id);
    }
  }
  return deleted;
}
