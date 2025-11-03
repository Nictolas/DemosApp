import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useIniziativeData } from "./hooks/useIniziativeData";
import { useIniziativeVoting } from "./hooks/useIniziativeVoting";
import { Header } from "./components/Header";
import { UserPreferences } from "./components/UserPreferences";
import { IniziativeRanking } from "./components/IniziativeRanking";
import { IniziativaViewDialog } from "./components/IniziativaViewDialog";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <Header />

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Il tuo voto */}
            <UserPreferences
              selectedVoti={selectedVoti}
              iniziative={data?.iniziative || []}
              onRemoveVoto={toggleSelezione}
              currentVotes={currentVotes}
              limit={limit}
              remainingVotes={remainingVotes}
              hasReachedLimit={hasReachedLimit}
            />

            {/* Classifica */}
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

      {/* Dialog di visualizzazione iniziativa */}
      <IniziativaViewDialog
        iniziativa={viewIniziativa}
        onClose={handleCloseView}
      />
    </div>
  );
}
