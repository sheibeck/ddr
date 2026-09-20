<!-- GSD:project-start source:PROJECT.md -->

## Project

**Mazeworld**

Mazeworld is a premium (paid-upfront), fully-offline mobile roguelike dungeon-crawler for **Android (Google Play)**, adapting a fantasy tabletop RPG the author designed in 1994. Players generate a randomly-rolled adventurer and descend an ever-deeper procedurally-generated maze — fighting monsters, casting spells, looting treasure, and surviving traps and starvation — until permadeath ends the run and they chase a higher depth/score on the next one. It's for players who love crunchy, dice-driven dungeon crawls and the comedic, "play-the-hand-you're-dealt" spirit of the original game.

**Tone & voice:** heavy sarcasm and dark humor — self-aware, deadpan, poking fun at fantasy-RPG tropes and at the player's own doomed adventurers — but kept **family-friendly** (no profanity, gore, or adult content; the darkness is in the wit, not the shock). Sarcasm is the through-line of every screen: death epitaphs, the "Oracle" log, item flavor, the tutorial. This voice is a core identity, not decoration.

**Core Value:** **The dungeon crawl** — the tension and discovery of descending into the unknown. If everything else is stripped away, walking deeper into a dangerous, uncertain maze must feel great.

### Constraints

- **Platforms**: Must ship to **Google Play (Android only)**. Requires native packaging (Android App Bundle), Play app signing, a store listing, and compliance (content rating, Data safety form, target-API level) — new territory for the author. No other platform is in scope.
- **Offline**: v1 must run with **no network**, no accounts, no backend.
- **Monetization**: **Paid upfront**, no ads/IAP — keep the build free of monetization SDKs.
- **Fidelity**: The prototype's rules are **canon**; deviations must be deliberate design decisions, not accidental regressions.
- **Rules engine**: Must remain **decoupled from UI and fully serializable** (multiplayer-ready), mirroring the prototype's existing `S`-state / `act()` design.
- **Performance / feel**: Must feel responsive and native-quality on mid-range phones; sessions target **5–10 minutes**.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Capacitor | **8.x** (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android` — **Android only**) | Wraps the existing HTML/CSS/JS app in a native Android WebView shell | Purpose-built for exactly this "existing web app → native store app" scenario; actively maintained by Ionic (near 1M weekly downloads); requires no rewrite of DOM/canvas code — the WebView renders `mazeworld.html` essentially unchanged (CONFIDENCE: MEDIUM) |
| Node.js | **22+ (current LTS)** | Runtime for the Capacitor CLI and native build tooling | Capacitor 8 requires Node 22 or newer; older Node will fail CLI commands (CONFIDENCE: MEDIUM) |
| Android Studio | **Otter (2025.2.1) or newer** | Compiles, signs, and builds the Android App Bundle | Capacitor 8's Android platform requires this Android Studio generation and its bundled Android Gradle Plugin; runs fine on Windows (CONFIDENCE: MEDIUM) |

### Supporting Libraries (Capacitor plugins)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/preferences` | latest 8.x-compatible | Durable native key-value storage (`SharedPreferences` on Android) | **Use for the save file and graveyard, not raw `localStorage`.** Android's System WebView storage is evictable under storage pressure, idle/maintenance sweeps, or a user tapping "clear storage" in Android settings. Preferences is the officially-recommended durable substitute (CONFIDENCE: MEDIUM) |
| `@capacitor/app` | latest 8.x-compatible | Hooks the Android hardware/gesture back button | Required so Android's back button does something sane (close a menu, confirm-exit) instead of Capacitor's default (which can pop the WebView history or exit unexpectedly) — a common Play Store UX complaint if unhandled |
| `@capacitor/splash-screen` | latest 8.x-compatible | Native splash screen shown while the WebView boots | Avoids a flash of unstyled white screen on cold start; cheap to configure, expected on Play |
| `@capacitor/status-bar` | latest 8.x-compatible | Controls status bar color/style | Lets the parchment/paper theme extend under the status bar cleanly |
| `@capacitor/screen-orientation` (community) | latest | Lock to portrait | The UI (1080px reflow, tap-to-move map, bottom RAIL card) is portrait-first; lock orientation rather than build responsive landscape layouts |
| `@capacitor/haptics` | latest 8.x-compatible | Light haptic tap on hits/traps/level-ups | Optional differentiator — cheap "native feel" polish, not required for MVP |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Android Studio | Android build, signing, bundle generation | Fully usable on Windows; no blocker here |
| `keytool` / Android Studio's built-in signing wizard | Generates the one-time upload keystore | Back this file up somewhere durable (losing it without Play App Signing enrolled would be catastrophic; with Play App Signing enrolled, Google can help recover) |
| Fastlane (optional) or Codemagic/Appflow CI | Automates repetitive signing/build/upload steps | Strongly recommended for a solo dev doing Play submissions manually the first time is painful and error-prone; not required for a first manual submission but pays off on every update afterward |
| VS Code + a local static file server (e.g. `npx serve`, `live-server`) | Keep iterating on `mazeworld.html` as a normal web page | The vanilla-JS prototype needs zero build step to keep developing in a browser; only wrap with `npx cap sync` when testing/shipping the native shell |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Capacitor | Cordova | Never for a new project — Cordova is the predecessor Capacitor was built to replace and is effectively deprecated; only relevant if inheriting a legacy Cordova codebase |
| Capacitor | React Native / Expo | If you were starting from scratch with no working UI and wanted a single native-widget-based codebase; wrong fit here because it requires re-authoring the entire proven DOM UI in JSX/native components for no functional gain |
| Capacitor | Flutter | Same reasoning as React Native, plus a new language (Dart) for a solo first-timer — highest rewrite cost of all options considered |
| Capacitor | Godot / Unity (engine port) | If the game were a real-time action game needing sprite batching, physics, or particle-heavy rendering at scale — not the case for a turn-based, DOM-panel-heavy, single-canvas-maze roguelike |
| `@capacitor/preferences` for saves | Raw `localStorage` only | Never for the shipped app — acceptable only in the browser-based dev loop before wrapping, since native WebView storage is evictable |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Cordova | Deprecated predecessor to Capacitor; weaker maintenance, WebView bridge is a documented performance bottleneck Capacitor was built to fix | Capacitor |
| Any ad or analytics SDK (Firebase Analytics, AdMob, etc.) | Directly contradicts the paid-upfront, no-ads/IAP constraint; also forces extra disclosures on Play's privacy forms and adds network calls to a "fully offline" app | Nothing — ship with zero third-party SDKs beyond Capacitor's own plugins |
| Raw `localStorage` as the sole save mechanism in the shipped native app | Evictable under Android storage pressure; risks silently deleting a player's graveyard and in-progress run | `@capacitor/preferences`, optionally with `localStorage` kept as a fast in-memory mirror during a session |
| A custom native WebView wrapper written by hand (raw `android.webkit.WebView` project) | Reinvents plugin bridging, lifecycle handling, and store-compliant boilerplate (splash screen, back-button, status bar) that Capacitor already solves and maintains | Capacitor |
| Electron | Desktop-only technology; irrelevant to "must ship to Google Play" | Capacitor |

## Stack Patterns by Variant

- Keep all game logic reachable through the existing `S` state object and `act()` dispatcher, fully serializable to/from JSON, with **zero direct DOM reads/writes inside the rules engine functions** (only in rendering/UI code that consumes `S`).
- Because Capacitor changes nothing about the JS runtime — the same rules engine that runs in a browser tab runs unmodified inside the WebView — a later multiplayer layer can add a thin WebSocket/relay client that serializes `S` diffs, without touching how the app is packaged. This is the direct payoff of choosing "wrap, don't rewrite": the decoupling the author already built survives the packaging decision entirely.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Capacitor 8.x | Node 22+ | CLI will fail confusingly on older Node — check `node -v` before `npx cap` commands |
| Capacitor 8.x (Android) | Android Studio Otter (2025.2.1)+ | Older Android Studio / Android Gradle Plugin versions are not guaranteed to build a Capacitor 8 Android project |
| Android target SDK | API 36 (Android 16) for new apps/updates from Aug 31, 2026; API 35 minimum for existing apps | Play Console will reject submissions targeting lower API levels after the deadline (extension to Nov 1, 2026 available on request); re-check `developer.android.com/google/play/requirements/target-sdk` before each submission since this floor rises annually |

## Store-Submission Prerequisites (concrete, for a first-timer)

### Google Play

| Requirement | Detail |
|---|---|
| Developer account | Google Play Console, **one-time $25 USD registration fee** (no recurring fee). Personal accounts created since early 2024 must verify access to a real Android device during setup. Organization accounts require a linked Business Google Payments Profile. |
| Hardware | Fully buildable on Windows via Android Studio. |
| Build format | **Android App Bundle (`.aab`) is mandatory** for all new apps (has been since August 2021); plain `.apk` uploads are not accepted for new listings. |
| Code signing | Generate an upload keystore once (`keytool`/Android Studio wizard); **Play App Signing enrollment is mandatory** for new apps — Google holds/manages the real signing key, you keep the upload key. Back up the upload keystore; losing it is recoverable via Play App Signing's key-reset process but is a hassle. |
| Target API level | New apps/updates must target **Android 16 (API level 36)** by Aug 31, 2026 (extension to Nov 1, 2026 available on request); existing apps need at least API 35 to stay visible to new users on newer OS versions. This floor rises yearly — verify current requirement at submission time. |
| Age rating / content | Google Play uses the **IARC (International Age Rating Coalition) questionnaire** inside Play Console — answer honestly (mild fantasy violence, no profanity/gore) to get an appropriately low rating (Google's system typically yields "PEGI 3 / Everyone"-equivalent for this content profile). |
| Privacy | **Data Safety section is mandatory for every app, no skip option**, even ones collecting nothing. "Collected" is defined as data leaving the device; a fully offline app with local-only save/graveyard data can declare **"No data collected or shared."** A privacy policy link is also good practice to have ready even if not strictly gated the same way. |
| Pricing | Set as a **paid app** at a chosen price in Play Console — again, a console configuration, not an SDK/code requirement. No Play Billing Library integration needed for a pure paid-upfront app with no IAP. |
| Review | Google Play review is typically fast for straightforward apps (often same-day to a few days), but new developer accounts / first app submissions can be subject to longer, more manual review; budget a few days of buffer. |

## Sources

- https://www.npmjs.com/package/@capacitor/android — Capacitor 8.x current version (CONFIDENCE: MEDIUM, cross-checked)
- https://ionic.io/blog/announcing-capacitor-8 — Capacitor 8 SPM default, Android Studio Otter requirement (CONFIDENCE: MEDIUM)
- https://capacitorjs.com/docs/updating/8-0 — Capacitor 8 migration/requirements (CONFIDENCE: MEDIUM)
- https://support.google.com/googleplay/android-developer/answer/6112435 and consolemint/afkarsoftware guides — Google Play $25 one-time fee, device verification (CONFIDENCE: MEDIUM, cross-checked across several independent sites)
- https://developer.android.com/guide/app-bundle/faq , https://developer.android.com/studio/publish/app-signing — mandatory AAB format since 2021, mandatory Play App Signing for new apps (CONFIDENCE: MEDIUM)
- https://support.google.com/googleplay/android-developer/answer/11926878 and https://developer.android.com/google/play/requirements/target-sdk — API 36 target requirement by Aug 31 2026, API 35 floor for existing apps (CONFIDENCE: MEDIUM)
- https://support.google.com/googleplay/android-developer/answer/10787469 — Data Safety form mandatory, on-device-only data doesn't count as "collected" (CONFIDENCE: MEDIUM)
- GitHub issue ionic-team/capacitor#636 ("localStorage lost on app reboot") and Capacitor Preferences plugin docs (capacitorjs.com/docs/apis/preferences) — localStorage eviction risk in WebViews, recommendation to use Preferences plugin (CONFIDENCE: MEDIUM)
- https://excaliburjs.com/blog/android-games-capacitor/ , https://capgo.app/blog/capacitor-vs-cordova/ — Capacitor as the standard path for wrapping existing JS/canvas web games; Cordova deprecated/legacy (CONFIDENCE: MEDIUM)
- Direct inspection of `C:\projects\mazeworld\mazeworld.html` (5,580 lines at Phase 48's close) — DOM+CSS UI with a single `<canvas>` maze renderer and tap-to-move; persistence through `src/browser/storage.js` (`@capacitor/preferences`, with a `localStorage` mirror for the browser dev loop); no `fetch`/`WebSocket`/Worker/ServiceWorker usage (CONFIDENCE: HIGH — primary source, direct code read)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
