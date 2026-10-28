import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect, useParams, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useFCM } from "@/hooks/useFCM";
import { useRappresentantiData } from "./hooks/useRappresentantiData";
import { useRappresentantiActions } from "./hooks/useRappresentantiActions";
import { Header } from "./components/Header";
import { EmptyState } from "./components/EmptyState";
import { RappresentanteCard } from "./components/RappresentanteCard";
import { LoadingStates } from "./components/LoadingStates";
import { OpinioniIncompleteAlert } from "./components/OpinioniIncompleteAlert";
import { getTitolo } from "./utils/rappresentanteUtils";

export default function ScegliRappresentante() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const authReady = useAuthReady();
  const { token: fcmToken } = useFCM();
  const [location, setLocation] = useLocation();
  const isCandidateRoute = location.startsWith('/candidati/');

  const { 
    rappresentanti, 
    loading, 
    rappresentanteSelezionato, 
    setRappresentanteSelezionato,
    showOpinioniAlert,
    setShowOpinioniAlert,
    opinioniAlertData
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

  // Mostra il loader se auth non è pronto o se sta caricando
  if (!authReady || isLoading || loading) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingStates 
            authReady={authReady} 
            isLoading={isLoading} 
            loading={loading} 
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={`h-full min-h-0 overflow-hidden flex flex-col page-with-navbar ${isCandidateRoute ? '' : 'representative-choice-no-scroll'}`}>
        <div className="container mx-auto px-4 py-4 flex-1 min-h-0 overflow-hidden flex flex-col">
          <Header categoria={categoria || ''} getTitolo={() => getTitolo(categoria || '')} />
          
          {opinioniDialogData && (
            <ViewOpinioniDialog
              open={!!opinioniDialogData}
              onOpenChange={(open) => { if (!open) closeOpinioniDialog(); }}
              utenteId={opinioniDialogData.utenteId}
              nome={opinioniDialogData.nome}
              cognome={opinioniDialogData.cognome}
              avatarConfig={opinioniDialogData.avatarConfig}
              categoria={categoria || ''}
            />
          )}
          
          {rappresentanti.length === 0 ? (
            <div className={isCandidateRoute
              ? "flex-1 min-h-0 overflow-y-auto app-page-scroll"
              : "flex-1 min-h-0 overflow-hidden flex items-center justify-center"}>
              <EmptyState isCandidate={isCandidateRoute} />
            </div>
          ) : (
            <div className={isCandidateRoute
              ? "flex-1 min-h-0 overflow-y-auto app-page-scroll flex items-start justify-center"
              : "flex-1 min-h-0 overflow-hidden flex items-center justify-center"}>
              <div className={isCandidateRoute
                ? "grid grid-cols-2 gap-4 w-full max-w-2xl my-auto py-2"
                : "representative-choice-grid grid grid-cols-2 grid-rows-2 gap-2 w-full max-w-2xl h-full min-h-0"}>
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
            </div>
          )}
        </div>
      </div>
      
      {/* Alert per opinioni incomplete */}
      {showOpinioniAlert && opinioniAlertData && (
        <OpinioniIncompleteAlert
          open={showOpinioniAlert}
          onOpenChange={setShowOpinioniAlert}
          data={opinioniAlertData}
          onGoToOpinions={handleGoToOpinions}
          onContinueAnyway={handleContinueAnyway}
        />
      )}
      
    </PageTransition>
  );
}
