// src/browser/upgradeWhy.js
//
// Phase 61 (STORE-03): formats engine/derived.js#gearCompareParts' plain-data
// parts into the "why is this an upgrade / not an upgrade" explanation line.
// PRESENTATION ONLY, engine-free and IMPORT-FREE (no `import` statement at
// all, not even a bare content/ read) — the same purity discipline
// narrationLines.js/eventNarration.js already hold themselves to (T-25-23),
// so those two modules can format the SAME parts in Plan 03 without
// re-deriving them or breaking their own purity guards. Pure, no
// Math.random/Date.now, no DOM, never mutates its argument. Copy lives in
// the frozen UPGRADE_WHY_COPY below, walked by test/unit/hp-not-wp.test.js
// alongside every other presentation COPY bank.
//
// The verdict word ("upgrade"/"not an upgrade") is NOT decided here — this
// module only explains a verdict `src/browser/viewModels.js#lootCompare`
// already computed from weaponUpgradeDelta/armorUpgradeDelta. This is advice
// only; it never gates BUY, TAKE or EQUIP (CONTEXT "The upgrade line").

/** UPGRADE_WHY_COPY — every string leaf this formatter builds from. Frozen
 * so the voice scan and hp-not-wp guard can walk it like every other
 * presentation COPY bank. `{placeholders}` are replaced by upgradeWhyText;
 * every leaf here is plain text, never HTML. */
export const UPGRADE_WHY_COPY = Object.freeze({
  dice: "{got} vs your {have}",
  bareHands: "bare hands",
  toHit: "{signed} to hit",
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

/** critRange(n) — module-private: the die-roll range a crit die value reads
 * as. 1 -> "1" (only a natural 1 crits), 2 -> "1–2" (U+2013 en dash, a
 * roll of 1 OR 2 crits). This module carries no other crit value today
 * (WEAPONS.crit is 1|2 in content/weapons.js). */
function critRange(n) {
  return n === 2 ? "1–2" : "1";
}

function fill(template, values) {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), template);
}

/** signedNeed(d) — a to-hit NEED delta as "+d" (positive, easier to hit) or
 * "−|d|" (negative, harder to hit — U+2212 minus sign, never the ASCII
 * hyphen). `d` is never 0 at the call site (the caller only formats the
 * term when `d !== 0`). */
function signedNeed(d) {
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

/**
 * upgradeWhyText(parts) — Phase 61 (STORE-03): the ONE formatter for
 * `gearCompareParts(c, it)`'s output. Returns `""` for anything that is not
 * a non-null object whose `kind` is `"weapon"` or `"armor"` (null, undefined,
 * a string, an unrecognized kind like `"cloak"`) — never throws.
 *
 * Weapon: collects the terms that DIFFER, in this fixed order, then joins
 * with UPGRADE_WHY_COPY.sep:
 *   (a) dice — when got.lab !== have.lab (have.lab === null reads as
 *       "bare hands", the bare-handed case);
 *   (b) to-hit — when d = got.need - have.need is non-zero;
 *   (c) crit — when have.crit is not null (never shown for a bare-handed
 *       `have`) and got.crit !== have.crit (never shown for a noCrit
 *       character, whose got/have both read 0);
 *   (d) swing — always, the per-swing numbers via swingText;
 *   (e) lostProf — when parts.lostProf > 0.
 *
 * Armor: the one fixed UPGRADE_WHY_COPY.armor template with got.ar/have.ar.
 */
export function upgradeWhyText(parts) {
  if (!parts || typeof parts !== "object") return "";
  if (parts.kind === "armor") {
    return fill(UPGRADE_WHY_COPY.armor, { got: parts.got.ar, have: parts.have.ar });
  }
  if (parts.kind !== "weapon") return "";

  const { got, have, lostProf } = parts;
  const terms = [];

  const haveLab = have.lab === null ? UPGRADE_WHY_COPY.bareHands : have.lab;
  if (got.lab !== have.lab) terms.push(fill(UPGRADE_WHY_COPY.dice, { got: got.lab, have: haveLab }));

  const needDelta = got.need - have.need;
  if (needDelta !== 0) terms.push(fill(UPGRADE_WHY_COPY.toHit, { signed: signedNeed(needDelta) }));

  if (have.crit !== null && got.crit !== have.crit) {
    terms.push(fill(UPGRADE_WHY_COPY.crit, { got: critRange(got.crit), have: critRange(have.crit) }));
  }

  terms.push(fill(UPGRADE_WHY_COPY.swing, { got: swingText(got.strike), have: swingText(have.strike) }));

  if (lostProf > 0) terms.push(fill(UPGRADE_WHY_COPY.lostProf, { n: lostProf }));

  return terms.join(UPGRADE_WHY_COPY.sep);
}
