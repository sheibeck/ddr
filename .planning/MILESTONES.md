# Milestones

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
