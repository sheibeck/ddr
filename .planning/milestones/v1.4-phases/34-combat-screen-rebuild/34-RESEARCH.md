# Phase 34: Combat Screen Rebuild - Research

**Researched:** 2026-09-16
**Domain:** Vanilla-JS shell rebuild of the combat presentation layer inside a single `mazeworld.html` (7080 lines) against an already-frozen engine (`engine/*`), against an imported static visual spec (`design/Mazeworld Combat Panel.dc.html`) and a MAJOR OVERLAY spec (`design/Mazeworld Map Panel.dc.html`).
**Confidence:** HIGH — every finding below is read directly from the live source (mazeworld.html, src/browser/*.js, engine/*.js, test/unit/*.js) at the paths and line numbers cited. No web research was used (all provider flags in `.planning/config.json` are `false`; this is a shell-only, code-grounded phase).

## Summary

This phase replaces roughly 485 lines of `renderEncounter()` (`mazeworld.html:5026-5510`) — the Round Card built in Phase 32, the Fight! gate built in Phase 31, and the loot/joiner/find/death branches built in Phases 29/31/32 — with the Claude Design Combat Panel layout, while leaving every engine file, every `window.mz*` dispatch bridge, and every `toastsForAction`/`dispatchWithToasts` plumbing untouched at the API level. The single biggest architectural finding is that **the Fight! gate is moving OUT of the combat-panel-styled markup entirely** (CSCR-06, amended in CONTEXT.md): today `C.pending` renders a "Fight!" button *inside* `#enc-panel`'s combat branch (`mazeworld.html:5408-5415`); the new design instead wants a visually distinct MAJOR OVERLAY (Map Panel spec, full-screen icon/title/line/roll/button column) that Phase 34 must introduce and Phase 35 will re-skin/reuse for the stair-down and out-of-combat-death cases. There is no existing DOM element for this — the planner must decide whether it is a new render branch inside the existing single `#enc-panel`/`#enc-body` host (recommended — matches every other branch in `renderEncounter`) or a wholly separate top-level element.

The second major finding is that **the "tap reveals dice" feature (CSCR-04) has no ready data path today**. `dispatchWithToasts` (`mazeworld.html:6356-6378`) only passes `ctx.narrate = narrateEvent` (the roll-bearing Oracle sentence) for `NARRATIVE_ACTIONS` (`move`/`camp`/`resolveJoiner` — `src/browser/toasts.js:75`); every combat action (`attack`, `fight`, `castSpell`, `flee`, `parley`, `sing`, `useItem`, `drinkPotion`, `readScroll`) dispatches with `ctx = {}`, so `toastsForAction` falls back to `TOAST_FOR`'s short, roll-free table text — and even when `ctx.narrate` IS supplied, `toastsForAction`'s final `.map` (`src/browser/toasts.js:864`) strips the roll span before returning `{text, tone, priority}` (no `idx`/`type`/`roll`). There is, however, a ready-made, already-tested, currently-DEAD pure function that solves exactly this shape — `oracleLogViewModel(entries, diceMode)` (`src/browser/viewModels.js:376-396`) — which splits an Oracle HTML line into `{narration, roll, revealable, revealedByDefault}` and reverses to newest-first, unused anywhere in the live shell since the DR18 "dice only ever shows in the Oracle" CSS rule (`mazeworld.html:632-639`, `#enc-body p .roll{display:none}`) replaced its 3-mode `diceMode` setting. This phase deliberately reverses that DR18 rule for its own new log; the CSS rule and the routing gap both need explicit resolution.

**Primary recommendation:** Keep `renderEncounter()` as the single render function and `#enc-panel`/`#enc-body` as the single overlay host (matching every existing branch: dead/won/beats/pendingLoot/pendingJoiner/pendingFind/store/live-combat); add a new early branch for `C.pending` that renders the MAJOR OVERLAY markup (not the combat-panel markup) so the combat screen genuinely never shows a pending fight; extend `dispatchWithToasts`'s routing (or add a parallel routing path) so combat events retain per-line roll detail through to `window.__mzFightLog`, reusing `oracleLogViewModel`'s narration/roll-split pattern rather than re-deriving it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Combat rules (to-hit, damage, foe AI, loot rolls) | Engine (`engine/*.js`) | — | Already pure/deterministic; this phase must not touch it (engine gate, `STATE.md`) |
| Combat screen layout/markup/CSS | Shell (`mazeworld.html`, classic script) | — | `renderEncounter()` is the one render function; no framework, no component tree |
| Presentation-only transient state (fight log, submenu open/closed) | Shell (`window.__mz*` globals) | — | Never on `S`/`state` — `serializeRun` spreads `S` wholesale (established pattern: `window.__mzRoundCard`, `window.__mzLootReport`) |
| Input-safety guarding (arm window, settle window) | Shell (`src/browser/inputGuards.js` + `guardTap`) | — | Pure `Date.now()` module already exists and is bridged; extend usage, don't rebuild |
| Event → narration/toast/roll mapping | Shell (`src/browser/toasts.js`, `src/browser/eventNarration.js`) | Shell (`mazeworld.html#dispatchWithToasts`) | `toastsForAction`/`EVENT_NARRATION` are the pure data layer; `dispatchWithToasts` is the one routing seam that decides card vs toast vs (new) fight-log |
| Fonts/visual assets | Build (`tools/build-www.mjs` copies `fonts/` → `www/fonts/`) | Shell (`@font-face` rules, `mazeworld.html:35-56`) | Already offline-safe; no new asset pipeline needed |

## Standard Stack

This phase adds **no new libraries, no new npm packages, no new build tooling**. It is a pure rewrite of existing vanilla JS/HTML/CSS inside `mazeworld.html` plus its existing ESM helper modules (`src/browser/*.js`). Skip the "Installation"/"Version verification" sub-sections below — nothing to install.

### Core (existing, reused)
| File | Purpose | Why it's the standard for this phase |
|------|---------|----------------------|
| `mazeworld.html` (classic `<script>` + trailing `<script type="module">`) | The one shell surface; `renderEncounter()` (`:5026`), `dispatchWithToasts()` (`:6356`), `engineCombatAction()` (`:6858`), guard helpers (`:4871-4909`) | No framework in this codebase; every prior phase (29/31/32/33) extended this exact file with the exact same source-assertion-test discipline |
| `src/browser/toasts.js` (1355 lines) | `toastsForAction`, `TOAST_FOR`, `PRIORITY`, `MAX_TOASTS`, `CARD_EVENTS`, `NARRATIVE_ACTIONS`, `narrativeToastText` | The one pure event→presentation table; Phase 32 already extended it non-destructively (`opts.limit`) — same extension pattern applies here |
| `src/browser/eventNarration.js` (732 lines) | `EVENT_NARRATION`, `narrateEvent(e)` | The Oracle's full-detail (roll-bearing) sentence table; source of the fight log's tap-reveal detail |
| `src/browser/viewModels.js` | `oracleLogViewModel` (dead, reusable), `grimoireViewModel`, `characterSheetViewModel`, `armorDisplay`, `lootCompare`, `bagUsage` | Existing pure view-model layer; extend, don't duplicate |
| `src/browser/inputGuards.js` | `ARM_DELAY_MS=250`, `DISMISS_SETTLE_MS=250`, `isArmed`, `isSettled` | Phase 32's pure timing-guard module; every new decision button in this phase routes through it via `guardTap` |
| `www/fonts/press-start-2p-400.woff2`, `courier-prime-400.woff2`, `courier-prime-700.woff2` | The mock's two faces, already bundled | Confirmed present in `www/fonts/`; `@font-face` rules already at `mazeworld.html:35-56`; `tools/build-www.mjs:108-113` copies `fonts/` → `www/fonts/` on every build |

### Alternatives Considered
None — no external library choice exists in this phase; it is 100% internal refactor/rebuild against a fixed engine API and a fixed visual spec.

**Installation:** N/A — no packages to install.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (no `npm install` of any kind). Skip the legitimacy gate entirely.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CSCR-01 | Full-screen mock layout (header/middle/action-area bands) | `#enc-panel`/`#enc-body` structure at `mazeworld.html:1379-1399`; fonts already bundled (`:35-56`); `prefers-reduced-motion` blanket rule at `:756` zeroes all transitions/animations globally — the mock's `mwrise`/`mwfade`/`mwtorch`/`mwglow` keyframes are automatically safe if added as ordinary CSS animations |
| CSCR-02 | Foe cards (glyph/name/meta/wp/tag/bar), tap-to-retarget | Runtime foe shape confirmed at `engine/combat.js:188-216` (`size`, `intel`, `sp`, `wp`/`maxWP`, `alive`, `lives`, `name`, `lvl`); current foe roster render at `mazeworld.html:5351-5367`; **no engine `retarget` action exists** — targeting is a direct `C.target = i` mutation (`:5363-5364`), currently **unguarded** |
| CSCR-03 | YOUR LOT strip (hero + party members) | `state.party` shape via `renderPartyRail()` (`mazeworld.html:4995-5024`: `m.name`, `m.sub`, `m.lvl ?? m.level`, `m.wp`, `m.maxWP`, `m.status === "downed"`); **`PARTY_CAP = 1`** (`engine/state.js:50`) — today at most one joiner exists, though the scrollable strip must still be built per CONTEXT's forward-looking decision |
| CSCR-04 | › fight log, newest-first, tap-reveal dice, refusals as dull entries | `dispatchWithToasts` routing (`mazeworld.html:6356-6378`); `PRIORITY.block` (`src/browser/toasts.js:47`); the 26-entry `REFUSAL_TYPES` list (`test/unit/shell-round-card.test.js:174-181`); **the roll-detail gap** — see Common Pitfalls #1; `oracleLogViewModel` (`src/browser/viewModels.js:376-396`) as the ready-made split/reverse helper |
| CSCR-05 | 2×2 action grid + submenus | Current 7-button action bar at `mazeworld.html:5417-5509`; view-models for submenu content: `grimoireViewModel` (`:306`), `characterSheetViewModel` (`:235`), `window.mzSpellCharges` (`:2729-2730`), `renderCarriedList` (`:3549-3665`) |
| CSCR-06 | Fight! gate = map's MAJOR OVERLAY | Current gate at `mazeworld.html:5408-5415` (`C.pending` → `#a-fight` inside the combat branch) must be REMOVED from the combat-panel markup; Map Panel mock's `hasMajor`/`major.*` spec (`design/Mazeworld Map Panel.dc.html:81-93,132-138`) is the new target; no existing DOM host for it — see Architecture Patterns #1 |
| CSCR-07 | Loot/flee/death endings folded in | `noteCombat()` (`:6258-6302`), `window.__mzLootReport` (`:6272,6290-6297`), Phase 29 loot branch (`:5148-5177`), death card (`:5071-5090`), `wireDeathConfirm()` (`:4953-4961`) |
| CSCR-08 | Guards intact | `guardTap`/`encArmed`/`encounterSettled`/`armEncounterButtons` (`:4871-4909`); `DISMISS_SETTLE_MS` clause in `window.move` (`:6391`); **foe retarget is currently unguarded and must be wrapped** |
| CSCR-09 | Engine/content/parity untouched; tests re-pinned | Full test list confirmed to exist (see Validation section); parity gate hash `a1f4d0dc29782218d8e5aab65bc5989c33f917f0` = `git hash-object test/parity/prototype-master.js.txt` (verified live); `npm test` baseline **1955/1955** as of Phase 33 close |
| CSCR-10 | On-device DR round | Deferred per this project's standing "batch UAT at end of run" rule (`MEMORY.md`) — no action needed mid-phase |
</phase_requirements>

## Architecture Patterns

### System Architecture Diagram

```
Player tap/key
      │
      ▼
window.mz*  (mzAttack / mzFight / mzFlee / mzParley / mzSing / mzCastSpell /
             mzDrinkPotion / mzReadScroll / mzUseItem)         [mazeworld.html:6887-6901,6835-6839]
      │  each is a thin wrapper: () => engineCombatAction(type, extra)
      ▼
engineCombatAction(type, extra)                                 [mazeworld.html:6858-6886]
      │  1. sample wasCombat
      │  2. dispatchWithToasts({type, ...extra})
      ▼
dispatchWithToasts(action)                                      [mazeworld.html:6356-6378]
      │  1. dispatch(action) → { state, events, html }   (src/browser/engineAdapter.js:376)
      │  2. toastsForAction(type, events, ctx, {limit:Infinity})  (src/browser/toasts.js:832)
      │        ctx.narrate = narrateEvent ONLY for NARRATIVE_ACTIONS (move/camp/resolveJoiner)
      │        → for combat actions, ctx = {} → TOAST_FOR's short table text (NO roll span)
      │  3. routing: if (inCombat && t.priority !== PRIORITY.block) → card line
      │              else                                          → window.mzToast queue (capped MAX_TOASTS)
      │  4. writes window.__mzRoundCard = {seq, pending, round, lines}   ◄── THIS is what Phase 34 replaces
      │        with window.__mzFightLog = {seq, entries:[{text, roll, round, show}]}
      ▼
back in engineCombatAction: noteCombat(wasCombat, state, events)   [mazeworld.html:6258-6302]
      │   on combat END (wasCombat && !has): builds the victory/flee/death report
      │   → window.__mzLootReport (if pendingLoot) or state.beats (Move-on card)
      ▼
window.renderEncounter()                                        [mazeworld.html:5026-5510]
      │  branch order (unchanged by this phase, extend don't reorder):
      │   1. !active → hide panel, return                        (hasActiveEncounter() false)
      │   2. S.dead && !preDeathBeat → death card
      │   3. S.won → victory-through-the-gate card
      │   4. !S.combat && S.beats → beats/Move-on card
      │   5. S.pendingLoot.length → loot screen  [Phase 29]
      │   6. S.pendingJoiner → joiner accept/decline
      │   7. S.pendingFind → find take/leave
      │   8. S.store → store screen
      │   9. live combat (S.combat, not C.pending) → COMBAT PANEL (this phase's rebuild)
      │        NEW: C.pending must NOT reach branch 9's combat-panel markup —
      │        it needs its own branch (before/inside 9) rendering the MAJOR OVERLAY instead
      ▼
DOM (#enc-panel → #enc-body, rebuilt via innerHTML/textContent per Phase 32 precedent)
```

### Recommended Project Structure
No new files are structurally required — this is a single-file (`mazeworld.html`) rebuild plus possible small additions to `src/browser/` if the planner chooses to extract pure helpers (e.g. a `fightLog.js` view-model mirroring `oracleLogViewModel`, or a `combatMenu.js` for the 2×2 grid/submenu content derivation). Given the codebase's established pattern (view-model logic lives in `src/browser/viewModels.js`; presentation-only glue lives inline in `mazeworld.html`), the natural split is:

```
mazeworld.html            # renderEncounter() rewrite: MAJOR OVERLAY branch + combat-panel branch,
                           # DOM build (innerHTML sections per band or persistent skeleton — discretion),
                           # window.__mzFightLog write site (inside dispatchWithToasts or a sibling fn)
src/browser/
  viewModels.js            # extend with fight-log line-splitting (reuse/adapt oracleLogViewModel),
                           # a menu/submenu content view-model (STRIKE sub-line, SPELLS/ABILITIES rows,
                           # ITEMS rows, SOCIAL rows) built from existing grimoireViewModel/
                           # characterSheetViewModel/renderCarriedList-equivalent data
  toasts.js                # extend toastsForAction non-destructively (Phase 32 precedent: opts.limit)
                           # if per-line roll detail needs to survive the pipeline
```

### Pattern 1: The MAJOR OVERLAY needs a new render path, not a new state flag
**What:** `C.pending` (`state.combat.pending`, set by `engine/combat.js#startCombat` at `:226`, cleared by the `fight` action) is the ONLY signal needed to know a Fight! gate is showing. Today it renders `#a-fight` inside the live-combat branch (`mazeworld.html:5408-5415`) using the SAME `#enc-body` host as the rest of the combat panel. CSCR-06 requires this to become visually and structurally distinct (Map Panel's `hasMajor`/`major.*` icon/title/line/roll/button spec) — NOT the combat panel's header/foes/lot/log/grid chrome.
**When to use:** Add a branch that checks `S.combat && S.combat.pending` BEFORE the combat-panel branch (or as its own early return inside it) and renders the MAJOR OVERLAY markup/CSS instead. This keeps `#enc-panel`/`renderEncounter()` as the single host (matching every other branch), satisfies "the combat screen never renders a pending combat" as a rendering-branch guarantee, and gives Phase 35 a function/branch shape it can extend for GO DOWN/NOT YET and the out-of-combat death variant (per `35-CONTEXT.md`'s MAP-05 and its own note: "built in Phase 34 so the combat screen never renders a pending combat" / "Phase 35 reuses it for descents/death").
**Example (structure, not copy):**
```js
// Source: design/Mazeworld Map Panel.dc.html:81-93 (hasMajor/major.* spec) — adapted
function renderMajorOverlay(kind, opts) {
  // kind: "encounter" (Phase 34) | "descend" | "deathOutOfCombat" (Phase 35 adds these)
  // returns markup per the Map Panel's icon/title/line/roll/button column
}
// in renderEncounter(), before the live-combat branch:
if (S.combat && S.combat.pending) {
  body.innerHTML = renderMajorOverlay("encounter", { foes: S.combat.foes, onFight: () => window.mzFight?.() });
  return;
}
```

### Pattern 2: `window.__mzFightLog` — presentation-only, never on `S`
**What:** Mirrors the exact established pattern of `window.__mzRoundCard` (Phase 32) and `window.__mzLootReport` (Phase 29) — both explicitly documented as "never stored on state" because `serializeRun` spreads `S` wholesale (a field on `S` would be silently persisted to disk). CONTEXT.md's own spec (`window.__mzFightLog = {seq, entries:[{text, roll, round, show}]}`) already follows this convention.
**When to use:** Written inside `dispatchWithToasts` (replacing the `window.__mzRoundCard` write at `mazeworld.html:6370-6376`) or a parallel function called from the same seam. Entries ACCUMULATE for the whole fight (unlike the old Round Card which held only the current round) and clear at `endCombat`/flee/death — the natural clear points are the same places `window.__mzRoundCard = null` is already set (`:6370` on `!inCombat`) plus `noteCombat`'s combat-end branch (`:6275-6301`).
**Example:**
```js
// Source: mazeworld.html:6356-6378 (dispatchWithToasts), adapted
// Today: window.__mzRoundCard = { seq, pending, round, lines }  (CURRENT round only)
// New:   window.__mzFightLog.entries.push(...linesWithRollDetail)  (WHOLE fight, newest-first at render time)
```

### Pattern 3: Reuse `oracleLogViewModel`'s split, don't reinvent it
**What:** `oracleLogViewModel(entries, diceMode)` (`src/browser/viewModels.js:376-396`) already does: (1) match `<span class="roll">(...)</span>` via `ROLL_SPAN_RE` (`:360`), (2) split into `{narration, roll}`, (3) set `revealable`/`revealedByDefault` per `diceMode`, (4) `.reverse()` for newest-first. This is DEAD code today (zero call sites in `mazeworld.html` — confirmed via repo-wide grep; only `test/unit/oracleLogViewModel.test.js` exercises it) because DR18 replaced the 3-mode Oracle dice setting with a static rule. CSCR-04's "no dice-mode setting... tap-to-reveal only" maps EXACTLY to calling `oracleLogViewModel(entries, "on tap")` with a hardcoded mode string.
**When to use:** For the fight log's per-entry roll split. The remaining gap (see Pitfall #1) is what `entries` should contain — today's `toastsForAction` output has no roll spans for combat events; the planner must decide how to source roll-bearing HTML per fight-log line (see Common Pitfalls #1 for the concrete options).
**Example:**
```js
// Source: src/browser/viewModels.js:376-396 (existing, currently unused)
export function oracleLogViewModel(entries, diceMode) {
  const rows = entries.map((entry) => {
    const html = typeof entry === "string" ? entry : entry && entry.html;
    const match = ROLL_SPAN_RE.exec(html || "");
    const roll = match ? match[1] : null;
    const narration = match ? (html.slice(0, match.index) + html.slice(match.index + match[0].length)).trim() : (html || "").trim();
    if (roll === null) return { narration, roll: null, revealable: false, revealedByDefault: false };
    // diceMode "on tap": revealable true, hidden until tapped
    return { narration, roll, revealable: true, revealedByDefault: false };
  });
  return rows.reverse();
}
```

### Anti-Patterns to Avoid
- **Re-deriving the roll/narration split from scratch:** `oracleLogViewModel` already exists, is pure, and is unit-tested (`test/unit/oracleLogViewModel.test.js`) — extend/adapt it rather than writing a second regex-based splitter.
- **Storing `__mzFightLog`, `__mzCombatMenu`, or submenu-open state on `S`/`state.combat`:** breaks save/load and the parity comparables (every serialized field must be carved out in `test/parity/harness/comparables.js`'s three functions — presentation-only `window.__mz*` globals sidestep this entirely, which is why every prior phase used them).
- **Wrapping the CSS transition/keyframe animations (`mwrise`/`mwfade`/`mwglow`) in a guard's timing logic:** the guard helpers are explicitly `Date.now()`-only and forbid any `transitionend`/`animationend` listener (`mazeworld.html:4860-4870`); `test/unit/shell-input-guards.test.js` pins a zero-occurrence grep for both tokens (case-insensitive) across the guard-helper region. A future test in this phase's own suite should extend that same zero-occurrence check to any new region this phase adds.
- **Dispatching a `retarget` engine action:** it doesn't exist. Foe targeting stays a direct `C.target = i; renderEncounter();` presentation mutation (see Pitfall #6) — do not invent an engine action for it unless the planner explicitly decides to add one (out of scope for a shell-only phase per CONTEXT.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Roll/narration split for tap-reveal | A new regex-based HTML splitter | `oracleLogViewModel`'s `ROLL_SPAN_RE` pattern (`src/browser/viewModels.js:360,379-381`) | Already correct, already tested, already handles the `<span class="roll">` markup every `EVENT_NARRATION` builder emits |
| Arm-delay / dismiss-settle tap safety | A new `Date.now()` check per button | `guardTap(btn, fn)` + `window.__mzInputGuards` (`mazeworld.html:4905-4909`, `src/browser/inputGuards.js`) | Pure, unit-tested, zero-flicker (`aria-disabled` only, never CSS-driven); every §6.3-equivalent button in this phase should route through it |
| Event → short toast text / fold/dedupe/priority | A new toast-fold pipeline | `toastsForAction` (`src/browser/toasts.js:832-865`) — extend via `opts`, Phase 32 precedent | Already proven at scale (400-seed worst-case sweep, `test/unit/round-card-worst-case.test.js`) |
| Bag-capacity / loot-compare readouts | A raw `c.items.length` count anywhere new | `window.__mzBagUsage(c)` / `window.__mzLootCompare(c, it)` | Phase 29 established these as THE single capacity/compare readouts; a new raw count would violate the standing LOOT-04 invariant four other call sites already respect |
| Item usability / carried-list rendering | A new list renderer for the ITEMS submenu | `renderCarriedList(container, items, opts)` (`mazeworld.html:3549-3665`) | Already handles guard wiring (`opts.guard`), sub-line override (`opts.subFor`), and every action type (`use`/`equip`/`drop`/`sell`/`lootEquip`/`lootTake`/`lootLeave`) — the ITEMS submenu is very likely a fourth/fifth host of this exact function rather than a new component |
| Spell castability | Re-checking `sp.lvl` against `S.c.level` | `window.__mzCanCast` bridge → `engine/derived.js#canCast` (Phase 31) | Closes the Phase 23 Summoner/Illusionist regression; a hand-rolled check would reintroduce it |

**Key insight:** Nearly every primitive this phase needs (guard timing, roll/narration split, toast folding, bag/loot compare, carried-item rendering, spell castability) already exists as a pure, tested module from Phases 25–33. This phase's actual net-new work is presentation layout/markup/CSS plus a small number of genuinely new view-model shapes (the 2×2 action-grid content, the submenu row content, the YOUR LOT strip, the MAJOR OVERLAY content) — not new primitives.

## Common Pitfalls

### Pitfall 1: The fight log's "tap reveals dice" has no ready data source for combat events
**What goes wrong:** Implementing CSCR-04 naively (feeding `toastsForAction`'s returned `{text, tone, priority}` straight into the fight log) produces entries with NO roll data at all for combat actions — `text` is already roll-free (`TOAST_FOR` builders never embed `<span class="roll">`, and even the `ctx.narrate` fallback path's output is passed through `narrativeToastText` which explicitly strips `ROLL_SPAN_RE` before returning — `src/browser/toasts.js:139-145`).
**Why it happens:** `NARRATIVE_ACTIONS` (`src/browser/toasts.js:75`) is `["move", "camp", "resolveJoiner"]` only — a deliberate Phase 25.1 decision (DFB-01) that never anticipated combat needing roll-bearing card lines. Combat actions dispatch with `ctx = {}` (`mazeworld.html:6360`), so `toastsForAction` always uses `TOAST_FOR`'s short table text for them.
**How to avoid:** Two viable approaches (planner decision, not prescribed here):
  1. **Parallel source:** build fight-log lines from `result.html` (the `formatEvents()` output already returned by `dispatch()` at `src/browser/engineAdapter.js:413` — full Oracle sentences, ROLL SPANS INTACT, one line per narrated event, same source the Oracle log already consumes via `window.logLine(line)`) instead of from `toastsForAction`'s folded/deduped output. This sacrifices `toastsForAction`'s grouping/dedup (e.g. `enemyRound`/`yourRound`/`killFold`'s multi-event folding) but is a straight, already-correct data source — feed straight into `oracleLogViewModel`-style splitting.
  2. **Extend the pipeline:** add an `opts`-gated mode to `toastsForAction` (mirroring the Phase 32 `opts.limit` precedent) that preserves `idx`/`type` through the final `.map`, then have the fight-log builder look up `narrateEvent(events[idx])` per surviving toast and split its roll span — keeps the folding/dedup UX but requires a genuine (if small) `toasts.js` change.
  Either way, this is presentation-only — no engine change — but it IS new logic the planner must scope explicitly as a task, not assume "the round-card routing already does this."
**Warning signs:** A plan that says "reuse `window.__mzRoundCard`'s existing lines for the fight log" without addressing this gap will ship a fight log where every entry's "tap to reveal dice" affordance renders empty.

### Pitfall 2: The DR18 "no dice in the encounter panel" CSS rule directly contradicts CSCR-04
**What goes wrong:** `mazeworld.html:632-639` has `#enc-body p .roll{display:none}`, a deliberate, documented DR18 decision ("dice-roll detail now lives EXCLUSIVELY in the Oracle log... NEVER shown in the encounter panel #enc-body/the Round Card"). If this phase's fight log renders inside `#enc-body` (or reuses its `.round-card`-adjacent CSS) without removing/scoping this rule, every roll span will render `display:none` regardless of the new tap-to-reveal JS logic — a silent, hard-to-spot CSS bug, not a logic bug.
**Why it happens:** The rule is a blanket selector (`#enc-body p .roll`), not scoped to the old `.round-card` class specifically.
**How to avoid:** Remove or narrow this rule as part of this phase's CSS work; if any OTHER branch inside `#enc-body` still relies on the old "never show dice" behavior (check: does the beats/Move-on branch, `mazeworld.html:5118-5121`, still want this?), scope the new rule precisely rather than deleting it blanket.
**Warning signs:** Tap-to-reveal toggles a class/attribute correctly in the DOM inspector but the roll text visually never appears.

### Pitfall 3: `NARRATIVE_ACTIONS`/`CARD_EVENTS`/`ORACLE_ONLY`/`toastsCoverage` are STANDING invariant tests that assume the current 2-destination (card/toast) model
**What goes wrong:** `test/unit/shell-round-card.test.js`'s "BEHAVIOUR: every TOAST_FOR type routes to exactly one of card/toast when in combat, and the two sets partition the manifest" test (`:160-195`) hard-codes the assumption that in-combat routing has exactly two destinations. If this phase introduces a THIRD destination semantics (e.g. "dull fight-log entry" vs "narrative fight-log entry" as genuinely different presentation, not just a tone flag on the same destination), the re-pinned test needs to model that as tone/type on ONE destination (fight log), not as a new destination — matching CONTEXT.md's own framing ("every event → exactly one of log-narrative / log-dull", i.e. still ONE destination, two tones).
**Why it happens:** Easy to conflate "two tones of the same log" with "two routing destinations" when translating CONTEXT.md's prose into code.
**How to avoid:** Keep the routing binary at the `dispatchWithToasts` level (in-combat → fight log; out-of-combat → toast queue, unchanged) and push the narrative/dull distinction into a `PRIORITY.block ? "dull" : "narrative"` tag on each fight-log entry, mirroring how `destinationFor` in the existing test computes `dest` today.
**Warning signs:** A new `if/else if/else` chain (three branches) inside `dispatchWithToasts` instead of the existing one `if/else` — the acceptance-criteria-style tests in this codebase count literal occurrences (`grep -c`) of exactly these routing constructs; a third branch will likely fail a re-pinned structural test that expects "exactly one if/else."

### Pitfall 4: The naive comment-stripper in every source-assertion test has a known false-positive on `/*` substrings
**What goes wrong:** `test/unit/shell-round-card.test.js`'s `stripComments()` (`:42-51`) uses `source.replace(/\/\*[\s\S]*?\*\//g, ...)` — a non-nesting-aware block-comment regex. Phase 31's own SUMMARY documented exactly this bug: a comment containing the literal substring `test/parity/fixtures/*.json` was misread as a block-comment opener, silently eating real code until the next `*/` (`31-01-SUMMARY.md` deviation #1). The SAME risk exists for `test/unit/formatEventsCoverage.test.js`/`toastsCoverage.test.js`'s independent comment-stripping scanners, and for any NEW source-assertion test this phase writes using the same pattern.
**Why it happens:** The regex has no awareness of string literals or nested `/*`/`*/`; any comment mentioning a literal `/*`-looking substring (a glob pattern, a regex literal in a code comment, a CSS comment example) corrupts the scan silently — the test may still pass by accident, or may fail with a confusing "expected pattern not found" error far from the actual cause.
**How to avoid:** When writing new doc comments inside `mazeworld.html` for this phase's own code, avoid literal `/*` substrings in prose (as Phase 31 did: reworded `"test/parity/fixtures/*.json"` to `"the fixture JSON files under test/parity/fixtures"`). When a new source-assertion test fails mysteriously, check for this first before assuming the code is wrong.
**Warning signs:** A `grep -c '/\*'`/`grep -c '\*/'` imbalance check (used in Phase 31's own verification) is the fast diagnostic.

### Pitfall 5: `serializeRun` spreads `S` wholesale — any new field on `state.combat` MUST be carved out in the parity comparables
**What goes wrong:** This is a shell-only phase and should touch ZERO engine files, but a planner sketching the fight-log/submenu design might be tempted to stash presentation state (submenu open/closed, which foe is targeted for display purposes) onto `state.combat` because it's already there and convenient. `C.target`, `C.spellOpen` are ALREADY on `state.combat` today (not `window.__mz*`) — this is pre-existing precedent, not something this phase introduces, but it means `state.combat` is NOT purely engine-owned today; it already carries two presentation fields the parity harness must already tolerate (confirmed: engine's own `startCombat` sets `spellOpen: false` at `engine/combat.js:226`, so it round-trips through parity as an engine-owned field, not a shell add-on).
**How to avoid:** Any NEW field this phase adds to `state.combat` (if any) needs the same three-comparable carve-out Phase 29/31/33 established (`test/parity/harness/comparables.js` + the three parity test files' own local `comparable()` copies) — or, preferably, stays off `state.combat` entirely and lives on a `window.__mz*` global instead (the fight log, the submenu state, per CONTEXT.md's own explicit instruction: "Submenu is presentation state only (`window.__mzCombatMenu`)").
**Warning signs:** A new key appears in `state.combat` that isn't in `engine/combat.js`'s own `startCombat`/`fight` — this WILL break parity for any fixture that ever enters combat.

### Pitfall 6: Foe retargeting is a direct state mutation today, not a guarded, dispatched action — and CSCR-08 requires it to be guarded
**What goes wrong:** `mazeworld.html:5362-5364` wires foe-card taps directly: `el.onclick = () => { C.target = i; renderEncounter(); };` — no `guardTap` wrapper, no engine dispatch (confirmed: `grep -rn "retarget"` across `mazeworld.html` and `engine/` finds ZERO matches for an engine "retarget" action; `engine/magic.js:89-93` only has a comment describing dead-target auto-retarget logic INSIDE spell resolution, unrelated to player-initiated targeting). CONTEXT.md's own text ("Tap a live card → the existing retarget dispatch (guarded)") is factually wrong about the CURRENT code — there is no dispatch, and it is NOT guarded.
**Why it happens:** `C.target` was always a lightweight, zero-rng, purely-presentation index into the engine's own `foes` array — never worth the ceremony of a full dispatched action, so it was left as a direct mutation from Phase 25.1 era code.
**How to avoid:** In the rebuild, wrap the new foe-card tap handler in `guardTap` (satisfying CSCR-08's "every button is guarded" requirement) while keeping it as a direct `C.target = i; renderEncounter();` mutation (no new engine action needed — this is presentation-only and doesn't need to survive save/load any differently than it does today, since `C.target` is already a real `state.combat` field that DOES serialize, just not rng/gameplay-affecting).
**Warning signs:** A plan that assumes an engine `retarget` action exists and tries to wire `window.mzRetarget` to a non-existent dispatch case will fail at `engine/actions.js`'s `validateAction` (no such type registered).

### Pitfall 7: `renderCarriedList`'s `mkBtn` guard opt-in is per-CALL-SITE, not global — new hosts must explicitly pass `guard: true`
**What goes wrong:** `renderCarriedList` (`mazeworld.html:3549-3665`) is reused across FOUR existing hosts (GEAR tab, store sell list, combat use-list, loot screen) with DIFFERENT `opts.guard` values — only the combat use-list and the loot screen pass `guard: true` (Phase 32's `test/unit/shell-input-guards.test.js` pins `guard: true` appearing "exactly twice"). If this phase reuses `renderCarriedList` for the ITEMS submenu (a fifth host) and forgets to pass `opts.guard: true`, the ITEMS submenu rows will render WITHOUT the arm-delay guard — a silent CSCR-08 violation that no existing test will catch (the existing "exactly twice" pin will need updating to "exactly three" or however many new guarded call sites this phase adds).
**How to avoid:** Explicitly pass `guard: true` for any NEW `renderCarriedList` call site used inside the combat submenus, and update the `shell-input-guards.test.js` `guard: true` occurrence-count pin accordingly.
**Warning signs:** A re-pinned `shell-input-guards.test.js` that still asserts "exactly twice" after this phase adds a third/fourth guarded call site — the plan must explicitly update this count.

### Pitfall 8: `#enc-panel` is the SOLE `.mw-overlay` in the whole app — it already covers the map AND the D-pad/Make-Camp bar
**What goes wrong:** A planner unfamiliar with the current layout might assume the MAJOR OVERLAY (CSCR-06) needs a brand-new full-screen container stacked above everything. In fact `#enc-panel` (`mazeworld.html:1379`, `.mw-overlay` CSS at `:345`) is ALREADY documented as covering "BOTH the map viewport above AND this MAKE CAMP + D-pad bar" (`:1370-1378` doc comment) — it is already the single full-screen overlay host every other branch (death/won/beats/loot/joiner/find/store) uses.
**How to avoid:** Reuse `#enc-panel`/`#enc-body` as the host for the MAJOR OVERLAY branch too (see Architecture Pattern 1) rather than introducing a second overlay element — this avoids duplicating the `hasActiveEncounter()`/guard/dismiss-settle wiring that already targets `#enc-panel` specifically.
**Warning signs:** Two different `hidden`-toggled full-screen containers both needing their own `hasActiveEncounter()`-style gate — a maintenance/parity-of-behavior risk (e.g. the settle-window stamp at `:5040-5044` only watches ONE `active` transition today).

### Pitfall 9: The Windows dev shell has no `jq`; every acceptance-criteria check in this codebase already routes through `grep -c`/`node -e`
**What goes wrong:** Attempting a `jq`-based JSON check (e.g. against `package.json` or a test-output JSON report) will fail outright — `jq` is not installed/available in this project's tool-calling shell (confirmed: `CLAUDE.md`'s own `docs/RELEASING.md` note "this machine sets NoDefaultCurrentDirectoryInExePath=1" and the project's `tools/*.mjs` convention — every prior phase's SUMMARY.md verification commands use `grep -c`, `node --test`, or small `node -e` one-liners, never `jq`).
**How to avoid:** Follow the established pattern: `grep -c '<pattern>' mazeworld.html` for literal-string acceptance criteria, `node --test test/unit/<file>.test.js` for behavioral checks, `git hash-object <path>` for the parity master hash check (verified working command, see Validation Architecture below).
**Warning signs:** A plan step that says `... | jq '.tests'` — replace with the equivalent `node --test ... 2>&1 | grep -c '# pass'`-style pattern this codebase already uses everywhere.

### Pitfall 10: `NO PARTY_CAP > 1` today — build the scrollable strip, but don't expect >1 joiner in any live/test scenario
**What goes wrong:** CSCR-03's "the strip becomes overflow-x:auto when it overflows" is explicitly a forward-looking user decision ("leaves that section open and scrollable if we ever add more party members") against a system where `PARTY_CAP = 1` (`engine/state.js:50`) makes overflow structurally impossible today. A test asserting real 3-joiner overflow behavior cannot be built against live gameplay data — it needs a SYNTHETIC `state.party` array (3+ entries) fed directly to the view-model/render function, not a real `addPartyMember` call sequence (which refuses past `PARTY_CAP`).
**How to avoid:** Test the overflow CSS/behavior with hand-built `state.party` fixtures (bypassing `addPartyMember`), exactly as CONTEXT.md's own test list implies ("YOUR LOT with 0/1/3 joiners incl. overflow-x").
**Warning signs:** A test that tries to grow `state.party` past 1 via the real engine action and expects it to succeed — it won't (`engine/state.js:66-69`, `if (state.party.length >= PARTY_CAP) return false;`).

## Code Examples

### The exact routing seam this phase must extend
```js
// Source: mazeworld.html:6356-6378 (dispatchWithToasts, current implementation)
function dispatchWithToasts(action) {
  const before = window.__mzState.get();
  const roundBefore = before && before.combat ? before.combat.round : null;
  const result = dispatch(action);
  const ctx = NARRATIVE_ACTIONS.has(action.type) ? { narrate: narrateEvent } : {};
  const inCombat = !!(result.state && result.state.combat);
  const lines = [];
  const queue = [];
  for (const t of toastsForAction(action.type, result.events, ctx, { limit: Infinity })) {
    if (inCombat && t.priority !== PRIORITY.block) lines.push(narrativeToastText(t.text) || t.text);
    else queue.push(t);
  }
  for (const t of queue.slice(0, MAX_TOASTS)) window.mzToast?.(t.text, t.tone);
  if (!inCombat) {
    window.__mzRoundCard = null;
  } else if (lines.length) {
    window.__mzRoundCard = { seq: ++roundCardSeq, pending: !!result.state.combat.pending, round: roundBefore ?? result.state.combat.round, lines };
  } else if (roundBefore === null) {
    window.__mzRoundCard = null;
  }
  return result;
}
```

### Every combat dispatch bridge (unchanged surface, do not modify signatures)
```js
// Source: mazeworld.html:6887-6901
window.mzAttack = () => engineCombatAction("attack");
window.mzFight = () => engineCombatAction("fight");
window.mzFlee = () => engineCombatAction("flee");
window.mzParley = () => engineCombatAction("parley");
window.mzSing = () => engineCombatAction("sing");
window.mzCastSpell = (idx) => engineCombatAction("castSpell", { idx });
window.mzDrinkPotion = () => engineCombatAction("drinkPotion");
window.mzReadScroll = () => engineCombatAction("readScroll");
// window.mzUseItem routes to engineCombatAction("useItem", {i}) IN combat, inventoryAction OUT of combat — mazeworld.html:6835-6839
```

### The guard wrapper every new decision button must use
```js
// Source: mazeworld.html:4905-4909 (guardTap, unchanged by this phase)
function guardTap(btn, fn) {
  if (!btn) return;
  btn.setAttribute("aria-disabled", "true");
  btn.onclick = () => { if (encArmed()) fn(); };
}
// armEncounterButtons() (mazeworld.html:4889-4896) stamps a fresh arm window every renderEncounter() build.
// Called once per render at mazeworld.html:5053, inside the `if (panel) panel.hidden = false;` branch.
```

### Foe runtime shape (what CSCR-02's foe card reads)
```js
// Source: engine/combat.js:188-216 (startCombat, foe roster construction)
foes.push({
  name: picked.n,          // string
  type,                    // encounter-table type string
  lvl,                     // 1-5
  size: picked.sz,         // content bestiary field "sz" -> runtime field "size" (T/S/M/L/H abbreviations)
  intel: picked.i,         // content bestiary field "i" -> runtime field "intel"
  wp, maxWP,                // current/starting hp
  alive: true,
  asleep: 0,
  sp: picked.sp || {},     // sp.note is the flavor/mechanic line CSCR-02 wants
  lives: picked.sp && picked.sp.twice ? 2 : 1,
  // conditionally present: abilities[], dmgBonus
});
```

### `state.party` member shape (what CSCR-03's YOUR LOT reads)
```js
// Source: mazeworld.html:5006-5021 (renderPartyRail, the existing party-rail consumer)
// m.name, m.sub, m.lvl ?? m.level, m.wp, m.maxWP, m.status === "downed"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| DR13 in-panel HIT/MISS badge (`C.lastStrike`) | Toast-driven feedback, no panel resize | Phase 25 (Toast architecture) | `engineCombatAction` still synthesizes `state.combat.lastStrike` for compatibility (`:6871-6877`) — verify this phase's rebuild doesn't need to read it; it appears unused by any current render code except possibly legacy paths — grep before assuming it's needed |
| `.exchange`/`lastExchange`/`exchangeN` (per-round footnote) | `window.__mzRoundCard` (whole-round fold, uncapped) | Phase 32 | This phase REPLACES `window.__mzRoundCard` with `window.__mzFightLog` (whole-FIGHT fold) — do not leave both live; the old one must be fully retired, mirroring how Phase 32 fully retired `.exchange` |
| Oracle-only dice ("on tap"/"always"/"never" `diceMode` setting) | Static rule: dice ALWAYS in Oracle, NEVER in encounter panel | DR18 | This phase's fight log REVERSES the "never in encounter panel" half — the CSS rule at `mazeworld.html:639` must be addressed (Pitfall 2) |
| AMBUSH pre-death special case (`beats.awaitingFight`) | Fully collapsed — a pre-emptive kill resolves through the ordinary death card after `fight` dispatch | Phase 31 | Already gone; nothing to remove in this phase, just don't reintroduce a similar special case for the new MAJOR OVERLAY |
| 7-button always-partially-hidden action bar (`a-strike`/`a-potion`/`a-flee`/`a-spell`/`a-talk`/`a-sing`/`a-scroll`) | 2×2 STRIKE/SPELLS-ABILITIES/ITEMS/SOCIAL grid with submenus | This phase | Complete keydown handler rework needed — see Code Examples' keydown section below |

**Deprecated/outdated:**
- `.exchange`/`.round-card` CSS classes and `ROUND_CARD_COPY` — fully superseded by this phase's fight-log CSS and copy table.
- The `#a-fight` button rendered inside the live-combat branch — moves to the new MAJOR OVERLAY branch.
- Keys 2 (Potion)/4 (Spells)/5 (Parley)/6 (Sing)/7 (Scroll) as direct top-level dispatches (`mazeworld.html:5790-5800`) — collapse into the 2×2 grid + submenu digit-picking scheme CONTEXT.md specifies ("1–4 select the grid; inside a submenu digits pick rows").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The MAJOR OVERLAY should be a new render branch inside the existing `#enc-panel`/`renderEncounter()` host rather than a separate top-level DOM element | Architecture Pattern 1, Pitfall 8 | If wrong, the planner needs a second `hasActiveEncounter()`-equivalent gate and duplicated guard/settle wiring — moderate rework, not a blocker, since CONTEXT.md leaves DOM structure to Claude's Discretion |
| A2 | For the fight-log roll-detail gap (Pitfall 1), sourcing lines from `result.html` (raw `formatEvents()` output) is a lower-risk option than extending `toastsForAction` to preserve `idx`/`type` | Pitfall 1 | If the planner instead extends `toastsForAction`, that's also fully viable (Phase 32 precedent) — flagged as ASSUMED because I did not find a definitive signal in CONTEXT.md for which approach the user prefers; either satisfies the stated requirement |
| A3 | `state.combat.lastStrike` (synthesized at `mazeworld.html:6871-6877`) has no live consumer this phase must preserve | State of the Art table | If some existing/hidden render path reads it, removing its use would be a silent regression — low risk since a repo-wide grep for `lastStrike` should be trivial to run at plan/execute time to confirm |

**If this table is empty:** N/A — see above.

## Open Questions

1. **How should the fight log source per-line roll detail while preserving `toastsForAction`'s grouping/dedup?**
   - What we know: `toastsForAction`'s grouping (`enemyRound`/`yourRound`/`spellChain`/`killFold`) is valuable UX compression, proven at scale by `round-card-worst-case.test.js`'s 400-seed sweep; but its final output strips roll data entirely.
   - What's unclear: whether the planner wants to preserve that exact folding behavior for the fight log (in which case `toastsForAction` needs extending) or accept a more 1:1 event→line log (in which case `result.html` is a simpler, already-available source).
   - Recommendation: this is a genuine plan-level architecture decision, not something research should pre-resolve — but the planner MUST make this decision explicitly in Task 1 of whichever plan builds the fight log, since it changes which files (`toasts.js` vs. just `mazeworld.html`) get touched.

2. **Does the MAJOR OVERLAY need its own function (`renderMajorOverlay`) that Phase 35 can call with different `kind` values, or is a Phase-34-only inline branch acceptable, deferring the shared-function extraction to Phase 35?**
   - What we know: CONTEXT.md explicitly says "Build the overlay in this phase... Phase 35 reuses it for descents/death" — implying the SHAPE Phase 34 builds should be reusable, not that Phase 34 must build the descend/death variants itself (those are out of this phase's scope per CSCR-06's own boundary).
   - What's unclear: exact function signature/extension points Phase 35 will need (icon per kind, button count/labels per kind).
   - Recommendation: build the overlay renderer parameterized by at minimum `{icon, title, line, roll, buttons: [{label, onClick, primary}]}` (matching the Map Panel mock's own `major.*` shape almost exactly) so Phase 35 can call it with different content without touching Phase 34's code — low-risk, cheap to do now, avoids a Phase 35 refactor.

## Environment Availability

Skip — this phase has no external tool/service/runtime dependencies beyond what's already installed and verified working in this repo (Node, the existing test runner, `npm run build:www`). No Docker/database/network dependency of any kind.

## Validation Architecture

**Skipped** — `.planning/config.json`'s `workflow.nyquist_validation` is explicitly `false`. Per the harness rule, omit this section entirely. (The project's OWN gate — `npm test` green, `npm run build:www` exit 0, parity diff empty — is documented below under "Validation" for the planner's convenience, but is not the Nyquist validation-architecture format.)

## Security Domain

**Skipped** — `.planning/config.json`'s `workflow.security_enforcement` is explicitly `false`.

## Test Files to Re-Pin or Add (CSCR-09)

All of the following EXIST today (confirmed via `ls test/unit/`) and pin behavior this phase's rebuild will change structurally. Each needs a pass/fail assessment during planning — some may only need small updates, others (the ones pinning exact DOM regions this phase replaces) need substantial rewrites.

| Test file | What it currently pins | Expected impact this phase |
|-----------|------------------------|------------------------------|
| `test/unit/shell-round-card.test.js` | The `.round-card` region, `#enc-round-live` announcer, `dispatchWithToasts` routing if/else, `ROUND_CARD_COPY` voice scan | **Heavy rewrite** — `window.__mzRoundCard` is retired in favor of `window.__mzFightLog`; every region/structural assertion needs re-pointing |
| `test/unit/shell-input-guards.test.js` | Every §6.3 button id wired through `guardTap`, the `guard: true` occurrence count (currently "exactly twice"), the settle-clause placement, the zero-transition/animation-token guarantee | **Moderate rewrite** — button id list changes completely (new grid/submenu ids replace `a-strike`/`a-potion`/etc.); `guard: true` count likely increases (foe retarget + any new `renderCarriedList` hosts) |
| `test/unit/shell-fight-gate.test.js` | `window.mzFight` dispatch, `C.pending` gates in both `renderEncounter` and keydown, zero `awaitingFight`, `window.__mzCanCast` bridge, always-visible Use/Sing/Scroll buttons, `CONDITION_COPY.ward`/`afraid` chip copy | **Moderate rewrite** — the `C.pending` gate moves out of the combat-panel branch into the new MAJOR OVERLAY branch; the always-visible-button assertions need re-pointing at the new submenu rows |
| `test/unit/shell-loot-screen.test.js` | The loot-branch position (after beats/won, before joiner), `window.__mzBagUsage`/`window.__mzLootCompare` bridges, `renderCarriedList`'s `lootEquip`/`lootTake`/`lootLeave` wiring, the four LOOT-04 negative greps | **Light-to-moderate** — loot screen "folds into the same screen" per CSCR-07; verify the branch-order assertions and restyle-only vs structural changes |
| `test/unit/shell-toast-wiring.test.js` | Import lines, `dispatchWithToasts`'s routing region shape, the `toastsForAction` limit-option pin, full-health block toast count, `window.mzToast` singleton | **Light** — mostly still valid since out-of-combat toasts are explicitly UNCHANGED this phase (CONTEXT.md: "Out-of-combat toasts remain until Phase 35"); the in-combat half of routing changes |
| `test/unit/foe-effect-chip.test.js` | Condition-chip label-chain ordering, the `afraid`/no-`phobia`-branch assertions | **Light** — condition chips are presentation-only and this phase mainly restyles the foe-card status display; verify chip SOURCE (`foeStatusBadges`, `mazeworld.html:4967-4984`) is still consulted the same way |
| `test/unit/shell-party-camp.test.js` | Party-camp-related shell wiring (per CONTEXT.md: "unchanged unless the panel touches it") | **None expected**, but confirm at plan time — Make Camp is a Phase 35 concern, not Phase 34 |
| `test/unit/round-card-worst-case.test.js` | 400-seed-per-scenario measurement of round-card line/char counts vs. the toast host cap | **Rewrite the target, keep the method** — per CONTEXT.md: "→ log line count = folded count" — re-measure against `window.__mzFightLog` instead of `window.__mzRoundCard` |
| `test/unit/toastsCoverage.test.js`, `test/unit/toastTable.test.js`, `test/unit/formatEventsCoverage.test.js` | `TOAST_FOR`/`EVENT_NARRATION` coverage guards, the `REFUSAL_TYPES`-shaped manifest | **None-to-light** — these are engine-event-vocabulary guards, not shell-structural; should stay green untouched unless `toastsForAction` itself is extended (Pitfall 1, option 2) |
| `test/unit/oracleLogViewModel.test.js` | The pure split/reverse function this phase should reuse | **None** — stays as-is; if this phase's fight-log logic diverges from it meaningfully, consider whether to adapt `oracleLogViewModel` itself (in which case this file DOES need new cases) or build a sibling function |
| `test/unit/spell-menu-mirror.test.js`, `test/unit/grimoireViewModel.test.js`, `test/unit/characterSheetViewModel.test.js` | The `canCast` mirror, grimoire "Needs level N" text, TO HIT range text | **None expected** — these back the SPELLS submenu's content but the underlying view-models aren't changing, only their consumer markup |

**New tests to add** (per CONTEXT.md's own list, confirmed as genuinely new coverage, not overlapping any file above):
- Layout source assertion: three bands (header/middle/action-area), order foes → YOUR LOT → log.
- Four-action grid + ABILITIES-fallback-label source assertion (SPELLS vs ABILITIES per class).
- Submenu contents per class (Fighter/Bard/MU/Thief) — behavioral, likely against `grimoireViewModel`/`renderCarriedList`/a new menu view-model.
- Fight log: newest-first ordering, tap-reveal toggle behavior, dull-vs-narrative tone partition (mirroring the existing `destinationFor`-style test but retargeted).
- YOUR LOT with 0/1/3 joiners including `overflow-x` — MUST use synthetic `state.party` fixtures (Pitfall 10), not real `addPartyMember` calls.
- Over-panel three variants (win/flee/death) — structural + voice scan.
- Voice scan of every new literal string this phase introduces (mirroring the `shell-round-card.test.js` pattern of importing `BANNED`/`ALLOWLIST` from `content/safety-wordlist.js` directly, since `test/voice/safety-scan.test.js` only auto-covers `EVENT_NARRATION`/`TOAST_FOR`/etc., NOT literal strings embedded in `mazeworld.html`).

## Executor Gate (CSCR-09, verified commands)

```bash
npm test                                                    # baseline 1955/1955 as of Phase 33 close (verify current count at plan/execute time — it may have shifted)
npm run build:www                                           # must exit 0
git diff -- engine content test/parity                      # must be empty (no output)
git hash-object test/parity/prototype-master.js.txt         # must equal a1f4d0dc29782218d8e5aab65bc5989c33f917f0 (verified live via this exact command)
```
No `jq` — see Pitfall 9. All acceptance-criteria checks in this codebase use `grep -c`/`node --test`/`node -e` patterns; follow that convention for any new plan-level acceptance criteria.

## Sources

### Primary (HIGH confidence — direct code inspection, this session)
- `mazeworld.html` (7080 lines) — `renderEncounter` (`:5026-5510`), `dispatchWithToasts` (`:6356-6378`), `engineCombatAction`/bridges (`:6835-6901`), `noteCombat` (`:6258-6302`), guard helpers (`:4860-4961`), `renderCarriedList` (`:3549-3665`), keydown handler (`:5763-5802`), DOM skeleton (`:1379-1399`), `#enc-body p .roll{display:none}` (`:639`), fonts (`:35-56`), `prefers-reduced-motion` (`:756`)
- `engine/combat.js` — `startCombat` foe roster shape (`:153-217`)
- `engine/state.js` — `PARTY_CAP = 1` (`:50`), `addPartyMember` (`:66-69`)
- `src/browser/toasts.js` (1355 lines) — `PRIORITY`/`MAX_TOASTS`/`CARD_EVENTS`/`NARRATIVE_ACTIONS` (`:47-75`), `narrativeToastText`/`ROLL_SPAN_RE` (`:108,139-145`), `toastsForAction` (`:832-865`), `TOAST_FOR` (`:867+`)
- `src/browser/eventNarration.js` (732 lines) — `EVENT_NARRATION` entries for `struck`/`strikeMissed`/`spellThrown`/`fled`/`parleyRolled`/etc. (`:178-326`), `narrateEvent` (`:718+`)
- `src/browser/viewModels.js` — `oracleLogViewModel` (`:358-396`, confirmed DEAD via repo-wide grep), `grimoireViewModel` (`:306`), `characterSheetViewModel` (`:235`)
- `src/browser/engineAdapter.js` — `dispatch`/`formatEvents` (`:376-441`)
- `content/bestiary.js` — foe content shape confirming `sz`/`i`/`sp.note` field names
- `test/unit/shell-round-card.test.js`, `shell-input-guards.test.js`, `shell-loot-screen.test.js`, `oracleLogViewModel.test.js` — existing pin patterns and `REFUSAL_TYPES` manifest
- `design/Mazeworld Combat Panel.dc.html` — the combat panel spec (template + trailing style-object comment)
- `design/Mazeworld Map Panel.dc.html` — the MAJOR OVERLAY spec (`:81-93`, `:132-138` of the trailing comment)
- `.planning/milestones/v1.3-phases/{29,31,32,33}-*/{*-SUMMARY.md}` — the exact prior-phase decisions this phase builds on
- Live command execution this session: `git hash-object test/parity/prototype-master.js.txt` → `a1f4d0dc29782218d8e5aab65bc5989c33f917f0`; `npm test` count referenced from `33-03-SUMMARY.md`'s own verified total (1955/1955)

### Secondary / Tertiary
None — no web research was performed (all search-provider flags are `false` in `.planning/config.json`, and this phase's domain is entirely internal-codebase-grounded).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing modules read directly.
- Architecture: HIGH for the routing seam and DOM structure (read directly); MEDIUM for the MAJOR OVERLAY's exact placement (a genuine open design question, flagged as Assumption A1/Open Question 2).
- Pitfalls: HIGH — every pitfall cites a specific line number, an existing test assertion, or a prior phase's documented SUMMARY finding (e.g. the `/*` comment-stripper bug is a REPEATED, previously-encountered issue, not speculation).

**Research date:** 2026-09-16
**Valid until:** Effectively pinned to the current commit (`a349742`) — this research is code-grounded, not time-sensitive; re-verify line numbers if any other phase/commit lands on `mazeworld.html` before this phase executes.
