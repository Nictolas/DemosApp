import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
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
    preferenceMutationPending,
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
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
              ) : data?.civic_process_policy?.enabled === false ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                  <h2 className="font-semibold text-lg">Priorità temporaneamente non disponibile</h2>
                  <p className="mt-2 text-sm leading-relaxed">
                    {data?.civic_process_policy?.reason === 'CIVIC_PROCESS_MIGRATION_REQUIRED'
                      ? 'L’archivio istituzionale unificato di DEMOS non è ancora attivo in questo ambiente.'
                      : 'DEMOS abilita questa funzione alle iniziative ufficiali la cui raccolta firme è conclusa e ha raggiunto il quorum o la soglia prevista.'}
                  </p>
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
            {!isLoadingData && data?.civic_process_policy?.enabled !== false && (
              <div className="lg:sticky lg:top-4">
                <IniziativeRanking
                  classifica={classificaOttimistica || data?.classifica || []}
                  iniziative={data?.iniziative || []}
                  selectedVoti={selectedVoti}
                  onToggleSelezioneClassifica={toggleSelezioneClassifica}
                  onViewIniziativa={handleViewIniziativa}
                  isBlocked={data?.blocco?.isBlocked || false}
                  isPending={preferenceMutationPending}
                  hasReachedLimit={hasReachedLimit}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog di visualizzazione iniziativa */}
      <IniziativaViewDialog
        iniziativa={viewIniziativa}
        onClose={handleCloseView}
      />
    </div>
  );
}
