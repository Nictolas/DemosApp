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
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // AbortSignal is advisory: an adapter can ignore it and never settle.
    // Race the request against a hard deadline so logout always returns.
    const response = await Promise.race([
      fetcher(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
      }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("logout-revocation-timeout"));
        }, Math.max(1, timeoutMs));
      }),
    ]);
    // A late response from a non-compliant fetch adapter cannot turn an
    // already timed-out attempt into a confirmed revocation.
    if (controller.signal.aborted) {
      return { serverRevocationConfirmed: false, reason: "timeout" };
    }
    return response.ok
      ? { serverRevocationConfirmed: true, reason: "confirmed" }
      : { serverRevocationConfirmed: false, reason: "http-error" };
  } catch {
    return {
      serverRevocationConfirmed: false,
      reason: controller.signal.aborted ? "timeout" : "network",
    };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
