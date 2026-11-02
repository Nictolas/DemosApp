import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";

export const useNotificationBadge = () => {
  const { user } = useAuth();

  const { data: unreadCount, isLoading } = useQuery({
    queryKey: ['notificationBadge', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      try {
        const response = await apiRequest("GET", "/api/notifiche");
        if (!response || !response.success) return 0;
        
        const notifiche = response.notifiche || [];
        
        // Conta solo le notifiche non lette (status !== 'letta')
        const unreadNotifications = notifiche.filter((notifica: any) => 
          notifica.status !== 'letta'
        );
        
        return unreadNotifications.length;
      } catch {
        // Non stampare risposte o dettagli personali nei log del browser.
        return 0;
      }
    },
    enabled: Boolean(user?.id),
    refetchInterval: 45000, // Manteniamo la frequenza attuale in primo piano.
    refetchIntervalInBackground: false, // Non scaricare l'intero feed a scheda nascosta.
    staleTime: 30000, // 30 secondi: evita refetch continui durante scroll
    refetchOnWindowFocus: true,
  });

  return {
    unreadCount: unreadCount || 0,
    isLoading
  };
};
