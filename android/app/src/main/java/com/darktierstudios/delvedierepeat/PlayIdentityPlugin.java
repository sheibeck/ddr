package com.darktierstudios.delvedierepeat;

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
 * identity (Phase 91.2, D-02). Four methods, all of which RESOLVE and never
 * reject into the UI: init, status, signIn, serverAuthCode.
 *
 * LAZY INIT. The Play Games SDK is started by ensureInit() from the first
 * method call, never at app launch. The JS shell only calls this plugin while
 * Compete is ON, so a Compete-OFF player never starts the SDK.
 * Documented fallback (assumption A6): if lazy init proves unreliable on a
 * device, call ensureInit() from load() when the Capacitor Preferences group
 * "CapacitorStorage" holds settings with Compete ON.
 *
 * SUPPRESS_GAME_PROFILE_CREATION is deliberately NOT set: a player without a
 * Play Games profile should be able to make one at sign-in.
 *
 * SCOPES. serverAuthCode uses the two-argument requestServerSideAccess, which
 * requests no extra scopes. PROFILE, EMAIL and OPEN_ID are never requested
 * (they expose a real name and email).
 *
 * PRIVACY. Nothing here logs a player id, a display name or an auth code.
 */
@CapacitorPlugin(name = "PlayIdentity")
public class PlayIdentityPlugin extends Plugin {

    private boolean sdkInitialized = false;

    /** Starts the Play Games SDK once. Throws only if the SDK itself does. */
    private synchronized void ensureInit() {
        if (!sdkInitialized) {
            PlayGamesSdk.initialize(getContext());
            sdkInitialized = true;
        }
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
