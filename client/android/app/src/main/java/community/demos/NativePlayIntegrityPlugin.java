package community.demos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityManager;

/**
 * Disabled-by-default Android bridge for Play Integrity standard requests.
 *
 * These methods cannot call Google until a separate explicitly authorized
 * Android build changes PLAY_INTEGRITY_ENABLED and supplies a real project.
 * This branch never changes those defaults; it does not affect current users.
 */
@CapacitorPlugin(name = "NativePlayIntegrity")
public class NativePlayIntegrityPlugin extends Plugin {
    private volatile StandardIntegrityManager.StandardIntegrityTokenProvider tokenProvider;

    // Never prepare an attestation for a merely well-formed or unrelated
    // Google Cloud project. The Cloud project is already linked in DEMOS Play Console.
    private static final long EXPECTED_CLOUD_PROJECT_NUMBER = 848085963511L;

    private boolean isEnabled() {
        return BuildConfig.PLAY_INTEGRITY_ENABLED
            && BuildConfig.PLAY_INTEGRITY_PROJECT_NUMBER == EXPECTED_CLOUD_PROJECT_NUMBER;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject response = new JSObject();
        response.put("enabled", isEnabled());
        response.put("platform", "android");
        call.resolve(response);
    }

    @PluginMethod
    public void prepareToken(PluginCall call) {
        if (!isEnabled()) {
            call.reject("Play Integrity disabilitata");
            return;
        }
        final StandardIntegrityManager manager =
            IntegrityManagerFactory.createStandard(getContext());

        manager.prepareIntegrityToken(
            StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                .setCloudProjectNumber(BuildConfig.PLAY_INTEGRITY_PROJECT_NUMBER)
                .build()
        ).addOnSuccessListener(provider -> {
            tokenProvider = provider;
            JSObject response = new JSObject();
            response.put("ready", true);
            call.resolve(response);
        }).addOnFailureListener(error -> {
            tokenProvider = null;
            call.reject("Impossibile preparare Play Integrity");
        });
    }

    @PluginMethod
    public void requestToken(PluginCall call) {
        if (!isEnabled()) {
            call.reject("Play Integrity disabilitata");
            return;
        }
        String requestHash = call.getString("requestHash");
        if (requestHash == null || !requestHash.matches("^[A-Za-z0-9_-]{43}$")) {
            call.reject("Hash richiesta non valido");
            return;
        }
        StandardIntegrityManager.StandardIntegrityTokenProvider provider = tokenProvider;
        if (provider == null) {
            call.reject("Provider Play Integrity non preparato");
            return;
        }
        provider.request(
            StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                .setRequestHash(requestHash)
                .build()
        ).addOnSuccessListener(token -> {
            String value = token.token();
            if (value == null || value.isEmpty()) {
                call.reject("Token Play Integrity non disponibile");
                return;
            }
            JSObject response = new JSObject();
            response.put("token", value);
            call.resolve(response);
        }).addOnFailureListener(error -> {
            tokenProvider = null;
            call.reject("Impossibile ottenere Play Integrity");
        });
    }
}
