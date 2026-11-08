package community.demos;

/**
 * Extra DEMOS opt-in gate for the debug-only App Open experiment.
 *
 * UMP canRequestAds() and ConsentStatus.OBTAINED can both be positive after
 * the user pressed "Do not consent" (for limited ads). DEMOS deliberately
 * makes ZERO ad requests in that case. Google documents reading IAB TCF
 * consent choices from default SharedPreferences after UMP completes.
 *
 * Both Purpose 1 consent AND Google Advertising Products (GVL vendor 755)
 * consent must be explicitly granted. Missing, denied or malformed TCF
 * choices are a hard NO. This is deliberately conservative outside the EEA.
 *
 * No political opinions, app account ID or other DEMOS data are accessed.
 */
final class AppOpenTcfConsentPolicy {
    private static final int PURPOSE_COUNT = 11;
    private static final int GOOGLE_GVL_VENDOR_ID = 755;

    private AppOpenTcfConsentPolicy() {}

    static boolean allowsGoogleNonPersonalizedAdRequest(String purposeConsents, String vendorConsents) {
        if (purposeConsents == null || vendorConsents == null
            || purposeConsents.length() < PURPOSE_COUNT
            || vendorConsents.length() < GOOGLE_GVL_VENDOR_ID
            || purposeConsents.charAt(0) != '1'
            || vendorConsents.charAt(GOOGLE_GVL_VENDOR_ID - 1) != '1') {
            return false;
        }
        return allBinary(purposeConsents) && allBinary(vendorConsents);
    }

    private static boolean allBinary(String bits) {
        for (int i = 0; i < bits.length(); i++) {
            char bit = bits.charAt(i);
            if (bit != '0' && bit != '1') return false;
        }
        return true;
    }
}
