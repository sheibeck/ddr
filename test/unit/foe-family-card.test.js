// test/unit/foe-family-card.test.js
//
// Phase 77 (CMBUI-09), Plan 06 — each foe card names its bestiary family
// after the foe's name ("ZIT · BEASTS"). The user's 2026-09-21 report:
// "enemy type should be listed after their name on the combat screen".
//
// The family is the spawned foe record's own `type` (the BESTIARY key),
// upper-cased. It stays hidden when `type` is missing or not an ENC_TYPES
// key, exactly where foe details (src/browser/foeDetails.js) prints FAMILY
// UNKNOWN, so the card never reveals more than the game has identified.
//
// Three layers: the pure helper (foeFamily), the view model (each card's
// `family`), and the real shell render (renderEncounter in the sandbox).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ENC_TYPES } from "../../content/bestiary.js";
import { foeFamily, foeListViewModel } from "../../src/browser/combatPanel.js";
import { foeDetailsCard, FOE_DETAILS_COPY } from "../../src/browser/foeDetails.js";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");

const combatOf = (foes) => ({ combat: { foes, target: 0, pending: false, first: "you", round: 1 } });
const foe = (name, type, extra = {}) => ({ name, type, size: "S", intel: 1, wp: 5, maxWP: 5, alive: true, sp: {}, ...extra });

// ─── foeFamily ──────────────────────────────────────────────────────────────

test("CMBUI-09: foeFamily upper-cases every ENC_TYPES key in the bestiary's own wording", () => {
  const expected = {
    Beasts: "BEASTS",
    Demons: "DEMONS",
    Humans: "HUMANS",
    "Lair Beasts": "LAIR BEASTS",
    Magical: "MAGICAL",
    "Walking Dead": "WALKING DEAD",
  };
  assert.deepEqual([...ENC_TYPES].sort(), Object.keys(expected).sort(), "a new ENC_TYPES key must be added here");
  for (const type of ENC_TYPES) assert.equal(foeFamily(foe("Zit", type)), expected[type], type);
});

test("CMBUI-09: foeFamily is null for a missing, non-string or unknown type, and never throws", () => {
  assert.equal(foeFamily(foe("Zit", undefined)), null);
  assert.equal(foeFamily(foe("Zit", null)), null);
  assert.equal(foeFamily(foe("Zit", 3)), null);
  assert.equal(foeFamily(foe("Zit", "")), null);
  assert.equal(foeFamily(foe("Zit", "Some New Thing")), null);
  // A near miss is still unknown: the family is never guessed.
  assert.equal(foeFamily(foe("Zit", "beasts")), null);
  assert.equal(foeFamily(foe("Zit", "Lair Beast")), null);
  assert.equal(foeFamily(null), null);
  assert.equal(foeFamily(undefined), null);
  assert.equal(foeFamily("Beasts"), null);
  const hostile = {};
  Object.defineProperty(hostile, "type", { get() { throw new Error("hostile getter"); } });
  assert.equal(foeFamily(hostile), null);
});

test("CMBUI-09: the family comes only from `type`, never from the name", () => {
  assert.equal(foeFamily({ name: "Beasts", type: "Humans" }), "HUMANS");
  assert.equal(foeFamily({ name: "Walking Dead Thing" }), null);
});

test("CMBUI-09: foeFamily agrees with foe details' family line for every ENC_TYPES key and an unknown one", () => {
  for (const type of [...ENC_TYPES, "Some New Thing", undefined]) {
    const f = foe("Zit", type);
    const detailsLine = foeDetailsCard(0, combatOf([f])).lines[0].text;
    const fam = foeFamily(f);
    if (fam === null) {
      assert.ok(detailsLine.startsWith(FOE_DETAILS_COPY.familyUnknown), `${type}: details reads ${detailsLine}`);
    } else {
      assert.ok(detailsLine.startsWith(`${fam} · `), `${type}: details reads ${detailsLine}, card family ${fam}`);
    }
  }
});

// ─── the card view model ────────────────────────────────────────────────────

test("CMBUI-09: every card carries `family`; an elite's title stays part of the name", () => {
  const vm = foeListViewModel(combatOf([foe("Dread Zit", "Beasts"), foe("Ghoul", "Walking Dead"), foe("Glitch", "Some New Thing")]));
  assert.equal(vm.cards[0].name, "DREAD ZIT");
  assert.equal(vm.cards[0].family, "BEASTS");
  assert.equal(vm.cards[1].family, "WALKING DEAD");
  assert.equal(vm.cards[2].family, null);
  assert.equal(vm.cards[2].name, "GLITCH");
});

test("CMBUI-09 adjacency: two same-name foes both carry the family; a dead foe keeps it and its DOWN tag", () => {
  const vm = foeListViewModel(combatOf([foe("Ned", "Humans"), foe("Ned", "Humans"), foe("Ned", "Humans", { alive: false, wp: 0 })]));
  for (const c of vm.cards) {
    assert.equal(c.name, "NED");
    assert.equal(c.family, "HUMANS");
  }
  assert.equal(vm.cards[2].tag, "DOWN");
  assert.equal(vm.cards[2].state, "dead");
});

test("CMBUI-09 ordering: the family is the only addition to a card", () => {
  const f = foe("Zit", "Beasts", { sp: { note: "bites" } });
  const card = foeListViewModel(combatOf([f])).cards[0];
  assert.deepEqual(Object.keys(card), ["i", "glyph", "name", "family", "meta", "wpLabel", "tag", "tagTone", "pct", "alive", "targeted", "state"]);
  assert.equal(card.meta, "S · INT 1 · BITES", "the meta line never repeats the family");
});

// ─── the real shell render ──────────────────────────────────────────────────

function renderFoes(foes) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  const state = {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0,
    },
    floor: { g, px: 1, py: 1, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
  state.combat = {
    foes: foes.map((f) => ({ lvl: 1, asleep: 0, lives: 1, ...f })),
    type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  w.__mzState.set(state);
  sandbox.context.renderEncounter();
  const body = doc.document.getElementById("enc-body");
  return Array.from(body.querySelectorAll(".cb-foe"));
}

test("CMBUI-09 (sandbox): a foe card's name line holds the name, then a muted family span", () => {
  const cards = renderFoes([foe("Zit", "Beasts"), foe("Ghoul", "Walking Dead", { alive: false, wp: 0 }), foe("Glitch", "Some New Thing")]);
  const nameOf = (el) => el.querySelector(".cb-foe-name");
  const famOf = (el) => el.querySelector(".cb-foe-family");

  // The name text itself still equals the card name (the family is a child span after it).
  assert.equal(nameOf(cards[0])._content.value, "ZIT");
  assert.equal(famOf(cards[0]).textContent, " · BEASTS");
  assert.equal(famOf(cards[0]).parentNode, nameOf(cards[0]));

  // A dead foe keeps its family and its DOWN tag.
  assert.equal(famOf(cards[1]).textContent, " · WALKING DEAD");
  assert.equal(cards[1].querySelector(".cb-foe-tag").textContent, "DOWN");

  // An unknown family renders no span and no separator.
  assert.equal(famOf(cards[2]), null);
  assert.equal(nameOf(cards[2])._content.value, "GLITCH");
  assert.doesNotMatch(nameOf(cards[2]).textContent, /·/);
});

test("CMBUI-09 (sandbox): two same-name foes each show NAME · FAMILY; tap-to-aim is unchanged", () => {
  const cards = renderFoes([foe("Ned", "Humans"), foe("Ned", "Humans")]);
  assert.equal(cards.length, 2);
  for (const el of cards) {
    assert.equal(el.querySelector(".cb-foe-name")._content.value, "NED");
    assert.equal(el.querySelector(".cb-foe-family").textContent, " · HUMANS");
    assert.equal(el.getAttribute("role"), "button");
  }
});

test("CMBUI-09 CSS: .cb-foe-family is muted and smaller than the name", () => {
  const rule = HTML.match(/\.cb-foe-family\{([^}]*)\}/);
  assert.ok(rule, ".cb-foe-family{...} rule must exist");
  assert.match(rule[1], /color:#a89c82/, "the family uses the meta line's muted colour");
  const size = /font-size:(\d+(?:\.\d+)?)px/.exec(rule[1]);
  assert.ok(size && Number(size[1]) < 8, "the family is smaller than the 8px name");
});
