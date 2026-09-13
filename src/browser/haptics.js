// src/browser/haptics.js
//
// UX-07 haptics seam (Settings sheet's "Haptics" toggle). `@capacitor/haptics`
// IS now installed (package.json dependency ^8.0.2) and vendored
// (tools/build-www.mjs CAPACITOR_PACKAGES), so on a synced native build this
// fires real device haptics; in `node --test`, the plain browser dev loop, and
// a not-yet-synced build it stays a harmless no-op.
//
// Mirrors src/browser/nativeChrome.js's guarded-dynamic-import posture:
// `@capacitor/haptics` is only ever reached via a bare-specifier import()
// inside a try/catch, so any environment where the plugin can't resolve (or
// isn't a native platform) degrades to a no-op rather than an unhandled
// module-resolution error. The `__mzHapticsImportOverride` hook mirrors
// nativeChrome.js's `__mzAppImportOverride`: it lets `node --test` inject a
// fake plugin and assert impact() is actually CALLED (or NOT called when the
// setting is off) without resolving the bare specifier. Production never sets
// it, so a real native launch always falls through to the real import.

/**
 * maybeHaptic(settings, style) — fires a haptic impact if and only if
 * (a) settings.haptics is true AND (b) the app is running under a native
 * Capacitor platform. `style` is an ImpactStyle key ("Light" | "Medium" |
 * "Heavy") — mapped to the plugin's enum, falling back to the raw string.
 * Never throws; always a fire-and-forget async call (callers never need to
 * await this to block anything), matching 04-CONTEXT.md's "cheap polish, not
 * required for MVP" framing for haptics beyond the settings toggle itself.
 */
export async function maybeHaptic(settings, style = "Light") {
  try {
    if (!settings?.haptics) return;
    if (!globalThis.Capacitor?.isNativePlatform?.()) return;
    const mod = globalThis.__mzHapticsImportOverride
      ? await globalThis.__mzHapticsImportOverride()
      : await import("@capacitor/haptics");
    const { Haptics, ImpactStyle } = mod;
    await Haptics?.impact?.({ style: ImpactStyle?.[style] ?? style });
  } catch {
    // Plugin unresolvable (not a native platform / not yet synced) — fail-open
    // no-op. Haptics is cosmetic polish; a beat must never throw.
  }
}
