// src/browser/nativeChrome.js
//
// PLT-02 (back button) + PLT-03/SAV-01 (lifecycle-flush) — 02-RESEARCH.md
// "Back Button + Lifecycle". Exports:
//
//   - decideBackAction(...): a PURE function, no side effects, no native
//     dependency at all — the load-bearing correctness guarantee is that
//     there is NO input combination that lets a live, unconfirmed run end
//     silently (T-02-05).
//   - flushOnBackground(storage): an async helper that AWAITS storage.flush()
//     — the single most safety-critical async-ordering concern in the whole
//     persistence design (T-02-04): a fire-and-forget write started in a
//     pause/appStateChange handler has no guarantee of completing before the
//     OS suspends/kills the process.
//   - registerNativeChrome({...}): the native-only wiring that reaches
//     `@capacitor/app` (and, for chrome finalized in 02-04,
//     `@capacitor/splash-screen`/`@capacitor/status-bar`/
//     `@capacitor/screen-orientation`) via GUARDED DYNAMIC import() calls
//     ONLY — every dependency is also directly injectable (matching
//     src/browser/storage.js's own posture) so `node --test` and the plain
//     browser dev loop never need to resolve a bare `@capacitor/*` specifier.
//     Called exactly once, from mazeworld.html's trailing module, and only
//     when `window.Capacitor?.isNativePlatform?.()` is true.

/**
 * decideBackAction({ hasOpenModal, hasLiveRun, isAtRoot, canGoBack,
 * alreadyConfirming }) — pure decision function for an Android hardware/
 * gesture back press. Registering ANY `backButton` listener disables
 * Capacitor's own default behavior entirely (02-RESEARCH.md), so this game
 * owns 100% of back semantics; the guarantee this function exists to make
 * unit-provable is that a live, non-dead/non-won run can NEVER be lost to a
 * back press without an explicit confirm step first (PLT-02):
 *
 *   1. an open modal/encounter card always closes first (one level).
 *   2. otherwise, if there's somewhere to navigate back to, navigate.
 *   3. otherwise, once the caller has already shown a confirm state
 *      (`alreadyConfirming`), the press really does exit.
 *   4. otherwise, a live run means the FIRST press only asks for
 *      confirmation — never exits directly.
 *   5. only with no live run to lose does the very first press exit.
 */
export function decideBackAction({
  hasOpenModal = false,
  hasLiveRun = false,
  isAtRoot = true,
  canGoBack = false,
  alreadyConfirming = false,
} = {}) {
  if (hasOpenModal) return "close-modal";
  if (!isAtRoot && canGoBack) return "navigate-back";
  if (alreadyConfirming) return "exit-app";
  if (hasLiveRun) return "confirm-quit";
  return "exit-app";
}

/**
 * flushOnBackground(storage) — awaits `storage.flush()` (src/browser/
 * storage.js's per-key write-queue drain) so the caller (registerNativeChrome's
 * pause/appStateChange handlers below) can be certain every in-flight write
 * has settled before returning. Never throws: a missing/malformed `storage`
 * or a rejecting `flush()` just means this resolves anyway — matches
 * storage.js's own fail-safe, never-throw posture, and a background handler
 * that itself threw would be far worse than one that merely couldn't flush.
 */
export async function flushOnBackground(storage) {
  try {
    await storage?.flush?.();
  } catch {
    /* storage.flush() already never rejects, but defend anyway — a
       background handler must never throw */
  }
}

/**
 * registerNativeChrome({ App, SplashScreen, StatusBar, ScreenOrientation,
 * storage, getGameContext }) — wires the Android back button and app
 * lifecycle listeners (PLT-02/PLT-03), plus (stubbed here, finalized in
 * 02-04) splash/status-bar/orientation chrome. Every plugin object is
 * injectable for testing; when omitted, it is reached via a dynamic
 * import() so `node --test`/the browser dev loop (where isNativePlatform()
 * is false and this function is never called at all) never attempt to
 * resolve a bare `@capacitor/*` specifier.
 *
 * `getGameContext()` is called fresh on every backButton press and must
 * return `{ hasOpenModal, hasLiveRun, isAtRoot, closeModal, navigateBack,
 * showConfirmQuit }` — the boolean fields feed decideBackAction (`canGoBack`
 * comes from the event payload itself), the callbacks perform the chosen
 * action. `alreadyConfirming` is tracked internally here (a `confirming` flag
 * that a subsequent press within a short window escalates to `exit-app`,
 * reset by any non-confirm action) — the caller's getGameContext() does not
 * need to track it.
 */
export async function registerNativeChrome({
  App: injectedApp,
  SplashScreen: injectedSplashScreen,
  StatusBar: injectedStatusBar,
  ScreenOrientation: injectedScreenOrientation,
  storage,
  getGameContext,
} = {}) {
  const App = injectedApp || (await import("@capacitor/app")).App;

  let confirming = false;
  let confirmTimer = null;
  function resetConfirm() {
    confirming = false;
    if (confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
  }

  App.addListener("backButton", ({ canGoBack } = {}) => {
    const ctx = (typeof getGameContext === "function" ? getGameContext() : null) || {};
    const action = decideBackAction({
      hasOpenModal: !!ctx.hasOpenModal,
      hasLiveRun: !!ctx.hasLiveRun,
      isAtRoot: !!ctx.isAtRoot,
      canGoBack: !!canGoBack,
      alreadyConfirming: confirming,
    });

    switch (action) {
      case "close-modal":
        resetConfirm();
        ctx.closeModal?.();
        break;
      case "navigate-back":
        resetConfirm();
        ctx.navigateBack?.();
        break;
      case "confirm-quit":
        confirming = true;
        ctx.showConfirmQuit?.();
        confirmTimer = setTimeout(resetConfirm, 2000);
        if (typeof confirmTimer.unref === "function") confirmTimer.unref();
        break;
      case "exit-app":
        resetConfirm();
        App.exitApp?.();
        break;
      default:
        break;
    }
  });

  // PLT-03/SAV-01: both events await the flush before resolving — a
  // fire-and-forget write here has no guarantee of completing before the OS
  // suspends/kills the process (02-RESEARCH.md's awaited-flush correctness
  // note).
  App.addListener("pause", () => flushOnBackground(storage));
  App.addListener("appStateChange", ({ isActive } = {}) => {
    if (!isActive) return flushOnBackground(storage);
  });

  // PLT-04 chrome — splash hide / status-bar style / portrait lock. Stubbed
  // here (best-effort, never throws) so this single call site is safe to
  // wire today; 02-04 finalizes the exact config against the real assets.
  try {
    const SplashScreen = injectedSplashScreen || (await import("@capacitor/splash-screen")).SplashScreen;
    await SplashScreen?.hide?.();
  } catch {
    /* splash-screen plugin unavailable/not yet configured — non-fatal */
  }
  try {
    const StatusBar = injectedStatusBar || (await import("@capacitor/status-bar")).StatusBar;
    await StatusBar?.setStyle?.({ style: "DARK" });
  } catch {
    /* status-bar plugin unavailable/not yet configured — non-fatal */
  }
  try {
    const ScreenOrientation = injectedScreenOrientation || (await import("@capacitor/screen-orientation")).ScreenOrientation;
    await ScreenOrientation?.lock?.({ orientation: "portrait" });
  } catch {
    /* screen-orientation plugin unavailable/not yet configured — non-fatal */
  }
}
