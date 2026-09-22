// test/unit/shell-combat-over.test.js
//
// Phase 34 (CSCR-07/08/09), Plan 05 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring shell-combat-screen.test.js/shell-combat-actions.
// test.js's own source-assertion pattern — this file reads the real shipped
// source with fs.readFileSync and asserts against it directly: the fight-
// ending over-panel (win/soothed/flee/death), the loot/joiner/find dark
// restyle, the dismissal-transition clears, the keydown over-panel path, and
// a voice scan of every new literal string this whole phase introduced
// (COMBAT_COPY + COMBAT_MENU_COPY + COMBAT_PANEL_COPY).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";
import { COMBAT_MENU_COPY } from "../../src/browser/combatMenu.js";
import { COMBAT_PANEL_COPY } from "../../src/browser/combatPanel.js";

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

function overRegion() {
  return fnRegion("function renderCombatOver(host, kind, opts = {})");
}
// Phase 58 (MOTION-03): every renderEncounter branch marker below now
// carries the beat's `!bv && ` gate (D-09/D-11) — re-pinned to the landed
// strings, same regions.
function deathBranch() {
  return sliceBetween(CODE, "if (!bv && S.dead) {", "if (!bv && !S.combat && S.beats && S.beats.groups && S.beats.groups.length) {");
}
function wireDeathConfirmRegion() {
  return sliceBetween(CODE, "function wireDeathConfirm", "function foeStatusBadges(");
}
function beatsBranch() {
  return sliceBetween(
    CODE,
    "if (!bv && !S.combat && S.beats && S.beats.groups && S.beats.groups.length) {",
    "if (!bv && S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {",
  );
}
function lootBranch() {
  return sliceBetween(
    CODE,
    "if (!bv && S.pendingLoot && S.pendingLoot.length && !S.combat && !S.store) {",
    "if (!bv && S.store) {",
  );
}
// Phase 35 (MAP-04): the joiner/find prompts moved from renderEncounter into
// renderRail's own decision precedence — these two helpers now scope to
// renderRail's body instead of the (now-retired) renderEncounter branches.
function railRegion() {
  return fnRegion("function renderRail()");
}
function joinerBranch() {
  return sliceBetween(railRegion(), "if (S.pendingJoiner && !S.combat && !S.store) {", "if (S.pendingFind && !S.combat && !S.store) {");
}
function findBranch() {
  return sliceBetween(railRegion(), "if (S.pendingFind && !S.combat && !S.store) {", 'if (rail.pending && rail.pending.kind === "climb") {');
}
function noteCombatRegion() {
  return sliceBetween(CODE, "function noteCombat(", "function hapticForEvents");
}
function copyLiteral() {
  const start = CODE.indexOf("const COMBAT_COPY = {");
  assert.ok(start !== -1, "const COMBAT_COPY = { not found");
  const end = CODE.indexOf("\n};", start);
  assert.ok(end !== -1 && end > start, "no closing \\n}; found after COMBAT_COPY");
  return CODE.slice(start, end + "\n};".length);
}
function dismissalBlock() {
  const start = CODE.indexOf("if (encWasActive && !active) {");
  assert.ok(start !== -1, "if (encWasActive && !active) { not found");
  const end = CODE.indexOf("}", start);
  assert.ok(end !== -1 && end > start);
  return CODE.slice(start, end + 1);
}
function engineMoveRegion() {
  return sliceBetween(CODE, "window.move = function engineMove", "window.mzDevStartAtDepth = ");
}
function keydownRegion() {
  return sliceBetween(CODE, 'addEventListener("keydown"', 'addEventListener("resize"');
}
function helpersAndRenderEncounterRegion() {
  return sliceBetween(CODE, "function renderFightLog(host)", "function noteCombat(");
}

// ─── a. Three variants exist in copy ──────────────────────────────────────

test("CSCR-07: COMBAT_COPY.over carries the four ending variants (won/soothed/fled/dead)", () => {
  const region = copyLiteral();
  assert.match(region, /title: "THEY ARE DOWN"/);
  assert.match(region, /title: "YOU GOT OUT"/);
  assert.match(region, /title: "THAT IS THAT"/);
  assert.match(region, /title: "THEY STAND DOWN"/);
  assert.match(region, /bury: "BURY THEM"/);
  assert.match(region, /oracle: "REVIEW THE ORACLE"/);
  const btnHits = region.match(/btn: "BACK TO THE MAZE"/g) || [];
  assert.ok(btnHits.length >= 3, `expected btn: "BACK TO THE MAZE" at least 3 times, found ${btnHits.length}`);
});

// ─── b. renderCombatOver ───────────────────────────────────────────────────

test("CSCR-07: renderCombatOver builds header/lines/title/line/actions via textContent, no innerHTML", () => {
  const region = overRegion();
  assert.match(region, /cb-over-title/);
  assert.match(region, /cb-over-line/);
  assert.match(region, /cb-over-lines/);
  assert.match(region, /cb-over-actions/);
  assert.match(region, /cb-over-btn/);
  assert.match(region, /htmlToPlain\(/);
  assert.match(region, /window\.__mzFightEnd/);
  assert.match(region, /guardTap\(document\.getElementById\(b\.id\), b\.onTap\)/);
  assert.match(region, /renderCombatHeader\(host/);
  assert.match(region, /COMBAT_COPY\.headerOver\[kind\]/);
  assert.doesNotMatch(region, /innerHTML/);
});

// ─── c. Death (CSCR-07) ─────────────────────────────────────────────────────

test('CSCR-07/Phase 35 (MAP-05): the death branch renders THAT IS THAT through renderCombatOver(body, "dead", ...), folding S.beats.preDeath lines, no legacy death card', () => {
  const region = deathBranch();
  assert.match(region, /renderCombatOver\(body, "dead"/);
  assert.match(region, /S\.beats\.preDeath/);
  assert.match(region, /"btn-death-oracle"/);
  assert.match(region, /"btn-death-confirm"/);
  assert.match(region, /cls: "dead"/);
  assert.match(region, /wireDeathConfirm\(\);/);
  assert.match(region, /panel\.dataset\.mode = "dark"/);
  assert.doesNotMatch(region, /deathcard/);
});

test("CSCR-07: wireDeathConfirm stays armed — guardTap only, no read-first lock anywhere in the file", () => {
  const region = wireDeathConfirmRegion();
  assert.match(region, /guardTap\(btn,/);
  assert.doesNotMatch(region, /btn\.onclick =/);
  assert.doesNotMatch(CODE, /AGAIN_LOCK/);
});

// ─── d. Win/loot (CSCR-07) ──────────────────────────────────────────────────

test("CSCR-07: the loot branch renders won/soothed through renderCombatOver with every Phase 29 literal intact", () => {
  const region = lootBranch();
  assert.match(region, /renderCombatOver\(body, kind/);
  assert.match(region, /rep\.over === "soothed"/);
  assert.match(region, /fillMid/);
  // 2026-09-17 UAT fix (stuck on NONE STANDING): renderCombatOver must attach
  // `mid` BEFORE fillMid runs, and the won branch resolves its loot hosts
  // inside the wrap it just built — never by document id on a detached node.
  const over = overRegion();
  assert.ok(over.indexOf("host.appendChild(mid);") !== -1 && over.indexOf("host.appendChild(mid);") < over.indexOf("opts.fillMid(mid)"), "mid attached before fillMid");
  // Phase 47 (SHELL-01), Plan 03: renderCarriedList( -> window.__mzCarriedList(
  assert.match(region, /window\.__mzCarriedList\(wrap\.querySelector\("#loot-list"\)/);
  assert.match(region, /wrap\.querySelector\("#loot-drop-shelf"\)/);
  assert.doesNotMatch(region, /document\.getElementById\("loot-list"\)/);
  const literals = [
    "window.__mzBagUsage(c)",
    "window.__mzLootReport",
    'id="loot-list"',
    "window.__mzCarriedList(",
    'actions: ["lootEquip", "lootTake", "lootLeave"]',
    "guard: true",
    "subFor",
    "window.__mzLootCompare(c, it)",
    'id="loot-drop-shelf"',
    "renderDropShelf(",
    '"a-loot-take-all"',
    '"a-loot-leave-all"',
    "window.mzTakeAllLoot",
    "window.mzLeaveAllLoot",
  ];
  for (const lit of literals) {
    assert.ok(region.includes(lit), `expected loot branch to contain literal: ${lit}`);
  }
  assert.match(region, /COMBAT_COPY\.takeAll/);
  assert.match(region, /COMBAT_COPY\.leaveAll/);
  assert.match(region, /COMBAT_COPY\.lootHead/);
  const guardTrueHits = region.match(/guard: true/g) || [];
  assert.equal(guardTrueHits.length, 1, "guard: true must appear exactly once inside the loot branch");
  assert.match(region, /panel\.dataset\.mode = "dark"/);
  // 2026-09-17 UAT: the bag-full refusal lives only in the rail card
  assert.doesNotMatch(region, /Bag full \(/, "2026-09-17 UAT: the bag-full refusal lives only in the rail card");
  assert.ok(region.indexOf('id="loot-drop-shelf"') !== -1 && region.indexOf("usage.full && needsSlot") !== -1, "the drop shelf still renders when the bag is full and a slot is needed");
});

// ─── e. Flee / won-without-drops ────────────────────────────────────────────

test("CSCR-07/Phase 35 (MAP-04): the beats branch's FIRST statement after `const b = S.beats;` folds an over ending through renderCombatOver; every other beat clears itself, no legacy dismiss control", () => {
  const region = beatsBranch();
  const bIdx = region.indexOf("const b = S.beats;");
  assert.ok(bIdx !== -1, "const b = S.beats; not found");
  const afterB = region.slice(bIdx + "const b = S.beats;".length);
  const firstStatement = afterB
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  assert.equal(firstStatement, "if (b.over) {");
  assert.match(region, /renderCombatOver\(body, b\.over/);
  assert.match(region, /"cb-over-btn"/);
  assert.match(region, /S\.beats = null; renderEncounter\(\);/);
  // Phase 35 (MAP-04): every OTHER beat (floor, level-up, feature narration)
  // is now a self-clearing rail card — the legacy header dismiss control is
  // fully retired (literal built by concatenation so this pin can't itself
  // be satisfied by a stray comment mentioning it).
  const retiredId = ["a", "-next"].join("");
  assert.equal((CODE.match(new RegExp(`"${retiredId}"`, "g")) || []).length, 0, `expected zero "${retiredId}" occurrences`);
});

test('CSCR-07: noteCombat tags rep.over (won|soothed) and the flee beat carries over:"fled"', () => {
  const region = noteCombatRegion();
  assert.match(region, /over: "fled"/);
  assert.match(region, /rep\.over =/);
  assert.match(region, /over: rep\.over/);
});

// ─── f. Joiner/find restyle ─────────────────────────────────────────────────

test("Phase 35 (MAP-04): joiner and find are rail decision cards — the four action ids, the generic guardTap wiring, and headLine (not head.textContent) live in renderRail", () => {
  const jRegion = joinerBranch();
  const fRegion = findBranch();
  // Rail cards have no #enc-panel — the retired panel.dataset.mode toggle
  // does not apply to either branch any more.
  assert.doesNotMatch(jRegion, /panel\.dataset\.mode/);
  assert.doesNotMatch(fRegion, /panel\.dataset\.mode/);
  assert.match(jRegion, /id: "a-join-yes"/);
  assert.match(jRegion, /id: "a-join-no"/);
  assert.match(jRegion, /const headLine = walker/);
  assert.doesNotMatch(jRegion, /head\.textContent =/);
  assert.match(fRegion, /id: "a-find-take"/);
  assert.match(fRegion, /id: "a-find-leave"/);
  // the generic per-button guardTap wiring loop railButtons() shares with
  // every rail decision — proven present in the railButtons..renderRail span.
  const railButtonsRegion = fnRegion("function railButtons(host, buttons)");
  assert.match(railButtonsRegion, /guardTap\(document\.getElementById\(b\.id\), b\.onTap\)/);
});

// ─── g. Guards (CSCR-08) ─────────────────────────────────────────────────────

test("CSCR-08: the dismissal transition clears window.__mzFightEnd/__mzCombatMenu before its first close brace", () => {
  const block = dismissalBlock();
  assert.match(block, /lastDismissAt = Date\.now\(\);/);
  assert.match(block, /window\.mzKeepPartyInView\?\.\(\);/);
  assert.match(block, /window\.__mzFightEnd = null;/);
  assert.match(block, /window\.__mzCombatMenu = null;/);
});

test("CSCR-08: engineMove still gates on hasActiveEncounter() then the settle clause immediately after", () => {
  const region = engineMoveRegion();
  const gateIdx = region.indexOf("if (hasActiveEncounter()) return;");
  const settleIdx = region.indexOf("if (!encounterSettled()) return;");
  assert.ok(gateIdx !== -1, "hasActiveEncounter() gate not found");
  assert.ok(settleIdx !== -1 && settleIdx > gateIdx, "settle clause not found after the gate");
});

test("Phase 35 (MAP-04): the keydown beats branch Enter/Space clicks cb-over-btn only — no retired-id fallback chain", () => {
  const region = keydownRegion();
  assert.match(region, /const n = document\.getElementById\("cb-over-btn"\); if \(n\) n\.click\(\);/);
  assert.doesNotMatch(region, /document\.getElementById\("a-next"\)/);
});

test("CSCR-08: no card/body/panel tap-anywhere-to-dismiss listener, and zero transitionend/animationend anywhere", () => {
  const region = helpersAndRenderEncounterRegion();
  for (const bad of [/card\.onclick/, /body\.onclick/, /panel\.onclick/, /body\.addEventListener/, /panel\.addEventListener/, /card\.addEventListener/]) {
    assert.doesNotMatch(region, bad);
  }
  assert.doesNotMatch(CODE, /transitionend/i);
  assert.doesNotMatch(CODE, /animationend/i);
});

// ─── h. No toasts on endings ────────────────────────────────────────────────

test("CSCR-04/07: zero window.mzToast?.( call anywhere in the helpers+renderEncounter region", () => {
  const region = helpersAndRenderEncounterRegion();
  assert.doesNotMatch(region, /window\.mzToast\?\.\(/);
});

// ─── i. Header endings copy ─────────────────────────────────────────────────

test("CSCR-07: headerOver carries won/soothed/fled/dead keys", () => {
  const region = copyLiteral();
  assert.match(region, /headerOver: \{/);
  assert.match(region, /won: "NONE STANDING"/);
  assert.match(region, /soothed: "NONE STANDING"/);
  assert.match(region, /fled: "YOU LEFT"/);
  assert.match(region, /dead: "YOU FELL"/);
});

// ─── j. Voice scan of every new string this phase introduced ───────────────

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

test("Phase 34 (whole-phase voice scan): every COMBAT_COPY string leaf is non-empty and clear of BANNED", () => {
  const region = copyLiteral();
  const leaves = [...region.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
  assert.ok(leaves.length > 0, "expected at least one string leaf inside COMBAT_COPY");
  for (const leaf of leaves) {
    assert.ok(leaf.length > 0, "every COMBAT_COPY string leaf must be non-empty");
    const offenders = findBannedTerms(leaf);
    assert.deepStrictEqual(offenders, [], `Banned copy in COMBAT_COPY: ${JSON.stringify(offenders)} (text: "${leaf}")`);
  }
});

test("Phase 34 (whole-phase voice scan): every COMBAT_MENU_COPY value is non-empty and clear of BANNED", () => {
  for (const [key, val] of Object.entries(COMBAT_MENU_COPY)) {
    assert.ok(typeof val === "string" && val.length > 0, `COMBAT_MENU_COPY.${key} must be a non-empty string`);
    const offenders = findBannedTerms(val);
    assert.deepStrictEqual(offenders, [], `Banned copy in COMBAT_MENU_COPY.${key}: ${JSON.stringify(offenders)} (text: "${val}")`);
  }
});

test("Phase 34 (whole-phase voice scan): every COMBAT_PANEL_COPY value is non-empty and clear of BANNED", () => {
  for (const [key, val] of Object.entries(COMBAT_PANEL_COPY)) {
    assert.ok(typeof val === "string" && val.length > 0, `COMBAT_PANEL_COPY.${key} must be a non-empty string`);
    const offenders = findBannedTerms(val);
    assert.deepStrictEqual(offenders, [], `Banned copy in COMBAT_PANEL_COPY.${key}: ${JSON.stringify(offenders)} (text: "${val}")`);
  }
});

test('Phase 34 (whole-phase voice scan): the flee beat title "You got out" is clear of BANNED', () => {
  const title = "You got out";
  assert.deepStrictEqual(findBannedTerms(title), []);
  assert.match(noteCombatRegion(), /"You got out"/);
});

// ─── k. Legacy untouched ─────────────────────────────────────────────────────

test("Phase 46: the retired won card is gone and the store region is untouched", () => {
  assert.doesNotMatch(CODE, /Through the Gate/);
  // Phase 58 (MOTION-03): the death-branch condition now carries the
  // beat's `!bv && ` gate (D-09/D-11) — re-pinned to the landed string.
  assert.equal((CODE.match(/if \(!bv && S\.dead\) \{/g) || []).length, 1);
  const storeRegion = sliceBetween(CODE, "if (!bv && S.store) {", "const V = bv ? bv.state : S;");
  assert.doesNotMatch(storeRegion, /guardTap\(/);
  assert.doesNotMatch(storeRegion, /dataset\.mode/);
});
