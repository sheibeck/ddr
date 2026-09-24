// test/unit/shell-tab-snapshots.test.js
//
// Phase 47 (SHELL-01/02/03), Plan 01, Task 3 — ROADMAP Phase 47 criterion 5's
// lock and the milestone's standing 3-screen DOM smoke: the Gear tab, the
// Hero tab and the Store, painted by mazeworld.html's REAL classic paint()/
// renderEncounter() (test/unit/harness/shellSandbox.js) into a recording
// document (test/unit/harness/recordingDom.js), serialized and compared
// byte-for-byte against committed BEFORE fixtures under
// test/unit/fixtures/shell-snapshots/.
//
// Phase 62 (GSCR-01..06), Plan 02: the Gear tab's fixtures (thief.gear/
// mu.gear) now capture the rebuilt tab's five sections — header
// (#gear-stats), WORN (#gear-worn-head/#gear-worn), BAG (#gear-bag-head/
// #gear-bag-meter/#gear-bag), CONSUMABLES (#gear-cons-head/#gear-cons) and
// ALSO ON YOU (#gear-kit-head/#gear-kit) — replacing the retired Phase 43
// ON YOU/BAG panel ids. Deliberately regenerated and declared (this file's
// SUMMARY names the change); the Hero and Store fixtures are untouched.
//
// Phase 63 (GSCR-07..10), Plan 04: two new declared fixtures —
// thief.gear-sheet-bag and thief.gear-sheet-worn — capture the GEAR action
// sheet's six GEAR_SHEET_IDS roots (SNAPSHOT_IDS.gearSheet) for the bagged
// third jewel and the worn jewelry1 slot respectively. Every pre-existing
// fixture stayed byte-identical at the time.
//
// Phase 63, Plan 05: the interim in-row confirms (thief.gear-confirms) are
// removed — the Plan 04 sheet snapshots above (thief.gear-sheet-bag/-worn)
// replace them, and this plan's own row/card changes regenerate thief.gear
// and mu.gear again (every WORN row and BAG card is now a sheet opener, and
// the in-row Unequip/Bag-full block is gone). The Hero and Store fixtures
// stay untouched.
//
// Phase 71 (POLISH-06, D-04), Plan 02: four declared regenerations, every
// other fixture byte-identical. The item stat list now comes from ONE
// formatter (src/browser/viewModels.js#itemStatLines) that the store rows
// and the Gear sheet share:
//   - thief.gear-sheet-bag / thief.gear-sheet-worn: SNAPSHOT_IDS.gearSheet
//     gains the renderer-created #mw-gear-sheet-stats root (one
//     mw-gsheet-note row per stat), and the jewel's note empties and hides
//     because its effect text (and usable-by) now sits in the stats, once
//     (R-06).
//   - thief-store.store / mu-store.store: every stock line that wraps an
//     item renders its italic segment from the formatter — armour reads
//     "AR n · left/max hp" (was the engine's "AR n, wp hp"), the lockpicks
//     read their item text, and usable-by joins the stats with " · " before
//     the compare line instead of trailing after it. Food, rations, the
//     sealed scroll and repair keep their engine sub byte-for-byte (R-07).
//
// Fixtures are captured ONCE, before a later plan carves a single line out
// of the three render bodies — a diff after a carve means the carve moved
// the rendered DOM, never that the fixture needs updating. Regenerating a
// fixture requires a DECLARED, DELIBERATE DOM change with a written
// rationale (mirrors the engine-gate amendment's fixture-regeneration rule):
// re-run `MZ_SNAPSHOT_UPDATE=1 node --test test/unit/shell-tab-snapshots.test.js`
// only when a plan's own SUMMARY.md names the exact DOM change and why.
//
// MZ_SNAPSHOT_UPDATE=1: write (never compare) — the ONLY way any of these
// eight files are ever created or changed. A plain `node --test` run never
// writes a fixture (Task 3's own guard test below enforces this structurally
// — a missing/empty fixture is a hard failure, never a silent pass).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox, fixedStates, SNAPSHOT_IDS } from "./harness/shellSandbox.js";
import { setIdentityDials } from "./harness/identityDials.js";
import { dropShelfItems } from "../../src/browser/viewModels.js";
import { slotFor } from "../../engine/derived.js";

// Phase 54-07 (USER RULING G cycle 3): DIALS ships FITTED, not identity —
// this file's own pins are canon-mechanic numbers written before the fit
// existed, so it runs under an explicit identity override for its whole
// lifetime (test/unit/harness/identityDials.js).
setIdentityDials();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "fixtures", "shell-snapshots");
const UPDATE = process.env.MZ_SNAPSHOT_UPDATE === "1";

/** firstDiff(a, b) — the first differing 1-indexed line number and both
 * lines, for a legible assertion failure message on a real mismatch. */
function firstDiff(a, b) {
  const la = a.split("\n");
  const lb = b.split("\n");
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      return `line ${i + 1}:\n  got:      ${JSON.stringify(la[i] ?? "<missing>")}\n  expected: ${JSON.stringify(lb[i] ?? "<missing>")}`;
    }
  }
  return "(no line difference found — lengths differ only in trailing content)";
}

/** check(name, text) — MZ_SNAPSHOT_UPDATE=1 writes `<name>.txt`; otherwise a
 * missing fixture is a hard failure (never a silent pass) and a present one
 * is compared byte-for-byte, with a first-line-diff message on mismatch. */
function check(name, text) {
  const file = path.join(FIXTURE_DIR, `${name}.txt`);
  if (UPDATE) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(file, text, "utf8");
    return;
  }
  assert.ok(fs.existsSync(file), `missing fixture ${file} — run once with MZ_SNAPSHOT_UPDATE=1 to capture the BEFORE fixture`);
  // CRLF-tolerant: a Windows checkout (core.autocrlf=true, no .gitattributes)
  // rewrites a merged fixture with \r\n; the rendered text is always \n.
  const fixture = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  assert.equal(text, fixture, `${name}.txt mismatch — a diff here means the carve changed the rendered DOM (never the fixture): ${firstDiff(text, fixture)}`);
}

function paintFresh(state) {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  sandbox.setState(state);
  sandbox.paint();
  return { doc, sandbox };
}

const states = fixedStates();

// ─── 1/2: thief.hero, thief.gear ────────────────────────────────────────

test("SHELL-01/02: thief.hero — the Hero tab DOM for a fresh Thief", () => {
  const { doc } = paintFresh(states.thief);
  check("thief.hero", doc.serializeElements(SNAPSHOT_IDS.hero));
});

test("SHELL-01: thief.gear — the Gear tab DOM (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) for a fresh Thief with a full bag", () => {
  const { doc } = paintFresh(states.thief);
  check("thief.gear", doc.serializeElements(SNAPSHOT_IDS.gear));
});

// ─── 3b/3c (Phase 63, GSCR-07..10): the GEAR action sheet's two declared
// snapshots ────────────────────────────────────────────────────────────

test("SHELL-01 (Phase 63): thief.gear-sheet-bag — the bagged third jewel's sheet (both SWAP INTO slots plus DROP)", () => {
  const { doc, sandbox } = paintFresh(states.thief);
  const entry = dropShelfItems(states.thief.c).find(({ it }) => slotFor(it) === "jewelry");
  assert.ok(entry, "expected a bagged jewel in the thief fixture");
  sandbox.context.openGearSheet({ from: "bag", i: entry.i, n: entry.it.n }, "gear-open-bag-" + entry.i);

  const text = doc.serializeElements(SNAPSHOT_IDS.gearSheet);
  assert.ok(text.includes("SWAP INTO JEWELRY 1"), "expected a SWAP INTO JEWELRY 1 action (jewelry1 is worn)");
  assert.ok(text.includes("SWAP INTO JEWELRY 2"), "expected a SWAP INTO JEWELRY 2 action (jewelry2 is worn)");
  assert.ok(text.includes("DROP"), "expected the DROP action");
  check("thief.gear-sheet-bag", text);
});

test("SHELL-01 (Phase 63): thief.gear-sheet-worn — jewelry1 with UNEQUIP greyed by the full bag", () => {
  const { doc, sandbox } = paintFresh(states.thief);
  sandbox.context.openGearSheet({ from: "worn", slot: "jewelry1" }, "gear-open-worn-jewelry1");

  const text = doc.serializeElements(SNAPSHOT_IDS.gearSheet);
  assert.ok(text.includes("Bag is full — free a slot first."), "expected UNEQUIP's bag-full reason");
  assert.ok(text.includes("UNEQUIP"), "expected the UNEQUIP action label");
  check("thief.gear-sheet-worn", text);
});

// ─── 4: thief-store.store ───────────────────────────────────────────────

test("SHELL-01: thief-store.store — a full-bag Thief's store screen", () => {
  const { doc, sandbox } = paintFresh(states.thiefStore);
  sandbox.renderEncounter();
  const text = doc.serializeElements(SNAPSHOT_IDS.store);
  assert.ok(text.includes("Bag full ("), "expected the bag-full store line");
  assert.ok(text.includes("sold") || text.includes(" wm"), "expected at least one priced or sold shelf row");
  check("thief-store.store", text);
});

// ─── 5/6: mu.hero, mu.gear ───────────────────────────────────────────────

test("SHELL-02: mu.hero — the Hero tab DOM for a Magic User with a joined party member", () => {
  const { doc } = paintFresh(states.mu);
  const text = doc.serializeElements(SNAPSHOT_IDS.hero);
  assert.ok(text.includes("Spells are the trick."), "expected the Magic User abilities-list copy");
  assert.ok(text.includes("mw-party-member"), "expected the joined party member's Company panel card");
  check("mu.hero", text);
});

test("SHELL-01: mu.gear — the Gear tab DOM (header/WORN/BAG/CONSUMABLES/ALSO ON YOU) for a Magic User with every worn slot empty", () => {
  const { doc } = paintFresh(states.mu);
  check("mu.gear", doc.serializeElements(SNAPSHOT_IDS.gear));
});

// ─── 7: mu-store.store ───────────────────────────────────────────────────

test("SHELL-01: mu-store.store — a Magic User's store screen with nothing to sell", () => {
  const { doc, sandbox } = paintFresh(states.muStore);
  sandbox.renderEncounter();
  check("mu-store.store", doc.serializeElements(SNAPSHOT_IDS.store));
});

// ─── 8: SHELL-03 idempotency — a second renderEncounter() never duplicates ─

test("SHELL-03: rendering the store twice from the same state serializes byte-equal (no duplicate rows)", () => {
  const { doc, sandbox } = paintFresh(states.thiefStore);
  sandbox.renderEncounter();
  const first = doc.serializeElements(SNAPSHOT_IDS.store);
  const firstGoodsCount = (first.match(/class="goods/g) || []).length;
  assert.ok(firstGoodsCount >= 1, "expected at least one store 'goods' row to compare against");

  sandbox.renderEncounter();
  const second = doc.serializeElements(SNAPSHOT_IDS.store);
  const secondGoodsCount = (second.match(/class="goods/g) || []).length;

  assert.equal(second, first, "a second renderEncounter() on the same state must serialize byte-identically to the first — never a duplicate row");
  assert.equal(secondGoodsCount, firstGoodsCount, "the store's 'goods' row count must not change on a repeat render");
});

// ─── 9: serializer / paint() determinism ────────────────────────────────

test("determinism: two independent sandboxes painting the same fixed state serialize identically", () => {
  const a = paintFresh(states.thief);
  const b = paintFresh(states.thief);
  const idsAB = SNAPSHOT_IDS.hero.concat(SNAPSHOT_IDS.gear);
  assert.equal(a.doc.serializeElements(idsAB), b.doc.serializeElements(idsAB));
});

// ─── 10: guard — a plain run must never pass on a missing/empty fixture ────

test("guard: all eight fixtures exist and are non-empty (a plain run never writes one)", { skip: UPDATE && "capture mode — the guard only applies to a compare run" }, () => {
  const names = [
    "thief.hero",
    "thief.gear",
    "thief.gear-sheet-bag",
    "thief.gear-sheet-worn",
    "thief-store.store",
    "mu.hero",
    "mu.gear",
    "mu-store.store",
  ];
  for (const name of names) {
    const file = path.join(FIXTURE_DIR, `${name}.txt`);
    assert.ok(fs.existsSync(file), `missing fixture ${file}`);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 0, `fixture ${file} is empty`);
  }
});
