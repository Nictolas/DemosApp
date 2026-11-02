import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useGraziaData } from "./hooks/useGraziaData";
import { useGraziaVoting } from "./hooks/useGraziaVoting";
import { Header } from "./components/Header";
import { ProposeSubjectButton } from "@/components/ProposeSubjectButton";
import { BlockedWarning } from "./components/BlockedWarning";
import { GraziaForm } from "./components/GraziaForm";
import { ClassificaCarcerati } from "./components/ClassificaCarcerati";
import { ConfirmDialog } from "./components/ConfirmDialog";

export default function Grazia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  const { data, isLoadingData, error, saveVotiMutation } = useGraziaData(user);
  const { 
    votingState, 
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit,
    showRemoveDialog,
    votoToRemove,
    confirmRemove,
    cancelRemove
  } = useGraziaVoting(data, saveVotiMutation);


  if (!authReady || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }


  return (
    <PageContainer className="overflow-hidden bg-gray-50">
      {/* Stessa testata bianca, centrata e fissa delle directory pubbliche. */}
      <div className="grazia-page__fixed-header shrink-0 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 sm:py-3">
        <div className="relative mx-auto w-full max-w-6xl">
          <Header />
          <div className="absolute right-0 top-0 z-10">
            <ProposeSubjectButton category="grazia" />
          </div>
          {data?.blocco.isBlocked && (
            <BlockedWarning unlockDate={data.blocco.unlockDate} />
          )}
        </div>
      </div>
      <div className="container mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">

        {error ? (
          <div className="rounded border-l-4 border-red-500 bg-red-100 p-4 text-red-800">
            <strong>Errore nel caricamento dei dati:</strong> {error.message}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 md:grid-cols-2 md:grid-rows-1 lg:gap-6">
            {/* I controlli di voto restano visibili quando si scorre la lista. */}
            <div className="grazia-page__fixed-controls min-h-0 shrink-0 space-y-1 lg:space-y-3">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <GraziaForm
                    nomeInput={votingState.nomeInput}
                    selectedVoti={votingState.selectedVoti}
                    classifica={data?.classifica || []}
                    isBlocked={data?.blocco.isBlocked || false}
                    isPending={saveVotiMutation.isPending}
                    onUpdateField={updateField}
                    onSubmit={addNomeLocal}
                    onRemoveLocal={removeLocal}
                    hasReachedLimit={hasReachedLimit}
                    currentVotes={currentVotes}
                    limit={limit}
                    remainingVotes={remainingVotes}
                  />
                </>
              )}
            </div>

            {/* Solo la classifica dei soggetti approvati scorre. */}
            <div
              className="app-page-scroll min-h-0 min-w-0 overflow-y-auto overscroll-contain pb-4"
              role="region"
              aria-label="Classifica Grazia"
              tabIndex={0}
            >
              {!isLoadingData && (
                <ClassificaCarcerati
                  classifica={data?.classifica || []}
                  selectedVoti={votingState.selectedVoti}
                  isBlocked={data?.blocco.isBlocked || false}
                  isPending={saveVotiMutation.isPending}
                  onToggleSelezione={toggleSelezioneClassifica}
                  hasReachedLimit={hasReachedLimit}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialog separato dalla classifica scorrevole. */}
      {showRemoveDialog && (
        <ConfirmDialog
          open={showRemoveDialog}
          onOpenChange={(open) => {
            if (!open) cancelRemove();
          }}
          onConfirm={confirmRemove}
          isPending={saveVotiMutation.isPending}
          title="Rimuovere la richiesta?"
          description={`Vuoi rimuovere la richiesta di grazia per "${votoToRemove}"?`}
        />
      )}
    </PageContainer>
  );
}
