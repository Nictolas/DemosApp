import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { NotificheData } from "../types";
import {
  fetchNotificationFeed,
  isValidNotificationUserId,
  notificationFeedKey,
  notificationFeedQueryPolicy,
} from "@/lib/notificationFeed";
import { useToast } from "@/hooks/use-toast";

export const useNotificheData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query per caricare le notifiche
  const { data, isLoading, error } = useQuery<NotificheData>({
    queryKey: notificationFeedKey(user?.id),
    queryFn: fetchNotificationFeed,
    enabled: isValidNotificationUserId(user?.id),
    ...notificationFeedQueryPolicy,
  });

  // Mutazione per cancellare segnalazione (solo per admin)
  const deleteSegnalazioneMutation = useMutation({
    mutationFn: async (segnalazioneId: string) => {
      if (!user?.id || !isValidNotificationUserId(user.id)) {
        throw new Error("ID utente non valido");
      }
      const response = await apiRequest("DELETE", `/api/segnalazioni/${segnalazioneId}`);
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || "Errore nella cancellazione segnalazione.";
        throw new Error(errorMsg);
      }
      const result = response.data;
      if (!result || result.success === false) {
        const errorMsg = result?.error || "Errore nella cancellazione segnalazione.";
        throw new Error(errorMsg);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifiche'] });
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
    deleteSegnalazioneMutation
  };
};
