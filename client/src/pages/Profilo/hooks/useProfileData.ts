import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { apiRequest } from '@/lib/queryClient';
import { UserInfo } from '@/types/profile';
import { OpinionQuestion } from '../types';
import { extractBaseOpinions } from '../utils/opinionUtils';

// Legacy opinion payloads use compact values; the profile UI uses labels.
const normalizeOpinionValue = (value: unknown): string | null => {
  if (value === 'f' || value === 'Sì' || value === 'Favorevole') return 'Favorevole';
  if (value === 'c' || value === 'No' || value === 'Contrario') return 'Contrario';
  if (value === 'i' || value === 'Indeciso' || value === 'Non lo so') return 'Indeciso';
  return null;
};

const parseAvatarConfig = (value: unknown): any => {
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch {
    return null;
  }
};

export const useProfileData = (userId?: string) => {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userOpinions, setUserOpinions] = useState<Record<string, string>>({});
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [governoIdeale, setGovernoIdeale] = useState<Record<string, string>>({});
  const [opinionQuestions, setOpinionQuestions] = useState<OpinionQuestion[]>([]);
  const [rappresentantiDetails, setRappresentantiDetails] = useState<Record<string, any>>({});
  const [candidatiDetails, setCandidatiDetails] = useState<Record<string, any>>({});

  // A navigation, auth change or retry must not render stale political
  // preferences from an earlier profile request or another signed-in account.
  const currentRequest = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const fetchAllProfileData = async () => {
    if (!user?.id) return;

    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    const version = ++requestVersion.current;
    const isCurrent = () => !controller.signal.aborted && requestVersion.current === version;

    setIsLoadingInfo(true);
    setError(null);
    setUserInfo(null);
    setUserOpinions({});
    setAvatarConfig(null);
    setGovernoIdeale({});
    setOpinionQuestions([]);
    setRappresentantiDetails({});
    setCandidatiDetails({});

    try {
      const targetUserId = userId || user.id;
      const isOwnProfile = String(targetUserId) === String(user.id);

      // Admin's /api/users/:userId is NOT the public-profile API.
      // Never request an external user's private or Admin profile.
      const response = await apiRequest(
        'GET',
        isOwnProfile ? '/api/users/me' : '/api/users/' + targetUserId + '/public-profile',
        undefined, undefined, controller.signal
      );
      if (!isCurrent()) return;
      if (!response.ok || !response.data) {
        throw new Error('Profilo non disponibile');
      }

      const payload = response.data;
      if (!isOwnProfile && payload.success !== true) {
        throw new Error('Profilo pubblico non disponibile');
      }
      const profile = payload.user || payload.data || payload;
      if (!profile || typeof profile !== 'object' || !profile.id) {
        throw new Error('Profilo non disponibile');
      }

      let opinions: Record<string, string> = isOwnProfile ? extractBaseOpinions(profile) : {};
      let questions: OpinionQuestion[] = [];
      let publicGovernment: Record<string, string> = {};
      let representatives: Record<string, any> = {};
      let candidates: Record<string, any> = {};

      if (!isOwnProfile) {
        // Only the server's minimized target projection is used for public
        // political selections; never fall back to the viewer's own endpoints.
        publicGovernment = payload.public?.governoIdeale || {};
        representatives = payload.public?.rappresentanti || {};
        candidates = payload.public?.candidati || {};
      }

      try {
        const opinionsResponse = await apiRequest(
          'GET',
          isOwnProfile
            ? '/api/opinioni/profile'
            : '/api/users/' + targetUserId + '/opinioni',
          undefined, undefined, controller.signal
        );
        if (!isCurrent()) return;
        if (opinionsResponse.ok && opinionsResponse.data?.success) {
          const data = opinionsResponse.data.data;
          if (isOwnProfile) {
            questions = Array.isArray(data?.questions) ? data.questions : [];
            if (data?.userAnswers && typeof data.userAnswers === 'object') {
              opinions = { ...opinions, ...data.userAnswers };
            }
          } else if (Array.isArray(data?.opinioni)) {
            questions = data.opinioni.map((item: any) => ({
              id: String(item.id), text: String(item.text || '')
            }));
            for (const item of data.opinioni) {
              const value = normalizeOpinionValue(item.userAnswer);
              if (value) opinions[String(item.id)] = value;
            }
          }
        }
      } catch {
        if (!isCurrent()) return;
        // Opinions are optional. The server still enforces target visibility.
      }

      if (isOwnProfile) {
        const requests = await Promise.allSettled([
          apiRequest('GET', '/api/governo/ideale', undefined, undefined, controller.signal),
          apiRequest('GET', '/api/rappresentanti', undefined, undefined, controller.signal),
          apiRequest('GET', '/api/candidati/selezioni', undefined, undefined, controller.signal)
        ]);
        if (!isCurrent()) return;
        const governmentResponse = requests[0];
        if (governmentResponse.status === 'fulfilled'
            && governmentResponse.value.ok && governmentResponse.value.data?.success) {
          publicGovernment = governmentResponse.value.data.data || {};
        }
        const representativeResponse = requests[1];
        if (representativeResponse.status === 'fulfilled'
            && representativeResponse.value.ok && representativeResponse.value.data?.success) {
          representatives = representativeResponse.value.data.data?.rappresentanti || {};
        }
        const candidateResponse = requests[2];
        if (candidateResponse.status === 'fulfilled'
            && candidateResponse.value.ok && candidateResponse.value.data?.success) {
          candidates = candidateResponse.value.data.data?.candidati || {};
        }
      }

      if (!isCurrent()) return;
      setUserInfo(profile as UserInfo);
      setAvatarConfig(parseAvatarConfig(profile.avatar_config));
      setUserOpinions(opinions);
      setOpinionQuestions(questions);
      setGovernoIdeale(publicGovernment);
      setRappresentantiDetails(representatives);
      setCandidatiDetails(candidates);
    } catch {
      if (isCurrent()) setError('Impossibile caricare il profilo');
    } finally {
      if (isCurrent()) setIsLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (authReady && user?.id && !isLoading) {
      void fetchAllProfileData();
    } else {
      currentRequest.current?.abort();
      requestVersion.current++;
      setUserInfo(null);
      setUserOpinions({});
      setGovernoIdeale({});
      setRappresentantiDetails({});
      setCandidatiDetails({});
    }

    return () => {
      currentRequest.current?.abort();
      requestVersion.current++;
    };
  }, [authReady, user?.id, isLoading, userId]);

  return {
    userInfo, isLoadingInfo, error, userOpinions, avatarConfig,
    governoIdeale, opinionQuestions, rappresentantiDetails, candidatiDetails,
    setUserInfo, setIsLoadingInfo, setError, setUserOpinions,
    setAvatarConfig, setGovernoIdeale, setOpinionQuestions,
    setRappresentantiDetails, setCandidatiDetails, fetchAllProfileData,
    isLoading, authReady
  };
};
