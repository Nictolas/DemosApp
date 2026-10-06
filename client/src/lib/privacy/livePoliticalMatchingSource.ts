import type { CitizenOpinionVectorReader } from './localPoliticalMatchingPipeline';

let injectedSource: CitizenOpinionVectorReader | null = null;

export const installLivePoliticalMatchingSource = (source: CitizenOpinionVectorReader): void => {
  if (injectedSource) throw new Error('Live political matching source already installed');
  injectedSource = source;
};

export const hasLivePoliticalMatchingSource = (): boolean => injectedSource !== null;

export const getLivePoliticalMatchingSource = (): CitizenOpinionVectorReader => {
  if (!injectedSource) throw new Error('Privacy-first opinion source unavailable');
  return injectedSource;
};

export const resetLivePoliticalMatchingSourceForTests = (): void => {
  if (import.meta.env.MODE !== 'test') throw new Error('Live political matching source reset is test-only');
  injectedSource = null;
};
