# Phase 90: Spell & Skill Audit - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Every spell and every skill/ability does what its text says, stated in roll-high form. Two audit tables (spells, skills) cover every entry; each mismatch is fixed with a test or recorded as a deliberate ruling. The Strength spell (report #8) and Pommel Strike (report #4) do what players expect. The user's 2026-09-30 spell reworks are built (Doze/Stun swap, Petrify, Stupidity, Blind, Ice, Strength, Lesser Summon and Phantom Host removed, Summoner casts Summon from level 1), and the Special and Illusion schools get real spells from the rulebook's page-50 list.

Requirements: SPELL-08, SPELL-09, SPELL-10, SPELL-11, SPELL-12, ABIL-06, ABIL-07, TEXT-01 (spell and skill rows). No bot pass (Phase 92).

**Required reading for every plan:** `.planning/notes/v2.3-user-rulings-2026-09-30.md` (Spells and TEXT-01 sections; SPELL-10/11/12 carry the exact rulings).

</domain>

<decisions>
## Implementation Decisions

### Already ruled by the user (2026-09-30, not re-asked; exact wording in the rulings note)
- **SPELL-11:** Doze sleeps d4 foes for d4 rounds and a hit wakes a dozing foe; Stun holds one foe for d4 rounds and a hit does not end it.
- **SPELL-12:** Petrify (level 5) turns one foe to stone, it dies, no loot, resist still allowed, no floor-12 language; Stupidity drops a foe's intelligence to 1 for the fight (weakening its resists); Blind limits a foe to its to-hit die's maximum roll and no crits, no floor-12 language; Ice is an area d10 to every foe with a chance to freeze each target 1d4 rounds; Strength gives +d10 damage rolled on every damage roll and no hit points; Lesser Summon is removed and the Summoner casts the level-2 Summon from level 1 (update `content/identity.js`, its proof test and the blurb; Phase 91 checks the Summoner row); Phantom Host is removed.
- **TEXT-01 for spells and skills:** "faces" wording becomes "+/− to hit" with hard caps naming the d20 range; "squares of" becomes how many foes an area effect hits; parley wording where it appears.

### How the audit runs (SPELL-08, ABIL-06; accepted 2026-09-30)
- **Tables:** `docs/SPELL-AUDIT.md` and `docs/SKILL-AUDIT.md`, one row per spell / per skill and ability, columns text / engine / canon / verdict (the milestone audit gate). The spell table covers each spell's to-hit roll (if any), damage dice, multipliers, duration, resist checks, school gates, and backfire and fumble odds; the skill table covers each cooldown or once-per-fight rule, auto-hit or forced crit, bonus terms, and who can use it.
- **Roll-high statement:** every to-hit or resist roll reads "+N to hit" or "hits on X–20 (d20)" with the real odds named; a damage die never reads like a to-hit roll. The spell text, the Grimoire, its chips and the foe card all agree with the engine.
- **Mismatch rule (same as Phase 89):** the engine follows the text unless the text is a typo or the user ruled otherwise; canon is the rulebook plus the prototype, with the user's rulings overriding both; material balance calls go into ONE batched `checkpoint:decision` for the user before they are built.
- **Who can use it:** each skill row names hero and Joiner use; a Joiner uses a skill the way its text describes.
- Each fixed row is pinned by a test (authored-ranges / roll-sign-consistency style) plus a text-vs-engine guard.

### Strength and Pommel Strike (SPELL-09, ABIL-07; accepted 2026-09-30)
- **Strength lasts 100 squares from the cast** (a full day of walking, whenever it is cast), stated as "for 100 squares". Today it ends at the next day boundary (every 100 squares walked, or camp), so it lasted 1–100 squares, and it doubled max HP (`engine/magic.js` `sp.kind === "might"`: `c.might` a flat d10, `c.strengthBoost` doubling `maxWP`; cleared in `engine/movement.js#newDay`).
- **Recasting Strength while live restarts the 100 squares;** it never stacks.
- **Pommel Strike is a real strike that also stuns:** the hero swings as normal (to-hit roll, full weapon damage) and a hit also makes the target lose its next turn (`applyPommel`: `f.stunned`). Cooldown stays 4 rounds. Today (`engine/abilities.js` `case "pommelStrike"`) it spends the action on the stun alone.
- **Joiner Fighters use Pommel Strike the same new way** (it is already their round-1 opener in `pickMemberAbility`; the member path is `engine/combat.js` ~L2252).

### New Special and Illusion spells (SPELL-10; accepted 2026-09-30)
- **At least one Special and one Illusion spell per level 1–5** (about ten), so the Summoner and the Illusionist have a real pick at every level.
- **The slate is drafted in the phase, then ruled by the user at a checkpoint before any is built:** the planner (or the first plan) drafts each spell from the rulebook's page-50 list (checking each spell's column; the PDF text extraction loses the table layout, and `pdftoppm` is not installed on this machine, so read the page another way or ask the user) and the candidates in the rulings note, with its effect, numbers, duration, resist, school and level gate. The user rules on the slate at a `checkpoint:decision`.
- **Reuse existing engine effects where they fit** (flight, invisibility, wards, stun/sleep, to-hit changes, the teleport path); a new system only where a spell cannot work otherwise.
- **Full integration:** new spells join the Magic User pools and school gates (`content/mu-chart.js`, keeping the gates meaningful), scrolls and store stock like every spell, each with its `EVENT_NARRATION` entry, rail twin and Grimoire entry.

### Gates (milestone)
- Greenfield: no dual code paths; old saves tolerant-load only (a saved book holding a removed spell loads tolerantly).
- New rolls from derived streams; existing draws never reorder.
- An `EVENT_NARRATION` entry for every new event (coverage guard).
- Moved fixtures measured, declared (before/after rationale) and regenerated: only those.
- `test/parity/prototype-master.js.txt` is never edited.
- No bot pass (Phase 92).

### Claude's Discretion
- The table layouts and row order; how the batched checkpoint groups calls; whether the SPELL-10 slate checkpoint and the balance checkpoint share one pause.
- Event names and payloads for the reworked spells; how Strength's 100-square window is stored (a `c.timers` squares record is the house pattern).
- Plan split and wave order.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/spells.js`: the SPELLS rows (`n`, `lvl`, `s` school, `kind`, `dmg`, `niche`, `txt`, `combatOnly`); Strength `kind: "might"`, `txt: "buff · you · +d10 damage till tomorrow"`.
- `content/mu-chart.js`: school gates by sub-class and level. `content/spell-level-overrides.js`.
- `content/abilities.js` / `content/skills.js`: Pommel Strike `cd: 4`, `tag: "opener"`.
- `engine/magic.js`: the cast resolver (`sp.kind` branches; `might` at ~L563).
- `engine/abilities.js`: `applyPommel`, `useAbility` cases; `engine/combat.js`: `pickMemberAbility`, the member ability path, `foeTurn`'s `f.stunned` / `f.asleep` skips, `loseTurn`.
- `engine/movement.js`: `newDay` (a day every 100 squares via `crossings(100)`, or camp).
- `engine/effects.js`: the squares/rounds timer records.
- Existing docs: `docs/SPELLS.md`, `docs/ABILITIES.md`, `docs/ROLL-LEDGER.md`.

### Established Patterns
- Roll-high convention (v2.1 ROLL-05); `roll-sign-consistency` and `authored-ranges` tests.
- Greenfield rules, derived rng streams, declared fixture moves, comparables carve-outs.
- Executor commits: plain `git commit` with the attribution trailer, never amend or reset.

### Integration Points
- Grimoire, spell chips, the foe card, the combat spell menu (level-sorted, uncastable hidden).
- Scroll reading (RULES-10), store stock, chargen `rollGrimoire`.

</code_context>

<specifics>
## Specific Ideas

- Report #8 (verbatim): "Strength spell says +d10 damage until tomorrow. But casting it actually grants you hit points instead."
- Report #4 (verbatim): "A pommel strike seems kind of pointless. I use my scrub to make them loose their action. It's a wash."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
