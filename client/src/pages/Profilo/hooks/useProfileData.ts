import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth-neon';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { apiRequest } from '@/lib/queryClient';
import { UserInfo } from '@/types/profile';
import { OpinionQuestion } from '../types';
import { extractBaseOpinions } from '../utils/opinionUtils';

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

  /**
   * Funzione unificata per caricare tutti i dati del profilo
   */
  const fetchAllProfileData = async () => {
    if (!user) return;
    
    setIsLoadingInfo(true);
    setError(null);
    
    try {
      console.log('🔍 DEBUG Profilo - Iniziando caricamento dati profilo...');
      
      // 1. Carica dati utente
      console.log('🔍 DEBUG Profilo - Caricando dati utente...');
      const userResponse = await apiRequest("GET", "/api/users/me");
      if (!userResponse.ok) {
        throw new Error(`Errore nel caricamento dati utente: ${userResponse.status}`);
      }
      
      const userResult = await userResponse.json();
      console.log('🔍 DEBUG Profilo - Risposta API utente:', userResult);
      
      if (!userResult.success) {
        throw new Error(userResult.message || 'Errore nel caricamento dati utente');
      }
      
      const userData = userResult.user || userResult.data || userResult;
      console.log('🔍 DEBUG Profilo - Dati utente estratti:', userData);
      
      setUserInfo(userData as UserInfo);
      console.log('🔍 DEBUG Profilo - userInfo impostato:', userData);
      
      // 2. Carica opinioni utente
      console.log('🔍 DEBUG Profilo - Caricando opinioni utente...');
      const userOpinionsData = extractBaseOpinions(userData);
      
      setUserOpinions(userOpinionsData);
      console.log('🔍 DEBUG Profilo - Opinion base caricate:', userOpinionsData);
      
      // 3. Carica domande opinioni
      console.log('🔍 DEBUG Profilo - Caricando domande opinioni...');
      try {
        const opinionsResponse = await apiRequest("GET", "/api/opinioni/profile");
        if (opinionsResponse.ok) {
          const opinionsResult = await opinionsResponse.json();
          console.log('🔍 DEBUG Profilo - Risposta opinioni:', opinionsResult);
          if (opinionsResult.success && opinionsResult.data) {
            setOpinionQuestions(Array.isArray(opinionsResult.data.questions) ? opinionsResult.data.questions : []);
            // Aggiorna anche le opinioni dell'utente
            if (opinionsResult.data.userAnswers) {
              setUserOpinions(prev => ({
                ...prev,
                ...opinionsResult.data.userAnswers
              }));
            }
          }
        }
      } catch (opinionsError) {
        console.warn('⚠️ DEBUG Profilo - Errore nel caricamento opinioni:', opinionsError);
        // Non bloccare il caricamento per errori nelle opinioni
      }
      
      // 4. Carica governo ideale
      console.log('🔍 DEBUG Profilo - Caricando governo ideale...');
      try {
        const governoResponse = await apiRequest("GET", "/api/governo/ideale");
        if (governoResponse.ok) {
          const governoResult = await governoResponse.json();
          console.log('🔍 DEBUG Profilo - Risposta governo:', governoResult);
          if (governoResult.success && governoResult.data) {
            setGovernoIdeale(governoResult.data);
          }
        }
      } catch (governoError) {
        console.warn('⚠️ DEBUG Profilo - Errore nel caricamento governo:', governoError);
        // Non bloccare il caricamento per errori nel governo
      }
      
      // 5. Carica configurazione avatar
      if (userData.avatar_config) {
        try {
          setAvatarConfig(JSON.parse(userData.avatar_config));
        } catch (avatarError) {
          console.warn('⚠️ DEBUG Profilo - Errore nel parsing avatar config:', avatarError);
        }
      }
      
      console.log('✅ DEBUG Profilo - Caricamento completato con successo');
      
    } catch (error) {
      console.error('❌ DEBUG Profilo - Errore nel caricamento:', error);
      setError(error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // Carica i dati quando l'utente è pronto
  useEffect(() => {
    if (authReady && user && !isLoading) {
      fetchAllProfileData();
    }
  }, [authReady, user, isLoading]);

  return {
    // Stati
    userInfo,
    isLoadingInfo,
    error,
    userOpinions,
    avatarConfig,
    governoIdeale,
    opinionQuestions,
    
    // Azioni
    setUserInfo,
    setIsLoadingInfo,
    setError,
    setUserOpinions,
    setAvatarConfig,
    setGovernoIdeale,
    setOpinionQuestions,
    fetchAllProfileData,
    
    // Stati di caricamento
    isLoading,
    authReady
  };
};
