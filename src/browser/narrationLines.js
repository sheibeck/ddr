// src/browser/narrationLines.js
//
// The per-event narration-LINE table and fold pipeline: `LINE_FOR` maps
// every narrated engine event type to a SHORT `(e, ctx) => ({ text, tone,
// priority })` builder — the summary a player glances at — and
// `linesForAction` folds a whole action's events into an ordered list of
// those summaries, in one of TWO orders:
//   - "priority" (the default): the one-card summary. Groups a foe's swings,
//     folds kills and same-type lines, and sorts by PRIORITY with time as
//     the tiebreak. The out-of-combat RAIL card reads this (rail.js).
//   - "event" (CMBUI-10, Phase 77): the combat record. Every line sits at its
//     earliest event and lines keep engine order; only contiguous chains
//     merge (a roll and its outcome, a throw and its outcome, a resistFailed
//     and its effect, an encounter start and its followers), and only
//     back-to-back identical lines fold " ×N". THE FIGHT SO FAR, the round
//     strip and the beats read this (fightLog.js, combatBeat.js). The user's
//     2026-09-21 device report: "A Ned falls, then 2 Neds miss, then I
//     riposted. Let's make sure the Oracle reads in order."
// Beside it sits `src/browser/eventNarration.js`'s `EVENT_NARRATION` (the
// Oracle log) — the full sentence with the roll, one line per event in
// engine order, for the record rather than the glance.
//
// PRESENTATION ONLY, pure module: no DOM access, no `import` from engine/,
// and no Math.random/Date.now anywhere in this file (mirrors missLines.js's
// purity contract; a standing guard, T-25-23, greps this file for exactly
// those patterns — including any `from "…engine/…"` import line, regardless
// of what it imports). Every builder defends every field with `??`/`?.` so
// a bare `{ type }` call (the coverage guard's own invocation shape, same
// convention as eventNarration.js) never throws (T-25-08).
//
// 260918-wy1 (jewelry-merge, deviation from the plan's literal instruction):
// the plan proposed importing `WORN_FAMILY_OF` from engine/derived.js here.
// That import trips T-25-23's standing purity guard (it forbids ANY
// `engine/` import line in this file, not just an impure one) — a real test
// in test/unit/narrationLinesCoverage.test.js, not a hypothetical. Rather
// than weaken that guard, `slotWord` below carries its OWN small local
// mirror of the same three-entry table; the worn-slots/worn-model unit
// suites pin both this table and engine/derived.js#WORN_FAMILY_OF against
// the same three literal keys, so a future change to one is caught by the
// other's test failing, not by a silent drift.
//
// ORACLE_ONLY is a one-directional allowlist: every engine event type NOT in
// that set gets a LINE_FOR builder here. Nothing in ORACLE_ONLY ever
// duplicates information a folded line already shows more completely — the
// folded line is a summary, the Oracle is the record (T-25-10).
// FEATURE_EVENTS is the separate manifest of every class/sub-class/race
// feature + refusal event (25-CONTEXT.md's "Feature manifest" decision) —
// a strict subset of LINE_FOR's keys, disjoint from ORACLE_ONLY.

// Phase 38 Plan 04 (ABIL-05): ABILITY_BY_ID maps a member ability's `via`
// key to its canon display name for allyStruck/allyMissed's optional clause
// — pure content data (not engine/), same discipline as
// eventNarration.js's own content/flavor.js import.
import { ABILITY_BY_ID } from "../../content/abilities.js";
// Phase 61 (STORE-02/STORE-03): upgradeWhy.js carries ZERO imports of its
// own (not even from content/) — importing it here does not trip T-25-23's
// standing purity guard (which forbids any `engine/` import line), and it
// lets the rail's purchaseBagged line reuse the SAME formatter
// eventNarration.js's Oracle line does, rather than restating it.
import { upgradeWhyText } from "./upgradeWhy.js";
// Phase 73 (ROLL-05): rollRange.js is the ONE place a winning range is
// formatted ("16–20") — like upgradeWhy.js, it carries zero imports of its
// own, so pulling it in here does not trip T-25-23's engine-import guard.
import { rangeText, rollVsText, modsText, modLabel, signedText, ROLLERS, bottomRangeText, toHitText, facesRangeText } from "./rollRange.js";
// RULES-07 (Phase 75): afflictionRolled's rail line reads the row's own
// `phobia` flag by roll, mirroring eventNarration.js — pure content data
// (not engine/), same discipline as the ABILITY_BY_ID import above.
import { AFFLICTIONS } from "../../content/afflictions.js";

/**
 * TONES — the tone-family vocabulary every narration line (and the
 * rail/fight-log CSS that maps data-tone) speaks. Two color families + two
 * utilities:
 *   - YOU:  `hit` (your good outcome) / `miss` (your action produced nothing)
 *   - THEM: `hurt` (they damaged/afflicted you or yours) / `dodge` (their
 *     turn produced no damage to you: misses, sleeps, heals, summons,
 *     telegraphs)
 *   - `magic` — spells/scrolls/song/items you use and their non-damage
 *     effects
 *   - `block` — refusals, rejections, limits ("couldn't" never looks like
 *     "missed")
 *   - `beat` — neutral information (encounter start, fades, teleports)
 */
export const TONES = Object.freeze(["hit", "miss", "hurt", "dodge", "magic", "block", "beat"]);

/**
 * PRIORITY — the fold's ordering (25-03's aggregator sorts ascending):
 * refusals/blocks first, then your outcome, then the enemy's outcome, then
 * feature call-outs, then everything else.
 */
export const PRIORITY = Object.freeze({ block: 0, you: 1, them: 2, feature: 3, other: 4 });

/**
 * CARD_EVENTS — Phase 25.1 (DFB-01 decision 1). The ONLY move-path events
 * that still earn the dismissible "Move on" card: a NEW FLOOR and a
 * LEVEL-UP. Every other decision/big-update card (the encounter Fight!
 * gate, a Joiner offer, a find to keep/leave, death, the end-of-fight
 * report) is handled by its own shell branch already, not by this set —
 * this set exists only to gate the generic html-to-beats fallback the
 * shell falls back to when none of those dedicated branches apply. The
 * shell checks this set BEFORE that generic fallback; a dispatch whose
 * events contain BOTH a card event and non-card lines shows the card AND
 * raises the folded lines (folded lines are raised inside
 * dispatchWithNarration before the card is ever built — the card never
 * swallows a line).
 */
export const CARD_EVENTS = new Set(["floorChanged", "leveled"]);

/**
 * NARRATIVE_ACTIONS — Phase 25.1 (DFB-01 decision 2). The action types
 * whose direct-mapped lines carry the Oracle's own sentence (dice
 * stripped) instead of the terse Phase 25 table text: move, camp,
 * resolveJoiner, dismissJoiner (Phase 36, JOIN-01), and resolveHazard
 * (Phase 78, CLIMB-01: a wall or crevice crossing now arrives as its own
 * resolveHazard dispatch instead of a move, so without it the crossing's
 * rail card fell back to the short table text). The shell passes a
 * `ctx.narrate` hook ONLY for these action types — every other action
 * (combat, store, inventory) keeps the short Phase 25 table text unchanged.
 */
export const NARRATIVE_ACTIONS = new Set(["move", "camp", "resolveJoiner", "dismissJoiner", "resolveHazard"]);

// The exact roll-span regex the shell's stripRollDetail() uses (mazeworld.html)
// so narrativeLineText strips dice detail identically to the over-map
// overlay's own stripping.
const ROLL_SPAN_RE = /<span class="roll">[\s\S]*?<\/span>\s*/g;

// Numeric-entity decode (&#39; / &#x27;) plus the fixed named-entity table
// narrativeLineText needs. &amp; is decoded LAST so a literal "&lt;" in the
// source text (i.e. the text "&lt;" itself, already escaped once) renders as
// the two characters "&lt;", never as a re-decoded "<" tag opener.
function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * narrativeLineText(html) — Phase 25.1 (DFB-01 decision 2). Turns one
 * Oracle HTML line into the plain-text sentence a line shows: (a) drop
 * every `<span class="roll">...</span>` block plus its trailing
 * whitespace (the SAME regex the shell's stripRollDetail uses); (b) strip
 * every remaining tag; (c) decode entities — tags are stripped BEFORE
 * entities are decoded so a decoded "&lt;b&gt;" stays literal text, never
 * becomes a real `<b>` tag; (d) collapse whitespace (including the
 * non-breaking space already turned into a plain space above) to single
 * spaces and trim. Returns "" when nothing prose-bearing is left (a
 * roll-only line, an empty/undefined input). The shell always inserts the
 * result via `textContent`, never `innerHTML` (T-25.1-01).
 */
export function narrativeLineText(html) {
  const raw = String(html ?? "");
  const noRoll = raw.replace(ROLL_SPAN_RE, "");
  const noTags = noRoll.replace(/<[^>]+>/g, "");
  const decoded = decodeEntities(noTags);
  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * oracleDetailText(html) — Phase 34 (CSCR-04). The fight log's tap-reveal
 * line: the Oracle's own sentence with its dice KEPT (the opposite of
 * narrativeLineText, which strips the roll span). Needed because a
 * `struck` line carries TWO roll spans (the to-hit roll and the damage
 * roll) — splitting out only the first span (as oracleLogViewModel does)
 * would leave a bare number with no context, so this keeps the whole
 * sentence intact and merely strips the surrounding tags. Returns "" when
 * `html` contains no `<span class="roll">` (nothing to reveal) or is
 * null/undefined/empty.
 */
export function oracleDetailText(html) {
  const raw = String(html ?? "");
  if (!raw.includes('<span class="roll">')) return "";
  const noTags = raw.replace(/<[^>]+>/g, "");
  const decoded = decodeEntities(noTags);
  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * bookRefillText(books) — Phase 78 (78-05). The refill clause shared by the
 * rail line (LINE_FOR.rationsEaten) and the Oracle line
 * (eventNarration.js#EVENT_NARRATION.rationsEaten), from the `books` array
 * eventNarration.js#stampBookRefill puts on a fed day's `rationsEaten`:
 * "Your book is full again (12/12)." for the hero (`who: "you"`), then
 * "Mira's book is full again (6/6)." for each member, in the stamp's order.
 * The count is dropped when the stamp carried none. Returns "" for a
 * missing, non-array or empty `books` (no refill is ever claimed without it).
 */
export function bookRefillText(books) {
  if (!Array.isArray(books) || !books.length) return "";
  return books
    .map((b) => {
      const count = Number.isFinite(b?.have) && Number.isFinite(b?.max) ? ` (${b.have}/${b.max})` : "";
      const whose = b?.who === "you" ? "Your" : `${b?.name || "Someone"}'s`;
      return `${whose} book is full again${count}.`;
    })
    .join(" ");
}

/**
 * ORACLE_ONLY — bookkeeping event types that already have a dedicated
 * screen, HUD field, prompt, or are pure step/roll detail whose outcome
 * sibling always follows. These get NO LINE_FOR entry; the Oracle never
 * loses information a line shows (a line is the glance, the Oracle is the
 * record — T-25-10). Any addition must carry a reason and obey the same
 * principle: never a feature, refusal, outcome, spell, or ability event.
 *
 * Phase 78 (78-05) audit, the user's 2026-09-25 report ("we're no longer
 * getting a rail update when a spell charge is regained"): every reason
 * below was re-read against today's HUD. `spellChargeRecovered` left the set
 * (its "the grimoire/HUD charge display already shows this" was stale: the
 * HUD carries no charge count, only the Hero/Gear tabs and the combat panel
 * do) and has a LINE_FOR rail line now. `dayBegan`/`floorChanged` keep true
 * reasons (band 2's Day and Depth counters, plus the rail's own DAY/FLOOR
 * card read directly through rail.js#RAIL_DIRECT); `findTaken`/`findLeft`
 * name the rail's direct TAKEN/LEFT IT card too.
 */
export const ORACLE_ONLY = new Set([
  "moved", // a plain step is already silent by design (engineAdapter.js) — not a LINE_FOR type either
  "dayBegan", // band 2's Day counter shows this; the rail's DAY card reads it directly (rail.js RAIL_DIRECT)
  "floorChanged", // band 2's Depth counter shows this; the rail's FLOOR card reads it directly (rail.js RAIL_DIRECT)
  "spGained", // pure XP bookkeeping; foeKilled/parleyRolled narrate the outcome that earned it
  "combatEnded", // the combat screen closing IS the signal
  "died", // dedicated death/epitaph screen
  "storeLeft", // the store screen closing IS the signal
  "encounterRolled", // internal table-roll bookkeeping; tableFour/tableFourNoop narrate the outcome
  "findOffered", // the dedicated Take it/Leave it prompt IS the UI
  "hazardChoice", // Phase 78 (CLIMB-01): the pre-roll wall/crevice decision card (every hero, tool or not) IS the UI, like findOffered
  "findTaken", // the Take it/Leave it prompt IS the UI; the rail's TAKEN card reads it directly (rail.js RAIL_DIRECT)
  "findLeft", // the Take it/Leave it prompt IS the UI; the rail's LEFT IT card reads it directly (rail.js RAIL_DIRECT)
  // Phase 63 (GSCR-09): itemDropped/itemUnequipped moved to LINE_FOR — the
  // Gear tab's action sheet closes on the tap, so the row change alone is
  // no longer the signal; the rail is the one feedback surface.
  "joinerMet", // the dedicated Joiner recruitment prompt IS the UI
  "faerieMet", // the dedicated faerie encounter prompt IS the UI; faerieBoon/faerieBane narrate the real outcome
  "grimoireSold", // the sell-flow's own confirmation is the UI signal
  "itemConsumed", // pure bookkeeping (a charge spent); the effect event itself already narrated
  "allyCast", // the allySpellHit/allySpellMissed sibling that always follows in the same action narrates the outcome and names the spell (one line per cast)
  "fightResumed", // SAV-06 (Phase 76): the combat screen coming back IS the signal; a relaunch is a minor event (card-vs-rail ruling), Oracle line only
  "storeResumed", // SAV-07 (Phase 76): the store screen coming back IS the signal; Oracle line only, no rail card
]);

/**
 * FEATURE_EVENTS — every class/sub-class/race feature event and every
 * refusal/rejection event (25-CONTEXT.md's "Feature manifest" decision).
 * 25-05 proves this is a subset of LINE_FOR's keys, disjoint from
 * ORACLE_ONLY, and covers every name test/unit/identity-contract.test.js
 * asserts.
 */
export const FEATURE_EVENTS = [
  "frenzy",
  "warlockBoost",
  "foeFled",
  "foeBored",
  "backstab",
  "stealthStrike",
  "ninjaFirstStrike",
  "conArtistOpener",
  "deathTouch",
  "goldGained",
  "trapDisarmed",
  "trapDoubled",
  // RULES-09 (Phase 75.1): a Pilfer's use-activated magic-item fumble.
  "pilferFumbled",
  "chestOpened",
  "chestLockRolled",
  "potionDuplicated",
  "rested",
  "potionDrunk",
  // Phase 89 (ITEM-07): a Joiner's own potion.
  "memberPotionDrunk",
  "armorPatched",
  "armorSoaked",
  "summonBackfired",
  "spellBackfired",
  "allySummoned",
  "allyPending",
  // DFB-05 (Phase 25.1): class-based ally combat — a member's weapon
  // strike/miss and a Magic User member's spell outcome.
  "allyStruck",
  "allyMissed",
  "allySpellHit",
  "allySpellMissed",
  // Phase 31 (CMB-01): renamed from phobiaFrozen/shookOffFrozen — "Phobia
  // should be penalties, never a no actions state" (user ruling 2026-09-16).
  "phobiaAfraid",
  "fearPassed",
  "encounterStarted",
  "combatJoined",
  "encounterCleared",
  "wanderingMonster",
  "joinerRefused",
  "joinerLeft",
  "joinerMurdered",
  "storeOpened",
  "sang",
  "beastsSoothed",
  "songIgnored",
  "lullabyRolled",
  "thunderRolled",
  "cooked",
  "healed",
  "struck",
  "strikeMissed",
  "struckByFoe",
  "foeMissed",
  "fled",
  "fleeRolled",
  "trapSprung",
  // Refusals
  "strikeRefused",
  "fleeRefused",
  "parleyRefused",
  "withdrawalDenied",
  "vanishDenied",
  "itemRejected",
  "equipRejected",
  "useRefused",
  "scrollRefused",
  "noChargesLeft",
  "spellNotKnown",
  "spellAboveLevel",
  "spellSchoolLocked",
  // Phase 31 (CMB-01/CMB-02): the notFought/generic-action refusal vocabulary.
  "castRefused",
  "actionRefused",
  "campFailed",
  "dismissRefused",
  "buyFailed",
  "backstabDenied",
  // Phase 38 (ABIL-01/04): the ABILITIES submenu's own refusal vocabulary.
  "abilityRefused",
  // Phase 39 (GEAR-05): a spent tool's refusal.
  "toolRefused",
  // Phase 61 (GRULE-01): the combat gear lock — equipItem/unequipSlot/
  // takeFind/takeLoot/takeAllLoot refuse while state.combat is set. Not in
  // ORACLE_ONLY — the rail is the one feedback surface.
  "gearRefused",
];

// ─── Shared helpers (mirrors eventNarration.js's soakedText/needMods pattern) ─

/** block(text) — every refusal/rejection is amber, priority 0, voiced. */
function block(text) {
  return { text, tone: "block", priority: PRIORITY.block };
}

// VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): the rail twins of the
// Oracle's honest gain lines (eventNarration.js#gainOf/cappedNote) — the HP
// actually gained leads; a capped gain says "back to full"; a gain of 0 says
// the hero was already at full, never "+0". A hand-built event with no
// `gained` falls back to its pre-clamp value.
const railGain = (e, offered) => (Number.isFinite(e?.gained) ? e.gained : Number.isFinite(offered) ? offered : 0);
const railFull = (gained, offered) => (Number.isFinite(offered) && gained > 0 && gained < offered ? ", back to full" : "");

// VOX-05 (Phase 79, plan 79-04): the rail twins of eventNarration.js's own
// fight-line helpers — "1 round", never "1 rounds"; a named foe's
// possessive, or the caller's fallback ("its", never "it's") for a bare event.
const railPlural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const railPossessive = (name, fallback) => (name ? `${name}'s` : fallback);
// Quick 260928-nrf: the strike abilities that used to auto-hit and now roll
// (Kata, Feint) — a miss names the ability and says it is spent anyway.
const MISS_SPENT_VIA = new Set(["kata", "feint"]);
/** railWardName(item) — eventNarration.js's wardName twin for critWarded
 * (quick 260928-cos): the warding item's name, an object's `n`, or "cloak". */
const railWardName = (item) => (typeof item === "string" && item ? item : typeof item?.n === "string" && item.n ? item.n : "cloak");
// VOX-05 (Phase 79, plan 79-11): the rail twin of eventNarration.js's
// squaresText — "1 square", and no leaked "undefined squares".
const railSquares = (n) => (Number.isFinite(n) ? railPlural(n, "square") : "a few squares");
/** railHealDice(h) — eventNarration.js's healDiceText twin (Phase 88): "a d6", "2d6", "+1". */
const railHealDice = (h) => {
  const n = Number.isFinite(h?.n) && h.n > 0 ? h.n : 1;
  const bonus = Number.isFinite(h?.bonus) && h.bonus > 0 ? `+${h.bonus}` : "";
  return `${n === 1 ? "a d" : `${n}d`}${h.sides}${bonus}`;
};

// Phase 88 (ITEM-02): the rail twin of eventNarration.js's ENDED_CLAUSE —
// what stops when an item effect ends early, in the rail's short form, one per
// linked activation kind. A PARTY_WIDE row (`e.party`, the Crystal Staff)
// says the party is seen again. An unknown kind falls back to "its magic stops".
/** railEndedItem(e) — eventNarration.js's endedItem twin: the string, an item object's `n`, or "It". */
const railEndedItem = (e) => (typeof e?.item === "string" && e.item ? e.item : typeof e?.item?.n === "string" && e.item.n ? e.item.n : "Item");
// Phase 89 plan 09 (TEXT-01): the rail twins of eventNarration.js's ITEM_INVIS_RANGE and
// ITEM_UNSEEN_SHIFT, in the rail's short form.
const RAIL_INVIS_RANGE = `${facesRangeText(1, 20)} on a d20; ${facesRangeText(2, 20)} if insulted`;
const RAIL_UNSEEN_SHIFT = signedText(-2);
const RAIL_ENDED_CLAUSE = Object.freeze({
  fly: "flying stops",
  ether: "solid again",
  critWard: "crits can land again",
  invis: "visible again",
  unseen: "seen again",
  haste: "the second swing goes",
  plate: "the plate goes",
  power: "the extra damage goes",
  giant: "back to normal size",
  glow: "the light goes out",
  tongue: "the fluency goes",
  // Phase 88 (ITEM-03): a heal-over-time window; the builder adds the unspent ticks.
  knit: "the knitting stops",
  // Phase 89 (ITEM-06): the Pendant of Fortitude's armed half-damage charge.
  half: "the next blow is no longer halved",
});

/** railTableFourTail(e) — todo 2026-09-26: the signed amount a Table 4 row actually made (rollRange.js#signedText). */
function railTableFourTail(e) {
  if (!Number.isFinite(e?.amount)) return "";
  if (e.stat === "hp") {
    if (e.amount === 0) return " You were already at full hp.";
    return ` ${signedText(e.amount)} hp${e.amount > 0 ? railFull(e.amount, e.rolled) : ""}.`;
  }
  if (e.stat === "maxHp") return ` ${signedText(e.amount)} max hp.`;
  if (e.stat === "xp") return ` ${signedText(e.amount)} experience.`;
  return "";
}

/**
 * GEAR_LOCK_LOOT_VERBS — Phase 61 (GRULE-01): the three `gearRefused` verbs
 * whose line is "the spoils can wait" rather than "not the moment to change
 * outfits" — a parked-loot/find pickup reads differently from an equip/
 * unequip attempt, even though both are the same combat gate.
 */
const GEAR_LOCK_LOOT_VERBS = new Set(["takeLoot", "takeAllLoot", "takeFind"]);

/** soakParts(soaked) — ["Hardiness 3", "hide 2", "ward 1"], only present keys. */
function soakParts(soaked) {
  if (!soaked) return [];
  const parts = [];
  if (soaked.hardiness) parts.push(`Hardiness ${soaked.hardiness}`);
  if (soaked.hide) parts.push(`hide ${soaked.hide}`);
  if (soaked.ward) parts.push(`ward ${soaked.ward}`);
  return parts;
}

/** soakSuffix(soaked) — " · hide 2, ward 1 soaked" or "". */
function soakSuffix(soaked) {
  const parts = soakParts(soaked);
  return parts.length ? ` · ${parts.join(", ")} soaked` : "";
}

// Phase 74 (ROLL-02/03): the module-private fleeModsText this file used to
// define is gone — fleeRolled below now calls rollRange.js's modsText
// directly (ROLLERS.you; the hero's own roll, never flipped) so the flee
// line speaks the exact same player-signed modifier vocabulary as every
// other surface, rather than restating the format locally.

const CRIT_BY_TEXT = {
  stealth: "stealth",
  backstab: "backstab",
  ninja: "ninja",
  cutthroat: "Cutthroat",
  deathTouch: "Death Touch",
  silentStep: "Silent Step",
};

// VOX-05 (Phase 79, plan 79-11): wrongClass and tooHeavy say why in the
// player's terms (tooHeavy is the class armour rule, engine/items.js#
// armorRefusalReason, not weight: "Too heavy to carry." was wrong), and a
// Woodsman's rule names plate too (anything heavier than Studded).
const EQUIP_REJECT_TEXT = {
  wrongClass: "Your class cannot use that.",
  notBetter: "Not an upgrade.",
  noArmor: "Fridgians wear no armour.",
  woodsman: "No mail or plate for a Woodsman.",
  tooHeavy: "Your class does not wear that armour.",
  acrobat: "An Acrobat carries a dagger. Only a dagger.",
  notEquippable: "That does not equip.",
  // 260918-wy1 (jewelry-merge): the two new equipItem refusals — an
  // untargeted equip with both jewelry keys full, and a targeted swap key
  // outside the item's own family.
  jewelryFull: "Two pieces of jewelry is the limit. Swap one out, or admit you have a problem.",
  wrongSlot: "That does not go there.",
};
function equipRejectText(e) {
  // Phase 39 (GEAR-05): a tool never duplicates — the item's own name is
  // dynamic, so this one reason is special-cased ahead of the static map.
  if (e?.reason === "haveOne") return `You already carry one ${e?.item?.n ?? "of those"}. One is the limit; two is a hobby.`;
  return EQUIP_REJECT_TEXT[e?.reason] ?? "Not for the likes of you.";
}

// SLOT_FAMILY_WORD — 260918-wy1 (jewelry-merge): a small LOCAL mirror of
// engine/derived.js#WORN_FAMILY_OF's three entries. Deliberately NOT
// imported from engine/ (see the file-header deviation note above) —
// duplicated here on purpose, kept honest by test/unit/worn-model.test.js
// and test/unit/narrationLinesTable.test.js each pinning their own copy
// against the same three literal keys.
const SLOT_FAMILY_WORD = Object.freeze({ jewelry1: "jewelry", jewelry2: "jewelry", cloak: "cloak" });

// SLOT_HOUSE_SPELLING — Phase 79 (VOX-05, plan 79-12): the engine's `armor`
// slot KEY reads in the house spelling, "armour", wherever slotWord puts it
// in prose (docs/narrative-pass/README.md, "House spelling"). Kept apart
// from SLOT_FAMILY_WORD, which mirrors engine/derived.js#WORN_FAMILY_OF.
const SLOT_HOUSE_SPELLING = Object.freeze({ armor: "armour" });

/**
 * slotWord(slot) — 260918-wy1 (jewelry-merge): the player-facing FAMILY word
 * for a worn KEY — `jewelry1`/`jewelry2` both read "jewelry", `cloak` reads
 * "cloak"; `armor` reads "armour" (the house spelling, Phase 79); any
 * other slot word (`weapon`, or an unrecognized string) passes through
 * unchanged. Exported so eventNarration.js's Oracle lines can share the
 * exact same word (never a raw key like "jewelry2" in prose).
 */
export function slotWord(slot) {
  return SLOT_FAMILY_WORD[slot] ?? SLOT_HOUSE_SPELLING[slot] ?? slot;
}

// ─── linesForAction pipeline (25-03) ─────────────────────────────────────
//
// `linesForAction(type, events, ctx = {})` is the per-action pipeline the
// shell (25-04) calls once per dispatched action, after the events have
// already been decorated by decorateMisses (engineAdapter.js). Order:
//   1. encounterStart  — folds encounterStarted + its same-action followers
//      (trackable, allyJoined, warlockBoost, foeFled knight/conArtist,
//      foeBored, phobiaAfraid, combatInDark) into ONE line.
//   2. enemyRound       — groups struckByFoe/foeMissed(hero) by foe name
//      into one line per foe (3+ distinct names collapse into one), and
//      memberStruck/foeMissed(member) by (name, member) into their own
//      lower-priority lines.
//   3. yourRound        — groups struck/strikeMissed(non-untouchable) by
//      target into one line per target; untouchable misses stay separate.
//   4. spellChain       — folds spellThrown->spellHit/spellMissed/
//      foeKilled per target (3+ targets collapse into one
//      Lightning-style line), and folds a bare resistFailed away when a
//      resisted-but-failed effect event follows in the same action.
//   5. fleeChain / parleyChain / chestChain — fold a *Rolled event into its
//      outcome, appending the roll detail to the outcome's own text.
//   6. killFold         — appends the felled suffix (middle-dot + "felled")
//      to any your-round/spell-chain line whose target a still-unconsumed
//      foeKilled names.
//   7. every remaining unconsumed, non-ORACLE_ONLY event is mapped through
//      LINE_FOR directly.
//   8. dedupe per event type (table-mapped lines only; aggregated lines
//      are never deduped against each other), stable-sort ascending by
//      priority (ties keep engine order); the default `limit` is Infinity
//      (uncapped — the toast host that once capped this list was retired
//      in Phase 35; the rail and the fight log show every line), so every
//      folded line survives unless a caller passes an explicit `opts.limit`.
//
// `opts.order: "event"` (CMBUI-10) runs a different middle: step 1 folds only
// the followers directly after the start; steps 2, 3 and 6 are skipped (every
// swing, hit, miss and kill is its own line); step 4 is spellChainEvent
// (contiguous throw/outcome and resist/effect merges, no 3+ target
// collapse); step 5's chains merge only when the outcome is the very next
// line event (chainScan); step 8 sorts by idx alone and folds only adjacent
// identical lines (foldAdjacent). The contiguity rule for any future chain:
// merge an event only with the next event that would otherwise produce a
// line, and give the merged line its earliest event's idx.
//
// `ctx.narrate` (Phase 25.1, DFB-01 decision 2) — `(e) => html string | ""`,
// supplied by the shell ONLY for NARRATIVE_ACTIONS (move/camp/the two joiner
// answers/resolveHazard).
// In step 7 (the direct-mapped-event loop below), when `ctx.narrate` is a
// function AND the event's type is not in CARD_EVENTS, the line text
// becomes `narrativeLineText(ctx.narrate(e))` — the Oracle's own sentence,
// dice stripped — with the table text as the fallback when the narration
// strips to nothing (never a blank line). Every other action type keeps
// the short Phase 25 table text. CARD_EVENTS types are excluded here
// because the "Move on" card already carries their sentence — this is the
// ONE decision point where the narrative-vs-table choice is made.

const CRIT_SUFFIX = " · CRIT";

/** joinerOf(e) — Phase 90 plan 05: the Joiner a spell line names (`by`), or null for the hero's own (an absent `by`, or the resist events' "you"). */
const joinerOf = (e) => (e?.by && e.by !== "you" ? e.by : null);

/**
 * lineEvent(e) — CMBUI-10: true when `e` would produce a line of its own
 * (a LINE_FOR builder, not ORACLE_ONLY). The event order's contiguity rule
 * reads "next" as the next event that would otherwise produce a line, so a
 * silent bookkeeping event (spGained, itemConsumed, moved …) between a roll
 * and its outcome never splits them.
 */
function lineEvent(e) {
  return !!e && typeof e.type === "string" && !ORACLE_ONLY.has(e.type) && typeof LINE_FOR[e.type] === "function";
}

/** nextLineIdx(events, i) — CMBUI-10: the index of the first lineEvent after `i`, or -1. */
function nextLineIdx(events, i) {
  for (let j = i + 1; j < events.length; j++) if (lineEvent(events[j])) return j;
  return -1;
}

/**
 * chainScan(events, i, eventOrder) — the candidate outcome indices a roll at
 * `i` may merge with. The priority fold scans every later event (a roll
 * reaches across the action for its outcome); the event order (CMBUI-10)
 * offers only the very next line event, so a merge never pulls an outcome
 * across something that happened in between.
 */
function chainScan(events, i, eventOrder) {
  if (eventOrder) {
    const j = nextLineIdx(events, i);
    return j === -1 ? [] : [j];
  }
  const all = [];
  for (let j = i + 1; j < events.length; j++) all.push(j);
  return all;
}

/** sumSoaked(list) — per-key integer sums across a group's hit events' `soaked`. */
function sumSoaked(list) {
  const result = {};
  for (const s of list) {
    if (!s) continue;
    if (s.hardiness) result.hardiness = (result.hardiness || 0) + s.hardiness;
    if (s.hide) result.hide = (result.hide || 0) + s.hide;
    if (s.ward) result.ward = (result.ward || 0) + s.ward;
  }
  return result;
}

/**
 * enemyRound(events, consumed) — struckByFoe/foeMissed(hero, no `member`)
 * grouped by foe name into one line per foe (M===1 reuses the locked
 * single-swing LINE_FOR builder verbatim; M>=2 uses the "K of M" wording);
 * 3+ distinct foe names collapse into ONE "${F} foes swing, ..." line.
 * memberStruck/foeMissed(member) group by (name, member) separately, at
 * PRIORITY.feature (25-CONTEXT.md: "party-member hits ... lower priority").
 */
function enemyRound(events, consumed) {
  const built = [];
  const heroGroups = new Map();
  const memberGroups = new Map();

  const addTo = (map, key, entry) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };

  events.forEach((e, i) => {
    if (consumed.has(i)) return;
    if (e.type === "struckByFoe") {
      addTo(heroGroups, e.name, { idx: i, e, hit: true });
    } else if (e.type === "foeMissed" && !e.member) {
      addTo(heroGroups, e.name, { idx: i, e, hit: false });
    } else if (e.type === "memberStruck") {
      addTo(memberGroups, `${e.name}::${e.member}`, { idx: i, e, hit: true, name: e.name, member: e.member });
    } else if (e.type === "foeMissed" && e.member) {
      addTo(memberGroups, `${e.name}::${e.member}`, { idx: i, e, hit: false, name: e.name, member: e.member });
    }
  });

  const heroNames = [...heroGroups.keys()];
  if (heroNames.length >= 3) {
    let K = 0;
    let sum = 0;
    let crit = false;
    let firstIdx = Infinity;
    const hitSoaks = [];
    heroNames.forEach((name) => {
      heroGroups.get(name).forEach(({ idx, e, hit }) => {
        consumed.add(idx);
        if (idx < firstIdx) firstIdx = idx;
        if (hit) {
          K++;
          sum += e.dmg ?? 0;
          if (e.critical || e.soldierCrit) crit = true;
          if (e.soaked) hitSoaks.push(e.soaked);
        }
      });
    });
    const F = heroNames.length;
    let text = `${F} foes swing, ${K > 0 ? `${K} land (${sum})` : "none land"}`;
    if (crit) text += CRIT_SUFFIX;
    text += soakSuffix(sumSoaked(hitSoaks));
    built.push({ text, tone: K > 0 ? "hurt" : "dodge", priority: PRIORITY.them, idx: firstIdx });
  } else {
    for (const name of heroNames) {
      const entries = heroGroups.get(name);
      const M = entries.length;
      const K = entries.filter((x) => x.hit).length;
      const firstIdx = entries[0].idx;
      entries.forEach(({ idx }) => consumed.add(idx));
      if (M === 1) {
        built.push({ ...LINE_FOR[entries[0].e.type](entries[0].e), idx: firstIdx });
        continue;
      }
      const hits = entries.filter((x) => x.hit);
      const sum = hits.reduce((s, x) => s + (x.e.dmg ?? 0), 0);
      const crit = hits.some((x) => x.e.critical || x.e.soldierCrit);
      let text = K > 0 ? `${name} hits you ${K} of ${M} (${sum})` : `${name} misses you ${M} times`;
      if (crit) text += CRIT_SUFFIX;
      text += soakSuffix(sumSoaked(hits.map((x) => x.e.soaked)));
      built.push({ text, tone: K > 0 ? "hurt" : "dodge", priority: PRIORITY.them, idx: firstIdx });
    }
  }

  for (const key of memberGroups.keys()) {
    const entries = memberGroups.get(key);
    const M = entries.length;
    const K = entries.filter((x) => x.hit).length;
    const firstIdx = entries[0].idx;
    const { name, member } = entries[0];
    entries.forEach(({ idx }) => consumed.add(idx));
    if (M === 1) {
      built.push({ ...LINE_FOR[entries[0].e.type](entries[0].e), idx: firstIdx });
      continue;
    }
    const hits = entries.filter((x) => x.hit);
    const sum = hits.reduce((s, x) => s + (x.e.dmg ?? 0), 0);
    const crit = hits.some((x) => x.e.critical);
    let text = K > 0 ? `${name} hits ${member} ${K} of ${M} (${sum})` : `${name} misses ${member} ${M} times`;
    if (crit) text += CRIT_SUFFIX;
    built.push({ text, tone: K > 0 ? "hurt" : "dodge", priority: PRIORITY.feature, idx: firstIdx });
  }

  return built;
}

/**
 * yourRound(events, consumed) — struck/strikeMissed(non-untouchable) grouped
 * by target (M===1 reuses the locked single-swing builder; M>=2 uses the
 * "K of M" wording, carrying the first quipped miss's quip when K===0).
 * Untouchable misses are never grouped — LINE_FOR.strikeMissed's own
 * untouchable branch handles them individually via the generic mapping step.
 */
function yourRound(events, consumed) {
  const built = [];
  const groups = new Map();
  events.forEach((e, i) => {
    if (consumed.has(i)) return;
    if (e.type === "struck") {
      if (!groups.has(e.target)) groups.set(e.target, []);
      groups.get(e.target).push({ idx: i, e, hit: true });
    } else if (e.type === "strikeMissed" && !e.untouchable) {
      if (!groups.has(e.target)) groups.set(e.target, []);
      groups.get(e.target).push({ idx: i, e, hit: false });
    }
  });

  for (const target of groups.keys()) {
    const entries = groups.get(target);
    const M = entries.length;
    const K = entries.filter((x) => x.hit).length;
    const firstIdx = entries[0].idx;
    entries.forEach(({ idx }) => consumed.add(idx));
    if (M === 1) {
      const { e } = entries[0];
      built.push({ ...LINE_FOR[e.type](e), idx: firstIdx, ...(e.type === "struck" ? { _target: target } : {}) });
      continue;
    }
    const hits = entries.filter((x) => x.hit);
    const sum = hits.reduce((s, x) => s + (x.e.dmg ?? 0), 0);
    const anyCrit = hits.some((x) => x.e.critical);
    if (K > 0) {
      let text = `You hit ${target} ${K} of ${M} (${sum})`;
      if (anyCrit) {
        text += CRIT_SUFFIX;
        const firstCrit = hits.find((x) => x.e.critical && CRIT_BY_TEXT[x.e.critBy]);
        if (firstCrit) text += ` (${CRIT_BY_TEXT[firstCrit.e.critBy]})`;
      }
      built.push({ text, tone: "hit", priority: PRIORITY.you, idx: firstIdx, _target: target });
    } else {
      let text = `You miss ${target} ${M} times`;
      const firstQuip = entries.find((x) => x.e.quip);
      if (firstQuip) text += ` — ${firstQuip.e.quip}`;
      built.push({ text, tone: "miss", priority: PRIORITY.you, idx: firstIdx });
    }
  }
  return built;
}

/**
 * killFold(events, consumed, built) — shared by yourRound/spellChain: any
 * still-unconsumed `foeKilled` whose `name` matches a built line's
 * `_target` (a landed hit on that name) gets folded into that line's felled
 * suffix, once. A foeKilled with no matching `_target` (a ward reflect,
 * an ally's kill, an acid tick) is left unconsumed for its own builder.
 */
function killFold(events, consumed, built) {
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "foeKilled") return;
    const target = built.find((t) => t._target === e.name);
    if (target) {
      target.text += " · felled";
      delete target._target;
      consumed.add(i);
    }
  });
}

/**
 * RESIST_FOLD_EFFECTS — the effect event types a `resistFailed` folds away
 * behind: when one of these follows a `resistFailed` for the same target
 * (or carries no `target` field at all — the AOE effects), the bare
 * `resistFailed` line is suppressed and only the effect's own line shows.
 */
const RESIST_FOLD_EFFECTS = new Set([
  "dozed",
  // Phase 90 plan 08 (SPELL-10): Senseless and Duplicate Foe's own lines fold the failed resist.
  "foeMisdirected",
  "weakened",
  "stupefied",
  "blinded",
  "shrunk",
  "acidApplied",
  "petrified",
  "walkingDeadTurned",
  "planeGated",
  "insaneRolled",
  "insaneFled",
  // Quick 260927-rsx (user ruling 2026-09-27): every spell cast on a foe now
  // rolls a resist, thrown damage and a Joiner's cast and a staff's power
  // included. A failed resist folds behind the throw, the Joiner's outcome,
  // the Death spell's cast, the room-wide damage (Earthquake, Fireballs) and
  // a staff's stone or fireballs, so the rail and the fight log never
  // double a cast; the Oracle keeps every roll, either way.
  "spellThrown",
  "allySpellHit",
  "allySpellMissed",
  "deathCast",
  "earthquake",
  "volley",
  "foeStoned",
  "itemBurned",
]);

/**
 * foldsResist(oe) — RESIST_FOLD_EFFECTS, plus (user rulings 2026-09-28) a
 * Freeze's own d4 hold: a `controlHeld` carrying `freeze: true`. A Freeze
 * rolls its resist after the damage lands, so a failed resist folds behind
 * the freeze it let through. Other holds keep their own resist line.
 */
function foldsResist(oe) {
  // Phase 90 plan 05: Stun's own hold (kind "stunned") folds the failed resist behind it, like a Freeze's.
  return RESIST_FOLD_EFFECTS.has(oe.type) || (oe.type === "controlHeld" && (!!oe.freeze || oe.kind === "stunned" || oe.kind === "time"));
}

/** isFreezeHold(e, target) — a Freeze's d4 hold on `target` (user rulings 2026-09-28). */
function isFreezeHold(e, target) {
  return e.type === "controlHeld" && !!e.freeze && e.target === target;
}

/** freezeHitLine(spell, target, hitE, heldE) — the hero's Freeze hit and its hold on one line. */
function freezeHitLine(spell, target, hitE, heldE) {
  const rounds = Number.isFinite(heldE.rounds) ? railPlural(heldE.rounds, "round") : "? rounds";
  return `${spell} hits ${target} (${hitE.dmg ?? 0}), frozen for ${rounds}`;
}

/**
 * spellChain(events, consumed) — folds `spellThrown` -> its per-target
 * outcome (`spellHit`(+ a Freeze's `controlHeld`)(+`foeKilled`) | `spellMissed`) into
 * ONE line per target; 3+ distinct targets (Lightning) collapse into one
 * "${spell}: ${T} targets, ${K} hit (${sum})" line instead. Also consumes
 * a bare `resistFailed` when a RESIST_FOLD_EFFECTS event follows it in this
 * action (for the same target, or an untargeted AOE effect) — the effect's
 * own line is the only one that shows.
 */
function spellChain(events, consumed) {
  const built = [];

  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "resistFailed") return;
    const matched = events.some((oe, j) => {
      if (j <= i || consumed.has(j) || !foldsResist(oe)) return false;
      return oe.target === undefined || oe.target === e.target;
    });
    if (matched) consumed.add(i);
  });

  const throwIdxs = [];
  events.forEach((e, i) => {
    if (!consumed.has(i) && e.type === "spellThrown") throwIdxs.push(i);
  });
  if (!throwIdxs.length) return built;

  const distinctTargets = new Set(throwIdxs.map((i) => events[i].target));
  if (distinctTargets.size >= 3) {
    const spell = events[throwIdxs[0]].spell;
    const firstIdx = throwIdxs[0];
    let hits = 0;
    let sum = 0;
    throwIdxs.forEach((ti) => {
      consumed.add(ti);
      const target = events[ti].target;
      for (let j = ti + 1; j < events.length; j++) {
        if (consumed.has(j)) continue;
        const e = events[j];
        if (e.type === "spellThrown") break;
        if (e.target !== target) continue;
        if (e.type === "spellHit") {
          hits++;
          sum += e.dmg ?? 0;
          consumed.add(j);
          break;
        }
        if (e.type === "spellMissed") {
          consumed.add(j);
          break;
        }
      }
    });
    const text = `${spell}: ${distinctTargets.size} targets, ${hits} hit (${sum})`;
    built.push({ text, tone: hits > 0 ? "magic" : "miss", priority: PRIORITY.you, idx: firstIdx });
    return built;
  }

  for (const ti of throwIdxs) {
    const e0 = events[ti];
    const target = e0.target;
    consumed.add(ti);
    let hitIdx = -1;
    let missedIdx = -1;
    let frozenIdx = -1;
    for (let j = ti + 1; j < events.length; j++) {
      if (consumed.has(j)) continue;
      const e = events[j];
      if (e.type === "spellThrown") break;
      if (e.type === "spellHit" && e.target === target && hitIdx === -1) hitIdx = j;
      else if (e.type === "spellMissed" && e.target === target && missedIdx === -1) missedIdx = j;
      else if (isFreezeHold(e, target) && frozenIdx === -1) frozenIdx = j;
    }
    if (missedIdx !== -1) {
      consumed.add(missedIdx);
      // spellMissed carries no `spell` field of its own (engine/magic.js) —
      // borrow it from the spellThrown that started this chain.
      built.push({ ...LINE_FOR.spellMissed({ ...events[missedIdx], spell: e0.spell }), idx: ti });
      continue;
    }
    if (hitIdx === -1) continue;
    consumed.add(hitIdx);
    const hitE = events[hitIdx];
    // User rulings 2026-09-28: a Freeze that lands and holds reads its
    // damage and its d4 hold on one line (it never kills outright; a Freeze
    // kill is a normal kill, felled below).
    if (frozenIdx !== -1) {
      consumed.add(frozenIdx);
      built.push({ text: freezeHitLine(e0.spell, target, hitE, events[frozenIdx]), tone: "magic", priority: PRIORITY.you, idx: ti });
      continue;
    }
    // spellHit likewise carries no `spell` field (engine/magic.js) — borrow
    // it from the spellThrown that started this chain.
    built.push({ ...LINE_FOR.spellHit({ ...hitE, spell: e0.spell }), idx: ti, _target: target });
  }
  return built;
}

/**
 * spellChainEvent(events, consumed, idxAt, patched) — CMBUI-10: spellChain's
 * event-order sibling. Merges only CONTIGUOUS events (each "next" is the next
 * line event, see nextLineIdx):
 *   - a `resistFailed` whose next line event is its RESIST_FOLD_EFFECTS effect
 *     (same target, or an untargeted AOE effect) is dropped, and the effect's
 *     own line moves to the resistFailed's position (`idxAt`, effect idx ->
 *     earliest idx), so the line still sits at its earliest event;
 *   - a `spellThrown` whose next line event is that target's `spellMissed` or
 *     `spellHit` is one line (the outcome's text, the throw's position); a
 *     Freeze's d4 hold (`controlHeld` with `freeze`, user rulings
 *     2026-09-28) joins only when it is the next line event after the hit
 *     (past a failed resist already folded behind it);
 *   - a throw with no contiguous outcome keeps its own LINE_FOR line, and the
 *     later spellHit/spellMissed for that target still names the spell
 *     (`patched`, idx -> the outcome event with the throw's `spell`).
 * No 3+ target collapse: a Lightning reads one line per target, in order.
 */
function spellChainEvent(events, consumed, idxAt, patched) {
  const built = [];

  // Quick 260927-rsx: a room-wide cast rolls one resist per foe, so a RUN of
  // contiguous resistFailed lines for the same spell folds whole into an
  // untargeted effect that follows it (Stun's "stunned", Weaken's
  // "weakened"); a targeted effect folds only the resist right before it,
  // for its own target, exactly as before.
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "resistFailed") return;
    const run = [i];
    let j = nextLineIdx(events, i);
    while (j !== -1 && !consumed.has(j) && events[j].type === "resistFailed" && events[j].spell === e.spell) {
      run.push(j);
      j = nextLineIdx(events, j);
    }
    if (j === -1 || consumed.has(j)) return;
    const oe = events[j];
    if (!foldsResist(oe)) return;
    if (oe.target === undefined) {
      run.forEach((k) => consumed.add(k));
      idxAt.set(j, i);
      return;
    }
    const last = run[run.length - 1];
    if (oe.target === events[last].target) {
      consumed.add(last);
      idxAt.set(j, last);
    }
  });

  events.forEach((e0, ti) => {
    if (consumed.has(ti) || e0.type !== "spellThrown") return;
    const target = e0.target;
    const j = nextLineIdx(events, ti);
    const oe = j === -1 || consumed.has(j) ? null : events[j];
    if (oe && oe.type === "spellMissed" && oe.target === target) {
      consumed.add(ti);
      consumed.add(j);
      built.push({ ...LINE_FOR.spellMissed({ ...oe, spell: e0.spell }), idx: idxAt.get(ti) ?? ti });
      return;
    }
    if (oe && oe.type === "spellHit" && oe.target === target) {
      consumed.add(ti);
      consumed.add(j);
      // User rulings 2026-09-28: a Freeze's d4 hold joins its hit when it is
      // the next line event still standing (the failed resist between them
      // was already folded behind the hold above).
      let k = nextLineIdx(events, j);
      while (k !== -1 && consumed.has(k) && events[k].type === "resistFailed") k = nextLineIdx(events, k);
      if (k !== -1 && !consumed.has(k) && isFreezeHold(events[k], target)) {
        consumed.add(k);
        built.push({ text: freezeHitLine(e0.spell, target, oe, events[k]), tone: "magic", priority: PRIORITY.you, idx: idxAt.get(ti) ?? ti });
        return;
      }
      built.push({ ...LINE_FOR.spellHit({ ...oe, spell: e0.spell }), idx: idxAt.get(ti) ?? ti });
      return;
    }
    for (let x = ti + 1; x < events.length; x++) {
      const later = events[x];
      if (later.type === "spellThrown") break;
      if ((later.type === "spellHit" || later.type === "spellMissed") && later.target === target && !consumed.has(x)) {
        if (!patched.has(x)) patched.set(x, { ...later, spell: later.spell ?? e0.spell });
        break;
      }
    }
  });
  return built;
}

/**
 * fleeChain(events, consumed, eventOrder = false) — `fleeRolled` + (`fled` | `fleeFailed`) fold
 * into ONE line, ROLL FIRST (Phase 42, FLEE-02, ROADMAP SC-1): the roll and
 * every named modifier lead, the outcome's own text follows —
 * `${LINE_FOR.fleeRolled(e).text}. ${outcome text}` — so the fight log
 * shows roll/modifiers/need before the outcome in one line (the 34-CONTEXT
 * "log line count = folded count" pin still holds: still ONE line per
 * attempt). Reuses LINE_FOR.fleeRolled itself rather than restating the
 * format. A `fled` with no preceding `fleeRolled` (Cloaker/tracked) keeps
 * its own builder untouched. In the event order (CMBUI-10, and likewise in
 * parleyChain/chestChain) the outcome merges only when it is the very next
 * line event (chainScan): a pursuit strike between the roll and `fled`
 * leaves three lines, in the order they happened.
 */
function fleeChain(events, consumed, eventOrder = false) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "fleeRolled") return;
    for (const j of chainScan(events, i, eventOrder)) {
      if (consumed.has(j)) continue;
      const oe = events[j];
      if (oe.type === "fled" || oe.type === "fleeFailed") {
        consumed.add(i);
        consumed.add(j);
        const b = LINE_FOR[oe.type](oe);
        const rollText = LINE_FOR.fleeRolled(e).text;
        built.push({ text: `${rollText}. ${b.text}`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "fleeRolled") break;
    }
  });
  return built;
}

/**
 * parleyChain(events, consumed, eventOrder = false) — `parleyRolled` + (`goldGained` why
 * "parley" | `parleyFailed` | `beastsSoothed`) fold into ONE line: the
 * outcome's own text plus `(${roll} vs ${range})` (Phase 73, ROLL-05: via
 * rollVsText, roll-high).
 */
function parleyChain(events, consumed, eventOrder = false) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "parleyRolled") return;
    for (const j of chainScan(events, i, eventOrder)) {
      if (consumed.has(j)) continue;
      const oe = events[j];
      const isOutcome =
        (oe.type === "goldGained" && oe.why === "parley") || oe.type === "parleyFailed" || oe.type === "beastsSoothed";
      if (isOutcome) {
        consumed.add(i);
        consumed.add(j);
        const b = LINE_FOR[oe.type](oe);
        built.push({ text: `${b.text} (${rollVsText(e.roll, e.atLeast, e.dieN)})`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "parleyRolled") break;
    }
  });
  return built;
}

/**
 * chestChain(events, consumed, eventOrder = false) — `chestLockRolled` + (`chestOpened` |
 * `chestLocked`) fold into ONE line: the outcome's own text plus the
 * roll-high triple via rollVsText, `(${roll} vs ${lo}–${hi})`. A Pilfer's
 * roll-free `chestOpened` (reason "pilfer") has no preceding
 * `chestLockRolled` and keeps its own builder.
 */
function chestChain(events, consumed, eventOrder = false) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "chestLockRolled") return;
    for (const j of chainScan(events, i, eventOrder)) {
      if (consumed.has(j)) continue;
      const oe = events[j];
      if (oe.type === "chestOpened" || oe.type === "chestLocked") {
        consumed.add(i);
        consumed.add(j);
        const b = LINE_FOR[oe.type](oe);
        built.push({ text: `${b.text} (${rollVsText(e.roll, e.atLeast, e.dieN)})`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "chestLockRolled") break;
    }
  });
  return built;
}

/** SCROLL_COPY_NOTE — CMBUI-11: the one copy-limit sentence said after a scroll's cast. */
const SCROLL_COPY_NOTE = "Too advanced to copy into your book.";

/**
 * scrollCopyChain(events, consumed) — CMBUI-11 (Phase 77): a
 * `scrollTooAdvanced` whose very next line event is a `scrollCast` of the
 * same spell folds with it into ONE line, the cast first and the copy note
 * after it: `${LINE_FOR.scrollCast(cast).text} Too advanced to copy into
 * your book.` The engine pushes the note BEFORE the cast (it checks the copy
 * before the free cast), so without this chain the fold read "Fireball needs
 * level 3; you are 1." ahead of a scroll that cast anyway. The user's
 * 2026-09-21 report: "I got a message saying it was a level 3 spell so I
 * couldn't use it, but it actually successfully used the scroll."
 *
 * Keyed on adjacency in BOTH orders (the pair is one happening, not a roll
 * reaching across the action for its outcome), and the merged line sits at
 * the scrollTooAdvanced's idx, its earliest event (77-02's contiguity rule).
 * A scrollTooAdvanced with no cast directly after it keeps its own plain
 * note line. No `eventOrder` argument: both orders merge the same way.
 */
function scrollCopyChain(events, consumed) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "scrollTooAdvanced") return;
    const j = nextLineIdx(events, i);
    if (j === -1 || consumed.has(j)) return;
    const cast = events[j];
    if (cast.type !== "scrollCast" || cast.spell !== e.spell) return;
    consumed.add(i);
    consumed.add(j);
    const b = LINE_FOR.scrollCast(cast);
    built.push({ text: `${b.text} ${SCROLL_COPY_NOTE}`, tone: b.tone, priority: b.priority, idx: i });
  });
  return built;
}

/** ENCOUNTER_FOLLOWERS — the event types encounterStart's switch may fold in. */
const ENCOUNTER_FOLLOWERS = new Set(["trackable", "allyJoined", "warlockBoost", "foeFled", "foeBored", "phobiaAfraid", "combatInDark"]);

/**
 * encounterStart(events, consumed, eventOrder = false) — when an `encounterStarted` is present,
 * folds it plus its same-action followers (trackable, allyJoined,
 * warlockBoost, foeFled reason knight/conArtist, foeBored, phobiaAfraid,
 * combatInDark) into ONE line; each follower appends a short clause and is
 * consumed. Without an `encounterStarted` in the action, every one of those
 * events keeps its own builder (this function simply returns null). In the
 * event order (CMBUI-10) only the followers that come directly after the
 * start fold; a follower separated by another line keeps its own line.
 */
function encounterStart(events, consumed, eventOrder = false) {
  const idx = events.findIndex((e, i) => !consumed.has(i) && e.type === "encounterStarted");
  if (idx === -1) return null;
  const e = events[idx];
  const base = LINE_FOR.encounterStarted(e);
  consumed.add(idx);
  let text = base.text;
  for (let j = idx + 1; j < events.length; j++) {
    if (consumed.has(j)) continue;
    const fe = events[j];
    // CMBUI-10 (event order): only the run of followers directly after the
    // start folds in; the first other line event ends the run (a silent
    // bookkeeping event between them does not).
    if (eventOrder && !ENCOUNTER_FOLLOWERS.has(fe.type)) {
      if (lineEvent(fe)) break;
      continue;
    }
    switch (fe.type) {
      case "trackable":
        text += " · unnoticed";
        consumed.add(j);
        break;
      case "allyJoined":
        text += ` · ${fe.name ?? "an ally"} joins`;
        consumed.add(j);
        break;
      case "warlockBoost":
        text += ` · the dead stiffen (+${fe.amount ?? 0})`;
        consumed.add(j);
        break;
      case "foeFled":
        if (fe.reason === "knight") {
          text += ` · ${fe.name ?? "it"} flees a Knight`;
          consumed.add(j);
        } else if (fe.reason === "conArtist") {
          text += ` · ${fe.name ?? "it"} talked out of it`;
          consumed.add(j);
        }
        break;
      case "foeBored":
        text += ` · ${fe.name ?? "it"} loses interest`;
        consumed.add(j);
        break;
      // Phase 31 (CMB-01): renamed from phobiaFrozen. This fold rarely fires
      // now that the event arrives from the separate `fight` dispatch (not
      // the same action as encounterStarted), but the case must name the
      // live type in case a future caller ever chains them in one action.
      case "phobiaAfraid":
        text += " · afraid";
        consumed.add(j);
        break;
      case "combatInDark":
        text += " · in the dark";
        consumed.add(j);
        break;
      default:
        break;
    }
    // CMBUI-10: a follower-type event that did not fold (a foeFled for some
    // other reason) is a line of its own, so it ends the run too.
    if (eventOrder && !consumed.has(j)) break;
  }
  return { text, tone: base.tone, priority: base.priority, idx };
}

/**
 * dedupeByType(list) — keeps the first line of each event `type` in engine
 * order; a later line of the SAME type with DIFFERENT text appends
 * ` ×${N}` to the kept line. Aggregated lines (no `.type` tag) are never
 * deduped against each other or against table-mapped lines.
 */
function dedupeByType(list) {
  const seen = new Map();
  const result = [];
  for (const item of list) {
    if (!item.type) {
      result.push(item);
      continue;
    }
    if (!seen.has(item.type)) {
      seen.set(item.type, item);
      result.push(item);
    } else {
      const first = seen.get(item.type);
      first._count = (first._count || 1) + 1;
      if (item.text !== first.text) {
        first.text = first.text.replace(/ ×\d+$/, "") + ` ×${first._count}`;
      }
    }
  }
  return result;
}

/**
 * foldAdjacent(list) — CMBUI-10: the event order's ONLY fold. `list` is
 * already in event order; a line whose text, tone and priority all equal the
 * line right before it folds into that line, which gains " ×N" (the same
 * suffix shape dedupeByType uses, replacing any earlier " ×k"). A fold never
 * crosses an intervening line, so "Ned misses you" twice in a row reads once
 * with " ×2", and the same miss either side of a riposte reads twice.
 */
function foldAdjacent(list) {
  const result = [];
  for (const item of list) {
    const prev = result[result.length - 1];
    if (prev && prev._base === item.text && prev.tone === item.tone && prev.priority === item.priority) {
      prev._count += 1;
      prev.text = `${prev._base.replace(/ ×\d+$/, "")} ×${prev._count}`;
      continue;
    }
    result.push({ ...item, _base: item.text, _count: 1 });
  }
  return result;
}

/**
 * initiativeVerdictText(e) — Phase 51 (INIT-02): the ONE verdict sentence
 * for `combatJoined`'s "Initiative — …" line, shared by this module's own
 * `LINE_FOR.combatJoined` (roll-free) AND src/browser/eventNarration.js's
 * Oracle html (which prepends the two `.roll` dice spans) — imported once
 * from here (eventNarration.js already imports `slotWord` from this module,
 * so this adds no new cross-module dependency) rather than duplicated in
 * two tables that could drift out of voice. Keyed on `e.why` first, then
 * the legacy `e.senses` flag (Phase 40's Sense Presence short form), then
 * the plain `e.first`. Every branch is family-friendly sarcasm, pinned
 * clear of content/safety-wordlist.js's BANNED scan by
 * test/unit/initiative-line.test.js.
 */
export function initiativeVerdictText(e) {
  const why = e?.why ?? (e?.senses ? "senses" : null);
  switch (why) {
    case "samurai":
      return "Samurai honour — they go first.";
    case "slow":
      return "Too slow off the mark — they go first.";
    case "foreseen":
      return "Foresight — you go first.";
    case "acuteHearing":
      return "Acute Hearing — you go first.";
    case "senses":
      // RULES-05 (Phase 75): Sense Presence wins the roll outright now — the
      // sentence below states the reason before the verdict, like every
      // other why case's own opening clause.
      return "You felt them coming. You go first.";
    case "knight":
      return "A Knight's welcome — it comes straight at you.";
    case "courtMage":
      return "Court Mage — you talk first, they swing first.";
    case "speed":
      // Phase 90 plan 07 (SPELL-10): a live Speed of Sound wins the roll outright.
      return "Speed of Sound — you arrive before the noise you make. You go first.";
    default:
      return e?.first === "you" ? "You go first." : "They go first.";
  }
}

/**
 * linesForAction(type, events, ctx = {}, opts = {}) — the exported
 * per-action pipeline. See the header comment above this section for the
 * full order. `opts.limit` is kept for callers that want a shorter fold;
 * the default is Infinity, and every production caller (fightLog.js, the
 * rail path in mazeworld.html) already passes `{ limit: Infinity }`
 * explicitly, so the default now matches what every real caller gets.
 * Phase 34 (CSCR-04) adds `opts.withIdx` (default false): when true, each
 * surviving folded entry keeps its `idx` (the index into `events` its
 * roll detail should be looked up from) and, for a directly-mapped event,
 * its `type` — so the fight log can derive per-line dice detail via
 * `oracleDetailText(narrateEvent(events[idx]))` without re-deriving the
 * fold/dedup pipeline. The default (no opts, or opts without `withIdx`)
 * return shape stays exactly `{ text, tone, priority }`, byte-for-byte
 * unchanged from before this option existed.
 *
 * Phase 77 (CMBUI-10) adds `opts.order`: "priority" (the default, the rail's
 * one-card summary, byte-identical to before — pinned over a recorded corpus
 * by test/unit/event-order-fold.test.js) or "event" (the combat record:
 * fightLog.js#fightLogLinesFor and combatBeat.js#lineIdxsFor). In the event
 * order every line's `idx` is its earliest event, the lines ascend by idx,
 * and a line narrates more than one event only for one contiguous happening
 * (see the pipeline comment above). The user's report it fixes: "A Ned
 * falls, then 2 Neds miss, then I riposted."
 */
export function linesForAction(type, events, ctx = {}, opts = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const { limit = Infinity, withIdx = false, order = "priority" } = opts || {};
  const eventOrder = order === "event";
  const consumed = new Set();
  const built = [];
  // CMBUI-10 (event order only): idxAt moves a merged line to its earliest
  // event (a resistFailed folded into its effect); patched lends a throw's
  // spell name to a non-contiguous spellHit/spellMissed.
  const idxAt = new Map();
  const patched = new Map();

  const enc = encounterStart(events, consumed, eventOrder);
  if (enc) built.push(enc);
  if (eventOrder) {
    built.push(...spellChainEvent(events, consumed, idxAt, patched));
  } else {
    built.push(...enemyRound(events, consumed));
    built.push(...yourRound(events, consumed));
    built.push(...spellChain(events, consumed));
  }
  built.push(...fleeChain(events, consumed, eventOrder));
  built.push(...parleyChain(events, consumed, eventOrder));
  built.push(...chestChain(events, consumed, eventOrder));
  // CMBUI-11: the scroll's cast, then its copy note, as one line (both orders).
  built.push(...scrollCopyChain(events, consumed));
  if (!eventOrder) killFold(events, consumed, built);

  events.forEach((e, idx) => {
    if (consumed.has(idx)) return;
    if (ORACLE_ONLY.has(e.type)) return;
    const builder = LINE_FOR[e.type];
    if (!builder) return;
    const { text, tone, priority } = builder(patched.get(idx) ?? e, ctx);
    // Phase 25.1 (DFB-01 decision 2) — the ONE narrative-vs-table decision
    // point: for a narrative action's non-card event, prefer the Oracle's
    // own sentence (dice stripped); fall back to the table text when the
    // narration strips to nothing so a line is never blank.
    const narrative = typeof ctx.narrate === "function" && !CARD_EVENTS.has(e.type) ? narrativeLineText(ctx.narrate(e)) : "";
    built.push({ text: narrative || text, tone, priority, idx: idxAt.get(idx) ?? idx, type: e.type });
  });

  let deduped;
  if (eventOrder) {
    built.sort((a, b) => a.idx - b.idx);
    deduped = foldAdjacent(built);
  } else {
    deduped = dedupeByType(built);
    deduped.sort((a, b) => a.priority - b.priority || a.idx - b.idx);
  }
  const capped = deduped.slice(0, limit);
  return capped.map(({ text, tone, priority, idx, type: t }) =>
    withIdx ? { text, tone, priority, idx, ...(t !== undefined ? { type: t } : {}) } : { text, tone, priority }
  );
}

export const LINE_FOR = {
  /* ---------------- movement.js ---------------- */

  oneWayBlocked: (e) => ({
    text: e?.side === "approach" ? "That door works once — already used." : "That door is furniture now.",
    tone: "beat",
    priority: PRIORITY.other,
  }),
  climbedOver: () => ({ text: "Over, and no worse for it.", tone: "hit", priority: PRIORITY.other }),
  leaptOver: () => ({ text: "Cleared it. No drama.", tone: "hit", priority: PRIORITY.other }),
  // Phase 54 (BAND-02, USER RULING D): one-and-done — a failed climb/leap
  // that still lands you on the far side. Chosen by `e.feat` ("climb" vs
  // "gorge").
  draggedOver: (e) => ({
    text: e?.feat === "gorge" ? "Across, technically. The crevice kept your dignity as a toll." : "Over, eventually. The wall took its cut on the way.",
    tone: "hurt",
    priority: PRIORITY.other,
  }),
  flownOver: () => ({ text: "You simply fly over it.", tone: "hit", priority: PRIORITY.other }),
  phasedThrough: () => ({ text: "You step through it like a rumour of a wall.", tone: "hit", priority: PRIORITY.other }),
  // Phase 41 (TERR-02): entering a water cell (once per wade, not per step).
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  waded: (e) => ({ text: `Water: ${e?.cost ?? 2} squares a step.`, tone: "beat", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  fellClimbing: (e) => ({ text: `Fall: the wall won (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  fellInGorge: (e) => ({ text: `Fall: short of the far side (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19): the
  // fatal outcome — the ether window ended while the party stood in rock.
  // An outcome, never ORACLE_ONLY (mirrors fellClimbing/fellInGorge above);
  // the dedicated death/epitaph screen still owns the `died` event itself.
  entombed: () => ({ text: "The cloak gives out. The stone does not.", tone: "hurt", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // Phase 74 (ROLL-02/03): the player-signed cost of the check, matching
  // eventNarration.js's heightsFear/waterFear sign rule.
  heightsFear: (e) => ({ text: `Heights: ${signedText(-(e?.penalty ?? 0))} on the climb.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // Phase 74 (ROLL-02/03): see heightsFear's comment above for the sign rule.
  waterFear: (e) => ({ text: `Bodies of water: ${signedText(-(e?.penalty ?? 0))} on the leap.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trappedPanic: (e) => ({ text: `${e?.phobia ?? "Being trapped"}: four walls, one used door (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 41 (TERR-04/05): a fresh terrain-phobia region entry — the same
  // headline sentence eventNarration.js's phobiaTriggered uses, minus the
  // trailing "It will show in the next fight." clause (too long for a line).
  phobiaTriggered: (e) => {
    const lines = {
      water: "Water. You knew this was coming.",
      dark: "The dark. It was always going to be the dark.",
      heights: "That is a long way down.",
      deadEnd: "A dead end. The walls lean in a little.",
      nearDeath: "You can hear your own pulse.",
    };
    return { text: lines[e?.trigger] ?? "Your phobia has noticed where you are.", tone: "hurt", priority: PRIORITY.other };
  },
  // VOX-05 (Phase 79, plan 79-11): the Oracle twin's two branches, in short:
  // a tick states what it took; a tick with nothing left to take says so,
  // never "(−0 hp)".
  afflictionTick: (e) => ({
    text: (e?.loss ?? 0) > 0 ? `${e?.kind ?? "It"}: still in you (−${e.loss} hp).` : `${e?.kind ?? "It"}: nothing left to take. You are on one hp.`,
    tone: "hurt",
    priority: PRIORITY.other,
  }),
  afflictionPassed: (e) => ({ text: `The ${e?.kind ?? "worst of it"} passes.`, tone: "hit", priority: PRIORITY.other }),
  afflictionCured: (e) => ({ text: `Cured of the ${e?.kind ?? "sickness"}.`, tone: "hit", priority: PRIORITY.other }),
  afflictionLingers: (e) => ({ text: `The ${e?.kind ?? "sickness"} lingers.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 25 (FEED-01): `doubled` names the Soldier/heal2x race when the camp
  // heal was doubled; absent renders the plain amount only.
  rested: (e) => ({
    text: `Camp +${railGain(e, e?.amount)} hp${e?.doubled ? ` · ${e.doubled}, doubled` : ""}`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  // Phase 88 (ITEM-03): a heal-over-time tick (the Cloak of Regeneration's d6
  // at 10, 20 and 30 squares), the rail twin of the Oracle's healTick. It
  // replaces the retired use-time instant-heal line. A minor event, never a
  // decision card (not a CARD_EVENTS type); a full-hp tick is told too.
  healTick: (e) => {
    const g = railGain(e, e?.amount);
    const item = typeof e?.item === "string" && e.item ? e.item : "Cloak";
    const tail = Number.isFinite(e?.tick) && Number.isFinite(e?.ticks) ? ` (${e.tick}/${e.ticks})` : "";
    // Phase 89 (ITEM-07): a Joiner's own cloak knits the Joiner, by name.
    if (e?.member) {
      return {
        text: g > 0 ? `${e.member} +${g} hp: ${item}${railFull(g, e?.amount)}${tail}.` : `Nothing left to knit on ${e.member}${tail}.`,
        tone: "hit",
        priority: PRIORITY.other,
      };
    }
    return {
      text: g > 0 ? `+${g} hp: ${item}${railFull(g, e?.amount)}${tail}.` : `Nothing left to knit${tail}.`,
      tone: "hit",
      priority: PRIORITY.other,
    };
  },
  armorPatched: (e) => ({ text: `${e?.by ?? "Mending"}: +${e?.amount ?? 0} armour.`, tone: "hit", priority: PRIORITY.feature }),
  potionDuplicated: () => ({ text: "Warlock: +1 potion.", tone: "magic", priority: PRIORITY.feature }),
  // Phase 43 (CLAR-01/03/05): a fed night's ration cost — a cost, so it is
  // narrated (never ORACLE_ONLY), not just bookkeeping.
  // Phase 78 (78-05, the user's 2026-09-25 report: "I had 1 charge left ...
  // then when combat started I had 12 charges"): a fed day that refilled a
  // spent book leads with the refill and its count (`books`, stamped by
  // eventNarration.js#stampBookRefill only when the engine's own `refilled`
  // flag is set and the charges really reached zero), then the rations.
  rationsEaten: (e) => {
    const refill = bookRefillText(e?.books);
    const rations = `Rations: −${e?.eats ?? 0} (${e?.left ?? 0} left).`;
    return refill
      ? { text: `A new day. ${refill} ${rations}`, tone: "magic", priority: PRIORITY.other }
      : { text: rations, tone: "beat", priority: PRIORITY.other };
  },
  // Phase 78 (78-05, the user's 2026-09-25 report: "we're no longer getting
  // a rail update when a spell charge is regained"): the 20-square trickle
  // is a minor event — a rail line with the count, never a decision card.
  spellChargeRecovered: (e) => ({
    text: `A spell charge wanders back (${e?.charges ?? "?"}/${e?.max ?? "?"}).`,
    tone: "magic",
    priority: PRIORITY.other,
  }),
  // RULES-15 (Phase 75, user 2026-09-25): the rail line still says WHY a
  // spent book stays empty — mirrors eventNarration.js's own `booksKept` clause.
  // VOX-05 (Phase 79, plan 79-11): "no rations" was false when you had some,
  // just fewer than the night needs.
  wentHungry: (e) => ({
    text: `Hunger: not enough rations (−${e?.cost ?? 0} hp).${e?.booksKept ? " Book stays empty." : ""}`,
    tone: "hurt",
    priority: PRIORITY.other,
  }),
  wanderingMonster: (e) => ({
    text: `Camp disturbed.${e?.bard ? " · Bard: the singing carried" : ""}`,
    tone: "hurt",
    priority: PRIORITY.feature,
  }),
  // RULES-12 (Phase 75, user 2026-09-25): the rail's own copy of the tile a
  // wandering monster interrupted, resolving now that the fight (and any
  // spoils/find/store) is settled. Mirrors eventNarration.js's own clause map.
  tileResumed: (e) => ({
    text: `Settled — ${{ dot: "the dropped coin", trap: "the trap", chest: "the chest", tele: "the teleporter", exit: "the stairs down", gate: "the stairs down" }[e?.feat] || "the tile"}.`,
    tone: "beat",
    priority: PRIORITY.feature,
  }),
  // Phase 25.1 (DFB-06): still an amber block, priority 0, non-empty for a
  // bare payload; on the camp action the narrative ctx (NARRATIVE_ACTIONS)
  // shows the Oracle sentence instead — this is the fallback/coverage text.
  // VOX-05 (Phase 79, plan 79-11): the refusal names what it refused, and a
  // party's `need` is the whole party's night, as on the Oracle twin.
  campFailed: (e) =>
    block(
      e?.need != null && e?.have != null
        ? `Not enough food to make camp: ${e?.members?.length ? "the party eats" : "you eat"} ${e.need} a night, you have ${e.have}. Find rations first.`
        : "Not enough food to make camp."
    ),
  teleported: () => ({ text: "You teleport to an unknown location.", tone: "beat", priority: PRIORITY.other }),
  leveled: (e) => ({ text: `Skill level ${e?.level ?? "?"} (+${railGain(e, e?.wpGain)} hp).`, tone: "hit", priority: PRIORITY.feature }),
  // Phase 38 (ABIL-01/03): a level-pool ability roll, sibling of leveled
  // immediately above (both fold into the same SKILL LEVEL N card family).
  // VOX-05 (Phase 79, plan 79-11): no dangling " — " when the event carries no text.
  abilityLearned: (e) => ({ text: `New trick: ${e?.name ?? "something"}${e?.txt ? ` — ${e.txt}` : "."}`, tone: "hit", priority: PRIORITY.feature }),

  /* ---------------- combat.js ---------------- */

  // Phase 24 (IDENT-05): the never-first flag clauses append, unflagged text unchanged.
  encounterStarted: (e) => {
    const names = (e?.foes ?? []).map((f) => f?.name).filter(Boolean).join(", ") || "something";
    let text = `${e?.wandering ? "Wandering: " : ""}${names}`;
    if (e?.knightBigFoe) text += " · big foe, the Knight waits";
    if (e?.samuraiNeverFirst) text += " · a Samurai never strikes first";
    if (e?.fridgianSlow) text += " · you strike last";
    if (e?.courtMageTalksFirst) text += " · you talk first, they act first";
    if (e?.acuteHearing) text += " · you heard them coming";
    return { text, tone: "beat", priority: PRIORITY.feature };
  },
  trackable: () => ({ text: "Unnoticed — you could slip away.", tone: "beat", priority: PRIORITY.feature }),
  allyJoined: (e) => ({ text: `${e?.name ?? "An ally"} falls in beside you.`, tone: "hit", priority: PRIORITY.feature }),
  warlockBoost: (e) => ({ text: `The dead stiffen (+${e?.amount ?? 0} hp each).`, tone: "hurt", priority: PRIORITY.feature }),
  foeFled: (e) => {
    const map = {
      knight: `${e?.name ?? "It"} flees a Knight.`,
      conArtist: `${e?.name ?? "It"} talked out of it.`,
      lowHp: `${e?.name ?? "It"} runs.`,
    };
    return { text: map[e?.reason] ?? `${e?.name ?? "It"} flees.`, tone: "hit", priority: PRIORITY.feature };
  },
  foeBored: (e) => ({ text: `${e?.name ?? "It"} loses interest.`, tone: "hit", priority: PRIORITY.feature }),
  encounterCleared: () => ({ text: "Nothing left standing.", tone: "hit", priority: PRIORITY.feature }),
  // Phase 31 (CMB-01): the FIGHT step's own initiative outcome — the
  // encounter step no longer knows who moves first.
  // Phase 40 (SPELL-02): Sense Presence's own short form when it decided the
  // roll.
  // Phase 51 (INIT-02, DELIBERATE RULES CHANGE, 2026-09-20): the roll-free
  // rail/fight-log text — the prototype's C.initNote, minus the dice (the
  // Oracle keeps those). `initiativeVerdictText` names an override (Samurai/
  // slow/foreseen/Acute Hearing/senses/Knight/Court Mage) in voice when one
  // decided the roll; otherwise it's the bare "You/They go first." — same
  // table src/browser/eventNarration.js's Oracle html reads, so the two
  // surfaces can never disagree about the verdict.
  combatJoined: (e) => ({
    text: `Initiative — ${initiativeVerdictText(e)}`,
    tone: e?.first === "you" ? "hit" : "hurt",
    priority: PRIORITY.feature,
  }),
  // Phase 31 (renamed from phobiaFrozen — "Phobia should be penalties, never
  // a no actions state", user ruling 2026-09-16): a triggered phobia is now
  // a −to-hit/half-damage penalty, never a lost action.
  phobiaAfraid: (e) => ({ text: `Afraid. Your aim wobbles for ${e?.rounds ?? 2} rounds.`, tone: "hurt", priority: PRIORITY.feature }),
  combatInDark: () => ({ text: "You cannot see what you are fighting.", tone: "beat", priority: PRIORITY.feature }),
  // Phase 23 (IDENT-01): names the attack spell the Wizard should cast instead, when supplied.
  // Phase 31 (CMB-01): notFought — Fight! not yet pressed.
  strikeRefused: (e) =>
    e?.reason === "wizard"
      ? block(e?.spell ? `Wizards don't punch. Cast ${e.spell}.` : "Wizards don't punch while a spell remains.")
      : e?.reason === "notFought"
        ? block("Fight! first, then swing.")
        : block("You hold back."),
  // Phase 31 (renamed from shookOffFrozen): the Afraid countdown reaching 0.
  fearPassed: () => ({ text: "The fear passes. Your hands remember what they are for.", tone: "hit", priority: PRIORITY.feature }),
  frenzy: () => ({ text: "Frenzy — two wild swings.", tone: "hit", priority: PRIORITY.feature }),
  // Phase 25 (FEED-05): untouchable never gets a quip (decorateMisses skips
  // it); `quip` renders after an em-dash only when present.
  // Quick 260928-nrf (user ruling 2026-09-28): a missed Kata or Feint names
  // the ability and says it is spent anyway (they roll to hit now).
  strikeMissed: (e) =>
    e?.untouchable
      ? { text: `You cannot touch ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }
      : { text: `You miss ${e?.target ?? "it"}${MISS_SPENT_VIA.has(e?.via) ? ` with ${ABILITY_BY_ID[e.via].name}, spent anyway` : ""}${e?.quip ? ` — ${e.quip}` : ""}`, tone: "miss", priority: PRIORITY.you },
  deathTouch: (e) => ({ text: `One touch — ${e?.target ?? "it"} drops.`, tone: "hit", priority: PRIORITY.feature }),
  backstabDenied: () => block("Heavy armour gave you away: no sneak attack."),
  stealthStrike: () => ({ text: "Unseen strike — critical.", tone: "hit", priority: PRIORITY.feature }),
  backstab: () => ({ text: "Backstab — critical.", tone: "hit", priority: PRIORITY.feature }),
  conArtistOpener: () => ({ text: "Con Artist opener: all flourish, no damage.", tone: "miss", priority: PRIORITY.feature }),
  ninjaFirstStrike: () => ({ text: "One perfect opening strike.", tone: "hit", priority: PRIORITY.feature }),
  // Phase 25 (FEED-01): `critBy` names the reason for the CRIT suffix.
  struck: (e) => {
    const crit = e?.critical ? " · CRIT" : "";
    const reason = e?.critical && CRIT_BY_TEXT[e?.critBy] ? ` (${CRIT_BY_TEXT[e.critBy]})` : "";
    return { text: `You hit ${e?.target ?? "it"} (${e?.dmg ?? 0})${crit}${reason}`, tone: "hit", priority: PRIORITY.you };
  },
  foeRevived: (e) => ({ text: `${e?.name ?? "It"} gets back up.`, tone: "dodge", priority: PRIORITY.them }),
  foeKilled: (e) => ({ text: `${e?.name ?? "It"} falls (+${e?.spGained ?? 0} XP).`, tone: "hit", priority: PRIORITY.you }),
  // Phase 72 (ROLL-01 (c)): a landed best-face strike shatters a
  // shatter-flagged foe (the Skeleton) outright, both lives at once. Safe on
  // a bare `{ type }` payload (the coverage guard).
  foeShattered: (e) => ({
    text: `${e?.by === "you" ? "Your" : `${e?.by ?? "Something"}'s`} best roll lands clean. ${e?.target ?? "It"} comes apart, both lives at once, and nobody is sweeping up.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  cooked: (e) => ({
    text:
      (e?.wp ?? 0) <= 0
        ? `Salvaged +${e?.rations ?? 1} ration.`
        : railGain(e, e.wp) > 0
          ? `Cooked: +${railGain(e, e.wp)} hp${railFull(railGain(e, e.wp), e.wp) ? " (back to full)" : ""}, +${e?.rations ?? 1} ration.`
          : `Cooked: you were already at full hp, +${e?.rations ?? 1} ration.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  // Phase 31 (CMB-01): notFought — Fight! not yet pressed — added alongside
  // the existing samurai reason.
  fleeRefused: (e) => (e?.reason === "notFought" ? block("Running comes after Fight!, not instead of it.") : block("A Samurai does not run.")),
  withdrawalDenied: () => block("Slipping away untouched would mean not attacking."),
  vanishDenied: () => block("They have already seen your face."),
  fled: (e) => {
    const map = { cloaker: "You vanish — clean escape.", tracked: "You slip away before it sees you.", smoke: "Gone through the smoke. Nobody follows." };
    return { text: map[e?.reason] ?? "You get clear.", tone: "hit", priority: PRIORITY.you };
  },
  // Phase 42 (FLEE-02): named modifiers replace the old flat "+bonus" —
  // null-safe (`e?.mods ?? []`) for the voice scan's sparse-event calls.
  // Phase 73 (ROLL-05): flee is already roll-high — the roll and its
  // winning range (bonus already folded into `atLeast`) replace the old
  // roll/total/need triple.
  fleeRolled: (e) => {
    const mods = e?.mods ?? [];
    return {
      text: `Flee: ${rollVsText(e?.roll, e?.atLeast, e?.dieN)}${mods.length ? ` (${modsText(mods, ROLLERS.you)})` : ""}`,
      tone: "beat",
      priority: PRIORITY.other,
    };
  },
  fleeFailed: () => ({ text: "You do not make it.", tone: "miss", priority: PRIORITY.you }),
  parleyRefused: (e) => {
    const map = {
      ninja: "A Ninja does not negotiate.",
      masterOfArms: "A Master of Arms has one answer, and it is not a sentence.",
      walkingDead: "The Walking Dead do not parley.",
      magical: "Magic Users do not parley with you.",
      wilmsryVsMagical: "Magic Users hate the Wilmsry. There is nothing to discuss.",
      tried: "You already tried that.",
      // Phase 31 (CMB-01): Fight! not yet pressed.
      notFought: "They are not listening yet. Fight! first.",
    };
    return block(map[e?.reason] ?? "Not this time, not with them.");
  },
  // Phase 73 (ROLL-05): the winning range (roll-high) replaces the old bare
  // `need` — see rollRange.js#rollVsText.
  parleyRolled: (e) => ({ text: `Talk it down: ${rollVsText(e?.roll, e?.atLeast, e?.dieN)}`, tone: "beat", priority: PRIORITY.other }),
  parleyInsulted: () => ({ text: "You have made it personal.", tone: "hurt", priority: PRIORITY.them }),
  parleyExhausted: () => block("You already said your piece."),
  goldGained: (e) => {
    const suffix = e?.why === "pickpocket" ? " (Pickpocket)" : e?.why === "parley" ? " (parley)" : "";
    return { text: `+${e?.amount ?? 0} wilmst${suffix}`, tone: "hit", priority: PRIORITY.feature };
  },
  parleyFailed: () => ({ text: "They are not buying it.", tone: "miss", priority: PRIORITY.you }),
  sang: (e) => ({ text: `You sing ${e?.song ?? "a tune"}.`, tone: "magic", priority: PRIORITY.feature }),
  // VOX-05 (Phase 79, plan 79-04): the song lines name who the song reached;
  // Lullaby and Thunder roll how many foes they can reach ("up to").
  beastsSoothed: (e) => ({
    text: (e?.count ?? 0) === 1 ? "1 beast stands down and leaves." : `${e?.count ?? 0} beasts stand down and leave.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  songIgnored: () => ({ text: "They do not care for music.", tone: "miss", priority: PRIORITY.feature }),
  lullabyRolled: (e) => ({ text: `Lullaby: up to ${e?.n ?? 0} nod off.`, tone: "magic", priority: PRIORITY.feature }),
  thunderRolled: (e) => ({
    text: `Thunder rolls — up to ${e?.n ?? 0} freeze, ${railPlural(e?.r ?? 0, "round")}.`,
    tone: "magic",
    priority: PRIORITY.feature,
  }),
  // DFB-05 (Phase 25.1): legacy text (no `backstab`/`crit`/`target`) stays
  // byte-identical; a classed member's blow names the target and calls out
  // a backstab/crit. Plan 04 (ABIL-05): an optional `via` clause names the
  // ability (canon catalog name) behind a member's strike-kind ability use.
  allyStruck: (e) => {
    const who = e?.name ?? "Your ally";
    const t = e?.target ?? "it";
    const via = e?.via && ABILITY_BY_ID[e.via] ? ` (${ABILITY_BY_ID[e.via].name})` : "";
    const text = e?.backstab ? `${who} backstabs ${t} (${e?.dmg ?? 0})` : `${who} lands a hit on ${t} (${e?.dmg ?? 0}).${e?.crit ? CRIT_SUFFIX : ""}${via}`;
    return { text, tone: "hit", priority: PRIORITY.feature };
  },
  allyMissed: (e) => ({
    text: e?.target
      ? `${e?.name ?? "Your ally"} misses ${e.target}${e?.via && ABILITY_BY_ID[e.via] ? ` (${ABILITY_BY_ID[e.via].name})` : ""}`
      : `${e?.name ?? "Your ally"} swings and misses.`,
    tone: "miss",
    priority: PRIORITY.feature,
  }),
  allyDeparted: (e) => ({ text: `${e?.name ?? "Your ally"} slips away, obligation met.`, tone: "beat", priority: PRIORITY.feature }),
  // DFB-05 (Phase 25.1): a Magic User member's cast outcome — one line per
  // cast (allyCast itself is ORACLE_ONLY).
  allySpellHit: (e) => {
    const who = e?.name ?? "Your ally";
    const sp = e?.spell ?? "a spell";
    const t = e?.target ?? "it";
    const tail = e?.effect === "asleep" ? `${t} nods off` : e?.effect === "weakened" ? "the foes weaken" : `${t} (${e?.dmg ?? 0})`;
    return { text: `${who} casts ${sp} — ${tail}`, tone: "magic", priority: PRIORITY.feature };
  },
  allySpellMissed: (e) => ({
    text: `${e?.name ?? "Your ally"} casts ${e?.spell ?? "a spell"} — ${e?.resisted ? `${e?.target ?? "it"} resists` : `misses ${e?.target ?? "it"}`}`,
    tone: "miss",
    priority: PRIORITY.feature,
  }),
  // Phase 25 (FEED-01, renamed Phase 73 ROLL-05): `mods` names the reason a
  // swing that should have landed did not — only when the roll would have
  // hit without the modifier (see foeMissed's own builder below).
  memberStruck: (e) => {
    const crit = e?.critical ? " · CRIT" : "";
    // Phase 89 plan 04 (ITEM-07): the armour roll that missed, when one was drawn.
    const soak = e?.soak ? ` · armour missed (${e.soak.roll ?? "?"})` : "";
    return { text: `${e?.name ?? "It"} hits ${e?.member ?? "your companion"} (${e?.dmg ?? 0})${crit}${soak}`, tone: "hurt", priority: PRIORITY.feature };
  },
  memberDowned: (e) => ({ text: `${e?.name ?? "Your companion"} goes down.`, tone: "hurt", priority: PRIORITY.feature }),
  regenerated: (e) => ({
    text: railGain(e, e?.amount) > 0 ? `+${railGain(e, e?.amount)} hp knits shut${railFull(railGain(e, e?.amount), e?.amount)}.` : "Regeneration: you were already at full hp.",
    tone: "hit",
    priority: PRIORITY.you,
  }),
  acidTick: (e) => ({ text: `Acid eats at ${e?.target ?? "it"} (${e?.dmg ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  foeSlept: (e) => ({ text: `${e?.name ?? "It"} sleeps through it.`, tone: "dodge", priority: PRIORITY.them }),
  foeMissed: (e) => {
    const mods = e?.mods ?? [];
    const negative = mods.filter((m) => m.delta < 0);
    const negSum = negative.reduce((sum, m) => sum + m.delta, 0);
    // Phase 73 (ROLL-05): without the negative deltas, the foe's lowest
    // winning face would have been atLeast + negSum (negSum <= 0), so a
    // roll at or above that reduced threshold "would have hit" — the
    // roll-high mirror of the old `e.roll <= e.need - negSum` reading.
    const wouldHaveHit = negative.length > 0 && e?.roll != null && e?.atLeast != null && e.roll >= e.atLeast + negSum;
    let text = `${e?.name ?? "It"} misses ${e?.member ?? "you"}`;
    // Phase 74 (ROLL-02/03): name each entry through modLabel — the
    // Weaken cap's raw name ("penalty") reads as "Weaken" here too.
    if (wouldHaveHit) text += ` · ${negative.map((m) => modLabel(m.name)).join(", ")}`;
    return { text, tone: "dodge", priority: e?.member ? PRIORITY.feature : PRIORITY.them };
  },
  // RULES-14 (Phase 75): the rail twin of eventNarration.js's own
  // mirror-aware wardReflected line.
  wardReflected: (e) => ({
    text: e?.mirror ? `The bubble sends it back — ${e?.amount ?? 0} to ${e?.target ?? "them"}. Pop.` : `The ward throws ${e?.amount ?? 0} back.`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  wardAbsorbed: (e) => ({ text: `The ward eats ${e?.amount ?? 0} (${e?.remaining ?? 0} left).`, tone: "hit", priority: PRIORITY.them }),
  wardShattered: () => ({ text: "The ward shatters.", tone: "hurt", priority: PRIORITY.them }),
  // RULES-10 (Phase 75.1) — the foe-side ward/Bubble mirrors: a fumbled
  // Shield or a popped fumbled Bubble on the FOE eats the hero's OWN blow,
  // mirroring wardAbsorbed/wardShattered's own tone/priority pairing.
  // VOX-05 (Phase 79, plan 79-08): a bare event reads "Its", never "It's", and
  // the bubble's wasted number is damage.
  foeWardSoaked: (e) => ({ text: `${railPossessive(e?.name, "Its")} ward drinks ${e?.amount ?? 0} (${e?.left ?? 0} left).`, tone: "miss", priority: PRIORITY.them }),
  foeWardBroken: (e) => ({ text: `${railPossessive(e?.name, "Its")} ward gives out.`, tone: "hit", priority: PRIORITY.them }),
  foeBubbleCaught: (e) => ({ text: `${railPossessive(e?.name, "Its")} bubble swallows your blow — ${e?.amount ?? 0} damage wasted.`, tone: "miss", priority: PRIORITY.them }),
  // The telegraph for the throw-back; foeBolted (pushed right after, same
  // action) carries the actual hp lost.
  foeBubbleRebound: (e) => ({ text: `${railPossessive(e?.name, "Its")} bubble throws it back at you.`, tone: "hurt", priority: PRIORITY.them }),
  // Phase 89 plan 04 (ITEM-07): `member` names a Joiner whose own armour gave out.
  armorDestroyed: (e) => ({ text: e?.member ? `${railPossessive(e.member, "Their")} armour gives out.` : "Your armour gives out.", tone: "hurt", priority: e?.member ? PRIORITY.feature : PRIORITY.them }),
  // Phase 25 (FEED-01): `wear` is the real durability cost; `halved` names the
  // Dwarven mitigation. Phase 28 (ARMOR-05): `underMin`/`magic` are two more
  // additive outcome flags — the blow was soaked at/under the armour's min
  // (no wear), or soaked by the Cloak of Armor's magic plate (never wears) —
  // making all four armorSoaked outcomes distinguishable on screen.
  // Phase 89 plan 04 (ITEM-07): `member` names the Joiner whose own armour
  // took the blow; a hero payload (no member) is byte-identical to before.
  armorSoaked: (e) => {
    const armour = e?.member ? `${railPossessive(e.member, "Their")} armour` : "Armour";
    return {
      text: e?.magic
        ? `${e?.member ? `${railPossessive(e.member, "Their")} cloak's` : "The cloak's"} plate takes ${e?.amount ?? 0} · never wears`
        : e?.underMin
          ? `${armour} shrugs off ${e?.amount ?? 0} · under its min, no wear`
          : `${armour} takes ${e?.amount ?? 0}${e?.wear ? ` · wear ${e.wear}` : ""}${e?.halved ? " (Dwarven, halved)" : ""}`,
      tone: "hit",
      priority: e?.member ? PRIORITY.feature : PRIORITY.them,
    };
  },
  // VOX-05 (Phase 79, plan 79-08): "Its armour", never "It's armour".
  foeArmorSoaked: (e) => ({ text: `${railPossessive(e?.name, "Its")} armour shrugs it off.`, tone: "miss", priority: PRIORITY.them }),
  // Phase 89 plan 04 (ITEM-07): `member` names the Joiner wearing the pendant.
  damageHalved: (e) => ({
    text: e?.member ? `The pendant halves ${railPossessive(e?.name, "the")} blow on ${e.member}.` : `The pendant halves ${railPossessive(e?.name, "the")} blow.`,
    tone: "hit",
    priority: e?.member ? PRIORITY.feature : PRIORITY.them,
  }),
  // Quick 260928-cos: the rail twin of the Oracle's critWarded line — a
  // live Cloak of Strength turned a foe's critical into an ordinary hit.
  critWarded: (e) => ({
    text: `${e?.member ? `${railPossessive(e.member, "Their")} ${railWardName(e?.item)}` : `Your ${railWardName(e?.item)}`} turns ${railPossessive(e?.name, "the")} critical into an ordinary hit${Number.isFinite(e?.roll) && Number.isFinite(e?.dieN) ? ` (${e.roll} on the d${e.dieN})` : ""}.`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  // Phase 25 (FEED-01): `soldierCrit` renders exactly like `critical`;
  // `soaked` names what absorbed the blow.
  struckByFoe: (e) => {
    const crit = e?.critical || e?.soldierCrit ? " · CRIT" : "";
    return { text: `${e?.name ?? "It"} hits you (${e?.dmg ?? 0})${crit}${soakSuffix(e?.soaked)}`, tone: "hurt", priority: PRIORITY.them };
  },
  wardFaded: () => ({ text: "The ward fades.", tone: "beat", priority: PRIORITY.other }),
  mirrorFaded: () => ({ text: "The mirror fades.", tone: "beat", priority: PRIORITY.other }),
  // RULES-10 (Phase 75.1) — a foe's own ward/Mirror Self ticks fade exactly
  // like the hero's above.
  foeWardFaded: (e) => ({ text: `${railPossessive(e?.name, "Its")} ward fades.`, tone: "beat", priority: PRIORITY.other }),
  foeMirrorFaded: (e) => ({ text: `${railPossessive(e?.name, "Its")} mirror fades.`, tone: "beat", priority: PRIORITY.other }),
  // Phase 40 (SPELL-02): endCombat's own expiry narration for a
  // still-running Regeneration/Sense Presence when the fight ends.
  sensesFaded: () => ({ text: "Your senses dull back to normal.", tone: "beat", priority: PRIORITY.other }),
  regenFaded: () => ({ text: "The wounds stop closing on their own.", tone: "beat", priority: PRIORITY.other }),

  // RULES-10 (Phase 75.1) — the reader's own burn, the heavy-blow fumble
  // replacement, and the hero-cannot-act countdown/recovery.
  selfDotTick: (e) => ({ text: `${e?.spell ?? "The scroll"} burns you (−${e?.amount ?? 0} hp, ${e?.left ?? 0} left).`, tone: "hurt", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-04): the twin of the Oracle's heavy-blow line
  // (the `how` flavor key no longer prints: "stone instead" read as a fact).
  fumbleHeavyBlow: (e) => ({ text: `${e?.spell ?? "The scroll"} backfires: a heavy blow (−${e?.amount ?? 0} hp). Shaken.`, tone: "hurt", priority: PRIORITY.you }),
  heroLostTurn: (e) => ({ text: `You cannot act (${e?.kind ?? "out"}), ${e?.left ?? 0} turn${e?.left === 1 ? "" : "s"} left.`, tone: "hurt", priority: PRIORITY.you }),
  heroCameTo: () => ({ text: "You can act again.", tone: "hit", priority: PRIORITY.you }),

  // RULES-10 (Phase 75.1, plan 05) — resolveScrollFumble's three outcome
  // events. Tone "hurt" for the reader's side, "miss" for the foe's gain —
  // mirroring the plan's own voice direction.
  fumbleOnReader: (e) => {
    const rounds = e?.rounds ?? 0;
    const texts = {
      damage: `${e?.spell ?? "The scroll"} turns on you (−${e?.amount ?? 0} hp).`,
      dot: `${e?.spell ?? "The scroll"} burns you, ${rounds} round${rounds === 1 ? "" : "s"} of it.`,
      out: e?.kind === "stopped" ? `${e?.spell ?? "The scroll"} stops you in place, ${rounds} turn${rounds === 1 ? "" : "s"}.` : `${e?.spell ?? "The scroll"} takes you out (${e?.kind ?? "out"}), ${rounds} turn${rounds === 1 ? "" : "s"}.`,
      vapor: `${e?.spell ?? "The scroll"} takes you out (${e?.kind ?? "out"}), ${rounds} turn${rounds === 1 ? "" : "s"}.`,
      blind: `${e?.spell ?? "The scroll"} blinds you for the fight.`,
      shrink: `${e?.spell ?? "The scroll"} shrinks you (−${e?.loss ?? 0} hp) for the fight.`,
      // CMBUI-13 (Phase 77, plan 77-07): names what the weakening does.
      weakened: `${e?.spell ?? "The scroll"} weakens you: half damage, ${rounds} round${rounds === 1 ? "" : "s"}.`,
    };
    return { text: texts[e?.effect] ?? `${e?.spell ?? "The scroll"} fumbles and does nothing to you.`, tone: "hurt", priority: PRIORITY.you };
  },
  fumbleOnSide: (e) => ({
    text:
      e?.who === "reader"
        ? `${e?.spell ?? "The scroll"} catches you too (−${e?.amount ?? 0} hp).`
        : e?.unmade
          ? `${e?.spell ?? "The scroll"} unmakes ${e?.name ?? "your ally"}.`
          : `${e?.spell ?? "The scroll"} catches ${e?.name ?? "your companion"} too (−${e?.amount ?? 0} hp).`,
    tone: "hurt",
    priority: PRIORITY.you,
  }),
  // VOX-05 (Phase 79, plan 79-08): a helpful fumble says what it did for the
  // foe, the twin of the Oracle line; a wasted one with no foe left says so.
  fumbleOnFoe: (e) => {
    const sp = e?.spell ?? "The scroll";
    const t = e?.target ?? "it";
    const helped = {
      heal: `heals ${t} instead (+${e?.amount ?? 0} hp).`,
      regen: `lands on ${t} instead: it regenerates.`,
      ward: e?.mirror ? `wraps ${t} in a bubble: your next blow comes back.` : `wards ${t}: it soaks your next ${e?.pool ?? 0}.`,
      might: `strengthens ${t}: +${e?.might ?? 0} damage on its blows, for the fight.`,
      mirror: `mirrors ${t}, ${railPlural(e?.rounds ?? 0, "round")}: you hit it only on your top face.`,
      senses: `sharpens ${railPossessive(e?.target, "its")} senses, to no visible effect.`,
      // Phase 90 plan 07 (SPELL-10): a fumbled Speed of Sound.
      frenzy: `quickens ${t}: two swings a turn, for the fight.`,
    };
    return {
      text:
        e?.effect === "wasted"
          ? e?.target
            ? `${sp} is wasted on ${e.target}.`
            : `${sp} is wasted: no foe left to help.`
          : e?.effect === "summon"
            ? e?.joined
              ? `${sp} calls up ${e?.reinforcement ?? "something"} for ${t}.`
              : `${sp} calls for help — nothing answers.`
            : helped[e?.effect]
              ? `${sp} ${helped[e.effect]}`
              : `${sp} helps ${t} instead.`,
      tone: "miss",
      priority: PRIORITY.them,
    };
  },

  /* ---------------- foe abilities (engine/foeAbilities.js) ---------------- */

  foeCast: (e) => ({ text: `${e?.name ?? "It"}: ${e?.txt ?? "something unpleasant"}`, tone: "dodge", priority: PRIORITY.them }),
  foeBolted: (e) => {
    const suffix = soakSuffix(e?.soaked);
    return e?.member
      ? { text: `${e?.name ?? "It"} bolts ${e.member} (${e?.dmg ?? 0})${suffix}${e?.soak ? ` · armour missed (${e.soak.roll ?? "?"})` : ""}`, tone: "hurt", priority: PRIORITY.feature }
      : { text: `${e?.name ?? "It"} bolts you (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.them };
  },
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-08): `stolen` is the FOE's gain (its bolt line,
  // just before, carries your loss), and the drain may have hit a Joiner.
  foeDrained: (e) => ({ text: `${e?.name ?? "It"} drinks it in (+${e?.stolen ?? 0} hp).`, tone: "hurt", priority: PRIORITY.them }),
  // CMBUI-13 (Phase 77, plan 77-07, "the onset line names the effect"): a
  // daze states its to-hit delta from the payload (toHitText); a weakening
  // says half damage. A missing field drops its clause.
  foeDebuffed: (e) => {
    const rounds = e?.rounds;
    const lasts = Number.isFinite(rounds) ? ` for ${rounds} round${rounds === 1 ? "" : "s"}` : "";
    const what =
      e?.kind === "dazed"
        ? `dazed${Number.isFinite(e?.toHit) ? `, ${toHitText(e.toHit)}` : ""}`
        : e?.kind === "weakened"
          ? "weakened, half damage"
          : `you are ${e?.kind ?? "afflicted"}`;
    return { text: `${e?.name ?? "It"}: ${what}${lasts}.`, tone: "hurt", priority: PRIORITY.them };
  },
  foeHealed: (e) => ({ text: `${e?.name ?? "It"} heals (+${e?.amount ?? 0}).`, tone: "dodge", priority: PRIORITY.them }),
  // RULES-10 (Phase 75.1) — a fumbled Regeneration on a foe, same
  // tone/priority as foeHealed immediately above.
  foeRegenerated: (e) => ({ text: `${e?.name ?? "It"} regenerates (+${e?.amount ?? 0}).`, tone: "dodge", priority: PRIORITY.them }),
  foeSummoned: (e) => ({
    text: e?.pending ? `${e?.by ?? e?.name ?? "It"} calls for help.` : `${e?.name ?? "Something"} joins the fight.`,
    tone: "dodge",
    priority: PRIORITY.them,
  }),
  // CMBUI-13 (Phase 77, plan 77-07): the fade says what ended.
  foeEffectFaded: (e) => ({
    text:
      e?.kind === "dazed"
        ? Number.isFinite(e?.toHit)
          ? `The daze lifts: no longer ${toHitText(e.toHit)}.`
          : "You are no longer dazed."
        : "Your strength comes back: full damage again.",
    tone: "hit",
    priority: PRIORITY.you,
  }),
  // VOX-05 (Phase 79, plan 79-08): a bare event read "its's spell".
  // Quick 260928-hrs (user ruling 2026-09-28): the hero resists on the
  // half-intel scale a foe does, so both twins state the roll and the range.
  heroResisted: (e) => ({ text: `You resist ${railPossessive(e?.name, "its")} spell (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, intel ${e?.intel ?? "?"}).`, tone: "hit", priority: PRIORITY.you }),
  // Phase 25 (FEED-03): starts with the foe's name (matches the THEM-family
  // tone-prefix contract every other foe-action builder follows).
  heroResistFailed: (e) => ({ text: `${e?.name ?? "It"} gets through — you fail to resist (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, intel ${e?.intel ?? "?"}).`, tone: "hurt", priority: PRIORITY.them }),
  // Quick 260928-nrf (user ruling 2026-09-28, Joiners resist: "Yes, same
  // scale"): the Joiner's twins of the two lines above, naming the Joiner
  // and stating the roll, the range and the Joiner's own intel.
  memberResisted: (e) => ({ text: `${e?.member ?? "Your companion"} resists ${railPossessive(e?.name, "its")} spell (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, intel ${e?.intel ?? "?"}).`, tone: "hit", priority: PRIORITY.feature }),
  memberResistFailed: (e) => ({ text: `${e?.name ?? "It"} gets through — ${e?.member ?? "your companion"} fails to resist (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, intel ${e?.intel ?? "?"}).`, tone: "hurt", priority: PRIORITY.feature }),
  foePursued: (e) => ({ text: `${e?.name ?? "It"} follows you out.`, tone: "hurt", priority: PRIORITY.them }),
  foeOutOfSpells: (e) => ({ text: `${e?.name ?? "It"} is out of spells.`, tone: "dodge", priority: PRIORITY.them }),

  /* ---------------- abilities.js (Phase 38, ABIL-01/04) ---------------- */

  abilityUsed: (e) => ({ text: `You call ${e?.name ?? "it"}.`, tone: "hit", priority: PRIORITY.feature }),
  // Canon refusal register (38-CONTEXT.md): a cooldown names the ability,
  // the rounds left, and the same wry closing line every time.
  abilityRefused: (e) => {
    const name = e?.name ?? e?.key ?? "That";
    const map = {
      notFought: "Fight! first, then swing.",
      unknown: `${e?.name ?? e?.key ?? "That"}? You do not know that one.`,
      // VOX-05 (Phase 79, plan 79-08): the Oracle twin's wording.
      cooldown: `${name}: ready again in ${e?.left ?? "?"} round${e?.left === 1 ? "" : "s"}. Your arm has opinions.`,
      // Quick 260927-opf: a used once-per-fight ability, until the fight ends.
      spent: `${name}: spent for this fight.`,
      notInCombat: `${name}: nothing to use it on out here.`,
      noTarget: `${name}: nothing left standing to use it on.`,
      notLowEnough: `Last Stand: only at a quarter of your hp or less (you have ${e?.have ?? "?"} of ${e?.max ?? "?"}).`,
      // Quick 260928-nrf: Sweep needs two or more living foes.
      tooFewFoes: `${name}: needs two or more foes.`,
    };
    return block(map[e?.reason] ?? `${name} refuses you.`);
  },
  // Plan 04 (ABIL-05): the fourteen ability-activation/effect lines below
  // carry an ADDITIVE `${e?.member ? \`${e.member}: \` : ""}` prefix — present
  // only when a Joiner (not the hero) is the actor.
  // VOX-05 (Phase 79, plan 79-04): the ability twins below state the effect
  // the engine applied, like their Oracle lines; a Joiner's own Sidestep,
  // Smoke, Riposte and Brace cover the Joiner ("them"), not the hero.
  pommelStruck: (e) => ({
    // Phase 90 (ABIL-07): the follow-through of a landed blow, short.
    text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} sees stars and loses its next turn.`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  foeStunned: (e) => ({ text: `${e?.name ?? "It"} loses its turn.`, tone: "hit", priority: PRIORITY.them }),
  battleRoarRaised: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Foes have two fewer faces to hit your side, for two rounds.`, tone: "hit", priority: PRIORITY.feature }),
  sidestepped: (e) => ({
    text: `${e?.member ? `${e.member}: ` : ""}Foes have two fewer faces to hit ${e?.member ? "them" : "you"}, for two rounds.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  secondWindHealed: (e) => ({
    text: railGain(e, e?.amount) > 0 ? `+${railGain(e, e?.amount)} hp${railFull(railGain(e, e?.amount), e?.rolled)}.` : "Second wind: you were already at full hp.",
    tone: "hit",
    priority: PRIORITY.you,
  }),
  swept: (e) => ({ text: `One wide arc — ${e?.dmg ?? 0} to everything standing.`, tone: "hit", priority: PRIORITY.feature }),
  sweptFoe: (e) => ({ text: `${e?.target ?? "It"} takes ${e?.dmg ?? 0}.`, tone: "hit", priority: PRIORITY.them }),
  braced: (e) => ({
    text: `${e?.member ? `${e.member}: ` : ""}Braced. The next blow that lands on ${e?.member ? "them" : "you"} does half damage.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  braceHeld: (e) => ({
    text: `${e?.member ? `${e.member}: ` : ""}Braced — ${railPossessive(e?.name, "the")} blow lands half as hard${Number.isFinite(e?.soaked) ? `, ${e.soaked} hp lighter` : ""}.`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  riposteReady: (e) => ({
    text: `${e?.member ? `${e.member}: ` : ""}For one round every foe that misses ${e?.member ? "them" : "you"} takes ${e?.member ? "their" : "your"} weapon's damage.`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  riposted: (e) => ({ text: `${e?.target ?? "It"} misses, and pays ${e?.dmg ?? 0} for it.`, tone: "hit", priority: PRIORITY.them }),
  taunted: (e) => ({
    text: e?.member ? `${e.member}: Every foe swings at them this round.` : "Every foe looks at you. Armour doubles.",
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  lastStandCalled: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Under a quarter. ${e?.attacks ?? 3} attacks this round.`, tone: "beat", priority: PRIORITY.feature }),
  dirtyTrickLanded: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} is blinded for ${e?.rounds ?? 2} rounds.`, tone: "hit", priority: PRIORITY.them }),
  foeSightReturned: (e) => ({ text: `${e?.name ?? "It"} blinks the sand out.`, tone: "dodge", priority: PRIORITY.them }),
  // ROLL-04 (79-04): a foe's strike die scales, so Smoke speaks in faces.
  smokeThrown: (e) => ({
    text: e?.member
      ? `${e.member}: Gone. Foes find them only on their die's top face (top two if insulted) for two rounds.`
      : "Gone. Foes find you only on their die's top face (top two if insulted) for two rounds, and a run just works.",
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  cutpursed: (e) => ({
    text: e?.member ? `${e.member} lifts ${e?.amount ?? 0} wilmst off ${e?.target ?? "it"} for you.` : `You lift ${e?.amount ?? 0} wilmst off ${e?.target ?? "it"}.`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  poisonedEdgeApplied: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} is poisoned for ${e?.rounds ?? 3} rounds.`, tone: "hit", priority: PRIORITY.them }),
  // Phase 40 (SPELL-01, Ice) — the generic-on-`by` shape now covers two
  // sources; the short form names whichever one this tick came from.
  dotTick: (e) => ({ text: `${e?.target ?? "It"} takes ${e?.dmg ?? 0} from ${e?.by === "ice" ? "the ice" : "the poison"}.`, tone: "hurt", priority: PRIORITY.them }),
  hamstrung: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} hits half as hard from here on.`, tone: "hit", priority: PRIORITY.them }),
  marked: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Every blow on ${e?.target ?? "it"} does +2 damage.`, tone: "hit", priority: PRIORITY.them }),
  // Plan 04 (ABIL-05): a Joiner's own ability use — four new member-only
  // events (no hero equivalent; a hero's own equivalent reads
  // abilityUsed/secondWindHealed/swept/riposted above).
  memberAbilityUsed: (e) => ({ text: `${e?.name ?? "Your companion"} calls ${e?.ability ?? "it"}.`, tone: "hit", priority: PRIORITY.feature }),
  memberSecondWind: (e) => ({
    text:
      railGain(e, e?.amount) > 0
        ? `${e?.name ?? "Your companion"} remembers why they came. +${railGain(e, e?.amount)} hp${railFull(railGain(e, e?.amount), e?.rolled)}.`
        : `${e?.name ?? "Your companion"} remembers why they came, already at full hp.`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  memberSwept: (e) => ({ text: `${e?.name ?? "Your companion"} sweeps — ${e?.dmg ?? 0} to everything standing.`, tone: "hit", priority: PRIORITY.them }),
  memberRiposted: (e) => ({ text: `${e?.target ?? "It"} misses ${e?.name ?? "your companion"}, and pays ${e?.dmg ?? 0} for it.`, tone: "hit", priority: PRIORITY.them }),

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => block("Nothing left to cast with."),
  spellNotKnown: (e) => block(`You do not know ${e?.spell ?? "that"}.`),
  spellAboveLevel: (e) => block(`${e?.spell ?? "That"} needs level ${e?.need ?? "?"}; you are ${e?.have ?? "?"}.`),
  // VOX-05 (Phase 79, plan 79-08): why, like spellAboveLevel.
  // Phase 90 plan 06 (SPELL-10): `e.forbidden` — a school the sub-class can never learn.
  spellSchoolLocked: (e) =>
    block(
      e?.forbidden
        ? `${e?.spell ?? "That"} is from a school you will never open.`
        : Number.isFinite(e?.need)
          ? `${e?.spell ? `${e.spell}'s school` : "That school"} opens to you at level ${e.need}; you are ${e?.have ?? "?"}.`
          : `${e?.spell ?? "That"} is not open to you yet.`,
    ),
  // Phase 31 (CMB-01/CMB-02): the NEW spell-refusal circumstances this phase
  // introduces (notFought/combatOnly/exploreOnly/noTarget) — never a `frozen`
  // reason; nothing is ever refused for fear.
  castRefused: (e) => {
    const map = {
      notFought: "Fight! first. The spell keeps.",
      combatOnly: `${e?.spell ?? "That"} wants a target. Save it for a fight.`,
      // VOX-05 (Phase 79, plan 79-08): the reason, in the player's terms.
      exploreOnly: `${e?.spell ?? "That"} only works out of a fight.`,
      noTarget: "Nothing left to aim at.",
    };
    return block(map[e?.reason] ?? "The spell refuses you.");
  },
  // Phase 31 (CMB-01): the generic action-refusal vocabulary (sing/drinkPotion).
  actionRefused: (e) => {
    const map = {
      notFought: "Fight! first.",
      cooldown: `Your voice needs ${e?.left ?? "more"} more squares.`,
      wrongClass: "Only a Bard sings here.",
      // RULES-10 (Phase 75.1): loseTurn with no C.heroOut to spend.
      notOut: "There is no turn to lose.",
    };
    return block(map[e?.reason] ?? "Not now.");
  },
  spellBackfired: (e) => ({ text: `${e?.spell ?? "The spell"} goes wrong.`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  backfireSelfDamage: (e) => ({ text: `Backfire: ${e?.spell ?? "The spell"} (−${e?.amount ?? 0} hp).`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 25 (25-03): no trailing period — matches the aggregate-format
  // convention (struckByFoe/foeMissed/struck etc. carry none either) so a
  // resisted-spell line reads consistently with the rest of the pipeline.
  // Quick 260927-rsx: the rail twins name the spell and whose it was.
  // User ruling 2026-09-28: a Freeze's resist (`freeze: true`) comes after
  // its damage and stops only the ice.
  spellResisted: (e) => ({
    text: e?.freeze
      ? `${e?.target ?? "It"} resists the freeze: the damage lands, the ice doesn't`
      : `${e?.target ?? "It"} resists ${e?.by && e.by !== "you" ? `${e.by}'s` : "your"} ${e?.spell ?? "spell"}: no effect`,
    tone: "miss",
    priority: PRIORITY.you,
  }),
  resistFailed: (e) => ({ text: `${e?.target ?? "It"} fails to resist ${e?.by && e.by !== "you" ? `${e.by}'s` : "your"} ${e?.spell ?? "spell"}.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  summonBackfired: (e) => ({ text: `Summoning: ${e?.spell ?? "The spell"} turned on you (−${e?.amount ?? 0} hp).`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 90 plan 06 (SPELL-12): the lesser variant went with Lesser Summon.
  allySummoned: (e) => ({ text: `${e?.name ?? "Something"} answers the call.`, tone: "magic", priority: PRIORITY.you }),
  allyPending: (e) => ({ text: `${e?.name ?? "Something"} is coming.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-01, Weaken): the rounds count, when the payload carries one.
  // VOX-05 (Phase 79, plan 79-08): what Weaken does, and "(3)" now says rounds.
  weakened: (e) => ({
    // Quick 260927-rsx: `spared` counts the foes that resisted the cast.
    text: `${e?.spared ? `Every foe but ${e.spared === 1 ? "one" : e.spared} weakened` : "Every foe weakened"}${e?.rounds ? `, ${railPlural(e.rounds, "round")}` : ""}: top three faces to hit, half damage.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // Phase 40 (SPELL-01) — combat.js#foeTurn's `spell:weaken` expiry.
  weakenFaded: () => ({ text: "Their arms remember how to swing.", tone: "magic", priority: PRIORITY.you }),
  // Phase 90 plan 04 (SPELL-12): the intelligence it had and the 1 it has now
  // (foeStupefied, the per-turn skip line, is gone: a stupid foe keeps acting).
  stupefied: (e) => ({
    text: e?.was === 1 ? `${e?.target ?? "It"} was at intelligence 1 already, and stays there for the fight.` : `${e?.target ?? "It"} forgets most of it: ${Number.isFinite(e?.was) ? `intelligence ${e.was} down to 1` : "intelligence down to 1"} for the fight.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // VOX-05 (Phase 79, plan 79-08): what blindness does. Phase 90 plan 04
  // (SPELL-12): for the fight at every depth, and never a critical.
  blinded: (e) => ({
    text: `${e?.target ?? "It"} is blind for the fight: it hits only on its top face and never crits.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // VOX-05 (Phase 79, plan 79-08): who and what.
  shrunk: (e) => ({
    text: (e?.count ?? 0) > 0 ? `${e.count === 1 ? "1 foe shrinks" : `${e.count} foes shrink`}: half hp, half damage.` : "Nobody shrinks.",
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // VOX-05 (Phase 79, plan 79-08): "(3)" now says rounds.
  acidApplied: (e) => ({ text: `${e?.target ?? "It"} starts to dissolve, ${railPlural(e?.rounds ?? 0, "round")}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 90 plan 05 (SPELL-12, Q5 A): the rail twin of the Oracle's iceCast.
  iceCast: (e) => ({ text: `${joinerOf(e) ? `${joinerOf(e)}'s ` : ""}${e?.spell ?? "Ice"} sweeps the room: a d10 plus level² each, survivors may freeze.`, tone: "magic", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-08): the number is damage to every foe.
  earthquake: (e) => ({ text: `The floor heaves: ${e?.amount ?? 0} to every foe.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  earthquakeSelfDamage: (e) => ({ text: `Earthquake: −${e?.amount ?? 0} hp, yours too.`, tone: "hurt", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-08): what the face does, twin of the Oracle line.
  vaporRolled: (e) => ({
    text:
      e?.roll === 4
        ? "Noxious vapor (4): every foe drops, unless its d10 shows a 1."
        : Number.isFinite(e?.roll)
          ? `Noxious vapor (${e.roll}): every foe sleeps, d6+2 rounds.`
          : "Noxious vapor (?).",
    tone: "magic",
    priority: PRIORITY.other,
  }),
  volley: (e) => ({ text: `${e?.rolls ?? 0} shots, ${e?.totalDamage ?? 0} total.`, tone: "magic", priority: PRIORITY.you }),
  petrified: (e) => ({ text: `${e?.target ?? "It"} turns to stone and dies. No spoils from a statue.`, tone: "magic", priority: PRIORITY.you }),
  walkingDeadTurned: (e) => ({ text: `${e?.count ?? 0} of the dead flee.`, tone: "magic", priority: PRIORITY.you }),
  nothingToTurn: () => block("Nothing here to turn."),
  planeGated: (e) => ({ text: `${e?.count ?? 0} gated straight back out.`, tone: "magic", priority: PRIORITY.you }),
  gateRefused: () => block("There is no plane here worth opening."),
  // VOX-05 (Phase 79, plan 79-08): what the sharpening does, and for how long.
  sensesGained: () => ({ text: "Your senses sharpen: no surprises, no penalty in the dark, till your next fight ends.", tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-05, Plan 04): see eventNarration.js's matching comment —
  // floorMapped/revealFaded replace the old retired permanent reveal event.
  // Plan 76-06 (user ruling 2026-09-26): until you move; no squares count.
  floorMapped: () => ({ text: "The floor lays itself out in your head. Don't move.", tone: "magic", priority: PRIORITY.you }),
  revealFaded: () => ({ text: "You moved. Focus lost; the map forgets.", tone: "beat", priority: PRIORITY.other }),
  senseDanger: (e) => ({ text: `Bad feeling about the ${e?.nextEncounter ?? "next encounter"}.`, tone: "magic", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-08): what the image does, and "(3)" now says rounds.
  mirrorSelf: (e) => ({
    text: `A mirror image holds, ${railPlural(e?.rounds ?? 0, "round")}: foes hit you only on their top face.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // RULES-14 (Phase 75): the rail twin of eventNarration.js's own
  // mirror-aware wardRaised line.
  wardRaised: (e) => ({
    // VOX-05 (Phase 79, plan 79-08): the pool is hp of damage it soaks.
    text: e?.mirror ? "A bubble shimmers around you. Next hit bounces back." : `${e?.spell ?? "A spell"} raises a ward: it soaks the next ${e?.pool ?? 0} hp.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // Phase 90 (SPELL-09, report #8): the rail twin of the Oracle's strengthCast.
  strengthCast: (e) => ({
    text: e?.restarted
      ? `Strength starts over: ${railSquares(e?.squares ?? 100)}, not double.`
      : `Might surges: an extra d10 on every damage roll for ${railSquares(e?.squares ?? 100)}. No extra HP.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // Phase 90 plan 07 (SPELL-10): the rail twin of the Oracle's spellEffectStarted:
  // the rule and the window, short; a recast says it starts over; a kind with no
  // row names the spell and the window; a bare payload never prints "undefined".
  spellEffectStarted: (e) => {
    const sq = railSquares(e?.squares);
    const text = {
      unlock: e?.restarted ? `Open/Lock starts over: ${sq} to find a chest, no lock roll.` : `Open/Lock: your next chest within ${sq} opens with no lock roll.`,
      fly: e?.restarted ? `Fly starts over: ${sq} of flight, not double.` : `Fly: ${sq} of flight. Walls and crevices are scenery; water costs one.`,
      enchant: e?.restarted ? `Enchant Character starts over: ${sq}, not double.` : `Enchant Character: ${sq} of +2 to hit, foes −2 to hit you, no crits on you.`,
      haste: e?.restarted ? `Speed of Sound starts over: ${sq}, not double.` : `Speed of Sound: ${sq} of two blows a swing and the first move.`,
    }[e?.kind];
    return { text: text ?? `${e?.spell ?? "The spell"} takes hold for ${sq}.`, tone: "magic", priority: PRIORITY.you };
  },
  // Phase 90 (SPELL-09): the rail twin of the Oracle's spellEffectFaded; a kind
  // with no clause just wears off, a bare payload never prints "undefined".
  spellEffectFaded: (e) => {
    const owner = e?.member ? `${e.member}'s` : "Your";
    // Phase 90 plan 07 (SPELL-10): the four Special spells' clauses.
    const what = {
      strength: "damage is back to plain dice",
      unlock: "the charm fades unused",
      fly: "you land",
      enchant: "the enchantment is gone",
      haste: "back to one swing",
    }[e?.kind];
    return {
      text: !e?.spell ? "The spell wears off." : what ? `${owner} ${e.spell} wears off: ${what}.` : `${owner} ${e.spell} wears off.`,
      tone: "beat",
      priority: PRIORITY.other,
    };
  },
  regenerationCast: () => ({ text: "Wounds start closing on their own.", tone: "magic", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-08): reads naturally; the face says what it did.
  insaneNoTarget: () => block("No one here to drive insane."),
  insaneRolled: (e) => ({
    text: `Insanity takes ${e?.target ?? "it"}${{ 1: " (1): it keels over", 4: " (4): it tries to nap, d4 rounds", 5: " (5): frenzy, twice the swings" }[e?.roll] ?? ""}.`,
    tone: "magic",
    priority: PRIORITY.other,
  }),
  insaneStruckAlly: (e) => ({ text: `The maddened thing turns on ${e?.target ?? "an ally"} (${e?.dmg ?? 0}).`, tone: "hurt", priority: PRIORITY.you }),
  insaneFled: (e) => ({ text: `${e?.target ?? "It"} bolts, mad with fear.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 90 plan 08 (SPELL-10): the rail twins of the control-spell lines in eventNarration.js.
  timeStopped: (e) => ({
    text: (e?.count ?? 0) > 0 ? `${joinerOf(e) ? `${joinerOf(e)}'s Stop Time: ` : ""}Time stops for ${e.count === 1 ? "1 foe" : `${e.count} foes`}, ${railPlural(e?.rounds ?? 0, "round")}.` : "Time declines to stop for anyone.",
    tone: (e?.count ?? 0) > 0 ? "magic" : "miss",
    priority: PRIORITY.you,
  }),
  foeMisdirected: (e) => ({
    text: e?.at === "self"
      ? `${joinerOf(e) ? `${joinerOf(e)}'s Duplicate Foe: ` : ""}${e?.target ?? "It"} fights its double, ${railPlural(e?.rounds ?? 0, "round")}.`
      : `${joinerOf(e) ? `${joinerOf(e)}'s Senseless: ` : ""}${e?.target ?? "It"} is senseless, ${railPlural(e?.rounds ?? 0, "round")}: it swings at its own side.`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  foeMisdirectedHit: (e) => ({ text: `${e?.name ?? "It"} hits ${e?.self ? "itself" : (e?.target ?? "its friend")} (${e?.dmg ?? 0}).`, tone: "hit", priority: PRIORITY.them }),
  foeMisdirectedMiss: (e) => ({ text: `${e?.name ?? "It"} misses ${e?.self ? "itself" : (e?.target ?? "its friend")}.`, tone: "dodge", priority: PRIORITY.them }),
  foeSwingsAtAir: (e) => ({ text: `${e?.name ?? "It"} swings at the air.`, tone: "dodge", priority: PRIORITY.them }),
  foeMisdirectEnded: (e) => ({ text: `${e?.name ?? "It"} is itself again.`, tone: "hurt", priority: PRIORITY.them }),
  healed: (e) => ({
    text:
      railGain(e, e?.amount) > 0
        ? `+${railGain(e, e?.amount)} hp${e?.spell ? ` (${e.spell})` : ""}${railFull(railGain(e, e?.amount), e?.amount)}.`
        : `${e?.spell ?? "Healing"}: you were already at full hp.`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  // Phase 89 (ITEM-01, ITEM-06): the rail twin of the Oracle's partyHealed, one
  // short line naming every body healed. A minor event, never a decision card
  // (not a CARD_EVENTS type).
  partyHealed: (e) => {
    const heals = Array.isArray(e?.heals) ? e.heals : [];
    const item = typeof e?.item === "string" && e.item ? e.item : "Staff";
    const parts = heals.map((h) => {
      const who = h?.hero ? "you" : h?.name || "someone";
      const g = railGain(h, h?.amount);
      return g > 0 ? `${who} +${g}` : `${who} already full`;
    });
    return { text: parts.length ? `${item}: ${parts.join(", ")} HP.` : `${item}: no one to heal.`, tone: "hit", priority: PRIORITY.you };
  },
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-08): the hp it needs (refused at fee + 1 or less).
  deathSpellTooWeak: (e) => block(`Death: ${e?.fee ?? 25} hp fee. You need at least ${(e?.fee ?? 25) + 2} hp to pay it.`),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathCast: (e) => ({ text: `Death: its fee (−${e?.cost ?? 25} hp).`, tone: "hurt", priority: PRIORITY.you }),
  // VOX-05 (Phase 79, plan 79-08): "(3)" now says rounds.
  // Phase 90 plan 05 (SPELL-11): a hit wakes it; a Joiner's Doze names the Joiner.
  dozed: (e) => ({ text: `${joinerOf(e) ? `${joinerOf(e)}'s Doze: ` : ""}${e?.target ?? "It"} dozes off, ${railPlural(e?.rounds ?? 0, "round")}. A hit wakes it.`, tone: "magic", priority: PRIORITY.you }),
  dozeFailed: (e) => ({ text: `Nobody dozes off${joinerOf(e) ? ` (${joinerOf(e)}'s ${e?.spell ?? "Doze"})` : ""}.`, tone: "miss", priority: PRIORITY.you }),
  foeWoke: (e) => ({ text: `${e?.target ?? "It"} wakes up${joinerOf(e) ? `, courtesy of ${joinerOf(e)}` : ""}.`, tone: "hit", priority: PRIORITY.you }),
  nothingToThrowAt: () => block("Nothing here to throw it at."),
  spellThrown: (e) => ({ text: `${e?.spell ?? "It"} at ${e?.target ?? "it"}.`, tone: "magic", priority: PRIORITY.you }),
  spellHit: (e) => ({
    // Quick 260928-sq2: the damage is the roll + level² (`levelSq`), already inside the number.
    text: `${e?.spell ?? "It"} hits ${e?.target ?? "it"} (${e?.dmg ?? 0}${(e?.levelSq ?? 0) > 1 ? `, the roll +${e.levelSq} for your level` : ""})`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  // RULES-18 (Phase 75.3, Plan 04): the four control-at-depth events' rail
  // twins of eventNarration.js's own lines — the SAME word maps, kept as a
  // short local copy here (this module never imports from eventNarration.js;
  // see its own no-cycle discipline note near the top of this file).
  controlResisted: (e) => ({
    text: `${e?.target ?? "It"} shrugs off ${{ freeze: "the frost", stone: "the stone", sleep: "the sleep", weaken: "the weakening", stupid: "the stupidity", blind: "the blindness", shrink: "the shrinking" }[e?.effect] ?? "the effect"}.`,
    tone: "miss",
    priority: PRIORITY.them,
  }),
  // User rulings 2026-09-28: a Freeze's d4 hold (`freeze: true`) reads
  // "frozen for N rounds" (spellChain folds it onto the hero's hit line).
  controlHeld: (e) => ({
    text: e?.kind === "stunned"
      ? `${joinerOf(e) ? `${joinerOf(e)}'s Stun: ` : ""}${e?.target ?? "It"} stunned for ${Number.isFinite(e?.rounds) ? railPlural(e.rounds, "round") : "? rounds"}; a hit will not end it.`
      : e?.kind === "time"
      ? `${e?.target ?? "It"} stopped for ${Number.isFinite(e?.rounds) ? railPlural(e.rounds, "round") : "? rounds"}; a hit will not start time again.`
      : e?.freeze
      ? `${e?.target ?? "It"} frozen for ${Number.isFinite(e?.rounds) ? railPlural(e.rounds, "round") : "? rounds"}.`
      : `${e?.target ?? "It"} held ${Number.isFinite(e?.rounds) ? railPlural(e.rounds, "round") : "? rounds"}.`,
    tone: "magic",
    priority: PRIORITY.them,
  }),
  foeStillHeld: (e) => ({ text: `${e?.name ?? "It"} still ${e?.kind === "time" ? "stopped" : "held"} (${e?.left ?? "?"}).`, tone: "dodge", priority: PRIORITY.them }),
  foeHoldBroken: (e) => ({ text: e?.kind === "time" ? `Time starts again for ${e?.name ?? "it"}.` : `${e?.name ?? "It"} breaks free.`, tone: "hurt", priority: PRIORITY.them }),
  spellMissed: (e) => ({ text: `${e?.spell ?? "It"} misses ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  // Phase 25 (FEED-01): `doubled` names the heal2x race when the dose was doubled.
  potionDrunk: (e) => ({
    text:
      railGain(e, e?.amount) > 0
        ? `Potion +${railGain(e, e?.amount)} hp${railFull(railGain(e, e?.amount), e?.amount)} (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`
        : `Potion: you were already at full hp (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  // Phase 89 (ITEM-07): a Joiner drinks one of its OWN potions; the rail twin of
  // the Oracle's memberPotionDrunk (the Joiner named, the hp actually gained).
  memberPotionDrunk: (e) => ({
    text:
      railGain(e, e?.amount) > 0
        ? `${e?.member ?? "Your companion"} drinks a potion: +${railGain(e, e?.amount)} hp${railFull(railGain(e, e?.amount), e?.amount)} (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`
        : `${e?.member ?? "Your companion"} drinks a potion and was already at full hp (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  scrollRead: (e) => ({ text: `You unroll: ${e?.spell ?? "something unreadable"}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 25 (FEED-02): a scroll refusal always names its reason; unknown/
  // absent reason still gets a voiced fallback. RULES-10 (Phase 75.1):
  // "pilfer"/"noRunes" are retired — canRead is gone, and that reader now
  // READS (scrollDeciphered/scrollGarbled/scrollFumbled below), never
  // refuses.
  scrollRefused: (e) => {
    const map = {
      noScrolls: "You have no scroll to read.",
      // Phase 31 (CMB-01): Fight! not yet pressed.
      notFought: "Fight! first. The scroll will keep.",
    };
    return block(map[e?.reason] ?? "It stays rolled.");
  },
  scrollCopiedToGrimoire: (e) => ({ text: `${e?.spell ?? "It"} copied into your grimoire.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-07): the scroll's own spell isn't scribable yet; the
  // scroll still casts once for free right after. CMBUI-11 (Phase 77): a
  // plain copy note, never "needs level N; you are M" (the cast succeeded).
  // Directly followed by its scrollCast, scrollCopyChain folds the two into
  // one cast-then-note line; this builder is the standalone fallback only.
  scrollTooAdvanced: (e) => ({ text: `${e?.spell ?? "It"}: too advanced to copy into your book.`, tone: "magic", priority: PRIORITY.you }),
  scrollCast: (e) => ({ text: `The scroll casts: ${e?.spell ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),
  // RULES-10 (Phase 75.1) — an "intel" reader's own d20. scrollDeciphered
  // reads like heroResisted (roll vs range, intel); scrollGarbled never
  // names the spell and never reads as a refusal; scrollFumbled names the
  // spell and the fumble band via bottomRangeText.
  scrollDeciphered: (e) => ({ text: `You puzzle it out (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, intel ${e?.intel ?? "?"}).`, tone: "magic", priority: PRIORITY.you }),
  scrollGarbled: (e) => ({ text: `You squint at runes you can't make out (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}). Crumbles.`, tone: "miss", priority: PRIORITY.you }),
  scrollFumbled: (e) => ({
    text: `You read ${e?.spell ?? "the spell"} wrong (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}, fumble ${bottomRangeText(e?.fumbleAtLeast)}).${e?.fizzled ? " Fizzles — dust." : ""}`,
    tone: "hurt",
    priority: PRIORITY.you,
  }),

  /* ---------------- economy.js ---------------- */

  storeOpened: (e) => {
    let text = "Shop open.";
    let tone = "beat";
    if (e?.pickpocket) {
      text += " · Pickpocket: buys ×1.25, sells ×0.75";
      tone = "block";
    } else if (e?.troll) {
      text += " (Trolls pay triple)";
    } else if (e?.elfOrDwarf) {
      // VOX-05 (Phase 79, plan 79-11): the discount says how much (priceFor: half).
      text += " (half price, as always)";
    }
    return { text, tone, priority: PRIORITY.feature };
  },
  // Phase 89 plan 08 (ITEM-06, Q4): the Joiner repair refusals, rail twins of
  // the Oracle lines (a Joiner who left, or armour with nothing left to mend).
  buyFailed: (e) =>
    e?.reason === "repairGone"
      ? block(`${e?.name ?? "Someone"} has left the party. No charge.`)
      : e?.reason === "nothingToMend"
        ? block(`${e?.name ? `${e.name}'s` : "That"} armour needs no mending. No charge.`)
        : block(`Short ${e?.short ?? 0} wilmst.`),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-02): a store meal adds the HP it really restored.
  bought: (e) => ({
    text: `Bought: ${e?.item ?? "something"} (−${e?.cost ?? 0} wilmst).${
      !Number.isFinite(e?.gained) ? "" : e.gained > 0 ? ` +${e.gained} hp${railFull(e.gained, e?.meal)}.` : " You were already at full hp."
    }`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  // Phase 61 (STORE-02/STORE-03): a legal not-better buy — charged and
  // bagged, never lost. Same priority as `bought` so the fold keeps engine
  // order: "Bought: … (−N wilmst)." then "Into the bag: … — not an upgrade:
  // …". `why` reuses Plan 02's upgradeWhyText/gearCompareParts formatter
  // (returns "" for a non-parts `e?.why`, e.g. the voice-scan BASE_EVENT
  // string shape — no explanation clause is added then).
  purchaseBagged: (e) => {
    const why = upgradeWhyText(e?.why);
    return { text: `Into the bag: ${e?.item?.n ?? "something"} — not an upgrade${why ? `: ${why}` : ""}.`, tone: "beat", priority: PRIORITY.other };
  },
  // VOX-05 (Phase 79, plan 79-11): "+1 ration", never "+1 rations".
  rationsBought: (e) => ({ text: `Stocked up: +${railPlural(e?.amount ?? 1, "ration")}.`, tone: "hit", priority: PRIORITY.other }),
  // STORE-04 (Phase 87): the last ration of a store's d10 stock, and the pack-cap refusal.
  rationsSoldOut: () => ({ text: "Shelf's bare: that was the last ration.", tone: "beat", priority: PRIORITY.other }),
  rationsFull: (e) => block(`Pack full: ${e?.have ?? 0}/${e?.cap ?? 0} rations.`),
  itemSold: (e) => ({ text: `Sold:${e?.item?.n ?? "something"} (${e?.price ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),

  /* ---------------- encounters.js ---------------- */

  // Phase 25.1 (DFB-01): tableFour/tableFourNoop left ORACLE_ONLY once the
  // "Move on" card is gated to CARD_EVENTS — the over-map overlay no longer
  // narrates these on the move path, so they need their own line. `result`
  // is already a full prose sentence (engine/encounters.js#tableFour).
  // VOX-05 (Phase 79, plan 79-02, todo 2026-09-26): the prose, then the
  // signed amount the row actually made — the same number as the Oracle.
  tableFour: (e) => ({ text: `${e?.result ?? "Something happens."}${railTableFourTail(e)}`, tone: "beat", priority: PRIORITY.other }),
  tableFourNoop: (e) => ({ text: e?.result ?? "Nothing much happens.", tone: "beat", priority: PRIORITY.other }),
  // Phase 73 (ROLL-05): the roll-high triple, via rollVsText.
  trapAvoided: (e) => ({ text: `You clock it early (${rollVsText(e?.roll, e?.atLeast, e?.dieN)}).`, tone: "hit", priority: PRIORITY.other }),
  trapDisarmed: () => ({ text: "Pilfer: trap disarmed.", tone: "hit", priority: PRIORITY.feature }),
  trapDoubled: () => ({ text: "Cat Burglar: the trap hits twice as hard.", tone: "hurt", priority: PRIORITY.feature }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapSprung: (e) => ({ text: `Trap: ${e?.name ?? "A trap"} (−${e?.dmg ?? 0} hp).`, tone: "hurt", priority: PRIORITY.them }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapPoisoned: () => ({ text: "Trap: poisoned.", tone: "hurt", priority: PRIORITY.other }),
  chestOpened: (e) => ({
    // Phase 90 plan 07 (SPELL-10): a live Open/Lock spent on this chest.
    text: e?.reason === "pilfer" ? "Pilfer: box open, no lock roll." : e?.reason === "openLock" ? "Open/Lock: box open, no lock roll." : "The box gives up its secrets.",
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  // Phase 73 (ROLL-05): the roll-high triple, via rollVsText.
  chestLockRolled: (e) => ({ text: `Lock: ${rollVsText(e?.roll, e?.atLeast, e?.dieN)}`, tone: "beat", priority: PRIORITY.other }),
  // VOX-05 (Phase 79, plan 79-11): one try per chest; the box stays shut.
  chestLocked: () => ({ text: "The lock holds. The box stays shut for good.", tone: "miss", priority: PRIORITY.other }),
  scrollFound: () => ({ text: "A scroll, tucked in with the loot.", tone: "hit", priority: PRIORITY.other }),
  foodFound: (e) => ({
    text: railGain(e, e?.wp) > 0 ? `${e?.name ?? "Food"} (+${railGain(e, e?.wp)} hp${railFull(railGain(e, e?.wp), e?.wp)}).` : `${e?.name ?? "Food"}: you were already at full hp.`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  grimoireLearned: (e) => ({ text: `New spells: ${(e?.spells ?? []).join(", ") || "nothing new"}.`, tone: "hit", priority: PRIORITY.other }),
  faerieBoon: (e) => ({ text: `+${railGain(e, e?.amount)} base hp.`, tone: "hit", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  faerieBane: (e) => ({ text: `Faerie: −${e?.amount ?? 0} base hp.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 89 (ITEM-07): `wore` (what it put on from its bag) and `scroll` (a
  // Magic User's starting scroll: the spell it copied, or null for one spent on
  // nothing) are additive clauses; absent, the line is byte-identical.
  joinerJoined: (e) => ({
    text: `${e?.name ?? "Someone"} falls in beside you.${
      Array.isArray(e?.wore) && e.wore.length ? ` Wears ${e.wore.join(" and ")}.` : ""
    }${
      typeof e?.scroll === "string" ? ` Reads its scroll: ${e.scroll} is in its book.` : e?.scroll === null ? " Its scroll held nothing it could learn." : ""
    }`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  // Phase 25.1 (DFB-04): fallback/coverage table text — on the resolveJoiner
  // action the narrative ctx (NARRATIVE_ACTIONS) replaces this with the
  // snark exit sentence from EVENT_NARRATION.joinerLeft instead.
  joinerLeft: (e) => ({ text: `${e?.name ?? "Your companion"} walks. ${e?.replacedBy ?? "Someone new"} is in.`, tone: "beat", priority: PRIORITY.feature }),
  // Phase 36 (CUT-02): fallback/coverage text — on the move action the
  // narrative ctx replaces it with the EVENT_NARRATION line.
  // Phase 43 (CLAR-01): cause first — see docs/CLARITY.md
  joinerMurdered: (e) => ({ text: `Cutthroat: ${e?.name ?? "Your companion"} did not reach floor ${e?.depth ?? "?"}.`, tone: "hurt", priority: PRIORITY.feature }),
  // Phase 36 (JOIN-01): fallback/coverage text — on the dismissJoiner action
  // the narrative ctx (NARRATIVE_ACTIONS) replaces this with the
  // EVENT_NARRATION parting line instead.
  joinerDismissed: (e) => ({ text: `${e?.name ?? "Your companion"} walks. The slot is yours again.`, tone: "beat", priority: PRIORITY.feature }),
  dismissRefused: (e) => {
    const map = { noParty: "Nobody is travelling with you.", inCombat: "Not in the middle of a fight.", badIndex: "Nobody by that count." };
    return block(map[e?.reason] ?? "Nobody to dismiss.");
  },
  joinerDeclined: (e) => ({ text: `You wave ${e?.name ?? "them"} off.`, tone: "beat", priority: PRIORITY.feature }),
  joinerRefused: (e) => {
    const map = {
      // VOX-05 (Phase 79, plan 79-11): the refusal names why (a Magic User
      // will not travel with a Wilmsry), as the Oracle twin does.
      wilmsry: `${e?.name ?? "The Joiner"}, a Magic User, takes one look at a Wilmsry and leaves.`,
    };
    return block(map[e?.reason] ?? "Word has reached the Joiners.");
  },
  // RULES-07 (Phase 75): the rail twin of eventNarration.js's afflictionRolled
  // — a mind row (5-6) says so instead of "Disease.".
  afflictionRolled: (e) => {
    const row = AFFLICTIONS[(e?.roll ?? 0) - 1];
    const kind = row?.phobia ? "not your body — your nerve" : (e?.kind ?? "it has its hooks in you");
    return { text: `Something is wrong with you: ${kind}.`, tone: "hurt", priority: PRIORITY.other };
  },
  phobiaAcquired: (e) => ({ text: `New fear: ${e?.name ?? "something"}.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  afflictionCaught: (e) => ({ text: `${e?.kind ?? "It"}: takes hold (−${e?.first ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  // VOX-05 (Phase 79, plan 79-11): the hero's insanity, as on the Oracle twin
  // (the table's foe-side row is no longer printed); faces 2, 4 and 6 do nothing.
  insanityRolled: (e) => ({
    text: `Insanity takes hold of you${e?.roll === 2 || e?.roll === 4 || e?.roll === 6 ? ", then lets go" : ""}.`,
    tone: "hurt",
    priority: PRIORITY.other,
  }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  insanitySelfHarm: (e) => ({ text: `Insanity: you turn on yourself (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  // VOX-05 (Phase 79, plan 79-11): might is damage, until the day ends.
  insanityRage: (e) => ({ text: `Rage: +${e?.amount ?? 0} damage on every blow until the day ends.`, tone: "hurt", priority: PRIORITY.other }),
  // VOX-05 (Phase 79, plan 79-11): how long, and Night Vision's waiver.
  darknessFell: (e) => ({
    text: `The dark closes in${Number.isFinite(e?.duration) ? ` for ${railPlural(e.duration, "square")}` : ""}.${e?.nightVision ? " Night Vision sees through it." : ""}`,
    tone: "hurt",
    priority: PRIORITY.other,
  }),
  darknessLifted: () => ({ text: "The dark loosens its grip.", tone: "hit", priority: PRIORITY.other }),
  darknessDispelled: () => ({ text: "Your amulet burns the dark away.", tone: "hit", priority: PRIORITY.other }),
  // Phase 39 (GEAR-05): the torch — lights a live darkness (torchLit) and
  // holds off a LATER Darkness result entirely (darknessResisted), sharing
  // itemEffectStarted's `other` tone family below.
  torchLit: () => ({ text: "You light the torch. The dark files a complaint.", tone: "hit", priority: PRIORITY.you }),
  darknessResisted: () => ({ text: "Darkness tries. Your torch declines.", tone: "hit", priority: PRIORITY.other }),
  miscMagicRolled: (e) => ({ text: `Miscellaneous magic: ${e?.what ?? "something"}.`, tone: "beat", priority: PRIORITY.other }),

  /* ---------------- items.js / inventory actions ---------------- */

  itemGiven: (e) => ({ text: `Received: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.other }),
  // Phase 24/25: woodsman and acrobat each get their own reason; the generic
  // fallback covers wrongClass/notBetter/noArmor/tooHeavy/notEquippable.
  itemRejected: (e) => block(equipRejectText(e)),
  // Phase 61 (STORE-02): an additive `replaced` (the traded-in weapon/armor
  // piece) appends one clause; the no-replaced text stays byte-identical.
  // RULES-08 (Phase 75): an additive `destroyed`/`discarded` names the
  // outgoing piece as gone, mirroring eventNarration.js's Oracle pair.
  itemTaken: (e) => ({
    text: `Equipped: ${e?.item?.n ?? "something"}.${
      e?.destroyed && e?.discarded?.n
        ? ` ${e.discarded.n} was already destroyed — gone, not kept.`
        : e?.replaced?.n
          ? ` The shopkeeper keeps your old ${e.replaced.n}.`
          : ""
    }`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  // Phase 39 (GEAR-05): the hazard-tool spend — the card's other button
  // (USE LADDER/USE ROPE); hazardChoice itself is SILENT (ORACLE_ONLY
  // above) — the card IS the UI, this line narrates the outcome.
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  toolUsed: (e) => ({
    text: e?.tool === "ladder" ? "Ladder: over the wall, ladder spent." : "Rope: across, rope spent.",
    tone: "hit",
    priority: PRIORITY.you,
  }),
  // Phase 78 (CLIMB-02): TURN BACK on the pre-roll card — a minor event, so
  // a rail line (never a decision card): nothing was rolled or spent.
  turnedBack: (e) => ({
    text: e?.feat === "gorge" ? "You back away from the crevice. Nothing rolled, nothing lost." : "You leave the wall alone. Nothing rolled, nothing lost.",
    tone: "beat",
    priority: PRIORITY.other,
  }),
  toolRefused: (e) => {
    const map = {
      noTool: `No ${e?.tool ?? "tool"} on you. Wishing is not a tool.`,
      noHazard: `Nothing here for a ${e?.tool ?? "tool"}.`,
      unknown: "That is not a tool.",
    };
    return block(map[e?.reason] ?? "That does not work here.");
  },
  itemUsed: (e) => ({ text: e?.member ? `${e.member} uses ${e?.item?.n ?? "something"}.` : `You use ${e?.item?.n ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 31 (CMB-02/CMB-03/CMB-01): extends the pilfer-only reason map with
  // cooldown/wrongClass/combatOnly/exploreOnly/noTarget/notFought — the
  // pilfer text and the generic fallback stay byte-identical.
  // Phase 39 (GEAR-02): cooldown's wording moved to the vending-machine line;
  // a NEW "recharging" reason (an empty staff) gets its own line.
  useRefused: (e) => {
    const item = e?.item?.n ?? "That";
    // Phase 89 (ITEM-07): the Company panel's USE on a Joiner: one line per
    // reason, the Joiner named. leaderOnly is ruling Q2 (docs/ITEM-AUDIT.md).
    if (e?.reason === "noMember") return block("No such companion. The party is smaller than the menu thought.");
    if (e?.member) {
      const m = e.member;
      const own = `${m}'s`;
      const memberMap = {
        inCombat: `${m} is in a fight. Joiners use their things on their own turns.`,
        noPotions: `${m} has no potions. An empty pack is a poor remedy.`,
        fullHealth: `${m} is already at full hp. Save the potion for a worse day.`,
        leaderOnly: `${m} cannot use ${item}. It moves or leads the party, and that is the one in front.`,
        cooldown: `${own} ${item}: ready again in ${e?.left ?? "?"} squares. It is not a vending machine.`,
        combatOnly: `${own} ${item} wants a target. Save it for a fight.`,
      };
      // Any other reason (a Joiner never reaches one) reads as the hero's line below.
      if (memberMap[e?.reason]) return block(memberMap[e.reason]);
    }
    // RULES-09 (Phase 75.1): the Pilfer heal-only "pilfer" reason is
    // retired — its own line is pilferFumbled below.
    const map = {
      // VOX-05 (Phase 79, plan 79-11): the count is time until it is ready.
      cooldown: `${item}: ready again in ${e?.left ?? "?"} squares. It is not a vending machine.`,
      recharging: `${item}: ${e?.left ?? "?"} squares to the next charge. Patience is also a spell.`,
      wrongClass: `${item} is a stick to anyone who is not a Magic User.`,
      combatOnly: `${item} wants a target. Save it for a fight.`,
      // VOX-05 (Phase 79, plan 79-11): the rule first, as on the Oracle twin.
      exploreOnly: `${item} only works out of a fight. It needs quieter surroundings.`,
      noTarget: "Nothing left to aim at.",
      notFought: "Fight! first. It will keep.",
      // Phase 37 (GEAR-03): a cloak/jewelry/staff activatable used from the
      // BAG in the new worn-slot model — activatables must be worn to work.
      notWorn: `${item} is in your bag, doing what things in bags do: nothing. Wear it first.`,
      // RULES-13 (Phase 75, user 2026-09-25): a staff's power works only
      // while wielded — a bagged one is inert, same voice as notWorn.
      notWielded: `${item} is in your bag, doing what things in bags do: nothing. Wield it first.`,
      // Phase 39 (GEAR-05): the torch used while not dark.
      notDark: "It is not dark. Save the torch for when it is.",
      // Phase 89 plan 08 (ITEM-01, Q5): a cure potion cures only its own kind;
      // refused and kept (`need` the kind it cures, `have` the kind carried).
      nothingToCure: e?.have
        ? `${item} only cures ${String(e?.need ?? "that").toLowerCase()}, not ${String(e.have).toLowerCase()}. It stays corked.`
        : `${item} only cures ${String(e?.need ?? "that").toLowerCase()}, and you have none. It stays corked.`,
    };
    return block(map[e?.reason] ?? "That does not work for you.");
  },
  // RULES-09 (Phase 75.1, user 2026-09-24/25): a Pilfer's use-activated
  // magic-item fumble — names the item and the hp lost. Never a diagnosis.
  pilferFumbled: (e) => ({ text: `${e?.member ? `${e.member}'s ` : ""}${e?.item ?? "It"} comes apart (−${e?.dmg ?? 0} hp). Dust now.`, tone: "hurt", priority: PRIORITY.you }),
  cured: (e) => ({ text: `Cured of ${e?.kind ?? "it"}.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 31 (CMB-06): one line naming every stoned foe, ahead of the
  // per-foe foeKilled lines that follow.
  // VOX-05 (Phase 79, plan 79-11): one foe "turns", two or more "turn".
  foeStoned: (e) => ({
    text: `${(e?.names ?? []).join(", ") || "It"} ${(e?.names ?? []).length > 1 ? "turn" : "turns"} to stone. Statues don't hit back.`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  itemBurned: (e) => ({ text: `${e?.total ?? 0} fire damage spread.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 39 (GEAR-02): the item activation model's four new events.
  // VOX-05 (Phase 79, plan 79-11): the Oracle twin's counts (railSquares:
  // "1 square", no "undefined squares") and its roll-high invis/unseen
  // effects (ROLL-04), in the rail's short form.
  itemEffectStarted: (e) => {
    const n = e?.left;
    const sq = railSquares(n);
    // Phase 89 (ITEM-07): a Joiner's own item effect, the Oracle twin's
    // third-person lines in the rail's short form. Leader-only kinds never
    // reach a Joiner and fall to the plain fallback.
    if (e?.member) {
      const m = e.member;
      const them = {
        haste: `double attacks for ${sq}.`,
        invis: `unseen for ${sq}: foes hit them only on their best roll (${RAIL_INVIS_RANGE}).`,
        acute: `strikes on a d6 for ${Number.isFinite(n) ? railPlural(n, "round") : "a few rounds"}.`,
        might: `+${e?.might ?? "?"} damage for ${sq}.`,
        power: `+1 damage for ${sq}.`,
        giant: e?.size ? `is one size larger for ${sq}: ${e.size}. ${signedText(e?.sizeDmg ?? 0)} damage, foes ${signedText(e?.step ?? 1)} to hit.` : `is one size larger for ${sq}.`,
        enlarge: e?.size ? `is one size larger for ${sq}: ${e.size}. ${signedText(e?.dmgTotal ?? e?.sizeDmg ?? 0)} damage, foes ${signedText(e?.step ?? 1)} to hit.` : `is one size larger for ${sq}.`,
        unseen: `unseen for ${sq}: foes ${RAIL_UNSEEN_SHIFT} to hit them.`,
        critWard: `has ${sq} with nothing critical landing on them.`,
        plate: `wears ${sq} of weightless plate.`,
        knit:
          Number.isFinite(e?.every) && Number.isFinite(e?.ticks) && e?.heal && Number.isFinite(e.heal.sides)
            ? `is knitting for ${sq}: ${railHealDice(e.heal)} hp every ${railSquares(e.every)} walked, ${e.ticks === 1 ? "once" : `${e.ticks} times`}.`
            : `is knitting for ${sq}.`,
      };
      return { text: `${m} ${them[e?.kind] ?? `has ${e?.item ?? "an item"} in effect for ${sq}.`}`, tone: "magic", priority: PRIORITY.you };
    }
    const map = {
      haste: `Double attacks for ${sq}.`,
      invis: `Unseen for ${sq}: foes hit you only on their best roll (${RAIL_INVIS_RANGE}).`,
      // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19):
      // states the count and, in voice, that ending inside stone is fatal —
      // the same warning eventNarration.js's Oracle line carries.
      ether: `${sq} of walking through stone. Be in a corridor when it ends — the stone will not make room.`,
      acute: `You strike on a d6 for ${Number.isFinite(n) ? railPlural(n, "round") : "a few rounds"}.`,
      might: `+${e?.might ?? "?"} damage for ${sq}.`,
      fly: `Twenty squares of not touching the floor.`,
      lit: `Forty squares of carrying a light.`,
      // 260918-w4n (use-activated-only): the 7 newly use-activated kinds.
      power: `+1 damage for ${sq}. The ring approves.`,
      // RULES-11 (Phase 75.2, Plan 04): mirrors eventNarration.js's own
      // giant/enlarge lines — narrated from the event's own size fields,
      // never a restated formula; no overhead-clearance/corridor promise.
      giant: e?.size
        ? `${sq} one size larger: you are ${e.size}. ${signedText(e?.sizeDmg ?? 0)} damage, and foes ${signedText(e?.step ?? 1)} to hit you. You are, on reflection, a bigger target.`
        : `One size larger for ${sq}.`,
      // Phase 89 (ITEM-05): Enlarge's own rail line, the Oracle's numbers
      // (dmgTotal and the step) in the rail's short form.
      enlarge: e?.size
        ? `${sq} one size larger: you are ${e.size}. ${signedText(e?.dmgTotal ?? e?.sizeDmg ?? 0)} damage, foes ${signedText(e?.step ?? 1)} to hit you.`
        : `One size larger for ${sq}.`,
      glow: `Fifty squares of being your own lantern.`,
      unseen: `Unseen for ${sq}: foes ${RAIL_UNSEEN_SHIFT} to hit you.`,
      tongue: `You can always parley for ${sq}, +2 to the parley roll. Do not waste it on small talk.`,
      critWard: `${sq} with nothing critical landing on you.`,
      plate: `${sq} of weightless plate.`,
      // Phase 88 (ITEM-03): the Cloak of Regeneration's window from the event's own numbers.
      knit:
        Number.isFinite(e?.every) && Number.isFinite(e?.ticks) && e?.heal && Number.isFinite(e.heal.sides)
          ? `${sq} of knitting: ${railHealDice(e.heal)} hp every ${railSquares(e.every)} walked, ${e.ticks === 1 ? "once" : `${e.ticks} times`}.`
          : `${sq} of knitting.`,
    };
    return { text: map[e?.kind] ?? `${e?.item ?? "It"} is in effect for ${sq}.`, tone: "magic", priority: PRIORITY.you };
  },
  itemEffectFaded: (e) => ({ text: `${e?.member ? `${e.member}'s ` : ""}${e?.item ?? "It"} wears off.`, tone: "beat", priority: PRIORITY.other }),
  // Phase 88 (ITEM-02): the rail twin of the Oracle's itemEffectEnded — the
  // item, how it left, what stops, and (only when the use left a cooldown)
  // when it is ready. A minor event, never a decision card.
  itemEffectEnded: (e) => {
    const how = e?.why === "off" ? (e?.slot === "weapon" ? "unwielded" : "off") : e?.why === "swap" ? "swapped out" : "gone";
    let clause = e?.party && e?.kind === "invis" ? "party seen again" : (RAIL_ENDED_CLAUSE[e?.kind] ?? "its magic stops");
    if (e?.kind === "knit" && Number.isFinite(e?.ticks) && e.ticks > 0) clause += `, ${railPlural(e.ticks, "tick")} unspent`;
    const ready = Number.isFinite(e?.ready) && e.ready > 0 ? ` (ready in ${railSquares(e.ready)})` : "";
    const lead = `${e?.member ? `${e.member}'s ` : ""}${railEndedItem(e)} ${how}`;
    return { text: `${lead.charAt(0).toUpperCase()}${lead.slice(1)}: ${clause}${ready}.`, tone: "beat", priority: PRIORITY.other };
  },
  itemCooled: (e) => ({ text: `${e?.member ? `${e.member}'s ` : ""}${e?.item ?? "It"} is ready again.`, tone: "hit", priority: PRIORITY.other }),
  // VOX-05 (Phase 79, plan 79-11): the bare "2/5" now says what it counts.
  staffRecharged: (e) => ({
    text: `${e?.item ?? "It"} hums: a charge is back${Number.isFinite(e?.charges) && Number.isFinite(e?.max) ? ` (${e.charges}/${e.max})` : ""}.`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  itemFizzled: () => ({ text: "Nothing happens.", tone: "miss", priority: PRIORITY.you }),
  // Phase 29 (LOOT-04): richer text when the event carries the have/slots
  // count (every current push site does); a bare {type} call (safety-scan
  // style) still gets a sane fallback.
  bagFull: (e) => block(e?.have != null && e?.slots != null ? `Bag full (${e.have}/${e.slots}) — drop something to make room.` : "No room in the bag."),
  // Phase 37 (GEAR-03): an additive `replaced` payload (the swapped-out
  // worn item) appends one clause; the no-replaced text stays byte-identical.
  // 260918-wy1 (jewelry-merge): the slot renders through `slotWord` — a
  // jewelry1/jewelry2 key reads "(jewelry)", never the raw key; weapon/armor
  // are unaffected (slotWord passes them through unchanged).
  // RULES-08 (Phase 75): an additive `destroyed`/`discarded` names the old
  // piece as gone (destroyed, never `replaced` — the two are mutually
  // exclusive), mirroring eventNarration.js's Oracle pair.
  itemEquipped: (e) => ({
    text: `Equipped: ${e?.item?.n ?? "something"}${e?.slot ? ` (${slotWord(e.slot)})` : ""}.${
      e?.destroyed && e?.discarded?.n
        ? ` ${e.discarded.n} was already destroyed — gone, not kept.`
        : e?.replaced?.n
          ? ` ${e.replaced.n} goes back in the bag.`
          : ""
    }`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  equipRejected: (e) => block(equipRejectText(e)),
  // Phase 63 (GSCR-09): the sheet's DROP/UNEQUIP/DISCARD outcomes reach the
  // rail in voice, mirroring itemEquipped's item-name-first, one-line shape.
  itemDropped: (e) => ({ text: `Dropped: ${e?.item?.n ?? "something"}. Gone for good.`, tone: "beat", priority: PRIORITY.other }),
  itemUnequipped: (e) =>
    e?.destroyed
      ? { text: `${e?.item?.n ?? "It"} comes off in pieces. Nothing worth bagging.`, tone: "beat", priority: PRIORITY.other }
      : { text: `Unequipped: ${e?.item?.n ?? "something"}${e?.slot ? ` (${slotWord(e.slot)})` : ""}. Into the bag it goes.`, tone: "beat", priority: PRIORITY.other },
  // Phase 61 (GRULE-01): the combat gear lock's rail/fight-log line — the
  // fold's PRIORITY.block already renders it as a dull refusal entry
  // (fightLog.js#fightLogLinesFor maps PRIORITY.block -> tone "dull").
  gearRefused: (e) => block(GEAR_LOCK_LOOT_VERBS.has(e?.verb) ? "The spoils can wait until the fight is over." : "Not the moment to change outfits."),
  // Phase 29 (LOOT-05): a bag upgrade item was taken — c.bag just went up a tier.
  bagUpgraded: (e) => ({ text: `Bigger bag: ${e?.slots ?? "more"} slots.`, tone: "hit", priority: PRIORITY.you }),

  /* ---------------- pending loot pile (LOOT-01/02/06, Phase 29) ---------------- */

  lootDropped: (e) => ({ text: `Dropped: ${e?.name ?? "something"}. It will keep.`, tone: "beat", priority: PRIORITY.other }),
  lootTaken: (e) => ({ text: `Taken: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.you }),
  lootLeft: (e) => ({ text: `Left behind: ${e?.item?.n ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  lootForfeited: (e) => {
    const items = e?.items ?? [];
    const names = items.map((i) => i?.n ?? "something").join(", ") || "the spoils";
    return {
      text: e?.reason === "died" ? `Dead: ${names} stay${items.length === 1 ? "s" : ""} where ${items.length === 1 ? "it" : "they"} fell.` : `Fled: ${names} stay behind.`,
      tone: "miss",
      priority: PRIORITY.you,
    };
  },
};
