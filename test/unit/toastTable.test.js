// test/unit/toastTable.test.js
//
// Direct unit coverage for src/browser/toasts.js (Phase 25): every TOAST_FOR
// builder's contract (bare-{type} safety, refusal fallbacks, tone families,
// locked wordings, both-directions coverage, manifest sanity, purity).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { TONES, PRIORITY, MAX_TOASTS, ORACLE_ONLY, FEATURE_EVENTS, TOAST_FOR, slotWord } from "../../src/browser/toasts.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const TONE_SET = new Set(TONES);
const PRIORITY_VALUES = new Set(Object.values(PRIORITY));

test("MAX_TOASTS is 4", () => {
  assert.equal(MAX_TOASTS, 4);
});

// ─── Every builder, called bare, returns a valid { text, tone, priority } ───

test("every TOAST_FOR builder survives a bare {type} call with a valid shape", () => {
  for (const [type, fn] of Object.entries(TOAST_FOR)) {
    const r = fn({ type }, {});
    assert.ok(r, `TOAST_FOR.${type} returned nothing`);
    assert.equal(typeof r.text, "string", `TOAST_FOR.${type}.text should be a string`);
    assert.ok(r.text.trim().length > 0, `TOAST_FOR.${type} returned empty text`);
    assert.ok(TONE_SET.has(r.tone), `TOAST_FOR.${type}.tone "${r.tone}" is not a valid tone`);
    assert.ok(PRIORITY_VALUES.has(r.priority), `TOAST_FOR.${type}.priority "${r.priority}" is not a valid priority`);
  }
});

// ─── Refusal fallbacks (probe FEED-02 empty) ────────────────────────────────

const REFUSAL_TYPES = [
  "strikeRefused", "fleeRefused", "parleyRefused", "withdrawalDenied", "vanishDenied",
  "itemRejected", "equipRejected", "useRefused", "scrollRefused", "noChargesLeft",
  "spellNotKnown", "spellAboveLevel", "spellSchoolLocked", "campFailed", "joinerRefused",
  "buyFailed", "backstabDenied", "bagFull", "nothingToThrowAt", "nothingToTurn",
  "gateRefused", "insaneNoTarget", "deathSpellTooWeak", "parleyExhausted",
  // Phase 31 (CMB-01/CMB-02): the notFought/generic-action refusal vocabulary.
  "castRefused", "actionRefused",
];

test("every refusal type is block/priority-0 with non-empty voiced text, even with a bare/undefined/unknown reason", () => {
  for (const t of REFUSAL_TYPES) {
    for (const payload of [{ type: t }, { type: t, reason: undefined }, { type: t, reason: "definitelyNotAReason" }]) {
      const r = TOAST_FOR[t](payload);
      assert.equal(r.tone, "block", `${t} should be tone "block" for payload ${JSON.stringify(payload)}`);
      assert.equal(r.priority, PRIORITY.block, `${t} should be priority PRIORITY.block for payload ${JSON.stringify(payload)}`);
      assert.ok(r.text.trim().length > 0, `${t} returned empty text for payload ${JSON.stringify(payload)}`);
    }
  }
});

test("reason-specific refusal text differs from the generic fallback", () => {
  const fallback = TOAST_FOR.parleyRefused({ type: "parleyRefused", reason: "definitelyNotAReason" }).text;
  const ninja = TOAST_FOR.parleyRefused({ type: "parleyRefused", reason: "ninja" }).text;
  assert.notEqual(ninja, fallback);

  const itemFallback = TOAST_FOR.itemRejected({ type: "itemRejected", reason: "definitelyNotAReason" }).text;
  const woodsman = TOAST_FOR.itemRejected({ type: "itemRejected", reason: "woodsman" }).text;
  assert.notEqual(woodsman, itemFallback);

  const equipFallback = TOAST_FOR.equipRejected({ type: "equipRejected", reason: "definitelyNotAReason" }).text;
  const acrobat = TOAST_FOR.equipRejected({ type: "equipRejected", reason: "acrobat" }).text;
  assert.notEqual(acrobat, equipFallback);

  // 260918-wy1 (jewelry-merge): jewelryFull and wrongSlot each get their own
  // block-tone text, distinct from the generic fallback.
  const jewelryFull = TOAST_FOR.equipRejected({ type: "equipRejected", reason: "jewelryFull" }).text;
  assert.notEqual(jewelryFull, equipFallback);
  assert.equal(TOAST_FOR.equipRejected({ type: "equipRejected", reason: "jewelryFull" }).tone, "block");
  const wrongSlot = TOAST_FOR.equipRejected({ type: "equipRejected", reason: "wrongSlot" }).text;
  assert.notEqual(wrongSlot, equipFallback);
  assert.equal(TOAST_FOR.equipRejected({ type: "equipRejected", reason: "wrongSlot" }).tone, "block");

  const useFallback = TOAST_FOR.useRefused({ type: "useRefused", reason: "definitelyNotAReason" }).text;
  const pilferUse = TOAST_FOR.useRefused({ type: "useRefused", reason: "pilfer", item: { n: "Bomb" } }).text;
  assert.notEqual(pilferUse, useFallback);

  // Phase 31 (CMB-01): a castRefused notFought reason vs the generic fallback.
  const castFallback = TOAST_FOR.castRefused({ type: "castRefused", reason: "definitelyNotAReason" }).text;
  const castNotFought = TOAST_FOR.castRefused({ type: "castRefused", reason: "notFought", spell: "Heal" }).text;
  assert.notEqual(castNotFought, castFallback);

  // 260918-wy1: slotWord turns a worn KEY into its player-facing FAMILY word.
  assert.equal(slotWord("jewelry1"), "jewelry");
  assert.equal(slotWord("jewelry2"), "jewelry");
  assert.equal(slotWord("cloak"), "cloak");
  assert.equal(slotWord("weapon"), "weapon", "an unrecognized slot word passes through unchanged");
  assert.equal(slotWord("armor"), "armor");

  // itemEquipped renders "(jewelry)" for either jewelry key, never the raw
  // key; weapon/armor stay byte-identical.
  assert.equal(
    TOAST_FOR.itemEquipped({ item: { n: "Anklet of Invisibility" }, slot: "jewelry2" }).text,
    "Equipped: Anklet of Invisibility (jewelry).",
  );
  assert.equal(
    TOAST_FOR.itemEquipped({ item: { n: "Dagger" }, slot: "weapon" }).text,
    "Equipped: Dagger (weapon).",
  );

  // Phase 31 (CMB-02): a useRefused cooldown reason vs the generic fallback.
  const useCooldown = TOAST_FOR.useRefused({ type: "useRefused", reason: "cooldown", item: { n: "Cloak" }, left: 12 }).text;
  assert.notEqual(useCooldown, useFallback);

  const scrollFallback = TOAST_FOR.scrollRefused({ type: "scrollRefused", reason: "definitelyNotAReason" }).text;
  const pilferScroll = TOAST_FOR.scrollRefused({ type: "scrollRefused", reason: "pilfer" }).text;
  assert.notEqual(pilferScroll, scrollFallback);

  const joinerFallback = TOAST_FOR.joinerRefused({ type: "joinerRefused", reason: "definitelyNotAReason" }).text;
  const wilmsryRefusal = TOAST_FOR.joinerRefused({ type: "joinerRefused", reason: "wilmsry" }).text;
  assert.notEqual(wilmsryRefusal, joinerFallback);

  const freeze = TOAST_FOR.strikeRefused({ type: "strikeRefused", reason: "wizard", spell: "Freeze" }).text;
  assert.ok(freeze.includes("Freeze"), `expected strikeRefused wizard text to name the spell: "${freeze}"`);
});

// ─── Tone families (FEED-03 flagged assumption) ─────────────────────────────

const THEM_PAYLOAD = { name: "Dante", member: "Bram", dmg: 6, roll: 3, need: 5 };
const THEM_TYPES = [
  "struckByFoe", "foeMissed", "memberStruck", "foeBolted", "foeDrained", "foeDebuffed",
  "foeHealed", "foeSummoned", "foeCast", "foeRevived", "foeSlept", "foeOutOfSpells", "heroResistFailed",
];

test("THEM-family builders return tone hurt/dodge and text starting with the foe name", () => {
  for (const t of THEM_TYPES) {
    const r = TOAST_FOR[t]({ type: t, ...THEM_PAYLOAD });
    assert.ok(["hurt", "dodge"].includes(r.tone), `${t} expected tone hurt/dodge, got "${r.tone}"`);
    assert.ok(r.text.startsWith("Dante"), `${t} expected text to start with the foe name, got "${r.text}"`);
  }
});

test("YOU-family builders (struck/strikeMissed/heroResisted) return tone hit/miss and text starting with 'You'", () => {
  for (const t of ["struck", "strikeMissed"]) {
    const r = TOAST_FOR[t]({ type: t, ...THEM_PAYLOAD });
    assert.ok(["hit", "miss"].includes(r.tone), `${t} expected tone hit/miss, got "${r.tone}"`);
    assert.ok(r.text.startsWith("You"), `${t} expected text to start with "You", got "${r.text}"`);
  }
  const resisted = TOAST_FOR.heroResisted({ type: "heroResisted", name: "Drudge" });
  assert.equal(resisted.tone, "hit");
  assert.ok(resisted.text.startsWith("You"), `heroResisted expected text to start with "You", got "${resisted.text}"`);
});

// ─── Locked wordings (25-03/25-05 depend on these exact shapes) ─────────────

test("locked wordings: struckByFoe", () => {
  assert.equal(TOAST_FOR.struckByFoe({ type: "struckByFoe", name: "Dante", dmg: 6 }).text, "Dante hits you (6)");
  assert.equal(TOAST_FOR.struckByFoe({ type: "struckByFoe", name: "Dante", dmg: 6, critical: true }).text, "Dante hits you (6) · CRIT");
  assert.ok(TOAST_FOR.struckByFoe({ type: "struckByFoe", name: "Dante", dmg: 6, soldierCrit: true }).text.includes("· CRIT"));
  assert.equal(
    TOAST_FOR.struckByFoe({ type: "struckByFoe", name: "Dante", dmg: 4, soaked: { hide: 2 } }).text,
    "Dante hits you (4) · hide 2 soaked",
  );
});

test("locked wordings: foeMissed", () => {
  assert.equal(TOAST_FOR.foeMissed({ type: "foeMissed", name: "Dante" }).text, "Dante misses you");
  assert.equal(
    TOAST_FOR.foeMissed({ type: "foeMissed", name: "Dante", roll: 5, need: 4, needMods: [{ name: "Guard", delta: -1 }] }).text,
    "Dante misses you · Guard",
  );
  assert.equal(
    TOAST_FOR.foeMissed({ type: "foeMissed", name: "Dante", roll: 12, need: 4, needMods: [{ name: "Guard", delta: -1 }] }).text,
    "Dante misses you",
  );
});

test("locked wordings: memberStruck", () => {
  const r = TOAST_FOR.memberStruck({ type: "memberStruck", name: "Dante", member: "Bram", dmg: 5 });
  assert.equal(r.text, "Dante hits Bram (5)");
  assert.equal(r.priority, PRIORITY.feature);
});

test("locked wordings: struck", () => {
  assert.equal(TOAST_FOR.struck({ type: "struck", target: "Dante", dmg: 8 }).text, "You hit Dante (8)");
  const crit = TOAST_FOR.struck({ type: "struck", target: "Dante", dmg: 8, critical: true, critBy: "backstab" }).text;
  assert.ok(crit.startsWith("You hit Dante (8) · CRIT"), `expected crit text to start with "You hit Dante (8) · CRIT", got "${crit}"`);
});

test("locked wordings: strikeMissed", () => {
  assert.equal(TOAST_FOR.strikeMissed({ type: "strikeMissed", target: "Dante" }).text, "You miss Dante");
  assert.equal(
    TOAST_FOR.strikeMissed({ type: "strikeMissed", target: "Dante", quip: "Wide. Impressively wide." }).text,
    "You miss Dante — Wide. Impressively wide.",
  );
  assert.ok(TOAST_FOR.strikeMissed({ type: "strikeMissed", target: "Dante", untouchable: true }).text.includes("cannot"));
});

// ─── Both directions (FEED-06) ───────────────────────────────────────────────

test("both directions: your spell outcomes and their outcomes", () => {
  assert.equal(TOAST_FOR.spellHit({ type: "spellHit", spell: "Fireball", target: "Dante", dmg: 12 }).text, "Fireball hits Dante (12)");
  assert.equal(TOAST_FOR.spellMissed({ type: "spellMissed", spell: "Fireball", target: "Dante" }).tone, "miss");
  assert.ok(TOAST_FOR.spellMissed({ type: "spellMissed", spell: "Fireball", target: "Dante" }).text.includes("Fireball misses Dante"));
  assert.ok(TOAST_FOR.spellResisted({ type: "spellResisted", target: "Dante", spell: "Doze" }).text.includes("Dante resists Doze"));
  assert.ok(TOAST_FOR.frozenSolid({ type: "frozenSolid", target: "Dante" }).text.includes("frozen solid"));
  assert.equal(TOAST_FOR.foeBolted({ type: "foeBolted", name: "Drudge", dmg: 7 }).text, "Drudge bolts you (7)");
  assert.equal(TOAST_FOR.foeBolted({ type: "foeBolted", name: "Drudge", dmg: 7 }).tone, "hurt");
  const resisted = TOAST_FOR.heroResisted({ type: "heroResisted", name: "Drudge" });
  assert.ok(resisted.text.startsWith("You resist"));
  assert.equal(resisted.tone, "hit");
});

// ─── Missing optional fields never throw (probe FEED-01 empty) ─────────────

test("missing optional fields degrade gracefully, never throw", () => {
  assert.doesNotThrow(() => TOAST_FOR.goldGained({ type: "goldGained" }));
  assert.equal(TOAST_FOR.goldGained({ type: "goldGained", amount: 3 }).text, "+3 wilmst");
  const foeFled = TOAST_FOR.foeFled({ type: "foeFled", name: "Rat" });
  assert.ok(foeFled.text.trim().length > 0);
  assert.equal(foeFled.tone, "hit");
  const encounterStarted = TOAST_FOR.encounterStarted({ type: "encounterStarted" });
  assert.ok(encounterStarted.text.trim().length > 0);
  assert.equal(encounterStarted.tone, "beat");
});

// ─── Feature flags ───────────────────────────────────────────────────────────

test("feature flag clauses render when present", () => {
  assert.ok(TOAST_FOR.rested({ type: "rested", amount: 16, doubled: "Soldier" }).text.includes("Soldier"));
  assert.ok(TOAST_FOR.goldGained({ type: "goldGained", amount: 3, why: "pickpocket" }).text.includes("Pickpocket"));
  assert.ok(TOAST_FOR.storeOpened({ type: "storeOpened", pickpocket: true }).text.includes("1.25"));
  assert.ok(TOAST_FOR.wanderingMonster({ type: "wanderingMonster", hours: 2, bard: true }).text.includes("Bard"));
  assert.ok(TOAST_FOR.chestOpened({ type: "chestOpened", reason: "pilfer" }).text.includes("Pilfer"));
  assert.ok(TOAST_FOR.trapDisarmed({ type: "trapDisarmed" }).text.includes("Pilfer"));
  assert.ok(TOAST_FOR.armorSoaked({ type: "armorSoaked", amount: 5, wear: 3, halved: true }).text.includes("Dwarven"));
  assert.ok(TOAST_FOR.foeFled({ type: "foeFled", name: "Rat", reason: "knight" }).text.includes("Knight"));
});

// ─── Manifest sanity ─────────────────────────────────────────────────────────

test("FEATURE_EVENTS manifest sanity", () => {
  const missing = FEATURE_EVENTS.filter((t) => !(t in TOAST_FOR));
  assert.deepEqual(missing, [], `every FEATURE_EVENTS entry must be a TOAST_FOR key: ${missing.join(", ")}`);
  const inOracleOnly = FEATURE_EVENTS.filter((t) => ORACLE_ONLY.has(t));
  assert.deepEqual(inOracleOnly, [], `no FEATURE_EVENTS entry may be in ORACLE_ONLY: ${inOracleOnly.join(", ")}`);
  const overlap = [...ORACLE_ONLY].filter((t) => t in TOAST_FOR);
  assert.deepEqual(overlap, [], `ORACLE_ONLY and TOAST_FOR must be disjoint: ${overlap.join(", ")}`);
  assert.equal(FEATURE_EVENTS.length, new Set(FEATURE_EVENTS).size, "FEATURE_EVENTS must have no duplicates");
});

// ─── Purity ──────────────────────────────────────────────────────────────────

test("toasts.js source contains no Math.random / Date.now / document. / window. on any non-comment line", () => {
  const file = path.join(REPO_ROOT, "src", "browser", "toasts.js");
  const source = fs.readFileSync(file, "utf8");
  const noBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const lines = noBlockComments.split("\n").map((line) => {
    const idx = line.indexOf("//");
    return idx === -1 ? line : line.slice(0, idx);
  });
  const offenses = [];
  lines.forEach((line, i) => {
    if (/Math\.random|Date\.now|document\.|window\./.test(line)) offenses.push(`${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(offenses, [], `Found disallowed reference in toasts.js:\n${offenses.join("\n")}`);
});

test("calling a builder twice with the same payload gives deepEqual results (pure)", () => {
  const payload = { type: "struckByFoe", name: "Dante", dmg: 6, critical: true, soaked: { hide: 2 } };
  assert.deepEqual(TOAST_FOR.struckByFoe(payload), TOAST_FOR.struckByFoe(payload));
});
