package community.demos;

/**
 * Release no-op. No advertising SDKs are packaged with production/release AAB.
 * A separate reviewed release change is necessary before enabling ads.
 */
final class DemosAppOpenAdsManager {
    DemosAppOpenAdsManager(MainActivity activity) {}
    void onCreate() {}
    boolean arePrivacyOptionsRequired() { return false; }
    void showPrivacyOptions(Runnable onSuccess, Runnable onError) { onError.run(); }
    void onResume() {}
    void onPause() {}
    void onDestroy() {}
}
