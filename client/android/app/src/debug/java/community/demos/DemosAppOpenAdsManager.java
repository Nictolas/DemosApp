package community.demos;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import com.google.android.libraries.ads.mobile.sdk.MobileAds;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig;
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback;
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration;
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAd;
import com.google.android.libraries.ads.mobile.sdk.appopen.AppOpenAdEventCallback;

/**
 * SOLO debug e solo con -PdemosDebugAppOpenAds=true.
 *
 * In release BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED è SEMPRE false.
 * La procedura usa esclusivamente le unità TEST ufficiali Google e non legge
 * mai ID account, opinioni, voti, geolocalizzazione o dati personali.
 *
 * L'annuncio può comparire solo se un WebView privo di contenuto principale
 * è effettivamente ancora in caricamento. Non introduce attese artificiali.
 *
 * Per la release reale occorrono: ID veri, opzioni privacy accessibili dalla UI,
 * gestione età, consenso verificato, Play Data Safety e test dispositivi.
 */
final class DemosAppOpenAdsManager {
    private static final String PREFS = "demos_app_open_ads_device_only";
    private static final String LAUNCHES = "native_launch_count";
    private static final String LAST_SHOWN = "last_ad_shown_wall_clock_ms";
    // Read-only check, no URL, route, opinions or user information is read.
    private static final String EMPTY_REACT_ROOT_JS =
        "(function(){var r=document.getElementById('root');return !!r && r.children.length===0;})()";
    private static final long MAX_AD_AGE_MS = 4L * 60 * 60 * 1000;

    private final MainActivity activity;
    private final SharedPreferences preferences;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ConsentInformation consentInformation;
    private AppOpenAd readyAd;
    private boolean foreground = false;
    private boolean initialized = false;
    private boolean loading = false;
    private boolean showing = false;
    private boolean privacyFormOpen = false;
    private long readyAtElapsedMs = 0;

    DemosAppOpenAdsManager(MainActivity activity) {
        this.activity = activity;
        this.preferences = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void onCreate() {
        if (!BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED || !BuildConfig.DEBUG) return;

        preferences.edit()
            .putInt(LAUNCHES, AppOpenFrequencyPolicy.nextLaunchCount(readLaunchCount()))
            .apply();

        // UMP MUST run before initializing Google Mobile Ads or requesting ads.
        consentInformation = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(
            activity,
            params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                activity,
                formError -> {
                    if (formError != null) return;
                    // Stricter than Google's canRequestAds() alone: require a completed
                    // positive consent state in this debug-only experiment.
                    if (consentInformation.canRequestAds()
                        && consentInformation.getConsentStatus()
                            == ConsentInformation.ConsentStatus.OBTAINED) {
                        initializeSdk();
                    }
                }),
            requestError -> {
                // Fail closed even if the SDK has previous-session consent cached.
                // Do not request ads when current UMP refresh fails.
            }
        );
    }

    void onResume() {
        foreground = true;
        if (initialized) loadOnlyTestAppOpenAd();
        maybeShowOnlyWhileReallyLoading();
    }

    void onPause() {
        foreground = false;
    }

    boolean arePrivacyOptionsRequired() {
        return BuildConfig.DEBUG
            && BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED
            && consentInformation != null
            && consentInformation.getPrivacyOptionsRequirementStatus()
                == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    void showPrivacyOptions(Runnable onSuccess, Runnable onError) {
        if (!arePrivacyOptionsRequired() || privacyFormOpen || showing
            || activity.isFinishing() || activity.isDestroyed()) {
            onError.run();
            return;
        }
        // Do not keep an ad loaded under the previous choice.
        if (readyAd != null) {
            readyAd.destroy();
            readyAd = null;
        }
        privacyFormOpen = true;
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
            privacyFormOpen = false;
            if (formError != null) {
                onError.run();
                return;
            }
            // After a change, native eligibility checks current UMP state again.
            // We never initialize/request if the current consent is not sufficient.
            if (consentInformation.canRequestAds()
                && consentInformation.getConsentStatus()
                    == ConsentInformation.ConsentStatus.OBTAINED) {
                initializeSdk();
                if (initialized) loadOnlyTestAppOpenAd();
            }
            onSuccess.run();
        });
    }

    void onDestroy() {
        foreground = false;
        if (readyAd != null) {
            readyAd.destroy();
            readyAd = null;
        }
    }

    private int readLaunchCount() {
        try {
            return Math.max(0, preferences.getInt(LAUNCHES, 0));
        } catch (ClassCastException corruptValue) {
            return 0; // Do not crash or count a corrupt preference as repeated use.
        }
    }

    private long readLastShownAtMs() {
        try {
            return preferences.getLong(LAST_SHOWN, 0L);
        } catch (ClassCastException corruptValue) {
            return -1L; // Unreadable frequency cap: never request an ad.
        }
    }

    private boolean hasIntervalElapsed() {
        return AppOpenFrequencyPolicy.mayRequest(
            readLaunchCount(), readLastShownAtMs(), System.currentTimeMillis());
    }

    private void initializeSdk() {
        if (initialized || !BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED || !BuildConfig.DEBUG) return;
        initialized = true;

        // PPT disables personalized ads for the entire session before any load.
        final RequestConfiguration configuration = new RequestConfiguration.Builder()
            .setPublisherPrivacyPersonalizationState(
                RequestConfiguration.PublisherPrivacyPersonalizationState.DISABLED)
            .setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_G)
            .build();

        // Google requires Next-Gen initialization off the main thread.
        new Thread(() -> {
            MobileAds.initialize(
                activity.getApplicationContext(),
                new InitializationConfig.Builder(BuildConfig.DEMOS_ADMOB_APP_ID)
                    .setRequestConfiguration(configuration)
                    .build(),
                initializationStatus -> mainHandler.post(this::loadOnlyTestAppOpenAd)
            );
        }, "demos-ads-test-initialization").start();
    }

    private void loadOnlyTestAppOpenAd() {
        if (!BuildConfig.DEBUG || !BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED) return;
        if (!foreground || loading || readyAd != null || showing || privacyFormOpen) return;
        if (consentInformation == null || !consentInformation.canRequestAds()
            || consentInformation.getConsentStatus()
                != ConsentInformation.ConsentStatus.OBTAINED) return;
        if (!hasIntervalElapsed()) return;

        // Never contact the ad network if the app is already usable. This
        // deliberately means many launches cause zero requests/impressions.
        final WebView webView = activity.getAppOpenWebView();
        if (webView == null) return;
        webView.evaluateJavascript(EMPTY_REACT_ROOT_JS, result -> {
            if (!"true".equals(result) || !foreground || loading || showing
                || privacyFormOpen || readyAd != null || activity.isFinishing() || activity.isDestroyed()
                || !consentInformation.canRequestAds()
                || consentInformation.getConsentStatus()
                    != ConsentInformation.ConsentStatus.OBTAINED
                || !hasIntervalElapsed()) return;

            loading = true;
            AppOpenAd.load(
                new AdRequest.Builder(BuildConfig.DEMOS_APP_OPEN_UNIT_ID).build(),
                new AdLoadCallback<AppOpenAd>() {
                    @Override
                    public void onAdLoaded(@NonNull AppOpenAd ad) {
                        mainHandler.post(() -> {
                            loading = false;
                            if (!foreground || !hasIntervalElapsed()
                                || !consentInformation.canRequestAds()
                                || consentInformation.getConsentStatus()
                                    != ConsentInformation.ConsentStatus.OBTAINED) {
                                ad.destroy();
                                return;
                            }
                            readyAd = ad;
                            readyAtElapsedMs = SystemClock.elapsedRealtime();
                            maybeShowOnlyWhileReallyLoading();
                        });
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        mainHandler.post(() -> loading = false);
                    }
                }
            );
        });
    }

    private void maybeShowOnlyWhileReallyLoading() {
        if (!foreground || showing || readyAd == null || !hasIntervalElapsed()) return;

        long age = SystemClock.elapsedRealtime() - readyAtElapsedMs;
        if (age < 0 || age >= MAX_AD_AGE_MS) {
            readyAd.destroy();
            readyAd = null;
            return;
        }

        // Capacitor owns the WebView/WebViewClient. Do not override its handlers.
        // Evaluate a read-only condition; if the React root contains actual UI,
        // the app is already usable, so an App Open ad is forbidden.
        final WebView webView = activity.getAppOpenWebView();
        if (webView == null) return;

        webView.evaluateJavascript(
            EMPTY_REACT_ROOT_JS,
            result -> {
                if (!"true".equals(result)
                    || !foreground
                    || showing
                    || privacyFormOpen
                    || !consentInformation.canRequestAds()
                    || consentInformation.getConsentStatus()
                        != ConsentInformation.ConsentStatus.OBTAINED
                    || !hasIntervalElapsed()
                    || activity.isFinishing()
                    || activity.isDestroyed()) return;
                final AppOpenAd ad = readyAd;
                if (ad == null) return;
                if (SystemClock.elapsedRealtime() - readyAtElapsedMs >= MAX_AD_AGE_MS) return;

                showing = true;
                readyAd = null;
                ad.setAdEventCallback(new AppOpenAdEventCallback() {
                    @Override
                    public void onAdShowedFullScreenContent() {
                        // Frequency cap starts when the ad REALLY appears, never on load.
                        // Persist synchronously before the impression callback returns.
                        preferences.edit()
                            .putLong(LAST_SHOWN, System.currentTimeMillis())
                            .commit();
                    }

                    @Override
                    public void onAdDismissedFullScreenContent() {
                        showing = false;
                        ad.destroy();
                    }

                    @Override
                    public void onAdFailedToShowFullScreenContent(
                        @NonNull FullScreenContentError error) {
                        showing = false;
                        ad.destroy();
                    }
                });
                ad.show(activity);
            }
        );
    }
}
