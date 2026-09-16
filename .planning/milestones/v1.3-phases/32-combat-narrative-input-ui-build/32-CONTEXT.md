# Phase 32: Combat Narrative & Input UI Build - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas proposed in batch tables; user accepted all

<domain>
## Phase Boundary

Build the design ratified in Phase 30 — the **Round Card** (`docs/COMBAT-NARRATIVE-DESIGN.md` §4, build contract §6): a combat round's narrative lands in ONE always-visible block inside the encounter panel (below the foe roster, above the action bar, replacing the "Last exchange" footnote) instead of a stack of toasts; moving on takes ≤1 deliberate tap; decision buttons are guarded by `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` = 250 ms `Date.now()` checks; nothing important dismisses on a map/D-pad tap. Requirements CMBUI-02..06. Shell + presentation + tests only — **no engine changes** (the engine surface Phase 31 shipped is the input: `combat.pending`, `fight`, `combatJoined {first}`, `needMods`/`afraid` payloads, refusal events).

Out of scope: the Oracle (unchanged and unabridged), out-of-combat toast rules (Phase 25/25.1), `CARD_EVENTS` Move-on cards (floorChanged/leveled), haptics (→ Phase 33 note), tutorial for the new surface (UX-06), the runner-up design (§5 — not ratified).

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Round Card content & lifetime (CMBUI-02, CMBUI-03)
- **Pre-Fight! preview** (Phase 31's `combat.pending`): the block shows the `encounterStarted` narration line (the §6.4 routing table sends encounter-start to the card) — roster + that one line + Fight!. No initiative/strike text until Fight! is tapped (Phase 31 rule).
- **Round 1 after Fight!**: the `fight` action's folded events — the `combatJoined` initiative line, any pre-emptive strike, and the Afraid line if the hero's phobia matches.
- **Block holds the current round only.** Header "Round N" (sarcastic tone allowed in the copy; "THIS ROUND" in the wireframe is a placeholder). The previous card **persists** across sub-menu opens (Spells/Items lists re-render the panel) and across refusal taps (refusals are toasts, not rounds) — only an action that yields combat events replaces it. Cleared at `endCombat`.
- **Line derivation**: each folded toast from `toastsForAction` becomes one line via `narrativeToastText` — same order, same text (the toasts already carry the Oracle sentence per Phase 25.1). Groupers (`enemyRound`, `yourRound`, `spellChain`, `killFold`, `encounterStart`, `fleeChain`, `parleyChain`, `chestChain`, …) are reused UNMODIFIED in their folding logic; only the output destination changes.
- **Storage**: transient presentation state (`S.roundCard = {round, lines}` or equivalent) on the shell side, never serialized (combat is transient anyway), never written into `S.log` — the card is a VIEW of the same `events[]` the Oracle consumes.
- **Line cap**: none. The block gets a max-height (~40% of the panel) with inner `overflow-y:auto` so the action bar's coordinates never move between rounds (§6.3 rule 3). A test measures the worst-case round (4 foes, frenzied, abilities) against the tuning harness and the SUMMARY records the line count; `enemyRound`'s 3+-collapse discipline is kept.

### Area 2 — Guards & input (CMBUI-04, CMBUI-05)
- **Module**: new pure module `src/browser/inputGuards.js` exporting `ARM_DELAY_MS = 250`, `DISMISS_SETTLE_MS = 250`, `isArmed(renderedAt, now)` and `isSettled(lastDismissAt, now)` predicates — unit-testable without DOM — bridged to the classic script as `window.__mzInputGuards` like the other bridges (`__mzConditionsOf`, `__mzCanCast`, …). Both guards are `Date.now()` comparisons; **never** a CSS transition/animation (`prefers-reduced-motion` sets `transition:none`, §6.3).
- **Arm-delay mechanism**: handler no-op. The button keeps its normal look (no 250 ms disabled flicker); `aria-disabled="true"` is set for the arm window and cleared after; a tap inside the window is swallowed silently (no toast). `renderedAt = Date.now()` recorded when `renderEncounter()` builds the button.
- **Keys**: Enter/Space/1 and the number keys go through the same arm check as taps. `DISMISS_SETTLE_MS` applies to keyboard moves too — one guard in `window.move` (`engineMove`): refuse while `Date.now() - lastDismissAt < DISMISS_SETTLE_MS`, where `lastDismissAt` is stamped when `hasActiveEncounter()` transitions true → false.
- **Guarded buttons** (exactly the §6.3 list): round-card action bar (Strike/Potion/Flee/Parley/Sing/Scroll/Spells/Items), Fight!, joiner accept/decline, loot per-row + Take all/Leave all, find Take/Leave, death Confirm AND Review the Oracle (same bar), `#enc-dismiss-slot` Move on. Every decision button renders INSIDE `#enc-panel` (hit-zone rule, structural).
- **Dismissal rule**: the round card has NO tap-to-dismiss gesture (rebuilt by the next render, never dismissed); no surface gains a tap-anywhere-to-dismiss behaviour.
- **Haptics**: out of scope for Phase 32 (§6.7: enhancer, never a decision factor). Note for Phase 33 in the SUMMARY.

### Area 3 — Toast suppression & tests
- **In-combat toast suppression**: while `state.combat` is non-null, `toastsForAction`'s output is routed to the card instead of `#mw-toast-host` — **except `PRIORITY.block` refusals, which stay toasts** (Phase 31 user ruling: a refusal is a direct response to the just-tapped button). No event is ever both toasted and carded (routing exclusivity test). `MAX_TOASTS`, lifetimes, tap-to-dismiss, Phase 25.1 rules stay for out-of-combat toasts.
- **Loot pile**: `lootDropped` mid-fight joins the card; `lootTaken`/`lootLeft` stay toasts at the loot card (Phase 29 ships).
- **`S.lastExchange`**: removed entirely (the card supersedes it in the same slot); its tests re-pinned to the card; `S.exchangeN` goes with it.
- **Tests**: re-pin the 89-test list from §6.8 (`narrativeToasts` 15 unchanged, `shell-toast-wiring` 21 re-pinned for routing, `feedback-payload` 37 re-pinned where a destination is asserted, `oracleLogViewModel` 8 + `shell-oracle-panel` 8 unchanged); add the three owed tests — `renderEncounter` round-card region source assertion (`test/unit/shell-loot-screen.test.js` style: readFileSync + stripComments), guard-constant assertions (both constants present, both compared against `Date.now()`, neither referencing `transitionend`/animation), routing exclusivity (no in-combat event type maps to both destinations). The 25-05 partition invariants (`TOAST_FOR`/`ORACLE_ONLY` exclusive; `FEATURE_EVENTS ⊆ TOAST_FOR`) keep passing. Baseline 1855/1855 → grows; `npm run build:www` exit 0 is a gate.
- **CMBUI-06 on-device DR round**: deferred to the end-of-run UAT batch (this run's rule); 32-VERIFICATION records it as a `human_verification` item; it does not gate `phase.complete`.

### Claude's Discretion
- Exact copy of the round header and any sarcastic framing lines (family-friendly; voice safety scan must pass).
- Whether `S.roundCard` lives on `S` or in a module-level shell variable, as long as it is never serialized.
- CSS for the block (`.round-card` or reuse `.exchange` styling), the max-height value, `aria-live="polite"` on a persistent wrapper that survives `#enc-body` innerHTML rebuilds (§6.7 Pitfall 1), `touch-action:manipulation` on anything tappable.
- How `renderEncounter` learns "this action produced combat events" (e.g. `dispatchWithToasts` hands the folded toasts to the card when `state.combat` is set).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/toasts.js` — `toastsForAction` and its pure groupers, `PRIORITY` tiers (`block` = refusals), `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`CARD_EVENTS`, `narrativeToastText`, `toastLifetime`, `MAX_TOASTS`. The card retargets OUTPUT only.
- `mazeworld.html#renderEncounter` (~L4869) — rebuilds `#enc-body` per render: head, foe roster (always first), the `S.lastExchange` "Last exchange" `.exchange` block (~L5266, the card's slot), the `.actions` bar (`#a-strike` … via `window.mzAttack` etc.), the Fight! gate on `C.pending` (Phase 31), loot/joiner/find/death cards, `#enc-dismiss-slot` Move on. `hasActiveEncounter()` (~L4761); `window.move = engineMove` (~L6117) carries the movement guard.
- `src/browser/controls.js` — `TAP_MOVE_THRESHOLD_PX = 10`, `TAP_MAX_DURATION_MS = 350` (sibling constants; `inputGuards.js` is the new home for the two timing guards).
- Bridges pattern: `window.__mzConditionsOf`, `window.__mzCanCast`, `window.__mzLootReport`, `window.__mzArmorDisplay` — module script exposes pure helpers to the classic script.
- Phase 31 shell wiring (31-03-SUMMARY "Phase 32 hand-off"): `mzFight → engineCombatAction("fight")`, preview gated on `C.pending`, AMBUSH special case gone, `CONDITION_COPY.afraid/ward`, `dispatchWithToasts` → `noteCombat`.
- `#mw-toast-host` is `aria-live="polite" aria-atomic="false"`; the blanket `prefers-reduced-motion` rule at mazeworld.html ~L773.

### Established Patterns
- Source-assertion tests (`test/unit/shell-loot-screen.test.js`, `shell-fight-gate.test.js`): readFileSync + comment strip + regex pins on `mazeworld.html`.
- Presentation coverage guard: every event type in exactly one of `TOAST_FOR`/`ORACLE_ONLY`; every type in `EVENT_NARRATION`.
- Voice safety scan over new copy.
- Executor gate: `npm test` `# fail 0`, `npm run build:www` exit 0, `test/parity/prototype-master.js.txt` untouched (no engine work → no parity risk; prove with `git diff --stat -- engine content test/parity` empty).

### Integration Points
- `dispatchWithToasts` (module script) → in combat: card lines instead of `mzToast` calls, refusals still `mzToast`; → `renderEncounter` reads the card state.
- `endCombat` / `noteCombat` → clear the card; loot card unchanged (`window.__mzLootReport`).
- `engineMove` guard + `hasActiveEncounter` transition → `lastDismissAt`.

</code_context>

<specifics>
## Specific Ideas

- User pain points this phase closes: the round narrative arriving as a toast stack; dismiss-then-continue chains; Fight!/Joiner/loot/Move-on buttons firing under a D-pad thumb after a rapid re-render; important cards dismissed by incidental movement taps.
- The user's earlier question "aren't we getting rid of toasts entirely?" was resolved: in-combat NARRATIVE toasts go away (into the card); REFUSALS stay toasts; out-of-combat toasts stay.

</specifics>

<deferred>
## Deferred Ideas

- Haptic tap on hit/kill (`src/browser/haptics.js`, Settings toggle exists) → Phase 33 candidate.
- Tutorial for the new combat surface → UX-06.
- On-device DR round (CMBUI-06) → end-of-run UAT batch.

</deferred>
