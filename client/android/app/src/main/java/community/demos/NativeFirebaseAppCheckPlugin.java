package community.demos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory;

/**
 * Firebase App Check bridge for future, explicitly approved Android telemetry.
 * Distinct from the direct Play Integrity API (no requestHash or decode call).
 *
 * BuildConfig.FIREBASE_APP_CHECK_ENABLED is false in every current build.
 * getStatus() is passive. Requesting a token requires an explicit JS call,
 * and the provider installs only inside that gated method. There is no
 * automatic token refresh, and no logging of attestation tokens.
 */
@CapacitorPlugin(name = "NativeFirebaseAppCheck")
public class NativeFirebaseAppCheckPlugin extends Plugin {
    private volatile FirebaseAppCheck configuredAppCheck;
    private final Object setupLock = new Object();

    private boolean isEnabled() {
        return BuildConfig.FIREBASE_APP_CHECK_ENABLED;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", isEnabled());
        result.put("platform", "android");
        call.resolve(result);
    }

    @PluginMethod
    public void requestToken(PluginCall call) {
        if (!isEnabled()) {
            call.reject("Firebase App Check disabilitato");
            return;
        }

        FirebaseAppCheck appCheck;
        try {
            appCheck = getAppCheckIfConfigured();
        } catch (Exception ignored) {
            call.reject("Firebase App Check non disponibile");
            return;
        }
        if (appCheck == null) {
            call.reject("Configurazione Firebase non disponibile");
            return;
        }

        // Never force a refresh: use the SDK cache and stay within quotas.
        appCheck.getAppCheckToken(false)
            .addOnSuccessListener(token -> {
                String value = token.getToken();
                if (value == null || value.isEmpty()) {
                    call.reject("Token App Check non disponibile");
                    return;
                }
                JSObject result = new JSObject();
                result.put("token", value);
                call.resolve(result);
            })
            .addOnFailureListener(error -> {
                // No exception details or tokens in logs.
                call.reject("Impossibile ottenere il token App Check");
            });
    }

    private FirebaseAppCheck getAppCheckIfConfigured() {
        if (!isEnabled()) return null;
        if (configuredAppCheck != null) return configuredAppCheck;

        synchronized (setupLock) {
            if (configuredAppCheck != null) return configuredAppCheck;

            FirebaseApp app = FirebaseApp.initializeApp(getContext());
            if (app == null) return null;

            FirebaseAppCheck check = FirebaseAppCheck.getInstance(app);
            // Manual/on-demand only: prevent periodic refresh and quota surprises.
            check.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance(), false
            );
            configuredAppCheck = check;
            return check;
        }
    }
}
