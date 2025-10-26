import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useCandidatiData } from "./hooks/useCandidatiData";
import { useCandidatiActions } from "./hooks/useCandidatiActions";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { CandidatoCard } from "./components/CandidatoCard";
import { LoadingStates } from "./components/LoadingStates";
import { OpinioniIncompleteAlert } from "./components/OpinioniIncompleteAlert";
import { getTitolo } from "./utils/candidatoUtils";

export default function ScegliCandidato() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const authReady = useAuthReady();
  const [, setLocation] = useLocation();

  const { 
    candidati, 
    loading, 
    candidatoSelezionato, 
    setCandidatoSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData
  } = useCandidatiData(user, categoria || '');

  const {
    selezionando,
    opinioniDialogData,
    selezionaCandidato,
    openOpinioniDialog,
    closeOpinioniDialog
  } = useCandidatiActions(user, categoria || '', null);

  const handleSelezionaCandidato = (candidatoId: string) => {
    selezionaCandidato(candidatoId, setCandidatoSelezionato);
  };

  const handleGoToOpinions = () => {
    setShowOpinioniAlert(false);
    setLocation('/opinioni');
  };

  const handleContinueAnyway = () => {
    setShowOpinioniAlert(false);
  };

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-hidden page-with-navbar">
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
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
          
          {candidati.length === 0 ? (
            <EmptyState categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-full max-w-2xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {candidati.map((candidato) => {
                  console.log('🔍 DEBUG - Passando candidato a CandidatoCard:', {
                    id: candidato.id,
                    nome: candidato.nome,
                    opinioniComuni: candidato.opinioniComuni,
                    tipo: typeof candidato.opinioniComuni,
                    tutteLeChiavi: Object.keys(candidato)
                  });
                  return (
                    <CandidatoCard
                      key={candidato.id}
                      candidato={candidato}
                      isSelected={candidato.id === candidatoSelezionato}
                      isSelezionando={selezionando}
                      onSeleziona={handleSelezionaCandidato}
                      onViewOpinioni={openOpinioniDialog}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Alert per opinioni incomplete */}
      <OpinioniIncompleteAlert
        open={showOpinioniAlert}
        onOpenChange={setShowOpinioniAlert}
        data={opinioniAlertData}
        onGoToOpinions={handleGoToOpinions}
        onContinueAnyway={handleContinueAnyway}
      />
      
      {/* Dialog per visualizzare opinioni candidato */}
      <ViewOpinioniDialog
        open={!!opinioniDialogData}
        onOpenChange={(open) => !open && closeOpinioniDialog()}
        data={opinioniDialogData}
      />
    </PageTransition>
  );
}
