package com.darktierstudios.delvedierepeat;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * PlayIdentity: the in-repo Capacitor plugin that gives the game a Play Games
 * identity (Phase 91.2, D-02). Four Play Games methods, all of which RESOLVE
 * and never reject into the UI: init, status, signIn, serverAuthCode. A fifth,
 * buildInfo, is not Play Games at all (see below).
 *
 * INIT AND THE PRIVACY GATE (Phase 92.1, BOARD-31). The Play Games SDK
 * signs the player in as soon as it is initialized, so it must start only
 * while Compete is ON. The manifest removes the SDK's own auto-init provider
 * (PlayGamesInitProvider, tools:node="remove"); the SDK now starts from
 * exactly two places, both through initSdkOnce(), which is idempotent and
 * shared by the whole process:
 *   1. MainActivity.onCreate, before super.onCreate, on a cold launch whose
 *      stored settings say Compete is ON (a missing or unreadable blob is
 *      ON, the default). Its automatic silent sign-in needs initialize to
 *      run before the first onActivityCreated.
 *   2. This plugin's ensureInit(), from the first init/status/signIn/
 *      serverAuthCode call. The JS shell only calls the plugin while Compete
 *      is ON, so a Compete turned ON mid-session starts the SDK here (the
 *      interactive signIn then prompts the player).
 * A Compete-OFF cold launch therefore never starts the SDK. This replaces the
 * Phase 91.2 assumption A6 (lazy init from the first method call), which was
 * wrong: the SDK's own provider initialized it at every launch regardless.
 *
 * SUPPRESS_GAME_PROFILE_CREATION is deliberately NOT set: a player without a
 * Play Games profile should be able to make one at sign-in.
 *
 * SCOPES. serverAuthCode uses the two-argument requestServerSideAccess, which
 * requests no extra scopes. PROFILE, EMAIL and OPEN_ID are never requested
 * (they expose a real name and email).
 *
 * BUILD INFO (dev-row gate). buildInfo() answers { ok: true, debug } from
 * BuildConfig.DEBUG, so the JS shell can show its hidden dev rows (start at
 * depth, the Play Games probe) on a debug build only, never on the release
 * AAB. It does NOT call ensureInit(): reading the build flag must never start
 * the Play Games SDK, or the 92.1 privacy gate above would be bypassed by a
 * Compete-OFF launch. The shell treats a failed or missing answer as NOT debug.
 *
 * PRIVACY. Nothing here logs a player id, a display name or an auth code.
 */
@CapacitorPlugin(name = "PlayIdentity")
public class PlayIdentityPlugin extends Plugin {

    /** Process-wide: MainActivity and this plugin share one initialize. */
    private static boolean sdkInitialized = false;

    /**
     * Starts the Play Games SDK once per process, from whichever caller gets
     * here first (MainActivity on a Compete-ON cold launch, or the plugin).
     * Throws only if the SDK itself does; the flag is raised only after
     * initialize returned, so a failed start can be retried.
     */
    static synchronized void initSdkOnce(Context context) {
        if (!sdkInitialized) {
            PlayGamesSdk.initialize(context.getApplicationContext());
            sdkInitialized = true;
        }
    }

    private void ensureInit() {
        initSdkOnce(getContext());
    }

    private static JSObject failure(String reason) {
        JSObject out = new JSObject();
        out.put("ok", false);
        out.put("reason", reason);
        return out;
    }

    private static JSObject signedOut() {
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("signedIn", false);
        return out;
    }

    /**
     * Debug-or-release flag for the shell's dev-row gate. Touches no Play
     * Games API and never calls ensureInit() (the SDK stays uninitialized).
     */
    @PluginMethod
    public void buildInfo(PluginCall call) {
        try {
            JSObject out = new JSObject();
            out.put("ok", true);
            out.put("debug", BuildConfig.DEBUG);
            call.resolve(out);
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    @PluginMethod
    public void init(PluginCall call) {
        try {
            ensureInit();
            JSObject out = new JSObject();
            out.put("ok", true);
            call.resolve(out);
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            ensureInit();
            PlayGames.getGamesSignInClient(getActivity())
                .isAuthenticated()
                .addOnCompleteListener(task -> resolveFromAuth(call, task.isSuccessful() ? task.getResult() : null));
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            ensureInit();
            PlayGames.getGamesSignInClient(getActivity())
                .signIn()
                .addOnCompleteListener(task -> resolveFromAuth(call, task.isSuccessful() ? task.getResult() : null));
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    @PluginMethod
    public void serverAuthCode(PluginCall call) {
        try {
            String serverClientId = call.getString("serverClientId");
            if (serverClientId == null || serverClientId.trim().isEmpty()) {
                call.resolve(failure("config"));
                return;
            }
            ensureInit();
            PlayGames.getGamesSignInClient(getActivity())
                .requestServerSideAccess(serverClientId.trim(), false)
                .addOnCompleteListener(task -> {
                    try {
                        if (task.isSuccessful() && task.getResult() != null && !task.getResult().isEmpty()) {
                            JSObject out = new JSObject();
                            out.put("ok", true);
                            out.put("authCode", task.getResult());
                            call.resolve(out);
                        } else {
                            call.resolve(failure("denied"));
                        }
                    } catch (Exception e) {
                        call.resolve(failure("error"));
                    }
                });
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    /** status/signIn share this: not authenticated is a normal signed-out answer. */
    private void resolveFromAuth(PluginCall call, AuthenticationResult result) {
        try {
            if (result == null || !result.isAuthenticated()) {
                call.resolve(signedOut());
                return;
            }
            PlayGames.getPlayersClient(getActivity())
                .getCurrentPlayer()
                .addOnCompleteListener(task -> {
                    try {
                        if (!task.isSuccessful() || task.getResult() == null) {
                            call.resolve(failure("error"));
                            return;
                        }
                        JSObject out = new JSObject();
                        out.put("ok", true);
                        out.put("signedIn", true);
                        out.put("playerId", task.getResult().getPlayerId());
                        out.put("displayName", task.getResult().getDisplayName());
                        call.resolve(out);
                    } catch (Exception e) {
                        call.resolve(failure("error"));
                    }
                });
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }
}
