// src/browser/upgradeWhy.js
//
// Phase 61 (STORE-03): formats engine/derived.js#gearCompareParts' plain-data
// parts into the "why is this an upgrade / not an upgrade" explanation line.
// PRESENTATION ONLY, engine-free. Phase 74 (ROLL-02/03, "Roll Display &
// Modifier Honesty"): purity now means ONE import — the pure, import-free
// src/browser/rollRange.js formatter — for the to-hit sign and the die-aware
// crit-range text. rollRange.js is itself pure and import-free, so
// eventNarration.js and narrationLines.js (which call upgradeWhyText with no
// options, per 74-CONTEXT — the purchase-bagged Oracle/rail lines carry no
// hero die) keep their own established purity discipline (T-25-23)
// undisturbed. Pure, no Math.random/Date.now, no DOM, never mutates its
// argument. Copy lives in the frozen UPGRADE_WHY_COPY below, walked by
// test/unit/hp-not-wp.test.js alongside every other presentation COPY bank.
//
// The verdict word ("upgrade"/"not an upgrade") is NOT decided here — this
// module only explains a verdict `src/browser/viewModels.js#lootCompare`
// already computed from weaponUpgradeDelta/armorUpgradeDelta. This is advice
// only; it never gates BUY, TAKE or EQUIP (CONTEXT "The upgrade line").
//
// Phase 74 (ROLL-02/03): the to-hit term now states which way the change
// goes, e.g. "−2 to hit, worse than your Club" (74-CONTEXT "Item, loot,
// store and find comparisons": comparisons say which way is better; + is
// always easier to hit, − always harder). This closes the ROLL-LEDGER
// device-trigger case: a dropped heavy weapon (need −2) compared against a
// Club now reads which way it goes instead of a bare signed number. The
// crit term now reads roll-high, on the hero's own strike die ("crits on
// 19–20 vs your 20") instead of the old pre-mirror roll-under reading
// ("crits on 1–2 vs your 1") — Phase 73 moved crits onto a weapon's TOP die
// faces, so the old reading was wrong. The crit term only appears when the
// caller supplies opts.dieN; with no die in reach (the purchase-bagged
// Oracle/rail lines) the term is simply omitted, never printed in the old
// roll-under form.

import { toHitText, facesRangeText } from "./rollRange.js";

/** UPGRADE_WHY_COPY — every string leaf this formatter builds from. Frozen
 * so the voice scan and hp-not-wp guard can walk it like every other
 * presentation COPY bank. `{placeholders}` are replaced by upgradeWhyText;
 * every leaf here is plain text, never HTML. */
export const UPGRADE_WHY_COPY = Object.freeze({
  dice: "{got} vs your {have}",
  bareHands: "bare hands",
  toHit: "{toHit}, {verdict} than {whose}",
  better: "better",
  worse: "worse",
  yours: "yours",
  yourNamed: "your {name}",
  crit: "crits on {got} vs your {have}",
  swing: "{got} vs {have} a swing",
  lostProf: "loses your +{n} practiced bonus",
  armor: "AR {got} vs your AR {have}",
  upgrade: "upgrade",
  notUpgrade: "not an upgrade",
  sep: " · ",
});

/** swingText(x) — the per-swing expected-damage number, rounded half-up to
 * one decimal and always shown with exactly one decimal place (so `5` reads
 * "5.0", never a bare "5"). `Math.round` on `x * 10` is deliberate: a
 * floating-point strike value like 4.050000000000001 rounds to 41 (not 40),
 * matching the CONTEXT-pinned "4.1" reading rather than a naive toFixed(1)
 * banker's-rounding surprise. */
export function swingText(x) {
  return (Math.round(x * 10) / 10).toFixed(1);
}

function fill(template, values) {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template);
}

/**
 * upgradeWhyText(parts, opts) — Phase 61 (STORE-03); Phase 74 (ROLL-02/03)
 * adds the optional second argument `opts: { dieN, haveName }`. Returns `""`
 * for anything that is not a non-null object whose `kind` is `"weapon"` or
 * `"armor"` (null, undefined, a string, an unrecognized kind like `"cloak"`)
 * — never throws.
 *
 * Weapon: collects the terms that DIFFER, in this fixed order, then joins
 * with UPGRADE_WHY_COPY.sep:
 *   (a) dice — when got.lab !== have.lab (have.lab === null reads as
 *       "bare hands", the bare-handed case);
 *   (b) to-hit — when d = got.need - have.need is non-zero: toHitText(d),
 *       then "better than {whose}" (d > 0) or "worse than {whose}" (d < 0),
 *       where {whose} is "your {opts.haveName}" when a name is supplied,
 *       else the bare "yours";
 *   (c) crit — only when opts.dieN is a finite number, have.crit is not
 *       null (never shown for a bare-handed `have`) and got.crit !==
 *       have.crit (never shown for a noCrit character, whose got/have both
 *       read 0); got and have are written via facesRangeText(crit, dieN),
 *       the hero's own roll-high top-face range;
 *   (d) swing — always, the per-swing numbers via swingText;
 *   (e) lostProf — when parts.lostProf > 0.
 *
 * Armor: the one fixed UPGRADE_WHY_COPY.armor template with got.ar/have.ar.
 */
export function upgradeWhyText(parts, opts) {
  if (!parts || typeof parts !== "object") return "";
  if (parts.kind === "armor") {
    return fill(UPGRADE_WHY_COPY.armor, { got: parts.got.ar, have: parts.have.ar });
  }
  if (parts.kind !== "weapon") return "";

  const { dieN, haveName } = opts || {};
  const { got, have, lostProf } = parts;
  const terms = [];

  const haveLab = have.lab === null ? UPGRADE_WHY_COPY.bareHands : have.lab;
  if (got.lab !== have.lab) terms.push(fill(UPGRADE_WHY_COPY.dice, { got: got.lab, have: haveLab }));

  const needDelta = got.need - have.need;
  if (needDelta !== 0) {
    const whose = haveName ? fill(UPGRADE_WHY_COPY.yourNamed, { name: haveName }) : UPGRADE_WHY_COPY.yours;
    terms.push(
      fill(UPGRADE_WHY_COPY.toHit, {
        toHit: toHitText(needDelta),
        verdict: needDelta > 0 ? UPGRADE_WHY_COPY.better : UPGRADE_WHY_COPY.worse,
        whose,
      }),
    );
  }

  if (Number.isFinite(dieN) && have.crit !== null && got.crit !== have.crit) {
    terms.push(fill(UPGRADE_WHY_COPY.crit, { got: facesRangeText(got.crit, dieN), have: facesRangeText(have.crit, dieN) }));
  }

  terms.push(fill(UPGRADE_WHY_COPY.swing, { got: swingText(got.strike), have: swingText(have.strike) }));

  if (lostProf > 0) terms.push(fill(UPGRADE_WHY_COPY.lostProf, { n: lostProf }));

  return terms.join(UPGRADE_WHY_COPY.sep);
}
