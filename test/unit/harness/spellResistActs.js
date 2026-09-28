// test/unit/harness/spellResistActs.js
//
// Quick 260927-rsx (user ruling 2026-09-27): every spell cast on a foe now
// rolls that foe's resist (engine/derived.js#foeSpellResistCheck), from a
// derived stream keyed on (main cursor, "spellResist", source, state.acts,
// combat round, foe index). A test that pins something ELSE about a spell
// (its damage, its draw count, an item's reach) must not have a foe resist
// it by chance, so it picks the `state.acts` value this helper finds: the
// first one whose REAL resist check gives every `[idx, resisted]` wanted,
// off the test rng's cursor (a fake rng with no getState reads cursor 0).
// Never a mocked stream — the same idiom 75.3-04's control-resist tests use.

import { foeSpellResistCheck } from "../../../engine/derived.js";

/**
 * actsWhere(source, wants, { cursor = 0, round = 1, intels = {} }) — the
 * first acts in 0..20000 where foe idx resists (or not) as `wants` asks.
 * `intels[idx]` is that foe's intel (default 1, the fixtures' usual beast);
 * `caster` is "you" (the hero, an item) or a Joiner's name.
 */
export function actsWhere(source, wants, { cursor = 0, round = 1, intels = {}, caster = "you" } = {}) {
  const probe = { getState: () => cursor };
  for (let acts = 0; acts <= 20000; acts++) {
    const ok = wants.every(([idx, resisted]) => foeSpellResistCheck({ acts, combat: { round } }, probe, source, idx, intels[idx] ?? 1, caster).resisted === resisted);
    if (ok) return acts;
  }
  throw new Error(`actsWhere: nothing for ${source} ${JSON.stringify(wants)}`);
}

/** noResistActs(source, n, opts) — the first acts where foes 0..n-1 all fail
 * to resist `source`. */
export function noResistActs(source, n = 1, opts = {}) {
  return actsWhere(source, Array.from({ length: n }, (_, i) => [i, false]), opts);
}
