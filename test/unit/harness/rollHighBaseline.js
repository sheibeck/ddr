// test/unit/harness/rollHighBaseline.js
//
// Phase 73 (ROLL-05, Plan 02): the shared baseline harness for pinning the
// UNTOUCHED engine's outcomes three ways, BEFORE any Phase 73 engine edit —
// CONTEXT Area 3 ("Proof it changed nothing") and Area 2 ("Old saves load as
// they are"). Consumed by tools/roll-high-baseline.mjs (the generator) and
// by test/unit/roll-high-state-pins.test.js / test/unit/roll-high-save-
// compat.test.js (the pinned assertions). No tests live in this file.
//
// `stateHash` must be deterministic across two runs of the identical seed/
// opts on the SAME engine build — the generator's `pins` mode proves this by
// running every PIN_RUNS entry twice and failing loudly on any mismatch
// (non-determinism must be fixed here, in stateHash, before anything is
// pinned; never worked around by re-pinning).

import { createHash } from "node:crypto";
import { playRun, forceParty, decideAction, makeBotContext } from "../../../tools/lib/tuning-bot.mjs";
import { stripVolatileFields } from "../../parity/harness/diffState.js";
import { makeRng } from "../../../engine/rng.js";
import { applyAction } from "../../../engine/engine.js";
import { validateSave, rehydrate, serializeRun } from "../../../engine/saveState.js";

export { forceParty, serializeRun };

/**
 * EXTRA_VOLATILE_FIELDS — wall-clock (or otherwise run-to-run-unstable)
 * fields beyond the two stripVolatileFields already strips (`deathAt`,
 * `graves[].when`), PLUS fields known to be pure save/load REPRESENTATION
 * artifacts — present one way live, a different (but semantically identical)
 * way after a round trip, with zero gameplay-outcome difference. Investigated
 * at Phase 73's base (git rev-parse --short HEAD, recorded in
 * roll-high-state-pins.test.js's header): Phase 81's engine/records.js is
 * the only engine file that changed since the Phase 72 close (c3513b0), and
 * its one wall-clock-adjacent export, `runHash()`, is a pure FNV-1a hash
 * over content fields (RUN_HASH_FIELDS explicitly excludes `when`) —
 * deterministic, not a new volatile field.
 *
 * - `pendingJoiner` — engine/saveState.js's validateSave/rehydrate never
 *   carry this field through a save/load round trip at all (unlike
 *   `pendingFind`/`pendingHazard`, which ARE explicitly reset to `null` on
 *   load). A live value of `null` (set by encounters.js#resolveJoiner, e.g.
 *   forceParty's own write-path) becomes an ABSENT key after loadSave —
 *   `undefined` and `null` both mean "no pending Joiner decision" to every
 *   engine/UI reader, so this is pure JSON-representation noise, not an
 *   outcome divergence. Pre-existing engine/saveState.js behavior, outside
 *   this plan's "no engine/ changes" scope — discovered while building
 *   Task 2's save-compat round-trip check.
 *
 * - `pendingTile` — RULES-12 (Phase 75, user 2026-09-25): engine/saveState.js's
 *   rehydrate/validateSave NOW always reset this to `null` on load, mirroring
 *   `pendingHazard`'s own reset (both transient, engine-only decision state
 *   with no meaning across a load). The frozen pre-switch save fixture below
 *   predates this field entirely — it was captured before Phase 75 ever
 *   introduced it, so its raw JSON carries no such key at all. `undefined`
 *   (absent) and `null` both mean "no wandering-monster-interrupted tile is
 *   pending" to every engine/UI reader, so a pre-Phase-75 fixture gaining the
 *   key on load is pure JSON-representation noise, not an outcome
 *   divergence — the exact same category as `pendingJoiner` above.
 *
 * The generator's double-run check (below) is the separate safety net for a
 * later plan's engine edit introducing a genuinely NONdeterministic field —
 * that field gets added here too, named, with a one-line reason, never
 * silently ignored.
 */
export const EXTRA_VOLATILE_FIELDS = Object.freeze(["pendingJoiner", "pendingTile"]);

/**
 * deleteExtraVolatileFields(node) — deletes every EXTRA_VOLATILE_FIELDS key
 * found anywhere in the object graph, mirroring stripVolatileFields's own
 * "wherever that key appears" reach.
 */
function deleteExtraVolatileFields(node) {
  if (EXTRA_VOLATILE_FIELDS.length === 0) return node;
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === null || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const entry of cur) stack.push(entry);
      continue;
    }
    for (const key of Object.keys(cur)) {
      if (EXTRA_VOLATILE_FIELDS.includes(key)) delete cur[key];
      else stack.push(cur[key]);
    }
  }
  return node;
}

/**
 * canonicalJson(value) — JSON.stringify with every plain object's keys
 * sorted recursively (arrays keep their own order — array ORDER is
 * gameplay-meaningful, e.g. floor.g rows/cells, party order; only object KEY
 * order is an implementation detail worth canonicalising for a stable hash).
 */
export function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

/**
 * stateHash(state) — sha256 hex of canonicalJson(state) after stripping
 * every known wall-clock field: stripVolatileFields's `deathAt`/`graves[].
 * when`, then EXTRA_VOLATILE_FIELDS. A NEW object; never mutates `state`.
 */
export function stateHash(state) {
  const stripped = deleteExtraVolatileFields(stripVolatileFields(state));
  return createHash("sha256").update(canonicalJson(stripped)).digest("hex");
}

/**
 * PIN_RUNS — about eight bot-sweep runs chosen to reach as many CHECK sites
 * as practical in well under 20s total: four solo runs from depth 1 (two
 * default chargen, one forced Thief/Pilfer for backstab/pilfer sites, one
 * forced Magic User/Sorcerer for spellcasting/resistance sites), two party
 * runs (member strikes/casts), and two deep starts (Skeletons, climbs,
 * traps and locks appear from around depth 8 on). Every entry gets a
 * `maxActions` cap. `opts` is passed straight through to `playRun` — fields
 * `playRun` doesn't read directly (e.g. flee/potion thresholds) fall back to
 * BOT_DEFAULTS via makeBotContext, exactly like every other playRun caller.
 */
export const PIN_RUNS = Object.freeze([
  Object.freeze({ label: "solo-1", seed: 101, opts: Object.freeze({ maxActions: 400 }) }),
  Object.freeze({ label: "solo-2", seed: 202, opts: Object.freeze({ maxActions: 400 }) }),
  Object.freeze({
    label: "solo-thief-pilfer",
    seed: 303,
    opts: Object.freeze({ maxActions: 400, force: Object.freeze({ cls: "Thief", sub: "Pilfer", race: "Human" }) }),
  }),
  Object.freeze({
    label: "solo-magicuser-sorcerer",
    seed: 404,
    opts: Object.freeze({ maxActions: 400, force: Object.freeze({ cls: "Magic User", sub: "Sorcerer", race: "Human" }) }),
  }),
  Object.freeze({ label: "party-1", seed: 505, opts: Object.freeze({ party: true, maxActions: 400 }) }),
  Object.freeze({
    label: "party-fighter-knight",
    seed: 606,
    opts: Object.freeze({ party: true, maxActions: 400, force: Object.freeze({ cls: "Fighter", sub: "Knight", race: "Human" }) }),
  }),
  Object.freeze({ label: "deep-8", seed: 707, opts: Object.freeze({ startDepth: 8, maxActions: 300 }) }),
  Object.freeze({ label: "deep-14", seed: 808, opts: Object.freeze({ startDepth: 14, maxActions: 300 }) }),
]);

/**
 * pinRun(cfg) — cfg is one PIN_RUNS entry: `{ label, seed, opts }`. Runs
 * playRun(seed, opts, onStep), keeping the last state onStep sees (the same
 * final state playRun itself returns as `.state` — onStep is used here, not
 * the return value directly, so this harness stays the single place a
 * caller ever needs to read a run's terminal state from). Returns
 * `{ label, actions, dead, depth, hash }`.
 */
export function pinRun(cfg) {
  let lastState = null;
  const result = playRun(cfg.seed, cfg.opts, (_events, state) => {
    lastState = state;
  });
  const finalState = lastState || result.state;
  return {
    label: cfg.label,
    actions: result.actions,
    dead: result.dead,
    depth: finalState.floor.depth,
    hash: stateHash(finalState),
  };
}

// --- Task 2: the pre-switch save fixture + its compatibility test --------

/**
 * loadSave(raw) — the shell's own load sequence (src/browser/engineAdapter.
 * js#boot): `validateSave(raw, { freshSeed })` then `rehydrate(check.value)`
 * on success. Asserts `ok` (throws on a malformed save — this harness never
 * expects one). `freshSeed` is unused on a valid save (only the no-save
 * fallback path reads it), so a fixed placeholder is fine here.
 */
export function loadSave(raw) {
  const check = validateSave(raw, { freshSeed: 1 });
  if (!check.ok) throw new Error(`loadSave: expected ok save, got reason=${check.reason}`);
  return rehydrate(check.value);
}

/**
 * dispatchOne(state, action) — the ONE place this harness folds a targeted
 * `useAbility` action's pre-dispatch `combat.target` write in, mirroring
 * tools/lib/tuning-bot.mjs#playRun's own loop body exactly: a `useAbility`
 * action carrying an integer `target` writes `state.combat.target` BEFORE
 * dispatching the bare `{ type: "useAbility", key }` (no `target` field —
 * `validateAction` only requires `key`). Shared by `botSteps` (recording)
 * and `replaySteps` (replay), so the target write is REDONE identically on
 * replay from the recorded action's own `target` field — not something
 * `dispatched` has to separately encode.
 */
function dispatchOne(state, action) {
  let toDispatch = action;
  if (action.type === "useAbility" && Number.isInteger(action.target) && state.combat) {
    state.combat.target = action.target;
    toDispatch = { type: "useAbility", key: action.key };
  }
  return applyAction(state, toDispatch);
}

/**
 * botSteps(state, seed, opts, count) — mirrors playRun's own dispatch shape
 * EXACTLY (same decideAction/policyRng construction, the same
 * dispatchOne target-write-then-dispatch above), applying `count` actions
 * starting from `state` (NOT from a fresh newRun — this resumes an already-
 * loaded run). Returns `{ state, dispatched }`, where `dispatched` is the
 * list of ORIGINAL action objects decideAction produced (target field
 * included, when present) — `replaySteps` below re-derives the exact same
 * combat.target write from each entry via the same `dispatchOne`, so a
 * replay is exact.
 *
 * `policyRng` is seeded the SAME way playRun seeds it (`seed ^ 0x9e3779b9`)
 * — the harness's OWN seed argument, not `state.seed`, exactly mirroring
 * playRun's own policy/engine stream separation.
 */
export function botSteps(state, seed, opts, count) {
  const policyRng = makeRng(seed ^ 0x9e3779b9);
  const ctx = makeBotContext(opts);
  const dispatched = [];
  let cur = state;
  for (let i = 0; i < count && !cur.dead; i++) {
    const action = decideAction(cur, policyRng, ctx);
    const { state: next } = dispatchOne(cur, action);
    dispatched.push(action);
    cur = next;
  }
  return { state: cur, dispatched };
}

/**
 * replaySteps(state, dispatched) — re-applies a `dispatched` list (from
 * botSteps or a fixture) via the SAME `dispatchOne` botSteps used to record
 * it, in order, returning the final state. No policy rng involved — every
 * decision (including which target, if any) was already baked into each
 * `dispatched` entry by botSteps; dispatchOne just redoes the target write.
 */
export function replaySteps(state, dispatched) {
  let cur = state;
  for (const action of dispatched) {
    const { state: next } = dispatchOne(cur, action);
    cur = next;
  }
  return cur;
}
