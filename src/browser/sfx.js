// src/browser/sfx.js
//
// AUD-01/02/03 pure audio seam (Phase 56). This is the Phase 56 audio seam:
// presentation-only, and it never touches engine/ or content/ (it only
// READS content/bestiary.js's BESTIARY keys, via the test file, to prove
// FAMILY_CRY's totality — this module itself imports nothing).
//
// Variation is a counter-driven round-robin with NO pseudo-random source
// anywhere in this file — not Math.random(), not crypto.getRandomValues(),
// not a draw off the engine's rng stream. That is deliberate: a shuffle-bag
// driven by a plain counter cannot perturb engine determinism no matter how
// it is called, so this module is free to sit on the dispatch path without
// touching parity. (See 56-CONTEXT.md "Event mapping & variation".)
//
// This half of the module (56-02) is the pure core only: clip vocabulary,
// event->group table, family->cry map, and (Task 2) the two resolver
// functions. It holds no audio API, no DOM access, no timer, and imports
// nothing, so `node --test` can pin all of it directly. 56-03 appends the
// Web Audio backend (decode/play/voice management) to this same file, per
// CONTEXT's "Module shape inside src/browser/sfx.js" discretion — one
// module, two passes. Like haptics.js, cosmetic/presentation code here must
// never throw.

// CLIP_IDS — the 30 delivered clip basenames (no extension), exactly
// matching every file in sfx/ (and, after build, www/sfx/ via copySfx()).
// This list is asserted 1:1 against sfx/ by test/unit/sfx-map.test.js AND
// against test/unit/sfx-assets.test.js's own manifest (56-01) — two
// independent pins on the same 30 filenames.
export const CLIP_IDS = Object.freeze([
  "walk1", "walk2", "walk3",
  "walk-water1", "walk-water2", "walk-water3",
  "hit1", "hit2",
  "miss1", "miss2",
  "hurt1", "hurt2", "hurt3",
  "foe-die",
  "enemy-beast", "enemy-demon", "enemy-human", "enemy-undead",
  "spell",
  "resist",
  "heal",
  "drink",
  "chest",
  "gold",
  "trap",
  "jump",
  "stairs",
  "levelup",
  "death",
  "ui-tap",
]);

// CLIP_GROUPS — group id -> ordered, frozen array of clip ids. Five
// multi-clip groups get counter-driven variation (see createVariation() in
// Task 2); the thirteen single-clip groups are one-element arrays so the
// same resolver code path handles them without a branch. The enemy-* cries
// are deliberately NOT a group here — they resolve directly through
// FAMILY_CRY, one cry per BESTIARY family, never rotated.
export const CLIP_GROUPS = Object.freeze({
  walk: Object.freeze(["walk1", "walk2", "walk3"]),
  water: Object.freeze(["walk-water1", "walk-water2", "walk-water3"]),
  hit: Object.freeze(["hit1", "hit2"]),
  miss: Object.freeze(["miss1", "miss2"]),
  hurt: Object.freeze(["hurt1", "hurt2", "hurt3"]),
  foeDie: Object.freeze(["foe-die"]),
  spell: Object.freeze(["spell"]),
  resist: Object.freeze(["resist"]),
  heal: Object.freeze(["heal"]),
  drink: Object.freeze(["drink"]),
  chest: Object.freeze(["chest"]),
  gold: Object.freeze(["gold"]),
  trap: Object.freeze(["trap"]),
  jump: Object.freeze(["jump"]),
  stairs: Object.freeze(["stairs"]),
  levelup: Object.freeze(["levelup"]),
  death: Object.freeze(["death"]),
  uiTap: Object.freeze(["ui-tap"]),
});

// EVENT_CLIP_GROUP — engine event type -> CLIP_GROUPS key. Every key here
// is verified (by read, at plan time) against src/browser/eventNarration.js's
// LINE_FOR vocabulary, the authoritative list of real engine event types.
//
// Every OTHER engine event type is deliberately unmapped: silence is the
// design here, not an omission — this phase maps the 18 AUD-01 actions and
// nothing else. In particular "waded" is deliberately ABSENT from this
// table: water walking is resolved by the synthesized step rule in
// groupsForDispatch() (Task 2) instead (actionType "move" + ctx.stepped +
// a "waded" event present -> the "water" group), not by an
// EVENT_CLIP_GROUP entry — mapping "waded" here too would fire two sounds
// for one step.
export const EVENT_CLIP_GROUP = Object.freeze({
  struck: "hit",
  strikeMissed: "miss",
  struckByFoe: "hurt",
  fellClimbing: "hurt",
  fellInGorge: "hurt",
  foeKilled: "foeDie",
  spellThrown: "spell",
  scrollCast: "spell",
  wardRaised: "spell",
  strengthCast: "spell",
  regenerationCast: "spell",
  deathCast: "spell",
  heroResisted: "resist",
  spellResisted: "resist",
  darknessResisted: "resist",
  healed: "heal",
  secondWindHealed: "heal",
  potionDrunk: "drink",
  chestOpened: "chest",
  goldGained: "gold",
  trapSprung: "trap",
  leaptOver: "jump",
  climbedOver: "jump",
  floorChanged: "stairs",
  leveled: "levelup",
  died: "death",
});

// FAMILY_CRY — BESTIARY family name -> enemy-* clip id. Total over all six
// BESTIARY families (Beasts, Demons, Humans, Lair Beasts, Magical, Walking
// Dead) against the four delivered enemy-* clips, with two deliberate
// shares: Lair Beasts SHARES enemy-human because its roster (Dog Face,
// Goblin, Hobgoblin, M&M, Pogo, Hair, Trachea) is humanoid lair-dwellers who
// carry swords and wilmst, not animals. Magical SHARES enemy-demon as the
// nearest fit — no delivered clip matches Drekk / Shadow / Werebeast /
// Drudge cleanly. A family resolving to nothing would be a DEFECT, not a
// default; totality is proven by test against content/bestiary.js's own
// BESTIARY keys, never by hand.
//
// BINDING USER RULING (2026-09-22): this six-family table IS the whole
// foe-cry layer. There is to be NO per-creature override in front of it —
// Bat/Rat sounds like the rest of Beasts. (The user also deleted the
// creature-specific enemy-batrat.mp3 outright on 2026-09-22, so sfx/ holds
// 30 clips and every one of them is mapped.) Do not add a per-creature
// layer back on top of this map.
export const FAMILY_CRY = Object.freeze({
  "Beasts": "enemy-beast",
  "Demons": "enemy-demon",
  "Humans": "enemy-human",
  "Lair Beasts": "enemy-human",
  "Magical": "enemy-demon",
  "Walking Dead": "enemy-undead",
});

// STEP_SUPPRESSING_EVENTS — when any of these event types is present in a
// dispatch's event list, the synthesized step clip (walk/water) is
// suppressed: a leap sounds like a leap, not a leap plus a footfall.
export const STEP_SUPPRESSING_EVENTS = new Set([
  "leaptOver",
  "climbedOver",
  "flownOver",
  "phasedThrough",
  "teleported",
]);

// DISPATCH_CLIP_CAP — the per-dispatch voice cap (CONTEXT: "Every mapped
// event in a dispatch fires its clip, in event order ... capped at 3 voices
// per dispatch"). Deliberately NOT the haptics "one strongest beat" model:
// a round where you strike, kill and level up should sound like three
// things happening.
export const DISPATCH_CLIP_CAP = 3;

/**
 * groupsForDispatch(actionType, events, ctx) — PURE. Resolves an ordered,
 * de-duplicated, capped list of group ids (or raw enemy-* clip ids for the
 * combat cry) for one dispatch. Never throws on malformed input.
 *
 * Order of operations:
 *  1. Guard: a non-array `events` is treated as empty.
 *  2. Synthesized step clip, emitted FIRST: when actionType is "move" AND
 *     ctx.stepped is true AND no event type in the list is in
 *     STEP_SUPPRESSING_EVENTS, push "water" if any event is "waded",
 *     otherwise push "walk". Exactly one step clip, never both.
 *  3. Walk `events` in array order: a "combatJoined" resolves the cry via
 *     FAMILY_CRY[ctx.combatType] (pushing nothing when combatType is
 *     absent/unknown — the one silent, engine-impossible branch); any other
 *     type is looked up in EVENT_CLIP_GROUP and pushed when found.
 *  4. De-duplicate by pushed identity, keeping the FIRST occurrence.
 *  5. Truncate to DISPATCH_CLIP_CAP entries.
 *  6. An empty/all-unmapped/garbage `events` argument returns [] and
 *     touches no state.
 */
export function groupsForDispatch(actionType, events, ctx) {
  const list = Array.isArray(events) ? events : [];
  const out = [];

  const hasSuppressor = list.some(
    (e) => e && typeof e === "object" && STEP_SUPPRESSING_EVENTS.has(e.type)
  );
  if (actionType === "move" && ctx?.stepped && !hasSuppressor) {
    const waded = list.some((e) => e && typeof e === "object" && e.type === "waded");
    out.push(waded ? "water" : "walk");
  }

  for (const e of list) {
    if (!e || typeof e !== "object" || !e.type) continue;
    if (e.type === "combatJoined") {
      const cry = FAMILY_CRY[ctx?.combatType];
      if (cry) out.push(cry);
      continue;
    }
    const group = EVENT_CLIP_GROUP[e.type];
    if (group) out.push(group);
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of out) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    deduped.push(entry);
  }

  return deduped.slice(0, DISPATCH_CLIP_CAP);
}

/**
 * createVariation() — factory for a counter-driven round-robin shuffle-bag.
 * Returns { next(groupId) }, closing over a plain Map of per-group
 * counters. This modulo round-robin IS the shuffle-bag: for a size-2 group
 * it strictly alternates, for a size-3 group it cycles 0,1,2 and never
 * repeats back-to-back. A counter, not a draw, is what keeps this phase
 * incapable of perturbing engine determinism.
 *
 * next(groupId):
 *  - unknown group id -> null, no throw, map untouched.
 *  - group of size 1 -> that one clip, no throw, map untouched (no
 *    no-repeat guarantee is attempted or needed).
 *  - otherwise -> reads the counter (default 0), returns
 *    group[counter % group.length], stores counter + 1.
 */
export function createVariation() {
  const counters = new Map();
  return {
    next(groupId) {
      const group = CLIP_GROUPS[groupId];
      if (!group) return null;
      if (group.length === 1) return group[0];
      const counter = counters.get(groupId) ?? 0;
      const clip = group[counter % group.length];
      counters.set(groupId, counter + 1);
      return clip;
    },
  };
}

// Module-level default variation instance, used by clipsForDispatch() when
// no variation is passed in, so shell callers never have to thread state
// themselves. Tests construct and pass their own instance so no global
// state leaks between test cases.
const defaultVariation = createVariation();

/**
 * clipsForDispatch(actionType, events, ctx, variation) — resolves a
 * dispatch straight through to an ordered array of concrete clip ids.
 * Group entries are resolved via variation.next(); raw clip ids (the
 * enemy-* cries) pass through unchanged. Any null result (unknown group)
 * is dropped. An empty group list returns [] having advanced no counter.
 */
export function clipsForDispatch(actionType, events, ctx, variation = defaultVariation) {
  const groups = groupsForDispatch(actionType, events, ctx);
  const clips = [];
  for (const entry of groups) {
    const resolved = CLIP_GROUPS[entry] ? variation.next(entry) : entry;
    if (resolved) clips.push(resolved);
  }
  return clips;
}
