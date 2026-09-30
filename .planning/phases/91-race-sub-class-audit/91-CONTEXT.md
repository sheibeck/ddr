# Phase 91: Race & Sub-class Audit - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Every race and sub-class does what its blurb says. One audit table covers all 6 races and 24 sub-classes, trait by trait; each blurb and note states every advantage and drawback the engine applies; each mismatch is fixed with a test or ruled deliberate. A Wizard always opens with a direct-damage spell it can cast (IDENT-13); an Illusionist chooses where a teleport lands (IDENT-14, report #3). The user's 2026-09-30 identity rulings are built (IDENT-15..21), a successful parley pays experience and loot and is explained to the player (PARLEY-01), and the TEXT-01 wording applies to every identity row.

Requirements: IDENT-11, IDENT-12, IDENT-13, IDENT-14, IDENT-15, IDENT-16, IDENT-17, IDENT-18, IDENT-19, IDENT-20, IDENT-21, PARLEY-01, TEXT-01 (race and sub-class rows). No bot pass (Phase 92). Phase 91.1 (value review) follows and picks up anything this phase leaves open.

**Required reading for every plan:** `.planning/notes/v2.3-user-rulings-2026-09-30.md` (Races and sub-classes, Parley rewards, TEXT-01 sections; the exact rulings and the "Today" findings live there).

</domain>

<decisions>
## Implementation Decisions

### Already ruled by the user (2026-09-30, not re-asked; exact wording in the rulings note)
- **Cleric (IDENT-15):** cannot cast offensive spells (they gain more hit points); always starts with the level-1 Heal spell.
- **Pickpocket (IDENT-18):** whenever you gain an item from a chest or a monster, you gain one extra item as well; the shop drawback stays (+25% buy, −25% sell).
- **Cutthroat (IDENT-19):** whenever you descend with a Joiner, roll a d10; on a 1 that Joiner dies (replaces one-in-twenty).
- **Fridgian (IDENT-20):** Frenzy: each swing, a 4–6 on a d6 gives a second swing; no armour, thick hide soaks 2; the "never wastes itself on a corpse" line is removed (rework the engine rule to match if it differs).
- **Troll (IDENT-21):** store prices doubled (today tripled, weapons doubled again); text states 75 starting hit points and +11 damage (the Large +2 inside the 11).
- **Wilmsry (IDENT-21):** the drawback is reworded: you refuse to take Magic User Joiners on (not that they refuse you).
- **Wizard (IDENT-13):** always starts with at least one direct-damage level-1 spell it can cast on day one, drawn from the full level-1 pool (Wizard sub only; other Magic User subs keep the Phase 40 best-effort guarantee).
- **Ninja, Acrobat, Elven (TEXT-01):** "top two faces" is the crit range (the top two numbers of the strike die), say so plainly; rewrite "foes land only on their top four faces" in plain words; Elven: "can always parley with Humans, +3 on that parley roll".
- **Bard's dim-witted-foes drawback (IDENT-17):** foes with intelligence 3 or less always attack the Bard when a Joiner is in the fight (`pickFoeTarget`); keep it and say that plainly.

### How the audit runs (IDENT-11, IDENT-12, IDENT-13; accepted 2026-09-30)
- **Table:** `docs/IDENTITY-AUDIT.md`, one row per race (6) and sub-class (24), per trait (text / engine / canon / verdict), backed by `content/identity.js`'s existing trait → proof-test contract.
- **Blurb rule:** each blurb and each race/sub-class note states every advantage and drawback the engine applies, in the TEXT-01 wording; a guard test fails when a trait has no blurb line.
- **Mismatch rule (same as Phases 89/90):** the engine follows the text unless the text is a typo or the user ruled otherwise; canon is the rulebook plus the prototype under the user's rulings; material balance calls go into ONE batched `checkpoint:decision` before they are built.
- **Wizard sweep:** pinned across 1,000 seeds: every new Wizard has a castable direct-damage level-1 spell on day one.

### The Illusionist chooses where a teleport lands (IDENT-14, report #3; accepted 2026-09-30)
- **Map pick:** stepping on a teleport highlights every floor square the teleport can reach (up to 12 squares in any of the 8 directions, landing on floor only) and the player taps one on the map. Works in both movement modes: while the pick is open the map takes the tap even in ARROWS mode (the arrow-pad default must not block it).
- **LET IT CHOOSE:** a button takes today's automatic best direction (`engine/movement.js#bestTeleportDir`, fixed 12).
- **Reach stays 12 squares.**
- **Explored squares only (user, 2026-09-30, after planning):** the highlight lights only reachable floor squares the hero has already explored; fog stays fog and nothing is revealed by the pick (this overrides the 91-03/91-04 plans' "every floor square, fog included" reading). If no explored square is reachable, the card offers only LET IT CHOOSE.
- **A decision card** (it is a choice) that holds input until the player picks. The engine holds a pending teleport decision (no rng until the pick commits); save/quit mid-pick restores the pending pick.
- Today: `teleport()` picks `bestTeleportDir` for an Illusionist with no player input.

### The Master of Arms' drawback and parley rewards (IDENT-16, PARLEY-01; accepted 2026-09-30)
- **Master of Arms: never leaves a fight.** It cannot flee once a fight starts; with "can never parley" it fights every battle to the end. Replaces "no clean withdrawal in round one".
- **A successful parley pays full experience and the fight's normal spoils** (today: half experience, no loot).
- **The Human tip stays on top:** Human foes still pay d6×100×depth wilmst one time in six, in addition to the spoils.
- **Explain parley:** the parley card states what a parley is and what it pays; race, sub-class and Helm of Knowledge text say "can always parley with X".

### The Bard's song table (IDENT-17; accepted 2026-09-30 with the user's change)
- **SING is a combat action, once per fight** (user change 2026-09-30: "Let's allow this to be used once per fight as a combat action." This supersedes the rulings note's "once every 50 squares (twice a day)").
- **Full strength:** the song's effect is a random offense or defense spell at or below the Bard's level, resolved as if cast by a Magic User of the Bard's level (same dice, resists, durations), picked and rolled from a derived rng stream, no spell charges spent.
- **The pool:** every offense and defense spell at or below the Bard's level, including Phase 90's reworks; Special and Illusion spells are not in it.
- **Naming:** each song gets a sung title plus the spell it echoes (e.g. "An Ode to Ice: …"); the five old song names (Soothe the Savage, Inspire the Heart, Lullaby, Cry of Thunder, An Ode to Death) retire into the title list.
- **Joiner Bards** sing once per fight, automatically on their turn.
- Today: one song per 100 squares, always the highest of five fixed songs up to the Bard's level (`engine/combat.js` `SONGS`).

### School limits are stated and enforced (user, 2026-09-30, mid-run)
- Phase 90 builds the new Special and Illusion spells and enforces the school gates for them (see `90-CONTEXT.md`, "School gates hold for the new spells"). This audit checks every Magic User sub-class row: its blurb names the schools it can never learn, the Cleric's new offense ban (IDENT-15) joins the same gate data, and the identity proof tests cover each school limit.

### Checkpoint Q1–Q7 answered early (user, 2026-09-30, before 91-01 ran)
The known questions in 91-01's batched checkpoint were put to the user ahead of the audit. 91-01 records these in `docs/IDENTITY-AUDIT.md` `## Rulings` without re-asking; its checkpoint then asks only Q8 onward (the balance-moving mismatches the audit finds). If the audit finds nothing balance-moving, the checkpoint is skipped.
- **Q1 Pickpocket's gold take: B.** The extra item (IDENT-18) REPLACES the extra-gold take: `gainWilmst`'s Pickpocket bonus goes away; the blurb states the extra item and the shop drawback only. -> 91-08 (engine + pin), 91-10 (text)
- **Q2 Cleric hit points: A.** No new HP rule; the blurb states the real trade (chain mail, a shield, +1 to hit over other Magic Users) and the offense ban. -> 91-10
- **Q3 A Cleric's offense scroll: B.** RULES-10 stands: a scroll that rolls an offense spell still casts for a Cleric (the scroll pays for itself). The offense ban covers the Cleric's own grimoire and learning only; the Cleric blurb says so plainly (e.g. "cannot learn or cast offensive spells, though a scroll will still fire one"). No engine change in 91-09; pin that the scroll path still casts for a Cleric. -> 91-09 (pin), 91-10 (text)
- **Q4 Wilmsry potions: A.** Every healing potion the Wilmsry drinks heals double (found Healing and Xtra Healing too). -> 91-09
- **Q5 Race prices on selling: A.** Stores pay every race the ordinary price; the race multiplier is a buying rule only. -> 91-08 (with the Troll prices)
- **Q6 Fridgian frenzy after a kill: A.** The second swing is lost; the text says so. -> 91-10
- **Q7 Body traits on a Joiner: A.** A Joiner's own race and skill traits that protect its body apply like the hero's (a Fridgian Joiner's hide soaks 2 of every blow; Hardiness likewise). -> 91-09

### Gates (milestone)
- Greenfield: no dual code paths; old saves tolerant-load only.
- New rolls from derived streams; existing draws never reorder.
- An `EVENT_NARRATION` entry for every new event (coverage guard).
- Moved fixtures measured, declared (before/after rationale) and regenerated: only those.
- `test/parity/prototype-master.js.txt` is never edited.
- No bot pass (Phase 92); the bot plays the new rules (e.g. it answers the Illusionist's teleport pick and uses SING).

### Claude's Discretion
- The table layout; how the batched checkpoint groups calls.
- Event names and payloads; the sung-title list; how the teleport highlight is drawn (within the map palette and UI rulings).
- Plan split and wave order.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content/identity.js`: `side([goods], [bads])` rows with `trait(id, text, proofTest, proofName)`; Illusionist `illusionist-teleport` (L66-67); Master of Arms `moa-damage`, `moa-patch`, `moa-parley`, `moa-withdraw` (L112-121).
- `engine/movement.js`: `teleport()` (~L1106; Illusionist → `bestTeleportDir`, fixed 12; others two d8 directions and a d20 distance), `newDay`.
- `engine/combat.js`: `canParley`, parley resolution, `SONGS`, `pickFoeTarget`, flee (`C.tracked` clean withdrawal).
- `content/races.js`, `content/classes.js`, `content/mu-chart.js`, `engine/character.js#rollGrimoire`.

### Established Patterns
- Identity trait-contract tests (each trait names its proof test).
- Pending engine decisions answered by the shell (the climb card, the Joiner offer) and the rail decision card.
- Tap-to-move route builder and the arrow pad (`src/browser/controls.js`): features must work through both movement modes.

### Integration Points
- The rail (decision cards), the map canvas (highlight + tap), the combat action menu (SING), the parley card, the Hero tab blurbs, the store price path (`priceFor`).

</code_context>

<specifics>
## Specific Ideas

- Report #3 (verbatim): "I have a deserved illusionist. It says I choose where teleports takes me, but when I stepped on a teleport I didn't get to choose."
- "Let's allow this to be used once per fight as a combat action." (user, 2026-09-30, the Bard's SING)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
