// test/parity/harness/diffState.js
//
// Wall-clock-safe state comparator for the prototype-parity harness (ENG-05)
// and, later, the standing serialize/rehydrate round-trip test (ENG-04).
//
// mazeworld.html reads Date.now() at exactly four call sites (01-RESEARCH.md
// Pitfall 1; confirmed by direct code read): `S.deathAt` (lines 1860, 2917),
// the graveyard entry's `when` field (line 2956), and the `AGAIN_LOCK`
// re-roll cooldown (line 3010, derived from `S.deathAt` — no separate stored
// field to strip). These are wall-clock reads with zero effect on gameplay
// outcomes; two runs with identical seeds/actions will legitimately differ
// here by milliseconds, so every parity/round-trip comparison must strip
// them first or risk a flaky, untrustworthy harness (Anti-Patterns section).

/**
 * stripVolatileFields(state) — deep-clones `state`, then deletes the known
 * wall-clock fields: `deathAt` at any object level, and `when` on every
 * entry of any array found under a `graves` key. Everything else is left
 * intact. Returns a NEW object; does not mutate the input.
 *
 * @param {*} state - a state object (or any JSON-serializable value)
 * @returns {*} a deep clone of state with volatile fields removed
 */
export function stripVolatileFields(state) {
  const clone = structuredClone(state);
  stripInPlace(clone);
  return clone;
}

function stripInPlace(node) {
  if (node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const entry of node) stripInPlace(entry);
    return;
  }

  // `S.deathAt` (mazeworld.html lines 1860, 2917) — wall-clock timestamp,
  // set at death/win, no gameplay-outcome effect.
  if (Object.prototype.hasOwnProperty.call(node, "deathAt")) {
    delete node.deathAt;
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    // Graveyard entries' `when` field (mazeworld.html line 2956) — strip it
    // from every entry of any array stored under a `graves` key, wherever
    // that key appears in the object graph (engine GameState may nest it
    // differently than the prototype's top-level `graves` global).
    if (key === "graves" && Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object" && "when" in entry) {
          delete entry.when;
        }
      }
    }
    stripInPlace(value);
  }
}

/**
 * diffState(a, b) — strips volatile fields from both `a` and `b`, then
 * recursively walks both structures looking for the first divergent path.
 * Returns a human-readable path string describing the first divergence
 * (e.g. `"c.wp"`, `"floor.g[3][4].seen"`), or `null` if the stripped
 * structures are deeply equal. Intentionally returns a path instead of
 * asserting, so callers choose how (and whether) to fail (01-RESEARCH.md
 * Open Question 1: assert state strictly, events loosely — callers decide).
 *
 * @param {*} a
 * @param {*} b
 * @returns {string | null} the first divergent path, or null if equal
 */
export function diffState(a, b) {
  const strippedA = stripVolatileFields(a);
  const strippedB = stripVolatileFields(b);
  return findDivergence(strippedA, strippedB, "$");
}

function findDivergence(a, b, path) {
  if (Object.is(a, b)) return null;

  const typeA = valueType(a);
  const typeB = valueType(b);
  if (typeA !== typeB) {
    return `${path} (type mismatch: ${typeA} vs ${typeB}: ${describe(a)} vs ${describe(b)})`;
  }

  if (typeA === "array") {
    if (a.length !== b.length) {
      return `${path}.length (${a.length} vs ${b.length})`;
    }
    for (let i = 0; i < a.length; i++) {
      const divergence = findDivergence(a[i], b[i], `${path}[${i}]`);
      if (divergence) return divergence;
    }
    return null;
  }

  if (typeA === "object") {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) {
      return `${path} (key set mismatch: [${keysA}] vs [${keysB}])`;
    }
    for (const key of keysA) {
      const divergence = findDivergence(a[key], b[key], path === "$" ? key : `${path}.${key}`);
      if (divergence) return divergence;
    }
    return null;
  }

  // Primitives that reached here (number/string/boolean/null/undefined) are
  // not Object.is-equal — that IS the divergence.
  return `${path} (${describe(a)} vs ${describe(b)})`;
}

function valueType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function describe(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
