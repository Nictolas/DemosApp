package community.demos;

import android.content.Context;
import android.content.SharedPreferences;
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
    // Local safety brakes only. Device resets, clock changes and multiple devices
    // bypass these; the global Play Integrity 10k/day Cloud budget remains a NO-GO gate.
    private static final int MAX_PREPARATIONS_PER_UTC_DAY = 2;
    private static final int MAX_TOKEN_REQUESTS_PER_UTC_DAY = 2;
    private static final String BUDGET_PREFERENCES = "demos_play_integrity_local_budget_v1";

    private synchronized boolean reserveLocalApiAttempt(String counter) {
        if (!"preparations".equals(counter) && !"tokenRequests".equals(counter)) {
            return false;
        }
        final long nowMillis = System.currentTimeMillis();
        if (nowMillis < 0L) return false;
        final long utcDay = nowMillis / 86400000L;
        final SharedPreferences prefs =
            getContext().getSharedPreferences(BUDGET_PREFERENCES, Context.MODE_PRIVATE);
        final long storedDay = prefs.getLong("utcDay", -1L);
        if (storedDay > utcDay) return false; // Clock rollback must never reset the allowance.
        final int preparations = storedDay == utcDay ? prefs.getInt("preparations", 0) : 0;
        final int requests = storedDay == utcDay ? prefs.getInt("tokenRequests", 0) : 0;
        final int maxDaily = "preparations".equals(counter)
            ? MAX_PREPARATIONS_PER_UTC_DAY : MAX_TOKEN_REQUESTS_PER_UTC_DAY;
        final int used = "preparations".equals(counter) ? preparations : requests;
        if (used >= maxDaily) return false;
        // Synchronous commit before Google SDK initialization or requests.
        // Store day+counts only: never a token, payload, user ID or device ID.
        return prefs.edit()
            .putLong("utcDay", utcDay)
            .putInt("preparations", preparations + ("preparations".equals(counter) ? 1 : 0))
            .putInt("tokenRequests", requests + ("tokenRequests".equals(counter) ? 1 : 0))
            .commit();
    }

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
        if (!reserveLocalApiAttempt("preparations")) {
            call.reject("Limite locale preparazione Play Integrity raggiunto");
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
        if (!reserveLocalApiAttempt("tokenRequests")) {
            call.reject("Limite locale token Play Integrity raggiunto");
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
