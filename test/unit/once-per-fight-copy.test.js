// test/unit/once-per-fight-copy.test.js
//
// Quick 260927-opf (user ruling 2026-09-27): the presentation half of the
// once-per-fight strikes (test/unit/once-per-fight.test.js holds the engine
// half). A spent ability's refusal reads in voice on the Oracle and the rail
// ("Feint: spent for this fight"), and the combat menu row says once per
// fight, ready or spent; the Hero tab's ability rows use the same words.

import test from "node:test";
import assert from "node:assert/strict";

import { useAbility } from "../../engine/abilities.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR } from "../../src/browser/narrationLines.js";
import { combatMenuViewModel, COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { ABILITY_VIEW_COPY } from "../../src/browser/heroTab.js";
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
  const e = { type: "abilityRefused", key: "feint", reason: "spent", name: "Feint" };
  assert.equal(strip(EVENT_NARRATION.abilityRefused(e)), "Feint: spent for this fight. It works once, and you have had your once.");
  assert.equal(LINE_FOR.abilityRefused(e).text, "Feint: spent for this fight.");
  assert.equal(LINE_FOR.abilityRefused(e).tone, "block");
});

test("the combat menu row says once per fight, ready or spent", () => {
  const s = fightState(["feint", "dirtyTrick"]);
  const rowOf = (st, key) => combatMenuViewModel(st).submenus.abilities.rows.find((r) => r.id === `ability-${key}`);
  assert.equal(rowOf(s, "feint").cost, COMBAT_MENU_COPY.abilityReadyOnce);
  assert.equal(COMBAT_MENU_COPY.abilityReadyOnce, "READY · ONCE PER FIGHT");
  assert.match(rowOf(s, "feint").desc, /once per fight$/);
  assert.equal(rowOf(s, "dirtyTrick").cost, COMBAT_MENU_COPY.abilityReady);
  assert.equal(combatMenuViewModel(s).actions.find((a) => a.key === "abilities").sub, "2/2 READY");
  useAbility(s, "feint", fakeRng(FILL), []);
  assert.equal(rowOf(s, "feint").cost, COMBAT_MENU_COPY.abilityUsedUp);
  assert.equal(COMBAT_MENU_COPY.abilityUsedUp, "ONCE PER FIGHT · SPENT");
  assert.equal(rowOf(s, "feint").enabled, true, "still tappable; the engine's refusal explains");
  assert.equal(combatMenuViewModel(s).actions.find((a) => a.key === "abilities").sub, "1/2 READY");
});

test("the Hero tab's ability rows use the same words", () => {
  assert.equal(ABILITY_VIEW_COPY.once, "once per fight");
  assert.equal(ABILITY_VIEW_COPY.used, "once per fight · spent");
});
