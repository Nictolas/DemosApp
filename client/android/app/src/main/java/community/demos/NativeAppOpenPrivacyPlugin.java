package community.demos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Non-sensitive Capacitor bridge. Standard release is a no-op; only an opted-in
 * ad-capable candidate has UMP and App Open, guarded by adult/consent checks.
 */
@CapacitorPlugin(name = "NativeAppOpenPrivacy")
public class NativeAppOpenPrivacyPlugin extends Plugin {
    private MainActivity mainActivity() {
        return getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
    }

    // Trusted web code passes only a derived adult boolean from the verified
    // first-party /auth/me session. No date, year or account ID crosses to SDK.
    @PluginMethod
    public void setAdultEligibility(PluginCall call) {
        MainActivity activity = mainActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        Boolean confirmed = call.getBoolean("eligible");
        activity.setAppOpenAdultEligibility(Boolean.TRUE.equals(confirmed), call::resolve);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        MainActivity activity = mainActivity();
        JSObject result = new JSObject();
        result.put("required", activity != null && activity.areAppOpenPrivacyOptionsRequired());
        call.resolve(result);
    }

    @PluginMethod
    public void showPrivacyOptions(PluginCall call) {
        MainActivity activity = mainActivity();
        if (activity == null || !activity.areAppOpenPrivacyOptionsRequired()) {
            call.reject("Opzioni privacy pubblicitarie non disponibili");
            return;
        }
        activity.showAppOpenPrivacyOptions(
            () -> call.resolve(),
            () -> call.reject("Impossibile visualizzare le opzioni privacy pubblicitarie")
        );
    }
}
