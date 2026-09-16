# Phase 30: Combat Narrative & Input — Research

**Researched:** 2026-09-16
**Domain:** Mobile combat-feedback UX patterns (turn-based roguelike/RPG) + a code audit of this shell's current toast/card/beats system
**Confidence:** MEDIUM — code-read findings are HIGH (direct source inspection, counts verified by importing the live modules); design-survey findings are MEDIUM (WebSearch only, no `exa`/`brave`/`tavily`/`ref` providers configured in `.planning/config.json` — all `false` — so every citation below is built-in `WebSearch`, tagged `[CITED: url]` where the source is an official/authoritative page and `[ASSUMED]` where it leans on developer-interview or wiki summary rather than a primary spec)

## Summary

Today's combat feedback is architecturally sound (a clean toast-summary / Oracle-full-log split, already-shipped grouping logic that folds a busy round's raw engine events down to at most 4 toasts) but two real problems remain, and neither is what "D-pad tap-through" would suggest. First, **there is no physical D-pad overlap during combat** — `#enc-panel` (`.mw-overlay`) is `position:absolute; inset:0` over `.mazebox`, which contains BOTH the map viewport and `.mazefoot`'s D-pad/Make-Camp bar, so the D-pad is fully covered (not just visually — for hit-testing too) whenever any encounter surface is up. The real mis-tap risk is **rapid-re-render coordinate collision**: `renderEncounter()` wires every button's `.onclick` synchronously in the same tick it rebuilds `#enc-body`'s `innerHTML`, with zero arm delay anywhere in the codebase (confirmed by grep: no `pointerdown`/`setTimeout`/`armed` guard exists on any card button). A fast double-tap where the second tap lands after the DOM has already swapped in a *new* button at the same screen coordinate (e.g., "Move on" → the next round's "1·Strike" rendering in roughly the same spot) fires unintentionally — and a rapid tap whose `touchend` arrives just after an overlay dismisses (`hasActiveEncounter()` flips false) can land on the now-exposed D-pad. Second, and the actual CMBUI-02 complaint: even with 25/25.1's aggregation pipeline (`toastsForAction`'s `enemyRound`/`yourRound`/`spellChain` groupers), a busy round can still surface up to `MAX_TOASTS=4` independently-timed, independently-dismissible toast cards, which reads as "a stack," not "one coherent place."

The design survey compared six patterns against a weighted scorecard (taps-to-move-on, narrative coherence, thumb-safety, Oracle-fit, voice room, implementation cost, session pacing). **The batched round-summary card wins clearly (4.75/5 weighted)** — it is the same proven pattern Phase 29 already shipped for end-of-combat loot (fold report + decision into ONE card, no dismiss-then-continue chain), generalized to every round. The runner-up is a **guarded, bundled toast** (keep the floating-toast aesthetic but fold a round's events into ONE toast instead of up to four, and add the same arm-delay/settle-window guards) — lower implementation risk and less test churn, but weaker on narrative coherence and Oracle-adjacency.

**Primary recommendation:** Extend the `S.beats`/Phase-29-loot-card machinery into an always-visible, in-panel "round narrative" block (reusing `toastsForAction`'s existing event-grouping functions against a DOM target instead of ephemeral toast objects), paired with a mandatory two-part guard layer: a 250ms per-surface arm delay on every decision button, and a 250ms post-dismiss settle window before the D-pad/map accepts input again. Out-of-combat toasts (Phase 25/25.1) are untouched; in-combat per-event toasts are replaced; refusals (`strikeRefused`, `noChargesLeft`, etc.) stay toasts because they are direct responses to the player's own just-tapped button, not round narrative.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Round event generation (strike/foe-turn/ability resolution) | Engine (`engine/combat.js`) | — | Pure/deterministic per the Engine Gate; already emits a flat `events[]` array per dispatched action |
| Round narrative grouping/folding (who hit whom, how many times) | Browser presentation (`src/browser/toasts.js`) | — | `toastsForAction`'s existing groupers (`enemyRound`/`yourRound`/`spellChain`/`killFold`) are pure, DOM-free, and already solve this exact folding problem for toasts — Phase 32 retargets their OUTPUT, not their logic |
| Round narrative rendering (the on-screen surface) | Browser DOM (`mazeworld.html#renderEncounter`) | — | `renderEncounter` already owns every combat-time card/branch; the round surface is one more branch in the same function, not a new subsystem |
| Mis-tap guard (arm delay, settle window) | Browser DOM (`mazeworld.html`, `src/browser/controls.js`-adjacent) | — | Presentation-only timing state; no engine involvement; extends the existing tap/drag-classification numeric vocabulary (`TAP_MOVE_THRESHOLD_PX`, `TAP_MAX_DURATION_MS`) already established in `controls.js` |
| Complete event log (Oracle) | Browser DOM (`#screen-oracle`, `eventNarration.js`) | — | Unaffected by this phase — remains the full, unabridged transcript; the round surface is a VIEW derived from the same event stream, never a second writer |
| Out-of-combat toast rules | Browser DOM (`toasts.js` `NARRATIVE_ACTIONS`/`CARD_EVENTS`) | — | Phase 25/25.1 stand untouched; this phase scopes strictly to IN-combat per-event toasts |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMBUI-01 | A written survey of known combat-feedback patterns with a recommended design, recorded in `docs/` and as a Key Decision before implementation starts | §Pattern Survey, §Scorecard, §Recommended Design, §Runner-Up, §Build Contract below give the planner everything needed to task an executor with writing `docs/COMBAT-NARRATIVE-DESIGN.md` in the section order CONTEXT.md locks (current-state → survey table → scorecard → recommendation-with-tradeoffs → Phase-32 build contract) |

</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Survey scope & sources (CMBUI-01)**
- Patterns compared: the five named in the requirement — (1) scrolling combat log / ledger, (2) batched round-summary card, (3) auto-advance with tap-to-pause, (4) ticker / marquee, (5) mis-tap guards (arm delay, hit-zone separation, distinct gesture) — plus (6) TODAY'S per-event toast stack as the explicit baseline row.
- Web research IS allowed for this phase: each pattern illustrated by 2–3 shipped mobile roguelikes / turn-based RPGs, each cited with a URL.
- Evaluation is a WEIGHTED SCORECARD fixed before scoring: taps-to-move-on (CMBUI-03), narrative coherence per round (CMBUI-02), thumb-safety with the D-pad under the thumb (CMBUI-04/05), Oracle-remains-the-log fit, room for the game's sarcastic voice, implementation cost inside the existing toast/card/beats system (`src/browser/toasts.js`, `renderEncounter`, `S.beats`), 5–10-minute session pacing.
- Deliverable: `docs/COMBAT-NARRATIVE-DESIGN.md` with, in order: current-state description (what the player sees today, with the toast/card inventory), survey table (pattern × examples × how it handles each criterion), the scorecard, the recommended design with tradeoffs stated against EACH alternative, and a Phase 32 BUILD CONTRACT: screen anatomy, tap budget per state, guard rules (numbers), what stays a toast vs. joins the round surface, and Oracle behaviour.

**Design constraints the recommendation MUST satisfy**
- Tap budget: at most ONE deliberate tap to move on after a round and after an encounter (CMBUI-03); ZERO taps needed to READ a round — the narrative is on screen without dismissing anything first.
- The Oracle stays the complete, unabridged log; the new surface is a VIEW of the current round/encounter, never a second source of truth.
- Toasts survive for out-of-combat events (Phase 25/25.1 rules stand). IN combat, per-event toasts are replaced by the chosen round surface — no double-reporting of the same event.
- Thumb-safety: decision buttons never share the D-pad's hit zone; they never fire in roughly the first 250 ms after appearing (arm delay); nothing important dismisses on a tap that lands on the map/D-pad region. All three properties are required; the design proposes the concrete geometry/timing.

**Ratification & hand-off**
- ONE pause at the end of Phase 30: the orchestrator presents the recommended design and its top runner-up (one AskUserQuestion, with the scorecard summary) and the user picks or redirects.
- The Key Decision row is written to PROJECT.md IMMEDIATELY after the user's pick, still inside Phase 30.
- Phase 31 stays engine-only and does not touch the combat narrative surface; Phase 32 builds the ratified design from the build contract.
- On-device validation of the design stays in Phase 32 (CMBUI-06), batched into end-of-run UAT; Phase 30 is paper-only.

### Claude's Discretion
- Scorecard weights (must be stated and justified in the doc before scoring). — See §Scorecard Weights below.
- Which shipped games illustrate each pattern, and how many (2–3 each). — See §Pattern Survey.
- Whether the build contract includes ASCII/markdown wireframes (recommended: yes, one per state). — Included, §Build Contract.

### Deferred Ideas (OUT OF SCOPE)
- Any implementation → Phase 32.
- Haptic feedback on hits/traps (`@capacitor/haptics` already present) — may be mentioned as an enhancer but is not part of the survey's decision.
- Tutorial for the new combat surface → UX-06 (deliberately last).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Android/Google Play only (Capacitor WebView wrapper) — no iOS. Portrait, one-thumb operation is the baseline assumption for every wireframe below.
- Fully offline, no ads/IAP/network SDKs — the recommendation introduces zero new dependencies (pure vanilla-JS/CSS, no packages).
- Family-friendly sarcastic/deadpan voice is a core identity requirement — factored directly into the scorecard's "voice room" criterion.
- Rules engine must stay decoupled from UI and fully serializable — this phase is presentation-only by design (paper-only phase; Phase 32 implements, and even then only in `src/browser/*`/`mazeworld.html`, never `engine/*`).

---

## Current State — Code Read

### The toast system (`src/browser/toasts.js`, 1272 lines)

Verified via live module import (`node --input-type=module -e "import('./src/browser/toasts.js')..."`):

| Constant/Set | Live value | Purpose |
|---|---|---|
| `TOAST_FOR` | **199 entries** (verified via `Object.keys().length`; grew from the 189 cited in STATE.md's 25-01 decision log as later phases added events) | Every toasting event type's `(e, ctx) => {text, tone, priority}` builder |
| `ORACLE_ONLY` | **20 entries** | Events with NO toast (already have a dedicated screen/HUD field, or are pure roll/step detail) |
| `FEATURE_EVENTS` | **66 entries** | The class/sub-class/race feature + refusal manifest (25-CONTEXT.md), a strict subset of `TOAST_FOR` |
| `MAX_TOASTS` | `4` | Hard visible cap after aggregation/dedup/priority-sort |
| `PRIORITY` | `{block:0, you:1, them:2, feature:3, other:4}` | Sort order — refusals always surface first, never dropped by the cap |
| `CARD_EVENTS` | `{floorChanged, leveled}` | The ONLY move-path events that still earn the dismissible "Move on" card (Phase 25.1 DFB-01) |
| `NARRATIVE_ACTIONS` | `{move, camp, resolveJoiner}` | Action types whose toasts carry the Oracle's own stripped sentence instead of the terse table text |
| `TOAST_BASE_MS` / `TOAST_PER_CHAR_MS` / `TOAST_CAP_MS` / `TOAST_STACK_BONUS_MS` | `3000` / `60` / `9000` / `1200` | `toastLifetime(len, visible) = min(9000, 3000 + 60·len) + 1200·clamp(visible,0,3)` — worst case a toast lingers 9000+3600 = **12,600 ms** when 3 others are already stacked |

`toastsForAction(type, events, ctx)` is the per-action pipeline (already does real work before anything reaches the DOM): `encounterStart` folds `encounterStarted` + its same-action followers into one toast; `enemyRound` groups `struckByFoe`/`foeMissed` by foe name (3+ distinct foes collapse into one "`N` foes swing…" toast) and `memberStruck`/`foeMissed(member)` separately at lower priority; `yourRound` groups `struck`/`strikeMissed` by target; `spellChain` folds `spellThrown`→outcome (3+ targets collapse to one "Lightning-style" toast); `fleeChain`/`parleyChain`/`chestChain` fold a roll event into its outcome; `killFold` appends "· felled" to the toast whose target a still-unconsumed `foeKilled` names; everything left maps through `TOAST_FOR` directly; results are deduped by type, sorted by priority, and **sliced to `MAX_TOASTS=4`**.

**This is the key finding for the scorecard's implementation-cost criterion:** the hard narrative-folding work (grouping simultaneous strikes/misses by target, collapsing 3+-foe rounds, chaining rolls to outcomes) is ALREADY WRITTEN, pure, and tested. A round-surface redesign does not need to reinvent this logic — it needs to retarget where the grouped output goes (a persistent DOM block instead of an array of ephemeral toast objects with individual lifetimes).

### `renderEncounter()` (`mazeworld.html`, function starts line 4832, ~440 lines)

One function owns every combat-time surface as a sequential set of early-return branches, checked in this order: `S.dead` (death card) → `S.won` (victory card) → `S.beats` (floor-change/level-up "Move on" card, or the DR17 `awaitingFight` ambush-preview roster) → `S.pendingLoot` (Phase 29's loot card) → `S.pendingJoiner` (accept/decline) → `S.pendingFind` (take/leave, or the full-bag drop-shelf chooser) → `S.store` → else the live combat panel (foe roster, `C.awaitingFight` Fight!-gate, then the action bar: Strike/Potion/Flee/Spells/Parley/Sing/Scroll, keyed 1–7).

`#enc-panel` is `.mw-overlay`: `position:absolute; inset:0` inside `.mazebox` — the SAME positioned ancestor that also contains `.mazefoot` (the D-pad + Make Camp bar). **Confirmed: while any encounter surface is active, the entire D-pad is physically covered** (not just z-index-hidden — an opaque `.mw-overlay` background at `z-index:8` intercepts pointer events too), so there is no tap-through path from an overlay button to the D-pad today. `hasActiveEncounter()` (line 4724) is the single predicate gating both the overlay's visibility AND `window.move`'s input guard: `S.dead || S.won || S.combat || S.store || S.pendingJoiner || S.pendingFind || (S.pendingLoot?.length) || (S.beats?.groups?.length)`.

**No arm-delay/hit-test protection exists anywhere.** Grep across `mazeworld.html` for `pointerdown|setTimeout|armed|pointer-events|disabled=` found zero card-button guards — every `.onclick` handler is wired synchronously in the same tick `#enc-body.innerHTML` is rebuilt (e.g., `document.getElementById("a-fight").onclick = () => window.mzFight?.();` fires immediately after the HTML string is assigned). The only source comment using the word "armed" (line 4752) describes the death card's CONFIRM button as *deliberately* un-guarded ("a single armed CONFIRM (no read-it-first/... lock)") — i.e. "armed" there means "always clickable," the opposite of a safety gate.

The one existing precedent for *positional* mis-tap avoidance: DR16 Fix 4 moved the beats "Move on"/"Next" button into a dedicated header slot (`#enc-dismiss-slot`, top-right) specifically "keeping it clear of the D-pad zone" (comment at line 4919-4922) — but this is a fixed-position choice, not a time-gated one, and it predates the loot/joiner/find cards, which all still render their primary actions in the bottom `.actions` row.

**The real mis-tap mechanism (not D-pad bleed-through):** a fast double-tap where the second touch lands (a) on a NEW button rendered at the same screen coordinate as an OLD button in the previous render (round N's "Move on" at position X, round N+1's "1·Strike" also near position X), or (b) on the map/D-pad the instant AFTER an overlay's `hidden` flag flips to `true` inside the same synchronous click handler that dismisses it (loot pile empties → `hasActiveEncounter()` returns `false` → the D-pad is live again before the browser has even processed the second `touchend` of an eager double-tap). Both are classic mobile "rapid sequential tap on a just-changed surface" bugs, and both are exactly what a per-surface arm delay + a post-dismiss settle window fix (see §Build Contract).

`#mw-toast-host` (line 1342, CSS at line 694) is `position:fixed; top:calc(102px + safe-area-inset-top)` — **it floats near the TOP of the screen, not near the D-pad** (CSS confirmed, lines 693-702). So today's toast stack does not physically compete with the D-pad's hit zone either; the toast pain point is purely about volume/coherence (up to 4 stacked cards, `pointer-events:auto` only on the individual `.mw-toast` elements), not about accidental dismissal from a movement tap.

**Loot card (Phase 29, `renderEncounter` lines ~4945-4973)** is the existing proof-of-concept for "batched round summary": `noteCombat()` hands the end-of-fight report to `window.__mzLootReport` instead of building a `S.beats` "Move on" card, so the player sees the combat report AND the take/leave decision folded into ONE card — explicitly documented in-code as avoiding "a dismiss-then-continue chain." The recommended design below generalizes this exact, already-shipped pattern to per-round narrative.

### Oracle log (`src/browser/eventNarration.js` + `src/browser/viewModels.js#oracleLogViewModel`)

`EVENT_NARRATION` has **218 entries** (verified via live import) — the full-sentence, dice-included narration for every engine event type; `TOAST_FOR` (199) + `ORACLE_ONLY` (20) = 219, a near-total overlap of the same event-type universe (the 1-entry gap is not worth chasing — a handful of pure bookkeeping events narrate but never toast or vice versa; the architecture is a clean two-writer split, not a leak). `oracleLogViewModel(entries, diceMode)` reverses the oldest-first accumulated log to newest-first for display, with a `revealable`/`revealedByDefault` flag per row driven by the dice-reveal setting (`on tap` default / `always` / `never`). The Oracle is `#screen-oracle`, a full-tab screen (not an overlay) — per Phase 25.1 DFB-03, opening the ORACLE tab always calls `window.__mzOracleToNewest()`, landing on the most recent line. This is unaffected by Phase 30/32's scope — the round surface derives its grouped text from a COPY of the same `events[]` array the Oracle's own `logLine` calls already consume independently; the round surface is never a second writer.

### Tests pinning today's behavior (will need re-pinning in Phase 32, not this phase)

| Test file | Test count | What it pins |
|---|---|---|
| `test/unit/narrativeToasts.test.js` | 15 | `narrativeToastText` HTML-stripping/entity-decoding contract |
| `test/unit/shell-toast-wiring.test.js` | 28 | The shell's toast-host wiring, dismiss/lifetime behavior |
| `test/unit/feedback-payload.test.js` | 38 | Toast/Oracle payload shapes for FEED-01..06 events |
| `test/unit/oracleLogViewModel.test.js` | 8 | `oracleLogViewModel`'s reverse/reveal-mode contract |
| `test/unit/shell-oracle-panel.test.js` | 9 | The Oracle tab's DOM wiring and "opens at newest" behavior |
| **Total directly pinning toast/card/Oracle surfaces** | **98** | — |

25-05's `toastsCoverage`/`toastTable` tests additionally assert the `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS` partition invariants (every event type in exactly one of the toast/oracle-only buckets, `FEATURE_EVENTS ⊆ TOAST_FOR`, disjoint from `ORACLE_ONLY`) — a Phase 32 redesign that keeps events flowing through `toastsForAction`'s existing groupers (just retargeting the output) should preserve these invariants structurally; a redesign that bypasses `toastsForAction` entirely would need new coverage guards.

### Round event volume (quantifying "a stack of toasts")

From `engine/combat.js`: `PARTY_CAP = 1` (`engine/state.js:50` — at most one persistent party member), `FOE_CAP_MAX = 4` (`engine/difficulty.js:139`, the deep-floor cap; lower at shallow depth via `difficultyCurve`). `afterPlayerAction` (line 1025) runs, per dispatched player action: the player's own strike/spell-chain (1-3 events) → `allyTurn` (a summoned ally, 0-2 events) → `alliesTurn` (the one persistent party member, 0-3+ events, possibly its own spell chain via `allyCast`) → `foeTurn` (line 1597, up to 4 foes, each potentially: a pending-summon join, a regen tick, an acid tick, an asleep/flee check, an ability resolution with its own multi-event chain, OR `(frenzied?2:1)*(sp.atk||1)` melee swings, each producing a `struckByFoe`/`foeMissed` + possible `armorSoaked`) → **possibly a SECOND `foeTurn`** if the foes win the round's freshly-rolled initiative (line 1058, the "foes act first in the newly-begun round" case). A busy round with 3-4 foes, one frenzied or multi-attack (`sp.atk:2`), plus a party member and a spell cast can easily emit **10-15 raw engine event objects** in one dispatched action. `toastsForAction`'s grouping collapses this to at most `MAX_TOASTS=4` visible toasts — but that is still up to 4 independently-timed (3-12.6s lingering each), independently-dismissible cards competing for the player's attention every single round, which is precisely the CMBUI-02 problem statement even after 25/25.1's aggregation work already landed.

### Baseline

`npm test` run fresh this session: **1593/1593 passing, 0 failures** (16.8s). Matches the Phase 29 SUMMARY's recorded baseline exactly — confirmed, not stale.

---

## Pattern Survey

Six patterns compared: the five named in CMBUI-01 plus today's baseline. 2-3 shipped examples per pattern, WebSearch-cited (no curated MCP provider configured this session — `exa_search`/`brave_search`/`tavily_search`/`ref_search`/`firecrawl`/`jina`/`perplexity` are all `false` in `.planning/config.json`, so every citation below used the built-in `WebSearch` tool; tagged `[CITED]` for official/primary pages, `[ASSUMED]` for wiki/interview summaries not independently re-verified).

### Pattern 1 — Scrolling combat log / ledger

A persistent, append-only list of short event lines inside (or beside) the combat panel — the classic roguelike message-log convention, sometimes gated by a `--more--` prompt when the log fills the screen.

- **Dungeon Crawl Stone Soup / traditional roguelike message logs** `[ASSUMED]` — the genre-standard pattern: every action appends a terse line ("You hit the goblin.", "The goblin misses you."); long bursts trigger a `--more--`-style pause so nothing scrolls off unread. WebSearch could not surface DCSS's own mobile-specific log documentation this session; treated as genre convention, not a directly-cited implementation detail.
- **Cogmind's message log** `[ASSUMED]` — cited by reputation as one of the more elaborate combat-log UIs in the genre (color-coded, filterable); not independently verified via WebSearch this session (search budget prioritized higher-signal mobile-specific queries below).
- **Generic roguelike log architecture** `[CITED: yosenspace.com/posts/lets-code-roguelike-tutorial-part7-enhancing-ui.html]` — confirms the standard implementation shape: a line is appended per event, the panel renders a bounded window of the most recent lines, two-pass rendering (count what fits, then draw) is the common technique for wrapped multi-line messages.

**Fit for this game:** structurally this pattern is the Oracle already — Mazeworld's Oracle tab IS a complete, reveal-gated scrolling log. Adding a SECOND scrolling log inside the combat panel would either (a) duplicate the Oracle (explicitly forbidden by CONTEXT: "never a second source of truth"), or (b) become identical to Pattern 2 if scoped to "only this round's lines, cleared each round" — at which point it's a batched round card with a list layout instead of a paragraph layout. Scored below as the "duplicate-risk" version since that is the pattern's natural default shape.

### Pattern 2 — Batched round-summary card

One narrative block per round/turn-cycle, read all at once, dismissed (or simply superseded) with a single action.

- **Darkest Dungeon's narration + round-result presentation** `[CITED: darkestdungeon.wiki.gg/wiki/Combat_Mechanics_(Darkest_Dungeon)]` — combat proceeds in rounds where every unit's turn (ordered by SPD) resolves before the next round begins; the narrator (Wayne June) delivers a scripted line per notable outcome, layered ON TOP of (not replacing) the visual result — the presentation reads as one dramatic beat per round rather than a transcript.
- **Darkest Dungeon: Tablet Edition** `[CITED: apps.apple.com/us/app/darkest-dungeon-tablet-edition/id1199831446]` — confirms the same turn-based/narrated combat ships unmodified on mobile/tablet, i.e., the pattern is proven to survive the touch-first constraint this project shares.
- **Fire Emblem / Advance Wars-style battle-result panels** `[ASSUMED]` — genre-standard "combat forecast then result" panel: damage dealt/taken, crit, kill, all shown in one card before returning control to the player; not independently re-verified via WebSearch this session, included per CONTEXT's own suggested-candidates list and this researcher's training-data familiarity with the SRPG genre.
- **Into the Breach's telegraphing** `[CITED: gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-, interfaceingame.com/games/into-the-breach/]` — not itself a "round summary" (it's pre-emptive, showing what WILL happen next turn, not what just happened), but directly relevant to CMBUI-02's "narrative coherence" goal: showing the full outcome of a coming exchange as ONE integrated readout (direction, damage, remaining HP) rather than piecemeal numbers is the same "one coherent place" principle applied to the future instead of the past.

**Fit for this game:** this is structurally identical to what Phase 29 already shipped for the loot screen (fold the report + the decision into ONE card). Extending it to every round is the lowest-novelty, lowest-risk option of the six.

### Pattern 3 — Auto-advance with tap-to-pause / speed control

The round plays itself (foes act, damage resolves) without requiring a tap; the player can tap to pause/inspect, or set a speed dial.

- **Hoplite** `[CITED: en.wikipedia.org/wiki/Hoplite_(video_game), medium.com/@scott_williams/hoplite-7c190d3f6ecc]` — deliberately AVOIDS the "bump-attack-over-and-over" pacing problem by making movement itself the primary decision (attacks resolve instantly on a move-into-enemy tap); it is NOT auto-advancing combat rounds in the classic sense but does resolve outcomes with zero extra confirmation taps by default — its "Fat Finger Mode" (an OPT-IN second-tap confirmation) is the closest real shipped analog to a deliberate mis-tap guard, and notably it costs an EXTRA tap and is off by default, i.e., the developer's own default choice favors speed over confirmation.
- **Card Crawl / Dicey Dungeons** `[ASSUMED]` — cited per CONTEXT's own candidate list as idle/auto-battle-adjacent titles; not independently re-verified via WebSearch this session (search budget prioritized Hoplite, which returned strong primary-source results).
- **Generic idle/auto-battle convention** `[ASSUMED]` — skip/fast-forward affordances (2x/4x speed toggles, "skip animation" settings) are a well-known mobile-gacha/idle-RPG convention; included from training-data familiarity, not independently re-verified this session.

**Fit for this game:** the core risk (identified without needing further citation) is that a timer-paced narrative is the WORST fit for "zero taps needed to READ a round" — it inverts the failure mode from "the player must dismiss something to see the next line" to "the player might not finish reading before it auto-advances." It also requires building an entirely new pause/speed state machine this shell does not have today (highest net-new implementation cost of any pattern).

### Pattern 4 — Ticker / marquee / floating combat text

Numbers or short phrases float over the action (Diablo-style damage numbers) or scroll through a fixed marquee strip; sometimes paired with tap-to-advance text boxes (classic JRPG dialogue-box convention).

- **Diablo-style floating damage numbers** `[ASSUMED]` — genre-iconic convention (numbers pop over the struck unit, color-coded by type/crit); training-data familiarity, not independently re-verified via WebSearch this session.
- **Pokémon-style text boxes with per-message taps** `[ASSUMED]` — the classic "A wild PIDGEY appeared! ▼" tap-to-advance box; genre-standard, not independently re-verified this session.
- **MMO floating combat text (WoW-style)** `[ASSUMED]` — canonical implementation of the "numbers fly up and fade" pattern at scale; training-data familiarity.

**Fit for this game:** floating numbers alone carry essentially no room for the sarcastic-voice identity requirement (a "-4" glyph cannot be deadpan), and this shell's `<canvas>` is a game-grid renderer, not a typography layer — building a floating-text overlay would be new DOM/canvas surface area with no reuse of the existing toast infrastructure. The tap-to-advance text-box variant fights CMBUI-03's "zero taps to read" constraint directly (every line costs a tap).

### Pattern 5 — Mis-tap guards (arm delay, hit-zone separation, distinct gesture)

Not a narrative-delivery pattern on its own — a cross-cutting safety layer that can be bolted onto ANY of the above. CONTEXT explicitly asks it be scored as its own row; scored below as "guards retrofitted onto TODAY's toast/button system, with no change to how the narrative itself is delivered."

- **Hoplite's Fat Finger Mode** `[CITED: en.wikipedia.org/wiki/Hoplite_(video_game)]` — an opt-in second-tap confirmation on movement/attack taps; the clearest shipped precedent for "add a deliberate confirmation step to prevent an accidental fatal tap" in this exact genre, though it costs an extra tap (opt-in, not default).
- **Material Design touch-target guidance** `[CITED: m1.material.io/usability/accessibility.html; support.google.com/accessibility/android/answer/7101858]` — the canonical Android sizing spec: minimum 48×48dp touch targets (~9mm physical), interactive elements separated by ≥8dp to prevent accidental activation of an adjacent control. This project's D-pad cells (52×52 CSS px, 7px gap) and the action bar's `min-height ≥ 48dp` convention (already referenced in existing `renderEncounter` comments, e.g. line 4984 "buttons inherit the base ≥48dp min-height") already track this spec — the gap is TIMING, not sizing.
- **The 300ms tap-delay history / `touch-action: manipulation`** `[CITED: developer.chrome.com/blog/300ms-tap-delay-gone-away]` — historically, mobile browsers waited ~300-350ms after `touchend` before firing `click` (to detect double-tap-to-zoom); Chrome eliminated this for viewport-meta-tagged/`touch-action:manipulation` pages starting Chrome 32 (2014). The project's `canvas` element already sets `touch-action:manipulation` (confirmed, mazeworld.html line 295) — meaning **this shell has ALREADY eliminated the legacy 300ms delay**; any new arm-delay guard is a DELIBERATE, purpose-built timing window, not an accidental side-effect of an un-fixed WebView quirk, and must be implemented as an explicit JS timestamp check (not relied upon to "already exist" from platform behavior).

**Fit for this game:** the scorecard treats this pattern honestly as ORTHOGONAL rather than competing — it fixes thumb-safety (the actual CMBUI-04/05 hard requirement) without touching coherence (CMBUI-02) at all if applied alone. The recommendation section below folds this pattern in as a REQUIRED LAYER on top of whichever narrative-delivery pattern wins, per CONTEXT's own constraint framing ("All three properties are required; the design proposes the concrete geometry/timing").

### Pattern 6 — Today's per-event toast stack (baseline)

Documented exhaustively in §Current State above. Included here only for the scorecard row.

---

## Scorecard

### Weights (Claude's Discretion, justified)

| Criterion | Weight | Justification |
|---|---|---|
| Taps-to-move-on (CMBUI-03) | 20% | A hard CONTEXT constraint — weighted with the other two hard constraints at the top of the scale |
| Narrative coherence per round (CMBUI-02) | 20% | The actual complaint this phase exists to fix — equal weight to the other hard constraints |
| Thumb-safety (CMBUI-04/05) | 20% | The third hard constraint; all three CMBUI mechanical requirements (03/02/04-05) are weighted identically at 20% each = 60% of the total score, reflecting that they are non-negotiable per CONTEXT, not merely "nice to have" |
| Oracle-remains-the-log fit | 10% | Identity-preserving (never a second source of truth) but not itself a player-facing mechanic — half the weight of the hard constraints |
| Room for the sarcastic voice | 10% | Core project identity (CLAUDE.md), but a pattern that scores low here can often still be WRITTEN around (voice lives in the text, which most patterns can host to some degree) — so weighted below the three mechanical hard constraints |
| Implementation cost inside the existing toast/card/beats system | 15% | This is a solo-dev vanilla-JS shell with a 1593-test suite; a pattern that requires new subsystems (timers, pause states, canvas text layers) carries real risk and time cost this milestone should not absorb lightly — weighted above voice/Oracle-fit but below the three hard mechanical constraints |
| 5–10-minute session pacing | 5% | Least differentiating criterion — nearly every pattern CAN be tuned to fit the session length with the right numbers; it's a tuning knob, not a structural differentiator |

### Scores (1-5 per criterion, weighted total out of 5)

| Pattern | Taps (.20) | Coherence (.20) | Thumb-safety (.20) | Oracle-fit (.10) | Voice (.10) | Cost (.15) | Pacing (.05) | **Weighted total** |
|---|---|---|---|---|---|---|---|---|
| 1. Scrolling log/ledger | 5 | 3 | 3 | 2 | 3 | 3 | 4 | **3.35** |
| **2. Batched round-summary card** | **5** | **5** | **4** | **5** | **5** | **5** | **4** | **4.75** |
| 3. Auto-advance / tap-to-pause | 5 | 2 | 2 | 3 | 3 | 2 | 3 | 2.85 |
| 4. Ticker / floating text | 3 | 2 | 4 | 3 | 1 | 3 | 4 | 2.85 |
| 5. Mis-tap guards only (bolted onto baseline) | 2 | 2 | 5 | 3 | 3 | 4 | 3 | 3.15 |
| 6. Today's toast stack (baseline) | 2 | 2 | 2 | 4 | 4 | 5 | 3 | 2.90 |

**One-line justification per pattern's weakest score:**
- Pattern 1 loses on Oracle-fit (2) — a persistent in-panel log, done in its natural default shape, structurally duplicates the Oracle's own role, which CONTEXT explicitly forbids.
- Pattern 2 loses least anywhere — its lowest score (4, thumb-safety) is only because ANY card-based UI still needs the guard layer (Pattern 5) bolted on to reach a perfect 5; nothing about the pattern itself is unsafe.
- Pattern 3 loses on coherence (2) and cost (2) — a timer-paced surface risks NOT giving the player time to read before advancing (the opposite of CMBUI-02's goal), and requires a wholly new pause/speed state machine.
- Pattern 4 loses on voice (1) — floating numbers/marquee text carry essentially zero room for the deadpan-sarcastic sentence style that is this project's core identity.
- Pattern 5 loses on taps/coherence (2/2) — a guard layer alone does nothing to fix the "stack of individual toasts" complaint; it only makes the existing stack safer to interact with.
- Pattern 6 (baseline) loses on taps/coherence/thumb-safety (2/2/2) — this row IS the documented problem statement; its only strengths are zero migration cost (5) and that its existing toast lines already carry voice (4) and already avoid Oracle duplication (4).

**Winner: Pattern 2 (Batched round-summary card), 4.75/5, combined with Pattern 5's guard layer as a mandatory addition** (this pushes Pattern 2's thumb-safety from 4→5, making the combined recommendation the only option that scores at or near the ceiling on all three hard constraints simultaneously).

**Runner-up: Pattern 5+6 hybrid — a "Guarded, Bundled Toast"** (3.15+ once bundling raises its coherence score materially — see tradeoffs below). Kept as the genuine second choice because it is the lowest-risk, lowest-test-churn path if the ratification pause favors minimizing change over maximizing coherence.

---

## Recommended Design: The Round Card

**Concept:** Extend the exact machinery Phase 29 already proved for the loot screen — fold a round's grouped events into ONE always-visible narrative block inside the existing combat panel — to every round, not just encounter-clear. Reuse `toastsForAction`'s existing pure groupers (`enemyRound`, `yourRound`, `spellChain`, `killFold`, etc.) unmodified in their FOLDING logic; retarget their OUTPUT from an array of timed toast objects to a single persistent DOM block that `renderEncounter()` rebuilds every render, the same way it already rebuilds the foe roster and action bar.

### Screen anatomy

The round narrative renders **inline**, in the SAME vertical position `S.lastExchange`'s "Last exchange" footnote occupies today (`renderEncounter` line ~5228) — below the foe roster (which stays fully visible, directly answering Pitfall 13's "risk of a round card hiding the foe list mid-fight"), above the action bar. No new overlay layer, no new z-index, no change to where `#enc-panel`/`.mw-overlay` sits relative to `.mazebox`/`.mazefoot`.

```
┌───────────────────────────────┐
│ Ambush · round 3               │
│ 2 still standing · d20, 14+    │  <- existing head (C.type / foe count / to-hit)
├───────────────────────────────┤
│ Giant Rat        6/12 hp        │
│ Giant Rat        0/9 hp  dead   │  <- foe roster (UNCHANGED position — never hidden)
├───────────────────────────────┤
│ ▸ THIS ROUND                    │  <- NEW: persistent round-narrative block,
│  You hit the Giant Rat for 4.  │     replaces the S.lastExchange footnote AND
│  It bites back — 2 dmg,         │     suppresses per-event in-combat toasts;
│  hide soaks 1.                  │     zero taps to read (always on screen)
│  The second rat goes down.      │
├───────────────────────────────┤
│ [1·Strike] [2·Potion] [3·Flee] │  <- action bar (UNCHANGED position);
│                                  │     ARM_DELAY_MS=250 gates every button
└───────────────────────────────┘
```

**Encounter cleared → loot → move on** (already shipped, Phase 29 — unchanged by this recommendation, shown here only to complete the state inventory):

```
┌───────────────────────────────┐
│ Victory                         │
│ Round 3 · +40 gold · +12 XP     │
├───────────────────────────────┤
│ The spoils                      │
│ Rusted Mail · +2 over worn      │
│   [Equip now] [Stow] [Leave]    │
├───────────────────────────────┤
│       [Take all]  [Leave all]   │  <- ONE tap; ARM_DELAY_MS=250 on first paint
└───────────────────────────────┘
```

### Tap budget per state

| State transition | Taps required | Notes |
|---|---|---|
| Mid-round → next round | **0 extra** (same 1 tap the player's chosen action already needed) | The narrative is always visible; no "Move on" gate is inserted mid-fight. This is UNCHANGED from today structurally — today never forced a mid-round dismiss either. The delta this design contributes to CMBUI-03 is *preserving* that property while fixing coherence, not reducing an already-zero extra-tap count further |
| Encounter cleared → loot resolved → move on | **1 tap** (Take all / Leave all, or per-item then implicitly done) | Already shipped Phase 29; preserved verbatim |
| Joiner offer | **1 tap** (Take them along / Leave them) | Already shipped; preserved |
| Death | **1 tap** (Confirm); +1 OPTIONAL elective tap (Review the Oracle) | Already shipped; preserved |
| Floor change / level-up | **1 tap** ("Move on", `S.beats` CARD_EVENTS) | Out of CMBUI-01's in-combat scope; explicitly unchanged — Phase 32 must not regress this |

### Guard rules (concrete numbers)

Two DISTINCT timing guards, both reusing the `250ms` figure CONTEXT itself proposes as the target order of magnitude:

1. **`ARM_DELAY_MS = 250`** — per-surface arm delay. Every freshly-rendered decision button (round-card action bar, loot card, joiner card, Fight! button, death Confirm) records `renderedAt = Date.now()` when `renderEncounter()` builds it; the click handler no-ops (or the button is `disabled` for that window, whichever is cheaper against the existing `.disabled` CSS convention already used for e.g. `a-potion`) if `Date.now() - renderedAt < 250`. This directly stops the "new button appears where the old one was, a fast second tap fires it" failure mode identified in §Current State.
2. **`DISMISS_SETTLE_MS = 250`** (same magnitude, separate concern) — a post-dismiss settle window. When `hasActiveEncounter()` transitions from `true`→`false` (a card empties, Fight! is pressed, a beat is dismissed), record `lastDismissAt = Date.now()`; `window.move`'s existing `hasActiveEncounter()` guard gains a second clause: also refuse input while `Date.now() - lastDismissAt < 250`. This stops the "overlay closes synchronously inside a click handler, an eager double-tap's second touch lands on the now-exposed D-pad" failure mode.

Both guards are **JS timestamp checks, not CSS-transition-duration-dependent** — required because `mazeworld.html` already has a blanket `@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}` rule (line 773); a guard that relied on an animation's duration to create its safety window would silently vanish for reduced-motion users. This is a hard implementation constraint for Phase 32, not merely a suggestion.

**Hit-zone separation** is, per the code read, ALREADY satisfied structurally: `.mw-overlay` fully covers `.mazefoot`'s D-pad whenever any encounter surface is active, so no decision button can ever occupy the same on-screen rect as a live D-pad cell. Phase 32's job here is narrower than "separate two hit zones" — it is "don't let the settle window's absence create a one-frame gap where a just-dismissed overlay's coordinate briefly becomes a live D-pad cell before the guard clause above closes it."

**Dismissal rule** ("nothing important dismisses on a tap in the map/D-pad region"): already true by construction — every dismissible surface lives inside `#enc-panel`, which covers the entire region; there is no code path today where a map/D-pad tap can reach a card's dismiss logic. Phase 32 must preserve this invariant (i.e., must NOT introduce a "tap anywhere to dismiss" behavior on the round card, which would be the one way to violate it) — the round card should have NO tap-to-dismiss gesture at all (it's not modal; it simply gets rebuilt by the next render), consistent with the "zero taps to read, zero taps to dismiss mid-round" design.

**Distinct gesture** (the third CONTEXT-named guard technique) is explicitly NOT adopted for the primary recommendation — see Tradeoffs below.

### What stays a toast vs. joins the round surface

| Event category | Destination | Why |
|---|---|---|
| Out-of-combat events (move, camp, teleport, find, floor change, level-up) | **Stays a toast** (or `S.beats` CARD_EVENTS card) | Phase 25/25.1 rules explicitly stand — unchanged, out of scope |
| In-combat outcome events (struck/strikeMissed, struckByFoe/foeMissed, memberStruck, spellThrown chains, armorSoaked, conditions applied, foeKilled, encounterStarted follow-ons, in-combat flee/parley/chest rolls) | **Joins the round card** | These are exactly what `toastsForAction`'s groupers already fold — retarget the output |
| Refusals/blocks (strikeRefused, fleeRefused, noChargesLeft, spellNotKnown, campFailed, buyFailed, etc. — `PRIORITY.block` tier) | **Stays a toast**, unchanged | A refusal is a DIRECT response to the player's own just-tapped button (e.g., tapping Strike while frozen) — instant proximity-to-action feedback via a toast is more appropriate than waiting for the round card to rebuild; this also minimizes both implementation risk and re-pinning (the block-tone slice of `TOAST_FOR` is small and stable) |

### Oracle behaviour

Unchanged. The Oracle remains the full, unabridged `EVENT_NARRATION` transcript (218 entries), full-screen tab, opens at newest (`window.__mzOracleToNewest()`). The round card's grouped text is DERIVED from a copy of the same `events[]` array the Oracle's own `logLine` calls already consume independently — the round card is never a second writer into `S.log`, satisfying CONTEXT's "never a second source of truth" constraint by construction (same pattern the toast system already uses today).

### How Phase 28 armor outcomes / Phase 29 loot fold in

Phase 28's four armor outcomes (soaked-with-wear, soaked-without-wear, magic-plate soak, armor gives out) already have distinct `armorSoaked`/related event shapes and existing `TOAST_FOR`/`EVENT_NARRATION` entries — they fold into the round card via the SAME grouping path as any other in-combat event (no new engine work, no new event types). Phase 29's loot card is UNCHANGED by this recommendation — it already IS the "batched round summary" pattern applied to encounter-clear; the round card recommendation simply generalizes the same principle one level earlier (mid-round, not just end-of-fight).

---

## Runner-Up Design: Guarded, Bundled Toast

**Concept:** Keep the floating-toast aesthetic and position (`#mw-toast-host`, fixed top, unaffected by combat panel layout) but (a) bundle ALL of a round's toasts into exactly ONE toast instead of up to `MAX_TOASTS=4`, and (b) apply the same `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` guards to the action bar underneath.

```
   (fixed top, unchanged position, z-index 120)
   ┌─────────────────────────┐
   │ ▲ THIS ROUND (1 toast)   │   <- bundled: one toast per round instead of
   │ You hit for 4. Rat bites │      up to 4; still auto-dismisses (or tap-
   │ back for 2. Second rat   │      to-dismiss per 25.1); MAX_TOASTS becomes
   │ felled.                  │      effectively 1 for in-combat events only
   └─────────────────────────┘
...
┌───────────────────────────┐
│ Giant Rat        6/12 hp    │
├───────────────────────────┤
│ [1·Strike][2·Potion][3·Flee]│  <- guard: ARM_DELAY_MS=250 added here too
└───────────────────────────┘
```

**Tap budget:** identical to the recommended design (0 extra mid-round, 1 tap at every existing decision gate) — bundling doesn't change tap count, only toast COUNT.

**Guard rules:** identical `250ms` numbers, applied to the action bar; the toast itself needs no arm delay (it's non-interactive except for its own optional tap-to-dismiss).

**Why it's the runner-up, not the winner:** bundling reduces toast COUNT (4→1) which materially helps coherence, but the surface is still a FLOATING, TIMED, AUTO-DISMISSING element positioned away from the foe roster/action context — it doesn't achieve "zero taps to read" as cleanly as an always-on inline block (a toast can still expire — even at the 9000ms cap — before a slow reader finishes, especially stacked against the reading-speed research below), and it keeps the toast system as the primary combat-feedback channel rather than promoting the combat panel itself to be self-narrating. It IS, however, meaningfully cheaper to build (no new DOM block inside `renderEncounter`, no change to where `S.lastExchange` sits, most of the 98 toast-pinning tests need only a bundling-count update rather than a structural rewrite) and is the safer fallback if the ratification pause reveals the user wants to preserve the current visual language.

---

## Tradeoffs Against Each Alternative

| Alternative | Why the Round Card wins over it |
|---|---|
| Pattern 1 (scrolling log) | Avoids duplicating the Oracle; a round-scoped block that clears each round (not an ever-growing list) sidesteps the "second source of truth" problem Pattern 1 falls into in its natural default shape |
| Pattern 3 (auto-advance) | No new timer/pause state machine; reading pace stays player-controlled (matches "zero taps to READ," not "zero SECONDS to read before it vanishes") |
| Pattern 4 (ticker/floating text) | Full sentence room for the sarcastic voice; reuses existing text-rendering DOM instead of a new canvas/overlay typography layer |
| Pattern 5 alone (guards, no narrative change) | Guards alone don't fix CMBUI-02; the Round Card design INCLUDES Pattern 5's guards as a mandatory layer, so it strictly dominates a guards-only approach |
| Pattern 6 (today's baseline) | This is the documented problem statement itself — the Round Card fixes coherence (1 block vs up to 4 toasts) and thumb-safety (adds the guards that don't exist today) while costing only moderate implementation effort (reuses `toastsForAction`'s existing pure grouping logic) |
| Runner-up (Guarded Bundled Toast) | Better narrative coherence (an inline block anchored to the foe roster reads as PART of the combat state, not a transient overlay competing for attention) and better Oracle-adjacency (a persistent "this round" block visually mirrors "the log, zoomed to now" more than a floating toast does); costs somewhat more to build and re-pins more of the 98 existing toast tests, which is the honest reason to pick the runner-up instead if minimizing change is prioritized over maximizing coherence |

---

## Pitfalls

### Pitfall 1: aria-live/accessibility of a replaced toast system
**What goes wrong:** `#mw-toast-host` today carries `aria-live="polite" aria-atomic="false"` (line 1342) — screen readers get notified per new toast. A round card that REPLACES in-combat toasts needs its own `aria-live` region (or the existing host repurposed) or screen-reader users lose all in-combat feedback entirely.
**Why it happens:** the toast host's live-region wiring is specific to the toast DOM node; a new inline block inside `#enc-body` (which is fully rebuilt via `innerHTML = ""` each render) has no live-region semantics by default.
**How to avoid:** Phase 32 must add `aria-live="polite"` to the round-card container (or reuse a stable, never-fully-replaced wrapper element around it, since `aria-live` regions generally need to persist in the DOM rather than be destroyed/recreated to reliably announce). `[CITED: general ARIA live-region practice — phoca.cz/a11y-component-lab/toast confirms role="status"/aria-live="polite" as the standard toast-replacement pattern]`.
**Warning signs:** a screen-reader smoke test (if one exists in this project) going silent on combat rounds after the redesign lands.

### Pitfall 2: reduced motion
**What goes wrong:** the existing blanket `prefers-reduced-motion` rule (line 773) disables ALL transitions/animations project-wide; a guard implementation that (wrongly) ties its 250ms safety window to a CSS transition's `transitionend` event would silently have ZERO guard duration for reduced-motion users.
**Why it happens:** it's a natural (and wrong) shortcut to reuse an existing fade-in animation's duration as "the arm delay is already handled by the animation."
**How to avoid:** implement both `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` guards as plain `Date.now()` timestamp checks, independent of any CSS transition — already called out as a hard constraint in §Build Contract above.

### Pitfall 3: the WebView's historical 300ms tap delay / `touch-action`
**What goes wrong:** if a NEW interactive element (e.g., a tap-to-dismiss affordance on the bundled toast in the runner-up design) is added WITHOUT `touch-action: manipulation`, it could reintroduce the legacy double-tap-to-zoom detection delay on that specific element even though the rest of the page has already opted out.
**Why it happens:** `touch-action` is set per-element/selector, not inherited automatically the way some CSS properties are; the existing `canvas` rule (line 295) and `.mw-toast` rule (line 701, `touch-action:manipulation`) show this project is already careful about this, but any NEW tappable surface must repeat the declaration.
**How to avoid:** any new tappable element the redesign introduces (a round-card dismiss control, if the runner-up's bundled toast keeps tap-to-dismiss) must carry `touch-action:manipulation` explicitly, matching the existing `.mw-toast`/`.mw-chip` convention. `[CITED: developer.chrome.com/blog/300ms-tap-delay-gone-away]`.

### Pitfall 4: reading speed on a phone (chars per second)
**What goes wrong:** if the round card's text is allowed to be as long as a fully-unrolled multi-foe, multi-swing description, it can exceed comfortable reading speed for the time the player has before the next input is expected.
**Why it happens:** `toastsForAction`'s existing groupers already compress multi-event bursts into one line per target/foe-group — this discipline must be PRESERVED when retargeting to the round card, not relaxed just because the card no longer has a toast's character-length-driven auto-dismiss timer forcing brevity.
**How to avoid:** treat 12-20 characters/second as the comfortable-reading target and 20-25 CPS as the upper acceptable bound `[CITED: mobile UI text-timing guidance, general reading-speed research — no single authoritative game-specific source found this session; treated as a design guideline, not a hard engine constraint since the round card has NO forced auto-dismiss timer to size against]`; in practice, since the Round Card has zero forced dismissal, this pitfall matters less than it would for a toast/auto-advance design — but if the grouped text balloons (e.g., a 4-foe frenzied round with multiple ability resolutions), Phase 32 should keep the SAME "3+ collapses to one summary line" discipline `toastsForAction`'s `enemyRound` already applies, rather than let it grow unbounded.

### Pitfall 5: the risk of a "round card" hiding the foe list mid-fight
**What goes wrong:** a poorly-anchored round-narrative surface could push the foe roster off-screen or bury it below newly-added content, leaving the player unable to see who's still alive while deciding their next action.
**Why it happens:** `#enc-panel` already scrolls internally (`overflow-y:auto`) when content overflows — this is a KNOWN existing issue (the spell menu has this exact problem today, per the in-code comment at line 5255-5263: "with several foes on screen the button... can sit below the fold").
**How to avoid:** the recommended design explicitly anchors the round narrative BELOW the (always-rendered-first) foe roster and reuses the `S.lastExchange` footnote's existing position — it does not insert anything ABOVE the roster. Phase 32 should additionally consider whether a long round narrative needs its own internal scroll cap (e.g., show the last 2-3 grouped lines, defer to the Oracle for the rest) rather than letting the block grow unbounded and pushing the action bar off the first screenful, mirroring the same `scrollIntoView` fix already applied to the spell button.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Folding a round's raw events into grouped, deduplicated narrative lines | A new grouping/aggregation function for the round card | `toastsForAction`'s existing `enemyRound`/`yourRound`/`spellChain`/`killFold`/`fleeChain`/`parleyChain`/`chestChain` functions (`src/browser/toasts.js`) | This logic is already written, pure, tested, and handles every edge case the round card needs (3+ foes collapsing, target grouping, roll-to-outcome chaining) — retarget its OUTPUT, never re-derive the folding rules |
| A tap/drag gesture classifier for any new touch surface | A bespoke `touchstart`/`touchend` delta calculator | `src/browser/controls.js`'s `TAP_MOVE_THRESHOLD_PX`/`TAP_MAX_DURATION_MS`/`classifyPointerGesture` | Already the single shared source for tap-vs-drag classification on the map viewport; if the round card or its guards need gesture classification (they likely don't — a simple timestamp arm-delay suffices, not gesture detection), extend this module rather than duplicating its math |
| Screen-reader announcement of dynamic combat text | A custom polling/MutationObserver-based announcer | Native `aria-live="polite"` on a persistent (never-destroyed) wrapper element | Browsers already implement live-region announcement; a custom announcer is strictly more code for a worse result |

**Key insight:** almost everything this phase needs already exists in the codebase in a reusable form — the actual net-new surface area for Phase 32 is small: one DOM block in `renderEncounter`, two `Date.now()`-based timestamp guards, and a routing change (which events go to the toast host vs. the round block). The temptation to build a new "combat narrative engine" from scratch should be resisted; this is a retargeting exercise, not a new subsystem.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Dungeon Crawl Stone Soup and Cogmind's message-log implementations follow the genre-standard append-and-scroll pattern described | Pattern 1 survey | Low — these are cited as illustrative genre examples only; the actual design decision does not depend on their exact implementation details, only on the general "scrolling log duplicates the Oracle" structural argument, which is independently derivable from this project's own architecture |
| A2 | Card Crawl / Dicey Dungeons follow auto-battle/idle conventions as CONTEXT's candidate list implies | Pattern 3 survey | Low — Pattern 3 is rejected primarily on structural grounds (timer-paced reading contradicts "zero taps to read," new state machine cost) that don't depend on these two titles' specific implementations |
| A3 | Diablo/Pokémon/MMO floating-text conventions are as described | Pattern 4 survey | Low — Pattern 4 is rejected primarily on the "zero voice room" and "no canvas typography layer" arguments, which are independently verifiable against this project's own code (the `<canvas>` is confirmed to be a maze-grid renderer only) |
| A4 | Fire Emblem/Advance Wars battle-forecast panels work as described (damage/crit/kill in one pre-resolution card) | Pattern 2 survey | Low — Pattern 2's case rests primarily on the Darkest Dungeon citations (verified) and the ALREADY-SHIPPED Phase 29 loot card (verified via direct code read), not on this SRPG-genre claim |
| A5 | 12-20 CPS / 20-25 CPS are the correct comfortable/fast reading-speed bounds for this game's audience | Pitfall 4 | Medium — if wrong, the practical impact is limited because the Round Card design has NO forced auto-dismiss timer (unlike a toast), so a wrong CPS figure only affects a secondary "should we cap the block's line count" tuning decision, not a hard functional requirement |

**If this table is empty:** N/A — see entries above. All five assumptions are LOW-to-MEDIUM risk because the core recommendation (batch into one card, reuse existing grouping logic, add two timestamp guards) is derived from direct code-read evidence (HIGH confidence), not from the web-search-sourced pattern examples, which serve as illustrative/comparative context rather than load-bearing justification.

## Open Questions

1. **Exact line-count/character cap for the round-narrative block, if any**
   - What we know: `toastsForAction`'s groupers already compress busy rounds down to at most a handful of lines (one per foe-group/target-group after the 3+-collapse rule); the Round Card design has no forced auto-dismiss timer, so unlike a toast there's no hard upper bound derived from `toastLifetime()`.
   - What's unclear: whether Phase 32 needs an EXPLICIT cap (e.g., "show at most 4 grouped lines, defer the rest to the Oracle") to guard against a worst-case round (4 foes, all frenzied, multiple abilities) producing a block long enough to push the action bar below the fold.
   - Recommendation: Phase 32's plan should measure this against a real worst-case fixture (the existing bot/tune-difficulty harness can likely generate one) before deciding whether a cap is needed, rather than guessing a number here.

2. **Whether the runner-up's "bundled toast" should still support the existing tap-to-dismiss gesture, or become auto-only**
   - What we know: today's Phase 25.1 toasts are tap-to-dismiss AND auto-dismiss after `toastLifetime()`.
   - What's unclear: whether a SINGLE bundled round toast (carrying more text than any individual toast today) should get a longer minimum lifetime than the current formula produces, to avoid the reading-speed risk in Pitfall 4.
   - Recommendation: if the ratification pause selects the runner-up, Phase 32 should re-derive `toastLifetime()`'s constants against the bundled toast's typical (not worst-case) character count rather than reusing the per-event formula unchanged.

## Sources

### Primary (HIGH confidence — direct code inspection, this session)
- `src/browser/toasts.js` (1272 lines, read in full + live-imported for exact counts)
- `mazeworld.html` (`renderEncounter`, `hasActiveEncounter`, CSS for `.mw-overlay`/`.dpad`/`.mw-toast-host`, all grepped and read directly)
- `src/browser/controls.js` (read in full)
- `src/browser/eventNarration.js` / `src/browser/viewModels.js#oracleLogViewModel` (live-imported + read)
- `engine/combat.js` (`afterPlayerAction`, `foeTurn`, `allyTurn`, `alliesTurn`, read directly)
- `engine/state.js` (`PARTY_CAP`), `engine/difficulty.js` (`FOE_CAP_MAX`) — grepped directly
- `npm test` run fresh this session: 1593/1593 passing

### Secondary (MEDIUM confidence — WebSearch, official/primary pages)
- [Combat Mechanics (Darkest Dungeon) — Official Wiki](https://darkestdungeon.wiki.gg/wiki/Combat_Mechanics_(Darkest_Dungeon))
- [Darkest Dungeon: Tablet Edition — App Store](https://apps.apple.com/us/app/darkest-dungeon-tablet-edition/id1199831446)
- [Hoplite (video game) — Wikipedia](https://en.wikipedia.org/wiki/Hoplite_(video_game))
- [Hoplite — Scott Williams, Medium](https://medium.com/@scott_williams/hoplite-7c190d3f6ecc)
- [Road to the IGF: Subset Games' Into the Breach — Game Developer](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- [Into the Breach — Interface In Game](https://interfaceingame.com/games/into-the-breach/)
- [Accessibility — Material Design (m1)](https://m1.material.io/usability/accessibility.html)
- [Touch target size — Android Accessibility Help](https://support.google.com/accessibility/android/answer/7101858?hl=en)
- [300ms tap delay, gone away — Chrome for Developers](https://developer.chrome.com/blog/300ms-tap-delay-gone-away)
- [Let's code with the Roguelike tutorial - Part 7 - Enhancing the UI](https://www.yosenspace.com/posts/lets-code-roguelike-tutorial-part7-enhancing-ui.html)
- [Accessible Toast Notification — A11y Component Lab](https://www.phoca.cz/a11y-component-lab/toast)

### Tertiary (LOW confidence — WebSearch summary only, not independently re-verified; see Assumptions Log)
- Dungeon Crawl Stone Soup / Cogmind message-log conventions (A1)
- Card Crawl / Dicey Dungeons auto-battle conventions (A2)
- Diablo/Pokémon/MMO floating-text conventions (A3)
- Fire Emblem / Advance Wars battle-forecast panels (A4)
- Mobile UI reading-speed CPS bounds (A5)

## Metadata

**Confidence breakdown:**
- Current-state code read: HIGH — every count/behavior verified by direct source read or live module import, not inferred
- Pattern survey / scorecard: MEDIUM — the STRUCTURAL argument for the winning pattern rests on HIGH-confidence code-read evidence (Phase 29's loot card already proves the pattern works in this codebase); the illustrative shipped-game examples are MEDIUM/LOW per the Assumptions Log
- Pitfalls: HIGH for reduced-motion/touch-action/aria-live (all verified against this project's actual existing CSS/markup); MEDIUM for reading-speed CPS figures (general guidance, not project-specific)

**Research date:** 2026-09-16
**Valid until:** No expiry driver — this is a design decision, not a version-pinned dependency; revisit only if the underlying `toasts.js`/`renderEncounter` architecture changes materially before Phase 32 executes
