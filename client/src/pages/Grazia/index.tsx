import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGraziaData } from "./hooks/useGraziaData";
import { useGraziaVoting } from "./hooks/useGraziaVoting";
import { hasVotiChanged } from "./utils/graziaUtils";
import { Header } from "./components/Header";
import { BlockedWarning } from "./components/BlockedWarning";
import { GraziaForm } from "./components/GraziaForm";
import { ClassificaCarcerati } from "./components/ClassificaCarcerati";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CreateButton } from "./components/CreateButton";
import { CarceratoForm } from "./components/CarceratoForm";
import { VotingLimitsInfo } from "@/components/VotingLimitsInfo";

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
    showClassifica, 
    saveVoti,
    showForm,
    hideForm,
    handleCreateCarcerato,
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  } = useGraziaVoting(data);

  // Gestione salvataggio voti
  const handleSaveVoti = () => {
    saveVotiMutation.mutate(votingState.selectedVoti, {
      onSuccess: () => {
        toast({ 
          title: "Preferenze salvate", 
          description: `Le tue richieste di grazia sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
        });
        saveVoti();
      },
      onError: (error: any) => {
        toast({ 
          title: "Errore", 
          description: error.message || "Impossibile salvare le richieste.", 
          variant: "destructive" 
        });
      }
    });
  };

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

  const votiCambiati = hasVotiChanged(votingState.selectedVoti, data?.mieiVoti || []);

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

            {/* Informazioni sui limiti di voto */}
            <VotingLimitsInfo
              category="grazia"
              currentVotes={currentVotes}
            />

            <GraziaForm
              nomeInput={votingState.nomeInput}
              selectedVoti={votingState.selectedVoti}
              isBlocked={data?.blocco.isBlocked || false}
              isPending={saveVotiMutation.isPending}
              onUpdateField={updateField}
              onSubmit={addNomeLocal}
              onRemoveLocal={removeLocal}
              hasReachedLimit={hasReachedLimit}
            />

            <ClassificaCarcerati
              classifica={data?.classifica || []}
              selectedVoti={votingState.selectedVoti}
              showAllClassifica={votingState.showAllClassifica}
              isBlocked={data?.blocco.isBlocked || false}
              isPending={saveVotiMutation.isPending}
              onToggleSelezione={toggleSelezioneClassifica}
              onShowClassifica={showClassifica}
              hasReachedLimit={hasReachedLimit}
            />

            <div className="flex justify-end mt-4">
              <Button 
                onClick={() => updateField('showConfirmDialog', true)} 
                disabled={saveVotiMutation.isPending || !votiCambiati || data?.blocco.isBlocked}
              >
                {saveVotiMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salva le mie Richieste
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={votingState.showConfirmDialog}
        onOpenChange={(open) => updateField('showConfirmDialog', open)}
        onConfirm={handleSaveVoti}
        isPending={saveVotiMutation.isPending}
      />
    </div>
  );
}
