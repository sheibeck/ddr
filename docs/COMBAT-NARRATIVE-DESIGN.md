# Combat Narrative & Input Design (Phase 30) — survey, scorecard, and Phase 32 build contract

This document is the CMBUI-01 deliverable: a decision-ready survey of combat-feedback interaction patterns, a weighted scorecard, a recommended design (the Round Card) with tradeoffs stated against every alternative, a fully specified runner-up (the Guarded, Bundled Toast), and the Phase 32 build contract those two designs are scored against. **§4 is a RECOMMENDATION, not a decision** — the actual pick is recorded in §7 after the orchestrator's ratification pause with the user. Phase 31 stays engine-only and does not touch this surface; Phase 32 builds the ratified design from §6. Product name in prose throughout: **Delve, Die, Repeat**.

**Citation legend:** a `CITED` tag names a URL actually read during this phase's research (one URL per tag; a claim needing two sources carries two tags). An `ASSUMED` tag marks genre knowledge / training-data familiarity, with no URL read this session.

---

## 1. Current state — what the player sees today

### 1.1 The toast system

Verified live by importing `src/browser/toasts.js` and `src/browser/eventNarration.js` (`node --input-type=module -e "..."`) rather than copied from an older document:

| Constant | Live value | Purpose |
|---|---|---|
| `TOAST_FOR` | **199** | Every toasting event type's `(e, ctx) => {text, tone, priority}` builder |
| `ORACLE_ONLY` | **20** | Events with no toast (already shown by a dedicated screen/HUD field, or pure roll/step detail) |
| `FEATURE_EVENTS` | **66** | The class/sub-class/race feature + refusal manifest — a strict subset of `TOAST_FOR` |
| `MAX_TOASTS` | **4** | Hard visible cap after aggregation/dedupe/priority-sort |
| `PRIORITY` | `{block:0, you:1, them:2, feature:3, other:4}` | Sort order — refusals surface first, never dropped by the cap |
| `CARD_EVENTS` | `{floorChanged, leveled}` | The only move-path events that still earn the dismissible "Move on" card |
| `NARRATIVE_ACTIONS` | `{move, camp, resolveJoiner}` | Action types whose toasts carry the Oracle's own stripped sentence instead of terse table text |
| `TOAST_BASE_MS` / `TOAST_PER_CHAR_MS` / `TOAST_CAP_MS` / `TOAST_STACK_BONUS_MS` | `3000` / `60` / `9000` / `1200` | `toastLifetime(len, visible) = min(9000, 3000 + 60·len) + 1200·clamp(visible, 0, 3)` — worst case a toast lingers 9000 + 3600 = **12,600 ms** when three others are already stacked |

`toastsForAction(type, events, ctx)` is the per-action pipeline that already does real folding work before anything reaches the DOM: `encounterStart` folds `encounterStarted` and its same-action followers into one toast; `enemyRound` groups `struckByFoe`/`foeMissed` by foe name (**3+ distinct foes collapse into one toast**) and `memberStruck`/`foeMissed(member)` separately; `yourRound` groups `struck`/`strikeMissed` by target; `spellChain` folds `spellThrown` → outcome (3+ targets collapse too); `fleeChain`/`parleyChain`/`chestChain` fold a roll event into its outcome; `killFold` appends "· felled" to the toast whose target a still-unconsumed `foeKilled` names; everything left maps through `TOAST_FOR` directly; results are deduped by type, sorted by `PRIORITY`, and **sliced to `MAX_TOASTS = 4`**.

REQUIREMENTS.md's own v1.3 grounding row records 189 toast types — that number is stale; live re-verification this session found 199 because later phases (armor outcomes, loot events) added entries since that grounding note was written. This doc uses the live count throughout.

### 1.2 renderEncounter and the encounter overlay

`renderEncounter()` (`mazeworld.html`) owns every combat-time surface as a sequential set of early-return branches, checked in this order: `S.dead` (death card) → `S.won` (victory card) → `S.beats` (floor-change/level-up "Move on" card, or the DR17 `awaitingFight` ambush-preview roster with its single Fight! button) → `S.pendingLoot` (Phase 29's loot card) → `S.pendingJoiner` (accept/decline) → `S.pendingFind` (take/leave, or the full-bag drop-shelf chooser) → `S.store` → else the live combat panel (foe roster, the `awaitingFight` gate, the 1–7 action bar).

`#enc-panel` is `.mw-overlay`: `position:absolute; inset:0` inside `.mazebox` — the SAME positioned ancestor that also contains `.mazefoot`'s D-pad + Make Camp bar. **The D-pad is fully covered — for hit-testing too — whenever any encounter surface is active**; there is no tap-through path from an overlay button to the D-pad today. `hasActiveEncounter()` is the single predicate gating both the overlay's visibility and `window.move`'s input guard: `S.dead || S.won || S.combat || S.store || S.pendingJoiner || S.pendingFind || (S.pendingLoot?.length) || (S.beats?.groups?.length)`.

`#mw-toast-host` is `position:fixed; top:calc(102px + safe-area-inset-top)` — it floats near the **TOP** of the screen, not near the D-pad. The existing positional precedent for mis-tap avoidance is DR16 Fix 4: the beats "Move on"/"Next" button renders into a dedicated header slot (`#enc-dismiss-slot`, top-right), "keeping it clear of the D-pad zone" — a fixed-position choice, not a time-gated one, and it predates the loot/joiner/find cards, which still render their primary actions in the bottom `.actions` row.

The Phase 29 loot card (`window.__mzLootReport`) is the already-shipped proof of the batched-summary pattern: `noteCombat()` hands the end-of-fight report to the loot card instead of building a `S.beats` "Move on" card, so the player sees the combat report AND the take/leave decision folded into ONE card, explicitly avoiding a dismiss-then-continue chain. §4 generalizes this exact pattern to every round.

### 1.3 The Oracle log

`EVENT_NARRATION` has **218 entries** — the full-sentence, dice-included narration for every engine event type. `TOAST_FOR` (199) + `ORACLE_ONLY` (20) = 219, a near-total overlap of the same event universe (the 1-entry gap is bookkeeping, not a leak — a handful of pure-bookkeeping events narrate but never toast or vice versa). `oracleLogViewModel(entries, diceMode)` reverses the accumulated log to newest-first, with a `revealable`/`revealedByDefault` flag per row driven by the dice-reveal setting. The Oracle (`#screen-oracle`) is a full-tab screen, not an overlay; opening the ORACLE tab always calls `window.__mzOracleToNewest()`, landing on the most recent line.

### 1.4 Round event volume

`PARTY_CAP = 1`, `FOE_CAP_MAX = 4` (deep-floor cap). `afterPlayerAction` runs, per dispatched player action: the player's own strike/spell-chain (1–3 events) → `allyTurn` (a summoned ally, 0–2 events) → `alliesTurn` (the one persistent party member, 0–3+ events) → `foeTurn` (up to 4 foes, each potentially a summon-join, a regen/acid tick, an asleep/flee check, an ability resolution with its own chain, or multiple melee swings) → **possibly a second `foeTurn`** if the foes win the round's freshly-rolled initiative. A busy round (3–4 foes, one frenzied or multi-attack, plus a party member and a spell cast) can emit **10–15 raw engine events** in one dispatched action. `toastsForAction`'s grouping collapses this to at most `MAX_TOASTS = 4` visible toasts — but that is still up to four independently-timed (3–12.6 s lingering each), independently-dismissible cards competing for attention every round. This is the CMBUI-02 complaint restated in numbers, still present even after the existing aggregation work.

### 1.5 What actually mis-taps (code-read correction)

**The overlay already covers the D-pad, so there is no bleed-through path.** Grep across `mazeworld.html` for `pointerdown|setTimeout|armed|pointer-events|disabled=` finds zero card-button guards — every `.onclick` handler is wired synchronously in the same tick `#enc-body.innerHTML` is rebuilt. The real mis-tap mechanism is **rapid re-render coordinate collision**, not D-pad bleed-through: (a) a fast second tap lands on a NEW button rendered at the same screen coordinate as an OLD button from the previous render (round N's "Move on" at position X; round N+1's "1·Strike" also near X); or (b) an overlay closes synchronously inside a click handler, so an eager double-tap's second touch reaches the now-exposed, now-live D-pad the instant `hasActiveEncounter()` flips false. The one in-source use of the word "armed" describes the death card's CONFIRM button as deliberately un-guarded ("a single armed CONFIRM") — i.e. "armed" there means *always clickable*, the opposite of a safety gate. `touch-action:manipulation` is already set on the canvas, so this shell has already eliminated the legacy 300 ms browser tap-delay; any new arm-delay guard must therefore be a deliberate JS `Date.now()` timestamp check, not an accidental side effect of an un-fixed WebView quirk.

### 1.6 Tests pinning today's behaviour

RESEARCH.md's assumed baseline table read 15 + 28 + 38 + 8 + 9 = **98**. Re-measured live this session via `node --test <file>` per file (the project's actual test runner, not a `grep -c "test("` line-count, which over/under-counts on lines containing `.test(...)` regex calls unrelated to test definitions), the real counts differ:

| Test file | Test count | What it pins |
|---|---|---|
| `test/unit/narrativeToasts.test.js` | 15 | `narrativeToastText` HTML-stripping/entity-decoding contract |
| `test/unit/shell-toast-wiring.test.js` | 21 | The shell's toast-host wiring, dismiss/lifetime behavior |
| `test/unit/feedback-payload.test.js` | 37 | Toast/Oracle payload shapes for FEED-01..06 events |
| `test/unit/oracleLogViewModel.test.js` | 8 | `oracleLogViewModel`'s reverse/reveal-mode contract |
| `test/unit/shell-oracle-panel.test.js` | 8 | The Oracle tab's DOM wiring and "opens at newest" behavior |
| **Total** | **89** | — |

This doc uses the live-verified **89**, not RESEARCH's stale 98, per this plan's own re-verify-before-writing instruction. Additionally, 25-05's `toastsCoverage`/`toastTable` tests assert the `TOAST_FOR`/`ORACLE_ONLY`/`FEATURE_EVENTS` partition invariants (every event type in exactly one bucket; `FEATURE_EVENTS ⊆ TOAST_FOR`, disjoint from `ORACLE_ONLY`) — a redesign that keeps events flowing through `toastsForAction`'s existing groupers (retargeting only the output) preserves these invariants structurally. `npm test` baseline, run fresh this session: **1593/1593 passing, 0 failures**.

---

## 2. Survey — six patterns against the criteria

### 2.1 Shipped examples per pattern

**1. Scrolling combat log / ledger** — a persistent, append-only list of short event lines inside or beside the combat panel; the classic roguelike message-log convention, sometimes gated by a `--more--` prompt.
- Dungeon Crawl Stone Soup / traditional roguelike message logs [ASSUMED] — the genre-standard pattern: every action appends a terse line, long bursts trigger a `--more--`-style pause.
- Cogmind's message log [ASSUMED] — one of the more elaborate combat-log UIs in the genre (color-coded, filterable), cited by reputation.
- Generic roguelike log architecture [CITED: https://www.yosenspace.com/posts/lets-code-roguelike-tutorial-part7-enhancing-ui.html] — confirms the standard implementation shape: append per event, render a bounded window of the most recent lines.

*Fit for this game:* structurally this pattern already IS the Oracle. A second scrolling log inside the combat panel would either duplicate the Oracle (forbidden by CONTEXT: "never a second source of truth") or, if scoped to "only this round, cleared each round," become identical to Pattern 2 with a list layout instead of a paragraph layout — scored below as the "duplicate-risk" default shape.

**2. Batched round-summary card** — one narrative block per round, read all at once, dismissed or simply superseded by a single action.
- Darkest Dungeon's narration + round-result presentation [CITED: https://darkestdungeon.wiki.gg/wiki/Combat_Mechanics_(Darkest_Dungeon)] — combat proceeds in SPD-ordered rounds; the narrator delivers a scripted line per notable outcome layered on top of the visual result, reading as one dramatic beat per round.
- Darkest Dungeon: Tablet Edition [CITED: https://apps.apple.com/us/app/darkest-dungeon-tablet-edition/id1199831446] — confirms the same turn-based/narrated combat ships unmodified on touch-first tablets.
- Fire Emblem / Advance Wars-style battle-result panels [ASSUMED] — genre-standard "combat forecast then result" panel: damage dealt/taken, crit, kill, all in one card before returning control.
- Into the Breach's telegraphing [CITED: https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-] [CITED: https://interfaceingame.com/games/into-the-breach/] — pre-emptive rather than a round summary, but directly relevant to "narrative coherence": showing a full exchange's outcome as ONE integrated readout is the same "one coherent place" principle applied to the future instead of the past.

*Fit for this game:* structurally identical to what Phase 29 already shipped for the loot screen (fold the report + the decision into ONE card). Extending it to every round is the lowest-novelty, lowest-risk option of the six.

**3. Auto-advance with tap-to-pause / speed control** — the round plays itself without requiring a tap; the player can pause or set a speed dial.
- Hoplite [CITED: https://en.wikipedia.org/wiki/Hoplite_(video_game)] [CITED: https://medium.com/@scott_williams/hoplite-7c190d3f6ecc] — deliberately avoids the "bump-attack-over-and-over" pacing problem by making movement itself the decision (attacks resolve instantly on a move-into-enemy tap). Not classic auto-advance, but resolves outcomes with zero extra confirmation taps by default; its opt-in "Fat Finger Mode" (an extra confirmation tap, OFF by default) is the closest shipped analog to a deliberate mis-tap guard — the developer's own default favors speed over confirmation.
- Card Crawl / Dicey Dungeons [ASSUMED] — idle/auto-battle-adjacent titles.
- Generic idle/auto-battle speed toggles [ASSUMED] — 2x/4x speed and "skip animation" settings, a well-known mobile-gacha/idle-RPG convention.

*Fit for this game:* a timer-paced narrative is the worst fit for "zero taps needed to READ a round" — it inverts the failure mode from "must dismiss to see the next line" to "might not finish reading before it auto-advances." It also requires an entirely new pause/speed state machine this shell doesn't have — the highest net-new implementation cost of any pattern.

**4. Ticker / marquee / floating combat text** — numbers or short phrases float over the action, or scroll through a fixed marquee strip; sometimes paired with tap-to-advance dialogue boxes.
- Diablo-style floating damage numbers [ASSUMED] — genre-iconic, numbers pop over the struck unit, color-coded by type/crit.
- Pokémon-style text boxes with per-message taps [ASSUMED] — the classic "A wild PIDGEY appeared! ▼" tap-to-advance box.
- MMO floating combat text (WoW-style) [ASSUMED] — the canonical "numbers fly up and fade" implementation at scale.

No URL was read for this pattern this session — all three examples are training-data genre familiarity, stated plainly rather than hunting for links.

*Fit for this game:* floating numbers carry essentially no room for the sarcastic-voice identity requirement (a "-4" glyph cannot be deadpan), and this shell's `<canvas>` is a game-grid renderer, not a typography layer — a floating-text overlay would be new DOM/canvas surface area with no reuse of the existing toast infrastructure. The tap-to-advance text-box variant directly fights "zero taps to read."

**5. Mis-tap guards (arm delay, hit-zone separation, distinct gesture)** — not a narrative-delivery pattern on its own; a cross-cutting safety layer bolted onto any of the above. Scored here as "guards retrofitted onto today's toast/button system, with no change to how the narrative itself is delivered."
- Hoplite's Fat Finger Mode [CITED: https://en.wikipedia.org/wiki/Hoplite_(video_game)] — an opt-in second-tap confirmation on movement/attack taps; the clearest shipped precedent for "add a deliberate confirmation step to prevent an accidental fatal tap" in this exact genre, though it costs an extra tap and is opt-in, not default.
- Material Design touch-target guidance [CITED: https://m1.material.io/usability/accessibility.html] [CITED: https://support.google.com/accessibility/android/answer/7101858?hl=en] — the canonical Android spec: minimum 48×48dp touch targets, interactive elements separated by ≥8dp. This project's action bar already tracks this (existing `renderEncounter` comments reference "≥48dp min-height") — the gap is TIMING, not sizing.
- The 300 ms tap-delay history / `touch-action:manipulation` [CITED: https://developer.chrome.com/blog/300ms-tap-delay-gone-away] — historically mobile browsers waited ~300–350 ms after `touchend` before firing `click`; this project's canvas already sets `touch-action:manipulation`, so the legacy delay is already eliminated here — any new guard is deliberate, not incidental.

*Fit for this game:* orthogonal rather than competing — it fixes thumb-safety without touching coherence at all if applied alone. §4 folds this pattern in as a required layer on top of whichever narrative-delivery pattern wins.

**6. Today's per-event toast stack (baseline)** — documented exhaustively in §1. Included here only for the scorecard row.

### 2.2 Survey table

| Pattern | Examples | Taps-to-move-on | Coherence | Thumb-safety | Oracle fit | Voice room | Impl. cost | Pacing |
|---|---|---|---|---|---|---|---|---|
| 1. Scrolling log / ledger | DCSS, Cogmind, roguelike log tutorial | Zero extra (always visible) | Weak — risks duplicating the Oracle | Neutral — no button change | Weak — same shape as the Oracle itself | Moderate — full sentences possible | Low-moderate — new persistent list DOM | Neutral |
| 2. Batched round-summary card | Darkest Dungeon, DD Tablet, Fire Emblem, Into the Breach | Zero extra, one tap at real decision gates | Strong — one coherent block per round | Needs Pattern 5 bolted on to be fully safe | Strong — a view of the same event stream, never a second writer | Strong — full-sentence room | Moderate — reuses existing groupers, new DOM target | Good — tunable |
| 3. Auto-advance / tap-to-pause | Hoplite, Card Crawl/Dicey Dungeons, idle/auto-battle toggles | Zero taps but a forced timer | Weak — risks not finishing before advance | Weak — new state machine, new surfaces | Neutral | Moderate | High — new pause/speed subsystem | Neutral-weak |
| 4. Ticker / floating text | Diablo numbers, Pokémon text boxes, MMO floating text | Tap-to-advance variant costs a tap per line | Weak — fragmented, not one place | Moderate — no shared button surface | Neutral | Very weak — no room for sarcasm | Moderate — new canvas/DOM typography layer | Neutral |
| 5. Mis-tap guards only (bolted onto baseline) | Hoplite Fat Finger Mode, Material touch-target spec, 300 ms tap-delay history | Unchanged from baseline (still up to 4 toasts) | Unchanged from baseline — guards don't fix coherence | Strong — the guard layer's whole purpose | Neutral — unaffected | Neutral — unaffected | Low — additive timing checks only | Neutral |
| 6. Today's toast stack (baseline) | this project's own `toasts.js` / `renderEncounter` | Weak — up to 4 independently-dismissible toasts | Weak — the documented problem statement | Weak — zero guards exist | Good — already avoids Oracle duplication | Good — existing lines already carry voice | Zero — already shipped | Neutral |

---

## 3. Scorecard

### 3.1 Weights (fixed before scoring)

| Criterion | Weight | Justification |
|---|---|---|
| Taps-to-move-on (CMBUI-03) | 20% | A hard CONTEXT constraint — weighted with the other two hard constraints at the top of the scale |
| Narrative coherence per round (CMBUI-02) | 20% | The actual complaint this phase exists to fix — equal weight to the other hard constraints |
| Thumb-safety (CMBUI-04/05) | 20% | The third hard constraint; all three CMBUI mechanical requirements are weighted identically at 20% each = 60% of the total, reflecting that they are non-negotiable per CONTEXT, not "nice to have" |
| Oracle-remains-the-log fit | 10% | Identity-preserving (never a second source of truth) but not itself a player-facing mechanic — half the weight of the hard constraints |
| Room for the sarcastic voice | 10% | Core project identity (CLAUDE.md), but a pattern that scores low here can often still be WRITTEN around — weighted below the three mechanical hard constraints |
| Implementation cost inside the existing toast/card/beats system | 15% | A solo-dev vanilla-JS shell with a 1593-test suite; a pattern requiring new subsystems (timers, pause states, canvas text layers) carries real risk and time cost this milestone should not absorb lightly |
| 5–10-minute session pacing | 5% | Least differentiating criterion — nearly every pattern can be tuned to fit session length; a tuning knob, not a structural differentiator |

**Weights sum:** 20 + 20 + 20 + 10 + 10 + 15 + 5 = 100 (0.20 / 0.20 / 0.20 / 0.10 / 0.10 / 0.15 / 0.05 = 1.00)

### 3.2 Scores

| Pattern | Taps (.20) | Coherence (.20) | Thumb-safety (.20) | Oracle-fit (.10) | Voice (.10) | Cost (.15) | Pacing (.05) | Weighted total |
|---|---|---|---|---|---|---|---|---|
| 1. Scrolling log/ledger | 5 | 3 | 3 | 2 | 3 | 3 | 4 | 3.35 |
| **2. Batched round-summary card** | 5 | 5 | 4 | 5 | 5 | 5 | 4 | **4.75** |
| 3. Auto-advance / tap-to-pause | 5 | 2 | 2 | 3 | 3 | 2 | 3 | 2.85 |
| 4. Ticker / floating text | 3 | 2 | 4 | 3 | 1 | 3 | 4 | 2.85 |
| 5. Mis-tap guards only (bolted onto baseline) | 2 | 2 | 5 | 3 | 3 | 4 | 3 | 3.15 |
| 6. Today's toast stack (baseline) | 2 | 2 | 2 | 4 | 4 | 5 | 3 | 2.90 |

Every total in this table is Σ(score × weight) computed directly from the row's seven scores against §3.1's weights.

Worked arithmetic — **row 2 (winner):** 5×.20 + 5×.20 + 4×.20 + 5×.10 + 5×.10 + 5×.15 + 4×.05 = 1.00 + 1.00 + 0.80 + 0.50 + 0.50 + 0.75 + 0.20 = **4.75**.
Worked arithmetic — **row 6 (baseline):** 2×.20 + 2×.20 + 2×.20 + 4×.10 + 4×.10 + 5×.15 + 3×.05 = 0.40 + 0.40 + 0.40 + 0.40 + 0.40 + 0.75 + 0.15 = **2.90**.

**One-line weakest-score justification per pattern:**
- Pattern 1 loses on Oracle-fit (2) — a persistent in-panel log, in its natural default shape, structurally duplicates the Oracle's own role, which CONTEXT explicitly forbids.
- Pattern 2 loses least anywhere — its lowest score (4, thumb-safety) reflects only that ANY card-based UI still needs Pattern 5's guard layer bolted on to reach a perfect 5; nothing about the pattern itself is unsafe.
- Pattern 3 loses on coherence and cost (2/2) — a timer-paced surface risks not giving the player time to read before advancing, and requires a wholly new pause/speed state machine.
- Pattern 4 loses on voice (1) — floating numbers/marquee text carry essentially zero room for the deadpan-sarcastic sentence style that is this project's core identity.
- Pattern 5 loses on taps/coherence (2/2) — a guard layer alone does nothing to fix the "stack of individual toasts" complaint; it only makes the existing stack safer to interact with.
- Pattern 6 (baseline) loses on taps/coherence/thumb-safety (2/2/2) — this row IS the documented problem statement; its only strengths are zero migration cost (5) and that its existing toast lines already carry voice (4) and already avoid Oracle duplication (4).

**Verdict:** Pattern 2 (Batched round-summary card) wins clearly at 4.75/5, combined with Pattern 5's guard layer as a MANDATORY addition (this pushes Pattern 2's thumb-safety from 4→5, making the combined recommendation the only option scoring at or near the ceiling on all three hard constraints simultaneously). The runner-up is the Pattern 5+6 hybrid — a "Guarded, Bundled Toast" — scored 3.15 as Pattern 5 alone, materially higher on coherence once bundling (folding a round's toasts into ONE) is counted; kept as the genuine second choice because it is the lowest-risk, lowest-test-churn path if the ratification pause favors minimizing change over maximizing coherence.

---

## 4. Recommended design — the Round Card

### 4.1 Concept

Extend the exact machinery Phase 29 already proved for the loot screen — fold a round's grouped events into ONE always-visible narrative block inside the existing combat panel — to every round, not just encounter-clear. Reuse `toastsForAction`'s existing pure groupers (`enemyRound`, `yourRound`, `spellChain`, `killFold`, etc.) unmodified in their FOLDING logic; retarget their OUTPUT from an array of timed toast objects to a single persistent DOM block that `renderEncounter()` rebuilds every render, the same way it already rebuilds the foe roster and action bar. The block lives in the exact vertical position `S.lastExchange`'s "Last exchange" footnote occupies today — below the always-visible foe roster, above the action bar — replacing that footnote. No new overlay layer, no new z-index, no change to where `#enc-panel`/`.mw-overlay` sits relative to `.mazebox`/`.mazefoot`.

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

### 4.2 Hard-constraint compliance

| Constraint | Requirement | How the Round Card meets it |
|---|---|---|
| **Tap budget** | ≤1 deliberate tap to move on after a round/encounter; zero taps to read | The narrative is always visible in a fixed slot — reading costs nothing; every existing decision gate (loot, joiner, death, floor-change) already resolves in 1 tap and is unchanged |
| **Oracle completeness** | The Oracle stays complete and unabridged; the new surface is a VIEW, never a second writer | The round card's grouped text derives from a copy of the same `events[]` array the Oracle's `logLine` calls already consume independently — it never writes into `S.log` |
| **No double-reporting** | In-combat per-event toasts are replaced; no event reported twice; out-of-combat toasts stand | In-combat outcome events route to the round card instead of a toast; refusals (`PRIORITY.block`) stay toasts as direct button responses; out-of-combat move/camp/find toasts are untouched |
| **Button guards** | No shared hit zone; ~250 ms arm delay; nothing dismisses from a map/D-pad tap | `ARM_DELAY_MS = 250` gates every freshly-rendered decision button; `.mw-overlay` already structurally prevents any shared hit zone with the D-pad; the round card has no tap-to-dismiss gesture at all |

### 4.3 Tradeoffs against each alternative

| Alternative | Why the Round Card wins over it |
| --- | --- |
| Pattern 1 (scrolling log) | Avoids duplicating the Oracle — a round-scoped block that clears each round (not an ever-growing list) sidesteps the "second source of truth" problem Pattern 1 falls into in its natural default shape |
| Pattern 3 (auto-advance) | No new timer/pause state machine; reading pace stays player-controlled — "zero taps to READ," not "zero seconds to read before it vanishes" |
| Pattern 4 (ticker/floating text) | Full sentence room for the sarcastic voice; reuses existing text-rendering DOM instead of a new canvas/overlay typography layer |
| Pattern 5 alone (guards, no narrative change) | Guards alone don't fix CMBUI-02; the Round Card design INCLUDES Pattern 5's guards as a mandatory layer, so it strictly dominates a guards-only approach |
| Pattern 6 (today's baseline) | This is the documented problem statement itself — the Round Card fixes coherence (one block vs. up to four toasts) and thumb-safety (adds guards that don't exist today) at moderate implementation effort |
| Runner-up (Guarded Bundled Toast) | Better narrative coherence — an inline block anchored to the foe roster reads as PART of the combat state, not a transient overlay competing for attention — and better Oracle-adjacency, since a persistent "this round" block visually mirrors "the log, zoomed to now" more than a floating toast does |

What the Round Card gives up versus the runner-up: more test re-pinning (a new DOM block inside `renderEncounter` rather than a bundling-count update) and a new region inside `renderEncounter` rather than reusing `#mw-toast-host` unmodified.

---

## 5. Runner-up — the Guarded, Bundled Toast

### 5.1 Concept

Keep the floating-toast aesthetic and the fixed-top `#mw-toast-host` position, unaffected by combat panel layout. Bundle ALL of a round's toasts into exactly ONE toast instead of up to `MAX_TOASTS = 4` (MAX_TOASTS effectively becomes 1 for in-combat events only). Apply the same `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` guards to the action bar underneath. Tap budget is identical to §4 (zero extra mid-round, one tap at every existing decision gate) — bundling changes toast COUNT, not tap count. Re-derive `toastLifetime()`'s constants against the bundled toast's typical (not worst-case) character count (RESEARCH Open Question 2) so a slow reader is not cut off before finishing a denser, bundled line.

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

### 5.2 Hard-constraint compliance

| Constraint | Requirement | How the Guarded, Bundled Toast meets it |
|---|---|---|
| **Tap budget** | ≤1 deliberate tap to move on; zero taps to read | Tap count is met identically to §4, but "zero taps to read" is weaker — a toast still expires on a timer (even at the 9000 ms cap), so a slow reader can be cut off; mitigated by re-deriving `toastLifetime()`'s constants against the bundled toast's typical length |
| **Oracle completeness** | The Oracle stays complete and unabridged; the new surface is a VIEW | Unchanged — the bundled toast's text is still derived from the same event stream the Oracle consumes, never a second writer |
| **No double-reporting** | In-combat per-event toasts are replaced; no event reported twice | Met by routing every in-combat event through the same bundling pipeline into the one toast; refusals stay separate toasts as today |
| **Button guards** | No shared hit zone; ~250 ms arm delay; nothing dismisses from a map/D-pad tap | Identical numbers to §4 — `ARM_DELAY_MS = 250` on the action bar; the toast itself is non-interactive except its own optional tap-to-dismiss |

### 5.3 Why it is second, and when to pick it

Bundling reduces toast count (4→1), which materially helps coherence, but the surface is still a FLOATING, TIMED, AUTO-DISMISSING element positioned away from the foe roster/action context — it does not achieve "zero taps to read" as cleanly as an always-on inline block, and it keeps the toast system as the primary combat-feedback channel rather than promoting the combat panel itself to be self-narrating. The honest case FOR picking it: it is meaningfully cheaper to build (no new DOM block inside `renderEncounter`, no change to where `S.lastExchange` sits), most of the 89 toast/Oracle-pinning tests (§1.6) need only a bundling-count update rather than a structural rewrite, and it preserves the current visual language exactly — the safer fallback if the ratification pause reveals a preference for minimizing change over maximizing coherence.

## 6. Phase 32 build contract

This section is Phase 32's spec for CMBUI-02..06, written for the RECOMMENDED design (§4, the Round Card). Where the runner-up (§5) differs, the difference is called out inline under "If the runner-up is ratified."

### 6.1 Screen anatomy

`#enc-panel`/`.mw-overlay` geometry relative to `.mazebox`/`.mazefoot` is unchanged. The round-narrative block occupies the `S.lastExchange` "Last exchange" slot — below the always-first foe roster, above the `.actions` bar — replacing that footnote. The foe roster is never hidden (§Pitfall 5 in RESEARCH.md): it renders first, always, in every combat-panel branch.

**State: mid-round (Round Card)**
```
┌───────────────────────────────┐
│ Ambush · round 3               │
│ 2 still standing · d20, 14+    │
├───────────────────────────────┤
│ Giant Rat        6/12 hp        │
│ Giant Rat        0/9 hp  dead   │
├───────────────────────────────┤
│ ▸ THIS ROUND                    │
│  You hit the Giant Rat for 4.  │
│  It bites back — 2 dmg.         │
│  The second rat goes down.      │
├───────────────────────────────┤
│ [1·Strike] [2·Potion] [3·Flee] │  <- ARM_DELAY_MS=250 on first paint
└───────────────────────────────┘
```

**State: Fight! gate (ambush preview)**
```
┌───────────────────────────────┐
│ Ambush                          │
├───────────────────────────────┤
│ Giant Rat        12/12 hp       │
│ Giant Rat         9/9 hp        │  <- DR17 awaitingFight roster
├───────────────────────────────┤
│           [Fight!]              │  <- ARM_DELAY_MS=250 on first paint
└───────────────────────────────┘
```

**State: encounter cleared → loot card**
```
┌───────────────────────────────┐
│ Victory                         │
│ Round 3 · +40 gold · +12 XP     │
├───────────────────────────────┤
│ The spoils                      │
│ Rusted Mail · +2 over worn      │
│   [Equip now] [Stow] [Leave]    │
├───────────────────────────────┤
│       [Take all]  [Leave all]   │  <- ARM_DELAY_MS=250 on first paint
└───────────────────────────────┘
```

**State: joiner offer**
```
┌───────────────────────────────┐
│ A wanderer wants to tag along   │
│ Human Fighter · skill level II  │
├───────────────────────────────┤
│ [Take them along] [Leave them] │  <- ARM_DELAY_MS=250 on first paint
└───────────────────────────────┘
```

**State: death**
```
┌───────────────────────────────┐
│ Dead                            │
│ Name, Race Sub, killed by...    │
│ Floor N · day D · SP XP         │
│ epitaph line                    │
├───────────────────────────────┤
│ [Review the Oracle] [Confirm]  │  <- ARM_DELAY_MS=250 on first paint;
│                                  │     Confirm stays deliberately "armed"
│                                  │     (no read-it-first lock) per DR4
└───────────────────────────────┘
```

If the runner-up is ratified: the THIS ROUND block is instead one bundled toast rendered in `#mw-toast-host` (fixed top, unaffected by panel layout); every other frame above (Fight! gate, loot card, joiner offer, death) is identical — those are decision surfaces, not round narrative, and are unaffected by which of §4/§5 is chosen.

### 6.2 Tap budget per state

| State transition | Taps required | What Phase 32 must preserve or change |
| --- | --- | --- |
| Mid-round → next round | 0 extra beyond the chosen action | The narrative is always visible; no Move-on gate is inserted mid-fight — preserved, not reduced |
| Fight! gate → first round | 1 tap on Fight! | The gate itself is Phase 31's business; the button's `ARM_DELAY_MS` guard is Phase 32's |
| Encounter cleared → loot resolved → move on | 1 tap (Take all / Leave all, or per-item then implicitly done) | Phase 29, preserved verbatim |
| Joiner offer | 1 tap (Take them along / Leave them) | Preserved |
| Death | 1 tap Confirm; Review the Oracle is an elective second tap | Preserved; Confirm stays "armed" (DR4), only the new `ARM_DELAY_MS` gate is added |
| Floor change / level-up Move on | 1 tap | Out of CMBUI-02's in-combat scope; must not regress; the guard still applies to the `#enc-dismiss-slot` button |

**Invariant:** no state requires a dismiss-then-continue chain, and the total deliberate taps to leave any surface is 1.

### 6.3 Guard rules

The guards are designed against rapid re-render coordinate collision and the synchronous-dismiss gap (§1.5), not against D-pad bleed-through, which the overlay already prevents structurally.

1. **`ARM_DELAY_MS = 250`** — every freshly rendered decision button (round-card action bar, Fight!, joiner accept/decline, loot per-row and Take all/Leave all, find Take/Leave, death Confirm, the `#enc-dismiss-slot` Move on) records `renderedAt = Date.now()` when `renderEncounter()` builds it, and its handler no-ops (or the button carries `disabled` — Phase 32 picks whichever fits the existing `.disabled` CSS convention) while `Date.now() - renderedAt < ARM_DELAY_MS`.
2. **`DISMISS_SETTLE_MS = 250`** — when `hasActiveEncounter()` transitions true → false, record `lastDismissAt = Date.now()`; `window.move`'s guard gains a second clause refusing input while `Date.now() - lastDismissAt < DISMISS_SETTLE_MS`.
3. **Hit-zone rule** — decision buttons never share the D-pad's hit zone; satisfied structurally today because `.mw-overlay` `inset:0` covers `.mazefoot`, so Phase 32's obligation is to render every decision button INSIDE `#enc-panel` and never introduce one outside the overlay, and to keep the roster/narrative/actions vertical order so the action bar's coordinates stay stable between rounds.
4. **Dismissal rule** — nothing important dismisses on a tap in the map/D-pad region. The round card has NO tap-to-dismiss gesture at all (it is rebuilt by the next render, never dismissed); every other surface dismisses only via its own buttons; Phase 32 must not add any tap-anywhere-to-dismiss behaviour.

The "distinct gesture" technique (CONTEXT's third named option) is explicitly not adopted: Hoplite's Fat Finger Mode costs an extra tap; the two timing guards above reach safety at zero tap cost.

**Both guards are `Date.now()` timestamp checks and must never depend on a CSS transition or animation duration** — the blanket `prefers-reduced-motion` rule (`mazeworld.html` line 773) sets `transition:none` and `animation:none` for those users and would silently zero a transition-based guard. This is a hard implementation constraint, not merely a suggestion.

The sibling constants this pair joins are `TAP_MOVE_THRESHOLD_PX = 10` and `TAP_MAX_DURATION_MS = 350` in `src/browser/controls.js` — module placement for `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` is Phase 32's call.

If the runner-up is ratified: identical numbers on the action bar; the bundled toast itself needs no arm delay (non-interactive except its own optional tap-to-dismiss, which must carry `touch-action:manipulation` like `.mw-toast`).

### 6.4 Toast-vs-round-surface routing

| Event family | Examples | In combat | Out of combat | Rule |
| --- | --- | --- | --- | --- |
| Player outcomes | `struck`, `strikeMissed`, `foeKilled` (via killFold) | Round card | n/a | Folded by `yourRound`/`killFold` |
| Foe outcomes | `struckByFoe`, `foeMissed`, `armorSoaked` and the four Phase 28 armor outcomes | Round card | n/a | Folded by `enemyRound` |
| Party and ally | `memberStruck`, ally strikes and casts | Round card | n/a | Folded by `enemyRound`/`allyCast` sibling handling |
| Spell chains | `spellThrown` → outcome, 3+ targets collapsed | Round card | n/a | Folded by `spellChain` |
| In-combat rolls | flee, parley, chest chains | Round card | n/a | Folded by `fleeChain`/`parleyChain`/`chestChain` |
| Foe abilities and conditions | bolts, drains, debuffs, heals, summons | Round card | n/a | Routed through `TOAST_FOR` directly if not consumed by a grouper |
| Feature events | `FEATURE_EVENTS` (frenzy, backstab, etc.) | Round card | Toast | Existing `FEATURE_EVENTS` set unchanged |
| Refusals and blocks | `strikeRefused`, `fleeRefused`, `noChargesLeft`, `spellNotKnown` (`PRIORITY.block` tier) | Stays a toast | Stays a toast | A refusal is a direct response to the just-tapped button, not round narrative |
| Encounter start | `encounterStarted` and its same-action followers | Round card (first round) | n/a | Folded by `encounterStart` |
| Loot pile events | `lootDropped` (mid-fight), `lootTaken`/`lootLeft` (at the loot card) | Round card / toast | n/a | `lootDropped` joins the round card; take/leave stay toasts as Phase 29 ships |
| Out-of-combat narrative | `move`, `camp`, teleport, find | n/a | Toast unchanged | Phase 25/25.1 rules stand |
| `CARD_EVENTS` | `floorChanged`, `leveled` | n/a | `S.beats` Move on card unchanged | Out of this phase's in-combat scope |

**Every event has exactly ONE in-combat presentation destination — nothing is both toasted and folded into the round card — and the Oracle receives every event regardless of destination.** The 25-05 partition invariants (every type in exactly one of `TOAST_FOR`/`ORACLE_ONLY`; `FEATURE_EVENTS ⊆ TOAST_FOR`) hold structurally if Phase 32 keeps routing through `toastsForAction` and only retargets its output.

If the runner-up is ratified: identical routing; "round card" reads "the one bundled toast."

### 6.5 Oracle behaviour

Unchanged and unabridged: `EVENT_NARRATION`'s 218 entries, full-screen tab, opens at newest via `window.__mzOracleToNewest()`, the dice-reveal setting untouched. The round surface derives its grouped text from a copy of the same `events[]` array the Oracle's own `logLine` calls consume — it is never a second writer into `S.log`. Any Phase 32 change that drops, filters, or summarizes an Oracle line is out of contract.

### 6.6 Phase 28 armor outcomes and the Phase 29 loot card

The four Phase 28 armor outcomes (soaked-with-wear, soaked-without-wear, magic-plate soak, armor gives out) are existing event shapes with `TOAST_FOR`/`EVENT_NARRATION` entries already and fold into the round card through the same grouping path — no new event types, no engine work. The Phase 29 loot card is unchanged by this recommendation: the `noteCombat()` → `window.__mzLootReport` hand-off stays, and the card IS the batched pattern already applied at encounter-clear. The "Last exchange" footnote (`S.lastExchange`) is superseded by the round card in the same slot.

### 6.7 Accessibility

`aria-live="polite"` on a persistent wrapper element that survives `#enc-body`'s `innerHTML` rebuilds — live regions announce reliably only when the region node persists (RESEARCH Pitfall 1); the `#mw-toast-host` region today is `aria-live="polite" aria-atomic="false"`. Reduced motion: the guards are `Date.now()` checks independent of any transition (cross-reference §6.3). Any new tappable element carries `touch-action:manipulation` like `.mw-toast`/`.mw-chip` (Pitfall 3). Buttons keep the ≥48dp min-height and the `.actions` gap (Material 48×48dp / 8dp separation, CITED in §2). Reading speed 12–20 CPS comfortable, 20–25 CPS upper bound (ASSUMED, A5) informs whether the block needs a line cap — Phase 32 should measure a worst-case round (4 foes, frenzied, abilities) against the tuning harness before fixing a cap, keeping `enemyRound`'s 3+-collapse discipline either way. Haptics (`@capacitor/haptics`, already present) may be named as an enhancer here — a light tap on a hit/kill — but is never a decision factor.

### 6.8 Tests Phase 32 will re-pin

RESEARCH.md's assumed table read 15+28+38+8+9 = 98; re-measured live via `node --test` per file, the real total is 89 (§1.6). Phase 32 re-pins against the live numbers below.

| Test file | Tests | Pins today | Round Card impact | Bundled Toast impact |
| --- | --- | --- | --- | --- |
| `test/unit/narrativeToasts.test.js` | 15 | `narrativeToastText` HTML-stripping/entity-decoding | Unchanged — the helper is reused by the round card's own text prep | Unchanged |
| `test/unit/shell-toast-wiring.test.js` | 21 | Toast-host wiring, dismiss/lifetime | Re-pinned for routing — in-combat events no longer produce individual toasts | Re-pinned for bundling — one toast per round instead of per event |
| `test/unit/feedback-payload.test.js` | 37 | Toast/Oracle payload shapes for FEED-01..06 | Re-pinned where a payload assertion checks the toast destination for an in-combat event | Re-pinned for the bundled-count assertion |
| `test/unit/oracleLogViewModel.test.js` | 8 | `oracleLogViewModel` reverse/reveal-mode contract | Unchanged — the Oracle is untouched by either design | Unchanged |
| `test/unit/shell-oracle-panel.test.js` | 8 | Oracle tab DOM wiring, "opens at newest" | Unchanged | Unchanged |
| **Total** | **89** | — | — | — |

The 25-05 `toastsCoverage`/`toastTable` partition invariants (every event type in exactly one of `TOAST_FOR`/`ORACLE_ONLY`; `FEATURE_EVENTS ⊆ TOAST_FOR`) must keep passing under both designs. New tests Phase 32 owes: a `renderEncounter` round-card region source-assertion test in the `test/unit/shell-loot-screen.test.js` style (readFileSync + stripComments source assertion); guard-constant assertions (both `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` present, both compared against `Date.now()`, neither referencing `transitionend`/animation); a routing test asserting no in-combat event type maps to both destinations. The `npm test` baseline (1593/1593) is what Phase 32 grows from.

## 7. Ratification

**Ratified design:** _pending user pick_

**How this is ratified:** the orchestrator presents §4 and §5 with the §3.2 totals in one AskUserQuestion; the user picks or redirects. If redirected, §4 is amended to the chosen design before the PROJECT.md row is written. The row is written immediately after the pick, inside Phase 30, so Phase 32 is planned against a recorded decision.

**Key Decision row drafts (orchestrator copies ONE after the pick):**

| Decision | Rationale | Outcome |
| --- | --- | --- |
| DRAFT A — Combat round narrative = one always-visible Round Card in the encounter panel (below the foe roster, above the action bar) + `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` = 250 ms `Date.now()` guards | Scored 4.75/5 on the fixed scorecard (highest of all six patterns); generalizes the shipped Phase 29 loot card; reuses `toastsForAction`'s existing groupers unmodified | Phase 32 builds from §6 |
| DRAFT B — Combat round narrative = one bundled toast per round in `#mw-toast-host` (Guarded, Bundled Toast) + the same `ARM_DELAY_MS`/`DISMISS_SETTLE_MS` guards on the action bar | Scored 3.15/5 as guards-alone, materially higher once bundling's coherence gain is counted; minimal structural change, least test churn of the two, preserves the current visual language | Phase 32 builds §5 in place of §4, with §6's wireframes/routing/guards read through the "If the runner-up is ratified" notes |

## Appendix A — Sources

**Primary (HIGH confidence — direct code inspection, this session):**
- `src/browser/toasts.js` (read in full, live-imported for exact counts)
- `mazeworld.html` (`renderEncounter`, `hasActiveEncounter`, `.mw-overlay`/`.mazefoot`/`.mw-toast-host` CSS, all read directly)
- `src/browser/controls.js` (read in full)
- `src/browser/eventNarration.js` / `src/browser/viewModels.js#oracleLogViewModel` (live-imported + read)
- `test/unit/narrativeToasts.test.js`, `test/unit/shell-toast-wiring.test.js`, `test/unit/feedback-payload.test.js`, `test/unit/oracleLogViewModel.test.js`, `test/unit/shell-oracle-panel.test.js` (each run standalone via `node --test` for live counts)
- `npm test` run fresh this session: 1593/1593 passing

**Secondary (MEDIUM confidence — WebSearch, official/primary pages):**
- https://darkestdungeon.wiki.gg/wiki/Combat_Mechanics_(Darkest_Dungeon) — Combat Mechanics (Darkest Dungeon) — Official Wiki
- https://apps.apple.com/us/app/darkest-dungeon-tablet-edition/id1199831446 — Darkest Dungeon: Tablet Edition — App Store
- https://en.wikipedia.org/wiki/Hoplite_(video_game) — Hoplite (video game) — Wikipedia
- https://medium.com/@scott_williams/hoplite-7c190d3f6ecc — Hoplite — Scott Williams, Medium
- https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i- — Road to the IGF: Subset Games' Into the Breach — Game Developer
- https://interfaceingame.com/games/into-the-breach/ — Into the Breach — Interface In Game
- https://m1.material.io/usability/accessibility.html — Accessibility — Material Design (m1)
- https://support.google.com/accessibility/android/answer/7101858?hl=en — Touch target size — Android Accessibility Help
- https://developer.chrome.com/blog/300ms-tap-delay-gone-away — 300ms tap delay, gone away — Chrome for Developers
- https://www.yosenspace.com/posts/lets-code-roguelike-tutorial-part7-enhancing-ui.html — Let's code with the Roguelike tutorial - Part 7 - Enhancing the UI
- https://www.phoca.cz/a11y-component-lab/toast — Accessible Toast Notification — A11y Component Lab

**Tertiary (LOW confidence — WebSearch summary only, not independently re-verified; see Appendix B):**
- Dungeon Crawl Stone Soup / Cogmind message-log conventions (A1)
- Card Crawl / Dicey Dungeons auto-battle conventions (A2)
- Diablo/Pokémon/MMO floating-text conventions (A3)
- Fire Emblem / Advance Wars battle-forecast panels (A4)
- Mobile UI reading-speed CPS bounds (A5)

## Appendix B — Assumptions log

| # | Claim | Section | Risk if wrong |
| --- | --- | --- | --- |
| A1 | Dungeon Crawl Stone Soup and Cogmind's message-log implementations follow the genre-standard append-and-scroll pattern described | §2.1 Pattern 1 | Low — cited as illustrative genre examples only; the actual decision rests on the "scrolling log duplicates the Oracle" structural argument, independently derivable from this project's own architecture |
| A2 | Card Crawl / Dicey Dungeons follow auto-battle/idle conventions as described | §2.1 Pattern 3 | Low — Pattern 3 is rejected on structural grounds (timer-paced reading, new state machine cost) that don't depend on these titles' specific implementations |
| A3 | Diablo/Pokémon/MMO floating-text conventions are as described | §2.1 Pattern 4 | Low — Pattern 4 is rejected on "zero voice room" and "no canvas typography layer" arguments, independently verifiable against this project's own code |
| A4 | Fire Emblem/Advance Wars battle-forecast panels work as described | §2.1 Pattern 2 | Low — Pattern 2's case rests primarily on the verified Darkest Dungeon citations and the already-shipped Phase 29 loot card, not on this genre claim |
| A5 | 12–20 CPS / 20–25 CPS are the correct comfortable/fast reading-speed bounds for this audience | §6.7 Accessibility | Medium — the Round Card has no forced auto-dismiss timer, so a wrong CPS figure only affects a secondary "should we cap the block's line count" tuning decision, not a hard functional requirement |

**Confidence statement:** the recommendation rests on HIGH-confidence code-read evidence (the current toast/renderEncounter architecture, the already-shipped Phase 29 loot-card precedent); the shipped-game examples throughout §2 are illustrative and comparative, not load-bearing for the recommendation itself.