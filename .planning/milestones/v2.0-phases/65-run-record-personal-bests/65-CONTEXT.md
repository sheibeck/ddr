# Phase 65: Run Record & Personal Bests - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous v2.0 run). The user accepted every recommendation in all four areas.

<domain>
## Phase Boundary

Every death records its outcome durably, so every later v2.0 phase has real data to read:

- the run summary (`engine/death.js#buildRunSummary`) gains a season, the seed, an action count and an integrity hash;
- a new all-time, season-tagged personal-bests record (`ddr.bests.v1`) holds your top ten runs per ranked board plus LINEAGE aggregates, and it survives the graveyard trim;
- existing graveyards, the legacy keys and old saves load cleanly, and the record backfills from the stones already on the device;
- a new #1 on any board is announced, in voice, inside the THAT IS THAT death panel.

**Not in this phase:** the Leaderboards panel itself (Phase 66 renders these records), any network or PGS code (67/68), and the "you placed X" rank line (68).

</domain>

<decisions>
## Implementation Decisions

### Run summary fields (RUN-01)
- **D-01 — Season:** an integer `season` from one `SEASON` constant in `content/`. v2.0 ships **Season 1**. It is bumped by hand, with a one-line changelog comment, whenever a balance change moves the depth curve. There is no `rules` string and no tie to the app version.
- **D-02 — Action count:** a new GameState field `state.acts`, incremented once per **validated** action inside `engine/engine.js#applyAction` (after `validateAction` passes, whatever the handler then does). It adds no rng draws. It is carved out of all three `*Comparable()` functions in `test/parity/harness/comparables.js` and added to the `engine/saveState.js#validateSave` whitelist. An absent value on an old save loads as 0.
- **D-03 — Integrity hash:** FNV-1a 32-bit, computed in `buildRunSummary` (pure, synchronous) over a fixed-order, delimiter-joined string: season, seed, acts, floor, steps, day, kills, gold, sp, level, race, sub, cls, name, cause. It is stored as an 8-hex-char `hash`. It **excludes** `when` (wall clock), `note` and `epitaph` (content text), so copy edits never change a hash. The hash doubles as the run's stable **id** for dedupe in the bests record now and in Phase 68's submission queue later.
- **Nothing else is added** (no `party` field). Dev start-at-depth runs stay excluded from the graveyard, the total, the recent-names window and the bests record, exactly as today (Phase 21 D-13).

### The bests record (RUN-02)
- **D-04 — Contents:** your **top ten runs per ranked board**: DEEPEST, LEANEST, LONGEST, BUTCHERY and PURSE. Each board keeps its own id list, even where two boards currently share an ordering (see Specifics). It also keeps **LINEAGE aggregates** per `race + cls` combo: the count of your dead with that combo (all-time) plus the id of the combo's best run (deepest floor; ties go to fewer steps). The shape is one deduped runs table keyed by hash plus per-board ordered id arrays. A run no list references is pruned.
- **D-05 — Graveyard cap:** the adapter's stored graveyard goes from **5 back to 60**, the engine `bury()` cap. `GRAVE_CAP` becomes 60 in `src/browser/engineAdapter.js:86`. This deliberately reverses audit-batch E12 part 1, because the mock's GRAVEYARD board lists "everyone you have rolled and lost, deepest first". The classic `renderGraves` "Showing last 5 of N" copy is retired along with the Dead screen in Phase 66. This phase need only keep the existing Dead tab from breaking with more stones: it still renders a bounded list.
- **D-06 — One shared board table:** pure orderings and value functions live in `engine/` (for example `engine/records.js`: board ids, comparators, `updateBests(record, summary)` returning `{ record, newBests }`). Voice copy (title, rule line, mark, unit) lives in `content/` (for example `content/boards.js`). Phase 66's panel and Phase 68's PGS submission read the same table; neither redefines it.
- **D-07 — Load and write:** a single key `ddr.bests.v1` through `mzStorage` (Capacitor Preferences plus the localStorage mirror). It is loaded into memory at boot alongside the graveyard, then updated at the existing `persistGrave` death choke point (`engineAdapter.js#dispatch`, around line 443). The death panel can therefore compute "new best?" synchronously, without waiting on a storage read. Ranking is **all-time across seasons**, and every entry keeps its `season` tag (the settled 2026-09-17 decision: "personal bests stay all-time locally, tagged by season").

### Backfill and legacy keys (RUN-03)
- **D-08 — Backfill:** on the first load with no `ddr.bests.v1`, seed the record from the stones in `ddr.graveyard.v1` (up to 5 on today's devices). Backfilled entries get `season: 0` ("before the ledger") and a hash computed from their stored fields. They carry no seed and no acts; those are absent, not invented.
- **D-09 — `ddr.best.v1`:** retired. Stop writing it (`recordBest`/`getBest` go, per the greenfield ruling). The stored value stays on disk untouched and is never read into the record: a depth without run details cannot render a row. `storage.js`'s `LEGACY_KEYS` migration keeps working unchanged.
- **D-10 — `ddr.graveyard.total.v1`:** unchanged. It stays the never-trimmed lifetime count (the panel's INTERRED number).
- **D-11 — Old in-progress saves:** load tolerantly. `acts` counts from the load point, with no flag and no reconcile ceremony.

### New-best announcement (RUN-04)
- **D-12 — Where:** inside the **THAT IS THAT** death panel (`mazeworld.html#renderCombatOver`, `kind === "dead"`), as a visually distinct, gold-accented block before the buttons. Only a **new #1** on a board is announced; a lesser top-ten finish stays silent. The death screen owns its own space: the rail is hidden while `S.dead` (`mazeworld.html:4543`), and toasts were retired by the v1.4 device-round ruling. So the roadmap's "toast for anything short of a new best" has no surface and is deliberately dropped.
- **D-13 — Several boards at once:** one "NEW PERSONAL BEST" block lists each board beaten with its value (for example `DEEPEST DESCENT · floor 9`), followed by **one** quip from a new `content/` bank.
- **First-ever death** (empty record): no per-board list, just one line from the bank, for example "First corpse on the books. Every record is yours, for now."
- **D-14 — What counts:** strictly better than your current #1 by that board's own ordering. An exact tie on every key is not a new best. LINEAGE announces only when a run beats an **existing** combo's best, never a first-of-combo. GRAVEYARD never announces.

### Claude's Discretion
- The exact module names and split between `engine/records.js` and `content/boards.js`, the record's field names, and whether LINEAGE aggregates sit in the same record object or a sibling map.
- How the death panel receives the comparison result: for example a one-shot `takeDeathRecord()` read, mirroring `takeBootWornReport()`, or a field on the adapter's death report. It must not add a GameState field.
- The quip bank's size (at least 6 new-best lines and 3 first-death lines is a sensible floor), the block's exact styling within the dark over-panel palette, and its placement relative to the epitaph and last words.
- Test layout, and which existing exact-shape tests get re-pinned for the new summary fields and `acts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `engine/death.js:62` `buildRunSummary(state, cause, when)` returns `name, race, sub, cls, level, sp, floor, day, steps, gold, kills, cause, note, epitaph, when`. It is called by `die()` (line 133, the return value) and `bury()` (line 145, which caps at 60). The new fields go here, once.
- `engine/death.js:110` `die()` is the one terminator every death cause funnels through (13+ call sites). `forfeitLoot` shows the "one hook, not N call sites" pattern.
- `src/browser/engineAdapter.js`: `BEST_KEY` (56, retired this phase), `GRAVE_KEY` (66), `GRAVE_TOTAL_KEY` (79), `RECENT_NAMES_KEY` (80), `GRAVE_CAP = 5` (86, becomes 60), `recordBest` (234, retired), `persistGrave` (258, reads all keys then enqueues writes back-to-back, never throws), `startNewRun` (329, calls `recordBest` today), `boot` (362), and the died-event choke point in `dispatch` (443, `track(persistGrave(...))`, dev runs excluded).
- `takeBootWornReport()` (engineAdapter, near line 125) is the precedent for a one-shot adapter-side report the shell consumes once, never serialized.
- `src/browser/storage.js`: the `mzStorage` abstraction (Preferences plus localStorage mirror, a per-key write queue, fail-safe never-throw). `LEGACY_KEYS` (60) and `migrateLegacyKeys` (292) are the one-time copy-if-empty migration pattern.
- The classic shell's graveyard: `mazeworld.html:3210` `GRAVE_KEY`, `loadGraves` (3226), `saveGraves` (3250, already slices 60), `window.__mzGravesCount` (3261), `renderGraves` (3276, the "Showing last 5 of N" copy, renders at most 5 stones), `window.__mzClassicBoot` (5303, the boot path that awaits `loadGraves`).
- The death panel: `mazeworld.html:4173` (the `S.dead` branch of `renderEncounter`), `renderCombatOver` (3999; the `kind === "dead"` block at 4016–4032 adds name/race/deathNote, the floor/day/XP line, the epitaph and last words), `COMBAT_COPY.over.dead` (2715: "THAT IS THAT" / "The maze keeps the rest." / REVIEW THE ORACLE / BURY THEM), and `wireDeathConfirm` (3486, BURY THEM → `mzReturnToTitle()`).
- `content/epitaphs.js`, `content/index.js` and `ROMAN` are the voice-bank precedent for the new quip bank. `content/safety-wordlist.js` plus `test/voice/safety-scan.test.js` gate family-friendly copy, and the new bank must pass them.

### Established Patterns
- **Engine gate:** the engine stays pure and deterministic. New serialized fields are carved out of `movementComparable` (473), `combatComparable` (584) and `economyComparable` (1111) in `test/parity/harness/comparables.js`. `test/parity/prototype-master.js.txt` is never edited. Any fixture that moves is declared in `test/parity/FIXTURE-INVENTORY.md` with before/after and regenerated individually, never in bulk.
- **Save whitelist:** `engine/saveState.js#validateSave` (553) copies known fields explicitly, with the second whitelist site near 760. `acts` must be added to both, defaulting to 0 when absent.
- **Cross-run data is adapter-owned, never GameState:** the graveyard, the total, recent names and (now) the bests record. Pure logic lives in `engine/` (`bury()`), storage in the adapter.
- **Fail-safe persistence:** every adapter read/write is try/catch-and-swallow. A blocked storage means the record just does not persist; it never crashes the death flow.
- **Greenfield ruling (2026-09-17):** no dual paths. `ddr.best.v1` writes are removed outright, not kept alongside.

### Integration Points
- `engine/engine.js:35` `applyAction`: increment `next.acts` right after `structuredClone`, and only when `validateAction` passed.
- `engine/state.js#newRun`: add `acts: 0` to the fresh GameState.
- `engineAdapter.js#persistGrave`: add the bests update. This means reading the in-memory record, `updateBests`, and enqueueing a `ddr.bests.v1` write back-to-back with the graveyard writes.
- `engineAdapter.js#boot` / `__mzClassicBoot`: load the record, running the backfill if absent, before the first render that could show a death.
- `renderCombatOver`'s dead block: render the new-best block from the one-shot result.

</code_context>

<specifics>
## Specific Ideas

- **The board definitions come from the mock** (`Mazeworld Boards Panel.dc.html`, Claude Design project `fed8909e-860d-496e-9d31-04dd31f14a3c`; Phase 66 imports it into `design/`). Canon mapping: squares → `steps`, WILMST → `gold`, EXP → `sp`.

  | Board id | Tab | Ordering |
  |---|---|---|
  | deep | DEEPEST | floor desc, then steps asc |
  | lean | LEANEST | floor desc, then steps asc (identical to DEEPEST in the mock; displays `floor · sq`) |
  | combo | LINEAGE | grouped by `race + ' ' + cls`; each group's best = floor desc, then steps asc; groups ranked the same way |
  | days | LONGEST | day desc, then floor desc |
  | kills | BUTCHERY | kills desc, then floor desc |
  | purse | PURSE | gold desc |
  | yard | GRAVEYARD | your dead only, floor desc then steps asc; **not cut to ten** and not ranked |

- The mock's LINEAGE row detail reads "N rolled, N dead. Deepest was NAME, floor F in S squares. EPITAPH", which is why the aggregate keeps a count and the best run.
- The quip voice: deadpan, family-friendly and self-aware. For example: "New personal best. The dungeon has adjusted its expectations of you, slightly."

</specifics>

<deferred>
## Deferred Ideas

- **DEEPEST and LEANEST share one ordering in the mock.** They are identical top tens that differ only in how the value displays. That wastes a board locally and a leaderboard ID on PGS. Raise it at Phase 66's discuss, where LEANEST could rank by squares per floor, for example. This phase keeps separate id lists so either answer needs no data change.
- A `party` flag in the summary, for assisted-run boards. Not in v2.0.
- A floor-only "UNRECORDED" entry recovered from `ddr.best.v1`. Declined; the key stays on disk untouched.
- Announcing lesser top-ten finishes ("4th on BUTCHERY"). Declined for the death panel; Phase 66's panel shows them.

</deferred>
