// src/browser/rail.js
//
// Phase 35 (Map Screen Rebuild), Plan 01 — the RAIL view-model: the
// out-of-combat twin of fightLog.js. The same `linesForAction(...,
// {limit: Infinity, withIdx: true})` fold that feeds the fight log
// (test/unit/fightLog.test.js's sibling module) feeds this module too — one
// dispatch, two destinations: rail (out of combat) or fight log (in combat).
// This is the Phase 32 partition re-read as "rail or log": the
// narrationLinesTable/narrationLinesCoverage invariants stay proven against
// narrationLines.js unchanged; this module is the ONE place the rail's
// icon/title/tone/hold vocabulary lives.
//
// PRESENTATION ONLY, pure module: no DOM/window/timer/storage access
// anywhere in this file. Its narration-line-table sibling supplies PRIORITY,
// ORACLE_ONLY, LINE_FOR, narrativeLineText and oracleDetailText; its
// narration sibling supplies narrateEvent — never from the rules tier. Every
// export is a plain function returning plain data; the shell (Plans 02-04)
// bridges this module's output onto window.__mzRail and renders it.
//
// Orchestrator decision 1 (climb dice, 35-RESEARCH OQ1): NO rules change.
// fellClimbing/fellInGorge/climbedOver/leaptOver carry no roll/need field
// today, so rollLineFor yields null for them — the rail shows the outcome
// line only (the narration already states the hp lost). rollLineFor is
// written generically (narration roll span first, else a numeric
// event.roll/need/hurt) so a later additive event payload lights climb
// dice up with zero shell change. Never fabricate a roll/need the event
// payload does not carry.
//
// Orchestrator decision 4 (no PICK THE LOCK): chest locks auto-resolve
// before any shell code sees the event (chestLockRolled/chestOpened/
// chestLocked); "A LOCKED BOX" below is an auto-clearing card with no
// action row. The only real decision on a chest tile is the pre-existing
// take-it/leave-it find prompt (Plan 02), not a new pick action.

import { PRIORITY, ORACLE_ONLY, LINE_FOR, narrativeLineText, oracleDetailText } from "./narrationLines.js";
import { narrateEvent } from "./eventNarration.js";
// Phase 38 (ABIL-01/03) — abilityPoolCard (below) reads the catalog's own
// name/txt for the level-1 pool-pick narration; pure content data, same
// discipline as eventNarration.js's existing content/flavor.js import.
import { ABILITY_BY_ID } from "../../content/index.js";

/** RAIL_TONES — the five tones every rail card and legend row speaks. */
export const RAIL_TONES = Object.freeze(["info", "good", "bad", "odd", "dull"]);

/**
 * RAIL_HOLD — named hold durations (ms) a rail card without an action row
 * auto-clears after. `default` covers most families; the rest are the
 * named exceptions the family table (below) opts into.
 */
export const RAIL_HOLD = Object.freeze({
  default: 4200,
  dull: 2400,
  dullShort: 2200,
  mark: 3400,
  day: 3000,
  floor: 5000,
  camp: 5200,
  level: 6000,
});

/**
 * WORN_RECONCILE_HOLD — Phase 37 (GEAR-04): the hold duration (ms) for the
 * one-shot worn-reconciliation card `wornReconcileCard` builds below. A
 * standalone export (not folded into RAIL_HOLD) since this card is built
 * directly by the shell's resume path (Plan 04), never through
 * `railCardFor`'s fold pipeline.
 */
export const WORN_RECONCILE_HOLD = 6000;

/**
 * RAIL_COPY — every player-facing string this module owns, in one object
 * literal so the voice scan (rail.test.js) can walk it recursively.
 */
export const RAIL_COPY = Object.freeze({
  idleTitle: "FLOOR {n} · NOTHING IS HAPPENING",
  idleLine: "Tap anywhere to step one square that way. Hold a square to inspect it, drag to look around, pinch to zoom.",
  peekStep: "TAP TO STEP",
  peekPinch: "PINCH OUT",
  noWay: { title: "NO WAY THAT DIRECTION", line: "Rock, both ways you tried. The corridor has opinions." },
  here: { title: "YOU ARE HERE", line: "For the moment, and with no particular claim to it." },
  unwalked: { title: "UNWALKED", line: "The lantern does not reach. Walk it and find out." },
  rock: { title: "SOLID ROCK", line: "A square of it, same as the corridor. No way through." },
  // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19): the
  // hold-inspect card for a wall while the cloak's window is live — the
  // rock is a real destination for the moment, and the fatal-end warning is
  // restated in voice on every hold.
  rockEther: { title: "SOLID ROCK", line: "Passable, for the moment. Do not be inside it when the moment ends." },
  // Phase 41 (TERR-01/02), Plan 04 — the water hold-inspect: names the tile
  // and its cost (waded's own rail line, RAIL_FAMILY.waded above, narrates
  // the moment of entry; this is what a HOLD on a water tile answers).
  water: { title: "WATER", line: "Two squares a step, and your boots never dry. Wade, or go around." },
  empty: { title: "EMPTY CORRIDOR", line: "Walked, lit, and entirely uninteresting. Enjoy it." },
  joiner: { title: "COMPANY", yes: "TAKE THEM ALONG", no: "LEAVE THEM" },
  find: {
    title: "SOMETHING WORTH TAKING",
    take: "TAKE IT",
    takeNow: "TAKE IT NOW",
    leave: "LEAVE IT",
    full: "Your bag is full ({have}/{slots}). Drop something to make room, or leave it.",
  },
  climb: { retry: "CLIMB IT" },
  // Phase 39 (GEAR-05), Plan 05 — the hazard pre-roll decision card (the
  // pending-tool choice at a fresh wall/gorge tile) and the retry card's
  // added tool button; RAIL_COPY.climb.retry (above) stays the plain
  // CLIMB IT fallback when no `feat` is known. `dark.torch` is the
  // Darkness card's USE TORCH offer.
  hazard: {
    title: "A CHOICE",
    ladder: "USE LADDER",
    rope: "USE ROPE",
    climb: "CLIMB IT",
    leap: "LEAP IT",
    wall: "A wall. You could climb it. You could also not.",
    crevice: "A crevice. Leaping is traditional. Rope is smarter.",
  },
  dark: { torch: "USE TORCH" },
  quit: { title: "BACK AGAIN TO QUIT", line: "Press back once more and this delve is abandoned. Nobody will write it down." },
  // Phase 37 (GEAR-04), rewritten 260918-wy1 (jewelry-merge): the one-shot
  // worn-reconciliation copy — wornReconcileCard (below) builds the actual
  // card; `title` is reused verbatim, `line` is a template
  // `wornReconcileCard` fills in per FAMILY, `what` maps a reconcileWorn
  // report's `slot` (a FAMILY — jewelry or cloak, per engine/derived.js#
  // SLOT_FAMILIES) to its plural noun-phrase.
  wornReconciled: {
    title: "GEAR",
    line: "You were wearing {count} {what}. Physics has filed a complaint — {bagged} {verb} in your bag now.",
    what: {
      jewelry: "pieces of jewelry",
      cloak: "cloaks on one back",
    },
  },
  // Phase 38 (ABIL-01/03) — the first-paint narration of a fresh run's
  // guaranteed level-1 pool pick (SC-3): abilityPoolCard (below) fills
  // {name}/{txt} from the catalog entry.
  abilityPool: { title: "UP YOUR SLEEVE", line: "New trick: {name} — {txt}" },
  fallback: {
    block: "NOTHING DOING",
    hurt: "THAT HURT",
    hit: "WELL THEN",
    miss: "NOTHING",
    magic: "MAGIC",
    dodge: "CLOSE",
    beat: "MEANWHILE",
  },
});

/**
 * RAIL_FAMILY — the icon/title/tone (and optional hold override) table for
 * every event type that gets its own rail identity. Titles carrying `{n}`
 * are resolved by railCardFor from the head event's depth/level/day field.
 * Every family not listed here falls through railFamilyFor's block/tone
 * fallback (below).
 */
export const RAIL_FAMILY = Object.freeze({
  // Traps — avoided/disarmed are the good outcome, sprung/doubled/poisoned bad.
  trapSprung: { icon: "✕", title: "A TRAP", tone: "bad" },
  trapDoubled: { icon: "✕", title: "A TRAP", tone: "bad" },
  trapPoisoned: { icon: "✕", title: "A TRAP", tone: "bad" },
  trapAvoided: { icon: "✕", title: "A TRAP", tone: "good" },
  trapDisarmed: { icon: "✕", title: "A TRAP", tone: "good" },

  teleported: { icon: "◆", title: "TELEPORTED", tone: "odd" },
  oneWayBlocked: { icon: "▲", title: "ONE-WAY DOOR", tone: "odd", hold: RAIL_HOLD.mark },

  // Chest lock auto-resolves before the shell ever sees it (decision 4).
  chestOpened: { icon: "▪", title: "A LOCKED BOX", tone: "good" },
  chestLockRolled: { icon: "▪", title: "A LOCKED BOX", tone: "good" },
  scrollFound: { icon: "▪", title: "A LOCKED BOX", tone: "good" },
  chestLocked: { icon: "▪", title: "THE LOCK HOLDS", tone: "bad" },

  // Climb/crevice — already-rolled outcomes (decision 1); no pre-roll preview.
  climbedOver: { icon: "⧗", title: "CLIMBED", tone: "good" },
  leaptOver: { icon: "⧗", title: "CLEARED IT", tone: "good" },
  fellClimbing: { icon: "⧗", title: "FELL", tone: "bad" },
  fellInGorge: { icon: "⧗", title: "FELL", tone: "bad" },
  // Phase 54 (BAND-02, USER RULING D): one-and-done — a failed climb/leap
  // that still lands you on the far side (fellClimbing/fellInGorge's card
  // shape, "bad" tone matched — no "warn" tone exists in this table's
  // vocabulary, see mazeworld.html's rail tone CSS).
  draggedOver: { icon: "⧗", title: "OVER, BARELY", tone: "bad" },
  flownOver: { icon: "⧗", title: "OVER IT", tone: "odd" },
  phasedThrough: { icon: "⧗", title: "OVER IT", tone: "odd" },
  // Phase 41 (TERR-02): entering water (once per wade, not per step).
  waded: { icon: "·", title: "WADING", tone: "odd" },
  // Phase 39 (GEAR-05): the hazard pre-roll decision card (hazardChoice is
  // ORACLE_ONLY on the line side — the card IS the UI, mirroring findOffered
  // — but still gets a family entry here for Plan 05's dedicated card) and
  // the spent-tool outcome.
  hazardChoice: { icon: "⧗", title: "A CHOICE", tone: "info" },
  toolUsed: { icon: "⧗", title: "OVER IT", tone: "good" },
  // Phase 39 (GEAR-05): the torch — lighting a live darkness, and a LATER
  // Darkness result held off entirely by the same lit effect.
  torchLit: { icon: "◇", title: "LIT", tone: "good" },
  darknessResisted: { icon: "◇", title: "LIT", tone: "good" },

  floorChanged: { icon: "▼", title: "FLOOR {n}", tone: "odd", hold: RAIL_HOLD.floor },
  leveled: { icon: "★", title: "SKILL LEVEL {n}", tone: "good", hold: RAIL_HOLD.level },
  // Phase 38 (ABIL-01/03): a level-pool ability roll — identical family to
  // leveled immediately above (numberFor reads e.level), so the two events
  // from one level-up fold into a single SKILL LEVEL N card whose second
  // line is the ability's "New trick" line (a later plan's shell work).
  abilityLearned: { icon: "★", title: "SKILL LEVEL {n}", tone: "good", hold: RAIL_HOLD.level },
  dayBegan: { icon: "☾", title: "DAY {n}", tone: "dull", hold: RAIL_HOLD.day },
  rested: { icon: "☾", title: "CAMP MADE", tone: "good", hold: RAIL_HOLD.camp },
  // Phase 43 (CLAR-01/05): the fed-night ration cost. `rested` is
  // PRIORITY.feature so a healing camp's head stays CAMP MADE by priority;
  // a full-hp camp (no `rested`) gets this FED title instead.
  rationsEaten: { icon: "☾", title: "FED", tone: "good", hold: RAIL_HOLD.camp },
  wentHungry: { icon: "☾", title: "NOTHING TO EAT", tone: "bad" },
  campFailed: { icon: "☾", title: "NOTHING TO EAT", tone: "bad" },
  wanderingMonster: { icon: "●", title: "SOMETHING WANDERED IN", tone: "bad" },

  tableFour: { icon: "●", title: "THE DOT", tone: "info" },
  tableFourNoop: { icon: "●", title: "THE DOT", tone: "dull", hold: RAIL_HOLD.dull },

  joinerJoined: { icon: "◇", title: "COMPANY", tone: "good" },
  joinerDeclined: { icon: "◇", title: "COMPANY", tone: "dull" },
  joinerLeft: { icon: "◇", title: "COMPANY", tone: "dull" },
  joinerMurdered: { icon: "◇", title: "COMPANY", tone: "bad" },
  // Phase 36 (JOIN-01): dismissJoiner's parting line. No dismissRefused row
  // — its refusals are PRIORITY.block and fall to the block fallback
  // (NOTHING DOING / dull).
  joinerDismissed: { icon: "◇", title: "COMPANY", tone: "dull" },

  findTaken: { icon: "▪", title: "TAKEN", tone: "good" },
  findLeft: { icon: "▪", title: "LEFT IT", tone: "dull", hold: RAIL_HOLD.dull },

  heightsFear: { icon: "·", title: "AFRAID", tone: "bad" },
  waterFear: { icon: "·", title: "AFRAID", tone: "bad" },
  trappedPanic: { icon: "·", title: "AFRAID", tone: "bad" },
  // Phase 41 (TERR-04/05): a fresh terrain-phobia region entry — its own
  // family (distinct title from the AFRAID rows above, which are the
  // existing roll-penalty/hp-loss events); this one arms the NEXT fight.
  phobiaTriggered: { icon: "·", title: "A PHOBIA", tone: "bad" },

  // Phase 39 (GEAR-02): the item activation model's four transition events.
  itemEffectStarted: { icon: "◇", title: "IN EFFECT", tone: "good" },
  itemEffectFaded: { icon: "◇", title: "WORN OFF", tone: "odd" },
  itemCooled: { icon: "◇", title: "READY", tone: "good" },
  staffRecharged: { icon: "◇", title: "CHARGED", tone: "good" },

  // Phase 40 (SPELL-01) — combat-only spell events, given a family entry for
  // completeness even though they fire only mid-fight (the fight log, not
  // this out-of-combat rail, is their real destination).
  iceApplied: { icon: "·", title: "ICE", tone: "odd" },
  weakenFaded: { icon: "·", title: "WEAKEN FADES", tone: "dull" },
  foeStupefied: { icon: "·", title: "STUPEFIED", tone: "odd" },
  // Phase 42 (FLEE-02) — another combat-only event, given a family entry for
  // completeness — the fight log is the real destination.
  fleeRolled: { icon: "·", title: "FLEE", tone: "info" },

  // Phase 40 (SPELL-02) — endCombat's own utility-effect expiry narration.
  sensesFaded: { icon: "·", title: "SENSES FADE", tone: "dull" },
  regenFaded: { icon: "·", title: "REGENERATION ENDS", tone: "dull" },

  // Phase 40 (SPELL-07) — a scroll's own spell isn't scribable yet.
  scrollTooAdvanced: { icon: "▪", title: "TOO ADVANCED", tone: "dull" },

  // Phase 40 (SPELL-05, Plan 04) — Map the Floor's time-boxed reveal: the
  // cast itself and the one sweep at expiry (Plan 05 paints spell-only
  // cells in a distinct map tint; this is the rail's own card identity).
  floorMapped: { icon: "◆", title: "MAPPED", tone: "odd" },
  revealFaded: { icon: "◆", title: "THE MAP FORGETS", tone: "dull" },
});

/**
 * RAIL_FEATURE_ICON — event family -> icons/optimized PNG key (a
 * FEATURE_ICONS key from icons.js) for the rail cards that describe landing
 * on a tile, 2026-09-17 UAT ruling. Every key is a RAIL_FAMILY key; families
 * with no tile identity are absent and render the glyph.
 *
 * Deliberate refinement of the ruling's literal "climb family -> crevice":
 * climbedOver/fellClimbing fire only on the `climb` feat, which the map
 * itself draws as wall.png (icons.js: `climb -> "wall"`), and the ruling is
 * "the actual icon" — so this table matches the map, not the crevice glyph.
 * flownOver/phasedThrough carry no feat (Flight/Ethereal fly over either
 * obstacle), so they keep the crevice icon per the ruling's literal text.
 *
 * Phase 39 (GEAR-05): `toolUsed` fires on EITHER a climb ("wall") OR a
 * gorge ("crevice") hazard — a single event TYPE covering both, unlike
 * climbedOver/leaptOver's separate types — so it is NOT listed here (this
 * table is keyed by type only, with no room to branch per instance).
 * `railCardFor` below reads the raw event's own `.feat` field directly at
 * its one lookup site instead, exactly mirroring this table's own
 * climb-is-wall / gorge-is-crevice mapping.
 */
export const RAIL_FEATURE_ICON = Object.freeze({
  trapSprung: "trap",
  trapDoubled: "trap",
  trapPoisoned: "trap",
  trapAvoided: "trap",
  trapDisarmed: "trap",
  teleported: "teleport",
  oneWayBlocked: "onewaydoor",
  chestOpened: "chest",
  chestLockRolled: "chest",
  scrollFound: "chest",
  chestLocked: "chest",
  climbedOver: "wall",
  fellClimbing: "wall",
  leaptOver: "crevice",
  fellInGorge: "crevice",
  flownOver: "crevice",
  phasedThrough: "crevice",
  floorChanged: "descent",
  tableFour: "encounter",
  tableFourNoop: "encounter",
  wanderingMonster: "encounter",
});

/**
 * RAIL_DIRECT — the ORACLE_ONLY event types the rail surfaces directly from
 * the Oracle narration (the retired Move-on card's floor arrival/level-up
 * and the find outcome). A strict subset of ORACLE_ONLY, disjoint from
 * LINE_FOR's keys (narrationLines.js is never edited — this reads the SAME
 * ORACLE_ONLY set a second, additive way).
 */
export const RAIL_DIRECT = new Set(["floorChanged", "dayBegan", "findTaken", "findLeft"]);

/**
 * railFamilyFor(type, tone, priority) — the family for `type` if one is
 * listed in RAIL_FAMILY (hold defaulted to RAIL_HOLD.default when the
 * family doesn't override it); otherwise the block/tone fallback: a
 * PRIORITY.block entry is always dull "NOTHING DOING" regardless of its
 * tone (the re-read partition invariant — a refusal never looks like an
 * outcome); every other unlisted type falls back by its line tone.
 */
export function railFamilyFor(type, tone, priority) {
  const fam = RAIL_FAMILY[type];
  if (fam) return { icon: fam.icon, title: fam.title, tone: fam.tone, hold: fam.hold ?? RAIL_HOLD.default };
  if (priority === PRIORITY.block) {
    return { icon: "·", title: RAIL_COPY.fallback.block, tone: "dull", hold: RAIL_HOLD.dull };
  }
  switch (tone) {
    case "hurt":
      return { icon: "·", title: RAIL_COPY.fallback.hurt, tone: "bad", hold: RAIL_HOLD.default };
    case "hit":
      return { icon: "·", title: RAIL_COPY.fallback.hit, tone: "good", hold: RAIL_HOLD.default };
    case "miss":
      return { icon: "·", title: RAIL_COPY.fallback.miss, tone: "dull", hold: RAIL_HOLD.dull };
    case "magic":
      return { icon: "·", title: RAIL_COPY.fallback.magic, tone: "odd", hold: RAIL_HOLD.default };
    case "dodge":
      return { icon: "·", title: RAIL_COPY.fallback.dodge, tone: "info", hold: RAIL_HOLD.default };
    default:
      return { icon: "·", title: RAIL_COPY.fallback.beat, tone: "info", hold: RAIL_HOLD.default };
  }
}

/**
 * rollLineFor(event, narrate) — the generic roll-line rule (decision 1):
 * (a) the Oracle's own sentence when its narration carries a roll span
 * (dice kept, tags stripped, via oracleDetailText); (b) else a generic
 * "roll N [· M to clear] [· −K hp]" line built from a numeric event.roll
 * (need/hurt appended only when present); (c) else null. `hurt` alone
 * NEVER fabricates a dice line — only a numeric `roll` unlocks the generic
 * line.
 */
export function rollLineFor(event, narrate) {
  const narrateFn = typeof narrate === "function" ? narrate : narrateEvent;
  const sentence = oracleDetailText(narrateFn(event));
  if (sentence) return sentence;
  if (!event || typeof event.roll !== "number") return null;
  let line = `roll ${event.roll}`;
  if (typeof event.need === "number") line += ` · ${event.need} to clear`;
  if (typeof event.hurt === "number") line += ` · −${event.hurt} hp`;
  return line;
}

/** numberFor(e) — the first of depth/level/day present on `e`, else "?". */
function numberFor(e) {
  if (!e) return "?";
  if (typeof e.depth === "number") return e.depth;
  if (typeof e.level === "number") return e.level;
  if (typeof e.day === "number") return e.day;
  return "?";
}

/**
 * railCardFor(type, events, folded, ctx = {}) — folds one out-of-combat
 * dispatch's `folded` (linesForAction's withIdx output) plus any
 * RAIL_DIRECT events present in `events` into ONE rail card. Every folded
 * entry becomes a line, uncapped; RAIL_DIRECT events are read directly from
 * `events` (they never appear in `folded` — narrationLines.js's ORACLE_ONLY set
 * excludes them from the fold). Lines stack newest-first (descending idx).
 * The head line (lowest PRIORITY, ties by lowest idx) picks the family's
 * icon/title/tone; hold is the max family hold across every line. Returns
 * null when there is nothing to show.
 */
export function railCardFor(type, events, folded, ctx = {}) {
  const narrate = ctx.narrate || narrateEvent;
  const evts = Array.isArray(events) ? events : [];
  const raw = [];

  for (const t of folded || []) {
    raw.push({
      text: narrativeLineText(t.text) || t.text,
      roll: t.idx != null ? rollLineFor(evts[t.idx], narrate) : null,
      idx: t.idx ?? -1,
      priority: t.priority,
      type: t.type,
      tone: t.tone,
    });
  }

  evts.forEach((e, idx) => {
    if (!e || !RAIL_DIRECT.has(e.type)) return;
    const text = narrativeLineText(narrate(e));
    if (!text) return;
    raw.push({ text, roll: rollLineFor(e, narrate), idx, priority: PRIORITY.other, type: e.type, tone: undefined });
  });

  if (!raw.length) return null;

  let head = raw[0];
  for (const l of raw) {
    if (l.priority < head.priority || (l.priority === head.priority && l.idx < head.idx)) head = l;
  }

  const fam = railFamilyFor(head.type, head.tone ?? "beat", head.priority);
  const title = fam.title.replace("{n}", String(numberFor(evts[head.idx])));
  const hold = Math.max(...raw.map((l) => railFamilyFor(l.type, l.tone ?? "beat", l.priority).hold));
  const sorted = [...raw].sort((a, b) => b.idx - a.idx);

  // Phase 39 (GEAR-05)/Phase 54 (BAND-02): toolUsed and draggedOver are the
  // RAIL_FEATURE_ICON exceptions — their icon depends on the raw event's
  // own `.feat` (climb -> wall, gorge -> crevice), not just its type (see
  // the table's own header comment).
  const headEvent = evts[head.idx];
  const iconKey =
    head.type === "toolUsed" || head.type === "draggedOver"
      ? headEvent?.feat === "climb"
        ? "wall"
        : "crevice"
      : (RAIL_FEATURE_ICON[head.type] ?? null);

  return {
    tone: fam.tone,
    icon: fam.icon,
    iconKey,
    title,
    lines: sorted.map(({ text, roll }) => ({ text, roll })),
    hold,
  };
}

/**
 * railLineCard(title, line, tone, hold, icon = "·", iconKey = null) — a
 * one-line card built directly (no fold pipeline involved) for shell call
 * sites that need to inject an idle/inspect/obstacle card verbatim (Plans
 * 02-04). `iconKey` (2026-09-17 UAT) is an optional trailing PNG key
 * (icons/optimized/<key>.png) for the hold-inspect card — null when the
 * inspected square has no tile identity worth an icon.
 */
export function railLineCard(title, line, tone, hold, icon = "·", iconKey = null) {
  return { icon, iconKey, title, lines: [{ text: line, roll: null }], tone, hold };
}

// COUNT_WORDS — Phase 37 (GEAR-04): the small-number words wornReconcileCard
// spells out ("two rings", not "2 rings"); a count of seven or more falls
// back to the plain digit (index 0 is unused — a report entry's bagged
// array is only ever built with length >= 1, so count is always >= 2).
const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six"];

/**
 * wornReconcileCard(report) — Phase 37 (GEAR-04), rewritten 260918-wy1
 * (jewelry-merge): builds the one-shot rail card for
 * `engine/saveState.js#validateSave`'s `wornReport` (surfaced once via
 * `engineAdapter#takeBootWornReport`, Plan 04's resume path). `null` for a
 * missing/empty report, or a report whose every entry bagged nothing (worn
 * cleanly, nothing to narrate). Otherwise builds one sentence pair per
 * populated (non-empty `bagged`) entry from `RAIL_COPY.wornReconciled`'s
 * template (`{count}` a spelled-out small number or a digit at 7+, `{what}`
 * the family's plural noun-phrase, `{bagged}` the bagged item names joined
 * with ", ", `{verb}` "is"/"are") and joins them with a single space.
 * `reconcileWorn`'s report now carries `worn` as an ARRAY (one or two names
 * for the jewelry family) — the count is `worn.length + bagged.length`
 * (defensively `1 + bagged.length` for a hand-built report whose `worn` is
 * still a bare string, so a legacy caller never throws). Pure: never
 * mutates `report`, no Date/Math.random/DOM. Not folded through
 * `railCardFor` — this is a standalone, directly-built card (mirrors
 * `railLineCard`'s posture), since the migration is a load-time event, not
 * an `applyAction` dispatch this module's fold pipeline ever sees.
 */
export function wornReconcileCard(report) {
  if (!Array.isArray(report)) return null;
  const entries = report.filter((r) => r && Array.isArray(r.bagged) && r.bagged.length > 0);
  if (!entries.length) return null;

  const { title, line, what } = RAIL_COPY.wornReconciled;
  const sentences = entries.map((r) => {
    const wornCount = Array.isArray(r.worn) ? r.worn.length : 1;
    const count = wornCount + r.bagged.length;
    const countWord = COUNT_WORDS[count] || String(count);
    const noun = what[r.slot] || "of those";
    const bagged = r.bagged.join(", ");
    const verb = r.bagged.length === 1 ? "is" : "are";
    return line.replace("{count}", countWord).replace("{what}", noun).replace("{bagged}", bagged).replace("{verb}", verb);
  });

  return { title, line: sentences.join(" "), tone: "dull", hold: WORN_RECONCILE_HOLD, icon: "▪" };
}

/**
 * abilityPoolCard(c) — Phase 38 (ABIL-01/03): the first-paint rail card for
 * a fresh run's guaranteed level-1 pool pick (SC-3) — the FIRST "pool"-
 * source id in `c.abilities` (chargen's own roll order: the level-1
 * guarantee is always the earliest pool id a fresh run has). `null` for a
 * missing/invalid `c`, an empty `c.abilities`, or a `c` whose abilities are
 * all table-sourced (a Magic User; structurally unreachable for a fresh
 * Fighter/Thief per SC-3, but never assumed). Not folded through
 * `railCardFor` — a standalone, directly-built card mirroring
 * `wornReconcileCard`'s own posture (a load-time/first-paint event, not an
 * `applyAction` dispatch this module's fold pipeline ever sees). Pure: no
 * mutation, no Date/Math.random/DOM.
 */
export function abilityPoolCard(c) {
  if (!c || !Array.isArray(c.abilities)) return null;
  const key = c.abilities.find((id) => ABILITY_BY_ID[id] && ABILITY_BY_ID[id].source === "pool");
  if (!key) return null;
  const meta = ABILITY_BY_ID[key];
  const { title, line } = RAIL_COPY.abilityPool;
  return {
    title,
    line: line.replace("{name}", meta.name).replace("{txt}", meta.txt),
    tone: "good",
    hold: RAIL_HOLD.level,
    icon: "★",
  };
}

/** emptyRail() — the rail's zero state: no card up, no decision pending. */
export function emptyRail() {
  return { seq: 0, card: null, pending: null };
}

/**
 * railPush(rail, card) — a NEW rail object with seq incremented, `card`
 * stamped with the new seq, `pending` preserved from the input. Never
 * mutates the input.
 */
export function railPush(rail, card) {
  const base = rail || emptyRail();
  const seq = base.seq + 1;
  return { seq, card: { ...card, seq }, pending: base.pending };
}

/** railClear(rail) — same seq, card cleared, pending preserved. */
export function railClear(rail) {
  const base = rail || emptyRail();
  return { ...base, card: null };
}

/**
 * railAnnouncement(rail, announcedSeq) — the aria-live announcer's next
 * text (seq-gated, mirrors fightLogAnnouncement): `{ seq: 0, text: "" }`
 * for a null card or a card whose seq is not newer than `announcedSeq`;
 * else `{ seq: card.seq, text }` where text joins the card's title and
 * every line's text with a single space.
 */
export function railAnnouncement(rail, announcedSeq) {
  if (!rail || !rail.card || rail.card.seq <= announcedSeq) return { seq: 0, text: "" };
  const { card } = rail;
  const text = `${card.title}. ${card.lines.map((l) => l.text).join(" ")}`;
  return { seq: card.seq, text };
}
