// test/unit/shell-toast-wiring.test.js
//
// Phase 25 (FEED-01..06), Plan 04 — mazeworld.html has no module surface a
// test could import (it is not an ESM module the test runner can load), so
// — mirroring test/unit/foe-effect-chip.test.js / parley-button-mirror.test.js's
// own source-assertion pattern — this file reads the real shipped source
// with fs.readFileSync and asserts against it directly: the seven toast
// tones all resolve to explicit colors, the host cap is 4, every dispatch
// call site is routed through ONE dispatchWithToasts(action) seam, and the
// old per-action switch (plus its spell-name helper) is gone. A final
// behavioural check proves the deleted DR18 hand-written equip-rejection
// toast is replaced, not lost, by importing the real toastsForAction and
// running a real equipRejected event through it.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { TONES, toastsForAction, CARD_EVENTS, NARRATIVE_ACTIONS } from "../../src/browser/toasts.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping ──────────────────────────────────────────────────
//
// mazeworld.html's doc comments occasionally mention glob-style paths
// (`icons/optimized/*.png`) and scoped-package wildcards (`@capacitor/*`)
// INSIDE ordinary `//` line comments. A naive stripper that removes `/* */`
// block comments BEFORE removing `//` line comments treats that literal
// `/*` substring as an (unterminated) block-comment opener and swallows
// everything up to the next unrelated `*/` — silently deleting real code
// from the scanned text. Stripping `//` line comments FIRST removes those
// substrings before the block-comment pass ever sees them, so this order
// is deliberate, not incidental (see 25-04-SUMMARY.md for how this was
// found). Confirmed safe for this file: no line pairs a `/*` opener with a
// `//` occurring before its own same-line `*/` closer (which would be the
// one case this ordering could still lose a real closing token).
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

// ─── dead-name detection without spelling the dead names ───────────────
//
// The prohibition this test enforces (the old switch + its spell-name
// helper must have zero occurrences) should not itself be tripped by any
// future "no dead API names anywhere in the repo" tooling that greps for
// the literal identifier — so both names are assembled from fragments.
const OLD_SWITCH_NAME = ["mz", "Combat", "Feedback"].join("");
const OLD_SPELL_NAME_HELPER = ["mz", "Spell", "Name"].join("");

// ─── CSS tone colors ─────────────────────────────────────────────────────

/** Pulls every `--token:#hex;` declaration out of the `:root{...}` block so
 * a `var(--token)` reference in a tone rule can be resolved to its literal
 * color for the distinctness comparison below. */
function extractRootTokens(html) {
  const rootMatch = html.match(/:root\{([\s\S]*?)\n\}/);
  assert.ok(rootMatch, ":root{...} block must exist in mazeworld.html");
  const tokens = {};
  const re = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\))/g;
  let m;
  while ((m = re.exec(rootMatch[1]))) tokens[m[1]] = m[2];
  return tokens;
}

/** Resolves a `color:` value (a literal hex or a `var(--x)` reference,
 * following one level of var-to-var indirection) to a literal hex string. */
function resolveColor(value, tokens) {
  const varMatch = value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (!varMatch) return value;
  const resolved = tokens[varMatch[1]];
  assert.ok(resolved, `--${varMatch[1]} must be defined in :root`);
  const nested = resolved.match(/^var\(--([a-z0-9-]+)\)$/);
  return nested ? tokens[nested[1]] : resolved;
}

/** Extracts the `.mw-toast[data-tone="<tone>"]{...}` rule's `color:`
 * declaration (raw, unresolved) for a given tone name. */
function toneColor(html, tone) {
  const re = new RegExp(`\\.mw-toast\\[data-tone="${tone}"\\]\\{([^}]*)\\}`);
  const m = html.match(re);
  assert.ok(m, `.mw-toast[data-tone="${tone}"]{...} rule must exist`);
  const colorMatch = m[1].match(/(?:^|;)color:([^;]+)/);
  assert.ok(colorMatch, `.mw-toast[data-tone="${tone}"] must declare color:`);
  return colorMatch[1].trim();
}

test("every TONES entry has a .mw-toast[data-tone=...] rule with a color: declaration", () => {
  for (const tone of TONES) {
    const raw = toneColor(HTML, tone);
    assert.ok(raw.length > 0, `${tone} color value must be non-empty`);
  }
});

test("FEED-03: hit/miss/hurt/dodge resolve to four distinct colors (YOU green family vs THEM red family)", () => {
  const tokens = extractRootTokens(HTML);
  const resolved = ["hit", "miss", "hurt", "dodge"].map((t) => resolveColor(toneColor(HTML, t), tokens));
  const distinct = new Set(resolved);
  assert.equal(distinct.size, 4, `hit/miss/hurt/dodge must be four distinct colors, got ${JSON.stringify(resolved)}`);
});

test("FEED-03: magic/block/beat are distinct from each other and from the four combat tones", () => {
  const tokens = extractRootTokens(HTML);
  const combat = ["hit", "miss", "hurt", "dodge"].map((t) => resolveColor(toneColor(HTML, t), tokens));
  const utility = ["magic", "block", "beat"].map((t) => resolveColor(toneColor(HTML, t), tokens));
  const distinctUtility = new Set(utility);
  assert.equal(distinctUtility.size, 3, `magic/block/beat must be distinct from each other, got ${JSON.stringify(utility)}`);
  for (const u of utility) {
    assert.ok(!combat.includes(u), `utility color ${u} must not collide with a combat-tone color`);
  }
});

test("miss is no longer the ink-soft grey", () => {
  const raw = toneColor(HTML, "miss");
  assert.ok(!/--ink-soft/.test(raw), `miss color must not reference --ink-soft, got ${raw}`);
});

// ─── host cap + no-CLS + reduced-motion contract ────────────────────────

test("the toast host trims to a cap of 4, not 3", () => {
  assert.ok(/host\.children\.length > 4/.test(CODE), "host cap must be raised to 4");
  assert.ok(!/host\.children\.length > 3/.test(CODE), "the old cap of 3 must be gone");
});

test("the toast host keeps its fixed, non-layout contract", () => {
  assert.ok(/\.mw-toast-host\{[\s\S]*?position:fixed/.test(HTML), ".mw-toast-host must stay position:fixed");
  assert.ok(/position:fixed;left:0;right:0;/.test(HTML), "the host's fixed-contract line must survive");
});

test("the reduced-motion rule survives byte-identical", () => {
  assert.ok(
    /prefers-reduced-motion:reduce\)\{\.mw-toast,\.mw-toast\.out\{animation:none\}/.test(HTML),
    "the prefers-reduced-motion rule must be unchanged"
  );
});

// ─── single dispatch seam ────────────────────────────────────────────────

test("the module script imports toastsForAction from src/browser/toasts.js", () => {
  assert.match(CODE, /import \{ toastsForAction \} from "\.\/src\/browser\/toasts\.js";/);
});

test("dispatchWithToasts(action) is defined exactly once and calls toastsForAction(action.type, ...)", () => {
  const defs = CODE.match(/function dispatchWithToasts\(action\)/g) || [];
  assert.equal(defs.length, 1, "dispatchWithToasts must be defined exactly once");
  assert.match(CODE, /toastsForAction\(action\.type/);
});

test("every dispatch() call site is routed through dispatchWithToasts — exactly one bare dispatch( survives (inside the helper itself)", () => {
  const bare = CODE.match(/(?<![A-Za-z_$.])dispatch\(/g) || [];
  assert.equal(bare.length, 1, `expected exactly one bare dispatch( call, found ${bare.length}`);
  const routed = CODE.match(/dispatchWithToasts\(/g) || [];
  assert.ok(routed.length >= 9, `expected >= 9 dispatchWithToasts( occurrences (definition + 8 call sites), found ${routed.length}`);
});

test("the old per-action switch and its spell-name helper are gone", () => {
  assert.equal((CODE.match(new RegExp(OLD_SWITCH_NAME, "g")) || []).length, 0);
  assert.equal((CODE.match(new RegExp(OLD_SPELL_NAME_HELPER, "g")) || []).length, 0);
  // mzSpellCharges (a DIFFERENT, still-live helper used by the grimoire
  // renderer) must survive — proves the deletion above was surgical, not a
  // blanket removal of every "mzSpell*" identifier.
  assert.match(CODE, /window\.mzSpellCharges/);
});

test("the DR18 hand-written equip-rejection toast is deleted", () => {
  assert.equal((HTML.match(/You cannot use that\./g) || []).length, 0);
  assert.match(CODE, /window\.mzEquipItem = \(i\) => inventoryAction\(\{ type: "equipItem", i \}\);/);
});

test("the two pre-dispatch full-health guards use the block tone, not miss", () => {
  const blockGuards = HTML.match(/Already at full health\.", "block"\)/g) || [];
  const missGuards = HTML.match(/Already at full health\.", "miss"\)/g) || [];
  assert.equal(blockGuards.length, 2, "both full-health guards must use tone block");
  assert.equal(missGuards.length, 0, "no full-health guard may keep tone miss");
});

// ─── behavioural: the deleted hand-written toast is replaced, not lost ──

test("an equipRejected(reason: woodsman) event yields one block toast via toastsForAction (proves the deleted DR18 toast has a real replacement)", () => {
  const toasts = toastsForAction("equipItem", [{ type: "equipRejected", reason: "woodsman" }], {});
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].tone, "block");
  assert.match(toasts[0].text, /Woodsman/i);
});

// ─── Phase 25.1 (DFB-01/02) additions ─────────────────────────────────────

test("DFB-01: the module imports CARD_EVENTS/NARRATIVE_ACTIONS/toastLifetime and narrateEvent on their own lines, and the original toastsForAction import is untouched", () => {
  assert.match(CODE, /import \{ toastsForAction \} from "\.\/src\/browser\/toasts\.js";/);
  assert.match(CODE, /import \{ CARD_EVENTS, NARRATIVE_ACTIONS, toastLifetime \} from "\.\/src\/browser\/toasts\.js";/);
  assert.match(CODE, /import \{ narrateEvent \} from "\.\/src\/browser\/eventNarration\.js";/);
});

test("DFB-01: dispatchWithToasts passes ctx.narrate only for NARRATIVE_ACTIONS", () => {
  assert.match(CODE, /NARRATIVE_ACTIONS\.has\(action\.type\) \? \{ narrate: narrateEvent \} : \{\}/);
});

test("DFB-01: the html-to-beats fallback in engineMove AND mzMakeCamp is gated on CARD_EVENTS", () => {
  const gates = CODE.match(/events\.some\(\(e\) => CARD_EVENTS\.has\(e\.type\)\)/g) || [];
  assert.equal(gates.length, 2, `expected exactly 2 CARD_EVENTS gates, found ${gates.length}`);
  assert.match(
    CODE,
    /&& !state\.pendingJoiner && !state\.pendingFind && html\.length\s*&& events\.some\(\(e\) => CARD_EVENTS\.has\(e\.type\)\)/,
  );
});

test("DFB-01 preDeath survives; the ambush gate collapsed in Phase 31", () => {
  const preDeathHits = CODE.match(/preDeath: true/g) || [];
  assert.equal(preDeathHits.length, 1, "preDeath: true must appear exactly once");
  // Phase 31 (CMB-01): a pre-emptive kill now happens inside the `fight`
  // dispatch (after Fight! was pressed), so the old AMBUSH pre-death
  // awaitingFight bridging is gone — assert its zero-occurrence absence.
  assert.doesNotMatch(CODE, /awaitingFight/);
});

test("DFB-02: mzToast reads the lifetime through window.__mzToastLifetime, measures visible before appending, and dismisses on tap with a cleared timer", () => {
  const start = CODE.indexOf("window.mzToast = function");
  const end = CODE.indexOf("window.mzSpellCharges");
  assert.ok(start !== -1 && end !== -1 && end > start, "mzToast..mzSpellCharges region must be found");
  const region = CODE.slice(start, end);
  assert.match(region, /const visible = host\.children\.length;/);
  assert.match(region, /window\.__mzToastLifetime\(text\.length, visible\)/);
  assert.match(region, /clearTimeout\(timer\)/);
  assert.match(region, /t\.addEventListener\("click", dismiss\)/);
  const deadRate = ["text.length * ", "45"].join("");
  assert.ok(!region.includes(deadRate), "the old 45-per-character rate must be gone");
  assert.match(CODE, /window\.__mzToastLifetime = toastLifetime;/);
});

test("DFB-02: toasts are tappable while the host stays non-blocking", () => {
  const toastRule = HTML.match(/\.mw-toast\{([^}]*)\}/);
  assert.ok(toastRule, ".mw-toast{...} rule must exist");
  assert.match(toastRule[1], /pointer-events:auto/);
  assert.match(toastRule[1], /cursor:pointer/);
  const hostRule = HTML.match(/\.mw-toast-host\{([^}]*)\}/);
  assert.ok(hostRule, ".mw-toast-host{...} rule must exist");
  assert.match(hostRule[1], /pointer-events:none/);
});

test("DFB-01: FEATURE_EVENT_TITLE carries a title for both CARD_EVENTS", () => {
  for (const t of CARD_EVENTS) {
    assert.match(CODE, new RegExp(t + ": \\["), `FEATURE_EVENT_TITLE must have an entry for ${t}`);
  }
});
