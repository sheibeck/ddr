---
phase: 31-combat-start-gating-effect-hygiene
plan: 03
subsystem: shell-combat
tags: [shell, canCast, grimoire, conditions, afraid, ward, fight-gate, cmb-01, cmb-02, cmb-03, cmb-04, roll-direction]

# Dependency graph
requires:
  - phase: 31-combat-start-gating-effect-hygiene
    plan: 01
    provides: "the fight action + combat.pending; combatJoined {first}; combat.afraid + conditionsOf's afraid entry {key:'afraid', remaining, phobia}"
  - phase: 31-combat-start-gating-effect-hygiene
    plan: 02
    provides: "ward entry {key:'ward', polarity:'good', pool, remaining, name}; useRefused/castRefused/scrollRefused/actionRefused reasons (cooldown{left}/wrongClass/pilfer/combatOnly/exploreOnly/noTarget/notFought); foeStoned; TARGETED_KINDS export; Acuteness per-round/per-step tick; docs/USABLE-FEATURES-AUDIT.md"
provides:
  - "mazeworld.html: window.mzFight = () => engineCombatAction(\"fight\") — a real dispatch, not a display-flag flip"
  - "renderEncounter's roster gate reads C.pending (the engine's own flag); the keydown gate reads S.combat.pending; the AMBUSH pre-death special case (beats.awaitingFight, foes/combatType carry) is deleted"
  - "window.__mzCanCast bridges engine/derived.js#canCast; the classic in-combat canCast(sp) filter delegates to it instead of re-checking sp.lvl directly (closes the Phase 23 Summoner/Illusionist regression at the shell layer)"
  - "src/browser/viewModels.js#grimoireViewModel: 'Needs level N' / '<school> opens at level N' replace the collapsed 'Not ready yet'"
  - "renderCarriedList's Use button, the combat use-list, the Bard's Sing button/key, and the Scroll button/key all stay visible regardless of cooldown/class gate — a tap dispatches and the engine's refusal toast explains"
  - "CONDITION_COPY.ward ('Shield <pool> hp · <rounds> rds', two-number chip mirroring the flight special case) and CONDITION_COPY.afraid ('Afraid · N rds') replace the old DR17 phobia freeze-chip and its label-chain special case; the Acute chip reads rds in combat, sq outside"
  - "src/browser/viewModels.js#characterSheetViewModel: the TO HIT stat renders '1–N' (en dash, the prototype's own sheet text) instead of 'N+' (roll-direction audit Finding 2)"
  - "test/unit/shell-fight-gate.test.js (new, 12 pins), test/unit/spell-menu-mirror.test.js (new, 6 pins — the cell-by-cell classic-vs-engine canCast mirror walk); grimoireViewModel/characterSheetViewModel/foe-effect-chip/shell-toast-wiring re-pinned"
affects: [32-round-card-and-toast-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The classic shell never re-implements an engine gate a second time — canCast(sp) is now a one-line delegate to window.__mzCanCast (bridged from engine/derived.js#canCast), the same bridge pattern __mzConditionsOf/__mzArmorDisplay/__mzSellPrice already established; the mirror test (spell-menu-mirror.test.js) proves the delegate can never drift, rather than hand-verifying two named cases"
    - "Never-disable-silently buttons (Phase 25.1 DFB-06) extended past items to class-gated actions: the Sing/Scroll buttons and keys 6/7 now render/respond whenever the STRUCTURAL gate applies (Bard; any scroll carried) rather than the full readiness gate (cooldown/canRead), so a cooling or ungated tap always reaches the engine and gets an explaining toast instead of the control vanishing"
key-files:
  created:
    - test/unit/shell-fight-gate.test.js
    - test/unit/spell-menu-mirror.test.js
  modified:
    - mazeworld.html
    - src/browser/viewModels.js
    - test/unit/shell-toast-wiring.test.js
    - test/unit/grimoireViewModel.test.js
    - test/unit/foe-effect-chip.test.js
    - test/unit/characterSheetViewModel.test.js

key-decisions:
  - "The dead classic castSpell()'s error-message branch (mazeworld.html ~L4102) also carried a literal `sp.lvl > S.c.level` compare purely to pick which of three messages to show — reordered it onto the still-valid schoolGate check (grimoire -> school gate -> fallback level message) so no copy of the fixed IDENT-03/04 bug survives anywhere in the file, live or dead; this is presentation-only inside code the DR8 doc comment already documents as unreachable from the live UI, zero gameplay/parity impact"
  - "Acuteness's chip unit is a one-line render-time special case (S.combat ? \"rds\" : \"sq\") rather than a second CONDITION_COPY row, matching the plan's 'leave CONDITION_COPY.acute's default unit for the fallback' instruction; CONDITION_COPY.acute's own unit field became the outside-combat default"
  - "The Sing/Scroll button visibility relaxation intentionally stops at the STRUCTURAL gate (S.c.sub === \"Bard\"; S.c.scrolls > 0), not full readiness — songReady()/canRead() still exist and are called internally (row countdown math, the dead classic sing()/readScroll()) but no longer gate the button's presence, matching the plan's literal instruction and the CMB-02 refusal-vocabulary design (cooldown/wrongClass/pilfer/noRunes toasts explain the rest)"

patterns-established:
  - "See tech-stack.patterns above"

requirements-completed: [CMB-01, CMB-02, CMB-03, CMB-04]

coverage:
  - id: D1
    description: "Fight! dispatches the engine's fight action (window.mzFight = () => engineCombatAction(\"fight\")); the encounter preview gates on combat.pending in both renderEncounter and the keydown handler; the AMBUSH pre-death special case (beats.awaitingFight, the foes/combatType carry on engineMove's diedOnMove branch) is deleted — a pre-emptive kill now resolves through the ordinary death-card path after Fight! is pressed"
    requirement: "CMB-01"
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-gate.test.js — the 6 Task-1 pins (dispatch, both gates, zero awaitingFight, single preDeath: true, no classic function fight() shadow)"
        status: pass
      - kind: unit
        ref: "test/unit/shell-toast-wiring.test.js — 'DFB-01 preDeath survives; the ambush gate collapsed in Phase 31'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The in-combat SPELLS menu filters through window.__mzCanCast (bridged to engine/derived.js#canCast, spellLevelFor-aware) instead of the stale classic sp.lvl compare; a level-1 Summoner sees Summon and a level-1 Illusionist sees Phantom Host; the Hero-tab Grimoire names 'Needs level N' or '<school> opens at level N' instead of the collapsed 'Not ready yet'"
    requirement: "CMB-02"
    verification:
      - kind: unit
        ref: "test/unit/spell-menu-mirror.test.js — the named Summoner/Illusionist/Wizard pins plus the full (sub x spell x level 1-5) cell-by-cell mirror walk (both populated and empty grimoire)"
        status: pass
      - kind: unit
        ref: "test/unit/grimoireViewModel.test.js — the re-pinned level test plus the new school-locked and level-1-Summoner-Summon-castable cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Use/Sing/Scroll button (Gear tab, combat use-list, action bar) stays visible when blocked, dispatching on tap so the engine's own refusal toast explains why (cooldown/wrongClass/pilfer/noRunes); cooldown rows keep showing the countdown"
    requirement: "CMB-03"
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-gate.test.js — the renderCarriedList/combat-use-list/Sing/Scroll source pins"
        status: pass
    human_judgment: false
  - id: D4
    description: "The condition tracker renders the ward chip as 'Shield <pool> hp · <rounds> rds' (both numbers on one chip, mirroring the flight special case) and the Afraid chip as 'Afraid · N rds' (CONDITION_COPY.afraid replaces the old phobia freeze-chip and its label-chain special case); the Acute chip reads rds in combat, sq outside"
    requirement: "CMB-04"
    verification:
      - kind: unit
        ref: "test/unit/shell-fight-gate.test.js — the CONDITION_COPY/ward-branch pins"
        status: pass
      - kind: unit
        ref: "test/unit/foe-effect-chip.test.js — re-anchored ordering pin plus the new afraid-row/no-phobia-branch pin"
        status: pass
    human_judgment: false
  - id: D5
    description: "The roll screen's TO HIT stat (characterSheetViewModel) renders the hitting range '1-N' (en dash) instead of 'N+', matching the prototype's own Hero tab text (roll-direction audit Finding 2); zero gameplay change, display only"
    requirement: null
    verification:
      - kind: unit
        ref: "test/unit/characterSheetViewModel.test.js — the re-pinned TO HIT assertion"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run build:www exits 0; the full suite is green (1855/1855, up from the 1834 baseline); test/parity/fixtures and prototype-master.js.txt are untouched — no engine surface was added or changed in this plan"
    verification:
      - kind: unit
        ref: "npm run build:www (exit 0); npm test (1855/1855, 0 fail); git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt (empty)"
        status: pass
    human_judgment: false
  - id: D7
    description: "On-device verification of the Fight! gate, the Afraid/ward/Acute chips, the Summoner/Illusionist spell menu fix, the always-visible Use/Sing/Scroll buttons, and the roll screen's TO HIT range end to end (deferred to the end of the milestone run per STATE.md)"
    verification: []
    human_judgment: true
    rationale: "Requires a physical Pixel 7 session across an encounter, a fight, the Gear tab, and the roll screen to observe the Oracle/toast copy, chip countdowns, and button behavior together — this is the shell-wiring plan Plans 01/02 deferred their own device checklists to; see the Human verification section below"

duration: 45min
completed: 2026-09-16
status: complete
---

# Phase 31 Plan 3: Shell Wiring — Fight! Gate, Spell Menu Bridge, Visible Buttons, Ward/Afraid Chips Summary

**Wires the shell to the Plan 01/02 engine surface: Fight! is now a real `fight` dispatch gated on `combat.pending` (the AMBUSH pre-death hack collapses), the in-combat spell menu bridges to the engine's `spellLevelFor`-aware `canCast` (closing the Phase 23 Summoner/Illusionist regression at the shell layer), every Use/Sing/Scroll button stays visible with the engine's refusal toast explaining a block, the tracker gets a two-number Shield chip and an "Afraid · N rds" chip replacing the old phobia freeze-chip, and the roll screen's TO HIT stat reads the hitting range `1–N` instead of the inverted `N+` — full suite 1855/1855, `build:www` exit 0.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 8 (2 new, 6 modified)

## Accomplishments

- `window.mzFight` is now `() => engineCombatAction("fight")` — a real dispatch mirroring `mzAttack`; nothing rolls or narrates until the tap. `renderEncounter`'s roster gate reads `C.pending` and the keydown handler's gate reads `S.combat.pending`, both sourced from the engine, not a presentation flag.
- The AMBUSH pre-death special case is gone: `noteCombat` no longer sets a presentation flag on a fresh fight, `mzMakeCamp` no longer sets one on a wandering ambush, the beats-branch's `b.awaitingFight` roster/Fight! bridge is deleted, and `engineMove`'s `diedOnMove` block no longer carries a foes/combatType payload for an "ambush" title — a pre-emptive kill now happens inside the `fight` dispatch, after the player has already pressed Fight!, so it resolves through the ordinary `S.dead` death-card branch. `grep -v '^\s*//' mazeworld.html | grep -c 'awaitingFight'` is 0.
- `window.__mzCanCast` bridges `engine/derived.js#canCast` into the shell; the classic in-combat `canCast(sp)` filter is now a one-line delegate (`return !!(window.__mzCanCast && window.__mzCanCast(S, sp));`) instead of re-checking `sp.lvl` directly — closing the Phase 23 IDENT-03/04 regression at the shell layer: a level-1 Summoner's Summon and a level-1 Illusionist's Phantom Host now appear (and work) in the combat spell menu. `test/unit/spell-menu-mirror.test.js` proves the classic delegate and the engine predicate agree for every (sub × spell × level 1-5) cell, not just the two named regression cases.
- `grimoireViewModel` replaces the collapsed `"Not ready yet"` with the engine's own two-way split: `` `Needs level ${spellLevelFor(c.sub, sp)}` `` when the level gate blocks, `` `${sp.s} opens at level ${schoolGate(c.sub, sp.s)}` `` when the school gate blocks.
- `renderCarriedList`'s Use button now appends for every potion/use-kind row regardless of cooldown (the row title already shows the countdown); the combat use-list's filter dropped its readiness term the same way; the action bar's Sing button renders for every Bard (appending a squares-left countdown when cooling) and the Scroll button renders whenever `scrolls > 0` (no longer hidden by `canRead()`) — keys 6/7 mirror the same relaxed gates. A tap on a blocked control dispatches and the engine's own `useRefused`/`actionRefused`/`scrollRefused` toast (cooldown/wrongClass/pilfer/noRunes) explains.
- `CONDITION_COPY` gains `ward: { label: "Shield" }` (rendered as `"Shield 34 hp · 3 rds"` via a new `cn.key === "ward"` branch mirroring the existing `flight` two-number special case) and `afraid: { label: "Afraid", unit: "rds" }`, replacing the old DR17 `phobia: { label: "Phobia" }` row and its `cn.key === "phobia"` label-chain special case — the engine's `{key:"afraid", remaining, phobia}` chip now renders through the plain generic-detail path, no bespoke fear-naming code left. The Acute chip reads `rds` in combat and `sq` outside via a one-line render-time special case.
- `characterSheetViewModel`'s TO HIT stat now renders `` `1–${toHit(state)}` `` (en dash) instead of `` `${toHit(state)}+` ``, matching the prototype's own Hero-tab sheet text and closing roll-direction-audit Finding 2 — display only, zero gameplay change (`toHit(state)` itself untouched).
- `npm run build:www` exits 0; full suite **1855/1855 passing (0 fail)**, up from the 1834 baseline; `test/parity/fixtures` and `test/parity/prototype-master.js.txt` untouched (`git status --porcelain` empty) — no engine surface was added or changed anywhere in this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fight! dispatches `fight`; the preview gates on combat.pending; the AMBUSH pre-death special case collapses** - `3e89f8f` (feat)
2. **Task 2: Bridge the in-combat spell gate to the engine, split the grimoire reasons, keep blocked Use/Sing/Scroll buttons visible, paint the Shield chip** - `c0e0006` (feat)
3. **Task 3: Build the www bundle and run the full gate** - no code changes; `npm run build:www` (exit 0) and `npm test` (1855/1855) verified, this SUMMARY + STATE/ROADMAP/REQUIREMENTS updated in the plan-metadata commit below

## Files Created/Modified

**Shell:**
- `mazeworld.html` — `window.mzFight`; `renderEncounter`'s `C.pending` gate; the keydown handler's `S.combat.pending` gate; the deleted AMBUSH beats branch, `noteCombat`/`mzMakeCamp` flag removal, `engineMove`'s trimmed `diedOnMove` block; the `window.__mzCanCast` bridge + the classic `canCast(sp)` delegate; the dead classic `castSpell`'s reordered message branch; `renderCarriedList`'s always-visible Use button; the combat use-list's relaxed filter; the action bar's always-visible Sing/Scroll buttons + keys 6/7; `CONDITION_COPY.ward`/`CONDITION_COPY.afraid` + the `paintConditions` ward/acute branches, the deleted phobia label-chain branch

**View models:**
- `src/browser/viewModels.js` — `grimoireViewModel`'s level/school reason split; `characterSheetViewModel`'s `1–${toHit(state)}` TO HIT value

**New tests:**
- `test/unit/shell-fight-gate.test.js` (12 pins — Task 1's 6 Fight!-gate pins + Task 2's 6 spell-gate/never-disable-silently/chip-copy pins)
- `test/unit/spell-menu-mirror.test.js` (6 pins — named Summoner/Illusionist/Wizard cases + the full cell-by-cell classic-vs-engine `canCast` mirror walk, populated and empty grimoire)

**Re-pinned:**
- `test/unit/shell-toast-wiring.test.js` — the DFB-01 preDeath/ambush pin re-pinned to the collapse
- `test/unit/grimoireViewModel.test.js` — the "Not ready yet" pin re-pinned to "Needs level N"; added a school-locked case and a level-1 Summoner/Summon castable case
- `test/unit/foe-effect-chip.test.js` — the label-chain ordering pin re-anchored on `affliction` (was `phobia`); added the afraid-row/no-phobia-branch pin
- `test/unit/characterSheetViewModel.test.js` — the TO HIT value pin re-pinned to `1–${toHit(state)}`

## Decisions Made
See `key-decisions` in frontmatter. Headline: the dead classic `castSpell`'s message-picking branch also carried a literal `sp.lvl > S.c.level` compare (purely cosmetic, unreachable from the live UI per the file's own DR8 doc comment) — reordered onto the still-valid school-gate check so no copy of the fixed regression survives anywhere in the file, live or dead, satisfying the acceptance criterion's file-wide grep sweep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The dead classic `castSpell`'s error-message branch still contained a literal `sp.lvl > S.c.level` compare**
- **Found during:** Task 2, verifying the acceptance criterion `grep -v '^\s*//' mazeworld.html | grep -c 'sp.lvl > S.c.level'` == 0
- **Issue:** The classic in-combat spell-menu filter (`canCast(sp)`) was fixed to delegate to the engine, but a SEPARATE, unreachable-from-the-live-UI function (the dead classic `castSpell`, per the file's own DR8 doc comment) still used the stale `sp.lvl > S.c.level` compare purely to choose which of three error strings to show once `canCast(sp)` had already failed. This is harmless at runtime (dead code) but left a literal copy of the fixed Phase 23 bug pattern in the file.
- **Fix:** Reordered the message-picking branches onto the still-valid `schoolGate` check (grimoire → school gate → fallback level message), removing the direct `sp.lvl` compare with zero behavior change to any reachable code path.
- **Files modified:** `mazeworld.html`
- **Verification:** `grep -v '^\s*//' mazeworld.html | grep -c 'sp.lvl > S.c.level'` returns 0; full suite stayed green.
- **Committed in:** `c0e0006` (Task 2 commit)

**2. [Rule 1 - Bug] The unused `canCast` import in `viewModels.js` after the grimoireViewModel refactor**
- **Found during:** Task 2, reviewing the edited import list
- **Issue:** After replacing `grimoireViewModel`'s single `!canCast(state, sp)` branch with the direct `spellLevelFor`/`schoolGate` split, the `canCast` import from `engine/derived.js` became dead (unused) in the module.
- **Fix:** Removed `canCast` from the import list; `spellLevelFor`/`schoolGate` added in its place.
- **Files modified:** `src/browser/viewModels.js`
- **Verification:** `grep -n "canCast" src/browser/viewModels.js` shows zero live call sites; full suite stayed green.
- **Committed in:** `c0e0006` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both surfaced by this plan's own required verification — a literal-text acceptance grep and an import-hygiene check)
**Impact on plan:** Neither weakens an assertion or expands scope; both are direct, necessary consequences of Task 2's own instructions (the file-wide grep sweep for the stale compare; the grimoireViewModel refactor making the old import literally unused).

## Issues Encountered

None beyond the two deviations above.

## User Setup Required
None - no external service configuration required.

## Phase 32 hand-off

- `renderEncounter` now reads the engine's `combat.pending` directly (no presentation flag) to gate the roster/Fight!-only view; Phase 32's Round Card build starts from a combat panel where `C.pending` is already the single source of truth for "has Fight! been pressed yet."
- The `fight` action's own events (`combatJoined {first}`, and — per Plan 01's Afraid ruling — `phobiaAfraid {rounds}`/`fearPassed` with `needMods: [{name:'afraid'}]` on `strikeMissed`/`struck`/`spellThrown` and `afraid: true` on `struck`/`spellHit`) are ready for the Round Card to render as a penalty line, never a lost turn — nothing in this plan renders them into a card; they still surface via the Oracle log/toasts only.
- Refusals (`castRefused`/`useRefused`/`actionRefused`/`scrollRefused` + every CMB-02 reason) are `PRIORITY.block` toasts and MUST STAY toasts per the user's 2026-09-16 clarification (docs/COMBAT-NARRATIVE-DESIGN.md §4.2/§6.4) — Phase 32 must not fold them into the Round Card.
- The spell menu, Use/Sing/Scroll buttons, and condition chips this plan wired are all read-only presentation on top of the Plan 01/02 engine surface — Phase 32 can restyle/relayout them freely without touching any dispatch or gating logic.
- No blockers identified for Phase 32.

## Human verification (deferred to end of run)

Deferred to the end of the autonomous run (merged with Plans 01/02's items; the Pixel 7 pass happens at the end of the milestone run per STATE.md — never pause mid-run for a device check):

- Pixel 7: encounter → roster + Fight! only; the Oracle has no initiative/strike line until Fight! is tapped; tap Fight! → "You/They move first." toast, then the opener; a phobia (matching foe type) shows the "Afraid. Your aim wobbles for 2 rounds." toast after Fight! and the tracker's "Afraid 2 rds" chip — tapping Strike SWINGS at once (roll vs the shrunk need, e.g. "4 vs 2 (needs 2: afraid −3)"; a hit shows the halved damage and "Fear pulls the blow."), tapping Spells → a spell CASTS (no refusal toast for fear), Items/Flee/Parley all respond; the chip counts 2 → 1 → gone and "The fear passes." prints — your to-hit range shrinks by 3 while afraid, never a lost turn, never a "frozen" line.
- Roll (or dev-start) a level-1 Summoner and a level-1 Illusionist: the combat SPELLS menu lists Summon / Phantom Host and casting works.
- Hero tab Grimoire: a spell above level reads "Needs level N"; a school-locked one reads "<school> opens at level N".
- Gear tab: every potion/use item shows Use; a staff on cooldown shows the countdown and its tap toasts the squares left; Acuteness drunk in a corridor shows the Acute chip in sq, then rds in a fight.
- Cast Shield (or use a Rowan Staff): the chip reads "Shield <pool> hp · <rounds> rds" and both numbers fall as expected.
- Bard: "6 · Sing (N sq)" shows while cooling and its tap toasts the wait.
- Roll a new character: the roll screen's TO HIT reel reads "1–5" (a Fighter) / "1–3" (a Magic User) — a range, never "5+" — and matches the Hero tab's "To hit 1–N" line after the roll.
- Use the Amulet of Stone on the last foe — "… turn to stone. Statues don't hit back.", the kill payout lines, and Phase 29's loot card (if a drop rolled) — no stranded combat screen.
- Tap a staff's Use in a corridor — a toast names why (wants a target); tap it on cooldown — the toast says how many squares are left and the row shows the countdown.
- Roll (or force) an Elven hero and confirm foes land on them noticeably more often than a Human control at the same level.

---
*Phase: 31-combat-start-gating-effect-hygiene*
*Completed: 2026-09-16*

## Self-Check: PASSED

Both new files (test/unit/shell-fight-gate.test.js, test/unit/spell-menu-mirror.test.js) exist on disk; both task commit hashes (3e89f8f, c0e0006) found in git history; `npm test` 1855/1855, 0 fail; `npm run build:www` exit 0; `git status --porcelain test/parity/fixtures test/parity/prototype-master.js.txt` empty.
