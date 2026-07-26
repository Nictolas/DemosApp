import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAmnistiaData } from "./hooks/useAmnistiaData";
import { useAmnistiaVoting } from "./hooks/useAmnistiaVoting";
import { Header } from "./components/Header";
import { AmnistiaForm } from "./components/AmnistiaForm";
import { ClassificaLeggi } from "./components/ClassificaLeggi";
import { CreateButton } from "./components/CreateButton";
import { CarceratoForm } from "./components/CarceratoForm";
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
    showForm,
    hideForm,
    handleCreateAmnistia,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 p-4 page-with-navbar">
      <div className="w-full max-w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Colonna sinistra: Header, form e voto */}
          <div className="space-y-6">
            <Header />

            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex justify-start items-center">
                  <CreateButton onClick={showForm} />
                </div>

                {votingState.showForm && (
                  <CarceratoForm
                    onSubmit={handleCreateAmnistia}
                    onCancel={hideForm}
                    isLoading={false}
                  />
                )}

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

          {/* Colonna destra: Classifica Leggi */}
          {!isLoadingData && (
            <div className="lg:sticky lg:top-4">
              <ClassificaLeggi
                classifica={data?.classifica || []}
                showAllClassifica={votingState.showAllClassifica}
                isPending={addVoteMutation.isPending}
                onVote={onVote}
                onShowClassifica={showClassifica}
                hasReachedLimit={hasReachedLimit}
                mieiVoti={data?.mieiVoti || []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
