import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useCapoStatoData } from "./hooks/useCapoStatoData";
import { useCapoStatoVoting } from "./hooks/useCapoStatoVoting";
import { useConsensoData } from "./hooks/useConsensoData";
import { Header } from "./components/Header";
import { ProposeSubjectButton } from "@/components/ProposeSubjectButton";
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
    <PageContainer className="capo-di-stato-page overflow-hidden bg-gray-50">
      {/* Stessa testata bianca, centrata e fissa delle directory pubbliche. */}
      <div className="capo-stato__fixed-header shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-3 sm:px-6 sm:pt-4">
        <div className="relative mx-auto w-full max-w-6xl">
          <Header />
          <div className="absolute right-0 top-0 z-10">
            <ProposeSubjectButton category="capo_stato" />
          </div>
        </div>
      </div>
      <div className="container mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 md:grid-cols-2 md:grid-rows-1 lg:gap-6">
          {/* Consenso e voto sono fissi, sopra la lista su mobile. */}
          <div className="capo-stato__fixed-controls min-h-0 min-w-0 space-y-1 lg:space-y-3">
            {data?.blocco.isBlocked && (
              <BlockedWarning unlockDate={data.blocco.unlockDate} />
            )}

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
              </>
            )}
          </div>

          {/* Il solo elenco candidati scorre; titolo e comandi non scorrono. */}
          <div className="min-h-0 min-w-0 overflow-hidden">
            {!isLoadingData && !isLoadingConsenso && (
              <CandidatesRanking
                classifica={data?.classifica || []}
                selectedVoti={selectedVoti}
                isBlocked={data?.blocco.isBlocked || false}
                isPending={saveVotiMutation.isPending}
                onToggleSelezione={toggleSelezione}
                hasReachedLimit={hasReachedLimit}
              />
            )}
          </div>
        </div>
      </div>

      {/* Il dialogo di conferma è esterno alla regione di scroll. */}
      {showRemoveDialog && (
        <ConfirmDialog
          open={showRemoveDialog}
          onOpenChange={(open) => {
            if (!open) cancelRemove();
          }}
          onConfirm={confirmRemove}
          isPending={saveVotiMutation.isPending}
          title="Rimuovere il voto?"
          description={`Vuoi rimuovere il voto per "${votoToRemove}"?`}
        />
      )}
    </PageContainer>
  );
}
