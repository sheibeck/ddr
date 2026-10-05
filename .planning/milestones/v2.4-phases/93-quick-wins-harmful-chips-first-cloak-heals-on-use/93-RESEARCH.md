# Phase 93: Quick Wins: Harmful Chips First & Cloak Heals on Use - Research

**Researched:** 2026-10-03
**Domain:** Internal engine + view-layer change in a vanilla-JS / Node 22 `node:test` codebase (no external packages)
**Confidence:** HIGH (every claim below was read from the repo at HEAD `e96f8445`, or measured by running a scratch prototype of the whole change in a `git archive` copy outside the repo; nothing in the repo was modified)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cloak of Regeneration heals on use (ITEM-08)**
- **Ruling (B), a fourth tick (user, 2026-10-03):** using the cloak heals a d6 at once, then a d6 at 10, 20 and 30 squares walked, exactly as today. That's 4 ticks and 4d6 per use (about 14 hp, up from 10.5). The 30-square window, the 50-square cooldown and the 80-square cycle (once a day) are unchanged. The walking ticks keep their marks at 10, 20 and 30.
- **The instant tick heals in a fight too (user, 2026-10-03).** The worn cloak's row is already in the combat ITEMS menu, so a mid-fight use heals the d6 at once. The follow-up ticks still come only from walking ("Fights do not count. Only walking does." stays true for them).
- **Narration reuses the existing tick line and its rail twin (user, 2026-10-03).** The instant heal is a `healTick` ("Cloak of Regeneration knits you back: +4 hp. Tick 1 of 4."; rail "+4 hp: Cloak of Regeneration (1/4)."). It's told right after the use's start line, which now says a d6 comes now and then every 10 squares, 3 more times. There's no new event type, so no new EVENT_NARRATION entry is needed. If one does get added anyway, it gets its rail twin and coverage per the engine gate. A use at full hp is told ("Nothing left to knit.") and spent, like any tick (Phase 88 rule, carried forward).
- **Joiners: no change to fight behaviour (user, 2026-10-03).** `knit` stays out of `MEMBER_COMBAT_KINDS` (a Joiner's round-1 opener fires at full hp and would waste the tick). When the player uses a Joiner's cloak (outside a fight), the Joiner gets the same instant tick (by name, from its own keyed stream: `"member", <partyIdx>` appended) and the same follow-ups. Taking the cloak off still stops any ticks left, through the Phase 88 source link.
- **One count everywhere:** the item `txt`, the Regenerating chip (3 ticks left right after a use, then 2, 1, gone), the Gear, store and find cards, the start line, the ITEM-AUDIT row (and a 2026-10-03 entry in its Rulings) and the patch-notes line all state the same rule: one d6 at once, then three more every 10 squares walked.
- **Rng:** the instant tick's d6 comes from the same keyed heal-over-time stream as the walking ticks (`derivedRng(<main cursor>, "healTick", <item key>, <tick>, state.steps[, "member", partyIdx])`). The main rng is only read for its cursor, so a seeded run that never uses the cloak plays out identically.
- **Fixtures:** only fixtures that use the cloak may move. Each one is measured, declared (before/after rationale) and regenerated: no blanket regeneration, and the master file is never edited.
- **Fair bot:** `tools/lib/tuning-bot.mjs` plays the new rule. `knitWindowHeal` reads 4 x 3.5 = 14 (pinned at 10.5 in `test/unit/bot-balance-close.test.js` today), and its use logic counts the heal that lands at once.
- **Price unchanged:** `engine/economy.js` keeps "Cloak of Regeneration": 1400. The buff is one d6 per 80 squares, and no economy or bot pass is planned in v2.4.

**Harmful chips first (CHIP-01)**
- **Both hero chip rows (user, 2026-10-03):** the condition strip under the HUD (`#mm-conditions`, `paintConditions` in `mazeworld.html`) and the hero's card in YOUR LOT (`yourLotChipsFor` for `{ kind: "hero" }`). The strip stays visible during fights and is the only place Poisoned/Diseased show (YOUR LOT lists only the `fight: true` entries; `affliction` is `fight: false`).
- **Harmful = everything the engine marks `polarity: "bad"` (user, 2026-10-03):** affliction (Poisoned/Diseased), foeEffect (Weakened/Dazed), darkness, fearArmed, afraid, heroOut, heroBlind, heroShrunk, fightDark, insulted, selfDot. That includes the strip's amber-toned Darkness, Afraid and Fear-armed chips. Ether-in-stone (amber on the strip, but engine-good) stays in the good group.
- **Stable partition (roadmap criterion, locked):** bad first, then the rest, each group in its existing `conditionsOf` relative order. Poisoned/Diseased are already the first bad descriptors, so they land at the far left. A long row can only push good chips off the right edge.
- **One pure helper in `src/browser/heroConditions.js`** drives both rows, so the engine's `conditionsOf` / `memberConditionsOf` order and fixtures don't move. Joiner rows and foe chips keep today's order (user ruling, out of scope).

### Claude's Discretion
- The data shape for "one tick on use" in the cloak's `act.hot` (e.g. an on-use flag with three walking ticks, or four ticks where the first lands at use), the tick numbering, and the instant tick's stream key, as long as the walking marks stay at 10/20/30, the main rng is untouched and the chip and lines read "N of 4".
- The exact wording of the updated item text, start line and patch-notes line, in the house voice (sarcastic, family-friendly, rules-exact; Phase 95 later moves this text into the technical layer and writes flavour on top).
- The helper's name and where the hero-only ordering hooks in (e.g. a `harmfulFirst` export bridged on `window.__mzHeroChips`, applied in `paintConditions` and to the hero card only).
- Starting `docs/patch-notes/2.4.0.md` as a **DRAFT** (format in `docs/patch-notes/README.md`), with the cloak and chip lines; the user agrees it at release time per `docs/RELEASING.md`.

### Deferred Ideas (OUT OF SCOPE)
- Joiner and foe chip ordering, and chip-row overflow handling: out of scope by the user's 2026-10-03 ruling.
- A hurt Joiner using its cloak on its own mid-fight: considered and declined for now (it would need a below-threshold gate in the Joiner's fight item pick).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHIP-01 | Harmful condition chips (disease, poison, any `tone: "bad"`) always render first (far left), stable order within each group; view layer only so engine `conditionsOf` order and fixtures don't move | Section "CHIP-01" below: pure `harmfulFirst` in `src/browser/heroConditions.js`, wired at `mazeworld.html` `paintConditions` (L3956) + `yourLotChipsFor` (L5117) + bridge (L7396) + `test/unit/harness/shellSandbox.js:199`. Prototype run: strip became `affliction,darkness,haste,might,mirror,foresight` from engine order `haste,might,mirror,foresight,affliction,darkness`; zero existing tests moved. |
| ITEM-08 | Using the Cloak of Regeneration heals one tick immediately (ruling B, a fourth tick), then the walking ticks; derived stream, never main rng; Joiners follow; item text, chip, narration + rail twin, ITEM-AUDIT, patch notes, fair bot updated; any moved fixture declared | Section "ITEM-08" below: `hot.onUse` flag, one shared `healTickOnce`, called from `applyActivation` after `itemEffectStarted`. Prototype run listed the exact 23 tests/fixtures that move (Section "Everything that moves"). |
</phase_requirements>

## Summary

Both fixes are small and independent, and both were prototyped end to end in a scratch copy (`git archive HEAD` into the session scratchpad, `node_modules` junctioned; the repo itself is untouched). The prototype ran the full suite: **the only tests that fail because of the cloak change are 21 named tests in 10 files plus two roll-high state pins, and CHIP-01 moves no existing test at all** (it added one passing scratch test). That list is the planner's task list for "tests that move"; it is given file:line below. Baseline for comparison: `node --test` at HEAD = **10,183 tests, 10,175 pass, 0 fail, 8 skipped, 3 m 36 s** (measured this session).

ITEM-08 design that keeps the blast radius smallest (all verified by prototype): keep `act.hot.ticks: 3` meaning the **walking** ticks and add a boolean `act.hot.onUse: true`. Then `validHot`, `healTicksDue` (derived.js:740), `healTicksLeft` (derived.js:759), the chip's `ticks` (derived.js:1211, reads 3/2/1 after use), the take-off line's "N ticks unspent", the `every * ticks == effect` content invariant and `itemEffectStarted.ticks` ("3 more times") all stay **byte-for-byte unchanged**. The instant tick is one extra call, `healTickOnce(...)`, made from `applyActivation` right after `events.push(started)` (engine/items.js:1491), so event order is `itemUsed > itemEffectStarted > healTick(1/4)`, and the same seam serves the hero (`useItem`, in or out of a fight) and a Joiner (`memberUseWorn`). Walking ticks keep their derived-stream key `(cursor, "healTick", key, k, steps)`, k = 1..3, so they roll exactly what they roll today; the instant tick uses key tick `0` (a value no walking tick can have) and the event reports `tick: 1, ticks: 4`, walking ticks report `2..4 of 4`. Probe result: hero use at 10/55 hp gives `itemUsed > itemEffectStarted > healTick#1/4`, wp 15, `rngState` unchanged, identical in a fight (combat stays open; an item use is a free action in this engine).

CHIP-01 is a ten-line pure stable partition (`polarity === "bad"` first) applied to the hero's descriptor list in the two hero consumers only. Everything else (Joiner Company chips, foe chips, `lotChips`, engine `conditionsOf`) is untouched.

**Primary recommendation:** Plan three small plans: (1) CHIP-01 helper + wiring + tests + bridge doc; (2) ITEM-08 engine/content/narration + the moved unit tests; (3) fair bot + moved fixtures declared (`FIXTURE-INVENTORY.md`, chargen seed 4, two roll-high pins) + ITEM-AUDIT/GEAR-BALANCE/DIFFICULTY-RETUNE docs + the 2.4.0 DRAFT patch notes, ending with a "one rule everywhere" guard test.

## Project Constraints (from CLAUDE.md)

- Project instructions file is `C:\projects\mazeworld\.claude\CLAUDE.md`; its only actionable directive is **GSD workflow enforcement: start file-changing work through a GSD command** (the executor runs under `/gsd-execute-phase`). No project skills exist (`.claude/skills` and `.agents/skills` absent).
- Engine gate (STATE.md "Ground Truth", binding as a locked decision): engine pure/deterministic; parity byte-identical for solo/empty-party play; new rng draws only from derived streams; new serialized fields carved out of the three `*Comparable()` fns in `test/parity/harness/comparables.js` (this design adds **no serialized field**: tick progress is read off the timer record's own `left`); `test/parity/prototype-master.js.txt` NEVER edited; every new event type gets an `EVENT_NARRATION` entry plus rail twin (this design adds **no event type**).
- Engine gate AMENDMENT (user 2026-09-17, "greenfield, no legacy behaviour"): new rule is the only rule; no lazy fields / shell-only options; where a deliberate change moves a parity fixture, DECLARE (before/after rationale) and regenerate only that fixture; old saves tolerant load only; bot always plays the new rules.
- Player text rules (docs/narrative-pass/README.md, patch-notes/README.md): "hp" never "WP"; U+2212 minus and U+2013 range; British spelling; family-friendly deadpan; roll-high phrasing; no retired terms.
- Working tree is **CRLF** (`core.autocrlf=true`, no `.gitattributes`): multi-line exact-string edits must match `\r\n`; any scripted rewrite must preserve CRLF or `git diff` shows whole-file churn. (Index is LF.)
- Per MEMORY.md: GSD runs from the home dir targeting `C:\projects\mazeworld`; start every shell command with `cd C:/projects/mazeworld && ...`. Executor commits (this research does not).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Instant heal on cloak use (hp change, derived-stream roll, `healTick` event) | Engine (`engine/items.js`) | Content (`content/treasure-tables.js` act data) | HP and rng are engine-owned; the rule is data on the activation record (`act.hot.onUse`) |
| "Tick k of 4" numbering, chip `ticks`, unspent count | Engine derived reads (`engine/derived.js`) | — | Existing pure readers; unchanged under the `onUse` flag design |
| Start / tick / take-off wording (Oracle + rail twin) | Shell view modules (`src/browser/eventNarration.js`, `narrationLines.js`) | — | Presentation only; read the event's own numbers |
| Item text on Gear / store / find / loot cards | Content row `txt` (single source) | `src/browser/viewModels.js#itemStatLines` (L357) renders `item.txt` | Every card prints `item.txt`; one edit propagates to all cards |
| Regenerating chip detail + explanation | Shell (`mazeworld.html` `CONDITION_COPY`/`CONDITION_EXPLAIN`/`paintConditions`) | Engine `conditionsOf` supplies `ticks` | Chip copy lives in the shell's one copy table |
| Harmful-chips-first ordering | Shell view layer (`src/browser/heroConditions.js` pure helper) | `mazeworld.html` call sites + `window.__mzHeroChips` bridge | Requirement says view layer only; engine `conditionsOf` order and fixtures must not move |
| Fair bot cloak model | Tooling (`tools/lib/tuning-bot.mjs`) | — | Bot reads activation data via `activationFor(it).hot` |
| Fixture declaration | Test docs (`test/parity/FIXTURE-INVENTORY.md`, chargen fixture `rationale`) | roll-high pin comments | Repo convention (Phases 88/89/92) |

## Standard Stack

### Core
No external libraries are involved. Everything is existing in-repo modules and Node built-ins.

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `engine/items.js` | HEAD | `applyActivation` (L1458), `tickHealOverTime` (L1579), `memberUseWorn` (L1764), `useItem` (L1905) | The only place item effects start and heal ticks fire |
| `engine/derived.js` | HEAD | `validHot` L722, `healTicksDue` L740, `healTicksLeft` L759, chip `ticks` L1211 | Pure readers; no change needed under Option A |
| `engine/rng.js` `derivedRng` | HEAD | Keyed pure stream for the tick die | Established Phase 88/89 pattern (`partyHeal`, `memberPotion`, `healTick`) |
| `engine/dice.js` `rollDice` | HEAD | Rolls `act.hot.heal` from the derived stream | Using it (not `rng.d(`) keeps `roll-high-guard` DRAW_INVENTORY unchanged (verified: that test did not move) |
| Node `node:test` | Node v22.23.2 (verified `node --version`) | Test runner (`npm test` = `node --test`) | Project standard |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `tools/roll-high-baseline.mjs pins` | Prints the roll-high pin table (runs each twice) | Measure which pinned runs moved; paste only moved labels |
| `tools/fixture-inventory.mjs --json` | Parity roster replay | Prove the generated roster block is unchanged (88-04 precedent) |
| `tools/worn-fixture-scan.mjs` | Report-only: which parity sites carry a worn cloak | Confirm exposure of worn-cloak fixtures |
| `tools/narrative-review.mjs --check` | Narrative-pass pages in sync | Run after any ledger edit (passes today) |
| `tools/patch-notes.mjs --check` | Validates the CURRENT version's notes (2.3.0) | Run to prove a 2.4.0 draft does not disturb it |
| `tools/bridge-doc.mjs --write` | Regenerates the bridge table in `docs/SHELL-MODULES.md` | Only if the `__mzHeroChips` registry `purpose`/`consumers` text is edited |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `hot.ticks: 3` + `hot.onUse: true` (recommended) | `hot.ticks: 4` with marks shifted `(k-1)*every` | Touches `healTicksDue`, `healTicksLeft`, breaks the pinned invariant `every * ticks === effect` (heal-over-time.test.js:135), changes the chip/take-off counts and the bot's formula. Larger diff, no benefit. |
| Instant tick key tick `0` (recommended) | Instant tick key tick `1` and renumber walking keys 2..4 | Would change every walking tick's roll vs 2.3.0 for the same cursor/steps; needless fixture churn. Key shape is Claude's discretion per CONTEXT. |

**Installation:** none (no packages).
**Version verification:** n/a (no packages). `node --version` = v22.23.2; `engines.node >= 22` in package.json.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase. Audit not applicable. **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 ITEM-08 (instant tick)

 player taps worn Cloak of Regeneration
   |-- Gear tab / combat ITEMS menu (src/browser/combatMenu.js:490 wornRows, dispatch {type:"useItem", slot})
   |      -> mazeworld.html:10009 window.mzUseItem -> engineCombatAction (in fight) | inventoryAction (out)
   |      -> engine/engine.js:154 useItem(next, {slot}, rng, events)        [rng = makeRng(next.rngState); next.acts++]
   |
   |-- Company panel USE on a Joiner (action memberUseItem) -> engine.js memberUseItem (items.js:1827)
   |      refuses `inCombat`; -> memberUseWorn (items.js:1764) (no fumble => itemUsed{member})
   v
 refusal ladder (cooldown, notWorn, pending fight...)  -> useRefused, nothing changes
   v
 Pilfer fumble check (may destroy cloak -> no heal)
   v
 itemUsed -> switch(kind) "knit" = plain break (items.js:2144)
   v
 applyActivation (items.js:1458)  [shared by hero and Joiner via `sheet`]
   |- startEffect(c, "item:Cloak of Regeneration", {squares:30, cd:50}) ; rec.src = {slot,n}
   |- push itemEffectStarted { ..., every:10, ticks:3, heal, now:true }        <-- new `now`
   |- NEW: act.hot.onUse -> healTickOnce(state, c, key, hot, k=0, cursor, events, member?)
   |        derivedRng(cursor,"healTick",key,0,state.steps[,"member",idx]) -> rollDice(d6)
   |        c.wp += min(maxWP-wp, d6) ; push healTick {tick:1, ticks:4, amount, gained[, member]}
   v
 (walking, later)  engine/movement.js:592 / :634 -> tickHealOverTime (items.js:1579)
   healTicksDue(act, rec.left, cost) -> k in 1..3 -> healTickOnce(... k ...)   push healTick {tick:k+1, ticks:4}
   v
 events -> src/browser/eventNarration.js (Oracle) / narrationLines.js (rail twin, fight log via linesForAction)

 CHIP-01 (ordering)

 engine conditionsOf(S) (good block then bad block, UNCHANGED)
   |- paintConditions (mazeworld.html:3956): window.__mzHeroChips.harmfulFirst(conds) -> strip buttons in new order
   |- yourLotChipsFor (mazeworld.html:5117): hero branch only: harmfulFirst(conds) -> lotChips(...)
   `- member branch (memberConditionsOf), memberChipsFor (Company panel), foe chips: untouched
```

### Recommended Project Structure
No new files except tests, a ledger/inventory section and the draft notes:
```
engine/items.js            # + healTickOnce (module-private), applyActivation call, tickHealOverTime loop uses it
engine/derived.js          # + (optional) healTicksTotal(hot) helper; doc comment L970
content/treasure-tables.js # cloak row: txt + act.hot.onUse (L202-213); buildActivation copies ...act.hot (L387) already
src/browser/heroConditions.js  # + export harmfulFirst
mazeworld.html             # paintConditions L3956, yourLotChipsFor L5117, bridge L7396, CONDITION_EXPLAIN.knit L3776
test/unit/harness/shellSandbox.js  # import + __mzHeroChips freeze (L59, L199) must gain harmfulFirst
docs/patch-notes/2.4.0.md  # NEW, DRAFT
```

### Pattern 1: shared tick seam (hero + Joiner + fight, one place)
**What:** extract the body of the `tickHealOverTime` loop (items.js:1590-1596) into a module-private `healTickOnce`, call it from the loop and from `applyActivation`.
**When to use:** any heal-over-time tick, instant or walking.
**Example (prototype, measured; adapt wording/names):**
```js
// Source: scratch prototype of engine/items.js (this research), mirrors existing tickHealOverTime
function healTickOnce(state, c, key, hot, k, cursor, events, isMember, partyIdx) {
  const tickRng = isMember
    ? derivedRng(cursor, "healTick", key, k, state.steps, "member", partyIdx)
    : derivedRng(cursor, "healTick", key, k, state.steps);
  const amount = rollDice(tickRng, hot.heal);
  const gained = Math.max(0, Math.min(c.maxWP - c.wp, amount));
  c.wp += gained;
  const off = hot.onUse === true ? 1 : 0;           // display numbering: instant = tick 1
  events.push({ type: "healTick", item: key, amount, gained, tick: k + off, ticks: hot.ticks + off,
                ...(isMember ? { member: c.name } : {}) });
}
// tickHealOverTime loop body becomes:
//   for (const k of healTicksDue(act, rec.left, cost)) healTickOnce(state, c, key, act.hot, k, cursor, events, isMember, partyIdx);
// applyActivation, immediately after `events.push(started)`:
//   if (act.hot && act.hot.onUse === true && c.wp > 0 && !state.dead) {
//     const isMember = c !== state.c;
//     const partyIdx = isMember && Array.isArray(state.party) ? state.party.indexOf(c) : -1;
//     const cursor = typeof rng?.getState === "function" ? rng.getState() : 0;   // READ only, never drawn
//     healTickOnce(state, c, activationKeyFor(it), act.hot, 0, cursor, events, isMember, partyIdx);   // import activationKeyFor from derived.js
//   }
// and on the started event: if (act.hot?.onUse) started.now = true;
```
Why `activationKeyFor(it)` (derived.js:598): it is the key `itemTimerId` and `liveItemEffects` use, so the instant and walking ticks name the same item key.

### Pattern 2: pure view-layer stable partition (CHIP-01)
```js
// Source: scratch prototype, src/browser/heroConditions.js (next to lotChips; `safe` already exists there)
export function harmfulFirst(conds) {
  if (!Array.isArray(conds)) return Object.freeze([]);
  const bad = [], rest = [];
  for (const cn of conds) (safe(() => cn.polarity, null) === "bad" ? bad : rest).push(cn);
  return Object.freeze([...bad, ...rest]);
}
```
Wiring (prototype): `window.__mzHeroChips = Object.freeze({ lotChips, chipText, chipSheetFacts, harmfulFirst })` (mazeworld.html:7396); in `paintConditions` (L3956-3963) `const rawConds = ... ; const conds = window.__mzHeroChips?.harmfulFirst?.(rawConds) ?? rawConds;` BEFORE `keyList` is built (so the re-arm key follows the displayed order); in `yourLotChipsFor` (L5117-5124) apply it only when `!member`: `HC.lotChips(member ? (conds || []) : (HC.harmfulFirst?.(conds || []) ?? conds ?? []))`.

### Anti-Patterns to Avoid
- **Sorting inside the engine `conditionsOf`/`memberConditionsOf`:** moves every fixture and the Joiner order the user ruled out of scope.
- **Putting the ordering inside `lotChips`:** it is shared with the member card; the user ruled Joiner order unchanged.
- **Drawing from `rng.d(`:** adds a roll-high DRAW_INVENTORY count and moves the main cursor. Use `derivedRng` + `rollDice` only.
- **Re-deriving tick progress in a new serialized field:** not needed; `rec.left` carries it (and `*Comparable()` carve-outs would be required).
- **Hand-editing multi-line strings with LF-only matchers** on CRLF files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyed deterministic roll | A new rng or main-rng draw | `derivedRng(cursor, "healTick", ...)` + `rollDice` | Same pattern as `partyHeal` (items.js:2093), `memberPotion`; main rng only read for its cursor |
| Heal clamp + member write | A second clamp/`wp` writer | the same `healTickOnce` body (hero `c.wp`, Joiner own sheet `c.wp`) | One clamp, one event shape; outside a fight a Joiner's sheet IS the live body. (`healPartyMember`, items.js:1665, exists for the in-fight ally mirror, but `knit` cannot be used by a Joiner in a fight, so the sheet write is correct.) |
| Tick numbering / counts | New counters | existing `healTicksDue`/`healTicksLeft` + `hot.onUse` | Progress is derived from the record's `left` |
| Chip/Oracle/rail sentences | Hard-coded numbers | the event's own `every`, `ticks`, `heal`, `now` fields (the Phase 88 pattern) | A bare payload must fall back to a plain line (tests assert no `undefined`/`NaN`) |
| Chip order | A re-sort of engine output | `harmfulFirst` over the descriptor list | Stable partition, one tested function for both rows |

**Key insight:** every piece already exists; the phase is one new call site, one flag and one pure partition. Anything that grows beyond that is probably moving fixtures it should not.

## Q&A for the planner (the ten questions, cited)

### 1. Instant tick mechanics
- **Hero path:** `engine/engine.js:154-158` `case "useItem"` -> `useItem` (items.js:1905). Ladder: pending fight, wrongClass, notWielded, notWorn (L~1955), combatOnly, notDark, `itemReady` cooldown refusal (L~1985), nothingToCure, Pilfer fumble (L~2020), then `itemUsed` (L~2035), then the kind `switch`; `knit` is a plain `break` (items.js:2144; comment L2139-2143 "No instant heal and no main-rng draw on use" must be rewritten). After the switch, `applyActivation(state, it, rng, events, slot || null)` at **items.js:2330** is the single timer-bookkeeping step.
- **Joiner path:** `memberUseItem` (items.js:1827; engine.js dispatches `memberUseItem`) refuses `inCombat` (L~1832), then `memberUseWorn` (items.js:1764): `leaderOnly`/`combatOnly`/`cooldown` refusals, Pilfer fumble, `itemUsed{member}`, `MEMBER_SELF_KINDS` (items.js:1694, contains `knit`) then `applyActivation(state, it, rng, events, slot, sheet)` at **items.js:1810**. So putting the instant tick inside `applyActivation` serves both with no second edit.
- **Event order:** `itemUsed` > `itemEffectStarted` (items.js:1491 `events.push(started)`) > `healTick` (new). Place the call directly after `events.push(started)`, inside the `if (left > 0)` branch (a cloak with `effect` 30 is always in it). A refused/fumbled use never reaches `applyActivation`, so no heal.
- **Data shape (recommended):** `act: { kind: "knit", effect: 30, cd: 50, hot: { every: 10, ticks: 3, onUse: true, heal: { n: 1, sides: 6, bonus: 0 } } }` (content/treasure-tables.js:213). `buildActivation` (L382-390) already spreads `...act.hot` frozen, so `ACTIVATION_OF["Cloak of Regeneration"].hot.onUse === true` with no code change. `onUse` must be tested `=== true` (hostile saves cannot reach it: activation data is content, not save state).
- **`validHot` (derived.js:722):** accepts any object with positive-int `every`, `ticks` and positive-int `act.effect`; extra keys (`onUse`) are ignored, so no change. **`healTicksDue` (L740)** unchanged: still returns 1..3 at elapsed 10/20/30 (verified by the existing `healTicksDue` tests passing in the prototype). **`healTicksLeft` (L759)** unchanged: 3 right after use (elapsed 0), 2 at elapsed >= 10, 1 at >= 20, gone at the window end; take-off right after use reports 3 unspent. **Chip `ticks` (L1211)** unchanged.
- **"Tick k of 4":** produced by `healTickOnce` (`tick: k + 1`, `ticks: hot.ticks + 1`); the Oracle/rail builders already append `Tick ${e.tick} of ${e.ticks}` / `(${e.tick}/${e.ticks})` (eventNarration.js:495, narrationLines.js:1509), so they need **no** change for the tail. Optional: a tiny shared `healTicksTotal(hot)` in derived.js (`ticks + (onUse === true ? 1 : 0)`) used by items.js, the bot and tests, so "4" is computed once.
- **Content validators / schema tests pinning `act.hot`:** only tests: `heal-over-time.test.js:123-129` (deepStrictEqual on `ACTIVATION_OF[CLOAK]`), `:131-139` (every hot row: `every * ticks === effect`, `effect + cd <= 100`, frozen; still true), `item-activation.test.js:100-103` (deepStrictEqual). No schema file exists. `content-is-pure-data` passed in the prototype.

### 2. In a fight
- A mid-fight use reaches `useItem` with `state.combat` set: combat ITEMS menu worn rows (`combatMenu.js:490-499`, `dispatch: { type: "useItem", slot }`) -> `COMBAT_DISPATCH.useItem` (mazeworld.html:5145) -> `window.mzUseItem` (mazeworld.html:10009-10015: `st.combat ? engineCombatAction("useItem", params) : inventoryAction(...)`) -> engine.js:154. `HERO_OUT_CONVERTED_TYPES` (engine.js:78) turns it into `loseTurn` while `C.heroOut` (unchanged).
- **Live hero HP in a fight is `state.c.wp`** (the `heal` case writes `c.wp`, items.js:~2046; `applyFoeDamageToPlayer` does `c.wp -= dmg`, combat.js:4179). There is no hero HP mirror in `state.combat` (the `C.allies[].wp` mirror exists only for Joiners/summons, combat.js:2451 syncs it back to `sheet.wp`). So the instant tick needs no extra write for the hero.
- **No refusal or turn cost:** items are free actions (items.js:~2338-2347 comment: "Deliberately NOT the full afterPlayerAction ... items stay free actions"), so the heal is a free heal for the hero. The cooldown ladder is the only gate (80-square cycle).
- **Joiners in a fight:** `memberUseItem` refuses `inCombat` (L~1832) and `MEMBER_COMBAT_KINDS` excludes `knit` (combat.js:2861, pinned by `joiner-combat-items.test.js:124`), so no fight path can reach a Joiner's cloak. `memberUseWorn` itself has no fight refusal and `applyActivation` writes `sheet.wp`; that is correct today because unreachable in a fight. A one-line comment on that is enough (do not add a gate; Deferred).
- **Stream key mid-fight:** `state.steps` does not advance in a fight, but the key also holds `cursor = rng.getState()` (the action's start `rngState`) and the cloak's cooldown (80 squares) prevents two uses at one `steps`; take-off marks the cloak spent (`endEffectEarly` keeps a cooldown, effects.js:198-210). So `(cursor, "healTick", key, 0, state.steps)` is unique per use. `state.acts` is NOT needed (adding it would also deviate from the CONTEXT key shape). Probe: fight use leaves `rngState` unchanged and combat open.

### 3. Narration (every line that states the cloak's numbers or count)
| Surface | File:line | Today | Change |
|---|---|---|---|
| Oracle tick | `src/browser/eventNarration.js:495-509` healTick | `... Tick ${tick} of ${ticks}.` | none (numbers come from the event) |
| Rail tick | `src/browser/narrationLines.js:1509-1531` | `(${tick}/${ticks})` | none |
| Oracle start, hero | `eventNarration.js:2146-2150` | "N squares of knitting: a d6 hp back every 10 squares you walk, 3 times. Fights do not count. Only walking does." | add `e.now` branch: say a d6 now, then every 10 squares, `ticks` more times; keep a "fights do not count" sentence scoped to the follow-ups |
| Oracle start, Joiner | `eventNarration.js:2103-2106` | "is knitting for N squares: ... walked, 3 times." | same `e.now` branch |
| Rail start, hero | `narrationLines.js:2887-2891` | "N squares of knitting: a d6 hp every 10 squares walked, 3 times." | same |
| Rail start, Joiner | `narrationLines.js:2850-2853` | same, third person | same |
| Take-off | `eventNarration.js:113-117`, `narrationLines.js:411` + `:2901-2903` | "ticks still owed / unspent" (walking ticks) | none: counts stay 3/2/1 |
| Chip explanation | `mazeworld.html:3776` `CONDITION_EXPLAIN.knit` | "A d6 of hp comes back every ten squares you walk, ... Standing still and fighting do not count." | reword: first d6 came on use |
| Chip copy | `mazeworld.html:3582` label "Regenerating", detail `N ticks` (L3991-3993) | 3/2/1 ticks | none |
| Comments | `heroConditions.js:124` ("never in a fight"), `combat.js:2857`, `derived.js:970` | stale after change | reword |
Tests pinning wording: `heal-over-time-lines.test.js:28-33,43-49,82-92` (start line regexes `/a d6 hp back every 10 squares you walk, 3 times/`, rail `/...every 10 squares walked, 3 times\./`; healTick tests feed events directly so they keep passing), `:178-187` (explain regex `/ten squares/`, `/fighting/`, `/d6/`), `joiner-item-lines.test.js:183` (input event `ticks: 3`, output "Tick 1 of 3": passes because it is event-driven; update the sample to 1/4 for consistency).
**Narrative-pass ledger:** the cloak's start line and `txt` are not in the voice corpus (`tools/lib/voice-corpus.mjs` lists healTick only, event-variants.mjs has no knit entry), and `docs/narrative-pass/why/88-04.json` / `89-05.json` rows for `oracle:healTick` / `rail:healTick` have `after` strings with no "Tick" tail, so they keep matching. The prototype changed all of these lines and **no narrative test failed** and `node tools/narrative-review.mjs --check` stays in sync. A `why/93-NN.json` row is therefore optional; add one (and run `node tools/narrative-review.mjs`) only if the healTick builder wording itself changes. **EVENT_NARRATION coverage guards:** no new event type, so no guard moves.

### 4. Every test and guard that pins the cloak's current rule (measured: these and only these failed in the prototype)
| File:line | Assertion today | Change |
|---|---|---|
| `test/unit/heal-over-time.test.js:123-129` | `ACTIVATION_OF[CLOAK]` deepStrictEqual `hot: {every:10,ticks:3,heal}` | add `onUse: true` |
| `:141-149` | txt matches `/every ten squares/`, `/three times/` | match the new text (e.g. `/at once/`, `/every ten squares/`, `/three more times/`) |
| `:151-166` "use: ... no instant heal, zero main-rng draws" | `state.c.wp === 10`; `events.some(healTick) === false` | wp = 10 + instant gain; exactly one `healTick{tick:1,ticks:4}` right after `itemEffectStarted`; `started.now`; `fakeRng([])` still proves zero main draws; keep `started.ticks === 3` |
| `:170-210` "ticks: heal exactly on the 10th, 20th, 30th" | `t.tick === k`, `t.ticks === 3`; die = `derivedRng(cursor,"healTick",CLOAK,k,steps)` | `t.tick === k+1`, `t.ticks === 4`; die key unchanged (k) |
| `:220-246` water tests | `.map(t=>t.tick)` `[1]`, `[3]` | `[2]`, `[4]` |
| `:250-258` ordering | `e.tick === 3` | `e.tick === 4` |
| `:274-293` "empty: dead / 0 hp / no timers" | `dead.c.wp === 10` after `used()` | the use now heals; re-set `wp` after `used()` or assert the post-use value; `used({wp:0})` must not heal (guard `c.wp > 0`) |
| `item-activation.test.js:100-103` | `ACTIVATION_OF["Cloak of Regeneration"]` deepStrictEqual | add `onUse: true` |
| `item-wiring.test.js:234-246` | "USE ... zero main-rng draws and no instant heal": `wp === 10` | one instant `healTick`; rename ("... and an instant tick") |
| `honest-gains.test.js:177-190` | uses cloak, then `tickHealOverTime` once with `left = 21`, `gained === min(missing, amount)` | `useItem` now heals first: reset `wp` after use (or derive from post-use wp) |
| `joiner-item-use.test.js:667-690` | after `memberUseItem`, `party[0].wp === 10`; ticks `{tick:k, ticks:3}`; `seen [1,2,3]` | instant `healTick{tick:1,ticks:4,member}` on the sheet from `derivedRng(cursor,"healTick",REGEN,0,steps,"member",0)`; walking `tick:k+1,ticks:4`; hero wp untouched. **Keep the title prefix** `heal-over-time: a hurt Joiner's own Cloak of Regeneration heals a d6 on its 10th, 20th and 30th square` (ITEM-AUDIT.md:233 pins it by substring; item-audit.test.js verifies pin titles exist in the file) or edit that pin |
| `item-text-engine.test.js:722-727` fact `says: /a (#) hp back every (#) squares you walk, (#) times; then (#) squares/d` and `regenStats()` L527-550 | claims d6, 10, 3, 50 | new regex for the new text. Verified working pair: txt "used, a d6 hp back at once, and again every ten squares you walk, three more times; then fifty squares before it will do it again" with `says: /a (#) hp back at once, and again every (#) squares you walk, (#) more times; then (#) squares/d` (all 21 tests in the file pass). Use ONE die token in the text (two `d6` tokens would each need a claiming fact); "at once" is excluded from number words by the lookbehind. Optionally extend `regenStats` to also read the instant tick |
| `bot-balance-close.test.js:109-112` | `knitWindowHeal(REGEN) === 10.5` | `14` |
| `:115-122` (28/40 hero uses cloak) | 12 missing >= 10.5 | threshold is now 14 missing: use `wp: 26` (14 missing, uses) and `wp: 27` (13 missing, 0.675 >= 0.6: not used) |
| `:124-129`, `:131-135` | 30/40 not used; 5/10 used | still pass; refresh comments (10.5 -> 14) |
| `:158-186` | `ticks <= 3` counting `healTick` in the move loop | passes (instant tick is in the use events); refresh comment, optionally count the instant too |
| `:198-212` Joiner trigger | 28/40 used, 30/40 not | same threshold shift (26 used, 27 not); 5/10 and live-window cases unchanged |
| `bot-tactics.test.js:811` | comment only ("10.5") | comment |
| `roll-high-state-pins.test.js:430` `party-1` and `:655` `deep-14` | pinned hashes | re-record (Q5) |
| `test/parity/fixtures/action-script.chargen.json` seed 4 `after.worn.cloak.txt` (L213) | old text | new text (Q5) |
Other tests/docs that mention the cloak and did NOT move (leave): `heal-over-time-lines.test.js` (event-driven), `item-effect-source.test.js`, `item-effect-ended-lines.test.js`, `joiner-item-chips.test.js`, `joiner-combat-items.test.js:124`, `hero-conditions.test.js`, `status-chit-combat.test.js`, `trap-death-repro.test.js`, `roll-high-guard.test.js` (DRAW_INVENTORY unchanged: `rollDice` on a derived stream has no `.d(`), the ITEM-AUDIT parsers, `usable-features-audit.test.js`.

### 5. Fixtures and parity
- **Which fixtures exercise the cloak:** parity: chargen seed 4 (a Thief wearing the cloak: `after.worn.cloak.txt` is DECLARED data, test/parity/fixtures/action-script.chargen.json:213), and `action-script.encounters.json:170,651` carry a bag cloak (stripped by `REWORDED_TXT_ITEMS`, `test/parity/harness/comparables.js:439`, which already lists "Cloak of Regeneration": it did not fail). Roll-high pinned bot runs (`test/unit/harness/rollHighBaseline.js:143,150`): `party-1` (seed 505) and `deep-14` (seed 808).
- **Measured result (prototype, full suite):** failing parity: `test/parity/full-suite.test.js` chargen (message `chargen seed 4: engine worn != declared after ... cloak.txt`), `chargen-parity`-family "engine chargen matches the frozen prototype for every fixture seed" and "ENG-05 phase gate" (one root cause, one fixture record). Failing pins: `party-1` (400 / alive / depth 4: **text-only**, proven by re-running `node tools/roll-high-baseline.mjs pins` with `onUse` off and the new text: identical hash `4d5d1566...`), and `deep-14` (**behaviour**: 47 -> 48 actions, dead, depth 14; the bot already used the cloak at action 10 at 75/89 hp (14 missing >= 14 under the new `knitWindowHeal`, 10.5 under the old), the instant d6 now changes everything after; with `onUse` off the same new text gives 47 actions, so the extra action is the tick). All other pins (solo-1, solo-2, solo-thief-pilfer, solo-magicuser-sorcerer, party-fighter-knight, ...) and `roll-high-save-compat` did not move: **a seeded run that never uses the cloak plays out identically**, as required. The hashes depend on the final item `txt`, so the executor MUST re-measure; do not copy my numbers.
- **How to measure whether a fixture moved (commands):**
  1. Base snapshot: `git archive <base> | tar -x -C <scratch>` plus a `node_modules` junction (that is exactly how the prototype ran); run the same command in repo and snapshot and diff.
  2. `cd C:/projects/mazeworld && node --test "test/parity/**/*.test.js"` (66 tests at the 88-04 time; baseline all pass now).
  3. `node tools/roll-high-baseline.mjs pins` (runs each label twice; prints JSON; compare to `PINNED` in `test/unit/roll-high-state-pins.test.js`).
  4. `node tools/fixture-inventory.mjs --json` byte-identical to the base (the generated roster block is not edited) and `node --test test/parity/fixture-inventory.test.js`.
  5. `node tools/worn-fixture-scan.mjs` (report only) for worn-cloak sites.
- **Regeneration (only what moved, by hand per label):** chargen seed 4: edit `after.worn.cloak.txt` and append one sentence to that record's `rationale` (88-04 did exactly this; `divergence-records.test.js` and `full-suite.test.js` then pass). roll-high pins: paste ONLY the moved labels' new `{actions, dead, depth, hash}` into `PINNED` with a dated comment block (88-04 `deep-14` comment at roll-high-state-pins.test.js:~392-406 is the template, incl. the "text-only proven by swapping the old text back" or "traced with a per-step trace against a git archive of the base" sentence). **Never run `roll-high-baseline.mjs save`** and never regenerate a blanket.
- **Where divergences are DECLARED:** `test/parity/FIXTURE-INVENTORY.md`, appended `### Phase 93 plan NN: ...` section with the table `| Entry | before | after | rationale |` and the "predictor / live scan / moved" structure (templates: Phase 88 plan 04 at that file ~L5826-5880; Phase 92.3 plan 02 at ~L8160-8176). Plus the in-JSON `rationale` of chargen seed 4, plus the dated comment next to each re-pinned hash, plus `docs/ROLL-LEDGER.md` (88-04 added a "no check-direction change" section; optional here since no check/threshold changed).

### 6. Fair bot (`tools/lib/tuning-bot.mjs`)
- `knitWindowHeal(it)` (L1169-1175): `return hot.ticks * (avg + bonus)`. Change to count the instant tick: `(hot.ticks + (hot.onUse === true ? 1 : 0)) * avg` = 4 x 3.5 = **14** (prototype confirmed `knitWindowHeal(REGEN) === 14`). Reads only `activationFor(it).hot`; no hard-coded number.
- `knitWanted(sheet, it, ctx)` (L1183-1188): `maxWP - wp >= window` or ratio < `potionThreshold`. No code change; the threshold moves with the helper (missing hp must now cover 14).
- `chooseFieldItem` (L1189-1210): ready worn `knit` tried before potion/camp, skipped while `itemEffectActive(c,"knit")`; `chooseMemberItem` (L1235-1252) same for a Joiner. No code change.
- Other cloak reads: the `decideAction` potion wait while the knit window is live (L1538: `!itemEffectActive(c, "knit")`), the comment blocks L1147-1170, L1221-1226, L1312-1322, L1526-1536 ("a d6 at 10, 20 and 30 squares") need rewording only. `tallyUsage` is untouched.
- "HP checks after use": none in the bot; the next `decideAction` re-reads live `c.wp`. In a fight the bot never uses the cloak (`buffKinds` L1103 excludes `knit`); CONTEXT does not ask it to. Leave it (bot pass out of scope for v2.4; roadmap: "no bot pass is planned").
- Doc: `docs/DIFFICULTY-RETUNE.md:7794` (Phase 92 bot-coverage table row) states "3 x 3.5 = 10.5 ... a d6 at 10, 20 and 30 squares, never in a fight": update it (or add a short Phase 93 note under the "v2.3 balance close (Phase 92)" heading, L7783).

### 7. Item text consumers
- Source of truth: `content/treasure-tables.js:211-213` (`txt`, `act`). Every card prints `item.txt`: `src/browser/viewModels.js:357` (`itemStatLines`, used by Gear sheet `gearSheet.js:190/271`, hero tab, store, loot/find cards); `viewModels.js:446,493,500` use `it.txt`. Items already rolled into a saved run carry a **copy** of the old `txt` (the roller spreads the row); per the amendment "old saves: tolerant load only", they keep stale text until re-rolled. Mention in the patch notes? No (ruling). It is a known cosmetic gap.
- `docs/ITEM-AUDIT.md:105` row (Text, Engine, Canon, Verdict, Pinned by cells) is **not** machine-checked against `txt` (item-audit tests passed with the changed `txt`), so add a guard test (below) or the criterion "ITEM-AUDIT row says the same as the item" is unenforced. Update: Text cell = new `txt`; Engine cell = `knit` effect 30 then cooldown 50; `tickHealOverTime`/`applyActivation` heals a d6 at once (derived stream key tick 0) and at 10, 20, 30; Canon cell adds "ruling of 2026-10-03 (ITEM-08, Phase 93): a fourth tick on use"; Verdict `ruled (2026-10-03)` is accepted by VERDICT_TOKENS (`ruled (YYYY-MM-DD)`); Pinned-by cells must be `test/unit/<file>.test.js: <title or unique part>` and the title must exist in that file. Add a dated bullet to `## Rulings` (L307+) in the same style as Q1..Q6. The header says "(119 distinct pins)" and `item-audit.test.js:403-405` fails if the count is wrong, so if pins are added/removed recompute `distinctPins`.
- Also update: `docs/GEAR-BALANCE.md:465` (row) and `:476` ("there are no ticks in a fight" stays true for walking ticks; add the instant one), `docs/USABLE-FEATURES-AUDIT.md:188`, `docs/ITEM-AUDIT.md:248` (Phase 92 note) if it reads stale; `design/Mazeworld Gear.dc.html:184` is an old design mock (ignore).
- Tests asserting `txt` matches engine numbers: `test/unit/item-text-engine.test.js` (facts, see Q4); `item-text-wording.test.js`, `authored-ranges.test.js` passed with the new text.

**Recommended "one rule everywhere" guard (new test, e.g. `test/unit/cloak-one-rule.test.js`):** read `CLOAKS` `txt`, the `docs/ITEM-AUDIT.md` Cloak of Regeneration row's Text cell (strip the quotes), `CONDITION_EXPLAIN.knit` (via the shell sandbox, as `heal-over-time-lines.test.js:178` does) and the `docs/patch-notes/2.4.0.md` cloak bullet; assert each states "at once"/"now" plus the three walking ticks at ten squares, and that the engine agrees (a real `useItem` emits exactly one `healTick{tick:1,ticks:4}` and `started.ticks === 3`). Without it, success criterion 4 ("the ITEM-AUDIT row and the patch-notes entry say the same thing as the item") is unenforced, because `item-audit.test.js` does not compare the Text cell to `txt`.

### 8. CHIP-01
- `paintConditions` mazeworld.html:3956-4070 (`#mm-conditions`; `conds` L3960-3962; `keyList` L3969 gates the re-arm at L~4062 and must be built from the ordered list). `yourLotChipsFor` mazeworld.html:5117-5124 (`member = ref?.kind === "member"`). `lotChips` heroConditions.js:206-221. Bridge `window.__mzHeroChips = Object.freeze({ lotChips, chipText, chipSheetFacts })` at mazeworld.html:7396; registry `src/browser/bridge.js:209-213` (keyed by name `__mzHeroChips`; adding a property changes no registered name). `bridge-registry.test.js` is a SET-EQUALITY scan of `__mz\w+` names plus a doc-sync check of `docs/SHELL-MODULES.md:849`'s generated row: adding `harmfulFirst` to the object needs no registry change; if you edit the registry `purpose`/`consumers` text (recommended: mention harmfulFirst and paintConditions), run `node tools/bridge-doc.mjs --write` and keep the doc row in sync. NOTE: `node tools/bridge-doc.mjs --check` already exits 1 on this CRLF checkout (it did before any change); the real gate is the node:test doc-sync test, which passes.
- **The sandbox must be updated:** `test/unit/harness/shellSandbox.js:59` (import) and `:199` (`w.__mzHeroChips = Object.freeze({...})`) build their own bridge object; without `harmfulFirst` there the shell tests silently run the `?.` fallback (no reorder) and a new shell test would pass for the wrong reason or fail.
- **Existing tests do not pin order:** strip tests find chips by `dataset.key` (`dark-surfaces.test.js:117`, `darkness-vignette.test.js:238`, `heal-over-time-lines.test.js:150`, `status-chit-combat.test.js:106` helper) or sort labels (`your-lot-chips.test.js:355-358` uses `.sort()`); `size-voice.test.js:123` asserts `["giant","enlarge"]` (both good, unchanged). The prototype full-suite run confirmed zero moved tests for CHIP-01.
- **New tests (node:test, `test/unit/` style, per-file helper copies):** (a) `hero-conditions.test.js` unit cases for `harmfulFirst`: stable partition on a hand-built mixed list incl. ties; ether-in-stone stays good (engine polarity good); a real `conditionsOf` state (affliction + darkness + haste + might + mirror + foresight) -> `["affliction","darkness","haste","might","mirror","foresight"]`; input not mutated, returns frozen; malformed input (`null`, non-array, entries with throwing `polarity` getter) -> `[]`/kept; all 11 bad keys land in the bad group. (b) shell test using `loadShellSandbox` + `createRecordingDocument` (pattern: `heal-over-time-lines.test.js:116-153`, or the scratch test used in this research): poisoned hero with buffs -> `#mm-conditions` first child key `affliction`; (c) `your-lot-chips.test.js` (pattern at :143-196/:351): hero card in a fight with a bad chip (Dazed via `foeEffect`) plus Smoke -> Dazed first; a member card order unchanged (control).
- Guard `engine/derived.js#conditionsOf` order test (`hero-conditions.test.js` coverage guard) stays untouched: that is the proof "engine order and fixtures don't move".

### 9. Patch notes
- Format: `docs/patch-notes/README.md` (title `# Delve, Die, Repeat <versionName>`, `## Headline` first, then categories in fixed order, flat bullets "old -> new" using the arrow, 500-char Play cut, roll-high, hp, U+2212/U+2013, British spelling). Precedent for a next-version DRAFT existing while `android/version.properties` still says the previous version: commit `b6ca9413` (2.3.0 drafted while version was 2.2.0) with the paragraph `**DRAFT, not yet agreed.** These notes are a draft for the user to agree before any release build.` which the release step deletes (docs/RELEASING.md "Agree the patch notes").
- **Verified safe (prototype):** with a `docs/patch-notes/2.4.0.md` draft present, `node tools/patch-notes.mjs --check` still prints `patch notes 2.3.0: OK (Play cut 474/500)`; `validatePatchNotes(draft, "2.4.0")` returns `[]` (DRAFT paragraph accepted); `patch-notes-pipeline`, `patch-notes`, `notes-sheet-shell`, `xp-depth-scale` tests: 95/95 pass. The check, `tools/build-www.mjs#bundlePatchNotes` and `src/browser/patchNotesData.js` read only the CURRENT versionName (2.3.0). Do NOT edit 2.3.0.md (its line 68, "Heal over time: new. The Cloak of Regeneration is a 30-square window with no instant heal ...", is the shipped 2.3.0 rule) and do NOT run `--write-module` for 2.4.0 now. `test/unit/patch-notes-pipeline.test.js:225` pins `readVersionName() === "2.3.0"` (only moves at release).
- Suggested draft (validated):
  - `## Headline`: one short paragraph + top bullets for the cloak and chips.
  - `## Items & gear`: `- Cloak of Regeneration: first d6 only after ten squares → a d6 at once, then a d6 every ten squares walked, three more times (four in all, about 14 hp, up from 10.5). It heals in a fight too, but only the first d6; the rest still come from walking.`
  - `## Interface`: `- Harmful condition chips (Poisoned, Diseased, Weakened, Dazed, Darkness, Afraid and the rest) → always the far-left chips on the strip under the HUD and on your card in YOUR LOT, with the good ones after them.`
  The draft file needs a `## Headline` of at most 500 plain characters (checked by `playWhatsNew`).

### 10. Test commands and runtime
- `npm test` = `node --test` (package.json): **10,183 tests, 10,175 pass, 0 fail, 8 skipped, 216 s (3 m 36 s)** measured at HEAD. `npm run test:quick` = unit + determinism + roundtrip only. There is **no lint script**; "checks" are the node:test guards plus the tools below.
- Fast targeted (all node:test, seconds each): `node --test test/unit/heal-over-time.test.js test/unit/heal-over-time-lines.test.js test/unit/item-text-engine.test.js test/unit/item-activation.test.js test/unit/item-wiring.test.js test/unit/honest-gains.test.js test/unit/joiner-item-use.test.js test/unit/bot-balance-close.test.js test/unit/bot-tactics.test.js test/unit/bot-joiner-items.test.js test/unit/item-audit.test.js test/unit/item-effect-ended-lines.test.js test/unit/roll-high-state-pins.test.js test/unit/roll-high-guard.test.js test/unit/hero-conditions.test.js test/unit/your-lot-chips.test.js test/unit/bridge-registry.test.js` and `node --test "test/parity/**/*.test.js"`.
- Tools to run before the final gate: `node tools/roll-high-baseline.mjs pins`, `node tools/fixture-inventory.mjs --json`, `node tools/narrative-review.mjs --check`, `node tools/patch-notes.mjs --check`, `node tools/stale-terms.mjs` (passes today; scans `src/` incl. patchNotesData). Full `npm test` last (~3.6 min; run it in the background and poll).

## Common Pitfalls

### Pitfall 1: Reordering inside the engine or inside `lotChips`
**What goes wrong:** Joiner chips reorder (user ruled out of scope), fixtures and `hero-conditions` coverage guards move.
**How to avoid:** the partition is a separate exported function applied only in the two hero call sites. **Warning signs:** `lotChips` or `conditionsOf` in the diff.

### Pitfall 2: Updating `mazeworld.html` but not the sandbox bridge
**What goes wrong:** `test/unit/harness/shellSandbox.js:199` freezes its own `__mzHeroChips`; without `harmfulFirst` there, shell tests run the unsorted fallback.
**How to avoid:** change import (L59) and object (L199) in the same task as the HTML wiring.

### Pitfall 3: Counting the instant tick in `hot.ticks`
**What goes wrong:** `healTicksDue/Left` shift, chip reads 4, `every * ticks == effect` breaks, take-off reports 4 unspent.
**How to avoid:** `ticks` stays the WALKING count; only display numbering adds 1.

### Pitfall 4: Healing a dead or 0-hp body, or a fumbled item
**What goes wrong:** a heal after death/`pilferFumbled` revives or heals a destroyed item's effect.
**How to avoid:** the call sits after `itemEffectStarted`, inside the `left > 0` branch (a fumble returns before `applyActivation`); keep the `c.wp > 0 && !state.dead` guard (mirrors `tickHealOverTime`).

### Pitfall 5: Item-text guard counts every number token
**What goes wrong:** a text with two dice tokens ("a d6 ... then a d6") or a bare "once" fails completeness.
**How to avoid:** one d6, "at once" (excluded), words ten/three/fifty; update the fact regex (Q4). Hyphen-minus or a stray digit also fails.

### Pitfall 6: Re-titling tests that ITEM-AUDIT pins
**What goes wrong:** `item-audit.test.js` fails: pinned titles `heal-over-time.test.js: content: the Cloak of Regeneration is 30 squares of window, a d6 every 10, three ticks, 50 to cool` and `...: ticks: heal exactly on the 10th, 20th and 30th step`, plus the joiner pin (docs/ITEM-AUDIT.md:105,233).
**How to avoid:** keep a unique substring of each title (the check is substring-in-source) or edit the doc pins in the same commit; recompute the "distinct pins" count.

### Pitfall 7: Treating `deep-14` as text-only
**What goes wrong:** the 88-04 precedent re-recorded `deep-14` as "text only, proven by swapping the text back"; this time it is a BEHAVIOUR move (the bot uses the cloak at action 10 and now heals at once; 47 -> 48 actions). Declaring it text-only would be false.
**How to avoid:** per-step trace against a `git archive` of the base (wp/steps/event trace, first divergence at the `useItem cloak` step), and declare `party-1` as text-only (proven by the `onUse`-off control run).

### Pitfall 8: CRLF
**What goes wrong:** edits that drop `\r` turn whole files into diff noise; LF-only multi-line `old_string` matches fail.
**How to avoid:** match `\r\n` in multi-line edits (the prototype helper converts `\n` to `\r\n` when the file contains CRLF); do not run formatters. `git diff --stat` after each task must show small counts.

### Pitfall 9: Mid-window old saves
**What goes wrong:** a save written mid-window under 2.3.0 has no `onUse` history: its next walking tick reads "Tick 2 of 4" though no tick 1 happened. Harmless (tolerant load, amendment); do not add migration code.

## Code Examples

### Content (the only data change)
```js
// content/treasure-tables.js ~L212-213 (prototype; text verified against item-text-engine's guard)
txt: "used, a d6 hp back at once, and again every ten squares you walk, three more times; then fifty squares before it will do it again",
act: { kind: "knit", effect: 30, cd: 50, hot: { every: 10, ticks: 3, onUse: true, heal: { n: 1, sides: 6, bonus: 0 } } },
```
(Also rewrite the block comment above it at L202-211, which says "the instant d6 on use is gone".)

### Start-line shape (event carries `now`)
```js
// engine/items.js applyActivation, with the existing `if (act.hot) { started.every ... }` block:
if (act.hot.onUse === true) started.now = true;
// eventNarration.js knit start (hero), from the event's own numbers:
// `${sq} of knitting: ${healDiceText(e.heal)} hp back ${e.now ? "now, then " : ""}every ${squaresText(e.every)} you walk, ${e.now ? `${e.ticks} more times` : e.ticks === 1 ? "once" : `${e.ticks} times`}.`
```
(Prototype wording; keep the bare-payload fallback `... of knitting.` and keep "Fights do not count. Only walking does." attached to the follow-ups.)

### Bot
```js
// tools/lib/tuning-bot.mjs knitWindowHeal
return (hot.ticks + (hot.onUse === true ? 1 : 0)) * ((h.n * (h.sides + 1)) / 2 + (h.bonus || 0));   // 4 * 3.5 = 14
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloak: instant `rng.d(6)` on use, 20-square rest (260918-w4n) | 30-square window, d6 at 10/20/30, derived stream, no instant heal | Phase 88 plan 04 (2026-09-30) | Removed the roll-high main-rng `amount` draw |
| (now) | Same schedule plus a d6 at once from the same derived stream | Phase 93 (ruling B, 2026-10-03) | 4 d6 per use, ~14 hp; main rng still never drawn |

**Deprecated/outdated after this phase:** the comments "No instant heal and no main-rng draw on use" (items.js:2139-2143), "heals only by walking" (combat.js:2857), "never in a fight" (heroConditions.js:124), and the retired-event notes remain correct (`cloakRegenerated` stays gone).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Joiner Company-panel USE is the only way a Joiner's cloak is used outside the bot (no other caller of `memberUseWorn` reaches `knit`). | Q1 | `grep` shows `memberUseWorn` called from `memberUseItem` (L1827) and `alliesTurn` via `pickMemberItem` limited to `MEMBER_COMBAT_KINDS`; assumed complete. If another caller existed, it would heal the same way (still correct). |
| A2 | The user wants `healTick` start-line phrasing "now, then every N squares, 3 more times" (CONTEXT says "a d6 comes now and then every 10 squares, 3 more times"). | Q3 | Wording only; Claude's-discretion area. |
| A3 | `deep-14` after-hash/actions and `party-1` hash cited from the prototype will differ with the executor's final text. | Q5 | None if re-measured as instructed. |
| A4 | No Play-store listing / screenshots text mentions the cloak's old rule (`store-listing/` was not grepped; excluded from the scratch copy). | Q7 | A stale store text; check `grep -rn "Regeneration" store-listing` during execution. |

## Open Questions

1. **Does the in-fight instant heal need a sound or a beat?** `sfx.js:179` maps `healed` -> "heal" but has no `healTick` entry, so neither the walking ticks nor the instant tick make a sound today.
   - Recommendation: leave silent (consistent with walking ticks; no new asset); note in the plan as a deliberate non-goal.
2. **Should the bot ever use the cloak in a fight now that it heals at once?** Not requested; `buffKinds` excludes `knit`.
   - Recommendation: no change (roadmap: no bot pass in v2.4).
3. **Narrative-pass ledger row for the start line?** Not required by any test (prototype). Recommendation: skip unless the healTick builder wording changes; if added, `docs/narrative-pass/why/93-NN.json` + `node tools/narrative-review.mjs`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, tools | yes | v22.23.2 | — |
| git (`archive`, `diff`) | base-vs-after measurement | yes | repo has a harmless "garbage" tmp object warning in `.git/objects/f8` | — |
| tar / bash (Git Bash) | scratch base snapshot | yes | — | — |
| Android toolchain / Chrome | not needed (no device or boot check) | — | `npm run boot:check` is environment-blocked (STATE.md) | none needed |

Note for a scratch snapshot: `git archive` omits `android/`, so ~35 android/store-listing/dev-build tests fail there for environmental reasons (android-r8, DROID-*, 92.1-01, 91.2-01, APP_ID, store-listing, dev-build-gate, MAP-09); copy `android/version.properties` at least, and ignore those names when diffing.

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json` (absent = enabled). This phase adds no input surface, network call, storage key, dependency or secret.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 Auth, Session, Access | no | — |
| V5 Input Validation | minimal | `onUse` is content data tested `=== true`; `validHot` already rejects non-integer `every`/`ticks`; descriptors passed to `harmfulFirst` are read through `safe()` (hostile getters do not throw) |
| V6 Cryptography | no | `derivedRng` is a deterministic game stream, not a security primitive |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered save sets `hot` fields | Tampering | content is the source of `act.hot` (not save state); timer `left` is range-checked by `healTicksDue`/`healTicksLeft` |
| Heal on a dead/0-hp body | Tampering | `c.wp > 0 && !state.dead` guard |

## Validation Architecture

Skipped: `workflow.nyquist_validation` is `false` in `.planning/config.json`. Test commands are in Q10.

## Sources

### Primary (HIGH confidence)
- Repo at HEAD `e96f8445`: `engine/items.js` (L1458, 1579, 1694, 1764, 1827, 1905, 2144, 2330), `engine/derived.js` (L598, 722, 740, 759, 1211), `engine/engine.js` (L78, 154), `engine/effects.js` (L198), `content/treasure-tables.js` (L202-213, 382-390), `src/browser/{eventNarration,narrationLines,heroConditions,combatMenu,viewModels,bridge}.js`, `mazeworld.html`, `tools/lib/tuning-bot.mjs`, `test/**` as cited.
- `.planning/phases/93-.../93-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` Ground Truth, `.planning/config.json`.
- Git history templates: commits `4c8c1c43`, `1087239f`, `4190d664` (Phase 88-04), `a6faf337` (92-01), `88c0bc98` (92.3-02), `b6ca9413` (2.3.0 draft notes).
- Measured this session: baseline `node --test` (10,183 tests / 216 s); a full-suite run of the complete scratch prototype (ITEM-08 + CHIP-01), a roll-high pins run with and without `onUse`, a hero and in-fight use probe, a 2.4.0 draft-notes validation.

### Secondary / Tertiary
- none (no web sources needed; no external libraries).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no external packages; all modules read)
- Architecture: HIGH (prototype ran the full suite; probes confirmed event order, rng cursor and in-fight behaviour)
- Pitfalls: HIGH (each pitfall was observed in the prototype or read from a pinning test)
- Final numeric pins (hashes, action counts): LOW by design; they depend on the final `txt` and must be re-measured by the executor

**Research date:** 2026-10-03
**Valid until:** until the next commit touching `engine/items.js`, `src/browser/heroConditions.js` or the cloak row (the repo moves fast; re-run `git log -- engine/items.js` first)
