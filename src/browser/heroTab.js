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
import { strikeDie, toHit, upkeep, skill, eff, intelBonus, spellLevelFor, schoolGate, potionMight } from "../../engine/derived.js";
import { maxCharges, nightlyEats, eatsFor } from "../../engine/movement.js";
import { abilityRoundsLeft } from "../../engine/abilities.js";
import { isReady } from "../../engine/effects.js";
import { armorDisplay } from "./viewModels.js";

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
 * character's current weapon, mirroring engine/derived.js's weaponDamage()
 * modifier stack EXACTLY (level^2 + prof + magicWpn + race dmg/wpnBonus +
 * might + Heft skill + eff("dmg") + Guard/Sorcerer adjustments) but
 * resolving the weapon's dice notation as a [min, max] range instead of
 * drawing from an rng — so the sheet NEVER advances GameState.rngState
 * (T-04-06). Reads only `c`. Phase 38 (ABIL-02): the retired Kata passive's
 * flat damage term is gone (Kata is now an active, resolved per-strike via
 * the abilityStrike descriptor, not a standing bonus this bracket can show).
 */
function damageBracket(c) {
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const R = RACES[c.race];

  const diceMin = w.dice.n * 1 + w.dice.bonus;
  const diceMax = w.dice.n * w.dice.sides + w.dice.bonus;
  const baseMin = w.halve ? Math.ceil(diceMin / 2) : diceMin;
  const baseMax = w.halve ? Math.ceil(diceMax / 2) : diceMax;

  let flat = c.level * c.level + c.prof + c.magicWpn;
  if (R.dmg) flat += R.dmg;
  if (R.wpnBonus) flat += R.wpnBonus;
  if (c.might) flat += c.might;
  // Phase 39 (GEAR-02): a live Strength/Enlarge potion effect (c.timers),
  // additive alongside the spell's own c.might.
  flat += potionMight(c);
  if (skill(c, "Heft")) flat += 2;
  flat += eff(c, "dmg");
  if (c.sub === "Guard" && c.level < 4) flat -= 4 - c.level;

  let min = Math.max(1, baseMin + flat);
  let max = Math.max(1, baseMax + flat);
  if (c.sub === "Sorcerer") {
    min = Math.min(min, 9);
    max = Math.min(max, 9);
  }
  if (max < min) max = min;
  return { min, max };
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
 * in-combat/out-of-combat state-suffix vocabulary and the two source-
 * provenance tags. A frozen literal object like COMBAT_MENU_COPY/RAIL_COPY
 * elsewhere in this codebase.
 */
export const ABILITY_VIEW_COPY = Object.freeze({
  ready: "READY",
  rounds: "{n} rounds",
  used: "once a fight · used",
  cd: "cd {n} rounds",
  once: "once a fight",
  tagTable: "special skill · active",
  tagPool: "trick",
  noAbilitiesCaster: "Spells are the trick.",
});

/**
 * abilitiesViewFor(c, inCombat) — Phase 38 (ABIL-01/04): characterSheetViewModel's
 * `abilities[]` (Hero tab) — one `{ id, name, description, source, state }`
 * row per `c.abilities` catalog id (`source` is the catalog's own literal
 * "table" | "pool", NOT a display tag — the Hero-tab shell maps that to
 * ABILITY_VIEW_COPY.tagTable/tagPool). `state` is the ONE place the state-
 * suffix rule lives: in combat, READY / "{n} rounds" / "once a fight ·
 * used" (mirrors combatMenu.js#abilityRows' cost rule); out of combat, the
 * ability's OWN declared cooldown length ("cd {n} rounds" / "once a
 * fight") — never a live timer read, since c.timers is combat-scoped and
 * cleared every fight anyway. An id absent from the catalog (a tampered
 * save) is silently dropped. Pure, no rng.
 */
function abilitiesViewFor(c, inCombat) {
  return (c.abilities || [])
    .map((key) => {
      const meta = ABILITY_BY_ID[key];
      if (!meta) return null;
      let state;
      if (inCombat) {
        const id = `ability:${key}`;
        if (isReady(c, id)) state = ABILITY_VIEW_COPY.ready;
        else if (meta.cd === "fight") state = ABILITY_VIEW_COPY.used;
        else state = ABILITY_VIEW_COPY.rounds.replace("{n}", abilityRoundsLeft(c, key));
      } else {
        state = meta.cd === "fight" ? ABILITY_VIEW_COPY.once : ABILITY_VIEW_COPY.cd.replace("{n}", meta.cd);
      }
      return { id: key, name: meta.name, description: meta.txt || "", source: meta.source, state };
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
    // Phase 31 (roll-direction audit Finding 2): LOW-roll-good — a strike
    // lands on d <= toHit, so the sheet shows the hitting range 1-N exactly
    // as the prototype's Hero tab (mazeworld.html: "1-" + toHit()); the old
    // plus suffix implied the opposite polarity (roll-direction audit
    // Finding 2, Phase 31).
    { key: "toHit", label: "TO HIT", value: `1–${toHit(state)}` },
    { key: "damage", label: "DAMAGE", value: `${damage.min}–${damage.max}`, min: damage.min, max: damage.max },
    { key: "armor", label: "ARMOR", value: `${armor.label.toUpperCase()} · ${armor.sub}`, under: armor.under },
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
        return { name, description, tier };
      })
    : [];

  const abilities = abilitiesViewFor(c, !!state.combat);

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
        lvl: sp.lvl,
        txt: sp.txt,
        // Phase 40 (SPELL-01): the niche KEY + its display label, beside the
        // existing txt (which already begins with `nicheLabel + " · "`) — so
        // the shell can group/badge by niche without parsing txt.
        niche: sp.niche,
        nicheLabel: NICHE_LABELS[sp.niche] ?? sp.niche,
        combatOnly: !!sp.combatOnly,
        castable,
        disabledReason,
      };
    })
    .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));

  return { rows, hasSpells: rows.length > 0, isCaster: c.cls === "Magic User" };
}
