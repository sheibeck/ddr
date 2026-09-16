// src/browser/viewModels.js
//
// DOM-free, pure view-models locking the engine→screen data contract for the
// Wave-5 screens (04-08) before any DOM exists (UX-04, UX-05). Every binding
// reads the REAL GameState.c + engine/derived.js — per 04-RESEARCH.md
// Pitfall 1, never the design mockup's throwaway state-object field names.
// No DOM, no Math.random, no rng draws that touch the live state's rngState.

import { RACES, WEAPONS, FIGHTER_SKILLS, THIEF_SKILLS, THRESHOLDS, SPELLS, BAGS } from "../../content/index.js";
import { strikeDie, toHit, upkeep, skill, eff, canCast, intelBonus, armorSoak } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { weaponRefusalReason, armorRefusalReason, weaponUpgradeDelta, armorUpgradeDelta, bagCap, canStow, slotItems } from "../../engine/items.js";

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
 * might + Kata/Heft skills + eff("dmg") + Guard/Sorcerer adjustments) but
 * resolving the weapon's dice notation as a [min, max] range instead of
 * drawing from an rng — so the sheet NEVER advances GameState.rngState
 * (T-04-06). Reads only `c`.
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
  if (skill(c, "Kata")) flat += c.level;
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
 * armorDisplay(c) — Phase 28 (ARMOR-02/04): the ONE render-ready description
 * of the character's effective armor — the sheet tile, the HUD armor line,
 * the gear worn row and the store repair row all call it (Plan 03 bridges it
 * onto the classic script's global namespace). It reads `armorSoak(c)` (engine/derived.js)
 * so it can never disagree with the combat soak site — the same
 * damageBracket <-> weaponDamage single-source pattern this file already
 * follows. Never reads the DOM, draws no rng. `magic` means the Cloak of
 * Armor is carried — it counts for ANY class, no Fighter gate (user
 * decision, Phase 28). `current`/`max` are always the WORN piece's pool,
 * because the cloak's plate never wears. Returns a plain object:
 * { label, ar, current, max, worn, destroyed, magic, sub, wornSub, under, line }.
 */
export function armorDisplay(c) {
  const av = armorSoak(c);
  const worn = Boolean(c.armor && c.armor !== "Nothing" && c.ar > 0);
  const destroyed = worn && c.armorWP <= 0;
  const current = worn ? c.armorWP : 0;
  const max = worn ? c.armorMax : 0;
  const ar = av.ar;
  const magic = av.magic;
  const label = magic ? "Cloak of Armor" : worn ? c.armor : "Nothing";
  const wornSub = !worn
    ? "AR 0"
    : destroyed
      ? `AR ${c.ar} · destroyed`
      : `AR ${c.ar} · ${current}/${max} hp`;
  const sub = magic ? `AR ${ar} · magic plate, never wears` : wornSub;
  const under = !magic
    ? null
    : !worn
      ? "under the cloak: nothing"
      : destroyed
        ? `under the cloak: ${c.armor}, destroyed`
        : `under the cloak: ${c.armor} ${current}/${max} hp`;
  const line = `${label} · ${sub}`;
  return { label, ar, current, max, worn, destroyed, magic, sub, wornSub, under, line };
}

/**
 * bagArmorText(it) — Phase 28 (ARMOR-03): renders a bag armor row from the
 * item's own remaining durability (`left`, falling back to `wp` for a fresh
 * piece that has never been worn — tolerant of pre-v1.3 saves that carry no
 * `left` field at all).
 */
export function bagArmorText(it) {
  const left = it.left ?? it.wp;
  return left > 0 ? `AR ${it.ar} · ${left}/${it.wp} hp` : `AR ${it.ar} · destroyed`;
}

/** classNames(letters) — Phase 29 (LOOT-03): "FTM"-style class-letter string
 * -> a human-readable class-name list joined with " or " (e.g. "F" ->
 * "Fighter", "FT" -> "Fighter or Thief"). Unknown letters pass through
 * verbatim rather than throwing — defensive for content it can't foresee. */
function classNames(letters) {
  const NAME = { F: "Fighter", T: "Thief", M: "Magic User" };
  return (letters || "")
    .split("")
    .map((l) => NAME[l] || l)
    .join(" or ");
}

/** refusalText(reason, clsLetters) — Phase 29 (LOOT-03): the loot screen's
 * "can't use (...)" fragment for a weaponRefusalReason/armorRefusalReason
 * code. Mirrors src/browser/toasts.js's EQUIP_REJECT_TEXT wording without
 * importing it (that table also covers notEquippable/notBetter, which never
 * reach lootCompare's illegal-gear branch). */
function refusalText(reason, clsLetters) {
  switch (reason) {
    case "wrongClass":
    case "tooHeavy":
      return `${classNames(clsLetters)} only`;
    case "acrobat":
      return "Acrobat: dagger only";
    case "noArmor":
      return "your kind wears no armour";
    case "woodsman":
      return "no mail or plate for a Woodsman";
    default:
      return "not for you";
  }
}

/**
 * lootCompare(c, it) — Phase 29 (LOOT-03): the ONE compare-to-equipped
 * verdict for a loot/find item, mirroring armorDisplay's single-source
 * pattern — the verdict is takeItem's own weaponUpgradeDelta/
 * armorUpgradeDelta (engine/items.js), never a restated formula, so the
 * screen can never disagree with what the engine would actually do. Returns
 * a plain object `{ kind, legal, reason, delta, upgrade, equipNow, line,
 * sub }`; the shell joins `line`/`sub` itself (lootCompare never joins
 * them). Pure, no rng, no mutation.
 */
export function lootCompare(c, it) {
  if (it.kind === "weapon") {
    const reason = weaponRefusalReason(c, it);
    const delta = weaponUpgradeDelta(c, it);
    const legal = reason === null;
    const upgrade = delta > 0;
    const equipNow = legal && upgrade;
    const line = !legal
      ? `can't use (${refusalText(reason, WEAPONS[it.base]?.cls ?? "")})`
      : upgrade
        ? `+${delta} damage`
        : "not an upgrade";
    return { kind: "weapon", legal, reason, delta, upgrade, equipNow, line, sub: it.txt ?? "" };
  }

  if (it.kind === "armor") {
    const reason = armorRefusalReason(c, it);
    const delta = armorUpgradeDelta(c, it);
    const legal = reason === null;
    const upgrade = delta > 0;
    const equipNow = legal && upgrade;
    const line = !legal
      ? `can't use (${refusalText(reason, it.cls ?? "")})`
      : `AR ${it.ar} vs your AR ${c.ar} · ${upgrade ? "upgrade" : "not an upgrade"}`;
    // The AR is already in `line` above — sub carries only the durability
    // pool (Phase 28's tolerant `left ?? wp` read for a fresh, never-worn drop).
    const left = it.left ?? it.wp;
    const sub = left > 0 ? `${left}/${it.wp} hp` : "destroyed";
    return { kind: "armor", legal, reason, delta, upgrade, equipNow, line, sub };
  }

  if (it.kind === "bag") {
    const line = `${BAGS[it.tier]?.slots ?? "?"} slots — you carry ${bagCap(c) === Infinity ? "no bag" : bagCap(c)}`;
    // sub is deliberately blank — it.txt would just repeat the slot count.
    return { kind: "bag", legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line, sub: "" };
  }

  return { kind: it.kind, legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line: it.txt ?? "", sub: "" };
}

/**
 * bagUsage(c) — Phase 29 (LOOT-04): the ONE "used / slots" readout the
 * gear panel, find card, loot screen and store display all read (Plan 03
 * bridges it as window.__mzBagUsage). Pure, no rng.
 */
export function bagUsage(c) {
  const have = slotItems(c).length;
  const cap = bagCap(c);
  const slots = cap === Infinity ? null : cap;
  return { have, slots, full: !canStow(c), text: slots ? `${have} / ${slots}` : have ? `${have}` : "" };
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
    { key: "toHit", label: "TO HIT", value: `${toHit(state)}+` },
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
  };
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
      } else if (!canCast(state, sp)) {
        disabledReason = "Not ready yet";
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
        combatOnly: !!sp.combatOnly,
        castable,
        disabledReason,
      };
    })
    .sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));

  return { rows, hasSpells: rows.length > 0, isCaster: c.cls === "Magic User" };
}

// Matches the roll-detail span src/browser/engineAdapter.js's formatEvent()
// already embeds inline (e.g. `<span class="roll">7</span>`).
const ROLL_SPAN_RE = /<span class="roll">([\s\S]*?)<\/span>/;

/**
 * oracleLogViewModel(entries, diceMode) — the ORACLE tab's (and, per
 * 04-UI-SPEC.md, the combat log's) render-ready rows. `entries` is the
 * formatEvents()-shaped array of HTML narration strings, accumulated
 * oldest-first; this returns rows newest-first. Each row is
 * {narration, roll, revealable, revealedByDefault}:
 *   - a line with no roll span: {roll: null, revealable: false, revealedByDefault: false}
 *     under every diceMode (no reveal affordance to show).
 *   - diceMode 'on tap' (default): revealable true, hidden until tapped.
 *   - diceMode 'always': revealable true, revealed by default.
 *   - diceMode 'never': roll omitted (null), not revealable.
 * Pure/DOM-free — no reveal STATE is tracked here, only the gating flags the
 * renderer needs to decide what to show.
 */
export function oracleLogViewModel(entries, diceMode) {
  const rows = entries.map((entry) => {
    const html = typeof entry === "string" ? entry : entry && entry.html;
    const match = ROLL_SPAN_RE.exec(html || "");
    const roll = match ? match[1] : null;
    const narration = match ? (html.slice(0, match.index) + html.slice(match.index + match[0].length)).trim() : (html || "").trim();

    if (roll === null) {
      return { narration, roll: null, revealable: false, revealedByDefault: false };
    }
    if (diceMode === "never") {
      return { narration, roll: null, revealable: false, revealedByDefault: false };
    }
    if (diceMode === "always") {
      return { narration, roll, revealable: true, revealedByDefault: true };
    }
    // diceMode === "on tap" (default): hidden until tapped.
    return { narration, roll, revealable: true, revealedByDefault: false };
  });
  return rows.reverse();
}
