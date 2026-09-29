# Phase 80 DROID-01 — the real rules ship with the dependencies (Capacitor
# core's own consumerProguardFiles, plus AGP's bundled proguard-android.txt
# for the WebView JS bridge); this file mirrors them so a dependency update
# that drops its own rules cannot silently break the release. Verify any
# change against android/app/build/outputs/mapping/release/mapping.txt using
# the RELEASING.md verification recipe.

-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Mirrors node_modules/@capacitor/android/capacitor/proguard-rules.pro
# (Capacitor core's own consumerProguardFiles entry).

# Rules for Capacitor v3 plugins and annotations
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

-keep public class * extends com.getcapacitor.Plugin { *; }

# Rules for Capacitor v2 plugins and annotations
# These are deprecated but can still be used with Capacitor for now
-keep @com.getcapacitor.NativePlugin public class * {
  @com.getcapacitor.PluginMethod public <methods>;
}

# Rules for Cordova plugins
-keep public class * extends org.apache.cordova.* {
  public <methods>;
  public <fields>;
}

# Mirrors AGP's default proguard-android.txt @JavascriptInterface rule.
# Covers Capacitor's MessageHandler JS bridge and SystemBars'
# CapacitorSystemBarsAndroidInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
