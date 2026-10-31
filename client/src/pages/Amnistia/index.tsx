import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { useAmnistiaData } from "./hooks/useAmnistiaData";
import { useAmnistiaVoting } from "./hooks/useAmnistiaVoting";
import { Header } from "./components/Header";
import { ProposeSubjectButton } from "@/components/ProposeSubjectButton";
import { AmnistiaForm } from "./components/AmnistiaForm";
import { ClassificaLeggi } from "./components/ClassificaLeggi";
import { getSuggestions } from "./utils/amnistiaUtils";

export default function Amnistia() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();

  const { data, isLoadingData, addVoteMutation, removeVoteMutation } = useAmnistiaData(user);
  const { 
    votingState, 
    updateField, 
    showSuggestions, 
    hideSuggestions, 
    showClassifica, 
    selectSuggestion,
    handleAddVote,
    handleRemoveVote,
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  } = useAmnistiaVoting(data);

  const suggestions = getSuggestions(data?.classifica || [], votingState.leggeInput, votingState.showSuggestions);

  const onSubmit = (e: React.FormEvent) => {
    handleAddVote(e, votingState.leggeInput, addVoteMutation);
  };

  const onVote = (legge: string) => {
    // Salva automaticamente il voto quando si clicca su "Vota" nella classifica
    if (data?.mieiVoti.includes(legge)) {
      // Se già votato, rimuovi il voto
      handleRemoveVote(legge, removeVoteMutation);
    } else {
      // Se non votato, aggiungi il voto
      handleAddVote({ preventDefault: () => {} } as React.FormEvent, legge, addVoteMutation);
    }
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


  return (
    <PageContainer className="overflow-hidden bg-gray-50">
      {/* Stessa testata bianca, centrata e fissa delle directory pubbliche. */}
      <div className="amnistia-page__fixed-header shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-3 sm:px-6 sm:pt-4">
        <div className="relative mx-auto w-full max-w-6xl">
          <Header />
          <div className="absolute right-0 top-0 z-10">
            <ProposeSubjectButton category="amnistia" />
          </div>
        </div>
      </div>
      <div className="container mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 md:grid-cols-2 md:grid-rows-1 lg:gap-6">
          {/* Comandi di voto fissi; solo la lista sottostante scorre. */}
          <div className="amnistia-page__fixed-controls min-h-0 min-w-0 space-y-1 lg:space-y-3">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <AmnistiaForm
                  leggeInput={votingState.leggeInput}
                  showSuggestions={votingState.showSuggestions}
                  mieiVoti={data?.mieiVoti || []}
                  suggestions={suggestions}
                  isPending={addVoteMutation.isPending}
                  onUpdateField={updateField}
                  onSubmit={onSubmit}
                  onRemoveVote={(legge) => handleRemoveVote(legge, removeVoteMutation)}
                  onSelectSuggestion={selectSuggestion}
                  onShowSuggestions={showSuggestions}
                  onHideSuggestions={hideSuggestions}
                  hasReachedLimit={hasReachedLimit}
                />
              </>
            )}
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden">
            {!isLoadingData && (
              <ClassificaLeggi
                classifica={data?.classifica || []}
                showAllClassifica={votingState.showAllClassifica}
                isPending={addVoteMutation.isPending}
                onVote={onVote}
                onShowClassifica={showClassifica}
                hasReachedLimit={hasReachedLimit}
                mieiVoti={data?.mieiVoti || []}
              />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
