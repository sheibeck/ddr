// src/browser/viewModels.js
//
// DOM-free, pure view-models locking the engine→screen data contract for the
// Wave-5 screens (04-08) before any DOM exists (UX-04, UX-05). Every binding
// reads the REAL GameState.c + engine/derived.js — per 04-RESEARCH.md
// Pitfall 1, never the design mockup's throwaway state-object field names.
// No DOM, no Math.random, no rng draws that touch the live state's rngState.

import { WEAPONS, ARMORS, BAGS } from "../../content/index.js";
import { armorSoak, takesBagSlot } from "../../engine/derived.js";
import { weaponRefusalReason, armorRefusalReason, weaponUpgradeDelta, armorUpgradeDelta, bagCap } from "../../engine/items.js";

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
 * code. Mirrors src/browser/narrationLines.js's EQUIP_REJECT_TEXT wording without
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
 * USABLE_COPY — Phase 43 (CLAR-02): every player-facing string `usableBy`
 * (below) builds from — a frozen object like ITEM_STATE_COPY/ABILITY_VIEW_COPY
 * elsewhere in this module, so the voice scan and the hp-not-wp guard can
 * both walk it as a single leaf group.
 */
export const USABLE_COPY = Object.freeze({
  F: "Fighters",
  T: "Thieves",
  M: "Magic Users",
  usable: "(usable by {who})",
  notYou: "(usable by {who} — not you)",
  heft: "(usable by {who} — and a Thief with Heft)",
});

/**
 * restrictedClasses(it) — Phase 43 (CLAR-02): the raw F/T/M letters string a
 * weapon/armor/staff item is restricted to, or `null` when the item carries
 * no class restriction at all (an "FTM" weapon/armor, or any other kind —
 * cloak/jewel/potion/tool/bag). A staff is Magic User only (mirrors
 * engine/items.js#autoWearSlot's `it.kind === "staff" && c.cls !== "Magic
 * User"` gate — never restated as a separate rule, only the class letter is
 * local here). Null-safe on a sparse/legacy item (no `base`, an unknown
 * `armor` name). Pure, no rng, no mutation.
 */
function restrictedClasses(it) {
  if (!it || typeof it !== "object") return null;
  let letters = null;
  if (it.kind === "weapon") {
    letters = WEAPONS[it.base]?.cls ?? null;
  } else if (it.kind === "armor") {
    letters = it.cls ?? ARMORS.find((a) => a.name === it.armor)?.cls ?? null;
  } else if (it.kind === "staff") {
    letters = "M";
  }
  return letters && letters !== "FTM" ? letters : null;
}

/**
 * usableBy(it, c = null) — Phase 43 (CLAR-02): the ONE "(usable by …)" rule
 * for the FIND card, the victory LOOT screen (via `lootCompare.usable`), and
 * store rows (Plan 04 bridges it as `window.__mzUsableBy`). Legality is the
 * engine's OWN `weaponRefusalReason`/`armorRefusalReason` (engine/items.js)
 * for weapons/armor and the staff Magic-User gate for a staff — never a
 * restated class rule; only the display text lives here. Without a hero
 * (`c === null`) it names who CAN use the item; with one, it additionally
 * says whether THIS hero can — "— not you" when illegal, or "— and a Thief
 * with Heft" for the one case where a Thief with the Heft skill can legally
 * wear armor a letter-only read would call Fighter-only. Returns `""` for an
 * unrestricted item or any kind this rule does not gate. Pure, no rng, no
 * DOM, never throws on a sparse item.
 */
export function usableBy(it, c = null) {
  const letters = restrictedClasses(it);
  if (!letters) return "";
  const who = letters
    .split("")
    .map((l) => USABLE_COPY[l] ?? l)
    .join(", ");
  const usable = USABLE_COPY.usable.replace("{who}", who);
  if (!c) return usable;

  let legal;
  if (it.kind === "weapon") legal = weaponRefusalReason(c, it) === null;
  else if (it.kind === "armor") legal = armorRefusalReason(c, it) === null;
  else if (it.kind === "staff") legal = c.cls === "Magic User";
  else legal = true;

  if (!legal) return USABLE_COPY.notYou.replace("{who}", who);
  const heroLetter = c.cls === "Fighter" ? "F" : c.cls === "Thief" ? "T" : "M";
  if (!letters.includes(heroLetter)) return USABLE_COPY.heft.replace("{who}", who);
  return usable;
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
        ? `+${delta.toFixed(1)} a swing`
        : "not an upgrade";
    // Phase 43 (CLAR-02, additive field): the same "(usable by …)" suffix
    // the FIND card and store rows show, read from the ONE usableBy rule.
    return { kind: "weapon", legal, reason, delta, upgrade, equipNow, line, sub: it.txt ?? "", usable: usableBy(it, c) };
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
    // Phase 43 (CLAR-02, additive field)
    return { kind: "armor", legal, reason, delta, upgrade, equipNow, line, sub, usable: usableBy(it, c) };
  }

  if (it.kind === "bag") {
    const line = `${BAGS[it.tier]?.slots ?? "?"} slots — you carry ${bagCap(c) === Infinity ? "no bag" : bagCap(c)}`;
    // sub is deliberately blank — it.txt would just repeat the slot count.
    // Phase 43 (CLAR-02, additive field): a bag is never class-restricted, so usable is always "".
    return { kind: "bag", legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line, sub: "", usable: usableBy(it, c) };
  }

  // Phase 43 (CLAR-02, additive field): the fallthrough (jewel/cloak/potion/tool/etc) is never class-restricted.
  return { kind: it.kind, legal: true, reason: null, delta: null, upgrade: null, equipNow: false, line: it.txt ?? "", sub: "", usable: usableBy(it, c) };
}

/**
 * dropShelfItems(c) — Phase 43 (CLAR-04): the bag-full drop prompt's ONE
 * source list — slot-consuming BAG items only (the same bag-free rule as
 * `engine/derived.js#takesBagSlot` — potions, scrolls, bags — kept in
 * lock-step with `slotItems` by test), with the true `c.items` index so
 * `dropItem(i)` addresses the right entry. Never a worn slot item, never the
 * wielded weapon or worn armor (those are not in `c.items` at all). Returns
 * the SAME item references as `c.items` (no clone); never mutates `c`.
 * Defensive against a missing/non-array `c.items` (returns `[]`). Pure, no
 * rng.
 */
export function dropShelfItems(c) {
  return (c && Array.isArray(c.items) ? c.items : [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => takesBagSlot(it));
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
