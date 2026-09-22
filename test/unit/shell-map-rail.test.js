// test/unit/shell-map-rail.test.js
//
// Phase 35 (Map Screen Rebuild, MAP-03/04/05/08), Plan 02 — mazeworld.html
// has no module surface a test could import directly (it is not an ESM
// module the test runner can load), so — mirroring shell-combat-over.
// test.js's own source-assertion pattern — this file reads the real shipped
// source with fs.readFileSync and asserts against it directly: the #mw-rail
// markup/CSS, the total retirement of the DR13/25.1 toast host, the
// dispatchWithNarration routing seam into rail.js, the classic renderRail()/
// railButtons()/syncRailLive()/railPulse() trio and its key-gated rise/
// announce/auto-clear cycle, the joiner/find/climb decision cards, the
// GLOBAL movement lock (railLocked()), the retired Move-on card path, and
// the static tab bar layout. A BEHAVIOUR section proves the real
// rail.js/narrationLines.js/eventNarration.js fold produces the exact cards this
// plan's CONTEXT sample copy describes. (o) pins the 2026-09-16 UAT ruling
// that the rail is a map-tab element (mwActiveTab in showTab/renderRail).
// (p) pins the 2026-09-17 UAT ruling that the idle "NOTHING IS HAPPENING"
// card stays hidden while the encounter panel covers the map (a real card,
// e.g. bagFull, still shows), and that renderEncounter re-renders the rail
// on both panel show/hide sites.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { linesForAction } from "../../src/browser/narrationLines.js";
import { railCardFor } from "../../src/browser/rail.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (line comments first, THEN block comments — see
// shell-narration-wiring.test.js's own doc comment for why the order matters) ──
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

// railRegion(): renderRail()'s own body. The plan's own read_first names the
// save/load banner COMMENT as the conceptual end-of-region marker, but that
// text lives inside a block comment stripComments() blanks out — searching
// CODE for it would never match. `function syncRailLive(text)` is the very
// next function renderRail() abuts (proven by shell-loot-screen.test.js's
// own equivalent fix), so it is the safe, content-based boundary used here.
function railRegion() {
  return fnRegion("function renderRail()");
}
function railButtonsRegion() {
  return fnRegion("function railButtons(host, buttons)");
}
function dispatchRegion() {
  // Phase 58 (MOTION-03, D-12) re-pin: dispatchWithNarration grew an
  // `opts = {}` second parameter (engineCombatAction's deferred-cues seam).
  return sliceBetween(CODE, "function dispatchWithNarration(action, opts = {})", "window.move = function engineMove");
}
function engineMoveRegion() {
  return sliceBetween(CODE, "window.move = function engineMove", "function stepNow(dir)");
}
function stepNowRegion() {
  return sliceBetween(CODE, "function stepNow(dir)", "window.mzDevStartAtDepth = ");
}
// Phase 39 (GEAR-05), Plan 05: the dispatch body moved into stepWith(action)
// — stepNow(dir) above is now a thin { type: "move", dir } wrapper over it.
function stepWithRegion() {
  return sliceBetween(CODE, "function stepWith(action)", "function stepNow(dir)");
}
// Phase 58 (MOTION-03): the death/beats branch conditions now also carry
// the beat's `!bv && ` gate (D-09/D-11) — re-pinned to the landed strings.
function deathBranch() {
  return sliceBetween(CODE, "if (!bv && S.dead) {", "if (!bv && !S.combat && S.beats && S.beats.groups && S.beats.groups.length) {");
}
function beatsBranch() {
  return sliceBetween(
    CODE,
    "if (!bv && !S.combat && S.beats && S.beats.groups && S.beats.groups.length) {",
    "if (!bv && S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {",
  );
}
function hasActiveRegion() {
  return sliceBetween(CODE, "function hasActiveEncounter()", "function railLocked()");
}
function mzMakeCampRegion() {
  return sliceBetween(CODE, "window.mzMakeCamp = () => {", "window.mzReturnToTitle");
}
function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}
function styleBlock() {
  const start = HTML.indexOf("<style>");
  const end = HTML.lastIndexOf("</style>") + "</style>".length;
  return HTML.slice(start, end);
}

// ─── (a) markup ─────────────────────────────────────────────────────────

test("(a) markup: #mw-rail exists once, sits between </main> and the tab bar, its five inner ids appear once each, and the persistent live node precedes any <script>", () => {
  assert.equal((HTML.match(/id="mw-rail"/g) || []).length, 1);
  const mainIdx = HTML.indexOf("</main>");
  const railIdx = HTML.indexOf('id="mw-rail"');
  const navIdx = HTML.indexOf('<nav class="mw-tabbar"');
  assert.ok(mainIdx !== -1 && railIdx !== -1 && navIdx !== -1);
  assert.ok(mainIdx < railIdx && railIdx < navIdx, "#mw-rail must sit between </main> and the tab bar");
  for (const id of ["mw-rail-lines", "mw-rail-actions", "mw-rail-title", "mw-rail-icon", "mw-rail-peek"]) {
    assert.equal((HTML.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `id="${id}" must appear exactly once`);
  }
  assert.equal((HTML.match(/id="mw-rail-live"/g) || []).length, 1);
  assert.match(HTML, /id="mw-rail-live" aria-live="polite" aria-atomic="true"/);
  const liveIdx = HTML.indexOf('id="mw-rail-live"');
  const firstScriptIdx = HTML.indexOf("<script>");
  assert.ok(firstScriptIdx !== -1 && liveIdx < firstScriptIdx, "the live node must live in the markup, before the first <script>");
});

// ─── (b) CSS ────────────────────────────────────────────────────────────

test("(b) CSS: .mw-rail's own values, the five tone rules, typography, action-button shadows, and one @keyframes mwpulse, no aria-disabled in the style block", () => {
  // Phase 57 (LAYOUT-01): re-pinned from the old flex:none;min-height:132px
  // sibling rule to the absolute-overlay rule — position/transform/
  // visibility/pointer-events replace the flex participation, the padding
  // and border-top are unchanged. The structural half of this claim (the
  // rail is out of #app's flex flow) is proven with teeth by
  // rail-overlay.test.js; this test only pins the byte-exact declarations.
  // Phase 58 (MOTION-02): the base/shown rules now also carry the close/
  // open transitions, and the hidden rule's display restore is !important
  // (beats the global [hidden]{display:none!important} reset — see
  // panel-motion.test.js's own dedicated test for the rationale).
  assert.match(HTML, /\.mw-rail\{[^}]*position:absolute[^}]*padding:14px 16px 18px[^}]*border-top:3px solid var\(--rail-edge\)[^}]*transform:translateY\(100%\)[^}]*visibility:hidden[^}]*pointer-events:none;transition:transform \.12s ease-in,visibility 0s \.12s\}/);
  assert.doesNotMatch(HTML.match(/^\.mw-rail\{[^}]*\}/m)[0], /flex:none|min-height:132px/);
  assert.match(HTML, /^\.mw-rail\[hidden\]\{display:block!important;transform:translateY\(100%\);visibility:hidden;pointer-events:none\}$/m);
  assert.match(HTML, /^\.mw-rail\[data-shown="1"\]\{transform:translateY\(0\);visibility:visible;pointer-events:auto;transition:transform \.18s ease-out,visibility 0s\}$/m);
  const tones = {
    info: ["#6b5c3c", "#e8c97a"],
    good: ["#5e7a3c", "#a8cc72"],
    bad: ["#a63a2c", "#e07260"],
    odd: ["#5b4a86", "#b9a4ef"],
    dull: ["#3a3226", "#a89c82"],
  };
  for (const [tone, [edge, ink]] of Object.entries(tones)) {
    assert.equal(
      (HTML.match(new RegExp(`\\.mw-rail\\[data-tone="${tone}"\\]\\{--rail-edge:${edge};--rail-ink:${ink}\\}`, "g")) || []).length,
      1,
      `the ${tone} tone rule must carry exactly edge ${edge} / ink ${ink}`,
    );
  }
  assert.match(HTML, /\.mw-rail\[data-idle="1"\]\{background:#161209\}/);
  assert.match(HTML, /\.mw-rail-title\{[^}]*font-size:8px/);
  assert.match(HTML, /\.mw-rail-line\{[^}]*font-size:14\.5px/);
  assert.match(HTML, /\.mw-rail-roll\{[^}]*font-size:13\.5px/);
  assert.match(HTML, /\.mw-rail-peek\{[^}]*font-size:6px;color:#5f5849/);
  assert.match(HTML, /\.mw-rail-btn\{[^}]*box-shadow:0 4px 0 #6b5c3c/);
  assert.match(HTML, /\.mw-rail-btn\.secondary\{background:#241d12;color:#c9bda0;border:2px solid #4a4032/);
  assert.equal((HTML.match(/@keyframes mwpulse/g) || []).length, 1);
  assert.doesNotMatch(styleBlock(), /aria-disabled/);
});

// ─── (c) toast retirement (RAW HTML, comments included) ──────────────────

test("(c) toast retirement: zero occurrences of the toast builder, the host id/class, the lifetime bridge, the cap constant, the lifetime function — literals concatenated so this file never spells them verbatim", () => {
  const forbidden = [
    ["window.mz", "Toast"].join(""),
    [".mw-", "toast"].join(""),
    ["__mz", "ToastLifetime"].join(""),
    ["MAX", "_TOASTS"].join(""),
    ["toast", "Lifetime"].join(""),
  ];
  for (const literal of forbidden) {
    const hits = HTML.match(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(hits.length, 0, `expected zero occurrences of "${literal}" anywhere in mazeworld.html (comments included), found ${hits.length}`);
  }
});

// ─── (d) routing ──────────────────────────────────────────────────────────

test("(d) routing: dispatchWithNarration routes on exactly one if (wasCombat || inCombat) and folds the out-of-combat branch through rail.js uncapped, withIdx", () => {
  const region = dispatchRegion();
  assert.equal((region.match(/if \(wasCombat \|\| inCombat\) \{/g) || []).length, 1);
  assert.match(region, /\{ limit: Infinity, withIdx: true \}/);
  assert.match(region, /railCardFor\(action\.type, result\.events, folded, ctx\)/);
  assert.match(region, /railPush\(window\.__mzRail, card\)/);
  assert.match(region, /window\.renderRail\?\.\(\)/);
  assert.match(region, /window\.__mzFightLog = null/);
  assert.equal((CODE.match(/linesForAction\(/g) || []).length, 1, "exactly one fold call site in the whole file");
});

// ─── (e) bridges ──────────────────────────────────────────────────────────

test("(e) bridges: window.__mzRailVM/__mzRail/mzRailLine/renderRail/mzRailPulse each appear once; the rail.js import appears once", () => {
  for (const needle of [
    "window.__mzRailVM = {",
    "window.__mzRail = emptyRail();",
    "window.mzRailLine = ",
    "window.renderRail = renderRail;",
    "window.mzRailPulse = railPulse;",
  ]) {
    assert.equal((CODE.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1, `expected exactly one "${needle}"`);
  }
  assert.equal((CODE.match(/from "\.\/src\/browser\/rail\.js"/g) || []).length, 1);
});

// ─── (f) renderRail ─────────────────────────────────────────────────────

test("(f) renderRail: decision precedence (joiner < find < climb < card < idle), the key gate, armEncounterButtons, the generic guardTap wiring, the five action ids, zero innerHTML/listener-on-panel-body-card, one setTimeout whose delay comes from holdForCard", () => {
  const region = railRegion();
  const idx = (needle) => region.indexOf(needle);
  const joinerIdx = idx("if (S.pendingJoiner && !S.combat && !S.store) {");
  const findIdx = idx("if (S.pendingFind && !S.combat && !S.store) {");
  const climbIdx = idx('if (rail.pending && rail.pending.kind === "climb") {');
  const cardIdx = idx("if (rail.card) {");
  const idleKeyIdx = idx('key = "idle:"');
  assert.ok([joinerIdx, findIdx, climbIdx, cardIdx, idleKeyIdx].every((i) => i !== -1), "every branch must be present");
  assert.ok(joinerIdx < findIdx && findIdx < climbIdx && climbIdx < cardIdx && cardIdx < idleKeyIdx, "precedence order must be joiner < find < climb < card < idle");
  assert.match(region, /lastRailKeyShown/);
  assert.match(region, /armEncounterButtons\(\);/);
  for (const id of ["a-join-yes", "a-join-no", "a-find-take", "a-find-leave", "mw-rail-climb"]) {
    assert.match(region, new RegExp(`id: "${id}"`));
  }
  assert.doesNotMatch(region, /innerHTML/);
  for (const bad of [/panel\.onclick/, /body\.onclick/, /card\.onclick/, /panel\.addEventListener/, /body\.addEventListener/, /card\.addEventListener/]) {
    assert.doesNotMatch(region, bad);
  }
  assert.equal((region.match(/setTimeout\(/g) || []).length, 1);
  // Phase 57 (LAYOUT-03): the auto-clear timer's delay comes from the
  // bridged holdForCard(...) (line-scaled, bounded), not a raw literal
  // fallback. Phase 58 (MOTION-04, D-15): the timer itself now lives inside
  // the `startHold` closure, called from the typewriter's own `onDone` (the
  // hold is reading time, not typing time) rather than scheduled directly
  // in the isNew block — `holdCard` (captured once, `!idle && !buttons.length
  // && rail.card`) replaces the old direct `rail.card` argument so the
  // closure captures a stable reference across the async gap between the
  // card's own render and its typing block finishing.
  assert.match(region, /vm\.holdForCard \? vm\.holdForCard\(holdCard\) : 8400/);
  assert.match(railButtonsRegion(), /guardTap\(document\.getElementById\(b\.id\), b\.onTap\)/);
});

// ─── (g) joiner ─────────────────────────────────────────────────────────

test("(g) joiner: the DFB-04 who-walks rule (cap/S.party[0]/headLine/template literal) lives in renderRail now", () => {
  const region = railRegion();
  assert.match(region, /const cap = window\.__mzPartyCap \?\? 1;/);
  assert.match(region, /S\.party\[0\]/);
  assert.match(region, /const headLine = walker/);
  assert.match(region, /Take \$\{j\.name \|\| "them"\} along\? \$\{walker\.name \|\| "Your companion"\} walks\.`/);
  assert.match(region, /window\.mzResolveJoiner\?\.\(true\)/);
  assert.match(region, /window\.mzResolveJoiner\?\.\(false\)/);
});

// ─── (h) find ───────────────────────────────────────────────────────────

test("(h) find: window.__mzBagUsage/usage.have/usage.slots, the shared renderDropShelf, copy.find.takeNow", () => {
  const region = railRegion();
  assert.match(region, /window\.__mzBagUsage\(c\)/);
  assert.match(region, /usage\.have/);
  assert.match(region, /usage\.slots/);
  assert.match(region, /renderDropShelf\(document\.getElementById\("find-drop-shelf"\)/);
  assert.match(region, /copy\.find\.takeNow/);
});

// ─── (i) climb ──────────────────────────────────────────────────────────

test('(i) climb: id: "mw-rail-climb" retries window.move(pend.dir) and clears pending: null first', () => {
  const region = railRegion();
  assert.match(region, /id: "mw-rail-climb"/);
  assert.match(region, /window\.move\(pend\.dir\)/);
  const climbIdx = region.indexOf('id: "mw-rail-climb"');
  const nextClimbIdx = region.indexOf("if (rail.card) {", climbIdx);
  const climbButtonSlice = region.slice(climbIdx, nextClimbIdx === -1 ? undefined : nextClimbIdx);
  assert.match(climbButtonSlice, /pending: null/);
});

// ─── (j) lock ───────────────────────────────────────────────────────────

test("(j.1) lock: railLocked() is the ONE global movement lock; hasActiveEncounter() no longer raises it for joiner/find", () => {
  assert.equal((CODE.match(/^function railLocked\(\)/gm) || []).length, 1);
  const lockRegion = sliceBetween(CODE, "function railLocked()", "let encRenderedAt = 0;");
  assert.match(lockRegion, /S\.pendingJoiner/);
  assert.match(lockRegion, /S\.pendingFind/);
  assert.match(lockRegion, /window\.__mzRail\.pending/);
  const activeRegion = hasActiveRegion();
  assert.doesNotMatch(activeRegion, /pendingJoiner/);
  assert.doesNotMatch(activeRegion, /pendingFind/);
});

test("(j.2) lock: engineMove/stepNow carry the exact Task 2 shapes — the lock clause after the settle clause, the climb-pending stash, preDeath survives", () => {
  const moveRegion = engineMoveRegion().replace(/\s+/g, " ");
  // Phase 35 Plan 04 (MAP-05, decision 5) re-pin: the stair-down gate
  // (stepTargetsExit) now sits between the railLocked() clause and
  // stepNow(dir) — the lock-clause-after-settle-clause shape this test
  // exists to pin is otherwise unchanged.
  assert.match(
    moveRegion,
    /if \(hasActiveEncounter\(\)\) return; if \(!encounterSettled\(\)\) return; if \(railLocked\(\)\) \{ window\.mzRailPulse\?\.\(\); return; \} if \(stepTargetsExit\(dir\)\) \{ window\.__mzStair = \{ dir \}; window\.renderEncounter\(\); return; \} stepNow\(dir\);/,
  );

  const stepRegion = stepWithRegion();
  // Phase 39 (GEAR-05), Plan 05: the pending shape widened to also stash a
  // hazard's own `feat` and, when no torch is carried, nothing at all for a
  // darknessFell.
  assert.match(stepRegion, /const fellClimb = events\.some\(\(e\) => e\.type === "fellClimbing"\);/);
  assert.match(stepRegion, /const fellGorge = events\.some\(\(e\) => e\.type === "fellInGorge"\);/);
  assert.match(stepRegion, /const darkFell = events\.some\(\(e\) => e\.type === "darknessFell"\);/);
  assert.match(stepRegion, /const torch = window\.__mzHasTool\(state\.c, "torch"\);/);
  assert.match(stepRegion, /\{ kind: "climb", dir: action\.dir, feat: fellGorge \? "gorge" : "climb" \}/);
  assert.match(stepRegion, /darkFell && torch/);
  assert.match(stepRegion, /\{ kind: "dark" \}/);
  assert.match(stepRegion, /preDeath: true/);
  const stepNowRegionText = stepNowRegion();
  assert.match(stepNowRegionText, /stepWith\(\{ type: "move", dir \}\);/);
});

// ─── (k) Move-on retirement ───────────────────────────────────────────────

test("(k.1) Move-on retirement: CARD_EVENTS/beatsTitleFor/FEATURE_EVENT_TITLE/the retired dismiss id/preDeathBeat/stepping() are all gone", () => {
  const forbidden = [
    ["CARD", "_EVENTS"].join(""),
    ["beats", "TitleFor"].join(""),
    ["FEATURE_EVENT", "_TITLE"].join(""),
    ['"a', '-next"'].join(""),
    ["preDeath", "Beat"].join(""),
    ["stepping", "()"].join(""),
  ];
  for (const literal of forbidden) {
    const hits = CODE.match(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(hits.length, 0, `expected zero occurrences of "${literal}" in CODE, found ${hits.length}`);
  }
});

test("(k.2) Move-on retirement: death/beats/camp carry their Phase 35 replacements", () => {
  const death = deathBranch();
  assert.match(death, /renderCombatOver\(body, "dead"/);
  assert.match(death, /S\.beats\.preDeath/);
  const beats = beatsBranch().replace(/\s+/g, " ");
  assert.match(beats, /if \(b\.over\) \{/);
  assert.match(beats, /S\.beats = null; renderEncounter\(\); return;/);
  assert.doesNotMatch(mzMakeCampRegion(), /state\.beats/);
});

// ─── (l) layout ─────────────────────────────────────────────────────────

test("(l) layout: the tab bar is a static flex child, .mw-screens is flush inside #mw-stage, and paint() renders the rail right after the encounter overlay", () => {
  const tabbarRule = HTML.match(/\.mw-tabbar\{([^}]*)\}/);
  assert.ok(tabbarRule);
  assert.match(tabbarRule[1], /flex:none/);
  assert.doesNotMatch(tabbarRule[1], /position:fixed/);
  assert.match(HTML, /\.mw-screens\{[^}]*padding:0[^}]*\}/);
  // Phase 57 (LAYOUT-01): #mw-stage wraps .mw-screens + #mw-rail; the tab
  // bar stays a direct child of #app, outside the wrapper.
  const stageIdx = HTML.indexOf('id="mw-stage"');
  const mainIdx = HTML.indexOf('<main class="mw-screens"');
  const railIdx = HTML.indexOf('id="mw-rail"');
  const stageCloseIdx = HTML.indexOf("</div>", railIdx);
  const navIdx = HTML.indexOf('<nav class="mw-tabbar"');
  assert.ok(stageIdx !== -1 && stageIdx < mainIdx, "#mw-stage must open before <main class=\"mw-screens\"");
  assert.ok(stageCloseIdx !== -1 && stageCloseIdx > railIdx && stageCloseIdx < navIdx, "#mw-stage's closing </div> must sit after #mw-rail and before the tab bar");
  // Phase 49 (PERF-02, fix 2): renderRail() is still the statement directly
  // before draw() — draw() is now the ONLY canvas draw per step (stepWith's
  // own redundant second draw() call, 49-01's finding, was removed) — but a
  // dev-gated timing bracket (`const perf = ...; const tDraw = ...;`) now
  // sits textually between them, so the adjacency check allows any
  // non-brace content in between rather than requiring zero gap.
  assert.match(CODE, /renderEncounter\(\);\s*renderRail\(\);[^{}]*draw\(\);/);
});

// ─── (m) aria-disabled sweep ──────────────────────────────────────────────

// Phase 57 (LAYOUT-02): unchanged by design — the new #mw-rail body-tap
// dismiss handler deliberately does NOT stamp aria-disabled on the rail
// container itself (see mazeworld.html's own handler doc comment for why:
// guardTap's own aria-disabled/descendant-selector pairing would leave the
// attribute stuck on #mw-rail forever), so the descendant sweep selector
// pinned below still covers every element that actually needs clearing.
test('(m) armEncounterButtons\' sweep selector includes #mw-rail [aria-disabled="true"]', () => {
  assert.match(CODE, /#mw-rail \[aria-disabled="true"\]/);
});

// ─── (n) BEHAVIOUR: the real fold produces the exact cards this plan describes ──

test('(n) BEHAVIOUR: a failed climb folds to a bad "FELL" card whose only line has roll === null; floorChanged yields "FLOOR 4"; keydown Enter clicks cb-over-btn only', () => {
  const climbEvents = [{ type: "moved", x: 2, y: 2 }, { type: "fellClimbing", hurt: 3 }];
  const climbFolded = linesForAction("move", climbEvents, {}, { limit: Infinity, withIdx: true });
  const climbCard = railCardFor("move", climbEvents, climbFolded, {});
  assert.ok(climbCard);
  assert.equal(climbCard.tone, "bad");
  assert.equal(climbCard.title, "FELL");
  assert.equal(climbCard.lines.length, 1);
  assert.equal(climbCard.lines[0].roll, null);

  const floorEvents = [{ type: "moved", x: 3, y: 3 }, { type: "floorChanged", depth: 4 }];
  const floorFolded = linesForAction("move", floorEvents, {}, { limit: Infinity, withIdx: true });
  const floorCard = railCardFor("move", floorEvents, floorFolded, {});
  assert.ok(floorCard);
  assert.equal(floorCard.title, "FLOOR 4");

  const region = keydownRegion();
  assert.match(region, /const n = document\.getElementById\("cb-over-btn"\); if \(n\) n\.click\(\);/);
  assert.doesNotMatch(region, /document\.getElementById\("a-next"\)/);
});

// ─── (o) 2026-09-17 UAT ruling: the rail is the ONE feedback surface on every tab, shown only when it has something to report ────────────

test("(o) 2026-09-17 UAT ruling (reverses the 2026-09-16 map-tab-only rule): showTab never hides the rail by tab and only re-renders it (guarded on __mzState); renderRail hides exactly when idle or when combat/death/win own the screen", () => {
  assert.equal((CODE.match(/^let mwActiveTab = "maze";/gm) || []).length, 1);
  assert.ok(CODE.indexOf('let mwActiveTab = "maze";') < CODE.indexOf("(function initTabs() {"));

  const showTabRegion = sliceBetween(CODE, "function showTab(name) {", 'for (const btn of tabs) btn.addEventListener("click"');
  assert.match(showTabRegion, /mwActiveTab = name;/);
  // No per-tab hide any more — a live card (equip refusal on Gear, cast
  // refusal on Hero, an event on Map) stays visible wherever the player is.
  assert.doesNotMatch(showTabRegion, /railEl\.hidden/);
  // 2026-09-17 boot fix: renderRail is a hoisted classic global, so the
  // tab-init showTab("maze") must not call it before `let S` runs — the
  // __mzState sentinel (assigned right after S) is the guard.
  assert.match(showTabRegion, /if \(window\.__mzState\) window\.renderRail\?\.\(\);/);
  assert.doesNotMatch(showTabRegion, /if \(name === "maze"\) window\.renderRail/);
  assert.doesNotMatch(showTabRegion, /\bS\./);

  // "Rail should only show up if there is something to report": idle hides
  // it everywhere (no NOTHING IS HAPPENING card, and THEY ARE DOWN keeps its
  // full height); a real card (event, decision, bagFull/equip refusal) shows
  // on any tab; combat/death still own their screens.
  const region = railRegion();
  assert.match(region, /railEl\.hidden = !!\(S\.combat \|\| S\.dead\) \|\| idle;/);
  assert.doesNotMatch(region, /mwActiveTab !== "maze"/);
  assert.doesNotMatch(region, /panelUp/);
});

// ─── (p) 2026-09-17: renderEncounter re-renders the rail on both panel show/hide sites ────────────

test("(p) renderEncounter re-renders the rail (guarded on __mzState) and toggles the pulse cover on both panel show/hide sites", () => {
  const encRegion = fnRegion("function renderEncounter() {");
  // Phase 58 (MOTION-02): the raw panel.hidden writes now route through
  // hidePanel()/showPanel() (window.__mzMotion's fail-open wrappers) — the
  // same call sites, the same surrounding statements.
  assert.match(encRegion, /if \(panel\) hidePanel\(panel\);\s*\n\s*document\.getElementById\("mw-party-pulse"\)\?\.classList\.remove\("covered"\);\s*\n\s*if \(window\.__mzState\) window\.renderRail\?\.\(\);/);
  assert.match(encRegion, /if \(panel\) showPanel\(panel\);\s*\n\s*document\.getElementById\("mw-party-pulse"\)\?\.classList\.add\("covered"\);\s*\n\s*if \(window\.__mzState\) window\.renderRail\?\.\(\);/);
});

// ─── (q) 2026-09-17 UAT ruling (actual icons): renderRail's <img> branch, mzRailLine's optional trailing iconKey ────────────

test('(q) 2026-09-17 UAT ruling (actual icons): renderRail renders an <img> from featureIconSrc(iconKey) via createElement (no innerHTML) and falls back to the glyph; mzRailLine forwards the optional trailing iconKey', () => {
  const region = railRegion();
  assert.match(region, /iconKey = rail\.card\.iconKey \?\? null;/);
  assert.match(region, /iconKey = base\.iconKey \?\? null;/);
  assert.match(region, /iconEl\.textContent = iconKey \? "" : icon;/);
  assert.match(region, /img\.src = featureIconSrc\(iconKey\);/);
  assert.match(region, /document\.createElement\("img"\)/);
  assert.doesNotMatch(region, /innerHTML/);

  assert.equal((CODE.match(/^function featureIconSrc\(key\)/gm) || []).length, 1);
  assert.equal((CODE.match(/^const FEATURE_ICON_PATH = Object\.freeze\(\{ dir: "\.\/icons\/optimized\/", ext: "\.png" \}\);/gm) || []).length, 1);
  assert.equal((CODE.match(/window\.mzRailLine = \(title, line, tone, hold, icon, iconKey = null\) =>/g) || []).length, 1);
  assert.equal((CODE.match(/railLineCard\(title, line, tone, hold, icon, iconKey\)/g) || []).length, 1);

  assert.match(HTML, /^\.mw-rail-icon img\{width:26px;height:26px;object-fit:contain;display:block\}$/m);
});
