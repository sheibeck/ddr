# Phase 33: UI Feel & Store Polish - Research

**Researched:** 2026-09-16
**Domain:** Engine store/rng-guard design (STORE-01) + shell layout/state-machine work (UIF-01..05) — no external libraries, pure code-grounded research, no web search performed per phase instructions
**Confidence:** HIGH (every claim below is `[VERIFIED: direct code read]` or `[VERIFIED: engine/test run, this session]` unless marked `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gear panel, toolbar, tutorial (UIF-01, UIF-04, UIF-05)**
- Drop confirm (UIF-01): inline two-tap on the row — tapping Drop turns the button into "Drop it? [Yes] [No]"; reverts after ~3 s or on any other tap; NO modal card (card-vs-toast rule: a minor decision stays on the row). Drop applies to any bag item including potions; equipped slots keep going through the existing unequip path (no drop from a worn slot).
- Gear row layout: `[name · detail] … [Use] [Drop]` — Use immediately left of Drop, Drop pinned far right, both ≥ 48 dp min-height, `touch-action:manipulation`. The Store's own Sell/Drop rows (Phase 29) are unchanged.
- Make Camp & handedness (UIF-05): Make Camp becomes the far-right button of the Marks/Centre row; the D-pad grid is centered with the CAMP column removed; the Handedness settings row, its `data-handedness` attribute and CSS rules (04-DR9/DR11) are deleted; a stored handedness preference is ignored (no migration UI, no error).
- Tutorial toggle (UIF-04): a new Settings row "Tutorial" (on/off) stored with the other settings (Preferences-backed via `src/browser/settings.js`/`storage.js`); the tutorial's own "Got it"/dismiss sets it off (today's `mazeworld.tutorialSeen` flag becomes the inverse of / is folded into this setting — the planner picks one source of truth); re-enabling from Settings restarts the tutorial from step 1 the next time the map is shown.

**Map recenter & default zoom (UIF-02, UIF-03)**
- Default zoom = 1.5, the literal midpoint of `ZOOM_MIN 0.6 … ZOOM_MAX 2.4` (user chose literal over the geometric 1.2).
- Persistence: pinch zoom persists for the session only; every cold start returns to the default; no zoom settings row.
- Recenter hook (UIF-02): ONE hook on the "panel closed → map visible" path (Store, Hero sheet, Oracle, Settings, Graveyard, and any other full-screen overlay) calls the existing auto-recenter used after moves (`mazeworld.html` ~L5609 "auto-recenter the viewport on the party"); also recenter after any zoom change so the party never drifts off-screen.
- Tests: source-assertion pins on the constant and the hook; no engine change.

**Store stock roll (STORE-01) — the only engine/rng change this phase**
- Parity guard: new rng draws happen ONLY when a run flag is set (working name `state.storeRoll === true`; the planner names it) that `newRun` sets on every NEW run from this version on; old saves and every parity fixture lack it → `openStore` is byte-identical for them; zero fixture edits; tolerant save read (`sanitize`/`validateSave` default the flag to false); the flag must be carved out of nothing — it is a plain boolean that fixtures never carry, so the comparables need no change (verify).
- What rolls (flag on): food/lockpicks/repair rows stay fixed. Potions: Heal always + 3 drawn from the potion table by depth. Weapons: 2 drawn from class-legal weapons within a depth cost band (deeper = pricier bands eligible). Armor: best class-legal upgrade capped by a depth tier. Premium enchanted item: bonus scales with depth tier (+1 shallow … +3 deep). Rolled fresh on each visit (already per-visit today). With the flag off the existing `rng.shuffle(arms)` + d2 premium pick run exactly as today, in the same order.
- Depth tiers: reuse the floor bands already in `content/` (the `BAG_FLOORS` 2/5/9 pattern in `content/bags.js` / the treasure-table tiers) rather than inventing a new table.
- Feedback: the store header line names the roll in the sarcastic voice ("Stock changes daily. So do the prices, allegedly." or similar; family-friendly; voice safety scan); no toast, no Oracle line (the store is a screen, not an event).
- Tests: draw-count pins (flag off = today's draw count; flag on = N extra), band tests per depth, parity suite untouched, `test/parity/prototype-master.js.txt` never edited; the store parity fixtures (any fixture that opens the store) replay byte-identical.

### Claude's Discretion
- Exact band boundaries and the potion-by-depth weighting, as long as the tiers come from the existing content bands.
- Whether the tutorial setting replaces `TUTORIAL_SEEN_KEY` or wraps it.
- CSS for the gear row and the Marks/Centre row; the ~3 s confirm revert timer is a `setTimeout` (not a CSS transition).
- The store header copy.

### Deferred Ideas (OUT OF SCOPE)
- Haptics on hit/kill and guarding the store/spell-menu buttons (32-03 hand-off) → a future feel pass.
- Store pricing/haggle rebalance → not this milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UIF-01 | Gear panel Use/Drop side by side, Drop far right, confirm before drop | `renderCarriedList` (mazeworld.html L3533-3600) mapped line-by-line; the COLUMN-flex `<li>` layout bug that blocks "side by side" is identified (`ul.skills li{flex-direction:column}`, CSS L225); the GEAR call site (L3095, unguarded) vs. the two guarded call sites (loot L5092, combat-use L5373) and the untouched store sell call site (L5236) are distinguished |
| UIF-02 | Map recenters on return from any full-screen panel | `hasActiveEncounter()` (L4776-4792), `renderEncounter()`'s true→false transition stamp (L4971, the existing Phase-32 hook point), `showTab()` (L1626-1655, the ONLY tab-switch chokepoint), and `closeSettingsSheet()` (L5972-5978) are all identified as the THREE distinct call sites a single "map visible again" concept actually requires — CONTEXT's "ONE hook" language does not match the code's actual structure (see Pitfall 3) |
| UIF-03 | Default zoom = ZOOM midpoint | `let zoom = 1` / `ZOOM_MIN 0.6` / `ZOOM_MAX 2.4` (L2460-2462) located exactly; midpoint math confirmed `(0.6+2.4)/2 = 1.5`, matching CONTEXT's locked value |
| UIF-04 | Tutorial on/off setting | `src/browser/tutorial.js` (sequencer + `TUTORIAL_SEEN_KEY`) confirmed **fully unwired** — zero references anywhere in `mazeworld.html` (see Pitfall 1, a MAJOR finding); `src/browser/settings.js`'s generic settings-row pattern (SETTINGS_DEFAULTS/ALLOWED_VALUES/the delegated click handler at L6017-6034) is the exact mechanism a new `tutorial` field plugs into with zero new plumbing |
| UIF-05 | Make Camp into Marks/Centre row, handedness removed, D-pad centered | `.mw-viewport-chips` (L1362-1365, CSS L311-312) identified as the actual "Marks/Centre row"; every `data-handedness` reference enumerated (7 in mazeworld.html, 3 in settings.js, several in settings.test.js) for full removal; `.mazefoot` flex CSS (L370, L387-388) and `#btn-camp` (L1374, L5518-5519, L6891) mapped |
| STORE-01 | Depth-appropriate randomly-rolled store stock, parity-guarded | `engine/economy.js#openStore`'s full rng draw order captured verbatim; the `dev`-boolean precedent (`engine/state.js` L200, `engine/saveState.js` L216/272, `comparables.js` L264/341/730) proven to be the exact template for a new `storeRoll` flag; the ONE fixture that opens the store (`action-script.economy.json`, seed 3, depth 1) confirmed; `rollBlade`'s unused `depth` parameter (a pre-existing dead parameter) flagged as a trap |
</phase_requirements>

## Summary

This phase is two unrelated bodies of work sharing one phase: (1) an engine rng-guard change to `openStore` (STORE-01), following the exact `bagUpgradeTier` precedent Phase 29 established, and (2) five shell-only layout/state-machine changes (UIF-01..05) against `mazeworld.html`'s classic script. Both are low-risk from a parity standpoint — STORE-01's guard is provably safe by the same mechanism `dev`/`pendingLoot` already use, and only ONE parity fixture (`action-script.economy.json`, seed 3) ever opens a store, always at floor depth 1 where the CONTEXT-specified guard is inert. `npm test` is green at **1902/1902** this session, matching the Phase 32 baseline exactly — no drift to account for.

The single most important finding is **UIF-04's premise is stale**: CONTEXT.md's language ("today's `mazeworld.tutorialSeen` flag becomes the inverse of...") describes a live coach-mark dismiss flow that does not exist. `src/browser/tutorial.js` (the sequencer + `TUTORIAL_SEEN_KEY` persistence) is a complete, tested, **but entirely unwired** module — grep confirms zero references to `tutorial`/`TutorialSeen`/`CoachMark` anywhere in `mazeworld.html`. `.planning/REQUIREMENTS.md` itself states the first-run tutorial (UX-06) is "deliberately last... None of these get a v1.3 phase." So UIF-04 in this phase can only mean: add the persisted Settings toggle (plumbing for a FUTURE tutorial launch to read), not wire up any observable dismiss/restart behavior today — there is nothing live to dismiss or restart yet.

The second major finding concerns **UIF-02's "ONE hook."** The shell has no single function that fires on "any full-screen panel closing." There are three independent choke points: `renderEncounter()`'s `encWasActive && !active` transition (L4971, already exists from Phase 32 — covers Store/beats/death/joiner/find/loot), `showTab()` (L1626, the sole tab-switch function — covers Hero/Gear/Oracle/Dead tabs returning to Map), and `closeSettingsSheet()` (L5972, two callers — covers the Settings sheet). All three need the recenter call; there is no way to satisfy CONTEXT's "ONE hook" literally without also being incomplete.

The third finding is a **CSS layout bug that blocks UIF-01 as specified**: `renderCarriedList`'s rows are `<li>` elements styled `ul.skills li{display:flex;flex-direction:column}` (CSS L225) — every button appended by `mkBtn` stacks vertically underneath the item name, not side-by-side. "Use immediately left of Drop, Drop pinned far right" requires wrapping the row's action buttons in a new row-flex container, not just reordering the `opts.actions` array.

**Primary recommendation:** treat STORE-01 as a low-risk, well-precedented engine plan (mirror `bagUpgradeTier`/`dev` exactly); treat UIF-01/02/04/05 as shell-only plans that need a genuine markup/CSS restructure (not just JS wiring) for the gear row, and three wired call sites (not one) for the recenter hook; treat UIF-04 as "ship the toggle, defer the tutorial" and say so explicitly in the plan so the acceptance criteria don't imply behavior that cannot exist yet.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Store stock roll (depth bands, guarded rng) | Engine (`engine/economy.js#openStore`, `engine/state.js#newRun`) | Content data (`content/bags.js`-style new band table) | Pure rng/data logic; must stay parity-safe and serializable, same tier as Phase 29's `bagUpgradeTier` |
| Store-roll run flag persistence | Engine (`engine/state.js`, `engine/saveState.js`) | — | A plain top-level boolean, same tier and same tolerant-read pattern as `dev` |
| Gear row Use/Drop layout + two-tap confirm | Shell (`mazeworld.html#renderCarriedList`) | Presentation CSS | DOM-only interaction state (the "confirming" row), never engine state — mirrors `guardTap`'s Date.now()-based, DOM-local pattern from Phase 32 |
| Map recenter-on-panel-close | Shell (`mazeworld.html`, three call sites: `renderEncounter`, `showTab`, `closeSettingsSheet`) | — | Pure viewport/camera state (`pan`/`zoom`), never touches `S.floor` |
| Default zoom constant | Shell (`mazeworld.html` module-scope `let zoom`) | — | A rendering-only camera value, not serialized, not engine state |
| Tutorial on/off setting | Shell (`src/browser/settings.js` + `mazeworld.html` Settings sheet markup) | `src/browser/tutorial.js` (dormant, unwired) | The toggle is UX/Preferences state; the sequencer it will eventually gate is a separate, already-built-but-unused module in the same tier |
| Make Camp / handedness removal | Shell (`mazeworld.html` markup + CSS, `src/browser/settings.js`) | — | Pure layout/preference-schema change, no engine surface |

## Standard Stack

No external libraries apply — this phase is 100% first-party engine/shell code, continuing the project's zero-runtime-dependency posture (`.claude/CLAUDE.md`'s explicit "no ad/analytics/monetization SDK, ship with zero third-party SDKs" rule extends to the whole game logic surface, confirmed by every touched file importing only sibling `engine/`/`content/`/`src/browser/` modules). No `npm install`, no new dependencies.

## Package Legitimacy Audit

**N/A — this phase introduces zero external packages.** All new/changed code lives in `engine/economy.js`, `engine/state.js`, `engine/saveState.js`, `content/*.js`, `mazeworld.html`, and `src/browser/{settings,tutorial}.js` — the project's existing first-party surface. `[VERIFIED: direct code read]`.

## Project Constraints (from CLAUDE.md)

- **Platform/offline/monetization**: Android-only via Capacitor, no network, no ads/IAP, zero third-party SDKs — this phase touches no packaging, native plugin, or store-submission surface; fully compliant by construction (no new dependency of any kind).
- **Fidelity**: "The prototype's rules are canon; deviations must be deliberate design decisions, not accidental regressions." STORE-01's guarded rng change is a deliberate, CONTEXT-approved divergence (parity-safe by construction, per the `bagUpgradeTier` precedent) — not an accidental one. Every new draw must sit AFTER the frozen prototype's existing draws, exactly like Phase 29.
- **Rules engine decoupled from UI, fully serializable**: STORE-01's new `storeRoll`/content additions must stay pure-data/no-DOM in `engine/`/`content/` (mirrors `test/determinism/content-is-pure-data.test.js`'s existing enforcement — no closures in any new content table).
- **Tone & voice**: heavy sarcasm, dark humor, family-friendly, no profanity/gore/adult content. The new store header copy and any tutorial-setting label must pass `test/voice/safety-scan.test.js` (the project's existing wordlist scanner, confirmed present and green this session — 1897/1897 of its own subtests pass as part of the 1902 total).
- **GSD workflow enforcement**: this research and the phase's plans must be produced through the GSD pipeline (already in progress) — noted for completeness, not actionable by this research agent.

## Standard Stack (STORE-01 content reuse — no new tables needed)

| Data source | File | Fields available for band logic |
|---|---|---|
| `BAG_FLOORS` | `content/bags.js` L38 | `{ medium: 2, large: 5, exlarge: 9 }` — the exact reusable floor-band knob CONTEXT points to |
| `WEAPONS` | `content/weapons.js` L14-40 | `cost` (25-900), `cls` (F/T/M letters), keyed by name — usable for a cost-band filter |
| `ARMORS` | `content/armors.js` L8-14 | `cost` (300-2000), `ar`, `wp`, `cls`, `min` — 5 fixed tiers, naturally ordered by `cost`/`ar` |
| `POTIONS` | `content/potions.js` L7-16 | `price` (50-800), `eff`, `txt` — 10 entries; **NOTE**: entry index 8 is `"Death"` (`eff:"death"`, price 50) and is never offered by today's store (`openStore` only ever adds `POTIONS[0,3,4,2]` = Healing/Xtra Healing/Strength/Speed, L248) — see Pitfall 5 |
| `TREASURE_BASE_VALUES` | `engine/economy.js` L62-90 | Per-name sell-value table for jewelry/cloaks/staves — not directly needed for STORE-01 (weapons/armor/potions only per CONTEXT) but documents the existing "value by depth-independent name" idiom |

## Engine Deep Dive: `engine/economy.js#openStore` (STORE-01)

### Exact rng draw order today (flag-off path CONTEXT requires byte-identical)

`openStore(state, rng, events)` (`engine/economy.js` L238-323) draws rng in this exact order, and nothing else:

1. `rng.shuffle(arms)` (L261) — shuffles the full class-legal weapon-name array (`Object.keys(WEAPONS).filter(cls letter)`), then `arms.slice(0, 2)` (L262) picks the first two, **no further rng**.
2. `rng.d(2)` (L291) — `premium = rng.d(2) === 1 ? rollBlade(rng, d, true) : rollMailPiece(rng)`.
3. Inside `rollBlade` (`engine/items.js` L120-131) when picked: `rng.pick(Object.keys(WEAPONS))` (1 draw) then `rollDice(rng, WEAPON_BONUS_TABLE[rng.d(6)-1])` (2 more draws: the d6 table index, then the bonus dice roll) = 3 draws total.
4. Inside `rollMailPiece` (`engine/items.js` L134-147) when picked: `rng.pick(ARMORS)` (1 draw) + `rng.d(6)` for `MAGIC_ARMOR_TABLE` index (1 draw) = 2 draws total.

Everything else in `openStore` — food (L247), potions (L248-249, fixed indices `POTIONS[0,3,4,2]`), lockpicks (L250-251), armor repair (L253-258), the class-legal armor upgrade (L276-286, `mails[0]`, no rng — filtered+sorted, first element taken), the Magic User scroll (L288), Rations (L306), and the haggle multiplier (L308-309) — consumes **zero rng**. `add()` itself (L244-245) is pure. This means the CURRENT store is **not depth-scaled at all** except cosmetically: `rollBlade(rng, d, true)`'s second parameter (`depth`) is passed but **never read inside `rollBlade`** (`engine/items.js` L120-131 has no reference to its own `depth` arg) — a **pre-existing dead parameter**, not a bug this phase introduces, but worth flagging so the planner doesn't assume depth-scaling already exists anywhere in the store.

### The `dev`-boolean precedent — the exact template for `storeRoll`

`engine/state.js#newRun` (L137-217) already carries a plain top-level boolean set unconditionally on every fresh state and read tolerantly on load — this is a byte-for-byte template for the new flag:

```js
// engine/state.js L194-200 (existing precedent)
// Phase 21 (TUNE-04, D-13/D-14): dev — true only for a start-at-depth run;
// a plain boolean present on EVERY fresh state exactly like dead/won
// above (so serializeRun/validateSave/rehydrate round-trip it and the
// fresh-run round-trip test stays deepStrictEqual). The parity harness
// strips it in all three comparables. A dev run is never written to the
// graveyard or the best-depth record (src/browser/engineAdapter.js).
dev: startAt > 1,
```

- `engine/saveState.js` L216 (`validateSave`) and L272 (`rehydrate`): `dev: !!obj.dev` — tolerant boolean coercion, a save missing the field defaults to `false`.
- `test/parity/harness/comparables.js` L264, L341, L730: all three `*Comparable()` functions destructure `dev` out of `rest` at the top (`const { ..., dev, ...state0 } = state;`) — a one-line addition per comparable is the whole carve-out; **no reconciliation function needed** (unlike `pendingFind`/`pendingLoot`, which get *reconciled*, `dev` is simply *dropped* since it has no in-state side effect to replay).

**A new `state.storeRoll` boolean should follow `dev` exactly, not `pendingLoot`**: it is a plain flag with no downstream state to reconcile (the store's stock array is transient — `store: null` on `rehydrate`, L257 area — so there is nothing to replay across load, only the flag that gates the NEXT `openStore` call). `newRun` should set `storeRoll: true` unconditionally (mirroring `dev: startAt > 1`'s unconditional-per-fresh-state placement at L200), `validateSave`/`rehydrate` should add `storeRoll: !!obj.storeRoll` beside the existing `dev: !!obj.dev` lines, and `comparables.js` should add `storeRoll` to the same three destructure lines that already carry `dev`.

### Does the harness compare whole state or a projection? (CONTEXT explicitly asks)

**A projection.** Every one of the three `*Comparable()` functions (`movementComparable`, `combatComparable`, `economyComparable` — `test/parity/harness/comparables.js`) starts by destructuring OUT a fixed list of top-level keys (`beats, seed, rngState, version, party, pendingJoiner, pendingFind, pendingLoot, dev, ...`) and comparing only `state0`/`rest` — the remainder. Adding `storeRoll` to that destructure list is the entire carve-out; **no other change to comparables.js is needed**. `[VERIFIED: direct code read]`.

### Which parity fixtures open the store, and at what depth

Confirmed by grep across `test/parity/fixtures/*.json` (only file matching `openStore`/`"store"`): **exactly one fixture**, `test/parity/fixtures/action-script.economy.json`, seed 3, a Human Pickpocket — action 0 is `{"type":"openStore"}` fired immediately after `newRun(3)`, i.e. at the DEFAULT `startDepth: 1`. No other fixture family (`combat`, `magic`, `movement`, `encounters`, `chargen`) ever calls `openStore`. `test/unit/economy.test.js` L264 ("seed 3 (a Human Pickpocket): store roll pins...") independently pins this exact same seed/depth-1 stock roll at the unit level.

**Conclusion**: since every fixture calls `newRun(seed)` with no options (`startAt === 1` always, per Phase 29's own established finding that no combat/economy/magic fixture ever reaches depth ≥ 2), and `storeRoll: true` would be set unconditionally by `newRun` for a NEW run but a *fixture's comparable-side replay never re-runs `newRun`* — it replays a captured `state` whose `storeRoll` field the master/comparables carve-out already strips — **the flag's value never matters for parity at all**, exactly like `dev`. The planner does NOT need CONTEXT's proposed `floor.depth >= N` fallback gate; a plain "does this state have `storeRoll: true`" check in `openStore` itself is sufficient and, per this research, provably fixture-safe (the field is simply absent — `undefined`/falsy — on every fixture state, since fixtures are hand-authored JSON snapshots, not fresh `newRun()` calls, and `economy-parity.test.js`'s own harness calls `openStore` directly on a loaded fixture state, never through `newRun`).

### Existing draw-count test pattern to follow

`test/unit/bag-cap-gate.test.js` (Phase 29's `bagUpgradeTier` pin, L272-284) is the exact style to mirror: a bare state-shape literal (not `newRun`), asserting the pure predicate's return value across every boundary (`floor.depth` at/under/over each tier's floor, with/without an existing upgrade, missing fields defaulting safely). For the rng draw-count itself, `test/unit/economy.test.js`'s `fixedState()`/`makeRng(N)` pattern (L1-60-ish, confirmed via the seed-3 stock-pin tests at L258-294) is the right harness: call `openStore` with `storeRoll` false vs. true on the same seed and assert `state.store.stock.length` and the `rngState` cursor differ by the expected draw count.

## Architecture Patterns

### System Architecture Diagram

```
newRun(seed, exclude, opts)                         engine/state.js
   │
   └─ state.storeRoll = true   (NEW — unconditional on every fresh
        state, same placement class as `dev: startAt > 1`, L200)
        A LOADED/fixture state has NO such field → falsy → flag-off path.

openStore(state, rng, events)                        engine/economy.js
   │
   ├─ existing draws UNCHANGED, same order:
   │      rng.shuffle(arms) → arms.slice(0,2)              (weapons)
   │      rng.d(2) → rollBlade|rollMailPiece                (premium)
   │
   ├─ IF state.storeRoll === true (NEW branch, placed AFTER
   │  every existing draw so nothing upstream shifts):
   │      potions: keep Heal fixed + draw 3 more from POTIONS
   │               filtered to a depth-appropriate subset
   │               (excluding the "Death" trap entry, see Pitfall 5)
   │      weapons: replace the fixed arms.slice(0,2) selection
   │               with a depth-cost-band-filtered pool, same
   │               rng.shuffle mechanism
   │      armor:   same "best class-legal upgrade" rule, capped
   │               to a depth tier ceiling instead of unlimited
   │      premium: same rng.d(2)/rollBlade/rollMailPiece draw,
   │               but its BONUS ceiling now depth-scaled
   │  ELSE: no new draws — byte-identical to today
   │
   ▼
state.store = { stock, haggle, race }        (still 100% plain data,
   storeOpened event                          still serializes fine)

SHELL (mazeworld.html renderEncounter's S.store branch, L5199-5243):
   header line reads S.storeRoll to show/hide the
   "Stock changes daily..." copy — cosmetic only, no engine coupling
```

### Recommended Project Structure (files touched, no new directories)

```
engine/
├── state.js           # newRun: state.storeRoll = true (unconditional)
├── saveState.js        # validateSave/rehydrate: storeRoll: !!obj.storeRoll (tolerant default false), beside the existing `dev` lines
└── economy.js          # openStore: the ONE new guarded branch, placed after every existing draw

content/
└── bags.js (or a new content/store-bands.js) — depth-tier cost bands for
    weapons/armor/potions, reusing BAG_FLOORS' 2/5/9 shape; pure data,
    no closures (test/determinism/content-is-pure-data.test.js enforces this)

test/
├── parity/harness/comparables.js   # add `storeRoll` to the 3 destructure lines beside `dev` (no reconcile fn needed)
├── unit/economy.test.js (or a new store-roll test file)  # draw-count pins (flag off = today's count; flag on = N extra), band tests per depth
└── voice/safety-scan.test.js       # new store header copy must pass

mazeworld.html
├── the store's S.store branch (L5199-5243) — header copy gated on S.storeRoll
├── renderCarriedList (L3533-3600) — UIF-01's row restructure
├── .mw-viewport-chips / #btn-camp / .mazefoot (L1362-1384, CSS L311-388) — UIF-05
├── showTab / closeSettingsSheet / renderEncounter's dismiss transition — UIF-02's 3 hook sites
├── let zoom = 1 (L2460) → 1.5 — UIF-03
└── #mw-settings-sheet rows (L1232-1286) — UIF-04's new row, handedness row removed

src/browser/
└── settings.js          # SETTINGS_DEFAULTS/ALLOWED_VALUES: add `tutorial` (default true), remove `handedness`
```

### Pattern 1: Guarded rng draw behind a run-level flag (the `bagUpgradeTier`/`dev` template)

**What:** A new rng-consuming branch is gated on a plain top-level state boolean that (a) `newRun` sets unconditionally for every fresh run, (b) `validateSave`/`rehydrate` tolerantly default to `false` for any save/fixture predating the field, and (c) sits structurally AFTER every pre-existing draw in the function so the old draws' consumption order/count never changes.

**When to use:** STORE-01's new potion/weapon/armor/premium draws.

**Example (Source: `engine/combat.js` L679, Phase 29's `bagUpgradeTier` gate, the closest prior art to STORE-01's guard):**
```js
// killFoe's existing precedent — the exact shape STORE-01's guard should mirror
const tier = bagUpgradeTier(state);
if (tier && rng.d(20) <= BAG_DROP_UNDER) drop = bagItemFor(tier);
```
STORE-01's guard is simpler than `bagUpgradeTier` (no "already carrying/already pending" exclusion logic needed) — it is closer to `dev`'s shape: `if (state.storeRoll) { /* new draws */ }`.

### Pattern 2: Settings row plumbing (generic, zero new wiring needed for UIF-04)

**What:** Every settings row is declared once in HTML (`<div class="mw-settings-row">` + `.mw-settings-options[data-setting]` + `.mw-settings-opt[data-value]` buttons) and consumed by ONE delegated click handler (`mazeworld.html` L6017-6034) that reads `data-setting`/`data-value`, calls `writeSetting(key, value)`, then `applySettings(next)` + `renderSettingsSheet()`. Adding a boolean field requires zero new JS wiring beyond `settings.js`'s `SETTINGS_DEFAULTS`/`ALLOWED_VALUES` and the HTML row — the exact pattern Sound/Haptics/Confirm-before-quit already use.

**Example (Source: `mazeworld.html` L1262-1268, the Haptics row — the direct template for a new Tutorial row):**
```html
<div class="mw-settings-row">
  <span class="mw-settings-label">Haptics</span>
  <div class="mw-settings-options" data-setting="haptics">
    <button type="button" class="mw-settings-opt" data-value="true">On</button>
    <button type="button" class="mw-settings-opt" data-value="false">Off</button>
  </div>
</div>
```

### Pattern 3: The three distinct "map visible again" hook sites (UIF-02)

**What:** There is no single existing function that fires whenever ANY full-screen panel closes. The three independent sites, all already existing:

1. `renderEncounter()`'s dismissal-transition stamp (`mazeworld.html` L4971 — `if (encWasActive && !active) lastDismissAt = Date.now();`, added by Phase 32/CMBUI-05) — covers Store, death card, beats/"Move on" cards, joiner, find, and loot pile all closing (every case `hasActiveEncounter()` L4776-4792 covers).
2. `showTab(name)` (`mazeworld.html` L1626-1655) — the ONE function every tab click routes through (L1654: `tabs.forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tab)))`); recenter should fire when `name === "maze"` — covers Hero/Gear/Oracle/Dead(Graveyard) tabs returning to Map.
3. `closeSettingsSheet()` (`mazeworld.html` L5972-5978, 2 callers: the scrim tap L5977, the Close button L5978) — covers the Settings sheet, which is reachable from ANY tab (not part of the tab system or `hasActiveEncounter()`).

**When to use:** UIF-02's recenter hook must be wired at all three sites; `window.mzCenterMap()` (the bridged `centerMap()`, L5602-5615) is the existing function to call — already proven safe to call unconditionally (it no-ops visually if the map isn't the visible tab, and is already called unconditionally today from the `textSize` settings-change handler, L6032).

### Anti-Patterns to Avoid

- **Calling `centerMap()` on every pinch `pointermove` tick.** The live pinch handler (`mazeworld.html` L5653-5665) calls `fit(); positionCanvas();` on every move event while a 2-finger gesture is active; resetting `pan={0,0}` there would fight the user's live gesture. CONTEXT's "recenter after any zoom change" should be read as "after the zoom-changing gesture/action settles" (pinch release, or a settings-driven `textSize` change) — see Pitfall 4.
- **Treating `renderCarriedList`'s `<li>` as already row-flex.** `ul.skills li{display:flex;flex-direction:column}` (CSS L225) stacks children vertically; simply reordering `mkBtn` calls in the `opts.actions` array will NOT produce a side-by-side "[Use] [Drop]" row — see Pitfall 2.
- **Assuming `src/browser/tutorial.js` is reachable from the shell today.** It is a complete, independently tested module with zero call sites in `mazeworld.html` — see Pitfall 1.
- **Restating the `arms.slice(0,2)`/premium-pick mechanism from scratch for the depth-banded version.** `rng.shuffle` + `.slice(0, N)` and the existing `rng.d(2)` premium branch are the correct primitives to reuse with a pre-filtered candidate pool (filter-then-shuffle, not shuffle-then-filter, to keep the draw COUNT predictable per CONTEXT's "N extra" draw-count test requirement).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this a depth-appropriate item" gate | A new bespoke depth-threshold table | `BAG_FLOORS`'s exact `{tier: floor}` shape (`content/bags.js` L38), reused with weapon/armor/potion tier names instead of bag tiers | CONTEXT explicitly requires reusing an EXISTING band pattern, not inventing a new one; `BAG_FLOORS` is the only depth-band table in the codebase today |
| Weapon/armor "is this legal for my class" filter | A new class-letter predicate | The existing `WEAPONS[w].cls.includes(letter)` / `canEquipArmor(c, a)` filters already used at `openStore` L260/L276 | Same rule already governs today's store roll; duplicating it risks drift between the flag-off and flag-on paths |
| Settings persistence / validation | A parallel storage key or ad-hoc localStorage read for the tutorial flag | `src/browser/settings.js`'s existing `SETTINGS_DEFAULTS`/`ALLOWED_VALUES`/`readSettings`/`writeSetting` (one versioned JSON blob, `ddr.settings.v1`) | CONTEXT explicitly says "stored with the other settings (Preferences-backed via settings.js/storage.js)" — a second key would fragment the one source of truth this module already guarantees |
| Tap-safety / guard timing for the drop confirm | A new Date.now()-based arm/settle mechanism copied from Phase 32's `guardTap` | Nothing — CONTEXT explicitly says the Drop confirm is NOT an encounter button and is NOT guarded (`opts.guard` stays false at the GEAR call site, L3095) | Phase 32's guard system is scoped to the ratified §6.3 encounter-decision list; the Drop confirm is an ordinary Gear-tab row action, ungated by design |

**Key insight:** every "don't hand-roll" item above already has exactly one canonical implementation in this codebase from a prior phase (Phase 29's depth-band shape, Phase 24's class-legality filters, 04-DR9's settings module, Phase 32's guard scope boundary). Phase 33's job, like Phase 29's before it, is almost entirely "reuse the existing rule, change WHERE/WHEN it applies" — very little genuinely new mechanism is needed.

## Common Pitfalls

### Pitfall 1: UIF-04's tutorial toggle has no live tutorial to toggle

**What goes wrong:** A plan written against CONTEXT.md's literal language ("the tutorial's own 'Got it'/dismiss sets it off... re-enabling... restarts the tutorial from step 1 the next time the map is shown") would try to wire a coach-mark dismiss/restart flow that has no rendering counterpart in `mazeworld.html` at all.

**Why it happens:** `src/browser/tutorial.js` (the sequencer, `COACH_MARK_STEPS`, `getTutorialSeen`/`setTutorialSeen`) was built and fully unit-tested in the archived Phase 4 slice (`test/unit/tutorial.test.js`, 04-03-PLAN.md), but its consumer (04-10, the actual spotlight overlay + "Got it" button) was explicitly deferred — confirmed by `.planning/REQUIREMENTS.md` L82/103 ("UX-06 first-run tutorial — deliberately last... None of these get a v1.3 phase") and `.planning/ROADMAP.md` L266 ("Build LAST, once the UI settles — after v1.3's CMBUI rebuild"). Grepping `mazeworld.html` for `tutorial|TutorialSeen|CoachMark|onboard|spotlight` returns zero matches — the module is dead code today, imported by nothing.

**How to avoid:** Scope UIF-04 to exactly what REQUIREMENTS.md's own success criterion says: "A tutorial on/off setting exists — it can be dismissed once and re-enabled later from Settings." Implement this as: (a) a new `tutorial` boolean field in `settings.js` (default `true`), (b) a new Settings row that reads/writes it through the existing generic mechanism, (c) tests asserting the setting round-trips and defaults correctly (mirroring `test/unit/settings.test.js`'s existing per-field pattern). "Dismissed once" in this phase means "the player can toggle it off from Settings" — there is no first-launch auto-show event to dismiss, because there is no first-launch tutorial UI. Document this explicitly in the plan so the acceptance criteria don't imply a coach-mark interaction that cannot exist until a future 04-10-equivalent phase ships. If the planner wants the setting to actually gate something today, the ONLY safe hook is: have `getTutorialSeen()`/`setTutorialSeen()` (already built, already tested) become the read/write backing for this NEW settings field (CONTEXT's own "becomes the inverse of / is folded into" suggestion) — this at least makes the plumbing forward-compatible with 04-10 without inventing new UI now.

**Warning signs:** A plan task that says "wire the Settings toggle to restart the coach-mark sequence" with no corresponding DOM/overlay task — that DOM doesn't exist and would silently expand this phase's scope into rebuilding 04-10 early, against the milestone's own explicit deferral.

### Pitfall 2: `renderCarriedList`'s rows are column-flex, not row-flex — "side by side" needs a markup change, not just reordering

**What goes wrong:** UIF-01 asks for `[name · detail] … [Use] [Drop]` with Drop "pinned far right." Simply changing `opts.actions: ["use", "drop"]`'s array order (already alphabetically Use-then-Drop today at the GEAR call site, `mazeworld.html` L3097: `actions: ["use", "equip", "drop"]`) would NOT produce a side-by-side row — `ul.skills li{display:flex;flex-direction:column;gap:1px}` (mazeworld.html CSS L225) stacks the `<b>` name, `<i>` sub, and every appended `<button>` as vertical siblings, each `alignSelf:flex-start` (`mkBtn`'s inline style, L3554).

**Why it happens:** `renderCarriedList` is shared by three hosts (GEAR tab, combat use-list, store sell-list) whose original designs never needed a two-button "far right" row — one button (Use or Sell) was always enough, so nobody noticed the column layout.

**How to avoid:** Wrap the row's action buttons in a new inline sub-container (e.g., a `<div class="mw-gear-actions">` appended once per row, with `display:flex; justify-content:space-between` or `gap` + `margin-left:auto` on the Drop button) inside `renderCarriedList`'s per-row loop (`mazeworld.html` L3562-3599), rather than appending buttons directly to `<li>`. This is a genuine markup/CSS change, not just a JS reorder — flag it explicitly as its own plan task, since the existing `shell-armor-display.test.js`/`shell-loot-screen.test.js`/`shell-input-guards.test.js` source-assertion tests all slice this exact function region (`renderCarriedListRegion()` helpers, e.g. `test/unit/shell-input-guards.test.js` L78-79) and will need their region-boundary assumptions re-verified (not necessarily broken, since they search for `function renderCarriedList(` / `function renderDropShelf(` as anchors, both of which persist) but SHOULD be re-run early to catch drift.

**Warning signs:** A device screenshot showing Use above Drop instead of beside it, or Drop not touching the row's right edge.

### Pitfall 3: There is no single "panel closed" hook — CONTEXT's "ONE hook" undercounts the actual call sites

**What goes wrong:** A plan that looks for one function to patch (matching CONTEXT's literal "ONE hook on the 'panel closed → map visible' path") will miss two of the three real sites and ship a map that only recenters after Store/beats/death/joiner/find/loot close, but NOT after returning from the Hero/Gear/Oracle/Dead tabs or closing Settings.

**Why it happens:** The shell has three independently-triggered "the player is looking at the map again" events, not one: `renderEncounter()`'s overlay dismissal (an `#enc-panel` `hidden` toggle layered ON TOP of the always-present `screen-maze`), `showTab()`'s tab switch (a DIFFERENT `.mw-screen[hidden]` toggle system entirely — `screen-hero`/`screen-gear`/`screen-oracle`/`screen-dead` vs. `screen-maze`), and `closeSettingsSheet()`'s sheet toggle (a THIRD, tab-independent overlay reachable from anywhere via the gear icon). None of these three share a common calling function today.

**How to avoid:** Wire `window.mzCenterMap()` (or a small wrapper) at all three sites (see Architecture Patterns, Pattern 3, above) rather than searching for a single non-existent choke point. This is safe: `centerMap()` is already called unconditionally today from an unrelated settings-change path (L6032) with no ill effect when the map tab isn't visible.

**Warning signs:** A DR-round tester reports "the map recenters after closing the store but NOT after checking my Hero sheet" or "...NOT after closing Settings."

### Pitfall 4: Recentering mid-pinch fights the user's own gesture

**What goes wrong:** If "recenter after any zoom change" (CONTEXT, UIF-02) is implemented by calling `centerMap()` (which resets `pan = {x:0,y:0}`) inside the pinch `pointermove` handler (`mazeworld.html` L5653-5665, which already calls `fit(); positionCanvas();` on every pinch tick), the map would snap back to center on every frame of a 2-finger zoom gesture, making pinch-to-zoom feel broken (the user's finger-relative framing is destroyed every ~16ms).

**Why it happens:** `zoom` changing does NOT itself move `pan` — the drift CONTEXT is worried about only compounds if the player had PREVIOUSLY dragged the map (`pan !== {0,0}`) and then pinch-zooms, since `positionCanvas()`'s transform (`tx = rect.width/2 - (px+0.5)*CELL - CANVAS_PAD + pan.x`, L2499) scales `CELL` with zoom while `pan.x` stays a fixed pixel offset — so a panned-then-zoomed view drifts proportionally to how far the player had panned.

**How to avoid:** Reset `pan` (call `centerMap()`/`mzCenterMap()`) in the pinch gesture's `release()` handler (`mazeworld.html` L5666-5675, when `pinch` was non-null before this release — i.e., a 2-finger gesture just ended), NOT inside `pointermove`. For the `textSize` settings-driven zoom-equivalent (cell-size change, not the `zoom` variable itself, but the same drift risk), the existing L6032 call (`window.mzCenterMap()` after `window.fit()`) is already correct and can be used as the template.

**Warning signs:** The map visibly "jumps" to center mid-pinch instead of scaling smoothly around the gesture.

### Pitfall 5: A naive "3 more potions from the table" draw could roll the unused "Death" entry

**What goes wrong:** `POTIONS` (`content/potions.js` L7-16) has 10 entries; today's store deliberately offers only 4 by fixed index (`POTIONS[0,3,4,2]` = Healing/Xtra Healing/Strength/Speed, `openStore` L248). Entry index 8, `{n:"Death", eff:"death", price:50, txt:"your dead!"}`, is a joke/trap potion never offered by any existing store code. A depth-banded "draw N more from the potion table" implementation that indexes into the RAW `POTIONS` array without excluding this entry could accidentally make a lethal potion purchasable.

**Why it happens:** The fixed-index selection in today's `openStore` silently excludes it; a new "draw from the table" mechanism naturally iterates or `rng.pick`s the full array unless explicitly filtered.

**How to avoid:** Build the depth-banded potion pool from an explicit allow-list (the existing 4 plus whichever additional CONTEXT/planner-approved entries — e.g. Cure Poison, Cure Disease, Enlarge, Acuteness, Invisible are all safe/flavorful candidates), never from `POTIONS` unfiltered. Document the exclusion in the new content/band table's comment, the way `content/bags.js`'s existing tables document their own tuning-knob status.

**Warning signs:** A unit test rolling many seeds at max depth surfaces a store stock line reading "Death potion."

## Runtime State Inventory

Not applicable — this is a feature/polish phase (new engine rng branch + shell layout changes), not a rename/refactor/migration phase. No runtime state (external services, OS registrations, secrets, stored-data keys) is renamed or migrated. The one persistence-shape change (`settings.js` gaining a `tutorial` field and losing `handedness`) is covered by the existing fail-open/tolerant-default posture already built into `readSettings()`/`writeSetting()` (an old persisted blob with a `handedness` key simply has that key ignored on read — `readSettings()` only pulls keys present in `SETTINGS_DEFAULTS`, L88-93 — no migration code needed, confirmed `[VERIFIED: direct code read]`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new store-roll flag should be named to mirror `dev` structurally (unconditional-on-fresh-state, tolerant-default-false on load, plain destructure-and-drop in comparables) rather than `pendingLoot`'s reconcile pattern, since there is no in-state array to replay across load | Engine Deep Dive | Low — CONTEXT explicitly leaves the exact field name to the planner; if the planner instead mirrors `pendingLoot`'s heavier reconcile pattern it still works, just does unneeded work |
| A2 | Store parity is safe without CONTEXT's proposed `state.features.bags`-style fallback flag, because fixture states never carry `storeRoll` regardless of depth (fixtures are hand-authored snapshots, not `newRun()` output) | Engine Deep Dive | Low — this research directly measured (grep) that only one fixture opens a store, at depth 1, confirming the simpler design is safe; if a future fixture opens a store past this phase's landing, the flag's absence on that fixture (unless someone hand-adds `"storeRoll": true` to its JSON) still keeps it parity-safe |
| A3 | "Recenter after any zoom change" should fire on pinch-release, not on every pinch pointermove tick | Common Pitfalls (Pitfall 4) | Medium — if the planner instead recenters every tick, pinch-to-zoom will feel broken on-device; this is a UX regression risk worth an explicit DR-round check |
| A4 | UIF-04 ships only the Settings toggle plumbing, with no live coach-mark UI change, per REQUIREMENTS.md's explicit "None of these get a v1.3 phase" for UX-06 | Common Pitfalls (Pitfall 1) | High if wrong — if the user actually wants a minimal coach-mark shown THIS phase, this assumption under-scopes UIF-04 significantly; recommend the planner surface this explicitly in the plan for confirmation before execution |

**If this table is empty:** N/A — four assumptions logged above; A4 is the one the planner should treat as needing explicit confirmation (raise as an open question / checkpoint before committing to the narrow scope).

## Open Questions

1. **Should UIF-04 do anything beyond persisting the toggle, given the tutorial UI itself is out of scope for v1.3?**
   - What we know: REQUIREMENTS.md explicitly defers UX-06 (the actual tutorial) past this milestone; `src/browser/tutorial.js` exists, is tested, but is wired to nothing.
   - What's unclear: whether "it can be dismissed once and re-enabled later from Settings" (the ROADMAP success criterion) is satisfied by a toggle alone, or whether the user expects SOME minimal first-launch behavior (even a single toast/line) to exist THIS phase for the toggle to meaningfully gate.
   - Recommendation: plan for the toggle-only scope (Pitfall 1's recommendation), but flag this explicitly as a discuss-phase/plan-review confirmation point rather than silently narrowing scope.

2. **Exact cost-band boundaries for STORE-01's weapon/armor bands.**
   - What we know: CONTEXT leaves exact boundaries to Claude's Discretion, "as long as the tiers come from the existing content bands" (i.e., `BAG_FLOORS`' 2/5/9 depth breakpoints).
   - What's unclear: whether weapon/armor COST bands should be derived from `WEAPONS`/`ARMORS`' own cost distributions (e.g., quartiles) aligned to the 2/5/9 depth breakpoints, or from a simpler fixed cost ceiling per depth tier.
   - Recommendation: sort `WEAPONS` by `cost` and `ARMORS` by `cost`/`ar`, then assign a ceiling per depth tier (shallow: cheapest ~40%, mid: ~70%, deep: 100%) — keeps the "deeper = pricier bands eligible" rule from CONTEXT while staying pure-data and easy to unit-test.

3. **Does the STORE-01 header copy need a `storeRoll`-off variant, or is it simply absent when the flag is off?**
   - What we know: CONTEXT says the header line "names the roll" — implying it's new copy specific to the flag-on path.
   - What's unclear: whether an old save (flag off) should show today's plain header unchanged (no roll-copy line at all) — which this research assumes, since flag-off is explicitly "byte-identical" in behavior, and the copy is cosmetic shell-only text with no parity implication either way.
   - Recommendation: gate the new header line on `S.storeRoll` truthy; omit it entirely (not a different line) when falsy, preserving the exact current header for old saves.

## Recommended Plan Split

Three plans, matching the three risk/tier clusters this research surfaced:

1. **Plan 01 — STORE-01 (engine + content + tests).** `engine/state.js` (`storeRoll` flag), `engine/saveState.js` (tolerant read), `content/*` (depth-band table, Death-potion-excluded pool), `engine/economy.js#openStore` (the guarded branch), `test/parity/harness/comparables.js` (3-line destructure addition), draw-count/band unit tests, `npm test` green, `test/parity/prototype-master.js.txt` untouched. No shell dependency — can run fully independently of Plans 02/03.
2. **Plan 02 — Gear row, toolbar, tutorial toggle (UIF-01, UIF-04, UIF-05).** `renderCarriedList`'s row-restructure + two-tap confirm (Pitfall 2's markup fix), the Marks/Centre row + Make Camp move + handedness removal (`mazeworld.html` + `settings.js`), the new Tutorial settings row (toggle-only scope, Pitfall 1). All shell-only; independent of Plan 01; touches `renderCarriedList`'s source-assertion test region shared with Plans from Phase 28/29/32 — re-run those early.
3. **Plan 03 — Map zoom/recenter + full gate + hand-off (UIF-02, UIF-03).** The three-site recenter wiring (Pattern 3), the `zoom = 1.5` default, pinch-release recenter (Pitfall 4), STORE-01's header-copy gate on `S.storeRoll` (small, shell-only, depends on Plan 01's flag existing), `npm run build:www`, full `npm test` gate, milestone hand-off SUMMARY with any deferred human-verification checklist (device pinch-zoom feel, Settings toggle round-trip, store-roll visual spot-check across depths).

Plan 01 has zero dependency on 02/03 and can run in parallel with either; Plan 03's header-copy touch is the only cross-plan dependency (needs Plan 01's `storeRoll` field name finalized first).

## Sources

### Primary (HIGH confidence — direct code read, this session)
- `engine/economy.js` (full file: `openStore` L238-323 rng order, `STORE_EFFECTS`/`STOWING_EFFECTS`/`buyFrom` L188-370, `TREASURE_BASE_VALUES`/`baseValueFor`/`sellPriceFor` L33-172)
- `engine/items.js` (`rollBlade`/`rollMailPiece`/`rollTreasureItem` L107-167 — confirmed `rollBlade`'s unused `depth` param; `weaponUpgradeDelta`/`armorUpgradeDelta`/`bagCap`/`canStow`/`stowItem` L256-410ish)
- `engine/state.js` (`newRun` full function L137-217 — the `dev`/`pendingLoot` field-placement precedent)
- `engine/saveState.js` (`validateSave` L157-224, `rehydrate` L226-280ish — the `dev: !!obj.dev` tolerant-default pattern at both sites)
- `test/parity/harness/comparables.js` (`reconcilePendingFind`/`reconcilePendingLoot` L28-76, `economyComparable` L710-733 and its sibling `movementComparable`/`combatComparable` destructure lines at L264/L341, `stockMarkupDiff` L636-668)
- `test/parity/fixtures/action-script.economy.json` (the ONE store-opening fixture, seed 3, action 0, depth 1 — grep-confirmed the only fixture referencing `openStore`)
- `content/bags.js` (full file — `BAG_ORDER`/`BAG_FLOORS`/`BAG_DROP_UNDER`/`BAG_ITEMS`, the depth-band template)
- `content/weapons.js`, `content/armors.js`, `content/potions.js` (full files — cost/price fields for band design; the unused "Death" potion entry at index 8)
- `content/index.js` (full file — barrel re-export confirmation)
- `mazeworld.html` (`renderCarriedList` L3533-3600; `renderDropShelf` L3608-3619; the S.store render branch L5199-5243; the dead classic `openStore()`/`buyFrom` L3622-3670 confirmed DEAD CODE via L3671/L6662-6663 comments and the live `window.mzBuyItem`/`window.mzLeaveStore` bridges at L6668-6675; `.mazefoot`/`.dpad`/`#btn-camp`/`data-handedness` CSS L363-486; `.mw-viewport-chips`/`.mw-chip` CSS L311-322; the Marks/Centre chip markup L1362-1365; `#btn-camp` markup L1374 and its two wiring sites L5518-5519/L6891; the Settings sheet markup L1232-1286; `initTabs`/`showTab` L1617-1655; `hasActiveEncounter` L4776-4792; `renderEncounter`'s dismissal-transition stamp L4961-4981; `centerMap`/`window.mzCenterMap` L5602-5615; the pinch/pan gesture pipeline L5631-5678; `zoom`/`ZOOM_MIN`/`ZOOM_MAX`/`clampZoom`/`fit`/`positionCanvas` L2450-2503; `applySettings`/`renderSettingsSheet`/the delegated settings click handler L5933-6034; `window.move`'s post-step recenter call L6349-6361)
- `src/browser/settings.js` (full file — `SETTINGS_DEFAULTS`/`ALLOWED_VALUES`/`readSettings`/`writeSetting`, the `handedness` field to remove)
- `src/browser/tutorial.js` (full file — confirmed complete but unwired: `TUTORIAL_SEEN_KEY`, `makeTutorialSequencer`, `getTutorialSeen`/`setTutorialSeen`, all only imported by `test/unit/tutorial.test.js`, never by `mazeworld.html`)
- `src/browser/storage.js` (header comment — the Preferences/localStorage backend-selection abstraction `settings.js`/`tutorial.js` both sit on)
- `test/unit/bag-cap-gate.test.js` (full file — the `bagUpgradeTier` draw-count/boundary pin pattern to mirror for STORE-01's band tests)
- `test/unit/economy.test.js` (`fixedState`/`makeRng` harness pattern L1-60; the seed-3 stock pin L258-294)
- `test/unit/settings.test.js` (the only file referencing `handedness` in `test/` — full handedness test block L57-138ish, confirmed needs removal/rewrite)
- `test/unit/tutorial.test.js` (full file — confirms `tutorial.js`'s existing, passing, unit-only test coverage)
- `test/unit/shell-input-guards.test.js`, `test/unit/shell-loot-screen.test.js`, `test/unit/shell-armor-display.test.js` (the `renderCarriedListRegion()` source-slicing helper pattern, each file's own copy)
- `.planning/phases/29-end-of-combat-loot-bag-cap/29-RESEARCH.md` (full file — the `bagUpgradeTier`/`dev`-analog carve-out precedent this phase's STORE-01 guard directly mirrors)
- `.planning/phases/29-end-of-combat-loot-bag-cap/29-01-PLAN.md` / `29-02-PLAN.md` / `29-02-SUMMARY.md` (grep confirmation of `bagUpgradeTier`'s exact final shape and its `killFoe` call-site wiring)
- `.planning/phases/32-combat-narrative-input-ui-build/32-03-SUMMARY.md` (full file — the CMBUI-04/05 guard-wiring precedent, the Phase 33 hand-off notes on the deliberately-unguarded button set and the final combat-surface vertical layout)
- `.planning/REQUIREMENTS.md` (full file — UIF-01..05/STORE-01 requirement text L55-63/137-142; the UX-06 "deliberately last... None of these get a v1.3 phase" deferral L82/103)
- `.planning/ROADMAP.md` (Phase 33 entry L246-260; the carried-forward tutorial table entry L266; Phase 32's hand-off summary line L242-244)
- `.planning/phases/33-ui-feel-store-polish/33-CONTEXT.md` (full file — every locked decision quoted verbatim above)
- `.planning/config.json` (confirmed `nyquist_validation: false`, `security_enforcement: false` — both optional RESEARCH.md sections correctly omitted)
- `npm test` run this session: **1902/1902 passing, 0 fail** — matches the Phase 32 baseline exactly (1882 + 18 `shell-input-guards.test.js` + 2 `round-card-worst-case.test.js`), confirming no drift before Phase 33 planning begins

### Secondary / Tertiary
None — no web search was performed per this phase's explicit "no web research — all answers are in the codebase" instruction; every claim above is grounded in this repository's own source, its test suite, or this session's live `npm test` run.

## Metadata

**Confidence breakdown:**
- STORE-01 engine design: HIGH — the exact rng draw order, the fixture roster (one fixture, depth 1), and the `dev`-boolean parity-carve-out template were all confirmed by direct code read, not inferred
- UIF-01/05 shell layout: HIGH for the markup/CSS locations; MEDIUM for the exact new CSS the planner will write (a genuine design decision, correctly left to Claude's Discretion per CONTEXT)
- UIF-02 recenter hooks: HIGH — all three call sites read directly; the "ONE hook" mismatch with CONTEXT's language is a measured finding, not a guess
- UIF-03 zoom default: HIGH — the constant and its exact location are pinned
- UIF-04 tutorial toggle: HIGH confidence that the underlying tutorial UI is unwired (grep-verified); MEDIUM on the correct scope interpretation (flagged as Open Question 1 / Assumption A4 for explicit confirmation)

**Research date:** 2026-09-16
**Valid until:** Until the next engine- or shell-touching phase lands (this codebase's shell/engine surface changes fast — treat as valid for Phase 33's planning/execution window only, ~7-14 days)
