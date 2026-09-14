# Phase 20: Parley Balance & Language System - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 16 proposals across 4 areas, all accepted by the user

<domain>
## Phase Boundary

Parley pays fairly, can no longer be spammed for free, keeps the Con Artist subclass viable, and Language / Helm-of-Knowledge fluency is wired into the same parley `bonus` term so it isn't balanced twice. Requirements: PARLEY-01, PARLEY-02, PARLEY-03, PARLEY-04, LANG-01, LANG-02. Touches `engine/combat.js` (`canParley`, `parley`, `foeTurn` insulted read, `startCombat` flag init), `engine/derived.js` (new pure `fluency(c)` + shared combat-equivalent SP helper), `src/browser/eventNarration.js` (new lines), `mazeworld.html` (parley button hides after the encounter's one attempt), the parity harness (scenario-scoped carve-out), `test/parity/FIXTURE-INVENTORY.md`, `tools/tune-difficulty.mjs` (readout only). Out of scope: any difficulty-dial / economy-number retune (Phase 21), the Humans wilmst bonus AMOUNT (economy owns it), Con Artist's pre-fight talkdown (unchanged), the next milestone's broader feedback pass.

**Grounding facts (from the codebase scout, 2026-09-14):**
- `killFoe` pays `round(d6 × f.lvl × 5 × raceSpMul × (Barbarian 0.5) × (Apprentice<3 ×2))` per foe; `parley` pays `round(Σ(d6 × f.lvl) × 2.5)` — i.e. parley ALREADY pays ~half the kill SP (the prototype's own line: "Half the skill points for none of the blood"). The 2.5× premise in the v1.1 planning notes was a misread; the real over-generosity is the Humans wilmst bonus (50% chance of `d6 × 100 × depth` vs a ~`d10 × lvl × 12 / 10` kill purse), plus zero risk and unlimited free retries.
- Parity exposure: `test/parity/fixtures/action-script.combat.json` scenario `parley` (seed 303) is a **Con Artist Wilmsry** L1 vs Dante ×2 (Humans L1): bonus 6+4+1−1 = 10 → need 19; roll 2 → success; sp 13, gold 200. Any odds/payout change diverges from the frozen prototype for this scenario. Phase 18's zero-carve-out approach (D-14/D-15) is NOT available here; the ROADMAP v1.1 gate explicitly allows a documented parley divergence.
- `canParley` gates today: Con Artist (any non-WD/Magical), Woodsman (Beasts/Lair Beasts), Bard (Humans), Language skill OR Helm `tongue` (TALKATIVE = Humans/Demons/Lair Beasts/Beasts), Wilmsry (non-Magical), Elven (Humans). The `parleyRefused wilmsryVsMagical` branch in `parley()` is dead (canParley already excludes Magical).
- Failed parley today: `afterPlayerAction` gives the foes one turn; retry is unlimited.
- Con Artist also has a pre-fight talkdown in `startCombat` (`f.lvl <= 1 && d6 <= 4` → foe leaves), fixture-exposed at seed 303.

</domain>

<decisions>
## Implementation Decisions

### Payout & Combat-Equivalent (PARLEY-01)
- **D-01:** "Combat-equivalent value" = the exact `killFoe` SP formula per live foe, summed: `Σ round(d6 × f.lvl × 5 × raceSpMul × subMul)`. Extract it into ONE shared pure helper (e.g. `killSpFor(c, f, roll)` in `engine/derived.js` or a combat-local helper) that BOTH `killFoe` and `parley` call, so the ≤ relationship is structural. `killFoe`'s own draw/result must stay byte-identical (every combat fixture pins it).
- **D-02:** SP payout ratio stays **0.5×** the combat-equivalent (canon "half the skill points"), now computed as `round(combatEquivalent × 0.5)` rather than the literal `× 2.5`. Test: parley payout ≤ combat-equivalent for every roll (property-style over all d6 values / foe levels).
- **D-03:** Humans wilmst bonus fires on **`d6 === 6`** (~17%, down from `d6 >= 4` = 50%). The amount formula `d6 × 100 × depth` is untouched (economy owns the number; Phase 21 may retune).
- **D-04:** Draw shape unchanged: one `d6` per live foe for SP, then one `d6` wilmst check, then one more `d6` only if it fires. Only VALUES diverge from the prototype, never the rng stream position for a given outcome.

### Cost of Failure & Con Artist Odds (PARLEY-02, PARLEY-03)
- **D-05:** **One parley attempt per encounter.** New serialized combat flag `C.parleyTried` (set true on any attempt, success or failure; initialised false/absent at `startCombat`). `canParley` returns false once tried → the Parley button disappears and a re-sent `parley` action is rejected with a `parleyExhausted` event (no rng draw). Plus, on failure, the foes still get their free turn via `afterPlayerAction` (as today).
- **D-06:** Aggro on failure: a failed parley marks the group **insulted** — new serialized flag `C.parleyInsulted = true`; while set, every foe to-hit roll in `foeTurn` gets **+1** for the rest of the fight (applied as post-draw arithmetic on the existing roll — zero extra draws). Emits `parleyInsulted` (narrated). Cleared with the combat object at `endCombat`.
- **D-07:** Con Artist parley bonus **+6 → +4**. Documented target: **~60% success at even level vs a solo foe** (need = 9 + 4 + level − top = 13 → 13/20 = 65% at even level; ~60% once a typical +1 top-foe gap is included). Still the best talker in the game; the level-1 pre-fight talkdown is untouched.
- **D-08:** Sub + race bonuses stack as canon (Con Artist Wilmsry ≈ 4+4 = +8 → need 17 at even level), but `need` is **clamped to ≤ 17** (85% ceiling) so no combination is an auto-win. Clamp is arithmetic on `need` only (no draw change).

### Language as Fluency (LANG-01, LANG-02)
- **D-09:** New pure helper `fluency(c)` in `engine/derived.js`: **0** = neither; **1** = Language skill OR Helm of Knowledge (`eff(c,"tongue") > 0`); **2** = both. Single source of truth for BOTH the availability gate and the bonus term. `skill()`/`eff()` reads only — no rng, no mutation. Data keys `Language` / `tongue` are NOT renamed.
- **D-10:** Bonus term (Option B): `+2 × fluency(c)` added into the same `bonus` sum (skill alone +2, Helm alone +2, both +4), before the D-08 clamp. The prior "Language OR Helm" boolean gate line in `canParley` is replaced by the fluency read.
- **D-11:** Encounter types opened by fluency: **fluency ≥ 1** → the existing TALKATIVE set (Humans, Demons, Lair Beasts, Beasts); **fluency 2** → additionally **Magical** ("perfect fluency in one language"). **Walking Dead never parley** for anyone (rulebook line stands). Availability test matrix: every race × sub × {no skill, skill} × {no Helm, Helm} × encounter type.
- **D-12 (PARLEY-04):** The dead `parleyRefused wilmsryVsMagical` branch is **made reachable, not deleted**: a Wilmsry with fluency 2 passes `canParley` for Magical (D-11), and `parley()` then refuses with the canon grudge line ("Magic Users hate the Wilmsry. There is nothing to discuss.") — no rng draw, and it does NOT consume the D-05 attempt (it is a refusal, not an attempt). Every `canParley` gate — including this one — gets explicit test coverage.

### Parity Divergence, Feedback & Tuning Proof
- **D-13:** Deliberate divergence handled as a **scenario-scoped carve-out**: a named stripper (e.g. `stripParleyDivergence`) applied ONLY to the combat fixture's `parley` scenario, removing `c.sp`, `c.gold`, and the new `C.parleyTried` / `C.parleyInsulted` flags from the comparison. Everything else in that scenario stays compared (the `canParley` gate, `combatEnded`, the prototype's draw shape). `test/parity/FIXTURE-INVENTORY.md` gains a before/after table for seed 303 (need 19 → 17 after D-07/D-08; sp 13 → new value; gold 200 → new value/none) with rationale. The other four combat scenarios, all other fixtures, `prototype-master.js.txt`, and the FID-02 draw pins stay byte-identical; the fixture-inventory pin is unchanged (roster didn't move).
- **D-14:** New narrated events (each with an `EVENT_NARRATION` line in the game's voice, family-friendly): `parleyInsulted` (failure aggro), `parleyExhausted` (retry refused / button gone), and the `parleyRolled` line now shows the fluency contribution when non-zero (e.g. "need 15 (+2 tongue)"). The success line reflects the reduced wilmst odds. `parleyRefused` keeps its canon text.
- **D-15:** Tuning proof: extend `tools/tune-difficulty.mjs`'s bot to REPORT parley attempts / successes / SP-from-parley share per run, and commit a before/after readout (informational, like 18-06). **No dial or economy-number changes in this phase** — Phase 21 owns the one consolidated retune.
- **D-16:** Con Artist's pre-fight `lvl ≤ 1` talkdown in `startCombat` is untouched (identity + fixture-exposed at seed 303; its `d6` draws stay exactly where they are). It is NOT gated by the one-attempt flag and does not scale with fluency.

### Claude's Discretion
- Exact home of the shared kill-SP helper (derived.js leaf vs. combat-local) — must not create an import cycle and must keep `killFoe`'s draw and result byte-identical.
- Whether `C.parleyTried` / `C.parleyInsulted` are initialised explicitly in `startCombat` or lazily on first write (either way: absent/false must be indistinguishable in the comparables carve-out and in save validation — old saves must load).
- Exact wording of the new narration lines and the fluency annotation format.
- Test file layout (extend `test/unit/combat.test.js` vs. a new `test/unit/parley.test.js`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js` `canParley(state)` (:602) and `parley(state, rng, events)` (:630) — the two functions this phase rewrites; `liveFoes`, `afterPlayerAction`, `endCombat`, `checkLevel` are reused as-is.
- `engine/combat.js` `killFoe` (:450) — the SP formula to extract into the shared helper (`5 × RACES[c.race].spMul × Barbarian 0.5 × Apprentice<3 ×2`).
- `engine/derived.js` — dependency-light leaf that already hosts `eff()`, `resistRoll` (Phase 19), `conditionsOf`; natural home for `fluency(c)`.
- `content/skills.js` `Language` (cost 1) and `content/treasure-tables.js` Helm of Knowledge `eff:{tongue:1}` — existing data keys, do not rename.
- `test/parity/harness/comparables.js` — established stripper pattern (`stripRationsField` is the precedent for a DELIBERATE permanent divergence; `stripFoeEffectField` / `stripFoeAbilityState` for new serialized fields). NOTE: `test/parity/combat-parity.test.js` keeps its OWN local `comparable()` (predates the shared harness) — the scenario-scoped stripper must be applied there.
- `test/parity/FIXTURE-INVENTORY.md` + `test/parity/fixture-inventory.test.js` (Phase 17) — where the before/after table lives; the roster pin must stay green.
- `tools/tune-difficulty.mjs` already imports `canParley` and has a parley-preferring bot policy (:115) — extend its readout.
- Existing parley tests: `test/unit/combat.test.js` :782 (gates), :801 (Con Artist success), :814 (failure → foe turn), :832 (LO-03 zero-foe guard).

### Established Patterns
- Engine pure/deterministic; rng only via the passed `rng`; new behaviour that changes VALUES must keep draw SHAPE where possible (D-04) and any new draw must be guarded (none planned here).
- New serialized fields → strip in the comparables (all three `*Comparable()` fns if the field can appear in their state) + `validateSave`/`rehydrate` tolerance (Phase 19's `clearFoeEffect` precedent).
- Every new event type → `EVENT_NARRATION` entry (coverage guard) + voice safety scan.
- "DELIBERATE RULES CHANGE" comment blocks at the change site explaining the canon deviation (04.2 / Phase 15 precedent).

### Integration Points
- `startCombat` (flag init), `foeTurn` (insulted +1 read, post-draw), `endCombat` (flags die with `state.combat`), `applyAction` validation for `parley` when exhausted.
- `mazeworld.html` action row: the Parley button is already rendered conditionally on `canParley()` — hiding after the attempt falls out of D-05 automatically; verify the bridged predicate is the engine's.
- `src/browser/eventNarration.js` for the three new/changed lines.

</code_context>

<specifics>
## Specific Ideas

- The user's brief for the NEXT milestone ("Feedback, Feel & Polish", `.planning/proposed-milestone-feedback-feel-polish.md`) makes "nothing happens silently" the through-line — D-14's narrated events are the first down-payment; make the exhausted/insulted lines unmistakable.
- Con Artist identity: "play the hand you're dealt" — keep them clearly the best talker (D-07) rather than flattening everyone to the same odds.

</specifics>

<deferred>
## Deferred Ideas

- Retuning the Humans wilmst bonus AMOUNT and any difficulty-dial consequence of parley being less lucrative → Phase 21 (consolidated retune).
- Non-parley uses of fluency (reading tablets/signs, comprehension flavor) → out of scope; note for a future content phase.
- "Can't flee for a round after insulting them" alternative aggro → not chosen; revisit only if the +1 to-hit proves invisible in play.
- Party members contributing to parley (a Bard member, etc.) → v2 party depth.

</deferred>
