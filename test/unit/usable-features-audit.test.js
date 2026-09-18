// test/unit/usable-features-audit.test.js
//
// CMB-02 (Phase 31, Plan 02) — the table-driven, doc-synced audit test. A
// `CASES` array walks every usable spell/potion/staff/cloak/jewelry/scroll/
// active-feature x circumstance, asserting either a specific `{type,
// reason}` refusal (zero draws, no side effect) or a success outcome (no
// `*Refused`/`noChargesLeft`/`spellNotKnown` event). The doc-sync section
// at the bottom reads docs/USABLE-FEATURES-AUDIT.md and asserts every
// reason string, spell/potion/staff/cloak/jewelry name, and timed-field
// name used by CASES appears verbatim in the doc.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { castSpell, readScroll } from "../../engine/magic.js";
import { useItem, TARGETED_KINDS } from "../../engine/items.js";
import { playerStrike, flee, parley, sing } from "../../engine/combat.js";
import { makeCamp } from "../../engine/movement.js";
import { SPELLS, POTIONS, STAVES, CLOAKS, JEWELRY, TREASURE_ACTIVATION_OF } from "../../content/index.js";
import { TOAST_FOR } from "../../src/browser/toasts.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { makeRng } from "../../engine/rng.js";
import { GW, GH } from "../../engine/maze.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AUDIT_DOC = fs.readFileSync(path.join(REPO_ROOT, "docs", "USABLE-FEATURES-AUDIT.md"), "utf8");

const SPELL_IDX = Object.fromEntries(SPELLS.map((sp, i) => [sp.n, i]));
const NOW = () => 12345;

/** fakeRng(seq) — for the zero-draw refusal assertions. */
function fakeRng(seq, { pick = (arr) => arr[0] } = {}) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick,
    shuffle: (a) => a,
  };
}

function fixedFighter(overrides = {}) {
  return {
    cls: "Fighter", sub: "Soldier", race: "Human", level: 5, sp: 0,
    maxWP: 9999, wp: 9999, skills: {}, vp: 0,
    weapon: "Club", prof: 0, magicWpn: 0,
    armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
    temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
    potions: 4, rations: 6, gold: 50, scrolls: 1,
    haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
    items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
    regen: false, mirror: 0, foresight: false, name: "Test Delver",
    darkFor: 0, flightLeft: 0, flightCooldown: 0, songAt: -999,
    ...overrides,
  };
}

function fixedFloor(overrides = {}) {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: false, dark: false, seen: false, feat: null });
  }
  return { g, px: 1, py: 1, depth: 1, ...overrides };
}

function fixedState(overrides = {}) {
  const { c: cOverrides, floor: floorOverrides, ...rest } = overrides;
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedFighter(cOverrides),
    floor: fixedFloor(floorOverrides),
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, won: false, deathNote: "", epitaph: "",
    party: [], pendingJoiner: null, pendingFind: null,
    ...rest,
  };
}

function fixedFoe(overrides = {}) {
  return { name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1, wp: 12, maxWP: 12, alive: true, asleep: 0, sp: {}, lives: 1, ...overrides };
}
function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Humans", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

const REFUSAL_TYPES = new Set(["castRefused", "useRefused", "scrollRefused", "actionRefused", "strikeRefused", "fleeRefused", "parleyRefused", "noChargesLeft", "spellNotKnown", "spellAboveLevel", "spellSchoolLocked"]);
const hasRefusal = (events) => events.some((e) => REFUSAL_TYPES.has(e.type));

// --- CASES ------------------------------------------------------------------

const CASES = [];

// §2 Spells — outside combat: combatOnly -> castRefused combatOnly; else its
// own unconditional success event.
for (const sp of SPELLS) {
  CASES.push({
    name: `spell outside combat: ${sp.n}`,
    run: () => {
      const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: [sp.n] } });
      const events = sp.combatOnly ? castSpell(state, SPELL_IDX[sp.n], fakeRng([]), [], NOW) : castSpell(state, SPELL_IDX[sp.n], makeRng(SPELL_IDX[sp.n] + 1), [], NOW);
      return { events, state };
    },
    expect: sp.combatOnly ? { refused: { type: "castRefused", reason: "combatOnly" } } : { ok: true },
  });
}

// §2 Spells — in combat with a live target (Walking Dead type for turn/gate).
for (const sp of SPELLS) {
  CASES.push({
    name: `spell in combat: ${sp.n}`,
    run: () => {
      const foeType = sp.kind === "turn" || sp.kind === "gate" ? "Walking Dead" : "Humans";
      const foe = fixedFoe({ type: foeType, wp: 200, maxWP: 200 });
      const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: [sp.n] } });
      state.combat = fixedCombat([foe]);
      const events = castSpell(state, SPELL_IDX[sp.n], makeRng(100 + SPELL_IDX[sp.n]), [], NOW);
      return { events, state };
    },
    expect: { ok: true },
  });
}

// §2 Spell ladder generics (one representative spell each).
CASES.push({
  name: "spell: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: ["Heal"] } });
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: castSpell(state, SPELL_IDX.Heal, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "castRefused", reason: "notFought" } },
});
CASES.push({
  name: "spell: afraid casts a thrown spell at the penalty — never refused for fear",
  run: () => {
    const foe = fixedFoe({ wp: 200, maxWP: 200 });
    const state = fixedState({ c: { cls: "Magic User", sub: "Illusionist", level: 3, grimoire: ["Fireball"] } });
    state.combat = fixedCombat([foe], { afraid: 2 });
    return { events: castSpell(state, SPELL_IDX.Fireball, makeRng(7), [], NOW), state };
  },
  expect: { ok: "spellThrown" },
});
CASES.push({
  name: "spell: no charges left",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: ["Heal"], spellsUsed: 999 } });
    return { events: castSpell(state, SPELL_IDX.Heal, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "noChargesLeft" } },
});
CASES.push({
  name: "spell: unknown spell",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", grimoire: [] } });
    return { events: castSpell(state, SPELL_IDX.Heal, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "spellNotKnown" } },
});
CASES.push({
  name: "spell: above the caster's level",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 1, grimoire: ["Mangle"] } });
    return { events: castSpell(state, SPELL_IDX.Mangle, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "spellAboveLevel" } },
});
CASES.push({
  name: "spell: school not yet open",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Sorcerer", level: 1, grimoire: ["Heal"] } });
    return { events: castSpell(state, SPELL_IDX.Heal, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "spellSchoolLocked" } },
});

// §3 Potions — outside and inside combat, plus pending and Pilfer.
for (const p of POTIONS) {
  for (const where of ["outside", "inside"]) {
    CASES.push({
      name: `potion ${where} combat: ${p.n}`,
      run: () => {
        const item = { kind: "potion", n: p.n, eff2: p.eff, uses: 1 };
        const state = fixedState({ c: { wp: 20, maxWP: 9999, items: [item] } });
        if (where === "inside") state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
        const events = useItem(state, 0, makeRng(SPELLS.length + POTIONS.indexOf(p) + 1), [], NOW);
        return { events, state };
      },
      expect: { ok: true },
    });
  }
}
CASES.push({
  name: "potion: Fight!-pending refuses notFought",
  run: () => {
    const item = { kind: "potion", n: "Healing", eff2: "heal", uses: 1 };
    const state = fixedState({ c: { items: [item] } });
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: useItem(state, 0, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "useRefused", reason: "notFought" } },
});
CASES.push({
  name: "potion: a Pilfer using a non-heal potion is refused pilfer",
  run: () => {
    const item = { kind: "potion", n: "Strength", eff2: "strength", uses: 1 };
    const state = fixedState({ c: { sub: "Pilfer", items: [item] } });
    return { events: useItem(state, 0, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "useRefused", reason: "pilfer" } },
});

// §4 Staves — outside/inside combat (MU), non-MU (wrongClass), cooldown.
for (const st of STAVES) {
  CASES.push({
    name: `staff outside combat (MU): ${st.n}`,
    run: () => {
      // Phase 39 (GEAR-02): a real content staff name needs a positive
      // charge for itemReady's staff branch — read the max from content.
      const item = { kind: "staff", n: st.n, use: st.use, charges: TREASURE_ACTIVATION_OF[st.n].charges };
      const state = fixedState({ c: { cls: "Magic User", items: [item] } });
      const events = TARGETED_KINDS.has(st.use) ? useItem(state, 0, fakeRng([]), [], NOW) : useItem(state, 0, makeRng(200 + STAVES.indexOf(st)), [], NOW);
      return { events, state };
    },
    expect: TARGETED_KINDS.has(st.use) ? { refused: { type: "useRefused", reason: "combatOnly" } } : { ok: true },
  });
  CASES.push({
    name: `staff in combat (MU): ${st.n}`,
    run: () => {
      const item = { kind: "staff", n: st.n, use: st.use, charges: TREASURE_ACTIVATION_OF[st.n].charges };
      const state = fixedState({ c: { cls: "Magic User", items: [item] } });
      state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
      return { events: useItem(state, 0, makeRng(300 + STAVES.indexOf(st)), [], NOW), state };
    },
    expect: { ok: true },
  });
  CASES.push({
    name: `staff non-Magic-User refused wrongClass: ${st.n}`,
    run: () => {
      const item = { kind: "staff", n: st.n, use: st.use };
      const state = fixedState({ c: { cls: "Fighter", items: [item] } });
      state.combat = fixedCombat([fixedFoe()]);
      return { events: useItem(state, 0, fakeRng([]), [], NOW), state };
    },
    expect: { refused: { type: "useRefused", reason: "wrongClass" } },
  });
}
CASES.push({
  // Phase 39 (GEAR-02): a staff refuses "recharging" (never "cooldown",
  // which is a duration+cooldown jewelry/cloak's own reason) with a positive
  // integer squares-left, once its charge pool is empty.
  name: "an empty staff is refused recharging with a positive integer left",
  run: () => {
    const item = { kind: "staff", n: "Rowan Staff", use: "dome", charges: 0 };
    const state = fixedState({ c: { cls: "Magic User", items: [item] }, steps: 20 });
    return { events: useItem(state, 0, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "useRefused", reason: "recharging" } },
});

// Cloak/jewelry `use` kinds — half/invis/haste/ether work anywhere; stone
// (Amulet of Stone) is targeted (combatOnly outside combat).
const GEAR_USE_ITEMS = [
  { n: "Pendant of Fortitude", kind: "jewel", use: "half" },
  { n: "Cloak of Invisibility", kind: "cloak", use: "invis" },
  { n: "Cloak of Speed", kind: "cloak", use: "haste" },
  { n: "Cloak of Ether", kind: "cloak", use: "ether" },
];
for (const g of GEAR_USE_ITEMS) {
  CASES.push({
    name: `gear use outside combat: ${g.n}`,
    run: () => {
      const state = fixedState({ c: { items: [{ ...g }] } });
      return { events: useItem(state, 0, makeRng(400 + GEAR_USE_ITEMS.indexOf(g)), [], NOW), state };
    },
    expect: { ok: true },
  });
}
CASES.push({
  name: "gear use: Amulet of Stone outside combat refuses combatOnly",
  run: () => {
    const item = { n: "Amulet of Stone", kind: "jewel", use: "stone", every: 200, aoe: 4 };
    const state = fixedState({ c: { items: [item] } });
    return { events: useItem(state, 0, fakeRng([]), [], NOW), state };
  },
  expect: { refused: { type: "useRefused", reason: "combatOnly" } },
});

// Scrolls
CASES.push({
  name: "scroll: no scrolls left",
  run: () => {
    const state = fixedState({ c: { scrolls: 0 } });
    return { events: readScroll(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "scrollRefused", reason: "noScrolls" } },
});
CASES.push({
  name: "scroll: a Pilfer is refused pilfer",
  run: () => {
    const state = fixedState({ c: { sub: "Pilfer", scrolls: 1 } });
    return { events: readScroll(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "scrollRefused", reason: "pilfer" } },
});
CASES.push({
  name: "scroll: no Magic-User class and no Runes/Signs is refused noRunes",
  run: () => {
    const state = fixedState({ c: { cls: "Fighter", scrolls: 1 } });
    return { events: readScroll(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "scrollRefused", reason: "noRunes" } },
});
CASES.push({
  name: "scroll: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", scrolls: 1 } });
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: readScroll(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "scrollRefused", reason: "notFought" } },
});
CASES.push({
  name: "scroll: afraid still casts — never scrollRefused for fear",
  run: () => {
    const state = fixedState({ c: { skills: { "Runes/Signs": 1 }, scrolls: 1 } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
    return { events: readScroll(state, makeRng(9), []), state };
  },
  expect: { ok: true },
});

// §5 Strike / Flee / Parley / Sing
CASES.push({
  name: "strike: a Wizard with a castable attack spell is refused wizard",
  run: () => {
    const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 3, grimoire: ["Fireball"] } });
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })]);
    return { events: playerStrike(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "strikeRefused", reason: "wizard" } },
});
CASES.push({
  name: "strike: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: playerStrike(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "strikeRefused", reason: "notFought" } },
});
CASES.push({
  name: "strike: afraid still swings, at the penalty — never refused for fear",
  run: () => {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2 });
    return { events: playerStrike(state, makeRng(11), []), state };
  },
  expect: { ok: true },
});
CASES.push({
  name: "flee: a Samurai is refused samurai",
  run: () => {
    const state = fixedState({ c: { sub: "Samurai" } });
    state.combat = fixedCombat([fixedFoe()]);
    return { events: flee(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "fleeRefused", reason: "samurai" } },
});
CASES.push({
  name: "flee: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: flee(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "fleeRefused", reason: "notFought" } },
});
CASES.push({
  name: "flee: afraid still attempts to flee normally — never refused for fear",
  run: () => {
    const state = fixedState();
    state.combat = fixedCombat([fixedFoe({ wp: 999, maxWP: 999 })], { afraid: 2, round: 2 });
    const events = flee(state, makeRng(13), []);
    return { events, state };
  },
  expect: { ok: true },
});
CASES.push({
  name: "parley: a Ninja is refused ninja",
  run: () => {
    const state = fixedState({ c: { sub: "Ninja" } });
    state.combat = fixedCombat([fixedFoe()]);
    return { events: parley(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "parleyRefused", reason: "ninja" } },
});
CASES.push({
  name: "parley: a Master of Arms is refused masterOfArms",
  run: () => {
    const state = fixedState({ c: { sub: "Master of Arms" } });
    state.combat = fixedCombat([fixedFoe()]);
    return { events: parley(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "parleyRefused", reason: "masterOfArms" } },
});
CASES.push({
  name: "parley: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState({ c: { sub: "Con Artist" } });
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: parley(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "parleyRefused", reason: "notFought" } },
});
CASES.push({
  name: "parley: afraid still attempts to talk normally — never refused for fear",
  run: () => {
    const state = fixedState({ c: { sub: "Con Artist" } });
    state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { afraid: 2, type: "Beasts" });
    return { events: parley(state, makeRng(17), []), state };
  },
  expect: { ok: true },
});
CASES.push({
  name: "sing: a non-Bard is refused wrongClass",
  run: () => {
    const state = fixedState({ c: { sub: "Wizard" } });
    state.combat = fixedCombat([fixedFoe()]);
    return { events: sing(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "actionRefused", reason: "wrongClass" } },
});
CASES.push({
  name: "sing: a Bard still cooling down is refused cooldown",
  run: () => {
    const state = fixedState({ c: { sub: "Bard", songAt: 0 }, steps: 0 });
    state.combat = fixedCombat([fixedFoe()]);
    return { events: sing(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "actionRefused", reason: "cooldown" } },
});
CASES.push({
  name: "sing: Fight!-pending refuses notFought",
  run: () => {
    const state = fixedState({ c: { sub: "Bard" } });
    state.combat = fixedCombat([fixedFoe()], { pending: true });
    return { events: sing(state, fakeRng([]), []), state };
  },
  expect: { refused: { type: "actionRefused", reason: "notFought" } },
});
CASES.push({
  name: "sing: afraid still sings normally — never refused for fear",
  run: () => {
    const state = fixedState({ c: { sub: "Bard" } });
    state.combat = fixedCombat([fixedFoe({ type: "Beasts" })], { afraid: 2, type: "Beasts" });
    return { events: sing(state, makeRng(19), []), state };
  },
  expect: { ok: "sang" },
});

// makeCamp
CASES.push({
  name: "makeCamp: not enough rations is refused noRations",
  run: () => {
    const state = fixedState({ c: { rations: 0 } });
    return { events: makeCamp(state, fakeRng([8]), [], NOW), state };
  },
  expect: { refused: { type: "campFailed", reason: "noRations" } },
});

// --- Run every CASES row -----------------------------------------------------

for (const c of CASES) {
  test(c.name, () => {
    const { events } = c.run();
    if (c.expect.refused) {
      const { type, reason } = c.expect.refused;
      const hit = events.find((e) => e.type === type && e.reason === reason);
      assert.ok(hit, `expected exactly a ${type} {reason:${reason}} event; got: ${JSON.stringify(events)}`);
      assert.equal(events.filter((e) => e.type === type).length, 1, "exactly one refusal event of that type");
    } else if (typeof c.expect.ok === "string") {
      assert.ok(events.some((e) => e.type === c.expect.ok), `expected a ${c.expect.ok} event; got: ${JSON.stringify(events.map((e) => e.type))}`);
      assert.equal(hasRefusal(events), false, "no refusal event on a success row");
    } else {
      assert.ok(events.length > 0, "an effect event fired");
      assert.equal(hasRefusal(events), false, `no refusal event on a success row; got: ${JSON.stringify(events.map((e) => e.type))}`);
    }
  });
}

// --- Doc-sync -----------------------------------------------------------------

test("doc-sync: every distinct refused reason in CASES appears in the doc", () => {
  const reasons = new Set(CASES.filter((c) => c.expect.refused?.reason).map((c) => c.expect.refused.reason));
  for (const reason of reasons) {
    assert.ok(AUDIT_DOC.includes(reason), `reason "${reason}" is missing from docs/USABLE-FEATURES-AUDIT.md`);
  }
});

test("doc-sync: every SPELLS name appears in the doc", () => {
  for (const sp of SPELLS) assert.ok(AUDIT_DOC.includes(sp.n), `spell "${sp.n}" missing from the doc`);
});

test("doc-sync: every POTIONS name appears in the doc", () => {
  for (const p of POTIONS) assert.ok(AUDIT_DOC.includes(p.n), `potion "${p.n}" missing from the doc`);
});

test("doc-sync: every STAVES/CLOAKS(use)/JEWELRY(use) name appears in the doc", () => {
  for (const st of STAVES) assert.ok(AUDIT_DOC.includes(st.n), `staff "${st.n}" missing from the doc`);
  for (const cl of CLOAKS.filter((x) => x.use)) assert.ok(AUDIT_DOC.includes(cl.n), `cloak "${cl.n}" missing from the doc`);
  for (const j of JEWELRY.filter((x) => x.use)) assert.ok(AUDIT_DOC.includes(j.n), `jewelry "${j.n}" missing from the doc`);
});

test("doc-sync: every timed-field name from the expiry section appears in the doc", () => {
  const fields = ["acute", "ward", "mirror", "regen", "senses", "haste", "invis", "ether", "might", "halfNext", "foeEffect", "flightLeft", "afraid"];
  for (const f of fields) assert.ok(AUDIT_DOC.includes(f), `timed field "${f}" missing from the doc's expiry section`);
});

test("doc-sync: the doc names the Afraid penalty and its constant, and never files fear as a refusal reason", () => {
  assert.ok(AUDIT_DOC.includes("Afraid"));
  assert.ok(AUDIT_DOC.includes("AFRAID_TO_HIT_PENALTY"));
  assert.ok(AUDIT_DOC.includes("penalty"));
  const section1End = AUDIT_DOC.indexOf("## §2.");
  const section1 = AUDIT_DOC.slice(AUDIT_DOC.indexOf("## §1."), section1End);
  assert.equal(/\|\s*`?frozen`?\s*\|/.test(section1), false, "the §1 refusal table has no `frozen` row");
  assert.equal(/\|\s*`?afraid`?\s*\|/.test(section1), false, "the §1 refusal table has no `afraid` row");
});

test("doc-sync: the Elven flip is documented", () => {
  assert.ok(AUDIT_DOC.includes("Elven"));
  assert.ok(AUDIT_DOC.includes("foeToHit"));
});

test("doc-sync: every refused {type, reason} pair produces distinct, non-empty toast/Oracle text across reasons of the same type", () => {
  const byType = new Map();
  for (const c of CASES) {
    if (!c.expect.refused) continue;
    const { type, reason } = c.expect.refused;
    if (!byType.has(type)) byType.set(type, new Set());
    byType.get(type).add(reason);
  }
  for (const [type, reasons] of byType) {
    const toastTexts = new Set();
    const oracleTexts = new Set();
    for (const reason of reasons) {
      const sampleEvent = { type, reason, item: { n: "Test" }, spell: "Test", action: "sing", left: 42 };
      const toast = TOAST_FOR[type]?.(sampleEvent);
      const toastText = toast && "text" in toast ? toast.text : toast?.toasts?.[0]?.text;
      const oracle = EVENT_NARRATION[type]?.(sampleEvent);
      assert.ok(toastText, `${type}/${reason}: TOAST_FOR produced no text`);
      assert.ok(oracle, `${type}/${reason}: EVENT_NARRATION produced no text`);
      toastTexts.add(toastText);
      oracleTexts.add(oracle);
    }
    assert.equal(toastTexts.size, reasons.size, `${type}: two reasons share the same toast text`);
    assert.equal(oracleTexts.size, reasons.size, `${type}: two reasons share the same Oracle line`);
  }
});
