---
status: root_cause_found
trigger: "DATA_START My Elven Ninja walked into a trap with 21 hitpoints to spare, Oracle shows I took -1 hitpoint, but I died. So, -1 hp took 21 hitpoints in actuality. / I was only floor 2 for the trap, btw DATA_END"
created: 2026-09-22T23:25:00Z
updated: 2026-09-25T00:00:00Z
---

## Symptoms

- **Expected:** A trap that the Oracle narrates as "-1 HP" leaves a 21-HP character alive at 20 HP.
- **Actual:** The character (Elven Ninja, floor 2) died on that trap. The HUD showed 21 HP before the step; the Oracle's trap line showed -1 HP.
- **Error messages:** none (no crash) — a silent death.
- **Timeline:** Seen once, 2026-09-22, on the v1.8 debug APK `d6db678` (Pixel 7), during the user's play after the Phase 60 device session. Not known whether it happens on v1.7.
- **Reproduction:** Unknown exact steps; floor 2, a trap square, ~21 HP displayed.

## Constraints (orchestrator)

- v1.8 is a PRESENTATION-ONLY milestone: `engine/`, `content/`, `test/parity/` are byte-identical to the `v1.7` tag. Any fix that would touch them must STOP and be reported to the user before editing (it is then a declared engine change).
- `npm test` fail 0 (3904/3904 at HEAD `e156bde`); `npm run build:www` green; re-pin tests, never delete; teeth checks only AFTER committing, with `git diff --quiet -- <file>` first, reverted via `git checkout -- <file>`; stage explicit paths only; never `--no-verify`.
- No device access in this session (the phone may be disconnected) — reproduce headless (shell sandbox / engine scripts / the dev start-at-depth path).

## Hypotheses (from the orchestrator, ranked)

1. **Stale HUD HP — possible Phase 58-06 regression.** 58-06 deliberately defers the HUD's `paint()` until a combat beat ends ("the top HP bar doesn't give the outcome away"). If some beat-ending path (hurry-tap, tab switch, flee, the kill/over-panel branch, reduced-motion instant path, a beat superseded by a new dispatch) never performs the deferred repaint, the HUD keeps showing pre-fight HP (21) while `S.c.wp` is ~1 — and the trap's real -1 would be fatal. A preceding fight on floor 2 fits the timeline.
2. **A trap that kills outright** while narrating only its HP line (a fall / secondary effect resolving `die()` without its own line) — pre-existing, engine or narration.
3. **Narration prints the wrong number** (e.g. "-1" for a larger hit — sign/format/field bug in the trap's EVENT_NARRATION entry).

## Current Focus

reasoning_checkpoint:
  hypothesis: "planBeat's heroHp array (src/browser/combatBeat.js) under-counts cumulative hero damage whenever a fold line represents MORE THAN ONE struckByFoe event (a foe with 2+ swings this round, or narrationLines.js's enemyRound 3+-foes collapse) — lineIdxsFor only reports the fold's FIRST constituent event index, so heroFrames(before.c.wp, lineEvents) subtracts only that first event's dmg, not the folded line's real total. On an ENDING round this wrong number is what's on screen on the LAST beat line (viewFor never substitutes plan.after for an ending round, by design — see D-09), i.e. the instant before the over-panel/settle takes over — so a player watching the combat panel's YOUR LOT hero-hp card through the killing exchange can walk away believing they have far more HP than engine truth, and the next hazard (a low-roll trap, correctly narrated) finishes them."
  confirming_evidence:
    - "scratchpad repro (node, pure functions, no fixtures needed): heroFrames(21, [{type:'struckByFoe',name:'Ogre',dmg:8}]) after lineIdxsFor folded TWO struckByFoe Ogre hits (8+9=17) into ONE fight-log line reading 'Ogre hits you 2 of 2 (17)' — heroFrames returned 13 (21-8), not the correct 4 (21-17). The folded TEXT is right; the frame math reads only the fold's first constituent event."
    - "src/browser/narrationLines.js enemyRound(): for a single foe with M>1 swings (line ~470-486) AND for 3+ distinct foes landing in one round (line ~446-468), the built line's `idx` is `firstIdx` — ALWAYS one representative event, even though the line's own `sum`/text covers every swing. lineIdxsFor (combatBeat.js) inherits this same one-idx-per-line contract, so heroFrames necessarily only ever sees one event per fold."
    - "viewFor (combatBeat.js) confirmed by existing test 'createBeatRunner — for an ending plan, the last line's state is a frame built on before, never plan.after' (test/unit/combat-beat.test.js:651) — an ending round's LAST line always renders frameStateFor(...), by design (D-09, so the combat body keeps a synthesized .combat.foes to draw from) — meaning heroHp[last]'s under-count, when it occurs, is exactly what's on screen right before the over-panel/settle repaints the (correct) top HUD."
    - "mazeworld.html paint() only writes #mw-hud-wp/#mw-hud-wpfill (grep confirmed no other writer) and is called exactly once per beat, from beatRunner's onSettle — never per-line. The hero's OWN live hp during the beat is shown by a DIFFERENT element: yourLotViewModel (src/browser/combatPanel.js heroCard.wpLabel), rendered every beat line from `V = bv ? bv.state : S` (mazeworld.html ~L4152/4186 renderYourLot) — i.e. exactly the buggy frameStateFor(...).c.wp value."
    - "5 separate empirical repros (scratchpad, using the real shell sandbox + real beatRunner) of every beat-ending path the orchestrator's hypothesis 1 named — natural end, hurry-tap, tab switch, a beat superseded by a new dispatch, and a flee round — all showed the TOP HUD (#mw-hud-wp, via paint()) correctly matches the true final S.c.wp at settle. This DISCONFIRMS the orchestrator's original hypothesis 1 (top-HUD paint() is skipped/stale) — paint() is reliable. The real gap is the OTHER live hp readout (YOUR LOT's card), fed by the frame, not by paint()."
  falsification_test: "If the reported death happened WITHOUT any preceding multi-attacker-in-one-round exchange this run (i.e. every struckByFoe this character ever took was a single hit per fold line, never a K-of-M or 3+-foes collapse), this hypothesis is wrong — heroFrames' naive cumulative would already equal engine truth throughout, and the YOUR LOT card would never have shown an inflated number. Not independently verifiable without the player's full session log; the fix below is verified instead by a direct unit reproduction of the under-count (falsifiable: the fix must turn the wrong last-frame value into a value that equals `after.c.wp` in every case, including single-hit rounds where it already did)."
  fix_rationale: "planBeat (src/browser/combatBeat.js) already knows the real final hero hp — `after.c.wp` — since `after` is the real post-round engine state (used verbatim in mid-fight's own last line, per D-09/viewFor). Pinning `heroHp`'s LAST entry to `Math.max(0, after.c.wp)` after computing it via heroFrames closes the exact gap: the one frame every ending round's beat guarantees is on screen right before settle can no longer overstate survival. It is a targeted, minimal fix inside the one function computing this array — no change to lineIdxsFor/narrationLines.js's wider fold contract (used by the Oracle/rail/fight-log, all independently verified correct — see Evidence), no change to intermediate (non-last) frames, no engine/content/test-parity touch."
  blind_spots: "(1) Does not fix intermediate (non-last) frame under-counts within a long multi-line round — only the LAST line (the one that matters for the reported symptom: what persists after the beat ends) is corrected; a mid-round frame can still transiently under-report during the reveal, matching D-09's own 'discretion clause' framing (mid-beat numbers are advisory, not authoritative) but still imperfect. (2) Could not reproduce the EXACT trap-death scenario end-to-end on a real save (no device, no bot harness that drives mazeworld.html's full shell) — the mechanism is proven at the unit level (heroFrames/planBeat) and cross-checked against how yourLotViewModel consumes it, not observed live causing a death. (3) foeFrames has the mirror gap (a hero's own multi-swing K-of-M line against one foe under-counts that foe's frame hp) — left unfixed since it cannot mislead the PLAYER about their own survival (a foe reading too-alive is not a death risk) and is outside this bug's reported symptom; flagged for a follow-up, not fixed here to keep the change minimal."

## Evidence

- timestamp: 2026-09-22 (investigation)
  checked: .planning/phases/58-motion-pacing/58-06-SUMMARY.md, 58-07-SUMMARY.md — the HUD-paint-deferral mechanism's own design doc
  found: onSettle (`() => { window.paint(); window.renderEncounter(); }`) is the ONE place paint() is called from inside a beat; every beat-ending path (natural end, hurry, tab switch) routes through beat.js's `fireOnEnd()`, which always calls onEnd/onSettle
  implication: the mechanism LOOKS sound by design; needed empirical proof before trusting it
- timestamp: 2026-09-22 (investigation)
  checked: mazeworld.html engineCombatAction (L6623-6693), stepWith (L6179-6297), noteCombat (L5916-5977), and every window.__mzState.set(state) call site
  found: every non-combat action (move/camp/buyItem/leaveStore/resolveJoiner/dismissJoiner/inventoryAction) calls window.paint() unconditionally and synchronously right after dispatch; only engineCombatAction (combat) defers to the beat's onSettle. Dismissing the over-panel (`S.beats = null; renderEncounter();`, L4065/4073/6825) never itself calls paint() — but by the time it's reachable, onSettle has already painted correctly (see Evidence below)
  implication: no non-combat action can leave the top HUD stale; the only theoretical staleness vector is a combat beat whose onSettle never fires
- timestamp: 2026-09-22 (investigation)
  checked: created 3 scratchpad node scripts (deleted after use) driving the REAL src/browser/combatBeat.js + shellSandbox.js + a real fake clock, reproducing engineCombatAction's documented handoff by hand (the same technique test/unit/combat-beat-shell.test.js itself uses, since engineCombatAction lives in the module script and can't run in the classic-only sandbox) — tested (a) a natural ending-round settle, (b) window.__mzBeat.hurry() mid-beat, (c) window.__mzShowTab() tab-switch mid-beat, (d) a second dispatch superseding an active beat mid-round, (e) a flee round (confirmed flee DOES fold a fight-log line and DOES go through the beat, contrary to an initial assumption it always short-circuits to immediate paint)
  found: in every case, #mw-hud-wp's textContent after settle exactly matched the true final S.c.wp — paint() is reliably called and reliably correct in all 5 beat-ending paths
  implication: ELIMINATES the orchestrator's hypothesis 1 as literally stated (top-HUD paint() skipped/stale after a beat) — the top HUD mechanism is sound
- timestamp: 2026-09-22 (investigation)
  checked: src/browser/narrationLines.js LINE_FOR.trapSprung, src/browser/eventNarration.js EVENT_NARRATION.trapSprung, engine/encounters.js springTrap
  found: both narration tables read `e.dmg` directly; springTrap computes `dmg` once (roll, ×times, ×2 Cat Burglar, -3 Hardiness, scaleHazard) THEN does `c.wp -= dmg` and `events.push({type:"trapSprung", ..., dmg})` off the SAME final `dmg` value — narration and the actual subtraction can never disagree for a single trapSprung event
  implication: ELIMINATES hypothesis 3 (narration prints the wrong number) for trapSprung specifically
- timestamp: 2026-09-22 (investigation)
  checked: src/browser/engineAdapter.js formatEvents/formatEvent, mazeworld.html stepWith's `for (const line of html) window.logLine(line);`
  found: formatEvents maps EVERY event to its own Oracle line (filters only literal nulls like the silent "moved" event) — nothing is capped/dropped; every returned html line is unconditionally logged for a move dispatch
  implication: rules out "a second, larger, unnarrated HP loss hid in the same move dispatch" as silently possible — every wp-reducing mechanism (trapSprung, wentHungry, trappedPanic, afflictionTick) narrates its own Oracle line, always
  implication: also rules out engine-side per-step compounding as an explanation, since trappedPanic/afflictionTick are BOTH explicitly clamped to leave >=1 hp (movement.js L376, L395) — only trapSprung and wentHungry are unclamped, and wentHungry's own die("starve") would preempt ever reaching the trap dispatch this same step (movement.js L509 returns early on state.dead)
- timestamp: 2026-09-22 (investigation, THE FIND)
  checked: src/browser/narrationLines.js enemyRound() (L422-488), src/browser/combatBeat.js lineIdxsFor/heroFrames/planBeat, src/browser/combatPanel.js yourLotViewModel, mazeworld.html renderEncounter's `const V = bv ? bv.state : S;` (L4152) feeding `window.__mzCombatVM.lot(V)` -> renderYourLot (L4186)
  found: confirmed via a pure-function scratchpad repro — when a single foe swings 2+ times in a round (or 3+ foes land in the same round), enemyRound() folds them into ONE fight-log line whose TEXT sums the true total dmg, but tags the line with only ONE representative event index (`idx: firstIdx`). combatBeat.js's lineIdxsFor inherits this one-idx-per-line contract, so heroFrames(before.c.wp, lineEvents) — fed `events[firstIdx]` only — subtracts only the FIRST swing's dmg, not the folded total. Repro: 2 struckByFoe events (Ogre, dmg 8 then 9) starting at 21 hp fold to "Ogre hits you 2 of 2 (17)" but heroFrames returns 13 (21-8) instead of the correct 4 (21-17)
  found: this wrong number is what src/browser/combatPanel.js's yourLotViewModel(V).heroCard.wpLabel displays — the LIVE "YOUR LOT" hero-hp card inside the encounter panel, visible and reactively updating through the WHOLE beat (unlike the top HUD, which stays frozen at the pre-round value by design until settle)
  found: for an ENDING round specifically, viewFor (combatBeat.js) uses frameStateFor(...) — never plan.after — on EVERY line including the LAST (confirmed by the existing, still-passing test "createBeatRunner — for an ending plan, the last line's state is a frame built on before, never plan.after", combat-beat.test.js:651) — so on a fight-ending round with a multi-swing exchange, the wrong (too-high) hp is exactly what's on screen the instant before the over-panel/settle takes over
  implication: this is a genuine, confirmed, presentation-only bug in src/browser/combatBeat.js (Phase 58 addition) — a plausible, code-proven mechanism for "the game showed me far more HP than I actually had going into the next hazard," matching the reported symptom's shape (a misleadingly-high HP belief that a subsequently-correct, small hazard hit then contradicts) far more precisely than the originally-ranked hypothesis 1, which rigorous testing (above) disconfirmed

## Eliminated

- hypothesis: "1 — top-HUD paint() (mw-hud-wp) is skipped/stale after a beat ends via hurry/tab-switch/flee/kill/the-over-panel-path (the orchestrator's original, literal wording)"
  evidence: 5 empirical repros (natural end, hurry, tab switch, superseded-by-new-dispatch, flee) via the real combatBeat.js + shellSandbox.js all show #mw-hud-wp correctly reflects true S.c.wp immediately after every beat-ending path; paint() is called from onSettle unconditionally and onSettle is unconditionally reached by every ending path (fireOnEnd in createBeat always calls onEnd)
  timestamp: 2026-09-22
- hypothesis: "3 — narration prints the wrong number for the trapSprung event itself"
  evidence: both narration tables (LINE_FOR and EVENT_NARRATION) read the SAME e.dmg the engine already subtracted from c.wp in the same statement block (engine/encounters.js springTrap) — no divergence possible
  timestamp: 2026-09-22
- hypothesis: "a second, larger, unnarrated HP-loss source hid inside the same move dispatch as the trap (multiple silent subtractions compounding to look like -1)"
  evidence: formatEvents (engineAdapter.js) narrates every event uncapped, filtering only true no-ops; every returned line is unconditionally logged; the two candidate compounding mechanisms (trappedPanic, afflictionTick) are both explicitly clamped to leave >=1 hp; the one unclamped non-trap mechanism (wentHungry/starvation) would die("starve") and pre-empt the trap dispatch entirely, producing a DIFFERENT death cause than what was reported
  timestamp: 2026-09-22

## Resolution

root_cause: "src/browser/combatBeat.js planBeat()'s heroHp array (fed by heroFrames) is derived from lineIdxsFor's one-representative-event-per-fold-line contract. When narrationLines.js's enemyRound() folds MULTIPLE struckByFoe hits into one fight-log line (a foe with 2+ swings this round, or 3+ foes landing together), heroFrames only subtracts the fold's FIRST constituent event's dmg, silently under-counting the round's real total. For a fight-ENDING round, viewFor never substitutes the true after-state on the last line (by design, D-09) — so this under-counted number is exactly what src/browser/combatPanel.js's yourLotViewModel renders on the encounter panel's live 'YOUR LOT' hero-hp card through the round's reveal AND on its final, pre-settle frame — a player reading that card can walk away believing they have far more hp than engine truth, right before the top HUD (paint(), which IS reliable — confirmed by 5 separate empirical repros) catches up. A subsequent hazard that is small and correctly narrated (e.g. a low-roll trap) can then be genuinely fatal against the TRUE (much lower) hp, while the player's last strong impression was the inflated number."
fix: "Pin planBeat's heroHp array's LAST entry to Math.max(0, after.c.wp) — the already-known true final hero hp (after is the real post-round engine state) — after computing heroHp via heroFrames. This is a no-op whenever heroFrames' cumulative math was already correct (the common case: 0 or 1 struckByFoe event per fold line), and corrects exactly the one frame guaranteed to be on screen right before an ending round's beat settles. Does not change lineIdxsFor/narrationLines.js's wider fold contract (Oracle/rail/fight-log text remains byte-identical — independently verified correct), intermediate (non-last) frames, or any engine/content/test-parity file."
verification: "New regression test (test/unit/combat-beat.test.js, 'planBeat's last hero-hp frame equals the real final hp...') confirmed RED before the fix (heroHp last entry read 47, an under-count from only the fold's first event's 8 dmg) and GREEN after (reads 38, the true 55-17). Full suite: npm test 3905/3905 (fail 0, +1 net new test over the 3904/3904 baseline at dispatch). npm run build:www exit 0. git diff --stat against HEAD (43aaed1) for engine/, content/, test/parity/ is empty — no engine/content/parity touch. Self-verified only (mechanism-level, via a direct unit reproduction of the under-count and its correction) — NOT verified against the original device report end-to-end (no device access this session, and the original bug was a single, unreproduced field report). Awaiting human confirmation this resolves the felt issue on a future play session (watch the 'YOUR LOT' hero-hp card through a round where a foe swings you more than once, or 3+ foes land in the same round, especially one that ends the fight — the number it settles on right before the victory/over panel should now always match what the top HUD shows a moment later)."
files_changed:
  - src/browser/combatBeat.js
  - test/unit/combat-beat.test.js

## Phase 75 session (2026-09-25)

Resumed per ROADMAP Phase 75 success criterion 4 (RULES-06's fix must follow
an explicit root-cause session, never a guess). Plan base:
`4076858db405012d5fccf597b8d078403fc96ebf` (master, after Phase 73 roll-high
and Phase 74 display honesty). This session re-verifies every 2026-09-22
finding on current master, runs a real engine-level reproduction at scale,
audits every visible hero-HP readout across every beat-ending path via the
real shell, and records the verdict below. No production file was touched —
`engine/`, `content/`, `src/` and `mazeworld.html` are byte-identical to the
plan base (`git diff --stat 4076858db405012d5fccf597b8d078403fc96ebf --
engine content src mazeworld.html` is empty).

### Re-verification (step 2 of Task 1)

- **`planBeat` still pins the last hero-hp frame to the real final hp, and
  its regression test still passes.** `src/browser/combatBeat.js` lines
  271-288 still carry the exact fix (`heroHp[heroHp.length - 1] =
  Math.max(0, after.c.wp)`), and `test/unit/combat-beat.test.js`'s own
  regression ("planBeat's last hero-hp frame equals the real final hp...")
  still passes on master (`node --test test/unit/combat-beat.test.js` —
  31/31 pass, including that test). **Re-confirmed, unchanged.**
- **`springTrap` still subtracts and narrates the same `dmg` value after the
  Phase 73 event reshape.** `engine/encounters.js` lines 85-99: `dmg` is
  computed once (roll, `times`, Cat Burglar ×2, Hardiness −3, `scaleHazard`),
  THEN `c.wp -= dmg` and `events.push({ type: "trapSprung", ...rollFields(check),
  name: tr.n, dmg })` read the SAME local `dmg`. Phase 73's ROLL-05 rework
  changed what the event's `roll`/`atLeast`/`dieN` triple reports (the dodge
  check, not the trap-kind pick) but left `dmg`'s own computation and use
  completely untouched — narration and the actual subtraction still cannot
  diverge for a single `trapSprung` event. Confirmed live by this session's
  new `test/unit/trap-death-repro.test.js` (a scripted `-1 HP` scenario on a
  21-hp hero — the report's own numbers — survives at 20 hp, and the Oracle
  line reads the identical `−1 hp`). **Re-confirmed, unchanged.**
- **`trappedPanic` and `afflictionTick` still leave at least 1 hp.**
  `engine/movement.js` line 402 (`Math.min(raw, Math.max(0, c.wp - 1))`) and
  line 421 (`Math.min(rollDice(rng, af.loss), Math.max(0, c.wp - 1))`) both
  still carry the >=1-hp clamp, unchanged since the 2026-09-22 session read
  them. **Re-confirmed, unchanged.**
- **Every hp-reducing event on a move step still gets its own Oracle
  line.** `src/browser/engineAdapter.js#formatEvents` still maps every event
  to its own line (only a literal no-op like the silent "moved" event is
  filtered) — re-read this session, unchanged in shape. Cross-checked
  empirically too: the engine-scale reproduction below inventoried every
  hp-changing event type this codebase's engine can currently push (a full
  `grep -n "c\.wp -="`/`"c\.wp = Math\.min"` sweep across `engine/*.js`) and
  found none un-narrated — see the (ii) count.

### Engine-level reproduction at scale (step 3-4 of Task 1)

A scratch script (`tools/lib/tuning-bot.mjs`'s own `decideAction`/
`makeBotContext` policy, driving the real `engine/engine.js#applyAction`
from `newRun(seed, [], { startDepth: 2, ... })`, never hand-built events)
ran **500 seeds** (250 unforced, 250 forced `{ race: "Elven", sub: "Ninja" }`
— the report's own identity), each up to 400 actions, for **197,377 total
actions**. For every action it recorded hp before, every hp-changing
event's own narrated amount (a full inventory of every `c.wp -=`/
`c.wp = Math.min(...)` site across `engine/*.js`: `trapSprung`,
`trappedPanic`, `afflictionTick`, `afflictionCaught`, `wentHungry`,
`fellClimbing`/`fellInGorge`, `backfireSelfDamage`, `summonBackfired`,
`earthquakeSelfDamage`, `deathCast`, `struckByFoe`, `foeBolted`,
`insanitySelfHarm`, and the `tableFour` `-10 HP`/`-15 HP` prose rows), hp
after, and death. For every action that ended a fight it also ran
`planBeat` on that action's `(before, after, events)` and compared the last
hero-hp frame to `after.c.wp`.

**The three must-haves counts:**

| # | Question | Count | out of |
|---|----------|-------|--------|
| (i) | deaths whose narrated losses summed to LESS than the hp the hero had | **0** | 16 deaths |
| (ii) | actions whose narrated-loss sum differed from the actual hp change | **18*** | 197,377 actions |
| (iii) | fight endings whose last frame overstated hp vs `after.c.wp` | **0** | 2,207 fight endings |

\* **All 18 of (ii) are explained, not bugs.** Every one of the 18 hits is a
death dispatch where the narrated loss (e.g. `trapSprung.dmg`) is LARGER
than the clamped actual change — because `engine/death.js#die()` sets
`c.wp = 0` unconditionally (never negative) regardless of how far the blow
overkills. Example: seed 1169, `move E` → `trapSprung` (dmg 32) → `died`; the
hero had 30 hp, the trap narrated 32, `c.wp` clamps to 0, so the "actual"
change reads 30 while the narrated loss reads 32 — the OPPOSITE shape from
the report (a correctly-narrated, MORE-than-sufficient blow, not an
under-narrated one). A handful of the 18 are a second, unrelated
measurement artifact: `secondWindHealed` (an ability self-heal) riding the
same dispatch as a `struckByFoe` — the heal and the hit each narrate their
own correct number; only their net (not either alone) is the dispatch's
total, which this script's crude per-event sum doesn't reconstruct. Neither
shape is the reported bug (a narrated loss SMALLER than the hp the hero had,
killing them). Full JSON output and the reproduction script itself are in
the session scratchpad (never committed): `75-01-trap-death-repro.mjs` /
`75-01-trap-death-repro-out.json`.

**Conclusion: the engine and its narration tables never produced an
under-narrated fatal loss, a narration/actual mismatch on a pure-loss
dispatch, or a last-frame overstatement, across 197k real actions and 2,207
real fight endings — at scale, on current master, with the report's own
race/sub forced.**

### Shell-level audit across every beat-ending path (Task 2)

Reused `test/unit/combat-beat-shell.test.js`'s own technique (a REAL beat
runner — `createBeatRunner`/`createBeat` — driven against the classic shell
sandbox, `test/unit/harness/shellSandbox.js`, over a fake clock) with a
deliberately worst-case K-of-M multi-swing fold (an Ogre landing two swings,
8+9=17, folded into one fight-log line — the exact shape the 2026-09-22
session's own blind spot 1 named) to check `#mw-hud-wp` (the top HUD,
painted by `paint()`) and the YOUR LOT hero card (`#cb-lot .cb-lot-wp`, fed
by `window.__mzCombatVM.lot(V)`) against engine truth (`state.c.wp`) at the
moment the player can next act, on **all eight named paths**:

| # | Path | HUD (`#mw-hud-wp`) | YOUR LOT card | Result |
|---|------|---------------------|----------------|--------|
| 1 | natural settle | 38/55 HP | 38/55 | match |
| 2 | hurry (tap-to-hurry) | 38/55 HP | 38/55 | match |
| 3 | tab switch mid-beat | 38/55 HP | 38/55 | match |
| 4 | flee (combat-ending) | 38/55 HP | 38/55 | match |
| 5 | a kill (combat-ending, over-panel up) | 38/55 HP | 38/55 | match |
| 6 | a superseded dispatch (a second round arrives mid-first-beat) | 38/55 HP | 38/55 | match |
| 7 | the over-panel dismiss (`S.beats = null; renderEncounter();`) | 38/55 HP | 38/55 | match |
| 8 | reduced motion (the whole beat resolves synchronously, no timers) | 38/55 HP | 38/55 | match |

**All eight beat-ending paths show the correct, engine-true hp at the
moment the player can next act. Zero mismatches.** Script:
`75-01-shell-audit.mjs` in the session scratchpad (never committed).

**Blind spot 1 (intermediate, non-last frames) — verdict: STILL PRESENT,
CONFIRMED, but NEVER exposed at an actionable moment.** A follow-up case in
the same script built a round where the K-of-M fold is genuinely NOT the
round's last line (a further single-hit line follows it). The fold's own
frame (index 1 of 3) still reads `47/55` — the fold's first-constituent-only
under-count (`55-8`), not the true running total at that point (`55-17=38`).
This is the SAME mechanism the 2026-09-22 session named and deliberately
left unfixed (blind spot 1: "does not fix intermediate frame under-counts
... only the LAST line ... is corrected"). Re-confirmed live, at the shell
level, this session. **But**: `test/unit/combat-beat-shell.test.js`'s own
test (4) already proves the action buttons (`#cb-strike` etc.) stay
`encArmed() === false` for the WHOLE beat, regardless of which frame is
rendering — so this transient overstatement (on screen for at most one
`BEAT_GAP_MS` ≈ 600ms) is never the number a player can act on. The round's
own LAST frame — the number that persists into the actionable moment — is
always correct (`36/55` in the same test), matching the eight-path audit
above. **This is not a fatal-exposure window; it is a cosmetic,
sub-second, non-actionable display quirk, unchanged from the 2026-09-22
session's own assessment.**

**Verdict for foeFrames (blind spot 3):** not re-examined this session (the
2026-09-22 session already classified it correctly — it cannot mislead the
player about their OWN survival, which is this requirement's whole concern
— and nothing this session found changes that classification).

### Eliminated (this session, added to the running list)

- hypothesis: "a NEW engine, narration, or planBeat regression was
  introduced by Phase 73 (roll-high) or Phase 74 (display honesty) that
  reopens the 2026-09-22 gap"
  evidence: every 2026-09-22 finding re-verified byte-for-byte on master
  (see Re-verification above); the engine-scale reproduction (500 seeds,
  197,377 actions, 2,207 fight endings) found zero under-narrated fatal
  losses and zero last-frame overstatements; the shell-level audit found
  zero HP-readout mismatches across all eight beat-ending paths, even under
  a deliberately worst-case K-of-M fold
  timestamp: 2026-09-25
- hypothesis: "the death IS reproducible end-to-end from a dev start at
  depth 2 with the report's own race/sub forced, given enough seeds"
  evidence: 250 seeds forced to `{ race: "Elven", sub: "Ninja" }` (the
  report's own identity), 400 actions each, produced 16 deaths total across
  the full 500-seed run and NONE matched the report's shape (an
  under-narrated fatal trap); this is consistent with (not proof against)
  the original session's own blind spot 2 — a single, unreproduced field
  report can remain genuinely unreproducible even when its explained cause
  (blind spot 1's presentation gap, already fixed for the exposed case) is
  fully understood
  timestamp: 2026-09-25

### Verdict

**`status: root_cause_found`.** The confirmed cause is the SAME one the
2026-09-22 session found and fixed: `src/browser/combatBeat.js#planBeat`'s
`heroHp` array, before the fix, under-counted a K-of-M multi-swing fold's
true damage on the ENDING round's LAST line — the one frame guaranteed to
be on screen the instant before a beat settles — letting the YOUR LOT hero
card show far more hp than `state.c.wp` actually held, right before a
subsequent, correctly-narrated hazard (a small trap) could then be genuinely
fatal against the true, much-lower hp. This session's exhaustive
re-verification (byte-for-byte code re-read), engine-scale reproduction
(500 seeds / 197,377 actions / 2,207 fight endings, zero anomalies of any
of the three kinds asked for), and shell-level 8-path audit (zero HP-readout
mismatches at any actionable moment, even under a deliberately worst-case
fold) all agree: **this fix fully closes the exposed gap, and no NEW,
different root cause reproduces on current master.**

No new production cause is confirmed this session, so — per this plan's own
instruction — **`test/unit/trap-death-repro.test.js` carries zero
`{ todo: true }` cases and zero "RULES-06 cause:" test names.** It instead
carries four PASSING pins: the trap-narration-equals-actual-loss invariant
(both the report's own `-1 HP`-on-21-hp shape, and the overkill/clamp
shape the engine-scale run's own (ii) count needed explaining), the
last-frame fix re-verified with a freshly-built K-of-M fixture, and blind
spot 1's transient-but-non-actionable frame documented as a known,
bounded, unchanged limitation.

The original report itself (a single, unreproduced field report, matching
the 2026-09-22 session's own blind spot 2) still cannot be reproduced
end-to-end — this session's 250 forced-identity seeds did not surface a
matching death, and per this plan's own ground rule, "a plausible mechanism
that cannot be shown stays unreproduced, never confirmed." The strongest
available account remains: the player very likely watched the YOUR LOT
card's pre-2026-09-22-fix under-count during a multi-swing exchange
(possibly on an EARLIER build than the fix — the report is undated against
a specific version), formed a false belief about their real hp, and then
walked into a genuinely fatal (or near-fatal, on top of unremembered prior
damage) trap that the Oracle narrated correctly the whole time.

### Fix inputs

No code fix is required from this session — the confirmed cause is already
fixed (`src/browser/combatBeat.js`, 2026-09-22) and already regression-tested
(`test/unit/combat-beat.test.js`, re-pinned again in
`test/unit/trap-death-repro.test.js`). Per `75-CONTEXT.md`'s own instruction,
75-08 still owns the two standing guards below — both already TRUE per this
session's evidence, so 75-08's job is to make them permanently,
mechanically true (not to change behavior):

1. **Every visible HP readout equals `state.c.wp` wherever the player can
   act.** Already true (this session's 8-path shell audit, zero
   mismatches). 75-08 should promote `75-01-shell-audit.mjs`'s technique (or
   an equivalent) into a committed, permanent test in this repo's `test/
   unit/` suite, so a FUTURE regression on any of the eight named paths — or
   a ninth path added later — is caught the same way this plan caught the
   original 2026-09-22 gap.
2. **No hp loss goes un-narrated or mis-narrated.** Already true (this
   session's engine-scale reproduction, 197,377 actions, zero mismatches
   once the death-clamp/heal-in-same-dispatch measurement artifacts are
   accounted for). 75-08 may promote the event-type inventory this
   session's `narratedLossFor`/`KNOWN_HP_EVENTS` mapping built (see the
   scratchpad script) into a permanent "every new hp-reducing site must
   register its own narrated-amount field" guard, so a future engine change
   that adds a ninth `c.wp -=` site without a matching Oracle field is
   caught by a test, not a field report.

Optional (Claude's Discretion, not required by the Verdict): blind spot 1
(the intermediate, non-last K-of-M fold frame's transient under-count)
could still be tightened by extending the 2026-09-22 fix's own pinning
approach to every mid-round frame, not just the last one — `heroFrames`
would need each line's frame to reflect the TRUE cumulative loss through
that line's real events (not just its one representative event), which
requires either widening `lineIdxsFor`'s one-idx-per-line contract or
computing a parallel true-cumulative array off the full `events` array
rather than the folded `lineEvents` subset. This is NOT required — the
Verdict already establishes this window is never actionable — but would
close the cosmetic gap entirely if 75-08 has budget for it.
