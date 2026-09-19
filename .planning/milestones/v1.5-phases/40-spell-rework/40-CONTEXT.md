# Phase 40: Spell Rework - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — research first (`40-RESEARCH.md`, roadmap-flagged), then one batched question with three areas; all answered (Area 3 in the user's own words, recorded verbatim). Two research questions decided by the orchestrator as routine (Ice gets a real DOT; scroll scribing aligns with `canCast`).

<domain>
## Phase Boundary

Every combat spell is a real situational choice by niche (burst / DOT / multi-target / control with a scope × duration axis / defensive), stated in one line of grimoire text; every utility spell has an observable effect; every Magic User sub starts with a spell that deals damage; Detect Magic is renamed to say what it does and becomes a timed map reveal that re-fogs only what it alone showed; an active Shield is visible outside combat; a scribed scroll is castable the moment its level qualifies.

Requirements: SPELL-01 … SPELL-07.

Out of scope: melee abilities (Phase 38, shipped), items (Phase 39, shipped), the darkness/terrain rework (Phase 41 — the reveal spell only touches the `seen` model and its own timer), bot *tactics* for when to cast (Phase 42 — but the bot must still cast the reshaped kinds; `chooseSpell` is kind-generic), the tutorial.

</domain>

<decisions>
## Implementation Decisions

### Standing rulings that bind this phase
- **Greenfield, no legacy paths (2026-09-17):** new rules are the only rules; no dual paths; `test/parity/prototype-master.js.txt` never edited; every fixture a deliberate change moves is DECLARED (before/after, rationale in `test/parity/FIXTURE-INVENTORY.md`) and regenerated — only those; new serialized fields carved out of all three `*Comparable()` fns + the three local duplicates; old saves tolerant-load only; the bot plays the new rules. **This includes `test/unit/chargen-rng-pin.test.js`:** it is OUR pin, not the prototype's — if a spell add/remove moves a day-one pool's shuffle length, re-measure and re-pin it with the reason in the commit and the ledger (Phase 38's `chargenShiftOf`/`stripChargenShift` and Phase 23's `chargenDivergenceFor` are the two mechanisms — reuse, don't invent).
- **Once-a-day rule (2026-09-18):** 100 squares = one day; anything with a squares cadence that recurs must be usable at least once a day (the reveal window and any spell cooldown ≤ 100 squares).
- **Deferred UAT**; **rail is the one feedback surface** (cards for decisions/big updates only; effects/expiries are narrative lines); every new event → `EVENT_NARRATION` + `TOAST_FOR` + `RAIL_FAMILY`; voice scan green; HP not WP in player copy.
- **Depth-20 target**; v1.5 BEFORE pin is the yardstick; the ONE AFTER matrix is Phase 42.

### Area 1 — SPELL-05 re-fog provenance: **Only what the spell alone showed** (user-chosen; ratified Key Decision — record it in PROJECT.md at phase close)
- The renamed reveal spell (name in Claude's discretion — say what it does: e.g. "Map the Floor" / "Reveal") marks every cell it reveals with a per-cell provenance flag (e.g. `cell.spellSeen = true`) and starts `c.timers["spell:reveal"]` with `cadence: "squares"`, `left: N` (N stated in the grimoire text; ≤ 100). Normal walking during the window clears the flag on the cells it sees (they become permanently seen). At expiry, ONE sweep re-fogs cells still flagged (`seen = false`, flag cleared) and narrates `revealFaded`; the sweep runs once at expiry, never per step (research Pitfall 4). Re-casting during the window extends/refreshes the timer, never double-marks.
- The flag is engine state on the floor grid → parity carve-out where the floor comparables would diff; a tolerant load clears stale flags on saves with no timer.

### Area 2 — SPELL-01 niche scope: **Reshape offense + relabel the rest** (user-chosen)
- The OFFENSE school gets real niches by level. Starting point is the research's niche map (`40-RESEARCH.md` "Proposed Niche Map"); the planner fills the gaps so that at every level with ≥ 2 offense spells the player faces at least two different niches, and where a level has no real choice it may **add, rename or remove** offense spells (declared divergences; day-one rolls for every caster sub stay valid; every change in the before/after table — SPELL-03).
- Concrete rulings inside that scope:
  - **Ice gets a real DOT** (orchestrator decision from research Q3): reuse the `f.dot` / `t.acid` per-round shape (Acid, Phase 38 Poisoned Edge) — Ice is the level-3 DOT tier above Acid; its txt already promises it.
  - **Control spells get an explicit scope × duration axis** stated in txt: Doze (single, d4 rounds), Stun (up to N, d4 rounds), Weaken (define its duration — today undefined — e.g. "all foes, d4+1 rounds"), Stupidity (single, the fight), Blind (single, the fight — "for life" is voice, mechanics are per-fight), Shrink (single, the fight), Petrify (single, removal). Noxious Vapor and Insane are labelled as the **chaos** niche (their gamble is the point) rather than forced into the five.
  - Lightning's "every foe" name-keyed special case becomes a data flag (`aoe: "all"` on a `thrown` row) so renames can never silently break it (research Pitfall 2); the bot's Freeze name-keyed kill-priority is repointed to a kind/flag likewise.
  - Prefer changing `kind`/`txt`/mechanics over `lvl`/`s`; when a level/school change or an add/remove is the right design, do it and declare the chargen-pin movement (see standing rulings) — do not water the design down to protect the pin.
- Every OTHER school (healing/protection/divination/illusion/special) gets a one-line niche `txt` pass only (the "states its niche in one line" requirement), plus the SPELL-02 visibility fixes below — no mechanic redesign.

### Area 3 — SPELL-04 Summoner day-one damage: user's ruling, verbatim
> "Give the summoner a level 1 summon. Summoning less strong than the level 2 summon. Then you can keep level 1 spells without the bad gate"

Applied:
- A **new level-1 special-school summon spell** (name in Claude's discretion, in voice — e.g. "Lesser Summon" / "Something Small and Angry") that conjures a **weaker ally** than `Summon` (level 2): lower ally `lvl` (e.g. `max(1, c.level − 1)`, cap 3), shorter `rounds` (d4, not doubled), a smaller/wittier name table, and the Summoner's doubled-creature and backfire rules do NOT apply to it (it is the safe, small trick). The summoned ally is the Summoner's damage source — SPELL-04 is satisfied by "a spell whose cast produces damage on foes", declared in the ledger.
- **Summon stays level 2 for everyone** — retire the Phase 23 `SPELL_LEVEL_OVERRIDES.Summoner = { Summon: 1 }` entry (the new level-1 spell replaces the override; PROJECT.md's Phase 23 row gets a "superseded by Phase 40" note). Illusionist keeps `Phantom Host: 1`.
- The Summoner's offense gate stays 3 (the identity-contract "bad" is untouched — the user's point: keep level-1 spells without the bad gate). The special school is gate 1 for the Summoner (`MU_CHART.Summoner.special: 1`), so the new spell is in its day-one pool; **guarantee it deterministically** in the day-one roll for the Summoner (extend the existing day-one-attack guarantee: "at least one damage-dealing spell", where the lesser summon counts as damage-dealing for the Summoner; Doze/Stun/Weaken do not count as damage for anyone — research finding).
- Other subs (SPELL-04 rest): narrow the existing day-one-attack guarantee from "any attack kind" to "any damage-dealing kind" (Freeze at level 1, or the lesser summon for subs whose special gate is ≤ 1 and who roll it). Research lists Illusionist/Cleric/Apprentice as the subs that can start damage-less today — the planner verifies each sub's pool contains a damage source at level 1 after the reshape and fixes the pool (not the gate) where it doesn't.

### Routine decisions (orchestrator, from research)
- **SPELL-07:** `readScroll`'s copy-to-grimoire check uses raw `sp.lvl <= c.level` and never checks `schoolGate` — align it with `canCast`'s two checks (`spellLevelFor` + `schoolGate`); a scroll whose spell the caster cannot yet cast is NOT scribed and the refusal names the level (and school gate) needed; a scribed spell is castable immediately. Old saves with a scribed-but-uncastable spell: tolerant — the spell stays in the grimoire and `canCast`'s refusal names the level.
- **SPELL-06:** `conditionsOf` already emits the ward chip with pool + rounds (Phase 31); add rounds to the Hero-tab kit-list row (shows pool only today) and make sure the chip shows outside combat when a ward is up (`Shield` is `combatOnly: false`).
- **SPELL-02:** Mirror Self, Sense Presence, Regeneration have real effects but no chip → add `conditionsOf` descriptors (copy the `might`/`ward` pattern); every utility cast narrates its effect (`allySummoned`, `foresee` result, `turn`/`gate` counts, `regen` per-round line) — audit each of the ten kinds and add the missing event/narration; `c.senses` expiry defined (research assumption — decide and state it in txt).
- Every renamed spell → sweep every name-keyed site (research Pitfall 2 list) and every fixture grimoire literal (declare + regenerate).

### Claude's Discretion (planner)
- Spell names/txt in voice; the exact DOT dice for Ice; Weaken's duration; the reveal spell's window length (suggest 30–50 squares) and name; the lesser summon's ally numbers and name table.
- Plan split; suggested waves: (1) content reshape + niche txt + lesser summon + overrides + day-one guarantee + declared chargen divergences; (2) engine mechanics (Ice DOT, control durations, Lightning flag, scroll fix, senses expiry, utility narration + chips); (3) reveal spell timer + provenance re-fog + carve-out + tolerant load; (4) shell (grimoire rows with niche line, Hero-tab ward rounds, chips, reveal painting) + `docs/SPELLS.md` ledger + gate + aggregated Pixel 7 checklist.

</decisions>

<code_context>
## Existing Code Insights (from 40-RESEARCH.md, verified 2026-09-18)

- `content/spells.js` — 32 rows `{ n, lvl, s, kind, dmg?, txt, combatOnly, pool?, rounds?, reflect? }`; `content/mu-chart.js` `MU_CHART` school gates per sub (+ `gate` upgrades); `content/spell-level-overrides.js` `SPELL_LEVEL_OVERRIDES` (Summoner/Summon 1, Illusionist/Phantom Host 1) read by `spellLevelFor`; day-one grimoire roll `rollGrimoire` with the frozen `dayOnePool` shuffle (research "Fixture/Chargen Impact" + Pitfall 1).
- `engine/magic.js` — `castSpell(state, idx, rng, events)` per-kind switch (`summon` at :138 with the Summoner doubled/backfire rules; `stun`, `weaken`, `acid`, …), `RESIST_IMMUNE_KINDS`, `canCast` (spellLevelFor + schoolGate), `readScroll`/`canRead` (:468–514, the scribing bug), Lightning name-keyed "every foe" case.
- `engine/combat.js` — foe status fields `asleep/frozen/dot(acid)/blind/shrunk/stupid/insane/weakened/petrified`, `f.dot` tick (Phase 38 Poisoned Edge shape), `C.ally` member turns, `c.ward` soak.
- `engine/derived.js` — `conditionsOf` (ward chip with pool/rounds; `might`; Phase 39 item chips as the pattern), `spellLevelFor`, `schoolGate`.
- `engine/maze.js`/`engine/movement.js` — `seen` per cell, `revealRadius`, Detect Magic's one-way whole-floor `seen = true` sweep (no re-fog mechanism today).
- `engine/effects.js` — the timer model (`squares` cadence for the reveal window; `rounds` for combat effects).
- `tools/lib/tuning-bot.mjs` — `chooseSpell` is kind-generic; Freeze name-keyed kill priority (repoint).
- Tests/pins: `identity-contract.test.js` (Summoner offense gate 3 is a locked "bad"), `chargen-rng-pin.test.js`, parity fixtures with grimoire literals (FIXTURE-INVENTORY lists them).
- Shell: Hero-tab kit list (ward row pool only), SPELLS submenu (`src/browser/combatMenu.js`), grimoire rows in `viewModels.js`, map painting of `seen`.
- Tests: 2686 green at `3d5253a`; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

</code_context>

<specifics>
## Specific Ideas

- Niche line format in the grimoire: `Freeze — burst · one foe · d6` / `Acid — damage over time · one foe · 2d6+2 a round, d6 rounds` / `Stun — control · up to d6 foes · d4 rounds` — one line, the niche word first.
- Reveal spell expiry line in voice: "The map forgets what it was told."
- Lesser summon backfire-free; its ally name table should read smaller and sillier than Summon's ("A horned thing" → "A thing with one horn, mostly").
- Ledger `docs/SPELLS.md`: canon change quoted, before/after table for all 32(+) rows, niche map by level, day-one damage proof per sub, the re-fog Key Decision, the scroll fix.

</specifics>

<deferred>
## Deferred Ideas

- Bot casting tactics by niche → Phase 42.
- Darkness/light interplay with the reveal window → Phase 41.
- Spell cooldowns / mana model — not in v1.5 (spells stay per-day slot casts as canon).

</deferred>

---

*Phase: 40-spell-rework*
*Context gathered: 2026-09-18 via research + autonomous smart discuss (one batched question, three areas)*
