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
 * newRun(seed) — a fresh run. The CALLER supplies the seed (do not read the
 * wall clock here — that stays a presentation/boot concern so the engine
 * remains pure and deterministic). The RNG is threaded through character
 * generation and floor generation in the exact order the prototype's newGame()
 * used (rollCharacter → genFloor(1) → reveal), so the same seed produces a
 * byte-identical run, and its final cursor is persisted as `rngState`.
 *
 * @param {number} seed - an integer seed
 * @returns {object} a serializable GameState
 */
export function newRun(seed) {
  const rng = makeRng(seed);
  const c = rollCharacter(rng);
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
    dead: false,
    won: false,
    deathNote: "",
    epitaph: "",
  };
}
