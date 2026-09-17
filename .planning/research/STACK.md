# Stack Research

**Domain:** In-repo engine/content/tooling conventions for v1.5 "Meaningful Choices — Spells, Gear & Abilities" (zero-dependency vanilla-JS roguelike; Capacitor Android shell unchanged)
**Researched:** 2026-09-17
**Confidence:** HIGH (every recommendation is grounded in a file:line read of the live engine, not inferred)

## Headline Answer

**Zero new runtime dependencies are needed, and none should be added.** Every capability v1.5 needs — squares-based cooldowns, round-based durations, use/duration/cooldown magic items, a fog-of-war-style darkness view, terrain move-cost, class-gated activated abilities — already has a **live, shipped precedent** in `engine/` and `content/`. This milestone is 100% "extend the existing data shape and reuse the existing seams," not "reach for a library." The work below documents those seams so phase planners wire the new features into the pattern that already exists, rather than inventing a second one.

## Existing Precedents (the "stack" for this milestone)

### 1. Squares-based duration/cooldown — already canon, two live examples

`engine/movement.js:293-294` ticks `c.haste`/`c.invis` down by 1 **per step**:
```js
if (c.haste > 0) c.haste--;
if (c.invis > 0) c.invis--;
```
and `engine/movement.js:330-339` runs the identical pattern for the Cloak of Flying's charge/cooldown pair (`c.flightLeft`, `c.flightCooldown`, `FLIGHT_COOLDOWN_SQUARES = 50` at `engine/movement.js:83`) — a genuine "use → effect for X squares → cooldown for Y squares" resource, already wired end-to-end (`engine/derived.js:132-161`'s `isFlying`).

`engine/items.js:774-787` (`itemReady`) implements the **exact** convention v1.5's magic items (cloaks/staves/rings/potions, "use → effect for X → cooldown for Y squares") need, keyed off the run's global step counter rather than a per-item countdown field:
```js
export function itemReady(state, it) {
  if (!it.use && it.kind !== "potion") return false;
  if (!it.every) return true;
  return state.steps - (it.usedAt ?? -99999) >= it.every;
}
```
`useItem` (`engine/items.js:810-870`) stamps `it.usedAt = state.steps` on a successful use and, on a refused use, computes `left: it.every - (state.steps - it.usedAt)` for the refusal event (`reason: "cooldown"`) — this is already the narrated "N squares left" the milestone's Clarity pass wants for every gated action. **`content/treasure-tables.js` already carries `use`/`every` fields on several CLOAKS and two JEWELRY rows** (Cloak of Invisibility `every: 100`, Cloak of Speed `every: 50`, Pendant of Fortitude `every: 100`, Amulet of Stone `every: 200`) — these are the milestone's target shape, already declared as data; the phase work is mostly **wiring `itemReady`/`useItem`'s existing dispatch to the STAVES table (`content/treasure-tables.js:37-46`, currently `use` with no `every` — staves are the one table still missing a cooldown) and to any new one-shot tools**, not inventing a new timer mechanism.

**Convention to state explicitly for phase planners:** squares-based timers live on the ITEM object itself (`it.usedAt`, read against `state.steps`), NOT on the character. Round-based timers (below) live on `state.combat` or `c.*` combat-scoped fields and are ticked by a combat-turn function, not `movement.js`. Do not blend the two — an item cooldown measured in squares must never be decremented by a round-tick function, and vice versa (this is what keeps `state.steps`-based math correct when the player is mid-fight and not moving).

### 2. Round-based duration — already canon, three live examples

- `state.combat.afraid` (Phobia/Afraid penalty, `engine/derived.js:38,377-389`) — an integer decremented once per `foeTurn` call, cleared unconditionally at `endCombat`. This is the pattern for any **combat-only** timed effect (e.g. a situational combat spell's duration, an activated ability's active-window).
- `c.ward.{pool,rounds,name}` (Shield/Bubble spells) — `rounds` ticked the same way; `pool` is a separate HP-style resource drained by absorbed damage, not by time. This is the precedent for the milestone's "Shield shows its remaining pool" requirement — the field already exists and is already surfaced by `conditionsOf` (`engine/derived.js:213-215`); the v1.5 work is a **UI read**, not a new engine field.
- `c.foeEffect.{kind,rounds}` (foe-inflicted debuffs, e.g. dazed/weakened) — same round-tick shape, one slot, combat-scoped.

**Convention for new melee cooldown abilities:** an activated ability's cooldown is a **combat-round** resource (ticks with `foeTurn`, like `afraid`), not a squares resource — melee abilities fire inside encounters, so tying them to `state.steps` would let a player "walk off" a cooldown outside combat in a way the design doesn't intend. Follow the `foeAbilities.js` per-foe cooldown shape below for the exact bookkeeping pattern, adapted to the hero side.

### 3. Cooldown-tracking data shape for MANY keyed abilities on one entity — already canon

`engine/foeAbilities.js:39-95` is the closest existing precedent to "a pool of activated abilities, each with its own cooldown, on one character sheet" — exactly what the melee ABILITIES submenu needs:
```js
export function tickAbilityCooldowns(state, f) {
  for (const id of f.abilities) {
    const a = BY_ID.get(id);
    if (!a || a.every === undefined) continue;
    if (!f.cd) f.cd = {};
    if (f.cd[id] === undefined) f.cd[id] = abilityCadenceFor(a, curve).every; // lazy init
    f.cd[id] = Math.max(0, f.cd[id] - 1);
  }
}
```
`f.cd` is a **plain `{ [abilityId]: roundsRemaining }` map**, lazily initialized, JSON-serializable for free. `firstReadyAbility` (`engine/foeAbilities.js:79-95`) reads it plus `f.uses` (a parallel per-encounter-uses counter) to gate readiness. **Recommendation: give the hero character (`c`) an identical `c.abilityCd = {}` map** for the new melee active-ability pool, keyed by the same content-table ids the ABILITIES submenu lists, ticked once per combat round in `combat.js` next to wherever `foeTurn`'s tail already ticks `afraid`/`ward.rounds`/`foeEffect.rounds`. This reuses a data shape the engine gate has already proven serializes/round-trips/parity-strips cleanly (see §5) instead of inventing a fourth per-ability field naming scheme.

### 4. Terrain move-cost — no existing precedent; simplest-consistent extension

There is currently no per-tile move-cost concept in `engine/maze.js`/`engine/movement.js` (movement is a flat one-step-per-tap cost). Water's "2 moves per square" is new. **Do not build a generic tile-cost system** — the milestone needs exactly one rule (water costs 2). The lowest-risk approach consistent with the existing tile-flag pattern (`f.g[y][x].dark`, read by `inDark`) is a second boolean tile flag (e.g. `f.g[y][x].water`) consulted at the one `movement.js` call site that currently does `state.steps++`/decrements the squares-based counters — charging the step counter (and therefore every `it.usedAt`/`c.haste`/flight cooldown math above) 2 instead of 1 when the destination tile is water. Because every existing squares-based timer is *already* expressed as "count of `state.steps` elapsed," a water tile costing 2 steps costs 2 units of cooldown/haste/flight progress "for free," with no separate water-aware branch needed in any of those consumers — this is the single biggest reason to keep the step-count convention rather than introduce a parallel "distance" unit.

### 5. Serialization / parity carve-out convention (non-negotiable, applies to every new field above)

Every new state field this milestone adds (`c.abilityCd`, any new `it.usedAt`/`it.every` on STAVES rows, a `water` tile flag, a darkness-view-duration counter, phobia-trigger bookkeeping) **must** be added to all three `*Comparable()` functions in `test/parity/harness/comparables.js` following the existing carve-out idiom — e.g. `stripFoeEffectField` (`comparables.js:153`) and `stripFoeAbilityState` (`comparables.js:302`, wired into all three comparables "so D-14 holds structurally, not just for combatComparable" — the exact wording to reuse for the new cooldown maps). A new field that is additive-with-a-sensible-default on load (mirroring `c.foeEffect`'s "present on save, never injected onto an old save lacking it" rule, `engine/foeAbilities.js`-adjacent code in `engine/state.js`) needs no migration; a field that changes an *existing* fixture's byte output needs a declared, scenario-scoped divergence (`stripDeclaredFields`, `comparables.js:698-713`), not a fixture edit.

## New RNG Draws — feature-guard convention (already the house style)

Every prior milestone's new rng draw was gated behind a boolean the shell alone sets on a fresh run (`state.dev`, `state.storeRoll` — `engine/state.js:200,212`), so every fixture/bot/old-save byte-identically replays the frozen draw sequence. v1.5's new draws (phobia trigger rolls for water/darkness, a Cutthroat-murders-the-Joiner roll, a melee ability's own to-hit/damage roll, a magic item's activation roll) do **not** need a new top-level state flag the way `storeRoll` did — those two examples were guarding an entire alternate *code path* for old saves. v1.5's new draws instead follow the **narrower, already-proven** pattern: a draw is naturally gated because it only fires on a genuinely new state shape that didn't exist before (a water tile that didn't exist on old floors; an ability whose `c.abilityCd` map is empty/absent on load). Where a draw could fire on an *old* save that predates the feature (e.g. a phobia-trigger check that now runs where it silently no-op'd before), gate it exactly like `24-05`'s `armorRefusalReason`/Woodsman-armor precedent: check for the new content/field's presence before drawing, never assume it. Document each such guard per-phase with its own before/after draw-count table, matching `test/unit/foe-turn-draw-count.test.js`'s "Section 4 is the append-only home for the D-04 gated-draw-per-ability-kind table" convention (`STATE.md` decision `19-04`).

## Test-Harness Additions Needed (all zero-dependency, `node --test`)

No new test *framework* or *runner* is needed — `node --test` (native, Node 22+, already the sole test command in `package.json:8-9`) covers every pattern below; the project has never added a third-party test library (jest/mocha/vitest) and should not start now.

| New test need | Pattern to reuse | Existing file to mirror |
|----------------|-------------------|--------------------------|
| Determinism of cooldown/duration math (a fixed rng sequence produces the exact same `usedAt`/`cd` map/`steps` delta every run) | `test/determinism/same-seed-same-result.test.js` — replay the same seed twice, `assert.deepStrictEqual` the resulting state | `test/determinism/same-seed-same-result.test.js` |
| Property-style sweep over many (ability, cooldown-length, round-count) combos without hand-picking each case | `tools/tune-classes.mjs`'s many-seed sweep style — NOT a new property-testing library (no fast-check/jsverify in this repo, and none should be added; the existing `rng.d()`-seeded sweep-and-assert style already gives cheap combinatorial coverage without a new dependency) | `test/unit/foe-turn-draw-count.test.js` (draw-count table), `test/unit/feedback-payload.test.js` (matrix proof, `foeToHitVs`≡`foeToHitBreakdown` over every race/sub/skill combo — this is the direct template for "cooldown state ≡ derived readiness for every (item, elapsed-steps) pair") |
| Canvas/fog-of-war rendering coverage (darkness 3×3 view) — canvas pixel output is not asserted anywhere in this codebase and should not start being asserted now | **Source assertions**: `fs.readFileSync("mazeworld.html")` + regex/`.includes()` checks that the `draw()` function's source *references* the right pure-data module/constant (mirrors `mapMarks.test.js`'s glyph-table unit tests plus `shell-map-invariants.test.js`'s `RAW.match(...)`/`assert.match(region, /.../)` pattern) | `test/unit/shell-map-invariants.test.js:30,148-154,206,282,408,416-418`; `test/unit/mapMarks.test.js` (pure palette/glyph-table unit tests the canvas code merely reads) |
| Coverage guard: every new event type gets an `EVENT_NARRATION`/toast-table entry | Existing partition test (TOAST_FOR ∪ ORACLE_ONLY = the full event universe) | `test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js` |
| Voice/tone guard on new item/ability/phobia flavor text | Existing BANNED-wordlist scan | `test/voice/safety-scan.test.js`, `content/safety-wordlist.js` (already imported by `mapMarks.test.js:14`) |

**New test files this milestone should plan for** (naming to match the existing `test/unit/<feature>.test.js` convention): `test/unit/abilityCooldowns.test.js` (hero `c.abilityCd` tick/readiness, mirroring `foe-abilities.test.js`'s coverage of `tickAbilityCooldowns`/`firstReadyAbility`), `test/unit/itemCooldowns.test.js` or an extension of the existing items test file for the newly-`every`-bearing STAVES rows and new one-shot tools, `test/unit/waterTerrain.test.js` (step-cost-doubling + phobia trigger), `test/unit/darknessView.test.js` (source-assertion style per above), a determinism test extending `test/determinism/same-seed-same-result.test.js`'s scope to cover the new fields.

## Balance/Tuning Tooling — already in-repo, reuse as-is

`tools/tune-classes.mjs` (confirmed present, `tools/tune-classes.mjs:1-40`) is the standing 143-cell class/sub/race matrix bot, run directly via `node tools/tune-classes.mjs [--seeds N] [--workers N] [--start-depth N] [--sub X] [--race Y] [--json]` — it is **not** wrapped in an `npm run` script (`package.json` has no `tune` script; it's invoked directly, matching its own header's documented usage). It is explicitly a **tuning proxy, not a pass/fail gate** (its own header: "NOT a substitute for a human playtest... do not gate any build or CI check on this script's output"). For v1.5:
- **Reuse it unmodified as the balance yardstick** for anything that moves player power (new activated abilities, magic-item cooldown windows, gear rework) — exactly as `PROJECT.md`'s milestone context already states ("`tools/tune-classes.mjs` + `docs/CLASS-PASS.md` are the balance yardstick for anything that moves player power").
- The bot's decision policy lives in `tools/lib/tuning-bot.mjs` (referenced by `tune-classes.mjs`'s header) — **a new activated-ability pool will need the bot's `chooseSpell`-equivalent scoring extended to also choose among activated abilities**, the same way Phase 22 (`22-02`, `STATE.md` decision) added `chooseSpell`'s kill/damage/disable/heal/ward-opener tiers for spellcasting. This is a bot-policy change inside the existing `tools/lib/` files, not a new tool.
- No new balance-simulation tool is needed; do not build a second matrix runner for gear/items — extend the existing cells' outcome fields (`meanDepth`, `reach5/10/20`, `topCauses`) to also report ability/item usage rates if a phase needs that visibility, following `26-01`'s precedent of adding supplementary fields to `verdicts.json` beyond the documented schema when a real need arises.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Any property-based testing library (fast-check, jsverify, etc.) | Zero-dependency constraint (`PROJECT.md` Constraints, `package.json` has never carried a test-only dependency beyond `@capacitor/cli`); the existing many-seed/many-combination sweep style (`tools/tune-classes.mjs`, `test/unit/feedback-payload.test.js`'s matrix proof) already gives combinatorial coverage over the exact same finite parameter spaces (races × subs × skills, or item × elapsed-steps) that a property tester would explore, without adding install/version-drift surface | The existing seeded-sweep + `assert.deepStrictEqual`/matrix-proof pattern (`node --test`) |
| A dedicated canvas-rendering/visual-regression test tool (e.g. Playwright, canvas pixel snapshotting) | No such tooling exists anywhere in this codebase (verified: `mapMarks.test.js`, `shell-map-invariants.test.js` both test canvas-adjacent code via pure-data assertions + source-text assertions, never rendered pixels); adding one would introduce a build/CI dependency and a headless-browser or `node-canvas` binary dependency that conflicts with "zero-dependency" and would need Android-side verification anyway (the WebView is the real target, not a Node canvas polyfill) | Source assertions (`fs.readFileSync` + regex/`.includes()`) on `draw()`'s literal source, exactly as `shell-map-invariants.test.js` already does; real fog/darkness visual verification stays a Pixel 7 on-device check, deferred to the end-of-milestone UAT batch per the project's established working method |
| A new npm script wrapping `tools/tune-classes.mjs` | The tool is already invoked directly per its own documented CLI (`node tools/tune-classes.mjs ...`) and adding a wrapper script would only rename an already-working, already-documented invocation | Keep calling it directly; if a phase wants a fixed default (e.g. `--seeds 40 --workers 4`), document the exact command in that phase's PLAN.md, matching how Phase 22/26 documented their own invocations rather than adding a script |
| A generic "TimedEffect" or "Cooldown" engine abstraction/class layer | The codebase's convention throughout is bespoke, explicit fields per effect (`c.haste`, `c.invis`, `c.ward.rounds`, `f.cd[id]`, `it.usedAt`/`it.every`) rather than a shared runtime abstraction — this keeps every field independently serializable, independently parity-carve-out-able, and greppable; a generic class would fight the plain-JSON-object contract `engine/state.js`'s `structuredClone` round-trip and the parity comparators both depend on | Follow §1–§3 above: squares-based fields keyed on `state.steps`/`it.usedAt`, round-based fields keyed on `state.combat.*`/a per-ability `cd` map, exactly like the four precedents already shipped |
| Any monetization/analytics/ad SDK, or any network-capable package | Out of scope for this milestone specifically because it is out of scope for the whole project (`PROJECT.md` Constraints: paid-upfront, no ads/IAP, fully offline) — v1.5 touches no networking or monetization surface at all | Nothing — this milestone should end with the same zero-runtime-dependency `package.json` it started with (only `@capacitor/*` entries) |

## Version Compatibility

Not applicable — no new package versions are introduced. `package.json`'s existing dependency set (`@capacitor/android`, `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/screen-orientation`, `@capacitor/splash-screen`, `@capacitor/status-bar`, all `^8.x`) is untouched by this milestone's scope; `node --test` requires only the already-pinned `"node": ">=22"` engines field (`package.json:27-29`).

## Sources

- Direct inspection of `C:\projects\mazeworld\engine\movement.js` (lines 79-95, 293-294, 330-339) — squares-based haste/invis/flight cooldown ticking (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\engine\items.js` (lines 774-870) — `itemReady`/`useItem`'s squares-based `every`/`usedAt` cooldown convention and its refusal-ladder narration (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\engine\derived.js` (lines 1-40, 132-161, 197-259, 367-389) — `DEATH_PANIC_THRESHOLD`, `AFRAID_*` round-based tuning knobs, `isFlying`, `conditionsOf` (Shield/ward pool surfacing precedent), `afraidNeed`/`afraidDamage` (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\engine\foeAbilities.js` (lines 1-95) — `tickAbilityCooldowns`/`firstReadyAbility`'s per-entity `{id: roundsRemaining}` cooldown-map convention, the direct template for a hero-side activated-ability pool (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\content\spells.js`, `content\skills.js`, `content\potions.js`, `content\treasure-tables.js` — current data shapes (`combatOnly` flag, `use`/`every` fields already present on several CLOAKS/JEWELRY rows, STAVES missing `every`) (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\engine\state.js` (lines 1-231) — `newRun`'s feature-guard convention (`dev`, `storeRoll` booleans gating new rng draws/fields on old saves) (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\test\parity\harness\comparables.js` (carve-out function names/comments at lines 8-17, 153, 229-330, 508-516, 698-746) — the mandatory parity carve-out idiom for any new serialized field (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\test\unit\mapMarks.test.js` and `test\unit\shell-map-invariants.test.js` (source-assertion pattern via `fs.readFileSync` + regex) — the established substitute for canvas/visual testing (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\tools\tune-classes.mjs` (header, lines 1-40) — confirmed CLI usage, explicit "tuning proxy, not a gate" framing, no wrapping npm script (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\package.json` — confirmed dependency set is `@capacitor/*` only, `node --test` is the sole test runner, `node >=22` engines pin (CONFIDENCE: HIGH, primary source)
- Direct inspection of `C:\projects\mazeworld\.planning\PROJECT.md` (Constraints, Current Milestone v1.5 section) and `C:\projects\mazeworld\.planning\STATE.md` (Ground Truth / engine gate, decisions log) — milestone scope and non-negotiable engine-gate rules (CONFIDENCE: HIGH, primary source)

---
*Stack research for: Delve, Die, Repeat v1.5 (Meaningful Choices — Spells, Gear & Abilities)*
*Researched: 2026-09-17*
