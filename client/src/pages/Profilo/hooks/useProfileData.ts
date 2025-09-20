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
  const [rappresentantiDetails, setRappresentantiDetails] = useState<Record<string, any>>({});
  const [candidatiDetails, setCandidatiDetails] = useState<Record<string, any>>({});

  /**
   * Funzione unificata per caricare tutti i dati del profilo
   */
  const fetchAllProfileData = async () => {
    if (!user) return;
    
    setIsLoadingInfo(true);
    setError(null);
    
    try {
      console.log('🔍 DEBUG Profilo - Iniziando caricamento dati profilo...');
      console.log('🔍 DEBUG Profilo - userId passato:', userId);
      console.log('🔍 DEBUG Profilo - user.id:', user.id);
      
      // Determina l'ID dell'utente da utilizzare
      const targetUserId = userId || user.id;
      console.log('🔍 DEBUG Profilo - targetUserId:', targetUserId);
      
      // 1. Carica dati utente
      console.log('🔍 DEBUG Profilo - Caricando dati utente...');
      
      // Se userId è fornito, carica i dati di quell'utente specifico
      // Altrimenti carica i dati dell'utente autenticato
      let userResponse;
      if (userId) {
        // Carica dati di un utente specifico (per admin)
        userResponse = await apiRequest("GET", `/api/users/${userId}`);
      } else {
        // Carica dati dell'utente autenticato
        userResponse = await apiRequest("GET", "/api/auth/me");
      }
      
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
        // Se userId è fornito, carica le opinioni di quell'utente specifico
        // Altrimenti carica le opinioni dell'utente autenticato
        let opinionsResponse;
        if (userId) {
          // Carica opinioni di un utente specifico (per admin)
          opinionsResponse = await apiRequest("GET", `/api/users/${userId}/opinioni`);
        } else {
          // Carica opinioni dell'utente autenticato
          opinionsResponse = await apiRequest("GET", "/api/opinioni/profile");
        }
        
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
          const parsedConfig = JSON.parse(userData.avatar_config);
          setAvatarConfig(parsedConfig);
        } catch (avatarError) {
          console.warn('⚠️ DEBUG Profilo - Errore nel parsing avatar config:', avatarError);
          // Se l'avatar_config non è JSON valido, imposta null
          setAvatarConfig(null);
        }
      } else {
        setAvatarConfig(null);
      }
      
      // 6. Carica dettagli rappresentanti (solo se abbiamo un targetUserId)
      if (targetUserId) {
        console.log('🔍 DEBUG Profilo - Caricando dettagli rappresentanti per userId:', targetUserId);
        try {
          const rappresentantiResponse = await apiRequest("GET", "/api/rappresentanti");
          console.log('🔍 DEBUG Profilo - Status rappresentanti response:', rappresentantiResponse.status);
          if (rappresentantiResponse.ok) {
            const rappresentantiResult = await rappresentantiResponse.json();
            console.log('🔍 DEBUG Profilo - Risposta rappresentanti RAW:', JSON.stringify(rappresentantiResult, null, 2));
            console.log('🔍 DEBUG Profilo - rappresentantiResult.data:', rappresentantiResult.data);
            console.log('🔍 DEBUG Profilo - typeof rappresentantiResult.data:', typeof rappresentantiResult.data);
            if (rappresentantiResult.success && rappresentantiResult.data) {
              setRappresentantiDetails(rappresentantiResult.data.rappresentanti || {});
              console.log('✅ DEBUG Profilo - Rappresentanti caricati:', rappresentantiResult.data.rappresentanti);
            } else {
              console.warn('⚠️ DEBUG Profilo - Risposta rappresentanti non valida:', rappresentantiResult);
            }
          } else {
            console.error('❌ DEBUG Profilo - Errore HTTP rappresentanti:', rappresentantiResponse.status);
          }
        } catch (rappresentantiError) {
          console.warn('⚠️ DEBUG Profilo - Errore nel caricamento rappresentanti:', rappresentantiError);
        }
        
        // 7. Carica dettagli candidati
        console.log('🔍 DEBUG Profilo - Caricando dettagli candidati per userId:', targetUserId);
        try {
          const candidatiResponse = await apiRequest("GET", "/api/candidati/selezioni");
          console.log('🔍 DEBUG Profilo - Status candidati response:', candidatiResponse.status);
          if (candidatiResponse.ok) {
            const candidatiResult = await candidatiResponse.json();
            console.log('🔍 DEBUG Profilo - Risposta candidati RAW:', JSON.stringify(candidatiResult, null, 2));
            console.log('🔍 DEBUG Profilo - candidatiResult.data:', candidatiResult.data);
            console.log('🔍 DEBUG Profilo - typeof candidatiResult.data:', typeof candidatiResult.data);
            if (candidatiResult.success && candidatiResult.data) {
              setCandidatiDetails(candidatiResult.data.candidati || {});
              console.log('✅ DEBUG Profilo - Candidati caricati:', candidatiResult.data.candidati);
            } else {
              console.warn('⚠️ DEBUG Profilo - Risposta candidati non valida:', candidatiResult);
            }
          } else {
            console.error('❌ DEBUG Profilo - Errore HTTP candidati:', candidatiResponse.status);
          }
        } catch (candidatiError) {
          console.warn('⚠️ DEBUG Profilo - Errore nel caricamento candidati:', candidatiError);
        }
      } else {
        console.warn('⚠️ DEBUG Profilo - Nessun targetUserId disponibile per caricare rappresentanti e candidati');
        console.warn('⚠️ DEBUG Profilo - userId:', userId, 'user.id:', user?.id);
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
  }, [authReady, user, isLoading, userId]);

  return {
    // Stati
    userInfo,
    isLoadingInfo,
    error,
    userOpinions,
    avatarConfig,
    governoIdeale,
    opinionQuestions,
    rappresentantiDetails,
    candidatiDetails,
    
    // Azioni
    setUserInfo,
    setIsLoadingInfo,
    setError,
    setUserOpinions,
    setAvatarConfig,
    setGovernoIdeale,
    setOpinionQuestions,
    setRappresentantiDetails,
    setCandidatiDetails,
    fetchAllProfileData,
    
    // Stati di caricamento
    isLoading,
    authReady
  };
};
