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
        if (!response || !response.success) return 0;
        
        const notifiche = response.notifiche || [];
        
        // Conta solo le notifiche non lette (status !== 'letta')
        const unreadNotifications = notifiche.filter((notifica: any) => 
          notifica.status !== 'letta'
        );
        
        console.log('🔔 Badge notifiche aggiornato:', unreadNotifications.length, 'non lette');
        return unreadNotifications.length;
      } catch (error) {
        console.error('Errore nel recupero notifiche per badge:', error);
        return 0;
      }
    },
    enabled: !!user,
    refetchInterval: 45000, // 45 secondi: riduce carico backend
    staleTime: 30000, // 30 secondi: evita refetch continui durante scroll
    refetchOnWindowFocus: true,
  });

  return {
    unreadCount: unreadCount || 0,
    isLoading
  };
};
