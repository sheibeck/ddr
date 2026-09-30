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

### The SPELL-10 slate, ruled (user, 2026-09-30)
- **Accepted as drafted:** the ten spells in `90-SPELL-SLATE-DRAFT.md` (one Special and one Illusion per level 1–5), with the draft's numbers, `txt` lines, engine-reuse notes and rulebook sources: L1 Open/Lock (Special) and Door Illusion (Illusion); L2 Fly and Senseless; L3 Stop Time and Chameleon Tongue; L4 Enchant Character and Size of the Behemoth; L5 Speed of Sound and Duplicate Foe. Summon and Mirror Self stay. This slate replaces the "draft then checkpoint" step above: no slate checkpoint is needed in the plans.
- **Illusion is the Illusionist's alone (rulebook p.17):** Wizards lose the Illusion school (`MU_CHART.Wizard.illusion` becomes `null`); the Illusionist and the Apprentice keep it. Declare any fixture this moves; Phase 91's Wizard row states it.
- **Joiner Magic Users cast the new spells when useful:** extend the Joiner caster policy (`engine/combat.js` `alliesTurn` / `pickMemberAbility` pattern) so a Joiner casts buff/control spells from its own book when the fight calls for it (e.g. Stop Time against three or more foes, a heal or ward when low), not only attack spells; its book obeys the same school gates.
- **School bonus stretches the new spells:** each point of the caster's `MU_CHART` school bonus adds +1 round (round-timed spells) or +1 square-step (square-timed spells) to that school's new spells' durations, stated in the spell text as "+1 per school bonus point".
- **Orchestrator defaults the user did not override:** a new `utility` niche for Open/Lock and Fly; Chameleon Tongue at +4 on the parley roll; an Illusionist starts with Mirror Self, Door Illusion and one random Illusion spell (canon: three Illusion spells); Phase 92's bot pass watches Magic User death depth (Door Illusion's escape).
- The drafter's page-50 corrections to the rulings note (Chameleon Tongue is one Illusion spell; Stop Time is Special level 3; Possess and Werebeast are Divination) are canon; the rulebook describes none of these spells, so their effects are the slate's designs.

### The scroll roll table includes the new schools (user, 2026-09-30, mid-run)
- **User:** "Make sure that the scroll roll table now includes the two new schools of spell as options."
- `engine/magic.js#readScroll` rolls the scroll's spell from `SPELLS.filter(sp => sp.lvl <= Math.min(5, depth + 1))`, so the ten new Special and Illusion spells enter it by joining `SPELLS`, and the removed Lesser Summon and Phantom Host leave it. Pin it: a test asserts that, at each depth band, the scroll pool contains every new spell whose level is allowed there (both schools represented), and none of the removed spells. Reading follows RULES-10 (anyone may try; the scroll is consumed), so a scroll can roll an Illusion or Special spell for any reader; copying it into a book still obeys the school gates below. The pool-size change moves which spell a scroll rolls: measure, declare and regenerate only the fixtures/pins it moves. Any other scroll source (store "Sealed scroll", chest and find scrolls all feed the same `c.scrolls` count read here) needs no separate table.

### School gates hold for the new spells (user, 2026-09-30, mid-run)
- **User:** "We need to make sure that sub-classes or races that cannot cast [Special] or illusionist spell schools are properly excluded after we add those."
- **Rule:** every new Special and Illusion spell obeys the existing school gates: a sub-class whose `MU_CHART` school is `null` never learns, is dealt, copies or casts it (today: Warlock, Court Mage and Cleric have no Special or Illusion; Sorcerer and Summoner have no Illusion), and a `gate` level is honoured (`engine/derived.js#canLearn` / `schoolGate` / `canCast`). Any race or sub-class rule that forbids a school is honoured the same way.
- **Every path that hands out a spell is covered:** chargen `rollGrimoire` (hero and Joiner Magic Users), level-up spell picks, the Wizard's day-one pool, copying a scroll into the book (scribing), store and loot scroll offers made for the hero's own book, and the combat spell menu (a forbidden spell never shows as castable). One-shot scroll reading stays under the RULES-10 rule (anyone may try on an intelligence roll; the scroll is consumed) unless the audit finds the text promises otherwise; if it does, that goes to the batched checkpoint.
- **Pinned:** a seed-sweep test (every Magic User sub-class × a wide seed range × levels 1–5) proves no book ever holds, and no menu ever offers, a spell from a school that sub-class cannot learn, and a content guard fails if a new spell's `s` school is missing from `MU_CHART`. The Summoner's ruled exception (the level-2 Summon from level 1, SPELL-12) is written as an explicit, named exception in the gate data, never a name check scattered in code.

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
