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
import { strikeDie, upkeep, skill, eff, intelBonus, spellLevelFor, schoolGate, potionMight } from "../../engine/derived.js";
import { maxCharges, nightlyEats, eatsFor } from "../../engine/movement.js";
import { abilityRoundsLeft } from "../../engine/abilities.js";
import { isReady } from "../../engine/effects.js";
import { armorDisplay } from "./viewModels.js";
import { heroHitOdds } from "./rollOdds.js";

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
    // Phase 74 (ROLL-02, roll-display honesty): roll-HIGH — a strike lands
    // on the current strike die's own winning range, so the sheet shows the
    // real range from the engine's own heroHitOdds(state) (src/browser/
    // rollOdds.js), Afraid included ("16–20 (d20)"), never a re-derived
    // formula. Supersedes the Phase 31 low-roll "1–N" reading (that era's
    // engine still rolled low; Phase 73 flipped the engine to roll-high).
    { key: "toHit", label: "TO HIT", value: heroHitOdds(state).text },
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

// Phase 38 (ABIL-01/04) — the Hero-tab abilities list, mirroring the
// s-skills block's position immediately above (special skills stays
// passives-only, byte-identical). createElement/textContent only — T-38-11
// (no innerHTML in this region) — reading characterSheetViewModel(state)
// directly so the READY/N ROUNDS/ONCE A FIGHT · USED / cd N ROUNDS/once a
// fight state-suffix rule lives in exactly one place.
function renderAbilityRows(doc, state) {
  const c = state.c;
  const ul = doc.getElementById("s-abilities");
  if (!ul) return;
  ul.replaceChildren();
  if (c.cls === "Magic User") {
    const li = doc.createElement("li");
    li.className = "none";
    li.textContent = "Spells are the trick.";
    ul.appendChild(li);
    return;
  }
  const rows = characterSheetViewModel(state).abilities;
  for (const row of rows) {
    const li = doc.createElement("li");
    const b = doc.createElement("b");
    b.textContent = row.name;
    li.appendChild(b);
    const tag = doc.createElement("small");
    tag.textContent = row.source === "pool" ? "trick" : "special skill · active";
    li.appendChild(tag);
    const desc = doc.createElement("i");
    desc.textContent = row.description;
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
    info.innerHTML = `<b><span class="grim-lvl">L${row.lvl}</span>${row.name}</b><i>${row.txt}</i>`;
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

// 2026-09-17 UAT (user ruling): the party roster is a Hero-tab panel
// (#hero-party / #hero-party-list), reads the engine's own persistent
// roster (state.party) and renders one card per member: name, subclass·
// level, an HP bar (reusing .mw-map-hptrack/.mw-map-hpfill) and a Downed
// chip. Data-driven: the panel is hidden when solo. Called from
// renderHeroTab so member HP stays live through combat.
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
    const maxWP = m.maxWP || 1;
    const wp = Math.max(0, m.wp ?? 0);
    const pct = clamp(wp / maxWP * 100, 0, 100);
    const downed = m.status === "downed" || wp <= 0;
    const card = doc.createElement("div");
    card.className = "mw-party-member" + (downed ? " downed" : "");
    // Phase 43 (CLAR-05) — the SAME appetite read as the camp gate and the
    // Hero RATIONS panel; the old inline RACES read is gone.
    const eatsLine = eatsLineFor(m);
    const eatsText = eatsLine.charAt(0).toUpperCase() + eatsLine.slice(1);
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
       <div class="mw-party-line">${escText(eatsText)}</div>`;
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
  const w = WEAPONS[c.weapon] || WEAPONS["Club"];
  const R = RACES[c.race];
  const bonus = c.prof + c.magicWpn + (R.dmg || 0) + (R.wpnBonus || 0) + eff(c, "dmg");
  doc.getElementById("s-dmg").textContent = `${c.level}² + ${w.lab}${bonus ? " + " + bonus : ""}`;
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

  doc.getElementById("s-trait").innerHTML =
    `<b>${c.temperament}</b>, driven by <b>${c.motive.toLowerCase()}</b>, afraid of <b>${c.phobia.toLowerCase()}</b>. ${R.note}`;

  // special skills
  const sk = doc.getElementById("s-skills");
  const table = skillTable(c.cls);
  const owned = Object.keys(c.skills || {});
  doc.getElementById("s-vp").textContent =
    table ? `${(c.cls === "Fighter" ? 8 : 12) - (c.vp || 0)}/${c.cls === "Fighter" ? 8 : 12} vp` : "none";
  sk.innerHTML = "";
  if (!owned.length) {
    const li = doc.createElement("li");
    li.className = "none";
    li.textContent = c.cls === "Magic User" ? "A Magic User has spells instead." : "No skills bought.";
    sk.appendChild(li);
  } else for (const n of owned) {
    const s = table && table[n];
    const li = doc.createElement("li");
    li.innerHTML = `<b>${n}${c.skills[n] === 2 ? " ✦" : ""}</b><i>${s ? (c.skills[n] === 2 && s.txt2 ? s.txt2 : s.txt) : ""}</i>`;
    sk.appendChild(li);
  }

  renderAbilityRows(doc, state);

  // the Maze Master's notes on whoever is currently walking around down there
  doc.getElementById("doss-who").textContent = `${c.race} ${c.sub}`;
  const doss = doc.getElementById("doss");
  doss.innerHTML = "";
  for (const [label, who, text] of [
    ["Race", c.race, RACE_NOTE[c.race]],
    ["Class", c.cls, CLASS_NOTE[c.cls]],
    ["Subclass", c.sub, SUB_NOTE[c.sub]]
  ]) {
    const sec = doc.createElement("section");
    sec.innerHTML = `<h3>${label}</h3><p class="who">${who}</p><p>${text || ""}</p>`;
    doss.appendChild(sec);
  }

  // 04-DR10: the HERO tab's Grimoire.
  renderGrimoire(doc, state, deps);

  renderPartyRoster(doc, state, deps);
}
