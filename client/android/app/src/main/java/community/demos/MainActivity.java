package community.demos;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private DemosAppOpenAdsManager appOpenAdsManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativeAppOpenPrivacyPlugin.class);
        super.onCreate(savedInstanceState);
        // Flag false in release e in debug standard: non inizializza neppure UMP.
        if (BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED) {
            appOpenAdsManager = new DemosAppOpenAdsManager(this);
            appOpenAdsManager.onCreate();
        }
    }

    // Safe bridge access for the ad eligibility check; do not replace WebViewClient.
    WebView getAppOpenWebView() {
        return bridge == null ? null : bridge.getWebView();
    }

    boolean areAppOpenPrivacyOptionsRequired() {
        return appOpenAdsManager != null && appOpenAdsManager.arePrivacyOptionsRequired();
    }

    void showAppOpenPrivacyOptions(Runnable onSuccess, Runnable onError) {
        // Capacitor @PluginMethod runs on its plugin thread. UMP requires the
        // privacy form to be opened on Android's UI thread, otherwise it crashes.
        runOnUiThread(() -> {
            if (appOpenAdsManager == null || isFinishing() || isDestroyed()) {
                onError.run();
                return;
            }
            appOpenAdsManager.showPrivacyOptions(onSuccess, onError);
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        if (appOpenAdsManager != null) {
            appOpenAdsManager.onResume();
        }
    }

    @Override
    public void onDestroy() {
        if (appOpenAdsManager != null) {
            appOpenAdsManager.onDestroy();
        }
        super.onDestroy();
    }

    @Override
    public void onPause() {
        if (appOpenAdsManager != null) {
            appOpenAdsManager.onPause();
        }
        super.onPause();
    }
}
