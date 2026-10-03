// test/unit/cloak-one-rule.test.js
//
// Phase 93 plan 03 (ITEM-08): the Cloak of Regeneration has ONE rule, and
// every place that states it says the same thing. User, 2026-10-02: "Cloak of
// Regeneration should do one tick of healing on activation, then after every x
// steps." Ruling B (2026-10-03): a d6 at once on use, then a d6 every ten
// squares walked, three more times (four d6 a use). This guard fails the day
// the item text, its card line, the ITEM-AUDIT row, the Regenerating chip's
// explanation, the start line, the 2.4.0 patch notes or the engine's instant
// tick disagree.
//
// Helpers mirror the per-file convention (copied, not imported).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { CLOAKS, ACTIVATION_OF } from "../../content/index.js";
import { GW, GH } from "../../engine/maze.js";
import { useItem } from "../../engine/items.js";
import { healTicksTotal } from "../../engine/derived.js";
import { itemStatLines } from "../../src/browser/viewModels.js";
import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { linesForAction } from "../../src/browser/narrationLines.js";
import { validatePatchNotes } from "../../tools/lib/patch-notes.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { setIdentityDials } from "./harness/identityDials.js";

setIdentityDials();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
const plain = (html) => String(html).replace(/<[^>]+>/g, "");

const CLOAK = "Cloak of Regeneration";
const ROW = CLOAKS.find((r) => r.n === CLOAK);
const TXT = ROW.txt;

// ─── helpers ────────────────────────────────────────────────────────────────

/** fakeRng — every draw throws: the instant tick must never touch the main rng. */
const noDraws = {
  d() { throw new Error("the main rng must not be drawn"); },
  pick: (arr) => arr[0],
  shuffle: (a) => a,
};

function fixedState() {
  const g = [];
  for (let y = 0; y < GH; y++) {
    g.push([]);
    for (let x = 0; x < GW; x++) g[y].push({ wall: true, dark: false, seen: false, feat: null });
  }
  for (const [x, y] of [[5, 5], [5, 4], [5, 6]]) g[y][x] = { wall: false, dark: false, seen: false, feat: null };
  return {
    version: 1, seed: 1, rngState: 1, acts: 0,
    c: {
      cls: "Fighter", sub: "Knight", race: "Human", level: 1, sp: 0,
      maxWP: 55, wp: 10, skills: {}, vp: 0,
      weapon: "Club", prof: 0, magicWpn: 0,
      armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x",
      potions: 0, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null,
      items: [], grimoire: [], spellsUsed: 0, kills: 0, might: 0, ward: null,
      regen: false, mirror: 0, foresight: false, name: "Test Delver",
      darkFor: 0, halfNext: false, worn: { cloak: { kind: "cloak", ...ROW } },
    },
    floor: { g, px: 5, py: 5, depth: 1 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [],
    dead: false, deathNote: "", epitaph: "",
    pendingJoiner: null, pendingFind: null,
  };
}

/** The shell sandbox the chip tests use, for CONDITION_EXPLAIN. */
function chipExplain() {
  const clock = createFakeClock({ start: 100000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion: true });
  return vm.runInContext("CONDITION_EXPLAIN.knit", sandbox.context);
}

/** The Items & gear bullet that starts "- Cloak of Regeneration:" in the 2.4.0 draft. */
function notesCloakBullet(md) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Items & gear");
  assert.ok(start >= 0, "the 2.4.0 notes have an Items & gear section");
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  const body = end === -1 ? rest : rest.slice(0, end);
  const bullet = body.find((l) => l.startsWith("- Cloak of Regeneration:"));
  assert.ok(bullet, "the Items & gear section carries the cloak bullet");
  return bullet;
}

/** The ITEM-AUDIT row of the cloak, as its six cells. */
function auditCells() {
  const line = read("docs/ITEM-AUDIT.md").split("\n").find((l) => l.startsWith("| Cloak of Regeneration |"));
  assert.ok(line, "docs/ITEM-AUDIT.md has a Cloak of Regeneration row");
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  assert.equal(cells.length, 6);
  return cells;
}

// ─── the focused checks ─────────────────────────────────────────────────────

test("content: the item text states a d6 at once, every ten squares, three more times, then fifty squares; the card prints it", () => {
  assert.match(TXT, /a d6 hp back at once/);
  assert.match(TXT, /every ten squares you walk/);
  assert.match(TXT, /three more times/);
  assert.match(TXT, /fifty squares/);
  const lines = itemStatLines({ kind: "cloak", ...ROW });
  const effect = lines.find((l) => l.key === "effect");
  assert.ok(effect, "the Gear, store and find cards print an effect line");
  assert.equal(effect.text, TXT);
});

test("docs: the ITEM-AUDIT row's Text cell is the item text, its verdict is the dated ruling, and Rulings records ITEM-08", () => {
  const cells = auditCells();
  assert.equal(cells[1], `"${TXT}"`);
  assert.equal(cells[4], "ruled (2026-10-03)");
  assert.match(cells[2], /at once on use/);
  assert.match(cells[3], /ruling B/);
  const rulings = read("docs/ITEM-AUDIT.md").split("\n## Rulings")[1];
  assert.ok(rulings && rulings.includes("ITEM-08 (2026-10-03"), "## Rulings carries the dated ITEM-08 entry");
});

test("chip copy: the Regenerating explanation says the first d6 came the moment the cloak was used, then ten squares, three more times", () => {
  const explain = chipExplain();
  assert.match(explain, /the moment you used/);
  assert.match(explain, /three more times/);
  assert.match(explain, /ten squares/);
  assert.doesNotMatch(explain, /\bWP\b/);
});

test("patch notes: 2.4.0 is a DRAFT that validates, and its cloak bullet states the same rule", () => {
  const md = read("docs/patch-notes/2.4.0.md");
  assert.ok(md.includes("**DRAFT, not yet agreed.**"));
  assert.deepEqual(validatePatchNotes(md, "2.4.0"), []);
  const bullet = notesCloakBullet(md);
  assert.match(bullet, /a d6 at once/);
  assert.match(bullet, /every ten squares walked/);
  assert.match(bullet, /three more times/);
  assert.ok(bullet.includes("→"), "old → new");
});

test("engine and lines: a real use heals at once (tick 1 of 4) after a start line that says so, on the Oracle and in the fight log", () => {
  const state = fixedState();
  const events = useItem(state, { slot: "cloak" }, noDraws, []);
  const at = events.findIndex((e) => e.type === "itemEffectStarted");
  assert.ok(at >= 0, "the use starts the knit window");
  const started = events[at];
  const first = events[at + 1];
  assert.equal(started.now, true);
  assert.equal(started.ticks, 3);
  assert.equal(first?.type, "healTick", "the instant heal is the very next event");
  assert.equal(first.tick, 1);
  assert.equal(first.ticks, 4);

  // the count is the same everywhere: four d6, the item says "three more"
  assert.equal(healTicksTotal(ACTIVATION_OF[CLOAK]), started.ticks + 1);
  assert.equal(healTicksTotal(ACTIVATION_OF[CLOAK]), 4);

  const startLine = plain(EVENT_NARRATION.itemEffectStarted(started));
  assert.match(startLine, /now, then every 10 squares you walk, 3 more times/);
  assert.match(plain(EVENT_NARRATION.healTick(first)), /Tick 1 of 4\./);

  const log = linesForAction("useItem", events).map((l) => l.text);
  assert.ok(log.some((t) => /\(1\/4\)\./.test(t)), `the fight log shows the tick: ${JSON.stringify(log)}`);
});

// ─── the guard ──────────────────────────────────────────────────────────────

test("one rule everywhere: the item text, its card line, the ITEM-AUDIT row, the chip explanation and the 2.4.0 patch notes all say a d6 at once, then three more every ten squares walked", () => {
  const surfaces = {
    "item text": TXT,
    "card line": itemStatLines({ kind: "cloak", ...ROW }).find((l) => l.key === "effect")?.text ?? "",
    "ITEM-AUDIT Text cell": auditCells()[1],
    "chip explanation": chipExplain(),
    "patch-notes bullet": notesCloakBullet(read("docs/patch-notes/2.4.0.md")),
  };
  for (const [name, text] of Object.entries(surfaces)) {
    assert.match(text, /\b(d6)\b/, `${name}: names the d6`);
    assert.match(text, /\bthree more times\b/, `${name}: three more times`);
    assert.match(text, /\bevery ten squares\b/, `${name}: every ten squares`);
  }
  for (const name of ["item text", "card line", "ITEM-AUDIT Text cell", "patch-notes bullet"]) {
    assert.match(surfaces[name], /\bat once\b/, `${name}: at once`);
  }
  assert.match(surfaces["chip explanation"], /the moment you used/);
  // the item text and the card line are one string
  assert.equal(surfaces["card line"], surfaces["item text"]);
  assert.equal(surfaces["ITEM-AUDIT Text cell"], `"${surfaces["item text"]}"`);
});
