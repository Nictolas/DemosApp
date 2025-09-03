import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, useParams } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useFCM } from "@/hooks/useFCM";
import { useRappresentantiData } from "./hooks/useRappresentantiData";
import { useRappresentantiActions } from "./hooks/useRappresentantiActions";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { RappresentanteCard } from "./components/RappresentanteCard";
import { LoadingStates } from "./components/LoadingStates";
import { getTitolo } from "./utils/rappresentanteUtils";

export default function ScegliRappresentante() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const authReady = useAuthReady();
  const { token: fcmToken } = useFCM();

  const { 
    rappresentanti, 
    loading, 
    rappresentanteSelezionato, 
    setRappresentanteSelezionato 
  } = useRappresentantiData(user, categoria || '');

  const {
    selezionando,
    opinioniDialogData,
    selezionaRappresentante,
    openOpinioniDialog,
    closeOpinioniDialog
  } = useRappresentantiActions(user, categoria || '', fcmToken);

  const handleSelezionaRappresentante = (rappresentanteId: string) => {
    selezionaRappresentante(rappresentanteId, setRappresentanteSelezionato);
  };

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <LoadingStates 
          authReady={authReady} 
          isLoading={isLoading} 
          loading={loading} 
        />
        
        <Header categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
        
        <ViewOpinioniDialog
          open={!!opinioniDialogData}
          onOpenChange={(open) => { if (!open) closeOpinioniDialog(); }}
          utenteId={opinioniDialogData?.utenteId || ''}
          nome={opinioniDialogData?.nome}
          cognome={opinioniDialogData?.cognome}
          avatarConfig={opinioniDialogData?.avatarConfig}
        />
        
        {rappresentanti.length === 0 ? (
          <EmptyState categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
        ) : (
          <div className="grid grid-cols-2 gap-4 pb-4 max-w-2xl mx-auto">
            {rappresentanti.map((rappresentante) => (
              <RappresentanteCard
                key={rappresentante.id}
                rappresentante={rappresentante}
                isSelected={rappresentante.id === rappresentanteSelezionato}
                isSelezionando={selezionando}
                onSeleziona={handleSelezionaRappresentante}
                onViewOpinioni={openOpinioniDialog}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
