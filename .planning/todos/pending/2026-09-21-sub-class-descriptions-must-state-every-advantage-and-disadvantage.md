---
created: 2026-09-21T20:59:00.000Z
title: Sub-class descriptions must state every advantage and disadvantage
area: content
resolves_phase: 79
files:
  - content/flavor.js:39 (SUB_NOTE — the per-sub blurbs shown on the roller / Hero tab)
  - content/flavor.js:64 (Summoner blurb — never mentions the offense school opening at level 3)
  - content/mu-chart.js:9-40 (MU_CHART — per-sub school bonuses and `gate` levels: the source of truth for MU good/bad)
  - engine/derived.js:1418-1426 (schoolGate / schoolBonus readers)
  - content/spell-level-overrides.js (per-sub effective spell levels)
---

## Problem

Reported on the Pixel 7 (2026-09-21), user's words: "summoner description doesn't mention that they don't get spells till 3. All sub class descriptions need to clearly tell their advantages/disadvantages."

The Summoner's `SUB_NOTE` sells the summon bonus and the 1-in-8 backfire but not the rule that actually shaped the user's run — `gate: { offense: 3 }` (no offense spells before level 3). The v1.2 Phase 24 "one good, one bad" pass gave every race/sub a mechanical identity; the blurbs were written for voice and don't consistently list both sides, and the MU chart's school gates/bonuses (the mechanical facts) are not surfaced anywhere player-facing.

## Solution

Audit every `SUB_NOTE` (all 8 MU subs, the Fighter and Thief subs) and every `RACE_NOTE` against the rules they map to (`MU_CHART` bonuses + gates, `spell-level-overrides.js`, the Phase 24 IDENT-05..10 table in the archived v1.2 ROADMAP / `docs/CLASS-PASS.md`): each blurb keeps its sarcastic voice but must name every advantage AND every disadvantage in plain terms (e.g. Summoner: "…and not one offense spell until level 3"). Consider a compact mechanical footer under the blurb generated FROM the chart (bonuses/gates) so prose and rules can't drift — a unit test that every sub with a `gate` mentions its level in the note. Content/doc task; no engine change; the roller-screen reel text and Hero tab both read `SUB_NOTE`. Pixel 7 check: roll each MU sub and read the note; the Summoner's names the level-3 offense gate.
