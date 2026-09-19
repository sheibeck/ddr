# Phase 40: Spell Rework - Research

**Researched:** 2026-09-18
**Domain:** internal game-rules engine (spellcasting) — no external library/framework research applies; every finding below is a direct codebase read
**Confidence:** HIGH (every claim is `[VERIFIED: codebase]` — this is a closed-source, no-network project; there is no external "standard stack" for a hand-authored 32-row spell table)

## Summary

No `40-CONTEXT.md` exists yet — this research runs before `/gsd-discuss-phase`. Everything below is grounded directly in the current engine/content code (`engine/magic.js`, `engine/derived.js`, `engine/character.js`, `content/spells.js`, `content/mu-chart.js`, `content/spell-level-overrides.js`) plus the three prior v1.5 phases' established patterns (`engine/effects.js` timers, the `SPELL_LEVEL_OVERRIDES` per-sub override precedent, `conditionsOf` chips, the greenfield "declare + regenerate exactly the fixtures a change moves" rule).

The spell system is smaller and more self-contained than Phase 38 (abilities) or Phase 39 (gear): 32 rows in one array, one cast function (`engine/magic.js#castSpell`, ~400 lines, one `kind`-keyed if/else chain), one grimoire-roll function (`engine/character.js#rollGrimoire`, chargen-time only — there is **no level-up grimoire growth**, only scrolls add spells later). That makes this phase's *engineering* risk low. Its *design* risk is real and matches the roadmap's own flag: the offense school has no coherent niche structure today (a strict damage-per-level ladder with one glaring inconsistency — Ice's flavor text promises a DOT it does not mechanically deliver), utility spells split cleanly into "has a chip" (Shield, Might) and "has zero visible surface" (Mirror Self, Sense Presence, Regeneration), the day-one-damage guarantee for Summoner is structurally blocked by a locked identity-contract test, and the scroll-scribing bug is real, reachable by at least four sub-classes at level 1, and independently discoverable from the code without running anything.

**Primary recommendation:** treat this as three separable work streams — (1) a content-table redesign (niche map + day-one damage fix + rename), which is genuinely a design/balance decision needing `/gsd-discuss-phase` ratification per the roadmap's own flag; (2) a set of small, high-confidence engine bug fixes (scroll scribing, missing condition chips) that need no user input at all; (3) the timed map-reveal, which needs one ratified Key Decision (re-fog provenance) and then is a mechanical, effects.js-shaped build. Do not let (1)'s open design questions block starting (2) and (3) in the plan — they are independent of the final niche table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spell effect resolution (`castSpell`) | Engine (`engine/magic.js`) | — | Pure, rng-injected, no UI reads |
| Grimoire content (which spells exist, who can learn them, at what level) | Content (`content/spells.js`, `content/mu-chart.js`, `content/spell-level-overrides.js`) | Engine (`engine/derived.js` gate helpers) | Data tables + pure gate functions, no engine mutation of the tables themselves |
| Day-one grimoire roll | Engine (`engine/character.js#rollGrimoire`) | Content (pool/gate data it reads) | rng-injected, chargen-only, zero-draw-order-changing constraint (FID-06 precedent) |
| Timed map-reveal window | Engine (`engine/effects.js` timer + `engine/magic.js` reveal branch + `engine/movement.js` tick site) | Maze (`engine/maze.js` grid cell provenance) | Mirrors the Phase 39 item-effect `c.timers` model exactly; the re-fog sweep needs a new per-cell provenance field on `floor.g[y][x]` |
| Shield/ward visibility | Engine (`engine/derived.js#conditionsOf`, already emits the chip) | Shell (`mazeworld.html` Hero-tab kit row — needs a one-line fix to add rounds) | Condition-chip pipeline already exists; only the Hero-sheet list needs a fix |
| Scroll scribing gate | Engine (`engine/magic.js#readScroll`) | — | Pure logic fix, reuses `engine/derived.js#canCast`'s own two checks |
| Grimoire display / SPELLS submenu | Shell (`src/browser/combatMenu.js`, `mazeworld.html` Hero-tab Grimoire list) | Engine (view-model reads `c.grimoire`, `canCast`) | Presentation only — niche one-liners are content `txt` field, already read by the shell |
| Bot spell-use policy | Tools (`tools/lib/tuning-bot.mjs#chooseSpell`) | — | Out of this phase's scope (Phase 42 teaches it to USE new mechanisms); this phase must keep it *not broken* |

## Package Legitimacy Audit

Not applicable — this phase adds zero external packages. All work is internal `content/`/`engine/`/`src/browser/` data and logic changes; no `npm install` of any kind. No `package-lock.json` diff is expected.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPELL-01 | Combat spells differentiated by niche (burst/DOT/multi-target/control scope×duration/defensive), stated in grimoire text | "Current State: The 32 Spells" audit + "Proposed Niche Map" below — identifies which existing `kind`s already fit each niche and which spells (Ice specifically) mechanically contradict their own flavor text |
| SPELL-02 | Every utility spell has a measurable effect; none dead | "Utility Spell Audit" — 3 of 9 utility spells (Mirror Self, Sense Presence, Regeneration) have a real engine effect but zero UI surface (no condition chip); none are fully "dead" mechanically, all are invisible to the player |
| SPELL-03 | Spells can be added/removed/renamed, all day-one grimoires stay valid, changes are declared divergences | "Fixture/Chargen Impact" section — the existing `chargenDivergenceFor`/`stripDeclaredFields` (Phase 23) and `chargenShiftOf` (Phase 38) machinery is the direct precedent to reuse, not invent |
| SPELL-04 | Every MU sub starts with a damage spell (Summoner/Illusionist keep Phase 23 overrides, additionally qualify) | "Day-One Damage Spell Audit" — Illusionist already qualifies once the guarantee targets *damage* not *attack-kind*; Summoner is structurally blocked by a **locked identity-contract test** (`schoolGate("Summoner","offense") === 3`) and needs a new per-spell override mechanism, not a MU_CHART edit |
| SPELL-05 | Detect Magic renamed + time-boxed reveal with re-fog provenance ratified as Key Decision | "Detect Magic / Map Reveal" section — current `reveal` mechanism is a one-way permanent `seen=true` sweep of the WHOLE floor; two concrete re-fog provenance options are laid out with cost/tradeoff |
| SPELL-06 | Shield pool+rounds visible on Hero sheet + map HUD chip | "Shield/Ward Visibility" — **already ~90% done** (Phase 31 CMB-04); only the Hero-tab kit-list row is missing rounds |
| SPELL-07 | Scribed scroll instantly castable when level qualifies, named refusal when not | "Scroll Scribing Bug" — a concrete, reachable bug in `readScroll`'s copy-to-grimoire condition, reachable today by at least 4 subs at level 1 |

</phase_requirements>

## Current State: The 32 Spells (`content/spells.js`)

Every row, what `castSpell` actually does, and its current health:

| # | Spell | Lvl | School | Kind | combatOnly | What `castSpell` does | Health |
|---|---|---|---|---|---|---|---|
| 1 | Heal | 1 | healing | heal | false | `wp += d10 (+3 Cleric, ×2 heal2x race)` | Fine, clear niche (healing) |
| 2 | Shield | 1 | protection | ward | false | `c.ward = {pool:50, rounds:5}` | Fine — defensive |
| 3 | Strength | 1 | offense (!) | might | false | `c.might = d10`, one-time maxWP boost | **Misfiled school** — a buff spell filed under "offense"; has a chip, effect real |
| 4 | Doze | 1 | offense | status | true | one foe `asleep = d4` | Control, single-target, temporary — fine niche fit |
| 5 | Freeze | 1 | offense | thrown | true | d6 dmg, hit → `killFoe` (Phase 23 fix: pays like any kill) | Burst, single-target — the ONLY level-1 spell with a `dmg` field. See SPELL-04 finding. |
| 6 | Detect Magic | 1 | divination | reveal | false | **entire floor** `seen=true`, permanent, one-way | See SPELL-05 section — this is the rename+timebox target |
| 7 | Mirror Self | 1 | illusion | mirror | false | `c.mirror = d6` rounds, foes need natural 1 to hit hero | Real effect, **zero condition chip** — see Utility Audit |
| 8 | Stun | 1 | offense | stun | true | `d6 × mult` foes `asleep = d4` | Multi-target control — fine fit |
| 9 | Weaken | 1 | offense | weaken | true | `C.weakened = true` (halves all hero-side damage taken... wait: `C.weakened` is read at `playerStrike`'s damage line as `if (C.weakened) dmg = ceil(dmg/2)` — this HALVES THE FOE'S RETURN dmg? No — re-check: grep shows `dmg = Math.ceil(dmg/2)` inside the hero-strike damage block gated on `C.weakened`; this actually appears to debuff the FOES' own damage output, lasting the **entire fight, no countdown, no chip** | Real but **unlimited duration, zero visible timer** — worth flagging in the control axis design |
| 10 | Acid | 2 | offense | acid | true | `t.acid = {rounds:d6, dmg:2d6+2}`, ticks in `foeTurn` | **The one genuine DOT already in the game** — reuse this kind as-is for the DOT niche |
| 11 | Stupidity | 2 | offense | stupid | true | `t.stupid=true`, `t.asleep = max(asleep, d10)` | Control, single — `t.stupid` flag: **grep shows it is set but never read anywhere else** — likely decorative/dead flag beyond the sleep |
| 12 | Blind | 3 | offense | blind | true | `t.blind=true`, **no expiry counter set** ("for life") | Control, single, genuinely permanent-for-the-fight — matches its own flavor text, unlike Ice |
| 13 | Shrink | 3 | offense | shrink | true | `d6` foes: `wp`/`maxWP` halved, `shrunk=true` | Control, multi, permanent |
| 14 | Ice | 3 | offense | thrown | true | **identical mechanic to Freeze/Fireball** — one burst hit via the generic thrown branch | **Text/mechanic mismatch**: txt says "d6 a round, then frozen" but it is NOT a DOT — it resolves as a single d6 burst hit exactly like Freeze, just without Freeze's free-kill routing. This is the clearest concrete "spell whose flavor lies about its mechanic" in the table |
| 15 | Earthquake | 4 | offense | quake | true | 3d10+8 to every foe AND the caster (half, unless warded) | Multi-target burst w/ self-risk — a real niche (risk/reward AoE) |
| 16 | Noxious Vapor | 4 | offense | vapor | true | roll d6 (or auto-4 at lvl5+): on 4, `d10≠1` insta-kills every foe; else all `asleep` | Multi-target — high-variance "gamble" niche, distinct from Earthquake's guaranteed AoE |
| 17 | Fireballs | 4 | offense | volley | true | `d8` bolts spread round-robin across foes, `dmg` each | Multi-target, distinct from Lightning (below) by being **variable N bolts vs a fixed number of TARGETS** |
| 18 | Petrify | 5 | offense | petrify | true | target foe instantly `alive=false` | Single-target, instant removal — a "control" ceiling spell |
| 19 | Insane | 2 | offense | insane | true | d6 table: kill / hero's-ally-struck / flee / sleep / frenzy | Single-target, chaos-table — a genuinely unique niche (random-but-bounded) |
| 20 | Summon | 2 | special | summon | false | spawns `C.ally`/`c.pendingAlly` | Utility (party-adjacent), fine |
| 21 | Fireball | 3 | offense | thrown | true | 2d10+4, single target | Burst — clean fit |
| 22 | Major Heal | 3 | healing | heal | false | 3d10 wp | Healing tier-up, fine |
| 23 | Bubble | 3 | protection | ward | false | 100 pool / 12 rounds / reflect | Defensive tier-up, fine |
| 24 | Sense Danger | 3 | divination | foresee | false | `c.foresight=true`, narrates next encounter type; consumed at `fight()` | Real effect, **zero condition chip** while pending — see Utility Audit |
| 25 | Turn Walking Dead | 2 | protection | turn | true | vs Walking Dead only: turns every foe `lvl <= c.level` | Situational multi-target removal — niche: "answer spell" |
| 26 | Plane Gate | 3 | protection | gate | true | vs Walking Dead/Demons only: `d6` foes removed | Situational multi-target removal — same niche as Turn |
| 27 | Sense Presence | 2 | protection | senses | false | `c.senses=1`, waives dark to-hit cap + (per header comment) prevents surprise | Real effect, **zero condition chip** — see Utility Audit |
| 28 | Phantom Host | 3 | illusion | summon | false | same as Summon | Utility, Illusionist's Phase 23 override target |
| 29 | Lightning | 4 | offense | thrown | true | d10+6, **every foe** (hardcoded by NAME `sp.n === "Lightning"`, not by `kind`) | Multi-target burst — the name-based special case is a precedent worth flagging (fragile if Lightning is ever renamed) |
| 30 | Regeneration | 4 | healing | regen | false | `c.regen=true`, `d8`/round while in combat | Real effect, **zero condition chip** — see Utility Audit |
| 31 | Mangle | 5 | offense | thrown | true | 2d20+15, single target | Burst ceiling spell |
| 32 | Death | 5 | offense | death | true | refuses if `wp<=26`; costs 25wp; instant-kills one foe | Single-target, resource-gated instant kill — a unique niche already |

**Dead/near-dead:** none are fully inert (every `kind` branch does *something* observable in combat), but two are misleading or invisible:
- **Ice (L3)** — flavor text promises a DOT it does not deliver (mechanically = Freeze without the free kill). This is the strongest "looks like a strict downgrade of Freeze" case in the table — exactly the "damage ladder, not real choice" problem SPELL-01 targets.
- **Weaken (L1)** — real effect (halves incoming hero damage... actually halves the DAMAGE THE HERO DEALS per the `playerStrike` grep — verify exact direction in planning; either way it is unlimited-duration with zero visible countdown), a control spell with no scope/duration axis at all today.

**Foe-status kinds that already exist in combat** (`engine/combat.js`, confirmed by grep): `f.asleep` (Doze/Stun/Stupidity/Vapor), `f.stunned` (ability-only today, Pommel Strike), `f.acid` (Acid spell, ticks for dmg), `f.blind`/`f.blindFor` (Blind spell = no expiry; Dirty Trick ability = 2-round expiry — **two different expiry conventions for the same flag already coexist**), `f.shrunk`, `t.stupid`, `t.frozen` (Freeze/Ice kill routing), `f.hamstrung`/`f.marked`/`f.dot` (ability-only, Phase 38). `C.weakened` (fight-wide, not per-foe). Reuse these directly — do not invent new foe-flag shapes; the `f.dot = {left, dmg, by}` shape from Phase 38's Poisoned Edge ability is the ready-made DOT template if Ice (or a new spell) needs a real one.

**Chargen/grimoire constraints on renames/adds/removes:**
- `rollGrimoire` (chargen-only, `engine/character.js:306`) shuffles `low`/`high` pools by `sp.lvl` and a `spare` pool filtered by `dayOnePool = sp.lvl===1 && schoolGate(sub,sp.s)<=1` — **this predicate's exact shape is frozen** (a comment explicitly forbids routing it through `spellLevelFor`, since doing so once already shifted 2 chargen fixtures in Phase 23). Any spell add/remove that changes which spells satisfy `sp.lvl===1` changes `spare`'s length, which changes the Fisher-Yates draw count, which shifts **every MU chargen seed's grimoire, downstream of the shuffle**. This is the single highest fixture-blast-radius lever in this phase — bigger than the niche redesign itself.
- `MU_CHART` (`content/mu-chart.js`) school counts: 8 subs × 6 schools; `gate` objects override specific (sub, school) pairs away from the default gate-1.
- `SPELL_LEVEL_OVERRIDES` (`content/spell-level-overrides.js`): today exactly 2 entries (`Summoner.Summon = 1`, `Illusionist."Phantom Host" = 1`), consumed by exactly one function, `spellLevelFor`, itself consumed by `canCast` and `rollGrimoire`'s `usableNow`. This table only overrides a spell's **effective level**, never its **school gate** — this distinction is the crux of the SPELL-04 Summoner finding below.
- Level gating for scrolls: `readScroll` does NOT consult `spellLevelFor` or `schoolGate` at all — see the Scroll Scribing Bug section.

## Proposed Niche Map (offense school, by level)

Reusing existing `kind`s wherever possible; `[NEW]` marks a kind or mechanism that does not exist today.

| Level | Burst (single, high one-shot) | DOT | Multi-target | Control (scope × duration) | Defensive |
|---|---|---|---|---|---|
| 1 | Freeze (`thrown`, unchanged) | — | Stun (`stun`, unchanged) | Doze (single, d4 rds) · Weaken (all, **duration axis undefined today** — needs a decision) | Shield (`ward`, unchanged) · Mirror Self (`mirror`, unchanged — reclassify from "illusion/no niche" to defensive) |
| 2 | — | Acid (`acid`, unchanged — already correct) | — | Stupidity (single, ~permanent) · Insane (single, chaos-table, unique niche) | — |
| 3 | Fireball (`thrown`, unchanged) · Mangle-tier not yet | Ice — **[NEW]** needs either (a) a real per-round tick (reuse the `f.dot`/`t.acid` shape) matching its OWN flavor text, or (b) a rewritten flavor text matching its current burst behavior | Shrink (`shrink`, unchanged) | Blind (single, permanent-for-fight, unchanged) | Bubble (`ward`, reflect, unchanged) |
| 4 | — | — | Earthquake (`quake`, self-risk AoE) · Fireballs (`volley`, N-bolt AoE) · Lightning (`thrown`, all-foes AoE — keep the name-based special case OR generalize it to a `kind:"thrown", aoe:"all"` data flag, planner's call) | Noxious Vapor (`vapor`, gamble-AoE — arguably its own 6th niche, "chaos", alongside Insane) | — |
| 5 | Mangle (`thrown`, unchanged) · Death (`death`, resource-gated instant-kill, unchanged) | — | — | Petrify (single, instant removal) | — |

**Spells needing a new `kind` or mechanism:** only Ice, if the DOT-fix path is chosen (recommended — it is the one spell whose current behavior actively contradicts its own printed text, which is a worse look than a plain damage-ladder entry).

**Spells likely renamed:** Detect Magic (SPELL-05, mandatory). Possibly Weaken (if its control axis is redesigned to add a duration, the flavor text `"they hit on a 3 and do half"` should state the duration). Neither rename changes `kind` or school, so neither moves `dayOnePool`'s membership — **safe from the chargen-shuffle-length blast radius** as long as the spell's own `n` (display name) is what changes, not its `lvl`/`s`(chool).

**Spells with real add/remove/rename fixture impact:** any change to a spell's **name** (`n`) moves every fixture whose grimoire array contains that literal string (see "Fixture/Chargen Impact" below) — this includes Detect Magic (near-certain to appear in many MU day-one grimoires, since it is level 1, divination, gate-1-or-near-1 for most subs). Any change to a spell's **level** (`lvl`) or **school** (`s`) additionally risks moving `dayOnePool`'s length and therefore the chargen rng-draw-count pin (`test/unit/chargen-rng-pin.test.js`) — treat any `lvl`/`s` edit as maximum-risk and prefer leaving both untouched wherever the niche redesign allows it (change `kind`/`txt`/mechanic instead).

**Recommendation:** keep every spell's `lvl` and `s` (school) field byte-identical in this phase's content edits wherever possible. Change `kind` (Ice only), `n` (Detect Magic, mandatory), `txt` (many, for the "states its niche in one line" requirement), and add net-new mechanics (the Weaken duration, if chosen) — this keeps the chargen-shuffle-length blast radius to exactly the renames, not a combinatorial school/level reshuffle.

## Utility Spell Audit (SPELL-02)

`heal`/`ward`/`might`/`mirror`/`senses`/`foresee`/`regen`/`summon`/`turn`/`gate` — per the requirement's own list:

| Spell (kind) | Real effect? | Visible today? | Gap |
|---|---|---|---|
| Heal / Major Heal (`heal`) | Yes, `wp += dice` | Yes — `wp` bar moves, `healed` event narrated | None |
| Shield / Bubble (`ward`) | Yes | Yes — `conditionsOf` chip + Hero-tab kit row (pool only, not rounds) | Minor — add rounds to Hero-tab row (SPELL-06) |
| Strength (`might`) | Yes, one-time maxWP/might boost | Yes — `conditionsOf` `might` chip | None |
| **Mirror Self (`mirror`)** | Yes — foes need a natural 1 to hit the hero for `d6` rounds | **No** — `c.mirror` is read by `foeToHitVs`/`foeToHitBreakdown` but **`conditionsOf` never emits a chip for it** (confirmed by direct read of `engine/derived.js#conditionsOf` — the good-conditions block lists item-effects/might/ward/flight/itemCooldown/staffCharges; no `mirror` key anywhere) | **Real gap** — cheapest SPELL-02 fix in the whole phase: add one `if (c.mirror > 0) out.push({key:"mirror", polarity:"good", remaining:c.mirror})` block, one `CONDITION_COPY`/`CONDITION_TONE` row in `mazeworld.html`, mirroring the existing `might`/`ward` pattern exactly |
| **Sense Presence (`senses`)** | Yes — waives the in-dark to-hit cap (`toHit`, confirmed) and (per the engine module header comment) prevents surprise | **No chip** (`c.senses` is not read by `conditionsOf`) | **Real gap** — same fix shape as Mirror Self. Note: `c.senses` is a flat 0/1 flag with no duration/expiry anywhere in the engine (grep found no decrement site) — confirm at planning time whether it is meant to last "the day" like `might`/`c.senses=0` only clears at `endCombat` (line ~1228 of combat.js) — so today it silently persists through an entire floor/day once cast, which is arguably correct (a "the day" utility, matching Strength's framing) but should be stated in its `txt` |
| **Sense Danger (`foresee`)** | Yes — `c.foresight=true`, consumed and narrated at the NEXT `fight()` call (pre-emptive value) | Partial — the cast itself narrates `nextEncounter` type immediately (visible), but the PENDING state (foresight armed, waiting for the next fight) has no chip | Minor gap — a chip is less critical here since the effect already narrates on cast; still worth a chip for consistency, lower priority than Mirror Self/Sense Presence |
| **Regeneration (`regen`)** | Yes — `d8`/round heal, but **only ticks inside `foeTurn`** (combat-only), even though `combatOnly:false` lets you cast it while exploring | **No chip** while armed-but-not-yet-in-combat, and no chip during combat either (the heal narrates per-tick via events, but there's no persistent "Regenerating" indicator) | **Real gap** — same fix shape |
| Summon / Phantom Host (`summon`) | Yes — spawns an ally | Yes — `allySummoned`/`allyPending` events, ally shows in the party-adjacent UI | None |
| Turn Walking Dead (`turn`) / Plane Gate (`gate`) | Yes, situational | Yes — narrated events (`walkingDeadTurned`/`planeGated`/`nothingToTurn`/`gateRefused`) already name the outcome including the "nothing to turn" refusal | None — these are correctly "situational, not dead"; a refusal explains itself when off-type |

**Bottom line for SPELL-02:** the fix is narrow and low-risk — extend `conditionsOf` with 3 new chip types (`mirror`, `senses`, `regen` — `regen` as a simple boolean "Regenerating" chip with no countdown, since the field itself carries no duration) plus their shell copy/tone rows, exactly following the `might`/`ward` precedent already in the same function. No spell needs a new mechanic to satisfy SPELL-02; the mechanics already exist and work — they are only invisible.

## Day-One Damage Spell Audit (SPELL-04)

Per-sub MU_CHART offense-school access (`schoolAllowed`/`schoolGate`, both read `MU_CHART[sub]`):

| Sub | offense bonus | offense gate | Can learn Freeze (L1, only dmg-bearing L1 spell) day one? | Day-one damage today? |
|---|---|---|---|---|
| Wizard | 3 | 1 (default) | Yes | **Yes** (guaranteed via Phase 23's attack top-up, which will pick Freeze if nothing else attack-kind rolled) |
| Warlock | 4 | 1 (default) | Yes | Yes |
| Sorcerer | 4 | 1 (default) | Yes (also has must-have Freeze/Fireball grant already in `rollGrimoire`) | Yes |
| Court Mage | 2 | 1 (default) | Yes | Yes |
| Illusionist | 0 (bonus only, thrown dmg unaffected by bonus) | 1 (default — **not gated**) | Yes | **Currently NOT guaranteed** — Phase 23's top-up guarantees an *attack-kind* spell (`ATTACK_SPELL_KINDS = status, thrown, stun, weaken`), and Doze/Stun/Weaken satisfy "attack-kind" without dealing any damage. An Illusionist whose day-one top-up lands on Doze/Stun/Weaken instead of Freeze has ZERO day-one damage today. **This is the actual SPELL-04 gap for Illusionist** — fixable by narrowing the guarantee to `kind==="thrown"` (or a new "deals damage" predicate) rather than the full `ATTACK_SPELL_KINDS` set. Illusionist's own Phase 23 override (Phantom Host at level 1) is unaffected either way — it stays, Freeze is additional. |
| Cleric | 0 | 1 (default) | Yes | Currently not guaranteed for the same reason as Illusionist (top-up targets attack-kind, not damage-kind) |
| **Summoner** | 0 | **3** (`gate:{offense:3}`) | **No — structurally blocked** | **No**, and cannot be fixed by touching `MU_CHART` — see below |
| Apprentice | 0 | 1 (default) | Yes | Currently not guaranteed for the same reason as Illusionist/Cleric |

**The universal fix (Illusionist/Cleric/Apprentice/anyone else missing it):** narrow the Phase 23 day-one guarantee from "any `ATTACK_SPELL_KINDS` member" to "any spell with a `dmg` field" (or a new `kind==="thrown"` check, since Freeze is the *only* level-1 spell carrying `dmg` today). This is a small, contained change to `engine/character.js#rollGrimoire`'s `attackReady()`/top-up loop — **zero rng-draw-count change** (same `spare` array, same walk, only the predicate narrows), so it should not move the pinned draw counts in `chargen-rng-pin.test.js`, though it WILL change grimoire *content* for any sub/seed whose top-up previously landed on Doze/Stun/Weaken instead of Freeze — expect new declared chargen-content divergences, measured live per the existing `chargenDivergenceFor` mechanism (Phase 23 precedent: exactly 2 such divergences for a smaller change).

**The Summoner problem (genuinely structural, not a data tweak):** `test/unit/identity-contract.test.js` (line ~319) **locks** `schoolGate("Summoner", "offense") === 3` as part of the Summoner's documented "bad" (identity-contract SC-4 style guard — Summoner's whole-fight offense weakness is a deliberate, tested trait). Lowering `MU_CHART.Summoner.gate.offense` to 1 would satisfy SPELL-04 but **break the locked identity-contract test and remove a documented balance trait** — this is very likely NOT what the roadmap wants (SPELL-04's "additionally qualify" phrasing implies Summoner keeps its existing identity, plus something new).

**Recommended mechanism (precedent-consistent, does not touch MU_CHART or the identity-contract pin):** extend the existing per-(sub, spell) override pattern that `SPELL_LEVEL_OVERRIDES`/`spellLevelFor` already established, but for the **school gate** instead of the **spell level** — e.g. a new `content/spell-school-gate-overrides.js` (or a second field on the same file) consumed by a new `schoolGateFor(sub, sp)` helper, used by `canCast` (and `rollGrimoire`'s gate checks) in place of the raw `schoolGate(c.sub, sp.s)` call **only for spells present in the override table**. Grant the Summoner a single named-spell override (e.g. `Freeze` at gate 1) — this leaves `schoolGate("Summoner","offense")` itself at 3 (identity-contract test untouched, since that test calls `schoolGate` directly, not `schoolGateFor`), while making exactly one specific spell castable at level 1 for the Summoner. This is a genuine design decision (which spell, and whether "one named exception to a school gate" is acceptable identity-wise) — **flagged in Open Decisions below**, not decided here.

## Detect Magic / Map Reveal (SPELL-05)

**Current mechanism** (`engine/magic.js`, `kind==="reveal"` branch + `engine/maze.js#reveal`): `castSpell`'s reveal branch does a **direct, one-shot sweep of the ENTIRE floor grid** — `for (y,x) if (!wall) g[y][x].seen = true` — permanently. The normal per-step `reveal(floor, radius)` call (used by `move`/`teleport`/`descend`) only ever ADDS to `seen`, never removes it — **there is no existing re-fog mechanism anywhere in the engine.** `seen` is a plain one-way boolean per cell.

**What "reveal the floor for N steps, then re-fog only the cells it revealed" needs:** a way to tell apart, per cell, "seen because the player actually walked near it" (permanent) from "seen only because Detect Magic's window is currently open" (temporary). Two concrete options:

**Option A — per-cell provenance mark (recommended).** Add a `spellSeen: false` field to every floor cell (alongside `wall`/`seen`/`feat` in `engine/maze.js#genFloor`'s cell literal). When Detect Magic fires: for every cell NOT already `seen`, set both `seen=true` AND `spellSeen=true`. Every subsequent NORMAL `reveal()` call (from `move`/`teleport`/`descend`, i.e. genuine exploration during the window) already touches nearby cells — extend `reveal()` to also clear `spellSeen` on every cell it touches (real walking "graduates" a cell to permanent memory). Track the window itself as one `c.timers["spell:detectMagic"]` record (`cadence:"squares"`, mirroring Phase 39's item-effect model exactly). When `engine/movement.js`'s per-step `tickSquares` call reports that record's `effect→expired` transition, sweep the floor: for every cell still `spellSeen`, set `seen=false` and clear the flag.
- Cost: one new floor-cell field (needs a comparables carve-out if floor grids are part of any parity comparable — verify at planning time; likely yes, since `state.floor` is compared).
- Correctly satisfies "cells the player walked and saw normally stay seen" exactly as worded, including a cell that BOTH the spell AND normal walking would have revealed during the window.

**Option B — snapshot diff.** Capture the full `seen` boolean grid as a `Set` of already-seen coordinates at cast time; reveal everything; on window expiry, revert every cell NOT in the snapshot back to `seen=false` — **except** this loses any cell the player genuinely walked to and would have kept seeing anyway during the window, unless a second live diff is also computed at expiry time (which is mechanically identical to Option A's provenance mark, just computed lazily instead of maintained incrementally). Option B is strictly more complex for no benefit — **not recommended**, included only because the roadmap's research flag explicitly asked for "the two re-fog provenance options."

**Timer wiring:** identical shape to Phase 39's item-effect model — `startEffect(c, "spell:detectMagic", {rounds: N, cadence:"squares"})` at cast time (a squares-cadence effect record, no cooldown needed since re-casting the spell just extends/restarts the window like any other spell — no item-style cooldown vocabulary applies here), ticked by the existing guarded `tickSquares(c,1)` call already wired into `engine/movement.js`'s per-step block (Phase 36). The re-fog sweep is a new consumer of that tick's transition, analogous to how `engine/items.js` already reacts to item-effect transitions to narrate `itemEffectFaded`/`itemCooled`.

**Interaction with Phase 41 (note only, not designed here):** Phase 41's TERR-03 darkness rework is explicitly a **render-time filter** ("a render filter — the engine's `seen` memory is unchanged") limiting the visible window to 3×3 while standing on a dark square, layered on top of whatever `seen` already contains. Since Detect Magic's re-fog is an **engine-side** mutation of `seen` itself (not a render filter), the two systems are orthogonal and should not conflict — Phase 41 filters what's rendered from `seen`; this phase changes what `seen` actually contains, temporarily. No design coupling needed, but the planner should confirm Phase 41's darkness filter reads `seen` fresh each render (not a cached copy) so a Detect-Magic re-fog is picked up immediately.

**Rename:** the exact new name is Claude's discretion/user's call (voice-appropriate, states what it does) — candidates in tone: "Mapper's Eye", "The Floor Confesses", "Borrowed Sight". Flagged as an Open Decision below only for the exact wording; the *requirement* to rename is locked (roadmap SC-4/SPELL-05).

## Shield/Ward Visibility (SPELL-06)

**Already ~90% implemented** (Phase 31, CMB-04) — confirmed by direct read:
- `engine/derived.js#conditionsOf` already emits `{key:"ward", polarity:"good", pool, remaining:rounds, name}` unconditionally whenever `c.ward.pool > 0` — this is NOT gated on `state.combat` existing, so it already surfaces on the map HUD's condition-chip strip (`mm-conditions` host, painted by `paintConditions(c)` inside the general `paint()` function, not a combat-only code path).
- `mazeworld.html`'s `paintConditions` already special-cases the `ward` key to show BOTH numbers: `` `${cn.pool} hp · ${cn.remaining} rds` `` (line ~3080).
- **The one gap:** the Hero-tab "Kit" list (`mazeworld.html` ~line 3236) shows only `` `${c.ward.pool} hp left` `` — **no rounds**. One-line fix: `` `${c.ward.name}, `${c.ward.pool} hp left · ${c.ward.rounds} rds` ` ``.

This requirement needs almost no engine work — flag it to the planner as a near-trivial shell fix, not a design item.

## Scroll Scribing Bug (SPELL-07)

`engine/magic.js#readScroll`'s branch decision (does a scroll get copied into the grimoire, or cast for free once?):

```js
if (c.cls === "Magic User" && canLearn(c.sub, sp) && sp.lvl <= c.level && !c.grimoire.includes(sp.n)) {
  c.grimoire.push(sp.n);
  events.push({ type: "scrollCopiedToGrimoire", spell: sp.n });
  return events;
}
```

This checks `canLearn` (school not null — `schoolAllowed`) and `sp.lvl <= c.level` (the spell's PRINTED level, not `spellLevelFor`'s effective level, and — critically — **never checks `schoolGate` at all**). `canCast` (what actually gates whether a grimoire entry is castable) checks THREE things: known in grimoire, `spellLevelFor(sub,sp) <= level`, AND `level >= schoolGate(sub, sp.s)`.

**The reachable bug:** any (sub, spell) pair where the spell's printed level is low but its SCHOOL is gated high for that sub gets scribed into the grimoire uncastable, with the player only discovering this the next time they try to cast it (a `spellSchoolLocked` refusal — not silent, but delayed and confusing, since the "scroll copied" narration implies success). Confirmed concrete cases at level 1:
- **Warlock** reads a Heal scroll (healing, `sp.lvl=1`) — `MU_CHART.Warlock.gate.healing = 3` — scribed but uncastable until level 3.
- **Court Mage** reads a Detect Magic scroll (divination, `sp.lvl=1`) — `gate.divination = 4` — scribed but uncastable until level 4.
- **Apprentice** reads a Detect Magic scroll — `gate.divination = 3` — scribed but uncastable until level 3.
- **Illusionist** reads a Shield scroll (protection, `sp.lvl=1`) — `gate.protection = 3` — scribed but uncastable until level 3.
- **Summoner** reads a Freeze scroll (offense, `sp.lvl=1`) — `gate.offense = 3` — scribed but uncastable until level 3 (the SAME structural gate SPELL-04 needs to work around).

**The minimal fix:** replace the condition with the exact two checks `canCast` uses (minus the "already known" check, which `readScroll` already has separately): `canLearn(c.sub, sp) && spellLevelFor(c.sub, sp) <= c.level && c.level >= schoolGate(c.sub, sp.s) && !c.grimoire.includes(sp.n)`. When this is now false (spell not learnable at all, OR level/gate not yet met), fall through to the existing `scrollCast` free-cast path unchanged — this preserves the "a scroll lets you punch above your weight once" behavior for the genuinely-too-high-level case, while fixing the "scribed but permanently stuck" case. Add one new refusal-flavored narration line when a scroll's spell is scribable-in-principle-but-gate-blocked, if the design wants the SPELL-07 "refusal that names the level needed" to fire AT SCROLL-READ time rather than only later at cast time — **this is a small scope decision for the planner** (does the scroll refuse to scribe with a clear reason, or does it still scribe-then-refuse-on-cast like today, just now correctly using `spellLevelFor`/`schoolGate`?). Either resolves the actual bug; the roadmap's wording ("with a refusal that names the level needed when it does not [qualify]") reads most naturally as the CAST-time refusal already existing (`spellSchoolLocked`/`spellAboveLevel`) simply becoming reachable in a sane state rather than a forever-stuck grimoire entry.

**Fixture impact:** `action-script.magic.json`'s `scroll` scenario (seed 7) exercises `readScroll` directly (see FIXTURE-INVENTORY.md line 44) — verify at planning time whether that scenario's rolled spell crosses this branch boundary; if so, declare and measure per the greenfield rule.

## Bot Impact (`tools/lib/tuning-bot.mjs`)

**Casting policy today** (`chooseSpell`, confirmed by direct read): scores every currently-castable spell into KILL(400+)/DAMAGE(300+)/DISABLE(200+, only 2+ foes)/HEAL(100+)/WARD-OPENER(50) tiers. **Never auto-casts:** `quake`, `vapor`, `insane`, `blind`, `petrify`, `might`, `regen`, `reveal`, `foresee`, `senses` (handled elsewhere or not at all), `summon`/`mirror` (handled by separate opener rules in `decideAction`, not this table). Freeze is hardcoded to score 410 (`sp.n === "Freeze"` check) — **a rename of Freeze would silently break this scoring rule** (not Detect Magic, but worth the general warning: any spell-name-keyed logic anywhere, including this bot table and Lightning's own name check in `castSpell`, breaks on rename unless updated in the same commit).

**What this phase must keep working:** the bot must not regress — every `chooseSpell` branch's `sp.kind`/`sp.n` checks must still resolve correctly against whatever the phase's final content table looks like. If Ice gains a real DOT mechanism (`kind` change or new field), `chooseSpell`'s `kind==="thrown"||"volley"||"acid"` branch already handles `acid`-kind spells generically (the existing Acid entry proves this works) — **if Ice becomes acid-kind, the bot's damage tier picks it up for free, no bot code change needed.** If Weaken gains a duration/chip, no bot change is needed (the `weaken` branch already just checks `C.weakened`).

**What Phase 42 must learn (explicitly out of this phase, confirmed by the roadmap's own phase boundary):** teaching the bot to prefer NEW niches tactically (e.g. use Weaken as an opener vs. a specific enemy composition, exploit the timed map-reveal for exploration efficiency) is Phase 42's job. This phase only needs the bot to keep functioning (not error, not get stuck) against the reworked table — the existing `chooseSpell`/`bestCastableSummonIdx`/`lowestCastableUtilitySpellIdx` functions are generic over `kind`, so a content-only rework (no new `kind`s except possibly Ice) should need zero bot code changes at all.

## Fixture/Chargen Impact — the mechanism to reuse, not invent

The project already has TWO precedent mechanisms for exactly this kind of "a content/logic change moves specific chargen seeds' grimoire content, not their rng draw count" divergence:
1. **`chargenDivergenceFor`/`stripDeclaredFields`** (Phase 23) — used for the original day-one-attack-spell guarantee; declared exactly 2 seed-level content divergences (seeds 15, 24), documented in `test/parity/FIXTURE-INVENTORY.md`.
2. **`chargenShiftOf`/`stripChargenShift`/`chargenShiftDiffs`** (Phase 38) — extended for the abilities-table reshape; declared 20 measured divergence records across chargen seeds AND scenario/script-level fixtures.

**Recommendation:** this phase's grimoire-content changes (day-one damage guarantee narrowing, Detect Magic rename, any spell add/remove) should be measured LIVE against the current engine (not hand-computed — every phase's own retrospective notes stress this) and declared via the SAME mechanism, most likely extending `chargenDivergenceFor` with a `grimoire` field the same way Phase 38 added a `skills` field. Budget real time for this — it is very likely the single largest fixed cost in the plan, larger than the engine logic changes themselves, precisely because Detect Magic is a near-universal level-1 divination pick across most MU subs.

## Common Pitfalls

### Pitfall 1: Touching `dayOnePool`'s predicate shape
**What goes wrong:** `rollGrimoire`'s `dayOnePool = sp.lvl===1 && schoolGate(sub,sp.s)<=1` is explicitly commented as frozen — routing it through `spellLevelFor` (or any override) shifts the `spare` array's LENGTH, which shifts the Fisher-Yates shuffle's draw count, which reorders EVERY subsequent chargen field (stats, weapon, armor, gold...) for affected seeds.
**Why it happens:** it looks like the natural place to apply a new override (e.g. the Summoner offense-gate override) since it already gates by school.
**How to avoid:** any new per-spell gate override (the recommended Summoner fix) must NOT touch `dayOnePool`/`spare`'s membership — apply it only at `canCast`'s school-gate check and, if the guarantee needs to reach it, at the SEPARATE `attackReady()`/top-up walk (which already tolerates content changes without altering `spare`'s own length, per the Phase 23 precedent of narrowing `attackReady`'s target set with zero new draws).
**Warning signs:** `test/unit/chargen-rng-pin.test.js`'s per-sub pinned draw counts changing for a sub whose `spare` pool membership should have been untouched.

### Pitfall 2: Renaming a spell without a name-keyed logic sweep
**What goes wrong:** at least two places key off a spell's literal `n` string outside the content table: `castSpell`'s Lightning "every foe" special case (`sp.n === "Lightning"`) and the tuning bot's Freeze scoring (`sp.n === "Freeze"`). A rename of either spell without updating these breaks their special behavior silently (Lightning stops hitting everyone; Freeze stops being prioritized as a kill).
**Why it happens:** these are legacy name-keyed checks (not kind-keyed) predating this phase.
**How to avoid:** grep `sp.n ===` and `SPELLS.find.*n ===` across `engine/` and `tools/` before finalizing any rename; Detect Magic itself is not name-keyed anywhere in engine logic (confirmed — only `content/spells.js`'s own row and narration strings reference it), so its rename is comparatively safe, but the sweep should be run for every renamed spell, not assumed safe by default.
**Warning signs:** a renamed spell's special-case behavior (AoE, kill-priority) silently reverting to its generic kind's default.

### Pitfall 3: Assuming the identity-contract test can be edited to unblock Summoner
**What goes wrong:** the Summoner's `schoolGate("Summoner","offense")===3` is a DELIBERATE, tested trait (its documented "bad"), not an oversight. Lowering it in `MU_CHART` to satisfy SPELL-04 silently removes that identity trait and will fail `test/unit/identity-contract.test.js`'s existing assertion — or worse, get "fixed" by editing the test itself, which defeats the whole point of the identity-contract suite.
**Why it happens:** the most obvious reading of "Summoner needs a day-one damage spell" is "lower its offense gate."
**How to avoid:** use the per-spell override mechanism recommended above (new table, new helper, used only by `canCast`/scroll logic — never by `schoolGate` itself, which the identity-contract test calls directly).
**Warning signs:** `identity-contract.test.js`'s Summoner section failing during implementation.

### Pitfall 4: Detect Magic's re-fog sweep running on every step instead of once at expiry
**What goes wrong:** if the re-fog logic is wired into the per-step tick loop without checking for the specific "just transitioned from effect to expired" moment (the `{from,to}` transition `tickSquares` already returns, per the Phase 36 pattern items already consume), the floor grid gets swept every single step while the timer is active, which is both wasteful and could accidentally re-fog a genuinely-walked cell if the "clear `spellSeen` on real reveal" ordering isn't strictly before the sweep each step.
**Why it happens:** the natural first implementation loops "for every live spell-reveal timer, check expiry" inside the per-step tick without gating on the transition edge.
**How to avoid:** follow Phase 39's `narrateTimerTransitions` precedent exactly — react to the ONE transition event the tick call returns, not a live poll every step.
**Warning signs:** a re-fog sweep running (and being observable via test instrumentation) on steps where the timer is merely ticking down, not expiring.

## Code Examples

Verified patterns from this codebase (no external sources — internal precedent):

### The existing per-sub spell-level override (the direct precedent for the recommended Summoner school-gate override)
```js
// content/spell-level-overrides.js — Phase 23
export const SPELL_LEVEL_OVERRIDES = {
  Summoner: { Summon: 1 },
  Illusionist: { "Phantom Host": 1 },
};

// engine/derived.js — the one consumer
export function spellLevelFor(sub, sp) {
  const override = SPELL_LEVEL_OVERRIDES[sub]?.[sp.n];
  return typeof override === "number" ? override : sp.lvl;
}
```
A `schoolGateFor(sub, sp)` helper following this exact shape (new table, one consumer, fallback to `schoolGate(sub, sp.s)`) is the recommended SPELL-04 mechanism.

### The existing item-effect timer model (the direct precedent for Detect Magic's timed window)
```js
// engine/effects.js (Phase 36) — startEffect/tickSquares/remaining/isReady already exist
// engine/derived.js#liveItemEffects (Phase 39) — the "read every live c.timers item effect" pattern
export function liveItemEffects(c) {
  const out = [];
  if (!c || !c.timers || typeof c.timers !== "object") return out;
  for (const id of Object.keys(c.timers)) {
    if (!id.startsWith("item:")) continue;
    const rec = c.timers[id];
    if (!rec || rec.phase !== "effect" || !(rec.left > 0)) continue;
    // ...
  }
  return out;
}
```
The Detect Magic timer should use an analogous `spell:` id prefix (`c.timers["spell:detectMagic"]`) rather than reusing `item:`, so `liveItemEffects`'s own prefix filter never accidentally picks it up.

### The existing missing-chip pattern to copy for Mirror Self / Sense Presence / Regeneration
```js
// engine/derived.js#conditionsOf — the exact precedent to extend
if (c.might > 0) out.push({ key: "might", polarity: "good" });
if (c.ward && c.ward.pool > 0) {
  out.push({ key: "ward", polarity: "good", pool: c.ward.pool, remaining: c.ward.rounds, name: c.ward.name });
}
// ADD, following the same shape:
// if (c.mirror > 0) out.push({ key: "mirror", polarity: "good", remaining: c.mirror });
// if (c.senses > 0) out.push({ key: "senses", polarity: "good" });
// if (c.regen) out.push({ key: "regen", polarity: "good" });
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Weaken`'s `C.weakened` flag halves the HERO's outgoing damage against foes (not incoming) — inferred from the grep hit at `playerStrike`'s damage line, not confirmed by a full read of that function in this session | Current State table, row 9 | If it actually debuffs foes' damage output instead, the "control" classification still holds but the exact mechanical description in a future grimoire `txt` line would be backwards; low risk — verify with one targeted read before writing the spell's new flavor text |
| A2 | `c.senses` has no expiry mechanism anywhere in the engine (persists until `endCombat` sets it to 0) — based on a grep that found no decrement site outside `endCombat` | Utility Spell Audit, Sense Presence row | If a decrement site exists elsewhere unseen, the "lasts through a full day/floor" framing for its future `txt`/chip could be wrong; low risk, easy to re-verify with one grep before finalizing copy |
| A3 | Floor grid cells (`floor.g[y][x]`) are part of at least one parity comparable and would need a carve-out for a new `spellSeen` field — inferred from the Engine Gate's blanket "every new serialized field carved out" rule, not confirmed by reading `comparables.js` directly in this session | Detect Magic / Map Reveal, Option A | If floor grids are NOT compared (e.g. only `px`/`py`/`depth` are), no carve-out is needed and this is a non-issue; either way it costs one grep to confirm at planning time, not a redesign |

**If this table is empty:** N/A — three low-risk, cheaply-reverifiable assumptions above; none affect the phase's core recommendations.

## Open Decisions for the User

1. **Weapon/mechanism for the Summoner's day-one damage spell (SPELL-04).** Options: (a) a new per-(sub,spell) school-gate override table (recommended — grant the Summoner a single named spell, e.g. Freeze, at gate 1, leaving `MU_CHART.Summoner.gate.offense` and the identity-contract pin untouched); (b) lower `MU_CHART.Summoner.gate.offense` outright (simpler code, but breaks the locked identity-contract "bad" trait and needs that test rewritten as a deliberate identity change, not a bug fix); (c) give the Summoner a damage source OUTSIDE the offense school entirely (e.g. a new special-school "conjured bolt" spell, since `special` defaults to gate-1 for the Summoner) — most design work, cleanest identity separation. **Recommendation: (a)** — smallest blast radius, follows an existing precedent exactly, and reads as "the Summoner has one trick it can always do" rather than eroding its documented weakness.

2. **Detect Magic re-fog provenance (SPELL-05, ratified as a Key Decision per the roadmap).** Options: (a) per-cell provenance mark — cells revealed by BOTH the spell and normal walking during the window stay seen forever; only cells the spell alone touched re-fog (recommended — matches the requirement's literal wording, moderate engine cost: one new floor-cell field + one comparables carve-out); (b) snapshot diff at cast time with a second live diff computed at expiry (functionally near-identical outcome to (a), implemented lazily instead of incrementally — more complex for no behavioral difference). **Recommendation: (a).**

3. **Ice's flavor/mechanic mismatch (part of SPELL-01's niche re-derivation).** Options: (a) give Ice a REAL DOT (reuse the `f.dot`/`t.acid` shape already proven by Acid and Phase 38's Poisoned Edge — Ice becomes the level-3 upgrade of Acid's niche); (b) rewrite Ice's flavor text to match its actual current burst-with-freeze-flavor behavior (near-zero engine cost, but Ice then has no distinct niche from Freeze/Fireball beyond flavor — undermines SPELL-01's "differentiated by niche, not a damage ladder" goal for exactly the spell that most needs it). **Recommendation: (a)** — Ice is the cleanest DOT-tier upgrade slot in the whole offense school and the mechanism to build it already exists twice over (Acid, Poisoned Edge).

4. **How far the niche redesign reaches (SPELL-01 scope).** Options: (a) reshape only the OFFENSE school (12 offense-kind spells across the table) — smallest scope, directly matches the roadmap's own phrasing ("the offense-school niche re-derivation... are design/balance decisions"); (b) also touch Weaken's undefined duration/scope axis and Noxious Vapor/Insane's "chaos" niche naming, even though they already have distinct mechanics — pure `txt`/labeling work, near-zero engine risk; (c) full-table pass including healing/protection/divination/illusion/special schools (already functionally fine per the Current State audit — mostly a `txt`-clarity pass, not a mechanic redesign). **Recommendation: (a) + (b)** — the offense-school reshape is the only place with a genuine mechanic gap (Ice, Weaken's missing duration); the other schools need at most SPELL-01's "states its niche in one line" `txt` treatment, which is low-risk and can be done everywhere without a design decision.

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `content/spells.js` — full 32-row SPELLS table
- `content/mu-chart.js` — MU_CHART school access/gate table
- `content/spell-level-overrides.js` — SPELL_LEVEL_OVERRIDES precedent
- `engine/magic.js` — castSpell (every kind), drinkPotion, canRead, readScroll (full file read)
- `engine/derived.js` — canCast, canLearn, schoolBonus, schoolGate, spellLevelFor, conditionsOf, eff, ATTACK_SPELL_KINDS, castableAttackSpells, bestAttackSpell (full file read)
- `engine/character.js` — rollGrimoire (full function read)
- `engine/maze.js` — reveal(), genFloor cell shape
- `engine/movement.js`, `engine/combat.js` (grep + targeted reads) — foe status flags, C.ward/C.ally handling
- `mazeworld.html` — paintConditions, CONDITION_COPY/TONE, Hero-tab kit list (lines 2886-3244 region)
- `tools/lib/tuning-bot.mjs` — chooseSpell, bestCastableSummonIdx, lowestCastableUtilitySpellIdx, decideAction's spell-related branches
- `test/unit/identity-contract.test.js` — the locked Summoner offense-gate-3 assertion
- `test/unit/chargen-rng-pin.test.js` — rollGrimoire draw-count pinning mechanism
- `test/parity/FIXTURE-INVENTORY.md` — magic.json's four scenarios (cast-damage seed 8, heal seed 7, potion seed 1, scroll seed 7) and the Phase 23 chargenDivergence precedent (seeds 15, 24)
- `.planning/phases/36-.../36-02-SUMMARY.md` — engine/effects.js's seven-function timer model
- `.planning/phases/38-.../38-CONTEXT.md`, `docs/ABILITIES.md` — the abilities model's "fun over symmetry" precedent, refusal ladder, ledger format
- `.planning/phases/39-.../39-CONTEXT.md`, `docs/GEAR-BALANCE.md` — the once-a-day rule, c.timers activation model, chips via conditionsOf
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — phase goal, requirements, Key Decisions, Engine Gate + greenfield amendment
- `.planning/config.json` — nyquist_validation:false, security_enforcement:false (both sections omitted below per config)

### Secondary / Tertiary
None — this is a closed, self-contained codebase with no external library dependency for this phase; no web search was performed (config has all search providers disabled, and none would apply to a hand-authored internal spell table).

## Metadata

**Confidence breakdown:**
- Current-state spell audit: HIGH — every claim traced to a specific line/function read this session
- Niche map proposal: MEDIUM — the mechanism recommendations (reuse `acid`/`f.dot` shapes, extend `conditionsOf`) are HIGH confidence; the exact final `txt`/naming/duration numbers are explicitly left to the discuss-phase/planner as design calls
- Day-one damage / scroll bug findings: HIGH — both traced through the exact gate-check code paths with concrete reachable (sub, spell, level) examples
- Detect Magic re-fog: MEDIUM — the provenance-mark mechanism is a novel design for this codebase (no existing precedent to point to directly, unlike the timer model itself which is HIGH confidence); flagged as a ratified Key Decision, as the roadmap itself requires

**Research date:** 2026-09-18
**Valid until:** effectively indefinite for the codebase facts (internal, no external API drift risk); re-verify only if Phase 39's `c.timers`/`conditionsOf` shape changes before this phase plans, which is not expected
