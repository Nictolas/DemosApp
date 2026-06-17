import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Header />

        {data?.blocco.isBlocked && (
          <BlockedWarning unlockDate={data.blocco.unlockDate} />
        )}

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
            <div className="flex justify-start items-center mb-4">
              <CreateButton onClick={showForm} />
            </div>
            
            {votingState.showForm && (
              <CarceratoForm
                onSubmit={handleCreateCarcerato}
                onCancel={hideForm}
                isLoading={false}
              />
            )}

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
    </div>
  );
}
