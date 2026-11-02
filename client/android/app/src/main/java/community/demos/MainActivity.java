package community.demos;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private DemosAppOpenAdsManager appOpenAdsManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
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
