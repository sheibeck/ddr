# Pitfalls Research

**Domain:** Adding a single-player party/"Joiners" system to a deterministic, parity-frozen, single-hero turn-based roguelike engine (Delve, Die, Repeat)
**Researched:** 2026-09-09
**Confidence:** HIGH (grounded in direct reads of `engine/combat.js`, `engine/difficulty.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, and the frozen `test/parity/prototype-master.js.txt`)

> **Proposed phase labels used below** (the roadmap isn't built yet; `/gsd-new-milestone` will name the real phases). Pitfalls are tagged to the logical phase that must own them:
> - **P1 · Party Model** — generalize `c.joiner` + `C.ally` into a serialized party array; save-migration.
> - **P2 · Party Combat** — turn order, per-member strikes/targeting, foe target selection, loop termination.
> - **P3 · Joiner Acquisition** — wire `meetJoiner()` into real recruitment.
> - **P4 · Party UI** — turn on the mock's party rail; status legibility on a phone.
> - **P5 · Balance Pass** — the *coordinated* difficulty-dial retune shared with Economy & Monster milestones.
> - **P6 · Death/Permadeath Semantics** — joiner death, departure, run impact.
> - **P0 · Scope Fence** — v1 party vs. the later true-multiplayer milestone (cross-cutting).

---

## Critical Pitfalls

### Pitfall 1: New RNG draws shift the seeded cursor and break the parity suite

**What goes wrong:**
Every party feature that rolls dice — a per-member strike (`rng.d(STRIKE_DICE[...])`), a per-member damage roll, a foe's *choice of which party member to hit*, a recruit roll — consumes from the same single seeded stream (`state.rngState`). The frozen master `test/parity/prototype-master.js.txt` was recorded with the OLD consumption order. Insert one draw anywhere in a path a parity fixture exercises and every downstream roll in that run diverges, so the whole byte-comparison suite goes red — not because behavior is wrong, but because the cursor moved.

**Why it happens:**
Developers add a die roll at the "logically correct" spot (e.g. inside `foeTurn`'s per-swing loop, or unconditionally in `startCombat`) without realizing the parity suite pins the *exact* draw order, not just the outcomes. This engine's whole test strategy is order-fidelity against a frozen golden file that must never be edited.

**How to avoid:**
- **Gate every new draw behind a condition that is false on the parity fixtures' path**, exactly as the codebase already does: the phobia-Hardiness `rng.d(2)` in `startCombat` (combat.js:236-238) only fires when a phobia has *already* triggered AND the character has Hardiness — never during chargen, never for the fixtures. Copy this discipline: a party-member strike draw only fires when `C.party` is non-empty; a foe-target-selection draw only fires when there is more than one valid target. Existing single-hero fixtures have empty parties and one target, so they draw nothing new.
- **Never add an unconditional draw to `startCombat`, `foeTurn`, `playerStrike`, `afterPlayerAction`, or `killFoe`.** Those are on every combat fixture's hot path.
- **Follow the `C.ally` precedent literally:** the existing ally strike (`allyTurn`, combat.js:646-664) already draws `rng.d(...)` and passes parity *because* `C.ally` is null on the fixtures. A party is the same shape at N; keep the draws inside `if (party member exists)`.
- **Put any recruit/roster rolls in the non-chargen dungeon path only** (the `meetJoiner` encounter), never in `rollCharacter` — chargen parity is the most heavily pinned fixture set.

**Warning signs:**
A parity test that was green goes red across *many* asserted fields at once (cascade), while unit tests of the new feature pass. That signature = cursor shift, not a logic bug.

**Phase to address:** P2 (combat draws), P3 (recruit draws) — with a determinism guard written into the plan's success criteria.

---

### Pitfall 2: New engine-only party fields aren't carved out of `comparable()` — permanent false parity failures

**What goes wrong:**
The party lives in new state fields (`C.party`, `c.party`, per-member `wp`/`gear`/`asleep`). The frozen prototype never had them, so a raw `deepEqual(engineState, prototypeState)` fails forever on the extra keys — even when RNG order is perfectly preserved.

**Why it happens:**
The parity harness compares whole state trees. Any field the engine adds that the frozen master lacks is a structural mismatch unless explicitly stripped in the domain's `comparable()` transform.

**How to avoid:**
- **Add `stripPartyField` carve-outs** to `test/parity/harness/comparables.js`, mirroring the existing `stripDarkForField` / `stripFlightFields` / `stripRationsField` precedents (comparables.js:36-57, 174-178). Strip `c.party` (and any new persistent per-member fields) in `combatComparable`, `movementComparable`, and `economyComparable`; strip `combat.party` in `combatComparable` alongside the existing `stripFoeDamageClosures`.
- **Document each carve-out with the same "deliberate, permanent, engine-only divergence — not a fidelity regression" rationale** the existing strippers carry, so a future reader doesn't "fix" it by editing the frozen master.
- **Never edit `test/parity/prototype-master.js.txt`.** It is the golden reference; the carve-out lives on the engine/harness side only.
- **Prefer additive event fields over changed ones.** Party events (`partyMemberStruck`, `memberJoined`) should be brand-new event types, following the additive `allyStruck`/`allyJoined` pattern, so no existing event-shape assertion breaks.

**Warning signs:**
Parity failures that point at *field presence/absence* (extra key `party`) rather than value drift; failures that appear on step 1 of a run before any dice are even rolled.

**Phase to address:** P1 (define the carve-outs the moment the party field is introduced).

---

### Pitfall 3: Extra bodies trivialize combat — the difficulty curve is silently invalidated

**What goes wrong:**
Combat is tuned around ONE hero versus a level-scaled foe count (`startCombat`: `cap = c.level<=2 ? 2 : 3`, foe level `clamp(min(c.level, depth) ...)`). Add 2-3 party members each swinging every round and the player's effective DPS roughly N-times's, while incoming damage is still split across one shared pool of foes. The Phase-3 tuned 5-10 minute descent curve (`engine/difficulty.js`) becomes a walkover; the core "tension of descending into the unknown" (the stated Core Value) evaporates.

**Why it happens:**
`difficulty.js` scales *floor generation* (dot count, darkness) by depth alone — it has no notion of party size. Foe count/level in `startCombat` keys off `c.level` and `depth`, never party size. Nothing in the power budget accounts for extra allied action economy.

**How to avoid:**
- **Treat "effective party power" as an input to the difficulty dial.** In P5, feed party size/strength into foe count or foe level scaling (e.g. raise the `cap`, or bias `maxLvl`) so encounters stay on the tuned curve. Do this in `engine/difficulty.js` and `startCombat`, keeping both pure/deterministic.
- **Cap party contribution hard for v1.** Reuse the existing ally model's *weakness* as a balance lever: the `C.ally` strike hits only on `roll <= 5` of a level-die and departs after N rounds. A joiner that is time-limited, less reliable than the hero, or capped at 1-2 members is far easier to balance than a permanent full party.
- **Re-run the Phase-3 headless tuning harness with party scenarios**, not just solo, before declaring the curve valid.

**Warning signs:**
Playtests where floors clear in one or two player turns; hero HP never drops; session length collapses below the 5-minute floor; kill counts spike.

**Phase to address:** P5 (dial retune) — but the *lever* (party power as a scaling input) must be designed in P1/P2 so P5 has something to turn.

---

### Pitfall 4: Tuning the difficulty dial three times — Joiners, Economy, and Monster milestones fight each other

**What goes wrong:**
Three proposed milestones each move the same dial: **Joiners** adds party power, **Monster Balancing** adds enemy power (foe spellcasting, new abilities, bestiary rebalance), **Economy & Item Balancing** changes gear/resource power (bags, sell economy, retuned costs/rewards). If each does its own full `difficulty.js` retune in isolation, the third one relitigates the first two, and the curve is tuned against assumptions that later milestones invalidate. Work is done 2-3×, and the final balance is whatever landed last, not a coherent design.

**Why it happens:**
Each milestone reads as self-contained and each legitimately "needs a balance pass." All three point at `engine/difficulty.js` and the Phase-3 tuning harness. Without an explicit ordering decision they collide.

**How to avoid:**
- **Decide global order at the milestone-planning session and do the difficulty-dial retune ONCE, last, after the power-changing milestones land** — this is exactly what all three proposed-milestone docs already flag ("ideally the difficulty-dial retune happens once, after the power-changing milestones land"). Recommended sequence: land the *mechanics* of Joiners (party model + combat + acquisition, with party power exposed as a scaling input but left at conservative defaults), then Monster, then Economy, then a single consolidated balance milestone/phase that retunes `difficulty.js` against the full combined system.
- **Alternatively, if each milestone must ship balanced independently**, make each one adjust *only its own local knobs* (Joiners: party cap/reliability; Monster: per-creature stats; Economy: prices/rewards) and reserve the *global* `difficulty.js` curve constants for the final consolidated pass. Split "local balance" (owned per milestone) from "global curve" (owned once) explicitly in each plan.
- **Keep `difficulty.js` a pure depth function** (it already consumes no RNG and touches no DOM — combat.js/difficulty.js header) so retuning is just constant changes plus a harness run, cheap to redo once.
- **Coordinate the shared reward numbers in one place:** parley's `d6*100*depth` Humans payout, killFoe's purse table + `LOOT_DIVISOR`, the Table-Four `+3000 WM` — the Monster and Economy docs already note these overlap. Party changes XP/loot *pressure* (more mouths, more kills); make sure the party milestone doesn't also re-tune those numbers the Economy milestone owns.

**Warning signs:**
Two milestone plans both editing `difficulty.js` constants; playtesters reporting the game "feels different" after each milestone with no single source of truth for the intended curve; the tuning harness being run with different assumptions in different milestones.

**Phase to address:** P0/P5 — sequencing decision at milestone-planning; the actual retune deferred to a single consolidated pass.

---

### Pitfall 5: XP-split and loot inflation — the party either snowballs or starves the hero

**What goes wrong:**
`killFoe` currently dumps 100% of skill points, coin, and treasure onto the single hero (`c.sp += gained`, `gainWilmst`, `takeItem`). With a party you must decide who gets XP and loot. Two failure modes:
1. **No split (all to hero):** the hero levels at the same rate but now clears fights N× faster → far more kills per minute → runaway leveling snowball. `checkLevel` fires constantly; the hero outscales the depth curve.
2. **Naive split (÷ party size):** the hero levels slower while carrying the risk, feels punished for recruiting, and joiners accrue power the UI/save must now track.

**Why it happens:**
The reward code assumes exactly one recipient. Adding recipients without redesigning the reward math produces either inflation or a feels-bad tax.

**How to avoid:**
- **Decide the reward model explicitly in P1 and keep it simple for v1:** recommended — **joiners do NOT accrue XP or loot** (they're hired muscle at a fixed level, like `C.ally`), and the hero's kill rewards are dampened to compensate for the faster clears (fold party size into a reward multiplier, or accept the extra clears are offset by tougher scaled encounters from Pitfall 3's lever). This avoids per-member progression bookkeeping entirely for v1.
- **If joiners must level**, define it as its own deferred sub-scope, not v1 (see Pitfall 12).
- **Watch loot *slot* pressure** — this collides with the Economy milestone's bag/carry system. A party doesn't share a bag today; decide whether joiners carry their own gear (more state, more save shape) or the hero holds everything (bag pressure). Recommend hero-holds-everything for v1 to keep the Economy interaction one-dimensional.

**Warning signs:**
Hero hitting level caps far earlier at depth than in solo playtests; skill-point totals ballooning; treasure inventory overflowing faster than the Economy milestone's bag caps assume.

**Phase to address:** P1 (reward model decision), coordinated with P5 and the Economy milestone.

---

### Pitfall 6: Combat turn loop drags past the 5-10 minute session (and can infinite-loop)

**What goes wrong:**
`afterPlayerAction` already has a non-trivial control flow: it runs `allyTurn`, `foeTurn`, then on a fresh-initiative "foe wins" it runs a *second* `foeTurn` and double-increments the round (combat.js:601-640). Multiply the per-round work by N party members each striking, plus foes now choosing among N targets, and each round balloons. More rounds + more per-round narration = a fight that blows past the session budget. Worse, a poorly-guarded party-turn or targeting loop (e.g. "pick next living target" over an all-dead party, or a member whose action re-enters combat resolution) can spin forever.

**Why it happens:**
The single-hero loop terminates cleanly because there's exactly one player and `liveFoes()` shrinks monotonically. Adding a second axis (living party members) introduces a second termination condition that's easy to get wrong: `findIndex(alive)` returning -1, a `while (someMemberCanAct)` that never clears, or re-entrancy through `afterPlayerAction`.

**How to avoid:**
- **Model party turns as a bounded `for` over a snapshot of members, never a `while`** — mirror `playerStrike`'s `for (let a = 0; a < attacks && t.alive; a++)` and `foeTurn`'s `for (const f of C.foes)` bounded loops. Snapshot the member/foe lists (like `foes.slice()` at combat.js:182) so mutation during iteration can't create an unbounded loop.
- **Guard dead-member / no-target cases explicitly:** `liveFoes()[0]` (allyTurn) returns undefined when empty and bails — replicate that guard for every party member's targeting, and skip (don't retry) a dead member.
- **Re-check `liveFoes().length` after every actor**, exactly as `afterPlayerAction` already does at three points, so combat ends the instant foes are cleared regardless of which party member landed the kill — otherwise the player is stranded on the combat screen (the bug the existing acid/ward re-check comment at combat.js:616-625 already warns about).
- **Budget the round:** cap party size (2-3 for v1), keep joiner actions terse in the event stream, and consider letting joiners act *simultaneously/summarized* rather than as full separate animated turns so the UI doesn't narrate N times per round.
- **Add a hard round ceiling / stalemate exit** as a safety net so no encounter can run unbounded.

**Warning signs:**
Encounters averaging many more rounds than solo; a test that hangs; combat that never returns `combatEnded`; profiler showing `afterPlayerAction` re-entrancy.

**Phase to address:** P2 (turn order + termination), P4 (narration budget).

---

### Pitfall 7: Foe target selection introduces a new draw AND new "who dies" semantics

**What goes wrong:**
Today every foe attacks the hero (`c`) unconditionally in `foeTurn` (`c.wp -= dmg`, `die(state, "combat", ...)`). With a party, each foe swing needs a *target choice* among living party members + hero. That choice (a) needs a rule (random? focus the weakest? always the hero?), and (b) if random, consumes a new `rng.d(...)` draw per swing — a parity-order hazard (Pitfall 1) on the single hottest loop in the engine.

**Why it happens:**
The single-target assumption is baked into `foeTurn`: there is no target variable, damage goes straight to `c`. Retrofitting target selection touches the most parity-sensitive function.

**How to avoid:**
- **Choose a deterministic, draw-free targeting rule for v1 where possible** — e.g. "foes always hit the hero" (party members are damage-soakers only via their own presence, not by drawing aggro), or "foes hit the front-most living member by fixed order." A fixed-order rule needs *zero* new RNG and keeps parity trivially (the hero-only branch is what the fixtures already exercise).
- **If targeting must be randomized, gate the draw behind `party.length > 0`** so solo fixtures (empty party) never draw it — same discipline as Pitfall 1.
- **Route ALL damage-to-a-character through one helper** so `die()` semantics, Hardiness, ward, armor soak (all currently hard-coded to `c`) work identically for a party member. Don't copy-paste the `c`-specific block per member; parameterize the target once.

**Warning signs:**
Parity break isolated to `foeTurn`; a party member taking ward/armor effects that belong to the hero; a foe swing with no target when the party is wiped but the hero lives.

**Phase to address:** P2.

---

### Pitfall 8: Save migration — old saves have no party; `rehydrate` drops transient combat party state

**What goes wrong:**
`STATE_VERSION` is 1 and `validateSave` currently treats any versionless/old save as v1 and validates against *today's* shape (saveState.js:101). A pre-party save has no `c.party`. If the party field is required, old in-progress runs fail to load or crash on first action. Separately, `rehydrate` **always resets `combat` to null** (saveState.js:156) — the prototype never resumed mid-combat — so any party state stored on `state.combat` (like `C.ally`) silently vanishes on reload. A partially-recruited/aborted party (recruit offered, app backgrounded mid-encounter) can leave `c.pendingAlly`/partial `c.party` in an inconsistent shape.

**Why it happens:**
The save layer was built for a fixed single-hero shape with a documented-but-unbuilt v1→v2 migration hook (saveState.js:96-100). New persistent fields need a migration path and a default; transient combat fields don't survive reload by design.

**How to avoid:**
- **Store the *persistent* party on `c` (or top-level `state.party`), NOT on `state.combat`** — combat is wiped on every reload. `c.joiner` is already the persistent home; generalize *that* into the party roster. Only the *in-fight* per-member combat state (current wp this fight, asleep counters) lives on `combat` and is legitimately transient/reset-on-reload (consistent with how the hero's own combat is not resumed).
- **Bump `STATE_VERSION` to 2 and add the real migration step** at the hook saveState.js:96-100: a v1 save (no party) migrates to `{ ...save, c: { ...c, party: [] } }` (empty party default). Make the party field *optional with an empty-array default* in `isValidCharacter`/rehydrate so old saves load unchanged.
- **Default missing party to empty everywhere it's read** (`c.party ?? []`), the same defensive `?? default` style the codebase uses (`c.songAt ?? -999`, `obj.day ?? 1`).
- **Define and clear partial/aborted recruit state:** ensure `c.pendingAlly`/pending-recruit is either fully applied or fully discarded on load; never leave a half-built member. A validation guard (like `isValidCharacter`) should treat a malformed party entry as "no party" and fail closed, not crash.
- **Add a round-trip parity/serialize test** for a save containing a party (serialize → validate → rehydrate → deep-equal), mirroring the existing save round-trip tests.

**Warning signs:**
Old dev saves failing to load after the party field lands; a reloaded mid-combat run losing its allies; `validateSave` accepting a save whose `party` entries are malformed.

**Phase to address:** P1 (version bump + migration + defaults + round-trip test).

---

### Pitfall 9: Party UI — the party rail overflows a phone and status becomes illegible

**What goes wrong:**
The mock's "party rail" is currently hidden/OFF for v1 (per the 04-UI-SPEC combat screen). Turning it on with N members plus the existing foe list, hero sheet, and combat log has to fit a portrait phone (the app is portrait-locked, 1080px reflow). Each member needs name, HP, level, status (asleep/frozen/dead). At 3+ members this overflows, forces tiny text, or pushes the combat controls off-screen — directly harming the "responsive, native-quality on mid-range phones" constraint and the 5-10 minute quick-session feel.

**Why it happens:**
The combat screen was laid out for one hero + a short foe list. The party rail was designed but deferred precisely because it's a layout risk; N is unbounded in the naive design.

**How to avoid:**
- **Cap visible party size and design the rail for the cap** (2-3 members recommended for v1) — don't build an arbitrarily-scrolling rail.
- **Use compact status chips** (reuse the enemy-status-chip pattern already built in the Phase-4 combat-UX rework) for member status rather than full sheets; a tap opens the full member sheet.
- **Keep the rail presentation-only over engine state.** The rail reads `state.combat.party` / `c.party`; it must never mutate engine state or read DOM inside the engine (the decoupling constraint). Render from events + state, like the existing `renderEncounter`.
- **Test on a real mid-range portrait device early** (the project is already in heavy device-review on a Pixel 7) with a full party + multi-foe encounter, before wiring deep combat logic.

**Warning signs:**
Combat controls scrolling off-screen; HP numbers below legible size; the log collapsing to a couple of lines; testers unable to tell which member is hurt.

**Phase to address:** P4 (with a device-review checkpoint).

---

### Pitfall 10: Strangler-fig bridge pitfalls — the half-migrated `C.ally`/`c.joiner`/`c.pendingAlly` mess

**What goes wrong:**
There are already **three** disconnected ally footholds: `C.ally` (combat-scoped, from Summoner spell, single strike, departs after N rounds), `c.pendingAlly` (out-of-combat summon, transferred at `startCombat`), and `c.joiner` (persistent, set by `meetJoiner` but **never read by combat** — a dead stub). If the party system is bolted on *beside* these instead of *absorbing* them, you get two parallel ally code paths (`allyTurn` vs. new party turn) that can both fire, double-count, or diverge. Note also the master's `meetJoiner` sets `maxWP` via `D(20)` then immediately overwrites it with `wp` (master:1762-1763) — a latent double-roll/shape quirk to reconcile, not blindly port.

**Why it happens:**
Incremental "add a party without touching the working ally" feels safer but leaves a strangler-fig half-migration: old and new systems coexist, each partially wired.

**How to avoid:**
- **Generalize, don't duplicate.** Make `C.ally` a party of size 1 — i.e. the new party array *is* the ally mechanism, and `allyTurn` becomes "each party member's turn." Migrate the Summoner summon (`master:2075-2084` / combat.js `C.ally`) to push into the party array; migrate `meetJoiner` (P3) to push a persistent member into `c.party`. Delete the standalone `C.ally`/`c.pendingAlly` paths once the party subsumes them.
- **Reconcile the `meetJoiner` shape deliberately** (fix the discarded-`maxWP` double-roll as an intentional, documented change — and mind that changing that draw count is itself a Pitfall-1 parity event; do it behind the non-chargen encounter gate).
- **One turn function, one targeting helper, one death helper** for all allied combatants — no parallel `allyTurn` + `partyTurn`.
- **Sequence the absorb explicitly:** P1 defines the party array + migrates `C.ally` into it (parity-neutral for solo saves), P3 wires `meetJoiner`. Don't ship the party rail (P4) reading a different data source than combat writes.

**Warning signs:**
Both `allyStruck` and a new `partyMemberStruck` firing for the same combatant; a summoned ally not appearing in the party rail; `c.joiner` set but nothing happening in the next fight; two departure timers.

**Phase to address:** P1 (absorb `C.ally`), P3 (absorb `meetJoiner`).

---

### Pitfall 11: Joiner death & permadeath semantics are undefined — inconsistent, un-serialized run impact

**What goes wrong:**
The game is permadeath for the hero (`die()` ends the run). Joiner death is undefined: do members permadie, flee at low HP, or just "depart"? If undefined, you get inconsistent behavior — a member's `wp<=0` might route through the hero's `die()` (ending the whole run — catastrophic), or be ignored (immortal members trivialize combat), or leave a `alive:false` member lingering in the party rail and the save.

**Why it happens:**
`foeTurn`'s death path is hard-coded to the hero (`die(state, "combat", f.name, ...)` on `c.wp<=0`). A party member reaching 0 HP has no defined route. `killFoe`/`die` are hero/foe-centric.

**How to avoid:**
- **Define member-death semantics explicitly in P6 and keep them simple for v1:** recommended — a downed member **departs the run** (removed from `c.party`), does NOT trigger the hero's `die()`, and does NOT end the run. Time-limited joiners (the `C.ally` `rounds` model) sidestep the question entirely for the summon case.
- **Ensure a member reaching 0 HP is routed to a member-death handler, never the hero's `die()`.** This is the same "route all damage through one target-parameterized helper" fix as Pitfall 7 — but the *death branch* must fork on hero-vs-member.
- **Clean up dead members from both the roster and the save** so a permadead member doesn't linger in `c.party` and the rail (Pitfall 8/9).
- **Decide the emotional/tone framing** (dark-humor departure/epitaph flavor) — consistent with the game's voice, but that's polish, not the mechanic.

**Warning signs:**
A member's death ending the whole run; dead members still shown as fighting; the save carrying `alive:false` party entries; members that never die (immortal DPS).

**Phase to address:** P6.

---

### Pitfall 12: Scope creep — building toward true multiplayer instead of a v1 single-player party

**What goes wrong:**
"Party system" invites building the *full* multiplayer-grade layer: per-member independent progression, per-member inventories/bags, member equip screens, AI behavior trees, reordering/formation, dismiss/rehire economies, member-specific dialogue. PROJECT.md is explicit: **multiplayer / "play with friends" is a deliberately deferred post-MVP milestone**, and Joiners is only the *single-player on-ramp* to the party-ready engine. Over-building here delays the milestone, multiplies the balance/save/UI surface, and pre-commits design the real multiplayer milestone should own.

**Why it happens:**
The engine was intentionally built "multiplayer-ready" (pure serializable `applyAction`), so it's tempting to "just finish the party fully." The three-way balance coupling (Pitfall 4) also tempts scope-widening ("while we're in here...").

**How to avoid — draw the v1 fence explicitly:**
- **IN for v1:** a small (cap 2-3) party of joiners that fight alongside the hero; recruited via the `meetJoiner` encounter; fixed-level "hired muscle" (no per-member XP); hero holds all loot (no per-member bags); deterministic/low-RNG combat contribution; serialized + migrated; depart-on-death; party rail UI showing HP/status; the difficulty *lever* wired but retuned in the consolidated balance pass.
- **DEFER to the true-multiplayer milestone:** per-member progression/leveling; per-member inventories/bags/equip; human-controlled members; member AI behavior trees / tactics selection; formation/positioning; networked/relayed state sync; member-specific quests/dialogue; large parties.
- **Write the fence into the milestone's scope doc and each phase's success criteria** so "add per-member leveling" gets bounced to the deferred milestone, not absorbed.
- **Reuse the weakest-possible mechanic that ships value:** the existing `C.ally` (time-limited, unreliable, no loot/XP) is *already* a shippable party-of-one; v1 is "generalize it to N with recruitment + UI + balance," nothing more.

**Warning signs:**
Plans introducing per-member `sp`/`level`/bag fields; a member-equip UI; AI tactics settings; anything titled "so it's ready for multiplayer"; the milestone growing past the 2-3 phase core.

**Phase to address:** P0 (scope fence at milestone-planning) — enforced in every phase's success criteria.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `C.ally` beside a new party array instead of absorbing it | No risk to the working Summoner ally | Two parallel ally paths, double-counting, diverging UI/combat data (Pitfall 10) | Never — absorb it in P1 |
| Store party on `state.combat` (transient) for speed | Easy to wire into `foeTurn`/`allyTurn` | Party vanishes on every reload (`rehydrate` nulls combat); breaks persistent joiners | Only the *in-fight* per-member combat sub-state; persistent roster must live on `c` |
| Add foe target-selection as an unconditional `rng.d(...)` | "Correct" random targeting | Breaks the entire parity suite via cursor shift (Pitfall 1/7) | Never — gate behind `party.length>0` or use a draw-free rule |
| All kill rewards to the hero, ignore the faster clears | No reward-split design needed | Hero snowballs past the difficulty curve (Pitfall 5) | Acceptable for v1 *only if* the difficulty lever (Pitfall 3) compensates |
| Per-milestone `difficulty.js` retune | Each milestone "ships balanced" | Tuned 2-3× against stale assumptions (Pitfall 4) | Never for the global curve — do the consolidated retune once, last |
| Uncapped, scrolling party rail | Handles any N | Overflows a portrait phone, illegible status (Pitfall 9) | Never for v1 — design for a fixed cap |
| Per-member XP/leveling in v1 | "Feels like a real party" | Multiplayer-milestone scope pulled forward; save/UI/balance surface explodes (Pitfall 12) | Never in v1 — defer |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `engine/difficulty.js` (the dial) | Adding party size as a new *RNG-consuming* input | Keep it a pure depth+party-size function; it must consume no RNG (per its own header) so it never perturbs the cursor |
| `test/parity/harness/comparables.js` | Forgetting to carve out new party fields, or editing the frozen master | Add `stripPartyField` to all three `*Comparable()` fns; never touch `prototype-master.js.txt` |
| `engine/saveState.js` migration hook | Leaving `STATE_VERSION` at 1 and validating old saves against the new shape | Bump to 2, add the real v1→v2 migration (empty-party default), keep party optional in `isValidCharacter` |
| `killFoe` / `gainWilmst` / `takeItem` (rewards) | Assuming one recipient | Decide the reward model in P1; coordinate the *numbers* with the Economy milestone, not here |
| Economy milestone's bag/carry system | Party members carrying their own bags in v1 | Hero holds all loot in v1; keep the party↔economy interaction one-dimensional |
| Monster milestone's foe abilities | Foe spellcasting/target choice adding draws that collide with party draws | Both milestones must gate new draws behind existence conditions; agree the draw order at planning |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-round work ×N party members ×N foes | Encounters run many rounds; combat animation lags on a mid-range phone | Cap party size (2-3); summarize joiner actions in the event stream; bounded `for` loops | ~3+ members vs. a full foe roster on a Pixel-class device |
| N× narration events per round | Combat log floods; session drags past 10 min | Terse/summarized party events; don't animate every member turn separately | As soon as the rail is turned on with multiple members |
| Unbounded targeting/turn loop | Test hangs; combat never returns `combatEnded` | Snapshot lists; bounded loops; hard round ceiling; re-check `liveFoes()` after every actor | Any party size if the loop uses `while` over a mutating list |

## Security / Integrity Mistakes

*(No network/accounts in v1 — the relevant "security" is save-integrity, the engine's existing threat model T-01-06a.)*

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting party entries from an untrusted save | Malformed `c.party` crashes `applyAction` on the next action | Extend the fail-closed `validateSave` shape check to party entries; treat malformed party as empty, fail closed to a safe default |
| Corrupted/non-integer member `wp`/`lvl` from a tampered save | NaN/Infinity poisoning combat math (same class as difficulty.js's `safeDepth` guard) | Clamp/validate member numeric fields on load, mirroring `safeDepth`'s `Number.isFinite` guard |
| Party size from a save used to size loops/arrays unchecked | A save claiming a huge party → DoS / memory blowup | Cap party size on load, not just on recruit |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Party rail overflows portrait phone | Combat controls off-screen; illegible HP/status | Fixed-cap rail with compact status chips; tap-to-expand member sheet |
| Player can't tell which member is hurt/asleep/dead | Bad decisions; feels-bad losses | Reuse the enemy-status-chip pattern; clear per-member status |
| Fights take too long with a party | Breaks the 5-10 min quick-session promise | Cap party size; summarize joiner turns; keep the log terse |
| Joiner death has no clear feedback | Player confused why a member vanished | Explicit departure event + on-tone (dark-humor) departure line |
| Recruit offer with no clear cost/benefit | Player doesn't understand the party decision | Surface the joiner's level/role and that it's temporary/loot-less at the offer |

## "Looks Done But Isn't" Checklist

- [ ] **Party combat:** Often missing the *foe-target-selection* rule and its parity gate — verify solo fixtures draw zero new RNG and combat still ends when foes clear regardless of who lands the kill.
- [ ] **Save/migration:** Often missing the `STATE_VERSION` bump + real v1→v2 step — verify a pre-party dev save loads unchanged and a party-bearing save survives serialize→validate→rehydrate.
- [ ] **Parity carve-outs:** Often missing `stripPartyField` in one of the three `*Comparable()` fns — verify the full parity suite is green with a party field present.
- [ ] **`C.ally` absorption:** Often missing — verify the Summoner summon now flows through the party array and no `allyTurn`/`partyTurn` double-fires.
- [ ] **Member death:** Often missing the fork away from the hero's `die()` — verify a downed member departs and does NOT end the run.
- [ ] **Difficulty lever:** Often "done" as a stub — verify party size actually feeds foe scaling and the tuning harness was re-run with party scenarios.
- [ ] **Balance coordination:** Often missing — verify the plan reserves the *global* `difficulty.js` retune for the consolidated pass and only touches party-local knobs.
- [ ] **UI decoupling:** Often violated — verify the rail reads engine state/events only, with zero DOM reads/writes inside engine functions.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RNG-order parity break (Pitfall 1/7) | LOW-MEDIUM | Find the unconditional draw; gate it behind a party/target existence condition; re-run parity |
| Missing parity carve-out (Pitfall 2) | LOW | Add `stripPartyField` to the affected `*Comparable()`; document the divergence rationale |
| Difficulty invalidated (Pitfall 3/4/5) | MEDIUM-HIGH | Re-run the Phase-3 tuning harness with party scenarios; adjust the party-size lever + do the consolidated dial retune once |
| Save can't load old runs (Pitfall 8) | MEDIUM | Add the v1→v2 migration + empty-party default; make party optional in `isValidCharacter` |
| Parallel ally paths (Pitfall 10) | MEDIUM | Refactor to one party array/turn/targeting/death helper; migrate `C.ally`/`meetJoiner` into it; delete the old paths |
| Member death ends the run (Pitfall 11) | LOW-MEDIUM | Fork the 0-HP branch: hero → `die()`, member → depart-and-remove |
| Scope creep (Pitfall 12) | HIGH | Cut deferred features back to the multiplayer milestone; re-baseline the v1 fence |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 · RNG cursor shift breaks parity | P2 / P3 | Full parity suite green; solo fixtures draw zero new RNG |
| 2 · Missing party carve-out | P1 | Parity suite green with `c.party`/`combat.party` present |
| 3 · Extra bodies trivialize combat | P5 (lever designed P1/P2) | Tuning harness re-run with party; session length in 5-10 min band |
| 4 · Triple difficulty-dial retune | P0 / P5 | Only one consolidated `difficulty.js` retune; ordering decided at planning |
| 5 · XP-split / loot inflation | P1 (+ Economy coord) | Hero leveling curve at depth matches intended; loot pressure within Economy caps |
| 6 · Combat drags / infinite loop | P2 (+ P4 narration) | No hang; bounded loops; round ceiling; `combatEnded` always reached |
| 7 · Foe target selection | P2 | Draw-free or gated targeting; damage routed through one target helper |
| 8 · Save migration | P1 | Old save loads unchanged; party save round-trips; malformed party fails closed |
| 9 · Party rail overflow | P4 | Full party + multi-foe encounter legible on a Pixel-class portrait device |
| 10 · Strangler-fig ally mess | P1 / P3 | `C.ally` + `meetJoiner` absorbed into one party path; no double-fire |
| 11 · Member death semantics | P6 | Downed member departs; run does not end; save has no lingering dead members |
| 12 · Scope creep vs. multiplayer | P0 (all phases) | Deferred-feature list enforced in each phase's success criteria |

## Sources

- Direct read: `engine/combat.js` — `startCombat`/`playerStrike`/`killFoe`/`foeTurn`/`afterPlayerAction`/`allyTurn`, `C.ally`/`c.pendingAlly` seams, RNG draw sites, single-hero `die()` path (CONFIDENCE: HIGH — primary source).
- Direct read: `engine/difficulty.js` — pure, RNG-free depth curve; the tuned 5-10 min dial and its constants (CONFIDENCE: HIGH).
- Direct read: `engine/saveState.js` + `engine/state.js` — `STATE_VERSION=1`, `validateSave`/`rehydrate`, the unbuilt v1→v2 migration hook, combat-reset-on-load (CONFIDENCE: HIGH).
- Direct read: `test/parity/harness/comparables.js` — `strip*Field` carve-out pattern, the "frozen master, never edit" discipline (CONFIDENCE: HIGH).
- Direct read: `test/parity/prototype-master.js.txt` — `meetJoiner()` (`c.joiner`, the `maxWP` double-roll quirk), the Summoner `C.ally`/`pendingAlly` spawn, `allyTurn`, `Joiner` encounter type (CONFIDENCE: HIGH — frozen reference).
- Direct read: `.planning/PROJECT.md` + the three proposed-milestone docs (Joiners, Economy & Item Balancing, Monster Balancing) — the deferred-multiplayer boundary, the three-way balance coupling, the "retune once" intent (CONFIDENCE: HIGH — project canon).

---
*Pitfalls research for: single-player party/Joiners system on a deterministic parity-frozen roguelike engine*
*Researched: 2026-09-09*
