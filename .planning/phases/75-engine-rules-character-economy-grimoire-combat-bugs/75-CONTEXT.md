# Phase 75: Engine Rules — Character, Economy, Grimoire & Combat Bugs - Context

**Gathered:** 2026-09-25 (collected ahead, while Phase 72 wave 5 executed)
**Status:** Ready for planning

<domain>
## Phase Boundary

Character creation, HP growth, spell legality, initiative, traps, ailments and armor destruction follow the rules the game claims (RULES-01..08). Everything is written in the roll-high convention from the start: any new or touched check uses Phase 73's roll-high helper, and any new event carries the high-is-good roll fields.

**In scope:**
- HP dots (verify and pin).
- The red-dot wilmst cache amount.
- Summoner/sub-class grimoire legality at grant time.
- The combat SPELLS menu filter.
- Sense Presence initiative and darkness.
- The trap-death root cause and fix.
- Honest ailment 5–6 narration.
- The destroyed-armor replacement line and the Gear note.

**Not in scope:**
- The Pilfer fumble and scroll reading (Phase 75.1).
- Darkness unification (Phase 76).
- Any display/sign work (Phase 74).
</domain>

<decisions>
## Implementation Decisions

### Character, economy and spells (user accepted 2026-09-25)
- **HP dots (RULES-01): verify, then pin.** `engine/difficulty.js#dotHpFor(kind)` is already the flat canon `DOT_HP_BASE[kind] × HERO_HP_SCALE` (USER RULING G §1, 54-07), so there's no feedback into max HP.
  - Reproduce on master: two "+25 HP" pulls on one hero grow max HP by exactly two flat steps (linear, never ×1.6 each), and the Table-4 toll row takes its ~36% share from that linear pool.
  - Pin it with a regression test. Change code ONLY if the test shows compounding survives somewhere, e.g. another +HP path such as the faerie, or the toll using an inflated pool.
- **Red-dot wilmst cache (RULES-02): a flat cut, `WILMST_CACHE_PER_DEPTH` 300 → 100** (`engine/encounters.js:262`), still passed through `lootFor(...)`.
  - The cache stays the best single find (≈ a good chest) and never buys out the store.
  - No new rng draw.
  - Measure and declare any moved fixture (`action-script.encounters.json`/economy), and record before/after in the difficulty ledger.
- **Grimoire legality (RULES-03):** never GRANT a spell the sub-class cannot cast at the level it is granted.
  - `rollGrimoire`, and every later learn path, skips/re-rolls picks whose school gate (`schoolGate(sub, school) > level`) or spell level exceeds the hero's level. A level-1 Summoner gets no offense spell.
  - If the re-roll would reorder chargen draws, take it from a derived stream (`makeRng(hash(seed, "grimoireGate", …))`), and measure and declare the chargen fixture mover. `test/parity/prototype-master.js.txt` is never edited.
- **Combat SPELLS menu (RULES-04):** HIDE level- and school-locked spells (not greyed).
  - Keep spells that are merely OUT OF CHARGES visible and disabled, because "no charges" is information.
  - The Hero-tab Grimoire keeps listing everything the book holds.
  - This reverses the old "disabled rows stay visible" choice for combat only (user ruling 2026-09-21).

### Combat and dungeon bugs (user accepted 2026-09-25)
- **Sense Presence (RULES-05)** means full skill in the dark and nothing gets the jump on you:
  - `resolveInitiative` puts `c.senses` in the foreseen/Acute Hearing branch, so the hero goes first with `why: "senses"`, narrated in voice ("You felt them coming."). BOTH initiative d20s are still drawn, so the draw count is unchanged.
  - `combatInDark` (combat.js ~L489) does not fire with senses.
  - The no-crit-in-dark clause (~L673) is waived with senses.
  - Update the Phase 40 JSDoc and `docs/SPELLS.md`.
  - No fixture carries `senses`; confirm with the fixture scan.
- **Trap death at 21 HP (RULES-06): debug first, then fix.**
  - Plan 1 is a root-cause session (gsd-debugger-style reproduction): a floor-2 trap at ~21 HP via the dev start-at-depth run, reading the engine event stream for the trap step, and checking HUD HP against `state.c.wp` after a fight ends by EVERY path (settle, hurry, tab switch, flee, kill, over-panel).
  - The leading hypothesis is a stale HUD after Phase 58's deferred paint. The alternatives are a trap that kills without its own line, or the narration printing the wrong number.
  - The fix plan depends on the confirmed root cause. It adds a test that the HUD HP equals state HP after every beat-ending path (if hypothesis 1), or the matching engine/narration test.
- **Ailment roll 5–6 (RULES-07): keep canon, fix the words.**
  - Rows 5–6 stay a disease of the mind that gives a phobia (`AFFLICTIONS` rows `{kind:"Disease", phobia:true}`), and the engine and content are unchanged.
  - `afflictionRolled` in `eventNarration.js` and `narrationLines.js` says so in voice instead of "Disease.". For example: "The die turns up 5. Not your body — your nerve." Then the existing "A new fear settles in: Fire." follows.
  - Pin it with narration tests for rolls 5, 6 and one real Disease row (2 or 8).
  - **The REQUIREMENTS.md RULES-07 text and ROADMAP Phase 75 success criterion 5 are amended to "narrates what it gives"** (the orchestrator edits them before planning).
- **Destroyed armor replaced (RULES-08):**
  - On every armor-replacing path (`equipItem`, `takeLoot` equip-now, `takeItem` store auto-equip), when the outgoing piece is destroyed (`c.armorWP <= 0`), add an additive payload to the existing event (e.g. `discarded: {…}, destroyed: true`). There is no new event type and no rng.
  - A voiced rail and Oracle line pairs with the existing `unequipSlot` destroyed line ("Your old leather was already in pieces. You leave it where it fell.").
  - The Gear sheet's EQUIP / SWAP INTO note for armor says "your worn armor is destroyed — it will be discarded" when it applies.
  - One test per path, using the destroyed-unequip test as the template.

### Engine gate (standing)
- Pure and deterministic. New rolls come from a derived stream.
- Measure moved fixtures, declare each in `test/parity/FIXTURE-INVENTORY.md`, and regenerate only those. Carve new serialized fields out of the three `*Comparable()` functions.
- Every new event gets an `EVENT_NARRATION` entry.
- Greenfield, with no dual paths.
- Old saves load tolerantly.

### Claude's Discretion
- Plan split and wave order (the trap debug plan runs first/in parallel; the rest are independent).
- Exact voice lines within the family-friendly deadpan voice.
- Whether any other +HP source needs the same linear pin.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/difficulty.js:540` `dotHpFor(kind)`, `lootFor(coin)` (~L558).
- `engine/encounters.js:262` `WILMST_CACHE_PER_DEPTH = 300`, used at ~L333 through `gainWilmst(state, lootFor(...), "tableFour", …)`.
- `engine/combat.js`:
  - `resolveInitiative` (~L176-205): `forcedFoe = (...) && !foreseen && !c.senses`, then `mine >= theirs`.
  - `combatInDark` (~L489).
  - The no-crit-in-dark clause (~L673).
- `engine/items.js`: `unequipSlot` destroyed handling (~L883-912, additive `destroyed: true`); `wornArmorItem` (~L684) returns null for a destroyed piece.
- Narration pairs: `src/browser/eventNarration.js` (~L1051) and `src/browser/narrationLines.js` (~L1704) for the destroyed unequip.
- `src/browser/combatMenu.js`: the SPELLS row builder, and its unit test.
- `content/afflictions.js` `AFFLICTIONS`, and `rollAffliction` (emits `afflictionRolled` then `phobiaAcquired` for rows 5–6).

### Established Patterns
- The Phase 25 additive-payload pattern: no new event type for a flag on an existing event.
- Derived rng streams for any new roll, via `makeRng(hash(seed, purpose, …))`.
- Todos with full detail:
  - `.planning/todos/pending/2026-09-21-table-4-hp-dots-…`
  - `…-red-dot-wilmst-cache-…`
  - `…-summoner-rolls-freeze-…`
  - `2026-09-22-trap-death-at-21-hp-…`
  - `2026-09-23-ailment-roll-5-6-…`
  - `…-narrate-a-destroyed-armor-piece-…`
  - `…-sense-presence-…`

### Integration Points
- Phase 73's roll-high helper and event fields: read `73-CONTEXT.md` and its SUMMARYs before touching any check.
- Phase 74's range/sign formatter, if any new line prints a roll.
- The HUD paint path (Phase 58's deferred paint) for RULES-06.
</code_context>

<specifics>
## Specific Ideas

- The device reports behind each item are quoted in the todos. The Pixel 7 checks at milestone close:
  - two "+25 HP" pulls grow max HP by two flat steps;
  - a red-dot cache on floors 1–3 pays less than a store-tier reset;
  - a new Summoner has no offense spell;
  - combat lists only castable-by-level spells;
  - Sense Presence on a dark square gives "you go first" with no "cannot see" line;
  - a floor-2 trap at ~21 HP never kills on a "−1 HP" line;
  - ailment 5–6 reads as a fear, not a disease;
  - swapping destroyed armor says the old piece is gone.
</specifics>

<deferred>
## Deferred Ideas

- Releasing `LOOT_SCALE` into a later fit block: out of scope. The cache becomes its own dial here.
</deferred>
