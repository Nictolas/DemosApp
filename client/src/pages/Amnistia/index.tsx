import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { useAmnistiaData } from "./hooks/useAmnistiaData";
import { useAmnistiaVoting } from "./hooks/useAmnistiaVoting";
import { Header } from "./components/Header";
import { AmnistiaForm } from "./components/AmnistiaForm";
import { ClassificaLeggi } from "./components/ClassificaLeggi";
import { LoadingStates } from "./components/LoadingStates";
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
    handleCreateAmnistia
  } = useAmnistiaVoting(data);

  const suggestions = getSuggestions(data?.classifica || [], votingState.leggeInput, votingState.showSuggestions);

  const onSubmit = (e: React.FormEvent) => {
    handleAddVote(e, votingState.leggeInput, addVoteMutation);
  };

  const onVote = (legge: string) => {
    updateField('leggeInput', legge);
  };

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
      <div className="container mx-auto max-w-4xl">
        <LoadingStates 
          authReady={authReady} 
          isLoading={isLoading} 
          isLoadingData={isLoadingData} 
        />
        
        <Header />

        <div className="space-y-6">
          <div className="flex justify-start items-center mb-4">
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
          />

          <ClassificaLeggi
            classifica={data?.classifica || []}
            showAllClassifica={votingState.showAllClassifica}
            isPending={addVoteMutation.isPending}
            onVote={onVote}
            onShowClassifica={showClassifica}
          />
        </div>
      </div>
    </div>
  );
}
