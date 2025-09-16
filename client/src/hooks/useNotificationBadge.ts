import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth-neon";
import { apiRequest } from "@/lib/queryClient";

export const useNotificationBadge = () => {
  const { user } = useAuth();

  const { data: unreadCount, isLoading } = useQuery({
    queryKey: ['notificationBadge', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      try {
        const response = await apiRequest("GET", `/api/notifiche?user_id=${user.id}`);
        if (!response.ok) return 0;
        
        const data = await response.json();
        const notifiche = data.notifiche || [];
        
        // Conta solo le notifiche non lette
        const unreadNotifications = notifiche.filter((notifica: any) => 
          notifica.status === 'non_letta' || notifica.status === 'unread'
        );
        
        console.log('🔔 Badge notifiche aggiornato:', unreadNotifications.length, 'non lette');
        return unreadNotifications.length;
      } catch (error) {
        console.error('Errore nel recupero notifiche per badge:', error);
        return 0;
      }
    },
    enabled: !!user,
    refetchInterval: 10000, // Aggiorna ogni 10 secondi (più frequente)
    staleTime: 5000, // Considera i dati obsoleti dopo 5 secondi
    refetchOnWindowFocus: true, // Aggiorna quando si torna alla finestra
  });

  return {
    unreadCount: unreadCount || 0,
    isLoading
  };
};
