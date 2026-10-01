const readBooleanFlag = (value: unknown): boolean =>
  String(value ?? '').trim().toLowerCase() === 'true';

const viteEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | boolean | undefined>;
}).env;

export const PRIVACY_FEATURES = Object.freeze({
  // Disabled by default. Do not wire this to production matching until
  // the citizen political vector is no longer read by the identified backend.
  clientMatching: readBooleanFlag(viteEnv?.VITE_PRIVACY_CLIENT_MATCHING)
});
