package com.darktierstudios.delvedierepeat;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    /** Capacitor Preferences' default SharedPreferences group. */
    private static final String PREFS_GROUP = "CapacitorStorage";
    /** The settings blob key (src/browser/settings.js SETTINGS_STORAGE_KEY). */
    private static final String SETTINGS_KEY = "ddr.settings.v1";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor 8 local-plugin registration: before super.onCreate.
        registerPlugin(PlayIdentityPlugin.class);
        // Phase 92.1 (BOARD-31, the privacy gate). The manifest removes the
        // Play Games SDK's own auto-init provider, so the SDK (and its silent
        // sign-in) starts ONLY here, and only when the stored settings say
        // Compete is ON. It must run before super.onCreate: the SDK's
        // automatic sign-in fires on the first onActivityCreated it sees
        // AFTER initialize, and this app has a single activity. A Compete-OFF
        // launch never starts the SDK. Never throws, never logs.
        if (competeIsOn(this)) {
            try {
                PlayIdentityPlugin.initSdkOnce(getApplicationContext());
            } catch (Throwable ignored) {
                // the SDK refusing to start must never stop the game booting
            }
        }
        super.onCreate(savedInstanceState);
    }

    /**
     * True unless the stored settings blob says compete is exactly false. A
     * missing, unreadable or unparsable blob means the default, ON (Phase 67
     * D-01), the same answer the JS settings reader gives. Never throws and
     * never logs a stored value.
     */
    static boolean competeIsOn(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_GROUP, Context.MODE_PRIVATE);
            String raw = prefs.getString(SETTINGS_KEY, null);
            if (raw == null || raw.isEmpty()) {
                return true;
            }
            JSONObject settings = new JSONObject(raw);
            return !Boolean.FALSE.equals(settings.opt("compete"));
        } catch (Throwable t) {
            return true;
        }
    }
}
