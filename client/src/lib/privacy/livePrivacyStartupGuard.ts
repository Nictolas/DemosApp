import { getLivePoliticalMatchingRuntimeMode } from './liveMatchingCutoverPolicy';
import { hasLivePoliticalMatchingSource } from './livePoliticalMatchingSource';

export const assertLivePrivacyStartupReady = (): void => {
  const { mode } = getLivePoliticalMatchingRuntimeMode();
  if (mode === 'privacy-first' && !hasLivePoliticalMatchingSource()) {
    throw new Error('Privacy-first startup blocked: secure local opinion source unavailable');
  }
};
