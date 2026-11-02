package community.demos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Non-sensitive Capacitor bridge. The production/release manager is a no-op;
 * there is no AdMob SDK, consent collection or ad request in the release APK.
 */
@CapacitorPlugin(name = "NativeAppOpenPrivacy")
public class NativeAppOpenPrivacyPlugin extends Plugin {
    private MainActivity mainActivity() {
        return getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
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
