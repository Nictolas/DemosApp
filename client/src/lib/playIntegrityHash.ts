/**
 * Canonical requestHash shared with api/services/playIntegrityPolicy.js.
 * This module only hashes; it makes no network or Google API calls.
 */
export function stablePlayIntegrityJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stablePlayIntegrityJson).join(',') + ']';
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map((key) => {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) throw new TypeError('Undefined request field');
      return JSON.stringify(key) + ':' + stablePlayIntegrityJson(item);
    }).join(',') + '}';
  }
  throw new TypeError('Unsupported request field');
}

export async function createPlayIntegrityRequestHash(action: string, payload: unknown): Promise<string> {
  if (!/^[a-z0-9_.:-]{1,64}$/.test(action)) throw new TypeError('Invalid action');
  const canonical = 'DEMOS-PLAY-INTEGRITY-v1\n' +
    stablePlayIntegrityJson({ action, payload });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
