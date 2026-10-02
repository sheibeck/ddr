// src/browser/devBuild.js
//
// The dev-row build gate. The hidden Settings dev rows (#mw-dev-row, "Start at
// depth", and #mw-dev-pgs-row, the Play Games probe and its Fake sign-in) are
// for debug builds only; the release AAB must not reveal them (user ruling,
// 2026-10-02).
//
//   - On a native platform the answer comes from the PlayIdentity plugin's
//     buildInfo() (BuildConfig.DEBUG). It FAILS CLOSED: only an answer of
//     exactly { ok: true, debug: true } allows the dev tools. A missing seam,
//     a rejected or throwing call, a malformed answer and debug: false all
//     mean "not a debug build".
//   - In the browser dev loop (not native) the dev tools stay available: the
//     web build is never hosted publicly (firebase.json has no hosting block;
//     www/ is only the Capacitor webDir), so the dev loop is the developer's
//     own machine.
//
// No DOM, no window access. The shell passes `native` and the PlayIdentity
// seam in. Asking buildInfo never starts the Play Games SDK (the plugin
// method does not call ensureInit), so this does not touch the 92.1 privacy
// gate.

/**
 * devToolsAllowed({ native, identity }) — resolves true or false, never
 * rejects. `native` is window.Capacitor.isNativePlatform() === true;
 * `identity` is the shell's PlayIdentity seam (only read when native).
 */
export async function devToolsAllowed({ native, identity } = {}) {
  if (native !== true) return native === false;
  try {
    const info = await identity.buildInfo();
    return !!info && info.ok === true && info.debug === true;
  } catch {
    return false;
  }
}
