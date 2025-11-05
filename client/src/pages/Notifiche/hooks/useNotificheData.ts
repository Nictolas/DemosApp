import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NotificheData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useNotificheData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Funzione per validare UUID
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Query per caricare le notifiche
  const { data, isLoading, error } = useQuery<NotificheData>({
    queryKey: ['notifiche', user?.id],
    queryFn: async () => {
      if (!user?.id || !isValidUUID(user.id)) {
        throw new Error("ID utente non valido");
      }
      const response = await apiRequest("GET", `/api/notifiche?user_id=${user.id}`);
      if (!response || !response.success) {
        throw new Error(response?.error || "Errore nel caricamento delle notifiche.");
      }
      return response;
    },
    enabled: !!user && !!user?.id && isValidUUID(user.id),
    refetchInterval: 60000, // Ricarica i dati ogni minuto
  });

  // Mutazione per segnare notifica come letta
  const markAsReadMutation = useMutation({
    mutationFn: async (notificaId: string) => {
      if (!user?.id || !isValidUUID(user.id)) {
        throw new Error("ID utente non valido");
      }
      const response = await apiRequest("PUT", `/api/notifiche/${notificaId}/read?user_id=${user.id}`);
      if (!response || !response.success) {
        throw new Error(response?.error || "Errore nell'aggiornamento notifica.");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
      toast({ title: "Notifica segnata come letta" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Mutazione per cancellare segnalazione (solo per admin)
  const deleteSegnalazioneMutation = useMutation({
    mutationFn: async (segnalazioneId: string) => {
      if (!user?.id || !isValidUUID(user.id)) {
        throw new Error("ID utente non valido");
      }
      const response = await apiRequest("DELETE", `/api/segnalazioni/${segnalazioneId}?user_id=${user.id}`);
      if (!response || !response.success) {
        throw new Error(response?.error || "Errore nella cancellazione segnalazione.");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
      toast({ title: "Segnalazione cancellata con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  return {
    data,
    isLoading,
    error,
    markAsReadMutation,
    deleteSegnalazioneMutation
  };
};
