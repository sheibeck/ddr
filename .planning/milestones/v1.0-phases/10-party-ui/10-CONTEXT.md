# Phase 10: Party UI — Context

**Gathered:** 2026-09-09 (autonomous). **Requirements:** PARTY-07 (+ PARTY-01 UI half: the accept/decline prompt).
**Depends on:** Phases 7–9 (engine: `state.party[]`, `resolveJoiner{accept}` action, `state.pendingJoiner`, events `joinerMet`/`joinerJoined`/`joinerDeclined`/`memberStruck`/`memberDowned`). Baseline: **596/596, parity green.**

## Phase boundary
- **DOES (UI/presentation layer only — `mazeworld.html`):** (1) an accept/decline recruitment PROMPT when a joiner is met; (2) a PARTY RAIL showing the active party member's identity/HP/status during play, data-driven on `state.party.length`. Presentation over existing engine state via the `window.__mzState`/`dispatch` bridge. NO engine change → NO parity impact.
- **Does NOT:** change any engine file, balance (Phase 11), or add new engine actions (Phase 9 already added `resolveJoiner`).

## Design authority
`design/Mazeworld Mobile.dc.html` has the party rail already designed: `railStyle` (a flex row of member cards, mock ~line 240/700), `party` member cards (name + HP), gated by `partyOn`/`partyMode`. **Follow the mock's rail visual.** DROP the mock's demo `partyOn` toggle — visibility is DATA-DRIVEN on `state.party.length > 0` (rail shown only when a member is present; hidden solo). (No separate UI-SPEC is generated — the mock IS the design contract per CLAUDE.md.)

## The bridge (how to read state / dispatch)
- `window.__mzState = { get: () => S, set: (v) => {...} }` (mazeworld.html:2053) — read `S.party`, `S.pendingJoiner`.
- Engine actions dispatch through the existing `dispatch()` → `applyAction` path (see `engineCombatAction`/`window.move`). Add a `window.mzResolveJoiner(accept)` bridge that dispatches `{ type: "resolveJoiner", accept }`, then repaints (mirror how `window.mzCastSpell`/`window.mzBuyItem` bridge classic UI → dispatch).

## Tasks
1. **Accept/Decline prompt:** when `S.pendingJoiner` is set (a joiner was met — `joinerMet` fires from a "Joiner" encounter), show a prompt (reuse the encounter/overlay styling) naming the joiner (`pendingJoiner.name`, its `sub`/`race`/`lvl`) with two buttons: **Take them along** → `window.mzResolveJoiner(true)`; **Leave them** → `window.mzResolveJoiner(false)`. After dispatch, clear the prompt and repaint; the `joinerJoined`/`joinerDeclined` narration already flows to the Oracle. Guard hit-target sizes (≥48dp) and keep the two buttons separated (UX-02 mis-tap rule).
2. **Party rail:** render a rail (per the mock) showing each `S.party` member — name, `sub`/level, an HP bar (`wp`/`maxWP`), and a downed/status indicator — shown only when `S.party.length > 0`, hidden when solo, legible in portrait on a phone (reuse the Phase-4 `.mw-chip`/status-chip + HP-bar treatments). It should update as member HP changes in combat (repaint on the same path the foe/hero HUD updates). Thread through `window.__mzState` (no new bridge object).
3. Wire both into the existing paint/render cycle so they appear/update without a manual refresh.

## Success criteria (gate)
1. Meeting a joiner shows an accept/decline prompt; accepting adds them (party rail appears); declining dismisses it — both routed through `dispatch({type:"resolveJoiner"})`.
2. The party rail shows the member's identity + HP + status while present, hidden when solo, portrait-legible.
3. `npm test` stays **596/596** (UI-only change; no engine/parity impact). Build succeeds; then a Pixel 7 device-review checkpoint (visual — done by the user, since it's on-device).

## Hard constraints
Presentation-only (`mazeworld.html` + maybe `src/browser/*` view helpers); NO engine edits; NO parity impact; reuse the bridge + the mock's rail design; ≥48dp touch targets; NO git; the orchestrator builds+deploys after. No SUMMARY.md (policy).
