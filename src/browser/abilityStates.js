// src/browser/abilityStates.js
//
// Phase 94 (ASTATE-01..03): the words an ability row shows for the engine's
// derived state (engine/abilities.js#abilityState, engine/combat.js#singState).
// Read by the combat ABILITIES submenu, the Bard's Sing row and the Hero tab,
// so all three say identical words.
//
// FUNCTIONAL AND PLAIN BY USER DECISION (94-CONTEXT "Full-word labels"): these
// are state labels, not flavour. Phase 96's flavour pass must not rewrite them
// (ROADMAP boundary). The reason map covers exactly the engine's unavailable
// reasons (test/unit/ability-state-copy.test.js pins it), so a new engine
// reason cannot ship without words.
//
// PRESENTATION ONLY, pure module: no DOM, no engine import, no rng. The
// view-model passes the engine state and the catalog entry in.

/** ABILITY_STATE_COPY — every ability-state word (voice-scanned; registered in tools/lib/voice-corpus.mjs). */
export const ABILITY_STATE_COPY = Object.freeze({
  // state "ready", the ability can be used now.
  ready: "READY",
  // state "ready" for a once-a-fight ability (catalog cd "fight"); the middle dot is U+00B7.
  readyOnce: "READY · ONCE PER FIGHT",
  // state "recharging"; {n} is the rounds left, no plural logic (READY IN 1).
  recharging: "READY IN {n}",
  // state "spent", a once-a-fight ability already used this fight, or the Bard's song already sung.
  spent: "SPENT THIS FIGHT",
  // state "unavailable": one plain line per engine reason.
  reason: Object.freeze({
    // reason notFought: a fight-only ability, no fight begun yet.
    notFought: "FIGHT FIRST",
    // reason unknown: the key is not an ability this hero owns.
    unknown: "NOT ONE OF YOURS",
    // reason notInCombat: a combat-only ability outside a fight.
    notInCombat: "NOT IN A FIGHT",
    // reason noTarget: a foe ability with no live foe in reach.
    noTarget: "NO FOE IN REACH",
    // reason tooFewFoes: an ability that needs two or more foes (kept from the old menu copy).
    tooFewFoes: "NEEDS TWO OR MORE FOES",
    // reason alreadyOn: the effect is already running on the hero (kept from the old menu copy).
    alreadyOn: "ALREADY ON IT",
    // reason notLowEnough: Last Stand's hp gate (a quarter of max hp, DEATH_PANIC_THRESHOLD 0.25).
    notLowEnough: "NEEDS A QUARTER HP OR LESS",
    // Sing's reason wrongClass: the Bard's Sing row for a hero who is not a Bard.
    wrongClass: "NOT FOR YOU",
  }),
});

/**
 * abilityStateLabel — the words for an engine ability state. Pure.
 * @param {{state: string, roundsLeft: number, reason: (string|null)}} st  abilityState / singState result
 * @param {(object|null)} meta  the catalog entry (ABILITY_BY_ID[key]); null for the Sing row
 * @returns {string}
 */
export function abilityStateLabel(st, meta) {
  if (st.state === "ready") {
    return meta && meta.cd === "fight" ? ABILITY_STATE_COPY.readyOnce : ABILITY_STATE_COPY.ready;
  }
  if (st.state === "recharging") {
    return ABILITY_STATE_COPY.recharging.replace("{n}", String(st.roundsLeft));
  }
  if (st.state === "spent") return ABILITY_STATE_COPY.spent;
  return ABILITY_STATE_COPY.reason[st.reason] ?? ABILITY_STATE_COPY.reason.unknown;
}
