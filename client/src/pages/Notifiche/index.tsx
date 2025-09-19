import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useFCM } from "@/hooks/useFCM";
import { useNotificheData } from "./hooks/useNotificheData";
import { useNotifichePrefs } from "./hooks/useNotifichePrefs";
import { Header } from "./components/Header";
import { ListaNotifiche } from "./components/ListaNotifiche";
import { LoadingStates } from "./components/LoadingStates";
import { PageContainer } from "@/components/PageContainer";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  const queryClient = useQueryClient();
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  

  const { data, isLoading, error, markAsReadMutation, deleteSegnalazioneMutation } = useNotificheData(user);
  const { handleSwitch } = useNotifichePrefs();

  // Marca automaticamente tutte le notifiche come lette quando si visita la pagina (solo una volta)
  useEffect(() => {
    console.log('🔍 DEBUG Notifiche - Data:', data);
    console.log('🔍 DEBUG Notifiche - hasMarkedAsRead:', hasMarkedAsRead);
    
    if (data?.notifiche && data.notifiche.length > 0 && !hasMarkedAsRead) {
      console.log('🔍 DEBUG Notifiche - Notifiche totali:', data.notifiche.length);
      console.log('🔍 DEBUG Notifiche - Status delle notifiche:', data.notifiche.map(n => ({ id: n.id, status: n.status, tipo: n.tipo_notifica })));
      
      const unreadNotifications = data.notifiche.filter(notifica => 
        notifica.status === 'non_letta' || 
        notifica.status === 'unread' || 
        notifica.status === 'aperta' ||
        notifica.status === 'non_letta'
      );
      
      console.log('🔍 DEBUG Notifiche - Notifiche non lette trovate:', unreadNotifications.length);
      
      if (unreadNotifications.length > 0) {
        console.log('🔄 Marcatura automatica di', unreadNotifications.length, 'notifiche come lette');
        setHasMarkedAsRead(true); // Imposta il flag per evitare loop
        
        // Marca tutte le notifiche come lette in una singola operazione
        const markAllAsRead = async () => {
          try {
            // Invia una richiesta per marcare tutte le notifiche come lette
            const response = await apiRequest("PUT", "/api/notifiche/mark-all-read", {
              notifica_ids: unreadNotifications.map(n => n.id),
              user_id: user?.id
            });
            
            if (response.ok) {
              console.log('✅ Tutte le notifiche marcate come lette');
              // Invalida la query per aggiornare i dati
              queryClient.invalidateQueries({ queryKey: ['notifiche'] });
              queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
            }
          } catch (error) {
            console.error('Errore nel marcare notifiche come lette:', error);
          }
        };
        
        markAllAsRead();
      }
    }
  }, [data?.notifiche, hasMarkedAsRead, queryClient]); // Aggiunto hasMarkedAsRead e queryClient

  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <LoadingStates isAuthLoading={isAuthLoading} />
        
        <Header
          fcmToken={fcmToken}
          fcmError={fcmError}
          permission={permission}
          onSwitch={handleSwitch}
        />

        <div className="flex-1">
          <ListaNotifiche
            data={data}
            isLoading={isLoading}
            error={error}
            deleteSegnalazioneMutation={deleteSegnalazioneMutation}
          />
        </div>
      </div>

    </PageContainer>
  );
}
