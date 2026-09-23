// src/browser/narrationLines.js
//
// The per-event narration-LINE table and fold pipeline: `LINE_FOR` maps
// every narrated engine event type to a SHORT `(e, ctx) => ({ text, tone,
// priority })` builder — the summary a player glances at — and
// `linesForAction` folds a whole action's events into an ordered list of
// those summaries. `rail.js` reads this fold out of combat (one RAIL
// card); `fightLog.js` reads it in combat (the round's fight-log lines).
// Beside it sits `src/browser/eventNarration.js`'s `EVENT_NARRATION` (the
// Oracle log) — the full sentence with the roll, for the record rather
// than the glance.
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
 * resolveJoiner, dismissJoiner (Phase 36, JOIN-01). The shell passes a
 * `ctx.narrate` hook ONLY for these action types — every other action
 * (combat, store, inventory) keeps the short Phase 25 table text unchanged.
 */
export const NARRATIVE_ACTIONS = new Set(["move", "camp", "resolveJoiner", "dismissJoiner"]);

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
 * ORACLE_ONLY — bookkeeping event types that already have a dedicated
 * screen, HUD field, prompt, or are pure step/roll detail whose outcome
 * sibling always follows. These get NO LINE_FOR entry; the Oracle never
 * loses information a line shows (a line is the glance, the Oracle is the
 * record — T-25-10). Any addition must carry a reason and obey the same
 * principle: never a feature, refusal, outcome, spell, or ability event.
 */
export const ORACLE_ONLY = new Set([
  "moved", // a plain step is already silent by design (engineAdapter.js) — not a LINE_FOR type either
  "dayBegan", // the HUD's day counter already shows this
  "floorChanged", // the HUD's depth banner already shows this
  "spellChargeRecovered", // the grimoire/HUD charge display already shows this
  "spGained", // pure XP bookkeeping; foeKilled/parleyRolled narrate the outcome that earned it
  "combatEnded", // the combat screen closing IS the signal
  "died", // dedicated death/epitaph screen
  "storeLeft", // the store screen closing IS the signal
  "encounterRolled", // internal table-roll bookkeeping; tableFour/tableFourNoop narrate the outcome
  "findOffered", // the dedicated Take it/Leave it prompt IS the UI
  "hazardChoice", // Phase 39 (GEAR-05): the pre-roll USE LADDER/USE ROPE decision card IS the UI, like findOffered
  "findTaken", // the dedicated Take it/Leave it prompt IS the UI
  "findLeft", // the dedicated Take it/Leave it prompt IS the UI
  // Phase 63 (GSCR-09): itemDropped/itemUnequipped moved to LINE_FOR — the
  // Gear tab's action sheet closes on the tap, so the row change alone is
  // no longer the signal; the rail is the one feedback surface.
  "joinerMet", // the dedicated Joiner recruitment prompt IS the UI
  "faerieMet", // the dedicated faerie encounter prompt IS the UI; faerieBoon/faerieBane narrate the real outcome
  "grimoireSold", // the sell-flow's own confirmation is the UI signal
  "itemConsumed", // pure bookkeeping (a charge spent); the effect event itself already narrated
  "allyCast", // the allySpellHit/allySpellMissed sibling that always follows in the same action narrates the outcome and names the spell (one line per cast)
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
  "chestOpened",
  "chestLockRolled",
  "potionDuplicated",
  "rested",
  "potionDrunk",
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

/** fleeModsText(mods) — "Thief +5" / "Thief +5, Mail −1" (Phase 42, FLEE-02;
 * mirrors eventNarration.js's needModsText format so the line/Oracle/fight-
 * log surfaces all speak the same modifier vocabulary). */
function fleeModsText(mods) {
  return (mods || []).map((m) => `${m.name} ${m.delta < 0 ? "−" : "+"}${Math.abs(m.delta)}`).join(", ");
}

const CRIT_BY_TEXT = {
  stealth: "stealth",
  backstab: "backstab",
  ninja: "ninja",
  cutthroat: "Cutthroat",
  deathTouch: "Death Touch",
  silentStep: "Silent Step",
};

const EQUIP_REJECT_TEXT = {
  wrongClass: "Not for the likes of you.",
  notBetter: "Not an upgrade.",
  noArmor: "Fridgians wear no armour.",
  woodsman: "No mail for a Woodsman.",
  tooHeavy: "Too heavy to carry.",
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

/**
 * slotWord(slot) — 260918-wy1 (jewelry-merge): the player-facing FAMILY word
 * for a worn KEY — `jewelry1`/`jewelry2` both read "jewelry", `cloak` reads
 * "cloak"; any other slot word (`weapon`, `armor`, or an unrecognized
 * string) passes through unchanged. Exported so eventNarration.js's Oracle
 * lines can share the exact same word (never a raw key like "jewelry2" in
 * prose).
 */
export function slotWord(slot) {
  return SLOT_FAMILY_WORD[slot] ?? slot;
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
//      frozenSolid/foeKilled per target (3+ targets collapse into one
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
// `ctx.narrate` (Phase 25.1, DFB-01 decision 2) — `(e) => html string | ""`,
// supplied by the shell ONLY for NARRATIVE_ACTIONS (move/camp/resolveJoiner).
// In step 7 (the direct-mapped-event loop below), when `ctx.narrate` is a
// function AND the event's type is not in CARD_EVENTS, the line text
// becomes `narrativeLineText(ctx.narrate(e))` — the Oracle's own sentence,
// dice stripped — with the table text as the fallback when the narration
// strips to nothing (never a blank line). Every other action type keeps
// the short Phase 25 table text. CARD_EVENTS types are excluded here
// because the "Move on" card already carries their sentence — this is the
// ONE decision point where the narrative-vs-table choice is made.

const CRIT_SUFFIX = " · CRIT";

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
  "stunned",
  "weakened",
  "stupefied",
  "blinded",
  "shrunk",
  "acidApplied",
  // Phase 40 (SPELL-01, Ice) — resistible exactly like Acid (both kinds are
  // absent from RESIST_IMMUNE_KINDS), so a resistFailed preceding a landed
  // Ice cast folds the same way.
  "iceApplied",
  "petrified",
  "walkingDeadTurned",
  "planeGated",
  "insaneRolled",
  "insaneFled",
  "frozenSolid",
]);

/**
 * spellChain(events, consumed) — folds `spellThrown` -> its per-target
 * outcome (`spellHit`(+`frozenSolid`)(+`foeKilled`) | `spellMissed`) into
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
      if (j <= i || consumed.has(j) || !RESIST_FOLD_EFFECTS.has(oe.type)) return false;
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
    let killedIdx = -1;
    for (let j = ti + 1; j < events.length; j++) {
      if (consumed.has(j)) continue;
      const e = events[j];
      if (e.type === "spellThrown") break;
      if (e.type === "spellHit" && e.target === target && hitIdx === -1) hitIdx = j;
      else if (e.type === "spellMissed" && e.target === target && missedIdx === -1) missedIdx = j;
      else if (e.type === "frozenSolid" && e.target === target && frozenIdx === -1) frozenIdx = j;
      else if (e.type === "foeKilled" && e.name === target && killedIdx === -1) killedIdx = j;
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
    if (frozenIdx !== -1) {
      consumed.add(frozenIdx);
      if (killedIdx !== -1) consumed.add(killedIdx);
      built.push({ text: `${e0.spell} — ${target} frozen solid`, tone: "magic", priority: PRIORITY.you, idx: ti });
      continue;
    }
    // spellHit likewise carries no `spell` field (engine/magic.js) — borrow
    // it from the spellThrown that started this chain.
    built.push({ ...LINE_FOR.spellHit({ ...hitE, spell: e0.spell }), idx: ti, _target: target });
  }
  return built;
}

/**
 * fleeChain(events, consumed) — `fleeRolled` + (`fled` | `fleeFailed`) fold
 * into ONE line, ROLL FIRST (Phase 42, FLEE-02, ROADMAP SC-1): the roll and
 * every named modifier lead, the outcome's own text follows —
 * `${LINE_FOR.fleeRolled(e).text}. ${outcome text}` — so the fight log
 * shows roll/modifiers/need before the outcome in one line (the 34-CONTEXT
 * "log line count = folded count" pin still holds: still ONE line per
 * attempt). Reuses LINE_FOR.fleeRolled itself rather than restating the
 * format. A `fled` with no preceding `fleeRolled` (Cloaker/tracked) keeps
 * its own builder untouched.
 */
function fleeChain(events, consumed) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "fleeRolled") return;
    for (let j = i + 1; j < events.length; j++) {
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
 * parleyChain(events, consumed) — `parleyRolled` + (`goldGained` why
 * "parley" | `parleyFailed` | `beastsSoothed`) fold into ONE line: the
 * outcome's own text plus `(${roll} vs ${need})`.
 */
function parleyChain(events, consumed) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "parleyRolled") return;
    for (let j = i + 1; j < events.length; j++) {
      if (consumed.has(j)) continue;
      const oe = events[j];
      const isOutcome =
        (oe.type === "goldGained" && oe.why === "parley") || oe.type === "parleyFailed" || oe.type === "beastsSoothed";
      if (isOutcome) {
        consumed.add(i);
        consumed.add(j);
        const b = LINE_FOR[oe.type](oe);
        built.push({ text: `${b.text} (${e.roll} vs ${e.need})`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "parleyRolled") break;
    }
  });
  return built;
}

/**
 * chestChain(events, consumed) — `chestLockRolled` + (`chestOpened` |
 * `chestLocked`) fold into ONE line: the outcome's own text plus
 * `(${roll} vs ${need})`. A Pilfer's roll-free `chestOpened` (reason
 * "pilfer") has no preceding `chestLockRolled` and keeps its own builder.
 */
function chestChain(events, consumed) {
  const built = [];
  events.forEach((e, i) => {
    if (consumed.has(i) || e.type !== "chestLockRolled") return;
    for (let j = i + 1; j < events.length; j++) {
      if (consumed.has(j)) continue;
      const oe = events[j];
      if (oe.type === "chestOpened" || oe.type === "chestLocked") {
        consumed.add(i);
        consumed.add(j);
        const b = LINE_FOR[oe.type](oe);
        built.push({ text: `${b.text} (${e.roll} vs ${e.need})`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "chestLockRolled") break;
    }
  });
  return built;
}

/**
 * encounterStart(events, consumed) — when an `encounterStarted` is present,
 * folds it plus its same-action followers (trackable, allyJoined,
 * warlockBoost, foeFled reason knight/conArtist, foeBored, phobiaAfraid,
 * combatInDark) into ONE line; each follower appends a short clause and is
 * consumed. Without an `encounterStarted` in the action, every one of those
 * events keeps its own builder (this function simply returns null).
 */
function encounterStart(events, consumed) {
  const idx = events.findIndex((e, i) => !consumed.has(i) && e.type === "encounterStarted");
  if (idx === -1) return null;
  const e = events[idx];
  const base = LINE_FOR.encounterStarted(e);
  consumed.add(idx);
  let text = base.text;
  for (let j = idx + 1; j < events.length; j++) {
    if (consumed.has(j)) continue;
    const fe = events[j];
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
      return "You go first. Nothing gets the jump on you.";
    case "knight":
      return "A Knight's welcome — it comes straight at you.";
    case "courtMage":
      return "Court Mage — you talk first, they swing first.";
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
 */
export function linesForAction(type, events, ctx = {}, opts = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const { limit = Infinity, withIdx = false } = opts || {};
  const consumed = new Set();
  const built = [];

  const enc = encounterStart(events, consumed);
  if (enc) built.push(enc);
  built.push(...enemyRound(events, consumed));
  built.push(...yourRound(events, consumed));
  built.push(...spellChain(events, consumed));
  built.push(...fleeChain(events, consumed));
  built.push(...parleyChain(events, consumed));
  built.push(...chestChain(events, consumed));
  killFold(events, consumed, built);

  events.forEach((e, idx) => {
    if (consumed.has(idx)) return;
    if (ORACLE_ONLY.has(e.type)) return;
    const builder = LINE_FOR[e.type];
    if (!builder) return;
    const { text, tone, priority } = builder(e, ctx);
    // Phase 25.1 (DFB-01 decision 2) — the ONE narrative-vs-table decision
    // point: for a narrative action's non-card event, prefer the Oracle's
    // own sentence (dice stripped); fall back to the table text when the
    // narration strips to nothing so a line is never blank.
    const narrative = typeof ctx.narrate === "function" && !CARD_EVENTS.has(e.type) ? narrativeLineText(ctx.narrate(e)) : "";
    built.push({ text: narrative || text, tone, priority, idx, type: e.type });
  });

  const deduped = dedupeByType(built);
  deduped.sort((a, b) => a.priority - b.priority || a.idx - b.idx);
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
  heightsFear: (e) => ({ text: `Heights: +${e?.penalty ?? 0} on the roll.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  waterFear: (e) => ({ text: `Bodies of water: +${e?.penalty ?? 0} on the roll.`, tone: "hurt", priority: PRIORITY.other }),
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
  afflictionTick: (e) => ({ text: `${e?.kind ?? "It"} (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  afflictionPassed: (e) => ({ text: `The ${e?.kind ?? "worst of it"} passes.`, tone: "hit", priority: PRIORITY.other }),
  afflictionCured: (e) => ({ text: `Cured of the ${e?.kind ?? "sickness"}.`, tone: "hit", priority: PRIORITY.other }),
  afflictionLingers: (e) => ({ text: `The ${e?.kind ?? "sickness"} lingers.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 25 (FEED-01): `doubled` names the Soldier/heal2x race when the camp
  // heal was doubled; absent renders the plain amount only.
  rested: (e) => ({
    text: `Camp +${e?.amount ?? 0} hp${e?.doubled ? ` · ${e.doubled}, doubled` : ""}`,
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  // Phase 54 (BAND-02, USER RULING D): HERO_REGEN_PER_FLOOR's arrival tick —
  // identity (0) never pushes this event.
  floorRegen: (e) => ({
    text: `A new floor, and the dungeon lets you keep +${e?.amount ?? 0} hp of it. Do not mistake this for kindness.`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  // 260918-w4n (use-activated-only): the Cloak of Healing is removed from
  // the game — the "cloakHealed" event type no longer exists anywhere.
  cloakRegenerated: (e) => ({ text: `Flesh knits +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.other }),
  armorPatched: (e) => ({ text: `${e?.by ?? "Mending"}: +${e?.amount ?? 0} armour.`, tone: "hit", priority: PRIORITY.feature }),
  potionDuplicated: () => ({ text: "Warlock: +1 potion.", tone: "magic", priority: PRIORITY.feature }),
  // Phase 43 (CLAR-01/03/05): a fed night's ration cost — a cost, so it is
  // narrated (never ORACLE_ONLY), not just bookkeeping.
  rationsEaten: (e) => ({ text: `Rations: −${e?.eats ?? 0} (${e?.left ?? 0} left).`, tone: "beat", priority: PRIORITY.other }),
  wentHungry: (e) => ({ text: `Hunger: no rations (−${e?.cost ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  wanderingMonster: (e) => ({
    text: `Camp disturbed.${e?.bard ? " · Bard: the singing carried" : ""}`,
    tone: "hurt",
    priority: PRIORITY.feature,
  }),
  // Phase 25.1 (DFB-06): still an amber block, priority 0, non-empty for a
  // bare payload; on the camp action the narrative ctx (NARRATIVE_ACTIONS)
  // shows the Oracle sentence instead — this is the fallback/coverage text.
  campFailed: (e) =>
    block(e?.need != null && e?.have != null ? `You eat ${e.need} a night, you have ${e.have}. Find rations first.` : "Not enough food to make camp."),
  teleported: () => ({ text: "You teleport to an unknown location.", tone: "beat", priority: PRIORITY.other }),
  leveled: (e) => ({ text: `Skill level ${e?.level ?? "?"} (+${e?.wpGain ?? 0} hp).`, tone: "hit", priority: PRIORITY.feature }),
  // Phase 38 (ABIL-01/03): a level-pool ability roll, sibling of leveled
  // immediately above (both fold into the same SKILL LEVEL N card family).
  abilityLearned: (e) => ({ text: `New trick: ${e?.name ?? "something"} — ${e?.txt ?? ""}`, tone: "hit", priority: PRIORITY.feature }),

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
  strikeMissed: (e) =>
    e?.untouchable
      ? { text: `You cannot touch ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }
      : { text: `You miss ${e?.target ?? "it"}${e?.quip ? ` — ${e.quip}` : ""}`, tone: "miss", priority: PRIORITY.you },
  deathTouch: (e) => ({ text: `One touch — ${e?.target ?? "it"} drops.`, tone: "hit", priority: PRIORITY.feature }),
  backstabDenied: () => block("Heavy armour gave you away."),
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
  cooked: (e) => ({
    text: (e?.wp ?? 0) > 0 ? `Cooked: +${e.wp} hp, +${e?.rations ?? 1} ration.` : `Salvaged +${e?.rations ?? 1} ration.`,
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
  fleeRolled: (e) => {
    const roll = e?.roll ?? "?";
    const mods = e?.mods ?? [];
    const total = e?.total ?? e?.roll ?? "?";
    const need = e?.need ?? "?";
    return { text: `Flee: ${roll}${mods.length ? ` (${fleeModsText(mods)})` : ""} = ${total} vs ${need}`, tone: "beat", priority: PRIORITY.other };
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
  parleyRolled: (e) => ({ text: `Talk it down: ${e?.roll ?? "?"} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
  parleyInsulted: () => ({ text: "You have made it personal.", tone: "hurt", priority: PRIORITY.them }),
  parleyExhausted: () => block("You already said your piece."),
  goldGained: (e) => {
    const suffix = e?.why === "pickpocket" ? " (Pickpocket)" : e?.why === "parley" ? " (parley)" : "";
    return { text: `+${e?.amount ?? 0} wilmst${suffix}`, tone: "hit", priority: PRIORITY.feature };
  },
  parleyFailed: () => ({ text: "They are not buying it.", tone: "miss", priority: PRIORITY.you }),
  sang: (e) => ({ text: `You sing ${e?.song ?? "a tune"}.`, tone: "magic", priority: PRIORITY.feature }),
  beastsSoothed: (e) => ({ text: `${e?.count ?? 0} stand down.`, tone: "hit", priority: PRIORITY.feature }),
  songIgnored: () => ({ text: "They do not care for music.", tone: "miss", priority: PRIORITY.feature }),
  lullabyRolled: (e) => ({ text: `${e?.n ?? 0} nod off.`, tone: "magic", priority: PRIORITY.feature }),
  thunderRolled: (e) => ({ text: `Thunder rolls — ${e?.n ?? 0} freeze (${e?.r ?? 0}).`, tone: "magic", priority: PRIORITY.feature }),
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
    const tail =
      e?.effect === "frozen" ? `${t} frozen solid` : e?.effect === "asleep" ? `${t} nods off` : e?.effect === "weakened" ? "the foes weaken" : `${t} (${e?.dmg ?? 0})`;
    return { text: `${who} casts ${sp} — ${tail}`, tone: "magic", priority: PRIORITY.feature };
  },
  allySpellMissed: (e) => ({
    text: `${e?.name ?? "Your ally"} casts ${e?.spell ?? "a spell"} — ${e?.resisted ? `${e?.target ?? "it"} resists` : `misses ${e?.target ?? "it"}`}`,
    tone: "miss",
    priority: PRIORITY.feature,
  }),
  // Phase 25 (FEED-01): `needMods` names the reason a swing that should have
  // landed did not — only when the roll would have hit without the modifier.
  memberStruck: (e) => {
    const crit = e?.critical ? " · CRIT" : "";
    return { text: `${e?.name ?? "It"} hits ${e?.member ?? "your companion"} (${e?.dmg ?? 0})${crit}`, tone: "hurt", priority: PRIORITY.feature };
  },
  memberDowned: (e) => ({ text: `${e?.name ?? "Your companion"} goes down.`, tone: "hurt", priority: PRIORITY.feature }),
  regenerated: (e) => ({ text: `+${e?.amount ?? 0} hp knits shut.`, tone: "hit", priority: PRIORITY.you }),
  acidTick: (e) => ({ text: `Acid eats at ${e?.target ?? "it"} (${e?.dmg ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  foeSlept: (e) => ({ text: `${e?.name ?? "It"} sleeps through it.`, tone: "dodge", priority: PRIORITY.them }),
  foeMissed: (e) => {
    const mods = e?.needMods ?? [];
    const negative = mods.filter((m) => m.delta < 0);
    const negSum = negative.reduce((sum, m) => sum + m.delta, 0);
    const wouldHaveHit = negative.length > 0 && e?.roll != null && e?.need != null && e.roll <= e.need - negSum;
    let text = `${e?.name ?? "It"} misses ${e?.member ?? "you"}`;
    if (wouldHaveHit) text += ` · ${negative.map((m) => m.name).join(", ")}`;
    return { text, tone: "dodge", priority: e?.member ? PRIORITY.feature : PRIORITY.them };
  },
  wardReflected: (e) => ({ text: `The ward throws ${e?.amount ?? 0} back.`, tone: "hit", priority: PRIORITY.them }),
  wardAbsorbed: (e) => ({ text: `The ward eats ${e?.amount ?? 0} (${e?.remaining ?? 0} left).`, tone: "hit", priority: PRIORITY.them }),
  wardShattered: () => ({ text: "The ward shatters.", tone: "hurt", priority: PRIORITY.them }),
  armorDestroyed: () => ({ text: "Your armour gives out.", tone: "hurt", priority: PRIORITY.them }),
  // Phase 25 (FEED-01): `wear` is the real durability cost; `halved` names the
  // Dwarven mitigation. Phase 28 (ARMOR-05): `underMin`/`magic` are two more
  // additive outcome flags — the blow was soaked at/under the armour's min
  // (no wear), or soaked by the Cloak of Armor's magic plate (never wears) —
  // making all four armorSoaked outcomes distinguishable on screen.
  armorSoaked: (e) => ({
    text: e?.magic
      ? `The cloak's plate takes ${e?.amount ?? 0} · never wears`
      : e?.underMin
        ? `Armour shrugs off ${e?.amount ?? 0} · under its min, no wear`
        : `Armour takes ${e?.amount ?? 0}${e?.wear ? ` · wear ${e.wear}` : ""}${e?.halved ? " (Dwarven, halved)" : ""}`,
    tone: "hit",
    priority: PRIORITY.them,
  }),
  foeArmorSoaked: (e) => ({ text: `${e?.name ?? "It"}'s armour shrugs it off.`, tone: "miss", priority: PRIORITY.them }),
  damageHalved: (e) => ({ text: `The pendant halves ${e?.name ?? "that"}'s blow.`, tone: "hit", priority: PRIORITY.them }),
  // Phase 25 (FEED-01): `soldierCrit` renders exactly like `critical`;
  // `soaked` names what absorbed the blow.
  struckByFoe: (e) => {
    const crit = e?.critical || e?.soldierCrit ? " · CRIT" : "";
    return { text: `${e?.name ?? "It"} hits you (${e?.dmg ?? 0})${crit}${soakSuffix(e?.soaked)}`, tone: "hurt", priority: PRIORITY.them };
  },
  wardFaded: () => ({ text: "The ward fades.", tone: "beat", priority: PRIORITY.other }),
  mirrorFaded: () => ({ text: "The mirror fades.", tone: "beat", priority: PRIORITY.other }),
  // Phase 40 (SPELL-02): endCombat's own expiry narration for a
  // still-running Regeneration/Sense Presence when the fight ends.
  sensesFaded: () => ({ text: "Your senses dull back to normal.", tone: "beat", priority: PRIORITY.other }),
  regenFaded: () => ({ text: "The wounds stop closing on their own.", tone: "beat", priority: PRIORITY.other }),

  /* ---------------- foe abilities (engine/foeAbilities.js) ---------------- */

  foeCast: (e) => ({ text: `${e?.name ?? "It"}: ${e?.txt ?? "something unpleasant"}`, tone: "dodge", priority: PRIORITY.them }),
  foeBolted: (e) => {
    const suffix = soakSuffix(e?.soaked);
    return e?.member
      ? { text: `${e?.name ?? "It"} bolts ${e.member} (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.feature }
      : { text: `${e?.name ?? "It"} bolts you (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.them };
  },
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  foeDrained: (e) => ({ text: `${e?.name ?? "It"} drains you (−${e?.stolen ?? 0} hp).`, tone: "hurt", priority: PRIORITY.them }),
  foeDebuffed: (e) => ({ text: `${e?.name ?? "It"}: you are ${e?.kind ?? "afflicted"} (${e?.rounds ?? "?"}).`, tone: "hurt", priority: PRIORITY.them }),
  foeHealed: (e) => ({ text: `${e?.name ?? "It"} heals (+${e?.amount ?? 0}).`, tone: "dodge", priority: PRIORITY.them }),
  foeSummoned: (e) => ({
    text: e?.pending ? `${e?.by ?? e?.name ?? "It"} calls for help.` : `${e?.name ?? "Something"} joins the fight.`,
    tone: "dodge",
    priority: PRIORITY.them,
  }),
  foeEffectFaded: (e) => ({ text: e?.kind === "dazed" ? "You are no longer dazed." : "Your strength comes back.", tone: "hit", priority: PRIORITY.you }),
  heroResisted: (e) => ({ text: `You resist ${e?.name ?? "its"}'s spell.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 25 (FEED-03): starts with the foe's name (matches the THEM-family
  // tone-prefix contract every other foe-action builder follows).
  heroResistFailed: (e) => ({ text: `${e?.name ?? "It"} gets through — you fail to resist.`, tone: "hurt", priority: PRIORITY.them }),
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
      cooldown: `${name}: ${e?.left ?? "?"} round${e?.left === 1 ? "" : "s"}. Your arm has opinions.`,
      notInCombat: `${name}: nothing to use it on out here.`,
      noTarget: `${name}: nothing left standing to use it on.`,
      notLowEnough: `Last Stand: you are not desperate enough yet (${e?.have ?? "?"} of ${e?.max ?? "?"} hp).`,
    };
    return block(map[e?.reason] ?? `${name} refuses you.`);
  },
  // Plan 04 (ABIL-05): the fourteen ability-activation/effect lines below
  // carry an ADDITIVE `${e?.member ? \`${e.member}: \` : ""}` prefix — present
  // only when a Joiner (not the hero) is the actor.
  pommelStruck: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}The pommel finds ${e?.target ?? "it"}'s temple.`, tone: "hit", priority: PRIORITY.them }),
  foeStunned: (e) => ({ text: `${e?.name ?? "It"} loses its turn.`, tone: "hit", priority: PRIORITY.them }),
  battleRoarRaised: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Loud enough. Two rounds of it.`, tone: "hit", priority: PRIORITY.feature }),
  sidestepped: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Not where the blade is. Two rounds of that.`, tone: "hit", priority: PRIORITY.feature }),
  secondWindHealed: (e) => ({ text: `+${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.you }),
  swept: (e) => ({ text: `One wide arc — ${e?.dmg ?? 0} to everything standing.`, tone: "hit", priority: PRIORITY.feature }),
  sweptFoe: (e) => ({ text: `${e?.target ?? "It"} takes ${e?.dmg ?? 0}.`, tone: "hit", priority: PRIORITY.them }),
  braced: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Braced. The next one lands on your terms.`, tone: "hit", priority: PRIORITY.feature }),
  braceHeld: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Braced — ${e?.name ?? "it"}'s blow lands half as hard (−${e?.soaked ?? 0}).`, tone: "hit", priority: PRIORITY.you }),
  riposteReady: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Every miss is an invitation.`, tone: "hit", priority: PRIORITY.feature }),
  riposted: (e) => ({ text: `${e?.target ?? "It"} misses, and pays ${e?.dmg ?? 0} for it.`, tone: "hit", priority: PRIORITY.them }),
  taunted: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Every foe looks at you. Armour doubles.`, tone: "hit", priority: PRIORITY.feature }),
  lastStandCalled: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Under a quarter. ${e?.attacks ?? 3} attacks this round.`, tone: "beat", priority: PRIORITY.feature }),
  dirtyTrickLanded: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} is blinded for ${e?.rounds ?? 2} rounds.`, tone: "hit", priority: PRIORITY.them }),
  foeSightReturned: (e) => ({ text: `${e?.name ?? "It"} blinks the sand out.`, tone: "dodge", priority: PRIORITY.them }),
  smokeThrown: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Gone. They need a natural 1 to find you.`, tone: "hit", priority: PRIORITY.feature }),
  cutpursed: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}You lift ${e?.amount ?? 0} wilmst off ${e?.target ?? "it"}.`, tone: "hit", priority: PRIORITY.them }),
  poisonedEdgeApplied: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} is poisoned for ${e?.rounds ?? 3} rounds.`, tone: "hit", priority: PRIORITY.them }),
  // Phase 40 (SPELL-01, Ice) — the generic-on-`by` shape now covers two
  // sources; the short form names whichever one this tick came from.
  dotTick: (e) => ({ text: `${e?.target ?? "It"} takes ${e?.dmg ?? 0} from ${e?.by === "ice" ? "the ice" : "the poison"}.`, tone: "hurt", priority: PRIORITY.them }),
  hamstrung: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}${e?.target ?? "It"} hits half as hard from here on.`, tone: "hit", priority: PRIORITY.them }),
  marked: (e) => ({ text: `${e?.member ? `${e.member}: ` : ""}Every blow on ${e?.target ?? "it"} lands +2.`, tone: "hit", priority: PRIORITY.them }),
  // Plan 04 (ABIL-05): a Joiner's own ability use — four new member-only
  // events (no hero equivalent; a hero's own equivalent reads
  // abilityUsed/secondWindHealed/swept/riposted above).
  memberAbilityUsed: (e) => ({ text: `${e?.name ?? "Your companion"} calls ${e?.ability ?? "it"}.`, tone: "hit", priority: PRIORITY.feature }),
  memberSecondWind: (e) => ({ text: `${e?.name ?? "Your companion"} remembers why they came. +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.them }),
  memberSwept: (e) => ({ text: `${e?.name ?? "Your companion"} sweeps — ${e?.dmg ?? 0} to everything standing.`, tone: "hit", priority: PRIORITY.them }),
  memberRiposted: (e) => ({ text: `${e?.target ?? "It"} misses ${e?.name ?? "your companion"}, and pays ${e?.dmg ?? 0} for it.`, tone: "hit", priority: PRIORITY.them }),

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => block("Nothing left to cast with."),
  spellNotKnown: (e) => block(`You do not know ${e?.spell ?? "that"}.`),
  spellAboveLevel: (e) => block(`${e?.spell ?? "That"} needs level ${e?.need ?? "?"}; you are ${e?.have ?? "?"}.`),
  spellSchoolLocked: (e) => block(`${e?.spell ?? "That"} is not open to you yet.`),
  // Phase 31 (CMB-01/CMB-02): the NEW spell-refusal circumstances this phase
  // introduces (notFought/combatOnly/exploreOnly/noTarget) — never a `frozen`
  // reason; nothing is ever refused for fear.
  castRefused: (e) => {
    const map = {
      notFought: "Fight! first. The spell keeps.",
      combatOnly: `${e?.spell ?? "That"} wants a target. Save it for a fight.`,
      exploreOnly: `${e?.spell ?? "That"} needs quieter surroundings.`,
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
    };
    return block(map[e?.reason] ?? "Not now.");
  },
  spellBackfired: (e) => ({ text: `${e?.spell ?? "The spell"} goes wrong.`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  backfireSelfDamage: (e) => ({ text: `Backfire: ${e?.spell ?? "The spell"} (−${e?.amount ?? 0} hp).`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 25 (25-03): no trailing period — matches the aggregate-format
  // convention (struckByFoe/foeMissed/struck etc. carry none either) so a
  // resisted-spell line reads consistently with the rest of the pipeline.
  spellResisted: (e) => ({ text: `${e?.target ?? "It"} resists ${e?.spell ?? "it"}`, tone: "miss", priority: PRIORITY.you }),
  resistFailed: (e) => ({ text: `${e?.target ?? "It"} fails to resist.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  summonBackfired: (e) => ({ text: `Summoning: ${e?.spell ?? "The spell"} turned on you (−${e?.amount ?? 0} hp).`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 40 (SPELL-04): `e?.lesser` (Lesser Summon) swaps the short form.
  allySummoned: (e) => ({ text: e?.lesser ? `${e?.name ?? "Something"} answers the call, sort of.` : `${e?.name ?? "Something"} answers the call.`, tone: "magic", priority: PRIORITY.you }),
  allyPending: (e) => ({ text: e?.lesser ? `${e?.name ?? "Something"} is coming, in a small way.` : `${e?.name ?? "Something"} is coming.`, tone: "magic", priority: PRIORITY.you }),
  stunned: (e) => ({ text: `${e?.count ?? 0} freeze in place.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-01, Weaken): the rounds count, when the payload carries one.
  weakened: (e) => ({ text: `They hit softer now${e?.rounds ? ` (${e.rounds})` : ""}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-01) — combat.js#foeTurn's `spell:weaken` expiry.
  weakenFaded: () => ({ text: "Their arms remember how to swing.", tone: "magic", priority: PRIORITY.you }),
  stupefied: (e) => ({ text: `${e?.target ?? "It"} forgets what it is doing.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-01, Stupidity) — combat.js#foeTurn's per-round skip.
  foeStupefied: (e) => ({ text: `${e?.name ?? "It"} stands there, thinking about nothing.`, tone: "dodge", priority: PRIORITY.them }),
  blinded: (e) => ({ text: `${e?.target ?? "It"} cannot see a thing.`, tone: "magic", priority: PRIORITY.you }),
  shrunk: (e) => ({ text: `${e?.count ?? 0} shrink to half size.`, tone: "magic", priority: PRIORITY.you }),
  acidApplied: (e) => ({ text: `${e?.target ?? "It"} starts to dissolve (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-01, Ice) — the cast-time line; dotTick's own `by` branch
  // (Phase 38's combat.js hooks section, below) narrates every round after.
  iceApplied: (e) => ({ text: `Ice climbs ${e?.target ?? "it"} (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  earthquake: (e) => ({ text: `The floor heaves (${e?.amount ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  earthquakeSelfDamage: (e) => ({ text: `Earthquake: −${e?.amount ?? 0} hp, yours too.`, tone: "hurt", priority: PRIORITY.you }),
  vaporRolled: (e) => ({ text: `Noxious vapor (${e?.roll ?? "?"}).`, tone: "magic", priority: PRIORITY.other }),
  volley: (e) => ({ text: `${e?.rolls ?? 0} shots, ${e?.totalDamage ?? 0} total.`, tone: "magic", priority: PRIORITY.you }),
  petrified: (e) => ({ text: `${e?.target ?? "It"} turns to stone.`, tone: "magic", priority: PRIORITY.you }),
  walkingDeadTurned: (e) => ({ text: `${e?.count ?? 0} of the dead flee.`, tone: "magic", priority: PRIORITY.you }),
  nothingToTurn: () => block("Nothing here to turn."),
  planeGated: (e) => ({ text: `${e?.count ?? 0} gated straight back out.`, tone: "magic", priority: PRIORITY.you }),
  gateRefused: () => block("There is no plane here worth opening."),
  sensesGained: () => ({ text: "Your senses sharpen.", tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-05, Plan 04): see eventNarration.js's matching comment —
  // floorMapped/revealFaded replace the old retired permanent reveal event.
  floorMapped: (e) => ({ text: `The floor lays itself out in your head (${e?.squares ?? 0} squares).`, tone: "magic", priority: PRIORITY.you }),
  revealFaded: () => ({ text: "The map forgets what it was told.", tone: "beat", priority: PRIORITY.other }),
  senseDanger: (e) => ({ text: `Bad feeling about the ${e?.nextEncounter ?? "next encounter"}.`, tone: "magic", priority: PRIORITY.you }),
  mirrorSelf: (e) => ({ text: `A mirror image holds (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  wardRaised: (e) => ({ text: `${e?.spell ?? "The ward"} raises a ward (${e?.pool ?? 0})${e?.reflect ? ", reflecting" : ""}.`, tone: "magic", priority: PRIORITY.you }),
  strengthCast: (e) => ({ text: `Might surges +${e?.might ?? 0}.`, tone: "magic", priority: PRIORITY.you }),
  regenerationCast: () => ({ text: "Wounds start closing on their own.", tone: "magic", priority: PRIORITY.you }),
  insaneNoTarget: () => block("No one here to turn insane at."),
  insaneRolled: (e) => ({ text: `Insanity takes ${e?.target ?? "it"}.`, tone: "magic", priority: PRIORITY.other }),
  insaneStruckAlly: (e) => ({ text: `The maddened thing turns on ${e?.target ?? "an ally"} (${e?.dmg ?? 0}).`, tone: "hurt", priority: PRIORITY.you }),
  insaneFled: (e) => ({ text: `${e?.target ?? "It"} bolts, mad with fear.`, tone: "magic", priority: PRIORITY.you }),
  healed: (e) => ({ text: `+${e?.amount ?? 0} hp${e?.spell ? ` (${e.spell})` : ""}.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathSpellTooWeak: (e) => block(`Death: ${e?.fee ?? 25} hp fee. You cannot pay it and live.`),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathCast: (e) => ({ text: `Death: its fee (−${e?.cost ?? 25} hp).`, tone: "hurt", priority: PRIORITY.you }),
  dozed: (e) => ({ text: `${e?.target ?? "It"} dozes off (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  nothingToThrowAt: () => block("Nothing here to throw it at."),
  spellThrown: (e) => ({ text: `${e?.spell ?? "It"} at ${e?.target ?? "it"}.`, tone: "magic", priority: PRIORITY.you }),
  spellHit: (e) => ({
    text: `${e?.spell ?? "It"} hits ${e?.target ?? "it"} (${e?.dmg ?? 0})${(e?.mult ?? 1) > 1 ? ` ×${e.mult}` : ""}`,
    tone: "magic",
    priority: PRIORITY.you,
  }),
  frozenSolid: (e) => ({ text: `${e?.target ?? "It"} frozen solid.`, tone: "magic", priority: PRIORITY.you }),
  spellMissed: (e) => ({ text: `${e?.spell ?? "It"} misses ${e?.target ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  // Phase 25 (FEED-01): `doubled` names the heal2x race when the dose was doubled.
  potionDrunk: (e) => ({
    text: `Potion +${e?.amount ?? 0} hp (${e?.remaining ?? 0} left)${e?.doubled ? ` · ${e.doubled}` : ""}`,
    tone: "hit",
    priority: PRIORITY.you,
  }),
  scrollRead: (e) => ({ text: `You unroll: ${e?.spell ?? "something unreadable"}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 25 (FEED-02): a scroll refusal always names its reason; unknown/
  // absent reason still gets a voiced fallback.
  scrollRefused: (e) => {
    const map = {
      pilfer: "A Pilfer's hands know locks, not letters.",
      noRunes: "The runes mean nothing to you.",
      noScrolls: "You have no scroll to read.",
      // Phase 31 (CMB-01): Fight! not yet pressed.
      notFought: "Fight! first. The scroll will keep.",
    };
    return block(map[e?.reason] ?? "It stays rolled.");
  },
  scrollCopiedToGrimoire: (e) => ({ text: `${e?.spell ?? "It"} copied into your grimoire.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 40 (SPELL-07): the scroll's own spell isn't scribable yet — names
  // the level needed; the scroll still casts once for free right after.
  scrollTooAdvanced: (e) => ({ text: `${e?.spell ?? "It"} needs level ${e?.need ?? "?"}; you are ${e?.have ?? "?"}.`, tone: "miss", priority: PRIORITY.you }),
  scrollCast: (e) => ({ text: `The scroll casts: ${e?.spell ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),

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
      text += " (a discount, as always)";
    }
    return { text, tone, priority: PRIORITY.feature };
  },
  buyFailed: (e) => block(`Short ${e?.short ?? 0} wilmst.`),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  bought: (e) => ({ text: `Bought: ${e?.item ?? "something"} (−${e?.cost ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),
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
  rationsBought: (e) => ({ text: `Stocked up: +${e?.amount ?? 1} rations.`, tone: "hit", priority: PRIORITY.other }),
  itemSold: (e) => ({ text: `Sold: ${e?.item?.n ?? "something"} (${e?.price ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),

  /* ---------------- encounters.js ---------------- */

  // Phase 25.1 (DFB-01): tableFour/tableFourNoop left ORACLE_ONLY once the
  // "Move on" card is gated to CARD_EVENTS — the over-map overlay no longer
  // narrates these on the move path, so they need their own line. `result`
  // is already a full prose sentence (engine/encounters.js#tableFour).
  tableFour: (e) => ({ text: e?.result ?? "Something happens.", tone: "beat", priority: PRIORITY.other }),
  tableFourNoop: (e) => ({ text: e?.result ?? "Nothing much happens.", tone: "beat", priority: PRIORITY.other }),
  trapAvoided: (e) => ({ text: `You clock it early (${e?.roll ?? "?"} vs ${e?.need ?? "?"}).`, tone: "hit", priority: PRIORITY.other }),
  trapDisarmed: () => ({ text: "Pilfer: trap disarmed.", tone: "hit", priority: PRIORITY.feature }),
  trapDoubled: () => ({ text: "Cat Burglar: the trap hits twice as hard.", tone: "hurt", priority: PRIORITY.feature }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapSprung: (e) => ({ text: `Trap: ${e?.name ?? "A trap"} (−${e?.dmg ?? 0} hp).`, tone: "hurt", priority: PRIORITY.them }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapPoisoned: () => ({ text: "Trap: poisoned.", tone: "hurt", priority: PRIORITY.other }),
  chestOpened: (e) => ({
    text: e?.reason === "pilfer" ? "Pilfer: box open, no lock roll." : "The box gives up its secrets.",
    tone: "hit",
    priority: PRIORITY.feature,
  }),
  chestLockRolled: (e) => ({ text: `Lock: ${e?.roll ?? "?"} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
  chestLocked: () => ({ text: "The lock wins this round.", tone: "miss", priority: PRIORITY.other }),
  scrollFound: () => ({ text: "A scroll, tucked in with the loot.", tone: "hit", priority: PRIORITY.other }),
  foodFound: (e) => ({ text: `${e?.name ?? "Food"} (+${e?.wp ?? 0} hp).`, tone: "hit", priority: PRIORITY.other }),
  grimoireLearned: (e) => ({ text: `New spells: ${(e?.spells ?? []).join(", ") || "nothing new"}.`, tone: "hit", priority: PRIORITY.other }),
  faerieBoon: (e) => ({ text: `+${e?.amount ?? 0} base hp.`, tone: "hit", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  faerieBane: (e) => ({ text: `Faerie: −${e?.amount ?? 0} base hp.`, tone: "hurt", priority: PRIORITY.other }),
  joinerJoined: (e) => ({ text: `${e?.name ?? "Someone"} falls in beside you.`, tone: "hit", priority: PRIORITY.feature }),
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
      wilmsry: `${e?.name ?? "The Joiner"} takes one look at a Wilmsry and leaves.`,
    };
    return block(map[e?.reason] ?? "Word has reached the Joiners.");
  },
  afflictionRolled: (e) => ({ text: `Something is wrong with you: ${e?.kind ?? "it has its hooks in you"}.`, tone: "hurt", priority: PRIORITY.other }),
  phobiaAcquired: (e) => ({ text: `New fear: ${e?.name ?? "something"}.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  afflictionCaught: (e) => ({ text: `${e?.kind ?? "It"}: takes hold (−${e?.first ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  insanityRolled: (e) => ({ text: `Insanity — ${e?.result ?? "it comes apart"}.`, tone: "hurt", priority: PRIORITY.other }),
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  insanitySelfHarm: (e) => ({ text: `Insanity: you turn on yourself (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  insanityRage: (e) => ({ text: `Rage: +${e?.amount ?? 0} might.`, tone: "hurt", priority: PRIORITY.other }),
  darknessFell: () => ({ text: "The dark closes in.", tone: "hurt", priority: PRIORITY.other }),
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
  itemTaken: (e) => ({
    text: `Equipped: ${e?.item?.n ?? "something"}.${e?.replaced?.n ? ` The shopkeeper keeps your old ${e.replaced.n}.` : ""}`,
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
  toolRefused: (e) => {
    const map = {
      noTool: `No ${e?.tool ?? "tool"} on you. Wishing is not a tool.`,
      noHazard: `Nothing here for a ${e?.tool ?? "tool"}.`,
      unknown: "That is not a tool.",
    };
    return block(map[e?.reason] ?? "That does not work here.");
  },
  itemUsed: (e) => ({ text: `You use ${e?.item?.n ?? "something"}.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 31 (CMB-02/CMB-03/CMB-01): extends the pilfer-only reason map with
  // cooldown/wrongClass/combatOnly/exploreOnly/noTarget/notFought — the
  // pilfer text and the generic fallback stay byte-identical.
  // Phase 39 (GEAR-02): cooldown's wording moved to the vending-machine line;
  // a NEW "recharging" reason (an empty staff) gets its own line.
  useRefused: (e) => {
    const item = e?.item?.n ?? "That";
    const map = {
      pilfer: `${item} does not heal. Pilfers use only healing.`,
      cooldown: `${item}: ${e?.left ?? "?"} squares. It is not a vending machine.`,
      recharging: `${item}: ${e?.left ?? "?"} squares to the next charge. Patience is also a spell.`,
      wrongClass: `${item} is a stick to anyone who is not a Magic User.`,
      combatOnly: `${item} wants a target. Save it for a fight.`,
      exploreOnly: `${item} needs quieter surroundings.`,
      noTarget: "Nothing left to aim at.",
      notFought: "Fight! first. It will keep.",
      // Phase 37 (GEAR-03): a cloak/jewelry/staff activatable used from the
      // BAG in the new worn-slot model — activatables must be worn to work.
      notWorn: `${item} is in your bag, doing what things in bags do: nothing. Wear it first.`,
      // Phase 39 (GEAR-05): the torch used while not dark.
      notDark: "It is not dark. Save the torch for when it is.",
    };
    return block(map[e?.reason] ?? "That does not work for you.");
  },
  cured: (e) => ({ text: `Cured of ${e?.kind ?? "it"}.`, tone: "hit", priority: PRIORITY.you }),
  // Phase 31 (CMB-06): one line naming every stoned foe, ahead of the
  // per-foe foeKilled lines that follow.
  foeStoned: (e) => ({ text: `${(e?.names ?? []).join(", ") || "It"} turn to stone. Statues don't hit back.`, tone: "hit", priority: PRIORITY.you }),
  itemBurned: (e) => ({ text: `${e?.total ?? 0} fire damage spread.`, tone: "magic", priority: PRIORITY.you }),
  // Phase 39 (GEAR-02): the item activation model's four new events.
  itemEffectStarted: (e) => {
    const n = e?.left;
    const map = {
      haste: `Double attacks for ${n} squares.`,
      invis: `Unseen for ${n} squares.`,
      // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19):
      // states the count and, in voice, that ending inside stone is fatal —
      // the same warning eventNarration.js's Oracle line carries.
      ether: `${n} squares of walking through stone. Be in a corridor when it ends — the stone will not make room.`,
      acute: `You strike on a d6 for ${n} rounds.`,
      might: `+${e?.might ?? "?"} damage for ${n} squares.`,
      fly: `Twenty squares of not touching the floor.`,
      lit: `Forty squares of carrying a light.`,
      // 260918-w4n (use-activated-only): the 7 newly use-activated kinds.
      power: `+1 damage for ${n} squares. The ring approves.`,
      giant: `${n} squares of being one size too large for the corridor.`,
      glow: `Fifty squares of being your own lantern.`,
      unseen: `Unseen for ${n} squares. They need two better.`,
      tongue: `${n} squares of perfect fluency. Do not waste it on small talk.`,
      brace: `${n} squares with nothing critical landing on you.`,
      plate: `${n} squares of weightless plate.`,
    };
    return { text: map[e?.kind] ?? `${e?.item ?? "It"}: ${n} squares.`, tone: "magic", priority: PRIORITY.you };
  },
  itemEffectFaded: (e) => ({ text: `${e?.item ?? "It"} wears off.`, tone: "beat", priority: PRIORITY.other }),
  itemCooled: (e) => ({ text: `${e?.item ?? "It"} is ready again.`, tone: "hit", priority: PRIORITY.other }),
  staffRecharged: (e) => ({ text: `${e?.item ?? "It"} hums. ${e?.charges ?? "?"}/${e?.max ?? "?"}.`, tone: "hit", priority: PRIORITY.other }),
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
  itemEquipped: (e) => ({
    text: `Equipped: ${e?.item?.n ?? "something"}${e?.slot ? ` (${slotWord(e.slot)})` : ""}.${e?.replaced?.n ? ` ${e.replaced.n} goes back in the bag.` : ""}`,
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
