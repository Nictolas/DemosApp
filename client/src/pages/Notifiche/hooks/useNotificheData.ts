import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NotificheData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useNotificheData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query per caricare le notifiche
  const { data, isLoading, error } = useQuery<NotificheData>({
    queryKey: ['notifiche', user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/notifiche?user_id=${user?.id}`);
      if (!response.ok) throw new Error("Errore nel caricamento delle notifiche.");
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 60000, // Ricarica i dati ogni minuto
  });

  // Mutazione per segnare notifica come letta
  const markAsReadMutation = useMutation({
    mutationFn: async (notificaId: string) => {
      const response = await apiRequest("PUT", `/api/notifiche/${notificaId}/read`);
      if (!response.ok) throw new Error("Errore nell'aggiornamento notifica.");
      return response.json();
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

  return {
    data,
    isLoading,
    error,
    markAsReadMutation
  };
};
