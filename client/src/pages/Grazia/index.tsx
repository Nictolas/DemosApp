import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useToast } from "@/hooks/use-toast";
import { useGraziaData } from "./hooks/useGraziaData";
import { useGraziaVoting } from "./hooks/useGraziaVoting";
import { Header } from "./components/Header";
import { BlockedWarning } from "./components/BlockedWarning";
import { GraziaForm } from "./components/GraziaForm";
import { ClassificaCarcerati } from "./components/ClassificaCarcerati";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CreateButton } from "./components/CreateButton";
import { CarceratoForm } from "./components/CarceratoForm";

export default function Grazia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const { data, isLoadingData, error, saveVotiMutation } = useGraziaData(user);
  const { 
    votingState, 
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    showForm,
    hideForm,
    handleCreateCarcerato,
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
    <PageContainer className="overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <div
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-5 sm:p-4"
        role="region"
        aria-label="Contenuti della pagina Grazia"
        tabIndex={0}
      >
        <div className="container mx-auto max-w-6xl">
        {data?.blocco.isBlocked && (
          <BlockedWarning unlockDate={data.blocco.unlockDate} />
        )}

        {error ? (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded">
            <b>Errore nel caricamento dei dati:</b><br />
            {error.message}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-2 sm:gap-6 lg:grid-cols-2">
            {/* Colonna sinistra: Header, form e voto */}
            <div className="space-y-2 sm:space-y-6">
              <Header />

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

                  <div className="flex items-center">
                    <CreateButton onClick={showForm} />
                  </div>

                  {votingState.showForm && (
                    <CarceratoForm
                      onSubmit={handleCreateCarcerato}
                      onCancel={hideForm}
                      isLoading={false}
                    />
                  )}
                </>
              )}
            </div>

            {/* Colonna destra: Classifica Carcerati */}
            {!isLoadingData && (
              <div className="lg:sticky lg:top-4">
                <ClassificaCarcerati
                  classifica={data?.classifica || []}
                  selectedVoti={votingState.selectedVoti}
                  isBlocked={data?.blocco.isBlocked || false}
                  isPending={saveVotiMutation.isPending}
                  onToggleSelezione={toggleSelezioneClassifica}
                  hasReachedLimit={hasReachedLimit}
                />
              </div>
            )}
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
          title="Rimuovere la richiesta?"
          description={`Vuoi rimuovere la richiesta di grazia per "${votoToRemove}"?`}
        />
      )}
    </PageContainer>
  );
}
