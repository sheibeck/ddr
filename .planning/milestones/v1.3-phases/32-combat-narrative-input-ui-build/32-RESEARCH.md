# Phase 32: Combat Narrative & Input UI Build - Research

**Researched:** 2026-09-16
**Domain:** Shell/presentation-only UI rebuild (vanilla JS, no bundler) — combat round narrative surface + tap-safety guards, on top of an already-settled engine (Phase 31) and an already-ratified design (Phase 30, `docs/COMBAT-NARRATIVE-DESIGN.md` §4/§6)
**Confidence:** HIGH — every finding below is a direct code read or a live `node --test`/`npm test` run this session, not a web search. This phase has zero external dependencies and zero new packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Round Card content & lifetime (CMBUI-02, CMBUI-03)**
- **Pre-Fight! preview** (Phase 31's `combat.pending`): the block shows the `encounterStarted` narration line (the §6.4 routing table sends encounter-start to the card) — roster + that one line + Fight!. No initiative/strike text until Fight! is tapped (Phase 31 rule).
- **Round 1 after Fight!**: the `fight` action's folded events — the `combatJoined` initiative line, any pre-emptive strike, and the Afraid line if the hero's phobia matches.
- **Block holds the current round only.** Header "Round N" (sarcastic tone allowed in the copy; "THIS ROUND" in the wireframe is a placeholder). The previous card **persists** across sub-menu opens (Spells/Items lists re-render the panel) and across refusal taps (refusals are toasts, not rounds) — only an action that yields combat events replaces it. Cleared at `endCombat`.
- **Line derivation**: each folded toast from `toastsForAction` becomes one line via `narrativeToastText` — same order, same text (the toasts already carry the Oracle sentence per Phase 25.1). Groupers (`enemyRound`, `yourRound`, `spellChain`, `killFold`, `encounterStart`, `fleeChain`, `parleyChain`, `chestChain`, …) are reused UNMODIFIED in their folding logic; only the output destination changes.
- **Storage**: transient presentation state (`S.roundCard = {round, lines}` or equivalent) on the shell side, never serialized (combat is transient anyway), never written into `S.log` — the card is a VIEW of the same `events[]` the Oracle consumes.
- **Line cap**: none. The block gets a max-height (~40% of the panel) with inner `overflow-y:auto` so the action bar's coordinates never move between rounds (§6.3 rule 3). A test measures the worst-case round (4 foes, frenzied, abilities) against the tuning harness and the SUMMARY records the line count; `enemyRound`'s 3+-collapse discipline is kept.

**Area 2 — Guards & input (CMBUI-04, CMBUI-05)**
- **Module**: new pure module `src/browser/inputGuards.js` exporting `ARM_DELAY_MS = 250`, `DISMISS_SETTLE_MS = 250`, `isArmed(renderedAt, now)` and `isSettled(lastDismissAt, now)` predicates — unit-testable without DOM — bridged to the classic script as `window.__mzInputGuards` like the other bridges (`__mzConditionsOf`, `__mzCanCast`, …). Both guards are `Date.now()` comparisons; **never** a CSS transition/animation (`prefers-reduced-motion` sets `transition:none`, §6.3).
- **Arm-delay mechanism**: handler no-op. The button keeps its normal look (no 250 ms disabled flicker); `aria-disabled="true"` is set for the arm window and cleared after; a tap inside the window is swallowed silently (no toast). `renderedAt = Date.now()` recorded when `renderEncounter()` builds the button.
- **Keys**: Enter/Space/1 and the number keys go through the same arm check as taps. `DISMISS_SETTLE_MS` applies to keyboard moves too — one guard in `window.move` (`engineMove`): refuse while `Date.now() - lastDismissAt < DISMISS_SETTLE_MS`, where `lastDismissAt` is stamped when `hasActiveEncounter()` transitions true → false.
- **Guarded buttons** (exactly the §6.3 list): round-card action bar (Strike/Potion/Flee/Parley/Sing/Scroll/Spells/Items), Fight!, joiner accept/decline, loot per-row + Take all/Leave all, find Take/Leave, death Confirm AND Review the Oracle (same bar), `#enc-dismiss-slot` Move on. Every decision button renders INSIDE `#enc-panel` (hit-zone rule, structural).
- **Dismissal rule**: the round card has NO tap-to-dismiss gesture (rebuilt by the next render, never dismissed); no surface gains a tap-anywhere-to-dismiss behaviour.
- **Haptics**: out of scope for Phase 32 (§6.7: enhancer, never a decision factor). Note for Phase 33 in the SUMMARY.

**Area 3 — Toast suppression & tests**
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

### Deferred Ideas (OUT OF SCOPE)
- Haptic tap on hit/kill (`src/browser/haptics.js`, Settings toggle exists) → Phase 33 candidate.
- Tutorial for the new combat surface → UX-06.
- On-device DR round (CMBUI-06) → end-of-run UAT batch.
- The Oracle (unchanged and unabridged), out-of-combat toast rules (Phase 25/25.1), `CARD_EVENTS` Move-on cards (floorChanged/leveled), the runner-up design (§5 — not ratified).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMBUI-02 | A combat round's narrative is delivered in one coherent place per the chosen design, not a stack of individual toasts; the Oracle remains the complete log | Pattern 2 (routing split inside `dispatchWithToasts`), Pattern 3 (persistent aria-live wrapper), the exact `.exchange` block to replace (Code Examples), Pitfall 1/2/6 |
| CMBUI-03 | Moving on after a round or an encounter takes at most one deliberate tap — no dismiss-then-continue chains | Architecture Diagram (round card is always-visible, no dismiss gesture per CONTEXT), Pitfall 5 (roster/branch order already 1-tap at every decision gate) |
| CMBUI-04 | Decision buttons (Fight!, Joiner accept/decline, loot, Move on) cannot fire from a tap aimed at the D-pad — arm delay, no hit-zone overlap, or a distinct gesture | Pattern 1 (`inputGuards.js` module + bridge), the full guarded-button list already enumerated in CONTEXT (copied above), Anti-Patterns (never a CSS-transition guard) |
| CMBUI-05 | Nothing important can be dismissed by a movement tap; dismissal requires a deliberate tap on the surface itself | `window.move`/keydown handler seams (Architecture Diagram, `hasActiveEncounter()` gate at mazeworld.html L4761-4778, L6117-6178, L5552-5597) — the `DISMISS_SETTLE_MS` clause belongs in `engineMove`'s existing `hasActiveEncounter()` guard |
| CMBUI-06 | The chosen design is validated in an on-device DR round before the milestone closes | Deferred per CONTEXT (end-of-run UAT batch); no code-map research needed — this requirement is a verification-phase concern, not a build-phase one |
</phase_requirements>

## Summary

This is a pure code-map phase: the design is already ratified (§4/§6 of `docs/COMBAT-NARRATIVE-DESIGN.md`) and the decisions are already locked (`32-CONTEXT.md`). The work is entirely inside `mazeworld.html`'s classic `renderEncounter()` function, its trailing `<script type="module">` block (`dispatchWithToasts`/`engineCombatAction`/`inventoryAction`/`noteCombat`/`window.move`), and a new pure module `src/browser/inputGuards.js`. No engine file changes, no new npm packages, no bundler config changes (`tools/build-www.mjs` copies `src/` wholesale — a new module needs zero registration, only an `import` line + a `window.__mz*` bridge assignment, exactly like the ten existing bridges).

The single highest-leverage seam is `dispatchWithToasts` (mazeworld.html ~L6110-6115): today it unconditionally calls `window.mzToast?.()` for every item `toastsForAction` returns, with no awareness of `state.combat`. This is the ONE place in-combat/out-of-combat routing needs to branch. Two existing hand-written `mzToast?.()` calls (L5285, L5576, both "Already at full health." block-tone guards) already bypass `toastsForAction` entirely and are already refusal/block-only — they need zero changes and should NOT be touched by the routing logic.

`S.lastExchange`/`S.exchangeN` (the block being replaced) are structurally presentation-only already: `test/parity/harness/comparables.js` and both combat/magic parity tests destructure them OUT of every comparison, and the frozen prototype-master fixture's own copies are commented as "set only by the prototype's `act()` presentation wrapper... the engine has no equivalent fields at all." Deleting them from `mazeworld.html` carries **zero parity risk** structurally, not just by policy — confirmed by direct grep, not assumed.

The five re-pin test files total a **live-verified 89 tests** (15+21+37+8+8), matching CONTEXT's number. One correction to CONTEXT/§6.8: `test/unit/feedback-payload.test.js` (37 tests) contains **zero** assertions on toast destination or `mzToast`/`toastsForAction` call sites — it is pure engine-event-payload-shape testing (`soaked`, `needMods`, `critBy`). CONTEXT's "37 re-pinned where a payload assertion checks the toast destination" does not match what the file actually asserts; the planner should not expect toast-routing work to touch this file at all (see Pitfall 6 below).

**Primary recommendation:** Build in 3 plans matching the natural dependency order: (1) `src/browser/inputGuards.js` pure module + bridge (no DOM dependency, unblocks everything else), (2) the Round Card DOM/CSS + `renderEncounter` rewrite + `dispatchWithToasts` routing split, (3) shell wiring of guards onto every named button + the `window.move`/keydown `DISMISS_SETTLE_MS` clause + the worst-case-round measurement test + full re-pin sweep.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Round narrative aggregation (folding events into toast objects) | API/Backend-equivalent (pure module, `src/browser/toasts.js`) | — | `toastsForAction`'s groupers are pure, DOM-free, already-shipped logic; Phase 32 reuses them unmodified per CONTEXT — this phase never touches this tier |
| Round Card rendering (DOM block inside `#enc-panel`) | Frontend Shell (`mazeworld.html` classic script) | — | `renderEncounter()` owns all combat-panel DOM; the card is a new region inside its existing branch structure |
| In-combat vs out-of-combat toast routing | Frontend Shell (`dispatchWithToasts`, module script) | — | The routing decision reads `state.combat` (shell-visible state), not engine logic — this is presentation dispatch, not a rule |
| Arm-delay / dismiss-settle guards | Frontend Shell (new pure module `src/browser/inputGuards.js`) + Shell wiring | — | Pure `Date.now()` predicates (DOM-free, unit-testable) bridged onto `window.__mzInputGuards`, exactly like `__mzConditionsOf`/`__mzCanCast` |
| Combat rules (fight gate, refusals, afraid/ward) | Engine (`engine/combat.js`) | — | Already shipped by Phase 31; Phase 32 reads it, never modifies it |
| Oracle log (full unabridged record) | Frontend Shell (`#log`, `logLine`) | — | Untouched; the round card is a VIEW over the same `events[]`/`html[]` the Oracle already consumes, never a second writer |

## Project Constraints (from CLAUDE.md)

- **Rules engine decoupled from UI, fully serializable:** already honored — this phase is explicitly shell/presentation-only; no `engine/` file is touched, and `S.roundCard` (or its module-scope equivalent) is explicitly never serialized per CONTEXT.
- **Offline, no network, no accounts:** unaffected — no new network calls introduced.
- **Paid upfront, no ads/IAP, no monetization SDKs:** unaffected — zero new packages (see Package Legitimacy Audit).
- **Fidelity — prototype rules are canon, deviations must be deliberate:** unaffected — no rule/engine behavior changes; the round card is a pure re-routing of already-shipped, already-tested `toastsForAction` output.
- **Performance/feel — responsive on mid-range phones, 5-10 min sessions:** directly in scope — the `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` guards and the max-height/overflow-y:auto round card are performance/feel requirements this phase implements.
- **Tone & voice — sarcastic, dark-humor, family-friendly:** applies to the round header copy and any new framing lines (CONTEXT: "Claude's Discretion... voice safety scan must pass").
- **Android/Capacitor stack (Capacitor 8.x, no `@capacitor/ios`):** unaffected — no native/plugin changes; `tools/build-www.mjs`'s `CAPACITOR_PACKAGES` allow-list is unchanged (see Package Legitimacy Audit).

## Package Legitimacy Audit

**Not applicable — this phase installs no new packages.** No `npm install` of any kind; `src/browser/inputGuards.js` is a new in-repo pure ES module with zero imports (mirrors `src/browser/controls.js`'s own zero-import pattern). `tools/build-www.mjs`'s `CAPACITOR_PACKAGES` allow-list (L64-77) is unchanged. Verified via `git status --porcelain` expectations and direct read of `package.json` (dependencies unchanged from Phase 31's baseline: `@capacitor/android`, `@capacitor/app`, `@capacitor/core`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/screen-orientation`, `@capacitor/splash-screen`, `@capacitor/status-bar`, devDependency `@capacitor/cli` — all pre-existing).

## Architecture Patterns

### System Architecture Diagram

```
Player taps a decision button (Strike/Fight!/Take-loot/Move-on/…)
        │
        ▼
mazeworld.html classic script: button.onclick → window.mz<Action>()
        │
        ▼
module script: engineCombatAction(type) / inventoryAction(action) / window.move
        │  (each calls dispatchWithToasts(action) internally)
        ▼
dispatchWithToasts(action)                              ← THE ROUTING SEAM
  ├─ dispatch(action) → engine/engine.js#applyAction → { state, events, html }
  ├─ toastsForAction(action.type, events, ctx) → toast[] {text, tone, priority}
  │      (pure groupers: encounterStart/enemyRound/yourRound/spellChain/
  │       fleeChain/parleyChain/chestChain/killFold — UNCHANGED, reused verbatim)
  └─ NEW: route each toast —
         if state.combat && toast.priority !== PRIORITY.block
              → append to the round-card line buffer (S.roundCard or module var)
         else
              → window.mzToast?.(text, tone)   [existing toast host, unchanged]
        │
        ▼
caller (engineCombatAction/inventoryAction/window.move) sets window.__mzState,
  calls window.logLine(html) for EVERY line (Oracle unaffected — always full),
  calls window.paint()/window.draw()/window.renderEncounter()
        │
        ▼
renderEncounter() rebuilds #enc-body (innerHTML="") EVERY render:
  head → foe roster (always first, never hidden) → NEW: Round Card region
  (persistent wrapper OUTSIDE #enc-body innerHTML churn — aria-live safe)
  → action bar (guarded via window.__mzInputGuards.isArmed(renderedAt, Date.now()))
```

### Recommended Project Structure

No new directories. One new file:
```
src/browser/
├── controls.js        # existing sibling: TAP_MOVE_THRESHOLD_PX, TAP_MAX_DURATION_MS
├── inputGuards.js      # NEW: ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed(), isSettled()
├── toasts.js           # existing, UNCHANGED (groupers/PRIORITY/MAX_TOASTS reused verbatim)
```

### Pattern 1: Pure timing-guard module bridged onto `window.__mz*`

**What:** A DOM-free, `Date.now()`-only module (no imports, mirrors `controls.js`) exporting two constants and two predicate functions.
**When to use:** Any place a freshly-rendered decision button or the movement path needs a "too soon" check.
**Example (the shape to build, following the `controls.js` precedent at `src/browser/controls.js` L19-23):**
```javascript
// src/browser/inputGuards.js
export const ARM_DELAY_MS = 250;
export const DISMISS_SETTLE_MS = 250;

export function isArmed(renderedAt, now) {
  return (now - renderedAt) >= ARM_DELAY_MS;
}
export function isSettled(lastDismissAt, now) {
  return (now - lastDismissAt) >= DISMISS_SETTLE_MS;
}
```
Bridged exactly like `window.__mzCanCast = canCast;` (mazeworld.html L5742) — e.g. `window.__mzInputGuards = { ARM_DELAY_MS, DISMISS_SETTLE_MS, isArmed, isSettled };` alongside the other bridge assignments at mazeworld.html L5705-5757.

### Pattern 2: Routing split inside a single pipeline function

**What:** `dispatchWithToasts` (mazeworld.html L6110-6115) is the ONE place every action's toasts are raised. The routing split belongs INSIDE this function, not scattered across call sites (`engineCombatAction`, `inventoryAction`, `window.move` all call it).
**When to use:** Any in-combat vs out-of-combat presentation-destination decision.
**Current code (verbatim, the exact block to modify):**
```javascript
// mazeworld.html L6110-6115
function dispatchWithToasts(action) {
    const result = dispatch(action);
    const ctx = NARRATIVE_ACTIONS.has(action.type) ? { narrate: narrateEvent } : {};
    for (const t of toastsForAction(action.type, result.events, ctx)) window.mzToast?.(t.text, t.tone);
    return result;
}
```
The routing test (CONTEXT's "routing exclusivity" test) must prove no toast is ever both carded and toasted — this function is the single choke point where that invariant is enforced, so the exclusivity is structural (an `if/else`, not two independent code paths that could both fire).

### Pattern 3: Persistent aria-live wrapper outside the innerHTML-churned region

**What:** `#enc-panel`'s two children are NOT symmetric: `.enc-topbar` (containing `#enc-round` and `#enc-dismiss-slot`) is a **persistent** DOM subtree (mazeworld.html L1398-1409) — `renderEncounter()` only ever calls `.innerHTML = ""` on `#enc-body` (L4881), never on `.enc-topbar`'s own children (it clears `#enc-dismiss-slot`'s innerHTML individually but the node itself persists). The Round Card's `aria-live="polite"` region needs the SAME persistence contract, or screen readers will not announce it reliably (§6.7 Pitfall 1) — a node destroyed and recreated by `#enc-body.innerHTML=""` does not count as "the same live region" to assistive tech from render to render.
**When to use:** Placing the Round Card DOM node.
**Recommendation:** Either (a) add a new persistent sibling div next to `#enc-body` inside `#enc-panel` (mirroring `.enc-topbar`'s persistence, mazeworld.html L1398-1409) whose `innerHTML` alone is rewritten each render, or (b) if the card must live inside `#enc-body` per the design's visual stacking order (roster → card → actions, §6.1), give it a stable `id` and verify empirically that `aria-live` regions recreated via a parent's `innerHTML=""` still work in the target WebView — CONTEXT already flags this as "Claude's Discretion," but the persistence mechanics above should inform the choice, not just the visual layout.

### Anti-Patterns to Avoid

- **CSS-transition-based arm delay:** the blanket `prefers-reduced-motion` rule at mazeworld.html L773 (`*{transition:none!important;animation:none!important}`) silently zeroes any transition-based timing guard for those users. Both new guards MUST be `Date.now()` comparisons only (CONTEXT is explicit; confirmed no existing guard code in the file uses any other mechanism — `grep -c pointerdown|armed|disabled=` in the design doc's own research found zero button guards today).
- **Duplicating `toastsForAction`'s folding logic inside `renderEncounter`:** the round card must consume `toastsForAction`'s OUTPUT (an array of `{text, tone, priority}` objects), never re-implement grouping. `enemyRound`/`yourRound`/`spellChain`/`killFold`/`encounterStart`/`fleeChain`/`parleyChain`/`chestChain` (src/browser/toasts.js L365-792) stay unmodified.
- **Re-stripping HTML from toast text:** every `TOAST_FOR` builder (src/browser/toasts.js L860+) returns plain text — `grep -n "text:.*<" src/browser/toasts.js` returns zero matches. `narrativeToastText` is invoked internally by `toastsForAction` ONLY for `NARRATIVE_ACTIONS` (move/camp/resolveJoiner, via `ctx.narrate`) — combat action toasts never carry HTML. The round card can safely template `toast.text` directly (`<p>${text}</p>`) without calling `narrativeToastText` a second time; CONTEXT's mention of it is defensive/future-proofing, not a strict requirement given the current text shape (see Open Question 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Round-event grouping (3+ foes collapse, kill-fold suffixes, spell chains) | A new round-card-specific folding pass | `toastsForAction` (src/browser/toasts.js), unmodified | Already handles every fold case in this phase's scope; a second implementation would drift from the Oracle's own event consumption and double the test surface |
| Toast lifetime/dedupe/priority-sort/MAX_TOASTS cap | Custom round-card visible-item logic | The existing `PRIORITY`/`dedupeByType`/cap-at-4 logic inside `toastsForAction` | The design's "line cap: none, max-height scroll instead" (CONTEXT Area 1) means the round card does NOT need a cap at all — every returned toast becomes a line; do not port `MAX_TOASTS` semantics into the card |
| Arm-delay / debounce | A generic third-party debounce lib or a `setTimeout`-based lock | The two `Date.now()` predicates in the new `inputGuards.js` | Zero new dependencies; matches the existing `controls.js` sibling-constants precedent exactly |

**Key insight:** every reusable piece this phase needs already exists and is pure/tested (`toastsForAction`, `narrativeToastText`, the bridge pattern, the source-assertion test style). The actual net-new surface is small: one pure module, one `renderEncounter` region, one `dispatchWithToasts` branch, and guard wiring on ~10 named buttons.

## Common Pitfalls

### Pitfall 1: aria-live region destroyed every render
**What goes wrong:** If the Round Card's `aria-live="polite"` wrapper is a child of `#enc-body` and gets torn down by `body.innerHTML = ""` (mazeworld.html L4881) every render, screen readers may stop announcing updates because the "same" live region is actually a brand-new DOM node each time.
**Why it happens:** `#enc-body` is fully rebuilt on every `renderEncounter()` call (every action, every tick).
**How to avoid:** See Pattern 3 above — either hoist the live-region wrapper outside `#enc-body`'s innerHTML churn (mirroring `.enc-topbar`'s persistence) or empirically verify the WebView's live-region behavior across innerHTML rebuilds before committing to the in-body placement.
**Warning signs:** TalkBack/manual accessibility testing shows the round narrative silently updating with no announcement.

### Pitfall 2: `dispatchWithToasts` is the only place `state.combat` is knowable at routing time
**What goes wrong:** `dispatchWithToasts` runs `dispatch(action)` FIRST, which may itself END combat (a kill, a flee, a parley success) or START it. Whether a given toast should route to the round card depends on `state.combat` AFTER dispatch, not before — e.g., the LAST round of a fight (killing the final foe) still has `state.combat` truthy at toast-build time only if the check happens before `endCombat` clears it inside the engine, or the routing must special-case "this action's events ended combat" the same way `noteCombat` already does (mazeworld.html L6029-6073, `wasCombat && has` vs `wasCombat && !has`).
**Why it happens:** Combat start/end is a mid-dispatch state transition, not a stable pre-condition.
**How to avoid:** Route based on `wasCombat` (the value BEFORE dispatch, already sampled by every caller — `engineCombatAction`/`window.move` both compute `wasCombat` before calling `dispatchWithToasts`) OR based on `result.state.combat` (AFTER) with an explicit decision for the "combat just ended this action" edge case — the encounter-cleared report already goes to the loot card / a beats card via `noteCombat`, not through `toastsForAction`'s in-combat routing, so the routing predicate should likely be "was combat active before this action" to catch the final round's own strike/kill toasts, while the post-combat report stays on its existing separate path.
**Warning signs:** The final round's own hit/kill lines silently vanish (never toasted, never carded) because the routing check ran against post-dispatch `state.combat === null`.

### Pitfall 3: two hand-written `mzToast?.()` calls bypass `toastsForAction` entirely
**What goes wrong:** mazeworld.html L5285 and L5576 (the "Already at full health." guard on Potion, click and key-2 paths) call `window.mzToast?.("Already at full health.", "block")` directly — NOT through `toastsForAction`/`dispatchWithToasts`. If the routing logic is implemented by wrapping `window.mzToast` itself (rather than only the loop inside `dispatchWithToasts`), these two calls get swept in unintentionally, even though they are legitimately refusal-style and already correctly toast-only.
**Why it happens:** They are a PRE-dispatch guard (the action never even reaches the engine) — CONTEXT's routing rule is about `toastsForAction`'s OUTPUT, and these two calls never touch that pipeline.
**How to avoid:** Implement routing as a branch INSIDE the `for (const t of toastsForAction(...))` loop in `dispatchWithToasts`, not as a wrapper around `window.mzToast` globally. Confirmed via exhaustive grep (`grep -n "mzToast" mazeworld.html`) — there are exactly 4 non-definition references: L5285, L5576 (both pre-dispatch block guards, leave untouched), L6113 (the pipeline call, the one to modify), plus 3 doc-comment mentions.
**Warning signs:** A full-health Potion tap in combat starts appending to the round card instead of toasting immediately.

### Pitfall 4: `f.frenzied` (foe-side) is a real, separate mechanic from player-side Fridgian "frenzy"
**What goes wrong:** The design doc's phrase "worst-case round (4 foes, frenzied, abilities)" (§6.7/CONTEXT Area 1) could be misread as the player-side Fridgian racial "frenzy" (engine/combat.js L479, a SECOND player swing — event type `frenzy`, a `FEATURE_EVENTS` entry). There is a SEPARATE, foe-side `f.frenzied` flag (set by a spell effect, `engine/magic.js` L349; read at `engine/combat.js` L1777: `const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);`) that doubles a FOE's swing count, and stacks multiplicatively with a foe's own `sp.atk: 2` (some bestiary entries, e.g. Djinni/Vampire/Stalka Beast already carry `sp.atk: 2` per `content/bestiary.js`), producing up to 4 swings from a single frenzied multi-attack foe.
**Why it happens:** Same English word, two different mechanics (player racial trait vs. foe status effect), both real and both able to inflate a round's event count independently.
**How to avoid:** When building the worst-case-round measurement harness/test, construct a scenario combining BOTH: up to 4 foes (`FOE_CAP_MAX`, `engine/difficulty.js` L139), at least one with `sp.atk: 2` AND `frenzied: true` (4 swings), plus at least one foe with an `abilities` kit (bolt/drain/debuff/heal/summon chain, `content/foe-abilities.js`), to get a genuine ceiling rather than an underestimate.
**Warning signs:** A measured "worst case" that undercounts because it only exercised one swing per foe.

### Pitfall 5: the foe roster must render before any early-return branch that could hide it
**What goes wrong:** `renderEncounter()`'s branch order (mazeworld.html L4896-5144: death → won → beats → pendingLoot → pendingJoiner → pendingFind → store → live combat) means the roster+card+actions block ONLY renders in the final, un-early-returned branch (L5144 onward). CONTEXT/§6.1 requires the foe roster "never hidden," but it is structurally absent from every one of those six earlier branches (loot/joiner/find/death/won/beats) — this is EXISTING behavior, not a Phase 32 regression, but the round card's placement must not be misread as needing to appear in those branches too.
**Why it happens:** Those branches are decision surfaces, not round narrative — they intentionally replace the combat panel view.
**How to avoid:** Confirm with the design doc (§6.1 wireframes) that "foe roster never hidden" scopes to the LIVE COMBAT branch only (where it already always renders first, L5171-5187) — the loot/joiner/find/death cards are correctly roster-free by existing design, not a gap Phase 32 needs to close.
**Warning signs:** A plan task mistakenly tries to inject the foe roster into the loot or joiner branch.

### Pitfall 6: CONTEXT's `feedback-payload.test.js` claim does not match live grep
**What goes wrong:** CONTEXT §Area 3 states "`feedback-payload` 37 re-pinned where a payload assertion checks the toast destination for an in-combat event." Direct grep of `test/unit/feedback-payload.test.js` for `mzToast|toastsForAction|destination|host\b` returns **zero matches** — every one of its 37 tests asserts engine event PAYLOAD SHAPE (`soaked`, `needMods`, `critBy`, `EVENT_NARRATION` builder output), never a toast destination or routing decision.
**Why it happens:** Likely an artifact of the design doc's earlier drafting before the file's actual contents were re-verified this session (mirrors the doc's own pattern of correcting stale counts, e.g. 189→199 toast types, 98→89 test total).
**How to avoid:** The planner should NOT budget a task to "re-pin feedback-payload.test.js for routing" — expect this file to require ZERO changes from Phase 32 (it tests engine event shapes, which are unchanged; the only way it could break is if an `EVENT_NARRATION` builder's output format changed, which it isn't). Verify this expectation empirically during Wave 1 rather than trusting CONTEXT's count.
**Warning signs:** A task plan that budgets meaningful effort to `feedback-payload.test.js` changes will discover there's nothing to change and should be corrected, not silently worked around.

## Code Examples

### The exact `dispatchWithToasts` seam to modify (mazeworld.html L6110-6115)
```javascript
// Source: mazeworld.html, verbatim, current state
function dispatchWithToasts(action) {
    const result = dispatch(action);
    const ctx = NARRATIVE_ACTIONS.has(action.type) ? { narrate: narrateEvent } : {};
    for (const t of toastsForAction(action.type, result.events, ctx)) window.mzToast?.(t.text, t.tone);
    return result;
}
```

### The exact `.exchange` block being replaced (mazeworld.html L5266-5272, inside `renderEncounter`)
```javascript
// Source: mazeworld.html, the block Phase 32 deletes/replaces
if (S.lastExchange && S.lastExchange.length) {
    const ex = document.createElement("div");
    ex.className = "exchange";
    ex.dataset.n = S.exchangeN || 0;
    ex.innerHTML = `<h4>Last exchange</h4>` + S.lastExchange.slice(-6).map(l => `<p>${l}</p>`).join("");
    body.appendChild(ex);
}
```
Note: the old block sliced to the LAST 6 lines (`.slice(-6)`) — CONTEXT's "line cap: none... max-height with inner overflow-y:auto" explicitly changes this contract; the new card must NOT reintroduce a slice cap.

### The exact bridge pattern to follow (mazeworld.html L5734-5757)
```javascript
// Source: mazeworld.html, the established bridge convention
window.__mzConditionsOf = conditionsOf;
window.__mzCanCast = canCast;
window.__mzArmorDisplay = { armorDisplay, bagArmorText };
window.__mzBagUsage = bagUsage;
window.__mzLootCompare = lootCompare;
```

### Source-assertion test style to follow (test/unit/shell-loot-screen.test.js L24-60, and shell-toast-wiring.test.js L15-53)
```javascript
// Source: test/unit/shell-loot-screen.test.js, the pattern every new
// renderEncounter/inputGuards source-assertion test should mirror
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RAW_HTML = fs.readFileSync(path.join(REPO_ROOT, "mazeworld.html"), "utf8");
const HTML = RAW_HTML.replace(/\r\n/g, "\n");
function stripComments(source) {
  const noLineComments = source.split("\n").map((line) => {
    const i = line.indexOf("//");
    return i === -1 ? line : line.slice(0, i);
  }).join("\n");
  return noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
}
const CODE = stripComments(HTML);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `S.lastExchange`/`S.exchangeN` — a `.slice(-6)`-capped array of raw HTML lines captured by `act()`'s `CAPTURE` mechanism (mazeworld.html L2663-2685, only reachable via the DEAD classic combat functions) | Round Card sourced from `toastsForAction`'s already-live, already-tested output — a structurally different data source (short plain-text toast objects, not raw HTML capture) | Phase 32 (this phase) | `S.lastExchange`'s underlying `act()`/`CAPTURE`/`newBeat` machinery (L2646-2685) appears to be DEAD CODE already — `act()` is only invoked by the classic (unreachable, per Phase 31's own doc comments) combat functions, not by the engine-routed `engineCombatAction` path every live button uses. Confirm during planning whether `act()`/`CAPTURE`/`newBeat`/`evt()` have ANY live caller left after `S.lastExchange` is removed, or whether they become fully prunable dead code (a bonus cleanup, not required scope) |
| Combat feedback: up to 4 independently-timed, independently-dismissible toasts per round (Phase 25/25.1 baseline) | ONE always-visible Round Card, reusing the SAME grouping pipeline | Phase 30 ratification (2026-09-16) → built in Phase 32 | Toast count for in-combat events drops effectively to zero (refusals excepted); `MAX_TOASTS`/lifetime/dedupe logic stays live for out-of-combat toasts only |
| Zero button arm-delay/dismiss-settle guards anywhere in the file (confirmed: `grep -c pointerdown|setTimeout|armed|pointer-events|disabled=` → zero card-button guards, per the design doc's own research) | `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` = 250ms `Date.now()` guards on every named decision button | Phase 32 (this phase) | New pure module + wiring on ~10 button sites |

**Deprecated/outdated:**
- `S.lastExchange`/`S.exchangeN`: removed entirely this phase, per CONTEXT. Confirmed zero parity impact (both fields already excluded from all three `*Comparable()` functions in `test/parity/harness/comparables.js`, and the frozen `prototype-master.js.txt`'s own copies are presentation-only prototype code never read by the engine).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `narrativeToastText` is not strictly required for round-card line rendering because no `TOAST_FOR` builder currently emits HTML in `.text` | Anti-Patterns / Code Examples | Low — if a future toast builder ever embeds HTML, an unstripped `<p>${text}</p>` template would render it literally; calling `narrativeToastText` defensively (as CONTEXT suggests) costs nothing and removes this risk entirely, so the safe default is to include it even though today's data doesn't require it |
| A2 | The correct routing predicate is `wasCombat` (pre-dispatch), not `state.combat` (post-dispatch), to correctly route the FINAL round's own toasts | Pitfall 2 | Medium — if the planner instead routes on post-dispatch `state.combat`, the last round of every fight (the kill blow) would misroute its own strike/kill toasts to the regular toast host instead of the round card, producing a visible seam exactly on the encounter-clearing round, the highest-attention moment of the fight |
| A3 | `act()`/`CAPTURE`/`newBeat`/`evt()` (mazeworld.html L2646-2685) have no remaining live caller once `S.lastExchange` is deleted, making them prunable dead code | State of the Art | Low — this is scope creep if wrong; a `grep` for live (non-dead-branch) callers should be run during planning/execution before any deletion is attempted, and removing this machinery is NOT required by CONTEXT — flagged as an opportunistic cleanup only |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does `toastsForAction`'s output ever need HTML-stripping for the round card?**
   - What we know: every `TOAST_FOR` builder returns plain text (confirmed via `grep -n "text:.*<" src/browser/toasts.js` → zero matches); `narrativeToastText` is invoked internally only for `NARRATIVE_ACTIONS` (move/camp/resolveJoiner), which never appear as in-combat toasts.
   - What's unclear: whether some FUTURE toast builder could introduce HTML, or whether the design intends `narrativeToastText` as a defensive pass regardless.
   - Recommendation: call `narrativeToastText(toast.text)` anyway when building each line (cheap, defensive, matches CONTEXT's literal wording) even though today's data makes it a no-op.

2. **Where exactly does the Round Card's DOM node live relative to `#enc-body`'s innerHTML churn, for `aria-live` correctness?**
   - What we know: `.enc-topbar` (containing `#enc-round`/`#enc-dismiss-slot`) is the one proven-persistent pattern in this file; `#enc-body` is fully torn down every render.
   - What's unclear: whether a WebView (the actual Android target, not just desktop Chrome) reliably re-announces an `aria-live` region recreated inside an innerHTML rebuild, or whether true persistence (a sibling of `#enc-body`, not a child) is required.
   - Recommendation: default to placing the card as a persistent sibling of `#enc-body` (inside `.enc-topbar`'s parent, `#enc-panel`) whose `innerHTML` (not the node itself) is rewritten each render — the same mechanics `#enc-round`'s `.textContent =` already uses successfully.

3. **What exact test file houses the new "worst-case round" line-count measurement?**
   - What we know: no `test/tuning` or `test/harness` directory exists; `tools/lib/tuning-bot.mjs` (used by `test/unit/tuning-bot.test.js`) runs full simulated delves, not single forced combat rounds; `test/unit/foe-abilities.test.js`'s `fixedState`/`fixedFoe`/`fakeRng` helpers (L15-80) are the closest precedent for directly constructing a `state.combat` with a specific foe roster and a rng sequence that maximizes hits/crits/abilities.
   - What's unclear: whether the planner should add this as a NEW test file (e.g. `test/unit/round-card-line-count.test.js`) or fold it into whichever file houses the round-card's own source assertions.
   - Recommendation: a new, narrowly-scoped test file using the `foe-abilities.test.js` harness pattern — construct 4 foes (at least one `sp.atk:2` + `frenzied:true`, at least one with an `abilities` kit), a Fridgian hero (player-side frenzy), run one `foeTurn`+`playerStrike` cycle with a maximizing `fakeRng`, feed the resulting events through `toastsForAction`, count lines, assert against the design's ~40%-panel-height line budget (no hard cap per CONTEXT, but the SUMMARY must record the number).

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the existing Node 22+ / `node --test` toolchain already verified working this session (`npm test` ran clean, 1855/1855).

## Sources

### Primary (HIGH confidence — direct code inspection, this session)
- `mazeworld.html` (6812 lines) — `renderEncounter` (L4869-5306), `hasActiveEncounter` (L4761-4778), `window.move`/`engineMove` (L6117-6178), the keydown handler (L5552-5597), `dispatchWithToasts`/`noteCombat`/`engineCombatAction`/`inventoryAction` (L6029-6618), the `mzToast` definition (L2712-2732) and its exhaustive call-site grep, the `.exchange`/`prefers-reduced-motion`/`.mw-round-tick`/`#enc-panel` DOM structure and CSS (L534-773, L1398-1409), `act()`/`CAPTURE`/`newBeat` (L2646-2685), `wireDeathConfirm`/`renderCarriedList`/`renderDropShelf` (L3521-3592, L4798-4804)
- `src/browser/toasts.js` (1349 lines, read through L891 + targeted greps for the remainder) — `TOAST_FOR`, `PRIORITY`, `TOAST_FOR` text-shape audit, `toastsForAction` pipeline (L826-858), all groupers, `narrativeToastText`/`ORACLE_ONLY`/`FEATURE_EVENTS`/`CARD_EVENTS`/`NARRATIVE_ACTIONS`/`MAX_TOASTS`/`toastLifetime`
- `src/browser/controls.js` (full read) — the sibling-constants precedent (`TAP_MOVE_THRESHOLD_PX`, `TAP_MAX_DURATION_MS`)
- `test/parity/combat-parity.test.js`, `test/parity/harness/comparables.js`, `test/parity/prototype-master.js.txt` (grepped) — confirmed `lastExchange`/`exchangeN` are excluded from every parity comparable
- `test/unit/shell-loot-screen.test.js`, `test/unit/shell-toast-wiring.test.js`, `test/unit/foe-abilities.test.js` (read/grepped) — source-assertion test pattern, `fixedState`/`fixedFoe`/`fakeRng` harness pattern
- `test/unit/feedback-payload.test.js` (test-name grep + destination-keyword grep) — confirmed zero toast-destination assertions, correcting CONTEXT
- `tools/build-www.mjs` (full read) — confirmed no bundler registration needed for a new `src/browser/` file
- `package.json`, `.planning/config.json` — scripts, dependencies, `nyquist_validation: false`, `security_enforcement: false`
- `content/bestiary.js`, `engine/combat.js`, `engine/magic.js`, `engine/difficulty.js` (grepped) — `f.frenzied` (foe-side, distinct from player-side `frenzy`), `FOE_CAP_MAX = 4`, `sp.atk` multi-attack
- Live `node --test` per file (5 files) and `npm test` (full suite) run this session: 89 tests across the 5 named files (15/21/37/8/8), full suite 1855/1855, 0 fail

### Secondary (MEDIUM confidence)
- `docs/COMBAT-NARRATIVE-DESIGN.md` (full read) — the ratified design, §4/§6 build contract, itself built on this project's own HIGH-confidence code reads per its own sourcing statement
- `.planning/phases/31-combat-start-gating-effect-hygiene/31-03-SUMMARY.md` — "Phase 32 hand-off" section, confirms `C.pending` is the single source of truth and refusals must stay toasts

### Tertiary (LOW confidence)
- None — no web research was performed or needed for this phase.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new libraries; reuses existing in-repo modules exclusively
- Architecture: HIGH — every seam identified via direct file read with line numbers, cross-checked against the ratified design doc
- Pitfalls: HIGH for the parity/routing/grep-based findings (directly verified); MEDIUM for the `aria-live`-in-WebView behavior (Open Question 2, genuinely needs on-device or WebView-specific verification, not just code-read)

**Research date:** 2026-09-16
**Valid until:** No engine/toast-module churn expected before Phase 32 executes (same milestone, immediately following); treat as valid through Phase 32's completion. Re-verify test counts if any other phase work lands in parallel.
