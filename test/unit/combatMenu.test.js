// test/unit/combatMenu.test.js
//
// Phase 34 (CSCR-05), Plan 01 — direct unit coverage for
// src/browser/combatMenu.js's combatMenuViewModel: the four-action grid
// (STRIKE / SPELLS-or-ABILITIES / ITEMS / SOCIAL) and its submenus, for
// each of the four class archetypes the submenu content genuinely differs
// for (Fighter, Bard, Magic User, Thief).
//
// fixedFighter/fixedFloor/fixedState/fixedCombat are copied verbatim from
// test/unit/fight-log-worst-case.test.js's fixed* helpers, which themselves
// copied them verbatim from test/unit/foe-abilities.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { characterSheetViewModel, grimoireViewModel } from "../../src/browser/heroTab.js";
import { SPELLS, NICHE_LABELS } from "../../content/index.js";
import { canCast } from "../../engine/derived.js";
import { canParley } from "../../engine/combat.js";
// RULES-10 (Phase 75.1, plan 75.1-07): the ITEMS SCROLL row's own desc now
// appends scrollReadOdds(state) — asserted against the real function output
// rather than a hand-typed string, so this pin can never drift from the
// module it is pinning.
import { scrollReadOdds } from "../../src/browser/rollOdds.js";
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

// ─── fixed* helpers, copied verbatim from test/unit/fight-log-worst-case.test.js ──

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
    darkFor: 0,
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
    dead: false, deathNote: "", epitaph: "",
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
  assert.match(vm.actions[0].sub, /^Hit (\d+–\d+|\d+) \(d\d+\) · \d+–\d+ dmg$/);
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
  // Phase 74 (ROLL-02): the honest winning range on the d20 (need 14, no
  // bonus, per engine/derived.js#fleeBreakdown).
  assert.equal(vm.submenus.social.rows[0].cost, "14–20 (d20)");
});

test("Phase 74 (ROLL-02): the STRIKE sub's range is exactly characterSheetViewModel's toHit value for the same state", () => {
  const state = fixedState({ combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const sheet = characterSheetViewModel(state);
  const toHit = sheet.stats.find((s) => s.key === "toHit").value;
  assert.equal(vm.actions[0].sub, `Hit ${toHit} · ${sheet.stats.find((s) => s.key === "damage").value} dmg`);
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
//
// Phase 75 (RULES-04, user ruling 2026-09-21): the combat SPELLS submenu
// HIDES a level- or school-locked spell (canCast(state, sp) === false) — it
// reverses the old "disabled rows stay visible" reading of this test file,
// for combat only. A spell that IS castable but out of charges stays
// listed, disabled. The Hero-tab Grimoire (grimoireViewModel) is untouched.

test("Magic User (Wizard): SPELLS sub-line, submenu title, rows in SPELLS order, castable rows only", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal", "Freeze", "Lightning"], spellsUsed: 0 };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);

  assert.equal(vm.actions[1].key, "spells");
  assert.equal(vm.actions[1].label, "2 · SPELLS");
  // "N known" stays the whole book count (flagged assumption in the plan's
  // CONTEXT), so this sub-line still reads "3 known" even though only two
  // rows are listed below.
  assert.equal(vm.actions[1].sub, "4 charges left · 3 known");
  assert.equal(vm.actions[1].opens, "spells");

  assert.equal(vm.submenus.spells.title, "TEST DELVER · SPELLS · 4 CHARGES");

  const lightning = SPELLS.find((sp) => sp.n === "Lightning");
  assert.equal(canCast(state, lightning), false, "Lightning is above level 1 — canCast must refuse it");

  const castable = SPELLS.filter((sp) => c.grimoire.includes(sp.n) && canCast(state, sp));
  assert.equal(vm.submenus.spells.rows.length, castable.length);
  assert.equal(vm.submenus.spells.rows.length, 2, "Lightning has no row at all — hidden, not greyed");
  castable.forEach((sp, i) => {
    const row = vm.submenus.spells.rows[i];
    const idx = SPELLS.indexOf(sp);
    assert.equal(row.id, `spell-${idx}`);
    assert.equal(row.label, sp.n.toUpperCase());
    assert.equal(row.cost, `LVL ${sp.lvl}`);
    assert.equal(row.desc, sp.txt || "");
    assert.deepEqual(row.dispatch, { type: "castSpell", idx });
    assert.equal(row.enabled, true, `${sp.n}: castable with charges left must be enabled`);
    // Phase 40 (SPELL-01): every spell row carries the same niche/nicheLabel
    // pair the Hero-tab Grimoire rows carry (grimoireViewModel.test.js).
    assert.equal(row.niche, sp.niche);
    assert.equal(row.nicheLabel, NICHE_LABELS[sp.niche]);
  });

  assert.ok(!vm.submenus.spells.rows.some((r) => r.label === "LIGHTNING"), "a level-locked spell has no row at all");
});

test("RULES-04: a level-1 Sorcerer's healing school opens at 4 — Heal is hidden, Freeze is listed", () => {
  const c = { cls: "Magic User", sub: "Sorcerer", level: 1, grimoire: ["Heal", "Freeze"], spellsUsed: 0 };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.spells.rows.map((r) => r.label), ["FREEZE"]);
});

test("RULES-04 adjacency: a spell's effective level or school gate equal to the hero's level is listed; one level above either is hidden", () => {
  // Acid: lvl 2, offense. A Wizard has no gate.offense override (schoolGate
  // defaults to 1), so this isolates the spell's own LEVEL gate.
  const acid = SPELLS.find((sp) => sp.n === "Acid");
  const acidAtLevel = fixedState({
    c: { cls: "Magic User", sub: "Wizard", level: acid.lvl, grimoire: [acid.n], spellsUsed: 0 },
    combat: fixedCombat([]),
  });
  assert.deepEqual(
    combatMenuViewModel(acidAtLevel).submenus.spells.rows.map((r) => r.label),
    ["ACID"],
    `level ${acid.lvl} hero, level ${acid.lvl} spell: listed`,
  );

  // Turn Walking Dead: lvl 2, s "protection". Illusionist's gate.protection
  // is 3 — its own spell level (2) never blocks it, so this isolates the
  // SCHOOL gate exactly at, and one below, the threshold. A "hidden" verdict
  // still leaves ONE row (the noCastable placeholder) — the assertion below
  // checks the spell's OWN label is absent, not a bare row count.
  const protSpell = SPELLS.find((sp) => sp.n === "Turn Walking Dead");
  const gateLevel = 3; // content/mu-chart.js Illusionist.gate.protection
  const atGate = fixedState({
    c: { cls: "Magic User", sub: "Illusionist", level: gateLevel, grimoire: [protSpell.n], spellsUsed: 0 },
    combat: fixedCombat([]),
  });
  assert.deepEqual(
    combatMenuViewModel(atGate).submenus.spells.rows.map((r) => r.label),
    ["TURN WALKING DEAD"],
    `Illusionist at the gate level ${gateLevel}: listed`,
  );

  const belowGate = fixedState({
    c: { cls: "Magic User", sub: "Illusionist", level: gateLevel - 1, grimoire: [protSpell.n], spellsUsed: 0 },
    combat: fixedCombat([]),
  });
  const belowGateRows = combatMenuViewModel(belowGate).submenus.spells.rows;
  assert.ok(!belowGateRows.some((r) => r.label === "TURN WALKING DEAD"), "Illusionist one level below the gate: hidden");
  assert.deepEqual(belowGateRows, [
    { id: "none", label: COMBAT_MENU_COPY.noCastable, cost: "", desc: COMBAT_MENU_COPY.noCastableDesc, enabled: false, dispatch: null },
  ]);
});

test("RULES-04: with every charge spent, a castable spell's row stays listed, disabled", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal", "Freeze"], spellsUsed: 999 };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.equal(vm.submenus.spells.rows.length, 2, "both castable-by-level rows stay listed when spent");
  for (const row of vm.submenus.spells.rows) assert.equal(row.enabled, false, `${row.label}: out of charges must be disabled, not hidden`);
});

test("RULES-04 ordering: visible rows keep their relative SPELLS order — hiding a row never reorders the others", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 2, grimoire: ["Heal", "Freeze", "Acid"], spellsUsed: 0 };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const expectedOrder = SPELLS.filter((sp) => c.grimoire.includes(sp.n)).map((sp) => sp.n.toUpperCase());
  assert.deepEqual(vm.submenus.spells.rows.map((r) => r.label), expectedOrder);
});

test("RULES-04 all-locked: a level-1 Sorcerer whose book is only Heal shows one disabled row with the noCastable copy, distinct from noSpells", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Sorcerer", level: 1, grimoire: ["Heal"], spellsUsed: 0 }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.spells.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noCastable, cost: "", desc: COMBAT_MENU_COPY.noCastableDesc, enabled: false, dispatch: null },
  ]);
  assert.notEqual(COMBAT_MENU_COPY.noCastable, COMBAT_MENU_COPY.noSpells);
  assert.notEqual(COMBAT_MENU_COPY.noCastableDesc, COMBAT_MENU_COPY.noSpellsDesc);
});

test("Magic User with an empty grimoire: SPELLS submenu is still the single disabled NOTHING IN THE GRIMOIRE row (today's empty case, unchanged)", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: [] }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.spells.rows, [
    { id: "none", label: COMBAT_MENU_COPY.noSpells, cost: "", desc: COMBAT_MENU_COPY.noSpellsDesc, enabled: false, dispatch: null },
  ]);
});

test("RULES-04 scope: the combat SPELLS submenu hides Lightning (above level 1) but the Hero-tab Grimoire (grimoireViewModel) still lists it", () => {
  const c = { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal", "Lightning"], spellsUsed: 0 };
  const combatState = fixedState({ c, combat: fixedCombat([]) });
  const combatVm = combatMenuViewModel(combatState);
  assert.ok(!combatVm.submenus.spells.rows.some((r) => r.label === "LIGHTNING"), "combat hides the level-locked spell");

  // grimoireViewModel keeps listing Lightning regardless (it is never
  // filtered out of `rows`, unlike the combat submenu above) — it is not
  // castable here either way (Lightning is combatOnly, so out of combat its
  // own disabledReason names that, not the level gate; in combat it would
  // name the level gate instead — either way, this plan never touches that
  // logic or its rows).
  const heroState = fixedState({ c, combat: null });
  const heroVm = grimoireViewModel(heroState);
  assert.ok(heroVm.rows.some((r) => r.name === "Lightning"), "the Hero-tab Grimoire keeps listing Lightning, locked or not");
  const lightningRow = heroVm.rows.find((r) => r.name === "Lightning");
  assert.equal(lightningRow.castable, false);
  assert.equal(typeof lightningRow.disabledReason, "string");
  assert.ok(lightningRow.disabledReason.length > 0);
});

// ─── Thief: SOCIAL flee cost bonus, WITHDRAW, PARLEY ───────────────────────

test("Thief (Pilfer): FLEE carries the +5 Thief bonus; a tracked round-1 combat becomes a clean WITHDRAW", () => {
  // Phase 74 (ROLL-02/ROLL-03): the honest winning range (need 14, +5 Thief
  // bonus -> atLeast 9) and the desc's Thief +5 modifier, both through
  // fleeOdds(c) (src/browser/rollOdds.js).
  const c = { cls: "Thief", sub: "Pilfer" };
  const normal = combatMenuViewModel(fixedState({ c, combat: fixedCombat([]) }));
  assert.deepEqual(normal.submenus.social.rows[0], {
    id: "flee", label: "FLEE", cost: "9–20 (d20)", desc: `${COMBAT_MENU_COPY.fleeDesc} (Thief +5)`, enabled: true, dispatch: { type: "flee" },
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

test("Troll Fighter in Plate (Phase 74, ROLL-02/ROLL-03): FLEE cost/desc name both the race and armor penalty", () => {
  const c = { cls: "Fighter", race: "Troll", armor: "Plate" };
  const vm = combatMenuViewModel(fixedState({ c, combat: fixedCombat([]) }));
  assert.equal(vm.submenus.social.rows[0].cost, "17–20 (d20)");
  assert.ok(vm.submenus.social.rows[0].desc.endsWith("(Troll −1, Plate −2)"));
});

// ─── ITEMS: potion always present, scroll conditional, carried items, cooldowns ─

// RULES-13 (Phase 75, user 2026-09-25): reverses the pre-Phase-75 reading
// that a bagged staff's combat row stays enabled and tappable — a bagged
// staff's power is inert (75-09's engine-side `notWielded` refusal), so its
// row is now disabled with `notWielded`/`notWieldedDesc` and does not count
// toward usableCount (2, not 3).
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

  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 2 USABLE");
  assert.equal(vm.actions[2].sub, "2 usable");
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "potion", label: "POTION", cost: "2 LEFT", desc: COMBAT_MENU_COPY.potionDesc, enabled: true, dispatch: { type: "drinkPotion" } },
    { id: "scroll", label: "SCROLL", cost: "1 LEFT", desc: `${COMBAT_MENU_COPY.scrollDesc} ${scrollReadOdds(state)}`, enabled: true, dispatch: { type: "readScroll" } },
    { id: "item-0", label: "PINE STAFF", cost: COMBAT_MENU_COPY.notWielded, desc: COMBAT_MENU_COPY.notWieldedDesc, enabled: false, dispatch: { type: "useItem", i: 0 } },
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

// 260918-w4n (staff amendment): a staff has no worn slot any more — it is
// always a BAGGED item, addressed by index, alongside potions/scrolls. The
// Ring of Power is use-activated now (the governing rule), so a WORN one
// appears too — no more "passive worn item is never listed".
// RULES-13 (Phase 75, user 2026-09-25): re-pinned — the bagged staff's row
// is now disabled with `notWielded`/`notWieldedDesc` (it can never be the
// wielded one, reached by bag index) and no longer counts, so usableCount
// drops to 1 (the worn Ring of Power only).
test("ITEMS: a bagged activatable staff recharging appears after the potion row, disabled with NOT WIELDED; a worn (use-activated) Ring of Power ALSO appears (worn-jewelry1) and is the only counted row", () => {
  const c = {
    potions: 0, scrolls: 0, wp: 40,
    items: [fixedWornStaff({ charges: 1 })],
    worn: {
      jewelry1: { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 }, txt: "+1 damage" },
    },
    timers: { "charges:Poplar Staff": { cadence: "squares", left: 17, phase: "cooldown" } },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 1 USABLE");
  assert.equal(vm.actions[2].sub, "1 usable");
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "potion", label: "POTION", cost: "0 LEFT", desc: COMBAT_MENU_COPY.potionDesc, enabled: false, dispatch: { type: "drinkPotion" } },
    { id: "item-0", label: "POPLAR STAFF", cost: COMBAT_MENU_COPY.notWielded, desc: COMBAT_MENU_COPY.notWieldedDesc, enabled: false, dispatch: { type: "useItem", i: 0 } },
    { id: "worn-jewelry1", label: "RING OF POWER", cost: "READY", desc: "+1 damage", enabled: true, dispatch: { type: "useItem", slot: "jewelry1" } },
  ]);
});

test("ITEMS: both worn jewelry keys appear as their own rows (worn-jewelry1 and worn-jewelry2) alongside the cloak row", () => {
  const c = {
    potions: 0, scrolls: 0, wp: 40,
    items: [],
    worn: {
      jewelry1: { n: "Ring of Power", kind: "jewel", eff: { dmg: 1 }, txt: "+1 damage" },
      jewelry2: { n: "Anklet of Invisibility", kind: "jewel", eff: { foeToHit: -2 }, txt: "foes need two better to land" },
      cloak: { n: "Cloak of Invisibility", kind: "cloak", use: "invis", txt: "invisible" },
    },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.deepEqual(vm.submenus.items.rows.map((r) => r.id), ["potion", "worn-jewelry1", "worn-jewelry2", "worn-cloak"]);
  assert.ok(!vm.submenus.items.rows.some((r) => /worn-(ring|bracelet|amulet|helm)$/.test(r.id)));
});

// RULES-13 (Phase 75): re-pinned — a bagged staff's row is disabled with
// NOT WIELDED regardless of its own charge state (full or recharging); its
// power is inert until it is wielded, outside the fight.
test("ITEMS: a bagged activatable staff at full charges (no recharge record) is still disabled with NOT WIELDED", () => {
  const c = { potions: 0, scrolls: 0, items: [fixedWornStaff()] };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const row = vm.submenus.items.rows.find((r) => r.id === "item-0");
  assert.equal(row.cost, COMBAT_MENU_COPY.notWielded);
  assert.equal(row.enabled, false);
});

// RULES-13 (Phase 75, user 2026-09-25): a WIELDED staff (never in `c.items`,
// so it never reaches the `carriedRows`/`notWielded` branch above) gets its
// own row beside the worn rows — "EQUIPPED · " followed by itemRowState's
// own text, dispatching by slot, enabled, and counted in usableCount.
test("ITEMS: a wielded staff gets its own EQUIPPED row, dispatches by slot, and IS counted", () => {
  const c = {
    potions: 0, scrolls: 0, wp: 40,
    weapon: "Birch Staff",
    staff: { n: "Birch Staff", kind: "staff", use: "freeze", charges: 2, txt: "freezes up to 2 squares of opponents indefinitely" },
    items: [],
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 1 USABLE");
  assert.equal(vm.actions[2].sub, "1 usable");
  assert.deepEqual(vm.submenus.items.rows, [
    { id: "potion", label: "POTION", cost: "0 LEFT", desc: COMBAT_MENU_COPY.potionDesc, enabled: false, dispatch: { type: "drinkPotion" } },
    {
      id: "worn-weapon",
      label: "BIRCH STAFF",
      cost: `${COMBAT_MENU_COPY.equipped} · READY`,
      desc: "freezes up to 2 squares of opponents indefinitely",
      enabled: true,
      dispatch: { type: "useItem", slot: "weapon" },
    },
  ]);
});

// The same wielded staff, mid-recharge — its EQUIPPED row still reads
// itemRowState's own recharging text, and still counts.
test("ITEMS: a wielded, recharging staff still reads EQUIPPED · <itemRowState text> and still counts", () => {
  const c = {
    potions: 0, scrolls: 0, wp: 40,
    weapon: "Birch Staff",
    staff: { n: "Birch Staff", kind: "staff", use: "freeze", charges: 1 },
    items: [],
    timers: { "charges:Birch Staff": { cadence: "squares", left: 40, phase: "cooldown" } },
  };
  const state = fixedState({ c, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  const row = vm.submenus.items.rows.find((r) => r.id === "worn-weapon");
  assert.equal(row.cost, `${COMBAT_MENU_COPY.equipped} · 1/2 · 40 SQ`);
  assert.equal(row.enabled, true);
  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 1 USABLE");
});

// With no staff involved at all (the fixture default), every ITEMS row and
// count is exactly as before this plan — the wielded-staff row simply never
// appears.
test("ITEMS: with no staff involved, no worn-weapon row appears and the count is unaffected", () => {
  const state = fixedState({ c: { potions: 2, scrolls: 0, items: [] }, combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.ok(!vm.submenus.items.rows.some((r) => r.id === "worn-weapon"));
  assert.equal(vm.submenus.items.title, "TEST DELVER · ITEMS · 1 USABLE");
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

// ─── RULES-10 (Phase 75.1, plan 09): the hero-cannot-act shape ─────────────

test("heroOut (asleep, 2 left): the prompt names asleep and 2 turns; slot 1 is the only enabled action, dispatching loseTurn; slots 2-4 and every submenu row are disabled", () => {
  const state = fixedState({ combat: fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } }) });
  const vm = combatMenuViewModel(state);

  assert.match(vm.prompt, /ASLEEP/);
  assert.match(vm.prompt, /2 TURNS/);

  assert.equal(vm.actions.length, 4);
  assert.equal(vm.actions[0].enabled, true);
  assert.equal(vm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
  assert.deepEqual(vm.actions[0].dispatch, { type: "loseTurn" });
  assert.equal(vm.actions[0].accent, true);

  for (const action of vm.actions.slice(1)) {
    assert.equal(action.enabled, false, `${action.key}: must be disabled while heroOut is set`);
  }

  for (const [key, sm] of Object.entries(vm.submenus)) {
    for (const row of sm.rows) {
      assert.equal(row.enabled, false, `submenu ${key} row ${row.id}: must be disabled while heroOut is set`);
    }
  }
});

test("heroOut (stupefied, 4 left): the prompt names stupefied and 4 turns", () => {
  const state = fixedState({ combat: fixedCombat([], { heroOut: { kind: "stupefied", left: 4, spell: "Stupidity" } }) });
  const vm = combatMenuViewModel(state);
  assert.match(vm.prompt, /STUPEFIED/);
  assert.match(vm.prompt, /4 TURNS/);
});

test("heroOut (maddened, 1 left): the singular turn word is used, not '1 TURNS'", () => {
  const state = fixedState({ combat: fixedCombat([], { heroOut: { kind: "maddened", left: 1, spell: "Insane" } }) });
  const vm = combatMenuViewModel(state);
  assert.match(vm.prompt, /MADDENED/);
  assert.match(vm.prompt, /1 TURN LEFT/);
  assert.doesNotMatch(vm.prompt, /1 TURNS/);
});

test("heroOut: combatMenuViewModel(state, { locked: true }) also locks the single action; unlocked it stays enabled", () => {
  const state = fixedState({ combat: fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } }) });
  const locked = combatMenuViewModel(state, { locked: true });
  assert.equal(locked.prompt, COMBAT_MENU_COPY.resolving);
  for (const action of locked.actions) assert.equal(action.locked, true);

  const unlocked = combatMenuViewModel(state);
  assert.equal(unlocked.actions[0].enabled, true);
  assert.equal(unlocked.actions[0].locked, undefined);
});

test("heroOut: a Magic User/Bard/Thief in the out state all collapse to the same one-action shape (the class branch above still ran, but is overridden)", () => {
  const casterState = fixedState({
    c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal"], spellsUsed: 0 },
    combat: fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } }),
  });
  const bardState = fixedState({ c: { sub: "Bard" }, combat: fixedCombat([], { heroOut: { kind: "asleep", left: 2, spell: "Doze" } }) });
  for (const state of [casterState, bardState]) {
    const vm = combatMenuViewModel(state);
    assert.equal(vm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
    assert.deepEqual(vm.actions[0].dispatch, { type: "loseTurn" });
    assert.equal(vm.actions[1].enabled, false);
  }
});

test("heroOut absent: the view model is exactly the plan-base output for Fighter, Magic User, Bard and Thief fixtures (the unlocked shape never changes when heroOut is unset)", () => {
  const fixtures = [
    fixedState({ combat: fixedCombat([]) }),
    fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal"], spellsUsed: 0 }, combat: fixedCombat([]) }),
    fixedState({ c: { sub: "Bard" }, combat: fixedCombat([]) }),
    fixedState({ c: { cls: "Thief", sub: "Pilfer" }, combat: fixedCombat([]) }),
  ];
  for (const state of fixtures) {
    const vm = combatMenuViewModel(state);
    assert.notEqual(vm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
    assert.notDeepEqual(vm.actions[0].dispatch, { type: "loseTurn" });
    assert.equal(vm.actions[1].enabled === false && vm.actions[2].enabled === false && vm.actions[3].enabled === false, false, "at least one of slots 2-4 stays enabled without heroOut");
  }
});

test("hero Blind/Shrink cost no turns: a heroBlind or heroShrunk hero (no heroOut) gets the normal four-action menu", () => {
  const blindState = fixedState({ combat: fixedCombat([], { heroBlind: true }) });
  const blindVm = combatMenuViewModel(blindState);
  assert.notEqual(blindVm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
  assert.equal(blindVm.actions[0].enabled, true);
  assert.equal(blindVm.actions[3].enabled, true);

  const shrunkState = fixedState({ combat: fixedCombat([], { heroShrunk: true }) });
  const shrunkVm = combatMenuViewModel(shrunkState);
  assert.notEqual(shrunkVm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
  assert.equal(shrunkVm.actions[0].enabled, true);
  assert.equal(shrunkVm.actions[3].enabled, true);
});

test("heroOut: once the state is spent (C.heroOut cleared), the normal four-action menu returns", () => {
  const state = fixedState({ combat: fixedCombat([]) });
  const vm = combatMenuViewModel(state);
  assert.notEqual(vm.actions[0].label, COMBAT_MENU_COPY.letRoundPlay);
  assert.equal(vm.actions[0].dispatch.type, "attack");
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

// RULES-10 (Phase 75.1, plan 09): COMBAT_MENU_COPY.heroOutKind is a nested
// frozen kind-to-word map (asleep/stupefied/maddened), not a flat string
// leaf like every other entry — this walk flattens one level deep so the
// scan still covers every string this module actually emits.
test("COMBAT_MENU_COPY: every string leaf (including heroOutKind's nested map) is non-empty and clear of content/safety-wordlist.js BANNED", () => {
  for (const [key, value] of Object.entries(COMBAT_MENU_COPY)) {
    const leaves = value && typeof value === "object" ? Object.entries(value) : [[key, value]];
    for (const [leafKey, leaf] of leaves) {
      assert.ok(typeof leaf === "string" && leaf.length > 0, `${key}.${leafKey} must be a non-empty string`);
      const hits = findBannedTerms(leaf);
      assert.deepEqual(hits, [], `${key}.${leafKey} ("${leaf}") must be clear of BANNED terms`);
    }
  }
});

// ─── Phase 71 (D-05, R-10): the locked menu while a round's beats play ────

test("Phase 71 D-05/R-10: COMBAT_MENU_COPY.resolving is the combat v2 mock's busy prompt, exactly", () => {
  assert.equal(COMBAT_MENU_COPY.resolving, "HOLD · THE DICE ARE STILL OUT");
});

function lockFixtures() {
  return [
    fixedState({ combat: fixedCombat([]) }),
    fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Heal", "Freeze"], spellsUsed: 0 }, combat: fixedCombat([]) }),
    fixedState({ c: { sub: "Bard" }, combat: fixedCombat([]) }),
    fixedState({ c: { cls: "Thief", sub: "Cutthroat", abilities: ["pommel", "hamstring"] }, combat: fixedCombat([]) }),
    fixedState({ c: { potions: 0 }, combat: null }),
  ];
}

test("Phase 71 D-05: combatMenuViewModel(state, { locked: true }) swaps the prompt to the resolving line and flags every action and submenu row locked", () => {
  for (const state of lockFixtures()) {
    const vm = combatMenuViewModel(state, { locked: true });
    assert.equal(vm.prompt, COMBAT_MENU_COPY.resolving);
    assert.equal(vm.actions.length, 4);
    for (const a of vm.actions) assert.equal(a.locked, true, `action ${a.key} must carry locked: true`);
    for (const [key, sm] of Object.entries(vm.submenus)) {
      assert.ok(sm.rows.length > 0);
      for (const row of sm.rows) assert.equal(row.locked, true, `${key} row ${row.id} must carry locked: true`);
    }
    // Locked changes the look only: every other field is today's.
    const unlocked = combatMenuViewModel(state);
    const strip = (vmIn) => JSON.parse(JSON.stringify(vmIn, (k, v) => (k === "locked" ? undefined : v)));
    assert.deepEqual({ ...strip(vm), prompt: unlocked.prompt }, strip(unlocked));
  }
});

test("Phase 71 D-05: with no opts, or a falsy locked, the output is deep-equal to today's (no locked key anywhere)", () => {
  for (const state of lockFixtures()) {
    const today = combatMenuViewModel(state);
    for (const opts of [undefined, {}, { locked: false }, { locked: 0 }, { locked: null }, null]) {
      assert.deepEqual(combatMenuViewModel(state, opts), today);
    }
    assert.equal(today.prompt, COMBAT_MENU_COPY.prompt);
    assert.doesNotMatch(JSON.stringify(today), /"locked"/);
  }
});
