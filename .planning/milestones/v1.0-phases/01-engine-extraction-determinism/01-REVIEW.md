---
phase: 01-engine-extraction-determinism
reviewed: 2026-09-08
depth: deep (source read of all 17 engine/*.js modules, saveState/rehydrate trust boundary, circular-import safety, content spot-checks, browser adapter, live reproduction of the critical finding)
files_reviewed: 39 (17 engine/*.js, 19 content/*.js, 1 src/browser/engineAdapter.js, 1 mazeworld.html diff, 1 test spot-check for corroboration)
status: fixed
fixed_at: 2026-09-08
fix_summary: 8/8 findings fixed (1 Critical, 1 High, 3 Medium, 3 Low). Full node --test suite green at 285/285 (268 baseline + 17 new regression tests). See per-finding "Disposition" notes below for commit hashes.
---

# Phase 1 Code Review — Engine Extraction & Determinism

## Scope note

This is a genuinely strong extraction: the `applyAction` boundary is clean, the circular
`combat.js` ↔ `movement.js`/`items.js`/`encounters.js` imports are runtime-safe (verified
below), content is pure data, and the RNG-consumption order is faithfully preserved with
extensive commentary explaining *why* at every non-obvious branch. The findings below are
things the 268-test parity/round-trip suite does **not** exercise, per the review brief's
own framing — they are not a rebuttal of the passing test suite.

Two items below (findings 1 and 3) are demonstrated with a live reproduction, not just static
reading. One item that looked at first read like a determinism leak (`Date.now()` defaults in
`movement.js`/`death.js`/`magic.js`/`items.js`) turned out, on closer inspection of the frozen
prototype and the test suite, to be a faithful, correctly-scoped port of the prototype's own
`S.deathAt = Date.now()` behavior with a real injection seam for tests — **not a defect**, so
it is not listed as a finding. Prototype-pollution via a `__proto__` key in a save was also
tested live and confirmed **not exploitable** (`JSON.parse` does not trigger the prototype
setter) — also not listed as a finding, per the review brief's explicit ask to check it.

---

## Critical

### CR-01: `validateSave` accepts structurally-shallow saves that crash the engine on the very next action

**File:** `engine/saveState.js:49-57` (validation), `engine/saveState.js:88-105` (`rehydrate`)

**Issue:** `validateSave` only checks that `obj.c` and `obj.floor` are non-null, non-array
`object`s — it never validates their required sub-shape (`c.wp`, `c.level`, `c.skills`,
`floor.g`, `floor.px`, `floor.py`, etc.). This is not a hypothetical gap: it is the
documented, asserted behavior of the module's own test suite —
`test/unit/save-validation.test.js:45` explicitly asserts
`validateSave(JSON.stringify({ c: {}, floor: {} })).ok === true`.

A save shaped like `{c:{}, floor:{}}` (e.g. a partially-written file from a crashed browser
tab, a truncated localStorage write under storage pressure, or a hand-tampered save) passes
validation, gets rehydrated by `rehydrate()` unchanged, and is handed to `applyAction`. The
very next `move` action throws an **uncaught `TypeError`** because `floor.g`/`floor.px`/
`floor.py` are `undefined`. Reproduced live:

```
$ node -e "... validateSave({c:{},floor:{}}) -> rehydrate -> applyAction(state,{type:'move',dir:'N'}) ..."
validateSave ok: true
rehydrated state: {"version":1,"seed":1,"rngState":1,"c":{},"floor":{},"day":1,"steps":0,...}
CRASHED: Cannot read properties of undefined (reading 'NaN')
```

`src/browser/engineAdapter.js#dispatch()` (line 89-97) calls `applyAction` with no
`try`/`catch`, so this exception is uncaught in the live page — a corrupted/tampered save
does not "fail closed to `newRun`" as the module's own header comment (line 29-31: "Never
throws: malformed JSON or a save missing `c`/`floor` returns `{ ok: false }` so the caller can
fail closed") claims; it fails *open* into a state that reliably crashes on the first
subsequent action. This is exactly the "save/rehydrate trust boundary" risk the phase brief
asked to verify, and it is a real, demonstrated gap, not a theoretical one.

**Fix:** Deep-validate the minimal shape `applyAction`'s rule modules actually depend on
before accepting a save, e.g.:

```js
function isValidCharacter(c) {
  return c && typeof c.wp === "number" && typeof c.maxWP === "number"
      && typeof c.level === "number" && c.skills && typeof c.skills === "object";
}
function isValidFloor(f) {
  return f && Array.isArray(f.g) && typeof f.px === "number" && typeof f.py === "number"
      && Number.isInteger(f.depth);
}
// in validateSave:
if (!isValidCharacter(obj.c)) return { ok: false, reason: "save has a malformed character" };
if (!isValidFloor(obj.floor)) return { ok: false, reason: "save has a malformed floor" };
```

Alternatively (belt-and-suspenders, cheaper to land immediately), wrap
`engineAdapter.js#dispatch()`'s `applyAction` call in a `try/catch` that falls back to
`initRun(freshSeed)` on any throw — this doesn't fix the root validation gap but stops the
uncaught-exception crash from reaching the player.

**Disposition: fixed** (commit `07e5fdf`). Added `isValidCharacter`/`isValidFloor` deep-shape
checks to `validateSave` (rejects `{c:{},floor:{}}` and any character/floor missing
`wp`/`maxWP`/`level`/`skills` or `g`/`px`/`py`/`depth`) AND wrapped `engineAdapter.js#dispatch()`'s
`applyAction` call in `try`/`catch` (belt-and-suspenders — falls back to a fresh run on any throw).
Updated the now-wrong `test/unit/save-validation.test.js:45` assertion and the "old-shape save"
fixture (which needed a genuinely valid `c`/`floor` shape once deep validation landed). Added 5
regression tests (4 in `save-validation.test.js`, 1 in `engineAdapter.test.js`) proving the
shape-malformed save is rejected and cannot crash `applyAction`.

---

## High

### HI-01: Fog-of-war reveal radius never varies by darkness/Night Vision/sight effect — an accidental gameplay regression, not a documented scope cut

**Files:** `engine/maze.js:177-181` (`reveal`), `engine/movement.js:113,327,386`, `engine/state.js:31`

**Issue:** The frozen prototype computes the reveal radius dynamically every time it reveals
tiles (`test/parity/prototype-master.js.txt:838`):

```js
const r = ((g[py][px].dark && !skill("Night Vision")) ? 1 : 2) + eff("sight");
```

`engine/maze.js#reveal(floor, radius = 2)` correctly took this in as a parameter (its own
docstring, lines 163-176, explains exactly this and calls out that "a future plan wiring
skills/effects into engine state can compute the correct radius and pass it in"). That future
plan does not appear to have landed: **every real call site** — `move()` (line 113),
`teleport()` (line 327), `descend()` (line 386), and `newRun()`'s initial reveal
(`state.js:31`) — calls `reveal(f)` / `reveal(floor)` with zero arguments, so the radius is
always the hard-coded default of 2, regardless of whether the player is standing in the dark,
has Night Vision, or is carrying the "Amulet of Light" (`content/treasure-tables.js:16`,
`eff: { sight: 1, light: 1 }`).

Concretely:
- Any character without the Night Vision skill, standing on a dark tile (`floor >= 2`
  generates dark blobs per `maze.js:121-129`), always gets the full 5×5 reveal instead of the
  book-correct 3×3 — the darkness mechanic is silently defanged for fog-of-war purposes (it
  still affects combat/toHit via `inDark()`, which is unaffected by this bug and works
  correctly).
- The Amulet of Light's entire mechanical purpose (`sight: 1`) is a complete no-op: picking
  it up, wearing it, anything — the reveal radius never reads `eff(c, "sight")` anywhere in
  the engine.

This was not caught by the parity/round-trip suite because (per `test/unit/maze.test.js`)
`reveal()` is only unit-tested in isolation with an explicit radius argument — no fixture
appears to drive a real `move`/`teleport`/`descend` through a dark tile while asserting on the
resulting `seen` grid shape, so the missing radius computation at the call sites is invisible
to the existing tests. Per `.claude/CLAUDE.md`'s fidelity rule ("deviations must be deliberate
design decisions, not accidental regressions") and the phase's own "zero gameplay regressions"
success criterion, this qualifies as a real, un-flagged regression rather than an
intentionally-deferred scope boundary (it is not listed in SKELETON.md's "Out of Scope" nor
any carried-forward plan todo).

**Fix:** Compute the radius at each call site the same way the prototype did, e.g. a small
helper in `movement.js` (importing `skill`/`eff` from `derived.js`, already imported there):

```js
function revealRadius(state) {
  const f = state.floor, c = state.c;
  const dark = f.g[f.py] && f.g[f.py][f.px] && f.g[f.py][f.px].dark;
  return (dark && !skill(c, "Night Vision") ? 1 : 2) + eff(c, "sight");
}
```

and call `reveal(f, revealRadius(state))` at each of the four sites (`move`, `teleport`,
`descend`, and `newRun`/`state.js`, threading `c` in from `rollCharacter`'s output — trivial
since `sight` is always 0 for a fresh character with no items).

**Disposition: fixed** (commit `aec11e2`). Added `engine/derived.js#revealRadius(state)`,
porting the prototype's formula verbatim (reusing the already-existing `inDark(state)` helper),
and wired it into all four real call sites (`move`/`teleport`/`descend` in `movement.js`,
`newRun` in `state.js`). Added 4 regression tests in `movement.test.js` exercising darkness (no
Night Vision → radius 1), Night Vision on a dark tile (→ radius 2), the Amulet of Light's
`sight:1` effect on a lit tile (→ radius 3), and `sight:1` stacked with darkness-no-Night-Vision
(→ radius 2). The full parity suite (which runs the real frozen prototype side by side) stayed
green with zero RNG-consumption-order changes, confirming byte-exact match with the prototype.

---

## Medium

### MD-01: `rehydrate()` silently drops `deathAt` and `lastWords`, breaking losslessness for terminal-state saves

**File:** `engine/saveState.js:88-105`

**Issue:** `die()` (`engine/death.js:79-101`) sets `state.deathAt` and `state.lastWords` on a
dead run. `serializeRun()` (`saveState.js:22-24`) preserves them (it spreads the full state).
But `rehydrate()` reconstructs its return object field-by-field and does not include
`deathAt` or `lastWords` — reloading a save of a dead/won run silently loses its time-of-death
and "last words" quote, while `deathNote`/`epitaph` (set by the same `die()` call) *are*
preserved. This contradicts the module's own stated intent ("the engine's GameState is
already 100% plain data end-to-end... serializeRun keeps the FULL state — nothing needs to be
dropped anymore," line 11-13) and the phase's ENG-04 "lossless serialize/rehydrate round-trip"
criterion, at least for terminal-state runs. Low real-world impact (a dead run is typically
followed by starting a fresh run, not reloading), but it is a genuine, silent data-loss path.

**Fix:** Round-trip every field `serializeRun` can produce:

```js
export function rehydrate(obj) {
  return {
    version: STATE_VERSION,
    seed: obj.seed,
    rngState: obj.rngState,
    c: obj.c,
    floor: obj.floor,
    day: obj.day ?? 1,
    steps: obj.steps ?? 0,
    combat: null,
    store: null,
    beats: null,
    dead: !!obj.dead,
    won: !!obj.won,
    deathNote: obj.deathNote || "",
    epitaph: obj.epitaph || "",
    deathAt: obj.deathAt,
    lastWords: obj.lastWords,
  };
}
```

**Disposition: fixed** (commit `151b691`). Implemented with a conditional variant (only sets
`deathAt`/`lastWords` when present on the input) rather than the unconditional literal fix
suggestion above, so a fresh (non-terminal) run's rehydrated state doesn't gain spurious
`deathAt: undefined`/`lastWords: undefined` keys that would break the existing
`deepStrictEqual` round-trip test. Also threaded the same passthrough into `validateSave`'s
returned `value` object (not just `rehydrate`), since the real save/load path is
`validateSave` → `rehydrate`, and `validateSave` was independently stripping these fields
before `rehydrate` ever saw them. Added 2 regression tests: a dead run's `deathAt`/`lastWords`
survive the full `serializeRun` → `validateSave` → `rehydrate` round-trip, and a fresh run's
rehydrated state carries no spurious keys.

### MD-02: `validateSave` never inspects `obj.version` — no rejection or migration path for a future schema bump

**File:** `engine/saveState.js:39-80`

**Issue:** `STATE_VERSION` exists specifically ("bumped when the GameState shape changes," per
`state.js:13`) to support future save-compatibility decisions, but `validateSave` never reads
`obj.version` at all — it unconditionally stamps the *current* `STATE_VERSION` onto whatever
it validates, regardless of what version (if any) the raw save actually claims. Today, with
only one version in existence, this is harmless. But the review brief specifically asked
whether `validateSave` is fail-closed against "version-mismatched" input, and as written it
is not: when `STATE_VERSION` bumps to 2 with new required `c`/`floor` fields, an old v1 save
will still pass today's shallow `c`/`floor`-presence check, get silently re-stamped as v2, and
likely crash downstream via the same failure mode as CR-01 rather than being caught and
migrated/rejected explicitly.

**Fix:** At minimum, thread `obj.version` through and gate future shape checks on it (even a
`switch (obj.version ?? 0)` with only a `case 1` today is enough to make the intended
extension point real rather than aspirational):

```js
const version = typeof obj.version === "number" ? obj.version : 1;
if (version > STATE_VERSION) return { ok: false, reason: `save version ${version} is newer than supported` };
// (a v1→v2 migration step would go here once STATE_VERSION bumps)
```

**Disposition: fixed** (commit `dbd3d49`). Implemented as suggested: `validateSave` now reads
`obj.version` (defaulting to `1` when absent, matching today's only version) and rejects any
save claiming a version newer than `STATE_VERSION`, before falling through to the existing
shape checks. Added 2 regression tests: a save claiming `version: 999` is rejected with a
version-mentioning reason, and a save with no `version` field or `version <= STATE_VERSION`
still validates normally.

### MD-03: `epitaphCtx()` bakes locale-dependent number formatting into persisted, byte-compared GameState

**File:** `engine/death.js:34-48` (`epitaphCtx`)

**Issue:** `epitaphCtx` does `gold: c.gold.toLocaleString()`, matching the frozen prototype's
own `epitaphCtx` (`test/parity/prototype-master.js.txt:2488`) verbatim. In the prototype this
was purely a live-DOM-render helper — its output was never itself stored back into `S` or
compared byte-for-byte anywhere. In the extracted engine, this same call feeds
`state.epitaph`, which **is** now persisted GameState (`serializeRun`/`saveState.js`) and is
explicitly compared byte-for-byte by the round-trip, determinism, and parity test suites, and
is part of the phase's "same seed + same actions → byte-identical results" success criterion
(intended, per `01-CONTEXT.md`, to make "high scores... reproducible/verifiable"). `Number.prototype.toLocaleString()`'s output (digit grouping separator, digit-grouping
pattern) is governed by the JS runtime's default locale/ICU data, which is not controlled by
the seed. Two devices (or the same Android WebView under two different system locales) running
the identical seed and action sequence can produce a different `state.epitaph` string purely
from `gold.toLocaleString()`'s locale-dependent formatting — a real, if narrow, break of the
byte-identical reproducibility promise that a static determinism guard (which only scans for
`Math.random`) would never catch.

**Fix:** Pin a fixed locale/format inside the engine rather than relying on the runtime
default, e.g. `c.gold.toLocaleString("en-US")`, or better, do the formatting at the
presentation layer (the browser adapter) instead of baking a formatted string into engine
state at all — pass `c.gold` as a number in the epitaph token context and let a render-layer
formatter localize it for display without it ever entering serialized state.

**Disposition: fixed** (commit `2b5e788`). Took the cheaper of the two suggested fixes: pinned
`c.gold.toLocaleString("en-US")` inside `epitaphCtx`, rather than moving formatting to the
presentation layer (a larger refactor deferred as out of scope for this fix pass — the
byte-identical-reproducibility guarantee is what mattered here, and pinning the locale
satisfies it without touching the adapter/render boundary). Added 2 regression tests: one
spies on `Number.prototype.toLocaleString` to prove the locale argument is explicitly `"en-US"`
(not relying on this test machine's own default locale happening to match), the other confirms
a large gold value formats with the expected `en-US` thousands-grouping.

---

## Low

### LO-01: Inconsistent index/`idx` validation strictness across action types

**File:** `engine/actions.js:44-61`

**Issue:** `buyItem.idx` is validated as `isInt(action.idx) && action.idx >= 0` (line 49), but
`castSpell.idx` (line 54) and `useItem.i` (line 57) are only checked for `isInt(...)`, not
non-negativity. Harmless today (`SPELLS[idx]`/`c.items[i]` with a negative index simply return
`undefined`, and both `castSpell`/`useItem` safely no-op on a falsy lookup), but it's an
unexplained inconsistency in an otherwise carefully-documented input-validation module, and a
future refactor that indexes differently (e.g. `Array.prototype.at(-1)` semantics) could
silently start accepting "index from the end" where it isn't intended.

**Fix:** Either document why `buyItem` alone needs the `>= 0` guard, or apply the same guard
uniformly to `castSpell.idx`/`useItem.i` for a consistent contract.

**Disposition: fixed** (commit `5e7d419`). Applied the `>= 0` guard uniformly to
`castSpell.idx`/`useItem.i`, matching `buyItem.idx`. Added a regression test in
`engine-purity.test.js` asserting all three action types now reject a negative index.

### LO-02: Dead fallback branch in `startCombat`'s roster selection

**File:** `engine/combat.js:118`

**Issue:** `const roster = BESTIARY[type][lvl - 1] || BESTIARY[type][BESTIARY[type].length - 1];`
— `lvl` is always clamped to `[1,5]` (line 117, via `clamp(...,1,5)`), and every `BESTIARY`
category has exactly 5 tiers (confirmed directly in `content/bestiary.js` and by
`01-VERIFICATION.md`'s creature count audit), so `BESTIARY[type][lvl-1]` can never be falsy
and the `||` fallback is unreachable. Not a bug, just dead defensive code that could confuse a
future maintainer trying to figure out when it fires.

**Fix:** Either remove the fallback (rely on the clamp invariant) or add a one-line comment
noting it's unreachable-by-construction, matching this module's otherwise thorough commenting
style.

**Disposition: fixed** (commit `a7fb0a2`). Removed the unreachable `||` fallback and added an
inline comment documenting the clamp/5-tier invariant it relied on. No behavior change (the
fallback branch was never live), so no new test was added; the existing combat test suite
(28 tests) stayed green.

### LO-03: `parley`'s `Math.max(...liveFoes(...))` has an unguarded empty-array edge

**File:** `engine/combat.js:423`

**Issue:** `const top = Math.max(...liveFoes(state).map((f) => f.lvl));` evaluates to
`-Infinity` if ever called with zero live foes, which would inflate `bonus` (line 428-434) to
`+Infinity` and make `parley` un-failable. Currently unreachable in practice — `state.combat`
is nulled out the instant `liveFoes` empties in every code path that could produce it
(`startCombat`, `afterPlayerAction`) — so `parley` is never actually invoked with an empty
foe list today. Still, there's no defensive guard here, so a future change to when `combat` is
cleared (or a new action ordering) could silently reintroduce a real bug at this exact line
with no test currently pinned against it.

**Fix:** Guard defensively: `const foes = liveFoes(state); if (!foes.length) return events;`
at the top of `parley`, ahead of the `top` calculation.

**Disposition: fixed** (commit `7a771b2`). Implemented exactly as suggested. Added a
regression test in `combat.test.js` that forces the edge directly (a non-null `state.combat`
with only dead foes, bypassing the normal invariant that clears `combat` when it empties),
confirming `parley` is now a safe no-op instead of a `Math.max(...[])` exploit.

---

## Verified, not findings

- **Circular imports** (`combat.js` ↔ `movement.js`/`items.js`; `movement.js` ↔
  `encounters.js`) — confirmed safe. Every export involved on both sides of each cycle is a
  hoisted `function` declaration, and every cross-module call happens inside a function body
  invoked at runtime, never at module-evaluation time. No TDZ/undefined-at-call risk found.
- **Prototype pollution via `__proto__` in a save** — tested live
  (`validateSave('{"c":{"__proto__":{"polluted":true}}, "floor":{}}')`): `JSON.parse` creates
  `__proto__` as a harmless own data property, not a prototype-chain mutation; `Object.prototype`
  is unaffected. Not exploitable via this path.
- **`Date.now()` defaults in `move`/`newDay`/`makeCamp`/`winGame`/`castSpell`/`die`/`bury`/
  `useItem`** — initially looked like a determinism leak, but on inspection this faithfully
  ports the prototype's own `S.deathAt = Date.now()` (present verbatim at
  `prototype-master.js.txt:1415,2472,2565`), the field is explicitly and correctly excluded
  from every determinism/round-trip/parity diff (`test/parity/harness/diffState.js:38-41`),
  and each function's `now` parameter is genuinely injectable for tests that need a pinned
  clock (`test/unit/death.test.js:97`, `test/unit/items.test.js:233`). Not a defect.
- **`engine/*.js` purity** (no DOM/localStorage/`console`/`Math.random`) — spot-confirmed
  during this review, consistent with the static guard's own passing result.
- **Content spot-checks** (`weapons.js`, `races.js`, `spells.js`, `bestiary.js`) — dice
  notation and numeric values read consistent with the frozen prototype on every table sampled;
  no function leaves found, no hidden logic branches found.

---

_Reviewed: 2026-09-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
