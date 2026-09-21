# Phase 53: Joiner Level Cap - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — 3 areas / 10 questions, all recommended answers accepted

<domain>
## Phase Boundary

A Joiner's level never exceeds the floor it is met on: `meetJoiner` applies `lvl = Math.min(rolled, state.floor.depth)` immediately after the canon d10 Level Table roll, with the draw count and order untouched, and every downstream read (`grantLevelAbilities`, both `20 * lvl + d20` wp rolls, `c.joiner`, `state.pendingJoiner`, the `joinerMet`/`joinerRefused` payloads) receives the capped level. Deliberate canon divergence under the greenfield ruling; measured (expected: zero parity fixtures move — no fixture meets a Joiner — declared as a measured zero), unit pins re-targeted, the `--party` bot shift recorded as by-design. Requirements JOIN-02, JOIN-03. Promoted from backlog 999.2.

</domain>

<decisions>
## Implementation Decisions

### The cap rule
- One line in `engine/encounters.js#meetJoiner` (L480-513): `const lvl = Math.min(SPELL_LEVEL_TABLE[rng.d(10) - 1], state.floor.depth);` — the d10 is still drawn first, then `rollCharacter(rng)`, then the two `20 * lvl + rng.d(20)` rolls (the second still discarded) — draw count and cursor byte-identical to today. `grantLevelAbilities(joinerChar, key, lvl)`, `c.joiner`, `state.pendingJoiner` (`lvl`, `level`, `wp`, `maxWP`) and both event payloads use the capped `lvl`.
- No explicit `[1, 5]` clamp — `state.floor.depth >= 1` and the table is 1–5, so `min` already guarantees the range; a dev start-at-depth run caps at the start depth with no special case.
- The rolled (pre-cap) level is NOT remembered anywhere: `c.joiner`'s frozen 7-key shape, `pendingJoiner`, `joinerMet` and `joinerRefused` stay byte-identical in shape — the Joiner simply IS the capped level. No "humbled to your depth" narration.

### Measurement & fixtures
- `--party` harness (`tools/lib/tuning-bot.mjs#forceParty` — meetJoiner + resolveJoiner on a fresh run at depth 1, or the `--start-depth`): after the cap every `--party` run gets a level-1 (or start-depth) ally instead of 1–5. This IS the rule, not a harness bug; the `--party` BEFORE → AFTER under identical flags is the early-Joiner power shift JOIN-03 asks for, declared in the ledger as a by-design distribution change. `forceParty` is not modified.
- Class smoke: run under the identical flags; the bot declines every in-run Joiner (policy D-20), so the smoke is expected byte-identical to Phase 52's AFTER — that identity is the evidence solo play is untouched (record it as such).
- Fixture measurement: run `tools/initiative-fixture-scan.mjs` Part B on the edited engine; expected `MOVED SET (0)` because `test/parity/FIXTURE-INVENTORY.md` records that no fixture meets a Joiner — the zero is MEASURED and declared in a FIXTURE-INVENTORY.md Phase 53 section (the encounter-roll table is unchanged; `meetJoiner` is never reached by any replay site). `test/parity/prototype-master.js.txt` never edited; comparables untouched.
- Unit re-pins: tests that roll a Joiner on floor 1 and expect a level 2–5 result set `state.floor.depth` to the level they need (preferred — the test's intent survives) or re-pin to 1 where the level is incidental. New pin (SC1/SC2): a d10-rolled level-5 Joiner met on floor 2 arrives as level 2 with an unchanged draw count, `wp = 20 * 2 + d20`, level-2 abilities — equal to a natively-rolled level-2 Joiner's abilities and wp. Candidate files: `test/unit/joiner-acquisition.test.js`, `cutthroat-joiner.test.js`, `dismiss-joiner.test.js`, `encounters.test.js`, `identity-contract.test.js`, `identity-world.test.js`, `ability-pool.test.js`, plus any determinism pins that meet a Joiner.
- BEFORE readout = Phase 52's AFTER (`049ab50`; solo / `--party` / class smoke) — reused, not re-run. AFTER under the identical flags (`tune-difficulty --seeds=200`, `--seeds=200 --party`, `tune-classes --seeds 5 --workers 4 --out docs/class-pass/v17-p53-after-smoke.json`) after the edit; ledger H3 `### v1.7 · Phase 53 — Joiner level cap` under the existing `## v1.7 tuning pass (Phases 51–54)` H2, with a BEFORE → AFTER reading table that names the `--party` shift.

### Narration / UI edges
- `joinerMet` / `joinerRefused` narration (rail card + Oracle) and the Hero tab's Company panel read the capped `lvl` — no copy or shape change; a snapshot test pins that the event shapes and the rail-card copy are byte-identical to today (SC3).
- Existing saves with an already-recruited over-level member: tolerant load only — the member keeps its level (greenfield ruling: no reconcile-and-narrate ceremony). Only NEW Joiners are capped.

### Claude's Discretion
- Whether the cap is inlined or a one-line helper (`capJoinerLevel(rolled, depth)`) — inline preferred.
- Exact depth setup used in re-targeted tests (set `state.floor.depth` vs roll a run at depth).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/encounters.js#meetJoiner` (L480-513) — full body read: d10 → `SPELL_LEVEL_TABLE` (`content/misc-tables.js:27`, `[1,1,2,2,3,3,4,4,5,5]`), `rollCharacter(rng)`, two `20 * lvl + rng.d(20)`, `grantLevelAbilities(joinerChar, \`joiner:${name}:${depth}\`, lvl)` (derived stream, zero main draws), `c.joiner = { name, race, sub, cls, lvl, wp, maxWP }`, Wilmsry refusal, `joinerMet` / `joinerRefused` events, `state.pendingJoiner = { ...joinerChar, lvl, level: lvl, wp, maxWP }`. Called from the encounter roll `case "Joiner"` (L200).
- `resolveJoiner(state, accept, events)` (L515+) — pure, no rng; swap semantics from Phase 25.1.
- `tools/lib/tuning-bot.mjs#forceParty` (L1293-1300) — `--party`'s harness-only recruit on a fresh run; the bot policy declines in-run Joiners (`if (state.pendingJoiner) return { type: "resolveJoiner", accept: false }` L1034, D-20).
- Joiner tests: `test/unit/joiner-acquisition.test.js` (13 hits), `cutthroat-joiner.test.js` (14), `identity-world.test.js` (15), `identity-contract.test.js` (12), `encounters.test.js` (6), `ability-pool.test.js` (5), `dismiss-joiner.test.js` (1).
- Fixture facts: `grep -c joiner test/parity/fixtures/*.json` = 0 everywhere; FIXTURE-INVENTORY.md L468 "no fixture meets a Joiner". Scan tool: `tools/initiative-fixture-scan.mjs` Part B (generic first-divergent-action vs the prototype). Ledger heading pins: `test/unit/difficulty-retune-ledger.test.js`, `class-pass-ledger.test.js`.
- Phase 51/52 SUMMARYs show the measure → declare → regenerate → BEFORE/AFTER pattern and the exact bot flags.

### Established Patterns
- Engine gate + greenfield amendment; `DELIBERATE RULES CHANGE (Phase 53, JOIN-02, 2026-09-20)` paragraph on `meetJoiner`; report tools exit 0 with committed output; invariants in unit tests.

### Integration Points
- `engine/encounters.js` (one line + comment), tests listed above (+ one new pin file or additions), `test/parity/FIXTURE-INVENTORY.md` (Phase 53 section — measured zero), `docs/DIFFICULTY-RETUNE.md` (Phase 53 H3), `docs/class-pass/v17-p53-after-smoke.json`. No shell/UI changes expected.

</code_context>

<specifics>
## Specific Ideas

- SC1 wording: "`meetJoiner`'s rolled level is clamped `lvl = min(rolled, state.floor.depth)` with the same one-d10-then-two-d20 draw sequence, pinned by a test showing a level-5-rolled Joiner met on floor 2 arrives as level 2 with an unchanged draw count."
- SC2: `grantLevelAbilities` and the wp formula both receive the capped level — a floor-2 capped Joiner's abilities and wp match a natively-rolled level-2 Joiner's.
- SC3: `joinerMet`/`joinerRefused` narration and the rail card render unchanged — snapshot test.
- SC5: `tune-classes` smoke before/after in `docs/DIFFICULTY-RETUNE.md` — plus the `--party` readout, which is where the shift actually shows.

</specifics>

<deferred>
## Deferred Ideas

- Teaching the tuning bot to accept in-run Joiners (policy D-20) — a harness capability, not this rule; would make the class smoke Joiner-sensitive. Candidate for Phase 54's measurement or a later pass.
- A "humbled to your depth" Joiner line — shape change, not requested.
- Capping already-recruited members on load — greenfield ruling says tolerant load only.

</deferred>
