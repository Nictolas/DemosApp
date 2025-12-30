import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useNotificheData } from "./hooks/useNotificheData";
import { Header } from "./components/Header";
import { ListaNotifiche } from "./components/ListaNotifiche";
import { TestNotifica } from "./components/TestNotifica";
import { LoadingStates } from "./components/LoadingStates";
import { PageContainer } from "@/components/PageContainer";

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, isLoading, error, deleteSegnalazioneMutation } = useNotificheData(user);

  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full flex flex-col" style={{ minHeight: 'calc(100vh - 6rem - env(safe-area-inset-bottom))' }}>
        <LoadingStates isAuthLoading={isAuthLoading} />
        
        <div className="flex-shrink-0">
          <Header />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <TestNotifica />
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
