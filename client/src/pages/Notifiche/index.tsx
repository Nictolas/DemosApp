import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useFCM } from "@/hooks/useFCM";
import { useNoScroll } from "@/hooks/useNoScroll";
import { useNotificheData } from "./hooks/useNotificheData";
import { useNotifichePrefs } from "./hooks/useNotifichePrefs";
import { Header } from "./components/Header";
import { ListaNotifiche } from "./components/ListaNotifiche";
import { LoadingStates } from "./components/LoadingStates";
import { PageContainer } from "@/components/PageContainer";

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);


  const { data, isLoading, error, markAsReadMutation } = useNotificheData(user);
  const { handleSwitch } = useNotifichePrefs();

  // Marca automaticamente tutte le notifiche come lette quando si visita la pagina
  useEffect(() => {
    if (data?.notifiche && data.notifiche.length > 0) {
      const unreadNotifications = data.notifiche.filter(notifica => 
        notifica.status === 'non_letta' || notifica.status === 'unread'
      );
      
      if (unreadNotifications.length > 0) {
        console.log('🔄 Marcatura automatica di', unreadNotifications.length, 'notifiche come lette');
        // Marca tutte le notifiche non lette come lette in sequenza
        const markAllAsRead = async () => {
          for (const notifica of unreadNotifications) {
            try {
              await markAsReadMutation.mutateAsync(notifica.id);
            } catch (error) {
              console.error('Errore nel marcare notifica come letta:', error);
            }
          }
        };
        markAllAsRead();
      }
    }
  }, [data?.notifiche, markAsReadMutation]);

  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <LoadingStates isAuthLoading={isAuthLoading} />
        
        <Header />

        <div className="flex-1">
          <ListaNotifiche
            data={data}
            isLoading={isLoading}
            error={error}
            fcmToken={fcmToken}
            fcmError={fcmError}
            permission={permission}
            onSwitch={handleSwitch}
          />
        </div>
      </div>

    </PageContainer>
  );
}
