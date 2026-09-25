// src/browser/eventNarration.js
//
// EVENT_NARRATION — the data-driven event-type -> narration-line lookup
// table that closes 04-RESEARCH.md's Pitfall 4 (formatEvent's monolithic
// switch silently dropping unrecognized engine event types). This table is
// the single source of truth engineAdapter.js#formatEvent delegates to; the
// coverage guardrail (test/unit/formatEventsCoverage.test.js) derives the
// full ~162-type vocabulary directly from engine/*.js source and asserts
// EVERY one of them has a non-null entry here.
//
// Presentation only: this module never touches state.rngState, never reads
// GameState directly, and never imports from engine/ — it only formats the
// plain {type, ...} event objects applyAction already returned. Each entry
// is a small (e) => string builder so a Phase 5 voice generator has a clean,
// enumerable seam to replace wholesale (per 04-04-PLAN.md's objective).
//
// Tone: deadpan sarcasm, dark-but-family-friendly (no profanity/gore) — the
// terse functional copy this phase writes; Phase 5's data-driven voice
// generator enriches it. Span classes (hit/miss/hurt/roll/beat/banner) match
// mazeworld.html's existing logLine CSS so migrated lines render unchanged.
//
// Every builder defends against a missing/undefined field (via `??`/`?.`)
// rather than crashing — real engine payloads always carry their documented
// fields, but the coverage test itself calls each builder with only
// `{type}` (no other fields), and a future engine payload-shape tweak should
// degrade gracefully rather than throw and break the whole render loop.
//
// NOTE: "moved" is intentionally NOT an entry in this table — a plain step
// stays silent by design (engineAdapter.js special-cases it before ever
// consulting this table; see its own comment). "pendingEncounter",
// "pendingTrap", "pendingChest" (the 01-07/01-09 placeholder events) are
// also intentionally absent: encounters.js has fully replaced them since
// 01-10, so the engine never emits them anymore — keeping stale entries here
// would violate the coverage test's "no dead/typo entries" guard.

// Phase 25.1 (DFB-04): JOINER_EXIT_LINES is pure DATA (no rng, no DOM, no
// engine/ import) — importing it here does not violate this module's
// presentation-only contract.
import { JOINER_EXIT_LINES, JOINER_MURDER_LINES, JOINER_PARTING_LINES } from "../../content/flavor.js";
// Phase 38 Plan 04 (ABIL-05): ABILITY_BY_ID maps a member ability's `via`
// key to its canon display name for allyStruck/allyMissed's optional clause
// — pure content data, no engine/ import, same discipline as the flavor.js
// import above.
import { ABILITY_BY_ID } from "../../content/abilities.js";
// 260918-wy1 (jewelry-merge): slotWord (jewelry1/jewelry2 -> "jewelry",
// cloak -> "cloak", everything else passes through) — imported from
// narrationLines.js. The import is one-directional: this file imports from
// narrationLines.js, never the reverse (the no-cycle rule the coverage test
// pins).
import { slotWord, initiativeVerdictText } from "./narrationLines.js";
// Phase 61 (STORE-02/STORE-03): purchaseBagged's "why isn't this an
// upgrade" clause formats engine/derived.js#gearCompareParts through the
// SAME zero-import formatter narrationLines.js's rail line uses — importing
// it here does not violate this module's presentation-only contract
// (upgradeWhy.js carries no engine/ import of its own).
import { upgradeWhyText } from "./upgradeWhy.js";
// Phase 73 (ROLL-05): the ONE place a roll-high winning range is written —
// every event-driven roll line this plan converts (strikeMissed/struck; the
// foe-side/thrown lines convert in 73-05/73-07) formats its range through
// rangeText here, so no two surfaces ever write a range differently.
import { rangeText } from "./rollRange.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Phase 25.1 (DFB-04): a member/newcomer name is interpolated TWICE into
// markup for the joinerLeft snark line — escape so a name containing '<'
// renders as visible text, never a live tag.
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Phase 25 (FEED-01, additive payload) shared render helpers — both are pure
// string builders over the new additive event fields, reused by every
// combat-narration entry below that can carry `soaked`/`needMods`. Neither
// throws on a missing/empty input (mirrors this module's `??`/`?.` defense
// convention), so the coverage guard's bare `{type}` calls stay safe.

/** soakedText(soaked) — " (hide soaked 2)" / " (Hardiness soaked 3, ward soaked 4)" / "" */
function soakedText(soaked) {
  if (!soaked) return "";
  const parts = [];
  if (soaked.hardiness) parts.push(`Hardiness soaked ${soaked.hardiness}`);
  if (soaked.hide) parts.push(`hide soaked ${soaked.hide}`);
  if (soaked.ward) parts.push(`ward soaked ${soaked.ward}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/** modsText(mods) — "Guard −1" / "Agility −1, Guard −1" (Phase 73, ROLL-05:
 * renamed from needModsText — the values are unchanged, still signed bonuses
 * to the roller; only the name lost its roll-under "need" framing). */
function modsText(mods) {
  return (mods || []).map((m) => `${m.name} ${m.delta < 0 ? "−" : "+"}${Math.abs(m.delta)}`).join(", ");
}

/** modsClause(mods) — " (Guard −1, insulted +1)" appended right after the
 * roll-high range ("vs 16–20"); "" when absent. Phase 73 (ROLL-05): every
 * foe-swing and member-branch line now reads this — the threshold is
 * already visible in the range, so no "needs N:" prefix is needed. */
function modsClause(mods) {
  return mods && mods.length ? ` (${modsText(mods)})` : "";
}

// Phase 41 (TERR-05): the short `trigger` key engine/phobias.js pushes on
// every `phobiaTriggered` event (and stashes on `c.fearArmed.trigger`) maps
// to this narrated phrase — used both by `phobiaTriggered`'s own line below
// and by `phobiaAfraid`'s "Still rattled from ..." clause once the armed
// fear actually opens a fight. Exported so other modules (rail/narrationLines)
// never need to re-derive the same vocabulary by hand.
export const PHOBIA_TRIGGER_PHRASE = Object.freeze({
  water: "the water",
  dark: "the dark",
  heights: "the drop",
  deadEnd: "the dead end",
  nearDeath: "your own pulse",
});

// Phase 43 (CLAR-05): the rule sentence the rest narration appends once per
// distinct race among the eaters that has one — see docs/RATIONS.md. Mirrors
// PHOBIA_TRIGGER_PHRASE's own precedent: a small, exported, frozen race ->
// phrase map so other modules never re-derive the same vocabulary by hand.
// src/browser/viewModels.js#RATIONS_COPY.why is the Hero-sheet clause form
// of this SAME map (the same race key drives both surfaces, so they can
// never disagree about which races carry a named rule).
export const RATION_RULE_LINE = Object.freeze({ Troll: "Trolls eat for two." });

export const EVENT_NARRATION = {
  /* ---------------- movement.js (migrated verbatim from the prior formatEvent switch) ---------------- */

  // Pass B2 group 3: voice cleanup for the 8 feature-landing buckets the
  // over-map encounter overlay shows (dark-but-family-friendly, matching
  // design/Mazeworld Mobile.dc.html's deadpan tone). Any dice-mechanics
  // clause that should vanish from the overlay (Pass B2 group 1's
  // stripRollDetail, mazeworld.html) is kept entirely inside its own
  // `<span class="roll">` (trailing punctuation included) so what remains
  // after stripping is always a clean, complete sentence — not a dangling
  // fragment. The Oracle log still shows the full line, dice and all.
  oneWayBlocked: (e) =>
    e.side === "approach"
      ? `Someone built this door to work exactly once, and used their turn already. <span class="miss">It will not open from this side.</span>`
      : `<span class="miss">You are through. That door is furniture now — there is no coming back.</span>`,
  climbedOver: () => `<span class="hit">Over, and no worse for it.</span>`,
  leaptOver: () => `<span class="hit">Cleared it. No drama.</span>`,
  // Phase 54 (BAND-02, USER RULING D): one-and-done — a failed climb/leap
  // that still lands you on the far side.
  draggedOver: (e) =>
    e.feat === "gorge"
      ? `<span class="hurt">Across, technically. The crevice kept your dignity as a toll.</span>`
      : `<span class="hurt">Over, eventually. The wall took its cut on the way.</span>`,
  // audit-batch1 (2026-09-09, A2): Bracelet of Flight / Cloak of Flying skip
  // the climb/leap roll entirely — see engine/movement.js's climb/gorge
  // block. Wording deliberately terse for now; Batch 2 owns the full A1/A2
  // narration polish pass.
  flownOver: () => `<span class="hit">You simply fly over it.</span>`,
  // Phase 15 item-wiring (ECON-08): the Cloak of Ether phases you straight
  // through the wall/crevice — no roll, no fall. Deadpan, matching flownOver.
  phasedThrough: () => `<span class="hit">You step through it like it was a rumour of a wall.</span>`,
  // Phase 41 (TERR-02): entering a water cell (once per wade, not per
  // step) — the water-cost Key Decision's one narrated beat.
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  waded: (e) => `<span class="beat">Water: ${e?.cost ?? 2} squares a step, and it smells worse.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  fellClimbing: (e) => `<span class="hurt">Fall: the wall had other plans.</span> −${e.hurt ?? 0} hp.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  fellInGorge: (e) => `<span class="hurt">Fall: short. The floor of the crevice makes its introduction.</span> −${e.hurt ?? 0} hp.`,
  // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19): the
  // fatal outcome — mirrors fellClimbing/fellInGorge's own hurt-tone
  // placement; the "You have died." line that follows is `died`'s own.
  entombed: () => `<span class="hurt">The cloak gives out. The stone does not.</span>`,
  // Phase 39 (GEAR-05): the hazard pre-roll decision — a rail card IS the
  // UI (ORACLE_ONLY on the line side, like findOffered), but the Oracle
  // still gets its own line.
  hazardChoice: (e) =>
    e.tool === "ladder"
      ? `<span class="beat">A wall. Also: a ladder. Someone thought of everything, and it was you.</span>`
      : `<span class="beat">A crevice, and you happen to have rope. The honest way across.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  toolUsed: (e) =>
    e.tool === "ladder"
      ? `<span class="hit">Ladder: up and over the wall. The ladder stays behind.</span>`
      : `<span class="hit">Rope: across the gap, boring and safe. The rope stays behind.</span>`,
  toolRefused: (e) => {
    const map = {
      noTool: `<span class="miss">No ${e.tool ?? "tool"} on you. Wishing is not a tool.</span>`,
      noHazard: `<span class="miss">Nothing here for a ${e.tool ?? "tool"}.</span>`,
      unknown: `<span class="miss">That is not a tool.</span>`,
    };
    return map[e.reason] ?? `<span class="miss">That does not work here.</span>`;
  },
  // PHOBIA-01 (04.1-06): the three formerly-inert movement-triggered phobias
  // — deadpan, no exclamation, matching the module's established tone.
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  heightsFear: (e) => `<span class="beat">Heights: your stomach reaches the ground well before your feet do.</span> +${e?.penalty ?? 0} on a roll you wanted low.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  waterFear: (e) => `<span class="beat">Bodies of water: something down there may be wet. That is enough.</span> +${e?.penalty ?? 0} on a roll you wanted low.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trappedPanic: (e) => `<span class="hurt">${e?.phobia ?? "Being trapped"}: four walls and one door you already used.</span> −${e?.loss ?? 0} hp.`,
  // Phase 41 (TERR-04/05, user-ratified Key Decision 2026-09-18: "arm Afraid
  // for the next fight"): a fresh terrain-phobia region entry — named by
  // `e.trigger` — fires ONCE per fresh entry (engine/phobias.js's region
  // model), narrates immediately, and arms `c.fearArmed` for the next fight
  // (no mechanical effect here — see phobiaAfraid's own "Still rattled"
  // clause below for where the penalty actually lands). The dead-end line is
  // deliberately DIFFERENT from trappedPanic's "Four walls..." line above —
  // both can fire on the very same step (trappedPanic's hp loss is retained,
  // unchanged; this is the additional, once-per-entry region narration).
  phobiaTriggered: (e) => {
    const lines = {
      water: `<span class="hurt">Water. You knew this was coming. Your knees did too.</span>`,
      dark: `<span class="hurt">The dark. It was always going to be the dark.</span>`,
      heights: `<span class="hurt">That is a long way down. Your stomach has already left.</span>`,
      deadEnd: `<span class="hurt">A dead end. The walls lean in a little, just to be sure.</span>`,
      nearDeath: `<span class="hurt">You can hear your own pulse. It sounds unimpressed.</span>`,
    };
    const line = lines[e?.trigger] ?? `<span class="hurt">Your phobia has noticed where you are.</span>`;
    return `${line} It will show in the next fight.`;
  },
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  afflictionTick: (e) =>
    (e.loss ?? 0) > 0
      ? `<span class="hurt">${e.kind ?? "It"}: still in you.</span> −${e.loss} hp.`
      : `<span class="hurt">${e.kind ?? "It"}: it has taken everything it can. You are on one hp.</span>`,
  // A1 fix #2 / P2 (04.2 Text batch): these now NAME what passed/cured — the
  // engine pushes `kind` (Poison/Disease) on both (engine/movement.js). The
  // over-map/Oracle line used to be a nameless "It passes." / "Cured.".
  afflictionPassed: (e) => `<span class="hit">The ${e.kind ?? "worst of it"} passes.</span>`,
  afflictionCured: (e) => `You sweat the ${e.kind ?? "sickness"} out overnight. <span class="hit">Cured.</span>`,
  // audit-batch1 (2026-09-09, A3): resting now rolls to cure — a failed roll
  // lands here instead of the unconditional cure above. Wording deliberately
  // terse for now; Batch 2 owns the full A1/A3 narration polish pass (both
  // events now carry `kind`, unused here on purpose until that pass).
  afflictionLingers: (e) => `<span class="hurt">You rest, but the ${e.kind ?? "sickness"} rides out the night with you.</span>`,
  // Device-review Pass DR7: named what actually recharges — this event only
  // ever fires for a Magic User's spell-charge pool (engine/movement.js,
  // every 20 squares), so "A charge comes back" with no noun was the
  // ambiguity the device-review flagged ("needs context — what recharged?").
  spellChargeRecovered: (e) =>
    `<span class="beat">Twenty quiet squares, and a spell charge is ready again</span> — ${e.charges ?? "?"} of ${e.max ?? "?"} in reserve. The dungeon keeps no such courtesy for you.`,
  dayBegan: (e) => `<span class="banner">Day ${e.day ?? "?"}.</span>`,
  // Phase 54 (BAND-02, USER RULING D): HERO_REGEN_PER_FLOOR's arrival tick —
  // identity (0) never pushes this event.
  floorRegen: (e) => `<span class="hit">A new floor, and the dungeon lets you keep +${e.amount ?? 0} hp of it.</span> Do not mistake this for kindness.`,
  rested: (e) =>
    `Rest restores <span class="hit">+${e.amount ?? 0} hp</span>.${e.doubled ? ` (${e.doubled}: twice as fast, as promised.)` : ""}`,
  // 260918-w4n (use-activated-only): the Cloak of Healing is removed from
  // the game (the "cloakHealed" event type no longer exists anywhere) — the
  // Cloak of Regeneration is now use-activated, a flat d6 back ON USE, then
  // a 20-square cooldown, not a per-step tick.
  cloakRegenerated: (e) => `<span class="hit">Flesh knits itself back — +${e.amount ?? 0} hp.</span> Ask again in twenty squares.`,
  armorPatched: (e) => `${e.by ? `${e.by}: ` : ""}<span class="hit">+${e.amount ?? 0}</span> back into your kit.`,
  potionDuplicated: () => `The Warlock spends the small hours duplicating a potion. <span class="hit">+1 potion.</span>`,
  // Phase 43 (CLAR-01/03/05): a fed night's ration cost, cause first — every
  // eater named (the hero as "you eat N", every member as "Name (race) eats
  // N"), then the RATION_RULE_LINE sentence for every distinct race among
  // them that carries one (e.g. "Trolls eat for two."), then the cost.
  rationsEaten: (e) => {
    const eats = e?.eats ?? 1;
    const left = e?.left ?? 0;
    const eaters = e?.eaters ?? [];
    const clauses = eaters.length
      ? eaters
          .map((m) => (m?.hero ? `you eat ${m?.eats ?? 1}` : `${m?.name ?? "Someone"} (${m?.race ?? "?"}) eats ${m?.eats ?? 1}`))
          .join("; ")
      : `you eat ${eats}`;
    const races = [];
    for (const m of eaters) {
      if (m?.race && RATION_RULE_LINE[m.race] && !races.includes(m.race)) races.push(m.race);
    }
    const ruleSentence = races.map((r) => RATION_RULE_LINE[r]).join(" ");
    return `<span class="beat">Rations: ${clauses}.</span>${ruleSentence ? ` ${ruleSentence}` : ""} −${plural(eats, "ration")}, ${left} left.`;
  },
  // Phase 43 (CLAR-01/03/05): hunger names need/have/mouths and the Heft
  // halving — rewritten from the old "No rations." to cause-first, cost-last.
  wentHungry: (e) => {
    const need = e?.need ?? 1;
    const have = e?.have ?? 0;
    const mouths = e?.mouths ?? 1;
    const cost = e?.cost ?? 0;
    const eatClause = mouths > 1 ? "the party eats" : "you eat";
    return `<span class="hurt">Hunger: nobody packed — ${eatClause} ${need} a night, and you had ${have}.</span> Cost of living −${cost} hp${e?.heft ? " (Heft: half, as promised)" : ""}.`;
  },
  // A1 sibling + P3 (04.2 Text batch): same stripRollDetail defect as
  // afflictionRolled — the old "check: <roll>N</roll> of 8 hours disturbed."
  // left the dangling "of 8 hours disturbed." fragment on the overlay. Dice
  // clause moved inside the span; a clean, in-voice sentence stays outside.
  // (This event only fires when at least one night-hour was disturbed —
  // engine/movement.js only pushes it for woke > 0, then starts combat.)
  // Phase 24 (IDENT-05): a Bard's camp draws visitors twice as often — an
  // additive clause when the flag is set; every non-Bard sentence above is
  // byte-identical.
  wanderingMonster: (e) =>
    `Something in the dark takes an interest in you. <span class="roll">${e.hours ?? 0} of 8 night-hours disturbed.</span>${e.bard ? " Something too stupid to know better heard the singing." : ""}`,
  // Phase 25.1 (DFB-06): the refusal states the numbers — the hero's need,
  // what's on hand, and (when a party exists) who else is eating. A bare
  // `{type}` payload (the coverage test's shape) renders "?" rather than
  // undefined/NaN.
  campFailed: (e) => {
    const need = e.need ?? "?";
    const have = e.have ?? "?";
    const extra = (e.members ?? []).map((m) => `${m.name ?? "Your companion"} eats ${m.eats ?? 1} more`).join(", ");
    return `<span class="miss">You eat ${need} a night${extra ? ` (${extra})` : ""}. You have ${have}.</span> Find rations first.`;
  },
  teleported: () =>
    `<span class="beat">You teleport to an unknown location on this floor…</span> the dungeon does not offer refunds.`,
  spGained: (e) => {
    const reason = e.reason === "parley" ? "Talking your way out" : e.reason === "descend" ? "Surviving the floor" : "That";
    return `${reason} is worth <span class="roll">${e.amount ?? 0}</span> ${plural(e.amount ?? 0, "experience point")}.`;
  },
  floorChanged: (e) => `<span class="banner">Floor ${e.depth ?? "?"}.</span> The air gets worse, and takes it personally.`,
  leveled: (e) => `<span class="hit">Skill level ${e.level ?? "?"}</span> (+${e.wpGain ?? 0} hp).`,
  // Phase 38 (ABIL-01/03): a level-pool ability roll, folded as the SKILL
  // LEVEL N card's second line (see rail.js's matching family entry).
  abilityLearned: (e) => `<span class="hit">New trick: ${e.name ?? "something"}</span> — ${e.txt ?? ""}`,
  died: () => `<span class="hurt">You have died.</span>`,

  /* ---------------- combat.js ---------------- */

  encounterStarted: (e) => {
    const names = (e.foes ?? []).map((f) => f.name).join(", ") || "something";
    let line = `<span class="banner">${e.wandering ? "A wandering encounter." : "An encounter."}</span> ${names}.`;
    // Phase 24 (IDENT-05): the two new never-first flags get their own
    // clause, appended after the existing banner/names text (unchanged when
    // neither flag is set).
    if (e.knightBigFoe) line += ` Something with real heft has noticed the Knight. It moves first.`;
    if (e.courtMageTalksFirst) line += ` You open with a few words. They open with everything else.`;
    return line;
  },
  // Phase 31 (CMB-01): the FIGHT step's own initiative outcome — the
  // encounter step no longer knows who moves first.
  // Phase 40 (SPELL-02): Sense Presence's own line when it is the reason no
  // one got the jump on you — a plain "you" win (no senses, or senses that
  // didn't ride along) keeps the pre-Phase-40 wording.
  // Phase 51 (INIT-02, DELIBERATE RULES CHANGE, 2026-09-20): the prototype's
  // per-round `C.initNote` ("Initiative — you N, them M") ported as the
  // Oracle's own ONCE-PER-FIGHT line — `combatJoined` already fires exactly
  // once per fight (from `fight()`, Plan 02's single roll site), so "once,
  // not per round" falls out structurally with no extra guard needed here.
  // The dice sit in TWO `.roll` spans so `oracleDetailText`'s existing fold
  // reveals them in the fight log; the foe's name (`e.foe`) is used when the
  // fight opened against exactly one live foe, else "them" for a group.
  // `initiativeVerdictText` (src/browser/narrationLines.js) supplies the
  // verdict clause — the bare "You/They go first." on a plain dice win, or
  // the override's own voice (Samurai/slow/foresight/Acute Hearing/senses/
  // Knight/Court Mage) when `e.why` (or the legacy `e.senses` flag) named
  // one — shared with `LINE_FOR.combatJoined` so the Oracle and the
  // roll-free rail/fight-log text can never disagree about the verdict.
  combatJoined: (e) => {
    const mine = e?.mine ?? "?";
    const theirs = e?.theirs ?? "?";
    const foeName = e?.foe ?? "them";
    const verdictClass = e?.first === "you" ? "beat" : "hurt";
    const verdict = initiativeVerdictText(e);
    return `Initiative — you <span class="roll">${mine}</span>, ${foeName} <span class="roll">${theirs}</span>. <span class="${verdictClass}">${verdict}</span>`;
  },
  trackable: () => `<span class="beat">They have not noticed you yet.</span>`,
  allyJoined: (e) => `<span class="hit">${e.name ?? "An ally"} falls in beside you.</span>`,
  warlockBoost: (e) => `The Warlock's presence stiffens the dead. <span class="hurt">+${e.amount ?? 0} hp to every corpse in the room.</span>`,
  // Phase 19 (CANON-02/D-03): a caster fleeing below its own HP threshold
  // gets its own line — the "recalls an urgent appointment on another
  // Plane" flourish from CONTEXT's "Specific Ideas" (the Djinni flee).
  foeFled: (e) =>
    e.reason === "lowHp"
      ? `<span class="hit">${e.name ?? "It"} recalls an urgent appointment on another Plane.</span>`
      : `<span class="hit">${e.name ?? "It"} thinks better of it and leaves.</span>`,
  foeBored: (e) => `<span class="hit">${e.name ?? "It"} loses interest entirely.</span>`,
  encounterCleared: () => `<span class="hit">Nothing left standing.</span>`,
  // Phase 31 (renamed from phobiaFrozen — "Phobia should be penalties, never
  // a no actions state", user ruling 2026-09-16): a triggered phobia is now
  // a −to-hit/half-damage penalty for e.rounds rounds — you can still swing.
  phobiaAfraid: (e) => {
    const base = `<span class="hurt">Your phobia has you shaking.</span> Harder to hit and softer blows for ${e.rounds ?? 2} rounds. You can still swing — you just will not enjoy it.`;
    // Phase 41 (TERR-05): when this fight opened Afraid from an ARMED
    // terrain trigger (engine/phobias.js's fourth OR-condition), name what
    // armed it — the same phrase phobiaTriggered's own line used.
    const phrase = e?.trigger && PHOBIA_TRIGGER_PHRASE[e.trigger];
    return phrase ? `${base} Still rattled from ${phrase}.` : base;
  },
  combatInDark: () => `<span class="beat">You cannot see what you are fighting.</span>`,
  // Phase 23 (IDENT-01): the refusal now names the attack spell the Wizard
  // should cast instead, when the engine supplies one.
  // Phase 31 (CMB-01): notFought — Fight! not yet pressed.
  strikeRefused: (e) =>
    e.reason === "wizard"
      ? e.spell
        ? `<span class="miss">A Wizard does not stoop to fisticuffs while ${e.spell} is still in the book.</span>`
        : `<span class="miss">A Wizard does not stoop to fisticuffs while a spell remains.</span>`
      : e.reason === "notFought"
        ? `<span class="miss">Fight! first, then swing.</span>`
        : `<span class="miss">You hold back.</span>`,
  // Phase 31 (renamed from shookOffFrozen): the Afraid countdown reaching 0.
  fearPassed: () => `<span class="hit">The fear passes.</span> Your hands remember what they are for.`,
  frenzy: () => `<span class="hurt">Something in your blood takes over. Frenzy.</span>`,
  // Phase 25 (FEED-05 Oracle half): `e.quip` is a PRESENTATION-ONLY field —
  // never set by the engine, only by 25-02's decorateMisses — appended after
  // the roll and the plain miss sentence so the Oracle keeps the roll first.
  // Absent `quip` renders byte-identical to before.
  strikeMissed: (e) =>
    e.untouchable
      ? `<span class="miss">${e.target ?? "It"} cannot be touched like that.</span>`
      : `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}. <span class="miss">You miss ${e.target ?? "it"}.</span>${e.quip ? ` ${e.quip}` : ""}`,
  deathTouch: (e) => `<span class="hit">One touch. ${e.target ?? "It"} drops.</span>`,
  backstabDenied: () => `<span class="miss">Heavy armor gives you away.</span>`,
  stealthStrike: () => `<span class="hit">They never saw you. Critical.</span>`,
  backstab: () => `<span class="hit">A blade in the back. Critical.</span>`,
  conArtistOpener: () => `<span class="beat">You had the perfect backstab lined up — and announced it instead. All flourish, no follow-through.</span>`,
  ninjaFirstStrike: () => `<span class="hit">One perfect opening strike.</span>`,
  // Phase 25 (FEED-01, additive payload): `need` fixes the Oracle's old
  // "N vs ?" hole; `critBy` (present only when critical) names the reason —
  // absent fields render exactly the prior "Critical!"/plain sentence.
  struck: (e) => {
    const CRIT_BY_TEXT = {
      stealth: "Unseen. Critical!",
      backstab: "From behind. Critical!",
      ninja: "A Ninja's two. Critical!",
      cutthroat: "The Cutthroat's first blow. Critical!",
      deathTouch: "Called it. Critical!",
      silentStep: "Not a sound. Critical!",
    };
    const critText = e.critical ? `<span class="hit">${CRIT_BY_TEXT[e.critBy] ?? "Critical!"}</span> ` : "";
    // Phase 31 (Afraid): modsClause names the -3 afraid penalty when
    // present; `e.afraid` appends the pulled-blow line (absent for every
    // non-afraid strike, byte-identical to before). Phase 73 (ROLL-05): the
    // range replaces the old "vs N" single number.
    return `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}. ${critText}You hit ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> hp.${e.afraid ? ` <span class="miss">Fear pulls the blow.</span>` : ""}`;
  },
  foeRevived: (e) => `<span class="miss">${e.name ?? "It"} gets back up.</span>`,
  foeKilled: (e) => `<span class="hit">${e.name ?? "It"} falls.</span> +<span class="roll">${e.spGained ?? 0}</span> XP.`,
  // Phase 72 (ROLL-01 (c)): a landed best-face strike shatters a
  // shatter-flagged foe outright, both lives at once — no damage roll, no
  // XP-bearing foeKilled reprise needed here (foeKilled still narrates the
  // kill separately). Safe on a bare `{ type }` payload (the coverage guard).
  foeShattered: (e) =>
    `<span class="hit">${e.by === "you" ? "Your" : `${e.by ?? "Something"}'s`} best roll lands clean. ${e.target ?? "It"} comes apart, both lives at once, and nobody is sweeping up.</span>`,
  cooked: (e) =>
    (e.wp ?? 0) > 0
      ? `You cook what is left. <span class="hit">+${e.wp} hp, +${e.rations ?? 1} ration.</span>`
      : `You salvage a ration off the carcass. <span class="hit">+${e.rations ?? 1} ration.</span>`,
  // Phase 31 (CMB-01): notFought — Fight! not yet pressed — alongside the
  // existing samurai reason.
  fleeRefused: (e) =>
    e.reason === "notFought"
      ? `<span class="miss">Running comes after Fight!, not instead of it.</span>`
      : `<span class="miss">A Samurai does not run.</span>`,
  // Phase 24 (IDENT-05): a Master of Arms' tracked round-1 withdrawal is
  // denied — they fall through to the ordinary flee roll below instead.
  withdrawalDenied: () => `<span class="miss">Slipping away untouched would mean not attacking. You attack. Roll like everyone else.</span>`,
  // Phase 24 (IDENT-07): a Cloaker who has already landed a blow this fight
  // loses the free vanish and falls through to the ordinary Thief roll.
  vanishDenied: () => `<span class="miss">You can always vanish — as long as nobody has seen your face. They have now seen your face.</span>`,
  fled: (e) =>
    e.reason === "cloaker"
      ? `<span class="hit">You vanish. Clean escape.</span>`
      : e.reason === "tracked"
        ? `<span class="hit">You slip away before it even sees you.</span>`
        : e.reason === "smoke"
          ? `<span class="hit">You leave through the smoke. Nobody follows.</span>`
          : `<span class="hit">You get clear.</span>`,
  // Phase 42 (FLEE-02): the roll, every named modifier and the range,
  // narrated BEFORE the outcome line (`fled`/`fleeFailed` keep their own
  // entries above/below). Reuses `modsText` (the same "Guard −1" format
  // foeToHitBreakdown's narration already uses) so every modifier surface
  // in the app speaks the same vocabulary. Null-safe (`e?.mods ?? []`) — the
  // voice scan invokes every builder with sparse event variants. Phase 73
  // (ROLL-05): flee is already roll-high — the raw d20 IS the roll, and its
  // bonus is folded into the threshold (`atLeast`); `total`/`need` are gone.
  fleeRolled: (e) => {
    const roll = e?.roll ?? "?";
    const mods = e?.mods ?? [];
    return `Flee: rolled <span class="roll">${roll}</span> vs ${rangeText(e?.atLeast, e?.dieN)}${modsClause(mods)}.`;
  },
  fleeFailed: () => `<span class="miss">You do not make it.</span>`,
  // Phase 20 (D-12/D-14): the wilmsryVsMagical refusal is now reachable (a
  // fluency-2 Wilmsry facing Magical) and gets the canon grudge line; every
  // other refusal keeps the prior text.
  // Phase 24 (IDENT-05): a Ninja and a Master of Arms carry their own direct-
  // refusal lines; every other reason (including the generic fallback) is
  // byte-identical to before.
  parleyRefused: (e) =>
    e.reason === "wilmsryVsMagical"
      ? `<span class="miss">Magic Users hate the Wilmsry. There is nothing to discuss.</span>`
      : e.reason === "ninja"
        ? `<span class="miss">A Ninja does not speak. Least of all to them.</span>`
        : e.reason === "masterOfArms"
          ? `<span class="miss">A Master of Arms has one answer to a question like that, and it is not a sentence.</span>`
          : e.reason === "notFought"
            ? `<span class="miss">They are not listening yet.</span> Fight! first.`
            : `<span class="miss">Not this time, not with them.</span>`,
  // Phase 20 (D-14): appends the fluency bonus (2 per point) whenever it is
  // non-zero, e.g. "vs 8–20 (+2 for the tongue)". Phase 73 (ROLL-05): the
  // range replaces the old bare `need` — the roll and the winning range both
  // read roll-high now.
  parleyRolled: (e) =>
    `Talk it down: <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${e.fluency ? ` (+${e.fluency * 2} for the tongue)` : ""}.`,
  // Phase 20 (D-06): a failed parley marks the group insulted for the rest
  // of the fight — unmistakable, never silent.
  parleyInsulted: () => `<span class="miss">You have made it personal.</span> They will be aiming with real intent from here on.`,
  // Phase 20 (D-05): a re-sent parley after the encounter's one attempt.
  parleyExhausted: () => `<span class="miss">You already said your piece.</span> They are done listening; try the pointy end.`,
  // E10/P2 (04.2 Text batch): the trailing `(${why})` used to leak the engine's
  // internal source tag ("tableFour", "chest", "faerie"…) straight to the
  // player; NONE of those tags are player-friendly, so the suffix is dropped
  // entirely (the surrounding beats already say where the gold came from). The
  // currency also reads "wilmst" now, the game's canonical spelling, not "wm".
  // Phase 20 (D-14): the parley wilmst payout is rare now (d6===6, D-03) —
  // the success line reflects that it is a windfall, not the routine cut.
  goldGained: (e) =>
    e.why === "parley"
      ? `One of them, against the odds, pays you to forget the whole thing. <span class="hit">+${e.amount ?? 0} wilmst.</span>`
      : `<span class="hit">+${e.amount ?? 0} wilmst.</span>`,
  parleyFailed: () => `<span class="miss">They are not buying it.</span>`,
  sang: (e) => `You strike up "${e.song ?? "a tune"}".`,
  beastsSoothed: (e) => `<span class="hit">${e.count ?? 0} calm right down.</span>`,
  songIgnored: () => `<span class="miss">They do not care for music.</span>`,
  lullabyRolled: (e) => `<span class="roll">${e.n ?? 0}</span> nod off.`,
  thunderRolled: (e) => `Thunder rolls; <span class="roll">${e.n ?? 0}</span> freeze for <span class="roll">${e.r ?? 0}</span> rounds.`,
  combatEnded: () => `<span class="beat">The fight is over.</span>`,
  // DFB-05 (Phase 25.1): extended additively — `weapon`/`crit`/`backstab` on
  // allyStruck and `target`/`roll`/`need`/`weapon` on allyMissed render only
  // when present, so a legacy/summoned-ally payload (no new fields) narrates
  // byte-identical to before. Plan 04 (ABIL-05): an optional `via` clause
  // names the ability (its canon catalog name, not the raw id) that drove a
  // member's strike-kind ability use — absent when `via` is unset, so an
  // ordinary member swing stays byte-identical.
  allyStruck: (e) => {
    const who = e.name ?? "Your ally";
    const t = e.target ?? "it";
    const w = e.weapon ? ` with a ${e.weapon}` : "";
    const via = e.via && ABILITY_BY_ID[e.via] ? ` (${ABILITY_BY_ID[e.via].name})` : "";
    if (e.backstab)
      return `<span class="hit">${who} backstabs ${t}${w}</span> — <span class="roll">${e.dmg ?? 0}</span> hp. A blade in the back, as advertised.`;
    return `${who} lands a hit on ${t}${w} for <span class="roll">${e.dmg ?? 0}</span> hp.${e.crit ? ` <span class="hit">Critical.</span>` : ""}${via}`;
  },
  allyMissed: (e) =>
    e.target
      ? `${e.name ?? "Your ally"} swings${e.weapon ? ` a ${e.weapon}` : ""} at ${e.target} and misses.${e.roll != null ? ` <span class="roll">${e.roll} vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}.</span>` : ""}${e.via && ABILITY_BY_ID[e.via] ? ` (${ABILITY_BY_ID[e.via].name})` : ""}`
      : `${e.name ?? "Your ally"} swings and misses.`,
  allyDeparted: (e) => `${e.name ?? "Your ally"} slips away, obligation met.`,
  // DFB-05 (Phase 25.1): a Magic User party member's cast — allyCast is the
  // announcement (Oracle-only; narrationLines.js's ORACLE_ONLY entry), always
  // followed in the same action by exactly one of allySpellHit/allySpellMissed.
  allyCast: (e) =>
    `${e.name ?? "Your ally"} casts <span class="hit">${e.spell ?? "a spell"}</span> at ${e.target ?? "the nearest foe"}.${e.roll != null ? ` <span class="roll">${e.roll} vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}.</span>` : ""}`,
  allySpellHit: (e) => {
    const who = e.name ?? "Your ally";
    const sp = e.spell ?? "The spell";
    const t = e.target ?? "the foe";
    if (e.effect === "frozen") return `<span class="hit">${who}'s ${sp} — ${t} frozen solid.</span> It will keep.`;
    if (e.effect === "asleep") return `<span class="hit">${who}'s ${sp} — ${t} nods off.</span> <span class="roll">${e.rounds ?? "?"} rounds.</span>`;
    if (e.effect === "weakened") return `<span class="hit">${who}'s ${sp} — the foes' arms go soft.</span>`;
    return `<span class="hit">${who}'s ${sp} hits ${t}</span> for <span class="roll">${e.dmg ?? 0}</span> hp.`;
  },
  allySpellMissed: (e) =>
    e.resisted
      ? `<span class="miss">${e.target ?? "The foe"} shrugs off ${e.name ?? "your ally"}'s ${e.spell ?? "spell"}.</span>${e.roll != null ? ` <span class="roll">${e.roll} vs ${rangeText(e.atLeast, e.dieN)}.</span>` : ""}`
      : `<span class="miss">${e.name ?? "Your ally"}'s ${e.spell ?? "spell"} goes wide of ${e.target ?? "the foe"}.</span> The maze absorbs the effort without comment.`,
  // PARTY-04/PARTY-05 (Phase 8): a foe lands on a party member instead of you —
  // better them than you, frankly. `name` is the foe, `member` the companion.
  memberStruck: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}. ${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} turns on ${e.member ?? "your companion"} for <span class="hurt">${e.dmg ?? 0} hp</span>.`,
  // PARTY-05: a member hits 0 hp — they do not die a hero's death, they simply
  // decide this dungeon is no longer their problem and leave the run.
  memberDowned: (e) => `<span class="hurt">${e.name ?? "Your companion"} goes down, and what is left of them wants no further part of this.</span>`,
  regenerated: (e) => `<span class="hit">+${e.amount ?? 0} hp</span> knits itself shut.`,
  acidTick: (e) => `Acid eats at ${e.target ?? "it"}: <span class="roll">${e.dmg ?? 0}</span> hp.`,
  foeSlept: (e) => `${e.name ?? "It"} sleeps through it.`,
  foeMissed: (e) =>
    `${e.name ?? "It"} swings${e.member ? ` at ${e.member}` : ""}, <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}, and misses.`,
  wardReflected: (e) => `<span class="hit">The ward throws ${e.amount ?? 0} back at ${e.target ?? "it"}.</span>`,
  wardAbsorbed: (e) => `The ward eats <span class="roll">${e.amount ?? 0}</span> (${e.remaining ?? 0} left).`,
  wardShattered: () => `<span class="hurt">The ward shatters.</span>`,
  armorDestroyed: () => `<span class="hurt">Your armor gives out.</span>`,
  // Phase 28 (ARMOR-05): the same underMin/magic outcome flags narrationLines.js
  // reads, so the narration line and the Oracle can never disagree about which of
  // the four armorSoaked outcomes just happened.
  armorSoaked: (e) =>
    e.magic
      ? `The cloak's plate takes ${e.amount ?? 0} from ${e.name ?? "it"}. Magic plate, light as a rumor, never wears — the maze's one honest bargain.`
      : e.underMin
        ? `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to. Under its min — not even a scratch. No wear.`
        : `Your armor takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.${e.wear ? ` It costs the armour ${e.wear}.` : ""}${e.halved ? " Dwarven steel takes the hit — half the wear." : ""}`,
  // Phase 18 (CANON-01, D-08) — the FOE's natural armor ate the hero's/
  // ally's blow. `name` is the foe; `amount` is what it shrugged off (kept
  // short for the line).
  foeArmorSoaked: (e) => `<span class="miss">Your blow rings off ${e.name ?? "the thing"}'s armor. It looks bored.</span>`,
  // Phase 15 item-wiring (ECON-08): the Pendant of Fortitude eats half of one
  // incoming blow, then spends itself. `name` is the foe whose hit was blunted.
  damageHalved: (e) => `<span class="hit">The pendant drinks half of ${e.name ?? "that"}'s blow before it reaches you.</span>`,
  // Phase 25 (FEED-01, additive payload): `soldierCrit` renders exactly like
  // `critical` (a Soldier's second-highest face is a crit in every way that
  // matters to the Oracle); `mods`/`soaked` render only when present, so a
  // plain hero's line stays byte-identical to before.
  // Dice-first fight-log convention (Phase 34) — unchanged by CLAR-01: the
  // foe's name IS the cause and the fight log already folds this line.
  struckByFoe: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}. ${e.critical || e.soldierCrit ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} hits you for <span class="hurt">${e.dmg ?? 0} hp</span>${soakedText(e.soaked)}.`,
  wardFaded: () => `<span class="beat">The ward fades.</span>`,
  mirrorFaded: () => `<span class="beat">The mirror fades.</span>`,
  // Phase 40 (SPELL-02): endCombat's own expiry narration for a
  // still-running Regeneration/Sense Presence when the fight ends.
  sensesFaded: () => `<span class="beat">Your senses dull back to normal.</span>`,
  regenFaded: () => `<span class="beat">The wounds stop closing on their own.</span>`,

  // Phase 19 (FOE-01..09, D-16): foe abilities — telegraph first, effect
  // second. Every builder here defends a bare `{ type }` call (the coverage
  // guard's own invocation shape) and never leaks an engine identifier
  // (ability ids are not player-facing — the telegraph uses `e.txt`, a
  // content string already scanned by the safety corpus).
  foeCast: (e) => `<span class="beat">${e.txt ?? `${e.name ?? "It"} does something unpleasant and magical.`}</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  foeBolted: (e) =>
    e.member
      ? `<span class="hurt">${e.name ?? "It"}: it lands on ${e.member}.</span> −${e.dmg ?? 0} hp${soakedText(e.soaked)}. Better them than you.`
      : `<span class="hurt">${e.name ?? "It"}: it lands.</span> −${e.dmg ?? 0} hp${soakedText(e.soaked)}${e.ignoresArmor ? ", and your armor was not consulted" : ""}.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  foeDrained: (e) => `<span class="hurt">${e.name ?? "It"}: it drinks ${e.stolen ?? 0} hp of yours and looks better for it.</span>`,
  foeDebuffed: (e) =>
    e.kind === "dazed"
      ? `<span class="hurt">The room keeps moving after you stop. Dazed for ${e.rounds ?? "?"} rounds.</span>`
      : `<span class="hurt">Your arms feel like someone else's. Weakened for ${e.rounds ?? "?"} rounds.</span>`,
  foeHealed: (e) => `${e.name ?? "It"} knits itself back together. <span class="miss">+${e.amount ?? 0} hp.</span> Rude.`,
  foeSummoned: (e) =>
    e.pending
      ? `<span class="miss">${e.by ?? "It"} calls, and something answers from a little way off.</span>`
      : `<span class="miss">${e.name ?? "Something"} shuffles in, late and unbothered.</span>`,
  foeEffectFaded: (e) =>
    e.kind === "dazed"
      ? `<span class="hit">The room settles. You are no longer dazed.</span>`
      : `<span class="hit">Your strength comes back. It was only borrowed.</span>`,
  heroResisted: (e) =>
    `<span class="hit">You think very hard about not being affected, and it works.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  heroResistFailed: (e) =>
    `You try to shrug it off. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span> <span class="miss">You do not.</span>`,
  foePursued: (e) => `<span class="hurt">${e.name ?? "It"} follows you out. Of course it does.</span>`,
  foeOutOfSpells: (e) => `${e.name ?? "It"} gestures grandly. Nothing happens. <span class="miss">It appears to be out of spells.</span>`,

  /* ---------------- abilities.js (Phase 38, ABIL-01/04) ---------------- */

  abilityUsed: (e) => `<span class="beat">You call ${e.name ?? "it"}.</span>`,
  // The canon refusal register (38-CONTEXT.md): the cooldown line names the
  // ability, the rounds left, and closes on the same wry aside every time;
  // every other reason names the ability without a rounds figure.
  abilityRefused: (e) => {
    const name = e.name ?? e.key ?? "That";
    const map = {
      notFought: `<span class="miss">Fight! first, then swing.</span>`,
      unknown: `<span class="miss">${e.name ?? e.key ?? "That"}? You do not know that one.</span>`,
      cooldown: `<span class="miss">${name}: ${e.left ?? "?"} round${e.left === 1 ? "" : "s"}. Your arm has opinions.</span>`,
      notInCombat: `<span class="miss">${name}: nothing to use it on out here.</span>`,
      noTarget: `<span class="miss">${name}: nothing left standing to use it on.</span>`,
      notLowEnough: `<span class="miss">Last Stand: you are not desperate enough yet (${e.have ?? "?"} of ${e.max ?? "?"} hp).</span>`,
    };
    return map[e.reason] ?? `<span class="miss">${name} refuses you.</span>`;
  },
  // Plan 04 (ABIL-05): the fourteen ability-activation/effect lines below
  // carry an ADDITIVE `${e.member ? \`${e.member}: \` : ""}` prefix — present
  // only when a Joiner (not the hero) is the actor, so a hero-cast use stays
  // byte-identical to Plan 03's own text.
  pommelStruck: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}The pommel finds ${e.target ?? "it"}'s temple. It will need a moment.</span>`,
  foeStunned: (e) => `${e.name ?? "It"} spends its turn remembering where it is.`,
  battleRoarRaised: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Loud enough. For two rounds they all need two better to hit anyone on your side.</span>`,
  sidestepped: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Not where the blade is. Two rounds of that.</span>`,
  secondWindHealed: (e) => `<span class="hit">You remember why you came. +${e.amount ?? 0} hp.</span>`,
  swept: (e) => `<span class="hit">One wide arc — ${e.dmg ?? 0} to everything still standing.</span>`,
  sweptFoe: (e) => `${e.target ?? "It"} takes <span class="roll">${e.dmg ?? 0}</span>.`,
  braced: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Braced. The next one lands on your terms.</span>`,
  braceHeld: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Braced — ${e.name ?? "it"}'s blow lands half as hard (−${e.soaked ?? 0}).</span>`,
  riposteReady: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Every miss is an invitation.</span>`,
  riposted: (e) => `${e.target ?? "It"} misses, and pays <span class="roll">${e.dmg ?? 0}</span> for it.`,
  taunted: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Every foe looks at you. Armour doubles. Good luck.</span>`,
  lastStandCalled: (e) => `<span class="beat">${e.member ? `${e.member}: ` : ""}Under a quarter. ${e.attacks ?? 3} attacks this round. Make them count.</span>`,
  dirtyTrickLanded: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Sand, thumb, elbow. ${e.target ?? "it"} is blinded for ${e.rounds ?? 2} rounds.</span>`,
  foeSightReturned: (e) => `${e.name ?? "It"} blinks the sand out.`,
  smokeThrown: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Gone. For two rounds they need a natural 1 to find you — a 1–2 if you insulted them.</span>`,
  cutpursed: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}You lift ${e.amount ?? 0} wilmst off ${e.target ?? "it"} mid-fight. It has other problems.</span>`,
  poisonedEdgeApplied: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}The blade weeps into ${e.target ?? "it"}. ${e.rounds ?? 3} rounds of that.</span>`,
  // dotTick is generic on `by` — Phase 40 (SPELL-01, Ice) is the first spell
  // to share this event shape with Poisoned Edge; the line names the source.
  dotTick: (e) => `${e.target ?? "It"} takes <span class="hurt">${e.dmg ?? 0}</span> from ${e.by === "ice" ? "the ice" : "the poison"}.`,
  hamstrung: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Tendon cut. ${e.target ?? "It"} hits half as hard from here on.</span>`,
  marked: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Studied. Every blow on ${e.target ?? "it"} lands +2.</span>`,
  // Plan 04 (ABIL-05): a Joiner's own ability use — the four new member-only
  // events (no hero equivalent exists for these; a hero's own equivalent use
  // reads "abilityUsed"/"secondWindHealed"/"swept"/"riposted" above).
  memberAbilityUsed: (e) => `<span class="beat">${e.name ?? "Your companion"} calls ${e.ability ?? "it"}.</span>`,
  memberSecondWind: (e) => `<span class="hit">${e.name ?? "Your companion"} remembers why they came. +${e.amount ?? 0} hp.</span>`,
  memberSwept: (e) => `<span class="hit">${e.name ?? "Your companion"} sweeps — ${e.dmg ?? 0} to everything still standing.</span>`,
  memberRiposted: (e) => `${e.target ?? "It"} misses ${e.name ?? "your companion"}, and pays <span class="roll">${e.dmg ?? 0}</span> for it.`,

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => `<span class="miss">Nothing left to cast with.</span>`,
  spellNotKnown: (e) => `<span class="miss">You do not know ${e.spell ?? "that"}.</span>`,
  spellAboveLevel: (e) => `<span class="miss">${e.spell ?? "That"} needs level ${e.need ?? "?"}; you are ${e.have ?? "?"}.</span>`,
  spellSchoolLocked: (e) => `<span class="miss">${e.spell ?? "That"} is not open to you yet.</span>`,
  // Phase 31 (CMB-01/CMB-02): the NEW spell-refusal circumstances — never a
  // `frozen` reason; nothing is ever refused for fear.
  castRefused: (e) => {
    const map = {
      notFought: `<span class="miss">Fight! first.</span> ${e.spell ?? "The spell"} keeps.`,
      combatOnly: `<span class="miss">${e.spell ?? "That"} wants a target.</span> Save it for a fight.`,
      exploreOnly: `<span class="miss">${e.spell ?? "That"} needs quieter surroundings.</span>`,
      noTarget: `<span class="miss">Nothing left to aim at.</span>`,
    };
    return map[e.reason] ?? `<span class="miss">${e.spell ?? "The spell"} refuses you.</span>`;
  },
  // Phase 31 (CMB-01): the generic action-refusal vocabulary (sing/drinkPotion).
  actionRefused: (e) => {
    const map = {
      notFought: `<span class="miss">Fight! first.</span>`,
      cooldown: `<span class="miss">Your voice needs ${e.left ?? "more"} more squares.</span>`,
      wrongClass: `<span class="miss">Only a Bard sings here.</span>`,
    };
    return map[e.reason] ?? `<span class="miss">Not now.</span>`;
  },
  spellBackfired: (e) => `<span class="hurt">${e.spell ?? "The spell"} goes wrong.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  backfireSelfDamage: (e) =>
    `<span class="hurt">Backfire: ${e.spell ?? "The spell"} went wrong in your hands — the ${e.sub ?? "Apprentice"} tax, one time in eight.</span> −${e.amount ?? 0} hp.`,
  spellResisted: (e) =>
    `${e.target ?? "It"} shrugs it off. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  resistFailed: (e) => `${e.target ?? "It"} tries to resist and fails. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)}.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  summonBackfired: (e) =>
    `<span class="hurt">Summoning: ${e.spell ?? "The spell"} answered, then turned on you — a ${e.sub ?? "Summoner"}'s doubled creatures come with a grudge.</span> −${e.amount ?? 0} hp.`,
  // Phase 40 (SPELL-04): `e.lesser` (Lesser Summon) swaps the wording for a
  // smaller, wittier line — never a new event type.
  allySummoned: (e) =>
    e.lesser
      ? `<span class="hit">${e.name ?? "Something"} answers the call, sort of.</span>`
      : `<span class="hit">${e.name ?? "Something"} answers the call.</span>`,
  allyPending: (e) =>
    e.lesser
      ? `<span class="beat">${e.name ?? "Something"} is coming, in a small way.</span>`
      : `<span class="beat">${e.name ?? "Something"} is coming, once there is a fight to join.</span>`,
  stunned: (e) => `<span class="hit">${e.count ?? 0} freeze in place.</span>`,
  // Phase 40 (SPELL-01, Weaken): names the duration when the payload carries
  // one (a member's own weakened line predates the timer and may not).
  weakened: (e) => `<span class="hit">They hit softer now${e.rounds ? `, for ${e.rounds} rounds` : ""}.</span>`,
  // Phase 40 (SPELL-01) — combat.js#foeTurn's tail narrates this on the
  // `spell:weaken` timer's own effect->null transition.
  weakenFaded: () => `<span class="hit">Their arms remember how to swing.</span>`,
  stupefied: (e) => `<span class="hit">${e.target ?? "It"} forgets what it is doing.</span>`,
  // Phase 40 (SPELL-01, Stupidity) — combat.js#foeTurn's own per-round skip
  // (the cast-time `stupefied` line above narrates the moment it lands; this
  // one narrates every subsequent turn it does nothing).
  foeStupefied: (e) => `${e.name ?? "It"} stands there, thinking about nothing.`,
  blinded: (e) => `<span class="hit">${e.target ?? "It"} cannot see a thing.</span>`,
  shrunk: (e) => `<span class="hit">${e.count ?? 0} shrink to half size.</span>`,
  acidApplied: (e) => `${e.target ?? "It"} starts to dissolve. <span class="roll">${e.rounds ?? 0}</span> rounds of it.`,
  // Phase 40 (SPELL-01, Ice) — the cast-time line; combat.js#foeTurn's
  // existing dotTick handles every round after (see dotTick's own `by`
  // branch above), and frozenSolid (below) narrates the payoff.
  iceApplied: (e) => `<span class="hit">Ice climbs ${e.target ?? "it"}: d6 a round for ${e.rounds ?? 0} rounds, then it stops moving.</span>`,
  earthquake: (e) => `<span class="banner">The floor heaves.</span> <span class="roll">${e.amount ?? 0}</span> to everyone in the room.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  earthquakeSelfDamage: (e) => `<span class="hurt">Earthquake: the floor does not take sides.</span> −${e.amount ?? 0} hp.`,
  vaporRolled: (e) => `Noxious vapor: <span class="roll">${e.roll ?? "?"}</span>.`,
  volley: (e) => `<span class="roll">${e.rolls ?? 0}</span> shots, <span class="roll">${e.totalDamage ?? 0}</span> total damage.`,
  petrified: (e) => `<span class="hit">${e.target ?? "It"} turns to stone.</span>`,
  walkingDeadTurned: (e) => `<span class="hit">${e.count ?? 0} of the dead turn and flee.</span>`,
  nothingToTurn: () => `<span class="miss">Nothing here to turn.</span>`,
  planeGated: (e) => `<span class="hit">${e.count ?? 0} are gated straight back out.</span>`,
  gateRefused: () => `<span class="miss">There is no plane here worth opening.</span>`,
  sensesGained: () => `<span class="hit">Your senses sharpen.</span>`,
  // Phase 40 (SPELL-05, Plan 04): Map the Floor is now a time-boxed,
  // re-fogging reveal — the old permanent whole-floor reveal event is
  // retired outright; floorMapped/revealFaded replace it.
  floorMapped: (e) => `<span class="hit">The floor lays itself out in your head — every corridor on this level, for ${e.squares ?? 0} squares.</span>`,
  revealFaded: () => `<span class="beat">The map forgets what it was told.</span>`,
  senseDanger: (e) => `<span class="beat">You get a bad feeling about the next ${e.nextEncounter ?? "encounter"}.</span>`,
  mirrorSelf: (e) => `<span class="hit">A mirror image holds for ${e.rounds ?? 0} rounds.</span>`,
  wardRaised: (e) => `<span class="hit">${e.spell ?? "The ward"} raises a ward: ${e.pool ?? 0} points${e.reflect ? ", reflecting" : ""}.</span>`,
  strengthCast: (e) => `<span class="hit">Might surges: +${e.might ?? 0}.</span>`,
  regenerationCast: () => `<span class="hit">Wounds start closing on their own.</span>`,
  insaneNoTarget: () => `<span class="miss">There is no one here to turn insane at.</span>`,
  insaneRolled: (e) => `Insanity takes ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span>.`,
  insaneStruckAlly: (e) => `The maddened thing turns on ${e.target ?? "an ally"} for <span class="roll">${e.dmg ?? 0}</span> hp.`,
  insaneFled: (e) => `<span class="beat">${e.target ?? "It"} bolts, mad with fear.</span>`,
  healed: (e) => `<span class="hit">+${e.amount ?? 0} hp</span>${e.spell ? ` from ${e.spell}` : ""}.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathSpellTooWeak: (e) => `<span class="miss">Death: the fee is ${e?.fee ?? 25} hp, and you would not survive paying it.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathCast: (e) => `<span class="hurt">Death: the spell takes its fee first.</span> −${e?.cost ?? 25} hp.`,
  dozed: (e) => `${e.target ?? "It"} dozes off for ${e.rounds ?? 0} rounds.`,
  nothingToThrowAt: () => `<span class="miss">Nothing here to throw it at.</span>`,
  spellThrown: (e) =>
    `${e.spell ?? "It"} at ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods)}.`,
  spellHit: (e) =>
    `<span class="hit">Hit.</span> <span class="roll">${e.dmg ?? 0}</span> hp${(e.mult ?? 1) > 1 ? ` (×${e.mult})` : ""}.${e.afraid ? ` <span class="miss">Fear pulls the spell.</span>` : ""}`,
  frozenSolid: (e) => `<span class="hit">${e.target ?? "It"} freezes solid.</span>`,
  spellMissed: (e) => `<span class="miss">Missed ${e.target ?? "it"}.</span>`,
  potionDrunk: (e) =>
    `<span class="hit">+${e.amount ?? 0} hp</span> (${plural(e.remaining ?? 0, "potion")} left).${e.doubled ? ` (${e.doubled}: twice the dose, as promised.)` : ""}`,
  scrollRead: (e) => `You unroll a scroll: ${e.spell ?? "something unreadable"}.`,
  // Phase 25 (FEED-02): a scroll refuses to be read out loud, with a reason —
  // never a silent no-op. `reason` is "noScrolls" | "pilfer" | "noRunes";
  // any other/absent value falls to the generic "stays rolled" line.
  scrollRefused: (e) =>
    e.reason === "pilfer"
      ? `<span class="miss">A Pilfer's hands know locks, not letters.</span> The scroll stays rolled.`
      : e.reason === "noRunes"
        ? `<span class="miss">The runes mean nothing to you.</span> The scroll stays rolled.`
        : e.reason === "noScrolls"
          ? `<span class="miss">You have no scroll to read.</span>`
          : e.reason === "notFought"
            ? `<span class="miss">Fight! first.</span> The scroll will keep.`
            : `<span class="miss">It stays rolled.</span>`,
  scrollCopiedToGrimoire: (e) => `<span class="hit">${e.spell ?? "It"} copied into your grimoire.</span>`,
  // Phase 40 (SPELL-07): the scroll's spell is not yet scribable (level or
  // school gate not met) — it names the level needed and falls through to
  // the free cast (the following `scrollCast` line narrates that part).
  scrollTooAdvanced: (e) =>
    `<span class="miss">${e.spell ?? "It"} needs level ${e.need ?? "?"}; you are ${e.have ?? "?"}. The scroll reads itself once and crumbles.</span>`,
  scrollCast: (e) => `The scroll casts itself: ${e.spell ?? "something"}.`,

  /* ---------------- economy.js ---------------- */

  storeOpened: (e) => `<span class="banner">The shop is open.</span>${e.troll ? " (Trolls pay triple.)" : e.elfOrDwarf ? " (A discount, as always.)" : ""}`,
  buyFailed: (e) => `<span class="miss">You are short ${e.short ?? 0} wilmst.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  bought: (e) => `<span class="hit">Bought: ${e.item ?? "something"}.</span> −${e.cost ?? 0} wilmst.`,
  // Phase 61 (STORE-02/STORE-03): a legal buy that is NOT an upgrade is
  // charged and stowed rather than lost — the explanation reuses Plan 02's
  // upgradeWhyText/gearCompareParts formatter (`e.why` may be a string, e.g.
  // the voice-scan BASE_EVENT shape — upgradeWhyText returns "" for that,
  // so no explanation clause is added).
  purchaseBagged: (e) => {
    const why = upgradeWhyText(e.why);
    return `<span class="beat">Into the bag: ${e.item?.n ?? "something"}.</span> Not an upgrade${why ? ` — ${why}` : ""}. It is yours all the same; equip it from Gear if you know something the arithmetic does not.`;
  },
  // RATION-01: the dedicated, visible ration purchase — surfaces the ration
  // gain explicitly, unlike the old silent food-side-effect +1.
  rationsBought: (e) => `<span class="hit">Stocked up:</span> +${plural(e.amount ?? 1, "ration")}. At least someone is planning ahead.`,
  // ECON-06 (Phase 14): the store buys your gear back at a discount. Deadpan,
  // dark-but-family-friendly (a VOX-02 safety scan checks this line) — the
  // shopkeeper is doing you no favours, and knows it.
  itemSold: (e) =>
    `<span class="hit">Sold:</span> ${e.item?.n ?? "something"} for ${e.price ?? 0} wilmst. The shopkeeper's smile suggests you got the worse end of it.`,
  storeLeft: () => `<span class="beat">You leave the shop.</span>`,

  /* ---------------- encounters.js ---------------- */

  trapAvoided: (e) => `<span class="hit">You clock it a half-step early.</span> <span class="roll">${e.roll ?? "?"} vs ${e.need ?? "?"}.</span>`,
  trapDisarmed: () => `<span class="hit">A Pilfer's hands already knew where not to put themselves.</span>`,
  trapDoubled: () => `<span class="hurt">Cat Burglar's luck holds — for the trap. It hits twice as hard.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapSprung: (e) => `<span class="hurt">Trap: ${e.name ?? "A trap"} finds you first.</span> −${e.dmg ?? 0} hp.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapPoisoned: () => `<span class="hurt">Trap: it leaves something behind that outlasts the bruise.</span>`,
  chestOpened: () => `<span class="hit">The box gives up its secrets.</span>`,
  chestLockRolled: (e) => `<span class="roll">Lock: ${e.roll ?? "?"} vs ${e.need ?? "?"}.</span>`,
  chestLocked: () => `<span class="miss">Not today. The lock wins this round.</span>`,
  scrollFound: () => `<span class="hit">A scroll, tucked in with the loot.</span>`,
  encounterRolled: (e) => `<span class="roll">Table ${e.table ?? "?"}, roll ${e.roll ?? "?"}:</span> The dice decide — ${e.result ?? "something"}.`,
  tableFour: (e) => `<span class="beat">${e.result ?? "Something happens."}</span>`,
  tableFourNoop: (e) => `<span class="beat">${e.result ?? "Nothing much happens."}</span>`,
  foodFound: (e) => `<span class="hit">${e.name ?? "Food"}</span> (+${e.wp ?? 0} hp).`,
  grimoireSold: () => `You cannot use it, so you sell it.`,
  grimoireLearned: (e) => `<span class="hit">New spells:</span> ${(e.spells ?? []).join(", ") || "nothing new"}.`,
  // P1 (04.2 Text batch): `gift` is the raw FAERIE table key ("+d20 Base HP",
  // "d10 x 100 wilmst", "Miscellaneous Magic"…) — printing it raw here echoed
  // dev jargon, and the SAME turn a specific follow-up event (faerieBoon/
  // faerieBane/goldGained/leveled/itemTaken/miscMagicRolled) already narrates
  // the real outcome. So this is now just the teaser; the follow-up tells the
  // story. (Builder no longer reads e.gift — the field stays on the event.)
  faerieMet: () => `<span class="beat">A faerie blinks into being, takes your measure, and decides.</span>`,
  faerieBoon: (e) => `<span class="hit">+${e.amount ?? 0} base hp.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  faerieBane: (e) => `<span class="hurt">Faerie: it took against you.</span> −${e.amount ?? 0} base hp.`,
  joinerMet: (e) => `<span class="hit">${e.name ?? "Someone"}</span>, a ${e.sub ?? e.race ?? "stranger"}, joins you for a while.`,
  // PARTY-01/PARTY-09 (Phase 9): the accept/decline outcome of a recruitment.
  // Deadpan, dark-but-family-friendly — the humor is at everyone's expense,
  // especially the poor soul who just signed on.
  joinerJoined: (e) =>
    `<span class="hit">${e.name ?? "Someone"} falls in beside you</span>, already quietly revising their life expectancy downward.`,
  // Phase 25.1 (DFB-04): fires when accepting a Joiner with a full roster
  // swaps the longest-serving member out (engine/state.js#swapPartyMember).
  // The line is picked WITHOUT rng — index derived from both names' lengths
  // — and both names are html-escaped since they are interpolated into markup.
  joinerLeft: (e) => {
    const rawName = e.name ?? "Your companion";
    const rawNew = e.replacedBy ?? "the new arrival";
    const idx = (String(rawName).length + String(rawNew).length) % JOINER_EXIT_LINES.length;
    const line = JOINER_EXIT_LINES[idx]
      .replaceAll("{name}", escapeHtml(rawName))
      .replaceAll("{new}", escapeHtml(rawNew));
    return `<span class="beat">${line}</span>`;
  },
  joinerDeclined: (e) =>
    `<span class="beat">You wave ${e.name ?? "them"} off.</span> The dungeon will find another use for them soon enough.`,
  // Phase 36 (CUT-02): the Cutthroat's per-descent Joiner risk — a
  // deterministic pick (no rng), name escaped like joinerLeft.
  joinerMurdered: (e) => {
    const rawName = e.name ?? "Your companion";
    const depth = Number.isFinite(e.depth) ? e.depth : 0;
    const idx = (String(rawName).length + depth) % JOINER_MURDER_LINES.length;
    const line = JOINER_MURDER_LINES[idx].replaceAll("{name}", escapeHtml(rawName)).replaceAll("{depth}", String(depth));
    // Phase 43 (CLAR-01): cause first — the Cutthroat is the cause.
    return `<span class="hurt">Cutthroat: ${line}</span>`;
  },
  // Phase 36 (JOIN-01): the Hero tab's Company-panel dismissal — a
  // deterministic pick (no rng, name length only), name escaped like
  // joinerLeft/joinerMurdered.
  joinerDismissed: (e) => {
    const rawName = e.name ?? "Your companion";
    const idx = String(rawName).length % JOINER_PARTING_LINES.length;
    const line = JOINER_PARTING_LINES[idx].replaceAll("{name}", escapeHtml(rawName));
    return `<span class="beat">${line}</span>`;
  },
  // Phase 36 (JOIN-01): dismissJoiner's named refusals — noParty/inCombat
  // are spelled out; badIndex and any other/unknown reason share one line.
  dismissRefused: (e) => {
    if (e.reason === "noParty") return `<span class="beat">There is nobody to send away. You checked twice.</span>`;
    if (e.reason === "inCombat") return `<span class="beat">Not in the middle of a fight. There are manners, even here.</span>`;
    return `<span class="beat">Nobody answers to that number.</span>`;
  },
  // Phase 24 (IDENT-05), reversed for Cutthroat in Phase 36 (CUT-01): a
  // Joiner is rolled exactly as normal, then declines to travel ONLY when
  // it is a Magic User Joiner meeting a Wilmsry.
  joinerRefused: (e) =>
    e.reason === "wilmsry"
      ? `<span class="beat">${e.name ?? "The Joiner"}, a Magic User, takes one look at a Wilmsry and remembers an appointment elsewhere.</span>`
      : `<span class="beat">Word has reached the Joiners.</span> The Joiners have reached the exit.`,
  // A1 (04.2 Text batch): the old template left the roll span mid-sentence
  // ("...you: <roll>N</roll>, Poison."), so stripRollDetail (mazeworld.html,
  // the over-map overlay) removed the span and left the dangling ": , Poison."
  // artifact the device-review flagged. Per this file's convention (:41-48) the
  // ENTIRE dice clause + its punctuation now lives inside the span, and the
  // kind is stated plainly outside — so what survives stripping is always a
  // clean sentence ("Something is wrong with you. Poison.") while the Oracle
  // log still shows the roll. `kind` is the REAL diagnosis (Poison/Disease),
  // never the renamed "Ailment" dispatch bucket, so the two never contradict.
  afflictionRolled: (e) =>
    `Something is wrong with you. <span class="roll">The die turns up ${e.roll ?? "?"}.</span> ${e.kind ?? "Something has its hooks in you"}.`,
  phobiaAcquired: (e) => `<span class="hurt">A new fear settles in: ${e.name ?? "something"}.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  afflictionCaught: (e) => `<span class="hurt">${e.kind ?? "It"}: it takes hold.</span> −${e.first ?? 0} hp.`,
  insanityRolled: (e) => `<span class="hurt">Insanity.</span> It ${e.result ?? "comes apart at the seams"}.${e.roll != null ? ` <span class="roll">d6 → ${e.roll}.</span>` : ""}`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  insanitySelfHarm: (e) => `<span class="hurt">Insanity: you turn on yourself.</span> −${e?.loss ?? 0} hp.`,
  insanityRage: (e) => `<span class="hurt">Rage: +${e.amount ?? 0} might.</span>`,
  darknessFell: () => `<span class="beat">The dark closes in around you.</span>`,
  // PHOBIA-01 (04.1-05): the persistent darkness counter fallDark sets
  // (engine/encounters.js) clears at zero via engine/movement.js's per-step
  // tick — this is that "it lifts" line.
  darknessLifted: () => `<span class="hit">The dark loosens its grip. You can see again.</span>`,
  // Phase 15 item-wiring (ECON-08): the Amulet of Light's standing light spell
  // burns the persistent darkness off outright, rather than waiting it out.
  darknessDispelled: () => `<span class="hit">Your amulet's light swallows the dark whole. It does not argue.</span>`,
  // Phase 39 (GEAR-05): the torch — lights a live c.darkFor darkness and
  // starts the 40-square lit effect (itemEffectStarted below narrates the
  // effect start itself); darknessResisted is the SAME lit effect holding
  // off a LATER Darkness table result entirely.
  torchLit: () => `<span class="hit">You light the torch. The dark files a complaint.</span>`,
  darknessResisted: () => `<span class="hit">Darkness tries. Your torch declines.</span>`,
  miscMagicRolled: (e) => `<span class="beat">Miscellaneous magic:</span> ${e.what ?? "something"}.`,

  /* ---------------- items.js ---------------- */

  itemGiven: (e) => `<span class="hit">Received:</span> ${e.item?.n ?? "something"}.`,
  // Phase 24 (IDENT-07): a Woodsman's "no mail, no plate" bad gets its own
  // clause ahead of the generic reasons below, which stay byte-identical.
  // Phase 25 (FEED-02): an Acrobat's dagger-only rule gets its own clause
  // too, ahead of the same generic fallback.
  // Phase 39 (GEAR-05): a tool never duplicates — its own clause ahead of
  // the generic fallback, mirroring the woodsman/acrobat clauses above.
  // Phase 61 (STORE-02): pre-payment refusals make a store legality
  // rejection (wrongClass/tooHeavy/noArmor) a LIVE path here now (buyFrom
  // used to charge first and reject after) — the generic fallback used to
  // read "Not an upgrade." for every non-woodsman/acrobat/haveOne reason,
  // which mislabeled a class/race refusal. `notBetter` keeps that exact
  // line; everything else (wrongClass/tooHeavy/noArmor/notEquippable/
  // unknown) now mirrors equipRejected's own generic refusal line.
  itemRejected: (e) =>
    e.reason === "woodsman"
      ? `<span class="miss">A Woodsman in ${e.item?.n ?? "that"} is a tree in a tin.</span> No.`
      : e.reason === "acrobat"
        ? `<span class="miss">An Acrobat carries a dagger. A dagger. That is the whole list.</span>`
        : e.reason === "haveOne"
          ? `<span class="miss">You already carry one ${e.item?.n ?? "of those"}.</span> One is the limit; two is a hobby.`
          : e.reason === "notBetter"
            ? `<span class="miss">Not an upgrade.</span> ${e.item?.n ?? "something"}.`
            : `<span class="miss">Not for the likes of you.</span> ${e.item?.n ?? "That"} refuses your hands${e.reason === "noArmor" ? " — your kind wears no armour" : ""}.`,
  // Phase 61 (STORE-02): an additive `replaced` (the traded-in weapon/armor
  // piece) appends one clause; the no-replaced text stays byte-identical.
  itemTaken: (e) =>
    `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}.${e.replaced?.n ? ` The shopkeeper keeps your old ${e.replaced.n}.` : ""}`,
  itemUsed: (e) => `You use ${e.item?.n ?? "something"}.`,
  // Phase 24 (IDENT-07): a Pilfer's "cannot use a single magic item that
  // doesn't heal" bad — the refusal fires before any side effect.
  // Phase 31 (CMB-02/CMB-03/CMB-01): extends the pilfer-only reason with
  // cooldown/wrongClass/combatOnly/exploreOnly/noTarget/notFought — the
  // pilfer line stays byte-identical.
  // Phase 39 (GEAR-02): cooldown's wording moved to the vending-machine line
  // below; a NEW "recharging" reason (an empty staff) gets its own line.
  useRefused: (e) => {
    const item = e.item?.n ?? "That";
    if (e.reason === "cooldown") return `<span class="miss">${item}: ${e.left ?? "?"} squares.</span> It is not a vending machine.`;
    if (e.reason === "recharging") return `<span class="miss">${item}: ${e.left ?? "?"} squares to the next charge.</span> Patience is also a spell.`;
    if (e.reason === "wrongClass") return `<span class="miss">${item} is a stick to anyone who is not a Magic User.</span>`;
    // Phase 37 (GEAR-03): a cloak/jewelry/staff activatable used from the
    // BAG in the new worn-slot model — activatables must be worn to work.
    if (e.reason === "notWorn") return `<span class="miss">${item} is in your bag,</span> doing what things in bags do: nothing. Wear it first.`;
    if (e.reason === "combatOnly") return `<span class="miss">${item} wants a target.</span> Save it for a fight.`;
    if (e.reason === "exploreOnly") return `<span class="miss">${item} needs quieter surroundings.</span>`;
    if (e.reason === "noTarget") return `<span class="miss">Nothing left to aim at.</span>`;
    if (e.reason === "notFought") return `<span class="miss">Fight! first.</span> It will keep.`;
    // Phase 39 (GEAR-05): the torch used while not dark.
    if (e.reason === "notDark") return `<span class="miss">It is not dark.</span> Save the torch for when it is.`;
    return `<span class="miss">${item} does not heal,</span> so as far as a Pilfer is concerned it does not work.`;
  },
  cured: (e) => `<span class="hit">Cured of ${e.kind ?? "it"}.</span>`,
  foeStoned: (e) => `<span class="hit">${(e.names ?? []).join(", ") || "It"} turn to stone.</span> Statues don't hit back.`,
  itemBurned: (e) => `<span class="roll">${e.total ?? 0}</span> fire damage spread across the room.`,
  itemFizzled: () => `<span class="miss">Nothing happens.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  itemConsumed: (e) => `Spent: ${e.item?.n ?? "It"}. One use, as advertised.`,
  // Phase 39 (GEAR-02): the item activation model's four new events — a use
  // starts an effect (itemEffectStarted, kind-keyed line), the tick sites
  // narrate the transitions (itemEffectFaded/itemCooled/staffRecharged).
  itemEffectStarted: (e) => {
    const n = e.left;
    const map = {
      haste: `<span class="hit">Double attacks for ${n} squares.</span>`,
      invis: `<span class="hit">Unseen for ${n} squares. They swing at where you were.</span>`,
      // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19):
      // states the count and, in voice, that ending inside stone is fatal.
      ether: `<span class="hit">${n} squares of walking through stone. Be in a corridor when it ends — the stone will not make room.</span>`,
      acute: `<span class="hit">You strike on a d6 for ${n} rounds.</span>`,
      might: `<span class="hit">+${e.might ?? "?"} damage for ${n} squares. Hit things.</span>`,
      fly: `<span class="hit">Twenty squares of not touching the floor.</span>`,
      // Phase 39 (GEAR-05): the torch's lit effect.
      lit: `<span class="hit">Forty squares of carrying a light.</span>`,
      // 260918-w4n (use-activated-only): the 7 newly use-activated kinds.
      power: `<span class="hit">+1 damage for ${n} squares. The ring approves.</span>`,
      giant: `<span class="hit">${n} squares of being one size too large for the corridor.</span>`,
      glow: `<span class="hit">Fifty squares of being your own lantern.</span>`,
      unseen: `<span class="hit">Unseen for ${n} squares. They need two better.</span>`,
      tongue: `<span class="hit">${n} squares of perfect fluency. Do not waste it on small talk.</span>`,
      brace: `<span class="hit">${n} squares with nothing critical landing on you.</span>`,
      plate: `<span class="hit">${n} squares of weightless plate.</span>`,
    };
    return map[e.kind] ?? `<span class="hit">${e.item ?? "It"}: ${n} squares.</span>`;
  },
  itemEffectFaded: (e) => `<span class="beat">${e.item ?? "It"} wears off.</span>`,
  itemCooled: (e) => `<span class="hit">${e.item ?? "It"} is ready again.</span>`,
  staffRecharged: (e) => `<span class="hit">${e.item ?? "It"} hums.</span> ${e.charges ?? "?"}/${e.max ?? "?"}.`,

  /* ---------------- inventory actions (ECON-03/04/05, Phase 13) ----------------
     The find offer/accept/decline + bag keep/drop + equip/unequip lines. Deadpan,
     dark-but-family-friendly (a VOX-02 safety scan checks these) — the dungeon is
     never impressed by your acquisitiveness. */

  // A find is dangled in front of you; you have not touched it yet (the UI's
  // Take it / Leave it prompt narrates the decision).
  findOffered: (e) => `<span class="beat">Something's here for the taking: ${e.name ?? "something"}.</span> Your call.`,
  findTaken: (e) => `<span class="hit">Into the bag it goes:</span> ${e.item?.n ?? "something"}. You'll regret the weight eventually.`,
  findLeft: (e) => `<span class="miss">You leave ${e.item?.n ?? "it"} where it lay.</span> The dungeon respects restraint from no one.`,
  // The bag is full — nothing more fits until something is dropped. Phase 29
  // (LOOT-04): when the event carries have/slots (every current push site
  // does), append the count; a bare {type} call keeps today's wording.
  bagFull: (e) =>
    `<span class="miss">No room.</span> The bag is stuffed; drop something before ${e.item?.n ? `taking ${e.item.n}` : "you can take that"}.${e.have != null && e.slots != null ? ` (${e.have}/${e.slots})` : ""}`,
  // Phase 29 (LOOT-05): a bag upgrade item was taken — c.bag went up a tier.
  bagUpgraded: (e) =>
    `<span class="hit">A bigger bag.</span> ${e.item?.n ?? "It"} holds ${e.slots ?? "more"} slots — more room to make worse decisions in.`,
  itemDropped: (e) => `<span class="beat">You drop ${e.item?.n ?? "it"}.</span> Lighter, poorer, wiser — pick two.`,
  // Phase 37 (GEAR-03): an additive `replaced` payload names the swapped-out
  // worn item; the no-replaced line stays byte-identical. 260918-wy1
  // (jewelry-merge): the slot renders through slotWord — jewelry1/jewelry2
  // both read "jewelry", never a raw key.
  itemEquipped: (e) =>
    `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}${e.slot ? ` (${slotWord(e.slot)})` : ""}. Whether that was wise is between you and the maze.${e.replaced?.n ? ` ${e.replaced.n} goes back in the bag — the maze is not a jeweller.` : ""}`,
  // Phase 28 (ARMOR-03): a destroyed piece never re-enters the bag — narrate
  // that honestly instead of the usual stow-and-improvise line. 260918-wy1:
  // the slot renders through slotWord here too.
  itemUnequipped: (e) =>
    e.destroyed
      ? `<span class="beat">You peel off what is left of your ${e.item?.n ?? "armor"}</span> and leave it where it falls. The bag declines the honor.`
      : `<span class="beat">You stow your ${e.slot ? slotWord(e.slot) : "gear"}</span> — ${e.item?.n ?? "it"} back in the bag, and you back to improvising.`,
  // Tried to wear/wield something your class, subclass, or race cannot.
  // Phase 24 (IDENT-07): a Woodsman gets its own clause; every other reason
  // (noArmor/wrongClass/notEquippable) stays byte-identical.
  // Phase 25 (FEED-02): an Acrobat's dagger-only rule gets its own clause.
  // 260918-wy1 (jewelry-merge): jewelryFull/wrongSlot each get their own
  // clause ahead of the generic fallback.
  equipRejected: (e) =>
    e.reason === "woodsman"
      ? `<span class="miss">A Woodsman in ${e.item?.n ?? "that"} is a tree in a tin.</span> No.`
      : e.reason === "acrobat"
        ? `<span class="miss">An Acrobat carries a dagger. A dagger. That is the whole list.</span>`
        : e.reason === "jewelryFull"
          ? `<span class="miss">Two pieces of jewelry. That is the limit.</span> ${e.item?.n ?? "It"} waits in the bag until something comes off.`
          : e.reason === "wrongSlot"
            ? `<span class="miss">${e.item?.n ?? "That"} does not go there.</span> Try the slot it was made for.`
            : `<span class="miss">Not for the likes of you.</span> ${e.item?.n ?? "That"} refuses your hands${e.reason === "noArmor" ? " — your kind wears no armour" : ""}.`,
  // Phase 61 (GRULE-01): the combat gear lock — equipItem/unequipSlot refuse
  // with the "outfit" line; the loot/find verbs (parked mid-fight by a
  // multi-foe kill or a lingering find) get their own "spoils can wait" line.
  // Defends every field with `?.`/`??` so a bare `{ type }` call (the
  // coverage/voice scans' own invocation shape) still returns the gear line.
  gearRefused: (e) =>
    e?.verb === "takeLoot" || e?.verb === "takeAllLoot" || e?.verb === "takeFind"
      ? `<span class="miss">The spoils can wait until the fight is over.</span> The fight, rudely, will not.`
      : `<span class="miss">Not the moment to change outfits.</span> You fight in what you walked in wearing.`,

  /* ---------------- pending loot pile (LOOT-01/02/06, Phase 29) ----------------
     A foe drop lands on a pile, not in your hands — the loot screen's own
     take/leave/take-all/leave-all prompt IS the UI (mirrors the find card's
     findOffered/findTaken/findLeft voice above); a forfeit narrates the whole
     pile in one honest line. Deadpan, dark-but-family-friendly (VOX-02). */
  lootDropped: (e) =>
    `<span class="beat">Something falls out of the fight: ${e.name ?? "something"}.</span> It will wait. It has nowhere else to be.`,
  lootTaken: (e) => `<span class="hit">Into the bag:</span> ${e.item?.n ?? "something"}. Your back sends its regards.`,
  lootLeft: (e) => `<span class="miss">You leave ${e.item?.n ?? "it"} on the floor.</span> Someone will be thrilled. Not you.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  lootForfeited: (e) => {
    const items = e.items ?? [];
    const names = items.map((i) => i?.n ?? "something").join(", ") || "the spoils";
    if (e.reason === "died") {
      const verb = items.length === 1 ? "stays" : "stay";
      const pronoun = items.length === 1 ? "it fell" : "they fell";
      return `<span class="miss">Dead: ${names} ${verb} where ${pronoun}.</span> So, for that matter, do you.`;
    }
    return `<span class="miss">Fled: the loot stays with them — ${names}.</span>`;
  },
};

/**
 * narrateEvent(e) — Phase 25.1 (DFB-01 decision 2). Returns ONE event's
 * Oracle HTML line (the same string EVENT_NARRATION[e.type](e) would
 * produce), or "" for a null/undefined event, an event without a string
 * `type`, or a type with no EVENT_NARRATION entry (so "moved" is ""). This
 * exists because engineAdapter.js's formatEvents filters null lines — html
 * is NOT 1:1 with events — and the narration-line layer needs exactly one
 * event's line to pass through narrativeLineText (src/browser/narrationLines.js).
 */
export function narrateEvent(e) {
  if (!e || typeof e.type !== "string") return "";
  const builder = EVENT_NARRATION[e.type];
  if (typeof builder !== "function") return "";
  return builder(e) || "";
}
