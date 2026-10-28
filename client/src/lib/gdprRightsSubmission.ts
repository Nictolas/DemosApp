// Per-form, memory-only retry state. Nothing is persisted across navigation,
// logout or account changes; the UI must mount a new form for each account.
type SendRequest = (
  method: string, path: string, body: unknown, headers: Record<string, string>
) => Promise<{json(): Promise<unknown>}>;

export type RightsReceipt = {requestId: string; replayed: boolean};
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedCategories = new Set([
  'personal_data', 'voting_data', 'technical_data',
  'political_opinions', 'communication_data'
]);

function canonicalCategories(categories: string[]) {
  if (!Array.isArray(categories) || categories.length === 0 ||
      categories.some(category => !allowedCategories.has(category)) ||
      new Set(categories).size !== categories.length) {
    throw Error('GDPR_CATEGORIES_INVALID');
  }
  return [...categories].sort();
}

export function createGdprRightsSubmission(
  send: SendRequest,
  newId: () => string = () => globalThis.crypto.randomUUID()
) {
  let pending: {
    fingerprint: string; key: string; inFlight?: Promise<RightsReceipt>
  } | undefined;

  function submit(method: string, path: string, body: object): Promise<RightsReceipt> {
    const fingerprint = JSON.stringify([method, path, body]);
    if (pending?.inFlight) {
      // React's loading state updates on the next render. This synchronous
      // guard also prevents two clicks in the same render from sending twice.
      if (pending.fingerprint === fingerprint) return pending.inFlight;
      return Promise.reject(Error('GDPR_SUBMISSION_IN_FLIGHT'));
    }
    if (!pending || pending.fingerprint !== fingerprint) {
      const key = newId();
      if (!uuidV4.test(key)) return Promise.reject(Error('GDPR_RETRY_KEY_UNAVAILABLE'));
      pending = {fingerprint, key};
    }
    const current = pending;
    current.inFlight = (async () => {
      try {
        const response = await send(method, path, body, {'Idempotency-Key': current.key});
        const data = await response.json() as Record<string, unknown> | null;
        if (!data || data.success !== true || data.request_id !== current.key ||
            (data.replayed !== undefined && typeof data.replayed !== 'boolean')) {
          throw Error('GDPR_RECEIPT_UNVERIFIED');
        }
        // A replay proves receipt of the original action, not that an old
        // processing restriction is still the current setting (data:null).
        const receipt = {requestId: current.key, replayed: data.replayed === true};
        if (pending === current) pending = undefined;
        return receipt;
      } finally {
        // Keep the same key after uncertain failures. The next explicit click
        // retries the same payload; changed input obtains a new key.
        current.inFlight = undefined;
      }
    })();
    return current.inFlight;
  }

  return {
    limit(categories: string[]) {
      return submit('PUT', '/api/user/limit-processing', {
        limited: true, categories: canonicalCategories(categories), reason: null
      });
    },
    object(categories: string[], reason: string) {
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
        return Promise.reject(Error('GDPR_REASON_INVALID'));
      }
      return submit('POST', '/api/user/object', {
        categories: canonicalCategories(categories), reason: reason.trim()
      });
    }
  };
}
