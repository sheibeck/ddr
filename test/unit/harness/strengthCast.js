// test/unit/harness/strengthCast.js
//
// Phase 92.2 plan 01: the shared fixtures for the Strength potion / spell tests
// (test/unit/strength-potion-spells.test.js and strength-damage-lines.test.js):
// a fresh hero and state, a scripted rng, and `cast(spell, mode, ...)`, one cast
// on a clean state with the Strength potion and/or spell record live. Pure data
// and the real engine; no mocks of the Strength math.

import { castSpell } from "../../../engine/magic.js";
import { startEffect } from "../../../engine/effects.js";
import { derivedRng, makeRng } from "../../../engine/rng.js";
import { SPELLS } from "../../../content/index.js";
import { GW, GH } from "../../../engine/maze.js";
import { noResistActs } from "./spellResistActs.js";

export const IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
export const MIGHT = 8;
/** the d10 strengthRoll yields when the main cursor reads `cursor`. */
export const d10At = (cursor) => derivedRng(cursor, "strength").d(10);

/** mkRng(seq) — `.d()` pops the next scripted value and throws on underflow; the cursor reads a constant 0. */
export function mkRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`mkRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    getState: () => 0,
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

export function floor() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 5, py: 5, depth: 1 };
}

export function hero(o = {}) {
  return {
    cls: "Magic User", sub: "Wizard", race: "Human", level: 1, sp: 0, maxWP: 400, wp: 400, skills: {}, vp: 0,
    weapon: "Dagger", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 4, rations: 6, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
    might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, halfNext: false, worn: {}, ...o,
  };
}

export const foe = (o = {}) => ({ name: "Wolf", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 500, maxWP: 500, alive: true, asleep: 0, sp: {}, lives: 1, ...o });

/** withStrength(c, mode) — start the potion and/or spell record by hand; mode is "none" | "potion" | "spell" | "both". */
export function withStrength(c, mode) {
  if (mode === "potion" || mode === "both") startEffect(c, "item:Strength", { squares: 25 });
  if (mode === "spell" || mode === "both") startEffect(c, "spell:Strength", { squares: 100 });
  return c;
}

/** stateOf(c, foes) — a fresh in-combat state around a hero sheet. */
export function stateOf(c, foes) {
  return {
    version: 1, seed: 1, rngState: 1, c, floor: floor(), day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "", pendingJoiner: null, pendingFind: null,
    ...(foes ? { combat: { foes, type: "Humans", round: 1, target: 0, spellOpen: false, tracked: false } } : {}),
  };
}

/** cast(spell, mode, opts) — one cast on a fresh state; `lost` is each foe's hp lost. A `seq` scripts the rng, else makeRng(seed). */
export function cast(spellName, mode, { level = 3, foes = [{}], seq = null, seed = 1 } = {}) {
  const c = withStrength(hero({ level, grimoire: [spellName] }), mode);
  const state = stateOf(c, foes.map((f) => foe(f)));
  state.acts = noResistActs(spellName, foes.length);
  const events = castSpell(state, IDX[spellName], seq ? mkRng(seq) : makeRng(seed), []);
  return { state, events, lost: state.combat.foes.map((f) => 500 - f.wp) };
}
