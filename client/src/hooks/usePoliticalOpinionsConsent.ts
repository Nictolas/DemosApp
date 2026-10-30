import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

interface ConsentData {
  granted: boolean;
  timestamp: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ConsentResponse {
  success: boolean;
  consent: ConsentData;
}

/**
 * A verified /auth/me session already includes political_consent. Prime the
 * existing consent query from that verified response so opening any of the
 * four opinion editors does not cause a second private, SQL-backed GET.
 *
 * The dedicated consent endpoint remains available for explicit refetches
 * after a grant/revocation. It must never override an unverified or revoked
 * /auth/me session for authorizing personal political-data access.
 */
export function usePoliticalOpinionsConsent() {
  const { user, isLoading: isAuthLoading, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const verifiedConsent: ConsentData | null =
    isSessionVerified && typeof verifiedPoliticalConsent?.granted === 'boolean'
      ? {
          granted: verifiedPoliticalConsent.granted,
          timestamp: verifiedPoliticalConsent.timestamp,
          ipAddress: null,
          userAgent: null,
        }
      : null;

  const { isLoading, error, refetch } = useQuery<ConsentResponse>({
    queryKey: ['political-opinions-consent', user?.id],
    queryFn: async () => {
      if (!user || !isSessionVerified) {
        throw new Error('Sessione non verificata');
      }
      const response = await apiRequest('GET', '/api/user/political-opinions-consent');
      return response.data;
    },
    // A JWT-only fallback is never enough to authorize political responses.
    enabled: !!user?.id && isSessionVerified,
    // A verified session supplies the same grant/epoch without another SQL GET.
    // Explicit invalidation/refetch after consent changes still uses queryFn.
    initialData: verifiedConsent
      ? { success: true, consent: verifiedConsent } : undefined,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    // Never trust a stale dedicated query over the verified /auth/me session.
    consent: verifiedConsent,
    hasConsent: verifiedConsent?.granted === true &&
      typeof verifiedConsent.timestamp === 'string' &&
      verifiedConsent.timestamp.trim().length > 0,
    isLoading: isAuthLoading || (isSessionVerified && isLoading),
    error,
    refetch,
  };
}
