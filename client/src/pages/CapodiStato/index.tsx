import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useCapoStatoData } from "./hooks/useCapoStatoData";
import { useCapoStatoVoting } from "./hooks/useCapoStatoVoting";
import { useConsensoData } from "./hooks/useConsensoData";
import { Header } from "./components/Header";
import { BlockedWarning } from "./components/BlockedWarning";
import { ConsensoSection } from "./components/ConsensoSection";
import { VotingForm } from "./components/VotingForm";
import { CandidatesRanking } from "./components/CandidatesRanking";
import { ConfirmDialog } from "./components/ConfirmDialog";

export default function CapodiStato() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  // Hook per i dati
  const { data, isLoading: isLoadingData } = useCapoStatoData(user);

  // Hook per i dati di consenso
  const { 
    data: consensoData, 
    isLoading: isLoadingConsenso, 
    voteConsenso, 
    isVoting: isVotingConsenso 
  } = useConsensoData(user);

  // Hook per la logica di voto
  const {
    selectedVoti,
    saveVotiMutation,
    handleAddNomeLocal,
    handleRemoveLocal,
    toggleSelezione,
    votiCambiati,
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit,
    showRemoveDialog,
    votoToRemove,
    confirmRemove,
    cancelRemove
  } = useCapoStatoVoting(data);

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
    <div className="capo-di-stato-page min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="w-full max-w-full mx-auto h-full min-h-0 lg:overflow-hidden flex flex-col">
        {data?.blocco.isBlocked && (
          <BlockedWarning unlockDate={data.blocco.unlockDate} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-4 items-start flex-1 min-h-0 lg:overflow-hidden">
          {/* Colonna sinistra: Capo di Stato, Consenso, Il tuo voto */}
          <div className="space-y-6 lg:space-y-3 lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
            <Header />

            {isLoadingData || isLoadingConsenso ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {consensoData && (
                  <ConsensoSection
                    data={consensoData}
                    onVote={voteConsenso}
                    isVoting={isVotingConsenso}
                  />
                )}

                <div className="lg:min-h-0 lg:overflow-hidden lg:flex-1">
                  <VotingForm
                    selectedVoti={selectedVoti}
                    classifica={data?.classifica || []}
                    isBlocked={data?.blocco.isBlocked || false}
                    onAddNome={handleAddNomeLocal}
                    onRemoveNome={handleRemoveLocal}
                    hasReachedLimit={hasReachedLimit}
                    currentVotes={currentVotes}
                    limit={limit}
                    remainingVotes={remainingVotes}
                  />
                </div>
              </>
            )}
          </div>

          {/* Colonna destra: Classifica candidati */}
          {!isLoadingData && !isLoadingConsenso && (
            <div className="lg:h-full lg:min-h-0 lg:overflow-hidden">
              <CandidatesRanking
                classifica={data?.classifica || []}
                selectedVoti={selectedVoti}
                isBlocked={data?.blocco.isBlocked || false}
                isPending={saveVotiMutation.isPending}
                onToggleSelezione={toggleSelezione}
                hasReachedLimit={hasReachedLimit}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialog di conferma rimozione voto */}
      {showRemoveDialog && (
        <ConfirmDialog
          open={showRemoveDialog}
          onOpenChange={(open) => {
            console.log('🔍 DEBUG CLIENT - Dialog onOpenChange chiamato con:', open);
            if (!open) cancelRemove();
          }}
          onConfirm={() => {
            console.log('🔍 DEBUG CLIENT - Dialog onConfirm chiamato');
            confirmRemove();
          }}
          isPending={saveVotiMutation.isPending}
          title="Rimuovere il voto?"
          description={`Vuoi rimuovere il voto per "${votoToRemove}"?`}
        />
      )}
    </div>
  );
}
