import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth-neon';
import { QUERY_CONFIG } from '../constants';
import { UsersResponse } from '../types';

export const useUsersData = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  const { data: responseData, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async (): Promise<UsersResponse> => {
      const [allUsersResponse, pendingUsersResponse] = await Promise.all([
        apiRequest("GET", "/api/utenti"),
        apiRequest("GET", "/api/utenti/pending")
      ]);
      
      if (!allUsersResponse.ok || !pendingUsersResponse.ok) {
        throw new Error("Errore nel caricamento degli utenti");
      }
      
      const allUsersData = await allUsersResponse.json();
      const pendingUsersData = await pendingUsersResponse.json();
      
      return { 
        utenti: allUsersData.users || allUsersData || [], 
        pendingUsers: pendingUsersData.users || pendingUsersData || [] 
      };
    },
    enabled: !!user && user.ruolo === 'Admin',
    ...QUERY_CONFIG
  });

  // Hook per forzare il refresh quando la pagina diventa visibile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.ruolo === 'Admin') {
        console.log('🔄 Pagina diventata visibile, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        setLastUpdateTime(new Date());
      }
    };

    const handleFocus = () => {
      if (user?.ruolo === 'Admin') {
        console.log('🔄 Finestra riprende focus, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        setLastUpdateTime(new Date());
      }
    };

    // Aggiungi event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient, user?.ruolo]);

  // Aggiorna il timestamp quando i dati cambiano
  useEffect(() => {
    if (responseData) {
      setLastUpdateTime(new Date());
    }
  }, [responseData]);

  // Funzione per refresh manuale
  const refreshData = () => {
    console.log('🔄 Refresh manuale richiesto...');
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    setLastUpdateTime(new Date());
  };

  // Estrai i dati con fallback sicuro
  const utenti = responseData?.utenti || [];
  const pendingUsers = responseData?.pendingUsers || [];

  // Debug logging
  console.log('🔍 DEBUG useUsersData:', {
    responseData,
    utenti: Array.isArray(utenti) ? `${utenti.length} utenti` : `Non array: ${typeof utenti}`,
    pendingUsers: Array.isArray(pendingUsers) ? `${pendingUsers.length} pending` : `Non array: ${typeof pendingUsers}`
  });

  return {
    utenti,
    pendingUsers,
    isLoadingUsers,
    isError,
    lastUpdateTime,
    refreshData
  };
};
