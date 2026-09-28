// content/flee.js
//
// DELIBERATE RULES CHANGE (Phase 42, 2026-09-18, FLEE-01, CONTEXT Area 1
// user-chosen 35%): the prototype's flat d20 (+5 Thief) vs 11 (50% base,
// 75% for a Thief) becomes d20 + Thief 5 + class + race - armor bulk vs 14
// (35% base, 60% for a Thief in light armor, 25% for a Fighter in Plate).
// Every class/race modifier is bounded to +-2 and reasoned in docs/FLEE.md:
//   - Elven +1: light and quick, strikes a die better — a step easier to
//     slip away too.
//   - Dwarven -1: stocky and short-legged; not built for a sprint.
//   - Fridgian -1: strikes last (`slow`) — the same lack of urgency costs
//     them the door.
//   - Troll -1: Large, 75 wp of lumber; nothing about a Troll is quick.
//   - Magic User -1: robes and no footwork.
//   - Fighter/Thief 0: the Thief's own bonus IS the trade; a Fighter is
//     the class-neutral baseline.
//
// DELIBERATE RULES CHANGE (quick 260928-nrf, user ruling 2026-09-28,
// "Thief flee +5 -> +3"): the Thief's flee bonus is +3, not canon's +5. The
// 260928-abl ability audit found the +5 alone worth about 0.6 floors of mean
// depth and 12 points of reach-5 to a Thief, almost exactly the Thief's lead
// over the Fighter. At +3 a Human Thief in light armour clears 14 on an 11
// or better (50%) instead of a 9 or better (60%). Declared in docs/FLEE.md
// and test/parity/FIXTURE-INVENTORY.md.
//
// Pure data — read by engine/derived.js#fleeBreakdown, which is the ONE
// place that assembles these into the fleeRolled event's `mods` list.

export const FLEE_NEED = 14;
export const FLEE_THIEF_BONUS = 3;

export const FLEE_CLASS_MOD = Object.freeze({
  "Magic User": -1,
  "Fighter": 0,
  "Thief": 0,
});

export const FLEE_RACE_MOD = Object.freeze({
  Human: 0,
  Elven: 1,
  Dwarven: -1,
  Wilmsry: 0,
  Fridgian: -1,
  Troll: -1,
});
