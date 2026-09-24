// src/browser/foeConditions.js
//
// Phase 71 (POLISH-09, D-14) — the ONE table of foe conditions the player
// sees as chips. The user's report (2026-09-24): "the hamstring ability
// doesn't show up on enemies as a condition chit. Let's make sure
// conditions from all abilities, spells show up on enemies when affected."
// The shell's old hand-written foeStatusBadges list missed Hamstrung and
// Marked (and Pommel's Stunned, and Dirty Trick's timed Blind).
//
// One-table rule: the combat foe cards' chips (mazeworld.html's
// foeStatusBadges, through window.__mzFoeConditions) and 71-04's long-press
// foe card both read THIS table. Nothing else maps a foe field to a label.
//
// Coverage guard: test/unit/foe-conditions.test.js scans the engine's
// source for every assignment to a foe field and every combat-wide flag.
// Each one must be a key here, a field an entry reads (`fields`), or sit on
// the test's own reasoned NOT_A_CONDITION list — so a new foe effect with no
// chip fails the build. The engine is never edited to satisfy it (R-11).
//
// House label style: one capitalised word ("Hamstrung", "Marked"), with
// " · n" appended when the effect is timed ("Blind · 2", "Acid · 3",
// "Weakened · 2"). A foe debuff is tone "good" (good for the player);
// Frenzied, the one foe buff, is tone "bad".
//
// Phase 71 (D-16, R-30): each condition also carries a one-line
// description (FOE_CONDITION_DESC), and every chip carries it as `desc`.
// The long-press details card (src/browser/foeDetails.js) is where a foe
// condition is explained, one line per current effect. A foe's chips are
// text inside its card's tag line, so a tap on a chip is a tap on the card:
// it aims at that foe and never raises a card. Each sentence was written
// from the engine code that applies and consumes the condition (read only)
// and the matching ability or spell text; it states no number the player
// cannot already see.
//
// PRESENTATION ONLY, pure module: no DOM/window access, no timers, no rng,
// no engine imports, no mutation of the foe or the state. Reading
// `state.c.timers` is plain data.

/** FOE_CONDITION_COPY — every label this module emits (voice-scanned by
 * test/unit/foe-conditions.test.js, walked by test/unit/hp-not-wp.test.js). */
export const FOE_CONDITION_COPY = Object.freeze({
  stunned: "Stunned",
  blind: "Blind",
  hamstrung: "Hamstrung",
  marked: "Marked",
  asleep: "Asleep",
  frozen: "Frozen",
  acid: "Acid",
  poison: "Poison",
  ice: "Ice",
  stupid: "Stupefied",
  shrunk: "Shrunk",
  fixated: "Fixated",
  frenzied: "Frenzied",
  weakened: "Weakened",
});

/** FOE_CONDITION_DESC — one deadpan line per FOE_CONDITION_COPY key (the
 * dot entry reads poison or ice, following its label). Voice-scanned by
 * test/unit/foe-conditions.test.js, walked by test/unit/hp-not-wp.test.js. */
export const FOE_CONDITION_DESC = Object.freeze({
  // engine/abilities.js applyPommel; engine/combat.js foeTurn skips one turn, then clears it.
  stunned: "Seeing stars. It loses its next turn, then remembers where it is.",
  // foeTurn sets a blind foe's need to its worst; Dirty Trick's blindFor counts down and restores sight.
  blind: "It swings at where you were a moment ago and almost never lands. A count on the chip is how long until it can see again.",
  // applyHamstring; foeTurn halves its blows (hero and party alike).
  hamstrung: "Its blows do half damage for the rest of the fight. It is limping about it.",
  // applyMark; playerStrike and the party's strikes add 2 damage on a marked target.
  marked: "Every blow that lands on it does 2 more damage for the rest of the fight. It has been studied, and it shows.",
  // foeTurn skips and counts it down; playerStrike's need rises to 5 against a dozing foe.
  asleep: "Dozing. It skips its turns until the count runs out, and it is easier to hit while it naps.",
  // Freeze, Ice's last tick and Petrify; a foe that stands back up is cleared.
  frozen: "Frozen solid. As conditions go, this one is fairly final.",
  // foeTurn's acid tick: spell damage each round, past armour, until rounds reach 0.
  acid: "Acid eats at it every round until the count runs out. Its armour is no help to it.",
  // Poisoned Edge's f.dot tick in foeTurn: spell damage each round, past armour.
  poison: "Poison works on it every round until the count runs out. Its armour is no help to it.",
  // Ice's f.dot tick; when it runs out on a standing foe, it freezes solid and falls.
  ice: "The cold bites every round, and if it is still standing when the count runs out, it freezes solid.",
  // foeTurn skips every turn for the fight; playerStrike treats it like a dozing foe.
  stupid: "It does nothing at all for the rest of the fight, and it is easier to hit. Nobody is home.",
  // magic.js halves its hit points on the cast; foeTurn halves its blows.
  shrunk: "Cut down to size: half the hit points and half the damage it had, for the rest of the fight.",
  // Turn Walking Dead: the dead it could not send back are fixated; nothing in the engine reads it.
  fixated: "It shrugged off the turning and has fixed its attention on you. It fights exactly as before.",
  // The Insane spell's madness roll; foeTurn doubles its swings.
  frenzied: "The madness went the wrong way. It swings twice as often for the rest of the fight.",
  // C.weakened: foeTurn and the pursuit roll halve every foe's damage until it fades.
  weakened: "Every one of them does half damage while it lasts. They are not taking it well.",
});

/** posInt(n) — n when it is a whole number above zero, else null. */
function posInt(n) {
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** weakenLeft(state) — the hero's live spell:weaken record's rounds, or null. */
function weakenLeft(state) {
  const timers = state && state.c && state.c.timers;
  const rec = timers && timers["spell:weaken"];
  return rec ? posInt(rec.left) : null;
}

const C = FOE_CONDITION_COPY;
const D = FOE_CONDITION_DESC;
const none = () => null;

/**
 * FOE_CONDITIONS — frozen, ordered. Each entry:
 *   key      the engine field (or, for Weakened, the combat-wide flag) it shows
 *   label    its FOE_CONDITION_COPY label (labelFor overrides it per foe)
 *   tone     "good" for a foe debuff, "bad" for a foe buff
 *   fields   every engine field the entry reads (the coverage guard's list)
 *   when(foe, state)   → truthy while the condition lasts
 *   rounds(foe, state) → a whole number of rounds left, or null
 *   desc     its FOE_CONDITION_DESC line (descFor overrides it per foe)
 * Chip order is this order.
 */
export const FOE_CONDITIONS = Object.freeze(
  [
    // engine/abilities.js applyPommel; engine/combat.js foeTurn consumes it.
    { key: "stunned", label: C.stunned, desc: D.stunned, tone: "good", fields: ["stunned"], when: (f) => !!f.stunned, rounds: none },
    // Dirty Trick (blind + blindFor 2, ticked down in foeTurn) and the Blind spell (blind alone).
    { key: "blind", label: C.blind, desc: D.blind, tone: "good", fields: ["blind", "blindFor"], when: (f) => !!f.blind || posInt(f.blindFor) !== null, rounds: (f) => posInt(f.blindFor) },
    // engine/abilities.js applyHamstring: half damage for the rest of the fight.
    { key: "hamstrung", label: C.hamstrung, desc: D.hamstrung, tone: "good", fields: ["hamstrung"], when: (f) => !!f.hamstrung, rounds: none },
    // engine/abilities.js applyMark: +2 on every hero strike at this foe.
    { key: "marked", label: C.marked, desc: D.marked, tone: "good", fields: ["marked"], when: (f) => !!f.marked, rounds: none },
    // Sleep/Doze spells, Sing, items: a countdown decremented each foe turn.
    { key: "asleep", label: C.asleep, desc: D.asleep, tone: "good", fields: ["asleep"], when: (f) => f.asleep === true || posInt(f.asleep) !== null, rounds: (f) => posInt(f.asleep) },
    // Freeze/Ice/Petrify. The engine clears it on a foe that stands back up.
    { key: "frozen", label: C.frozen, desc: D.frozen, tone: "good", fields: ["frozen"], when: (f) => !!f.frozen, rounds: none },
    // The Acid spell's `{ rounds, dmg }` record.
    { key: "acid", label: C.acid, desc: D.acid, tone: "good", fields: ["acid"], when: (f) => !!f.acid && posInt(f.acid.rounds) !== null, rounds: (f) => posInt(f.acid.rounds) },
    // The shared `{ left, dmg, by }` DOT: Poisoned Edge, and Ice (by "ice").
    {
      key: "dot", label: C.poison, desc: D.poison, tone: "good", fields: ["dot"],
      labelFor: (f) => (f.dot.by === "ice" ? C.ice : C.poison),
      descFor: (f) => (f.dot.by === "ice" ? D.ice : D.poison),
      when: (f) => !!f.dot && typeof f.dot === "object" && posInt(f.dot.left) !== null,
      rounds: (f) => posInt(f.dot.left),
    },
    { key: "stupid", label: C.stupid, desc: D.stupid, tone: "good", fields: ["stupid"], when: (f) => !!f.stupid, rounds: none },
    { key: "shrunk", label: C.shrunk, desc: D.shrunk, tone: "good", fields: ["shrunk"], when: (f) => !!f.shrunk, rounds: none },
    { key: "fixated", label: C.fixated, desc: D.fixated, tone: "good", fields: ["fixated"], when: (f) => !!f.fixated, rounds: none },
    // The one foe BUFF: it swings twice.
    { key: "frenzied", label: C.frenzied, desc: D.frenzied, tone: "bad", fields: ["frenzied"], when: (f) => !!f.frenzied, rounds: none },
    // Weaken is COMBAT-WIDE (C.weakened halves every foe's damage); its
    // duration lives on the hero's own c.timers["spell:weaken"] record.
    { key: "weakened", label: C.weakened, desc: D.weakened, tone: "good", fields: ["weakened"], when: (f, s) => !!(s && s.combat && s.combat.weakened), rounds: (f, s) => weakenLeft(s) },
  ].map((e) => Object.freeze({ ...e, fields: Object.freeze([...e.fields]) })),
);

/** safe(fn, fallback) — fn(), or fallback when fn throws (a hostile getter). */
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * foeConditionChips(foe, state) — a frozen array of frozen
 * `{ key, label, tone, rounds, text, desc }`, in table order, for a LIVE foe.
 * `text` is "label · rounds" when rounds is set, else the label. `desc` is
 * the entry's FOE_CONDITION_DESC line (Phase 71 D-16), following the label.
 * A dead or non-object foe returns []. A null/malformed state drops only
 * the combat-wide chips. Never throws: a throwing getter drops only the
 * chip that read it.
 */
export function foeConditionChips(foe, state) {
  if (!foe || typeof foe !== "object") return Object.freeze([]);
  if (safe(() => foe.alive === false, true)) return Object.freeze([]);
  const out = [];
  for (const e of FOE_CONDITIONS) {
    if (!safe(() => e.when(foe, state), false)) continue;
    const r = safe(() => e.rounds(foe, state), null);
    const rounds = posInt(r);
    const label = e.labelFor ? safe(() => e.labelFor(foe, state), e.label) : e.label;
    const desc = e.descFor ? safe(() => e.descFor(foe, state), e.desc) : e.desc;
    out.push(Object.freeze({ key: e.key, label, tone: e.tone, rounds, text: rounds !== null ? `${label} · ${rounds}` : label, desc }));
  }
  return Object.freeze(out);
}
