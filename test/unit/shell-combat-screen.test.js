// test/unit/shell-combat-screen.test.js
//
// Phase 34 (CSCR-01/02/03/06/08), Plan 03 — mazeworld.html has no module
// surface a test could import directly (it is not an ESM module the test
// runner can load), so — mirroring shell-fight-log.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly. The VIEW-MODEL behaviour
// itself (header/foe/lot/overlay content) is proven in combatPanel.test.js;
// this file proves the SHELL wiring: layout order, CSS, the four render
// helpers' DOM shape, the guarded foe-card tap, the MAJOR OVERLAY gate, the
// Enter/Space key path, and that no tap-anywhere-to-dismiss/transition-
// coupled guard crept in.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

// Phase 71 (D-14): one sandbox case proves the chips reach a real foe card.
import { createRecordingDocument } from "./harness/recordingDom.js";
import { loadShellSandbox } from "./harness/shellSandbox.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
const COMBAT_PANEL_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "combatPanel.js"), "utf8");

// ─── comment stripping (line comments first, THEN block comments — a
// literal `/*`-looking substring inside a `//` comment must not be misread
// as an unterminated block-comment opener; see 31-01-SUMMARY.md / 34-RESEARCH
// Pitfall 4) ───────────────────────────────────────────────────────────────
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}

const CODE = stripComments(HTML);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start === -1 ? 0 : start);
  assert.ok(start !== -1, `start marker not found: ${startMarker}`);
  assert.ok(end !== -1 && end > start, `end marker not found after start: ${endMarker}`);
  return source.slice(start, end);
}

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it — stays valid when a later plan adds more render helpers between
// this function and its neighbour.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function helpersRegion() {
  return sliceBetween(CODE, "function renderFightLog(host)", "function renderEncounter()");
}

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}

function combatBranch() {
  const region = renderEncounterRegion();
  // Phase 58 (MOTION-03): `const C = S.combat;` became `const V = bv ? bv.state
  // : S; const C = V.combat;` (D-09) — re-pinned to the landed marker.
  const start = region.indexOf("const V = bv ? bv.state : S;");
  assert.ok(start !== -1, "combatBranch: const V = bv ? bv.state : S; not found inside renderEncounter region");
  return region.slice(start);
}

function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}

// The whole self-hosted <style> area spans four adjacent <style>...</style>
// tags in <head> (base reset / fonts / theme+combat CSS / animation
// keyframes) — first "<style>" to the LAST "</style>" covers all of them.
function styleBlock() {
  const start = HTML.indexOf("<style>");
  const end = HTML.lastIndexOf("</style>") + "</style>".length;
  assert.ok(start !== -1 && end > start, "style block not found");
  return HTML.slice(start, end);
}

function guardHelpersRegion() {
  return sliceBetween(CODE, "let encRenderedAt = 0;", "function wireDeathConfirm()");
}

// ─── a. Layout order (CSCR-01) ─────────────────────────────────────────────

// Phase 71 (D-07, R-19): the combat v2 mock's middle holds foes and party
// only; the in-panel log left it, and the what-happened strip
// (renderRoundStrip) sits between #cb-mid and #cb-act instead.
test("CSCR-01: combat branch builds the pending gate, then header -> cb-mid -> foes -> lot -> summary strip -> cb-act in strictly increasing order", () => {
  const region = combatBranch();
  const modeIdx = region.indexOf('panel.dataset.mode = "dark";');
  // Phase 58 (MOTION-03): the pending gate now also carries `&& !bv` (D-09)
  // — re-pinned to the landed condition.
  const pendingIdx = region.indexOf("if (C.pending && !bv)");
  const headerIdx = region.indexOf("renderCombatHeader(body");
  const midIdx = region.indexOf('mid.id = "cb-mid"');
  const foesIdx = region.indexOf("renderFoeCards(mid");
  const lotIdx = region.indexOf("renderYourLot(mid");
  const appendMidIdx = region.indexOf("body.appendChild(mid)");
  const logIdx = region.indexOf("renderRoundStrip(body");
  const actIdx = region.indexOf('act.id = "cb-act"');
  assert.equal(region.indexOf("renderFightLog(mid)"), -1, "the in-panel log is no longer built in the middle (R-19)");
  assert.ok(modeIdx !== -1, 'panel.dataset.mode = "dark"; must be set in the combat branch');
  assert.ok(modeIdx < pendingIdx, "dark mode is set before the pending gate");
  assert.ok(
    pendingIdx > -1 && headerIdx > pendingIdx && midIdx > headerIdx && foesIdx > midIdx &&
    lotIdx > foesIdx && appendMidIdx > lotIdx && logIdx > appendMidIdx && actIdx > logIdx,
    "expected strictly increasing order: pending -> header -> cb-mid -> foes -> lot -> (mid appended) -> summary strip -> cb-act",
  );
});

// ─── b. Three bands in CSS ──────────────────────────────────────────────────

test("CSCR-01: .cb-head/.cb-mid/.cb-act and the dark panel mode carry the mock's exact values", () => {
  const headRule = HTML.match(/\.cb-head\{([^}]*)\}/);
  assert.ok(headRule, ".cb-head{...} rule must exist");
  assert.match(headRule[1], /flex:none/);
  assert.match(headRule[1], /border-bottom:3px solid #6b2c22/);
  assert.match(headRule[1], /background:#1e120f/);

  const midRule = HTML.match(/\.cb-mid\{([^}]*)\}/);
  assert.ok(midRule, ".cb-mid{...} rule must exist");
  assert.match(midRule[1], /flex:1/);
  assert.match(midRule[1], /overflow:auto/);
  assert.match(midRule[1], /min-height:0/);

  const actRule = HTML.match(/\.cb-act\{([^}]*)\}/);
  assert.ok(actRule, ".cb-act{...} rule must exist");
  assert.match(actRule[1], /flex:none/);
  assert.match(actRule[1], /border-top:3px solid #3a3226/);
  assert.match(actRule[1], /background:#1b170f/);

  const darkRule = HTML.match(/#enc-panel\[data-mode="dark"\]\{([^}]*)\}/);
  assert.ok(darkRule, '#enc-panel[data-mode="dark"]{...} rule must exist');
  assert.match(darkRule[1], /background:#120f0a/);
  assert.match(darkRule[1], /color:#e6ddc6/);

  assert.match(HTML, /#enc-panel\[data-mode="dark"\] \.enc-topbar\{display:none\}/);
});

// ─── c. Fonts (CSCR-01) ──────────────────────────────────────────────────

test("CSCR-01: no Google Fonts, three @font-face declarations, and every new label/data rule reuses the bundled faces", () => {
  const block = styleBlock();
  assert.doesNotMatch(block, /fonts\.googleapis/);
  const faceHits = block.match(/@font-face/g) || [];
  assert.equal(faceHits.length, 3, `expected exactly 3 @font-face declarations, found ${faceHits.length}`);

  const headLabelRule = HTML.match(/\.cb-head-label\{([^}]*)\}/);
  assert.ok(headLabelRule, ".cb-head-label{...} rule must exist");
  assert.match(headLabelRule[1], /var\(--disp\)/);

  const logTextRule = HTML.match(/\.cb-log-text\{([^}]*)\}/);
  assert.ok(logTextRule, ".cb-log-text{...} rule must exist");
  assert.match(logTextRule[1], /var\(--mono\)/);

  // Phase 71 (D-07): the what-happened strip reuses the bundled faces too.
  const sumLineRule = HTML.match(/\.cb-sum-line\{([^}]*)\}/);
  assert.ok(sumLineRule, ".cb-sum-line{...} rule must exist");
  assert.match(sumLineRule[1], /var\(--mono\)/);
  const sumLabelRule = HTML.match(/\.cb-sum-label\{([^}]*)\}/);
  assert.ok(sumLabelRule, ".cb-sum-label{...} rule must exist");
  assert.match(sumLabelRule[1], /var\(--disp\)/);

  const rootRule = HTML.match(/:root\{([\s\S]*?)\n\}/);
  assert.ok(rootRule, ":root{...} rule must exist");
  assert.match(rootRule[1], /--disp:"Press Start 2P"/);
  assert.match(rootRule[1], /--mono:"Courier Prime"/);
});

// ─── d. Foe cards (CSCR-02) ─────────────────────────────────────────────

test("CSCR-02: renderFoeCards builds every card field via textContent/className, guards the live-card tap exactly once, and carries no innerHTML", () => {
  const region = fnRegion("function renderFoeCards(host, vm, onPick, hitFoe = -1)");
  for (const needle of ["cb-foe-glyph", "cb-foe-name", "cb-foe-meta", "cb-foe-wp", "cb-foe-tag", "cb-bar-fill"]) {
    assert.match(region, new RegExp(needle), `renderFoeCards must reference ${needle}`);
  }
  assert.match(region, /dataset\.foe|data-foe/);
  const guardHits = region.match(/guardTap\(el, \(\) => onPick\(/g) || [];
  assert.equal(guardHits.length, 1, "guardTap(el, () => onPick( must appear exactly once");
  assert.match(region, /el\.tabIndex = 0/);
  assert.doesNotMatch(region, /innerHTML/);
});

test("CSCR-02/08 (Decision 3): the combat branch mutates S.combat.target through a guarded onPick, chip source stays foeStatusBadges, and no retarget-flavoured literal remains anywhere", () => {
  const region = renderEncounterRegion();
  const targetHits = region.match(/S\.combat\.target = i; renderEncounter\(\);/g) || [];
  assert.equal(targetHits.length, 1, "S.combat.target = i; renderEncounter(); must appear exactly once");
  // Phase 71 (D-14): the chips read the beat's frame state V, so a chip and
  // the foe's HP move with the same line.
  const chipHits = region.match(/chipsFor: \(f\) => foeStatusBadges\(f, V\)\.map\(\(b\) => b\.t\)/g) || [];
  assert.equal(chipHits.length, 1, "the chipsFor callback must appear exactly once");
  assert.doesNotMatch(CODE, /C\.target = i; renderEncounter\(\);/);
  assert.doesNotMatch(CODE, /[Rr]etarget/);
});

// ─── e. YOUR LOT (CSCR-03) ────────────────────────────────────────────────

test("CSCR-03: renderYourLot builds the scrollable strip via textContent/className/dataset with no innerHTML", () => {
  const region = fnRegion("function renderYourLot(host, vm)");
  for (const needle of ["cb-lot-strip", "cb-lot-card", "cb-lot-name", "cb-lot-wp", "cb-lot-fill", "cb-lot-third"]) {
    assert.match(region, new RegExp(needle), `renderYourLot must reference ${needle}`);
  }
  assert.match(region, /dataset\.overflow/);
  assert.doesNotMatch(region, /innerHTML/);
});

test("CSCR-03: .cb-lot-strip overflows horizontally, the active card is gold, and the low-hp fill is red", () => {
  const stripRule = HTML.match(/\.cb-lot-strip\{([^}]*)\}/);
  assert.ok(stripRule, ".cb-lot-strip{...} rule must exist");
  assert.match(stripRule[1], /overflow-x:auto/);

  const activeRule = HTML.match(/\.cb-lot-card\.active\{([^}]*)\}/);
  assert.ok(activeRule, ".cb-lot-card.active{...} rule must exist");
  assert.match(activeRule[1], /border-color:#e8c97a/);

  assert.match(HTML, /\.cb-lot-fill\.low\{background:#e05a48\}/);
});

// ─── f. MAJOR OVERLAY (CSCR-06, Decision 2) ──────────────────────────────

test("CSCR-06 (Decision 2): renderMajorOverlay exists before renderEncounter and builds the icon/title/line/roll/actions column with a guarded, optional secondary button, no innerHTML", () => {
  assert.match(helpersRegion(), /function renderMajorOverlay\(host, spec\)/);
  const region = fnRegion("function renderMajorOverlay(host, spec)");
  for (const needle of ["mw-major-icon", "mw-major-title", "mw-major-line", "mw-major-roll", "mw-major-actions"]) {
    assert.match(region, new RegExp(needle), `renderMajorOverlay must reference ${needle}`);
  }
  assert.match(region, /"mw-major-primary"/);
  const primaryGuardHits = region.match(/guardTap\(document\.getElementById\("mw-major-primary"\)/g) || [];
  assert.equal(primaryGuardHits.length, 1, 'guardTap(document.getElementById("mw-major-primary") must appear exactly once');
  const secondaryHits = region.match(/spec\.secondary/g) || [];
  assert.ok(secondaryHits.length >= 2, "spec.secondary must be referenced at least twice (the Phase 35 hook)");
  assert.doesNotMatch(region, /innerHTML/);
  // 2026-09-17 UAT ruling: the overlay shows the tile's actual PNG when the
  // spec carries an iconKey; specs without one keep the glyph path.
  assert.match(region, /if \(spec\.iconKey\) \{/);
  assert.match(region, /img\.className = "mw-major-icon-img";/);
  assert.match(region, /img\.src = featureIconSrc\(spec\.iconKey\);/);
  assert.match(region, /else \{ icon\.textContent = spec\.icon; \}/);
  assert.match(COMBAT_PANEL_SRC, /iconKey: "encounter",/);
  assert.match(HTML, /^\.mw-major-icon-img\{width:60px;height:60px;object-fit:contain;display:block\}$/m);
});

test("CSCR-06: the pending gate renders the overlay from encounterOverlaySpec, maps its dispatch to window.mzFight, and returns before any combat-panel band", () => {
  const region = combatBranch();
  assert.match(region, /window\.__mzCombatVM\.overlay\(S\)/);
  assert.match(region, /onTap: \(\) => window\.mzFight\?\.\(\)/);
  // Phase 58 (MOTION-03): the pending gate now also carries `&& !bv` (D-09)
  // — re-pinned to the landed condition.
  const pendingStart = region.indexOf("if (C.pending && !bv)");
  assert.ok(pendingStart !== -1, "if (C.pending && !bv) must exist in the combat branch");
  const braceEnd = region.indexOf("}", region.indexOf("return;", pendingStart));
  const pendingBlock = region.slice(pendingStart, braceEnd + 1);
  assert.match(pendingBlock, /return;/);
  const headerAfterPending = region.indexOf("renderCombatHeader(", braceEnd);
  assert.ok(headerAfterPending > braceEnd, "renderCombatHeader must come after the pending block's return");
  assert.doesNotMatch(CODE, /"a-fight"/);
});

// ─── g. Keys (CSCR-06) ────────────────────────────────────────────────────

test("CSCR-06: keydown reads S.combat.pending, dispatches window.mzFight only on Enter/Space, and the arm check stays the S.combat branch's first statement", () => {
  const region = keydownRegion();
  assert.match(region, /S\.combat\.pending/);
  assert.match(region, /window\.mzFight\?\.\(\)/);
  assert.doesNotMatch(region, /k === "1"\) \{ e\.preventDefault\(\); window\.mzFight/);

  const combatIdx = region.indexOf("if (S.combat) {");
  assert.ok(combatIdx !== -1, "if (S.combat) { must exist in the keydown handler");
  const afterCombat = region.slice(combatIdx + "if (S.combat) {".length);
  const firstStatement = afterCombat.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  assert.equal(firstStatement, "if (!encArmed()) return;");
});

// ─── h. Guards (CSCR-08) ──────────────────────────────────────────────────

test("CSCR-08: the render-helpers + renderEncounter region carries no tap-anywhere-to-dismiss listener", () => {
  const region = sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
  for (const bad of [/card\.onclick/, /body\.onclick/, /panel\.onclick/, /body\.addEventListener/, /panel\.addEventListener/, /card\.addEventListener/]) {
    assert.doesNotMatch(region, bad);
  }
});

test("CSCR-08: the guard-helper region carries no transition/animation token", () => {
  const region = guardHelpersRegion();
  assert.doesNotMatch(region, /transition/i);
  assert.doesNotMatch(region, /animation/i);
});

test("CSCR-08: the <style> block carries no aria-disabled selector, and no transitionend/animationend listener exists anywhere", () => {
  assert.doesNotMatch(styleBlock(), /aria-disabled/);
  assert.doesNotMatch(CODE, /transitionend/i);
  assert.doesNotMatch(CODE, /animationend/i);
});

// Phase 58 (MOTION-03, D-11), Plan 06 — beatHurryTap is the ONE sanctioned
// tap-anywhere listener on the encounter panel: it only hurries a live
// combat beat, and it never dispatches, dismisses or selects anything.
// This test names it exactly, rather than letting the pattern-based CSCR-08
// checks above silently tolerate a future second such listener.
test("CSCR-08: #enc-panel carries exactly one capture-phase click listener — beatHurryTap, the one sanctioned tap-anywhere exception (D-11) — whose body dispatches, dismisses and renders nothing", () => {
  const listenerHits = CODE.match(/document\.getElementById\("enc-panel"\)\?\.addEventListener\("click", beatHurryTap, true\);/g) || [];
  assert.equal(listenerHits.length, 1, "exactly one capture-phase click listener must be wired on #enc-panel, naming beatHurryTap");
  const fnHits = CODE.match(/function beatHurryTap\(e\) \{/g) || [];
  assert.equal(fnHits.length, 1, "exactly one function beatHurryTap(e) { declaration");
  const start = CODE.indexOf("function beatHurryTap(e) {");
  const end = CODE.indexOf("\n}", start);
  const body = CODE.slice(start, end + 2);
  assert.doesNotMatch(body, /window\.mz/, "beatHurryTap must never dispatch through a window.mz* bridge");
  assert.doesNotMatch(body, /dispatch/i, "beatHurryTap must never dispatch");
  assert.doesNotMatch(body, /renderEncounter\(\)/, "beatHurryTap must never render directly — the beat's own onSettle does that");
  assert.doesNotMatch(body, /hidden/, "beatHurryTap must never write hidden");
  assert.doesNotMatch(body, /S\./, "beatHurryTap must never touch S");
});

// ─── i. Bridge + imports ──────────────────────────────────────────────────

test("the module imports combatPanel.js/combatMenu.js once each and bridges window.__mzCombatVM exactly once", () => {
  const combatPanelImportHits = CODE.match(/from "\.\/src\/browser\/combatPanel\.js"/g) || [];
  assert.equal(combatPanelImportHits.length, 1, "combatPanel.js must be imported exactly once");
  const combatMenuImportHits = CODE.match(/from "\.\/src\/browser\/combatMenu\.js"/g) || [];
  assert.equal(combatMenuImportHits.length, 1, "combatMenu.js must be imported exactly once");
  const bridgeHits = CODE.match(/window\.__mzCombatVM = \{/g) || [];
  assert.equal(bridgeHits.length, 1, "window.__mzCombatVM bridge must be assigned exactly once");
});

// ─── j. Ally folded into YOUR LOT ─────────────────────────────────────────

test("CSCR-03: the old ally-as-foe-card markup is gone; the ally now folds into YOUR LOT via combatPanel.js's allyThird", () => {
  assert.doesNotMatch(CODE, /className = "foe ally"/);
  assert.doesNotMatch(CODE, /Fighting for you ·/);
  assert.match(COMBAT_PANEL_SRC, /allyThird/);
});

// ─── k. Phase 71 (D-14): foe chips from the one table ─────────────────────

test("Phase 71 D-14: foeStatusBadges(f, V) is a thin reader of window.__mzFoeConditions.chips, mapped to { t, tone }, [] without the bridge", () => {
  const region = sliceBetween(CODE, "function foeStatusBadges(f, V) {", "\n}");
  assert.match(region, /window\.__mzFoeConditions\?\.chips\?\.\(f, V \|\| S\)/);
  assert.match(region, /t: \w+\.text, tone: \w+\.tone/);
  for (const field of ["asleep", "frozen", "acid", "blind", "stupid", "shrunk", "fixated", "frenzied", "hamstrung", "marked", "stunned"]) {
    assert.doesNotMatch(region, new RegExp(`f\\.${field}\\b`), `foeStatusBadges must not read f.${field} itself any more`);
  }
  assert.equal((CODE.match(/function foeStatusBadges\(/g) || []).length, 1);
});

test("Phase 71 D-14: the module imports foeConditions.js once and bridges window.__mzFoeConditions = { chips: foeConditionChips } exactly once", () => {
  assert.equal((CODE.match(/from "\.\/src\/browser\/foeConditions\.js"/g) || []).length, 1);
  assert.equal((CODE.match(/window\.__mzFoeConditions = \{ chips: foeConditionChips \};/g) || []).length, 1);
});

test("Phase 71 D-14 (sandbox): Hamstrung, Marked and Stunned foes show their chips on their own cards; a dead foe reads DOWN", () => {
  const doc = createRecordingDocument();
  const sandbox = loadShellSandbox({ doc });
  const w = sandbox.context.window;
  const foe = (name, extra) => ({ name, type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 10, maxWP: 10, alive: true, asleep: 0, sp: {}, lives: 1, ...extra });
  // The fixed hero/floor shape copied from combat-beat-shell.test.js's fixedState.
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
    foes: [
      foe("Limp Wolf", { hamstrung: true }),
      foe("Marked Rat", { marked: true, blind: true, blindFor: 2 }),
      foe("Dazed Bat", { stunned: true }),
      foe("Gone Toad", { alive: false, wp: 0, hamstrung: true }),
    ],
    type: "Beasts", round: 2, target: 0, spellOpen: false, tracked: false, first: "you",
  };
  w.__mzState.set(state);
  sandbox.context.renderEncounter();
  const body = doc.document.getElementById("enc-body");
  const tagOf = (i) => Array.from(body.querySelectorAll(".cb-foe")).find((el) => el.dataset.foe === String(i)).querySelector(".cb-foe-tag").textContent;
  assert.equal(tagOf(0), "HAMSTRUNG");
  assert.equal(tagOf(1), "BLIND · 2 · MARKED");
  assert.equal(tagOf(2), "STUNNED");
  assert.equal(tagOf(3), "DOWN");
});

// ─── l. Phase 71 (D-05, R-09/R-10): the action area locks while a round plays ─

test("Phase 71 D-05: renderActionArea computes locked from __mzBeat.active and passes { locked } to the menu view-model", () => {
  const region = fnRegion("function renderActionArea(host)");
  assert.match(region, /const locked = !!window\.__mzBeat\?\.active\?\.\(\);/);
  assert.match(region, /window\.__mzCombatVM\.menu\(window\.__mzBeat\?\.view\?\.\(\)\?\.state \|\| S, \{ locked \}\)/);
  assert.match(region, /data-locked/);
  // guardTap wiring is unchanged: strike + three openers + BACK.
  assert.match(region, /guardTap\(document\.getElementById\("cb-strike"\), \(\) => window\.mzAttack\?\.\(\)\);/);
  assert.match(region, /guardTap\(document\.getElementById\("cb-back"\)/);
});

test("Phase 71 D-05: the arm sweep keeps a locked action's aria-disabled — the #enc-panel part carries :not([data-locked]); rail and legend parts unchanged; never the ☰", () => {
  const region = fnRegion("function armEncounterButtons()");
  assert.match(region, /#enc-panel \[aria-disabled="true"\]:not\(\.cb-foe\.dead\):not\(\[data-locked\]\)/);
  assert.match(region, /#mw-rail \[aria-disabled="true"\], \.mw-legend-sheet \[aria-disabled="true"\]:not\(\[data-off\]\)/);
  assert.equal((region.match(/data-locked/g) || []).length, 1);
  assert.doesNotMatch(region, /mw-hud-menu/);
});

test("Phase 71 D-05: a #cb-act[data-locked=\"1\"] rule dims the prompt and actions, drops the raised shadow, and makes them pointer-inert with no press feedback — no motion, no aria-disabled selector", () => {
  const css = styleBlock();
  const rules = css.match(/^#cb-act\[data-locked="1"\][^{]*\{[^}]*\}/gm) || [];
  assert.ok(rules.length >= 1, "at least one #cb-act[data-locked=\"1\"] rule");
  const all = rules.join("\n");
  assert.match(all, /pointer-events:none/);
  assert.match(all, /box-shadow:none/);
  assert.match(all, /opacity:\.45/);
  assert.match(all, /#8f856f/);
  assert.match(all, /:active[^{]*\{[^}]*transform:none/);
  assert.doesNotMatch(all, /transition|animation/);
  assert.doesNotMatch(css, /aria-disabled/);
});

test("Phase 71 D-06/R-08: still exactly one capture click listener on #enc-panel — no second tap-to-skip listener was added", () => {
  // 71-04 (D-08) adds a pointerdown and a contextmenu listener on #enc-panel
  // for the foe long press; neither is a click listener, so the pin counts
  // CLICK listeners on #enc-panel (the tap-to-skip surface), and names the
  // only other two event types allowed there.
  const clicks = CODE.match(/getElementById\("enc-panel"\)\?\.addEventListener\("click"/g) || [];
  assert.equal(clicks.length, 1);
  const types = [...CODE.matchAll(/getElementById\("enc-panel"\)\?\.addEventListener\("([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(types, ["click", "contextmenu", "pointerdown"]);
});

// ─── l2. Phase 71 (71-06, D-07/D-06): the strip opens THE FIGHT SO FAR ──
//
// The strip's open tap is a guardTap-wired element handler (not a card,
// body or panel listener, so the CSCR-08 checks above still hold), and
// #enc-panel still carries exactly one capture click listener: mid-round,
// beatHurryTap stops the tap before the strip's handler (R-18), and
// encArmed() refuses it anyway.

test("Phase 71 (71-06): renderRoundStrip wires the strip's open tap through guardTap(strip, openFightLogSheet) as a keyboard-reachable button; no new #enc-panel listener", () => {
  const region = fnRegion("function renderRoundStrip(host, fallbackRound)");
  const hits = region.match(/guardTap\(strip, openFightLogSheet\);/g) || [];
  assert.equal(hits.length, 1, "exactly one guarded open tap");
  assert.doesNotMatch(region, /strip\.onclick\s*=/, "never a bare onclick");
  assert.doesNotMatch(region, /addEventListener/, "no listener of its own");
  assert.match(region, /strip\.setAttribute\("role", "button"\);/);
  assert.match(region, /strip\.tabIndex = 0;/);
  const clicks = CODE.match(/getElementById\("enc-panel"\)\?\.addEventListener\("click"/g) || [];
  assert.equal(clicks.length, 1, "still one capture click on #enc-panel");
});

// ─── m. Phase 71 (D-11): one Details sibling per foe card ────────────────

test("Phase 71 D-11: renderFoeCards builds one sr-only .cb-foe-details button per card, after the card, wired through guardTap to mzInspectFoe", () => {
  const region = fnRegion("function renderFoeCards(host, vm, onPick, hitFoe = -1)");
  assert.equal((region.match(/document\.createElement\("button"\)/g) || []).length, 1, "one Details button built per card iteration");
  assert.match(region, /details\.className = "sr-only cb-foe-details";/);
  assert.match(region, /details\.type = "button";/);
  assert.match(region, /details\.setAttribute\("aria-label", /);
  assert.match(region, /guardTap\(details, \(\) => window\.mzInspectFoe\?\.\(c\.i\)\);/);
  const cardAppend = region.indexOf("list.appendChild(el);");
  const detailsAppend = region.indexOf("list.appendChild(details);");
  assert.ok(cardAppend !== -1 && detailsAppend > cardAppend, "the Details button is the card's next sibling");
  assert.doesNotMatch(region, /details[^;\n]*target/, "the Details button never aims");
});
