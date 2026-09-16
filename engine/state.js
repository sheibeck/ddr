// engine/state.js
//
// GameState factory (ENG-01, ENG-02, ENG-04). newRun(seed) builds a fully
// JSON-serializable game state from a single integer seed: a dice-rolled
// character, floor 1, day/step counters, and the seeded RNG's cursor stored
// directly on state so a run is reproducible and round-trips losslessly. No
// DOM, no localStorage, no Math.random, no module-global `S`.

import { makeRng } from "./rng.js";
import { genFloor, reveal } from "./maze.js";
import { rollCharacter, checkLevel } from "./character.js";
import { revealRadius } from "./derived.js";
// Phase 21 (TUNE-04, D-13): the dev-only start-at-depth branch below needs
// difficultyCurve (to sanitize the requested startDepth, mirroring
// movement.js#descend's own safeDepth precedent) and gainWilmst/
// WILMST_CACHE_PER_DEPTH (to grant a depth-scaled purse via the existing
// wilmst-cache row). These two imports close an ESM cycle back to THIS
// module — items.js does not import state.js, but encounters.js already
// does (addPartyMember, above the cycle this file has always had); the new
// edge is state.js -> items.js/difficulty.js and state.js -> encounters.js
// (for WILMST_CACHE_PER_DEPTH). Both are inert: engine.js imports state.js
// first, and by the time any CALLER actually invokes newRun(), every module
// in the graph has finished evaluating its top-level body — only the
// (already-hoisted) function declarations and this call-time const read are
// ever touched inside newRun's body, so no half-initialized binding is ever
// observed.
import { difficultyCurve } from "./difficulty.js";
import { gainWilmst } from "./items.js";
import { WILMST_CACHE_PER_DEPTH } from "./encounters.js";
import { THRESHOLDS } from "../content/index.js";

/** Save-schema version, bumped when the GameState shape changes (see 01-06). */
export const STATE_VERSION = 1;

/**
 * DEV_START_DEPTH_MAX — Phase 21 (TUNE-04, D-13): a hard ceiling on the
 * dev-only startDepth option, mirroring the safeDepth() posture elsewhere in
 * the engine (Security V5) — no untrusted/malformed input can ever push a
 * dev run past this floor, regardless of what the hidden Settings field is
 * told to submit.
 */
export const DEV_START_DEPTH_MAX = 999;

/**
 * PARTY_CAP — v1 caps the persistent roster at a single Joiner (PARTY-08), but
 * the roster is a plain array and every access is written for N so raising this
 * constant is the only change a larger party needs. Phase 7 keeps the party
 * INERT in combat; this cap only bounds addPartyMember below.
 */
export const PARTY_CAP = 1;

/**
 * addPartyMember(state, member) — the bounded append used to grow the
 * persistent roster. Written for N (length-vs-cap check, plain push) so later
 * phases can wire real recruitment through it without reshaping the array.
 * Fail-open: initializes a missing/non-array `party` to [] first, and refuses
 * (returns false, no mutation) once PARTY_CAP is reached. Adds NO rng draw — it
 * is a plain data mutation, exactly like `beats`/`store` bookkeeping, so it
 * never shifts the seeded chargen/run cursor the determinism suite pins.
 * NOT wired to any gameplay in Phase 7 (party stays inert in combat).
 *
 * @param {object} state - a GameState with a top-level `party` array
 * @param {object} member - a full rollCharacter()-shaped sheet
 * @returns {boolean} true if appended, false if the cap was already reached
 */
export function addPartyMember(state, member) {
  if (!Array.isArray(state.party)) state.party = [];
  if (state.party.length >= PARTY_CAP) return false;
  state.party.push(member);
  return true;
}

/**
 * swapPartyMember(state, member) — DELIBERATE RULES CHANGE, Phase 25.1,
 * 2026-09-15 (DFB-04): accepting a Joiner with a full roster replaces the
 * LONGEST-SERVING member (index 0 — the only slot at PARTY_CAP 1, FIFO if
 * the cap ever rises) instead of refusing the recruit outright.
 * Fail-open: initializes a missing/non-array `party` to [] first (mirrors
 * addPartyMember). When the roster is at or above PARTY_CAP, splices out
 * index 0 and returns it as `left`; otherwise `left` is null and the
 * member is simply appended (same as addPartyMember's under-cap path).
 * Zero rng — a plain data mutation, exactly like addPartyMember, so it
 * never shifts the seeded chargen/run cursor the determinism suite pins.
 * The party array shape is unchanged (no new field on any member).
 * addPartyMember's own refuse-when-full contract is untouched for every
 * other caller — this is a NEW export, not a behavior change to it.
 *
 * @param {object} state - a GameState with a top-level `party` array
 * @param {object} member - a full rollCharacter()-shaped sheet
 * @returns {{added: true, left: object|null}} the member spliced out (or null)
 */
export function swapPartyMember(state, member) {
  if (!Array.isArray(state.party)) state.party = [];
  const left = state.party.length >= PARTY_CAP ? state.party.splice(0, 1)[0] : null;
  state.party.push(member);
  return { added: true, left };
}

/**
 * newRun(seed) — a fresh run. The CALLER supplies the seed (do not read the
 * wall clock here — that stays a presentation/boot concern so the engine
 * remains pure and deterministic). The RNG is threaded through character
 * generation and floor generation in the exact order the prototype's newGame()
 * used (rollCharacter → genFloor(1) → reveal), so the same seed produces a
 * byte-identical run, and its final cursor is persisted as `rngState`.
 *
 * `exclude` (audit-batch E12, part 4) is an optional, additive recent-names
 * list forwarded straight to rollCharacter → nameFor. It only steers the name
 * choice and never adds/reorders an rng draw, so newRun(seed) with no/empty
 * `exclude` still produces the byte-identical run the parity suite freezes.
 *
 * `options.startDepth` (Phase 21, TUNE-04, D-13/D-14) is a DEV-ONLY affordance
 * — omitted (or `1`) by every existing caller, so the default path (character
 * roll → genFloor(1) → reveal) is completely untouched and byte-identical to
 * every parity fixture. When `startDepth > 1`, a SECOND branch runs AFTER the
 * literal below: it levels the already-rolled character to the SP threshold
 * for the sanitized start depth via the ordinary `checkLevel` path (the exact
 * same gain-dice/promotion logic a real climb takes) and grants a depth-scaled
 * purse via the existing wilmst-cache row, then re-captures `rngState` (the
 * literal below captures the cursor BEFORE these draws). The events those
 * draws push are discarded — the caller (the hidden Settings toggle) prints
 * its own banner instead of replaying them.
 *
 * `options.force` (Phase 22, HARN-01) is a second DEV-ONLY affordance,
 * `null`/omitted by every real caller, forwarded straight through to
 * rollCharacter as its third argument. It substitutes the RESULTS of the
 * class/sub/race draws only (adds NO serialized field, consumes the exact
 * same draws) and is REJECTED (throws) for unknown/mismatched keys or a
 * forced Fridgian Samurai — see engine/character.js#normalizeForce. `force`
 * never flips `dev` on its own; `dev` stays exactly `startAt > 1`.
 *
 * @param {number} seed - an integer seed
 * @param {string[]} [exclude] - recent character names to avoid reusing
 * @param {{ startDepth?: number, force?: {cls?: string, sub?: string, race?: string}|null, storeRoll?: boolean }} [options] - startDepth: dev-only start-at-depth (default 1); force: dev-only chargen draw-result override (HARN-01, default null); storeRoll: shell-started run, enables the depth-rolled store stock; default false
 * @returns {object} a serializable GameState
 */
export function newRun(seed, exclude = [], { startDepth = 1, force = null, storeRoll = false } = {}) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng, exclude, force);
  // Phase 21 (TUNE-04, D-13): Math.min(DEV_START_DEPTH_MAX, difficultyCurve(startDepth).depth)
  // sanitizes ANY input — difficultyCurve's own safeDepth() already floors/
  // clamps 0, negative, NaN, non-integer and ±Infinity down to 1 (the exact
  // descend()/movement.js precedent), so a malformed dev field can never reach
  // genFloor or index THRESHOLDS out of range; DEV_START_DEPTH_MAX then caps
  // an absurdly large request. At startDepth 1 (the default), this is
  // Math.min(999, 1) === 1 — genFloor(1, rng) below is byte-identical to
  // every existing call site.
  const startAt = Math.min(DEV_START_DEPTH_MAX, difficultyCurve(startDepth).depth);
  const floor = genFloor(startAt, rng);
  reveal(floor, revealRadius({ floor, c }));

  const state = {
    version: STATE_VERSION,
    seed,
    rngState: rng.getState(),
    c,
    floor,
    day: 1,
    steps: 0,
    combat: null,
    store: null,
    beats: null,
    // PARTY-02/PARTY-08 (Phase 7): a persistent, serialized roster of full
    // rollCharacter()-shaped sheets, a SIBLING of `c`/`combat` (NOT a field on
    // `c` and NOT on `combat` — rehydrate nulls combat). Initialized as a plain
    // empty array here, exactly like `beats`/`store` above, so it adds NO rng
    // draw and does not shift the seeded chargen cursor the determinism/parity
    // suites pin. The party is INERT in combat this phase; members are appended
    // (capped at PARTY_CAP) via addPartyMember, and the array serializes/
    // round-trips for free through serializeRun's state spread. The parity
    // harness strips this top-level field the same way it strips `beats`.
    party: [],
    // ECON-02 (Phase 12, Economy A): the "found an item, awaiting the player's
    // keep/drop choice" stash — a NEW top-level nullable field, a SIBLING of
    // `combat`/`store`/`pendingJoiner` (NOT a field on `c`). Initialized to
    // `null` here as a plain assignment (NO rng draw, so the seeded chargen
    // cursor the determinism/parity suites pin is untouched) and nulled on
    // rehydrate like `combat`/`store`. The data model only in this phase; the
    // gated find/keep/drop action handlers that populate and consume it land in
    // Phase 13. The parity harness strips this top-level field the same way it
    // strips `party`/`pendingJoiner`.
    pendingFind: null,
    // Phase 29 (LOOT-01/06): the end-of-combat drop pile — a top-level
    // sibling of pendingFind, initialized to a plain empty array (NO rng
    // draw, so the seeded chargen cursor the determinism/parity suites pin
    // is untouched). UNLIKE pendingFind (transient, reset on load), this IS
    // serialized (engine/saveState.js) and survives a save/resume cycle —
    // the player must still get their loot screen back. The parity harness
    // destructures it out of all three *Comparable() fns and reconciles it
    // via reconcilePendingLoot (Task 3, mirrors reconcilePendingFind).
    pendingLoot: [],
    dead: false,
    won: false,
    // Phase 21 (TUNE-04, D-13/D-14): dev — true only for a start-at-depth run;
    // a plain boolean present on EVERY fresh state exactly like dead/won
    // above (so serializeRun/validateSave/rehydrate round-trip it and the
    // fresh-run round-trip test stays deepStrictEqual). The parity harness
    // strips it in all three comparables. A dev run is never written to the
    // graveyard or the best-depth record (src/browser/engineAdapter.js).
    dev: startAt > 1,
    // Phase 33 (STORE-01, CONTEXT Area 3): storeRoll — true only for a run
    // the SHELL starts (engineAdapter#startNewRun passes it); a plain
    // boolean present on EVERY fresh state exactly like dev above, so
    // serializeRun/validateSave/rehydrate round-trip it and the fresh-run
    // round-trip test stays deepStrictEqual. It gates the ONLY new rng
    // draws of Phase 33 (engine/economy.js#openStore's depth-rolled
    // stock). Every parity fixture, every unit test, every tools/ bot and
    // every existing caller calls newRun(seed) with no option → false →
    // openStore is byte-identical to the frozen prototype. The parity
    // harness strips it in all six comparables (three in
    // harness/comparables.js, three test-local), exactly like dev.
    storeRoll: !!storeRoll,
    deathNote: "",
    epitaph: "",
  };

  if (startAt > 1) {
    // DEV-ONLY PATH (D-14): never reached by any fixture or any default
    // caller (every fixture/every existing caller calls newRun(seed) with no
    // options, so startAt === 1 there), so the rng draws below are safe —
    // they cannot shift the seeded stream any byte-identical comparison
    // depends on.
    const events = [];
    // content/misc-tables.js THRESHOLDS = [0, 201, 501, 901, 1501].
    c.sp = THRESHOLDS[Math.min(startAt, 5) - 1];
    checkLevel(state, rng, events); // the same level-up path a real climb takes
    gainWilmst(state, WILMST_CACHE_PER_DEPTH * startAt, "dev start", rng, events); // D-13: depth-scaled purse
    state.rngState = rng.getState(); // re-capture: the literal above captured the cursor BEFORE these draws
  }
  return state;
}
