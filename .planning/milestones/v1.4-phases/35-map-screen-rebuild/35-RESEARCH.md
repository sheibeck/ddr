# Phase 35: Map Screen Rebuild - Research

**Researched:** 2026-09-16
**Domain:** Vanilla-JS shell rebuild of the map/exploration screen (touch input, canvas rendering, presentation state machine) — no engine changes
**Confidence:** HIGH (all claims below are grounded in direct reads of the current `mazeworld.html` / `engine/*.js` / `src/browser/*.js` at HEAD `8dc47b6`, master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`, confirmed unchanged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**User rulings (2026-09-16) — override the mock where they differ**
1. **Toasts are gone everywhere.** Out of combat → the RAIL. In combat → the › log (refusals as dull entries, Phase 34). `#mw-toast-host`, `mzToast`, `toastLifetime`, `MAX_TOASTS` and the toast CSS are retired; `toastsForAction` stays as the pure event→line folder feeding both surfaces.
2. **Tap to move replaces the arrows** — "saves real estate and makes play smoother." The D-pad, `.mazefoot` and `src/browser/controls.js`' D-pad wiring go; keyboard arrows stay for desktop.
3. **Never move past an active choice.** Tap-to-step is DISABLED while a rail decision (joiner, find, climb…) or an obstacle (wall/crevice) is pending: a tap re-shows/pulses the pending card and does not step; a wall/crevice square holds the party until a successful roll. The mock's "walking away declines" is REJECTED.
4. **Crevices/walls: climb only.** No "go round". The rail shows the roll (e.g. `climb d20+4 · 9 to clear`) and the outcome with dice; failure re-offers CLIMB IT (with any damage line) until success.
5. **Condition chips live in the HUD**, in a strip directly under FLOOR/DAY/SQUARES/RATIONS (the user updated the mock): chips `flex:none`, `border 1px <tone.edge>`, bg `#1b170f`, padding `3px 5px`, Press Start 2P 5.5px, tone ink (bad `#a63a2c/#e07260`, warn `#6b5c3c/#e8c97a`, odd `#5b4a86/#b9a4ef`, good `#5e7a3c/#a8cc72`), a remaining-count suffix (Courier 700 10px `#8f856f`) when the condition has one; tap a chip → its explanation in the rail (info tone). Strip hidden when empty. Source: `conditionsOf` (Phase 31 shapes incl. `afraid`, `ward {pool, remaining}`, `acute`). Armor and gold move to the Hero tab only.

**HUD (MAP-01)**
- Strip (flex:none, bg `#1b170f`, `border-bottom 3px #3a3226`, padding `8px 14px 9px`): left = `FLOOR n` (value gold), `DAY n`, `SQUARES n`, `RATIONS n` (red `#e05a48` when ≤ 2) — labels Press Start 2P 6.5px `#9a8f76`, values Courier 700 16px, `margin-left:-6px`; right = `x/y WP` (red when ≤ 25 %) over a 64×5 bar (`#7f9d4e` > 50 %, `#e8c97a` > 22 %, else `#e05a48`). `SQUARES` = the run's squares walked (existing counter). The app's tab bar stays below the rail.

**Viewport & movement (MAP-02, MAP-07)**
- Canvas renderer kept; adopt the palette: fog `#0b0a08`, wall `#2c261c` with the inset bevel, floor `#645c48`, border `#443a26`, party marker `#f4dc94` with the gold pulse (`mwglow`, respects reduced motion), colored mark glyphs (● `#e05a48` encounter, ◆ `#a78ce8` teleport, ▲ `#8ec06a` one-way door, ✕ `#e05a48` trap, ▪ `#d3c49f` box, ⧗ crevice, ▼ descent) at ~60 % of the cell, inset vignette `0 0 70px 26px rgba(8,7,5,.92)`.
- Pointer model on the viewport (`touch-action:none`): tap (≤ 10 px travel, one finger, < 450 ms) = one step toward the tapped square — dominant axis first, other axis as fallback, both blocked → rail dull "NO WAY THAT DIRECTION"; tap on the party's square → "YOU ARE HERE"; hold ≥ 450 ms = inspect (unwalked / rock / mark legend line / empty corridor); drag = pan; two fingers = pinch (0.6–2.0, existing clamp constants may be re-ranged), origin on the party; a step resets pan and recenters (Phase 33 recenter hooks stay).
- Every step still dispatches the engine's `move`; the existing guards (`hasActiveEncounter`, `encounterSettled`, the new pending-decision lock) run before any step.
- Chips over the viewport (top-left MARKS, CENTRE; top-right MAKE CAMP) per the spec block; the Phase 33 `.mw-viewport-chips` row is replaced by these.

**The RAIL (MAP-03, MAP-04)**
- One persistent element under the viewport (flex:none, `min-height 132`, padding `14px 16px 30px`, `border-top 3px <tone.edge>`, bg `#1b170f` active / `#161209` idle), `aria-live="polite"`: icon · title (Press Start 2P 8px) · line (Courier 700 14.5px) · roll line (Courier 700 13.5px tone ink) · idle peek hint (`TAP TO STEP` / `PINCH OUT`). Tones info/good/bad/odd/dull per the spec block.
- Source = the same folded lines `toastsForAction` produces for the action (uncapped), mapped to `{icon, title, line, roll, tone, hold}` by a pure `src/browser/rail.js` view-model (title = the event family's headline copy, line = the narrative sentence, roll = the dice payload when present, tone by event family: damage/hunger/refusal = bad, finds/camp/level-up = good, teleport/door/floor = odd, moves/rock = dull, everything else info). Events without actions auto-clear after `hold` (default 4200; dull 2200–3400; level-up ~6000). Multiple lines from one action stack newest-first inside the card (the card grows; still one card).
- Decisions = rail cards with an action row: joiner offer (TAKE THEM ALONG / LEAVE THEM), find / locked box (PICK THE LOCK / LEAVE IT — using the existing find/pick actions), climb (CLIMB IT only), any other engine yes/no. While such a card is up: movement locked (ruling 3), the card persists until answered, the primary button is tone-ink.
- Every rail line still reaches the Oracle exactly as today (the Oracle path is untouched).
- The Move-on `S.beats` cards (floor change / level-up) are retired: level-up → good rail card with a longer hold; floor arrival → odd rail card ("FLOOR N · The air changes…").

**MAJOR OVERLAY (MAP-05)**
- Full-screen over the map (bg `#0d0b08`, column centered, padding `28px 22px`): icon 54px, title Press Start 2P 15px gold, line Courier 700 17px, roll line, stacked buttons (primary gold / secondary bordered). Used for: encounter (`combat.pending` — built in Phase 34: SOMETHING IS HERE / THEY ARE ALREADY HERE, foes named, FIGHT IT OUT → `fight`), the stair down (THE STAIR DOWN, "Floor N+1 is colder, longer…", GO DOWN → the existing descend action / NOT YET), and out-of-combat death (THAT IS THAT variant: cause + epitaph, REVIEW THE ORACLE / BURY THEM). It is the only surface that blocks the map; it is guarded.

**Sheets (MAP-06)**
- MARKS → bottom sheet "WHAT THE MARKS MEAN" (rows glyph · name · description from the existing legend data restyled; scrim tap closes). CENTRE → `mzCenterMap`. MAKE CAMP → bottom sheet with the mock copy and SLEEP 1 RATION / WALK ON; the existing refusal ("You eat N a night, you have M") → bad rail card "NOTHING TO EAT"; the camp result → good rail card with the mend/ambush dice.

**Guards & tests (MAP-08, MAP-09)**
- `guardTap` on every rail/overlay/sheet button; `DISMISS_SETTLE_MS` gates the first step after an overlay/sheet closes; `aria-live` announces a new rail card once (seq-gated, like Phase 32's announcer); no tap-anywhere-to-dismiss except the sheets' scrim.
- Retire/re-pin: `shell-toast-wiring`, `narrativeToasts` (keep the text helper), `toastTable`/`toastsCoverage` partition invariants (keep — now "rail or log"), `shell-party-camp`, D-pad/controls tests, beats/Move-on tests, HUD tests, marks-legend tests, `shell-map-store-polish` recenter pins (keep). Add: rail view-model tests (tone/hold per family, roll extraction, stacking), movement-lock tests (pending card / obstacle ⇒ no step), tap-to-step axis tests (pure helper), HUD/chip source assertions, overlay/sheet source assertions, voice scan on all new copy.
- Gate: `npm test` green, `npm run build:www` exit 0, `git diff -- engine content test/parity` empty, master hash `a1f4d0dc…`.

### Claude's Discretion
- The exact title/tone table per event family (must stay family-friendly sarcasm); where the tap-to-step helper lives (`src/browser/controls.js` refit vs a new `src/browser/tapStep.js`); how the pending-decision lock is represented (a `window.__mzRail` state with `pending: true`).

### Deferred Ideas (OUT OF SCOPE)
- Dice-mode setting (always/never) for rail and log — later.
- Store screen restyle to the same vocabulary — later.
- Porting the mock's pixel sprites (moss/rubble/torch/bone) onto the canvas — optional flourish, not required.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | HUD strip (FLOOR/DAY/SQUARES/RATIONS, WP bar) + condition-chip strip, tab bar stays | Current HUD DOM ids (`#m-floor`/`#m-day`/`#m-steps`/`#m-rations`/`#m-rat-wrap`/`#mm-hp*`) and `paintConditions`/`CONDITION_COPY`/`window.__mzConditionsOf` fully mapped; see Architecture Patterns and the code map in Summary |
| MAP-02 | Tap-to-step, hold-inspect, drag-pan, pinch-zoom, pending-lock, D-pad removed | `controls.js`'s dormant tap math (Pitfall 2), the viewport pointer handler to rewrite (L6184-6238), `TAP_MAX_DURATION_MS`/hold-threshold gap (Code Examples), the pending-lock design (Pattern 2, A4) |
| MAP-03 | RAIL replaces every toast, uncapped, auto-clearing | `toastsForAction`/`dispatchWithToasts` routing seam (Pattern 1, Pitfall 1), toast-retirement inventory (Pitfall 1) |
| MAP-04 | RAIL decision cards (joiner/find/climb), movement locked until answered | Existing `S.pendingJoiner`/`S.pendingFind` bridges (renderEncounter joiner/find branches, L5796-5888), climb/chest auto-resolve reality (Pitfalls 3, 5) |
| MAP-05 | MAJOR OVERLAY for encounter/descend/death | `renderMajorOverlay` (Phase 34-03, reused verbatim), descend's pre-dispatch-interception requirement (Pitfall 4), `renderCombatOver(body,"dead",...)` already wired for out-of-combat death (renderEncounter L5674-5688) |
| MAP-06 | MARKS/CENTRE/MAKE CAMP chips + sheets | Existing `.mw-legend-sheet` chrome reuse (Pattern 3), `mzMakeCamp`/`campFailed` bridge (Summary point 3), `MARKS_LEGEND` data (Sources) |
| MAP-07 | Canvas palette/marks adoption | Current `draw()`/`MAZE_CANVAS_COLORS`/`icons.js` PNG pipeline vs. mock's colored-glyph spec (Pitfall 6) |
| MAP-08 | Guards on every new button | `guardTap`/`encArmed`/`DISMISS_SETTLE_MS`/`inputGuards.js` patterns, reused unchanged (Don't Hand-Roll) |
| MAP-09 | Full suite green, build:www, engine/content/parity diff empty | Validation Architecture section; master hash confirmed live (`a1f4d0dc29782218d8e5aab65bc5989c33f917f0`) |
| MAP-10 | On-device Pixel 7 DR round | Deferred per project's Deferred UAT protocol (MEMORY.md) — no research needed, manual-only |
</phase_requirements>

## Summary

Phase 35 replaces the D-pad-driven map screen with the Claude Design mock's tap-to-step viewport, bottom RAIL, MAJOR OVERLAY and top chips — reusing Phase 34's `renderMajorOverlay(host, spec)` and the `#enc-panel`/`hasActiveEncounter()`/`guardTap` infrastructure verbatim. The good news: almost everything the CONTEXT spec asks for already exists in some form — `toastsForAction`'s fold pipeline, the `dispatchWithToasts` routing seam, the Marks-legend bottom-sheet chrome, the Settings-sheet scrim pattern, and even a **dormant** tap-to-cell math module (`src/browser/controls.js`'s `screenToCell`/`resolveTapDirection`/`classifyPointerGesture`, imported and bridged onto `window.__mzControls` but never wired to a movement dispatch since an earlier device-review revision disabled tap-to-move in favor of the D-pad).

The hard part is three engine-shape realities that the mock's copy implies but the engine does not provide, and that CONTEXT.md's own wording glosses over:

1. **Climb/crevice rolls already happen automatically, inside the same `move()` dispatch that approaches the tile** (`engine/movement.js` lines 138–211) — there is no separate "CLIMB IT, then roll" two-step; the dice are already rolled by the time any event reaches the shell. The CONTEXT rail sample ("climb d20+4 · 9 to clear" shown *before* a CLIMB IT tap) cannot be built as a pre-roll preview without an engine change (out of scope). The only shell-only-compatible design is: a tap toward a climb/gorge tile *is* the CLIMB IT action — it always rolls immediately — and on failure (you don't move) the rail shows the already-rolled result plus a CLIMB IT button whose tap is just "attempt this direction again" (`window.move(dir)`).
2. **Descending is unconditional and synchronous inside `move()`** (`engine/movement.js#descend`, called the instant you step onto an "exit"/"gate" tile) — there is no `pending`-style gate the way Phase 31 added for combat. The MAJOR OVERLAY's "THE STAIR DOWN / GO DOWN / NOT YET" therefore **must be a pre-dispatch shell interception**: before calling `window.move(dir)`, check whether the target cell (`S.floor.g[ny][nx].feat`) is `"exit"`/`"gate"`; if so, show the overlay and only dispatch `move` if GO DOWN is tapped. This is a materially different pattern from the encounter's `combat.pending` gate (which pauses *mid-flight*, after landing on the tile) and needs to be called out to the planner explicitly.
3. **There is no engine "pick the lock" action** — chest lock rolls (`chestLockRolled`/`chestOpened`/`chestLocked`) are auto-resolved the instant you step on a chest tile, exactly like climb rolls; CONTEXT's "PICK THE LOCK / LEAVE IT" phrasing describes the mock's toy mechanic, not ours. The one genuine decision on a chest tile is the pre-existing `S.pendingFind` Take it/Leave it prompt for the treasure inside (same `mzTakeFind`/`mzLeaveFind` bridges as any other find) — **this is a CONTEXT.md inaccuracy to flag**, mirroring Phase 34's `retarget` finding.

**Primary recommendation:** Build `src/browser/rail.js` (pure) and `src/browser/tapStep.js` (pure, extending `controls.js`'s dormant tap math) as new modules feeding a rewritten `renderEncounter()`/new `renderRail()` inside `mazeworld.html`, exactly mirroring Phase 34's module-then-shell-wiring pattern (34-01 built pure modules; 34-02..05 wired them in). Reuse `renderMajorOverlay` unchanged for descend/death. Treat the climb/descend/lock-roll realities above as **locked implementation guidance**, not open questions — they are forced by the "no engine changes" constraint, not by taste.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tap→direction resolution, pan/pinch, hold-inspect | Browser (pure `src/browser/tapStep.js` + DOM wiring in `mazeworld.html`) | — | Zero network/server; pure geometry + DOM event wiring, same tier as existing `controls.js` |
| Movement dispatch, climb/descend/chest auto-resolution, RNG | Engine (`engine/movement.js`, `engine/encounters.js`) | — | Already engine-owned; Phase 35 is shell-only and must not touch this tier |
| RAIL event→card folding (tone/title/hold) | Browser (pure `src/browser/rail.js`) | — | Mirrors `toasts.js`'s existing pure-fold-then-bridge pattern; DOM-free, unit-testable |
| RAIL rendering, pending-decision lock, obstacle retry | Browser (`mazeworld.html` shell) | — | DOM mutation + `window.__mz*` presentation state, same tier as `renderFightLog`/`renderCombatOver` |
| MAJOR OVERLAY (encounter/descend/death) | Browser (`renderMajorOverlay`, already built Phase 34-03) | — | Reused unchanged per Phase 34's own design intent |
| Canvas maze rendering (palette, marks) | Browser (`draw()`/`fit()` in `mazeworld.html`, `src/browser/icons.js`) | — | Client-only canvas; no server/CDN involvement |
| Sheets (MARKS/MAKE CAMP) | Browser (reuses `.mw-legend-sheet` chrome) | — | Pure DOM sheet, existing pattern |
| Persistence (S.storeRoll-style flags, if any new presentation flag is added) | Browser (`window.__mz*`, NOT `state.*`) | — | `serializeRun` spreads `S` wholesale — any new field on `S` gets persisted; presentation-only state must live off-state, per Phase 34's `window.__mzFightEnd`/`window.__mzCombatMenu` precedent |

## Standard Stack

No new libraries. This phase is 100% vanilla JS within the existing `mazeworld.html` + `src/browser/*.js` + `test/unit/*.test.js` architecture — same as Phase 34. No package.json changes are expected; the executor gate explicitly checks `git diff --stat -- package.json package-lock.json` is empty (Phase 34's own gate precedent, `34-05-SUMMARY.md`).

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — vanilla JS/DOM/Canvas 2D) | n/a | Rendering, touch input, state | Matches every prior phase; Capacitor/Android WebView constraint (CLAUDE.md) rules out any framework addition |

### Package Legitimacy Audit

**Not applicable — no external packages are installed by this phase.** `package.json`/`package-lock.json` diff must be empty at the phase gate (mirrors Phase 34's D7/D9 gate checks).

## Architecture Patterns

### System Architecture Diagram

```
 Pointer event (tap/hold/drag/pinch)
        │
        ▼
 mw-maze-viewport pointerdown/move/up  (mazeworld.html, ~L6184-6238, rewritten this phase)
        │
        ├─ classify gesture (src/browser/tapStep.js, NEW pure fn, extends controls.js)
        │     tap(≤10px,≤450ms) │ hold(≥450ms,no travel) │ drag │ pinch
        │
        ▼
 tap ──► pending-decision lock check (window.__mzRail?.pending)
        │        │
        │        ├─ locked  ──► re-show/pulse the pending rail card (NO dispatch)
        │        └─ unlocked ─► resolve dominant-axis direction toward tapped cell
        │                             │
        │                             ├─ target cell is exit/gate? ──► MAJOR OVERLAY
        │                             │        (renderMajorOverlay, "THE STAIR DOWN")
        │                             │        GO DOWN → window.move(dir)
        │                             │        NOT YET → no dispatch, overlay closes
        │                             │
        │                             └─ else ──► window.move(dir)  (existing engineMove)
        │                                            │
        │                                            ▼
        │                                   dispatchWithToasts({type:"move",dir})
        │                                            │
        │                     ┌──────────────────────┼───────────────────────┐
        │                     ▼                       ▼                       ▼
        │            wasCombat||inCombat      !combat, CARD_EVENTS      !combat, other events
        │            → window.__mzFightLog    → (RETIRED this phase:    → toastsForAction(...)
        │              (Phase 34, untouched)     floorChanged/leveled     → src/browser/rail.js
        │                                        become rail cards,        foldToRailCard(...)
        │                                        not S.beats)              → window.__mzRail
        │                                                                       │
        │                                                                       ▼
        │                                                              renderRail(host)  (NEW)
        │                                                              — icon/title/line/roll/tone
        │                                                              — decision cards set .pending
        │                                                              — obstacle (climb fail) sets .pending
        │
 hold ──► inspect (pure lookup: unwalked/rock/mark-legend/walked-empty) ──► one-shot rail card, no dispatch
 drag ──► pan (existing `pan` var, positionCanvas())
 pinch ─► zoom (existing `zoom`/`clampZoom`/`fit`), recenter once on release (Phase 33, untouched)

 MARKS chip ──► .mw-legend-sheet reused (existing chrome) — WHAT THE MARKS MEAN
 CENTRE chip ─► window.mzCenterMap?.() (existing, untouched)
 MAKE CAMP chip ─► NEW bottom sheet (same chrome) → SLEEP/WALK ON → window.mzMakeCamp() (existing bridge)
                    no-food refusal → bad rail card (was a toast before this phase)

 Encounter (S.combat.pending) ──► renderMajorOverlay (Phase 34-03, UNCHANGED) ──► FIGHT IT OUT → window.mzFight?.() → combat screen (Phase 34)
 Out-of-combat death (S.dead, !S.combat) ──► renderCombatOver(body,"dead",...) (Phase 34-05, ALREADY generic — reused, not rebuilt)
```

### Recommended Project Structure

```
src/browser/
├── rail.js          # NEW — pure: event→{icon,title,line,roll,tone,hold} folder, tone table by event family
├── tapStep.js        # NEW — pure: dominant-axis-then-fallback direction resolution from a tapped cell;
│                     #        (Claude's discretion per CONTEXT: could instead extend controls.js — see Pitfall 2)
├── controls.js       # EXISTING — screenToCell/resolveTapDirection/classifyPointerGesture already here,
│                     #             currently DORMANT (imported, bridged, unused) — re-enable, don't duplicate
├── toasts.js         # EXISTING — toastsForAction/TOAST_FOR/PRIORITY/CARD_EVENTS/NARRATIVE_ACTIONS reused as-is
├── combatPanel.js    # EXISTING (Phase 34) — encounterOverlaySpec(S) reused for the FIGHT gate
├── icons.js          # EXISTING — FEATURE_ICONS/featureKeyForCell; palette-glyph decision affects this (Pitfall 6)
└── inputGuards.js    # EXISTING — ARM_DELAY_MS/DISMISS_SETTLE_MS/isArmed/isSettled reused unchanged

mazeworld.html         # renderEncounter() gains: pre-dispatch exit-tile interception, MAJOR OVERLAY calls for
                        # descend, renderRail()/paintRail(), retired D-pad+.mazefoot markup, HUD strip markup
                        # (FLOOR/DAY/SQUARES/RATIONS/WP) restructured, condition-chip strip moved into HUD,
                        # MAKE CAMP sheet markup (new, reuses .mw-legend-sheet chrome), viewport pointer handlers
                        # rewritten (tap dispatches move again, pinch/drag/hold untouched in spirit)
```

### Pattern 1: Pure fold-then-bridge (rail.js mirrors toasts.js/fightLog.js)

**What:** `rail.js` exports pure functions (`railCardFor(action, events, ctx)`, `railToneFor(eventType)`, `railHoldFor(tone)`) that take engine events and return view-model objects; `mazeworld.html` bridges them onto `window.__mzRailVM` and a small render function (`renderRail(host)`) reads that VM and mutates DOM, exactly like `fightLog.js` → `window.__mzFightLogVM` → `renderFightLog(host)` (Phase 34-02).
**When to use:** Every out-of-combat dispatch that isn't `wasCombat||inCombat` (the `else` branch of `dispatchWithToasts`'s existing `if` — see Pitfall 1).
**Example (existing sibling pattern to copy):**
```javascript
// Source: mazeworld.html ~L6868-6891 (dispatchWithToasts, Phase 34-02)
function dispatchWithToasts(action) {
  const before = window.__mzState.get();
  const result = dispatch(action);
  const wasCombat = !!(before && before.combat);
  const inCombat = !!(result.state && result.state.combat);
  if (wasCombat || inCombat) {
    lines = fightLogLinesFor(action.type, result.events, ctx);           // Phase 34's fight-log fold
  } else {
    queue = toastsForAction(action.type, result.events, ctx, { limit: Infinity }); // Phase 35: feed rail.js instead
  }
  // ...
}
```
Phase 35's job: replace the `else` branch's `for (const t of queue.slice(0, MAX_TOASTS)) window.mzToast?.(...)` with a call into `rail.js`'s folder + `renderRail(host)`, and delete `window.mzToast`/`#mw-toast-host` entirely (Pitfall 1).

### Pattern 2: Pre-dispatch interception for a tap that would step onto a gated tile

**What:** Before calling `window.move(dir)` from a tap, read `S.floor.g[targetY][targetX].feat` (the shell already has `S` via `window.__mzState.get()`). If `"exit"`/`"gate"`, show `renderMajorOverlay` with a `{icon, title:"THE STAIR DOWN", line, roll:null, primary:{label:"GO DOWN", onTap:()=>window.move(dir)}, secondary:{label:"NOT YET", onTap:closeOverlay}}` spec **without dispatching anything first**. Only GO DOWN triggers the real `move()` (which will auto-resolve the whole descent in one dispatch, exactly as it does today).
**When to use:** Every tap-to-step resolution, keyboard-arrow press, and CLIMB-IT retry that targets a cell whose `feat` is `"exit"`/`"gate"`.
**Why this differs from the Fight! gate:** the Fight! gate pauses *mid-dispatch* (the player has already landed on the encounter tile; `combat.pending` is a real engine field). Descending has no such mid-flight pause available without an engine change — the interception MUST happen before any dispatch. Document this explicitly for the plan so a task doesn't attempt to mirror `combat.pending`'s shape for descend.

### Pattern 3: Sheet reuse (MARKS/MAKE CAMP)

**What:** The existing `.mw-legend-sheet`/`.mw-legend-scrim`/`.mw-legend-panel` CSS (mazeworld.html ~L1136-1163) and markup pattern (`#mw-legend-sheet`, `#mw-settings-sheet` are both instances of it already) is the "bottom sheet, scrim rgba(8,7,5,.8), rise animation" chrome CONTEXT.md's Sheets section describes. MAKE CAMP needs a **third** instance of this exact chrome (new `#mw-camp-sheet` id, same CSS class), not a new pattern.
**Example (existing instance to copy):**
```html
<!-- Source: mazeworld.html ~L1293-1301 -->
<div id="mw-legend-sheet" class="mw-legend-sheet" hidden>
  <div class="mw-legend-scrim" id="mw-legend-scrim"></div>
  <div class="mw-legend-panel" role="dialog" aria-label="What the marks mean">
    <div class="mw-legend-head">...<button id="mw-legend-close">Close</button></div>
    <div class="mw-legend-rows" id="mw-legend-rows"></div>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **Re-deriving the tap/cell/pan transform:** `controls.js`'s own doc comment (lines 8-12) already warns against this — `screenToCell` is the SINGLE shared source for the cs/pan/DPR affine transform; the new tap-to-step code must call it, not reimplement cell math inline in `mazeworld.html` (Phase 4's Anti-Pattern warning, still valid).
- **Persisting `window.__mzRail`'s pending-decision flag on `state`:** `serializeRun` spreads `S` wholesale (Phase 34 precedent comment, mazeworld.html ~L6865-6867) — any new field added to `S`/`state` round-trips through save/load and needs a parity-comparable carve-out. The pending-lock flag is purely a "what's currently on screen" fact and belongs on `window.__mz*`, exactly like `__mzFightEnd`/`__mzCombatMenu`.
- **Treating "CLIMB IT" as a new engine action:** there is no `climb` action type in `engine/actions.js` and none should be added (out of scope, shell-only phase) — see Pitfall 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tap vs. drag vs. pinch classification | A new gesture state machine | `src/browser/controls.js#classifyPointerGesture` (already exists, dormant) + the existing pinch pipeline in the viewport pointer handlers (mazeworld.html ~L6184-6238) | Duplicating this math is exactly the Anti-Pattern `controls.js`'s own header warns against |
| Cell hit-testing from a screen tap | New forward/inverse transform math | `screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad)` (already exists, exported, unit-tested) | Same shared-transform rule |
| Arm-delay / dismiss-settle timing | New `Date.now()` guards | `src/browser/inputGuards.js`'s `isArmed`/`isSettled`/`ARM_DELAY_MS`/`DISMISS_SETTLE_MS`, already bridged via `window.__mzInputGuards` | Phase 32's one guard implementation; a second one would drift |
| Event→toast/rail text folding | New dedup/priority logic | `toastsForAction`/`TOAST_FOR`/`PRIORITY`/the chain groupers in `toasts.js` | Phase 34 already extended this pipeline (`opts.withIdx`) for exactly this kind of reuse; a second fold pipeline would double-narrate events |
| MAJOR OVERLAY markup/guard wiring | A new full-screen overlay component | `renderMajorOverlay(host, spec)` (Phase 34-03, already generic/content-agnostic) | Explicitly built generic *for* this phase — see `34-03-SUMMARY.md`'s `affects` list |
| Death/loot/flee/win over-panel | A fourth ending surface | `renderCombatOver(host, kind, opts)` (Phase 34-05) — already the single ending renderer; out-of-combat death is `S.dead && !S.combat`, which the CURRENT code already routes through `renderCombatOver(body, "dead", ...)` (mazeworld.html ~L5674-5688) | Out-of-combat death is **already built** — nothing new needed here beyond re-skinning the trigger path if any |

**Key insight:** Phase 34 deliberately over-built two reusable primitives (`renderMajorOverlay`, `renderCombatOver`) specifically so Phase 35 would not need to build its own overlay/ending chrome. The bulk of *new* work is the RAIL and the tap-to-step interaction layer — everything else is wiring existing pieces into new trigger points.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase (no string renames, no data migrations). Skipped per the agent instructions' trigger condition.

## Common Pitfalls

### Pitfall 1: The toast host retirement touches MORE call sites than the CONTEXT summary implies

**What goes wrong:** CONTEXT says "`#mw-toast-host`, `mzToast`, `toastLifetime`, `MAX_TOASTS` and the toast CSS are retired." Grepping HEAD shows exactly what must go:
- `window.mzToast = function (text, tone) {...}` — mazeworld.html L2807-2827 (the toast DOM builder)
- `<div class="mw-toast-host" id="mw-toast-host" ...>` — mazeworld.html L1419
- `.mw-toast-host`/`.mw-toast`/`.mw-toast.out`/`.mw-toast[data-tone=...]` CSS — mazeworld.html L776-806
- The ONE surviving call site: `for (const t of queue.slice(0, MAX_TOASTS)) window.mzToast?.(t.text, t.tone);` inside `dispatchWithToasts` — mazeworld.html L6883 (this whole `else` branch of the `wasCombat||inCombat` split is what Phase 35 must replace with the rail folder)
- `window.__mzToastLifetime = toastLifetime;` bridge — mazeworld.html L6427 (only needed by `mzToast`'s `life` calc; retire together)
- `MAX_TOASTS` import (`src/browser/toasts.js` export, line 50) — the constant itself can stay (still exported/tested by `toastsForAction.test.js`/`toastsCoverage.test.js`), but its ONE consumer in `mazeworld.html` goes away; the rail should NOT cap at 4 (CONTEXT: "uncapped", matching `{limit:Infinity}` already used for fight-log)

**Why it happens:** `toasts.js`'s `TOAST_FOR`/`PRIORITY`/`toastsForAction`/`narrativeToastText` are the folding *engine* for BOTH toasts and rail — only the render target changes. Don't confuse "retire the toast host" with "retire toasts.js" — the module stays, extended if needed, per CONTEXT's own note.
**How to avoid:** Grep `mzToast\b` and `mw-toast` across the whole file at the START of implementation and track every hit to a disposition (deleted / replaced by rail render).
**Warning signs:** A `shell-toast-wiring.test.js` failure after this phase that still expects `window.mzToast?.(` to exist anywhere but a comment.

### Pitfall 2: Tap-to-step math already exists but is disabled — re-enabling ≠ building new

**What goes wrong:** A plan that treats tap-to-step as greenfield work will re-derive `screenToCell`/direction math that's already sitting in `src/browser/controls.js`, imported into `mazeworld.html` (`import { screenToCell, resolveTapDirection, classifyPointerGesture } from "./src/browser/controls.js";` — L6390) and bridged onto `window.__mzControls` (L6635) — but never called from a dispatch since an earlier device-review revision explicitly disabled it ("tap-to-move is DISABLED outright... the D-pad is the sole movement control now", comment at L6172-6183).
**Why it happens:** `resolveTapDirection(pos, tappedCell, isSeen)` only resolves a direction when `tappedCell` is **orthogonally adjacent** to `pos` (`|dx|+|dy|===1`) — it returns `null` for any more distant tap. CONTEXT's spec ("tap = one square toward the tap — dominant axis first, the other axis as fallback") needs a **new** function (a tapped cell anywhere on the grid → one adjacent step toward it, with a fallback axis on a blocked first choice) — `resolveTapDirection` alone doesn't cover this; it's the *building block* (exact-adjacency case), not the whole solution.
**How to avoid:** Write the new "step toward a distant tap" function as ~3-5 lines of dominant-axis-then-fallback logic in a NEW pure module (or an addition to `controls.js`, per CONTEXT's own "Claude's Discretion" note) that computes `dx = clamp(tapped.x - pos.x, -1, 1)`, `dy = clamp(tapped.y - pos.y, -1, 1)`, prefers whichever axis has the larger `|delta|`, and falls back to the other axis if the first choice cell is a wall (checked against `S.floor.g`) — this is presentation logic (which direction to attempt), NOT the actual movement legality check (the engine's `move()` already no-ops on a wall).
**Warning signs:** A new pure module that duplicates `screenToCell`'s tx/ty formula instead of importing it.

### Pitfall 3: Climb/crevice cannot show a pre-roll dice preview — the roll already happened

**What goes wrong:** CONTEXT's rail sample ("odd ⧗ A CREVICE ... 'climb d20+4 · 9 to clear' [CLIMB IT] → CLIMBED / FELL") reads as: show the dice formula, THEN let the player tap CLIMB IT, THEN show the result. But `engine/movement.js#move` (lines 138-211) rolls the climb/leap check **synchronously, inline**, the instant the party's intended step lands on a `"climb"`/`"gorge"` cell — there is no separate roll-preview phase; the `fellClimbing`/`climbedOver`/`fellInGorge`/`leaptOver` event is already the ROLLED OUTCOME by the time any code outside `move()` sees it.
**Why it happens:** This mirrors Phase 34's `retarget` finding exactly — CONTEXT.md was written against the mock's toy engine (which does show a pre-roll formula, then animate a roll on tap), not against this engine's actual synchronous-resolve design.
**How to avoid:** The correct shell-only design: a tap/keyboard-move toward a climb/gorge cell dispatches `move(dir)` immediately (it always was going to — there's no way to peek at the roll without rolling it). On success, the party lands on the tile and a GOOD rail card shows the already-rolled outcome ("CLEARED IT" + the fall-table roll info if derivable from the event, e.g. `climbedOver`/`leaptOver` carry no roll fields currently — see `engine/movement.js` L208, `events.push({type: climbing?"climbedOver":"leaptOver"})`, NO roll/need fields pushed). On failure, the party does NOT move (px/py untouched — confirmed at L199-206, the `return events` happens before `f.px=nx;f.py=ny`), and a BAD rail card shows the failure (`fellClimbing`/`fellInGorge` DO carry `hurt`, but **not** the actual roll/need values either — `events.push({type: climbing?"fellClimbing":"fellInGorge", hurt})`, L204) with a CLIMB IT button whose tap is simply "attempt `move(dir)` again toward the same cell."
**Warning signs:** A plan task that tries to add a roll-preview/dice-formula display before the tap — this requires reading `content/*` tables client-side to fabricate a "9 to clear" style preview number, which risks silently drifting from the real roll math (`CLIMB_TABLE`/`LEAP_TABLE`, not read by the shell today). **Recommendation: the rail's roll line for a climb/crevice event should show the OUTCOME's numbers only (hurt on failure; nothing numeric on success), not a pre-roll "N to clear" formula** — flag this to the planner/discuss-phase as a scope note, since CONTEXT's sample copy implies a number the engine doesn't expose.

### Pitfall 4: Descending has no engine-level pause — the shell must intercept BEFORE dispatch, not after

**What goes wrong:** Building "THE STAIR DOWN" the same way Phase 34 built the Fight! gate (reading a `state.something.pending` flag AFTER a dispatch) is impossible: `engine/movement.js#move`'s `"exit"`/`"gate"` branch (lines 366-374) calls `descend()` **unconditionally**, which mutates `state.floor` to the NEXT floor synchronously, in the same `move()` call that also updates `f.px`/`f.py` onto the exit tile. By the time `dispatchWithToasts` returns, the descent has ALREADY happened — there is no intermediate state to gate on.
**Why it happens:** `descend()` (movement.js L691-701) has no split between "the player has committed to going down" and "the descent resolved" — unlike `fight()` which Phase 31 deliberately split at the roster (`pending:true`) BEFORE rolling initiative.
**How to avoid:** Intercept at the TAP/KEY level, before any dispatch: when the resolved step direction targets a cell whose `feat` is `"exit"`/`"gate"` (read directly from `S.floor.g[targetY][targetX].feat` — this is presentation-safe, read-only), show the MAJOR OVERLAY FIRST. Only call `window.move(dir)` if GO DOWN is tapped. NOT YET simply closes the overlay with zero dispatch (the party never moved, matching "you haven't committed yet"). This needs no engine change and correctly prevents descending "before the tap" (mirroring the encounter rule Phase 31 established, CSCR-06's "nothing resolves before the tap"), but via a fundamentally different mechanism than the combat gate.
**Warning signs:** A plan task phrased as "read `state.floor.pendingDescend`" or similar — that field does not exist and adding it is an engine change, out of scope for this phase.

### Pitfall 5: "PICK THE LOCK" is not a real action — CONTEXT.md inaccuracy to flag (mirrors Phase 34's `retarget` finding)

**What goes wrong:** CONTEXT.md's Decisions section says the RAIL's decision cards include "find / locked box (pick the lock / leave it — using the existing find/pick actions)" and its Specific Ideas rail-sample text shows `[PICK THE LOCK / LEAVE IT] → TAKEN / THE LOCK HOLDS`. Grepping `engine/actions.js` and `engine/encounters.js` confirms: **there is no `"pick"` action type, and no engine action named anything like it.** `engine/encounters.js#openChest` (lines 109-141) rolls the lock check (`chestLockRolled`/`chestOpened`/`chestLocked`) **automatically**, the instant the party steps onto the chest tile — exactly like the climb roll (Pitfall 3) — with `cell.feat = null` already cleared by `move()` (movement.js L360-362) regardless of outcome, so there is no retry state to "pick" a second time.
**Why it happens:** Same root cause as Pitfall 3/4 — CONTEXT was written from the mock's toy mechanics (which DOES have a tap-to-pick interaction) transplanted onto a description of "the existing find/pick actions," but the only *real* existing action here is `takeFind`/`leaveFind` (`window.mzTakeFind`/`window.mzLeaveFind`, mazeworld.html L7319+) for the TREASURE inside an opened chest — a decision that already exists today and needs no new engine wiring, just a rail card instead of the current `S.pendingFind` overlay card.
**How to avoid:** Build "A LOCKED BOX" as an auto-resolving rail card (good/bad tone based on `chestOpened`/`chestLocked`, no action buttons — matches Pitfall 3's climb pattern) immediately followed, if opened, by the pre-existing `S.pendingFind` TAKE IT/LEAVE IT decision (which the rail already needs to represent as a decision card per MAP-04, using `mzTakeFind`/`mzLeaveFind`, NOT a new "pick" bridge).
**Warning signs:** A plan task that tries to add a `"pick"` action to `engine/actions.js`'s whitelist — out of scope.

### Pitfall 6: The mock's colored-glyph marks REVERSE an earlier locked decision (PNG icons)

**What goes wrong:** `src/browser/icons.js` (Phase 4, `preloadIcons`/`featureKeyForCell`/`drawFeatureIcon`) currently renders every map feature (encounter/teleport/onewaydoor/trap/chest/crevice/descent/wall/party) as a **PNG image** (`icons/optimized/*.png`), explicitly because an earlier device-review decision REJECTED "the design mockup's Unicode glyphs" in favor of user-provided icon art (icons.js's own header comment: "Replaces mazeworld.html draw()'s procedural vector glyphs AND the design mockup's Unicode glyphs (CONTEXT.md decision)"). Phase 35's CONTEXT.md now explicitly specifies **colored text glyphs** (`● #e05a48 encounter, ◆ #a78ce8 teleport, ▲ #8ec06a one-way door, ✕ #e05a48 trap, ▪ #d3c49f box, ⧗ crevice, ▼ descent`) at ~60% of the cell — this is the OPPOSITE of the Phase 4 decision, and CONTEXT explicitly calls it a locked ruling this time ("marks (colored: dot ● ... )" is inside the palette bullet, not flagged as discretionary).
**Why it happens:** The user is now the direct author of this CONTEXT (not an inferred device-review revision) and has explicitly chosen the mock's glyph look for this rebuild.
**How to avoid:** Treat this as a genuine, deliberate reversal — the planner should have a task that either (a) replaces `draw()`'s icon-drawing calls with `ctx.fillText` glyph draws using the CONTEXT color table (simplest, matches spec exactly, and makes `icons.js`'s PNG pipeline dead code for MAP marks — confirm with the user/discuss-phase whether `icons/*.png` assets should be fully retired or just unused for now), or (b) keeps PNG icons and treats "colored mark glyphs" as directional flavor text only. **Recommendation: (a), literally matching CONTEXT's explicit color/glyph table**, since CONTEXT calls this out as a locked decision, not a discretion item — but flag to the planner that this is materially MORE work than "the palette swap is a data change" (CONTEXT's own framing) implies: it's a rendering-METHOD change (image draw → text draw), not a config value change, and it un-does real Phase-4 engineering (icon preload/rotation for one-way doors, `ONEWAYDOOR_ROTATION_DEG` — a glyph can't rotate the same way without `ctx.rotate`, though canvas text CAN be rotated via the same `ctx.save/translate/rotate/restore` pattern `drawFeatureIcon` already uses).
**Warning signs:** A plan that describes this as "just change some hex values" — it is not; `draw()`'s feature-icon loop (mazeworld.html L2679-2707) and `icons.js`'s whole `drawFeatureIcon` contract would need a parallel glyph-draw path or a full replacement.

### Pitfall 7: `hasActiveEncounter()` currently includes S.beats — retiring the Move-on card changes this gate's shape

**What goes wrong:** `hasActiveEncounter()` (mazeworld.html L4970-4987) returns true when `S.beats && S.beats.groups && S.beats.groups.length` — i.e., ANY active beat (today, only `floorChanged`/`leveled`, per `CARD_EVENTS`) currently blocks movement and shows the overlay. CONTEXT.md says "level-up and floor arrival need no tap" (i.e., they become auto-clearing rail cards, not blocking overlays). If `S.beats` is retired for these two event types but `hasActiveEncounter()` isn't updated, nothing breaks functionally (the beats branch just never fires since nothing sets `S.beats` anymore for CARD_EVENTS) — BUT the pre-death special case (`diedOnMove`, mazeworld.html L6929-6935, `state.beats = {...preDeath:true...}`) ALSO uses `S.beats` to show "The maze has the last word" narration before the death overlay. This path must be preserved or redesigned (e.g., folded into the death MAJOR OVERLAY's own line text) — don't accidentally break the pre-death narration while retiring the Move-on card mechanism.
**Why it happens:** `S.beats`/`CARD_EVENTS`/`beatsTitleFor`/`FEATURE_EVENT_TITLE` are ALL used for exactly two purposes today: (1) the Move-on card for floorChanged/leveled (retiring per MAP-04), and (2) the pre-death narration beat (must survive, per CONTEXT's death-overlay requirement — "cause + epitaph" needs the "what killed you" narration somewhere).
**How to avoid:** Keep `S.beats`'s pre-death special case working (either unchanged, using the same beats mechanism just for this one case, or route the pre-death narration text directly into the death MAJOR OVERLAY's `line` field) — do not delete `S.beats`/`newBeat`/`beginEvent`/`act()` wholesale; audit every remaining call site (`newBeat`, `act()`, wandering-monster-during-camp) before removing anything.
**Warning signs:** A test asserting the death card shows "The maze has the last word" starts failing after S.beats retirement work.

### Pitfall 8: `zoom` default is currently 0.8 (Phase 33 + a later device-feedback pass), not the 1.5 Phase 33's OWN summary claims

**What goes wrong:** `33-03-SUMMARY.md` states the default zoom is `1.5` (the ZOOM_MIN/ZOOM_MAX 0.6/2.4 midpoint) — but the CURRENT `mazeworld.html` (L2544-2551) has `let zoom = 0.8;` with a comment explicitly documenting a SUBSEQUENT device-feedback change ("Phase 33 (UIF-03) + device feedback 2026-09-16: the default sits ZOOMED OUT... 0.8 is the midpoint between fully-out (ZOOM_MIN 0.6) and that old default"). This is a **live drift between the phase SUMMARY and the current code** — the SUMMARY describes what Plan 03 shipped; a later, undocumented device-feedback tweak changed it again.
**Why it happens:** Device-review/device-feedback passes sometimes land without their own phase plan+summary (the codebase's own comment admits this is a post-33-03 tweak).
**How to avoid:** Don't trust `33-03-SUMMARY.md`'s "1.5" claim — verify zoom defaults, pinch clamps, and any other "documented in an old SUMMARY" numeric claim directly against the CURRENT file before writing a plan task around it. `ZOOM_MIN`/`ZOOM_MAX` (0.6/2.4) ARE still accurate (confirmed at L2552).
**Warning signs:** A plan step that says "confirm zoom is still 1.5" — it currently is not; confirm 0.8, or ask the user whether this phase should also touch it (CONTEXT.md doesn't mention a zoom-default change, so leave it at its current live value unless told otherwise).

### Pitfall 9: The persistent `aria-live` announcer pattern must be preserved for the rail exactly as fight-log preserved it

**What goes wrong:** `#enc-round-live` (mazeworld.html L1497) is a PERSISTENT sr-only node inside `#enc-panel`, never rebuilt by `body.innerHTML = ""` (only its `textContent` is rewritten by `syncFightLogLive`). If the RAIL is rendered as a sibling DOM node that gets torn down/rebuilt on every `renderEncounter()`/`paint()` call (the way most of `#enc-body`'s content already is), a live region recreated inside an innerHTML rebuild is NOT reliably announced by assistive tech (Phase 32's own documented reason for making `#enc-round-live` persistent, mazeworld.html L1489-1496).
**How to avoid:** The rail's own announcer (or a shared reuse of `#enc-round-live`, if the rail is considered part of the same live region) must follow the identical persist-node-rewrite-textContent-only pattern Phase 34's `syncFightLogLive` established, with its own seq-gate (Phase 34's `fightLogAnnouncement`/`lastLogSeqShown` precedent) so a re-render of the SAME rail card doesn't re-announce.
**Warning signs:** TalkBack re-announcing the idle rail hint on every unrelated re-render (e.g., a submenu toggle elsewhere).

## Code Examples

### Existing MAJOR OVERLAY signature (reuse verbatim for descend)

```javascript
// Source: mazeworld.html ~L5954-5958 (34-03), the ONLY call site today
if (C.pending) {
  const spec = window.__mzCombatVM.overlay(S);
  renderMajorOverlay(body, { ...spec, primary: { label: spec.primary.label, onTap: () => window.mzFight?.() }, secondary: null });
  return;
}
```
`renderMajorOverlay(host, spec)` signature (from `34-03-SUMMARY.md`'s `key-files`/`provides`): `spec = {icon, iconTone, title, line, roll?, primary:{label,onTap}, secondary?:{label,onTap}}`. Phase 35 builds its OWN spec objects for the descend/death cases and passes them to this SAME function — no changes needed to `renderMajorOverlay` itself.

### Existing dispatchWithToasts routing split (the exact seam Phase 35 extends)

```javascript
// Source: mazeworld.html L6868-6891 (Phase 34-02)
function dispatchWithToasts(action) {
  const before = window.__mzState.get();
  const roundBefore = before && before.combat ? before.combat.round : null;
  const result = dispatch(action);
  const ctx = NARRATIVE_ACTIONS.has(action.type) ? { narrate: narrateEvent } : {};
  const wasCombat = !!(before && before.combat);
  const inCombat = !!(result.state && result.state.combat);
  window.__mzCombatMenu = null;
  let lines = [];
  let queue = [];
  if (wasCombat || inCombat) {
    lines = fightLogLinesFor(action.type, result.events, ctx);
  } else {
    queue = toastsForAction(action.type, result.events, ctx, { limit: Infinity }); // <- Phase 35: rail.js consumes this instead of toasting it
  }
  for (const t of queue.slice(0, MAX_TOASTS)) window.mzToast?.(t.text, t.tone);   // <- Phase 35: DELETE, replace with rail render
  if (inCombat) {
    if (lines.length) window.__mzFightLog = appendFightLog(window.__mzFightLog, lines, roundBefore ?? result.state.combat.round);
  } else {
    window.__mzFightLog = null;
    if (wasCombat) window.__mzFightEnd = { lines: lines.map((l) => l.text) };
  }
  return result;
}
```

### Existing tap/gesture math to import, not rebuild

```javascript
// Source: src/browser/controls.js (already exported, already imported into mazeworld.html L6390)
export const TAP_MOVE_THRESHOLD_PX = 10;   // note: CONTEXT says "≤ 10 px travel" for tap — matches exactly
export const TAP_MAX_DURATION_MS = 350;    // note: CONTEXT says "< 450 ms" for tap, "≥ 450 ms" for hold —
                                            // this constant needs bumping to 450 (or a new HOLD_MIN_DURATION_MS
                                            // constant added) since 350 is the CURRENT tap/drag split, not
                                            // the NEW tap/hold split CONTEXT specifies
export function screenToCell(clientX, clientY, viewportRect, pos, pan, cs, canvasPad) { /* ... */ }
export function resolveTapDirection(pos, tappedCell, isSeen) { /* exact-adjacency only — see Pitfall 2 */ }
export function classifyPointerGesture(downEvt, upEvt, totalDeltaPx) { /* tap vs "drag" binary — CONTEXT needs a THIRD class, "hold" */ }
```
**Important:** `classifyPointerGesture` currently returns only `"tap"|"drag"` — CONTEXT's interaction model needs THREE classes (tap / hold / drag-or-pinch). A plan task must either extend this function's return values or add a parallel hold-detection check (a `setTimeout`-based hold-arm, since `classifyPointerGesture` is evaluated at `pointerup` and a hold-with-no-release-yet needs a live timer, not a post-hoc classification). This is a real design decision for the plan, not just a constant rename.

### Existing chest/find decision bridges (reuse for "A LOCKED BOX" → rail decision card)

```javascript
// Source: mazeworld.html ~L7319 (existing, untouched)
window.mzTakeFind = () => inventoryAction({ type: "takeFind" });
window.mzLeaveFind = () => inventoryAction({ type: "leaveFind" }); // (name inferred from symmetric pattern; verify exact line when planning)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| D-pad, always-visible, sole movement control | Tap-to-step (per CONTEXT.md 2026-09-16 ruling) | This phase | `controls.js`'s dormant tap math finally gets used; `.dpad`/`.mazefoot` markup and the `dpad` click listener (mazeworld.html L6076-6084) are retired |
| Toast host (`#mw-toast-host`, capped at `MAX_TOASTS=4`, transient) | RAIL (uncapped, persistent card, decision-carrying) | This phase | `window.mzToast`/`.mw-toast*` CSS retired; `toastsForAction`'s fold pipeline is now feeding TWO surfaces long-term (fight-log in combat, rail out of combat) — matches Phase 34's fight-log precedent exactly |
| `S.beats`-driven "Move on" card for floorChanged/leveled | Auto-clearing rail card, no tap needed | This phase | `CARD_EVENTS`'s two members effectively become rail-only; the `S.beats` mechanism itself must survive for the pre-death narration case (Pitfall 7) |
| PNG icon marks (`icons/*.png`, Phase 4 decision) | Colored text/Unicode glyphs (mock-matching, CONTEXT 2026-09-16 ruling) | This phase (reverses Phase 4) | Real rendering-method change, not a config tweak — see Pitfall 6 |
| Zoom default 0.8 (post-33-03 device-feedback tweak, undocumented in any SUMMARY) | Unchanged by this phase (CONTEXT.md doesn't mention it) | n/a — just verify against live code, not the stale SUMMARY | See Pitfall 8 |

**Deprecated/outdated:**
- `.dpad`/`#dpad`/`.mazefoot`'s D-pad buttons: fully retired this phase (CONTEXT ruling 2).
- `window.mzToast`/`#mw-toast-host`/`.mw-toast*` CSS: fully retired this phase (CONTEXT ruling 1).
- The Move-on card's floorChanged/leveled path inside `engineMove`/`mzMakeCamp` (the `CARD_EVENTS`-gated `state.beats = {...}` assignment): retired for these two event types (auto-clear rail instead), but the underlying `S.beats`/`act()`/`newBeat()` machinery itself is NOT fully removable — see Pitfall 7.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The climb/crevice rail card's roll line should show only the OUTCOME (hurt on failure), not a pre-roll "N to clear" formula, since the engine doesn't expose the roll/need values in `fellClimbing`/`fellInGorge`/`climbedOver`/`leaptOver` events | Pitfall 3 | If the user actually wants the exact mock-style preview text, this requires either an engine event-payload change (adding roll/need fields to these four event types — a small, additive, parity-safe change since new event fields don't affect determinism) or fabricating a plausible-but-fake number client-side (worse — could mislead the player). Flag to discuss-phase/planner: this is the single point where an engine touch (adding `need`/`roll` fields to existing events) might be justified and worth a scope exception, OR the copy should be adjusted to not promise numbers the engine doesn't currently expose. |
| A2 | "A LOCKED BOX" chest rolls auto-resolve exactly like climb (no PICK THE LOCK action exists) | Pitfall 5 | If the user actually wants a genuine two-step "see the roll formula, then tap to attempt," same engine-touch tension as A1 |
| A3 | Colored-glyph marks (Pitfall 6) should fully replace PNG icon rendering for map marks, not run alongside it | Pitfall 6 | If the user intends to KEEP PNG icons and only wanted "vaguely mock-matching" flavor, this recommendation over-scopes the phase; the CONTEXT color/glyph table reads as literal spec, so full replacement is the more faithful reading, but this is the biggest single rendering-effort item in the phase and worth a discuss-phase confirmation if not already locked |
| A4 | The pending-decision lock (`window.__mzRail.pending`) should block ALL taps (any direction), not just re-attempts of the specific blocked direction, once an obstacle/decision is active — per ruling 3's "never move past an active choice" | Pattern 2, Pitfall 4 | If the intended behavior is narrower (only THAT specific direction is locked, other directions remain tappable), the lock's scope needs correcting; CONTEXT's wording ("tap-to-step is DISABLED... a tap re-shows the pending card") reads as global-lock, which this research treats as authoritative |
| A5 | `TAP_MAX_DURATION_MS` (currently 350) needs to become part of a three-way tap/hold/drag classifier rather than a straight rename to 450, because CONTEXT specifies BOTH a tap-duration ceiling (<450ms) AND a hold-duration floor (≥450ms) as distinct thresholds | Code Examples section | If a single threshold value is reused for both boundaries, a genuine 450ms-exact gesture is ambiguous; low risk either way since this is an implementation-detail the planner will need to resolve with an explicit constant design |

**If this table is empty:** N/A — see rows above; two of five (A1, A2) point at a real "does this need a tiny engine touch" question worth a discuss-phase follow-up before/during planning, since CONTEXT explicitly says "no engine changes" but its own copy implies dice values the engine doesn't currently surface.

## Open Questions

1. **Should `fellClimbing`/`fellInGorge`/`climbedOver`/`leaptOver` events gain `roll`/`need` fields so the rail can show real dice numbers (per CONTEXT's sample copy), or should the rail's copy be adjusted to not claim numbers the engine doesn't expose?**
   - What we know: the engine rolls these checks today but doesn't push the roll/need values onto the event object (only `hurt` on failure).
   - What's unclear: whether CONTEXT's "climb d20+4 · 9 to clear" sample text is a locked requirement (implying a small, additive, parity-safe engine payload change is in scope despite "engine untouched" framing) or just illustrative mock-mirroring flavor that can be simplified.
   - Recommendation: treat "engine/content/parity untouched" as the harder constraint (explicit success criterion #5, explicit gate check) and build the rail's climb/crevice card with whatever the events already carry (outcome + hurt only); surface this gap to the user during `/gsd-discuss-phase` if not already resolved, since it's a real tension between two CONTEXT statements.

2. **Does "the square stays blocked until a success" (ruling 4) mean the WHOLE party is locked from moving in ANY direction, or just that specific tile is impassable while other directions remain free?**
   - What we know: CONTEXT ruling 3 says "tap-to-step is DISABLED while a rail decision... or an obstacle... is pending: a tap re-shows/pulses the pending card and does not step."
   - What's unclear: whether "a tap" there means literally any tap anywhere on the viewport, or only a tap that resolves toward the SAME blocked direction.
   - Recommendation: this research assumes the stronger, global-lock reading (A4) as it's the more literal reading of "never move past an active choice" and the simpler implementation; flag for discuss-phase/planner confirmation since it's the single biggest UX-feel decision in the phase.

3. **Should `icons/*.png` map-mark assets be deleted, or just stop being referenced for map marks (kept for potential reuse elsewhere, e.g. the Marks legend sheet's rows, which currently use `<img src="./icons/optimized/${m.icon}.png">`)?**
   - What we know: `renderMarksLegend()` (mazeworld.html L6136-6144) currently renders PNG icons in the legend rows; CONTEXT's Sheets section describes the legend rows as "glyph (22px, colored...)" — implying the legend ALSO switches to glyphs, not just the canvas.
   - What's unclear: whether keeping the PNG asset files around (unused) is fine or whether they should be removed from `icons/` entirely.
   - Recommendation: keep the files (removing asset files is orthogonal cleanup, not required for MAP-01..10); just stop referencing them in both `draw()` and `renderMarksLegend()`.

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependencies (100% vanilla JS shell work against the existing Node/npm/Android toolchain already verified working in prior phases). Skipped per the agent instructions' skip condition.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (no third-party test runner) |
| Config file | none — `package.json`'s `"test": "node --test"` script runs every `test/**/*.test.js` file |
| Quick run command | `node --test test/unit/<specific-file>.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | HUD strip (FLOOR/DAY/SQUARES/RATIONS/WP) + condition-chip strip source-assertion pins | unit (source-assertion) | `node --test test/unit/shell-map-screen.test.js` (or similar new file name — planner's choice, matching the `shell-combat-*.test.js` naming convention Phase 34 established) | ❌ new file needed |
| MAP-02 | Tap-to-step, hold-inspect, drag-pan, pinch-zoom, pending-lock | unit (pure fn tests for tapStep.js + source-assertion for wiring) | `node --test test/unit/tapStep.test.js` + `node --test test/unit/shell-map-screen.test.js` | ❌ new files needed |
| MAP-03 | Rail folding, tones, hold times, uncapped | unit (pure fn tests) | `node --test test/unit/rail.test.js` | ❌ new file needed |
| MAP-04 | Decision cards (joiner/find/climb), pending lock | unit (source-assertion + rail.js pure tests) | `node --test test/unit/rail.test.js` + `node --test test/unit/shell-map-screen.test.js` | ❌ new files needed |
| MAP-05 | MAJOR OVERLAY for descend/death | unit (source-assertion, reusing `renderMajorOverlay`/`renderCombatOver`) | `node --test test/unit/shell-map-screen.test.js` | ❌ (new assertions in a new or existing file) |
| MAP-06 | MARKS/CENTRE/MAKE CAMP chips + sheets | unit (source-assertion) | `node --test test/unit/shell-map-screen.test.js` | ❌ new file (or extend `shell-map-store-polish.test.js`) |
| MAP-07 | Canvas palette/marks | unit (source-assertion on color literals; visual correctness is human_verification) | `node --test test/unit/shell-map-screen.test.js` | ❌ new file needed |
| MAP-08 | Guards on every new button | unit | `node --test test/unit/shell-input-guards.test.js` (RE-PIN, existing file) | ✅ exists, needs re-pin |
| MAP-09 | Full suite green, build:www, engine/content/parity diff empty | integration/gate | `npm test && npm run build:www && git diff --stat -- engine content test/parity` | ✅ (gate commands, not a file) |
| MAP-10 | On-device Pixel 7 DR round | manual-only | n/a — human_verification, deferred per project's Deferred UAT protocol (MEMORY.md) | n/a |

### Sampling Rate
- **Per task commit:** the specific new/re-pinned test file(s) for that task.
- **Per wave merge:** `npm test` (full suite).
- **Phase gate:** Full suite green (2047 baseline + new tests) before `/gsd-verify-work`; `npm run build:www` exit 0; `git diff --stat -- engine content test/parity` empty; master hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` unchanged (confirmed live at research time).

### Wave 0 Gaps

- [ ] `test/unit/rail.js`-equivalent module + its test file — new pure module, no existing coverage.
- [ ] `test/unit/tapStep.js`-equivalent module + its test file — new pure module, no existing coverage (or an extension of `test/unit/controls.test.js` if `controls.js` itself gains the new function per CONTEXT's "Claude's Discretion").
- [ ] A `shell-map-screen.test.js`-equivalent source-assertion file (naming convention: Phase 34 used `shell-combat-screen.test.js`, `shell-combat-actions.test.js`, `shell-combat-over.test.js` — one per major DOM-wiring concern; the planner should likely split similarly, e.g. `shell-map-hud.test.js` + `shell-map-rail.test.js` + `shell-map-viewport.test.js` or one consolidated file, matching whatever wave-split the plans use).
- [ ] Tests to explicitly RETIRE (D-pad/toast-specific pins that will fail once the markup is gone): `controls.test.js` (if it pins the disabled-tap-to-move comment/state — verify), any D-pad-specific assertions inside other shell test files (grep `dpad\b`/`data-dir` across `test/unit/*.test.js` at plan time), `narrativeToasts.test.js`/`toastTable.test.js`/`toastsCoverage.test.js` (KEEP the pure-module coverage, per CONTEXT's own note — these test `toasts.js`'s folding logic itself, which survives; only the `window.mzToast` RENDER call sites retire) — **do not delete these three files wholesale**, only re-pin any assertion that references `mw-toast-host`/`window.mzToast` DOM wiring specifically.
- [ ] `test/unit/shell-party-camp.test.js` — re-pin for the new MAKE CAMP sheet flow (was a direct-dispatch chip tap; becomes chip → sheet → SLEEP/WALK ON → dispatch).
- [ ] `test/unit/shell-map-store-polish.test.js` — re-pin/verify the recenter-on-return and pinch-zoom source pins still match after the viewport pointer handler rewrite (Pitfall 8's zoom-default caveat applies here too).
- [ ] `test/unit/shell-gear-toolbar.test.js` — verify the `.mw-viewport-chips`/`#btn-camp` assertions (MARKS/CENTRE/MAKE CAMP chip order, Phase 33) still hold or need updating for the new camp-sheet flow.
- Framework install: none needed — `node --test` is already the standing framework.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (config file was not inspected in this research pass — treat as enabled per the agent's default-enabled rule) — however this phase has no auth, no network, no new external input surface (all input is local touch/keyboard against an already-trusted local `state` object), so the applicable ASVS surface is minimal.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Offline, single-device, no accounts (CLAUDE.md constraint) |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single local player, no roles |
| V5 Input Validation | Marginal — yes | Tap coordinates are already clamped/validated by the existing `screenToCell`/wall-check logic (`move()`'s own `!f.g[ny] \|\| !f.g[ny][nx] \|\| f.g[ny][nx].wall` no-op guard); new tap-to-step code must not trust a tapped cell blindly — always resolve to an adjacent, in-bounds direction before dispatch (never pass raw tap coordinates to the engine) |
| V6 Cryptography | No | No crypto surface touched |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malformed/out-of-bounds tap coordinate crashing the direction resolver | Denial of Service (local only) | `screenToCell`/the new tap-step function must clamp/guard against `NaN`/out-of-grid results, matching the existing `move()`'s own bounds check as a second line of defense (defense in depth, not a security boundary in the traditional sense since this is a fully offline, single-player, local app) |

## Sources

### Primary (HIGH confidence — direct code reads, this session)
- `mazeworld.html` (HEAD `8dc47b6`) — full reads of: HUD markup (L1366-1420), map/viewport/D-pad/overlay markup (L1421-1500), toast host + CSS (L776-806, L1417-1419, L2793-2827), CONDITION_COPY/paintConditions/paint() (L2900-3120), draw()/fit()/positionCanvas()/reveal() (L2536-2738), renderEncounter() full body (L5620-5987), hasActiveEncounter/guardTap/encArmed/encounterSettled (L4962-5040), MARKS_LEGEND/openMarksLegend/closeMarksLegend/centerMap (L6120-6168), viewport pointer handlers + keydown (L6160-6295), module-script imports/bridges (L6327-6460), dispatchWithToasts/engineMove (L6868-6959), mzMakeCamp (L7488-7506)
- `src/browser/controls.js` — full read (tap/drag math, currently dormant for movement)
- `src/browser/inputGuards.js` — full read (ARM_DELAY_MS/DISMISS_SETTLE_MS/isArmed/isSettled)
- `src/browser/icons.js` — full read (PNG icon pipeline, FEATURE_ICONS list)
- `src/browser/toasts.js` — partial read (TOAST_FOR entries for movement/camp events, CARD_EVENTS/NARRATIVE_ACTIONS/PRIORITY/MAX_TOASTS exports, toastsForAction implementation)
- `engine/movement.js` — full read of `move()` (climb/gorge/exit/gate branches, lines 116-378), `descend()` (691-701), `nightlyEats()`/`makeCamp()` signature area (380-420)
- `engine/encounters.js` — `openChest()` full read (109-155)
- `content/safety-wordlist.js` — confirmed `BANNED` export exists
- `.planning/phases/34-combat-screen-rebuild/34-0{1..5}-SUMMARY.md` and `34-VERIFICATION.md` — full reads (renderMajorOverlay/renderCombatOver signatures, guard patterns, test counts, hand-off notes explicitly addressed to Phase 35)
- `.planning/milestones/v1.3-phases/33-ui-feel-store-polish/33-0{1..3}-SUMMARY.md` — full reads (storeRoll flag, gear-row/drop-confirm, zoom/recenter — cross-checked against live code, found one drift, Pitfall 8)
- `design/Mazeworld Map.dc.html`, `design/Mazeworld Map Panel.dc.html` — full reads (the visual spec, including the trailing comment block's INTERACTION/CHROME/RAIL/MAJOR OVERLAY/SHEETS/SAMPLE RAIL EVENTS documentation)
- `.planning/phases/35-map-screen-rebuild/35-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — full reads

### Secondary (MEDIUM confidence)
- None — no web search or third-party docs were needed for this phase (pure internal codebase archaeology).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, confirmed via direct package.json read
- Architecture: HIGH — every claim traced to a specific line range in the current tree, re-verified live (not trusted from stale SUMMARY prose, per Pitfall 8's own lesson)
- Pitfalls: HIGH — six of nine pitfalls are grounded in direct engine-source reads of the exact mechanics involved (climb/descend/chest auto-resolution); the remaining three (toast retirement scope, aria-live pattern, icon reversal) are grounded in direct grep/read of the current DOM/CSS

**Research date:** 2026-09-16
**Valid until:** Should be re-verified if `mazeworld.html`/`engine/movement.js`/`engine/encounters.js` change again before planning starts (this is an actively-developed file — Phase 34 alone touched thousands of lines in one day); otherwise valid for the life of this phase's planning+execution window (expected: days, not weeks).
