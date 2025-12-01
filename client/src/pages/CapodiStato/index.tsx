import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
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
    hasReachedLimit
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <Header />

        {data?.blocco.isBlocked && (
          <BlockedWarning unlockDate={data.blocco.unlockDate} />
        )}

        {isLoadingData || isLoadingConsenso ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sezione Consenso */}
            {consensoData && (
              <ConsensoSection
                data={consensoData}
                onVote={voteConsenso}
                isVoting={isVotingConsenso}
              />
            )}

            {/* Il tuo voto */}
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

            {/* Classifica candidati */}
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
  );
}
