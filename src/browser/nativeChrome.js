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
//
//     CR-03 (02-REVIEW.md): the splash-hide/status-bar/orientation chrome
//     runs BEFORE the `@capacitor/app` import/back-button/lifecycle wiring
//     (deliberately reordered from the plugin's declaration order above) —
//     since capacitor.config.json sets "launchAutoHide": false,
//     SplashScreen.hide() is the ONLY thing that ever hides the native
//     splash, so it must never be reachable-only-through a step that can
//     throw first. A broken `@capacitor/app` import can therefore only cost
//     back-button/lifecycle wiring for that launch, never soft-lock the app
//     on its splash screen.

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
 * flushOnBackground(storage, waitForPending) — awaits `storage.flush()`
 * (src/browser/storage.js's per-key write-queue drain) so the caller
 * (registerNativeChrome's pause/appStateChange handlers below) can be
 * certain every in-flight write has settled before returning. Never throws:
 * a missing/malformed `storage` or a rejecting `flush()` just means this
 * resolves anyway — matches storage.js's own fail-safe, never-throw posture,
 * and a background handler that itself threw would be far worse than one
 * that merely couldn't flush.
 *
 * CR-02 (02-REVIEW.md): `storage.flush()` alone cannot see a write that
 * hasn't reached `storage.setItem()` yet — e.g. engineAdapter.js's
 * `persistGrave()` is still awaiting its own `storage.getItem()` read when a
 * `pause`/`appStateChange(inactive)` event fires. The optional
 * `waitForPending` callback (engineAdapter.js's `waitForPending()`, wired by
 * registerNativeChrome below) is awaited ALONGSIDE `storage.flush()` so that
 * still-reading write is not lost. Both are awaited in parallel — either one
 * failing/being absent never blocks the other.
 */
export async function flushOnBackground(storage, waitForPending) {
  await Promise.all([
    (async () => {
      try {
        await storage?.flush?.();
      } catch {
        /* storage.flush() already never rejects, but defend anyway — a
           background handler must never throw */
      }
    })(),
    (async () => {
      try {
        await waitForPending?.();
      } catch {
        /* same fail-safe posture as storage.flush() above */
      }
    })(),
  ]);
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
  waitForPending,
  getGameContext,
} = {}) {
  // CR-03 (02-REVIEW.md): splash-hide/status-bar/orientation chrome runs
  // FIRST and independently of the '@capacitor/app' import below. Because
  // capacitor.config.json sets "launchAutoHide": false, SplashScreen.hide()
  // below is the ONLY thing that ever hides the native splash screen — if it
  // ran AFTER an unguarded `@capacitor/app` import that then threw, the
  // splash would stay up forever even though the WebView underneath is
  // fully booted and playable (a permanent soft-lock). Running it first
  // means a broken '@capacitor/app' import can only cost back-button/
  // lifecycle wiring, never the ability to see or play the game at all.
  try {
    const SplashScreen = injectedSplashScreen || (await import("@capacitor/splash-screen")).SplashScreen;
    await SplashScreen?.hide?.();
  } catch {
    /* splash-screen plugin unavailable/not yet configured — non-fatal */
  }
  try {
    const StatusBar = injectedStatusBar || (await import("@capacitor/status-bar")).StatusBar;
    // Style.Light = "dark text for light backgrounds" (StatusBar's own naming
    // is inverted from what it sounds like) — matches mazeworld.html's
    // --paper (#EFE7D6) parchment theme extending under the status bar.
    await StatusBar?.setStyle?.({ style: "LIGHT" });
    await StatusBar?.setBackgroundColor?.({ color: "#EFE7D6" });
  } catch {
    /* status-bar plugin unavailable/not yet configured — non-fatal */
  }
  try {
    const ScreenOrientation = injectedScreenOrientation || (await import("@capacitor/screen-orientation")).ScreenOrientation;
    await ScreenOrientation?.lock?.({ orientation: "portrait" });
  } catch {
    /* screen-orientation plugin unavailable/not yet configured — non-fatal */
  }

  // CR-03: the '@capacitor/app' import is guarded the same way as the three
  // plugins above — if it rejects, the back-button/lifecycle wiring below is
  // simply unavailable for this launch (silently reintroducing PLT-02/PLT-03
  // regressions for that session), but the splash/status-bar/orientation
  // chrome above has ALREADY run, so the app is never soft-locked on the
  // splash screen because of it.
  let App;
  try {
    App = injectedApp || (await import("@capacitor/app")).App;
  } catch {
    return;
  }
  if (!App) return;

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
  // note). CR-02: `waitForPending` (e.g. engineAdapter.js's
  // waitForPending()) is awaited alongside storage.flush() so a write still
  // in its pre-setItem() read phase isn't missed either.
  App.addListener("pause", () => flushOnBackground(storage, waitForPending));
  App.addListener("appStateChange", ({ isActive } = {}) => {
    if (!isActive) return flushOnBackground(storage, waitForPending);
  });
}
