package community.demos;

import org.junit.Test;
import static org.junit.Assert.*;

public class AppOpenTcfConsentPolicyTest {
    private String googleVendorBits(boolean enabled) {
        char[] bits = new char[1550];
        java.util.Arrays.fill(bits, '0');
        if (enabled) bits[754] = '1';
        return new String(bits);
    }

    @Test public void fullConsentForPurposeOneAndGoogleAllowsRequest() {
        assertTrue(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest(
            "11111111111", googleVendorBits(true)));
    }

    @Test public void explicitDoNotConsentFailsClosedEvenIfUmpCanRequestAds() {
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest(
            "00000000000", googleVendorBits(false)));
    }

    @Test public void purposeOneDeniedAlwaysBlocksRequests() {
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest(
            "01111111111", googleVendorBits(true)));
    }

    @Test public void googleVendorConsentDeniedAlwaysBlocksRequests() {
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest(
            "11111111111", googleVendorBits(false)));
    }

    @Test public void missingOrCorruptStringsFailClosed() {
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest(null, googleVendorBits(true)));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("11111111111", null));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("", ""));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("1", googleVendorBits(true)));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("11111111111", "1"));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("X1111111111", googleVendorBits(true)));
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("11111111111", "INVALID" + googleVendorBits(true)));
    }

    @Test public void googleGvlVendorIdIsOneIndexedAndNoAdjacentVendorCanSubstitute() {
        char[] bits = googleVendorBits(false).toCharArray();
        bits[753] = '1';
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("11111111111", new String(bits)));
        bits[753] = '0';
        bits[755] = '1';
        assertFalse(AppOpenTcfConsentPolicy.allowsGoogleNonPersonalizedAdRequest("11111111111", new String(bits)));
    }
}
