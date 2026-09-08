---
phase: 5
slug: voice-content-graveyard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 5 — Validation Strategy

> Zero-dependency `node:test`. The voice generator, the exhaustive safety scan, and the graveyard read/persist are all automatable. Only "is it actually funny / on-brand across a big sample" is human UAT (tone quality). Determinism guardrail is load-bearing: narration must NOT touch `GameState.rngState` (parity/determinism suites must stay green).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node built-ins) |
| **Quick run** | `node --test test/voice/` |
| **Full suite** | `node --test` (all prior 372 + new voice/safety/graveyard tests) |
| **Human-review artifact** | a generated sample corpus (e.g. `tools/voice-sample.mjs` → a reviewable file) for the deferred tone UAT — NOT a pass/fail test |
| **Estimated runtime** | ~6–15s |

---

## Sampling Rate
- After every task commit: `node --test test/voice/`
- After every wave: `node --test` (full — parity/determinism/round-trip must stay green)
- Before `/gsd-verify-work`: full suite green incl. the exhaustive safety scan
- Max feedback latency: ~15s

---

## Per-Requirement Verification Map

| Requirement | Criterion | Test Type | Automated Command | Wave 0 | Status |
|-------------|-----------|-----------|-------------------|--------|--------|
| VOX-01 | Data-driven voice generator keyed to structured events (category mapping), replaces hardcoded strings | unit | `node --test test/voice/generator.test.js` | ❌ W0 | ⬜ |
| VOX-01 | EVERY one of the 136 engine event types is deliberately mapped to a voice category (no silent default fall-through) | coverage test | `node --test test/voice/event-coverage.test.js` (enumerate engine event-type literals; assert each has a mapping) | ❌ W0 | ⬜ |
| VOX-01 | Narration is deterministic via a PRESENTATION-LOCAL rng (seed/steps/event-derived); does NOT read/advance GameState.rngState | determinism | `node --test test/voice/voice-determinism.test.js` + existing `test/parity/` `test/determinism/` `test/roundtrip/` stay green | ❌ W0 | ⬜ |
| VOX-02 | Exhaustive family-friendly safety scan of the CLOSED variant corpus (every variant × closed-vocab token), word-boundary + allowlist (Scunthorpe-safe) | exhaustive scan | `node --test test/voice/safety-scan.test.js` | ❌ W0 | ⬜ |
| VOX-03 | Graveyard/run-history screen reads persisted tombstones from window.mzStorage ON OPEN (re-fetch, not a stale in-memory mirror) and renders name/class/race/cause/depth/epitaph | unit + adapter | `node --test test/voice/graveyard.test.js` | ❌ W0 | ⬜ |
| VOX-03 | Graveyard persists across app restart (records ALL death causes) | unit (reuse Phase 2/3) | `node --test test/voice/graveyard-persist.test.js` | ❌ W0 | ⬜ |

---

## Wave 0 Requirements
- [ ] `test/voice/` tree established.
- [ ] `test/voice/event-coverage.test.js` — enumerate the ~136 engine event-type string literals from `engine/*.js` and assert each maps to a declared voice category (deliberate mapping; a new/unmapped type FAILS the test — no silent default).
- [ ] `test/voice/safety-scan.test.js` — the EXHAUSTIVE scan (render the closed corpus, scan against the vendored wordlist with word-boundary + allowlist). Standing guardrail; stays green as content grows.
- [ ] `test/voice/voice-determinism.test.js` — same seed/steps/event → same narration; assert narration never mutates `GameState.rngState` (parity-safe).
- [ ] Vendored, zero-dependency profanity/gore/slur/adult **wordlist data file** (small, self-maintained; if sourced from LDNOOBW, verify CC BY 4.0 license + include attribution) — NO npm runtime dependency.

---

## Manual-Only Verifications (Deferred UAT)

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| The voice is actually funny / on-brand (heavy sarcasm, dark, deadpan) across a large sample | VOX-01/02 | Humor & tone quality is subjective | Review the generated `voice-sample` artifact (a large sample of event→copy); confirm it reads as intended and stays family-friendly |
| Graveyard screen looks/feels right on a device | VOX-03 | Visual/mobile polish is Phase 4 | On-device once Phase 4 UI lands |

*The safety scan is automated (family-friendly is machine-checkable); "funny" is the human UAT, deferred to milestone end.*

---

## Validation Sign-Off
- [ ] Every VOX req maps to an automated test or a documented manual item
- [ ] All 136 event types deliberately mapped (coverage test); no silent default
- [ ] Exhaustive safety scan green; wordlist vendored (zero dep, licensed)
- [ ] Narration uses presentation-local rng; parity/determinism/round-trip (372) stay green
- [ ] Graveyard re-fetches from storage on open; persists across restart
- [ ] `nyquist_compliant: true` set

**Approval:** pending
