package com.darktierstudios.delvedierepeat;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.games.AchievementsClient;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.tasks.Task;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * PlayIdentity: the in-repo Capacitor plugin that gives the game a Play Games
 * identity (Phase 91.2, D-02) and, since Phase 101, mirrors its achievements to
 * Play. Six Play Games methods, all of which RESOLVE and never reject into the
 * UI: init, status, signIn, serverAuthCode (identity) and syncAchievements,
 * showAchievements (achievements). A seventh, buildInfo, is not Play Games at
 * all (see below).
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
 *      serverAuthCode/syncAchievements/showAchievements call. The JS shell
 *      only calls the plugin while Compete is ON, so a Compete turned ON
 *      mid-session starts the SDK here (the interactive signIn then prompts
 *      the player). The two achievement methods are reached only from JS and
 *      only through the Play mirror, so they keep this gate.
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
 * ACHIEVEMENTS (Phase 101, PGS-07/PGS-10, AUI-04).
 *   syncAchievements({ ops }) takes a batch of at most 20 ops, each
 *   { kind: unlock | reveal | steps, resource, n? }. It checks that the
 *   player is signed in BEFORE it touches the achievements client, then runs
 *   the ops strictly one after another and stops at the first network or
 *   signin answer. The Play ID of an op is never in JS: resource is a name
 *   such as achievement_x, looked up in res/values/games-ids.xml (the Play
 *   Console export) through getIdentifier. A name that does not match the
 *   pattern is refused; a name absent from the file is a per-op config no-op,
 *   never a crash. Only the Immediate calls are used, so each op carries its
 *   own status: unlockImmediate, revealImmediate and setStepsImmediate. Steps
 *   are an absolute at-least value (Play ignores a lower one), so a resend
 *   can never double count; the counting call is never used. The plugin
 *   keeps no state between calls.
 *   showAchievements() opens Play's own achievements screen: it needs the
 *   player signed in, gets the intent and launches it through
 *   startActivityForResult with the achievementsClosed callback, which
 *   resolves { ok: true } whatever the player did there.
 *
 * BUILD INFO (dev-row gate). buildInfo() answers { ok: true, debug } from
 * BuildConfig.DEBUG, so the JS shell can show its hidden dev rows (start at
 * depth, the Play Games probe) on a debug build only, never on the release
 * AAB. It does NOT call ensureInit(): reading the build flag must never start
 * the Play Games SDK, or the 92.1 privacy gate above would be bypassed by a
 * Compete-OFF launch. The shell treats a failed or missing answer as NOT debug.
 *
 * PRIVACY. Nothing here logs a player id, a display name, an auth code or an
 * achievement id.
 */
@CapacitorPlugin(name = "PlayIdentity")
public class PlayIdentityPlugin extends Plugin {

    /** Process-wide: MainActivity and this plugin share one initialize. */
    private static boolean sdkInitialized = false;

    /** Only names of this shape may be looked up in the resource file. */
    private static final Pattern RESOURCE_PATTERN = Pattern.compile("^achievement_[a-z0-9_]{1,80}$");

    private static final int MAX_OPS = 20;
    private static final int MIN_STEPS = 1;
    private static final int MAX_STEPS = 10000;

    // ApiException status codes the achievements calls can answer with.
    private static final int CODE_SIGN_IN_REQUIRED = 4; // CommonStatusCodes.SIGN_IN_REQUIRED
    private static final int CODE_NETWORK_ERROR = 26506; // GamesClientStatusCodes.NETWORK_ERROR_OPERATION_FAILED
    private static final int CODE_APP_MISCONFIGURED = 26508; // GamesClientStatusCodes.APP_MISCONFIGURED
    private static final int CODE_ACHIEVEMENT_UNLOCK_FAILURE = 26560; // GamesClientStatusCodes.ACHIEVEMENT_UNLOCK_FAILURE
    private static final int CODE_ACHIEVEMENT_UNKNOWN = 26561; // GamesClientStatusCodes.ACHIEVEMENT_UNKNOWN
    private static final int CODE_ACHIEVEMENT_NOT_INCREMENTAL = 26562; // GamesClientStatusCodes.ACHIEVEMENT_NOT_INCREMENTAL
    private static final int CODE_ACHIEVEMENT_UNLOCKED = 26563; // GamesClientStatusCodes.ACHIEVEMENT_UNLOCKED

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

    /**
     * Mirrors a batch of achievement ops to Play. Answers { ok: true, results }
     * for the ops it attempted, or { ok: false, reason } for the whole call.
     */
    @PluginMethod
    public void syncAchievements(PluginCall call) {
        try {
            JSArray ops = call.getArray("ops");
            if (ops == null || ops.length() < 1 || ops.length() > MAX_OPS) {
                call.resolve(failure("error"));
                return;
            }
            ensureInit();
            PlayGames.getGamesSignInClient(getActivity())
                .isAuthenticated()
                .addOnCompleteListener(task -> {
                    try {
                        if (!task.isSuccessful() || task.getResult() == null || !task.getResult().isAuthenticated()) {
                            call.resolve(failure("signin"));
                            return;
                        }
                        AchievementsClient client = PlayGames.getAchievementsClient(getActivity());
                        runAchievementOps(call, client, ops, 0, new JSArray());
                    } catch (Exception e) {
                        call.resolve(failure("error"));
                    }
                });
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    /**
     * Runs op number index, and when its Task completes records the answer and
     * starts the next one. Never starts two Tasks at once. Stops at the first
     * network or signin answer and resolves what it has.
     */
    private void runAchievementOps(PluginCall call, AchievementsClient client, JSArray ops, int index, JSArray results) {
        try {
            if (index >= ops.length()) {
                call.resolve(syncAnswer(results));
                return;
            }
            JSONObject op = ops.optJSONObject(index);
            String reason = "error";
            Task<?> task = null;
            if (op != null) {
                String kind = op.optString("kind", "");
                String resource = op.optString("resource", "");
                double n = op.optDouble("n", Double.NaN);
                boolean kindOk = "unlock".equals(kind) || "reveal".equals(kind) || "steps".equals(kind);
                boolean stepsOk = !"steps".equals(kind) || (n == Math.rint(n) && n >= MIN_STEPS && n <= MAX_STEPS);
                if (kindOk && stepsOk && RESOURCE_PATTERN.matcher(resource).matches()) {
                    int resId = achievementStringId(resource);
                    if (resId == 0) {
                        reason = "config";
                    } else {
                        String playId = getContext().getString(resId);
                        if ("unlock".equals(kind)) {
                            task = client.unlockImmediate(playId);
                        } else if ("reveal".equals(kind)) {
                            task = client.revealImmediate(playId);
                        } else {
                            task = client.setStepsImmediate(playId, (int) n);
                        }
                    }
                }
            }
            if (task == null) {
                // Refused or unresolvable op: no Play call, next op.
                appendAchievementResult(results, index, reason);
                runAchievementOps(call, client, ops, index + 1, results);
                return;
            }
            task.addOnCompleteListener(done -> {
                try {
                    String answer = done.isSuccessful() ? null : reasonFor(done.getException());
                    appendAchievementResult(results, index, answer);
                    if ("network".equals(answer) || "signin".equals(answer)) {
                        call.resolve(syncAnswer(results));
                    } else {
                        runAchievementOps(call, client, ops, index + 1, results);
                    }
                } catch (Exception e) {
                    call.resolve(failure("error"));
                }
            });
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    /** Resource id of a string by name, or 0 when the resource file lacks it. */
    @SuppressLint("DiscouragedApi")
    private int achievementStringId(String resource) {
        return getContext().getResources().getIdentifier(resource, "string", getContext().getPackageName());
    }

    private static void appendAchievementResult(JSArray results, int index, String reason) {
        JSObject entry = new JSObject();
        entry.put("i", index);
        entry.put("ok", reason == null);
        if (reason != null) {
            entry.put("reason", reason);
        }
        results.put(entry);
    }

    private static JSObject syncAnswer(JSArray results) {
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("results", results);
        return out;
    }

    /**
     * Maps a failed Play Task to the closed reason set. Returns null when the
     * failure is really a success (an incremental that unlocked with the call).
     */
    private static String reasonFor(Exception e) {
        if (!(e instanceof ApiException)) {
            return "error";
        }
        switch (((ApiException) e).getStatusCode()) {
            case CODE_NETWORK_ERROR:
                return "network";
            case CODE_SIGN_IN_REQUIRED:
                return "signin";
            case CODE_ACHIEVEMENT_UNKNOWN:
                return "unknown";
            case CODE_ACHIEVEMENT_UNLOCK_FAILURE:
            case CODE_ACHIEVEMENT_NOT_INCREMENTAL:
                return "type";
            case CODE_APP_MISCONFIGURED:
                return "config";
            case CODE_ACHIEVEMENT_UNLOCKED:
                return null;
            default:
                return "error";
        }
    }

    /** Opens Play's own achievements screen. */
    @PluginMethod
    public void showAchievements(PluginCall call) {
        try {
            ensureInit();
            PlayGames.getGamesSignInClient(getActivity())
                .isAuthenticated()
                .addOnCompleteListener(task -> {
                    try {
                        if (!task.isSuccessful() || task.getResult() == null || !task.getResult().isAuthenticated()) {
                            call.resolve(failure("signin"));
                            return;
                        }
                        PlayGames.getAchievementsClient(getActivity())
                            .getAchievementsIntent()
                            .addOnCompleteListener(intentTask -> {
                                try {
                                    if (intentTask.isSuccessful() && intentTask.getResult() != null) {
                                        Intent intent = intentTask.getResult();
                                        startActivityForResult(call, intent, "achievementsClosed");
                                    } else {
                                        String reason = reasonFor(intentTask.getException());
                                        call.resolve(failure(reason == null ? "error" : reason));
                                    }
                                } catch (Exception e) {
                                    call.resolve(failure("error"));
                                }
                            });
                    } catch (Exception e) {
                        call.resolve(failure("error"));
                    }
                });
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
    }

    /** Play's screen was closed: resolve ok whatever the result code, free the call. */
    @ActivityCallback
    private void achievementsClosed(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        try {
            JSObject out = new JSObject();
            out.put("ok", true);
            call.resolve(out);
        } catch (Exception e) {
            call.resolve(failure("error"));
        }
        getBridge().releaseCall(call);
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
