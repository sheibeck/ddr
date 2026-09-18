// src/browser/toasts.js
//
// Phase 25 (Toast architecture) — the pure, testable toast table that sits
// beside src/browser/eventNarration.js's EVENT_NARRATION (the Oracle log).
// TOAST_FOR maps every toasting engine event type to a SHORT
// `(e, ctx) => ({ text, tone, priority })` builder — the summary a player
// glances at; the Oracle line (eventNarration.js) stays the full sentence
// with the roll. 25-03 adds `toastsForAction` (aggregation/priority/cap) on
// top of this table; 25-04 wires the shell; 25-05 adds the coverage/manifest
// guards this file is built to satisfy.
//
// PRESENTATION ONLY, pure module: no DOM access, no `import` from engine/,
// and no Math.random/Date.now anywhere in this file (mirrors missLines.js's
// purity contract; 25-05 adds a standing guard). Every builder defends every
// field with `??`/`?.` so a bare `{ type }` call (the coverage guard's own
// invocation shape, same convention as eventNarration.js) never throws
// (T-25-08).
//
// ORACLE_ONLY is a one-directional allowlist: every engine event type NOT in
// that set gets a TOAST_FOR builder here. Nothing in ORACLE_ONLY ever
// duplicates information a toast already shows more completely — the toast
// is a summary, the Oracle is the record (T-25-10). FEATURE_EVENTS is the
// separate manifest of every class/sub-class/race feature + refusal event
// (25-CONTEXT.md's "Feature manifest" decision) — a strict subset of
// TOAST_FOR's keys, disjoint from ORACLE_ONLY.

// Phase 38 Plan 04 (ABIL-05): ABILITY_BY_ID maps a member ability's `via`
// key to its canon display name for allyStruck/allyMissed's optional clause
// — pure content data (not engine/), same discipline as
// eventNarration.js's own content/flavor.js import.
import { ABILITY_BY_ID } from "../../content/abilities.js";

/**
 * TONES — the tone-family vocabulary every toast (and the future host CSS,
 * 25-04) speaks. Two color families + two utilities:
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
 * PRIORITY — toast ordering (25-03's aggregator sorts ascending, then caps
 * at MAX_TOASTS): refusals/blocks first, then your outcome, then the enemy's
 * outcome, then feature call-outs, then everything else.
 */
export const PRIORITY = Object.freeze({ block: 0, you: 1, them: 2, feature: 3, other: 4 });

/** MAX_TOASTS — the host's visible cap (up from the prior hard-coded 3). */
export const MAX_TOASTS = 4;

/**
 * CARD_EVENTS — Phase 25.1 (DFB-01 decision 1). The ONLY move-path events
 * that still earn the dismissible "Move on" card: a NEW FLOOR and a
 * LEVEL-UP. Every other decision/big-update card (the encounter Fight!
 * gate, a Joiner offer, a find to keep/leave, death, the end-of-fight
 * report) is handled by its own shell branch already, not by this set —
 * this set exists only to gate the generic html-to-beats fallback the
 * shell falls back to when none of those dedicated branches apply. The
 * shell checks this set BEFORE that generic fallback; a dispatch whose
 * events contain BOTH a card event and toast-only events shows the card
 * AND raises the toasts (toasts are raised inside dispatchWithToasts
 * before the card is ever built — the card never swallows a toast).
 */
export const CARD_EVENTS = new Set(["floorChanged", "leveled"]);

/**
 * NARRATIVE_ACTIONS — Phase 25.1 (DFB-01 decision 2). The action types
 * whose direct-mapped toasts carry the Oracle's own sentence (dice
 * stripped) instead of the terse Phase 25 table text: move, camp,
 * resolveJoiner, dismissJoiner (Phase 36, JOIN-01). The shell passes a
 * `ctx.narrate` hook ONLY for these action types — every other action
 * (combat, store, inventory) keeps the short Phase 25 table text unchanged.
 */
export const NARRATIVE_ACTIONS = new Set(["move", "camp", "resolveJoiner", "dismissJoiner"]);

/**
 * Toast lifetime constants (Phase 25.1, DFB-02). `toastLifetime(len,
 * visible)` = min(TOAST_CAP_MS, TOAST_BASE_MS + TOAST_PER_CHAR_MS * len) +
 * TOAST_STACK_BONUS_MS * clamp(visible, 0, MAX_TOASTS - 1). Table: len 0 ->
 * 3000, len 1 -> 3060, len 99 -> 8940, len 100 -> 9000 (cap reached), len
 * 101 -> 9000; visible 3 -> +3600 (so the worst case is 9000 + 3600 =
 * 12600 ms); visible 4 clamps to 3 (MAX_TOASTS - 1); visible -1 clamps to
 * 0. Reduced motion never touches this number — it only shortens the CSS
 * transition (mazeworld.html's `prefers-reduced-motion` rule).
 */
export const TOAST_BASE_MS = 3000;
export const TOAST_PER_CHAR_MS = 60;
export const TOAST_CAP_MS = 9000;
export const TOAST_STACK_BONUS_MS = 1200;

/**
 * toastLifetime(len, visible) — integer milliseconds a toast should stay
 * on screen before auto-dismissing. Both inputs are defended (non-numeric
 * or negative collapses to 0; `visible` is additionally clamped to
 * [0, MAX_TOASTS - 1] since a toast can never see more than MAX_TOASTS - 1
 * siblings already on screen when it is raised).
 */
export function toastLifetime(len, visible) {
  const n = Math.max(0, Math.floor(Number(len) || 0));
  const v = Math.max(0, Math.min(MAX_TOASTS - 1, Math.floor(Number(visible) || 0)));
  return Math.min(TOAST_CAP_MS, TOAST_BASE_MS + TOAST_PER_CHAR_MS * n) + TOAST_STACK_BONUS_MS * v;
}

// The exact roll-span regex the shell's stripRollDetail() uses (mazeworld.html)
// so narrativeToastText strips dice detail identically to the over-map
// overlay's own stripping.
const ROLL_SPAN_RE = /<span class="roll">[\s\S]*?<\/span>\s*/g;

// Numeric-entity decode (&#39; / &#x27;) plus the fixed named-entity table
// narrativeToastText needs. &amp; is decoded LAST so a literal "&lt;" in the
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
 * narrativeToastText(html) — Phase 25.1 (DFB-01 decision 2). Turns one
 * Oracle HTML line into the plain-text sentence a toast shows: (a) drop
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
export function narrativeToastText(html) {
  const raw = String(html ?? "");
  const noRoll = raw.replace(ROLL_SPAN_RE, "");
  const noTags = noRoll.replace(/<[^>]+>/g, "");
  const decoded = decodeEntities(noTags);
  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * oracleDetailText(html) — Phase 34 (CSCR-04). The fight log's tap-reveal
 * line: the Oracle's own sentence with its dice KEPT (the opposite of
 * narrativeToastText, which strips the roll span). Needed because a
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
 * sibling always follows. These get NO toast entry; the Oracle never loses
 * information a toast shows (a toast is a summary, the Oracle is the
 * record — T-25-10). Any addition must carry a reason and obey the same
 * principle: never a feature, refusal, outcome, spell, or ability event.
 */
export const ORACLE_ONLY = new Set([
  "moved", // a plain step is already silent by design (engineAdapter.js) — not in the 209-type toast universe either
  "dayBegan", // the HUD's day counter already shows this
  "floorChanged", // the HUD's depth banner already shows this
  "spellChargeRecovered", // the grimoire/HUD charge display already shows this
  "spGained", // pure XP bookkeeping; foeKilled/parleyRolled toast the outcome that earned it
  "combatEnded", // the combat screen closing IS the signal
  "died", // dedicated death/epitaph screen
  "won", // dedicated victory banner
  "storeLeft", // the store screen closing IS the signal
  "encounterRolled", // internal table-roll bookkeeping; tableFour/tableFourNoop narrate the outcome
  "findOffered", // the dedicated Take it/Leave it prompt IS the UI
  "findTaken", // the dedicated Take it/Leave it prompt IS the UI
  "findLeft", // the dedicated Take it/Leave it prompt IS the UI
  "itemDropped", // the inventory screen's own drop action is the UI signal
  "itemUnequipped", // the inventory screen's own unequip action is the UI signal
  "joinerMet", // the dedicated Joiner recruitment prompt IS the UI
  "faerieMet", // the dedicated faerie encounter prompt IS the UI; faerieBoon/faerieBane toast the real outcome
  "grimoireSold", // the sell-flow's own confirmation is the UI signal
  "itemConsumed", // pure bookkeeping (a charge spent); the effect event itself already toasted
  "allyCast", // the allySpellHit/allySpellMissed sibling that always follows in the same action toasts the outcome and names the spell (one toast per cast)
]);

/**
 * FEATURE_EVENTS — every class/sub-class/race feature event and every
 * refusal/rejection event (25-CONTEXT.md's "Feature manifest" decision).
 * 25-05 proves this is a subset of TOAST_FOR's keys, disjoint from
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
];

// ─── Shared helpers (mirrors eventNarration.js's soakedText/needMods pattern) ─

/** block(text) — every refusal/rejection is amber, priority 0, voiced. */
function block(text) {
  return { text, tone: "block", priority: PRIORITY.block };
}

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
};
function equipRejectText(e) {
  return EQUIP_REJECT_TEXT[e?.reason] ?? "Not for the likes of you.";
}

// ─── toastsForAction pipeline (25-03) ─────────────────────────────────────
//
// `toastsForAction(type, events, ctx = {})` is the per-action pipeline the
// shell (25-04) calls once per dispatched action, after the events have
// already been decorated by decorateMisses (engineAdapter.js). Order:
//   1. encounterStart  — folds encounterStarted + its same-action followers
//      (trackable, allyJoined, warlockBoost, foeFled knight/conArtist,
//      foeBored, phobiaAfraid, combatInDark) into ONE toast.
//   2. enemyRound       — groups struckByFoe/foeMissed(hero) by foe name
//      into one toast per foe (3+ distinct names collapse into one), and
//      memberStruck/foeMissed(member) by (name, member) into their own
//      lower-priority toasts.
//   3. yourRound        — groups struck/strikeMissed(non-untouchable) by
//      target into one toast per target; untouchable misses stay separate.
//   4. spellChain       — folds spellThrown->spellHit/spellMissed/
//      frozenSolid/foeKilled per target (3+ targets collapse into one
//      Lightning-style toast), and folds a bare resistFailed away when a
//      resisted-but-failed effect event follows in the same action.
//   5. fleeChain / parleyChain / chestChain — fold a *Rolled event into its
//      outcome, appending the roll detail to the outcome's own text.
//   6. killFold         — appends the felled suffix (middle-dot + "felled")
//      to any your-round/spell-chain toast whose target a still-unconsumed
//      foeKilled names.
//   7. every remaining unconsumed, non-ORACLE_ONLY event is mapped through
//      TOAST_FOR directly.
//   8. dedupe per event type (table-mapped toasts only; aggregated toasts
//      are never deduped against each other), stable-sort ascending by
//      priority (ties keep engine order), then cap at MAX_TOASTS — so a
//      priority-0 refusal is never dropped and the cap always drops the
//      lowest-priority (highest number), latest-engine-order toasts first.
//
// `ctx.narrate` (Phase 25.1, DFB-01 decision 2) — `(e) => html string | ""`,
// supplied by the shell ONLY for NARRATIVE_ACTIONS (move/camp/resolveJoiner).
// In step 7 (the direct-mapped-event loop below), when `ctx.narrate` is a
// function AND the event's type is not in CARD_EVENTS, the toast text
// becomes `narrativeToastText(ctx.narrate(e))` — the Oracle's own sentence,
// dice stripped — with the table text as the fallback when the narration
// strips to nothing (never a blank toast). Every other action type keeps
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
 * grouped by foe name into one toast per foe (M===1 reuses the locked
 * single-swing TOAST_FOR builder verbatim; M>=2 uses the "K of M" wording);
 * 3+ distinct foe names collapse into ONE "${F} foes swing, ..." toast.
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
        built.push({ ...TOAST_FOR[entries[0].e.type](entries[0].e), idx: firstIdx });
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
      built.push({ ...TOAST_FOR[entries[0].e.type](entries[0].e), idx: firstIdx });
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
 * Untouchable misses are never grouped — TOAST_FOR.strikeMissed's own
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
      built.push({ ...TOAST_FOR[e.type](e), idx: firstIdx, ...(e.type === "struck" ? { _target: target } : {}) });
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
 * still-unconsumed `foeKilled` whose `name` matches a built toast's
 * `_target` (a landed hit on that name) gets folded into that toast's felled
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
 * `resistFailed` toast is suppressed and only the effect's own toast shows.
 */
const RESIST_FOLD_EFFECTS = new Set([
  "dozed",
  "stunned",
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
  "frozenSolid",
]);

/**
 * spellChain(events, consumed) — folds `spellThrown` -> its per-target
 * outcome (`spellHit`(+`frozenSolid`)(+`foeKilled`) | `spellMissed`) into
 * ONE toast per target; 3+ distinct targets (Lightning) collapse into one
 * "${spell}: ${T} targets, ${K} hit (${sum})" toast instead. Also consumes
 * a bare `resistFailed` when a RESIST_FOLD_EFFECTS event follows it in this
 * action (for the same target, or an untargeted AOE effect) — the effect's
 * own toast is the only one that shows.
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
      built.push({ ...TOAST_FOR.spellMissed({ ...events[missedIdx], spell: e0.spell }), idx: ti });
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
    built.push({ ...TOAST_FOR.spellHit({ ...hitE, spell: e0.spell }), idx: ti, _target: target });
  }
  return built;
}

/**
 * fleeChain(events, consumed) — `fleeRolled` + (`fled` | `fleeFailed`) fold
 * into ONE toast: the outcome's own text plus the roll detail
 * `(${roll}+${bonus} vs ${need})` (the `+${bonus}` segment omitted when
 * `bonus` is 0). A `fled` with no preceding `fleeRolled` (Cloaker/tracked)
 * keeps its own builder untouched.
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
        const b = TOAST_FOR[oe.type](oe);
        const bonusPart = e.bonus ? `+${e.bonus}` : "";
        built.push({ text: `${b.text} (${e.roll}${bonusPart} vs ${e.need})`, tone: b.tone, priority: b.priority, idx: i });
        break;
      }
      if (oe.type === "fleeRolled") break;
    }
  });
  return built;
}

/**
 * parleyChain(events, consumed) — `parleyRolled` + (`goldGained` why
 * "parley" | `parleyFailed` | `beastsSoothed`) fold into ONE toast: the
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
        const b = TOAST_FOR[oe.type](oe);
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
 * `chestLocked`) fold into ONE toast: the outcome's own text plus
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
        const b = TOAST_FOR[oe.type](oe);
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
 * combatInDark) into ONE toast; each follower appends a short clause and is
 * consumed. Without an `encounterStarted` in the action, every one of those
 * events keeps its own builder (this function simply returns null).
 */
function encounterStart(events, consumed) {
  const idx = events.findIndex((e, i) => !consumed.has(i) && e.type === "encounterStarted");
  if (idx === -1) return null;
  const e = events[idx];
  const base = TOAST_FOR.encounterStarted(e);
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
 * dedupeByType(list) — keeps the first toast of each event `type` in engine
 * order; a later toast of the SAME type with DIFFERENT text appends
 * ` ×${N}` to the kept toast. Aggregated toasts (no `.type` tag) are never
 * deduped against each other or against table-mapped toasts.
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
 * toastsForAction(type, events, ctx = {}, opts = {}) — the exported
 * per-action pipeline. See the header comment above this section for the
 * full order. Phase 32 (CMBUI-02) adds `opts.limit` (default MAX_TOASTS,
 * the toast host's visible cap): the Round Card requests the FULL folded
 * list with `{ limit: Infinity }` because every in-combat event has
 * exactly one presentation destination (design §6.4) and a fifth folded
 * line must not vanish. The default call (no opts, or opts without
 * `limit`) is byte-for-byte unchanged from before this option existed.
 * Phase 34 (CSCR-04) adds `opts.withIdx` (default false): when true, each
 * surviving folded entry keeps its `idx` (the index into `events` its
 * roll detail should be looked up from) and, for a directly-mapped event,
 * its `type` — so the fight log can derive per-line dice detail via
 * `oracleDetailText(narrateEvent(events[idx]))` without re-deriving the
 * fold/dedup pipeline. The default (no opts, or opts without `withIdx`)
 * return shape stays exactly `{ text, tone, priority }`, byte-for-byte
 * unchanged from before this option existed.
 */
export function toastsForAction(type, events, ctx = {}, opts = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const { limit = MAX_TOASTS, withIdx = false } = opts || {};
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
    const builder = TOAST_FOR[e.type];
    if (!builder) return;
    const { text, tone, priority } = builder(e, ctx);
    // Phase 25.1 (DFB-01 decision 2) — the ONE narrative-vs-table decision
    // point: for a narrative action's non-card event, prefer the Oracle's
    // own sentence (dice stripped); fall back to the table text when the
    // narration strips to nothing so a toast is never blank.
    const narrative = typeof ctx.narrate === "function" && !CARD_EVENTS.has(e.type) ? narrativeToastText(ctx.narrate(e)) : "";
    built.push({ text: narrative || text, tone, priority, idx, type: e.type });
  });

  const deduped = dedupeByType(built);
  deduped.sort((a, b) => a.priority - b.priority || a.idx - b.idx);
  const capped = deduped.slice(0, limit);
  return capped.map(({ text, tone, priority, idx, type: t }) =>
    withIdx ? { text, tone, priority, idx, ...(t !== undefined ? { type: t } : {}) } : { text, tone, priority }
  );
}

export const TOAST_FOR = {
  /* ---------------- movement.js ---------------- */

  oneWayBlocked: (e) => ({
    text: e?.side === "approach" ? "That door works once — already used." : "That door is furniture now.",
    tone: "beat",
    priority: PRIORITY.other,
  }),
  climbedOver: () => ({ text: "Over, and no worse for it.", tone: "hit", priority: PRIORITY.other }),
  leaptOver: () => ({ text: "Cleared it. No drama.", tone: "hit", priority: PRIORITY.other }),
  flownOver: () => ({ text: "You simply fly over it.", tone: "hit", priority: PRIORITY.other }),
  phasedThrough: () => ({ text: "You step through it like a rumour of a wall.", tone: "hit", priority: PRIORITY.other }),
  fellClimbing: (e) => ({ text: `You fall (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  fellInGorge: (e) => ({ text: `Short — the crevice introduces itself (−${e?.hurt ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  heightsFear: () => ({ text: "Your stomach reaches the ground first.", tone: "hurt", priority: PRIORITY.other }),
  waterFear: () => ({ text: "Something down there may be wet.", tone: "hurt", priority: PRIORITY.other }),
  trappedPanic: (e) => ({ text: `Four walls, one used door (−${e?.loss ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
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
  cloakHealed: (e) => ({ text: `Cloak mends +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.other }),
  cloakRegenerated: (e) => ({ text: `Flesh knits +${e?.amount ?? 0} hp.`, tone: "hit", priority: PRIORITY.other }),
  armorPatched: (e) => ({ text: `${e?.by ?? "Mending"}: +${e?.amount ?? 0} armour.`, tone: "hit", priority: PRIORITY.feature }),
  potionDuplicated: () => ({ text: "Warlock: +1 potion.", tone: "magic", priority: PRIORITY.feature }),
  wentHungry: (e) => ({ text: `No rations (−${e?.cost ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
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
  combatJoined: (e) => ({
    text: e?.first === "you" ? "You move first." : "They move first.",
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
  fleeRolled: (e) => ({ text: `Flee: ${e?.roll ?? "?"}+${e?.bonus ?? 0} vs ${e?.need ?? "?"}`, tone: "beat", priority: PRIORITY.other }),
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
  // DFB-05 (Phase 25.1): a Magic User member's cast outcome — one toast per
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

  /* ---------------- foe abilities (engine/foeAbilities.js) ---------------- */

  foeCast: (e) => ({ text: `${e?.name ?? "It"}: ${e?.txt ?? "something unpleasant"}`, tone: "dodge", priority: PRIORITY.them }),
  foeBolted: (e) => {
    const suffix = soakSuffix(e?.soaked);
    return e?.member
      ? { text: `${e?.name ?? "It"} bolts ${e.member} (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.feature }
      : { text: `${e?.name ?? "It"} bolts you (${e?.dmg ?? 0})${suffix}`, tone: "hurt", priority: PRIORITY.them };
  },
  foeDrained: (e) => ({ text: `${e?.name ?? "It"} drains you (+${e?.stolen ?? 0} to it).`, tone: "hurt", priority: PRIORITY.them }),
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
  // Plan 04 (ABIL-05): the fourteen ability-activation/effect toasts below
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
  dotTick: (e) => ({ text: `${e?.target ?? "It"} takes ${e?.dmg ?? 0} from the poison.`, tone: "hurt", priority: PRIORITY.them }),
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
  backfireSelfDamage: (e) => ({ text: `It costs you ${e?.amount ?? 0} hp.`, tone: "hurt", priority: PRIORITY.you }),
  // Phase 25 (25-03): no trailing period — matches the aggregate-format
  // convention (struckByFoe/foeMissed/struck etc. carry none either) so a
  // resisted-spell toast reads consistently with the rest of the pipeline.
  spellResisted: (e) => ({ text: `${e?.target ?? "It"} resists ${e?.spell ?? "it"}`, tone: "miss", priority: PRIORITY.you }),
  resistFailed: (e) => ({ text: `${e?.target ?? "It"} fails to resist.`, tone: "hit", priority: PRIORITY.you }),
  summonBackfired: (e) => ({ text: `The summoning costs you ${e?.amount ?? 0} hp.`, tone: "hurt", priority: PRIORITY.you }),
  allySummoned: (e) => ({ text: `${e?.name ?? "Something"} answers the call.`, tone: "magic", priority: PRIORITY.you }),
  allyPending: (e) => ({ text: `${e?.name ?? "Something"} is coming.`, tone: "magic", priority: PRIORITY.you }),
  stunned: (e) => ({ text: `${e?.count ?? 0} freeze in place.`, tone: "magic", priority: PRIORITY.you }),
  weakened: () => ({ text: "They hit softer now.", tone: "magic", priority: PRIORITY.you }),
  stupefied: (e) => ({ text: `${e?.target ?? "It"} forgets what it is doing.`, tone: "magic", priority: PRIORITY.you }),
  blinded: (e) => ({ text: `${e?.target ?? "It"} cannot see a thing.`, tone: "magic", priority: PRIORITY.you }),
  shrunk: (e) => ({ text: `${e?.count ?? 0} shrink to half size.`, tone: "magic", priority: PRIORITY.you }),
  acidApplied: (e) => ({ text: `${e?.target ?? "It"} starts to dissolve (${e?.rounds ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  earthquake: (e) => ({ text: `The floor heaves (${e?.amount ?? 0}).`, tone: "magic", priority: PRIORITY.you }),
  earthquakeSelfDamage: (e) => ({ text: `The shaking costs you ${e?.amount ?? 0} hp too.`, tone: "hurt", priority: PRIORITY.you }),
  vaporRolled: (e) => ({ text: `Noxious vapor (${e?.roll ?? "?"}).`, tone: "magic", priority: PRIORITY.other }),
  volley: (e) => ({ text: `${e?.rolls ?? 0} shots, ${e?.totalDamage ?? 0} total.`, tone: "magic", priority: PRIORITY.you }),
  petrified: (e) => ({ text: `${e?.target ?? "It"} turns to stone.`, tone: "magic", priority: PRIORITY.you }),
  walkingDeadTurned: (e) => ({ text: `${e?.count ?? 0} of the dead flee.`, tone: "magic", priority: PRIORITY.you }),
  nothingToTurn: () => block("Nothing here to turn."),
  planeGated: (e) => ({ text: `${e?.count ?? 0} gated straight back out.`, tone: "magic", priority: PRIORITY.you }),
  gateRefused: () => block("There is no plane here worth opening."),
  sensesGained: () => ({ text: "Your senses sharpen.", tone: "magic", priority: PRIORITY.you }),
  detectMagic: () => ({ text: "The floor lights up.", tone: "magic", priority: PRIORITY.you }),
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
  deathSpellTooWeak: () => block("You are too weak yourself to cast it."),
  deathCast: () => ({ text: "You spend 25 hp calling on Death.", tone: "hurt", priority: PRIORITY.you }),
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
  bought: (e) => ({ text: `Bought: ${e?.item ?? "something"} (${e?.cost ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),
  rationsBought: (e) => ({ text: `Stocked up: +${e?.amount ?? 1} rations.`, tone: "hit", priority: PRIORITY.other }),
  itemSold: (e) => ({ text: `Sold: ${e?.item?.n ?? "something"} (${e?.price ?? 0} wilmst).`, tone: "hit", priority: PRIORITY.other }),

  /* ---------------- encounters.js ---------------- */

  // Phase 25.1 (DFB-01): tableFour/tableFourNoop left ORACLE_ONLY once the
  // "Move on" card is gated to CARD_EVENTS — the over-map overlay no longer
  // narrates these on the move path, so they need their own toast. `result`
  // is already a full prose sentence (engine/encounters.js#tableFour).
  tableFour: (e) => ({ text: e?.result ?? "Something happens.", tone: "beat", priority: PRIORITY.other }),
  tableFourNoop: (e) => ({ text: e?.result ?? "Nothing much happens.", tone: "beat", priority: PRIORITY.other }),
  trapAvoided: (e) => ({ text: `You clock it early (${e?.roll ?? "?"} vs ${e?.need ?? "?"}).`, tone: "hit", priority: PRIORITY.other }),
  trapDisarmed: () => ({ text: "Pilfer: trap disarmed.", tone: "hit", priority: PRIORITY.feature }),
  trapDoubled: () => ({ text: "Cat Burglar: the trap hits twice as hard.", tone: "hurt", priority: PRIORITY.feature }),
  trapSprung: (e) => ({ text: `${e?.name ?? "A trap"} (${e?.dmg ?? 0}).`, tone: "hurt", priority: PRIORITY.them }),
  trapPoisoned: () => ({ text: "The trap leaves something behind.", tone: "hurt", priority: PRIORITY.other }),
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
  faerieBane: (e) => ({ text: `−${e?.amount ?? 0} base hp.`, tone: "hurt", priority: PRIORITY.other }),
  joinerJoined: (e) => ({ text: `${e?.name ?? "Someone"} falls in beside you.`, tone: "hit", priority: PRIORITY.feature }),
  // Phase 25.1 (DFB-04): fallback/coverage table text — on the resolveJoiner
  // action the narrative ctx (NARRATIVE_ACTIONS) replaces this with the
  // snark exit sentence from EVENT_NARRATION.joinerLeft instead.
  joinerLeft: (e) => ({ text: `${e?.name ?? "Your companion"} walks. ${e?.replacedBy ?? "Someone new"} is in.`, tone: "beat", priority: PRIORITY.feature }),
  // Phase 36 (CUT-02): fallback/coverage text — on the move action the
  // narrative ctx replaces it with the EVENT_NARRATION line.
  joinerMurdered: (e) => ({ text: `${e?.name ?? "Your companion"} did not reach floor ${e?.depth ?? "?"}.`, tone: "hurt", priority: PRIORITY.feature }),
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
  afflictionCaught: (e) => ({ text: `${e?.kind ?? "It"} takes hold (−${e?.first ?? 0} hp).`, tone: "hurt", priority: PRIORITY.other }),
  insanityRolled: (e) => ({ text: `Insanity — ${e?.result ?? "it comes apart"}.`, tone: "hurt", priority: PRIORITY.other }),
  insanitySelfHarm: () => ({ text: "You turn on yourself.", tone: "hurt", priority: PRIORITY.other }),
  insanityRage: (e) => ({ text: `Rage: +${e?.amount ?? 0} might.`, tone: "hurt", priority: PRIORITY.other }),
  darknessFell: () => ({ text: "The dark closes in.", tone: "hurt", priority: PRIORITY.other }),
  darknessLifted: () => ({ text: "The dark loosens its grip.", tone: "hit", priority: PRIORITY.other }),
  darknessDispelled: () => ({ text: "Your amulet burns the dark away.", tone: "hit", priority: PRIORITY.other }),
  miscMagicRolled: (e) => ({ text: `Miscellaneous magic: ${e?.what ?? "something"}.`, tone: "beat", priority: PRIORITY.other }),

  /* ---------------- items.js / inventory actions ---------------- */

  itemGiven: (e) => ({ text: `Received: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.other }),
  // Phase 24/25: woodsman and acrobat each get their own reason; the generic
  // fallback covers wrongClass/notBetter/noArmor/tooHeavy/notEquippable.
  itemRejected: (e) => block(equipRejectText(e)),
  itemTaken: (e) => ({ text: `Equipped: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.other }),
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
      ether: `${n} squares of walking through stone.`,
      acute: `You strike on a d6 for ${n} rounds.`,
      might: `+${e?.might ?? "?"} damage for ${n} squares.`,
      fly: `Twenty squares of not touching the floor.`,
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
  itemEquipped: (e) => ({
    text: `Equipped: ${e?.item?.n ?? "something"}${e?.slot ? ` (${e.slot})` : ""}.${e?.replaced?.n ? ` ${e.replaced.n} goes back in the bag.` : ""}`,
    tone: "hit",
    priority: PRIORITY.other,
  }),
  equipRejected: (e) => block(equipRejectText(e)),
  // Phase 29 (LOOT-05): a bag upgrade item was taken — c.bag just went up a tier.
  bagUpgraded: (e) => ({ text: `Bigger bag: ${e?.slots ?? "more"} slots.`, tone: "hit", priority: PRIORITY.you }),

  /* ---------------- pending loot pile (LOOT-01/02/06, Phase 29) ---------------- */

  lootDropped: (e) => ({ text: `Dropped: ${e?.name ?? "something"}. It will keep.`, tone: "beat", priority: PRIORITY.other }),
  lootTaken: (e) => ({ text: `Taken: ${e?.item?.n ?? "something"}.`, tone: "hit", priority: PRIORITY.you }),
  lootLeft: (e) => ({ text: `Left behind: ${e?.item?.n ?? "it"}.`, tone: "miss", priority: PRIORITY.you }),
  lootForfeited: (e) => {
    const names = (e?.items ?? []).map((i) => i?.n ?? "something").join(", ") || "the spoils";
    return {
      text: e?.reason === "died" ? `Left where they fell: ${names}.` : `Left on the floor in your hurry: ${names}.`,
      tone: "miss",
      priority: PRIORITY.you,
    };
  },
};
