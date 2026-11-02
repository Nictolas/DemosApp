package community.demos;

/**
 * Pure, device-only eligibility checks. No Google SDK, user identifiers or
 * political data. Used by debug App Open and tested in both build variants.
 */
final class AppOpenFrequencyPolicy {
    static final long MIN_INTERVAL_MS = 24L * 60L * 60L * 1000L;
    static final int FIRST_ALLOWED_LAUNCH = 3;

    private AppOpenFrequencyPolicy() {}

    static int nextLaunchCount(int oldValue) {
        if (oldValue < 0) return 1;
        return oldValue == Integer.MAX_VALUE ? oldValue : oldValue + 1;
    }

    /**
     * A zero timestamp is the never-shown sentinel. Negative, future, or
     * corrupted values fail closed. Subtraction avoids timestamp overflow.
     */
    static boolean mayRequest(int launches, long lastShownAtMs, long nowMs) {
        if (launches < FIRST_ALLOWED_LAUNCH || nowMs <= 0) return false;
        if (lastShownAtMs == 0) return true;
        if (lastShownAtMs < 0 || lastShownAtMs > nowMs) return false;
        return nowMs - lastShownAtMs >= MIN_INTERVAL_MS;
    }
}
