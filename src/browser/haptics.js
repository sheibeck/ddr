// src/browser/haptics.js
//
// 04-DR9 (Settings sheet, completing UX-07's haptics toggle): a guarded,
// fail-open haptics seam. `@capacitor/haptics` is deliberately NOT installed
// yet (not in package.json's dependencies, not in tools/build-www.mjs's
// CAPACITOR_PACKAGES vendor list, no `npx cap sync` run for it) — per the
// phase's own scope, adding the real dependency + native sync is a separate,
// later step. This module exists so the Settings sheet's "Haptics" toggle
// has a REAL call site wired today: flipping haptics on later is then a
// one-line change (installing + vendoring the plugin), not a new
// integration hunt.
//
// Mirrors src/browser/nativeChrome.js's guarded-dynamic-import posture:
// `@capacitor/haptics` is only ever reached via a bare-specifier import()
// inside a try/catch, so `node --test`, the plain browser dev loop, and a
// native build that hasn't vendored the plugin yet all resolve this to a
// harmless no-op rather than an unhandled module-resolution error.

/**
 * maybeHaptic(settings, style) — fires a light haptic impact if and only if
 * (a) settings.haptics is true AND (b) the app is running under a native
 * Capacitor platform. Today this ALWAYS resolves to a no-op even when both
 * conditions hold, because `@capacitor/haptics` is not installed/vendored —
 * the dynamic import always rejects, caught below. Never throws; always a
 * fire-and-forget async call (callers never need to await this to block
 * anything), matching 04-CONTEXT.md's "cheap polish, not required for MVP"
 * framing for haptics beyond the settings toggle itself.
 */
export async function maybeHaptic(settings, style = "Light") {
  try {
    if (!settings?.haptics) return;
    if (!globalThis.Capacitor?.isNativePlatform?.()) return;
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics?.impact?.({ style: ImpactStyle?.[style] ?? style });
  } catch {
    // @capacitor/haptics is not installed/vendored yet (see this module's
    // header comment) — fail-open no-op until a future plan adds the
    // dependency, vendors it in tools/build-www.mjs, and runs `npx cap sync`.
  }
}
