# Phase 93: Quick Wins: Harmful Chips First & Cloak Heals on Use - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Two small, independent fixes that land first in v2.4:

- **CHIP-01 (view layer only):** on the hero's chip rows, every harmful condition chip sits at the far left, then the rest, each group in its existing relative order. Engine `conditionsOf` order and every fixture stay put.
- **ITEM-08 (the milestone's one rule change):** using the Cloak of Regeneration heals one tick at once, then the walking ticks follow. The instant tick draws from the heal-over-time derived stream, never the main rng. Joiners follow the same rule. The item text, chip, narration and rail twin, ITEM-AUDIT row, patch notes and the fair bot's cloak model all say the same thing. Any moved fixture is measured, declared and regenerated.

Not in this phase: Joiner or foe chip ordering, chip-row overflow handling (user, 2026-10-03: "CHIP-01 (hero chips, bad first) is enough"), the fantasy-flavour rewrite of the cloak's text (Phase 95 rewrites item text once, on top of this phase's final rules text), and any other balance change.

</domain>

<decisions>
## Implementation Decisions

### Cloak of Regeneration heals on use (ITEM-08)
- **Ruling (B), a fourth tick (user, 2026-10-03):** using the cloak heals a d6 at once, then a d6 at 10, 20 and 30 squares walked, exactly as today. That's 4 ticks and 4d6 per use (about 14 hp, up from 10.5). The 30-square window, the 50-square cooldown and the 80-square cycle (once a day) are unchanged. The walking ticks keep their marks at 10, 20 and 30.
- **The instant tick heals in a fight too (user, 2026-10-03).** The worn cloak's row is already in the combat ITEMS menu, so a mid-fight use heals the d6 at once. The follow-up ticks still come only from walking ("Fights do not count. Only walking does." stays true for them).
- **Narration reuses the existing tick line and its rail twin (user, 2026-10-03).** The instant heal is a `healTick` ("Cloak of Regeneration knits you back: +4 hp. Tick 1 of 4."; rail "+4 hp: Cloak of Regeneration (1/4)."). It's told right after the use's start line, which now says a d6 comes now and then every 10 squares, 3 more times. There's no new event type, so no new EVENT_NARRATION entry is needed. If one does get added anyway, it gets its rail twin and coverage per the engine gate. A use at full hp is told ("Nothing left to knit.") and spent, like any tick (Phase 88 rule, carried forward).
- **Joiners: no change to fight behaviour (user, 2026-10-03).** `knit` stays out of `MEMBER_COMBAT_KINDS` (a Joiner's round-1 opener fires at full hp and would waste the tick). When the player uses a Joiner's cloak (outside a fight), the Joiner gets the same instant tick (by name, from its own keyed stream: `"member", <partyIdx>` appended) and the same follow-ups. Taking the cloak off still stops any ticks left, through the Phase 88 source link.
- **One count everywhere:** the item `txt`, the Regenerating chip (3 ticks left right after a use, then 2, 1, gone), the Gear, store and find cards, the start line, the ITEM-AUDIT row (and a 2026-10-03 entry in its Rulings) and the patch-notes line all state the same rule: one d6 at once, then three more every 10 squares walked.
- **Rng:** the instant tick's d6 comes from the same keyed heal-over-time stream as the walking ticks (`derivedRng(<main cursor>, "healTick", <item key>, <tick>, state.steps[, "member", partyIdx])`). The main rng is only read for its cursor, so a seeded run that never uses the cloak plays out identically.
- **Fixtures:** only fixtures that use the cloak may move. Each one is measured, declared (before/after rationale) and regenerated: no blanket regeneration, and the master file is never edited.
- **Fair bot:** `tools/lib/tuning-bot.mjs` plays the new rule. `knitWindowHeal` reads 4 × 3.5 = 14 (pinned at 10.5 in `test/unit/bot-balance-close.test.js` today), and its use logic counts the heal that lands at once.
- **Price unchanged:** `engine/economy.js` keeps "Cloak of Regeneration": 1400. The buff is one d6 per 80 squares, and no economy or bot pass is planned in v2.4.

### Harmful chips first (CHIP-01)
- **Both hero chip rows (user, 2026-10-03):** the condition strip under the HUD (`#mm-conditions`, `paintConditions` in `mazeworld.html`) and the hero's card in YOUR LOT (`yourLotChipsFor` for `{ kind: "hero" }`). The strip stays visible during fights and is the only place Poisoned/Diseased show (YOUR LOT lists only the `fight: true` entries; `affliction` is `fight: false`).
- **Harmful = everything the engine marks `polarity: "bad"` (user, 2026-10-03):** affliction (Poisoned/Diseased), foeEffect (Weakened/Dazed), darkness, fearArmed, afraid, heroOut, heroBlind, heroShrunk, fightDark, insulted, selfDot. That includes the strip's amber-toned Darkness, Afraid and Fear-armed chips. Ether-in-stone (amber on the strip, but engine-good) stays in the good group.
- **Stable partition (roadmap criterion, locked):** bad first, then the rest, each group in its existing `conditionsOf` relative order. Poisoned/Diseased are already the first bad descriptors, so they land at the far left. A long row can only push good chips off the right edge.
- **One pure helper in `src/browser/heroConditions.js`** drives both rows, so the engine's `conditionsOf` / `memberConditionsOf` order and fixtures don't move. Joiner rows and foe chips keep today's order (user ruling, out of scope).

### Claude's Discretion
- The data shape for "one tick on use" in the cloak's `act.hot` (e.g. an on-use flag with three walking ticks, or four ticks where the first lands at use), the tick numbering, and the instant tick's stream key, as long as the walking marks stay at 10/20/30, the main rng is untouched and the chip and lines read "N of 4".
- The exact wording of the updated item text, start line and patch-notes line, in the house voice (sarcastic, family-friendly, rules-exact; Phase 95 later moves this text into the technical layer and writes flavour on top).
- The helper's name and where the hero-only ordering hooks in (e.g. a `harmfulFirst` export bridged on `window.__mzHeroChips`, applied in `paintConditions` and to the hero card only).
- Starting `docs/patch-notes/2.4.0.md` as a **DRAFT** (format in `docs/patch-notes/README.md`), with the cloak and chip lines; the user agrees it at release time per `docs/RELEASING.md`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/items.js#tickHealOverTime` (~L1579): the per-step heal-over-time tick for the hero and (since 89) each Joiner's sheet. It already pushes `healTick { type, item, amount, gained, tick, ticks, member? }`, clamps to maxWP and spends a full-hp tick.
- `engine/derived.js#healTicksDue` (~L740) and `#healTicksLeft` (~L759): the tick marks (tick k at k × every elapsed squares) and the Regenerating chip's "N ticks" count; `validHot` gates both.
- `engine/items.js#applyActivation` / `useItem` (~L1905): the `knit` case (~L2144) is a plain break today ("No instant heal and no main-rng draw on use"), and `partyHeal` (~L2086) shows the derived-stream heal pattern. Joiners use worn items through `memberUseWorn` / `MEMBER_SELF_KINDS` (~L1694).
- `src/browser/eventNarration.js` `healTick` (~L494) plus the knit start lines (~L2103, ~L2146); `src/browser/narrationLines.js` rail twins (`healTick` ~L1509, start lines ~L2850, ~L2887, take-off "ticks unspent" ~L2901).
- `src/browser/heroConditions.js#lotChips` (~L206): YOUR LOT chip models with `tone` from polarity. `HERO_CONDITIONS` is in conditionsOf's emit order.

### Established Patterns
- `engine/derived.js#conditionsOf` (~L1008) emits every good descriptor first and every bad one last, which is why harmful chips sit at the far right today.
- The strip's tone comes from `CONDITION_TONE` (`mazeworld.html` ~L3695): darkness, afraid and fearArmed are `warn` (amber); ether turns `warn` in stone; the fallback is polarity.
- Engine gate: pure and deterministic, new draws only from derived streams, new serialized fields carved out of the three `*Comparable()` fns, every new event type gets an EVENT_NARRATION entry plus its rail twin, moved fixtures declared.
- Heal-over-time tests in `test/unit/heal-over-time.test.js` (use window, chip 3/2/1, take-off) and `test/unit/heal-over-time-lines.test.js` (Oracle/rail wording, "Tick 1 of 3") pin today's rule and will move with (B). `test/unit/bot-balance-close.test.js` and `test/unit/bot-tactics.test.js` pin the bot's cloak reads.

### Integration Points
- Cloak data: `content/treasure-tables.js` (~L202-213, `txt` and `act`); `docs/ITEM-AUDIT.md` row (~L105) and its Rulings section; `engine/economy.js` price (unchanged).
- Chip rows: `paintConditions` (`mazeworld.html` ~L3956), `yourLotChipsFor` (`mazeworld.html` ~L5117), and the `window.__mzHeroChips` bridge (`mazeworld.html` ~L7396; registry entry `src/browser/bridge.js` ~L212).
- Fair bot: `tools/lib/tuning-bot.mjs` (`knitWindowHeal`, `chooseFieldItem`'s cloak-before-potion branch).
- Patch notes: `docs/patch-notes/` (2.3.0 is the latest), built by `tools/patch-notes.mjs`.

</code_context>

<specifics>
## Specific Ideas

- User, 2026-10-02, on 2.3.0: "Negative affects like disease/poison should always be on the far left slot for combat condition chits so they don't get pushed off the screen. We want them visible."
- User, 2026-10-02, on 2.3.0: "Cloak of Regeneration should do one tick of healing on activation, then after every x steps."
- History: Phase 88 (user, 2026-09-30) removed the old instant d6 on use: "The cloak should be active for 30 squares, healing 1d6 every 10 squares. Then it goes on cooldown for 50 squares." Ruling (B) adds the instant tick back on top of that schedule without touching it.
- Source todos: `.planning/todos/pending/2026-10-02-bad-condition-chips-first.md`, `.planning/todos/pending/2026-10-02-cloak-regeneration-tick-on-use.md` (both `resolves_phase: 93`).

</specifics>

<deferred>
## Deferred Ideas

- Joiner and foe chip ordering, and chip-row overflow handling: out of scope by the user's 2026-10-03 ruling.
- A hurt Joiner using its cloak on its own mid-fight: considered and declined for now (it would need a below-threshold gate in the Joiner's fight item pick).

</deferred>
