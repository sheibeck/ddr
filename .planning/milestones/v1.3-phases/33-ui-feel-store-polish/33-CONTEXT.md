# Phase 33: UI Feel & Store Polish - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 3 grey areas proposed in batch tables; user accepted all

<domain>
## Phase Boundary

The remaining polish pass, done once against the finished combat UI (Phases 30–32): the gear panel's Use/Drop row with a drop confirm (UIF-01), map recenter on return from any full-screen panel (UIF-02) and a new default zoom (UIF-03), Make Camp into the Marks/Centre row with the handedness option removed and movement buttons centered (UIF-05), and depth-appropriate randomly rolled store stock behind a parity-safe feature guard (STORE-01). Last phase of milestone v1.3.

Out of scope: any combat-surface change (Phase 32 shipped it; the unguarded button set and haptics from the 32-03 hand-off are NOT pulled in unless trivially adjacent), store pricing/haggle rules, new items, tutorial content rewrites (UX-06 content stands; only the toggle is new).

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Gear panel, toolbar (UIF-01, UIF-05) — tutorial toggle dropped
- **Drop confirm (UIF-01)**: inline two-tap on the row — tapping Drop turns the button into "Drop it? [Yes] [No]"; reverts after ~3 s or on any other tap; NO modal card (card-vs-toast rule: a minor decision stays on the row). Drop applies to any bag item including potions; equipped slots keep going through the existing unequip path (no drop from a worn slot).
- **Gear row layout**: `[name · detail] … [Use] [Drop]` — Use immediately left of Drop, Drop pinned far right, both ≥ 48 dp min-height, `touch-action:manipulation`. The Store's own Sell/Drop rows (Phase 29) are unchanged.
- **Make Camp & handedness (UIF-05)**: Make Camp becomes the far-right button of the Marks/Centre row; the D-pad grid is centered with the CAMP column removed; the Handedness settings row, its `data-handedness` attribute and CSS rules (04-DR9/DR11) are deleted; a stored handedness preference is ignored (no migration UI, no error).
- **Tutorial toggle (UIF-04) — DROPPED from v1.3 (user decision 2026-09-16 after research)**: `src/browser/tutorial.js` is unwired in the shell (zero references in `mazeworld.html`) and UX-06 is parked past this milestone, so there is nothing to toggle. UIF-04 moves to the UX-06 backlog; Phase 33 ships UIF-01/02/03/05 + STORE-01 only. No Settings row, no `tutorial` boolean this phase.

### Area 2 — Map recenter & default zoom (UIF-02, UIF-03)
- **Default zoom = 1.5**, the literal midpoint of `ZOOM_MIN 0.6 … ZOOM_MAX 2.4` (user chose literal over the geometric 1.2).
- **Persistence**: pinch zoom persists for the session only; every cold start returns to the default; no zoom settings row.
- **Recenter hook (UIF-02)**: research found THREE "map visible again" choke points, not one — `renderEncounter()`'s dismissal transition (Store/beats/death/joiner/find/loot), `showTab()` (Hero/Gear/Oracle/Dead tabs) and `closeSettingsSheet()`; all three call the existing `window.mzCenterMap()`; pinch-zoom recenter fires on gesture RELEASE (never per pointermove tick), mirroring the textSize-change recenter.
- **Tests**: source-assertion pins on the constant and the hook; no engine change.

### Area 3 — Store stock roll (STORE-01) — the only engine/rng change this phase
- **Parity guard**: new rng draws happen ONLY when a run flag is set (working name `state.storeRoll === true`; the planner names it) that `newRun` sets on every NEW run from this version on; old saves and every parity fixture lack it → `openStore` is byte-identical for them; zero fixture edits; tolerant save read (`sanitize`/`validateSave` default the flag to false); the flag must be carved out of nothing — it is a plain boolean that fixtures never carry, so the comparables need no change (verify).
- **What rolls** (flag on): food/lockpicks/repair rows stay fixed. Potions: Heal always + 3 drawn from the potion table by depth. Weapons: 2 drawn from class-legal weapons within a depth cost band (deeper = pricier bands eligible). Armor: best class-legal upgrade capped by a depth tier. Premium enchanted item: bonus scales with depth tier (+1 shallow … +3 deep). Rolled fresh on each visit (already per-visit today). With the flag off the existing `rng.shuffle(arms)` + d2 premium pick run exactly as today, in the same order.
- **Depth tiers**: reuse the floor bands already in `content/` (the `BAG_FLOORS` 2/5/9 pattern in `content/bags.js` / the treasure-table tiers) rather than inventing a new table.
- **Feedback**: the store header line names the roll in the sarcastic voice ("Stock changes daily. So do the prices, allegedly." or similar; family-friendly; voice safety scan); no toast, no Oracle line (the store is a screen, not an event).
- **Tests**: draw-count pins (flag off = today's draw count; flag on = N extra), band tests per depth, parity suite untouched, `test/parity/prototype-master.js.txt` never edited; the store parity fixtures (any fixture that opens the store) replay byte-identical.

### Claude's Discretion
- Exact band boundaries and the potion-by-depth weighting, as long as the tiers come from the existing content bands.
- CSS for the gear row and the Marks/Centre row; the ~3 s confirm revert timer is a `setTimeout` (not a CSS transition).
- The store header copy.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/economy.js#openStore(state, rng, events)` — plain-data stock entries, `rng.shuffle(arms)` for two weapons, best armor upgrade, scroll, d2 premium pick, haggle last. `STOWING_EFFECTS` pre-pay gate (Phase 29).
- `engine/state.js#newRun(seed, exclude, { startDepth, force })` — where the run flag is set; `engine/saveState.js` `validateSave`/`rehydrate` + `sanitize*` helpers (Phase 29 `sanitizeLoot` precedent for tolerant reads).
- `content/bags.js` `BAG_FLOORS = { medium: 2, large: 5, exlarge: 9 }`; `content/treasure-tables.js` floor tiers; `content/potions.js`; `content/weapons`/`ARMORS`.
- `mazeworld.html`: `renderCarriedList` (Gear rows, `opts.guard` from Phase 32), the D-pad/CAMP grid CSS (~L365–375, `data-handedness`), `zoom`/`ZOOM_MIN`/`ZOOM_MAX`/`clampZoom` (~L2458–2462), auto-recenter (~L5609), panel open/close paths for Store/sheet/Oracle/Settings/Graveyard.
- `src/browser/settings.js` (settings model incl. the `handedness` field to remove), `src/browser/tutorial.js` (`TUTORIAL_SEEN_KEY`, `getTutorialSeen`, coach-mark sequencer), `src/browser/storage.js` (Preferences-backed store).
- Phase 32 guards: `guardTap` is for encounter surfaces only — the Gear panel's Drop confirm is NOT an encounter button and is not guarded.

### Established Patterns
- New rng only behind a guard fixtures never satisfy (Phase 29 `bagUpgradeTier` precedent); draw-count tests pin flag-off vs flag-on.
- Source-assertion tests for shell wiring; settings rows follow the existing `mw-settings-*` markup; voice safety scan for new copy.
- Executor gate: `npm test` `# fail 0`, `npm run build:www` exit 0, master fixture untouched, `git status --porcelain test/parity/` empty.

### Integration Points
- `newRun` → run flag → `openStore` branch → store screen header.
- Panel-close paths → one recenter hook → canvas `fit()`/viewport.

</code_context>

<specifics>
## Specific Ideas

- User feedback that drove these items (from `.planning/proposed-milestone-feedback-feel-polish.md` and the device rounds): Drop hidden/awkward in Gear; map lost the party after closing the store; default zoom too far out; tutorial could not be turned back on; Make Camp under the wrong thumb; store always sells the same things.

</specifics>

<deferred>
## Deferred Ideas

- Haptics on hit/kill and guarding the store/spell-menu buttons (32-03 hand-off) → a future feel pass.
- Store pricing/haggle rebalance → not this milestone.

</deferred>
