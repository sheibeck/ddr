# Phase 43: Clarity Pass - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — no research (roadmap: standard display sweep; user's per-run research policy). No grey area rose to a user question: the one conflict (the roadmap's Gear grouping vs Phase 37's worn model) is resolved by the user's own earlier ruling; the rest are routine display decisions recorded below.

<domain>
## Phase Boundary

Every cost the player pays names its cause from the event payload; every loot offer shows who can use a class-restricted item; ration math on the Hero sheet is honest and matches what Make Camp charges, with the race/class ration rules audited and ledgered; the Gear screen is two panels — ON YOU and BAG — and the bag-full drop prompt lists bag items only; the coverage guards stay green. This is a sweep over surfaces Phases 36–42 already gave cause payloads to — verify each, retrofit only where a payload is missing.

Requirements: CLAR-01 … CLAR-05.

Out of scope: any rule or balance change (the AFTER matrix is closed); new ration rules beyond what the audit finds in the prototype/rulebook; the tutorial (UX-06); the shell modularisation (cleanup milestone).

</domain>

<decisions>
## Implementation Decisions

### Standing rulings that bind this phase
- **Greenfield** (no dual paths; fixtures that move are declared — a display sweep should move none; `test/parity/prototype-master.js.txt` never edited). If the ration audit finds a rule the prototype has and the engine lacks, implementing it IS a rule change: declare it, measure the fixtures it moves (any fixture that rests), regenerate exactly those.
- **Deferred UAT**; **rail is the one feedback surface**; **HP not WP** in every player-facing string (this sweep is the moment to catch stragglers — grep the narration tables for ` wp` / `WP` in player copy); every new event or additive payload key → `EVENT_NARRATION` + `TOAST_FOR` + `RAIL_FAMILY`; `toastsCoverage.test.js` / `formatEventsCoverage.test.js` green (SC-5); voice scan green.
- **Phase 37 worn model is canon** (user ruling: one item per slot; staff is a WORN slot alongside ring/bracelet/amulet/helm/cloak). There are no shields in the game (only flavor text mentions them).

### CLAR-01 — costs name their cause (orchestrator decisions)
- Inventory first: every event whose narration states a cost (hp lost, gold spent, rations eaten, squares spent, an item consumed, a spell slot burned, loot forfeited) must carry the cause in its payload and the line must read "<Cause>: <plain-language why>. −N hp." style — cause first, cost last. The Phase 41 `phobiaTriggered`/`trappedPanic` lines are the model ("Being trapped: four walls and one door you already used. −4 hp.").
- Sweep list (verify, don't assume): traps (`trapTriggered`), falls (`fellClimbing`/`fellInGorge`), starvation/upkeep (`newDay` hunger), afflictions (poison/disease ticks), `trappedPanic`, summon backfire, Death potion, Earthquake self-hit, foe DOT ticks on the hero, store purchases/sells, ration consumption at camp, tool consumption, forfeited loot on flee, Cutthroat murder. Where a payload lacks the cause, add an ADDITIVE key (never rename existing keys — fixtures compare events) and re-point the line.
- The numeric cost is always stated when the engine knows it; if a line has no number (e.g. an item consumed) it names the item.

### CLAR-02 — "(usable by …)" on every loot offer
- One pure helper `usableBy(item)` in `src/browser/viewModels.js` (or `engine/derived.js` if the shell needs it in several places) reading the weapon/armor `cls` string (F/T/M) and staff/scroll class gating → `"(usable by Fighters, Thieves)"`; empty for unrestricted items. Shown on: encounter-dot FIND card, the victory LOOT screen rows, store rows (buy list), and the Company/Joiner offer where an item is involved. Items the current hero cannot use additionally read "not you" in the deadpan voice (e.g. "(usable by Fighters — not you)").

### CLAR-03 / CLAR-05 — rations honest and audited
- `nightlyEats(state)` (`engine/movement.js:549`) is the one definition: hero `RACES[race].eats || 1` + each member's; `makeCamp` refuses with `campFailed { reason: "noRations", need, have, members }`. The Hero sheet gets a RATIONS block: "You eat N a rest (race/class reason) · <Joiner> eats N · Party eats N a rest · N carried" — computed from `nightlyEats` and the same per-member reads, so it can never disagree with the refusal.
- **Audit (CLAR-05):** compare the engine's ration/upkeep rules against the prototype (`test/parity/prototype-master.js.txt` — read-only) and `mazeworld.pdf`/rulebook notes: today 1 a night, Troll 2, Heft halves wp upkeep only. Record every rule in `docs/RATIONS.md` (rule, source line, engine site, narration line). Implement any rule the audit finds missing (declared divergence + measured fixtures) and NAME every rule in the rest narration ("Trolls eat for two."). Each Joiner shows "eats N a rest" on the offer card and in the Company panel.

### CLAR-04 — Gear screen: ON YOU and BAG (resolves the roadmap's grouping against Phase 37)
- **ON YOU** = *Worn* (armor · cloak · ring · bracelet · amulet · helm · staff — the six `c.worn` slots plus armor) and *Wielded* (the weapon). The roadmap's "Carried: weapon, staff, shield" is superseded: staff is a worn slot per Phase 37 and there are no shields. **BAG** = everything in `c.items`. Each ON YOU row keeps its existing buttons (Use / Unequip / swap confirm); the worn-slot empty states read as slots ("ring — nothing", in voice).
- The bag-full drop prompt lists BAG items only (never worn/wielded) — verify the current prompt's source list and pin it.

### Claude's Discretion (planner)
- The exact cause-line wording per event (in voice); `usableBy` placement; the RATIONS block layout; `docs/RATIONS.md` and a `docs/CLARITY.md` ledger (or one combined) with the requirements map.
- Plan split; suggested waves: (1) CLAR-01 payload inventory + additive cause keys + narration rewrite (engine + `src/browser`, no shell); (2) CLAR-03/05 ration audit + `docs/RATIONS.md` + any declared rule + rest narration + Joiner "eats N"; (3) CLAR-02 `usableBy` + CLAR-04 two-panel Gear + drop prompt + Hero RATIONS block in `mazeworld.html` + ledger close + whole-phase gate + aggregated Pixel 7 checklist (this is the last phase — its SUMMARY also aggregates nothing beyond Phase 43; the milestone-close batch is assembled by the orchestrator from every phase's VERIFICATION).

</decisions>

<code_context>
## Existing Code Insights (verified 2026-09-18)

- `engine/movement.js#nightlyEats` (:549), `newDay` (:566), `makeCamp` (:715, `campFailed { reason: "noRations", need, have, members }`); `RACES[race].eats` in `content/races.js`; Heft upkeep halving in `newDay`/`upkeep()`.
- Narration tables: `src/browser/eventNarration.js` (`EVENT_NARRATION`), `src/browser/toasts.js` (`TOAST_FOR`, `toastsForAction`), `src/browser/rail.js` (`RAIL_FAMILY`, `RAIL_COPY`); guards `test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js`; voice scan `test/voice/safety-scan.test.js`.
- Phase 41 cause-line precedent: `phobiaTriggered { phobia, trigger }`, `trappedPanic` ("Four walls and one door you already used. −N hp.").
- Gear tab in `mazeworld.html` (Phase 37 worn rows with [Use]/[Unequip] + swap confirm; Phase 39 `itemRowState` READY / N SQ / cd N SQ); `SLOT_OF` in `content/treasure-tables.js`; `carriedItems`/`slotItems`/`bagCap` in `engine/items.js`; the bag-full drop prompt (Phase 29/30 loot + bag cap).
- Loot surfaces: FIND card (`RAIL_COPY.find`, `mzTakeFind`/`mzLeaveFind`), victory LOOT screen (`src/browser/lootScreen`? — verify; `shell-loot-screen.test.js` exists), store rows (`engine/economy.js` offers, `add(label, price, effect, params, why)`), Company/Joiner offer card.
- Class gating: weapons `cls: "FTM"` strings (`content/weapons.js`), armors `cls`, staves (Magic User only — verify where enforced), scrolls (`canRead`).
- Tests: 3002 green at `84c6722`; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`.

</code_context>

<specifics>
## Specific Ideas

- Cause lines: "Trap: a pressure plate you found with your foot. −6 hp." / "Hunger: nobody packed. −3 hp." / "Fall: the wall had other plans. −5 hp." / "Rations: the party ate. −3." / "Fled: the loot stays with them."
- RATIONS block: "You eat 1 a rest. Grunk (Troll) eats 2. Party: 3 a rest · 7 carried — two nights, then the arguing starts."
- "(usable by Fighters — not you)" on a Thief's find card for a Bardiche.

</specifics>

<deferred>
## Deferred Ideas

- Tutorial hooks on the new clarity surfaces → UX-06.
- Shell modularisation of the Gear/Hero tabs → cleanup milestone.

</deferred>

---

*Phase: 43-clarity-pass*
*Context gathered: 2026-09-18 via autonomous smart discuss (no grey area rose to a user question; decisions recorded)*
