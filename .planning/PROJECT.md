# Mazeworld

## What This Is

Mazeworld is a premium (paid-upfront), fully-offline mobile roguelike dungeon-crawler for iOS and Android, adapting a fantasy tabletop RPG the author designed in 1994. Players generate a randomly-rolled adventurer and descend an ever-deeper procedurally-generated maze — fighting monsters, casting spells, looting treasure, and surviving traps and starvation — until permadeath ends the run and they chase a higher depth/score on the next one. It's for players who love crunchy, dice-driven dungeon crawls and the comedic, "play-the-hand-you're-dealt" spirit of the original game.

## Core Value

**The dungeon crawl** — the tension and discovery of descending into the unknown. If everything else is stripped away, walking deeper into a dangerous, uncertain maze must feel great.

## Business Context

- **Customer**: Solo mobile players who like roguelikes / dungeon crawlers; plus the author's nostalgia audience for the original tabletop game.
- **Revenue model**: One-time paid purchase on the App Store and Google Play (no ads, no IAP in v1).
- **Success metric**: Successful launch on both stores + players completing and repeating runs (depth-chasing retention).
- **Strategy notes**: MVP is solo-only. "Play with friends" multiplayer is a deliberate post-MVP add-on that wraps the same rules engine.

## Requirements

### Validated

(None yet — ship to validate. Note: an extensive **web prototype** already implements the full solo ruleset and is treated as the authoritative design spec, but nothing has shipped to a store, so nothing is validated in-market yet.)

### Active

- [ ] Package the game as a native, store-installable app for **both iOS and Android**
- [ ] Preserve the prototype's **full ruleset** as canon (3 classes / 24 subclasses / 6 races / 31 spells / ~45 creatures / dozens of items / combat / magic / economy / procedural mazes)
- [ ] **100%-dice-rolled character creation** — no player choices (faithful to the game's identity)
- [ ] **Endless descent** — infinite floors with scaling difficulty, replacing the prototype's fixed 5-floor Gate ending
- [ ] **Permadeath** ends a run; player starts fresh
- [ ] **Local high-score / depth chase** as the primary replay hook (no server)
- [ ] **Quick 5–10 minute** session feel on a phone
- [ ] **Fully offline** — no accounts, no servers, no network dependency
- [ ] Adapt the **Claude Design "Mazeworld Mobile" UX** as the visual/UX target
- [ ] Mobile-first controls, readable UI, and player **onboarding/tutorial** (the prototype assumes rules knowledge)
- [ ] **Robust local save/resume** and persistent graveyard of past runs
- [ ] **Publish to both stores** (store listings, signing, submission) — the project isn't done until it's live

### Out of Scope

- **Multiplayer / "play with friends"** — explicitly deferred to a post-MVP add-on; MVP is solo-only.
- **Accounts, logins, cloud save, servers** — go simple; use platform identity (Game Center / Google Play Games) later if/when multiplayer needs it.
- **Ads and in-app purchases** — v1 is paid-upfront only.
- **Player-authored / Maze-Master / party layer from the tabletop rules** — the prototype already stubs these out for solo play; not revived for v1.
- **Original illustrated art / voiced audio as a hard requirement** — the prototype's procedural/typographic aesthetic is a viable shipping style; richer art/audio is a nice-to-have, not a gate.

## Context

- **Source materials** (kept in-repo as reference, not deleted):
  - `mazeworld.html` — a ~3,300-line, single-file, **zero-dependency vanilla-JS** prototype (DOM + `<canvas>`, `localStorage` save). It is a **complete, proven solo implementation** of the ruleset and is the authoritative behavioral spec. Key seams already present: a single global `S` state object, an `act()`/"beats" action system, and a responsive 1080px mobile reflow with a touch D-pad and one-beat-at-a-time stepping.
  - `mazeworld.pdf` — the original 1994 rulebook (~3,700 lines of text). Old and untested; **superseded by the prototype** wherever they conflict. Valuable for lore (the god Felect, The Planes, the Wilmsry, the year-792 cataclysm) and for dropped systems that could be ported later (bag/carry-weight, shields, thrown weapons, richer phobia/language tables).
- **Prototype rules that supersede the rulebook** (already decided in-prototype): solo conversion (no party/Maze Master), invented natural healing (`sleep = d10 + 2×level`), skill points ×5 for solo pacing, Magic Users start `25 + d10` WP, loot ÷10, and several book-ambiguity rulings the prototype formalized.
- **Author is new to mobile development** — the roadmap should make "where we start" explicit and de-risk the platform/packaging path first.
- **The heavy lift is platform + presentation + endless-mode conversion**, not rebuilding game logic. Whatever tech path is chosen (e.g. wrapping the existing web game vs. porting to an engine) must keep the rules engine decoupled and state serializable to protect the multiplayer future.

## Constraints

- **Platforms**: Must ship to **Apple App Store and Google Play**. Requires native packaging, code signing, store listings, and compliance (age rating, privacy) — new territory for the author.
- **Offline**: v1 must run with **no network**, no accounts, no backend.
- **Monetization**: **Paid upfront**, no ads/IAP — keep the build free of monetization SDKs.
- **Fidelity**: The prototype's rules are **canon**; deviations must be deliberate design decisions, not accidental regressions.
- **Rules engine**: Must remain **decoupled from UI and fully serializable** (multiplayer-ready), mirroring the prototype's existing `S`-state / `act()` design.
- **Performance / feel**: Must feel responsive and native-quality on mid-range phones; sessions target **5–10 minutes**.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Solo-only MVP; multiplayer post-MVP add-on | Ship value fast; multiplayer is a large, separable layer | — Pending |
| Endless descent replaces fixed 5-floor Gate | "Descend forever + chase depth" fits roguelike + quick sessions | — Pending |
| Permadeath, no meta-progression in v1 | Author chose pure roguelike; local high-score is the hook | — Pending |
| 100%-dice-rolled characters, no player choice | Faithful to the game's comedic identity | — Pending |
| Fully offline, no accounts; platform identity later | Simplest path to ship; protects multiplayer future cheaply | — Pending |
| Paid-upfront, no ads/IAP | Author's chosen model; keeps build clean | — Pending |
| Prototype is canon over the rulebook | Prototype is tested/playable; rulebook is old and untested | — Pending |
| Keep rules engine decoupled + state serializable | Enables post-MVP multiplayer without a rewrite | — Pending |
| Tech/packaging path (wrap web game vs. engine port) | High-leverage; de-risk first | — To be researched in Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-07 after initialization*
