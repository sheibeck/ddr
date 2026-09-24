// test/unit/shell-fight-log.test.js
//
// Phase 34 (CSCR-04/08), Plan 02 — replaces test/unit/shell-round-card.test.js.
// mazeworld.html has no module surface a test could import directly (it is
// not an ESM module the test runner can load), so — mirroring
// shell-narration-wiring.test.js's own source-assertion pattern — this file
// reads the real shipped source with fs.readFileSync and asserts against it
// directly:
//   1. the persistent #enc-round-live announcer (unchanged placement);
//   2. syncFightLogLive: no innerHTML, seq-gated via fightLogAnnouncement,
//      and the old syncRoundCardLive is fully gone from the guard-helper
//      region (which also stays free of transition/animation tokens);
//   3. renderFightLog(host): Phase 71 (71-06) re-hosted it as THE FIGHT SO
//      FAR sheet's row builder — it reads window.__mzFightLogVM.byRound,
//      builds every ROUND n header and entry via textContent (never
//      innerHTML), tags revealable entries with cb-log-revealable, toggles
//      in place (no renderEncounter call), and never announces (the sheet
//      is not a live region; renderRoundStrip feeds the announcer);
//   4. renderEncounter no longer calls renderFightLog from the combat
//      branch (Phase 71 R-19: the what-happened strip, renderRoundStrip,
//      replaced the in-panel log; openFightLogSheet is its one caller) and
//      carries zero remaining Round Card artifacts;
//   5. routing exclusivity: dispatchWithNarration has exactly one
//      `if (wasCombat || inCombat)`, routes every folded line (refusals
//      included) through fightLogLinesFor, and never re-checks
//      PRIORITY.block itself (that tone lives in fightLog.js now);
//   6. the BEHAVIOUR partition (narrative vs. dull) over the full LINE_FOR
//      manifest + REFUSAL_TYPES, the uncapped-log/uncapped-default fold
//      contract, the __mzFightLogVM bridge, the .cb-log* CSS contract, the
//      scoped DR18 rule, noteCombat's `over` tags, and a voice scan of the
//      new flee beat title.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { linesForAction, LINE_FOR, PRIORITY } from "../../src/browser/narrationLines.js";
import { fightLogLinesFor } from "../../src/browser/fightLog.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

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

function renderEncounterRegion() {
  return sliceBetween(CODE, "function renderEncounter()", "function noteCombat(");
}

function dispatchRegion() {
  // Phase 58 (MOTION-03, D-12) re-pin: dispatchWithNarration grew an
  // `opts = {}` second parameter (engineCombatAction's deferred-cues seam).
  return sliceBetween(CODE, "function dispatchWithNarration(action, opts = {})", "window.move = function engineMove");
}

// A per-function slice from an exact signature to the NEXT "\nfunction "
// after it — stays valid when Plans 03-05 add more render helpers between
// renderFightLog and renderEncounter.
function fnRegion(sig) {
  const start = CODE.indexOf(sig);
  assert.ok(start !== -1, `signature not found: ${sig}`);
  const end = CODE.indexOf("\nfunction ", start + sig.length);
  assert.ok(end !== -1 && end > start, `no following function boundary after: ${sig}`);
  return CODE.slice(start, end);
}

function helpersRegion() {
  return fnRegion("function renderFightLog(host)");
}

function guardRegion() {
  return sliceBetween(CODE, "let encRenderedAt = 0;", "function wireDeathConfirm()");
}

function noteCombatRegion() {
  return sliceBetween(CODE, "function noteCombat(", "function hapticForEvents");
}

// ─── 1. persistent aria-live announcer ────────────────────────────────────

test("#enc-round-live is a persistent sr-only aria-live=\"polite\" aria-atomic=\"true\" sibling of #enc-body inside #enc-panel", () => {
  const liveMatch = HTML.match(/<div class="sr-only" id="enc-round-live" aria-live="polite" aria-atomic="true"><\/div>/);
  assert.ok(liveMatch, "#enc-round-live must exist with the exact sr-only/aria-live/aria-atomic contract");

  const encBodyIdx = HTML.indexOf('<div id="enc-body"></div>');
  const liveIdx = HTML.indexOf('id="enc-round-live"');
  const panelStart = HTML.indexOf('id="enc-panel"');
  const panelCloseIdx = HTML.indexOf("</section>", liveIdx);
  assert.ok(encBodyIdx !== -1 && liveIdx > encBodyIdx, "#enc-round-live must come after #enc-body");
  assert.ok(panelStart !== -1 && liveIdx > panelStart, "#enc-round-live must be inside #enc-panel");
  assert.ok(panelCloseIdx !== -1 && liveIdx < panelCloseIdx, "#enc-round-live must be inside #enc-panel's closing </section>");
});

// ─── 2. guard-helper region: syncFightLogLive replaces syncRoundCardLive ──

test("guard-helper region defines syncFightLogLive(log), reads fightLogAnnouncement, has no innerHTML and no transition/animation token", () => {
  const region = guardRegion();
  assert.match(region, /function syncFightLogLive\(log\)/);
  assert.match(region, /announcement\(log, fightLogAnnouncedSeq\)/);
  assert.doesNotMatch(region, /innerHTML/);
  assert.doesNotMatch(region, /transition|animation/i);
});

test("syncRoundCardLive has zero occurrences anywhere in CODE", () => {
  const hits = CODE.match(/syncRoundCardLive/g) || [];
  assert.equal(hits.length, 0, "syncRoundCardLive must be fully retired");
});

// ─── 3. renderFightLog(host) ───────────────────────────────────────────────

// Phase 71 (71-06, R-23): the reveal/roll pins moved with the rows into
// THE FIGHT SO FAR sheet. A row reveals exactly its entry's own roll; a row
// with no roll gets no handler.
test("renderFightLog(host) — the sheet's row builder — reads window.__mzFightLogVM.byRound, builds headers and entries via textContent, tags revealable entries, toggles in place", () => {
  const region = helpersRegion();
  assert.match(region, /function renderFightLog\(host\)/);
  assert.match(region, /window\.__mzFightLogVM\.byRound\(window\.__mzFightLog\)/);
  assert.match(region, /dataset\.logId/);
  assert.match(region, /copy\.roundHead[^\n]*\.replace\("\{n\}"/,"the ROUND n header comes from the copy");
  assert.match(region, /copy\.noRound/, "the no-round group has the copy's fallback label");
  const textContentHits = region.match(/textContent/g) || [];
  assert.ok(textContentHits.length >= 4, `expected >= 4 textContent uses, found ${textContentHits.length}`);
  assert.doesNotMatch(region, /innerHTML/);
  assert.match(region, /cb-log-revealable/);
  assert.match(region, /if \(typeof r\.roll === "string" && r\.roll\) \{/, "a reveal only where the entry carries a roll (R-23)");
  const toggleHits = region.match(/toggle\(window\.__mzFightLog, r\.id\)/g) || [];
  assert.equal(toggleHits.length, 1, "toggle(window.__mzFightLog, r.id) must appear exactly once");
  assert.doesNotMatch(region, /renderEncounter\(\)/, "a log tap must never call renderEncounter() — in-place toggle only");
  const markHits = region.match(/›/g) || [];
  assert.equal(markHits.length, 1, "the › mark literal must appear exactly once");
});

// Phase 58 (MOTION-03/D-16), Plan 06, re-pointed by Phase 71 (71-06): the
// whole-round announcer is fed by renderRoundStrip with the WHOLE
// (unfiltered) log — the announcer must read the full round in the very
// first beat render, even though the strip's lines reveal and type one by
// one. The sheet (renderFightLog) is not a live region: it never announces,
// never reads a beat view (it never opens mid-round) and never types.
test("renderRoundStrip calls syncFightLogLive(log) with the SAME (unfiltered) log it reads from; the sheet's renderFightLog never announces, reads no beat view and never types", () => {
  const strip = fnRegion("function renderRoundStrip(host, fallbackRound)");
  assert.match(strip, /const bv = window\.__mzBeat\?\.view\?\.\(\) \|\| null;/);
  assert.match(strip, /const log = bv \? bv\.log : window\.__mzFightLog;/);
  const syncHits = strip.match(/syncFightLogLive\(log\);/g) || [];
  assert.equal(syncHits.length, 1, "syncFightLogLive(log) — the unfiltered log — must be called exactly once");
  assert.doesNotMatch(strip, /syncFightLogLive\(window\.__mzFightLog\)/, "syncFightLogLive must read the SAME `log` local, not re-read window.__mzFightLog directly");
  const sheet = helpersRegion();
  assert.doesNotMatch(sheet, /syncFightLogLive/, "the sheet is not a live region");
  assert.doesNotMatch(sheet, /__mzBeat/, "the sheet never reads a beat view");
  assert.doesNotMatch(sheet, /__mzTypewriter/, "the sheet never types");
});

// ─── 4. renderEncounter builds the strip, not the in-panel log; zero remaining Round Card ───
//
// Phase 71 (D-07, R-19): the combat v2 mock's middle holds foes and party
// only, so renderEncounter no longer calls renderFightLog(mid); it builds
// the what-happened strip (renderRoundStrip) above the actions instead.
// renderFightLog stays defined, its row building and reveal toggle pinned
// above: 71-06 re-hosted it in THE FIGHT SO FAR sheet, and
// openFightLogSheet is now its one caller.

test("renderEncounter region builds the what-happened strip (not renderFightLog in the middle) and carries zero Round Card artifacts; openFightLogSheet is renderFightLog's one caller", () => {
  const region = renderEncounterRegion();
  assert.doesNotMatch(region, /renderFightLog\(mid\)/, "the in-panel log left the middle (R-19)");
  assert.match(region, /renderRoundStrip\(body/);
  assert.match(CODE, /function renderFightLog\(host\)/, "renderFightLog is the sheet's row builder");
  const calls = [...CODE.matchAll(/renderFightLog\((.*?)\);/g)].map((m) => m[1]);
  assert.deepEqual(calls, ['document.getElementById("mw-fightlog-sheet-rows")'], "the sheet's rows container is the one host");
  for (const needle of ["__mzRoundCard", "ROUND_CARD_COPY", "roundCardSeq", "round-card"]) {
    const hits = CODE.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(hits.length, 0, `${needle} must not appear anywhere in mazeworld.html source`);
  }
});

// ─── 5. routing exclusivity (SOURCE) ──────────────────────────────────────

test("SOURCE: dispatchWithNarration routes on exactly one if (wasCombat || inCombat), never re-checks PRIORITY.block itself", () => {
  const region = dispatchRegion();
  const ifHits = region.match(/if \(wasCombat \|\| inCombat\)/g) || [];
  assert.equal(ifHits.length, 1, "exactly one routing if");
  // Phase 35 (MAP-03): the toast host is retired — the out-of-combat branch
  // folds through rail.js now, never a toast call. Literal built by
  // concatenation so this pin can't itself be satisfied by a stray comment.
  const toastCall = ["window.mz", "Toast?.("].join("");
  const toastHits = region.match(new RegExp(toastCall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
  assert.equal(toastHits.length, 0, `expected zero ${toastCall} calls inside dispatchWithNarration, found ${toastHits.length}`);
  const foldHits = region.match(/fightLogLinesFor\(action\.type, result\.events, ctx\)/g) || [];
  assert.equal(foldHits.length, 1, "exactly one fightLogLinesFor call");
  const appendHits = region.match(/window\.__mzFightLog = appendFightLog\(/g) || [];
  assert.equal(appendHits.length, 1, "exactly one appendFightLog write");
  const nullHits = region.match(/window\.__mzFightLog = null/g) || [];
  assert.ok(nullHits.length >= 1, "at least one window.__mzFightLog = null clear");
  const endHits = region.match(/window\.__mzFightEnd = \{ lines:/g) || [];
  assert.equal(endHits.length, 1, "exactly one window.__mzFightEnd write");
  const menuHits = region.match(/window\.__mzCombatMenu = null;/g) || [];
  assert.equal(menuHits.length, 1, "exactly one window.__mzCombatMenu reset");
  assert.doesNotMatch(region, /PRIORITY\.block/, "the tone decision lives in fightLog.js, not dispatchWithNarration");
});

// ─── 6. BEHAVIOUR partition: every event -> exactly one of narrative/dull ─

const REFUSAL_TYPES = [
  "strikeRefused", "fleeRefused", "parleyRefused", "withdrawalDenied", "vanishDenied",
  "itemRejected", "equipRejected", "useRefused", "scrollRefused", "noChargesLeft",
  "spellNotKnown", "spellAboveLevel", "spellSchoolLocked", "campFailed", "joinerRefused",
  "buyFailed", "backstabDenied", "bagFull", "nothingToThrowAt", "nothingToTurn",
  "gateRefused", "insaneNoTarget", "deathSpellTooWeak", "parleyExhausted",
  "castRefused", "actionRefused",
];

test("BEHAVIOUR: fightLogLinesFor(\"attack\", [{type}]) yields ONLY dull lines iff the bare LINE_FOR priority is PRIORITY.block, only narrative lines otherwise (some chain-intermediate types, e.g. spellThrown, legitimately fold to zero lines alone)", () => {
  const narrativeSet = new Set();
  const dullSet = new Set();
  for (const [type, fn] of Object.entries(LINE_FOR)) {
    const bare = fn({ type }, {});
    const lines = fightLogLinesFor("attack", [{ type }]);
    const expectTone = bare.priority === PRIORITY.block ? "dull" : "narrative";
    for (const line of lines) {
      assert.equal(line.tone, expectTone, `${type}'s fight-log line(s) must all be ${expectTone}`);
    }
    if (lines.length) (expectTone === "dull" ? dullSet : narrativeSet).add(type);
  }

  for (const t of REFUSAL_TYPES) assert.ok(dullSet.has(t), `${t} must be a dull fight-log entry`);

  for (const t of [
    "encounterStarted", "combatJoined", "phobiaAfraid", "struck", "strikeMissed",
    "struckByFoe", "foeMissed", "frenzy", "lootDropped",
  ]) {
    assert.ok(narrativeSet.has(t), `${t} must be a narrative fight-log entry`);
  }
});

test("BEHAVIOUR: a mixed in-combat action yields exactly one dull line among its folded entries", () => {
  const lines = fightLogLinesFor("attack", [{ type: "struck", name: "Giant Rat", dmg: 4 }, { type: "strikeRefused" }]);
  assert.equal(lines.length, 2, "both folded entries must survive as fight-log lines");
  const dullCount = lines.filter((l) => l.tone === "dull").length;
  assert.equal(dullCount, 1, "exactly one of the two lines is dull");
});

test("UNCAPPED log, uncapped default: six folded lines all reach fightLogLinesFor, and linesForAction's own default call returns every one too", () => {
  const types = ["frenzy", "phobiaAfraid", "lootDropped", "combatJoined", "struck", "foeMissed"];
  for (const type of types) {
    const bare = LINE_FOR[type]({ type }, {});
    assert.notEqual(bare.priority, PRIORITY.block, `${type} must not be PRIORITY.block for this synthetic scenario`);
  }
  const sixEvents = types.map((type) => ({ type }));
  const lines = fightLogLinesFor("attack", sixEvents);
  assert.equal(lines.length, 6, "the fight log's uncapped request must return every folded line");

  const defaultCall = linesForAction("attack", sixEvents, {});
  assert.equal(defaultCall.length, lines.length, "the default call is uncapped too — every folded line is returned");
});

// ─── the __mzFightLogVM bridge + import ────────────────────────────────────

test("the module imports fightLog.js once and bridges window.__mzFightLogVM exactly once", () => {
  const importHits = CODE.match(/from "\.\/src\/browser\/fightLog\.js"/g) || [];
  assert.equal(importHits.length, 1, "fightLog.js must be imported exactly once");
  const bridgeHits = CODE.match(/window\.__mzFightLogVM = \{/g) || [];
  assert.equal(bridgeHits.length, 1, "window.__mzFightLogVM bridge must be assigned exactly once");
});

// ─── CSS contract ───────────────────────────────────────────────────────

test(".cb-log* CSS matches the Combat Panel mock's style spec", () => {
  const markRule = HTML.match(/\.cb-log-mark\{([^}]*)\}/);
  assert.ok(markRule, ".cb-log-mark{...} rule must exist");
  assert.match(markRule[1], /#6b5c3c/);
  assert.match(markRule[1], /15px/);

  const textRule = HTML.match(/\.cb-log-text\{([^}]*)\}/);
  assert.ok(textRule, ".cb-log-text{...} rule must exist");
  assert.match(textRule[1], /#c9bda0/);
  assert.match(textRule[1], /15px/);
  assert.match(textRule[1], /700/);

  const rollRule = HTML.match(/\.cb-log-roll\{([^}]*)\}/);
  assert.ok(rollRule, ".cb-log-roll{...} rule must exist");
  assert.match(rollRule[1], /#e8c97a/);
  assert.match(rollRule[1], /13\.5px/);

  assert.match(HTML, /\.cb-log-roll\[hidden\]\{display:none\}/);
  assert.doesNotMatch(HTML, /\.round-card\{/);
});

// ─── DR18 scope ────────────────────────────────────────────────────────

test("DR18's dice-hiding rule is scoped to #enc-body .evt, never the blanket #enc-body p .roll", () => {
  const scopedHits = HTML.match(/#enc-body \.evt p \.roll\{display:none\}/g) || [];
  assert.equal(scopedHits.length, 1, "the scoped DR18 rule must appear exactly once");
  const blanketHits = HTML.match(/#enc-body p \.roll\{display:none\}/g) || [];
  assert.equal(blanketHits.length, 0, "the old blanket DR18 rule must be fully gone");
});

// ─── noteCombat: over tags ─────────────────────────────────────────────

test("noteCombat tags rep.over (won|soothed), the flee beat carries over:\"fled\", and window.__mzFightEnd is cleared on a fresh fight", () => {
  const region = noteCombatRegion();
  assert.match(region, /rep\.over = data\.outcome === "soothed" \? "soothed" : "won";/);
  assert.match(region, /over: "fled"/);
  assert.match(region, /over: rep\.over/);
  assert.match(region, /window\.__mzFightEnd = null;/);
});

// ─── voice: the new flee beat title ────────────────────────────────────

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

test("the flee beat title \"You got out\" is clear of content/safety-wordlist.js BANNED", () => {
  const region = noteCombatRegion();
  const m = region.match(/title: "([^"]+)", tone: "moss", lines: \[\]/);
  assert.ok(m, "the flee beat's title/tone/lines literal must be found in noteCombat");
  const title = m[1];
  assert.ok(title.length > 0, "flee beat title must be non-empty");
  const offenders = findBannedTerms(title);
  assert.deepStrictEqual(offenders, [], `Banned copy in the flee beat title: ${JSON.stringify(offenders)} (text: "${title}")`);
});
