# Milestones

## v1.4 Combat & Map Screens (Shipped: 2026-09-16)

**Phases completed:** 2 phases, 10 plans, 28 tasks

**Key accomplishments:**

- Three new pure src/browser/ view-model modules (fightLog.js, combatMenu.js, combatPanel.js) plus a non-destructive toasts.js extension (opts.withIdx, oracleDetailText) that give Phase 34's later shell plans everything they need to build the fight log, the four-action grid, and the foe/YOUR LOT/overlay content — zero mazeworld.html edits.
- Re-routed the Phase 32 seam from the single-round Round Card to the whole-fight › log: `dispatchWithToasts` now writes every folded line (narrative and dull refusals alike, uncapped) to `window.__mzFightLog` via one `wasCombat||inCombat` if/else, parks the ending action's own lines on `window.__mzFightEnd` for Plan 05's over-panel, and `renderFightLog`/`syncFightLogLive` render it newest-first with in-place tap-to-reveal — the Round Card is fully retired.
- Rebuilt `renderEncounter`'s live-combat branch into the mock's three-band layout (header -> cb-mid[foes, YOUR LOT, log] -> cb-act) from the Plan 01 view-models, moved the Fight! gate out of the combat markup into a new generic `renderMajorOverlay(host, spec)` (the map's MAJOR OVERLAY, reused by Phase 35), and closed a real CSCR-08 gap by wrapping foe-card retargeting in `guardTap` for the first time.
- Replaced the old 7-button combat action bar with the mock's 2x2 STRIKE/SPELLS-or-ABILITIES/ITEMS/SOCIAL grid and its guarded submenus (driven by `combatMenuViewModel`), reworked the keyboard map so every key click-throughs the same guarded buttons a tap would, and moved the last two shell-side in-combat toasts (potion at full health / no potions) into dull fight-log entries — no toast can fire during a fight any more.
- All four fight endings (won/soothed/fled/dead) now render through one `renderCombatOver(host, kind, opts)` in the mock's dark over-panel vocabulary — loot rows, the victory/soothed report, the parked killing-blow line, and the death card's epitaph/last-words/Review-the-Oracle/Bury-Them all fold in; the joiner and find cards opt into the same dark styling; the dismissal transition now clears the phase's transient globals; and the whole phase closes with a green executor gate (2047/2047 tests, clean build, untouched engine/content/parity) plus the aggregated 27-item deferred Pixel 7 checklist.
- Three pure presentation modules — `rail.js`'s event-family fold, `tapStep.js`'s dominant-axis step resolver, and `mapMarks.js`'s coloured-glyph palette — ready for the Wave 2-4 shell wiring, with 39 new tests and zero engine/content/parity/toasts.js/controls.js/icons.js edits.
- The map screen's persistent bottom RAIL now carries every out-of-combat event and every decision (joiner/find/climb) with a global movement lock, and the Phase 25.1 toast host and Move-on card are fully retired — zero toast anywhere in the app.
- The map column's chrome now matches the mock — a two-row HUD (FLOOR/DAY/SQUARES/RATIONS + x/y WP bar) with its own condition-chip strip beneath it, a canvas renderer painting coloured text-glyph marks + a pulsing party ring from `src/browser/mapMarks.js`, and MARKS/MAKE CAMP as guarded bottom sheets — with 19 new source-assertion tests and zero engine/content/parity/icons.js edits.
- Tap-to-step (dominant-axis-then-fallback) and hold-to-inspect replace the D-pad on the map viewport; a shell pre-dispatch interception shows THE STAIR DOWN before the engine's unconditional descend can fire, with GO DOWN dispatching the identical stepNow(dir) every step uses — 25 new source-assertion tests, zero engine/content/parity edits.
- One `shell-map-invariants.test.js` suite (37 tests, zero fixes required) pins every Phase 35 retirement/guard/copy invariant file-wide; the full executor gate is green (2170/2170 tests, clean build, untouched engine/content/parity); the v1.4 milestone's one debug APK is built (1.2.0 (3), 9.0 MB) with no device install attempted; and the aggregated 27-item deferred Pixel 7 checklist closes out MAP-10's plan-side deliverable, ready for the same milestone-close DR round that also works through Phase 34's own 27-item list.

### Known Gaps (carried forward)

- **CSCR-10 / MAP-10 — on-device DR round (override closeout, 2026-09-16):** the user ran this milestone with `/gsd-autonomous defer uat to end`; both device requirements are satisfied only by the 54-item Pixel 7 batch (27 in `milestones/v1.4-phases/34-combat-screen-rebuild/34-VERIFICATION.md`, 27 in `…/35-map-screen-rebuild/35-VERIFICATION.md`) against the versionCode-3 debug APK installed 2026-09-16 22:54. Findings become a quick task or the next milestone.
- **Climb dice payload** — `fellClimbing`/`fellInGorge`/`climbedOver`/`leaptOver` carry no `roll`/`need`; the rail shows climb outcomes without a dice line. Additive, parity-safe engine change queued as a quick task after UAT (`rail.js#rollLineFor` already renders it).
- **⧗ crevice glyph** may render as tofu on the Pixel 7 — UAT item; one-line swap in `src/browser/mapMarks.js` if so.
- Known verification overrides: 2 (CSCR-10, MAP-10 — see STATE.md Deferred Items). Stale quick-task records (rules-text-audit-pass, product rename) re-acknowledged — both shipped long ago.

---

## v1.3 Feel, Loot & Combat Flow (Shipped: 2026-09-16)

**Closeout type:** autonomous run, on-device UAT deferred to the end (50 Pixel 7 checks batched; CMBUI-06 DR round pending on the installed build)
**Phases:** 6 (28 Armor · 29 Loot & bag cap · 30 Combat-narrative research · 31 Combat start gating & effect hygiene · 32 Round Card build · 33 UI feel & store) · **Plans:** 16 · **Tasks:** 44
**Timeline:** 2026-09-15 → 2026-09-16 (2 days, 104 commits, 140 files, +21.9k lines)
**Tests:** 1448 → 1955 green; parity master untouched since v1.2; zero fixture regenerations (three declared action-path divergences for the deliberate Afraid rules change; the new `lose-plain` scenario restores death-path coverage)
**Requirements:** 28 complete · UIF-04 dropped (tutorial UI unwired → UX-06) · CMBUI-06 deferred to the device round

**Key accomplishments:**

1. **Armor that tells the truth** — durability rides the bag item (the unequip→re-equip full-repair exploit is dead), destroyed armor is gone, the four soak outcomes are distinct on screen, one `armorDisplay` formatter behind every armor string (the HUD line was the real bug), Cloak of Armor = never-wearing plate for any carrier.
2. **End-of-combat loot as a decision** — serialized `pendingLoot` pile, one loot card with per-drop Equip/Stow/Leave + compare-to-equipped, a single `stowItem` bag-cap gate on every path (store pays only after a successful stow), bigger bags as depth-tiered treasure, honest forfeit on flight/death.
3. **Combat starts on Fight!** — the `fight` action owns initiative/phobia/pre-emptive strike; every refusal explains itself (`docs/USABLE-FEATURES-AUDIT.md` + a 150-row doc-synced test); buff potions from Gear; Shield/Acuteness/Afraid chips with honest expiry; Amulet of Stone closes the encounter with full payout.
4. **Rules rulings from the roll-direction audit** — phobia is now an *Afraid* penalty (need −3 on the LOW-range to-hit, half damage, 2 rounds), never a lost action; Elven `foeToHit` inversion flipped to "easier to hit"; the sheet's TO HIT reads `1–N`.
5. **The Round Card** — surveyed six patterns, ratified one, built it: an uncapped always-visible round block below the foe roster (post-dispatch routing in `dispatchWithToasts`, refusals stay toasts, Oracle untouched), `inputGuards.js` 250 ms arm/settle `Date.now()` guards on 24 decision-button sites and `window.move`; worst-case round measured at 6 lines.
6. **Feel & store polish** — Use/Drop gear rows with an inline two-tap confirm, Make Camp in the Marks/Centre strip (handedness removed), map recenters at every panel-close choke point + pinch release, default zoom 1.5, depth-rolled store stock behind the `storeRoll` run flag (fixtures, bots and old saves untouched).

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| CMBUI-06 | On-device DR round of the Round Card not yet run — build installed on the Pixel 7, checklist in the end-of-run UAT batch | Immediately after this closeout (UAT batch) |
| UIF-04 | Tutorial on/off setting — nothing to toggle until the coach-mark sequencer is wired | UX-06 (v1.0 launch tail) |
| — | 32-03 unguarded button set (store rows, drop shelf, `a-evt`, `btn-again`, spell menu) + haptics on hit/kill | future feel pass |
| — | `storeRoll` off for tools/ bots — ledgers unchanged by the rolled store | next tuning pass |

**Archived:** `milestones/v1.3-ROADMAP.md`, `milestones/v1.3-REQUIREMENTS.md`, `milestones/v1.3-MILESTONE-AUDIT.md`, `milestones/v1.3-phases/`

## v1.2 Class Pass & Mass Playtest (Shipped: 2026-09-15)

**Phases completed:** 7 phases (22–27 + inserted 25.1), 31 plans, 85 tasks · 161 commits, 2026-09-14 → 2026-09-15 · tests 951 → 1448 · parity 33/33 byte-identical with declared, machine-checked divergences (chargen seeds 15/24 grimoire top-up; combat/lose seed 14 Fridgian; economy seed 3 Pickpocket markup; combat/parley seed 303 Dante → Ned) · closed on a user-recorded TUNE-07 deferral (DR round carried forward)

**Key accomplishments:**

1. **Class-aware playtest harness** — dev-only `force` chargen seam, sub-class-aware bot (`chooseSpell` scoring table, talk-first openers, stuck bucket), `tools/tune-classes.mjs` 143-cell class × race matrix on worker threads, `tools/class-pass-diff.mjs` fun-band diff with a cannot-act hard gate; BEFORE and AFTER matrices captured at identical parameters (5,720 + 1,430 runs each) and ledgered in `docs/CLASS-PASS.md`.
2. **Casters can act** — a Wizard refuses melee only while an attack spell is castable and names it; every non-Summoner Magic User rolls a day-one attack spell (zero new draws); Summon level 2, Phantom Host level 1; Freeze kills now pay out through `killFoe`. Magic User mean kills doubled (2.41 → 4.99); all eight caster sub-classes landed in the fun band.
3. **Every sub-class and race has one good and one bad** — 11 sub-class mechanics + a 3-race pass (Knight/Court Mage never-first, Court Mage boredom 1-in-6, Ninja/MoA never parley, Guard −1, Cloaker unseen-only, Fridgian hide/frenzy, Dwarven half armour wear, Pickpocket markup, Woodsman armour gate, Pilfer heal-only, Bard camp wake, Cutthroat/Wilmsry Joiner refusals), all zero-draw, all narrated, all blurbs truthful, proven by a 70-test identity contract. Human stays neutral.
4. **Nothing happens silently** — a pure `toasts.js` table exactly partitioning all 209 engine event types (189 toasts ⊎ 21 Oracle-only), red-for-them/green-for-you tone families plus amber refusals, "K of M" multi-attack aggregation, level-1 miss quips, additive event payload for every passive modifier, one `dispatchWithToasts` seam; then the device batch: the "Move on" card only for decisions/big updates, narrative toasts that linger and tap away, the Oracle filling the screen and opening at the newest line, Joiner swap with snark, party members fighting by class, Make Camp refusing with the numbers.
5. **Mass playtest verdicts** — μ 3.08, bands 2.31–4.15: 29 of 30 sub-class/race rows in band, Ninja too strong and accepted (the opener is the identity), Wilmsry in band after the Joiner refusal, revisit list empty; the hard gate caught a pre-existing stranded-combat bug (foe killed by ward reflect on its opening turn) and it was fixed as a gap closure.
6. **Delve-to-death retune toward the depth-20 unicorn** — band agreed over three user rounds and recorded first; the game is now canon through depth 20 (`COMBAT_SCALE_FROM_DEPTH` 21) with a gentle ramp past it, foe grace ×0.5 at floors 2–4, encounter density cap 13, darkness held through floor 3, trap/fall ×0.5 from floor 2, and Dante demoted to tier 2 (Ned holds floor 1). AFTER: bot median 4 (from 3), reach-5 30.6 % (from 17 %), forced-20 3.17 fights survived (from 1.3) — in band; forced-20 floors gained (0.84, p50 0) and reach-20 (0.1 %) recorded as misses that only canon tier-3/5 rosters could close.

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| TUNE-07 | Human DR round (forced 20/35/50 + natural) not played — user away from the Pixel 7; verdict **deferred** with reason recorded in `docs/DIFFICULTY-RETUNE.md` | Next tuning pass, after the user's next milestone of fixes |
| TUNE-06 (two band rows) | Forced-20 floors gained p50 0 / mean 0.84 (target ≥ 1 / 1–2); reach ≥ 20 0.1 % (target 1–2 %) — residual lethality is canon tier-3/5 combat (Herman, Drarl, Vampire, Djinni); untaken rungs (rations +2, hazard from floor 1, darkness from 4, floor-1 grace, grace ×0.35) recorded with calibration numbers | Needs a roster decision; next tuning pass |
| Play internal upload | Last uploaded build is versionCode 3 (pre-25.1); 25.1 + the retune are not yet on the internal track | Offer a versionCode-4 signed AAB when the user is back with the phone |
| v1.3 candidates | Feedback, Feel & Polish remainder (inventory integrity incl. buy-then-reject gold loss, UI layout, combat-start gating, store stock), narrative-toast case/wrap on device, `mazeworld.html` `/*`-in-`//` comment cleanup, GSD state tools not resolving decimal phase numbers | `.planning/proposed-milestone-feedback-feel-polish.md` / next milestone |

**Archived:** `milestones/v1.2-ROADMAP.md`, `milestones/v1.2-REQUIREMENTS.md`, `milestones/v1.2-phases/`

---

## v1.1 Monster Balancing & Abilities (Shipped: 2026-09-14)

**Phases completed:** 5 phases (17–21), 21 plans, 50 tasks · 82 commits, 2026-09-13 → 2026-09-14 · tests 683 → 951 · parity 30/30 byte-identical with ONE documented deliberate divergence (seed-303 parley scenario, scenario-scoped carve-out)

**Closeout:** override closeout — Known verification overrides: 1 (TUNE-04 human DR sign-off: verdict tune-again at depth 20; retune deferred by the user to a later milestone after cleanup + class fixes). Two v1.0-era quick-task stubs re-acknowledged. See STATE.md Deferred Items.

**Key accomplishments:**

- **Foes fight back with magic** — a pure-data ability registry (19 descriptors) + `engine/foeAbilities.js` resolver: bolts, drains, debuffs, heals, summons, Spectre pursuit, Djinni low-HP flee, all narrated; the player's Intelligence resists via one shared `resistRoll` (symmetric with the canon foe rule).
- **Bestiary rebalanced on a yardstick** — `engine/foeDamage.js#damageFoe` is the single damage-to-foe seam (natural armor, Sterling halving, damage-type multipliers, Philly slow); nine outlier rows retuned with a committed before/after ledger (`content/BESTIARY-REBALANCE.md`).
- **Parley is a decision, not a spam button** — one attempt per encounter with insulted aggro on failure, Con Artist retuned (+6→+4, need ≤17), payout structurally ≤ half a kill, Humans wilmst bonus on a 6 only; Language is a fluency system (skill + Helm of Knowledge) feeding the same bonus term (`docs/PARLEY-REBALANCE.md`).
- **Depth finally scales** — `engine/difficulty.js` owns foe count / foe power / ability cadence past floor 5 (identity ≤ 5), a smarter tuning bot with reach/ability readouts, and a hidden dev start-at-depth toggle for deep testing (`docs/DIFFICULTY-RETUNE.md`).
- **Parity discipline held under real rule changes** — fixture inventory, RNG draw-count pins, determinism suites for caster encounters, and the frozen prototype master never touched.

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`, `.planning/milestones/v1.1-phases/`

## v1.0 Delve, Die, Repeat — Android build & internal testing (Shipped: 2026-09-13)

**Closeout type:** override_closeout (known verification overrides: 5 — see STATE.md Deferred Items)
**Phases:** 17 (1–6 core, 04.1/04.2 inserted, 7–11 Joiners, 12–16 Economy) · **Plans:** 37 + ~20 device-review rounds (DR1–DR18) · **Tasks:** 81
**Timeline:** 2026-09-07 → 2026-09-13 (7 days, 248 commits, 409 files, +60.7k lines)
**Tests:** 683/683 green; parity suite byte-identical to the frozen 1994-rulebook prototype master throughout
**Delivered:** the 1994 tabletop prototype (`mazeworld.html`) extracted into a pure, deterministic, serializable `applyAction` engine, wrapped as a native Android app, converted to endless descent, rebuilt with a mobile "torch-lit ledger" UX, given a party system and a real economy, voiced, and shipped to a Google Play **internal-testing track** with real testers.

**Key accomplishments:**

1. **Engine extraction with zero regressions** — every rule domain (chargen, maze gen, movement, combat, magic, economy, encounters, death) behind one pure `applyAction(state, action) → {state, events}` seam over a seeded mulberry32 RNG; a frozen node:vm golden master proves byte-identical parity on every commit.
2. **Native Android shell** — Capacitor 8 wrap with durable `@capacitor/preferences` autosave, back-button/lifecycle handling, self-hosted fonts (fully offline), splash/status-bar/icon chrome, haptics; signed CLI release pipeline (`npm run play:release`).
3. **Endless descent** — the fixed 5-floor Gate replaced by a bounded soft-cap difficulty curve with a headless tuning harness; one-tap new-run loop, best-depth tracking, permadeath graveyard.
4. **Mobile UX rebuilt on the Claude Design mock** — D-pad movement on a pannable/zoomable fog-lit canvas with the 9 provided PNG icons, HUD + unified condition tracker, toast combat feedback, victory report, Fight! gate, character sheet/Grimoire, Oracle log, settings sheet; 18 on-device review rounds on the Pixel 7.
5. **Rules fidelity sweep (04.1/04.2)** — every character-sheet stat now affects play (all 10 phobias, Intelligence, Sewing/Master of Arms), rations as rations, XP/HP terminology, a dozen live bugs fixed, and a family-friendly safety-scan guardrail over all procedural copy.
6. **Joiners + Economy systems** — a serialized, damageable NPC party (accept/decline recruitment, auto-acting member, XP split, party rail) and a real loot economy (class bags, take/leave/drop/equip, store sells all gear, 9 inert items wired, conservative reward tuning) — all parity-safe for solo play.

### Known Gaps (carried forward)

| Req | Gap | Where it lands |
|-----|-----|----------------|
| UX-06 | First-run coach-mark tutorial (04-10) not built — deliberately deferred by the user until the UI settles | v1.0 launch tail (after Monster Balancing) |
| STR-01..04, STR-06 | Production launch: Data Safety / IARC / privacy policy / paid config / listing completeness not yet audited from the repo side; store entry exists and testers are live | v1.0 launch tail — user-driven, with a repo-side SDK/dependency audit |
| PARTY-10 (+ ECON deep tuning, Phase 3 feel-tuning) | The ONE consolidated difficulty retune across party power, economy, and monster power | Monster Balancing milestone |
| Phases 1–3 | `VERIFICATION.md` status `human_needed` — accepted on the strength of DR1–DR18 on-device play + internal testers | — |

**Archived:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-phases/` (all phase dirs incl. `dr17-encounter-ux/`)
