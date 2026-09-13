# Stack Research

**Domain:** Foe abilities/spellcasting, bestiary rebalance, and a consolidated difficulty retune in a pure, deterministic, zero-runtime-dependency vanilla-JS roguelike engine (no bundler)
**Researched:** 2026-09-13
**Confidence:** HIGH (grounded in direct reads of `engine/magic.js`, `engine/combat.js`, `engine/difficulty.js`, `content/bestiary.js`, `content/spells.js`, `tools/tune-difficulty.mjs`, `tools/tune-economy.mjs`, `test/parity/harness/*`, `test/unit/content-tables.test.js`, `engine/rng.js`, `engine/derived.js`, `package.json`)

## Headline Finding

**Add zero new dependencies.** Every one of this milestone's three deliverables — foe abilities/spellcasting, bestiary rebalance, and the consolidated difficulty retune — is fully served by extending code and data shapes that already exist in this codebase, using the same patterns already proven across four prior milestones (Joiners, Economy, phobias/flight, item wiring). The project's own constraint ("zero runtime dependencies beyond Capacitor's own plugins," no bundler, `tools/build-www.mjs` plain concatenation) is not a limitation for this work — it's already the right shape for it.

## Recommended Stack

### Core Technologies (reused verbatim, no version change)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:test` + `node:assert/strict` (Node built-in) | Already pinned via `"engines": {"node": ">=22"}` | Lock the shape of new foe-ability/spell data and new engine behavior with fixed-seed fixtures | It is the ONLY test tool this codebase has ever used (683 tests, `test/unit`, `test/parity`, `test/determinism`, `test/roundtrip`, `test/difficulty`, `test/voice`) — no config, no transform, no bundler step; a second framework (Vitest/Jest) would fork tooling for zero functional gain and fight the zero-dependency constraint (CONFIDENCE: HIGH — direct inspection of `test/` tree and `package.json` scripts) |
| mulberry32 seeded RNG via `engine/rng.js`'s `makeRng()` | Already in `engine/rng.js`, no change | Source ALL new randomness — foe target selection, resist rolls, foe-spell damage/effect rolls | It's the single RNG stream the entire engine (and its parity/round-trip/determinism guarantees) is built on; its whole state is one 32-bit int that round-trips through `JSON.stringify`. Foe spellcasting needs "more of the same kind of roll" (a d20 resist check, a dice-notation damage roll) — not a new randomness primitive (CONFIDENCE: HIGH) |
| Dice notation `{n, sides, bonus}` + `rollDice(rng, dice)` from `engine/dice.js` | Already in use everywhere | Encode any new foe spell/ability damage, heal, or duration numbers | This is literally the existing data shape for `content/spells.js`'s `dmg` field and `content/bestiary.js`'s `sp.dmg` field already — a foe-ability table is a peer of tables that already exist, not a new format (CONFIDENCE: HIGH — confirmed by direct read of both files) |
| Plain ESM `content/*.js` object-literal modules, assembled by `tools/build-www.mjs` (no bundler) | Already in use | House new/rebalanced bestiary rows and any new foe-ability/foe-spell table | Content is trusted, in-repo, author-time JS, hand-validated by `node:test` assertions (`test/unit/content-tables.test.js`) — directly extensible with zero build-step change (CONFIDENCE: HIGH) |

### Supporting Libraries

**None needed.** There is no gap in the current toolkit that a new npm package would close for this milestone. See "What NOT to Use" below for the specific temptations (schema validators, a second RNG, property-based testing, YAML/content pipelines) and why each is a worse fit than what's already here.

### Development Tools (extend existing scripts, don't add new tools)

| Tool | Purpose | Notes |
|------|---------|-------|
| `tools/tune-difficulty.mjs` (existing) | Re-run after foe abilities/bestiary rebalance land, to read the shift in death-depth/action-count distributions | Its `decideAction()` heuristic bot currently only reasons about wp ratio + `canParley()` — it has no awareness that a `caster`-flagged foe exists. **Update the heuristic** (e.g. flee/parley sooner against a foe whose `sp.caster` is true) so the bot doesn't understate new offensive-spell lethality; the script's own header already warns "a heuristic bot's play skill is arbitrary" — this is exactly the kind of drift that warning anticipates. This is a heuristic tweak to an existing file, not a new dependency |
| `tools/tune-economy.mjs` (existing) | Run alongside the above for the SAME seeded batch, since kill-XP/loot (`killFoe` in `engine/combat.js`) and monster power move together | Reuses the identical auto-play policy skeleton; no changes needed beyond keeping both scripts' `decideAction()` heuristics in sync if one is updated |
| `test/unit/content-tables.test.js` (existing pattern) | Lock the shape and known values of any new/rebalanced content table (a `content/foe-abilities.js` or extended `content/bestiary.js` `sp` blocks) | Follow the exact existing style: `assert.deepStrictEqual` spot-checks on specific rows/counts (see its Bat/Rat, Drake, Fireball, Mangle checks) — this already fills the role a schema-validation library would, at zero dependency cost |
| `test/parity/harness/comparables.js` + `diffState.js` (existing pattern) | Gate every new foe-cast RNG draw against the frozen `prototype-master.js.txt` without ever editing it | New RNG draws for foe casting are, by construction, NOT in the frozen prototype (foes never cast there) — they must be added behind a documented carve-out in `comparables.js`, exactly like the existing `stripDarkForField`/`reconcilePendingFind` carve-outs for other new-field additions. This is the established mechanism for "new engine behavior + still parity-gated" |
| Node's built-in `node:test` snapshot assertions (`t.assert.snapshot`, stable since Node ~22.3) | Considered and explicitly NOT recommended here | The project already has a stronger, purpose-built, documented golden-master diff harness (`test/parity/harness/*`) that snapshot testing would duplicate or, worse, silently compete with (two different "expected output" sources of truth) — not worth introducing for this milestone |

## Installation

```bash
# No installation needed. package.json is not expected to change for this milestone.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Single mulberry32 stream via `engine/rng.js` for foe-cast rolls too | A second seeded RNG (`seedrandom`, `chance.js`, `random-js`) dedicated to foe AI/casting | Never here — a second stream breaks the single-32-bit-int serializable save format (ENG-02/04) and desyncs the golden-master parity comparator. Only relevant if the engine's RNG architecture were being rebuilt from scratch, which it is not |
| `node:test` + `assert.deepStrictEqual` shape-locking for new content tables | JSON-schema/runtime validators (`ajv`, `zod`, `joi`, `superstruct`) | If content were loaded from an untrusted external source at runtime (a moddable game, user-authored JSON/YAML) — not the case: every content table is trusted, versioned, in-repo JS compiled at author-time, never `fetch`/`JSON.parse`'d at runtime |
| Hand-rolled `percentile`/`distribution` helpers already in `tune-difficulty.mjs`/`tune-economy.mjs` | A stats library (`simple-statistics`, `d3-array`, `mathjs`) for the retune's Monte-Carlo reporting | Only if the retune genuinely needs statistics beyond min/p50/p90/max (e.g. histograms, stddev, correlation between ability-bearing-foe rate and death depth) — plausible LATER if a first pass proves inconclusive, but not a day-one need |
| Plain `content/*.js` object literals for any new foe-ability/spell table | A declarative ability DSL, or YAML/JSON content loaded via a build step (`js-yaml` + loader) | If the game needed hot-reloadable or player-moddable content post-ship — explicitly out of scope for an offline, paid, closed-content roguelike; also breaks the no-bundler build (`tools/build-www.mjs`) |
| Fixed-seed fixtures in `test/parity`/`test/determinism` (existing pattern) for "does foe casting stay deterministic" | Property-based testing (`fast-check`, `jsverify`) fuzzing seeds/action sequences | Property-based testing optimizes for finding UNKNOWN edge cases via random generation — the opposite of what a frozen, byte-identical golden-master suite needs (exact reproduction of KNOWN seeds/sequences). Would also add a second testing paradigm and a new devDependency for a suite explicitly designed to never randomize its own inputs |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Any JSON-schema/runtime-validation library (`ajv`, `zod`, `joi`, `superstruct`) for the new foe-ability/spell table | Every content table here is trusted, in-repo, author-time JS — never parsed from an external or untrusted source at runtime. Adding a validator library pays a dependency+bundle cost to re-implement what `node:test` already does at zero runtime cost, and directly contradicts CLAUDE.md's "zero runtime dependencies beyond Capacitor's own plugins" | Extend `test/unit/content-tables.test.js` (or a sibling `test/unit/foe-abilities-tables.test.js`) with `assert.deepStrictEqual`/shape spot-checks, exactly like the existing BESTIARY/SPELLS checks |
| A second RNG (`seedrandom`, `chance.js`, `random-js`, or `crypto`-backed randomness) for foe-cast rolls | The engine's entire determinism/parity/save-round-trip guarantee rests on ONE seeded mulberry32 stream per `GameState`, serialized as a single 32-bit int (`engine/rng.js`). A second stream — even seeded — either desyncs the golden-master parity comparator or forces a second serialized rng cursor into every save, a much bigger architecture change than this milestone calls for | Draw every foe-cast roll from the SAME `rng` already threaded through `applyAction`, in a new, carefully documented consumption position — matching `engine/magic.js`'s own header precedent ("in the prototype's exact consumption order, including its short-circuiting guards") |
| Property-based testing (`fast-check`, `jsverify`) to "prove" foe casting doesn't break determinism | Generates random inputs to hunt edge cases — directly at odds with a frozen, byte-identical golden-master fixture suite that must reproduce EXACT known seeds/action sequences, not arbitrary ones. Adds a devDependency and a second test paradigm alongside `node:test` for no gain the existing pattern doesn't already give | Add new fixed-seed fixtures to `test/parity/*` (following `magic-parity.test.js`/`combat-parity.test.js`) that specifically drive a caster foe, plus new `test/determinism/*` cases (same seed + same actions, twice, assert identical) |
| A YAML/JSON content-authoring pipeline (`js-yaml`, a custom loader, a new "content build" step) for foe abilities or rebalanced bestiary numbers | `tools/build-www.mjs` is a deliberate no-bundler concatenation step; adding a second content-compilation stage for a table that's currently ~120 lines of plain JS objects forks the build model for no real benefit at this content volume | Keep editing `content/bestiary.js` (or a new `content/foe-spells.js`) directly as ESM object literals, exactly like every other content table |
| Upgrading `tools/tune-difficulty.mjs`/`tune-economy.mjs` into a CI-gating pass/fail check | Both scripts' own headers are explicit: "a tuning proxy, not a pass/fail gate" — a heuristic bot's play skill is arbitrary (too eager to flee understates lethality, too reckless overstates it). Gating a build on it manufactures false confidence about a curve that still needs the deferred human playtest | Keep both as manual, human-read dev scripts (`node tools/tune-difficulty.mjs --seeds=200 --json`); run before/after the retune and eyeball the reported distributions, exactly as already documented |
| A stats/Monte-Carlo dependency (`simple-statistics`, `d3-array`, `mathjs`) for the difficulty retune's reporting | The existing hand-rolled `percentile`/`distribution` functions (~15 lines) already answer the retune's real questions (does death-depth shift, does action-count balloon, does the death-cause mix change). Pulling in a library to compute a percentile is a dependency for arithmetic already written | Extend `printReport`/the `--json` shape in `tune-difficulty.mjs`/`tune-economy.mjs` in place, hand-rolling any genuinely new statistic the same way |

## Stack Patterns by Variant

**If foe spellcasting needs to bypass the player-only grimoire/subclass gating:**
- `engine/derived.js`'s `canCast()`, `schoolGate()`, and `schoolBonus()` all read `c.sub`, `c.grimoire`, and `c.level` — fields a BESTIARY foe object (`{name, type, lvl, size, intel, wp, maxWP, alive, asleep, sp, lives}`, per `startCombat()` in `engine/combat.js`) does not have and should not be given (that would mean simulating a full character sheet per monster). Rather than writing a parallel, drift-prone copy of `castSpell`'s per-`sp.kind` effect branches for foes, factor the SHARED effect body out of `engine/magic.js`'s big if/else chain into a caster-agnostic internal helper, and add a new `foeCast(state, foe, spellRef, rng, events)` entry point that calls it directly — skipping the player-only charge/grimoire/backfire checks entirely (a foe doesn't have `c.spellsUsed`/`c.grimoire` either). This is a same-file refactor, zero new dependencies, but it is the single biggest design fork this milestone faces — flag it explicitly to whichever phase actually implements foe casting, not just this stack note.

**If a foe's spell selection needs its own small data table:**
- Reuse the exact dice-notation/kind vocabulary already in `content/spells.js` — don't invent a second damage-encoding format. Several BESTIARY entries already carry a `caster: true` flavor flag with descriptive text implying a level range ("casts every spell of levels 1 to 4" for Djinni/Krupke; "master of every offensive spell" for Vampire; "casts every offensive spell, 1 to 4, without limit" for Drudge) — per `engine/combat.js`'s own header, these flags are currently "flavor-only... never read anywhere in mazeworld.html's live logic." Wiring them means either (a) pointing a `caster`-flagged BESTIARY entry at a filtered slice of the existing `SPELLS` array (by `lvl` range and `kind === offense-ish`), or (b) only if foe damage numbers must diverge from the player's own spellbook, adding a small parallel `content/foe-spells.js` in the identical shape. Prefer (a) first — it's rulebook-canon-aligned (the creature descriptions already say "every spell of levels 1 to 4") and adds no new table at all.

**If the difficulty retune needs to weigh ability-bearing foes differently from plain strikers:**
- `engine/difficulty.js` must stay a pure function of `depth` alone — its own header is explicit that it "consumes NO rng and touches NO DOM" and sits "BEFORE genFloor" with zero knowledge of combat. Do NOT thread foe-ability power into `difficultyCurve()` directly. Foe power scaling already lives in `startCombat()`'s level/roster selection (`engine/combat.js`); let the new ability data ride on each BESTIARY entry there, and let `tools/tune-difficulty.mjs`'s auto-play harness surface the AGGREGATE effect (shifted death-depth/action-count distributions) for hand-tuning — the existing separation of concerns (difficulty curve = floor generation knobs only; combat/bestiary = monster power) should hold exactly as documented.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Node.js `>=22` (`package.json` `engines`) | `node:test` / `node:assert/strict` (built-in) | No change — nothing new is added, so no third-party version pairing needs verification for this milestone |
| `engine/rng.js` mulberry32 stream | Every serialized `GameState` (saves, parity fixtures, round-trip tests) | Any new foe-cast RNG draw must be inserted at a specific, documented point in the existing call order (mirroring `engine/magic.js`'s header precedent) — this is a code-ordering discipline, not a package-version concern, but it is the load-bearing constraint this whole milestone must respect |

## Sources

- Direct inspection of `engine/magic.js`, `engine/combat.js`, `engine/difficulty.js`, `engine/rng.js`, `engine/derived.js`, `engine/dice.js` — CONFIDENCE: HIGH (primary source, direct code read)
- Direct inspection of `content/bestiary.js`, `content/spells.js` — CONFIDENCE: HIGH (primary source, direct code read)
- Direct inspection of `tools/tune-difficulty.mjs`, `tools/tune-economy.mjs` — CONFIDENCE: HIGH (primary source, direct code read)
- Direct inspection of `test/unit/content-tables.test.js`, `test/parity/harness/comparables.js`, `test/parity/` directory structure — CONFIDENCE: HIGH (primary source, direct code read)
- Direct inspection of `package.json` (dependencies, devDependencies, scripts, engines) — CONFIDENCE: HIGH (primary source, direct code read)
- `.planning/PROJECT.md`, `.planning/proposed-milestone-monster-balancing.md` — milestone scope, canon/parity constraints — CONFIDENCE: HIGH (primary source)

---
*Stack research for: Delve, Die, Repeat — v1.1 Monster Balancing & Abilities*
*Researched: 2026-09-13*
