# Phase 30: Combat Narrative & Input — Research - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas proposed in batch tables; user accepted all

<domain>
## Phase Boundary

A written, decision-ready survey of combat-feedback interaction patterns is completed, a recommended design for this game's round narrative and input safety is chosen and ratified by the user, and the choice is recorded as a Key Decision in PROJECT.md — BEFORE any implementation begins (Phase 32 builds it). Requirement: CMBUI-01. Paper-only phase: no engine, shell, or content code changes; no on-device prototyping.

Out of scope: building the design (Phase 32, CMBUI-02..06), Phase 31's engine groundwork (Fight! gating, refusals, effect expiry, Amulet of Stone), any change to the Oracle log's completeness, out-of-combat toast rules (Phase 25/25.1 stand).

</domain>

<decisions>
## Implementation Decisions

### Survey scope & sources (CMBUI-01)
- Patterns compared: the five named in the requirement — (1) scrolling combat log / ledger, (2) batched round-summary card, (3) auto-advance with tap-to-pause, (4) ticker / marquee, (5) mis-tap guards (arm delay, hit-zone separation, distinct gesture) — plus (6) TODAY'S per-event toast stack as the explicit baseline row.
- Web research IS allowed for this phase (it is design research, not a runtime dependency): each pattern illustrated by 2–3 shipped mobile roguelikes / turn-based RPGs (candidates: Pixel Dungeon family, Hoplite, Slay the Spire mobile, Dungeon Crawl Stone Soup mobile, Darkest Dungeon, Fire Emblem-style battle logs — the researcher chooses the best-documented examples), each cited with a URL.
- Evaluation is a WEIGHTED SCORECARD fixed before scoring: taps-to-move-on (CMBUI-03), narrative coherence per round (CMBUI-02), thumb-safety with the D-pad under the thumb (CMBUI-04/05), Oracle-remains-the-log fit, room for the game's sarcastic voice, implementation cost inside the existing toast/card/beats system (`src/browser/toasts.js`, `renderEncounter`, `S.beats`), 5–10-minute session pacing.
- Deliverable: `docs/COMBAT-NARRATIVE-DESIGN.md` with, in order: current-state description (what the player sees today, with the toast/card inventory), survey table (pattern × examples × how it handles each criterion), the scorecard, the recommended design with tradeoffs stated against EACH alternative, and a Phase 32 BUILD CONTRACT: screen anatomy (where the round narrative lives relative to the foe list, actions, and D-pad), tap budget per state (round → next round, encounter cleared, loot card, joiner, death), guard rules (numbers), what stays a toast vs. joins the round surface, and Oracle behaviour.

### Design constraints the recommendation MUST satisfy
- Tap budget: at most ONE deliberate tap to move on after a round and after an encounter (CMBUI-03); ZERO taps needed to READ a round — the narrative is on screen without dismissing anything first.
- The Oracle stays the complete, unabridged log (every event, dice included); the new surface is a VIEW of the current round/encounter, never a second source of truth.
- Toasts survive for out-of-combat events (moves, finds, camp, teleports — Phase 25/25.1 rules stand). IN combat, per-event toasts are replaced by the chosen round surface — no double-reporting of the same event.
- Thumb-safety: decision buttons never share the D-pad's hit zone; they never fire in roughly the first 250 ms after appearing (arm delay — exact number is the design's to propose); nothing important dismisses on a tap that lands on the map/D-pad region. All three properties are required; the design proposes the concrete geometry/timing.

### Ratification & hand-off
- ONE pause at the end of Phase 30: the orchestrator presents the recommended design and its top runner-up (one AskUserQuestion, with the scorecard summary) and the user picks or redirects. This is the single design decision in the milestone large enough to earn a pause in an autonomous run.
- The Key Decision row is written to PROJECT.md IMMEDIATELY after the user's pick, still inside Phase 30 (satisfies "recorded before Phase 32 is planned"). If the user redirects, the doc's recommendation section is amended to the chosen design before the row is written.
- Phase 31 stays engine-only and does not touch the combat narrative surface; Phase 32 builds the ratified design from the build contract.
- On-device validation of the design stays in Phase 32 (CMBUI-06) and is batched into the end-of-run UAT list; Phase 30 is paper-only.

### Claude's Discretion
- Scorecard weights (must be stated and justified in the doc before scoring).
- Which shipped games illustrate each pattern, and how many (2–3 each).
- Whether the build contract includes ASCII/markdown wireframes (recommended: yes, one per state).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/toasts.js` — `PRIORITY` tiers, `CARD_EVENTS` (floorChanged, leveled), `NARRATIVE_ACTIONS`, `toastLifetime()` (base + per-char + stack bonus, capped), `MAX_TOASTS`, the 190+-entry toast table, `toastsForAction` dedupe — the current feedback system the survey must describe as its baseline and the design must integrate with or replace in combat.
- `mazeworld.html` — `renderEncounter` (Fight!/joiner/find/loot/death cards, `S.beats` "Move on" beats), `#mw-toast-host` (aria-live), `hasActiveEncounter()` movement guard, the D-pad controls (`src/browser/controls.js`), Phase 25.1 DFB decisions (card only for decisions; minor events toast-only; toasts linger ~2× and tap to dismiss).
- `src/browser/eventNarration.js` `EVENT_NARRATION` — the Oracle's complete per-event sentences (the "complete log" the design must preserve).
- Phase 29's loot card (`renderEncounter` loot branch, `window.__mzLootReport` hand-off of the end-of-fight report) — the newest decision surface; the design must fit it.
- `.planning/proposed-milestone-feedback-feel-polish.md` §A/§E and the user's device feedback (STATE.md "Roadmap Evolution" 25.1 note) — the pain points in the user's own words.
- `design/Mazeworld Mobile.dc.html` — the authoritative Claude Design mock for surfaces it defines.

### Established Patterns
- Documentation-phase precedent: `docs/PARLEY-REBALANCE.md`, `docs/DIFFICULTY-RETUNE.md`, `docs/CLASS-PASS.md` — ledger-style docs with tables, a recorded verdict, and a PROJECT.md Key Decision row.
- Key Decisions table in PROJECT.md: `| Decision | Rationale | Outcome |`.
- UX authority: the Claude Design mock supersedes the prototype UX where it defines a surface; family-friendly sarcasm is core identity.

### Integration Points
- `docs/COMBAT-NARRATIVE-DESIGN.md` (new); `.planning/PROJECT.md` Key Decisions row; Phase 32's plan-phase will read the build contract as its spec.

</code_context>

<specifics>
## Specific Ideas

- User pain points to solve (from the proposal and device rounds): the round narrative arrives as a stack of individual toasts; moving on takes dismiss-then-continue chains; Fight!/Joiner/loot/Move-on buttons sit where the D-pad thumb lands and get thumb-spammed; important cards get dismissed by incidental movement taps.
- The recommended design must be buildable inside the existing vanilla-JS shell (no framework), Android WebView, portrait, one thumb.

</specifics>

<deferred>
## Deferred Ideas

- Any implementation → Phase 32.
- Haptic feedback on hits/traps (`@capacitor/haptics` already present) — may be mentioned as an enhancer but is not part of the survey's decision.
- Tutorial for the new combat surface → UX-06 (deliberately last).

</deferred>
