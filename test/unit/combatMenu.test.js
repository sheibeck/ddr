// test/unit/combatMenu.test.js
//
// Phase 34 (CSCR-05), Plan 01 — direct unit coverage for
// src/browser/combatMenu.js's combatMenuViewModel: the four-action grid
// (STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL) and its submenus, for
// each of the four class archetypes the submenu content genuinely differs
// for (Fighter, Bard, Magic User, Thief).
//
// fixedFighter/fixedFloor/fixedState/fixedCombat are copied verbatim from
// test/unit/round-card-worst-case.test.js (lines 22-64), which itself
// copied them verbatim from test/unit/foe-abilities.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { SPELLS, NICHE_LABELS } from "../../content/index.js";
import { canCast } from "../../engine/derived.js";
import { canParley } from "../../engine/combat.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
// Phase 38 (ABIL-01/04) — new imports for the ABILITIES-branch section below;
// added as their own lines (never editing the pre-existing import above) so
// the "only additions" acceptance criterion for this file stays exact.
import { ABILITY_BY_ID } from "../../content/index.js";
import { startEffect, startCooldown } from "../../engine/effects.js";

// Phase 37 (GEAR-03): a Poplar Staff (worn activatable), used as the fixed
// staff literal across the "worn activatables" section below. Phase 39
// (GEAR-02): `charges` (the real content pool — Poplar's own max is 3) is
// the ready/recharging gate now, not `every`/`usedAt` — a full pool with no
// planted `c.timers` "charges:Poplar Staff" record reads READY by default.
function fixedWornStaff(overrides = {}) {
  return { n: "Poplar Staff", kind: "staff", use: "heal", charges: 3, txt: "1d20+10 wp to up to 6", ...overrides };
}

// ─── fixed* helpers, copied verbatim from test/unit/round-card-worst-case.test.js ──

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 1, sp: 0,
    maxWP: 55, wp: 55, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 1, rations: 6, gold: 50, scrolls: 0,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, won: false, deathNote: "", epitaph: "",
    ...rest,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// ─── Fighter: STRIKE / no-spells ABILITIES fallback / ITEMS / SOCIAL ──────

test("Fighter (Soldier): the default grid — STRIKE sub-line, ABILITIES fallback, ITEMS 1 usable, SOCIAL accent", () => {
  const state = fixedState({ combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);

  assert.equal(vm.prompt, "PICK YOUR MISTAKE");

  assert.equal(vm.actions[0].key, "strike");
  assert.equal(vm.actions[0].label, "1 · STRIKE");
  assert.equal(vm.actions[0].enabled, true);
  assert.match(vm.actions[0].sub, /^d\d+, 1–\d+ to hit · \d+–\d+ dmg$/);
  assert.deepEqual(vm.actions[0].dispatch, { type: "attack" });

  assert.deepEqual(vm.actions[1], { key: "abilities", num: 2, label: "2 · ABILITIES", sub: "NOTHING UP YOUR SLEEVE", enabled: false, accent: false, opens: null });

  assert.equal(vm.actions[2].key, "items");
  assert.equal(vm.actions[2].label, "3 · ITEMS");
  assert.equal(vm.actions[2].sub, "1 usable");
  assert.equal(vm.actions[2].opens, "items");

  assert.equal(vm.actions[3].key, "social");
  assert.equal(vm.actions[3].label, "4 · SOCIAL");
  assert.equal(vm.actions[3].sub, "FLEE · PARLEY");
  assert.equal(vm.actions[3].accent, true);
  assert.equal(vm.actions[3].opens, "social");

  assert.deepEqual(vm.submenus.abilities.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noAbilities, cost: "", desc: COMBAT_MENU_COPY.noAbilitiesDesc, enabled: false, dispatch: null },
  ]);

  // Reused below: a Fighter's flee cost has no Thief +5.
  assert.equal(vm.submenus.social.rows[0].cost, "d20, 11+");
});

// ─── Bard: ABILITIES opens Sing ────────────────────────────────────────────

test("Bard: ABILITIES opens SING, ready vs. counting-down", () => {
  const ready = combatMenuViewModel(fixedState({ c: { sub: "Bard" }, combat: fixedCombat([]) }));
  assert.deepEqual(ready.actions[1], { key: "abilities", num: 2, label: "2 · ABILITIES", sub: "SING · READY", enabled: true, accent: false, opens: "abilities" });
  assert.deepEqual(ready.submenus.abilities.rows[0], {
    id: "sing", label: "SING", cost: "READY", desc: COMBAT_MENU_COPY.singDesc, enabled: true, dispatch: { type: "sing" },
  });

  const counting = combatMenuViewModel(fixedState({ c: { sub: "Bard", songAt: 0 }, steps: 40, combat: fixedCombat([]) }));
  assert.equal(counting.actions[1].sub, "SING (60 sq)");
  assert.equal(counting.submenus.abilities.rows[0].cost, "60 SQ");
  assert.equal(counting.submenus.abilities.rows[0].enabled, false);
  assert.deepEqual(counting.submenus.abilities.rows[0].dispatch, { type: "sing" });
});

// ─── Magic User: SPELLS grid + submenu rows in SPELLS array order ─────────

test("Magic User (Wizard): SPELLS sub-line, submenu title, rows in SPELLS order incl. an above-level spell", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal", "Freeze", "Lightning"], spellsUsed: 0 };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);

  assert.equal(vm.actions[1].key, "spells");
  assert.equal(vm.actions[1].label, "2 · SPELLS");
  assert.equal(vm.actions[1].sub, "4 charges left · 3 known");
  assert.equal(vm.actions[1].opens, "spells");

  assert.equal(vm.submenus.spells.title, "TEST DELVER · SPELLS · 4 CHARGES");

  const grimoireOrder = SPELLS.filter((sp) => c.grimoire.includes(sp.n));
  assert.equal(vm.submenus.spells.rows.length, grimoireOrder.length);
  grimoireOrder.forEach((sp, i) => {
    const row = vm.submenus.spells.rows[i];
    const idx = SPELLS.indexOf(sp);
    assert.equal(row.id, `spell-${idx}`);
    assert.equal(row.label, sp.n.toUpperCase());
    assert.equal(row.cost, `LVL ${sp.lvl}`);
    assert.equal(row.desc, sp.txt || "");
    assert.deepEqual(row.dispatch, { type: "castSpell", idx });
    const expectedEnabled = canCast(state, sp) && 4 > 0;
    assert.equal(row.enabled, expectedEnabled, `${sp.n}: enabled must mirror canCast && charges>0`);
    // Phase 40 (SPELL-01): every spell row carries the same niche/nicheLabel
    // pair the Hero-tab Grimoire rows carry (grimoireViewModel.test.js).
    assert.equal(row.niche, sp.niche);
    assert.equal(row.nicheLabel, NICHE_LABELS[sp.niche]);
  });

  const lightning = SPELLS.find((sp) => sp.n === "Lightning");
  assert.equal(canCast(state, lightning), false, "Lightning is above level 1 — canCast must refuse it");
  const lightningRow = vm.submenus.spells.rows.find((r) => r.label === "LIGHTNING");
  assert.equal(lightningRow.enabled, false);
  assert.ok(lightningRow.dispatch, "the disabled row still carries a dispatch payload");
});

test("Magic User with an empty grimoire: SPELLS submenu is the single disabled NOTHING IN THE GRIMOIRE row", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: [] }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.spells.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noSpells, cost: "", desc: COMBAT_MENU_COPY.noSpellsDesc, enabled: false, dispatch: null },
  ]);
});

// ─── Thief: SOCIAL flee cost bonus, WITHDRAW, PARLEY ───────────────────────

test("Thief (Pilfer): FLEE carries the +5 Thief bonus; a tracked round-1 combat becomes a clean WITHDRAW", () => {
  const c = { cls: "Thief", sub: "Pilfer" };
  const normal = combatMenuViewModel(fixedState({ c, combat: fixedCombat([]) }));
  assert.deepEqual(normal.submenus.social.rows[0], {
    id: "flee", label: "FLEE", cost: "d20+5, 11+", desc: COMBAT_MENU_COPY.fleeDesc, enabled: true, dispatch: { type: "flee" },
  });

  const withdrawState = fixedState({ c, combat: fixedCombat([], { tracked: true, round: 1 }) });
  const withdrawVm = combatMenuViewModel(withdrawState);
  assert.equal(withdrawVm.submenus.social.rows[0].label, "WITHDRAW");
  assert.equal(withdrawVm.submenus.social.rows[0].cost, "CLEAN");

  const parleyRow = withdrawVm.submenus.social.rows[1];
  assert.equal(parleyRow.id, "parley");
  assert.equal(parleyRow.label, "PARLEY");
  assert.equal(parleyRow.cost, "d20");
  assert.deepEqual(parleyRow.dispatch, { type: "parley" });
  assert.equal(parleyRow.enabled, canParley(withdrawState));
});

// ─── ITEMS: potion always present, scroll conditional, carried items, cooldowns ─

test("ITEMS: potion + scroll + a carried item recharging, title and usable count", () => {
  // Phase 39 (GEAR-02): a real content staff (Pine Staff, pool 1) reads its
  // row state through itemRowState — a planted "charges:Pine Staff"
  // c.timers cooldown, not it.every/usedAt.
  const c = {
    potions: 2,
    scrolls: 1,
    wp: 40,
    items: [{ n: "Pine Staff", kind: "staff", use: "fire", charges: 0, txt: "a bolt" }],
    timers: { "charges:Pine Staff": { cadence: "squares", left: 94, phase: "cooldown" } },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);

  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 3 USABLE");
  assert.equal(vm.actions[2].sub, "3 usable");
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "potion", label: "POTION", cost: "2 LEFT", desc: COMBAT_MENU_COPY.potionDesc, enabled: true, dispatch: { type: "drinkPotion" } },
    { id: "scroll", label: "SCROLL", cost: "1 LEFT", desc: COMBAT_MENU_COPY.scrollDesc, enabled: true, dispatch: { type: "readScroll" } },
    // Phase 38 ruling, reused here (Rule: a row on cooldown stays tappable):
    // enabled: true even while recharging — a tap reaches the engine's own
    // "recharging" refusal line.
    { id: "item-0", label: "PINE STAFF", cost: "0/1 · 94 SQ", desc: "a bolt", enabled: true, dispatch: { type: "useItem", i: 0 } },
  ]);
});

test("ITEMS: at full health the potion row is disabled but keeps its dispatch", () => {
  const state = fixedState({ c: { potions: 2, wp: 55, maxWP: 55 }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const potionRow = vm.submenus.items.rows.find((r) => r.id === "potion");
  assert.equal(potionRow.enabled, false);
  assert.deepEqual(potionRow.dispatch, { type: "drinkPotion" });
});

test("ITEMS: potions at 0 but a scroll present — the potion row stays, disabled, cost 0 LEFT", () => {
  const state = fixedState({ c: { potions: 0, scrolls: 1, wp: 40 }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const potionRow = vm.submenus.items.rows.find((r) => r.id === "potion");
  assert.ok(potionRow, "the potion row is still present");
  assert.equal(potionRow.cost, "0 LEFT");
  assert.equal(potionRow.enabled, false);
});

test("ITEMS: nothing usable at all collapses to one disabled NOTHING TO USE row", () => {
  const state = fixedState({ c: { potions: 0, scrolls: 0, items: [] }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noItems, cost: "", desc: COMBAT_MENU_COPY.noItemsDesc, enabled: false, dispatch: null },
  ]);
  assert.equal(vm.actions[2].sub, "0 usable");
});

// ─── Phase 37 (GEAR-03): worn activatables ─────────────────────────────────

test("ITEMS: a worn activatable staff recharging appears after the potion row; a passive worn ring is not listed", () => {
  const c = {
    potions: 0, scrolls: 0, wp: 40, items: [],
    worn: {
      staff: fixedWornStaff({ charges: 1 }),
      ring: { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 }, txt: "+1 damage" },
    },
    timers: { "charges:Poplar Staff": { cadence: "squares", left: 17, phase: "cooldown" } },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 1 USABLE");
  assert.equal(vm.actions[2].sub, "1 usable");
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "potion", label: "POTION", cost: "0 LEFT", desc: COMBAT_MENU_COPY.potionDesc, enabled: false, dispatch: { type: "drinkPotion" } },
    { id: "worn-staff", label: "POPLAR STAFF", cost: "1/3 · 17 SQ", desc: "1d20+10 wp to up to 6", enabled: true, dispatch: { type: "useItem", slot: "staff" } },
  ]);
});

test("ITEMS: a worn activatable staff at full charges (no recharge record) reads READY", () => {
  const c = { potions: 0, scrolls: 0, items: [], worn: { staff: fixedWornStaff() } };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const row = vm.submenus.items.rows.find((r) => r.id === "worn-staff");
  assert.equal(row.cost, "READY");
  assert.equal(row.enabled, true);
});

test("ITEMS: a worn row is appended AFTER any carried rows", () => {
  const c = {
    potions: 0, scrolls: 0,
    items: [{ n: "Pine Staff", kind: "staff", use: "fire", charges: 1, txt: "a bolt" }],
    worn: { cloak: { n: "Cloak of Invisibility", kind: "cloak", use: "invis", txt: "invisible" } },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.items.rows.map((r) => r.id), ["potion", "item-0", "worn-cloak"]);
});

test("ITEMS: a legacy c (no worn key) produces exactly today's rows — zero worn rows", () => {
  const c = { potions: 2, scrolls: 0, items: [] };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.ok(
    !vm.submenus.items.rows.some((r) => r.id && r.id.startsWith("worn-")),
    "no worn rows when c carries no worn key at all",
  );
});

// ─── combat: null never throws ─────────────────────────────────────────────

test("state.combat === null never throws; strike/social rows still compute from a default combat shape", () => {
  const state = fixedState({ combat: null });
  assert.doesNotThrow(() => combatMenuViewModel(state));
  const vm = combatMenuViewModel(state);
  assert.equal(vm.actions[0].key, "strike");
  assert.equal(vm.submenus.social.rows[0].label, "FLEE");
  assert.equal(vm.submenus.social.rows[1].enabled, false, "canParley refuses with no active combat");
});

// ─── Phase 38 (ABIL-01/04): ABILITIES submenu — melee active abilities ─────

test("Fighter with c.abilities = ['kata', 'brace']: grid sub, submenu rows; an empty/absent abilities array keeps today's fallback", () => {
  const c = { cls: "Fighter", sub: "Soldier", abilities: ["kata", "brace"] };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);

  assert.deepEqual(vm.actions[1], { key: "abilities", num: 2, label: "2 · ABILITIES", sub: "2/2 READY", enabled: true, accent: false, opens: "abilities" });
  assert.deepEqual(vm.submenus.abilities.rows, [
    { id: "ability-kata", label: "KATA", cost: "READY", desc: ABILITY_BY_ID.kata.txt, enabled: true, dispatch: { type: "useAbility", key: "kata" } },
    { id: "ability-brace", label: "BRACE", cost: "READY", desc: ABILITY_BY_ID.brace.txt, enabled: true, dispatch: { type: "useAbility", key: "brace" } },
  ]);

  const emptyState = fixedState({ c: { cls: "Fighter", sub: "Soldier", abilities: [] }, combat: fixedCombat([]) });
  const emptyVm = combatMenuViewModel(emptyState);
  assert.deepEqual(emptyVm.submenus.abilities.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noAbilities, cost: "", desc: COMBAT_MENU_COPY.noAbilitiesDesc, enabled: false, dispatch: null },
  ]);
  assert.equal(emptyVm.actions[1].enabled, false);

  const legacyVm = combatMenuViewModel(fixedState({ combat: fixedCombat([]) }));
  assert.equal(legacyVm.actions[1].enabled, false);
  assert.deepEqual(legacyVm.submenus.abilities.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noAbilities, cost: "", desc: COMBAT_MENU_COPY.noAbilitiesDesc, enabled: false, dispatch: null },
  ]);
});

test("ABILITIES cost text: '3 ROUNDS' / '1 ROUND' on a plain cooldown; 'ONCE A FIGHT · USED' on a used once-a-fight ability; '6 ROUNDS' on a sidestep effect record (left 2, cd 4); a row stays enabled on cooldown", () => {
  const c = { cls: "Fighter", sub: "Soldier", abilities: ["kata", "brace"] };
  const state = fixedState({ c, combat: fixedCombat([]) });
  startCooldown(state.c, "ability:kata", { rounds: 3 });
  const vm = combatMenuViewModel(state);
  const kataRow = vm.submenus.abilities.rows.find((r) => r.id === "ability-kata");
  assert.equal(kataRow.cost, "3 ROUNDS");
  assert.equal(kataRow.enabled, true);
  assert.equal(vm.actions[1].sub, "1/2 READY");

  const state1 = fixedState({ c: { cls: "Fighter", sub: "Soldier", abilities: ["kata"] }, combat: fixedCombat([]) });
  startCooldown(state1.c, "ability:kata", { rounds: 1 });
  assert.equal(combatMenuViewModel(state1).submenus.abilities.rows[0].cost, "1 ROUND");

  const c2 = { cls: "Fighter", sub: "Soldier", abilities: ["secondWind", "sidestep"] };
  const state2 = fixedState({ c: c2, combat: fixedCombat([]) });
  startCooldown(state2.c, "ability:secondWind", { rounds: 999 });
  startEffect(state2.c, "ability:sidestep", { rounds: 2, cd: 4 });
  const vm2 = combatMenuViewModel(state2);
  assert.equal(vm2.submenus.abilities.rows.find((r) => r.id === "ability-secondWind").cost, "ONCE A FIGHT · USED");
  assert.equal(vm2.submenus.abilities.rows.find((r) => r.id === "ability-sidestep").cost, "6 ROUNDS");
});

test("Bard: ABILITIES rows are [sing row, ...ability rows], sing row/sub-line byte-identical", () => {
  const c = { sub: "Bard", abilities: ["kata"] };
  const vm = combatMenuViewModel(fixedState({ c, combat: fixedCombat([]) }));
  assert.equal(vm.actions[1].sub, "SING · READY");
  assert.deepEqual(vm.submenus.abilities.rows[0], {
    id: "sing", label: "SING", cost: "READY", desc: COMBAT_MENU_COPY.singDesc, enabled: true, dispatch: { type: "sing" },
  });
  assert.deepEqual(vm.submenus.abilities.rows[1], {
    id: "ability-kata", label: "KATA", cost: "READY", desc: ABILITY_BY_ID.kata.txt, enabled: true, dispatch: { type: "useAbility", key: "kata" },
  });

  const noAbilities = combatMenuViewModel(fixedState({ c: { sub: "Bard" }, combat: fixedCombat([]) }));
  assert.deepEqual(noAbilities.submenus.abilities.rows, [
    { id: "sing", label: "SING", cost: "READY", desc: COMBAT_MENU_COPY.singDesc, enabled: true, dispatch: { type: "sing" } },
  ]);
});

test("Magic User: the ABILITIES branch is untouched even when c.abilities is populated", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 1, grimoire: [], abilities: ["kata"] };
  const vm = combatMenuViewModel(fixedState({ c, combat: fixedCombat([]) }));
  assert.equal(vm.actions[1].key, "spells");
});

test("state.combat === null never throws with a populated c.abilities", () => {
  const c = { cls: "Fighter", sub: "Soldier", abilities: ["kata"] };
  assert.doesNotThrow(() => combatMenuViewModel(fixedState({ c, combat: null })));
});

// ─── Voice scan ─────────────────────────────────────────────────────────────

const ALLOW = new Set(ALLOWLIST.map((w) => w.toLowerCase()));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = BANNED.map((term) => ({ term, re: new RegExp("\\b" + escapeRegExp(term) + "\\b", "i") }));
function findBannedTerms(text) {
  const hits = [];
  for (const { term, re } of MATCHERS) {
    const m = text.match(re);
    if (m && !ALLOW.has(m[0].toLowerCase())) hits.push({ term, match: m[0] });
  }
  return hits;
}

test("COMBAT_MENU_COPY: every string leaf is non-empty and clear of content/safety-wordlist.js BANNED", () => {
  for (const [key, value] of Object.entries(COMBAT_MENU_COPY)) {
    assert.ok(typeof value === "string" && value.length > 0, `${key} must be a non-empty string`);
    const hits = findBannedTerms(value);
    assert.deepEqual(hits, [], `${key} ("${value}") must be clear of BANNED terms`);
  }
});
