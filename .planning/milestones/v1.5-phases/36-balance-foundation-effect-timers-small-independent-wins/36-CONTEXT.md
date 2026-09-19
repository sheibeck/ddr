# Phase 36: Balance Foundation, Effect Timers & Small Independent Wins - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous run, `defer uat to end`) — 4 grey areas proposed, all accepted by the user as recommended

<domain>
## Phase Boundary

Before any new player power lands anywhere in v1.5: (1) the class-matrix BEFORE snapshot is pinned against the v1.4-close engine; (2) a small, general-purpose effect/cooldown/timer module (`engine/effects.js`) exists with a single plain-JSON timer shape so Phases 38–40 share it instead of inventing three bespoke timers — with NO player-visible behaviour yet; (3) three independent, zero-dependency wins ship: a dead foe can never be the target (auto-switch to the next living foe, dead cards inert), a Cutthroat can accept a Joiner with a small, stated murder risk on each descent, and any hero can dismiss a Joiner from the Hero tab's Company panel with a confirmation and a sarcastic parting line.

Requirements: BAL-01, TGT-01, TGT-02, CUT-01, CUT-02, JOIN-01.

Out of scope here: teaching the tuning bot the new abilities/spells/items (that is Phase 42's AFTER-run prep), any timer *records* (Phases 38–40 add those), the Gear ON YOU/BAG split (Phase 43), and rations-per-rest arithmetic beyond the "eats N a rest" label the Company sheet shows (Phase 43 audits the rule).

</domain>

<decisions>
## Implementation Decisions

### BEFORE Matrix Pin (BAL-01)
- Captured as **Plan 01, before any code change in this phase**, against HEAD `38c8b91` — engine byte-identical to tag `v1.4.0`. Preflight exactly as the v1.2 protocol in `docs/CLASS-PASS.md` "How to reproduce": clean `git status --porcelain`, `npm test` ends `# fail 0`, `git diff --quiet v1.4.0 -- engine content src mazeworld.html` exits 0 immediately before both runs.
- Run parameters **identical to the v1.2 protocol** so the Phase 42 AFTER diff is like-for-like: `node tools/tune-classes.mjs --seeds 40 --workers 4 --max-actions 5000 --out docs/class-pass/v15-before.json` and `node tools/tune-classes.mjs --seeds 10 --workers 4 --max-actions 5000 --start-depth 20 --out docs/class-pass/v15-before-depth20.json`. Expect ~11.5 min + ~40 s wall time; launch with `run_in_background: true` writing to a scratchpad log with an `EXIT=<code>` sentinel, poll in bounded checks (never a foreground wait).
- File names: `docs/class-pass/v15-before.json` + `docs/class-pass/v15-before-depth20.json`. v1.2's `before.json`/`after.json`/`retune-after*.json` stay untouched.
- Ledger: append a **"v1.5 BEFORE" section to `docs/CLASS-PASS.md`** (pinned hash, both command lines, wall times, pooled rollups: p50Depth, reach5, meanEncountersSurvived, p50FloorsGained, stuck count, cannot-act gate result via `node tools/class-pass-diff.mjs --gate --after docs/class-pass/v15-before.json`). BAL-02 (Phase 42) records its verdicts in the same file.

### `engine/effects.js` Timer Model
- **Storage:** one plain-JSON map `c.timers`, **lazily created** (like `f.cd`) — absent on every fixture, bot run and old save. Entry shape: `{ cadence: "rounds" | "squares", left: number, cd?: number, phase: "effect" | "cooldown" }` keyed by a consumer-chosen id (e.g. `ability:whirl`, `item:Cloak of Light`, `spell:reveal`).
- **Parity carve-out now:** strip `timers` from `c` in all three `*Comparable()` functions in `test/parity/harness/comparables.js` (structural tripwire, mirroring left/patches), plus the local comparable duplicates in movement/combat/magic-parity tests if they still exist. Load tolerant of an absent field (never injected onto a save lacking it — the `clearFoeEffect` additive-with-default discipline).
- **API surface — pure functions, no classes:** `startEffect(c, id, { rounds | squares, cd? })`, `startCooldown(c, id, { rounds | squares })`, `tickRounds(c)`, `tickSquares(c, n = 1)`, `remaining(c, id)`, `isReady(c, id)`, `clearRoundTimers(c)`. Tick functions **return the list of ids that expired or flipped** (`{ id, from: "effect", to: "cooldown" | null }`) so the CALLER pushes its own events — effects.js emits no events and does no narration.
- **Tick sites wired in this phase**, all guarded by `if (c.timers)` so behaviour and draw counts are byte-identical until Phase 38 adds the first record: `movement.js` per-step block calls `tickSquares(c, stepCost)` (pass the step cost, so Phase 41's 2-move water squares tick squares-based timers consistently for free — TERR-02); `combat.js` round tail calls `tickRounds(c)`; `endCombat` calls `clearRoundTimers(c)` (the Phase 31 ward/afraid "cleared unconditionally at endCombat" precedent). Squares-cadence timers survive combat.
- **Duration→cooldown pairs:** one record flips `phase: "effect"` → `"cooldown"` automatically when `left` reaches 0 and `cd` is set (then `left = cd`); the record is deleted when the cooldown expires. Both transitions are reported in the tick return value.
- No timer *records* are created anywhere in this phase — `engine/effects.js` ships with unit tests only. Success criterion 6 ("no player-visible behavior yet") is the gate.

### Dead-Foe Targeting (TGT-01/02)
- **Export a pure `normalizeTarget(combat)` helper from `engine/combat.js`** implementing the exact lazy rule strike (`combat.js:461-462`) and cast (`magic.js:97`) already apply (`if (!foe || !foe.alive) C.target = C.foes.findIndex(f => f.alive)`); refactor those two call sites to use it (behaviour-identical). The shell calls `normalizeTarget(S.combat)` **after every combat dispatch, before `renderEncounter()`** — so `combat.target` stays byte-identical in every parity fixture (it IS part of the combat comparable) and the Phase 34 ruling "targeting stays the guarded shell mutation, no engine retarget action" holds.
- Any kill source is covered by that one seam — the hero's blow, a Joiner's blow, Freeze, foe-on-foe (insane), DOT: the normalize runs on every dispatch, not per source.
- Dead-card taps: keep the existing `if (c.alive)` `guardTap` wiring in `renderFoeCards`; add `aria-disabled="true"` on dead cards and a pinned shell test asserting a dead card has no click handler / role.
- Race protection: the normalize runs before the re-render, so `ARM_DELAY_MS` (250 ms, `inputGuards.js`) stamps on the settled roster; add a test that a tap arriving inside the arm window after a kill is refused, and that a tap on a live card after the window targets the tapped index.

### Cutthroat & Joiner Dismissal (CUT-01/02, JOIN-01)
- **CUT-01 reversal:** drop the `c.sub === "Cutthroat"` clause from the refusal ternary in `engine/encounters.js#meetJoiner` (line 473) — a DELIBERATE RULES CHANGE comment replaces the Phase 24 one; the Wilmsry refusal stays. The dead `cutthroat` refusal copy in `eventNarration.js`/`toasts.js` (`joinerRefused` reason `cutthroat`) is removed; `wilmsry` kept. Zero rng change (the four joiner draws are untouched).
- **CUT-02 murder odds: a natural 1 on a d20 per descent (1-in-20).** The blurb states it verbatim ("one descent in twenty"). The draw fires **only when `c.sub === "Cutthroat" && state.party?.length`**, placed **after `genFloor`/`reveal` in `movement.js#descend`** (after every existing draw — `checkLevel` and `genFloor` both draw). Victim = `state.party[0]` (PARTY_CAP is 1), removed from the roster. New event `joinerMurdered { name, sub, depth }`.
- **Narration:** 5–6 sarcastic, family-friendly lines chosen **deterministically with no rng** in the presentation layer (hash of name + depth); rail card COMPANY / tone bad; `EVENT_NARRATION` + toast-table entries so both coverage guards stay green; voice-safety scan on every new line.
- **Blurb:** `content/flavor.js` "Cutthroat" rewritten to match — first landed blow crits; Joiners now walk beside you; one descent in twenty, one of them doesn't reach the next floor, and everyone knows why. `docs/CLASS-PASS.md`'s identity table row (line 797, bad = "No Joiner will ever travel with you") becomes the murder risk; `test/unit/identity-contract.test.js` Cutthroat bad-assertion updated in the same plan (the identity contract must still show one good + one bad).
- **JOIN-01 dismiss:** new **no-rng engine action `dismissJoiner`** (registered in `engine/actions.js` + `engine/engine.js` beside `resolveJoiner`): removes the member (by index, default 0), pushes `joinerDismissed { name, sub }`; refuses with a named reason when the party is empty or in combat. Shell: `renderPartyRoster()` Company card gains the sheet — class/sub/race, HP (never "WP"), weapon, "eats N a rest" (`RACES[m.race]?.eats || 1`) — and a **DISMISS button using the Gear tab's two-tap inline confirm** (Phase 33 `mw-drop-confirm` precedent: arm → YES/NO → timeout/outside-tap revert, one row armed at a time). On confirm the bridge dispatches `dismissJoiner` through the same `dispatchWithToasts` seam as `mzResolveJoiner`; the parting line surfaces on the rail (COMPANY, dull) — never a toast, never inline text.

### Claude's Discretion
- Exact wording of the murder and parting lines (voice: dark wit, family-friendly; the sarcasm targets the doomed adventurer, never gore).
- Whether `normalizeTarget` also guards `foes` being empty (it should return without touching `target` when no foe is alive, matching today's `findIndex` → -1 behaviour exactly).
- Internal file layout of `engine/effects.js` tests (`test/unit/effects.test.js`) and the shell test file for the Company panel / dead-card pins.
- Order of Plans 02–04 after the pin lands (effects.js, targeting, Cutthroat+dismiss are independent; parallel waves are fine).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/tune-classes.mjs` + `tools/lib/class-matrix.mjs` + `tools/class-pass-diff.mjs --gate` — the matrix bot and its cannot-act gate; `docs/CLASS-PASS.md` "How to reproduce" is the exact preflight/run protocol.
- Timer precedents to mirror (not retrofit): `f.cd[id]` lazy map (`engine/foeAbilities.js:61-63`), `c.ward.rounds` round tick + endCombat clear (`engine/combat.js:1883`), `c.darkFor` per-step decrement with a lifted event (`engine/movement.js:273-290`), `it.usedAt`/`it.every` squares cooldown (`engine/items.js:785-869`).
- Targeting: lazy normalize at `engine/combat.js:461-462` and `engine/magic.js:97`; shell mirror at `mazeworld.html:4200`; `renderFoeCards` (`mazeworld.html:5291`) already wires `guardTap` only when `c.alive`; `src/browser/inputGuards.js` (`ARM_DELAY_MS`, `DISMISS_SETTLE_MS`, `guardTap`).
- Joiner flow: `meetJoiner`/`resolveJoiner` (`engine/encounters.js:465-520`), `swapPartyMember`/`PARTY_CAP` (`engine/state.js:50-96`), action registration `engine/actions.js:35,103` + `engine/engine.js:109-113`, shell bridge `window.mzResolveJoiner` (`mazeworld.html:7579`), rail copy/cards for `joinerJoined/Declined/Left` (`src/browser/rail.js:70,134-136`).
- Company panel: `renderPartyRoster()` (`mazeworld.html:5146`) renders `#hero-party-list` cards (name, sub, roman level, HP track, Downed chip); markup at `mazeworld.html:1469-1472`.
- Inline confirm precedent: Gear tab Drop confirm (`mazeworld.html:3714-3725`, `.mw-drop-confirm`, `DROP_CONFIRM_MS`, `revertDropConfirm()`).
- Sub-class blurbs: `content/flavor.js:52` (Cutthroat); identity table `docs/CLASS-PASS.md:797`; `test/unit/identity-contract.test.js:698-797` (Cutthroat cases), `test/unit/joiner-acquisition.test.js:1231` (negative refusal test).

### Established Patterns
- Engine pure/deterministic; every new draw after all existing draws in its function and behind a guard false for every fixture (no fixture ever meets a Joiner → the murder draw is unreachable for fixtures/bots by construction).
- New serialized fields: lazily created, tolerant load, carved out of all three comparables (`stripFoeAbilityState` precedent) — `c.timers` follows this exactly.
- Every new event type: `EVENT_NARRATION` entry + toast-table entry + rail entry; `toastsCoverage.test.js` / `formatEventsCoverage.test.js` must stay green; new copy passes `test/voice/safety-scan.test.js`.
- Presentation mutations of `S.combat.target` are the sanctioned targeting mechanism (Phase 34 decision 3); no engine `retarget` action.
- Rail is the ONE feedback surface (v1.4 ruling): parting/murder lines are rail cards; no toasts, no inline refusal text.
- Player-facing text says HP, never WP.

### Integration Points
- `movement.js#descend` (murder draw after `genFloor`/`reveal`), `movement.js` per-step block (`tickSquares`), `combat.js` round tail + `endCombat` (`tickRounds`/`clearRoundTimers`), `engine/actions.js` + `engine/engine.js` (`dismissJoiner`), `engine/encounters.js#meetJoiner` (ternary), `content/flavor.js` (blurb), `src/browser/eventNarration.js` + `toasts.js` + `rail.js` (`joinerMurdered`, `joinerDismissed`), `mazeworld.html` (`renderPartyRoster` sheet + DISMISS confirm, post-dispatch `normalizeTarget` call, dead-card `aria-disabled`), `test/parity/harness/comparables.js` (`timers` carve-out), `docs/CLASS-PASS.md` (v1.5 BEFORE section + identity row).

</code_context>

<specifics>
## Specific Ideas

- Murder line register: "Somewhere between floors, {name} had an accident. You were the accident." — deadpan, the joke is on the Cutthroat's reputation, never on the body.
- Parting line register (dismissal): the Joiner gets the last word — e.g. "{name} takes the news well, by which we mean they were already walking away."
- The Cutthroat blurb must state the odds in plain words ("one descent in twenty"), not as a percentage.
- Company sheet line order: name · sub/race · class · level, then HP track, then "Weapon: X" and "Eats N a rest", then DISMISS.

</specifics>

<deferred>
## Deferred Ideas

- Teaching the tuning bot to use new abilities/items/spells — Phase 42 (BAL-02 prep), not here.
- Ration-rule audit and the per-rest totals on the Hero sheet — Phase 43 (CLAR-03/05); this phase only labels "eats N a rest" from `RACES[m.race].eats`.
- Whether a murdered Joiner drops loot/coin for the Cutthroat — not requested; noted as a possible later flavor addition.

</deferred>
