package com.darktierstudios.delvedierepeat;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor 8 local-plugin registration: before super.onCreate.
        registerPlugin(PlayIdentityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
