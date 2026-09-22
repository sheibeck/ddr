# Phase 51: Initiative Once Per Combat - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run) — 3 areas / 12 questions, all recommended answers accepted

<domain>
## Phase Boundary

Initiative is rolled once per fight (in `fight()`, the Fight! gate) and `C.first` holds for the whole fight; the per-round re-roll AND its pre-emptive foe turn in `afterPlayerAction` are deleted, so a foe never takes two turns back to back. The player sees one initiative line per fight in the Oracle and the fight log, with the dice revealable. Deliberate canon p.24 divergence under the greenfield ruling: measured first, declared per moved fixture, only those regenerated; draw-count pins re-pinned, never loosened; bot readout BEFORE and AFTER in `docs/DIFFICULTY-RETUNE.md`. Requirements INIT-01, INIT-02.

Source: ROADMAP Phase 51 and `.planning/todos/pending/2026-09-19-initiative-rolled-once-per-combat-not-every-round.md` (`resolves_phase: 51`).

</domain>

<decisions>
## Implementation Decisions

### Turn structure with a fixed initiative
- The ONE roll stays in `fight()` (`engine/combat.js:388`, the Fight! gate) — `startCombat` remains the roster/`pending` step; a replayed Fight! tap still cannot re-roll (T-31-02); `c.foresight` is still spent at Fight! time (Phase 31).
- `afterPlayerAction` (`engine/combat.js:1339-1352`) loses BOTH the `rollInitiative(state, rng)` re-roll and the `if (state.combat.first === "foe") { foeTurn(...) }` pre-emptive branch. Per-round order is then strictly alternating: a foe-first fight opens with the foe turn inside `fight()` (F, Y, F, Y…), a you-first fight is Y, F, Y, F… The foe's per-round turn is the one already run after the player's action — never two in a row.
- `round++` placement is unchanged (after the foe turn, still guarded by `!state.dead && state.combat`). The `C.round === 1` rules (Court Mage "you talk first", `C.tracked && C.round === 1` at `:947`) now naturally see only the single roll; their comments are updated to say so.
- Knight-vs-big-foe (`knightFacesBigFoe`, Phase 24 IDENT-05, today "re-evaluated every round") is evaluated once at the single roll: a Knight facing a live foe with maxWP >= 20 at Fight! time gives the foe the opening turn. The rule narrows to the opener; the divergence rationale records this narrowing explicitly.

### The initiative line (INIT-02)
- The dice reach the shell through the EXISTING `combatJoined` event, extended with additive fields: `mine` (d20), `theirs` (d20), `why` (`null` | `"samurai"` | `"slow"` | `"knight"` | `"courtMage"` | `"foreseen"` | `"acuteHearing"` | `"senses"`). `combatJoined` already fires exactly once per fight, so "once, not per round" is structural. Existing consumers (`senses: true` short form, `first`) keep working; no new event type, no new `EVENT_NARRATION` key.
- Line shape is prototype-faithful with the dice in `.roll` spans so the fight log can reveal them (the existing `oracleDetailText` fold): "Initiative — you **14**, Stalka Beast **9**. You go first." The foe's name is used when the fight has exactly one live foe; "them" for a group.
- When an override decided the roll, the verdict names it in voice instead of the bare "You/They go first": Samurai → "Samurai honour — they go first."; slow race → "…they go first." with the race's slowness named; foreseen → "Foresight — you go first."; Acute Hearing → "Acute Hearing — you go first."; senses → "Nothing gets the jump on you." (existing copy); Knight big-foe → "A Knight's welcome — it comes straight at you."; Court Mage → "Court Mage — you talk first, they swing first." Exact wording is Claude's discretion within the voice rules (family-friendly sarcasm, no profanity), the dice always shown.
- Pins: (a) a 3-round replay counts `combatJoined` === 1 and asserts no other event carries `mine`/`theirs`; (b) narration snapshot for every `why` branch through the voice/banned-word scan; (c) the fight-log entry reveals both dice via the existing `.roll` fold.

### Fixtures, pins & measurement (engine gate)
- Measure first: `tools/initiative-fixture-scan.mjs` in the `tools/worn-fixture-scan.mjs` mould — replays every parity replay site in lockstep with the frozen prototype sandbox and reports, per site, the first action index where state diverges and the end-of-scenario fields that differ → the MOVED SET. Output committed as `tools/initiative-fixture-scan-output.txt` and quoted in `test/parity/FIXTURE-INVENTORY.md` (a "Phase 51" section). A REPORT tool (exit 0, no assertions), not a `*.test.js`.
- Declaration shape: `divergence` `kind: "action-path"` records. Holders that already carry one (`combat.json` `lose` "24+31", `lose-apprentice` "31", `parley` "27+31"; `magic.json` `cast-damage` "23+31") get `phase` extended with "+51" and `after`/`stateAfter` regenerated from the engine (measured, never hand-typed); newly-moved holders (expected: `combat.json` `lose-plain`, any other site the scan lists) get a fresh record with `fromAction` = the measured first divergent index. `test/parity/divergence-records.test.js` gains a Phase 51 MOVED SET assertion (the sorted holder-id set equals the scan's). `test/parity/prototype-master.js.txt` is never edited; no blanket carve-out in `comparables.js`.
- Draw-count pins: `test/unit/foe-turn-draw-count.test.js` full-fight totals re-pinned to the new sequences (−2 d20 per round from round 2 onward) plus a zero-draw assertion on `afterPlayerAction`'s round advance (SC1); `test/unit/combat.test.js` initiative tests re-targeted at `fight()` as the single call site, keeping the Samurai / slow / foresight / Acute Hearing / senses / Knight / Court Mage cases. Pins are re-pinned, never loosened to ranges.
- Bot readout BEFORE and AFTER under identical parameters: `node tools/tune-difficulty.mjs --seeds=200` solo and `--party`, plus a `tools/tune-classes.mjs` smoke, run at phase start (BEFORE any engine edit lands — on the phase-start commit) and after; rows recorded under a "v1.7 · Phase 51 — initiative once" heading in `docs/DIFFICULTY-RETUNE.md` — the baseline Phases 52–54 inherit.

### Claude's Discretion
- Exact override wording within the voice rules; whether `why` is omitted (not `null`) when no override fired, as long as the narration branches and the pins agree.
- Scan-tool internals (how "first divergent action index" is detected — likely the harness's per-action byte diff), and the exact `tune-classes` smoke flags (`--seeds` small) as long as BEFORE and AFTER match.
- Whether the retune-ledger rows live in a new subsection or a table appended to the existing v1.5/v1.6 readouts, as long as the heading names Phase 51.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/combat.js#rollInitiative(state, rng)` (L154-176): two d20s (`mine`, `theirs`) drawn ALWAYS, then the ternary: `(samurai || slow || knightBig || courtMage) && !foreseen && !c.senses` → "foe"; `foreseen || skill(c, "Acute Hearing")` → "you"; else `mine >= theirs`. Consumes `c.foresight`. Returns `C.first`. The `why` field falls out of the same branch order.
- `engine/combat.js#fight(state, rng, events)` (L383-390): the single call site to keep — `const first = rollInitiative(state, rng); delete C.pending; events.push({ type: "combatJoined", first, ...(c.senses && first === "you" ? { senses: true } : {}) })`, then phobia trigger, `combatInDark`, and the pre-emptive `foeTurn` only when foes win.
- `engine/combat.js#afterPlayerAction` (L1307-1352): ally → allies → foeTurn → cleared checks → `if (!state.dead && state.combat) { round++; rollInitiative(...); if (first === "foe") { foeTurn(...); cleared check } }` — the block to cut down to `round++` only. Note the ROUND-COUNT FIX comment (2026-09-09) that explains why the pre-emptive turn did not `round++` — becomes moot.
- Other `C.round` reads: `engine/combat.js:947` (`C.tracked && C.round === 1`), `:1001` (`if (!state.dead) C.round++` — a second round-advance site, check which path), `:1457` (`pickMemberAbility(sheet, ally, C.round, …)`), `:1527` (`if (round === 1)`). `knightFacesBigFoe` at L121.
- Prototype narration (`test/parity/prototype-master.js.txt:1865-1875`): `C.initNote = \`Initiative — you <span class="roll">${mine}</span>, them <span class="roll">${theirs}</span>.\`` — the shape to match. The engine never ported `initNote` (presentation concern); `combatJoined` is its replacement.
- Narration sites: `src/browser/narrationLines.js:1047` (`combatJoined` → `{ text, tone, priority }` for the rail/fight log) and `src/browser/eventNarration.js:305` (Oracle html — `<span class="beat">You move first.</span>` / `<span class="hurt">They move first.</span>`, senses variant). `src/browser/fightLog.js` reveals dice via `oracleDetailText(narrateEvent(events[idx]))` — a `.roll` span in the Oracle html is what makes the dice revealable.
- Fixture harness: `test/parity/fixtures/action-script.schema.md` (`divergence` `kind: "action-path"` — `fromAction`, `fields`, `before`/`after`, `stateFields`/`stateBefore`/`stateAfter`); `test/parity/harness/comparables.js` (`actionPathDivergenceOf`, `skipsByteDiffAt`, `declaredEndDiffs`); `test/parity/divergence-records.test.js` (Phase 45 MOVED SET guard pattern); `tools/worn-fixture-scan.mjs` + `tools/terrain-fixture-scan.mjs` (report-tool pattern, `loadPrototypeSandbox`, `applyStartCombat`).
- Existing action-path holders: `combat.json` `lose` (seed 14, 11 actions, "24+31"), `lose-apprentice` (127, 15, "31"), `parley` (303, 2, "27+31"); `magic.json` `cast-damage` (8, 2, "23+31"). Holders with no record: `combat.json` `win` (3, 2 actions), `lose-plain` (1119, 8), `flee` (17, 2); `magic.json` `heal`/`potion`/`scroll` (1 action each); all `encounters.json` / `movement.json` / `economy.json` sites.
- Draw pins: `test/unit/foe-turn-draw-count.test.js` (21 tests; five full-fight totals in Section 2 measured 2026-09-13), `test/unit/combat.test.js` (initiative tests L308-330; multi-round fights at L375, 398, 419, 458, 909, 990, 1107, 1132 whose comments cite the per-round re-roll — every one of those needs its expected draw sequence re-derived).
- Bot tools: `tools/tune-difficulty.mjs --seeds=200 [--party] [--json]`, `tools/tune-classes.mjs --seeds N --workers 4 --out …`; ledger `docs/DIFFICULTY-RETUNE.md` (last headings: Phase 27 AFTER readouts, TUNE-07 DR checklist/verdict).

### Established Patterns
- Engine gate: pure/deterministic engine; every divergence DECLARED with before/after and only its fixtures regenerated; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` never changes; new fields carved out of the comparables only when they are state fields (event payload fields are not compared by the fixtures — `combatJoined` extras need no carve-out).
- Greenfield amendment (2026-09-17): no dual-path or run-option gating; the bot plays the new rules.
- Deliberate-rules-change comments: each changed function carries a `DELIBERATE RULES CHANGE (Phase 51, INIT-01, 2026-09-20)` paragraph in the style of the Phase 24/31/40 ones already on `rollInitiative`.
- Narration voice: sarcastic, family-friendly, checked by `content/safety-wordlist.js` BANNED scans in the module tests.

### Integration Points
- `engine/combat.js` (`rollInitiative` return shape or a sibling that exposes `mine`/`theirs`/`why`; `fight`'s `combatJoined` push; `afterPlayerAction` cut), `src/browser/eventNarration.js` + `src/browser/narrationLines.js` (`combatJoined` lines), `test/unit/foe-turn-draw-count.test.js`, `test/unit/combat.test.js`, `test/parity/fixtures/action-script.combat.json` (+ any other site the scan lists), `test/parity/divergence-records.test.js`, `test/parity/FIXTURE-INVENTORY.md`, new `tools/initiative-fixture-scan.mjs` + output, `docs/DIFFICULTY-RETUNE.md`, `content/BESTIARY-REBALANCE.md` only if a foe row changes (none expected).
- `mazeworld.html` is not expected to change (the Oracle/fight log render from the narration modules); if a combat-header per-round line exists it is removed there (the scout found none).

</code_context>

<specifics>
## Specific Ideas

- SC1 wording: "`rollInitiative` fires exactly once per combat (from `startCombat`/the `fight` action); the per-round re-roll at `engine/combat.js:1341` is gone, pinned by a zero-draw assertion in `foe-turn-draw-count.test.js`."
- SC2: a scenario where the foe would have won a fresh second-round roll now alternates player/foe turns for the whole fight — build it from an existing multi-round `combat.test.js` case whose comment says "fresh initiative … -> foe, second foeTurn" and assert the foe-turn count equals the player-action count (+1 for a foe-first opener).
- SC3: "Initiative — you N, them M. You go first." appears exactly once per fight in the Oracle and the fight log, pinned by a test that fails on a second appearance.
- The BEFORE bot readout must be taken on the phase-start commit before any engine edit — sequence the plan so measurement is its own first task (or its own Wave 1 plan) and the engine edit cannot land before it.

</specifics>

<deferred>
## Deferred Ideas

- Foe attack cadence / ability-replaces-swings (CAD-01..03) and the damage curve (DMG-01/02) — Phase 52, measured on top of this phase's AFTER readout.
- A per-round "round N" line in the fight log — not requested; the rounds already read as a steady exchange once the double turn is gone.
- Keeping the rolled character on a dev start-at-depth (Phase 50 note) — separate todo.

</deferred>
