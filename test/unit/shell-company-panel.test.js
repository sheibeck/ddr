// test/unit/shell-company-panel.test.js
//
// Phase 36 (JOIN-01/CUT-01), Plan 06 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-input-guards.test.js / shell-party-
// camp.test.js / shell-gear-toolbar.test.js's own source-assertion pattern —
// this file reads the real shipped source with fs.readFileSync and asserts
// against it directly:
//   1. the classic script's SUB_NOTE.Cutthroat row is byte-identical to
//      content/flavor.js's SUB_NOTE.Cutthroat (the prototype-era murder
//      sentence is gone);
//   2. the DISMISS_CONFIRM_MS/dismissConfirmRevert/revertDismissConfirm()
//      trio sits above renderPartyRoster(), mirroring the Gear tab's Drop
//      trio exactly (DROP_CONFIRM_MS untouched);
//   3. the Company sheet's field order (name/sub/race, class/level, HP
//      track, Weapon, Eats, DISMISS) inside renderPartyRoster()'s region;
//   4. HP wording (never the two-letter WP token as visible text);
//   5. every sheet field reads through escText() (XSS-safe interpolation);
//   6. the two-tap DISMISS confirm mechanics (arm/Yes/No/timeout/outside-tap
//      revert) mirror the Drop confirm's shape;
//   7. every pre-existing renderPartyRoster pin still holds (exactly two
//      getElementById calls, panel.hidden, mw-map-hpfill, Downed);
//   8. the parting line is rail-only — never rendered inside the Company
//      panel, never a toast;
//   9. window.mzDismissJoiner's bridge shape mirrors window.mzResolveJoiner
//      exactly, and dismissJoiner is a NARRATIVE_ACTIONS member;
//   10. the new CSS rules exist once each, carry no aria-disabled selector,
//       and no transition/animation token;
//   11. the new copy clears the family-friendly safety wordlist;
//   12. the build artefact (www/index.html) carries the bridge, proving
//       build:www carried the shell change.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { SUB_NOTE } from "../../content/flavor.js";
import { NARRATIVE_ACTIONS } from "../../src/browser/toasts.js";
import { BANNED } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as the sibling shell-
// *.test.js files — line comments are stripped BEFORE block comments) ─────
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

// The classic table's own region (raw HTML — no comments to strip inside it).
function subNoteRegion() {
  return sliceBetween(HTML, "const SUB_NOTE = {", "const NAMES = {");
}

// mirrors test/unit/shell-party-camp.test.js's own renderPartyRoster region
// technique: CODE.indexOf("function renderPartyRoster() {") -> next "\n}\n".
function partyRosterRegion() {
  const fnStart = CODE.indexOf("function renderPartyRoster() {");
  const fnEnd = CODE.indexOf("\n}\n", fnStart);
  assert.ok(fnStart !== -1 && fnEnd !== -1 && fnEnd > fnStart, "renderPartyRoster() function region found");
  return CODE.slice(fnStart, fnEnd);
}

function dismissJoinerBridgeRegion() {
  return sliceBetween(CODE, "window.mzDismissJoiner = function dismissJoinerBridge(", "\n  };");
}

// ─── 1. SUB_NOTE sync ──────────────────────────────────────────────────────

test("SUB_NOTE: the classic Cutthroat row is byte-identical to content/flavor.js and states the odds in plain words", () => {
  const region = subNoteRegion();
  const m = region.match(/"Cutthroat":\s*"([^"]*)"/);
  assert.ok(m, "classic SUB_NOTE.Cutthroat row found");
  assert.equal(m[1], SUB_NOTE.Cutthroat, "classic table's Cutthroat row must match content/flavor.js byte-for-byte");
  assert.match(m[1], /one descent in twenty/i);
  // Built by concatenation so this test file never spells the prototype-era
  // sentence whole (mirrors shell-toast-wiring.test.js's dead-name technique).
  const oldSentence = "one member of every party dies" + " by your hand";
  assert.equal(HTML.includes(oldSentence), false, "the prototype-era murder sentence must be gone from the raw file");
});

// ─── 2. module-level trio ──────────────────────────────────────────────────

test("Trio: DISMISS_CONFIRM_MS/dismissConfirmRevert/revertDismissConfirm() are declared once, above renderPartyRoster; DROP_CONFIRM_MS untouched", () => {
  assert.equal((CODE.match(/const DISMISS_CONFIRM_MS = 3000;/g) || []).length, 1);
  assert.equal((CODE.match(/function revertDismissConfirm\(\)/g) || []).length, 1);
  assert.equal((CODE.match(/let dismissConfirmRevert = null;/g) || []).length, 1);
  const fnIdx = CODE.indexOf("function renderPartyRoster() {");
  const constIdx = CODE.indexOf("const DISMISS_CONFIRM_MS = 3000;");
  const letIdx = CODE.indexOf("let dismissConfirmRevert = null;");
  const revertFnIdx = CODE.indexOf("function revertDismissConfirm()");
  assert.ok(fnIdx !== -1 && constIdx !== -1 && letIdx !== -1 && revertFnIdx !== -1, "all four anchors found");
  assert.ok(constIdx < fnIdx && letIdx < fnIdx && revertFnIdx < fnIdx, "the trio sits above renderPartyRoster()");
  // The Gear tab's own trio must still be intact and untouched by this plan.
  assert.equal((CODE.match(/const DROP_CONFIRM_MS = 3000;/g) || []).length, 1);
});

// ─── 3. Company sheet field order ──────────────────────────────────────────

test("Sheet order: name/sub/race, class/level, HP track, Weapon, Eats, DISMISS are strictly increasing", () => {
  const region = partyRosterRegion();
  const idx = (needle) => {
    const i = region.indexOf(needle);
    assert.ok(i !== -1, `expected to find "${needle}" in the renderPartyRoster region`);
    return i;
  };
  const iName = idx("mw-party-name");
  const iSub = idx("mw-party-sub");
  const iLine = idx("mw-party-line");
  const iHp = idx("HP <b>");
  const iTrack = idx("mw-map-hptrack");
  const iWeapon = idx("Weapon: ");
  const iEats = idx(" a rest");
  const iDismiss = idx('"DISMISS"');
  assert.ok(
    iName < iSub && iSub < iLine && iLine < iHp && iHp < iTrack && iTrack < iWeapon && iWeapon < iEats && iEats < iDismiss,
    "sheet fields must appear in the locked order: name -> sub/race -> class/level -> HP track -> Weapon -> Eats -> DISMISS",
  );
});

// ─── 4. HP wording ──────────────────────────────────────────────────────────

test("HP wording: the region reads HP, never the standalone two-letter WP token", () => {
  const region = partyRosterRegion();
  assert.match(region, /HP <b>/);
  assert.doesNotMatch(region, /\bWP\b/, "field names like maxWP are fine; the standalone word WP must never appear");
});

// ─── 5. Sheet fields read through escText() ────────────────────────────────

test("Sheet fields: cls/race/sub/weapon are escText()-escaped, Eats reads RACES[m.race]?.eats || 1, level reads ROMAN[lvl - 1]", () => {
  const region = partyRosterRegion();
  assert.match(region, /escText\(m\.cls/);
  assert.match(region, /escText\(m\.race/);
  assert.match(region, /escText\(m\.sub/);
  assert.match(region, /escText\(m\.weapon/);
  assert.match(region, /RACES\[m\.race\]\?\.eats \|\| 1/);
  assert.match(region, /ROMAN\[lvl - 1\]/);
});

// ─── 6. Two-tap DISMISS confirm mechanics ──────────────────────────────────

test("Confirm mechanics: arm/Yes/No/timeout/outside-tap revert mirror the Drop confirm's shape, gated on !S.combat", () => {
  const region = partyRosterRegion();
  assert.match(region, /textContent = "DISMISS"/);
  assert.match(region, /"Send them off\?"/);
  assert.match(region, /className = "mw-drop-confirm"/);
  assert.equal((region.match(/setTimeout\(revertDismissConfirm, DISMISS_CONFIRM_MS\)/g) || []).length, 1);
  assert.equal((region.match(/document\.addEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/document\.removeEventListener\("pointerdown", onAnyTap, true\)/g) || []).length, 1);
  assert.equal((region.match(/revertDismissConfirm\(\); window\.mzDismissJoiner\?\.\(idx\);/g) || []).length, 1);
  assert.match(region, /!S\.combat/, "the DISMISS control is gated on !S.combat");
});

// ─── 7. Existing pins preserved ─────────────────────────────────────────────

test("Existing pins: exactly two getElementById calls, panel.hidden, mw-map-hpfill, Downed all still present", () => {
  const region = partyRosterRegion();
  const getByIdCalls = region.match(/getElementById\(/g) || [];
  assert.equal(getByIdCalls.length, 2, "renderPartyRoster reads only #hero-party and #hero-party-list");
  assert.match(region, /panel\.hidden = party\.length === 0;/);
  assert.match(region, /mw-map-hpfill/);
  assert.match(region, /Downed/);
});

// ─── 8. Rail-only — no parting-line text inside the Company panel ─────────

test("Rail-only: the region never renders the parting line itself, and no toast host exists anywhere in the file", () => {
  const region = partyRosterRegion();
  assert.doesNotMatch(region, /JOINER_PARTING_LINES/);
  assert.doesNotMatch(region, /joinerDismissed/);
  // Built by concatenation so this file never spells a toast-host token
  // whole (mirrors the dead-name technique used elsewhere in this suite).
  const toastToken = "mzTo" + "ast";
  assert.doesNotMatch(region, new RegExp(toastToken));
  assert.equal((CODE.match(new RegExp(toastToken, "g")) || []).length, 0, "no toast host survives anywhere in the shell");
});

// ─── 9. Bridge shape ────────────────────────────────────────────────────────

test("Bridge: window.mzDismissJoiner mirrors window.mzResolveJoiner's dispatchWithToasts shape; dismissJoiner is a NARRATIVE_ACTIONS member", () => {
  assert.equal((CODE.match(/window\.mzDismissJoiner = function dismissJoinerBridge\(/g) || []).length, 1);
  const region = dismissJoinerBridgeRegion();
  assert.equal((region.match(/dispatchWithToasts\(\{ type: "dismissJoiner"/g) || []).length, 1);
  const iDispatch = region.indexOf('dispatchWithToasts({ type: "dismissJoiner"');
  const iSet = region.indexOf("window.__mzState.set(state);");
  const iLog = region.indexOf("window.logLine(line)");
  const iPaint = region.indexOf("window.paint();");
  const iEnc = region.indexOf("window.renderEncounter();");
  assert.ok(iDispatch !== -1 && iSet !== -1 && iLog !== -1 && iPaint !== -1 && iEnc !== -1, "all five bridge steps found");
  assert.ok(iDispatch < iSet && iSet < iLog && iLog < iPaint && iPaint < iEnc, "bridge steps run in the mzResolveJoiner order");
  assert.equal(NARRATIVE_ACTIONS.has("dismissJoiner"), true, "the rail line must be the parting sentence, not the toast-table fallback");
});

// ─── 10. CSS ────────────────────────────────────────────────────────────────

test("CSS: .mw-party-line and .mw-party-dismiss exist once each, no aria-disabled/transition/animation token", () => {
  const lineRule = (HTML.match(/^\.mw-party-line\{[^}]*\}/m) || [])[0];
  const dismissRule = (HTML.match(/^\.mw-party-dismiss\{[^}]*\}/m) || [])[0];
  assert.ok(lineRule, ".mw-party-line rule found");
  assert.ok(dismissRule, ".mw-party-dismiss rule found");
  assert.equal((HTML.match(/^\.mw-party-line\{/gm) || []).length, 1);
  assert.equal((HTML.match(/^\.mw-party-dismiss\{/gm) || []).length, 1);
  const styleBlock = sliceBetween(HTML, "<style>", "</style>");
  assert.doesNotMatch(styleBlock, /aria-disabled/);
  for (const rule of [lineRule, dismissRule]) {
    assert.doesNotMatch(rule, /transition/i);
    assert.doesNotMatch(rule, /animation/i);
  }
});

// ─── 11. Voice safety ───────────────────────────────────────────────────────

test("Voice: 'Send them off?' and 'DISMISS' clear the family-friendly safety wordlist", () => {
  const bannedRe = BANNED.map((term) => new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"));
  for (const phrase of ["Send them off?", "DISMISS"]) {
    for (const re of bannedRe) {
      assert.doesNotMatch(phrase, re, `"${phrase}" must not match banned term ${re}`);
    }
  }
});

// ─── 12. Build artefact sanity ──────────────────────────────────────────────

test("Build artefact: www/index.html carries mzDismissJoiner (skipped if www/ absent)", () => {
  const wwwPath = path.join(REPO_ROOT, "www", "index.html");
  if (!fs.existsSync(wwwPath)) {
    return; // build:www not run in this environment — not a failure
  }
  const built = fs.readFileSync(wwwPath, "utf8");
  assert.match(built, /mzDismissJoiner/);
});
