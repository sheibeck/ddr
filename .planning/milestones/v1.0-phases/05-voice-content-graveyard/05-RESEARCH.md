# Phase 5: Voice, Content & Graveyard - Research

**Researched:** 2026-09-08
**Domain:** Data-driven procedural narrative-copy generation (event -> sarcastic prose), dependency-free content-safety QA, local persisted run-history UI
**Confidence:** MEDIUM-HIGH (architecture/pitfalls are HIGH — verified directly against this repo's code; wordlist sourcing/sample-size guidance is MEDIUM — cross-checked externally but requires a license/content re-check at implementation time)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Voice generator (VOX-01)**
- A PURE module (e.g. `content/voice.js` / `src/voice/…`) exposing something like `narrate(event, ctx) → string` and `epitaphFor(deathCtx) → string`, seeded/deterministic where randomness is used (reuse the engine RNG or an injected rng so log lines are reproducible in a seeded run — matches Phase 1 determinism ethos; the parity/round-trip suites must stay green).
- Keyed on structured fields: death `cause`, `class`, `subclass`, `race`, `depth`, item name/kind, encounter type, event type. Data tables map (key combinations) → weighted copy variants. Build on the existing `content/epitaphs.js` (~15 causes) + `content/flavor.js`; expand coverage to the engine's full event-type set (~26 types from `engine/events.js`).
- The engine stays UI-free and emits STRUCTURED events (unchanged); the voice system lives in the PRESENTATION/content layer and turns events → prose (it is the "one place structured Events become sarcastic narrative copy" from the architecture). No DOM inside the generator (pure string-returning); the browser adapter/`formatEvents` calls it.

**Tone & safety (VOX-02)**
- Tone: heavy sarcasm, dark humor, deadpan, self-aware, pokes fun at fantasy-RPG tropes and the player's doomed characters — but family-friendly: NO profanity, NO gore/graphic violence, NO sexual/adult content, NO slurs. Darkness is in the wit, not shock. Document as a tone/style guide (drives both authored variants and the safety scan).
- Safety QA: an automated batch generator enumerates a large representative sample of event→copy combinations; a `node:test` safety scan asserts NONE contain banned terms (a maintained profanity/gore/slur/adult wordlist + simple rules). Write the sample corpus to a reviewable artifact for the human tone/funny check (deferred UAT).

**Graveyard/run-history (VOX-03)**
- Data source: the engine's death/graveyard system (`engine/death.js` bury/tombstone — recording ALL death causes per the Phase 3 fix) persisted via Phase 2 `window.mzStorage` (`mazeworld.graveyard.v1`, native Preferences). No new persistence work — reuse it.
- Screen: wire the existing prototype graveyard panel to show past adventurers (name, class/race, cause, depth, epitaph from the voice system). Openable, persists across restarts. Keep it functional; Phase 4 polishes mobile presentation.

### Claude's Discretion
- Exact module layout/API of the voice generator, the weighting/variant scheme, the wordlist source, and how the graveyard panel is surfaced in the existing prototype UI.

### Deferred Ideas (OUT OF SCOPE)
- Human tone/quality check ("is it actually funny and on-brand across a big sample?") — UAT, deferred to milestone end (the safety scan is automated; funny is human).
- Polished mobile presentation of the graveyard/log — Phase 4.
- Shareable run-summary card — v2 (META-02, anti-scope for v1).
- Full-domain engine routing + `formatEvents` mobile-UI integration — Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOX-01 | A data-driven voice system generates sarcastic, dark-but-family-friendly copy (death epitaphs, event/Oracle log lines, item flavor) keyed to structured game events (death cause, class/race, depth) | Architecture Patterns (category-keyed generator design), Code Examples (fillTemplate/rng.pick precedent), Pitfall 1 (RNG-state isolation) |
| VOX-02 | A batch tone/rating QA pass validates procedural flavor-text combinations stay family-friendly (no profanity/gore) before rating is finalized | Package Legitimacy Audit + Don't Hand-Roll (wordlist sourcing), Common Pitfalls 2/4/5 (Scunthorpe, combinatorics, sample strategy), Validation Architecture |
| VOX-03 | The player can review a graveyard/run-history screen showing past adventurers and their epitaphs | Architecture Patterns (graveyard wiring plan), Pitfall 6 (stale in-memory graveyard), Validation Architecture |
</phase_requirements>

## Summary

The engine already proves the exact pattern this phase needs to scale: `engine/death.js#epitaphFor` picks a weighted string from a bank via an injected `rng.pick()` and fills `{token}` placeholders with a regex substitution (`fillTemplate`). That pattern is correct, already tested, already parity-safe, and should **not** be touched. Phase 5's job is to generalize it: build a new presentation-layer module (outside `engine/` and outside `content/`'s function-forbidding purity guard) that maps the engine's *entire* structured-event vocabulary to weighted copy, the same way `epitaphFor` already maps death causes to copy.

One critical scope correction: the brief's "~26 event types" undercounts by roughly 5x. A direct grep of `engine/*.js` for `type: "..."` event-push literals finds **136 distinct event-type strings** (combat, magic, encounters, items, economy, movement) — `engine/events.js` only centralizes 6 of them as named factories; the rest are pushed as inline object literals from their owning rule module. Authoring a bespoke weighted-variant bank *per exact event type* at that scale is not viable in one phase. The recommended architecture instead buckets the 136 raw types into a much smaller set of **voice categories** (hit/miss/crit/kill/afflict/cure/trap/loot/economy/meta/etc.), each with its own variant bank; a lookup table maps `event.type -> category`. This keeps authoring effort bounded while still being "data-driven, not hardcoded."

For safety QA (VOX-02, the testable core), the right strategy is **exhaustive static-corpus scanning**, not sampling. Because every authored variant string is a small, closed, enumerable set (a few hundred to low-thousands of strings, not the combinatorial cross-product of all context values), a `node:test` guardrail can render *every* variant with a small deterministic set of representative + boundary token values and scan the *entire* resulting corpus with a word-boundary-safe wordlist match — this is complete, not a sample, and runs in milliseconds. A separate, larger *randomized* batch (recommend 5,000 seeded `narrate()` calls) still has value: it produces the human-reviewable "is this actually funny" artifact and is a second-layer regression net for concatenation surprises, but it is not what makes VOX-02 safe — the exhaustive scan is.

For the graveyard (VOX-03), the persistence side is already fully done (Phase 2's `window.mzStorage`, `GRAVE_KEY = "mazeworld.graveyard.v1"`, capped-at-60 array) and there are already **two** working write paths (the classic `mazeworld.html` script's own `bury()`, and `engineAdapter.js#persistGrave()` for engine-routed deaths) that both converge on the same storage key. The gap is on the *read* side: `renderGraves()` is only invoked at boot and from the classic script's own `bury()` — an engine-routed death's `persistGrave()` write never triggers a re-render. The fix is architectural, not a new persistence layer: make the graveyard panel re-fetch from `window.mzStorage` every time it's opened/shown, rather than trusting an in-memory mirror that two independent write paths can silently invalidate.

**Primary recommendation:** build one new pure module (e.g. `presentation/voice.js`) that (a) reuses `engine/death.js`'s existing epitaph mechanism unchanged for death copy, (b) adds a category-keyed generator for the other ~130 event types backed by new `content/*.js` data tables (weighted variant banks, `{token}` substitution, the same shape `epitaphs.js` already uses), (c) derives its own presentation-only RNG per call from already-serialized state fields so it never touches `GameState.rngState`, and (d) is exercised by an exhaustive `node:test` safety-scan guardrail plus a larger random sample script for the human tone-review artifact. Wire the graveyard panel to re-read `window.mzStorage` on open instead of relying on the classic script's in-memory `graves` array.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Structured event emission (`died`, `struck`, `foeKilled`, ...) | Engine (`engine/*.js`) | — | Already the engine's job (ENG-01); Phase 5 must not add narration/DOM/copy inside `engine/` — the engine-purity guard (`test/unit/engine-purity.test.js`) statically forbids `document`/`window`/`localStorage`/`Math.random`/`console` anywhere under `engine/` |
| Death-cause epitaph text | Engine (`engine/death.js#epitaphFor`) | Content (`content/epitaphs.js`) | Already built, tested, parity-safe — reuse unchanged, do not migrate into the new module |
| Event→prose generation for the other ~130 event types | Presentation (new `presentation/voice.js` or `src/voice/`) | Content (new weighted-variant data tables) | CONTEXT.md locks "engine stays UI-free... voice system lives in the PRESENTATION/content layer"; must sit outside `content/`'s pure-data guard (a generator function is itself a function-typed export, which `test/determinism/content-is-pure-data.test.js` forbids for anything under `content/`) |
| Weighted variant tables / tone-tagged copy data | Content (`content/*.js`) | — | Pure JSON-serializable data only (no closures) — already enforced by the existing content-purity guardrail, which automatically covers any new `content/` module for free |
| Safety wordlist + scan matcher | Content (data) + Test tooling (matcher logic) | — | The wordlist itself is pure data (belongs in `content/`); the matching/normalization *logic* is a function and must live in `test/` or `tools/`, not `content/` |
| HTML markup / span-class wrapping of narration | Browser adapter (`src/browser/engineAdapter.js#formatEvent`) | DOM (`mazeworld.html`) | Existing precedent: `formatEvent()` already wraps event-derived strings in `<span class="...">`; the voice generator should return **plain text**, never HTML, keeping the "only one place knows about markup" rule intact and keeping safety-scan matching simple |
| Graveyard/tombstone persistence | Persistence (`window.mzStorage`, `mazeworld.graveyard.v1`) | Engine (`engine/death.js#bury`) | Already done (Phase 2/3) — no new persistence work; `bury()` already produces the full tombstone shape |
| Graveyard screen render | DOM/UI (`mazeworld.html` `renderGraves()` + `#yard` panel) | Browser adapter (`src/browser/storage.js` read) | Needs a re-fetch-on-open fix (see Pitfall 6), not a rewrite |

## Standard Stack

No new runtime dependencies — `.claude/CLAUDE.md`'s zero-runtime-dep constraint applies, and nothing in this phase requires one. Everything below is either already in the codebase or is vendored **data** (not an npm package).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `engine/rng.js#makeRng` | in-repo | Deterministic PRNG for variant selection | Already the project's one RNG implementation (mulberry32); reuse it for presentation-side seeding rather than adding a second one `[VERIFIED: codebase read]` |
| `node:test` / `node:assert/strict` | Node 22 built-in | Safety-scan guardrail + generator unit tests | Matches every existing test file in `test/`; zero install `[VERIFIED: codebase read]` |
| `node --test` glob discovery | Node 22 built-in | Auto-discovers new test files under any `test/**` path | No config changes needed to add a new `test/content/` or `test/voice/` directory `[VERIFIED: package.json test script]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vendored wordlist data file (`content/safety-wordlist.js`) | n/a (data, not a package) | Backbone of the VOX-02 safety scan | Source recommendation below — vendor as a plain-data `content/` module, not an `npm install` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled word-boundary scanner | An npm profanity-filter package (`bad-words`, `leo-profanity`, etc.) | Rejected outright — violates the project's zero-runtime-dep constraint (`.claude/CLAUDE.md`); also most such packages ship the exact same kind of static wordlist internally, so there is no real capability loss from vendoring the data directly |
| Category-keyed variant banks | One bespoke bank per exact `event.type` string (136 of them) | Rejected as the primary scheme — authoring cost scales linearly with every future new event type the combat/magic/economy engine modules add; category-keyed banks absorb new event types by adding one lookup-table row, not a whole new bank |
| Presentation-local RNG derived from state fields | Sharing/mutating the engine's live `GameState.rngState` from the presentation layer | Rejected — see Pitfall 1; would silently desync save/reload determinism |

**Installation:**
```bash
# No installation — nothing here is an npm dependency.
# The wordlist is a vendored data file added directly to content/.
```

**Version verification:** N/A — no packages installed this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (npm, PyPI, or otherwise) — the safety wordlist is vendored **data** copied into a `content/*.js` module, not an npm dependency, per the zero-runtime-dep constraint in `.claude/CLAUDE.md`. The `package-legitimacy check` seam is for verifying npm/PyPI/crates package names; there is nothing to run it against here.

If a future phase reconsiders this (e.g., wanting a maintained upstream wordlist package instead of a vendored copy), re-run the Package Legitimacy Gate at that time — do not silently add a dependency to satisfy this phase's data needs.

**Vendored data provenance (not a package, but still needs a license check):** The LDNOOBW "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (`en` list, github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) is licensed CC BY 4.0 `[CITED: github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words]` — this is a reasonable seed list for the "hard profanity / crude" category, but (a) CC BY 4.0 requires attribution, so any vendored copy needs an attribution comment citing the source and license, (b) it is profanity-focused and does **not** meaningfully cover ethnic/gender/disability slurs or gore/adult-content vocabulary, so it must be supplemented with a small, manually-curated, project-specific list for those categories, and (c) the exact current file contents/license should be re-verified at implementation time (web content can change) rather than trusted from this research pass alone — flagged in the Assumptions Log below.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌────────────────────────────┐
                         │   engine/*.js (rules)       │
                         │   combat.js, magic.js,      │
                         │   movement.js, encounters.js│
                         │   items.js, economy.js,     │
                         │   death.js                  │
                         └──────────────┬───────────────┘
                                        │ push structured events:
                                        │ { type: "struck", target, roll, dmg, critical }
                                        │ { type: "foeKilled", name, spGained }
                                        │ { type: "died", cause }   ← engine ALSO calls
                                        │                              death.js#epitaphFor
                                        │                              here, using the LIVE
                                        │                              engine rng (unchanged)
                                        ▼
                         ┌────────────────────────────┐
                         │ applyAction(state, action)  │
                         │  -> { state, events }       │
                         └──────────────┬───────────────┘
                                        │ events[] (plain data, no HTML, no copy)
                                        ▼
              ┌─────────────────────────────────────────────────────┐
              │ src/browser/engineAdapter.js#dispatch()              │
              │  1. persist(state) — fire-and-enqueue, storage.js    │
              │  2. if a `died` event exists: track(persistGrave())  │
              │  3. html = formatEvents(events)                      │
              └───────────────────────┬───────────────────────────────┘
                                       │ events[]
                                       ▼
              ┌─────────────────────────────────────────────────────┐
              │ presentation/voice.js  (NEW, this phase)              │
              │  narrate(event, ctx) -> plain text string             │
              │  1. EVENT_CATEGORY[event.type] -> category key        │
              │  2. category + ctx tags -> weighted variant bank      │
              │     (content/voice-*.js, pure data)                   │
              │  3. presentation-local rng.pick(bank)                 │
              │     seeded from (state.seed, state.steps, event       │
              │     ordinal) — NEVER from state.rngState               │
              │  4. fillTemplate(variant, ctx) — reused pattern from   │
              │     engine/death.js                                   │
              └───────────────────────┬───────────────────────────────┘
                                       │ plain text
                                       ▼
              ┌─────────────────────────────────────────────────────┐
              │ formatEvent(e) (existing, engineAdapter.js)           │
              │  wraps voice.narrate() output in <span class="..."> │
              │  — the ONLY place HTML/markup is applied             │
              └───────────────────────┬───────────────────────────────┘
                                       │ html[]
                                       ▼
                              mazeworld.html logLine()/paint()

  Separately, on death:
              ┌─────────────────────────────────────────────────────┐
              │ engineAdapter.js#persistGrave()                      │
              │  bury(state, cause, ...) -> tombstone (name, race,   │
              │  sub, cause, floor, epitaph [already rendered by      │
              │  engine's own die()/epitaphFor], when)                │
              │  -> window.mzStorage.setItem(GRAVE_KEY, ...)          │
              └───────────────────────┬───────────────────────────────┘
                                       │ mazeworld.graveyard.v1 (JSON array, capped 60)
                                       ▼
              ┌─────────────────────────────────────────────────────┐
              │ Graveyard panel (mazeworld.html #yard)                │
              │  on OPEN (not just at boot):                          │
              │  await window.mzStorage.getItem(GRAVE_KEY)            │
              │  -> renderGraves(fresh array)                         │
              │  (fixes the stale-in-memory-graves gap — Pitfall 6)   │
              └─────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
content/
├── epitaphs.js          # UNCHANGED — death-cause banks, already correct shape
├── flavor.js             # UNCHANGED — RACE_NOTE/CLASS_NOTE/SUB_NOTE static copy
├── names.js               # UNCHANGED
├── safety-wordlist.js     # NEW — pure data: categorized banned-term arrays +
│                            allowlist (Scunthorpe exceptions), vendored + curated
├── voice-combat.js        # NEW — weighted banks for combat categories
│                            (hit/miss/crit/kill/foeMissed/fled/...)
├── voice-magic.js         # NEW — spellHit/spellMissed/backfire/... banks
├── voice-explore.js       # NEW — trap/chest/encounter/status/economy banks
└── voice-item.js          # NEW — item-flavor banks (bought/used/found/...)

presentation/               # NEW top-level dir (seeds the future full
│                            presentation layer research/ARCHITECTURE.md
│                            already names as presentation/render/log.ts —
│                            this phase supplies the voice DATA + generator,
│                            not the full rewrite; Phase 4 wires the rest)
├── voice.js                # narrate(event, ctx) / epitaphFor(...) — the ONE
│                            pure module this phase adds; imports content/*
│                            + engine/rng.js#makeRng; no DOM, no HTML
└── eventCategories.js       # pure lookup table: raw event.type -> category key

test/
├── unit/voice.test.js       # NEW — narrate() determinism, token-fill coverage,
│                              category-mapping completeness
└── content/
    └── safety-scan.test.js  # NEW — exhaustive corpus scan (the VOX-02 guardrail)

tools/
└── voice-sample.mjs         # NEW — batch-generates the large random sample
                              #        (human-reviewable artifact + secondary
                              #        safety net), writes to a gitignored or
                              #        committed sample file per plan's choice
```

### Pattern 1: Category-keyed event-to-copy mapping (solves the 136-event-type scale problem)
**What:** A small pure lookup table maps every raw `event.type` string to one of ~20-30 voice categories; each category owns one weighted variant bank. New engine event types default to a sensible fallback category (e.g. `"beat"` — a neutral acknowledgement) rather than crashing, mirroring `formatEvent()`'s existing "unrecognized event types are silently dropped" posture (`engineAdapter.js` comment, line ~293).
**When to use:** For every event type EXCEPT `died` (which keeps using `engine/death.js#epitaphFor` unchanged).
**Example:**
```javascript
// presentation/eventCategories.js (pure data)
export const EVENT_CATEGORY = {
  struck: "combat.hit",
  strikeMissed: "combat.miss",
  foeMissed: "combat.foeMiss",
  foeKilled: "combat.kill",
  backstab: "combat.crit",
  spellHit: "magic.hit",
  spellMissed: "magic.miss",
  spellBackfired: "magic.backfire",
  trapSprung: "explore.trapHit",
  trapAvoided: "explore.trapMiss",
  bought: "economy.buy",
  goldGained: "economy.gain",
  leveled: "meta.levelUp",
  floorChanged: "meta.descend",
  won: "meta.win",
  // ... remaining ~120 mapped types (spec'd in the plan, not authored here)
};
export const DEFAULT_CATEGORY = "beat"; // fallback for any new/unmapped type
```
```javascript
// presentation/voice.js (pure logic, NOT under content/)
import { EVENT_CATEGORY, DEFAULT_CATEGORY } from "./eventCategories.js";
import { VOICE_BANKS } from "../content/voice-index.js"; // barrel of category -> variant[]
import { makeRng } from "../../engine/rng.js";
import { fillTemplate } from "./templateFill.js"; // extracted from death.js's pattern

export function narrate(event, ctx, runSeed) {
  const category = EVENT_CATEGORY[event.type] || DEFAULT_CATEGORY;
  const bank = VOICE_BANKS[category] || VOICE_BANKS[DEFAULT_CATEGORY];
  // presentation-only rng — see Pitfall 1: never touches engine rngState
  const rng = makeRng(seedFor(runSeed, ctx.steps, event.type));
  return fillTemplate(rng.pick(bank), { ...ctx, ...event });
}
```
Source: pattern generalized from `engine/death.js#epitaphFor`/`fillTemplate` (local codebase) `[VERIFIED: codebase read]`.

### Pattern 2: Presentation-local, state-derived RNG seeding (keeps parity/determinism suites green)
**What:** Every `narrate()` call creates a *fresh* `makeRng()` instance seeded from a combination of already-deterministic, already-serialized fields (the run's `seed`, `state.steps` at the time of the event, and the event's own type/ordinal) — never from `state.rngState` itself.
**When to use:** Everywhere in the new voice module. `engine/death.js#epitaphFor` is the one exception (it runs *inside* `die()`, inside `applyAction`, and legitimately shares the engine's own rng — leave that as-is).
**Example:**
```javascript
// presentation/voice.js
function seedFor(runSeed, steps, eventType, ordinal = 0) {
  // A tiny deterministic string hash (no crypto needed — cosmetic variety only).
  let h = (runSeed ^ steps ^ ordinal) >>> 0;
  for (let i = 0; i < eventType.length; i++) {
    h = (Math.imul(h ^ eventType.charCodeAt(i), 16777619)) >>> 0;
  }
  return h;
}
```
Source: derived from `engine/rng.js#mulberry32`'s existing seed contract (any 32-bit integer) — reuses the project's one RNG rather than inventing a second one `[VERIFIED: codebase read]`.

### Pattern 3: Graveyard panel re-fetches on open, not on boot only
**What:** Instead of trusting the classic script's in-memory `graves` array (which only `loadGraves()`-at-boot and the classic script's own `bury()` keep in sync), the graveyard panel's open/show handler re-reads `window.mzStorage.getItem(GRAVE_KEY)` fresh every time and re-renders from that.
**When to use:** Any UI entry point that opens/reveals the `#yard` panel.
**Example:**
```javascript
// mazeworld.html (existing classic script) — extend, don't replace, loadGraves/renderGraves
document.getElementById("btn-open-yard").addEventListener("click", async () => {
  await loadGraves();       // re-reads GRAVE_KEY fresh from window.mzStorage
  renderGraves();            // existing render function, unchanged
});
```
Source: `mazeworld.html` lines 3010-3059 (existing `loadGraves`/`renderGraves`), gap identified via direct read of `engineAdapter.js#persistGrave()` (no `renderGraves()` call site after an engine-routed death) `[VERIFIED: codebase read]`.

### Anti-Patterns to Avoid
- **Narrating inside `engine/`:** Any temptation to have `combat.js`/`magic.js` push already-formatted prose (instead of structured fields) breaks ENG-01 and will fail the static engine-purity guard the moment narration touches `console`/DOM, and even if it technically doesn't, it re-couples rules to copy exactly the pattern `research/ARCHITECTURE.md`'s Anti-Patterns section already flags as the prototype's biggest coupling problem.
- **Function-typed exports under `content/`:** `test/determinism/content-is-pure-data.test.js` walks every exported value from every `content/*.js` module looking for function-typed leaves. A `narrate()`-style generator function, or a `{ text: "...", weight: () => 2 }`-style closure, exported from anything under `content/` fails this guardrail immediately. Keep `content/` 100% data; keep all functions in `presentation/`.
- **Reusing `state.rngState` post-hoc for narration:** see Pitfall 1 below — this is the single highest-risk mistake this phase could make.
- **Returning HTML from the voice generator:** breaks the "one place knows about markup" rule and makes safety-scan regex matching harder (banned substrings can straddle a tag boundary, e.g. `da<span>mn</span>`). Voice functions return plain text; `formatEvent()` (existing) applies `<span>` wrapping, unchanged.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profanity/gore/slur/adult wordlist from scratch | An original curated list authored line-by-line with no reference baseline | Vendor a well-known, permissively-licensed base list (LDNOOBW `en`, CC BY 4.0) for the "hard profanity/crude" category, then hand-curate small supplementary lists for slurs and gore/adult terms this project's tone actually risks | A from-scratch list is far more likely to have coverage gaps than a maintained community list; vendoring the data (not the package) keeps zero-runtime-dep compliance while avoiding reinventing a solved problem `[CITED: github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words]` |
| NLP/ML toxicity classification | A trained model or cloud moderation API call | Simple word-boundary regex matching against a closed, curated wordlist | The content space here is a closed, generator-controlled corpus (not free-form user input) — a wordlist is complete and appropriate; an ML classifier is both a runtime-dependency violation (zero-deps constraint, offline requirement) and overkill for a bounded, enumerable text space |
| `{token}` template substitution engine | A general-purpose templating library (Handlebars, Mustache-lite, etc.) | The existing `engine/death.js#fillTemplate` single-pass `/\{(\w+)\}/g` regex replace | Already built, already tested (`epitaphFor` tests), already proven sufficient for this exact problem — extending it to the new module is strictly less risk than adopting a new templating mechanism, and a library would violate zero-runtime-deps anyway |

**Key insight:** Nothing in this phase's safety-QA or templating problem is novel enough to justify custom infrastructure beyond what `engine/death.js` already proves works — the risk is entirely in *scale* (136 event types, hundreds of variant strings) and *scope discipline* (keeping the generator out of `engine/` and out of `content/`'s pure-data zone), not in needing new mechanisms.

## Common Pitfalls

### Pitfall 1: Presentation-layer narration silently mutates/desyncs the engine's serialized RNG state
**What goes wrong:** If `narrate()` is implemented by instantiating `makeRng(currentState.rngState)` and calling `.pick()` on it (reusing the *live* engine rng object/state after `dispatch()` has already returned), two things break: (a) `dispatch()` already calls `persist()` **before** `formatEvents()` runs (confirmed in `engineAdapter.js#dispatch`, lines 250-273), so any rng draw consumed during narration is never persisted — a page reload replays the *same* seed+action script but the presentation layer would now draw variant picks starting from a state.rngState that never actually advanced past that point, changing which copy renders vs. what was shown live; (b) if narration instead mutates and writes back the *same* `GameState.rngState` object, it silently consumes draws from the sequence the next real engine action expects, corrupting future gameplay-affecting rolls in a way the parity/round-trip/determinism suites (372 tests, all currently green) are specifically designed to catch as a regression.
**Why it happens:** It is the "obvious" thing to do given `epitaphFor(cause, ctx, rng)` already takes an `rng` parameter and callers might assume the same rng should flow through to the new generator for consistency.
**How to avoid:** Give the voice module its own presentation-local rng, freshly seeded per call from already-serialized, already-deterministic fields (`state.seed`, `state.steps`, `event.type`/ordinal — see Pattern 2). This is deterministic for a given seed+action script (satisfies CONTEXT.md's reproducibility ask) without ever reading or writing `GameState.rngState`.
**Warning signs:** Any import of `currentState.rngState` inside a `presentation/` or new module outside `engine/`; any code path where narration runs *before* `persist()` in `dispatch()` (reordering would be an equally dangerous "fix" in the wrong direction).

### Pitfall 2: Treating "large representative sample" as the safety guarantee, when exhaustive scanning is both possible and stronger
**What goes wrong:** A team scopes VOX-02 as "generate N random combinations, scan those, ship" — this leaves a nonzero (if small) chance that an unsampled `(category, variant)` pairing containing a real problem ships undetected, and a flaky/non-reproducible guardrail (different sample each CI run) that is hard to reason about.
**Why it happens:** "Batch-generate a large sample" is literally the phrasing used in the CONTEXT.md decision and REQUIREMENTS.md, so it's easy to under-scope this as pure sampling rather than realizing the *authored variant corpus itself* is small enough to check exhaustively.
**How to avoid:** Two-tier strategy — (1) the actual safety **guardrail** is an exhaustive test that renders every single variant string in every bank with every token filled from a small deterministic set of representative + boundary values (every race name, every class/subclass, min/max plausible depth, a couple of gold amounts) and scans the complete resulting corpus; (2) a separate, larger *randomized* sample (recommend 5,000 seeded `narrate()` calls across random event/context combinations) is generated for the **human tone-review artifact** and as a secondary regression net, but is not load-bearing for VOX-02's pass/fail — the exhaustive scan is.
**Warning signs:** A safety test whose pass/fail result changes between runs (non-deterministic sample); a safety test that only covers a subset of banks "for speed."

### Pitfall 3: Scunthorpe-problem false positives in the safety scanner
**What goes wrong:** A naive substring match (`text.includes(bannedWord)`) flags legitimate game vocabulary that happens to contain a banned substring — classic examples in an RPG register include class/skill names, creature names, or even innocuous words that embed a slur/profanity substring.
**Why it happens:** Substring matching is the simplest thing to write first, and the failure mode is invisible until a specific word collides.
**How to avoid:** Word-boundary regex (`\b`) matching, case-insensitive, plus an explicit allowlist of known false positives reviewed against this game's own closed vocabulary (`content/classes.js`, `content/races.js`, `content/bestiary.js` creature names, `content/names.js`) before the scan ships — run the scanner once against ALL existing closed-vocabulary strings as a sanity pass and hand-add any legitimate collision to the allowlist.
**Warning signs:** The safety scan fails on a string that, read in context, is obviously fine (e.g., a class/creature/place name) — that's the scanner's bug, not the content's.
**Confidence:** `[CITED: en.wikipedia.org/wiki/Scunthorpe_problem, github.com/jbell1991/profanity-filter-solving-scunthorpe-problem]`

### Pitfall 4: Combinatorial concatenation risk is bounded by closed token vocabularies — don't over-invest in combinatorial testing
**What goes wrong:** PITFALLS.md (Pitfall 11) warns that procedurally-assembled sarcastic text can occasionally combine into something inappropriate. Taken too literally, this could push a plan toward trying to test the full cross-product of every template × every possible token value — which is intractable and unnecessary here.
**Why it happens:** The general "combinatorial text QA" risk is real in principle, but this specific codebase's token sources are **not** open-ended — every `{token}` filled into a template comes from a small, closed, already-shipped set: race names (6), class/subclass names (3/24), creature names (`content/bestiary.js`, a fixed roster), character names (`content/names.js`, a fixed roster), and numeric fields (depth, day, gold, sp) that are inherently safe (numbers can't be profane).
**How to avoid:** The exhaustive scan (Pitfall 2) already covers every template × every closed-vocabulary token value combination that matters — that IS the full combinatorial space for this content, not a sample of it. No additional combinatorial-explosion testing is needed beyond that.
**Warning signs:** Treating token substitution as if it could inject arbitrary/unbounded strings — it can't; every substitution source in this codebase is a closed, already-vetted content table.

### Pitfall 5: Placing generator *logic* inside `content/` breaks the existing pure-data guardrail
**What goes wrong:** `test/determinism/content-is-pure-data.test.js` already scans every `.js` file under `content/` and fails if any exported value contains a function-typed leaf anywhere in its object graph. A weighted-pick helper, a `narrate()` function, or even a `{ text, weight: () => ... }`-shaped table entry exported from a new `content/voice-*.js` module fails this test immediately (it already exists and is not new — the guardrail is inherited for free, but only if the discipline is respected).
**Why it happens:** It's tempting to co-locate a small helper function next to the data it operates on for convenience.
**How to avoid:** Keep every new `content/voice-*.js` module to plain arrays/objects of strings (or `{text, weight}` plain-data pairs — a weight is a number, not a function). All logic (weighted-pick algorithm, category lookup, template fill, rng seeding) lives in `presentation/`.
**Warning signs:** `npm test` failing on `content/*.js exports contain no function-typed leaves` after adding voice content — this is the guardrail working as intended, not a bug in the test.

### Pitfall 6: The graveyard panel's in-memory `graves` array goes stale after an engine-routed death
**What goes wrong:** `engineAdapter.js#persistGrave()` (the write path for every engine-routed death — combat, starve, fall/gorge, trap, poison, self-inflicted causes, per the CR-01 comment at line ~253) writes directly to `window.mzStorage` at `GRAVE_KEY` and never calls the classic script's `renderGraves()` or updates its in-memory `graves` variable. The classic script's OWN `bury()` (mazeworld.html line 3019, still used by the not-yet-engine-routed combat/store code paths per 03-CONTEXT.md) does call `renderGraves()`, but that's a **different, parallel write path** to the same key. Net effect: after an engine-routed death, the persisted graveyard is correct, but the currently-open graveyard panel (if the player had it open, or opens it without a page reload) can show stale/missing data until the next full page load re-runs `loadGraves()`/`renderGraves()` at boot.
**Why it happens:** Two independent code paths (the pre-existing classic script and the newer engine adapter) both write to the same persisted key by design (documented dual-write convergence, 02-03), but only one of them also drives the UI's in-memory mirror — this asymmetry is easy to miss since both paths "work" in isolation.
**How to avoid:** Make the graveyard panel's open/show handler always re-fetch from `window.mzStorage.getItem(GRAVE_KEY)` fresh (Pattern 3) rather than depending on either write path to also push a UI update. This sidesteps the two-writer synchronization problem entirely instead of trying to make both writers also notify the UI.
**Warning signs:** A freshly-died engine-routed run's tombstone doesn't appear in the graveyard panel until the page is reloaded, even though the storage key itself already has the new entry (verifiable via `await window.mzStorage.getItem("mazeworld.graveyard.v1")` in a console).
**Confidence:** `[VERIFIED: codebase read — src/browser/engineAdapter.js, mazeworld.html lines 3005-3059]`

## Code Examples

Verified patterns from this codebase (no external library involved):

### Existing weighted-pick + template-fill pattern to generalize (reuse, don't reinvent)
```javascript
// Source: engine/death.js (local codebase, lines 15-28)
function fillTemplate(str, ctx) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined ? ctx[k] : ""));
}

export function epitaphFor(cause, ctx, rng) {
  const bank = EPITAPHS[cause] || EPITAPHS.maze;
  return fillTemplate(rng.pick(bank), ctx);
}
```

### Existing rng.pick — reuse this, don't add a second RNG implementation
```javascript
// Source: engine/rng.js (local codebase, lines 57-59)
pick(arr) {
  return arr[Math.floor(gen.next() * arr.length)];
}
```

### Existing event field shapes to key the generator on (sample of the 136-type catalog)
```javascript
// Source: engine/combat.js (local codebase)
events.push({ type: "struck", target: t.name, roll, dmg, critical: crit });
events.push({ type: "foeKilled", name: f.name, spGained: gained });
events.push({ type: "strikeMissed", target: t.name, roll, need, dieN, untouchable: need === 0 });
// Source: engine/magic.js
events.push({ type: "spellHit", target: t.name, dmg, mult });
// Source: engine/encounters.js
events.push({ type: "trapSprung", roll: r, name: tr.n, dmg });
```

### Existing graveyard read/write to wire the panel against
```javascript
// Source: mazeworld.html (local codebase, lines 3010-3017)
const GRAVE_KEY = "mazeworld.graveyard.v1";
let graves = [];
async function loadGraves() {
  try { const r = await window.mzStorage.getItem(GRAVE_KEY); graves = r ? JSON.parse(r) || [] : []; }
  catch (e) { graves = []; }
  if (!Array.isArray(graves)) graves = [];
}
```

## State of the Art

Not applicable in the usual "library X moved to version Y" sense — this phase has no external library dependency to track. The one relevant "state of the art" shift is internal to this codebase: the prototype's original voice mechanism (`mazeworld.html`'s inline `epitaphFor`/`CAUSE_TEXT` closures) was already ported to pure data + engine-side rng consumption in Phase 1 (`engine/death.js`, `content/epitaphs.js`) — this phase's job is extending that already-modernized pattern to the rest of the event vocabulary, not modernizing anything further.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact module path (`presentation/voice.js`) and directory name (`presentation/`) | Architecture Patterns, Recommended Project Structure | Low — explicitly Claude's/planner's discretion per CONTEXT.md; any pure module outside `engine/` and `content/` satisfies the actual constraint |
| A2 | LDNOOBW `en` list is still CC BY 4.0 and its current file contents are still appropriate to vendor as-is | Package Legitimacy Audit, Don't Hand-Roll | Medium — license terms/content can change upstream; re-verify the license and skim the actual word list at implementation time before vendoring, rather than trusting this research pass |
| A3 | 5,000 as the recommended random-sample size for the human-review artifact | Common Pitfalls (Pitfall 2), Validation Architecture | Low — this is a heuristic for artifact usefulness/runtime, not a safety guarantee (the exhaustive scan is the safety guarantee); the planner can size this to taste without re-deriving safety coverage |
| A4 | ~20-30 voice categories is the right granularity for bucketing the 136 raw event types | Pattern 1 | Medium — under-scoping (too few categories) risks tonal repetitiveness across unrelated events; over-scoping re-approaches the original 136-bank authoring cost. Should be validated during planning/authoring, not treated as fixed |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Should `engine/death.js#epitaphFor`'s death-cause banks eventually move into the new category-keyed system for consistency, or stay a permanent special case?**
   - What we know: CONTEXT.md floats this as an open seam question ("decide the seam so the engine emits a structured death event and the presentation voice-generates the prose") but also says death.js's epitaph mechanism should be treated as a working, tested precedent.
   - What's unclear: Whether unifying it into the new generator (moving `EPITAPHS` lookup out of `engine/death.js` entirely, having `die()` just push a plain `died(cause)` event and letting `presentation/voice.js` render the epitaph post-hoc) is worth the parity/regression risk this phase, versus leaving it as an intentional carve-out.
   - Recommendation: Leave `engine/death.js#epitaphFor`/`die()` unchanged this phase (lowest risk, zero regression surface on the 372 green tests) and have the new generator's public API simply delegate death-cause requests to it, rather than duplicating or replacing the mechanism. Revisit unification only if a later phase needs it.

2. **Exact category taxonomy and event->category mapping for all 136 event types**
   - What we know: The full list of raw `event.type` strings (grepped from `engine/*.js`, reproduced in the Summary).
   - What's unclear: The precise grouping into voice categories — this is an authoring/design decision better made during planning (with the tone/style guide in hand) than pre-decided in research.
   - Recommendation: The plan should include a task to enumerate all 136 types against categories explicitly (a spreadsheet/table in the plan or a `presentation/eventCategories.js` review checklist), ensuring no event type silently falls through to the generic `"beat"` fallback without a deliberate decision.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependency beyond what's already installed and verified working (Node 22.23.2 confirmed via `node -v`; `node --test` confirmed green at 372/372 immediately before this research was written).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` / `node:assert/strict` |
| Config file | none — `package.json`'s `"test": "node --test"` script auto-discovers every `*.test.js` under `test/` |
| Quick run command | `npm run test:quick` (currently `node --test test/unit test/determinism test/roundtrip`) |
| Full suite command | `npm test` (`node --test`, runs everything incl. `test/parity`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOX-01 | `narrate(event, ctx)` returns a non-empty plain-text string with no unfilled `{token}` placeholders, for every mapped category | unit | `node --test test/unit/voice.test.js` | ❌ Wave 0 |
| VOX-01 | `narrate()` is deterministic for a given (runSeed, steps, event) triple — same inputs, same output, across two calls | unit | `node --test test/unit/voice.test.js` | ❌ Wave 0 |
| VOX-01 | Every one of the 136 raw `event.type` strings currently pushed anywhere under `engine/` resolves to an explicit category (not silently falling to the default fallback without having been reviewed) | unit | `node --test test/unit/eventCategories.test.js` | ❌ Wave 0 |
| VOX-01 | `presentation/voice.js` never reads or mutates `GameState.rngState` (regression guard for Pitfall 1) | unit (static guard, same pattern as `engine-purity.test.js`) | `node --test test/unit/voice-rng-isolation.test.js` | ❌ Wave 0 |
| VOX-01 | The 372 existing determinism/parity/round-trip tests stay green after wiring `narrate()` into `formatEvents()` | regression | `npm test` | ✅ (existing suite; must stay green, no new file) |
| VOX-02 | Every authored variant string, rendered with every representative/boundary token value, contains zero banned terms (word-boundary matched, allowlist-aware) | content guardrail (exhaustive, not sampled) | `node --test test/content/safety-scan.test.js` | ❌ Wave 0 |
| VOX-02 | `content/safety-wordlist.js` exports pass the existing pure-data guardrail (no function leaves) | content guardrail (inherited, free) | `node --test test/determinism/content-is-pure-data.test.js` | ✅ (already exists, auto-covers new content modules) |
| VOX-02 | A large random sample (recommend 5,000 seeded `narrate()` calls) is written to a reviewable artifact file for human tone/funny UAT | tooling script (not a pass/fail test) | `node tools/voice-sample.mjs > sample-output.txt` (or similar) | ❌ Wave 0 |
| VOX-03 | `bury()`/graveyard tombstones round-trip through `window.mzStorage` (JSON.stringify/parse) with all documented fields present | unit (existing pattern, extend if needed) | `node --test test/unit/death.test.js` | ✅ (already covers `bury()`'s output shape; extend only if new fields are added) |
| VOX-03 | Graveyard panel re-fetches `GRAVE_KEY` on open and renders entries with name/class/race/cause/depth/epitaph | manual-only (DOM/browser UI, no headless DOM harness in this repo) | N/A — visual/manual check | N/A |

### Sampling Rate
- **Per task commit:** `npm run test:quick` (unit + determinism + roundtrip — fast, catches voice-module regressions and RNG-isolation violations early)
- **Per wave merge:** `npm test` (full suite, including `test/parity` — confirms the 372-test baseline plus new voice/safety-scan tests all stay green)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the `tools/voice-sample.mjs` artifact regenerated and available for the deferred human tone-quality UAT

### Wave 0 Gaps
- [ ] `test/unit/voice.test.js` — covers VOX-01 (narrate determinism, token-fill completeness)
- [ ] `test/unit/eventCategories.test.js` — covers VOX-01 (full 136-type category-mapping coverage)
- [ ] `test/unit/voice-rng-isolation.test.js` — covers VOX-01 regression guard (Pitfall 1) — static source-scan test, same technique as `test/unit/engine-purity.test.js`
- [ ] `test/content/safety-scan.test.js` — covers VOX-02 (the exhaustive safety guardrail)
- [ ] `content/safety-wordlist.js` — the vendored+curated wordlist data itself (needed before the safety-scan test can run)
- [ ] `tools/voice-sample.mjs` — covers VOX-02's human-reviewable sample artifact
- [ ] Framework install: none — `node:test` is already the standing framework, no new install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts/auth in this offline single-player app |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (narrow) | `{token}` substitution uses the existing single-pass, non-recursive `/\{(\w+)\}/g` regex (`fillTemplate`) — inputs to `ctx` come exclusively from already-validated engine state (character name, race, class — themselves constrained by `content/*.js` closed tables), never from free-form user text, so template-injection risk is effectively closed by construction. Preserve this: never let a raw, unvalidated string reach a `ctx` value that then gets substituted into a template that is itself re-parsed as a template (no recursive substitution). |
| V6 Cryptography | No | The presentation-local RNG seed hash (Pattern 2) is explicitly cosmetic/non-cryptographic, matching `engine/rng.js`'s own documented "never use it for anything security-sensitive" posture — no crypto primitive is needed or should be introduced here. |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Inappropriate/rating-risk content silently shipping via an unreviewed procedural combination | Closest fit: Information Disclosure / reputational-integrity risk (not a classic STRIDE category, but the project's own PITFALLS.md #2/#11 treat it as a store-compliance-grade risk) | Exhaustive safety-scan guardrail (Pitfall 2/VOX-02 test) run in CI on every content change, not just once |
| Engine RNG-state tampering via a presentation-layer bug (not an external attacker, but a self-inflicted determinism bug) | Tampering (of the save/replay contract, not of security data) | Presentation-local RNG isolation (Pitfall 1) + a dedicated regression test asserting `presentation/voice.js` never touches `state.rngState` |
| Graveyard/save file is plaintext, user-editable JSON (pre-existing, not introduced by this phase) | Tampering | Already documented and explicitly deferred in `PITFALLS.md` Pitfall 12 ("cheap now, expensive later... explicitly do not over-invest here for v1") — no new action needed in this phase; do not scope-creep a checksum/integrity system into VOX-03 |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `C:\projects\mazeworld\engine\events.js`, `engine\death.js`, `engine\rng.js`, `engine\combat.js`, `engine\magic.js`, `engine\encounters.js`, `engine\items.js`, `engine\economy.js`, `engine\movement.js` — event vocabulary, existing epitaph/rng patterns
- `C:\projects\mazeworld\content\epitaphs.js`, `content\flavor.js`, `content\names.js`, `content\index.js`, `content\races.js`, `content\classes.js`, `content\bestiary.js` — existing content shapes and closed vocabularies
- `C:\projects\mazeworld\src\browser\engineAdapter.js`, `src\browser\storage.js` — dispatch/persist ordering, graveyard write paths, `formatEvents`/`formatEvent`
- `C:\projects\mazeworld\mazeworld.html` (graveyard panel section, lines ~313-485, ~2994-3059) — classic script's `loadGraves`/`saveGraves`/`bury`/`renderGraves`
- `C:\projects\mazeworld\test\unit\death.test.js`, `test\unit\engine-purity.test.js`, `test\determinism\content-is-pure-data.test.js` — existing guardrails this phase's new code must satisfy
- `C:\projects\mazeworld\.planning\research\ARCHITECTURE.md` — confirms the intended future `presentation/render/log.ts` seam and the "content/ is split from engine/" rationale
- `C:\projects\mazeworld\.planning\phases\01-engine-extraction-determinism\SKELETON.md` — confirms directory-layout conventions and that "the voice/epitaph generation system" was explicitly deferred to this phase
- `npm test` run at 2026-09-08 confirming 372/372 green before this research

### Secondary (MEDIUM confidence)
- [LDNOOBW List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (github.com)](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) — CC BY 4.0 licensed base wordlist, recommended as a vendoring source (re-verify license/content before use — see Assumptions Log A2)
- [Scunthorpe problem — Wikipedia](https://en.wikipedia.org/wiki/Scunthorpe_problem) — word-boundary/allowlist mitigation confirmation

### Tertiary (LOW confidence)
- [Creating a Custom Profanity Filter and Solving the Scunthorpe Problem — Medium](https://medium.com/@joseph.louis.bell/creating-a-custom-profanity-filter-and-solving-the-scunthorpe-problem-c911275991a2) — corroborating pattern only, not load-bearing

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — verified directly against this repo's existing, tested code (`engine/death.js`, `engine/rng.js`, `engineAdapter.js`, guardrail tests)
- Safety-QA wordlist sourcing: MEDIUM — the sourcing strategy and license claim are cross-checked externally but need a fresh license/content check at implementation time
- Pitfalls (RNG isolation, graveyard staleness, content-purity guard): HIGH — each is a direct, reproducible finding from reading the actual source files, not inferred

**Research date:** 2026-09-08
**Valid until:** Stable until the engine's event vocabulary changes materially (e.g., a later phase adds/renames a large batch of event types) or the vendored wordlist source is re-checked — recommend re-validating the 136-event-type count and the wordlist license at the start of implementation if more than ~30 days have passed.
