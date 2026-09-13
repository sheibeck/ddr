# Pitfalls Research

**Domain:** Adding foe spellcasting/abilities, rebalancing the bestiary, retuning a global difficulty curve, and rebalancing negotiation mechanics — in a deterministic, parity-frozen, permadeath, offline mobile roguelike (Delve, Die, Repeat / "Mazeworld" v1.1 "Monster Balancing & Abilities")
**Researched:** 2026-09-13
**Confidence:** HIGH for repo-grounded findings (direct code read of `engine/combat.js`, `engine/magic.js`, `engine/difficulty.js`, `engine/saveState.js`, `test/parity/harness/comparables.js`, `content/bestiary.js`, `test/parity/fixtures/*`, `test/voice/safety-scan.test.js`, `test/unit/formatEventsCoverage.test.js`, and v1.0 phase summaries); MEDIUM for general deterministic-RNG-game and difficulty-tuning industry patterns (web search, not project-specific).

## Critical Pitfalls

### Pitfall 1: An unconditional "does this foe cast?" roll leaks a new RNG draw into every fight, not just caster fights

**What goes wrong:**
A naive implementation adds a per-foe-swing check like "roll d20, if ≤X the foe casts instead of striking" as an unconditional branch inside `foeTurn`'s swing loop. Because that roll runs for *every* foe on *every* swing, it silently changes the RNG draw order for `Beasts`/`Humans` encounters too — including the exact forced-encounter fixtures the frozen parity suite pins (`test/parity/fixtures/action-script.combat.json` only forces `"Beasts"` and `"Humans"`). The full suite goes red everywhere, not just where casters live, and the failure looks like "everything broke" rather than "casting broke."

**Why it happens:**
`engine/combat.js`'s `foeTurn` (lines 819-990) already has the exact right pattern to imitate — `const swings = (f.frenzied ? 2 : 1) * ((f.sp && f.sp.atk) || 1);` and the party-target roll gated behind `if (liveMembers.length)` (line 862) — every extra draw in this file is gated behind a data flag or a non-empty collection, never unconditional. It's easy to miss that discipline when bolting on a brand-new decision branch, because "roll to decide" feels like ordinary game logic, not a parity hazard.

**How to avoid:**
Gate the cast-vs-strike roll behind `f.sp && f.sp.caster` (the exact flag `content/bestiary.js` already carries on Djinni/Krupke/Drudge/Vampire — see Pitfall 2) so the draw is **only ever taken for foes flagged as casters**. A foe with no `sp.caster` must consume *zero* additional rng calls versus today, for every single code path. Add an explicit regression test asserting a non-caster fixture (e.g. a `Beasts` fixture) draws the identical number of `rng.d()` calls before and after the feature lands (count draws via a spy `rng`, not just compare final state).

**Warning signs:**
`npm test` fails broadly across combat/movement/economy parity (not just a new caster-specific test) the moment the ability system lands; `test/parity/full-suite.test.js` diverges on fixtures that were never touched by design.

**Phase to address:**
Foe abilities/spellcasting phase (first phase of the milestone) — this is the load-bearing determinism gate for the entire feature, must be locked before any bestiary rebalance work builds on top of it.

---

### Pitfall 2: Treating `sp.caster` as inert flavor when generalizing — or forgetting it already exists

**What goes wrong:**
Two opposite failures are equally likely. (a) The team invents a whole new ability-authoring format (separate from `sp.*`) without noticing the bestiary *already* has `sp.caster: true` on four creatures (Djinni L5-Magical, Krupke L4-Demons, Drudge L4-Magical ×2 depth tiers, Vampire L5-Walking-Dead) with flavor text reading "casts every spell of levels 1 to 4," "master of every offensive spell," "casts every offensive spell ... without limit" — duplicating authoring effort and creating two parallel systems. (b) The team wires `sp.caster` mechanically but never re-reads `content/bestiary.js`'s other already-authored-but-inert flags (`poison`, `disease`, `awe`, `enthrall`, `grapple`, `entangle`, `possess`, `raise`, `shriek`, `quills`, `pursues`, `seesInvis`, `noTurn`, `never_melee`, `dark`, `every`) that `engine/combat.js`'s own module header explicitly documents as "flavor-only in the frozen prototype... only `sp.atk`, `sp.dmg`, `sp.toHit`, `sp.fast`, `sp.magicOnly`, `sp.noArmor`, and `sp.twice` ... have any mechanical effect" — so the "invent only to fill depth-band gaps" mandate gets violated by inventing brand-new abilities while a rulebook-canon flag (`awe`, `possess`, `shriek`, `never_melee`, `seesInvis`) sits right there unused.

**Why it happens:**
The prototype's bestiary was authored with rulebook-faithful flavor text describing abilities the 1994 tabletop game had, but the solo JS port never mechanized most of them (documented directly in `combat.js`'s header as a known, deliberate fidelity gap — "port what the prototype DOES, not what its comments imply"). A milestone that starts from "add foe abilities" without first re-auditing `content/bestiary.js`'s existing `sp.*` vocabulary will duplicate or contradict canon that's already sitting in the data.

**How to avoid:**
Before designing new ability syntax, grep `content/bestiary.js` for every `sp.*` key and cross-reference each against `combat.js`'s "flavor-only" list. Mechanize the already-authored, rulebook-sourced ones first (`caster`, `awe`, `possess`, `shriek`, `never_melee`, `poison`, `disease`, `entangle`) before inventing anything new — this is the literal reading of "rulebook-first, invent only to fill depth-band gaps."

**Warning signs:**
A design doc for the ability system that never mentions `content/bestiary.js`'s existing `sp.caster`/`sp.awe`/etc. flags; two different data shapes for "what a monster can do" living side by side after the phase ships.

**Phase to address:**
Foe abilities design/research sub-phase, before any implementation task is planned.

---

### Pitfall 3: Activating `sp.caster` is parity-safe for the *frozen fixtures* but parity-blind for the *feature* — false confidence from green tests

**What goes wrong:**
Because the combat-parity fixture only forces `"Beasts"` and `"Humans"` encounters (`test/parity/fixtures/action-script.combat.json`), and every `sp.caster`-flagged creature lives in `Magical`, `Demons`, or `Walking Dead` categories, turning on foe spellcasting can pass the *entire* existing parity suite while the new mechanic itself has zero automated regression coverage from that suite. A bug in the caster-foe code path (crash, wrong target, infinite loop, wrong RNG consumption *among casters themselves*) will not be caught by `npm test` unless the milestone writes brand-new tests for it.

**Why it happens:**
"Full suite green" is treated as "nothing broke," but the frozen suite was authored to protect *existing* behavior, not exercise *new* behavior — it structurally cannot, since the frozen prototype master (`test/parity/prototype-master.js.txt`) predates the feature entirely and can never be edited to add caster-forced fixtures (that file is DO-NOT-EDIT canon).

**How to avoid:**
Treat "full suite green" as necessary but not sufficient. Require new, purpose-built determinism/unit tests that force `Magical`/`Demons`/`Walking Dead` encounters (the same "throwaway seed-discovery script" method the original parity fixtures used, per `test/parity/fixtures/action-script.combat.json`'s own `_note`) and assert: (a) same-seed-same-outcome determinism for caster foes specifically, (b) draw-count parity for non-caster foes (Pitfall 1), (c) every new event type has coverage (Pitfall 8).

**Warning signs:**
The phase's SUMMARY claims "666/666 passing, parity intact" as its *only* evidence that foe casting works correctly.

**Phase to address:**
Foe abilities phase — test-writing task must explicitly target the previously-untested encounter types, not just re-run the existing suite.

---

### Pitfall 4: Bestiary rebalance silently diverges from the frozen prototype's own bestiary numbers — and that's actually *expected*, not a bug, but only if handled deliberately

**What goes wrong:**
`test/parity/harness/sandboxPrototype.js`'s `loadPrototypeSandbox` executes the **frozen, standalone prototype source** (`test/parity/prototype-master.js.txt`) which carries its **own embedded, never-editable bestiary literal** — entirely separate from `content/bestiary.js`, which is what the engine reads. The moment the bestiary rebalance changes an HP/damage/AR number in `content/bestiary.js` for any creature that the `Beasts`- or `Humans`-forced parity fixtures can roll, the engine's foe `wp`/damage numbers will *numerically diverge* from the frozen prototype's — not because of a bug, but because the two sides now intentionally disagree on creature stats. If the team doesn't expect this, it looks like a catastrophic full-suite parity break; if they "fix" it by quietly loosening the comparator instead of documenting the divergence, real regressions get masked forever after.

**Why it happens:**
The whole point of a bestiary rebalance is to change these exact numbers, but the parity harness was built to prove *unchanged* behavior stays byte-identical — it has no built-in concept of "this creature's stats changed on purpose."

**How to avoid:**
Follow the codebase's own established precedent for deliberate divergence (used repeatedly in v1.0: `stripRationsField`, `normalizeHpUnit`, the `+3000→300×depth` wilmst-cache rename) — for every rebalanced creature that a frozen fixture's seed can roll: (1) identify exactly which fixture(s)/seed(s) roll it, (2) add a narrow, named, commented carve-out in `test/parity/harness/comparables.js` for *only* the specific field(s) that were deliberately changed (e.g. strip that one creature's `wp`/`sp.dmg` from the comparison, the same way `stripFoeDamageClosures` already strips `sp.dmg`/`acid.dmg` closures), (3) write a NEW, separate test asserting the new number is what was intended. Never edit the frozen master; never blanket-strip more fields than the specific ones changed.

**Warning signs:**
`npm test` breaks on `combat-parity.test.js` immediately after a bestiary data edit; the "fix" is to strip an entire foe object or the whole `combat` field from comparison rather than the one changed stat.

**Phase to address:**
Bestiary rebalance phase — the plan must enumerate exactly which fixture seeds are affected (a small, fixed set, discoverable by running the existing fixtures against the rebalanced data) before any numbers change.

---

### Pitfall 5: New foe/summon objects violate the codebase's "never splice `C.foes`, only flag `alive=false`" invariant

**What goes wrong:**
Every existing mechanic that removes a foe from the fight (`killFoe`, `insane`'s "flee" branch, `petrify`, `turn`, `gate`) sets `f.alive = false` and zeroes `f.wp` — it never `splice`s the `C.foes` array. `C.target` is a raw array *index* into `C.foes` (`combat.js` line 296-298), and `foeTurn` iterates `C.foes` with a live `for...of` (not a snapshot). A foe-summon ability (the natural mirror of the player's own `castSpell` `"summon"` kind) that pushes a new foe into `C.foes` mid-`foeTurn`, or a "banish" ability that splices a foe out, will either (a) let a freshly-summoned foe act in the *same* round it was summoned (because `for...of` over a growing array visits appended items), unlike the player's own summon precedent where `C.ally` only starts acting on the *next* `afterPlayerAction` cycle, or (b) shift every subsequent foe's array index out from under `C.target`, causing the player to suddenly be "targeting" the wrong foe with no error.

**Why it happens:**
The player-facing summon system (`magic.js`'s `"summon"` kind, `C.ally`) is a totally separate slot from `C.foes`, so there is no existing precedent in this codebase for *adding* to the `C.foes` array at all — a foe-summon ability requires genuinely new code with no copy-paste-safe template, which is exactly when array-mutation bugs slip in.

**How to avoid:**
Mirror the `C.ally`/`C.allies` pattern instead of appending to `C.foes` directly: either (a) give a summoned monster its own `C.summonedFoes` array that `foeTurn` visits only in *subsequent* rounds, or (b) if it must live in `C.foes` for targeting/UI reasons, append-only (never insert/splice), and only allow a summoned foe's first swing on the round *after* the one it appeared in (an explicit "just summoned, skip this round" flag). Add a test that summons a foe mid-fight and asserts it did not also attack that same round, and that `C.target` still points at the same *foe*, not the same *index*, before and after a summon/removal.

**Warning signs:**
A summoned foe's very first appearance in the event log is also a `foeMissed`/`struckByFoe` event in the same combat action; the player's `C.target` visibly "retargets" to a different foe name after a summon with no player input.

**Phase to address:**
Foe abilities phase (summon-type ability specifically) — flag this as a design constraint in the phase plan before implementation starts, not discovered via a bug report.

---

### Pitfall 6: Foe spells that inflict player-side status reuse player-only field names/shapes, corrupting the `endCombat` reset contract or the parity comparators

**What goes wrong:**
`combat.js`'s `endCombat` unconditionally clears `c.regen`, `c.ward`, `c.mirror`, `c.senses` at the end of every fight (line 641-665) — these are all *player-cast, player-benefiting* fields today. If a foe ability is implemented by writing to these exact same fields in the opposite direction (e.g. a foe "curse" that sets `c.ward = null`-defeating negative pool, or reuses `C.weakened`/`C.foeToHitPenalty` — which today are set by the PLAYER's `"weaken"` spell to help the player — to represent a foe *debuffing* the player), the read/write semantics collide: `foeTurn`'s own damage math already reads `C.weakened` as "foe damage is halved" (line 884/902) — a foe ability that also wants to set some *other* penalty on the player must not overload that same flag, or a foe's own "buff self" ability would accidentally weaken itself. Any brand-new per-character field (a poison-DOT counter, a foe-inflicted "cursed" flag, a stun-immunity counter) needs the exact same additive-with-default migration + parity carve-out treatment as `c.darkFor`/`c.flightLeft`/`c.bag` before it — and it needs a place in `endCombat`'s reset list decided deliberately (does a foe-inflicted curse survive to the next fight, like `c.affliction` does, or clear like `c.ward`?).

**Why it happens:**
Reusing an existing field is the path of least resistance when a new ability's *effect* looks similar to an existing spell's effect, but the *direction* (who benefits) and *lifetime* (per-fight vs. persistent) are easy to get backwards under time pressure.

**How to avoid:**
For every new status a foe ability can inflict, explicitly decide and document: (1) is this a brand-new field or a new *value range* on an existing one, (2) does `endCombat` clear it, and (3) does `test/parity/harness/comparables.js` need a new `strip*Field` carve-out in **all three** `*Comparable()` functions (`movementComparable`, `combatComparable`, `economyComparable` — the milestone's own ground rule). Never repurpose a field whose read-site already has an established, opposite-direction meaning.

**Warning signs:**
A foe "weaken-self" or "ward-self" ability that also silently changes how player damage lands; a new engine-only field discovered missing from the parity carve-out only when a *combat* fixture (not the field's own unit test) starts failing.

**Phase to address:**
Foe abilities phase, per-ability design review; the "new field → migration + comparables carve-out" step should be a checklist item on every ability's implementation task, not an afterthought caught in code review.

---

### Pitfall 7: Foe spells feel like "unfair death" without a telegraph, especially combined with permadeath and the existing `C.frozen`/asleep mechanics

**What goes wrong:**
The engine already has two "skip your turn" mechanics that read as punishing when they land back-to-back: `C.frozen` (phobia freeze, `playerStrike` line 290-295 — the *entire* next action is consumed shaking it off) and a foe's own `sp.fast`/`toHit` modifiers that make foes hard to hit. A new foe "stun" ability (the natural mirror of the player's own `magic.js` `"stun"` kind, which currently puts up to `d6 × (level - spell level)` *foes* to sleep) that puts the *player* to sleep/frozen for multiple rounds, especially one with no visible warning before it lands, compounds with permadeath into "I died having taken zero meaningful actions" — the single fastest way to make a paid, no-refund mobile game feel cheap. Likewise, a foe "instant-kill" analog to the player's own `"death"` spell (which currently costs the *caster* 25 wp and requires >26 wp to cast, i.e. a real resource cost and risk) becomes an "unfair death" magnet if ported to foes without an equivalent cost/tell — the player has no counterplay to a spell that appears with zero warning and ends a multi-minute run.

**Why it happens:**
The rulebook-first instinct is to port a spell's *mechanical shape* 1:1 (same die, same effect) without also porting or inventing the *fairness scaffolding* around it — a resource cost, a resistible roll, a visible tell — because the player-side version already has that scaffolding built into its own cost economy (`c.spellsUsed`/`maxCharges`), which a foe (who doesn't spend "charges" the way a PC does) doesn't automatically inherit.

**How to avoid:**
For every foe ability that can hard-lock or instant-kill the player: (1) require the SAME resistance roll the player already benefits from when casting on foes (`magic.js`'s intelligent-target resist, `RESIST_IMMUNE_KINDS`) — this is also exactly what unlocks the deferred **symmetric INT resistance** (see Pitfall 9), so implement them together rather than sequencing stun/instakill abilities before resistance exists; (2) always emit a narration event *before* the effect lands (the existing `spellThrown`→`spellHit`/`spellMissed` two-step pattern in `magic.js` is the template — a foe's cast should likewise announce, then resolve, not resolve silently); (3) never allow a foe to both stun-lock AND deal lethal damage in the same uncounterable sequence without at least one save/resist opportunity; (4) bias any "death"-analog foe ability toward rare, high-depth, clearly-telegraphed bestiary entries (e.g. only the already-`sp.caster`-flagged Vampire/Drudge/Djinni/Krupke, not a common early-depth creature) rather than a generic ability any caster can roll.

**Warning signs:**
Playtest/DR feedback describing a death as "I never got to act"; an ability with no corresponding `EVENT_NARRATION` entry that fires between the cast and the effect; a foe ability whose damage/lock duration was ported straight from the player's spell-cost-adjusted numbers without discounting for the foe having no equivalent cost.

**Phase to address:**
Foe abilities phase (design decision, made explicit in the phase's CONTEXT before planning) and validated again during the consolidated difficulty retune's playtest pass.

---

### Pitfall 8: New foe-ability event types silently fail the `EVENT_NARRATION` coverage guard — or worse, pass it by accident and ship silent turns

**What goes wrong:**
`test/unit/formatEventsCoverage.test.js` derives the canonical event-type set directly from `engine/*.js` source (regex-extracting every `type: "..."` literal) and asserts `src/browser/eventNarration.js`'s `EVENT_NARRATION` table has an entry for each. Every new foe-ability event type (`foeCast`, `foeSpellHit`, `foeSummonedAlly`, etc.) automatically joins that required set the moment it's typed as a literal in `engine/combat.js` — a forgotten narration entry is a hard test failure, which is good; but a *sloppy* entry that technically satisfies the guard (renders *something*, even a blank string or a raw event-type dump) ships a silent or robotic turn that breaks the game's core "sarcastic Oracle voice" identity without failing any automated check, since the coverage guard only checks *presence*, not *voice quality*.

**Why it happens:**
The coverage guard is a structural safety net (catches the "we forgot" case), not a taste/tone gate — passing it is necessary but not sufficient for a good narration line, and it's easy to treat "test is green" as "narration is done."

**How to avoid:**
Write the narration copy for every new foe-ability event with the same sarcastic-Oracle voice pass the rest of the narration table uses, and additionally register every new player-facing string in `test/voice/safety-scan.test.js`'s scanned corpus — that file auto-covers `EVENT_NARRATION` by iterating the exported map, so a new entry is automatically scanned for banned terms too, but only if the entry is a real, populated string (a stub `() => ""` entry passes both the coverage guard and the safety scan while contributing nothing). Add a manual DR-round pass specifically reading the new abilities' log lines out loud before considering the narration task done.

**Warning signs:**
A new event type's `EVENT_NARRATION` entry is a one-line passthrough of the raw event fields (e.g. `` `${e.name} cast ${e.spell}` `` with no voice); DR-round feedback that "the monster stuff feels flat compared to everything else."

**Phase to address:**
Foe abilities phase, narration task — should be its own reviewed task, not folded silently into the mechanics task.

---

### Pitfall 9: Symmetric INT resistance is easy to wire backwards, double-count, or desync from the player's own resist roll it's modeled on

**What goes wrong:**
`magic.js` already contains the exact roll this feature mirrors: `if (t && (t.intel ?? 0) >= 12) { const r = rng.d(20); if (r < t.intel) { resisted } }` (lines 86-96), used when the *player* casts at a *foe*. The symmetric version (foe casts at player, player's `c.intel` resists) must reuse the identical threshold/shape (`intel >= 12` gate, `d20 < intel` check) for internal consistency, but three things are easy to get backwards: (1) rolling the resist check for spell *kinds* that were deliberately made resist-immune in `RESIST_IMMUNE_KINDS` (`thrown`, `ward`, `might`, `regen`, `heal`, `reveal`, `foresee`, `summon`, `mirror`) — if the new foe-cast code path doesn't reuse this exact same set, a foe's "heal self" or "summon" analog could be wrongly resistible, or a foe's offensive "thrown"-kind spell could wrongly become resistible when the player-cast version explicitly isn't; (2) drawing the resist roll unconditionally instead of gating it behind `c.intel >= 12`, adding a new unconditional RNG draw to every foe-caster encounter even against low-INT characters (mirrors Pitfall 1's gating discipline); (3) double-applying `intelBonus(c)` — the existing `derived.js` `intelBonus()` (lines 391-393, `+1` at intel≥15, `+2` at intel≥20, used today only for lock/chest-check difficulty) is a *different* mechanical use of the same stat; a hasty implementation might layer `intelBonus` on top of the *raw* `t.intel >= 12`/`r < t.intel` resist check without deciding whether that's intended (making high-INT characters resist both more often AND more consistently) or an accidental double-dip.

**Why it happens:**
"Symmetric" invites literal mirroring, but the player-side resist check was written assuming the *target* is always a foe object shaped like `{intel, name, ...}` from `content/bestiary.js` — porting it to "the target is now `state.c`" requires re-deriving field names (`c.intel` exists and is rolled at chargen per `character.js` line 168, so the data is there) and re-deciding which of the two existing INT mechanics (`RULE-01`'s `intelBonus()` lock-check bonus vs. `magic.js`'s raw resist-threshold check) the new symmetric system should extend versus duplicate.

**How to avoid:**
Explicitly design the symmetric check as a single shared helper (e.g. `resistsSpell(target, sp, rng)` in `derived.js` or `magic.js`) that BOTH the player-casting-at-foe and foe-casting-at-player paths call, rather than writing a second, parallel implementation — this guarantees the `RESIST_IMMUNE_KINDS` set, the `>=12` gate, and the `d20 < intel` threshold can never drift between the two directions. Decide up front (and document in the phase CONTEXT) whether `intelBonus()` participates in spell resistance at all, since RULE-01's original 04.1 design explicitly scoped Intelligence's mechanical hook to lock/chest checks only ("self-contained," Option B) — extending it into spell resistance now is a scope change from that original decision, not a given.

**Warning signs:**
Two separate, hand-written `d20 < intel` checks living in `combat.js` and `magic.js` that could silently diverge on a later edit; a level-1 character with `intel: 1` (chargen rolls `rng.d(20)`, so low rolls are legal) drawing a resist roll that should have been skipped by the `>=12` gate.

**Phase to address:**
Foe abilities phase, sequenced together with (not after) any foe ability capable of stun/instakill (see Pitfall 7) — resistance is the fairness valve those abilities need to not read as "unfair death."

---

### Pitfall 10: The difficulty retune tunes to `tools/tune-difficulty.mjs`'s bot, not to how a human actually plays — and the bot gets *more* wrong once foes can cast

**What goes wrong:**
`tools/tune-difficulty.mjs`'s own header is explicit that it is "A TUNING PROXY, NOT A PASS/FAIL GATE" and warns "a heuristic bot's play skill is arbitrary: it may flee too eagerly... or too rarely." Its policy (`decideAction`) is trivial: attack unless `wp/maxWP < 0.3`, then parley-if-possible else flee; it never quaffs a potion, never casts a spell, never manages resources, and has *zero* model of foe abilities at all (it doesn't dodge a stun, doesn't avoid a caster's likely target, doesn't recognize a foe as more dangerous because it casts). Once foe spellcasting lands, running this exact bot unmodified to "re-tune" `difficulty.js` will produce a curve calibrated to a bot that dies to caster foes in ways a real player wouldn't (a real player quaffs a potion or flees pre-emptively when a caster telegraphs) or survives caster foes in ways a real player couldn't (the bot's naive "always attack above 30% wp" ignores a foe about to land a big spell) — either direction produces a curve that is wrong for humans while looking "tuned" in the harness's own report.

**Why it happens:**
The tuning harness was built (Phase 3) specifically for the *pre-abilities* combat model, and its own header already flags this exact class of risk for even the current, simpler bestiary — adding spellcasting is precisely the kind of new lethality/complexity axis the original caveat was written to anticipate, but there's no automatic reminder that the bot itself needs updating when the game it's simulating changes shape.

**How to avoid:**
Before using `tune-difficulty.mjs`'s output to set any new constant, extend `decideAction`'s policy to at least react to the foe-ability event stream (e.g. flee/parley preference should rise if the last `afterPlayerAction` cycle contained a foe-cast event, and the bot should use potions/heals below the flee threshold if the character has them) — otherwise treat the harness's numbers as a *sanity floor* only ("did I create a floor with a 100% death rate by depth 3," a bug-catcher) and gate the actual constants on the deferred human playtest, exactly as `03-CONTEXT.md` already scoped ("the 'feels right / 5–10 min' tuning is a playtest UAT item"). Do not let the retune phase close on harness numbers alone.

**Warning signs:**
The retune phase's SUMMARY cites only `tune-difficulty.mjs`/`tune-economy.mjs` output as evidence of "feel," with no on-device DR-round playtest at depth 20-50+ against caster foes specifically.

**Phase to address:**
Consolidated difficulty retune phase — must explicitly include a bot-policy update task before the constant-tuning task, and must keep a human DR-round as an exit criterion, not an optional nice-to-have.

---

### Pitfall 11: The "ONE consolidated retune" folds three already-deferred power changes plus a brand-new one — easy to under-scope or re-litigate settled decisions

**What goes wrong:**
`engine/difficulty.js` was last touched in Phase 3 (v1.0) and has been *deliberately* left untouched through Phase 11 (Party Balance — "DEFERRED... `engine/difficulty.js` NOT touched") and Phase 16 (Economy Tuning — "difficulty.js untouched (parity guard intact)"). Both phases confirmed their local-only changes ("party upkeep," "wilmst cache depth-scaling") were parity-safe specifically *because* they never touched `difficulty.js`. The v1.1 retune is the first time all three power axes (party joiners, economy, monster/ability power) plus the brand-new foe-ability axis land in the curve *simultaneously* — a materially harder tuning problem than any single-axis change, with no precedent in this codebase for how to sequence it. A team that treats this as "just re-run `tune-difficulty.mjs` with new constants" will under-scope the actual cross-system interaction work (e.g. a Joiner party member changes the `liveMembers.length + 1` foe-targeting math in `foeTurn`, which changes effective party survivability, which changes how lethal a given monster-power increase actually is *in practice* — these interact multiplicatively, not additively).

**Why it happens:**
Each prior phase explicitly and correctly deferred the *global* retune rather than doing a partial one — that discipline was right, but it means this phase inherits three "IOUs" at once with no worked example in the repo of how to reconcile them, and it's tempting to treat the pile of deferred work as "just turn the dial," missing that the *soft cap itself* (`ENCOUNTER_DOT_CAP`, `DARK_BLOB_CAP`, `ENCOUNTER_DOT_SOFT_K` in `difficulty.js`) may need to move, not just the monster-power constants that already exist.

**How to avoid:**
Scope the retune phase to explicitly re-examine `difficulty.js`'s existing knobs (`ENCOUNTER_DOT_CAP=24`, `DARK_BLOB_CAP=6`, `BREATHER_EVERY=5`, `ENCOUNTER_DOT_SOFT_K=12`) against the *combined* effect of: a party member present, foe abilities active, and the (v1.0 Phase 16-deferred) "deep harness-driven cost/spread/reward tuning" for economy — not just monster stat numbers. Explicitly decide whether the soft cap itself moves (the milestone's blockers list already flags "feel-tuning to floor 30–50+" as still owed). Sequence the retune LAST in the milestone (after foe abilities and bestiary rebalance land), per the milestone's own stated plan, so it tunes the final combined system once, not iteratively per-feature.

**Warning signs:**
The retune phase changes only `content/bestiary.js` numbers or only `difficulty.js` constants but not both together; no test/harness run exercises a party member + caster foes + rebalanced bestiary simultaneously before the phase is marked complete.

**Phase to address:**
Consolidated difficulty retune phase — must be sequenced last, and its CONTEXT should explicitly enumerate all three inherited deferrals (PARTY-10, ECON deep-tune, Phase 3 feel-tuning) plus the new foe-ability axis as in-scope together.

---

### Pitfall 12: Parley rebalance nerfs Con Artist into uselessness by treating "strictly dominant" as "must be gutted," not "must have a real cost"

**What goes wrong:**
`proposed-milestone-monster-balancing.md` already documents the exact numbers: parley pays `~2.5 × Σ(d6×lvl)` XP (more than a kill), has **zero** failure cost beyond a lost turn, and a level-1 Con Artist succeeds `9+6=15/20` (75%) before any level bonus. The obvious "fix" — cut the XP multiplier and/or the Con Artist's `+6` bonus — risks overcorrecting into a class whose entire subclass identity ("talk your way out of anything") becomes worse than just fighting, which is a bigger design failure than the dominance it fixes: a player who rolled Con Artist (100%-dice-rolled chargen, no player choice) is now stuck with an underpowered class for the entire run, which directly undermines the "play the hand you're dealt" comedic identity — being *stuck* with a bad class is core to the joke, being stuck with a *mechanically punished* class is not.

**Why it happens:**
Balance passes default to nerfing the biggest number rather than asking "what should this class's *ceiling* be relative to combat, at what *cost*" — and the milestone's own framing ("strictly dominant," "trivialize early floors") primes toward subtraction rather than redesign.

**How to avoid:**
Rebalance the *shape* of parley (add a real failure cost — e.g. an aggro/ambush penalty, a per-encounter attempt cap, or a small XP/resource cost to attempt per `proposed-milestone-monster-balancing.md`'s own listed options — so spamming until success is no longer free) before or instead of just cutting the *success* reward/odds. Keep the Con Artist's `+6` bonus meaningfully better than baseline (that IS the subclass's identity) while making the overall parley economy pay *less than or comparable to* combat XP on success and *cost something real* on failure, so a Con Artist is a genuinely different, viable playstyle rather than a strictly-worse fighter.

**Warning signs:**
Post-rebalance, a Con Artist's win-rate/session-length in `tune-difficulty.mjs` output is worse than a Fighter's; DR-round feedback that "Con Artist feels useless now."

**Phase to address:**
Parley balance phase — the plan should explicitly state a target for Con Artist's post-rebalance parley success rate and XP-per-attempt-vs-combat ratio, not just "reduce the numbers."

---

### Pitfall 13: Wiring Language/Helm-of-Knowledge to widen parley access *and* nerfing parley's payout in the same phase makes the two changes impossible to attribute or independently verify

**What goes wrong:**
The milestone explicitly couples two changes with opposite pressure: DR15-A wires the Language skill / Helm of Knowledge `tongue` effect to make parley available to *more* characters (currently gates `canParley` for `TALKATIVE` types), while the parley balance pass simultaneously reduces parley's *reward* and adds failure costs. If both land in one unreviewed batch, a regression (e.g. Language wired too generously, or the failure-cost too harsh) is hard to isolate to its cause, and the `tune-difficulty.mjs`/`tune-economy.mjs` harness numbers will conflate "more people can parley" with "parley pays less" into a single aggregate shift that doesn't tell you which lever to adjust.

**Why it happens:**
`proposed-milestone-monster-balancing.md` itself already flags this risk ("Tune Language's parley reach together with this parley balance pass so they aren't balanced twice") but "together" is ambiguous between "in the same commit, hard to separate" and "in the same phase, sequenced and independently tested."

**How to avoid:**
Sequence as two tasks within the phase, not one: (1) land Language/Helm wiring first with its own test proving *availability* changed correctly (which classes/races/items now pass `canParley` that didn't before) without touching odds/reward math; (2) land the odds/reward/failure-cost rebalance second, with its own before/after harness comparison. This lets a later bug report ("parley feels too generous/too stingy") map to a specific, isolated change.

**Warning signs:**
A single commit/task changes both `canParley`'s gating conditions and `parley()`'s reward/odds math; the phase SUMMARY can't state which specific change caused a given harness-metric shift.

**Phase to address:**
Parley balance + Language phase — split into two ordered tasks in the plan.

---

### Pitfall 14: Fixture/harness regeneration masks real regressions when a rebalance is "corrected" by regenerating expected output instead of verifying intent

**What goes wrong:**
This codebase's established, correct pattern for a deliberate divergence is: identify it, carve it out narrowly in `comparables.js` with a named rationale comment, and add a fresh test for the new behavior (see Pitfall 4, and the precedent of `stripRationsField`/`normalizeHpUnit`/the wilmst-cache rename). The failure mode is the shortcut version: when a rebalance or new-ability change breaks a test, "fix" it by re-running whatever seed-discovery script produced the fixture and committing new expected numbers wholesale, without checking whether the *new* numbers are actually the *intended* balance outcome or just "whatever the code currently produces." This converts the test suite from a correctness oracle into a change-detector that rubber-stamps anything, silently erasing the ability to catch a real bug introduced in the same batch as an intentional rebalance.

**Why it happens:**
Regenerating fixtures is fast and the diff looks "reasonable" (numbers moved in the expected direction), so it's tempting to skip manually verifying that e.g. a specific creature's new damage-per-round matches the design doc's stated target, not just "some new number."

**How to avoid:**
Never regenerate a fixture's expected values without a paired, independent assertion of the *design intent* (e.g. "Cave Bear should deal ~1d8 at depth-appropriate level X" verified against the bestiary rebalance's own worksheet/spec, not just "matches what the code outputs today"). Any fixture-regeneration commit should be reviewable against a written before/after table of the specific numbers that were meant to change, mirroring how Phase 16's SUMMARY documented the exact old-vs-new wilmst-cache formula rather than just committing new fixture output.

**Warning signs:**
A commit message like "update fixtures for bestiary rebalance" with no accompanying table of intended stat changes; a fixture diff where *more* fields changed than the rebalance's stated scope should have touched.

**Phase to address:**
Bestiary rebalance phase and consolidated retune phase — both should require a written before/after stat table as part of the phase's verification artifact, not just green tests.

---

### Pitfall 15: Save-compatibility looks safer than it is — combat sub-state is never persisted, but any NEW persistent per-character field from this milestone is

**What goes wrong:**
`engine/saveState.js`'s `rehydrate()` already resets `combat`/`store`/`beats` to `null` on every load ("the prototype's load() never resumed mid-combat or mid-store either") — so an in-flight fight, including any mid-fight foe-ability state (a foe's active buff, a summoned ally, an acid-DOT), is **never at risk from a save/schema change**, because it never survives a save/load cycle in the first place, by design, today. The real risk is the *opposite* direction: any NEW field this milestone adds to the *persistent* character (`state.c`) — a Language-skill flag, an INT-resistance-related counter, a persistent curse/affliction from a foe ability meant to outlast combat — must go through the exact additive-with-default migration this codebase already established (`migrateCarry`/`sanitizeParty` precedent) or it will crash/misbehave loading a v1.0 tester's pre-milestone save (the milestone context explicitly notes "save files from v1.0 internal testers exist on devices"). Treating "combat state is safe because it's not persisted" as blanket reassurance and skipping migration review for the *actually new persistent* fields is the trap.

**Why it happens:**
It's easy to conflate "foe/combat objects are ephemeral" (true, and reassuring) with "nothing new needs a migration path" (false — any new field on `state.c` itself, which IS persisted, still needs one).

**How to avoid:**
Audit every new field added to `state.c` (not `state.combat`) during this milestone — Language wiring, symmetric-resist bookkeeping, any foe-inflicted persistent-beyond-combat status — against `isValidCharacter`'s minimal-shape check (does the new field's absence still pass validation? it should, since `isValidCharacter` intentionally checks only `wp`/`maxWP`/`level`/`skills`) and add a `migrate*`-style default-filler in both `validateSave` and `rehydrate` if the field needs a non-`undefined` default the moment an old save loads. Add a test loading a synthetic "pre-milestone" save object (missing the new field entirely) through `validateSave`→`rehydrate` and asserting no crash and a sane default, mirroring `migrateCarry`'s own test coverage.

**Warning signs:**
A new `c.someNewField` read anywhere in `applyAction`'s call graph with no corresponding default-fill in `saveState.js`; a v1.0 tester's save producing `undefined`-related crashes after the v1.1 update.

**Phase to address:**
Every phase that adds a new persistent character field (foe-abilities phase for any resist bookkeeping, parley/Language phase for the Language wiring) — migration review should be a standing checklist item, not a separate late phase.

---

### Pitfall 16: The auto-acting party member's combat branch is a simplified clone of the hero's — new foe abilities that only patch the hero path leave members exploitably invulnerable or unhittable by design gaps

**What goes wrong:**
`combat.js`'s own comment on the member-targeting branch (lines 866-889) is explicit: "SIMPLIFIED member branch: no ward/armor/mirror/Hardiness (all hero-only machinery), no die()." A new foe ability implemented only against the hero's full damage pipeline (ward absorption, armor soak, Hardiness reduction, halfNext) will not automatically apply to a targeted party member, because that pipeline is intentionally NOT shared today. Depending on the ability, this cuts both ways: a foe "ignore armor" ability that reads `f.sp.noArmor` in the hero branch (line 946) has no equivalent check in the member branch at all — meaning a party member might be *effectively immune* to an armor-piercing foe ability (the member branch never applies armor soak to begin with, so "ignores armor" is moot) while also having no ward/mirror *protections* a hero-equivalent character might have. A foe-cast AOE spell that's implemented by looping the hero's single-target logic across "hero + live members" the same way `alliesTurn`'s snapshot loop does, without checking which simplifications the member branch already assumes, will produce inconsistent, hard-to-predict outcomes for party runs specifically (an already-small test surface, since parity fixtures are solo-only).

**Why it happens:**
The member-combat branch was deliberately kept minimal in Phase 8 (Party Combat) to ship fast and safely under the parity gate (empty party ⇒ zero new draws) — it was never designed to be a complete mirror of the hero's damage pipeline, and nothing forces a new-ability implementer to notice the asymmetry.

**How to avoid:**
For every new foe ability, explicitly decide and document how it applies to a live party member vs. the hero (does an AOE spell hit both via the existing `liveMembers`-inclusive targeting roll, or is it hero-only by design?), and extend the member branch's simplifications ONLY as far as the specific new ability requires — don't assume parity between the hero and member damage pipelines. Since party-play has essentially no parity-fixture coverage (all fixtures are empty-party), add dedicated unit tests exercising a live party member against each new foe ability.

**Warning signs:**
A new ability's implementation only touches `foeTurn`'s hero-damage branch (after the `if (member) {...continue;}` block) and never the `if (member) {...}` block above it; DR-round feedback that party members feel unaffected by (or oddly immune to) new monster abilities.

**Phase to address:**
Foe abilities phase — should explicitly scope whether party-member interaction is in-scope per ability, since the milestone's stated boundary is "engine/data/narration only, no new screens," not "no new party-combat-path work."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reuse `tune-difficulty.mjs`'s existing bot unmodified for the v1.1 retune | Zero extra harness work | Curve tuned to a bot blind to spellcasting/potions, producing wrong constants for real players | Never for the final retune numbers; fine only as a quick pre-check ("did I create a 100%-death floor") before the human DR pass |
| Cut Con Artist's parley bonus/odds directly to kill dominance | Fast, obviously reduces the exploit | Turns a class identity into a strictly worse fighter, undermining "play the hand you're dealt" | Never as the sole fix — pair any odds cut with a real failure-cost redesign |
| Regenerate a broken parity fixture's expected values without a written before/after stat table | Gets `npm test` green again quickly | Masks real regressions introduced alongside the intended rebalance; erodes trust in the suite | Never — always pair regeneration with a documented intent table (Pitfall 14) |
| Give every foe a uniform "X% chance to cast instead of attack" instead of per-creature-authored ability lists | Simple, one code path | Breaks RNG-order parity for non-caster foes (Pitfall 1); flattens bestiary flavor (a Djinni and a Wolf would "feel" identical) | Never — always gate behind a per-creature `sp.caster`/ability flag |
| Skip a `migrate*` default-filler for a new `state.c` field because "the milestone's own test saves always have it" | Saves a small amount of code | Crashes/misbehaves on real v1.0 tester saves already on devices | Never — testers' saves are a stated, real constraint this milestone |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `engine/combat.js` ↔ `engine/magic.js` (foe ability reuse of spell effects) | Calling `castSpell`-shaped logic directly from `foeTurn` with the *caster's* own `c.spellsUsed`/`maxCharges` economy, which doesn't exist for a foe object | Generalize only the *effect resolution* (the `sp.kind` switch bodies), not the charge-gating wrapper; a foe's "can it cast" gate is `sp.caster` + whatever new depth/frequency rule the ability system defines, not the player's charge economy |
| `test/parity/harness/comparables.js` ↔ any new `state.c`/`state.combat` field | Adding a strip/carve-out to only ONE of the three `*Comparable()` functions (e.g. only `combatComparable`) and assuming movement/economy fixtures are unaffected | Add the same carve-out to `movementComparable`, `combatComparable`, AND `economyComparable` every time — the milestone's own stated rule, and the existing `stripBagField`/`stripFlightFields`/`stripDarkForField`/`stripNameField` precedent already does this in triplicate for exactly this reason |
| `content/bestiary.js` ↔ `test/parity/prototype-master.js.txt` | Assuming the frozen prototype and the engine bestiary are "the same data" because they used to produce identical numbers | They are two independent, unlinked copies (Pitfall 4) — the frozen file is a point-in-time snapshot of the original `mazeworld.html`, never re-synced |
| `tools/tune-difficulty.mjs`/`tune-economy.mjs` ↔ the actual retune decision | Treating harness JSON output as sufficient sign-off for a phase's VERIFICATION | Harness output is a proxy/sanity-check only (per the tool's own header); the retune phase's real exit criterion is a human DR-round at deep floors |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| A foe-ability system that re-evaluates every `sp.*` flag via string/key lookups every swing, every foe, every round | Combat turns feel slightly laggier on mid-range Android devices at high depth with many foes/abilities active | Keep ability dispatch as cheap flag checks (`f.sp && f.sp.caster`), matching the existing `(f.sp && f.sp.atk) \|\| 1` pattern — no per-swing object allocation or deep cloning beyond what `applyAction`'s existing clone-per-action already does | Noticeable only at max encounter density (`ENCOUNTER_DOT_CAP`) with multiple caster-type foes simultaneously — verify on the Pixel 7 DR device at a deep, dense floor, not just in `node --test` |
| Difficulty-curve soft-cap functions (`softCap()` in `difficulty.js`) re-derived per-ability-check instead of once per floor-gen call | Non-issue today (pure, cheap function), but a retune that adds new per-foe curve lookups inside `foeTurn`'s hot loop (rather than at `startCombat`/floor-gen time) could reintroduce per-swing overhead | Keep any new difficulty-driven ability-frequency/power scaling computed once at `startCombat` (mirroring how foe level/count are already decided there), not recomputed every swing inside `foeTurn` | Would only manifest as a measurable slowdown at very high depth with many foes; still worth designing away from up front |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| A new persistent `state.c` field with no bound/clamp on load (e.g. a Language-tier counter, an INT-resist streak counter) accepted from an untrusted save without validation | A tampered/corrupted save value propagates into arithmetic (NaN/Infinity) the same class of bug `difficulty.js`'s `safeDepth()` guard was written to prevent (T-03-01 precedent) | Any new numeric field read from a save must be sanitized the same defensive way `safeDepth()`/`isValidCharacter()` already do — clamp/guard at the `validateSave`/`rehydrate` boundary, never trust it raw in engine math |
| A foe-summon ability that reads unbounded player-supplied or save-derived values (e.g. summon *count* driven by an untrusted floor/depth field) | Could produce a runaway `C.foes`/`C.summonedFoes` array, echoing the class of DoS-via-malformed-state concern `saveState.js`'s fail-closed validation already guards against elsewhere | Cap any new spawn/summon count with a fixed, code-defined maximum (mirroring `DARK_BLOB_CAP`/`ENCOUNTER_DOT_CAP`'s hard caps in `difficulty.js`), never derive it uncapped from depth or a save-persisted value |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| A foe ability resolves with no narration between "cast" and "effect" | Reads as an instant, unexplained hit — breaks immersion and feels like a bug even when it's working as designed | Always emit a two-step event pair (cast/announce → resolve/effect), mirroring `magic.js`'s existing `spellThrown`→`spellHit`/`spellMissed`/`spellResisted` pattern |
| Parley's failure penalty is added but never surfaced distinctly from an ordinary missed attack | Player can't tell *why* an attempt suddenly costs more/hurts more, feels arbitrary | Give any new parley-failure penalty (aggro, cooldown, cost) its own distinct event/narration line, not a silent state change |
| Bestiary rebalance changes a creature's difficulty without changing its flavor text/name recognition | A "Wolf" that suddenly hits much harder at the same depth band reads as a bug to a returning player, not a rebalance | Pair any significant stat change with a flavor-text/`note` tweak signaling the change (the `sp.*.note` field already exists for exactly this purpose) |
| Foe-caster encounters at depth with no bestiary/inspect screen to explain what just happened | Milestone explicitly backlogs "foe inspect / threat hint on the encounter panel" and "browsable bestiary screen" — players facing a caster for the first time have zero in-game reference for what it can do | Since those UI affordances are out of scope this milestone, lean harder on narration clarity (Pitfall 8) to compensate — the Oracle log becomes the only in-game explanation available |

## "Looks Done But Isn't" Checklist

- [ ] **Foe spellcasting:** Often missing a draw-count regression test proving non-caster foes consume zero extra RNG — verify by spying on `rng.d()` call counts across a `Beasts`/`Humans` fixture before/after the feature (Pitfall 1).
- [ ] **Foe spellcasting:** Often missing coverage for `Magical`/`Demons`/`Walking Dead` encounters specifically, since the frozen parity suite never forces those types — verify with new, purpose-built determinism tests (Pitfall 3).
- [ ] **Bestiary rebalance:** Often missing an enumerated list of which parity-fixture seeds/creatures are affected — verify by running the existing fixtures against rebalanced data BEFORE writing new carve-outs, and confirm the carve-out list matches exactly (Pitfall 4).
- [ ] **Symmetric INT resistance:** Often missing a shared helper reused by both cast directions — verify there is exactly ONE implementation of the `intel>=12`/`d20<intel` check, not two (Pitfall 9).
- [ ] **Difficulty retune:** Often missing an updated `tune-difficulty.mjs` bot policy aware of foe abilities before constants are finalized — verify the bot's `decideAction` references ability-related events, or explicitly treat harness output as a sanity floor only (Pitfall 10).
- [ ] **Difficulty retune:** Often missing a combined-system test run (party member + caster foes + rebalanced bestiary all present at once) — verify at least one harness run and one DR-round exercises all three together (Pitfall 11).
- [ ] **Parley rebalance:** Often missing a stated target for Con Artist's post-rebalance win rate/XP ratio — verify the phase's plan names a concrete number, not just "less dominant" (Pitfall 12).
- [ ] **New event types:** Often missing a genuinely voiced (not stub) `EVENT_NARRATION` entry — verify by reading the new lines aloud in a DR round, not just checking the coverage test is green (Pitfall 8).
- [ ] **New persistent fields:** Often missing a `migrate*`-style default-filler + a synthetic "old save" load test — verify a save object missing the new field entirely round-trips through `validateSave`/`rehydrate` without crashing (Pitfall 15).
- [ ] **Party-member interaction:** Often missing any test of a new foe ability against a live party member specifically, since parity fixtures are solo-only — verify with a dedicated party+ability unit test (Pitfall 16).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Unconditional cast-roll broke parity broadly (Pitfall 1) | LOW | Grep `combat.js`'s new code for the offending `rng.d()` call, gate it behind `f.sp && f.sp.caster`, re-run `npm test`; should return to green immediately since no other logic needs to change |
| Bestiary rebalance broke fixtures without a carve-out plan (Pitfall 4) | MEDIUM | Diff the failing fixture's foe/damage fields against the frozen master, identify exactly which creature/stat changed, add ONE narrow named carve-out per changed field (not a blanket strip), re-verify the fixture still proves everything else byte-identical |
| Con Artist over-nerfed post-parley-rebalance (Pitfall 12) | MEDIUM | Restore the subclass-specific bonus toward its original value while keeping the new failure-cost/attempt-cap mechanic, re-run `tune-difficulty.mjs` comparing Con Artist vs. Fighter outcome distributions, adjust until roughly comparable |
| A new `state.c` field crashes old testers' saves (Pitfall 15) | HIGH (real-user impact, live testers) | Ship a hotfix adding the missing `migrate*` default-filler to `validateSave`/`rehydrate`; since `saveState.js` already fails closed to `newRun` on genuinely malformed saves, worst case for an affected tester is a lost in-progress run, not corrupted data — communicate and re-release promptly via the existing Play internal-testing pipeline |
| Summoned foe acted same round it appeared, or `C.target` desynced (Pitfall 5) | MEDIUM | Move the new foe into a separate summoned-foes slot that only enters `foeTurn`'s loop on the NEXT round (mirroring `C.ally`'s existing next-round-only activation), re-run the specific ability's unit test |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Unconditional cast-roll RNG leak | Foe abilities phase | New draw-count regression test on non-caster fixtures; full `npm test` green |
| 2. Duplicating/ignoring existing `sp.caster`/flavor flags | Foe abilities design/research sub-phase | Design doc cites `content/bestiary.js`'s existing `sp.*` vocabulary explicitly |
| 3. Parity-blind false confidence on caster foes | Foe abilities phase | New determinism tests forcing `Magical`/`Demons`/`Walking Dead` encounters |
| 4. Bestiary numbers silently diverge from frozen prototype | Bestiary rebalance phase | Enumerated affected-fixture list + narrow named `comparables.js` carve-outs, each with rationale |
| 5. `C.foes` mutation invariant violated by summons | Foe abilities phase (summon-type task) | Unit test: summoned foe does not act same round; `C.target` survives a summon/removal |
| 6. Field-reuse collisions in status effects | Foe abilities phase (per-ability review) | Checklist: new-field vs. reused-field decision documented per ability; comparables carve-out added if new |
| 7. "Unfair death" from untelegraphed stun/instakill | Foe abilities phase design decision + retune playtest | Resist roll + two-step narration required for any lock/instakill ability; DR-round feedback explicitly checked |
| 8. Narration coverage passes structurally but reads flat | Foe abilities phase, narration task | Manual voice-quality DR pass beyond the automated coverage guard |
| 9. Symmetric INT resistance implemented twice / backwards | Foe abilities phase, sequenced with stun/instakill work | Single shared resist helper used by both cast directions; explicit decision on `intelBonus()` scope |
| 10. Retuning to the bot, not to feel | Consolidated difficulty retune phase | Updated bot policy OR explicit "sanity floor only" framing; mandatory human DR-round exit criterion |
| 11. Under-scoping the "ONE" consolidated retune | Consolidated difficulty retune phase | CONTEXT enumerates all 3 inherited deferrals + new ability axis; sequenced last in the milestone |
| 12. Con Artist nerfed to uselessness | Parley balance phase | Stated target win-rate/XP ratio for Con Artist in the plan; harness comparison vs. Fighter |
| 13. Language wiring + parley nerf conflated | Parley balance + Language phase | Split into two sequenced, independently tested tasks |
| 14. Fixture regeneration masks regressions | Bestiary rebalance + retune phases | Written before/after stat table required as a verification artifact |
| 15. Missing migration for new persistent fields | Every phase adding a `state.c` field | Synthetic old-save load test through `validateSave`/`rehydrate` |
| 16. Party-member combat path left un-patched | Foe abilities phase | Dedicated party+ability unit test per new ability |

## Sources

- Direct code read: `engine/combat.js` (startCombat, playerStrike, killFoe, flee, canParley, parley, sing, endCombat, afterPlayerAction, allyTurn, alliesTurn, downMember, foeTurn) — CONFIDENCE: HIGH, primary source
- Direct code read: `engine/magic.js` (castSpell, drinkPotion, canRead, readScroll — the full `sp.kind` switch and the intelligent-target resistance roll) — CONFIDENCE: HIGH, primary source
- Direct code read: `engine/difficulty.js` (difficultyCurve, softCap, safeDepth, isBreather, the documented constants) — CONFIDENCE: HIGH, primary source
- Direct code read: `engine/saveState.js` (validateSave, rehydrate, migrateCarry, sanitizeParty, isValidCharacter, isValidFloor) — CONFIDENCE: HIGH, primary source
- Direct code read: `test/parity/harness/comparables.js` (every `strip*Field` carve-out and its rationale comment; `movementComparable`/`combatComparable`/`economyComparable`) — CONFIDENCE: HIGH, primary source
- Direct code read: `content/bestiary.js` (full 112-line bestiary, confirming the 4 existing `sp.caster: true` entries: Djinni, Krupke, Drudge ×2, Vampire) — CONFIDENCE: HIGH, primary source
- Direct code read: `test/parity/fixtures/action-script.combat.json` (confirming only `Beasts`/`Humans` are forced-encounter types in the frozen combat parity fixture) — CONFIDENCE: HIGH, primary source
- Direct code read: `test/parity/harness/sandboxPrototype.js` (`loadPrototypeSandbox` reads the standalone frozen `prototype-master.js.txt`, confirming it is NOT the same data source as `content/bestiary.js`) — CONFIDENCE: HIGH, primary source
- Direct code read: `test/unit/formatEventsCoverage.test.js` and `test/voice/safety-scan.test.js` (coverage-guard and voice-safety-scan mechanics) — CONFIDENCE: HIGH, primary source
- Direct code read: `tools/tune-difficulty.mjs` (bot policy, explicit "not a substitute for playtest" header) — CONFIDENCE: HIGH, primary source
- `.planning/milestones/v1.0-phases/03-endless-descent-difficulty-balance/03-CONTEXT.md`, `03-03-SUMMARY.md`, `deferred-items.md` — CONFIDENCE: HIGH, primary source (project history)
- `.planning/milestones/v1.0-phases/11-party-balance/11-SUMMARY.md` — CONFIDENCE: HIGH, primary source (confirms `difficulty.js` left untouched by Party Balance, deferred global retune)
- `.planning/milestones/v1.0-phases/16-economy-tuning/16-SUMMARY.md` — CONFIDENCE: HIGH, primary source (confirms `difficulty.js` left untouched by Economy Tuning, deferred global retune)
- `.planning/milestones/v1.0-phases/04.1-rules-review-wiring-every-character-sheet-stat-affects-gamep/04.1-RESEARCH.md`, `04.1-CONTEXT.md` — CONFIDENCE: HIGH, primary source (RULE-01 Intelligence decision history, "Option B — self-contained")
- `.planning/proposed-milestone-monster-balancing.md` — CONFIDENCE: HIGH, primary source (parley numbers, milestone rationale)
- `.planning/PROJECT.md`, `.planning/STATE.md` — CONFIDENCE: HIGH, primary source (milestone scope, engine gate rules, open blockers)
- General deterministic-RNG game architecture guidance (pass-the-generator, persist-state-not-seed patterns) — web search, CONFIDENCE: MEDIUM, cross-checked against this repo's own already-correct implementation (`makeRng`/`rngState` persistence pattern)
- General game-balance/overfitting-to-simulation guidance — web search, CONFIDENCE: MEDIUM, general industry pattern, not project-specific

---
*Pitfalls research for: Delve, Die, Repeat / Mazeworld v1.1 "Monster Balancing & Abilities"*
*Researched: 2026-09-13*
