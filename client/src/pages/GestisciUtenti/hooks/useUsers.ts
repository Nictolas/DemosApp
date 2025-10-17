import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UsersResponse } from "../types";

export const useUsers = (user: any) => {
  const queryClient = useQueryClient();

  const { data: responseData, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const [allUsersResponse, pendingUsersResponse] = await Promise.all([
        apiRequest("GET", "/api/users"),
        apiRequest("GET", "/api/users/pending")
      ]);
      if (!allUsersResponse.ok || !pendingUsersResponse.ok) throw new Error("Errore nel caricamento degli utenti");
      const allUsersData = await allUsersResponse.json();
      const pendingUsersData = await pendingUsersResponse.json();
      // Aggiungi campo nome_completo agli utenti
      const addFullName = (users: any[]) => {
        return users.map(user => ({
          ...user,
          nome_completo: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'
        }));
      };

      return { 
        utenti: allUsersData.success ? addFullName(allUsersData.users) : [], 
        pendingUsers: pendingUsersData.success ? addFullName(pendingUsersData.pendingUsers) : [] 
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

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!response.ok) throw new Error("Errore nell'eliminazione dell'utente");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
  });

  return {
    responseData,
    isLoadingUsers,
    isError,
    deleteMutation,
    queryClient
  };
};
