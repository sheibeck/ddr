# Phase 56: Sound Effects & Audio Settings - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 12 decisions across 3 areas, all accepted as recommended

<domain>
## Phase Boundary

This phase delivers **the audio layer and nothing else**: a new `src/browser/sfx.js` that maps engine events to the 31 clips already sitting in `sfx/`, plays them through Web Audio in the dispatch path, varies repeats, and obeys the Settings "Sound" toggle — plus the `copySfx()` build step that gets the clips into `www/`.

In scope: AUD-01..06. The event→clip table, the playback engine, clip variation, the settings gate, the www asset copy, and the unit tests over all of it.

Out of scope and belonging to later phases: every visual change. No canvas work, no animation, no layout, no transition easing, no combat pacing. In particular, MOTION-03's "readable beat between exchanges" is Phase 58's — this phase plays a fight's sounds at whatever cadence the fight currently resolves at, and does not slow anything down to make room for them. If audio timing looks like it wants the Phase 58 pacing to exist first, note it as a dependency rather than building pacing here.

Also out of scope: music or ambient loops (REQUIREMENTS.md "Out of Scope"), any new audio assets beyond the 31 delivered clips, and any engine or content change whatsoever — this phase must leave `engine/` and `content/` byte-identical.

</domain>

<decisions>
## Implementation Decisions

### Audio engine & playback

- **Web Audio, not `HTMLAudioElement`** — an `AudioContext` with `decodeAudioData`, one decoded `AudioBuffer` held per clip, and a fresh `AudioBufferSourceNode` created per play. This is what gives real overlap and zero per-play I/O, which is what AUD-04 is actually asking for.
- **All 31 clips decode once at unlock**, in parallel, off the critical path. Never a fetch or a decode mid-play — a clip that has to be fetched when the action happens cannot satisfy "no audible lag".
- **Unlock on the first tap anywhere.** Android's WebView will not let an `AudioContext` start without a user gesture, so the context is created/resumed on the first tap of the session and the app is simply silent before it. Do not tie the unlock to one specific button (e.g. DESCEND) — a player who taps something else first would get a silent session.
- **Full polyphony capped at 8 concurrent voices**, oldest dropped when the cap is hit. Simultaneous events must overlap rather than cut each other off (AUD-04), but an unbounded voice count is a mid-range-phone hazard.

### Event mapping & variation

- **Hook into `dispatchWithNarration()`** (`mazeworld.html:4874`) — the single post-dispatch seam every action flows through (move, camp, store, Joiner, inventory take/leave/drop/equip/unequip/sell/use, and combat/magic). Do **not** hook beside the two `hapticForEvents(events)` calls (`mazeworld.html:4998` and `:5442`): those cover only the move and combat paths, so chest/gold/drink/store sounds would silently never fire. This is the one place this phase differs from the haptics precedent, and it is deliberate.
- **Every mapped event in a dispatch fires its clip, in event order** — de-duplicated per clip within a single dispatch, capped at 3 voices per dispatch. This is deliberately *not* the haptics model (which picks one "strongest beat" style per dispatch): a round where you strike, kill and level up should sound like three things happening, not one.
- **Variation is a shuffle-bag round-robin** driven by a shell-side counter — each multi-clip group (3 walk, 3 water, 2 hit, 2 miss, 3 hurt) cycles without repeating the same clip twice in a row. **No rng anywhere**: not `Math.random()`, and emphatically not a draw off the engine stream. Variation must be a pure presentational counter so this phase cannot touch determinism.
- **`ui-tap` fires on menu and button taps only.** A map tap that results in a move plays that move's walk clip instead, so a single step never produces two sounds.

### Settings, packaging & tests

- **Sound Off gates at the module boundary — no `AudioContext` is ever constructed.** AUD-05 says "opens no audio device", so the muted-gain-node approach is explicitly rejected. Flipping Sound back On mid-session constructs the context and decodes the clips at that moment (the same unlock path, just triggered later).
- **`copySfx()` in `tools/build-www.mjs`**, mirroring `copyIcons()` exactly: a whole-directory copy at build time from `sfx/` into `www/sfx/`, throwing loudly if the source directory is missing. The MP3s ship as delivered — **no re-encoding**. (`icons/optimized/` already copies, so `party_*` and `set_dungeon_*` need no build change; `sfx/` is the only gap.)
- **`node --test` unit tests over a pure event→clip mapping table plus an injected fake audio backend**, mirroring `haptics.js`'s `__mzHapticsImportOverride` hook. Tests assert: the right clip ids fire for a given event list, the de-dupe and 3-per-dispatch cap hold, the shuffle-bag never repeats back-to-back, and **Sound Off fires nothing and constructs no context**. Device confirmation is deferred to the Phase 60 batch.
- **The monster-family cry plays on `combatJoined`** — the Fight! press — one cry per fight, selected from the foe's BESTIARY `type` (Beasts / Demons / Humans / Lair Beasts / Magical / Walking Dead → `enemy-batrat` / `enemy-beast` / `enemy-demon` / `enemy-human` / `enemy-undead`). Not on `encounterStarted`, which is the preview the player has not committed to yet. Note the six BESTIARY families map onto five clips — the planner must record which family shares a clip and why.

### Claude's Discretion

- The exact event→clip table beyond the anchors named above (the 18 AUD-01 actions and the AUD-02 cries). Use the `eventNarration.js` event vocabulary as the source of type names.
- Gain levels / per-clip volume trim, and whether a master gain node sits in front of the voices.
- Module shape inside `src/browser/sfx.js` and how it registers on the `window.__mz*` bridge registry.
- Whether the voice cap is a hard 8 or a tuned number, as long as it is bounded and documented.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/browser/haptics.js`** — the closest analog and the pattern to mirror: a settings-gated, fire-and-forget, never-throwing side-effect module with a guarded dynamic import and a `globalThis.__mzHapticsImportOverride` test hook. Its "cosmetic polish must never throw" posture applies verbatim to audio.
- **`src/browser/settings.js`** — `SETTINGS_DEFAULTS` already contains **`sound: true`** with `ALLOWED_VALUES.sound = [true, false]`, and `readSettings()` / `writeSetting()` already persist it through `storage.js`. The Settings sheet already renders the row (`mazeworld.html:1309-1314`, `data-setting="sound"`). **Nothing reads it today** — the control exists and works, it just has nothing wired behind it. AUD-05 is a wiring job, not a new control.
- **`src/browser/eventNarration.js`** — the authoritative engine event-type vocabulary (`struck`, `strikeMissed`, `struckByFoe`, `foeKilled`, `trapSprung`, `leveled`, `died`, `goldGained`, `rationsEaten`, `waded`, `climbedOver`, `leaptOver`, `floorChanged`, `combatJoined`, …). The event→clip table should be keyed off these exact names.
- **`src/browser/bridge.js`** — the single `window.__mz*` registry (45 names) with a set-equality test; a new sfx module registers here.
- **`tools/build-www.mjs`** — `copyIcons()` (whole-dir copy of `icons/optimized/`, throws if absent), `copyFonts()`, `copySplash()` are the three existing precedents for `copySfx()`. All three are called from the same place in the build's main sequence.

### Established Patterns

- **Settings-gated side effects**: read `currentSettings` (the shell's cached settings object), bail early if the toggle is off, never throw, never block the render tail.
- **Test injection over mocking the platform**: `__mzHapticsImportOverride` and `__mzAppImportOverride` (`nativeChrome.js`) both let `node --test` assert a side effect *was called* without resolving a bare specifier. Audio should use the same shape.
- **Module + bridge registration**: `render*(host, state, deps)` for renderers; side-effect modules export plain functions and register one bridge name.
- **Assets are copied whole at build time, never fetched at runtime** — the offline gate depends on this.

### Integration Points

- `mazeworld.html:4874` `dispatchWithNarration(action)` — **the hook point**. Its existing contract is that it returns the dispatch result unchanged and callers keep their render tail byte-identical; the sfx call must preserve that.
- `mazeworld.html:4830` `hapticForEvents(events)` — the sibling to sit beside conceptually, but *not* the call site to copy (it is invoked at only two of the seam's callers).
- `mazeworld.html:1309-1314` — the existing Settings "Sound" row markup.
- `tools/build-www.mjs` main sequence (`copySourceDirs(); copyFonts(); copyIcons(); copySplash();`) — where `copySfx()` is added.
- `sfx/` — 31 MP3s, verified present: `walk1-3`, `walk-water1-3`, `hit1-2`, `miss1-2`, `hurt1-3`, `foe-die`, `enemy-{batrat,beast,demon,human,undead}`, `spell`, `resist`, `heal`, `drink`, `chest`, `gold`, `trap`, `jump`, `stairs`, `levelup`, `death`, `ui-tap`.

</code_context>

<specifics>
## Specific Ideas

- The user's original framing (backlog 999.1, captured 2026-09-19): map the clips "to game actions and engine events" — engine untouched, mute toggle by the settings gear, clips bundled in `www/`, Android WebView plays MP3 offline with no plugin. That framing is unchanged and is what this phase builds.
- The six BESTIARY families (`content/bestiary.js:40-147`) against five `enemy-*` clips is a real mismatch the planner must resolve explicitly and record, not paper over.

</specifics>

<deferred>
## Deferred Ideas

- **Combat pacing to make room for the sounds** — MOTION-03, Phase 58. If the fight resolves too fast for its own audio to read, that is evidence for Phase 58's beat, not a reason to add timing here.
- **Haptics polish** — already on the Future Requirements list; this phase does not touch `hapticForEvents`, only sits beside it.
- **Music / ambient loops** — out of scope per REQUIREMENTS.md; the delivered set is 31 one-shots.
- **Per-clip volume mixing as a user-facing control** — the Settings row is On/Off only. A volume slider would be a new control and is not in AUD-05.

</deferred>
