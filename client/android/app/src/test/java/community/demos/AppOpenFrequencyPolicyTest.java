package community.demos;

import org.junit.Test;
import static org.junit.Assert.*;

public class AppOpenFrequencyPolicyTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final long SIX_HOURS = 6L * 60L * 60L * 1000L;\n    private static final long HOUR = 60L * 60L * 1000L;

    @Test public void firstAndSecondLaunchNeverRequest() {
        assertFalse(AppOpenFrequencyPolicy.mayRequest(0, 0, NOW));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(1, 0, NOW));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(2, 0, NOW));
        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, 0, NOW));
    }

    @Test public void rollingSixHourLimitUsesActualLastImpression() {
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, NOW - SIX_HOURS + 1, NOW));
        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, NOW - SIX_HOURS, NOW));
        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, NOW - SIX_HOURS - 1, NOW));
    }

    @Test public void exactSixHourBoundaryAndEarlierReopensAreRejected() {\n        assertEquals(SIX_HOURS, AppOpenFrequencyPolicy.MIN_INTERVAL_MS);\n        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, NOW - HOUR, NOW));\n        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, NOW - 3L * HOUR, NOW));\n        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, NOW - 5L * HOUR, NOW));\n        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, NOW - 6L * HOUR, NOW));\n        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, NOW - 12L * HOUR, NOW));\n    }\n\n    @Test public void clockRollbackAndCorruptedPreferencesFailClosed() {
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, NOW + 1, NOW));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, -1, NOW));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, 0, -1));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, 0, 0));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(-1, 0, NOW));
    }

    @Test public void launchCounterIsOverflowSafe() {
        assertEquals(1, AppOpenFrequencyPolicy.nextLaunchCount(-1));
        assertEquals(1, AppOpenFrequencyPolicy.nextLaunchCount(0));
        assertEquals(3, AppOpenFrequencyPolicy.nextLaunchCount(2));
        assertEquals(Integer.MAX_VALUE, AppOpenFrequencyPolicy.nextLaunchCount(Integer.MAX_VALUE));
    }

    @Test public void extremeButValidTimestampsDoNotOverflow() {
        assertTrue(AppOpenFrequencyPolicy.mayRequest(3, 1, Long.MAX_VALUE));
        assertFalse(AppOpenFrequencyPolicy.mayRequest(3, Long.MAX_VALUE, NOW));
    }
}
