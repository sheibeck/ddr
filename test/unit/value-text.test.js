// test/unit/value-text.test.js
//
// Phase 91.1 plan 05 (VALUE-01, VALUE-04) -- one pin per TEXT-ONLY ruling of the value review (docs/VALUE-LEDGER.md
// "## Rulings" and "## Build ownership"), each titled with its question id. A text-only ruling changes words, never a rule:
//
//   V26 A (2026-10-01): the Ninja's later crit and the Cutthroat's first crit keep ignoring the dark (they are the shadow
//        classes); the text says so: "even in the dark". (V27 was changed to B and is BUILT in 91.1-03, not text-only.)
//   V7 B  (91.1-03 built the engine): the Sing row of docs/SKILL-AUDIT.md and SING_TEXT in test/unit/skill-audit.test.js
//        still quoted the retired once-per-100-squares text; both now quote the live COMBAT_MENU_COPY.singDesc.
//
// The line the player reads is read through the real content (`identityEntries`, `SUB_NOTE`, `BLURB_ANCHORS`) and the engine's
// own strike, never typed; the engine half proves the words are TRUE (a dark first blow of a Cutthroat crits, a Ninja's later
// blow crits, and an ordinary Thief's dark blow does not).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { playerStrike, SONG_GAP_ROUNDS } from "../../engine/combat.js";
import { darkLimited } from "../../engine/derived.js";
import { identityEntries } from "../../src/browser/identityFooter.js";
import { SUB_NOTE } from "../../content/flavor.js";
import { BLURB_ANCHORS } from "../../content/identity.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const readLF = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const footerLine = (sub, id) => identityEntries("sub", sub).find((e) => e.id === id)?.text;
const anchor = (sub, id) => new RegExp(BLURB_ANCHORS.sub[sub][id].blurb, "i");

// ─── the engine half: a strike in the dark ─────────────────────────────────

const BASE = newRun(1);

/** fakeRng(seq) — `.d()` pops the next raw value (a raw 1 mirrors to the best roll), throws on underflow. */
function fakeRng(seq) {
  let i = 0;
  return {
    d() {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (a) => a[0],
    shuffle: (a) => a,
    getState: () => 1,
  };
}

/** darkStrike(sub, combat) -- a level 1 Human Thief of that sub-class on a Club, on a DARK tile, no light and no Night Vision. */
function darkStrike(sub, combat = {}) {
  const s = structuredClone(BASE);
  Object.assign(s.c, { race: "Human", cls: "Thief", sub, level: 1, weapon: "Club" });
  if (!s.c.timers || typeof s.c.timers !== "object") s.c.timers = {};
  if (s.c.skills) delete s.c.skills["Night Vision"];
  s.floor.g[s.floor.py][s.floor.px].dark = true;
  s.combat = {
    foes: [{ name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 300, maxWP: 300, alive: true, asleep: 0, sp: {}, lives: 1 }],
    type: "Beasts", round: 1, target: 0, spellOpen: false, tracked: false, ...combat,
  };
  assert.equal(darkLimited(s), true, "the fixture is a real dark fight (no light, no Night Vision)");
  const events = playerStrike(s, fakeRng(new Array(40).fill(1)), []);
  return events.filter((e) => e.type === "struck");
}

// ─── V26 Cutthroat ─────────────────────────────────────────────────────────

test("V26 Cutthroat cutthroat-crit: the footer and the blurb say the first landed blow crits even in the dark", () => {
  const line = footerLine("Cutthroat", "cutthroat-crit");
  assert.match(line, /first landed blow always crits, even in heavy armour and even in the dark/);
  assert.match(SUB_NOTE.Cutthroat, /Double damage on your first landed blow, even in heavy armour and even in the dark/);
  assert.match(SUB_NOTE.Cutthroat, anchor("Cutthroat", "cutthroat-crit"), "the blurb anchor holds the new wording");
  assert.match(BLURB_ANCHORS.sub.Cutthroat["cutthroat-crit"].blurb, /even in the dark/);
});

test("V26 Cutthroat cutthroat-crit: the engine keeps the ruling, a Cutthroat's first landed blow crits by cutthroat in the dark and a plain Thief's blow does not", () => {
  const cut = darkStrike("Cutthroat");
  assert.ok(cut.length >= 1);
  assert.equal(cut[0].critical, true, "the first landed blow crits in the dark");
  assert.equal(cut[0].critBy, "cutthroat");
  for (const e of darkStrike("Pickpocket")) assert.equal(e.critical, false, "every other Thief's blow in the dark is no crit (the dark no-crit ban stands)");
});

// ─── V26 Ninja ─────────────────────────────────────────────────────────────

test("V26 Ninja ninja-crit: the footer and the blurb say the later crit works even in the dark, on the top two numbers (19–20 on a d20)", () => {
  const line = footerLine("Ninja", "ninja-crit");
  assert.equal(line, "after that, you crit on the top two numbers of your strike die (19–20 on a d20), even in the dark");
  assert.match(SUB_NOTE.Ninja, /crit on the top two numbers of your strike die \(19–20 on a d20\), even in the dark/);
  assert.match(SUB_NOTE.Ninja, anchor("Ninja", "ninja-crit"), "the blurb anchor holds the new wording");
  // the opener's own line is unchanged: the backstab doubling IS denied in the dark, and it still says so
  assert.match(footerLine("Ninja", "ninja-opener"), /doubled by the backstab unless you are in heavy armour or the dark/);
});

test("V26 Ninja ninja-crit: the engine keeps the ruling, a Ninja's later blow crits by ninja in the dark and a plain Thief's later blow does not", () => {
  const later = { opened: true, opened2: true }; // the opener is spent: these are the 'after that' blows
  const ninja = darkStrike("Ninja", later);
  assert.ok(ninja.length >= 1);
  assert.equal(ninja[0].critical, true, "a later blow in the top two numbers crits in the dark");
  assert.equal(ninja[0].critBy, "ninja");
  for (const e of darkStrike("Pilfer", later)) assert.equal(e.critical, false, "an ordinary Thief's later blow in the dark is no crit");
});

// ─── V7 Sing: the audit row and its test constant quote the live text ──────

test("V7 Sing text: docs/SKILL-AUDIT.md's Sing row and skill-audit.test.js's SING_TEXT quote the live combat-menu text (two songs a fight), not the retired hundred squares", () => {
  const live = COMBAT_MENU_COPY.singDesc;
  assert.match(live, new RegExp(`a second song ${SONG_GAP_ROUNDS} rounds after the first, and never a third`));
  const doc = readLF("docs/SKILL-AUDIT.md");
  const row = doc.split("\n").find((l) => l.startsWith("| Sing |"));
  assert.ok(row, "the audit has a Sing row");
  assert.ok(row.includes(live), "the Text cell is the live singDesc");
  assert.doesNotMatch(row, /hundred squares|100 squares|every 50 squares/);
  const test_ = readLF("test/unit/skill-audit.test.js");
  assert.match(test_, /const SING_TEXT = COMBAT_MENU_COPY\.singDesc;/, "SING_TEXT reads the live text");
  assert.doesNotMatch(test_, /then a hundred squares before the next/);
});
