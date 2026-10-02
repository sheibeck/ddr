# Phase 92: Store Economy & Balance Close - Context

**Gathered:** 2026-10-01 (orchestrator, from the roadmap's ruled sequence, standing memories and the Phase 87–91.2 hand-offs)
**Status:** Ready for planning

<domain>
## Phase Boundary

A depth-7 hero can't buy out a store, and ONE bot pass over the finished rules confirms the difficulty curve held. This is the milestone's only bot work (standing rule: bots run once, at the milestone end, as the final check before the release build). Requirements: ECON-11, ECON-12, TUNE-10. The release build stays outside this phase; no full test suite after build-only steps.
</domain>

<decisions>
## Implementation Decisions

### Ruled sequence (roadmap)
1. **Bot fixes first (no balance run yet)** — the three bot findings from this milestone, so the readout and the pass measure the game, not bot bugs:
   - Fair-bot Joiner camp stall: the camp gate reads only the hero's appetite while `makeCamp` refuses on the party's `nightlyEats`, so it loops `campFailed` (89-06; seeds repeatedly swapped in tuning-bot.test.js / days-farm). Fix: `c.rations >= nightlyEats(state)` (or equivalent) in `decideAction`'s camp branch; then restore/re-check the swapped test seeds where sensible.
   - `tools/lib/tuning-bot.mjs` treats a ready worn Cloak of Regeneration as an instant free heal; since 88-04 it heals 1d6 at 10/20/30 squares (88-04 finding).
   - `tallyUsage` counts a Joiner's `itemUsed` (member-tagged) as the hero's (89-07 finding).
   - Also check the bot handles this milestone's new rules sensibly where it matters for the readout: Door Illusion as an escape, the buffs, Joiner casters/passives, the 91.1 cooldown abilities, Pickpocket extra items, Q8 race prices (bot-only logic changes, no engine).
2. **ECON-11 readout** — `tools/tune-economy.mjs`: for each depth on floors 1–12, the gold a hero holds on reaching a store vs that store's total stock price, with gold income broken down by source; recorded in `docs/` (e.g. `docs/ECONOMY-READOUT.md`). Context: the user's 2026-09-28 device report "Store can still be bought out at depth 7"; this milestone moved prices a lot (Q8 A: race/Pickpocket buy rule on every non-tool line; Troll ×2; selling at the ordinary price for every race; Enlarge 150; Joiner armour repair line; Pickpocket extra item instead of gold).
3. **User checkpoint (checkpoint:decision)** — present the readout in plain words and confirm the target. Roadmap default: "a typical depth-7 hero can afford about a third to a half of a store, not all of it." Offer the target and 2–3 retune levers (prices vs gold sources) with the recommended one.
4. **ECON-12 retune** — a rules change (prices and/or gold sources) to hit the confirmed target; moved store fixtures/pins declared and regenerated alone; re-run the readout to show the target met.
5. **TUNE-10 fair-bot pass** — on the finished rules: the fair bot's median death stays at floor 3–4 (user 2026-09-27: the fair bot plays worse than a human; floor 3–4 for the bot ≈ human 5–7); starvation deaths re-measured after the d10 rations and recorded. Watch specifically: Magic User / Illusionist death depth (Door Illusion is in every Illusionist's starting book — a free escape), the Cleric (now melee-and-heal), Fridgian frenzy odds, the 91.1 cooldown abilities, Joiner casters/passives/parley XP split.
6. **Drift** — any drift the pass finds is recorded and retuned WITH the user (checkpoint:decision) before the milestone closes. Engine/canon dial changes go to the user; search parameters the orchestrator may adjust on its own (checkpointed fit protocol: blocks of 10; stop on a clear failure pattern; tail 13–20 measured, not fitted).

### Gates (milestone)
- Greenfield; derived rng streams for new rolls; EVENT_NARRATION + rail twin for any new event; moved fixtures measured, declared (FIXTURE-INVENTORY "### Phase 92 plan NN") and regenerated alone (roll-high state pins by label, never `save`); `prototype-master.js.txt` never edited.
- TESTING (user 2026-10-01): executors run targeted tests; the orchestrator runs the full suite once at phase close.
- Executors run directly on master in C:/projects/mazeworld (this session cannot create worktrees), one at a time.

### Claude's Discretion
- Plan split (suggested: 01 bot fixes + ECON-11 readout + target checkpoint; 02 ECON-12 retune + re-readout; 03 TUNE-10 bot pass + drift checkpoint + close).
- Readout format; seed counts (follow the existing tools' defaults; long runs in the background with a watcher).
</decisions>

<code_context>
## Existing Code Insights
- `tools/tune-economy.mjs`, `tools/tune-difficulty.mjs`, `tools/tune-classes.mjs`, `tools/fit-difficulty.mjs`, `tools/readout-compare.mjs`, `tools/readouts/`, `tools/lib/tuning-bot.mjs` (`decideAction`, `chooseAbility`, `chooseMemberItem`, `tallyUsage`), `tools/lib/days-farm.mjs` (the documented seed-55434 stall).
- Economy: `engine/economy.js` (`priceFor`, `sellPriceFor`, `openStore`), `content/` price tables, gold sources (`gainWilmst`, `foeSpoils`, chests, parley spoils and the Human tip).
- Docs: `docs/DIFFICULTY-RETUNE.md` (fit protocol, Ruling F/G rows), `docs/GEAR-BALANCE.md`, the closed audits' "Findings → Phase 92".
</code_context>

<deferred>
## Deferred Ideas
None.
</deferred>

## User answers before the readout (2026-10-01)
- The 91.1 interpretation calls are final as built: Smoke ready again 6 rounds after use (3-round effect + 3 wait); Taunt = use round + next; Mark adds the level of whoever laid it; an Elf Illusionist uses the plain Elf die.
- The fair bot stays as is: it does not sell or buy repairs (the target is judged on gold + bag sale value instead).
- The bot pass includes both optional runs: the deep-floor slices (13–20, measured only) and the 200-seed party run.

## Economy ruling (2026-10-01, 92-02 checkpoint)
- Target 33–50% of a whole store for the typical depth-7 hero, judged on gold + bag sale value (arrival sample); floors 1–4 about unchanged; floors 8–12 no richer than 7 on the with-bag basis.
- Lever S: stores pay less when you sell, DEPTH-SHAPED (shallow stores ~today's rate, falling to the target by depth 7).
- Floors 10–12 gold-alone overshoot: accepted and recorded (revisit after a device playthrough).
- Floors 8–9 with-bag overshoot after 92-03 (53%/54% vs 42% at depth 7, sell fraction 0.125 from floor 7): ACCEPTED and recorded with the 10–12 overshoot (user 2026-10-01); revisit after a device playthrough.
- TUNE-10 drift ruling (user 2026-10-01, after 92-04): D1/D2 (fair-bot p50 death 5 vs [3,4]; floors 3–6 MISS, about one floor easier on 2–6) — ACCEPT AND RECORD (option A). No dial or rule change. Verify on device runs. Before the pass the user said: "It's ok if the numbers move. Let's see where they land."
