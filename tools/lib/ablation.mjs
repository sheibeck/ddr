// tools/lib/ablation.mjs
//
// Quick 260928-abl (user request 2026-09-28: "look at special abilities of
// fighters and thieves and make sure we didn't have some over powered
// abilities that are the reason for the disparity"): the bot-side ABLATION
// switch. One named Fighter/Thief ability or passive is disabled for the
// bot's HERO for a measurement run, so a paired readout can say what that
// one thing is worth in floors.
//
// Dev-only, zero-dependency Node ESM — NOT shipped (tools/build-www.mjs never
// copies tools/), NOT a node:test file. OFF BY DEFAULT: tools/lib/tuning-bot.mjs
// reads `opts.ablate` (absent from BOT_DEFAULTS, so every existing readout,
// the frozen `Bot:` line and every fixture are untouched) and every helper
// below is a no-op for `null`/`undefined`.
//
// NO GAME RULE CHANGES. Every ablation is one of:
//   - a BOT decision filter: `ability:<id>` — chooseAbility never picks <id>
//     (the hero still owns it; the bot simply never presses it);
//   - a HARNESS-ONLY write at run start, right after newRun (the same class
//     of write-path bypass as tuning-bot.mjs's forceParty): `skill:<Name>`
//     deletes one rolled passive skill from the hero's sheet; `sub:<Sub>`
//     renames the hero's sub-class to SUB_ABLATED, switching off every
//     sub-keyed engine rule (perks AND drawbacks) while keeping the kit the
//     sub rolled at chargen; `samuraiBlade` zeroes a Samurai's magicWpn;
//   - a HARNESS-ONLY per-fight flag write immediately before a strike
//     dispatch (`attack`/`useAbility`), marking the engine's own "already
//     used" flag so the engine skips that one rule: `thiefBackstab` sets
//     combat.opened2 (the plain Thief opening-strike crit; never applied to
//     a Con Artist, whose opener is a no-damage warning), `subOpener` sets
//     combat.opened (the Cat Burglar/Ninja auto-hit opener, and the Ninja
//     first strike it carries), `cutthroatCrit` sets combat.cut (the
//     Cutthroat's first-hit crit);
//   - a HARNESS-ONLY dial override around one run, for a class passive held
//     in frozen content that has an exactly equivalent dial form
//     (`thiefFlee`, see DIAL_ABLATIONS) — applied by the readout tool
//     through setDialsForTuning, never by the engine or the shipped game.
//
// PAIRING: an ablated run only differs from its baseline run on the same
// seed when the ablation actually touches it — `affectsRow` is that test,
// read off the BASELINE run's row, so a readout re-plays only the affected
// seeds and copies the rest (tools/ability-ablation.mjs). For `ability:<id>`
// the test is "the baseline bot used or tried <id> at least once": a
// chooseAbility that never returned <id> returns the same thing with <id>
// filtered out.

import { ABILITY_BY_ID, FIGHTER_SKILLS, THIEF_SKILLS, CLASSES } from "../../content/index.js";

/** The sub-class string an `ablate: "sub:<Sub>"` run's hero carries instead. */
export const SUB_ABLATED = "(ablated)";

/** The strike-flag ablations: name -> { flag, applies(c) }. */
const STRIKE_FLAGS = {
  thiefBackstab: { flag: "opened2", applies: (c) => c.cls === "Thief" && c.sub !== "Con Artist" },
  subOpener: { flag: "opened", applies: (c) => c.sub === "Cat Burglar" || c.sub === "Ninja" },
  cutthroatCrit: { flag: "cut", applies: (c) => c.sub === "Cutthroat" },
};

/**
 * The dial-override ablations: a class passive that lives in frozen content
 * (so no per-hero write can reach it) but has an EXACTLY equivalent
 * difficulty-dial form. The caller (tools/ability-ablation.mjs#playRow)
 * applies `dials` through engine/difficulty.js#setDialsForTuning around the
 * one run, and ONLY when the hero is `cls` — the run is class-forced, so
 * nobody else in it is touched by the override except through the same
 * rule. `thiefFlee`: content/flee.js's FLEE_THIEF_BONUS (+5 to the flee
 * roll) — FLEE_NEED_MOD +5 raises the need by exactly what the bonus
 * lowers it by (combat.js#flee: atLeast = need - bonus), so the flee
 * outcome is the one a Thief without the bonus would roll (only the
 * fleeRolled event's `mods` narration differs).
 */
const DIAL_ABLATIONS = {
  thiefFlee: { cls: "Thief", dials: { FLEE_NEED_MOD: 5 } },
};

/**
 * parseAblation(spec) —`null`/`undefined`/`""` -> null (off). Otherwise a
 * `{ kind, key, spec }` record, or a thrown Error naming the bad spec. Kinds:
 * `ability` (a Fighter/Thief catalog id), `skill` (a PASSIVE Fighter/Thief
 * skill-table key — an `active` key is an ability, ablate it by id), `sub`
 * (a Fighter/Thief sub-class), `strike` (thiefBackstab/subOpener/
 * cutthroatCrit), `samuraiBlade`.
 */
export function parseAblation(spec) {
  if (spec === null || spec === undefined || spec === "") return null;
  if (typeof spec !== "string") throw new Error(`ablation: expected a string, got ${typeof spec}`);
  const colon = spec.indexOf(":");
  const head = colon === -1 ? spec : spec.slice(0, colon);
  const key = colon === -1 ? null : spec.slice(colon + 1);
  if (head === "ability") {
    // `ability:*` — the bot presses no Fighter/Thief ability at all (the
    // whole active kit's worth, one number).
    if (key === "*") return { kind: "ability", key, cls: null, spec };
    const meta = ABILITY_BY_ID[key];
    if (!meta || (meta.cls !== "Fighter" && meta.cls !== "Thief")) throw new Error(`ablation: unknown Fighter/Thief ability "${key}"`);
    return { kind: "ability", key, cls: meta.cls, spec };
  }
  if (head === "skill") {
    const row = FIGHTER_SKILLS[key] || THIEF_SKILLS[key];
    if (!row || row.active) throw new Error(`ablation: "${key}" is not a passive Fighter/Thief skill`);
    return { kind: "skill", key, cls: FIGHTER_SKILLS[key] ? "Fighter" : "Thief", spec };
  }
  if (head === "sub") {
    const cls = ["Fighter", "Thief"].find((k) => CLASSES[k].subs.includes(key));
    if (!cls) throw new Error(`ablation: "${key}" is not a Fighter/Thief sub-class`);
    return { kind: "sub", key, cls, spec };
  }
  if (colon === -1 && DIAL_ABLATIONS[head]) return { kind: "dial", key: head, ...DIAL_ABLATIONS[head], spec };
  if (colon === -1 && STRIKE_FLAGS[head]) return { kind: "strike", key: head, cls: "Thief", spec };
  if (colon === -1 && head === "samuraiBlade") return { kind: "samuraiBlade", key: head, cls: "Fighter", spec };
  throw new Error(`ablation: unknown spec "${spec}"`);
}

/** resolve(a) — accepts a spec string or an already-parsed record. */
function resolve(a) {
  return typeof a === "string" || a === null || a === undefined ? parseAblation(a) : a;
}

/** abilityAblated(ablate, id) — true iff this run's ablation removes ability `id` from the bot's choices. */
export function abilityAblated(ablate, id) {
  const a = resolve(ablate);
  return !!a && a.kind === "ability" && (a.key === id || a.key === "*");
}

/**
 * applyStartAblation(state, ablate) — the run-start harness write (after
 * newRun, before the first action). Mutates `state.c` in place only when
 * the ablation applies to this hero; a no-op otherwise (and for `null`).
 * Returns true iff it wrote.
 */
export function applyStartAblation(state, ablate) {
  const a = resolve(ablate);
  if (!a || !state || !state.c) return false;
  const c = state.c;
  if (a.kind === "skill") {
    if (c.skills && Object.prototype.hasOwnProperty.call(c.skills, a.key)) {
      delete c.skills[a.key];
      return true;
    }
    return false;
  }
  if (a.kind === "sub") {
    if (c.sub === a.key) {
      c.sub = SUB_ABLATED;
      return true;
    }
    return false;
  }
  if (a.kind === "samuraiBlade") {
    if (c.sub === "Samurai" && c.magicWpn) {
      c.magicWpn = 0;
      return true;
    }
    return false;
  }
  return false;
}

/**
 * applyStrikeAblation(state, action, ablate) — the pre-dispatch harness
 * write: for a strike-flag ablation, immediately before an `attack` or a
 * `useAbility` dispatch in a live fight, marks the engine's own per-fight
 * "already used" flag so that one rule never fires. A no-op otherwise.
 * Returns true iff it wrote.
 */
export function applyStrikeAblation(state, action, ablate) {
  const a = resolve(ablate);
  if (!a || a.kind !== "strike" || !state || !state.combat || !action) return false;
  if (action.type !== "attack" && action.type !== "useAbility") return false;
  const rule = STRIKE_FLAGS[a.key];
  if (!rule.applies(state.c)) return false;
  if (state.combat[rule.flag]) return false;
  state.combat[rule.flag] = true;
  return true;
}

/**
 * dialOverridesFor(ablate, c) — the setDialsForTuning overrides a `dial`
 * ablation needs for a run whose hero is `c`, or null (every other kind,
 * `null`, or a hero of another class).
 */
export function dialOverridesFor(ablate, c) {
  const a = resolve(ablate);
  if (!a || a.kind !== "dial" || !c || c.cls !== a.cls) return null;
  return { ...a.dials };
}

/**
 * affectsRow(row, ablate) —true iff the ablated run on this seed CAN differ
 * from the baseline run whose compact row is `row` (tools/ability-ablation.mjs
 * shape: `{ cls, sub, startSkills, usage, refused }`, all read at the
 * baseline run's START except usage/refused). False means the ablated run is
 * the baseline run, byte for byte.
 */
export function affectsRow(row, ablate) {
  const a = resolve(ablate);
  if (!a) return false;
  if (a.kind === "ability" && a.key === "*") {
    const any = (m) => !!m && Object.values(m).some((v) => v > 0);
    return any(row.usage) || any(row.refused);
  }
  if (a.kind === "ability") return ((row.usage && row.usage[a.key]) || 0) + ((row.refused && row.refused[a.key]) || 0) > 0;
  if (a.kind === "skill") return Array.isArray(row.startSkills) && row.startSkills.includes(a.key);
  if (a.kind === "sub") return row.sub === a.key;
  if (a.kind === "samuraiBlade") return row.sub === "Samurai";
  if (a.kind === "strike") return STRIKE_FLAGS[a.key].applies({ cls: row.cls, sub: row.sub });
  if (a.kind === "dial") return row.cls === a.cls;
  return false;
}
