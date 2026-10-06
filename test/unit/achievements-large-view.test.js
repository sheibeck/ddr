// test/unit/achievements-large-view.test.js
//
// Quick 261005-vhn: tap an earned achievement icon to see it large. The view
// model gives EARNED entries (a single row, a track's top earned tier, an
// earned rung) a `large` object; locked and secret entries get none. The
// renderer turns that into a labelled icon button, laid over the icon, that
// never toggles a track and calls opts.onLarge. The shell half (the overlay,
// back, focus return) is pinned in achievements-sheet-shell.test.js (E1-E6).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ACHIEVEMENTS } from "../../content/achievements.js";
import { emptyRecord, sanitizeRecord } from "../../src/browser/achievementRecord.js";
import { achievementLargeSrc, ACHIEVEMENT_LARGE_DIR } from "../../src/browser/achievementCard.js";
import { ACHIEVEMENTS_SHEET_COPY, buildAchievementsView, renderAchievementsSheet } from "../../src/browser/achievementsSheet.js";
import { createRecordingDocument } from "./harness/recordingDom.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const HIDDEN = ACHIEVEMENTS.filter((e) => e.initialState === "Hidden");
const rec = (over) => sanitizeRecord({ v: 1, ...over });
const T_A = Date.UTC(2026, 9, 1, 12, 0, 0);
const T_B = Date.UTC(2026, 9, 5, 12, 0, 0);

const allRows = (view) => view.blocks.flatMap((b) => b.rows);
const byName = (view, name) => allRows(view).find((r) => r.name === name);

function newHost() {
  const { document } = createRecordingDocument();
  return document.createElement("div");
}
function walk(node, fn) {
  fn(node);
  for (const child of node.children || []) walk(child, fn);
}
function findAll(root, pred) {
  const out = [];
  walk(root, (n) => {
    if (n.nodeType === 1 && pred(n)) out.push(n);
  });
  return out;
}
const hasClass = (n, c) => (n.className || "").split(/\s+/).includes(c);
const byClass = (root, c) => findAll(root, (n) => hasClass(n, c));
const render = (view, opts) => {
  const host = newHost();
  return { host, root: renderAchievementsSheet(host, view, opts) };
};

const BEASTS_PARTIAL = rec({ kills: { Beasts: 137 }, unlocked: { kills_beasts_t1: T_A, kills_beasts_t2: T_B } });
const DEPTH_ONE = rec({ unlocked: { depth_t1: T_A } });

// --- the 320 px assets and the path --------------------------------------------

test("achievementLargeSrc: achievements/large/ plus the ingame file stem, null for an unknown entry", () => {
  assert.equal(ACHIEVEMENT_LARGE_DIR, "achievements/large/");
  for (const e of ACHIEVEMENTS) {
    assert.equal(achievementLargeSrc(e), "achievements/large/" + path.basename(e.icon.ingame));
    assert.equal(achievementLargeSrc(e.id), achievementLargeSrc(e));
    assert.ok(fs.existsSync(path.join(REPO_ROOT, achievementLargeSrc(e))), `${e.id}: large file exists`);
  }
  assert.equal(achievementLargeSrc("nope"), null);
  assert.equal(achievementLargeSrc(null), null);
});

// --- the view model --------------------------------------------------------------

test("view: an empty record has no large view anywhere (rows or rungs), secrets included", () => {
  const view = buildAchievementsView(emptyRecord());
  for (const row of allRows(view)) {
    assert.equal(row.large, null, `${row.key}`);
    for (const rung of row.rungs) assert.equal(rung.large, null);
  }
});

test("view: a single earned row gets a large view with its name, line, date and the 320 px art", () => {
  const view = buildAchievementsView(DEPTH_ONE);
  const entry = ACHIEVEMENTS.find((e) => e.id === "depth_t1");
  const row = byName(view, entry.name) ?? allRows(view).find((r) => r.kind === "track" && r.rungs.some((x) => x.name === entry.name));
  assert.ok(row);
  assert.ok(row.large, "the depth track has an earned tier, so its head has a large view");
  assert.equal(row.large.src, "achievements/large/ach_depth_t1.png");
  assert.equal(row.large.name, entry.name);
  assert.equal(row.large.line, entry.line);
  assert.equal(row.large.stateText, `Earned 1 Oct 2026`);
  assert.equal(row.large.label, `${entry.name}, view larger`);
  assert.equal(row.large.label, ACHIEVEMENTS_SHEET_COPY.viewLarger.replace("{name}", entry.name));
});

test("view: a track head opens its TOP earned tier; each earned rung opens itself; locked rungs open nothing", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const row = allRows(view).find((r) => r.name === "Body Count: Beasts");
  assert.equal(row.large.src, "achievements/large/ach_kills_beasts_t2.png");
  assert.equal(row.large.name, row.rungs[1].name);
  assert.equal(row.large.line, row.rungs[1].text);
  assert.equal(row.large.stateText, row.rungs[1].stateText);
  assert.deepEqual(
    row.rungs.map((r) => (r.large ? r.large.src : null)),
    ["achievements/large/ach_kills_beasts_t1.png", "achievements/large/ach_kills_beasts_t2.png", null, null],
  );
  const keys = [row.large.key, ...row.rungs.filter((r) => r.large).map((r) => r.large.key)];
  assert.equal(new Set(keys).size, keys.length, "every button has its own key");
});

test("view: a track with no earned tier has no large view on its head", () => {
  const view = buildAchievementsView(emptyRecord());
  assert.equal(allRows(view).find((r) => r.kind === "track").large, null);
});

test("view (secrets): an unearned Hidden entry has no large view and nothing in the view mentions its name or art", () => {
  const view = buildAchievementsView(emptyRecord());
  const text = JSON.stringify(view);
  for (const e of HIDDEN) {
    const row = allRows(view).find((r) => r.state === "secret" && r.iconSrc === "achievements/" + e.icon.ingame);
    assert.ok(row, `${e.id} shows as a secret row`);
    assert.equal(row.large, null);
    assert.equal(text.includes(e.name), false, `${e.id} name must not leak`);
    assert.equal(text.includes(e.line), false, `${e.id} line must not leak`);
    assert.equal(text.includes(achievementLargeSrc(e)), false, `${e.id} large art path must not leak`);
  }
});

test("view (secrets): a revealed-but-unearned Hidden entry is still inert; an earned one opens", () => {
  const e = HIDDEN[0];
  const revealed = buildAchievementsView(rec({ revealed: [e.id] }));
  const rrow = allRows(revealed).find((r) => r.name === e.name);
  assert.ok(rrow);
  assert.equal(rrow.state, "locked");
  assert.equal(rrow.large, null);
  const earned = buildAchievementsView(rec({ unlocked: { [e.id]: T_A } }));
  const erow = allRows(earned).find((r) => r.name === e.name);
  assert.equal(erow.state, "earned");
  assert.equal(erow.large.src, achievementLargeSrc(e));
});

test("view: the large objects are deeply frozen with the rest of the view", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const row = allRows(view).find((r) => r.name === "Body Count: Beasts");
  assert.ok(Object.isFrozen(row.large));
  assert.ok(Object.isFrozen(row.rungs[0].large));
});

// --- the renderer ----------------------------------------------------------------

test("render: the icon button exists only for earned entries, is labelled '<name>, view larger' and sits before the head", () => {
  const view = buildAchievementsView(rec({ ...BEASTS_PARTIAL, unlocked: { ...BEASTS_PARTIAL.unlocked, special_snowflake: T_A } }));
  const { root } = render(view, { expanded: [allRows(view).find((r) => r.name === "Body Count: Beasts").key] });
  const buttons = byClass(root, "mw-ach-large-open");
  const expected = allRows(view).reduce((n, r) => n + (r.large ? 1 : 0) + r.rungs.filter((x) => x.large).length, 0);
  assert.equal(buttons.length, expected);
  assert.ok(buttons.length >= 4, "a track head, two earned rungs and an earned single");
  for (const b of buttons) {
    assert.equal(b.tagName, "button");
    assert.equal(b.getAttribute("type"), "button");
    assert.match(b.getAttribute("aria-label"), /, view larger$/);
    assert.ok(b.getAttribute("data-large"));
  }
  // every row's li: the head button, when present, comes first and the head follows it
  for (const li of byClass(root, "mw-ach-row")) {
    const kids = (li.children || []).filter((c) => c.nodeType === 1);
    const open = kids.filter((k) => hasClass(k, "mw-ach-head-open"));
    const state = li.getAttribute("data-state");
    if (state === "locked" || state === "secret") assert.equal(open.length, 0);
    if (open.length) {
      assert.equal(kids[0], open[0]);
      assert.ok(hasClass(kids[1], "mw-ach-head"));
    }
  }
});

test("render: locked and secret rows (and locked rungs) have no button, and their icons stay decorative images", () => {
  const view = buildAchievementsView(emptyRecord());
  const { root } = render(view, { expanded: allRows(view).filter((r) => r.expandable).map((r) => r.key) });
  assert.equal(byClass(root, "mw-ach-large-open").length, 0);
  const imgs = findAll(root, (n) => n.tagName === "img");
  assert.ok(imgs.length > 77);
  for (const img of imgs) {
    assert.equal(img.getAttribute("alt"), "");
    assert.equal(img.getAttribute("aria-hidden"), "true");
  }
});

test("render: no secret leak in the DOM (every Hidden entry's name, line and art path, outside img src of the small icon)", () => {
  const view = buildAchievementsView(emptyRecord());
  const { root } = render(view);
  const attrs = [];
  walk(root, (n) => {
    if (n.nodeType === 1) for (const a of ["aria-label", "data-large", "data-key", "alt"]) if (n.getAttribute(a)) attrs.push(n.getAttribute(a));
  });
  const blob = JSON.stringify(attrs);
  for (const e of HIDDEN) {
    assert.equal(blob.includes(e.name), false, `${e.id} name in an attribute`);
    assert.equal(blob.includes(e.id), false, `${e.id} id in an attribute`);
    assert.equal(blob.includes("large"), false, "no large-view hook anywhere on an empty record");
  }
});

test("render: tapping the icon button calls onLarge(large, button) and never the track toggle", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const key = allRows(view).find((r) => r.name === "Body Count: Beasts").key;
  const toggles = [];
  const larges = [];
  const { root } = render(view, { expanded: [key], onToggle: (k) => toggles.push(k), onLarge: (l, b) => larges.push([l, b]) });
  const headButton = byClass(root, "mw-ach-head-open")[0];
  const stops = [];
  headButton.onclick({ stopPropagation: () => stops.push(1) });
  assert.equal(toggles.length, 0, "the icon button does not toggle the track");
  assert.equal(larges.length, 1);
  assert.equal(larges[0][1], headButton);
  assert.equal(larges[0][0].src, "achievements/large/ach_kills_beasts_t2.png");
  assert.equal(stops.length, 1);
  // a rung's button opens that rung
  const rungButtons = byClass(root, "mw-ach-rung-open");
  assert.equal(rungButtons.length, 2);
  rungButtons[0].onclick();
  assert.equal(larges[1][0].src, "achievements/large/ach_kills_beasts_t1.png");
  // the head itself still toggles
  const li = byClass(root, "mw-ach-row").find((n) => n.getAttribute("data-key") === key);
  byClass(li, "mw-ach-head")[0].onclick();
  assert.deepEqual(toggles, [key]);
});

test("render: a button tapped with no onLarge handler is a harmless no-op", () => {
  const view = buildAchievementsView(DEPTH_ONE);
  const { root } = render(view);
  const b = byClass(root, "mw-ach-large-open")[0];
  assert.ok(b);
  assert.doesNotThrow(() => b.onclick());
});

test("render: every rung shows an icon (the earned one behind its button, a locked one dimmed)", () => {
  const view = buildAchievementsView(BEASTS_PARTIAL);
  const key = allRows(view).find((r) => r.name === "Body Count: Beasts").key;
  const { root } = render(view, { expanded: [key] });
  const rungIcons = byClass(root, "mw-ach-rung-icon");
  assert.equal(rungIcons.length, 4);
  assert.deepEqual(
    rungIcons.map((i) => hasClass(i, "mw-ach-icon-dim")),
    [false, false, true, true],
  );
});
