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
// "Weakened · 2"). A foe debuff is tone "good" (good for the player); a foe
// BUFF is tone "bad": Frenzied, Unmoved, and the gifts a fumbled helpful
// scroll hands a foe.
//
// Phase 77 (CMBUI-13) completes the foe side: every per-foe field Phase
// 75.1's resolveScrollFumble sets (the ward as Shielded or Bubbled, the
// Bubble's Rebound, Mirror Self, Strength, Regeneration, Sense Presence) is
// a chip here, so a foe the player's own fumble made stronger shows it on
// its card like any other condition.
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
  // RULES-18 (Phase 75.3, Plan 04): a landed Freeze HOLDS the foe its rolled
  // d4 rounds — the Held chip (labelFor picks "Frozen"); since Phase 90 plan
  // 04 no Petrify or Stupidity holds. A foe that shakes a Bard's song off
  // shows Unmoved. `held` is this table's own generic fallback label
  // (labelFor always overrides it in practice).
  held: "Held",
  unmoved: "Unmoved",
  // Phase 77 (CMBUI-13): the gifts a fumbled helpful scroll hands the
  // targeted foe (engine/scrollFumble.js#resolveHelpful, RULES-10).
  shielded: "Shielded",
  bubbled: "Bubbled",
  rebound: "Rebound",
  mirror: "Mirrored",
  might: "Strong",
  regen: "Regenerating",
  senses: "Senses",
});

/** FOE_CONDITION_DESC — one deadpan line per FOE_CONDITION_COPY key (the
 * dot entry reads poison or ice, following its label). Voice-scanned by
 * test/unit/foe-conditions.test.js, walked by test/unit/hp-not-wp.test.js. */
export const FOE_CONDITION_DESC = Object.freeze({
  // engine/abilities.js applyPommel; engine/combat.js foeTurn skips one turn, then clears it.
  stunned: "Seeing stars. It loses its next turn, then remembers where it is.",
  // Dirty Trick's blindFor counts down and restores sight.
  // VOX-05 (79-07): derived.js#foeSwingChain sets a blind foe's swing to one
  // face (its die's top face); the Blind spell sets no count, so that
  // blindness lasts the fight. Phase 90 plan 04 (SPELL-12): the cap is the
  // last term of the swing and a blind foe never lands a critical.
  blind: "It hits only on its die's top face and never lands a critical, until it can see again: the count on the chip, or the whole fight if there is none. It is swinging at where you were a moment ago.",
  // applyHamstring; foeTurn halves its blows (hero and party alike).
  hamstrung: "Its blows do half damage for the rest of the fight. It is limping about it.",
  // applyMark; playerStrike and the party's strikes add 2 damage on a marked target.
  marked: "Every blow that lands on it does 2 more damage for the rest of the fight. It has been studied, and it shows.",
  // foeTurn skips and counts it down; playerStrike's need rises to 5 against a dozing foe.
  asleep: "Dozing. It skips its turns until the count runs out, and it is easier to hit while it naps.",
  // Ice's last tick and Petrify (both end the foe); a foe that stands back up is cleared.
  frozen: "Frozen solid. As conditions go, this one is fairly final.",
  // foeTurn's acid tick: spell damage each round, past armour, until rounds reach 0.
  acid: "Acid eats at it every round until the count runs out. Its armour is no help to it.",
  // Poisoned Edge's f.dot tick in foeTurn: spell damage each round, past armour.
  poison: "Poison works on it every round until the count runs out. Its armour is no help to it.",
  // Ice's f.dot tick; when it runs out on a standing foe, it freezes solid and falls.
  ice: "The cold bites every round, and if it is still standing when the count runs out, it freezes solid.",
  // Phase 90 plan 04 (SPELL-12): magic.js sets the foe's intelligence to 1 for
  // the fight; it keeps acting and is no easier to hit, and every later resist
  // it rolls is on that 1.
  stupid: "Its intelligence is down to 1 for the rest of the fight, so it shrugs off almost nothing you cast on it. It is still swinging, which is the worrying part.",
  // magic.js halves its hit points on the cast; foeTurn halves its blows.
  shrunk: "Cut down to size: half the hit points and half the damage it had, for the rest of the fight.",
  // Turn Walking Dead: the dead it could not send back are fixated; nothing in the engine reads it.
  fixated: "It shrugged off the turning and has fixed its attention on you. It fights exactly as before.",
  // The Insane spell's madness roll; foeTurn doubles its swings.
  frenzied: "The madness went the wrong way. It swings twice as often for the rest of the fight.",
  // C.weakened: foeTurn and the pursuit roll halve every foe's damage until it fades.
  // VOX-05/ROLL-04 (79-07): the same cast sets C.foeToHitPenalty = 3, which
  // derived.js#foeSwingChain reads as a cap of three winning faces; the old
  // line left that half of the spell out.
  weakened: "Every one of them hits on no more than its die's top three faces, and does half damage, while it lasts. They are not taking it well.",
  // RULES-18 (Phase 75.3, Plan 04): holdFoe (engine/combat.js) — a Freeze's
  // rolled hold (the only hold left after Phase 90 plan 04); the foe's own
  // turn skips run down alongside the chip's count.
  held: "Held down instead of finished off: it skips its turns and is easier to hit until the count runs out, then it recovers.",
  // resistControl (engine/combat.js) — a control shaken off outright (today
  // only a Bard's song); %s is filled in by descFor with the effect's own word.
  unmoved: "It shook off %s. Deeper foes do so more often.",
  // Phase 77 (CMBUI-13) — the fumble gifts. Each line was written from the
  // resolver that applies it (engine/scrollFumble.js#resolveHelpful) and the
  // engine code that consumes it (read only), and states no hidden number.
  // Applied: resolveHelpful's plain ward { pool, rounds } (Shield). Consumed:
  // engine/foeDamage.js#damageFoe soaks every blow from the pool before the
  // armour soak, deleting it when emptied; engine/combat.js#foeTurn's tail
  // ticks its rounds down and deletes it at 0.
  shielded: "Your shield scroll picked the wrong side: it soaks up blows before they reach it, until it breaks or the count runs out.",
  // Applied: resolveHelpful's armed ward { mirror: true, popPool } (Bubble).
  // Consumed: damageFoe catches the next blow whole, stores a blow from your
  // side as `rebound`, then pops into a plain pool for the rest of the round
  // (the Shielded chip); foeTurn never ticks an armed one down.
  bubbled: "Your bubble, on its side now: the next blow at it is caught whole, sent back if you threw it, and then it thins to a film for the rest of the round.",
  // Applied: damageFoe stores a caught hero-side blow as `rebound`. Consumed:
  // foeTurn's head throws it back through applyFoeDamageToPlayer, then
  // deletes it (a foe that died first just drops it).
  rebound: "Its bubble caught your blow whole, and it throws that same blow straight back at you when the foes next move.",
  // Applied: resolveHelpful's `mirror` (the fumble row's rounds dice).
  // Consumed: engine/derived.js#targetStrikeFaces (and allyTurn/memberStrike's
  // inline copies) cap every strike at it to the top face; foeTurn's tail
  // ticks it down (foeMirrorFaded).
  mirror: "Copies of it everywhere, and only one is real: every strike at it, yours or your party's, lands only on the very top roll until the count runs out.",
  // Applied: resolveHelpful's `might` (Strength's own die). Consumed:
  // engine/combat.js#foeLevelBase adds `might` to every blow it lands (hero,
  // party and pursuit alike), for the rest of the fight. Phase 90 (SPELL-09):
  // Strength grants no hit points any more, so there is no hit-point clause.
  might: "Your Strength went to it instead: every blow it lands hits harder for the rest of the fight. It gained no hit points, which is the only mercy in this.",
  // Applied: resolveHelpful's `regen = true`. Consumed: foeTurn heals it a
  // little each round below its maximum, ahead of the asleep/stunned skips.
  regen: "It knits itself back together a little every round, even while it naps, for the rest of the fight.",
  // Applied: resolveHelpful's `senses = 1`. Consumed: nowhere — a foe's
  // senses have no rule once a fight is joined (75.1-03).
  senses: "It can sense your presence now. Since it is already fighting you, this changes nothing at all.",
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

/** RESIST_EFFECT_WORD — RULES-18 (Phase 75.3, Plan 04): the noun phrase the
 * Unmoved chip's description names, one per `foe.resisted` value
 * (engine/combat.js's own control-effect vocabulary). Falls back to a
 * generic phrase for an effect this table has not been taught yet. */
const RESIST_EFFECT_WORD = Object.freeze({
  freeze: "the freeze", stone: "the stone", sleep: "the sleep", weaken: "the weakening",
  stupid: "the stupidity", blind: "the blindness", shrink: "the shrinking",
});

/**
 * FOE_CONDITIONS — frozen, ordered. Each entry:
 *   key      the engine field (or, for Weakened, the combat-wide flag; for
 *            the ward, one key per shape: shielded/bubbled) it shows
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
    // RULES-18 (Phase 75.3, Plan 04): holdFoe's `{ kind, left }` record — a
    // Freeze's rolled hold (the only one since Phase 90 plan 04, kind
    // "frozen"); the label is the matching permanent condition's own house label.
    {
      key: "held", label: C.held, desc: D.held, tone: "good", fields: ["held"],
      labelFor: () => C.frozen,
      when: (f) => !!f.held && posInt(f.held.left) !== null,
      rounds: (f) => posInt(f.held.left),
    },
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
    // A foe BUFF: it swings twice.
    { key: "frenzied", label: C.frenzied, desc: D.frenzied, tone: "bad", fields: ["frenzied"], when: (f) => !!f.frenzied, rounds: none },
    // Phase 77 (CMBUI-13) — the gifts a fumbled helpful scroll hands the
    // targeted foe (engine/scrollFumble.js#resolveHelpful, RULES-10). Every
    // one is a foe BUFF, so tone "bad", like Frenzied.
    //
    // The foe's ward, in its two shapes (the SAME two the hero's own ward
    // takes). A plain pool — Shield's { pool, rounds }, or a popped Bubble's
    // one-round film — soaks in engine/foeDamage.js#damageFoe and ticks down
    // in engine/combat.js#foeTurn's tail.
    {
      key: "shielded", label: C.shielded, desc: D.shielded, tone: "bad", fields: ["ward"],
      when: (f) => !!f.ward && !f.ward.mirror && typeof f.ward.pool === "number" && f.ward.pool > 0,
      rounds: (f) => posInt(f.ward.rounds),
    },
    // An armed Bubble { mirror: true } waits for a blow (damageFoe catches it
    // whole); it is never ticked down, so it has no count.
    { key: "bubbled", label: C.bubbled, desc: D.bubbled, tone: "bad", fields: ["ward"], when: (f) => !!f.ward && f.ward.mirror === true, rounds: none },
    // damageFoe's caught hero-side blow, thrown back at the top of foeTurn.
    { key: "rebound", label: C.rebound, desc: D.rebound, tone: "bad", fields: ["rebound"], when: (f) => typeof f.rebound === "number" && f.rebound > 0, rounds: none },
    // Mirror Self's rounds: targetStrikeFaces caps every strike at the top face; foeTurn ticks it.
    { key: "mirror", label: C.mirror, desc: D.mirror, tone: "bad", fields: ["mirror"], when: (f) => posInt(f.mirror) !== null, rounds: (f) => posInt(f.mirror) },
    // Strength: `might` feeds foeLevelBase (a flat d10 on each blow it lands, for the fight).
    { key: "might", label: C.might, desc: D.might, tone: "bad", fields: ["might"], when: (f) => posInt(f.might) !== null, rounds: none },
    // Regeneration: foeTurn's per-foe heal below its maximum.
    { key: "regen", label: C.regen, desc: D.regen, tone: "bad", fields: ["regen"], when: (f) => !!f.regen, rounds: none },
    // Sense Presence: no rule reads a foe's senses mid-fight; shown because the player caused it.
    { key: "senses", label: C.senses, desc: D.senses, tone: "bad", fields: ["senses"], when: (f) => !!f.senses, rounds: none },
    // Weaken is COMBAT-WIDE (C.weakened halves every foe's damage); its
    // duration lives on the hero's own c.timers["spell:weaken"] record.
    // Quick 260927-rsx: a foe that resisted the landed Weaken shows no chip.
    { key: "weakened", label: C.weakened, desc: D.weakened, tone: "good", fields: ["weakened"], when: (f, s) => !!(s && s.combat && s.combat.weakened && !(f && f.weakenResisted)), rounds: (f, s) => weakenLeft(s) },
    // RULES-18 (Phase 75.3, Plan 04): resistControl marks `foe.resisted` with
    // the effect it just shook off — the ONE foe-card sign a control was
    // even attempted; tone "bad" (unlike every other entry here) because a
    // resist is bad news for the player, not good.
    {
      key: "resisted", label: C.unmoved, desc: D.unmoved, tone: "bad", fields: ["resisted"],
      descFor: (f) => D.unmoved.replace("%s", RESIST_EFFECT_WORD[f.resisted] ?? "the effect"),
      when: (f) => !!f.resisted,
      rounds: none,
    },
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
