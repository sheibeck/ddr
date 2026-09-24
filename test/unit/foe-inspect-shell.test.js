// test/unit/foe-inspect-shell.test.js
//
// Phase 71 (POLISH-08; D-08, D-10, D-11), Plan 04, Task 3 — the shell half
// of "long-press a foe for its details card".
//
// Sandbox (the REAL renderRail, loadShellSandbox({ stubRail: false }), a
// fake clock so every timer and Date.now() stamp is driven by advance()):
//   (a) combat live + a foe card on window.__mzRail: the rail shows over the
//       combat screen (not hidden, data-over="combat"), its lines carry HP,
//       and the card is never typed (it shows at once, even with motion on);
//   (b) the same state with any other card keeps the rail hidden (R-14);
//   (c) the foe's HP changes: the next repaint re-derives the HP line, and
//       neither re-announces nor schedules a hold (R-15);
//   (d) S.combat clears with the card up: data-over is removed and ONE hold
//       timer starts, which clears the card (D-10);
//   (e) the Details button (D-11) calls window.mzInspectFoe with the card's
//       index and never touches S.combat.target;
//   (f) a body tap on #mw-rail after the arm window dismisses the foe card
//       in combat (D-10: a no-decision card).
// The recording DOM's addEventListener is a no-op, so the gesture wiring is
// proven by test/unit/longPress.test.js (the recognizer) plus the source
// pins below (where each listener sits and what it calls).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { stripHtml } from "../../tools/ident-sweep.mjs";
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";
import { createFakeClock } from "./harness/fakeClock.js";
import { railPush, railLineCard, holdForCard, RAIL_HOLD } from "../../src/browser/rail.js";
import { foeDetailsCard, detailsLabel } from "../../src/browser/foeDetails.js";
import { ARM_DELAY_MS } from "../../src/browser/inputGuards.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8").replace(/\r\n/g, "\n");
const CODE = stripHtml(HTML);

// ─── fixtures ──────────────────────────────────────────────────────────────

function fixedState() {
  const g = [0, 1, 2].map(() => [0, 1, 2].map(() => ({ wall: false, dark: false, seen: true, feat: null })));
  return {
    version: 1, seed: 1, rngState: 1,
    c: {
      cls: "Fighter", sub: "Soldier", race: "Human", level: 3, sp: 0, maxWP: 55, wp: 55, skills: {}, vp: 0,
      weapon: "Sword", prof: 2, magicWpn: 0, armor: "Nothing", ar: 0, armorMin: 0, armorWP: 0, armorMax: 0, patches: 0,
      temperament: "Grim", motive: "Money", phobia: "Spiders", phobiaType: "x", potions: 1, rations: 6, gold: 50, scrolls: 0,
      haste: 0, invis: 0, ether: 0, acute: 0, affliction: null, joiner: null, items: [], grimoire: [], spellsUsed: 0, kills: 0,
      might: 0, ward: null, regen: false, mirror: 0, foresight: false, name: "Test Delver", darkFor: 0, timers: {},
    },
    floor: { g, px: 1, py: 1, depth: 2 },
    day: 1, steps: 0, combat: null, store: null, beats: null, party: [], dead: false, deathNote: "", epitaph: "",
  };
}

const foe = (name, extra = {}) => ({ name, type: "Beasts", lvl: 2, size: "S", intel: 4, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: { dmg: { n: 1, sides: 6, bonus: 2 }, note: "+2 damage" }, lives: 1, ...extra });

function combatState() {
  const s = fixedState();
  s.combat = {
    foes: [foe("Wolf"), foe("Cave Bear", { size: "L", wp: 25, maxWP: 25 })],
    type: "Beasts", round: 2, target: 1, spellOpen: false, tracked: false, first: "you",
  };
  return s;
}

function rig({ reducedMotion = true } = {}) {
  const clock = createFakeClock();
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc, stubRail: false, clock, reducedMotion });
  const w = sandbox.context.window;
  const railEl = () => doc.document.getElementById("mw-rail");
  const lineTexts = () => doc.document.getElementById("mw-rail-lines").children.map((el) => el.textContent);
  const live = () => doc.document.getElementById("mw-rail-live").textContent;
  return { clock, doc, sandbox, w, railEl, lineTexts, live, renderRail: () => sandbox.context.renderRail() };
}

// ─── (a) the combat-legal foe card ─────────────────────────────────────────

test("(a) combat live + a foe card: the rail shows over the combat screen with data-over=combat and an HP line", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.w.__mzRail = railPush(r.w.__mzRail, foeDetailsCard(0, s));
  r.renderRail();
  assert.equal(r.railEl().hidden, false, "the foe card is the one combat-legal rail card");
  assert.equal(r.railEl().dataset.shown, "1");
  assert.equal(r.railEl().dataset.over, "combat");
  assert.ok(r.lineTexts().some((t) => t === "HP 10 / 10"), r.lineTexts().join(" | "));
  assert.equal(r.doc.document.getElementById("mw-rail-title").textContent, "WOLF");
  assert.match(r.live(), /^WOLF\. /, "a new foe card is announced once");
});

test("(a) the foe card is never typed: with motion on, every line is complete at once and no typing block runs", () => {
  const r = rig({ reducedMotion: false });
  const s = combatState();
  r.w.__mzState.set(s);
  const card = foeDetailsCard(1, s);
  r.w.__mzRail = railPush(r.w.__mzRail, card);
  r.renderRail();
  assert.deepEqual(r.lineTexts(), card.lines.map((l) => l.text));
  assert.equal(r.w.__mzTypewriter.active("rail"), false);
});

// ─── (b) every other card stays hidden in combat ───────────────────────────

test("(b) the same combat state with a non-foe card keeps the rail hidden and sets no data-over", () => {
  const r = rig();
  r.w.__mzState.set(combatState());
  r.w.__mzRail = railPush(r.w.__mzRail, railLineCard("A TRAP", "Patient as furniture.", "bad", RAIL_HOLD.default, "✕"));
  r.renderRail();
  assert.equal(r.railEl().hidden, true);
  assert.equal(r.railEl().dataset.over, undefined);
});

// ─── (c) live while the fight goes on ──────────────────────────────────────

test("(c) the foe's HP changes: the repaint re-derives the HP line with no re-announce and no hold", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.w.__mzRail = railPush(r.w.__mzRail, foeDetailsCard(0, s));
  r.renderRail();
  const announced = r.live();
  const timersBefore = r.clock.pending();
  s.combat.foes[0].wp = 3;
  s.combat.foes[0].hamstrung = true;
  r.renderRail();
  assert.ok(r.lineTexts().includes("HP 3 / 10"), r.lineTexts().join(" | "));
  // Phase 71 (D-16, R-30): each effect is its own "<text> — <desc>" line.
  assert.ok(r.lineTexts().some((t) => t.startsWith("Hamstrung — ")), "the effects line tracks the fight too");
  assert.equal(r.live(), announced, "a same-card repaint never re-announces");
  assert.equal(r.clock.pending(), timersBefore, "no hold timer while S.combat is set");
  r.clock.advance(RAIL_HOLD.level * 3);
  assert.equal(r.w.__mzRail.card?.kind, "foe", "the card holds until dismissed while in combat");
});

// ─── (d) the fight ends with the card up ───────────────────────────────────

test("(d) S.combat clears with the card up: data-over goes, ONE hold timer starts, and it clears the card", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.w.__mzRail = railPush(r.w.__mzRail, foeDetailsCard(0, s));
  r.renderRail();
  s.combat.foes[0].wp = 0;
  s.combat.foes[0].alive = false;
  r.renderRail();
  const before = r.clock.pending();
  s.combat = null;
  r.renderRail();
  assert.equal(r.railEl().dataset.over, undefined, "data-over is removed once the fight is over");
  assert.equal(r.railEl().hidden, false, "the card is still up, now on the normal rail");
  assert.ok(r.lineTexts().includes("DOWN"), "the card keeps the last live view of the fight");
  assert.equal(r.clock.pending(), before + 1, "exactly one hold timer starts");
  r.renderRail();
  assert.equal(r.clock.pending(), before + 1, "a repaint never re-arms it");
  r.clock.advance(holdForCard(r.w.__mzRail.card) + 5);
  assert.equal(r.w.__mzRail.card, null, "the hold clears the card");
  assert.equal(r.railEl().hidden, true);
});

// ─── (e) the Details button (D-11) ─────────────────────────────────────────

test("(e) every foe card has a Details button; its tap calls mzInspectFoe(i) and never touches S.combat.target", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  const calls = [];
  r.w.mzInspectFoe = (i) => calls.push(i);
  r.sandbox.context.renderEncounter();
  const body = r.doc.document.getElementById("enc-body");
  const buttons = Array.from(body.querySelectorAll(".cb-foe-details"));
  assert.equal(buttons.length, s.combat.foes.length, "one Details button per foe card");
  assert.equal(buttons[0].getAttribute("aria-label"), detailsLabel("WOLF"));
  assert.equal(buttons[0].textContent, "Details: WOLF");
  assert.match(buttons[0].className, /\bsr-only\b/);
  assert.equal(buttons[0].type, "button");
  r.clock.advance(ARM_DELAY_MS + 10);
  buttons[0].onclick();
  buttons[1].onclick();
  assert.deepEqual(calls, [0, 1]);
  assert.equal(r.w.__mzState.get().combat.target, 1, "the aim is unchanged");
});

// ─── (f) a body tap dismisses it in combat ─────────────────────────────────

test("(f) a #mw-rail body tap after the arm window dismisses the foe card in combat", () => {
  const r = rig();
  const s = combatState();
  r.w.__mzState.set(s);
  r.w.__mzRail = railPush(r.w.__mzRail, foeDetailsCard(0, s));
  r.renderRail();
  r.clock.advance(ARM_DELAY_MS + 10);
  r.railEl().onclick({ target: { closest: () => null } });
  assert.equal(r.w.__mzRail.card, null);
  assert.equal(r.railEl().hidden, true);
  assert.equal(r.railEl().dataset.over, undefined);
  assert.equal(s.combat.target, 1);
});

// ─── source pins ───────────────────────────────────────────────────────────

function sliceFrom(source, startMarker, len = 2400) {
  const i = source.indexOf(startMarker);
  assert.ok(i !== -1, `marker not found: ${startMarker}`);
  return source.slice(i, i + len);
}

test("pins: the module imports foeDetails.js and longPress.js once each and bridges __mzFoeInspect", () => {
  assert.equal((CODE.match(/from "\.\/src\/browser\/foeDetails\.js"/g) || []).length, 1);
  assert.equal((CODE.match(/from "\.\/src\/browser\/longPress\.js"/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzFoeInspect = \{ card: foeDetailsCard, label: detailsLabel \};/g) || []).length, 1);
});

test("pins: window.mzInspectFoe is guarded by dungeonVisible, reads the beat frame's state, pushes through railPush and repaints", () => {
  const region = sliceFrom(CODE, "window.mzInspectFoe = (i) => {", 900);
  assert.match(region, /if \(!dungeonVisible\(\)\) return;/);
  assert.match(region, /window\.__mzBeat\?\.view\?\.\(\)\?\.state/);
  assert.match(region, /railPush\(window\.__mzRail, foeDetailsCard\(i, V\)\)/);
  assert.match(region, /window\.renderRail\?\.\(\)/);
  assert.doesNotMatch(region, /\.target\s*=/, "inspecting never aims");
});

test("pins: the gesture listeners — pointerdown on #enc-panel gated on .cb-foe[data-foe]; document move/up/cancel/scroll in capture; the window capture click suppressor; contextmenu", () => {
  const down = sliceFrom(CODE, 'document.getElementById("enc-panel")?.addEventListener("pointerdown"', 500);
  assert.match(CODE, /closest\("\.cb-foe\[data-foe\]"\)/);
  assert.match(down, /foeLongPress\.down\(/);
  assert.match(CODE, /document\.addEventListener\("pointermove", \(e\) => foeLongPress\.move\([^)]*\), true\);/);
  assert.match(CODE, /document\.addEventListener\("pointerup", \(e\) => foeLongPress\.up\([^)]*\), true\);/);
  assert.match(CODE, /document\.addEventListener\("pointercancel", \(\) => foeLongPress\.cancel\(\), true\);/);
  assert.match(CODE, /document\.addEventListener\("scroll", \(\) => foeLongPress\.cancel\(\), true\);/);
  const click = sliceFrom(CODE, 'window.addEventListener("click", (e) => {', 300);
  assert.match(click, /foeLongPress\.consumeClick\(\)/);
  assert.match(click, /e\.stopPropagation\(\);/);
  assert.match(click, /e\.preventDefault\(\);/);
  assert.match(click, /\}, true\);/);
  const menu = sliceFrom(CODE, 'document.getElementById("enc-panel")?.addEventListener("contextmenu"', 300);
  assert.match(menu, /preventDefault\(\)/);
  // None of these is a click listener on #enc-panel (CSCR-08's single capture click holds).
  assert.equal((CODE.match(/getElementById\("enc-panel"\)\?\.addEventListener\("click"/g) || []).length, 1);
});

test("pins: the long press gives one light haptic through maybeHaptic and opens the card through mzInspectFoe", () => {
  const region = sliceFrom(CODE, "const foeLongPress = createLongPress({", 700);
  assert.match(region, /maybeHaptic\(currentSettings, "Light"\);/);
  assert.match(region, /window\.mzInspectFoe\(i\)/);
  assert.match(region, /setTimeout: \(fn, ms\) => setTimeout\(fn, ms\)/);
  assert.match(region, /now: \(\) => Date\.now\(\)/);
});

test("pins: renderFoeCards builds a sr-only Details sibling per card through guardTap and mzInspectFoe", () => {
  const start = CODE.indexOf("function renderFoeCards(host, vm, onPick, hitFoe = -1)");
  const region = CODE.slice(start, CODE.indexOf("\nfunction ", start + 10));
  assert.match(region, /"sr-only cb-foe-details"/);
  assert.match(region, /window\.__mzFoeInspect\?\.label\?\.\(c\.name\)/);
  assert.match(region, /guardTap\(details, \(\) => window\.mzInspectFoe\?\.\(c\.i\)\)/);
  assert.equal((region.match(/guardTap\(el, \(\) => onPick\(/g) || []).length, 1, "the aim tap is unchanged");
});

test("pins: renderRail keeps the foe card live in combat, lifts it over the action area, and holds only once the fight is over", () => {
  const start = CODE.indexOf("function renderRail()");
  const region = CODE.slice(start, CODE.indexOf("\nfunction ", start + 10));
  assert.match(region, /rail\.card\?\.kind === "foe"/);
  assert.match(region, /window\.__mzFoeInspect\.card\(rail\.card\.foe, V\)/);
  assert.match(region, /railEl\.hidden = !!\(\(S\.combat && !foeCardUp\) \|\| S\.dead\) \|\| idle;/);
  assert.match(region, /railEl\.dataset\.over = "combat"/);
  assert.match(region, /delete railEl\.dataset\.over/);
  assert.match(region, /getElementById\("cb-act"\)/);
  // Phase 71 (71-05, D-07): the lift reads the what-happened strip's top
  // first (it sits directly above #cb-act), so the card covers neither.
  assert.ok(region.indexOf('getElementById("cb-summary")') !== -1 && region.indexOf('getElementById("cb-summary")') < region.indexOf('getElementById("cb-act")'), "the strip is measured first");
  assert.match(region, /--mw-rail-lift/);
  assert.equal((region.match(/fit\(/g) || []).length, 0);
  assert.equal((region.match(/setTimeout\(/g) || []).length, 1, "still one hold timer site");
});

test("pins: CSS — the combat-legal rail rule and the foe card's no-selection rule; no new motion; no aria-disabled", () => {
  const style = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const over = (style.match(/^#mw-rail\[data-over="combat"\]\{([^}]*)\}/m) || [])[1];
  assert.ok(over, 'a #mw-rail[data-over="combat"] rule');
  assert.match(over, /z-index:8/);
  assert.match(over, /bottom:var\(--mw-rail-lift,0px\)/);
  assert.match(over, /max-height:45%/);
  assert.match(over, /overflow-y:auto/);
  assert.doesNotMatch(over, /transition|animation/);
  const foeRules = [...style.matchAll(/^\.cb-foe\{([^}]*)\}/gm)].map((m) => m[1]).join(";");
  assert.match(foeRules, /-webkit-user-select:none/);
  assert.match(foeRules, /(^|;)user-select:none/);
  assert.match(foeRules, /-webkit-touch-callout:none/);
  assert.doesNotMatch(style, /aria-disabled/);
});
