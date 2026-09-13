# Roadmap: Delve, Die, Repeat

## Milestones

- ✅ **v1.0 Delve, Die, Repeat — Android build & internal testing** — Phases 1–16 (shipped 2026-09-13, override closeout; see `.planning/MILESTONES.md`)
- 📋 **Next: Monster Balancing & Abilities** — to be stood up via `/gsd-new-milestone` (spec: `.planning/proposed-milestone-monster-balancing.md`)
- 📋 **v1.0 launch tail** — first-run tutorial (04-10 / UX-06) + Google Play production launch (STR-01..04, STR-06); deferred by user until after Monster Balancing

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

## Carried-forward work (not yet phases)

| Item | Origin | Notes |
|------|--------|-------|
| Monster Balancing & Abilities milestone | proposed 2026-09-09 | RESEARCH-FIRST: foe abilities/spellcasting (deterministic, parity-gated), bestiary rebalance, parley balance pass, symmetric INT resistance, and the ONE consolidated `engine/difficulty.js` retune covering Joiners (PARTY-10) + Economy deep tuning + Phase 3 feel-tuning. Spec: `.planning/proposed-milestone-monster-balancing.md` |
| First-run tutorial (04-10, UX-06) | Phase 4 | Plan exists in `milestones/v1.0-phases/04-.../04-10-PLAN.md` (stale vs. the DR-era UI — re-plan). Build LAST, once the UI settles. |
| Production launch (Phase 6 tail) | Phase 6 | Repo-side: dependency/SDK audit for Data Safety, privacy-policy page, listing copy/screenshots, `versionCode` bump + `npm run play:release`. Console-side (user): Data Safety form, IARC, paid pricing, production rollout. See `docs/RELEASING.md`. |
| DR15-A "Language as a system" | DR15 backlog | Helm wiring done (P15); the wider design (who can parley, how well) belongs with the parley balance pass. |
| DR16-G "N squares of opponents" | DR16 backlog | Amulet of Stone wired (P15, 1 square = 1 foe simplification); revisit only if Monster Balancing changes the foe model. |

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–16 (+04.1, 04.2) | v1.0 | 37/38 + 18 DR rounds | Shipped (override closeout) | 2026-09-13 |
| Monster Balancing | next | — | Not started — run `/gsd-new-milestone` | — |
| Tutorial + production launch | v1.0 tail | 0/2 | Deferred by user | — |
