// src/browser/heroTab.js
//
// Phase 47 (SHELL-02), Plan 04 — the HERO tab: character sheet, special
// skills, abilities, RATIONS, Grimoire, the Game Master's notes and the
// Company panel, plus the Hero view models. Contract:
// renderHeroTab(host, state, deps) — see docs/SHELL-MODULES.md. No
// window/document globals: host.ownerDocument + deps only.
//
// Task 1 (this commit): a pure move of the six Hero-only view models out of
// viewModels.js (characterSheetViewModel, ABILITY_VIEW_COPY, RATIONS_COPY,
// eatsLineFor, rationsViewModel, grimoireViewModel), plus the private
// helpers only they use (skillTableFor, damageBracket, nextLevelValue,
// snarkLine, quirkText, abilitiesViewFor) — bodies and doc comments
// unchanged, in their original relative order.
// Task 2 lands renderHeroTab/renderAbilityRows/renderGrimoire/
// renderPartyRoster here, moved verbatim from the classic script's paint().

import { RACES, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, THRESHOLDS, SPELLS, ABILITY_BY_ID, NICHE_LABELS } from "../../content/index.js";
// Phase 47 (SHELL-02), Plan 04, Task 2 — the content tables the classic
// script used to reach through window.__mzTables (RACE_NOTE/CLASS_NOTE/
// SUB_NOTE for the dossier; ROMAN for the level/Company-panel readouts) —
// a SEPARATE import line so the line above stays byte-identical.
import { RACE_NOTE, CLASS_NOTE, SUB_NOTE, ROMAN } from "../../content/index.js";
import { strikeDie, upkeep, skill, eff, intelBonus, spellLevelFor, schoolGate, potionMight, weaponRow } from "../../engine/derived.js";
// Phase 90 plan 06 (SPELL-10): its own line, so the pinned line above (test/unit/shell-worn-slots.test.js) is untouched.
import { spellClosed } from "../../engine/derived.js";
// Phase 90 plan 11 (TEXT-01): a spell cast on a foe can be resisted; its row says so in one place (below).
import { spellTargetsFoe } from "../../engine/derived.js";
import { maxCharges, nightlyEats, eatsFor } from "../../engine/movement.js";
import { abilityState } from "../../engine/abilities.js";
// Phase 94 (ASTATE-01): the in-combat ability words are the combat menu's own, one shared module.
import { abilityStateLabel } from "./abilityStates.js";
import { armorDisplay } from "./viewModels.js";
import { heroHitOdds } from "./rollOdds.js";
// RULES-11 (Phase 75.2, Plan 03) — a SEPARATE import line (the pinned line
// above, test/unit/shell-worn-slots.test.js, stays byte-identical): the
// size read seam 75.2-01 built (engine/derived.js) and the one signed-number
// formatter (src/browser/rollRange.js) the SIZE row's detail clauses read.
import { heroSize, sizeDamage, SIZE_FACES_PER_STEP } from "../../engine/derived.js";
import { signedText, playerDelta, ROLLERS } from "./rollRange.js";
// Phase 79 (Plan 09) — a SEPARATE import line (the pinned line above stays
// byte-identical): the engine's own damage terms and range, read by
// damageBracket and damageLine instead of a restated modifier stack.
import { weaponDamageTerms, weaponDamageRange } from "../../engine/derived.js";
import { footerLines } from "./identityFooter.js";
// Phase 87 (PARTY-11, report #5) — a SEPARATE import line: the Company cards read
// a Joiner's live fight hp through the same helper YOUR LOT uses.
import { memberLiveWp } from "./partyHp.js";
// Phase 89 (ITEM-07, plan 07) — a SEPARATE import block: the Company panel's
// item rows read the engine's own worn-slot list, activation records and the
// Joiner use refusals' constants (engine/items.js), the ONE item stat text
// (viewModels.js#itemStatLines) and the timer read (engine/effects.js#remaining).
import { WORN_SLOTS, activationFor, itemTimerId } from "../../engine/derived.js";
import { MEMBER_LEADER_KINDS, TARGETED_KINDS } from "../../engine/items.js";
import { remaining } from "../../engine/effects.js";
import { itemStatLines, ITEM_STAT_COPY } from "./viewModels.js";
// Phase 95 (FLAVOR-01, plan 05) — a SEPARATE import block: the Grimoire shows the spell's flavour line.
import { flavorOfSpell, flavorOfIdentity } from "./flavorText.js";
// Phase 96 (FLAVOR-04): the ability and passive-skill flavour lookups (a separate import line, the pinned one above stays as it was).
import { flavorOfAbility, flavorOfSkill } from "./flavorText.js";

// Task 2 — module-private: the same clamp(v, lo, hi) one-liner the classic
// script keeps for the HUD's own wp readout (mazeworld.html's copy stays,
// used by the HUD block paint() still owns).
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * skillTableFor(cls) — the special-skill description pool for a class
 * (mirrors engine/character.js's private skillTable()); Magic Users have no
 * table at all, matching rollSkills()'s early-return with an empty c.skills.
 */
function skillTableFor(cls) {
  return cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : null;
}

/**
 * damageBracket(c) — a deterministic [min, max] damage range for the
 * character's current weapon. Phase 79 (Plan 09; todo 2026-09-25 "hero
 * sheet damage range leaves out bonuses the engine applies"): this used to
 * restate weaponDamage's modifier stack here and had drifted (it left out
 * Master of Arms' +2). It now reads the engine's own
 * engine/derived.js#weaponDamageRange — the same terms, cap and floor
 * weaponDamage rolls with — so the sheet can never show a lower or higher
 * range than a real strike, and it still never advances
 * GameState.rngState (T-04-06). Reads only `c`.
 */
function damageBracket(c) {
  return weaponDamageRange(c);
}

/**
 * damageLine(c) — Phase 79 (Plan 09): the Hero sheet's #s-dmg formula,
 * "level² + dice ± bonus", built only from the engine's own
 * weaponDamageTerms(c) (never a restated modifier stack), with " (max N)"
 * when the terms carry a cap (the Sorcerer's 9). A zero bonus is left off,
 * as before. Pure.
 */
function damageLine(c) {
  const t = weaponDamageTerms(c);
  const sign = t.bonus > 0 ? ` + ${t.bonus}` : t.bonus < 0 ? ` − ${-t.bonus}` : "";
  const cap = t.cap !== null ? ` (max ${t.cap})` : "";
  return `${c.level}² + ${t.weapon.lab}${sign}${cap}`;
}

/**
 * HERO_SIZE_COPY — RULES-11 (Phase 75.2, Plan 03): every player-facing
 * string sizeRowFor (below) builds from — a frozen literal like
 * ABILITY_VIEW_COPY/RATIONS_COPY elsewhere in this module. `theirs` reuses
 * Phase 74's "vs their swings" phrase (src/browser/conditionEffects.js's
 * CONDITION_EFFECT_COPY.theirs) so the sheet and the condition chips read
 * alike.
 */
export const HERO_SIZE_COPY = Object.freeze({
  label: "SIZE",
  damage: "{damage} damage",
  theirs: "{theirs} vs their swings",
  join: ", ",
  born: "{base} by birth",
  sep: " · ",
});

/**
 * sizeRowFor(c) — RULES-11 (Phase 75.2, Plan 03): the hero sheet's SIZE row,
 * reading only the engine's own size seam (engine/derived.js#heroSize/
 * sizeDamage) and formatting every signed number through the ONE formatter
 * (src/browser/rollRange.js#signedText/playerDelta) — never a restated
 * formula. Per the user's signature ruling (75.2-CONTEXT "Race signatures
 * and Joiners"), a damage clause appears only when sizeDamage(c) is
 * non-zero, and a "vs their swings" clause only when the face step is
 * non-zero — so a Dwarf's row never claims a damage loss and an Elf's never
 * claims to be harder to hit. A "<race size> by birth" clause is appended
 * when a live item step has moved the displayed name away from the race's
 * own base size (e.g. a live Gauntlet of the Giant). Pure, no rng.
 */
function sizeRowFor(c) {
  const hs = heroSize(c);
  const clauses = [];
  const dmg = sizeDamage(c);
  if (dmg !== 0) clauses.push(HERO_SIZE_COPY.damage.replace("{damage}", signedText(dmg)));
  if (hs.faceStep !== 0) {
    const theirs = playerDelta(SIZE_FACES_PER_STEP * hs.faceStep, ROLLERS.foe);
    clauses.push(HERO_SIZE_COPY.theirs.replace("{theirs}", signedText(theirs)));
  }
  const detail = clauses.join(HERO_SIZE_COPY.join);
  const born = hs.name !== hs.baseName ? HERO_SIZE_COPY.born.replace("{base}", hs.baseName) : "";
  const text = [hs.name, detail, born].filter(Boolean).join(HERO_SIZE_COPY.sep);
  return { key: "size", label: HERO_SIZE_COPY.label, value: hs.name, step: hs.step, base: hs.baseName, detail, text };
}

/** nextLevelValue(c) — the sp threshold for the next skill level, or "MAX" past the top of THRESHOLDS. */
function nextLevelValue(c) {
  if (c.level >= THRESHOLDS.length) return "MAX";
  return THRESHOLDS[c.level];
}

/**
 * snarkLine(c) — a static assembly of the real temperament/motive/phobia
 * fields (tone reference only; NOT a call into a copy generator — Phase 5
 * owns the real voice system). Deterministic string concatenation, no rng.
 */
function snarkLine(c) {
  return `${c.temperament}. Motivated by ${c.motive}. Terrified of ${c.phobia}.`;
}

/**
 * quirkText(c) — the character's real phobia rendered as the sheet's quirk
 * box copy (the closest real GameState field to the design mockup's
 * throwaway QUIRKS placeholder table, which this project does not port).
 */
function quirkText(c) {
  return c.phobiaType ? `Afraid of ${c.phobia} (${c.phobiaType}).` : `Afraid of ${c.phobia}.`;
}

/**
 * ABILITY_VIEW_COPY — Phase 38 (ABIL-01/04): every player-facing string the
 * Hero-tab abilities list needs beyond the catalog's own name/txt — the
 * out-of-combat state-suffix vocabulary and the two source-provenance tags.
 * Phase 94 (ASTATE-01): the in-combat words (READY, READY IN N, the gate
 * reasons, SPENT THIS FIGHT) live in src/browser/abilityStates.js, shared
 * with the combat menu. A frozen literal object like COMBAT_MENU_COPY/RAIL_COPY
 * elsewhere in this codebase.
 */
export const ABILITY_VIEW_COPY = Object.freeze({
  // Quick 260927-opf: the ruling's wording, "once per fight" (out of a fight).
  cd: "cd {n} rounds",
  once: "once per fight",
  tagTable: "special skill · active",
  tagPool: "trick",
  noAbilitiesCaster: "No abilities. Spells are the trick.",
});

/**
 * abilitiesViewFor(c, state) — Phase 38 (ABIL-01/04): characterSheetViewModel's
 * `abilities[]` (Hero tab) — one `{ id, name, description, source, state }`
 * row per `c.abilities` catalog id (`source` is the catalog's own literal
 * "table" | "pool", NOT a display tag — the Hero-tab shell maps that to
 * ABILITY_VIEW_COPY.tagTable/tagPool). `state` is the ONE place the state
 * text lives. Phase 94 (ASTATE-01..04): in a fight the words and the category
 * come from the engine (engine/abilities.js#abilityState) through the same
 * module the combat menu reads (src/browser/abilityStates.js), so the Hero
 * tab and the combat row say identical words; the row also carries
 * `stateKind` (ready | recharging | unavailable | spent) for the shell's
 * edge. A pending fight (before FIGHT!) reads FIGHT FIRST, the engine's own
 * answer. Out of a fight the row is unchanged: the ability's OWN declared
 * cooldown length ("cd {n} rounds" / "once per fight"), no `stateKind` —
 * never a live timer read, since c.timers is combat-scoped and cleared every
 * fight anyway. An id absent from the catalog (a tampered save) is silently
 * dropped. Pure, no rng.
 */
function abilitiesViewFor(c, state) {
  const inCombat = !!(state && state.combat);
  return (c.abilities || [])
    .map((key) => {
      const meta = ABILITY_BY_ID[key];
      if (!meta) return null;
      if (inCombat) {
        const st = abilityState(state, c, key);
        return { id: key, name: meta.name, description: meta.txt || "", source: meta.source, state: abilityStateLabel(st, meta), stateKind: st.state };
      }
      const text = meta.cd === "fight" ? ABILITY_VIEW_COPY.once : ABILITY_VIEW_COPY.cd.replace("{n}", meta.cd);
      return { id: key, name: meta.name, description: meta.txt || "", source: meta.source, state: text };
    })
    .filter(Boolean);
}

/**
 * characterSheetViewModel(state) — the HERO tab's ("THE DOOMED") render-
 * ready data, bound to the real GameState. Returns a flat object: name,
 * level, classLabel, raceLabel, subLabel, snarkLine, stats[] (the 8 UI-SPEC
 * rows), winPotential {value,max,pct}, quirk {label,text}, skills[].
 */
export function characterSheetViewModel(state) {
  const c = state.c;
  const damage = damageBracket(c);
  // Phase 28 (ARMOR-02/04): durability and the cloak's effective plate now
  // show on the tile via the shared formatter.
  const armor = armorDisplay(c);

  const stats = [
    { key: "toStrike", label: "TO STRIKE", value: `d${strikeDie(c)}` },
    // Phase 74 (ROLL-02, roll-display honesty): roll-HIGH — a strike lands
    // on the current strike die's own winning range, so the sheet shows the
    // real range from the engine's own heroHitOdds(state) (src/browser/
    // rollOdds.js), Afraid included ("16–20 (d20)"), never a re-derived
    // formula. Supersedes the Phase 31 low-roll "1–N" reading (that era's
    // engine still rolled low; Phase 73 flipped the engine to roll-high).
    { key: "toHit", label: "TO HIT", value: heroHitOdds(state).text },
    { key: "damage", label: "DAMAGE", value: `${damage.min}–${damage.max}`, min: damage.min, max: damage.max },
    // RULES-11 (Phase 75.2, Plan 03): the hero's size, stated as a net
    // effect from the player's side (75.2-CONTEXT: "the hero sheet shows the
    // size, e.g. 'SIZE Small'") — sizeRowFor(c) reads only the engine's own
    // size seam, never a restated formula.
    sizeRowFor(c),
    { key: "armor", label: "ARMOUR", value: `${armor.label.toUpperCase()} · ${armor.sub}`, under: armor.under },
    // RULE-01 (04.1-04): intelBonus(c) is the SAME derived.js helper openChest
    // consumes for its lock-roll threshold — surfaced here as `lockBonus` so
    // the sheet and the engine can never drift (the damageBracket↔
    // weaponDamage single-source-of-truth pattern). `value` stays the raw
    // c.intel score; lockBonus is the additional derived read.
    { key: "intelligence", label: "INTELLIGENCE", value: c.intel, lockBonus: intelBonus(c) },
    { key: "skillPoints", label: "EXPERIENCE", value: c.sp },
    { key: "nextLevel", label: "NEXT LEVEL", value: nextLevelValue(c) },
    { key: "upkeep", label: "UPKEEP", value: `${upkeep(c)} hp/day` },
  ];

  const winPotential = {
    value: c.wp,
    max: c.maxWP,
    pct: c.maxWP > 0 ? c.wp / c.maxWP : 0,
  };

  const skillsTable = skillTableFor(c.cls);
  const skills = skillsTable
    ? Object.keys(c.skills || {}).map((name) => {
        const tier = c.skills[name];
        const def = skillsTable[name] || {};
        const description = tier === 2 && def.txt2 ? def.txt2 : def.txt || "";
        // Phase 96 (FLAVOR-04; CONTEXT 'Special skills'): `flavor` is additive and "" only for a skill the lookup does not know (96-12: the active skills carry a line too).
        return { name, description, tier, flavor: flavorOfSkill(name) };
      })
    : [];

  const abilities = abilitiesViewFor(c, state);

  return {
    name: c.name,
    level: c.level,
    classLabel: c.cls,
    raceLabel: c.race,
    subLabel: c.sub,
    snarkLine: snarkLine(c),
    stats,
    winPotential,
    quirk: { label: "QUIRK", text: quirkText(c) },
    skills,
    abilities,
  };
}

/**
 * RATIONS_COPY — Phase 43 (CLAR-03/05): every player-facing string
 * `rationsViewModel`/`eatsLineFor` (below) build from — a frozen object
 * like ITEM_STATE_COPY/ABILITY_VIEW_COPY elsewhere in this module, so the
 * voice scan and the standing hp-not-wp guard can both walk it as a single
 * leaf group. `why` is the Hero-sheet clause form of
 * `src/browser/eventNarration.js#RATION_RULE_LINE` — the SAME race key
 * drives both, so the Oracle's `rationsEaten` line and this sheet's reason
 * clause can never say something different about the same race.
 */
export const RATIONS_COPY = Object.freeze({
  you: "You eat {n} a rest{why}",
  member: "{name} ({race}) eats {n}{why}",
  party: "Party: {n} a rest",
  carried: "{n} carried",
  nights0: " — nothing for tonight. Camp is a rumour.",
  nights1: " — one night, then the arguing starts.",
  nightsN: " — {n} nights, then the arguing starts.",
  eats: "eats {n} a rest",
  why: Object.freeze({ Troll: " (Troll: eats for two)" }),
});

/**
 * eatsLineFor(sheet) — "eats N a rest" for a Joiner offer card / Company
 * panel row. Pure, no rng, no mutation; reads the SAME `eatsFor` the engine
 * charges (`engine/movement.js`).
 */
export function eatsLineFor(sheet) {
  return RATIONS_COPY.eats.replace("{n}", eatsFor(sheet));
}

/**
 * rationsViewModel(state) — Phase 43 (CLAR-03/05): the ONE ration readout
 * the Hero RATIONS panel, Joiner offer card and Company panel (Plan 04) all
 * read. `total` IS `nightlyEats(state)` itself, never a re-sum, so the Hero
 * sheet, the camp refusal (`makeCamp`) and the fed-night charge (`newDay`)
 * can never disagree about how much this party eats tonight. `carried` IS
 * `state.c.rations` itself, for the same reason. A solo hero (no members)
 * gets no "Party: N a rest" clause — a party of one is not a party. Pure,
 * no rng, no DOM.
 */
export function rationsViewModel(state) {
  const c = state.c;
  const hero = { name: c.name, race: c.race, eats: eatsFor(c), why: RATIONS_COPY.why[c.race] ?? "" };
  const members = (state.party ?? []).map((m) => ({
    name: m.name,
    race: m.race,
    eats: eatsFor(m),
    why: RATIONS_COPY.why[m.race] ?? "",
  }));
  const total = nightlyEats(state);
  const carried = c.rations ?? 0;
  const nights = total > 0 ? Math.floor(carried / total) : 0;
  const carriedText = RATIONS_COPY.carried.replace("{n}", carried);
  const tail =
    nights === 0 ? RATIONS_COPY.nights0 : nights === 1 ? RATIONS_COPY.nights1 : RATIONS_COPY.nightsN.replace("{n}", nights);
  const youClause = RATIONS_COPY.you.replace("{n}", hero.eats).replace("{why}", hero.why);
  const line = members.length
    ? `${youClause}. ${members
        .map((m) => RATIONS_COPY.member.replace("{name}", m.name).replace("{race}", m.race).replace("{n}", m.eats).replace("{why}", m.why))
        .join(". ")}. ${RATIONS_COPY.party.replace("{n}", total)} · ${carriedText}${tail}`
    : `${youClause} · ${carriedText}${tail}`;
  return { hero, members, total, carried, nights, carriedText, line };
}

/**
 * GRIMOIRE_COPY — Phase 90 plan 11 (TEXT-01, user 2026-09-30: "the spell texts state the resist plainly"):
 * `resistNote` is the ONE sentence every foe-targeted spell's Grimoire row and combat menu row carries (beside the
 * menu's per-target "{target} resists on {range}"), so thirty spell texts do not each restate it. It is true of every
 * spell a foe can resist (engine/derived.js#spellTargetsFoe): each foe it reaches rolls the one depth-rising
 * resist (derived.js#risingResistFaces: half its intelligence, plus more of the d20 every floor from 13).
 */
export const GRIMOIRE_COPY = Object.freeze({
  resistNote: "a foe may resist this on its intelligence, and the deeper the floor, the likelier it does",
});

/**
 * grimoireViewModel(state) — the HERO tab's Grimoire rows (04-DR10): the
 * character's OWN learned spells (`c.grimoire`, a list of names) — NOT the
 * full 32-entry SPELLS table — sorted by level then alphabetically. Each row
 * carries content/spells.js#combatOnly plus whether it's castable RIGHT NOW
 * from outside an encounter: the same grimoire/level/school gate
 * engine/derived.js#canCast already enforces for the in-combat SPELLS menu,
 * ANDed with the spell's own combatOnly flag, an out-of-combat check, and the
 * caster's remaining charge economy (engine/movement.js#maxCharges). Purely
 * read-only — never mutates state, never rolls against rngState (T-04-06);
 * the actual cast still goes through applyAction's normal "castSpell"
 * dispatch, exactly like the in-combat SPELLS menu.
 */
export function grimoireViewModel(state) {
  const c = state.c;
  const names = c.grimoire || [];
  const inCombat = !!state.combat;
  const charges = maxCharges(c) - c.spellsUsed;

  const rows = names
    .map((name) => SPELLS.find((sp) => sp.n === name))
    .filter(Boolean)
    .map((sp) => {
      let castable = false;
      let disabledReason = null;
      // DR13: during a fight ALL casting happens on the combat SPELLS menu —
      // including the non-combatOnly self-buffs/heal the engine handles in
      // combat (heal/ward/might/mirror/reveal). So while in combat the Hero
      // grimoire is a reference only and points the player there, instead of
      // the old (and wrong) "Only outside combat" that contradicted the combat
      // menu actually offering Heal/Shield/Strength.
      if (inCombat) {
        disabledReason = "On the combat screen";
      } else if (sp.combatOnly) {
        disabledReason = "Combat only";
      } else if (spellClosed(c.sub, sp)) {
        // Phase 90 plan 06 (SPELL-10): a school this sub-class can never learn
        // (only a tampered book holds one; the load drops it) is never castable.
        disabledReason = "Not your school";
      } else if (spellLevelFor(c.sub, sp) > c.level) {
        // Phase 31 (CMB-02): the engine's own two-way split (magic.js's
        // castSpell) instead of the old collapsed single opaque string —
        // grimoire membership is already guaranteed (sp came from c.grimoire), so
        // canCast's only two failure modes are the level gate and the
        // school gate; naming which one keeps a permanently-blocked spell
        // from reading like a transient cooldown.
        disabledReason = `Needs level ${spellLevelFor(c.sub, sp)}`;
      } else if (c.level < schoolGate(c.sub, sp.s)) {
        disabledReason = `${sp.s} opens at level ${schoolGate(c.sub, sp.s)}`;
      } else if (charges <= 0) {
        disabledReason = "No charges left";
      } else {
        castable = true;
      }
      return {
        idx: SPELLS.indexOf(sp),
        name: sp.n,
        // Phase 90 plan 06 (SPELL-12): the EFFECTIVE level for this sub-class,
        // the one canCast gates on and the combat menu already prints, so the
        // Summoner's Summon reads L1 (and sorts at 1), never its printed 2.
        lvl: spellLevelFor(c.sub, sp),
        txt: sp.txt,
        // Phase 90 plan 11 (TEXT-01): the resist sentence of a spell cast on a foe (null for the caster's own kinds).
        resistNote: spellTargetsFoe(sp) ? GRIMOIRE_COPY.resistNote : null,
        // Phase 40 (SPELL-01): the niche KEY + its display label, beside the
        // existing txt (which already begins with `nicheLabel + " · "`) — so
        // the shell can group/badge by niche without parsing txt.
        niche: sp.niche,
        nicheLabel: NICHE_LABELS[sp.niche] ?? sp.niche,
        // Phase 95 (FLAVOR-01): the player-layer line, looked up by name (never stored on the spell). ADDITIVE: txt and resistNote above stay byte-identical, the rules fields every guard reads.
        flavor: flavorOfSpell(sp.n),
        combatOnly: !!sp.combatOnly,
        castable,
        disabledReason,
      };
    })
    .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));

  return { rows, hasSpells: rows.length > 0, isCaster: c.cls === "Magic User" };
}

// ─── Task 2 — the Hero-tab render body ─────────────────────────────────────
//
// Phase 47 (SHELL-02), Plan 04, Task 2: renderHeroTab(host, state, deps) is
// the ONE mount function for the Hero tab (`#screen-hero`) — the character
// sheet (level/name/tag/abandon/hp/die/hit/damage/armor/int/sp/next/cost),
// the RATIONS panel, the special-skills list, the abilities list
// (renderAbilityRows), the Game Master's notes (the dossier loop), the
// Grimoire (renderGrimoire) and the Company panel (renderPartyRoster).
// Moved verbatim from the classic script's paint()/the module script's
// renderGrimoire, with `host.ownerDocument` replacing `document`, `state`/
// `state.c` replacing the classic S/c, and direct content/engine imports
// (ROMAN, strikeDie, heroHitOdds, eff) in place of a presentation bridge.
// Every id this function writes lives inside the `#screen-hero` markup
// section. No window/document globals — host, host.ownerDocument and deps
// only.

/**
 * skillTable(cls) — the special-skill description pool for a class, read by
 * the sheet's special-skills list. Moved verbatim from the classic script
 * (which read it through window.__mzTables.FIGHTER_SKILLS/THIEF_SKILLS);
 * this is a DIFFERENT (but behaviourally identical) helper than
 * skillTableFor(cls) above — skillTableFor is characterSheetViewModel's own
 * private helper, kept as a separate binding so neither carve had to touch
 * the other's body.
 */
function skillTable(cls) {
  return cls === "Fighter" ? FIGHTER_SKILLS : cls === "Thief" ? THIEF_SKILLS : null;
}

// VOX-04 (Phase 79, Plan 03) — one `p.doss-rules` paragraph per footer line
// under a dossier note, createElement + textContent only (the lines are
// generated text and never parsed as markup).
function appendFooter(doc, sec, lines) {
  for (const line of lines) {
    const p = doc.createElement("p");
    p.className = "doss-rules";
    p.textContent = line;
    sec.appendChild(p);
  }
}

// Phase 38 (ABIL-01/04) — the Hero-tab abilities list, mirroring the
// s-skills block's position immediately above (special skills stays
// passives-only, byte-identical). createElement/textContent only — T-38-11
// (no innerHTML in this region) — reading characterSheetViewModel(state)
// directly so the state text lives in exactly one place. Phase 94 (ASTATE-01):
// an in-combat row carries data-state (its stateKind) for its edge
// (mazeworld.html ul.skills li[data-state] rules, plan 94-02).
function renderAbilityRows(doc, state) {
  const c = state.c;
  const ul = doc.getElementById("s-abilities");
  if (!ul) return;
  ul.replaceChildren();
  if (c.cls === "Magic User") {
    const li = doc.createElement("li");
    li.className = "none";
    li.textContent = "No abilities. Spells are the trick.";
    ul.appendChild(li);
    return;
  }
  const rows = characterSheetViewModel(state).abilities;
  for (const row of rows) {
    const li = doc.createElement("li");
    if (row.stateKind) li.dataset.state = row.stateKind;
    const b = doc.createElement("b");
    b.textContent = row.name;
    li.appendChild(b);
    const tag = doc.createElement("small");
    tag.textContent = row.source === "pool" ? "trick" : "special skill · active";
    li.appendChild(tag);
    const desc = doc.createElement("i");
    // Phase 97.1 (FLAVOR-07): the flavour line alone; the exact txt stays on the row as description for the guards and is not
    // drawn. A row with no flavour (a name the lookup does not know) keeps today's text. The flavour is read here by name,
    // not carried on the abilitiesViewFor row, so that view-model's key set stays byte-identical (ability-state-view pins it).
    const flavor = flavorOfAbility(row.name);
    desc.textContent = flavor || row.description;
    li.appendChild(desc);
    const stateEl = doc.createElement("span");
    stateEl.textContent = row.state;
    li.appendChild(stateEl);
    ul.appendChild(li);
  }
}

// 04-DR10: the HERO tab's Grimoire (#s-grimoire) — the character's OWN
// learned spells (grimoireViewModel already sorts by level then name and
// computes each row's castable/disabledReason verdict; see its own doc
// comment). A non-combat spell's Cast button dispatches through
// deps.castSpell(idx) — the same dispatch()->applyAction()->engine/magic.js#
// castSpell path the in-combat SPELLS menu already calls, now reached
// through the tab's own deps object instead of window.mzCastSpell directly.
// Moved verbatim from the classic module script's renderGrimoire(), with the
// retired window.mzSpellCharges() global replaced by the SAME formula
// computed inline from the direct maxCharges(c) import.
function renderGrimoire(doc, state, deps) {
  const ul = doc.getElementById("s-grimoire");
  if (!ul) return;
  if (!state || !state.c) return;
  const c = state.c;
  const vm = grimoireViewModel(state);
  // DR13: the Grimoire header shows how many CASTS you have left (charges),
  // not how many spells are known — and renderHeroTab re-runs after an
  // inventory cast, so the count drops live as you spend charges.
  const countEl = doc.getElementById("s-grim-count");
  if (countEl) {
    const ch = c.cls === "Magic User" ? { left: Math.max(0, maxCharges(c) - c.spellsUsed), max: maxCharges(c) } : null;
    countEl.textContent = ch ? `${ch.left} of ${ch.max}` : (vm.hasSpells ? `${vm.rows.length}` : "");
  }
  ul.innerHTML = "";
  if (!vm.hasSpells) {
    const li = doc.createElement("li");
    li.className = "none";
    li.textContent = vm.isCaster ? "No spells learned yet." : "This character does not cast spells.";
    ul.appendChild(li);
    return;
  }
  for (const row of vm.rows) {
    const li = doc.createElement("li");
    li.className = row.combatOnly ? "grim-locked" : "";
    const info = doc.createElement("div");
    info.className = "grim-info";
    // Phase 40 (SPELL-01): row.txt already begins with `row.nicheLabel +
    // " · "` (content/spells.js's contract) — no markup change needed, the
    // niche line is already the FIRST thing the <i> renders. innerHTML
    // stays safe here because row.txt/row.name are content, not user data
    // (T-40-10, unchanged since 04-DR10).
    // Phase 95 (FLAVOR-01, plan 05): with a flavour line the <i> reads `nicheLabel · flavour` (the niche label stays as the leading
    // category tag, Claude's discretion named in 95-05: a category word, not a rule); the exact old line (txt plus the resist
    // sentence) is not drawn (Phase 97.1, FLAVOR-07); with no flavour, today's markup exactly.
    const rulesText = `${row.txt}${row.resistNote ? ` · ${row.resistNote}` : ""}`;
    info.innerHTML = row.flavor
      ? `<b><span class="grim-lvl">L${row.lvl}</span>${row.name}</b><i>${row.nicheLabel} · ${row.flavor}</i>`
      : `<b><span class="grim-lvl">L${row.lvl}</span>${row.name}</b><i>${rulesText}</i>`;
    li.appendChild(info);
    if (row.combatOnly) {
      const hint = doc.createElement("span");
      hint.className = "grim-hint";
      hint.textContent = "Combat only";
      li.appendChild(hint);
    } else {
      const bt = doc.createElement("button");
      bt.className = "small";
      bt.textContent = "Cast";
      bt.disabled = !row.castable;
      if (!row.castable && row.disabledReason) bt.title = row.disabledReason;
      bt.onclick = () => deps.castSpell?.(row.idx);
      li.appendChild(bt);
      if (!row.castable && row.disabledReason) {
        const hint = doc.createElement("span");
        hint.className = "grim-hint";
        hint.textContent = row.disabledReason;
        li.appendChild(hint);
      }
    }
    ul.appendChild(li);
  }
}

/**
 * COMPANY_COPY — Phase 89 (ITEM-07, plan 07): every label and line the Company
 * panel's item rows draw, a frozen leaf-string bank like RATIONS_COPY. House
 * voice; player-facing text says HP, never WP. `reason` holds the one-line why
 * a DRINK or USE is off; `leaderOnly` is the docs/ITEM-AUDIT.md Q2 line (the
 * party-moving and leading items are the one in front's alone).
 */
export const COMPANY_COPY = Object.freeze({
  armour: "Armour",
  armourNone: "none, bravely",
  potions: "Healing potions",
  drink: "DRINK",
  use: "USE",
  ready: "ready",
  live: "live {n} {unit}",
  armed: "armed",
  cooling: "cooling {n} {unit}",
  unit: Object.freeze({ squares: "sq", rounds: "rds" }),
  inFight: "In a fight they sort out their own potions and gear. Nobody asked you to help.",
  reason: Object.freeze({
    inFight: "the fight runs itself",
    downed: "downed, and not drinking",
    noPotions: "no potions left",
    fullHealth: "already at full HP",
    live: "already working, {n} squares left",
    armed: "already armed",
    cooling: "cooling for {n} squares",
    leaderOnly: "Only the one in front can use this. It moves or leads the party.",
    wantsTarget: "needs a foe to aim at",
  }),
});

/**
 * companyItemsModel(state, idx) — Phase 89 (ITEM-07, plan 07): the ONE pure
 * view model for what Joiner `state.party[idx]` carries, read by the Company
 * panel and nothing else, so every row, label and enabled state is decided
 * here and testable in node. It restates no rule: each refusal mirrors the
 * engine's own memberUseItem / memberUseWorn ladder (noMember for a downed
 * Joiner, inCombat, noPotions, fullHealth; per worn item leaderOnly
 * (MEMBER_LEADER_KINDS), combatOnly (TARGETED_KINDS outside a fight),
 * cooldown / a live record (isReady)), in the engine's own order.
 *
 * Returns `{ armour, potions, worn, inFight }`:
 *   - armour: `{ name, ar, left, max, destroyed }` from the sheet's armour
 *     fields, or null when it wears none;
 *   - potions: `{ n, canDrink, reason }` (`reason` null when it can drink);
 *   - worn: one row per worn slot in WORN_SLOTS order,
 *     `{ slot, name, effect, status: "ready" | "live" | "cooling", statusText,
 *     left, canUse, reason }` (`effect` is the item's own itemStatLines
 *     effect text, `left` the record's count or null);
 *   - inFight: a fight is on (every canDrink / canUse is false: a Joiner
 *     handles its own items then, engine/combat.js#alliesTurn).
 * A bad index, a missing state, a sheet with no worn map, timers or potions
 * field gives the empty model and never throws. Pure: no rng, no mutation.
 */
export function companyItemsModel(state, idx) {
  const inFight = !!(state && typeof state === "object" && state.combat);
  const empty = () => ({ armour: null, potions: { n: 0, canDrink: false, reason: COMPANY_COPY.reason.noPotions }, worn: [], inFight });
  try {
    const party = state && typeof state === "object" && Array.isArray(state.party) ? state.party : null;
    const sheet = party && Number.isInteger(idx) && idx >= 0 ? party[idx] : null;
    if (!sheet || typeof sheet !== "object") return empty();
    const downed = sheet.status === "downed";
    const R = COMPANY_COPY.reason;

    let armour = null;
    if (sheet.armor && sheet.armor !== "Nothing" && sheet.ar > 0) {
      const left = Math.max(0, Number(sheet.armorWP) || 0);
      armour = { name: String(sheet.armor), ar: sheet.ar, left, max: Number(sheet.armorMax) || 0, destroyed: left <= 0 };
    }

    const n = sheet.potions > 0 ? sheet.potions : 0;
    const drinkWhy = inFight ? R.inFight : downed ? R.downed : !(n > 0) ? R.noPotions : !(sheet.wp < sheet.maxWP) ? R.fullHealth : null;
    const potions = { n, canDrink: drinkWhy === null, reason: drinkWhy };

    const worn = [];
    const wornMap = sheet.worn && typeof sheet.worn === "object" ? sheet.worn : {};
    const timers = sheet.timers && typeof sheet.timers === "object" ? sheet.timers : {};
    for (const slot of WORN_SLOTS) {
      const it = wornMap[slot];
      if (!it || typeof it !== "object") continue;
      const act = activationFor(it);
      const id = itemTimerId(it);
      const rec = id && timers[id] && typeof timers[id] === "object" ? timers[id] : null;
      const halfArmed = act?.kind === "half" && sheet.halfNext && typeof sheet.halfNext === "object" && sheet.halfNext.slot === slot;
      let status = "ready";
      if (rec) status = rec.phase === "effect" && rec.left > 0 ? "live" : "cooling";
      if (halfArmed) status = "live";
      const left = rec && typeof rec.left === "number" ? remaining(sheet, id) : null;
      const unit = rec && rec.cadence === "rounds" ? COMPANY_COPY.unit.rounds : COMPANY_COPY.unit.squares;
      const statusText = halfArmed ? COMPANY_COPY.armed
        : status === "ready" ? COMPANY_COPY.ready
        : status === "live" ? COMPANY_COPY.live.replace("{n}", left).replace("{unit}", unit)
        : COMPANY_COPY.cooling.replace("{n}", left).replace("{unit}", unit);
      const kind = act ? act.kind : null;
      const why = inFight ? R.inFight
        : downed ? R.downed
        : !act ? R.wantsTarget
        : MEMBER_LEADER_KINDS.includes(kind) ? R.leaderOnly
        : TARGETED_KINDS.has(kind) ? R.wantsTarget
        : halfArmed ? R.armed
        : status === "live" ? R.live.replace("{n}", left)
        : status === "cooling" ? R.cooling.replace("{n}", left)
        : null;
      const effect = itemStatLines(it, sheet).find((l) => l.key === "effect")?.text ?? "";
      worn.push({ slot, name: String(it.n ?? slot), effect, status, statusText, left, canUse: why === null, reason: why });
    }
    return { armour, potions, worn, inFight };
  } catch {
    return empty();
  }
}

// Phase 36 (JOIN-01) — the Company panel's DISMISS confirm. DOM-local
// presentation state, never on S (serializeRun spreads S); one row armed at
// a time; the revert is a setTimeout of DISMISS_CONFIRM_MS, never a CSS
// transition — mirrors gearTab.js's Drop confirm (DROP_CONFIRM_MS /
// dropConfirmRevert / revertDropConfirm()) exactly. Not an encounter
// button, so no guardTap here by design.
const DISMISS_CONFIRM_MS = 3000;
let dismissConfirmRevert = null;
function revertDismissConfirm() { if (!dismissConfirmRevert) return; const r = dismissConfirmRevert; dismissConfirmRevert = null; r(); }
// Member sheet strings (name/sub/race/cls/weapon) are interpolated into the
// Company card's innerHTML — escape them the same way eventNarration.js does.
const escText = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * armourLineFor(armour) — Phase 89 (ITEM-07, plan 07): the Company card's
 * Armour line from companyItemsModel's `armour` ("Leather · AR 6 · 12/15 hp",
 * "Leather · AR 6 · destroyed", or none), in the ITEM_STAT_COPY words the Gear
 * tab and the store use. Pure.
 */
function armourLineFor(armour) {
  if (!armour) return `${COMPANY_COPY.armour}: ${COMPANY_COPY.armourNone}`;
  const wear = armour.destroyed
    ? ITEM_STAT_COPY.text.destroyed
    : ITEM_STAT_COPY.text.wear.replace("{left}", armour.left).replace("{max}", armour.max);
  return `${COMPANY_COPY.armour}: ${armour.name} · ${ITEM_STAT_COPY.text.ar.replace("{n}", armour.ar)} · ${wear}`;
}

/**
 * appendCompanyChips(doc, card, deps, idx) — Phase 89 (ITEM-07, plan 07): the
 * Joiner's live item effects as chips, the same ones (labels, tones, tap text)
 * YOUR LOT and the hero's HUD strip read; deps.memberChipsFor(idx) returns
 * `{ text, tone, label, tapText, flavor }` entries (Phase 96, FLAVOR-04: `flavor`
 * is the optional `{ line, id, name }` spec the rail card leads with, the exact
 * tapText not drawn when it is set; absent means today's card) from the engine's memberConditionsOf
 * (mazeworld.html owns the labels). A tap raises the chip's text through
 * deps.railInfo (the rail is the one feedback surface), never in the panel.
 * No chips, or no deps seam, draws nothing.
 */
function appendCompanyChips(doc, card, deps, idx) {
  const chips = typeof deps.memberChipsFor === "function" ? deps.memberChipsFor(idx) : [];
  if (!Array.isArray(chips) || !chips.length) return;
  const row = doc.createElement("div");
  row.className = "mw-party-chips";
  for (const ch of chips) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "cb-lot-chip";
    btn.dataset.tone = ch.tone === "bad" ? "bad" : "good";
    btn.textContent = String(ch.text ?? "");
    btn.onclick = () => {
      if (typeof deps.railInfo === "function" && typeof ch.tapText === "function") deps.railInfo(String(ch.label ?? ch.text ?? "").toUpperCase(), ch.tapText(), ch.flavor);
    };
    row.appendChild(btn);
  }
  card.appendChild(row);
}

/**
 * appendCompanyItems(doc, card, model, deps, idx) — Phase 89 (ITEM-07, plan
 * 07): the potion row and one row per worn item, from companyItemsModel. Out
 * of a fight an enabled DRINK / USE calls deps.memberUseItem(idx, { potion:
 * true }) / (idx, { slot }) (the engine action memberUseItem through the same
 * dispatch-with-narration seam as DISMISS; the result is told on the rail
 * only); a disabled one shows its one-line reason instead of a button. In a
 * fight the rows stay (what they carry) but there are no buttons, and one line
 * says the fight is automatic.
 */
function appendCompanyItems(doc, card, model, deps, idx) {
  const box = doc.createElement("div");
  box.className = "mw-party-items";
  const addRow = (kind, textHtml, enabled, label, onTap, reason) => {
    const row = doc.createElement("div");
    row.className = "mw-party-item";
    row.dataset.kind = kind;
    const text = doc.createElement("span");
    text.className = "mw-party-item-text";
    text.innerHTML = textHtml;
    row.appendChild(text);
    if (!model.inFight) {
      if (enabled) {
        const bt = doc.createElement("button");
        bt.className = "small mw-party-item-btn";
        bt.textContent = label;
        bt.onclick = onTap;
        row.appendChild(bt);
      } else if (reason) {
        const hint = doc.createElement("span");
        hint.className = "mw-party-hint";
        hint.textContent = reason;
        row.appendChild(hint);
      }
    }
    box.appendChild(row);
  };
  addRow(
    "potions",
    `${escText(COMPANY_COPY.potions)}: <b>${escText(model.potions.n)}</b>`,
    model.potions.canDrink,
    COMPANY_COPY.drink,
    () => deps.memberUseItem?.(idx, { potion: true }),
    model.potions.reason,
  );
  for (const w of model.worn) {
    addRow(
      "worn",
      `<b>${escText(w.name)}</b> · ${escText(w.statusText)}${w.effect ? `<span class="mw-party-effect">${escText(w.effect)}</span>` : ""}`,
      w.canUse,
      COMPANY_COPY.use,
      () => deps.memberUseItem?.(idx, { slot: w.slot }),
      w.reason,
    );
  }
  if (model.inFight) {
    const note = doc.createElement("div");
    note.className = "mw-party-line";
    note.textContent = COMPANY_COPY.inFight;
    box.appendChild(note);
  }
  card.appendChild(box);
}

// 2026-09-17 UAT (user ruling): the party roster is a Hero-tab panel
// (#hero-party / #hero-party-list), reads the engine's own persistent
// roster (state.party) and renders one card per member: name, subclass·
// level, an HP bar (reusing .mw-map-hptrack/.mw-map-hpfill) and a Downed
// chip. Data-driven: the panel is hidden when solo. Called from
// renderHeroTab so member HP stays live through combat: Phase 87 (PARTY-11,
// report #5) the hp now comes from partyHp.js#memberLiveWp (the live fight
// roster entry mid-fight, the sheet otherwise), the same read YOUR LOT uses.
// Phase 36 (JOIN-01) — the card is a real sheet: name · sub/race, then
// class · level, then the HP track, then Weapon/Eats lines, then (outside
// combat) a DISMISS control with the same two-tap inline confirm pattern as
// the Gear tab's Drop. On confirm the deps.dismissJoiner(idx) closure routes
// through the same dispatchWithNarration seam as the Joiner offer's resolve —
// the parting line surfaces on the rail only, never here.
function renderPartyRoster(doc, state, deps) {
  const panel = doc.getElementById("hero-party");
  const host = doc.getElementById("hero-party-list");
  if (!panel || !host) return;
  const party = (state && Array.isArray(state.party)) ? state.party : [];
  panel.hidden = party.length === 0;
  host.innerHTML = "";
  if (!party.length) return;
  party.forEach((m, idx) => {
    const lvl = m.lvl ?? m.level ?? 1;
    const { wp, maxWP, down: downed } = memberLiveWp(state, idx);
    const pct = clamp(wp / maxWP * 100, 0, 100);
    const card = doc.createElement("div");
    card.className = "mw-party-member" + (downed ? " downed" : "");
    // Phase 43 (CLAR-05) — the SAME appetite read as the camp gate and the
    // Hero RATIONS panel; the old inline RACES read is gone.
    const eatsLine = eatsLineFor(m);
    const eatsText = eatsLine.charAt(0).toUpperCase() + eatsLine.slice(1);
    const carried = companyItemsModel(state, idx);
    card.innerHTML =
      `<div class="mw-party-head">
         <span class="mw-party-name">${escText(m.name || "Companion")}</span>
         <span class="mw-party-sub">${escText(m.sub || "")}${m.sub && m.race ? " / " : ""}${escText(m.race || "")}</span>
       </div>
       <div class="mw-party-line">${escText(m.cls || "—")} · ${ROMAN[lvl - 1] || lvl}</div>
       <div class="mw-party-hp-lab">HP <b>${wp}</b>/<b>${maxWP}</b></div>
       <div class="mw-map-hptrack"><div class="mw-map-hpfill${pct < 34 ? " low" : ""}" style="width:${pct}%"></div></div>
       ${downed ? `<span class="fchip fchip-bad mw-party-status">Downed</span>` : ""}
       <div class="mw-party-line">Weapon: ${escText(m.weapon || "—")}</div>
       <div class="mw-party-line">${escText(eatsText)}</div>
       <div class="mw-party-line mw-party-armour">${escText(armourLineFor(carried.armour))}</div>`;
    // Phase 89 (ITEM-07, plan 07): after Eats and Armour, the Joiner's live
    // item chips, its potion row and its worn-item rows; DISMISS stays last.
    appendCompanyChips(doc, card, deps, idx);
    appendCompanyItems(doc, card, carried, deps, idx);
    if (!state.combat) {
      const dismiss = doc.createElement("button");
      dismiss.className = "small mw-party-dismiss";
      dismiss.textContent = "DISMISS";
      const arm = () => {
        revertDismissConfirm();
        const wrap = doc.createElement("span");
        wrap.className = "mw-drop-confirm";
        const label = doc.createElement("span");
        label.textContent = "Send them off?";
        const mkConfirmBtn = (text, onClick) => {
          const bt = doc.createElement("button");
          bt.className = "small";
          bt.textContent = text;
          bt.onclick = onClick;
          return bt;
        };
        const yes = mkConfirmBtn("Yes", () => { revertDismissConfirm(); deps.dismissJoiner?.(idx); });
        const no = mkConfirmBtn("No", () => revertDismissConfirm());
        wrap.appendChild(label); wrap.appendChild(yes); wrap.appendChild(no);
        dismiss.replaceWith(wrap);
        const timer = setTimeout(revertDismissConfirm, DISMISS_CONFIRM_MS);
        const onAnyTap = (e) => { if (!wrap.contains(e.target)) revertDismissConfirm(); };
        doc.addEventListener("pointerdown", onAnyTap, true);
        dismissConfirmRevert = () => {
          clearTimeout(timer);
          doc.removeEventListener("pointerdown", onAnyTap, true);
          if (wrap.isConnected) wrap.replaceWith(dismiss);
        };
      };
      dismiss.onclick = arm;
      card.appendChild(dismiss);
    }
    host.appendChild(card);
  });
}

/**
 * renderHeroTab(host, state, deps) — Phase 47 (SHELL-02), Plan 04: the ONE
 * mount function for the Hero tab (`#screen-hero`) — see this section's head
 * comment for the full write list. Moved verbatim from the classic script's
 * paint() with `host.ownerDocument` replacing `document`, `state`/`state.c`
 * replacing the classic S/c, and direct content/engine imports (ROMAN,
 * strikeDie, heroHitOdds, eff) in place of a presentation bridge. No
 * window/document globals — host, host.ownerDocument and deps only.
 */
export function renderHeroTab(host, state, deps = {}) {
  const doc = host.ownerDocument;
  const c = state.c;

  doc.getElementById("s-level").textContent = "Lvl " + ROMAN[c.level - 1];
  doc.getElementById("s-name").textContent = c.name;
  doc.getElementById("s-tag").textContent = `${c.race} ${c.sub} · ${c.cls}`;
  doc.getElementById("s-wp").textContent = Math.max(0, c.wp);
  doc.getElementById("s-wpmax").textContent = c.maxWP;
  const pct = clamp(c.wp / c.maxWP * 100, 0, 100);
  const fill = doc.getElementById("s-wpfill");
  fill.style.width = pct + "%";
  fill.classList.toggle("low", pct < 34);

  // Phase 39 (GEAR-01), Plan 05 — routed through the engine's own
  // strikeDie(c) directly so the Hero tab shows the weapon's real need
  // modifier and Acuteness's crit-die swap. Phase 74 (ROLL-02): #s-hit now
  // reads the SAME roll-high range helper the sheet's own TO HIT stat row
  // reads above (src/browser/rollOdds.js) — the two can never disagree.
  doc.getElementById("s-die").textContent = "d" + strikeDie(c);
  doc.getElementById("s-hit").textContent = heroHitOdds(state).text;
  // Phase 79 (Plan 09; todo 2026-09-25): the damage line reads the engine's
  // own terms (engine/derived.js#weaponDamageTerms — the weapon row, level²,
  // every other bonus, the Sorcerer's cap), the same ones weaponDamage rolls
  // with, so Heft, Master of Arms, might and a Guard's early penalty all
  // show. A negative sum reads with U+2212; a capped arm names its cap.
  doc.getElementById("s-dmg").textContent = damageLine(c);
  const R = RACES[c.race];
  // RULES-11 (Phase 75.2, Plan 03): the hero's size, read from the SAME
  // sizeRowFor(c) characterSheetViewModel's stats row uses — skipped
  // silently when the node is absent, like any optional node in this
  // function.
  const sizeEl = doc.getElementById("s-size");
  if (sizeEl) sizeEl.textContent = sizeRowFor(c).text;
  // Phase 28 (ARMOR-02): durability + the cloak's effective plate come from
  // the shared formatter — this HUD line never showed durability before,
  // which was the reported "the line says wear, the panel shows no damage" bug.
  const armorD = armorDisplay(c);
  doc.getElementById("s-arm").textContent = armorD.line;
  doc.getElementById("s-int").textContent = c.intel;
  doc.getElementById("s-sp").textContent = Math.round(c.sp);
  doc.getElementById("s-next").textContent = c.level >= 5 ? "—" : THRESHOLDS[c.level];
  doc.getElementById("s-cost").textContent = upkeep(c) + " hp/day";

  // Phase 43 (CLAR-03/05) — the Hero RATIONS panel; the SAME read
  // engine/movement.js#nightlyEats/eatsFor and the Make Camp gate use.
  const rv = rationsViewModel(state);
  doc.getElementById("s-rations").textContent = rv.line;
  doc.getElementById("s-rations-n").textContent = rv.carriedText;

  // Phase 97.1 (FLAVOR-07): the race's RACES note is a number-bearing rulebook
  // sentence that repeats the dossier. With a flavour line for the race the
  // trait line is the temperament sentence alone and the note is not drawn; a
  // race with no flavour line keeps the note.
  const traitEl = doc.getElementById("s-trait");
  const traitSentence = `<b>${c.temperament}</b>, driven by <b>${c.motive.toLowerCase()}</b>, afraid of <b>${c.phobia.toLowerCase()}</b>.`;
  if (flavorOfIdentity("race", c.race)) {
    traitEl.innerHTML = traitSentence;
  } else {
    traitEl.innerHTML = `${traitSentence} ${R.note}`;
  }

  // special skills
  const sk = doc.getElementById("s-skills");
  const table = skillTable(c.cls);
  const owned = Object.keys(c.skills || {});
  // VOX-05 (Phase 79, Plan 09): the chargen value-point budget in words —
  // the bare "12/12 vp" named a unit the game never explains.
  doc.getElementById("s-vp").textContent =
    table ? `${(c.cls === "Fighter" ? 8 : 12) - (c.vp || 0)} of ${c.cls === "Fighter" ? 8 : 12} points spent` : "none";
  sk.innerHTML = "";
  if (!owned.length) {
    const li = doc.createElement("li");
    li.className = "none";
    li.textContent = c.cls === "Magic User" ? "A Magic User has spells instead." : "No skills bought.";
    sk.appendChild(li);
  } else for (const n of owned) {
    const s = table && table[n];
    const li = doc.createElement("li");
    const shownTxt = s ? (c.skills[n] === 2 && s.txt2 ? s.txt2 : s.txt) : "";
    // Phase 97.1 (FLAVOR-07): a skill reads its flavour line alone; the exact text (txt, or txt2 at level two) is not drawn.
    // Since 96-12 that holds for the active skills too; only a skill the lookup does not know (a tampered save) keeps
    // today's markup exactly.
    const skillFlavor = s ? flavorOfSkill(n) : "";
    if (skillFlavor) {
      const nameEl = doc.createElement("b");
      nameEl.textContent = `${n}${c.skills[n] === 2 ? " ✦" : ""}`;
      li.appendChild(nameEl);
      const flavorEl = doc.createElement("i");
      flavorEl.textContent = skillFlavor;
      li.appendChild(flavorEl);
    } else {
      li.innerHTML = `<b>${n}${c.skills[n] === 2 ? " ✦" : ""}</b><i>${shownTxt}</i>`;
    }
    sk.appendChild(li);
  }

  renderAbilityRows(doc, state);

  // the Maze Master's notes on whoever is currently walking around down there
  doc.getElementById("doss-who").textContent = `${c.race} ${c.sub}`;
  const doss = doc.getElementById("doss");
  doss.innerHTML = "";
  // VOX-04 (Phase 79, Plan 03): the Race and Subclass notes each end with
  // the mechanical footer (identityFooter.js#footerLines); the Class note
  // carries none (VOX-04 names sub-classes and races).
  for (const [label, kind, who, text, footer] of [
    ["Race", "race", c.race, RACE_NOTE[c.race], footerLines("race", c.race)],
    ["Class", "class", c.cls, CLASS_NOTE[c.cls], []],
    ["Subclass", "sub", c.sub, SUB_NOTE[c.sub], footerLines("sub", c.sub)]
  ]) {
    const sec = doc.createElement("section");
    // Phase 97.1 (FLAVOR-07): the flavour line alone; today's note and the
    // footer lines are not drawn. No flavour line (a name a tampered save could
    // hold) keeps today's markup exactly. The nodes are built with
    // createElement + textContent, never innerHTML.
    const flavor = flavorOfIdentity(kind, who);
    if (flavor) {
      const h = doc.createElement("h3");
      h.textContent = label;
      const w = doc.createElement("p");
      w.className = "who";
      w.textContent = who;
      const f = doc.createElement("p");
      f.textContent = flavor;
      sec.appendChild(h);
      sec.appendChild(w);
      sec.appendChild(f);
    } else {
      sec.innerHTML = `<h3>${label}</h3><p class="who">${who}</p><p>${text || ""}</p>`;
      appendFooter(doc, sec, footer);
    }
    doss.appendChild(sec);
  }

  // 04-DR10: the HERO tab's Grimoire.
  renderGrimoire(doc, state, deps);

  renderPartyRoster(doc, state, deps);
}
