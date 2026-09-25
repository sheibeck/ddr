// test/unit/upgrade-why.test.js
//
// Phase 61 (STORE-03): the parts helper (engine/derived.js#gearCompareParts,
// #noCritFor) and the formatter module (src/browser/upgradeWhy.js) that turns
// them into the upgrade-line explanation. Every assertion here pins the
// explanation to be a NEVER-DISAGREES-WITH-THE-VERDICT read of the same
// arithmetic weaponUpgradeDelta/armorUpgradeDelta (engine/items.js) already
// use — the explanation never restates that arithmetic, it only exposes it.

import test from "node:test";
import assert from "node:assert/strict";

import { newRun } from "../../engine/state.js";
import { gearCompareParts, noCritFor, expectedStrike } from "../../engine/derived.js";
import { weaponUpgradeDelta } from "../../engine/items.js";
import { WEAPONS } from "../../content/index.js";
import { UPGRADE_WHY_COPY, upgradeWhyText, swingText } from "../../src/browser/upgradeWhy.js";
import { BANNED, ALLOWLIST } from "../../content/safety-wordlist.js";

const round2 = (x) => Math.round(x * 100) / 100;

// ─── Four sample heroes, built from newRun(seed).c with explicit overrides ─

// seed 7: newRun(7).c is a level-1 Human Wizard (Quarter Staff, prof 0) —
// measured directly (61-02-PLAN.md's <interfaces>). Level bumped to 3 for
// the CONTEXT-pinned Spiked Staff case.
const magicUser = newRun(7).c;
magicUser.level = 3;
magicUser.weapon = "Quarter Staff";
magicUser.prof = 0;
magicUser.magicWpn = 0;

// seed 3: any base character overridden into a Knight-style Fighter with a
// kit proficiency (prof 2) currently wielding a Long Sword (not the Knight's
// own kit weapon — a plain override per the plan's "explicit field
// overrides" instruction, proving lostProf reads c.prof, not the sub-class).
const knight = newRun(3).c;
knight.cls = "Fighter";
knight.sub = "Knight";
knight.weapon = "Long Sword";
knight.prof = 2;
knight.magicWpn = 0;

// seed 5: a noCrit Guard (sub "Guard" is one of the two noCritFor(c) rules)
// currently wielding a Quarter Staff.
const guard = newRun(5).c;
guard.cls = "Fighter";
guard.sub = "Guard";
guard.weapon = "Quarter Staff";
guard.prof = 0;
guard.magicWpn = 0;

// seed 9: a bare-handed Fighter (c.weapon "Fists" has no WEAPONS entry).
const bareHanded = newRun(9).c;
bareHanded.cls = "Fighter";
bareHanded.sub = null;
bareHanded.weapon = "Fists";
bareHanded.prof = 0;
bareHanded.magicWpn = 0;

const SAMPLE_HEROES = [
  ["level-3 Magic User (Quarter Staff, prof 0)", magicUser],
  ["Knight-style prof-2 Fighter (Long Sword)", knight],
  ["noCrit Guard (Quarter Staff)", guard],
  ["bare-handed Fighter (Fists)", bareHanded],
];

// ─── Consistency: the explanation never disagrees with the verdict ────────

test("consistency: round2(got.strike - have.strike) === weaponUpgradeDelta(c, it), for every WEAPONS key x bonus 0..2 x sample hero", () => {
  let checked = 0;
  for (const [label, c] of SAMPLE_HEROES) {
    for (const base of Object.keys(WEAPONS)) {
      for (const bonus of [0, 1, 2]) {
        const it = { kind: "weapon", base, bonus, n: base, txt: base };
        const parts = gearCompareParts(c, it);
        assert.ok(parts && parts.kind === "weapon", `${label}/${base}+${bonus}: gearCompareParts must return a weapon parts object`);
        const fromParts = round2(parts.got.strike - parts.have.strike);
        const fromVerdict = weaponUpgradeDelta(c, it);
        assert.equal(fromParts, fromVerdict, `${label}/${base}+${bonus}: parts delta must equal weaponUpgradeDelta`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, "at least one hero/base/bonus combo must have been checked");
});

// ─── The Spiked Staff case, pinned to the CONTEXT-measured exact string ───

test("Spiked Staff: level-3 Human Wizard (Quarter Staff, prof 0) reads the exact CONTEXT string (no opts: 'worse than yours')", () => {
  const it = { kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" };
  const parts = gearCompareParts(magicUser, it);
  const text = upgradeWhyText(parts);
  assert.equal(text, "d8 vs your d6 · −1 to hit, worse than yours · 4.1 vs 5.0 a swing");
  assert.equal(weaponUpgradeDelta(magicUser, it) > 0, false, "the Spiked Staff must NOT be an upgrade for this hero (the verdict CONTEXT reasons about)");
});

test("same weapon (Quarter Staff vs Quarter Staff, prof 0): no dice/to-hit/crit term, just the swing numbers", () => {
  const it = { kind: "weapon", base: "Quarter Staff", bonus: 0, n: "Quarter Staff", txt: "d6" };
  const text = upgradeWhyText(gearCompareParts(magicUser, it));
  assert.equal(text, "5.0 vs 5.0 a swing");
});

test("Rapier vs Quarter Staff for a hero who can crit, dieN 20 + haveName: '+1 to hit, better than your Quarter Staff' and 'crits on 19–20 vs your 20' (roll-high, Phase 73)", () => {
  const canCrit = newRun(11).c;
  canCrit.cls = "Fighter";
  canCrit.sub = null; // not Guard/Soldier -> can crit
  canCrit.weapon = "Quarter Staff";
  canCrit.prof = 0;
  canCrit.magicWpn = 0;
  const it = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const text = upgradeWhyText(gearCompareParts(canCrit, it), { dieN: 20, haveName: "Quarter Staff" });
  assert.match(text, /\+1 to hit, better than your Quarter Staff/);
  assert.match(text, /crits on 19–20 vs your 20/);
});

test("the same crit term on a d12 reads 'crits on 11–12 vs your 12'", () => {
  const canCrit = newRun(11).c;
  canCrit.cls = "Fighter";
  canCrit.sub = null;
  canCrit.weapon = "Quarter Staff";
  canCrit.prof = 0;
  canCrit.magicWpn = 0;
  const it = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const text = upgradeWhyText(gearCompareParts(canCrit, it), { dieN: 12 });
  assert.match(text, /crits on 11–12 vs your 12/);
});

test("with no dieN, no 'crits on' term appears at all", () => {
  const canCrit = newRun(11).c;
  canCrit.cls = "Fighter";
  canCrit.sub = null;
  canCrit.weapon = "Quarter Staff";
  canCrit.prof = 0;
  canCrit.magicWpn = 0;
  const it = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const text = upgradeWhyText(gearCompareParts(canCrit, it));
  assert.doesNotMatch(text, /crits on/);
});

test("a Guard (noCrit) comparing Rapier vs Quarter Staff has no 'crits on' term even with a dieN", () => {
  const it = { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" };
  const text = upgradeWhyText(gearCompareParts(guard, it), { dieN: 20 });
  assert.doesNotMatch(text, /crits on/);
});

test("bare-handed (Fists) buying a Spiked Staff with { haveName: 'bare hands' }: starts 'd8 vs your bare hands', has '−1 to hit, worse than your bare hands', no crit term", () => {
  const it = { kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" };
  const text = upgradeWhyText(gearCompareParts(bareHanded, it), { dieN: 20, haveName: "bare hands" });
  assert.ok(text.startsWith("d8 vs your bare hands"), text);
  assert.match(text, /−1 to hit, worse than your bare hands/);
  assert.doesNotMatch(text, /crits on/);
});

test("no output contains the pre-mirror '1–2' crit range, a hyphen-minus sign on a number, or a percent sign", () => {
  const samples = [
    upgradeWhyText(gearCompareParts(magicUser, { kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" })),
    upgradeWhyText(gearCompareParts(guard, { kind: "weapon", base: "Rapier", bonus: 0, n: "Rapier", txt: "d6" }), { dieN: 20 }),
    upgradeWhyText(gearCompareParts(bareHanded, { kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" }), {
      dieN: 20,
      haveName: "bare hands",
    }),
  ];
  for (const s of samples) {
    assert.doesNotMatch(s, /1–2/);
    assert.doesNotMatch(s, /-\d/);
    assert.doesNotMatch(s, /%/);
  }
});

test("a Knight-style hero with prof 2 comparing a Long Sword (same weapon) ends 'loses your +2 practiced bonus'", () => {
  const it = { kind: "weapon", base: "Long Sword", bonus: 0, n: "Long Sword", txt: "d8+2" };
  const text = upgradeWhyText(gearCompareParts(knight, it));
  assert.ok(text.endsWith("loses your +2 practiced bonus"), text);
});

test("an enchanted candidate (bonus 2) labels its dice 'd8 +2'", () => {
  const it = { kind: "weapon", base: "Spiked Staff", bonus: 2, n: "Spiked Staff +2", txt: "d8 +2" };
  const parts = gearCompareParts(magicUser, it);
  assert.equal(parts.got.lab, "d8 +2");
});

// ─── Armor ──────────────────────────────────────────────────────────────

test("armor: upgradeWhyText reads 'AR {got} vs your AR {have}'", () => {
  const c = { ...magicUser, ar: 6 };
  const it = { kind: "armor", ar: 15, n: "Plate", armor: "Plate", wp: 45, min: 2, cls: "F", txt: "AR 15" };
  const parts = gearCompareParts(c, it);
  assert.deepEqual(parts, { kind: "armor", got: { ar: 15 }, have: { ar: 6 } });
  assert.equal(upgradeWhyText(parts), "AR 15 vs your AR 6");
});

// ─── Edges ──────────────────────────────────────────────────────────────

test("upgradeWhyText returns '' for null/undefined/a string/an unknown kind", () => {
  assert.equal(upgradeWhyText(null), "");
  assert.equal(upgradeWhyText(undefined), "");
  assert.equal(upgradeWhyText("parley"), "");
  assert.equal(upgradeWhyText({ kind: "cloak" }), "");
});

test("gearCompareParts returns null for an unrecognized kind, an unknown weapon base, or a non-object item", () => {
  assert.equal(gearCompareParts(magicUser, { kind: "cloak" }), null);
  assert.equal(gearCompareParts(magicUser, { kind: "weapon", base: "Not A Real Weapon" }), null);
  assert.equal(gearCompareParts(magicUser, null), null);
  assert.equal(gearCompareParts(magicUser, undefined), null);
  assert.equal(gearCompareParts(magicUser, "parley"), null);
});

// ─── Purity ─────────────────────────────────────────────────────────────

test("purity: two calls are deep-equal; c and it are never mutated", () => {
  const c = structuredClone(magicUser);
  const cClone = structuredClone(c);
  const it = { kind: "weapon", base: "Spiked Staff", bonus: 0, n: "Spiked Staff", txt: "d8" };
  const itClone = structuredClone(it);

  const partsA = gearCompareParts(c, it);
  const partsB = gearCompareParts(c, it);
  assert.deepEqual(partsA, partsB);
  assert.deepEqual(c, cClone, "gearCompareParts must never mutate the character");
  assert.deepEqual(it, itClone, "gearCompareParts must never mutate the item");

  const textA = upgradeWhyText(partsA);
  const textB = upgradeWhyText(partsA);
  assert.equal(textA, textB);
});

// ─── noCritFor mirrors expectedStrike's own inline rule ────────────────

test("noCritFor(c): true for Guard/Soldier or a live noCrit effect, false otherwise; expectedStrike unaffected by the extraction", () => {
  assert.equal(noCritFor(guard), true);
  const soldier = { ...knight, sub: "Soldier" };
  assert.equal(noCritFor(soldier), true);
  assert.equal(noCritFor(knight), false);
  assert.equal(noCritFor({ sub: null, timers: {} }), false);
  // expectedStrike byte-identical: same inputs, same output, whether or not
  // the character can crit (this is a smoke check, not a re-derivation).
  const c = { ...magicUser };
  assert.equal(expectedStrike(c, "Quarter Staff", 0, 0), 5);
});

// ─── Module purity: no imports, no rng, frozen copy ────────────────────

test("upgradeWhy.js source has exactly ONE import statement (from ./rollRange.js) and no Math.random/Date.now", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "src", "browser", "upgradeWhy.js"), "utf8");
  // Strip line + block comments first — this file's OWN doc comments describe
  // the purity contract in prose (mentioning "import"/"Math.random"/"Date.now"
  // as words), which must not trip the scan of the real executable source.
  const noLineComments = raw
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//");
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
  const src = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  const importLines = src.split("\n").filter((line) => /^\s*import\s/.test(line));
  assert.equal(importLines.length, 1, `upgradeWhy.js must have exactly one import statement, found:\n${importLines.join("\n")}`);
  assert.match(importLines[0], /from\s+"\.\/rollRange\.js"/, "upgradeWhy.js's one import must be from ./rollRange.js");
  assert.doesNotMatch(src, /Math\.random/);
  assert.doesNotMatch(src, /Date\.now/);
});

test("UPGRADE_WHY_COPY is frozen", () => {
  assert.ok(Object.isFrozen(UPGRADE_WHY_COPY));
});

test("swingText: half-up at one decimal (4.050000000000001 -> '4.1', 5 -> '5.0')", () => {
  assert.equal(swingText(4.050000000000001), "4.1");
  assert.equal(swingText(5), "5.0");
});

// ─── Voice: no leaf, and no rendered sample, carries a wp/WP token or a BANNED word ─

const PLAYER_WP = /(?<![\w.$-])(wp|WP)(?![\w:])/;

function bannedWordRegex() {
  const escaped = BANNED.filter((w) => !ALLOWLIST.includes(w)).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
}

function collectStringLeaves(obj) {
  const leaves = [];
  if (typeof obj === "string") {
    leaves.push(obj);
    return leaves;
  }
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj)) leaves.push(...collectStringLeaves(v));
  }
  return leaves;
}

test("voice: no UPGRADE_WHY_COPY leaf, and no rendered sample string, contains a standalone wp/WP token or a BANNED word", () => {
  const bannedRe = bannedWordRegex();
  const offenders = [];

  for (const leaf of collectStringLeaves(UPGRADE_WHY_COPY)) {
    if (PLAYER_WP.test(leaf)) offenders.push(`UPGRADE_WHY_COPY leaf -> "${leaf}"`);
    if (bannedRe.test(leaf)) offenders.push(`UPGRADE_WHY_COPY leaf (banned word) -> "${leaf}"`);
  }

  const samples = [];
  for (const [label, c] of SAMPLE_HEROES) {
    for (const base of Object.keys(WEAPONS)) {
      const it = { kind: "weapon", base, bonus: 0, n: base, txt: base };
      samples.push([`${label}/${base}`, upgradeWhyText(gearCompareParts(c, it))]);
    }
  }
  samples.push(["armor AR 15 vs 6", upgradeWhyText(gearCompareParts({ ...magicUser, ar: 6 }, { kind: "armor", ar: 15 }))]);

  for (const [label, text] of samples) {
    if (PLAYER_WP.test(text)) offenders.push(`${label} -> "${text}"`);
    if (bannedRe.test(text)) offenders.push(`${label} (banned word) -> "${text}"`);
  }

  assert.deepStrictEqual(offenders, [], `Player-facing wp/WP or banned word in upgradeWhy output:\n${offenders.join("\n")}`);
});
