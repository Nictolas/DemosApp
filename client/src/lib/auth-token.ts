const TOKEN_KEYS = ["auth_token", "token", "authToken"] as const;
const REFRESH_TOKEN_KEY = "refresh_token";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAuthToken(): string | null {
  if (!hasWindow()) return null;
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value && value !== "null" && value !== "undefined") {
      return value;
    }
  }
  return null;
}

export function setAuthToken(token: string | null | undefined): void {
  if (!hasWindow()) return;
  if (!token || token === "null" || token === "undefined") {
    clearAuthToken();
    return;
  }
  // Canonical key + backward compatibility keys.
  localStorage.setItem("auth_token", token);
  localStorage.setItem("token", token);
  localStorage.setItem("authToken", token);
}

export function clearAuthToken(): void {
  if (!hasWindow()) return;
  for (const key of TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
}

export function clearSessionTokens(): void {
  if (!hasWindow()) return;
  clearAuthToken();
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
