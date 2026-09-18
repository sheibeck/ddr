// test/unit/parley-button-mirror.test.js
//
// Phase 20 D-17 / LANG-02 / PARLEY-02 — mazeworld.html keeps a hand-
// maintained classic canParley() that gates the "5 · Parley" button (the
// DR8 comment at mazeworld.html:3738 confirms it is LIVE, not dead). Nothing
// else can catch it drifting from engine/combat.js#canParley, so this file
// extracts the real shipped source with fs.readFileSync (mirroring
// test/unit/foe-effect-chip.test.js's source-read pattern — mazeworld.html
// has no module surface a test could import) and replays the engine's
// availability matrix through it.
//
// Phase 38 (ABIL-02): the Language skill is dropped outright from
// engine/derived.js#fluency (this plan's engine-side change) — the classic
// script's own fluency() duplicate is UNCHANGED (mazeworld.html is out of
// this plan's scope per its own prohibitions; a later shell plan owns it).
// This is harmless in real play: chargen never grants Language anymore, so
// the classic `skill("Language")` read is permanently false for every real
// character, meaning it too effectively caps at fluency 1 going forward.
// The ONLY place the two scripts can still be made to disagree is a
// synthetic test state that directly plants `c.skills.Language` — a shape
// chargen can no longer produce — so this file's matrix drops that
// unreachable dimension, matching the same declared-divergence discipline
// test/unit/parley.test.js/combat.test.js apply.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { canParley } from "../../engine/combat.js";
import { RACES, ENC_TYPES } from "../../content/index.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

const TALKATIVE = ["Humans", "Demons", "Lair Beasts", "Beasts"];
const HELM = { n: "Helm of Knowledge", eff: { tongue: 1 } };

// --- extraction -------------------------------------------------------

const fluencyMatches = HTML.match(/\nfunction fluency\(\) \{\n[\s\S]*?\n\}\n/g) || [];
const canParleyMatches = HTML.match(/\nfunction canParley\(\) \{\n[\s\S]*?\n\}\n/g) || [];
assert.equal(fluencyMatches.length, 1, "classic function fluency() { ... } must appear exactly once in mazeworld.html");
assert.equal(canParleyMatches.length, 1, "classic function canParley() { ... } must appear exactly once in mazeworld.html");
const fluSrc = fluencyMatches[0];
const cpSrc = canParleyMatches[0];

const buildCanParley = new Function("S", "skill", "eff", "TALKATIVE", `${fluSrc}${cpSrc}\nreturn canParley;`);

/** classicFor(state) — binds the extracted classic canParley()/fluency()
 * pair against a given engine state, supplying the classic script's own
 * `skill`/`eff` read shape (mazeworld.html:1707/3281) over `state.c`. */
function classicFor(state) {
  const skill = (n) => !!(state.c.skills && state.c.skills[n]);
  const eff = (key) => (state.c.items || []).reduce((t, it) => t + ((it.eff && it.eff[key]) || 0), 0);
  return buildCanParley(state, skill, eff, TALKATIVE);
}

// --- local fixtures (copied from test/unit/parley.test.js) ------------

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

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

function mk(cOverrides, type, combatOverrides = {}) {
  const state = fixedState({ c: cOverrides });
  state.combat = fixedCombat([fixedFoe({ type })], { type, ...combatOverrides });
  return state;
}

// --- tests --------------------------------------------------------------

test("D-17 (Phase 38): the classic canParley() agrees with engine/combat.js#canParley on all 504 reachable matrix cases", () => {
  let cases = 0;
  for (const race of Object.keys(RACES)) {
    for (const sub of ["Con Artist", "Woodsman", "Bard", "Soldier", "Ninja", "Master of Arms", "Court Mage"]) {
      for (const helm of [false, true]) {
        for (const t of ENC_TYPES) {
          cases++;
          const state = mk({ race, sub, items: helm ? [HELM] : [] }, t);
          const engineResult = canParley(state);
          const classicResult = classicFor(state)();
          assert.equal(classicResult, engineResult, `race=${race} sub=${sub} helm=${helm} type=${t}`);
        }
      }
    }
  }
  assert.equal(cases, 504);
});

test("Phase 24 (IDENT-05): a Ninja and a Master of Arms never parley, even at fluency 2 (Language + Helm)", () => {
  for (const sub of ["Ninja", "Master of Arms"]) {
    for (const t of ENC_TYPES) {
      const state = mk({ sub, skills: { Language: 1 }, items: [HELM] }, t);
      assert.equal(canParley(state), false, `engine: ${sub} vs ${t}`);
      assert.equal(classicFor(state)(), false, `classic: ${sub} vs ${t}`);
    }
  }
});

test("Phase 24 (IDENT-06): a Court Mage can always parley Humans, even at fluency 0", () => {
  const state = mk({ sub: "Court Mage" }, "Humans");
  assert.equal(canParley(state), true);
  assert.equal(classicFor(state)(), true);
});

test("D-17: the classic gate hides the button after the one attempt and with no combat, exactly like the engine", () => {
  const tried = mk({ sub: "Con Artist" }, "Humans", { parleyTried: true });
  assert.equal(classicFor(tried)(), false);
  assert.equal(canParley(tried), false);

  const fresh = mk({ sub: "Con Artist" }, "Humans");
  assert.equal(classicFor(fresh)(), true);
  assert.equal(canParley(fresh), true);

  const noCombat = fixedState();
  assert.equal(classicFor(noCombat)(), false);
  assert.equal(canParley(noCombat), false);

  // Phase 38 (ABIL-02): fluency 2 is unreachable in real play on EITHER
  // script (Language is never granted by chargen anymore) — a Wilmsry vs
  // Magical at the real-play-reachable fluency ceiling (1, Helm alone)
  // stays refused on both.
  const wilmsryMagical = mk({ race: "Wilmsry", items: [HELM] }, "Magical");
  assert.equal(classicFor(wilmsryMagical)(), false, "fluency 1 (Helm alone) does not open Magical on the classic script either");
  assert.equal(canParley(wilmsryMagical), false);
});

test("D-17 source pins: the classic canParley reads parleyTried and opens Magical only at fluency 2", () => {
  assert.ok(cpSrc.includes("if (C.parleyTried) return false;"));
  assert.ok(cpSrc.includes('if (t === "Magical" && flu < 2) return false;'));
  assert.ok(cpSrc.includes('const talkable = flu >= 2 ? [...TALKATIVE, "Magical"] : TALKATIVE;'));
  assert.equal(cpSrc.includes('"Walking Dead" || t === "Magical"'), false);
  assert.ok(fluSrc.includes('skill("Language")'));
  assert.ok(fluSrc.includes('eff("tongue")'));
});

test("Phase 24 source pins: the classic canParley carries both new mirror lines verbatim", () => {
  assert.ok(cpSrc.includes('if (S.c.sub === "Ninja" || S.c.sub === "Master of Arms") return false;'));
  assert.ok(cpSrc.includes('if (S.c.sub === "Court Mage" && t === "Humans") return true;'));
});
