# Phase 21: Consolidated Difficulty Retune - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 16 proposals across 4 areas, all accepted by the user. Sign-off mode chosen by the user: **bot-tune first, then ONE on-device DR round** (TUNE-04), with "tune again" = one quick constants pass + a second DR round.

<domain>
## Phase Boundary

Run the ONE retune across party power, economy, monster power, ability threat, and parley numbers so a run still targets a 5–10 minute session and a bounded soft-cap descent to floor 30–50+ — closing PARTY-10, ECON deep tuning, and Phase 3 feel-tuning as this milestone's single tuning exercise, signed off by human play. Requirements: TUNE-01, TUNE-02, TUNE-03, TUNE-04. Touches `engine/difficulty.js` (new combat-scaling knobs), `engine/combat.js#startCombat` (reads the curve), `engine/foeAbilities.js#firstReadyAbility` (ability cadence), `engine/state.js#newRun` (+ `startDepth` dev option), `engine/saveState.js` + `test/parity/harness/comparables.js` (the `dev` flag), economy constants (`engine/items.js#LOOT_DIVISOR`, purse table, store price scaling, wilmst cache row, parley Humans bonus amount), party hire/upkeep constants, `tools/tune-difficulty.mjs` + `tools/tune-economy.mjs` (bot upgrade + tallies + reach table), `mazeworld.html` (hidden dev start-at-depth toggle; graveyard exclusion), `docs/DIFFICULTY-RETUNE.md` (ledger + DR checklist). Out of scope: bestiary base stats (Phase 18's ledger stands), class/race/sub-class features, new screens beyond the hidden dev toggle, the next milestone's feedback pass.

**Grounding facts (codebase scout, 2026-09-14):**
- The tuning bot (`tools/tune-difficulty.mjs`) only attacks / flees-or-parleys below 30% wp / explores / leaves stores. Its 200-seed readout after Phase 20: death depth **min 1, p50 1, p90 2, max 4**; actions p50 185. It never casts, drinks, camps, buys, or hires — as a proxy for floor 30–50 it is currently blind (18-06 already noted it "never reaches the tier-4/5 creatures").
- Monster power stops scaling at depth 5: `startCombat` clamps `maxLvl = clamp(min(c.level, depth), 1, 5)` and foe count `cap = c.level <= 2 ? 2 : 3` with the prototype's short-circuit `d4`/`d4` draw. Past floor 5 only encounter dots (`ENCOUNTER_DOT_*`, soft-capped) and darkness (`DARK_*`) grow via `difficultyCurve(depth)`; `difficulty.js` is read by `maze.js` and `movement.js` only — there is no combat-scaling knob yet (TUNE-01 must create it).
- Parity is safe by construction for anything gated on depth ≥ 2 or character level ≥ 2: every fixture is a level-1 character on floor 1 (`test/parity/FIXTURE-INVENTORY.md`), so new terms that are identity at depth 1 / level 1 need zero carve-outs.
- No "start at depth N" affordance exists (`newRun(seed)` always `genFloor(1, rng)`), so a human cannot reach floor 20–50 inside a 5–10 minute session for the TUNE-04 sign-off.
- Deferred-to-21 items on record: Humans parley wilmst bonus AMOUNT (20-CONTEXT D-03/deferred), canon-mode consequences for Sterling + five `sp.ar` creatures and any tier-4/5 buff (18-06 / `content/BESTIARY-REBALANCE.md`), one-round-ahead bolt telegraph if bolts feel unfair (19-CONTEXT deferred), party members resisting spells (19 deferred → FOE-V2).

</domain>

<decisions>
## Implementation Decisions

### Depth Scaling Model (TUNE-01)
- **D-01:** `engine/difficulty.js#difficultyCurve(depth)` gains combat-scaling fields — `foeCap` (max foes per encounter), `foeLvlBias` (reserved; 0 unless the retune needs it), `foePower` (multiplier applied to foe `wp`/`maxWP` and flat damage bonus), `abilityThreat` (cadence scalar for caster kits) — alongside the existing floor-generation knobs. `engine/combat.js#startCombat` reads ONLY the curve for these (no depth math of its own beyond the canon `maxLvl` clamp). One source of truth.
- **D-02:** Threat past floor 5 grows two ways: **soft-capped foe count** (`foeCap`: 3 at ≤ 5 → asymptotically 5 by ~floor 30, using the existing `softCap` helper) and **soft-capped `foePower`** (1.0 at ≤ 5 → ~1.6 by ~floor 40), applied at `startCombat` copy time to the per-foe instance (`f.wp`, `f.maxWP`, flat `dmg` bonus) so `damageFoe`, the yardstick, and fixtures see plain numbers. The level-1 `cap = 2` rule and the prototype's `d4`/`d4` count draws are preserved; `foeCap` only raises the `Math.min` ceiling, so draw shape never changes.
- **D-03:** `abilityThreat` scales caster cadence by depth band: `firstReadyAbility` reads the curve and reduces effective `every` (e.g. 2 → 1 rounds between casts deep) / raises `uses` — the kits in `content/foe-abilities.js` are unchanged data. Zero effect at `abilityThreat === 1`.
- **D-04:** Parity discipline: every new term is **identity at depth ≤ 1 / level 1** (`foeCap` 2/3 as today, `foePower` 1.0, `abilityThreat` 1). A unit test pins `difficultyCurve(1)` to the exact pre-Phase-21 object plus the identity values, and the parity suite stays 30/30 with **zero new carve-outs** for scaling. (The only new carve-out in this phase is the D-14 `dev` flag.)

### Making the Bot a Usable Proxy (TUNE-02)
- **D-05:** The bot in BOTH tools gains four deterministic policies on the separate policy rng: **cast an attack spell** when the character has charges (Magic Users), **drink a healing potion** below ~50% wp when one is carried, **make camp** outside combat when wp < 50% and rations ≥ 1, **descend when the floor's encounter dots are cleared** (or after a bounded exploration budget). Store shopping and hiring stay out of scope for the proxy.
- **D-06:** Caster reaction: when any live foe has `abilities` and wp < 50%, prefer **parley** (if `canParley`) else **flee** — i.e. the flee threshold rises from 0.3 to 0.5 against caster groups.
- **D-07:** Ability tallies in both tools, text and `--json`: `foeCast`, `foeBolted`, `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `heroResisted`, `heroResistFailed`, plus damage-from-abilities as a share of all damage taken.
- **D-08:** Readout shape: death-depth distribution **plus** a reach table (% of runs reaching floors 5 / 10 / 20 / 30 / 50), median actions per floor (session-length proxy), and per-depth-band caster-encounter rate. Committed BEFORE (post-Phase-20 engine, upgraded bot) and AFTER, verbatim, in the ledger.

### Targets & the One Retune (TUNE-03)
- **D-09:** Harness targets (a sanity floor, never the exit criterion), measured with the upgraded bot at 200 seeds: **median death depth 8–15**, **p90 ≥ 25**, **< 2% of runs past floor 50**, **median 40–80 actions per floor** (≈ 3–6 floors per 5–10 minute session).
- **D-10:** Constants in scope for the single pass: `difficulty.js` (new D-01 knobs + existing dot/dark knobs), the party-power counterweight (hire cost / upkeep by depth; PARTY-06's XP-share damping stays primary — PARTY-10), economy deep-band numbers (`LOOT_DIVISOR`, the purse table, store price scaling, the wilmst cache row, the parley Humans bonus amount `d6 × 100 × depth` — ECON), ability cadence via `abilityThreat`. **NOT** in scope: bestiary base stats (Phase 18's ledger stands), class/race/sub-class features.
- **D-11:** Method: one committed ledger `docs/DIFFICULTY-RETUNE.md` — BEFORE readout → change table with a rationale per knob → AFTER readout; at most **two** harness iterations to land inside D-09, then stop (the DR round decides the rest). Every change to a fixture-exposed path is gated on depth/level so the parity suite stays byte-identical.
- **D-12:** Party power: the bot doesn't hire, so add a `--party` harness flag that starts the run with one hired member (deterministic, via the public action surface); retune **hire cost and upkeep by depth** only if the `--party` readout blows past the soft cap relative to solo.

### The Sign-off DR Round (TUNE-04)
- **D-13:** Dev-only **"start at depth N"**: a hidden Settings affordance (long-press the version line reveals a depth field) that starts a new run via `newRun(seed, { startDepth })` — generates floor N, levels the rolled character to the SP threshold for `min(N, 5)` (same `checkLevel` path, no new rng draws in chargen), and grants a depth-scaled purse via the existing wilmst-cache row. The run is flagged `state.dev = true` and is **excluded from the graveyard and high score**. Never reachable in normal play.
- **D-14:** Parity/save discipline for the dev start: `startDepth` defaults to 1 and every fixture calls `newRun(seed)` → byte-identical; the `dev` flag is a new serialized top-level field → stripped in all three `*Comparable()` fns and tolerated by `validateSave`/`rehydrate` (absent = false), mirroring the `c.bag` / `darkFor` precedent.
- **D-15:** The DR checklist lives in `docs/DIFFICULTY-RETUNE.md`: **three runs** at depths **20, 35, 50** — for each: session-length feel, one caster fight (bolt / drain / debuff legible, resist feels fair), one parley attempt + one failure, party hire affordability, and "did the run end for a reason I understood"; the user reports per-run notes and a **pass / tune-again** verdict. The phase's VERIFICATION ends `human_needed` on exactly this item.
- **D-16:** If the verdict is "tune again": ONE follow-up `/gsd-quick` pass editing only `difficulty.js` constants (+ a ledger addendum), then a second DR round. No re-plan. If "pass": TUNE-04 closes the milestone's deferred UAT.

### Research-resolved follow-ups (orchestrator, 2026-09-14)
- **D-17 (supersedes the mechanism in D-02, not the intent):** `startCombat`'s count roll `Math.min(cap, d4 <= 2 ? 1 : d4 <= 3 ? 2 : 3)` physically maxes at 3, so raising `foeCap` alone is a silent no-op. Implement the deep-floor count growth as a **zero-new-draw additive bonus** derived from the curve and applied AFTER the canon roll (e.g. `n = Math.min(foeCap, rolled + curve.foeBonus)` where `foeBonus` is 0 at depth ≤ 5). The d4/d4 draw shape and the level-1 `cap = 2` rule stay byte-identical.
- **D-18:** `tickAbilityCooldowns(f)` becomes `tickAbilityCooldowns(state, f)` (one call site in `foeTurn`) so `abilityThreat` can be read from the curve; `firstReadyAbility(state, f)` already receives `state`.
- **D-19:** The identity boundary for `foeCap`/`foeBonus`/`foePower`/`abilityThreat` is **depth ≤ 5** (not just depth 1): the D-15 determinism seeds in `test/determinism/foe-abilities.test.js` force tiers 2/4/5 and must stay byte-identical, as must the FID-02 pins. A unit test pins `difficultyCurve(d)` identity values for d = 1..5.
- **D-20 (resolves research A1 — narrows D-10/D-12):** There is NO hire mechanic — party members join for free via a random Joiner encounter (`resolveJoiner(true)`). "Hire cost" is therefore OUT of scope (nothing to retune); the party counterweight remains PARTY-06's XP-share damping plus member **upkeep** if/where it exists (`content/races.js` `upkeep`). `--party` in the harness: force one member at run start — via the public action surface if a Joiner can be offered deterministically, otherwise via a documented direct engine import (the tools already import `canParley` from `engine/combat.js`, so the "public surface only" rule has a precedent for read-only helpers; a write-path bypass must be clearly commented as harness-only). Report member presence in the readout.
- **D-21 (resolves research A2 — narrows D-10):** There is NO store price scaling by depth (`openStore` reads depth only for the premium item's enchant roll). Adding one would be a new mechanic → OUT of scope. If the economy readout shows deep-band wilmst inflation, tune the existing depth-scaled sources instead (wilmst cache row, `LOOT_DIVISOR`, purse table, the parley Humans bonus amount).
- **D-22 (resolves research A3 — implements D-13):** No version line exists in the Settings sheet and no reusable long-press helper exists outside the map viewport. Add a small version line (app version from `package.json`/`android/version.properties` via the build) at the bottom of the Settings sheet — useful in its own right — and a minimal long-press (≈1.2 s pointerdown/up) on it that reveals the dev "start at depth" field. No new screen.
- **D-23 (researcher open questions):** the bot policy is a **shared module** (`tools/lib/tuning-bot.mjs` or similar) imported by both tools so D-05/D-06 land once; the `dev` flag is **boolean-coerced** in `saveState.js` like `dead`/`won` (absent → false) and stripped in all three comparables.

### Claude's Discretion
- Exact soft-cap constants / `k` values for `foeCap`, `foePower`, `abilityThreat` and the depth bands — chosen during the retune against D-09, recorded in the ledger.
- Where `foePower` applies its damage bonus (flat `+n` on `pursuer.lvl*lvl` base vs. multiplying `sp.dmg` dice) — must not add draws and must respect `damageFoe` being the only foe-wp decrement seam.
- Bot exploration budget per floor before descending, and the exact potion/camp thresholds.
- The hidden-toggle gesture and the dev-run visual marker (a small "DEV" chip is fine; no new screen).
- Test file layout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/difficulty.js` — `softCap(base, cap, d, k)`, `isBreather`, `difficultyCurve(depth)`; the natural home for the new knobs (D-01).
- `engine/combat.js#startCombat` (~L98–140) — `maxLvl` clamp, `cap`, the short-circuit `d4`/`d4` count draw, per-foe instance copy (Phase 19 copies `abilities` here) — the place `foePower`/`foeCap` apply.
- `engine/foeAbilities.js#firstReadyAbility` / `tickAbilityCooldowns` — cadence read for `abilityThreat` (D-03).
- `engine/state.js#newRun(seed)` → `genFloor(1, rng)`; `engine/character.js#checkLevel` / SP thresholds for the D-13 level-up.
- `tools/tune-difficulty.mjs` (`decideAction`, `autoPlayOnce`, separate `policyRng`, `--seeds`, `--json`, Phase 20 parley tally) and `tools/tune-economy.mjs` (`goldGained.why` tallies) — extend, don't fork; the 18-06 / 20-01 / 20-03 backgrounded-readout precedent (`EXIT=` sentinel).
- `test/parity/harness/comparables.js` strippers (`stripBagField`, `stripFoeEffectField`) for the `dev` flag (D-14); `saveState.js` tolerance precedent (`clearFoeEffect`).
- `docs/PARLEY-REBALANCE.md` / `content/BESTIARY-REBALANCE.md` — ledger format to mirror for `docs/DIFFICULTY-RETUNE.md`.
- `mazeworld.html` Settings panel + version line; graveyard write path (`src/browser/` storage) for the D-13 exclusion.

### Established Patterns
- Engine pure/deterministic; new behaviour gated so depth-1/level-1 fixtures are byte-identical; no new draws on fixture paths.
- New serialized fields → comparables strippers + save tolerance; every new event type → `EVENT_NARRATION` (none expected this phase beyond a possible `devRunStarted` marker — if added, narrate it).
- Tuning tools are proxies, never CI gates (their headers say so) — keep it that way.
- "DELIBERATE RULES CHANGE" comment blocks at change sites.

### Integration Points
- `startCombat` ↔ `difficultyCurve`; `firstReadyAbility` ↔ `difficultyCurve`; `newRun` ↔ hidden Settings toggle ↔ graveyard exclusion; both tuning tools ↔ the ledger.

</code_context>

<specifics>
## Specific Ideas

- The user's next-milestone brief ("Feedback, Feel & Polish") says early combat is brutal and that's OK — the retune should keep floors 1–3 dangerous but readable, and spend its effort on making floors 6–50 *scale* (today they don't) rather than softening the start.
- The DR round is the exit criterion; the bot numbers only earn the right to ask for it.

</specifics>

<deferred>
## Deferred Ideas

- Canon-mode consequences for Sterling and the five `sp.ar` creatures (18-06) — revisit only if the DR round flags them; otherwise next milestone.
- One-round-ahead bolt telegraph (19 deferred) — only if the DR round says bolts feel unfair.
- Party members resisting spells / member `intel` — FOE-V2.
- Bot store shopping / hiring policies — proxy scope creep; not needed for the sanity floor.
- A player-facing "start deeper" mode (New Game+) — v2 idea; the D-13 toggle is dev-only by design.

</deferred>
