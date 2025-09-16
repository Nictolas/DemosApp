import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { useFCM } from "@/hooks/useFCM";
import { useNoScroll } from "@/hooks/useNoScroll";
import { useNotificheData } from "./hooks/useNotificheData";
import { useNotifichePrefs } from "./hooks/useNotifichePrefs";
import { Header } from "./components/Header";
import { ListaNotifiche } from "./components/ListaNotifiche";
import { LoadingStates } from "./components/LoadingStates";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { PageContainer } from "@/components/PageContainer";

export default function Notifiche() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);

  const [skipConfirm, setSkipConfirm] = useState(() => localStorage.getItem("skipLikeDislikeConfirm") === "true");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; notificaId: string | null; action: string | null; }>({ open: false, notificaId: null, action: null });

  const { data, isLoading, error, markAsReadMutation } = useNotificheData(user);
  const { handleSwitch } = useNotifichePrefs();

  const handleMarkAsRead = (notificaId: string) => {
    markAsReadMutation.mutate(notificaId);
  };
  
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
            onMarkAsRead={handleMarkAsRead}
            isPending={markAsReadMutation.isPending}
            fcmToken={fcmToken}
            fcmError={fcmError}
            permission={permission}
            onSwitch={handleSwitch}
          />
        </div>
      </div>

      {/* Dialog di conferma */}
      <ConfirmDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })} 
      />
    </PageContainer>
  );
}
