# Phase 25: Nothing Happens Silently (Feature Feedback) - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 4 grey areas, all recommendations accepted by the user

<domain>
## Phase Boundary

Nothing a class, race, sub-class, spell, scroll, or item does happens silently. Every feature that fires or blocks the player produces an Oracle line AND an on-screen toast that says what happened and why; enemy outcomes are visually unmistakable from the player's (red vs green); a multi-attack round aggregates into one toast; early misses read as fledgling narrative instead of "Miss"; every spell/ability/item effect in either direction is legible, including resisted/failed/nothing-to-target outcomes.

This is a PRESENTATION phase. The engine gains only ADDITIVE event payload fields (what a passive modifier contributed, e.g. hide/Hardiness soak, a Guard-shifted need, a halved armor loss) — no rule changes, no new rng draws, no new serialized state, parity byte-identical, zero fixture changes. All copy stays sarcastic, deadpan, family-friendly (voice scan).

Requirements: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06.

Today: the shell (`mazeworld.html`) builds ONE toast per player action from a `switch(type)` in `window.mzCombatFeedback` (classic scope, ~L2655), raised by `engineCombatAction` after `dispatch` (~L6335); enemy swings never toast (only the Oracle's `struckByFoe`/`foeMissed`); the Oracle narrates every engine event through the coverage-guarded `EVENT_NARRATION` table in `src/browser/eventNarration.js` (`test/unit/formatEventsCoverage.test.js` enumerates engine event types by scanning `engine/*.js`); toast tones are `hit` (moss green), `miss` (ink-soft grey), `hurt` (stamp red), `magic` (ditto gold), host cap 3.

</domain>

<decisions>
## Implementation Decisions

### Toast architecture (all FEED)
- **Mapping lives in a pure, testable toast table beside the narration table**: `TOAST_FOR[eventType] = (e, ctx) => ({ text, tone, priority })` exported from `src/browser/eventNarration.js` (or a sibling module it re-exports), with its OWN coverage guard test. The shell's `mzCombatFeedback` switch is replaced by a thin consumer that maps a dispatched action's events through the table, aggregates, prioritizes, caps, and calls `mzToast`.
- **Several toasts per action, prioritized and capped**: order = refusals/blocks first → your outcome → the enemy's outcome (aggregated) → feature call-outs → everything else; **at most 4 toasts per action**; the host's visible cap goes from 3 to 4. Existing lifetime formula and reduced-motion handling stay.
- **Hook at the single dispatch seam** every action flows through (`src/browser/engineAdapter.js#dispatch` result → the shell's post-dispatch handler), so exploration, camp, store, Joiner, and combat events all toast, not only the combat bar. If the shell has more than one dispatch call site, route them all through one `toastForEvents(type, events, ctx)` call.
- **Tone palette = two color families + two utilities**: YOU = green family (`hit` bright moss, `miss` muted moss); THEM = red family (`hurt` solid stamp, new `dodge` muted stamp for their misses); `magic` (gold) stays; NEW amber `block` tone for refusals/rejections so "couldn't" never looks like "missed". CSS tokens/`data-tone` values added in `mazeworld.html`; every tone has explicit colors.

### Combat wording (FEED-03, FEED-04, FEED-05)
- **Enemy rounds aggregate per foe**: consume that foe's `struckByFoe`/`foeMissed` events for the round → "Dante hits you 2 of 4 (11)" when it swung more than once; "Dante hits you (6)" / "Dante misses you" for a single swing; crit noted ("· CRIT"). **Three or more foes acting in one round collapse into one toast**: "3 foes swing, 2 land (14)". Party-member hits (`member` field) are narrated in the Oracle and toast as "Dante hits Bram (5)" (red family, lower priority).
- **Your multi-attack rounds mirror the wording**: "You hit Dante 2 of 2 (14) · CRIT" (Barbarian, frenzy, haste, Ambidextrous alike); single swing "You hit Dante (8)" / "You miss Dante".
- **Miss corpus**: ~12 short, voice-safe fledgling quips (≤ ~40 chars for the toast, e.g. "Your first swing is more of a suggestion.") used **only while `c.level <= 2`**, rotated by a **presentation-side counter** (deterministic, testable; NEVER the engine rng, never `Math.random` in the module). From level 3, plain "You miss X". The Oracle line keeps the roll ("7 vs 5") and appends the quip.
- **Corpus lives in `src/browser/missLines.js`** (presentation copy under `test/voice/safety-scan.test.js`), NOT in `content/`.

### Feature and refusal feedback (FEED-01, FEED-02)
- **Passive modifiers surface inside the event they affect, as ADDITIVE payload fields**: `struckByFoe` gains `soaked: { hide, hardiness, ward, armor }` (whatever applied) and the narration/toast read "hits you for 4 (hide soaked 2)"; the foe to-hit line carries `needBase`/`needMods` (e.g. Guard −1, Agility −1) so the roll text can say "needs 6 (Guard)"; armor durability loss reports `wear` and the Dwarven halving; `struck` carries the damage breakdown flags already available (crit, Master of Arms +2, Kata, Heft) only where cheap. Additive fields only — no new rng, no new serialized state; the parity comparators compare state, not events, so this is parity-neutral (confirm with the suite).
- **Every refused/rejected event toasts in the amber `block` tone with the reason in voice**, and the same line goes to the Oracle: `strikeRefused` ("Wizards don't punch. Cast Freeze."), `fleeRefused` ("A Samurai does not run."), `parleyRefused` by reason (Ninja: "Ninjas don't negotiate."; Master of Arms; Walking Dead; tried), `withdrawalDenied`, `vanishDenied`, `itemRejected`/`equipRejected` by reason (wrongClass, notBetter, noArmor, woodsman, tooHeavy, acrobat), `useRefused` (pilfer), `scrollRefused`/`canRead` false (Pilfer, no Runes), `noChargesLeft`, `spellNotKnown`/`spellAboveLevel`/`spellSchoolLocked`, `campFailed`, `joinerRefused` (cutthroat / wilmsry), `buyFailed`.
- **One combined encounter-start toast** built from `encounterStarted` flags and the events that follow it in the same action: never-first (`samuraiNeverFirst`, `fridgianSlow`, `knightBigFoe`, `courtMageTalksFirst`), `acuteHearing`, `phobiaFrozen`, `warlockBoost`, `foeFled` (knight/conArtist talk-downs), `foeBored`, `trackable`, `allyJoined`. E.g. "Big foe. The Knight waits its turn." / "Two goblins decline to fight a Knight."
- **Feature manifest + coverage test**: `FEATURE_EVENTS` (an exported list in the toast module) enumerates every class/sub-class/race feature event and flag-bearing event: frenzy, warlockBoost, foeFled(knight/conArtist), foeBored, backstab, silenceStrike, stealthStrike, ninjaFirstStrike, conArtistOpener, deathTouch, goldGained(why=pickpocket), trapDisarmed(pilfer), chestOpened-free(pilfer), potionDuplicated, rested(soldier ×2 — add a `doubled` flag), armorPatched(masterOfArms/sewing), summonBackfired, spellBackfired(apprentice), allySummoned(doubled), phobiaFrozen, shookOffFrozen, encounterStarted flags, wanderingMonster(bard), joinerRefused, storeOpened(pickpocket), sang + song outcomes, cookedBeast, plus the refusals above. A test asserts every manifest entry has BOTH a toast entry and an `EVENT_NARRATION` line, and that the manifest covers every event name asserted by `test/unit/identity-contract.test.js` (read that file's event names).

### Spell and item legibility, verification (FEED-06)
- **Both directions toast**: yours — `spellThrown`→`spellHit`/`spellMissed` ("Fireball hits Dante (12)" magic / "Fireball misses Dante" muted), `spellResisted`/`resistFailed` ("Dante resists Doze"), `nothingToThrowAt`, `dozed`, `stunned`, `weakened`, `frozenSolid` ("Freeze — Dante frozen solid"), `allySummoned`/`allyPending`, `summonBackfired`, `spellBackfired`, `healed`, ward/might/mirror/senses/reveal/foresee/regen effects, scroll read/learned, item use outcomes; theirs — `foeCast`, `foeBolted` ("Drudge bolts you (7)" red), `foeDrained`, `foeDebuffed`, `foeHealed`, `foeSummoned`, `heroResisted` ("You resist the Drudge's spell" green), `heroResistFailed`.
- **Explicit Oracle-only allowlist** (`ORACLE_ONLY`): bookkeeping events (dayBegan, floorChanged, spellChargeRecovered, stepped/moved, findTaken/findLeft when silent, etc.). The coverage test demands a toast entry for every engine event type NOT in the allowlist, so nothing new can slip in silently.
- **Verification = automated + a device checklist**: unit tests over the pure toast module (every event type → text/tone; per-foe and multi-foe aggregation; your multi-attack wording; quip rotation and the level gate; refusal reasons; encounter-start composition; feature manifest; Oracle-only allowlist), the existing narration coverage guard, and the voice scan. The phase SUMMARY attaches a **non-blocking on-device checklist** (what to look for on the Pixel 7); the orchestrator offers a phone push at phase close. No device round blocks completion.
- **Scope guard**: no engine RULE changes; additive event fields only; no new rng; no new serialized state; parity byte-identical with zero fixture changes; `test/parity/prototype-master.js.txt` untouched. If a passive-modifier payload turns out to need a draw, drop that payload rather than add the draw.

### Claude's Discretion
- Exact toast strings (short, voice-safe), the amber/muted color values, priority numbers, and whether `TOAST_FOR` lives in `eventNarration.js` or a sibling `toasts.js` it re-exports.
- How the shell's combat-end report and the `mzToast` host coexist with 4 toasts (keep the fixed-position, no-CLS contract).
- Whether party-member hit toasts are shown at all when 3+ toasts already queue (drop lowest priority first).
- The exact split of the additive payload fields across `engine/combat.js` (`applyFoeDamageToPlayer`, `foeTurn`, `playerStrike`) and `engine/movement.js` (`rested`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/browser/eventNarration.js` — `EVENT_NARRATION` (208 entries) with HTML spans `roll`/`hit`/`miss`/`hurt`/`beat`; `formatEvents`; the coverage guard `test/unit/formatEventsCoverage.test.js` scans `engine/*.js` for event types (use the same enumeration for the toast coverage test).
- `mazeworld.html` — `window.mzToast(text, tone)` (fixed host `#mw-toast-host`, cap 3, lifetime `min(4200, 1500 + len*45)`, `.mw-toast[data-tone=…]` CSS at ~L681, reduced-motion rule), `window.mzCombatFeedback(type, events, html, extra)` (~L2655, the per-action switch to replace), `engineCombatAction` post-dispatch handler (~L6320–6337: `noteCombat`, `hapticForEvents`, `logLine`, `paint`, `renderEncounter`, then the toast), `hapticForEvents` (`src/browser/haptics.js` — precedent for an events → side-effect mapper).
- `src/browser/engineAdapter.js#dispatch(action)` (~L351) — the single applyAction seam.
- `engine/combat.js` — `struckByFoe` (~L1281), `foeMissed` (~L609/1416/1436), `struck`/`strikeMissed` (playerStrike), `applyFoeDamageToPlayer` (Hardiness/hide/ward/armor soak — where `soaked` payload is computed), `foeToHitVs` in derived.js (need + mods), `encounterStarted` flags.
- `engine/movement.js#newDay` — `rested` (Soldier/Wilmsry doubling happens inline; add a `doubled` flag), `wanderingMonster.bard`, `potionDuplicated`, `armorPatched`.
- `test/unit/identity-contract.test.js` — the event names every good/bad asserts (source list for the feature manifest).
- `test/voice/safety-scan.test.js` — extend its file list to `src/browser/missLines.js` and the toast strings.
- `src/browser/viewModels.js` / `controls.js` — presentation-module precedents (pure, unit-tested, no DOM).

### Established Patterns
- Presentation modules are pure and unit-tested; the shell wires them. No `Math.random`/`Date.now` in tested modules (purity tests exist for the bot; mirror the idea for the quip rotation counter).
- Every engine event has an `EVENT_NARRATION` entry (coverage guard forbids missing AND dead entries).
- Additive event fields are the accepted way to enrich narration (Phase 23 `strikeRefused.spell`, Phase 24 `encounterStarted.knightBigFoe`, `storeOpened.pickpocket`).
- DR-era UI work: small batches, on-device review by the user; toasts must not cause layout shift (fixed host).

### Integration Points
- `src/browser/eventNarration.js` (+ optional `src/browser/toasts.js`), `src/browser/missLines.js` (new), `mazeworld.html` (toast CSS tones, host cap, consumer wiring at the dispatch handler; delete the old switch), `engine/combat.js` / `engine/derived.js` / `engine/movement.js` (additive payload only), tests: new `test/unit/toasts.test.js` (+ coverage/manifest tests), `test/unit/missLines.test.js`, safety-scan file list; existing `formatEventsCoverage` stays green.

</code_context>

<specifics>
## Specific Ideas

- The reading test: a new player watching the toast stack should never wonder "did I hit, or did it hit me?" — color family + "You"/"They" wording, every time.
- "X of N" is the whole point of aggregation; never show four "hits you" toasts for one Bat/Rat round.
- Refusals should teach: the Wizard toast names the spell; the Woodsman toast says why the mail won't go on; the Pilfer toast says what a Pilfer can use.
- Keep toasts short; the Oracle carries the full sentence and the roll.
- Attach a device checklist to the SUMMARY: roll a Fridgian (hide soak visible), a Guard (need shift), a Wizard with Freeze (refusal names it), a Bard (camp wake toast), a Pickpocket (store markup note), and a fight vs a multi-attack foe (X of N).

</specifics>

<deferred>
## Deferred Ideas

- Buy-then-reject gold-loss trap on premium store pieces (found in Phase 24) — v1.3 inventory integrity.
- Petrify / Turn / Gate still bypassing `killFoe` — v1.3 spell audit.
- Combat potions from the Gear page, "not ready yet" audit, Shield chip, round-based effects expiring outside combat — v1.3 (`.planning/proposed-milestone-feedback-feel-polish.md` §C–§G).
- A settings toggle to reduce toast volume (e.g. "combat toasts: full / outcomes only") — revisit after device play.

</deferred>
