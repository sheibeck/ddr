# D-21 spike: can the whole Android build move to AGP 9.3.1?

Time-boxed (~60 min) build spike run in an isolated worktree
(`worktree-agent-a2e4ecdb18283dd43`), Windows host, JDK 21 pinned.
Tests: `@modbender/capacitor-play-games@0.5.0` (whose own
`android/build.gradle` declares AGP 9.3.1 + Kotlin Gradle Plugin 2.4.10)
against the pinned toolchain (AGP 8.13.0 / Gradle 8.14.3 / Capacitor 8.5.x)
and against a genuine whole-build upgrade to AGP 9.3.1.

**VERDICT: STAY ON AGP 8.13.0** — the plugin needs no Gradle fix on 8.13;
it already builds a working debug APK there unmodified. Do NOT attempt
the whole-build AGP 9.3.1 upgrade for plan 67-06; adopt the plugin as-is
on the current pinned toolchain (matches ruling D-20).

## Baseline (step 1)

`npm run android:debug` on the unmodified tree: **PASS**, `BUILD SUCCESSFUL
in 4m 52s` (5m 22s wall including cap:sync/pin-jdk). Confirms the worktree
setup (npm ci + copied `android/local.properties`) is sound.

## Plugin on the pinned AGP 8.13.0 (step 2)

`npm install --save-exact @modbender/capacitor-play-games@0.5.0`, then
`npm run android:debug` with **no other changes**: **PASS**,
`BUILD SUCCESSFUL in 6m 5s`. The plugin's own `android/build.gradle`
buildscript block (`classpath 'com.android.tools.build:gradle:9.3.1'` +
`classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10'`) did **not**
break the pinned build. `:modbender-capacitor-play-games:compileDebugKotlin`
ran (later confirmed `UP-TO-DATE` on a follow-up plain-console run) with no
errors — Kotlin sources compiled cleanly. Only a Kotlin-Gradle-Plugin
warning appeared ("Gradle 8.14.3 is deprecated and will not be supported in
future Kotlin Gradle Plugin releases" — advisory, not a failure).

Working theory: in this legacy (non-`plugins{}`-DSL) multi-project Gradle
setup, each subproject's own local `buildscript{}` classpath is a *child*
classloader of the root project's; Java's parent-first delegation means the
subproject's self-declared AGP 9.3.1/KGP 2.4.10 jars are effectively
shadowed by whatever's already resolved for the parent (AGP 8.13.0), so the
plugin silently builds against the pinned AGP 8.13.0 despite what its own
buildscript block claims to require. This is exactly why moving the *whole*
build is unnecessary for a working debug APK today.

## Attempting the full AGP 9.3.1 upgrade anyway (step 3, 4 attempts)

Per spike instructions, attempted the real upgrade to see if it's viable
for the future (AGP 9.3.1 requires **Gradle 9.5.0** minimum — confirmed via
the AGP 9.3.0 release notes; JDK 21 already pinned satisfies AGP 9's JDK 17+
floor).

Changes made (all reverted after the spike — see below):
- `android/build.gradle`: AGP classpath `8.13.0` → `9.3.1`
- `android/gradle/wrapper/gradle-wrapper.properties`: Gradle `8.14.3` → `9.5.0`
- `android/app/build.gradle`: `proguard-android.txt` → `proguard-android-optimize.txt`
- `tools/pin-jdk.mjs`: extended to also pin `android.builtInKotlin=false`
  and `android.newDsl=false` in `android/gradle.properties` (survives
  `cap sync`'s regeneration the same way `org.gradle.java.home` does)

**Attempt 1** (AGP 9.3.1 + Gradle 9.5.0, no other changes): FAILED at
project-configuration time.
```
Build file '...\android\app\build.gradle' line: 58
`getDefaultProguardFile('proguard-android.txt')` is no longer supported
since it includes `-dontoptimize`... Instead use
`getDefaultProguardFile('proguard-android-optimize.txt)`
```
Duration: 4m 42s to failure.

**Attempt 2** (+ proguard fix): FAILED, two configuration errors.
```
Failed to apply plugin 'org.jetbrains.kotlin.android'.
> Cannot add extension with name 'kotlin', as there is an extension
  already registered with that name.

Android Gradle Plugin: project ':modbender-capacitor-play-games' does not
specify `compileSdk` in build.gradle
```
Root cause: AGP 9's built-in Kotlin support (default-on) registers its own
`kotlin` extension; the plugin's own build.gradle *also* unconditionally
applies the classic `org.jetbrains.kotlin.android` plugin, which tries to
register the same extension name and collides. Duration: 1m 11s to failure.

**Attempt 3** (+ `android.builtInKotlin=false`): FAILED, new error —
opting out of built-in Kotlin fixed the double-extension collision but
exposed a deeper incompatibility:
```
Failed to apply plugin 'org.jetbrains.kotlin.android'.
> class com.android.build.gradle.internal.dsl.LibraryExtensionImpl$AgpDecorated_Decorated
  cannot be cast to class com.android.build.gradle.BaseExtension

Android Gradle Plugin: project ':modbender-capacitor-play-games' does not
specify `compileSdk` in build.gradle
```
AGP 9.x removed the old `BaseExtension`/`AppExtension`/`LibraryExtension`
DSL implementation types entirely (confirmed via Android's own AGP 9
migration notes) — classic Kotlin Gradle Plugin 2.4.10 still casts to
`BaseExtension` when self-applying, and that cast now fails regardless of
the `builtInKotlin` flag. Duration: 5s to failure (fast, config-phase only).

**Attempt 4** (+ `android.newDsl=false`, opting back into AGP 9's legacy DSL
implementation classes): configuration succeeded — both prior errors
gone — and the build progressed all the way to real Kotlin compilation.
FAILED there with a genuine source error inside the plugin's own shipped
`.kt` file:
```
> Task :modbender-capacitor-play-games:compileDebugKotlin FAILED
e: .../node_modules/@modbender/capacitor-play-games/android/src/main/java/
   com/idleflowgames/playgames/Pgs.kt:144:80 Returns are prohibited for
   functions with an expression body. Use block body '{...}'.
```
The offending line is ordinary, valid, idiomatic Kotlin
(`fun ... : Int? = (requireNumber(key) ?: return null).toInt32(this, key)`
— `return` as a `Nothing`-typed expression inside an elvis operator is
standard Kotlin and compiles fine under the plugin's own AGP-8.13-shadowed
path, per step 2). This only surfaces once root AGP is genuinely 9.3.1 and
the plugin's own KGP 2.4.10 actually takes effect (no longer shadowed) —
most likely a KGP 2.4.10 / AGP-9-builtin-Kotlin-interaction regression, or
a stricter frontend triggered by the AGP 9 toolchain. Fixing it requires
editing the plugin's own shipped source (`node_modules/@modbender/...`),
which this spike is explicitly forbidden from doing, or an upstream fix
from the plugin author. Duration: 3m 56s to failure.

Stopped here (4 of the ~6-attempt budget) — this is a hard, external
blocker in third-party source, not something reachable from root-level
config, so further root-only attempts would not converge.

**All experimental changes (root `build.gradle`, wrapper properties,
`android/app/build.gradle`, `tools/pin-jdk.mjs`) were reverted via
`git checkout --` before finishing.** `npm run test` was re-run after the
plugin+config revert: 4429/4436 passing, 7 failing — the known CRLF
doc-ledger failures that only occur in worktrees (matches the expected
baseline; nothing else broke).

## Dependency audit

Not run — the AGP 9.3.1 debug APK never built, so there is nothing to run
`:app:dependencies` against. (No ads/analytics artifacts were introduced by
the plugin install either way — `play-services-games-v2` only, per the
plugin's own `android/build.gradle`.)

## Recommendation for plan 67-06

Install `@modbender/capacitor-play-games@0.5.0` on the **current pinned
toolchain (AGP 8.13.0 / Gradle 8.14.3)** — it already produces a working
debug APK with zero root-config changes, confirmed twice in this spike.
Do not attempt an AGP 9.3.1 migration until the plugin author either drops
the redundant `org.jetbrains.kotlin.android` self-application (letting AGP
9's built-in Kotlin handle it) or fixes/upgrades past whatever KGP 2.4.10
regression breaks `Pgs.kt:144`. Re-run this spike against a newer plugin
release if/when one ships that changes its own `android/build.gradle`.
