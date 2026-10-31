import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeVoting } from "./hooks/useIniziativeVoting";
import { Header } from "./components/Header";
import { UserPreferences } from "./components/UserPreferences";
import { IniziativeRanking } from "./components/IniziativeRanking";
import { IniziativaViewDialog } from "./components/IniziativaViewDialog";
import { IniziativeStatsChart } from "@/pages/IniziativePopolari/components/IniziativeStatsChart";

export default function VotaIniziativaPopolare() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  // Hook per i dati
  const { data, isLoading: isLoadingData, error } = useIniziativeData(user);

  // Hook per la logica di voto
  const {
    selectedVoti,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    classificaOttimistica,
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  } = useIniziativeVoting(data);

  // Stato per il dialog di visualizzazione iniziativa
  const [viewIniziativa, setViewIniziativa] = React.useState<any>(null);

  // Funzione per gestire la visualizzazione dell'iniziativa
  const handleViewIniziativa = (iniziativa: any) => {
    setViewIniziativa(iniziativa);
  };

  // Funzione per chiudere il dialog
  const handleCloseView = () => {
    setViewIniziativa(null);
  };

  // Loading states
  if (!authReady || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect se non autenticato
  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <div
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-6"
        role="region"
        aria-label="Iniziative popolari"
        tabIndex={0}
      >
        <div className="w-full max-w-full mx-auto">
        {error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Colonna sinistra: Header, grafico e preferenze */}
            <div className="space-y-6">
              <Header />

              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <IniziativeStatsChart listaIniziative={data?.iniziative || []} />

                  <UserPreferences
                    selectedVoti={selectedVoti}
                    iniziative={data?.iniziative || []}
                    onRemoveVoto={toggleSelezione}
                    currentVotes={currentVotes}
                    limit={limit}
                    remainingVotes={remainingVotes}
                    hasReachedLimit={hasReachedLimit}
                  />
                </>
              )}
            </div>

            {/* Colonna destra: Classifica */}
            {!isLoadingData && (
              <div className="lg:sticky lg:top-4">
                <IniziativeRanking
                  classifica={classificaOttimistica || data?.classifica || []}
                  iniziative={data?.iniziative || []}
                  selectedVoti={selectedVoti}
                  onToggleSelezioneClassifica={toggleSelezioneClassifica}
                  onViewIniziativa={handleViewIniziativa}
                  isBlocked={data?.blocco?.isBlocked || false}
                  isPending={saveVotiMutation.isPending}
                  hasReachedLimit={hasReachedLimit}
                />
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Dialog di visualizzazione iniziativa */}
      <IniziativaViewDialog
        iniziativa={viewIniziativa}
        onClose={handleCloseView}
      />
    </PageContainer>
  );
}
