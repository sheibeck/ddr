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
import { slotWord, initiativeVerdictText, bookRefillText } from "./narrationLines.js";
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
import { rangeText, rollVsText, modsClause, signedText, ROLLERS, bottomRangeText, toHitText } from "./rollRange.js";
// RULES-07 (Phase 75): afflictionRolled reads the row's own `phobia` flag by
// roll so a mind-row (5-6) narrates honestly instead of printing "Disease." —
// pure content data, no engine/ import, same discipline as the flavor.js
// import above.
import { AFFLICTIONS } from "../../content/afflictions.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// VOX-05 (Phase 79, plan 79-11): an item effect's length, "1 square", never
// "1 squares", and never a leaked "undefined squares" on an event with no
// count.
const squaresText = (n) => (Number.isFinite(n) ? plural(n, "square") : "a few squares");

// VOX-05 (Phase 79, plan 79-11): "an Apprentice", never "a Apprentice".
const withArticle = (word) => `${/^[aeiou]/i.test(String(word)) ? "an" : "a"} ${word}`;

// VOX-05 (Phase 79, plan 79-04): a named foe's possessive, or the caller's
// fallback when the event names no one ("its", never the "it's" a bare
// `${e.name ?? "it"}'s` used to print).
const possessive = (name, fallback) => (name ? `${name}'s` : fallback);
/** wardName(item) — critWarded's `item` is the warding item's display name
 * (engine/derived.js#critWardOf); an item object or a missing field reads
 * as its `n` or "cloak" (quick 260928-cos). */
const wardName = (item) => (typeof item === "string" && item ? item : typeof item?.n === "string" && item.n ? item.n : "cloak");

// VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): every gain line leads with
// the HP actually gained — the engine's additive `gained`, after the clamp
// to max. A capped gain adds what was on offer and says the hero is back to
// full; a gain of 0 says nothing came back instead of printing "+0". A
// hand-built event with no `gained` falls back to its pre-clamp value, so
// the coverage guard's bare `{ type }` calls still render.
const gainOf = (e, offered) => (Number.isFinite(e?.gained) ? e.gained : Number.isFinite(offered) ? offered : 0);
/** cappedNote(gained, offered, how) — " (8 rolled, back to full)" / " (worth 8, back to full)" / "" when nothing was capped. */
const cappedNote = (gained, offered, how = "rolled") =>
  Number.isFinite(offered) && gained > 0 && gained < offered ? ` (${how === "worth" ? `worth ${offered}` : `${offered} rolled`}, back to full)` : "";

// VOX-05 (Phase 79, plan 79-02, todo 2026-09-26): the table-roll line names
// a Table 4 row by its EFFECT, never by its canon cell ("-15 HP" deals the
// HERO_HP_SCALE-scaled amount, 19 at depth 3, and the effect line prints
// that one number). Module-private presentation data: every cell holding a
// digit or a sign maps here (test/unit/honest-gains.test.js pins it through
// the rendered lines); every other cell (a foe family, Store, Faerie…)
// reads as itself.
const TABLE_FOUR_EFFECT = Object.freeze({
  "+10 HP": "a small mercy",
  "-10 HP": "a cut",
  "+10 XP": "a lesson",
  "+25 HP": "a rare kindness",
  "+25 XP": "a hard lesson",
  "-15 HP": "a toll",
  "-All armour": "a wardrobe audit",
});

/** tableFourTail(e) — the signed amount a Table 4 row actually made, after its prose: " −19 hp." / " +31 max hp." / " +13 experience." / "" (armour, or a hand-built event with no amount). */
function tableFourTail(e) {
  if (!Number.isFinite(e?.amount)) return "";
  if (e.stat === "hp") {
    if (e.amount === 0) return " You were already at full hp, so it goes to waste.";
    return ` <span class="${e.amount < 0 ? "hurt" : "hit"}">${signedText(e.amount)} hp</span>${e.amount > 0 ? cappedNote(e.amount, e.rolled, "worth") : ""}.`;
  }
  if (e.stat === "maxHp") return ` <span class="hit">${signedText(e.amount)} max hp.</span>`;
  if (e.stat === "xp") return ` <span class="roll">${signedText(e.amount)} experience.</span>`;
  return "";
}

// RULES-18 (Phase 75.3, Plan 04): the four control-at-depth events
// (controlResisted/controlHeld/foeStillHeld/foeHoldBroken) share these two
// word maps — an effect name (freeze/stone/sleep/weaken/stupid/blind/shrink,
// engine/combat.js's own `resistControl` vocabulary) reads as a noun phrase
// ("the frost", not "the freeze"), and a held `kind` (frozen/stone/stupid,
// `holdFoe`'s vocabulary) reads as its own short adjective. Both fall back
// to a generic word rather than printing the raw engine string verbatim.
const CONTROL_EFFECT_WORD = Object.freeze({
  freeze: "the frost", stone: "the stone", sleep: "the sleep", weaken: "the weakening",
  stupid: "the stupidity", blind: "the blindness", shrink: "the shrinking",
});
const CONTROL_HOLD_WORD = Object.freeze({ frozen: "frozen solid", stone: "turned to stone", stupid: "stupefied" });

// VOX-05 (Phase 79, plan 79-08): what each Insanity face does
// (engine/magic.js's insane branch). A 2 (strikes a neighbour) and a 3 or 6
// (flees) have their own lines right after, so they add nothing here; a 1
// is followed by the foeKilled line, a 4 by a resist line if it shrugs off
// the sleep. A 5's frenzy doubles its swings (engine/combat.js#foeTurn).
const INSANE_FACE = Object.freeze({
  1: ", and it simply keels over",
  4: ", and it tries to lie down for a nap, d4 rounds",
  5: ", and it flies into a frenzy: twice the swings from here on",
});

// Phase 25.1 (DFB-04): a member/newcomer name is interpolated TWICE into
// markup for the joinerLeft snark line — escape so a name containing '<'
// renders as visible text, never a live tag.
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Phase 25 (FEED-01, additive payload) shared render helper — a pure string
// builder over the additive `soaked` event field, reused by every
// combat-narration entry below that can carry it. Never throws on a
// missing/empty input (mirrors this module's `??`/`?.` defense convention),
// so the coverage guard's bare `{type}` calls stay safe.

/** soakedText(soaked) — " (hide soaked 2)" / " (Hardiness soaked 3, ward soaked 4)" / "" */
function soakedText(soaked) {
  if (!soaked) return "";
  const parts = [];
  if (soaked.hardiness) parts.push(`Hardiness soaked ${soaked.hardiness}`);
  if (soaked.hide) parts.push(`hide soaked ${soaked.hide}`);
  if (soaked.ward) parts.push(`ward soaked ${soaked.ward}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

// Phase 74 (ROLL-02/03, "Roll Display & Modifier Honesty" — 74-CONTEXT's
// "Modifier signs everywhere", user-accepted 2026-09-25): every displayed
// modifier is signed from the PLAYER's side — + is always better for the
// player, − is always worse. The engine's own `mods` deltas stay signed for
// the ROLLER (a hero/ally roll's delta reads as-is; a foe roll's delta must
// be negated so a bonus to the foe still reads as a minus to the player).
// src/browser/rollRange.js's modsClause (imported above) is the ONE place
// that flip happens — keyed on an explicit roller passed at every call site
// below: ROLLERS.you for the hero's own rolls (strikeMissed, struck,
// spellThrown, fleeRolled), ROLLERS.ally for a party member's/summon's own
// roll (allyMissed, allyCast), ROLLERS.foe for a foe's roll against the hero
// or a member (memberStruck, foeMissed, struckByFoe). The stored event
// `mods` values themselves are NEVER mutated by any call here. The
// module-private modsText/modsClause this file used to define are gone —
// every call site below imports the shared, roller-aware versions instead.

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

// Quick 260928-nrf (user ruling 2026-09-28, "Kata and Feint roll to hit"):
// the clause a missed Kata or Feint appends to strikeMissed (its `via`). The
// fact first (the use is spent all the same), then the joke. Module-private:
// the corpus reads these through the strikeMissed builder (oracle:strikeMissed).
const STRIKE_MISS_VIA = Object.freeze({
  kata: "Kata is spent all the same: one perfect form, one imperfect result.",
  feint: "Feint is spent all the same: they looked left, and so did your blade.",
});

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
  // Phase 78 (CLIMB-01): every hero now pauses at a wall or crevice, so a
  // hero without the tool (`carried` false) gets a line of their own.
  hazardChoice: (e) => {
    const wall = e.feat ? e.feat === "climb" : e.tool === "ladder";
    if (e.carried === false) {
      return wall
        ? `<span class="beat">A wall. No ladder. Just you, your fingers, and a strong opinion about gravity.</span>`
        : `<span class="beat">A crevice. No rope. The gap is waiting to see how far you think you can jump.</span>`;
    }
    return wall
      ? `<span class="beat">A wall. Also: a ladder. Someone thought of everything, and it was you.</span>`
      : `<span class="beat">A crevice, and you happen to have rope. The honest way across.</span>`;
  },
  // Phase 78 (CLIMB-02): TURN BACK on the pre-roll card — free, no roll.
  turnedBack: (e) =>
    e.feat === "gorge"
      ? `<span class="beat">You step back from the edge. The crevice will be here, being deep, when you change your mind.</span>`
      : `<span class="beat">You leave the wall unclimbed. It does not seem to mind.</span>`,
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
  // Phase 74 (ROLL-02/03): the trailing clause reads the player-signed cost
  // of the check — a phobia's `penalty` is a positive number of winning
  // faces it removes, so the displayed sign is always negative (the missing
  // "0" case still reads "0", never "−0").
  heightsFear: (e) => `<span class="beat">Heights: your stomach reaches the ground well before your feet do.</span> ${signedText(-(e?.penalty ?? 0))} on the climb.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // Phase 74 (ROLL-02/03): see heightsFear's comment above for the sign rule.
  waterFear: (e) => `<span class="beat">Bodies of water: something down there may be wet. That is enough.</span> ${signedText(-(e?.penalty ?? 0))} on the leap.`,
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
  // Phase 78 (78-05): the count reads have/max, the same "(9/12)" the rail
  // line (narrationLines.js LINE_FOR.spellChargeRecovered) and the refill
  // clause use; a move's rail line is this sentence, tags stripped.
  spellChargeRecovered: (e) =>
    `<span class="beat">Twenty quiet squares, and a spell charge is ready again (${e.charges ?? "?"}/${e.max ?? "?"}).</span> The dungeon keeps no such courtesy for you.`,
  dayBegan: (e) => `<span class="banner">Day ${e.day ?? "?"}.</span>`,
  rested: (e) =>
    `Rest restores <span class="hit">+${gainOf(e, e.amount)} hp</span>.${e.doubled ? ` (${e.doubled}: twice as fast, as promised.)` : ""}`,
  // 260918-w4n (use-activated-only): the Cloak of Healing is removed from
  // the game (the "cloakHealed" event type no longer exists anywhere) — the
  // Cloak of Regeneration is now use-activated, a flat d6 back ON USE, then
  // a 20-square cooldown, not a per-step tick.
  // VOX-05 (Phase 79, plan 79-02): used at full, the cloak says so.
  cloakRegenerated: (e) =>
    gainOf(e, e.amount) > 0
      ? `<span class="hit">Flesh knits itself back — +${gainOf(e, e.amount)} hp.</span> Ask again in twenty squares.`
      : `<span class="miss">The cloak finds nothing to knit.</span> You were already at full hp. Ask again in twenty squares.`,
  // VOX-05 (Phase 79, plan 79-11): the +N is armour (the rail twin says so too).
  armorPatched: (e) => `${e.by ? `${e.by}: ` : ""}<span class="hit">+${e.amount ?? 0} armour</span> patched back into your kit.`,
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
    // Phase 78 (78-05): a fed day that refilled a spent book leads with it
    // (`books`, stamped by stampBookRefill below — never without the engine's
    // own `refilled` flag), then the rations exactly as before.
    const refill = bookRefillText(e?.books);
    const lead = refill ? `<span class="hit">A new day. ${refill}</span> ` : "";
    return `${lead}<span class="beat">Rations: ${clauses}.</span>${ruleSentence ? ` ${ruleSentence}` : ""} −${plural(eats, "ration")}, ${left} left.`;
  },
  // Phase 43 (CLAR-01/03/05): hunger names need/have/mouths and the Heft
  // halving — rewritten from the old "No rations." to cause-first, cost-last.
  // RULES-15 (Phase 75, user 2026-09-25): the `booksKept` clause names WHY a
  // spent spell book stays empty — an unfed day never refills it (the fed
  // branch's own refill is the only source of a fresh charge). Omitted when
  // there was nothing to keep empty (no spent charges) or the hero did not
  // survive the hunger (that day's own `died` line already says everything
  // that needs saying).
  wentHungry: (e) => {
    const need = e?.need ?? 1;
    const have = e?.have ?? 0;
    const mouths = e?.mouths ?? 1;
    const cost = e?.cost ?? 0;
    const eatClause = mouths > 1 ? "the party eats" : "you eat";
    // VOX-05 (Phase 79, plan 79-11): the fact first, the joke after it ("nobody
    // packed" used to come before the numbers, and read false when you had some).
    return `<span class="hurt">Hunger: ${eatClause} ${need} a night, and you had ${have}.</span> Nobody packed enough. Cost of living −${cost} hp${e?.heft ? " (Heft: half, as promised)" : ""}.${e?.booksKept ? " No supper, no sleep worth the name. Your book stays empty." : ""}`;
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
  // RULES-12 (Phase 75, user 2026-09-25, DECLARED CANON DIVERGENCE — the
  // prototype simply drops a tile the wandering-monster check interrupted):
  // the fight (and any spoils/find/store after it) has settled, the hero is
  // still standing on the tile, and the feature it was holding under its
  // boots resolves now, keyed on `feat` — the SAME six values move()'s own
  // destination-cell dispatch reads. The feature's own event follows
  // immediately after this one, narrating what actually happened.
  tileResumed: (e) => {
    const clause =
      { dot: "the dropped coin", trap: "the trap", chest: "the chest", tele: "the teleporter", exit: "the stairs down", gate: "the stairs down" }[
        e?.feat
      ] || "the tile";
    return `<span class="beat">With that settled — ${clause}.</span>`;
  },
  // Phase 25.1 (DFB-06): the refusal states the numbers — the hero's need,
  // what's on hand, and (when a party exists) who else is eating. A bare
  // `{type}` payload (the coverage test's shape) renders "?" rather than
  // undefined/NaN.
  // VOX-05 (Phase 79, plan 79-11): the refusal names what it refused (the
  // camp), and `need` is the whole party's night (engine/movement.js#
  // nightlyEats), so a party reads "the party eats N" with each member's
  // share inside it, never "you eat N (Mira eats 1 more)".
  campFailed: (e) => {
    const members = e.members ?? [];
    if (e.need == null || e.have == null) return `<span class="miss">Not enough food to make camp.</span> Find rations first.`;
    const shares = members.map((m) => `${m.name ?? "Your companion"} eats ${m.eats ?? 1}`).join(", ");
    const eaters = members.length ? `the party eats ${e.need} a night (${shares} of those)` : `you eat ${e.need} a night`;
    return `<span class="miss">Not enough food to make camp: ${eaters}, and you have ${e.have}.</span> Find rations first.`;
  },
  teleported: () =>
    `<span class="beat">You teleport to an unknown location on this floor…</span> the dungeon does not offer refunds.`,
  spGained: (e) => {
    const reason = e.reason === "parley" ? "Talking your way out" : e.reason === "descend" ? "Surviving the floor" : "That";
    // VOX-05 (Phase 79, plan 79-04): the count prints once, outside a roll
    // span, so the Oracle and the overlay's roll-stripped copy read the
    // same sentence (it used to print "worth 8 8 experience points").
    return `${reason} is worth ${plural(e.amount ?? 0, "experience point")}.`;
  },
  floorChanged: (e) => `<span class="banner">Floor ${e.depth ?? "?"}.</span> The air gets worse, and takes it personally.`,
  leveled: (e) => `<span class="hit">Skill level ${e.level ?? "?"}</span> (+${gainOf(e, e.wpGain)} hp).`,
  // Phase 38 (ABIL-01/03): a level-pool ability roll, folded as the SKILL
  // LEVEL N card's second line (see rail.js's matching family entry).
  // VOX-05 (Phase 79, plan 79-11): no dangling " — " when the event carries no text.
  abilityLearned: (e) => `<span class="hit">New trick: ${e.name ?? "something"}</span>${e.txt ? ` — ${e.txt}` : "."}`,
  died: () => `<span class="hurt">You have died.</span>`,

  /* ---------------- combat.js ---------------- */

  encounterStarted: (e) => {
    const names = (e.foes ?? []).map((f) => f.name).join(", ") || "Something";
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
    // VOX-05 (Phase 79, plan 79-04): the penalty is on YOUR swings ("harder
    // to hit" read as if foes found you harder to hit).
    const base = `<span class="hurt">Your phobia has you shaking.</span> For ${plural(e.rounds ?? 2, "round")} your swings land less often and hit softer. You can still swing — you just will not enjoy it.`;
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
  // VOX-05 (Phase 79, plan 79-04): the line names what the frenzy gives you.
  frenzy: () => `<span class="hurt">Frenzy: something in your blood takes over, and you get a second wild swing.</span>`,
  // Phase 25 (FEED-05 Oracle half): `e.quip` is a PRESENTATION-ONLY field —
  // never set by the engine, only by 25-02's decorateMisses — appended after
  // the roll and the plain miss sentence so the Oracle keeps the roll first.
  // Absent `quip` renders byte-identical to before.
  // Quick 260928-nrf (user ruling 2026-09-28): Kata and Feint roll to hit
  // now (three more winning faces, the `mods` clause's "Kata +3"), so a miss
  // is an ordinary miss that names the ability and says it is still spent.
  strikeMissed: (e) =>
    e.untouchable
      ? `<span class="miss">${e.target ?? "It"} cannot be touched like that.</span>`
      : `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.you)}. <span class="miss">You miss ${e.target ?? "it"}.</span>${STRIKE_MISS_VIA[e.via] ? ` ${STRIKE_MISS_VIA[e.via]}` : ""}${e.quip ? ` ${e.quip}` : ""}`,
  deathTouch: (e) => `<span class="hit">One touch. ${e.target ?? "It"} drops.</span>`,
  // VOX-05 (Phase 79, plan 79-04): the line says what the armour cost you.
  backstabDenied: () => `<span class="miss">Heavy armour gives you away: no sneak attack.</span>`,
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
      // VOX-05 (Phase 79, plan 79-04): a Ninja crits on the die's top two faces.
      ninja: "A Ninja's top two faces. Critical!",
      cutthroat: "The Cutthroat's first blow. Critical!",
      deathTouch: "Called it. Critical!",
      silentStep: "Not a sound. Critical!",
    };
    const critText = e.critical ? `<span class="hit">${CRIT_BY_TEXT[e.critBy] ?? "Critical!"}</span> ` : "";
    // Phase 31 (Afraid): modsClause names the -3 afraid penalty when
    // present; `e.afraid` appends the pulled-blow line (absent for every
    // non-afraid strike, byte-identical to before). Phase 73 (ROLL-05): the
    // range replaces the old "vs N" single number.
    return `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.you)}. ${critText}You hit ${e.target ?? "it"} for <span class="roll">${e.dmg ?? 0}</span> hp.${e.afraid ? ` <span class="miss">Fear pulls the blow.</span>` : ""}`;
  },
  foeRevived: (e) => `<span class="miss">${e.name ?? "It"} gets back up.</span>`,
  foeKilled: (e) => `<span class="hit">${e.name ?? "It"} falls.</span> +<span class="roll">${e.spGained ?? 0}</span> XP.`,
  // Phase 72 (ROLL-01 (c)): a landed best-face strike shatters a
  // shatter-flagged foe outright, both lives at once — no damage roll, no
  // XP-bearing foeKilled reprise needed here (foeKilled still narrates the
  // kill separately). Safe on a bare `{ type }` payload (the coverage guard).
  foeShattered: (e) =>
    `<span class="hit">${e.by === "you" ? "Your" : `${e.by ?? "Something"}'s`} best roll lands clean. ${e.target ?? "It"} comes apart, both lives at once, and nobody is sweeping up.</span>`,
  // VOX-05 (Phase 79, plan 79-02): the meal leads with the HP it really restored.
  cooked: (e) =>
    (e.wp ?? 0) <= 0
      ? `You salvage a ration off the carcass. <span class="hit">+${e.rations ?? 1} ration.</span>`
      : gainOf(e, e.wp) > 0
        ? `You cook what is left. <span class="hit">+${gainOf(e, e.wp)} hp${cappedNote(gainOf(e, e.wp), e.wp, "worth")}, +${e.rations ?? 1} ration.</span>`
        : `You cook what is left, but you were already at full hp. <span class="hit">+${e.rations ?? 1} ration.</span>`,
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
    return `Flee: rolled <span class="roll">${roll}</span> vs ${rangeText(e?.atLeast, e?.dieN)}${modsClause(mods, ROLLERS.you)}.`;
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
    `Talk it down: <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${e.fluency ? ` (${signedText(e.fluency * 2)} for the tongue)` : ""}.`,
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
  // VOX-05 (Phase 79, plan 79-04): the three song lines name who the song
  // reached. Lullaby and Thunder roll how MANY foes the song can reach
  // (engine/combat.js#sing: `foes.slice(0, n)`, and only a foe not above the
  // hero's level) — "up to", never a count of foes that actually slept.
  beastsSoothed: (e) =>
    `<span class="hit">${(e.count ?? 0) === 1 ? "1 beast calms right down and wanders off" : `${e.count ?? 0} beasts calm right down and wander off`}.</span>`,
  songIgnored: () => `<span class="miss">They do not care for music.</span>`,
  lullabyRolled: (e) => `The lullaby reaches up to <span class="roll">${e.n ?? 0}</span> of them. Any not above your level nod off.`,
  thunderRolled: (e) =>
    `Thunder rolls: up to <span class="roll">${e.n ?? 0}</span> of them freeze for <span class="roll">${e.r ?? 0}</span> round${e.r === 1 ? "" : "s"}. Any above your level shrug it off.`,
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
      ? `${e.name ?? "Your ally"} swings${e.weapon ? ` a ${e.weapon}` : ""} at ${e.target} and misses.${e.roll != null ? ` <span class="roll">${e.roll} vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.ally)}.</span>` : ""}${e.via && ABILITY_BY_ID[e.via] ? ` (${ABILITY_BY_ID[e.via].name})` : ""}`
      : `${e.name ?? "Your ally"} swings and misses.`,
  allyDeparted: (e) => `${e.name ?? "Your ally"} slips away, obligation met.`,
  // DFB-05 (Phase 25.1): a Magic User party member's cast — allyCast is the
  // announcement (Oracle-only; narrationLines.js's ORACLE_ONLY entry), always
  // followed in the same action by exactly one of allySpellHit/allySpellMissed.
  allyCast: (e) =>
    `${e.name ?? "Your ally"} casts <span class="hit">${e.spell ?? "a spell"}</span> at ${e.target ?? "the nearest foe"}.${e.roll != null ? ` <span class="roll">${e.roll} vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.ally)}.</span>` : ""}`,
  allySpellHit: (e) => {
    const who = e.name ?? "Your ally";
    // VOX-05 (Phase 79, plan 79-04): a bare event read "Your ally's The spell".
    const sp = e.spell ?? "spell";
    const t = e.target ?? "the foe";
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
    `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.foe)}. ${e.critical ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} turns on ${e.member ?? "your companion"} for <span class="hurt">${e.dmg ?? 0} hp</span>.`,
  // PARTY-05: a member hits 0 hp — they do not die a hero's death, they simply
  // decide this dungeon is no longer their problem and leave the run.
  memberDowned: (e) => `<span class="hurt">${e.name ?? "Your companion"} goes down, and what is left of them wants no further part of this.</span>`,
  regenerated: (e) =>
    gainOf(e, e.amount) > 0
      ? `<span class="hit">+${gainOf(e, e.amount)} hp</span> knits itself shut${cappedNote(gainOf(e, e.amount), e.amount)}.`
      : `<span class="miss">Regeneration finds nothing to knit.</span> You were already at full hp.`,
  acidTick: (e) => `Acid eats at ${e.target ?? "it"}: <span class="roll">${e.dmg ?? 0}</span> hp.`,
  foeSlept: (e) => `${e.name ?? "It"} sleeps through it.`,
  foeMissed: (e) =>
    `${e.name ?? "It"} swings${e.member ? ` at ${e.member}` : ""}, <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.foe)}, and misses.`,
  // RULES-14 (Phase 75): a mirror's reflect reads its own line (the bubble
  // "pops" — a one-shot mirror, not a repeating soak pool) and names the
  // pool it leaves behind; a plain ward reflect (pre-Phase-75 save, or any
  // future non-mirror reflect) keeps today's text.
  wardReflected: (e) =>
    e.mirror
      ? `<span class="hit">The bubble catches it and sends it back — ${e.amount ?? 0} to ${e.target ?? "it"}. Pop.</span> A thin film holds for the rest of the round.`
      : `<span class="hit">The ward throws ${e.amount ?? 0} back at ${e.target ?? "it"}.</span>`,
  wardAbsorbed: (e) => `The ward eats <span class="roll">${e.amount ?? 0}</span> (${e.remaining ?? 0} left).`,
  wardShattered: () => `<span class="hurt">The ward shatters.</span>`,
  // RULES-10 (Phase 75.1) — the foe-side mirror of the hero's own ward: a
  // fumbled Shield or a popped fumbled Bubble sitting on the FOE eats the
  // hero's own blow instead. `name` is the foe; the pool drains the same
  // way the hero's own does (wardAbsorbed's own phrasing, mirrored).
  // VOX-05 (Phase 79, plan 79-08): the named-or-bare possessive (a bare event
  // read "It's ward"), and the numbers say what they count.
  foeWardSoaked: (e) =>
    `<span class="miss">${possessive(e.name, "Its")} ward drinks <span class="roll">${e.amount ?? 0}</span> of your blow — ${e.left ?? 0} left in it.</span>`,
  foeWardBroken: (e) => `<span class="hit">${possessive(e.name, "Its")} ward gives out.</span>`,
  foeWardFaded: (e) => `<span class="beat">${possessive(e.name, "Its")} ward fades.</span>`,
  // RULES-10 (Phase 75.1) — a fumbled Bubble sitting on the FOE: the first
  // blow it catches never touches its hp at all (your effort, wasted), then
  // it pops into a small pool for the rest of that round (foeWardSoaked
  // above narrates the pop pool's own absorbs the same way Shield's does).
  // VOX-05 (Phase 79, plan 79-08): possessive as above; the wasted number is damage.
  foeBubbleCaught: (e) =>
    `<span class="miss">${possessive(e.name, "Its")} bubble swallows your blow whole — <span class="roll">${e.amount ?? 0}</span> damage wasted.</span>`,
  // RULES-10 (Phase 75.1) — the caught blow is thrown back at the TOP of the
  // foe's next turn; this line is the telegraph, and the existing foeBolted
  // builder (pushed right after it, same action) states the hp actually lost.
  foeBubbleRebound: (e) => `<span class="hurt">${possessive(e.name, "Its")} bubble throws it back at you.</span>`,
  armorDestroyed: () => `<span class="hurt">Your armour gives out.</span>`,
  // Phase 28 (ARMOR-05): the same underMin/magic outcome flags narrationLines.js
  // reads, so the narration line and the Oracle can never disagree about which of
  // the four armorSoaked outcomes just happened.
  armorSoaked: (e) =>
    e.magic
      ? `The cloak's plate takes ${e.amount ?? 0} from ${e.name ?? "it"}. Magic plate, light as a rumour, never wears — the maze's one honest bargain.`
      : e.underMin
        ? `Your armour takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to. Under its min — not even a scratch. No wear.`
        : `Your armour takes ${e.amount ?? 0} from ${e.name ?? "it"} so you do not have to.${e.wear ? ` It costs the armour ${e.wear}.` : ""}${e.halved ? " Dwarven steel takes the hit — half the wear." : ""}`,
  // Phase 18 (CANON-01, D-08) — the FOE's natural armor ate the hero's/
  // ally's blow. `name` is the foe; `amount` is what it shrugged off (kept
  // short for the line).
  foeArmorSoaked: (e) => `<span class="miss">Your blow rings off ${e.name ?? "the thing"}'s armour. It looks bored.</span>`,
  // Phase 15 item-wiring (ECON-08): the Pendant of Fortitude eats half of one
  // incoming blow, then spends itself. `name` is the foe whose hit was blunted.
  damageHalved: (e) => `<span class="hit">The pendant drinks half of ${possessive(e.name, "the")} blow before it reaches you.</span>`,
  // Quick 260928-cos (user-approved fix 2026-09-28): a live Cloak of
  // Strength turned a foe's critical into an ordinary hit. Fact first (whose
  // cloak, whose critical, the roll), then the joke. `member` names a Joiner
  // wearing it; the struck/soaked line that follows says what the ordinary
  // hit did.
  critWarded: (e) =>
    `<span class="hit">${e.member ? `${possessive(e.member, "Their")} ${wardName(e.item)}` : `Your ${wardName(e.item)}`} turns ${possessive(e.name, "the")} critical aside${Number.isFinite(e.roll) && Number.isFinite(e.dieN) ? `: <span class="roll">${e.roll}</span> on the d${e.dieN}` : ""}, an ordinary hit instead.</span> The cloak will not let anyone forget it.`,
  // Phase 25 (FEED-01, additive payload): `soldierCrit` renders exactly like
  // `critical` (a Soldier's second-highest face is a crit in every way that
  // matters to the Oracle); `mods`/`soaked` render only when present, so a
  // plain hero's line stays byte-identical to before.
  // Dice-first fight-log convention (Phase 34) — unchanged by CLAR-01: the
  // foe's name IS the cause and the fight log already folds this line.
  struckByFoe: (e) =>
    `<span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.foe)}. ${e.critical || e.soldierCrit ? '<span class="hurt">Critical!</span> ' : ""}${e.name ?? "It"} hits you for <span class="hurt">${e.dmg ?? 0} hp</span>${soakedText(e.soaked)}.`,
  wardFaded: () => `<span class="beat">The ward fades.</span>`,
  mirrorFaded: () => `<span class="beat">The mirror fades.</span>`,
  // RULES-10 (Phase 75.1) — a foe's own fumbled Mirror Self, ticking down in
  // foeTurn's tail exactly like the hero's c.mirror does above.
  foeMirrorFaded: (e) => `<span class="beat">${possessive(e.name, "Its")} mirror fades.</span>`,
  // Phase 40 (SPELL-02): endCombat's own expiry narration for a
  // still-running Regeneration/Sense Presence when the fight ends.
  sensesFaded: () => `<span class="beat">Your senses dull back to normal.</span>`,
  regenFaded: () => `<span class="beat">The wounds stop closing on their own.</span>`,

  // RULES-10 (Phase 75.1) — the reader's own burn: a fumbled Acid or Ice
  // eating YOUR hp instead of a foe's, once per foeTurn. `spell` names what
  // did it; `amount` the hp lost this tick; `left` the rounds still to run.
  selfDotTick: (e) =>
    `<span class="hurt">${e.spell ?? "The scroll"} is still burning you: <span class="roll">−${e.amount ?? 0} hp</span>.</span> ${e.left ?? 0} round${e.left === 1 ? "" : "s"} of it left.`,
  // RULES-10 (Phase 75.1) — the ONE replacement for every instant-kill
  // fumble: whatever the spell tried to do lands as a heavy, honest blow
  // instead, plus Afraid. `how` names the flavor (frozen, stoned, …).
  // VOX-05 (Phase 79, plan 79-04): the fact first — the fumble lands as a
  // heavy blow and the hp it cost. `how` (frozen/stone/death/vapor) is the
  // fumble table's flavor key, and "Instead: death" read as the opposite of
  // what happened, so the line no longer prints it.
  fumbleHeavyBlow: (e) =>
    `<span class="hurt">${e.spell ?? "The scroll"} backfires as a heavy blow: <span class="roll">−${e.amount ?? 0} hp</span>.</span> It meant to be the end of you; you are merely shaken.`,
  // RULES-10 (Phase 75.1) — the hero-cannot-act state: the round goes on
  // without you, and it will keep going until `left` reaches 0.
  heroLostTurn: (e) =>
    `<span class="hurt">You cannot act (${e.kind ?? "out"}). The round goes on without you.</span> ${e.left ?? 0} turn${e.left === 1 ? "" : "s"} of it left.`,
  heroCameTo: () => `<span class="hit">You can act again.</span>`,

  // RULES-10 (Phase 75.1, plan 05) — resolveScrollFumble's three outcome
  // events, each naming who a fumble hit: fumbleOnReader (harmful effects
  // NOT already covered by fumbleHeavyBlow's or selfDotTick's own lines —
  // damage, out, blind, shrink, weakened, vapor's sleeping face, or none),
  // fumbleOnSide (the area branch's members/ally/reader) and fumbleOnFoe
  // (the helpful branch's targeted foe). Deadpan, family-friendly — a
  // fumble is funny, never gory.
  fumbleOnReader: (e) => {
    switch (e.effect) {
      case "damage":
        return `<span class="hurt">${e.spell ?? "The scroll"} turns on you instead: <span class="roll">−${e.amount ?? 0} hp</span>.</span>`;
      case "dot":
        return `<span class="hurt">${e.spell ?? "The scroll"} leaves something burning on you, ${e.rounds ?? 0} round${e.rounds === 1 ? "" : "s"} of it.</span>`;
      case "out":
      case "vapor":
        return `<span class="hurt">${e.spell ?? "The scroll"} takes you out of the fight, ${e.kind ?? "out"} for ${e.rounds ?? 0} turn${e.rounds === 1 ? "" : "s"}.</span>`;
      case "blind":
        return `<span class="hurt">${e.spell ?? "The scroll"} blinds you for the rest of the fight.</span>`;
      case "shrink":
        return `<span class="hurt">${e.spell ?? "The scroll"} shrinks you, <span class="roll">−${e.loss ?? 0} hp</span>, for the rest of the fight.</span>`;
      case "weakened":
        // CMBUI-13 (Phase 77, plan 77-07): the reader's own weakening (76-06)
        // names what it does, like a foe's Weaken onset line.
        return `<span class="hurt">${e.spell ?? "The scroll"} weakens you: your blows do half damage, ${e.rounds ?? 0} round${e.rounds === 1 ? "" : "s"} of it.</span>`;
      default:
        return `<span class="beat">${e.spell ?? "The scroll"} fumbles and does nothing to you. Small mercies.</span>`;
    }
  },
  fumbleOnSide: (e) => {
    if (e.who === "reader") {
      return `<span class="hurt">${e.spell ?? "The scroll"} catches you too: <span class="roll">−${e.amount ?? 0} hp</span>.</span>`;
    }
    if (e.unmade) {
      return `<span class="hurt">${e.spell ?? "The scroll"} unmakes ${e.name ?? "your summoned ally"}.</span>`;
    }
    return `<span class="hurt">${e.spell ?? "The scroll"} catches ${e.name ?? "your companion"} too: <span class="roll">−${e.amount ?? 0} hp</span>.</span>`;
  },
  // VOX-05 (Phase 79, plan 79-08): a helpful fumble says what it did for the
  // foe (engine/scrollFumble.js#resolveHelpful's own effect and numbers), not
  // just that it "helps"; a wasted fumble with no foe left says so.
  fumbleOnFoe: (e) => {
    const sp = e.spell ?? "The scroll";
    const t = e.target ?? "it";
    if (e.effect === "wasted") {
      return e.target
        ? `<span class="beat">${sp} is wasted on ${e.target}.</span>`
        : `<span class="beat">${sp} is wasted: there is no foe left for it to help.</span>`;
    }
    if (e.effect === "summon") {
      return e.joined
        ? `<span class="miss">${sp} calls up ${e.reinforcement ?? "something"} to fight beside ${t}.</span>`
        : `<span class="beat">${sp} tries to call for help for ${t}, but nothing answers.</span>`;
    }
    const helped = {
      heal: `heals ${t} instead: <span class="roll">+${e.amount ?? 0} hp</span>`,
      regen: `lands on ${t} instead: its wounds start closing on their own`,
      ward: e.mirror
        ? `wraps ${t} in a bubble instead: your next blow on it is swallowed and thrown back at you`
        : `wards ${t} instead: it soaks your next ${e.pool ?? 0} hp of damage`,
      might: `strengthens ${t} instead: <span class="roll">+${e.might ?? 0}</span> damage on its blows${(e.gained ?? 0) > 0 ? `, and <span class="roll">+${e.gained} hp</span>` : ""}`,
      mirror: `gives ${t} a mirror image instead: for ${plural(e.rounds ?? 0, "round")} you hit it only on your die's top face`,
      senses: `sharpens ${possessive(e.target, "its")} senses instead, to no effect you can see`,
    }[e.effect];
    return helped ? `<span class="miss">${sp} ${helped}.</span>` : `<span class="miss">${sp} helps ${t} instead.</span>`;
  },

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
      : `<span class="hurt">${e.name ?? "It"}: it lands.</span> −${e.dmg ?? 0} hp${soakedText(e.soaked)}${e.ignoresArmor ? ", and your armour was not consulted" : ""}.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-08): `stolen` is what the FOE healed (after its
  // own cap), not the hp you lost (foeBolted, pushed just before, states
  // that), and a drain on a Joiner is not "yours".
  foeDrained: (e) => `<span class="hurt">${e.name ?? "It"} drinks it in: <span class="miss">+${e.stolen ?? 0} hp</span> for itself.</span> It looks better for it.`,
  // CMBUI-13 (Phase 77, plan 77-07, "the onset line names the effect"): a
  // daze states its to-hit delta from the payload (toHitText, U+2212); a
  // weakening states half damage in words. A missing field drops its clause.
  // VOX-05 (Phase 79, plan 79-08): who did it and what it does come first;
  // the joke closes the line.
  foeDebuffed: (e) => {
    const lasts = Number.isFinite(e.rounds) ? ` for ${plural(e.rounds, "round")}` : "";
    return e.kind === "dazed"
      ? `<span class="hurt">${e.name ? `${e.name} dazes you` : "You are dazed"}: ${Number.isFinite(e.toHit) ? toHitText(e.toHit) : "your aim wanders"}${lasts}.</span> The room keeps moving after you stop.`
      : `<span class="hurt">${e.name ? `${e.name} weakens you` : "You are weakened"}: your blows do half damage${lasts}.</span> Your arms feel like someone else's.`;
  },
  foeHealed: (e) => `${e.name ?? "It"} knits itself back together. <span class="miss">+${e.amount ?? 0} hp.</span> Rude.`,
  // RULES-10 (Phase 75.1) — a fumbled Regeneration on a foe: a d8 a turn,
  // capped at its own maxWP, same snarky "good news for it" framing as
  // foeHealed immediately above.
  foeRegenerated: (e) => `${e.name ?? "It"} stitches itself up. <span class="miss">+${e.amount ?? 0} hp.</span> Inconsiderate.`,
  foeSummoned: (e) =>
    e.pending
      ? `<span class="miss">${e.by ?? "It"} calls, and something answers from a little way off.</span>`
      : `<span class="miss">${e.name ?? "Something"} shuffles in, late and unbothered.</span>`,
  // CMBUI-13 (Phase 77, plan 77-07): the fade says the effect ended in the
  // same terms the onset used.
  foeEffectFaded: (e) =>
    e.kind === "dazed"
      ? `<span class="hit">The room settles, and so does your aim.</span> ${Number.isFinite(e.toHit) ? `No longer ${toHitText(e.toHit)}.` : "You are no longer dazed."}`
      : `<span class="hit">Your strength comes back. It was only borrowed.</span> Your blows land for full damage again.`,
  heroResisted: (e) =>
    `<span class="hit">You think very hard about not being affected, and it works.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  heroResistFailed: (e) =>
    `You try to shrug it off. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span> <span class="miss">You do not.</span>`,
  // Quick 260928-nrf (user ruling 2026-09-28, Joiners resist: "Yes, same
  // scale"): a Joiner rolls its own intel against a foe's bolt or drain, on
  // the hero's half-intel scale. The fact and the roll first, then the joke.
  memberResisted: (e) =>
    `<span class="hit">${e.member ?? "Your companion"} resists ${possessive(e.name, "its")} spell.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span> Somebody on your side was paying attention.`,
  memberResistFailed: (e) =>
    `${e.member ?? "Your companion"} fails to resist ${possessive(e.name, "its")} spell. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span> <span class="miss">Shrugging it off is harder than it looks.</span>`,
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
      // VOX-05 (Phase 79, plan 79-08): the rounds are the wait until it is
      // ready again, and Last Stand names its quarter-hp line.
      cooldown: `<span class="miss">${name}: ready again in ${e.left ?? "?"} round${e.left === 1 ? "" : "s"}. Your arm has opinions.</span>`,
      // Quick 260927-opf (user ruling 2026-09-27): a once-per-fight ability
      // that has been used is spent until this fight ends.
      spent: `<span class="miss">${name}: spent for this fight.</span> It works once, and you have had your once.`,
      notInCombat: `<span class="miss">${name}: nothing to use it on out here.</span>`,
      noTarget: `<span class="miss">${name}: nothing left standing to use it on.</span>`,
      notLowEnough: `<span class="miss">Last Stand: only at a quarter of your hp or less, and you have ${e.have ?? "?"} of ${e.max ?? "?"}.</span> You are not desperate enough yet.`,
      // Quick 260928-nrf (user ruling 2026-09-28): Sweep needs two or more
      // living foes; refused, nothing is spent.
      tooFewFoes: `<span class="miss">${name}: needs two or more foes, and ${e.have === undefined || e.have === 1 ? "there is only one" : `there are ${e.have}`}.</span> A wide arc at a single foe is a swing with extra steps.`,
    };
    return map[e.reason] ?? `<span class="miss">${name} refuses you.</span>`;
  },
  // Plan 04 (ABIL-05): the fourteen ability-activation/effect lines below
  // carry an ADDITIVE `${e.member ? \`${e.member}: \` : ""}` prefix — present
  // only when a Joiner (not the hero) is the actor, so a hero-cast use stays
  // byte-identical to Plan 03's own text.
  // VOX-05 (Phase 79, plan 79-04): the ability lines below state the effect
  // the engine applied (engine/abilities.js, engine/combat.js#
  // resolveMemberAbility) before the joke; a Joiner's own use reads "them"
  // where the hero's reads "you" (a Joiner's Sidestep, Smoke, Riposte and
  // Brace cover the Joiner's own body, not the hero's).
  pommelStruck: (e) =>
    `<span class="hit">${e.member ? `${e.member}: ` : ""}The pommel finds ${possessive(e.target, "its")} temple. ${e.target ?? "It"} loses its next turn, and will need a moment.</span>`,
  foeStunned: (e) => `${e.name ?? "It"} spends its turn remembering where it is.`,
  battleRoarRaised: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}For two rounds every foe has two fewer faces to hit anyone on your side. Loud enough.</span>`,
  sidestepped: (e) =>
    `<span class="hit">${e.member ? `${e.member}: ` : ""}For two rounds every foe has two fewer faces to hit ${e.member ? "them" : "you"}. Not where the blade is.</span>`,
  secondWindHealed: (e) =>
    gainOf(e, e.amount) > 0
      ? `<span class="hit">You remember why you came. +${gainOf(e, e.amount)} hp${cappedNote(gainOf(e, e.amount), e.rolled)}.</span>`
      : `<span class="hit">You remember why you came.</span> You were already at full hp, so it is mostly a mood.`,
  swept: (e) => `<span class="hit">One wide arc — ${e.dmg ?? 0} to everything still standing.</span>`,
  sweptFoe: (e) => `${e.target ?? "It"} takes <span class="roll">${e.dmg ?? 0}</span>.`,
  braced: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Braced. The next blow that lands on ${e.member ? "them" : "you"} does half damage.</span>`,
  // `soaked` is the hp the brace took off the blow — a saving, so it no
  // longer prints as a signed cost ("(−3)").
  braceHeld: (e) =>
    `<span class="hit">${e.member ? `${e.member}: ` : ""}Braced — ${possessive(e.name, "the")} blow lands half as hard${Number.isFinite(e.soaked) ? `, ${e.soaked} hp lighter` : ""}.</span>`,
  riposteReady: (e) =>
    `<span class="hit">${e.member ? `${e.member}: ` : ""}For one round every foe that misses ${e.member ? "them" : "you"} takes ${e.member ? "their" : "your"} weapon's damage. Every miss is an invitation.</span>`,
  riposted: (e) => `${e.target ?? "It"} misses, and pays <span class="roll">${e.dmg ?? 0}</span> for it.`,
  // A Joiner's Taunt pulls every swing onto the Joiner; the armour doubling
  // is the hero's own (engine/combat.js#applyFoeDamageToPlayer).
  taunted: (e) =>
    e.member
      ? `<span class="hit">${e.member}: Every foe swings at them this round. Good luck to them.</span>`
      : `<span class="hit">Every foe looks at you. Armour doubles. Good luck.</span>`,
  lastStandCalled: (e) => `<span class="beat">${e.member ? `${e.member}: ` : ""}Under a quarter. ${e.attacks ?? 3} attacks this round. Make them count.</span>`,
  dirtyTrickLanded: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}${e.target ?? "It"} is blinded for ${plural(e.rounds ?? 2, "round")}. Sand, thumb, elbow.</span>`,
  foeSightReturned: (e) => `${e.name ?? "It"} blinks the sand out.`,
  // ROLL-04 (79-04): a foe's strike die scales with its level (engine/
  // derived.js#foeDie), so Smoke speaks in faces, never "a natural 1". Only
  // the hero's own Smoke lets a flee just work (engine/combat.js#flee).
  smokeThrown: (e) =>
    e.member
      ? `<span class="hit">${e.member}: For two rounds a foe finds them only on its die's top face (the top two if you insulted them). Gone, as far as anyone can tell.</span>`
      : `<span class="hit">For two rounds a foe finds you only on its die's top face (the top two if you insulted them), and a run just works. Gone, as far as anyone can tell.</span>`,
  // A Joiner's cutpurse lifts the coin into the hero's purse (gainWilmst).
  cutpursed: (e) =>
    e.member
      ? `<span class="hit">${e.member} lifts ${e.amount ?? 0} wilmst off ${e.target ?? "it"} mid-fight, into your purse. It has other problems.</span>`
      : `<span class="hit">You lift ${e.amount ?? 0} wilmst off ${e.target ?? "it"} mid-fight. It has other problems.</span>`,
  poisonedEdgeApplied: (e) =>
    `<span class="hit">${e.member ? `${e.member}: ` : ""}${e.target ?? "It"} is poisoned for ${plural(e.rounds ?? 3, "round")}. The blade weeps into it.</span>`,
  // dotTick is generic on `by` — Phase 40 (SPELL-01, Ice) is the first spell
  // to share this event shape with Poisoned Edge; the line names the source.
  dotTick: (e) => `${e.target ?? "It"} takes <span class="hurt">${e.dmg ?? 0}</span> from ${e.by === "ice" ? "the ice" : "the poison"}.`,
  hamstrung: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Tendon cut. ${e.target ?? "It"} hits half as hard from here on.</span>`,
  // Mark's +2 is damage, on every blow from anyone (engine/combat.js).
  marked: (e) => `<span class="hit">${e.member ? `${e.member}: ` : ""}Studied. Every blow on ${e.target ?? "it"} does +2 damage from here on.</span>`,
  // Plan 04 (ABIL-05): a Joiner's own ability use — the four new member-only
  // events (no hero equivalent exists for these; a hero's own equivalent use
  // reads "abilityUsed"/"secondWindHealed"/"swept"/"riposted" above).
  memberAbilityUsed: (e) => `<span class="beat">${e.name ?? "Your companion"} calls ${e.ability ?? "it"}.</span>`,
  memberSecondWind: (e) =>
    gainOf(e, e.amount) > 0
      ? `<span class="hit">${e.name ?? "Your companion"} remembers why they came. +${gainOf(e, e.amount)} hp${cappedNote(gainOf(e, e.amount), e.rolled)}.</span>`
      : `<span class="hit">${e.name ?? "Your companion"} remembers why they came,</span> already at full hp.`,
  memberSwept: (e) => `<span class="hit">${e.name ?? "Your companion"} sweeps — ${e.dmg ?? 0} to everything still standing.</span>`,
  memberRiposted: (e) => `${e.target ?? "It"} misses ${e.name ?? "your companion"}, and pays <span class="roll">${e.dmg ?? 0}</span> for it.`,

  /* ---------------- magic.js ---------------- */

  noChargesLeft: () => `<span class="miss">Nothing left to cast with.</span>`,
  spellNotKnown: (e) => `<span class="miss">You do not know ${e.spell ?? "that"}.</span>`,
  spellAboveLevel: (e) => `<span class="miss">${e.spell ?? "That"} needs level ${e.need ?? "?"}; you are ${e.have ?? "?"}.</span>`,
  // VOX-05 (Phase 79, plan 79-08): the refusal says why, in the same shape
  // as spellAboveLevel: the level the school opens at, and yours.
  spellSchoolLocked: (e) =>
    Number.isFinite(e.need)
      ? `<span class="miss">${e.spell ? `${e.spell}'s school` : "That school"} opens to you at level ${e.need}; you are ${e.have ?? "?"}.</span>`
      : `<span class="miss">${e.spell ?? "That"} is not open to you yet.</span>`,
  // Phase 31 (CMB-01/CMB-02): the NEW spell-refusal circumstances — never a
  // `frozen` reason; nothing is ever refused for fear.
  castRefused: (e) => {
    const map = {
      notFought: `<span class="miss">Fight! first.</span> ${e.spell ?? "The spell"} keeps.`,
      combatOnly: `<span class="miss">${e.spell ?? "That"} wants a target.</span> Save it for a fight.`,
      // VOX-05 (Phase 79, plan 79-08): the reason, then the joke.
      exploreOnly: `<span class="miss">${e.spell ?? "That"} only works out of a fight.</span> It needs quieter surroundings.`,
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
      // RULES-10 (Phase 75.1): loseTurn with no C.heroOut to spend.
      notOut: `<span class="miss">There is no turn to lose.</span>`,
    };
    return map[e.reason] ?? `<span class="miss">Not now.</span>`;
  },
  spellBackfired: (e) => `<span class="hurt">${e.spell ?? "The spell"} goes wrong.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  backfireSelfDamage: (e) =>
    `<span class="hurt">Backfire: ${e.spell ?? "The spell"} went wrong in your hands — the ${e.sub ?? "Apprentice"} tax, one time in eight.</span> −${e.amount ?? 0} hp.`,
  // Quick 260927-rsx (user ruling 2026-09-27): every spell cast on a foe
  // rolls the foe's resist (half its intel in faces on a d20), and every
  // roll, either way, gets its Oracle line with the roll. `by` names a
  // Joiner caster; the hero's own cast reads "your".
  // User ruling 2026-09-28: a Freeze rolls its resist after the damage
  // lands (`freeze: true`), and a resist stops only the ice.
  spellResisted: (e) =>
    e.freeze
      ? `<span class="miss">${e.target ?? "It"} resists the freeze: the damage lands, the ice doesn't.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`
      : `<span class="miss">${e.target ?? "It"} resists ${e.by && e.by !== "you" ? `${e.by}'s` : "your"} ${e.spell ?? "spell"}: no effect.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  resistFailed: (e) =>
    `${e.target ?? "It"} fails to resist ${e.by && e.by !== "you" ? `${e.by}'s` : "your"} ${e.spell ?? "spell"}. <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
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
  // VOX-05 (Phase 79, plan 79-08): who (foes, not a bare count) and what (asleep,
  // a d4 each: engine/magic.js's stun branch); "1 freeze" no longer reads.
  stunned: (e) =>
    (e.count ?? 0) > 0
      ? `<span class="hit">${e.count === 1 ? "1 foe drops" : `${e.count} foes drop`} asleep for d4 rounds${e.count === 1 ? "" : " each"}.</span>`
      : `<span class="miss">The stun puts nobody to sleep.</span>`,
  // Phase 40 (SPELL-01, Weaken): names the duration when the payload carries
  // one (a member's own weakened line predates the timer and may not).
  // VOX-05 (Phase 79, plan 79-08): who and what, in the grimoire's own
  // roll-high terms (C.foeToHitPenalty caps a foe at its die's top three
  // faces; C.weakened halves its damage), and "1 round", never "1 rounds".
  // Quick 260927-rsx: `spared` counts the foes that resisted the cast; the
  // line names them instead of claiming every foe.
  weakened: (e) =>
    `<span class="hit">${e.spared ? `Every foe but the ${e.spared === 1 ? "one" : e.spared} that resisted is weakened` : "Every foe is weakened"}${e.rounds ? ` for ${plural(e.rounds, "round")}` : ""}: no more than its die's top three faces hit, and it does half damage.</span> They hit softer now.`,
  // Phase 40 (SPELL-01) — combat.js#foeTurn's tail narrates this on the
  // `spell:weaken` timer's own effect->null transition.
  weakenFaded: () => `<span class="hit">Their arms remember how to swing.</span>`,
  // VOX-05 (Phase 79, plan 79-08): the fight-long effect is stated (past the
  // knee the spell holds instead, and controlHeld narrates that).
  stupefied: (e) => `<span class="hit">${e.target ?? "It"} forgets what it is doing, for the rest of the fight.</span>`,
  // Phase 40 (SPELL-01, Stupidity) — combat.js#foeTurn's own per-round skip
  // (the cast-time `stupefied` line above narrates the moment it lands; this
  // one narrates every subsequent turn it does nothing).
  foeStupefied: (e) => `${e.name ?? "It"} stands there, thinking about nothing.`,
  // RULES-18 (Phase 75.3): past the knee the Blind spell is timed — `rounds`
  // rides on the event and the line says so; without it, blind for the fight.
  // VOX-05 (Phase 79, plan 79-08): what blindness does to a foe's swing
  // (engine/derived.js#foeSwingChain: its die's top face only), and the
  // duration, "1 round" or the fight.
  blinded: (e) =>
    `<span class="hit">${e.target ?? "It"} cannot see a thing ${e.rounds ? `for ${plural(e.rounds, "round")}` : "for the rest of the fight"}: it hits only on its die's top face.</span>`,
  // VOX-05 (Phase 79, plan 79-08): who and what: half hp, half damage.
  shrunk: (e) =>
    (e.count ?? 0) > 0
      ? `<span class="hit">${e.count === 1 ? "1 foe shrinks" : `${e.count} foes shrink`} to half size: half ${e.count === 1 ? "its" : "their"} hp and half ${e.count === 1 ? "its" : "their"} damage, for the fight.</span>`
      : `<span class="miss">Nobody shrinks.</span>`,
  // VOX-05 (Phase 79, plan 79-08): "1 round", never "1 rounds".
  acidApplied: (e) => `${e.target ?? "It"} starts to dissolve. <span class="roll">${e.rounds ?? 0}</span> round${e.rounds === 1 ? "" : "s"} of it.`,
  // Phase 40 (SPELL-01, Ice) — the cast-time line; combat.js#foeTurn's
  // existing dotTick handles every round after (see dotTick's own `by`
  // branch above), and frozenSolid (below) narrates the payoff.
  // VOX-05 (Phase 79, plan 79-08): "1 round", never "1 rounds".
  // Quick 260928-sq2: the first tick adds the caster's level² (`levelSq`).
  iceApplied: (e) => `<span class="hit">Ice climbs ${e.target ?? "it"}: d6 a round for ${plural(e.rounds ?? 0, "round")}${(e.levelSq ?? 0) > 1 ? ` (the first +${e.levelSq}, for your level)` : ""}, then it stops moving.</span>`,
  // VOX-05 (Phase 79, plan 79-08): the number is damage, and it lands on
  // every foe (the caster's own half is earthquakeSelfDamage's line).
  earthquake: (e) => `<span class="banner">The floor heaves.</span> <span class="roll">${e.amount ?? 0}</span> damage to every foe in the room.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  earthquakeSelfDamage: (e) => `<span class="hurt">Earthquake: the floor does not take sides.</span> −${e.amount ?? 0} hp.`,
  // VOX-05 (Phase 79, plan 79-08): the face means something; say what
  // (engine/magic.js's vapor branch: a 4 drops every foe unless its own d10
  // shows a 1; any other face, or that 1, puts it to sleep for d6+2 rounds).
  // Each death and each resist has its own line after this one.
  vaporRolled: (e) =>
    e.roll === 4
      ? `Noxious vapor: <span class="roll">4</span>, the bad one. Every foe that breathes it drops, unless its own d10 shows a 1; then it only sleeps.`
      : Number.isFinite(e.roll)
        ? `Noxious vapor: <span class="roll">${e.roll}</span>. Every foe falls asleep for d6+2 rounds.`
        : `Noxious vapor: <span class="roll">?</span>.`,
  volley: (e) => `<span class="roll">${e.rolls ?? 0}</span> shots, <span class="roll">${e.totalDamage ?? 0}</span> total damage.`,
  petrified: (e) => `<span class="hit">${e.target ?? "It"} turns to stone.</span>`,
  walkingDeadTurned: (e) => `<span class="hit">${e.count ?? 0} of the dead turn and flee.</span>`,
  nothingToTurn: () => `<span class="miss">Nothing here to turn.</span>`,
  // VOX-05 (Phase 79, plan 79-08): who (foes), and "1 is", never "1 are".
  planeGated: (e) => `<span class="hit">${e.count === 1 ? "1 foe is" : `${e.count ?? 0} foes are`} gated straight back out to the Planes.</span>`,
  gateRefused: () => `<span class="miss">There is no plane here worth opening.</span>`,
  // VOX-05 (Phase 79, plan 79-08): what the sharpening does (engine/
  // combat.js reads c.senses: you act first, and the dark costs nothing),
  // until endCombat's sensesFaded.
  sensesGained: () => `<span class="hit">Your senses sharpen: nothing gets the jump on you, and the dark costs you nothing, until your next fight ends.</span>`,
  // Phase 40 (SPELL-05, Plan 04): Map the Floor is now a time-boxed,
  // re-fogging reveal — the old permanent whole-floor reveal event is
  // retired outright; floorMapped/revealFaded replace it. Plan 76-06 (user
  // ruling 2026-09-26): the map lasts only until you move, so floorMapped
  // prints no squares count and revealFaded is the hero losing focus.
  floorMapped: () => `<span class="hit">The floor lays itself out in your head — every corridor on this level, for exactly as long as you hold still.</span>`,
  revealFaded: () => `<span class="beat">You glance down to check your footing, and your focus breaks. The whole floor slips out of your head.</span>`,
  senseDanger: (e) => `<span class="beat">You get a bad feeling about the next ${e.nextEncounter ?? "encounter"}.</span>`,
  // VOX-05 (Phase 79, plan 79-08): what the image does, in the grimoire's
  // roll-high terms, and "1 round", never "1 rounds".
  mirrorSelf: (e) =>
    `<span class="hit">A mirror image holds for ${plural(e.rounds ?? 0, "round")}: foes hit you only on their die's top face (the top two if you insulted them).</span>`,
  // RULES-14 (Phase 75): a mirror spell (Bubble) reads its own line —
  // nothing to soak yet, just a promise to bounce the next blow — while
  // every other ward (Shield) keeps its plain "N points" text (no more
  // ", reflecting" suffix — that promise is now the whole point of the
  // mirror line, never a footnote on Shield's).
  wardRaised: (e) =>
    e.mirror
      ? `<span class="hit">A bubble shimmers around you. The next blow goes back where it came from.</span>`
      : `<span class="hit">${e.spell ?? "A spell"} raises a ward: it soaks the next ${e.pool ?? 0} hp of damage.</span>`,
  // VOX-05 (Phase 79, plan 79-08): the +N is damage on every blow, and the
  // HP the cast added (engine/magic.js's `gained`: the doubling happens once
  // a day, so a recast adds none) is stated, never silent.
  strengthCast: (e) =>
    `<span class="hit">Might surges: +${e.might ?? 0} damage on every blow until you make camp${
      (e.gained ?? 0) > 0 ? `, and +${e.gained} hp${Number.isFinite(e.maxWP) ? ` (max ${e.maxWP})` : ""}` : ""
    }.</span>${Number.isFinite(e.gained) && e.gained <= 0 ? " Your hp was already doubled for the day." : ""}`,
  regenerationCast: () => `<span class="hit">Wounds start closing on their own.</span>`,
  // VOX-05 (Phase 79, plan 79-08): "turn insane at" did not read naturally.
  insaneNoTarget: () => `<span class="miss">There is no one here to drive insane.</span>`,
  // VOX-05 (Phase 79, plan 79-08): the d6 face means something; say what
  // (engine/magic.js's insane branch). A 3 or 6 flees and a 2 strikes a
  // neighbour: their own lines follow, so only the other faces add a clause.
  insaneRolled: (e) => `Insanity takes ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span>${INSANE_FACE[e.roll] ?? ""}.`,
  insaneStruckAlly: (e) => `The maddened thing turns on ${e.target ?? "an ally"} for <span class="roll">${e.dmg ?? 0}</span> hp.`,
  insaneFled: (e) => `<span class="beat">${e.target ?? "It"} bolts, mad with fear.</span>`,
  // VOX-05 (Phase 79, plan 79-02, todo 2026-09-25): the HP gained leads; a
  // capped heal names its roll and says full; a heal at full says so.
  healed: (e) =>
    gainOf(e, e.amount) > 0
      ? `<span class="hit">+${gainOf(e, e.amount)} hp</span>${e.spell ? ` from ${e.spell}` : ""}${cappedNote(gainOf(e, e.amount), e.amount)}.`
      : `<span class="miss">${e.spell ?? "Healing"}: nothing to restore.</span> You were already at full hp.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-08): the rule refuses at fee + 1 hp or less
  // (engine/magic.js), so the line states the hp it needs.
  deathSpellTooWeak: (e) => `<span class="miss">Death: the fee is ${e?.fee ?? 25} hp, and you need at least ${(e?.fee ?? 25) + 2} to pay it.</span> The spell refuses to be what kills you.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  deathCast: (e) => `<span class="hurt">Death: the spell takes its fee first.</span> −${e?.cost ?? 25} hp.`,
  // VOX-05 (Phase 79, plan 79-08): "1 round", never "1 rounds".
  dozed: (e) => `${e.target ?? "It"} dozes off for ${plural(e.rounds ?? 0, "round")}.`,
  nothingToThrowAt: () => `<span class="miss">Nothing here to throw it at.</span>`,
  spellThrown: (e) =>
    `${e.spell ?? "It"} at ${e.target ?? "it"}: <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}${modsClause(e.mods, ROLLERS.you)}.`,
  // VOX-05 (Phase 79, plan 79-08): names who took it, like the strike line.
  // Quick 260928-sq2 (user ruling 2026-09-28): the damage is the roll + the
  // caster's level² (the event's `levelSq`), already inside the number; the
  // clause names it from level 2 up (a level-1 caster's +1 goes unsaid).
  spellHit: (e) =>
    `<span class="hit">Hit.</span> ${e.target ?? "It"} takes <span class="roll">${e.dmg ?? 0}</span> hp${(e.levelSq ?? 0) > 1 ? ` (the roll +${e.levelSq}, for your level)` : ""}.${e.afraid ? ` <span class="miss">Fear pulls the spell.</span>` : ""}`,
  frozenSolid: (e) => `<span class="hit">${e.target ?? "It"} freezes solid.</span>`,
  // RULES-18 (Phase 75.3, Plan 04): past floor 12, a control (Freeze, Ice's
  // last tick, a Joiner's Doze/Stun/Weaken, a Bard song) increasingly gets
  // shrugged off outright — this is that resist, always its own Oracle line
  // and roll so a resisted control never passes silently. The roll prints
  // through rollRange.js's ONE range formatter.
  controlResisted: (e) =>
    `<span class="miss">${e.target ?? "It"} shrugs off ${CONTROL_EFFECT_WORD[e.effect] ?? "the effect"}${e.source ? ` from ${e.source}` : ""}.</span> <span class="roll">${e.roll ?? "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}.`,
  // The other half: an "indefinite" control (would have lasted the fight, or
  // ended the foe outright) holds for a few rounds instead, past the knee.
  // VOX-05 (Phase 79, plan 79-04): "1 round", never "1 rounds".
  // User rulings 2026-09-28: a Freeze (`freeze: true`) holds for a rolled
  // d4 at every depth, so its line is the plain count, never "not forever".
  controlHeld: (e) =>
    e.freeze
      ? `<span class="hit">${e.target ?? "It"} is frozen for ${Number.isFinite(e.rounds) ? plural(e.rounds, "round") : "? rounds"}.</span> Ice now, grudge later.${e.source ? ` (${e.source})` : ""}`
      : `<span class="hit">${e.target ?? "It"} is ${CONTROL_HOLD_WORD[e.kind] ?? "held fast"} — ${Number.isFinite(e.rounds) ? plural(e.rounds, "round") : "? rounds"}, not forever.</span>${e.source ? ` (${e.source})` : ""}`,
  foeStillHeld: (e) => `${e.name ?? "It"} is still ${CONTROL_HOLD_WORD[e.kind] ?? "held"}. <span class="roll">${e.left ?? "?"}</span> to go.`,
  foeHoldBroken: (e) => `<span class="beat">${e.name ?? "It"} shakes free and stands.</span>`,
  spellMissed: (e) => `<span class="miss">Missed ${e.target ?? "it"}.</span>`,
  potionDrunk: (e) => {
    const g = gainOf(e, e.amount);
    const left = `${plural(e.remaining ?? 0, "potion")} left`;
    const doubled = e.doubled ? ` (${e.doubled}: twice the dose, as promised.)` : "";
    if (g <= 0) return `<span class="miss">The potion finds nothing to fix.</span> You were already at full hp (${left}).${doubled}`;
    const capped = Number.isFinite(e.amount) && g < e.amount ? `${e.amount} rolled, back to full; ` : "";
    return `<span class="hit">+${g} hp</span> (${capped}${left}).${doubled}`;
  },
  scrollRead: (e) => `You unroll a scroll: ${e.spell ?? "something unreadable"}.`,
  // Phase 25 (FEED-02): a scroll refuses to be read out loud, with a reason —
  // never a silent no-op. RULES-10 (Phase 75.1): "pilfer"/"noRunes" are
  // retired — canRead is gone, and a Pilfer/no-Runes reader now READS
  // (rolling intelligence: scrollDeciphered/scrollGarbled/scrollFumbled
  // below), never refuses. `reason` is "noScrolls" | "notFought"; any other/
  // absent value falls to the generic "stays rolled" line.
  scrollRefused: (e) =>
    e.reason === "noScrolls"
      ? `<span class="miss">You have no scroll to read.</span>`
      : e.reason === "notFought"
        ? `<span class="miss">Fight! first.</span> The scroll will keep.`
        : `<span class="miss">It stays rolled.</span>`,
  scrollCopiedToGrimoire: (e) => `<span class="hit">${e.spell ?? "It"} copied into your grimoire.</span>`,
  // Phase 40 (SPELL-07): the scroll's spell is not yet scribable (level or
  // school gate not met) and falls through to the free cast. CMBUI-11
  // (Phase 77): the cast succeeded, so this is never worded as a refusal.
  // Stamped `castFollows` by stampScrollCopyNotes (its scrollCast comes
  // right after), it prints nothing: the cast's own line carries the note,
  // AFTER the cast. Standalone, it is the plain copy note.
  scrollTooAdvanced: (e) => (e.castFollows ? "" : `<span class="beat">${e.spell ?? "It"}: too advanced to copy into your book.</span>`),
  // CMBUI-11: a cast stamped `tooAdvanced` (by stampScrollCopyNotes) reads
  // the cast first, then the copy note.
  scrollCast: (e) =>
    `The scroll casts itself: ${e.spell ?? "something"}.${
      e.tooAdvanced ? ` <span class="beat">Too advanced to copy into your book. The scroll crumbles, having made its point.</span>` : ""
    }`,
  // RULES-10 (Phase 75.1) — an "intel" reader's own d20, on its own derived
  // stream. scrollDeciphered names the reading range (like heroResisted);
  // scrollGarbled is a plain failure — never the spell's name, never worded
  // as a refusal, just an honest "I couldn't make it out"; scrollFumbled
  // names the spell and the fumble band (via bottomRangeText), and, outside
  // combat, that it fizzled and the scroll is dust.
  scrollDeciphered: (e) =>
    `<span class="hit">You puzzle the runes out.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  scrollGarbled: (e) =>
    `<span class="miss">You squint at runes you can't make out. The scroll crumbles.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)} (intel ${e.intel ?? "?"}).</span>`,
  scrollFumbled: (e) =>
    `<span class="hurt">You read ${e.spell ?? "the spell"} wrong.</span> <span class="roll">${e.roll ?? "?"} vs ${rangeText(e.atLeast, e.dieN)}, fumble ${bottomRangeText(e.fumbleAtLeast)} (intel ${e.intel ?? "?"}).</span>${
      e.fizzled ? ` Out here there is nothing for it to land on. It fizzles — the scroll is dust.` : ""
    }`,

  /* ---------------- economy.js ---------------- */

  // VOX-05 (Phase 79, plan 79-11): the discount says how much (engine/
  // economy.js#priceFor: half), and a Pickpocket's markup and markdown
  // (priceFor ×1.25, sellPriceFor ×0.75) are stated here too, as the rail twin
  // already did.
  storeOpened: (e) =>
    `<span class="banner">The shop is open.</span>${e.troll ? " (Trolls pay triple.)" : e.elfOrDwarf ? " (Half price, as always.)" : ""}${
      e.pickpocket ? " The shopkeeper knows a Pickpocket's face: you pay ×1.25 to buy, and get ×0.75 when you sell." : ""
    }`,
  buyFailed: (e) => `<span class="miss">You are short ${e.short ?? 0} wilmst.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-02): a store meal adds the HP it really restored.
  bought: (e) => {
    const base = `<span class="hit">Bought: ${e.item ?? "something"}.</span> −${e.cost ?? 0} wilmst.`;
    if (!Number.isFinite(e.gained)) return base;
    if (e.gained <= 0) return `${base} You were already at full hp; you eat it anyway.`;
    return `${base} <span class="hit">+${e.gained} hp</span>${cappedNote(e.gained, e.meal, "worth")}.`;
  },
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
  // STORE-04 (Phase 87): a store stocks a d10 of rations, sold one per buy.
  // The last one off the shelf, and a pack already at its ration cap (the
  // refusal lands BEFORE any wilmst moves). Minor events, never a card.
  rationsSoldOut: () => `<span class="beat">Last ration off the shelf.</span> The shopkeeper eyes you the way a pantry eyes a Troll.`,
  rationsFull: (e) =>
    `<span class="miss">Your pack already holds ${e.have ?? 0} of ${e.cap ?? 0} rations.</span> The shopkeeper will not sell you a sandwich you would have to carry in your teeth.`,
  // ECON-06 (Phase 14): the store buys your gear back at a discount. Deadpan,
  // dark-but-family-friendly (a VOX-02 safety scan checks this line) — the
  // shopkeeper is doing you no favours, and knows it.
  itemSold: (e) =>
    `<span class="hit">Sold:</span> ${e.item?.n ?? "something"} for ${e.price ?? 0} wilmst. The shopkeeper's smile suggests you got the worse end of it.`,
  storeLeft: () => `<span class="beat">You leave the shop.</span>`,
  // SAV-07 (Phase 76): a relaunch reopened the store exactly as it was left
  // (engine/saveState.js#resumeEventsFor) — same stock, same prices.
  storeResumed: () => `<span class="beat">The shopkeeper has not moved. Neither have the prices.</span>`,
  // SAV-06 (Phase 76): a relaunch put the hero straight back into the fight
  // (engine/saveState.js#resumeEventsFor). A fight not yet joined (`pending`)
  // reads as the monsters waiting; one under way names the round.
  fightResumed: (e) =>
    e?.pending
      ? `<span class="beat">They waited. Monsters can be very patient.</span>`
      : `<span class="beat">Still here. Still fighting.${Number.isInteger(e?.round) ? ` Round ${e.round}, where you left it.` : ""}</span>`,

  /* ---------------- encounters.js ---------------- */

  // Phase 73 (ROLL-05): the roll-high triple, via rollVsText.
  trapAvoided: (e) => `<span class="hit">You clock it a half-step early.</span> <span class="roll">${rollVsText(e.roll, e.atLeast, e.dieN)}.</span>`,
  // VOX-05 (Phase 79, plan 79-11): the fact first (disarmed; twice as hard),
  // the joke after it.
  trapDisarmed: () => `<span class="hit">Pilfer: trap disarmed.</span> Your hands already knew where not to put themselves.`,
  trapDoubled: () => `<span class="hurt">Cat Burglar: the trap hits twice as hard.</span> The luck holds — for the trap.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  trapSprung: (e) => `<span class="hurt">Trap: ${e.name ?? "A trap"} finds you first.</span> −${e.dmg ?? 0} hp.`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  // VOX-05 (Phase 79, plan 79-11): the line never said "poisoned".
  trapPoisoned: () => `<span class="hurt">Trap: poisoned.</span> It leaves something behind that outlasts the bruise.`,
  chestOpened: () => `<span class="hit">The box gives up its secrets.</span>`,
  // Phase 73 (ROLL-05): only the drawn face is styled; the range reads plain.
  chestLockRolled: (e) => `Lock: <span class="roll">${Number.isFinite(e.roll) ? e.roll : "?"}</span> vs ${rangeText(e.atLeast, e.dieN)}.`,
  // VOX-05 (Phase 79, plan 79-11): a failed lock roll is the chest's only
  // try (engine/movement.js#resolveFeature clears the tile first), so "this
  // round" promised a retry that never comes.
  chestLocked: () => `<span class="miss">The lock holds, and the box stays shut for good.</span> Not today, and not any other day.`,
  scrollFound: () => `<span class="hit">A scroll, tucked in with the loot.</span>`,
  // VOX-05 (Phase 79, plan 79-02, todo 2026-09-26): a Table 4 row reads as
  // its effect ("a toll"), never as its canon cell ("-15 HP").
  encounterRolled: (e) =>
    `<span class="roll">Table ${e.table ?? "?"}, roll ${e.roll ?? "?"}:</span> The dice decide — ${TABLE_FOUR_EFFECT[e.result] ?? e.result ?? "something"}.`,
  // VOX-05 (Phase 79, plan 79-02, todo 2026-09-26): the engine's prose, then
  // the signed amount the row actually made (rollRange.js#signedText, U+2212).
  tableFour: (e) => `<span class="beat">${e.result ?? "Something happens."}</span>${tableFourTail(e)}`,
  tableFourNoop: (e) => `<span class="beat">${e.result ?? "Nothing much happens."}</span>`,
  foodFound: (e) =>
    gainOf(e, e.wp) > 0
      ? `<span class="hit">${e.name ?? "Food"}</span> (+${gainOf(e, e.wp)} hp${Number.isFinite(e.wp) && gainOf(e, e.wp) < e.wp ? `; worth ${e.wp}, back to full` : ""}).`
      : `<span class="hit">${e.name ?? "Food"}</span>: you were already at full hp, so this one is for morale.`,
  grimoireSold: () => `You cannot use it, so you sell it.`,
  grimoireLearned: (e) => `<span class="hit">New spells:</span> ${(e.spells ?? []).join(", ") || "nothing new"}.`,
  // P1 (04.2 Text batch): `gift` is the raw FAERIE table key ("+d20 Base HP",
  // "d10 x 100 wilmst", "Miscellaneous Magic"…) — printing it raw here echoed
  // dev jargon, and the SAME turn a specific follow-up event (faerieBoon/
  // faerieBane/goldGained/leveled/itemTaken/miscMagicRolled) already narrates
  // the real outcome. So this is now just the teaser; the follow-up tells the
  // story. (Builder no longer reads e.gift — the field stays on the event.)
  faerieMet: () => `<span class="beat">A faerie blinks into being, takes your measure, and decides.</span>`,
  faerieBoon: (e) => `<span class="hit">+${gainOf(e, e.amount)} base hp.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  faerieBane: (e) => `<span class="hurt">Faerie: it took against you.</span> −${e.amount ?? 0} base hp.`,
  // VOX-05 (Phase 79, plan 79-11): the meeting is an OFFER (engine/
  // encounters.js#meetJoiner: the accept, decline or refusal follows), so it
  // never says the stranger already joined; the level is stated, and the
  // article agrees ("an Apprentice").
  joinerMet: (e) => {
    const who = e.sub ?? e.race ?? "stranger";
    const what = Number.isFinite(e.lvl) ? `a level ${e.lvl} ${who}` : withArticle(who);
    return `<span class="hit">${e.name ?? "Someone"}</span>, ${what}, offers to travel with you for a while.`;
  },
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
  // RULES-07 (Phase 75, user kept canon 2026-09-25: AFFLICTIONS rows 5-6 stay
  // a disease of the mind that gives a phobia — the engine and content are
  // unchanged, only the words). The roll clause stays inside the span per
  // this file's convention; the row is read by roll (`AFFLICTIONS[roll-1]`),
  // never by `e.kind` alone, so a mind row never prints "Disease." A missing
  // or out-of-range roll falls back to today's wording rather than guess.
  afflictionRolled: (e) => {
    const row = AFFLICTIONS[(e.roll ?? 0) - 1];
    const clause = row?.phobia ? "Not your body — your nerve." : `${e.kind ?? "Something has its hooks in you"}.`;
    return `Something is wrong with you. <span class="roll">The die turns up ${e.roll ?? "?"}.</span> ${clause}`;
  },
  phobiaAcquired: (e) => `<span class="hurt">A new fear settles in: ${e.name ?? "something"}.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  afflictionCaught: (e) => `<span class="hurt">${e.kind ?? "It"}: it takes hold.</span> −${e.first ?? 0} hp.`,
  // VOX-05 (Phase 79, plan 79-11): this is the HERO's insanity (engine/
  // encounters.js#goInsane), but the line printed the INSANITY table's
  // foe-side row ("It strikes the nearest of its own") as if something else
  // did it, and faces 2, 4 and 6 do nothing to you at all. A 1, 3 or 5 has
  // its own line right after (insanitySelfHarm, teleported, insanityRage),
  // so only the harmless faces add a clause.
  insanityRolled: (e) =>
    `<span class="hurt">Insanity takes hold of you.</span>${e.roll != null ? ` <span class="roll">d6 → ${e.roll}.</span>` : ""}${
      e.roll === 2 || e.roll === 4 || e.roll === 6 ? " It lets go again before anything comes of it." : ""
    }`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  insanitySelfHarm: (e) => `<span class="hurt">Insanity: you turn on yourself.</span> −${e?.loss ?? 0} hp.`,
  // VOX-05 (Phase 79, plan 79-11): "might" is damage on every blow, and it
  // lasts until the day ends (engine/movement.js#newDay clears c.might).
  insanityRage: (e) => `<span class="hurt">Rage: +${e.amount ?? 0} damage on every blow until the day ends.</span>`,
  // VOX-05 (Phase 79, plan 79-11): how long the dark lasts (engine/
  // encounters.js#fallDark's `duration`) and what it costs, or that Night
  // Vision waives it.
  darknessFell: (e) => {
    const how = Number.isFinite(e?.duration) ? ` for ${plural(e.duration, "square")}` : "";
    return e?.nightVision
      ? `<span class="beat">The dark closes in around you${how}.</span> Your Night Vision sees straight through it.`
      : `<span class="beat">The dark closes in around you${how}: you see only the squares beside you, and you fight worse in it.</span>`;
  },
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
  // VOX-05 (Phase 79, plan 79-11): itemRejected and equipRejected share one
  // refusal reader (equipRefusalLine, below this table): every reason says
  // why in the player's terms before the joke.
  itemRejected: (e) => equipRefusalLine(e),
  // Phase 61 (STORE-02): an additive `replaced` (the traded-in weapon/armor
  // piece) appends one clause; the no-replaced text stays byte-identical.
  // RULES-08 (Phase 75): an additive `destroyed`/`discarded` (the outgoing
  // piece was already destroyed, not a trade-in — the two are mutually
  // exclusive, `replaced` is never set alongside `destroyed`) pairs in voice
  // with itemUnequipped's own destroyed line below.
  itemTaken: (e) =>
    `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}.${
      e.destroyed && e.discarded?.n
        ? ` Your old ${e.discarded.n} was already in pieces. You leave it where it fell.`
        : e.replaced?.n
          ? ` The shopkeeper keeps your old ${e.replaced.n}.`
          : ""
    }`,
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
    // VOX-05 (Phase 79, plan 79-11): "3 squares" of what — until it is ready.
    if (e.reason === "cooldown") return `<span class="miss">${item}: ready again in ${e.left ?? "?"} squares.</span> It is not a vending machine.`;
    if (e.reason === "recharging") return `<span class="miss">${item}: ${e.left ?? "?"} squares to the next charge.</span> Patience is also a spell.`;
    if (e.reason === "wrongClass") return `<span class="miss">${item} is a stick to anyone who is not a Magic User.</span>`;
    // Phase 37 (GEAR-03): a cloak/jewelry/staff activatable used from the
    // BAG in the new worn-slot model — activatables must be worn to work.
    if (e.reason === "notWorn") return `<span class="miss">${item} is in your bag,</span> doing what things in bags do: nothing. Wear it first.`;
    // RULES-13 (Phase 75, user 2026-09-25): a staff's power works only while
    // wielded — a bagged one is inert, same voice as notWorn.
    if (e.reason === "notWielded") return `<span class="miss">${item} is in your bag,</span> doing what things in bags do: nothing. Wield it first.`;
    if (e.reason === "combatOnly") return `<span class="miss">${item} wants a target.</span> Save it for a fight.`;
    // VOX-05 (Phase 79, plan 79-11): the rule first, like castRefused's (79-08).
    if (e.reason === "exploreOnly") return `<span class="miss">${item} only works out of a fight.</span> It needs quieter surroundings.`;
    if (e.reason === "noTarget") return `<span class="miss">Nothing left to aim at.</span>`;
    if (e.reason === "notFought") return `<span class="miss">Fight! first.</span> It will keep.`;
    // Phase 39 (GEAR-05): the torch used while not dark.
    if (e.reason === "notDark") return `<span class="miss">It is not dark.</span> Save the torch for when it is.`;
    // RULES-09 (Phase 75.1): the Pilfer heal-only branch that used to live
    // here is gone (superseded by pilferFumbled below) — this is now a
    // generic fallback for any reason not named above.
    return `<span class="miss">${item} does not work for you.</span>`;
  },
  // RULES-09 (Phase 75.1, user 2026-09-24/25): a Pilfer's use-activated
  // magic-item fumble — names the item, shows the steady-hands roll, states
  // the hp lost with U+2212, and says the item is dust, in the fiddling-
  // hands voice. Never names a diagnosis — the fidgeting is voice, not a
  // label.
  pilferFumbled: (e) =>
    `<span class="hurt">${e.item ?? "It"} comes apart in your hands.</span> <span class="roll">${rollVsText(e.roll, e.atLeast, e.dieN)}.</span> −${e.dmg ?? 0} hp, and it is dust now.`,
  cured: (e) => `<span class="hit">Cured of ${e.kind ?? "it"}.</span>`,
  // VOX-05 (Phase 79, plan 79-11): one foe "turns", two or more "turn".
  foeStoned: (e) => {
    const names = e.names ?? [];
    return `<span class="hit">${names.join(", ") || "It"} ${names.length > 1 ? "turn" : "turns"} to stone.</span> Statues don't hit back.`;
  },
  itemBurned: (e) => `<span class="roll">${e.total ?? 0}</span> fire damage spread across the room.`,
  itemFizzled: () => `<span class="miss">Nothing happens.</span>`,
  // Phase 43 (CLAR-01): cause first, cost last — see docs/CLARITY.md
  itemConsumed: (e) => `Spent: ${e.item?.n ?? "It"}. One use, as advertised.`,
  // Phase 39 (GEAR-02): the item activation model's four new events — a use
  // starts an effect (itemEffectStarted, kind-keyed line), the tick sites
  // narrate the transitions (itemEffectFaded/itemCooled/staffRecharged).
  // VOX-05 (Phase 79, plan 79-11): every count goes through squaresText ("1
  // square", and no leaked "undefined squares" on an event with no count);
  // invis and unseen state what they do in roll-high terms (ROLL-04), in the
  // same words as their own item text (content/treasure-tables.js).
  itemEffectStarted: (e) => {
    const n = e.left;
    const sq = squaresText(n);
    const map = {
      haste: `<span class="hit">Double attacks for ${sq}.</span>`,
      invis: `<span class="hit">Unseen for ${sq}: foes hit only on their die's top face (the top two if you insulted them). They swing at where you were.</span>`,
      // 260919-00d (Cloak of Ether wall-walking, user ruling 2026-09-19):
      // states the count and, in voice, that ending inside stone is fatal.
      ether: `<span class="hit">${sq} of walking through stone. Be in a corridor when it ends — the stone will not make room.</span>`,
      acute: `<span class="hit">You strike on a d6 for ${Number.isFinite(n) ? plural(n, "round") : "a few rounds"}.</span>`,
      might: `<span class="hit">+${e.might ?? "?"} damage for ${sq}. Hit things.</span>`,
      fly: `<span class="hit">Twenty squares of not touching the floor.</span>`,
      // Phase 39 (GEAR-05): the torch's lit effect.
      lit: `<span class="hit">Forty squares of carrying a light.</span>`,
      // 260918-w4n (use-activated-only): the 7 newly use-activated kinds.
      power: `<span class="hit">+1 damage for ${sq}. The ring approves.</span>`,
      // RULES-11 (Phase 75.2, Plan 04): the Gauntlet of the Giant and
      // Enlarge each narrate their start from the event's own size fields
      // (75.2-02's itemEffectStarted `size`/`sizeDmg`) — never a restated
      // formula. An event carrying no `size` (should not happen for either
      // kind, but defensive) falls back to the plain line. No overhead-
      // clearance/corridor promise — that promise is dropped (75.2-CONTEXT).
      giant: e.size
        ? `<span class="hit">${sq} one size larger: you are ${e.size}. ${signedText(e.sizeDmg ?? 0)} damage, and one face easier for foes to hit. You are, on reflection, a bigger target.</span>`
        : `<span class="hit">One size larger for ${sq}.</span>`,
      enlarge: e.size
        ? `<span class="hit">${sq} one size larger: you are ${e.size}. ${signedText(e.sizeDmg ?? 0)} damage, and one face easier for foes to hit. You are, on reflection, a bigger target.</span>`
        : `<span class="hit">One size larger for ${sq}.</span>`,
      glow: `<span class="hit">Fifty squares of being your own lantern.</span>`,
      unseen: `<span class="hit">Unseen for ${sq}: every foe has two fewer faces that hit you.</span>`,
      tongue: `<span class="hit">${sq} of perfect fluency. Do not waste it on small talk.</span>`,
      critWard: `<span class="hit">${sq} with nothing critical landing on you.</span>`,
      plate: `<span class="hit">${sq} of weightless plate.</span>`,
    };
    return map[e.kind] ?? `<span class="hit">${e.item ?? "It"} is in effect for ${sq}.</span>`;
  },
  itemEffectFaded: (e) => `<span class="beat">${e.item ?? "It"} wears off.</span>`,
  itemCooled: (e) => `<span class="hit">${e.item ?? "It"} is ready again.</span>`,
  // VOX-05 (Phase 79, plan 79-11): the bare "2/5" now says what it counts.
  staffRecharged: (e) =>
    `<span class="hit">${e.item ?? "It"} hums: a charge is back${Number.isFinite(e.charges) && Number.isFinite(e.max) ? ` (${e.charges}/${e.max})` : ""}.</span>`,

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
  // RULES-08 (Phase 75): an additive `destroyed`/`discarded` (the piece being
  // swapped out was already destroyed) takes priority over `replaced` (they
  // never co-occur — armor's destroyed branch never sets `replaced`, and
  // `replaced` only ever names a live cloak/jewelry piece); the destroyed
  // clause pairs in voice with itemUnequipped's own destroyed line below.
  itemEquipped: (e) =>
    `<span class="hit">Equipped:</span> ${e.item?.n ?? "something"}${e.slot ? ` (${slotWord(e.slot)})` : ""}. Whether that was wise is between you and the maze.${
      e.destroyed && e.discarded?.n
        ? ` Your old ${e.discarded.n} was already in pieces. You leave it where it fell.`
        : e.replaced?.n
          ? ` ${e.replaced.n} goes back in the bag — the maze is not a jeweller.`
          : ""
    }`,
  // Phase 28 (ARMOR-03): a destroyed piece never re-enters the bag — narrate
  // that honestly instead of the usual stow-and-improvise line. 260918-wy1:
  // the slot renders through slotWord here too.
  itemUnequipped: (e) =>
    e.destroyed
      ? `<span class="beat">You peel off what is left of your ${e.item?.n ?? "armour"}</span> and leave it where it falls. The bag declines the honour.`
      : `<span class="beat">You stow your ${e.slot ? slotWord(e.slot) : "gear"}</span> — ${e.item?.n ?? "it"} back in the bag, and you back to improvising.`,
  // Tried to wear/wield something your class, subclass, or race cannot.
  // Phase 24 (IDENT-07): a Woodsman gets its own clause; every other reason
  // (noArmor/wrongClass/notEquippable) stays byte-identical.
  // Phase 25 (FEED-02): an Acrobat's dagger-only rule gets its own clause.
  // 260918-wy1 (jewelry-merge): jewelryFull/wrongSlot each get their own
  // clause ahead of the generic fallback.
  equipRejected: (e) => equipRefusalLine(e),
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
 * equipRefusalLine(e) — VOX-05 (Phase 79, plan 79-11): the ONE Oracle
 * reading of an itemRejected (a take or a store buy) or equipRejected (the
 * Gear tab) refusal, keyed on the engine's own `reason`
 * (engine/items.js#weaponRefusalReason/#armorRefusalReason, takeItem,
 * stowItem, equipItem). Every reason says why in the player's terms, then the
 * joke. `tooHeavy` is the class armour rule (the armour is not on your
 * class's list), not weight; `wrongClass` is the class weapon rule, or a
 * staff in a non-Magic User's hands; `notEquippable` is an item nothing
 * wears or wields. An unknown reason keeps the generic refusal.
 */
function equipRefusalLine(e) {
  const item = e?.item?.n;
  switch (e?.reason) {
    case "woodsman":
      return `<span class="miss">A Woodsman wears no mail or plate.</span> A Woodsman in ${item ?? "that"} is a tree in a tin.`;
    case "acrobat":
      return `<span class="miss">An Acrobat carries a dagger. A dagger. That is the whole list.</span>`;
    case "jewelryFull":
      return `<span class="miss">Two pieces of jewelry. That is the limit.</span> ${item ?? "It"} waits in the bag until something comes off.`;
    case "wrongSlot":
      return `<span class="miss">${item ?? "That"} does not go there.</span> Try the slot it was made for.`;
    case "haveOne":
      return `<span class="miss">You already carry one ${item ?? "of those"}.</span> One is the limit; two is a hobby.`;
    case "notBetter":
      return `<span class="miss">Not an upgrade:</span> ${item ?? "it"} is no better than what you have.`;
    case "wrongClass":
      return `<span class="miss">Your class cannot use ${item ?? "that"}.</span> Not for the likes of you.`;
    case "tooHeavy":
      return `<span class="miss">Your class does not wear ${item ?? "that armour"}.</span> Not for the likes of you.`;
    case "noArmor":
      return `<span class="miss">Your kind wears no armour, so ${item ?? "it"} stays off.</span> Not for the likes of you.`;
    case "notEquippable":
      return `<span class="miss">${item ?? "That"} is not something you wear or wield.</span>`;
    default:
      return `<span class="miss">Not for the likes of you.</span> ${item ?? "That"} refuses your hands.`;
  }
}

/**
 * stampScrollCopyNotes(events) — CMBUI-11 (Phase 77). A presentation-only
 * decoration, like missLines.js#decorateMisses (the precedent: a field the
 * adapter adds before formatting, which the engine never sets). The engine
 * pushes `scrollTooAdvanced` BEFORE its `scrollCast` (it checks the grimoire
 * copy before the free cast), so the Oracle used to print "Fireball needs
 * level 3; you are 1." ahead of a scroll that cast anyway. The user's
 * 2026-09-21 device report: "I used a scroll in combat and I got a message
 * saying it was a level 3 spell so I couldn't use it, but it actually
 * successfully used the scroll."
 *
 * Returns a NEW array: a `scrollTooAdvanced` DIRECTLY followed by a
 * `scrollCast` of the same spell becomes `{ ...e, castFollows: true }` (its
 * EVENT_NARRATION line is then empty and formatEvent drops it), and that
 * cast becomes `{ ...cast, tooAdvanced: { need, have } }` (its line reads the
 * cast, then "Too advanced to copy into your book."). Every other element is
 * the same object; the input is never mutated; a non-array returns []. The
 * engine's events and their order are untouched. engineAdapter.js#dispatch
 * applies it right after decorateMisses; narrationLines.js's
 * scrollCopyChain gives the fold the same reading.
 */
export function stampScrollCopyNotes(events) {
  if (!Array.isArray(events)) return [];
  const out = events.slice();
  for (let i = 0; i < out.length - 1; i++) {
    const note = out[i];
    const cast = out[i + 1];
    if (note?.type !== "scrollTooAdvanced" || cast?.type !== "scrollCast" || cast.spell !== note.spell) continue;
    out[i] = { ...note, castFollows: true };
    out[i + 1] = { ...cast, tooAdvanced: { need: note.need, have: note.have } };
    i++;
  }
  return out;
}

/**
 * stampBookRefill(events, before, after, maxOf) — Phase 78 (78-05). A
 * presentation-only decoration in the stampScrollCopyNotes precedent above.
 * The user's 2026-09-25 report: "I had 1 charge left ... then when combat
 * started I had 12 charges". Not an engine bug: a fed new day refills every
 * spent book (Phase 75 RULES-15), and nothing on screen said so.
 *
 * Returns a NEW array: each `rationsEaten` that carries the engine's own
 * `refilled` flag becomes `{ ...e, books }`, where `books` lists the hero
 * (`{ who: "you", name, have, max }`) and then each party member (`who` is
 * the member's index; matched by index AND the same name in `before` and
 * `after`) whose spent charges (`spellsUsed`) were above 0 in `before` and
 * are 0 in `after`. A refilled book is full, so `have` equals `max`, which is
 * `maxOf(sheet)` read from the `after` sheet (engineAdapter.js passes
 * engine/movement.js#maxCharges; this module never imports engine/). Without
 * a `maxOf` the entries carry no count. RULES-15 agreement: no `refilled`
 * flag, or no sheet whose charges reached zero, stamps nothing, so an unfed
 * day, an already-full book or a still-spent sheet never claims a refill.
 * Every other element is the same object; the input is never mutated; a
 * non-array returns []. engineAdapter.js#dispatch applies it right after
 * stampScrollCopyNotes, with the state before applyAction as `before`.
 */
export function stampBookRefill(events, before, after, maxOf) {
  if (!Array.isArray(events)) return [];
  if (!events.some((e) => e?.type === "rationsEaten" && e.refilled)) return events.slice();
  const refilled = (b, a) => !!b && !!a && (Number(b.spellsUsed) || 0) > 0 && (Number(a.spellsUsed) || 0) === 0;
  const countOf = (sheet) => {
    if (typeof maxOf !== "function") return {};
    const max = Number(maxOf(sheet));
    return Number.isFinite(max) ? { have: max, max } : {};
  };
  const books = [];
  if (refilled(before?.c, after?.c)) books.push({ who: "you", name: after.c.name, ...countOf(after.c) });
  const bParty = Array.isArray(before?.party) ? before.party : [];
  const aParty = Array.isArray(after?.party) ? after.party : [];
  bParty.forEach((bm, i) => {
    const am = aParty[i];
    if (am && bm && am.name === bm.name && refilled(bm, am)) books.push({ who: i, name: am.name, ...countOf(am) });
  });
  if (!books.length) return events.slice();
  return events.map((e) => (e?.type === "rationsEaten" && e.refilled ? { ...e, books: books.map((b) => ({ ...b })) } : e));
}

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
