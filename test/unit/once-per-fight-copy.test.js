// test/unit/once-per-fight-copy.test.js
//
// Quick 260927-opf (user ruling 2026-09-27): the presentation half of the
// once-per-fight strikes (test/unit/once-per-fight.test.js holds the engine
// half). A spent ability's refusal reads in voice on the Oracle and the rail
// ("Silent Step: spent for this fight"; Phase 91.1 plan 02 re-pinned it from Feint, a 4-round cooldown now), and the combat menu row says once per
// fight, ready or spent; the Hero tab's ability rows use the same words.

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility } from "../../engine/abilities.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { ABILITY_VIEW_COPY } from "../../src/browser/heroTab.js";
// Phase 94 (ASTATE-01): the combat row's words come from the shared ability-state copy.
import { ABILITY_STATE_COPY } from "../../src/browser/abilityStates.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const strip = (html) => String(html).replace(/<[^>]+>/g, "");
const FILL = new Array(60).fill(20);

function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fightState(abilities) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Thief", sub: "Pilfer", race: "Human", level: 2, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0, abilities,
      weapon: "Dagger", prof: 0, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0,
    },
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
    combat: {
      foes: [{ name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 999, maxWP: 999, alive: true, asleep: 0, sp: {}, lives: 1 }],
      type: "Beasts", round: 1, target: 0, pending: false, opened: true, opened2: true, spellOpen: false, tracked: false,
    },
  };
}

test("the spent refusal reads in voice on the Oracle and the rail", () => {
  const e = { type: "abilityRefused", key: "silentStep", reason: "spent", name: "Silent Step" };
  assert.equal(strip(EVENT_NARRATION.abilityRefused(e)), "Silent Step: spent for this fight. It works once, and you have had your once.");
  assert.equal(LINE_FOR.abilityRefused(e).text, "Silent Step: spent for this fight.");
  assert.equal(LINE_FOR.abilityRefused(e).tone, "block");
});

test("the combat menu row says once per fight, ready or spent", () => {
  const s = fightState(["silentStep", "dirtyTrick"]);
  const rowOf = (st, key) => combatMenuViewModel(st).submenus.abilities.rows.find((r) => r.id === `ability-${key}`);
  // Phase 94 (ASTATE-01): READY · ONCE PER FIGHT / READY / SPENT THIS FIGHT now live in ABILITY_STATE_COPY.
  assert.equal(rowOf(s, "silentStep").cost, ABILITY_STATE_COPY.readyOnce);
  assert.equal(ABILITY_STATE_COPY.readyOnce, "READY · ONCE PER FIGHT");
  assert.match(rowOf(s, "silentStep").desc, /once per fight/);
  assert.equal(rowOf(s, "dirtyTrick").cost, ABILITY_STATE_COPY.ready);
  assert.equal(combatMenuViewModel(s).actions.find((a) => a.key === "abilities").sub, "2/2 READY");
  useAbility(s, "silentStep", fakeRng(FILL), []);
  assert.equal(rowOf(s, "silentStep").cost, ABILITY_STATE_COPY.spent);
  assert.equal(ABILITY_STATE_COPY.spent, "SPENT THIS FIGHT");
  assert.equal(rowOf(s, "silentStep").enabled, false, "Phase 94: a spent row is not enabled (state spent)");
  assert.equal(rowOf(s, "silentStep").state, "spent");
  assert.deepEqual(rowOf(s, "silentStep").dispatch, { type: "useAbility", key: "silentStep" }, "still tappable; the engine's refusal explains");
  assert.equal(combatMenuViewModel(s).actions.find((a) => a.key === "abilities").sub, "1/2 READY");
});

test("the Hero tab's ability rows use the same words", () => {
  assert.equal(ABILITY_VIEW_COPY.once, "once per fight");
  // Phase 94 (ASTATE-01): in a fight the Hero tab's spent words are the shared ABILITY_STATE_COPY.spent.
  assert.equal(ABILITY_STATE_COPY.spent, "SPENT THIS FIGHT");
});
