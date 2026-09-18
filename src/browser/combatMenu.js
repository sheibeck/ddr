// src/browser/combatMenu.js
//
// Phase 34 (CSCR-05) — the four-action grid (STRIKE / SPELLS-or-ABILITIES /
// ITEMS / SOCIAL) and its submenus, derived from the real GameState. The
// mock's (design/Mazeworld Combat Panel.dc.html) toy engine — its own
// dice, player-controlled joiner turns — is NOT the spec; our engine
// actions, refusals and guards are. Every row is dispatchable regardless
// of `enabled` (CONTEXT: unavailable rows render disabled-styled but stay
// tappable so the engine's own refusal explains) except the `id:"none"`
// placeholder rows, whose `dispatch` is null.
//
// PRESENTATION ONLY, pure module: no DOM/global access, no timers, no
// storage, no rng draws, no mutation of `state` anywhere in this file.

import { SPELLS, ABILITY_BY_ID } from "../../content/index.js";
import { characterSheetViewModel } from "./viewModels.js";
import { canCast, WORN_SLOTS } from "../../engine/derived.js";
import { maxCharges } from "../../engine/movement.js";
import { canParley } from "../../engine/combat.js";
import { abilityRoundsLeft } from "../../engine/abilities.js";
import { isReady } from "../../engine/effects.js";

/** COMBAT_MENU_COPY — every literal string this module emits (voice-scanned by test/unit/combatMenu.test.js). */
export const COMBAT_MENU_COPY = Object.freeze({
  prompt: "PICK YOUR MISTAKE",
  strike: "1 · STRIKE",
  spells: "2 · SPELLS",
  abilities: "2 · ABILITIES",
  items: "3 · ITEMS",
  social: "4 · SOCIAL",
  socialSub: "FLEE · PARLEY",
  noAbilities: "NOTHING UP YOUR SLEEVE",
  noAbilitiesDesc: "Hit it with the pointy end.",
  // Phase 38 (ABIL-01/04) — the melee ABILITIES branch's cost/sub vocabulary.
  abilityReady: "READY",
  abilityUsedUp: "ONCE A FIGHT · USED",
  abilityRound: "1 ROUND",
  abilityRounds: "{n} ROUNDS",
  abilitiesSub: "{ready}/{n} READY",
  noSpells: "NOTHING IN THE GRIMOIRE",
  noSpellsDesc: "Not one spell. Bold.",
  noItems: "NOTHING TO USE",
  noItemsDesc: "The bag is quieter than you are.",
  potion: "POTION",
  potionDesc: "Heals. Wasted at full health.",
  scroll: "SCROLL",
  scrollDesc: "A random spell, read aloud. No refunds.",
  sing: "SING",
  singReady: "READY",
  singDesc: "One song per hundred squares. Pick the moment.",
  flee: "FLEE",
  withdraw: "WITHDRAW",
  withdrawCost: "CLEAN",
  fleeDesc: "Run. They get one swing at your back.",
  withdrawDesc: "They have not noticed you. Leave before they do.",
  parley: "PARLEY",
  parleyDesc: "Talk it down. An insult is permanent.",
  back: "BACK",
});

/**
 * abilityRows(c) — Phase 38 (ABIL-01/04): one row per `c.abilities` catalog
 * id, in `c.abilities` order. Every row is `enabled: true` — CONTEXT's
 * "unavailable rows render disabled-styled but stay tappable" rule applies
 * to SPELLS, not this branch: a tap on cooldown dispatches `useAbility`
 * exactly like a ready one, and the engine's own `abilityRefused { reason:
 * "cooldown" }` lands the canon refusal line in the fight log (a deliberate
 * departure from SPELLS' castable-gated `enabled`). `cost` reads READY /
 * "N ROUND(S)" / the abilityUsedUp copy (a `cd: "fight"` ability that is not
 * ready, regardless of its remaining phase). An id absent from the catalog
 * (a tampered save) is silently dropped. Pure, no rng.
 */
function abilityRows(c) {
  return (c.abilities || [])
    .map((key) => {
      const meta = ABILITY_BY_ID[key];
      if (!meta) return null;
      const id = `ability:${key}`;
      const ready = isReady(c, id);
      let cost;
      if (ready) {
        cost = COMBAT_MENU_COPY.abilityReady;
      } else if (meta.cd === "fight") {
        cost = COMBAT_MENU_COPY.abilityUsedUp;
      } else {
        const left = abilityRoundsLeft(c, key);
        cost = left === 1 ? COMBAT_MENU_COPY.abilityRound : COMBAT_MENU_COPY.abilityRounds.replace("{n}", left);
      }
      return {
        id: `ability-${key}`,
        label: meta.name.toUpperCase(),
        cost,
        desc: meta.txt || "",
        enabled: true,
        dispatch: { type: "useAbility", key },
      };
    })
    .filter(Boolean);
}

/**
 * combatMenuViewModel(state) — `{ prompt, actions, submenus }`. `actions`
 * is always the four grid entries in order (strike, spells|abilities,
 * items, social). `submenus` carries only the slot-2 key that applies
 * ("spells" for a Magic User, "abilities" otherwise) plus "items" and
 * "social". Never throws on `state.combat === null` (a default
 * `{round:1, tracked:false}` combat shape is substituted for the fields
 * this view-model reads).
 */
export function combatMenuViewModel(state) {
  const c = state.c;
  const C = state.combat || { round: 1, tracked: false };
  const sheet = characterSheetViewModel(state);
  const statValue = (key) => {
    const row = sheet.stats.find((s) => s.key === key);
    return row ? row.value : "";
  };
  const strikeSub = `${statValue("toStrike")}, ${statValue("toHit")} to hit · ${statValue("damage")} dmg`;

  const isCaster = c.cls === "Magic User";
  const isBard = c.sub === "Bard";
  const charges = Math.max(0, maxCharges(c) - (c.spellsUsed || 0));
  const known = (c.grimoire || []).length;
  const singLeft = 100 - (state.steps - (c.songAt ?? -999));
  const singReady = isBard && singLeft <= 0;
  const heroName = String(c.name || "YOU").toUpperCase();

  const submenus = {};

  // ─── slot 2: SPELLS (caster) | ABILITIES (Bard's Sing, or the disabled fallback) ─
  let secondAction;
  if (isCaster) {
    secondAction = {
      key: "spells",
      num: 2,
      label: COMBAT_MENU_COPY.spells,
      sub: `${charges} charges left · ${known} known`,
      enabled: true,
      accent: false,
      opens: "spells",
    };
    const spellRows = SPELLS.filter((sp) => (c.grimoire || []).includes(sp.n)).map((sp) => {
      const idx = SPELLS.indexOf(sp);
      return {
        id: `spell-${idx}`,
        label: sp.n.toUpperCase(),
        cost: `LVL ${sp.lvl}`,
        desc: sp.txt || "",
        enabled: canCast(state, sp) && charges > 0,
        dispatch: { type: "castSpell", idx },
      };
    });
    submenus.spells = {
      title: `${heroName} · SPELLS · ${charges} CHARGES`,
      rows: spellRows.length
        ? spellRows
        : [{ id: "none", label: COMBAT_MENU_COPY.noSpells, cost: "", desc: COMBAT_MENU_COPY.noSpellsDesc, enabled: false, dispatch: null }],
    };
  } else if (isBard) {
    secondAction = {
      key: "abilities",
      num: 2,
      label: COMBAT_MENU_COPY.abilities,
      sub: singReady ? "SING · READY" : `SING (${Math.max(0, singLeft)} sq)`,
      enabled: true,
      accent: false,
      opens: "abilities",
    };
    submenus.abilities = {
      title: `${heroName} · ABILITIES`,
      rows: [
        {
          id: "sing",
          label: COMBAT_MENU_COPY.sing,
          cost: singReady ? COMBAT_MENU_COPY.singReady : `${Math.max(0, singLeft)} SQ`,
          desc: COMBAT_MENU_COPY.singDesc,
          enabled: singReady,
          dispatch: { type: "sing" },
        },
        // Phase 38 (ABIL-01): the Bard keeps Sing FIRST (CONTEXT); because a
        // Bard is a Fighter it also rolls abilities, so its own rows follow.
        ...abilityRows(c),
      ],
    };
  } else if (Array.isArray(c.abilities) && c.abilities.length) {
    // Phase 38 (ABIL-01/03/04) — a melee (Fighter/Thief) c with at least one
    // rolled ability. An empty/absent c.abilities falls through to the
    // fallback branch below, byte-identical to before this phase.
    const rows = abilityRows(c);
    const readyCount = rows.filter((r) => r.cost === COMBAT_MENU_COPY.abilityReady).length;
    secondAction = {
      key: "abilities",
      num: 2,
      label: COMBAT_MENU_COPY.abilities,
      sub: COMBAT_MENU_COPY.abilitiesSub.replace("{ready}", readyCount).replace("{n}", rows.length),
      enabled: true,
      accent: false,
      opens: "abilities",
    };
    submenus.abilities = {
      title: `${heroName} · ABILITIES`,
      rows,
    };
  } else {
    secondAction = {
      key: "abilities",
      num: 2,
      label: COMBAT_MENU_COPY.abilities,
      sub: COMBAT_MENU_COPY.noAbilities,
      enabled: false,
      accent: false,
      opens: null,
    };
    submenus.abilities = {
      title: `${heroName} · ABILITIES`,
      rows: [{ id: "none", label: COMBAT_MENU_COPY.noAbilities, cost: "", desc: COMBAT_MENU_COPY.noAbilitiesDesc, enabled: false, dispatch: null }],
    };
  }

  // ─── slot 3: ITEMS ──────────────────────────────────────────────────────
  const hasScroll = (c.scrolls || 0) > 0;
  const carriedRows = (c.items || [])
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it && (it.kind === "potion" || it.use))
    .map(({ it, i }) => {
      const cd = it.every ? Math.max(0, it.every - (state.steps - (it.usedAt ?? -99999))) : 0;
      return {
        id: `item-${i}`,
        label: String(it.n).toUpperCase(),
        cost: cd > 0 ? `${cd} SQ` : "",
        desc: it.txt || "",
        enabled: cd === 0,
        dispatch: { type: "useItem", i },
      };
    });
  // Phase 37 (GEAR-03): worn activatables must be worn to work in the new
  // model, so a worn staff/cloak/jewel must be reachable from the fight's
  // ITEMS submenu — the shell's COMBAT_DISPATCH forwards `slot` (Plan 04).
  // A legacy c (no c.worn key) contributes zero rows here, byte-identical
  // to before this phase.
  const wornRows = WORN_SLOTS.filter((slot) => c.worn && c.worn[slot] && c.worn[slot].use).map((slot) => {
    const it = c.worn[slot];
    const cd = it.every ? Math.max(0, it.every - (state.steps - (it.usedAt ?? -99999))) : 0;
    return {
      id: `worn-${slot}`,
      label: String(it.n).toUpperCase(),
      cost: cd > 0 ? `${cd} SQ` : "",
      desc: it.txt || "",
      enabled: cd === 0,
      dispatch: { type: "useItem", slot },
    };
  });
  const usableCount = ((c.potions || 0) > 0 ? 1 : 0) + (hasScroll ? 1 : 0) + carriedRows.length + wornRows.length;

  let itemRows;
  if (usableCount === 0) {
    itemRows = [{ id: "none", label: COMBAT_MENU_COPY.noItems, cost: "", desc: COMBAT_MENU_COPY.noItemsDesc, enabled: false, dispatch: null }];
  } else {
    itemRows = [
      {
        id: "potion",
        label: COMBAT_MENU_COPY.potion,
        cost: `${c.potions || 0} LEFT`,
        desc: COMBAT_MENU_COPY.potionDesc,
        enabled: (c.potions || 0) > 0 && c.wp < c.maxWP,
        dispatch: { type: "drinkPotion" },
      },
    ];
    if (hasScroll) {
      itemRows.push({
        id: "scroll",
        label: COMBAT_MENU_COPY.scroll,
        cost: `${c.scrolls} LEFT`,
        desc: COMBAT_MENU_COPY.scrollDesc,
        enabled: true,
        dispatch: { type: "readScroll" },
      });
    }
    itemRows.push(...carriedRows, ...wornRows);
  }
  submenus.items = { title: `${heroName} · ITEMS · ${usableCount} USABLE`, rows: itemRows };

  const itemsAction = {
    key: "items",
    num: 3,
    label: COMBAT_MENU_COPY.items,
    sub: `${usableCount} usable`,
    enabled: true,
    accent: false,
    opens: "items",
  };

  // ─── slot 4: SOCIAL (FLEE/WITHDRAW, PARLEY) ────────────────────────────
  // Cost mirrors engine/combat.js's own flee roll for display only (the
  // engine still rolls): a plain Fighter needs 11+ on d20; a Thief adds +5
  // (engine/combat.js:818); a round-1 tracked encounter gets a clean,
  // guaranteed WITHDRAW instead of a roll (engine/combat.js:801-817).
  const withdraw = !!(C.tracked && C.round === 1);
  const fleeRow = {
    id: "flee",
    label: withdraw ? COMBAT_MENU_COPY.withdraw : COMBAT_MENU_COPY.flee,
    cost: withdraw ? COMBAT_MENU_COPY.withdrawCost : c.cls === "Thief" ? "d20+5, 11+" : "d20, 11+",
    desc: withdraw ? COMBAT_MENU_COPY.withdrawDesc : COMBAT_MENU_COPY.fleeDesc,
    enabled: true,
    dispatch: { type: "flee" },
  };
  const parleyRow = {
    id: "parley",
    label: COMBAT_MENU_COPY.parley,
    cost: "d20",
    desc: COMBAT_MENU_COPY.parleyDesc,
    enabled: !!state.combat && canParley(state),
    dispatch: { type: "parley" },
  };
  submenus.social = { title: `${heroName} · SOCIAL`, rows: [fleeRow, parleyRow] };

  const socialAction = {
    key: "social",
    num: 4,
    label: COMBAT_MENU_COPY.social,
    sub: COMBAT_MENU_COPY.socialSub,
    enabled: true,
    accent: true,
    opens: "social",
  };

  const strikeAction = {
    key: "strike",
    num: 1,
    label: COMBAT_MENU_COPY.strike,
    sub: strikeSub,
    enabled: true,
    accent: false,
    opens: null,
    dispatch: { type: "attack" },
  };

  return {
    prompt: COMBAT_MENU_COPY.prompt,
    actions: [strikeAction, secondAction, itemsAction, socialAction],
    submenus,
  };
}
