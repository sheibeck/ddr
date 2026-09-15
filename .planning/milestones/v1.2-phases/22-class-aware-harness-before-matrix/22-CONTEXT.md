# Phase 22: Class-Aware Harness & BEFORE Matrix - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas, all recommendations accepted by the user

<domain>
## Phase Boundary

Extend the dev-only tuning harness (`tools/lib/tuning-bot.mjs`, `tools/tune-difficulty.mjs`) so it can (1) force any class / sub-class / race combination deterministically, (2) play every sub-class with a policy that actually uses that sub-class's tools (summon, sing, Mirror Self, disables, heals, talk-first parley), (3) run all 143 valid sub-class × race combinations for N paired seeds and print a ranked matrix, and (4) start runs at a chosen depth. Then capture the BEFORE snapshot — the full matrix at natural start plus a depth-20 slice — against the commit-pinned pre-identity-pass engine and commit it to the new `docs/CLASS-PASS.md` ledger + `docs/class-pass/before.json`, BEFORE Phase 23 changes a single rule.

The only engine change permitted in this phase is the dev-only `force` option on `newRun`/`rollCharacter` (mirroring the Phase 21 `startDepth` precedent). No rule, number, or narration changes. The harness stays dev-only, never shipped, never a CI gate.

Requirements: HARN-01, HARN-02, HARN-03, HARN-04, PLAY-01.

</domain>

<decisions>
## Implementation Decisions

### Forcing a class/sub/race (HARN-01)
- Forcing is a **dev-only `force` option on `newRun(seed, exclude, { startDepth, force })`** threaded into `rollCharacter(rng, exclude, force)`. It **substitutes the RESULTS of the class d6 / sub d8 / race d8 draws while still consuming those draws**, so every subsequent draw (intel, baseWP, skills shuffle, phobia, temperament, motive, potions, cloak, grimoire, name) sits at the identical rng cursor. Same seed ⇒ same maze and encounter stream across combos (paired comparison). Precedent: Phase 21 `startDepth` (D-13/D-14) — a dev option omitted by every real caller, default path byte-identical.
- Determinism proof (two tests): (a) `newRun(S, [], { force: X })` is **byte-identical** to `newRun(S)` for any seed S that naturally rolls X; (b) the default path with no `force` stays byte-identical to every parity fixture (existing suite proves this — no carve-out needed because no new field is serialized). Note the forced sub's class may differ from the natural class's baseWP dice (Thief draws none, MU draws d10) — that is expected and correct; the proof is against a seed that naturally rolls the same combo.
- **Fridgian Samurai is canon-impossible** ("Fridges don't wear any armor" — the prototype rerolls the sub). The harness **refuses** it with a clear message; the matrix has **143 cells** and a footnote. Never bypass the reroll.
- **No UI exposure this phase.** The hidden Settings dev toggle keeps start-at-depth only. (Class picker on the dev toggle → Deferred Ideas.)

### Sub-class-aware bot policy (HARN-02)
- Combat casting uses **ONE scoring table in a single function** (replacing `findCastableAttackSpell`'s thrown-only rule), evaluated only when charges remain and the spell passes `canCast`: kill spells first (Freeze, Death — noting Death costs 25 wp, so gate it on wp), then thrown spells by expected damage (Mangle > Lightning vs many > Fireball > Ice > Freeze-as-damage), then disables (Stun / Doze / Weaken) when **2+ foes are live**, then Heal / Major Heal when **below 50% wp** and known (potions are drunk first, Heal second), **Shield / Mirror Self on round 1 only** (once per encounter), else attack. Flee/parley thresholds (0.3 plain / 0.5 vs kit-bearing) are unchanged from v1.1 D-06.
- **Summon**: cast **out of combat when no ally is pending and charges > half of `maxCharges`** (keeps charges for the fight); ALSO cast at round 1 in combat if no ally is present and charges remain. Phantom Host (illusion summon) follows the same rule for Illusionists.
- **Bard**: `sing` on **round 1 whenever `songReady`**, except at **level 1 sing only vs Beasts / Lair Beasts** (the level-1 song does nothing against anything else); level 2+ always sings round 1 when ready (Inspire = +1 to hit for the fight).
- **Parley**: sub-classes and races whose GOOD is talking — **Con Artist (any talkable), Woodsman vs Beasts/Lair Beasts, Bard vs Humans, Wilmsry (non-Magical), Elf vs Humans** — **attempt parley once at round 1** when `canParley` is true; everyone else keeps the v1.1 low-HP fallback. `ctx.parleyBlocked` semantics (refusal ⇒ stop trying this encounter) are unchanged.
- **Stuck runs**: a run that hits the action cap is reported as **`stuck`** (own outcome bucket, own count column) and **excluded from death-depth statistics**. The planner must include a task that **investigates the top stuck cause** from the baseline (19/400 runs hit 20,000 actions) and fixes it if it is a bot-policy bug (Rule-1 precedent: the v1.1 Wilmsry-vs-Magical parley loop). If it is an engine dead-end (e.g., an unreachable exit), document it as a finding for a later phase — do not change engine behavior here.

### Matrix tool, volume, and the BEFORE snapshot (HARN-03, PLAY-01)
- New tool **`tools/tune-classes.mjs`**: **40 seeds per combo** by default (143 × 40 = 5,720 runs), the **same paired seed list `i*7919+1`** for every combo, parallelized across **`worker_threads`** (Node built-in — zero dependencies, consistent with the project's no-runtime-deps rule), with the **per-run action cap lowered to 5,000 for matrix runs** so stuck runs stop dominating wall time. Target: a full matrix in well under 30 minutes on the dev machine. Knobs: `--seeds N`, `--workers N`, `--max-actions N`, `--start-depth N`, `--sub X --race Y` (single-cell spot check), `--json`.
- **Per-combo row metrics**: mean / p50 / p90 death depth, reach ≥5 % and ≥10 %, mean kills, mean level reached, mean actions, stuck count, top-3 death causes. **Roll-ups** by class, by sub-class, by race. Ranked by mean depth. **No fun-band verdicts** in the tool — those are Phase 26 (PLAY-02) editorial work.
- The tool prints the same **`Bot:` parameter line** the v1.1 ledger greps (extended with seeds/workers/start-depth), so BEFORE and AFTER are provably run with identical parameters.
- **BEFORE snapshot lives in the repo**: create **`docs/CLASS-PASS.md`** this phase with a "BEFORE — commit `<hash>` (pre-identity-pass engine)" section transcribing the ranked matrix + roll-ups, plus a **per-combo aggregate JSON at `docs/class-pass/before.json`** (aggregates only, no per-run rows) for machine diffing in Phase 26. The ledger's later sections (rulings from Phase 24, AFTER from Phase 26) are left as headed placeholders. The engine/content/src must be proven unchanged from the pinned commit for the whole BEFORE capture (`git diff --quiet <hash> -- engine content src mazeworld.html`), mirroring `docs/DIFFICULTY-RETUNE.md`'s discipline.
- The BEFORE capture happens **LAST in this phase**, after the harness is complete and tested, and **before any Phase 23 commit**.

### Start-at-depth for the bot (HARN-04)
- **Reuse `newRun(seed, [], { startDepth })` exactly as the Settings dev toggle does** — threaded through `playRun` as `opts.startDepth`, exposed as `--start-depth N` on both `tune-classes.mjs` and `tune-difficulty.mjs`. No new engine code for this.
- Deep runs report **`floorsGained` (death depth − start depth)** and **`encountersSurvived`** alongside death depth, so depth-20 lethality reads as "median floors gained at 20".
- **Character at a deep start is exactly what the dev path already produces** (SP set to the depth's threshold → level via `checkLevel`, capped at 5; depth-scaled purse). **No extra kit or gear grants.**
- The BEFORE snapshot **includes a depth-20 slice at 10 seeds per combo** (143 × 10 = 1,430 runs) in addition to the natural-start matrix, so Phase 27 has a class-aware deep baseline.

### Claude's Discretion
- Scroll reading (read out of combat when `canRead`), `useItem` for carried consumables, and exact expected-damage ordering inside the scoring table — keep them simple and documented in one place.
- Worker-thread work distribution (by combo vs. by seed chunk) and result aggregation shape.
- Exact text layout of the matrix table; the JSON shape is the contract (`{ meta: { commit, seeds, workers, maxActions, startDepth, bot }, cells: [...], rollups: { byClass, bySub, byRace } }` or equivalent, documented at the top of the tool).
- Whether `tune-difficulty.mjs`'s existing readout also gains the `stuck` bucket (recommended: yes, shared in `tuning-bot.mjs`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/lib/tuning-bot.mjs` — the shared bot: `decideAction` (policy), `findCastableAttackSpell` (thrown-only — to be superseded by the scoring table), `playRun(seed, opts, onStep)` (loop; calls `newRun(seed)` — add `startDepth`/`force` pass-through), `forceParty` (the ONE existing write-path bypass precedent), D-07 tallies, D-08 readout helpers (`distribution`, `reachTable`, `printSharedReadout`, the grep-stable `Bot:` line). `BOT_DEFAULTS` is frozen — extend it.
- `engine/state.js#newRun(seed, exclude, { startDepth })` — the dev-only option precedent (Phase 21 D-13/D-14); the deep path sets `c.sp = THRESHOLDS[...]`, runs `checkLevel`, grants `WILMST_CACHE_PER_DEPTH * startAt`, re-captures `rngState`, sets `state.dev = true`.
- `engine/character.js#rollCharacter(rng, exclude)` — draw order pinned in the module header: class d6 → sub d8 → race d8 → Fridgian/Samurai reroll → intel d20 → baseWP → skills shuffle → phobia → temperament → motive → potions/cloak → grimoire → name. `force` substitutes the first three results only.
- Read-only engine helpers the bot may import (precedent: `canParley`, `canCast`, `maxCharges` already imported): `songReady` (`engine/combat.js`), `liveFoes`, `canRead` (`engine/magic.js`), `SPELLS`/`RACES`/`CLASSES` (`content/index.js`).
- Action vocabulary (`engine/actions.js`): `move, attack, castSpell{idx}, drinkPotion, flee, parley, sing, readScroll, useItem{i}, camp, resolveJoiner, takeFind, leaveFind, leaveStore, …` — `sing` and `readScroll` exist and are unused by the bot today.
- `test/unit/tuning-bot.test.js` — policy tests to extend (D-05/D-06 threshold tests, purity test that forbids `Math.random`/`Date.now` in the module source).
- `docs/DIFFICULTY-RETUNE.md` — ledger discipline to mirror (commit pin via `git diff --quiet`, identical `Bot:` line BEFORE/AFTER, background runs with an `EXIT=` sentinel).
- `.planning/research/CLASS-AUDIT-2026-09-14.md` — the 400-seed grouped baseline and the per-sub-class good/bad audit (planning input; the BEFORE matrix supersedes its numbers).

### Established Patterns
- Engine gate: pure/deterministic engine, parity byte-identical for solo play, new draws only behind new-feature guards, `test/parity/prototype-master.js.txt` never edited. A dev-only option that leaves the default path untouched is the accepted way to add harness affordances (D-13/D-14).
- The bot uses a **separate policy rng** (`makeRng(seed ^ 0x9e3779b9)`) so harness decisions never perturb engine determinism.
- Zero runtime dependencies; dev tools are plain Node ESM under `tools/`, never shipped, never asserted by `node --test`.
- Ledgers transcribe bot output verbatim with a commit pin and a parameter line.

### Integration Points
- `engine/state.js#newRun` options object (add `force`), `engine/character.js#rollCharacter` (accept `force`, substitute three draw results, keep the Fridgian/Samurai reroll loop intact — a forced Fridgian + Samurai must be rejected BEFORE reaching it).
- `tools/lib/tuning-bot.mjs` (`BOT_DEFAULTS`, `decideAction`, `playRun`, tallies/readout), new `tools/tune-classes.mjs`, `tools/tune-difficulty.mjs` (`--start-depth`, `stuck` bucket).
- New `docs/CLASS-PASS.md`, `docs/class-pass/before.json`.
- Tests: `test/unit/tuning-bot.test.js` (policy), a new forced-chargen determinism test (e.g., `test/determinism/forced-chargen.test.js`), existing parity suite must stay green untouched.

</code_context>

<specifics>
## Specific Ideas

- The whole point of forcing via substituted draw results is **paired comparison on identical seeds** — same maze, same encounter stream, only the character differs. Keep that property; it is what makes the matrix a class measurement rather than a maze lottery.
- "Same character as a naturally rolled one" is the acceptance test for the seam: pick seeds that naturally roll several distinct combos (the audit's baseline rows record class/sub/race per seed — reuse them) and assert byte-identity when forcing the same combo.
- Report `stuck` honestly and separately. A 5% stuck rate silently folded into depth numbers would corrupt every conclusion in Phases 26–27.
- BEFORE must be committed before Phase 23's first engine commit. If Phase 23 starts before BEFORE is committed, stop and capture it first.

</specifics>

<deferred>
## Deferred Ideas

- Class/sub/race picker on the hidden Settings dev toggle (UI exposure of the `force` seam) — useful for on-device DR rounds of specific combos; a Phase 25/26 candidate or v1.3.
- Depth-appropriate gear grants for deep-start characters — would change what the dev toggle measures; revisit only if Phase 27 needs it.
- Fixing any engine dead-end the stuck-run investigation surfaces (e.g., an unreachable exit) — a finding for the ledger, addressed in a later phase, not here.

</deferred>
