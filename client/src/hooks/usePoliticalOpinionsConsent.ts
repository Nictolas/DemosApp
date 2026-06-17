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
 * Hook per gestire il consenso alle opinioni politiche (GDPR Art. 9)
 */
export function usePoliticalOpinionsConsent() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<ConsentResponse>({
    queryKey: ['political-opinions-consent', user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('Utente non autenticato');
      }
      const response = await apiRequest('GET', '/api/user/political-opinions-consent');
      return response.data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minuti
    retry: 1
  });

  return {
    consent: data?.consent,
    hasConsent: data?.consent?.granted || false,
    isLoading,
    error,
    refetch
  };
}

