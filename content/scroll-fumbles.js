// content/scroll-fumbles.js
//
// RULES-10 (Phase 75.1): what a fumbled scroll does, per spell. Read by
// engine/scrollFumble.js#resolveScrollFumble and nothing else — the design
// lives here, in one reviewable table, rather than scattered across the
// resolver. Keyed by each spell's exact content/spells.js#SPELLS `n` string
// (41 rows as of Phase 90 plan 09, no normalisation — a renamed or added spell fails
// test/unit/scroll-fumble-table.test.js's coverage check).
//
// Row shape: `{ side, effect }` plus, where listed:
//   - `rounds` — dice notation `{ n, sides, bonus }` (never a string)
//   - `kind` — for `out` rows only: "asleep" | "stupefied" | "maddened" | "stopped"
//   - `how` — for `heavy` rows only: what the spell tried to do
//   - `once` — Earthquake only: it rolls once for everyone, as its own
//     castSpell branch does
// (Phase 90 plan 05: Ice's old `then: "heavy"` hand-off is gone with Ice's
// damage-over-time. Ice is now an area damage row, the Lightning shape: it
// hits the reader and the reader's side, each its own roll.)
//
// User rulings (2026-09-25, two rounds, decided after planning — see
// .planning/phases/75.1-pilfer-fumbles-scroll-reading/75.1-CONTEXT.md
// "Fumble severity rulings"):
//   - No fumble kills outright. Freeze, Petrify and Death are `heavy` (a
//     derived d10 + depth, unsoaked, plus Afraid) instead of an instant
//     kill; Noxious Vapor's killing face resolves the same way.
//   - Turn-loss fumbles cost the hero AT MOST d4 turns: Doze, Stun,
//     Stupidity and Insane are `out` rows, and Noxious Vapor's sleeping face
//     is also an out for d4. No row costs turns for the whole fight, and
//     foes hit an `out` hero normally (no easier-hit bonus).
//   - Blind and Shrink work on the hero exactly as they work on a foe and
//     cost NO turns: Blind drops the hero's weapon to-hit to its top face,
//     Shrink halves current hp (never max hp) and weapon damage, both for
//     the rest of the fight.
//   - A fumbled Summon joins the foes as a reinforcement.

export const FUMBLE_SIDES = Object.freeze(["harmful", "area", "helpful"]);

export const FUMBLE_EFFECTS = Object.freeze({
  harmful: Object.freeze([
    "damage", "dot", "heavy", "out", "blind", "shrink", "weakened", "vapor", "none", "insulted",
  ]),
  area: Object.freeze(["damage", "volley"]),
  helpful: Object.freeze([
    "heal", "regen", "ward", "might", "mirror", "senses", "summon", "frenzy", "wasted",
  ]),
});

const D4 = Object.freeze({ n: 1, sides: 4, bonus: 0 });
const D4_PLUS_1 = Object.freeze({ n: 1, sides: 4, bonus: 1 });
const D6 = Object.freeze({ n: 1, sides: 6, bonus: 0 });
// Stop Time's fumble always costs the reader exactly two turns: no dice, a flat 2.
const TWO_ROUNDS = Object.freeze({ n: 0, sides: 1, bonus: 2 });

export const SCROLL_FUMBLE = Object.freeze({
  "Heal": Object.freeze({ side: "helpful", effect: "heal" }),
  "Shield": Object.freeze({ side: "helpful", effect: "ward" }),
  "Strength": Object.freeze({ side: "helpful", effect: "might" }),
  "Doze": Object.freeze({ side: "harmful", effect: "out", kind: "asleep", rounds: D4 }),
  "Freeze": Object.freeze({ side: "harmful", effect: "heavy", how: "frozen" }),
  "Map the Floor": Object.freeze({ side: "helpful", effect: "wasted" }),
  "Mirror Self": Object.freeze({ side: "helpful", effect: "mirror", rounds: D6 }),
  "Stun": Object.freeze({ side: "harmful", effect: "out", kind: "asleep", rounds: D4 }),
  "Weaken": Object.freeze({ side: "harmful", effect: "weakened", rounds: D4_PLUS_1 }),
  "Acid": Object.freeze({ side: "harmful", effect: "dot", rounds: D6 }),
  "Stupidity": Object.freeze({ side: "harmful", effect: "out", kind: "stupefied", rounds: D4 }),
  "Blind": Object.freeze({ side: "harmful", effect: "blind" }),
  "Shrink": Object.freeze({ side: "harmful", effect: "shrink" }),
  "Ice": Object.freeze({ side: "area", effect: "damage" }),
  "Earthquake": Object.freeze({ side: "area", effect: "damage", once: true }),
  "Noxious Vapor": Object.freeze({ side: "harmful", effect: "vapor", rounds: D4 }),
  "Fireballs": Object.freeze({ side: "area", effect: "volley" }),
  "Petrify": Object.freeze({ side: "harmful", effect: "heavy", how: "stone" }),
  "Insane": Object.freeze({ side: "harmful", effect: "out", kind: "maddened", rounds: D4 }),
  "Summon": Object.freeze({ side: "helpful", effect: "summon" }),
  "Fireball": Object.freeze({ side: "harmful", effect: "damage" }),
  "Major Heal": Object.freeze({ side: "helpful", effect: "heal" }),
  "Bubble": Object.freeze({ side: "helpful", effect: "ward" }),
  "Sense Danger": Object.freeze({ side: "helpful", effect: "wasted" }),
  "Turn Walking Dead": Object.freeze({ side: "harmful", effect: "none" }),
  "Plane Gate": Object.freeze({ side: "harmful", effect: "none" }),
  "Sense Presence": Object.freeze({ side: "helpful", effect: "senses" }),
  "Lightning": Object.freeze({ side: "area", effect: "damage" }),
  "Regeneration": Object.freeze({ side: "helpful", effect: "regen" }),
  "Mangle": Object.freeze({ side: "harmful", effect: "damage" }),
  "Death": Object.freeze({ side: "harmful", effect: "heavy", how: "death" }),
  // Phase 90 plan 07 (SPELL-10): the four Special spells that buff and travel.
  // A fumbled Open/Lock, Fly or Enchant Character is wasted on the foe (it has
  // no chest, no walls and no use for a personal enchantment); a fumbled Speed
  // of Sound makes the target foe swing twice a turn for the fight (`frenzy`,
  // the same `f.frenzied` read the Insane table's 5 sets).
  "Open/Lock": Object.freeze({ side: "helpful", effect: "wasted" }),
  "Fly": Object.freeze({ side: "helpful", effect: "wasted" }),
  "Enchant Character": Object.freeze({ side: "helpful", effect: "wasted" }),
  "Speed of Sound": Object.freeze({ side: "helpful", effect: "frenzy" }),
  // Phase 90 plan 08 (SPELL-10): the control spells. A fumbled Stop Time stops
  // the READER for two turns (`out`, kind "stopped"; foes hit a stopped hero
  // normally, as for every out); a fumbled Senseless or Duplicate Foe maddens
  // the reader for d4 or d4+1 turns, the Insane row's own `maddened` out.
  "Stop Time": Object.freeze({ side: "harmful", effect: "out", kind: "stopped", rounds: TWO_ROUNDS }),
  "Senseless": Object.freeze({ side: "harmful", effect: "out", kind: "maddened", rounds: D4 }),
  "Duplicate Foe": Object.freeze({ side: "harmful", effect: "out", kind: "maddened", rounds: D4_PLUS_1 }),
  // Phase 90 plan 09 (SPELL-10): the last three of the slate. A fumbled Door
  // Illusion changes nothing (the door does not open: the Turn Walking Dead
  // shape); a fumbled Chameleon Tongue insults the room (the `insulted` effect
  // sets the parley insult, +1 on every foe's winning faces for the fight); a
  // fumbled Size of the Behemoth shrinks the READER's nerve: the existing
  // `weakened` effect, d4+1 rounds.
  "Door Illusion": Object.freeze({ side: "harmful", effect: "none" }),
  "Chameleon Tongue": Object.freeze({ side: "harmful", effect: "insulted" }),
  "Size of the Behemoth": Object.freeze({ side: "harmful", effect: "weakened", rounds: D4_PLUS_1 }),
});
