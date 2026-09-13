// engine/state.js
//
// GameState factory (ENG-01, ENG-02, ENG-04). newRun(seed) builds a fully
// JSON-serializable game state from a single integer seed: a dice-rolled
// character, floor 1, day/step counters, and the seeded RNG's cursor stored
// directly on state so a run is reproducible and round-trips losslessly. No
// DOM, no localStorage, no Math.random, no module-global `S`.

import { makeRng } from "./rng.js";
import { genFloor, reveal } from "./maze.js";
import { rollCharacter } from "./character.js";
import { revealRadius } from "./derived.js";

/** Save-schema version, bumped when the GameState shape changes (see 01-06). */
export const STATE_VERSION = 1;

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
 * @param {number} seed - an integer seed
 * @param {string[]} [exclude] - recent character names to avoid reusing
 * @returns {object} a serializable GameState
 */
export function newRun(seed, exclude = []) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng, exclude);
  const floor = genFloor(1, rng);
  reveal(floor, revealRadius({ floor, c }));

  return {
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
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
  };
}
