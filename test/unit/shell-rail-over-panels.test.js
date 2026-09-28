// test/unit/shell-rail-over-panels.test.js
//
// Quick task 260927-r4v (user, 2026-09-27: "raise it"): a rail card raised
// while the store, the loot screen or the stair prompt is open shows OVER
// that screen, the way the combat cards already do (Phase 71,
// #mw-rail[data-over="combat"]). Those three screens all live in the
// #enc-panel overlay (z-index 8); the base rail is z-index 4, so before
// this fix a BUY's "WELL THEN" card, a refusal, or any other card drew
// UNDER the 94%-opaque overlay and the player never saw it.
//
// The user's standing rule from the same device report (260927-s7b): "hide
// the buttons while the bottom rails are visible. Once they are dismissed,
// the buttons should show again." So while a card is up over one of those
// screens, its bottom action row (the store's Leave row, the loot screen's
// TAKE ALL / LEAVE ALL, the stair prompt's GO DOWN / NOT YET) is hidden IN
// PLACE: visibility only (it keeps its box, nothing reflows), and its
// buttons take no taps. It comes back in the same spot on every dismissal.
//
// Sandbox: the REAL renderEncounter and renderRail (loadShellSandbox with
// stubRail:false), a fake clock driving every hold timer and arm stamp.
//   (a) the store: a card shows over it (data-over="panel", z 8, painted
//       after the overlay), and the Leave row is hidden in place, untappable
//   (b) every dismissal path brings the Leave row back: the hold running
//       out, an armed body tap, a card replacing a card (stays hidden until
//       the last one goes), the store closing under the card
//   (c) the same for the loot screen and the stair prompt
//   (d) a decision card over these screens stays fully usable (its buttons
//       live in #mw-rail, outside every hide rule, and fire once armed)
//   (e) the combat precedent is unchanged
//   (f) relaunch: into an open store with no card, the Leave row shows;
//       into the loot screen with its find decision restored, the card
//       shows over it and TAKE ALL / LEAVE ALL are hidden
// The real-layout half (hit-testing at the rail's centre, the Leave row's
// rect unchanged) was measured in headless Edge; these tests pin the rules
// that produce it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

import { railPush, railLineCard, emptyRail, holdForCard, RAIL_HOLD } from "../../src/browser/rail.js";
import { foeDetailsCard } from "../../src/browser/foeDetails.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";
import { newRun } from "../../engine/state.js";
import { openStore } from "../../engine/economy.js";
import { makeRng } from "../../engine/rng.js";
import { stripJs } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripJs(HTML);
const STYLE = [...HTML.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  .map((m) => m[1])
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function ruleBody(selectorRe) {
  const m = STYLE.match(new RegExp("(?:^|\\})\\s*" + selectorRe + "\\{([^}]*)\\}", "m"));
  return m ? m[1] : null;
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start !== -1, `marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end !== -1, `end marker not found: ${endMarker}`);
  return source.slice(start, end);
}

// ─── fixtures ──────────────────────────────────────────────────────────────

const POTION = () => ({ kind: "potion", n: "Healing potion", txt: "+d10+2 hp", eff2: "heal", uses: 1 });

function storeRun(seed = 31) {
  const s = newRun(seed);
  openStore(s, makeRng(seed + 1), []);
  return s;
}

function lootRun(seed = 32) {
  const s = newRun(seed);
  s.pendingLoot = [POTION()];
  return s;
}

function rig(state, { stair = null } = {}) {
  const clock = createFakeClock({ start: 1_000_000 });
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, clock, stubRail: false });
  const w = sandbox.context.window;
  w.__mzRail = emptyRail();
  if (stair) w.__mzStair = stair;
  // The recording DOM cannot host the loot list's rows (renderCarriedList
  // builds them through an innerHTML-created host with no ownerDocument), so
  // the loot screen's list renders empty here; its bottom row, the part this
  // file is about, is built by renderCombatOver as usual.
  if (state.pendingLoot) w.__mzCarriedList = () => {};
  sandbox.setState(state);
  const $ = (id) => doc.document.getElementById(id);
  const t = {
    clock, doc, sandbox, w, $,
    rail: () => $("mw-rail"),
    panel: () => $("enc-panel"),
    enc: () => sandbox.renderEncounter(),
    render: () => sandbox.context.renderRail(),
    run: (src) => vm.runInContext(src, sandbox.context),
    pushCard(title = "WELL THEN", line = "The shopkeeper counts it twice.") {
      w.__mzRail = railPush(w.__mzRail || emptyRail(), railLineCard(title, line, "info", RAIL_HOLD.default, "◇"));
      sandbox.context.renderRail();
    },
    bodyTap: () => $("mw-rail").onclick({ target: { closest: () => null } }),
    arm: () => clock.advance(ARM_DELAY_MS + 60),
    // "hidden in place" = the panel carries the rail-up stamp the CSS keys
    // the visibility-only rule off; the row itself is still in the DOM,
    // never `hidden` (display:none would reflow).
    railUp: () => t.panel().dataset.railUp,
  };
  t.enc();
  return t;
}

// ─── CSS: the raise and the in-place hide ──────────────────────────────────

test("(a) CSS: #mw-rail[data-over=\"panel\"] rises to z-index 8, tying .mw-overlay (DOM order paints the rail above it), below the ☰ scrim and wrap; no lift, no animation", () => {
  const zOf = (body) => Number((body.match(/z-index:(\d+)/) || [])[1]);
  const over = ruleBody('#mw-rail\\[data-over="panel"\\]');
  assert.ok(over, 'a #mw-rail[data-over="panel"] rule');
  assert.equal(over, "z-index:8", "only the z-index changes: the card sits at the stage's bottom edge like any other card");
  const overlay = ruleBody("\\.mw-overlay");
  assert.equal(zOf(over), zOf(overlay), "the tie with the overlay is deliberate: DOM order decides it");
  assert.ok(zOf(over) < zOf(ruleBody("\\.mw-hud-menu-scrim")), "the ☰ scrim still opens over the card");
  assert.ok(zOf(over) < zOf(ruleBody("\\.mw-hud-menu-wrap")));
  const encIdx = HTML.indexOf('id="enc-panel"');
  const railIdx = HTML.indexOf('id="mw-rail"');
  assert.ok(encIdx !== -1 && railIdx > encIdx, "#mw-rail follows the #enc-panel overlay in the markup");
  assert.equal(zOf(ruleBody("\\.mw-rail")), 4, "the base rail still sits under the overlay everywhere else");
});

test("(a) CSS: while the panel carries data-rail-up=\"1\", the store's Leave row, the loot screen's actions and the stair prompt's actions are hidden in place (visibility only) and their buttons take no taps", () => {
  const hide = STYLE.match(/#enc-panel\[data-rail-up="1"\] #enc-body>\.actions,#enc-panel\[data-rail-up="1"\] \.cb-over-actions,#enc-panel\[data-rail-up="1"\] \.mw-major-actions\{([^}]*)\}/);
  assert.ok(hide, "one rule hides the three bottom rows");
  assert.equal(hide[1], "visibility:hidden", "visibility only: each row keeps its box, so nothing moves or reflows");
  const btns = STYLE.match(/#enc-panel\[data-rail-up="1"\] #enc-body>\.actions button,#enc-panel\[data-rail-up="1"\] \.cb-over-actions button,#enc-panel\[data-rail-up="1"\] \.mw-major-actions button\{([^}]*)\}/);
  assert.ok(btns, "one rule for their buttons");
  assert.equal(btns[1], "pointer-events:none", "a hidden button can never take a tap");
  // The rows' resting state is the shown state: no rail-up="0" rule exists.
  assert.doesNotMatch(STYLE, /#enc-panel\[data-rail-up="0"\]/);
  // The hide rules never reach into the rail itself, so a decision card's
  // own buttons over these screens stay live.
  assert.doesNotMatch(STYLE, /data-rail-up="1"\][^{]*#mw-rail/);
  assert.doesNotMatch(STYLE, /data-rail-up="1"\][^{]*mw-rail-btn/);
});

// ─── (a)/(b) the store ─────────────────────────────────────────────────────

test("(a) the store: a card raised while shopping shows over it (data-over=\"panel\") and the Leave row is hidden in place", () => {
  const t = rig(storeRun());
  assert.equal(t.panel().hidden, false, "the store owns the map");
  const leave = t.$("a-leave");
  assert.ok(leave, "the Leave button is rendered");
  assert.equal(t.rail().dataset.shown, "0");
  assert.equal(t.rail().dataset.over, undefined);
  assert.equal(t.railUp(), "0", "no card: the Leave row shows");
  t.pushCard();
  assert.equal(t.rail().hidden, false);
  assert.equal(t.rail().dataset.shown, "1");
  assert.equal(t.rail().dataset.over, "panel", "the card rises over the store");
  assert.equal(t.railUp(), "1", "the Leave row is hidden in place");
  assert.equal(t.$("a-leave"), leave, "the same node: nothing rebuilt or removed");
  assert.equal(leave.hidden, false, "never display:none, so the row keeps its box");
  // A re-render of the store under the card (a BUY re-paints it) keeps the
  // stamp: it lives on the persistent #enc-panel, not in the rebuilt body.
  t.enc();
  assert.equal(t.railUp(), "1");
  assert.ok(t.$("a-leave"));
});

test("(b) the store: the card's hold running out brings the Leave row back", () => {
  const t = rig(storeRun(33));
  t.pushCard();
  assert.equal(t.railUp(), "1");
  t.clock.advance(holdForCard(t.w.__mzRail.card) + 64);
  assert.equal(t.w.__mzRail.card, null, "the hold cleared the card");
  assert.equal(t.rail().dataset.shown, "0");
  assert.equal(t.rail().dataset.over, undefined);
  assert.equal(t.railUp(), "0", "the Leave row shows again");
});

test("(b) the store: a card replacing a card keeps the Leave row hidden; an armed tap dismissing the last one brings it back", () => {
  const t = rig(storeRun(34));
  t.pushCard("WELL THEN");
  t.pushCard("NOT A CHANCE", "Your purse disagrees.");
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1", "a card replacing a card: still hidden");
  t.arm();
  t.bodyTap();
  assert.equal(t.w.__mzRail.card, null, "the tap dismissed the card");
  assert.equal(t.railUp(), "0", "dismissed by a tap: the Leave row shows again");
  assert.equal(t.rail().dataset.over, undefined);
});

test("(b) the store closing under a card: the card drops back to the map layer and the panel's stamp clears", () => {
  const t = rig(storeRun(35));
  t.pushCard();
  assert.equal(t.railUp(), "1");
  t.run("S.store = null;");
  t.enc();
  assert.equal(t.panel().hidden, true, "the store closed");
  assert.equal(t.rail().dataset.shown, "1", "the card is still showing, now over the map");
  assert.equal(t.rail().dataset.over, undefined, "no panel to rise over");
  assert.equal(t.railUp(), "0");
});

// ─── (c) the loot screen and the stair prompt ──────────────────────────────

test("(c) the loot screen: a card shows over it and TAKE ALL / LEAVE ALL are hidden in place; the hold running out brings them back", () => {
  const t = rig(lootRun());
  assert.equal(t.panel().hidden, false);
  const takeAll = t.$("a-loot-take-all");
  assert.ok(takeAll && t.$("a-loot-leave-all"), "the loot screen's bottom row is rendered");
  assert.equal(t.railUp(), "0");
  t.pushCard("BAG FULL", "Nowhere to put it.");
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1");
  assert.equal(t.$("a-loot-take-all"), takeAll);
  t.clock.advance(holdForCard(t.w.__mzRail.card) + 64);
  assert.equal(t.railUp(), "0");
  assert.equal(t.rail().dataset.over, undefined);
});

test("(c) the stair prompt: a card shows over it and GO DOWN / NOT YET are hidden in place; an armed tap brings them back", () => {
  const t = rig(newRun(36), { stair: { dir: "N" } });
  assert.equal(t.panel().hidden, false);
  assert.ok(t.$("mw-major-primary") && t.$("mw-major-secondary"), "the stair prompt's buttons are rendered");
  assert.equal(t.railUp(), "0");
  t.pushCard("A DRAFT", "Something below breathes.");
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1");
  t.arm();
  t.bodyTap();
  assert.equal(t.railUp(), "0");
  assert.equal(t.rail().dataset.over, undefined);
});

test("(c) NOT YET closes the stair prompt under a card: the stamp clears with the panel", () => {
  const t = rig(newRun(37), { stair: { dir: "N" } });
  t.pushCard();
  assert.equal(t.railUp(), "1");
  t.w.__mzStair = null;
  t.enc();
  assert.equal(t.panel().hidden, true);
  assert.equal(t.rail().dataset.over, undefined);
  assert.equal(t.railUp(), "0");
});

test("(c) on another tab the panel is not on screen, so the card stays on the base layer; back on the map it rises again", () => {
  const t = rig(storeRun(38));
  t.pushCard();
  assert.equal(t.rail().dataset.over, "panel");
  // showTab re-renders the rail on every switch (guarded on __mzState).
  t.run('mwActiveTab = "hero";');
  t.render();
  assert.equal(t.rail().dataset.shown, "1", "the rail is the one feedback surface on every tab");
  assert.equal(t.rail().dataset.over, undefined);
  assert.equal(t.railUp(), "0");
  t.run('mwActiveTab = "maze";');
  t.render();
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1");
});

// ─── (d) decision cards stay usable ────────────────────────────────────────

test("(d) a decision card over the store (the dark card's USE TORCH) is shown over it and its button fires once armed", () => {
  const s = storeRun(39);
  s.c.darkFor = 3;
  s.c.items.push({ kind: "tool", tool: "torch", n: "Torch", txt: "" });
  const t = rig(s);
  const used = [];
  t.w.mzUseItem = (i) => used.push(i);
  t.w.__mzHasTool = () => true;
  t.w.__mzToolIndex = () => 0;
  t.w.__mzRail = { ...railPush(emptyRail(), railLineCard("IN THE DARK", "Your light goes out.", "info", RAIL_HOLD.default, "◇")), pending: { kind: "dark" } };
  t.render();
  assert.equal(t.rail().dataset.shown, "1");
  assert.equal(t.rail().dataset.over, "panel", "the decision card sits over the store");
  assert.equal(t.railUp(), "1");
  const torch = t.$("mw-rail-torch");
  assert.ok(torch, "USE TORCH is rendered in the rail's own action row, outside #enc-panel");
  t.arm();
  torch.onclick();
  assert.deepEqual(used, [0], "the decision's button fires");
});

test("(d) a joiner decision over the loot screen stays tappable; resolving it brings TAKE ALL / LEAVE ALL back", () => {
  const s = lootRun(40);
  s.pendingJoiner = { name: "A Wanderer", race: "Human", sub: null, lvl: 1 };
  const t = rig(s);
  const calls = [];
  t.w.mzResolveJoiner = (yes) => calls.push(yes);
  t.render();
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1");
  t.arm();
  t.bodyTap();
  assert.equal(t.railUp(), "1", "a decision card is never tap-dismissed");
  t.$("a-join-no").onclick();
  assert.deepEqual(calls, [false], "the decision's button fires over the loot screen");
  t.run("S.pendingJoiner = null;");
  t.render();
  assert.equal(t.railUp(), "0", "the decision resolved: the loot screen's buttons show again");
});

// ─── (e) the combat precedent ──────────────────────────────────────────────

test("(e) the combat precedent is unchanged: a foe card over the fight is data-over=\"combat\", and the panel's rail-up stamp stays off", () => {
  const s = newRun(41);
  s.combat = {
    foes: [{ name: "Wolf", type: "Beasts", lvl: 2, size: "S", intel: 4, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" }, lives: 1 }],
    type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  const t = rig(s);
  t.w.__mzRail = railPush(emptyRail(), foeDetailsCard(0, s));
  t.render();
  assert.equal(t.rail().dataset.shown, "1");
  assert.equal(t.rail().dataset.over, "combat");
  assert.equal(t.railUp(), "0", "combat keeps its own lift; its action area is never hidden");
  assert.equal(ruleBody('#mw-rail\\[data-over="combat"\\]'), "z-index:8;bottom:var(--mw-rail-lift,0px);max-height:45%;overflow-y:auto");
  // Any other card stays hidden in combat, and sets neither stamp.
  t.w.__mzRail = railPush(emptyRail(), railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  t.render();
  assert.equal(t.rail().hidden, true);
  assert.equal(t.rail().dataset.over, undefined);
  assert.equal(t.railUp(), "0");
});

// ─── (f) relaunch ──────────────────────────────────────────────────────────

test("(f) relaunch into an open store with no card: the Leave row shows, the rail stays hidden (rail cards are presentation-only, never saved)", () => {
  const t = rig(storeRun(42));
  t.sandbox.paint();
  assert.equal(t.rail().dataset.shown, "0");
  assert.equal(t.railUp(), "0");
  assert.ok(t.$("a-leave"));
});

test("(f) relaunch into the loot screen with its find decision restored: the card shows over it and TAKE ALL / LEAVE ALL are hidden", () => {
  const s = lootRun(43);
  s.pendingFind = POTION();
  const t = rig(s);
  t.sandbox.paint();
  assert.equal(t.rail().dataset.shown, "1");
  assert.equal(t.rail().dataset.over, "panel");
  assert.equal(t.railUp(), "1");
  assert.ok(t.$("a-find-take") && t.$("a-find-leave"), "the find decision's own buttons are in the rail");
});

// ─── source pins ───────────────────────────────────────────────────────────

test("pins: renderRail stamps data-over=\"panel\" from panelScreenUp() in the one data-over block, after the combat branch, and mirrors it onto #enc-panel in one helper at both exits that write data-over", () => {
  const rail = sliceBetween(CODE, "function renderRail() {", "function syncRailLive(text)");
  assert.match(rail, /if \(combatScreenUp\(\) && combatCardUp && !railEl\.hidden\) \{/, "the combat branch is unchanged");
  assert.match(rail, /\} else if \(!railEl\.hidden && panelScreenUp\(\)\) \{\n\s*railEl\.dataset\.over = "panel";\n\s*\} else if \(railEl\.dataset\.over\) \{/);
  assert.ok(rail.indexOf('railEl.dataset.over = "combat"') < rail.indexOf('railEl.dataset.over = "panel"'));
  assert.equal((rail.match(/syncPanelRailUp\(railEl\);/g) || []).length, 2, "the stairs-fade exit and the main data-over block");
  const fn = sliceBetween(CODE, "function panelScreenUp() {", "\n}\n");
  assert.match(fn, /if \(!S \|\| S\.dead \|\| combatScreenUp\(\) \|\| mwActiveTab !== "maze"\) return false;/, "never over a fight, its playback, death, or another tab");
  assert.match(fn, /if \(S\.beats && S\.beats\.over && S\.beats\.groups && S\.beats\.groups\.length && !window\.__mzStair\) return false;/, "the THEY ARE DOWN over-panel takes the panel before the loot and the store");
  assert.match(fn, /window\.__mzStair \|\| S\.store \|\| \(S\.pendingLoot && S\.pendingLoot\.length\)/);
  const sync = sliceBetween(CODE, "function syncPanelRailUp(railEl) {", "\n}\n");
  assert.match(sync, /document\.getElementById\("enc-panel"\)/);
  assert.match(sync, /railEl\.dataset\.over === "panel" \? "1" : "0"/);
});
