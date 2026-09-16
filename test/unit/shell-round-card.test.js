// test/unit/shell-round-card.test.js
//
// Phase 32 (CMBUI-02/03), Plan 02 — mazeworld.html has no module surface a
// test could import directly (it is not an ESM module the test runner can
// load), so — mirroring test/unit/shell-loot-screen.test.js's own
// source-assertion pattern — this file reads the real shipped source with
// fs.readFileSync and asserts against it directly:
//   1. the renderEncounter round-card region: window.__mzRoundCard is read,
//      the card is built between the foe roster and the Fight! gate, every
//      line is written through textContent (never innerHTML), the old
//      slice(-6)/lastExchange/exchangeN machinery is gone;
//   2. the persistent #enc-round-live announcer: static HTML placement,
//      never assigned innerHTML, seq-gated so a sub-menu re-render of the
//      same card does not re-announce;
//   3. the .round-card CSS contract (max-height/overflow-y/touch-action,
//      no animation) and the .exchange rule's full removal;
//   4. routing exclusivity (design §6.4's "exactly ONE destination"): a
//      structural source pin (one if/else in dispatchWithToasts) AND a
//      behavioural proof that runs the real toastsForAction pipeline —
//      including the UNCAPPED-card / MAX_TOASTS-capped-host contract
//      (CONTEXT Area 1 #5);
//   5. voice safety of the new ROUND_CARD_COPY header strings against
//      content/safety-wordlist.js, mirroring test/voice/safety-scan.test.js's
//      matcher.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { toastsForAction, TOAST_FOR, PRIORITY, MAX_TOASTS } from "../../src/browser/toasts.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");

// ─── comment stripping (same order-sensitive approach as
// shell-toast-wiring.test.js / shell-loot-screen.test.js) ────────────────
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
  return sliceBetween(CODE, "function dispatchWithToasts(action)", "window.move = function engineMove");
}

// ─── 1. renderEncounter round-card region ────────────────────────────────

test("renderEncounter round-card region: reads window.__mzRoundCard and builds the card between the foe roster and the Fight! gate", () => {
  const region = renderEncounterRegion();
  assert.match(region, /window\.__mzRoundCard/);

  const classHits = region.match(/className = "round-card"/g) || [];
  assert.equal(classHits.length, 1, "className = \"round-card\" must appear exactly once in renderEncounter");

  const rosterIdx = region.indexOf('list.className = "foes"');
  const cardIdx = region.indexOf('className = "round-card"');
  const fightGateIdx = region.indexOf("if (C.pending)");
  assert.ok(rosterIdx !== -1, "foe roster assignment must be found");
  assert.ok(fightGateIdx !== -1, "Fight! gate must be found");
  assert.ok(cardIdx > rosterIdx, "the round-card region must render after the foe roster");
  assert.ok(cardIdx < fightGateIdx, "the round-card region must render before the Fight! gate");
});

test("renderEncounter round-card region: every line is textContent, never innerHTML", () => {
  const region = renderEncounterRegion();
  const cardBlock = sliceBetween(region, "const rc = window.__mzRoundCard", "body.appendChild(card)");
  assert.match(cardBlock, /p\.textContent = line/);
  assert.doesNotMatch(cardBlock, /innerHTML/);
});

test("renderEncounter round-card region: calls syncRoundCardLive and carries no line-cap slice", () => {
  const region = renderEncounterRegion();
  assert.match(region, /syncRoundCardLive\(/);
  assert.doesNotMatch(region, /slice\(-6\)/);
});

test("the last-exchange machinery is fully gone: zero lastExchange/exchangeN/S.roundCard/state.roundCard in source", () => {
  for (const needle of ["lastExchange", "exchangeN", "S.roundCard", "state.roundCard"]) {
    const hits = CODE.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    assert.equal(hits.length, 0, `${needle} must not appear in mazeworld.html source`);
  }
  assert.equal((HTML.match(/exflash/g) || []).length, 0, "the exflash keyframes must be gone");
  assert.equal((HTML.match(/\.exchange\{/g) || []).length, 0, "the .exchange{...} rule must be gone");
});

// ─── 2. persistent aria-live announcer ────────────────────────────────────

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

test("syncRoundCardLive never assigns innerHTML on the announcer and gates announcement on rc.seq", () => {
  const start = CODE.indexOf("function syncRoundCardLive(");
  assert.ok(start !== -1, "function syncRoundCardLive must be found");
  const end = CODE.indexOf("\nfunction ", start + 1);
  const region = CODE.slice(start, end === -1 ? CODE.length : end);
  assert.match(region, /textContent/);
  assert.doesNotMatch(region, /innerHTML/);
  assert.match(region, /rc\.seq === roundCardAnnouncedSeq/);
});

// ─── 3. CSS contract ───────────────────────────────────────────────────────

test(".round-card carries max-height:40%, overflow-y:auto, touch-action:manipulation, and no animation", () => {
  const ruleMatch = HTML.match(/\.round-card\{([^}]*)\}/);
  assert.ok(ruleMatch, ".round-card{...} rule must exist");
  const rule = ruleMatch[1];
  assert.match(rule, /max-height:40%/);
  assert.match(rule, /overflow-y:auto/);
  assert.match(rule, /touch-action:manipulation/);
  assert.doesNotMatch(rule, /animation/);
});

// ─── 4. routing exclusivity (design §6.4) ─────────────────────────────────

test("SOURCE: dispatchWithToasts contains exactly one routing if/else and exactly one window.mzToast call", () => {
  const region = dispatchRegion();
  const ifHits = region.match(/if \(inCombat && t\.priority !== PRIORITY\.block\)/g) || [];
  assert.equal(ifHits.length, 1, "exactly one routing if/else");
  const toastHits = region.match(/window\.mzToast\?\.\(/g) || [];
  assert.equal(toastHits.length, 1, "exactly one window.mzToast call site inside dispatchWithToasts");
});

const destinationFor = (inCombat, t) => (inCombat && t.priority !== PRIORITY.block ? "card" : "toast");

test("BEHAVIOUR: every TOAST_FOR type routes to exactly one of card/toast when in combat, and the two sets partition the manifest", () => {
  const cardSet = new Set();
  const toastSet = new Set();
  for (const [type, fn] of Object.entries(TOAST_FOR)) {
    const t = fn({ type }, {});
    const dest = destinationFor(true, t);
    (dest === "card" ? cardSet : toastSet).add(type);
  }
  for (const type of cardSet) assert.ok(!toastSet.has(type), `${type} must not be in both card and toast sets`);
  const union = new Set([...cardSet, ...toastSet]);
  assert.equal(union.size, Object.keys(TOAST_FOR).length, "card + toast sets must cover every TOAST_FOR type exactly once");

  // REFUSAL_TYPES, copied from test/unit/toastTable.test.js — every refusal
  // must stay a toast even in combat (PRIORITY.block).
  const REFUSAL_TYPES = [
    "strikeRefused", "fleeRefused", "parleyRefused", "withdrawalDenied", "vanishDenied",
    "itemRejected", "equipRejected", "useRefused", "scrollRefused", "noChargesLeft",
    "spellNotKnown", "spellAboveLevel", "spellSchoolLocked", "campFailed", "joinerRefused",
    "buyFailed", "backstabDenied", "bagFull", "nothingToThrowAt", "nothingToTurn",
    "gateRefused", "insaneNoTarget", "deathSpellTooWeak", "parleyExhausted",
    "castRefused", "actionRefused",
  ];
  for (const t of REFUSAL_TYPES) assert.ok(toastSet.has(t), `${t} must route to toast even in combat`);

  for (const t of [
    "encounterStarted", "combatJoined", "phobiaAfraid", "struck", "strikeMissed",
    "struckByFoe", "foeMissed", "frenzy", "lootDropped",
  ]) {
    assert.ok(cardSet.has(t), `${t} must route to the round card in combat`);
  }

  const lootTaken = TOAST_FOR.lootTaken({ type: "lootTaken" }, {});
  const lootLeft = TOAST_FOR.lootLeft({ type: "lootLeft" }, {});
  assert.equal(destinationFor(false, lootTaken), "toast", "lootTaken stays a toast out of combat (the loot card)");
  assert.equal(destinationFor(false, lootLeft), "toast", "lootLeft stays a toast out of combat (the loot card)");
});

test("BEHAVIOUR: a mixed in-combat action routes exactly its refusal to toast and everything else to the card", () => {
  // dispatchWithToasts always requests the pipeline with { limit: Infinity }
  // (the card must never lose a folded line) — mirror that call shape here.
  const out = toastsForAction("attack", [{ type: "struck", name: "Giant Rat", dmg: 4 }, { type: "strikeRefused" }], {}, { limit: Infinity });
  const dests = out.map((t) => destinationFor(true, t));
  const toastCount = dests.filter((d) => d === "toast").length;
  const cardCount = dests.filter((d) => d === "card").length;
  assert.equal(toastCount, 1, "exactly the refusal routes to toast");
  assert.equal(cardCount, out.length - 1, "everything else routes to the card");
});

test("UNCAPPED card, capped host (CONTEXT Area 1 #5): six folded toasts all reach the card, but only MAX_TOASTS reach the queue", () => {
  // Six distinct TOAST_FOR types, none PRIORITY.block, each independently
  // verified (above) to survive the pipeline alone as exactly one toast —
  // so this test never depends on grouper/chain internals.
  const types = ["frenzy", "phobiaAfraid", "lootDropped", "combatJoined", "struck", "foeMissed"];
  for (const type of types) {
    const bare = TOAST_FOR[type]({ type }, {});
    assert.notEqual(bare.priority, PRIORITY.block, `${type} must not be PRIORITY.block for this synthetic scenario`);
    const solo = toastsForAction("attack", [{ type }], {});
    assert.equal(solo.length, 1, `${type} must survive the pipeline alone as exactly one toast`);
  }
  const sixEvents = types.map((type) => ({ type }));

  const uncapped = toastsForAction("attack", sixEvents, {}, { limit: Infinity });
  assert.equal(uncapped.length, 6, "the card's uncapped request must return every folded line");

  const cappedDefault = toastsForAction("attack", sixEvents, {});
  assert.equal(cappedDefault.length, MAX_TOASTS, "the default (out-of-combat / toast-host) call must still cap at MAX_TOASTS");

  const inCombatLines = uncapped.filter((t) => destinationFor(true, t) === "card");
  const inCombatToasts = uncapped.filter((t) => destinationFor(true, t) === "toast");
  assert.equal(inCombatLines.length, 6, "in combat, all six folded toasts become card lines");
  assert.equal(inCombatToasts.length, 0, "in combat, none of the six (non-refusal) toasts reach the toast queue");

  const outOfCombatLines = uncapped.filter((t) => destinationFor(false, t) === "card");
  const outOfCombatQueue = uncapped.filter((t) => destinationFor(false, t) === "toast").slice(0, MAX_TOASTS);
  assert.equal(outOfCombatLines.length, 0, "out of combat, nothing routes to the card");
  assert.equal(outOfCombatQueue.length, MAX_TOASTS, "out of combat, the toast queue caps at MAX_TOASTS");
});

test("toasts.js carries the opts/limit option this plan adds", () => {
  const toastsSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "browser", "toasts.js"), "utf8");
  assert.match(toastsSrc, /export function toastsForAction\(type, events, ctx = \{\}, opts = \{\}\)/);
  assert.match(toastsSrc, /deduped\.slice\(0, limit\)/);
});

// ─── 5. voice safety of the new copy ──────────────────────────────────────

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

test("ROUND_CARD_COPY header strings are non-empty and clear of content/safety-wordlist.js BANNED", () => {
  const objMatch = CODE.match(/const ROUND_CARD_COPY = (\{[\s\S]*?\});/);
  assert.ok(objMatch, "const ROUND_CARD_COPY = {...}; must be found in mazeworld.html");
  const literal = objMatch[1];

  const previewMatch = literal.match(/preview:\s*"([^"]*)"/);
  assert.ok(previewMatch, "ROUND_CARD_COPY.preview string literal must be found");
  const preview = previewMatch[1];
  assert.ok(preview.length > 0, "preview header must be non-empty");

  const roundMatch = literal.match(/`([^`]*)`/);
  assert.ok(roundMatch, "ROUND_CARD_COPY.round template literal must be found");
  const roundHeader = roundMatch[1].replace(/\$\{n\}/, "3");
  assert.ok(roundHeader.length > 0, "round header must be non-empty");

  for (const text of [preview, roundHeader]) {
    const offenders = findBannedTerms(text);
    assert.deepStrictEqual(offenders, [], `Banned copy in ROUND_CARD_COPY: ${JSON.stringify(offenders)} (text: "${text}")`);
  }
});
