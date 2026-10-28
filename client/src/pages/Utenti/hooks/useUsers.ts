import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useUsers = (user: any) => {
  const queryClient = useQueryClient();

  const { data: responseData, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      // La dashboard Admin carica un solo elenco: le registrazioni
      // Google, Apple e passkey non richiedono approvazione manuale.
      const allUsersResponse = await apiRequest("GET", "/api/users");
      const allUsersData = allUsersResponse.data || allUsersResponse;
      
      // Aggiungi campo nome_completo agli utenti
      const addFullName = (users: any[]) => {
        return users.map(user => ({
          ...user,
          nome_completo: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'
        }));
      };

      return { 
        utenti: allUsersData.success ? addFullName(allUsersData.users || []) : [] 
      };
    },
    // Uso user.ruolo che è il campo restituito dall'API
    enabled: !!user && user.ruolo === "AD",
    // Configurazione per aggiornamento automatico
    refetchOnWindowFocus: true,        // Ricarica quando la finestra riprende il focus
    refetchOnMount: true,              // Ricarica ogni volta che il componente viene montato
    refetchOnReconnect: true,          // Ricarica quando la connessione torna online
    staleTime: 0,                      // I dati sono sempre considerati "stale" e vengono ricaricati
    gcTime: 5 * 60 * 1000,            // Mantieni i dati in cache per 5 minuti
    refetchInterval: 30 * 1000,        // Ricarica automaticamente ogni 30 secondi
    refetchIntervalInBackground: false // Non ricaricare in background (solo quando visibile)
  });

  return {
    responseData,
    isLoadingUsers,
    isError,
    queryClient
  };
};
