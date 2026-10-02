// test/unit/xp-depth-scale.test.js
//
// Phase 92.4 plan 01 (XP_DEPTH_SCALE, user ruling 2026-10-02: "Since monster
// hitpoints and such go up per floor, we should also increase xp as well ...
// +10% per floor"). Every foe experience grant (a kill, and a won parley, which
// pays the same killSpFor) is multiplied by 1 + perDepth x (depth - 1), and an
// elite also by 1 + FOE_ELITE.hpPerRank x rank, inside the one Math.round and
// before the party split and HERO_SP_SCALE. The descend bonus and the table-four
// XP dots are not foe grants and do not move. Identity (perDepth 0) is today.
//
// The file runs under the shared identity override (so FOE_ELITE is OFF at
// maxRank 0 unless a test turns it on) and turns the dial on per test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { killSpFor } from "../../engine/derived.js";
import { killFoe, parley } from "../../engine/combat.js";
import { DIALS, xpFoeMulFor, heroSpFor, setDialsForTuning } from "../../engine/difficulty.js";
import { setIdentityDials, withIdentity, IDENTITY_DIALS } from "./harness/identityDials.js";

setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(__dirname, "../../engine");

const XP = { XP_DEPTH_SCALE: { perDepth: 0.1 } };
const ELITES = { FOE_ELITE: { maxRank: 10, hpPerRank: 0.1, hitPerRank: 0.05 } };

function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

function fixedHero(overrides = {}) {
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

function fixedState(depth, cOverrides = {}) {
  const g = [];
  for (let y = 0; y < 3; y++) {
    g.push([]);
    for (let x = 0; x < 3; x++) g[y].push({ wall: false, dark: false, seen: true, feat: null });
  }
  return {
    version: 1, seed: 1, rngState: 1,
    c: fixedHero(cOverrides),
    floor: { g, px: 1, py: 1, depth },
    day: 1, steps: 0, combat: null, store: null, beats: null,
    dead: false, deathNote: "", epitaph: "",
  };
}

function fixedFoe(overrides = {}) {
  return {
    name: "Target", type: "Humans", lvl: 1, size: "S", intel: 1,
    wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1,
    ...overrides,
  };
}

function fixedCombat(foes, overrides = {}) {
  return { foes, type: foes[0]?.type || "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...overrides };
}

// --- the dial -------------------------------------------------------------

test("XP_DEPTH_SCALE ships at 0.10 per floor, and is a DIALS key settable through setDialsForTuning", () => {
  assert.deepStrictEqual(DIALS.XP_DEPTH_SCALE, { perDepth: 0.1 });
  assert.deepStrictEqual(IDENTITY_DIALS.XP_DEPTH_SCALE, { perDepth: 0 }, "the shared identity column holds today's flat pay");
  const restore = setDialsForTuning({ XP_DEPTH_SCALE: { perDepth: 0.25 } });
  try {
    assert.equal(xpFoeMulFor(5), 2);
  } finally {
    restore();
  }
  assert.throws(() => setDialsForTuning({ XP_DEPTH_SCALES: { perDepth: 0.1 } }), /unknown dial/);
});

// --- the multiplier -------------------------------------------------------

test("xpFoeMulFor: identity is exactly 1 at every depth and for every elite rank", () => {
  withIdentity({ ...ELITES }, () => {
    for (const depth of [1, 2, 5, 12, 40]) {
      for (const rank of [0, 1, 5, 10]) assert.equal(xpFoeMulFor(depth, rank), 1, `depth ${depth} rank ${rank}`);
    }
  });
});

test("xpFoeMulFor: 1 + 0.10 x (depth - 1), and an elite also x (1 + hpPerRank x rank)", () => {
  withIdentity({ ...XP, ...ELITES }, () => {
    assert.equal(xpFoeMulFor(1), 1, "floor 1 pays exactly as before");
    assert.equal(xpFoeMulFor(1, 0), 1);
    assert.ok(Math.abs(xpFoeMulFor(2) - 1.1) < 1e-12);
    assert.ok(Math.abs(xpFoeMulFor(5) - 1.4) < 1e-12);
    assert.ok(Math.abs(xpFoeMulFor(11) - 2) < 1e-12);
    // an elite of rank 3 on floor 5: 1.4 x 1.3
    assert.ok(Math.abs(xpFoeMulFor(5, 3) - 1.4 * 1.3) < 1e-12);
    // a rank-2 elite on floor 1: only the elite term
    assert.ok(Math.abs(xpFoeMulFor(1, 2) - 1.2) < 1e-12);
  });
});

test("xpFoeMulFor: a missing or corrupt depth reads floor 1; a bad rank reads 0", () => {
  withIdentity({ ...XP, ...ELITES }, () => {
    for (const bad of [undefined, null, NaN, 0, -3, "x"]) assert.equal(xpFoeMulFor(bad), 1, String(bad));
    assert.equal(xpFoeMulFor(3, NaN), xpFoeMulFor(3, 0));
    assert.equal(xpFoeMulFor(3, -2), xpFoeMulFor(3, 0));
  });
});

// --- killSpFor ------------------------------------------------------------

test("killSpFor: no depth argument (or depth 1) pays exactly as before, with the dial on", () => {
  const c = { race: "Human", sub: "Soldier", level: 2 };
  withIdentity(XP, () => {
    assert.equal(killSpFor(c, { lvl: 2 }, 4), 40);
    assert.equal(killSpFor(c, { lvl: 2 }, 4, 1), 40);
  });
});

test("killSpFor: one rounding at the end over the whole product (depth, elite, race, Barbarian, Apprentice)", () => {
  const human = { race: "Human", sub: "Soldier", level: 2 };
  withIdentity({ ...XP, ...ELITES }, () => {
    assert.equal(killSpFor(human, { lvl: 2 }, 4, 5), 56, "40 x 1.4");
    assert.equal(killSpFor(human, { lvl: 2 }, 4, 11), 80, "40 x 2");
    // elite rank 2 on floor 3: 40 x 1.2 x 1.2 = 57.6 -> 58
    assert.equal(killSpFor(human, { lvl: 2, elite: 2 }, 4, 3), 58);
    // ONE rounding at the end: lvl 1 roll 1 pays 5; floor 4 (x 1.3) and an elite of rank 1 (x 1.1):
    // 5 x 1.3 x 1.1 = 7.15 -> 7, where rounding after the depth step (6.5 -> 7) and again after the elite step (7.7) would give 8.
    assert.equal(killSpFor(human, { lvl: 1, elite: 1 }, 1, 4), 7);
    const barbarian = { race: "Human", sub: "Barbarian", level: 2 };
    assert.equal(killSpFor(barbarian, { lvl: 2 }, 4, 5), 28, "20 x 1.4");
    const apprentice = { race: "Human", sub: "Apprentice", level: 2 };
    assert.equal(killSpFor(apprentice, { lvl: 2 }, 4, 5), 112, "80 x 1.4");
  });
});

// --- kill and parley ------------------------------------------------------

test("a kill below floor 1 pays the depth multiplier, and the foeKilled event's spGained reflects it", () => {
  withIdentity(XP, () => {
    const state = fixedState(5);
    const foe = fixedFoe({ lvl: 2, wp: 0 });
    state.combat = fixedCombat([foe]);
    const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
    const killed = events.find((e) => e.type === "foeKilled");
    assert.equal(killed.spGained, 56);
    assert.equal(state.c.sp, 56);
  });
  withIdentity({}, () => {
    const state = fixedState(5);
    const foe = fixedFoe({ lvl: 2, wp: 0 });
    state.combat = fixedCombat([foe]);
    const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
    assert.equal(events.find((e) => e.type === "foeKilled").spGained, 40, "dial off: the flat pay of today");
  });
});

test("a kill on floor 1 is the same with the dial on or off", () => {
  const pay = (dials) =>
    withIdentity(dials, () => {
      const state = fixedState(1);
      const foe = fixedFoe({ lvl: 2, wp: 0 });
      state.combat = fixedCombat([foe]);
      return killFoe(state, foe, fakeRng([4, 6, 20]), []).find((e) => e.type === "foeKilled").spGained;
    });
  assert.equal(pay(XP), pay({}));
  assert.equal(pay(XP), 40);
});

test("an elite kill also pays x (1 + hpPerRank x rank)", () => {
  withIdentity({ ...XP, ...ELITES }, () => {
    const state = fixedState(3);
    const foe = fixedFoe({ lvl: 2, wp: 0, elite: 2 });
    state.combat = fixedCombat([foe]);
    const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
    assert.equal(events.find((e) => e.type === "foeKilled").spGained, 58, "40 x 1.2 x 1.2 = 57.6");
  });
});

test("the multiplier applies BEFORE the party split and HERO_SP_SCALE (split and scale each round after it)", () => {
  // depth 5 lvl 2 roll 4: 56. One live Joiner: round(56 / 2) = 28; then HERO_SP_SCALE 0.5: 14.
  withIdentity({ ...XP, HERO_SP_SCALE: 0.5 }, () => {
    const state = fixedState(5);
    const foe = fixedFoe({ lvl: 2, wp: 0 });
    state.combat = fixedCombat([foe], { allies: [{ name: "Denn", wp: 10, maxWP: 10 }] });
    const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
    assert.equal(events.find((e) => e.type === "foeKilled").spGained, 14);
  });
  withIdentity({ ...XP, HERO_SP_SCALE: 0.5 }, () => {
    const state = fixedState(5);
    const foe = fixedFoe({ lvl: 2, wp: 0 });
    state.combat = fixedCombat([foe]);
    const events = killFoe(state, foe, fakeRng([4, 6, 20]), []);
    assert.equal(events.find((e) => e.type === "foeKilled").spGained, 28, "solo: round(56 x 0.5)");
  });
});

test("a kill draws the same rng sequence with the dial on or off (pure arithmetic, no new draw)", () => {
  const draws = (dials) =>
    withIdentity(dials, () => {
      const state = fixedState(7);
      const foe = fixedFoe({ lvl: 2, wp: 0 });
      state.combat = fixedCombat([foe]);
      let n = 0;
      const rng = { d: (s) => { n++; return 4; }, pick: (a) => a[0], shuffle: (a) => a };
      killFoe(state, foe, rng, []);
      return n;
    });
  assert.equal(draws(XP), draws({}));
});

test("a won parley pays the depth multiplier on every live foe (same killSpFor), split as a kill's is", () => {
  // Con Artist, two live Humans, lvl 1 (roll 3) and lvl 2 (roll 5), floor 5:
  // round(15 x 1.4) + round(50 x 1.4) = 21 + 70 = 91 (was 65).
  withIdentity(XP, () => {
    const state = fixedState(5, { sub: "Con Artist" });
    const f1 = fixedFoe({ lvl: 1 });
    const f2 = fixedFoe({ lvl: 2 });
    state.combat = fixedCombat([f1, f2]);
    const events = parley(state, fakeRng([1, 3, 5, 2]), []);
    const gained = events.find((e) => e.type === "spGained" && e.reason === "parley");
    assert.ok(gained);
    assert.equal(gained.amount, 91);
    assert.equal(state.c.sp, 91);
  });
  withIdentity({}, () => {
    const state = fixedState(5, { sub: "Con Artist" });
    state.combat = fixedCombat([fixedFoe({ lvl: 1 }), fixedFoe({ lvl: 2 })]);
    const events = parley(state, fakeRng([1, 3, 5, 2]), []);
    assert.equal(events.find((e) => e.type === "spGained" && e.reason === "parley").amount, 65, "dial off: the flat pay of today");
  });
});

// --- what does not move ---------------------------------------------------

test("the descend bonus and the table-four XP dots are not foe grants: heroSpFor reads no XP dial", () => {
  const read = (dials) => withIdentity(dials, () => [1, 2, 5, 12].map((d) => heroSpFor(40 + 30 * d)).concat([heroSpFor(10), heroSpFor(25)]));
  assert.deepStrictEqual(read(XP), read({}));
  const shipped = setDialsForTuning({ HERO_SP_SCALE: 0.23 });
  try {
    const a = [heroSpFor(100), heroSpFor(10), heroSpFor(25)];
    setDialsForTuning({ HERO_SP_SCALE: 0.23, XP_DEPTH_SCALE: { perDepth: 0.5 } });
    assert.deepStrictEqual([heroSpFor(100), heroSpFor(10), heroSpFor(25)], a);
  } finally {
    shipped();
    setIdentityDials();
  }
});

// --- the docs state the rule (CRLF-normalised: the docs are CRLF in a Windows working copy) ---

const REPO_ROOT = path.resolve(__dirname, "../..");
const readDoc = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

test("the patch notes, the ROLL-LEDGER, DIFFICULTY-RETUNE and FIXTURE-INVENTORY state the depth rule", () => {
  const notes = readDoc("docs/patch-notes/2.3.0.md");
  assert.ok(notes.includes("- Experience: the same at any depth → +10% per floor below the first."), "patch-notes line");
  const ledger = readDoc("docs/ROLL-LEDGER.md");
  assert.ok(ledger.includes("## Phase 92.4: foe experience grows with depth"), "ROLL-LEDGER section");
  assert.ok(ledger.includes("1 + XP_DEPTH_SCALE.perDepth x (depth - 1)"), "ROLL-LEDGER formula");
  const retune = readDoc("docs/DIFFICULTY-RETUNE.md");
  assert.ok(retune.includes("### Post-pass rule change (92.4, 2026-10-02): foe experience grows with depth"), "DIFFICULTY-RETUNE record");
  assert.ok(/UNMEASURED/.test(retune.split("### Post-pass rule change (92.4")[1].split(String.fromCharCode(10) + "### ")[0]), "recorded as unmeasured");
  const inv = readDoc("test/parity/FIXTURE-INVENTORY.md");
  assert.ok(inv.includes("### Phase 92.4 plan 01: foe experience grows with depth"), "FIXTURE-INVENTORY section");
});

test("xpFoeMulFor is read by killSpFor alone: no other engine module scales a grant by it", () => {
  const users = [];
  for (const f of fs.readdirSync(ENGINE_DIR)) {
    if (!f.endsWith(".js") || f === "difficulty.js") continue;
    if (fs.readFileSync(path.join(ENGINE_DIR, f), "utf8").includes("xpFoeMulFor")) users.push(f);
  }
  assert.deepStrictEqual(users, ["derived.js"]);
});
