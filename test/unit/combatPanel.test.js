// test/unit/combatPanel.test.js
//
// Phase 34 (CSCR-01/02/03/06), Plan 01 — direct unit coverage for
// src/browser/combatPanel.js: the header, foe-card, YOUR LOT and MAJOR
// OVERLAY view-models. Synthetic events/state only — no engine calls
// needed for these (pure view-models over plain state shapes).
//
// fixedFighter/fixedFloor/fixedState/fixedCombat are copied verbatim from
// test/unit/round-card-worst-case.test.js (lines 22-64). The 3-member
// party fixtures are hand-built rather than grown via addPartyMember —
// PARTY_CAP is 1 today (engine/state.js), so a real 3-joiner run is
// impossible; RESEARCH.md Pitfall 10 requires a synthetic state.party.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import {
  COMBAT_PANEL_COPY,
  FOE_GLYPHS,
  combatHeaderViewModel,
  foeListViewModel,
  yourLotViewModel,
  encounterOverlaySpec,
} from "../../src/browser/combatPanel.js";
import { ENC_TYPES } from "../../content/bestiary.js";
import { maxCharges } from "../../engine/movement.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

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

// ─── combatHeaderViewModel ──────────────────────────────────────────────────

test("combatHeaderViewModel: 3 foes, 1 dead, round 4", () => {
  const foes = [
    { name: "Giant Rat", alive: true, type: "Beasts", wp: 5, maxWP: 10 },
    { name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 8 },
    { name: "Skeleton", alive: false, type: "Walking Dead", wp: 0, maxWP: 12 },
  ];
  const state = fixedState({ combat: fixedCombat(foes, { round: 4 }) });
  assert.deepEqual(combatHeaderViewModel(state), { label: "ENCOUNTER", round: "ROUND 4", standing: "2 STANDING" });
});

// ─── foeListViewModel ───────────────────────────────────────────────────────

test("foeListViewModel: TARGET tag on a live targeted foe among 2+ alive; DOWN tag + dash wp on a dead foe", () => {
  const foes = [
    { name: "Giant Rat", alive: true, type: "Beasts", size: "S", intel: 1, sp: { note: "bites" }, wp: 7, maxWP: 10 },
    { name: "Kobold", alive: true, type: "Beasts", size: "S", intel: 3, wp: 8, maxWP: 8 },
    { name: "Skeleton", alive: false, type: "Walking Dead", size: "M", intel: 1, wp: 0, maxWP: 12 },
  ];
  const state = fixedState({ combat: fixedCombat(foes, { target: 0, first: "foe" }) });
  const vm = foeListViewModel(state);
  assert.equal(vm.hint, "TAP A FOE TO AIM AT IT");
  assert.equal(vm.threat, "THEY STRIKE FIRST");
  assert.equal(vm.alive, 2);
  assert.deepEqual(vm.cards[0], {
    i: 0, glyph: "◆", name: "GIANT RAT", meta: "S · INT 1 · BITES",
    wpLabel: "7 / 10", tag: "TARGET", tagTone: "target", pct: 70, alive: true, targeted: true, state: "target",
  });
  assert.deepEqual(vm.cards[2], {
    i: 2, glyph: "☗", name: "SKELETON", meta: "M · INT 1",
    wpLabel: "—", tag: "DOWN", tagTone: "dead", pct: 0, alive: false, targeted: false, state: "dead",
  });
});

test("foeListViewModel: threat label per C.first/C.pending", () => {
  const foe = { name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 5 };
  assert.equal(foeListViewModel(fixedState({ combat: fixedCombat([foe], { first: "you" }) })).threat, "YOU STRIKE FIRST");
  assert.equal(foeListViewModel(fixedState({ combat: fixedCombat([foe], { first: "foe" }) })).threat, "THEY STRIKE FIRST");
  assert.equal(foeListViewModel(fixedState({ combat: fixedCombat([foe], { pending: true }) })).threat, "INITIATIVE NOT YET ROLLED");
});

test("foeListViewModel: one foe alive — hint flips and no TARGET tag", () => {
  const foe = { name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 5 };
  const vm = foeListViewModel(fixedState({ combat: fixedCombat([foe], { target: 0 }) }));
  assert.equal(vm.hint, "ONE LEFT. AIM IS SIMPLE.");
  assert.equal(vm.cards[0].tag, "");
});

test("foeListViewModel: meta variants — no sp.note; size undefined", () => {
  const noNote = foeListViewModel(fixedState({ combat: fixedCombat([{ name: "Kobold", alive: true, type: "Beasts", size: "S", intel: 1, wp: 5, maxWP: 5 }]) }));
  assert.equal(noNote.cards[0].meta, "S · INT 1");

  const noSize = foeListViewModel(fixedState({ combat: fixedCombat([{ name: "Kobold", alive: true, type: "Beasts", intel: 1, wp: 5, maxWP: 5 }]) }));
  assert.equal(noSize.cards[0].meta, "? · INT 1");
});

test("foeListViewModel: glyph per type, unknown type falls back to default", () => {
  const demon = foeListViewModel(fixedState({ combat: fixedCombat([{ name: "Imp", alive: true, type: "Demons", wp: 5, maxWP: 5 }]) }));
  assert.equal(demon.cards[0].glyph, FOE_GLYPHS.Demons);

  const unknown = foeListViewModel(fixedState({ combat: fixedCombat([{ name: "???", alive: true, type: "Some New Thing", wp: 5, maxWP: 5 }]) }));
  assert.equal(unknown.cards[0].glyph, FOE_GLYPHS.default);
});

test("foeListViewModel: status chips beat TARGET (chipsFor supplied by the shell)", () => {
  const foes = [
    { name: "Giant Rat", alive: true, type: "Beasts", wp: 5, maxWP: 5 },
    { name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 5 },
  ];
  const state = fixedState({ combat: fixedCombat(foes, { target: 0 }) });
  const vm = foeListViewModel(state, { chipsFor: (f) => (f.name === "Giant Rat" ? ["Asleep", "Frozen"] : []) });
  assert.equal(vm.cards[0].tag, "ASLEEP · FROZEN");
  assert.equal(vm.cards[0].tagTone, "status");
});

// ─── yourLotViewModel ───────────────────────────────────────────────────────

test("yourLotViewModel: solo hero card", () => {
  const state = fixedState({ c: { wp: 27, maxWP: 34 } });
  const vm = yourLotViewModel(state);
  assert.equal(vm.hint, "JUST YOU · NOBODY TO BLAME");
  assert.equal(vm.cards.length, 1);
  assert.deepEqual(vm.cards[0], { kind: "hero", name: "TEST DELVER", wpLabel: "27/34", pct: 79, barTone: "ok", down: false, active: true, third: "SOLDIER" });
});

test("yourLotViewModel: a Magic User hero's third line is its spell charges", () => {
  const state = fixedState({ c: { cls: "Magic User", sub: "Wizard", level: 2, spellsUsed: 1 } });
  const vm = yourLotViewModel(state);
  assert.equal(vm.cards[0].third, `${maxCharges(state.c) - 1} CHARGES`);
});

test("yourLotViewModel: low bar tone (<=35%) and down (0 wp)", () => {
  const low = yourLotViewModel(fixedState({ c: { wp: 10, maxWP: 34 } }));
  assert.equal(low.cards[0].barTone, "low");

  const down = yourLotViewModel(fixedState({ c: { wp: 0, maxWP: 34 } }));
  assert.equal(down.cards[0].down, true);
  assert.equal(down.cards[0].wpLabel, "DOWN");
  assert.equal(down.cards[0].barTone, "down");
});

test("yourLotViewModel: one party member", () => {
  const state = fixedState({ party: [{ name: "Sidekick", sub: "Bard", wp: 12, maxWP: 20 }] });
  const vm = yourLotViewModel(state);
  assert.equal(vm.hint, "YOUR LOT · EACH ROLLS THEIR OWN");
  assert.equal(vm.cards.length, 2);
  assert.deepEqual(vm.cards[1], { kind: "member", name: "SIDEKICK", wpLabel: "12/20", pct: 60, barTone: "ok", down: false, active: false, third: "BARD" });
});

test("yourLotViewModel: a downed member reads DOWN", () => {
  const state = fixedState({ party: [{ name: "Sidekick", sub: "Bard", wp: 0, maxWP: 20, status: "downed" }] });
  const vm = yourLotViewModel(state);
  assert.equal(vm.cards[1].wpLabel, "DOWN");
  assert.equal(vm.cards[1].down, true);
  assert.equal(vm.cards[1].barTone, "down");
});

test("yourLotViewModel: a synthetic 3-member party overflows (PARTY_CAP is 1 today — RESEARCH Pitfall 10)", () => {
  const party = [
    { name: "A", sub: "Fighter", wp: 10, maxWP: 20 },
    { name: "B", sub: "Thief", wp: 10, maxWP: 20 },
    { name: "C", sub: "Bard", wp: 10, maxWP: 20 },
  ];
  const vm = yourLotViewModel(fixedState({ party }));
  assert.equal(vm.cards.length, 4);
  assert.equal(vm.overflow, true);
});

test("yourLotViewModel: a summoned ally appends its own card", () => {
  const state = fixedState({ combat: fixedCombat([], { ally: { name: "Bound Djinn", rounds: 3, lvl: 2 } }) });
  const vm = yourLotViewModel(state);
  const allyCard = vm.cards[vm.cards.length - 1];
  assert.deepEqual(allyCard, {
    kind: "ally", name: "BOUND DJINN", wpLabel: "3 ROUNDS", pct: 100, barTone: "ok", down: false, active: false, third: "SUMMONED · FIGHTS FOR YOU",
  });
});

// ─── encounterOverlaySpec ───────────────────────────────────────────────────

test("encounterOverlaySpec: one pending foe, untracked", () => {
  const state = fixedState({ combat: fixedCombat([{ name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 5 }], { tracked: false }) });
  assert.deepEqual(encounterOverlaySpec(state), {
    icon: "●",
    iconKey: "encounter",
    iconTone: "encounter",
    title: "SOMETHING IS HERE",
    line: "Kobold. They have noticed you.",
    roll: "encounter table d8, then d10",
    primary: { label: "FIGHT IT OUT", dispatch: { type: "fight" } },
    secondary: null,
  });
});

test("encounterOverlaySpec: 3 foes (a duplicate folded to ×2), tracked", () => {
  const foes = [
    { name: "Giant Rat", alive: true, type: "Beasts", wp: 5, maxWP: 5 },
    { name: "Giant Rat", alive: true, type: "Beasts", wp: 5, maxWP: 5 },
    { name: "Kobold", alive: true, type: "Beasts", wp: 5, maxWP: 5 },
  ];
  const state = fixedState({ combat: fixedCombat(foes, { tracked: true }) });
  const spec = encounterOverlaySpec(state);
  assert.equal(spec.title, "THEY ARE ALREADY HERE");
  assert.equal(spec.line, "Giant Rat ×2, Kobold. They have not noticed you yet.");
  assert.equal(spec.iconKey, "encounter");
});

// ─── FOE_GLYPHS coverage ────────────────────────────────────────────────────

test("FOE_GLYPHS covers every ENC_TYPES entry, plus default", () => {
  const keys = Object.keys(FOE_GLYPHS);
  for (const type of ENC_TYPES) assert.ok(keys.includes(type), `FOE_GLYPHS is missing an entry for ${type}`);
  assert.ok(keys.includes("default"));
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

test("COMBAT_PANEL_COPY and FOE_GLYPHS values are clear of content/safety-wordlist.js BANNED", () => {
  for (const [key, value] of Object.entries(COMBAT_PANEL_COPY)) {
    assert.deepEqual(findBannedTerms(value), [], `COMBAT_PANEL_COPY.${key} ("${value}") must be clear of BANNED terms`);
  }
  for (const [key, value] of Object.entries(FOE_GLYPHS)) {
    assert.deepEqual(findBannedTerms(value), [], `FOE_GLYPHS.${key} ("${value}") must be clear of BANNED terms`);
  }
});

// ─── Purity ─────────────────────────────────────────────────────────────────

test("combatPanel.js is pure: no window/document/innerHTML/Date.now", () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "combatPanel.js"), "utf8");
  for (const needle of ["window", "document", "innerHTML", "Date.now"]) {
    assert.doesNotMatch(src, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} must not appear in combatPanel.js`);
  }
});
