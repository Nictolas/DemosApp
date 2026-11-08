package community.demos;

/**
 * Default release no-op. An explicitly opted-in candidate uses the separate
 * SDK-backed implementation instead; no ad SDK is packaged by default.
 */
final class DemosAppOpenAdsManager {
    DemosAppOpenAdsManager(MainActivity activity) {}
    void onCreate() {}
    void setAdultEligible(boolean confirmedAdult, boolean revalidateSession) {} // No SDK or ads in release.
    boolean arePrivacyOptionsRequired() { return false; }
    void showPrivacyOptions(Runnable onSuccess, Runnable onError) { onError.run(); }
    void onResume() {}
    void onPause() {}
    void onDestroy() {}
}
