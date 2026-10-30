/**
 * Logout is always local-first. A successful local wipe does not prove that
 * access/refresh tokens were revoked on the backend. Never persist credentials
 * for retry or log token values, response bodies, or exception objects.
 */
export type LogoutRevocationResult = {
  serverRevocationConfirmed: boolean;
  reason: "confirmed" | "missing-token" | "http-error" | "timeout" | "network";
};

export async function requestLogoutRevocation({
  url,
  accessToken,
  refreshToken,
  fetcher = fetch,
  timeoutMs = 8000,
}: {
  url: string;
  accessToken: string | null;
  refreshToken: string | null;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<LogoutRevocationResult> {
  if (!accessToken && !refreshToken) {
    return { serverRevocationConfirmed: false, reason: "missing-token" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    return response.ok
      ? { serverRevocationConfirmed: true, reason: "confirmed" }
      : { serverRevocationConfirmed: false, reason: "http-error" };
  } catch {
    return {
      serverRevocationConfirmed: false,
      reason: controller.signal.aborted ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timeout);
  }
}
