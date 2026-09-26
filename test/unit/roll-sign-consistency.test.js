// test/unit/roll-sign-consistency.test.js
//
// Phase 74 (ROLL-02/03), plan 74-08 — the build-failing guard that closes
// the phase: the same modifier must never render with opposite signs on two
// different surfaces (ROADMAP success criterion 3; 74-CONTEXT's consistency
// guard), every harvested range must be written the ONE way
// (src/browser/rollRange.js), and exactly one module in src/browser/ may
// define a modifier-sign formatter.
//
// Every hero-side/foe-side/flee/range scenario drives the REAL engine
// (engine/combat.js#playerStrike/foeTurn/flee) with a scripted rng, so the
// guard binds to engine truth, not a hand-typed event. Only heightsFear and
// purchaseBagged are hand-built, per the plan's own interfaces note — their
// payloads are either presentation-only (heightsFear) or built from the
// engine's own gearCompareParts (purchaseBagged), so a hand-built event
// still reflects real engine shape.
//
// Local fixture helpers (fakeRng, plainFoe, fullHeroState) mirror
// test/unit/odds-helpers.test.js and test/unit/foeDetails.test.js verbatim —
// this repo's established per-file-fixture convention (never imported
// cross-file).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { newRun } from "../../engine/engine.js";
import { playerStrike, foeTurn, flee } from "../../engine/combat.js";
import { gearCompareParts, strikeDie, conditionsOf } from "../../engine/derived.js";

import { EVENT_NARRATION } from "../../src/browser/eventNarration.js";
import { LINE_FOR, oracleDetailText } from "../../src/browser/narrationLines.js";
import { foeDetailsCard } from "../../src/browser/foeDetails.js";
import { characterSheetViewModel } from "../../src/browser/heroTab.js";
import { combatMenuViewModel } from "../../src/browser/combatMenu.js";
import { lootCompare } from "../../src/browser/viewModels.js";
import { conditionEffectText } from "../../src/browser/conditionEffects.js";
import { rangeText } from "../../src/browser/rollRange.js";
// RULES-10 (Phase 75.1, plan 75.1-07): the scroll-reading odds this plan
// puts on both SCROLLS rows — same rollOdds.js/rollRange.js one-formatter
// discipline this whole guard file exists to enforce.
import { gearConsumablesModel } from "../../src/browser/gearTab.js";
import { scrollReaderOf, scrollReadBands } from "../../engine/derived.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── local fixtures (mirror test/unit/odds-helpers.test.js / foeDetails.test.js) ───

/** fakeRng(seq) — `.d()` pops the next value off `seq` regardless of the
 * requested side count; throws if the sequence underflows. */
function fakeRng(seq) {
  let i = 0;
  return {
    d(_sides) {
      if (i >= seq.length) throw new Error(`fakeRng: sequence exhausted at index ${i}`);
      return seq[i++];
    },
    pick: (arr) => arr[0],
    shuffle: (a) => a,
  };
}

/** A generous same-value tail: every trailing 20 forces a guaranteed-miss
 * roll (1) on a d20, so a hero-driven action's follow-on foeTurn never runs
 * out of scripted draws (mirrors odds-helpers.test.js's own FILL). */
const FILL = new Array(8).fill(20);

function plainFoe(over = {}) {
  return { name: "Target", type: "Beasts", lvl: 1, size: "S", intel: 1, wp: 30, maxWP: 30, alive: true, asleep: 0, sp: {}, lives: 1, ...over };
}

function timersFor(key) {
  return { [`ability:${key}`]: { cadence: "rounds", left: 2, phase: "effect", cd: 5 } };
}

/**
 * fullHeroState(foe, over) — a real newRun(1) state with race/cls/sub/level/
 * weapon overridden to a level-1 Human Fighter/Soldier on a Club, holding
 * ONE live foe in combat.foes (mirrors test/unit/foeDetails.test.js's own
 * fullHeroState). `over.c` merges onto the class/race overrides; `over.combat`
 * merges onto the default combat shape. Every other GameState field (timers,
 * magicWpn, etc.) is newRun's own genuine output.
 */
function fullHeroState(foe, over = {}) {
  const { c: cOver, combat: combatOver, ...rest } = over;
  const state = newRun(1);
  Object.assign(state.c, { race: "Human", cls: "Fighter", sub: "Soldier", level: 1, weapon: "Club", ...cOver });
  if (!state.c.timers || typeof state.c.timers !== "object") state.c.timers = {};
  state.combat = { foes: [foe], type: foe.type, round: 1, target: 0, spellOpen: false, tracked: false, ...combatOver };
  Object.assign(state, rest);
  return state;
}

// ─── signed-token harvesting (the "opposite sign" detector) ───────────────

function stripTags(html) {
  return String(html ?? "").replace(/<[^>]+>/g, " ");
}

/**
 * signedTokens(text, names) — strips tags, then for each expected modifier
 * name collects every "name ±N" occurrence (either sign character, + or the
 * U+2212 minus sign) and returns the list. A surface that prints the
 * opposite sign for a name simply never produces the expected token here —
 * that is how "opposite signs" fails loudly.
 */
function signedTokens(text, names) {
  const plain = stripTags(text);
  const tokens = [];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}\\s*([+−]\\d+)`, "g");
    let m;
    while ((m = re.exec(plain))) tokens.push(`${name} ${m[1]}`);
  }
  return tokens;
}

/** assertModifier(text, "Name ±N", label) — asserts the exact player-signed
 * token appears on this surface's text. */
function assertModifier(text, expectedToken, label) {
  const m = expectedToken.match(/^(.*) ([+−]\d+)$/);
  assert.ok(m, `bad expected token: "${expectedToken}"`);
  const name = m[1];
  const tokens = signedTokens(text, [name]);
  assert.ok(
    tokens.includes(expectedToken),
    `${label}: expected "${expectedToken}" among ${JSON.stringify(tokens)} in "${stripTags(text).trim()}"`,
  );
}

/** assertToHitSign(text, "−2 to hit", label) — the unnamed to-hit clause
 * (ROLL_COPY.toHit, "{signed} to hit") carries no modifier NAME, so it is
 * asserted as a plain substring rather than through signedTokens. */
function assertToHitSign(text, expectedSubstring, label) {
  assert.ok(
    stripTags(text).includes(expectedSubstring),
    `${label}: expected "${expectedSubstring}" in "${stripTags(text).trim()}"`,
  );
}

// ─── Scenario 1: the foe side — Guard, Sidestep, insulted ─────────────────

test("foe side: Guard, Sidestep and insulted (a failed-parley insult) read the same player-signed tokens on the Oracle line, the fight-log reveal and the foe details odds line", () => {
  const driveState = fullHeroState(plainFoe(), { c: { sub: "Guard", timers: timersFor("sidestep") }, combat: { parleyInsulted: true } });
  const events = foeTurn(driveState, fakeRng([20]), []);
  const e = events.find((ev) => ev.type === "foeMissed" || ev.type === "struckByFoe");
  assert.ok(e, "expected a foeMissed or struckByFoe event");

  const oracleHtml = EVENT_NARRATION[e.type](e);
  const revealText = oracleDetailText(oracleHtml);

  const cardState = fullHeroState(plainFoe(), { c: { sub: "Guard", timers: timersFor("sidestep") }, combat: { parleyInsulted: true } });
  const card = foeDetailsCard(0, cardState);
  const oddsLine = card.lines.map((l) => l.text).find((t) => t.includes("it hits you on"));
  assert.ok(oddsLine, "expected an odds line on the foe details card");

  for (const [label, text] of [
    ["Oracle", oracleHtml],
    ["fight-log reveal", revealText],
    ["foe details odds line", oddsLine],
  ]) {
    assertModifier(text, "Guard +1", label);
    assertModifier(text, "Sidestep +2", label);
    assertModifier(text, "insulted −1", label);
  }
});

// ─── Scenario 2: Weaken ─────────────────────────────────────────────────────

test("Weaken: combat.foeToHitPenalty caps a plain Soldier's foe to 'Weaken +2' on the real foe line and the foe details line", () => {
  const driveState = fullHeroState(plainFoe(), { combat: { foeToHitPenalty: 3, weakened: true } });
  const events = foeTurn(driveState, fakeRng([20]), []);
  const e = events.find((ev) => ev.type === "foeMissed" || ev.type === "struckByFoe");
  assert.ok(e, "expected a foeMissed or struckByFoe event");
  const oracleHtml = EVENT_NARRATION[e.type](e);
  assertModifier(oracleHtml, "Weaken +2", "Oracle");

  const cardState = fullHeroState(plainFoe(), { combat: { foeToHitPenalty: 3, weakened: true } });
  const card = foeDetailsCard(0, cardState);
  const oddsLine = card.lines.map((l) => l.text).find((t) => t.includes("it hits you on"));
  assertModifier(oddsLine, "Weaken +2", "foe details odds line");
});

// ─── Scenario 3: Battle Roar ────────────────────────────────────────────────

test("Battle Roar: the hero's own Battle Roar reads 'Battle Roar +2' on the foe line and foe details", () => {
  const driveState = fullHeroState(plainFoe(), { c: { timers: timersFor("battleRoar") } });
  const events = foeTurn(driveState, fakeRng([20]), []);
  const e = events.find((ev) => ev.type === "foeMissed" || ev.type === "struckByFoe");
  assert.ok(e, "expected a foeMissed or struckByFoe event");
  assertModifier(EVENT_NARRATION[e.type](e), "Battle Roar +2", "Oracle");

  const cardState = fullHeroState(plainFoe(), { c: { timers: timersFor("battleRoar") } });
  const card = foeDetailsCard(0, cardState);
  const oddsLine = card.lines.map((l) => l.text).find((t) => t.includes("it hits you on"));
  assertModifier(oddsLine, "Battle Roar +2", "foe details odds line");
});

// ─── Scenario 4: Elven ──────────────────────────────────────────────────────

test("Elven: the race's own foeToHit bonus (bad for the hero) reads 'Elven −1' on the foe line and foe details", () => {
  const driveState = fullHeroState(plainFoe(), { c: { race: "Elven" } });
  const events = foeTurn(driveState, fakeRng([20]), []);
  const e = events.find((ev) => ev.type === "foeMissed" || ev.type === "struckByFoe");
  assert.ok(e, "expected a foeMissed or struckByFoe event");
  assertModifier(EVENT_NARRATION[e.type](e), "Elven −1", "Oracle");

  const cardState = fullHeroState(plainFoe(), { c: { race: "Elven" } });
  const card = foeDetailsCard(0, cardState);
  const oddsLine = card.lines.map((l) => l.text).find((t) => t.includes("it hits you on"));
  assertModifier(oddsLine, "Elven −1", "foe details odds line");
});

// ─── Scenario 5: afraid ─────────────────────────────────────────────────────

test("afraid: a real playerStrike shows 'afraid −3' on the Oracle line and the fight-log reveal, and the Afraid chip effect starts with '−3 to hit'", () => {
  const driveState = fullHeroState(plainFoe(), { combat: { afraid: 2 } });
  const events = playerStrike(driveState, fakeRng([20, ...FILL]), []);
  const e = events.find((ev) => ev.type === "struck" || ev.type === "strikeMissed");
  assert.ok(e, "expected a struck or strikeMissed event");
  const oracleHtml = EVENT_NARRATION[e.type](e);
  assertModifier(oracleHtml, "afraid −3", "Oracle");
  assertModifier(oracleDetailText(oracleHtml), "afraid −3", "fight-log reveal");

  const chipState = fullHeroState(plainFoe(), { combat: { afraid: 2 } });
  const cn = conditionsOf(chipState).find((d) => d.key === "afraid");
  assert.ok(cn, "expected an afraid condition descriptor");
  const effectText = conditionEffectText(cn, chipState);
  assert.ok(effectText, "expected a measured afraid effect");
  assert.ok(effectText.startsWith("−3 to hit"), `expected the Afraid chip effect to start "−3 to hit", got "${effectText}"`);
});

// ─── Scenario 6: weapons ────────────────────────────────────────────────────

test("weapons: a heavy (need −2) and a light (need +1) weapon read the same to-hit sign on lootCompare, EVENT_NARRATION.purchaseBagged and LINE_FOR.purchaseBagged", () => {
  const state = newRun(1);
  Object.assign(state.c, { race: "Human", cls: "Fighter", sub: "Soldier", level: 1, weapon: "Club", prof: 0, magicWpn: 0 });
  const c = state.c;

  const heavy = { kind: "weapon", base: "Bardiche", bonus: 0, n: "Bardiche", txt: "2d10+2" };
  const heavyWhy = gearCompareParts(c, heavy);
  assertToHitSign(lootCompare(c, heavy).why, "−2 to hit", "lootCompare (heavy weapon)");
  assertToHitSign(EVENT_NARRATION.purchaseBagged({ type: "purchaseBagged", item: heavy, why: heavyWhy }), "−2 to hit", "EVENT_NARRATION.purchaseBagged (heavy weapon)");
  assertToHitSign(LINE_FOR.purchaseBagged({ type: "purchaseBagged", item: heavy, why: heavyWhy }).text, "−2 to hit", "LINE_FOR.purchaseBagged (heavy weapon)");

  const light = { kind: "weapon", base: "Dagger", bonus: 0, n: "Dagger", txt: "d6/2" };
  const lightWhy = gearCompareParts(c, light);
  assertToHitSign(lootCompare(c, light).why, "+1 to hit", "lootCompare (light weapon)");
  assertToHitSign(EVENT_NARRATION.purchaseBagged({ type: "purchaseBagged", item: light, why: lightWhy }), "+1 to hit", "EVENT_NARRATION.purchaseBagged (light weapon)");
  assertToHitSign(LINE_FOR.purchaseBagged({ type: "purchaseBagged", item: light, why: lightWhy }).text, "+1 to hit", "LINE_FOR.purchaseBagged (light weapon)");
});

// ─── Scenario 7: flee ───────────────────────────────────────────────────────

test("flee: a real Human Thief flee reads 'Thief +5' on the fleeRolled Oracle line, LINE_FOR.fleeRolled and the combat menu flee row", () => {
  const driveState = fullHeroState(plainFoe(), { c: { cls: "Thief", sub: "Pilfer", weapon: "Dagger" } });
  const events = flee(driveState, fakeRng([20]), []);
  const e = events.find((ev) => ev.type === "fleeRolled");
  assert.ok(e, "expected a fleeRolled event");
  assertModifier(EVENT_NARRATION.fleeRolled(e), "Thief +5", "Oracle");
  assertModifier(LINE_FOR.fleeRolled(e).text, "Thief +5", "rail");

  const menuState = fullHeroState(plainFoe(), { c: { cls: "Thief", sub: "Pilfer", weapon: "Dagger" } });
  const menu = combatMenuViewModel(menuState);
  const fleeRow = menu.submenus.social.rows.find((r) => r.id === "flee");
  assert.ok(fleeRow, "expected a FLEE row in the social submenu");
  assertModifier(fleeRow.desc, "Thief +5", "combat menu flee row");
});

// ─── Scenario 8: heights ────────────────────────────────────────────────────

test("heights: heightsFear with penalty 2 shows '−2' on both the Oracle and the rail line", () => {
  const e = { type: "heightsFear", penalty: 2 };
  assert.ok(stripTags(EVENT_NARRATION.heightsFear(e)).includes("−2"), "Oracle heightsFear should show −2");
  assert.ok(LINE_FOR.heightsFear(e).text.includes("−2"), "rail heightsFear should show −2");
});

// ─── Scenario 8b: the scroll reading range (RULES-10, Phase 75.1, 75.1-07) ──

test("scroll reading range: the Gear tab SCROLLS row and the combat ITEMS SCROLL row agree, and their intel range equals rangeText(scrollReadBands(intel).atLeast, 20)", () => {
  for (const intel of [3, 9, 14, 19]) {
    // skills: {} clears any Runes/Signs newRun(1)'s real chargen might have
    // rolled, so every case below genuinely takes the "intel" reader path.
    const state = fullHeroState(plainFoe(), { c: { intel, skills: {} } });
    assert.equal(scrollReaderOf(state.c), "intel", `intel ${intel} must take the intel reader path`);

    const gearDesc = gearConsumablesModel({ ...state, c: { ...state.c, scrolls: 1 } }).rows.find((r) => r.key === "scroll").desc;
    const menuDesc = combatMenuViewModel({ ...state, c: { ...state.c, scrolls: 1 } }).submenus.items.rows.find((r) => r.id === "scroll").desc;
    assert.equal(gearDesc, menuDesc, `intel ${intel}: the Gear tab and combat ITEMS descriptions must agree`);

    const bands = scrollReadBands(intel);
    const expectedRange = rangeText(bands.atLeast, bands.dieN);
    assert.ok(gearDesc.includes(expectedRange), `intel ${intel}: expected "${expectedRange}" in "${gearDesc}"`);

    assert.ok(!gearDesc.includes("%"), `intel ${intel}: must not contain "%" -> "${gearDesc}"`);
    assert.ok(!/\d\+(?!\d)/.test(gearDesc), `intel ${intel}: must not contain an "N+" shorthand -> "${gearDesc}"`);
    assert.doesNotMatch(gearDesc, /\d-\d/, `intel ${intel}: must not use a hyphen-minus between digits -> "${gearDesc}"`);
  }
});

// ─── Scenario 9: the range pin ──────────────────────────────────────────────

test("range pin: level-1 Human Fighter, Thief and Magic User on a Club read 16–20/17–20/18–20 on the sheet, the combat menu, foe details and a real playerStrike event", () => {
  const CASES = [
    { cls: "Fighter", sub: "Soldier", expected: "16–20" },
    { cls: "Thief", sub: "Pilfer", expected: "17–20" },
    { cls: "Magic User", sub: "Wizard", expected: "18–20" },
  ];
  for (const { cls, sub, expected } of CASES) {
    const displayState = fullHeroState(plainFoe(), { c: { cls, sub } });

    const sheetToHit = characterSheetViewModel(displayState).stats.find((s) => s.key === "toHit").value;
    assert.ok(sheetToHit.includes(expected), `${cls}: sheet toHit "${sheetToHit}" should include "${expected}"`);

    const strikeSub = combatMenuViewModel(displayState).actions.find((a) => a.key === "strike").sub;
    assert.ok(strikeSub.includes(expected), `${cls}: combat menu strike sub "${strikeSub}" should include "${expected}"`);

    const card = foeDetailsCard(0, displayState);
    const oddsLine = card.lines.map((l) => l.text).find((t) => t.includes("You hit it on"));
    assert.ok(oddsLine && oddsLine.includes(expected), `${cls}: foe details odds line "${oddsLine}" should include "${expected}"`);

    const driveState = fullHeroState(plainFoe(), { c: { cls, sub } });
    const events = playerStrike(driveState, fakeRng([20, ...FILL]), []);
    const strikeEvent = events.find((ev) => ev.type === "struck" || ev.type === "strikeMissed");
    assert.ok(strikeEvent, `${cls}: expected a struck/strikeMissed event`);
    assert.equal(rangeText(strikeEvent.atLeast, strikeEvent.dieN), expected, `${cls}: rangeText(atLeast, dieN) should equal "${expected}"`);
  }
});

// ─── Scenario 10: range format + no "%"/"N+" shorthand ─────────────────────

test("range format: every harvested range matches lo–hi/single-face/nothing, and no surface leaks '%' or an 'N+' shorthand", () => {
  const displayState = fullHeroState(plainFoe());
  const samples = [];

  samples.push(["hero sheet toHit", characterSheetViewModel(displayState).stats.find((s) => s.key === "toHit").value]);
  const menu = combatMenuViewModel(displayState);
  samples.push(["combat menu strike sub", menu.actions.find((a) => a.key === "strike").sub]);
  samples.push(["combat menu flee cost", menu.submenus.social.rows.find((r) => r.id === "flee").cost]);
  const card = foeDetailsCard(0, displayState);
  for (const l of card.lines) samples.push(["foe details line", l.text]);

  const driveState = fullHeroState(plainFoe());
  const events = playerStrike(driveState, fakeRng([20, ...FILL]), []);
  const strikeEvent = events.find((ev) => ev.type === "struck" || ev.type === "strikeMissed");
  assert.ok(strikeEvent, "expected a struck/strikeMissed event");
  samples.push(["Oracle strike line", EVENT_NARRATION[strikeEvent.type](strikeEvent)]);
  samples.push(["rail strike line", LINE_FOR[strikeEvent.type](strikeEvent).text]);

  const RANGE_FORMAT_RE = /^(\d+(–\d+)?|nothing)$/;
  for (const [label, text] of samples) {
    const plain = stripTags(text).trim();
    assert.ok(!plain.includes("%"), `${label}: must not contain "%" -> "${plain}"`);
    assert.ok(!/\d\+(?!\d)/.test(plain), `${label}: must not contain an "N+" shorthand -> "${plain}"`);
    const ranges = plain.match(/\d+–\d+/g) || [];
    for (const r of ranges) assert.match(r, RANGE_FORMAT_RE, `${label}: range "${r}" must match the lo–hi format`);
  }
});

// ─── Scenario 11: the one-formatter scan ───────────────────────────────────

/** stripComments(source) — // line comments then /* block comments *\/,
 * stripped in that order (mirrors test/unit/hp-not-wp.test.js's own JS-only
 * pass and test/unit/upgrade-why.test.js's import-scan helper). */
function stripComments(source) {
  const noLineComments = source
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
}

// The banned formatter names: every module-private modifier-sign helper this
// phase deleted, plus rollRange.js's own exported names — a re-declaration
// of any of these OUTSIDE rollRange.js is the "two call chains that happen
// to agree" failure mode 74-03/74-04's summaries warn against.
const BANNED_FORMATTER_NAMES = ["modsText", "modsClause", "needModsText", "needModsClause", "signedNeed", "critRange", "fleeModsText"];

test("one formatter: no src/browser/*.js file except rollRange.js defines a local modifier-sign formatter or a local sign ternary on a modifier delta", () => {
  const browserDir = path.join(REPO_ROOT, "src", "browser");
  const files = fs
    .readdirSync(browserDir)
    .filter((f) => f.endsWith(".js") && f !== "rollRange.js")
    .map((f) => path.join(browserDir, f));
  files.push(path.join(REPO_ROOT, "mazeworld.html"));

  const offenders = [];
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const name of BANNED_FORMATTER_NAMES) {
      const defRe = new RegExp(`\\bfunction\\s+${name}\\s*\\(|\\bconst\\s+${name}\\s*=`);
      const m = defRe.exec(src);
      if (m) offenders.push(`${path.relative(REPO_ROOT, file)}: defines "${name}" (matched "${m[0]}")`);
    }
    // A local sign ternary on a modifier delta: a `.delta` comparison
    // against 0 immediately followed by a ternary whose branches contain a
    // sign character — the shape every deleted module-private formatter used.
    const ternaryRe = /\.delta\s*[<>]=?\s*0\s*\?[^:]*[+−][^:]*:/g;
    let tm;
    while ((tm = ternaryRe.exec(src))) offenders.push(`${path.relative(REPO_ROOT, file)}: local sign ternary -> "${tm[0].slice(0, 80)}"`);
  }
  assert.deepStrictEqual(offenders, [], `One-formatter violations:\n${offenders.join("\n")}`);
});
