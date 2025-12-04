import React from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth-neon";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useMinisteroData } from "./hooks/useMinisteroData";
import { useMinisteroActions } from "./hooks/useMinisteroActions";
import { Header } from "./components/Header";
import { TopTen } from "./components/TopTen";
import { VotingForm } from "./components/VotingForm";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { BlockedWarning } from "./components/BlockedWarning";
import { ministeri } from "../constants/ministeri";

export default function MinisteroPage() {
  const authReady = useAuthReady();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  
  // Trova il ministero corrispondente
  const ministero = ministeri.find(m => m.slug === slug);
  
  const { data, isLoading, isError, saveVotiMutation } = useMinisteroData(user, ministero?.categoria);
  const { 
    votingState, 
    setVotingState,
    updateField, 
    addNomeLocal, 
    removeLocal, 
    toggleSelezioneClassifica, 
    showClassifica, 
    saveVoti 
  } = useMinisteroActions(data);



  const handleSaveVoti = () => {
    saveVotiMutation.mutate(votingState.selectedVoti, {
      onSuccess: () => {
        saveVoti();
        // I dati verranno aggiornati automaticamente tramite il refetch
      }
    });
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!ministero) {
    return <Redirect to="/governo" />;
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4 page-with-navbar">
        <div className="container mx-auto max-w-4xl">
          <Header ministero={ministero} unlockDate={data?.blocco.unlockDate} />

          {data?.blocco.isBlocked && (
            <BlockedWarning unlockDate={data.blocco.unlockDate} />
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingState />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8">
              <ErrorState />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Il tuo voto */}
              <VotingForm
                votingState={votingState}
                data={data}
                onUpdateField={updateField}
                onAddNome={addNomeLocal}
                onRemove={removeLocal}
                onShowForm={showClassifica}
                onSaveVoti={handleSaveVoti}
              />

              {/* Classifica candidati */}
              <TopTen
                classifiche={data?.classifiche || []}
                selectedVoti={votingState.selectedVoti}
                onToggleSelezione={toggleSelezioneClassifica}
                showAllClassifica={votingState.showAllClassifica}
              />
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
