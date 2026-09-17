# Pitfalls Research

**Domain:** Deterministic, parity-gated, dice-driven mobile roguelike (Delve, Die, Repeat) — adding spells/gear/abilities/phobias/terrain/targeting to a shipped, tuned engine
**Researched:** 2026-09-17
**Confidence:** HIGH (direct source inspection of `engine/rng.js`, `test/parity/harness/comparables.js`, `src/browser/inputGuards.js`, `docs/CLASS-PASS.md`, `docs/DIFFICULTY-RETUNE.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/MILESTONES.md`) — every pitfall below is tied to a concrete file, function, or precedent already in this codebase, not generic advice.

## Critical Pitfalls

### Pitfall 1: New rng draws inserted before existing draws silently reorder every later roll

**What goes wrong:**
`engine/rng.js`'s `makeRng` is a single mulberry32 stream consumed call-by-call (`d()`, `pick()`, `shuffle()`) in strict source order. Any new draw this milestone adds — a scroll's immediate-cast check, a magic item's use roll, an activated ability's to-hit/damage roll, a Cutthroat murder check, a water-square extra-move check, a phobia re-roll on terrain entry — that is inserted **before** an existing draw in the same action path shifts every subsequent roll for every fixture/scenario that reaches that code path, even ones with zero interest in the new feature.

**Why it happens:**
The v1.1/v1.2/v1.3 history shows this happening repeatedly and being caught only by the parity suite: Phase 17 pinned exact draw-count baselines specifically because refactors kept shifting cursors; Phase 31's CMB-01 split (`startCombat`/`fight`) reordered the Knight/Con Artist/Court Mage removal loop and "discovered and re-measured a 4th rng-reordering divergence" the plan hadn't anticipated. v1.5 touches spellcasting, combat actions, movement (water), and joiner logic — the four highest-traffic rng call sites in the game — simultaneously, multiplying the chance of an accidental reorder.

**How to avoid:**
Every new draw must be added **after** all existing draws in its function, gated behind a feature-specific condition that is false for every current fixture (mirroring the `dev`/`storeRoll`/`pendingLoot` precedent — `test/parity/harness/comparables.js` documents six such top-level flags already). Before writing engine code for a phase, re-run `test/parity/FIXTURE-INVENTORY.md`'s exposure check to know exactly which classes/foes/scenarios are fixture-exposed, and pin the exact draw count for the touched function(s) the same way Phase 17-03 and Phase 23-01 did ("all 20 rollCharacter/newRun cursor pins... independently re-measured against the untouched engine"). Never assume a new draw is "probably fine" — measure it.

**Warning signs:**
`npm test` parity suite (`test/parity/full-suite.test.js`, 30+ scenarios) fails with a byte diff on a fixture the phase's own plan never mentions touching (e.g. a spell-rework phase breaking the `flee` or `parley` fixture). That is the reorder signature, not a real regression in the touched system.

**Phase to address:**
Every phase (36 Spell rework, 37 Melee abilities, 38 Gear/items, 39 Phobias/water/darkness, 40 Flee/Cutthroat/targeting) — each phase's own plan must include an explicit draw-count/draw-order table for every touched function, verified by running `test/parity/full-suite.test.js` before any content is added, not just at phase close.

---

### Pitfall 2: Cooldown/duration timers desync between per-step and per-round ticking, or don't survive save/load

**What goes wrong:**
This milestone introduces at least three new timer families: spell durations (timed map reveal replacing permanent Detect Magic), ability cooldowns (melee actives, "cooldown pool" language in PROJECT.md), and item cooldowns (use → duration → **cooldown-in-squares**). The codebase already has two structurally different timer idioms that are easy to conflate: `c.darkFor` (a per-character counter decremented once per **movement step**, `engine/movement.js` ~L269-290) and `f.cd[id]` (a per-foe-ability counter decremented once per **combat visit/round**, `engine/foeAbilities.js#tickAbilityCooldowns`). A new item whose cooldown is stated in "squares" must tick on movement steps, not combat rounds — and a spell duration stated in "turns" needs its own definition of a turn (a move? a round? both?). Mixing these up produces a cooldown that never expires in the dungeon but does in combat, or a map-reveal that outlives the player standing still in a doorway mid-fight.

**Why it happens:**
The two existing tick sites live in different files (`movement.js` vs `foeAbilities.js`/`combat.js`) with different call cadences, and nothing forces a new counter to declare which one it belongs to. Additionally, every new persistent field needs an explicit **default for old saves** — `engine/character.js`'s `migrateCarry` precedent ("additive-with-default discipline", cited directly in STATE.md's Decision log for `clearFoeEffect`) exists precisely because a save from before a field existed must not crash or silently misbehave when the field is read.

**How to avoid:**
For every new timer, write down explicitly (in the phase's CONTEXT/PLAN) which tick site owns it — movement-step (squares) or combat-round — and add exactly one new tick call at that site, following the `c.darkFor`/`f.cd` precedent's shape (lazy-init to a default, `Math.max(0, n-1)`, a `*Lifted`/`*Expired` event on hitting zero). For load-time safety, follow `clearFoeEffect`'s rule verbatim: "nulls a PRESENT field on load but never injects the key onto a save lacking it" — an old save must load with the new cooldown/duration fields simply absent (falsy-default reads), never with a crash or an incorrectly-active effect. Add a round-trip test (serialize mid-cooldown → deserialize → tick) for every new timer, the same class of test the round-trip suite already runs for existing state.

**Warning signs:**
A timer that appears to tick twice per turn (once on the step, once on the round) if both sites are wired by accident; a debug session where a cooldown is "stuck" because it only ticks in combat but the player never re-enters combat; an old save that throws on load or shows an item as permanently on-cooldown because the missing field read as `0` instead of "not applicable."

**Phase to address:**
Phase 37 (melee actives) and Phase 38 (gear/magic items) — these introduce the new cooldown families and should land the single shared "cooldown ticking" convention (ideally one small shared helper mirroring `tickAbilityCooldowns`'s shape, parameterized by tick-site) before Phase 39's water/darkness durations reuse it.

---

### Pitfall 3: Activated abilities and item cooldowns silently move the depth-20 curve without anyone re-running the matrix

**What goes wrong:**
`docs/CLASS-PASS.md` and `docs/DIFFICULTY-RETUNE.md` record that the entire depth-20 difficulty curve was tuned against a specific, measured player-power baseline (`tools/tune-classes.mjs`'s 143-cell matrix, `COMBAT_SCALE_FROM_DEPTH 21`, foe grace/threat constants). Every activated ability and every "use → effect → cooldown" magic item this milestone adds is **new player power**. Landing it without re-running the matrix means the shipped curve is now tuned against a hero that no longer exists — the same mistake the project explicitly built process around after v1.1's TUNE-04 came back "tune-again" purely because caster power had silently changed underneath an already-tuned curve.

**Why it happens:**
Power changes are easy to review individually ("this one ability is balanced") but the class-matrix bot is the only tool that sees the *aggregate* effect across 143 class/race cells at volume — a human reviewing one ability in isolation cannot see that it pushes five different sub-classes' median death depth up simultaneously. The project's own history shows this exact failure mode already happened three times before (v1.1→v1.2 retune deferral, the pre-Phase-22 baseline caveat about the bot under-measuring casters, and Phase 26 catching a pre-existing stranded-combat bug only because the matrix gate flagged an out-of-band cell).

**How to avoid:**
Treat this milestone the same way Phase 22-27 treated the class pass: capture a fresh BEFORE matrix pin (`tools/tune-classes.mjs`, same 143 cells, same seed count) before any ability/item power lands, then an AFTER matrix once Phases 37-38 are code-complete, and diff via `tools/class-pass-diff.mjs`'s fun-band verdicts before touching `engine/difficulty.js` constants. Critically: **the bot itself must be updated first** to actually use the new abilities/items (mirroring the documented v1.2 lesson — "the v1.1 bot casts only thrown spells, so caster subs are under-measured" — the exact same under-measurement will recur here if the bot doesn't know how to trigger a melee active or drink/wave a new magic item). Do not let this milestone's power changes accumulate un-measured across all six target features and then attempt one giant retune at the end — that repeats the exact anti-pattern the "ONE consolidated difficulty retune" lesson was designed to prevent, except now inside a single milestone.

**Warning signs:**
`docs/CLASS-PASS.md`'s AFTER matrix shows median death depth or reach-20% moving by more than noise without any `engine/difficulty.js` constant having changed; the bot's per-cell transcripts never show the new ability/item names appearing in the action log (proof the bot isn't using them, so the matrix is blind to their power).

**Phase to address:**
A dedicated tuning checkpoint after Phases 36-38 (spells/abilities/gear) land, before Phase 39-40 (which change survivability mechanics like flee odds and phobia penalties) — do not wait until milestone close. Recommend inserting a short "bot policy + matrix refresh" phase immediately after Phase 38, mirroring Phase 22's role in v1.2.

---

### Pitfall 4: "Situational" combat spells and the class-flavored ability pool never actually get picked by the bot or the player

**What goes wrong:**
The milestone goal states combat spells should be "unique and situational (not cheapest-damage-wins)." A situational spell (works only vs. undead, or only when 2+ foes are alive, or only as an opener) is worthless as a design goal if `tools/lib/tuning-bot.mjs`'s `chooseSpell` scoring table (documented in `docs/CLASS-PASS.md`) never assigns it a competitive score, or if a human player never learns the condition exists and defaults to the highest raw-damage option every time — exactly the "cheapest damage wins" failure mode the milestone is trying to fix, just recreated one layer up.

**Why it happens:**
`chooseSpell`'s existing scoring table is a flat priority ladder (KILL > DAMAGE > DISABLE > HEAL > WARD-OPENER) with hard-coded conditions. A new situational spell needs a **new scoring branch** added deliberately; if the phase only adds the spell to content tables and not to the bot's scoring function, the bot will never select it (score of `undefined`/0 loses to any DAMAGE-tier spell), producing a matrix readout where the new spell has a 0% pick rate — indistinguishable from "the spell doesn't work" without deliberately checking.

**How to avoid:**
For every new situational spell/ability, add both (a) the content/mechanical implementation and (b) a corresponding scoring branch in `tools/lib/tuning-bot.mjs`'s `chooseSpell`/`decideAction`, in the same plan/commit — treat "bot can select this" as an acceptance criterion, not an afterthought. After the matrix run, explicitly measure pick rate per spell/ability (a new column in the class-pass ledger) and treat anything at 0% or near-100% (crowding out everything else) as a balance signal requiring another look, the same way Phase 26 treated an out-of-band cell as a finding requiring a verdict. For the player side, the "clarity pass" (Phase 41) must surface the situational condition in the spell's own UI text (not just flavor copy) — e.g. "only vs. Undead" shown at cast-time, not buried in a codex.

**Warning signs:**
A class-pass AFTER ledger where a new spell's name never appears in any bot transcript across the full matrix; a human playtester who says "I forgot that spell existed" during the end-of-milestone UAT batch.

**Phase to address:**
Phase 36 (spell rework) for the initial scoring wiring; the tuning checkpoint after Phase 38 (see Pitfall 3) for the pick-rate measurement across the full matrix.

---

### Pitfall 5: Converting passive Special Skills to actives breaks the "one good, one bad" identity contracts pinned by tests

**What goes wrong:**
Phase 24 (v1.2) built a 70-test `identity-contract` suite proving every sub-class and race has exactly one code-verified good trait and one bad trait (Fridgian hide/frenzy, Dwarven half-armor-wear, Woodsman armor gate, Cloaker unseen-only, Pilfer heal-only, Bard camp-wake, Cutthroat/Wilmsry Joiner refusals, etc. — all "zero-draw" per `docs/CLASS-PASS.md`). This milestone's user decision is "BOTH: convert the Special Skills that make sense into activated cooldown abilities AND add a level-up pool." Converting a passive good/bad trait into an activated ability changes *when* and *how often* its effect fires (from "always on" to "usable every N squares"), which can silently weaken or strengthen the very trait the identity-contract test was written to pin, or can remove a trait's balancing "always-on cost" while keeping its benefit as an on-demand button.

**Why it happens:**
The identity-contract tests assert *current* code behavior, not the *design intent* behind it — a mechanical passive-to-active conversion can pass every existing assertion (because the assertions were about the passive shape) while quietly making the trait strictly better (an on-demand version of an always-on debuff, e.g. Fridgian frenzy, is normally an upgrade unless the cooldown is calibrated to cost more than the passive's downside).

**How to avoid:**
Before converting any passive to an active, list it against `docs/CLASS-PASS.md`'s good/bad table and explicitly re-derive whether the trait was previously a "good" or a "bad" — a converted "bad" (e.g. a mandatory downside) must convert to something that still costs the player something (a real cooldown, a resource spend, a situational trigger), not become a free upgrade. Update the identity-contract test suite *in the same phase* to assert the new activated shape (mirroring how Phase 31's Elven `foeToHit` flip and Afraid-penalty ruling were each landed with an explicit "DELIBERATE RULES CHANGE" comment and a re-verified contract, never a silent overwrite). Run the full 143-cell matrix per sub-class before/after its own conversion, not just once at the end, since a single sub's identity shift can be masked by the milestone's aggregate averages.

**Warning signs:**
`identity-contract.test.js` (or its Phase 24 successor) still passing after a conversion despite the trait's practical frequency/power changing — a green suite is not proof of preserved balance here, only proof the *shape* assertions still hold; cross-check against the matrix numbers, not just the test file.

**Phase to address:**
Phase 37 (melee active abilities) — the plan must enumerate every passive being converted against the existing good/bad table before implementation, and the identity-contract suite update is an explicit deliverable of that phase, not deferred to Phase 41's clarity pass.

---

### Pitfall 6: Phobia triggers on water/darkness fire too often and become a permanent penalty rather than an occasional one

**What goes wrong:**
The milestone requires "every phobia has a real trigger," including terrain-based ones (Bodies-of-water on every water square, Darkness on every dark floor). If water squares or dark floors are common at depth (a "blue multi-square pool like dark blobs" implies density similar to existing dark-blob generation), a phobic character could re-trigger the Afraid penalty (−3 to-hit-need, half damage, per Phase 31's ruling) on nearly every step through a long water/dark stretch, turning a supposed "spice" mechanic into a near-permanent debuff for that one character — directly contradicting the Phase 31 user ruling that phobia must be "a penalty, never a lost action" (i.e., never state-crushing).

**Why it happens:**
Terrain-driven triggers fire on *entry into a terrain type*, and terrain regions are often multi-square by design (the milestone explicitly compares water pools to "dark blobs" — already a multi-square generation pattern in `engine/difficulty.js`'s `DARK_BLOB_CAP`/`DARK_RADIUS_*`). Without a cooldown or "already afraid, don't re-trigger" guard, walking N squares through one pool re-rolls (or re-applies) the phobia N times, stacking or perpetually refreshing the 2-round Afraid window.

**How to avoid:**
Gate terrain-triggered phobia the same way a single afraid-state already gates itself — re-trigger only on a **fresh entry** (crossing from non-water/non-dark into water/dark), not on every step already inside the region, and let the existing Afraid duration (2 rounds, but here "rounds" doesn't exist outside combat, so define an equivalent step-count) expire naturally before it can re-trigger from continued presence. Explicitly playtest (bot + human) a "swim across a large lake" and "cross a large dark floor" scenario and confirm the character is not permanently Afraid for the whole traversal. Treat this as one of the situations the class-matrix bot should specifically report on (percentage of steps spent Afraid, not just trigger count).

**Warning signs:**
A bot transcript showing a phobic character Afraid for 80%+ of a floor's steps; a human playtester reporting "I just can't do anything in the water level" during UAT.

**Phase to address:**
Phase 39 (Phobias, water & darkness) — the phase plan should define the entry-vs-continuation trigger rule explicitly and add a regression test asserting a multi-square traversal only triggers once per contiguous region.

---

### Pitfall 7: Timed map reveal and the 3×3 dark view collide with existing fog/memory rendering and canvas repaint cost

**What goes wrong:**
Two new vision mechanics land in the same milestone: Detect Magic becomes a **timed** map reveal (was permanent), and dark floors now render only a **3×3** viewport around the party with "explored squares fogged until you leave the dark." Both change what "previously seen" means on the canvas. A naive implementation can (a) permanently un-fog squares that a timed reveal only temporarily lit, once its timer expires, because the renderer doesn't distinguish "temporarily lit by a spell" from "permanently explored," or (b) re-fog squares that were legitimately explored *before* entering a dark region, incorrectly treating "currently outside the 3×3 dark radius" as "never seen." Both are visible, immediately obvious bugs to a player, and both interact with the party-pulse-ring perf issue already found and fixed in the v1.4 device round (`box-shadow` animation caused whole-layer repaints) — adding a second dynamic fog layer that repaints every step is a fresh perf risk on mid-range phones.

**Why it happens:**
The existing map renderer (`mapMarks.js`, v1.4 Phase 35) was built around a binary "seen/unseen" model with a `darkFor` counter that already gates *rendering*, not just gameplay (`engine/movement.js`'s `darkFor` decrements per step and the map renderer must already special-case it for the existing darkness mechanic per `docs/DIFFICULTY-RETUNE.md`'s "darkness held through floor 3" note). Layering a *second*, spell-driven temporary-visibility state on top of a *third*, terrain-driven 3×3-view state without a single unified "what does this cell render as right now" function risks three independent booleans (explored-ever / lit-by-spell-now / inside-dark-radius-now) interacting incorrectly.

**How to avoid:**
Design one explicit precedence function for cell render state (explored history is permanent and monotonic; spell-lit and dark-radius are both *transient overlays* on top of it, never mutating the permanent explored set) before touching the canvas code — write this as a pure, unit-testable function in a `src/browser/` view-model module (following the `mapMarks.js`/`fightLog.js` precedent of pure, DOM-free presentation modules) so it can be tested without a canvas at all. For perf, reuse the v1.4 fix's lesson directly: any newly-added per-step visual overlay (a "revealed for N more turns" pulse, a dark-vignette effect) must be composited/paused the same way the party-pulse ring was fixed, not re-triggering a full canvas repaint on every render tick.

**Warning signs:**
A player walks through a dark region, backtracks, and sees previously-explored cells outside the 3×3 as freshly fogged; a timed map-reveal's effect persists on the canvas after its counter hits zero; frame-rate drop reports specifically inside dark/water regions during the Pixel-7 UAT batch.

**Phase to address:**
Phase 39 (Phobias, water & darkness) for the 3×3 dark-view renderer; Phase 36 (Spell rework) for the timed-reveal expiry — both should share one render-state-precedence helper landed once, not duplicated.

---

### Pitfall 8: New equipment slot-uniqueness rules orphan items already equipped in old saves

**What goes wrong:**
"One worn item per slot type (ring/bracelet/cloak/…), no stacking of a type" is a new *rule*, not a new field — but if a player's existing save already has two rings equipped (legal under the old rules), the new invariant is violated the instant that save loads. A naive implementation either (a) crashes/asserts on load, (b) silently drops one ring without telling the player, or (c) lets the illegal double-equip persist forever because nothing re-validates old state.

**Why it happens:**
Every prior migration in this codebase has been **additive** (a new field with a safe absent-default — `stripDarkForField`/`stripFlightFields`/`stripBagField`/`stripFoeEffectField` in `test/parity/harness/comparables.js` are all this shape). A slot-uniqueness rule is the first *restrictive* migration this project has needed — it must actively reconcile pre-existing state, not just tolerate a missing field.

**How to avoid:**
Write an explicit one-time load-path migration ("if two items claim the same exclusive slot, keep the first/best by some documented rule and move the other to the bag") and **narrate it** — do not silently mutate a player's inventory without a rail/Oracle line, per the milestone's own "clarity" ethos. This is a genuinely new kind of parity carve-out: add a `stripXxxField`-style comparable helper if the migration touches any fixture-exposed path (unlikely here since fixtures are frozen pre-milestone saves, but check), and add a dedicated round-trip test constructing a synthetic "illegal old save" (two rings equipped) and asserting it loads into a legal, narrated state.

**Warning signs:**
A crash or silent item loss reported by a beta tester loading their existing save after the update; the migration test suite has no test that constructs a pre-milestone illegal-equip save.

**Phase to address:**
Phase 38 (Gear & magic-item rework) — the slot-uniqueness rule and its load-time migration must land together, with a dedicated migration test, before the phase is considered done.

---

### Pitfall 9: Cutthroat murder odds feel like a bug instead of the joke they're meant to be

**What goes wrong:**
"Each descent carries a small chance the Cutthroat murders them" is deliberately funny/dark, but a low, silent, unexplained chance of losing a party member outside of any visible mechanic reads to most players as data corruption or a crash, not comedy — especially in a game whose entire voice design (sarcastic Oracle, "play-the-hand-you're-dealt" tone) depends on *narrating* misfortune, never just inflicting it silently.

**Why it happens:**
The temptation is to implement this as a quiet background roll each `newDay()`/descend with no dedicated event type, reusing an existing generic "member lost" path — but the game already has a strong precedent (Phase 25.1) that a Joiner's departure must always be narrated with specific snark ("a full party swaps its Joiner with one of five exit lines, zero rng"). A silent Cutthroat murder is a regression from that established bar.

**How to avoid:**
Give the murder its own event type with its own `EVENT_NARRATION` entry (see Pitfall 11) and its own dedicated, written-for-the-joke line(s) — reuse the Phase 25.1 "five exit lines" pattern rather than a single generic string, so repeat occurrences don't feel copy-pasted. Keep the odds low and **explicitly documented** in the character's own flavor text or a rail card the first time a Cutthroat joins ("don't turn your back"), so a player who loses a companion this way can trace it to a known, named risk rather than experiencing it as an unexplained bug report. Treat the Cutthroat's existing "never parley"-style bad trait (Phase 24) and this new murder risk as needing a matching identity-contract review (Pitfall 5) — stacking two bads without revisiting the "good" side breaks the one-good-one-bad contract for this specific sub-class's Joiner behavior.

**Warning signs:**
A UAT report reading "my joiner just vanished, is that a bug?"; the murder event routed through a generic toast string instead of a dedicated narrated line; no rail/onboarding hint exists anywhere that a Cutthroat companion carries this risk.

**Phase to address:**
Phase 40 (Flee retune, Cutthroat Joiner, dead-foe targeting).

---

### Pitfall 10: Dead-foe auto-retarget races the Phase 32 guarded tap

**What goes wrong:**
Targeting today is a **shell-only** mutation (`S.combat.target = i`, wrapped in `guardTap` since Phase 34's CSCR-08 fix) — there is no engine `retarget` action (an explicit, recorded Key Decision). Auto-switching the target to the next live foe the instant the current target dies means the shell mutates `S.combat.target` asynchronously relative to the player's own tap stream. If a player taps foe-card index 2 right as it dies (their own killing blow, or an ally's), the auto-retarget could reassign `target` between the tap being queued and processed, or — worse — a queued tap for the now-dead foe's index could land on whatever *new* foe the auto-retarget just placed at that index, striking a foe the player never intended to hit.

**Why it happens:**
`src/browser/inputGuards.js`'s two guards (`isArmed`/`isSettled`, both 250ms `Date.now()` windows) exist specifically because rapid render/dismiss cycles create exactly this kind of race on freshly-rendered buttons and just-dismissed overlays. Auto-retarget is a *third* rapid state-mutation event (alongside "button just rendered" and "overlay just dismissed") that the current guard set was never designed around, since it didn't exist when Phase 32 shipped.

**How to avoid:**
Route the auto-retarget through the same guarded-mutation discipline as the existing `guardTap`-wrapped targeting call, and re-stamp the affected foe-card buttons' `renderedAt` the moment a retarget happens (reusing `isArmed`'s existing fail-open/arm-delay pattern) so a tap arriving in the same input frame as the retarget is deliberately ignored rather than landing on the wrong foe. Add a dedicated test in the input-guards suite simulating "foe N dies, retarget fires, a tap for index N arrives within ARM_DELAY_MS" and assert it's swallowed, not misrouted.

**Warning signs:**
A UAT report of "I killed one foe and immediately hit a foe I never selected"; a fast-tapping playtester reporting a strike landing on the wrong enemy right after a kill.

**Phase to address:**
Phase 40 (dead-foe targeting) — must explicitly extend `inputGuards.js`'s test coverage, not just add the retarget logic in isolation.

---

### Pitfall 11: Oracle "cause naming" implemented as ad-hoc string edits instead of through the EVENT_NARRATION/toasts coverage guard

**What goes wrong:**
The clarity pass requires every Oracle/rail line to name its cause (the milestone's own example: "the 'Four walls and one door you already used' line is the Being-trapped phobia and must say so"). The lazy path is to hand-edit existing narration strings in `src/browser/eventNarration.js`/`toasts.js` in place. But this project has a standing, tested invariant: `TOAST_FOR` is exactly the verified set-complement of `ORACLE_ONLY` within `EVENT_NARRATION`'s full event-type universe (`toastsCoverage.test.js`, `formatEventsCoverage.test.js` — both are coverage **guards**, not just content tests). Editing text without going through the same event-payload/narration-table discipline used for every prior feature (Phase 25's "pure toast table exactly partitioning all 209 engine event types") risks two failure modes: (a) a new cause-naming variant introduced as a brand-new event type that never gets added to either table, silently failing the coverage guard, or (b) a cause name baked into a *string template* rather than sourced from the event's own payload, so it drifts out of sync the next time the underlying mechanic changes (exactly the kind of drift the coverage guard exists to prevent).

**Why it happens:**
"Just add a clause to the existing string" feels like a copy change, not an engine change, so it's tempting to skip the additive-event-payload discipline the project has otherwise followed rigidly (Phase 25: "passive modifiers surfaced as additive event payload").

**How to avoid:**
Any cause-naming addition should be sourced from **existing or newly-added event payload fields** (e.g., a phobia-triggered penalty event should already carry — or gain — a `cause: "trapped"`/`cause: "darkness"` field) and rendered through the existing narration pipeline, never a hand-written duplicate string. Run the full coverage-guard suite (`toastsCoverage.test.js`, `formatEventsCoverage.test.js`) after every new/changed event type as a hard gate, exactly as Phase 25 did, and add the new cause fields to any of the three parity comparables if a fixture-exposed path emits them.

**Warning signs:**
`toastsCoverage.test.js` fails after a "just copy" change (good — it caught it); a grep for the literal phobia name inside a hard-coded template string in `eventNarration.js` instead of a payload-driven interpolation (bad — found it too late).

**Phase to address:**
Phase 41 (Clarity pass) — but every earlier phase (36-40) that introduces a new refusal/penalty/trigger should proactively add its own `cause` payload field at the point of introduction, so Phase 41 is a wiring pass over already-labeled events, not a scramble to retrofit causes onto untagged ones.

---

### Pitfall 12: Voice regressions from a large volume of new flavor lines slip past the safety scan's actual coverage

**What goes wrong:**
This milestone needs a large amount of new copy — new spell/item/ability flavor text, five-ish Cutthroat murder lines, new phobia trigger lines, new loot-gating "(usable by …)" strings, per-camp ration copy. `test/voice/safety-scan.test.js` exists and gates the family-friendly voice constraint, but a scan is only as good as what it actually checks (a banned-word/pattern list) — it will not catch tone drift into genuinely dark or mean-spirited territory (e.g., a Cutthroat murder line that reads as actually menacing rather than darkly comic) if that drift doesn't trip any of its literal patterns.

**Why it happens:**
High-volume copy writing under a large milestone (six major feature areas) creates pressure to bulk-generate lines quickly; the safety scan gives false confidence that "passing the test = the voice is right," when the test can only catch the profanity/gore/adult-content floor, not the "is this still funny and not just morbid" ceiling the project's tone actually depends on.

**How to avoid:**
Keep `safety-scan.test.js` as the hard automated gate (it must stay green), but treat it as necessary, not sufficient — batch all-new flavor copy for a lightweight human tone read (the same instinct behind the project's existing DR-round practice of small, human-reviewed batches) before or alongside the automated scan, specifically for the higher-risk lines (Cutthroat murder, permadeath-adjacent phobia lines). Reuse the project's own established voice precedent directly: "lean into humor when class/race works against the player" (a recorded Key Decision) as the explicit bar for the new murder/phobia copy, not just "not profane."

**Warning signs:**
`safety-scan.test.js` green but a UAT reviewer flags a specific line as "actually kind of dark, not funny" — a real prior risk category for this milestone given the Cutthroat and phobia content specifically deal with loss/fear.

**Phase to address:**
Every phase generating new copy (36-41), with a lightweight tone read folded into each phase's own closeout rather than deferred entirely to the end-of-milestone UAT batch — voice issues are cheaper to fix per-phase than to rewrite in bulk at the end.

---

### Pitfall 13: Scope explosion — this milestone touches nearly every system at once, breaking the project's own phased-isolation discipline

**What goes wrong:**
Every prior milestone in this project's history isolated its power/balance changes to one or two systems per phase specifically so the parity suite and the class-matrix bot could attribute any drift to a single, known cause (e.g., Phase 18 = bestiary only, Phase 20 = parley only, Phase 23 = casters only). v1.5 explicitly spans spells, melee abilities, gear/items, terrain/phobias, flee math, joiner behavior, and targeting — six of the game's largest systems — inside one milestone. If phases run with heavy overlap or out of dependency order, a difficulty/parity regression discovered late becomes very expensive to root-cause, because multiple simultaneous power changes are candidate causes.

**Why it happens:**
The milestone was scoped by *feature area* (what the player experiences) rather than by *system dependency* (what must land first for later phases to measure correctly) — a natural and reasonable way to scope a milestone from the user's perspective, but it creates exactly the multi-variable-change risk the project's own tuning methodology (`docs/DIFFICULTY-RETUNE.md`'s "ONE consolidated difficulty retune... rather than three" lesson) was designed to prevent, just at the milestone-internal scale this time instead of across milestones.

**How to avoid:**
Sequence phases so each is independently measurable before the next lands: spells (36) and gear (38) are both power-additive and should land with their own class-matrix checkpoints (Pitfall 3) *before* Phase 39 changes survivability (phobia/water) and Phase 40 changes flee math — retuning survivability against a moving player-power target is far harder than retuning it once power is settled. Keep the engine gate's existing per-phase discipline explicit for each of the six areas (its own declared divergences, its own fixture check) rather than batching declarations at milestone close. If a mid-milestone parity or balance regression appears, use the existing bisection tools (pinned commits like `docs/CLASS-PASS.md`'s `5565b22`/`d1e3235` pins) rather than guessing which of six simultaneous changes caused it.

**Warning signs:**
A milestone-close matrix run showing a large aggregate shift with no single phase's own before/after ledger explaining it; a parity failure whose root cause requires `git bisect` across multiple phases instead of one.

**Phase to address:**
Roadmap-level — the phase *ordering* itself (spells/gear power-first, survivability-and-social-mechanics second, clarity/UI last) is the mitigation, not any single phase's content.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Hand-coding a new item's cooldown check inline at its use site instead of a shared cooldown helper | Faster to ship one item | Every future item reinvents tick/serialize/migrate logic, multiplying Pitfall 2's risk surface | Never for the first magic item with a cooldown — acceptable only for a second/third item once the shared helper exists and is reused |
| Reusing an existing generic toast string for a new refusal reason ("You can't do that") instead of a dedicated cause | Zero new narration wiring | Directly regresses the milestone's own "clarity" goal and risks Pitfall 11's coverage-guard drift | Never in this milestone — clarity is the explicit deliverable |
| Skipping a bot-scoring update for a new spell/ability "for now, will add later" | Ships content on schedule | The matrix run is blind to it (Pitfall 4), and "later" tends to slip past the tuning checkpoint | Only acceptable if the spell/ability is explicitly flagged out-of-scope for the matrix in the phase's own ledger, with a follow-up owed before milestone close |
| Regenerating a parity fixture instead of writing a narrow strip/reconcile helper for a new field | Faster than writing a `stripXxxField` helper | Loses the specific divergence being proven byte-identical elsewhere; violates the project's own "master never edited, fixtures narrowly carved out" discipline | Never — every prior phase in this project's history has used the narrow-strip pattern instead |

## Integration Gotchas

Not applicable in the conventional sense (no external services; the app is offline). The closest analogs are internal seam integrations:

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| New engine action ↔ `tools/lib/tuning-bot.mjs` | Adding a new action type (`useMagicItem`, `activateAbility`) without updating `decideAction`'s dispatch | Every new action type needs a corresponding bot policy branch in the same phase, or the matrix silently never exercises it (Pitfall 3/4) |
| New event type ↔ `EVENT_NARRATION`/`toasts.js` | Emitting a new event and manually writing UI copy inline at the call site | Route every new event through the `EVENT_NARRATION`/`TOAST_FOR`/`ORACLE_ONLY` tables and let the coverage guard (`toastsCoverage.test.js`) prove completeness |
| New serialized field ↔ `test/parity/harness/comparables.js` | Forgetting to add the field to all three `*Comparable()` functions (movement/combat/economy) | Every new field needs the strip/reconcile treatment in all three, following the `stripDarkForField`/`stripFlightFields`/`stripBagField` precedent chain, even if only one comparable's fixtures currently reach it (future-proofing, per `stripFoeEffectField`'s own stated rationale) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Per-step canvas repaint for a new visual overlay (dark 3×3 vignette, timed-reveal pulse) | Frame drops specifically inside water/dark regions on the Pixel 7 | Composite/pause the overlay exactly like the v1.4 party-pulse-ring fix (paused under overlays, avoid `box-shadow`-style whole-layer repaint properties) | Noticeable on mid-range phones the moment two dynamic overlays (dark vignette + party pulse) run simultaneously |
| A cooldown/duration counter recomputed by re-deriving from absolute timestamps instead of a decrementing integer | Desyncs after a save/load round-trip if wall-clock time is ever involved | Follow the existing `darkFor`/`f.cd` integer-decrement idiom exclusively — no wall-clock timers anywhere in the deterministic engine | The instant a timer is defined in real seconds instead of discrete steps/rounds — breaks determinism itself, not just performance |
| Matrix runs (`tools/tune-classes.mjs`) re-run at full 143-cell × N-seed volume after every small content tweak | Multi-minute turnaround discourages frequent checks, so drift accumulates between checks | Use a smaller seed count / targeted subset (the affected sub-classes only) for iterative checks, reserving the full matrix for phase-close verification | Becomes a bottleneck if run naively after every single spell/item edit across a 6-feature-area milestone |

## Security Mistakes

Not a networked app (fully offline, no accounts, no backend) — conventional security categories mostly don't apply. The one domain-relevant category:

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting an old save's shape without validation when adding restrictive migrations (slot uniqueness, new required fields) | A malformed or pre-milestone save could crash the app on load, effectively "bricking" a player's local save (their only copy — no cloud save) | Fail-closed but *recoverable*: validate on load, migrate/narrate rather than throw, following the project's existing "fail-closed validation" save-load principle already stated in PROJECT.md's Validated requirements |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| A "usable by …" loot-gating label that names a class the player's own hero/joiner isn't, with no indication of *why* it's shown at all | Player thinks the game is showing them useless loot on purpose, feels like clutter rather than information | Show the gating label always, but visually distinguish "usable by you now" vs. "not for you" the way the existing gear split (On You / Bag) already separates concerns — this is exactly the clarity pass's own stated goal, so treat it as core UI, not a caption |
| Rations-per-camp shown on the Hero screen but the actual Make Camp refusal (already narrated per-Phase-25.1: "You eat N a night, you have M") uses different numbers or timing than the Hero screen's display | Player camps expecting to succeed, gets refused, loses trust in the displayed number | Source both displays from the exact same computed value/function, never two independent calculations of "rations needed" |
| A magic item's "cooldown in squares" shown only as a raw number with no indication of *when* the countdown last ticked | Player can't tell if the item is "almost ready" or "just used," leading to repeated failed-use taps | Surface a live countdown (squares remaining) the same way the existing Shield/Acuteness chips already show pool + rounds remaining (Phase 31 precedent) |

## "Looks Done But Isn't" Checklist

- [ ] **New spell/ability added to content tables:** Often missing a `chooseSpell`/`decideAction` scoring branch in `tools/lib/tuning-bot.mjs` — verify the matrix transcripts actually show it being selected at least once across the full run.
- [ ] **New event type for a refusal/trigger/cause:** Often missing its `EVENT_NARRATION` entry and `TOAST_FOR`/`ORACLE_ONLY` classification — verify `toastsCoverage.test.js`/`formatEventsCoverage.test.js` still pass (they will fail loudly if missing, but only if run).
- [ ] **New serialized field (cooldown, duration, slot state):** Often missing from one or more of the three `*Comparable()` functions in `test/parity/harness/comparables.js` — verify by grepping the new field name across `movementComparable`/`combatComparable`/`economyComparable`.
- [ ] **New rng draw in an existing function:** Often inserted in the "logical" place in the function body rather than strictly after all pre-existing draws — verify against a fresh draw-count pin, not visual code review alone.
- [ ] **Passive-to-active skill conversion:** Often leaves the old identity-contract test passing on its old (now-stale) assertion shape — verify the assertion itself was updated to describe the *new* activated behavior, not just that it still returns green.
- [ ] **Old-save compatibility for any new restrictive rule (slot uniqueness, etc.):** Often only tested against freshly-`newRun()`-generated state — verify with a synthetic "pre-milestone illegal state" fixture that never had the rule to begin with.
- [ ] **New flavor/narrative copy volume:** Often assumed "safe" because `safety-scan.test.js` passes — verify with an actual human tone read for the higher-risk lines (Cutthroat murder, phobia/darkness copy).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| RNG-order regression caught by parity suite | LOW | Diff the failing fixture's per-action bytes, locate the inserted draw, move it after existing draws or gate it behind a feature flag; re-run `npm test` |
| Power creep discovered only at milestone close (matrix run shows major drift) | HIGH | Bisect by phase using the pinned commits (`docs/CLASS-PASS.md` precedent); may require reverting one phase's power numbers and re-running the matrix rather than hand-guessing a global damping constant |
| Cooldown/duration desync found in production (via a UAT report) | MEDIUM | Identify whether the timer is step- or round-scoped, correct the single tick call site, add the missing round-trip test that would have caught it, ship as a quick task (project precedent: several such fixes have landed as `/gsd-fast` quick tasks post-DR-round) |
| Old-save migration crash reported by a beta tester | MEDIUM | Add the missing load-time reconciliation, narrate the fix, and treat it exactly like the v1.4 DR-round bug fixes (fast-fix + versionCode bump to internal testing) |
| Voice/tone miss found in UAT | LOW | Rewrite the specific line(s); no code change needed if the narration is payload-driven (Pitfall 11) rather than hard-coded per-event |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. RNG-order regression | All phases (36-41) | `npm test` full parity suite green with zero unexpected fixture diffs; explicit draw-count table in each phase's plan |
| 2. Cooldown/duration desync & save/load | 37 (melee actives), 38 (gear/items) | Round-trip serialize/deserialize test per new timer; old-save-without-field load test |
| 3. Power creep / curve drift | Tuning checkpoint after 36-38 | Fresh `tools/tune-classes.mjs` BEFORE/AFTER matrix diffed via `tools/class-pass-diff.mjs`; bot updated to use new content first |
| 4. Situational spells never picked | 36 (spell rework); measured at the post-38 tuning checkpoint | Bot pick-rate column in the class-pass ledger; UAT check for player awareness of trigger conditions |
| 5. Passive→active identity-contract breakage | 37 (melee actives) | Identity-contract suite updated in the same phase, re-verified against the good/bad table, not just left green |
| 6. Phobia over-triggering on terrain | 39 (phobias/water/darkness) | New regression test: multi-square traversal triggers Afraid once, not per-step |
| 7. Fog/reveal rendering bugs & repaint cost | 36 (timed reveal), 39 (3×3 dark view) | Pure render-state-precedence unit test; perf check on Pixel 7 specifically inside dark/water regions |
| 8. Slot-uniqueness orphaning old saves | 38 (gear/magic items) | Synthetic illegal-old-save migration test |
| 9. Cutthroat murder feels like a bug | 40 (Cutthroat Joiner) | Dedicated narrated event type with multiple flavor lines; identity-contract review of the Cutthroat's good/bad balance |
| 10. Dead-foe retarget races guarded tap | 40 (dead-foe targeting) | New `inputGuards.js` test simulating retarget-during-tap race |
| 11. Ad-hoc cause naming bypassing narration guard | 41 (clarity pass), proactively in 36-40 | `toastsCoverage.test.js`/`formatEventsCoverage.test.js` stay green; causes sourced from event payload, not hard-coded strings |
| 12. Voice regressions in bulk new copy | Every copy-generating phase (36-41) | `safety-scan.test.js` green PLUS a human tone read per phase |
| 13. Scope explosion across six systems | Roadmap-level phase ordering | Power-first (36/38) before survivability (39/40) before UI clarity (41); per-phase divergence ledgers instead of one milestone-end batch |

## Sources

- Direct inspection: `C:\projects\mazeworld\engine\rng.js` (single mulberry32 stream, strict call-order determinism)
- Direct inspection: `C:\projects\mazeworld\test\parity\harness\comparables.js` (the full carve-out precedent chain: `stripDarkForField`, `stripFlightFields`, `stripBagField`, `stripFoeEffectField`, `stripNameField`, `stripBagArmorFields`, `reconcilePendingFind`/`reconcilePendingLoot`/`reconcilePendingFight`, action-path divergence records)
- Direct inspection: `C:\projects\mazeworld\src\browser\inputGuards.js` (`ARM_DELAY_MS`/`DISMISS_SETTLE_MS`, fail-open design)
- Direct inspection: `C:\projects\mazeworld\engine\foeAbilities.js` (`tickAbilityCooldowns`/`firstReadyAbility` — the existing per-foe cooldown precedent) and `C:\projects\mazeworld\engine\movement.js` (`c.darkFor` per-step decrement precedent)
- Direct inspection: `C:\projects\mazeworld\docs\CLASS-PASS.md` and `C:\projects\mazeworld\docs\DIFFICULTY-RETUNE.md` (bot scoring table, matrix methodology, target-band philosophy, prior under-measurement caveat)
- Direct inspection: `C:\projects\mazeworld\.planning\PROJECT.md` and `C:\projects\mazeworld\.planning\STATE.md` (Key Decisions log — Afraid-penalty ruling, Elven `foeToHit` flip, storeRoll/pendingLoot/dev flag precedent, "one good one bad" identity-contract history, RAIL/toast retirement, guardTap CSCR-08 fix, MAJOR OVERLAY "no retarget engine action" decision)
- Direct inspection: `C:\projects\mazeworld\.planning\MILESTONES.md` (v1.2-v1.4 retrospective accomplishments and known gaps, the party-pulse-ring perf fix, the device-round finding pattern)
- Grep survey: `test/voice/safety-scan.test.js`, `test/unit/toastsCoverage.test.js`, `test/unit/formatEventsCoverage.test.js` (existing automated guards this milestone must keep green)
- Grep survey: `content/afflictions.js` (existing phobia table shape, `phobia: true` rows) and engine-side `cutthroat`/`wilmsry` references across `economy.js`/`movement.js`/`combat.js`/`encounters.js` (existing sub-class-specific behavior precedent)

---
*Pitfalls research for: Delve, Die, Repeat — v1.5 Meaningful Choices milestone*
*Researched: 2026-09-17*
