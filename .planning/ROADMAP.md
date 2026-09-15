# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/MILESTONES.md`)
- ✅ **v1.1 Monster Balancing & Abilities** — Phases 17–21 (shipped 2026-09-14, override closeout; see `.planning/milestones/v1.1-ROADMAP.md`)
- ✅ **v1.2 Class Pass & Mass Playtest** — Phases 22–27 + 25.1 (shipped 2026-09-15; closeout on a user-recorded TUNE-07 deferral — DR round carried forward; see `.planning/milestones/v1.2-ROADMAP.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (04-10 / UX-06) + Google Play production launch (STR-01..04, STR-06); deferred by user until after v1.1

## Engine Gate (non-negotiable, every phase — established in v1.1)

Every phase in this milestone touches combat RNG and/or the bestiary the frozen prototype embeds its own copy of. The gate, carried from `STATE.md`:

- Engine stays pure/deterministic.
- Parity stays byte-identical for solo/empty-party play against the frozen `test/parity/prototype-master.js.txt`.
- New RNG draws fire only behind new-feature guards (e.g. a new `abilities` field) — never unconditionally.
- Every new serialized field (per-foe ability state, foe-inflicted player effects, summoned foes) is carved out in all three `*Comparable()` functions (`test/parity/harness/comparables.js`) and round-trips through save/load.
- `test/parity/prototype-master.js.txt` is NEVER edited.
- Every new event type gets an `EVENT_NARRATION` entry (coverage-guard stays green, family-friendly voice-safety scan stays green).
- Deliberate divergences from the prototype (bestiary numbers, parley formula) regenerate only their specific fixtures, each with a documented before/after table and rationale — never a blanket fixture regeneration.

## Phases

<details>
<summary>✅ v1.0 Delve, Die, Repeat (Phases 1–16 + 04.1/04.2) — SHIPPED 2026-09-13 (internal testing)</summary>

Full details: `.planning/milestones/v1.0-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.0-phases/`.

- [x] Phase 1: Engine Extraction & Determinism (10/10 plans) — completed 2026-09-08
- [x] Phase 2: Android Packaging & Native Persistence (4/4 plans) — completed 2026-09-08
- [x] Phase 3: Endless Descent & Difficulty Balance (3/3 plans) — completed 2026-09-08
- [x] Phase 4: Mobile Presentation, Controls & Onboarding (10/11 plans + DR1–DR18) — 04-10 tutorial carried forward (UX-06)
- [x] Phase 04.1: Rules Review & Wiring (6/6 plans) — completed 2026-09-09
- [x] Phase 04.2: Bug Fixes & Text Polish (5 batches) — completed 2026-09-09
- [x] Phase 5: Voice, Content & Graveyard (3/3) — completed 2026-09-09
- [~] Phase 6: Google Play Compliance & Launch — store entry + internal-testing track live 2026-09-10 (STR-05 ✓); production launch carried forward (STR-01..04, STR-06)
- [x] Phases 7–11: Joiners / Party System — completed 2026-09-09 (PARTY-10 retune carried forward)
- [x] Phases 12–16: Economy & Item Balancing — completed 2026-09-10 (deep tuning carried forward)

</details>

<details>
<summary>✅ v1.1 Monster Balancing & Abilities (Phases 17–21) — SHIPPED 2026-09-14 (override closeout: TUNE-04 retune deferred)</summary>

Full details: `.planning/milestones/v1.1-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.1-phases/`.

- [x] **Phase 17: Fixture Inventory & Foe-Turn Refactors** - Document which bestiary creatures each parity fixture rolls and extract shared foe-turn helpers before any bestiary or ability behavior changes land (completed 2026-09-13)
- [x] **Phase 18: Bestiary Rebalance & Canon Combat Fixes** - Review every creature's stats against its intended depth band and land canon-accurate combat modifiers (armor, half-damage, type multipliers, slow) (completed 2026-09-13)
- [x] **Phase 19: Foe Abilities, Spellcasting & Symmetric INT Resistance** - Foes cast, drain, debuff, heal, and summon via a data-driven ability system; the player's Intelligence resists incoming foe magic (completed 2026-09-14)
- [x] **Phase 20: Parley Balance & Language System** - Fix parley's payout/spam dominance and wire Language/Helm-of-Knowledge fluency into the same bonus term (completed 2026-09-14)
- [x] **Phase 21: Consolidated Difficulty Retune** - The ONE retune across party power, economy, monster power, ability threat, and parley numbers, closed out by a human DR-round sign-off (completed 2026-09-14)

</details>

<details>
<summary>✅ v1.2 Class Pass & Mass Playtest (Phases 22–27 + 25.1) — SHIPPED 2026-09-15 (closeout: TUNE-07 deferred by the user, DR round carried forward)</summary>

Full details: `.planning/milestones/v1.2-ROADMAP.md`. Phase artifacts: `.planning/milestones/v1.2-phases/`.

- [x] **Phase 22: Class-Aware Harness & BEFORE Matrix** - Force any class/sub-class/race through the bot with a sub-class-aware policy, print a ranked 144-combo matrix, and capture the BEFORE snapshot before any identity change lands (completed 2026-09-14)
- [x] **Phase 23: Casters Can Act (Wizard/Summoner/Illusionist + Guaranteed Attack Spell)** - Fix the three "cannot act" states and guarantee every fresh Magic User a day-one attack spell (completed 2026-09-14)
- [x] **Phase 24: Every Sub-class and Race: One Good, One Bad** - Every sub-class and race gets a code-verified good and bad, flavor text matches the mechanics, and an identity-contract test proves it (completed 2026-09-14)
- [x] **Phase 25: Nothing Happens Silently (Feature Feedback)** - Every class/sub-class/racial feature that fires or blocks is narrated in the Oracle and as a toast; enemy hits are unmistakable from player hits/misses (completed 2026-09-15)
- [x] **Phase 25.1: Device Feedback Batch (INSERTED 2026-09-15)** - Card only for decisions/big updates, minor events toast-only with the narrative sentence, readable toasts, Oracle fills the screen and opens at the newest line, Joiner swap with snark, Joiners fight by class, camp refusal states the numbers (completed 2026-09-15)
- [x] **Phase 26: Mass Playtest & Class-Pass Ledger** - An AFTER matrix on the post-pass engine ranks over/under-performers with a fun-band verdict per row, committed to `docs/CLASS-PASS.md` (completed 2026-09-15)
- [x] **Phase 27: Delve-to-Death Retune** - The deferred TUNE-04 re-attempt on the corrected player power, closed by a human DR round on the Pixel 7 (completed 2026-09-15)

</details>

## Phase Details

<details>
<summary>v1.0 phase details (Phases 1–16 + 04.1/04.2) — archived, see `.planning/milestones/v1.0-ROADMAP.md`</summary>

Full phase-by-phase goals, requirements, and success criteria for v1.0 live in the archived roadmap, not duplicated here.

</details>

<details>
<summary>v1.1 phase details (17–21) — archived</summary>

See `.planning/milestones/v1.1-ROADMAP.md`.

</details>

<details>
<summary>v1.2 phase details (22–27 + 25.1) — archived</summary>

See `.planning/milestones/v1.2-ROADMAP.md`.

</details>

## Carried-forward work (not yet phases)

| Item | Origin | Notes |
|------|--------|-------|
| First-run tutorial (04-10, UX-06) | Phase 4 | Plan exists in `milestones/v1.0-phases/04-.../04-10-PLAN.md` (stale vs. the DR-era UI — re-plan). Build LAST, once the UI settles — after v1.1/v1.2. |
| Production launch (Phase 6 tail) | Phase 6 | Repo-side: dependency/SDK audit for Data Safety, privacy-policy page, listing copy/screenshots, `versionCode` bump + `npm run play:release`. Console-side (user): Data Safety form, IARC, paid pricing, production rollout. See `docs/RELEASING.md`. Deferred until after v1.1/v1.2. |

Notes: PARTY-10 / ECON deep tuning / Phase 3 feel-tuning landed in Phase 21 (v1.1). DR15-A "Language as a system" landed in Phase 20 (v1.1). DR16-G "N squares of opponents" is tracked as `UI-V2-03` in `.planning/REQUIREMENTS.md` v2 Requirements (backlog). TUNE-04's deferred retune landed as Phase 27 of v1.2 (constants shipped; the human DR verdict was deferred again by the user on 2026-09-15 — checklist in `docs/DIFFICULTY-RETUNE.md`). The "Feedback, Feel & Polish" remainder (inventory integrity, UI layout, combat-start gating, store stock) is parked for a v1.3 candidate milestone — see `.planning/proposed-milestone-feedback-feel-polish.md`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| 17–21 | v1.1 | 21/21 | Shipped (override closeout: TUNE-04 retune deferred) | 2026-09-14 |
| 22. Class-Aware Harness & BEFORE Matrix | v1.2 | 4/4 | Complete    | 2026-09-14 |
| 23. Casters Can Act | v1.2 | 4/4 | Complete    | 2026-09-14 |
| 24. Every Sub-class and Race: One Good, One Bad | v1.2 | 7/7 | Complete    | 2026-09-14 |
| 25. Nothing Happens Silently (Feature Feedback) | v1.2 | 5/5 | Complete    | 2026-09-15 |
| 25.1. Device Feedback Batch (inserted) | v1.2 | 3/3 | Complete    | 2026-09-15 |
| 26. Mass Playtest & Class-Pass Ledger | v1.2 | 4/4 | Complete    | 2026-09-15 |
| 27. Delve-to-Death Retune | v1.2 | 4/4 | Complete (DR verdict deferred by user) | 2026-09-15 |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user until after v1.1/v1.2 | - |
