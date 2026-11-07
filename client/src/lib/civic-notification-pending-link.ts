// Native civic notification links are remembered ONLY across a guest login.
// Never persist tokens, user identifiers, political preferences or arbitrary URLs.
const STORAGE_KEY = 'demos_pending_civic_notification_destination_v1';
const MAX_AGE_MS = 15 * 60 * 1000;
const CIVIC_ROUTES = new Set([
  '/iniziative-popolari',
  '/referendum-abrogativi',
  '/eci',
]);

function safeSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function normalizeCivicNotificationTarget(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 2048 || !raw) return null;
  try {
    const url = new URL(raw, 'https://www.demos.community');
    if (url.protocol !== 'https:' || !['www.demos.community', 'demos.community'].includes(url.hostname)
      || url.username || url.password || url.hash || url.port || !CIVIC_ROUTES.has(url.pathname)) {
      return null;
    }
    const values = url.searchParams.getAll('initiative');
    if (values.length !== 1 || [...url.searchParams.keys()].length !== 1) return null;
    const id = values[0];
    if (!id || id.length > 200 || /[\u0000-\u001f\u007f]/.test(id)) return null;
    return url.pathname + '?initiative=' + encodeURIComponent(id);
  } catch {
    return null;
  }
}

export function rememberCivicNotificationTarget(
  raw: string, storage: Storage | null = safeSessionStorage(), now = Date.now(),
): boolean {
  const target = normalizeCivicNotificationTarget(raw);
  if (!target || !storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({target, at: now}));
    return true;
  } catch {
    return false;
  }
}

export function consumePendingCivicNotificationTarget(
  storage: Storage | null = safeSessionStorage(), now = Date.now(),
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    // Consume once: never allow a stale notification to hijack a later login.
    storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (typeof saved.at !== 'number' || !Number.isFinite(saved.at)
      || now < saved.at || now - saved.at > MAX_AGE_MS) return null;
    return normalizeCivicNotificationTarget(saved.target);
  } catch {
    return null;
  }
}
